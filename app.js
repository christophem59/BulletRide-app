"use strict";

/* ------------------------------------------------------------------ *
 * BulletRide — bullet journal moto
 * Vanilla JS PWA, données stockées localement (localStorage).
 * ------------------------------------------------------------------ */

const STORAGE_DAYS = "bulletride:days";       // { "YYYY-MM-DD": { cat, note, km, u } }
const STORAGE_CATS = "bulletride:categories"; // [ { id, label, color } ]
const STORAGE_TOMBS = "bulletride:tombstones"; // { "YYYY-MM-DD": u }  (suppressions)
const STORAGE_CATS_U = "bulletride:catsU";     // horodatage des catégories (ms)
const STORAGE_SYNC = "bulletride:sync";        // { owner, repo, branch, token }
const STORAGE_LAST_SYNC = "bulletride:lastSync";

function nowMs() {
  return Date.now();
}

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
  tombstones: loadTombstones(),
  catsU: loadCatsU(),
  view: "year",                     // "year" | "month"
  viewMonth: new Date().getMonth(), // mois affiché en vue détaillée (0-11)
};

function loadTombstones() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_TOMBS)) || {};
  } catch {
    return {};
  }
}

function saveTombstones() {
  localStorage.setItem(STORAGE_TOMBS, JSON.stringify(state.tombstones));
}

function loadCatsU() {
  return Number(localStorage.getItem(STORAGE_CATS_U)) || 0;
}

function loadDays() {
  let raw;
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_DAYS)) || {};
  } catch {
    return {};
  }
  // Migration : ancien format où la valeur était directement l'id de catégorie
  // (une chaîne). On passe à un objet { cat, note, km }.
  const migrated = {};
  for (const [key, val] of Object.entries(raw)) {
    if (typeof val === "string") {
      migrated[key] = { cat: val };
    } else if (val && typeof val === "object") {
      migrated[key] = val;
    }
  }
  return migrated;
}

function saveDays() {
  localStorage.setItem(STORAGE_DAYS, JSON.stringify(state.days));
}

/** Entrée normalisée d'un jour (ou null si rien). */
function dayEntry(key) {
  return state.days[key] || null;
}

/** Id de catégorie d'un jour (ou null). */
function dayCat(key) {
  const e = state.days[key];
  return e ? e.cat || null : null;
}

/** Vrai si le jour porte une note non vide. */
function dayHasNote(key) {
  const e = state.days[key];
  return !!(e && e.note && e.note.trim());
}

/**
 * Écrit une entrée de jour et nettoie si elle devient vide (pas de catégorie,
 * pas de note). Renvoie l'entrée finale (ou null si supprimée).
 */
function writeDay(key, { cat, note, km, min } = {}) {
  const e = { ...(state.days[key] || {}) };
  if (cat !== undefined) {
    if (cat) e.cat = cat;
    else delete e.cat;
  }
  if (note !== undefined) {
    const n = (note || "").trim();
    if (n) e.note = n;
    else delete e.note;
  }
  if (km !== undefined) {
    if (km === null || km === "" || !(Number(km) > 0)) delete e.km;
    else e.km = Number(km);
  }
  if (min !== undefined) {
    if (min === null || min === "" || !(Number(min) > 0)) delete e.min;
    else e.min = Number(min);
  }
  const empty = !e.cat && !e.note && e.km === undefined && e.min === undefined;
  if (empty) {
    if (state.days[key]) delete state.days[key];
    state.tombstones[key] = nowMs(); // marque la suppression pour la synchro
    saveDays();
    saveTombstones();
    scheduleSync();
    return null;
  }
  e.u = nowMs();
  delete state.tombstones[key]; // (ré)écriture : annule une éventuelle suppression
  state.days[key] = e;
  saveDays();
  saveTombstones();
  scheduleSync();
  return e;
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

function saveCategories(bump = true) {
  localStorage.setItem(STORAGE_CATS, JSON.stringify(state.categories));
  if (bump) {
    state.catsU = nowMs();
    localStorage.setItem(STORAGE_CATS_U, String(state.catsU));
  }
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
  yearSections: [...document.querySelectorAll(".year-only")],
  monthView: document.getElementById("month-view"),
  mvBack: document.getElementById("mv-back"),
  mvPrev: document.getElementById("mv-prev"),
  mvNext: document.getElementById("mv-next"),
  mvTitle: document.getElementById("mv-title"),
  mvStats: document.getElementById("mv-stats"),
  mvGrid: document.getElementById("mv-grid"),
  mvList: document.getElementById("mv-list"),
  toast: document.getElementById("toast"),
  settingsBtn: document.getElementById("btn-settings"),
  overlay: document.getElementById("settings-overlay"),
  closeSettings: document.getElementById("btn-close-settings"),
  catEditor: document.getElementById("cat-editor"),
  addCat: document.getElementById("btn-add-cat"),
  saveCats: document.getElementById("btn-save-cats"),
  resetCats: document.getElementById("btn-reset-cats"),
  dayOverlay: document.getElementById("day-overlay"),
  closeDay: document.getElementById("btn-close-day"),
  dayChoices: document.getElementById("day-choices"),
  dayKm: document.getElementById("day-km"),
  dayH: document.getElementById("day-h"),
  dayMin: document.getElementById("day-min"),
  dayNote: document.getElementById("day-note"),
  dayDone: document.getElementById("btn-day-done"),
  statsExtra: document.getElementById("stats-extra"),
  todayBtn: document.getElementById("btn-today"),
  syncBtn: document.getElementById("btn-sync"),
  syncOverlay: document.getElementById("sync-overlay"),
  closeSync: document.getElementById("btn-close-sync"),
  syncForm: document.getElementById("sync-form"),
  syncConnected: document.getElementById("sync-connected"),
  syncOwner: document.getElementById("sync-owner"),
  syncRepo: document.getElementById("sync-repo"),
  syncBranch: document.getElementById("sync-branch"),
  syncToken: document.getElementById("sync-token"),
  syncConnect: document.getElementById("btn-sync-connect"),
  syncNowBtn: document.getElementById("btn-sync-now"),
  syncDisconnect: document.getElementById("btn-sync-disconnect"),
  syncStatus: document.getElementById("sync-status"),
  syncRepoLabel: document.getElementById("sync-repo-label"),
};

/* --------------------------- Rendu --------------------------- */

function render() {
  const monthView = state.view === "month";
  el.yearSections.forEach((s) => s.classList.toggle("hidden", monthView));
  el.monthView.classList.toggle("hidden", !monthView);

  if (monthView) {
    renderMonthView();
  } else {
    el.yearLabel.textContent = state.year;
    renderGrid();
    renderStats();
    renderLegend();
  }
}

function renderGrid() {
  const today = todayKey();
  const frag = document.createDocumentFragment();

  for (let m = 0; m < 12; m++) {
    const card = document.createElement("div");
    card.className = "month-card";

    const title = document.createElement("button");
    title.type = "button";
    title.className = "month-title";
    title.dataset.month = m;
    title.innerHTML = `<span>${MONTHS[m]}</span><span class="month-chevron">›</span>`;
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

      const cat = categoryById(dayCat(key));
      if (cat) {
        btn.classList.add("filled");
        btn.style.background = cat.color;
        btn.title = cat.label;
      }
      if (dayHasNote(key)) {
        btn.classList.add("has-note");
        btn.title = (cat ? cat.label + " — " : "") + "note";
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
  const counts = {};             // par catégorie
  const byMonth = new Array(12).fill(0);
  const byWeekday = new Array(7).fill(0);
  let total = 0;
  let totalKm = 0;
  let totalMin = 0;
  const prefix = `${state.year}-`;

  for (const [key, entry] of Object.entries(state.days)) {
    if (!key.startsWith(prefix)) continue;
    const catId = entry && entry.cat;
    if (!categoryById(catId)) continue; // seuls les jours "de moto" comptent
    counts[catId] = (counts[catId] || 0) + 1;
    total++;
    if (entry.km > 0) totalKm += entry.km;
    if (entry.min > 0) totalMin += entry.min;
    const [y, m, d] = key.split("-").map(Number);
    byMonth[m - 1]++;
    byWeekday[weekdayMondayFirst(y, m - 1, d)]++;
  }

  /* --- Chips : total + km + temps + par catégorie --- */
  const frag = document.createDocumentFragment();

  const totalChip = document.createElement("div");
  totalChip.className = "stat-chip";
  totalChip.innerHTML = `<span class="stat-total"><strong>${total}</strong></span> jour${total > 1 ? "s" : ""} de moto`;
  frag.appendChild(totalChip);

  if (totalKm > 0) {
    const kmChip = document.createElement("div");
    kmChip.className = "stat-chip";
    kmChip.innerHTML = `<strong>${Math.round(totalKm).toLocaleString("fr-FR")}</strong> km`;
    frag.appendChild(kmChip);
  }
  if (totalMin > 0) {
    const timeChip = document.createElement("div");
    timeChip.className = "stat-chip";
    timeChip.innerHTML = `<strong>${formatDuration(totalMin)}</strong> de route`;
    frag.appendChild(timeChip);
  }

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
  renderStatsExtra({ total, byMonth, byWeekday });
}

const WEEKDAYS_FULL = [
  "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche",
];

// Minutes -> "2 h 30" / "3 h" / "45 min"
function formatDuration(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h} h ${String(m).padStart(2, "0")}`;
  if (h) return `${h} h`;
  return `${m} min`;
}

function renderStatsExtra({ total, byMonth, byWeekday }) {
  if (total === 0) {
    el.statsExtra.replaceChildren();
    return;
  }

  const maxMonth = Math.max(...byMonth);
  const bestMonthIdx = byMonth.indexOf(maxMonth);
  const bestWeekdayIdx = byWeekday.indexOf(Math.max(...byWeekday));

  const wrap = document.createElement("div");
  wrap.className = "stats-extra-inner";

  // Résumés textuels
  const summary = document.createElement("div");
  summary.className = "stats-summary";
  const best = document.createElement("span");
  best.innerHTML = `Meilleur mois : <strong>${MONTHS[bestMonthIdx]}</strong> (${maxMonth})`;
  const fav = document.createElement("span");
  fav.innerHTML = `Jour préféré : <strong>${WEEKDAYS_FULL[bestWeekdayIdx]}</strong>`;
  summary.append(best, fav);
  wrap.appendChild(summary);

  // Mini graphe par mois
  const chart = document.createElement("div");
  chart.className = "month-chart";
  for (let m = 0; m < 12; m++) {
    const col = document.createElement("div");
    col.className = "mc-col";
    col.title = `${MONTHS[m]} : ${byMonth[m]}`;

    const barWrap = document.createElement("div");
    barWrap.className = "mc-bar-wrap";
    const bar = document.createElement("div");
    bar.className = "mc-bar";
    bar.style.height = maxMonth ? `${Math.round((byMonth[m] / maxMonth) * 100)}%` : "0%";
    if (byMonth[m] === 0) bar.classList.add("empty");
    barWrap.appendChild(bar);

    const lbl = document.createElement("span");
    lbl.className = "mc-label";
    lbl.textContent = MONTHS[m].charAt(0).toUpperCase();

    col.append(barWrap, lbl);
    chart.appendChild(col);
  }
  wrap.appendChild(chart);

  el.statsExtra.replaceChildren(wrap);
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

let selectedDayKey = null;
// Brouillon de la modale : rien n'est écrit tant qu'on ne clique pas Terminé.
// kmDirty/durDirty = l'utilisateur a saisi une valeur à la main (à ne pas
// écraser quand il change de catégorie).
let dayDraft = null;

function formatDayTitle(key) {
  const [y, m, d] = key.split("-").map(Number);
  const wd = weekdayMondayFirst(y, m - 1, d);
  return `${WEEKDAYS_FULL[wd]} ${d} ${MONTHS[m - 1]} ${y}`;
}

function setDurationInputs(min) {
  if (min && Number(min) > 0) {
    el.dayH.value = Math.floor(min / 60) || "";
    el.dayMin.value = min % 60 || (Math.floor(min / 60) ? 0 : "");
  } else {
    el.dayH.value = "";
    el.dayMin.value = "";
  }
}

// Minutes totales saisies dans les champs h/min (ou "" si rien).
function readDurationMinutes() {
  const h = parseInt(el.dayH.value, 10) || 0;
  const m = parseInt(el.dayMin.value, 10) || 0;
  const total = h * 60 + m;
  return total > 0 ? total : "";
}

function openDayModal(key) {
  selectedDayKey = key;
  const entry = dayEntry(key);
  // Les valeurs déjà enregistrées comptent comme "saisies main" : on ne les
  // écrase pas si l'utilisateur change de catégorie.
  dayDraft = {
    cat: (entry && entry.cat) || null,
    kmDirty: !!(entry && entry.km > 0),
    durDirty: !!(entry && entry.min > 0),
  };
  document.getElementById("day-modal-title").textContent = formatDayTitle(key);
  el.dayNote.value = (entry && entry.note) || "";
  el.dayKm.value = entry && entry.km ? entry.km : "";
  setDurationInputs(entry && entry.min);
  renderDayChoices();
  el.dayOverlay.classList.remove("hidden");
}

// Ferme SANS enregistrer (✕, clic extérieur, Échap).
function cancelDayModal() {
  el.dayOverlay.classList.add("hidden");
  selectedDayKey = null;
  dayDraft = null;
}

// Seul chemin qui enregistre : bouton Terminé.
function commitDayAndClose() {
  if (selectedDayKey && dayDraft) {
    writeDay(selectedDayKey, {
      cat: dayDraft.cat,
      note: el.dayNote.value,
      km: el.dayKm.value,
      min: readDurationMinutes(),
    });
    if (state.view === "month") {
      renderMonthView();
    } else {
      updateDayCell(selectedDayKey);
      renderStats();
    }
  }
  el.dayOverlay.classList.add("hidden");
  selectedDayKey = null;
  dayDraft = null;
}

function renderDayChoices() {
  const current = dayDraft ? dayDraft.cat : null;
  const frag = document.createDocumentFragment();

  for (const cat of state.categories) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice" + (cat.id === current ? " selected" : "");
    btn.dataset.cat = cat.id;

    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = cat.color;

    const label = document.createElement("span");
    label.className = "choice-label";
    label.textContent = cat.label;

    const check = document.createElement("span");
    check.className = "check";
    check.textContent = "✓";

    btn.append(sw, label, check);
    frag.appendChild(btn);
  }

  // Option "aucune / effacer"
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "choice choice-clear" + (current === null ? " selected" : "");
  clear.dataset.cat = "";
  const csw = document.createElement("span");
  csw.className = "swatch";
  const clabel = document.createElement("span");
  clabel.className = "choice-label";
  clabel.textContent = "Aucune (pas de moto)";
  const ccheck = document.createElement("span");
  ccheck.className = "check";
  ccheck.textContent = "✓";
  clear.append(csw, clabel, ccheck);
  frag.appendChild(clear);

  el.dayChoices.replaceChildren(frag);
}

// Sélectionne une catégorie (ou l'efface). Ne ferme pas : on peut ensuite
// ajouter une note. La saisie reste rapide grâce au bouton « Terminé ».
function chooseCategory(catId) {
  if (!dayDraft) return;
  dayDraft.cat = catId || null;

  // Ajuste km/temps proposés sur les défauts de la nouvelle catégorie, sauf
  // les champs que l'utilisateur a saisis à la main (kmDirty / durDirty).
  const cat = categoryById(catId);
  if (cat) {
    if (!dayDraft.kmDirty) el.dayKm.value = cat.defKm > 0 ? cat.defKm : "";
    if (!dayDraft.durDirty) setDurationInputs(cat.defMin > 0 ? cat.defMin : 0);
  } else {
    // « Aucune (pas de moto) » : on vide km/temps (la note reste possible).
    el.dayKm.value = "";
    setDurationInputs(0);
    dayDraft.kmDirty = false;
    dayDraft.durDirty = false;
  }

  renderDayChoices(); // rafraîchit la sélection cochée (pas d'écriture)
}

function updateDayCell(key) {
  const btn = el.grid.querySelector(`.day[data-key="${key}"]`);
  if (!btn) return;
  const cat = categoryById(dayCat(key));
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
  btn.classList.toggle("has-note", dayHasNote(key));
}

el.grid.addEventListener("click", (e) => {
  const monthBtn = e.target.closest(".month-title");
  if (monthBtn) {
    openMonth(Number(monthBtn.dataset.month));
    return;
  }
  const btn = e.target.closest(".day");
  if (!btn || btn.classList.contains("blank") || btn.classList.contains("future")) return;
  openDayModal(btn.dataset.key);
});

/* --------------------------- Vue mensuelle détaillée --------------------------- */

const WEEKDAYS_SHORT = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

function openMonth(m) {
  state.view = "month";
  state.viewMonth = m;
  render();
  window.scrollTo(0, 0);
}

function backToYear() {
  state.view = "year";
  render();
}

function stepMonth(delta) {
  let m = state.viewMonth + delta;
  if (m < 0) { m = 11; state.year--; }
  else if (m > 11) { m = 0; state.year++; }
  state.viewMonth = m;
  render();
}

function renderMonthView() {
  const m = state.viewMonth;
  const y = state.year;
  el.mvTitle.textContent = `${MONTHS[m].charAt(0).toUpperCase() + MONTHS[m].slice(1)} ${y}`;

  // --- Entrées du mois (triées par jour) ---
  const prefix = `${y}-${pad(m + 1)}-`;
  const entries = Object.entries(state.days)
    .filter(([k]) => k.startsWith(prefix))
    .sort(([a], [b]) => a.localeCompare(b));

  let count = 0, totalKm = 0, totalMin = 0;
  for (const [, e] of entries) {
    if (!categoryById(e.cat)) continue;
    count++;
    if (e.km > 0) totalKm += e.km;
    if (e.min > 0) totalMin += e.min;
  }

  // --- Stats du mois ---
  const sf = document.createDocumentFragment();
  const c1 = document.createElement("div");
  c1.className = "stat-chip";
  c1.innerHTML = `<span class="stat-total"><strong>${count}</strong></span> sortie${count > 1 ? "s" : ""}`;
  sf.appendChild(c1);
  if (totalKm > 0) {
    const c = document.createElement("div");
    c.className = "stat-chip";
    c.innerHTML = `<strong>${Math.round(totalKm).toLocaleString("fr-FR")}</strong> km`;
    sf.appendChild(c);
  }
  if (totalMin > 0) {
    const c = document.createElement("div");
    c.className = "stat-chip";
    c.innerHTML = `<strong>${formatDuration(totalMin)}</strong> de route`;
    sf.appendChild(c);
  }
  el.mvStats.replaceChildren(sf);

  // --- Grand calendrier (couleur + note, pas de km) ---
  const today = todayKey();
  const gf = document.createDocumentFragment();
  const offset = weekdayMondayFirst(y, m, 1);
  for (let i = 0; i < offset; i++) {
    const b = document.createElement("div");
    b.className = "day blank";
    gf.appendChild(b);
  }
  const total = daysInMonth(y, m);
  for (let d = 1; d <= total; d++) {
    const key = dateKey(y, m, d);
    const btn = document.createElement("button");
    btn.className = "day";
    btn.type = "button";
    btn.dataset.key = key;
    const num = document.createElement("span");
    num.className = "num";
    num.textContent = d;
    btn.appendChild(num);
    const cat = categoryById(dayCat(key));
    if (cat) {
      btn.classList.add("filled");
      btn.style.background = cat.color;
      btn.style.color = readableInk(cat.color);
      btn.title = cat.label;
    }
    if (dayHasNote(key)) btn.classList.add("has-note");
    if (key === today) btn.classList.add("today");
    if (key > today) btn.classList.add("future");
    gf.appendChild(btn);
  }
  el.mvGrid.replaceChildren(gf);

  // --- Liste des sorties du mois ---
  const lf = document.createDocumentFragment();
  const visible = entries.filter(([, e]) => e.cat || e.note || e.km > 0 || e.min > 0);
  if (visible.length === 0) {
    const empty = document.createElement("p");
    empty.className = "mv-empty";
    empty.textContent = "Aucune sortie ce mois-ci.";
    lf.appendChild(empty);
  }
  for (const [key, e] of visible) {
    const d = Number(key.slice(8, 10));
    const wd = weekdayMondayFirst(y, m, d);
    const cat = categoryById(e.cat);

    const row = document.createElement("button");
    row.type = "button";
    row.className = "mv-row";
    row.dataset.key = key;

    const dot = document.createElement("span");
    dot.className = "mv-dot";
    dot.style.background = cat ? cat.color : "#555";

    const mid = document.createElement("div");
    mid.className = "mv-mid";
    const head = document.createElement("div");
    head.className = "mv-row-head";
    head.innerHTML = `<strong>${WEEKDAYS_SHORT[wd]} ${d}</strong> · ${cat ? cat.label : "Note"}`;
    mid.appendChild(head);
    if (e.note) {
      const note = document.createElement("div");
      note.className = "mv-row-note";
      note.textContent = e.note;
      mid.appendChild(note);
    }

    const right = document.createElement("div");
    right.className = "mv-row-metrics";
    const bits = [];
    if (e.km > 0) bits.push(`${e.km} km`);
    if (e.min > 0) bits.push(formatDuration(e.min));
    right.innerHTML = bits.length ? bits.join("<br>") : "—";

    row.append(dot, mid, right);
    lf.appendChild(row);
  }
  el.mvList.replaceChildren(lf);
}

el.mvBack.addEventListener("click", backToYear);
el.mvPrev.addEventListener("click", () => stepMonth(-1));
el.mvNext.addEventListener("click", () => stepMonth(1));
el.mvGrid.addEventListener("click", (e) => {
  const btn = e.target.closest(".day");
  if (!btn || btn.classList.contains("blank") || btn.classList.contains("future")) return;
  openDayModal(btn.dataset.key);
});
el.mvList.addEventListener("click", (e) => {
  const row = e.target.closest(".mv-row");
  if (row) openDayModal(row.dataset.key);
});

el.dayChoices.addEventListener("click", (e) => {
  const choice = e.target.closest(".choice");
  if (!choice) return;
  chooseCategory(choice.dataset.cat || null);
});

el.dayDone.addEventListener("click", commitDayAndClose); // seul chemin qui enregistre
el.closeDay.addEventListener("click", cancelDayModal);
el.dayOverlay.addEventListener("click", (e) => {
  if (e.target === el.dayOverlay) cancelDayModal();
});

// Marque les champs comme "saisis à la main" pour ne pas les écraser au
// changement de catégorie.
el.dayKm.addEventListener("input", () => {
  if (dayDraft) dayDraft.kmDirty = true;
});
const markDurDirty = () => {
  if (dayDraft) dayDraft.durDirty = true;
};
el.dayH.addEventListener("input", markDurDirty);
el.dayMin.addEventListener("input", markDurDirty);

// Bouton « J'ai roulé aujourd'hui » : bascule sur l'année courante si besoin,
// puis ouvre la modale du jour.
el.todayBtn.addEventListener("click", () => {
  const key = todayKey();
  const y = Number(key.slice(0, 4));
  if (state.year !== y) {
    state.year = y;
    render();
  }
  openDayModal(key);
});

// Échap ferme la modale ouverte.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!el.dayOverlay.classList.contains("hidden")) cancelDayModal();
  else if (!el.overlay.classList.contains("hidden")) closeSettings();
  else if (!el.syncOverlay.classList.contains("hidden")) closeSyncModal();
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

function numInput(cls, value, placeholder, max) {
  const i = document.createElement("input");
  i.type = "number";
  i.inputMode = "numeric";
  i.min = "0";
  if (max) i.max = String(max);
  i.className = cls;
  i.placeholder = placeholder;
  if (value > 0) i.value = value;
  return i;
}

function buildCatRow(cat) {
  const row = document.createElement("div");
  row.className = "cat-row";
  if (cat.id) row.dataset.id = cat.id;

  const main = document.createElement("div");
  main.className = "cat-row-main";

  const color = document.createElement("input");
  color.type = "color";
  color.value = cat.color;
  color.className = "cat-color";

  const label = document.createElement("input");
  label.type = "text";
  label.value = cat.label || "";
  label.placeholder = "Nom de la catégorie";
  label.className = "cat-label";
  label.maxLength = 24;

  const del = document.createElement("button");
  del.type = "button";
  del.className = "btn-del";
  del.textContent = "🗑";
  del.title = "Supprimer";
  del.addEventListener("click", () => row.remove());

  main.append(color, label, del);

  // Ligne "valeurs par défaut" (pré-remplies au choix de la catégorie).
  const defs = document.createElement("div");
  defs.className = "cat-row-defaults";
  const lbl = document.createElement("span");
  lbl.className = "cat-def-label";
  lbl.textContent = "Défauts :";
  const km = numInput("cat-defkm", cat.defKm, "0", 9999);
  const kmU = document.createElement("span");
  kmU.className = "cat-unit";
  kmU.textContent = "km";
  const defMin = cat.defMin || 0;
  const h = numInput("cat-defh", defMin ? Math.floor(defMin / 60) : 0, "0", 99);
  const hU = document.createElement("span");
  hU.className = "cat-unit";
  hU.textContent = "h";
  const m = numInput("cat-defmin", defMin ? defMin % 60 : 0, "0", 59);
  const mU = document.createElement("span");
  mU.className = "cat-unit";
  mU.textContent = "min";
  defs.append(lbl, km, kmU, h, hU, m, mU);

  row.append(main, defs);
  return row;
}

function renderCatEditor(cats) {
  const frag = document.createDocumentFragment();
  cats.forEach((cat) => frag.appendChild(buildCatRow(cat)));
  el.catEditor.replaceChildren(frag);
}

function addCatRow() {
  const palette = ["#ffd166", "#06d6a0", "#118ab2", "#ef476f", "#9b5de5", "#f15bb5"];
  const row = buildCatRow({ color: palette[el.catEditor.children.length % palette.length] });
  el.catEditor.appendChild(row);
  row.querySelector(".cat-label").focus();
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

    const cat = { id, label, color };
    const defKm = Number(row.querySelector(".cat-defkm").value) || 0;
    const defMin = (Number(row.querySelector(".cat-defh").value) || 0) * 60
      + (Number(row.querySelector(".cat-defmin").value) || 0);
    if (defKm > 0) cat.defKm = defKm;
    if (defMin > 0) cat.defMin = defMin;
    result.push(cat);
  }

  if (result.length === 0) {
    toast("Ajoute au moins une catégorie");
    return;
  }

  state.categories = result;
  saveCategories();

  // Nettoie la catégorie des jours dont elle n'existe plus (on garde la note
  // s'il y en a une ; le jour est supprimé s'il devient vide).
  let removed = 0;
  for (const [key, entry] of Object.entries(state.days)) {
    if (entry.cat && !usedIds.includes(entry.cat)) {
      delete entry.cat;
      if (!entry.note && entry.km === undefined) {
        delete state.days[key];
        state.tombstones[key] = nowMs();
      } else {
        entry.u = nowMs();
      }
      removed++;
    }
  }
  if (removed) {
    saveDays();
    saveTombstones();
  }

  scheduleSync();
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

/* --------------------------- Événements synchro --------------------------- */

el.syncBtn.addEventListener("click", openSyncModal);
el.closeSync.addEventListener("click", closeSyncModal);
el.syncOverlay.addEventListener("click", (e) => {
  if (e.target === el.syncOverlay) closeSyncModal();
});
el.syncConnect.addEventListener("click", connectSync);
el.syncNowBtn.addEventListener("click", () => syncNow());
el.syncDisconnect.addEventListener("click", disconnectSync);

/* --------------------------- Toast --------------------------- */

let toastTimer = null;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2200);
}

/* --------------------------- Synchronisation GitHub --------------------------- */
/*
 * Le localStorage reste la copie de travail (offline-first). GitHub sert de
 * sauvegarde + synchro multi-appareils : un fichier privé `bulletride.json`
 * dans un repo choisi par l'utilisateur, lu/écrit via l'API Contents avec un
 * token personnel stocké uniquement sur l'appareil.
 *
 * Fusion sans perte : chaque jour porte un horodatage `u` ; les suppressions
 * laissent une "tombstone" horodatée. À la fusion, pour chaque date on garde
 * l'événement le plus récent (écriture ou suppression). Les catégories sont
 * fusionnées en dernier-écrit-gagne via `catsU`.
 */

const DATA_PATH = "bulletride.json";

function b64EncodeUnicode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function b64DecodeUnicode(b64) {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

class GitHubStore {
  constructor(owner, repo, branch, token) {
    this.owner = owner;
    this.repo = repo;
    this.branch = branch || "main";
    this.token = token;
    this._shas = {};
  }

  _headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github+json",
    };
  }

  // Renvoie l'objet parsé, ou null si le fichier n'existe pas encore (404).
  async getFile(path) {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}?ref=${encodeURIComponent(this.branch)}`;
    const resp = await fetch(url, { headers: this._headers() });
    if (resp.status === 404) {
      delete this._shas[path];
      return null;
    }
    if (!resp.ok) {
      const err = new Error(`GitHub ${resp.status} (lecture ${path}) : ${(await resp.text()).slice(0, 160)}`);
      err.status = resp.status;
      throw err;
    }
    const data = await resp.json();
    this._shas[path] = data.sha;
    return JSON.parse(b64DecodeUnicode(data.content));
  }

  async putFile(path, obj, message) {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`;
    const content = b64EncodeUnicode(JSON.stringify(obj, null, 2) + "\n");
    const body = { message, content, branch: this.branch };
    if (this._shas[path]) body.sha = this._shas[path];
    const resp = await fetch(url, {
      method: "PUT",
      headers: { ...this._headers(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = new Error(`GitHub ${resp.status} (écriture ${path}) : ${(await resp.text()).slice(0, 160)}`);
      err.status = resp.status;
      throw err;
    }
    const data = await resp.json();
    this._shas[path] = data.content.sha;
  }
}

/* Fusion pure et testable de deux jeux de données. */
function computeMerge(local, remote) {
  const days = { ...(local.days || {}) };
  const tombstones = { ...(local.tombstones || {}) };
  let changed = false;

  const keys = new Set([
    ...Object.keys(local.days || {}),
    ...Object.keys(local.tombstones || {}),
    ...Object.keys(remote.days || {}),
    ...Object.keys(remote.tombstones || {}),
  ]);

  for (const k of keys) {
    const cands = [];
    if (local.days && local.days[k]) cands.push({ t: "e", u: local.days[k].u || 0, v: local.days[k] });
    if (remote.days && remote.days[k]) cands.push({ t: "e", u: remote.days[k].u || 0, v: remote.days[k] });
    if (local.tombstones && local.tombstones[k]) cands.push({ t: "d", u: local.tombstones[k] });
    if (remote.tombstones && remote.tombstones[k]) cands.push({ t: "d", u: remote.tombstones[k] });
    // le plus récent gagne ; à égalité, l'écriture l'emporte (préserve la donnée)
    cands.sort((a, b) => b.u - a.u || (a.t === "e" ? -1 : 1));
    const w = cands[0];
    if (w.t === "d") {
      if (days[k]) {
        delete days[k];
        changed = true;
      }
      if ((tombstones[k] || 0) !== w.u) {
        tombstones[k] = w.u;
        changed = true;
      }
    } else {
      if (tombstones[k]) {
        delete tombstones[k];
        changed = true;
      }
      if (JSON.stringify(days[k]) !== JSON.stringify(w.v)) {
        days[k] = w.v;
        changed = true;
      }
    }
  }

  // Catégories : dernier-écrit-gagne.
  let categories = local.categories;
  let catsU = local.catsU || 0;
  if ((remote.catsU || 0) > (local.catsU || 0) && Array.isArray(remote.categories) && remote.categories.length) {
    categories = remote.categories;
    catsU = remote.catsU;
    changed = true;
  }

  return { days, tombstones, categories, catsU, changed };
}

// Applique un fichier distant sur l'état local. Renvoie true si l'état a changé.
function applyRemote(remote) {
  const merged = computeMerge(
    { days: state.days, tombstones: state.tombstones, categories: state.categories, catsU: state.catsU },
    remote || {}
  );
  if (!merged.changed) return false;
  state.days = merged.days;
  state.tombstones = merged.tombstones;
  state.categories = merged.categories;
  state.catsU = merged.catsU;
  saveDays();
  saveTombstones();
  localStorage.setItem(STORAGE_CATS, JSON.stringify(state.categories));
  localStorage.setItem(STORAGE_CATS_U, String(state.catsU));
  return true;
}

function buildPayload() {
  return {
    version: 1,
    updatedAt: nowMs(),
    days: state.days,
    tombstones: state.tombstones,
    categories: state.categories,
    catsU: state.catsU,
  };
}

/* --- Config de synchro --- */
function getSyncConfig() {
  try {
    const c = JSON.parse(localStorage.getItem(STORAGE_SYNC));
    if (c && c.owner && c.repo && c.token) return { branch: "main", ...c };
  } catch {
    /* ignore */
  }
  return null;
}

function saveSyncConfig(cfg) {
  localStorage.setItem(STORAGE_SYNC, JSON.stringify(cfg));
}

function clearSyncConfig() {
  localStorage.removeItem(STORAGE_SYNC);
  localStorage.removeItem(STORAGE_LAST_SYNC);
}

/* --- Orchestration --- */
let syncing = false;
let syncTimer = null;

function isConflict(err) {
  return err && (err.status === 409 || err.status === 422);
}

function scheduleSync() {
  if (!getSyncConfig()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow({ silent: true }), 1500);
}

async function syncNow({ silent } = {}) {
  const cfg = getSyncConfig();
  if (!cfg || syncing) return;
  syncing = true;
  setSyncStatus("sync");
  try {
    const store = new GitHubStore(cfg.owner, cfg.repo, cfg.branch, cfg.token);
    for (let attempt = 0; attempt < 3; attempt++) {
      const remote = await store.getFile(DATA_PATH); // null si le fichier n'existe pas encore
      if (applyRemote(remote)) render();
      try {
        await store.putFile(DATA_PATH, buildPayload(), `BulletRide sync ${new Date().toISOString().slice(0, 19)}`);
        break;
      } catch (e) {
        if (isConflict(e) && attempt < 2) continue; // conflit : on re-tire puis on repousse
        throw e;
      }
    }
    const t = nowMs();
    localStorage.setItem(STORAGE_LAST_SYNC, String(t));
    setSyncStatus("ok", t);
    if (!silent) toast("Synchronisé ✓");
  } catch (e) {
    setSyncStatus("error", null, e.message);
    if (!silent) toast("Erreur de synchro");
    console.warn("Sync error:", e);
  } finally {
    syncing = false;
  }
}

/* --- UI de synchro --- */
function setSyncStatus(kind, ts, msg) {
  if (!el.syncStatus) return;
  el.syncBtn.classList.toggle("syncing", kind === "sync");
  el.syncBtn.classList.toggle("sync-on", !!getSyncConfig());
  if (kind === "sync") {
    el.syncStatus.textContent = "Synchronisation…";
    el.syncStatus.className = "sync-status busy";
  } else if (kind === "ok") {
    el.syncStatus.textContent = `À jour — dernière synchro à ${new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
    el.syncStatus.className = "sync-status ok";
  } else if (kind === "error") {
    el.syncStatus.textContent = `Erreur : ${msg || "synchro impossible"}`;
    el.syncStatus.className = "sync-status err";
  } else {
    el.syncStatus.textContent = "";
    el.syncStatus.className = "sync-status";
  }
}

function renderSyncModal() {
  const cfg = getSyncConfig();
  const connected = !!cfg;
  el.syncForm.classList.toggle("hidden", connected);
  el.syncConnected.classList.toggle("hidden", !connected);
  if (connected) {
    el.syncRepoLabel.textContent = `${cfg.owner}/${cfg.repo}`;
    const last = Number(localStorage.getItem(STORAGE_LAST_SYNC)) || 0;
    setSyncStatus(last ? "ok" : "idle", last);
  } else {
    // pré-remplit le propriétaire avec le compte connu, pratique
    if (!el.syncOwner.value) el.syncOwner.value = "christophem59";
    setSyncStatus("idle");
  }
}

function openSyncModal() {
  renderSyncModal();
  el.syncOverlay.classList.remove("hidden");
}

function closeSyncModal() {
  el.syncOverlay.classList.add("hidden");
}

async function connectSync() {
  const owner = el.syncOwner.value.trim();
  const repo = el.syncRepo.value.trim();
  const branch = el.syncBranch.value.trim() || "main";
  const token = el.syncToken.value.trim();
  if (!owner || !repo || !token) {
    toast("Renseigne propriétaire, repo et token");
    return;
  }
  // Vérifie l'accès avant d'enregistrer.
  setSyncStatus("sync");
  try {
    const store = new GitHubStore(owner, repo, branch, token);
    await store.getFile(DATA_PATH); // null si absent : accès OK quand même
    saveSyncConfig({ owner, repo, branch, token });
    el.syncToken.value = "";
    renderSyncModal();
    toast("Repo connecté");
    await syncNow(); // première synchro
    renderSyncModal();
  } catch (e) {
    setSyncStatus("error", null, e.message);
    toast("Connexion refusée");
  }
}

function disconnectSync() {
  clearSyncConfig();
  renderSyncModal();
  setSyncStatus("idle");
  toast("Synchro déconnectée");
}

/* --------------------------- Init --------------------------- */

render();

if (getSyncConfig()) {
  setSyncStatus("idle", Number(localStorage.getItem(STORAGE_LAST_SYNC)) || 0);
  syncNow({ silent: true });
}
window.addEventListener("online", () => scheduleSync());

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
