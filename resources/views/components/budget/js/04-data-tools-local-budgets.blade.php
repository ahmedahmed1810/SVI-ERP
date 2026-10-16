@verbatim/* =========================================================
   DONNEES CHS / BDS
   ========================================================= */

let db = {
  chs: [],
  projects: [],
  lots: [],
  primaries: [],
  secondaries: [],
  brd: []
};

let selection = {
  project: null,
  lot: null,
  primary: null,
  secondary: null
};

let rowContext = null;
let longPressTimer = null;

let brdCache = new Map();
let brdRequestId = 0;

/* =========================================================
   DONNEES BDG
   ========================================================= */

let bdgRows = [];
let bdgLoaded = false;
let bdgLoading = false;
let bdgGroups = new Map();
let currentAnalysis = "designation";

/* =========================================================
   OUTILS
   ========================================================= */

function normalise(v) {
  return String(v ?? "").trim();
}

function num(v) {
  const n = Number(
    String(v ?? 0)
      .replace(/\s/g, "")
      .replace(",", ".")
  );

  return Number.isFinite(n) ? n : 0;
}

function money(v) {
  return num(v).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function esc(v) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m])
  );
}

function unique(values) {
  return [
    ...new Set(
      values
        .map(v => String(v ?? "").trim())
        .filter(Boolean)
    )
  ];
}

function sum(rows, field) {
  return rows.reduce(
    (total, row) =>
      total + num(row[field]),
    0
  );
}

/* =========================================================
   BUDGETS EN INSTANCE : enregistrés dans IndexedDB (le stockage local de Safari
   est limité à ~5 Mo par site : les gros imports y étaient perdus sans message).
   Copie en mémoire (texte) lue au démarrage ; chaque enregistrement part vers
   IndexedDB ; un échec est signalé tout de suite. Reprise unique de l'ancien stockage.
   ========================================================= */
const SVI_INST_KEY = "svi_bdg_inst_v1";
let sviInstStr = "[]";
let sviInstTimer = null;
const sviIdb = () => new Promise((res, rej) => {
  const r = indexedDB.open("svi_store", 1);
  r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("kv")) r.result.createObjectStore("kv"); };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const sviIdbGet = k => sviIdb().then(db => new Promise((res, rej) => {
  const q = db.transaction("kv", "readonly").objectStore("kv").get(k);
  q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
}));
const sviIdbPut = (k, v) => sviIdb().then(db => new Promise((res, rej) => {
  const t = db.transaction("kv", "readwrite");
  t.objectStore("kv").put(v, k);
  t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
}));
const sviInstFlush = () => {
  clearTimeout(sviInstTimer); sviInstTimer = null;
  const v = sviInstStr;
  return sviIdbPut(SVI_INST_KEY, v).then(() => {
    /* l'ancien stockage (limité) est libéré une fois la copie faite */
    try { if (localStorage.getItem(SVI_INST_KEY) !== null) localStorage.removeItem(SVI_INST_KEY); } catch (e) {}
  }).catch(e => {
    if (typeof svToast === "function") svToast("ENREGISTREMENT IMPOSSIBLE SUR L'APPAREIL : " + ((e && e.message) || e) + ". NE FERMEZ PAS L'APPLICATION.", 8000);
  });
};
const sviInstGet = () => { try { return JSON.parse(sviInstStr || "[]") || []; } catch (e) { return []; } };
const sviInstSet = l => {
  sviInstStr = JSON.stringify(l || []);
  clearTimeout(sviInstTimer);
  sviInstTimer = setTimeout(sviInstFlush, 300);
};
/* lu au démarrage : IndexedDB, sinon l'ancien stockage local (reprise) */
const SVI_INST_READY = sviIdbGet(SVI_INST_KEY).then(v => {
  if (typeof v === "string") { sviInstStr = v; return; }
  let old = null;
  try { old = localStorage.getItem(SVI_INST_KEY); } catch (e) {}
  if (old) { sviInstStr = old; return sviInstFlush(); }
}).catch(() => { try { sviInstStr = localStorage.getItem(SVI_INST_KEY) || "[]"; } catch (e) {} });
/* l'app passe en arrière-plan : on écrit tout de suite */
document.addEventListener("visibilitychange", () => { if (document.hidden && sviInstTimer) sviInstFlush(); });
window.addEventListener("pagehide", () => { if (sviInstTimer) sviInstFlush(); });

@endverbatim