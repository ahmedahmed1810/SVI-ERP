const API_URL = "https://script.google.com/macros/s/AKfycbzFgUloyiRJe-QmR7nRqJ4bfWqvfA_6LSgotJRrRt87yeRfWtdY7nxXMR9avafSJUPg4Q/exec";
const API_KEY = "nZYYROPFeFXBims8v4NCPcbXG8Nl";

/* fichiers volumineux (PDF, documents) gardés sur l'appareil dans IndexedDB */
const sviFiles = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((ok, ko) => {
    const r = indexedDB.open("svi_files", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("f");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  }));
  const tx = async (mode, fn) => {
    const db = await open();
    return new Promise((ok, ko) => {
      const t = db.transaction("f", mode);
      const req = fn(t.objectStore("f"));
      t.oncomplete = () => ok(req && req.result);
      t.onerror = () => ko(t.error);
    });
  };
  return {
    put: (k, blob) => tx("readwrite", st => st.put(blob, k)),
    get: k => tx("readonly", st => st.get(k))
  };
})();

/* observations importantes d'un budget (marquées « ! ») */
function obsAlertCount(ref) {
  try {
    const l = JSON.parse(localStorage.getItem("svi_obs_v1:" + String(ref)) || "[]") || [];
    return l.filter(r => r.important).length;
  } catch (e) { return 0; }
}
function obsBang(ref) {
  return obsAlertCount(ref)
    ? `<b class="obs-bang" title="Observation importante">!</b> `
    : "";
}

/* alertes sur une ligne : flèche ▾ si le texte dépasse, toucher pour le lire en entier */
function obsAlertWire(p) {
  const mark = () => p.querySelectorAll(".obs-alert-item").forEach(it => {
    const t = it.querySelector(".obs-alert-text");
    if (!it.classList.contains("open"))
      it.classList.toggle("can-exp", t.scrollWidth > t.clientWidth + 1 || /\n/.test(t.textContent));
  });
  requestAnimationFrame(mark);
  window.addEventListener("resize", mark);
  p.addEventListener("click", e => {
    const it = e.target.closest(".obs-alert-item.can-exp");
    if (it) it.classList.toggle("open");
  });
}

/* lecture des observations importantes d'un budget sans ouvrir son détail */
function openObsAlertFor(ref, project) {
  let list = [];
  try { list = JSON.parse(localStorage.getItem("svi_obs_v1:" + String(ref)) || "[]") || []; } catch (e) {}
  list = list.filter(r => r.important)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const p2 = n => String(n).padStart(2, "0");
  const fmt = v => {
    const d = new Date(v);
    return isNaN(d) ? String(v || "")
      : `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} À ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  };
  document.getElementById("docPop")?.remove();
  const p = document.createElement("div");
  p.id = "docPop";
  p.innerHTML = `
    <div class="doc-card" role="dialog" aria-modal="true">
      <div class="doc-head">
        <span class="doc-title">OBSERVATIONS IMPORTANTES — ${esc((project ? project + " " : "") + ref)} ${svCnt(list.length)}</span>
        <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
      </div>
      <div class="doc-body">
        <div class="obs-alert-list">
          ${list.map(r => `
            <div class="obs-alert-item">
              <span class="obs-alert-meta">⚠ ${esc(r.ref)} — ${esc(fmt(r.date))}</span>
              <span class="obs-alert-text">${esc(r.text)}</span><span class="obs-alert-more">▾</span>
            </div>`).join("") || `<div class="obs-alert-text">Aucune observation importante.</div>`}
        </div>
      </div>
      <div class="doc-foot">
        <button type="button" class="doc-btn doc-save" data-cancel>FERMER</button>
      </div>
    </div>`;
  document.body.appendChild(p);
  obsAlertWire(p);
  p.addEventListener("click", e => {
    if (e.target === p || e.target.closest("[data-cancel]")) p.remove();
  });
}


/* logo de la société (impressions) */
const SVI_LOGO = "data:image/png;base64,";

/* cachet et signature de la société (impression, sur demande) */
const SVI_STAMP = "data:image/png;base64,";

/* signature provisoire (tirée du modèle), en attendant celle fournie */
const SVI_SIGN = "data:image/png;base64,";

/* nombre en toutes lettres (français, majuscules) */
function frWords(n) {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "ZÉRO";
  const U = ["", "UN", "DEUX", "TROIS", "QUATRE", "CINQ", "SIX", "SEPT", "HUIT", "NEUF", "DIX",
    "ONZE", "DOUZE", "TREIZE", "QUATORZE", "QUINZE", "SEIZE", "DIX-SEPT", "DIX-HUIT", "DIX-NEUF"];
  const T = ["", "", "VINGT", "TRENTE", "QUARANTE", "CINQUANTE", "SOIXANTE"];
  const below100 = (x, final) => {
    if (x < 20) return U[x];
    const t = Math.floor(x / 10), u = x % 10;
    if (t === 7 || t === 9) {
      const base = t === 7 ? "SOIXANTE" : "QUATRE-VINGT";
      const r = 10 + u;
      return base + (t === 7 && u === 1 ? " ET " : "-") + U[r];
    }
    if (t === 8) return u === 0 ? (final ? "QUATRE-VINGTS" : "QUATRE-VINGT") : "QUATRE-VINGT-" + U[u];
    if (u === 0) return T[t];
    if (u === 1) return T[t] + " ET UN";
    return T[t] + "-" + U[u];
  };
  const below1000 = (x, final) => {
    const c = Math.floor(x / 100), r = x % 100;
    let out = "";
    if (c === 1) out = "CENT";
    else if (c > 1) out = U[c] + " CENT" + (r === 0 && final ? "S" : "");
    if (r) out += (out ? " " : "") + below100(r, final);
    return out;
  };
  const parts = [];
  const mds = Math.floor(n / 1e9), mns = Math.floor(n / 1e6) % 1000,
    mil = Math.floor(n / 1000) % 1000, rest = n % 1000;
  if (mds) parts.push(below1000(mds, true) + " MILLIARD" + (mds > 1 ? "S" : ""));
  if (mns) parts.push(below1000(mns, true) + " MILLION" + (mns > 1 ? "S" : ""));
  if (mil) parts.push(mil === 1 ? "MILLE" : below1000(mil, false) + " MILLE");
  if (rest) parts.push(below1000(rest, true));
  return parts.join(" ");
}
/* montant en lettres : « … DIRHAMS ET … CENTIMES » */
function frMoney(v) {
  const c = Math.round(Math.abs(v) * 100);
  const d = Math.floor(c / 100), ct = c % 100;
  let s = frWords(d) + (d >= 1e6 && d % 1e6 === 0 ? " DE" : "") + " DIRHAM" + (d > 1 ? "S" : "");
  if (ct) s += " ET " + frWords(ct) + " CENTIME" + (ct > 1 ? "S" : "");
  return s;
}

/* icônes de contenu (traits fins, couleur du texte) */
const SVI_ICON = (() => {
  const w = d => `<svg class="ico" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  return {
    doc: w('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'),
    taf: w('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 12l2 2 4-4"/>'),
    obs: w('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14h4"/>'),
    inf: w('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
    client: w('<path d="M3 7h18M3 12h18M3 17h12"/><circle cx="19" cy="17" r="2"/>'),
    hier: w('<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/>'),
    chg: w('<circle cx="12" cy="12" r="9"/><path d="M12 7v10M8 13l4 4 4-4"/>'),
    prd: w('<circle cx="12" cy="12" r="9"/><path d="M12 17V7M8 11l4-4 4 4"/>'),
    qlt: w('<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'),
    dly: w('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>')
  };
})();

/* toute saisie est enregistrée en MAJUSCULES, même tapée en minuscules
   (le curseur reste à sa place) */
document.addEventListener("input", e => {
  const el = e.target;
  if (e.isComposing || !el || el.dataset?.keepcase !== undefined) return;
  const ok = el.tagName === "TEXTAREA" ||
    (el.tagName === "INPUT" && ["text", "search", ""].includes(el.type || ""));
  if (!ok) return;
  const up = el.value.toUpperCase();
  if (up === el.value) return;
  const a = el.selectionStart, b = el.selectionEnd;
  el.value = up;
  try { el.setSelectionRange(a, b); } catch (err) {}
}, true);

const $ = id => document.getElementById(id);

/* compteur : petite pastille grise juste après le libellé (remplace « (n) ») */
const svCnt = n => `<span class="svi-cnt">${Number(n) || 0}</span>`;

/* =========================================================
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
   API GET CHS / BDS
   ========================================================= */

async function apiGet(action = "bootstrap", params = {}) {
  const query = {
    key: API_KEY,
    action,
    ...params,
    _: Date.now()
  };

  const url =
    API_URL +
    "?" +
    Object.entries(query)
      .map(
        ([k, v]) =>
          encodeURIComponent(k) +
          "=" +
          encodeURIComponent(v)
      )
      .join("&");

  const r = await fetch(url, {
    method: "GET",
    cache: "no-store"
  });

  const data = await r.json();

  if (!data.ok) {
    throw new Error(
      data.error || "ERREUR API"
    );
  }

  return data;
}

/* =========================================================
   API GET BDG
   L'API HISTORIQUE UTILISE L'ABSENCE D'ACTION
   ========================================================= */

async function apiGetBDG() {
  const attempts = [
    { action: "getBDG" },
    { action: "bdg" },
    { action: "bootstrapBDG" },
    {}
  ];

  let lastError = null;

  for (const params of attempts) {
    try {
      const query = {
        key: API_KEY,
        ...params,
        _: Date.now()
      };

      const url =
        API_URL +
        "?" +
        Object.entries(query)
          .map(([k, v]) =>
            encodeURIComponent(k) +
            "=" +
            encodeURIComponent(v)
          )
          .join("&");

      const r = await fetch(url, {
        method: "GET",
        cache: "no-store",
        redirect: "follow"
      });

      if (!r.ok) {
        lastError = new Error(
          "ERREUR HTTP " + r.status
        );
        continue;
      }

      const text = await r.text();

      let data;

      try {
        data = JSON.parse(text);
      } catch (e) {
        lastError = new Error(
          "RÉPONSE BDG NON JSON"
        );
        continue;
      }

      if (data && data.ok === false) {
        lastError = new Error(
          data.error || "ERREUR API BDG"
        );
        continue;
      }

      if (
        data &&
        Array.isArray(data.rows)
      ) {
        return data;
      }

      if (
        data &&
        data.data &&
        Array.isArray(data.data.rows)
      ) {
        return {
          ok: true,
          rows: data.data.rows
        };
      }

      lastError = new Error(
        "FORMAT BDG NON RECONNU"
      );

    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ||
    new Error("IMPOSSIBLE DE CHARGER BDG");
}
/* =========================================================
   API POST
   ========================================================= */

async function apiPost(action, data = {}) {
  const r = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      key: API_KEY,
      action,
      ...data
    })
  });

  const out = await r.json();

  if (!out.ok) {
    throw new Error(
      out.error || "ERREUR API"
    );
  }

  return out;
}

/* =========================================================
   GOOGLE DRIVE : ENREGISTREMENT DES FICHIERS (via Code.gs)
   ========================================================= */

const DRIVE_PATHS_KEY = "svi_drivepaths_v1";

/* un lien Google (https://…) n'est jamais gardé : on garde le chemin court */
const driveIsLink = p => /^https?:|:\/\//i.test(String(p || ""));

function drivePaths() {
  try {
    return (JSON.parse(localStorage.getItem(DRIVE_PATHS_KEY) || "[]") || []).filter(x => x && !driveIsLink(x));
  } catch (e) { return []; }
}

function drivePathAdd(path) {
  if (!path || driveIsLink(path)) return;
  try {
    const rec = drivePaths().filter(x => x !== path);
    rec.unshift(path);
    localStorage.setItem(DRIVE_PATHS_KEY, JSON.stringify(rec.slice(0, 12)));
  } catch (e) {}
}

/* chemin proposé : SVI ERP/<PROJET>/BUDGETS/BDG 26-1001-001 */
function driveDefaultPath(project, fullRef) {
  return "SVI ERP/" + String(project || "PROJET").trim().toUpperCase() + "/BUDGETS/" +
    String(fullRef || "").replace(/^.*?BDG\s*/i, "BDG ").replace(/[\\/:*?"<>|]+/g, "-").trim();
}

/* dossier proposé : le dernier utilisé, sinon celui du budget */
function driveLastPath(project, fullRef) {
  return drivePaths()[0] || driveDefaultPath(project, fullRef);
}

/* lien collé : gardé tel quel (le script retrouve le dossier) ;
   chemin tapé : nettoyé et mis en majuscules */
function driveCleanPath(p) {
  const s = String(p || "").trim();
  if (driveIsLink(s)) return s;
  return s.replace(/^\/+|\/+$/g, "").replace(/\s*\/\s*/g, "/").toUpperCase();
}

/* ligne DOSSIER DRIVE (libellé + champ) affichée ou masquée */
function drivePathRow(root, sel, on) {
  const inp = root.querySelector(sel);
  if (!inp) return;
  const box = inp.closest(".fld-wrap") || inp;
  const lab = root.querySelector(`label[for="${inp.id}"]`);
  box.hidden = !on; box.style.display = on ? "" : "none";
  if (lab) { lab.hidden = !on; lab.style.display = on ? "" : "none"; }
}

/* lien d'ouverture de chaque dossier Drive déjà utilisé */
const DRIVE_URLS_KEY = "svi_driveurls_v1";
function driveUrlGet(path) {
  try { return (JSON.parse(localStorage.getItem(DRIVE_URLS_KEY) || "{}") || {})[path] || ""; }
  catch (e) { return ""; }
}
function driveUrlSet(path, url) {
  if (!path || !url) return;
  try {
    const m = JSON.parse(localStorage.getItem(DRIVE_URLS_KEY) || "{}") || {};
    m[path] = url;
    localStorage.setItem(DRIVE_URLS_KEY, JSON.stringify(m));
  } catch (e) {}
}

/* ouvre un lien Google (dossier, fichier, feuille) :
   sur iPad / iPhone, d'abord dans l'app Drive (ou Sheets) si elle est installée,
   sinon dans le navigateur. « w » : onglet ouvert pendant le toucher. */
function openGoogleLink(url, w) {
  const ios = /iP(ad|hone|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!ios) {
    if (w) w.location.href = url; else window.open(url, "_blank");
    return;
  }
  const app = /docs\.google\.com\/spreadsheets/.test(url) ? "googlesheets://" : "googledrive://";
  let left = false;
  const away = () => { if (document.hidden) left = true; };
  document.addEventListener("visibilitychange", away);
  window.addEventListener("pagehide", away);
  try {
    if (w) w.location.href = app + url; else location.href = app + url;
  } catch (e) {}
  /* l'app ne s'est pas ouverte : on bascule sur le navigateur */
  setTimeout(() => {
    document.removeEventListener("visibilitychange", away);
    window.removeEventListener("pagehide", away);
    if (left) { try { w && w.close(); } catch (e) {} return; }
    if (w && !w.closed) w.location.href = url; else window.open(url, "_blank");
  }, 1800);
}
window.__sviOpenGoogle = openGoogleLink;

/* lien d'ouverture d'un dossier (mémorisé, sinon demandé au script) */
async function driveFolderUrl(path) {
  let url = driveIsLink(path) ? "" : driveUrlGet(path);
  if (!url) {
    const out = await apiPost("drivePath", { path: driveCleanPath(path) });
    url = out.folderUrl || "";
    if (out.path) driveUrlSet(out.path, url);
  }
  if (!url) throw new Error("DOSSIER INTROUVABLE");
  return url;
}
window.__sviDriveFolderUrl = driveFolderUrl;
window.__sviDriveErr = e => driveErrText(e);

/* ouvre le dossier dans le Drive (onglet ouvert dans le geste, pour Safari) */
async function driveOpenFolder(path) {
  const w = window.open("", "_blank");
  try {
    const url = await driveFolderUrl(path);
    openGoogleLink(url, w);
  } catch (e) {
    if (w) w.close();
    alert("OUVERTURE DU DOSSIER IMPOSSIBLE : " + driveErrText(e));
  }
}

/* fenêtre « DOSSIER DRIVE » devant la fenêtre en cours :
   adresse en lien (ouvre le Drive), ✎ pour la changer (copier-coller) */
function drivePickFolder(path, onSave, okLabel = "ENREGISTRER") {
  document.getElementById("drvPop")?.remove();
  const p = document.createElement("div");
  p.id = "drvPop";
  const escH = v => String(v ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  p.innerHTML = `
    <div class="dp-card" role="dialog" aria-modal="true">
      <div class="dp-head"><span>DOSSIER DRIVE</span><button type="button" class="dp-x" data-cancel aria-label="Fermer">✕</button></div>
      <div class="dp-body">
        <div class="dp-row" id="dpView">
          <a href="#" class="dp-link" id="dpLink">${escH(path)}</a>
          <button type="button" class="dp-edit" id="dpEdit" title="Changer de dossier">✎</button>
        </div>
        <input type="text" class="dp-in" id="dpIn" data-keepcase autocomplete="off" value="${escH(path)}" hidden>
      </div>
      <div class="dp-foot">
        <button type="button" class="dp-btn" data-cancel>ANNULER</button>
        <button type="button" class="dp-btn dp-ok" id="dpOk">${escH(okLabel)}</button>
      </div>
    </div>`;
  document.body.appendChild(p);
  const inp = p.querySelector("#dpIn"), link = p.querySelector("#dpLink"), view = p.querySelector("#dpView");
  const cur = () => inp.hidden ? link.textContent : inp.value.trim();
  const showLink = () => {
    const v = inp.value.trim();
    if (!v) return;
    link.textContent = v;
    inp.hidden = true; view.hidden = false;
  };
  link.onclick = e => { e.preventDefault(); driveOpenFolder(cur()); };
  p.querySelector("#dpEdit").onclick = () => {
    view.hidden = true; inp.hidden = false; inp.focus(); inp.select();
  };
  inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); showLink(); } });
  inp.addEventListener("blur", showLink);
  p.addEventListener("click", e => {
    if (e.target === p || e.target.closest("[data-cancel]")) p.remove();
  });
  p.querySelector("#dpOk").onclick = () => {
    const v = driveCleanPath(cur());
    p.remove();
    onSave(v);
  };
}

function blobToB64(blob) {
  return new Promise((ok, ko) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result).split(",")[1] || "");
    fr.onerror = () => ko(fr.error);
    fr.readAsDataURL(blob);
  });
}

/* envoie le fichier au script Google, qui le range dans le dossier
   (créé si besoin) ; renvoie { url, id } */
async function driveSave(blob, name, path) {
  const data = await blobToB64(blob);
  const out = await apiPost("saveFile", {
    name, path: driveCleanPath(path), mime: blob.type || "application/octet-stream", data
  });
  /* chemin court renvoyé par le script (lien collé converti en A/B/C) */
  out.path = out.path || driveCleanPath(path);
  drivePathAdd(out.path);
  driveUrlSet(out.path, out.folderUrl);
  return out;
}
window.__sviDriveSave = driveSave;

function driveErrText(e) {
  const m = String(e && e.message || e);
  return /action|inconnu|unknown|non reconnu|JSON/i.test(m)
    ? "Le script Google n'a pas encore la fonction d'enregistrement : ajoute exportSheet.gs dans Code.gs puis redéploie. (" + m + ")"
    : m;
}

/* =========================================================
   BOOTSTRAP CHS / BDS
   ========================================================= */

function mapBootstrap(data) {
  db.chs = (data.chs || []).map(x => ({
    id: x.ID,
    article: x.ARTICLE,
    designation: x.DESIGNATION,
    unit: x.UNITE,
    pcs: num(x.PCS)
  }));

  const all = data.bds || [];

  db.projects = all
    .filter(
      x =>
        String(x.TYPE || "")
          .trim()
          .toUpperCase() === "PROJECT"
    )
    .map(x => ({
      id: x.ID,
      code: x.CODE,
      name: x.NOM,
      order: num(x.ORDRE)
    }));

  db.lots = all
    .filter(
      x =>
        String(x.TYPE || "")
          .trim()
          .toUpperCase() === "LOT"
    )
    .map(x => ({
      id: x.ID,
      projectId: x.PARENT_ID,
      code: x.CODE,
      name: x.NOM,
      order: num(x.ORDRE)
    }));

  db.primaries = all
    .filter(
      x =>
        String(x.TYPE || "")
          .trim()
          .toUpperCase() === "PRIMARY"
    )
    .map(x => ({
      id: x.ID,
      lotId: x.PARENT_ID,
      code: x.CODE,
      name: x.NOM,
      order: num(x.ORDRE)
    }));

  db.secondaries = all
    .filter(
      x =>
        String(x.TYPE || "")
          .trim()
          .toUpperCase() === "SECONDARY"
    )
    .map(x => ({
      id: x.ID,
      primaryId: x.PARENT_ID,
      code: x.CODE,
      name: x.NOM,
      order: num(x.ORDRE)
    }));

  db.brd = [];
  brdCache.clear();
}

async function reloadAll() {
  try {
    const data =
      await apiGet("bootstrap");

    mapBootstrap(data);

    renderChs();
    renderHierarchy();

  } catch (e) {
    alert(
      "CONNEXION GOOGLE SHEETS IMPOSSIBLE : " +
      e.message
    );
  }
}

/* =========================================================
   BRD A LA DEMANDE
   ========================================================= */

async function loadBrdForSecondary(secondaryId) {
  if (!secondaryId) {
    db.brd = [];
    renderBrd();
    return;
  }

  if (brdCache.has(secondaryId)) {
    db.brd =
      brdCache.get(secondaryId);

    renderBrd();
    return;
  }

  const requestId =
    ++brdRequestId;

  db.brd = [];

  $("brdCount").textContent =
    "CHARGEMENT...";

  $("brdTable")
    .querySelector("tbody")
    .innerHTML = `
      <tr>
        <td colspan="6" class="empty">
          CHARGEMENT DU BORDEREAU...
        </td>
      </tr>
    `;

  $("brdTotal").textContent =
    "0,00";

  const data =
    await apiGet(
      "brd",
      { secondaryId }
    );

  if (
    requestId !== brdRequestId ||
    selection.secondary !== secondaryId
  ) {
    return;
  }

  const rows =
    (data.brd || []).map(x => ({
      id: x.ID,
      secondaryId:
        x.TACHE_SECONDAIRE_ID,
      article:
        x.ARTICLE,
      designation:
        x.DESIGNATION,
      unit:
        x.UNITE,
      qty:
        num(x.QUANTITE),
      price:
        num(x.PRIX)
    }));

  brdCache.set(
    secondaryId,
    rows
  );

  db.brd = rows;

  renderBrd();
}

/* =========================================================
   MISES A JOUR LOCALES
   ========================================================= */

function upsertLocalCHS(x) {
  const item = {
    id: x.ID,
    article: x.ARTICLE,
    designation: x.DESIGNATION,
    unit: x.UNITE,
    pcs: num(x.PCS)
  };

  const i =
    db.chs.findIndex(
      r => r.id === item.id
    );

  if (i >= 0) {
    db.chs[i] = item;
  } else {
    db.chs.push(item);
  }
}

function upsertLocalBDS(x) {
  const type =
    String(x.TYPE || "")
      .trim()
      .toUpperCase();

  let arrName = "";
  let item = null;

  if (type === "PROJECT") {
    arrName = "projects";

    item = {
      id: x.ID,
      code: x.CODE,
      name: x.NOM,
      order: num(x.ORDRE)
    };

  } else if (type === "LOT") {
    arrName = "lots";

    item = {
      id: x.ID,
      projectId: x.PARENT_ID,
      code: x.CODE,
      name: x.NOM,
      order: num(x.ORDRE)
    };

  } else if (type === "PRIMARY") {
    arrName = "primaries";

    item = {
      id: x.ID,
      lotId: x.PARENT_ID,
      code: x.CODE,
      name: x.NOM,
      order: num(x.ORDRE)
    };

  } else if (type === "SECONDARY") {
    arrName = "secondaries";

    item = {
      id: x.ID,
      primaryId: x.PARENT_ID,
      code: x.CODE,
      name: x.NOM,
      order: num(x.ORDRE)
    };
  }

  if (!arrName || !item) {
    return;
  }

  const arr = db[arrName];

  const i =
    arr.findIndex(
      r => r.id === item.id
    );

  if (i >= 0) {
    arr[i] = item;
  } else {
    arr.push(item);
  }
}

function upsertLocalBRD(x) {
  const item = {
    id: x.ID,
    secondaryId:
      x.TACHE_SECONDAIRE_ID,
    article:
      x.ARTICLE,
    designation:
      x.DESIGNATION,
    unit:
      x.UNITE,
    qty:
      num(x.QUANTITE),
    price:
      num(x.PRIX)
  };

  const i =
    db.brd.findIndex(
      r => r.id === item.id
    );

  if (i >= 0) {
    db.brd[i] = item;
  } else {
    db.brd.push(item);
  }

  if (item.secondaryId) {
    brdCache.set(
      item.secondaryId,
      [...db.brd]
    );
  }
}

/* =========================================================
   SUPPRESSION LOCALE BDS
   ========================================================= */

function removeLocalBDS(type, id) {
  if (type === "project") {
    const lotIds =
      db.lots
        .filter(
          x => x.projectId === id
        )
        .map(x => x.id);

    const primaryIds =
      db.primaries
        .filter(
          x =>
            lotIds.includes(
              x.lotId
            )
        )
        .map(x => x.id);

    const secondaryIds =
      db.secondaries
        .filter(
          x =>
            primaryIds.includes(
              x.primaryId
            )
        )
        .map(x => x.id);

    secondaryIds.forEach(
      sid =>
        brdCache.delete(sid)
    );

    db.brd =
      db.brd.filter(
        x =>
          !secondaryIds.includes(
            x.secondaryId
          )
      );

    db.secondaries =
      db.secondaries.filter(
        x =>
          !secondaryIds.includes(
            x.id
          )
      );

    db.primaries =
      db.primaries.filter(
        x =>
          !primaryIds.includes(
            x.id
          )
      );

    db.lots =
      db.lots.filter(
        x =>
          !lotIds.includes(
            x.id
          )
      );

    db.projects =
      db.projects.filter(
        x => x.id !== id
      );

    selection = {
      project: null,
      lot: null,
      primary: null,
      secondary: null
    };

    return;
  }

  if (type === "lot") {
    const primaryIds =
      db.primaries
        .filter(
          x => x.lotId === id
        )
        .map(x => x.id);

    const secondaryIds =
      db.secondaries
        .filter(
          x =>
            primaryIds.includes(
              x.primaryId
            )
        )
        .map(x => x.id);

    secondaryIds.forEach(
      sid =>
        brdCache.delete(sid)
    );

    db.brd =
      db.brd.filter(
        x =>
          !secondaryIds.includes(
            x.secondaryId
          )
      );

    db.secondaries =
      db.secondaries.filter(
        x =>
          !secondaryIds.includes(
            x.id
          )
      );

    db.primaries =
      db.primaries.filter(
        x =>
          !primaryIds.includes(
            x.id
          )
      );

    db.lots =
      db.lots.filter(
        x => x.id !== id
      );

    if (selection.lot === id) {
      selection.lot = null;
      selection.primary = null;
      selection.secondary = null;
    }

    return;
  }

  if (type === "primary") {
    const secondaryIds =
      db.secondaries
        .filter(
          x => x.primaryId === id
        )
        .map(x => x.id);

    secondaryIds.forEach(
      sid =>
        brdCache.delete(sid)
    );

    db.brd =
      db.brd.filter(
        x =>
          !secondaryIds.includes(
            x.secondaryId
          )
      );

    db.secondaries =
      db.secondaries.filter(
        x =>
          !secondaryIds.includes(
            x.id
          )
      );

    db.primaries =
      db.primaries.filter(
        x => x.id !== id
      );

    if (
      selection.primary === id
    ) {
      selection.primary = null;
      selection.secondary = null;
    }

    return;
  }

  if (type === "secondary") {
    brdCache.delete(id);

    db.brd =
      db.brd.filter(
        x =>
          x.secondaryId !== id
      );

    db.secondaries =
      db.secondaries.filter(
        x => x.id !== id
      );

    if (
      selection.secondary === id
    ) {
      selection.secondary = null;
    }
  }
}

/* =========================================================
   NAVIGATION
   ========================================================= */

function initNav() {
  document
    .querySelectorAll(".nav-btn")
    .forEach(btn => {

      btn.addEventListener(
        "click",
        async () => {

          document
            .querySelectorAll(".nav-btn")
            .forEach(
              x =>
                x.classList.remove(
                  "active"
                )
            );

          document
            .querySelectorAll(".view")
            .forEach(
              x =>
                x.classList.remove(
                  "active-view"
                )
            );

          btn.classList.add(
            "active"
          );
          /* dernier module ouvert, retrouvé à la prochaine ouverture */
          try { localStorage.setItem("svi_view_v1", btn.dataset.view || ""); } catch (e) {}

          const view =
            $(btn.dataset.view);

          if (view) {
            view.classList.add(
              "active-view"
            );
          }

          $("pageSubtitle").textContent =
            btn.dataset.view === "chs"
              ? "VERSION 2 — CHARGES STANDARDS"
              : btn.dataset.view === "bds"
                ? "VERSION 2 — DÉCOMPOSITION"
                : "VERSION 2 — BUDGET";

          if (
            btn.dataset.view === "bdg"
          ) {
            await ensureBDGLoaded();
          }
        }
      );
    });
}

/* =========================================================
   CHS
   ========================================================= */

function renderChs() {
  const q =
    normalise(
      $("chsSearch").value
    ).toUpperCase();

  const rows =
    db.chs.filter(
      r =>
        [
          r.article,
          r.designation,
          r.unit
        ]
          .join(" ")
          .toUpperCase()
          .includes(q)
    );

  $("chsCount").textContent =
    `${rows.length} CHARGE${
      rows.length > 1
        ? "S"
        : ""
    }`;

  $("chsTable")
    .querySelector("tbody")
    .innerHTML =
      rows.length
        ? rows.map(
            r => `
              <tr
                class="data-row"
                data-type="chs"
                data-id="${esc(r.id)}"
              >
                <td>
                  ${esc(r.article)}
                </td>

                <td>
                  ${esc(r.designation)}
                </td>

                <td>
                  ${esc(r.unit)}
                </td>

                <td class="number yellow">
                  ${money(r.pcs)}
                </td>
              </tr>
            `
          ).join("")
        : `
          <tr>
            <td
              colspan="4"
              class="empty"
            >
              AUCUNE CHARGE STANDARD
            </td>
          </tr>
        `;

  bindRows();
}

function chsForm(
  item = null,
  duplicate = false
) {
  openForm(
    item && !duplicate
      ? "MODIFIER CHARGE STANDARD"
      : "AJOUTER CHARGE STANDARD",

    [
      f(
        "article",
        "ARTICLE",
        duplicate
          ? `${item.article}-COPIE`
          : item?.article || ""
      ),

      f(
        "designation",
        "DÉSIGNATION",
        item?.designation || "",
        "text",
        true
      ),

      f(
        "unit",
        "UNITÉ",
        item?.unit || ""
      ),

      f(
        "pcs",
        "PCS",
        item?.pcs ?? "",
        "number"
      )
    ],

    async values => {
      const out =
        await apiPost(
          "saveCHS",
          {
            data: {
              ID:
                item && !duplicate
                  ? item.id
                  : "",

              ARTICLE:
                values.article,

              DESIGNATION:
                values.designation,

              UNITE:
                values.unit,

              PCS:
                values.pcs
            }
          }
        );

      upsertLocalCHS(
        out.data
      );

      renderChs();
    }
  );
}

/* =========================================================
   CONFIGURATION BDS
   ========================================================= */

const cfg = {
  project: {
    arr: "projects",
    list: "projectList",
    parent: null,
    title: "PROJET",
    type: "PROJECT"
  },

  lot: {
    arr: "lots",
    list: "lotList",
    parent: "project",
    fk: "projectId",
    title: "LOT",
    type: "LOT"
  },

  primary: {
    arr: "primaries",
    list: "primaryList",
    parent: "lot",
    fk: "lotId",
    title: "ACTIVITÉ PRIMAIRE",
    type: "PRIMARY"
  },

  secondary: {
    arr: "secondaries",
    list: "secondaryList",
    parent: "primary",
    fk: "primaryId",
    title: "ACTIVITÉ SECONDAIRE",
    type: "SECONDARY"
  }
};

function rowsFor(type) {
  const c =
    cfg[type];

  let rows =
    db[c.arr];

  if (c.parent) {
    rows =
      rows.filter(
        r =>
          r[c.fk] ===
          selection[c.parent]
      );
  }

  const search =
    document.querySelector(
      `[data-search="${type}"]`
    );

  const q =
    normalise(
      search?.value
    ).toUpperCase();

  if (q) {
    rows =
      rows.filter(
        r =>
          `${r.code} ${r.name}`
            .toUpperCase()
            .includes(q)
      );
  }

  return [...rows].sort(
    (a, b) =>
      (a.order || 0) -
        (b.order || 0) ||
      String(a.name || "")
        .localeCompare(
          String(b.name || ""),
          "fr"
        )
  );
}

/* retire le préfixe d'ordre "00 - " (5 caractères) des libellés
   de lots / tâches ; libellé inchangé s'il n'a pas ce préfixe */
function stripLevelPrefix(v) {
  const s = String(v ?? "");
  return s.replace(/^\s*\d{1,3}\s*[-–]\s*/, "");
}

/* fiche en lecture seule au double-clic : code, nom, ordre */
const levelTap = { type: "", id: "", at: 0 };

function showLevelInfo(type, id) {
  const item = getBy(type, id);
  if (!item) return;

  document.getElementById("levelInfoPop")?.remove();

  const pop = document.createElement("div");
  pop.id = "levelInfoPop";
  pop.style.cssText =
    "position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.35);" +
    "display:flex;align-items:center;justify-content:center;padding:16px";

  const row = (label, value) => `
    <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid #edf0f4">
      <span style="width:80px;flex:none;font-size:11px;font-weight:800;color:#7b8597">${label}</span>
      <span style="font-size:13px;font-weight:600;color:#172033;word-break:break-word">${esc(value)}</span>
    </div>`;

  pop.innerHTML = `
    <div style="background:#fff;border-radius:12px;width:100%;max-width:380px;
                padding:16px 18px;box-shadow:0 12px 32px rgba(0,0,0,.18)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <strong style="font-size:13px;color:#0f4f96">${esc(cfg[type]?.title || "")}</strong>
        <button type="button" data-close
                style="border:0;background:#f1f3f6;border-radius:6px;padding:4px 10px;font-weight:800;cursor:pointer">✕</button>
      </div>
      ${row("CODE", item.code ?? "")}
      ${row("NOM", stripLevelPrefix(item.name))}
      ${row("ORDRE", item.order ?? "")}
    </div>`;

  pop.addEventListener("click", e => {
    if (e.target === pop || e.target.closest("[data-close]")) {
      pop.remove();
    }
  });

  document.body.appendChild(pop);
}

function renderHierarchyColumn(type) {
  const rows =
    rowsFor(type);

  const el =
    $(cfg[type].list);

  el.innerHTML =
    rows.length
      ? rows.map(
          r => `
            <div
              class="list-item ${
                selection[type] === r.id
                  ? "selected"
                  : ""
              }"
              data-select="${type}"
              data-id="${esc(r.id)}"
            >
              <span class="code">
                ${esc(r.code)}
              </span>

              <span class="name">
                ${esc(stripLevelPrefix(r.name))}
              </span>
            </div>
          `
        ).join("")
      : `
        <div class="empty">
          AUCUN ÉLÉMENT
        </div>
      `;

  el
    .querySelectorAll(
      "[data-select]"
    )
    .forEach(item => {

      item.onclick =
        () => {
          const t = item.dataset.select;
          const id = item.dataset.id;
          const now = Date.now();

          /* double-clic / double-tap (fiable aussi sur iPad) */
          if (
            levelTap.id === id &&
            levelTap.type === t &&
            now - levelTap.at < 400
          ) {
            levelTap.at = 0;
            showLevelInfo(t, id);
            return;
          }

          levelTap.type = t;
          levelTap.id = id;
          levelTap.at = now;

          selectHierarchy(t, id);
        };

      bindLongPress(
        item,
        {
          type:
            item.dataset.select,
          id:
            item.dataset.id
        }
      );
    });
}

function renderHierarchy() {
  renderHierarchyColumn("project");
  renderHierarchyColumn("lot");
  renderHierarchyColumn("primary");
  renderHierarchyColumn("secondary");

  renderContext();
  renderBrd();
}

function updateSelectedItem(type, id) {
  const list =
    $(cfg[type].list);

  list
    .querySelectorAll(
      ".list-item"
    )
    .forEach(el => {

      el.classList.toggle(
        "selected",
        el.dataset.id === id
      );
    });
}

async function selectHierarchy(
  type,
  id
) {
  selection[type] = id;

  if (type === "project") {
    selection.lot = null;
    selection.primary = null;
    selection.secondary = null;

    db.brd = [];
    brdRequestId++;

    updateSelectedItem(
      "project",
      id
    );

    renderHierarchyColumn("lot");
    renderHierarchyColumn("primary");
    renderHierarchyColumn("secondary");

    renderContext();
    renderBrd();

    return;
  }

  if (type === "lot") {
    selection.primary = null;
    selection.secondary = null;

    db.brd = [];
    brdRequestId++;

    updateSelectedItem(
      "lot",
      id
    );

    renderHierarchyColumn("primary");
    renderHierarchyColumn("secondary");

    renderContext();
    renderBrd();

    return;
  }

  if (type === "primary") {
    selection.secondary = null;

    db.brd = [];
    brdRequestId++;

    updateSelectedItem(
      "primary",
      id
    );

    renderHierarchyColumn(
      "secondary"
    );

    renderContext();
    renderBrd();

    return;
  }

  if (type === "secondary") {
    db.brd = [];

    updateSelectedItem(
      "secondary",
      id
    );

    renderContext();
    renderBrd();

    try {
      await loadBrdForSecondary(
        id
      );

    } catch (e) {
      $("brdCount").textContent =
        "ERREUR";

      $("brdTable")
        .querySelector("tbody")
        .innerHTML = `
          <tr>
            <td
              colspan="6"
              class="empty"
            >
              IMPOSSIBLE DE CHARGER LE BORDEREAU
            </td>
          </tr>
        `;

      alert(
        "CHARGEMENT DU BORDEREAU IMPOSSIBLE : " +
        e.message
      );
    }
  }
}

function getBy(type, id) {
  return db[
    cfg[type].arr
  ].find(
    x => x.id === id
  );
}

function addHierarchy(
  type,
  item = null,
  duplicate = false
) {
  const c =
    cfg[type];

  if (
    c.parent &&
    !selection[c.parent]
  ) {
    return alert(
      `SÉLECTIONNEZ D'ABORD : ${
        cfg[c.parent].title
      }`
    );
  }

  openForm(
    item && !duplicate
      ? "MODIFIER " + c.title
      : "AJOUTER " + c.title,

    [
      f(
        "code",
        "CODE / ABRÉVIATION",
        duplicate
          ? `${item.code}-C`
          : item?.code || ""
      ),

      f(
        "name",
        "NOM",
        item?.name || "",
        "text",
        true
      ),

      f(
        "order",
        "ORDRE",
        item?.order ?? "",
        "number"
      )
    ],

    async values => {
      const out =
        await apiPost(
          "saveBDS",
          {
            data: {
              ID:
                item && !duplicate
                  ? item.id
                  : "",

              TYPE:
                c.type,

              PARENT_ID:
                c.parent
                  ? selection[
                      c.parent
                    ]
                  : "",

              CODE:
                values.code,

              NOM:
                values.name,

              ORDRE:
                values.order,

              ACTIF:
                "OUI"
            }
          }
        );

      upsertLocalBDS(
        out.data
      );

      renderHierarchy();
    }
  );
}

function renderContext() {
  const parts = [];

  if (selection.project) {
    parts.push(
      `PROJET : ${
        getBy(
          "project",
          selection.project
        )?.code || ""
      }`
    );
  }

  if (selection.lot) {
    parts.push(
      `LOT : ${
        getBy(
          "lot",
          selection.lot
        )?.name || ""
      }`
    );
  }

  if (selection.primary) {
    parts.push(
      `ACTIVITÉ PRIMAIRE : ${
        getBy(
          "primary",
          selection.primary
        )?.name || ""
      }`
    );
  }

  if (selection.secondary) {
    parts.push(
      `ACTIVITÉ SECONDAIRE : ${
        getBy(
          "secondary",
          selection.secondary
        )?.name || ""
      }`
    );
  }

  $("bdsContext").textContent =
    parts.length
      ? parts.join(" | ")
      : "SÉLECTIONNEZ UNE ACTIVITÉ SECONDAIRE";
}

function renderBrd() {
  const q =
    normalise(
      $("brdSearch").value
    ).toUpperCase();

  let rows =
    db.brd.filter(
      r =>
        r.secondaryId ===
        selection.secondary
    );

  if (q) {
    rows =
      rows.filter(
        r =>
          `${r.article} ${r.designation} ${r.unit}`
            .toUpperCase()
            .includes(q)
      );
  }

  $("brdCount").textContent =
    `${rows.length} ARTICLE${
      rows.length > 1
        ? "S"
        : ""
    }`;

  let total = 0;

  $("brdTable")
    .querySelector("tbody")
    .innerHTML =
      rows.length
        ? rows.map(r => {

            const amount =
              num(r.qty) *
              num(r.price);

            total += amount;

            return `
              <tr
                class="data-row"
                data-type="brd"
                data-id="${esc(r.id)}"
              >
                <td>
                  ${esc(r.article)}
                </td>

                <td>
                  ${esc(r.designation)}
                </td>

                <td>
                  ${esc(r.unit)}
                </td>

                <td class="number">
                  ${money(r.qty)}
                </td>

                <td class="number">
                  ${money(r.price)}
                </td>

                <td class="number">
                  ${money(amount)}
                </td>
              </tr>
            `;
          }).join("")
        : `
          <tr>
            <td
              colspan="6"
              class="empty"
            >
              ${
                selection.secondary
                  ? "AUCUN ARTICLE"
                  : "SÉLECTIONNEZ UNE ACTIVITÉ SECONDAIRE"
              }
            </td>
          </tr>
        `;

  $("brdTotal").textContent =
    money(total);

  bindRows();
}

function brdForm(
  item = null,
  duplicate = false
) {
  if (
    !selection.secondary &&
    !item
  ) {
    return alert(
      "SÉLECTIONNEZ D'ABORD UNE ACTIVITÉ SECONDAIRE"
    );
  }

  openForm(
    item && !duplicate
      ? "MODIFIER ARTICLE BORDEREAU"
      : "AJOUTER ARTICLE BORDEREAU",

    [
      f(
        "article",
        "ARTICLE",
        duplicate
          ? `${item.article}-C`
          : item?.article || ""
      ),

      f(
        "designation",
        "DÉSIGNATION",
        item?.designation || "",
        "text",
        true
      ),

      f(
        "unit",
        "UNITÉ",
        item?.unit || ""
      ),

      f(
        "qty",
        "QUANTITÉ",
        item?.qty ?? 0,
        "number"
      ),

      f(
        "price",
        "PRIX",
        item?.price ?? 0,
        "number"
      )
    ],

    async values => {
      const out =
        await apiPost(
          "saveBRD",
          {
            data: {
              ID:
                item && !duplicate
                  ? item.id
                  : "",

              TACHE_SECONDAIRE_ID:
                selection.secondary,

              ARTICLE:
                values.article,

              DESIGNATION:
                values.designation,

              UNITE:
                values.unit,

              QUANTITE:
                values.qty,

              PRIX:
                values.price,

              ACTIF:
                "OUI"
            }
          }
        );

      upsertLocalBRD(
        out.data
      );

      renderBrd();
    }
  );
}

/* =========================================================
   BDG — CHARGEMENT
   ========================================================= */

async function ensureBDGLoaded() {
  if (bdgLoaded || bdgLoading) return;

  bdgLoading = true;

  try {
    setBDGLoadingState();

    const data = await apiGetBDG();
    const rows = data.rows || [];

    if (rows.length < 2) {
      throw new Error("BDG VIDE");
    }

    const headers = rows[0];

    bdgRows = rows.slice(1).map(row => {
      const obj = {};

      headers.forEach((header, index) => {
        obj[String(header).trim()] =
          row[index] ?? "";
      });

      /* cellules brutes par position (colonne A = 0, B = 1 ...) */
      Object.defineProperty(
        obj,
        "__cols",
        { value: row, enumerable: false }
      );

      return obj;
    });

    bdgLoaded = true;
    renderBudgetList();

  } catch (error) {
    renderBDGError(
      error.message || String(error)
    );

  } finally {
    bdgLoading = false;
  }
}

function setBDGLoadingState() {
  const body =
    $("budgetListTable")
      ?.querySelector("tbody");

  if (body) {
    body.innerHTML = `
      <tr>
        <td colspan="7" class="empty">
          CHARGEMENT DES BUDGETS...
        </td>
      </tr>
    `;
  }
}

function renderBDGError(message) {
  const body =
    $("budgetListTable")
      ?.querySelector("tbody");

  if (body) {
    body.innerHTML = `
      <tr>
        <td colspan="7" class="empty">
          ERREUR BDG : ${esc(message)}
        </td>
      </tr>
    `;
  }
}

function firstValue(row, names) {
  for (const name of names) {
    const v = row[name];

    if (normalise(v) !== "") {
      return v;
    }
  }

  return "";
}

function budgetReference(row, index) {
  return (
    firstValue(
      row,
      [
        "BDG",
        "REFERENCE BDG",
        "RÉFÉRENCE BDG",
        "REFERENCE",
        "RÉFÉRENCE"
      ]
    ) ||
    (
      "BDG-" +
      String(index + 1)
        .padStart(4, "0")
    )
  );
}

/* =========================================================
   BDG — LISTE
   ========================================================= */

function renderBudgetList() {
  const table =
    $("budgetListTable");

  if (!table) return;

  const shell =
    table.closest(
      ".novapp-list-shell"
    );

  if (!shell) return;

  /* -------------------------------------------------------
     STYLE SPÉCIFIQUE À LA LISTE
     ------------------------------------------------------- */

  if (!$("bdgListRuntimeStyle")) {
    const style =
      document.createElement("style");

    style.id =
      "bdgListRuntimeStyle";

    style.textContent = `

      .novapp-budget-table-wrap {
        position: relative;
        max-height: calc(100vh - 150px);
        overflow: auto !important;
        -webkit-overflow-scrolling: touch;
      }

      #budgetListTable {
        table-layout: fixed;
        width: 100%;
        min-width: 1050px;
      }

      #budgetListTable thead th {
        position: sticky;
        top: 0;
        z-index: 20;
        background: #f3f4f6;
        overflow: visible;
        user-select: none;
      }

      #budgetListTable td {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .bdg-list-head {
        position: relative;
      }

      .bdg-head-content {
        display: flex;
        align-items: center;
        width: 100%;
        gap: 3px;
        min-width: 0;
      }

      .bdg-head-label {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .bdg-head-action {
        width: 22px;
        min-width: 22px;
        height: 24px;
        padding: 0;
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: #687281;
        cursor: pointer;
        font-size: 12px;
        line-height: 24px;
        text-align: center;
        text-transform: none;
      }

      .bdg-head-action:hover {
        background: #e3e7ec;
        color: #222b38;
      }

      .bdg-column-search {
        width: 100%;
        min-width: 50px;
        height: 26px;
        padding: 2px 7px;
        border: 1px solid #9ca7b6;
        border-radius: 5px;
        outline: none;
        background: #fff;
        color: #303947;
        font-size: 10px;
        font-weight: 700;
        text-transform: none;
      }

      .bdg-column-search:focus {
        border-color: #1769c2;
      }

      .bdg-column-resizer {
        position: absolute;
        top: 0;
        right: -4px;
        z-index: 40;
        width: 8px;
        height: 100%;
        cursor: col-resize;
        touch-action: none;
      }

      .bdg-column-resizer:hover,
      .bdg-column-resizer.active {
        background:
          rgba(23,105,194,.18);
      }

      #budgetListTable .number {
        text-align: right;
      }

      #budgetListTable
      .bdg-action-cell {
        text-align: center;
        padding-left: 3px;
        padding-right: 3px;
        overflow: visible;
      }

      .bdg-row-action {
        width: 27px;
        height: 27px;
        padding: 0;
        margin: 0 1px;
        border: 0;
        border-radius: 5px;
        background: transparent;
        color: #5f6875;
        cursor: pointer;
        font-size: 16px;
        text-transform: none;
      }

      .bdg-row-action:hover {
        background: #edf1f5;
      }

      #budgetListTable tbody tr[data-budget-ref] {
        cursor: pointer;
      }

      #budgetListTable tbody tr[data-budget-ref]:hover {
        background: #f8fafc;
      }

      .bdg-popup-back {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(15,23,42,.45);
      }

      .bdg-popup {
        width: 100%;
        max-width: 460px;
        border-radius: 14px;
        background: #fff;
        box-shadow: 0 20px 50px rgba(0,0,0,.3);
        overflow: hidden;
      }

      .bdg-popup-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: #f3f4f6;
        border-bottom: 1px solid #e1e5eb;
        font-size: 12px;
        font-weight: 800;
      }

      .bdg-popup-close {
        width: 30px;
        height: 30px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        font-size: 16px;
        cursor: pointer;
      }

      .bdg-popup-body {
        padding: 16px;
      }

      .bdg-popup-field {
        margin-bottom: 12px;
      }

      .bdg-popup-field label {
        display: block;
        margin-bottom: 4px;
        color: #6b7480;
        font-size: 10px;
        font-weight: 800;
      }

      .bdg-popup-field div {
        min-height: 32px;
        padding: 7px 10px;
        border: 1px solid #dfe4eb;
        border-radius: 8px;
        background: #fafbfc;
        font-size: 12px;
        font-weight: 700;
      }

      .bdg-popup-note {
        color: #8a93a0;
        font-size: 10px;
      }


      .bdg-d-page { padding: 18px 28px 40px; }

      /* haut de l'écran figé : titre ☰ → pastilles DOC/TAF/OBS/INF */
      .bdg-d-sticky {
        position: sticky;
        top: 0;
        z-index: 50;
        background: #fff;
        box-shadow: 0 2px 6px rgba(15, 23, 42, .06);
      }
      .bdg-d-head { padding: 14px 28px 4px; }
      .bdg-d-head .bdg-d-pills { margin-bottom: 10px; }

      .bdg-d-title {
        margin: 0 0 6px;
        font-size: 30px;
        font-weight: 900;
        text-decoration: underline;
        text-underline-offset: 6px;
        text-transform: none;
      }

      .bdg-d-ref {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
        color: #3f4856;
        font-size: 24px;
        font-weight: 800;
      }

      .bdg-d-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #e8edf3;
        color: #5f6875;
        font-size: 11px;
        font-weight: 900;
      }

      .bdg-d-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 20px;
      }

      .bdg-d-pill {
        padding: 6px 14px;
        border: 1px solid #dfe4eb;
        border-radius: 999px;
        background: #fff;
        color: #4b5563;
        font-size: 12px;
        font-weight: 800;
      }

      .bdg-d-block {
        margin-bottom: 18px;
        border: 1px solid #e1e5eb;
        border-radius: 12px;
        background: #fff;
        overflow: hidden;
      }

      .bdg-d-block-title {
        padding: 9px 14px;
        background: #f3f4f6;
        border-bottom: 1px solid #e1e5eb;
        font-size: 11px;
        font-weight: 900;
      }

      .bdg-d-scroll {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      .bdg-d-table {
        min-width: 0;
        table-layout: fixed;
        border-collapse: collapse;
        font-size: 11px;
      }
      .bdg-d-table th, .bdg-d-table td {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .col-rs {
        position: absolute; top: 0; right: 0; width: 9px; height: 100%;
        cursor: col-resize; z-index: 4; touch-action: none;
      }
      .col-rs::after {
        content: ""; position: absolute; top: 3px; bottom: 3px; right: 0;
        width: 1px; background: #cfd6df;
      }
      .col-rs.on::after { background: #1d4ed8; width: 2px; }

      .bdg-d-table th,
      .bdg-d-table td {
        padding: 3px 10px;
        line-height: 1.25;
        border-bottom: 1px solid #edf0f4;
        text-align: left;
        white-space: nowrap;
      }

      .bdg-d-table th {
        position: sticky;
        top: 0;
        z-index: 2;
        background: #fafbfc;
        color: #6b7480;
        font-size: 10px;
      }

      .bdg-d-table .number { text-align: right; }
      .bdg-d-table .center { text-align: center; }

      .bdg-d-table .empty {
        text-align: center;
        color: #9aa3af;
      }

      .bdg-tva-input {
        width: 52px;
        height: 18px;
        box-sizing: border-box;
        padding: 0 4px;
        border: 1px solid #cfd6df;
        border-radius: 6px;
        text-align: right;
        font-size: 11px;
      }

      .bdg-d-reserved {
        padding: 22px 14px;
        color: #9aa3af;
        font-size: 11px;
      }

      .bdg-d-delay {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        padding: 14px;
      }

      .bdg-d-delay label {
        display: block;
        color: #6b7480;
        font-size: 10px;
        font-weight: 800;
      }

      .bdg-d-delay input,
      .bdg-d-delay div {
        display: block;
        min-width: 150px;
        min-height: 30px;
        margin-top: 4px;
        padding: 6px 9px;
        border: 1px solid #dfe4eb;
        border-radius: 8px;
        background: #fff;
        color: #303947;
        font-size: 12px;
      }

      .bdg-d-totals {
        margin-left: auto;
        max-width: 340px;
        border: 1px solid #e1e5eb;
        border-radius: 12px;
        background: #fff;
        overflow: hidden;
      }

      .bdg-d-totals div {
        display: flex;
        justify-content: space-between;
        padding: 9px 14px;
        border-bottom: 1px solid #edf0f4;
        font-size: 11px;
        font-weight: 800;
      }

      .bdg-d-total-ttc {
        background: #dcecff;
        border-bottom: 0 !important;
      }

      /* même hauteur de ligne (21 px) pour tous les tableaux de l'écran :
         désignations client, détail charge / produit, lots / tâches */
      .bdg-d-table th,
      .bdg-d-table td {
        padding: 2px 8px !important;
        line-height: 16px !important;
        font-size: 12px !important;
        height: 21px;
        box-sizing: border-box;
        white-space: nowrap;
      }
      .bdg-d-table tbody tr.bdg-d-filler td { height: 21px; }
      .bdg-d-table th { font-size: 11px !important; }
      .bdg-tva-input {
        width: 100% !important;
        height: 16px !important;
        line-height: 16px;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        color: inherit;
        font: inherit;
        text-align: right;
      }
      .bdg-tva-input:focus {
        outline: 1px solid #93b4e8;
        background: #fff !important;
      }

      #whyTip {
        position: fixed; z-index: 10002; padding: 8px 10px; border-radius: 8px;
        background: #1f2937; color: #fff; font-size: 12px; line-height: 1.35;
        box-shadow: 0 6px 18px rgba(0,0,0,.2);
      }
      .bdg-d-table td[data-why] { cursor: help; }

      .bdg-d-pill-btn { cursor: pointer; }
      .bdg-d-pill-btn:hover { background: #eef1f6; }
      #docPop {
        position: fixed; inset: 0; z-index: 10003; background: rgba(15,23,42,.45);
        display: flex; align-items: center; justify-content: center; padding: 16px;
      }
      #docPop .doc-card {
        width: 100%; max-width: 760px; background: #fff; border-radius: 10px;
        box-shadow: 0 18px 40px rgba(0,0,0,.25); overflow: hidden; color: #172033;
        font-size: 12px;
      }
      #docPop .doc-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 18px; border-bottom: 1px solid #e5e9ef;
      }
      #docPop .doc-title { font-size: 13px; font-weight: 800; }
      #docPop .doc-x { border: 0; background: none; font-size: 16px; cursor: pointer; color: #374151; }
      #docPop .doc-body { padding: 16px 18px 12px; }
      #docPop .doc-grid {
        display: grid; grid-template-columns: max-content 1fr max-content 1fr; gap: 12px 12px; align-items: center;
      }
      #docPop .doc-lab { font-size: 11px; font-weight: 800; color: #4b5563; }
      #docPop .doc-lab b { color: #dc2626; }
      #docPop .doc-in {
        height: 34px; border: 1px solid #d6dbe3; border-radius: 6px; padding: 0 10px;
        font-size: 12px; font-family: inherit; color: #172033; background: #fff; min-width: 0;
      }
      #docPop .doc-in:focus { outline: none; border-color: #60a5fa; box-shadow: 0 0 0 3px #dbeafe; }
      #docPop .doc-in.bad, #docPop .doc-file.bad .doc-btn { border-color: #f87171; background: #fef2f2; }
      #docPop .doc-file { grid-column: 2 / 5; display: flex; align-items: center; gap: 12px; }
      #docPop .doc-fname { font-size: 11px; color: #6b7280; }
      #docPop .doc-fname.ok { color: #172033; font-weight: 700; }
      #docPop .doc-btn {
        height: 34px; padding: 0 16px; border: 1px solid #d6dbe3; border-radius: 6px;
        background: #fff; font-size: 12px; font-weight: 800; cursor: pointer; color: #172033;
      }
      #docPop .doc-save { background: #eef3fb; border-color: #9fb6d9; }
      #docPop .doc-grid-2 { grid-template-columns: max-content 1fr; }
      #docPop .doc-grid-2 > .doc-lab { margin-left: 0 !important; }
      #docPop .doc-grid > .doc-lab:nth-child(4n+3) { margin-left: 12px; }
      #docPop .doc-lab { white-space: nowrap; }
      /* libellé aligné sur la 1re ligne du champ, même si le champ est agrandi */
      #docPop .doc-grid { align-items: start; }
      #docPop .doc-grid > .doc-lab { padding-top: 10px; }
      #docPop .doc-row { display: flex; align-items: center; gap: 10px; }
      #docPop .doc-row .doc-in { flex: 1; }
      #docPop .doc-ta { height: 90px; padding: 8px 10px; resize: vertical; line-height: 1.4; }
      #docPop .doc-ta-s { height: 34px; padding: 7px 10px; }
      #docPop .doc-ro { background: #f3f5f8; color: #374151; }
      #docPop .doc-flag {
        width: 34px; height: 34px; border: 1px solid #d6dbe3; border-radius: 6px; background: #fff;
        font-size: 16px; font-weight: 900; cursor: pointer; color: #374151;
      }
      #docPop .doc-flag.on { background: #fee2e2; border-color: #f87171; color: #b91c1c; }
      /* fenêtre et champs réglables */
      #docPop .doc-card { position: relative; display: flex; flex-direction: column; max-height: calc(100vh - 32px); }
      #docPop .doc-card .doc-body { flex: 1 1 auto; overflow: auto; }
      #docPop .pop-rsz {
        position: absolute; right: 2px; bottom: 2px; width: 18px; height: 18px; cursor: nwse-resize;
        touch-action: none; z-index: 2;
        background: linear-gradient(135deg, transparent 50%, #9aa3af 50%, #9aa3af 58%, transparent 58%,
          transparent 70%, #9aa3af 70%, #9aa3af 78%, transparent 78%);
      }
      #docPop .fld-wrap { position: relative; display: block; min-width: 0; }
      #docPop .fld-wrap.sized { justify-self: start; max-width: none; }
      #docPop .fld-wrap.in-row { flex: 1; }
      #docPop .fld-wrap.in-row.sized { flex: none; }
      /* le champ remplit exactement son cadre : la poignée tombe sur son coin */
      #docPop .fld-wrap { display: flex; flex-direction: column; align-items: stretch; line-height: normal; }
      #docPop .fld-wrap > .doc-in { width: 100%; min-width: 0; max-width: 100%; box-sizing: border-box; margin: 0; }
      #docPop .fld-wrap > input.doc-in { display: block; }
      /* iPad : les champs date / heure gardent sinon leur propre largeur */
      #docPop .fld-wrap > input[type="date"],
      #docPop .fld-wrap > input[type="time"],
      #docPop .fld-wrap > input[type="datetime-local"] {
        -webkit-appearance: none; appearance: none; text-align: left; line-height: 32px;
      }
      #docPop .fld-wrap > input::-webkit-date-and-time-value { text-align: left; margin: 0; }
      /* date affichée JJ/MM/AAAA À HH:MM ; le vrai champ, transparent, est dessus */
      #docPop .fld-wrap { position: relative; }
      #docPop .dt-show { display: block; line-height: 32px; white-space: nowrap; overflow: hidden; cursor: pointer; }
      #docPop .dt-native {
        position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; z-index: 1;
        margin: 0; border: 0; padding: 0; cursor: pointer; font-size: 16px;
      }
      #docPop .fld-wrap:has(.dt-native:focus) .dt-show { border-color: #60a5fa; box-shadow: 0 0 0 3px #dbeafe; }
      #docPop .fld-wrap:has(.dt-native.bad) .dt-show { border-color: #f87171; background: #fef2f2; }
      #docPop .fld-rsz { z-index: 2; }
      #docPop .fld-wrap > textarea.doc-in { display: block; resize: none; }
      #docPop .fld-rsz {
        position: absolute; right: 1px; bottom: 1px; width: 12px; height: 12px; cursor: nwse-resize;
        touch-action: none; opacity: .55;
        background: linear-gradient(135deg, transparent 55%, #6b7280 55%, #6b7280 65%, transparent 65%,
          transparent 78%, #6b7280 78%, #6b7280 88%, transparent 88%);
      }
      #docPop .fld-rsz:hover { opacity: 1; }
      #docPop .doc-err { color: #b42318; font-size: 11px; min-height: 14px; margin-top: 10px; }
      #docPop .fd-msg { color: #6b7280; }
      #docPop .exp-drv-row { display: flex; align-items: center; gap: 10px; min-height: 34px; }
      #docPop .exp-drv-row > .doc-in { flex: 1; }
      #docPop .exp-drv-row > .fld-wrap { flex: 1; min-width: 0; }
      #docPop .exp-path { color: #1d4ed8; text-decoration: underline; font-weight: 700; text-transform: none; cursor: pointer; }
      #docPop .exp-path[readonly] { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
      #docPop .exp-path.editing { cursor: text; text-decoration: none; color: #172033; }
      #docPop .drv-link { flex: 1; color: #1d4ed8; text-decoration: underline; font-size: 12px; font-weight: 700;
        word-break: break-all; text-transform: none; }
      #drvPop {
        position: fixed; inset: 0; z-index: 10010; background: rgba(15,23,42,.35);
        display: flex; align-items: center; justify-content: center; padding: 16px;
      }
      #drvPop .dp-card { width: 100%; max-width: 560px; background: #fff; border-radius: 10px; overflow: hidden;
        box-shadow: 0 18px 40px rgba(0,0,0,.3); color: #172033; font-size: 12px; }
      #drvPop .dp-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px;
        border-bottom: 1px solid #e5e9ef; font-size: 13px; font-weight: 800; }
      #drvPop .dp-x { border: 0; background: none; font-size: 16px; cursor: pointer; color: #374151; }
      #drvPop .dp-body { padding: 18px; }
      #drvPop .dp-row { display: flex; align-items: center; gap: 10px; min-height: 34px; }
      #drvPop .dp-row[hidden] { display: none; }
      #drvPop .dp-link { flex: 1; color: #1d4ed8; text-decoration: underline; font-size: 13px; font-weight: 700;
        word-break: break-all; cursor: pointer; }
      #drvPop .dp-edit { width: 34px; height: 34px; border: 1px solid #d6dbe3; border-radius: 6px; background: #fff;
        font-size: 16px; cursor: pointer; color: #374151; flex: none; }
      #drvPop .dp-in { width: 100%; box-sizing: border-box; height: 34px; border: 1px solid #60a5fa; border-radius: 6px;
        padding: 0 10px; font-size: 12px; box-shadow: 0 0 0 3px #dbeafe; outline: none; }
      #drvPop .dp-in[hidden] { display: none; }
      #drvPop .dp-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 18px;
        border-top: 1px solid #e5e9ef; background: #fafbfc; }
      #drvPop .dp-btn { height: 34px; padding: 0 16px; border: 1px solid #d6dbe3; border-radius: 6px; background: #fff;
        font-size: 12px; font-weight: 800; cursor: pointer; color: #172033; }
      #drvPop .dp-ok { background: #eef3fb; border-color: #9fb6d9; }
      #docPop .fd-msg.ok { color: #15803d; font-weight: 700; }
      #docPop .fd-msg a { color: #1d4ed8; font-weight: 800; }
      #docPop .doc-btn:disabled { opacity: .5; cursor: default; }
      #docPop .doc-foot {
        display: flex; justify-content: flex-end; gap: 10px; padding: 12px 18px;
        border-top: 1px solid #e5e9ef; background: #fafbfc;
      }
      @media (max-width: 650px) {
        #docPop .doc-grid { grid-template-columns: 1fr; }
        #docPop .doc-file { grid-column: auto; }
      }

      /* agrandissement d'un bloc */
      .blk-max-btn .ic-min { display: none; }
      .blk-max-btn.on .ic-max { display: none; }
      .blk-max-btn.on .ic-min { display: inline; }
      .blk-max-btn.on { background: #dbeafe; color: #1d4ed8; }
      .bdg-d-page.max-client > .blk-hier,
      .bdg-d-page.max-client > #bdgTabs,
      .bdg-d-page.max-client > #bdgTabBody,
      .bdg-d-page.max-hier > .blk-client,
      .bdg-d-page.max-hier > #bdgTabs,
      .bdg-d-page.max-hier > #bdgTabBody,
      .bdg-d-page.max-detail > .blk-client,
      .bdg-d-page.max-detail > .blk-hier { display: none !important; }
      .bdg-d-page.max-client .bdg-d-block > .bdg-d-scroll.bdg-d-client-scroll {
        height: calc(var(--avail) - 50px) !important;
        max-height: none !important;
      }
      .bdg-d-page.max-hier .bdg-h-col { height: calc(var(--avail) - 70px) !important; max-height: none !important; }
      .bdg-d-page.max-detail .bdg-d-tabbody .bdg-d-scroll {
        height: calc(var(--avail) - 60px) !important;
        max-height: none !important;
      }

      /* déplacement des colonnes par glissement de l'en-tête */
      /* iPad : pas de défilement depuis un en-tête, sinon le glissement est interrompu */
      .bdg-d-table thead th, .bdg-h-head {
        touch-action: none; cursor: grab;
        user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
      }
      .bdg-d-table thead th.co-src, .bdg-h-head.co-src { opacity: .45; }
      .bdg-d-table thead th.co-before, .bdg-h-head.co-before { box-shadow: inset 3px 0 0 #1d4ed8; }
      .bdg-d-table thead th.co-after, .bdg-h-head.co-after { box-shadow: inset -3px 0 0 #1d4ed8; }
      #coGhost {
        position: fixed; z-index: 10010; pointer-events: none; padding: 5px 10px;
        background: #1d4ed8; color: #fff; border-radius: 6px; font-size: 11px; font-weight: 800;
        box-shadow: 0 6px 16px rgba(0,0,0,.2);
      }

      /* disposition des blocs : ordre par glissement, hauteur réglable */
      .bdg-d-page { display: flex; flex-direction: column; }
      .bdg-d-page > * { min-width: 0; }
      #bdgTabBody { margin-bottom: 0; }
      .blk-rsz {
        height: 14px; cursor: ns-resize; touch-action: none; position: relative;
        background: #fafbfc; border-top: 1px solid #edf0f4;
      }
      .blk-rsz::after {
        content: ""; position: absolute; left: 50%; top: 5px; width: 36px; height: 4px;
        margin-left: -18px; border-radius: 2px; background: #c3cad5;
      }
      .blk-rsz.on::after, .blk-rsz:hover::after { background: #1d4ed8; }
      #bdgDetailRsz {
        margin-bottom: 18px; border: 1px solid #e1e5eb; border-top: 0;
        border-radius: 0 0 12px 12px;
      }
      #bdgTabBody { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
      .bdg-d-page[class*="max-"] .blk-rsz { display: none !important; }
      .blk-grip {
        display: inline-flex; align-items: center; justify-content: center;
        width: 22px; height: 22px; margin-right: 6px; border-radius: 5px;
        color: #8a93a0; cursor: grab; touch-action: none; font-size: 14px; line-height: 1;
        flex: none; user-select: none; -webkit-user-select: none;
      }
      .blk-grip:hover { background: #e5e9ef; color: #1d4ed8; }
      .bdg-d-page .blk-head { justify-content: flex-start; }
      #bdgTabs .blk-grip { align-self: center; }
      .lay-src { opacity: .5; }
      .lay-before { box-shadow: 0 -4px 0 #1d4ed8; }
      .lay-after { box-shadow: 0 4px 0 #1d4ed8; }
      .bdg-lay-btn {
        width: 40px; height: 40px; padding: 0; justify-content: center; border: 1px solid #d6dbe3; border-radius: 10px;
        background: #fff; color: #4b5563; font-size: 11px; font-weight: 800; cursor: pointer;
        display: inline-flex; align-items: center; gap: 6px;
      }
      .bdg-lay-btn[hidden] { display: none; }

      /* titres de blocs plus bas */
      .bdg-d-page .bdg-d-block-title { padding: 3px 10px 3px 8px; min-height: 28px; box-sizing: border-box; }
      .bdg-d-page .blk-btn { width: 24px; height: 22px; }
      .bdg-d-page .blk-grip { width: 18px; height: 18px; margin-right: 4px; }
      .bdg-d-page .bdg-d-tab { padding: 6px 14px; }

      /* thème sobre : une seule couleur d'accent (bleu marine) */
      .bdg-d-sticky .bdg-d-ref { color: #12355b; }
      .bdg-d-sticky .bdg-d-badge { background: #12355b; color: #fff; }
      .bdg-d-pill .ico, .rec-tab .ico, .bdg-d-tab .ico, .blk-head .ttl .ico { color: #12355b; opacity: 1; }
      .bdg-d-page .bdg-d-block-title { border-left: 4px solid #12355b; }
      .bdg-d-page .bdg-d-tab.active { color: #12355b; box-shadow: inset 0 -3px 0 #12355b; }
      .bdg-d-page .rec-tab.active { color: #12355b; }
      .bdg-d-page .bdg-d-table tfoot td,
      .bdg-d-page .bdg-d-total-row td { background: #e7edf5 !important; color: #12355b; }
      #bdgClientBody td:last-child, #bdgTabBody tbody td:last-child { color: #12355b; font-weight: 800; }
      .bdg-d-page .bdg-d-table tbody tr:nth-child(even) td:not(.cell-warn) { background: #fbfcfe; }

      /* glisser une ligne pour changer son ordre */
      #bdgClientBody tr[data-desig], .bdg-h-item[data-h] {
        -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
      }
      #bdgClientBody tr.ro-src td, .bdg-h-item.ro-src { background: #e7edf5 !important; opacity: .7; }
      #bdgClientBody tr.ro-before td { box-shadow: inset 0 3px 0 #12355b; }
      #bdgClientBody tr.ro-after td { box-shadow: inset 0 -3px 0 #12355b; }
      .bdg-h-item.ro-before { box-shadow: inset 0 3px 0 #12355b; }
      .bdg-h-item.ro-after { box-shadow: inset 0 -3px 0 #12355b; }

      /* « ! » d'une observation (activer / désactiver) et case EXPIRÉ des documents */
      .rec-flag { width: 22px; height: 15px; border: 1px solid #d6dbe3; border-radius: 4px; background: #fff;
        color: #c3c9d2; font-weight: 900; cursor: pointer; padding: 0; line-height: 13px; font-size: 11px; vertical-align: middle; }
      .rec-table td { height: 21px; box-sizing: border-box; }
      .rec-exp { margin: 0; vertical-align: middle; }
      .rec-flag.on { color: #b91c1c; border-color: #f3a5a5; background: #fff5f5; }
      .rec-exp { width: 16px; height: 16px; accent-color: #b91c1c; cursor: pointer; }
      .rec-exp:disabled { cursor: not-allowed; opacity: 1; }
      /* alertes : 5 lignes à l'ouverture, plus si la fenêtre est agrandie */
      #docPop .obs-alert-list { max-height: calc(5 * 40px + 4 * 6px); }
      #docPop .doc-card[style*="height"] .obs-alert-list { max-height: none; }
      #docPop .doc-card[style*="height"] .doc-body { display: flex; flex-direction: column; }
      #docPop .doc-card[style*="height"] .obs-alert-list { flex: 1; min-height: 0; }

      /* choix du format (détail produits) */
      #docPop .fmt-choice { display: flex; flex-direction: column; gap: 10px; }
      #docPop .fmt-btn { height: auto; padding: 14px 16px; text-align: left; display: flex; flex-direction: column; gap: 4px; }
      #docPop .fmt-btn small { font-size: 10px; font-weight: 600; color: #6b7280; }
      #docPop .fmt-btn:hover { background: #eef3fb; border-color: #9fb6d9; }
      #docPop .fmt-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 16px; }
      #docPop .fmt-grid .fmt-btn { align-items: center; text-align: center; padding: 12px 8px; }
      #docPop .fmt-btn.on { background: #1d4ed8; border-color: #1d4ed8; color: #fff; }
      @media (max-width: 650px) { #docPop .fmt-grid { grid-template-columns: 1fr 1fr; } }

      /* historique */
      #docPop .hist-card { max-width: 980px; }
      #docPop .hist-card.hist-max { max-width: none; width: calc(100vw - 32px); height: calc(100vh - 32px); }
      #docPop .hist-card.hist-max .hist-scroll { max-height: none; flex: 1; }
      #docPop .hist-card.hist-max .doc-body { display: flex; flex-direction: column; }
      #docPop .hist-tools { display: flex; align-items: center; gap: 6px; }
      #docPop .hist-table { table-layout: auto; width: 100%; }
      #docPop .hist-table td { white-space: normal; vertical-align: top; }
      #docPop .hist-table td.center { text-align: center; white-space: nowrap; }
      #docPop .hist-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
      #docPop .hist-f { border: 1px solid #d6dbe3; background: #fff; border-radius: 999px; padding: 5px 12px;
        font-size: 11px; font-weight: 800; color: #4b5563; cursor: pointer; }
      #docPop .hist-f.on { background: #12355b; color: #fff; border-color: #12355b; }
      #docPop .hist-scroll { max-height: 55vh; overflow: auto; border: 1px solid #e5e9ef; border-radius: 8px; }
      #docPop .hist-table { width: 100%; border-collapse: collapse; font-size: 12px; }
      #docPop .hist-table th { position: sticky; top: 0; background: #f6f8fb; color: #3d4a5c; text-align: left;
        font-size: 11px; padding: 6px 10px; border-bottom: 1px solid #e5e9ef; }
      #docPop .hist-table td { padding: 5px 10px; border-bottom: 1px solid #f0f2f5; vertical-align: top; }
      #docPop .hist-table td:first-child { white-space: nowrap; }
      #docPop .hist-table td.empty { text-align: center; color: #9aa3af; padding: 14px; }
      #histBtn { cursor: pointer; }

      /* options d'impression : choix OUI / NON */
      #docPop .po-card { max-width: 460px; }
      #docPop .po-yn { display: inline-flex; border: 1px solid #d6dbe3; border-radius: 8px; overflow: hidden; width: max-content; }
      #docPop .po-yn button {
        border: 0; background: #fff; padding: 8px 18px; font-size: 12px; font-weight: 800; color: #4b5563; cursor: pointer;
      }
      #docPop .po-yn button + button { border-left: 1px solid #d6dbe3; }
      #docPop .po-yn button.on { background: #12355b; color: #fff; }

      /* icônes de contenu */
      .bdg-d-pill, .rec-tab, .bdg-d-tab, .blk-head .ttl { display: inline-flex; align-items: center; gap: 6px; }
      .ico { flex: none; opacity: .85; }
      .bdg-d-pill .ico { width: 15px; height: 15px; }

      /* un seul bouton d'actions par bloc */
      .blk-tools .blk-btn { display: none !important; }
      /* bloc agrandi : bouton RÉDUIRE toujours visible en haut à droite */
      .blk-tools .blk-btn.blk-max-btn.on {
        display: inline-flex !important; width: 30px; height: 26px; padding: 0;
        background: #12355b; color: #fff; border-color: #12355b; margin-right: 6px;
      }
      .blk-more {
        width: 28px; height: 22px; border: 1px solid #d6dbe3; border-radius: 6px; background: #fff;
        color: #374151; font-size: 16px; line-height: 18px; font-weight: 900; cursor: pointer; padding: 0;
      }
      .blk-more:hover { background: #eef1f6; color: #1d4ed8; }
      #blkMenu {
        position: fixed; z-index: 10005; background: #fff; border: 1px solid #d6dbe3; border-radius: 10px;
        box-shadow: 0 10px 28px rgba(15,23,42,.18); padding: 4px; display: flex; flex-direction: column; min-width: 170px;
      }
      #blkMenu button {
        display: flex; align-items: center; gap: 10px; border: 0; background: none; border-radius: 6px;
        padding: 8px 10px; font-size: 12px; font-weight: 700; color: #172033; cursor: pointer; text-align: left;
      }
      #blkMenu button:hover { background: #eef3fb; color: #1d4ed8; }
      #blkMenu .ic-min { display: none; }

      /* triangle « observations importantes » en haut à droite */
      .bdg-d-hright { margin-left: auto; display: flex; align-items: center; gap: 8px; }
      .bdg-alert-btn {
        position: relative; width: 40px; height: 40px; border: 1px solid #f3c2c2; border-radius: 10px;
        background: #fff5f5; color: #c81e1e; display: inline-flex; align-items: center;
        justify-content: center; cursor: pointer; padding: 0;
      }
      .bdg-alert-btn[hidden] { display: none; }
      .bdg-alert-n {
        position: absolute; top: -6px; right: -6px; min-width: 17px; height: 17px; padding: 0 4px;
        border-radius: 9px; background: #c81e1e; color: #fff; font-size: 10px; font-weight: 800;
        line-height: 17px; text-align: center; box-sizing: border-box;
      }
      #docPop .obs-alert-list { display: flex; flex-direction: column; gap: 10px; max-height: 60vh; overflow-y: auto; }
      #docPop .obs-alert-list { gap: 6px; }
      /* une alerte = une ligne ; toucher pour lire un texte long en entier */
      #docPop .obs-alert-item {
        border: 1px solid #f3c2c2; background: #fff5f5; border-radius: 8px; padding: 7px 12px;
        display: flex; align-items: baseline; gap: 10px; min-width: 0;
      }
      #docPop .obs-alert-meta { font-size: 11px; font-weight: 800; color: #b91c1c; white-space: nowrap; flex: none; }
      #docPop .obs-alert-text {
        font-size: 13px; color: #172033; line-height: 1.4; flex: 1; min-width: 0;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      #docPop .obs-alert-more { flex: none; color: #b91c1c; font-weight: 900; display: none; }
      #docPop .obs-alert-item.can-exp { cursor: pointer; }
      #docPop .obs-alert-item.can-exp .obs-alert-more { display: inline; }
      #docPop .obs-alert-item.open .obs-alert-text { white-space: pre-wrap; }
      #docPop .obs-alert-item.open .obs-alert-more { transform: rotate(180deg); }

      #docPop .inf-grid { row-gap: 10px; }
      #docPop .inf-val {
        display: block; min-height: 34px; box-sizing: border-box; padding: 8px 10px; height: auto;
        font-weight: 700; overflow: hidden; white-space: normal; word-break: break-word; line-height: 1.35;
      }
      #docPop .inf-neg { color: #b91c1c; }
      #docPop .doc-card .doc-body { max-height: 75vh; overflow-y: auto; }
      @media (max-width: 650px) { #docPop .inf-grid { grid-template-columns: 1fr; } }

      /* listes DOC / TAF / OBS : 5 lignes visibles, défilement au-delà */
      .rec-scroll { overflow: auto; -webkit-overflow-scrolling: touch; }
      .blk-suivi .rec-scroll { height: auto; max-height: var(--h-suivi, 129px); }
      .rec-scroll[hidden] { display: none !important; }
      .rec-tabs { display: inline-flex; gap: 4px; flex-wrap: wrap; }
      .rec-tab {
        border: 1px solid transparent; background: none; border-radius: 6px; padding: 3px 10px;
        font: inherit; font-weight: 900; color: #6b7480; cursor: pointer;
      }
      .rec-tab.active { background: #fff; border-color: #d6dbe3; color: #0f4f96; }
      .rec-tab.cf-on { color: #1d4ed8; }
      .rec-table td.center { text-align: center; }
      .rec-table td.number { text-align: right; }
      .rec-table .rec-imp { color: #b91c1c; font-weight: 900; }
      .rec-table .rec-late { color: #b91c1c; font-weight: 700; }
      .rec-table .rec-open {
        color: #1d4ed8; text-decoration: underline; cursor: pointer; background: none;
        border: 0; padding: 0; font: inherit;
      }
      .bdg-d-page[class*="max-"] > .blk-rec:not(.blk-rec-on) { display: none !important; }
      .bdg-d-page.max-rec > .blk-client,
      .bdg-d-page.max-rec > .blk-hier,
      .bdg-d-page.max-rec > #bdgTabs,
      .bdg-d-page.max-rec > #bdgTabBody { display: none !important; }
      .bdg-d-page.max-rec .blk-rec-on .rec-scroll { height: calc(var(--avail) - 50px); max-height: none; }

      /* outils export / import / aperçu */
      .blk-head { display: flex; align-items: center; justify-content: space-between; }
      .blk-tools { display: inline-flex; gap: 4px; margin-left: auto; }
      .bdg-d-tabs { align-items: flex-end; }
      .bdg-d-tabs .blk-tools { align-self: center; padding-right: 6px; }
      .blk-btn {
        display: inline-flex; align-items: center; justify-content: center;
        width: 26px; height: 24px; border: 1px solid #d6dbe3; border-radius: 6px;
        background: #fff; color: #4b5563; cursor: pointer; padding: 0;
      }
      .blk-btn:hover { background: #eef1f6; color: #1d4ed8; }
      #blkPop {
        position: fixed; inset: 0; z-index: 10001; background: rgba(15,23,42,.35);
        display: flex; align-items: center; justify-content: center; padding: 16px;
      }
      #blkPop .blk-card {
        position: relative; background: #fff; border-radius: 12px; width: 100%; max-width: 300px;
        padding: 16px; display: flex; flex-direction: column; gap: 8px;
        box-shadow: 0 12px 32px rgba(0,0,0,.18); font-size: 12px; max-height: 90vh;
      }
      #blkPop .blk-wide { max-width: 900px; }
      #blkPop .blk-title { font-weight: 800; color: #0f4f96; padding-right: 30px; }
      #blkPop .blk-sub { color: #6b7280; font-size: 11px; }
      #blkPop .blk-choice {
        border: 1px solid #d6dbe3; background: #f8fafc; border-radius: 8px; padding: 9px;
        font-weight: 700; font-size: 12px; cursor: pointer; text-align: left;
      }
      #blkPop .blk-choice:hover { background: #dbeafe; }
      #blkPop .exp-name { height: 34px; border: 1px solid #d6dbe3; border-radius: 6px; padding: 0 8px;
        font-size: 12px; font-weight: 700; color: #172033; margin-bottom: 4px; }
      #blkPop .drv-go { background: #1d4ed8; color: #fff; border-color: #1d4ed8; text-align: center; }
      #blkPop .drv-go:hover { background: #1e40af; }
      #blkPop .drv-rec { font-weight: 600; padding: 6px 9px; }
      #blkPop .blk-x {
        position: absolute; top: 10px; right: 10px; width: 26px; height: 26px; border: 0;
        border-radius: 50%; background: #eef1f6; font-weight: 800; cursor: pointer;
      }
      #blkPop .blk-scroll { overflow: auto; border: 1px solid #edf0f4; border-radius: 6px; }
      #blkPop .blk-imp { table-layout: auto; width: auto; }

      /* contrôle unité / dimensions (Détail produits) */
      .bdg-d-table tbody tr td.cell-warn,
      .bdg-d-table tbody tr.selected td.cell-warn { background: #fbd5d5 !important; }

      /* tri / filtre par colonne */
      .cf-wrap { display: flex; align-items: center; gap: 4px; width: 100%; }
      .cf-lab { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; text-align: left; }
      .cf-wrap .cf-btn { margin-left: auto; margin-right: 7px; }
      .cf-btn {
        display: inline-flex; align-items: center; justify-content: center;
        width: 18px; height: 16px; border-radius: 4px; cursor: pointer;
        color: #8a94a5; flex: none;
      }
      .cf-btn:hover { background: #e5e9f0; color: #374151; }
      th.cf-on, .bdg-h-head.cf-on,
      .bdg-d-tab.cf-on, .bdg-d-block-title.cf-on {
        color: #1d4ed8 !important; background: #dbeafe !important;
      }
      th.cf-on .cf-btn, .bdg-h-head.cf-on .cf-btn { color: #1d4ed8; }
      #cfMenu {
        position: fixed; z-index: 10020; width: 240px; max-height: 60vh; overflow: hidden;
        display: flex; flex-direction: column; gap: 4px; padding: 8px;
        background: #fff; border: 1px solid #d6dbe3; border-radius: 10px;
        box-shadow: 0 10px 28px rgba(15, 23, 42, .18); font-size: 12px;
      }
      #cfMenu .cf-sort, #cfMenu .cf-clear {
        text-align: left; border: 0; background: #f3f5f8; border-radius: 6px;
        padding: 6px 8px; font-size: 12px; font-weight: 700; cursor: pointer; color: #172033;
      }
      #cfMenu .cf-sort.on { background: #dbeafe; color: #1d4ed8; }
      #cfMenu .cf-clear { background: transparent; color: #b42318; }
      #cfMenu .cf-foot { display: flex; gap: 6px; flex: none; }
      #cfMenu .cf-x {
        position: absolute; top: 6px; right: 6px; width: 26px; height: 26px;
        border: 0; border-radius: 50%; background: #eef1f6; color: #374151;
        font-size: 13px; font-weight: 800; cursor: pointer; line-height: 26px; padding: 0;
      }
      #cfMenu .cf-x:hover { background: #dbe2ec; }
      #cfMenu .cf-sort { margin-right: 34px; }
      #cfMenu .cf-foot button { flex: 1; text-align: center; }
      #cfMenu .cf-ok {
        border: 0; border-radius: 6px; padding: 6px 8px; font-size: 12px;
        font-weight: 800; cursor: pointer; background: #1d4ed8; color: #fff;
      }
      #cfMenu .cf-sort, #cfMenu .cf-search { flex: none; }
      #cfMenu .cf-search { display: flex; align-items: center; gap: 4px; }
      #cfMenu .cf-q {
        flex: 1; min-width: 0; padding: 5px 7px; border: 1px solid #cfd6df;
        border-radius: 6px; font-size: 12px;
      }
      #cfMenu .cf-list {
        overflow-y: auto; min-height: 0; flex: 1 1 auto;
        -webkit-overflow-scrolling: touch;
        border: 1px solid #edf0f4; border-radius: 6px; padding: 2px 0;
      }
      #cfMenu .cf-item {
        display: flex; align-items: center; gap: 6px; padding: 3px 8px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer;
      }
      #cfMenu .cf-all { font-weight: 700; border-bottom: 1px solid #edf0f4; }
      #cfMenu .cf-none { padding: 6px 8px; color: #9aa3af; }

      /* désignations client : en-tête + 10 lignes + total */
      .bdg-d-block > .bdg-d-scroll.bdg-d-client-scroll {
        height: auto !important;
        max-height: var(--h-client, 148px) !important;
      }
      .bdg-d-table tfoot td {
        position: sticky;
        bottom: 0;
        z-index: 2;
        background: #dcecff;
        font-weight: 800;
        border-top: 1px solid #c7d7ee;
      }
      /* détail charge / produit : au plus 8 lignes visibles,
         pour laisser apparaître les totaux */
      .bdg-d-tabbody > .bdg-d-scroll,
      .bdg-d-tabbody .bdg-d-scroll {
        height: auto !important;
        max-height: var(--h-detail, 148px) !important;
        overflow-y: auto;
      }

      /* même taille de caractères (12 px) dans tout le corps de l'écran */
      .bdg-d-page,
      .bdg-d-page .bdg-d-block-title,
      .bdg-d-page .bdg-d-tab,
      .bdg-d-page .bdg-d-fi,
      .bdg-d-page .bdg-d-totals div,
      .bdg-d-page .bdg-d-totals span,
      .bdg-d-page .bdg-d-totals strong,
      .bdg-d-page .bdg-h-item,
      .bdg-d-page .bdg-tva-input,
      .bdg-d-page .bdg-d-delay,
      .bdg-d-page .bdg-d-reserved {
        font-size: 12px !important;
      }

      .bdg-d-tabbody .bdg-d-totals {
        max-width: none;
        margin-top: 6px;
        display: flex;
        flex-wrap: wrap;
      }
      .bdg-d-tabbody .bdg-d-totals div {
        flex: 1 1 0;
        min-width: 150px;
        padding: 6px 12px;
        border-bottom: 0;
        border-right: 1px solid #edf0f4;
      }

      @media (max-width:650px) {
        .bdg-d-page { padding: 14px 10px 30px; }
        .bdg-d-head { padding: 10px 10px 2px; }
        .bdg-d-title { font-size: 24px; }
      }


      .novapp-list-titlebar .bdg-d-h1 { font-size: 24px; }
      .bdg-d-h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 900;
        text-transform: none;
      }

      #bdgClientBody { }

      /* tableau désignations client : cadre de hauteur fixe,
         en-tête figé, lignes vides de remplissage */
      .bdg-d-block > .bdg-d-scroll.bdg-d-client-scroll {
        height: 245px;
        max-height: none;
      }
      .bdg-d-table tbody tr.bdg-d-filler td {
        height: 20px;
        background: transparent;
      }

      .bdg-d-block > .bdg-d-scroll {
        max-height: 245px;
        overflow-y: auto;
      }

      .bdg-d-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: -1px;
      }

      .bdg-d-tab {
        padding: 9px 16px;
        border: 1px solid #e1e5eb;
        border-bottom: 0;
        border-radius: 10px 10px 0 0;
        background: #f3f4f6;
        color: #5f6875;
        font-size: 10px;
        font-weight: 800;
        cursor: pointer;
        text-transform: none;
      }

      .bdg-d-tab.active {
        background: #fff;
        color: #0f4f96;
      }

      .bdg-d-tabbody {
        border-top-left-radius: 0;
      }

      .bdg-d-debug {
        margin-top: 14px;
        color: #8a93a0;
        font-size: 10px;
      }

.bdg-d-table tbody tr[data-desig]{cursor:pointer}
.bdg-d-table tbody tr[data-row]{cursor:pointer}
.bdg-d-table tbody tr.selected td{background:#dbeafe !important;font-weight:700}
.bdg-d-fi{float:right;font-size:11px;font-weight:600;opacity:.8}
.bdg-h-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px}
.bdg-h-col{border:1px solid #d6dbe3;border-radius:8px;overflow:hidden;height:auto;max-height:var(--h-hier,128px);overflow-y:auto;background:#fff}
.bdg-h-head{position:sticky;top:0;z-index:1;background:#eef1f6;font-size:11px;line-height:16px;font-weight:700;padding:2px 8px;height:21px;box-sizing:border-box}
.bdg-h-item{padding:2px 8px;font-size:12px;line-height:16px;height:21px;box-sizing:border-box;cursor:pointer;border-top:1px solid #eef1f6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bdg-h-fill{height:21px;box-sizing:border-box;border-top:1px solid #eef1f6}
.bdg-h-item.selected{background:#dbeafe;font-weight:700}
.bdg-h-empty{padding:8px;font-size:12px;opacity:.5}
@media (max-width:650px){.bdg-h-grid{grid-template-columns:1fr}}

      @media (max-width:650px) {
        .novapp-budget-table-wrap {
          max-height:
            calc(100vh - 130px);
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  /* -------------------------------------------------------
     REGROUPEMENT PAR BUDGET
     ------------------------------------------------------- */

  const groups = new Map();
  const byProject = new Map();

  /* Date provisoire intégrée à la référence : 01/10/2026 */
  const REF_PREFIX = "BDG 26-1001/";

  bdgRows.forEach(row => {
    const prj =
      normalise(
        firstValue(
          row,
          ["PRJ", "PROJET", "NOM PROJET"]
        )
      ) || "SANS PROJET";

    if (!byProject.has(prj)) {
      const ref =
        REF_PREFIX +
        String(byProject.size + 1)
          .padStart(3, "0");

      const group = {
        ref,
        project: prj,
        rows: [],
        first: row
      };

      byProject.set(prj, group);
      groups.set(ref, group);
    }

    byProject.get(prj).rows.push(row);
  });

  bdgGroups = groups;

  const budgets =
    [...groups.values()];

  /* -------------------------------------------------------
     CALCUL D'UNE LIGNE BUDGET
     ------------------------------------------------------- */

  function budgetData(budget) {
    const first =
      budget.first;

    /*
      BUDGET :
      on privilégie le champ BUDGET.
      PROJET reste en secours tant que
      la source historique ne contient
      pas encore une colonne BUDGET.
    */

    const budgetName =
      budget.project;

    /* montant TTC = celui du tableau DÉSIGNATIONS CLIENT de l'écran du budget :
       par désignation, quantité des lignes PRODUIT au prix non nul
       (clés primaires) × prix de la première d'entre elles (prix TTC de la feuille) */
    const dg = new Map();
    budget.rows.forEach(r => {
      const c = r.__cols || [];
      if (!/PRD/i.test(String(c[14] ?? ""))) return;
      const price = num(c[22]);
      if (!price) return;
      let q = num(c[21]);
      if (!q) {
        const f = [c[17], c[18], c[19], c[20]].filter(v => normalise(v) !== "").map(num);
        if (f.length) q = f.reduce((x, y) => x * y, 1);
      }
      const k = normalise(c[7]) + "||" + normalise(c[8]);
      const g = dg.get(k) || { price, qty: 0 };
      g.qty += q;
      dg.set(k, g);
    });
    const ttc = [...dg.values()].reduce((t, g) => t + g.qty * g.price, 0);
    const ht = ttc / 1.2;

    const refDate =
      budgetDate(budget.ref);

    const validated =
      refDate ? refDate.label : "";

    const entered = validated;

    /* Intitulé provisoire : nom du projet dans BDS s'il existe */
    const known =
      db.projects.find(
        p =>
          normalise(p.code) ===
          normalise(budgetName)
      );

    const intitule =
      normalise(known?.name) ||
      "À COMPLÉTER";

    return {
      ref:
        budget.ref,

      budget:
        budgetName,

      ht,
      intitule,
      ttc,
      validated,
      entered,

      source:
        budget
    };
  }

  /* -------------------------------------------------------
     COLONNES
     ------------------------------------------------------- */

  const columns = [
    {
      key: "ref",
      title: "RÉFÉRENCE",
      width: 210
    },

    {
      key: "budget",
      title: "PROJET",
      width: 260
    },

    {
      key: "intitule",
      title: "INTITULÉ",
      width: 260
    },

    {
      key: "ttc",
      title: "MONTANT TTC",
      width: 150,
      number: true
    },

    {
      key: "validated",
      title: "VALIDÉ LE",
      width: 140
    },

    {
      key: "entered",
      title: "SAISI LE",
      width: 140
    }
  ];

  /* -------------------------------------------------------
     ÉTAT RECHERCHE / TRI
     ------------------------------------------------------- */

  const state = {
    sortKey: "",
    sortDirection: 1,

    search: {
      ref: "",
      budget: "",
      intitule: "",
      ttc: "",
      validated: "",
      entered: ""
    }
  };

  const thead =
    table.querySelector(
      "thead"
    );

  const tbody =
    table.querySelector(
      "tbody"
    );

  /* -------------------------------------------------------
     ENTÊTES
     ------------------------------------------------------- */

  thead.innerHTML = `
    <tr>

      ${
        columns.map(
          column => `
            <th
              class="
                bdg-list-head
                ${
                  column.number
                    ? "number"
                    : ""
                }
              "
              data-bdg-column="${column.key}"
              style="
                width:${column.width}px;
                min-width:${column.width}px;
              "
            >

              <div
                class="bdg-head-content"
              >

                <span class="bdg-head-label">${column.title}</span>
                <button type="button" class="bdg-head-action" data-bdg-menu="${column.key}"
                  title="Trier / rechercher"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M1 2h11M3 5h7M5 8h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M4.5 10l2 2.2 2-2.2z" fill="currentColor"/></svg></button>

              </div>

              <span
                class="bdg-column-resizer"
                data-bdg-resize="${column.key}"
              ></span>

            </th>
          `
        ).join("")
      }

      <th
        style="
          width:75px;
          min-width:75px;
        "
      ></th>

    </tr>
  `;

  /* -------------------------------------------------------
     RENDU DES LIGNES
     ------------------------------------------------------- */
  /* ---- PANNEAU DES DATES (à gauche) ---- */

  let dateFilter = "";

  let panel = $("bdgDatePanel");

  if (!panel) {
    const wrap = table.closest(".novapp-budget-table-wrap");
    const layout = document.createElement("div");

    layout.className = "novapp-budget-layout";
    wrap.parentNode.insertBefore(layout, wrap);

    panel = document.createElement("aside");
    panel.id = "bdgDatePanel";
    panel.className = "novapp-date-panel";

    layout.appendChild(panel);
    layout.appendChild(wrap);
  }

  function renderDatePanel() {
    const counts = new Map();

    budgets.forEach(b => {
      const d = budgetDate(b.ref);
      if (!d) return;

      const c = counts.get(d.key) || { label: d.label, n: 0 };
      c.n++;
      counts.set(d.key, c);
    });

    const keys = [...counts.keys()].sort().reverse();

    panel.innerHTML = `
      <div class="novapp-date-head">
        <button type="button" class="novapp-date-filter">TOUT ▾</button>
      </div>
      <div class="novapp-date-list">
        ${keys.map(k => `
          <button type="button" data-date="${k}"
            class="novapp-date-item ${dateFilter === k ? "selected" : ""}">
            <span>${counts.get(k).label}</span>
            ${svCnt(counts.get(k).n)}
          </button>
        `).join("")}
      </div>
    `;
  }

  panel.onclick = event => {
    const item = event.target.closest("[data-date]");

    if (item) {
      dateFilter = dateFilter === item.dataset.date ? "" : item.dataset.date;
    } else if (event.target.closest(".novapp-date-filter")) {
      dateFilter = "";
    } else {
      return;
    }

    renderDatePanel();
    renderRows();
  };

  renderDatePanel();


  function renderRows() {
    let data =
      budgets.map(
        budget =>
          budgetData(budget)
      );

    if (dateFilter) {
      data = data.filter(item => {
        const d = budgetDate(item.ref);
        return d && d.key === dateFilter;
      });
    }


     
    /* FILTRES */

    Object.entries(
      state.search
    ).forEach(
      ([key, search]) => {

        const query =
          normalise(search)
            .toLowerCase();

        if (!query) return;

        data =
          data.filter(item => {

            let value =
              key === "ref" ? item.budget + " " + item.ref : item[key];

            if (
              key === "ht" ||
              key === "ttc"
            ) {
              value =
                money(value);
            }

            return normalise(value)
              .toLowerCase()
              .includes(query);
          });
      }
    );

    /* TRI */

    if (state.sortKey) {
      const key =
        state.sortKey;

      data.sort((a, b) => {

        if (
          key === "ht" ||
          key === "ttc"
        ) {
          return (
            (
              num(a[key]) -
              num(b[key])
            ) *
            state.sortDirection
          );
        }

        return (
          normalise(a[key])
            .localeCompare(
              normalise(b[key]),
              "fr",
              {
                numeric: true,
                sensitivity: "base"
              }
            ) *
          state.sortDirection
        );
      });
    }

    /* compteur du titre : budgets affichés (filtres compris) */
    { const c = $("bdgListCount"); if (c) c.innerHTML = svCnt(data.length); }

    if (!data.length) {
      tbody.innerHTML = `
        <tr>
          <td
            colspan="7"
            class="empty"
          >
            AUCUN BUDGET
          </td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML =
      data.map(item => `
        <tr
          data-budget-ref="${esc(item.ref)}"
        >

          <td>
            <span class="bang-slot">${obsBang(item.ref)}</span>${esc(item.budget + " " + item.ref)}
          </td>

          <td title="${esc(item.budget)}">
            <button
              type="button"
              class="budget-link"
              data-open-project="${esc(item.ref)}"
            >
              ${esc(item.budget)}
            </button>
          </td>

          <td title="${esc(item.intitule)}">
            ${esc(item.intitule)}
          </td>

          <td class="number">
            ${money(item.ttc)}
          </td>

          <td>
            ${esc(item.validated)}
          </td>

          <td>
            ${esc(item.entered)}
          </td>

          <td class="bdg-action-cell">

            <button
              type="button"
              class="bdg-row-action"
              data-print-budget="${esc(item.ref)}"
              title="Imprimer"
              aria-label="Imprimer"
            >
              🖨
            </button>

          </td>

        </tr>
      `).join("");
  }

  /* -------------------------------------------------------
     RESTAURATION D'UN ENTÊTE
     ------------------------------------------------------- */

  function restoreHeader(key) {
    const column =
      columns.find(
        item =>
          item.key === key
      );

    const th =
      thead.querySelector(
        `[data-bdg-column="${key}"]`
      );

    if (!column || !th) return;

    const content =
      th.querySelector(
        ".bdg-head-content"
      );

    if (!content) return;

    content.innerHTML = `
      <span class="bdg-head-label">${column.title}</span>
      <button type="button" class="bdg-head-action" data-bdg-menu="${key}"
        title="Trier / rechercher"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M1 2h11M3 5h7M5 8h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M4.5 10l2 2.2 2-2.2z" fill="currentColor"/></svg></button>`;
    /* en-tête bleu quand un tri ou une recherche est choisi (comme le budget) */
    th.classList.toggle("cf-on", !!state.search[key] || state.sortKey === key);
  }

  /* -------------------------------------------------------
     RECHERCHE DANS L'ENTÊTE
     ------------------------------------------------------- */

  function activateSearch(key) {
    const column =
      columns.find(
        item =>
          item.key === key
      );

    const th =
      thead.querySelector(
        `[data-bdg-column="${key}"]`
      );

    if (!column || !th) return;

    const content =
      th.querySelector(
        ".bdg-head-content"
      );

    if (!content) return;

    content.innerHTML = `
      <input
        type="search"
        class="bdg-column-search"
        data-bdg-search-input="${key}"
        value="${esc(state.search[key])}"
        placeholder="${column.title}"
        autocomplete="off"
      >
    `;

    const input =
      content.querySelector(
        "input"
      );

    if (!input) return;

    input.focus();

    try {
      input.setSelectionRange(
        input.value.length,
        input.value.length
      );
    } catch (_) {}

    input.addEventListener(
      "input",
      () => {

        state.search[key] =
          input.value;

        renderRows();

        /*
          Dès que la zone devient vide,
          on revient à l'intitulé.
        */

        if (
          input.value === ""
        ) {
          restoreHeader(key);
        }
      }
    );

    input.addEventListener(
      "search",
      () => {

        state.search[key] =
          input.value;

        renderRows();

        if (
          input.value === ""
        ) {
          restoreHeader(key);
        }
      }
    );

    input.addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Escape"
        ) {
          state.search[key] = "";
          renderRows();
          restoreHeader(key);
        }
      }
    );
  }

  /* -------------------------------------------------------
     CLICS SUR ENTÊTES
     ------------------------------------------------------- */

  /* menu de colonne (comme dans le budget) : tri croissant / décroissant,
     recherche, effacer */
  const closeListMenu = () => document.getElementById("bdgListMenu")?.remove();
  const openListMenu = (key, btn) => {
    closeListMenu();
    const column = columns.find(c => c.key === key);
    if (!column) return;
    const m = document.createElement("div");
    m.id = "bdgListMenu";
    m.className = "bdg-list-menu";
    m.innerHTML = `
      <div class="blm-title">${esc(column.title)}</div>
      <button type="button" data-lm="asc" class="${state.sortKey === key && state.sortDirection === 1 ? "on" : ""}">↑ TRI CROISSANT</button>
      <button type="button" data-lm="desc" class="${state.sortKey === key && state.sortDirection === -1 ? "on" : ""}">↓ TRI DÉCROISSANT</button>
      <input type="search" class="blm-q" placeholder="RECHERCHER…" autocomplete="off" value="${esc(state.search[key] || "")}">
      <button type="button" data-lm="clear">EFFACER</button>`;
    document.body.appendChild(m);
    const r = btn.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(window.innerWidth - m.offsetWidth - 8, r.right - m.offsetWidth)) + "px";
    m.style.top = (r.bottom + 4) + "px";
    const q = m.querySelector(".blm-q");
    const apply = () => { columns.forEach(c => restoreHeader(c.key)); renderRows(); };
    q.addEventListener("input", () => { state.search[key] = q.value; apply(); });
    m.addEventListener("click", e => {
      const b = e.target.closest("[data-lm]");
      if (!b) return;
      const a = b.dataset.lm;
      if (a === "asc" || a === "desc") {
        const d = a === "asc" ? 1 : -1;
        if (state.sortKey === key && state.sortDirection === d) state.sortKey = "";
        else { state.sortKey = key; state.sortDirection = d; }
      } else {
        state.search[key] = "";
        if (state.sortKey === key) state.sortKey = "";
      }
      apply();
      closeListMenu();
    });
    setTimeout(() => document.addEventListener("pointerdown", function off(e) {
      if (!e.target.closest("#bdgListMenu")) { closeListMenu(); document.removeEventListener("pointerdown", off, true); }
    }, true), 0);
  };

  thead.onclick = event => {
    const b = event.target.closest("[data-bdg-menu]");
    if (!b) return;
    event.preventDefault();
    event.stopPropagation();
    openListMenu(b.dataset.bdgMenu, b);
  };

  /* -------------------------------------------------------
     LARGEUR DES COLONNES AJUSTABLE
     ------------------------------------------------------- */

  thead
    .querySelectorAll(
      ".bdg-column-resizer"
    )
    .forEach(resizer => {

      resizer.addEventListener(
        "pointerdown",
        event => {

          event.preventDefault();
          event.stopPropagation();

          const th =
            resizer.closest("th");

          if (!th) return;

          const startX =
            event.clientX;

          const startWidth =
            th.getBoundingClientRect()
              .width;

          resizer.classList.add(
            "active"
          );

          try {
            resizer.setPointerCapture(
              event.pointerId
            );
          } catch (_) {}

          const move =
            moveEvent => {

              const newWidth =
                Math.max(
                  80,
                  startWidth +
                  (
                    moveEvent.clientX -
                    startX
                  )
                );

              th.style.width =
                newWidth + "px";

              th.style.minWidth =
                newWidth + "px";
            };

          const stop =
            stopEvent => {

              resizer.classList.remove(
                "active"
              );

              resizer.removeEventListener(
                "pointermove",
                move
              );

              resizer.removeEventListener(
                "pointerup",
                stop
              );

              resizer.removeEventListener(
                "pointercancel",
                stop
              );

              try {
                resizer
                  .releasePointerCapture(
                    stopEvent.pointerId
                  );
              } catch (_) {}
            };

          resizer.addEventListener(
            "pointermove",
            move
          );

          resizer.addEventListener(
            "pointerup",
            stop
          );

          resizer.addEventListener(
            "pointercancel",
            stop
          );
        }
      );
    });

  /* -------------------------------------------------------
     DÉTAIL D'UN BUDGET
     ------------------------------------------------------- */

  function openBudgetDetail(ref) {
    const budget =
      groups.get(ref);

    if (!budget) return;
    /* dernier budget consulté : rouvert à la prochaine ouverture */
    try { localStorage.setItem("svi_lastbdg_v1", ref); } catch (e) {}

    /* balayage gauche / droite : budget suivant / précédent (ordre des références) */
    {
      const refs = [...groups.keys()].sort((x, y) => String(x).localeCompare(String(y), "fr", { numeric: true }));
      window.__sviBdgNav = { refs, cur: ref, open: openBudgetDetail };
      if (!window.__sviSwipe) {
        window.__sviSwipe = true;
        let st = null;
        const scrollsX = el => {
          for (let n = el; n && n !== document.body; n = n.parentElement) {
            if (n.scrollWidth > n.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(n).overflowX)) return true;
          }
          return false;
        };
        document.addEventListener("touchstart", e => {
          const nav = window.__sviBdgNav;
          if (!nav || e.touches.length !== 1 || !document.querySelector(".bdg-d-page")) { st = null; return; }
          const t = e.target;
          /* pas depuis un tableau qui défile, une fenêtre, un champ ou une poignée */
          if (scrollsX(t) || t.closest("#docPop, #blkPop, #cfMenu, #blkMenu, input, textarea, select, .blk-rsz, .blk-grip, .col-rs, th")) { st = null; return; }
          st = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
        }, { passive: true });
        document.addEventListener("touchend", e => {
          const nav = window.__sviBdgNav;
          if (!st || !nav) return;
          const dx = e.changedTouches[0].clientX - st.x, dy = e.changedTouches[0].clientY - st.y;
          const quick = Date.now() - st.t < 700;
          st = null;
          if (!quick || Math.abs(dx) < 90 || Math.abs(dy) > Math.abs(dx) * 0.5) return;
          const i = nav.refs.indexOf(nav.cur);
          const j = dx < 0 ? i + 1 : i - 1;
          if (i < 0 || j < 0 || j >= nav.refs.length) return;
          nav.open(nav.refs[j]);
          window.scrollTo(0, 0);
        }, { passive: true });
      }
    }

    /* écran liste à restaurer au retour (même après un balayage entre budgets) */
    const listHTML = shell.querySelector(".bdg-d-page")
      ? (window.__sviListHTML || shell.innerHTML)
      : (window.__sviListHTML = shell.innerHTML);

    /* ---- lecture tolérante des colonnes (accents, espaces, / ignorés) ---- */

    const nk = s =>
      String(s ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");

    const pick = (row, names) => {
      const keys = Object.keys(row);

      for (const name of names) {
        const target = nk(name);

        const key =
          keys.find(k => nk(k) === target);

        if (
          key !== undefined &&
          normalise(row[key]) !== ""
        ) {
          return row[key];
        }
      }

      return "";
    };

    const colIndex = letter =>
      letter
        .toUpperCase()
        .split("")
        .reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

    const byLetter = (row, letter) =>
      row.__cols
        ? normalise(row.__cols[colIndex(letter)])
        : "";

    const typeKey =
      Object.keys(budget.rows[0] || {})
        .find(k => {
          const n = nk(k);
          return n.includes("CHG") && n.includes("PRD");
        });

    const kindOf = row => {
      const t =
        nk(typeKey ? row[typeKey] : "");

      if (t.startsWith("PRD") || t.startsWith("PROD")) {
        return "prd";
      }

      if (t.startsWith("CHG") || t.startsWith("CHARGE")) {
        return "chg";
      }

      return "";
    };

    const toLine = (row, i) => {
      const kind = kindOf(row);

      const nbr = pick(row, ["NBR"]);

      const dims = [
        pick(row, ["DIM1"]),
        pick(row, ["DIM2"]),
        pick(row, ["DIM3"])
      ];

      const price =
        num(pick(row, ["PUB", "PRIX", "PU"]));

      let qty =
        num(pick(row, ["QTB", "QUANTITE"]));

      if (kind === "prd" && !qty) {
        const factors =
          [nbr, ...dims]
            .filter(v => normalise(v) !== "")
            .map(num);

        if (factors.length) {
          qty =
            factors.reduce(
              (a, b) => a * b,
              1
            );
        }
      }

      /* les prix / montants de la feuille sont TTC :
         le HT est déduit avec la TVA de la ligne (20 % par défaut) */
      const ttcAmount =
        price
          ? qty * price
          : num(pick(row, ["MNB", "MONTANT", "MPB"]));
      const tvaRate = 20;

      return {
        id: "l" + i,
        kind,
        article:
          byLetter(row, "H") || pick(row, ["ARTICLE", "N°"]),
        designation:
          byLetter(row, "I") || pick(row, ["DESIGNATION"]),
        unit:
          byLetter(row, "J") || pick(row, ["UTB", "UNITE"]),
        /* unité des onglets Détail charge / produit :
           colonne Q de la feuille BDG */
        dunit: byLetter(row, "Q"),
        detail:
          pick(row, ["DETAIL BUDGET"]) ||
          byLetter(row, "I") ||
          pick(row, ["DESIGNATION"]),
        /* préfixe « 01 - » retiré : les libellés identiques
           sont ainsi regroupés en une seule entrée */
        lot: stripLevelPrefix(
          byLetter(row, "K") || pick(row, ["LOT"])
        ).trim(),
        prim: stripLevelPrefix(
          byLetter(row, "N") || pick(row, ["ACTIVITE PRIMAIRE"])
        ).trim(),
        sec: stripLevelPrefix(
          byLetter(row, "L") || pick(row, ["ACTIVITE"])
        ).trim(),
        cqty: num(byLetter(row, "V")),
        cprice: num(byLetter(row, "W")),
        nbr,
        dims,
        qty,
        priceTTC: price,
        ttcAmount,
        price: price / (1 + tvaRate / 100),
        amount: ttcAmount / (1 + tvaRate / 100),
        tva: tvaRate
      };
    };

    const lines =
      budget.rows.map(toLine);

    /* lignes identiques (même type, article, désignation, unité)
       regroupées à l'affichage */
    /* Détail charges : regroupées par désignation + unité (article ignoré) ;
       Détail produits : PAS de regroupement, une ligne de la feuille = une ligne */
    const gidOf = l =>
      (l.kind === "chg"
        ? [l.kind, l.detail, l.dunit]
        : [l.kind, l.id])
        .map(v => String(v ?? "").trim().toUpperCase())
        .join("|");

    const groupMembers = new Map();
    lines.forEach(l => {
      l.gid = gidOf(l);
      if (!groupMembers.has(l.gid)) groupMembers.set(l.gid, []);
      groupMembers.get(l.gid).push(l);
    });

    const groupLines = list => {
      const m = new Map();
      list.forEach(l => {
        if (!m.has(l.gid)) m.set(l.gid, []);
        m.get(l.gid).push(l);
      });
      return [...m.entries()].map(([gid, ms]) => {
        const f = ms[0];
        const qty = ms.reduce((t, l) => t + l.qty, 0);
        const amount = ms.reduce((t, l) => t + l.amount, 0);
        const tvaAmt = ms.reduce((t, l) => t + tvaFor(l), 0);
        const prices = new Set(ms.map(l => l.price));
        const same = v => new Set(ms.map(v)).size === 1 ? v(f) : "";
        return {
          gid, members: ms,
          /* Détail charge : article toujours vide ;
             Détail produit : vide si des articles différents sont fusionnés */
          article: f.kind === "chg" ? "" : same(l => l.article),
          detail: f.detail, unit: f.dunit,
          nbr: same(l => l.nbr),
          dims: [0, 1, 2].map(i => same(l => l.dims[i])),
          qty, amount, tvaAmt,
          /* prix identique, sinon prix moyen pondéré = montant / quantité */
          price: prices.size === 1 ? f.price : (qty ? amount / qty : 0),
          tva: same(l => l.tva)
        };
      });
    };

    /* désignations choisies en haut (filtrent le bas) */
    const selDesig = new Set();
    /* lignes choisies dans Détail charge / produit (filtrent le haut) */
    const selRows = new Set();
    /* lots / tâches choisis dans les colonnes du bas */
    const hSel = {
      lot: new Set(),
      prim: new Set(),
      sec: new Set()
    };

    const desigKey = l => l.article + "||" + l.designation;

    const inSet = (set, v) => !set.size || set.has(v);

    /* ce qu'apportent les lignes sélectionnées en bas */
    const rowSet = field => {
      const out = new Set();
      selRows.forEach(gid => {
        (groupMembers.get(gid) || []).forEach(l => {
          if (String(field(l)).trim() !== "") out.add(field(l));
        });
      });
      return out;
    };

    /* filtres de colonne propagés aux autres blocs :
       client = désignations visibles du tableau client filtré,
       det    = attributs des lignes visibles de Détail charges / produits filtrés,
       h      = valeurs gardées dans les colonnes lots / activités */
    let CONS = { client: null, det: null, h: {} };
    let lastClientKeys = new Set();

    const cons = (l, skip) => {
      const c = CONS;
      if (skip !== "client" && c.client && !c.client.has(desigKey(l))) return false;
      if (skip !== "detail" && c.det && !(
        c.det.d.has(desigKey(l)) &&
        inSet(c.det.lot, l.lot) &&
        inSet(c.det.prim, l.prim) &&
        inSet(c.det.sec, l.sec)
      )) return false;
      for (const lv of ["lot", "prim", "sec"]) {
        const set = c.h[lv];
        if (skip !== lv && set && !set.has(cfText(stripLevelPrefix(l[lv])))) return false;
      }
      return true;
    };

    const hierOK = l =>
      inSet(hSel.lot, l.lot) &&
      inSet(hSel.prim, l.prim) &&
      inSet(hSel.sec, l.sec);

    /* tableau du haut : reste entier quand on y clique ;
       filtré par la hiérarchie et par les lignes choisies en bas */
    const clientLines = () => {
      const rd = rowSet(desigKey);
      return lines.filter(l => hierOK(l) && inSet(rd, desigKey(l)) && cons(l, "client"));
    };

    /* onglets du bas : restent entiers quand on y clique ;
       filtrés par la hiérarchie et par les désignations choisies en haut */
    const visibleLines = () =>
      lines.filter(l => hierOK(l) && inSet(selDesig, desigKey(l)) && cons(l, "detail"));

    const byKindNow = () => {
      const v = visibleLines();
      return {
        chg: v.filter(l => l.kind === "chg"),
        prd: v.filter(l => l.kind === "prd")
      };
    };

    const unclassified =
      lines.filter(l => !l.kind).length;

    const tabs = [
      { key: "chg", title: "DÉTAIL CHARGES" },
      { key: "prd", title: "DÉTAIL PRODUITS" },
      { key: "qlt", title: "DÉTAIL QUALITÉ" },
      { key: "dly", title: "DÉTAIL DÉLAIS" }
    ];

    /* dernier onglet du détail ouvert (charges, produits, qualité, délais) */
    let active = "chg";
    try {
      const t = localStorage.getItem("svi_dtab_v1");
      if (["chg", "prd", "qlt", "dly"].includes(t)) active = t;
    } catch (e) {}
    /* référence affichée du budget : « H88 BDG 26-1001/001 » */
    const fullRef = String(budget.project).trim().toUpperCase() + " " + ref;

    /* ---- squelette de l'écran ---- */

    shell.innerHTML = `

      <div class="bdg-d-sticky">

      <div class="novapp-list-titlebar">

        <button
          type="button"
          class="novapp-menu open-menu"
          aria-label="Menu"
        >
          ☰
        </button>

        <button
          type="button"
          id="budgetBackBtn"
          class="novapp-menu"
          aria-label="Retour"
        >
          ←
        </button>

        <h1 class="bdg-d-h1">
          ${esc(budget.project)}
        </h1>

        <div class="bdg-d-hright">
          <button type="button" class="bdg-lay-btn" id="layResetBtn" hidden
            title="Disposition par défaut : remettre les blocs à leur place et taille d'origine"
            aria-label="Disposition par défaut"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M4 3.8v4.6h4.6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <button type="button" class="bdg-alert-btn" id="obsAlertBtn" hidden
            aria-label="Observations importantes" title="Observations importantes">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2 2.6 19.5h18.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9.5v4.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16.9" r="1.15" fill="currentColor"/></svg>
            <span class="bdg-alert-n" id="obsAlertN"></span>
          </button>
        </div>

      </div>

      <div class="bdg-d-head">

        <div class="bdg-d-ref">
          <span><span id="refBang">${obsBang(ref)}</span>${esc(fullRef)}</span>
          <span class="bdg-d-badge" id="histBtn" role="button" title="Historique">H</span>
        </div>

        <div class="bdg-d-pills">
          <span class="bdg-d-pill bdg-d-pill-btn" data-pill="doc" role="button">${SVI_ICON.doc}<span class="pl">DOC ${svCnt(0)}</span></span>
          <span class="bdg-d-pill bdg-d-pill-btn" data-pill="taf" role="button">${SVI_ICON.taf}<span class="pl">TAF ${svCnt(0)}</span></span>
          <span class="bdg-d-pill bdg-d-pill-btn" data-pill="obs" role="button">${SVI_ICON.obs}<span class="pl">OBS ${svCnt(0)}</span></span>
          <span class="bdg-d-pill bdg-d-pill-btn" data-pill="inf" role="button">${SVI_ICON.inf}<span class="pl">INF</span></span>
        </div>

      </div>
      </div>

      <div class="bdg-d-page">

        <div class="bdg-d-block blk-client">
          <div class="bdg-d-block-title blk-head" id="bdgClientTitle">
            <span class="ttl">${SVI_ICON.client}DÉSIGNATIONS CLIENT</span>
            <span class="blk-tools">
              <button type="button" class="blk-btn" data-blk="client" data-act="import" title="Importer"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <button type="button" class="blk-btn" data-blk="client" data-act="export" title="Exporter"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10V2M4.5 5.5 8 2l3.5 3.5M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <button type="button" class="blk-btn" data-blk="client" data-act="pdf" title="Aperçu PDF"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5h5.5L12.5 4.5v10h-8.5z M9.5 1.5v3h3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6 8.5h4.5M6 11h4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>
              <button type="button" class="blk-btn blk-max-btn" data-blk="client" data-act="max" title="Agrandir / réduire"><svg class="ic-max" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6.5v-4h4M2.5 2.5l4.5 4.5M13.5 9.5v4h-4M13.5 13.5 9 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><svg class="ic-min" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M7 3v4H3M7 7 2.5 2.5M9 13V9h4M9 9l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            </span>
          </div>
          <div class="bdg-d-scroll bdg-d-client-scroll">
            <table class="bdg-d-table">
              <colgroup id="bdgClientCols"></colgroup>
              <thead id="bdgClientHead"></thead>
              <tbody id="bdgClientBody"></tbody>
              <tfoot id="bdgClientFoot"></tfoot>
            </table>
          </div>
        </div>

        <div class="bdg-d-block blk-hier">
          <div class="bdg-d-block-title blk-head">
            <span class="ttl">${SVI_ICON.hier}TÂCHES</span>
            <span class="blk-tools">
              <button type="button" class="blk-btn" data-blk="hier" data-act="import" title="Importer"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <button type="button" class="blk-btn" data-blk="hier" data-act="export" title="Exporter"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10V2M4.5 5.5 8 2l3.5 3.5M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <button type="button" class="blk-btn" data-blk="hier" data-act="pdf" title="Aperçu PDF"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5h5.5L12.5 4.5v10h-8.5z M9.5 1.5v3h3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6 8.5h4.5M6 11h4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>
              <button type="button" class="blk-btn blk-max-btn" data-blk="hier" data-act="max" title="Agrandir / réduire"><svg class="ic-max" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6.5v-4h4M2.5 2.5l4.5 4.5M13.5 9.5v4h-4M13.5 13.5 9 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><svg class="ic-min" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M7 3v4H3M7 7 2.5 2.5M9 13V9h4M9 9l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            </span>
          </div>
          <div class="bdg-h-grid" id="bdgHier"></div>
        </div>

        <div class="bdg-d-tabs" id="bdgTabs">
          ${
            tabs.map(t => `
              <button
                type="button"
                class="bdg-d-tab"
                data-tab="${t.key}"
              >
                ${SVI_ICON[t.key] || ""}${t.title}
              </button>
            `).join("")
          }
          <span class="blk-tools">
              <button type="button" class="blk-btn" data-blk="detail" data-act="import" title="Importer"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <button type="button" class="blk-btn" data-blk="detail" data-act="export" title="Exporter"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10V2M4.5 5.5 8 2l3.5 3.5M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <button type="button" class="blk-btn" data-blk="detail" data-act="pdf" title="Aperçu PDF"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5h5.5L12.5 4.5v10h-8.5z M9.5 1.5v3h3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6 8.5h4.5M6 11h4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>
              <button type="button" class="blk-btn blk-max-btn" data-blk="detail" data-act="max" title="Agrandir / réduire"><svg class="ic-max" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6.5v-4h4M2.5 2.5l4.5 4.5M13.5 9.5v4h-4M13.5 13.5 9 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><svg class="ic-min" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M7 3v4H3M7 7 2.5 2.5M9 13V9h4M9 9l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            </span>
        </div>

        <div class="bdg-d-block bdg-d-tabbody" id="bdgTabBody"></div>

        <div class="bdg-d-block blk-rec blk-suivi" data-rec="suivi">
          <div class="bdg-d-block-title blk-head">
            <span class="rec-tabs">
              <button type="button" class="rec-tab" data-rtab="doc" id="recTitle-doc">${SVI_ICON.doc}DOCUMENTS ${svCnt(0)}</button>
              <button type="button" class="rec-tab" data-rtab="taf" id="recTitle-taf">${SVI_ICON.taf}TAF ${svCnt(0)}</button>
              <button type="button" class="rec-tab" data-rtab="obs" id="recTitle-obs">${SVI_ICON.obs}OBSERVATIONS ${svCnt(0)}</button>
            </span>
            <span class="blk-tools">
              <button type="button" class="blk-btn" data-blk="suivi" data-act="export" title="Exporter"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10V2M4.5 5.5 8 2l3.5 3.5M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <button type="button" class="blk-btn" data-blk="suivi" data-act="pdf" title="Aperçu PDF"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5h5.5L12.5 4.5v10h-8.5z M9.5 1.5v3h3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6 8.5h4.5M6 11h4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>
              <button type="button" class="blk-btn blk-max-btn" data-blk="suivi" data-act="max" title="Agrandir / réduire"><svg class="ic-max" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6.5v-4h4M2.5 2.5l4.5 4.5M13.5 9.5v4h-4M13.5 13.5 9 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><svg class="ic-min" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M7 3v4H3M7 7 2.5 2.5M9 13V9h4M9 9l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            </span>
          </div>
          <div class="rec-scroll" data-pane="doc"><table class="bdg-d-table rec-table" id="recTable-doc"></table></div>
          <div class="rec-scroll" data-pane="taf" hidden><table class="bdg-d-table rec-table" id="recTable-taf"></table></div>
          <div class="rec-scroll" data-pane="obs" hidden><table class="bdg-d-table rec-table" id="recTable-obs"></table></div>
        </div>


      </div>
    `;

    const body = $("bdgTabBody");

    /* ===== tri et filtre par colonne (façon tableur) ===== */
    const CF = {};          /* CF[table] = { sort:{col,dir}|null, f:{col:Set} } */
    const cfSrc = {};       /* dernières lignes et colonnes de chaque tableau */
    const cfT = t => CF[t] || (CF[t] = { sort: null, f: {} });
    const cfText = v =>
      typeof v === "number" ? money(v) : String(v ?? "").trim();
    const cfIcon =
      `<svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
         <path d="M1 2h11M3 5h7M5 8h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
         <path d="M4.5 10l2 2.2 2-2.2z" fill="currentColor"/>
       </svg>`;

    /* ===== ordre manuel des lignes (glisser une ligne après un appui long) :
       désignations client, lots, activités primaires et secondaires ===== */
    const RO_KEY = "svi_roworder_v1:" + String(ref);
    const roLoad = () => {
      try { return JSON.parse(localStorage.getItem(RO_KEY) || "{}") || {}; } catch (e) { return {}; }
    };
    const roSave = o => { try { localStorage.setItem(RO_KEY, JSON.stringify(o)); } catch (e) {} };
    /* appliqué quand aucun tri n'est choisi sur ce tableau */
    const roApply = (t, arr, keyOf) => {
      const st = CF[t];
      if (st && st.sort && !st.sort.def) return arr;
      const order = roLoad()[t];
      if (!order || !order.length) return arr;
      const pos = new Map(order.map((k, i) => [k, i]));
      return arr.map((x, i) => ({ x, i }))
        .sort((a, b) => {
          const pa = pos.has(keyOf(a.x)) ? pos.get(keyOf(a.x)) : Infinity;
          const pb = pos.has(keyOf(b.x)) ? pos.get(keyOf(b.x)) : Infinity;
          return pa - pb || a.i - b.i;
        }).map(o => o.x);
    };

    /* cols : [cle, libellé, accesseur, classe] */
    const cfApply = (t, cols, rows, keepSrc = false) => {
      if (!keepSrc) cfSrc[t] = { cols, rows };
      const st = cfT(t);
      let out = rows.filter(r =>
        cols.every(([k, , get]) =>
          !st.f[k] || st.f[k].has(cfText(get(r)))
        )
      );
      if (st.sort) {
        const c = cols.find(c => c[0] === st.sort.col);
        if (c) {
          const get = c[2];
          const dir = st.sort.dir === "desc" ? -1 : 1;
          out = [...out].sort((a, b) => {
            const x = get(a), y = get(b);
            const r = typeof x === "number" && typeof y === "number"
              ? x - y
              : String(x ?? "").localeCompare(String(y ?? ""), "fr", { numeric: true });
            return r * dir;
          });
        }
      }
      return out;
    };

    const cfHead = (t, key, label, cls = "") => {
      const st = cfT(t);
      /* en-tête de colonne bleu : filtre ou tri choisi sur cette colonne */
      const on = !!st.f[key] || !!(st.sort && st.sort.col === key && !st.sort.def);
      return `<th class="${cls} ${on ? "cf-on" : ""}">
        <span class="cf-wrap"><span class="cf-lab">${label}</span><span class="cf-btn" data-cf="${t}" data-col="${key}"
          role="button" aria-label="Trier / filtrer">${cfIcon}</span></span><span
          class="col-rs" data-rs="${t}" data-col="${key}"></span></th>`;
    };

    /* ===== largeurs de colonnes : fixes, réglables, mémorisées ===== */
    const CW_KEY = "svi_colw_v1";
    const cwLoad = () => {
      try { return JSON.parse(localStorage.getItem(CW_KEY) || "{}") || {}; }
      catch (e) { return {}; }
    };
    const cwSave = obj => {
      try { localStorage.setItem(CW_KEY, JSON.stringify(obj)); } catch (e) {}
    };
    const CW_DEF = {
      article: 70, designation: 330, detail: 300, unit: 70,
      qty: 100, price: 95, ht: 120, amount: 120, tva: 80, ttc: 130,
      nbr: 60, d1: 60, d2: 60, d3: 60
    };
    const cwGet = (t, k) => cwLoad()[t + "." + k] || CW_DEF[k] || 100;

    /* colgroup + largeur totale de la table */
    const cwCols = (t, cols) =>
      cols.map(([k]) =>
        `<col data-w="${t}.${k}" style="width:${cwGet(t, k)}px">`
      ).join("");
    const cwTableW = (t, cols) =>
      cols.reduce((sum, [k]) => sum + cwGet(t, k), 0);

    /* ===== ordre des colonnes : glisser un en-tête, ordre mémorisé ===== */
    const CO_KEY = "svi_colorder_v1";
    const coLoad = () => {
      try { return JSON.parse(localStorage.getItem(CO_KEY) || "{}") || {}; }
      catch (e) { return {}; }
    };
    const coSave = obj => {
      try { localStorage.setItem(CO_KEY, JSON.stringify(obj)); } catch (e) {}
    };
    /* clés dans l'ordre choisi (colonnes inconnues gardées à la fin) */
    const coKeys = (t, keys) => {
      const saved = (coLoad()[t] || []).filter(k => keys.includes(k));
      return [...saved, ...keys.filter(k => !saved.includes(k))];
    };
    const coOrder = (t, cols) => {
      const order = coKeys(t, cols.map(c => c[0]));
      return order.map(k => cols.find(c => c[0] === k));
    };
    /* réordonne un tableau déjà dessiné (col, en-têtes, lignes, pied) */
    const coApply = (t, table) => {
      if (!table) return;
      const ths = [...table.querySelectorAll("thead tr:first-child > th")];
      const keys = ths.map(th => th.querySelector(".cf-btn")?.dataset.col);
      if (keys.some(k => !k)) return;
      const order = coKeys(t, keys);
      if (order.every((k, i) => k === keys[i])) return;
      const perm = order.map(k => keys.indexOf(k));
      const n = keys.length;
      const reorder = parent => {
        const kids = [...parent.children];
        if (kids.length !== n || kids.some(c => c.colSpan > 1)) return;
        perm.forEach(i => parent.appendChild(kids[i]));
      };
      table.querySelectorAll("colgroup").forEach(reorder);
      table.querySelectorAll("tr").forEach(reorder);
    };

    let cfOpen = null;   /* { t, key } du menu ouvert */
    let cfPlace = () => {};

    const cfClose = () => {
      window.visualViewport?.removeEventListener("resize", cfPlace);
      window.visualViewport?.removeEventListener("scroll", cfPlace);
      document.getElementById("cfMenu")?.remove();
      cfOpen = null;
    };

    const cfValues = (t, key) => {
      const src = cfSrc[t];
      if (!src) return [];
      const c = src.cols.find(c => c[0] === key);
      const st = cfT(t);
      /* lignes encore possibles : filtres par sélection (déjà appliqués
         aux lignes source) + filtres des AUTRES colonnes du tableau */
      const rows = src.rows.filter(r =>
        src.cols.every(([k, , get]) =>
          k === key || !st.f[k] || st.f[k].has(cfText(get(r)))
        )
      );
      const raw = rows.map(r => c[2](r));
      const num = raw.every(v => typeof v === "number");
      const uniqVals = [...new Set(raw.map(cfText))];
      if (num) {
        const back = new Map(raw.map(v => [cfText(v), v]));
        return uniqVals.sort((a, b) => back.get(a) - back.get(b));
      }
      return uniqVals.sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
    };

    const cfRenderList = () => {
      const m = document.getElementById("cfMenu");
      if (!m || !cfOpen) return;
      const { t, key } = cfOpen;
      const st = cfT(t);
      const q = (m.querySelector(".cf-q").value || "").trim().toUpperCase();
      const vals = cfValues(t, key).filter(v => !q || v.toUpperCase().includes(q));
      const isOn = v => !st.f[key] || st.f[key].has(v);
      /* valeurs cochées (filtre actif) remontées en tête de liste */
      if (st.f[key]) vals.sort((x, y) => isOn(y) - isOn(x));
      const allOn = vals.length && vals.every(isOn);
      m.querySelector(".cf-list").innerHTML =
        `<label class="cf-item cf-all"><input type="checkbox" data-cfall ${allOn ? "checked" : ""}>
           (Tout sélectionner)</label>` +
        (vals.length
          ? vals.map(v => `<label class="cf-item"><input type="checkbox" data-cfv="${esc(v)}"
               ${isOn(v) ? "checked" : ""}> ${esc(v || "(vide)")}</label>`).join("")
          : `<div class="cf-none">Aucune valeur</div>`);
      m.querySelectorAll(".cf-sort").forEach(b =>
        b.classList.toggle("on", !!st.sort && st.sort.col === key && st.sort.dir === b.dataset.dir)
      );
    };

    const cfAfterChange = () => {
      refreshAll();
      cfRenderList();
      cfPlace();
    };

    const cfOpenMenu = (btn) => {
      const t = btn.dataset.cf, key = btn.dataset.col;
      if (cfOpen && cfOpen.t === t && cfOpen.key === key) { cfClose(); return; }
      cfClose();
      cfOpen = { t, key };
      const m = document.createElement("div");
      m.id = "cfMenu";
      m.innerHTML = `
        <button type="button" class="cf-x" aria-label="Fermer">✕</button>
        <button type="button" class="cf-sort" data-dir="asc">↑ Tri croissant</button>
        <button type="button" class="cf-sort" data-dir="desc">↓ Tri décroissant</button>
        <div class="cf-search">🔍 <input type="search" class="cf-q" placeholder="Rechercher…"></div>
        <div class="cf-list"></div>
        <div class="cf-foot">
          <button type="button" class="cf-clear">Effacer</button>
          <button type="button" class="cf-ok">OK</button>
        </div>`;
      document.body.appendChild(m);

      cfPlace = () => {
        if (!document.body.contains(m)) return;
        /* l'en-tête est redessiné à chaque changement : on repart du
           bouton actuellement affiché pour garder le menu sous sa colonne */
        const live = document.querySelector(
          `.cf-btn[data-cf="${t}"][data-col="${key}"]`
        ) || btn;
        const r = live.getBoundingClientRect();
        if (!r.width && !r.height) return;
        const vv = window.visualViewport;
        const vTop = vv ? vv.offsetTop : 0;
        const vH = vv ? vv.height : window.innerHeight;
        const w = 240;
        m.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + "px";
        const below = vTop + vH - r.bottom - 10;
        const above = r.top - vTop - 10;
        const useBelow = below >= 280 || below >= above;
        /* jamais plus haut que 60 % de l'écran visible, et toujours
           entièrement visible (boutons OK / Effacer accessibles) */
        const maxH = Math.max(180, Math.min(vH * 0.6, useBelow ? below : above));
        m.style.maxHeight = maxH + "px";
        const realH = Math.min(maxH, m.scrollHeight);
        let top = useBelow ? r.bottom + 4 : r.top - 4 - realH;
        const h = Math.min(maxH, m.offsetHeight);
        top = Math.min(top, vTop + vH - 8 - h);
        m.style.top = Math.max(vTop + 8, top) + "px";
      };
      cfPlace();
      window.visualViewport?.addEventListener("resize", cfPlace);
      window.visualViewport?.addEventListener("scroll", cfPlace);

      m.addEventListener("click", e => {
        e.stopPropagation();
        const st = cfT(t);
        const sb = e.target.closest(".cf-sort");
        if (sb) {
          const same = st.sort && st.sort.col === key && st.sort.dir === sb.dataset.dir;
          st.sort = same ? null : { col: key, dir: sb.dataset.dir };
          cfAfterChange();
          return;
        }
        if (e.target.closest(".cf-ok") || e.target.closest(".cf-x")) {
          cfClose();
          return;
        }
        if (e.target.closest(".cf-clear")) {
          delete st.f[key];
          if (st.sort && st.sort.col === key) st.sort = null;
          m.querySelector(".cf-q").value = "";
          cfAfterChange();
        }
      });

      m.addEventListener("change", e => {
        const st = cfT(t);
        const all = cfValues(t, key);
        const q = (m.querySelector(".cf-q").value || "").trim().toUpperCase();
        const shown = all.filter(v => !q || v.toUpperCase().includes(q));
        let keep = st.f[key] ? new Set(st.f[key]) : new Set(all);
        if (e.target.matches("[data-cfall]")) {
          shown.forEach(v => e.target.checked ? keep.add(v) : keep.delete(v));
        } else if (e.target.matches("[data-cfv]")) {
          const v = e.target.dataset.cfv;
          e.target.checked ? keep.add(v) : keep.delete(v);
        } else {
          return;
        }
        if (keep.size === all.length) delete st.f[key]; else st.f[key] = keep;
        cfAfterChange();
      });

      let qTimer = null;
      m.querySelector(".cf-q").addEventListener("input", e => {
        cfRenderList();
        clearTimeout(qTimer);
        qTimer = setTimeout(() => {
          const st = cfT(t);
          const q = e.target.value.trim().toUpperCase();
          const all = cfValues(t, key);
          if (!q) delete st.f[key];
          else st.f[key] = new Set(all.filter(v => v.toUpperCase().includes(q)));
          refreshAll();
          cfRenderList();
          cfPlace();
        }, 350);
      });

      cfRenderList();
      /* placement APRÈS remplissage de la liste (hauteur réelle connue) */
      cfPlace();
      requestAnimationFrame(cfPlace);
    };

    /* fermeture du menu au toucher ailleurs (un seul écouteur actif) */
    if (window.__cfDocHandler) {
      document.removeEventListener("click", window.__cfDocHandler, true);
    }
    window.__cfDocHandler = e => {
      if (!cfOpen) return;
      if (e.target.closest("#cfMenu") || e.target.closest(".cf-btn")) return;
      cfClose();
    };
    document.addEventListener("click", window.__cfDocHandler, true);
    document.getElementById("cfMenu")?.remove();

    const renderClient = () => {
      const groupsMap = new Map();

      const U = v => String(v ?? "").trim().toUpperCase();
      const lineUnit = l => U(l.dunit) || U(l.unit);

      clientLines().forEach(l => {
        const key = desigKey(l);

        if (!groupsMap.has(key)) {
          groupsMap.set(key, {
            key,
            article: l.article,
            designation: l.designation,
            unit: l.unit,
            qty: 0,
            ht: 0,
            price: 0,
            members: []
          });
        }

        groupsMap.get(key).members.push(l);
      });

      groupsMap.forEach(g => {
        /* clé primaire = ligne PRODUIT au prix non nul (cherchée sur toutes
           les lignes de la désignation, même hors filtre) : elle donne le
           prix et l'unité de la désignation client (col. Q, sinon col. J) */
        const k = lines.find(l =>
          desigKey(l) === g.key &&
          l.kind === "prd" &&
          l.cprice !== 0
        );

        if (k) {
          g.price = k.cprice / 1.2;   /* prix de la feuille TTC → HT */
          g.unit = k.dunit || k.unit || g.unit;
        }

        /* quantité = somme des CLÉS PRIMAIRES uniquement : lignes PRODUIT
           au prix non nul. Les clés secondaires (prix nul : coffrage,
           ferraillage…) ne sont pas comptées, même dans la même unité */
        g.members.forEach(l => {
          if (l.kind === "prd" && l.cprice !== 0) g.qty += l.qty;
        });
        g.ht = g.qty * g.price;
      });

      const base = [...groupsMap.values()].sort((x, y) =>
        String(x.article).localeCompare(
          String(y.article),
          undefined,
          { numeric: true }
        )
      );

      const ccols = [
        ["article", "ART", g => g.article, "center"],
        ["designation", "DÉSIGNATION", g => g.designation, ""],
        ["unit", "UPB", g => g.unit, "center"],
        ["qty", "QPB", g => g.qty, "number"],
        ["price", "PPB", g => g.price, "number"],
        ["ht", "MPB HT", g => g.ht, "number"],
        ["tva", "TVA", () => "20,00 %", "number"],
        ["ttc", "MPB TTC", g => g.ht * 1.2, "number"]
      ];

      const shownClient = roApply("client", cfApply("client", ccols, base), g => g.key);
      lastClientKeys = new Set(shownClient.map(g => g.key));
      lastShown.client = { cols: ccols, rows: shownClient };
      /* compteur du titre : lignes affichées (filtres compris) */
      { const t = document.querySelector("#bdgClientTitle .ttl");
        if (t) t.innerHTML = SVI_ICON.client + "DÉSIGNATIONS CLIENT " + svCnt(shownClient.length); }
      const list = shownClient.sort((x, y) =>
        selDesig.has(y.key) - selDesig.has(x.key)
      );

      $("bdgClientCols").innerHTML = cwCols("client", ccols);
      $("bdgClientHead").closest("table").style.width =
        cwTableW("client", ccols) + "px";

      $("bdgClientHead").innerHTML =
        "<tr>" + ccols.map(([k, lab, , cls]) => cfHead("client", k, lab, cls)).join("") + "</tr>";

      const MIN_ROWS = 10;

      const filler = n =>
        Array.from({ length: Math.max(0, n) }, () =>
          `<tr class="bdg-d-filler">${"<td>&nbsp;</td>".repeat(8)}</tr>`
        ).join("");

      $("bdgClientBody").innerHTML =
        (list.length
          ? list.map(g => {
              const ht = g.ht;


              return `
                <tr data-desig="${esc(g.key)}"
                    class="${selDesig.has(g.key) ? "selected" : ""}">
                  <td class="center">${esc(g.article)}</td>
                  <td>${esc(g.designation)}</td>
                  <td class="center">${esc(g.unit)}</td>
                  <td class="number">${money(g.qty)}</td>
                  <td class="number">${money(g.price)}</td>
                  <td class="number">${money(ht)}</td>
                  <td class="number">20,00 %</td>
                  <td class="number">${money(ht * 1.2)}</td>
                </tr>
              `;
            }).join("")
          : `<tr><td colspan="8" class="empty">AUCUNE DÉSIGNATION</td></tr>` +
            "");

      const cHT = list.reduce((t, g) => t + g.ht, 0);
      const cUnits = new Set(list.map(g => String(g.unit ?? "").trim().toUpperCase()));
      const cQty = list.length && cUnits.size === 1
        ? money(list.reduce((t, g) => t + g.qty, 0))
        : "";
      $("bdgClientFoot").innerHTML = `
        <tr class="bdg-d-total-row">
          <td></td><td></td><td></td><td class="number">${cQty}</td>
          <td class="number">TOTAL</td>
          <td class="number">${money(cHT)}</td>
          <td class="number">${money(cHT * 0.2)}</td>
          <td class="number">${money(cHT * 1.2)}</td>
        </tr>`;
      coApply("client", $("bdgClientHead").closest("table"));
    };

    const uniq = arr =>
      [...new Set(arr.filter(v => String(v).trim() !== ""))]
        .sort((x, y) =>
          String(x).localeCompare(String(y), undefined, { numeric: true })
        );

    /* filtre dans tous les sens : chaque colonne affiche les valeurs
       des lignes qui respectent TOUS les AUTRES filtres (désignations,
       lots, primaires, secondaires) ; plusieurs choix = union */
    const passes = (l, skip) => {
      const d = new Set([...selDesig, ...rowSet(desigKey)]);
      return (
        inSet(d, desigKey(l)) &&
        inSet(rowSet(x => x.lot), l.lot) &&
        inSet(rowSet(x => x.prim), l.prim) &&
        inSet(rowSet(x => x.sec), l.sec) &&
        (skip === "lot"  || inSet(hSel.lot, l.lot)) &&
        (skip === "prim" || inSet(hSel.prim, l.prim)) &&
        (skip === "sec"  || inSet(hSel.sec, l.sec)) &&
        cons(l, skip)
      );
    };

    const hierLists = () => ({
      lots:  uniq(lines.filter(l => passes(l, "lot")).map(l => l.lot)),
      prims: uniq(lines.filter(l => passes(l, "prim")).map(l => l.prim)),
      secs:  uniq(lines.filter(l => passes(l, "sec")).map(l => l.sec))
    });

    /* retire des filtres les éléments devenus invisibles
       (répété jusqu'à stabilité) */
    const pruneHier = () => {
      for (let guard = 0; guard < 5; guard++) {
        const h = hierLists();
        let changed = false;
        const drop = (set, list) => [...set].forEach(v => {
          if (!list.includes(v)) { set.delete(v); changed = true; }
        });
        drop(hSel.lot, h.lots);
        drop(hSel.prim, h.prims);
        drop(hSel.sec, h.secs);
        if (!changed) break;
      }
    };

    const renderHier = () => {
      const { lots, prims, secs } = hierLists();

      const hFill = n =>
        `<div class="bdg-h-fill"></div>`.repeat(Math.max(0, n));

      const col = (title, level, all) => {
        const hcols = [["v", title, v => stripLevelPrefix(v), ""]];
        /* ordre par défaut : champ ORDRE du BDS (inconnus à la fin) */
        const src = { lot: db.lots, prim: db.primaries, sec: db.secondaries }[level] || [];
        const ordOf = new Map();
        src.forEach(x => {
          const k = stripLevelPrefix(x.name).trim().toUpperCase();
          if (k && !ordOf.has(k)) ordOf.set(k, Number(x.order) || 0);
        });
        const ord = v => {
          const o = ordOf.get(String(v).trim().toUpperCase());
          return o === undefined ? Infinity : o;
        };
        const byOrder = [...all].sort((a, b) => ord(a) - ord(b));
        const items = roApply(level, cfApply(level, hcols, byOrder), v => v);
        lastShown.hier[level] = items.map(v => stripLevelPrefix(v));
        items.sort((x, y) =>
          hSel[level].has(y) - hSel[level].has(x)
        );
        const st = cfT(level);
        /* lots / activités : bleu seulement si filtre ou toucher, jamais pour un tri */
        const on = st.f.v || hSel[level].size;
        return `
        <div class="bdg-h-col">
          <div class="bdg-h-head ${on ? "cf-on" : ""}"><span class="cf-wrap"><span class="cf-lab">${title}${svCnt(items.length)}</span><span class="cf-btn"
            data-cf="${level}" data-col="v" role="button" aria-label="Trier / filtrer">${cfIcon}</span></span><span
            class="col-rs" data-rs="hier" data-col="${level}"></span></div>
          ${
            items.length
              ? items.map(v => `
                  <div class="bdg-h-item ${hSel[level].has(v) ? "selected" : ""}"
                       data-h="${level}"
                       data-v="${esc(v)}"
                       title="${esc(stripLevelPrefix(v))}">${esc(stripLevelPrefix(v))}</div>
                `).join("")
              : `<div class="bdg-h-item" style="opacity:.5;cursor:default">—</div>`
          }
        </div>
      `;
      };

      {
        const w = cwLoad();
        const ws = coKeys("hierCols", ["lot", "prim", "sec"]).map(k => w["hier." + k]);
        $("bdgHier").style.gridTemplateColumns =
          ws.every(Boolean) && window.innerWidth > 650
            ? ws.map(x => x + "px").join(" ")
            : "";
      }

      const hdef = {
        lot: ["LOT", lots], prim: ["ACTIVITÉ PRIMAIRE", prims], sec: ["ACTIVITÉ SECONDAIRE", secs]
      };
      $("bdgHier").innerHTML = coKeys("hierCols", ["lot", "prim", "sec"])
        .map(k => col(hdef[k][0], k, hdef[k][1])).join("");

      /* plus de texte « FILTRES : … » dans le titre du bloc */
    };

    /* garde la vue là où l'utilisateur a la main : page et cadres
       à défilement interne (désignations, lots/tâches, détail) */
    const keepScroll = fn => {
      const sel = ".bdg-d-client-scroll, .bdg-h-col, .bdg-d-tabbody .bdg-d-scroll";
      const saved = [...shell.querySelectorAll(sel)].map(el => el.scrollTop);
      const x = window.scrollX, y = window.scrollY;
      const active = document.activeElement;
      if (active && active.blur &&
          !active.classList.contains("bdg-tva-input") &&
          !active.closest("#cfMenu")) {
        active.blur();
      }

      fn();

      const restore = () => {
        shell.querySelectorAll(sel).forEach((el, i) => {
          if (saved[i] !== undefined) el.scrollTop = saved[i];
        });
        window.scrollTo(x, y);
      };
      restore();
      requestAnimationFrame(restore);
    };

    /* titre en bleu quand le bloc est filtré (toucher de ligne
       ou filtre / tri de colonne) */
    const cfActive = t => {
      const st = CF[t];
      return !!st && Object.keys(st.f).length > 0;
    };
    const markFiltered = () => {
      const rowsOf = kind =>
        [...selRows].some(g => g.startsWith(kind.toUpperCase() + "|"));
      shell.querySelectorAll(".bdg-d-tab").forEach(b => {
        const t = b.dataset.tab;
        b.classList.toggle("cf-on",
          (t === "chg" || t === "prd") && (rowsOf(t) || cfActive(t)));
      });
      $("bdgClientTitle")?.classList.toggle("cf-on",
        selDesig.size > 0 || cfActive("client"));
    };

    const refreshAll = () => {
      keepScroll(() => {
        computeCons(false);
        pruneHier();

        renderClient();
        computeCons();
        renderHier();
        renderTab();
        markFiltered();
        REC_KINDS.forEach(renderRec);
        if (window.__sviHistRefresh) window.__sviHistRefresh();
      });
      if (typeof stateSave === "function") stateSave();
    };

    const tvaFor = l =>
      l.ttcAmount !== undefined ? l.ttcAmount - l.amount : l.amount * l.tva / 100;

    /* ligne TOTAL en pied des onglets Détail charge / produit */
    const tabFootHTML = (list, prd) => {
      /* produits : la quantité totale ne compte que les clés primaires
         (lignes au prix non nul), comme dans les désignations client */
      const qty = list.reduce((t, l) =>
        t + (prd && !l.priceTTC ? 0 : l.qty), 0);
      const ht = list.reduce((t, l) => t + l.amount, 0);
      const tva = list.reduce((t, l) => t + tvaFor(l), 0);
      const lead = prd ? 6 : 2;   /* colonnes avant « TOTAL » */
      /* quantité (et prix moyen) seulement si toutes les unités sont identiques */
      const units = new Set(list.map(l => String(l.dunit ?? "").trim().toUpperCase()));
      const sameUnit = list.length > 0 && units.size === 1;
      return `
        <tr class="bdg-d-total-row">
          ${
            sameUnit
              ? `${"<td></td>".repeat(lead)}
                 <td class="number">TOTAL</td>
                 <td class="number">${money(qty)}</td>
                 <td class="number">${money(qty ? ht / qty : 0)}</td>`
              /* unités différentes : « TOTAL » juste avant le montant HT */
              : `${"<td></td>".repeat(lead + 2)}
                 <td class="number">TOTAL</td>`
          }
          <td class="number">${money(ht)}</td>
          <td class="number" id="bdgFtTVA">${money(tva)}</td>
          <td class="number" id="bdgFtTTC">${money(ht + tva)}</td>
        </tr>`;
    };

    const totalsHTML = list => {
      const ht =
        list.reduce((t, l) => t + l.amount, 0);

      const tva =
        list.reduce((t, l) => t + tvaFor(l), 0);

      return `
        <div class="bdg-d-totals">
          <div class="bdg-d-total-ttc">
            <span>MONTANT TTC</span>
            <strong id="bdgTotTTC">${money(ht + tva)}</strong>
          </div>
        </div>
      `;
    };

    const tcolsFor = prd => [
      ["article", "ART", l => l.article, "center"],
      ["detail", "DÉSIGNATION", l => l.detail, ""],
      ["unit", prd ? "UPB" : "UCB", l => l.unit, "center"],
      ...(prd ? [
        ["nbr", "NBR", l => String(l.nbr ?? ""), "number"],
        ["d1", "DIM 1", l => String(l.dims[0] ?? ""), "number"],
        ["d2", "DIM 2", l => String(l.dims[1] ?? ""), "number"],
        ["d3", "DIM 3", l => String(l.dims[2] ?? ""), "number"]
      ] : []),
      ["qty", prd ? "QPB" : "QCB", l => l.qty, "number"],
      ["price", prd ? "PPB" : "PCB", l => l.price, "number"],
      ["amount", prd ? "MPB HT" : "MCB HT", l => l.amount, "number"],
      ["tva", "TVA %", l => String(l.tva ?? ""), "number"],
      ["ttc", prd ? "MPB TTC" : "MCB TTC", l => l.amount + l.tvaAmt, "number"]
    ];

    /* recalcule les contraintes propagées par les filtres de colonne */
    const computeCons = (withClient = true) => {
      const has = t => CF[t] && Object.keys(CF[t].f).length > 0;
      CONS.client = withClient && has("client") ? new Set(lastClientKeys) : null;

      let det = null;
      ["chg", "prd"].forEach(kind => {
        if (!has(kind)) return;
        const all = lines.filter(l => l.kind === kind);
        const shown = cfApply(kind, tcolsFor(kind === "prd"), groupLines(all), true);
        det = det || { d: new Set(), lot: new Set(), prim: new Set(), sec: new Set() };
        shown.forEach(g => g.members.forEach(l => {
          det.d.add(desigKey(l));
          if (String(l.lot).trim()) det.lot.add(l.lot);
          if (String(l.prim).trim()) det.prim.add(l.prim);
          if (String(l.sec).trim()) det.sec.add(l.sec);
        }));
      });
      CONS.det = det;

      CONS.h = {};
      ["lot", "prim", "sec"].forEach(lv => {
        if (CF[lv] && CF[lv].f.v) CONS.h[lv] = CF[lv].f.v;
      });
    };

    const renderTab = () => {
      shell
        .querySelectorAll(".bdg-d-tab")
        .forEach(b =>
          b.classList.toggle(
            "active",
            b.dataset.tab === active
          )
        );

      /* compteurs des onglets DÉTAIL CHARGES / PRODUITS (filtres compris) */
      ["chg", "prd"].forEach(k => {
        const b = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="${k}"]`);
        if (!b) return;
        const n = cfApply(k, tcolsFor(k === "prd"), groupLines(byKindNow()[k])).length;
        const t = tabs.find(x => x.key === k);
        b.innerHTML = (SVI_ICON[k] || "") + t.title + " " + svCnt(n);
      });

      if (active === "chg" || active === "prd") {
        const prd = active === "prd";
        const tcols = tcolsFor(prd);
        const all = byKindNow()[active];
        const byDesig = groupLines(all).sort((x, y) =>
          String(x.detail).localeCompare(String(y.detail), "fr", { numeric: true })
        );
        const list = cfApply(active, tcols, byDesig).sort((x, y) =>
          selRows.has(y.gid) - selRows.has(x.gid)
        );
        lastShown.detail = { cols: tcols, rows: list, kind: active };
        const shownG = new Set(list.map(g => g.gid));
        const raw = all.filter(l => shownG.has(l.gid));
        const cols = prd ? 12 : 8;

        const rowsHTML =
          list.map(l => `
            <tr data-row="${esc(l.gid)}"
                class="${selRows.has(l.gid) ? "selected" : ""}">
              <td class="center">${esc(l.article)}</td>
              <td>${esc(l.detail)}</td>
              <td class="center">${esc(l.unit)}</td>
              ${
                prd
                  ? `
                    <td class="number">${esc(l.nbr)}</td>
                    ${[0, 1, 2].map(i => `
                      <td class="number">${esc(l.dims[i])}</td>`).join("")}
                  `
                  : ""
              }
              <td class="number">${money(l.qty)}</td>
              <td class="number">${money(l.price)}</td>
              <td class="number">${money(l.amount)}</td>
              <td class="number">
                <input
                  type="text"
                  inputmode="decimal"
                  class="bdg-tva-input"
                  data-line="${esc(l.gid)}"
                  value="${l.tva === "" ? "" : money(l.tva) + " %"}"
                >
              </td>
              <td class="number" data-ttc="${esc(l.gid)}">
                ${money(l.amount + l.tvaAmt)}
              </td>
            </tr>
          `).join("");

        body.innerHTML = `
          <div class="bdg-d-scroll">
            <table class="bdg-d-table" style="width:${cwTableW(active, tcols)}px">
              <colgroup>${cwCols(active, tcols)}</colgroup>
              <thead>
                <tr>${tcols.map(([k, lab, , cls]) => cfHead(active, k, lab, cls)).join("")}</tr>
              </thead>
              <tbody>
                ${
                  rowsHTML ||
                  `<tr><td colspan="${cols}" class="empty">
                    ${prd ? "AUCUN PRODUIT" : "AUCUNE CHARGE"}
                  </td></tr>`
                }
                ${
                  /* lignes vides : le cadre garde sa hauteur même filtré */
                  `<tr class="bdg-d-filler">${"<td>&nbsp;</td>".repeat(cols)}</tr>`
                    .repeat(0)
                }
              </tbody>
              <tfoot>${tabFootHTML(raw, prd)}</tfoot>
            </table>
          </div>
        `;
        coApply(active, body.querySelector("table"));

        return;
      }

      if (active === "qlt") {
        body.innerHTML = `
          <div class="bdg-d-reserved">
            Espace réservé — contenu à définir.
          </div>
        `;

        return;
      }

      body.innerHTML = `
        <div class="bdg-d-delay">
          <label>
            DATE DÉBUT
            <input type="date" id="bdgDelayStart">
          </label>
          <label>
            DATE FIN
            <input type="date" id="bdgDelayEnd">
          </label>
          <label>
            DÉLAI
            <div id="bdgDelayDays">—</div>
          </label>
        </div>
      `;
    };

    /* ===== disposition des blocs : ordre et hauteur, mémorisés ===== */
    const LAY_KEY = "svi_layout_v1";
    const LAY_UNITS = ["client", "hier", "detail", "suivi"];
    const layLoad = () => {
      try { return JSON.parse(localStorage.getItem(LAY_KEY) || "{}") || {}; }
      catch (e) { return {}; }
    };
    const laySave = v => {
      try { localStorage.setItem(LAY_KEY, JSON.stringify(v)); } catch (e) {}
    };
    const page$ = () => shell.querySelector(".bdg-d-page");
    const layEls = u => {
      const pg = page$();
      if (u === "detail") return [$("bdgTabs"), $("bdgTabBody"), $("bdgDetailRsz")].filter(Boolean);
      const sel = { client: ".blk-client", hier: ".blk-hier", suivi: ".blk-suivi" }[u];
      return [pg.querySelector(":scope > " + sel)].filter(Boolean);
    };
    const layMeasure = u => {
      const sel = {
        client: ".bdg-d-client-scroll", hier: ".bdg-h-col",
        detail: "#bdgTabBody .bdg-d-scroll",
        suivi: ".blk-suivi .rec-scroll:not([hidden])"
      }[u];
      const el = page$().querySelector(sel);
      return el ? el.getBoundingClientRect().height : 150;
    };
    const layOrder = () => {
      const saved = (layLoad().order || []).filter(u => LAY_UNITS.includes(u));
      return [...saved, ...LAY_UNITS.filter(u => !saved.includes(u))];
    };
    const layOpenH = {};   /* hauteurs réglées pendant cette ouverture seulement */
    const layApply = () => {
      const pg = page$();
      if (!pg) return;
      const lay = layLoad();
      if (lay.h && lay.h.suivi) { delete lay.h.suivi; laySave(lay); }
      layOrder().forEach((u, i) => layEls(u).forEach(el => { el.style.order = i; }));
      LAY_UNITS.forEach(u => {
        /* SUIVI (DOC / TAF / OBS) : toujours 5 lignes à l'ouverture,
           l'agrandissement ne vaut que pour la séance en cours */
        const h = u === "suivi" ? layOpenH.suivi : (lay.h || {})[u];
        if (h) pg.style.setProperty("--h-" + u, h + "px");
        else pg.style.removeProperty("--h-" + u);
      });
      const custom = (lay.order && lay.order.join() !== LAY_UNITS.join()) ||
        Object.keys(lay.h || {}).length > 0;
      const rb = $("layResetBtn");
      if (rb) rb.hidden = !custom;
    };
    const layInit = () => {
      const pg = page$();
      if (!pg) return;
      shell.querySelectorAll(".blk-tools").forEach((t, i) => {
        if (t.querySelector(".blk-more")) return;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "blk-more";
        b.dataset.for = "m" + i;
        b.title = "Actions";
        b.setAttribute("aria-label", "Actions");
        b.textContent = "⋯";
        t.appendChild(b);
      });
      recTabApply();
      LAY_UNITS.forEach(u => {
        /* poignée de déplacement dans le titre */
        const title = u === "detail" ? $("bdgTabs")
          : layEls(u)[0]?.querySelector(".blk-head");
        if (title && !title.querySelector(".blk-grip")) {
          const g = document.createElement("span");
          g.className = "blk-grip";
          g.dataset.grip = u;
          g.title = "Glisser pour déplacer le bloc";
          g.textContent = "⠿";
          title.prepend(g);
        }
        /* poignée de hauteur en bas du bloc */
        if (u === "detail") {
          if (!$("bdgDetailRsz")) {
            const r = document.createElement("div");
            r.className = "blk-rsz";
            r.id = "bdgDetailRsz";
            r.dataset.rsz = u;
            r.title = "Glisser pour changer la hauteur";
            $("bdgTabBody").after(r);
          }
        } else {
          const b = layEls(u)[0];
          if (b && !b.querySelector(":scope > .blk-rsz")) {
            const r = document.createElement("div");
            r.className = "blk-rsz";
            r.dataset.rsz = u;
            r.title = "Glisser pour changer la hauteur";
            b.appendChild(r);
          }
        }
      });
      layApply();
    };

    const layResize = (event, h) => {
      event.preventDefault();
      const u = h.dataset.rsz;
      const pg = page$();
      const y0 = event.clientY;
      const base = layMeasure(u);
      let v = base;
      h.classList.add("on");
      const move = e => {
        e.preventDefault();
        /* minimum : en-tête + une seule ligne (+ ligne TOTAL s'il y en a une) */
        const minH = { client: 65, detail: 65 }[u] || 44;
        v = Math.max(minH, Math.round(base + e.clientY - y0));
        pg.style.setProperty("--h-" + u, v + "px");
      };
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        h.classList.remove("on");
        if (u === "suivi") { layOpenH.suivi = v; layApply(); return; }
        const lay = layLoad();
        lay.h = lay.h || {};
        lay.h[u] = v;
        laySave(lay);
        histLog("DISPOSITION", "MODIFICATION", "ORDRE / HAUTEUR DES BLOCS");
        layApply();
      };
      document.addEventListener("pointermove", move, { passive: false });
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    };

    const layDrag = (event, grip) => {
      event.preventDefault();
      const src = grip.dataset.grip;
      let target = null, after = false, timer = null, lastY = event.clientY;
      layEls(src).forEach(el => el.classList.add("lay-src"));
      const rectOf = u => {
        const rs = layEls(u).map(el => el.getBoundingClientRect());
        return { top: Math.min(...rs.map(r => r.top)), bottom: Math.max(...rs.map(r => r.bottom)) };
      };
      const clear = () => LAY_UNITS.forEach(u =>
        layEls(u).forEach(el => el.classList.remove("lay-before", "lay-after")));
      const pick = y => {
        clear();
        target = null;
        for (const u of layOrder()) {
          if (u === src) continue;
          const r = rectOf(u);
          if (y >= r.top && y <= r.bottom) {
            target = u;
            after = y > (r.top + r.bottom) / 2;
            const els = layEls(u);
            (after ? els[els.length - 1] : els[0]).classList.add(after ? "lay-after" : "lay-before");
            break;
          }
        }
      };
      /* défilement automatique près des bords de l'écran */
      timer = setInterval(() => {
        const vh = window.innerHeight;
        if (lastY < 90) window.scrollBy(0, -14);
        else if (lastY > vh - 60) window.scrollBy(0, 14);
        else return;
        pick(lastY);
      }, 30);
      const move = e => {
        e.preventDefault();
        lastY = e.clientY;
        pick(lastY);
      };
      const up = () => {
        clearInterval(timer);
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        clear();
        layEls(src).forEach(el => el.classList.remove("lay-src"));
        if (!target) return;
        const order = layOrder().filter(u => u !== src);
        order.splice(order.indexOf(target) + (after ? 1 : 0), 0, src);
        const lay = layLoad();
        lay.order = order;
        laySave(lay);
        histLog("DISPOSITION", "MODIFICATION", "ORDRE / HAUTEUR DES BLOCS");
        layApply();
      };
      document.addEventListener("pointermove", move, { passive: false });
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    };

    /* glisser une ligne : appui long (0,35 s) puis glissement vertical */
    const roStart = (event, el) => {
      const isRow = el.tagName === "TR";
      const t = isRow ? "client" : el.dataset.h;
      /* tri choisi en cours : il garde la main, pas de glissement */
      if (CF[t] && CF[t].sort && !CF[t].sort.def) return;
      const keyOf = x => isRow ? x.dataset.desig : x.dataset.v;
      const sibs = () => isRow
        ? [...el.parentElement.querySelectorAll("tr[data-desig]")]
        : [...el.parentElement.querySelectorAll(".bdg-h-item[data-h]")];
      const x0 = event.clientX, y0 = event.clientY;
      let on = false, target = null, after = false, lastY = y0;
      const clear = () => sibs().forEach(x => x.classList.remove("ro-before", "ro-after"));
      const timer = setTimeout(() => {
        on = true;
        el.classList.add("ro-src");
        try { navigator.vibrate && navigator.vibrate(15); } catch (e) {}
      }, 350);
      const tm = e => { if (on) e.preventDefault(); };
      const move = e => {
        lastY = e.clientY;
        if (!on) {
          if (Math.abs(e.clientX - x0) > 8 || Math.abs(e.clientY - y0) > 8) end(false);
          return;
        }
        e.preventDefault();
        clear();
        target = null;
        for (const x of sibs()) {
          const r = x.getBoundingClientRect();
          if (lastY >= r.top && lastY <= r.bottom) {
            if (x !== el) {
              after = lastY > (r.top + r.bottom) / 2;
              x.classList.add(after ? "ro-after" : "ro-before");
              target = x;
            }
            break;
          }
        }
      };
      const end = drop => {
        clearTimeout(timer);
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", cancel);
        setTimeout(() => document.removeEventListener("touchmove", tm), 0);
        clear();
        el.classList.remove("ro-src");
        if (!on) return;
        /* le toucher qui suit le glissement ne sélectionne pas la ligne */
        const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
        shell.addEventListener("click", stop, { capture: true, once: true });
        setTimeout(() => shell.removeEventListener("click", stop, { capture: true }), 350);
        if (!drop || !target) return;
        const keys = sibs().map(keyOf).filter(k => k !== keyOf(el));
        let i = keys.indexOf(keyOf(target));
        keys.splice(after ? i + 1 : i, 0, keyOf(el));
        const all = roLoad();
        /* lignes masquées par un filtre : gardent leur rang après les visibles */
        all[t] = [...keys, ...(all[t] || []).filter(k => !keys.includes(k))];
        roSave(all);
        histLog(t === "client" ? "DÉSIGNATIONS CLIENT" : "TÂCHES", "ORDRE DES LIGNES", keyOf(el).split("||").pop());
        refreshAll();
      };
      const up = () => end(true);
      const cancel = () => end(false);
      document.addEventListener("touchmove", tm, { passive: false });
      document.addEventListener("pointermove", move, { passive: false });
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", cancel);
    };

    /* glisser un en-tête de colonne pour la déplacer */
    const coDrag = (event, th) => {
      const isHier = th.classList.contains("bdg-h-head");
      const table = th.closest("table");
      const t = isHier ? "hierCols" : th.querySelector(".cf-btn").dataset.cf;
      const ths = () => isHier
        ? [...$("bdgHier").querySelectorAll(".bdg-h-head")]
        : [...table.querySelectorAll("thead tr:first-child > th")];
      const keyOf = x => isHier
        ? x.querySelector(".cf-btn")?.dataset.cf
        : x.querySelector(".cf-btn")?.dataset.col;
      const x0 = event.clientX, y0 = event.clientY;
      let on = false, target = null, ghost = null;
      const clear = () => ths().forEach(x => x.classList.remove("co-before", "co-after"));
      const move = e => {
        const dx = e.clientX - x0, dy = e.clientY - y0;
        if (!on) {
          if (Math.abs(dx) < 8) return;
          on = true;
          th.classList.add("co-src");
          ghost = document.createElement("div");
          ghost.id = "coGhost";
          ghost.textContent = (th.querySelector(".cf-lab")?.firstChild?.textContent || "").trim();
          document.body.appendChild(ghost);
        }
        e.preventDefault();
        ghost.style.left = e.clientX + 8 + "px";
        ghost.style.top = e.clientY - 28 + "px";
        clear();
        target = null;
        const list = ths();
        for (const x of list) {
          const r = x.getBoundingClientRect();
          if (e.clientX >= r.left && e.clientX < r.right) {
            if (x !== th) {
              const after = list.indexOf(x) > list.indexOf(th);
              x.classList.add(after ? "co-after" : "co-before");
              target = x;
            }
            break;
          }
        }
      };
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        clear();
        th.classList.remove("co-src");
        ghost?.remove();
        if (!on || !target) return;
        const keys = ths().map(keyOf);
        const from = keys.indexOf(keyOf(th));
        const to = keys.indexOf(keyOf(target));
        const [k] = keys.splice(from, 1);
        keys.splice(to, 0, k);
        const all = coLoad();
        all[t] = keys;
        coSave(all);
        histLog("COLONNES", "DÉPLACEMENT", t + " : " + keys.join(", "));
        /* évite le clic qui suit le glissement */
        const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
        shell.addEventListener("click", stop, { capture: true, once: true });
        setTimeout(() => shell.removeEventListener("click", stop, { capture: true }), 300);
        refreshAll();
      };
      /* iPad : bloque le défilement pendant le glissement */
      const tm = e => { if (on) e.preventDefault(); };
      document.addEventListener("touchmove", tm, { passive: false });
      const end = () => setTimeout(() => document.removeEventListener("touchmove", tm), 0);
      document.addEventListener("pointerup", end, { once: true });
      document.addEventListener("pointercancel", end, { once: true });
      document.addEventListener("pointermove", move, { passive: false });
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    };

    shell.onpointerdown = event => {
      const rz = event.target.closest(".blk-rsz");
      if (rz) { layResize(event, rz); return; }
      const gp = event.target.closest(".blk-grip");
      if (gp) { layDrag(event, gp); return; }
      const roEl = event.target.closest("#bdgClientBody tr[data-desig], .bdg-h-item[data-h]");
      if (roEl) { roStart(event, roEl); return; }
      const h = event.target.closest(".col-rs");
      if (!h) {
        const th = event.target.closest("th, .bdg-h-head");
        if (th && !event.target.closest(".cf-btn") && th.querySelector(".cf-btn")) coDrag(event, th);
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      const t = h.dataset.rs, key = h.dataset.col;
      const x0 = event.clientX;
      let apply, save;

      if (t === "hier") {
        const grid = $("bdgHier");
        const cols = [...grid.querySelectorAll(".bdg-h-col")];
        const keys = coKeys("hierCols", ["lot", "prim", "sec"]);
        const ws = cols.map(c => c.getBoundingClientRect().width);
        const i = keys.indexOf(key);
        const w0 = ws[i];
        apply = x => {
          ws[i] = Math.max(80, Math.round(w0 + x - x0));
          grid.style.gridTemplateColumns = ws.map(v => v + "px").join(" ");
        };
        save = () => {
          const all = cwLoad();
          keys.forEach((k, j) => { all["hier." + k] = Math.round(ws[j]); });
          cwSave(all);
          histLog("COLONNES", "LARGEUR", t);
        };
      } else {
        const table = h.closest("table");
        const col = table.querySelector(`col[data-w="${t}.${key}"]`);
        if (!col) return;
        const w0 = parseFloat(col.style.width) || col.getBoundingClientRect().width;
        let w = w0;
        apply = x => {
          w = Math.max(40, Math.round(w0 + x - x0));
          col.style.width = w + "px";
          const total = [...table.querySelectorAll("col")]
            .reduce((sum, c) => sum + (parseFloat(c.style.width) || 0), 0);
          table.style.width = total + "px";
        };
        save = () => {
          const all = cwLoad();
          all[t + "." + key] = w;
          cwSave(all);
          histLog("COLONNES", "LARGEUR", t);
        };
      }

      h.classList.add("on");
      const move = e => apply(e.clientX);
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        h.classList.remove("on");
        save();
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    };

    /* ===== export / import / aperçu PDF par bloc ===== */
    const lastShown = { client: null, detail: null, hier: {} };
    const blkName = { client: "DESIGNATIONS CLIENT", hier: "TACHES", detail: "DETAIL",
                      doc: "DOCUMENTS", taf: "TAF", obs: "OBSERVATIONS", suivi: "SUIVI", hist: "HISTORIQUE" };
    const REC_KINDS = ["doc", "taf", "obs"];

    const tabTitle = () => (tabs.find(t => t.key === active) || {}).title || "DÉTAIL";
    const blkLabel = blk => blk === "detail" ? tabTitle()
      : blk === "metre" ? "AVANT METRE" : blk === "interne" ? "DÉTAIL PRODUITS FORMAT INTERNE" : blkName[blk];

    const blkData = blk => {
      if (blk === "detail" && active === "qlt") return { head: [], rows: [] };
      if (blk === "detail" && active === "dly") {
        const a = $("bdgDelayStart")?.value || "";
        const b = $("bdgDelayEnd")?.value || "";
        return {
          head: ["DATE DÉBUT", "DATE FIN", "DÉLAI"],
          rows: [[a, b, $("bdgDelayDays")?.textContent || ""]]
        };
      }
      if (REC_KINDS.includes(blk)) return recTableData(blk);
      if (blk === "hist") return histData();
      if (blk === "metre") return metreData();
      if (blk === "interne") return interneData();
      if (blk === "hier") {
        const h = lastShown.hier;
        const n = Math.max((h.lot || []).length, (h.prim || []).length, (h.sec || []).length);
        const ks = coKeys("hierCols", ["lot", "prim", "sec"]);
        const lab = { lot: "LOT", prim: "ACTIVITÉ PRIMAIRE", sec: "ACTIVITÉ SECONDAIRE" };
        return {
          head: ks.map(k => lab[k]),
          rows: Array.from({ length: n }, (_, i) => ks.map(k => (h[k] || [])[i] ?? ""))
        };
      }
      const src = lastShown[blk];
      if (!src) return { head: [], rows: [] };
      const oc = coOrder(blk === "detail" ? active : blk, src.cols);
      return {
        head: oc.map(c => c[1]),
        rows: src.rows.map(r => oc.map(c => c[2](r)))
      };
    };

    const fileBase = blk => {
      return (budget.project + " " + ref + " " + blkLabel(blk))
        .replace(/[\\/:*?"<>|;]+/g, "-").replace(/\s+/g, "_");
    };

    const download = (name, blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    };

    /* enregistrement : sur iPad / iPhone, la feuille de partage permet
       « Enregistrer dans Fichiers » › Google Drive, avec choix ou création
       du dossier ; sinon, téléchargement classique */
    /* fenêtre « enregistrer » au format des fenêtres INF / DOC :
       nom du fichier et dossier du Drive proposés, modifiables */
    const fileDialog = ({ title, name, path, buttons, onAct }) => {
      document.getElementById("docPop")?.remove();
      const p = document.createElement("div");
      p.id = "docPop";
      p.innerHTML = `
        <div class="doc-card" role="dialog" aria-modal="true" style="max-width:640px">
          <div class="doc-head">
            <span class="doc-title">${esc(title)}</span>
            <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
          </div>
          <div class="doc-body">
            <div class="doc-grid doc-grid-2">
              <label class="doc-lab" for="fdName">NOM DU FICHIER</label>
              <input id="fdName" class="doc-in" type="text" autocomplete="off" value="${esc(name)}">
              <label class="doc-lab" for="fdPath">DOSSIER DRIVE</label>
              <input id="fdPath" class="doc-in" type="text" autocomplete="off" data-keepcase value="${esc(path)}">
            </div>
            <div class="doc-err fd-msg" id="fdMsg"></div>
          </div>
          <div class="doc-foot">
            <button type="button" class="doc-btn" data-cancel>ANNULER</button>
            ${buttons.map(b => `<button type="button" class="doc-btn${b.primary ? " doc-save" : ""}" data-act="${b.key}"${b.drive ? " data-drive" : ""}>${esc(b.label)}</button>`).join("")}
          </div>
        </div>`;
      document.body.appendChild(p);
      popEnhance(p, "save");
      drivePathRow(p, "#fdPath", false);
      const msg = p.querySelector("#fdMsg");
      const ui = {
        msg: (t, kind) => { msg.innerHTML = t; msg.className = "doc-err fd-msg" + (kind ? " " + kind : ""); },
        close: () => p.remove(),
        busy: (k, on) => { const b = p.querySelector(`[data-act="${k}"]`); if (b) b.disabled = on; },
        setPath: v => { if (v) p.querySelector("#fdPath").value = v; }
      };
      let pathShown = false;
      p.addEventListener("click", e => {
        if (e.target === p || e.target.closest("[data-cancel]")) { p.remove(); return; }
        const b = e.target.closest("[data-act]");
        if (!b || b.disabled) return;
        /* 1er toucher sur le Drive : le dossier s'affiche ; 2e : enregistrement */
        if (b.dataset.drive !== undefined && !pathShown) {
          pathShown = true;
          drivePathRow(p, "#fdPath", true);
          b.textContent = "ENREGISTRER";
          return;
        }
        onAct(b.dataset.act, {
          name: p.querySelector("#fdName").value.trim(),
          path: driveCleanPath(p.querySelector("#fdPath").value)
        }, ui);
      });
    };

    /* enregistrement sur l'iPad (partage / téléchargement) */
    const saveDevice = (name, blob) => {
      try {
        const file = new File([blob], name, { type: blob.type });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: name }).catch(err => {
            if (err && err.name !== "AbortError") download(name, blob);
          });
          return;
        }
      } catch (e) {}
      download(name, blob);
    };

    /* chaque fichier enregistré : nom et dossier du Drive proposés (modifiables),
       puis enregistrement dans le Drive ou sur l'iPad */
    const saveFile = (name, blob) => {
      const ext = (String(name).match(/\.[a-z0-9]+$/i) || [""])[0];
      const stem = ext ? String(name).slice(0, -ext.length) : String(name);
      fileDialog({
        title: "ENREGISTRER LE FICHIER " + ext.toUpperCase().replace(".", ""),
        name: stem, path: driveLastPath(budget.project, fullRef),
        buttons: [{ key: "device", label: "SUR L'IPAD" }, { key: "drive", label: "DANS LE DRIVE", primary: true, drive: true }],
        onAct: async (k, v, ui) => {
          const nm = (v.name || stem).replace(/[\\/:*?"<>|]+/g, "-") + ext;
          if (k === "device") { saveDevice(nm, blob); ui.close(); return; }
          ui.busy("drive", true);
          ui.msg("");
          try {
            const out = await driveSave(blob, nm, v.path);
            histLog("FICHIER", "DRIVE", (out.path ? out.path + "/" : "") + nm);
            ui.setPath(out.path);
            ui.msg("");
            driveDoneFlash();
            ui.busy("drive", false);
          } catch (err) {
            ui.msg("ÉCHEC : " + esc(driveErrText(err)));
            ui.busy("drive", false);
          }
        }
      });
    };

    const loadXLSX = () => window.XLSX
      ? Promise.resolve(window.XLSX)
      : new Promise((ok, ko) => {
          const sc = document.createElement("script");
          /* version de SheetJS qui sait écrire les styles (police, bordures, alignement) */
          sc.src = "https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js";
          sc.onload = () => ok(window.XLSX);
          sc.onerror = () => ko(new Error("Bibliothèque Excel indisponible"));
          document.head.appendChild(sc);
        });

    /* entrée commune aux exports (comme sur les PDF) */
    const exportTop = blk => {
      const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
        "septembre", "octobre", "novembre", "décembre"];
      const d0 = new Date();
      const N = v => String(v ?? "").trim().toUpperCase();
      const prj = db.projects.find(x => N(x.code) === N(budget.project));
      const projet = (prj && prj.name && N(prj.name) !== N(budget.project)) ? prj.name : budget.project;
      return {
        date: "Agadir, le " + String(d0.getDate()).padStart(2, "0") + " " + mois[d0.getMonth()] + " " + d0.getFullYear(),
        budget: "BUDGET N° : " + fullRef, client: "CLIENT : À COMPLÉTER", projet: "PROJET : " + projet,
        titre: String(blkLabel(blk)).toUpperCase()
      };
    };

    /* largeurs des colonnes et hauteur de l'entête du tableau pour les exports
       (Excel et Google Sheets) : colonnes numériques (quantités…) ajustées aux
       nombres, titres longs repliés sur plusieurs lignes, entête à la bonne hauteur */
    const exportSizing = (head, rows) => {
      const txt = v => typeof v === "number" ? money(v) : String(v ?? "");
      const isNum = c => {
        const vals = rows.map(r => r[c]).filter(v => v !== "" && v != null);
        return vals.length > 0 && vals.filter(v => typeof v === "number").length >= vals.length / 2;
      };
      const wch = head.map((h, c) => {
        const dataLen = Math.max(0, ...rows.map(r => txt(r[c]).length));
        const longWord = Math.max(...String(h ?? "").split(/\s+/).map(w => w.length));
        if (c === 1) return Math.min(80, Math.max(dataLen, String(h ?? "").length) + 2);
        if (isNum(c)) return Math.max(9, dataLen + 3, longWord + 2);
        return Math.max(6, Math.min(30, Math.max(dataLen, longWord) + 2));
      });
      /* nombre de lignes du titre une fois replié dans sa largeur */
      const lines = head.map((h, c) => {
        let n = 1, cur = 0;
        String(h ?? "").split(/\s+/).forEach(w => {
          if (cur && cur + 1 + w.length > wch[c] - 1) { n++; cur = w.length; }
          else cur += (cur ? 1 : 0) + w.length;
        });
        return n;
      });
      const hpt = 15 * Math.max(1, ...lines) + 6;
      return { wch, hpt };
    };

    /* Google Sheets : la feuille est créée par le script Google (Code.gs) dans
       le Drive, nommée et rangée dans le dossier choisi, déjà mise en forme */
    const sendToDrive = async (blk, docName, path) => {
      const { head, rows, bold: boldIdx } = blkData(blk);
      if (!head.length) { alert("Aucune donnée à exporter dans " + blkLabel(blk) + "."); return; }
      const T = exportTop(blk);
      const Uc = h => /^(ART\.?|N°)$/i.test(h) || /^(U|UPB|UCB|UNITÉ|UNITE)$/i.test(h);
      const al = (c, h) => blk === "metre" && h === "NB" ? "center"
        : blk === "metre" && h === "QUANTITÉ" ? "right"
        : c >= head.length - 5 ? "right" : Uc(h) ? "center" : "left";
      const SZ = exportSizing(head, rows);
      const name = (docName || fileBase(blk)).replace(/[\\/:*?"<>|]+/g, "-").trim();
      /* onglet ouvert dans le geste (Safari), redirigé vers la feuille une fois créée */
      const w = window.open("", "_blank");
      const say = (t, err) => {
        if (!w) { alert(t); return; }
        w.document.open();
        w.document.write(`<!doctype html><html><head><meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1"><title>Google Sheets</title>
          <style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
          background:#f4f7fb;font-family:-apple-system,Arial,sans-serif;color:#172033}
          .c{background:#fff;border-radius:14px;padding:24px;max-width:440px;margin:16px;
          box-shadow:0 10px 30px rgba(0,0,0,.12);text-align:center}
          h1{font-size:17px;margin:0 0 10px;color:${err ? "#b91c1c" : "#0f4f96"}}
          p{font-size:14px;line-height:1.45;margin:0}</style></head><body><div class="c">
          <h1>${esc(name)}</h1><p>${esc(t)}</p></div></body></html>`);
        w.document.close();
      };
      say("Création de la feuille dans le Drive (" + (path || "Mon Drive") + ")…");
      try {
        const out = await apiPost("exportSheet", {
          name, path,
          top: [T.date, T.budget, T.client, T.projet, T.titre],
          head, rows, bold: boldIdx || [],
          align: head.map((h, c) => al(c, h)),
          widths: SZ.wch.map(x => Math.round(x * 7.5 + 5)),
          headHeight: Math.round(SZ.hpt * 4 / 3)
        });
        histLog(blkLabel(blk), "EXPORT", "GOOGLE SHEETS — " + rows.length + " LIGNE(S) — " + (out.path ? out.path + "/" : "") + name);
        drivePathAdd(out.path || path);
        driveUrlSet(out.path, out.folderUrl);
        saveExportDoc(null, name, name, "GOOGLE SHEETS", out.url, out.path);
        openGoogleLink(out.url, w);
        return out;
      } catch (e) {
        const m = String(e && e.message || e);
        say("Échec de la création : " + driveErrText(e), true);
      }
    };

    const openDriveExport = (blk, docName) => {
      fileDialog({
        title: "GOOGLE SHEETS — " + String(blkLabel(blk)).toUpperCase(),
        name: docName, path: driveLastPath(budget.project, fullRef),
        buttons: [{ key: "paste", label: "COPIER (FEUILLE SANS NOM)" }, { key: "go", label: "CRÉER DANS LE DRIVE", primary: true, drive: true }],
        onAct: (k, v, ui) => {
          ui.close();
          if (k === "go") sendToDrive(blk, v.name, v.path);
          else doExport(blk, "gsheet", v.name);
        }
      });
    };

    /* fichier prêt : sur l'iPad ou dans le Drive (fenêtre d'export fusionnée),
       sinon fenêtre d'enregistrement */
    /* enregistré dans le Drive : pas de message, le bouton l'indique un instant
       (le dossier utilisé reste affiché dans le champ DOSSIER DRIVE) */
    const driveDoneFlash = () => {
      const b = document.querySelector('#docPop [data-act="save"]') || document.querySelector('#docPop [data-act="drive"]');
      if (!b) return;
      const t = b.textContent;
      b.textContent = "✓ ENREGISTRÉ";
      setTimeout(() => { if (b.isConnected) b.textContent = t; }, 2500);
    };

    const deliver = async (name, blob, dest) => {
      if (!dest) return saveFile(name, blob);
      const title = name.replace(/\.[a-z0-9]+$/i, "");
      if (dest.target === "device") { saveDevice(name, blob); saveExportDoc(blob, title, name); return; }
      const ui = dest.ui;
      ui && ui.msg("");
      try {
        const out = await driveSave(blob, name, dest.path);
        histLog("FICHIER", "DRIVE", (out.path ? out.path + "/" : "") + name);
        ui && ui.setPath && ui.setPath(out.path);
        ui && ui.msg("");
        driveDoneFlash();
        saveExportDoc(blob, title, name, blob.type, out.url, out.path);
      } catch (err) {
        ui && ui.msg("ÉCHEC : " + esc(driveErrText(err)));
      }
    };

    const doExport = async (blk, fmt, docName, dest) => {
      const { head, rows, bold: boldIdx } = blkData(blk);
      if (!head.length) { alert("Aucune donnée à exporter dans " + blkLabel(blk) + "."); return; }
      const T = exportTop(blk);
      const topLines = [T.date, T.budget, T.client, T.projet, T.titre];
      histLog(blkLabel(blk), "EXPORT", ({ xlsx: "EXCEL", csv: "CSV", json: "JSON", gsheet: "GOOGLE SHEETS" }[fmt] || fmt) + " — " + rows.length + " LIGNE(S)");
      /* nom du fichier : celui proposé (modifiable) dans la fenêtre d'export */
      const base = docName ? docName.replace(/[\\/:*?"<>|;]+/g, "-").trim() : fileBase(blk);
      if (fmt === "gsheet") {
        /* copie des données (tabulations) puis ouverture d'une nouvelle
           feuille Google : il suffit de coller en A1 */
        const cell = v => typeof v === "number"
          ? money(v).replace(/\s/g, "")
          : String(v ?? "").replace(/[\t\n]/g, " ");
        const tsv = [...topLines.map(t => [t]), [], head, ...rows].map(r => r.map(cell).join("\t")).join("\n");
        /* version mise en forme (police, gras, bordures, alignements) collée dans Google Sheets */
        const bs = new Set(boldIdx || []);
        const Uc = h => /^(ART\.?|N°)$/i.test(h) || /^(U|UPB|UCB|UNITÉ|UNITE)$/i.test(h);
        const al = (c, h) => blk === "metre" && h === "NB" ? "center"
          : blk === "metre" && h === "QUANTITÉ" ? "right"
          : c >= head.length - 5 ? "right" : Uc(h) ? "center" : "left";
        const st = "font-family:Arial;font-size:11pt;";
        const bd = "border:1px solid #000;";
        const SZ = exportSizing(head, rows);
        const html = `<meta charset="utf-8"><table style="border-collapse:collapse;${st}">` +
          `<colgroup>${SZ.wch.map(w => `<col width="${Math.round(w * 7.5 + 5)}" style="width:${Math.round(w * 7.5 + 5)}px">`).join("")}</colgroup>` +
          topLines.map((t, i) => `<tr><td colspan="${head.length}" style="${st}font-weight:bold;text-align:${i ? "center" : "right"}">${esc(t)}</td></tr>`).join("") +
          `<tr><td colspan="${head.length}"></td></tr>` +
          `<tr style="height:${Math.round(SZ.hpt * 4 / 3)}px">${head.map(h => `<th style="${st}${bd}font-weight:bold;background:#D9DEE6;text-align:center;vertical-align:middle;white-space:normal;height:${Math.round(SZ.hpt * 4 / 3)}px">${esc(h)}</th>`).join("")}</tr>` +
          rows.map((r, i) => `<tr>${r.map((v, c) => `<td style="${st}${bd}text-align:${al(c, head[c])};${bs.has(i) ? "font-weight:bold;" : ""}">${esc(cell(v))}</td>`).join("")}</tr>`).join("") +
          `</table>`;
        /* copie lancée et onglet ouvert dans le même geste (Safari) ;
           le message s'affiche DANS le nouvel onglet, avec un bouton
           qui ouvre ensuite la feuille Google vierge */
        const copying = !navigator.clipboard ? Promise.resolve(false)
          : (window.ClipboardItem && navigator.clipboard.write
              ? navigator.clipboard.write([new ClipboardItem({
                  "text/html": new Blob([html], { type: "text/html" }),
                  "text/plain": new Blob([tsv], { type: "text/plain" })
                })]).then(() => true, () => navigator.clipboard.writeText(tsv).then(() => true, () => false))
              : navigator.clipboard.writeText(tsv).then(() => true, () => false));
        const w = window.open("", "_blank");
        const copied = await copying;
        const msg = copied
          ? "Données copiées. Touche le bouton ci-dessous : dans la nouvelle feuille Google, touche la cellule A1 puis « Coller »."
          : "Copie impossible sur cet appareil : utilise plutôt l'export Excel, puis Fichier › Importer dans Google Sheets.";
        if (!w) { alert(msg); return; }
        w.document.write(`<!doctype html><html><head><meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
          <title>Export vers Google Sheets</title>
          <style>
            body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
                   background: #f4f7fb; font-family: -apple-system, Arial, sans-serif; color: #172033; }
            .card { position: relative; background: #fff; border-radius: 14px; padding: 24px; max-width: 420px;
                    margin: 16px; box-shadow: 0 10px 30px rgba(0,0,0,.12); text-align: center; }
            h1 { font-size: 18px; margin: 0 0 10px; color: #0f4f96; padding: 0 28px; }
            h1 a { color: inherit !important; text-decoration: none !important; background: none !important;
                   padding: 0 !important; font: inherit !important; pointer-events: none; }
            p { font-size: 15px; line-height: 1.45; margin: 0 0 18px; }
            .btns { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
            .go, .cancel { display: inline-block; text-decoration: none; padding: 12px 20px; border-radius: 10px;
                           font-weight: 700; font-size: 15px; border: 0; cursor: pointer; font-family: inherit; }
            .go { background: #1d4ed8; color: #fff; }
            .cancel { background: #eef1f6; color: #374151; }
            .x { position: absolute; top: 10px; right: 10px; width: 30px; height: 30px; border: 0;
                 border-radius: 50%; background: #eef1f6; color: #374151; font-size: 15px; font-weight: 800;
                 cursor: pointer; }
          </style></head><body>
          <div class="card">
            <button class="x" onclick="window.close()" aria-label="Fermer">✕</button>
            <h1>${esc(base)}</h1>
            <p>${esc(msg)}</p>
            <div class="btns">
              ${copied ? `<a class="go" href="https://sheets.new">Ouvrir une nouvelle feuille Google</a>` : ""}
              <button class="cancel" onclick="window.close()">Annuler</button>
            </div>
          </div></body></html>`);
        w.document.close();
        return;
      }
      if (fmt === "csv") {
        const cell = v => {
          const t = typeof v === "number" ? money(v).replace(/\s/g, "") : String(v ?? "");
          return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
        };
        const txt = [...topLines.map(t => [t]), [], head, ...rows].map(r => r.map(cell).join(";")).join("\r\n");
        await deliver(base + ".csv", new Blob(["\ufeff" + txt], { type: "text/csv" }), dest);
      } else if (fmt === "json") {
        const objs = rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
        const doc = { entete: T, lignes: objs };
        await deliver(base + ".json", new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }), dest);
      } else {
        try {
          const X = await loadXLSX();
          const bold = new Set((blkData(blk).bold || []));
          const nc = head.length;
          /* entrée comme sur les PDF : date, budget, client, projet, titre */
          const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
            "septembre", "octobre", "novembre", "décembre"];
          const d0 = new Date();
          const N = v => String(v ?? "").trim().toUpperCase();
          const prj = db.projects.find(x => N(x.code) === N(budget.project));
          const projet = (prj && prj.name && N(prj.name) !== N(budget.project)) ? prj.name : budget.project;
          const top = [
            ["Agadir, le " + String(d0.getDate()).padStart(2, "0") + " " + mois[d0.getMonth()] + " " + d0.getFullYear()],
            ["BUDGET N° : " + fullRef], ["CLIENT : À COMPLÉTER"], ["PROJET : " + projet],
            [String(blkLabel(blk)).toUpperCase()], []
          ];
          const H0 = top.length;
          const ws = X.utils.aoa_to_sheet([...top, head, ...rows]);
          const pad = r => Array.from({ length: nc }, (_, i) => X.utils.encode_cell({ r, c: i }));
          ws["!merges"] = top.slice(0, 5).map((_, r) => ({ s: { r, c: 0 }, e: { r, c: nc - 1 } }));
          const font = (b, sz = 11) => ({ name: "Arial", sz, bold: !!b });
          const border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
          const U = h => /^(ART\.?|N°)$/i.test(h) || /^(U|UPB|UCB|UNITÉ|UNITE)$/i.test(h);
          top.slice(0, 5).forEach((_, r) => {
            const a = X.utils.encode_cell({ r, c: 0 });
            ws[a] = ws[a] || { t: "s", v: "" };
            ws[a].s = { font: font(true), alignment: { horizontal: r ? "center" : "right" } };
          });
          pad(H0).forEach(a => {
            ws[a] = ws[a] || { t: "s", v: "" };
            ws[a].s = { font: font(true), border, fill: { fgColor: { rgb: "D9DEE6" } },
              alignment: { horizontal: "center", vertical: "center", wrapText: true } };
          });
          rows.forEach((row, i) => {
            const r = H0 + 1 + i;
            pad(r).forEach((a, c) => {
              ws[a] = ws[a] || { t: "s", v: "" };
              let h = c >= nc - 5 ? "right" : U(head[c]) ? "center" : "left";
              /* format métré : NB centré, quantité à droite */
              if (blk === "metre" && head[c] === "NB") h = "center";
              if (blk === "metre" && head[c] === "QUANTITÉ") h = "right";
              ws[a].s = { font: font(bold.has(i)), border, alignment: { horizontal: h, vertical: "top", wrapText: c !== 1 } };
              if (ws[a].t === "n") ws[a].z = "#,##0.00";
            });
          });
          /* largeurs ajustées (quantités selon les nombres) et entête du tableau
             assez haute pour ses titres repliés — pour tous les exports */
          const SZ = exportSizing(head, rows);
          ws["!cols"] = SZ.wch.map(w => ({ wch: w }));
          ws["!rows"] = ws["!rows"] || [];
          ws["!rows"][H0] = { hpt: SZ.hpt };
          const wb = X.utils.book_new();
          X.utils.book_append_sheet(wb, ws, blkLabel(blk).slice(0, 31));
          const out = X.write(wb, { bookType: "xlsx", type: "array" });
          await deliver(base + ".xlsx", new Blob([out], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          }), dest);
        } catch (e) {
          alert(e.message);
        }
      }
    };

    const popup = (html, cls = "") => {
      document.getElementById("blkPop")?.remove();
      const p = document.createElement("div");
      p.id = "blkPop";
      p.className = cls;
      p.innerHTML = html;
      p.addEventListener("click", e => {
        if (e.target === p || e.target.closest("[data-close]")) p.remove();
      });
      document.body.appendChild(p);
      return p;
    };

    /* EXPORTER
       - départ : nom du fichier, 4 formats, ANNULER / SUR L'IPAD / DANS LE DRIVE
       - DANS LE DRIVE : la ligne DOSSIER DRIVE (lien bleu, ✎ pour la changer)
         apparaît sous le nom ; en bas il ne reste qu'ANNULER / ENREGISTRER
       - ENREGISTRER : enregistre, la fenêtre reste ouverte (accès au dossier)
       - ANNULER en mode Drive : retour à la fenêtre de départ */
    const openExportMenu = blk => {
      loadXLSX().catch(() => {});
      const label = String(blkLabel(blk)).toUpperCase();
      let fmt = "xlsx", driveMode = false;
      document.getElementById("docPop")?.remove();
      const p = document.createElement("div");
      p.id = "docPop";
      const path0 = driveLastPath(budget.project, fullRef);
      p.innerHTML = `
        <div class="doc-card" role="dialog" aria-modal="true" style="max-width:640px">
          <div class="doc-head">
            <span class="doc-title">EXPORTER — ${esc(label)}</span>
            <button type="button" class="doc-x" data-close aria-label="Fermer">✕</button>
          </div>
          <div class="doc-body">
            <div class="doc-grid doc-grid-2">
              <label class="doc-lab" for="fdName">NOM DU FICHIER</label>
              <input id="fdName" class="doc-in doc-ro" type="text" autocomplete="off" readonly value="${esc((fullRef + " " + label).replace(/[\\/:*?"<>|]+/g, "-"))}">
              <span class="doc-lab exp-drv" hidden>DOSSIER DRIVE</span>
              <div class="exp-drv exp-drv-row" hidden>
                <input type="text" class="doc-in exp-path" id="expPath" data-keepcase autocomplete="off" readonly
                  title="Toucher : ouvrir le dossier — appui long : modifier" value="${esc(path0)}">
              </div>
            </div>
            <div class="fmt-choice fmt-grid">
              <button type="button" class="doc-btn fmt-btn on" data-fmt="xlsx">EXCEL</button>
              <button type="button" class="doc-btn fmt-btn" data-fmt="csv">CSV</button>
              <button type="button" class="doc-btn fmt-btn" data-fmt="json">JSON</button>
              <button type="button" class="doc-btn fmt-btn" data-fmt="gsheet">GOOGLE SHEETS</button>
            </div>
            <div class="doc-err fd-msg" id="fdMsg"></div>
          </div>
          <div class="doc-foot">
            <button type="button" class="doc-btn" data-cancel>ANNULER</button>
            <button type="button" class="doc-btn" data-act="device">SUR L'IPAD</button>
            <button type="button" class="doc-btn doc-save" data-act="drive">DANS LE DRIVE</button>
            <button type="button" class="doc-btn doc-save" data-act="save" hidden>ENREGISTRER</button>
          </div>
        </div>`;
      document.body.appendChild(p);
      popEnhance(p, "export");
      const $q = sel => p.querySelector(sel);
      const msg = $q("#fdMsg");
      const ui = {
        msg: (t, kind) => { msg.innerHTML = t; msg.className = "doc-err fd-msg" + (kind ? " " + kind : ""); },
        close: () => p.remove(),
        setPath: v => { if (v) $q("#expPath").value = v; }
      };
      const devBtn = $q('[data-act="device"]'), drvBtn = $q('[data-act="drive"]'), saveBtn = $q('[data-act="save"]');
      const show = (el, on) => { el.hidden = !on; el.style.display = on ? "" : "none"; };
      /* boutons activés selon le cas */
      const refresh = () => {
        p.querySelectorAll(".exp-drv").forEach(el => show(el, driveMode));
        show(devBtn, !driveMode);
        show(drvBtn, !driveMode);
        show(saveBtn, driveMode);
        devBtn.disabled = fmt === "gsheet";       /* Google Sheets : Drive seulement */
      };
      const curPath = () => $q("#expPath").value.trim();
      refresh();
      /* adresse du dossier : toucher = ouvrir dans le Drive ;
         appui long (ou double toucher) = modifier, comme un champ normal */
      {
        const f = $q("#expPath");
        let timer = null, longDone = false;
        const edit = () => {
          f.readOnly = false; f.classList.add("editing");
          f.focus(); f.select();
        };
        f.addEventListener("pointerdown", () => {
          if (!f.readOnly) return;
          longDone = false;
          timer = setTimeout(() => { longDone = true; edit(); }, 550);
        });
        ["pointerup", "pointerleave", "pointercancel"].forEach(ev =>
          f.addEventListener(ev, () => clearTimeout(timer)));
        f.addEventListener("click", e => {
          if (!f.readOnly || longDone) { longDone = false; return; }
          e.preventDefault();
          driveOpenFolder(curPath());
        });
        f.addEventListener("dblclick", () => { if (f.readOnly) edit(); });
        f.addEventListener("contextmenu", e => { if (f.readOnly) e.preventDefault(); });
        const done = () => { f.readOnly = true; f.classList.remove("editing"); };
        f.addEventListener("blur", done);
        f.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); f.blur(); } });
      }

      p.addEventListener("click", async e => {
        if (e.target === p || e.target.closest("[data-close]")) { p.remove(); return; }
        if (e.target.closest("[data-cancel]")) {
          if (driveMode) { driveMode = false; ui.msg(""); refresh(); } else p.remove();
          return;
        }
        const f = e.target.closest("[data-fmt]");
        if (f) {
          fmt = f.dataset.fmt;
          p.querySelectorAll("[data-fmt]").forEach(x => x.classList.toggle("on", x === f));
          ui.msg("");
          refresh();
          return;
        }
        const b = e.target.closest("[data-act]");
        if (!b || b.disabled) return;
        const name = ($q("#fdName").value.trim() || fullRef + " " + label).replace(/[\\/:*?"<>|]+/g, "-");
        if (b.dataset.act === "drive") { driveMode = true; ui.msg(""); refresh(); return; }
        if (b.dataset.act === "device") {
          await doExport(blk, fmt, name, { target: "device", path: "", ui });
          return;
        }
        /* ENREGISTRER dans le Drive */
        const path = driveCleanPath(curPath());
        if (fmt === "gsheet") {
          const out = await sendToDrive(blk, name, path);
          if (out && out.path) ui.setPath(out.path);
          driveDoneFlash();
          return;
        }
        saveBtn.disabled = true;
        await doExport(blk, fmt, name, { target: "drive", path, ui });
        saveBtn.disabled = false;
      });
    };

    const showImport = (name, head, rows) => {
      histLog("IMPORT", "APERÇU IMPORT", name + " — " + rows.length + " LIGNE(S)");
      const body = rows.slice(0, 300).map(r =>
        "<tr>" + head.map((_, i) => `<td>${esc(r[i] ?? "")}</td>`).join("") + "</tr>").join("");
      popup(`
        <div class="blk-card blk-wide">
          <button type="button" class="blk-x" data-close>✕</button>
          <div class="blk-title">IMPORT — ${esc(name)}</div>
          <div class="blk-sub">${rows.length} ligne(s) lue(s)${rows.length > 300 ? " — 300 premières affichées" : ""}.
            Aperçu seulement : l'enregistrement dans la feuille Google nécessite
            une fonction d'import côté Apps Script (Code.gs).</div>
          <div class="blk-scroll">
            <table class="bdg-d-table blk-imp">
              <thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead>
              <tbody>${body}</tbody>
            </table>
          </div>
        </div>`);
    };

    const importGSheet = async () => {
      const url = prompt("Lien de la feuille Google (partagée « Toute personne disposant du lien ») :");
      if (!url) return;
      const id = (url.match(/\/d\/([a-zA-Z0-9_-]+)/) || [])[1];
      const gid = (url.match(/[#&?]gid=(\d+)/) || [])[1] || "0";
      if (!id) { alert("Lien Google Sheets non reconnu."); return; }
      try {
        const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`);
        if (!r.ok) throw new Error("accès refusé (vérifie le partage)");
        const X = await loadXLSX();
        const wb = X.read(await r.text(), { type: "string" });
        const aoa = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
        showImport("Google Sheets", aoa[0] || [], aoa.slice(1));
      } catch (e) {
        alert("IMPORT GOOGLE SHEETS IMPOSSIBLE : " + e.message);
      }
    };

    const openImportMenu = blk => {
      const p = popup(`
        <div class="blk-card">
          <button type="button" class="blk-x" data-close>✕</button>
          <div class="blk-title">IMPORTER — ${esc(blkLabel(blk))}</div>
          <button type="button" class="blk-choice" data-src="file">Fichier (Excel, CSV, JSON)</button>
          <button type="button" class="blk-choice" data-src="gsheet">Google Sheets (lien)</button>
        </div>`);
      p.addEventListener("click", e => {
        const b = e.target.closest("[data-src]");
        if (!b) return;
        p.remove();
        if (b.dataset.src === "gsheet") importGSheet(); else doImport(blk);
      });
    };

    const doImport = blk => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = ".xlsx,.xls,.csv,.json,.txt";
      inp.onchange = async () => {
        const f = inp.files[0];
        if (!f) return;
        try {
          if (/\.json$/i.test(f.name)) {
            const data = JSON.parse(await f.text());
            const arr = Array.isArray(data) ? data : [data];
            const head = [...new Set(arr.flatMap(o => Object.keys(o || {})))];
            showImport(f.name, head, arr.map(o => head.map(h => o?.[h])));
          } else {
            const X = await loadXLSX();
            const wb = X.read(await f.arrayBuffer(), { type: "array" });
            const aoa = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
            showImport(f.name, aoa[0] || [], aoa.slice(1));
          }
        } catch (e) {
          alert("IMPORT IMPOSSIBLE : " + e.message);
        }
      };
      inp.click();
    };

    /* ===== impression DÉSIGNATIONS CLIENT : modèle de la société
       (logo, date d'édition, en-tête, tableau, totaux, pied de page) ===== */
    /* options d'impression, mémorisées */
    const PO_KEY = "svi_printopt_v1";
    const poLoad = () => {
      try { return Object.assign({ head: true, stamp: false }, JSON.parse(localStorage.getItem(PO_KEY) || "{}")); }
      catch (e) { return { head: true, stamp: false }; }
    };
    const openPrintOptions = () => {
      const o = poLoad();
      document.getElementById("docPop")?.remove();
      const p = document.createElement("div");
      p.id = "docPop";
      const yn = (name, on) => `
        <span class="po-yn" data-name="${name}">
          <button type="button" data-v="1" class="${on ? "on" : ""}">OUI</button>
          <button type="button" data-v="0" class="${on ? "" : "on"}">NON</button>
        </span>`;
      p.innerHTML = `
        <div class="doc-card po-card" role="dialog" aria-modal="true">
          <div class="doc-head">
            <span class="doc-title">${esc(budget.project)} : IMPRESSION DÉSIGNATIONS CLIENT</span>
            <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
          </div>
          <div class="doc-body">
            <div class="doc-grid doc-grid-2">
              <span class="doc-lab">EN-TÊTE ET PIED DE PAGE</span>${yn("head", o.head)}
              <span class="doc-lab">CACHET ET SIGNATURE</span>${yn("stamp", o.stamp)}
            </div>
          </div>
          <div class="doc-foot">
            <button type="button" class="doc-btn" data-cancel>ANNULER</button>
            <button type="button" class="doc-btn doc-save" id="poGo">IMPRIMER</button>
          </div>
        </div>`;
      document.body.appendChild(p);
      p.addEventListener("click", e => {
        const b = e.target.closest(".po-yn button");
        if (b) {
          b.parentElement.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
          return;
        }
        if (e.target === p || e.target.closest("[data-cancel]")) { p.remove(); return; }
        if (e.target.closest("#poGo")) {
          const val = n => p.querySelector(`.po-yn[data-name="${n}"] .on`)?.dataset.v === "1";
          const opt = { head: val("head"), stamp: val("stamp") };
          try { localStorage.setItem(PO_KEY, JSON.stringify(opt)); } catch (err) {}
          p.remove();
          printClient(opt);
        }
      });
    };

    /* texte principal sans doublon (intitulé DOC / OBS, descriptif TAF) */
    const dupKey = v => String(v ?? "").trim().toUpperCase().replace(/\s+/g, " ");
    const findDup = (list, get, v) => list.find(r => dupKey(get(r)) === dupKey(v));

    /* PDF validé dans l'aperçu → nouvelle ligne DOCUMENTS avec lien vers le fichier */
    /* retour sur la page du budget : liste DOCUMENTS relue (PDF enregistré ailleurs) */
    if (window.__sviDocRefresh) {
      window.removeEventListener("focus", window.__sviDocRefresh);
      document.removeEventListener("visibilitychange", window.__sviDocRefresh);
    }
    window.__sviDocRefresh = () => { if (document.visibilityState !== "hidden") updPill("doc"); };
    window.addEventListener("focus", window.__sviDocRefresh);
    document.addEventListener("visibilitychange", window.__sviDocRefresh);

    window.__sviSavePdfDoc = async (blob, title, name, code, fp) => {
      const now = new Date();
      const docRef = nextDocRef(now);
      const idb = "doc:" + ref + ":" + docRef;
      await sviFiles.put(idb, blob);
      const list = docsLoad();
      /* PDF généré : même intitulé à chaque édition, c'est la référence
         (…/001, …/002) qui distingue les versions */
      list.push({ ref: docRef, date: localDT(now), title: String(title).toUpperCase(),
        name, size: blob.size, type: "application/pdf", data: null, idb, code: code || "", fp: fp || "" });
      docsSave(list);
      histLog("DOC", "CRÉATION", docRef + " — " + title + " (PDF GÉNÉRÉ)");
      updPill("doc");
      return docRef;
    };
    /* export (Excel, CSV, JSON, Google Sheets) : une copie est ajoutée à DOCUMENTS
       (fichier gardé sur l'appareil, lien Drive s'il a été enregistré dans le Drive) */
    const saveExportDoc = async (blob, title, name, type, drive, drivePath) => {
      try {
        const now = new Date();
        const docRef = nextDocRef(now);
        let idb = null;
        if (blob) { idb = "doc:" + ref + ":" + docRef; await sviFiles.put(idb, blob); }
        const list = docsLoad();
        list.push({ ref: docRef, date: localDT(now), title: String(title).toUpperCase(), name,
          size: blob ? blob.size : 0, type: type || (blob && blob.type) || "", data: null, idb,
          drive: drive || "", drivePath: drivePath || "" });
        docsSave(list);
        histLog("DOC", "CRÉATION", docRef + " — " + title + " (EXPORT)");
        updPill("doc");
        return docRef;
      } catch (e) { return null; }
    };

    /* lien Drive ajouté à une ligne DOC déjà enregistrée */
    window.__sviDocSetDrive = (docRef, url, path) => {
      const l2 = docsLoad();
      const it = l2.find(x => x.ref === docRef);
      if (it) { it.drive = url || ""; it.drivePath = path || ""; docsSave(l2); }
      histLog("DOC", "DRIVE", docRef + " → " + (path || "MON DRIVE"));
    };
    window.__sviDrivePathDefault = () => driveLastPath(budget.project, fullRef);

    /* ===== APERÇU DÉSIGNATIONS CLIENT (façon NovApp) :
       volet « OPTIONS PDF » à gauche, aperçu des pages à droite,
       bouton GÉNÉRER PDF ; aucune impression lancée ===== */
    /* aperçu au modèle de la société (désignations client, tâches…) */
    const printModel = cfg => {
      /* empreinte du contenu : même bloc, mêmes données → même document */
      const fp = (() => {
        const str = cfg.docTitle + "|" + cfg.table + "|" + cfg.end;
        let h1 = 0x811c9dc5, h2 = 0;
        for (let i = 0; i < str.length; i++) {
          const c = str.charCodeAt(i);
          h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
          h2 = (h2 * 31 + c) >>> 0;
        }
        return h1.toString(36) + h2.toString(36);
      })();
      /* bloc déjà enregistré (et non expiré) : on ouvre directement son document */
      const docs = docsLoad();
      for (let i = docs.length - 1; i >= 0; i--) {
        const d = docs[i];
        /* contenu identique à un document déjà enregistré (même empreinte) :
           on l'ouvre tel quel ; anciens documents sans empreinte : même intitulé */
        const same = d.fp ? d.fp === fp
          : String(d.title || "").toUpperCase() === String(cfg.docTitle).toUpperCase();
        if (!d.expired && (d.idb || d.data) && same) {
          histLog(cfg.branch, "OUVERTURE DOCUMENT ENREGISTRÉ", d.ref);
          openDoc(i);
          return;
        }
      }
      histLog(cfg.branch, "APERÇU PDF");
      const N = v => String(v ?? "").trim().toUpperCase();
      const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
        "août", "septembre", "octobre", "novembre", "décembre"];
      const now = new Date();
      const dateTxt = `Agadir, le ${String(now.getDate()).padStart(2, "0")} ${mois[now.getMonth()]} ${now.getFullYear()}`;
      const prj = db.projects.find(x => N(x.code) === N(budget.project));
      const projet = (prj && prj.name && N(prj.name) !== N(budget.project)) ? prj.name : budget.project;
      const fileName = (fullRef + " " + cfg.fileTag).replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "_") + ".pdf";

      const w = window.open("", "_blank");
      if (!w) { alert("Autorisez les fenêtres pop-up pour l'aperçu."); return; }
      w.document.write(`<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<title>${esc(fullRef)} - ${esc(cfg.fileTag)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { background: #eef1f6; font-family: Arial, Helvetica, sans-serif; }
  /* ---- volet options ---- */
  #side { position: fixed; left: 0; top: 0; bottom: 0; width: 300px; background: #fff; border-right: 1px solid #e1e5eb;
          padding: 18px 16px; overflow-y: auto; z-index: 3; transition: transform .2s; color: #172033; }
  body.closed #side { transform: translateX(-300px); }
  #side h2 { margin: 0 0 6px; font-size: 15px; font-weight: 900; }
  #side .sub { font-size: 11px; color: #4b5563; margin-bottom: 16px; line-height: 1.35; }
  #side label.ck { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 700; margin: 12px 0 6px; }
  #side label.ck input { width: 18px; height: 18px; accent-color: #2a4fd1; }
  #side .opt { margin: 4px 0 4px 28px; }
  #side .opt span { display: block; font-size: 11px; font-weight: 800; color: #4b5563; margin: 8px 0 5px; }
  #side select { width: 100%; height: 36px; border: 1px solid #d6dbe3; border-radius: 8px; padding: 0 10px;
                 font-size: 12px; background: #fff; color: #172033; }
  #side .dis { opacity: .45; pointer-events: none; }
  #gen { width: 100%; margin-top: 22px; height: 42px; border: 0; border-radius: 8px; background: #2a4fd1; color: #fff;
         font-weight: 800; font-size: 13px; cursor: pointer; }
  #gen:disabled { opacity: .6; }
  #share { width: 100%; margin-top: 10px; height: 40px; border: 1px solid #2a4fd1; border-radius: 8px; background: #fff;
           color: #2a4fd1; font-weight: 800; font-size: 12px; cursor: pointer; }
  #share[hidden], #saveDoc[hidden], #saveOpts[hidden] { display: none; }
  #saveOpts { position: fixed; inset: 0; z-index: 20; background: rgba(15,23,42,.45); display: flex;
    align-items: center; justify-content: center; padding: 16px; }
  #saveOpts .sv-card { width: 100%; max-width: 640px; background: #fff; border-radius: 10px; overflow: hidden;
    box-shadow: 0 18px 40px rgba(0,0,0,.25); color: #172033; font-size: 12px; font-family: Arial, sans-serif; }
  #saveOpts .sv-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px;
    border-bottom: 1px solid #e5e9ef; font-size: 13px; font-weight: 800; }
  #saveOpts .sv-x { border: 0; background: none; font-size: 16px; cursor: pointer; color: #374151; }
  #saveOpts .sv-body { padding: 16px 18px 12px; display: grid; grid-template-columns: max-content 1fr; gap: 12px; align-items: center; }
  #saveOpts .sv-lab { font-size: 11px; font-weight: 800; color: #4b5563; white-space: nowrap; }
  #saveOpts input[data-keepcase] { text-transform: none; }
  #saveOpts input.sv-ro { background: #f3f5f8; color: #374151; }
  #saveOpts .sv-drv { display: flex; align-items: center; gap: 10px; min-height: 34px; }
  #saveOpts .sv-drv input { flex: 1; }
  #saveOpts .sv-link { flex: 1; color: #1d4ed8; text-decoration: underline; font-size: 12px; font-weight: 700; word-break: break-all; }
  #saveOpts .sv-link[hidden], #saveOpts .sv-edit[hidden], #saveOpts .sv-drv input[hidden] { display: none; }
  #saveOpts .sv-edit { width: 34px; height: 34px; border: 1px solid #d6dbe3; border-radius: 6px; background: #fff;
    font-size: 16px; cursor: pointer; flex: none; }
  #saveOpts input[type=text] { height: 34px; border: 1px solid #d6dbe3; border-radius: 6px; padding: 0 10px;
    font-size: 12px; text-transform: uppercase; min-width: 0; }
  #saveOpts .sv-ck { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; }
  #saveOpts .sv-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 18px;
    border-top: 1px solid #e5e9ef; background: #fafbfc; }
  #saveOpts .sv-btn { height: 34px; padding: 0 16px; border: 1px solid #d6dbe3; border-radius: 6px; background: #fff;
    font-size: 12px; font-weight: 800; cursor: pointer; color: #172033; }
  #saveOpts .sv-ok { background: #eef3fb; border-color: #9fb6d9; }
  @media (max-width: 650px) { #saveOpts .sv-body { grid-template-columns: 1fr; } }
  #savedBar a { color: #fff; font-weight: 800; }
  #saveDoc { width: 100%; margin-top: 10px; height: 42px; border: 0; border-radius: 8px; background: #15803d; color: #fff;
             font-weight: 800; font-size: 13px; cursor: pointer; }
  body.locked #side, body.locked #tog { display: none !important; }
  body.locked .mk { pointer-events: none; cursor: default; }
  #savedBar { position: fixed; top: 0; left: 0; right: 0; z-index: 4; height: 62px; display: flex; align-items: center; gap: 12px;
              padding: 0 150px 0 16px; background: #12355b; color: #fff; font: 800 13px Arial, Helvetica, sans-serif; }
  #savedBar[hidden] { display: none; }
  #savedBar span { flex: 1; }
  #savedBar button { height: 34px; padding: 0 14px; border: 0; border-radius: 8px; background: #fff; color: #12355b;
                     font-weight: 800; font-size: 12px; cursor: pointer; }
  body.locked #view { padding-top: 80px; }
  #msg { font-size: 11px; color: #4b5563; margin-top: 10px; min-height: 14px; }
  #tog { position: fixed; top: 14px; left: 254px; z-index: 4; width: 34px; height: 34px; border: 1px solid #d6dbe3;
         border-radius: 8px; background: #fff; font-size: 16px; cursor: pointer; transition: left .2s; }
  body.closed #tog { left: 10px; }
  #close { position: fixed; top: 14px; right: 14px; z-index: 4; height: 34px; padding: 0 14px; border: 1px solid #d6dbe3;
           border-radius: 8px; background: #fff; font-weight: 800; font-size: 12px; cursor: pointer; }
  #view { margin-left: 300px; padding: 20px; transition: margin .2s; overflow: hidden; }
  #pages .page { margin: 0 0 18px; }
  body.closed #view { margin-left: 0; padding-top: 56px; }
  /* ---- pages (A4 paysage, modèle de la société) ---- */
  .page { width: 297mm; height: 209mm; padding: 8mm 12mm 6mm; display: flex; flex-direction: column;
          overflow: hidden; background: #fff; margin: 0 auto 18px; position: relative;
          font-family: "Times New Roman", Times, serif; color: #000; font-size: 11pt; box-shadow: 0 2px 10px rgba(0,0,0,.12); }
  .head { position: relative; min-height: 40mm; flex: none; text-align: center; font-weight: bold; padding-bottom: 4mm; }
  .head img { position: absolute; left: 3mm; top: 0; width: 30mm; height: 30mm; object-fit: cover; }
  .head .date { position: absolute; right: 30mm; top: 15mm; }
  .head .t { padding: 22mm 40mm 0; line-height: 1.55; }
  .content { flex: 1; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  /* lignes compactes, largeurs de colonnes fixes (identiques pour tous les budgets) */
  th, td { border: 1px solid #000; padding: 0.6mm 1.4mm; font-size: 10pt; line-height: 1.15; vertical-align: middle;
           overflow: hidden; overflow-wrap: anywhere; }
  /* en-têtes de tableau : plus hauts, fond gris légèrement foncé */
  th { font-weight: bold; text-align: center; background: #d9dee6; padding-top: 2mm; padding-bottom: 2mm; }
  th.sub { font-size: 10pt; padding: 1mm 0.4mm; }
  td.c { text-align: center; } td.r { text-align: right; }
  td.rep { color: #555; font-style: italic; }
  tr.gfirst td { border-top: 1.6px solid #000; }
  td.gc, td.lc, td.pc, td.sc { vertical-align: top; }
  /* même caractère fin et clair (7,5 pt) pour tous les aperçus */
  table th, table td { font-size: 7.5pt !important; padding: 0.5mm 0.8mm; }
  /* clé primaire (quantité comptée) et sous-total par désignation */
  td.pk { font-weight: bold; }
  td.gt { border-left: 1px dotted #999; border-right: 1px dotted #999; }
  /* avant métré : ligne de désignation et sous-titre (lot / activité) */
  tr.mdes td { font-weight: bold; border-top: 1.6px solid #000; }
  tr.msub td:nth-child(2) { font-style: italic; text-decoration: underline; }
  tr.stot td { background: #eef1f6; font-weight: bold; }
  table th { padding-top: 1.2mm; padding-bottom: 1.2mm; } table th.sub { padding: 0.8mm 0.4mm; }
  .tot { margin-top: 2mm; display: flex; flex-direction: column; align-items: flex-end; }
  .tot div { display: flex; }
  .tot span { padding: 1mm 2mm; text-align: right; }
  .tot b { width: 30mm; border: 1px solid #000; border-top: 0; padding: 1mm 1.5mm; text-align: right; font-weight: normal; }
  .tot div:first-child b { border-top: 1px solid #000; }
  .arr { margin-top: 6mm; font-weight: bold; line-height: 1.9; }
  .foot { flex: none; text-align: center; font-weight: bold; font-size: 10pt; }
  /* numéro de page en bas à droite : la place libérée sert aux lignes */
  .foot { position: static; padding-top: 1.5mm; }
  .foot .pg { position: absolute; right: 12mm; bottom: 4mm; font-size: 9.5pt; }
  .foot hr { width: 65%; border: 0; border-top: 2.5px solid #5677a7; margin: 0 auto 1.5mm; }
  .foot .ad { line-height: 1.3; }
  /* signature et cachet : transparents, déplaçables au doigt dans l'aperçu */
  .mk { position: absolute; z-index: 2; cursor: grab; touch-action: none; -webkit-user-select: none; user-select: none;
        -webkit-user-drag: none; }
  .mk.stamp { width: 48mm; transform: rotate(-6deg); }
  .mk.sign { width: 45mm; }
  .mk.drag { outline: 1.5px dashed #2a4fd1; cursor: grabbing; }
  body.nohead .head img { visibility: hidden; }
  body.nofoot .foot .ad, body.nofoot .foot hr { visibility: hidden; }
  /* format portrait (A4 vertical) */
  body.portrait .page { width: 210mm; height: 296mm; }
  body.portrait .head .date { right: 12mm; }
  body.portrait .head .t { padding-left: 30mm; padding-right: 30mm; }
</style></head><body class="${cfg.portrait ? "portrait" : ""}">
<aside id="side">
  <h2>OPTIONS PDF</h2>
  <div class="sub">CHOISISSEZ LES PARTIES À INCLURE AVANT LA GÉNÉRATION.</div>
  <label class="ck"><input type="checkbox" id="oHead"> ENTÊTE</label>
  <label class="ck"><input type="checkbox" id="oFoot"> PIED DE PAGE</label>
  <label class="ck"><input type="checkbox" id="oSign"> SIGNATURE</label>
  <div class="opt" id="signOpts">
    <span>CHOIX SIGNATURE</span>
    <select id="oSignSrc">
      <option value="saved">SIGNATURE ENREGISTRÉE</option>
      <option value="new">IMPORTER UNE IMAGE…</option>
    </select>
    <span>PAGES SIGNATURE</span>
    <select id="oSignPg"><option value="first">PREMIÈRE PAGE</option><option value="last">DERNIÈRE PAGE</option><option value="all">TOUTES LES PAGES</option></select>
  </div>
  <label class="ck"><input type="checkbox" id="oStamp"> CACHET</label>
  <div class="opt" id="stampOpts">
    <span>PAGES CACHET</span>
    <select id="oStampPg"><option value="first">PREMIÈRE PAGE</option><option value="last">DERNIÈRE PAGE</option><option value="all">TOUTES LES PAGES</option></select>
  </div>
  <div class="sub" style="margin-top:14px">ASTUCE : FAITES GLISSER LA SIGNATURE OU LE CACHET SUR LA PAGE POUR LES PLACER.</div>
  <button type="button" id="gen">GÉNÉRER PDF</button>
  <div id="msg"></div>
  <div id="saveOpts" hidden><div class="sv-card" role="dialog" aria-modal="true">
    <div class="sv-head"><span>ENREGISTRER DANS DOCUMENTS</span><button type="button" class="sv-x" id="svX">✕</button></div>
    <div class="sv-body">
      <label class="sv-lab" for="svName">NOM DU FICHIER</label>
      <input type="text" id="svName" readonly class="sv-ro" value="${esc(fileName.replace(/\.pdf$/i, "").replace(/_/g, " "))}">
      <span class="sv-lab">DRIVE</span>
      <label class="sv-ck"><input type="checkbox" id="svDriveOn" checked> COPIE DANS LE DRIVE</label>
      <label class="sv-lab" for="svPath">DOSSIER DRIVE</label>
      <div class="sv-drv" id="svPathRow">
        <a href="#" class="sv-link" id="svLink">${esc(driveLastPath(budget.project, fullRef))}</a>
        <input type="text" id="svPath" data-keepcase value="${esc(driveLastPath(budget.project, fullRef))}" hidden>
        <button type="button" class="sv-edit" id="svEdit" title="Changer de dossier">✎</button>
      </div>
    </div>
    <div class="sv-foot"><button type="button" class="sv-btn" id="svCancel">ANNULER</button>
      <button type="button" class="sv-btn sv-ok" id="svGo">ENREGISTRER</button></div>
  </div></div>
  <button type="button" id="saveDoc" hidden>ENREGISTRER DANS DOCUMENTS</button>
  <button type="button" id="share" hidden>PARTAGER LE PDF</button>
  <input type="file" id="signFile" accept="image/*" hidden>
</aside>
<button type="button" id="tog" title="Masquer / afficher les options">‹</button>
<div id="savedBar" hidden><span id="savedRef"></span>
  <button type="button" id="share2">PARTAGER</button></div>
<button type="button" id="close">✕ FERMER</button>
<main id="view"><div id="pages"></div></main>

<div id="src" style="display:none">
  <div class="head">
    <img src="${SVI_LOGO}" alt="">
    <div class="date">${dateTxt}</div>
    <div class="t">BUDGET N° : ${esc(fullRef)}<br>CLIENT : À COMPLÉTER<br>PROJET : ${esc(projet)}${cfg.headLine ? "<br>" + esc(cfg.headLine) : ""}</div>
  </div>
  ${cfg.table}
  <div id="end">${cfg.end}</div>
  <div class="foot"><div class="pg">Page 1 / 1</div><hr>
    <div class="ad"><br>
    </div></div>
</div>
<script>
(function () {
  const STAMP = "${SVI_STAMP}";
  const $ = id => document.getElementById(id);
  const KEY = "svi_printopt_v2", SKEY = "svi_sign_v1";
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
               set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } } };
  let o = { head: true, foot: true, sign: false, signPg: "last", stamp: false, stampPg: "last" };
  try { Object.assign(o, JSON.parse(ls.get(KEY) || "{}")); } catch (e) {}
  /* signature importée sur cet appareil, sinon signature provisoire */
  let signImg = ls.get(SKEY) || "${SVI_SIGN}";

  const src = $("src"), out = $("pages"), tpl = $("tpl");
  /* code aléatoire de l'aperçu, imprimé sur chaque page */
  const newCode = () => {
    const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const r = new Uint32Array(8);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(r) : r.forEach((_, i) => r[i] = Math.random() * 1e9);
    const c = [...r].map(x => A[x % A.length]).join("");
    return c.slice(0, 4) + "-" + c.slice(4);
  };
  let code = newCode();
  const allRows = [...tpl.tBodies[0].rows].map(r => r.outerHTML);

  const build = () => {
    unfit();
    out.innerHTML = "";
    const pages = [];
    const newPage = withTable => {
      const pg = document.createElement("div"); pg.className = "page";
      pg.appendChild(src.querySelector(".head").cloneNode(true));
      const c = document.createElement("div"); c.className = "content"; pg.appendChild(c);
      let tb = null;
      if (withTable) {
        const t = tpl.cloneNode(true); t.removeAttribute("id"); t.tBodies[0].innerHTML = "";
        c.appendChild(t); tb = t.tBodies[0];
      }
      pg.appendChild(src.querySelector(".foot").cloneNode(true));
      out.appendChild(pg); pages.push(pg);
      return { c, tb };
    };
    /* marge de 3 px : la bordure du bas de la dernière ligne reste visible */
    const full = c => {
      const bottom = [...c.children].reduce((m, x) => Math.max(m, x.offsetTop + x.offsetHeight), 0);
      return bottom > c.offsetTop + c.clientHeight - 3;
    };
    /* cellules fusionnées (rowspan) : désignation, lot, activités répétés
       s'étalent sur les lignes suivantes, sans agrandir la première ligne */
    const MERGE = [["gnext", "gc"], ["lnext", "lc"], ["pnext", "pc"], ["snext", "sc"]];
    const mk = html => {
      const t = document.createElement("tbody"); t.innerHTML = html;
      const r = t.rows[0];
      [...r.cells].forEach((c, i) => { c.dataset.ci = i; });
      return r;
    };
    const place = (tb, r) => {
      tb.appendChild(r);
      const an = tb.__an || (tb.__an = {});
      const used = [];
      [...r.cells].forEach(c => {
        const k = c.dataset.ci;
        const rule = MERGE.find(([rc, cc]) => c.classList.contains(cc) && r.classList.contains(rc));
        if (rule && an[k] && tb.contains(an[k])) {
          an[k].rowSpan += 1; c.remove(); used.push(an[k]);
        } else an[k] = c;
      });
      r.__used = used;
    };
    const unplace = r => { (r.__used || []).forEach(a => { a.rowSpan -= 1; }); r.remove(); };
    /* première ligne d'une page : groupe rappelé, trait du haut visible */
    const first = r => {
      r.classList.remove("gnext", "lnext", "pnext", "snext");
      if (r.dataset.rep) JSON.parse(r.dataset.rep).forEach((v, k) => {
        const c = r.cells[k];
        if (c && !c.textContent.trim() && v) { c.textContent = v; c.classList.add("rep"); }
      });
    };
    let cur = newPage(true);
    allRows.forEach(html => {
      let r = mk(html); r.__h = html;
      place(cur.tb, r);
      if (full(cur.c) && cur.tb.rows.length > 1) {
        unplace(r);
        cur = newPage(true);
        r = mk(html); r.__h = html; first(r); place(cur.tb, r);
      }
    });
    const end = src.querySelector("#end").cloneNode(true);
    cur.c.appendChild(end);
    if (full(cur.c)) {
      cur.c.removeChild(end);
      const prev = cur.tb;
      const n = prev ? Math.min(2, prev.rows.length - 1) : 0;
      const moved = n > 0 ? [...prev.rows].slice(-n) : [];
      moved.slice().reverse().forEach(unplace);
      cur = newPage(moved.length > 0);
      moved.forEach((m, i) => { const r = mk(m.__h); r.__h = m.__h; if (!i) first(r); place(cur.tb, r); });
      cur.c.appendChild(end);
    }
    const on = (pg, i) => pg === "all" || (pg === "first" && i === 0) || (pg === "last" && i === pages.length - 1);
    const mark = (pg, k, src) => {
      const p = posGet(k);
      const im = document.createElement("img");
      im.className = "mk " + k; im.dataset.k = k; im.src = src; im.draggable = false;
      im.style.left = p.x + "mm"; im.style.top = p.y + "mm";
      pg.appendChild(im);
    };
    pages.forEach((pg, i) => {
      pg.querySelector(".pg").textContent = "Page " + (i + 1) + " / " + pages.length;
      if (o.sign && signClear && on(o.signPg, i)) mark(pg, "sign", signClear);
      if (o.stamp && stampClear && on(o.stampPg, i)) mark(pg, "stamp", stampClear);
    });
    document.body.classList.toggle("nohead", !o.head);
    document.body.classList.toggle("nofoot", !o.foot);
    fit();
  };
  /* positions par défaut (mm depuis le coin haut-gauche de la page) */
  const PORT = ${cfg.portrait ? "true" : "false"}, PW = PORT ? 210 : 297, PH = PORT ? 297 : 210;
  const DEF_POS = PORT ? { sign: { x: 100, y: 235 }, stamp: { x: 145, y: 225 } }
    : { sign: { x: 185, y: 150 }, stamp: { x: 230, y: 140 } };
  /* position mémorisée par type d'aperçu, reprise pour tous les budgets */
  const PKEY = "svi_markpos_v1", PTYPE = ${JSON.stringify(cfg.fileTag)};
  const posAll = () => { try { return JSON.parse(ls.get(PKEY) || "{}") || {}; } catch (e) { return {}; } };
  const posGet = k => ((posAll()[PTYPE] || {})[k]) || o[k + "Pos"] || DEF_POS[k];
  const posSet = (k, p) => { const a = posAll(); a[PTYPE] = a[PTYPE] || {}; a[PTYPE][k] = p; ls.set(PKEY, JSON.stringify(a)); };
  /* fond blanc rendu transparent : la signature / le cachet se superposent au texte */
  let signClear = null, stampClear = null;
  const clearWhite = src => new Promise(ok => {
    if (!src) return ok(null);
    const im = new Image();
    im.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = im.naturalWidth; cv.height = im.naturalHeight;
      const g = cv.getContext("2d");
      g.drawImage(im, 0, 0);
      try {
        const d = g.getImageData(0, 0, cv.width, cv.height), a = d.data;
        for (let i = 0; i < a.length; i += 4) {
          const m = Math.min(a[i], a[i + 1], a[i + 2]);
          /* blanc → transparent, gris clair → semi-transparent */
          if (m > 235) a[i + 3] = 0;
          else if (m > 190) a[i + 3] = Math.round(a[i + 3] * (235 - m) / 45);
        }
        g.putImageData(d, 0, 0);
        ok(cv.toDataURL("image/png"));
      } catch (e) { ok(src); }
    };
    im.onerror = () => ok(src);
    im.src = src;
  });
  const prepMarks = async () => {
    [signClear, stampClear] = await Promise.all([clearWhite(signImg), clearWhite(STAMP)]);
  };

  /* glisser la signature ou le cachet : nouvelle position pour toutes les pages */
  let scale = 1;
  out.addEventListener("pointerdown", e => {
    const im = e.target.closest(".mk");
    if (!im || document.body.classList.contains("locked")) return;
    e.preventDefault();
    const k = im.dataset.k;
    const pxmm = 96 / 25.4;
    const start = { x: e.clientX, y: e.clientY };
    const p0 = Object.assign({}, posGet(k));
    let p = p0;
    im.classList.add("drag");
    const mv = ev => {
      ev.preventDefault();
      p = { x: Math.round((p0.x + (ev.clientX - start.x) / scale / pxmm) * 10) / 10,
            y: Math.round((p0.y + (ev.clientY - start.y) / scale / pxmm) * 10) / 10 };
      p.x = Math.max(0, Math.min(PW - 15, p.x)); p.y = Math.max(0, Math.min(PH - 10, p.y));
      im.style.left = p.x + "mm"; im.style.top = p.y + "mm";
    };
    const tm = ev => ev.preventDefault();
    const up = () => {
      document.removeEventListener("pointermove", mv);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      document.removeEventListener("touchmove", tm);
      im.classList.remove("drag");
      posSet(k, p);
      save();
    };
    document.addEventListener("pointermove", mv, { passive: false });
    document.addEventListener("touchmove", tm, { passive: false });
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  });

  /* réduction à l'écran par « transform » (ne change pas la mise en page) */
  const fit = () => {
    const pg = out.querySelector(".page");
    if (!pg) return;
    const avail = $("view").clientWidth - 40;
    const z = Math.min(1, avail / pg.offsetWidth);
    scale = z;
    out.style.transformOrigin = "top left";
    out.style.transform = "scale(" + z + ")";
    out.style.width = pg.offsetWidth + "px";
    out.style.marginLeft = Math.max(0, (avail - pg.offsetWidth * z) / 2) + "px";
    $("view").style.height = (out.offsetHeight * z + 60) + "px";
  };
  const unfit = () => { out.style.transform = "none"; out.style.marginLeft = "0"; };

  /* options ↔ formulaire */
  const sync = () => {
    $("oHead").checked = o.head; $("oFoot").checked = o.foot;
    $("oSign").checked = o.sign; $("oStamp").checked = o.stamp;
    $("oSignPg").value = o.signPg; $("oStampPg").value = o.stampPg;
    $("oSignSrc").value = "saved";
    $("signOpts").classList.toggle("dis", !o.sign);
    $("stampOpts").classList.toggle("dis", !o.stamp);
    $("msg").textContent = o.sign && !signImg ? "AUCUNE SIGNATURE ENREGISTRÉE : CHOISISSEZ « IMPORTER UNE IMAGE… »" : "";
  };
  const save = () => {
    ls.set(KEY, JSON.stringify(o));
    /* contenu modifié après enregistrement : c'est un autre document, nouveau code */
    if (savedCodes[code]) code = newCode();
    lastPdf = null; $("share").hidden = true; $("saveDoc").hidden = true;
    sync(); build();
  };
  $("oHead").onchange = e => { o.head = e.target.checked; save(); };
  $("oFoot").onchange = e => { o.foot = e.target.checked; save(); };
  $("oSign").onchange = e => { o.sign = e.target.checked; save(); };
  $("oStamp").onchange = e => { o.stamp = e.target.checked; save(); };
  $("oSignPg").onchange = e => { o.signPg = e.target.value; save(); };
  $("oStampPg").onchange = e => { o.stampPg = e.target.value; save(); };
  $("oSignSrc").onchange = e => { if (e.target.value === "new") $("signFile").click(); e.target.value = "saved"; };
  $("signFile").onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        /* signature réduite (≤ 600 px) pour rester légère */
        const k = Math.min(1, 600 / Math.max(im.width, im.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
        cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
        signImg = cv.toDataURL("image/png");
        ls.set(SKEY, signImg);
        o.sign = true;
        prepMarks().then(save);
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(f);
  };
  $("tog").onclick = () => {
    document.body.classList.toggle("closed");
    $("tog").textContent = document.body.classList.contains("closed") ? "›" : "‹";
    setTimeout(fit, 220);
  };
  $("close").onclick = () => window.close();
  window.addEventListener("resize", fit);

  /* GÉNÉRER PDF : vrai fichier PDF A4 paysage */
  const load = u => new Promise((ok, ko) => {
    if ((u.includes("html2canvas") && window.html2canvas) || (u.includes("jspdf") && window.jspdf)) return ok();
    const sc = document.createElement("script"); sc.src = u; sc.onload = ok; sc.onerror = ko;
    setTimeout(() => ko(new Error("délai dépassé")), 15000);
    document.head.appendChild(sc);
  });
  let lastPdf = null;
  /* enregistrement direct (si la page du budget n'est plus joignable) */
  const saveHere = (blob, title, name, code, fp) => new Promise((ok, ko) => {
    const KEYD = "svi_docs_v1:" + ${JSON.stringify(String(ref))};
    let list = [];
    try { list = JSON.parse(localStorage.getItem(KEYD) || "[]") || []; } catch (e) {}
    const d = new Date(), p2 = n => String(n).padStart(2, "0");
    const day = p2(d.getFullYear() % 100) + "-" + p2(d.getMonth() + 1) + p2(d.getDate());
    const PFX = ${JSON.stringify(String(budget.project).trim().toUpperCase() + " BDG ")};
    const n = list.filter(x => String(x.ref).startsWith(PFX + "DOC " + day)).length + 1;
    const docRef = PFX + "DOC " + day + "/" + String(n).padStart(3, "0");
    const idb = "doc:" + ${JSON.stringify(String(ref))} + ":" + docRef;
    const r = indexedDB.open("svi_files", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("f");
    r.onerror = () => ko(r.error);
    r.onsuccess = () => {
      const t = r.result.transaction("f", "readwrite");
      t.objectStore("f").put(blob, idb);
      t.oncomplete = () => {
        list.push({ ref: docRef, date: d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + "T" + p2(d.getHours()) + ":" + p2(d.getMinutes()),
          title: title.toUpperCase(), name, size: blob.size, type: "application/pdf", data: null, idb, code, fp });
        localStorage.setItem(KEYD, JSON.stringify(list));
        ok(docRef);
      };
      t.onerror = () => ko(t.error);
    };
  });
  /* enregistrement dans DOCUMENTS : une seule fois par code d'aperçu,
     après un partage / enregistrement réussi */
  const savedCodes = {};
  /* document enregistré : configuration masquée, document figé
     (on le rouvrira ensuite depuis la liste DOCUMENTS) */
  const lockSaved = ref => {
    document.body.classList.add("locked", "closed");
    $("savedRef").textContent = "ENREGISTRÉ DANS DOCUMENTS : " + ref;
    $("savedBar").hidden = false;
    setTimeout(fit, 220);
  };
  const saveOnce = async (blob, name) => {
    const msg = $("msg");
    if (savedCodes[code]) { msg.textContent = "DÉJÀ ENREGISTRÉ DANS DOCUMENTS : " + savedCodes[code]; return; }
    const title = ${JSON.stringify(cfg.docTitle)};
    let saved = null, err = "";
    try {
      if (window.opener && !window.opener.closed && window.opener.__sviSavePdfDoc)
        saved = await window.opener.__sviSavePdfDoc(blob, title, name, code, ${JSON.stringify(fp)});
    } catch (e) { err = e && e.message ? e.message : String(e); }
    if (!saved) {
      try { saved = await saveHere(blob, title, name, code, ${JSON.stringify(fp)}); }
      catch (e) { err = err || (e && e.message ? e.message : String(e)); }
    }
    if (saved) { savedCodes[code] = saved; lockSaved(saved); }
    msg.textContent = saved
      ? "ENREGISTRÉ DANS DOCUMENTS : " + saved
      : "NON ENREGISTRÉ DANS DOCUMENTS" + (err ? " (" + err + ")" : "");
    /* copie dans le Drive, dans le dossier choisi */
    if (saved && $("svDriveOn").checked && window.opener && !window.opener.closed && window.opener.__sviDriveSave) {
      const path = ($("svPath").hidden ? $("svLink").textContent : $("svPath").value).trim();
      const bar = $("savedRef");
      bar.textContent = "ENREGISTRÉ DANS DOCUMENTS : " + saved + " — ENVOI DANS LE DRIVE…";
      try {
        const r = await window.opener.__sviDriveSave(blob, name, path);
        bar.innerHTML = "ENREGISTRÉ DANS DOCUMENTS : " + saved + " — DRIVE : " +
          (r.path || "MON DRIVE").replace(/[<>&]/g, "") + (r.url ? ' <a href="' + r.url + '" target="_blank" rel="noopener">OUVRIR</a>' : "");
        try { window.opener.__sviDocSetDrive && window.opener.__sviDocSetDrive(saved, r.url, r.path); } catch (e) {}
      } catch (e) {
        bar.textContent = "ENREGISTRÉ DANS DOCUMENTS : " + saved + " — PAS DANS LE DRIVE (" + (e && e.message ? e.message : e) + ")";
      }
    }
  };
  $("share2").onclick = () => $("share").onclick();
  $("share").onclick = async () => {
    if (!lastPdf || !savedCodes[code]) return;
    const { blob, file } = lastPdf;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: file.name }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = file.name; a.target = "_blank";
    document.body.appendChild(a); a.click(); a.remove();
  };
  /* seul ENREGISTRER ajoute le document à la liste DOCUMENTS (une fois) */
  $("saveDoc").onclick = () => {
    if (!lastPdf || savedCodes[code]) return;
    $("saveOpts").hidden = false;
  };
  $("svX").onclick = $("svCancel").onclick = () => { $("saveOpts").hidden = true; };
  /* dossier Drive affiché seulement si la copie Drive est cochée */
  const svRow = () => {
    const on = $("svDriveOn").checked;
    $("svPathRow").style.display = on ? "" : "none";
    document.querySelector('label[for="svPath"]').style.display = on ? "" : "none";
  };
  $("svDriveOn").onchange = svRow;
  /* adresse du dossier en lien bleu : ouvre le Drive ; ✎ : la changer (copier-coller) */
  const svShowLink = () => {
    const v = $("svPath").value.trim();
    if (v) $("svLink").textContent = v;
    $("svPath").hidden = true; $("svLink").hidden = false; $("svEdit").hidden = false;
  };
  $("svEdit").onclick = () => {
    $("svPath").value = $("svLink").textContent;
    $("svLink").hidden = true; $("svEdit").hidden = true; $("svPath").hidden = false;
    $("svPath").focus(); $("svPath").select();
  };
  $("svPath").onblur = svShowLink;
  $("svPath").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); svShowLink(); } };
  $("svLink").onclick = async e => {
    e.preventDefault();
    const op = window.opener;
    if (!op || op.closed || !op.__sviDriveFolderUrl) return;
    const w = window.open("", "_blank");
    try {
      const url = await op.__sviDriveFolderUrl($("svLink").textContent.trim());
      if (op.__sviOpenGoogle) op.__sviOpenGoogle(url, w); else if (w) w.location.href = url; else window.open(url, "_blank");
    } catch (err) {
      if (w) w.close();
      alert("OUVERTURE DU DOSSIER IMPOSSIBLE : " + (op.__sviDriveErr ? op.__sviDriveErr(err) : err));
    }
  };
  svRow();
  $("svGo").onclick = async () => {
    if (!lastPdf) return;
    $("saveOpts").hidden = true;
    $("saveDoc").disabled = true;
    const nm = ($("svName").value.trim().toUpperCase() || lastPdf.file.name.replace(/\\.pdf$/i, ""))
      .replace(/[\\/:*?"<>|]+/g, "-") + ".pdf";
    lastPdf.file = new File([lastPdf.blob], nm, { type: "application/pdf" });
    await saveOnce(lastPdf.blob, nm);
    $("saveDoc").disabled = false;
  };

  $("gen").onclick = async () => {
    const btn = $("gen"), msg = $("msg");
    btn.disabled = true;
    try {
      msg.textContent = "PRÉPARATION DU PDF…";
      await load("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
      await load("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
      unfit();
      const pdf = new window.jspdf.jsPDF({ orientation: PORT ? "portrait" : "landscape", unit: "mm", format: "a4" });
      const pgs = [...out.querySelectorAll(".page")];
      for (let i = 0; i < pgs.length; i++) {
        msg.textContent = "PRÉPARATION DU PDF… PAGE " + (i + 1) + " / " + pgs.length;
        const cv = await html2canvas(pgs[i], { scale: 2, backgroundColor: "#ffffff" });
        if (i) pdf.addPage("a4", PORT ? "portrait" : "landscape");
        pdf.addImage(cv.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, PW, PH);
      }
      fit();
      const blob = pdf.output("blob");
      const file = new File([blob], "${fileName}", { type: "application/pdf" });
      msg.textContent = savedCodes[code]
        ? "PDF PRÊT — DÉJÀ ENREGISTRÉ (" + savedCodes[code] + ")"
        : "PDF PRÊT : « ENREGISTRER » L'AJOUTE AUX DOCUMENTS.";
      /* partage / enregistrement : sur un nouveau toucher (exigé par l'iPad) */
      lastPdf = { blob, file };
      /* partage possible seulement après enregistrement (bandeau du haut) */
      $("saveDoc").hidden = false;
    } catch (e) {
      msg.textContent = "PDF IMPOSSIBLE : " + (e && e.message ? e.message : e);
      fit();
    }
    btn.disabled = false;
  };

  sync();
  build();
  prepMarks().then(build);
  /* mise en page refaite une fois les polices chargées (hauteurs exactes) */
  try { document.fonts && document.fonts.ready.then(() => build()); } catch (e) {}
  window.addEventListener("load", () => build());
})();
<\/script></body></html>`);
      w.document.close();
    };


    const printClient = () => {
      const src = lastShown.client;
      if (!src || !src.rows.length) { alert("Aucune désignation à afficher."); return; }
      const rows = [...src.rows].sort((a, b) =>
        String(a.article).localeCompare(String(b.article), "fr", { numeric: true }));
      const td = (v, cls = "") => `<td class="${cls}">${v}</td>`;
      const body = rows.map(g => {
        const pu = Math.round(g.price * 100) / 100;
        return `<tr>${td(esc(g.article), "c")}${td(esc(g.designation))}${td(esc(g.unit), "c")}` +
          `${td(money(g.qty), "r")}${td(money(pu), "r")}${td(esc(frMoney(pu)), "c")}${td(money(g.ht), "r")}</tr>`;
      }).join("");
      const ht = rows.reduce((t, g) => t + g.ht, 0);
      const tva = ht * 0.2, ttc = ht + tva;
      printModel({
        branch: "DÉSIGNATIONS CLIENT", docTitle: "DÉSIGNATIONS CLIENT", fileTag: "DESIGNATIONS CLIENT", headLine: "",
        table: `<table id="tpl"><colgroup><col style="width:6%"><col style="width:33%"><col style="width:4%"><col style="width:9%">
          <col style="width:9.5%"><col style="width:28%"><col style="width:10.5%"></colgroup>
          <thead><tr><th rowspan="2">ART.</th><th rowspan="2">DESIGNATION</th><th rowspan="2">U</th><th rowspan="2">QUANTITE</th>
            <th colspan="2">PRIX UNITAIRES HORS TVA</th><th rowspan="2">MONTANT</th></tr>
            <tr><th class="sub">EN CHIFFRES</th><th class="sub">EN LETTRES</th></tr></thead>
          <tbody>${body}</tbody></table>`,
        end: `<div class="tot">
            <div><span>TOTAL H.T. :</span><b>${money(ht)}</b></div>
            <div><span>TOTAL T.V.A. :</span><b>${money(tva)}</b></div>
            <div><span>TOTAL T.T.C. :</span><b>${money(ttc)}</b></div>
          </div>
          <div class="arr">ARRÊTER LE PRÉSENT BUDGET À LA SOMME DE :<br>${esc(frMoney(ttc))} TOUTES TAXES COMPRISES</div>`
      });
    };

    /* TÂCHES : pour chaque désignation client, ses lots et ses activités
       primaires / secondaires avec leurs unités */
    /* export FORMAT INTERNE : une ligne par produit, valeurs complètes */
    const interneData = () => {
      const src = lastShown.client;
      const head = ["ART.", "DESIGNATION", "UPB", "LOT", "ACTIVITÉ PRIMAIRE", "ACTIVITÉ SECONDAIRE",
        "DÉTAIL", "UPB", "NBR", "DIM 1", "DIM 2", "DIM 3", "QPB", "CLÉ PRIMAIRE"];
      if (!src) return { head, rows: [] };
      const rows = [], bold = [];
      [...src.rows].sort((a, b) => String(a.article).localeCompare(String(b.article), "fr", { numeric: true }))
        .forEach(g => {
          let q = 0;
          (g.members || []).filter(l => l.kind === "prd").forEach(l => {
            if (l.cprice !== 0) q += Number(l.qty) || 0;
            rows.push([g.article, g.designation, g.unit, l.lot, l.prim, l.sec, l.detail, l.dunit || l.unit,
              l.nbr, l.dims[0], l.dims[1], l.dims[2], l.qty, l.cprice !== 0 ? "OUI" : "NON"]);
          });
          bold.push(rows.length);
          rows.push(["", "SOUS-TOTAL ART. " + g.article + " — " + g.designation, g.unit, "", "", "", "", "", "", "", "", "", q, ""]);
        });
      return { head, rows, bold };
    };

    /* DÉTAIL DÉLAIS : colonnes des tâches (lot, activités, unité) sans ART,
       DÉSIGNATION ni UPB, suivies des colonnes du délai */
    const printDelay = () => {
      const U = v => String(v ?? "").trim().toUpperCase();
      const lotOrd = new Map((db.lots || []).map(x => [U(stripLevelPrefix(x.name)), Number(x.order) || 0]));
      const primOrd = new Map((db.primaries || []).map(x => [U(stripLevelPrefix(x.name)), Number(x.order) || 0]));
      const secOrd = new Map((db.secondaries || []).map(x => [U(stripLevelPrefix(x.name)), Number(x.order) || 0]));
      const o = (m, v) => m.has(U(v)) ? m.get(U(v)) : 1e9;
      const src = (lastShown.client && lastShown.client.rows) || [];
      const ls = src.flatMap(g => g.members || []);
      const combos = new Map();
      ls.forEach(l => {
        const k = [l.lot, l.prim, l.sec].map(U).join("||");
        if (!combos.has(k)) combos.set(k, { lot: l.lot, prim: l.prim, sec: l.sec, ls: [] });
        combos.get(k).ls.push(l);
      });
      const list = [...combos.values()].sort((a, b) =>
        o(lotOrd, a.lot) - o(lotOrd, b.lot) || o(primOrd, a.prim) - o(primOrd, b.prim) || o(secOrd, a.sec) - o(secOrd, b.sec));
      if (!list.length) { alert("Aucune tâche à afficher."); return; }
      const unitOf = c => {
        const pref = c.ls.filter(l => l.kind === "prd" && l.cprice !== 0);
        const use = pref.length ? pref : c.ls.filter(l => l.kind === "prd").length ? c.ls.filter(l => l.kind === "prd") : c.ls;
        return [...new Set(use.map(l => U(l.dunit || l.unit)).filter(Boolean))].join(" / ");
      };
      const fmtD = v => { const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };
      const a = $("bdgDelayStart")?.value || "", b = $("bdgDelayEnd")?.value || "";
      const days = ($("bdgDelayDays")?.textContent || "").replace("—", "").trim();
      /* diagramme de Gantt à droite : une colonne par période
         (mois entre début et fin du budget, sinon 12 semaines) */
      const per = [];
      const da = a ? new Date(a + "T00:00") : null, db2 = b ? new Date(b + "T00:00") : null;
      const MO = ["JAN", "FÉV", "MAR", "AVR", "MAI", "JUN", "JUL", "AOÛ", "SEP", "OCT", "NOV", "DÉC"];
      if (da && db2 && db2 >= da) {
        const d = new Date(da.getFullYear(), da.getMonth(), 1);
        while (d <= db2 && per.length < 24) { per.push(MO[d.getMonth()] + " " + String(d.getFullYear()).slice(2)); d.setMonth(d.getMonth() + 1); }
      }
      if (!per.length) for (let k = 1; k <= 12; k++) per.push("S" + k);
      const td = (v, cls = "") => `<td class="${cls}">${v}</td>`;
      /* une ligne par lot / activité secondaire (activité primaire non affichée) */
      const seen = new Set();
      const rowsL = list.filter(c => { const k = U(c.lot) + "||" + U(c.sec); if (seen.has(k)) return false; seen.add(k); return true; });
      let body = "", prev = null;
      rowsL.forEach((c, i) => {
        const sameLot = prev && U(prev.lot) === U(c.lot);
        const rep = esc(JSON.stringify([String(c.lot ?? "")]));
        body += `<tr class="${sameLot ? "lnext" : "gfirst"}"${i ? ` data-rep="${rep}"` : ""}>` +
          td(sameLot ? "" : esc(c.lot), "lc") + td(esc(c.sec)) + td(esc(unitOf(c)), "c") +
          td("", "c") + td("", "c") + td("", "r") + per.map(() => td("", "gt")).join("") + "</tr>";
        prev = c;
      });
      const left = [12, 18, 4, 7, 7, 5], gw = (100 - left.reduce((t, x) => t + x, 0)) / per.length;
      printModel({
        branch: "DÉTAIL DÉLAIS", docTitle: "DÉTAIL DÉLAIS", fileTag: "DETAIL DELAIS", headLine: "DÉTAIL DÉLAIS",
        table: `<table id="tpl"><colgroup>${left.map(w => `<col style="width:${w}%">`).join("")}${per.map(() => `<col style="width:${gw.toFixed(2)}%">`).join("")}</colgroup>
          <thead><tr><th colspan="3">TÂCHES</th><th colspan="3">DÉLAIS</th><th colspan="${per.length}">DIAGRAMME DE GANTT</th></tr>
            <tr><th class="sub">LOT</th><th class="sub">ACTIVITÉ SECONDAIRE</th><th class="sub">U</th>
            <th class="sub">DÉBUT</th><th class="sub">FIN</th><th class="sub">JOURS</th>
            ${per.map(x => `<th class="sub">${esc(x)}</th>`).join("")}</tr></thead>
          <tbody>${body}</tbody></table>`,
        end: `<div class="tot">
            <div><span>DATE DÉBUT DU BUDGET :</span><b>${esc(fmtD(a))}</b></div>
            <div><span>DATE FIN DU BUDGET :</span><b>${esc(fmtD(b))}</b></div>
            <div><span>DÉLAI GLOBAL (JOURS) :</span><b>${esc(days)}</b></div>
          </div>`
      });
    };

    /* FORMAT MÉTRÉ (modèle « Détail métré ») : pour chaque désignation client,
       la quantité (clés primaires), puis par lot / activité les lignes de calcul
       NB × longueur × largeur × hauteur = quantité partielle */
    const metreGroups = () => {
      const src = lastShown.client;
      if (!src) return [];
      const U = v => String(v ?? "").trim().toUpperCase();
      return [...src.rows].sort((a, b) => String(a.article).localeCompare(String(b.article), "fr", { numeric: true }))
        .map(g => {
          const pk = (g.members || []).filter(l => l.kind === "prd" && l.cprice !== 0);
          const subs = new Map();
          pk.forEach(l => {
            /* regroupement par activité primaire (sans intitulé), activités secondaires ignorées */
            const k = U(l.prim);
            if (!subs.has(k)) subs.set(k, { title: "", lines: [] });
            subs.get(k).lines.push(l);
          });
          return { g, qty: pk.reduce((t, l) => t + (Number(l.qty) || 0), 0), subs: [...subs.values()] };
        });
    };
    const metreData = () => {
      const head = ["N°", "DÉSIGNATIONS", "U", "QUANTITÉ", "NB", "LONG", "LARG", "H OU EP", "QUANTITÉ PARTIELLE"];
      const rows = [], bold = [];
      metreGroups().forEach(({ g, qty, subs }) => {
        bold.push(rows.length);
        rows.push([g.article, g.designation, g.unit, qty, "", "", "", "", ""]);
        subs.forEach(sb => {
          if (sb.title) rows.push(["", sb.title, "", "", "", "", "", "", ""]);
          sb.lines.forEach(l => rows.push(["", l.detail, "", "", l.nbr, l.dims[0], l.dims[1], l.dims[2], l.qty]));
        });
      });
      return { head, rows, bold };
    };
    const printMetre = () => {
      const groups = metreGroups();
      if (!groups.length) { alert("Aucune désignation à afficher."); return; }
      const td = (v, cls = "") => `<td class="${cls}">${v}</td>`;
      const dim = v => esc(String(v ?? ""));
      let body = "";
      groups.forEach(({ g, qty, subs }) => {
        body += `<tr class="mdes">${td(esc(g.article), "c")}${td(esc(g.designation))}${td(esc(g.unit), "c")}` +
          `${td(esc(money(qty)), "r")}${td("")}${td("")}${td("")}${td("")}${td("")}</tr>`;
        subs.forEach(sb => {
          if (sb.title) body += `<tr class="msub">${td("")}${td(esc(sb.title))}${td("").repeat(7)}</tr>`;
          sb.lines.forEach(l => {
            body += `<tr>${td("")}${td(esc(l.detail))}${td("")}${td("")}${td(dim(l.nbr), "c")}` +
              `${td(dim(l.dims[0]), "r")}${td(dim(l.dims[1]), "r")}${td(dim(l.dims[2]), "r")}${td(esc(money(l.qty)), "r")}</tr>`;
          });
        });
      });
      printModel({
        branch: "DÉTAIL PRODUITS", docTitle: "AVANT MÉTRÉ", fileTag: "AVANT METRE", headLine: "AVANT MÉTRÉ", portrait: true,
        table: `<table id="tpl"><colgroup><col style="width:6%"><col style="width:38%"><col style="width:5%"><col style="width:10%">
            <col style="width:5%"><col style="width:8%"><col style="width:8%"><col style="width:8%"><col style="width:12%"></colgroup>
          <thead><tr><th rowspan="2">N°</th><th rowspan="2">DÉSIGNATIONS</th><th rowspan="2">U</th><th rowspan="2">QUANTITÉ</th>
            <th rowspan="2">NB</th><th colspan="3">DIMENSIONS</th><th rowspan="2">QUANTITÉ PARTIELLE</th></tr>
            <tr><th class="sub">LONG</th><th class="sub">LARG</th><th class="sub">H OU EP</th></tr></thead>
          <tbody>${body}</tbody></table>`,
        end: ""
      });
    };

    /* mode "prd" : décomposition + détail produits (aperçu TÂCHES)
       mode "chg" : décomposition (avec U) + détail charges (aperçu DÉTAIL CHARGES) */
    const printTasks = (mode = "prd") => {
      const CHG = mode === "chg", PLAIN = mode === "plain";
      const src = lastShown.client;
      if (!src || !src.rows.length) { alert("Aucune désignation à afficher."); return; }
      const U = v => String(v ?? "").trim().toUpperCase();
      const groups = [...src.rows].sort((a, b) =>
        String(a.article).localeCompare(String(b.article), "fr", { numeric: true }));
      const lotOrd = new Map((db.lots || []).map(x => [U(stripLevelPrefix(x.name)), Number(x.order) || 0]));
      const primOrd = new Map((db.primaries || []).map(x => [U(stripLevelPrefix(x.name)), Number(x.order) || 0]));
      const secOrd = new Map((db.secondaries || []).map(x => [U(stripLevelPrefix(x.name)), Number(x.order) || 0]));
      const o = (m, v) => m.has(U(v)) ? m.get(U(v)) : 1e9;
      /* unité d'une activité : unités des lignes de la désignation dans cette activité
         (clés primaires d'abord, sinon toutes les lignes produit, sinon toutes) */
      const unitOf = (members, pick, v) => {
        const ls = members.filter(l => U(pick(l)) === U(v));
        const pref = ls.filter(l => l.kind === "prd" && l.cprice !== 0);
        const use = pref.length ? pref : ls.filter(l => l.kind === "prd").length ? ls.filter(l => l.kind === "prd") : ls;
        return [...new Set(use.map(l => U(l.dunit || l.unit)).filter(Boolean))].join(" / ");
      };
      const td = (v, cls = "") => `<td class="${cls}">${v}</td>`;
      let body = "", totHT = 0, totTVA = 0;
      groups.forEach(g => {
        const members = g.members || [];
        const combos = new Map();
        members.forEach(l => {
          const k = [l.lot, l.prim, l.sec].map(U).join("||");
          if (!combos.has(k)) combos.set(k, { lot: l.lot, prim: l.prim, sec: l.sec });
        });
        const list = [...combos.values()].sort((a, b) =>
          o(lotOrd, a.lot) - o(lotOrd, b.lot) || o(primOrd, a.prim) - o(primOrd, b.prim) || o(secOrd, a.sec) - o(secOrd, b.sec));
        if (!list.length) list.push({ lot: "", prim: "", sec: "" });
        /* une ligne par produit de l'activité secondaire (colonnes du détail produits) ;
           valeurs répétées laissées vides (désignation, lot, activités) */
        const rowsG = [];
        let subQ = 0, subN = 0;
        list.forEach(c => {
          const prods = PLAIN ? [] : members.filter(l => l.kind === (CHG ? "chg" : "prd") &&
            U(l.lot) === U(c.lot) && U(l.prim) === U(c.prim) && U(l.sec) === U(c.sec));
          if (prods.length) prods.forEach(l => rowsG.push({ c, l }));
          else rowsG.push({ c, l: null });
        });
        let prev = null;
        rowsG.forEach(({ c, l }, i) => {
          const sameLot = prev && U(prev.lot) === U(c.lot);
          const samePrim = sameLot && U(prev.prim) === U(c.prim);
          const sameSec = samePrim && U(prev.sec) === U(c.sec);
          const full = [String(g.article ?? ""), String(g.designation ?? ""), String(g.unit ?? ""),
            String(c.lot ?? ""), String(c.prim ?? ""), String(c.sec ?? "")];
          const num = v => (v === null || v === undefined || v === "") ? "" : esc(money(v));
          const dim = v => esc(String(v ?? ""));
          /* sans prix, montants ni TVA ; produits : les clés primaires
             (prix non nul) sont en gras, seules leurs quantités sont totalisées */
          const pk = l && !CHG && l.cprice !== 0 ? " pk" : "";
          if (pk) subQ += Number(l.qty) || 0, subN++;
          const pr = PLAIN ? "" : CHG
            ? (l ? [td(esc(l.detail)), td(esc(l.dunit || l.unit), "c"), td(num(l.qty), "r")].join("") : td("").repeat(3))
            : (l ? [
                td(esc(l.detail), pk), td(esc(l.dunit || l.unit), "c" + pk), td(dim(l.nbr), "r" + pk),
                td(dim(l.dims[0]), "r" + pk), td(dim(l.dims[1]), "r" + pk), td(dim(l.dims[2]), "r" + pk),
                td(num(l.qty), "r" + pk)
              ].join("") : td("").repeat(7));
          const uSec = (CHG || PLAIN) ? td(sameSec ? "" : esc(unitOf(members, x => x.sec, c.sec)), "c sc") : "";

          body += `<tr class="${i ? "gnext" : "gfirst"}${sameLot ? " lnext" : ""}${samePrim ? " pnext" : ""}${sameSec ? " snext" : ""}"${i ? ` data-rep="${esc(JSON.stringify(full))}"` : ""}>` +
            td(i ? "" : esc(g.article), "c gc") + td(i ? "" : esc(g.designation), "gc") + td(i ? "" : esc(g.unit), "c gc") +
            td(sameLot ? "" : esc(c.lot), "lc") + td(samePrim ? "" : esc(c.prim), "pc") +
            td(sameSec ? "" : esc(c.sec), "sc") + uSec + pr + "</tr>";
          prev = c;
        });
        if (!CHG && !PLAIN) {
          body += `<tr class="stot"><td colspan="12" class="r">SOUS-TOTAL ART. ${esc(g.article)} — ${esc(g.designation)}` +
            ` (${esc(g.unit)})</td><td class="r">${esc(money(subQ))}</td></tr>`;
        }
      });
      if (PLAIN) {
        printModel({
          branch: "TÂCHES", docTitle: "DÉCOMPOSITION DU PROJET", fileTag: "DECOMPOSITION DU PROJET", headLine: "DÉCOMPOSITION DU PROJET",
          table: `<table id="tpl"><colgroup><col style="width:5%"><col style="width:30%"><col style="width:5%"><col style="width:15%">
              <col style="width:20%"><col style="width:20%"><col style="width:5%"></colgroup>
            <thead><tr><th>ART.</th><th>DESIGNATION</th><th>UPB</th><th>LOT</th>
              <th>ACTIVITÉ PRIMAIRE</th><th>ACTIVITÉ SECONDAIRE</th><th>U</th></tr></thead>
            <tbody>${body}</tbody></table>`,
          end: ""
        });
        return;
      }
      if (CHG) {
        printModel({
          branch: "DÉTAIL CHARGES", docTitle: "DÉTAIL CHARGES", fileTag: "DETAIL CHARGES", headLine: "DÉTAIL CHARGES",
          table: `<table id="tpl" class="dense"><colgroup>
              <col style="width:3%"><col style="width:17%"><col style="width:4%"><col style="width:10%">
              <col style="width:13%"><col style="width:13%"><col style="width:4%"><col style="width:24%">
              <col style="width:4%"><col style="width:8%"></colgroup>
            <thead><tr><th colspan="7">DÉSIGNATION CLIENT ET TÂCHES</th><th colspan="3">DÉTAIL CHARGES</th></tr>
              <tr><th class="sub">ART.</th><th class="sub">DESIGNATION</th><th class="sub">UPB</th><th class="sub">LOT</th>
              <th class="sub">ACTIVITÉ PRIMAIRE</th><th class="sub">ACTIVITÉ SECONDAIRE</th><th class="sub">U</th>
              <th class="sub">DÉSIGNATION</th><th class="sub">UCB</th><th class="sub">QCB</th></tr></thead>
            <tbody>${body}</tbody></table>`,
          end: ""
        });
        return;
      }
      printModel({
        branch: "DÉTAIL PRODUITS", docTitle: "DÉTAIL PRODUITS", fileTag: "DETAIL PRODUITS", headLine: "DÉTAIL PRODUITS",
        table: `<table id="tpl" class="dense"><colgroup>
            <col style="width:3%"><col style="width:15%"><col style="width:4%"><col style="width:9%">
            <col style="width:11%"><col style="width:11%"><col style="width:17%"><col style="width:4%">
            <col style="width:4%"><col style="width:5%"><col style="width:5%"><col style="width:5%"><col style="width:7%"></colgroup>
          <thead><tr><th colspan="6">DÉSIGNATION CLIENT ET TÂCHES</th><th colspan="7">DÉTAIL PRODUITS</th></tr>
            <tr><th class="sub">ART.</th><th class="sub">DESIGNATION</th><th class="sub">UPB</th><th class="sub">LOT</th>
            <th class="sub">ACTIVITÉ PRIMAIRE</th><th class="sub">ACTIVITÉ SECONDAIRE</th>
            <th class="sub">DÉSIGNATION</th><th class="sub">UPB</th><th class="sub">NBR</th><th class="sub">DIM 1</th>
            <th class="sub">DIM 2</th><th class="sub">DIM 3</th><th class="sub">QPB</th></tr></thead>
          <tbody>${body}</tbody></table>`,
        end: ""
      });
    };

    /* autres aperçus (détails, documents, TAF, observations) : même modèle,
       mêmes options, colonnes à largeur fixe */
    const COLW = { hdt: 14, hbr: 8, hac: 12, hde: 40,
      article: 5, detail: 30, unit: 5, nbr: 5, d1: 5, d2: 5, d3: 5, qty: 9, price: 9, amount: 11, tva: 6, ttc: 11,
      rref: 22, rtitle: 60, rexp: 8, robj: 15, rtext: 30, rresp: 13, rprev: 12, rdelay: 9, relap: 9, rimp: 4
    };
    const printGeneric = blk => {
      const label = String(blkLabel(blk)).toUpperCase();
      let cols, rows, end = "";
      if ((blk === "detail" && active === "dly") || blk === "hist") {
        const d = blkData(blk);
        if (!d.rows.length) { alert("Aucune donnée dans " + label + "."); return; }
        /* historique : date, branche et action étroites, détail large */
        cols = d.head.map((h, i) => [blk === "hist" ? ["hdt", "hbr", "hac", "hde"][i] : "c" + i, h, r => r[i], blk === "hist" && i ? "" : "center"]);
        rows = d.rows;
      } else if (REC_KINDS.includes(blk)) {
        if (!recLoad(blk).length) { alert("Aucune donnée dans " + label + "."); return; }
        cols = coOrder(blk, recCols[blk]);
        rows = recShown[blk] || recSorted(blk);
      } else {
        const src = lastShown.detail;
        if (!src || !src.rows.length) { alert("Aucune donnée dans " + label + "."); return; }
        cols = coOrder(active, src.cols);
        rows = src.rows;
        const ht = rows.reduce((t, l) => t + (l.amount || 0), 0);
        const tv = rows.reduce((t, l) => t + (l.tvaAmt || 0), 0);
        end = `<div class="tot">
            <div><span>TOTAL H.T. :</span><b>${money(ht)}</b></div>
            <div><span>TOTAL T.V.A. :</span><b>${money(tv)}</b></div>
            <div><span>TOTAL T.T.C. :</span><b>${money(ht + tv)}</b></div>
          </div>`;
      }
      const wsum = cols.reduce((t, c) => t + (COLW[c[0]] || 10), 0);
      const fmt = (v, k) => k === "tva" ? money(Number(v) || 0) + " %" : typeof v === "number" ? money(v) : String(v ?? "");
      const al = c => /number/.test(c[3] || "") ? "r" : /center/.test(c[3] || "") ? "c" : "";
      const body = rows.map(r => "<tr>" + cols.map(c => `<td class="${al(c)}">${esc(fmt(c[2](r), c[0]))}</td>`).join("") + "</tr>").join("");
      printModel({
        branch: label, docTitle: label, fileTag: label, headLine: label,
        portrait: blk === "hist",
        table: `<table id="tpl"><colgroup>${cols.map(c => `<col style="width:${((COLW[c[0]] || 10) / wsum * 100).toFixed(2)}%">`).join("")}</colgroup>
          <thead><tr>${cols.map(c => `<th>${esc(c[1])}</th>`).join("")}</tr></thead>
          <tbody>${body}</tbody></table>`,
        end
      });
    };

    /* bouton d'impression de la liste des budgets : même aperçu */
    window.__sviPrintClient = printClient;

    const doPdf = blk => {
      if (blk === "client") return printClient();
      if (blk === "hier") return printTasks("plain");
      if (blk === "detail" && active === "chg") return printTasks("chg");
      if (blk === "detail" && active === "prd") return printTasks("prd");
      if (blk === "detail" && active === "dly") return printDelay();
      if (!(blk === "detail" && active === "qlt")) return printGeneric(blk);
      histLog(blkLabel(blk), "APERÇU PDF");
      let tableHTML;
      if (blk === "detail" && active === "qlt") {
        alert("Aucune donnée dans " + blkLabel(blk) + ".");
        return;
      }
      if (REC_KINDS.includes(blk) && !recLoad(blk).length) {
        alert("Aucune donnée dans " + blkLabel(blk) + ".");
        return;
      }
      if (blk === "hier" || REC_KINDS.includes(blk) || (blk === "detail" && active === "dly")) {
        const { head, rows } = blkData(blk);
        tableHTML = `<table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead>
          <tbody>${rows.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
      } else {
        const src = blk === "client"
          ? $("bdgClientBody")?.closest("table")
          : $("bdgTabBody")?.querySelector("table");
        if (!src) return;
        const t = src.cloneNode(true);
        t.removeAttribute("style");
        t.querySelectorAll("colgroup, .cf-btn, .col-rs, tr.bdg-d-filler").forEach(x => x.remove());
        t.querySelectorAll("input").forEach(i => i.replaceWith(document.createTextNode(i.value)));
        tableHTML = t.outerHTML;
      }
      const w = window.open("", "_blank");
      if (!w) { alert("Autorisez les fenêtres pop-up pour l'aperçu PDF."); return; }
      w.document.write(`<!doctype html><html><head><meta charset="utf-8">
        <title>${esc(fileBase(blk))}</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: Arial, Helvetica, sans-serif; color: #172033; font-size: 10px; }
          h1 { font-size: 16px; margin: 0 0 2px; } h2 { font-size: 12px; margin: 0 0 10px; color: #4b5563; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border-bottom: 1px solid #dfe4eb; padding: 3px 6px; text-align: left; white-space: nowrap; }
          th { background: #eef1f6; font-weight: 800; }
          .number { text-align: right; } .center { text-align: center; }
          tfoot td, .bdg-d-total-row td { background: #dcecff; font-weight: 800; }
          tr.selected td { background: #dbeafe; font-weight: 700; }
          .pv-bar { position: sticky; top: 0; display: flex; align-items: center; gap: 10px; margin: -8px -8px 10px;
                    padding: 10px 16px; background: #12355b; color: #fff; font-weight: 700; font-size: 14px; }
          .pv-bar span { flex: 1; }
          .pv-bar button { border: 1px solid rgba(255,255,255,.4); background: #fff; color: #12355b; border-radius: 8px;
                    padding: 8px 16px; font-weight: 800; font-size: 13px; cursor: pointer; }
          .pv-bar button.x { background: transparent; color: #fff; }
          @media print { .pv-bar { display: none !important; } }
        </style></head><body>
        <div class="pv-bar"><span>APERÇU — ${esc(blkLabel(blk))}</span>
          <button type="button" onclick="window.print()">🖨 IMPRIMER</button>
          <button type="button" class="x" onclick="window.close()">✕ FERMER</button></div>
        <h1>${esc(budget.project)} — ${esc(ref)}</h1>
        <h2>${esc(blkLabel(blk))} — ${new Date().toLocaleDateString("fr-FR")}</h2>
        ${tableHTML}
        </body></html>`);
      w.document.close();
    };

    /* bulle d'explication sur une case signalée */
    const showWhy = td => {
      document.getElementById("whyTip")?.remove();
      const tip = document.createElement("div");
      tip.id = "whyTip";
      tip.textContent = td.dataset.why;
      document.body.appendChild(tip);
      const r = td.getBoundingClientRect();
      const w = Math.min(280, window.innerWidth - 16);
      tip.style.width = w + "px";
      tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px";
      const above = r.top - tip.offsetHeight - 8;
      tip.style.top = (above > 8 ? above : r.bottom + 8) + "px";
      const close = () => { tip.remove(); document.removeEventListener("click", close, true); };
      setTimeout(() => document.addEventListener("click", close, true), 0);
      setTimeout(close, 5000);
    };

    /* ===== fenêtre DOC : ajout d'un document au budget ===== */
    /* ===== HISTORIQUE (bouton H) : journal des changements du budget
       et de ses branches (DOC, TAF, OBS, impressions, exports, disposition…) ===== */
    const HIST_KEY = "svi_hist_v1:" + String(ref);
    const histLoad = () => {
      try { return JSON.parse(localStorage.getItem(HIST_KEY) || "[]") || []; } catch (e) { return []; }
    };
    const histLog = (branche, action, detail = "") => {
      try {
        const l = histLoad();
        l.push({ t: new Date().toISOString(), b: branche, a: action, d: String(detail || "").toUpperCase() });
        localStorage.setItem(HIST_KEY, JSON.stringify(l.slice(-1000)));
      } catch (e) {}
    };
    /* ===== HISTORIQUE : tableau avec tri / filtre par colonne (comme les autres),
       menu ⋯ (exporter, aperçu PDF A4 vertical, agrandir) ===== */
    let histBranch = "";
    const histCols = [
      ["hdt", "DATE", r => r.dt, "center"],
      ["hbr", "BRANCHE", r => r.b, ""],
      ["hac", "ACTION", r => r.a, ""],
      ["hde", "DÉTAIL", r => r.d, ""]
    ];
    const histRows = () => {
      const p2 = n => String(n).padStart(2, "0");
      const f = v => { const d = new Date(v); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} À ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
      const all = histLoad().reverse().map(h => ({ ...h, dt: f(h.t) }));
      return cfApply("hist", histCols, all.filter(h => !histBranch || h.b === histBranch));
    };
    const histData = () => {
      const oc = coOrder("hist", histCols);
      return { head: oc.map(c => c[1]), rows: histRows().map(r => oc.map(c => c[2](r))) };
    };

    const openHistory = () => {
      histBranch = "";
      const all = histLoad();
      const branches = [...new Set(all.map(h => h.b))].sort();
      document.getElementById("docPop")?.remove();
      const p = document.createElement("div");
      p.id = "docPop";
      p.innerHTML = `
        <div class="doc-card hist-card" role="dialog" aria-modal="true">
          <div class="doc-head">
            <span class="doc-title">HISTORIQUE ${esc(fullRef)}</span>
            <span class="hist-tools">
              <button type="button" class="blk-more hist-more" title="Actions" aria-label="Actions">⋯</button>
              <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
            </span>
          </div>
          <div class="doc-body">
            <div class="hist-filters">
              <button type="button" class="hist-f on" data-b="">TOUT ${svCnt(all.length)}</button>
              ${branches.map(b => `<button type="button" class="hist-f" data-b="${esc(b)}">${esc(b)} ${svCnt(all.filter(h => h.b === b).length)}</button>`).join("")}
            </div>
            <div class="hist-scroll"><table class="bdg-d-table hist-table" id="histTable"></table></div>
          </div>
          <div class="doc-foot">
            <button type="button" class="doc-btn doc-save" data-cancel>FERMER</button>
          </div>
        </div>`;
      document.body.appendChild(p);
      popEnhance(p, "hist");
      const render = () => {
        const t = p.querySelector("#histTable");
        if (!t || !document.body.contains(p)) { window.__sviHistRefresh = null; return; }
        const rows = histRows();
        const oc = coOrder("hist", histCols);
        t.innerHTML = `<thead><tr>${oc.map(c => cfHead("hist", c[0], c[1], c[3])).join("")}</tr></thead>
          <tbody>${rows.map(r => "<tr>" + oc.map(c => `<td class="${c[3]}">${esc(c[2](r))}</td>`).join("") + "</tr>").join("") ||
            `<tr><td colspan="4" class="empty">AUCUN CHANGEMENT ENREGISTRÉ</td></tr>`}</tbody>`;
      };
      window.__sviHistRefresh = render;
      render();
      const close = () => { window.__sviHistRefresh = null; document.getElementById("blkMenu")?.remove(); p.remove(); };
      p.addEventListener("click", e => {
        const cfb = e.target.closest(".cf-btn");
        if (cfb) { e.stopPropagation(); cfOpenMenu(cfb); return; }
        const fb = e.target.closest(".hist-f");
        if (fb) {
          histBranch = fb.dataset.b || "";
          p.querySelectorAll(".hist-f").forEach(x => x.classList.toggle("on", x === fb));
          render();
          return;
        }
        /* ⋯ : mêmes actions que les blocs DOC / TAF / OBS */
        const more = e.target.closest(".hist-more");
        if (more) {
          e.stopPropagation();
          const old = document.getElementById("blkMenu");
          old?.remove();
          if (old && old.dataset.for === "hist") return;
          const big = p.querySelector(".hist-card").classList.contains("hist-max");
          const m = document.createElement("div");
          m.id = "blkMenu";
          m.dataset.for = "hist";
          m.innerHTML = `
            <button type="button" data-ha="export"><span>Exporter</span></button>
            <button type="button" data-ha="pdf"><span>Aperçu PDF</span></button>
            <button type="button" data-ha="max"><span>${big ? "Réduire" : "Agrandir"}</span></button>`;
          document.body.appendChild(m);
          const r = more.getBoundingClientRect();
          m.style.top = r.bottom + 4 + "px";
          m.style.left = Math.max(8, r.right - m.offsetWidth) + "px";
          m.style.zIndex = 10010;
          m.addEventListener("click", ev => {
            const it = ev.target.closest("[data-ha]");
            if (!it) return;
            m.remove();
            const a = it.dataset.ha;
            if (a === "max") {
              const c = p.querySelector(".hist-card");
              const on = c.classList.toggle("hist-max");
              if (on) { c.dataset.sw = c.style.width; c.dataset.sh = c.style.height; c.style.width = ""; c.style.height = ""; }
              else { c.style.width = c.dataset.sw || ""; c.style.height = c.dataset.sh || ""; }
              return;
            }
            if (!histData().rows.length) { alert("Aucune donnée dans l'historique."); return; }
            if (a === "export") { close(); openExportMenu("hist"); }
            else { close(); printGeneric("hist"); }
          });
          setTimeout(() => document.addEventListener("pointerdown", function off(ev) {
            if (!ev.target.closest("#blkMenu")) { m.remove(); document.removeEventListener("pointerdown", off, true); }
          }, true), 0);
          return;
        }
        if (e.target === p || e.target.closest("[data-cancel]")) close();
      });
    };

    const DOC_KEY = "svi_docs_v1:" + String(ref);
    /* références des branches : « <PROJET> BDG <TYPE> AA-MMJJ/NNN » (ex. H88 BDG DOC 26-1010/001) */
    const REF_PFX = String(budget.project).trim().toUpperCase() + " BDG ";
    const docsLoad = () => {
      try { return JSON.parse(localStorage.getItem(DOC_KEY) || "[]") || []; }
      catch (e) { return []; }
    };
    const docsSave = list => {
      try { localStorage.setItem(DOC_KEY, JSON.stringify(list)); return true; }
      catch (e) { return false; }
    };
    const pad = (n, w = 2) => String(n).padStart(w, "0");

    /* numéro : DOC AA-MMJJ/NNN (compteur du jour pour ce budget) */
    const nextDocRef = d => {
      const day = `${pad(d.getFullYear() % 100)}-${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
      const n = docsLoad().filter(x => String(x.ref).startsWith(REF_PFX + "DOC " + day)).length + 1;
      return `${REF_PFX}DOC ${day}/${pad(n, 3)}`;
    };

    const openDocForm = () => {
      const now = new Date();
      const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
      let docRef = nextDocRef(now);
      let file = null;

      document.getElementById("docPop")?.remove();
      const p = document.createElement("div");
      p.id = "docPop";
      p.innerHTML = `
        <div class="doc-card" role="dialog" aria-modal="true">
          <div class="doc-head">
            <span class="doc-title"><span id="docRef">${esc(docRef)}</span></span>
            <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
          </div>
          <div class="doc-body">
            <div class="doc-grid">
              <label class="doc-lab" for="docDate">DATE CRÉATION <b>*</b></label>
              <input id="docDate" class="doc-in" type="datetime-local" value="${local}">
              <label class="doc-lab" for="docTitle">INTITULÉ <b>*</b></label>
              <input id="docTitle" class="doc-in" type="text" placeholder="INTITULÉ" autocomplete="off">
              <span class="doc-lab">DOC <b>*</b></span>
              <div class="doc-file">
                <button type="button" class="doc-btn" id="docPick">TÉLÉCHARGER</button>
                <span id="docName" class="doc-fname">AUCUN DOCUMENT SÉLECTIONNÉ</span>
              </div>
              <span class="doc-lab" style="margin-left:0">DRIVE</span>
              <div class="doc-file">
                <label class="doc-lab" style="white-space:nowrap;padding:0"><input type="checkbox" id="docDriveOn" checked> COPIE DANS LE DRIVE</label>
              </div>
              <label class="doc-lab" for="docDrive" style="margin-left:0">DOSSIER DRIVE</label>
              <div class="doc-file" id="docDriveRow">
                <input id="docDrive" type="hidden" value="${esc(driveLastPath(budget.project, fullRef))}">
                <a href="#" class="drv-link" id="docDriveLink">${esc(driveLastPath(budget.project, fullRef))}</a>
                <button type="button" class="doc-flag" id="docDriveEdit" title="Changer de dossier">✎</button>
              </div>
            </div>
            <div id="docErr" class="doc-err"></div>
          </div>
          <div class="doc-foot">
            <button type="button" class="doc-btn" data-cancel>ANNULER</button>
            <button type="button" class="doc-btn doc-save" id="docSave">ENREGISTRER</button>
          </div>
        </div>`;
      document.body.appendChild(p);
      popEnhance(p, "doc");
      setTimeout(() => p.querySelector("#docTitle")?.focus(), 50);

      const close = () => p.remove();
      p.addEventListener("click", e => {
        if (e.target === p || e.target.closest("[data-cancel]")) close();
      });

      p.querySelector("#docDate").addEventListener("change", e => {
        const d = new Date(e.target.value);
        if (!isNaN(d)) {
          docRef = nextDocRef(d);
          p.querySelector("#docRef").textContent = docRef;
        }
      });

      /* dossier Drive affiché seulement si la copie Drive est cochée */
      const docDriveRow = () => {
        const on = p.querySelector("#docDriveOn").checked;
        p.querySelector("#docDriveRow").style.display = on ? "" : "none";
        p.querySelector('label[for="docDrive"]').style.display = on ? "" : "none";
      };
      p.querySelector("#docDriveOn").addEventListener("change", docDriveRow);
      docDriveRow();
      /* adresse en lien : ouvre le dossier ; ✎ : petite fenêtre pour en changer */
      p.querySelector("#docDriveLink").addEventListener("click", e => {
        e.preventDefault();
        driveOpenFolder(p.querySelector("#docDrive").value);
      });
      p.querySelector("#docDriveEdit").addEventListener("click", () => {
        drivePickFolder(p.querySelector("#docDrive").value, v => {
          if (!v) return;
          p.querySelector("#docDrive").value = v;
          p.querySelector("#docDriveLink").textContent = v;
        }, "VALIDER");
      });

      p.querySelector("#docPick").addEventListener("click", () => {
        const inp = document.createElement("input");
        inp.type = "file";
        inp.onchange = () => {
          file = inp.files[0] || null;
          p.querySelector("#docName").textContent =
            file ? file.name.toUpperCase() : "AUCUN DOCUMENT SÉLECTIONNÉ";
          p.querySelector("#docName").classList.toggle("ok", !!file);
        };
        inp.click();
      });

      p.querySelector("#docSave").addEventListener("click", async () => {
        const date = p.querySelector("#docDate").value;
        const title = p.querySelector("#docTitle").value.trim();
        const miss = [];
        p.querySelectorAll(".doc-in, .dt-native, .doc-file").forEach(x => x.classList.remove("bad"));
        if (!date) { miss.push("date"); p.querySelector("#docDate").classList.add("bad"); }
        if (!title) { miss.push("intitulé"); p.querySelector("#docTitle").classList.add("bad"); }
        if (!file) { miss.push("document"); p.querySelector(".doc-file").classList.add("bad"); }
        if (miss.length) {
          p.querySelector("#docErr").textContent = "Champs obligatoires manquants : " + miss.join(", ") + ".";
          return;
        }
        const dupD = findDup(docsLoad(), r => r.title, title);
        if (dupD) {
          p.querySelector("#docTitle").classList.add("bad");
          p.querySelector("#docErr").textContent = "Cet intitulé existe déjà (" + dupD.ref + ").";
          return;
        }

        /* fichier gardé sur l'appareil s'il est raisonnable (≤ 1,5 Mo) ;
           l'enregistrement sur Google Drive viendra plus tard */
        let data = null, idb = null;
        try { idb = "doc:" + ref + ":" + docRef; await sviFiles.put(idb, file); }
        catch (e) { idb = null; }
        if (!idb && file.size <= 1.5 * 1024 * 1024) {
          data = await new Promise(ok => {
            const fr = new FileReader();
            fr.onload = () => ok(fr.result);
            fr.onerror = () => ok(null);
            fr.readAsDataURL(file);
          });
        }
        const list = docsLoad();
        list.push({
          ref: docRef, date, title: title.toUpperCase(),
          name: file.name, size: file.size, type: file.type, data, idb
        });
        histLog("DOC", "CRÉATION", docRef + " — " + title);
        if (!docsSave(list)) {
          list[list.length - 1].data = null;
          docsSave(list);
        }
        const toDrive = p.querySelector("#docDriveOn").checked;
        const dpath = driveCleanPath(p.querySelector("#docDrive").value);
        close();
        updPill("doc");
        /* copie dans le Drive (en arrière-plan) : lien gardé sur la ligne DOC */
        if (toDrive) {
          const savedRef = docRef;
          const dname = (savedRef + " " + title).replace(/[\\/:*?"<>|]+/g, "-").toUpperCase() +
            ((file.name.match(/\.[a-z0-9]+$/i) || [""])[0]).toLowerCase();
          driveSave(file, dname, dpath).then(out => {
            const l2 = docsLoad();
            const it = l2.find(x => x.ref === savedRef);
            if (it) { it.drive = out.url || ""; it.drivePath = out.path || ""; docsSave(l2); }
            histLog("DOC", "DRIVE", savedRef + " → " + (out.path || "MON DRIVE") + "/" + dname);
          }).catch(err => alert("DOCUMENT " + savedRef + " ENREGISTRÉ SUR L'IPAD, MAIS PAS DANS LE DRIVE : " + driveErrText(err)));
        }
      });
    };

    /* ===== fenêtres et champs de saisie réglables (tailles mémorisées) ===== */
    const PS_KEY = "svi_popsize_v1";
    const psLoad = () => {
      try { return JSON.parse(localStorage.getItem(PS_KEY) || "{}") || {}; }
      catch (e) { return {}; }
    };
    const psSet = (k, v) => {
      const all = psLoad();
      if (v) all[k] = v; else delete all[k];
      try { localStorage.setItem(PS_KEY, JSON.stringify(all)); } catch (e) {}
    };
    /* glissement générique : fn(dx, dy) pendant, done() à la fin */
    const dragXY = (e, fn, done) => {
      e.preventDefault();
      e.stopPropagation();
      const x0 = e.clientX, y0 = e.clientY;
      const mv = ev => { ev.preventDefault(); fn(ev.clientX - x0, ev.clientY - y0); };
      const tm = ev => ev.preventDefault();
      const up = () => {
        document.removeEventListener("pointermove", mv);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        document.removeEventListener("touchmove", tm);
        done();
      };
      document.addEventListener("pointermove", mv, { passive: false });
      document.addEventListener("touchmove", tm, { passive: false });
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    };
    /* format unique des dates : JJ/MM/AAAA À HH:MM */
    const fmtField = (type, v) => {
      if (!v) return "";
      if (type === "time") return v.slice(0, 5);
      const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
      if (!m) return String(v);
      return `${m[3]}/${m[2]}/${m[1]}` + (type === "datetime-local" && m[4] ? ` À ${m[4]}:${m[5]}` : "");
    };
    const popEnhance = (p, kind) => {
      const card = p.querySelector(".doc-card");
      if (!card) return;
      const sizes = psLoad();
      /* fenêtre : poignée en bas à droite */
      const cs = sizes["win." + kind];
      if (cs) { card.style.width = cs.w + "px"; card.style.maxWidth = "none"; card.style.height = cs.h + "px"; }
      const ch = document.createElement("span");
      ch.className = "pop-rsz";
      ch.title = "Glisser pour redimensionner la fenêtre";
      card.appendChild(ch);
      ch.addEventListener("pointerdown", e => {
        const r = card.getBoundingClientRect();
        let w = r.width, h = r.height;
        card.style.maxWidth = "none";
        dragXY(e, (dx, dy) => {
          w = Math.max(300, Math.min(window.innerWidth - 16, Math.round(r.width + dx * 2)));
          h = Math.max(180, Math.min(window.innerHeight - 16, Math.round(r.height + dy * 2)));
          card.style.width = w + "px";
          card.style.height = h + "px";
        }, () => psSet("win." + kind, { w, h }));
      });
      /* champs : poignée sur le coin bas-droit de chaque champ */
      p.querySelectorAll(".doc-in").forEach((el, i) => {
        /* clé stable : identifiant du champ, sinon son libellé */
        const lab = (el.previousElementSibling?.textContent || "").replace(/\*/g, "").trim();
        const key = "fld." + kind + "." + (el.id || lab || i);
        /* agrandi vers la droite et vers le bas ; la saisie reste en haut
           (champ d'une ligne : la hauteur ajoutée passe en marge du bas) */
        let vis = el;   /* élément visible (affichage JJ/MM/AAAA À HH:MM pour les dates) */
        const setH = h => {
          vis.style.height = h + "px";
          if (vis.tagName === "INPUT") vis.style.paddingBottom = Math.max(0, h - 34) + "px";
        };
        const wrap = document.createElement("span");
        wrap.className = "fld-wrap" + (el.closest(".doc-row") ? " in-row" : "");
        el.replaceWith(wrap);
        wrap.appendChild(el);
        /* dates : affichage uniforme JJ/MM/AAAA À HH:MM, le sélecteur
           natif reste dessous (transparent) pour la saisie */
        if (["date", "time", "datetime-local"].includes(el.type)) {
          const show = document.createElement("div");
          show.className = "doc-in dt-show" + (el.classList.contains("doc-ro") ? " doc-ro" : "");
          el.classList.remove("doc-in");
          el.classList.add("dt-native");
          wrap.insertBefore(show, el);
          const upd = () => { show.textContent = fmtField(el.type, el.value) || "\u00a0"; };
          el.addEventListener("input", upd);
          el.addEventListener("change", upd);
          el.addEventListener("click", () => { try { el.showPicker?.(); } catch (err) {} });
          upd();
          vis = show;
        }
        const fs = sizes[key];
        if (fs) {
          if (fs.w) { wrap.style.width = fs.w + "px"; wrap.classList.add("sized"); }
          if (fs.h) setH(fs.h);
        }
        const hd = document.createElement("span");
        hd.className = "fld-rsz";
        hd.title = "Glisser pour régler la taille du champ";
        wrap.appendChild(hd);
        hd.addEventListener("pointerdown", e => {
          const r = vis.getBoundingClientRect();
          let w = r.width, h = r.height;
          dragXY(e, (dx, dy) => {
            w = Math.max(60, Math.round(r.width + dx));
            h = Math.max(28, Math.round(r.height + dy));
            wrap.style.width = w + "px";
            wrap.classList.add("sized");
            setH(h);
          }, () => psSet(key, { w, h }));
        });
        /* double-toucher sur la poignée : taille d'origine */
        hd.addEventListener("dblclick", () => {
          wrap.style.width = ""; wrap.classList.remove("sized");
          vis.style.height = ""; vis.style.paddingBottom = "";
          psSet(key, null);
        });
      });
    };

    /* ===== fenêtres OBS et TAF (même présentation que DOC) ===== */
    const recKey = kind => "svi_" + kind + "_v1:" + String(ref);
    const recLoad = kind => {
      if (kind === "doc") return docsLoad();
      try { return JSON.parse(localStorage.getItem(recKey(kind)) || "[]") || []; }
      catch (e) { return []; }
    };
    const recSave = (kind, list) => {
      try { localStorage.setItem(recKey(kind), JSON.stringify(list)); } catch (e) {}
    };
    const nextRecRef = (kind, d) => {
      const day = `${pad(d.getFullYear() % 100)}-${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
      const tag = kind.toUpperCase();
      const n = recLoad(kind).filter(x => String(x.ref).startsWith(REF_PFX + tag + " " + day)).length + 1;
      return `${REF_PFX}${tag} ${day}/${pad(n, 3)}`;
    };
    const updPill = kind => {
      const pill = shell.querySelector(`[data-pill="${kind}"]`);
      const n = recLoad(kind).length;
      if (pill) pill.innerHTML = SVI_ICON[kind] + `<span class="pl">${kind.toUpperCase()} ${svCnt(n)}</span>`;
      renderRec(kind);
      if (kind === "obs") {
        const imp = recLoad("obs").filter(r => r.important).length;
        const b = $("obsAlertBtn");
        if (b) b.hidden = !imp;
        const c = $("obsAlertN");
        if (c) c.textContent = imp;
        const rb = $("refBang");
        if (rb) rb.innerHTML = obsBang(ref);
      }
    };

    /* ===== bloc SUIVI : onglets DOCUMENTS / TAF / OBSERVATIONS ===== */
    let recActive = "doc";
    try { recActive = localStorage.getItem("svi_rectab_v1") || "doc"; } catch (e) {}
    if (!["doc", "taf", "obs"].includes(recActive)) recActive = "doc";
    const recTabApply = () => {
      shell.querySelectorAll(".rec-tab").forEach(b => b.classList.toggle("active", b.dataset.rtab === recActive));
      shell.querySelectorAll(".blk-suivi .rec-scroll").forEach(d => { d.hidden = d.dataset.pane !== recActive; });
    };

    /* ===== listes DOC / TAF / OBS sous le détail ===== */
    const fmtDT = v => {
      if (!v) return "";
      const d = new Date(v);
      if (isNaN(d)) return String(v);
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} À ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    /* colonne DOCUMENT : type et taille seulement (l'intitulé dit déjà de quoi il s'agit) */
    const docShort = r => {
      const ext = (String(r.name || "").match(/\.([a-z0-9]{1,5})$/i) || [])[1] ||
        (String(r.type || "").split("/")[1] || "FICHIER");
      const ko = r.size ? " · " + (r.size >= 1048576 ? money(r.size / 1048576) + " MO" : Math.max(1, Math.round(r.size / 1024)) + " KO") : "";
      return ext.toUpperCase() + ko;
    };
    /* colonnes : [clé, libellé, accesseur, classe] (même moteur que les autres tableaux) */
    const recCols = {
      doc: [["rref", "RÉFÉRENCE", r => r.ref, ""],
            ["rtitle", "INTITULÉ", r => r.title, ""],
            ["rexp", "EXPIRÉ", r => r.expired ? "OUI" : "NON", "center"]],
      taf: [["rref", "RÉFÉRENCE", r => r.ref, ""],
            ["robj", "OBJET TAF", r => r.objet || "", ""], ["rtext", "DESCRIPTIF TAF", r => r.text, ""],
            ["rresp", "RESPONSABLE", r => r.responsable, ""], ["rprev", "PRÉVU LE", r => fmtDT(r.prevu), ""],
            ["rdelay", "DÉLAI PLANIFIÉ", r => hm(new Date(r.prevu) - new Date(r.date)), "number"],
            ["relap", "DURÉE ÉCOULÉE", r => hm(Date.now() - new Date(r.date)), "number"]],
      obs: [["rref", "RÉFÉRENCE", r => r.ref, ""],
            ["rimp", "!", r => r.important ? "!" : "", "center"], ["rtext", "INTITULÉ", r => r.text, ""]]
    };
    Object.assign(CW_DEF, {
      rref: 210, rdate: 150, rtitle: 360, rfile: 120, rexp: 80, robj: 200, rtext: 420,
      rresp: 180, rprev: 140, rdelay: 120, relap: 120, rimp: 50
    });
    /* plus récent en premier (ordre par défaut, sans tri choisi) */
    const recSorted = kind => recLoad(kind).map((r, i) => ({ ...r, _i: i }))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b._i - a._i);
    const recShown = {};
    const recTableData = kind => {
      const cols = recCols[kind];
      const rows = recShown[kind] || cfApply(kind, cols, recSorted(kind), true);
      const oc = coOrder(kind, cols);
      return { head: oc.map(c => c[1]), rows: rows.map(r => oc.map(c => c[2](r))) };
    };

    const renderRec = kind => {
      const t = $("recTable-" + kind);
      if (!t) return;
      const cols = recCols[kind];
      const all = recSorted(kind);
      const list = cfApply(kind, cols, all);
      recShown[kind] = list;
      const title = $("recTitle-" + kind);
      if (title) title.innerHTML = SVI_ICON[kind] + esc(blkName[kind]) + " " + svCnt(list.length);
      const st = cfT(kind);
      title?.classList.toggle("cf-on", Object.keys(st.f).length > 0);

      const rows = list.map(r => "<tr>" + cols.map(([k, , get, cls]) => {
        const v = get(r);
        /* DOCUMENTS : la référence est le lien vers le fichier */
        if (kind === "doc" && k === "rref" && (r.data || r.idb || r.drive))
          return `<td><button type="button" class="rec-open" data-recopen="${r._i}" title="Ouvrir le document">${esc(v)}</button></td>`;
        if (k === "rimp")
          return `<td class="center"><button type="button" class="rec-flag ${r.important ? "on" : ""}" data-obsflag="${r._i}"
            title="${r.important ? "Désactiver" : "Activer"} l'alerte">!</button></td>`;
        if (k === "rexp")
          return `<td class="center"><input type="checkbox" class="rec-exp" data-docexp="${r._i}" ${r.expired ? "checked disabled" : ""}
            title="${r.expired ? "Expiré le " + esc(fmtDT(r.expiredAt)) : "Marquer comme expiré (définitif)"}"></td>`;
        if (k === "relap" && Date.now() > new Date(r.prevu))
          return `<td class="number rec-late" title="Échéance dépassée">${esc(v)}</td>`;
        return `<td class="${cls}" title="${esc(v)}">${esc(v)}</td>`;
      }).join("") + "</tr>").join("");
      const fill = list.length ? "" :
        `<tr><td colspan="${cols.length}" class="empty">AUCUN ENREGISTREMENT</td></tr>`;

      t.style.width = cwTableW(kind, cols) + "px";
      t.innerHTML = `<colgroup>${cwCols(kind, cols)}</colgroup>
        <thead><tr>${cols.map(([k, lab, , cls]) => cfHead(kind, k, lab, cls)).join("")}</tr></thead>
        <tbody>${rows}${fill}</tbody>`;
      coApply(kind, t);
    };

    /* fenêtre INF : informations du budget */
    const openInfo = () => {
      const prj = db.projects.find(x =>
        String(x.code ?? "").trim().toUpperCase() === String(budget.project).trim().toUpperCase());
      const dt = typeof budgetDate === "function" ? budgetDate(ref) : null;
      const prd = lines.filter(l => l.kind === "prd");
      const chg = lines.filter(l => l.kind === "chg");
      const sum = (arr, f) => arr.reduce((t, l) => t + (f(l) || 0), 0);
      const prdHT = sum(prd, l => l.amount), prdTTC = sum(prd, l => l.ttcAmount);
      const chgHT = sum(chg, l => l.amount), chgTTC = sum(chg, l => l.ttcAmount);
      const marge = prdHT - chgHT;
      const uniq = f => new Set(lines.map(f).map(v => String(v ?? "").trim()).filter(Boolean)).size;
      const desig = new Set(lines.map(l => desigKey(l))).size;
      const taf = recLoad("taf");
      const tafLate = taf.filter(r => Date.now() > new Date(r.prevu)).length;
      const obs = recLoad("obs");
      const items = [
        ["DATE CRÉATION", (dt && dt.label) || ""],
        ["PROJET", budget.project],
        ["INTITULÉ", (prj && prj.name) || "À COMPLÉTER"],
      ];
      document.getElementById("docPop")?.remove();
      const p = document.createElement("div");
      p.id = "docPop";
      p.innerHTML = `
        <div class="doc-card" role="dialog" aria-modal="true">
          <div class="doc-head">
            <span class="doc-title">INF ${esc(fullRef)}</span>
            <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
          </div>
          <div class="doc-body">
            <div class="doc-grid inf-grid">
              ${items.map(([k, v]) => `
                <span class="doc-lab">${esc(k)}</span>
                <span class="doc-in doc-ro inf-val">${esc(v)}</span>`).join("")}
            </div>
          </div>
          <div class="doc-foot">
            <button type="button" class="doc-btn doc-save" data-cancel>FERMER</button>
          </div>
        </div>`;
      document.body.appendChild(p);
      popEnhance(p, "inf");
      p.addEventListener("click", e => {
        if (e.target === p || e.target.closest("[data-cancel]")) p.remove();
      });
    };

    /* fenêtre centrée : observations marquées « ! » */
    const openObsAlert = () => {
      const list = recSorted("obs").filter(r => r.important);
      document.getElementById("docPop")?.remove();
      const p = document.createElement("div");
      p.id = "docPop";
      p.innerHTML = `
        <div class="doc-card" role="dialog" aria-modal="true">
          <div class="doc-head">
            <span class="doc-title">OBSERVATIONS IMPORTANTES — ${esc(fullRef)} ${svCnt(list.length)}</span>
            <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
          </div>
          <div class="doc-body">
            <div class="obs-alert-list">
              ${list.map(r => `
                <div class="obs-alert-item">
                  <span class="obs-alert-meta">⚠ ${esc(r.ref)} — ${esc(fmtDT(r.date))}</span>
                  <span class="obs-alert-text">${esc(r.text)}</span><span class="obs-alert-more">▾</span>
                </div>`).join("") || `<div class="obs-alert-text">Aucune observation importante.</div>`}
            </div>
          </div>
          <div class="doc-foot">
            <button type="button" class="doc-btn doc-save" data-cancel>FERMER</button>
          </div>
        </div>`;
      document.body.appendChild(p);
      popEnhance(p, "alert");
      obsAlertWire(p);
      p.addEventListener("click", e => {
        if (e.target === p || e.target.closest("[data-cancel]")) p.remove();
      });
    };

    /* ouvrir un document gardé sur l'appareil */
    const openDoc = i => {
      const d = docsLoad()[i];
      if (d && !d.idb && !d.data && d.drive) { openGoogleLink(d.drive, window.open("", "_blank")); return; }
      if (d && d.idb) {
        /* fenêtre ouverte tout de suite (sinon bloquée par Safari), fichier ensuite */
        const w = window.open("", "_blank");
        sviFiles.get(d.idb).then(blob => {
          if (!blob) { w && w.close(); alert("Document non disponible sur cet appareil."); return; }
          const url = URL.createObjectURL(blob);
          if (w) w.location.href = url; else download(d.name, blob);
        }).catch(e => { w && w.close(); alert("Ouverture impossible : " + e.message); });
        return;
      }
      if (!d || !d.data) { alert("Document non disponible sur cet appareil."); return; }
      try {
        const [meta, b64] = d.data.split(",");
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
        const blob = new Blob([arr], { type: (meta.match(/data:([^;]+)/) || [])[1] || d.type || "" });
        const url = URL.createObjectURL(blob);
        const w = window.open(url, "_blank");
        if (!w) download(d.name, blob);
      } catch (e) { alert("Ouverture impossible : " + e.message); }
    };
    const localDT = d =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const hm = ms => {
      if (!isFinite(ms)) return "0:00";
      const neg = ms < 0; ms = Math.abs(ms);
      const m = Math.round(ms / 60000);
      return (neg ? "-" : "") + Math.floor(m / 60) + ":" + pad(m % 60);
    };

    const openRecForm = kind => {
      const now = new Date();
      let recRef = nextRecRef(kind, now);
      const tafObj = "";

      const fieldsHTML = kind === "obs" ? `
          <div class="doc-grid doc-grid-2">
            <label class="doc-lab" for="recDate">DATE CRÉATION <b>*</b></label>
            <div class="doc-row">
              <input id="recDate" class="doc-in" type="datetime-local" value="${localDT(now)}">
              <button type="button" class="doc-flag" id="recFlag" title="Observation importante">!</button>
            </div>
            <label class="doc-lab" for="recText">INTITULÉ <b>*</b></label>
            <textarea id="recText" class="doc-in doc-ta" placeholder="INTITULÉ"></textarea>
          </div>` : `
          <div class="doc-grid">
            <label class="doc-lab" for="recDate">DATE CRÉATION <b>*</b></label>
            <input id="recDate" class="doc-in" type="datetime-local" value="${localDT(now)}">
            <label class="doc-lab" for="recObj">OBJET TAF</label>
            <input id="recObj" class="doc-in" type="text" value="${esc(tafObj)}">

            <label class="doc-lab" for="recText">DESCRIPTIF TAF <b>*</b></label>
            <textarea id="recText" class="doc-in doc-ta doc-ta-s" placeholder="DESCRIPTIF TAF"></textarea>
            <label class="doc-lab" for="recResp">RESPONSABLE <b>*</b></label>
            <input id="recResp" class="doc-in" type="text" placeholder="RESPONSABLE" autocomplete="off">

            <label class="doc-lab" for="recPDate">DATE PRÉVUE TRAITEMENT <b>*</b></label>
            <input id="recPDate" class="doc-in" type="date" value="${localDT(now).slice(0, 10)}">
            <label class="doc-lab" for="recPTime">HEURE PRÉVUE TRAITEMENT <b>*</b></label>
            <input id="recPTime" class="doc-in" type="time" value="${localDT(now).slice(11)}">

            <label class="doc-lab">DÉLAI TRAITEMENT PLANIFIÉ</label>
            <input id="recDelay" class="doc-in doc-ro" type="text" value="0:00" readonly>
            <label class="doc-lab">DURÉE ÉCOULÉE</label>
            <input id="recElapsed" class="doc-in doc-ro" type="text" value="0:00" readonly>
          </div>`;

      document.getElementById("docPop")?.remove();
      const p = document.createElement("div");
      p.id = "docPop";
      p.innerHTML = `
        <div class="doc-card" role="dialog" aria-modal="true">
          <div class="doc-head">
            <span class="doc-title"><span id="recRef">${esc(recRef)}</span></span>
            <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
          </div>
          <div class="doc-body">
            ${fieldsHTML}
            <div id="recErr" class="doc-err"></div>
          </div>
          <div class="doc-foot">
            <button type="button" class="doc-btn" data-cancel>ANNULER</button>
            <button type="button" class="doc-btn doc-save" id="recSave">ENREGISTRER</button>
          </div>
        </div>`;
      document.body.appendChild(p);
      popEnhance(p, kind);
      setTimeout(() => p.querySelector("#recText")?.focus(), 50);

      const close = () => { clearInterval(timer); p.remove(); };
      p.addEventListener("click", e => {
        if (e.target === p || e.target.closest("[data-cancel]")) close();
      });

      const $p = id => p.querySelector("#" + id);
      $p("recFlag")?.addEventListener("click", e => e.currentTarget.classList.toggle("on"));

      /* TAF : délai planifié = prévu − création ; durée écoulée = maintenant − création */
      const updTimes = () => {
        if (kind !== "taf") return;
        const c = new Date($p("recDate").value);
        const plan = new Date($p("recPDate").value + "T" + ($p("recPTime").value || "00:00"));
        $p("recDelay").value = hm(plan - c);
        $p("recElapsed").value = hm(Date.now() - c);
      };
      const timer = setInterval(updTimes, 30000);
      updTimes();
      ["recPDate", "recPTime"].forEach(id => $p(id)?.addEventListener("input", updTimes));

      $p("recDate").addEventListener("change", e => {
        const d = new Date(e.target.value);
        if (!isNaN(d)) {
          recRef = nextRecRef(kind, d);
          $p("recRef").textContent = recRef;
        }
        updTimes();
      });

      $p("recSave").addEventListener("click", () => {
        const req = kind === "obs"
          ? [["recDate", "date"], ["recText", "intitulé"]]
          : [["recDate", "date"], ["recText", "descriptif"], ["recResp", "responsable"],
             ["recPDate", "date prévue"], ["recPTime", "heure prévue"]];
        const miss = [];
        p.querySelectorAll(".doc-in, .dt-native").forEach(x => x.classList.remove("bad"));
        req.forEach(([id, lab]) => {
          if (!String($p(id).value).trim()) { miss.push(lab); $p(id).classList.add("bad"); }
        });
        if (miss.length) {
          $p("recErr").textContent = "Champs obligatoires manquants : " + miss.join(", ") + ".";
          return;
        }
        const dupR = findDup(recLoad(kind), r => r.text, $p("recText").value);
        if (dupR) {
          $p("recText").classList.add("bad");
          $p("recErr").textContent = (kind === "obs" ? "Cet intitulé" : "Ce descriptif") +
            " existe déjà (" + dupR.ref + ").";
          return;
        }
        const rec = kind === "obs"
          ? { ref: recRef, date: $p("recDate").value, text: $p("recText").value.trim(),
              important: $p("recFlag").classList.contains("on") }
          : { ref: recRef, date: $p("recDate").value, objet: $p("recObj").value.trim(),
              text: $p("recText").value.trim(), responsable: $p("recResp").value.trim(),
              prevu: $p("recPDate").value + "T" + $p("recPTime").value };
        const list = recLoad(kind);
        list.push(rec);
        recSave(kind, list);
        histLog(kind.toUpperCase(), "CRÉATION", rec.ref + " — " + (rec.text || "") +
          (rec.important ? " (IMPORTANTE)" : "") + (rec.responsable ? " — " + rec.responsable : ""));
        close();
        updPill(kind);
      });
    };

    /* agrandir un bloc : il occupe tout l'écran sous l'en-tête figé */
    const toggleMax = blk => {
      const page = shell.querySelector(".bdg-d-page");
      const cls = "max-" + blk;
      const on = !page.classList.contains(cls);
      page.classList.remove("max-client", "max-hier", "max-detail", "max-rec", "max-suivi");
      shell.querySelectorAll(".blk-rec").forEach(b =>
        b.classList.toggle("blk-rec-on", on && b.dataset.rec === blk));
      if (on && blk === "suivi") page.classList.add("max-rec");
      if (on) {
        const head = shell.querySelector(".bdg-d-sticky");
        const avail = window.innerHeight - (head ? head.offsetHeight : 0) - 40;
        page.style.setProperty("--avail", Math.max(260, avail) + "px");
        page.classList.add(cls);
        const top = page.getBoundingClientRect().top + window.scrollY -
          (head ? head.offsetHeight : 0);
        window.scrollTo(0, Math.max(0, top));
      }
      shell.querySelectorAll(".blk-max-btn").forEach(b =>
        b.classList.toggle("on", on && b.dataset.blk === blk)
      );
    };

    /* DÉTAIL PRODUITS : choix du format avant aperçu ou export */
    const chooseFormat = act => {
      document.getElementById("docPop")?.remove();
      const p = document.createElement("div");
      p.id = "docPop";
      p.innerHTML = `
        <div class="doc-card" role="dialog" aria-modal="true" style="max-width:520px">
          <div class="doc-head">
            <span class="doc-title">${act === "export" ? "EXPORTER" : "APERÇU"} — DÉTAIL PRODUITS</span>
            <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
          </div>
          <div class="doc-body">
            <div class="fmt-choice">
              <button type="button" class="doc-btn fmt-btn" data-fmt="metre">FORMAT MÉTRÉ</button>
              <button type="button" class="doc-btn fmt-btn" data-fmt="interne">FORMAT INTERNE</button>
            </div>
          </div>
          <div class="doc-foot"><button type="button" class="doc-btn" data-cancel>ANNULER</button></div>
        </div>`;
      document.body.appendChild(p);
      p.addEventListener("click", e => {
        const f = e.target.closest("[data-fmt]");
        if (f) {
          p.remove();
          const metre = f.dataset.fmt === "metre";
          if (act === "export") openExportMenu(metre ? "metre" : "interne");
          else if (metre) printMetre();
          else printTasks("prd");
          return;
        }
        if (e.target === p || e.target.closest("[data-cancel]")) p.remove();
      });
    };

    const runBlkAct = (blk, act) => {
      if (act === "max") return toggleMax(blk);
      if (blk === "detail" && active === "prd" && (act === "export" || act === "pdf")) return chooseFormat(act);
      const b = blk === "suivi" ? recActive : blk;
      if (act === "export") openExportMenu(b);
      else if (act === "import") { if (!(true)) openImportMenu(b); }
      else doPdf(b);
    };
    /* un seul bouton « ⋯ » par bloc : menu des actions */
    const openBlkMenu = btn => {
      const old = document.getElementById("blkMenu");
      const same = old && old.dataset.for === btn.dataset.for;
      old?.remove();
      if (same) return;
      const tools = btn.closest(".blk-tools");
      /* budget validé (ou figé) : lecture seule, pas d'import */
      const readOnly = true;
      const acts = [...tools.querySelectorAll(".blk-btn")].filter(a => !(readOnly && a.dataset.act === "import"));
      const m = document.createElement("div");
      m.id = "blkMenu";
      m.dataset.for = btn.dataset.for;
      m.innerHTML = acts.map((a, i) => {
        let lab = a.title;
        if (a.dataset.act === "max") lab = a.classList.contains("on") ? "Réduire" : "Agrandir";
        return `<button type="button" data-i="${i}">${a.innerHTML}<span>${esc(lab)}</span></button>`;
      }).join("");
      document.body.appendChild(m);
      const r = btn.getBoundingClientRect();
      m.style.top = r.bottom + 4 + "px";
      m.style.left = Math.max(8, r.right - m.offsetWidth) + "px";
      m.addEventListener("click", e => {
        const it = e.target.closest("[data-i]");
        if (!it) return;
        const a = acts[+it.dataset.i];
        m.remove();
        runBlkAct(a.dataset.blk, a.dataset.act);
      });
      setTimeout(() => document.addEventListener("click", function off(e) {
        if (!e.target.closest("#blkMenu")) { m.remove(); document.removeEventListener("click", off, true); }
      }, true), 0);
    };

    shell.onclick = event => {
      if (event.target.closest('[data-pill="doc"]')) {
        openDocForm();
        return;
      }
      if (event.target.closest("#obsAlertBtn, #refBang .obs-bang")) { openObsAlert(); return; }
      if (event.target.closest("#histBtn")) { openHistory(); return; }
      const ofl = event.target.closest("[data-obsflag]");
      if (ofl) {
        const list = recLoad("obs");
        const r = list[+ofl.dataset.obsflag];
        if (r) {
          r.important = !r.important;
          recSave("obs", list);
          histLog("OBS", r.important ? "ALERTE ACTIVÉE" : "ALERTE DÉSACTIVÉE", r.ref);
          updPill("obs");
        }
        return;
      }
      const dx = event.target.closest("[data-docexp]");
      if (dx) {
        event.preventDefault();
        const list = docsLoad();
        const r = list[+dx.dataset.docexp];
        if (r && !r.expired &&
            confirm("Marquer " + r.ref + " comme EXPIRÉ ?\nCe choix est définitif.")) {
          r.expired = true;
          r.expiredAt = localDT(new Date());
          docsSave(list);
          histLog("DOC", "EXPIRÉ", r.ref + " — " + (r.title || ""));
          updPill("doc");
        } else renderRec("doc");
        return;
      }
      if (event.target.closest(".blk-grip, .blk-rsz")) return;
      if (event.target.closest("#layResetBtn")) {
        if (confirm("Remettre tous les blocs à leur place et à leur taille d'origine ?")) {
          laySave({});
          histLog("DISPOSITION", "PAR DÉFAUT", "BLOCS REMIS À L'ORIGINE");
          layApply();
        }
        return;
      }
      if (event.target.closest('[data-pill="inf"]')) { openInfo(); return; }
      const ro = event.target.closest("[data-recopen]");
      if (ro) { openDoc(+ro.dataset.recopen); return; }
      const recPill = event.target.closest('[data-pill="obs"], [data-pill="taf"]');
      if (recPill) {
        openRecForm(recPill.dataset.pill);
        return;
      }

      const rt = event.target.closest("[data-rtab]");
      if (rt) {
        recActive = rt.dataset.rtab;
        try { localStorage.setItem("svi_rectab_v1", recActive); } catch (e) {}
        recTabApply();
        return;
      }
      const more = event.target.closest(".blk-more");
      if (more) {
        event.stopPropagation();
        openBlkMenu(more);
        return;
      }
      const bb = event.target.closest(".blk-btn");
      if (bb) {
        event.stopPropagation();
        runBlkAct(bb.dataset.blk, bb.dataset.act);
        return;
      }

      if (event.target.closest(".col-rs")) return;
      const cfb = event.target.closest(".cf-btn");
      if (cfb) {
        event.stopPropagation();
        cfOpenMenu(cfb);
        return;
      }

      const tab =
        event.target.closest("[data-tab]");

      if (tab) {
        active = tab.dataset.tab;
        try { localStorage.setItem("svi_dtab_v1", active); } catch (e) {}
        renderTab();
        return;
      }

      /* ligne de Détail charge / Détail produit : filtre tout l'écran
         sur sa désignation, son lot, sa primaire et sa secondaire
         (re-toucher la ligne retire ces filtres) */
      const why = event.target.closest("td[data-why]");
      if (why) {
        showWhy(why);
        return;
      }

      const toggle = (set, v) =>
        set.has(v) ? set.delete(v) : set.add(v);

      const lineRow = event.target.closest("tr[data-row]");

      if (lineRow && !event.target.closest("input")) {
        toggle(selRows, lineRow.dataset.row);
        refreshAll();
        return;
      }

      const h = event.target.closest("[data-h]");

      if (h) {
        toggle(hSel[h.dataset.h], h.dataset.v);
        refreshAll();
        return;
      }

      const dRow = event.target.closest("[data-desig]");

      if (dRow) {
        toggle(selDesig, dRow.dataset.desig);
        refreshAll();
      }
    };

    shell.onchange = event => {
      const ti = event.target.closest(".bdg-tva-input");
      if (ti) histLog(tabTitle(), "TVA MODIFIÉE", ti.dataset.line + " → " + ti.value);
    };

    shell.oninput = event => {
      const input =
        event.target.closest(".bdg-tva-input");

      if (input) {
        const gid = input.dataset.line;
        const members =
          (byKindNow()[active] || []).filter(l => l.gid === gid);

        if (members.length) {
          const v = num(String(input.value).replace("%", ""));
          members.forEach(l => {
            l.tva = v;
            l.price = l.priceTTC / (1 + v / 100);
            l.amount = l.ttcAmount / (1 + v / 100);
          });

          const cell = [...shell.querySelectorAll("[data-ttc]")]
            .find(c => c.dataset.ttc === gid);

          if (cell) {
            const a = members.reduce((t, l) => t + l.amount, 0);
            const v = members.reduce((t, l) => t + tvaFor(l), 0);
            cell.textContent = money(a + v);
          }

          const shownG = new Set(
            [...shell.querySelectorAll("tr[data-row]")].map(r => r.dataset.row)
          );
          const list = (byKindNow()[active] || []).filter(l => shownG.has(l.gid));

          const ht =
            list.reduce((t, l) => t + l.amount, 0);

          const tva =
            list.reduce((t, l) => t + tvaFor(l), 0);

          if ($("bdgFtTVA")) $("bdgFtTVA").textContent = money(tva);
          if ($("bdgFtTTC")) $("bdgFtTTC").textContent = money(ht + tva);

          renderClient();
        }

        return;
      }

      if (
        event.target.id === "bdgDelayStart" ||
        event.target.id === "bdgDelayEnd"
      ) {
        const a = $("bdgDelayStart").value;
        const b = $("bdgDelayEnd").value;

        if (a && b) {
          const days =
            Math.round(
              (new Date(b) - new Date(a)) /
              86400000
            );

          $("bdgDelayDays").textContent =
            days + " JOUR" + (Math.abs(days) > 1 ? "S" : "");
        } else {
          $("bdgDelayDays").textContent = "—";
        }
      }
    };

    /* ===== état mémorisé sur l'appareil, par budget ===== */
    const ST_KEY = "svi_bdgstate_v1:" + String(ref);

    const stateSave = () => {
      try {
        const cf = {};
        Object.entries(CF).forEach(([t, st]) => {
          const f = {};
          Object.entries(st.f).forEach(([k, set]) => { f[k] = [...set]; });
          cf[t] = { sort: st.sort, f };
        });
        localStorage.setItem(ST_KEY, JSON.stringify({
          cf,
          desig: [...selDesig],
          rows: [...selRows],
          h: { lot: [...hSel.lot], prim: [...hSel.prim], sec: [...hSel.sec] }
        }));
      } catch (e) {}
    };

    const stateLoad = () => {
      let st = null;
      try { st = JSON.parse(localStorage.getItem(ST_KEY) || "null"); }
      catch (e) { st = null; }

      if (!st) {
        /* première ouverture : Détail charge / produit par désignation
           (désignations client par article, lots / tâches par ordre BDS) */
        cfT("chg").sort = { col: "detail", dir: "asc", def: true };
        cfT("prd").sort = { col: "detail", dir: "asc", def: true };
        return;
      }

      Object.entries(st.cf || {}).forEach(([t, v]) => {
        const x = cfT(t);
        x.sort = v.sort || null;
        x.f = {};
        Object.entries(v.f || {}).forEach(([k, arr]) => { x.f[k] = new Set(arr); });
      });
      (st.desig || []).forEach(v => selDesig.add(v));
      (st.rows || []).forEach(v => selRows.add(v));
      ["lot", "prim", "sec"].forEach(k =>
        ((st.h || {})[k] || []).forEach(v => hSel[k].add(v))
      );
    };

    stateLoad();
    layInit();
    refreshAll();
    {
      const n = docsLoad().length;
      updPill("doc");
      updPill("obs");
      updPill("taf");
    }

    $("budgetBackBtn")
      ?.addEventListener(
        "click",
        () => {
          shell.onclick = null;
          shell.oninput = null;
          /* retour volontaire à la liste : elle sera l'écran d'ouverture */
          try { localStorage.removeItem("svi_lastbdg_v1"); } catch (e) {}
          shell.innerHTML = listHTML;
          renderBudgetList();
        }
      );
  }

  /* -------------------------------------------------------
     APERÇU / IMPRESSION
     ------------------------------------------------------- */

  table.onclick = event => {

    /* « ! » : lire l'alerte sans ouvrir le détail du budget */
    const bang = event.target.closest(".obs-bang");
    if (bang) {
      event.preventDefault();
      event.stopPropagation();
      const r = bang.closest("tr[data-budget-ref]")?.dataset.budgetRef;
      openObsAlertFor(r, bdgGroups.get(r)?.project);
      return;
    }

    const projectLink =
      event.target.closest(
        "[data-open-project]"
      );

    if (projectLink) {
      event.preventDefault();

      openProjectPopup(
        projectLink.dataset
          .openProject
      );

      return;
    }

    const printButton =
      event.target.closest(
        "[data-print-budget]"
      );

    if (printButton) {
      event.preventDefault();
      /* même aperçu que DÉSIGNATIONS CLIENT (options, code, enregistrement) :
         le budget est ouvert puis son aperçu lancé dans le même geste */
      window.__sviPrintClient = null;
      openBudgetDetail(printButton.dataset.printBudget);
      if (window.__sviPrintClient) window.__sviPrintClient();
      else printBudgetPDF(printButton.dataset.printBudget);
      return;
    }

    const row =
      event.target.closest(
        "tr[data-budget-ref]"
      );

    if (row) {
      openBudgetDetail(
        row.dataset.budgetRef
      );
    }
  };

  /* -------------------------------------------------------
     PREMIER AFFICHAGE
     ------------------------------------------------------- */

  renderRows();

  /* réouverture du dernier budget consulté */
  try {
    const last = localStorage.getItem("svi_lastbdg_v1");
    if (last && groups.has(last)) openBudgetDetail(last);
  } catch (e) {}
}

function budgetTotals(group) {
  const ht =
    group.rows.reduce(
      (total, row) =>
        total +
        num(
          firstValue(
            row,
            ["MNB", "MONTANT HT", "MPB HT", "MPB"]
          )
        ),
      0
    );

  const tva =
    num(
      firstValue(
        group.first,
        ["TVA", "TAUX TVA"]
      )
    );

  const tvaAmount =
    tva
      ? ht * tva / (tva > 1 ? 100 : 1)
      : 0;

  return { ht, tvaAmount, ttc: ht + tvaAmount };
}

function printBudgetPDF(ref) {
  const group = bdgGroups.get(ref);

  if (!group || !group.rows.length) {
    alert("Budget introuvable.");
    return;
  }

  const totals = budgetTotals(group);

  const lines = group.rows.map((row, index) => {
    const type =
      firstValue(row, ["CHG/PRD", "TYPE"]);

    const detail =
      firstValue(
        row,
        ["DETAIL BUDGET", "DESIGNATION", "DÉSIGNATION"]
      );

    const unit =
      firstValue(row, ["UTB", "UNITE", "UNITÉ"]);

    const qty =
      firstValue(
        row,
        ["QTB", "QUANTITE", "QUANTITÉ", "NBR"]
      );

    const price =
      firstValue(row, ["PUB", "PRIX", "PU"]);

    const amount =
      firstValue(row, ["MNB", "MONTANT", "MPB"]);

    return `
      <tr>
        <td>${index + 1}</td>
        <td>${esc(type)}</td>
        <td>${esc(detail)}</td>
        <td>${esc(unit)}</td>
        <td class="n">${esc(qty)}</td>
        <td class="n">${money(price)}</td>
        <td class="n">${money(amount)}</td>
      </tr>
    `;
  }).join("");

  const printWindow =
    window.open("", "_blank");

  if (!printWindow) {
    alert("Impossible d'ouvrir le document. Autorisez les fenêtres pop-up.");
    return;
  }

  printWindow.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${esc(ref)} - ${esc(group.project)}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #555; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #bbb; padding: 5px 6px; text-align: left; }
  th { background: #eee; }
  .n { text-align: right; white-space: nowrap; }
  tfoot td { font-weight: bold; background: #f6f6f6; }
  @media print { body { margin: 10mm; } }
</style>
</head>
<body>
  <h1>${esc(ref)}</h1>
  <div class="sub">Projet : ${esc(group.project)}</div>
  <table>
    <thead>
      <tr>
        <th>N°</th><th>TYPE</th><th>DÉTAIL BUDGET</th>
        <th>UNITÉ</th><th class="n">QUANTITÉ</th>
        <th class="n">PRIX</th><th class="n">MONTANT</th>
      </tr>
    </thead>
    <tbody>${lines}</tbody>
    <tfoot>
      <tr><td colspan="6">TOTAL HT</td><td class="n">${money(totals.ht)}</td></tr>
      <tr><td colspan="6">TVA</td><td class="n">${money(totals.tvaAmount)}</td></tr>
      <tr><td colspan="6">TOTAL TTC</td><td class="n">${money(totals.ttc)}</td></tr>
    </tfoot>
  </table>
</body>
</html>`);

  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    try { printWindow.print(); } catch (_) {}
  }, 400);
}

function openProjectPopup(ref) {
  const group = bdgGroups.get(ref);

  if (!group) return;

  const known =
    db.projects.find(
      p =>
        normalise(p.code) ===
        normalise(group.project)
    );

  const intitule =
    normalise(known?.name) ||
    "À COMPLÉTER";

  const old = $("bdgProjectPopup");
  if (old) old.remove();

  const back = document.createElement("div");
  back.id = "bdgProjectPopup";
  back.className = "bdg-popup-back";

  back.innerHTML = `
    <div class="bdg-popup">
      <div class="bdg-popup-head">
        <span>FICHE PROJET</span>
        <button type="button" class="bdg-popup-close" aria-label="Fermer">✕</button>
      </div>
      <div class="bdg-popup-body">
        <div class="bdg-popup-field">
          <label>RÉFÉRENCE</label>
          <div>${esc(ref)}</div>
        </div>
        <div class="bdg-popup-field">
          <label>PROJET (ABRÉVIATION)</label>
          <div>${esc(group.project)}</div>
        </div>
        <div class="bdg-popup-field">
          <label>INTITULÉ</label>
          <div>${esc(intitule)}</div>
        </div>
        <div class="bdg-popup-field">
          <label>CLIENT</label>
          <div>À COMPLÉTER</div>
        </div>
        <div class="bdg-popup-note">
          Fiche provisoire : les champs seront modifiables dans le futur module Projets.
        </div>
      </div>
    </div>
  `;

  back.addEventListener("click", e => {
    if (
      e.target === back ||
      e.target.closest(".bdg-popup-close")
    ) {
      back.remove();
    }
  });

  document.body.appendChild(back);
}

/* =========================================================
   BDG — SELECTEURS
   ========================================================= */

function fillSelect(
  select,
  values,
  selectedValue = ""
) {
  if (!select) {
    return;
  }

  select.innerHTML = "";

  if (!values.length) {
    const option =
      document.createElement(
        "option"
      );

    option.value = "";
    option.textContent =
      "AUCUN ÉLÉMENT";

    select.appendChild(
      option
    );

    return;
  }

  values.forEach(value => {
    const option =
      document.createElement(
        "option"
      );

    option.value = value;
    option.textContent = value;

    if (
      value === selectedValue
    ) {
      option.selected = true;
    }

    select.appendChild(
      option
    );
  });
}

function initialiseBDGSelectors() {
  const projects =
    unique(
      bdgRows.map(
        r => r["PRJ"]
      )
    );

  fillSelect(
    $("project"),
    projects
  );

  if (
    projects.includes("H88")
  ) {
    $("project").value =
      "H88";
  }

  updateBDGLots();
}

function updateBDGLots() {
  const project =
    $("project")?.value || "";

  const lots =
    unique(
      bdgRows
        .filter(
          r =>
            normalise(
              r["PRJ"]
            ) ===
            normalise(
              project
            )
        )
        .map(
          r => r["LOT"]
        )
    );

  fillSelect(
    $("lot"),
    lots
  );

  updateBDGPrimaryActivities();
}

function updateBDGPrimaryActivities() {
  const project =
    $("project")?.value || "";

  const lot =
    $("lot")?.value || "";

  const values =
    unique(
      bdgRows
        .filter(
          r =>
            normalise(
              r["PRJ"]
            ) ===
              normalise(
                project
              ) &&
            normalise(
              r["LOT"]
            ) ===
              normalise(
                lot
              )
        )
        .map(
          r =>
            r[
              "ACTIVITE PRIMAIRE"
            ]
        )
    );

  fillSelect(
    $("primary"),
    values
  );

  updateBDGSecondaryActivities();
}

function updateBDGSecondaryActivities() {
  const project =
    $("project")?.value || "";

  const lot =
    $("lot")?.value || "";

  const primary =
    $("primary")?.value || "";

  const values =
    unique(
      bdgRows
        .filter(
          r =>
            normalise(
              r["PRJ"]
            ) ===
              normalise(
                project
              ) &&
            normalise(
              r["LOT"]
            ) ===
              normalise(
                lot
              ) &&
            normalise(
              r[
                "ACTIVITE PRIMAIRE"
              ]
            ) ===
              normalise(
                primary
              )
        )
        .map(
          r =>
            r["ACTIVITE"]
        )
    );

  fillSelect(
    $("secondary"),
    values
  );

  refreshBudget();
}

/* =========================================================
   BDG — FILTRE TACHE
   ========================================================= */

function selectedBDGRows() {
  const project =
    $("project")?.value || "";

  const lot =
    $("lot")?.value || "";

  const primary =
    $("primary")?.value || "";

  const secondary =
    $("secondary")?.value || "";

  return bdgRows.filter(
    r =>
      normalise(
        r["PRJ"]
      ) === normalise(project) &&

      normalise(
        r["LOT"]
      ) === normalise(lot) &&

      normalise(
        r["ACTIVITE PRIMAIRE"]
      ) === normalise(primary) &&

      normalise(
        r["ACTIVITE"]
      ) === normalise(secondary)
  );
}

/* =========================================================
   BDG — RAFRAICHISSEMENT
   ========================================================= */

function refreshBudget() {
  const rows =
    selectedBDGRows();

  updateBDGDesignation(rows);
  renderProductTable(rows);
  renderChargeTable(rows);
  renderAnalysis(rows);
}

function updateBDGDesignation(rows) {
  const field =
    $("brdDesignation");

  if (!field) {
    return;
  }

  const designations =
    unique(
      rows.map(
        r => r["DESIGNATION"]
      )
    );

  field.value =
    designations.join(" / ");
}

/* =========================================================
   BDG — PRODUITS
   ========================================================= */

function renderProductTable(rows) {
  const table =
    $("productTable");

  if (!table) {
    return;
  }

  const products =
    rows.filter(
      r =>
        normalise(
          r["CHG/PRD"]
        ).toUpperCase() === "PRD"
    );

  table.innerHTML = `
    <thead>
      <tr>
        <th>N°</th>
        <th>DÉSIGNATION</th>
        <th>UPB</th>
        <th>NBR</th>
        <th>DIM 1</th>
        <th>DIM 2</th>
        <th>DIM 3</th>
        <th class="number">QPB PRT</th>
        <th class="number">PPB</th>
        <th class="number">MPB</th>
      </tr>
    </thead>

    <tbody>
      ${
        products.length
          ? products.map(
              r => `
                <tr>
                  <td>
                    ${esc(r["N°"])}
                  </td>

                  <td>
                    ${esc(
                      r["DETAIL BUDGET"]
                    )}
                  </td>

                  <td class="yellow">
                    ${esc(r["UTB"])}
                  </td>

                  <td class="number">
                    ${esc(r["NBR"])}
                  </td>

                  <td class="number">
                    ${esc(r["DIM1"])}
                  </td>

                  <td class="number">
                    ${esc(r["DIM2"])}
                  </td>

                  <td class="number">
                    ${esc(r["DIM3"])}
                  </td>

                  <td class="number yellow">
                    ${money(r["QTB"])}
                  </td>

                  <td class="number yellow">
                    ${money(r["PUB"])}
                  </td>

                  <td class="number yellow">
                    ${money(r["MNB"])}
                  </td>
                </tr>
              `
            ).join("")
          : `
            <tr>
              <td
                colspan="10"
                class="empty"
              >
                AUCUN PRODUIT
              </td>
            </tr>
          `
      }
    </tbody>

    <tfoot>
      <tr>
        <td colspan="7">
          <strong>TOTAL</strong>
        </td>

        <td class="number yellow">
          ${money(
            sum(products, "QTB")
          )}
        </td>

        <td></td>

        <td class="number yellow">
          ${money(
            sum(products, "MNB")
          )}
        </td>
      </tr>
    </tfoot>
  `;
}

/* =========================================================
   BDG — CHARGES
   ========================================================= */

function renderChargeTable(rows) {
  const table =
    $("chargeTable");

  if (!table) {
    return;
  }

  const charges =
    rows.filter(
      r =>
        normalise(
          r["CHG/PRD"]
        ).toUpperCase() === "CHG"
    );

  table.innerHTML = `
    <thead>
      <tr>
        <th>N°</th>
        <th>ARTICLE</th>
        <th>DÉSIGNATION</th>
        <th>UCB</th>
        <th class="number">QCB</th>
        <th class="number">PCS</th>
        <th class="number">MCB</th>
      </tr>
    </thead>

    <tbody>
      ${
        charges.length
          ? charges.map(
              r => `
                <tr>
                  <td>
                    ${esc(r["N°"])}
                  </td>

                  <td>
                    ${esc(
                      r["DESIGNATION"]
                    )}
                  </td>

                  <td>
                    ${esc(
                      r["DETAIL BUDGET"]
                    )}
                  </td>

                  <td>
                    ${esc(r["UTB"])}
                  </td>

                  <td class="number">
                    ${money(r["QTB"])}
                  </td>

                  <td class="number yellow">
                    ${money(r["PUB"])}
                  </td>

                  <td class="number yellow">
                    ${money(r["MNB"])}
                  </td>
                </tr>
              `
            ).join("")
          : `
            <tr>
              <td
                colspan="7"
                class="empty"
              >
                AUCUNE CHARGE
              </td>
            </tr>
          `
      }
    </tbody>

    <tfoot>
      <tr>
        <td colspan="6">
          <strong>TOTAL</strong>
        </td>

        <td class="number yellow">
          ${money(
            sum(charges, "MNB")
          )}
        </td>
      </tr>
    </tfoot>
  `;
}

/* =========================================================
   BDG — ANALYSE
   ========================================================= */

function renderAnalysis(rows) {
  const box =
    $("analysisCompact");

  if (!box) {
    return;
  }

  const products =
    rows.filter(
      r =>
        normalise(
          r["CHG/PRD"]
        ).toUpperCase() === "PRD"
    );

  const charges =
    rows.filter(
      r =>
        normalise(
          r["CHG/PRD"]
        ).toUpperCase() === "CHG"
    );

  const productAmount =
    sum(products, "MNB");

  const chargeAmount =
    sum(charges, "MNB");

  const margin =
    productAmount -
    chargeAmount;

  const rate =
    productAmount
      ? (
          margin /
          productAmount
        ) * 100
      : 0;

  if (
    currentAnalysis === "yield"
  ) {
    box.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>ACTIVITÉ</th>
            <th class="number">PRODUIT</th>
            <th class="number">CHARGE</th>
            <th class="number">RENDEMENT</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>
              ${
                esc(
                  $("secondary")
                    ?.value || ""
                )
              }
            </td>

            <td class="number">
              ${money(productAmount)}
            </td>

            <td class="number">
              ${money(chargeAmount)}
            </td>

            <td class="number">
              ${money(rate)} %
            </td>
          </tr>
        </tbody>
      </table>
    `;

    return;
  }

  box.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>
            ${
              currentAnalysis ===
              "primaryMargin"
                ? "ACTIVITÉ PRIMAIRE"
                : "DÉSIGNATION"
            }
          </th>

          <th class="number">
            PRODUITS
          </th>

          <th class="number">
            CHARGES
          </th>

          <th class="number">
            MARGE
          </th>

          <th class="number">
            TAUX
          </th>
        </tr>
      </thead>

      <tbody>
        <tr>
          <td>
            ${
              currentAnalysis ===
              "primaryMargin"
                ? esc(
                    $("primary")
                      ?.value || ""
                  )
                : esc(
                    $("brdDesignation")
                      ?.value || ""
                  )
            }
          </td>

          <td class="number">
            ${money(productAmount)}
          </td>

          <td class="number">
            ${money(chargeAmount)}
          </td>

          <td class="number">
            ${money(margin)}
          </td>

          <td class="number">
            ${money(rate)} %
          </td>
        </tr>
      </tbody>

      <tfoot>
        <tr>
          <td>
            <strong>TOTAL</strong>
          </td>

          <td class="number">
            ${money(productAmount)}
          </td>

          <td class="number">
            ${money(chargeAmount)}
          </td>

          <td class="number">
            ${money(margin)}
          </td>

          <td class="number">
            ${money(rate)} %
          </td>
        </tr>
      </tfoot>
    </table>
  `;
}

/* =========================================================
   FORMULAIRES CHS / BDS
   ========================================================= */

function f(
  name,
  label,
  value = "",
  type = "text",
  full = false
) {
  return {
    name,
    label,
    value,
    type,
    full
  };
}

function openForm(
  title,
  fields,
  onSave
) {
  $("modalTitle").textContent =
    title;

  $("modalForm").innerHTML =
    fields.map(
      x => `
        <div
          class="field ${
            x.full ? "full" : ""
          }"
        >
          <label>
            ${esc(x.label)}
          </label>

          <input
            name="${esc(x.name)}"
            type="${esc(x.type)}"
            value="${esc(x.value)}"
            ${
              x.type === "number"
                ? 'step="any" inputmode="decimal"'
                : ""
            }
            required
          >
        </div>
      `
    ).join("") +
    `
      <div class="form-actions">

        <button
          type="button"
          class="secondary"
          id="cancelForm"
        >
          ANNULER
        </button>

        <button
          class="primary"
          type="submit"
        >
          ENREGISTRER
        </button>

      </div>
    `;

  $("modal")
    .classList.remove(
      "hidden"
    );

  $("cancelForm").onclick =
    closeModal;

  $("modalForm").onsubmit =
    async e => {

      e.preventDefault();

      const btn =
        e.currentTarget
          .querySelector(
            'button[type="submit"]'
          );

      btn.disabled = true;
      btn.textContent =
        "ENREGISTREMENT...";

      try {
        await onSave(
          Object.fromEntries(
            new FormData(
              e.currentTarget
            ).entries()
          )
        );

        closeModal();

      } catch (err) {
        alert(
          err.message ||
          String(err)
        );

        btn.disabled = false;
        btn.textContent =
          "ENREGISTRER";
      }
    };
}

function closeModal() {
  $("modal")
    .classList.add(
      "hidden"
    );
}

/* =========================================================
   APPUI LONG CHS / BDS
   ========================================================= */

function bindLongPress(
  el,
  ctx
) {
  const start = e => {
    clearTimeout(
      longPressTimer
    );

    longPressTimer =
      setTimeout(
        () =>
          showRowMenu(
            e,
            ctx
          ),
        550
      );
  };

  const stop =
    () =>
      clearTimeout(
        longPressTimer
      );

  el.addEventListener(
    "pointerdown",
    start
  );

  el.addEventListener(
    "pointerup",
    stop
  );

  el.addEventListener(
    "pointerleave",
    stop
  );

  el.addEventListener(
    "pointercancel",
    stop
  );

  el.addEventListener(
    "contextmenu",
    e => {
      e.preventDefault();

      showRowMenu(
        e,
        ctx
      );
    }
  );
}

function bindRows() {
  document
    .querySelectorAll(
      "tr.data-row"
    )
    .forEach(el => {

      bindLongPress(
        el,
        {
          type:
            el.dataset.type,
          id:
            el.dataset.id
        }
      );
    });
}

function showRowMenu(
  e,
  ctx
) {
  rowContext = ctx;

  const menu =
    $("rowMenu");

  menu.style.left =
    Math.min(
      e.clientX || 20,
      window.innerWidth - 200
    ) + "px";

  menu.style.top =
    Math.min(
      e.clientY || 20,
      window.innerHeight - 190
    ) + "px";

  menu.classList.remove(
    "hidden"
  );
}

function rowItem(ctx) {
  if (
    ctx.type === "chs"
  ) {
    return db.chs.find(
      x => x.id === ctx.id
    );
  }

  if (
    ctx.type === "brd"
  ) {
    return db.brd.find(
      x => x.id === ctx.id
    );
  }

  return getBy(
    ctx.type,
    ctx.id
  );
}

async function deleteRow(ctx) {
  if (
    ctx.type === "chs"
  ) {
    await apiPost(
      "deleteCHS",
      { id: ctx.id }
    );

    db.chs =
      db.chs.filter(
        x =>
          x.id !== ctx.id
      );

    renderChs();

    return;
  }

  if (
    ctx.type === "brd"
  ) {
    await apiPost(
      "deleteBRD",
      { id: ctx.id }
    );

    db.brd =
      db.brd.filter(
        x =>
          x.id !== ctx.id
      );

    if (
      selection.secondary
    ) {
      brdCache.set(
        selection.secondary,
        [...db.brd]
      );
    }

    renderBrd();

    return;
  }

  await apiPost(
    "deleteBDS",
    { id: ctx.id }
  );

  removeLocalBDS(
    ctx.type,
    ctx.id
  );

  renderHierarchy();
}

function infoRow(ctx) {
  const x =
    rowItem(ctx);

  if (!x) {
    return;
  }

  const lines =
    Object.entries(x)
      .filter(
        ([k]) =>
          k !== "id" &&
          !k.endsWith("Id")
      )
      .map(
        ([k, v]) =>
          `${k.toUpperCase()} : ${v}`
      )
      .join("\n");

  alert(lines);
}

/* =========================================================
   DEMARRAGE
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    initNav();

    $("chsSearch")
      ?.addEventListener(
        "input",
        renderChs
      );

    $("brdSearch")
      ?.addEventListener(
        "input",
        renderBrd
      );

    if ($("addChsBtn")) {
      $("addChsBtn").onclick =
        () => chsForm();
    }

    if ($("addBrdBtn")) {
      $("addBrdBtn").onclick =
        () => brdForm();
    }

    if ($("modalClose")) {
      $("modalClose").onclick =
        closeModal;
    }

    $("modal")
      ?.addEventListener(
        "click",
        e => {
          if (
            e.target ===
            $("modal")
          ) {
            closeModal();
          }
        }
      );

    document.addEventListener(
      "click",
      e => {
        if (
          !e.target.closest(
            "#rowMenu"
          )
        ) {
          $("rowMenu")
            ?.classList.add(
              "hidden"
            );
        }
      }
    );

    document
      .querySelectorAll(
        "[data-add]"
      )
      .forEach(
        b => {
          b.onclick =
            () =>
              addHierarchy(
                b.dataset.add
              );
        }
      );

    document
      .querySelectorAll(
        "[data-search]"
      )
      .forEach(
        i => {
          i.addEventListener(
            "input",
            renderHierarchy
          );
        }
      );

    /* ---------------- BDG SELECTEURS ---------------- */

    $("project")
      ?.addEventListener(
        "change",
        updateBDGLots
      );

    $("lot")
      ?.addEventListener(
        "change",
        updateBDGPrimaryActivities
      );

    $("primary")
      ?.addEventListener(
        "change",
        updateBDGSecondaryActivities
      );

    $("secondary")
      ?.addEventListener(
        "change",
        refreshBudget
      );

    /* ---------------- BDG ONGLETS ---------------- */

    document
      .querySelectorAll(
        ".bdg-tabs .tab"
      )
      .forEach(tab => {

        tab.addEventListener(
          "click",
          () => {

            document
              .querySelectorAll(
                ".bdg-tabs .tab"
              )
              .forEach(
                t =>
                  t.classList.remove(
                    "active"
                  )
              );

            tab.classList.add(
              "active"
            );

            currentAnalysis =
              tab.dataset.tab ||
              "designation";

            renderAnalysis(
              selectedBDGRows()
            );
          }
        );
      });

    /* ---------------- MENU CONTEXTUEL ---------------- */

    $("rowMenu")
      ?.addEventListener(
        "click",
        async e => {

          const action =
            e.target.dataset.action;

          if (
            !action ||
            !rowContext
          ) {
            return;
          }

          const item =
            rowItem(
              rowContext
            );

          $("rowMenu")
            .classList.add(
              "hidden"
            );

          try {
            if (
              action === "info"
            ) {
              infoRow(
                rowContext
              );
            }

            if (
              action === "delete" &&
              confirm(
                "CONFIRMER LA SUPPRESSION ?"
              )
            ) {
              await deleteRow(
                rowContext
              );
            }

            if (
              action === "edit"
            ) {
              if (
                rowContext.type === "chs"
              ) {
                chsForm(item);

              } else if (
                rowContext.type === "brd"
              ) {
                brdForm(item);

              } else {
                addHierarchy(
                  rowContext.type,
                  item
                );
              }
            }

            if (
              action === "duplicate"
            ) {
              if (
                rowContext.type === "chs"
              ) {
                chsForm(
                  item,
                  true
                );

              } else if (
                rowContext.type === "brd"
              ) {
                brdForm(
                  item,
                  true
                );

              } else {
                addHierarchy(
                  rowContext.type,
                  item,
                  true
                );
              }
            }

          } catch (err) {
            alert(
              err.message ||
              String(err)
            );
          }
        }
      );

    await reloadAll();

    /* retour au dernier module ouvert (CHS, BDS, BDG…) */
    try {
      const v = localStorage.getItem("svi_view_v1");
      const b = v && document.querySelector(`.nav-btn[data-view="${v}"]`);
      if (b && !b.classList.contains("active")) b.click();
    } catch (e) {}
  }
);



document.addEventListener("click", e => {
  const menu = $("navMenu");
  if (!menu) return;
  const opener = e.target.closest(".open-menu");
  if (opener) {
    const r = opener.getBoundingClientRect();
    menu.style.left = r.left + "px";
    menu.style.top = (r.bottom + 6) + "px";
    menu.classList.toggle("hidden");
    return;
  }
  menu.classList.add("hidden");
});




function budgetDate(ref) {
  const m = String(ref).match(/(\d{2})-(\d{2})(\d{2})\s*\/\s*\d+/);

  if (!m) return null;

  return {
    key: "20" + m[1] + "-" + m[2] + "-" + m[3],
    label: m[3] + "/" + m[2] + "/20" + m[1]
  };
}
