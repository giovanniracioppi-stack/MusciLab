// Palette (anche in CSS) e logica della chat guidata

const palette = {
  orange: "#eb6631",
  blue: "#0068b2",
  sky: "#5bc4ff",
};

// Definizione dei 10 step con le domande natalizie
const avatars = Array.from({ length: 10 }, (_, i) => {
  const id = i + 1;
  const questions = [
    `🎄 1. La storia di Natale\nChi vuoi far vivere nella tua canzone?\nVuoi raccontare una storia speciale — come i preparativi per la notte più luminosa dell’anno, un incontro con gli amici o una serata piena di regali e risate — oppure vuoi parlare solo delle emozioni che si provano quando il Natale arriva nel cuore? ❤️`,
    `💫 2. L’emozione principale\nChe sentimento vuoi far sentire a chi ascolta?\nVuoi che provino gioia e allegria, oppure una dolce nostalgia di vecchi Natali?\nO magari vuoi trasmettere tenerezza, calore e meraviglia, come quando guardi le luci che brillano sull’albero? 🎇`,
    `🎸 3. Lo stile musicale\nChe ritmo avrà la tua canzone?\nForse un pop natalizio tutto da ballare? 💃\nUn jazz swing elegante come in un film sotto la neve? 🎩\nO un rock festivo pieno di energia e chitarre elettriche? 🎸\nScegli il tuo stile e accendi la musica!`,
    `🎵 4. Il ritmo e l’atmosfera\nImmagina di ascoltarla:\nvuoi una melodia lenta e dolce, da cantare vicino al camino… 🔥\noppure una allegra e spensierata, da far cantare a tutti? 🎉\nO una super energica, da saltare insieme agli amici? 😄`,
    `📜 5. La struttura della canzone\nVuoi seguire la classica forma con strofa e ritornello, come le canzoni famose che conosci, oppure preferisci qualcosa di più originale, come una storia cantata, con tante piccole scene che raccontano la magia del Natale? 🎭`,
    `🗣️ 6. La voce della storia\nChi parla nella tua canzone?\nVuoi che sia tu, che vivi il Natale in prima persona? (“Io sento la neve che cade…”)\nOppure vuoi parlare a qualcuno (“Tu sei la mia luce di Natale…”)\nO ancora, che ci sia un narratore misterioso che racconta la storia a tutti? 😯`,
    `🪄 7. Le parole\nCome vuoi che siano i testi?\nVuoi parole poetiche e piene di magia, come in una fiaba? 🌌\nO testi divertenti e spiritosi, che fanno sorridere chi ascolta? 😄\nO magari parole sincere e dolci, che arrivano dritte al cuore? 💖`,
    `🔔 8. Gli strumenti e i suoni\nAscolta con la fantasia… senti qualcosa? 👂\nForse le campanelle tintinnanti, il pianoforte che brilla, la chitarra acustica che riscalda l’atmosfera…\nO magari un coro di bambini e fiocchi di neve sonori che scendono dal cielo! ❄️\nQuali suoni porterai nella tua canzone?`,
    `🌟 9. Le ispirazioni\nHai una canzone di Natale che ami? O un artista che ti fa dire “Wow, vorrei cantare come lui!”? 🎤\nPuò essere una melodia dolce o una super festosa…\nDiccelo! Così prenderemo un pizzico di quella magia per la tua! ✨`,
    `🎁 10. Il messaggio finale\nE alla fine… cosa vuoi che resti nel cuore di chi ascolta la tua canzone? ❤️\nVuoi che sentano gioia, speranza, magia, o il calore della famiglia e dell’amicizia?\nPensa al momento dopo l’ultima nota… quale emozione vuoi che rimanga sospesa nell’aria? 💫`,
  ];
  return {
    id,
    name: "DoReMilla",
    initial: "DM",
    video: `Avatar_${id}.mp4`,
    question: questions[i], 
  };
});

let currentIndex = 0;
let waitingForUser = false;
const answers = [];
const categories = [
  "Storia delle canzone",
  "Emozione della canzone",
  "Stile musicale",
  "Ritmo della canzone",
  "Struttura della canzone",
  "Protagonista della canzone",
  "Testo",
  "Strumenti musicale",
  "Ispirazione",
  "Messaggio della canzone",
];

// Riferimenti DOM
const messagesEl = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const speakBtn = document.getElementById("speakBtn");
const speakHint = document.getElementById("speakHint");
const speakIconPath = speakBtn ? speakBtn.querySelector(".mic-icon path") : null;
const MIC_D = "M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 14 0h-2zm-5 8v-3h-2v3h2z";
const STOP_D = "M6 6h12v12H6z";
const avatarCircle = document.getElementById("avatarCircle");
const avatarName = document.getElementById("avatarName");
const avatarVideoContainer = document.getElementById("avatarVideoContainer");
const avatarVideo = document.getElementById("avatarVideo");
const typingEl = document.getElementById("typing");
// Speech Recognition setup
let recognition = null;
let isRecognizing = false;
let forceEnableSend = false; // abilita Invia dopo stop esplicito
let stoppedByUser = false; // traccia se lo stop è stato richiesto dall'utente
let recognitionBuffer = "";
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRec) {
  recognition = new SpeechRec();
  recognition.lang = "it-IT";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isRecognizing = true;
    if (speakBtn) {
      speakBtn.classList.add("recording");
      const labelEl = speakBtn.querySelector(".speak-label");
      if (labelEl) labelEl.textContent = "Stop";
      if (speakIconPath) speakIconPath.setAttribute("d", STOP_D);
    }
    if (speakHint) speakHint.style.display = "none";
    if (speakBtn) speakBtn.style.display = "inline-flex";
    recognitionBuffer = "";
    // Evita conflitti di input durante la dettatura
    userInput.disabled = true;
    sendBtn.disabled = true; // invia abilitato solo quando c'è testo
    // finché stiamo riconoscendo, non forziamo Invia
    forceEnableSend = false;
  };

  recognition.onresult = (event) => {
    let finalText = "";
    let interimText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalText += transcript + " ";
      } else {
        interimText = transcript;
      }
    }
    recognitionBuffer += finalText;
    userInput.value = (recognitionBuffer + interimText).trim();
    updateSendDisabled();
  };

  recognition.onerror = (event) => {
    if (speakBtn) {
      speakBtn.classList.remove("recording");
      const labelEl = speakBtn.querySelector(".speak-label");
      if (labelEl) labelEl.textContent = "Parla";
      if (speakIconPath) speakIconPath.setAttribute("d", MIC_D);
    }
    isRecognizing = false;
    userInput.disabled = false;
    updateSendDisabled();
    if (speakBtn) speakBtn.style.display = "inline-flex";
    const err = event && event.error ? event.error : "unknown";
    let msg = "Si è verificato un errore nella dettatura vocale.";
    if (err === "not-allowed") msg = "Permesso microfono negato. Concedi l'accesso al microfono nel browser.";
    else if (err === "no-speech") msg = "Non ho rilevato parlato. Prova a parlare più vicino al microfono.";
    else if (err === "audio-capture") msg = "Nessun microfono rilevato. Controlla le impostazioni audio del sistema.";
    else if (err === "network") msg = "Errore di rete del servizio di riconoscimento. Riprova tra poco.";
    renderMessage(msg, "avatar", { id: 99, name: "Assistente", initial: "ML" });

    if (speakHint) {
      if (err === "not-allowed") {
        speakHint.textContent = "Consenti il microfono nelle impostazioni del browser";
        speakHint.style.display = "inline";
      } else if (err === "audio-capture") {
        speakHint.textContent = "Controlla che un microfono sia collegato/attivo";
        speakHint.style.display = "inline";
      }
    }
  };

  recognition.onend = () => {
    isRecognizing = false;
    if (speakBtn) {
      speakBtn.classList.remove("recording");
      const labelEl = speakBtn.querySelector(".speak-label");
      if (labelEl) labelEl.textContent = "Parla";
      if (speakIconPath) speakIconPath.setAttribute("d", MIC_D);
    }
    userInput.disabled = false;
    if (speakBtn) speakBtn.style.display = "inline-flex";
    userInput.value = recognitionBuffer.trim();
    // Il testo dettato resta nell'input.
    // Se lo stop è stato richiesto dall'utente, abilitiamo subito Invia.
    if (stoppedByUser) {
      forceEnableSend = true;
      stoppedByUser = false;
      if (waitingForUser) {
        sendBtn.disabled = false;
      }
    } else {
      updateSendDisabled();
    }
  };
}
if (!SpeechRec && speakBtn) {
  speakBtn.disabled = true;
  const labelEl = speakBtn.querySelector(".speak-label");
  if (labelEl) labelEl.textContent = "Non supportato";
  speakBtn.title = "La dettatura vocale non è supportata dal tuo browser. Usa Chrome o Edge.";
}

function getAvatarColor(idx) {
  // Alterna i tre colori della palette
  const mod = idx % 3;
  if (mod === 0) return palette.sky;
  if (mod === 1) return palette.blue;
  return palette.orange;
}
function getAvatarColorRGBA(idx, a) {
  const mod = idx % 3;
  if (mod === 0) return `rgba(91,196,255,${a})`;
  if (mod === 1) return `rgba(0,104,178,${a})`;
  return `rgba(235,102,49,${a})`;
}

function updateHeaderAvatar(av) {
  // Aggiorna testo/nome
  avatarCircle.textContent = av.initial;
  avatarCircle.style.background = getAvatarColor(av.id);
  avatarName.textContent = av.name;

  // Prova a caricare e riprodurre il video
  if (avatarVideo) {
    avatarVideoContainer.style.display = "none";
    avatarCircle.style.display = "grid";
    avatarVideo.src = av.video;
    avatarVideo.currentTime = 0;
    avatarVideo.loop = false;
    avatarVideo.muted = true; // garantisce autoplay su kiosk

    const showVideo = () => {
      avatarVideoContainer.style.display = "block";
      avatarCircle.style.display = "none";
    };

    const showCircle = () => {
      avatarVideoContainer.style.display = "none";
      avatarCircle.style.display = "grid";
    };

    avatarVideo.oncanplay = () => {
      showVideo();
      avatarVideo.play().catch(() => {
        // in caso di blocco autoplay, restiamo muted e riproviamo
        avatarVideo.muted = true;
        avatarVideo.play().catch(() => {
          // se ancora fallisce, fallback al cerchio
          showCircle();
        });
      });
    };

    avatarVideo.onerror = () => {
      // se il file non esiste, fallback
      showCircle();
    };

    // Forza il caricamento
    avatarVideo.load();
  }
}

function showTyping(show = true) {
  typingEl.style.display = show ? "block" : "none";
}


function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderMessage(text, sender = "avatar", av = null) {
  const bubble = document.createElement("div");
  bubble.className = `message ${sender}`;
  bubble.textContent = text;

  // Meta (avatar piccolo e/o label)
  const meta = document.createElement("div");
  meta.className = "bubble-meta";

  if (sender === "avatar" && av) {
    const tiny = document.createElement("div");
    tiny.className = "tiny-avatar";
    tiny.style.background = getAvatarColor(av.id);
    tiny.textContent = av.initial;
    const who = document.createElement("span");
    who.textContent = av.name;
    meta.appendChild(tiny);
    meta.appendChild(who);
  } else {
    const who = document.createElement("span");
    who.textContent = "Tu";
    meta.appendChild(who);
  }

  bubble.appendChild(meta);
  messagesEl.appendChild(bubble);
  scrollToBottom();
}

// Sequenza di messaggi dell'assistente (intro/outro) con indicatore di digitazione
function playAssistantLines(lines, callback) {
  let idx = 0;
  const step = () => {
    if (idx >= lines.length) {
      if (typeof callback === "function") callback();
      return;
    }
    showTyping(true);
    setTimeout(() => {
      showTyping(false);
      renderMessage(lines[idx], "avatar", avatars[Math.min(currentIndex, avatars.length - 1)]);
      idx += 1;
      setTimeout(step, 500);
    }, 600);
  };
  step();
}

function showNextQuestion() {
  const av = avatars[currentIndex];
  updateHeaderAvatar(av);
  showTyping(true);
  setTimeout(() => {
    showTyping(false);
    renderMessage(av.question, "avatar", av);
    waitingForUser = true;
    userInput.disabled = false;
    // nuova domanda: rimuove forzatura di Invia
    forceEnableSend = false;
    updateSendDisabled();
    userInput.focus();
  }, 600);
}

function finishFlow() {
  userInput.disabled = true;
  sendBtn.disabled = true;
  const getAns = (n) => {
    const item = answers.find(a => a.numero === n);
    return item ? item.risposta : "";
  };
  const cats = [
    "Storia della canzone",
    "Emozione principale",
    "Stile musicale",
    "Ritmo della canzone",
    "Struttura della canzone",
    "Protagonista della canzone",
    "Parole da inserire nel esto della canzone",
    "Strumenti musicali predominanti",
    "Ispirazione",
    "Messaggio della canzone",
  ];
  const getQ = (n) => {
    const av = avatars[n - 1];
    return av ? av.question : "";
  };
  const lines = [
    "Sei un paroliere e cantautore italiano specializzato in canzoni per bambini.",
    " Il tuo compito è generare testi originali, semplici, allegri e adatti all’infanzia, seguendo le indicazioni fornite dall’utente.",
    " ",
    " ISTRUZIONI:",
    " ",
    " 1. Riceverai le seguenti informazioni dall’utente:",
    ...cats.map((c, i) => `    - Categoria: ${c} - domanda: ${getQ(i + 1)} - risposta: ${getAns(i + 1)}`),
    " ",
    " 2. CREA IL TESTO DELLA CANZONE:",
    "    - Linguaggio semplice e comprensibile per bambini.",
    "    - Tono positivo, gioioso, leggero e divertente.",
    "    - Inserisci immagini colorate, elementi magici o simpatici.",
    "    - Mantieni coerenza narrativa e ritmo cantabile.",
    "    - Evita contenuti violenti, complessi o non adatti all’infanzia.",
    "    - Rispetta la struttura richiesta.",
    "    - Evita rime forzate e cliché, prediligi metafore e immagini semplici.",
    " ",
    " 3. CONSEGNA:",
    "    - Restituisci **solo il testo completo della canzone**, senza spiegazioni aggiuntive.",
  ];
  const prompt = lines.join("\n");
  renderMessage("Sto scrivendo la tua canzone, dammi un attimo per pensare", "avatar", { id: 99, name: "MusicLab", initial: "ML" });
  showTyping(true);
  callMusicLab(prompt)
    .then((text) => {
      showTyping(false);
      const out = text && text.trim().length > 0 ? text.trim() : "Generazione vuota.";
      renderMessage(out, "avatar", { id: 99, name: "MusicLab", initial: "ML" });
    })
    .catch(() => {
      showTyping(false);
      renderMessage("Errore nella generazione del testo. Configura le credenziali in secrets.json o localStorage.", "avatar", { id: 99, name: "Assistente", initial: "ML" });
    });
}

let secretsPromise = null;
async function loadSecrets() {
  if (secretsPromise) return secretsPromise;
  secretsPromise = (async () => {
    try {
      const res = await fetch("secrets.json", { cache: "no-store" });
      if (res.ok) {
        const obj = await res.json();
        const apiKey = obj.apiKey || obj.OPENAI_API_KEY || localStorage.getItem("OPENAI_API_KEY");
        const model = obj.model || localStorage.getItem("OPENAI_MODEL") || "gpt-4o-mini";
        const assistantId = obj.assistantId || obj.OPENAI_ASSISTANT_ID || localStorage.getItem("OPENAI_ASSISTANT_ID");
        const backendUrl = obj.backendUrl || obj.BACKEND_URL || localStorage.getItem("MUSICLAB_BACKEND_URL");
        if (apiKey) localStorage.setItem("OPENAI_API_KEY", apiKey);
        if (assistantId) localStorage.setItem("OPENAI_ASSISTANT_ID", assistantId);
        if (model) localStorage.setItem("OPENAI_MODEL", model);
        if (backendUrl) localStorage.setItem("MUSICLAB_BACKEND_URL", backendUrl);
        return { apiKey, model, assistantId, backendUrl };
      }
    } catch (_) {}
    return {
      apiKey: localStorage.getItem("OPENAI_API_KEY"),
      model: localStorage.getItem("OPENAI_MODEL") || "gpt-4o-mini",
      assistantId: localStorage.getItem("OPENAI_ASSISTANT_ID"),
      backendUrl: localStorage.getItem("MUSICLAB_BACKEND_URL"),
    };
  })();
  return secretsPromise;
}

async function callMusicLab(prompt) {
  const { apiKey, model, assistantId, backendUrl } = await loadSecrets();
  if (backendUrl) {
    try {
      const u = backendUrl.endsWith("/") ? backendUrl + "generate" : backendUrl + "/generate";
      const r = await fetch(u, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (r.ok) {
        const d = await r.json();
        return d.text || "";
      }
    } catch (_) {}
  }
  try {
    const res = await fetch("/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.text || "";
    }
  } catch (_) {}
  if (!apiKey) throw new Error("missing_key");
  if (assistantId) {
    return callMusicLabAssistant(prompt, apiKey, assistantId);
  }
  return callMusicLabChat(prompt, apiKey, model);
}

async function callMusicLabChat(prompt, apiKey, model) {
  const body = {
    model,
    messages: [
      { role: "system", content: "Sei MusicLab, un paroliere e cantautore italiano per bambini. Rispondi solo con il testo completo della canzone." },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
  };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("http_" + res.status);
  const data = await res.json();
  const text = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
  return text;
}

async function callMusicLabAssistant(prompt, apiKey, assistantId) {
  const tRes = await fetch("https://api.openai.com/v1/threads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
      "OpenAI-Beta": "assistants=v2",
    },
    body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
  });
  if (!tRes.ok) throw new Error("http_" + tRes.status);
  const thread = await tRes.json();
  const rRes = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
      "OpenAI-Beta": "assistants=v2",
    },
    body: JSON.stringify({ assistant_id: assistantId }),
  });
  if (!rRes.ok) throw new Error("http_" + rRes.status);
  let run = await rRes.json();
  while (run.status === "queued" || run.status === "in_progress" || run.status === "requires_action") {
    await new Promise((r) => setTimeout(r, 1000));
    const sRes = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`, {
      headers: { Authorization: "Bearer " + apiKey, "OpenAI-Beta": "assistants=v2" },
    });
    if (!sRes.ok) throw new Error("http_" + sRes.status);
    run = await sRes.json();
  }
  if (run.status !== "completed") throw new Error("run_failed");
  const mRes = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
    headers: { Authorization: "Bearer " + apiKey, "OpenAI-Beta": "assistants=v2" },
  });
  if (!mRes.ok) throw new Error("http_" + mRes.status);
  const mData = await mRes.json();
  const msg = (mData && mData.data || []).find((x) => x.role === "assistant");
  const text = msg && msg.content && msg.content[0] && msg.content[0].text && msg.content[0].text.value ? msg.content[0].text.value : "";
  return text;
}

function handleUserAnswer(text) {
  if (!waitingForUser) return;
  const answerText = (text ?? "").trim();
  if (!answerText) return;
  renderMessage(answerText, "user");
  answers.push({ numero: currentIndex + 1, categoria: categories[currentIndex], risposta: answerText });
  waitingForUser = false;
  userInput.value = "";

  currentIndex += 1;
  if (currentIndex < avatars.length) {
    setTimeout(showNextQuestion, 450);
  } else {
    finishFlow();
  }
}

function handleSubmit(e) {
  e.preventDefault();
  handleUserAnswer(userInput.value);
}

chatForm.addEventListener("submit", handleSubmit);
userInput.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && !ev.shiftKey) {
    // Enter invia, Shift+Enter potrebbe essere usato per multi-line (non richiesto qui)
  }
});

// Abilita/disabilita il pulsante Invia in base al contenuto dell'input
function updateSendDisabled() {
  const hasText = (userInput.value || "").trim().length > 0;
  if (!waitingForUser) {
    sendBtn.disabled = true;
    return;
  }
  // Se abbiamo forzato l'abilitazione dopo lo stop, tieni Invia abilitato
  if (forceEnableSend) {
    sendBtn.disabled = false;
    return;
  }
  sendBtn.disabled = !hasText;
}
userInput.addEventListener("input", updateSendDisabled);

if (speakBtn) {
  speakBtn.addEventListener("click", () => {
    if (!recognition) {
      // Fallback: informo che non è supportato
      renderMessage(
        "Il tuo browser non supporta la dettatura vocale.",
        "avatar",
        { id: 98, name: "Assistente", initial: "ML" }
      );
      return;
    }
    if (isRecognizing) {
      stoppedByUser = true;
      recognition.stop();
    } else {
      try {
        stoppedByUser = false;
        recognition.start();
      } catch (_) {
        // in alcuni browser, start può lanciare se già in esecuzione
        stoppedByUser = true;
        recognition.stop();
        renderMessage("Se non parte, consenti il microfono e usa Chrome/Edge su localhost.", "avatar", { id: 97, name: "Assistente", initial: "ML" });
        if (speakHint) {
          speakHint.textContent = "Consenti il microfono nel browser";
          speakHint.style.display = "inline";
        }
      }
    }
  });
}

// Avvio
window.addEventListener("DOMContentLoaded", () => {
  const intro = [
    "Ehi tu! 🎁\nSì, proprio tu che ami il Natale! ✨\nHai mai pensato… di creare la tua canzone di Natale?\nUna canzone tutta tua, piena di emozioni, suoni e magia? 🎶\nBene! Oggi diventi tu il compositore del Natale! 😍\nIo ti farò dieci domande super speciali… e con le tue risposte, creeremo insieme la canzone più magica dell’anno!\nPronto? 3… 2… 1… via! 🌟" ];
  updateHeaderAvatar(avatars[0]);
  playAssistantLines(intro, showNextQuestion);
});