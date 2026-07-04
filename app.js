/* ============================================================
   Ta-Da! — ADHD-friendly evidence diary
   All data lives in IndexedDB + localStorage on this device.
   ============================================================ */
"use strict";

/* ---------------- tiny helpers ---------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const LOCALE = "en-GB";
const fmtTime = (ts) =>
  new Date(ts).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
const fmtLongDate = (ts) =>
  new Date(ts).toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" });
const fmtFullDate = (ts) =>
  new Date(ts).toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmtClock = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const fmtDur = (ms) => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};

/* ---------------- IndexedDB ---------------- */
const DB_NAME = "tada-db";
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("entries")) {
        db.createObjectStore("entries", { keyPath: "id" }).createIndex("ts", "ts");
      }
      if (!db.objectStoreNames.contains("audio")) {
        db.createObjectStore("audio", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("photos")) {
        db.createObjectStore("photos", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idb(store, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const result = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(result.__value !== undefined ? result.__value : result.result);
    tx.onerror = () => reject(tx.error);
  });
}

const putEntry = (e) => idb("entries", "readwrite", (s) => s.put(e));
const deleteEntry = (id) => idb("entries", "readwrite", (s) => s.delete(id));
const putAudio = (a) => idb("audio", "readwrite", (s) => s.put(a));
const getAudio = (id) => idb("audio", "readonly", (s) => s.get(id));
const deleteAudio = (id) => idb("audio", "readwrite", (s) => s.delete(id));
const putPhoto = (p) => idb("photos", "readwrite", (s) => s.put(p));
const getPhoto = (id) => idb("photos", "readonly", (s) => s.get(id));
const deletePhoto = (id) => idb("photos", "readwrite", (s) => s.delete(id));
const getAllEntries = () => idb("entries", "readonly", (s) => s.getAll());

/* ---------------- settings (localStorage) ---------------- */
const KNOWN_SECTIONS = ["Tidying up", "Laundry", "Kitchen", "Kids", "Pets", "Errands"];
const DEFAULT_TILES = [
  { id: "t1", emoji: "🧺", label: "Picked up her clothes", section: "Tidying up" },
  { id: "t2", emoji: "👕", label: "Put the washing away", section: "Laundry" },
  { id: "t3", emoji: "🍽️", label: "Emptied the dishwasher", section: "Kitchen" },
  { id: "t4", emoji: "🗑️", label: "Took the bins out", section: "Errands" },
  { id: "t5", emoji: "🐕", label: "Walked the dog", section: "Pets" },
  { id: "t6", emoji: "💊", label: "Took my meds", section: "Other" },
  { id: "t7", emoji: "☕", label: "Made a cup of tea", section: "Kitchen" },
  { id: "t8", emoji: "💩", label: "Cleaned the litter tray", section: "Pets" },
  { id: "t9", emoji: "🫧", label: "Clothes in the washing machine", section: "Laundry" },
  { id: "t10", emoji: "🌀", label: "Clothes in the dryer", section: "Laundry" },
  { id: "t11", emoji: "🧋", label: "Made a cold iced coffee", section: "Kitchen" },
  { id: "t12", emoji: "📮", label: "Went to the post office", section: "Errands" },
  { id: "t13", emoji: "🎒", label: "Took the kids to school", section: "Kids" },
  { id: "t14", emoji: "🏫", label: "Picked the kids up from school", section: "Kids" },
  { id: "t15", emoji: "🍝", label: "Cooked dinner", section: "Kitchen" },
  { id: "t16", emoji: "🥪", label: "Made lunch", section: "Kitchen" },
  { id: "t17", emoji: "⚽", label: "Took Corey to football", section: "Kids" },
  { id: "t18", emoji: "📦", label: "Picked up Sam's parcel", section: "Errands" },
  { id: "t19", emoji: "🚭", label: "Cleaned up her cigarettes", section: "Tidying up" },
  { id: "t20", emoji: "🚬", label: "Picked cigarette packets off the floor", section: "Tidying up" },
  { id: "t21", emoji: "🛋️", label: "Got the cushions out", section: "Tidying up" },
  { id: "t22", emoji: "🛋️", label: "Put the cushions away", section: "Tidying up" },
  { id: "t23", emoji: "🛏️", label: "Took the covers off the hideaway", section: "Tidying up" },
  { id: "t24", emoji: "🛏️", label: "Put the covers back on the hideaway", section: "Tidying up" },
];
const SPEAKER_COLOURS = ["#6fa8ff", "#ff9ec1", "#8ae68a", "#c9a2ff", "#ffd166", "#7fd8f5"];
const DEFAULT_SPEAKERS = [
  { id: "s1", name: "Me" },
  { id: "s2", name: "Wife" },
];

function loadJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return Array.isArray(v) && v.length ? v : fallback;
  } catch {
    return fallback;
  }
}
let tiles = loadJSON("tada-tiles", DEFAULT_TILES);
let speakers = loadJSON("tada-speakers", DEFAULT_SPEAKERS);

// One-time migrations: add newer starter buttons to installs that
// customised their tiles before those defaults existed.
for (const [flag, start] of [["tada-tiles-v2", 6], ["tada-tiles-v3", 10], ["tada-tiles-v4", 18]]) {
  if (localStorage.getItem(flag)) continue;
  const have = new Set(tiles.map((t) => t.label.toLowerCase()));
  for (const t of DEFAULT_TILES.slice(start)) {
    if (!have.has(t.label.toLowerCase())) tiles.push({ ...t });
  }
  if (localStorage.getItem("tada-tiles")) localStorage.setItem("tada-tiles", JSON.stringify(tiles));
  localStorage.setItem(flag, "1");
}

// Backfill sections onto tiles saved before sections existed.
{
  const sectionByLabel = new Map(DEFAULT_TILES.map((t) => [t.label.toLowerCase(), t.section]));
  let changed = false;
  for (const t of tiles) {
    if (!t.section) {
      t.section = sectionByLabel.get(t.label.toLowerCase()) || "Other";
      changed = true;
    }
  }
  if (changed && localStorage.getItem("tada-tiles")) localStorage.setItem("tada-tiles", JSON.stringify(tiles));
}
const saveTiles = () => localStorage.setItem("tada-tiles", JSON.stringify(tiles));
const saveSpeakers = () => localStorage.setItem("tada-speakers", JSON.stringify(speakers));
const speakerColour = (id) => {
  const i = speakers.findIndex((s) => s.id === id);
  return SPEAKER_COLOURS[(i < 0 ? 0 : i) % SPEAKER_COLOURS.length];
};
const speakerName = (id) => speakers.find((s) => s.id === id)?.name || "Unknown";

/* ---------------- toast ---------------- */
const toastEl = $("#toast");
const toastMsg = $("#toast-msg");
const toastUndo = $("#toast-undo");
let toastTimer = null;
let undoFn = null;

function toast(msg, { undo } = {}) {
  toastMsg.textContent = msg;
  undoFn = undo || null;
  toastUndo.classList.toggle("hidden", !undo);
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), undo ? 5000 : 2600);
}
toastUndo.addEventListener("click", () => {
  if (undoFn) undoFn();
  undoFn = null;
  toastEl.classList.remove("show");
});

const TADA_LINES = [
  "Ta-da! Logged at {t} 🧾",
  "On the record: {t} ✅",
  "Evidence secured — {t} 🔒",
  "Done and dated: {t} ⭐",
  "That happened. {t}. It's official 📋",
  "Receipts updated — {t} 🧾",
];
const tadaLine = (ts) =>
  TADA_LINES[Math.floor(Math.random() * TADA_LINES.length)].replace("{t}", fmtTime(ts));

/* ---------------- sheet (bottom modal) ---------------- */
const sheetEl = $("#sheet");
const backdropEl = $("#sheet-backdrop");

function openSheet(html) {
  sheetEl.innerHTML = html;
  sheetEl.classList.remove("hidden");
  backdropEl.classList.remove("hidden");
}
function closeSheet() {
  sheetEl.classList.add("hidden");
  backdropEl.classList.add("hidden");
  sheetEl.innerHTML = "";
}
backdropEl.addEventListener("click", closeSheet);

function confirmSheet(title, note, confirmLabel, onConfirm, { danger = true } = {}) {
  openSheet(`
    <h3>${esc(title)}</h3>
    <p class="sheet-note">${esc(note)}</p>
    <div class="sheet-actions">
      <button class="btn ghost" data-act="cancel">Cancel</button>
      <button class="btn ${danger ? "danger-solid" : "primary"}" data-act="ok">${esc(confirmLabel)}</button>
    </div>`);
  $('[data-act="cancel"]', sheetEl).onclick = closeSheet;
  $('[data-act="ok"]', sheetEl).onclick = () => {
    closeSheet();
    onConfirm();
  };
}

/* ---------------- tabs ---------------- */
$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const name = tab.dataset.tab;
    $$(".tab").forEach((t) => t.classList.toggle("active", t === tab));
    $$(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `panel-${name}`));
    if (name === "diary") renderDiary();
    if (name === "log") renderTodayStrip();
    if (name === "settings") renderSettings();
    window.scrollTo(0, 0);
  });
});

/* ============================================================
   LOG TAB
   ============================================================ */
const tileGrid = $("#tile-grid");
let editingTiles = false;

$("#log-date").textContent = fmtLongDate(Date.now());

function sectionOrder() {
  const present = [...new Set(tiles.map((t) => t.section || "Other"))];
  const extras = present.filter((s) => !KNOWN_SECTIONS.includes(s) && s !== "Other");
  return [
    ...KNOWN_SECTIONS.filter((s) => present.includes(s)),
    ...extras,
    ...(present.includes("Other") ? ["Other"] : []),
  ];
}

const tileHTML = (t) => `
    <button class="tile" data-id="${t.id}">
      <span class="tile-emoji">${esc(t.emoji)}</span>
      <span class="tile-label">${esc(t.label)}</span>
      <span class="tile-del" data-del="${t.id}" role="button" aria-label="Delete">✕</span>
    </button>`;

function renderTiles() {
  tileGrid.classList.toggle("editing", editingTiles);
  tileGrid.innerHTML =
    sectionOrder()
      .map(
        (sec) => `
    <h2 class="section-label tile-sec-label">${esc(sec)}</h2>
    <div class="tile-grid">
      ${tiles.filter((t) => (t.section || "Other") === sec).map(tileHTML).join("")}
    </div>`
      )
      .join("") +
    `<div class="tile-grid add-grid">
      <button class="tile add-tile" id="add-tile">
        <span class="tile-emoji">＋</span>
        <span>Add a button</span>
      </button>
    </div>`;

  $("#add-tile").addEventListener("click", () => openTileSheet(null));

  $$(".tile[data-id]", tileGrid).forEach((el) => {
    el.addEventListener("click", (ev) => {
      const delBtn = ev.target.closest("[data-del]");
      const tile = tiles.find((t) => t.id === el.dataset.id);
      if (!tile) return;
      if (delBtn) {
        ev.stopPropagation();
        confirmSheet("Delete this button?", `“${tile.label}” — the button goes, your diary entries stay.`, "Delete", () => {
          tiles = tiles.filter((t) => t.id !== tile.id);
          saveTiles();
          renderTiles();
        });
        return;
      }
      if (editingTiles) {
        openTileSheet(tile);
      } else {
        logTask(tile, el);
      }
    });
  });
}

async function logTask(tile, el) {
  const entry = {
    id: uid(),
    type: "task",
    ts: Date.now(),
    title: tile.label,
    emoji: tile.emoji,
  };
  await putEntry(entry);
  el.classList.remove("flash");
  void el.offsetWidth; // restart animation
  el.classList.add("flash");
  toast(tadaLine(entry.ts), {
    undo: async () => {
      await deleteEntry(entry.id);
      renderTodayStrip();
      toast("Undone — never happened 😶");
    },
  });
  renderTodayStrip();
}

function openTileSheet(tile) {
  const isNew = !tile;
  const emojis = ["🧺", "👕", "🍽️", "🗑️", "🐕", "💊", "☕", "🧋", "💩", "🫧", "🌀", "🚬", "🚭", "🛋️", "🛏️", "🧦", "🧹", "🛒", "📞", "🚗", "🧒", "🎒", "🏫", "⚽", "🍝", "🥪", "🍳", "📮", "📦", "🪴", "🛠️", "💌", "🚿", "📬", "🐈", "⭐", "✅"];
  const current = tile?.emoji || "⭐";
  const currentSection = tile?.section || "Other";
  const sections = [...new Set([...KNOWN_SECTIONS, ...tiles.map((t) => t.section || "Other"), "Other"])];
  openSheet(`
    <h3>${isNew ? "New quick button" : "Edit button"}</h3>
    <div class="field">
      <label>What did you do?</label>
      <input id="tile-label-input" type="text" maxlength="60" placeholder="e.g. Hoovered the stairs" value="${esc(tile?.label || "")}">
    </div>
    <div class="field">
      <label>Section</label>
      <select id="tile-section-select">
        ${sections.map((s) => `<option value="${esc(s)}" ${s === currentSection ? "selected" : ""}>${esc(s)}</option>`).join("")}
        <option value="__new">＋ New section…</option>
      </select>
      <input id="tile-section-new" type="text" maxlength="24" placeholder="Name the new section" class="hidden" style="margin-top:8px">
    </div>
    <div class="field">
      <label>Icon</label>
      <div class="emoji-strip" id="emoji-strip">
        ${emojis.map((e) => `<button type="button" data-emoji="${e}" class="${e === current ? "sel" : ""}">${e}</button>`).join("")}
      </div>
    </div>
    <div class="sheet-actions">
      <button class="btn ghost" data-act="cancel">Cancel</button>
      <button class="btn primary" data-act="save">${isNew ? "Add button" : "Save"}</button>
    </div>`);
  let chosen = current;
  $$("#emoji-strip button", sheetEl).forEach((b) =>
    b.addEventListener("click", () => {
      chosen = b.dataset.emoji;
      $$("#emoji-strip button", sheetEl).forEach((x) => x.classList.toggle("sel", x === b));
    })
  );
  const sectionSelect = $("#tile-section-select", sheetEl);
  const sectionNew = $("#tile-section-new", sheetEl);
  sectionSelect.addEventListener("change", () => {
    sectionNew.classList.toggle("hidden", sectionSelect.value !== "__new");
    if (sectionSelect.value === "__new") sectionNew.focus();
  });
  $('[data-act="cancel"]', sheetEl).onclick = closeSheet;
  $('[data-act="save"]', sheetEl).onclick = () => {
    const label = $("#tile-label-input", sheetEl).value.trim();
    if (!label) return;
    let section = sectionSelect.value;
    if (section === "__new") section = sectionNew.value.trim() || "Other";
    if (isNew) {
      tiles.push({ id: uid(), emoji: chosen, label, section });
    } else {
      tile.label = label;
      tile.emoji = chosen;
      tile.section = section;
    }
    saveTiles();
    renderTiles();
    closeSheet();
  };
  setTimeout(() => $("#tile-label-input", sheetEl).focus(), 250);
}

$("#edit-tiles-btn").addEventListener("click", () => {
  editingTiles = !editingTiles;
  $("#edit-tiles-btn").classList.toggle("active", editingTiles);
  renderTiles();
});

async function renderTodayStrip() {
  const all = await getAllEntries();
  const today = dayKey(Date.now());
  const n = all.filter((e) => dayKey(e.ts) === today).length;
  $("#today-count").innerHTML = n
    ? `<strong>${n}</strong> thing${n === 1 ? "" : "s"} on the record today. Keep 'em coming.`
    : "Nothing logged yet today — let's fix that";
}

/* ---- voice/dictation-friendly logging ---- */
// "Can you log that I've just done the dishes." -> "Done the dishes"
function cleanSpoken(text) {
  let s = String(text || "").trim();
  const prefixes =
    /^(hey\s+)?(siri[,!.\s]+)?(can you |could you |please |ta[- ]?da[,!.\s]+)?(log|note|record|add)( that| this| it)?[,:\s]+/i;
  let prev;
  do {
    prev = s;
    s = s.replace(prefixes, "").replace(/^(i've just |i have just |i just |i've |i have )/i, "");
  } while (s !== prev && s);
  s = s.replace(/[.!?\s]+$/, "").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}

// Match spoken text to a quick button, tolerantly.
function matchTile(text) {
  const q = text.toLowerCase().trim();
  if (!q) return null;
  return (
    tiles.find((t) => t.label.toLowerCase() === q) ||
    tiles.find((t) => q.includes(t.label.toLowerCase()) || t.label.toLowerCase().includes(q)) ||
    null
  );
}

// Log any text: as its matching button if one fits, otherwise as a note.
async function logText(text) {
  const tile = matchTile(text);
  const entry = tile
    ? { id: uid(), type: "task", ts: Date.now(), title: tile.label, emoji: tile.emoji }
    : { id: uid(), type: "note", ts: Date.now(), title: text, emoji: "✏️" };
  await putEntry(entry);
  toast(tadaLine(entry.ts), {
    undo: async () => {
      await deleteEntry(entry.id);
      renderTodayStrip();
      toast("Undone");
    },
  });
  renderTodayStrip();
  return entry;
}

/* quick free-text note */
const noteInput = $("#note-input");
async function logNote() {
  const text = noteInput.value.trim();
  if (!text) return;
  const entry = { id: uid(), type: "note", ts: Date.now(), title: text, emoji: "✏️" };
  await putEntry(entry);
  noteInput.value = "";
  noteInput.blur();
  toast(tadaLine(entry.ts), {
    undo: async () => {
      await deleteEntry(entry.id);
      renderTodayStrip();
      toast("Undone");
    },
  });
  renderTodayStrip();
}
$("#note-log-btn").addEventListener("click", logNote);
noteInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") logNote();
});

/* ---- photo evidence ---- */
let photoTargetEntryId = null; // entry to attach to; null = new photo entry
const photoURLCache = new Map();

async function photoURL(id) {
  if (photoURLCache.has(id)) return photoURLCache.get(id);
  const rec = await getPhoto(id);
  if (!rec) return "";
  const url = URL.createObjectURL(rec.blob);
  photoURLCache.set(id, url);
  return url;
}

// Shrink big camera shots so the diary doesn't eat the phone's storage.
async function shrinkImage(file) {
  try {
    const bmp = await createImageBitmap(file);
    const max = 1600;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    return blob && blob.size ? blob : file;
  } catch {
    return file;
  }
}

$("#photo-btn").addEventListener("click", () => {
  photoTargetEntryId = null;
  $("#photo-input").click();
});

$("#photo-input").addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  ev.target.value = "";
  const target = photoTargetEntryId;
  photoTargetEntryId = null;
  if (!file) return;
  const blob = await shrinkImage(file);
  const photoId = uid();
  await putPhoto({ id: photoId, blob });
  if (target) {
    const all = await getAllEntries();
    const e = all.find((x) => x.id === target);
    if (!e) {
      await deletePhoto(photoId);
      return;
    }
    e.photoIds = [...(e.photoIds || []), photoId];
    await putEntry(e);
    renderDiary();
    toast("Photo attached 📷");
  } else {
    openPhotoCaptionSheet(photoId);
  }
});

async function openPhotoCaptionSheet(photoId) {
  const url = await photoURL(photoId);
  openSheet(`
    <h3>Photo evidence</h3>
    <img src="${url}" alt="Photo" style="width:100%;max-height:40vh;object-fit:contain;border-radius:14px;background:var(--surface-2)">
    <div class="field" style="margin-top:14px">
      <label>What's this evidence of?</label>
      <input id="photo-caption" type="text" maxlength="80" placeholder="e.g. Cushions, officially away">
    </div>
    <div class="sheet-actions">
      <button class="btn ghost" data-act="cancel">Discard</button>
      <button class="btn primary" data-act="save">Save to diary</button>
    </div>`);
  $('[data-act="cancel"]', sheetEl).onclick = async () => {
    await deletePhoto(photoId);
    closeSheet();
  };
  $('[data-act="save"]', sheetEl).onclick = async () => {
    const caption = $("#photo-caption", sheetEl).value.trim();
    const entry = {
      id: uid(),
      type: "note",
      ts: Date.now(),
      title: caption || "Photo evidence",
      emoji: "📷",
      photoIds: [photoId],
    };
    await putEntry(entry);
    closeSheet();
    toast(tadaLine(entry.ts));
    renderTodayStrip();
  };
  setTimeout(() => $("#photo-caption", sheetEl)?.focus(), 250);
}

/* ---- lightbox ---- */
const lightbox = $("#lightbox");
let lightboxCtx = null; // {entryId, photoId}

async function openLightbox(entryId, photoId) {
  $("#lightbox-img").src = await photoURL(photoId);
  lightboxCtx = { entryId, photoId };
  lightbox.classList.remove("hidden");
}
function closeLightbox() {
  lightbox.classList.add("hidden");
  lightboxCtx = null;
}
$("#lb-close").addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox();
});
$("#lb-delete").addEventListener("click", () => {
  const ctx = lightboxCtx;
  if (!ctx) return;
  closeLightbox();
  confirmSheet("Delete this photo?", "The diary entry stays — just the photo goes.", "Delete", async () => {
    const all = await getAllEntries();
    const e = all.find((x) => x.id === ctx.entryId);
    if (e) {
      e.photoIds = (e.photoIds || []).filter((p) => p !== ctx.photoId);
      await putEntry(e);
    }
    await deletePhoto(ctx.photoId);
    photoURLCache.delete(ctx.photoId);
    renderDiary();
    toast("Photo deleted");
  });
});

// Log whatever a Shortcut left on the clipboard (dictated text) with one tap.
$("#paste-log-btn").addEventListener("click", async () => {
  try {
    const raw = await navigator.clipboard.readText();
    const text = cleanSpoken(raw);
    if (!text) {
      toast("Nothing on the clipboard to log");
      return;
    }
    await logText(text);
  } catch {
    toast("Couldn't read the clipboard");
  }
});

/* ============================================================
   RECORD TAB — audio + live transcription + speaker tagging
   ============================================================ */
const rec = {
  stream: null,
  recorder: null,
  chunks: [],
  startTs: 0,
  timerInt: null,
  recognition: null,
  recogAlive: false,
  segments: [], // {speakerId, text, t}
  activeSpeaker: null,
  audioCtx: null,
  analyser: null,
  raf: 0,
  discard: false,
};

const recIdle = $("#rec-idle");
const recLive = $("#rec-live");
const recTimer = $("#rec-timer");
const liveTranscript = $("#live-transcript");
const ltPlaceholder = $("#lt-placeholder");
const recWarn = $("#rec-warn");
const waveCanvas = $("#waveform");

function renderSpeakerChips() {
  const row = $("#speaker-row");
  row.innerHTML = speakers
    .map((s) => {
      const active = s.id === rec.activeSpeaker;
      const c = speakerColour(s.id);
      return `<button class="speaker-chip ${active ? "active" : ""}" data-sp="${s.id}"
        style="${active ? `background:${c};border-color:${c};` : ""}">${esc(s.name)}</button>`;
    })
    .join("");
  $$(".speaker-chip", row).forEach((b) =>
    b.addEventListener("click", () => {
      rec.activeSpeaker = b.dataset.sp;
      renderSpeakerChips();
      renderLiveTranscript();
    })
  );
}

function showRecWarning(msg) {
  recWarn.textContent = msg;
  recWarn.classList.remove("hidden");
}

async function startRecording(auto = false) {
  if (rec.recorder && rec.recorder.state === "recording") return;
  rec.discard = false;
  rec.chunks = [];
  rec.segments = [];
  rec.interim = "";
  rec.activeSpeaker = speakers[0]?.id || null;
  recWarn.classList.add("hidden");

  // 1. Microphone
  try {
    rec.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    // Auto-start (from a ?record=1 shortcut) can be blocked because iOS wants
    // a real tap before opening the mic — the big red button is one tap away.
    toast(auto ? "Tap the red button to start recording 🎙️" : "Microphone blocked — allow mic access in Settings ▸ Safari 🎙️");
    return;
  }

  // 2. MediaRecorder (audio/mp4 on iOS, webm elsewhere)
  const mime =
    ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find(
      (m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)
    ) || "";
  try {
    rec.recorder = new MediaRecorder(rec.stream, mime ? { mimeType: mime } : undefined);
  } catch {
    rec.recorder = new MediaRecorder(rec.stream);
  }
  rec.recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) rec.chunks.push(e.data);
  };
  rec.recorder.onstop = onRecorderStopped;
  rec.recorder.start(1000);
  rec.startTs = Date.now();

  // 3. UI
  recIdle.classList.add("hidden");
  recLive.classList.remove("hidden");
  ltPlaceholder.classList.remove("hidden");
  renderSpeakerChips();
  renderLiveTranscript();
  recTimer.textContent = "0:00";
  rec.timerInt = setInterval(() => {
    recTimer.textContent = fmtClock(Date.now() - rec.startTs);
  }, 250);

  // 4. Waveform
  startWaveform();

  // 5. Live transcription (best effort — audio keeps recording regardless)
  startRecognition();

  // Keep the screen awake while recording if the browser lets us.
  try {
    rec.wakeLock = await navigator.wakeLock?.request("screen");
  } catch {}
}

function startWaveform() {
  try {
    rec.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = rec.audioCtx.createMediaStreamSource(rec.stream);
    rec.analyser = rec.audioCtx.createAnalyser();
    rec.analyser.fftSize = 256;
    src.connect(rec.analyser);
    const ctx = waveCanvas.getContext("2d");
    const data = new Uint8Array(rec.analyser.frequencyBinCount);
    const dpr = window.devicePixelRatio || 1;

    const draw = () => {
      rec.raf = requestAnimationFrame(draw);
      const w = waveCanvas.clientWidth * dpr;
      const h = waveCanvas.clientHeight * dpr;
      if (waveCanvas.width !== w) waveCanvas.width = w;
      if (waveCanvas.height !== h) waveCanvas.height = h;
      rec.analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, w, h);
      const bars = 48;
      const step = Math.floor(data.length / bars);
      const bw = w / bars;
      ctx.fillStyle = "#ff5c6c";
      for (let i = 0; i < bars; i++) {
        const v = data[i * step] / 255;
        const bh = Math.max(3 * dpr, v * h * 0.9);
        ctx.beginPath();
        ctx.roundRect(i * bw + bw * 0.22, (h - bh) / 2, bw * 0.56, bh, 3 * dpr);
        ctx.fill();
      }
    };
    draw();
  } catch {}
}

function startRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showRecWarning("Live transcription isn't supported in this browser — your audio is still being recorded and saved.");
    return;
  }
  const r = new SR();
  rec.recognition = r;
  rec.recogAlive = true;
  r.lang = navigator.language || "en-GB";
  r.continuous = true;
  r.interimResults = true;

  r.onresult = (ev) => {
    let interim = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const res = ev.results[i];
      const text = res[0].transcript.trim();
      if (!text) continue;
      if (res.isFinal) {
        rec.segments.push({
          speakerId: rec.activeSpeaker,
          text,
          t: Date.now() - rec.startTs,
        });
      } else {
        interim += res[0].transcript;
      }
    }
    rec.interim = interim.trim();
    renderLiveTranscript();
  };
  r.onerror = (ev) => {
    if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
      rec.recogAlive = false;
      showRecWarning("Transcription was blocked (speech recognition permission). Audio is still recording — you can add a written note after.");
    } else if (ev.error === "audio-capture") {
      rec.recogAlive = false;
      showRecWarning("This device can't transcribe while recording audio. The recording itself is safe and will be saved.");
    }
    // 'no-speech' and 'aborted' are normal — onend handles restarts
  };
  r.onend = () => {
    // iOS ends recognition frequently; keep it alive while recording
    if (rec.recorder && rec.recorder.state === "recording" && rec.recogAlive) {
      try {
        r.start();
      } catch {}
    }
  };
  try {
    r.start();
  } catch {
    showRecWarning("Live transcription couldn't start — audio is still being recorded.");
  }
}

function renderLiveTranscript() {
  const segs = rec.segments
    .map((s) => {
      const c = speakerColour(s.speakerId);
      return `<p class="lt-seg">
        <span class="seg-meta" style="color:${c}">${esc(speakerName(s.speakerId))} · ${fmtClock(s.t)}</span>
        ${esc(s.text)}
      </p>`;
    })
    .join("");
  const interim = rec.interim
    ? `<p class="lt-seg interim">
        <span class="seg-meta" style="color:${speakerColour(rec.activeSpeaker)}">${esc(speakerName(rec.activeSpeaker))}</span>
        ${esc(rec.interim)}
      </p>`
    : "";
  const html = segs + interim;
  if (html) {
    ltPlaceholder.classList.add("hidden");
    liveTranscript.innerHTML = html;
    liveTranscript.scrollTop = liveTranscript.scrollHeight;
  } else if (!ltPlaceholder.classList.contains("hidden")) {
    liveTranscript.innerHTML = "";
    liveTranscript.appendChild(ltPlaceholder);
  }
}

function stopRecordingMachinery() {
  clearInterval(rec.timerInt);
  cancelAnimationFrame(rec.raf);
  rec.recogAlive = false;
  try { rec.recognition?.stop(); } catch {}
  try { rec.audioCtx?.close(); } catch {}
  try { rec.wakeLock?.release(); } catch {}
  rec.wakeLock = null;
}

function stopRecording(discard) {
  rec.discard = discard;
  stopRecordingMachinery();
  if (rec.recorder && rec.recorder.state !== "inactive") {
    rec.recorder.stop(); // onRecorderStopped fires next
  } else {
    onRecorderStopped();
  }
}

async function onRecorderStopped() {
  rec.stream?.getTracks().forEach((t) => t.stop());
  const durationMs = Date.now() - rec.startTs;
  recLive.classList.add("hidden");
  recIdle.classList.remove("hidden");
  liveTranscript.innerHTML = "";
  liveTranscript.appendChild(ltPlaceholder);

  if (rec.discard) {
    toast("Recording discarded");
    return;
  }
  const blob = new Blob(rec.chunks, { type: rec.recorder?.mimeType || "audio/mp4" });
  if (!blob.size) {
    toast("Hmm — no audio was captured. Try again?");
    return;
  }
  openSaveSheet(blob, durationMs, rec.segments.slice(), Date.now() - durationMs);
}

function openSaveSheet(blob, durationMs, segments, startTs) {
  const defaultTitle = `Voice note — ${fmtTime(startTs)}`;
  const preview = segments.length
    ? segments
        .slice(0, 4)
        .map(
          (s) => `<p class="tr-line">
            <span class="tr-speaker" style="color:${speakerColour(s.speakerId)}">${esc(speakerName(s.speakerId))}</span>
            <span class="tr-time">${fmtClock(s.t)}</span><br>${esc(s.text)}
          </p>`
        )
        .join("") + (segments.length > 4 ? `<p class="sheet-note">…and ${segments.length - 4} more</p>` : "")
    : `<p class="sheet-note">No transcript was captured — the audio is saved either way. Add a note below so future-you knows what this was.</p>`;

  openSheet(`
    <h3>Save recording · ${fmtDur(durationMs)}</h3>
    <div class="field">
      <label>Title</label>
      <input id="save-title" type="text" maxlength="80" value="${esc(defaultTitle)}">
    </div>
    <div class="field">
      <label>Transcript</label>
      <div class="e-transcript" style="border:none;padding-top:0;margin-top:0">${preview}</div>
    </div>
    ${segments.length ? "" : `
    <div class="field">
      <label>What was said? (optional)</label>
      <textarea id="save-note" rows="2" placeholder="e.g. She said the bins are Thursday now"></textarea>
    </div>`}
    <div class="sheet-actions">
      <button class="btn ghost" data-act="cancel">Discard</button>
      <button class="btn primary" data-act="save">Save to diary</button>
    </div>`);

  $('[data-act="cancel"]', sheetEl).onclick = () => {
    closeSheet();
    toast("Recording discarded");
  };
  $('[data-act="save"]', sheetEl).onclick = async () => {
    const title = $("#save-title", sheetEl).value.trim() || defaultTitle;
    const note = $("#save-note", sheetEl)?.value.trim();
    const audioId = uid();
    await putAudio({ id: audioId, blob, mime: blob.type });
    const entry = {
      id: uid(),
      type: "voice",
      ts: startTs,
      title,
      emoji: "🎙️",
      audioId,
      durationMs,
      transcript: segments,
      detail: note || undefined,
    };
    await putEntry(entry);
    closeSheet();
    toast(`Saved — ${fmtTime(startTs)}, ${fmtDur(durationMs)} 🎙️`);
    renderTodayStrip();
  };
}

$("#rec-start-btn").addEventListener("click", () => startRecording());
$("#rec-stop-btn").addEventListener("click", () => stopRecording(false));
$("#rec-cancel-btn").addEventListener("click", () =>
  confirmSheet("Discard this recording?", "It won't be saved anywhere.", "Discard", () => stopRecording(true))
);

/* ============================================================
   DIARY TAB
   ============================================================ */
let diaryFilter = "all";
let diarySearch = "";
const expandedTranscripts = new Set();

$$("#filter-row .chip").forEach((chip) =>
  chip.addEventListener("click", () => {
    diaryFilter = chip.dataset.filter;
    $$("#filter-row .chip").forEach((c) => c.classList.toggle("active", c === chip));
    renderDiary();
  })
);
$("#search-input").addEventListener("input", (e) => {
  diarySearch = e.target.value.trim().toLowerCase();
  renderDiary();
});

function entryMatches(e) {
  if (diaryFilter !== "all" && e.type !== diaryFilter) return false;
  if (!diarySearch) return true;
  const hay = [e.title, e.detail, ...(e.transcript || []).map((s) => s.text)]
    .join(" ")
    .toLowerCase();
  return hay.includes(diarySearch);
}

async function renderDiary() {
  const all = (await getAllEntries()).sort((a, b) => b.ts - a.ts);
  $("#diary-count").textContent = all.length
    ? `${all.length} ${all.length === 1 ? "entry" : "entries"} on the record`
    : "Your evidence locker";

  const entries = all.filter(entryMatches);
  const timeline = $("#timeline");

  if (!entries.length) {
    timeline.innerHTML = `
      <div class="empty-state">
        <span class="big">${all.length ? "🔍" : "🗂️"}</span>
        ${all.length
          ? "Nothing matches that search."
          : "Nothing here yet.<br>Tap a button on the Log tab or record a voice note —<br>every entry lands here with its time and date."}
      </div>`;
    return;
  }

  // group by day
  const groups = new Map();
  for (const e of entries) {
    const k = dayKey(e.ts);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }

  const todayK = dayKey(Date.now());
  const yestK = dayKey(Date.now() - 864e5);

  timeline.innerHTML = [...groups.entries()]
    .map(([k, list]) => {
      const label = k === todayK ? "Today" : k === yestK ? "Yesterday" : fmtLongDate(list[0].ts);
      return `
      <div class="day-group">
        <div class="day-head">
          <h3>${label}</h3>
          <button class="day-share" data-day="${k}">Share day ↗</button>
        </div>
        ${list.map(renderEntry).join("")}
      </div>`;
    })
    .join("");

  // wire up
  $$(".day-share", timeline).forEach((b) =>
    b.addEventListener("click", () => shareDay(b.dataset.day, entries))
  );
  $$(".e-menu", timeline).forEach((b) =>
    b.addEventListener("click", () => openEntryMenu(b.dataset.id))
  );
  $$(".tr-more", timeline).forEach((b) =>
    b.addEventListener("click", () => {
      expandedTranscripts.add(b.dataset.id);
      renderDiary();
    })
  );
  $$(".ap-play", timeline).forEach((b) =>
    b.addEventListener("click", () => togglePlay(b.dataset.audio, b))
  );
  $$("img[data-photo]", timeline).forEach((img) => {
    photoURL(img.dataset.photo).then((url) => (img.src = url));
    img.addEventListener("click", () => openLightbox(img.dataset.entry, img.dataset.photo));
  });
}

function renderEntry(e) {
  const icon = e.emoji || (e.type === "voice" ? "🎙️" : e.type === "note" ? "✏️" : "✅");
  let extra = "";

  if (e.detail) {
    extra += `<div class="e-transcript"><p class="tr-line">${esc(e.detail)}</p></div>`;
  }
  if (e.transcript?.length) {
    const expanded = expandedTranscripts.has(e.id);
    const shown = expanded ? e.transcript : e.transcript.slice(0, 3);
    extra += `<div class="e-transcript">
      ${shown
        .map(
          (s) => `<p class="tr-line">
          <span class="tr-speaker" style="color:${speakerColour(s.speakerId)}">${esc(speakerName(s.speakerId))}</span>
          <span class="tr-time">${fmtClock(s.t)}</span><br>${esc(s.text)}
        </p>`
        )
        .join("")}
      ${!expanded && e.transcript.length > 3
        ? `<button class="tr-more" data-id="${e.id}">Show all ${e.transcript.length} lines ▾</button>`
        : ""}
    </div>`;
  }
  if (e.audioId) {
    extra += `<div class="audio-player">
      <button class="ap-play" data-audio="${e.audioId}" aria-label="Play">▶</button>
      <div class="ap-track"><div class="ap-fill"></div></div>
      <span class="ap-time">${fmtDur(e.durationMs || 0)}</span>
    </div>`;
  }
  if (e.photoIds?.length) {
    extra += `<div class="e-photos">
      ${e.photoIds.map((p) => `<img data-photo="${p}" data-entry="${e.id}" alt="Photo" loading="lazy">`).join("")}
    </div>`;
  }

  return `
  <div class="entry type-${e.type}" data-entry="${e.id}">
    <div class="e-icon">${icon}</div>
    <div class="e-body">
      <p class="e-title">${esc(e.title)}</p>
      <span class="e-time">${fmtTime(e.ts)}${e.durationMs ? ` · ${fmtDur(e.durationMs)}` : ""}</span>
      ${extra}
    </div>
    <button class="e-menu" data-id="${e.id}" aria-label="Entry options">⋯</button>
  </div>`;
}

/* ---- audio playback ---- */
const player = new Audio();
let playingBtn = null;
let playingId = null;

player.addEventListener("timeupdate", () => {
  if (!playingBtn) return;
  const fill = playingBtn.parentElement.querySelector(".ap-fill");
  if (fill && player.duration && isFinite(player.duration)) {
    fill.style.right = `${100 - (player.currentTime / player.duration) * 100}%`;
  }
});
player.addEventListener("ended", () => {
  if (playingBtn) {
    playingBtn.textContent = "▶";
    playingBtn.parentElement.querySelector(".ap-fill").style.right = "100%";
  }
  playingBtn = null;
  playingId = null;
});

async function togglePlay(audioId, btn) {
  if (playingId === audioId && !player.paused) {
    player.pause();
    btn.textContent = "▶";
    playingBtn = null;
    playingId = null;
    return;
  }
  if (playingBtn) playingBtn.textContent = "▶";
  const record = await getAudio(audioId);
  if (!record) {
    toast("Audio not found 😕");
    return;
  }
  if (player.src) URL.revokeObjectURL(player.src);
  player.src = URL.createObjectURL(record.blob);
  try {
    await player.play();
    playingBtn = btn;
    playingId = audioId;
    btn.textContent = "❚❚";
  } catch {
    toast("Couldn't play that recording");
  }
}

/* ---- entry menu ---- */
async function openEntryMenu(id) {
  const all = await getAllEntries();
  const e = all.find((x) => x.id === id);
  if (!e) return;
  openSheet(`
    <h3>${esc(e.title)}</h3>
    <p class="sheet-note">${fmtFullDate(e.ts)} at ${fmtTime(e.ts)}</p>
    <div class="settings-card">
      <button class="settings-row" data-act="photo"><span>📷 Add a photo</span><span class="chev">›</span></button>
      <button class="settings-row" data-act="share"><span>↗ Share this entry</span><span class="chev">›</span></button>
      <button class="settings-row danger" data-act="delete"><span>🗑 Delete entry</span><span class="chev">›</span></button>
    </div>`);
  $('[data-act="photo"]', sheetEl).onclick = () => {
    closeSheet();
    photoTargetEntryId = e.id;
    $("#photo-input").click();
  };
  $('[data-act="share"]', sheetEl).onclick = async () => {
    closeSheet();
    await shareEntry(e);
  };
  $('[data-act="delete"]', sheetEl).onclick = () => {
    closeSheet();
    confirmSheet("Delete this entry?", "It'll be gone from the record for good (audio and photos too).", "Delete", async () => {
      await deleteEntry(e.id);
      if (e.audioId) await deleteAudio(e.audioId);
      for (const pid of e.photoIds || []) {
        await deletePhoto(pid);
        photoURLCache.delete(pid);
      }
      renderDiary();
      renderTodayStrip();
      toast("Entry deleted");
    });
  };
}

// Share an entry as text, with its photos attached where the share sheet allows.
async function shareEntry(e) {
  const text = entryToText(e, true);
  if (e.photoIds?.length && navigator.share) {
    const files = [];
    for (const pid of e.photoIds) {
      const rec = await getPhoto(pid);
      if (rec) files.push(new File([rec.blob], `tada-photo-${pid}.jpg`, { type: rec.blob.type || "image/jpeg" }));
    }
    if (files.length && navigator.canShare?.({ files, text })) {
      try {
        await navigator.share({ files, text });
        return;
      } catch {
        /* cancelled or unsupported combo — fall back to text */
      }
    }
  }
  shareText(text);
}

/* ---- sharing ---- */
function entryToText(e, withDate = false) {
  const icon = e.type === "voice" ? "🎙" : "✓";
  let s = `${icon} ${fmtTime(e.ts)} — ${e.title}`;
  if (withDate) s = `🧾 ${fmtFullDate(e.ts)}\n${s}`;
  if (e.durationMs) s += ` (${fmtDur(e.durationMs)})`;
  if (e.detail) s += `\n   ${e.detail}`;
  for (const seg of e.transcript || []) {
    s += `\n   ${speakerName(seg.speakerId)} [${fmtClock(seg.t)}]: “${seg.text}”`;
  }
  if (e.photoIds?.length) {
    s += `\n   📷 ${e.photoIds.length} photo${e.photoIds.length === 1 ? "" : "s"} attached`;
  }
  return s;
}

function shareDay(key, entries) {
  const list = entries.filter((e) => dayKey(e.ts) === key).sort((a, b) => a.ts - b.ts);
  if (!list.length) return;
  const text =
    `🧾 Ta-Da! receipts — ${fmtFullDate(list[0].ts)}\n` +
    `${list.length} ${list.length === 1 ? "entry" : "entries"} on the record:\n\n` +
    list.map((e) => entryToText(e)).join("\n");
  shareText(text);
}

async function shareText(text) {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch {
      /* user cancelled — fall through to clipboard */
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard 📋");
  } catch {
    toast("Couldn't share on this device");
  }
}

/* ============================================================
   SETTINGS TAB
   ============================================================ */
function renderSettings() {
  const list = $("#speaker-list");
  list.innerHTML = speakers
    .map(
      (s, i) => `
    <div class="speaker-item" data-id="${s.id}">
      <span class="sp-dot" style="background:${SPEAKER_COLOURS[i % SPEAKER_COLOURS.length]}"></span>
      <input type="text" value="${esc(s.name)}" maxlength="24" aria-label="Speaker name">
      <button class="sp-del" aria-label="Remove speaker">✕</button>
    </div>`
    )
    .join("");

  $$(".speaker-item", list).forEach((item) => {
    const sp = speakers.find((s) => s.id === item.dataset.id);
    $("input", item).addEventListener("change", (e) => {
      sp.name = e.target.value.trim() || sp.name;
      e.target.value = sp.name;
      saveSpeakers();
    });
    $(".sp-del", item).addEventListener("click", () => {
      if (speakers.length <= 1) {
        toast("You need at least one speaker");
        return;
      }
      speakers = speakers.filter((s) => s.id !== sp.id);
      saveSpeakers();
      renderSettings();
    });
  });

  // storage info
  navigator.storage?.estimate?.().then(({ usage }) => {
    if (usage != null) {
      $("#storage-info").textContent = `Using ${(usage / 1048576).toFixed(1)} MB of on-device storage.`;
    }
  });
}

$("#add-speaker-btn").addEventListener("click", () => {
  if (speakers.length >= 6) {
    toast("That's plenty of speakers!");
    return;
  }
  speakers.push({ id: uid(), name: `Speaker ${speakers.length + 1}` });
  saveSpeakers();
  renderSettings();
});

/* ---- export / import / wipe ---- */
$("#export-json-btn").addEventListener("click", async () => {
  const entries = await getAllEntries();
  const payload = {
    app: "tada",
    version: 1,
    exportedAt: new Date().toISOString(),
    note: "Audio recordings and photos are not included in this backup — they stay on the device.",
    tiles,
    speakers,
    entries,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tada-diary-${dayKey(Date.now())}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast("Backup exported 📦");
});

$("#import-json-btn").addEventListener("click", () => $("#import-file").click());
$("#import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== "tada" || !Array.isArray(data.entries)) throw new Error("bad file");
    for (const entry of data.entries) await putEntry(entry);
    if (Array.isArray(data.tiles) && data.tiles.length) {
      tiles = data.tiles;
      saveTiles();
    }
    if (Array.isArray(data.speakers) && data.speakers.length) {
      speakers = data.speakers;
      saveSpeakers();
    }
    renderTiles();
    renderTodayStrip();
    toast(`Imported ${data.entries.length} entries ✅`);
  } catch {
    toast("That file doesn't look like a Ta-Da! backup");
  }
});

$("#wipe-btn").addEventListener("click", () =>
  confirmSheet(
    "Erase everything?",
    "Every entry, recording and transcript will be permanently deleted from this phone. There is no undo.",
    "Erase it all",
    async () => {
      const db = await openDB();
      db.close();
      dbPromise = null;
      await new Promise((res) => {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = req.onerror = req.onblocked = res;
      });
      localStorage.removeItem("tada-tiles");
      localStorage.removeItem("tada-speakers");
      tiles = [...DEFAULT_TILES];
      speakers = [...DEFAULT_SPEAKERS];
      renderTiles();
      renderTodayStrip();
      renderDiary();
      renderSettings();
      toast("All data erased");
    }
  )
);

/* ============================================================
   BOOT
   ============================================================ */
renderTiles();
renderTodayStrip();
renderSettings();

// Ask the browser not to evict our data under storage pressure.
navigator.storage?.persist?.();

// Deep links for iOS Shortcuts / Siri / Action button:
//   ?log=<anything you said or typed> — logs it instantly (matches a button if one fits)
//   ?record=1                         — jumps to the recorder and starts recording
//   ?tab=record|diary|settings        — opens on that tab
{
  const params = new URLSearchParams(location.search);
  const logParam = params.get("log")?.trim();
  const tabParam = params.get("tab");
  const recordParam = params.get("record");
  if (logParam) {
    const byId = tiles.find((t) => t.id === logParam);
    logText(byId ? byId.label : cleanSpoken(logParam) || logParam);
  }
  if (tabParam) $(`.tab[data-tab="${CSS.escape(tabParam)}"]`)?.click();
  if (recordParam) {
    $('.tab[data-tab="record"]')?.click();
    startRecording(true);
  }
  if (logParam || tabParam || recordParam) history.replaceState(null, "", location.pathname);
}

// Offline support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
