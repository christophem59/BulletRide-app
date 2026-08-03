"use strict";

/* ------------------------------------------------------------------ *
 * BulletRide — bullet journal moto
 * Vanilla JS PWA, données stockées localement (localStorage).
 * ------------------------------------------------------------------ */

const STORAGE_DAYS = "bulletride:days";       // { "YYYY-MM-DD": "<catId>" }
const STORAGE_CATS = "bulletride:categories"; // [ { id, label, color } ]

const DEFAULT_CATEGORIES = [
  { id: "balade",  label: "Balade",   color: "#ff6b35" },
  { id: "trajet",  label: "Trajet",   color: "#4cc9f0" },
  { id: "circuit", label: "Circuit",  color: "#f72585" },
  { id: "offroad", label: "Off-road", color: "#80ed99" },
];

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"]; // lundi -> dimanche

/* --------------------------- État --------------------------- */

const state = {
  year: new Date().getFullYear(),
  days: loadDays(),
  categories: loadCategories(),
};

function loadDays() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_DAYS)) || {};
  } catch {
    return {};
  }
}

function saveDays() {
  localStorage.setItem(STORAGE_DAYS, JSON.stringify(state.days));
}

function loadCategories() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_CATS));
    if (Array.isArray(raw) && raw.length) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_CATEGORIES.map((c) => ({ ...c }));
}

function saveCategories() {
  localStorage.setItem(STORAGE_CATS, JSON.stringify(state.categories));
}

/* --------------------------- Utilitaires --------------------------- */

function pad(n) {
  return String(n).padStart(2, "0");
}

function dateKey(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function todayKey() {
  const d = new Date();
  return dateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

// Lundi = 0 ... Dimanche = 6
function weekdayMondayFirst(year, month, day) {
  return (new Date(year, month, day).getDay() + 6) % 7;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function categoryById(id) {
  return state.categories.find((c) => c.id === id) || null;
}

/** Couleur de texte lisible (noir/blanc) selon la luminance du fond. */
function readableInk(hex) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.9)";
}

/* --------------------------- DOM refs --------------------------- */

const el = {
  yearLabel: document.getElementById("year-label"),
  prevYear: document.getElementById("btn-prev-year"),
  nextYear: document.getElementById("btn-next-year"),
  stats: document.getElementById("stats"),
  grid: document.getElementById("year-grid"),
  legend: document.getElementById("legend"),
  toast: document.getElementById("toast"),
  settingsBtn: document.getElementById("btn-settings"),
  overlay: document.getElementById("settings-overlay"),
  closeSettings: document.getElementById("btn-close-settings"),
  catEditor: document.getElementById("cat-editor"),
  addCat: document.getElementById("btn-add-cat"),
  saveCats: document.getElementById("btn-save-cats"),
  resetCats: document.getElementById("btn-reset-cats"),
};

/* --------------------------- Rendu --------------------------- */

function render() {
  el.yearLabel.textContent = state.year;
  renderGrid();
  renderStats();
  renderLegend();
}

function renderGrid() {
  const today = todayKey();
  const frag = document.createDocumentFragment();

  for (let m = 0; m < 12; m++) {
    const card = document.createElement("div");
    card.className = "month-card";

    const title = document.createElement("div");
    title.className = "month-title";
    title.textContent = MONTHS[m];
    card.appendChild(title);

    const wd = document.createElement("div");
    wd.className = "weekdays";
    for (const d of WEEKDAYS) {
      const s = document.createElement("span");
      s.className = "wd";
      s.textContent = d;
      wd.appendChild(s);
    }
    card.appendChild(wd);

    const days = document.createElement("div");
    days.className = "days";

    const offset = weekdayMondayFirst(state.year, m, 1);
    for (let i = 0; i < offset; i++) {
      const blank = document.createElement("div");
      blank.className = "day blank";
      days.appendChild(blank);
    }

    const total = daysInMonth(state.year, m);
    for (let d = 1; d <= total; d++) {
      const key = dateKey(state.year, m, d);
      const btn = document.createElement("button");
      btn.className = "day";
      btn.dataset.key = key;
      btn.type = "button";

      const num = document.createElement("span");
      num.className = "num";
      num.textContent = d;
      btn.appendChild(num);

      const cat = categoryById(state.days[key]);
      if (cat) {
        btn.classList.add("filled");
        btn.style.background = cat.color;
        btn.title = cat.label;
      }
      if (key === today) btn.classList.add("today");
      if (key > today) btn.classList.add("future");

      days.appendChild(btn);
    }

    card.appendChild(days);
    frag.appendChild(card);
  }

  el.grid.replaceChildren(frag);
}

function renderStats() {
  const counts = {};
  let total = 0;
  const prefix = `${state.year}-`;
  for (const [key, catId] of Object.entries(state.days)) {
    if (!key.startsWith(prefix)) continue;
    if (!categoryById(catId)) continue;
    counts[catId] = (counts[catId] || 0) + 1;
    total++;
  }

  const frag = document.createDocumentFragment();

  const totalChip = document.createElement("div");
  totalChip.className = "stat-chip";
  totalChip.innerHTML = `<span class="stat-total"><strong>${total}</strong></span> jour${total > 1 ? "s" : ""} de moto`;
  frag.appendChild(totalChip);

  for (const cat of state.categories) {
    const n = counts[cat.id] || 0;
    if (n === 0) continue;
    const chip = document.createElement("div");
    chip.className = "stat-chip";
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = cat.color;
    chip.appendChild(dot);
    chip.append(document.createTextNode(cat.label + " "));
    const strong = document.createElement("strong");
    strong.textContent = n;
    chip.appendChild(strong);
    frag.appendChild(chip);
  }

  el.stats.replaceChildren(frag);
}

function renderLegend() {
  const frag = document.createDocumentFragment();
  for (const cat of state.categories) {
    const item = document.createElement("div");
    item.className = "legend-item";
    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = cat.color;
    item.appendChild(sw);
    item.append(document.createTextNode(cat.label));
    frag.appendChild(item);
  }
  el.legend.replaceChildren(frag);
}

/* --------------------------- Interaction jour --------------------------- */

// Cycle : rien -> cat0 -> cat1 -> ... -> dernière -> rien
function cycleDay(key) {
  const current = state.days[key];
  const ids = state.categories.map((c) => c.id);
  if (ids.length === 0) return;

  let nextId;
  if (!current) {
    nextId = ids[0];
  } else {
    const idx = ids.indexOf(current);
    if (idx === -1 || idx === ids.length - 1) {
      nextId = null; // retour à vide
    } else {
      nextId = ids[idx + 1];
    }
  }

  if (nextId) {
    state.days[key] = nextId;
  } else {
    delete state.days[key];
  }
  saveDays();
  updateDayCell(key);
  renderStats();
}

function updateDayCell(key) {
  const btn = el.grid.querySelector(`.day[data-key="${key}"]`);
  if (!btn) return;
  const cat = categoryById(state.days[key]);
  if (cat) {
    btn.classList.add("filled");
    btn.style.background = cat.color;
    btn.style.color = readableInk(cat.color);
    btn.title = cat.label;
  } else {
    btn.classList.remove("filled");
    btn.style.background = "";
    btn.style.color = "";
    btn.removeAttribute("title");
  }
}

el.grid.addEventListener("click", (e) => {
  const btn = e.target.closest(".day");
  if (!btn || btn.classList.contains("blank") || btn.classList.contains("future")) return;
  cycleDay(btn.dataset.key);
});

/* --------------------------- Navigation année --------------------------- */

el.prevYear.addEventListener("click", () => {
  state.year--;
  render();
});
el.nextYear.addEventListener("click", () => {
  state.year++;
  render();
});

/* --------------------------- Modale catégories --------------------------- */

function slugify(label, existingIds) {
  let base = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  if (!base) base = "cat";
  let id = base;
  let i = 2;
  while (existingIds.includes(id)) {
    id = `${base}-${i++}`;
  }
  return id;
}

function openSettings() {
  renderCatEditor(state.categories.map((c) => ({ ...c })));
  el.overlay.classList.remove("hidden");
}

function closeSettings() {
  el.overlay.classList.add("hidden");
}

function renderCatEditor(cats) {
  const frag = document.createDocumentFragment();
  cats.forEach((cat, index) => {
    const row = document.createElement("div");
    row.className = "cat-row";
    row.dataset.index = index;
    if (cat.id) row.dataset.id = cat.id;

    const color = document.createElement("input");
    color.type = "color";
    color.value = cat.color;
    color.className = "cat-color";

    const label = document.createElement("input");
    label.type = "text";
    label.value = cat.label;
    label.placeholder = "Nom de la catégorie";
    label.className = "cat-label";
    label.maxLength = 24;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn-del";
    del.textContent = "🗑";
    del.title = "Supprimer";
    del.addEventListener("click", () => {
      row.remove();
    });

    row.append(color, label, del);
    frag.appendChild(row);
  });
  el.catEditor.replaceChildren(frag);
}

function addCatRow() {
  const row = document.createElement("div");
  row.className = "cat-row";

  const palette = ["#ffd166", "#06d6a0", "#118ab2", "#ef476f", "#9b5de5", "#f15bb5"];
  const color = document.createElement("input");
  color.type = "color";
  color.value = palette[el.catEditor.children.length % palette.length];
  color.className = "cat-color";

  const label = document.createElement("input");
  label.type = "text";
  label.placeholder = "Nom de la catégorie";
  label.className = "cat-label";
  label.maxLength = 24;

  const del = document.createElement("button");
  del.type = "button";
  del.className = "btn-del";
  del.textContent = "🗑";
  del.title = "Supprimer";
  del.addEventListener("click", () => row.remove());

  row.append(color, label, del);
  el.catEditor.appendChild(row);
  label.focus();
}

function saveCatsFromEditor() {
  const rows = [...el.catEditor.querySelectorAll(".cat-row")];
  const result = [];
  const usedIds = [];

  for (const row of rows) {
    const label = row.querySelector(".cat-label").value.trim();
    const color = row.querySelector(".cat-color").value;
    if (!label) continue;
    const existingId = row.dataset.id;
    let id = existingId && !usedIds.includes(existingId)
      ? existingId
      : slugify(label, usedIds);
    usedIds.push(id);
    result.push({ id, label, color });
  }

  if (result.length === 0) {
    toast("Ajoute au moins une catégorie");
    return;
  }

  state.categories = result;
  saveCategories();

  // Nettoie les jours dont la catégorie n'existe plus.
  let removed = 0;
  for (const [key, catId] of Object.entries(state.days)) {
    if (!usedIds.includes(catId)) {
      delete state.days[key];
      removed++;
    }
  }
  if (removed) saveDays();

  closeSettings();
  render();
  toast("Catégories enregistrées");
}

function resetCats() {
  renderCatEditor(DEFAULT_CATEGORIES.map((c) => ({ ...c })));
}

el.settingsBtn.addEventListener("click", openSettings);
el.closeSettings.addEventListener("click", closeSettings);
el.overlay.addEventListener("click", (e) => {
  if (e.target === el.overlay) closeSettings();
});
el.addCat.addEventListener("click", addCatRow);
el.saveCats.addEventListener("click", saveCatsFromEditor);
el.resetCats.addEventListener("click", resetCats);

/* --------------------------- Toast --------------------------- */

let toastTimer = null;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2200);
}

/* --------------------------- Init --------------------------- */

render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
