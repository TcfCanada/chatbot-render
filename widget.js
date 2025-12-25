(function () {
  const BACKEND_URL = "https://chatbot-render-r1ov.onrender.com/chat";

  const style = document.createElement("style");
  style.innerHTML = `
    .chat-launcher {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #2f2fff;
      color: white;
      font-size: 26px;
      border: none;
      cursor: pointer;
      z-index: 9999;
    }
    .chatbox {
      position: fixed;
      bottom: 90px;
      right: 20px;
      width: 360px;
      height: 520px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,.3);
      display: none;
      flex-direction: column;
      z-index: 9999;
      font-family: Arial;
    }
    .header {
      background: #2f2fff;
      color: white;
      padding: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .messages {
      flex: 1;
      padding: 14px;
      overflow-y: auto;
      background: #f4f6fb;
    }
    .msg { margin-bottom: 10px; }
    .user { text-align: right; }
    .bubble {
      display: inline-block;
      padding: 10px 14px;
      border-radius: 12px;
      max-width: 80%;
      font-size: 14px;
    }
    .user .bubble {
      background: #2f2fff;
      color: white;
    }
    .bot .bubble {
      background: white;
      border: 1px solid #ddd;
    }
    .input {
      display: flex;
      border-top: 1px solid #ddd;
    }
    .input input {
      flex: 1;
      border: none;
      padding: 12px;
      font-size: 14px;
    }
    .input button {
      background: #2f2fff;
      color: white;
      border: none;
      padding: 12px 16px;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);

  const container = document.createElement("div");
  container.innerHTML = `
    <button class="chat-launcher">💬</button>
    <div class="chatbox">
      <div class="header">
        Assistant Immobilier
        <button style="background:none;border:none;color:white;cursor:pointer;">✕</button>
      </div>
      <div class="messages">
        <div class="msg bot">
          <div class="bubble">
            Bonjour 👋<br><br>
            Je suis l’assistant IA dédié aux courtiers immobiliers à Montréal.
            Comment puis-je vous aider ?
          </div>
        </div>
      </div>
      <div class="input">
        <input placeholder="Écrivez votre message…" />
        <button>➤</button>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  const launcher = container.querySelector(".chat-launcher");
  const chatbox = container.querySelector(".chatbox");
  const closeBtn = container.querySelector(".header button");
  const input = container.querySelector("input");
  const sendBtn = container.querySelector(".input button");
  const messages = container.querySelector(".messages");

  launcher.onclick = () => chatbox.style.display = "flex";
  closeBtn.onclick = () => chatbox.style.display = "none";

  function add(role, text) {
    const div = document.createElement("div");
    div.className = "msg " + role;
    div.innerHTML = `<div class="bubble">${text}</div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  async function send() {
    const text = input.value.trim();
    if (!text) return;
    add("user", text);
    input.value = "";

    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      add("bot", data.reply);
    } catch {
      add("bot", "❌ Erreur. Veuillez réessayer.");
    }
  }

  sendBtn.onclick = send;
  input.addEventListener("keydown", e => e.key === "Enter" && send());
})();
