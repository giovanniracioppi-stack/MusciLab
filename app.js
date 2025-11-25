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
    `🎄 1. Che cosa ti piace di più del Natale?`,
    `💫 2. Vuoi che nella canzone ci sia un personaggio speciale? Babbo Natale, un elfo, un animale, o proprio tu…?`,
    `🎸 3. Dove si svolge la storia della tua canzone (nel bosco, a casa, al Polo Nord, a scuola…)?`,
    `🎵 4. Che cosa succede nella canzone? Mi racconti un momento speciale.`,
    `📜 5. Quali emozioni vuoi trasmettere? Che ne dici di allegria? O magari sorpresa? Meglio magia?`,
    `🗣️ 6. C’è una frase o una parola che ti piacerebbe ripetere nel ritornello?`,
    `🪄 7. Vuoi che la canzone insegni qualcosa? Ad esempio, essere gentili, condividere, aiutare gli altri?`,
    `🔔 8. Preferisci una musica veloce o lenta?`,
    `🌟 9. Quali strumenti ti piacciono di più per una canzone di Natale?`,
    `🎁 10. Che tipo di musica preferisci tra: pop, filastrocca, classica, rock leggero, swing, o infine natalizia tradizionale?`
  ];
  return {
    id,
    name: "DoReMilla",
    initial: "DM",
    video: `Avatar_${id}.mp4`,
    question: questions[i]
  };
});

let currentIndex = 0;
let waitingForUser = false;
const answers = [];
let otpAttempts = 0;
let otpTimerId = null;
let otpVerifiedAt = null;
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
const chatEl = document.querySelector(".chat");
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
const typingEl = document.getElementById("typing");
const emailGate = document.getElementById("emailGate");
const avatarVideo = document.getElementById("avatarVideo");
const avatarVideoContainer = document.getElementById("avatarVideoContainer");
const avatarImageContainer = document.getElementById("avatarImageContainer");
const avatarImage = document.getElementById("avatarImage");
const emailInput = document.getElementById("emailInput");
const emailConfirmBtn = document.getElementById("emailConfirmBtn");
const emailError = document.getElementById("emailError");
const emailCodeInput = document.getElementById("emailCodeInput");
const codiciFileInput = document.getElementById("codiciFileInput");
const uploadCodiciBtn = document.getElementById("uploadCodiciBtn");
const otpGate = document.getElementById("otpGate");
const otpInput = document.getElementById("otpInput");
const otpConfirmBtn = document.getElementById("otpConfirmBtn");
const otpError = document.getElementById("otpError");
// Speech Recognition setup
let recognition = null;
let isRecognizing = false;
let forceEnableSend = false; // abilita Invia dopo stop esplicito
let stoppedByUser = false; // traccia se lo stop è stato richiesto dall'utente
let recognitionBuffer = "";
let userEmail = "";
let userAccessCode = "";
let userPhone = "";
let userConsentOTP = "";
let gatePhase = null;
let avatarAudioEnabled = false;
let avatarVideoAllowed = false;
let suggestionsEl = null;
const introLines = [
  "Ehi tu! 🎁\nSì, proprio tu che ami il Natale! ✨\nHai mai pensato… di creare la tua canzone di Natale?\nUna canzone tutta tua, piena di emozioni, suoni e magia? 🎶\nBene! Oggi diventi tu il compositore del Natale! 😍\nIo ti farò dieci domande super speciali… e con le tue risposte, creeremo insieme la canzone più magica dell’anno!\nPronto? 3… 2… 1… via! 🌟"
];
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRec) {
  recognition = new SpeechRec();
  recognition.lang = "it-IT";
  recognition.continuous = true;
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
    autoResize();
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
    userInput.disabled = true;
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
    if (stoppedByUser) {
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
      autoResize();
      if (waitingForUser) {
        forceEnableSend = true;
        sendBtn.disabled = false;
      } else {
        updateSendDisabled();
      }
      stoppedByUser = false;
    } else {
      try {
        isRecognizing = true;
        if (speakBtn) {
          speakBtn.classList.add("recording");
          const labelEl = speakBtn.querySelector(".speak-label");
          if (labelEl) labelEl.textContent = "Stop";
          if (speakIconPath) speakIconPath.setAttribute("d", STOP_D);
        }
        recognition.start();
      } catch (_) {}
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
    // Precarica sempre il video per evitare blocchi all'avvio
    avatarVideo.src = av.video;
    avatarVideo.preload = "auto";
    if (!avatarVideoAllowed) {
      if (avatarImageContainer) avatarImageContainer.classList.remove("is-hidden");
      if (avatarVideoContainer) avatarVideoContainer.classList.add("is-hidden");
      avatarCircle.style.display = "none";
      if (avatarImage) avatarImage.src = "avatar.png";
    } else {
      if (avatarImageContainer) avatarImageContainer.classList.add("is-hidden");
      if (avatarVideoContainer) avatarVideoContainer.classList.remove("is-hidden");
      avatarCircle.style.display = "none";
      avatarVideo.currentTime = 0;
      avatarVideo.loop = false;
      avatarVideo.muted = !avatarAudioEnabled;
    }

    const showVideo = () => {
      if (avatarVideoAllowed) {
        if (avatarVideoContainer) avatarVideoContainer.classList.remove("is-hidden");
        if (avatarImageContainer) avatarImageContainer.classList.add("is-hidden");
        avatarCircle.style.display = "none";
      }
    };

    const showCircle = () => {
      if (avatarVideoContainer) avatarVideoContainer.classList.add("is-hidden");
      avatarCircle.style.display = "grid";
      if (avatarImageContainer) avatarImageContainer.classList.remove("is-hidden");
    };

    const canplayHandler = () => {
      showVideo();
      avatarVideo.play().catch(() => {});
    };
    avatarVideo.addEventListener("canplaythrough", canplayHandler, { once: true });
    avatarVideo.addEventListener("canplay", canplayHandler, { once: true });
    avatarVideo.onended = () => {
      if (avatarImageContainer) avatarImageContainer.classList.remove("is-hidden");
      if (avatarVideoContainer) avatarVideoContainer.classList.add("is-hidden");
    };

    avatarVideo.onerror = () => {
      showCircle();
    };

    avatarVideo.load();
  }
}

function showTyping(show = true) {
  typingEl.style.display = show ? "block" : "none";
  if (show) {
    setTimeout(scrollToBottom, 0);
  } else {
    setTimeout(scrollToBottom, 0);
  }
}


function scrollToBottom() {
  try {
    if (chatEl && typeof chatEl.scrollTo === "function") {
      chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: "smooth" });
    } else if (chatEl) {
      chatEl.scrollTop = chatEl.scrollHeight;
    }
    const last = (chatEl && chatEl.lastElementChild) ? chatEl.lastElementChild : messagesEl.lastElementChild;
    if (last && typeof last.scrollIntoView === "function") last.scrollIntoView({ block: "end", behavior: "smooth" });
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  } catch (_) {
    try { window.scrollTo(0, document.documentElement.scrollHeight); } catch (_) {}
  }
}

function startCountdown(seconds) {
  let s = Math.max(1, seconds | 0);
  const bubble = document.createElement("div");
  bubble.className = "message avatar";
  const textEl = document.createElement("div");
  textEl.textContent = `Ricarico tra ${s}s`;
  const meta = document.createElement("div");
  meta.className = "bubble-meta";
  const tiny = document.createElement("div");
  tiny.className = "tiny-avatar";
  tiny.style.background = getAvatarColor(99);
  tiny.textContent = "ML";
  const who = document.createElement("span");
  who.textContent = "Assistente";
  meta.appendChild(tiny);
  meta.appendChild(who);
  bubble.appendChild(textEl);
  bubble.appendChild(meta);
  messagesEl.appendChild(bubble);
  scrollToBottom();
  const iv = setInterval(() => {
    s -= 1;
    if (s <= 0) {
      clearInterval(iv);
      location.reload();
      return;
    }
    textEl.textContent = `Ricarico tra ${s}s`;
    scrollToBottom();
  }, 1000);
}

function renderMessage(text, sender = "avatar", av = null) {
  const bubble = document.createElement("div");
  bubble.className = `message ${sender}`;
  const urlMatch = typeof text === "string" && /^https?:\/\//i.test(text.trim());
  if (urlMatch) {
    const a = document.createElement("a");
    a.href = text.trim();
    a.textContent = text.trim();
    a.target = "_blank";
    a.rel = "noopener";
    bubble.appendChild(a);
  } else {
    bubble.textContent = text;
  }

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
      if (idx === 0 && lines === introLines) {
        enableAudioFromStart();
      }
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
    waitingForUser = false;
    userInput.disabled = true;
    if (speakBtn) speakBtn.disabled = true;
    forceEnableSend = false;
    updateSendDisabled();
    if (currentIndex === 0) {
      try { showQuestion1Suggestions(); } catch (_) {}
    } else if (currentIndex === 1) {
      try { showQuestion2Suggestions(); } catch (_) {}
    } else if (currentIndex === 2) {
      try { showQuestion3Suggestions(); } catch (_) {}
    } else if (currentIndex === 3) {
      try { showQuestion4Suggestions(); } catch (_) {}
    } else if (currentIndex === 4) {
      try { showQuestion5Suggestions(); } catch (_) {}
    } else if (currentIndex === 5) {
      try { showQuestion6Suggestions(); } catch (_) {}
    } else if (currentIndex === 6) {
      try { showQuestion7Suggestions(); } catch (_) {}
    } else if (currentIndex === 7) {
      try { showQuestion8Suggestions(); } catch (_) {}
    } else if (currentIndex === 8) {
      try { showQuestion9Suggestions(); } catch (_) {}
    } else if (currentIndex === 9) {
      try { showQuestion10Suggestions(); } catch (_) {}
    }
    gateAnswerUntilVideoEnds();
  }, 600);
}

function finishFlow() {
  userInput.disabled = true;
  sendBtn.disabled = true;
  userInput.style.display = "none";
  sendBtn.style.display = "none";
  if (speakBtn) speakBtn.style.display = "none";
  if (speakHint) speakHint.style.display = "none";
  avatarVideoAllowed = false;
  if (avatarVideo) {
    try { avatarVideo.pause(); } catch (_) {}
  }
  if (avatarVideoContainer) avatarVideoContainer.classList.add("is-hidden");
  if (avatarImageContainer) avatarImageContainer.classList.remove("is-hidden");
  avatarCircle.style.display = "none";
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
    " 1. Crea il testo della canzone in base alle domande e risposte fornite dall'utente:",
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
    "    - Restituisci solo il testo completo della canzone senza spiegazioni aggiuntive.",
  ];
  const prompt = lines.join("\n");
  renderMessage("Sto scrivendo la tua canzone, dammi un attimo per pensare", "avatar", { id: 99, name: "MusicLab", initial: "ML" });
  showTyping(true);
  callMusicLab(prompt)
    .then((text) => {
      showTyping(false);
      const out = text && text.trim().length > 0 ? text.trim() : "Generazione vuota.";
      renderMessage("Creo anche l'audio della canzone e ti invio il link via email", "avatar", { id: 99, name: "Assistente", initial: "ML" });
      createSongAndEmail(out);
    })
    .catch((e) => {
      showTyping(false);
      const msg = String(e && e.message || "");
      let human = "Errore nella generazione del testo. Backend non raggiungibile.";
      if (msg.startsWith("backend_")) {
        const parts = msg.split("_", 3);
        const code = parts[1] || "";
        const body = parts[2] ? decodeURIComponent(parts[2]).slice(0, 500) : "";
        human = `Errore backend (${code}). ${body}`;
      } else if (msg.startsWith("local_")) {
        const parts = msg.split("_", 3);
        const code = parts[1] || "";
        const body = parts[2] ? decodeURIComponent(parts[2]).slice(0, 500) : "";
        human = `Errore server locale (${code}). ${body}`;
      }
      renderMessage(human, "avatar", { id: 99, name: "Assistente", initial: "ML" });
    });
}

let secretsPromise = null;
async function loadSecrets() {
  if (secretsPromise) return secretsPromise;
  secretsPromise = (async () => {
    const backendUrl = localStorage.getItem("MUSICLAB_BACKEND_URL") || "https://hyperlabs.pythonanywhere.com/";
    //const backendUrl = localStorage.getItem("MUSICLAB_BACKEND_URL") || "http://localhost:8888/";
    return { backendUrl };
  })();
  return secretsPromise;
}

function buildProducerCreatePayload(lyricsText) {
  const mv = localStorage.getItem("AIMUSIC_MV") || "FUZZ-2.0 Pro";
  const instrumental = String(localStorage.getItem("AIMUSIC_INSTRUMENTAL") || "false") === "true";
  const title = localStorage.getItem("AIMUSIC_TITLE") || "Back to You";
  const getAns = (n) => {
    const item = answers.find(a => a.numero === n);
    return item ? item.risposta : "";
  };
  const a7 = getAns(7);
  const a8 = getAns(8);
  const a9 = getAns(9);
  const a10 = getAns(10);
  const sound = [a7, a8, a9, a10].map(s => String(s || "").trim()).filter(Boolean).join(", ");
  return {
    task_type: "create_music",
    mv,
    sound: sound || "emotional pop with gentle piano, warm synths, and a catchy beat",
    lyrics_strength: 0.5,
    sound_strength: 0.5,
    make_instrumental: instrumental,
    title,
    lyrics: String(lyricsText || "").trim(),
  };
}

async function createSongAndEmail(lyricsText) {
  const { backendUrl } = await loadSecrets();
  const u = backendUrl.endsWith("/") ? backendUrl + "aimusic-producer-create" : backendUrl + "/aimusic-producer-create";
  try {
    const payload = buildProducerCreatePayload(lyricsText);
    const r = await fetch(u, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload }),
    });
    if (!r.ok) {
      const body = await r.text();
      renderMessage(`Generazione audio non avviata (${r.status}): ${body.slice(0,300)}`, "avatar", { id: 99, name: "Assistente", initial: "ML" });
      await notifyEmailWithSong("MusicLab — Testo canzone", lyricsText, "");
      return;
    }
    const j = await r.json();
    const base = (j && j.result) ? j.result : (j || {});
    let taskId = String(base.task_id || base.taskId || base.id || "");
    if (!taskId) {
      const obj = (j || {}).result || j || {};
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (k.toLowerCase().includes("task") && (typeof v === "string" || typeof v === "number")) {
          taskId = String(v);
          break;
        }
      }
    }
    if (!taskId) {
      renderMessage("Generazione audio avviata senza task id.", "avatar", { id: 99, name: "Assistente", initial: "ML" });
      await notifyEmailWithSong("MusicLab — Testo canzone", lyricsText, "");
      return;
    }
    renderMessage("Attendo che l'audio sia pronto…", "avatar", { id: 99, name: "Assistente", initial: "ML" });
    const url = await pollProducerTask(taskId);
    if (url) {
      renderMessage(url, "avatar", { id: 99, name: "Assistente", initial: "ML" });
      await notifyEmailWithSong("MusicLab — Link per il download", lyricsText, url);
      if (String(localStorage.getItem("AIMUSIC_AUTODOWNLOAD") || "false") === "true") {
        await autoDownloadSong(url);
      }
      if (String(localStorage.getItem("AIMUSIC_AUTORELOAD") || "false") === "true") {
        startCountdown(30);
      }
    } else {
      renderMessage("Generazione audio completata, ma nessun link trovato.", "avatar", { id: 99, name: "Assistente", initial: "ML" });
      await notifyEmailWithSong("MusicLab — Testo canzone", lyricsText, "");
    }
  } catch (e) {
    renderMessage("Errore durante la generazione audio.", "avatar", { id: 99, name: "Assistente", initial: "ML" });
    await notifyEmailWithSong("MusicLab — Testo canzone", lyricsText, "");
  }
}

async function pollProducerTask(taskId) {
  const { backendUrl } = await loadSecrets();
  const u = backendUrl.endsWith("/") ? backendUrl + "aimusic-task" : backendUrl + "/aimusic-task";
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(u, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId }),
      });
      if (r.ok) {
        const j = await r.json();
        const obj = (j || {}).result || j || {};
        let url = String(obj.url || obj.audio_url || obj.download_url || "");
        if (!url && Array.isArray(obj.data) && obj.data.length > 0) {
          const first = obj.data[0] || {};
          if (first.audio_url) url = String(first.audio_url || "");
          else if (first.url) url = String(first.url || "");
          else if (first.download_url) url = String(first.download_url || "");
        }
        url = sanitizeUrl(url);
        if (!url) {
          url = findAudioUrl(obj);
          url = sanitizeUrl(url);
        }
        const status = String(obj.status || obj.state || "").toLowerCase();
        if (url) return url;
        if (status === "failed" || status === "error") break;
      }
    } catch (_) {}
    await new Promise(res => setTimeout(res, 5000));
  }
  return "";
}

function findAudioUrl(o) {
  const exts = [".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"];
  const stack = [o];
  const seen = new Set();
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || seen.has(cur)) continue;
    seen.add(cur);
    if (typeof cur === "string") {
      let s = cur.trim();
      s = sanitizeUrl(s);
      if (/^https?:\/\//i.test(s)) {
        const low = s.toLowerCase();
        if (exts.some(e => low.includes(e)) || low.includes("audio") || low.includes("download")) return s;
      }
      continue;
    }
    if (Array.isArray(cur)) {
      for (let i = 0; i < cur.length; i++) stack.push(cur[i]);
      continue;
    }
    if (typeof cur === "object") {
      for (const k of Object.keys(cur)) {
        const v = cur[k];
        if (typeof v === "string") {
          let s = v.trim();
          s = sanitizeUrl(s);
          if (/^https?:\/\//i.test(s)) {
            const low = s.toLowerCase();
            if (exts.some(e => low.includes(e)) || k.toLowerCase().includes("url") || k.toLowerCase().includes("audio") || low.includes("download")) return s;
          }
        } else {
          stack.push(v);
        }
      }
    }
  }
  return "";
}

function sanitizeUrl(s) {
  if (!s) return "";
  let out = String(s).trim();
  while (out.startsWith("`") || out.startsWith("\"") || out.startsWith("'")) out = out.slice(1).trim();
  while (out.endsWith("`") || out.endsWith("\"") || out.endsWith("'")) out = out.slice(0, -1).trim();
  return out;
}

async function autoDownloadSong(url) {
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { document.body.removeChild(a); } catch (_) {}
    }, 0);
  } catch (_) {}
}

async function callMusicLab(prompt) {
  const { backendUrl } = await loadSecrets();
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
      const errBody = await r.text();
      throw new Error("backend_" + r.status + "_" + encodeURIComponent(errBody || ""));
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
    const errBody = await res.text();
    throw new Error("local_" + res.status + "_" + encodeURIComponent(errBody || ""));
  } catch (_) {}
  throw new Error("missing_backend");
}

async function sendConsentOtpEmail(email, code) {
  const { backendUrl } = await loadSecrets();
  if (!backendUrl || !email) return false;
  const subject = "MusicLab — Codice OTP consenso";
  const text = `Il tuo codice OTP è ${code}. Inseriscilo per confermare il consenso.`;
  const html = `<div>Il tuo codice OTP è <strong>${code}</strong>.</div><div>Inseriscilo per confermare il consenso.</div>`;
  const remote = backendUrl.endsWith("/") ? backendUrl + "send-email" : backendUrl + "/send-email";
  try {
    const res = await fetch(remote, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: [email], to_addrs: [email], toAddrs: [email], cc: [], bcc: [], subject, text, html }),
    });
    if (res.ok) return true;
    let codeErr = "";
    let detail = "";
    try {
      const j = await res.json();
      codeErr = j && j.error ? String(j.error) : "";
      detail = j && (j.detail || j.error || "");
    } catch (_) {
      try { detail = await res.text(); } catch (_) {}
    }
    const params = new URLSearchParams();
    params.append("to", email);
    params.append("subject", subject);
    params.append("text", text);
    params.append("html", html);
    const res2 = await fetch(remote, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (res2.ok) return true;
    try {
      const j2 = await res2.json();
      if (j2 && j2.error) {
        renderMessage("Invio OTP via e-mail non riuscito: " + j2.error, "avatar", { id: 99, name: "Assistente", initial: "ML" });
        if (j2.detail) renderMessage(String(j2.detail), "avatar", { id: 99, name: "Assistente", initial: "ML" });
      }
    } catch (_) {}
  } catch (_) {}
  return false;
}
async function markAppCodeUsed(code, email, dateISO, voiceFlag, otp) {
  const { backendUrl } = await loadSecrets();
  const payload = { code, email, date: dateISO, voice: voiceFlag, otp };
  if (!backendUrl) return false;
  try {
    const u = backendUrl.endsWith("/") ? backendUrl + "mark-code-used" : backendUrl + "/mark-code-used";
    const r = await fetch(u, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (r.ok) return true;
  } catch (_) {}
  return false;
}

async function notifyEmailWithSong(subject, songText, songUrl) {
  const { backendUrl } = await loadSecrets();
  if (!backendUrl || !userEmail) return;
  let codiciUrl = "";
  let codiciErr = "";
  codiciErr = "Pubblicazione CodiciAPP disattivata";
  // Drive upload disabilitato temporaneamente
  const consentLineText = `\nConsenso informato dato in data: ${otpVerifiedAt || "-"}, tramite codice otp inviato a ${userEmail || "-"}`;
  const codeLineText = `\nGenerazione avvenuta con codica attivazione: ${userAccessCode || "-"}`;
  const songLinkLineText = songUrl ? `\nLink download canzone: ${songUrl}` : "";
  const codiciLinkLineText = codiciUrl ? `\nLink download CodiciAPP: ${codiciUrl}` : "";
  const codiciErrLineText = codiciErr ? `\nErrore pubblicazione CodiciAPP: ${codiciErr}` : "";
  const bodyText = "Grazie per aver dato voce al Natale con \u201cCurno AI Christmas Sound\u201d!\n Hai appena creato la tua canzone unica… ora è il momento di farla risuonare!\n Scaricala qui e, se ti va, condividila con noi: ci piacerebbe sentirla!\n Tagga il Centro Commerciale Curno e usa gli hashtag: \n di seguito il testo della tua canzone " + songText + "\n #MyXmasSound #CurnoVibes #NataleInNote \n " + consentLineText + codeLineText + songLinkLineText + codiciLinkLineText + codiciErrLineText;
  const bodyHtml = "<div>Grazie per aver dato voce al Natale con \u201cCurno AI Christmas Sound\u201d!</div>" +
                   "<div>Hai appena creato la tua canzone unica… ora è il momento di farla risuonare!</div>" +
                   "<div>Scaricala qui e, se ti va, condividila con noi: ci piacerebbe sentirla!</div>" +
                   "<div>Tagga il Centro Commerciale Curno e usa gli hashtag:</div>" +
                   "<div>di seguito il testo della tua canzone</div>" +
                   "<pre style=\"white-space:pre-wrap;\">" + songText.replace(/</g, "&lt;") + "</pre>" +
                   "<div>#MyXmasSound #CurnoVibes #NataleInNote</div>" +
                   `<div>Consenso informato dato in data: ${otpVerifiedAt || "-"}, tramite codice otp inviato a ${userEmail || "-"}</div>` +
                   `<div>Generazione avvenuta con codica attivazione: ${userAccessCode || "-"}</div>` +
                   (songUrl ? `<div>Link download canzone: <a href="${songUrl}" target="_blank" rel="noopener">${songUrl}</a></div>` : "") +
                   (codiciUrl ? `<div>Link download CodiciAPP: <a href="${codiciUrl}" target="_blank" rel="noopener">${codiciUrl}</a></div>` : "") +
                   (codiciErr ? `<div>Errore pubblicazione CodiciAPP: ${codiciErr}</div>` : "");
  const recipients = [userEmail, "eventi.centrocommercialecurno@hyperlabs.it"].filter(Boolean);
  const remote = backendUrl.endsWith("/") ? backendUrl + "send-email" : backendUrl + "/send-email";
  let done = false;
  try {
    const res = await fetch(remote, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: recipients, to_addrs: recipients, toAddrs: recipients, cc: [], bcc: [], subject, text: bodyText, html: bodyHtml }),
    });
    if (res.ok) {
      renderMessage("Email inviata! Controlla la tua casella.", "avatar", { id: 99, name: "Assistente", initial: "ML" });
      done = true;
    } else {
      let detail = "";
      let code = "";
      try {
        const j = await res.json();
        code = j && j.error ? String(j.error) : "";
        detail = j && (j.detail || j.error || "");
      } catch (_) {
        try { detail = await res.text(); } catch (_) {}
      }
      const params = new URLSearchParams();
      for (const r of recipients) params.append("to", r);
      params.append("subject", subject);
      params.append("text", bodyText);
      params.append("html", bodyHtml);
      const res2 = await fetch(remote, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      if (res2.ok) {
        renderMessage("Email inviata! Controlla la tua casella.", "avatar", { id: 99, name: "Assistente", initial: "ML" });
        done = true;
      } else {
        let detail2 = "";
        let code2 = "";
        try {
          const j2 = await res2.json();
          code2 = j2 && j2.error ? String(j2.error) : "";
          detail2 = j2 && (j2.detail || j2.error || "");
        } catch (_) {
          try { detail2 = await res2.text(); } catch (_) {}
        }
        const human = emailErrorMessage(code2 || code, detail2 || detail, res2.status);
        renderMessage(human, "avatar", { id: 99, name: "Assistente", initial: "ML" });
      }
    }
  } catch (e) {
    renderMessage("Invio email non riuscito: errore imprevisto.", "avatar", { id: 99, name: "Assistente", initial: "ML" });
  }
  userEmail = "";
  userAccessCode = "";
}

async function uploadCodiciAppToBucket() {
  const { backendUrl } = await loadSecrets();
  if (!backendUrl) {
    renderMessage("Backend non configurato.", "avatar", { id: 99, name: "Assistente", initial: "ML" });
    return;
  }
  const f = codiciFileInput && codiciFileInput.files && codiciFileInput.files[0];
  if (!f) {
    renderMessage("Seleziona il file CodiciAPP.csv.", "avatar", { id: 99, name: "Assistente", initial: "ML" });
    return;
  }
  const name = f.name || "CodiciAPP.csv";
  const type = "text/csv";
  const reader = new FileReader();
  reader.onload = async () => {
    let base64 = "";
    const res = String(reader.result || "");
    const idx = res.indexOf(",");
    if (res.startsWith("data:")) {
      base64 = res.slice(idx + 1);
    } else {
      base64 = btoa(res);
    }
    try {
      const u = backendUrl.endsWith("/") ? backendUrl + "upload-to-b2" : backendUrl + "/upload-to-b2";
      const r = await fetch(u, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: name, contentBase64: base64, contentType: type, expiresSec: 604800 }),
      });
      if (r.ok) {
        const j = await r.json();
        const url = String((j || {}).url || "");
        if (url) {
          renderMessage("Upload riuscito.", "avatar", { id: 99, name: "Assistente", initial: "ML" });
          renderMessage(url, "avatar", { id: 99, name: "Assistente", initial: "ML" });
        } else {
          renderMessage("Upload riuscito.", "avatar", { id: 99, name: "Assistente", initial: "ML" });
        }
      } else {
        let detail = "";
        let code = "";
        try {
          const j = await r.json();
          code = j && j.error ? String(j.error) : "";
          detail = j && (j.detail || j.error || "");
        } catch (_) {
          try { detail = await r.text(); } catch (_) {}
        }
        const params = new URLSearchParams();
        params.append("fileName", name);
        params.append("contentBase64", base64);
        params.append("contentType", type);
        params.append("expiresSec", String(604800));
        const r2 = await fetch(u, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        });
        if (r2.ok) {
          try {
            const j2 = await r2.json();
            const url2 = String((j2 || {}).url || "");
            if (url2) {
              renderMessage("Upload riuscito.", "avatar", { id: 99, name: "Assistente", initial: "ML" });
              renderMessage(url2, "avatar", { id: 99, name: "Assistente", initial: "ML" });
            } else {
              renderMessage("Upload riuscito.", "avatar", { id: 99, name: "Assistente", initial: "ML" });
            }
          } catch (_) {
            renderMessage("Upload riuscito.", "avatar", { id: 99, name: "Assistente", initial: "ML" });
          }
        } else {
          let detail2 = "";
          let code2 = "";
          try {
            const j2 = await r2.json();
            code2 = j2 && j2.error ? String(j2.error) : "";
            detail2 = j2 && (j2.detail || j2.error || "");
          } catch (_) {
            try { detail2 = await r2.text(); } catch (_) {}
          }
          const msg = publishErrorMessage(code2 || code, detail2 || detail, r2.status);
          renderMessage(msg, "avatar", { id: 99, name: "Assistente", initial: "ML" });
        }
      }
    } catch (e) {
      renderMessage("Upload non riuscito: errore imprevisto.", "avatar", { id: 99, name: "Assistente", initial: "ML" });
    }
  };
  reader.readAsDataURL(f);
}

function emailErrorMessage(code, detail, status) {
  const map = {
    smtp_missing_config: "SMTP non configurato: completa il file secrets.json",
    smtp_not_configured: "SMTP non configurato",
    smtp_auth_failed: "Autenticazione SMTP fallita: verifica utente e password",
    smtp_connect_error: "Connessione SMTP non riuscita: verifica host e porta",
    smtp_dns_error: "Errore DNS: impossibile risolvere l'host SMTP",
    smtp_timeout: "Timeout connessione: il server SMTP non risponde",
    smtp_recipients_refused: "Destinatari rifiutati dal server SMTP",
    smtp_sender_refused: "Mittente rifiutato dal server SMTP",
    smtp_data_error: "Errore dati durante l'invio SMTP",
    smtp_helo_error: "Errore HELO/EHLO verso SMTP",
    smtp_error: "Errore SMTP generico",
    unknown_error: "Errore sconosciuto nel backend"
  };
  const base = map[code] || `Invio email non riuscito (${status})`;
  const extra = detail ? `: ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : "";
  return base + extra;
}

function publishErrorMessage(code, detail, status) {
  const map = {
    missing_file: "File CodiciAPP non trovato sul backend remoto",
    b2_missing_config: "Configurazione Backblaze B2 mancante nel secrets.json",
    b2_http_400: "Errore richiesta B2 (400)",
    b2_http_401: "Autorizzazione B2 fallita (401)",
    b2_http_403: "Permessi B2 insufficienti (403)",
    b2_http_404: "Bucket o risorsa B2 non trovata (404)",
    b2_http_429: "Rate limit B2 superato (429)",
    b2_http_500: "Errore interno B2 (500)",
  };
  const base = map[code] || `Pubblicazione CodiciAPP non riuscita (${status})`;
  const extra = detail ? `: ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : "";
  return base + extra;
}

 

async function handleUserAnswer(text) {
  
  const answerText = (text ?? "").trim();
  if (!answerText) return;
  renderMessage(answerText, "user");
  if (gatePhase) {
    const who = { id: 99, name: "Assistente", initial: "ML" };
    if (gatePhase === "email") {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!re.test(answerText)) {
        renderMessage("Email non valida. Riprova.", "avatar", who);
        waitingForUser = true;
        updateSendDisabled();
        return;
      }
      userEmail = answerText;
      renderMessage("Perfetto! Ora inserisci il codice di accesso", "avatar", who);
      gatePhase = "code";
      try {
        userInput.setAttribute("inputmode", "text");
        userInput.setAttribute("autocomplete", "off");
        userInput.placeholder = "Scrivi il codice e premi Invio…";
      } catch (_) {}
      if (speakBtn) speakBtn.disabled = false;
      if (emailGate) emailGate.style.display = "none";
      waitingForUser = true;
      userInput.value = "";
      userInput.disabled = false;
      updateSendDisabled();
      autoResize();
      return;
    }
    if (gatePhase === "code") {
      if (answerText.length < 4) {
        renderMessage("Codice non valido. Deve avere almeno 4 caratteri.", "avatar", who);
        waitingForUser = true;
        updateSendDisabled();
        return;
      }
      const codeUpper = String(answerText || "").trim().toUpperCase();
      const codeOk = await verifyAppCode(codeUpper);
      if (!codeOk.found) {
        renderMessage("Codice App non valido", "avatar", who);
        waitingForUser = true;
        updateSendDisabled();
        return;
      }
      if (codeOk.used) {
        renderMessage("Codice App già utilizzato", "avatar", who);
        waitingForUser = true;
        updateSendDisabled();
        return;
      }
      userAccessCode = codeUpper;
      const consent = `Per proseguire ho bisogno del tuo consenso al trattamento dei dati.\n\nFinalità e dati trattati:\n1) Invio della canzone generata → uso della tua e-mail.\n2) Invio di OTP via MAIL per confermare la tua identità.\n3) Uso della voce del minore per dialogo con l’assistente virtuale (solo con consenso del genitore/tutore).\n\nBase giuridica: tuo consenso (art. 6 e art. 8 GDPR).\nModalità: dati trattati in modo sicuro e non condivisi con terzi non autorizzati.\nConservazione: solo per il tempo necessario al servizio.\n\nPer acconsentire clicca su "SÌ, ACCONSENTO" in modo da consentirci l'invio del codice OTP per confermare il consenso`;
      renderMessage(consent, "avatar", who);
      try { showConsentSuggestions(); } catch (_) {}
      gatePhase = "phone";
      waitingForUser = true;
      userInput.value = "";
      autoResize();
      updateSendDisabled();
      return;
    }
    if (gatePhase === "phone") {
      const digits = (answerText || "").replace(/[^0-9+]/g, "");
      const isValid = /^\+?[0-9]{7,15}$/.test(digits);
      if (!isValid) {
        renderMessage("Numero non valido. Inserisci un telefono con 7-15 cifre.", "avatar", who);
        waitingForUser = true;
        updateSendDisabled();
        return;
      }
      userPhone = digits;
      try { localStorage.setItem("MUSICLAB_USER_PHONE", userPhone); } catch (_) {}
      userConsentOTP = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
      try { localStorage.setItem("MUSICLAB_OTP", userConsentOTP); } catch (_) {}
      const ok = await sendConsentOtpEmail(userEmail, userConsentOTP);
      if (ok) {
        gatePhase = "otp";
        otpAttempts = 0;
        if (otpTimerId) { try { clearTimeout(otpTimerId); } catch (_) {} otpTimerId = null; }
        otpTimerId = setTimeout(() => {
          renderMessage("Tempo scaduto: il codice OTP è scaduto.", "avatar", { id: 99, name: "Assistente", initial: "ML" });
          waitingForUser = false;
          updateSendDisabled();
          startCountdown(15);
          setTimeout(() => { try { location.reload(); } catch (_) {} }, 15000);
        }, 60000);
        if (otpGate) otpGate.style.display = "grid";
        if (userInput) userInput.disabled = true;
        try { otpInput && otpInput.focus(); } catch (_) {}
        return;
      } else {
        gatePhase = "otp";
        otpAttempts = 0;
        if (otpTimerId) { try { clearTimeout(otpTimerId); } catch (_) {} otpTimerId = null; }
        otpTimerId = setTimeout(() => {
          renderMessage("Tempo scaduto: il codice OTP è scaduto.", "avatar", { id: 99, name: "Assistente", initial: "ML" });
          waitingForUser = false;
          updateSendDisabled();
          startCountdown(15);
          setTimeout(() => { try { location.reload(); } catch (_) {} }, 15000);
        }, 60000);
        if (otpGate) otpGate.style.display = "block";
        if (otpError) { otpError.textContent = "Invio OTP via e-mail non riuscito. Riprova."; otpError.style.display = "block"; }
        if (userInput) userInput.disabled = true;
        try { otpInput && otpInput.focus(); } catch (_) {}
        return;
      }
    }
    if (gatePhase === "otp") {
      const onlyDigits = answerText.replace(/\D/g, "");
      if (!/^\d{6}$/.test(onlyDigits)) {
        renderMessage("Codice OTP non valido. Inserisci 6 cifre.", "avatar", who);
        waitingForUser = true;
        updateSendDisabled();
        return;
      }
      if (userConsentOTP && onlyDigits !== userConsentOTP) {
        otpAttempts += 1;
        if (otpAttempts >= 4) {
          renderMessage("Troppi tentativi errati", "avatar", who);
          waitingForUser = false;
          updateSendDisabled();
          if (otpTimerId) { try { clearTimeout(otpTimerId); } catch (_) {} otpTimerId = null; }
          setTimeout(() => { try { location.reload(); } catch (_) {} }, 15000);
          return;
        }
        renderMessage("Codice OTP errato. Riprova.", "avatar", who);
        waitingForUser = true;
        updateSendDisabled();
        return;
      }
      if (otpTimerId) { try { clearTimeout(otpTimerId); } catch (_) {} otpTimerId = null; }
      otpVerifiedAt = new Date().toISOString();
      try {
        const updated = await markAppCodeUsed(userAccessCode, userEmail, otpVerifiedAt, "Y", userConsentOTP);
        if (!updated) {
          renderMessage("Aggiornamento remoto del Codice App non riuscito. Riprova più tardi.", "avatar", who);
        }
      } catch (_) {
        renderMessage("Aggiornamento remoto del Codice App non riuscito. Riprova più tardi.", "avatar", who);
      }
      let codiciUrl = "";
      let codiciErr = "";
      let codiciDebug = "";
      codiciErr = "Pubblicazione CodiciAPP disattivata";
      try {
        const { backendUrl } = await loadSecrets();
        if (backendUrl) {
          const u = backendUrl.endsWith("/") ? backendUrl + "send-email" : backendUrl + "/send-email";
          const subject = "MusicLab — CodiciAPP aggiornato";
          const text = "Il file CodiciAPP è stato aggiornato e caricato. Link download: " + (codiciUrl || "-") + (codiciErr ? ("\nErrore pubblicazione CodiciAPP: " + codiciErr) : "") + (codiciDebug ? ("\nDettagli tecnici: " + codiciDebug) : "");
          const html = "<div>Il file CodiciAPP è stato aggiornato e caricato.</div>" + (codiciUrl ? `<div>Link download: <a href="${codiciUrl}" target="_blank" rel="noopener">${codiciUrl}</a></div>` : "<div>Nessun link disponibile</div>") + (codiciErr ? `<div>Errore pubblicazione CodiciAPP: ${codiciErr}</div>` : "") + (codiciDebug ? `<pre style="white-space:pre-wrap;">${codiciDebug.replace(/</g, "&lt;")}</pre>` : "");
          await fetch(u, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: ["giovanni.racioppi@hyperlabs.it"], subject, text, html }),
          });
        }
      } catch (_) {}
      gatePhase = null;
      waitingForUser = false;
      userInput.value = "";
      autoResize();
      playAssistantLines(introLines, showFirstQuestionAfterIntro);
      return;
    }
  }
  try { clearSuggestions(); } catch (_) {}
  
  answers.push({ numero: currentIndex + 1, categoria: categories[currentIndex], risposta: answerText });
  waitingForUser = false;
  userInput.value = "";
  autoResize();

  currentIndex += 1;
  if (currentIndex < avatars.length) {
    setTimeout(showNextQuestion, 450);
  } else {
    finishFlow();
  }
}

function showQuestion1Suggestions() {
  clearSuggestions();
  const list = [
    "Mi piacciono tantissimo i regali!",
    "Mi piace stare con tutta la famiglia.",
    "Adoro fare l’albero di Natale.",
    "Mi piace quando nevica e posso giocare fuori.",
    "Mi piace il profumo dei biscotti che fa la mamma.",
    "Mi piacciono le lucine che brillano dappertutto.",
    "Mi piace sentire le canzoncine di Natale.",
    "Mi piace lasciare i biscotti per Babbo Natale.",
    "Mi piace aprire il calendario dell’avvento ogni mattina.",
    "Mi piace perché tutti sono più felici."
  ];
  const cont = document.createElement("div");
  cont.className = "suggestions";
  list.forEach((t) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "suggestion-chip";
    chip.textContent = t;
    chip.addEventListener("click", () => {
      userInput.value = t;
      autoResize();
      updateSendDisabled();
      try { userInput.focus(); } catch (_) {}
    });
    cont.appendChild(chip);
  });
  suggestionsEl = cont;
  chatEl.appendChild(cont);
  scrollToBottom();
}

function clearSuggestions() {
  if (suggestionsEl && suggestionsEl.parentNode) {
    try { suggestionsEl.parentNode.removeChild(suggestionsEl); } catch (_) {}
  }
  suggestionsEl = null;
}

function showQuestion2Suggestions() {
  clearSuggestions();
  const list = [
    "Babbo Natale che vola col suo saccone gigante.",
    "Un elfo piccino che fa pasticci.",
    "Una renna che sa cantare.",
    "Un pupazzo di neve che prende vita.",
    "Una stellina che parla.",
    "Un orsetto polare che vuole fare amicizia.",
    "La Befana che sbaglia giorno.",
    "Un pinguino ballerino.",
    "Una fata del ghiaccio.",
    "Io che salvo il Natale!"
  ];
  const cont = document.createElement("div");
  cont.className = "suggestions";
  list.forEach((t) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "suggestion-chip";
    chip.textContent = t;
    chip.addEventListener("click", () => {
      userInput.value = t;
      autoResize();
      updateSendDisabled();
      try { userInput.focus(); } catch (_) {}
    });
    cont.appendChild(chip);
  });
  suggestionsEl = cont;
  chatEl.appendChild(cont);
  scrollToBottom();
}

function showQuestion3Suggestions() {
  clearSuggestions();
  const list = [
    "Al Polo Nord, nella fabbrica dei giocattoli.",
    "Nel bosco tutto illuminato.",
    "A casa mia, vicino all’albero.",
    "A scuola con i miei amici.",
    "Sulla slitta di Babbo Natale.",
    "Dentro un igloo gigante.",
    "Su una montagna piena di neve.",
    "In una città super luminosa.",
    "Nel cielo, tra le stelle.",
    "In un villaggio segreto degli elfi."
  ];
  const cont = document.createElement("div");
  cont.className = "suggestions";
  list.forEach((t) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "suggestion-chip";
    chip.textContent = t;
    chip.addEventListener("click", () => {
      userInput.value = t;
      autoResize();
      updateSendDisabled();
      try { userInput.focus(); } catch (_) {}
    });
    cont.appendChild(chip);
  });
  suggestionsEl = cont;
  chatEl.appendChild(cont);
  scrollToBottom();
}

function showQuestion4Suggestions() {
  clearSuggestions();
  const list = [
    "Una sorpresa di Natale cambia tutto.",
    "Il regalo sparisce e lo dobbiamo cercare.",
    "Babbo Natale si è raffreddato!",
    "Le renne fanno una gara.",
    "Le luci dell’albero parlano.",
    "Tutti iniziano a cantare senza motivo.",
    "Un bambino aiuta un elfo in difficoltà.",
    "Una neve magica fa brillare le cose.",
    "Una festa con biscotti e campanelle.",
    "Un sogno diventa vero."
  ];
  const cont = document.createElement("div");
  cont.className = "suggestions";
  list.forEach((t) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "suggestion-chip";
    chip.textContent = t;
    chip.addEventListener("click", () => {
      userInput.value = t;
      autoResize();
      updateSendDisabled();
      try { userInput.focus(); } catch (_) {}
    });
    cont.appendChild(chip);
  });
  suggestionsEl = cont;
  chatEl.appendChild(cont);
  scrollToBottom();
}

function showQuestion5Suggestions() {
  clearSuggestions();
  const list = [
    "Tanta allegria!",
    "La magia che fa battere il cuore.",
    "La sorpresa che ti fa dire ‘Wow!’.",
    "La tenerezza.",
    "La felicità di stare insieme.",
    "La calma della neve che scende.",
    "L’emozione dell’attesa.",
    "La voglia di abbracciarsi tutti.",
    "La sensazione di un desiderio che si avvera.",
    "Un po’ di mistero!"
  ];
  const cont = document.createElement("div");
  cont.className = "suggestions";
  list.forEach((t) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "suggestion-chip";
    chip.textContent = t;
    chip.addEventListener("click", () => {
      userInput.value = t;
      autoResize();
      updateSendDisabled();
      try { userInput.focus(); } catch (_) {}
    });
    cont.appendChild(chip);
  });
  suggestionsEl = cont;
  chatEl.appendChild(cont);
  scrollToBottom();
}

function showQuestion6Suggestions() {
  clearSuggestions();
  const list = [
    "Magia, magia!",
    "Din don dan!",
    "Natale è qua!",
    "Brilla, brilla!",
    "Yo-ho-ho!",
    "Tutti insieme!",
    "Neve che cade!",
    "Felice Natale!",
    "Sogna con me!",
    "Lalalalalà!"
  ];
  const cont = document.createElement("div");
  cont.className = "suggestions";
  list.forEach((t) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "suggestion-chip";
    chip.textContent = t;
    chip.addEventListener("click", () => {
      userInput.value = t;
      autoResize();
      updateSendDisabled();
      try { userInput.focus(); } catch (_) {}
    });
    cont.appendChild(chip);
  });
  suggestionsEl = cont;
  chatEl.appendChild(cont);
  scrollToBottom();
}

function showQuestion7Suggestions() {
  clearSuggestions();
  const list = [
    "A essere gentili.",
    "A condividere.",
    "Ad aiutare chi è triste.",
    "A dire grazie.",
    "A non litigare.",
    "A credere nei propri sogni.",
    "A non sprecare nulla.",
    "A volersi bene.",
    "A non arrendersi.",
    "A sorridere di più."
  ];
  const cont = document.createElement("div");
  cont.className = "suggestions";
  list.forEach((t) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "suggestion-chip";
    chip.textContent = t;
    chip.addEventListener("click", () => {
      userInput.value = t;
      autoResize();
      updateSendDisabled();
      try { userInput.focus(); } catch (_) {}
    });
    cont.appendChild(chip);
  });
  suggestionsEl = cont;
  chatEl.appendChild(cont);
  scrollToBottom();
}

function showQuestion8Suggestions() {
  clearSuggestions();
  const list = [
    "Veloce da ballare!",
    "Lenta e dolce.",
    "Veloce come le renne.",
    "Lenta come la neve che cade.",
    "Un po’ veloce e un po’ lenta.",
    "Così veloce che non sto fermo!",
    "Piano piano, come una ninna nanna.",
    "Media, come una passeggiata.",
    "Veloce come una festa.",
    "Lenta per ascoltare bene le parole."
  ];
  const cont = document.createElement("div");
  cont.className = "suggestions";
  list.forEach((t) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "suggestion-chip";
    chip.textContent = t;
    chip.addEventListener("click", () => {
      userInput.value = t;
      autoResize();
      updateSendDisabled();
      try { userInput.focus(); } catch (_) {}
    });
    cont.appendChild(chip);
  });
  suggestionsEl = cont;
  chatEl.appendChild(cont);
  scrollToBottom();
}

function showQuestion9Suggestions() {
  clearSuggestions();
  const list = [
    "Le campanelle!",
    "Il pianoforte.",
    "La chitarra.",
    "Il violino.",
    "Il flauto.",
    "Il tamburello.",
    "Il sassofono.",
    "La batteria.",
    "L’arpa.",
    "Le percussioni di legno che fanno toc toc!"
  ];
  const cont = document.createElement("div");
  cont.className = "suggestions";
  list.forEach((t) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "suggestion-chip";
    chip.textContent = t;
    chip.addEventListener("click", () => {
      userInput.value = t;
      autoResize();
      updateSendDisabled();
      try { userInput.focus(); } catch (_) {}
    });
    cont.appendChild(chip);
  });
  suggestionsEl = cont;
  chatEl.appendChild(cont);
  scrollToBottom();
}

function showConsentSuggestions() {
  clearSuggestions();
  const list = [
    "SÌ, ACCONSENTO",
    "NON, ACCONSENTO"
  ];
  const cont = document.createElement("div");
  cont.className = "suggestions";
  list.forEach((t) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "suggestion-chip";
    chip.textContent = t;
    chip.addEventListener("click", () => {
      if (/^NON/i.test(t)) {
        clearSuggestions();
        const who = { id: 99, name: "Assistente", initial: "ML" };
        renderMessage("Non avendo fornito il consenso al trattamento dei dati richiesto, al momento non è possibile proseguire con il servizio", "avatar", who);
        waitingForUser = false;
        gatePhase = null;
        if (userInput) userInput.disabled = true;
        if (sendBtn) sendBtn.disabled = true;
        if (speakBtn) speakBtn.disabled = true;
        startCountdown(15);
      } else {
        clearSuggestions();
        const who = { id: 99, name: "Assistente", initial: "ML" };
        userConsentOTP = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
        try { localStorage.setItem("MUSICLAB_OTP", userConsentOTP); } catch (_) {}
        (async () => {
          const ok = await sendConsentOtpEmail(userEmail, userConsentOTP);
          if (ok) {
            gatePhase = "otp";
            otpAttempts = 0;
            if (otpTimerId) { try { clearTimeout(otpTimerId); } catch (_) {} otpTimerId = null; }
            otpTimerId = setTimeout(() => {
              renderMessage("Tempo scaduto: il codice OTP è scaduto.", "avatar", { id: 99, name: "Assistente", initial: "ML" });
              waitingForUser = false;
              updateSendDisabled();
              startCountdown(15);
              setTimeout(() => { try { location.reload(); } catch (_) {} }, 15000);
            }, 60000);
            if (otpGate) otpGate.style.display = "grid";
            if (userInput) userInput.disabled = true;
            try { otpInput && otpInput.focus(); } catch (_) {}
          } else {
            gatePhase = "otp";
            otpAttempts = 0;
            if (otpTimerId) { try { clearTimeout(otpTimerId); } catch (_) {} otpTimerId = null; }
            otpTimerId = setTimeout(() => {
              renderMessage("Tempo scaduto: il codice OTP è scaduto.", "avatar", { id: 99, name: "Assistente", initial: "ML" });
              waitingForUser = false;
              updateSendDisabled();
              startCountdown(15);
              setTimeout(() => { try { location.reload(); } catch (_) {} }, 15000);
            }, 60000);
        if (otpGate) otpGate.style.display = "grid";
            if (otpError) { otpError.textContent = "Invio OTP via e-mail non riuscito. Riprova."; otpError.style.display = "block"; }
            if (userInput) userInput.disabled = true;
            try { otpInput && otpInput.focus(); } catch (_) {}
          }
        })();
      }
    });
    cont.appendChild(chip);
  });
  suggestionsEl = cont;
  chatEl.appendChild(cont);
  scrollToBottom();
}

function showQuestion10Suggestions() {
  clearSuggestions();
  const list = [
    "Pop, così è allegra.",
    "Filastrocca, per cantare tutti insieme.",
    "Classica, come nei film di Natale.",
    "Rock leggero, perché è divertente.",
    "Swing, così si balla!",
    "Musica natalizia tradizionale.",
    "Pop con un po’ di magia.",
    "Filastrocca molto ritmata.",
    "Classica con le campanelle.",
    "Rock ma morbido morbido."
  ];
  const cont = document.createElement("div");
  cont.className = "suggestions";
  list.forEach((t) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "suggestion-chip";
    chip.textContent = t;
    chip.addEventListener("click", () => {
      userInput.value = t;
      autoResize();
      updateSendDisabled();
      try { userInput.focus(); } catch (_) {}
    });
    cont.appendChild(chip);
  });
  suggestionsEl = cont;
  chatEl.appendChild(cont);
  scrollToBottom();
}

function handleSubmit(e) {
  e.preventDefault();
  handleUserAnswer(userInput.value);
  tryUnmuteAvatar();
}

chatForm.addEventListener("submit", handleSubmit);
userInput.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && !ev.shiftKey) {
    ev.preventDefault();
    handleUserAnswer(userInput.value);
    tryUnmuteAvatar();
  }
});

// Abilita/disabilita il pulsante Invia in base al contenuto dell'input
function updateSendDisabled() {
  const hasText = (userInput.value || "").trim().length > 0;
  if (!waitingForUser) {
    sendBtn.disabled = true;
    return;
  }
  if (isRecognizing) {
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

function autoResize() {
  userInput.style.height = "auto";
  const h = Math.min(userInput.scrollHeight, 220);
  userInput.style.height = h + "px";
}
userInput.addEventListener("input", autoResize);

function showKeyboardFor(el) {
  try {
    el.setAttribute("autocapitalize", "none");
    el.setAttribute("enterkeyhint", "done");
    el.focus({ preventScroll: false });
    try {
      const len = (el.value || "").length;
      if (typeof el.setSelectionRange === "function") {
        el.setSelectionRange(len, len);
      }
    } catch (_) {}
    try { el.click(); } catch (_) {}
    try {
      if (navigator.virtualKeyboard && typeof navigator.virtualKeyboard.show === "function") {
        navigator.virtualKeyboard.show();
      }
    } catch (_) {}
    try { el.scrollIntoView({ block: "end" }); } catch (_) {}
    setTimeout(() => {
      try { el.focus(); } catch (_) {}
    }, 60);
  } catch (_) {}
}

function tryUnmuteAvatar() {
  if (!avatarVideo) return;
  if (!avatarVideoAllowed) return;
  avatarAudioEnabled = true;
  avatarVideo.muted = false;
  avatarVideo.play().catch(() => {});
}

function enableAudioFromStart() {
  if (!avatarVideo) return;
  avatarVideoAllowed = true;
  avatarAudioEnabled = true;
  try {
    avatarVideo.src = "Avatar_Intro.mp4";
    avatarVideo.preload = "auto";
    avatarVideo.muted = false;
    avatarVideo.currentTime = 0;
    if (avatarVideoContainer) avatarVideoContainer.classList.remove("is-hidden");
    if (avatarImageContainer) avatarImageContainer.classList.add("is-hidden");
    avatarCircle.style.display = "none";
    avatarVideo.play().catch(() => {});
  } catch (_) {}
}

function gateAnswerUntilVideoEnds() {
  const enable = () => {
    waitingForUser = true;
    userInput.disabled = false;
    if (speakBtn) speakBtn.disabled = false;
    forceEnableSend = false;
    updateSendDisabled();
    userInput.focus();
  };
  if (avatarVideo && avatarVideoAllowed) {
    if (avatarVideo.ended || (avatarVideo.duration && avatarVideo.currentTime >= avatarVideo.duration)) {
      enable();
      return;
    }
    const handler = () => {
      avatarVideo.removeEventListener("ended", handler);
      enable();
    };
    avatarVideo.addEventListener("ended", handler);
    return;
  }
  enable();
}

if (avatarVideoContainer) {
  avatarVideoContainer.addEventListener("click", () => {
    avatarAudioEnabled = !avatarAudioEnabled;
    avatarVideo.muted = !avatarAudioEnabled;
    if (avatarAudioEnabled) {
      avatarVideo.play().catch(() => {});
    }
  });
}

if (speakBtn) {
  speakBtn.addEventListener("click", () => {
    if (!waitingForUser) return;
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
  updateHeaderAvatar(avatars[0]);
  showTyping(true);
  setTimeout(() => {
    showTyping(false);
    waitingForUser = false;
    gatePhase = "email";
    userInput.disabled = false;
    if (speakBtn) {
      speakBtn.disabled = true;
      speakBtn.classList.remove("recording");
    }
    if (speakHint) speakHint.style.display = "none";
    try {
      userInput.setAttribute("inputmode", "email");
      userInput.setAttribute("autocomplete", "email");
      userInput.placeholder = "Inserisci la tua email…";
    } catch (_) {}
    forceEnableSend = false;
    updateSendDisabled();
    autoResize();
  if (emailGate) emailGate.style.display = "block";
  if (emailInput) {
    emailInput.setAttribute("inputmode", "email");
    emailInput.setAttribute("autocomplete", "email");
    emailInput.focus();
    try { emailInput.setSelectionRange((emailInput.value || "").length, (emailInput.value || "").length); } catch (_) {}
  }
  }, 600);
  if (uploadCodiciBtn) {
    uploadCodiciBtn.addEventListener("click", () => {
      uploadCodiciAppToBucket();
    });
  }
  if (emailConfirmBtn && emailInput && emailCodeInput) {
    const submitGate = async () => {
      const vEmail = String(emailInput.value || "").trim();
      const vCode = String(emailCodeInput.value || "").trim();
      const vEmailU = vEmail.toUpperCase();
      const vCodeU = vCode.toUpperCase();
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!vEmail || !re.test(vEmail)) {
        if (emailError) emailError.textContent = "Inserisci un indirizzo email valido";
        if (emailError) emailError.style.display = "block";
        try { emailInput.focus(); } catch (_) {}
        return;
      }
      if (!vCode || vCode.length < 4) {
        if (emailError) emailError.textContent = "Inserisci un codice di accesso valido";
        if (emailError) emailError.style.display = "block";
        try { emailCodeInput.focus(); } catch (_) {}
        return;
      }
      if (emailError) emailError.style.display = "none";
      const res = await verifyAppCode(vCodeU);
      if (!res.found) {
        if (emailError) emailError.textContent = "Codice App non valido";
        if (emailError) emailError.style.display = "block";
        try { emailCodeInput.focus(); } catch (_) {}
        return;
      }
      if (res.used) {
        if (emailError) emailError.textContent = "Codice App già utilizzato";
        if (emailError) emailError.style.display = "block";
        try { emailCodeInput.focus(); } catch (_) {}
        return;
      }
      userEmail = vEmailU;
      userAccessCode = vCodeU;
      if (emailGate) emailGate.style.display = "none";
      if (speakBtn) speakBtn.disabled = false;
      gatePhase = "phone";
      waitingForUser = true;
      userInput.disabled = false;
      userInput.value = "";
      updateSendDisabled();
      autoResize();
      const who = { id: 99, name: "Assistente", initial: "ML" };      
      const consent = `Per proseguire ho bisogno del tuo consenso al trattamento dei dati.\n\nFinalità e dati trattati:\n1) Invio della canzone generata → uso della tua e-mail.\n2) Invio di OTP via MAIL per confermare la tua identità.\n3) Uso della voce del minore per dialogo con l’assistente virtuale (solo con consenso del genitore/tutore).\n\nBase giuridica: tuo consenso (art. 6 e art. 8 GDPR).\nModalità: dati trattati in modo sicuro e non condivisi con terzi non autorizzati.\nConservazione: solo per il tempo necessario al servizio.\n\nPer acconsentire clicca su "SÌ, ACCONSENTO" in modo da consentirci l'invio del codice OTP per confermare il consenso`;
      renderMessage(consent, "avatar", who);
      try { showConsentSuggestions(); } catch (_) {}
      try { userInput.focus(); } catch (_) {}
    };
    emailConfirmBtn.addEventListener("click", submitGate);
    emailInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        submitGate();
      }
    });
    emailCodeInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        submitGate();
      }
    });
  }
  if (otpConfirmBtn && otpInput) {
    const submitOtpGate = async () => {
      const onlyDigits = String(otpInput.value || "").replace(/\D/g, "");
      if (!/^\d{6}$/.test(onlyDigits)) {
        if (otpError) otpError.textContent = "Inserisci un codice OTP valido (6 cifre)";
        if (otpError) otpError.style.display = "block";
        try { otpInput.focus(); } catch (_) {}
        return;
      }
      if (userConsentOTP && onlyDigits !== userConsentOTP) {
        otpAttempts += 1;
        if (otpAttempts >= 4) {
          if (otpError) otpError.textContent = "Troppi tentativi: ricarico la pagina";
          if (otpError) otpError.style.display = "block";
          if (otpTimerId) { try { clearTimeout(otpTimerId); } catch (_) {} otpTimerId = null; }
          startCountdown(15);
          setTimeout(() => { try { location.reload(); } catch (_) {} }, 15000);
          return;
        }
        if (otpError) otpError.textContent = "Codice OTP errato. Riprova.";
        if (otpError) otpError.style.display = "block";
        try { otpInput.focus(); } catch (_) {}
        return;
      }
      if (otpTimerId) { try { clearTimeout(otpTimerId); } catch (_) {} otpTimerId = null; }
      otpVerifiedAt = new Date().toISOString();
      try {
        const updated = await markAppCodeUsed(userAccessCode, userEmail, otpVerifiedAt, "Y", userConsentOTP);
        if (!updated) {
          renderMessage("Aggiornamento remoto del Codice App non riuscito. Riprova più tardi.", "avatar", { id: 99, name: "Assistente", initial: "ML" });
        }
      } catch (_) {
        renderMessage("Aggiornamento remoto del Codice App non riuscito. Riprova più tardi.", "avatar", { id: 99, name: "Assistente", initial: "ML" });
      }
      if (otpGate) otpGate.style.display = "none";
      gatePhase = null;
      waitingForUser = false;
      userInput.value = "";
      userInput.disabled = true;
      autoResize();
      playAssistantLines(introLines, showFirstQuestionAfterIntro);
    };
    otpConfirmBtn.addEventListener("click", submitOtpGate);
    otpInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        submitOtpGate();
      }
    });
  }
});
function showFirstQuestionAfterIntro() {
  if (avatarVideo && avatarVideoAllowed) {
    const ready = avatarVideo.duration && avatarVideo.currentTime >= avatarVideo.duration;
    if (avatarVideo.ended || ready) {
      showNextQuestion();
      return;
    }
    const handler = () => {
      avatarVideo.removeEventListener("ended", handler);
      showNextQuestion();
    };
    avatarVideo.addEventListener("ended", handler);
    return;
  }
  showNextQuestion();
}
async function sendConsentOtp(phone, code) {
  const { backendUrl } = await loadSecrets();
  const payload = { to: phone, code };
  // Try remote first
  if (backendUrl) {
    try {
      const u = backendUrl.endsWith("/") ? backendUrl + "send-otp" : backendUrl + "/send-otp";
      const r = await fetch(u, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (r.ok) return true;
      try {
        const j = await r.json();
        if (j && j.error) {
          renderMessage("Invio OTP non riuscito: " + j.error, "avatar", { id: 99, name: "Assistente", initial: "ML" });
          if (j.detail) renderMessage(String(j.detail), "avatar", { id: 99, name: "Assistente", initial: "ML" });
        }
      } catch (_) {}
    } catch (_) {}
  }
  try {
    const res = await fetch("/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return true;
    try {
      const j = await res.json();
      if (j && j.error) {
        renderMessage("Invio OTP non riuscito: " + j.error, "avatar", { id: 99, name: "Assistente", initial: "ML" });
        if (j.detail) renderMessage(String(j.detail), "avatar", { id: 99, name: "Assistente", initial: "ML" });
      }
    } catch (_) {}
  } catch (_) {}
  return false;
}

// Verifica OTP lato client rispetto a quello generato
async function verifyAppCode(code) {
  const { backendUrl } = await loadSecrets();
  const payload = { code };
  if (!backendUrl) return { found: false, used: false, error: true };
  try {
    const u = backendUrl.endsWith("/") ? backendUrl + "verify-code" : backendUrl + "/verify-code";
    const r = await fetch(u, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      const j = await r.json();
      return { found: !!j.found, used: !!j.used };
    }
  } catch (_) {}
  try {
    const r2 = await fetch("/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (r2.ok) {
      const j2 = await r2.json();
      return { found: !!j2.found, used: !!j2.used };
    }
  } catch (_) {}
  return { found: false, used: false, error: true };
}
