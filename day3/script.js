// ---------- Starting data ----------
let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

const validCategories = ["personal", "work", "study"];

// Lower-cases, trims and collapses repeated spaces so that
// "  Call   MUM " and "call mum" count as the same text.
function normalise(text) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

// ---------- 1. searchNotes ----------
// Returns every note whose text contains the word, ignoring case.
function searchNotes(word) {
  const search = word.toLowerCase();
  return notes.filter((note) => note.text.toLowerCase().includes(search));
}

// ---------- 2. longestNote ----------
// Returns the note object with the most characters, or null if none.
function longestNote() {
  if (notes.length === 0) {
    return null;
  }
  let longest = notes[0];
  for (const note of notes) {
    if (note.text.length > longest.text.length) {
      longest = note;
    }
  }
  return longest;
}

// ---------- 3. countByCategory ----------
// Returns an object such as { personal: 2, study: 2, work: 1 }.
function countByCategory() {
  const counts = {};
  for (const note of notes) {
    if (counts[note.category] === undefined) {
      counts[note.category] = 1;
    } else {
      counts[note.category]++;
    }
  }
  return counts;
}

// ---------- 4. getSummary ----------
// Returns a sentence such as "5 notes: 2 personal, 1 work, 2 study."
function getSummary() {
  const counts = countByCategory();
  const total = notes.length;
  const noun = total === 1 ? "note" : "notes";

  if (total === 0) {
    return `0 ${noun}.`;
  }

  const parts = [];
  for (const category of validCategories) {
    if (counts[category] > 0) {
      parts.push(`${counts[category]} ${category}`);
    }
  }
  return `${total} ${noun}: ${parts.join(", ")}.`;
}

// ---------- 5. isDuplicate ----------
// True if a note with the same text exists (ignoring case and extra spaces).
function isDuplicate(text) {
  const wanted = normalise(text);
  return notes.some((note) => normalise(note.text) === wanted);
}

// ---------- 6. addNote ----------
// Adds a note if valid. Returns true when added, false otherwise.
function addNote(text, category) {
  const cleaned = typeof text === "string" ? text.trim() : "";

  if (cleaned.length < 1 || cleaned.length > 200) {
    console.log("Not added: text must be 1-200 characters.");
    return false;
  }
  if (!validCategories.includes(category)) {
    console.log(`Not added: "${category}" is not a valid category.`);
    return false;
  }
  if (isDuplicate(cleaned)) {
    console.log(`Not added: "${cleaned}" already exists.`);
    return false;
  }

  const nextId = notes.length > 0 ? Math.max(...notes.map((n) => n.id)) + 1 : 1;
  notes.push({ id: nextId, text: cleaned, category: category });
  console.log(`Added note ${nextId}: "${cleaned}" (${category}).`);
  return true;
}

// ---------- Tests ----------
// Each call shows the expected output in a comment beside it.

console.log("--- searchNotes ---");
console.log(searchNotes("the"));
// Expected: 2 notes - id 2 "Finish the Day 3 assignment" and id 3 "Email the project report to Grace"
console.log(searchNotes("MILK"));
// Expected: 1 note - id 1 "Buy milk and bread" (search ignores case)
console.log(searchNotes("zebra"));
// Expected: [] (edge case: no results)

console.log("--- longestNote ---");
console.log(longestNote());
// Expected: { id: 3, text: 'Email the project report to Grace', category: 'work' }
const savedNotes = notes; // keep the real array safe
notes = [];
console.log(longestNote());
// Expected: null (edge case: empty array)
notes = savedNotes;

console.log("--- countByCategory ---");
console.log(countByCategory());
// Expected: { personal: 2, study: 2, work: 1 }
notes = [];
console.log(countByCategory());
// Expected: {} (edge case: empty array)
notes = savedNotes;

console.log("--- getSummary ---");
console.log(getSummary());
// Expected: 5 notes: 2 personal, 1 work, 2 study.
notes = [{ id: 1, text: "Only note", category: "work" }];
console.log(getSummary());
// Expected: 1 note: 1 work.  (edge case: singular "note")
notes = [];
console.log(getSummary());
// Expected: 0 notes.  (edge case: empty array)
notes = savedNotes;

console.log("--- isDuplicate ---");
console.log(isDuplicate("call mum"));
// Expected: true (same text, different case)
console.log(isDuplicate("   BUY   milk  and bread  "));
// Expected: true (edge case: extra spaces and capitals)
console.log(isDuplicate("Walk the dog"));
// Expected: false

console.log("--- addNote ---");
console.log(addNote("Walk the dog", "personal"));
// Expected: logs 'Added note 6: "Walk the dog" (personal).' then true
console.log(addNote("walk  the DOG", "personal"));
// Expected: logs 'Not added: "walk  the DOG" already exists.' then false
console.log(addNote("", "work"));
// Expected: logs "Not added: text must be 1-200 characters." then false
console.log(addNote("x".repeat(201), "work"));
// Expected: logs "Not added: text must be 1-200 characters." then false (201 characters)
console.log(addNote("Plan the team meeting", "hobby"));
// Expected: logs 'Not added: "hobby" is not a valid category.' then false
console.log(addNote("Plan the team meeting", "work"));
// Expected: logs 'Added note 7: "Plan the team meeting" (work).' then true

console.log("--- summary after adding ---");
console.log(getSummary());
// Expected: 7 notes: 3 personal, 2 work, 2 study.
