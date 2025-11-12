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
    name: "DoReMilla Campanella",
    initial: "DC",
    video: `Avatar_${id}.mp4`,
    question: questions[i],
  };
});

let currentIndex = 0;
let waitingForUser = false;
const answers = [];

// Riferimenti DOM
const messagesEl = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const speakBtn = document.getElementById("speakBtn");
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
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRec) {
  recognition = new SpeechRec();
  recognition.lang = "it-IT";
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isRecognizing = true;
    if (speakBtn) {
      speakBtn.classList.add("recording");
      const labelEl = speakBtn.querySelector(".speak-label");
      if (labelEl) labelEl.textContent = "Stop";
    }
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
    userInput.value = (finalText + interimText).trim();
    updateSendDisabled();
  };

  recognition.onerror = () => {
    if (speakBtn) {
      speakBtn.classList.remove("recording");
      const labelEl = speakBtn.querySelector(".speak-label");
      if (labelEl) labelEl.textContent = "Parla";
    }
    isRecognizing = false;
    userInput.disabled = false;
    updateSendDisabled();
  };

  recognition.onend = () => {
    isRecognizing = false;
    if (speakBtn) {
      speakBtn.classList.remove("recording");
      const labelEl = speakBtn.querySelector(".speak-label");
      if (labelEl) labelEl.textContent = "Parla";
    }
    userInput.disabled = false;
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
  const outro = [
    
    "Wow… che meraviglia! 🎶\nHai appena creato la base perfetta per una canzone di Natale che parlerà di te e del tuo modo di vivere la magia delle feste! ✨\nOra… chiudi gli occhi, ascolta la musica del Natale… e lascia che la tua immaginazione canti! 🎄🎶"];
  playAssistantLines(outro);
}

function handleUserAnswer(text) {
  if (!waitingForUser) return;
  const answerText = (text ?? "").trim();
  if (!answerText) return;
  renderMessage(answerText, "user");
  answers.push({ avatarId: avatars[currentIndex].id, answer: answerText });
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