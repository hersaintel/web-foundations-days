// ---------- Select elements ----------
const noteText = document.getElementById("note-text");
const charCount = document.getElementById("char-count");
const wordCount = document.getElementById("word-count");
const clearBtn = document.getElementById("clear-btn");
const themeToggle = document.getElementById("theme-toggle");

const MAX_CHARS = 200;
const WARNING_AT = 180;
const DRAFT_KEY = "noteDraft";
const THEME_KEY = "noteTheme";

// ---------- Counters ----------
function updateCounts() {
  const text = noteText.value;
  const chars = text.length;
  const trimmed = text.trim();
  const words = trimmed === "" ? 0 : trimmed.split(/\s+/).length;

  charCount.textContent = `${chars} / ${MAX_CHARS} characters`;
  wordCount.textContent = `${words} ${words === 1 ? "word" : "words"}`;

  // Over 180 gets orange; over 200 also gets red + bold (.over is styled last)
  charCount.classList.toggle("warning", chars > WARNING_AT);
  charCount.classList.toggle("over", chars > MAX_CHARS);
}

// ---------- Draft saving ----------
function saveDraft() {
  if (noteText.value === "") {
    localStorage.removeItem(DRAFT_KEY);
  } else {
    localStorage.setItem(DRAFT_KEY, noteText.value);
  }
}

function clearAll() {
  noteText.value = "";
  localStorage.removeItem(DRAFT_KEY);
  updateCounts();
  noteText.focus();
}

// ---------- Theme ----------
function updateThemeLabel() {
  // The label names the mode you will switch TO
  themeToggle.textContent = document.body.classList.contains("dark")
    ? "Light mode"
    : "Dark mode";
}

// ---------- Events ----------
noteText.addEventListener("input", () => {
  updateCounts();
  saveDraft();
});

noteText.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearAll();
  }
});

clearBtn.addEventListener("click", clearAll);

themeToggle.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark");
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
  updateThemeLabel();
});

// ---------- On page load: restore draft and theme ----------
const savedDraft = localStorage.getItem(DRAFT_KEY);
if (savedDraft !== null) {
  noteText.value = savedDraft;
}

if (localStorage.getItem(THEME_KEY) === "dark") {
  document.body.classList.add("dark");
}

updateThemeLabel();
updateCounts();
