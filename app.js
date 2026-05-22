const STORAGE_KEY = "xg-flashcard-progress-v1";
const SESSION_KEY = "xg-flashcard-session-v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const elements = {
  deckTitle: document.querySelector("#deckTitle"),
  subjectiveMode: document.querySelector("#subjectiveMode"),
  objectiveMode: document.querySelector("#objectiveMode"),
  subjectiveCount: document.querySelector("#subjectiveCount"),
  objectiveCount: document.querySelector("#objectiveCount"),
  progressBar: document.querySelector("#progressBar"),
  studiedCount: document.querySelector("#studiedCount"),
  masteryPercent: document.querySelector("#masteryPercent"),
  todayCount: document.querySelector("#todayCount"),
  flashcard: document.querySelector("#flashcard"),
  cardChapter: document.querySelector("#cardChapter"),
  cardScore: document.querySelector("#cardScore"),
  answerChapter: document.querySelector("#answerChapter"),
  answerScore: document.querySelector("#answerScore"),
  questionText: document.querySelector("#questionText"),
  answerText: document.querySelector("#answerText"),
  ratingPanel: document.querySelector("#ratingPanel"),
  ratingButtons: document.querySelector("#ratingButtons"),
  cutButton: document.querySelector("#cutButton"),
  undoCutButton: document.querySelector("#undoCutButton"),
  nextButton: document.querySelector("#nextButton"),
  resetButton: document.querySelector("#resetButton"),
  installButton: document.querySelector("#installButton"),
};

const deck = Array.isArray(window.FLASHCARD_DATA?.cards) ? window.FLASHCARD_DATA.cards : [];
let progress = loadProgress();
let session = loadSession();
let activeMode = localStorage.getItem("xg-flashcard-mode-v1") || "subjective";
let currentCard = null;
let isAnswerVisible = false;
let touchStartX = 0;
let touchStartY = 0;
let deferredInstallPrompt = null;

init();

function init() {
  renderModeButtons();
  bindEvents();
  registerServiceWorker();
  setCurrentCard(pickNextCard());
  renderStats();
}

function bindEvents() {
  elements.flashcard.addEventListener("click", showAnswer);
  elements.flashcard.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      showAnswer();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      nextCard();
    }
  });

  elements.flashcard.addEventListener(
    "touchstart",
    (event) => {
      const touch = event.changedTouches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    },
    { passive: true },
  );

  elements.flashcard.addEventListener(
    "touchend",
    (event) => {
      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        nextCard();
      }
    },
    { passive: true },
  );

  elements.ratingButtons.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-score]");
    if (!button || !currentCard) return;
    rateCurrent(Number(button.dataset.score));
  });

  elements.subjectiveMode.addEventListener("click", () => switchMode("subjective"));
  elements.objectiveMode.addEventListener("click", () => switchMode("objective"));
  elements.cutButton.addEventListener("click", cutCurrentCard);
  elements.undoCutButton.addEventListener("click", undoLastCut);

  elements.nextButton.addEventListener("click", nextCard);
  elements.resetButton.addEventListener("click", resetProgress);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    elements.installButton.hidden = false;
  });

  elements.installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    elements.installButton.hidden = true;
  });
}

function loadProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function loadSession() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "{}");
    if (parsed && Array.isArray(parsed.recentIds)) {
      return parsed;
    }
  } catch {
    // Fall through to a new session.
  }
  return { recentIds: [] };
}

function saveSession() {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function getRecord(cardId) {
  return progress[cardId] || { score: 0, seen: 0, lastReviewed: 0, cut: false };
}

function recordAppearance(cardId) {
  if (!cardId) return;
  const record = getRecord(cardId);
  progress[cardId] = {
    ...record,
    seen: (record.seen || 0) + 1,
  };
  saveProgress();
}

function formatScore(record) {
  if (record.cut) return "已会";
  if (!record.score) return "未学习";
  return `${record.score} 分 · ${record.seen || 0} 次`;
}

function currentDeck(includeCut = false) {
  return deck.filter((card) => {
    if (card.mode !== activeMode) return false;
    if (!includeCut && getRecord(card.id).cut) return false;
    return true;
  });
}

function renderCard(answerVisible) {
  if (!currentCard) {
    isAnswerVisible = false;
    elements.cardChapter.textContent = activeMode === "objective" ? "客观题" : "主观题";
    elements.cardScore.textContent = "";
    elements.answerChapter.textContent = elements.cardChapter.textContent;
    elements.answerScore.textContent = "";
    elements.questionText.textContent = activeMode === "objective" ? "客观题已全部标会" : "没有可用闪卡";
    elements.answerText.textContent = activeMode === "objective" ? "可点击撤销上一次标会，或重置进度。" : "";
    elements.flashcard.classList.remove("is-flipped");
    elements.ratingPanel.hidden = activeMode !== "objective";
    elements.cutButton.hidden = true;
    elements.undoCutButton.hidden = activeMode !== "objective" || !session.lastCutId;
    return;
  }

  const record = getRecord(currentCard.id);
  isAnswerVisible = answerVisible;
  const meta = `${currentCard.number || ""} · ${currentCard.chapter} · ${currentCard.kind}`;
  elements.cardChapter.textContent = meta;
  elements.cardScore.textContent = formatScore(record);
  elements.answerChapter.textContent = meta;
  elements.answerScore.textContent = formatScore(record);
  elements.questionText.textContent = currentCard.question;
  elements.answerText.textContent = currentCard.answer;
  elements.flashcard.classList.toggle("is-flipped", answerVisible);
  elements.ratingPanel.hidden = !answerVisible;
  elements.cutButton.hidden = activeMode !== "objective";
  elements.undoCutButton.hidden = activeMode !== "objective" || !session.lastCutId;
  markSelectedScore(record.score || 0);
}

function markSelectedScore(score) {
  for (const button of elements.ratingButtons.querySelectorAll("button")) {
    button.classList.toggle("selected", Number(button.dataset.score) === score);
  }
}

function showAnswer() {
  if (!currentCard || isAnswerVisible) return;
  renderCard(true);
}

function rateCurrent(score) {
  const now = Date.now();
  const record = getRecord(currentCard.id);
  progress[currentCard.id] = {
    ...record,
    score,
    lastReviewed: now,
  };
  saveProgress();
  rememberRecent(currentCard.id);
  renderStats();
  nextCard();
}

function nextCard() {
  setCurrentCard(pickNextCard(currentCard?.id));
}

function setCurrentCard(card) {
  currentCard = card;
  if (card) recordAppearance(card.id);
  elements.flashcard.classList.remove("is-entering");
  void elements.flashcard.offsetWidth;
  elements.flashcard.classList.add("is-entering");
  renderCard(false);
}

function rememberRecent(cardId) {
  session.recentIds = [cardId, ...(session.recentIds || []).filter((id) => id !== cardId)].slice(0, 16);
  saveSession();
}

function pickNextCard(previousId) {
  const availableDeck = currentDeck();
  if (!availableDeck.length) return null;
  const priority = findPriorityCard(previousId);
  if (priority) return priority;

  const candidates = availableDeck.filter((card) => card.id !== previousId);
  const pool = candidates.length ? candidates : availableDeck;
  const weighted = pool.map((card) => ({ card, weight: cardWeight(card) }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let target = Math.random() * total;
  for (const item of weighted) {
    target -= item.weight;
    if (target <= 0) return item.card;
  }
  return weighted[weighted.length - 1].card;
}

function findPriorityCard(previousId) {
  const now = Date.now();
  let best = null;
  let bestDays = 0;
  for (const card of currentDeck()) {
    if (card.id === previousId) continue;
    const record = getRecord(card.id);
    if (!record.lastReviewed) continue;
    const days = (now - (record.lastReviewed || 0)) / DAY_MS;
    if (days > bestDays) {
      best = card;
      bestDays = days;
    }
  }
  return bestDays >= 7 ? best : null;
}

function cardWeight(card) {
  const now = Date.now();
  const record = getRecord(card.id);
  const score = Number(record.score || 0);
  const seen = Number(record.seen || 0);
  const ageMs = record.lastReviewed ? now - record.lastReviewed : Number.POSITIVE_INFINITY;
  const ageHours = Number.isFinite(ageMs) ? ageMs / HOUR_MS : 999;
  const ageDays = Number.isFinite(ageMs) ? ageMs / DAY_MS : 999;

  const masteryWeight = score === 0 ? 7.5 : Math.max(0.85, 6.5 - score * 1.08);
  const recentBoost = record.lastReviewed ? 1 + 2.2 / (1 + ageHours / 4) : 3.2;
  const seenPenalty = 1 / Math.sqrt(seen + 1);
  const overdueBoost = ageDays >= 7 ? Math.min(3.4, 1 + ageDays / 7) : 1;

  return Math.max(0.05, masteryWeight * recentBoost * seenPenalty * overdueBoost);
}

function renderStats() {
  const activeDeck = currentDeck(true);
  const total = activeDeck.length || 1;
  const visibleDeck = currentDeck();
  const records = activeDeck.map((card) => getRecord(card.id));
  const studied = records.filter((record) => record.score > 0).length;
  const scoreSum = records.reduce((sum, record) => sum + Number(record.score || 0), 0);
  const mastery = Math.round((scoreSum / (total * 5)) * 100);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const today = records.filter((record) => (record.lastReviewed || 0) >= todayStart.getTime()).length;

  elements.studiedCount.textContent = `${studied}/${activeDeck.length}`;
  elements.masteryPercent.textContent = `${mastery}%`;
  elements.todayCount.textContent = String(today);
  elements.progressBar.style.width = `${Math.round((studied / total) * 100)}%`;
  elements.deckTitle.textContent = `${activeMode === "subjective" ? "主观题" : "客观题"} · ${visibleDeck.length}/${activeDeck.length} 张`;
}

function renderModeButtons() {
  const subjectiveTotal = deck.filter((card) => card.mode === "subjective").length;
  const objectiveTotal = deck.filter((card) => card.mode === "objective").length;
  elements.subjectiveCount.textContent = `${subjectiveTotal} 张`;
  elements.objectiveCount.textContent = `${objectiveTotal} 张`;
  elements.subjectiveMode.classList.toggle("selected", activeMode === "subjective");
  elements.objectiveMode.classList.toggle("selected", activeMode === "objective");
}

function switchMode(mode) {
  if (activeMode === mode) return;
  activeMode = mode;
  localStorage.setItem("xg-flashcard-mode-v1", activeMode);
  renderModeButtons();
  setCurrentCard(pickNextCard());
  renderStats();
}

function cutCurrentCard(event) {
  event?.stopPropagation();
  if (!currentCard || activeMode !== "objective") return;
  const record = getRecord(currentCard.id);
  progress[currentCard.id] = {
    ...record,
    cut: true,
    lastReviewed: Date.now(),
  };
  session.lastCutId = currentCard.id;
  saveProgress();
  saveSession();
  nextCard();
  renderStats();
}

function undoLastCut(event) {
  event?.stopPropagation();
  if (!session.lastCutId) return;
  const record = getRecord(session.lastCutId);
  progress[session.lastCutId] = {
    ...record,
    cut: false,
  };
  session.lastCutId = null;
  saveProgress();
  saveSession();
  renderStats();
  if (!currentCard) setCurrentCard(pickNextCard());
  renderCard(isAnswerVisible);
}

function resetProgress() {
  const ok = window.confirm("确认清空本机学习记录？题库不会删除。");
  if (!ok) return;
  progress = {};
  session = { recentIds: [], lastCutId: null };
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  setCurrentCard(pickNextCard());
  renderStats();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Local file previews cannot register service workers; served previews can.
    });
  });
}
