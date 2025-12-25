import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ----------------------------
// Health check
// ----------------------------
app.get("/", (req, res) => {
  res.send("Chatbot backend OK ✅");
});

// ----------------------------
// Serve widget.js
// ----------------------------
app.get("/widget.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.sendFile(path.join(__dirname, "widget.js"));
});

// ----------------------------
// Chat endpoint
// ----------------------------
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.status(400).json({ reply: "Message manquant." });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: `
You are a professional AI real estate assistant for brokers in Montreal.
You qualify buyers, sellers, and investors.
You ask smart follow-up questions.
Tone: professional, premium.
Reply in the user's language (French or English).
            `
          },
          {
            role: "user",
            content: userMessage
          }
        ]
      })
    });

    const data = await response.json();

    const reply =
      data.choices?.[0]?.message?.content ||
      "Merci pour votre message. Un conseiller vous contactera.";

    res.json({ reply });

  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "Erreur serveur. Veuillez réessayer." });
  }
});

// ----------------------------
// Start server
// ----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
