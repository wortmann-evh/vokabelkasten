"use strict";

/**
 * Digitaler Vokabelkasten
 * - lädt data/vocab.txt (Englisch<TAB>Deutsch)
 * - 3 Stapel (1,2,3)
 * - richtig: Stufe hoch (1->2, 2->3), falsch: zurück nach 1
 * - alle 10 Karten: eine aus Stapel 2 (wenn vorhanden)
 * - Modus: DE->EN, EN->DE, Zufall
 * - Timer: leicht 15s, mittel 10s, schwer 5s (auto flip)
 * - Verbesserung (2): "zuletzt gefragt"-Puffer (verhindert direkte Wiederholungen)
 * - Verbesserung (3): Button "Knapp" (bleibt im aktuellen Stapel)
 * - Verbesserung (4): Session-Statistiken + schwierigste Wörter
 */

const FILE_PATH = "data/vocab.txt";

// --- UI elements ---
const screenStart = document.getElementById("screenStart");
const screenGame = document.getElementById("screenGame");
const screenEnd = document.getElementById("screenEnd");

const playerNameInput = document.getElementById("playerName");
const modeSelect = document.getElementById("modeSelect");
const difficultySelect = document.getElementById("difficultySelect");

const btnStart = document.getElementById("btnStart");
const btnReload = document.getElementById("btnReload");

const loadInfo = document.getElementById("loadInfo");
const miniStatus = document.getElementById("miniStatus");

const hudName = document.getElementById("hudName");
const hudMode = document.getElementById("hudMode");
const hudDifficulty = document.getElementById("hudDifficulty");

const hudRound = document.getElementById("hudRound");
const hudCorrect = document.getElementById("hudCorrect");
const hudWrong = document.getElementById("hudWrong");

const s1Count = document.getElementById("s1Count");
const s2Count = document.getElementById("s2Count");
const s3Count = document.getElementById("s3Count");

const timerText = document.getElementById("timerText");

const flipCard = document.getElementById("flipCard");
const questionText = document.getElementById("questionText");
const answerText = document.getElementById("answerText");
const pairText = document.getElementById("pairText");

const btnFlip = document.getElementById("btnFlip");
const answerButtons = document.getElementById("answerButtons");
const btnCorrect = document.getElementById("btnCorrect");
const btnWrong = document.getElementById("btnWrong");
const btnAlmost = document.getElementById("btnAlmost");
const btnEnd = document.getElementById("btnEnd");

const endTitle = document.getElementById("endTitle");
const endText = document.getElementById("endText");
const statRounds = document.getElementById("statRounds");
const statCorrect = document.getElementById("statCorrect");
const statWrong = document.getElementById("statWrong");
const statRate = document.getElementById("statRate");
const hardestList = document.getElementById("hardestList");
const btnRestart = document.getElementById("btnRestart");

// --- Game state ---
/**
 * cards: { id, en, de, box } where box in {1,2,3}
 */
let cards = [];
let stack1 = [];
let stack2 = [];
let stack3 = [];

let playerName = "";
let mode = "DE_EN"; // DE_EN | EN_DE | RANDOM
let difficulty = "MEDIUM";

let timeLimitSeconds = 10;

let currentCard = null;
let currentDirection = "DE_EN"; // the direction used for the current question (if mode RANDOM)
let isFlipped = false;

let round = 0;
let correct = 0;
let wrong = 0;

// per-card stats this session
const wrongCountById = new Map();
const askedCountById = new Map();

// timer
let timerInterval = null;
let remaining = 0;

// fairness buffer (Improvement 2)
const lastAskedBuffer = []; // store recent card IDs
const LAST_BUFFER_SIZE = 3;

// --- Helpers ---
function show(el){ el.classList.remove("hidden"); }
function hide(el){ el.classList.add("hidden"); }

function shuffle(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function difficultyToSeconds(d){
  if(d === "EASY") return 15;
  if(d === "HARD") return 5;
  return 10; // MEDIUM default
}

function modeLabel(m){
  if(m === "DE_EN") return "Deutsch → Englisch";
  if(m === "EN_DE") return "Englisch → Deutsch";
  return "Zufall";
}

function difficultyLabel(d){
  return `${d === "EASY" ? "Leicht" : d === "MEDIUM" ? "Mittel" : "Schwer"} (${difficultyToSeconds(d)}s)`;
}

function updateCounts(){
  s1Count.textContent = String(stack1.length);
  s2Count.textContent = String(stack2.length);
  s3Count.textContent = String(stack3.length);
}

function updateHUD(){
  hudName.textContent = playerName ? `Spieler: ${playerName}` : "Spieler";
  hudMode.textContent = `Modus: ${modeLabel(mode)}`;
  hudDifficulty.textContent = `Zeit: ${difficultyLabel(difficulty)}`;

  hudRound.textContent = String(round);
  hudCorrect.textContent = String(correct);
  hudWrong.textContent = String(wrong);

  updateCounts();

  miniStatus.textContent = `Stapel1 ${stack1.length} • Stapel2 ${stack2.length} • Stapel3 ${stack3.length}`;
}

function setLoadInfo(msg, ok=true){
  loadInfo.textContent = msg;
  loadInfo.style.color = ok ? "var(--muted)" : "#ffb0b0";
}

function resetCardUI(){
  isFlipped = false;
  flipCard.classList.remove("flipped");
  answerButtons.classList.add("hidden");
  btnFlip.disabled = false;
  questionText.textContent = "—";
  answerText.textContent = "—";
  pairText.textContent = "—";
}

function setCardTexts(card, dir){
  // dir is the direction for this question
  const q = (dir === "DE_EN") ? card.de : card.en;
  const a = (dir === "DE_EN") ? card.en : card.de;

  questionText.textContent = q;
  answerText.textContent = a;

  // show both as small "pair"
  pairText.textContent = `${card.en} — ${card.de}`;
}

function stopTimer(){
  if(timerInterval){
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function startTimer(seconds){
  stopTimer();
  remaining = seconds;
  timerText.textContent = String(remaining);

  timerInterval = setInterval(() => {
    remaining -= 1;
    if(remaining <= 0){
      timerText.textContent = "0";
      stopTimer();
      // auto flip
      flipNow();
    } else {
      timerText.textContent = String(remaining);
    }
  }, 1000);
}

function flipNow(){
  if(isFlipped) return;
  isFlipped = true;
  flipCard.classList.add("flipped");
  answerButtons.classList.remove("hidden");
  btnFlip.disabled = true;
}

function pushLastAsked(cardId){
  lastAskedBuffer.push(cardId);
  while(lastAskedBuffer.length > LAST_BUFFER_SIZE) lastAskedBuffer.shift();
}

function isInLastAsked(cardId){
  return lastAskedBuffer.includes(cardId);
}

function drawFromStack(stack){
  // fair pick: try several attempts to avoid recent repeats
  if(stack.length === 0) return null;

  if(stack.length === 1) return stack[0];

  for(let tries = 0; tries < 10; tries++){
    const idx = Math.floor(Math.random() * stack.length);
    const candidate = stack[idx];
    if(!isInLastAsked(candidate.id)) return candidate;
  }
  // if all candidates are in buffer (small stack), just return something
  return stack[Math.floor(Math.random() * stack.length)];
}

function removeFromStack(stack, cardId){
  const idx = stack.findIndex(c => c.id === cardId);
  if(idx >= 0) stack.splice(idx, 1);
}

function addToStackByBox(card){
  if(card.box === 1) stack1.push(card);
  else if(card.box === 2) stack2.push(card);
  else stack3.push(card);
}

function moveCardToBox(card, newBox){
  // remove from its current stack
  if(card.box === 1) removeFromStack(stack1, card.id);
  else if(card.box === 2) removeFromStack(stack2, card.id);
  else removeFromStack(stack3, card.id);

  card.box = newBox;
  addToStackByBox(card);
}

function pickDirectionForThisCard(){
  if(mode === "RANDOM"){
    return Math.random() < 0.5 ? "DE_EN" : "EN_DE";
  }
  return mode;
}

function shouldAskFromStack2ThisRound(){
  // every 10th answered card -> ask from stack2
  // Round counts answered cards, so after incrementing round we pick next.
  // For selection: if (round+1) % 10 === 0
  return ((round + 1) % 10 === 0) && stack2.length > 0;
}

function getNextCard(){
  // End condition: stack1 and stack2 empty -> done
  if(stack1.length === 0 && stack2.length === 0){
    return null;
  }

  let card = null;

  if(shouldAskFromStack2ThisRound()){
    card = drawFromStack(stack2);
    if(!card && stack1.length > 0) card = drawFromStack(stack1);
  } else {
    // normal: prefer stack1, else stack2
    card = drawFromStack(stack1);
    if(!card) card = drawFromStack(stack2);
  }

  return card;
}

function markAsked(card){
  askedCountById.set(card.id, (askedCountById.get(card.id) || 0) + 1);
  pushLastAsked(card.id);
}

function markWrong(card){
  wrongCountById.set(card.id, (wrongCountById.get(card.id) || 0) + 1);
}

function updateQuestion(){
  resetCardUI();

  const next = getNextCard();
  if(!next){
    endGame(true);
    return;
  }

  currentCard = next;
  currentDirection = pickDirectionForThisCard();

  setCardTexts(currentCard, currentDirection);
  markAsked(currentCard);

  updateHUD();
  startTimer(timeLimitSeconds);
}

// --- Load vocab ---
function parseVocab(text){
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const parsed = [];
  let idCounter = 1;

  for(const line of lines){
    // split by TAB first; if no tab, try multiple spaces
    let parts = line.split("\t");
    if(parts.length < 2){
      parts = line.split(/\s{2,}/); // fallback
    }
    if(parts.length < 2) continue;

    const en = (parts[0] || "").trim();
    const de = (parts.slice(1).join(" ") || "").trim();

    if(!en || !de) continue;

    parsed.push({
      id: String(idCounter++),
      en,
      de,
      box: 1
    });
  }
  return parsed;
}

async function loadVocab(){
  try{
    setLoadInfo("Lade Vokabeln…");
    const res = await fetch(FILE_PATH, { cache: "no-store" });
    if(!res.ok){
      throw new Error(`HTTP ${res.status}`);
    }
    const text = await res.text();
    const parsed = parseVocab(text);

    if(parsed.length === 0){
      setLoadInfo("Keine Vokabeln gefunden. Prüfe: Englisch<TAB>Deutsch pro Zeile.", false);
      return false;
    }

    cards = parsed;
    initStacksFromCards();

    setLoadInfo(`✅ ${cards.length} Vokabeln geladen.`);
    updateHUD();
    return true;
  } catch(err){
    setLoadInfo(
      "❌ Konnte vocab.txt nicht laden. Tipp: Projekt über NetBeans/Server starten oder GitHub Pages verwenden.",
      false
    );
    console.error(err);
    return false;
  }
}

function initStacksFromCards(){
  stack1 = [];
  stack2 = [];
  stack3 = [];

  for(const c of cards){
    c.box = 1;
    stack1.push(c);
  }

  // optional: shuffle for variety
  shuffle(stack1);

  // reset stats
  wrongCountById.clear();
  askedCountById.clear();
  lastAskedBuffer.length = 0;

  currentCard = null;
  currentDirection = "DE_EN";
  round = 0;
  correct = 0;
  wrong = 0;

  stopTimer();
  timerText.textContent = "—";
  resetCardUI();
  updateHUD();
}

// --- Game flow ---
function startGame(){
  playerName = playerNameInput.value.trim() || "Spieler";
  mode = modeSelect.value;
  difficulty = difficultySelect.value;
  timeLimitSeconds = difficultyToSeconds(difficulty);

  // if no cards loaded yet, try load
  if(cards.length === 0){
    setLoadInfo("Bitte zuerst Vokabeln laden.", false);
    return;
  }

  hide(screenStart);
  hide(screenEnd);
  show(screenGame);

  updateHUD();
  updateQuestion();
}

function endGame(allDone){
  stopTimer();

  hide(screenGame);
  show(screenEnd);

  const total = round;
  const rate = total > 0 ? Math.round((correct / total) * 100) : 0;

  if(allDone){
    endTitle.textContent = "Fertig!";
    endText.textContent = "Stapel 1 und Stapel 2 sind leer. Alle Wörter sind gelernt (Stapel 3).";
  } else {
    endTitle.textContent = "Spiel beendet";
    endText.textContent = "Du hast das Spiel beendet. Du kannst neu starten und nochmal üben.";
  }

  statRounds.textContent = String(total);
  statCorrect.textContent = String(correct);
  statWrong.textContent = String(wrong);
  statRate.textContent = `${rate}%`;

  renderHardestWords();
}

function renderHardestWords(){
  hardestList.innerHTML = "";

  // Build list of {card, wrongCount, askedCount}
  const rows = cards.map(c => ({
    card: c,
    wrong: wrongCountById.get(c.id) || 0,
    asked: askedCountById.get(c.id) || 0
  }));

  // Only those asked at least once
  const askedRows = rows.filter(r => r.asked > 0);

  // Sort by wrong desc, then asked desc
  askedRows.sort((a,b) => {
    if(b.wrong !== a.wrong) return b.wrong - a.wrong;
    return b.asked - a.asked;
  });

  const top = askedRows.slice(0, 8);
  if(top.length === 0){
    const li = document.createElement("li");
    li.textContent = "Noch keine Daten (du hast keine Karte beantwortet).";
    hardestList.appendChild(li);
    return;
  }

  for(const r of top){
    const li = document.createElement("li");
    const { en, de } = r.card;
    li.textContent = `${en} — ${de} (falsch: ${r.wrong}, gefragt: ${r.asked})`;
    hardestList.appendChild(li);
  }
}

// --- Answer handling (Improvement 1 + 3) ---
function handleAnswer(type){
  // type: "CORRECT" | "WRONG" | "ALMOST"
  if(!currentCard) return;

  stopTimer();

  // round increments on each answered card
  round += 1;

  if(type === "CORRECT"){
    correct += 1;

    if(currentCard.box === 1) moveCardToBox(currentCard, 2);
    else if(currentCard.box === 2) moveCardToBox(currentCard, 3);
    // if already 3: stays 3
  } else if(type === "WRONG"){
    wrong += 1;
    markWrong(currentCard);
    moveCardToBox(currentCard, 1);
  } else { // ALMOST
    // Improvement 3:
    // "Knapp" zählt nicht als richtig/falsch. Bleibt im aktuellen Stapel.
    // Alternative: wie falsch behandeln -> dann: wrong++; markWrong(); moveCardToBox(card,1);
    markWrong(currentCard); // zählt als "schwierig"
  }

  updateHUD();
  updateQuestion();
}

// --- Events ---
btnStart.addEventListener("click", startGame);
btnReload.addEventListener("click", async () => {
  await loadVocab();
});

btnFlip.addEventListener("click", () => {
  stopTimer();
  flipNow();
});

flipCard.addEventListener("click", () => {
  // click on card to flip (nice usability)
  if(!isFlipped){
    stopTimer();
    flipNow();
  }
});
flipCard.addEventListener("keydown", (e) => {
  if(e.key === "Enter" || e.key === " "){
    e.preventDefault();
    if(!isFlipped){
      stopTimer();
      flipNow();
    }
  }
});

btnCorrect.addEventListener("click", () => handleAnswer("CORRECT"));
btnWrong.addEventListener("click", () => handleAnswer("WRONG"));
btnAlmost.addEventListener("click", () => handleAnswer("ALMOST"));

btnEnd.addEventListener("click", () => endGame(false));
btnRestart.addEventListener("click", () => {
  // back to start
  hide(screenEnd);
  hide(screenGame);
  show(screenStart);
  initStacksFromCards();
});

// auto-load on startup
(async function boot(){
  await loadVocab();
})();