import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();

// ✅ Mets ici le domaine du site client (ou "*" pour tester)
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// -----------------------------
// Mini "mémoire" par sessionId
// (suffisant pour une démo / MVP)
// -----------------------------
const sessions = new Map(); // sessionId -> messages[]

function getSessionId(req) {
  // On accepte sessionId venant du frontend.
  // Si absent, on met "default" (démo).
  return (req.body && req.body.sessionId) ? String(req.body.sessionId) : "default";
}

// -----------------------------
// Helpers lead capture (simple)
// -----------------------------
function extractLead(text) {
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = text.match(/(\+?1\s?)?(\(?\d{3}\)?)[\s.-]?\d{3}[\s.-]?\d{4}/);

  // Nom très basique: “je m’appelle X”, “mon nom est X”
  const nameMatch = text.match(/(?:je m'appelle|mon nom est)\s+([A-Za-zÀ-ÖØ-öø-ÿ'-]{2,}(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ'-]{2,}){0,3})/i);

  return {
    name: nameMatch ? nameMatch[1].trim() : null,
    email: emailMatch ? emailMatch[0].trim() : null,
    phone: phoneMatch ? phoneMatch[0].trim() : null
  };
}

function shouldAskForLead(text) {
  const t = text.toLowerCase();
  return (
    t.includes("visite") ||
    t.includes("rendez") ||
    t.includes("rdv") ||
    t.includes("rappel") ||
    t.includes("appeler") ||
    t.includes("contact") ||
    t.includes("disponible") ||
    t.includes("intéressé") ||
    t.includes("interessé")
  );
}

// -----------------------------
// SYSTEM PROMPT – Mario Conte
// -----------------------------
const SYSTEM_PROMPT = `
Tu es l’assistant IA du site marioconte.com (courtier immobilier à Montréal).
Ton but est de transformer un visiteur en contact qualifié (lead) en restant utile, clair et professionnel.

📌 Ce que le site propose :
- Propriétés (résidentiel, commercial, terrains, immeubles à revenus)
- Services : Acheter, Vendre, Louer
- Quartiers : Rosemont, Westmount, Anjou, Hochelaga-Maisonneuve, Laval, Ahuntsic, Rivière-des-Prairies, Villeray, Saint-Léonard, Ville-Marie
- Avis/Crédibilité, Blog, FAQ
- Contact : téléphone (514) 894-9400, email mario@marioconte.com, adresse 1225 Ave Greene, Westmount, QC H3Z 2A4

✅ Règles de réponse (priorité) :
1) Commence par clarifier l’intention : ACHETER / VENDRE / LOUER / PROPRIÉTÉS / QUARTIER / CONTACT.
2) Pose 1 à 2 questions max pour qualifier :
   - Si ACHETER/LOUER : budget + secteur + type de propriété + timing.
   - Si VENDRE : adresse/secteur + type + timing + objectif de prix (si possible).
3) Si l’utilisateur veut VISITER / être RAPPELÉ / CONTACTER :
   - Demande : prénom + téléphone + email (dans cet ordre), puis confirme que le courtier le contactera.
4) Donne le contact direct si demandé :
   - (514) 894-9400
   - mario@marioconte.com
5) Style : très simple, chaleureux, professionnel, concis. Utilise des puces quand utile.
6) Ne jamais parler de TCF Canada. Ne jamais répondre à des sujets hors immobilier/site.

🎯 Objectif final :
- Diriger vers une action : planifier une visite, être rappelé, envoyer une demande, ou consulter les propriétés.
`;

// -----------------------------
// Route santé
// -----------------------------
app.get("/", (req, res) => {
  res.send("Chatbot backend OK ✅");
});

// -----------------------------
// Route principale chat
// Body attendu : { message: "...", sessionId?: "abc" }
// -----------------------------
app.post("/chat", async (req, res) => {
  try {
    const userMessage = (req.body?.message || "").toString().trim();
    if (!userMessage) return res.status(400).json({ reply: "Pouvez-vous écrire votre message ?" });

    const sessionId = getSessionId(req);

    // Init session
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, [
        { role: "system", content: SYSTEM_PROMPT }
      ]);
    }

    const history = sessions.get(sessionId);

    // Capture lead (si présent)
    const lead = extractLead(userMessage);

    // Si l’utilisateur est en mode contact/visite, on demande infos si manquantes
    if (shouldAskForLead(userMessage)) {
      // On vérifie si on a déjà stocké un lead dans la session
      const existingLead = history.find(m => m.role === "system" && m.content.startsWith("LEAD:"));
      let stored = { name: null, email: null, phone: null };

      if (existingLead) {
        try { stored = JSON.parse(existingLead.content.replace("LEAD:", "").trim()); } catch {}
      }

      const merged = {
        name: lead.name || stored.name,
        email: lead.email || stored.email,
        phone: lead.phone || stored.phone
      };

      // Met à jour le stockage lead (dans un system message)
      if (existingLead) {
        existingLead.content = "LEAD: " + JSON.stringify(merged);
      } else {
        history.push({ role: "system", content: "LEAD: " + JSON.stringify(merged) });
      }

      // Demande progressive
      if (!merged.name) {
        return res.json({ reply: "Parfait 🙂 Quel est votre prénom ?" });
      }
      if (!merged.phone) {
        return res.json({ reply: `Merci ${merged.name} ! Quel est votre numéro de téléphone pour que Mario vous rappelle ?` });
      }
      if (!merged.email) {
        return res.json({ reply: "Super. Et votre adresse email ?" });
      }

      // Si tout est ok, confirmation
      return res.json({
        reply:
          `Parfait ✅ Merci ${merged.name} ! ` +
          `Je transmets votre demande à Mario Conte. ` +
          `Vous pouvez aussi le joindre directement au (514) 894-9400 ou à mario@marioconte.com.`
      });
    }

    // Ajoute message user dans l’historique
    history.push({ role: "user", content: userMessage });

    // Appel OpenAI (avec historique)
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: history.slice(-16) // limite simple pour éviter trop long
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || "Je peux vous aider à acheter, vendre ou louer. Que souhaitez-vous faire ?";

    // Sauvegarde réponse assistant
    history.push({ role: "assistant", content: reply });

    res.json({ reply });

  } catch (error) {
    console.error("Erreur /chat:", error);
    res.status(500).json({ reply: "Erreur serveur. Merci de réessayer." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
