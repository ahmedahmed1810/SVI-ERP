/* ⟪ src/00-socle.js ⟫ */
const API_URL = "https://script.google.com/macros/s/AKfycbzFgUloyiRJe-QmR7nRqJ4bfWqvfA_6LSgotJRrRt87yeRfWtdY7nxXMR9avafSJUPg4Q/exec";
/* v634 : étapes de l'ouverture d'un budget (diagnostic d'un blocage, lues au démarrage suivant) */
const sviStep = s => { try {
  localStorage.setItem("svi_step_v1", s);
  /* v635 : 40 dernières étapes, avec l'heure (diagnostic d'ouverture bloquée) */
  let L = []; try { L = JSON.parse(localStorage.getItem("svi_steps_v1") || "[]") || []; } catch (e) {}
  L.push(new Date().toISOString().slice(11, 23) + " " + s); localStorage.setItem("svi_steps_v1", JSON.stringify(L.slice(-40)));
} catch (e) {} };
const API_KEY = "nZYYROPFeFXBims8v4NCPcbXG8Nl";

/* v513 : clavier d'une case — une case seulement SÉLECTIONNÉE (1er toucher) porte inputmode="none" pour que le clavier de l'iPad
   ne s'ouvre pas ; son clavier d'origine (decimal, numeric…) est gardé dans data-sv-im et c'est lui qu'on lit partout */
function sviIm(el) {
  if (!el) return null;
  return el.dataset && el.dataset.svIm !== undefined ? (el.dataset.svIm || null) : el.getAttribute("inputmode");
}

/* =========================================================
   MISE À JOUR AUTOMATIQUE : Safari garde parfois l'ancienne page.
   À l'ouverture (et au retour sur l'onglet), la page publiée est relue
   sans cache ; si elle annonce une version plus récente, un bouton
   « NOUVELLE VERSION — ACTUALISER » apparaît (pas de rechargement automatique).
   ========================================================= */
(() => {
  const cur = (() => {
    const s = [...document.scripts].find(x => /app\.js\?v=\d+/.test(x.src || ""));
    return s ? Number(s.src.match(/app\.js\?v=(\d+)/)[1]) : 0;
  })();
  if (!cur) return;
  const check = () => {
    fetch(location.pathname + "?_=" + Date.now(), { cache: "no-store" })
      .then(r => r.text())
      .then(t => {
        const m = t.match(/app\.js\?v=(\d+)/);
        const v = m ? Number(m[1]) : 0;
        /* nouvelle version publiée : pas de rechargement automatique,
           un bouton en haut de l'écran ; la page se recharge seulement quand on le touche */
        if (v > cur) {
          let b = document.getElementById("sviUpd");
          if (!b) {
            b = document.createElement("button");
            b.type = "button";
            b.id = "sviUpd";
            b.style.cssText = "position:fixed;top:62px;left:50%;transform:translateX(-50%);z-index:100002;" +
              "border:1px solid #172033;background:#fff;color:#172033;border-radius:999px;padding:8px 18px;" +
              "font:800 12px -apple-system,Helvetica,Arial,sans-serif;letter-spacing:.3px;box-shadow:0 6px 18px rgba(15,23,42,.18);cursor:pointer";
            document.body.appendChild(b);
          }
          b.textContent = "NOUVELLE VERSION — ACTUALISER";
          b.onclick = () => location.replace(location.pathname + "?v=" + v + location.hash);
        }
      }).catch(() => {});
  };
  check();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  /* aussi pendant le travail (budget en instance ouvert…) : relue chaque minute */
  setInterval(() => { if (!document.hidden && !document.getElementById("sviUpd")) check(); }, 60000);
})();

const SVI_COPY_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
const SVI_CUT_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="17" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="17" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.2 15 18 3M15.8 15 6 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const SVI_PASTE_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 4V2.8h6V4M9 10h6M9 14h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const SVI_DEL_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* ESPACES (FORMAT) : à toute saisie, espaces de début et de fin effacés, un seul espace entre les mots */
const sviClean = v => String(v ?? "").replace(/\s+/g, " ").trim();
document.addEventListener("change", e => {
  const t = e.target;
  if (!t || !(t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && /^(text|search|url|email|tel|)$/i.test(t.type || "")))) return;
  if (t.tagName === "TEXTAREA") { const c = t.value.split("\n").map(x => x.replace(/[ \t]+/g, " ").trim()).join("\n").trim(); if (c !== t.value) { t.value = c; t.dispatchEvent(new Event("input", { bubbles: true })); } return; }
  const c = sviClean(t.value);
  if (c !== t.value) { t.value = c; t.dispatchEvent(new Event("input", { bubbles: true })); }
}, true);

/* =========================================================
   CHARGEMENT EN COURS : tout échange avec Google (script, feuilles)
   affiche une fenêtre centrale et bloque l'écran jusqu'à la réponse.
   Apparaît après 0,3 s (pas de clignotement) ; bouton FERMER après 30 s.
   ========================================================= */
(() => {
  const nativeFetch = window.fetch.bind(window);
  let busy = 0, showT = null, slowT = null;
  const el = () => {
    let d = document.getElementById("sviLoad");
    if (d) return d;
    d = document.createElement("div");
    d.id = "sviLoad";
    d.innerHTML = `<div class="ld-card" role="status" aria-live="polite">
        <div class="ld-spin"></div>
        <div class="ld-t">TÉLÉCHARGEMENT DES DONNÉES…</div>
        <div class="ld-bar"><i></i></div>
        <div class="ld-s">MERCI DE PATIENTER</div>
        <button type="button" class="ld-x" hidden>FERMER</button>
      </div>`;
    d.addEventListener("click", e => {
      if (e.target.closest(".ld-x")) d.classList.remove("on");
    });
    document.body.appendChild(d);
    return d;
  };
  const start = () => {
    if (busy++ > 0) return;
    clearTimeout(showT); clearTimeout(slowT);
    showT = setTimeout(() => {
      const d = el();
      d.querySelector(".ld-x").hidden = true;
      d.classList.add("on");
    }, 300);
    slowT = setTimeout(() => { const d = el(); d.querySelector(".ld-x").hidden = false; }, 30000);
  };
  const stop = () => {
    busy = Math.max(0, busy - 1);
    if (busy) return;
    clearTimeout(showT); clearTimeout(slowT);
    document.getElementById("sviLoad")?.classList.remove("on");
  };
  window.fetch = (input, init) => {
    const url = String((input && input.url) || input || "");
    if (!/script\.google(usercontent)?\.com|docs\.google\.com/.test(url)) return nativeFetch(input, init);
    /* v677 : échanges en arrière-plan (enregistrement dans la base, verrous) : jamais de fenêtre ni de blocage */
    if (init && init.sviQuiet) return nativeFetch(input, init);
    start();
    return nativeFetch(input, init).then(r => {
      /* le corps est lu ensuite : on attend sa lecture complète */
      const c = r.clone();
      c.text().then(stop, stop);
      return r;
    }, e => { stop(); throw e; });
  };
})();

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
  const p = sviPopNew();
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
  sviPopShow(p);
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
    dly: w('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>'),
    xpl: w('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    ver: w('<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8.5 7l1.5-3h4l1.5 3"/>'),
    rcl: w('<path d="M4 12a8 8 0 0 1 13.7-5.6M20 12a8 8 0 0 1-13.7 5.6"/><path d="M18 3v4h-4M6 21v-4h4"/>'),
    scn: w('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 7v10M18 11c0 4-6 3-12 6"/>')
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
/* format unique des dates : JJ/MM/AAAA À HH:MM (JJ/MM/AAAA si la date n'a pas d'heure) */
const svDT = v => {
  if (v === undefined || v === null || v === "") return "";
  const p2 = n => String(n).padStart(2, "0");
  if (typeof v === "string") {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
    if (m) return m[3] + "/" + m[2] + "/" + m[1] + (m[4] ? " À " + m[4] + ":" + m[5] : "");
  }
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d)) return String(v);
  return p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + d.getFullYear() + " À " + p2(d.getHours()) + ":" + p2(d.getMinutes());
};
/* QPB d'un produit = NBR × DIM 1 × DIM 2 × DIM 3 (cases remplies) */
/* cases à saisir selon l'unité : U / F → NBR ; M / ML → + DIM 1 ; M2 → + DIM 1 et 2 ; M3 → + DIM 1 à 3 ;
   une autre unité (permise) laisse toutes les cases ouvertes */
const sviUnitDims = u => { const m = { U: 0, F: 0, M: 1, ML: 1, M2: 2, M3: 3 }[String(u || "").trim().toUpperCase()]; return m === undefined ? 3 : m; };
/* nombre valide (1 234,56 ; 1234.56 ; -3) */
const sviNumOk = v => { const t = String(v ?? "").replace(/[\s\u00a0\u202f]/g, ""); return t === "" || /^[-+]?\d*([.,]\d*)?$/.test(t) && /\d/.test(t); };
/* ===== CALENDRIER DU BUDGET (15/10/2026) : jours non travaillés récurrents (0 = dimanche … 6 = samedi),
   dates non travaillées (off) et dates rendues travaillées (on). Par défaut : le dimanche. ===== */
const SVI_CAL_DEF = { we: [0], off: [], on: [] };
const sviCalOf = d => {
  /* B38 (série B) : un budget sans calendrier propre reprend les jours non travaillés de la société (PARAMÉTRAGE GÉNÉRAL › CALENDRIER) */
  const c = (d && d.cal) || { off: typeof sviPgOffDays === "function" ? sviPgOffDays() : [] };
  return { we: Array.isArray(c.we) ? c.we.slice() : SVI_CAL_DEF.we.slice(), off: (c.off || []).slice(), on: (c.on || []).slice() };
};
/* v747 (rapidité) : calculs de dates par numéro de jour (sans objet Date local ni mise en forme à chaque pas) et mémorisés —
   même résultat que l'ancienne version (gardée ci-dessous pour mémoire : sviIsoAdd0) */
const SVI_ISO_N = new Map(), SVI_N_ISO = new Map();
const sviIsoN = iso => { let n = SVI_ISO_N.get(iso); if (n === undefined) { const y = +iso.slice(0, 4), m = +iso.slice(5, 7), d = +iso.slice(8, 10); n = Math.round(Date.UTC(y, m - 1, d) / 86400000); if (SVI_ISO_N.size > 60000) SVI_ISO_N.clear(); SVI_ISO_N.set(iso, n); } return n; };
const sviNIso = n => { let s = SVI_N_ISO.get(n); if (s === undefined) { const D = new Date(n * 86400000); s = D.getUTCFullYear() + "-" + String(D.getUTCMonth() + 1).padStart(2, "0") + "-" + String(D.getUTCDate()).padStart(2, "0"); if (SVI_N_ISO.size > 60000) SVI_N_ISO.clear(); SVI_N_ISO.set(n, s); } return s; };
const sviIsoOk = iso => typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso) && sviNIso(sviIsoN(iso)) === iso;   /* date réelle (pas un 31/02) */
const sviIsoAdd0 = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const sviIsoAdd = (iso, n) => sviIsoOk(iso) ? sviNIso(sviIsoN(iso) + (Number(n) || 0)) : sviIsoAdd0(iso, n);
/* jour travaillé ? */
const sviWork = (cal, iso) => {
  if (!iso) return false;
  if ((cal.on || []).includes(iso)) return true;
  if ((cal.off || []).includes(iso)) return false;
  return !(cal.we || []).includes(sviIsoOk(iso) ? ((sviIsoN(iso) % 7) + 11) % 7 : new Date(iso + "T00:00:00").getDay());   /* 01/01/1970 = jeudi (4) */
};
/* premier jour travaillé à partir de iso (sens +1) ou en remontant (sens -1) */
const sviWNear = (cal, iso, dir = 1) => { let d = iso; for (let i = 0; i < 3700 && !sviWork(cal, d); i++) d = sviIsoAdd(d, dir); return d; };
/* avancer (n > 0) ou reculer (n < 0) de n jours travaillés depuis iso */
const sviWAdd = (cal, iso, n) => {
  let d = iso, k = Math.abs(n), s = n < 0 ? -1 : 1;
  for (let i = 0; k > 0 && i < 20000; i++) { d = sviIsoAdd(d, s); if (sviWork(cal, d)) k--; }
  return d;
};
/* DURÉE = nombre de jours travaillés entre a et b, les deux compris */
const sviWDur = (cal, a, b) => {
  if (!a || !b || b < a) return "";
  let n = 0;
  for (let d = a, i = 0; d <= b && i < 20000; d = sviIsoAdd(d, 1), i++) if (sviWork(cal, d)) n++;
  return n;
};
/* FIN d'une tâche qui commence à deb et dure dur jours travaillés */
const sviWFin = (cal, deb, dur) => sviWAdd(cal, sviWNear(cal, deb, 1), Math.max(1, dur) - 1);
/* DÉBUT d'une tâche qui finit à fin et dure dur jours travaillés */
const sviWDeb = (cal, fin, dur) => sviWAdd(cal, sviWNear(cal, fin, -1), 1 - Math.max(1, dur));
const insPrdQ = r => {
  const f = [r.nbr, r.d1, r.d2, r.d3].filter(v => v !== "" && v !== undefined && v !== null);
  if (f.length) return f.reduce((a, b) => a * num(b), 1);
  return r.q === "" || r.q === undefined ? 0 : num(r.q);
};
/* liaison « primaire » : son activité secondaire porte le même libellé que son activité primaire */
const insLinkPrim = (data, l) => {
  const v = (k, id) => String(((data[k] || []).find(x => x.id === id) || {}).v || "").trim().toUpperCase();
  return !!l && v("sec", l.sec) !== "" && v("sec", l.sec) === v("prim", l.prim);
};
/* QPB d'une désignation liée = somme des QPB de ses produits des activités primaires ; null sans liaison */
const insLinkedQ = (data, id) => {
  const L = ((data || {}).links || []).filter(l => l.des === id);
  if (!L.length) return null;
  return L.filter(l => insLinkPrim(data, l)).reduce((t, l) => t + (l.prd || []).reduce((a, x) => {
    const p = (data.prd || []).find(r => r.id === x.id);
    return a + (p ? insPrdQ(p) : 0);
  }, 0), 0);
};
/* prix d'un produit : PPB de la désignation s'il est dans une activité secondaire identique à son activité primaire ; sinon vide */
const insPrdPrice = (data, id) => {
  const l = ((data || {}).links || []).find(l => (l.prd || []).some(x => x.id === id) && insLinkPrim(data, l));
  if (!l) return "";
  const d = (data.des || []).find(x => x.id === l.des);
  return d && d.p !== "" && d.p !== undefined ? num(d.p) : "";
};
/* v899 (cahier, décision du 03/11/2026) : TVA PAR DÉFAUT — un seul réglage, dans PARAMÉTRAGE › GÉNÉRAL › SOCIÉTÉ, commun au budget et aux achats.
   Plus de 20 % écrit dans le code : une désignation sans TVA prend ce réglage ; s'il est vide aussi, la TVA manque (enregistrement refusé).
   Première lecture : reprend la TVA déjà réglée dans les paramètres des achats, si elle l'avait été. */
const SVI_TVA_KEY = "svi_tva_def_v1";
const sviTvaDef = () => {
  try {
    const s = localStorage.getItem(SVI_TVA_KEY);
    if (s !== null) return String(s).trim() === "" ? null : num(s);
    let a = null; try { a = JSON.parse(SVI_LZ.dec(localStorage.getItem("svi_ach_prm_v1")) || "null"); } catch (e) { a = null; }
    if (a && a.tva !== undefined && a.tva !== "") { localStorage.setItem(SVI_TVA_KEY, String(num(a.tva))); return num(a.tva); }
  } catch (e) {}
  return null;
};
const sviTvaSave = v => { try { localStorage.setItem(SVI_TVA_KEY, v === null || v === undefined ? "" : String(v)); } catch (e) {} };
/* TVA d'une désignation : la sienne, sinon la TVA PAR DÉFAUT ; null = manquante */
const sviTvaOf = v => v === "" || v === undefined || v === null ? sviTvaDef() : num(v);
/* TVA d'un produit : celle de la désignation client à laquelle il est lié ; vide s'il n'est lié à rien */
const insPrdTVA = (data, id) => {
  const l = ((data || {}).links || []).find(l => (l.prd || []).some(x => x.id === id));
  if (!l) return "";
  const d = (data.des || []).find(x => x.id === l.des);
  if (!d) return "";
  const t = sviTvaOf(d.tva);
  return t === null ? "" : t;
};

/* v694 : petit rappel en haut, 2 s, à l'arrivée sur un autre écran du budget (« AVENANT 1 (2 / 4) ») */
const sviNavPill = txt => {
  setTimeout(() => {
    document.getElementById("sviNavPill")?.remove();
    const d = document.createElement("div"); d.id = "sviNavPill"; d.textContent = txt; document.body.appendChild(d);
    setTimeout(() => d.remove(), 2000);
  }, 60);
};
/* ⟪ src/01-onglets-donnees-outils.js ⟫ */
/* =========================================================
   ONGLETS DÉPLAÇABLES (comme les colonnes) : on glisse un onglet
   pour changer l'ordre ; ordre mémorisé par jeu d'onglets
   (détail : le même en saisie, liaisons et validé ; suivi DOC/TAF/OBS ;
   import ; historique).
   ========================================================= */
const SV_TABSETS = [
  { c: "#bdgTabs", t: ".bdg-d-tab", k: "tab", set: "detail" },
  { c: ".rec-tabs", t: ".rec-tab", k: "rtab", set: "suivi" },
  { c: ".imp-tabs", t: ".imp-tab", k: "tab", set: "import" },
  { c: ".hist-filters", t: ".hist-f", k: "b", set: "hist" }
];
/* onglets : dans chaque rangée (chaque bloc), tous les intercalaires ont la même largeur.
   Par défaut : celle du plus long intitulé, réduite pour que toute la rangée ET le bouton ⋯
   tiennent dans le bloc (un intitulé trop long passe sur deux lignes, jamais « … »).
   Poignée au bord droit d'un onglet : règle la largeur de tous les onglets du bloc, mémorisée. */
const SVI_TABW_KEY = "svi_tabw_v1";
const sviTabwLoad = () => { try { return JSON.parse(localStorage.getItem(SVI_TABW_KEY) || "{}") || {}; } catch (e) { return {}; } };
const sviTabwSave = o => { try { localStorage.setItem(SVI_TABW_KEY, JSON.stringify(o)); } catch (e) {} };
const sviTabsOf = (set, c) => [...c.querySelectorAll(set.t)].filter(t => t.parentElement === c || t.closest(set.c) === c);
const sviEqualTabs = () => {
  const saved = sviTabwLoad();
  SV_TABSETS.forEach(set => document.querySelectorAll(set.c).forEach(c => {
    if (c.offsetParent === null) return;
    const ts = sviTabsOf(set, c);
    if (ts.length < 2) return;
    /* v497 (remarque 34) : une largeur mémorisée ne fait jamais déborder la rangée — tous les onglets restent entiers */
    let w = saved[set.c], nat = 0, fit = 0;
    ts.forEach(t => t.classList.remove("tab-tight"));
    {
      /* largeur naturelle du plus long intitulé */
      ts.forEach(t => { t.style.width = ""; t.style.flex = "none"; t.style.whiteSpace = "nowrap"; });
      nat = Math.ceil(Math.max(...ts.map(t => t.getBoundingClientRect().width)));
      /* place disponible : le bloc, moins ce qui n'est pas un onglet (⋯, poignée…) */
      const par = c.parentElement;
      let avail = c.clientWidth;
      const others = [...c.children].filter(x => !ts.includes(x)).reduce((t, x) => t + x.getBoundingClientRect().width, 0);
      if (par && getComputedStyle(par).display.includes("flex") && !getComputedStyle(par).flexDirection.startsWith("column")
        && c.getBoundingClientRect().width < par.clientWidth - 4) {
        avail = par.clientWidth - [...par.children].filter(x => x !== c).reduce((t, x) => t + x.getBoundingClientRect().width, 0);
      }
      const gap = parseFloat(getComputedStyle(c).columnGap) || 0;
      const nv = ts.filter(t => t.offsetParent !== null).length || ts.length;
      fit = Math.floor((avail - others - 16 - gap * nv) / nv);
      w = w ? Math.max(70, Math.min(w, fit)) : Math.max(70, Math.min(nat, fit));
    }
    ts.forEach(t => { t.style.boxSizing = "border-box"; t.style.width = w + "px"; t.style.flex = "none";
      t.style.whiteSpace = "normal"; t.style.justifyContent = "center"; t.style.textAlign = "center"; t.classList.add("tab-eq"); });
    /* rangée serrée : intitulé un peu plus petit et sans pictogramme, pour qu'aucun mot ne soit coupé */
    if (ts.some(t => t.offsetParent !== null && t.scrollWidth > t.clientWidth + 1)) ts.forEach(t => t.classList.add("tab-tight"));
    /* même hauteur pour tous les onglets de la rangée (celle du plus haut) */
    ts.forEach(t => { t.style.height = ""; t.style.alignSelf = "flex-end"; });
    const hMax = Math.ceil(Math.max(...ts.filter(t => t.offsetParent !== null).map(t => t.getBoundingClientRect().height)));
    if (hMax) ts.forEach(t => { t.style.height = hMax + "px"; });
  }));
};
{
  let q = 0;
  const run = () => { q = 0; try { sviEqualTabs(); } catch (e) {} };
  const sel = SV_TABSETS.map(x => x.c).join(",");
  new MutationObserver(ms => {
    if (q) return;
    /* seulement si des onglets changent (pas un trait de glissement ou un message ajouté au document) */
    const has = n => n.nodeType === 1 && (n.matches(sel) || !!n.querySelector(sel));
    if (!ms.some(m => { const el = m.target.nodeType === 1 ? m.target : m.target.parentElement; return el && (el.closest(sel) || [...m.addedNodes].some(has) || [...m.removedNodes].some(has)); })) return;
    q = requestAnimationFrame(run);
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener("resize", () => { if (!q) q = requestAnimationFrame(run); });
  /* poignée : bord droit d'un onglet (12 px) ; glisser = largeur de tous les onglets du bloc */
  document.addEventListener("pointerdown", e => {
    const t = e.target.closest && e.target.closest(".tab-eq");
    if (!t) return;
    const r = t.getBoundingClientRect();
    if (e.clientX < r.right - 12) return;
    const set = SV_TABSETS.find(x => t.closest(x.c));
    if (!set) return;
    const c = t.closest(set.c);
    e.preventDefault(); e.stopImmediatePropagation();
    const x0 = e.clientX, w0 = r.width, ts = sviTabsOf(set, c);
    let w = w0;
    const mv = ev => { ev.preventDefault(); w = Math.max(70, Math.min(420, Math.round(w0 + ev.clientX - x0))); ts.forEach(x => { x.style.width = w + "px"; }); };
    const up = () => {
      document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
      const o = sviTabwLoad(); o[set.c] = w; sviTabwSave(o);
      /* le toucher ne doit pas ouvrir l'onglet */
      const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
      document.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => document.removeEventListener("click", stop, { capture: true }), 300);
    };
    document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
  }, true);
}
/* en-têtes de colonnes jamais tronqués (FORMAT) : une colonne n'est jamais plus étroite que son intitulé,
   même si une largeur plus petite avait été mémorisée */
const sviMinHeadCols = () => {
  /* v743 : mesures d'abord (toutes les tables), écritures ensuite — plus d'alternance lecture / écriture qui forçait
     le navigateur à recalculer la page à chaque colonne (lenteur sur les gros budgets) */
  let CW = {}; try { CW = JSON.parse(localStorage.getItem("svi_colw_v1") || "{}") || {}; } catch (e) {}
  const W = [];
  document.querySelectorAll("table").forEach(tb => {
    if (tb.offsetParent === null) return;
    const cols = tb.querySelectorAll(":scope > colgroup > col");
    const ths = tb.querySelectorAll(":scope > thead > tr:first-child > th");
    if (!cols.length || cols.length !== ths.length) return;
    let add = 0;
    ths.forEach((th, i) => {
      /* v512 (remarque 77) : une largeur réglée à la poignée est gardée telle quelle (jamais réélargie après un redessin) */
      if (cols[i] && cols[i].dataset && cols[i].dataset.w && CW[cols[i].dataset.w]) return;
      const lab = th.querySelector(".cf-lab");
      if (!lab || lab.scrollWidth <= lab.clientWidth + 1) return;   /* intitulé déjà entier */
      const need = Math.ceil(lab.scrollWidth + (th.clientWidth - lab.clientWidth)) + 2;
      const cur = th.getBoundingClientRect().width;
      if (need > cur + 1) { W.push([cols[i], need]); add += need - cur; }
    });
    if (add && tb.style.width) W.push([tb, parseFloat(tb.style.width) + add]);
  });
  W.forEach(([el, w]) => { el.style.width = w + "px"; });
};
{
  let q2 = 0;
  new MutationObserver(ms => {
    if (q2) return;
    if (!ms.some(m => { const el = m.target.nodeType === 1 ? m.target : m.target.parentElement; return el && (el.closest("table") || (el.querySelector && el.querySelector("table"))); })) return;
    q2 = requestAnimationFrame(() => { q2 = 0; try { sviMinHeadCols(); } catch (e) {} });
  }).observe(document.documentElement, { childList: true, subtree: true });
}
const svTabLoad = () => { try { return JSON.parse(localStorage.getItem("svi_taborder_v1") || "{}") || {}; } catch (e) { return {}; } };
const svTabApply = () => {
  const O = svTabLoad();
  SV_TABSETS.forEach(S => {
    const ord = O[S.set];
    if (!ord || !ord.length) return;
    document.querySelectorAll(S.c).forEach(box => {
      const tabs = [...box.children].filter(x => x.matches(S.t));
      if (tabs.length < 2) return;
      const pos = el => { const i = ord.indexOf(el.dataset[S.k]); return i < 0 ? 999 : i; };
      const want = tabs.map((el, i) => ({ el, i })).sort((a, b) => pos(a.el) - pos(b.el) || a.i - b.i).map(o => o.el);
      if (want.every((el, i) => el === tabs[i])) return;
      const after = tabs[tabs.length - 1].nextSibling;
      want.forEach(el => box.insertBefore(el, after));
    });
  });
};
(() => {
  let busy = false;
  const mo = new MutationObserver(() => { if (busy) return; busy = true; try { svTabApply(); } finally { busy = false; } });
  const go = () => mo.observe(document.body, { childList: true, subtree: true });
  if (document.body) go(); else document.addEventListener("DOMContentLoaded", go);
  document.addEventListener("pointerdown", e => {
    if (e.button > 0 || e.target.closest(".cf-btn")) return;
    const S = SV_TABSETS.find(S => e.target.closest(S.t) && e.target.closest(S.t).parentElement.matches(S.c));
    if (!S) return;
    const tab = e.target.closest(S.t), box = tab.parentElement;
    const x0 = e.clientX, y0 = e.clientY;
    let drag = false;
    const mv = ev => {
      if (!drag) {
        if (Math.abs(ev.clientX - x0) < 10 || Math.abs(ev.clientX - x0) < Math.abs(ev.clientY - y0)) return;
        drag = true; tab.classList.add("tab-drag");
      }
      ev.preventDefault();
      const over = [...box.children].filter(x => x.matches(S.t) && x !== tab).find(x => {
        const r = x.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top - 6 && ev.clientY <= r.bottom + 6;
      });
      if (!over) return;
      const r = over.getBoundingClientRect();
      box.insertBefore(tab, ev.clientX < r.left + r.width / 2 ? over : over.nextSibling);
    };
    const up = () => {
      document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
      if (!drag) return;
      tab.classList.remove("tab-drag");
      const O = svTabLoad();
      O[S.set] = [...box.children].filter(x => x.matches(S.t)).map(x => x.dataset[S.k]);
      try { localStorage.setItem("svi_taborder_v1", JSON.stringify(O)); } catch (err) {}
      svTabApply();
      /* le glissement ne vaut pas un toucher : pas de changement d'onglet */
      const stop = ev => {
        if (!box.contains(ev.target)) return;
        ev.stopPropagation(); ev.preventDefault();
        document.removeEventListener("click", stop, true);
      };
      document.addEventListener("click", stop, true);
      setTimeout(() => document.removeEventListener("click", stop, true), 400);
    };
    document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
  }, true);
})();
/* FORMAT 83 : avec un filtre, « retenues/total » ; sans filtre, le total seul */
/* v780 (remarque 4) : compteur différent de zéro = pastille ORANGE (cnt-nz), quel que soit le mode ; à zéro, grise */
const svCnt = (n, total) => {
  const a = Number(n) || 0, c = a ? "svi-cnt cnt-nz" : "svi-cnt";
  if (total === undefined || total === null || Number(total) === a) return `<span class="${c}">${a}</span>`;
  return `<span class="${c}">${a}/${Number(total) || 0}</span>`;
};
/* compteurs écrits à la main ou mis à jour après coup : même règle */
const sviCntPaint = root => { try { (root || document).querySelectorAll(".svi-cnt").forEach(e => e.classList.toggle("cnt-nz", !/^0(\/|$)/.test(e.textContent.trim()) && e.textContent.trim() !== "")); } catch (e) {} };
try { new MutationObserver(ms => { for (const m of ms) { const t = m.target.nodeType === 1 ? m.target : m.target.parentElement; if (t && t.closest && t.closest(".svi-cnt")) sviCntPaint(t.closest(".svi-cnt").parentElement); else if (m.addedNodes && [...m.addedNodes].some(x => x.nodeType === 1 && (x.matches(".svi-cnt") || x.querySelector(".svi-cnt:not(.cnt-nz)")))) sviCntPaint(t); } })
  .observe(document.documentElement, { childList: true, subtree: true, characterData: true }); } catch (e) {}
/* onglets vides (compteur 0) : mise en forme spéciale, même facultatifs */
const sviMarkEmptyTabs = root => (root || document).querySelectorAll(".bdg-d-tab, .rec-tab, .imp-tab").forEach(b => {
  const c = b.querySelector(".svi-cnt");
  b.classList.toggle("tab-vide", !!c && c.textContent.trim() === "0" && !b.classList.contains("cf-on"));
});

/* =========================================================
   DONNEES CHS / BDS
   ========================================================= */

let db = {
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

/* v743 (rapidité) : un seul format créé une fois (toLocaleString en recréait un à chaque nombre) — même résultat */
const SVI_MONEY_FMT = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function money(v) {
  return SVI_MONEY_FMT.format(num(v));
}

/* v450 : un niveau nommé automatiquement (NIVEAU 2, NIVEAU 2.1…) s'affiche précédé du nom de ses parents (« FONDATION / ») */
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

/* ⟪ src/02-stockage-instance.js ⟫ */
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
  const old = sviInstStr;
  sviInstStr = JSON.stringify(l || []);
  /* v672 (bloc 2) : budgets changés → en attente d'envoi à la base V3 */
  if (typeof sviSyncChanged === "function") try { sviSyncChanged(old, sviInstStr); } catch (e) {}
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

/* ⟪ src/02e-synchro-base.js ⟫ */
/* =========================================================
   v672 (BLOC 2) : ENREGISTREMENT DANS LA BASE V3
   - Enregistrement continu sur l'iPad (comme avant) ; envoi à la base quelques secondes après chaque pause.
   - Chaque budget a un numéro de version (REV) ; un envoi parti d'une version dépassée (un autre l'a modifié entre-temps,
     ou l'iPad était HORS LIGNE) est FUSIONNÉ case par case : chaque côté garde ce qu'il a changé ; une même case changée
     des deux côtés = la modification la plus récente gagne (heure de la modification, pas de la reconnexion) ;
     la valeur non retenue va dans les CONFLITS du budget (case, ma valeur, valeur gardée, auteur), traités ligne par ligne.
   - Hors ligne : tout reste sur l'iPad, repère HORS LIGNE + nombre de budgets en attente, envoi au retour de la connexion.
   - Nom d'utilisateur demandé à l'ouverture (sans attendre le chapitre des droits) ; il signe les envois et l'historique.
   - Envoi initial des budgets déjà saisis sur l'iPad, avec contrôle (nombre de lignes relues dans la base).
   - Photo du budget dans les onglets BUDGETS, DESIGNATIONS, TACHES, DETAILS à FIGER et à VALIDER.
   - Verrou : le premier qui ouvre un budget en instance le modifie ; les autres l'ouvrent en lecture seule, avec son nom.
   Côté Google : apps-script/baseV3sync.gs (à installer une fois) ; sans lui, l'application dit BASE NON BRANCHÉE et garde tout.
   ========================================================= */
const SVI_USER_KEY = "svi_user_v1", SVI_SYNC_KEY = "svi_sync_v1";
const sviUser = () => { try { return localStorage.getItem(SVI_USER_KEY) || ""; } catch (e) { return ""; } };
const sviSyncMeta = () => { try { return JSON.parse(localStorage.getItem(SVI_SYNC_KEY) || "{}") || {}; } catch (e) { return {}; } };
const sviSyncMetaSet = m => { try { localStorage.setItem(SVI_SYNC_KEY, JSON.stringify(m)); } catch (e) {} };
/* v673 : appels à la base un par un (jamais deux en même temps : le verrou de Google expirait) */
const SVI_Q = { p: Promise.resolve() };
const sviQ = (a, b) => { const run = SVI_Q.p.then(() => apiPost(a, b, { quiet: true }));   /* v677 : sans fenêtre de chargement */ SVI_Q.p = run.catch(() => {}); return run; };
const SVI_SYNC = { applying: false, timer: null, busy: false, status: "", err: "", last: 0, locks: {}, cells: null };
const sviSyncBase = ref => sviIdbGet("svi_sync_base:" + ref).catch(() => null);
const sviSyncBaseSet = (ref, s) => sviIdbPut("svi_sync_base:" + ref, s).catch(() => {});

/* v770 : GRANDES LISTES (achats) gardées dans IndexedDB comme les budgets, et non dans le stockage local de Safari (~5 Mo par site,
   partagés entre la version validée, la version test et leurs copies pour l'envoi : l'import NovApp ne tenait plus).
   localStorage.getItem / setItem / removeItem de ces clés sont redirigés ici (même code partout, tests compris) ;
   copie en mémoire lue au démarrage ; reprise unique de l'ancien stockage, qui est libéré. */
const SVI_BIG_RX = /^svi_ach_(art|frs|bsn|caf|dvf|cmf|rcp|rtr|faf|avf|paf|nov|backup)_v1$/;
const SVI_BIG = (() => {
  const cache = new Map(), K = ["art", "frs", "bsn", "caf", "dvf", "cmf", "rcp", "rtr", "faf", "avf", "paf", "nov", "backup"].map(x => "svi_ach_" + x + "_v1");
  const o = { cache, ready: null, raw: null };
  o.get = k => cache.has(k) ? cache.get(k) : o.raw ? o.raw.get(k) : null;
  o.set = (k, v) => { cache.set(k, v === null || v === undefined ? null : String(v)); try { sviIdbPut("big:" + k, cache.get(k)).catch(() => {}); } catch (e) {} };
  o.load = () => (o.ready = Promise.all(K.map(k => (typeof sviIdbGet === "function" ? sviIdbGet("big:" + k) : Promise.resolve(undefined)).catch(() => undefined).then(v => {
    if (cache.has(k)) return;   /* écrit pendant le chargement : la valeur récente reste */
    let x = v;
    if (x === undefined && o.raw) { const r = o.raw.get(k); if (r !== null) { x = r; sviIdbPut("big:" + k, r).catch(() => {}); } }
    cache.set(k, x === undefined ? null : x);
    if (o.raw && cache.get(k) !== null) { o.raw.rm(k); o.raw.rm("svi_shared_v1:K:" + k); }   /* ancien stockage libéré */
  }))).catch(() => {}));
  return o;
})();
/* v679 : DONNÉES PARTAGÉES hors budgets (LISTE DES INDICATEURS…) — une ligne de SYNC « _CLÉ », même envoi, même fusion */
const SVI_SH_KEY = "svi_shared_v1:";
const sviSharedItem = ref => { const bk = /^_K:/.test(ref) ? ref.slice(3) : ""; if (bk && SVI_BIG_RX.test(bk)) { const v = SVI_BIG.get(bk); return v === null ? { ref, project: "PARTAGÉ", state: "partage", data: { v: null } } : { ref, project: "PARTAGÉ", state: "partage", data: { v } }; }
  try { return JSON.parse(localStorage.getItem(SVI_SH_KEY + ref.slice(1)) || "null"); } catch (e) { return null; } };
const sviSharedPut = (ref, it) => { if (/^_K:/.test(ref) && SVI_BIG_RX.test(ref.slice(3))) return; try { const o = { ...it, data: { ...(it.data || {}) } }; delete o.data.conf; localStorage.setItem(SVI_SH_KEY + ref.slice(1), JSON.stringify(o)); } catch (e) {} };
const sviSharedGet = key => (sviSharedItem("_" + key) || {}).data || {};
const sviSharedSet = (key, data) => {
  const ref = "_" + key; sviSharedPut(ref, { ref, project: "PARTAGÉ", state: "partage", data });
  const M = sviSyncMeta(), m = M[ref] = M[ref] || {}; m.dirty = m.dirty || Date.now(); m.last = Date.now(); delete m.del; sviSyncMetaSet(M);
  sviSyncSchedule(1500);
};
/* v722 (bloc 7, point 3) : TOUT PARTAGER — en plus des budgets et de la liste des indicateurs, les réglages communs gardés en
   localStorage sont partagés par une ligne « _K:<clé> » de la base (même envoi, même verrou, même fusion) :
   DOCUMENTS / TAF / OBSERVATIONS et HISTORIQUE de chaque budget, UNITÉS, emballage / livraison, doublons proches écartés,
   signataires, dossiers Drive. Restent sur l'appareil : tout réglage d'affichage (colonnes, vue, plis, poignées, échelle…).
   Fichier joint d'un DOCUMENT : non envoyé (trop lourd) — sa copie Drive sert sur les autres appareils. */
/* v769 : COMPRESSION des grandes listes (achats) dans la mémoire de l'appareil — algorithme lz-string (Pieroxy, licence MIT),
   variante UTF-16 (15 bits par caractère) faite pour localStorage. Valeur compressée = « \u0001LZ » + texte compressé. */
const SVI_LZ = (() => {
  const f = String.fromCharCode;
  function compress(u, bits, gc) {
    if (u == null) return "";
    let i, v, dict = {}, toCreate = {}, c = "", wc = "", w = "", enlarge = 2, dictSize = 3, numBits = 2, data = [], val = 0, pos = 0, ii;
    const out = (n, b) => { for (let k = 0; k < b; k++) { val = (val << 1) | (n & 1); if (pos === bits - 1) { pos = 0; data.push(gc(val)); val = 0; } else pos++; n >>= 1; } };
    const outZero = b => { for (let k = 0; k < b; k++) { val = val << 1; if (pos === bits - 1) { pos = 0; data.push(gc(val)); val = 0; } else pos++; } };
    const emitW = () => {
      if (Object.prototype.hasOwnProperty.call(toCreate, w)) {
        if (w.charCodeAt(0) < 256) { outZero(numBits); out(w.charCodeAt(0), 8); }
        else { out(1, numBits); out(w.charCodeAt(0), 16); }
        if (--enlarge === 0) { enlarge = Math.pow(2, numBits); numBits++; }
        delete toCreate[w];
      } else out(dict[w], numBits);
      if (--enlarge === 0) { enlarge = Math.pow(2, numBits); numBits++; }
    };
    for (ii = 0; ii < u.length; ii++) {
      c = u.charAt(ii);
      if (!Object.prototype.hasOwnProperty.call(dict, c)) { dict[c] = dictSize++; toCreate[c] = true; }
      wc = w + c;
      if (Object.prototype.hasOwnProperty.call(dict, wc)) w = wc;
      else { emitW(); dict[wc] = dictSize++; w = String(c); }
    }
    if (w !== "") emitW();
    out(2, numBits);
    while (true) { val = val << 1; if (pos === bits - 1) { data.push(gc(val)); break; } else pos++; }
    return data.join("");
  }
  function decompress(length, resetValue, getNext) {
    let dict = [], enlarge = 4, dictSize = 4, numBits = 3, entry = "", result = [], i, w, c, bits, resb, maxpower, power;
    const data = { val: getNext(0), position: resetValue, index: 1 };
    const read = n => { let b = 0; maxpower = Math.pow(2, n); power = 1;
      while (power !== maxpower) { resb = data.val & data.position; data.position >>= 1; if (data.position === 0) { data.position = resetValue; data.val = getNext(data.index++); } b |= (resb > 0 ? 1 : 0) * power; power <<= 1; }
      return b; };
    for (i = 0; i < 3; i++) dict[i] = i;
    switch (read(2)) { case 0: c = f(read(8)); break; case 1: c = f(read(16)); break; case 2: return ""; }
    dict[3] = c; w = c; result.push(c);
    while (true) {
      if (data.index > length) return "";
      switch (c = read(numBits)) {
        case 0: dict[dictSize++] = f(read(8)); c = dictSize - 1; enlarge--; break;
        case 1: dict[dictSize++] = f(read(16)); c = dictSize - 1; enlarge--; break;
        case 2: return result.join("");
      }
      if (enlarge === 0) { enlarge = Math.pow(2, numBits); numBits++; }
      if (dict[c]) entry = dict[c]; else if (c === dictSize) entry = w + w.charAt(0); else return null;
      result.push(entry);
      dict[dictSize++] = w + entry.charAt(0); enlarge--;
      w = entry;
      if (enlarge === 0) { enlarge = Math.pow(2, numBits); numBits++; }
    }
  }
  const toUTF16 = s => s == null ? "" : compress(s, 15, a => f(a + 32)) + " ";
  const fromUTF16 = s => s == null ? "" : s === "" ? null : decompress(s.length, 16384, i => s.charCodeAt(i) - 32);
  const MK = "\u0001LZ";
  return { MK, enc: s => MK + toUTF16(s), dec: v => typeof v === "string" && v.startsWith(MK) ? fromUTF16(v.slice(MK.length)) : v, is: v => typeof v === "string" && v.startsWith(MK) };
})();
/* v749 : + articles et paramètres d'ACHATS (svi_ach_art_v1, svi_ach_prm_v1) */
const SVI_SHARE_RX = /^svi_(docs|taf|obs|hist)_v1:|^svi_(units|cond_chs|nearskip|sign|driveurls|drivepaths|ach_art|ach_prm|ach_frs|ach_bsn|ach_caf|ach_dvf|ach_cmf|ach_rcp|ach_rtr|ach_faf|ach_avf|ach_paf|ach_nov|colors|pg|fld)_v1$/;
const sviShareVal = (k, v) => {
  if (v === null || v === undefined) return null;
  if (/^svi_docs_v1:/.test(k)) { try { const L = JSON.parse(v); if (Array.isArray(L)) return JSON.stringify(L.map(x => { if (!x || typeof x !== "object") return x; const o = { ...x }; delete o.data; return o; })); } catch (e) {} }
  return String(v);
};
/* fusion de deux valeurs partagées : listes = réunion (même élément : le plus récent gagne), objets = clés réunies, sinon la plus récente */
const sviShareKeyOf = x => x && typeof x === "object" ? String(x.ref || x.id || x.a || x.n || x.t || JSON.stringify(x)) : JSON.stringify(x);
const sviShareMerge = (mine0, theirs0, mineNewer) => {
  /* v769 : listes compressées (achats) décompressées pour la fusion, recompressées après */
  const lz = SVI_LZ.is(mine0) || SVI_LZ.is(theirs0), mine = SVI_LZ.dec(mine0), theirs = SVI_LZ.dec(theirs0);
  if (lz) { const r = sviShareMerge(mine, theirs, mineNewer); return r && r.length > 4000 ? SVI_LZ.enc(r) : r; }
  let A, B; try { A = JSON.parse(mine); B = JSON.parse(theirs); } catch (e) { return mineNewer ? mine : theirs; }
  if (Array.isArray(A) && Array.isArray(B)) {
    const M = new Map(); (mineNewer ? [B, A] : [A, B]).forEach(L => L.forEach(x => M.set(sviShareKeyOf(x), x)));
    const ord = []; [...A, ...B].forEach(x => { const k = sviShareKeyOf(x); if (!ord.includes(k)) ord.push(k); });
    return JSON.stringify(ord.map(k => M.get(k)));
  }
  if (A && B && typeof A === "object" && typeof B === "object") return JSON.stringify(mineNewer ? { ...B, ...A } : { ...A, ...B });
  return mineNewer ? mine : theirs;
};
const sviShareApply = (ref, it) => {
  const k = ref.slice(3), v = it && it.data ? it.data.v : null;
  SVI_SYNC.applying = true;
  try {
    if (v === null || v === undefined) localStorage.removeItem(k);
    else if (/^svi_docs_v1:/.test(k)) {   /* fichier joint gardé sur l'appareil qui l'a */
      let loc = []; try { loc = JSON.parse(localStorage.getItem(k) || "[]") || []; } catch (e) {}
      let L = []; try { L = JSON.parse(v) || []; } catch (e) {}
      const byRef = new Map(loc.filter(x => x && x.ref).map(x => [x.ref, x]));
      localStorage.setItem(k, JSON.stringify(L.map(x => x && x.ref && byRef.get(x.ref) && byRef.get(x.ref).data ? { ...x, data: byRef.get(x.ref).data } : x)));
    } else localStorage.setItem(k, v);
  } finally { SVI_SYNC.applying = false; }
};
/* toute écriture d'une clé partagée sur l'appareil = ligne « _K:<clé> » en attente d'envoi */
if (typeof window !== "undefined" && !window.__sviShareHook && typeof Storage !== "undefined") {
  window.__sviShareHook = true;
  const S = Storage.prototype, st = S.setItem, rm = S.removeItem, gt = S.getItem;
  const big = (t, k) => t === window.localStorage && SVI_BIG_RX.test(String(k));
  SVI_BIG.raw = { get: k => gt.call(window.localStorage, k), rm: k => { try { rm.call(window.localStorage, k); } catch (e) {} } };
  S.getItem = function (k) { return big(this, k) ? SVI_BIG.get(String(k)) : gt.call(this, k); };
  S.setItem = function (k, v) { const r = big(this, k) ? SVI_BIG.set(String(k), v) : st.call(this, k, v); try { if (this === window.localStorage && SVI_SHARE_RX.test(String(k)) && !SVI_SYNC.applying) sviSharedSet("K:" + k, { v: sviShareVal(String(k), v) }); } catch (e) {} return r; };
  S.removeItem = function (k) { const r = big(this, k) ? SVI_BIG.set(String(k), null) : rm.call(this, k); try { if (this === window.localStorage && SVI_SHARE_RX.test(String(k)) && !SVI_SYNC.applying) sviSharedSet("K:" + k, { v: null }); } catch (e) {} return r; };
}
SVI_BIG.load();
/* clés partagées déjà présentes sur l'appareil (avant la v722) : envoyées une fois */
const sviShareSeed = () => {
  try {
    const M = sviSyncMeta(), keys = [];
    for (let i = 0; i < localStorage.length; i++) { const k = String(localStorage.key(i) || "").replace(/^svitest:/, ""); if (SVI_SHARE_RX.test(k)) keys.push(k); }
    keys.forEach(k => { const ref = "_K:" + k; if (!(M[ref] || {}).rev && !(M[ref] || {}).dirty) { const v = localStorage.getItem(k); if (v !== null) sviSharedSet("K:" + k, { v: sviShareVal(k, v) }); } });
  } catch (e) {}
};
/* liste des budgets de l'iPad modifiée : budgets changés marqués « en attente » */
const sviSyncChanged = (oldStr, newStr) => {
  if (SVI_SYNC.applying) return;
  let A = [], B = [];
  try { A = JSON.parse(oldStr || "[]") || []; B = JSON.parse(newStr || "[]") || []; } catch (e) { return; }
  const mA = new Map(A.map(x => [x.ref, JSON.stringify(x)])), mB = new Map(B.map(x => [x.ref, JSON.stringify(x)]));
  const M = sviSyncMeta(), now = Date.now();
  let ch = false;
  mB.forEach((s, ref) => { if (mA.get(ref) !== s) { const m = M[ref] = M[ref] || {}; m.dirty = m.dirty || now; m.last = now; delete m.del; ch = true; } });
  mA.forEach((s, ref) => { if (!mB.has(ref)) { const m = M[ref] = M[ref] || {}; m.del = true; m.dirty = now; m.last = now; ch = true; } });
  if (!ch) return;
  sviSyncMetaSet(M);
  sviSyncSchedule(4000);
};
const sviSyncPending = () => { const M = sviSyncMeta(); return Object.keys(M).filter(r => M[r].dirty).length; };
const sviSyncSchedule = ms => { clearTimeout(SVI_SYNC.timer); SVI_SYNC.timer = setTimeout(() => sviSyncRun(), ms); sviSyncPaint(); };

/* ---------- fusion case par case (base commune, ma version, version de la base) ---------- */
const sviSyncJ = v => JSON.stringify(v === undefined ? null : v);
const SVI_SYNC_LAB = { des: "DÉSIGNATIONS CLIENT", lot: "LOTS", prim: "ACTIVITÉS PRIMAIRES", sec: "ACTIVITÉS SECONDAIRES", chg: "DÉTAIL CHARGES", prd: "DÉTAIL PRODUITS", qlt: "DÉTAIL QUALITÉ", links: "LIAISONS" };
const sviSyncRowLab = r => r ? String(r.des || r.v || r.art || r.id || "") : "";
const sviMergeData = (b, m, t, mineNewer, who, when) => {
  b = b || {}; m = m || {}; t = t || {};
  const out = {}, conf = [];
  const keys = new Set([...Object.keys(m), ...Object.keys(t)]);
  keys.forEach(k => {
    if (k === "conf") return;
    const bv = b[k], mv = m[k], tv = t[k];
    if (sviSyncJ(mv) === sviSyncJ(tv)) { out[k] = mv; return; }
    if (sviSyncJ(mv) === sviSyncJ(bv)) { out[k] = tv; return; }
    if (sviSyncJ(tv) === sviSyncJ(bv)) { out[k] = mv; return; }
    /* tableaux de lignes à identifiant : ligne par ligne, puis case par case */
    if (Array.isArray(mv) && Array.isArray(tv) && [...mv, ...tv].every(r => r && typeof r === "object" && r.id)) {
      const BM = new Map((Array.isArray(bv) ? bv : []).map(r => [r.id, r])), TM = new Map(tv.map(r => [r.id, r])), MM = new Map(mv.map(r => [r.id, r]));
      const res = [];
      const one = (id) => {
        const br = BM.get(id), mr = MM.get(id), tr = TM.get(id);
        if (mr && tr) {
          const r = {};
          new Set([...Object.keys(mr), ...Object.keys(tr)]).forEach(f => {
            const a = mr[f], c = tr[f], o = br ? br[f] : undefined;
            if (sviSyncJ(a) === sviSyncJ(c) || sviSyncJ(c) === sviSyncJ(o)) { if (a !== undefined) r[f] = a; return; }
            if (sviSyncJ(a) === sviSyncJ(o)) { if (c !== undefined) r[f] = c; return; }
            const win = mineNewer ? a : c, lose = mineNewer ? c : a;
            if (win !== undefined) r[f] = win;
            conf.push({ id: "c" + Date.now().toString(36) + conf.length, k, rid: id, f, lab: (SVI_SYNC_LAB[k] || k) + " › " + sviSyncRowLab(mr) + " › " + String(f).toUpperCase(), mine: a, kept: win, lost: lose, user: who, ts: when, me: !mineNewer });
          });
          return r;
        }
        if (mr && !tr) return br && sviSyncJ(br) === sviSyncJ(mr) ? null : mr;   /* supprimée là-bas, inchangée ici : supprimée */
        if (tr && !mr) return br && sviSyncJ(br) === sviSyncJ(tr) ? null : tr;
        return null;
      };
      const seen = new Set();
      mv.forEach(r => { seen.add(r.id); const x = one(r.id); if (x) res.push(x); });
      tv.forEach(r => { if (seen.has(r.id)) return; const x = one(r.id); if (x) res.push(x); });
      out[k] = res; return;
    }
    /* objets (délais, liaisons du planning, réglages…) : clé par clé */
    if (mv && tv && typeof mv === "object" && typeof tv === "object" && !Array.isArray(mv) && !Array.isArray(tv)) {
      const r = {};
      new Set([...Object.keys(mv), ...Object.keys(tv)]).forEach(f => {
        const a = mv[f], c = tv[f], o = bv && typeof bv === "object" ? bv[f] : undefined;
        if (sviSyncJ(a) === sviSyncJ(c) || sviSyncJ(c) === sviSyncJ(o)) { if (a !== undefined) r[f] = a; return; }
        if (sviSyncJ(a) === sviSyncJ(o)) { if (c !== undefined) r[f] = c; return; }
        /* v759 : liste à identifiants dans un objet (scénarios ver.L, versions…) : fusion ligne par ligne, plus de liste entière
           remplacée par l'autre appareil (un scénario archivé ici ne repasse plus « en réserve ») */
        if (Array.isArray(a) && Array.isArray(c) && [...a, ...c].every(x => x && typeof x === "object" && x.id)) {
          const sub = sviMergeData({ [f]: Array.isArray(o) ? o : [] }, { [f]: a }, { [f]: c }, mineNewer, who, when);
          r[f] = sub[f]; (sub.conf || []).forEach(x => conf.push({ ...x, k: k + "." + f, lab: k.toUpperCase() + " › " + x.lab }));
          return;
        }
        const win = mineNewer ? a : c;
        if (win !== undefined) r[f] = win;
        conf.push({ id: "c" + Date.now().toString(36) + conf.length, k, sub: f, lab: k.toUpperCase() + " › " + f, mine: a, kept: win, lost: mineNewer ? c : a, user: who, ts: when, me: !mineNewer });
      });
      out[k] = r; return;
    }
    out[k] = mineNewer ? mv : tv;
    conf.push({ id: "c" + Date.now().toString(36) + conf.length, k, lab: (SVI_SYNC_LAB[k] || k).toUpperCase(), mine: mv, kept: mineNewer ? mv : tv, lost: mineNewer ? tv : mv, user: who, ts: when, me: !mineNewer });
  });
  /* conflits : ceux des deux côtés, plus les nouveaux (seuls ceux où MA valeur n'a pas été gardée sont à traiter) */
  const old = [...(m.conf || []), ...(t.conf || [])].filter((c, i, a) => a.findIndex(x => x.id === c.id) === i);
  out.conf = old.concat(conf.filter(c => c.me));
  return out;
};
const sviMergeItem = (b, m, t, mineNewer, who, when) => {
  const out = { ...t, ...m };
  ["intitule", "client", "project", "state", "created", "validated", "mode"].forEach(f => {
    const a = m[f], c = t[f], o = b ? b[f] : undefined;
    out[f] = sviSyncJ(a) === sviSyncJ(o) ? c : sviSyncJ(c) === sviSyncJ(o) ? a : (mineNewer ? a : c);
  });
  out.data = sviMergeData(b && b.data, m.data, t.data, mineNewer, who, when);
  return out;
};

/* ---------- photo (onglets BUDGETS, DESIGNATIONS, TACHES, DETAILS) ---------- */
const sviSyncPhoto = it => {
  const d = it.data || {}, U = v => String(v ?? "").trim();
  const nm = (k, id) => U(((d[k] || []).find(x => x.id === id) || {}).v);
  const des = (d.des || []).map((r, i) => ({ _k: r.id, ART: U(r.art), DESIGNATION: U(r.des), UNITE: U(r.u), TITRE: r.t ? "OUI" : "", ORDRE: i + 1, QTE: r.q ?? "", PRIX: r.p ?? "", TVA: r.tva ?? "" }));
  const per = k => { const L = ((d.dlp || {})[k] || []).filter(p => p.deb); return L.length ? [L.map(p => p.deb).sort()[0], L.map(p => p.fin || p.deb).sort().pop()] : ["", ""]; };
  const taches = (d.links || []).map((l, i) => { const [deb, fin] = per(l.lot + "|" + l.sec), P = ((d.dpred || {})[l.lot + "|" + l.sec] || []);
    return { _k: l.id, _d: l.des, LOT: nm("lot", l.lot), ACT_PRIMAIRE: nm("prim", l.prim), ACT_SECONDAIRE: nm("sec", l.sec), DEBUT: deb, FIN: fin, ORDRE: i + 1,
      PREDECESSEURS: P.map(x => { const [lo, se] = String(x.k || x).split("|"); return nm("lot", lo) + " › " + nm("sec", se); }).join(" ; "), TYPE: P.map(x => x.t || "FD").join(" ; "), DECALAGE: P.map(x => x.o || 0).join(" ; ") }; });
  const details = [];
  (d.links || []).forEach(l => {
    (l.prd || []).forEach((x, i) => { const r = (d.prd || []).find(y => y.id === x.id); if (r) details.push({ _t: l.id, TYPE: "PRD", ARTICLE: "", DESIGNATION: U(r.des), UNITE: U(r.u), NBR: r.nbr ?? "", DIM1: r.d1 ?? "", DIM2: r.d2 ?? "", DIM3: r.d3 ?? "", QTE: x.q !== "" && x.q !== undefined ? x.q : (r.q ?? ""), PRIX: "", CLE: "", ORDRE: i + 1 }); });
    (l.chg || []).forEach((x, i) => { const r = (d.chg || []).find(y => y.id === x.id); if (r) details.push({ _t: l.id, TYPE: "CHG", ARTICLE: U(r.art), DESIGNATION: U(r.des), UNITE: U(r.u), QTE: x.q !== "" && x.q !== undefined ? x.q : (r.q ?? ""), PRIX: r.p ?? "", CLE: "", ORDRE: i + 1 }); });
  });
  const ET = { instance: "INSTANCE", fige: "FIGE", valide: "VALIDE" }[it.state || "instance"];
  return sviQ("v3Photo", { ref: it.ref, budget: { REF: it.ref, PROJET: U(it.project), INTITULE: U(it.intitule), ETAT: ET, CREE_LE: U(it.created), FIGE_LE: it.state === "fige" ? new Date().toISOString().slice(0, 10) : "", VALIDE_LE: U(it.validated), VERSION: (sviSyncMeta()[it.ref] || {}).rev || "", DATE_BUTOIR: U(d.dbut), DATE_OBJECTIF: U(d.dobj) }, des, taches, details });
};

/* v721 (bloc 7, point 1) : totaux de contrôle d'un budget — montants HT (désignations client, produits, charges) et sommes des quantités */
const sviSyncTotals = it => {
  const d = (it && it.data) || {}, n = v => Number(String(v ?? "").replace(/\s/g, "").replace(",", ".")) || 0, L = k => (d[k] || []).filter(r => r && !r.t);
  const ht = k => Math.round(L(k).reduce((t, r) => t + n(r.q) * n(r.p), 0) * 100) / 100, qt = k => Math.round(L(k).reduce((t, r) => t + n(r.q), 0) * 1000) / 1000;
  return { des: ht("des"), prd: ht("prd"), chg: ht("chg"), qdes: qt("des"), qprd: qt("prd"), qchg: qt("chg"), n: ["des", "prd", "chg", "lot", "prim", "sec", "links"].map(k => (d[k] || []).length).join("/") };
};
const SVI_TOT_LAB = { des: "MONTANT HT DES DÉSIGNATIONS", prd: "MONTANT HT DES PRODUITS", chg: "MONTANT HT DES CHARGES", qdes: "QUANTITÉS DES DÉSIGNATIONS", qprd: "QUANTITÉS DES PRODUITS", qchg: "QUANTITÉS DES CHARGES", n: "NOMBRE DE LIGNES" };
const sviSyncTotDiff = (a, b) => Object.keys(SVI_TOT_LAB).filter(k => String(a[k]) !== String(b[k]));
/* ---------- envoi ---------- */
const sviSyncPushOne = async (ref, M) => {
  const m = M[ref] || {}, user = sviUser();
  if (m.del) { await sviQ("v3Del", { ref }); delete M[ref]; return; }
  if (SVI_CLAIM) await SVI_CLAIM.catch(() => {});   /* v678 : réponse du verrou d'abord (annulation éventuelle) */
  const SH = ref[0] === "_";   /* v679 : donnée partagée */
  if (SH && SVI_BIG.ready) await SVI_BIG.ready;   /* v770 */
  let it = SH ? sviSharedItem(ref) : sviInstGet().find(x => x.ref === ref);
  if (!it) { delete M[ref]; return; }
  for (let tour = 0; tour < 3; tour++) {
    const txt = JSON.stringify(it);
    const r = await sviQ("v3Push", { ref, projet: it.project || "", etat: it.state || "instance", baseRev: m.rev || 0, user, ts: m.last || Date.now(), data: txt });
    if (r.conflict) {
      let theirs = null; try { theirs = JSON.parse(r.data); } catch (e) {}
      if (!theirs) throw new Error("BUDGET ILLISIBLE DANS LA BASE");
      let base = null; try { const bs = await sviSyncBase(ref); base = bs ? JSON.parse(bs) : null; } catch (e) {}
      const merged = /^_K:/.test(ref) ? { ...it, data: { v: sviShareMerge((it.data || {}).v, (theirs.data || {}).v, (m.last || 0) >= (r.ts || 0)) } }
        : sviMergeItem(base, it, theirs, (m.last || 0) >= (r.ts || 0), r.user || "", r.ts || 0);
      SVI_SYNC.applying = true;
      try { if (SH) { sviSharedPut(ref, merged); if (/^_K:/.test(ref)) sviShareApply(ref, merged); } else sviInstSet(sviInstGet().map(x => x.ref === ref ? merged : x)); } finally { SVI_SYNC.applying = false; }
      m.rev = r.rev; it = merged;
      const nc = ((merged.data || {}).conf || []).length;
      if (nc && typeof svToast === "function") svToast(ref + " : MODIFIÉ AUSSI PAR " + (r.user || "UN AUTRE") + " — FUSIONNÉ ; " + nc + " CONFLIT(S) À VOIR (⚠).", 6000);
      window.__sviSyncReopen && window.__sviSyncReopen(ref);
      continue;
    }
    m.rev = r.rev; m.dirty = 0; m.at = Date.now();
    await sviSyncBaseSet(ref, txt);
    /* contrôle de l'envoi : le budget relu dans la base a la même longueur que celui envoyé */
    let bad = r.len !== undefined && Number(r.len) !== txt.length ? "LONGUEUR RELUE " + r.len + " / " + txt.length : "";
    /* v721 : relecture du budget dans la base et comparaison des totaux (montants HT, quantités, lignes) */
    if (!bad && !SH) {
      try { const back = await sviQ("v3Pull", { ref }); let bi = null; try { bi = JSON.parse(back && back.data); } catch (e) {}
        if (!bi) bad = "BUDGET ILLISIBLE À LA RELECTURE";
        else { const D = sviSyncTotDiff(sviSyncTotals(it), sviSyncTotals(bi)); if (D.length) bad = "TOTAUX DIFFÉRENTS : " + D.map(k => SVI_TOT_LAB[k]).join(", "); } }
      catch (e) { /* relecture impossible (réseau) : contrôle refait au prochain envoi */ }
    }
    if (bad) {
      m.dirty = Date.now(); m.ctl = (m.ctl || 0) + 1; m.ctlWhy = bad;
      if (typeof svToast === "function") svToast(ref + " : CONTRÔLE DE L'ENVOI EN ÉCHEC (" + bad + ") — IL SERA RENVOYÉ.", 6000);
    } else { m.ctl = 0; m.ctlWhy = ""; }
    if ((it.state === "fige" || it.state === "valide") && m.pst !== it.state) { try { await sviSyncPhoto(it); m.pst = it.state; } catch (e) {} }
    if (it.state === "instance") m.pst = "";
    return;
  }
};
const sviSyncRun = async () => {
  if (SVI_SYNC.busy) { sviSyncSchedule(3000); return; }
  if (typeof apiPost !== "function" || !document.getElementById("sviTestTag")) return;   /* version test seulement */
  SVI_SYNC.busy = true; sviSyncPaint();
  const M = sviSyncMeta();
  try {
    if (!navigator.onLine) throw new Error("HORS LIGNE");
    for (const ref of Object.keys(M).filter(r => M[r].dirty)) { await sviSyncPushOne(ref, M); sviSyncMetaSet(M); }
    SVI_SYNC.status = "ok"; SVI_SYNC.err = ""; SVI_SYNC.last = Date.now();
  } catch (e) {
    const msg = String(e && e.message || e);
    SVI_SYNC.status = !navigator.onLine || /fetch|network|HORS LIGNE|Load failed/i.test(msg) ? "off" : /INCONNU|UNKNOWN|ACTION|v3Push/i.test(msg) ? "nob" : "err";
    SVI_SYNC.err = msg;
    sviSyncMetaSet(M);
    clearTimeout(SVI_SYNC.timer); SVI_SYNC.timer = setTimeout(sviSyncRun, 30000);
  } finally { SVI_SYNC.busy = false; sviSyncPaint(); }
};

/* ---------- réception : budgets modifiés ailleurs, verrous ---------- */
const sviSyncPull = async () => {
  if (SVI_BIG.ready) await SVI_BIG.ready;   /* v770 */
  if (typeof apiPost !== "function" || !document.getElementById("sviTestTag") || !navigator.onLine) return;
  let L;
  try { L = await sviQ("v3List", {}); } catch (e) { SVI_SYNC.status = /fetch|network|Load failed/i.test(String(e && e.message || e)) ? "off" : "nob"; SVI_SYNC.err = String(e && e.message || e); sviSyncPaint(); return; }
  const me = sviUser(), M = sviSyncMeta();
  SVI_SYNC.locks = {}; (L.locks || []).forEach(k => { if (k.user !== me) (SVI_SYNC.locks[k.ref] = SVI_SYNC.locks[k.ref] || []).push(k); });
  if (window.__sviLockRecheck) { try { window.__sviLockRecheck(); } catch (e) {} }
  let changed = false, first = 0;
  for (const s of L.list || []) {
    const m = M[s.ref] = M[s.ref] || {};
    if (s.rev <= (m.rev || 0) || m.dirty) continue;
    const p = await sviQ("v3Pull", { ref: s.ref }).catch(() => null);
    if (!p || p.missing) continue;
    let it = null; try { it = JSON.parse(p.data); } catch (e) {}
    if (!it) continue;
    SVI_SYNC.applying = true;
    try { if (s.ref[0] === "_") { sviSharedPut(s.ref, it); if (/^_K:/.test(s.ref)) { sviShareApply(s.ref, it); const mm = /^_K:svi_(docs|taf|obs)_v1:(.+)$/.exec(s.ref); if (mm && window.__sviOpenRef === mm[2] && window.__sviSyncReopen) setTimeout(() => window.__sviSyncReopen(mm[2]), 0); } if (window.__sviSharedChanged) { try { window.__sviSharedChanged(s.ref); } catch (e) {} } } else { const list = sviInstGet(); const i = list.findIndex(x => x.ref === s.ref); if (i >= 0) list[i] = it; else list.push(it); sviInstSet(list); } } finally { SVI_SYNC.applying = false; }
    m.rev = p.rev; m.at = Date.now(); await sviSyncBaseSet(s.ref, p.data); changed = true;
    if (window.__sviOpenRef === s.ref) { window.__sviSyncReopen && window.__sviSyncReopen(s.ref); if (typeof svToast === "function") svToast(s.ref + " : CHANGEMENTS DE " + (p.user || "UN AUTRE") + " REÇUS.", 4000); }
  }
  /* envoi initial : budgets de l'iPad absents de la base */
  const onSrv = new Set((L.list || []).map(x => x.ref));
  sviInstGet().forEach(x => { if (!onSrv.has(x.ref) && !(M[x.ref] || {}).rev) { const m = M[x.ref] = M[x.ref] || {}; if (!m.dirty) { m.dirty = Date.now(); m.last = m.last || Date.now(); first++; } } });
  sviSyncMetaSet(M);
  SVI_SYNC.status = SVI_SYNC.status === "nob" ? "ok" : SVI_SYNC.status || "ok";
  if (first && typeof svToast === "function") svToast("ENVOI INITIAL DANS LA BASE : " + first + " BUDGET(S) DE L'IPAD, AVEC CONTRÔLE.", 4000);
  if (first || sviSyncPending()) sviSyncSchedule(1500);
  if (changed && !window.__sviOpenRef && typeof renderBudgetList === "function") { try { renderBudgetList(); } catch (e) {} }
  sviSyncPaint();
};
/* verrou du budget ouvert (gardé tant qu'il est ouvert)
   v676 : VERROU PAR ZONE — la zone où l'utilisateur travaille (DÉSIGNATIONS CLIENT, LOTS, ACTIVITÉS PRIMAIRES,
   ACTIVITÉS SECONDAIRES, ou l'onglet du détail : DÉTAIL DÉLAIS…) est la seule en lecture seule pour les autres ;
   tout le reste du budget reste modifiable, et les envois se fusionnent (CONFLITS si la même case a changé des deux côtés).
   Un verrou sans zone (ancienne version de l'application) bloque encore tout le budget. */
const sviLockAll = ref => (SVI_SYNC.locks[ref] || []).filter(k => Date.now() - k.ts < 3 * 60 * 1000);
const SVI_ZONES = { client: "DÉSIGNATIONS CLIENT", lot: "LOTS", prim: "ACTIVITÉS PRIMAIRES", sec: "ACTIVITÉS SECONDAIRES" };
const sviZoneOf = el => {
  const C = window.__sviZoneCtx; if (!C || !el || !el.closest) return "";
  if (el.closest(".blk-client")) return SVI_ZONES.client;
  const h = el.closest(".ins-hcol[data-ik]"); if (h) return SVI_ZONES[h.dataset.ik] || "";
  if (el.closest("#bdgTabBody") || (el.closest("#bdgTabs") && !el.closest("[data-tab]"))) return C.tab();
  return "";
};
const sviZoneHeld = z => { const C = window.__sviZoneCtx; return z && C ? sviLockAll(C.ref).find(k => k.onglet === z) || null : null; };
const sviZonePaint = () => {
  const C = window.__sviZoneCtx; if (!C || !C.shell) return;
  const H = new Set(sviLockAll(C.ref).map(k => k.onglet)), t = [];
  Object.entries(SVI_ZONES).forEach(([k, v]) => { if (H.has(v)) t.push(k); });
  if (H.has(C.tab())) t.push("tab");
  C.shell.dataset.hz = t.join(" ");
};
let SVI_ZT = 0;
const sviZoneGuard = e => {
  const C = window.__sviZoneCtx; if (!C || !C.edit) return;
  const t = e.target, z = sviZoneOf(t); if (!z) return;
  /* toujours permis : changer d'onglet, agrandir, exporter, aperçu */
  if (t.closest("[data-tab], .bdg-d-tab, [data-act=max], [data-act=export], [data-act=pdf], .col-rs")) return;
  const k = sviZoneHeld(z);
  if (k) {
    e.stopPropagation(); e.stopImmediatePropagation();
    /* défilement permis : pas d'arrêt du toucher lui-même */
    if (!/^(pointerdown|mousedown|touchstart|pointermove|touchmove)$/.test(e.type)) e.preventDefault();
    if (e.type === "focusin" && t.blur) t.blur();
    if (/^(click|focusin)$/.test(e.type) && Date.now() - SVI_ZT > 2500 && typeof svToast === "function") { SVI_ZT = Date.now(); svToast("« " + z + " » EN LECTURE SEULE : " + k.user + " LE MODIFIE. LE RESTE DU BUDGET RESTE MODIFIABLE.", 4000); }
    return;
  }
  /* ma zone de travail : verrou pris dès le premier toucher */
  if (/^(pointerdown|focusin|keydown)$/.test(e.type) && window.__sviOpenTab !== z) { window.__sviOpenTab = z; sviLockKeep(true); }
};
["pointerdown", "mousedown", "touchstart", "click", "dblclick", "focusin", "keydown", "beforeinput", "input", "change", "dragstart", "contextmenu"].forEach(ev => document.addEventListener(ev, sviZoneGuard, true));
/* v678 : zone prise par un autre AVANT moi (décalage de quelques secondes) : tout ce que j'y ai fait depuis mon entrée
   dans la zone est annulé (retour à l'état du budget à cet instant) ; l'envoi à la base attend la réponse du verrou. */
let SVI_CLAIM = null;
const sviLockKeep = claim => {
  const r = window.__sviOpenRef, tab = window.__sviOpenTab || "";
  if (!r || !tab || !window.__sviOpenEdit || !navigator.onLine) return;
  const C = window.__sviZoneCtx, snap = claim && C && C.snap ? { at: Date.now(), s: C.snap() } : null;
  const p = sviQ("v3Lock", { ref: r, user: sviUser(), onglet: tab }).then(x => {
    /* l'autre a pris cette zone juste avant moi : elle passe en lecture seule */
    if (x && x.held && window.__sviOpenRef === r && (!x.held.onglet || x.held.onglet === tab)) {
      const L = SVI_SYNC.locks[r] = (SVI_SYNC.locks[r] || []).filter(k => k.user !== x.held.user); L.push({ ref: r, ...x.held });
      if (window.__sviOpenTab === tab) window.__sviOpenTab = "";
      sviZonePaint();
      const Z = window.__sviZoneCtx;
      if (snap && Z && Z.ref === r && Z.snap() !== snap.s) {
        Z.restore(snap.s, tab + " — ZONE PRISE PAR " + x.held.user + " À " + new Date(x.held.ts).toLocaleTimeString("fr-FR"));
        const hm = t => new Date(t).toLocaleTimeString("fr-FR");
        if (typeof svToast === "function") svToast("« " + tab + " » : " + x.held.user + " Y TRAVAILLAIT DEPUIS " + hm(x.held.ts) + ". TES MODIFICATIONS FAITES DEPUIS " + hm(snap.at) + " SONT ANNULÉES.", 8000);
      }
    }
  }).catch(() => {});
  if (claim) { SVI_CLAIM = p; p.then(() => { if (SVI_CLAIM === p) SVI_CLAIM = null; }); }
};
const sviLockOpen = (ref, edit) => { window.__sviOpenRef = ref; window.__sviOpenEdit = !!edit; window.__sviOpenTab = ""; };
const sviLockClose = () => {
  const r = window.__sviOpenRef; if (r && window.__sviOpenEdit) sviQ("v3Unlock", { ref: r, user: sviUser() }).catch(() => {});
  const C = window.__sviZoneCtx; if (C && C.shell) delete C.shell.dataset.hz;
  window.__sviOpenRef = null; window.__sviOpenEdit = false; window.__sviOpenTab = ""; window.__sviLockRecheck = null; window.__sviZoneCtx = null;
};

/* ---------- repère et fenêtre BASE ---------- */
const sviSyncPaint = () => {
  if (!document.body) return;
  const tag = document.getElementById("sviTestTag"); if (!tag) return;
  let b = document.getElementById("sviSync");
  if (!b) { b = document.createElement("button"); b.type = "button"; b.id = "sviSync"; b.addEventListener("click", sviSyncWin); document.body.appendChild(b); }
  const n = sviSyncPending(), st = SVI_SYNC.status;
  const t = SVI_SYNC.busy ? "ENVOI À LA BASE…" : st === "off" ? "HORS LIGNE" + (n ? " — " + n + " EN ATTENTE" : "") : st === "nob" ? "BASE NON BRANCHÉE" + (n ? " — " + n + " EN ATTENTE" : "") : st === "err" ? "ENVOI EN ÉCHEC — " + n + " EN ATTENTE" : n ? n + " EN ATTENTE" : st === "ok" ? "BASE À JOUR" : "BASE…";
  b.textContent = t;
  b.className = SVI_SYNC.busy ? "sync-busy" : st === "off" || st === "nob" || st === "err" ? "sync-off" : n ? "sync-wait" : "sync-ok";
  /* v721 : échec répété du contrôle par les totaux = signal sur le repère */
  { const M = sviSyncMeta(); if (Object.keys(M).some(r => (M[r].ctl || 0) >= 2)) { b.textContent = "⚠ " + b.textContent; b.className = "sync-off"; } }
};
function sviSyncWin() {
  const d = sviWinNew(), M = sviSyncMeta(), L = sviInstGet();
  const fdt = t => t ? new Date(t).toLocaleString("fr-FR").toUpperCase() : "—";
  d.innerHTML = sviWinCard({ cls: "pv-card", close: "data-x", title: "ENREGISTREMENT DANS LA BASE V3",
    body: `<label class="pv-r"><span>NOM D'UTILISATEUR</span><input class="pv-in sy-user" value="${esc(sviUser())}" style="width:200px;text-align:left"></label>
      <div class="pv-sub">${SVI_SYNC.status === "nob" ? "LA BASE NE CONNAÎT PAS ENCORE L'ENREGISTREMENT : INSTALLER LE FICHIER baseV3sync.gs DANS APPS SCRIPT (VOIR SON EN-TÊTE). EN ATTENDANT, TOUT RESTE SUR L'IPAD." : SVI_SYNC.status === "off" ? "HORS LIGNE : TOUT RESTE SUR L'IPAD ET PARTIRA AU RETOUR DE LA CONNEXION." : SVI_SYNC.err ? esc(SVI_SYNC.err) : "DERNIER ENVOI : " + fdt(SVI_SYNC.last)}</div>
      ${(() => { const B = Object.keys(M).filter(r => (M[r].ctl || 0) >= 2); return B.length ? `<div class="pv-sub sy-ctl">⚠ CONTRÔLE DE L'ENVOI EN ÉCHEC PLUSIEURS FOIS : ${B.map(r => esc(r) + " (" + esc(M[r].ctlWhy || "") + ", " + M[r].ctl + " ESSAIS)").join(" ; ")}.</div>` : ""; })()}
      <div class="fz-blk">BUDGETS DE L'IPAD ${svCnt(L.length)}</div>
      <table class="pv-t"><thead><tr><th>BUDGET</th><th>VERSION</th><th>ÉTAT</th><th>ENVOYÉ LE</th></tr></thead><tbody>${L.map(x => { const m = M[x.ref] || {}, lk = sviLockAll(x.ref).map(k => k.user + (k.onglet ? " (" + k.onglet + ")" : "")).join(", "); return `<tr><td>${esc((x.project || "") + " " + x.ref)}</td><td class="number">${m.rev || "—"}</td><td>${m.dirty ? "EN ATTENTE" : m.rev ? "À JOUR" : "JAMAIS ENVOYÉ"}${lk ? " · OUVERT PAR " + esc(lk) : ""}${((x.data || {}).conf || []).length ? " · " + x.data.conf.length + " CONFLIT(S)" : ""}</td><td>${fdt(m.at)}</td></tr>`; }).join("")}</tbody></table>
      <div class="pv-sub sy-cells"></div>`,
    foot: `<button type="button" class="svc-b" data-x>FERMER</button><button type="button" class="svc-b svc-ok svc-neutral" data-go>ENVOYER MAINTENANT</button>` });
  sviWinShow(d);
  if (navigator.onLine) sviQ("v3Stats", {}).then(s => { const e = d.querySelector(".sy-cells"); if (e && s && s.cells) e.textContent = "TAILLE DU FICHIER : " + s.cells.toLocaleString("fr-FR") + " CELLULES SUR 10 000 000 (" + Math.round(s.cells / s.limit * 1000) / 10 + " %)" + (s.cells > 8e6 ? " — ATTENTION, PROCHE DE LA LIMITE DE GOOGLE SHEETS." : "."); }).catch(() => {});
  d.addEventListener("click", e => {
    if (e.target === d || e.target.closest("[data-x]")) { const v = d.querySelector(".sy-user").value.trim().toUpperCase(); if (v) try { localStorage.setItem(SVI_USER_KEY, v); } catch (er) {} d.remove(); return; }
    if (e.target.closest("[data-go]")) { const v = d.querySelector(".sy-user").value.trim().toUpperCase(); if (v) try { localStorage.setItem(SVI_USER_KEY, v); } catch (er) {} d.remove(); sviSyncPull().then(() => sviSyncRun()); }
  });
}
/* nom d'utilisateur demandé à l'ouverture de l'application */
const sviUserAsk = () => {
  if (sviUser() || !document.getElementById("sviTestTag")) return;
  const d = sviWinNew();
  d.innerHTML = sviWinCard({ title: "NOM D'UTILISATEUR", close: "", body: `<div class="pv-sub">IL SIGNE VOS MODIFICATIONS (HISTORIQUE, BASE V3, VERROUS).</div><input class="pv-in sy-user" style="width:100%;text-align:left" placeholder="EX. AHMED" autocomplete="off">`,
    foot: `<button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button>` });
  sviWinShow(d);
  const i = d.querySelector(".sy-user"); setTimeout(() => i.focus(), 60);
  const ok = () => { const v = i.value.trim().toUpperCase(); if (!v) { i.classList.add("bad"); return; } try { localStorage.setItem(SVI_USER_KEY, v); } catch (e) {} d.remove(); sviSyncPull(); };
  d.addEventListener("click", e => { if (e.target.closest("[data-ok]")) ok(); });
  i.addEventListener("keydown", e => { if (e.key === "Enter") ok(); });
};
if (typeof window !== "undefined" && !window.__sviSyncBoot) {
  window.__sviSyncBoot = true;
  SVI_INST_READY.then(() => setTimeout(() => { sviSyncPaint(); sviUserAsk(); sviShareSeed(); if (sviUser()) sviSyncPull(); }, 1200));
  window.addEventListener("online", () => { sviSyncPull().then(() => sviSyncRun()); });
  window.addEventListener("offline", () => { SVI_SYNC.status = "off"; sviSyncPaint(); });
  setInterval(() => { if (document.visibilityState === "visible") { sviLockKeep(); if (!sviSyncPending()) sviSyncPull(); } }, 60000);
  document.addEventListener("visibilitychange", () => { if (document.hidden && sviSyncPending()) sviSyncRun(); });
}
/* ⟪ src/03-api-drive.js ⟫ */
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

  /* réponse illisible (page d'erreur Google au lieu de JSON) : on montre la raison */
  const txt = await r.text();
  let data;
  try { data = JSON.parse(txt); }
  catch (e) {
    const m = txt.match(/<title>([^<]*)<\/title>/i);
    const body = txt.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    throw new Error("RÉPONSE NON JSON (HTTP " + r.status + ") : " +
      ((m && m[1].trim()) ? m[1].trim() + " — " : "") + body.slice(0, 200));
  }

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

async function apiPost(action, data = {}, opt = {}) {
  const r = await fetch(API_URL, {
    method: "POST",
    sviQuiet: !!opt.quiet,   /* v677 : arrière-plan, sans fenêtre de chargement */
    body: JSON.stringify({
      key: API_KEY,
      action,
      ...data
    })
  });

  /* réponse illisible (page d'erreur Google au lieu de JSON) : on montre la raison */
  const txt = await r.text();
  let out;
  try { out = JSON.parse(txt); }
  catch (e) {
    const m = txt.match(/<title>([^<]*)<\/title>/i);
    const body = txt.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    throw new Error("RÉPONSE NON JSON (HTTP " + r.status + ") : " +
      ((m && m[1].trim()) ? m[1].trim() + " — " : "") + body.slice(0, 160));
  }

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
  /* feuille Google : ouverte directement (l'app Sheets, si elle est là, la reprend) */
  if (/docs\.google\.com\/spreadsheets/.test(url)) {
    if (w) w.location.href = url; else window.open(url, "_blank");
    return;
  }
  const app = "googledrive://";
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
    sviAlert("OUVERTURE DU DOSSIER IMPOSSIBLE : " + driveErrText(e));
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

/* ⟪ src/05-navigation.js ⟫ */
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
          if (window.__sviViewSave) window.__sviViewSave();
          setTimeout(() => window.__sviViewRestore && window.__sviViewRestore("view:" + (btn.dataset.view || "")), 0);

          const view =
            $(btn.dataset.view);

          if (view) {
            view.classList.add(
              "active-view"
            );
          }

          $("pageSubtitle").textContent =
            btn.dataset.view === "home"
              ? "VERSION 2 — ACCUEIL"
              : btn.dataset.view === "chs"
              ? "VERSION 2 — PARAMÉTRAGE"
              : btn.dataset.view === "ach"
                ? "VERSION 2 — ACHATS"
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

/* ⟪ src/09-budget-outils.js ⟫ */
/* =========================================================
   OUTILS DU BUDGET SORTIS DU GRAND BLOC (refonte, étape 10, v646)
   Fonctions et constantes sans état, qui ne dépendaient d'aucune variable du budget ouvert (openBudgetDetail) :
   elles sont ici, hors du bloc, à un seul endroit ; le bloc les utilise comme avant. Choisies automatiquement
   (analyse du code : aucune variable du budget ouvert, aucun état gardé) ; texte inchangé.
   ========================================================= */
/* — de src/11-budget-ouverture.js — */
const nk = s =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
/* — de src/11-budget-ouverture.js — */
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
/* — de src/11-budget-ouverture.js — */
const colIndex = letter =>
  letter
    .toUpperCase()
    .split("")
    .reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
/* — de src/11-budget-ouverture.js — */
const byLetter = (row, letter) =>
  row.__cols
    ? normalise(row.__cols[colIndex(letter)])
    : "";
/* — de src/11-budget-ouverture.js — */
const gidOf = l =>
  (l.kind === "chg"
    ? [l.kind, l.detail, l.dunit]
    : [l.kind, l.id])
    .map(v => String(v ?? "").trim().toUpperCase())
    .join("|");
/* — de src/11-budget-ouverture.js — */
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
/* — de src/11-budget-ouverture.js — */
const desigKey = l => l.article + "||" + l.designation;
/* — de src/11-budget-ouverture.js — */
const inSet = (set, v) => !set.size || set.has(v);
/* — de src/12-tableaux-colonnes.js — */
const cfText = v =>
  typeof v === "number" ? money(v) : String(v ?? "").trim();
/* — de src/12-tableaux-colonnes.js — */
const cfIcon =
  `<svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
     <path d="M1 2h11M3 5h7M5 8h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
     <path d="M4.5 10l2 2.2 2-2.2z" fill="currentColor"/>
   </svg>`;
/* — de src/12-tableaux-colonnes.js — */
/* ===== largeurs de colonnes : fixes, réglables, mémorisées ===== */
const CW_KEY = "svi_colw_v1";
/* — de src/12-tableaux-colonnes.js — */
const cwLoad = () => {
  try { return JSON.parse(localStorage.getItem(CW_KEY) || "{}") || {}; }
  catch (e) { return {}; }
};
/* — de src/12-tableaux-colonnes.js — */
const cwSave = obj => {
  try { localStorage.setItem(CW_KEY, JSON.stringify(obj)); } catch (e) {}
};
/* — de src/12-tableaux-colonnes.js — */
const SVI_COL = {
  article: { w: 70, pw: 5 }, designation: { w: 330 }, detail: { w: 300, pw: 30 }, unit: { w: 70, pw: 5 },
  qty: { w: 100, pw: 9 }, price: { w: 95, pw: 9 }, ht: { w: 120 }, amount: { w: 120, pw: 11 }, tva: { w: 80, pw: 6, f: "pct" }, ttc: { w: 130, pw: 11 },
  nbr: { w: 60, pw: 5 }, d1: { w: 60, pw: 5 }, d2: { w: 60, pw: 5 }, d3: { w: 60, pw: 5 }, pct: { f: "pct" },
  /* historique */
  hdt: { pw: 14 }, hbr: { pw: 8 }, hac: { pw: 12 }, hde: { pw: 40 },
  /* DOCUMENTS / TAF / OBSERVATIONS */
  rref: { w: 210, pw: 22 }, rdate: { w: 150 }, rtitle: { w: 360, pw: 60 }, rfile: { w: 120 }, rexp: { w: 110, pw: 8 }, robj: { w: 200, pw: 15 }, rtext: { w: 420, pw: 30 },
  rresp: { w: 180, pw: 13 }, rprev: { w: 140, pw: 12 }, rdelay: { w: 150, pw: 9 }, relap: { w: 150, pw: 9 }, rimp: { w: 60, pw: 4 },
  /* v685 : blocs SCÉNARIOS et VERSIONS */
  scnind: { w: 300, pw: 30 }, scnom: { w: 260, pw: 30 }, scet: { w: 150, pw: 14 }, scof: { w: 150, pw: 12 }, scret: { w: 120, pw: 10 }, scdes: { w: 140, pw: 12 }, scdel: { w: 56, pw: 4 }, vno: { w: 160, pw: 12 }, rno: { w: 120, pw: 10 }, rcdate: { w: 200, pw: 16 }, ruser: { w: 160, pw: 12 }, rstate: { w: 140, pw: 12 }, rsav: { w: 200, pw: 16 }, vkind: { w: 200, pw: 16 }, vdate: { w: 200, pw: 16 }, vuser: { w: 160, pw: 12 }, ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => ["sc" + (i + 1), { w: 180, pw: 12 }]))
};
/* — de src/12-tableaux-colonnes.js — */
const SVI_COL_T = {
  "client.article": 69, "client.designation": 660, "client.unit": 70, "client.qty": 71, "client.price": 86, "client.ht": 96, "client.tva": 81, "client.ttc": 97,
  "chg.article": 69, "chg.detail": 300, "chg.rdb": 110, "chg.pct": 58, "chg.tache": 246, "chg.unit": 70, "chg.qty": 84, "chg.price": 84, "chg.amount": 92, "chg.tva": 80, "chg.ttc": 94,
  "prd.detail": 176, "prd.tache": 246, "prd.unit": 70, "prd.nbr": 77, "prd.d1": 79, "prd.d2": 79, "prd.d3": 79, "prd.qty": 72, "prd.price": 72, "prd.amount": 92, "prd.tva": 82, "prd.ttc": 109
};
/* — de src/12-tableaux-colonnes.js — */
const colPw = k => (SVI_COL[k] && SVI_COL[k].pw) || 10;
/* — de src/12-tableaux-colonnes.js — */
/* valeur d'une case pour un aperçu ou un export lisible : % pour les colonnes « pct », nombres au format 1 234,56 */
const colFmt = (k, v) => (SVI_COL[k] && SVI_COL[k].f === "pct") && (k === "tva" || (v !== "" && v !== null && v !== undefined)) ? money(Number(v) || 0) + " %" : typeof v === "number" ? money(v) : String(v ?? "");
/* — de src/12-tableaux-colonnes.js — */
const cwGet = (t, k) => { const u = cwLoad()[t + "." + k]; return u ? Math.max(64, u) : SVI_COL_T[t + "." + k] || (SVI_COL[k] && SVI_COL[k].w) || 100; };   /* v788 : jamais plus étroite que son nom (et sa loupe) */
/* — de src/12-tableaux-colonnes.js — */
/* colgroup + largeur totale de la table */
const cwCols = (t, cols) =>
  cols.map(([k]) =>
    `<col data-w="${t}.${k}" style="width:${cwGet(t, k)}px">`
  ).join("");
/* — de src/12-tableaux-colonnes.js — */
const cwTableW = (t, cols) =>
  cols.reduce((sum, [k]) => sum + cwGet(t, k), 0);
/* — de src/12-tableaux-colonnes.js — */
/* ===== ordre des colonnes : glisser un en-tête, ordre mémorisé ===== */
const CO_KEY = "svi_colorder_v1";
/* — de src/12-tableaux-colonnes.js — */
const coLoad = () => {
  try { return JSON.parse(localStorage.getItem(CO_KEY) || "{}") || {}; }
  catch (e) { return {}; }
};
/* — de src/12-tableaux-colonnes.js — */
const coSave = obj => {
  try { localStorage.setItem(CO_KEY, JSON.stringify(obj)); } catch (e) {}
};
/* — de src/12-tableaux-colonnes.js — */
/* clés dans l'ordre choisi (colonnes inconnues gardées à la fin) */
const coKeys = (t, keys) => {
  const saved = (coLoad()[t] || []).filter(k => keys.includes(k));
  return [...saved, ...keys.filter(k => !saved.includes(k))];
};
/* — de src/12-tableaux-colonnes.js — */
const coOrder = (t, cols) => {
  const order = coKeys(t, cols.map(c => c[0]));
  return order.map(k => cols.find(c => c[0] === k));
};
/* — de src/12-tableaux-colonnes.js — */
/* FORMAT 102 : ordre des colonnes tel qu'affiché à l'écran (après glissement) — copies, exports, aperçus */
const screenCols = (table, cols) => {
  if (!table || !cols) return cols;
  const keys = [...table.querySelectorAll("thead tr:first-child > th:not(.svi-colh) .cf-btn[data-col]")].map(b => b.dataset.col);
  const out = keys.map(k => cols.find(c => c[0] === k)).filter(Boolean);
  return out.length ? out : cols;   /* v786 : colonnes masquées exclues (aperçu, export, copie suivent l'écran) */
};
/* — de src/12-tableaux-colonnes.js — */
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
/* — de src/12-tableaux-colonnes.js — */
const cfKind = vals => {
  const v = vals.filter(x => String(x).trim() !== "");
  if (!v.length) return "";
  if (v.every(x => /^-?[\d\s\u00a0\u202f]+(,\d+)?( ?%)?$/.test(String(x).trim()))) return "num";
  if (v.every(x => /^\d{2}\/\d{2}\/\d{4}(\s+(À\s+)?\d{1,2}:\d{2})?$/.test(String(x).trim()) || /^\d{4}-\d{2}-\d{2}$/.test(String(x).trim()))) return "date";   /* v750 : heure acceptée */
  return "txt";   /* v622 : texte — contient, ne contient pas, commence par, se termine par, égal à */
};
/* — de src/12-tableaux-colonnes.js — */
const cfNum = x => num(String(x).replace(/%/g, ""));
/* — de src/12-tableaux-colonnes.js — */
const cfCondOk = (c, v) => {
  if (!c) return true;
  if (c.kind === "txt") {
    const x = U_(String(v || "")), a = U_(String(c.a || ""));
    switch (c.op) { case "ct": return x.includes(a); case "nc": return !x.includes(a); case "sw": return x.startsWith(a); case "ew": return x.endsWith(a); case "eq": return x === a; case "ne": return x !== a; default: return true; }
  }
  if (String(v).trim() === "") return false;
  const x = c.kind === "num" ? cfNum(v) : cfDate(v);
  if (c.kind === "date" && !x) return false;
  const a = c.a, b = c.b;
  switch (c.op) {
    case "eq": return x === a;
    case "ne": return x !== a;
    case "gt": return x > a;
    case "ge": return x >= a;
    case "lt": return x < a;
    case "le": return x <= a;
    case "bt": { const lo = a < b ? a : b, hi = a < b ? b : a; return x >= lo && x <= hi; }
    default: return true;
  }
};
/* — de src/13-instance-saisie.js — */
const U_ = v => String(v ?? "").trim().toUpperCase();
/* — de src/13-instance-saisie.js — */
const insNum = v => {
  const s = String(v ?? "").trim();
  return s === "" ? "" : num(s);
};
/* — de src/13-instance-saisie.js — */
const insFmt = v => (v === "" || v === null || v === undefined) ? "" : (typeof v === "string" && /[A-Z]/i.test(v) && !/^[\d\s.,+-]+$/.test(v)) ? v : money(v);
/* — de src/13-instance-saisie.js — */
/* niveau d'un titre d'après sa numérotation : I = 1, I.1 = 2, I.1.1 = 3 */
const insLevel = art => Math.min(3, String(art || "").split(".").filter(x => x.trim() !== "").length || 1);
/* — de src/13-instance-saisie.js — */
const dOf = r => Number(r && r.d) || 0;
/* — de src/13-instance-saisie.js — */
const artIncr = a => { const m = /^(.*?)(\d+)(\D*)$/.exec(String(a)); return m ? m[1] + (Number(m[2]) + 1) + m[3] : String(a) + ".1"; };
/* — de src/13-instance-saisie.js — */
const artAutoOf = list => {
  const out = new Map(), last = [], tnum = [];
  (list || []).forEach(r => {
    const d = Number(r && r.d) || 0;
    last.length = d + 1; tnum.length = d + 1;
    const own = String(r.art ?? "").trim();
    const n = own || (last[d] !== undefined ? artIncr(last[d]) : d === 0 ? "1" : (tnum[d - 1] || "1") + ".1");
    last[d] = n;
    if (!own) out.set(r.id, n);
    if (r.t) { tnum[d] = n; last[d + 1] = undefined; }
  });
  return out;
};
/* — de src/13-instance-saisie.js — */
/* v902 (principe du 03/11/2026 : erreur refusée dès la saisie) : règle des dates du budget, la même pour INF et PARAMÉTRAGE › DATES DU BUDGET —
   DATE OBJECTIF entre le début du projet et la date butoir ; DATE BUTOIR ni avant le début du projet, ni avant la date objectif. f = case changée */
const sviBdgDateWhy = (f, deb, obj, but) => {
  if (f === "obj" && obj && ((deb && obj < deb) || (but && obj > but))) return "DATE OBJECTIF REFUSÉE : ENTRE LE DÉBUT DU PROJET ET LA DATE BUTOIR.";
  if (f === "but" && but && ((deb && but < deb) || (obj && but < obj))) return "DATE BUTOIR REFUSÉE : ELLE NE PEUT ÊTRE NI AVANT LE DÉBUT DU PROJET, NI AVANT LA DATE OBJECTIF.";
  return "";
};
/* v913 (checklist C1.51, décisions du 03/11/2026) : GPS DU CHANTIER (INF) et DÉPÔT DU FOURNISSEUR → distance à vol d'oiseau ;
   coût du transport = distance × PRIX DU TRANSPORT AU KM (PARAMÉTRAGE › BUDGET › TRANSPORT, le même pour tous) */
const sviGpsParse = s => { const m = String(s ?? "").trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/); if (!m) return null; const a = +m[1], b = +m[2]; return Math.abs(a) <= 90 && Math.abs(b) <= 180 ? [a, b] : null; };
const sviGpsKm = (p, q) => { const r = x => x * Math.PI / 180, dA = r(q[0] - p[0]), dB = r(q[1] - p[1]);
  const h = Math.sin(dA / 2) ** 2 + Math.cos(r(p[0])) * Math.cos(r(q[0])) * Math.sin(dB / 2) ** 2; return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h))); };
const SVI_TRKM_KEY = "svi_transport_km_v1";
const sviTrKm = () => { try { const s = localStorage.getItem(SVI_TRKM_KEY); return s === null || String(s).trim() === "" ? null : num(s); } catch (e) { return null; } };
const sviTrKmSave = v => { try { localStorage.setItem(SVI_TRKM_KEY, v === null || v === undefined ? "" : String(v)); } catch (e) {} };
const insTVA = r => sviTvaOf(r.tva) ?? 0;   /* v899 : TVA PAR DÉFAUT (PARAMÉTRAGE), plus de 20 % écrit ici */
/* — de src/13-instance-saisie.js — */
const INS_TRASH = `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
/* — de src/13-instance-saisie.js — */
/* v530 : chiffre d'une pastille (à moitié remplie : blanc sur la partie colorée, couleur sur la partie blanche) */
const pstNum = n => `<b class="pst-n">${n}</b>`;
/* — de src/13-instance-saisie.js — */
/* case à droite : elle coche seulement (suppression, export, aperçu passent par le menu ⋯ du bloc) */
const insDelCell = r => !r ? "" : `<input type="checkbox" class="ins-cb${r.t ? " ins-tcb" : ""}" ${!r.t && r.on === true ? "checked" : ""}>`;
/* — de src/13-instance-saisie.js — */
const insQCol = k => false;   /* plus de colonne QUANTITÉ DE LA TÂCHE : la quantité liée est la QPB du produit */
/* — de src/13-instance-saisie.js — */
const insCfT = k => k === "des" ? "client" : k;
/* — de src/13-instance-saisie.js — */
/* suite d'affichage : titres, lignes et sous-totaux (écran et aperçu) */
const insOrder = rows => {
  const out = [], stack = [];
  rows.forEach(r => {
    while (stack.length && dOf(stack[stack.length - 1]) >= dOf(r)) out.push({ sub: stack.pop() });
    out.push({ r, lvl: dOf(r) });
    if (r.t) stack.push(r);
  });
  while (stack.length) out.push({ sub: stack.pop() });
  return out;
};
/* — de src/13-instance-saisie.js — */
/* ===== titres repliables (FORMAT 60) : › replié / ⌄ déplié ; état mémorisé par budget ===== */
const FOLD_KEY = "svi_fold_v1";
/* — de src/13-instance-saisie.js — */
const foldAll = () => { try { return JSON.parse(localStorage.getItem(FOLD_KEY) || "{}") || {}; } catch (e) { return {}; } };
/* — de src/13-instance-saisie.js — */
/* v510 (remarque 68) : état d'une branche pour la couleur de son signe ou de sa pastille */
const sviFoldState = (red, blue) => red && blue ? " fs-vio" : red ? " fs-red" : blue ? " fs-blu" : "";
/* — de src/13-instance-saisie.js — */
/* grands tableaux (détail produits / charges) : lignes dessinées par paquets, au fil du défilement (rapidité) */
const INS_CHUNK = 120;
/* — de src/13-instance-saisie.js — */
/* v512 (remarque 76) : titres de charges regroupées PLIÉS à la première ouverture ; ceux qu'on déplie sont mémorisés (par budget) */
const CHG_GK = "svi_chggopen_v1";
/* — de src/13-instance-saisie.js — */
const fsMark = s => (s.mark || s.on)();
/* — de src/13-instance-saisie.js — */
/* loupes (filtres de colonne) : tableau → bloc de EFFACER et onglet */
const FS_CF = () => [["client", "client", ""], ["lot", "hier", ""], ["prim", "hier", ""], ["sec", "hier", ""],
  [insCfT("chg"), "detail", "chg"], [insCfT("prd"), "detail", "prd"], ["dly", "detail", "dly"], ["dlyp", "detail", "dly"], ["dlyr", "detail", ""],
  ["dlyi", "detail", ""], ["dlys", "detail", "dly"], ["lk_marge", "detail", "lnk"], ["lk_unl", "detail", "unl"], ["lk_inc", "detail", "inc"]];
/* — de src/13-instance-saisie.js — */
const clientTaFit = root => (root || document).querySelectorAll("textarea.ins-ta").forEach(t => {
  t.style.height = "0px"; t.style.height = Math.max(20, t.scrollHeight) + "px";
});
/* — de src/13-instance-saisie.js — */
const clientFit = () => {
  const sc = document.querySelector(".bdg-d-client-scroll"), cg = $("bdgClientCols");
  if (!sc || !cg) return;
  const tbl = sc.querySelector("table"), dc = cg.querySelector('col[data-w="client.designation"]');
  if (!sc.__ro && window.ResizeObserver) {
    let raf = 0; const run = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(clientFit); };
    sc.__ro = new ResizeObserver(run); sc.__ro.observe(sc);
    const body = $("bdgClientBody"); if (body) new MutationObserver(run).observe(body, { childList: true, subtree: true });
  }
  if (tbl && dc && !cwLoad()["client.designation"] && sc.clientWidth > 300) {
    const cols = [...cg.querySelectorAll("col")];
    const others = cols.filter(c => c !== dc).reduce((t, c) => t + (parseFloat(c.style.width) || 0), 0);
    const pr = parseFloat(getComputedStyle(sc).paddingRight) || 0;   /* FORMAT 134 : 9 px jusqu'au bord droit */
    const nd = Math.max(160, Math.min(cwGet("client", "designation"), Math.floor(sc.clientWidth - pr - others)));
    if (parseFloat(dc.style.width) !== nd) dc.style.width = nd + "px";
    const tw = others + nd + "px";
    if (tbl.style.width !== tw) tbl.style.width = tw;
  }
  /* version validée / figée : cellule DÉSIGNATION à la ligne */
  if (tbl && dc && !tbl.classList.contains("ins-table")) {
    const idx = [...cg.querySelectorAll("col")].indexOf(dc);
    tbl.querySelectorAll("tbody tr").forEach(tr => { const td = tr.children[idx]; if (td && td.colSpan <= 1) td.classList.add("c-wrap"); });
  }
  clientTaFit(sc);
};
/* — de src/13-instance-saisie.js — */
/* mode SAISIE : la case sert à choisir des lignes (plus de grisé des autres) ; le choix unique est en mode LIAISONS */
const insDim = () => {};
/* — de src/13-instance-saisie.js — */
/* ===== LOTS en arborescence (« / ») dans le bloc TÂCHES : niveaux repliables › / ⌄, nom du dernier niveau ===== */
const lotSegs = r => String(r && r.v || "").split("/").map(x => x.trim()).filter(Boolean);
/* — de src/13-instance-saisie.js — */
/* v527 (remarque 3) : « GROUPE » au lieu de « NIVEAU » (anciens noms « NIVEAU n » reconnus et affichés « GROUPE n ») */
const LVL_AUTO = /^(NOUVEAU )?(NIVEAU|GROUPE) \d+(\.\d+)*$/i;
/* — de src/13-instance-saisie.js — */
const lotAutoNo = g => { const m = String(g || "").trim().match(/^(?:NOUVEAU )?(?:NIVEAU|GROUPE) (\d+(?:\.\d+)*)$/i); return m ? m[1] : ""; };
/* — de src/13-instance-saisie.js — */
const lotNoHTML = L => !L.no ? "" : `<span class="lvl-no">${esc(L.no)}</span>`;
/* — de src/13-instance-saisie.js — */
const lotUnder = (r, P) => { const s2 = lotSegs(r); return s2.length >= P.length && P.every((g, i) => U_(g) === U_(s2[i])); };
/* — de src/13-instance-saisie.js — */
/* v529 : lots rangés dans l'ordre de l'arborescence affichée (un niveau prend la place de son premier lot) */
const lotTreeOrder = arr => {
  const first = new Map();
  arr.forEach((r, i) => { const s2 = lotSegs(r); for (let j = 1; j <= s2.length; j++) { const p = U_(s2.slice(0, j).join(" / ")); if (!first.has(p)) first.set(p, i); } });
  const key = r => { const s2 = lotSegs(r); return s2.map((_, j) => first.get(U_(s2.slice(0, j + 1).join(" / ")))); };
  const K = new Map(arr.map(r => [r, key(r)]));
  const pos = new Map(arr.map((r, i) => [r, i]));
  return arr.slice().sort((a, b) => {
    const A = K.get(a), B = K.get(b);
    for (let i = 0; i < Math.min(A.length, B.length); i++) if (A[i] !== B[i]) return A[i] - B[i];
    return A.length - B.length || pos.get(a) - pos.get(b);
  });
};
/* — de src/13-instance-saisie.js — */
/* v533 : la case du nom tapé est suivie à la frappe (même si elle a perdu le focus, iPad) */
const GN_SEL = "input.lot-gname, input.dly-nm:not(.dly-gin)";
/* — de src/14-doublons-classement.js — */
const dupName = (k, r) => (k === "lot" || k === "prim" || k === "sec" || k === "qlt") ? U_(r.v) : [r.art, r.des].filter(Boolean).join(" — ") + (r.u ? " (" + U_(r.u) + ")" : "");
/* — de src/14-doublons-classement.js — */
const natCmp = (a, b) => String(a ?? "").localeCompare(String(b ?? ""), "fr", { numeric: true, sensitivity: "base" });
/* — de src/14-doublons-classement.js — */
const desCmp = (a, b) => {
  const A = String(a.art ?? "").trim(), B = String(b.art ?? "").trim();
  if (!A !== !B) return A ? 1 : -1;   /* ART vide en tête */
  return natCmp(A, B) || natCmp(a.des, b.des);
};
/* — de src/14-doublons-classement.js — */
const nearName = (k, r) => (k === "lot" || k === "prim" || k === "sec" || k === "qlt") ? r.v : r.des;
/* — de src/15-qualite.js — */
const QQ_TREE_W = 300;
/* — de src/15-qualite.js — */
const qqEnd = (L, i) => { let j = i + 1; while (j < L.length && L[j].d > L[i].d) j++; return j; };
/* — de src/15-qualite.js — */
const qqHasPts = (L, i) => L.slice(i + 1, qqEnd(L, i)).some(x => x.k !== "t");
/* — de src/15-qualite.js — */
const qqHasSubT = (L, i) => L.slice(i + 1, qqEnd(L, i)).some(x => x.k === "t");
/* — de src/15-qualite.js — */
const qqCrit = L => (L || []).filter(x => x.k === "c");
/* — de src/15-qualite.js — */
const qqAppLab = n => n.pv ? insFmt(n.pv).replace(/,00$/, "") + " J" + (n.pw ? " · " + n.pw : "") : "";
/* — de src/15-qualite.js — */
/* petite liste au format de l'application sous la case (comme les unités, FORMAT 50) */
const qqPick = (td, items, cur, done) => {
  document.getElementById("qqPick")?.remove();
  const m = document.createElement("div");
  m.id = "qqPick";
  m.innerHTML = items.map(it => `<button type="button" data-v="${esc(it.v)}" class="${it.v === cur ? "on" : ""}">${esc(it.lab)}</button>`).join("")
    + (cur ? '<button type="button" data-v="" class="qq-clr">EFFACER</button>' : "");
  document.body.appendChild(m);
  const r = td.getBoundingClientRect();
  sviPlaceMenu(m, { top: r.top, bottom: r.bottom, right: r.left + Math.max(r.width, m.offsetWidth), left: r.left });
  const close = ev => { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener("pointerdown", close, true); } };
  setTimeout(() => document.addEventListener("pointerdown", close, true), 0);
  m.addEventListener("click", ev => {
    const b = ev.target.closest("[data-v]");
    if (!b) return;
    m.remove(); document.removeEventListener("pointerdown", close, true);
    done(b.dataset.v);
  });
};
/* — de src/15-qualite.js — */
/* fenêtres DÉCLENCHEMENT et APPEL (FORMAT 105 et 106), au format INF */
const qqWin = (title, html, onOk, onLive) => {
  const d = sviWinNew();
  d.innerHTML = `<div class="svc-card qq-win" role="dialog" aria-modal="true">
      <button type="button" class="svc-close" data-r="0" aria-label="Fermer">✕</button>
      <div class="svc-t">${esc(title)}</div><div class="svc-x svc-html">${html}</div>
      <div class="svc-f"><button type="button" class="svc-b" data-r="0">ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-r="1">ENREGISTRER</button></div></div>`;
  sviWinShow(d);
  if (onLive) { d.addEventListener("input", () => onLive(d)); d.addEventListener("change", () => onLive(d)); onLive(d); }
  let lp = null;
  d.addEventListener("pointerdown", e => { const g = e.target.closest(".qq-dis"); if (g) lp = setTimeout(() => svToast(g.dataset.why || "", 3500, g), SVI_G.lp); });
  ["pointerup", "pointercancel"].forEach(t => d.addEventListener(t, () => clearTimeout(lp)));
  d.addEventListener("click", e => {
    const b = e.target.closest("[data-r]");
    if (!b && e.target !== d) return;
    if (b && b.dataset.r === "1") onOk(d);
    d.remove();
  });
};
/* — de src/16-a-completer.js — */
/* ---------- DÉTAIL DÉLAIS (instance) : une ligne par activité secondaire ---------- */
const dIso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
/* — de src/16-a-completer.js — */
const dAdd = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return dIso(d); };
/* — de src/16-a-completer.js — */
const dDiff = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
/* — de src/16-a-completer.js — */
const dFr = iso => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "";
/* — de src/17-1-liaisons.js — */
const dlyLinkTxt = x => (x.t === "DD" ? "DD" : "FD") + "+" + (x.o || 0);
/* — de src/17-2-lignes-ordre.js — */
/* ===== PLANNING (v401) : MARGE, JALON, LOTS EN ARBORESCENCE (« / »), GANTT ===== */
const dlyLotPath = name => String(name || "").split("/").map(x => x.trim()).filter(Boolean);
/* — de src/17-2-lignes-ordre.js — */
/* repli des lots (› replié / ⌄ déplié), mémorisé par projet */
const dlyFoldAll = () => { try { return JSON.parse(localStorage.getItem("svi_lotfold_v1") || "{}") || {}; } catch (e) { return {}; } };
/* — de src/17-2-lignes-ordre.js — */
/* R29 : affichage PAR LOT (ordre enregistré) ou PAR DÉBUT (vue en escalier, rien n'est enregistré), mémorisé par budget */
const dlyViewAll = () => { try { return JSON.parse(localStorage.getItem("svi_dlyview_v1") || "{}") || {}; } catch (e) { return {}; } };
/* — de src/17-2-lignes-ordre.js — */
/* hauteur des lignes du PLANNING (tableau et Gantt) : pincement vertical à deux doigts ; 24 px au moins (taille d'origine), 64 au plus */
const DLY_RH_KEY = "svi_dly_rh_v1";
/* — de src/17-2-lignes-ordre.js — */
const dlyRhGet = () => { const v = Number(localStorage.getItem(DLY_RH_KEY)); return v >= SVI_G.ganttMin && v <= SVI_G.ganttMax ? v : SVI_G.ganttMin; };
/* — de src/17-2-lignes-ordre.js — */
const dlyBh = rh => Math.round(11 + (rh - 24) * 0.5);   /* épaisseur des barres : 11 px à 24, 31 px à 64 */
/* — de src/17-2-lignes-ordre.js — */
/* largeur d'un intitulé dans la barre (police des barres : 9 px, gras) */
const dlyTxtW = t => {
  const c = dlyTxtW.c || (dlyTxtW.c = document.createElement("canvas").getContext("2d"));
  if (!dlyTxtW.f) dlyTxtW.f = "700 9px " + (getComputedStyle(document.body).fontFamily || "sans-serif");
  c.font = dlyTxtW.f;
  return c.measureText(String(t || "").toUpperCase()).width;
};
/* — de src/17-3-gantt-dessin.js — */
/* v545 (remarque 2) : bas de l'écran visible (clavier de l'iPad compris) */
const dlyVpB = () => { const vv = window.visualViewport; return vv ? vv.offsetTop + vv.height : window.innerHeight; };
/* — de src/17-3-gantt-dessin.js — */
const dlyFitScr = scr => {
  if (!scr || !scr.classList.contains("dly-scroll")) return 0;
  let lim = 0; document.querySelectorAll(".topbar, .bdg-d-sticky").forEach(b => { const r = b.getBoundingClientRect(); if (r.height && /sticky|fixed/.test(getComputedStyle(b).position)) lim = Math.max(lim, r.bottom > 0 ? r.bottom : 0); });
  const tabs = document.getElementById("bdgDetailHead") || document.getElementById("bdgTabs"), vb = dlyVpB();   /* v772 : en-tête DÉTAIL au-dessus des onglets */
  const mx = !!scr.closest(".max-detail");
  document.documentElement.classList.toggle("dly-lock", mx && scr.isConnected);
  /* v594 (remarque longue 2) : bloc agrandi — la ligne des onglets toujours entière juste sous le bandeau du budget */
  if (mx && tabs) { const t = tabs.getBoundingClientRect().top; if (t < lim - 0.5 || (t > lim + 0.5 && window.scrollY > 0)) window.scrollBy(0, t - lim); }
  const sr = scr.getBoundingClientRect();
  /* tot = hauteur totale du bloc (zone des tâches + pied du graphique) : bloc agrandi = jusqu'au bas de l'écran visible ;
     sinon la hauteur commune du bloc détail (FORMAT 202), moins les bandeaux posés au-dessus (ISOLÉ…) */
  let tot;
  if (mx) tot = Math.max(160, Math.floor(vb - sr.top - 2));
  else {
    const hd = parseFloat(getComputedStyle(scr).getPropertyValue("--h-detail")) || 148;
    let ban = 0; scr.parentElement && scr.parentElement.querySelectorAll(":scope > .dly-iso").forEach(b => { ban += b.offsetHeight; });
    tot = Math.max(60, Math.round(hd - ban));   /* v596 : exactement la hauteur commune du bloc détail (même hauteur que les autres onglets) */
  }
  let r = 0;
  if (Math.abs((scr.__capMax || 0) - tot) > 1) { scr.__capMax = tot; r = 2; }
  /* v598 : bloc réduit — la hauteur suit directement la poignée du bas (variable --h-detail), moins les bandeaux posés au-dessus */
  if (!mx) {
    let ban = 0; scr.parentElement && scr.parentElement.querySelectorAll(":scope > .dly-iso").forEach(b => { ban += b.offsetHeight; });
    const v = ban ? `calc(var(--h-detail, 148px) - ${ban}px)` : "";
    if (scr.style.getPropertyValue("height") !== v) { if (v) scr.style.setProperty("height", v, "important"); else scr.style.removeProperty("height"); }
    return r;
  }
  const want = tot;   /* v597 : le pied du graphique est posé par-dessus le bas du Gantt */
  if (Math.abs((parseFloat(scr.style.height) || 0) - want) > 1) { scr.style.setProperty("height", want + "px", "important"); r = r || 1; }
  return r;
};
/* — de src/17-4-tableau-fenetres.js — */
const dlyLabU = r => U_(r.u).replace(/[^A-Z]/g, "");
/* — de src/17-4-tableau-fenetres.js — */
const dlyIsLab = r => ["JH", "HJ", "J", "JR", "JOUR", "JOURS", "JOURHOMME", "JOURSHOMME", "H", "HR", "HEURE", "HEURES"].includes(dlyLabU(r)) || /MAIN\s*D.?\s*(Œ|OE)UVRE/.test(U_(r.des));
/* — de src/17-4-tableau-fenetres.js — */
const dlyJHof = r => { const q = num(r.q || 0) || 0; return ["H", "HR", "HEURE", "HEURES"].includes(dlyLabU(r)) ? q / 8 : q; };
/* — de src/17-4-tableau-fenetres.js — */
const dlyEnd = D => Object.values(D).map(x => x.fin).filter(Boolean).sort().pop() || "";
/* — de src/17b-planning-auto.js — */
const dlyResU = r => dlyIsLab(r) ? "J-H" : (U_(r.u) || "U");
/* — de src/17b-planning-auto.js — */
const dlyResK = r => U_(r.des) + "|" + dlyResU(r);
/* — de src/17b-planning-auto.js — */
const dlyResQty = r => dlyIsLab(r) ? dlyJHof(r) : num(r.q || 0) || 0;
/* — de src/17b-planning-auto.js — */
/* même unité pour toutes les charges cochées : la QUANTITÉ est possible ; sinon MONTANT seulement (R11) */
const dlySameU = R => !!R && new Set(R.map(dlyResU)).size === 1;
/* — de src/17b-planning-auto.js — */
const dlyGM = gk => /^DH: /.test(String(gk));
/* — de src/17b-planning-auto.js — */
const dlyGKeys = gk => new Set(String(gk).replace(/^DH: /, "").split(" § "));
/* — de src/17b-planning-auto.js — */
const dlyGName = gk => (dlyGM(gk) ? "DH : " : "") + [...new Set(String(gk).replace(/^DH: /, "").split(" § ").map(x => x.split("|")[0]))].join(" + ");
/* — de src/17b-planning-auto.js — */
/* valeur d'un morceau : nombre ≥ 1, 0 (pénurie) ou −1 (ILLIMITÉ, aussi quand rien n'est réglé) */
const dlyCapV = v => v === undefined || v === null || v === "" || Number(v) < 0 ? -1 : Math.round(Number(v));
/* — de src/17b-planning-auto.js — */
/* coupes d'un groupe : { d, n, after } ; une coupe rattachée à des tâches (after) se place juste après leur fin (R23) */
const dlyCutsOf = st => ((st && st.plafs) || []).filter(s => s && (s.d || (s.after || []).length));
/* — de src/17b-planning-auto.js — */
const dlyRdV = v => v === undefined || v === null || v === "" || !isFinite(Number(v)) ? 100 : Math.max(1, Math.round(Number(v)));
/* — de src/17b-planning-auto.js — */
const dlyRdSet0 = st => !!st && (st.rd !== undefined && st.rd !== null && st.rd !== "" || (st.rds || []).length > 0);
/* — de src/17b-planning-auto.js — */
const dlyRdCuts = st => ((st && st.rds) || []).filter(s => s && (s.d || (s.after || []).length));
/* — de src/17b-planning-auto.js — */
const dlyHalfS = p => !!(p && p.deb && p.dmd === p.deb);
/* — de src/17b-planning-auto.js — */
const dlyHalfE = p => !!(p && p.fin && p.fmd === p.fin);
/* — de src/17b-planning-auto.js — */
const DLY_BUT_MSG = "AVEC CE NOMBRE VOUS RISQUEZ DE DÉPASSER LA DATE BUTOIR";
/* — de src/17b-planning-auto.js — */
/* hauteur de l'histogramme : nombre de pixels (28 = miniaturisé en bas) ou « full » (plein écran, à la place du Gantt) */
/* v546 (R25) : 0 = histogramme entièrement caché (poignée tout en bas) */
const dlyHHGet = () => { let v = ""; try { v = localStorage.getItem("svi_dlyhh_v1") || ""; } catch (e) {} return v === "full" ? "full" : v === "0" ? 0 : Math.max(28, Math.min(2000, Number(v) || 110)); };
/* — de src/17b-planning-auto.js — */
const dlyHHSet = v => { try { localStorage.setItem("svi_dlyhh_v1", String(v)); } catch (e) {} };
/* — de src/18-annuler-liaisons.js — */
const uniq = arr =>
  [...new Set(arr.filter(v => String(v).trim() !== ""))]
    .sort((x, y) =>
      String(x).localeCompare(String(y), undefined, { numeric: true })
    );
/* — de src/18-annuler-liaisons.js — */
const tvaFor = l =>
  l.ttcAmount !== undefined ? l.ttcAmount - l.amount : l.amount * l.tva / 100;
/* — de src/18-annuler-liaisons.js — */
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
/* — de src/18-annuler-liaisons.js — */
const tcolsFor = prd => [
  /* détail produits : pas de colonne ART (FORMAT 6) */
  ...(prd ? [] : [["article", "ART", l => l.article, "center"]]),
  ["detail", prd ? "DÉSIGNATION PRODUIT" : "DÉSIGNATION CHARGE", l => l.detail, ""],
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
/* — de src/19-delais-disposition.js — */
/* ===== disposition des blocs : ordre et hauteur, mémorisés ===== */
const LAY_KEY = "svi_layout_v1";
/* — de src/19-delais-disposition.js — */
const layLoad = () => {
  try { return JSON.parse(localStorage.getItem(LAY_KEY) || "{}") || {}; }
  catch (e) { return {}; }
};
/* — de src/19-delais-disposition.js — */
const laySave = v => {
  try { localStorage.setItem(LAY_KEY, JSON.stringify(v)); } catch (e) {}
};
/* — de src/19-delais-disposition.js — */
/* v557 (FORMAT 202) : hauteur du bloc détail par défaut = écran visible sous le bandeau (fixé) et les onglets, moins la poignée */
const layDetDef = () => {
  let lim = 0;
  document.querySelectorAll(".topbar, .bdg-d-sticky").forEach(b => { const r = b.getBoundingClientRect(); if (r.height && /sticky|fixed/.test(getComputedStyle(b).position)) lim = Math.max(lim, r.bottom > 0 ? r.bottom : 0); });
  const vv = window.visualViewport, vb = vv ? vv.offsetTop + vv.height : window.innerHeight;
  const tabs = $("bdgTabs"), dh = $("bdgDetailHead"), th = (tabs ? tabs.getBoundingClientRect().height : 50) + (dh ? dh.getBoundingClientRect().height : 0);
  return Math.max(200, Math.floor(vb - lim - th - 22));
};
/* — de src/21-export-import.js — */
const download = (name, blob) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
};
/* — de src/21-export-import.js — */
const fileDialog = ({ title, name, path, buttons, onAct }) => {
  const p = sviPopNew();
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
  sviPopShow(p);
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
/* — de src/21-export-import.js — */
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
/* — de src/21-export-import.js — */
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
/* — de src/21-export-import.js — */
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
/* — de src/21-export-import.js — */
const driveDoneFlash = () => {
  const b = document.querySelector('#docPop [data-act="save"]') || document.querySelector('#docPop [data-act="drive"]');
  if (!b) return;
  const t = b.textContent;
  b.textContent = "✓ ENREGISTRÉ";
  setTimeout(() => { if (b.isConnected) b.textContent = t; }, 2500);
};
/* — de src/21-export-import.js — */
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
/* — de src/21-export-import.js — */
/* fenêtre au format INF : lien de la feuille Google à importer */
const askSheetLink = () => new Promise(res => {
  const p = sviPopNew();
  p.className = "pop-new-bdg";
  p.innerHTML = `
    <div class="doc-card" role="dialog" aria-modal="true" style="max-width:760px">
      <div class="doc-head">
        <span class="doc-title">IMPORTER — GOOGLE SHEETS</span>
        <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
      </div>
      <div class="doc-body">
        <div class="doc-grid">
          <label class="doc-lab" for="gsLink">LIEN DE LA FEUILLE <b>*</b></label>
          <input id="gsLink" class="doc-in" style="grid-column:2 / -1;width:100%" type="url" data-keepcase autocomplete="off"
            inputmode="url" placeholder="https://docs.google.com/spreadsheets/d/…">
        </div>
        <div id="gsErr" class="doc-err"></div>
      </div>
      <div class="doc-foot">
        <button type="button" class="doc-btn" data-cancel>ANNULER</button>
        <button type="button" class="doc-btn nb-save" id="gsGo">IMPORTER</button>
      </div>
    </div>`;
  sviPopShow(p);
  try { popEnhance(p, "gslink"); } catch (e) {}
  const inp = p.querySelector("#gsLink");
  /* champ sur toute la largeur de la fenêtre */
  const cell = inp.parentElement.classList.contains("doc-grid") ? inp : inp.parentElement;
  cell.style.gridColumn = "2 / -1";
  cell.style.width = "100%";
  const close = v => { p.remove(); res(v); };
  const go = () => {
    const v = inp.value.trim();
    if (!/\/d\/[a-zA-Z0-9_-]+/.test(v)) {
      p.querySelector("#gsErr").textContent = "LIEN GOOGLE SHEETS NON RECONNU.";
      inp.focus();
      return;
    }
    close(v);
  };
  p.addEventListener("click", e => {
    if (e.target === p || e.target.closest("[data-cancel]")) close("");
    else if (e.target.closest("#gsGo")) go();
  });
  inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); go(); } });
  setTimeout(() => inp.focus(), 50);
});
/* — de src/21-export-import.js — */
const impFr = iso => iso ? String(iso).slice(8, 10) + "/" + String(iso).slice(5, 7) + "/" + String(iso).slice(0, 4) : "";
/* — de src/21-export-import.js — */
const impId = (k, r) => {
  /* produits : sans article — DÉSIGNATION + UNITÉ */
  /* FORMAT 89 : une désignation (et une charge) se reconnaît par sa DÉSIGNATION + UNITÉ, sans l'ART ;
     seuls les titres gardent leur ART */
  const base = [r.t ? U_(r.art) : "", U_(r.des), U_(r.u), r.t ? "T" : ""];
  return base.join("|");
};
/* — de src/21-export-import.js — */
/* charges, lots et activités : ordre alphabétique */
const impSort = m => {
  const az = (a, b) => String(a).localeCompare(String(b), "fr", { numeric: true });
  m.chg.sort((a, b) => az(a.row.des, b.row.des) || az(a.row.u, b.row.u));
  m.hier.sort((a, b) => az(a.row.v, b.row.v));
};
/* — de src/21-export-import.js — */
/* v481 (remarque 18) : message compréhensible par tout lecteur — quelle tâche bloque et quoi changer */
const bfRuleAWhy = (g, w, task) => (g === "p" ? "TÂCHE PRIMAIRE " : "TÂCHE SECONDAIRE ") + (task ? task + " " : "") + "DÉJÀ LIÉE À " + w.name + " (" + w.n + " LIGNE" + (w.n > 1 ? "S" : "") + "). UNE TÂCHE N'A QU'UNE DÉSIGNATION CLIENT : CHANGER LE LOT OU L'ACTIVITÉ " + (g === "p" ? "PRIMAIRE" : "SECONDAIRE") + ".";
/* — de src/22-saisie-directe.js — */
/* texte principal sans doublon (intitulé DOC / OBS, descriptif TAF) */
const dupKey = v => String(v ?? "").trim().toUpperCase().replace(/\s+/g, " ");
/* — de src/22-saisie-directe.js — */
const findDup = (list, get, v) => list.find(r => dupKey(get(r)) === dupKey(v));
/* — de src/22b-exploitation.js — */
const xplColor = (p, lo, hi) => {
  const neg = p < 0, t = neg ? (lo < 0 ? Math.min(1, p / lo) : 0) : (hi > 0 ? Math.min(1, p / hi) : 0);
  const light = Math.round(92 - 64 * t), hue = neg ? 0 : 130, sat = neg ? 70 : 55;
  return `background:hsl(${hue},${sat}%,${light}%) !important;color:${light < 55 ? "#fff" : "#172033"} !important;-webkit-text-fill-color:${light < 55 ? "#fff" : "#172033"} !important`;
};
/* — de src/23-apercus-impression.js — */
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
/* — de src/24-doc-historique-fenetres.js — */
const pad = (n, w = 2) => String(n).padStart(w, "0");
/* — de src/24-doc-historique-fenetres.js — */
/* ===== fenêtres et champs de saisie réglables (tailles mémorisées) ===== */
const PS_KEY = "svi_popsize_v1";
/* — de src/24-doc-historique-fenetres.js — */
const psLoad = () => {
  try { return JSON.parse(localStorage.getItem(PS_KEY) || "{}") || {}; }
  catch (e) { return {}; }
};
/* — de src/24-doc-historique-fenetres.js — */
const psSet = (k, v) => {
  const all = psLoad();
  if (v) all[k] = v; else delete all[k];
  try { localStorage.setItem(PS_KEY, JSON.stringify(all)); } catch (e) {}
};
/* — de src/24-doc-historique-fenetres.js — */
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
/* — de src/24-doc-historique-fenetres.js — */
/* format unique des dates : JJ/MM/AAAA À HH:MM */
const fmtField = (type, v) => {
  if (!v) return "";
  if (type === "time") return v.slice(0, 5);
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return String(v);
  return `${m[3]}/${m[2]}/${m[1]}` + (type === "datetime-local" && m[4] ? ` À ${m[4]}:${m[5]}` : "");
};
/* — de src/24-doc-historique-fenetres.js — */
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
/* — de src/24-doc-historique-fenetres.js — */
/* ===== listes DOC / TAF / OBS sous le détail ===== */
const fmtDT = v => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} À ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/* — de src/25-inf.js — */
/* durée en jours du calendrier, début et fin compris : « 1 AN 2 MOIS 20 JOURS » */
const infYMD = (a, b) => {
  if (!a || !b || b < a) return "";
  const D = x => new Date(x + "T12:00:00");
  const end = D(b); end.setDate(end.getDate() + 1);
  let y = 0, m = 0, c = D(a);
  const add = (d, yy, mm) => { const n = new Date(d); n.setFullYear(n.getFullYear() + yy); n.setMonth(n.getMonth() + mm); return n; };
  while (add(c, 1, 0) <= end) { c = add(c, 1, 0); y++; }
  while (add(c, 0, 1) <= end) { c = add(c, 0, 1); m++; }
  const d = Math.round((end - c) / 86400000);
  return [y ? y + (y > 1 ? " ANS" : " AN") : "", m ? m + " MOIS" : "", d ? d + (d > 1 ? " JOURS" : " JOUR") : ""].filter(Boolean).join(" ") || "0 JOUR";
};
/* — de src/25-inf.js — */
const STAR = ' <b class="req-star">*</b>';
/* — de src/25-inf.js — */
const localDT = d =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
/* — de src/25-inf.js — */
const hm = ms => {
  if (!isFinite(ms)) return "0:00";
  const neg = ms < 0; ms = Math.abs(ms);
  const m = Math.round(ms / 60000);
  return (neg ? "-" : "") + Math.floor(m / 60) + ":" + pad(m % 60);
};
/* — de src/26-copier-coller.js — */
const CLIP_KEY = "svi_clip_v1";
/* — de src/26-copier-coller.js — */
const clipGet = () => { try { return JSON.parse(localStorage.getItem(CLIP_KEY) || "null"); } catch (e) { return null; } };
/* — de src/26-copier-coller.js — */
const clipSet = c => { try { c ? localStorage.setItem(CLIP_KEY, JSON.stringify(c)) : localStorage.removeItem(CLIP_KEY); } catch (e) {} };
/* — de src/26b-conditionnement.js — */
const COND_K = r => U_(r.des) + "|" + U_(r.u);
/* — de src/26b-conditionnement.js — */
const condAll = () => { try { return JSON.parse(localStorage.getItem("svi_cond_chs_v1") || "{}") || {}; } catch (e) { return {}; } };
/* — de src/26b-conditionnement.js — */
const condCut = (pieces, BL, kerf = 0) => {
  const all = [];
  pieces.forEach(p => { for (let i = 0; i < p.n; i++) all.push(p.L); });
  all.sort((a, b) => b - a);
  if (all.some(L => L > BL + 1e-9)) return { err: "UN MORCEAU EST PLUS LONG QUE LA BARRE (" + money(Math.max(...all)) + " M)." };
  const pack = list => {
    const bars = [];
    list.forEach(L => {
      let best = -1, rest = Infinity;
      bars.forEach((b, i) => { const r = BL - b.used - (b.cuts.length ? kerf : 0) - L; if (r >= -1e-9 && r < rest) { rest = r; best = i; } });
      if (best < 0) bars.push({ used: L, cuts: [L] });
      else { const b = bars[best]; b.used += L + (b.cuts.length ? kerf : 0); b.cuts.push(L); }
    });
    return bars;
  };
  let bars = pack(all);
  /* amélioration : vider la barre la moins remplie et replacer ses morceaux dans les autres */
  for (let g = 0; g < 30 && bars.length > 1; g++) {
    const sorted = bars.slice().sort((a, b) => a.used - b.used), low = sorted[0];
    const others = bars.filter(b => b !== low).map(b => ({ used: b.used, cuts: b.cuts.slice() }));
    let ok = true;
    low.cuts.slice().sort((a, b) => b - a).forEach(L => {
      let best = -1, rest = Infinity;
      others.forEach((b, i) => { const r = BL - b.used - kerf - L; if (r >= -1e-9 && r < rest) { rest = r; best = i; } });
      if (best < 0) ok = false; else { others[best].used += L + kerf; others[best].cuts.push(L); }
    });
    if (!ok) break;
    bars = others;
  }
  /* plan : barres identiques regroupées */
  const plan = new Map();
  bars.forEach(b => { const k = b.cuts.slice().sort((a, c) => c - a).map(x => money(x)).join(" + "); plan.set(k, { n: ((plan.get(k) || {}).n || 0) + 1, chute: BL - b.used }); });
  const need = all.reduce((a, b) => a + b, 0), chute = bars.length * BL - need;
  return { bars: bars.length, plan: [...plan].map(([k, v]) => ({ k, n: v.n, chute: v.chute })), need, chute, pct: bars.length ? chute / (bars.length * BL) * 100 : 0 };
};

/* v728 (bloc 9) : emballage et chutes — réglage du TITRE de charges (même désignation, même unité) dans CE budget (INS.cond),
   l'ancien réglage gardé sur l'appareil (CHS) n'étant plus lu qu'en secours */
const condOf = (I, key) => ((I && I.cond) || {})[key] || condAll()[key] || null;
/* morceaux : produits liés aux charges du titre — longueur = DIM 1, nombre = NBR */
const condPiecesOf = (I, rows) => {
  const ids = new Set(rows.map(r => r.id)), out = new Map();
  (I.links || []).filter(l => (l.chg || []).some(x => ids.has(x.id))).forEach(l => (l.prd || []).forEach(x => {
    const p = (I.prd || []).find(q => q.id === x.id); if (!p) return;
    const L = num(p.d1), n = Math.max(1, Math.round(num(p.nbr) || 1)); if (!(L > 0)) return;
    const k = String(Math.round(L * 1000) / 1000); out.set(k, (out.get(k) || 0) + n);
  }));
  return [...out].map(([L, n]) => ({ L: Number(L), n })).sort((a, b) => b.L - a.L);
};
/* longueur (M) → unité de la charge : M / ML tel quel ; KG et T avec le poids au mètre ; sinon impossible (null) */
const condM2U = (u, kgm) => { const U = U_(u).replace(/[^A-Z]/g, ""); if (U === "M" || U === "ML") return 1; if (kgm > 0 && (U === "KG")) return kgm; if (kgm > 0 && (U === "T" || U === "TONNE" || U === "TONNES")) return kgm / 1000; return null; };
/* chute du titre (unité de la charge) : barres achetées − longueur utile (méthode A, 30/10/2026) ; mémorisée par réglage + morceaux */
const condChuteMemo = new Map();
const condChuteOf = (I, key, rows) => {
  const c = ((I && I.cond) || {})[key]; if (!c || c.mode !== "c" || !(num(c.BL) > 0)) return null;   /* chute : seulement un réglage fait dans ce budget */
  const pcs = c.pcs && c.pcs.length ? c.pcs : condPiecesOf(I, rows), f = condM2U(rows[0] && rows[0].u, num(c.kgm));
  if (!pcs.length || f === null) return null;
  const sig = key + "|" + c.BL + "|" + (c.kerf || 0) + "|" + JSON.stringify(pcs);
  let R = condChuteMemo.get(sig); if (!R) { R = condCut(pcs, num(c.BL), num(c.kerf) || 0); if (condChuteMemo.size > 400) condChuteMemo.clear(); condChuteMemo.set(sig, R); }
  return R.err ? null : R.chute * f;
};
/* part d'une ligne de charge : chute du titre répartie au prorata des QCB de ses lignes */
const condChuteRow = (I, r) => {
  if (!I || !r || r.t) return 0;
  const key = COND_K(r), c = (I.cond || {})[key];
  if (!c || c.mode !== "c" || !(num(c.BL) > 0)) return 0;   /* rapide : pas de découpe réglée pour ce titre (cas courant) */
  const rows = (I.chg || []).filter(x => !x.t && COND_K(x) === key);
  const C = condChuteOf(I, key, rows); if (!C) return 0;
  const Q = rows.reduce((t, x) => t + (num(x.q) || 0), 0);
  return Q > 0 ? C * (num(r.q) || 0) / Q : C / rows.length;
};

/* v740 (prompt du 31/10, point 1) : CUMUL — plusieurs budgets additionnés en un seul ensemble (lecture seule).
   Chaque budget : ses lignes gardées (identifiants préfixés) ; ses lots rangés sous sa référence (« RÉF. / LOT ») : deux tâches de même nom
   restent séparées ; charges et produits identiques (désignation + unité) regroupés par le tableau (quantités additionnées pour une même unité) ;
   chaque tâche garde le calendrier de son budget (INS.calK) ; planning, Gantt, graphiques et indicateurs additionnent jour par jour. */
const sviCumMerge = L => {
  const M = { des: [], lot: [], prim: [], sec: [], prd: [], chg: [], qlt: [], links: [], dlp: {}, dpred: {}, dlpSec: true, calK: {}, cum: L.map(x => ({ ref: x.ref, lab: x.lab, state: x.state })) };
  const ids = ["des", "lot", "prim", "sec", "prd", "chg"];
  L.forEach((b, i) => {
    const d = JSON.parse(JSON.stringify(b.d || {})); try { if (!d.dlpSec) sviDlpSec(d); } catch (e) {}
    const P = "c" + i + "_", px = id => P + id, cal = sviCalOf(d);
    /* désignations client rangées sous un titre par budget (sa référence) : ART propres, jamais en double */
    M.des.push({ id: P + "__t", t: true, d: 0, art: String(i + 1), des: U_(b.ref) });
    ids.forEach(k => (d[k] || []).forEach(r => M[k].push({ ...r, id: px(r.id), ...(k === "lot" ? { v: U_(b.ref) + " / " + (r.v || "") } : {}),
      ...(k === "des" ? { d: (Number(r.d) || 0) + 1, art: r.art ? (i + 1) + "." + r.art : r.art } : {}) })));
    (d.links || []).forEach(l => M.links.push({ ...l, id: px(l.id || ("l" + Math.random().toString(36).slice(2, 7))), des: px(l.des), lot: px(l.lot), prim: px(l.prim), sec: px(l.sec), prd: (l.prd || []).map(x => ({ ...x, id: px(x.id) })), chg: (l.chg || []).map(x => ({ ...x, id: px(x.id) })) }));
    const kx = k => { const [a, s] = String(k).split("|"); return px(a) + "|" + px(s); };
    Object.keys(d.dlp || {}).forEach(k => { M.dlp[kx(k)] = d.dlp[k]; M.calK[kx(k)] = cal; });
    Object.keys(d.dpred || {}).forEach(k => { M.dpred[kx(k)] = (d.dpred[k] || []).map(x => ({ ...x, k: kx(x.k) })); });
    if (!i) { M.cal = d.cal; M.rat = d.rat; M.hset = d.hset; }
    if (d.pdeb && (!M.pdeb || d.pdeb < M.pdeb)) M.pdeb = d.pdeb;
    if (d.dbut && (!M.dbut || d.dbut > M.dbut)) M.dbut = d.dbut;
    Object.keys(d.chgCal || {}).forEach(k => { M.chgCal = M.chgCal || {}; if (!M.chgCal[k]) M.chgCal[k] = d.chgCal[k]; });
    Object.keys(d.cond || {}).forEach(k => { M.cond = M.cond || {}; if (!M.cond[k]) M.cond[k] = d.cond[k]; });
  });
  return M;
};

/* v739 (prompt du 31/10, point 2) : BIBLIOTHÈQUE DE PRIX — recettes par activité secondaire, communes à tous les budgets (partagées) :
   { id, act (activité secondaire), nom (variante), u (unité du produit), chg: [{ des, u, k (quantité pour 1 unité de produit), p }], des: [], lot: [], src, date, chk } */
const sviLibGet = () => { try { const L = (typeof sviSharedGet === "function" ? sviSharedGet("LIB") : {}).L; return Array.isArray(L) ? L : []; } catch (e) { return []; } };
const sviLibSet = L => { if (typeof sviSharedSet === "function") sviSharedSet("LIB", { L }); };
const sviLibSig = R => U_(R.act) + "#" + (R.chg || []).map(c => U_(c.des) + "|" + U_(c.u) + "|" + Math.round(Number(c.k || 0) * 1e4) / 1e4 + "|" + Math.round(Number(c.p || 0) * 100) / 100).sort().join(";");
/* recette ajoutée sans doublon (même activité, mêmes charges, mêmes quantités et prix) : sinon l'usage (désignation, lot) est ajouté à l'existante */
const sviLibAdd = (L, R) => {
  const s = sviLibSig(R), x = L.find(y => sviLibSig(y) === s);
  const mix = (a, b) => [...new Set([...(a || []), ...(b || [])].filter(Boolean))];
  if (x) { x.des = mix(x.des, R.des); x.lot = mix(x.lot, R.lot); return x; }
  let nom = U_(R.nom || "RECETTE"), n = 2; while (L.some(y => U_(y.act) === U_(R.act) && U_(y.nom) === nom)) nom = U_(R.nom || "RECETTE") + " (" + n++ + ")";
  const o = { id: "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...R, nom }; L.push(o); return o;
};
/* recettes d'un budget : une par tâche secondaire liée (charges ÷ quantité de ses produits) */
const sviLibFromBudget = (d, src) => {
  const nm = (k, id) => { const r = (d[k] || []).find(x => x.id === id); return r ? U_(k === "des" ? r.des : r.v) : ""; };
  const T = new Map();
  (d.links || []).forEach(l => { const k = l.lot + "|" + l.sec, t = T.get(k) || { l, prd: new Set(), chg: new Set(), des: new Set() }; (l.prd || []).forEach(x => t.prd.add(x.id)); (l.chg || []).forEach(x => t.chg.add(x.id)); t.des.add(nm("des", l.des)); T.set(k, t); });
  const out = [];
  T.forEach(t => {
    const Q = [...t.prd].reduce((s, id) => { const p = (d.prd || []).find(x => x.id === id); return s + (p ? (insPrdQ(p) || 0) : 0); }, 0);
    if (!(Q > 0)) return;
    const chg = [...t.chg].map(id => (d.chg || []).find(x => x.id === id)).filter(r => r && !r.t && Number(String(r.q || 0).replace(",", ".")) > 0)
      .map(r => ({ des: U_(r.des), u: U_(r.u), k: Number(String(r.q).replace(",", ".")) / Q, p: Number(String(r.p || 0).replace(",", ".")) || 0 }));
    if (!chg.length) return;
    const sec = (d.sec || []).find(x => x.id === t.l.sec) || {};
    out.push({ act: U_(sec.v || ""), nom: [...t.des][0] || "RECETTE", u: U_(sec.u || ""), q: Q, chg, des: [...t.des], lot: [nm("lot", t.l.lot)], src: src || "", date: new Date().toISOString().slice(0, 10) });
  });
  return out;
};

/* v738 (prompt du 31/10, point 3) : RECETTES des MODALITÉS DE PAIEMENT — chaque échéance (date, montant) ;
   RETENUE DE GARANTIE (taux) déduite de chaque échéance et rendue à sa libération (date, fin d'une tâche, ou fin des travaux + n mois) */
const sviPayPlan = (d, M, finOf, endAll) => {
  const n = v => Number(String(v ?? "").replace(/\s/g, "").replace(",", ".")) || 0, out = [];
  ((d.ctr || {}).rows || []).filter(r => r.type === "pay").forEach(r => {
    const D = r.det || {}, G = D.rg, t = G ? Math.max(0, Math.min(100, n(G.t))) / 100 : 0;
    let held = 0;
    (D.ech || []).forEach(e => {
      const date = e.on === "task" ? (finOf(e.task) || "") : e.date || "";
      const m = e.u === "%" ? M * n(e.v) / 100 : n(e.v);
      held += m * t;
      out.push({ lab: e.lab || (e.on === "task" ? "FIN DE TÂCHE" : "ÉCHÉANCE"), date, m: m * (1 - t), brut: m, rg: m * t, task: e.on === "task" ? e.task : "" });
    });
    if (t > 0 && held > 0) {
      let date = "";
      if (G.on === "date") date = G.date || "";
      else if (G.on === "task") date = finOf(G.task) || "";
      else if (endAll) { const x = new Date(endAll + "T12:00:00"); x.setMonth(x.getMonth() + (G.mois === "" || G.mois === undefined ? 12 : n(G.mois))); date = x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); }
      out.push({ lab: "LIBÉRATION DE LA RETENUE DE GARANTIE", date, m: held, rgLib: true });
    }
  });
  return out.sort((a, b) => String(a.date || "9").localeCompare(String(b.date || "9")));
};
/* v732 : données « cuites » pour les indicateurs — la chute ajoutée à la QCB de chaque charge (une seule fois : __cb) */
const condBake = d => {
  if (!d || d.__cb || !d.cond || !Object.keys(d.cond).length) return d;
  const chg = (d.chg || []).map(r => { const c = condChuteRow(d, r); return c ? { ...r, q: (num(r.q) || 0) + c } : r; });
  return { ...d, chg, __cb: 1 };
};

/* v718 (révision des prix) : estimation de la révision avec le planning — formule du contrat (part fixe + pondérations par index),
   hypothèse d'évolution par index (%/an depuis le mois de base), scénario pessimiste (hausse d'un index, et hausse de charges par mot-clé).
   Valeur de chaque désignation client répartie sur les jours de ses tâches ; révision du jour = valeur × (K − 1). */
const sviRevNums = s => String(s || "").split(/[;\n]/).map(x => Number(String(x).replace(/\s/g, "").replace(",", ".")))
  .map(x => isFinite(x) ? x : 0);
const sviRevRow = d => ((d && d.ctr && d.ctr.rows) || []).find(r => r && !r.t && r.type === "rev") || null;
const sviRevEst = (d, pess) => {
  const R = sviRevRow(d); if (!R) return null;
  const D = R.det || {}, P = sviRevNums(D.pond).filter((x, i) => i === 0 || x !== 0);
  if (P.length < 2) return null;
  const a = P[0], W = P.slice(1), H0 = sviRevNums(D.hyps), C0 = sviRevNums(D.choc), h1 = Number(String(D.hyp || "").replace(",", ".")) || 0;
  const H = W.map((_, i) => (H0[i] !== undefined && String(D.hyps || "").trim() ? H0[i] : h1) / 100), C = W.map((_, i) => pess ? (C0[i] || 0) / 100 : 0);
  const n = v => Number(String(v ?? "").replace(/\s/g, "").replace(",", ".")) || 0;
  const per = {}; Object.keys(d.dlp || {}).forEach(k => (d.dlp[k] || []).forEach(p => { if (p.deb) (per[k] = per[k] || []).push([p.deb, p.fin || p.deb]); }));
  const all = Object.values(per).flat().map(x => x[0]).sort(), mb = /^\d{4}-\d{2}/.test(D.mb || "") ? D.mb.slice(0, 7) : (all[0] || "").slice(0, 7);
  if (!mb) return null;
  const [by, bm] = mb.split("-").map(Number);
  const K = day => { const [y, m] = day.split("-").map(Number), t = (y - by) * 12 + (m - bm); return a + W.reduce((s, w, i) => s + w * Math.pow(1 + H[i], Math.max(0, t) / 12) * (1 + C[i]), 0); };
  let rev = 0, val = 0;
  (d.des || []).filter(r => !r.t).forEach(r => {
    const lq = insLinkedQ(d, r.id), V = (lq || n(r.q)) * n(r.p); if (!V) return;
    const days = []; (d.links || []).filter(l => l.des === r.id).forEach(l => (per[l.lot + "|" + l.sec] || []).forEach(([x, y]) => { for (let t = new Date(x + "T12:00:00"); sviIsoOf(t) <= y && days.length < 4000; t.setDate(t.getDate() + 1)) days.push(sviIsoOf(t)); }));
    if (!days.length) return;
    val += V; days.forEach(x => { rev += V / days.length * (K(x) - 1); });
  });
  /* scénario pessimiste : hausse des charges par mot-clé (« CIMENT:10 ; ACIER:5 ») */
  let chgUp = 0;
  if (pess) String(D.pchg || "").split(/[;\n]/).forEach(it => { const m = it.match(/^\s*([^:]+):\s*([\d.,]+)/); if (!m) return; const kw = String(m[1]).trim().toUpperCase(), pc = n(m[2]) / 100;
    (d.chg || []).filter(r => !r.t && String(r.des || "").toUpperCase().includes(kw)).forEach(r => { chgUp += n(r.q) * n(r.p) * pc; }); });
  return { rev, val, chgUp, mb };
};
/* v914 : repris de 06-bds-configuration.js (BDS supprimé) — préfixe « 01 - » retiré d'un intitulé de niveau */
function stripLevelPrefix(v) {
  const s = String(v ?? "");
  return s.replace(/^\s*\d{1,3}\s*[-–]\s*/, "");
}
/* ⟪ src/09c-filtres-communs.js ⟫ */
/* =========================================================
   v749 : TRI ET FILTRE PAR COLONNE (façon tableur), COMMUN À TOUS LES ÉCRANS
   Sorti du budget (12-tableaux-colonnes.js) pour servir aussi ACHATS : même menu, mêmes règles, même mémoire.
   sviCfKit(o) — o = { key, shell, refresh, toTop } :
     shell   : élément de l'écran (crochets facultatifs shell.__cfPar…, shell.__faFor…) ;
     refresh : redessine l'écran après un tri ou un filtre ;
     toTop   : demande de remonter en haut d'un tableau devenu plus court (facultatif).
   Rend { CF, cfSrc, cfT, cfApply, cfHead, cfClose, cfOpenMenu, cfMakeF }.
   ========================================================= */
/* date JJ/MM/AAAA ou AAAA-MM-JJ → AAAA-MM-JJ (aussi lue par cfCondOk, 09) */
/* v750 : une heure après la date est acceptée (« 31/10/2026 À 10:00 », colonnes SAISI LE / VALIDÉ LE de la liste des budgets) */
const cfDate = x => { const s = String(x || "").trim(); const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(?:À\s+)?\d{1,2}:\d{2})?$/); if (m) return m[3] + "-" + m[2] + "-" + m[1]; const n = s.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s]\d{1,2}:\d{2})?$/); return n ? n[1] : ""; };
/* v750 : clé de tri d'une date JJ/MM/AAAA [HH:MM] (sinon le tri suivait le jour) */
const cfSortKey = v => { if (typeof v !== "string") return v; const m = v.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(?:À\s+)?(\d{1,2}):(\d{2}))?$/); return m ? m[3] + m[2] + m[1] + (m[4] || "00").padStart(2, "0") + (m[5] || "00") : v; };
function sviCfKit(o) {
  const shell = o.shell;
  const refreshAll = () => o.refresh();
  const keepScroll = { set toTop(v) { if (v && o.toTop) o.toTop(); } };
  /* ===== tri et filtre par colonne (façon tableur) ===== */
  const CF = {};          /* CF[table] = { sort:{col,dir}|null, f:{col:Set} } */
  const cfSrc = {};       /* dernières lignes et colonnes de chaque tableau */
  const cfT = t => CF[t] || (CF[t] = { sort: null, f: {} });

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
          const x = cfSortKey(get(a)), y = cfSortKey(get(b));
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
    const on = !!st.f[key] || !!(st.sort && st.sort.col === key && !st.sort.def) || !!(shell.__cfParOn && shell.__cfParOn(t, key));
    return `<th class="${cls} ${on ? "cf-on" : ""}">
      <span class="cf-wrap"><span class="cf-lab">${(() => { const k = shell.__faFor && shell.__faFor(t, key); return k && shell.__faHTML ? shell.__faHTML(k) : ""; })()}${label}</span><span class="cf-btn" data-cf="${t}" data-col="${key}"
        role="button" aria-label="Trier / filtrer">${cfIcon}</span></span><span
        class="col-rs" data-rs="${t}" data-col="${key}"></span></th>`;
  };


  let cfOpen = null;   /* { t, key } du menu ouvert */
  let cfPlace = () => {};

  const cfClose = () => {
    window.visualViewport?.removeEventListener("resize", cfPlace);
    window.visualViewport?.removeEventListener("scroll", cfPlace);
    document.getElementById("cfMenu")?.remove();
    cfOpen = null;
  };

  /* v510 (remarque 70) : CONDITION sur une colonne de nombres ou de dates (égal, différent, supérieur, inférieur, entre ;
     le, avant le, après le, entre) — combinée aux cases de valeurs ; le filtre garde la forme d'un ensemble (has) */
  const cfMakeF = (vals, cond) => ({ cond, vals, has: v => (!vals || vals.has(v)) && cfCondOk(cond, v), [Symbol.iterator]: function* () { if (vals) yield* vals; } });

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
    /* comme Google Sheets : les cases suivent le brouillon du menu, appliqué seulement par OK */
    const isOn = v => cfOpen.draft.has(v);
    /* valeurs cochées (filtre actif) remontées en tête de liste */
    if (st.f[key]) vals.sort((x, y) => isOn(y) - isOn(x));
    const allOn = vals.length && vals.every(isOn);
    m.querySelector(".cf-list").innerHTML =
      `<label class="cf-item cf-all"><input type="checkbox" data-cfall ${allOn ? "checked" : ""}>
         (TOUT SÉLECTIONNER)<span class="cf-n">${vals.filter(isOn).length}/${vals.length}</span></label>` +
      (vals.length
        ? vals.map(v => `<label class="cf-item"><input type="checkbox" data-cfv="${esc(v)}"
             ${isOn(v) ? "checked" : ""}> ${esc(v || "(vide)")}</label>`).join("")
        : `<div class="cf-none">AUCUNE VALEUR</div>`);
    m.querySelectorAll(".cf-sort").forEach(b =>
      b.classList.toggle("on", !!st.sort && st.sort.col === key && st.sort.dir === b.dataset.dir)
    );
  };

  /* partie CONDITION du menu (colonne de nombres ou de dates) */
  const cfCondUI = m => {
    const box = m.querySelector(".cf-cond");
    if (!box || !cfOpen) return;
    const kind = cfKind(cfValues(cfOpen.t, cfOpen.key));
    cfOpen.kind = kind;
    if (!kind) { box.innerHTML = ""; return; }
    const c = cfOpen.cond && cfOpen.cond.kind === kind ? cfOpen.cond : null;
    const ops = kind === "num" ? [["", "AUCUNE"], ["eq", "ÉGAL À"], ["ne", "DIFFÉRENT DE"], ["gt", "SUPÉRIEUR À"], ["ge", "SUPÉRIEUR OU ÉGAL À"], ["lt", "INFÉRIEUR À"], ["le", "INFÉRIEUR OU ÉGAL À"], ["bt", "ENTRE … ET …"]]
      /* v750 (point 6) : mêmes conditions pour les dates que pour les nombres */
      : kind === "date" ? [["", "AUCUNE"], ["eq", "ÉGAL À (LE)"], ["ne", "DIFFÉRENT DE"], ["gt", "SUPÉRIEUR À (APRÈS LE)"], ["ge", "SUPÉRIEUR OU ÉGAL À"], ["lt", "INFÉRIEUR À (AVANT LE)"], ["le", "INFÉRIEUR OU ÉGAL À"], ["bt", "ENTRE LE … ET LE …"]]
      : [["", "AUCUNE"], ["eq", "ÉGAL À"], ["ne", "DIFFÉRENT DE"], ["ct", "CONTIENT"], ["nc", "NE CONTIENT PAS"], ["sw", "COMMENCE PAR"], ["ew", "SE TERMINE PAR"]];
    const fmt = v => v === undefined || v === null || v === "" ? "" : kind === "num" ? money(v) : v;
    const inp = (n, v) => kind === "num" ? `<input class="cf-ca" data-n="${n}" inputmode="decimal" value="${esc(fmt(v))}" placeholder="VALEUR">` : kind === "txt" ? `<input class="cf-ca" data-n="${n}" value="${esc(v || "")}" placeholder="TEXTE" autocomplete="off">` : `<input type="date" class="cf-ca" data-n="${n}" value="${esc(v || "")}">`;
    /* v622 : liste CONDITION de l'application (plus la grande liste de l'iPad) — petites lignes, ✓ devant le choix en cours */
    const op0 = c ? c.op : "", lab0 = (ops.find(o => o[0] === op0) || ops[0])[1];
    box.innerHTML = `<div class="cf-opw"><button type="button" class="cf-opb"><span>${lab0}</span><i>▾</i></button><div class="cf-opl" hidden>${ops.map(([k, l]) => `<button type="button" class="cf-opi${k === op0 ? " on" : ""}" data-op="${k}"><b>${k === op0 ? "✓" : ""}</b>${l}</button>`).join("")}</div><input type="hidden" class="cf-op" value="${op0}"></div>
      <div class="cf-cv${c ? "" : " off"}">${inp("a", c && c.a)}<span class="cf-et${c && c.op === "bt" ? "" : " off"}"> ET </span>${`<span class="cf-bw${c && c.op === "bt" ? "" : " off"}">${inp("b", c && c.b)}</span>`}</div>`;
    box.addEventListener("click", ev => {
      if (ev.target.closest(".cf-opb")) { const L = box.querySelector(".cf-opl"); L.hidden = !L.hidden; cfPlace && cfPlace(); return; }
      const it = ev.target.closest(".cf-opi");
      if (!it) return;
      const op = it.dataset.op;
      box.querySelector(".cf-op").value = op;
      box.querySelector(".cf-opb span").textContent = (ops.find(o => o[0] === op) || ops[0])[1];
      box.querySelectorAll(".cf-opi").forEach(b => { b.classList.toggle("on", b === it); b.querySelector("b").textContent = b === it ? "✓" : ""; });
      box.querySelector(".cf-opl").hidden = true;
      box.querySelector(".cf-cv").classList.toggle("off", !op);
      box.querySelectorAll(".cf-et, .cf-bw").forEach(x => x.classList.toggle("off", op !== "bt"));
      if (op) setTimeout(() => box.querySelector('.cf-ca[data-n="a"]')?.focus(), 0);
    });
  };
  /* condition lue dans le menu : null (aucune), false (incomplète) ou { kind, op, a, b } */
  const cfReadCond = m => {
    const box = m.querySelector(".cf-cond"), kind = cfOpen && cfOpen.kind;
    if (!box || !kind) return null;
    const op = (box.querySelector(".cf-op") || {}).value || "";
    if (!op) return null;
    const rd = n => { const i = box.querySelector(`.cf-ca[data-n="${n}"]`); const v = i ? String(i.value || "").trim() : ""; if (!v) return null; return kind === "num" ? cfNum(v) : kind === "txt" ? v.toUpperCase() : cfDate(v) || v; };
    const a = rd("a"), b = op === "bt" ? rd("b") : null;
    if (a === null || (op === "bt" && b === null)) return false;
    return { kind, op, a, b };
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
    {
      const st0 = cfT(t), f0 = st0.f[key];
      cfOpen = { t, key, cond: f0 && f0.cond ? { ...f0.cond } : null, draft: new Set(f0 ? (f0.cond && !f0.vals ? cfValues(t, key) : [...f0]) : cfValues(t, key)) };
    }
    const m = document.createElement("div");
    m.id = "cfMenu";
    m.innerHTML = `
      <div class="cf-rsz" title="Largeur et hauteur"></div>
      <button type="button" class="cf-x" aria-label="Fermer">✕</button>
      ${typeof sviColhHide === "function" && sviColhInfo(btn.closest("table")) ? '<button type="button" class="cf-hide">MASQUER LA COLONNE</button><div class="cf-sep"></div>' : ""}
      <button type="button" class="cf-sort" data-dir="asc">TRIER DE A À Z</button>
      <button type="button" class="cf-sort" data-dir="desc">TRIER DE Z À A</button>${shell.__cfPar ? shell.__cfPar(t, key) : ""}
      <div class="cf-sep"></div>
      <div class="cf-h">FILTRER PAR CONDITION</div>
      <div class="cf-cond"></div>
      <div class="cf-h">FILTRER PAR VALEURS</div>
      <div class="cf-search">🔍 <input type="search" class="cf-q" placeholder="RECHERCHER…"></div>
      <div class="cf-list"></div>
      <div class="cf-foot">
        <button type="button" class="cf-clear">EFFACER</button>
        <button type="button" class="cf-ok">OK</button>
      </div>`;
    document.body.appendChild(m);
    /* v926 (remarque 11) : MASQUER LA COLONNE, tout en haut du menu de la loupe */
    m.querySelector(".cf-hide")?.addEventListener("click", ev => { ev.stopPropagation(); const tb = btn.closest("table"); cfClose(); if (tb) sviColhHide(tb, key); });

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
      /* largeur ajustable par la poignée du bord gauche, mémorisée (FORMAT 73) */
      let w = 240;
      try { w = Math.max(200, Math.min(window.innerWidth * 0.9, +localStorage.getItem("svi_cfw_v1") || 240)); } catch (e) {}
      m.style.width = w + "px";
      m.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + "px";
      const below = vTop + vH - r.bottom - 10;
      const above = r.top - vTop - 10;
      const useBelow = below >= 280 || below >= above;
      /* jamais plus haut que 60 % de l'écran visible, et toujours
         entièrement visible (boutons OK / Effacer accessibles) */
      let uh = 0;
      try { uh = +localStorage.getItem("svi_cfh_v1") || 0; } catch (e) {}
      const maxH = Math.max(180, Math.min(uh ? vH - 16 : vH * 0.6, useBelow ? below : above));
      m.style.maxHeight = maxH + "px";
      m.style.height = uh ? Math.min(uh, maxH) + "px" : "";
      const realH = Math.min(maxH, m.scrollHeight);
      let top = useBelow ? r.bottom + 4 : r.top - 4 - realH;
      const h = Math.min(maxH, m.offsetHeight);
      top = Math.min(top, vTop + vH - 8 - h);
      m.style.top = Math.max(vTop + 8, top) + "px";
    };
    cfPlace();
    m.querySelector(".cf-rsz").addEventListener("pointerdown", ev => {
      ev.preventDefault(); ev.stopPropagation();
      const x0 = ev.clientX, y0 = ev.clientY, r0 = m.getBoundingClientRect();
      m.style.maxHeight = (window.innerHeight - r0.top - 8) + "px";
      const mv = e2 => {
        /* poignée d'angle (bas gauche) : largeur ET hauteur, mémorisées */
        const w = Math.max(200, Math.min(window.innerWidth * 0.9, r0.width + (x0 - e2.clientX)));
        const h = Math.max(180, Math.min(window.innerHeight - r0.top - 8, r0.height + (e2.clientY - y0)));
        m.style.width = w + "px";
        m.style.left = Math.max(8, r0.right - w) + "px";
        m.style.height = h + "px";
        try { localStorage.setItem("svi_cfw_v1", Math.round(w)); localStorage.setItem("svi_cfh_v1", Math.round(h)); } catch (e) {}
      };
      window.__cfRsz = true;
      const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); setTimeout(() => { window.__cfRsz = false; }, 300); };
      document.addEventListener("pointermove", mv);
      document.addEventListener("pointerup", up);
    });
    window.visualViewport?.addEventListener("resize", cfPlace);
    window.visualViewport?.addEventListener("scroll", cfPlace);

    /* v621 : « CHARGES QUI FONT n % » (colonne % de DÉTAIL CHARGES) */
    m.addEventListener("change", e => { const pi = e.target.closest && e.target.closest(".cf-par-in"); if (pi && shell.__cfParSet) shell.__cfParSet(pi.value, pi); });
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
      /* OK : le filtre coché s'applique ; ✕ (ou toucher ailleurs) : rien ne change */
      if (e.target.closest(".cf-ok")) {
        const all = cfValues(t, key);
        const keep = new Set(all.filter(v => cfOpen.draft.has(v)));
        const cond = cfReadCond(m);
        if (cond === false) { svToast("CONDITION INCOMPLÈTE : SAISIR LA OU LES VALEURS.", 2500); return; }
        if (keep.size === all.length && !cond) delete st.f[key];
        else st.f[key] = cond ? cfMakeF(keep.size === all.length ? null : keep, cond) : keep;
        cfClose();
        keepScroll.toTop = true;
        refreshAll();
        return;
      }
      if (e.target.closest(".cf-x")) {
        cfClose();
        return;
      }
      if (e.target.closest(".cf-clear")) {
        if (shell.__cfParClear) shell.__cfParClear(t, key);
        delete st.f[key];
        if (st.sort && st.sort.col === key) st.sort = null;
        m.querySelector(".cf-q").value = "";
        cfOpen.cond = null; cfCondUI(m);
        cfOpen.draft = new Set(cfValues(t, key));
        cfAfterChange();
      }
    });

    m.addEventListener("change", e => {
      const all = cfValues(t, key);
      const q = (m.querySelector(".cf-q").value || "").trim().toUpperCase();
      const shown = all.filter(v => !q || v.toUpperCase().includes(q));
      const keep = cfOpen.draft;
      if (e.target.matches("[data-cfall]")) {
        /* (TOUT SÉLECTIONNER) : seulement les valeurs affichées par la recherche */
        shown.forEach(v => e.target.checked ? keep.add(v) : keep.delete(v));
      } else if (e.target.matches("[data-cfv]")) {
        const v = e.target.dataset.cfv;
        e.target.checked ? keep.add(v) : keep.delete(v);
      } else {
        return;
      }
      /* rien ne s'applique au tableau avant OK */
      const sc = m.querySelector(".cf-list").scrollTop;
      cfRenderList();
      m.querySelector(".cf-list").scrollTop = sc;
    });

    /* recherche : réduit seulement la liste affichée, sans rien cocher ni décocher */
    m.querySelector(".cf-q").addEventListener("input", () => {
      cfRenderList();
      cfPlace();
    });

    cfCondUI(m);
    cfRenderList();
    /* placement APRÈS remplissage de la liste (hauteur réelle connue) */
    cfPlace();
    requestAnimationFrame(cfPlace);
  };

  /* fermeture du menu au toucher ailleurs (un seul écouteur actif) */
  /* v749 : un écouteur par kit (budget, achats…), remplacé quand le même kit est recréé */
  const HK = "__cfDocHandler" + (o.key ? "_" + o.key : "");
  if (window[HK]) {
    document.removeEventListener("click", window[HK], true);
  }
  window[HK] = e => {
    if (!cfOpen) return;
    if (e.target.closest("#cfMenu") || e.target.closest(".cf-btn") || e.target.closest("#svCal") || window.__cfRsz) return;
    cfClose();
  };
  document.addEventListener("click", window[HK], true);
  document.getElementById("cfMenu")?.remove();


  return { CF, cfSrc, cfT, cfApply, cfHead, cfClose, cfOpenMenu, cfMakeF };
}
/* ⟪ src/09d-couleurs-etats.js ⟫ */
/* =========================================================
   v754 : COULEURS DES ÉTATS — paramétrables (PARAMÉTRAGE › COULEURS), communes à toute l'application
   Une seule couleur par état (plus deux rouges différents) : variables CSS --st-<état> posées sur la page.
   EN INSTANCE, FIGÉ et VALIDÉ servent dès maintenant (liste des budgets, écran d'un budget) ;
   EXPIRÉ, BLOQUÉ et ARCHIVÉ servent aux états des budgets (lot 2).
   ========================================================= */
const SVI_COL_KEY = "svi_colors_v1";
/* v923 (remarque 1 du 04/11/2026) : REMIS orange (commande remise au fournisseur, paiement remis) ; NON LETTRÉ violet (banque, pour plus tard — distinct du violet d'ARCHIVÉ) */
const SVI_COL_DEF = { instance: "#b91c1c", fige: "#15803d", partiel: "#1d4ed8", remis: "#ea580c", valide: "#172033", nonlettre: "#a21caf", expire: "#b45309", bloque: "#6b7280", archive: "#6d28d9", encours: "#0e7490", annule: "#9ca3af" };
const SVI_COL_LAB = [["instance", "EN INSTANCE"], ["fige", "FIGÉ"], ["partiel", "PARTIELLEMENT ACHEVÉ"], ["remis", "REMIS"], ["valide", "VALIDÉ"], ["nonlettre", "NON LETTRÉ"], ["expire", "EXPIRÉ"], ["bloque", "BLOQUÉ"], ["archive", "ARCHIVÉ"], ["encours", "EN COURS DE VALIDATION"], ["annule", "ANNULÉ"]];   /* 06/11 : EN COURS DE VALIDATION, ANNULÉ ; v790 : PARTIELLEMENT ACHEVÉ (bleu) */
function sviColors() {
  let v = null; try { v = JSON.parse(localStorage.getItem(SVI_COL_KEY) || "null"); } catch (e) {}
  const o = { ...SVI_COL_DEF };
  if (v && typeof v === "object") Object.keys(o).forEach(k => { if (/^#[0-9a-f]{6}$/i.test(String(v[k] || ""))) o[k] = v[k]; });
  return o;
}
function sviColorsApply() {
  const C = sviColors(), r = document.documentElement;
  Object.keys(C).forEach(k => r.style.setProperty("--st-" + k, C[k]));
  /* 05/11 (document unique 2.10) : copie de la palette que rien ne remplace (ni le format d'une interface) — couleurs des noms liés */
  Object.keys(C).forEach(k => r.style.setProperty("--stg-" + k, C[k]));
}
function sviColorsSave(o) {
  try { localStorage.setItem(SVI_COL_KEY, JSON.stringify(o)); } catch (e) {}
  sviColorsApply();
}
sviColorsApply();

/* =========================================================
   v790 (DOCUMENT UNIQUE, partie 1 §1) : PALETTE — PARAMÉTRAGE › FORMAT. Pour chaque élément de l'interface :
   fond, couleur du texte, taille, gras, italique, souligné ; APPLIQUER À = toutes les interfaces ou certaines seulement.
   Seuls les réglages changés sont écrits (feuille #sviFmtStyle) : sans réglage, la base commune de styles.css s'applique.
   ========================================================= */
const SVI_FMT_KEY = "svi_format_v1";
const SVI_FMT_EL = [
  /* v924 (remarques 3 et 4 du 04/11/2026) : une HAUTEUR (h, px) pour chaque élément ; parties des fenêtres (win: réglées une fois pour toutes les fenêtres) */
  { k: "top", lab: "BARRE DU HAUT DE L'INTERFACE", sel: [".bdg-d-sticky .novapp-list-titlebar", ".novapp-list-shell > .novapp-list-titlebar", "#chs > .section-head"], def: { bg: "#ffffff", c: "#172033", fs: 28, b: 1, h: 54 } },
  /* B5 (série B) : le bandeau du milieu de la barre du haut (« FOURNISSEUR — … ») fait partie de la barre */
  /* 05/11 : le bandeau du milieu n'est plus un élément à part — il prend le fond, la couleur, la police et la taille de la barre du haut */
  /* 05/11 : l'en-tête DÉTAIL du budget (hors .bdg-d-block) et l'onglet actif des blocs SUIVI / RÉVISIONS (.active) suivent aussi le format */
  { k: "blk", lab: "EN-TÊTE DE BLOC", sel: [".bdg-d-block > .bdg-d-block-title", "#bdgDetailHead.bdg-d-block-title"], def: { bg: "#dde2e9", c: "#b91c1c", fs: 11, b: 1, h: 29 } },
  /* v923 (remarque 2) : FOND DES ONGLETS — seule la couleur du fond a un sens (f = réglages permis) */
  { k: "tabs", lab: "FOND DES ONGLETS", sel: [".bdg-d-tabs:not(.pg-grps):not(.pg-tabs)", "#bdgTabs", ".rec-tabs"], def: { bg: "#eceff3" }, f: ["bg"] },
  { k: "tab", lab: "ONGLET", sel: [".bdg-d-tab:not(.active):not(.on):not(.prm-grp):not(.prm-tab)", ".rec-tab:not(.on):not(.active)"], def: { bg: "#eceff3", c: "#6b7280", fs: 12, b: 1, h: 33 } },
  { k: "taba", lab: "ONGLET ACTIF", sel: [".bdg-d-tab.active:not(.prm-grp):not(.prm-tab)", ".bdg-d-tab.on:not(.prm-grp):not(.prm-tab)", ".rec-tab.on", ".rec-tab.active"], def: { bg: "#ffffff", c: "#b91c1c", fs: 12, b: 1, h: 33 } },
  /* C9 (série C, document unique 5.4) : PARAMÉTRAGE — deux rangées d'onglets, réglées séparément : ONGLETS DE MODULE (onglets de classeur
     sur une bande gris-vert, l'actif clair et raccordé à la rangée du dessous) et SOUS-ONGLETS (légers, l'actif marqué d'un trait dessous) */
  { k: "tabm", lab: "ONGLETS DE MODULE", sel: [".pg-grps .prm-grp:not(.on)"], def: { bg: "#cfd9d2", c: "#3f4d44", fs: 12, b: 1, h: 32 } },
  { k: "tabsub", lab: "SOUS-ONGLETS", sel: [".pg-tabs > .prm-tab"], def: { bg: "#f7f9f8", c: "#5b6670", fs: 11, b: 1, h: 30 } },
  { k: "th", lab: "TITRES DES COLONNES (EN-TÊTE DE TABLEAU)", sel: ["table thead th", ".ins-hcol .bdg-h-head"], def: { bg: "#f6f7f9", c: "#6b7480", fs: 11, b: 1, h: 22 } },
  { k: "ttl", lab: "LIGNES DE TITRE DANS UN TABLEAU", sel: ["tr.ins-title td", "tr.ins-gtitle td", ".dly-grp td", ".ins-hcol .ins-li.lot-grp"], def: { bg: "#ece8e1", c: "#2f2a24", fs: 12, b: 1, h: 21 } },
  { k: "row", lab: "LIGNES D'UN TABLEAU", sel: ["table tbody td"], def: { bg: "#ffffff", c: "#172033", fs: 12, b: 0, h: 21 } },
  { k: "new", lab: "LIGNE CRÉER … ICI", sel: ["tbody tr.ins-new td", "tbody tr.rec-new td", "tbody tr.scn-new td", "tbody tr.dly-new td", "tbody tr.bdg-newrow td", ".ins-hcol .ins-li.ins-new"], def: { bg: "#fdf0f0", c: "#b91c1c", fs: 12, b: 0, h: 21 } },
  /* E1 (série E, 06/11) : TRAITS DES TABLEAUX — couleur des traits entre les cases, réglée dans chaque palette (JOUR et NUIT indépendantes) */
  { k: "grid", lab: "TRAITS DES TABLEAUX", sel: ["table td", "table th"], def: { c: "#e5e8ed" }, f: ["c"], bd: 1 },
  { k: "tot", lab: "LIGNE TOTAL", sel: ["tfoot td", "tr.bdg-d-total-row td"], def: { bg: "#fdf0f0", c: "#b91c1c", fs: 12, b: 1, h: 21 } },
  { k: "win", lab: "BANDEAU DES FENÊTRES", sel: ["#svConf .svc-card > .svc-t", "#docPop .doc-head"], def: { bg: "#dde2e9", c: "#172033", fs: 15, b: 1, h: 41 }, win: 1 },
  { k: "winbg", lab: "FENÊTRES — FOND DE LA FENÊTRE", sel: ["#svConf .svc-card", "#docPop .doc-card"], def: { bg: "#ffffff" }, f: ["bg"], win: 1 },
  { k: "winlab", lab: "FENÊTRES — NOMS DES CHAMPS", sel: ["#svConf .frs-f > span", "#svConf label > span:first-child", "#docPop .doc-lab"], def: { c: "#475467", fs: 11, b: 1 }, f: ["c", "fs", "b", "i", "u"], win: 1 },
  { k: "winin", lab: "FENÊTRES — CHAMPS DE SAISIE", sel: ["#svConf input:not([type=checkbox]):not([type=radio]):not([type=color])", "#svConf select", "#svConf textarea", "#docPop .doc-in"], def: { bg: "#ffffff", c: "#172033", fs: 13, b: 0, h: 34 }, win: 1 },
  { k: "wincan", lab: "FENÊTRES — BOUTON ANNULER", sel: ["#svConf .svc-f .svc-b:not(.svc-ok)", "#docPop .doc-foot .doc-btn:not(.ok)"], def: { bg: "#ffffff", c: "#172033", fs: 13, b: 1, h: 38 }, win: 1 },
  /* 05/11 : autres parties des fenêtres */
  { k: "wsec", lab: "FENÊTRES — TITRES DES SECTIONS", sel: ["#svConf .frs-st", "#docPop .doc-sec-t"], def: { c: "#172033", fs: 12, b: 1 }, f: ["bg", "c", "fs", "b", "i", "u"], win: 1 },
  { k: "wtab", lab: "FENÊTRES — ONGLETS", sel: ["#svConf .rec-tabs .rec-tab", "#docPop .rec-tabs .rec-tab"], def: { bg: "#eceff3", c: "#6b7280", fs: 12, b: 1 }, win: 1 },
  { k: "wtbl", lab: "FENÊTRES — TABLEAUX (TITRES DES COLONNES)", sel: ["#svConf table thead th", "#docPop table thead th"], def: { bg: "#f6f7f9", c: "#6b7480", fs: 11, b: 1 }, win: 1 },
  { k: "walrt", lab: "FENÊTRES — BANDEAU D'ALERTE ⚠", sel: ["#svConf .frs-why", "#docPop .doc-why"], def: { bg: "#fef2f2", c: "#b91c1c", fs: 12, b: 1 }, win: 1 },
  { k: "wro", lab: "FENÊTRES — CHAMPS NON SAISISSABLES", sel: ["#svConf input[readonly]", "#svConf input:disabled", "#svConf select:disabled", "#docPop .doc-in[readonly]"], def: { bg: "#eef1f5", c: "#475467" }, f: ["bg", "c", "fs", "b"], win: 1 },
  { k: "wx", lab: "FENÊTRES — BOUTON ✕ DE FERMETURE", sel: ["#svConf .svc-close", "#docPop .doc-x"], def: { c: "#172033", fs: 16 }, f: ["bg", "c", "fs"], win: 1 },
  { k: "winok", lab: "FENÊTRES — BOUTON D'ACTION ENCADRÉ", sel: ["#svConf .svc-f .svc-b.svc-ok", "#docPop .doc-foot .doc-btn.ok"], def: { bg: "#ffffff", c: "#b91c1c", fs: 13, b: 1, h: 38 }, win: 1 }
];
/* interfaces auxquelles la palette peut s'appliquer (APPLIQUER À) */
const SVI_FMT_IF = [
  { k: "bdg", lab: "BUDGET (ÉCRAN D'UN BUDGET)", sc: [".bdg-d-page"] },
  { k: "bdgl", lab: "LISTE DES BUDGETS", sc: ["#bdg .novapp-list-shell"] },
  { k: "ach", lab: "ACHATS (LISTES ET PIÈCES)", sc: ["#ach"] },
  { k: "prm", lab: "PARAMÉTRAGE", sc: ["#chs"] },
  { k: "win", lab: "FENÊTRES", sc: ["#svConf"] }
];
/* v926 (remarque 10 du 04/11/2026, document unique 1.7) : LES INTERFACES — chaque pièce en a quatre (liste en instance, liste des validés,
   fiche en instance, fiche validée) ; le budget trois (listes en instance / validés, fiche budget) ; dans l'ordre du menu ≡.
   L'interface affichée est posée sur la page (html[data-svif]) : MODIFIER LE FORMAT vise celle-là. */
/* D1 (série D) : plus d'interfaces RETOURS DE COMMANDE, RETOURS DE RÉCEPTION, AVOIRS — ils sont dans COMMANDES, RÉCEPTIONS, FACTURES */
const SVI_IF_ACH = [["caf", "CONSULTATION", "CONSULTATIONS"], ["dvf", "DEVIS", "DEVIS"], ["cmf", "COMMANDE", "COMMANDES"],
  ["rcp", "RÉCEPTION", "RÉCEPTIONS"], ["faf", "FACTURE", "FACTURES"], ["paf", "PAIEMENT", "PAIEMENTS"],
  ["frs", "FOURNISSEUR", "FOURNISSEURS"], ["art", "ARTICLE", "ARTICLES"], ["bsn", "BESOIN", "BESOINS"]];
/* 06/11/2026 (décision) : UN SEUL TYPE DE LISTE, DE FICHE ET DE FENÊTRE par pièce, colorés selon l'état (palette) — MODIFIER LE FORMAT règle
   la LISTE, la FICHE et la FENÊTRE de chaque pièce (plus d'interfaces EN INSTANCE / VALIDÉES séparées) ; les anciens réglages sont repris */
const SVI_IFS = [
  { k: "bdgl", grp: "BUDGET", lab: "BUDGETS (LISTE)" }, { k: "bdg", grp: "BUDGET", lab: "FICHE BUDGET" }, { k: "bdg_w", grp: "BUDGET", lab: "FENÊTRE BUDGET", win: 1 },
  ...SVI_IF_ACH.flatMap(([k, one, many]) => [{ k: k + "_l", grp: "ACHATS", lab: many + " (LISTE)" }, { k: k + "_f", grp: "ACHATS", lab: "FICHE " + one }, { k: k + "_w", grp: "ACHATS", lab: "FENÊTRE " + one, win: 1 }]),
  { k: "achprm", grp: "ACHATS", lab: "PARAMÈTRES ACHATS" }, { k: "prm", grp: "PARAMÉTRAGE", lab: "PARAMÉTRAGE" }
];
/* ancienne clé d'interface → nouvelle (bdgl_i / bdgl_v → bdgl ; caf_li / caf_lv → caf_l ; caf_fi / caf_fv → caf_f) */
const sviIfNew = k => k === "bdgl_i" || k === "bdgl_v" ? "bdgl" : String(k).replace(/_(l|f)[iv]$/, "_$1");
/* interface de base d'une fenêtre (caf_w → caf_l et caf_f ; bdg_w → bdgl et bdg) */
const sviIfWinOf = k => k === "bdg_w" ? ["bdgl", "bdg"] : [k.replace(/_w$/, "_l"), k.replace(/_w$/, "_f")];
function sviIfCur() {
  const on = id => { const v = document.getElementById(id); return !!v && v.classList.contains("active-view"); };
  if (on("bdg")) return document.querySelector("#bdg .bdg-d-page") ? "bdg" : "bdgl";
  if (on("ach")) { let t = "art"; try { t = localStorage.getItem("svi_ach_tab_v1") || "art"; } catch (e) {} if (t === "prm") return "achprm";
    return t + (document.querySelector("#ach .nvp") ? "_f" : "_l"); }
  if (on("chs")) return "prm";
  return "";
}
{ let raf = 0; const set = () => { raf = 0; const k = sviIfCur(), r = document.documentElement; if ((r.dataset.svif || "") !== k) { if (k) r.dataset.svif = k; else delete r.dataset.svif; } };
  const go = () => { if (!raf) raf = requestAnimationFrame(set); };
  const start = () => { new MutationObserver(go).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] }); go(); };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start); }
function sviFmt() {
  let v = null; try { v = JSON.parse(localStorage.getItem(SVI_FMT_KEY) || "null"); } catch (e) {}
  if (!(v && typeof v === "object")) return { el: {}, to: null, blk: {}, by: {}, cat: {} };
  /* 06/11 : anciens réglages EN INSTANCE / VALIDÉ repris dans la LISTE, la FICHE, la FENÊTRE de la pièce (le réglage EN INSTANCE passe devant) */
  const by = {}, B = v.by && typeof v.by === "object" ? v.by : {};
  Object.keys(B).sort((a, b) => /_lv$|_fv$|bdgl_v/.test(a) - /_lv$|_fv$|bdgl_v/.test(b)).forEach(k => { const n = sviIfNew(k); if (!by[n]) by[n] = B[k]; });
  const cat = {}, CA = v.cat && typeof v.cat === "object" ? v.cat : {}, CM = { li: "l", lv: "l", fi: "f", fv: "f", wi: "w", wv: "w" };
  ["li", "fi", "wi", "lv", "fv", "wv", "l", "f", "w"].forEach(k => { if (!CA[k]) return; const n = CM[k] || k; if (!cat[n]) cat[n] = CA[k]; });
  return { el: v.el || {}, to: Array.isArray(v.to) ? v.to : null, blk: v.blk || {}, by, cat };
}
/* v927 (remarque 12 du 04/11/2026) : réglage propre à une interface (MODIFIER LE FORMAT) — F.by[interface] = { el, st: { c, bg } } ;
   il passe devant le réglage commun, seulement quand cette interface est affichée (html[data-svif]) */
/* 05/11 : les LIGNES DE TITRE ont leurs propres règles de couleur (variables --ttl-c / --ttl-bg) — le format règle aussi ces variables */
const sviFmtVars = (E, o) => E.k !== "ttl" ? "" : [o.c ? `--ttl-c:${o.c}` : "", o.bg ? `--ttl-bg:${o.bg}` : ""].filter(Boolean).join(";");
const sviFmtDecl = (o, E) => { const d = [];
  if (E && E.bd) { if (o.c) d.push(`border-color:${o.c}!important`); return d; }   /* E1 : traits des tableaux */
  if (o.bg) d.push(`background:${o.bg}!important`);
  if (o.c) d.push(`color:${o.c}!important;-webkit-text-fill-color:${o.c}!important`);
  if (o.fs) d.push(`font-size:${+o.fs}px!important`);
  if (o.b !== undefined) d.push(`font-weight:${o.b ? 800 : 400}!important`);
  if (o.i !== undefined) d.push(`font-style:${o.i ? "italic" : "normal"}!important`);
  if (o.u !== undefined) d.push(`text-decoration:${o.u ? "underline" : "none"}!important`);
  if (+o.h >= 10 && +o.h <= 120) d.push(`height:${+o.h}px!important;min-height:0!important;box-sizing:border-box!important`);
  return d; };
/* 05/11 : RÉGLAGES COMMUNS en arbre — LISTE / FICHE / FENÊTRE, chacune EN INSTANCE et VALIDÉE ; seuls les éléments qui existent dans chacune
   (une liste validée n'a pas de ligne CRÉER … ICI) ; ils passent devant le réglage de tout le programme, derrière celui d'une interface */
const SVI_FMT_CAT = [
  ["l", "LISTE", ['html[data-svif$="_l"]', 'html[data-svif="bdgl"]'], ["top", "th", "row", "new", "tot", "grid"]],
  ["f", "FICHE", ['html[data-svif$="_f"]', 'html[data-svif="bdg"]'], ["top", "blk", "tabs", "tab", "taba", "th", "ttl", "row", "new", "tot", "grid"]],
  ["w", "FENÊTRE", ['html[data-svif$="_l"]', 'html[data-svif$="_f"]', 'html[data-svif="bdgl"]', 'html[data-svif="bdg"]'], null]];
const sviFmtCatEls = c => { const C = SVI_FMT_CAT.find(x => x[0] === c); return !C ? [] : C[3] ? SVI_FMT_EL.filter(E => C[3].includes(E.k)) : SVI_FMT_EL.filter(E => E.win); };
function sviFmtCssCat(F) { const out = [];
  SVI_FMT_CAT.forEach(([c, , pre]) => { const el = ((F.cat || {})[c] || {}).el || {};
    sviFmtCatEls(c).forEach(E => { const o0 = el[E.k]; if (!o0) return; const o = E.f ? Object.fromEntries(Object.entries(o0).filter(([f]) => E.f.includes(f))) : o0, d = sviFmtDecl(o, E); if (!d.length) return;
      out.push(pre.flatMap(p => E.sel.map(s => p + " body " + s)).join(", ") + " { " + d.join("; ") + " }");
      const vv = sviFmtVars(E, o); if (vv) out.push(pre.map(p => p + " body").join(", ") + " { " + vv + " }"); }); });
  return out.join("\n"); }
function sviFmtCssBy(F) {
  const out = [];
  Object.keys(F.by || {}).forEach(k => { const B = F.by[k] || {}, W = /_w$/.test(k), PP = W ? sviIfWinOf(k).map(x => `html[data-svif="${x}"] body `) : [`html[data-svif="${k}"] body `], P = PP[0];
    /* 06/11 : FENÊTRE d'une pièce (k_w) — seulement les parties des fenêtres, quand la liste ou la fiche de cette pièce est affichée */
    SVI_FMT_EL.forEach(E => { if (!!E.win !== W) return; const o0 = (B.el || {})[E.k]; if (!o0) return;
      const o = E.f ? Object.fromEntries(Object.entries(o0).filter(([f]) => E.f.includes(f))) : o0, d = sviFmtDecl(o, E); if (!d.length) return;
      out.push(PP.flatMap(p => E.sel.map(x => p + x)).join(", ") + " { " + d.join("; ") + " }"); const vv = sviFmtVars(E, o); if (vv) out.push(PP.map(p => p.trim()).join(", ") + " { " + vv + " }"); });
    if (W) return;
    const st = B.st || {};
    /* 06/11 : plus de couleur d'écran forcée par interface — elle suit l'état de la pièce (palette) */
    if (st.bg) out.push(`html[data-svif="${k}"] body, ${P}.view, ${P}.bdg-d-page, ${P}.nvp { background: ${st.bg} !important; }`); });
  return out.join("\n");
}
function sviFmtCss(F) {
  const out = [], all = !F.to || F.to.length >= SVI_FMT_IF.length;
  const SC = all ? null : SVI_FMT_IF.filter(x => F.to.includes(x.k)).flatMap(x => x.sc);
  /* E1 : palette NUIT sans réglage des traits — traits sombres de la nuit (plus de règle écrite en dur dans la feuille de styles) */
  const EL = { ...F.el }; try { if (!EL.grid && document.documentElement.classList.contains("svi-nuit")) EL.grid = { c: "#334155" }; } catch (e) {}
  SVI_FMT_EL.forEach(E => {
    const o0 = EL[E.k]; if (!o0) return;
    const o = E.f ? Object.fromEntries(Object.entries(o0).filter(([f]) => E.f.includes(f))) : o0;   /* v923 : seulement les réglages permis */
    const d = sviFmtDecl(o, E);   /* v924 : hauteur ; E1 : traits */
    if (!d.length) return;
    const sels = SC && !E.win ? SC.flatMap(sc => E.sel.map(x => x.startsWith(sc) ? x : sc + " " + x)).filter(x => !(x.startsWith("#svConf ") && x.indexOf(" #svConf") > 0)) : E.sel;
    if (!sels.length) return;
    out.push(sels.map(x => "html body " + x).join(", ") + " { " + d.join("; ") + " }");
    const vv = sviFmtVars(E, o); if (vv) out.push((SC ? SC.map(x => "html body " + x).join(", ") : "html body") + " { " + vv + " }");
  });
  const ca = sviFmtCssCat(F); if (ca) out.push(ca);
  const by = sviFmtCssBy(F); if (by) out.push(by);
  return out.join("\n");
}
/* v925 (remarque 5 du 04/11/2026) : BLOCS — lignes affichées par défaut (5) et en mode réduit (1, + CRÉER + TOTAL) ; agrandir reste à la poignée */
function sviBlkRows(F) { const b = ((F || sviFmt()).blk) || {}, n = Math.max(1, Math.min(30, parseInt(b.n, 10) || 5)), r = Math.max(1, Math.min(n, parseInt(b.r, 10) || 1)); return { n, r }; }
function sviFmtApply() {
  let st = document.getElementById("sviFmtStyle");
  if (!st) { st = document.createElement("style"); st.id = "sviFmtStyle"; (document.head || document.documentElement).appendChild(st); }
  const F = sviFmt(); st.textContent = sviFmtCss(F);
  /* v925 : hauteurs par défaut des blocs = titres des colonnes + n lignes (+ TOTAL), d'après les hauteurs réglées */
  try { const { n } = sviBlkRows(F), H = k => +((F.el[k] || {}).h) || (SVI_FMT_EL.find(x => x.k === k) || { def: {} }).def.h || 21, r = document.documentElement.style;
    r.setProperty("--svi-blk-n", n); r.setProperty("--svi-hdef-t", (H("th") + n * H("row") + H("tot")) + "px"); r.setProperty("--svi-hdef-n", (H("th") + n * H("row") + 2) + "px");
    r.setProperty("--svi-hdef-h", (n * 21 + 23) + "px"); r.setProperty("--svi-hdef-a", (n * 34 + 30) + "px"); } catch (e) {}
}
/* v927 (remarques 12 et 13) : FENÊTRE DU FORMAT — MODIFIER LE FORMAT (une interface : ÉTAT de l'écran puis les éléments) ou
   RÉGLAGES COMMUNS (accueil : couleurs des états, éléments, parties des fenêtres, blocs ; APPLIQUER PARTOUT remplace les réglages par interface) */
/* 05/11 : deux PALETTES, JOUR et NUIT — chacune garde ses réglages communs (éléments, blocs) et ses couleurs d'états ; on passe de l'une à l'autre
   dans les RÉGLAGES COMMUNS. DÉFINIR COMME PAR DÉFAUT : le réglage en cours devient celui que PAR DÉFAUT rétablit (au lieu de celui d'origine). */
const SVI_PAL_K = "svi_pal_v1";
const sviPal = () => { let o = null; try { o = JSON.parse(localStorage.getItem(SVI_PAL_K) || "null"); } catch (e) {} return o && typeof o === "object" ? o : { mode: "jour" }; };
const sviPalSave = o => { try { localStorage.setItem(SVI_PAL_K, JSON.stringify(o)); } catch (e) {} };
const SVI_NUIT = { el: { top: { bg: "#0f172a", c: "#e2e8f0" }, blk: { bg: "#1f2937", c: "#e5e7eb" }, tabs: { bg: "#111827" }, tab: { bg: "#1f2937", c: "#cbd5e1" }, taba: { bg: "#334155", c: "#ffffff" }, tabm: { bg: "#1f2a24", c: "#cbd5e1" }, tabsub: { bg: "#111827", c: "#cbd5e1" },
  th: { bg: "#1f2937", c: "#e5e7eb" }, ttl: { bg: "#1e293b", c: "#e5e7eb" }, row: { bg: "#0b1220", c: "#e5e7eb" }, new: { bg: "#3f1d1d", c: "#fecaca" }, tot: { bg: "#1e293b", c: "#ffffff" },
  win: { bg: "#0f172a", c: "#e2e8f0" }, winbg: { bg: "#111827" }, winlab: { c: "#cbd5e1" }, winin: { bg: "#1f2937", c: "#f8fafc" }, grid: { c: "#334155" } }, blk: {}, to: null, by: {} };
const sviPalApply = () => { try { document.documentElement.classList.toggle("svi-nuit", sviPal().mode === "nuit"); sviFmtApply(); } catch (e) {} };
try { sviPalApply(); } catch (e) {}
/* C10, D4 (document unique 1.9) : choix PALETTE en haut, dans le bandeau du titre de RÉGLAGES COMMUNS et de MODIFIER LE FORMAT */
/* D4, D6 (série D, document unique 1.9) : PALETTE — JOUR, NUIT ou AUTOMATIQUE (DÉBUT et FIN DE LA NUIT, heure du FUSEAU HORAIRE de la société) ;
   en AUTOMATIQUE, un choix JOUR ou NUIT fait à la main vaut jusqu'au prochain changement d'heure, puis AUTOMATIQUE reprend */
const SVI_PAL_AUTO = { deb: "19:00", fin: "07:00" };
const sviPalAuto = P => ({ on: false, ...SVI_PAL_AUTO, ...((P || sviPal()).auto || {}) });
const sviHm = v => { const m = /^(\d{2}):(\d{2})$/.exec(String(v || "")); return m && +m[1] <= 23 && +m[2] <= 59 ? +m[1] * 60 + +m[2] : null; };
const sviTzMin = () => { let tz = 1; try { tz = parseFloat(((typeof sviPg === "function" ? sviPg() : {}).gen || {}).tz || "+1") || 0; } catch (e) {} const d = new Date(); return ((d.getUTCHours() * 60 + d.getUTCMinutes() + Math.round(tz * 60)) % 1440 + 1440) % 1440; };
const sviPalNight = (A, m) => { const a = sviHm(A.deb), b = sviHm(A.fin); if (a === null || b === null || a === b) return false; return a < b ? m >= a && m < b : m >= a || m < b; };
const sviPalAutoMode = P => sviPalNight(sviPalAuto(P), sviTzMin()) ? "nuit" : "jour";
/* minutes jusqu'au prochain changement d'heure (début ou fin de la nuit) */
const sviPalNextMs = P => { const A = sviPalAuto(P), m = sviTzMin(), d = x => { const v = sviHm(x); return v === null ? 1440 : ((v - m) % 1440 + 1440) % 1440 || 1440; }; return Math.min(d(A.deb), d(A.fin)) * 60000; };
function sviPalSwitch(to) { const P = sviPal(), cur = P.mode === "nuit" ? "nuit" : "jour"; if (to === cur) return false;
  P[cur] = { F: JSON.parse(JSON.stringify(sviFmt())), CD: { ...sviColors() } };
  const nx = P[to] || (to === "nuit" ? { F: JSON.parse(JSON.stringify(SVI_NUIT)), CD: { ...sviColors() } } : { F: { el: {}, blk: {}, to: null, by: {} }, CD: { ...SVI_COL_DEF } });
  P.mode = to; sviPalSave(P); sviFmtSave(JSON.parse(JSON.stringify(nx.F))); sviColorsSave({ ...nx.CD }); sviPalApply(); return true; }
function sviPalTick() { try { const P = sviPal(), A = sviPalAuto(P); if (!A.on) return;
  if (P.man && Date.now() < P.man.until) return; if (P.man) { delete P.man; sviPalSave(P); }
  if (document.querySelector(".fmw-card")) return;   /* fenêtre du format ouverte : elle suit son propre état */
  sviPalSwitch(sviPalAutoMode(P)); } catch (e) {} }
setInterval(sviPalTick, 30000); document.addEventListener("visibilitychange", () => { if (!document.hidden) sviPalTick(); }); setTimeout(sviPalTick, 500);
const sviPalBtns = () => { const P = sviPal(), A = sviPalAuto(P), nuit = P.mode === "nuit";
  return `<span class="fmw-pal">PALETTE <button type="button" class="svc-b${!nuit ? " on" : ""}" data-pal="jour">☀ JOUR</button><button type="button" class="svc-b${nuit ? " on" : ""}" data-pal="nuit">☾ NUIT</button>`
    + `<button type="button" class="svc-b${A.on ? " on" : ""}" data-pal="auto" title="AUTOMATIQUE : NUIT ENTRE LE DÉBUT ET LA FIN DE LA NUIT (HEURE DU FUSEAU HORAIRE DE LA SOCIÉTÉ)">◐ AUTOMATIQUE</button>`
    + (A.on ? `<label class="fmw-palt-l">DÉBUT DE LA NUIT <input class="fmw-palt" data-palt="deb" value="${esc(A.deb)}" inputmode="numeric" maxlength="5" autocomplete="off"></label><label class="fmw-palt-l">FIN DE LA NUIT <input class="fmw-palt" data-palt="fin" value="${esc(A.fin)}" inputmode="numeric" maxlength="5" autocomplete="off"></label>` : "") + `</span>`; };
function sviFmtWin(ifk) {
  const D = JSON.parse(JSON.stringify(sviFmt())); D.by = D.by || {}; D.cat = D.cat || {}; const OPEN = new Set();
  const CD = { ...sviColors() };
  const S = ifk ? (D.by[ifk] = D.by[ifk] || { el: {}, st: {} }) : D; S.el = S.el || {}; if (ifk) S.st = S.st || {};
  const IF = ifk ? (SVI_IFS.find(x => x.k === ifk) || { lab: ifk }) : null, WIN = !!(IF && IF.win);
  const ELS = SVI_FMT_EL.filter(E => !ifk || !!E.win === WIN);
  const val = (E, f) => { const o = S.el[E.k] || {}; if (o[f] !== undefined) return o[f]; if (ifk && (D.el[E.k] || {})[f] !== undefined) return D.el[E.k][f]; return E.def[f]; };
  const ok = (E, f) => !E.f || E.f.includes(f), NA = '<td class="center fmt-na">—</td>';
  const preview = () => { const st = document.getElementById("sviFmtStyle"); if (st) st.textContent = sviFmtCss(D); const r = document.documentElement; Object.keys(CD).forEach(k => r.style.setProperty("--st-" + k, CD[k])); };
  const d = sviWinNew();
  const draw = () => { D.cat = D.cat || {}; D.by = D.by || {};
    /* 06/11 : la couleur de l'écran suit l'état de la pièce (palette des états) ; ici, seulement le FOND de l'écran ; FENÊTRE : rien */
    const stRow = ifk ? (WIN ? "" : `<table class="prm-table fmt-t fmt-st"><colgroup><col style="width:300px"><col style="width:110px"></colgroup><thead><tr><th>ÉCRAN (COULEUR DU TEXTE : CELLE DE L'ÉTAT)</th><th class="center">FOND</th></tr></thead>
        <tbody><tr><td>FOND DE L'ÉCRAN</td><td class="center"><input type="color" class="fmw-st" data-f="bg" value="${esc(S.st.bg || "#f4f7fb")}"></td></tr></tbody></table>`)
      : `<table class="prm-table fmt-t fmt-cols"><colgroup><col style="width:300px"><col style="width:110px"></colgroup><thead><tr><th>ÉTATS</th><th class="center">COULEUR</th></tr></thead>
        <tbody>${SVI_COL_LAB.map(([k, l]) => `<tr><td style="color:${esc(CD[k])}">${l}</td><td class="center"><input type="color" class="fmw-col" data-col="${k}" value="${esc(CD[k])}"></td></tr>`).join("")}</tbody></table>`;
    const elT = `<table class="prm-table fmt-t fmt-el"><colgroup><col style="width:300px"><col style="width:70px"><col style="width:70px"><col style="width:70px"><col style="width:60px"><col style="width:70px"><col style="width:76px"><col style="width:76px"></colgroup>
        <thead><tr><th>ÉLÉMENT</th><th class="center">FOND</th><th class="center">TEXTE</th><th class="center">TAILLE</th><th class="center">GRAS</th><th class="center">ITALIQUE</th><th class="center">SOULIGNÉ</th><th class="center">HAUTEUR</th></tr></thead>
        <tbody>${ELS.map(E => `<tr data-el="${E.k}"><td>${esc(E.lab)}</td>`
          + (ok(E, "bg") ? `<td class="center"><input type="color" class="fmw-in" data-f="bg" value="${esc(val(E, "bg") || "#ffffff")}"></td>` : NA)
          + (ok(E, "c") ? `<td class="center"><input type="color" class="fmw-in" data-f="c" value="${esc(val(E, "c") || "#000000")}"></td>` : NA)
          + (ok(E, "fs") ? `<td class="center"><input class="fmw-in center" data-f="fs" inputmode="numeric" value="${esc(val(E, "fs") || "")}"></td>` : NA)
          + ["b", "i", "u"].map(f => ok(E, f) ? `<td class="center"><input type="checkbox" class="fmw-in" data-f="${f}"${val(E, f) ? " checked" : ""}></td>` : NA).join("")
          + (ok(E, "h") && val(E, "h") ? `<td class="center"><input class="fmw-in center" data-f="h" inputmode="numeric" value="${esc(val(E, "h"))}"></td>` : NA) + `</tr>`).join("")}</tbody></table>`;
    const B = sviBlkRows(D);
    const blkT = ifk ? "" : `<table class="prm-table fmt-t fmt-blk"><colgroup><col style="width:300px"><col style="width:90px"></colgroup><thead><tr><th>BLOCS</th><th class="center">LIGNES</th></tr></thead>
        <tbody><tr><td>LIGNES AFFICHÉES PAR DÉFAUT</td><td class="center"><input class="fmw-blk center" data-b="n" inputmode="numeric" value="${B.n}"></td></tr>
        <tr><td>LIGNES EN MODE RÉDUIT (+ CRÉER ET TOTAL)</td><td class="center"><input class="fmw-blk center" data-b="r" inputmode="numeric" value="${B.r}"></td></tr></tbody></table>`;
    const cv = (c, E, f) => { const o = ((D.cat[c] || {}).el || {})[E.k] || {}; if (o[f] !== undefined) return o[f]; return val(E, f); };
    const catRow = (c, E) => `<tr data-el="${E.k}" data-cat="${c}" class="fmt-catr"><td><span class="fmt-ind"></span>${esc(E.lab)}</td>`
      + (ok(E, "bg") ? `<td class="center"><input type="color" class="fmw-in" data-f="bg" value="${esc(cv(c, E, "bg") || "#ffffff")}"></td>` : NA)
      + (ok(E, "c") ? `<td class="center"><input type="color" class="fmw-in" data-f="c" value="${esc(cv(c, E, "c") || "#000000")}"></td>` : NA)
      + (ok(E, "fs") ? `<td class="center"><input class="fmw-in center" data-f="fs" inputmode="numeric" value="${esc(cv(c, E, "fs") || "")}"></td>` : NA)
      + ["b", "i", "u"].map(f => ok(E, f) ? `<td class="center"><input type="checkbox" class="fmw-in" data-f="${f}"${cv(c, E, f) ? " checked" : ""}></td>` : NA).join("") + NA + `</tr>`;
    const catT = ifk ? "" : `<table class="prm-table fmt-t fmt-cat"><colgroup><col style="width:300px"><col style="width:70px"><col style="width:70px"><col style="width:70px"><col style="width:60px"><col style="width:70px"><col style="width:76px"><col style="width:76px"></colgroup>
        <thead><tr><th>PAR ÉTAT (LISTE, FICHE, FENÊTRE)</th><th class="center">FOND</th><th class="center">TEXTE</th><th class="center">TAILLE</th><th class="center">GRAS</th><th class="center">ITALIQUE</th><th class="center">SOULIGNÉ</th><th class="center"></th></tr></thead>
        <tbody>${SVI_FMT_CAT.map(([c, l]) => `<tr class="fmt-catg" data-catg="${c}"><td colspan="8"><button type="button" class="pg-fold" data-catf="${c}">${OPEN.has(c) ? "⌄" : "›"}</button> <b>${l}</b>${Object.keys((D.cat[c] || {}).el || {}).length ? ` <span class="svi-cnt">${Object.keys(D.cat[c].el).length}</span>` : ""}</td></tr>`
          + (OPEN.has(c) ? sviFmtCatEls(c).map(E => catRow(c, E)).join("") : "")).join("")}</tbody></table>`;
    d.innerHTML = sviWinCard({ cls: "fmw-card", close: "data-x", title: `<span class="fmw-ttl">${ifk ? "MODIFIER LE FORMAT — " + esc(IF.lab) : "RÉGLAGES COMMUNS — TOUT LE PROGRAMME"}</span>${sviPalBtns()}`,   /* C10, D4 : choix de la palette dans le bandeau */
      body: `<div class="fmw-scroll">${stRow}${elT}${catT}${blkT}</div>`,
      foot: `<button type="button" class="svc-b" data-x>ANNULER</button>${ifk && !WIN && SVI_IFS.some(x => x.win && sviIfWinOf(x.k).includes(ifk)) ? `<button type="button" class="svc-b" data-fwin="${esc(SVI_IFS.find(x => x.win && sviIfWinOf(x.k).includes(ifk)).k)}">FENÊTRE DE CETTE PIÈCE</button>` : ""}${ifk ? "" : `<button type="button" class="svc-b" data-setdef>DÉFINIR COMME PAR DÉFAUT</button>`}<button type="button" class="svc-b" data-def>PAR DÉFAUT</button><button type="button" class="svc-b svc-ok svc-neutral" data-save>${ifk ? "ENREGISTRER" : "APPLIQUER PARTOUT"}</button>` });
  };
  draw(); sviWinShow(d);
  const num = (v, a, b) => { const n = parseInt(String(v).replace(/\D/g, ""), 10); return n >= a && n <= b ? n : null; };
  d.addEventListener("input", e => { const i = e.target;
    if (i.matches(".fmw-st")) { S.st[i.dataset.f] = i.value; preview(); return; }
    if (i.matches(".fmw-col")) { CD[i.dataset.col] = i.value; preview(); return; }
    if (i.matches(".fmw-in") && i.type !== "checkbox") { const tr = i.closest("tr"), k = tr.dataset.el, f = i.dataset.f, T = tr.dataset.cat ? ((D.cat[tr.dataset.cat] = D.cat[tr.dataset.cat] || { el: {} }).el) : S.el; T[k] = T[k] || {};
      if (f === "fs" || f === "h") { const n = f === "fs" ? num(i.value, 8, 40) : num(i.value, 10, 120); if (n === null) return; T[k][f] = n; } else T[k][f] = i.value; preview(); } });
  /* D6 : heures de la nuit — HH:MM seulement (chiffres, deux-points posé d'office), de 00:00 à 23:59, début et fin différents ;
     une heure refusée est signalée près du champ, qui reprend sa valeur précédente */
  d.addEventListener("input", e => { const i = e.target; if (!i.matches(".fmw-palt")) return; const g = String(i.value).replace(/\D/g, "").slice(0, 4); const v = g.length > 2 ? g.slice(0, 2) + ":" + g.slice(2) : g; if (v !== i.value) i.value = v; });
  d.addEventListener("change", e => { const i = e.target; if (!i.matches(".fmw-palt")) return; const P = sviPal(), A = sviPalAuto(P), k = i.dataset.palt, v = String(i.value).trim();
    const bad = sviHm(v) === null ? "HEURE NON VALIDE : HH:MM, DE 00:00 À 23:59." : v === A[k === "deb" ? "fin" : "deb"] ? "LE DÉBUT ET LA FIN DE LA NUIT DOIVENT ÊTRE DIFFÉRENTS." : "";
    if (bad) { svToast(bad, 3500, i); i.value = A[k]; return; }
    A[k] = v; P.auto = A; delete P.man; sviPalSave(P); const to = sviPalAutoMode(P);
    if (A.on && to !== (P.mode === "nuit" ? "nuit" : "jour")) { const b = document.createElement("button"); b.dataset.pal = to; b.hidden = true; d.querySelector(".svc-card").appendChild(b); b.click(); } }, true);
  d.addEventListener("change", e => { const i = e.target;
    if (i.matches(".fmw-in") && i.type === "checkbox") { const tr = i.closest("tr"), k = tr.dataset.el, T = tr.dataset.cat ? ((D.cat[tr.dataset.cat] = D.cat[tr.dataset.cat] || { el: {} }).el) : S.el; T[k] = T[k] || {}; T[k][i.dataset.f] = i.checked ? 1 : 0; preview(); }
    if (i.matches(".fmw-blk")) { const n = num(i.value, 1, 30); if (n === null) { svToast("ENTRE 1 ET 30 LIGNES.", 2500, i); return; } D.blk = { ...sviBlkRows(D), [i.dataset.b]: n }; D.blk = sviBlkRows(D); } });
  d.addEventListener("click", e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); sviFmtApply(); sviColorsApply(); return; }
    const fw = e.target.closest("[data-fwin]"); if (fw) { d.remove(); sviFmtApply(); sviColorsApply(); sviFmtWin(fw.dataset.fwin); return; }
    const cf = e.target.closest("[data-catf]"); if (cf) { const c = cf.dataset.catf; if (OPEN.has(c)) OPEN.delete(c); else OPEN.add(c); draw(); return; }
    const pb = e.target.closest("[data-pal]"); if (pb && pb.dataset.pal === "auto") { const P = sviPal(), A = sviPalAuto(P); A.on = !A.on; P.auto = A; delete P.man; sviPalSave(P);
      const to = A.on ? sviPalAutoMode(P) : (P.mode === "nuit" ? "nuit" : "jour"); svToast(A.on ? "PALETTE AUTOMATIQUE : NUIT DE " + A.deb + " À " + A.fin + "." : "PALETTE AUTOMATIQUE ARRÊTÉE.", 2500);
      if (to === (P.mode === "nuit" ? "nuit" : "jour")) { draw(); return; } pb.dataset.pal = to; }
    if (pb && pb.dataset.pal !== "auto") { const P = sviPal(), cur = P.mode === "nuit" ? "nuit" : "jour", to = pb.dataset.pal;
      if (sviPalAuto(P).on && pb.isConnected && !pb.matches('[data-pal="auto"]') && to !== sviPalAutoMode(P)) { P.man = { until: Date.now() + sviPalNextMs(P) }; sviPalSave(P); }
      if (to === cur) { draw(); return; }
      P[cur] = { F: JSON.parse(JSON.stringify(D)), CD: { ...CD } }; const nx = P[to] || (to === "nuit" ? { F: JSON.parse(JSON.stringify(SVI_NUIT)), CD: { ...CD } } : { F: { el: {}, blk: {}, to: null, by: {} }, CD: { ...SVI_COL_DEF } });
      Object.keys(D).forEach(k => delete D[k]); Object.assign(D, JSON.parse(JSON.stringify(nx.F))); Object.keys(CD).forEach(k => delete CD[k]); Object.assign(CD, nx.CD); P.mode = to; sviPalSave(P);
      sviFmtSave(D); sviColorsSave(CD); sviPalApply(); preview(); draw(); svToast("PALETTE " + (to === "nuit" ? "DE NUIT" : "DE JOUR") + ".", 2000); return; }
    if (e.target.closest("[data-setdef]")) { const P = sviPal(); P.def = P.def || {}; P.def[P.mode === "nuit" ? "nuit" : "jour"] = { F: JSON.parse(JSON.stringify(D)), CD: { ...CD } }; sviPalSave(P); svToast("CE RÉGLAGE EST MAINTENANT LE PAR DÉFAUT.", 2500); return; }
    if (e.target.closest("[data-def]")) { if (ifk) { S.el = {}; S.st = {}; } else { const P = sviPal(), u = (P.def || {})[P.mode === "nuit" ? "nuit" : "jour"];
        if (u) { Object.keys(D).forEach(k => delete D[k]); Object.assign(D, JSON.parse(JSON.stringify(u.F))); Object.keys(CD).forEach(k => delete CD[k]); Object.assign(CD, u.CD); }
        else if (P.mode === "nuit") { Object.keys(D).forEach(k => delete D[k]); Object.assign(D, JSON.parse(JSON.stringify(SVI_NUIT))); Object.assign(CD, SVI_COL_DEF); }
        else { D.el = {}; D.blk = {}; D.cat = {}; Object.assign(CD, SVI_COL_DEF); } } preview(); draw(); return; }
    if (e.target.closest("[data-save]")) { if (ifk) { if (!Object.keys(S.el).length && !Object.keys(S.st).length) delete D.by[ifk]; } else D.by = {};
      sviFmtSave(D); sviColorsSave(CD); d.remove(); svToast(ifk ? "FORMAT DE CETTE INTERFACE ENREGISTRÉ." : "RÉGLAGES COMMUNS APPLIQUÉS PARTOUT.", 2500); } });
  return d;
}
const sviFmtCurWin = () => sviFmtWin(document.documentElement.dataset.svif || sviIfCur() || "bdg");
function sviFmtSave(F) { try { localStorage.setItem(SVI_FMT_KEY, JSON.stringify(F)); } catch (e) {} sviFmtApply(); }
try { sviFmtApply(); } catch (e) {}

/* =========================================================
   v755 : FILTRE PAR ÉTAT (comme NovApp : ACTIF, ALERTE, EXPIRÉ, BLOQUÉ, ARCHIVÉ, TOUT), COMMUN À TOUTES LES LISTES
   sviEtatMenu(btn, items, cur, pick) — items : [{ k, lab, n }] ; petite liste sous le bouton, ✓ devant l'état choisi,
   nombre d'enregistrements de chaque état ; un toucher choisit (pick(k)) et ferme ; toucher ailleurs ferme.
   ========================================================= */
function sviEtatMenu(btn, items, cur, pick) {
  const old = document.getElementById("sviEtatMenu");
  if (old) { const same = old.__btn === btn; old.remove(); if (same) return; }
  const m = document.createElement("div");
  m.id = "sviEtatMenu";
  m.__btn = btn;
  m.innerHTML = items.map(x => `<button type="button" data-k="${esc(x.k)}" class="${x.k === cur ? "on" : ""}"><b>${x.k === cur ? "✓" : ""}</b><span>${esc(x.lab)}</span>${x.n === undefined ? "" : svCnt(x.n)}</button>`).join("");
  document.body.appendChild(m);
  sviPlaceMenu(m, btn.getBoundingClientRect());
  m.addEventListener("click", e => { const b = e.target.closest("[data-k]"); if (!b) return; e.stopPropagation(); m.remove(); pick(b.dataset.k); });
  setTimeout(() => document.addEventListener("pointerdown", function off(e) {
    if (!e.target.closest("#sviEtatMenu") && e.target !== btn && !btn.contains(e.target)) { m.remove(); document.removeEventListener("pointerdown", off, true); }
    if (!document.body.contains(m)) document.removeEventListener("pointerdown", off, true);
  }, true), 0);
}

/* =========================================================
   06/11/2026 (décision d'Ahmed, document unique 3.9) : UNE SEULE LISTE PAR TYPE DE PIÈCE, budgets compris (plus de listes EN INSTANCE /
   VALIDÉS séparées). À gauche, des cases à cocher combinables selon l'état : TOUT tout en haut, puis chaque état avec son nombre ;
   le choix est gardé par liste. Une ligne passe si l'un de ses états est coché ; ALERTE décochée cache les lignes en alerte, ALERTE seule les montre toutes.
   sviStfGet(clé) → null (TOUT) ou la liste des états cochés ; sviStfHtml(clé, compteurs, états) ; sviStfPick(clé, état, états) ; sviStfOk(choix, états de la ligne)
   ========================================================= */
const SVI_STF = [["instance", "EN INSTANCE"], ["fige", "FIGÉ"], ["remis", "REMISE"], ["encours", "EN COURS DE VALIDATION"], ["partiel", "PARTIELLEMENT ACHEVÉ"],
  ["valide", "VALIDÉ / CLÔTURÉ"], ["expire", "EXPIRÉ"], ["bloque", "BLOQUÉ"], ["archive", "ARCHIVÉ"], ["annule", "ANNULÉ"], ["alerte", "ALERTE"]];
const SVI_STF_PIECE = SVI_STF.map(x => x[0]).filter(k => k !== "fige");   /* pièces d'achat : plus de FIGÉ (document unique 2.9) */
const sviStfGet = key => { try { const v = JSON.parse(localStorage.getItem("svi_stf_v1:" + key) || "null"); if (Array.isArray(v)) return v.filter(k => SVI_STF.some(x => x[0] === k)); } catch (e) {} return null; };
const sviStfSet = (key, v) => { try { if (v === null) localStorage.removeItem("svi_stf_v1:" + key); else localStorage.setItem("svi_stf_v1:" + key, JSON.stringify(v)); } catch (e) {} };
/* une ligne passe si l'un de ses états est coché ; ALERTE décochée = lignes en alerte cachées ; ALERTE seule = toutes les lignes en alerte */
const sviStfOk = (sel, S) => { if (!sel) return true; S = S || []; const al = S.includes("alerte"), M = sel.filter(k => k !== "alerte");
  if (!M.length) return al && sel.includes("alerte"); return S.some(k => k !== "alerte" && M.includes(k)) && (!al || sel.includes("alerte")); };
const sviStfPick = (key, k, keys) => { const sel = sviStfGet(key);
  if (k === "tout") { sviStfSet(key, sel === null ? [] : null); return; }
  const cur = sel === null ? keys.slice() : sel.slice(), i = cur.indexOf(k); if (i >= 0) cur.splice(i, 1); else cur.push(k);
  sviStfSet(key, keys.every(x => cur.includes(x)) ? null : cur); };
/* compteurs : { tout: n, <état>: n } ; la case TOUT est dans l'en-tête du panneau (même hauteur que les titres des colonnes) */
const sviStfHead = (key, n) => { const sel = sviStfGet(key), on = sel === null;
  return `<button type="button" class="novapp-date-filter svi-stf-all" data-stfk="tout" data-stf="${esc(key)}"><span><input type="checkbox" tabindex="-1"${on ? " checked" : ""}${!on && sel.length ? ' class="part"' : ""}> TOUT</span>${svCnt(n)}</button>`; };
const sviStfHtml = (key, C, keys, L) => { const sel = sviStfGet(key), lab = k => (L && L[k]) || (SVI_STF.find(x => x[0] === k) || [k, k])[1];
  return `<div class="svi-stf" data-stf="${esc(key)}">${keys.map(k => `<button type="button" class="novapp-date-item svi-stf-r stf-${k}" data-stfk="${k}" data-stf="${esc(key)}"><span><input type="checkbox" tabindex="-1"${sel === null || sel.includes(k) ? " checked" : ""}> ${esc(lab(k))}</span>${svCnt(C[k] || 0)}</button>`).join("")}</div>`; };
/* la case TOUT à moitié cochée (quelques états seulement) */
{ const up = () => document.querySelectorAll(".svi-stf-all input.part").forEach(i => { i.indeterminate = true; });
  new MutationObserver(up).observe(document.documentElement, { childList: true, subtree: true }); }

/* v774 : BARRE DU HAUT COMMUNE à toutes les interfaces — ANNULER, RÉTABLIR, PRÉCÉDENT, SUIVANT, ALERTES, FERMER, ⋯
   (mêmes icônes, même ordre, mêmes classes que l'écran d'un budget) ; o = { why: { undo, redo, prev, next }, n: alertes, attr: nom de l'attribut data- } */
const SVI_HDR_IC = {
  undo: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7 4.5 11.5 9 16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 11.5h9.5a5 5 0 0 1 0 10H11" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  redo: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 7l4.5 4.5L15 16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 11.5H9.5a5 5 0 0 0 0 10H13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  prev: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  next: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  todo: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 2.8 19.5h18.4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10v4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.1" fill="currentColor"/></svg>',
  close: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
};
function sviHdrBar(o = {}) {
  const at = o.attr || "hdr", W = o.why || {};
  const b = (k, cls, title, extra = "") => `<button type="button" class="${cls}${W[k] ? " hdr-off" : ""}" data-${at}="${k}" title="${esc(W[k] || title)}" aria-label="${esc(title)}"${W[k] ? ` data-why="${esc(W[k])}"` : ""}>${SVI_HDR_IC[k] || ""}${extra}</button>`;
  return `<div class="bdg-d-hright svi-hdr">${b("undo", "inst-act", "Annuler")}${b("redo", "inst-act", "Rétablir")}${b("prev", "inst-nav", "Précédent")}${b("next", "inst-nav", "Suivant")}`
    + `${b("todo", "inst-act inst-todo" + (o.n ? " todo-on" : ""), "Alertes", `<b>${o.n || ""}</b>`)}${b("close", "inst-act", "Fermer")}`
    + `<button type="button" class="inst-act bdg-more-btn${at === "nvl" ? " nvl-more" : ""}" data-${at}="more" title="Actions" aria-label="Actions">⋯</button></div>`;
}
/* v920 (remarques 1 et 2 du 04/11/2026) : une icône devant chaque ligne des menus ⋯ (même style que le ⋯ du budget) — par clé d'action ;
   une ligne sans icône garde la même marge */
const SVI_MI = {
  "__fmt": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.5-1-2.6 0-.9.7-1.6 1.6-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7" r="1.2"/></svg>',
  "defige": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/></svg>',
  "val": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  "fige": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  "del": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/></svg>',
  "rest": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 3.8v4.6h4.6"/></svg>',
  "__lay": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 3.8v4.6h4.6"/></svg>',
  "__close": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  "__apr": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8V3.5h10V8M7 17H4.5V9.5a1.5 1.5 0 0 1 1.5-1.5h12a1.5 1.5 0 0 1 1.5 1.5V17H17"/><path d="M7 13.5h10V21H7z"/></svg>',
  "apr": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8V3.5h10V8M7 17H4.5V9.5a1.5 1.5 0 0 1 1.5-1.5h12a1.5 1.5 0 0 1 1.5 1.5V17H17"/><path d="M7 13.5h10V21H7z"/></svg>',
  "__aprsp": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/></svg>',
  "rib": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h4"/></svg>',
  "cte": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/></svg>',
  "evl": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
  "cgf": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l4 4v14H7z"/><path d="M10 11h5M10 15h5M10 19h3"/></svg>',
  "docf": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 13h5M10 17h5"/></svg>',
  "fiche": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/></svg>',
  "bloq": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/></svg>',
  "debl": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/></svg>',
  "arch": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9M10 13h4"/></svg>',
  "desarch": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9M12 17v-5M9.5 14.5 12 12l2.5 2.5"/></svg>',
  "cv": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13M14 5l3 3-3 3M20 16H7M10 13l-3 3 3 3"/></svg>',
  "bdg": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6h14M5 12h14M5 18h9"/></svg>',
  "mkcmf": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2.5l2 11h10.5l2-8H7"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></svg>',
  "pafprop": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/></svg>',
  "exp": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M4 17v3h16v-3"/></svg>',
  "imp": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 17v3h16v-3"/></svg>',
  "add": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  "max": '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M4 4l6 6M20 15v5h-5M20 20l-6-6"/></svg>'
};
/* ⋯ principal commun : groupes séparés par un trait (même présentation que le ⋯ d'un budget) */
/* v920 (remarque 1) : DISPOSITION PAR DÉFAUT d'un écran — les tableaux de « root » reprennent leurs colonnes d'origine (largeurs, colonnes masquées) */
function sviLayReset(root) {
  const keys = new Set();
  (root ? root.querySelectorAll("table") : []).forEach(t => { const b = t.tHead && t.tHead.querySelector(".cf-btn[data-cf]"); [b && b.dataset.cf, t.dataset.colh, t.dataset.svcw].forEach(k => { if (k) keys.add(k); }); });
  try { const S = colhLoad(); keys.forEach(k => { delete S[k]; delete S[k + "_i"]; delete S[k + "_v"]; }); colhSave(S); } catch (e) {}
  try { const W = cwLoad(); Object.keys(W).forEach(c => { if ([...keys].some(k => c.startsWith(k + "."))) delete W[c]; }); cwSave(W); } catch (e) {}
  return keys.size;
}
const sviLayAsk = () => svConfirm({ title: "DISPOSITION PAR DÉFAUT", text: "LES BLOCS ET LES COLONNES DE CET ÉCRAN REVIENNENT À LEUR FORMAT D'ORIGINE.", ok: "RÉTABLIR", tone: "neutral" });
function sviHdrMenu(btn, groups, pick) {
  const old = document.getElementById("blkMenu"); if (old) { const same = old.__btn === btn; old.remove(); if (same) return; }
  const m = document.createElement("div"); m.id = "blkMenu"; m.__btn = btn;
  const G = groups.map(g => g.filter(Boolean)).filter(g => g.length), icOf = x => x.ic !== undefined ? x.ic : SVI_MI[x.k] || "", anyIc = G.some(g => g.some(x => icOf(x)));
  m.innerHTML = G.map(g => g.map(x => `<button type="button" data-a="${esc(x.k)}" class="${x.del ? "blk-del" : ""}">${icOf(x) || (anyIc ? '<i class="mi-sp"></i>' : "")}<span>${esc(x.lab)}</span></button>`).join("")).join('<div class="blk-sep"></div>');
  document.body.appendChild(m); sviPlaceMenu(m, btn.getBoundingClientRect());
  m.addEventListener("click", e => { const it = e.target.closest("[data-a]"); if (!it) return; e.stopPropagation(); m.remove(); pick(it.dataset.a); });
  /* v790 (DOCUMENT UNIQUE §10.1) : un 2e toucher sur le même ⋯ ferme le menu (sans le rouvrir) */
  setTimeout(() => document.addEventListener("click", function off(e) { if (!m.isConnected) { document.removeEventListener("click", off, true); return; } if (!e.target.closest("#blkMenu")) { if (btn.contains(e.target)) { e.stopPropagation(); e.preventDefault(); } m.remove(); document.removeEventListener("click", off, true); } }, true), 0);
}
/* C5 (série C, document unique 10.1) : MÊME PLAN POUR TOUS LES MENUS ⋯ — en haut les actions communes, toujours dans cet ordre :
   AGRANDIR / RÉDUIRE ; COPIER / COUPER / COLLER ; MODIFIER LE FORMAT ; IMPORTER / EXPORTER / APERÇU ; SUPPRIMER ;
   en bas, les actions propres à l'interface (dans leur ordre et leurs groupes d'origine). Appliqué à tout menu #blkMenu, quel que soit
   le module qui l'a construit (les boutons sont déplacés, pas recréés : leurs actions restent). */
const SVI_MENU_RANK = [[1, /^(AGRANDIR|RÉDUIRE)\b/], [2, /^(COPIER|COUPER|COLLER)\b/], [3, /^MODIFIER LE FORMAT\b/], [4, /^(IMPORTER|EXPORTER|APERÇU)\b/], [5, /^SUPPRIMER\b/]];
const sviMenuRank = t => { const u = String(t || "").replace(/\s+/g, " ").trim().toUpperCase(); const r = SVI_MENU_RANK.find(x => x[1].test(u)); return r ? r[0] : 0; };
function sviMenuOrder(m) {
  if (!m || m.__ord) return; const K = [...m.children]; if (!K.length || K.some(c => !(c.tagName === "BUTTON" || c.classList.contains("blk-sep")))) return; m.__ord = true;
  const items = []; let g = 0; K.forEach(c => { if (c.classList.contains("blk-sep")) { g++; return; } items.push({ c, g, r: sviMenuRank(c.textContent) }); });
  if (!items.some(x => x.r)) return;
  const sep = () => { const s = document.createElement("div"); s.className = "blk-sep"; return s; }, out = [];
  [1, 2, 3, 4, 5].forEach(r => { const L = items.filter(x => x.r === r); if (!L.length) return; if (out.length) out.push(sep()); L.forEach(x => out.push(x.c)); });
  let lastG = null; items.filter(x => !x.r).forEach(x => { if (out.length && x.g !== lastG) out.push(sep()); lastG = x.g; out.push(x.c); });
  m.replaceChildren(...out);
}
new MutationObserver(ms => { for (const mu of ms) for (const n of mu.addedNodes) if (n.id === "blkMenu") sviMenuOrder(n); }).observe(document.body || document.documentElement, { childList: true });
/* ⟪ src/09e-colonnes-masquees.js ⟫ */
/* =========================================================
   v786 (prompt codage, point 2) : MASQUER / AFFICHER LES COLONNES — un seul mécanisme pour tous les tableaux.
   - Un tableau est reconnu par ses en-têtes (.cf-btn data-cf / data-col) ou, à défaut, par data-colh="clé" sur la table
     (les colonnes sont alors nommées par leur titre).
   - Choix gardé par tableau (svi_colh_v1) ; listes : choix séparé EN INSTANCE (_i) / VALIDÉS (_v).
   - Au moins une colonne reste affichée. Colonnes masquées par défaut : SVI_COLH_DEF.
   - Aperçu, export et copie suivent l'écran (screenCols, sviColhVis).
   ========================================================= */
const COLH_KEY = "svi_colh_v1";
const SVI_COLH_DEF = {};   /* { cléTableau: [colonnes masquées tant que l'utilisateur n'a rien choisi] } */
const colhLoad = () => { try { return JSON.parse(localStorage.getItem(COLH_KEY) || "{}") || {}; } catch (e) { return {}; } };
const colhSave = o => { try { localStorage.setItem(COLH_KEY, JSON.stringify(o)); } catch (e) {} };
const colhNorm = s => String(s || "").replace(/\s+/g, " ").trim().toUpperCase();
/* description d'un tableau affiché : clé, colonnes (index réel, clé, titre), colonnes masquées */
function sviColhInfo(table) {
  if (!table || !table.tHead || !table.tHead.rows[0]) return null;
  const tr = table.tHead.rows[0], b0 = tr.querySelector(".cf-btn[data-cf]");
  let t = b0 ? b0.dataset.cf : table.dataset.colh;
  if (!t) return null;
  if (table.tHead.rows.length > 1 && [...tr.cells].some(c => c.colSpan > 1)) return null;   /* en-tête sur deux lignes : exception */
  const id = t;   /* v796 (document unique 6.8) : un seul choix par tableau, listes EN INSTANCE et VALIDÉS comprises */
  let x = 0;
  const cols = [];
  [...tr.cells].forEach(th => {
    const b = th.querySelector(".cf-btn[data-col]");
    /* v788 (remarque 11) : le nom seul — sans le signe de pliage ni le compteur */
    const lab = (() => { const x = (th.querySelector(".cf-lab") || th).cloneNode(true); x.querySelectorAll(".fold-all, .svi-cnt, .ins-fold, .cf-btn, .col-rs").forEach(e => e.remove()); return colhNorm(x.textContent); })();
    const k = b ? b.dataset.col : (!b0 && lab && !th.querySelector("input") ? lab : null);
    if (k) cols.push({ i: x, k, lab: lab || k, th });
    x += th.colSpan || 1;
  });
  if (!cols.length) return null;
  const S = colhLoad(), keys = cols.map(c => c.k);
  let hid = (S[id] || S[id + "_v"] || S[id + "_i"] || SVI_COLH_DEF[t] || []).filter(k => keys.includes(k));
  if (hid.length >= keys.length) hid = hid.slice(0, keys.length - 1);
  return { t, id, cols, hid, n: x };
}
/* applique le masquage à un tableau (idempotent) */
function sviColhApply(table) {
  const I = sviColhInfo(table);
  table.querySelectorAll(".svi-colh").forEach(c => c.classList.remove("svi-colh"));
  table.querySelectorAll("[data-cs0]").forEach(c => { c.colSpan = +c.dataset.cs0; c.removeAttribute("data-cs0"); });
  if (table.dataset.w0) { table.style.width = table.dataset.w0; table.removeAttribute("data-w0"); }
  if (!I || !I.hid.length) return;
  const H = new Set(I.cols.filter(c => I.hid.includes(c.k)).map(c => c.i));
  let wOff = 0;
  table.querySelectorAll("colgroup").forEach(cg => { let x = 0;
    [...cg.children].forEach(col => { const sp = col.span || 1; if (sp === 1 && H.has(x)) { col.classList.add("svi-colh"); wOff += parseFloat(col.style.width) && /px$/.test(col.style.width) ? parseFloat(col.style.width) : 0; } x += sp; }); });
  [...table.rows].forEach(r => { let x = 0;
    [...r.cells].forEach(c => { const sp = c.colSpan || 1; let nh = 0; for (let j = x; j < x + sp; j++) if (H.has(j)) nh++;
      if (nh === sp) c.classList.add("svi-colh"); else if (nh) { c.dataset.cs0 = sp; c.colSpan = sp - nh; }
      x += sp; }); });
  if (wOff && /px$/.test(table.style.width || "")) { table.dataset.w0 = table.style.width; table.style.width = Math.max(120, parseFloat(table.style.width) - wOff) + "px"; }
}
/* index des colonnes affichées d'un tableau (aperçus, exports qui lisent l'écran) */
function sviColhVis(table) {
  const r = table && table.tHead && table.tHead.rows[0];
  if (!r) return [];
  return [...r.cells].map((c, i) => c.classList.contains("svi-colh") ? -1 : i).filter(i => i >= 0);
}
let colhRaf = 0;
function sviColhAll() {
  cancelAnimationFrame(colhRaf);
  colhRaf = requestAnimationFrame(() => {
    const S = colhLoad();
    const any = Object.keys(S).some(k => (S[k] || []).length) || Object.keys(SVI_COLH_DEF).length || document.querySelector(".svi-colh");
    document.querySelectorAll("table").forEach(t => { if (t.closest("#sviMep, .mep-page")) return; if (t.tHead && (t.dataset.colh || t.tHead.querySelector(".cf-btn[data-cf]"))) { sviColhReg(t); if (any) sviColhApply(t); } });
  });
}
new MutationObserver(muts => { if (muts.some(m => m.addedNodes.length)) sviColhAll(); }).observe(document.documentElement, { childList: true, subtree: true });
/* tableau concerné par un ⋯ : le premier tableau visible du bloc / de l'écran */
function sviColhTableNear(el) {
  const root = el && (el.closest(".nvp-blk, .bdg-d-block, .bdg-blk, [data-blk-box], .novapp-list-shell, #ach, section") || null);
  const scope = root || document;
  const T = [...scope.querySelectorAll("table")].filter(t => t.offsetParent && sviColhInfo(t));
  return T[0] || null;
}
/* v788 (remarque 17) : UNE seule entrée « MASQUER / AFFICHER LES COLONNES » — une seule fenêtre, toutes les colonnes,
   cochée = affichée, décochée = masquée ; au moins une reste cochée */
/* v926 (remarque 11 du 04/11/2026, document unique 6.8) : MASQUER LA COLONNE dans la loupe ; AFFICHER LES COLONNES MASQUÉES dans le ⋯ du bloc,
   avec le compteur — toutes réaffichées d'un coup pour ce tableau (ouvert à tous en attendant les droits) */
const sviColhSame = id => [...document.querySelectorAll("table")].filter(t => { const I = sviColhInfo(t); return I && I.id === id; });
function sviColhHide(table, key) {
  const I = sviColhInfo(table); if (!I || !I.cols.some(c => c.k === key)) return false;
  if (I.hid.includes(key)) return true;
  if (I.cols.length - I.hid.length <= 1) { svToast("UNE COLONNE AU MOINS RESTE AFFICHÉE.", 2500); return false; }
  const S = colhLoad(); S[I.id] = [...I.hid, key]; delete S[I.id + "_i"]; delete S[I.id + "_v"]; colhSave(S);
  sviColhSame(I.id).forEach(sviColhApply); return true;
}
function sviColhShowAll(table) {
  const I = sviColhInfo(table); if (!I) return false;
  const S = colhLoad(); S[I.id] = []; delete S[I.id + "_i"]; delete S[I.id + "_v"]; colhSave(S);
  sviColhSame(I.id).forEach(sviColhApply); return true;
}
function sviColhItems(table) {
  const I = sviColhInfo(table); if (!I || I.cols.length < 2 || !I.hid.length) return [];   /* rien de masqué : pas de ligne */
  const n = I.hid.length;
  return [{ k: "__colshow", lab: "AFFICHER LES COLONNES MASQUÉES — " + n + " COLONNE" + (n > 1 ? "S" : "") + " MASQUÉE" + (n > 1 ? "S" : "") }];
}
/* fenêtre commune : tableau des colonnes, une case par colonne (format des tableaux de l'application) */
function sviColhWin(table) { sviColhWinI(sviColhInfo(table)); }
function sviColhWinI(I) {
  if (!I) return;
  const d = sviWinNew();
  d.innerHTML = sviWinCard({ cls: "pv-card colh-card", close: "data-x", title: "MASQUER / AFFICHER LES COLONNES",
    body: `<div class="pv-scroll colh-list"><table class="bdg-d-table rec-table colh-t"><colgroup><col style="width:110px"><col></colgroup><thead><tr><th class="center colh-c">AFFICHÉE</th><th>COLONNE</th></tr></thead>
      <tbody>${I.cols.map(c => `<tr class="colh-r"><td class="center colh-c"><input type="checkbox" data-k="${esc(c.k)}"${I.hid.includes(c.k) ? "" : " checked"}></td><td>${esc(c.lab)}</td></tr>`).join("")}</tbody></table></div>
      <div class="colh-err" hidden></div>`,
    foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button>` });
  sviWinShow(d);
  const err = d.querySelector(".colh-err");
  d.addEventListener("click", e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
    const row = e.target.closest("tr.colh-r");
    if (row && !e.target.matches("input")) { const i = row.querySelector("input"); i.checked = !i.checked; }
    if (row) { const on = d.querySelectorAll(".colh-r input:checked").length; err.hidden = on > 0; err.textContent = on ? "" : "AU MOINS UNE COLONNE DOIT RESTER AFFICHÉE."; return; }
    if (!e.target.closest("[data-ok]")) return;
    const next = [...d.querySelectorAll(".colh-r input")].filter(i => !i.checked).map(i => i.dataset.k);
    if (next.length >= I.cols.length) { err.hidden = false; err.textContent = "AU MOINS UNE COLONNE DOIT RESTER AFFICHÉE."; return; }
    const S = colhLoad(); S[I.id] = next; colhSave(S);
    d.remove();
    document.querySelectorAll("table").forEach(t => { const J = t.tHead && sviColhInfo(t); if (J && J.id === I.id) sviColhApply(t); });
    if (typeof I.done === "function") I.done();
  });
}
function sviColhPick(a, table) {
  if (a === "__colshow") { const I = sviColhInfo(table); if (I && !I.hid.length) svToast("AUCUNE COLONNE MASQUÉE.", 2000); else sviColhShowAll(table); return true; }
  if (a === "__colwin" || a === "__colhide") { sviColhWin(table); return true; }
  return false;
}

/* v796 (document unique 6.8) : registre des tableaux vus à l'écran — PARAMÉTRAGE › FORMAT › COLONNES les liste tous
   (« INTERFACE › TABLEAU ») ; un tableau s'y inscrit la première fois qu'il est affiché */
const COLH_REG = "svi_colhreg_v1";
const colhRegLoad = () => { try { return JSON.parse(localStorage.getItem(COLH_REG) || "{}") || {}; } catch (e) { return {}; } };
const COLH_IF_LAB = { bdg: "BUDGET", bdgl: "LISTE DES BUDGETS", ach: "ACHATS", prm: "PARAMÉTRAGE", win: "FENÊTRES" };
function sviColhName(table) {
  const txt = el => { if (!el) return ""; const x = el.cloneNode(true); x.querySelectorAll(".svi-cnt, svg, button, input").forEach(e => e.remove()); return colhNorm(x.textContent).replace(/\s*\(.*\)\s*$/, ""); };
  const iface = (SVI_FMT_IF.find(x => x.sc.some(sel => table.closest(sel))) || {}).k;
  const blk = table.closest(".bdg-d-block, .nvp-blk");
  let name = "";
  if (blk && blk.id === "bdgTabBody") {
    const tab = document.querySelector("#bdgTabs .bdg-d-tab.active");
    const ttl = document.querySelector("#bdgDetailHead .ttl"), x = ttl && ttl.cloneNode(true); if (x) x.querySelectorAll(".dhead-sub").forEach(e => e.remove());
    name = (txt(x) || "DÉTAIL") + (tab ? " › " + txt(tab) : "");
  } else if (blk) {
    const tab = blk.querySelector(".rec-tab.active, .rec-tab.on, .nvp-tab.on");
    name = txt(blk.querySelector(".bdg-d-block-title .ttl")) + (tab ? " › " + txt(tab) : "");
  } else if (table.closest(".novapp-list-shell")) name = txt(table.closest(".novapp-list-shell").querySelector(".novapp-list-titlebar h1") || document.querySelector(".novapp-list-titlebar h1"));
  else if (table.closest("#svConf")) name = txt(table.closest("#svConf").querySelector(".svc-title, h2, h3"));
  return [COLH_IF_LAB[iface] || "", name].filter(Boolean).join(" › ");
}
let colhRegT = 0, colhRegP = null;
function sviColhReg(table) {
  if (!table.offsetParent) return;   /* onglet caché : inscrit quand il est ouvert (nom juste) */
  const I = sviColhInfo(table);
  if (!I || I.cols.length < 2) return;
  colhRegP = colhRegP || colhRegLoad();
  const R = colhRegP, old = R[I.id], cols = I.cols.map(c => [c.k, c.lab]);
  const lab = sviColhName(table) || (old && old.lab) || I.id.toUpperCase();
  if (old && old.lab === lab && JSON.stringify(old.cols) === JSON.stringify(cols)) return;
  R[I.id] = { lab, cols };
  clearTimeout(colhRegT);
  colhRegT = setTimeout(() => { try { localStorage.setItem(COLH_REG, JSON.stringify(R)); } catch (e) {} }, 300);
}
/* description d'un tableau d'après le registre (le tableau n'a pas besoin d'être à l'écran) */
function sviColhRegInfo(id) {
  const R = colhRegP || colhRegLoad(), E = R[id];
  if (!E) return null;
  const S = colhLoad(), keys = E.cols.map(c => c[0]);
  let hid = (S[id] || S[id + "_v"] || S[id + "_i"] || SVI_COLH_DEF[id] || []).filter(k => keys.includes(k));
  if (hid.length >= keys.length) hid = hid.slice(0, keys.length - 1);
  return { t: id, id, lab: E.lab, cols: E.cols.map(([k, lab]) => ({ k, lab })), hid };
}
function sviColhRegList() {
  const R = colhRegP || colhRegLoad();
  return Object.keys(R).map(sviColhRegInfo).filter(Boolean).sort((a, b) => a.lab.localeCompare(b.lab, "fr"));
}
document.addEventListener("click", () => setTimeout(() => document.querySelectorAll("table").forEach(t => { if (t.offsetParent && t.tHead && !t.closest("#sviMep, .mep-page") && (t.dataset.colh || t.tHead.querySelector(".cf-btn[data-cf]"))) sviColhReg(t); }), 400), true);
/* ⟪ src/09e-gestes-communs.js ⟫ */
/* =========================================================
   v785 : GESTES ET TOUCHER — UN SEUL RÉGLAGE POUR TOUTE L'APPLICATION
   Changer une valeur ici la change partout (tableaux, Gantt, graphiques, achats, fenêtres).
   - lp    : durée de l'APPUI LONG (ms)
   - drag  : distance avant qu'un GLISSER commence (px) ; en dessous, c'est un toucher
   - dbl   : délai maximal entre les deux touchers d'un DOUBLE TOUCHER (ms)
   - hitW / hitH : zone de toucher autour des petits boutons, ronds et cases (px)
   - pinch : sensibilité du PINCEMENT (1 = normale ; plus grand = plus rapide)
   - ganttMin / ganttMax : hauteur des lignes du Gantt réglable au pincement (px)
   ========================================================= */
const SVI_G = { lp: 450, drag: 8, dbl: 350, hitW: 44, hitH: 32, pinch: 1, ganttMin: 24, ganttMax: 80 };
window.SVI_G = SVI_G;
try { document.documentElement.style.setProperty("--svi-hit-w", SVI_G.hitW + "px"); document.documentElement.style.setProperty("--svi-hit-h", SVI_G.hitH + "px"); } catch (e) {}
/* série B (B16, B27) : BULLE D'EXPLICATION COMMUNE — l'explication d'un titre ou d'un champ n'est plus écrite dessous : elle s'affiche
   à l'APPUI LONG (ou au clic droit) sur l'élément qui porte data-tip */
{
  let tm = 0, x0 = 0, y0 = 0;
  /* les anciennes aides au survol (title) d'un intitulé deviennent aussi des bulles — l'iPad n'a pas de survol */
  const TIP = "[data-tip], label > span[title], .ach-pgen td[title]";
  const show = el => { const t = el.dataset.tip || el.getAttribute("title") || ""; if (t && typeof svToast === "function") svToast(t, 7000, el); };
  document.addEventListener("pointerdown", e => { const el = e.target.closest && e.target.closest(TIP); clearTimeout(tm); if (!el) return; x0 = e.clientX; y0 = e.clientY; tm = setTimeout(() => show(el), SVI_G.lp); }, true);
  document.addEventListener("pointermove", e => { if (tm && Math.hypot(e.clientX - x0, e.clientY - y0) > SVI_G.drag) clearTimeout(tm); }, true);
  ["pointerup", "pointercancel"].forEach(t => document.addEventListener(t, () => clearTimeout(tm), true));
  document.addEventListener("contextmenu", e => { const el = e.target.closest && e.target.closest(TIP); if (!el) return; e.preventDefault(); e.stopPropagation(); clearTimeout(tm); show(el); }, true);
}
/* v785 : RACCOURCIS COMMUNS — Ctrl (Commande sur l'iPad) + Z = ANNULER, + Y (ou Maj + Z) = RÉTABLIR, sur tout écran qui a la barre commune.
   Dans une case en cours de saisie (curseur dans le texte), le raccourci reste celui du texte. */
document.addEventListener("keydown", e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const k = String(e.key || "").toLowerCase(); if (k !== "z" && k !== "y") return;
  const a = document.activeElement, typing = a && a.matches && a.matches("input:not([type=checkbox]):not([type=radio]), textarea, [contenteditable=true]") && !a.classList.contains("svi-nav");
  if (typing || document.querySelector("#sdW:not([hidden])")) return;
  const redo = k === "y" || e.shiftKey, b = document.getElementById(redo ? "instRedo" : "instUndo") || document.querySelector(`[data-nvp="${redo ? "redo" : "undo"}"]`);
  if (!b || !b.isConnected) return;
  e.preventDefault(); b.click();
}, true);
/* v786 (prompt codage, point 5) : Ctrl / Cmd + C, X, V sur des cases SÉLECTIONNÉES (cadre fin, pas en saisie) = COPIER, COUPER, COLLER
   — la même chose que la bulle COPIER / COLLER / EFFACER. En cours de saisie, le raccourci reste celui du texte. */
document.addEventListener("keydown", e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
  const k = String(e.key || "").toLowerCase(); if (!["c", "x", "v"].includes(k)) return;
  const a = document.activeElement, typing = a && a.matches && a.matches("input:not([type=checkbox]):not([type=radio]), textarea, [contenteditable=true]") && !a.classList.contains("svi-nav");
  const X = window.__sviCells;
  if (typing || !X || !X.count() || document.querySelector("#svConf, #sdW:not([hidden])")) return;
  e.preventDefault();
  if (k === "c") X.copy(); else if (k === "v") X.paste(); else { X.copy(); X.clear(); }
  if (window.__sviSelBar) setTimeout(window.__sviSelBar, 50);
}, true);
/* v788 (remarque 1) : la ligne « CRÉER … ICI » fixée en bas reste JUSTE AU-DESSUS de la ligne TOTAL (pied fixé) — jamais derrière */
{
  const NEWR = "tr.ins-new, tr.rec-new, tr.scn-new, tr.qq-new, tr.dlw-newr, tr.dly-new, tr.ach-new";
  let q = 0;
  const fit = () => { q = 0;
    document.querySelectorAll("table").forEach(t => {
      const nr = t.tBodies[0] && t.tBodies[0].querySelector(":scope > " + NEWR.split(", ").join(", :scope > ")); if (!nr) return;
      const fh = t.tFoot && t.tFoot.offsetParent !== null ? Math.round(t.tFoot.getBoundingClientRect().height) : 0;
      const v = fh ? fh + "px" : "";
      [...nr.cells].forEach(td => { if (td.style.bottom !== v) td.style.bottom = v; });
    });
  };
  const later = () => { if (!q) q = requestAnimationFrame(fit); };
  new MutationObserver(m => { if (m.some(x => x.addedNodes.length)) later(); }).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("resize", later);
}
/* v789 (DÉFAUT GRAVE, 01/11) : l'écran d'un budget est dessiné dans un conteneur qui reste le même d'un budget à l'autre.
   Les écouteurs posés sur ce conteneur (ou sur la page) par le code du budget gardaient le budget OUVERT EN PREMIER :
   toucher un groupe redessinait alors les lots d'un autre budget. Désormais, chaque ouverture de budget a son numéro
   (window.__sviBdgGen) : un écouteur posé par le code du budget ne réagit que pour le budget ouvert au moment où il a été posé. */
(() => {
  const P = EventTarget.prototype, add = P.addEventListener, rem = P.removeEventListener, W = new WeakMap();
  const capOf = o => typeof o === "boolean" ? o : !!(o && o.capture);
  P.addEventListener = function (t, fn, o) {
    const g = window.__sviBdgGen;
    if (g && !window.__sviNoWrap && typeof fn === "function" && (this === document || this === window || this === window.__sviBdgShell)) {
      let st = ""; try { st = new Error().stack || ""; } catch (e) {}
      if (/app-budget\.js/.test(st)) {
        let m = W.get(fn); if (!m) { m = new Map(); W.set(fn, m); }
        const k = t + "|" + capOf(o) + "|" + g;
        let w = m.get(k); if (!w) { w = function (e) { if (window.__sviBdgGen !== g) return; return fn.call(this, e); }; m.set(k, w); }
        m.set(t + "|" + capOf(o), w);
        return add.call(this, t, w, o);
      }
    }
    return add.call(this, t, fn, o);
  };
  P.removeEventListener = function (t, fn, o) {
    const m = typeof fn === "function" ? W.get(fn) : null, w = m && m.get(t + "|" + capOf(o));
    if (w) rem.call(this, t, w, o);
    return rem.call(this, t, fn, o);
  };
})();
/* v789 (remarques C et K) : la case en saisie (ligne qu'on vient de créer comprise) reste TOUJOURS visible et entière dans son bloc :
   sous les titres des colonnes collés en haut, au-dessus de la ligne « CRÉER … ICI » et du TOTAL collés en bas — partout */
{
  const SC = ".bdg-h-col, .bdg-d-client-scroll, .bdg-d-scroll, .rec-scroll, .ach-scroll, .novapp-budget-table-wrap, .pv-scroll";
  const NEW = "tbody tr:is(.ins-new, .rec-new, .scn-new, .qq-new, .dlw-newr, .dly-new, .ach-new), .ins-li.ins-new";
  const fitIn = el => {
    if (!el || !el.isConnected || !el.closest) return;
    const sc = el.closest(SC), row = el.closest(".ins-li, .bdg-h-item, tr"); if (!sc || !row || row.closest("thead, tfoot")) return;
    const sr = sc.getBoundingClientRect(), rr = row.getBoundingClientRect(); if (!sr.height || sc.scrollHeight <= sc.clientHeight + 1) return;
    const hd = sc.querySelector(":scope > .bdg-h-head") || sc.querySelector("thead"), ft = sc.querySelector("tfoot");
    const top = Math.max(sr.top + sc.clientTop, hd ? hd.getBoundingClientRect().bottom : 0);
    const nw = [...sc.querySelectorAll(NEW)].find(x => x.offsetParent !== null), nwH = nw && nw !== row && !nw.contains(row) ? nw.getBoundingClientRect().height : 0;
    const bot = sr.top + sc.clientTop + sc.clientHeight - (ft && ft.offsetParent !== null ? ft.getBoundingClientRect().height : 0) - nwH;
    if (rr.top < top - .5) sc.scrollTop -= Math.ceil(top - rr.top);
    else if (rr.bottom > bot + .5) sc.scrollTop += Math.ceil(rr.bottom - bot);
  };
  document.addEventListener("focusin", e => { const el = e.target; fitIn(el); requestAnimationFrame(() => fitIn(el)); setTimeout(() => fitIn(document.activeElement), 120); setTimeout(() => fitIn(document.activeElement), 400); }, true);
  /* la ligne CRÉER devient une vraie ligne pendant la frappe (sans changer de case) : on la garde visible aussi */
  document.addEventListener("input", e => { const el = e.target; requestAnimationFrame(() => fitIn(el)); setTimeout(() => fitIn(document.activeElement), 150); }, true);
  window.sviFitIn = fitIn;
}
/* v793 (DOCUMENT UNIQUE §6.6) : jamais de ligne « AUCUN … » — le compteur 0 du titre suffit, le tableau garde ses titres de colonnes.
   Moteur commun : toute ligne faite d'une seule case .empty dont le texte est « AUCUN(E) … » (sans explication après « : ») est masquée,
   dans tous les tableaux, présents et futurs. Un message qui dit QUOI FAIRE (« AUCUN ARTICLE : APPELER LE CPS… ») reste affiché. */
{
  const RX = /^AUCUNE?\s[^:]*$/;
  let raf = 0;
  const run = () => { raf = 0;
    document.querySelectorAll("tbody td.empty").forEach(td => { const tr = td.parentNode; if (!tr || tr.cells.length !== 1) return;
      tr.classList.toggle("svi-empty-x", RX.test(td.textContent.replace(/\s+/g, " ").trim())); }); };
  const go = () => { if (!raf) raf = requestAnimationFrame(run); };
  const start = () => new MutationObserver(go).observe(document.body, { childList: true, subtree: true });
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
  window.sviEmptyRun = run;
}
/* v793 (DOCUMENT UNIQUE §6.1) : LARGEUR DES COLONNES COMMUNE — tout tableau marqué data-svcw="clé", avec un colgroup dont chaque col porte
   data-k (clé de la colonne) et des poignées .col-rs[data-col] dans ses titres ; largeur gardée (même mémoire que le budget : cwLoad / cwSave,
   clé « clé.colonne ») ; minimum 64 px comme partout. sviCwCols(clé, [[col, largeurParDéfaut]…], extra) rend le colgroup et la largeur du tableau. */
function sviCwCols(t, cols, extra = []) {
  const CW = cwLoad(), all = cols.concat(extra), w = c => CW[t + "." + c[0]] || c[1];
  const tot = all.reduce((s, c) => s + w(c), 0);
  /* B47 (05/11) : dès qu'une largeur a été réglée, le tableau garde la somme exacte (les autres colonnes ne bougent plus) */
  const set = all.some(c => CW[t + "." + c[0]]);
  return { cg: `<colgroup>${all.map(c => `<col data-k="${esc(c[0])}" style="width:${w(c)}px">`).join("")}</colgroup>`, style: `width:${tot}px;min-width:${set ? tot + "px" : "100%"}` };
}
document.addEventListener("pointerdown", e => {
  const h = e.target.closest && e.target.closest("table[data-svcw] .col-rs[data-col]"); if (!h) return;
  const table = h.closest("table"), t = table.dataset.svcw, col = table.querySelector(`colgroup col[data-k="${CSS.escape(h.dataset.col)}"]`); if (!col) return;
  e.preventDefault(); e.stopPropagation();
  const cols = [...table.querySelectorAll("colgroup col")], hs = [...table.tHead.rows[0].cells];
  /* B47 : toutes les colonnes figées à leur largeur affichée — seule la colonne tirée change, les autres ne bougent pas, et toutes sont gardées */
  { const W = hs.map(x => Math.round(x.getBoundingClientRect().width)); cols.forEach((c, i) => { if (W[i]) c.style.width = W[i] + "px"; }); const tw0 = W.reduce((a, b) => a + (b || 0), 0) + "px"; table.style.width = tw0; table.style.minWidth = tw0; }
  const x0 = e.clientX, w0 = parseFloat(col.style.width) || 120; let w = w0;
  h.classList.add("on");
  const mv = ev => { w = Math.max(64, Math.round(w0 + ev.clientX - x0)); col.style.width = w + "px"; const tw = cols.reduce((s, c) => s + (parseFloat(c.style.width) || 0), 0) + "px"; table.style.width = tw; table.style.minWidth = tw; };
  const up = () => { document.removeEventListener("pointermove", mv, true); document.removeEventListener("pointerup", up, true); document.removeEventListener("pointercancel", up, true); h.classList.remove("on");
    const all = cwLoad(); cols.forEach(c => { if (c.dataset.k) all[t + "." + c.dataset.k] = Math.round(parseFloat(c.style.width) || 0) || all[t + "." + c.dataset.k]; }); all[t + "." + h.dataset.col] = w; cwSave(all); };
  document.addEventListener("pointermove", mv, true); document.addEventListener("pointerup", up, true); document.addEventListener("pointercancel", up, true);
}, true);
/* v793 (DOCUMENT UNIQUE §6.4) : CASES À COCHER À DROITE des listes (budgets, achats) — dernière colonne ; case d'en-tête = toutes ;
   toucher la case (ou sa cellule) coche sans ouvrir la ligne ; l'APERÇU de la liste prend les lignes cochées s'il y en a */
const sviListCbTh = () => `<th class="center nvl-cbh"><input type="checkbox" class="nvl-all" aria-label="Tout cocher"></th>`;
const sviListCbTd = () => `<td class="center nvl-cbc"><input type="checkbox" class="nvl-cb" aria-label="Cocher"></td>`;
document.addEventListener("click", e => {
  const c = e.target.closest && e.target.closest("td.nvl-cbc, th.nvl-cbh"); if (!c) return;
  e.stopPropagation();
  if (!e.target.matches("input")) { const i = c.querySelector("input"); if (i) { i.checked = !i.checked; i.dispatchEvent(new Event("change", { bubbles: true })); } }
}, true);
document.addEventListener("change", e => {
  const t = e.target; if (!t.matches || !t.matches(".nvl-all, .nvl-cb")) return;
  const table = t.closest("table"); if (!table) return;
  const cbs = [...table.querySelectorAll("tbody .nvl-cb")];
  if (t.matches(".nvl-all")) cbs.forEach(x => { x.checked = t.checked; });
  const n = cbs.filter(x => x.checked).length, all = table.querySelector(".nvl-all");
  if (all) { all.checked = n > 0 && n === cbs.length; all.indeterminate = n > 0 && n < cbs.length; }
  cbs.forEach(x => x.closest("tr").classList.toggle("nvl-on", x.checked));
});

/* v929 (remarque 16 du 04/11/2026, document unique 9.4) : SUR ORDINATEUR — appui long = clic droit (ou Ctrl + clic sur Mac) :
   le menu du navigateur est remplacé par un appui long au même endroit (toucher = clic, double toucher = double clic et glisser = cliquer-glisser
   passent déjà par les mêmes événements). Un champ qui a son propre clic droit (masque de saisie) le garde. */
document.addEventListener("contextmenu", e => {
  if (e.defaultPrevented) return;
  const tg = e.target; if (!tg || !tg.dispatchEvent || (tg.closest && tg.closest("textarea, input[type=file]"))) return;
  e.preventDefault();
  const o = { bubbles: true, cancelable: true, composed: true, clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY, pointerId: 91, pointerType: "touch", isPrimary: true, button: 0 };
  tg.dispatchEvent(new PointerEvent("pointerdown", { ...o, buttons: 1 }));
  setTimeout(() => { (tg.isConnected ? tg : document).dispatchEvent(new PointerEvent("pointerup", { ...o, buttons: 0 })); }, SVI_G.lp + 80);
});
/* ⟪ src/09e-mise-en-page.js ⟫ */
/* =========================================================
   v783 : APERÇU UNIQUE — éditeur MISE EN PAGE par blocs (repris d'achats.html)
   sviMep.open(doc) — doc = {
     key   : type de document (sa mise en page est gardée sous ce nom : « CMF », « BDG-BPU », « LISTE-ACH-CMF »…),
     title : titre du document, ref : référence, party : client / fournisseur, date : date du document (texte),
     prelim: true = filigrane VERSION PRÉLIMINAIRE,
     cols  : [[clé, libellé, "number" | "center" | ""]], rows : [[cellules…]] (ou html : tableau tout fait),
     tot   : [[libellé, valeur]] (TOTAUX), fields : { projet, ttc, numFrs, lettres, mention, soc } (blocs « champ »),
     note  : texte sous les TOTAUX (v819 : montant en lettres, mention à reporter),
     name  : nom du fichier PDF, save : async (blob, nom) => référence classée (GÉNÉRER PDF = classer dans DOCUMENTS) }
   Volet : ENTÊTE, PIED, CACHET, SIGNATURE (pages), PORTRAIT / PAYSAGE, MISE EN PAGE, GÉNÉRER PDF, IMPRIMER SANS CLASSER.
   MISE EN PAGE : glisser / redimensionner chaque bloc, texte libre ou champ, alignements, police, taille, couleur,
   gras / italique / souligné, fond, superposition ; colonnes du tableau (affichage, ordre, largeur, RESTE) ;
   ENREGISTRER (pour ce type de document), RÉTABLIR LA MISE EN PAGE STANDARD, ANNULER.
   ========================================================= */
const sviMep = (() => {
  const LKEY = "svi_mep_v1", OKEY = "svi_mep_opt_v1";
  const ls = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const PW = { p: [794, 1123], l: [1123, 794] };
  const DEF = { entete: { x: 40, y: 24, w: 714, h: 96 }, date: { x: 414, y: 136, w: 340, h: 26, al: "right" }, titre: { x: 60, y: 176, w: 674, h: 36, al: "center" },
    frs: { x: 60, y: 214, w: 674, h: 40, al: "center" }, ref: { x: 60, y: 260, w: 674, h: 50, al: "left" }, corps: { x: 40, y: 318, w: 714, h: 540 },
    totaux: { x: 474, y: 600, w: 280, h: 90, flow: true }, sign: { x: 404, y: 880, w: 170, h: 120 }, cachet: { x: 584, y: 880, w: 170, h: 120 }, pied: { x: 40, y: 1040, w: 714, h: 66 } };
  const LBL = { entete: "ENTÊTE", date: "DATE", titre: "TITRE", frs: "CLIENT / FOURNISSEUR", ref: "RÉFÉRENCE", corps: "TABLEAU", totaux: "TOTAUX", sign: "SIGNATURE", cachet: "CACHET", pied: "PIED DE PAGE" };
  const FIX = ["entete", "pied", "sign", "cachet", "corps"], TXT = ["date", "titre", "frs", "ref"], STY = ["date", "titre", "frs", "ref", "corps", "totaux", "pied", "entete"];
  /* v925 (remarque 6) : Times, police non réglable ; texte à 10 pt (13,3 px), titres plus grands */
  const FS = { date: 13.3, titre: 24, frs: 22, ref: 16, corps: 13.3, totaux: 13.3, pied: 13.3, entete: 13.3 }, BOLD = ["date", "titre", "frs", "ref"];
  const FLD = [["date", "DATE (VILLE, LE …)"], ["ddoc", "DATE DU DOCUMENT"], ["ref", "RÉFÉRENCE"], ["frs", "CLIENT / FOURNISSEUR"], ["titre", "TITRE DU DOCUMENT"], ["projet", "PROJET"], ["numFrs", "N° DOCUMENT TIERS"], ["ttc", "MONTANT TTC"], ["lettres", "MONTANT EN LETTRES"], ["mention", "MENTION À REPORTER (N° DE LA PIÈCE)"], ["soc", "ICE ET IF DE LA SOCIÉTÉ"], ["ent", "ENTREPRISE"]];
  const isX = k => String(k).startsWith("x_");
  const E = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  let D = null, O = null, ED = null, SEL = null, ROOT = null, RES = null;
  const opt0 = () => Object.assign({ ent: true, pied: true, sign: false, cachet: false, signPg: "last", cachetPg: "last", open: true }, ls.get(OKEY, {}));
  /* mise en page d'un type de document (orientation comprise) ; paysage : positions standard étirées */
  const layOf = (key, o) => { const all = ls.get(LKEY, {}), u = all[key] || {}, orient = o || u.__o || "p", L = { __o: orient };
    const sx = orient === "l" ? PW.l[0] / PW.p[0] : 1, sy = orient === "l" ? PW.l[1] / PW.p[1] : 1;
    Object.keys(DEF).forEach(k => { const d = DEF[k]; L[k] = Object.assign({ ...d, x: Math.round(d.x * sx), y: Math.round(d.y * sy), w: Math.round(d.w * sx), h: Math.round(d.h * sy) }, u.__o === orient ? u[k] || {} : {}); });
    if (u.__o === orient) Object.keys(u).filter(isX).forEach(k => L[k] = { ...u[k] });
    return L; };
  /* B28 : chaque champ imprimé (D.auto = [[id, libellé, valeur]]) a son bloc, placé d'office, déplaçable, à cacher pour une impression */
  const autoAdd = y => { (D.auto || []).forEach(([id], n) => { const k = "x_a_" + id; if (!y[k]) y[k] = { kind: "field", field: "a_" + id, auto: true, x: 60, y: 870 + n * 24, w: 330, h: 22, al: "left" }; }); return y; };
  const L = () => autoAdd(ED || layOf(D.key, O.orient));
  const today = () => { const m = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"], n = new Date(); return "Agadir, le " + String(n.getDate()).padStart(2, "0") + " " + m[n.getMonth()] + " " + n.getFullYear(); };
  const field = f => f === "date" ? today() : f === "ddoc" ? E(D.date || "") : f === "ref" ? E(D.ref || "") : f === "frs" ? E(D.party || "") : f === "titre" ? E(D.title || "") : f === "ent" ? "SVI" : E((D.fields || {})[f] ?? "");
  /* colonnes visibles, ordre et largeurs (%) — RESTE = la colonne qui prend la place libre */
  const colsOf = b => { const all = (D.cols || []).map((c, i) => [c[0] || "c" + i, c[1], c[2] || "", i]); const ord = (b.order || []).filter(k => all.some(c => c[0] === k)); all.forEach(c => { if (!ord.includes(c[0])) ord.push(c[0]); });
    const vis = b.vis ? b.vis.filter(k => all.some(c => c[0] === k)) : all.map(c => c[0]); const rest = b.rest !== undefined ? b.rest : ((all.find(c => !c[2]) || all[0] || [])[0] || "");
    return { all: ord.map(k => all.find(c => c[0] === k)), vis, rest }; };
  const tableHTML = (b, rows, head = true) => {
    if (D.html) return D.html;
    /* tableau tout fait (budget) : titres repris sur chaque page, lignes découpées */
    if (D.trs) return `<table class="mep-t mep-raw">${D.colgroup || ""}${head ? D.thead || "" : ""}<tbody>${rows.join("")}</tbody></table>`;
    const C = colsOf(b), shown = C.all.filter(c => C.vis.includes(c[0])), w = k => k === C.rest ? 0 : ((b.cw || {})[k] ?? (shown.length > 6 ? 9 : 14));
    return `<table class="mep-t"><colgroup>${shown.map(c => w(c[0]) ? `<col style="width:${w(c[0])}%">` : "<col>").join("")}</colgroup>`
      + (head ? `<tr>${shown.map(c => `<th>${E(c[1])}</th>`).join("")}</tr>` : "")
      + rows.map(r => `<tr>${shown.map(c => { const v = r[c[3]]; return `<td class="${c[2] === "number" ? "nm" : c[2] === "center" ? "c" : ""}">${E(typeof v === "number" ? (typeof money === "function" ? money(v) : v) : v ?? "")}</td>`; }).join("")}</tr>`).join("") + "</table>"; };
  const totHTML = () => D.endHtml ? D.endHtml : (D.tot || []).length ? `<table class="mep-tot"><colgroup><col style="width:55%"><col style="width:45%"></colgroup>${D.tot.map(([l, v]) => `<tr><th>${E(l)}</th><td>${E(typeof v === "number" ? (typeof money === "function" ? money(v) : v) : v)}</td></tr>`).join("")}</table>${D.note ? `<div class="mep-note">${E(D.note).replace(/\n/g, "<br>")}</div>` : ""}` : D.note ? `<div class="mep-note">${E(D.note).replace(/\n/g, "<br>")}</div>` : "";
  const sty = (k, b) => (b.va && b.va !== "top" ? "display:flex;flex-direction:column;justify-content:" + (b.va === "middle" ? "center" : "flex-end") + ";" : "")
    + "font-size:" + (b.fs || FS[k] || 13) + "px;" + (b.col ? "color:" + b.col + ";" : "") + ((b.b !== undefined ? b.b : BOLD.includes(k)) ? "font-weight:700;" : "font-weight:400;") + (b.i ? "font-style:italic;" : "") + (b.u ? "text-decoration:underline;" : "")
    + (b.bg ? "background:#fff;" : "") + (k === "corps" ? (b.rh !== undefined ? "--rp:" + b.rh + "px;" : "") + (b.hbg ? "--hbg:" + b.hbg + ";" : "") : "") + "z-index:" + (b.z || 1) + ";";
  const blockHTML = (k, b, inner, ed, pos) => `<div class="mep-b mep-${k.replace(/^x_.*/, "x")}${ed ? " ed" : ""}${ed && SEL === k ? " sel" : ""}" data-pb="${k}" style="left:${pos.x}px;top:${pos.y}px;width:${pos.w}px;${(k === "corps" || k === "totaux") && !ed ? "min-height" : "height"}:${pos.h}px;text-align:${b.al || "left"};${sty(k, b)}">${inner}${ed ? `<span class="mep-lb">${isX(k) ? (b.kind === "text" ? "TEXTE" : "CHAMP") : LBL[k]}</span><span class="mep-rz" data-rz="${k}"></span>` : ""}</div>`;
  /* pages : la première porte tous les blocs ; le tableau continue sur les pages suivantes (entête et pied repris), TOTAUX, SIGNATURE et CACHET sur la dernière */
  const pagesHTML = () => {
    const Ly = L(), ed = !!ED, [W, H] = PW[Ly.__o || "p"], rows = D.trs || D.rows || [];
    const inner = {
      entete: O.ent || ed ? `<img src="${typeof SVI_LOGO !== "undefined" ? SVI_LOGO : ""}" alt="">` : "",
      date: "<b>" + today() + "</b>", titre: D.titleHtml || E(D.title || ""), frs: E(D.party || ""), ref: D.refHtml || "RÉFÉRENCE : " + E(D.ref || ""),
      sign: (O.sign || ed) ? `<img src="${(ls.get("svi_sign_v1", null)) || (typeof SVI_SIGN !== "undefined" ? SVI_SIGN : "")}" alt="">` : "",
      cachet: (O.cachet || ed) ? `<img src="${typeof SVI_STAMP !== "undefined" ? SVI_STAMP : ""}" alt="" class="mep-stamp">` : "",
      pied: O.pied || ed ? `<div class="mep-ft">${D.footHtml || "SOCIÉTÉ SVI — AGADIR"}</div>` : "" };
    const cb = Ly.corps, pages = [];
    /* découpe des lignes : mesure réelle dans un conteneur caché, à la largeur du bloc TABLEAU */
    let chunks = [rows];
    if (!ed && !D.html && rows.length) {
      const m = document.createElement("div"); m.className = "mep-measure"; m.style.cssText = "position:absolute;left:-99999px;top:0;width:" + cb.w + "px;" + sty("corps", cb);
      m.innerHTML = tableHTML(cb, rows); document.body.appendChild(m);
      const t = m.querySelector("table"), hh = t.tHead ? t.tHead.offsetHeight : t.rows[0] ? t.rows[0].offsetHeight : 0, rh = [...(t.tBodies[0] && D.trs ? t.tBodies[0].rows : [...t.rows].slice(1))].map(r => r.offsetHeight); m.remove();
      const cap1 = Math.max(cb.h, 120), capN = (Ly.pied.y - 20) - (Ly.entete.y + Ly.entete.h + 20);
      chunks = []; let cur = [], used = hh, cap = cap1;
      rows.forEach((r, i) => { if (cur.length && used + rh[i] > cap) { chunks.push(cur); cur = []; used = hh; cap = capN; } cur.push(r); used += rh[i]; });
      chunks.push(cur);
    }
    chunks.forEach((ch, pi) => {
      const first = pi === 0, last = pi === chunks.length - 1; let h = "";
      Object.keys(Ly).filter(k => k !== "__o").forEach(k => {
        const b = Ly[k]; if (b.hide) return;
        if (!first && !["entete", "pied", "corps", "totaux", "sign", "cachet"].includes(k)) return;
        if (!last && ["totaux", "sign", "cachet"].includes(k) && !ed) return;
        if (k === "sign" && !ed && O.signPg === "first" && !first) return; if (k === "cachet" && !ed && O.cachetPg === "first" && !first) return;
        if (k === "sign" && !ed && O.signPg === "last" && !last) return; if (k === "cachet" && !ed && O.cachetPg === "last" && !last) return;
        let html = isX(k) ? (b.kind === "text" ? E(b.txt || (ed ? "TEXTE" : "")).replace(/\n/g, "<br>") : field(b.field)) : k === "corps" ? tableHTML(b, ch) : k === "totaux" ? totHTML() : inner[k];
        if (!html && !ed) return;
        let pos = { x: b.x, y: b.y, w: b.w, h: b.h };
        if (k === "corps" && !first) pos = { ...pos, y: Ly.entete.y + Ly.entete.h + 20, h: (Ly.pied.y - 20) - (Ly.entete.y + Ly.entete.h + 20) };
        h += blockHTML(k, b, html, ed, pos);
      });
      pages.push(`<div class="mep-pw"><div class="mep-pg${ed ? " lay" : ""}" style="width:${W}px;height:${H}px">${D.prelim && !ed ? `<div class="mep-wm" style="${D.wmColor ? "color:" + D.wmColor : ""}">${E(D.wmText || "VERSION PRÉLIMINAIRE")}</div>` : ""}${h}${chunks.length > 1 ? `<div class="mep-no">${pi + 1} / ${chunks.length}</div>` : ""}</div></div>`);
    });
    /* B29 : page ANNEXE (ex. clauses particulières de la commande) : entête et pied repris, articles numérotés */
    if (D.annex && (D.annex.items || []).length && !ed) {
      let h = ""; ["entete", "pied"].forEach(k => { const b = Ly[k]; if (b && !b.hide && inner[k]) h += blockHTML(k, b, inner[k], false, { x: b.x, y: b.y, w: b.w, h: b.h }); });
      const y = Ly.entete.y + Ly.entete.h + 20, cb = Ly.corps;
      h += `<div class="mep-annex" style="position:absolute;left:${cb.x}px;top:${y}px;width:${cb.w}px;font-size:${cb.fs || 12}px"><div class="mep-ax-t">ANNEXE — ${E(D.annex.title || "")} — ${E(D.ref || "")}</div>
        ${D.annex.items.map((x, i) => `<div class="mep-ax-i"><b>ARTICLE ${i + 1}${x[0] ? " — " + E(x[0]) : ""}</b>${x[1] ? " : " + E(x[1]) : ""}</div>`).join("")}</div>`;
      pages.push(`<div class="mep-pw"><div class="mep-pg" style="width:${W}px;height:${H}px">${h}</div></div>`);
    }
    return pages.join("");
  };
  /* volet de gauche */
  const sideHTML = () => {
    const ck = (k, l) => `<label class="mep-c"><input type="checkbox" data-po="${k}"${O[k] ? " checked" : ""}> ${l}</label>`;
    const pg = (k, dis) => `<select data-po="${k}"${dis ? " disabled" : ""}>${[["last", "DERNIÈRE PAGE"], ["first", "PREMIÈRE PAGE"], ["all", "TOUTES LES PAGES"]].map(o => `<option value="${o[0]}"${O[k] === o[0] ? " selected" : ""}>${o[1]}</option>`).join("")}</select>`;
    const orient = (ED || layOf(D.key, O.orient)).__o || "p";
    let h = `<div class="mep-h"><b>${ED ? "MISE EN PAGE" : "APERÇU"}</b><button type="button" class="mep-ib" data-act="close" title="Fermer">✕</button></div>`;
    if (!ED) {
      h += `<div class="mep-s">${E(D.title || "")} — ${E(D.ref || "")}</div><div class="mep-l">ORIENTATION</div><div class="mep-al"><button type="button" class="mep-btn${orient === "p" ? " on" : ""}" data-or="p">PORTRAIT</button><button type="button" class="mep-btn${orient === "l" ? " on" : ""}" data-or="l">PAYSAGE</button></div>`;
      h += ck("ent", "ENTÊTE") + ck("pied", "PIED DE PAGE") + ck("cachet", "CACHET") + `<div class="mep-sub"><div class="mep-l">PAGES CACHET</div>${pg("cachetPg", !O.cachet)}</div>`
        + ck("sign", "SIGNATURE") + `<div class="mep-sub"><div class="mep-l">PAGES SIGNATURE</div>${pg("signPg", !O.sign)}</div>`;
      h += `<button type="button" class="mep-btn mep-mp" data-act="edit">MISE EN PAGE</button>${D.save ? `<button type="button" class="mep-btn mep-g" data-act="pdf">GÉNÉRER PDF</button>` : ""}<button type="button" class="mep-btn" data-act="print">IMPRIMER SANS CLASSER</button>`
        + `<div class="mep-s">${D.save ? "GÉNÉRER PDF CLASSE LE DOCUMENT DANS DOCUMENTS. " : ""}IMPRIMER NE LE CLASSE PAS.</div><div class="mep-msg" id="mepMsg"></div>`;
      return h;
    }
    const b = SEL && ED[SEL];
    h += `<div class="mep-l">AJOUTER UN BLOC</div><select data-ladd><option value="">CHOISIR…</option><option value="text">TEXTE LIBRE</option>${FLD.map(f => `<option value="${f[0]}">CHAMP : ${f[1]}</option>`).join("")}</select>`;
    h += `<div class="mep-l">BLOC SÉLECTIONNÉ</div><div class="mep-blk">${b ? (isX(SEL) ? (b.kind === "text" ? "TEXTE" : "CHAMP") : LBL[SEL]) : "AUCUN — TOUCHER UN BLOC DE LA PAGE"}</div>`;
    if (b && isX(SEL) && b.kind === "text") h += `<div class="mep-l">TEXTE DU BLOC</div><textarea class="mep-tx" data-ltxt rows="3">${E(b.txt || "")}</textarea>`;
    if (b && isX(SEL) && b.kind === "field") h += `<div class="mep-l">CHAMP AFFICHÉ</div><select data-lfld>${FLD.map(f => `<option value="${f[0]}"${b.field === f[0] ? " selected" : ""}>${f[1]}</option>`).join("")}</select>`;
    if (b) {
      const btns = (lab, attr, list, cur) => `<div class="mep-l">${lab}</div><div class="mep-al">${list.map(o => `<button type="button" class="mep-btn${cur === o[0] ? " on" : ""}" ${attr}="${o[0]}">${o[1]}</button>`).join("")}</div>`;
      h += btns("ALIGNEMENT VERTICAL", "data-lva", [["top", "HAUT"], ["middle", "CENTRÉ"], ["bottom", "BAS"]], b.va || "top");
      if (TXT.includes(SEL) || isX(SEL)) h += btns("ALIGNEMENT", "data-lal", [["left", "GAUCHE"], ["center", "CENTRE"], ["right", "DROITE"]], b.al || "left");
      if (STY.includes(SEL) || isX(SEL)) {
        const isB = b.b !== undefined ? b.b : BOLD.includes(SEL);
        h += `<div class="mep-l">TAILLE DES CARACTÈRES</div><div class="mep-al"><button type="button" class="mep-btn" data-lfs="-1">A −</button><span class="mep-fs">${b.fs || FS[SEL] || 13} px</span><button type="button" class="mep-btn" data-lfs="1">A +</button></div>`
          + `<div class="mep-l">COULEUR</div><div class="mep-al"><input type="color" data-lcol value="${b.col || "#000000"}">${["#000000", "#1f2430", "#2050d8", "#ca3a31", "#4ba054", "#8a909c"].map(c => `<button type="button" class="mep-sw${(b.col || "#000000") === c ? " on" : ""}" data-lcs="${c}" style="background:${c}"></button>`).join("")}</div>`
          + `<div class="mep-l">STYLE</div><div class="mep-al"><button type="button" class="mep-btn${isB ? " on" : ""}" data-lst="b" style="font-weight:800">G</button><button type="button" class="mep-btn${b.i ? " on" : ""}" data-lst="i" style="font-style:italic">I</button><button type="button" class="mep-btn${b.u ? " on" : ""}" data-lst="u" style="text-decoration:underline">S</button></div>`;
      }
      h += btns("FOND", "data-lbg", [["0", "TRANSPARENT"], ["1", "BLANC"]], b.bg ? "1" : "0") + `<div class="mep-l">SUPERPOSITION</div><div class="mep-al"><button type="button" class="mep-btn" data-lz="up">AU PREMIER PLAN</button><button type="button" class="mep-btn" data-lz="down">ARRIÈRE-PLAN</button></div>`;
      if (SEL === "corps" && !D.html && (D.cols || []).length) {
        const C = colsOf(b);
        h += `<div class="mep-l">HAUTEUR DES LIGNES</div><div class="mep-al"><button type="button" class="mep-btn" data-lrh="-1">−</button><span class="mep-fs">${b.rh ?? 4} px</span><button type="button" class="mep-btn" data-lrh="1">+</button></div>`
          + `<div class="mep-l">COLONNES : AFFICHAGE, ORDRE, RESTE ET LARGEUR (%)</div><div class="mep-cw">` + C.all.map((c, i, a) => { const on = C.vis.includes(c[0]), isR = c[0] === C.rest, w = (b.cw || {})[c[0]] ?? (C.vis.length > 6 ? 9 : 14);
            return `<div class="mep-cwr${on ? "" : " off"}"><input type="checkbox" data-lvis="${c[0]}"${on ? " checked" : ""}><span>${E(c[1])}</span><button type="button" class="mep-btn" data-lord="${c[0]}|-1"${i ? "" : " disabled"}>▲</button><button type="button" class="mep-btn" data-lord="${c[0]}|1"${i < a.length - 1 ? "" : " disabled"}>▼</button>`
              + `<input type="radio" name="mepRest" data-lrest="${c[0]}"${isR ? " checked" : ""} title="RESTE">${isR ? "<i>RESTE</i>" : `<button type="button" class="mep-btn" data-lcw="${c[0]}|-1">−</button><b>${w}</b><button type="button" class="mep-btn" data-lcw="${c[0]}|1">+</button>`}</div>`; }).join("") + "</div>";
      }
      if (!FIX.includes(SEL)) h += `<button type="button" class="mep-btn mep-x" data-act="del">SUPPRIMER CE BLOC</button>`;
      h += `<div class="mep-l">POSITION (PX)</div><div class="mep-blk">X ${Math.round(b.x)} · Y ${Math.round(b.y)} · L ${Math.round(b.w)} · H ${Math.round(b.h)}</div>`;
    }
    h += `<button type="button" class="mep-btn mep-g" data-act="save">ENREGISTRER LA MISE EN PAGE</button><button type="button" class="mep-btn" data-act="reset">RÉTABLIR LA MISE EN PAGE STANDARD</button><button type="button" class="mep-btn" data-act="cancel">ANNULER</button>`;
    return h;
  };
  const fit = () => { if (!ROOT) return; const area = ROOT.querySelector(".mep-area"), W = PW[L().__o || "p"][0], k = Math.min(1, (area.clientWidth - 40) / W);
    ROOT.querySelectorAll(".mep-pg").forEach(p => { p.style.transform = "scale(" + k + ")"; p.parentNode.style.height = (p.offsetHeight * k + 16) + "px"; p.parentNode.style.width = (W * k) + "px"; }); ROOT.dataset.k = k;
    /* TOTAUX : à la suite du tableau (dernière page) */
    const Ly = L(), pgs = ROOT.querySelectorAll(".mep-pg"), lastPg = pgs[pgs.length - 1];
    if (Ly.totaux && Ly.totaux.flow && lastPg) { const tb = lastPg.querySelector(".mep-totaux"), cp = lastPg.querySelector(".mep-corps"); if (tb && cp) { const t = cp.querySelector("table"), y = cp.offsetTop + (t ? t.offsetHeight : 0) + 12; tb.style.top = y + "px"; tb.style.left = (cp.offsetLeft + cp.offsetWidth - Ly.totaux.w) + "px"; } } };
  const draw = () => { if (!ROOT) return; ROOT.querySelector(".mep-side").innerHTML = sideHTML(); ROOT.querySelector(".mep-pages").innerHTML = pagesHTML(); requestAnimationFrame(fit); };
  const saveO = () => { const o = { ...O }; delete o.orient; ls.set(OKEY, o); };
  const load = src => new Promise((ok, ko) => { if (document.querySelector(`script[src="${src}"]`)) return ok(); const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
  const genPdf = async () => {
    const msg = ROOT.querySelector("#mepMsg"); if (msg) msg.textContent = "PRÉPARATION DU PDF…";
    await load("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"); await load("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    const orient = L().__o || "p", pdf = new window.jspdf.jsPDF({ orientation: orient === "l" ? "landscape" : "portrait", unit: "mm", format: "a4" });
    const pgs = [...ROOT.querySelectorAll(".mep-pg")];
    for (let i = 0; i < pgs.length; i++) { const p = pgs[i], tr = p.style.transform; p.style.transform = "none";
      const c = await window.html2canvas(p, { scale: 2, backgroundColor: "#fff", useCORS: true }); p.style.transform = tr;
      if (i) pdf.addPage("a4", orient === "l" ? "landscape" : "portrait"); const [w, h] = orient === "l" ? [297, 210] : [210, 297]; pdf.addImage(c.toDataURL("image/jpeg", .92), "JPEG", 0, 0, w, h); }
    return pdf.output("blob");
  };
  const click = async e => {
    const t = e.target, a = t.closest && t.closest("[data-act]");
    if (t.closest("[data-or]")) { O.orient = t.closest("[data-or]").dataset.or; const all = ls.get(LKEY, {}), u = all[D.key] || {}; if (u.__o !== O.orient) { all[D.key] = { __o: O.orient }; ls.set(LKEY, all); } draw(); return; }
    if (a) { const k = a.dataset.act;
      if (k === "close") { close(); return; }
      if (k === "edit") { ED = JSON.parse(JSON.stringify(layOf(D.key, O.orient))); SEL = null; draw(); return; }
      if (k === "cancel") { ED = null; SEL = null; draw(); return; }
      if (k === "reset") { ED = JSON.parse(JSON.stringify(layOf("__std__", ED.__o))); SEL = null; draw(); svToast && svToast("MISE EN PAGE STANDARD RÉTABLIE (PENSER À ENREGISTRER).", 2500); return; }
      if (k === "save") { const all = ls.get(LKEY, {}); all[D.key] = ED; ls.set(LKEY, all); ED = null; SEL = null; draw(); svToast && svToast("MISE EN PAGE ENREGISTRÉE POUR CE TYPE DE DOCUMENT.", 2500); return; }
      if (k === "del") { if (ED && SEL) { if (isX(SEL) && !ED[SEL].auto) delete ED[SEL]; else ED[SEL].hide = true; SEL = null; draw(); } return; }
      if (k === "print") { document.body.classList.add("mep-printing"); const st = document.createElement("style"); st.id = "mepPage"; st.textContent = "@page { size: A4 " + ((L().__o || "p") === "l" ? "landscape" : "portrait") + "; margin: 0; }"; document.head.appendChild(st);
        const back = () => { document.body.classList.remove("mep-printing"); st.remove(); fit(); window.removeEventListener("afterprint", back); }; window.addEventListener("afterprint", back);
        ROOT.querySelectorAll(".mep-pg").forEach(p => { p.style.transform = "none"; }); window.print(); setTimeout(back, 1500); return; }
      if (k === "pdf") { a.disabled = true; try { const blob = await genPdf(), nm = (D.name || ((D.ref || "") + " " + (D.title || ""))).replace(/[\\/:*?"<>|]+/g, "-").trim() + ".pdf"; const r = await D.save(blob, nm); const m = ROOT.querySelector("#mepMsg"); if (m) m.textContent = r ? "CLASSÉ DANS DOCUMENTS : " + r : "PDF GÉNÉRÉ."; }
        catch (err) { const m = ROOT.querySelector("#mepMsg"); if (m) m.textContent = "ÉCHEC DE LA GÉNÉRATION DU PDF."; } a.disabled = false; return; }
    }
    if (!ED) return;
    const b = SEL && ED[SEL]; if (!b) return;
    const st = (fn) => { fn(); draw(); };
    if (t.closest("[data-lva]")) return st(() => { b.va = t.closest("[data-lva]").dataset.lva; });
    if (t.closest("[data-lal]")) return st(() => { b.al = t.closest("[data-lal]").dataset.lal; });
    if (t.closest("[data-lfs]")) return st(() => { b.fs = Math.max(6, Math.min(60, (b.fs || FS[SEL] || 13) + +t.closest("[data-lfs]").dataset.lfs)); });
    if (t.closest("[data-lcs]")) return st(() => { b.col = t.closest("[data-lcs]").dataset.lcs; });
    if (t.closest("[data-lst]")) return st(() => { const s = t.closest("[data-lst]").dataset.lst; if (s === "b") b.b = !(b.b !== undefined ? b.b : BOLD.includes(SEL)); else b[s] = !b[s]; });
    if (t.closest("[data-lbg]")) return st(() => { b.bg = t.closest("[data-lbg]").dataset.lbg === "1"; });
    if (t.closest("[data-lz]")) return st(() => { const zs = Object.keys(ED).filter(k => k !== "__o").map(k => ED[k].z || 1); b.z = t.closest("[data-lz]").dataset.lz === "up" ? Math.min(60, Math.max(...zs) + 1) : Math.max(0, Math.min(...zs) - 1); });
    if (t.closest("[data-lrh]")) return st(() => { b.rh = Math.max(0, Math.min(20, (b.rh ?? 4) + +t.closest("[data-lrh]").dataset.lrh)); });
    if (t.closest("[data-lord]")) return st(() => { const [k, dd] = t.closest("[data-lord]").dataset.lord.split("|"), C = colsOf(b), ord = C.all.map(c => c[0]), i = ord.indexOf(k), j = i + +dd; if (j < 0 || j >= ord.length) return; [ord[i], ord[j]] = [ord[j], ord[i]]; b.order = ord; });
    if (t.closest("[data-lcw]")) return st(() => { const [k, dd] = t.closest("[data-lcw]").dataset.lcw.split("|"), C = colsOf(b); b.cw = b.cw || {}; b.cw[k] = Math.max(3, Math.min(80, ((b.cw[k] ?? (C.vis.length > 6 ? 9 : 14)) + +dd))); });
  };
  const change = e => { const t = e.target; if (t.matches("[data-po]")) { O[t.dataset.po] = t.type === "checkbox" ? t.checked : t.value; saveO(); draw(); return; }
    if (!ED) return; const b = SEL && ED[SEL];
    if (t.matches("[data-ladd]") && t.value) { const k = "x_" + Date.now().toString(36), W = PW[ED.__o || "p"][0]; ED[k] = { kind: t.value === "text" ? "text" : "field", field: t.value === "text" ? "" : t.value, txt: t.value === "text" ? "TEXTE" : "", x: W / 2 - 120, y: 60, w: 240, h: 30, al: "left" }; SEL = k; draw(); return; }
    if (!b) return;
    if (t.matches("[data-lfld]")) { b.field = t.value; draw(); }
    if (t.matches("[data-lcol]")) { b.col = t.value; draw(); }
    if (t.matches("[data-lvis]")) { const C = colsOf(b), v = new Set(C.vis); if (t.checked) v.add(t.dataset.lvis); else v.delete(t.dataset.lvis); b.vis = C.all.map(c => c[0]).filter(k => v.has(k)); draw(); }
    if (t.matches("[data-lrest]")) { b.rest = t.dataset.lrest; draw(); } };
  const input = e => { const t = e.target; if (ED && SEL && t.matches("[data-ltxt]")) { ED[SEL].txt = t.value; const n = ROOT.querySelector(`.mep-b[data-pb="${SEL}"]`); if (n && n.firstChild && n.firstChild.nodeType === 3) n.firstChild.textContent = t.value; } };
  /* glisser / redimensionner un bloc (doigt ou souris) */
  const down = e => { if (!ED) return; const blk = e.target.closest(".mep-b.ed"); if (!blk) return; e.preventDefault();
    const k = blk.dataset.pb, rz = !!e.target.closest("[data-rz]"), sc = +(ROOT.dataset.k || 1), b = ED[k]; if (k === "totaux") b.flow = false;
    const o = { x: b.x, y: b.y, w: b.w, h: b.h }, sx = e.clientX, sy = e.clientY, [W, H] = PW[ED.__o || "p"];
    if (SEL !== k) { SEL = k; ROOT.querySelector(".mep-side").innerHTML = sideHTML(); ROOT.querySelectorAll(".mep-b.sel").forEach(x => x.classList.remove("sel")); blk.classList.add("sel"); }
    const mv = ev => { const dx = (ev.clientX - sx) / sc, dy = (ev.clientY - sy) / sc;
      if (rz) { b.w = Math.max(30, Math.min(W - b.x, o.w + dx)); b.h = Math.max(16, o.h + dy); } else { b.x = Math.max(0, Math.min(W - b.w, o.x + dx)); b.y = Math.max(0, Math.min(H - 16, o.y + dy)); }
      blk.style.left = b.x + "px"; blk.style.top = b.y + "px"; blk.style.width = b.w + "px"; blk.style.height = b.h + "px"; };
    const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); ROOT.querySelector(".mep-side").innerHTML = sideHTML(); };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); };
  const close = () => { if (ROOT) ROOT.remove(); ROOT = null; ED = null; SEL = null; document.body.classList.remove("mep-open"); if (RES) window.removeEventListener("resize", RES); };
  const open = doc => {
    close(); D = doc || {}; O = opt0(); O.orient = (ls.get(LKEY, {})[D.key] || {}).__o || D.orient || "p";
    ROOT = document.createElement("div"); ROOT.id = "sviMep"; ROOT.innerHTML = `<aside class="mep-side"></aside><div class="mep-area"><div class="mep-pages"></div></div>`;
    document.body.appendChild(ROOT); document.body.classList.add("mep-open");
    ROOT.addEventListener("click", click); ROOT.addEventListener("change", change); ROOT.addEventListener("input", input); ROOT.addEventListener("pointerdown", down);
    RES = () => fit(); window.addEventListener("resize", RES);
    draw();
  };
  return { open, close, layOf };
})();
window.sviMep = sviMep;

/* v784 : APERÇU d'une LISTE (liste des budgets, listes des achats) — ⋯ du titre de la liste ; le tableau affiché (filtres compris) */
/* v785 : les listes ont la même barre que le budget (ANNULER, RÉTABLIR, PRÉCÉDENT, SUIVANT, ALERTES, FERMER, ⋯) ; ce qui est sans objet est grisé et dit pourquoi */
const sviListBar = () => sviHdrBar({ attr: "nvl", why: { undo: "RIEN À ANNULER DANS LA LISTE.", redo: "RIEN À RÉTABLIR DANS LA LISTE.", prev: "LISTE : PAS D'ÉCRAN PRÉCÉDENT.", next: "LISTE : PAS D'ÉCRAN SUIVANT.", todo: "AUCUNE ALERTE.", close: "LISTE : RIEN À FERMER (MENU ☰ POUR CHANGER D'ÉCRAN)." } });
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest(".svi-hdr .hdr-off[data-why]"); if (!b || b.closest(".bdg-d-sticky .bdg-d-hright:not(.svi-hdr)")) return; e.stopPropagation(); e.preventDefault(); svToast(b.dataset.why, 3000, b); }, true);
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest(".nvl-more"); if (!b) return;
  e.stopPropagation();
  const shell = b.closest(".novapp-list-shell"), t = shell ? shell.querySelector("table") : sviColhTableNear(b), h1 = shell ? shell.querySelector(".novapp-list-titlebar h1") : b.closest("#ach")?.querySelector(".section-head h2, .section-head h1");
  /* v818 : actions propres à une liste, ajoutées par son module (SVI_LIST_EXTRA : { when(titre), items, act(k) }) */
  const ttl = h1 ? (h1.childNodes[0] ? h1.childNodes[0].textContent : h1.textContent).trim() : "", EX = (window.SVI_LIST_EXTRA || []).filter(x => { try { return x.when(ttl); } catch (er) { return false; } });
  sviHdrMenu(b, [sviColhItems(t), EX.flatMap(x => x.items), [{ k: "apr", lab: "APERÇU" }], [{ k: "__fmt", lab: "MODIFIER LE FORMAT" }, { k: "__lay", lab: "DISPOSITION PAR DÉFAUT" }]].filter(g => g.length), a => {
    if (a === "__fmt") { sviFmtCurWin(); return; }   /* v927 (remarque 12) */
    { const x = EX.find(y => y.items.some(i => i.k === a)); if (x) { x.act(a); return; } }
    /* v920 (remarque 1) : DISPOSITION PAR DÉFAUT aussi dans les listes — colonnes d'origine, puis la liste est redessinée */
    if (a === "__lay") { sviLayAsk().then(go => { if (!go) return; sviLayReset(shell || (t && t.closest("section, .novapp-list-shell")) || document);
      const v = b.closest("#ach"); if (v && v.__achTab) { let k = "art"; try { k = localStorage.getItem("svi_ach_tab_v1") || "art"; } catch (e) {} v.__achTab(k); }
      else if (typeof renderBudgetList === "function") renderBudgetList(); }); return; }
    if (!t || sviColhPick(a, t)) return;
    const vis = sviColhVis(t);
    const ths = [...t.tHead.rows[0].cells].map(th => (th.querySelector(".cf-lab") || th).textContent.trim()), keep = ths.map((x, i) => x && vis.includes(i) ? i : -1).filter(i => i >= 0);
    const num = i => [...t.tBodies[0].rows].some(r => r.cells[i] && r.cells[i].classList.contains("number"));
    /* v793 : lignes cochées (cases à droite de la liste) s'il y en a, sinon toutes les lignes affichées */
    const R0 = [...t.tBodies[0].rows].filter(r => !r.matches(".bdg-newrow, .ach-new, .rec-new") && !r.querySelector("td.empty") && r.cells.length >= keep.length), RC = R0.filter(r => r.querySelector(".nvl-cb:checked"));
    const rows = (RC.length ? RC : R0).map(r => keep.map(i => (r.cells[i] ? r.cells[i].textContent.replace(/\s+/g, " ").trim() : "")));
    const title = h1 ? h1.childNodes[0].textContent.trim() || h1.textContent.trim() : "LISTE";
    sviMep.open({ key: "LISTE-" + title.replace(/\s*\(.*$/, "").replace(/[^A-Z0-9É]+/gi, "-").toUpperCase(), orient: "l", title, ref: new Date().toLocaleDateString("fr-FR"), party: rows.length + " LIGNE(S)",
      cols: keep.map((i, j) => ["c" + j, ths[i], num(i) ? "number" : ""]), rows, name: title + " " + new Date().toISOString().slice(0, 10) });
  });
}, true);
/* ⟪ src/09f-fenetres-communes.js ⟫ */
/* =========================================================
   v798 : MOTEUR COMMUN DES FENÊTRES ET DES ÉCRANS D'ACHAT (document unique 6.4, 6.5, 8.6, 10.2)
   Appliqué tout seul, sans toucher au code de chaque fenêtre, à tout ce qui s'affiche dans les fenêtres
   (#svConf, #docPop) et dans l'écran des achats (#ach) :
   - liste déroulante de l'iPad (<select>) → bouton au format de l'application qui ouvre le menu commun
     (✓ devant le choix) ; la liste d'origine reste, cachée, et reçoit le choix (mêmes événements) ;
   - bouton « Choisir le fichier » de Safari → bouton CHOISIR UN FICHIER en majuscules et nom du fichier ;
   - bouton « + LIGNE » sous un tableau → ligne rouge CRÉER UNE LIGNE ICI… en bas du tableau (6.5) ;
   - ✕ au bout des lignes d'un tableau → case à droite et SUPPRIMER LES LIGNES COCHÉES (6.4) ;
   - pied des fenêtres : FERMER devient ANNULER quand la fenêtre a une action (10.2).
   Une liste, un fichier ou un bouton marqué data-native garde sa forme d'origine.
   ========================================================= */
const SVI_UP_SC = "#svConf, #docPop, #ach";
function sviSelLab(s) { const o = s.options[s.selectedIndex]; return o ? String(o.textContent || "").trim().toUpperCase() : ""; }
function sviSelSync(s) {
  const b = s.__svBtn;
  if (!b) return;
  b.querySelector(".sv-sel-t").textContent = sviSelLab(s);
  b.disabled = !!s.disabled;
}
function sviSelUp(s) {
  if (s.__svBtn || s.multiple || s.hasAttribute("data-native")) { if (s.__svBtn) sviSelSync(s); return; }
  const b = document.createElement("button");
  b.type = "button";
  b.className = "sv-sel";
  b.innerHTML = `<span class="sv-sel-t"></span><i class="sv-sel-a">▾</i>`;
  s.__svBtn = b;
  s.classList.add("sv-natsel");
  s.after(b);
  sviSelSync(s);
  b.addEventListener("click", e => {
    e.preventDefault(); e.stopPropagation();
    if (s.disabled) return;
    const items = [...s.options].filter(o => !o.disabled).map(o => ({ k: o.value, lab: String(o.textContent || "").trim().toUpperCase() || "—" }));
    sviEtatMenu(b, items, s.value, v => {
      s.value = v;
      sviSelSync(s);
      s.dispatchEvent(new Event("input", { bubbles: true }));
      s.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const m = document.getElementById("sviEtatMenu");
    if (m) { m.style.zIndex = "100020"; m.style.maxHeight = "60vh"; m.style.overflow = "auto"; }
  });
  s.addEventListener("change", () => sviSelSync(s));
}
function sviFileUp(f) {
  if (f.__svBtn || f.hasAttribute("data-native")) return;
  const w = document.createElement("span");
  w.className = "sv-file";
  w.innerHTML = `<button type="button" class="sv-file-b">CHOISIR UN FICHIER</button><span class="sv-file-n">AUCUN FICHIER CHOISI</span>`;
  f.__svBtn = w;
  f.classList.add("sv-natfile");
  f.after(w);
  const b = w.querySelector(".sv-file-b"), n = w.querySelector(".sv-file-n");
  b.disabled = !!f.disabled;
  b.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); if (!f.disabled) f.click(); });
  f.addEventListener("change", () => { const x = f.files && f.files[0]; n.textContent = x ? String(x.name).toUpperCase() : "AUCUN FICHIER CHOISI"; });
}
/* « + LIGNE » → ligne CRÉER … ICI en bas du tableau qui le précède */
function sviAddRowUp(btn) {
  if (btn.__svRow || btn.hasAttribute("data-native")) return;
  let t = btn.previousElementSibling;
  while (t && t.tagName !== "TABLE") t = t.previousElementSibling;
  if (!t || !t.tBodies[0]) return;
  const n = t.tHead && t.tHead.rows[0] ? [...t.tHead.rows[0].cells].reduce((a, c) => a + (c.colSpan || 1), 0) : 1;
  const tr = document.createElement("tr");
  tr.className = "rec-new sv-addrow";
  tr.innerHTML = `<td colspan="${n}">CRÉER UNE LIGNE ICI…</td>`;
  tr.addEventListener("click", () => btn.click());
  const tb = t.tBodies[0];
  [...tb.rows].forEach(r => { if (r.cells.length === 1 && /^AUCUNE? /.test(String(r.textContent || "").trim())) r.remove(); });
  tb.appendChild(tr);
  btn.__svRow = tr;
  btn.classList.add("sv-hidebtn");
}
/* ✕ au bout des lignes → case à droite ; SUPPRIMER LES LIGNES COCHÉES sous le tableau */
function sviRmUp(t) {
  if (t.__svRm) return;
  const xs = [...t.querySelectorAll("tbody button.ach-x[data-rml]")];
  if (!xs.length) return;
  t.__svRm = true;
  xs.forEach(x => {
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "sv-rmcb";
    cb.dataset.rml = x.dataset.rml;
    x.classList.add("sv-hidebtn");
    x.after(cb);
  });
  const bar = document.createElement("div");
  bar.className = "sv-rmbar";
  bar.innerHTML = `<button type="button" class="ach-b sv-rmall" disabled>SUPPRIMER LES LIGNES COCHÉES <span class="svi-cnt">0</span></button>`;
  t.after(bar);
  const del = bar.querySelector(".sv-rmall"), cnt = del.querySelector(".svi-cnt");
  t.addEventListener("change", e => { if (!e.target.matches(".sv-rmcb")) return; const n = t.querySelectorAll(".sv-rmcb:checked").length; del.disabled = !n; cnt.textContent = n; });
  del.addEventListener("click", e => {
    e.preventDefault();
    const root = t.closest(SVI_UP_SC) || document;
    const idx = [...t.querySelectorAll(".sv-rmcb:checked")].map(c => c.dataset.rml).sort((a, b) => +String(b).split("|").pop() - +String(a).split("|").pop());
    /* chaque suppression redessine la fenêtre : on retrouve le ✕ suivant à chaque fois, du dernier au premier */
    idx.forEach(i => { const x = root.querySelector(`button.ach-x[data-rml="${i}"]`); if (x) x.click(); });
  });
}
function sviFootUp(f) {
  if (f.__svFoot) return;
  f.__svFoot = true;
  const bs = [...f.querySelectorAll("button")];
  const x = bs.find(b => b.hasAttribute("data-x") && /^FERMER$/.test(String(b.textContent || "").trim()));
  /* v799 : pas de « ANNULER » à côté de « ANNULER LA COMMANDE / LE PAIEMENT… » — FERMER est alors gardé, pour ne pas confondre */
  const twin = bs.some(b => b !== x && /^ANNULER\s/.test(String(b.textContent || "").trim()));
  if (x && bs.length > 1 && !twin) { x.textContent = "ANNULER"; f.prepend(x); }
}
/* v930 (remarque 7 du 04/11/2026, document unique 10.2) : NOM DU CHAMP AU-DESSUS DU CHAMP, sur deux ou trois colonnes, dans toutes
   les fenêtres au format INF (#docPop : INF du budget, nouveau budget, avenant, documents, TAF, observations…) — chaque libellé et son champ
   forment une case ; ce qui n'est pas un champ (note, fichier) prend toute la largeur. Les fenêtres des achats l'ont déjà (NOUVELLE FACTURE). */
function sviGridTop(g) {
  if (!g || g.dataset.top) return; g.dataset.top = "1";
  const C = [...g.children];
  for (let i = 0; i < C.length; i++) {
    const c = C[i]; if (!c.matches(".doc-lab")) { c.classList.add("doc-span"); continue; }
    const cell = document.createElement("div"); cell.className = "doc-cell"; g.insertBefore(cell, c); cell.appendChild(c);
    const n = C[i + 1]; if (n && !n.matches(".doc-lab")) { cell.appendChild(n); i++; }
  }
}
/* champs des fenêtres des achats (#svConf) agrandissables par leur coin (même poignée que les fenêtres INF ; taille gardée par champ) */
function sviFldRszUp(i) {
  if (!i || i.__rsz || i.closest(".fld-wrap") || i.closest("table") || ["checkbox", "radio", "file", "color", "hidden"].includes(i.type)) return; i.__rsz = true;
  const lab = i.closest("label"), k = "fld.svc." + (i.dataset.k || i.dataset.f || i.id || ((lab && lab.querySelector("span")) || {}).textContent || "x").replace(/\s+/g, " ").trim();
  const wrap = document.createElement("span"); wrap.className = "fld-wrap svc-fw"; i.replaceWith(wrap); wrap.appendChild(i);
  const S = (() => { try { return psLoad()[k]; } catch (e) { return null; } })(); if (S && S.w) { wrap.style.width = S.w + "px"; wrap.classList.add("sized"); } if (S && S.h) i.style.height = S.h + "px";
  const hd = document.createElement("span"); hd.className = "fld-rsz"; hd.title = "Glisser pour régler la taille du champ"; wrap.appendChild(hd);
  hd.addEventListener("pointerdown", e => { const r = i.getBoundingClientRect(); let w = r.width, h = r.height;
    dragXY(e, (dx, dy) => { w = Math.max(60, Math.round(r.width + dx)); h = Math.max(28, Math.round(r.height + dy)); wrap.style.width = w + "px"; wrap.classList.add("sized"); i.style.height = h + "px"; }, () => psSet(k, { w, h })); });
  hd.addEventListener("dblclick", () => { wrap.style.width = ""; wrap.classList.remove("sized"); i.style.height = ""; psSet(k, null); });
}
/* B46 (série B, 05/11) : les messages d'alerte d'une fenêtre ne sont plus en bandeau — ils passent dans le TRIANGLE ⚠ à côté de la croix
   (pastille = nombre ; toucher = la liste) ; un bandeau qui porte un bouton d'action (RIB VÉRIFIÉ, DÉBLOQUER…) reste en place */
function sviWhyUp(card) {
  if (!card) return; const W = [...card.querySelectorAll(".frs-why")].filter(w => !w.querySelector("button, a, input"));
  let b = card.querySelector(":scope > .svc-alert"); const msgs = W.flatMap(w => { w.hidden = true; return String(w.textContent || "").replace(/^\s*[⚠↩]\s*/, "").split(" · ").map(s => s.trim()).filter(Boolean); });
  if (!msgs.length) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement("button"); b.type = "button"; b.className = "svc-alert"; b.setAttribute("aria-label", "Alertes"); card.appendChild(b);
    b.addEventListener("click", e => { e.stopPropagation(); svToast("⚠ " + (b.__msgs || []).join(" · "), 6000, b); }); }
  b.__msgs = msgs; b.innerHTML = `⚠<b>${msgs.length}</b>`;
}
/* C3 (série C, document unique 10.6) : TAILLE DES CHAMPS — même hauteur pour tous ; même largeur pour une même famille, partout :
   date ; date et heure ; montant ; pourcentage ; petit nombre ; code ; RIB ; téléphone ; e-mail et site ; texte court ; texte long.
   La famille se lit sur le type du champ et sur son intitulé ; un champ agrandi à la main (.sized) garde sa taille. */
const SVI_FAM_W = { date: 132, dt: 196, mt: 150, pct: 96, nb: 96, code: 196, rib: 290, tel: 164, mail: 270, court: 220, long: "100%" };
function sviFldFam(el) {
  const t = String(el.getAttribute("type") || "").toLowerCase(), lab0 = el.closest("label, .doc-cell, .frs-f"), sp = lab0 && lab0.querySelector("span, .doc-lab");
  const L = String((sp && sp !== el && (sp.dataset.olab || sp.textContent)) || el.getAttribute("aria-label") || el.placeholder || "").toUpperCase();
  const ph = String(el.placeholder || "").toUpperCase();
  if (/HH:MM/.test(ph) && /AAAA/.test(ph)) return "dt";
  if (el.classList.contains("sv-date") || /JJ\/MM\/AAAA/.test(ph)) return "date";
  if (t === "datetime-local" || (/DATE|\bLE$|\bLE\b.*\bÀ\b/.test(L) && /HEURE|\bÀ\b/.test(L))) return "dt";
  if (t === "date" || /^DATE\b|\bDATE\b|\bLE$|DÉBUT$|FIN$|ÉCHÉANCE|EXPIR/.test(L)) return "date";
  if (el.tagName === "TEXTAREA" || /ADRESSE|MÉMO|NOTE|OBSERVATION|EXPLICATION|COMMENTAIRE|DESCRIPTI|OBJET|MOTIF|CLAUSE|TEXTE/.test(L)) return "long";
  if (/^VILLE|^PAYS|^NOM\b|^INTITULÉ|^BANQUE|^AGENCE/.test(L)) return "court";
  if (/%/.test(L)) return "pct";
  if (/\(MAD\)|\(DH|\bDH\b|\(HT\)|\bHT\)/.test(L)) return "mt";
  if (/\bRIB\b/.test(L)) return "rib";
  if (/E-?MAIL|COURRIEL|\bSITE\b/.test(L)) return "mail";
  if (/TÉL|GSM|FAX|PORTABLE/.test(L)) return "tel";
  if (/\(JOURS?\)|\(MOIS\)|NOMBRE|EFFECTIF|QUANTIT|\bQTÉ\b|\bJOURS?\b|\bMOIS\b|\(EN TOUT\)|DURÉE|RANG|ORDRE/.test(L)) return "nb";
  if (/\(MAD\)|\(DH|\bDH\b|MONTANT|PLAFOND|PRIX|CAPITAL|FRANCO|MINIMUM|TOTAL|\bHT\b|\bTTC\b|SOLDE|AVANCE|ACOMPTE|FRAIS|ENCOURS/.test(L)) return "mt";
  if (/\bICE\b|\bIF\b|IDENTIFIANT|REGISTRE|\bRC\b|CNSS|\bCODE\b|PATENTE|\bCIN\b|\bN°|NUMÉRO|SWIFT|IBAN|RÉFÉRENCE|MATRICULE|IMMATRICULATION/.test(L)) return "code";
  if (t === "number" || el.inputMode === "decimal" || el.inputMode === "numeric") return "nb";
  return "court";
}
function sviFamUp(root) {
  root.querySelectorAll("input, select, textarea").forEach(el => {
    if (el.closest("table, .mkp-f, #svMaskPop, .fmw-pal") || ["checkbox", "radio", "file", "color", "hidden", "range"].includes(String(el.type || "").toLowerCase())) return;
    if (!el.closest(".frs-f, .doc-cell, .svc-card label, #docPop label")) return;
    const box = el.closest(".fld-wrap") || (el.tagName === "SELECT" && el.__svBtn) || el;
    const f = sviFldFam(el); if (el.dataset.fam !== f) el.dataset.fam = f; if (box.dataset.fam !== f) box.dataset.fam = f; if (box !== el && el.dataset.fam !== f) el.dataset.fam = f; });
}
function sviUpAll() {
  /* C8, D2 : PARAMÉTRAGE — listes (FUSEAU HORAIRE, MOTIF du calendrier…) et choix de fichier (logo) de l'application, jamais ceux de l'iPad */
  { const c = document.getElementById("chs"); if (c) { c.querySelectorAll("select").forEach(sviSelUp); c.querySelectorAll('input[type="file"]').forEach(sviFileUp); } }
  document.querySelectorAll(SVI_UP_SC).forEach(root => {
    root.querySelectorAll("select").forEach(sviSelUp);
    root.querySelectorAll('input[type="file"]').forEach(sviFileUp);
    root.querySelectorAll("button[data-addl]").forEach(sviAddRowUp);
    root.querySelectorAll("table").forEach(sviRmUp);
    root.querySelectorAll(".svc-f").forEach(sviFootUp);
    root.querySelectorAll(".doc-grid").forEach(sviGridTop);
    if (root.id === "svConf") root.querySelectorAll(".frs-f > input.ins-in, .frs-f > textarea.ins-in").forEach(sviFldRszUp);
    if (root.id === "svConf" || root.id === "docPop") sviFamUp(root);
    { const sc = document.querySelector("#chs .pg-soc-card"); if (sc) sviFamUp(sc); }
    if (typeof sviFldApply === "function") sviFldApply(root);
    if (root.id === "svConf") root.querySelectorAll(".svc-card").forEach(sviWhyUp);   /* B11, B17 : réglages des champs */
  });
}
let sviUpRaf = 0;
new MutationObserver(muts => {
  if (!muts.some(m => m.addedNodes.length)) return;
  cancelAnimationFrame(sviUpRaf);
  sviUpRaf = requestAnimationFrame(sviUpAll);
}).observe(document.documentElement, { childList: true, subtree: true });
/* ⟪ src/09f-masques-saisie.js ⟫ */
/* =========================================================
   v804 : MASQUES DE SAISIE (checklist C1.44) — réglés dans PARAMÉTRAGE › FORMAT › MASQUES DE SAISIE
   Écriture d'un masque : 9 = un chiffre, A = une lettre, tout autre signe est écrit tel quel.
   Un champ <input data-mask="clé"> se met en forme pendant la frappe ; sviMaskOk refuse à l'enregistrement
   une valeur qui ne suit pas le masque (LONGUEUR EXACTE : le masque doit être rempli en entier).
   ========================================================= */
const SVI_MASK_KEY = "svi_masks_v1";
const SVI_MASK_DEF = [
  { k: "ice", lab: "ICE", m: "999999999999999", ex: true },
  { k: "if", lab: "IDENTIFIANT FISCAL (IF)", m: "99999999", ex: true },
  { k: "rc", lab: "REGISTRE DE COMMERCE (RC)", m: "999999", ex: false },
  { k: "cnss", lab: "CNSS", m: "9999999", ex: true },
  { k: "tel", lab: "TÉLÉPHONE", m: "99 99 99 99 99", ex: true }
];
/* v811 : réglage mémorisé, relu seulement s'il a changé dans l'appareil (une copie est rendue, modifiable) */
let sviMaskMem = null;
function sviMasks() {
  let raw = null;
  try { raw = localStorage.getItem(SVI_MASK_KEY); } catch (e) {}
  if (!sviMaskMem || sviMaskMem.raw !== raw) {
    let o = {};
    try { o = JSON.parse(raw || "{}") || {}; } catch (e) {}
    /* v928 (remarque 15) : + masques posés sur un champ par appui long (clé « c:… », avec leur libellé) */
    sviMaskMem = { raw, L: SVI_MASK_DEF.map(d => Object.assign({}, d, o[d.k] || {})).concat(Object.keys(o).filter(k => !SVI_MASK_DEF.some(d => d.k === k) && o[k] && o[k].lab).map(k => ({ k, lab: o[k].lab, m: o[k].m || "", ex: !!o[k].ex }))) };
  }
  return sviMaskMem.L.map(x => Object.assign({}, x));
}
function sviMasksSave(L) {
  const o = {};
  L.forEach(x => { o[x.k] = { m: String(x.m || ""), ex: !!x.ex }; if (!SVI_MASK_DEF.some(d => d.k === x.k)) o[x.k].lab = x.lab || x.k; });
  try { localStorage.setItem(SVI_MASK_KEY, JSON.stringify(o)); } catch (e) {}
}
const sviMaskOf = k => sviMasks().find(x => x.k === k) || null;
const sviMaskSlot = c => c === "9" || c === "A";
/* v928 (remarque 15 du 04/11/2026) : écriture du masque — 9 = un chiffre, A = une lettre, "texte" entre guillemets = écrit d'office,
   tout autre signe (espace, tiret, +) placé d'office. Ex. « 999-AAA », « "ABC"-999 », « "+212" 9 99 99 99 99 » */
function sviMaskTok(m) {
  const T = []; let q = false;
  for (const c of String(m || "")) { if (c === '"') { q = !q; continue; } T.push(!q && (c === "9" || c === "A") ? { s: c } : { l: c }); }
  return T;
}
const sviMaskSlots = m => sviMaskTok(m).filter(x => x.s).length;
/* caractères utiles de la saisie (chiffres et lettres, en majuscules) */
const sviMaskRaw = v => String(v ?? "").toUpperCase().replace(/[^0-9A-ZÀ-Ý]/g, "");
/* met la saisie dans le masque : les signes fixes sont posés au fur et à mesure (un signe fixe déjà tapé n'est pas doublé) */
function sviMaskRun(m, v) {
  const s = String(v ?? "").toUpperCase();
  let out = "", i = 0, n = 0;
  for (const tk of sviMaskTok(m)) {
    if (i >= s.length) break;
    const c = tk.s || tk.l;
    if (tk.s) {
      const ok = c === "9" ? (x => /\d/.test(x)) : (x => /[A-ZÀ-Ý]/.test(x));
      while (i < s.length && !ok(s[i])) i++;
      if (i >= s.length) break;
      out += s[i++]; n++;
    } else { out += c; if (s[i] === c) i++; }
  }
  return { out, n, rest: sviMaskRaw(s.slice(i)).length > 0 };
}
function sviMaskFmt(k, v) {
  const M = sviMaskOf(k), m = M ? M.m : "";
  return m ? sviMaskRun(m, v).out : String(v ?? "").toUpperCase();
}
/* vide = accepté (l'obligation est contrôlée ailleurs) */
function sviMaskOk(k, v) {
  const M = sviMaskOf(k);
  if (!sviMaskRaw(v) || !M || !M.m) return true;
  const r = sviMaskRun(M.m, v), need = sviMaskSlots(M.m);
  return !r.rest && r.n > 0 && (M.ex ? r.n === need : r.n <= need);
}
const sviMaskLab = k => (sviMaskOf(k) || {}).lab || k;
/* v928 (remarque 15) : MASQUE POSÉ SUR UN CHAMP — appui long (clic droit sur ordinateur) sur un champ d'une fenêtre = fenêtre MASQUE DE SAISIE
   (administrateur ; ouvert à tous en attendant les droits). Le champ est reconnu par sa clé (data-k / data-f / id) et son libellé. */
function sviMaskLabOf(i) {
  const t = x => String(x || "").replace(/[*\s]+$/g, "").replace(/\s+/g, " ").trim().toUpperCase();
  const l = i.closest("label"); if (l) { const s = l.querySelector("span"); if (s && !s.contains(i)) return t(s.dataset.olab || s.textContent); }
  let p = i.closest(".fld-wrap") || i; p = p.previousElementSibling; if (p && /doc-lab|frs-l/.test(p.className)) return t(p.textContent);
  const td = i.closest("td"), tb = td && td.closest("table"); if (td && tb && tb.tHead) { const th = tb.tHead.rows[0] && tb.tHead.rows[0].cells[td.cellIndex]; if (th) return t(th.textContent); }
  return t(i.placeholder || i.name || i.id || "CHAMP");
}
const sviMaskKeyOf = i => i.dataset.mask || ("c:" + (i.dataset.k || i.dataset.f || i.dataset.c || i.id || "") + "|" + sviMaskLabOf(i));
const SVI_MASK_FIELD = "#svConf input, #docPop input";
const sviMaskable = i => !!(i && i.matches && i.matches(SVI_MASK_FIELD) && (!i.type || ["text", "tel", "search"].includes(i.type)) && !i.readOnly && !i.disabled);
document.addEventListener("focusin", e => { const i = e.target; if (!sviMaskable(i) || i.dataset.mask) return; const k = sviMaskKeyOf(i); if ((sviMaskOf(k) || {}).m) i.dataset.mask = k; }, true);
/* série B (B11, B17, B28) : RÉGLAGES D'UN CHAMP, valables partout où il apparaît — INTITULÉ (renommé), EXPLICATION (bulle à l'appui long
   sur l'intitulé), MASQUE, OBLIGATOIRE (pour tous, ou seulement certains groupes / types de fournisseurs), IMPRIMÉ SUR LA COMMANDE */
const SVI_FLD_K = "svi_fld_v1";
const sviFlds = () => { try { const o = JSON.parse(localStorage.getItem(SVI_FLD_K) || "{}"); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } };
const sviFldSave = o => { try { localStorage.setItem(SVI_FLD_K, JSON.stringify(o)); } catch (e) {} };
const sviFldSrc = i => { const m = String(i.className || "").match(/\b([a-z]+)-xs?\b/); return m ? m[1] : ""; };
/* 05/11 : « SEULEMENT POUR… » = LOCAL, ÉTRANGER (d'après le PAYS de l'adresse), puis les types ;
   C1 (série C) : plus d'OCCASIONNEL — ce n'est plus un groupe, c'est une fréquence calculée (B42) */
const SVI_FLD_ORIG = [["loc", "LOCAL"], ["etr", "ÉTRANGER"]];
const sviFldCtx = i => { const c = i.closest(".svc-card, .frs-card, #docPop") || document, v = s => ((c.querySelector(s) || {}).value || ""), p = String(v('input[data-k="pays"]')).trim().toUpperCase();
  const card = i.closest(".frs-card"), g0 = card && card.dataset.grp; return { g: p ? (p === "MAROC" || p === "MA" ? "loc" : "etr") : (g0 === "etr" ? "etr" : "loc"), occ: !!card && (card.dataset.freq === "occasionnel" || g0 === "occ"), t: v('select[data-k="type"]') }; };
const sviFldReq = (S, x) => !!S && (S.req === "all" || (S.req === "some" && (((S.reqG || []).includes(x.g)) || ((S.reqT || []).includes(x.t)))));
const SVI_FLD_SEL = "#svConf input, #svConf select, #svConf textarea, #docPop input, #docPop textarea";
const sviFldSpan = i => { const l = i.closest("label"); const s = l && l.querySelector("span"); return s && !s.contains(i) ? s : null; };
/* intitulé renommé, bulle d'explication, astérisque des champs obligatoires */
/* C2 (série C, document unique 10.4) : AJUSTABLE — décoché = pas de poignée, taille fixe (la taille gardée est oubliée à l'affichage) */
function sviFldAdjUp(root, F) { root.querySelectorAll(".fld-wrap").forEach(w => { const i = w.querySelector("input, textarea, select"); if (!i) return;
  const fix = (F[sviMaskKeyOf(i)] || {}).adj === false; w.classList.toggle("fld-fix", fix);
  if (fix && w.classList.contains("sized")) { w.style.width = ""; w.classList.remove("sized"); [...w.querySelectorAll("input, textarea, .dt-show")].forEach(x => { x.style.height = ""; x.style.paddingBottom = ""; }); } }); }
function sviFldApply(root) { const F = sviFlds(); sviFldAdjUp(root, F); if (!Object.keys(F).length) return;
  root.querySelectorAll(SVI_FLD_SEL).forEach(i => { if (["checkbox", "radio", "file", "hidden"].includes(i.type)) return; const s = sviFldSpan(i); if (!s) return;
    const k = sviMaskKeyOf(i), S = F[k]; if (!S) return;
    if (s.dataset.olab === undefined) s.dataset.olab = String(s.textContent || "").replace(/[*\s]+$/g, "").trim();
    const star = !!s.querySelector("b") || sviFldReq(S, sviFldCtx(i));
    s.innerHTML = esc(S.lab || s.dataset.olab) + (star ? " <b>*</b>" : ""); if (S.tip) s.dataset.tip = S.tip; else delete s.dataset.tip; });
}
/* OBLIGATOIRE : refusé à l'enregistrement ou à la validation de la fenêtre, quel que soit le champ */
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("#svConf [data-save], #svConf [data-valid], #svConf [data-save2]"); if (!b) return; const F = sviFlds(); if (!Object.keys(F).length) return;
  const card = b.closest("#svConf"); for (const i of card.querySelectorAll(SVI_FLD_SEL)) { if (i.disabled || ["checkbox", "radio", "file", "hidden"].includes(i.type) || i.closest("[hidden]")) continue;
    const S = F[sviMaskKeyOf(i)]; if (!sviFldReq(S, sviFldCtx(i)) || String(i.value || "").trim()) continue;
    e.preventDefault(); e.stopImmediatePropagation(); svToast("CHAMP OBLIGATOIRE : " + (S.lab || S.olab || sviMaskLabOf(i)) + ".", 3500, i); try { i.focus(); } catch (x) {} return; } }, true);
function sviMaskWin(i) {
  const k = sviMaskKeyOf(i), M = sviMaskOf(k) || { k, lab: sviMaskLabOf(i), m: "", ex: false }, S = sviFlds()[k] || {};
  document.getElementById("svMaskPop")?.remove();
  const p = document.createElement("div"); p.id = "svMaskPop";
  const ex = m => m ? sviMaskRun(m, "1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S").out : "";
  const GR = SVI_FLD_ORIG, TY = typeof sviPgL === "function" ? sviPgL("ftypes").map(t => [t.lab, t.lab]) : [], src = sviFldSrc(i);
  const ck = (cls, L, on) => L.map(([v, l]) => `<label class="mkp-c"><input type="checkbox" class="${cls}" value="${esc(v)}"${(on || []).includes(v) ? " checked" : ""}> ${esc(l)}</label>`).join("");
  p.innerHTML = `<div class="mkp-t">CHAMP — ${esc(S.lab || M.lab)}</div>
    <label class="mkp-f"><span>INTITULÉ</span><input class="mkp-lab" value="${esc(S.lab || M.lab)}" autocomplete="off"></label>
    <label class="mkp-f"><span>EXPLICATION (BULLE À L'APPUI LONG SUR L'INTITULÉ)</span><textarea class="mkp-tip" rows="2">${esc(S.tip || "")}</textarea></label>
    <label class="mkp-f"><span>OBLIGATOIRE</span><select class="mkp-req"><option value="">NON</option><option value="all"${S.req === "all" ? " selected" : ""}>POUR TOUS</option><option value="some"${S.req === "some" ? " selected" : ""}>SEULEMENT POUR…</option></select></label>
    <div class="mkp-some"${S.req === "some" ? "" : " hidden"}><div class="mkp-n">LOCAL, ÉTRANGER (D'APRÈS LE PAYS DE L'ADRESSE)</div>${ck("mkp-rg", GR, S.reqG)}${TY.length ? `<div class="mkp-n">TYPES DE FOURNISSEURS</div>${ck("mkp-rt", TY, S.reqT)}` : ""}</div>
    <label class="mkp-c"><input type="checkbox" class="mkp-prt"${S.prt ? " checked" : ""}> IMPRIMÉ SUR LA COMMANDE</label>
    <label class="mkp-c"><input type="checkbox" class="mkp-adj"${S.adj === false ? "" : " checked"}> AJUSTABLE (POIGNÉE POUR AGRANDIR LE CHAMP)</label>
    <div class="mkp-t mkp-t2">MASQUE DE SAISIE</div>
    <label class="mkp-f"><span>MASQUE</span><input class="mkp-m" value="${esc(M.m)}" autocomplete="off" data-keepcase></label>
    <label class="mkp-c"><input type="checkbox" class="mkp-ex"${M.ex ? " checked" : ""}> LONGUEUR EXACTE</label>
    <div class="mkp-x">EXEMPLE : <b class="mkp-e">${esc(ex(M.m))}</b></div>
    <div class="mkp-n">9 = UN CHIFFRE · A = UNE LETTRE · "TEXTE" = ÉCRIT D'OFFICE · AUTRE SIGNE (ESPACE, TIRET) PLACÉ D'OFFICE · VIDE = AUCUN MASQUE</div>
    <div class="mkp-b"><button type="button" class="svc-b" data-mx>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ms>ENREGISTRER</button></div>`;
  document.body.appendChild(p);
  const r = i.getBoundingClientRect(); p.style.left = Math.max(8, Math.min(window.innerWidth - p.offsetWidth - 8, r.left)) + "px"; p.style.top = Math.max(8, Math.min(window.innerHeight - p.offsetHeight - 8, r.bottom + 6)) + "px";
  const mi = p.querySelector(".mkp-m"); setTimeout(() => { try { mi.focus(); } catch (e) {} }, 30);
  mi.addEventListener("input", () => { p.querySelector(".mkp-e").textContent = ex(mi.value.toUpperCase()); });
  p.querySelector(".mkp-req").addEventListener("change", e => { p.querySelector(".mkp-some").hidden = e.target.value !== "some"; });
  p.addEventListener("click", e => {
    if (e.target.closest("[data-mx]")) { p.remove(); return; }
    if (!e.target.closest("[data-ms]")) return;
    const m = String(mi.value || "").toUpperCase().replace(/\s+/g, " ").trim();
    if (m && !sviMaskSlots(m)) { svToast("MASQUE SANS 9 NI A : AUCUNE SAISIE POSSIBLE.", 3500, mi); return; }
    const L = sviMasks(), x = L.find(y => y.k === k); if (x) { x.m = m; x.ex = p.querySelector(".mkp-ex").checked; } else if (m) L.push({ k, lab: M.lab, m, ex: p.querySelector(".mkp-ex").checked });
    sviMasksSave(L);
    { const F = sviFlds(), lab = String(p.querySelector(".mkp-lab").value || "").replace(/\s+/g, " ").trim().toUpperCase(), tip = String(p.querySelector(".mkp-tip").value || "").replace(/\s+/g, " ").trim().toUpperCase();
      const o = { olab: M.lab, src, lab: lab && lab !== M.lab ? lab : "", tip, req: p.querySelector(".mkp-req").value, reqG: [...p.querySelectorAll(".mkp-rg:checked")].map(c => c.value).filter(v => v !== "occ"), reqT: [...p.querySelectorAll(".mkp-rt:checked")].map(c => c.value), prt: p.querySelector(".mkp-prt").checked };
      if (!p.querySelector(".mkp-adj").checked) o.adj = false;
      if (!o.lab && !o.tip && !o.req && !o.prt && o.adj !== false) delete F[k]; else F[k] = o; sviFldSave(F); }
    p.remove(); { const r = i.closest("#svConf, #docPop"); if (r) { const s = sviFldSpan(i); if (s && sviFlds()[k] === undefined && s.dataset.olab !== undefined) s.textContent = s.dataset.olab; sviFldApply(r); } }
    if (m) { i.dataset.mask = k; const f = sviMaskFmt(k, i.value); if (f !== i.value) i.value = f; } else if (k.startsWith("c:")) delete i.dataset.mask;
    svToast("RÉGLAGES DU CHAMP ENREGISTRÉS" + (m ? " — MASQUE " + m : "") + ".", 2500, i);
  });
}
{ let tm = 0, x0 = 0, y0 = 0;
  document.addEventListener("pointerdown", e => { const i = e.target; if (!sviMaskable(i) || e.button > 0) return; x0 = e.clientX; y0 = e.clientY; clearTimeout(tm);
    tm = setTimeout(() => { tm = 0; sviMaskWin(i); }, (window.SVI_G && SVI_G.lp) || 450); }, true);
  document.addEventListener("pointermove", e => { if (tm && Math.hypot(e.clientX - x0, e.clientY - y0) > ((window.SVI_G && SVI_G.drag) || 8)) { clearTimeout(tm); tm = 0; } }, true);
  ["pointerup", "pointercancel"].forEach(t => document.addEventListener(t, () => { clearTimeout(tm); tm = 0; }, true));
  document.addEventListener("contextmenu", e => { if (!sviMaskable(e.target)) return; e.preventDefault(); clearTimeout(tm); tm = 0; sviMaskWin(e.target); }, true); }
/* mise en forme pendant la frappe, pour tout champ marqué data-mask */
document.addEventListener("input", e => {
  const i = e.target;
  if (!i || !i.matches || !i.matches("input[data-mask]")) return;
  const f = sviMaskFmt(i.dataset.mask, i.value);
  if (f !== i.value) { i.value = f; try { i.setSelectionRange(f.length, f.length); } catch (x) {} }
}, true);
/* =========================================================
   v904 (principe du 03/11/2026 : une erreur est refusée DÈS LA SAISIE, pas seulement à l'enregistrement)
   Règles de case communes : à la sortie d'une case qui ne respecte pas sa règle, la case reprend sa valeur d'avant,
   avec la raison près d'elle. Une règle = [sélecteur, contrôle(valeur, case), message]. Les contrôles de l'enregistrement restent.
   ========================================================= */
const SVI_ENTRY_RULES = [
  /* masques de saisie (PARAMÉTRAGE › FORMAT › MASQUES DE SAISIE) : ils mettaient en forme, ils refusent aussi */
  ["input[data-mask]", (v, i) => sviMaskOk(i.dataset.mask, v), i => sviMaskLab(i.dataset.mask) + " NON VALIDE : MASQUE " + ((sviMaskOf(i.dataset.mask) || {}).m || "") + "."],
  /* planning : décalage d'une liaison, capacité, approvisionnement, rendement */
  [".lkw-o", v => /^\d*$/.test(v), () => "DÉCALAGE NON VALIDE : NOMBRE DE JOURS ≥ 0."],
  [".gc-cap", v => v === "" || /^\d+$/.test(v), () => "CAPACITÉ : NOMBRE ENTIER D'OUVRIERS (VIDE = SANS LIMITE)."],
  [".apr-dl", v => /^\d+$/.test(v), () => "DÉLAI D'APPROVISIONNEMENT : NOMBRE ENTIER DE JOURS."],
  [".apr-nj", v => v === "" || (/^\d+$/.test(v) && Number(v) >= 1), () => "NOMBRE DE JOURS : ENTIER, 1 AU MOINS."],
  [".rd-min", v => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 100, () => "RENDEMENT MIN : DE 1 À 100 %."],
  [".rd-max", v => /^\d+$/.test(v) && Number(v) >= 100 && Number(v) <= 300, () => "RENDEMENT MAX : DE 100 À 300 %."],
  /* v907 : ACHATS — besoin, consultation, devis, commande, réception, facture : quantités, prix, taux, péremption */
  ['.bsn-x[data-k="q"], .caf-l[data-c="q"], .dvf-l[data-c="q"], .cmf-l[data-c="q"], .fa-l[data-c="q"]', v => v === "" || sviEntryN(v) > 0, () => "QUANTITÉ : NOMBRE SUPÉRIEUR À 0."],
  ['.rcp-l[data-c="q"], .rcp-l[data-c="qbl"]', v => v === "" || sviEntryN(v) >= 0, () => "QUANTITÉ : NOMBRE POSITIF OU NUL."],
  ['.bsn-x[data-k="pu"], .dvf-l[data-c="pu"], .cmf-l[data-c="pu"], .fa-l[data-c="pu"]', v => v === "" || sviEntryN(v) >= 0, () => "PRIX : NOMBRE POSITIF OU NUL."],
  ['.dvf-x[data-k="remG"], .dvf-l[data-c="rem"], .cmf-x[data-k="rem"], .dvf-l[data-c="tva"], .cmf-l[data-c="tva"], .fa-l[data-c="tva"], .fa-x[data-k="rasT"]', v => v === "" || (sviEntryN(v) >= 0 && sviEntryN(v) <= 100), () => "TAUX : DE 0 À 100 %."],
  [".inf-gps", v => !v || !!sviGpsParse(v), () => "GPS DU CHANTIER : LATITUDE, LONGITUDE (EX. 33.5731, -7.5898)."],
  ['.rcp-l[data-c="per"]', v => !v || v >= new Date().toISOString().slice(0, 10), () => "DATE DE PÉREMPTION DÉJÀ PASSÉE."]
];
/* nombre saisi (virgule ou point, espaces) ; NaN si ce n'est pas un nombre */
const sviEntryN = v => { const s = String(v ?? "").replace(/[\s\u00a0\u202f]/g, "").replace(",", "."); return s === "" || !/^[-+]?\d*\.?\d*$/.test(s) ? NaN : Number(s); };
const sviEntryRule = el => SVI_ENTRY_RULES.find(r => el.matches && el.matches(r[0]));
document.addEventListener("focusin", e => { const i = e.target; if (i && i.tagName === "INPUT" && sviEntryRule(i)) i.dataset.prev = i.value; }, true);
document.addEventListener("change", e => {
  const i = e.target; if (!i || i.tagName !== "INPUT") return;
  const R = sviEntryRule(i); if (!R) return;
  const v = String(i.value ?? "").trim();
  if (R[1](v, i)) { i.dataset.prev = i.value; return; }
  e.stopImmediatePropagation();
  i.value = i.dataset.prev ?? "";
  if (typeof svToast === "function") svToast(R[2](i), 3500, i);
}, true);
/* C4 (série C, document unique 8.8) : TOUCHER UN CHAMP — 1er toucher = tout le contenu sélectionné (ce qu'on tape remplace l'ancien),
   2e toucher (champ déjà actif) = le curseur se place là où on a touché. Tous les champs de saisie hors tableaux (les cases gardent la 8.2) */
const SVI_SELALL_T = ["", "text", "tel", "search", "number", "email", "url"];
const sviSelAllOk = i => !!(i && i.matches && i.matches("input, textarea") && (i.tagName === "TEXTAREA" || SVI_SELALL_T.includes(String(i.getAttribute("type") || "").toLowerCase()))
  && !i.readOnly && !i.disabled && !i.closest("table") && !i.closest(".pg-cell, [data-cell]"));
{ let pend = null;
  document.addEventListener("pointerdown", e => { const i = e.target; pend = sviSelAllOk(i) && document.activeElement !== i ? i : null; }, true);
  document.addEventListener("click", e => { const i = e.target; if (!pend || i !== pend) { pend = null; return; } pend = null;
    if (document.activeElement !== i || !String(i.value || "")) return; try { i.select(); i.setSelectionRange(0, String(i.value).length); } catch (x) { try { i.select(); } catch (y) {} } }, true); }
/* ⟪ src/32-demarrage.js ⟫ */
/* =========================================================
   DEMARRAGE
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    initNav();

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

    /* v914 : BDS et CHS supprimés — plus de lecture de leurs données au démarrage */

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
  /* v750 : ACHAT se déplie / se replie sans fermer le menu ; une entrée pas encore faite (grisée) dit pourquoi */
  const grp = e.target.closest("#navMenu .nav-grp");
  if (grp) {
    const sub = menu.querySelector(`.nav-sub[data-grp="${grp.dataset.grp}"]`), open = !!sub && sub.hidden;
    if (sub) sub.hidden = !open;
    grp.setAttribute("aria-expanded", open ? "true" : "false");
    try { sessionStorage.setItem("svi_navgrp_" + grp.dataset.grp + "_v1", open ? "1" : ""); } catch (err) {}   /* v785 : gardé pendant la séance seulement */
    return;
  }
  const off = e.target.closest("#navMenu .nav-off");
  if (off) { svToast(off.dataset.why || "", 3000, off); return; }
  const opener = e.target.closest(".open-menu");
  if (opener) {
    const r = opener.getBoundingClientRect();
    menu.style.left = r.left + "px";
    menu.style.top = (r.bottom + 6) + "px";
    /* v752 : menu assez large pour cacher le premier tableau derrière lui (panneau des dates de la liste des budgets) */
    { const pn = document.getElementById("bdgDatePanel"), pr = pn && pn.offsetParent ? pn.getBoundingClientRect() : null;
      menu.style.width = Math.max(210, pr && pr.width ? Math.round(pr.right - r.left) + 2 : 0) + "px"; }
    menu.classList.toggle("hidden");
    /* groupe déplié la dernière fois (ou contenant le module ouvert) : déplié à l'ouverture du menu */
    menu.querySelectorAll(".nav-grp").forEach(g => { const sub = menu.querySelector(`.nav-sub[data-grp="${g.dataset.grp}"]`); if (!sub) return;
      /* v785 : au lancement de l'application, tout est plié (achats compris) ; pendant la séance, ce qui a été ouvert reste ouvert */
      let o = false; try { o = !!sessionStorage.getItem("svi_navgrp_" + g.dataset.grp + "_v1"); } catch (err) {}
      sub.hidden = !o; g.setAttribute("aria-expanded", o ? "true" : "false"); });
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



/* v916 (mission ALLÈGEMENT, étape 2) : le module ACHATS (app-achats.js) n'est plus chargé au démarrage —
   il se charge tout seul dès que l'écran est prêt (temps libre), et au plus tard au premier toucher d'une entrée ACHATS
   (le toucher est rejoué une fois le module chargé). Même numéro de version que app.js. */
let SVI_ACH_P = null;
const sviAchLoad = () => {
  if (typeof sviAchInit === "function") return Promise.resolve();
  if (SVI_ACH_P) return SVI_ACH_P;
  const me = [...document.scripts].find(s => /\/app\.js(\?|$)/.test(s.src));
  const q = me && me.src.includes("?") ? me.src.slice(me.src.indexOf("?")) : "";
  SVI_ACH_P = new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = "app-achats.js" + q; s.async = false;
    s.onload = () => setTimeout(ok, 0);   /* après le démarrage du module (41 : setTimeout) */ s.onerror = () => { SVI_ACH_P = null; s.remove(); ko(new Error("ACHATS")); };
    document.head.appendChild(s);
  });
  return SVI_ACH_P;
};
window.sviAchLoad = sviAchLoad;
document.addEventListener("click", e => {
  if (typeof sviAchInit === "function") return;
  const b = e.target && e.target.closest && e.target.closest('[data-ach], .nav-btn[data-view="ach"]');
  if (!b) return;
  e.preventDefault(); e.stopImmediatePropagation();
  sviAchLoad().then(() => b.click()).catch(() => { try { svToast("ACHATS : CHARGEMENT IMPOSSIBLE — VÉRIFIER LA CONNEXION ET RÉESSAYER.", 4000); } catch (er) {} });
}, true);
{ const go = () => { try { sviAchLoad().catch(() => {}); } catch (e) {} };
  const idle = () => (window.requestIdleCallback ? requestIdleCallback(go, { timeout: 1500 }) : setTimeout(go, 300));
  if (document.readyState === "complete") idle(); else window.addEventListener("load", idle); }

/* v927 (remarque 13 du 04/11/2026) : ÉCRAN D'ACCUEIL — nom de l'utilisateur, menu ☰, ⋯ = RÉGLAGES COMMUNS (tout le programme) */
const sviHomeDraw = () => { const u = document.getElementById("homeUser"); if (u) { let n = ""; try { n = sviUser(); } catch (e) {} u.textContent = n ? "UTILISATEUR : " + n : ""; }
  const b = document.getElementById("homeBody"); if (b && !b.childElementCount) b.innerHTML = `<div class="home-note">MENU ☰ : BUDGET, ACHATS, PARAMÉTRAGE, DONNÉES SOURCES. ⋯ : RÉGLAGES COMMUNS DU FORMAT (TOUT LE PROGRAMME).</div>`; };
document.addEventListener("click", e => {
  const m = e.target.closest && e.target.closest("#homeMore"); if (!m) return; e.stopPropagation();
  sviHdrMenu(m, [[{ k: "__fmtall", lab: "RÉGLAGES COMMUNS (FORMAT DE TOUT LE PROGRAMME)", ic: SVI_MI.__fmt }]], a => { if (a === "__fmtall") sviFmtWin(null); });
}, true);
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(sviHomeDraw, 50)); else setTimeout(sviHomeDraw, 50);
document.addEventListener("click", e => { if (e.target.closest && e.target.closest('.nav-btn[data-view="home"]')) setTimeout(sviHomeDraw, 0); });
/* ⟪ src/33-confirmations-sources.js ⟫ */
/* =========================================================
   CONFIRMATION AU FORMAT DE L'APPLICATION (jamais de message Safari)
   svConfirm({ title, text, ok }) → Promise<boolean>
   ========================================================= */
/* message d'erreur passager : affiché au moment de l'erreur, puis il s'efface (règle générale) */
/* il s'affiche PRÈS DE LA SOURCE de l'erreur (la case ou la ligne touchée) : juste dessous,
   sans la cacher ; au-dessus s'il n'y a pas la place ; jamais loin (règle générale) */
let svLastTouch = null;
document.addEventListener("pointerdown", e => { svLastTouch = e.target; }, true);
document.addEventListener("focusin", e => { svLastTouch = e.target; }, true);
function svToast(msg, ms = 3500, anchor) {
  let t = document.getElementById("svToast");
  if (!t) { t = document.createElement("div"); t.id = "svToast"; document.body.appendChild(t); }
  /* FORMAT 1 : un ✕ à droite ferme le message tout de suite */
  t.innerHTML = `<span class="svt-m"></span><button type="button" class="svt-x" aria-label="Fermer">✕</button>`;
  t.querySelector(".svt-m").textContent = String(msg || "").toUpperCase();
  t.querySelector(".svt-x").addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); clearTimeout(t.__tm); t.classList.remove("on"); });
  t.querySelector(".svt-x").addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); });
  let a = anchor || svLastTouch;
  if (a && !a.isConnected) a = null;
  /* la source : la case, sinon la ligne touchée */
  const src = a && (a.closest("td, .ins-li, .lk-li, button, [data-iid]") || a);
  const r = src && src.getBoundingClientRect();
  t.style.left = t.style.top = t.style.right = "";
  if (r && (r.width || r.height)) {
    t.style.right = "auto";
    t.style.visibility = "hidden";
    t.classList.add("on");
    const w = t.offsetWidth, h = t.offsetHeight, vw = window.innerWidth, vh = sviViewH();
    const left = Math.max(8, Math.min(r.left, vw - w - 8));
    const top = r.bottom + 6 + h <= vh - 8 ? r.bottom + 6 : Math.max(8, r.top - h - 6);
    t.style.left = left + "px";
    t.style.top = top + "px";
    t.style.visibility = "";
  }
  t.classList.add("on");
  clearTimeout(t.__tm);
  t.__tm = setTimeout(() => t.classList.remove("on"), ms);
}
/* =========================================================
   REFONTE, ÉTAPE 4 (v643) : MODÈLE UNIQUE DE FENÊTRE — toutes les fenêtres de l'application (#svConf) naissent ici :
   une seule ouverte à la fois, listes qui défilent au-delà de la moitié de l'écran (FORMAT 31), Échap = ✕ (FORMAT 30).
   sviWinNew() → la fenêtre (vide) ; sviWinShow(d) → affichée ; sviWinCard({ title, body, foot, cls, close }) → son contenu standard.
   ========================================================= */
function sviWinNew() {
  document.getElementById("svConf")?.remove();
  const d = document.createElement("div");
  d.id = "svConf";
  return d;
}
function sviWinShow(d) {
  document.body.appendChild(d);
  svShortLists(d);
  return d;
}
function sviWinCard({ title = "", body = "", foot = "", cls = "", close = 'data-r="0"' } = {}) {
  return `<div class="svc-card${cls ? " " + cls : ""}" role="dialog" aria-modal="true">
      ${close ? `<button type="button" class="svc-close" ${close} aria-label="Fermer">✕</button>` : ""}
      <div class="svc-t">${title}</div>${body}
      ${foot ? `<div class="svc-f">${foot}</div>` : ""}
    </div>`;
}
/* fenêtres au format INF (#docPop) : même principe */
function sviPopNew() {
  document.getElementById("docPop")?.remove();
  const p = document.createElement("div");
  p.id = "docPop";
  return p;
}
function sviPopShow(p) {
  document.body.appendChild(p);
  svShortLists(p);
  return p;
}
/* Échap : ferme la fenêtre ouverte comme son ✕ (sauf pendant une saisie, où Échap annule la case) */
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  const d = document.getElementById("svConf") || document.getElementById("docPop"); if (!d) return;
  const a = document.activeElement;
  if (a && d.contains(a) && a.matches && a.matches("input, textarea, select")) return;
  const x = d.querySelector(".svc-close, .doc-x, [data-x], [data-cancel]");
  if (x) { e.preventDefault(); x.click(); }
});
/* IMPORT IMPOSSIBLE (FORMAT 62) : fenêtre qui reste ouverte, avec le fichier, la raison de chaque essai
   (en clair + détail technique), le contenu trouvé et que faire ; jamais un message passager */
function svImportReason(m) {
  const t = String((m && m.message) || m || "").trim();
  const U = t.toUpperCase();
  if (!t) return "LECTURE REFUSÉE (RAISON NON DONNÉE)";
  /* erreur de CONTENU (la feuille a été lue) : affichée telle quelle */
  if (/COLONNE|AUCUNE LIGNE|EN-TÊTE|ONGLET/.test(U)) return U;
  if (/NOUVELLE VERSION À DÉPLOYER|UNKNOWN ACTION|ACTION INCONNUE/.test(U)) return "LE SCRIPT GOOGLE NE SAIT PAS ENCORE LIRE UNE FEUILLE (NOUVELLE VERSION DU SCRIPT À DÉPLOYER)";
  if (/PERMISSION|ACCESS|ACCÈS|DENIED|REFUS|AUTORIS|\b403\b|\b401\b/.test(U)) return "ACCÈS REFUSÉ À LA FEUILLE (VOTRE COMPTE N'Y A PAS ACCÈS, OU ELLE N'EST PAS PARTAGÉE)";
  if (/NOT FOUND|FEUILLE INTROUVABLE|FICHIER INTROUVABLE|\b404\b|DOES NOT EXIST|N'EXISTE PAS/.test(U)) return "FEUILLE INTROUVABLE (LIEN INCORRECT OU FEUILLE SUPPRIMÉE)";
  if (/FAILED TO FETCH|LOAD FAILED|NETWORK|RÉSEAU|TIMEOUT/.test(U)) return "PAS DE CONNEXION INTERNET OU SERVICE GOOGLE INJOIGNABLE";
  if (/NON JSON/.test(U)) return "LE SCRIPT GOOGLE A RÉPONDU PAR UNE PAGE D'ERREUR";
  if (/BIBLIOTH|EXCEL INDISPONIBLE/.test(U)) return "LA LECTURE DES FICHIERS EXCEL N'A PAS PU ÊTRE CHARGÉE (CONNEXION INTERNET ?)";
  return U;
}
function svImportFail({ source = "", tries = [], found = null, hint = "" } = {}) {
  const d = sviWinNew();
  const row = (lab, html) => `<div class="svc-sub">${esc(lab)}</div><div class="svc-x imp-fail-v">${html}</div>`;
  d.innerHTML = `<div class="svc-card imp-fail" role="dialog" aria-modal="true">
      <button type="button" class="svc-close" data-r="0" aria-label="Fermer">✕</button>
      <div class="svc-t">IMPORT IMPOSSIBLE</div>
      ${source ? row("FICHIER", esc(/https?:\/\//i.test(source) ? String(source) : String(source).toUpperCase())) : ""}
      ${tries.length ? row("RAISON", `<ul class="svc-list">${tries.map(x => `<li>${x.via ? "<b>" + esc(x.via) + " :</b> " : ""}${esc(svImportReason(x.err))}${
        String((x.err && x.err.message) || x.err || "").trim() && svImportReason(x.err) !== String((x.err && x.err.message) || x.err).toUpperCase()
          ? `<div class="imp-fail-d">${esc(String((x.err && x.err.message) || x.err))}</div>` : ""}</li>`).join("")}</ul>`) : ""}
      ${found && found.length ? row("COLONNES TROUVÉES", esc(found.filter(v => String(v ?? "").trim()).map(v => String(v).toUpperCase()).join(" · ") || "AUCUNE")) : ""}
      ${hint ? row("QUE FAIRE", esc(String(hint).toUpperCase())) : ""}
      <div class="svc-f"><button type="button" class="svc-b svc-ok svc-neutral" data-r="0">FERMER</button></div>
    </div>`;
  sviWinShow(d);
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-r]")) d.remove(); });
}
/* couleur d'état reportée sur toute la page (cases, fenêtres) : rouge en instance, vert figé, noir sinon */
const SVI_ST_WATCH = new WeakSet();
/* 06/11 (décision) : une fenêtre prend la couleur de l'état de SA pièce — celle de la fiche ouverte, sinon celle de la ligne touchée dans la liste
   (CRÉER … ICI = en instance) */
let sviRowSt = "";
document.addEventListener("pointerdown", e => { const r = e.target.closest && e.target.closest("tr[data-st]"); if (r && r.closest(".novapp-list-shell")) { sviRowSt = r.dataset.st || ""; sviSyncState(); } }, true);
function sviSyncState() {
  const sh = [...document.querySelectorAll(".novapp-list-shell")].find(x => x.offsetParent !== null) || document.querySelector(".novapp-list-shell");
  let st = "";
  const pg = [...document.querySelectorAll(".nvp[data-st]")].find(x => x.offsetParent !== null);
  if (pg) st = pg.dataset.st;
  else if (sh) st = sh.classList.contains("bdg-inst-fige") ? "fige" : sh.classList.contains("bdg-inst-instance") ? "instance" : sviRowSt;
  if (document.documentElement.dataset.svst !== st) document.documentElement.dataset.svst = st;
}
function sviWatchState(shell) {
  if (shell && !SVI_ST_WATCH.has(shell)) { SVI_ST_WATCH.add(shell); new MutationObserver(sviSyncState).observe(shell, { attributes: true, attributeFilter: ["class"] }); }
  sviSyncState();
}
/* message au format de l'application (jamais de fenêtre Safari) : titre, texte, FERMER */
/* menus ⋯ (FORMAT 107) : sous le bouton s'il y a la place, sinon au-dessus ; sinon hauteur disponible avec défilement */
/* v453 (FORMAT 28) : hauteur réellement visible — sur iPad, window.innerHeight peut compter la zone cachée par la barre de Safari */
function sviViewH() {
  const v = window.visualViewport, de = document.documentElement;
  return Math.min(window.innerHeight, de && de.clientHeight ? de.clientHeight : window.innerHeight, v ? v.height + (v.offsetTop || 0) : window.innerHeight);
}
function sviPlaceMenu(m, r) {
  const vh = sviViewH(), M = 24;
  m.style.maxHeight = ""; m.style.top = "0px";
  m.classList.remove("sv-2col");
  let h = m.offsetHeight;
  const below = vh - r.bottom - 4 - M, above = r.top - 4 - M, full = vh - 2 * M;
  /* v459 : le menu est TOUJOURS vu en entier — sous le bouton, sinon au-dessus, sinon sur toute la hauteur
     (il recouvre alors le bouton), sinon sur deux colonnes ; défilement interne en tout dernier recours */
  if (h > below && h > above && h > full && m.id === "blkMenu") { m.classList.add("sv-2col"); h = m.offsetHeight; }
  if (h <= below) m.style.top = r.bottom + 4 + "px";
  else if (h <= above) m.style.top = r.top - 4 - h + "px";
  else if (h <= full) m.style.top = Math.max(M, Math.min(r.bottom + 4, vh - M - h)) + "px";
  else { m.style.top = M + "px"; m.style.maxHeight = full + "px"; }
  m.style.left = Math.max(M, Math.min(window.innerWidth - m.offsetWidth - M, r.right - m.offsetWidth)) + "px";
  /* garde finale : le menu ne dépasse jamais le bas de la partie visible (défilement interne) */
  const b = m.getBoundingClientRect();
  if (b.bottom > vh - M) m.style.maxHeight = Math.max(120, vh - M - b.top) + "px";
  /* v456 : menu plus long que la place : il défile à l'intérieur, une flèche ▼ en bas le signale (disparaît en bas de la liste) */
  const more = m.scrollHeight > m.clientHeight + 2;
  m.classList.toggle("sv-more", more && m.scrollTop + m.clientHeight < m.scrollHeight - 2);
  if (!m.__svMoreB) { m.__svMoreB = true; m.addEventListener("scroll", () => m.classList.toggle("sv-more", m.scrollTop + m.clientHeight < m.scrollHeight - 2), { passive: true }); }
  /* mise en page tardive (polices, iPad) : replacé une fois affiché, et si la zone visible change */
  if (!m.__svPlaced) {
    m.__svPlaced = true;
    const again = () => { if (m.isConnected) sviPlaceMenu(m, r); };
    requestAnimationFrame(again); setTimeout(again, 150);
    const vv = window.visualViewport;
    if (vv) { const f = () => { if (!m.isConnected) { vv.removeEventListener("resize", f); vv.removeEventListener("scroll", f); return; } again(); }; vv.addEventListener("resize", f); vv.addEventListener("scroll", f); }
  }
}
function sviAlert(msg, title = "INFORMATION") {
  if (window.__sviQuiet) return;   /* contrôle silencieux (état du bouton APERÇU PDF) */
  const d = sviWinNew();
  d.innerHTML = sviWinCard({ title: esc(String(title).toUpperCase()), body: `<div class="svc-x" style="white-space:pre-line">${esc(String(msg ?? "").toUpperCase())}</div>`,
    foot: `<button type="button" class="svc-b svc-ok svc-neutral" data-r="0">FERMER</button>` });
  sviWinShow(d);
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-r]")) d.remove(); });
}
/* fenêtre de choix de l'application : ANNULER + boutons [{ v, label, tone }] ; résout la valeur choisie ou null */
function svChoose({ title = "", text = "", html = "", buttons = [], noCancel = false } = {}) {
  return new Promise(res => {
    const d = sviWinNew();
    d.innerHTML = sviWinCard({ title: esc(title), close: 'data-v=""',
      body: (text ? `<div class="svc-x">${esc(text)}</div>` : "") + (html ? `<div class="svc-x svc-html">${html}</div>` : ""),
      foot: (noCancel ? "" : '<button type="button" class="svc-b" data-v="">ANNULER</button>')
        + buttons.map(b => `<button type="button" class="svc-b svc-ok${b.tone === "danger" ? "" : " svc-neutral"}" data-v="${esc(b.v)}"${b.disabled ? " disabled" : ""}>${esc(b.label)}</button>`).join("") });
    sviWinShow(d);
    d.addEventListener("click", e => {
      const b = e.target.closest("[data-v]");
      if (!b && e.target !== d) return;
      if (b && b.disabled) return;
      d.remove();
      res(b && b.dataset.v ? b.dataset.v : null);
    });
  });
}
/* v490 (remarque 3, remplace la règle des 5 lignes) : une liste de fenêtre est toujours affichée ;
   elle occupe au plus la moitié de l'écran, puis défile (classe svc-scroll) */
function svShortLists(d) {
  d.querySelectorAll(".svc-list").forEach(ul => ul.classList.add("svc-scroll"));
}
function svConfirm({ title = "CONFIRMER", text = "", html = "", ok = "OK", tone = "danger" } = {}) {
  return new Promise(res => {
    const d = sviWinNew();
    d.innerHTML = sviWinCard({ title: esc(title),
      body: (text ? `<div class="svc-x">${esc(text)}</div>` : "") + (html ? `<div class="svc-x svc-html">${html}</div>` : ""),
      foot: `<button type="button" class="svc-b" data-r="0">ANNULER</button><button type="button" class="svc-b svc-ok${tone === "danger" ? "" : " svc-neutral"}" data-r="1">${esc(ok)}</button>` });
    sviWinShow(d);
    d.addEventListener("click", e => {
      const b = e.target.closest("[data-r]");
      if (!b && e.target !== d) return;
      d.remove();
      res(!!b && b.dataset.r === "1");
    });
  });
}

/* message d'information dans une fenêtre de l'application (remplace l'alerte Safari) */
function svAlert(msg) {
  const lines = String(msg ?? "").toUpperCase().split("\n").map(x => x.trim()).filter(Boolean);
  const d = sviWinNew();
  d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true">
      <div class="svc-t">${esc(lines.length > 1 ? lines[0] : "INFORMATION")}</div>
      <div class="svc-x">${esc((lines.length > 1 ? lines.slice(1) : lines).join("\n"))}</div>
      <div class="svc-f"><button type="button" class="svc-b svc-ok svc-neutral" data-r="1">OK</button></div>
    </div>`;
  sviWinShow(d);
  d.addEventListener("click", e => { if (e.target.closest("[data-r]") || e.target === d) d.remove(); });
}
try { window.alert = svAlert; } catch (e) {}

/* =========================================================
   MENU ☰ › DONNÉES SOURCE : fichiers Google Sheets lus par l'application
   - toucher le nom : ouvre le fichier ;
   - appui long : coller le lien d'un autre fichier,
     puis ENREGISTRER (le script vérifie que le fichier s'ouvre).
   ========================================================= */
const SVI_SRC_FILES = {
  main: { name: "SVI 26-0826/001", url: "https://docs.google.com/spreadsheets/d/1-gZdPMT3V6zLMuS5b8nylgqvSB1zrAukJfZ0o4ht1YE/edit" },
  v3: { name: "SVI ERP — BASE BUDGETS V3", url: "https://docs.google.com/spreadsheets/d/131RdvI2_kqjRq7HbcPxXetWHmBcYJ3DNmGPiuogAoas/edit" }
};
/* appel du script : d'abord par GET (paramètres gardés si Google redirige), sinon POST */
async function apiSrc(action, params = {}) {
  try {
    const d = await apiGet(action, params);
    if (d && d.ok && (d.main || d.budgets || d.v3)) return d;
  } catch (e) {}
  return apiPost(action, params);
}
function openSourceWin() {
  document.getElementById("srcPop")?.remove();
  const test = !!document.getElementById("sviTestTag");
  /* fichier modifiable ici : base V3 (version test), fichier principal (version validée) */
  const EDIT = test ? "v3" : "main";
  const files = { main: { ...SVI_SRC_FILES.main }, v3: { ...SVI_SRC_FILES.v3 } };
  const tag = (document.getElementById("sviTestTag")?.textContent || "").replace(/^VERSION TEST — /, "");
  const v3ok = window.SVI_SRC === "V3" || !/ANCIEN BDG/.test(tag);
  const field = (which, note) => `
    <div class="src-fld${which === EDIT ? " src-edit-ok" : ""}" data-which="${which}">
      <input class="src-in" data-keepcase readonly value="${esc(files[which].name)}"
        placeholder="COLLER LE LIEN DE LA FEUILLE GOOGLE">
    </div><span class="src-note" data-note="${which}">${note}</span>`;
  const row = (lab, val) => `<div class="src-lab">${lab}</div><div class="src-val">${val}</div>`;
  const render = () => {
    let rows = row("VERSION", test ? "TEST" : "VALIDÉE");
    if (test) {
      rows +=
        row("BUDGETS (BDG)", v3ok
          ? field("v3", "ONGLETS BUDGETS, DESIGNATIONS, TACHES, DETAILS, ARRETS" + (files.v3.folder ? " — DOSSIER " + esc(files.v3.folder) : ""))
          : field("main", "ONGLET BDG — BASE V3 NON LUE : " + esc(tag))) +
        (v3ok ? "" : row("BASE V3", field("v3", "NON LUE : " + esc(tag)))) +
        row("BDS", field("main", "ONGLETS BDS_V2, BRD_V2 — MODIFIABLE DEPUIS LA VERSION VALIDÉE")) +
        row("BUDGETS EN INSTANCE", "SUR CET APPAREIL SEULEMENT<span class=\"src-note\">PAS ENCORE ENREGISTRÉS DANS GOOGLE SHEETS</span>");
    } else {
      rows +=
        row("BDG, BDS", field("main", "ONGLETS BDG, BDS_V2, BRD_V2" + (files.main.folder ? " — DOSSIER " + esc(files.main.folder) : "")));
    }
    p.querySelector(".src-grid").innerHTML = rows;
  };
  const p = document.createElement("div");
  p.id = "srcPop";
  p.innerHTML = `
    <div class="src-card" role="dialog" aria-modal="true">
      <div class="src-head">
        <span class="src-title">DONNÉES SOURCE</span>
        <button type="button" class="src-x" data-close aria-label="Fermer">✕</button>
      </div>
      <div class="src-body"><div class="src-grid"></div><div class="src-msg"></div></div>
      <div class="src-foot">
        <button type="button" class="src-btn" data-close>FERMER</button>
        <button type="button" class="src-btn" data-cancel hidden>ANNULER</button>
        <button type="button" class="src-btn src-save" data-save hidden>ENREGISTRER</button>
      </div>
    </div>`;
  document.body.appendChild(p);
  render();
  const msg = (t, err) => { const m = p.querySelector(".src-msg"); m.textContent = t || ""; m.classList.toggle("err", !!err); };
  /* noms réels des fichiers, lus par le script */
  apiSrc("srcGet").then(d => {
    ["main", "v3"].forEach(k => { if (d[k] && d[k].id) files[k] = { ...files[k], ...d[k], name: d[k].name || files[k].name }; });
    if (!editing) render();
  }).catch(() => {});
  let editing = null;
  const setMode = which => {
    editing = which;
    p.querySelector("[data-close].src-btn").hidden = !!which;
    p.querySelector("[data-cancel]").hidden = !which;
    p.querySelector("[data-save]").hidden = !which;
    p.querySelectorAll(".src-fld").forEach(f => f.classList.toggle("editing", f.dataset.which === which && !!which));
    p.querySelectorAll(".src-in").forEach(i => {
      const on = which && i.closest(".src-fld").dataset.which === which;
      i.readOnly = !on;
      if (!on) i.value = files[i.closest(".src-fld").dataset.which].name;
    });
    if (which) {
      const i = p.querySelector(`.src-fld[data-which="${which}"] .src-in`);
      i.value = "";
      i.focus();
    }
  };
  /* appui long : modifier ; toucher simple : ouvrir */
  let lpTimer = null, lpDone = false;
  p.addEventListener("pointerdown", e => {
    const f = e.target.closest(".src-fld.src-edit-ok");
    if (!f || editing) return;
    lpDone = false;
    lpTimer = setTimeout(() => { lpDone = true; msg(""); setMode(f.dataset.which); }, SVI_G.lp);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(t => p.addEventListener(t, () => clearTimeout(lpTimer)));
  p.addEventListener("contextmenu", e => { if (e.target.closest(".src-fld")) e.preventDefault(); });
  p.addEventListener("click", async e => {
    if (e.target === p || e.target.closest("[data-close]")) { p.remove(); return; }
    if (e.target.closest("[data-cancel]")) { msg(""); setMode(null); return; }
    const f = e.target.closest(".src-fld");
    if (f && !(editing && f.dataset.which === editing)) {
      if (lpDone) { lpDone = false; return; }
      e.preventDefault();
      openGoogleLink(files[f.dataset.which].url);
      return;
    }
    const sv = e.target.closest("[data-save]");
    if (!sv || !editing) return;
    const link = p.querySelector(`.src-fld[data-which="${editing}"] .src-in`).value.trim();
    if (!/\/d\/[A-Za-z0-9_-]{20,}|^[A-Za-z0-9_-]{20,}$/.test(link)) { msg("LIEN GOOGLE SHEETS NON RECONNU.", true); return; }
    const lab = editing === "v3" ? "LA BASE DES BUDGETS (V3)" : "LE FICHIER PRINCIPAL (BDS, BDG)";
    if (!await svConfirm({ title: "CHANGER LE FICHIER SOURCE", text: "L'APPLICATION LIRA DÉSORMAIS " + lab + " DANS CE FICHIER.", ok: "CHANGER", tone: "neutral" })) return;
    sv.disabled = true;
    msg("VÉRIFICATION DU FICHIER…");
    try {
      const d = await apiSrc("srcSet", { which: editing, link });
      ["main", "v3"].forEach(k => { if (d[k] && d[k].id) files[k] = { ...files[k], ...d[k], name: d[k].name || files[k].name }; });
      setMode(null);
      render();
      msg("ACTUALISATION DES DONNÉES…");
      setTimeout(() => location.reload(), 1200);
    } catch (err) {
      msg("CHANGEMENT IMPOSSIBLE : " + (err && err.message || err), true);
    }
    sv.disabled = false;
  });
  p.addEventListener("keydown", e => {
    if (e.key === "Enter" && editing) { e.preventDefault(); p.querySelector("[data-save]").click(); }
  });
}
document.addEventListener("click", e => {
  if (!e.target.closest("#navSrcBtn")) return;
  document.getElementById("navMenu")?.classList.add("hidden");
  openSourceWin();
});



/* v658 (FORMAT 249) : intitulés d'en-tête raccourcis selon la place (ACTIVITÉ SECONDAIRE → ACT. SECONDAIRE → ACT SCD) ;
   le premier qui tient en entier est gardé ; recalculé à chaque dessin et au changement de taille */
const SVI_HD_FIT = new Map();
const SVI_HD_ALT = { "ACTIVITÉ SECONDAIRE": ["ACT. SECONDAIRE", "ACT SCD"], "ACTIVITÉ PRIMAIRE": ["ACT. PRIMAIRE", "ACT PRM"] };
(() => {
  let raf = 0, busy = false;
  const fit = () => { raf = 0; busy = true;
    try { document.querySelectorAll(".cf-tt[data-alt]").forEach(el => {
      let L = []; try { L = JSON.parse(el.dataset.alt); } catch (e) {}
      if (!L.length || !el.offsetParent) return;
      /* v745 (rapidité) : choix déjà trouvé pour ces intitulés et cette largeur = repris sans essayer chaque intitulé */
      const ck = el.dataset.alt + "@" + el.clientWidth + "@" + getComputedStyle(el).fontSize, known = SVI_HD_FIT.get(ck);
      if (known !== undefined) { if (el.textContent !== known) el.textContent = known; return; }
      let pick = L[L.length - 1];
      for (const t of L) { if (el.textContent !== t) el.textContent = t; if (el.scrollWidth <= el.clientWidth + 1) { pick = t; break; } }
      if (el.textContent !== pick) el.textContent = pick;
      if (SVI_HD_FIT.size > 200) SVI_HD_FIT.clear(); SVI_HD_FIT.set(ck, pick);
    }); } catch (e) {}
    setTimeout(() => { busy = false; }, 0); };
  const ask = () => { if (!busy && !raf) raf = requestAnimationFrame(fit); };
  const start = () => { try { new MutationObserver(ask).observe(document.body, { childList: true, subtree: true }); } catch (e) {} addEventListener("resize", ask); ask(); };
  if (document.body) start(); else addEventListener("DOMContentLoaded", start);
})();
/* ⟪ src/34-parametrage.js ⟫ */
/* =========================================================
   PARAMÉTRAGE : CHS + UNITÉS (12/10/2026)
   UNITÉS : intitulé et abréviation ; l'abréviation est celle utilisée dans les tableaux.
   Toutes les unités restent permises ; la liste sert de choix proposé à la saisie.
   Gardée sur l'appareil en attendant l'onglet UNITÉS de la base Google.
   ========================================================= */
const SVI_UNITS_KEY = "svi_units_v1";
const SVI_UNITS_DEF = [["UNITÉ", "U"], ["FORFAIT", "F"], ["MÈTRE", "M"], ["MÈTRE LINÉAIRE", "ML"], ["MÈTRE CARRÉ", "M2"],
  ["MÈTRE CUBE", "M3"], ["TONNE", "T"], ["KILOGRAMME", "KG"], ["LITRE", "L"], ["ENSEMBLE", "ENS"]].map(([n, a]) => ({ n, a }));
function sviUnits() {
  try { const v = JSON.parse(localStorage.getItem(SVI_UNITS_KEY) || "null"); if (Array.isArray(v)) return v; } catch (e) {}
  return SVI_UNITS_DEF.map(x => ({ ...x }));
}
function sviUnitsSave(list) {
  try { localStorage.setItem(SVI_UNITS_KEY, JSON.stringify(list)); } catch (e) {}
}
/* liste proposée dans les cases d'unité (UPB, UNITÉ) */
/* proposition d'unités au format de l'application (plus de bulle Safari) : après la 1re lettre tapée,
   6 unités au plus qui commencent par la saisie ; un toucher choisit ; continuer à taper la fait suivre */
const SVI_UNIT_SEL = 'input.ins-in[data-f="u"], input.inc-in[data-f="u"], input.inc-in[data-f="upb"]';
function sviUnitSugHide() { document.getElementById("svUnitSug")?.remove(); }
document.addEventListener("input", e => {
  const i = e.target.closest && e.target.closest(SVI_UNIT_SEL);
  if (!i) return;
  const q = String(i.value || "").trim().toUpperCase();
  if (!q) { sviUnitSugHide(); return; }
  const L = sviUnits().filter(x => x.a && (x.a.startsWith(q) || String(x.n || "").startsWith(q)) && x.a !== q).slice(0, 6);
  if (!L.length) { sviUnitSugHide(); return; }
  let b = document.getElementById("svUnitSug");
  if (!b) { b = document.createElement("div"); b.id = "svUnitSug"; document.body.appendChild(b); }
  b.__for = i;
  b.innerHTML = L.map(x => `<button type="button" data-u="${esc(x.a)}"><b>${esc(x.a)}</b><span>${esc(x.n)}</span></button>`).join("");
  const r = i.getBoundingClientRect();
  b.style.left = Math.max(8, Math.min(r.left, window.innerWidth - b.offsetWidth - 8)) + "px";
  b.style.top = (r.bottom + 4 + b.offsetHeight <= sviViewH() - 8 ? r.bottom + 4 : Math.max(8, r.top - b.offsetHeight - 4)) + "px";
});
document.addEventListener("pointerdown", e => {
  const b = document.getElementById("svUnitSug");
  if (!b) return;
  const u = e.target.closest && e.target.closest("#svUnitSug [data-u]");
  if (!u) { if (!b.contains(e.target)) sviUnitSugHide(); return; }
  e.preventDefault();
  const i = b.__for;
  sviUnitSugHide();
  if (!i || !i.isConnected) return;
  i.value = u.dataset.u;
  i.dispatchEvent(new Event("input", { bubbles: true }));
  sviUnitSugHide();
  i.dispatchEvent(new Event("change", { bubbles: true }));
}, true);
document.addEventListener("focusout", e => { if (e.target.closest && e.target.closest(SVI_UNIT_SEL)) setTimeout(() => { const b = document.getElementById("svUnitSug"); if (b && b.__for === e.target && document.activeElement !== e.target) sviUnitSugHide(); }, 150); });
/* v491 (remarque 5) : listes de choix comme dans les tableurs — flèches haut / bas = proposition suivante / précédente ;
   Entrée ou Tab = la proposition en surbrillance, ou la seule proposée, puis la case suivante ; Échap = fermer */
document.addEventListener("keydown", e => {
  const b = document.querySelector("#svUnitSug, .sd-sug");
  if (!b || b.__for !== e.target) { if (e.key === "Enter" || e.key === "Escape") sviUnitSugHide(); return; }
  const B = [...b.querySelectorAll("button")];
  let k = B.findIndex(x => x.classList.contains("on"));
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault(); e.stopPropagation();
    k = e.key === "ArrowDown" ? Math.min(B.length - 1, k + 1) : Math.max(0, k < 0 ? 0 : k - 1);
    B.forEach((x, n) => x.classList.toggle("on", n === k));
    B[k] && B[k].scrollIntoView({ block: "nearest" });
    return;
  }
  if (e.key === "Escape") { e.preventDefault(); b.remove(); return; }
  if (e.key !== "Enter" && e.key !== "Tab") return;
  const pick = k >= 0 ? B[k] : B.length === 1 ? B[0] : null;
  const i = b.__for;
  b.remove();
  if (!pick || !i) return;
  i.value = pick.dataset.u || pick.dataset.v || "";
  i.dispatchEvent(new Event("input", { bubbles: true }));
  document.querySelector("#svUnitSug, .sd-sug")?.remove();
  i.dispatchEvent(new Event("change", { bubbles: true }));
  /* Tab : la touche continue (case à droite) ; Entrée : choisie puis case suivante, à droite (pas la ligne du dessous) */
  if (e.key === "Enter") {
    e.preventDefault(); e.stopPropagation();
    const tr = i.closest("tr, .ins-li");
    const ok = x => x.offsetParent !== null && !x.disabled && !x.readOnly && !x.matches('[type="checkbox"], [type="radio"], [type="hidden"]');
    const L = tr ? [...tr.querySelectorAll("input, select, textarea")].filter(x => x === i || ok(x)) : [];
    const nx = L[L.indexOf(i) + 1];
    if (nx) { nx.focus(); try { nx.select(); } catch (err) {} }
  }
}, true);
/* FORMAT 129 : case « tout cocher » à trois états — vide / à moitié (une partie cochée) / cochée (toutes) */
(() => {
  let raf = 0;
  const run = () => {
    raf = 0;
    document.querySelectorAll("input.ins-gcb, input.mg-gcb, input.ins-tcb[data-part]").forEach(c => { const p = c.dataset.part === "1"; if (c.indeterminate !== p) c.indeterminate = p; });   /* v499 (remarque 45) */
    document.querySelectorAll('input[type="checkbox"][class$="-cball"]').forEach(hd => {
      const box = hd.closest("table, .ins-hcol");
      if (!box) return;
      const rows = [...box.querySelectorAll('input[type="checkbox"]')].filter(c => c !== hd && !c.closest("thead, .bdg-h-head") && !c.classList.contains("ins-tcb") && !/-cball$/.test(c.className));
      const n = rows.filter(c => c.checked).length;
      const all = rows.length > 0 && n === rows.length, part = n > 0 && n < rows.length;
      if (hd.checked !== all) hd.checked = all;
      if (hd.indeterminate !== part) hd.indeterminate = part;
      /* v499 (remarque 41) : en-tête de la colonne des cases en bleu dès qu'une case est cochée */
      const hc = hd.closest("th, .ins-hdel, .bdg-h-head");
      const anyOn = n > 0 || rows.some(c => c.checked);
      if (hc && hc.classList.contains("cb-filt") !== anyOn) hc.classList.toggle("cb-filt", anyOn);
    });
  };
  const go = () => { if (!raf) raf = requestAnimationFrame(run); };
  document.addEventListener("change", go, true);
  const mo = new MutationObserver(go);
  const start = () => mo.observe(document.body, { childList: true, subtree: true });
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
/* FORMAT 121 : en-têtes des tableaux fixés sous la bande du budget quand la page défile */
(() => {
  let raf = 0;
  const run = () => {
    raf = 0;
    const band = document.querySelector(".bdg-d-sticky");
    const blocks = document.querySelectorAll(".bdg-d-block");
    if (!blocks.length) return;
    const top = band ? band.getBoundingClientRect().bottom : 0;
    blocks.forEach(bl => {
      const ttl = bl.querySelector(":scope > .blk-head, :scope > .bdg-d-block-title, :scope > .bdg-d-tabs, :scope > #bdgTabs");
      /* FORMAT 21 : l'en-tête du Gantt (calendrier) reste lui aussi en place */
      const heads = [...bl.querySelectorAll("thead th, .bdg-h-head, .dlyg-r > .gh")];
      const parts = (ttl ? [ttl] : []).concat(heads);
      const cur = el => { const m = /translateY\((-?[\d.]+)px\)/.exec(el.style.transform || ""); return m ? +m[1] : 0; };
      const br = bl.getBoundingClientRect();
      const tH = ttl ? ttl.offsetHeight : 0, hH = heads.length ? Math.max(...heads.map(h => h.offsetHeight)) : 0;
      const room = br.bottom - (tH + hH + 30);
      const set = (el, want) => {
        /* dans un bloc qui défile lui-même : jamais au-dessus du haut de sa zone de défilement */
        const sc = el.closest(".dlyg-l, .dlyg-r") && el.closest(".bdg-d-scroll, .lk-scroll");
        if (sc) want = Math.max(want, sc.getBoundingClientRect().top);
        const t0 = el.getBoundingClientRect().top - cur(el);
        const off = Math.max(0, Math.min(want - t0, room - t0));
        const v = off > 0.5 ? "translateY(" + off.toFixed(1) + "px)" : "";
        if (el.style.transform !== v) el.style.transform = v;
        el.classList.toggle("sv-stuck", !!v);
      };
      if (ttl) set(ttl, top);
      heads.forEach(h => set(h, top + tH));
      void parts;
    });
  };
  const go = () => { if (!raf) raf = requestAnimationFrame(run); };
  document.addEventListener("scroll", go, true);
  window.addEventListener("resize", go);
  const mo = new MutationObserver(go);
  const start = () => mo.observe(document.body, { childList: true, subtree: true });
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
/* FORMAT 122 : désignation en lecture (texte) / saisie (zone de texte posée dessus pendant l'édition) */
document.addEventListener("focusin", e => { const t = e.target; if (t && t.matches && t.matches("td.ins-tdv textarea.ins-ta")) t.closest("td").classList.add("ins-ed"); }, true);
document.addEventListener("focusout", e => {
  const t = e.target;
  if (!t || !t.matches || !t.matches("td.ins-tdv textarea.ins-ta")) return;
  const td = t.closest("td"); td.classList.remove("ins-ed");
  const dv = td.querySelector(".ins-dv"); if (dv) dv.textContent = t.value;
}, true);
/* FORMAT 109 : DÉSIGNATION client à la ligne — hauteur suivant le texte, pas de retour à la ligne saisi */
document.addEventListener("input", e => {
  const t = e.target;
  if (!t || !t.matches || !t.matches("textarea.ins-ta")) return;
  if (/[\r\n]/.test(t.value)) t.value = t.value.replace(/[\r\n]+/g, " ");
  { const dv = t.closest("td.ins-tdv")?.querySelector(".ins-dv"); if (dv) { dv.textContent = t.value; return; } }
  t.style.height = "0px"; t.style.height = Math.max(20, t.scrollHeight) + "px";
}, true);
/* correction d'un nombre déjà saisi (FORMAT 86) : à la touche, sans zéros inutiles (1,00 → 1) et tout sélectionné ;
   en quittant la case, le format revient (1 → 1,00) */
const SVI_NUM_SEL = 'input.ins-in[inputmode="decimal"], input.inc-in.number, input.lk-q';
document.addEventListener("focusin", e => {
  const i = e.target.closest && e.target.closest(SVI_NUM_SEL);
  if (!i || i.disabled || i.readOnly) return;
  const v = String(i.value || "").trim();
  if (!v || !sviNumOk(v)) return;
  const n = num(v);
  if (!isFinite(n)) return;
  const raw = String(Math.round(n * 1e6) / 1e6).replace(".", ",");
  i.__numFmt = v;
  if (raw !== v) i.value = raw;
  setTimeout(() => { if (document.activeElement === i) { try { i.select(); i.setSelectionRange(0, i.value.length); } catch (err) {} } }, 0);
});
/* FORMAT 5 dans les fenêtres : nombres entiers (jours, ouvriers) — à la touche, tout sélectionné (la frappe remplace) */
const SVI_INT_SEL = "input.lkw-o, input.gen-n, input.dpk-o-in";
document.addEventListener("focusin", e => {
  const i = e.target.closest && e.target.closest(SVI_INT_SEL);
  if (!i || i.disabled || i.readOnly) return;
  setTimeout(() => { if (document.activeElement === i) { try { i.select(); i.setSelectionRange(0, i.value.length); } catch (err) {} } }, 0);
});
/* iPad : un toucher sur une case déjà active replace le curseur ; on resélectionne tout */
document.addEventListener("pointerup", e => {
  const i = e.target.closest && e.target.closest(SVI_INT_SEL);
  if (!i || i.disabled || i.readOnly || i.__selOnce) return;
  i.__selOnce = true;
  setTimeout(() => { try { i.select(); i.setSelectionRange(0, i.value.length); } catch (err) {} }, 0);
  i.addEventListener("blur", () => { i.__selOnce = false; }, { once: true });
});
document.addEventListener("focusout", e => {
  const i = e.target.closest && e.target.closest(SVI_NUM_SEL);
  if (!i || i.__numFmt === undefined) return;
  const v = String(i.value || "").trim();
  if (v && sviNumOk(v) && i.isConnected) {
    const old = i.__numFmt, dec = (String(old).split(",")[1] || "").length || 2;
    i.value = num(v).toLocaleString("fr-FR", { minimumFractionDigits: Math.max(2, dec), maximumFractionDigits: Math.max(2, dec) }).replace(/\u202f|\u00a0/g, " ");
  }
  delete i.__numFmt;
});
/* 05/11 : les actions sur les lignes cochées passent dans le ⋯ en haut à droite du tableau (plus de bouton sous le tableau) :
   SUPPRIMER LES LIGNES COCHÉES (le bouton caché fait le travail), COPIER, COLLER */
function sviPrmMoreUp(root) {
  if (!root) return;
  root.querySelectorAll(".prm-foot").forEach(f => { const del = f.querySelector(".prm-del"); if (!del || f.__more) return; f.__more = true; f.hidden = true;
    let tb = f.previousElementSibling; while (tb && !tb.matches("table, .ach-scroll, .pg-tree, .prm-table") && !tb.querySelector("table")) tb = tb.previousElementSibling;
    const host = tb || f; const b = document.createElement("div"); b.className = "prm-tbar"; b.innerHTML = `<button type="button" class="prm-more" aria-label="Actions">⋯</button>`; host.before(b);
    b.querySelector(".prm-more").addEventListener("click", ev => { ev.stopPropagation(); const n = +((del.querySelector(".svi-cnt") || {}).textContent || 0) || 0, X = window.__sviCells;
      sviHdrMenu(ev.currentTarget, [[{ k: "del", lab: "SUPPRIMER LES LIGNES COCHÉES (" + n + ")", del: true }], [{ k: "copy", lab: "COPIER" }, { k: "paste", lab: "COLLER" }]], a => {
        if (a === "del") { if (!n || del.disabled) { svToast("AUCUNE LIGNE COCHÉE.", 2500, ev.target); return; } del.click(); return; }
        if (!X || !X.count()) { svToast("SÉLECTIONNER D'ABORD DES CASES DU TABLEAU.", 2500, ev.target); return; } if (a === "copy") X.copy(); else X.paste(); }); }); });
}
new MutationObserver(() => { const c = document.getElementById("chs"); if (c && !c.hidden) sviPrmMoreUp(c); }).observe(document.documentElement, { childList: true, subtree: true });
function sviParamTabs() {
  const view = document.getElementById("chs");
  if (!view || view.querySelector(".prm-tabs")) return;
  const head = view.querySelector(".section-head");
  /* C7 (série C, document unique 3.1) : PARAMÉTRAGE reçoit la barre du haut commune — ⋯ (MODIFIER LE FORMAT), ⚠ et ✕ */
  if (head && !head.querySelector(".svi-hdr")) {
    head.insertAdjacentHTML("beforeend", sviHdrBar({ attr: "prmh", why: { undo: "RIEN À ANNULER DANS LE PARAMÉTRAGE.", redo: "RIEN À RÉTABLIR DANS LE PARAMÉTRAGE.", prev: "PARAMÉTRAGE : PAS D'ÉCRAN PRÉCÉDENT.", next: "PARAMÉTRAGE : PAS D'ÉCRAN SUIVANT." } }));
    head.addEventListener("click", e => { const b = e.target.closest("[data-prmh]"); if (!b || b.dataset.why) return; const a = b.dataset.prmh;
      if (a === "todo") { svToast("AUCUNE ALERTE.", 2000, b); return; }
      if (a === "close") { document.querySelector('#navMenu .nav-btn[data-view="home"]')?.click(); return; }
      if (a === "more") sviHdrMenu(b, [[{ k: "__fmt", lab: "MODIFIER LE FORMAT" }]], k => { if (k === "__fmt") sviFmtCurWin(); }); }); }
  const bar = document.createElement("div");
  bar.className = "prm-tabs pg-tabs bdg-d-tabs";
  /* B6 (série B, 04/11/2026) : PARAMÉTRAGE GÉNÉRAL — une seule rangée d'onglets pour toute l'application (forme des onglets du budget,
     même largeur, glissables pour changer l'ordre) ; plus de rubriques BUDGET / FORMAT ; GÉNÉRAL en premier ; TVA et TRANSPORT dans GÉNÉRAL (B2) */
  let grp = "gen";
  const tabsHTML = () => sviPgTabs().map(T => `<button type="button" class="prm-tab bdg-d-tab tab-eq" data-prm="${T.k}"${T.g === grp ? "" : " hidden"}>${esc(T.lab)}</button>`).join("");
  const gbar = document.createElement("div"); gbar.className = "prm-tabs pg-grps bdg-d-tabs";
  const gbarHTML = () => SVI_PG_GRP.map(([k, l]) => `<button type="button" class="prm-grp bdg-d-tab tab-eq${k === grp ? " on active" : ""}" data-pgg="${k}">${l}</button>`).join("");
  gbar.innerHTML = gbarHTML();
  gbar.addEventListener("click", e => { const b = e.target.closest("[data-pgg]"); if (!b) return; const T = sviPgTabs().find(x => x.g === b.dataset.pgg); if (T) show(T.k); });
  bar.innerHTML = tabsHTML();
  /* glisser un onglet (appui long puis glisser) = changer l'ordre, gardé */
  { let lp = 0, drag = null;
    bar.addEventListener("pointerdown", e => { const b = e.target.closest(".prm-tab"); if (!b) return; clearTimeout(lp); lp = setTimeout(() => { drag = b; b.classList.add("pg-drag"); }, SVI_G.lp); });
    document.addEventListener("pointermove", e => { if (!drag) return; e.preventDefault(); const o = document.elementFromPoint(e.clientX, e.clientY), t2 = o && o.closest && o.closest(".pg-tabs .prm-tab");
      bar.querySelectorAll(".pg-over").forEach(x => x.classList.remove("pg-over")); if (t2 && t2 !== drag) t2.classList.add("pg-over"); }, { passive: false });
    const up = e => { clearTimeout(lp); if (!drag) return; const o = document.elementFromPoint(e.clientX, e.clientY), t2 = o && o.closest && o.closest(".pg-tabs .prm-tab");
      const ks = [...bar.querySelectorAll(".prm-tab:not([hidden])")].map(x => x.dataset.prm), a = drag.dataset.prm; drag.classList.remove("pg-drag"); drag = null; bar.querySelectorAll(".pg-over").forEach(x => x.classList.remove("pg-over"));
      if (!t2 || t2.dataset.prm === a) return; ks.splice(ks.indexOf(a), 1); ks.splice(ks.indexOf(t2.dataset.prm), 0, a);
      try { localStorage.setItem(SVI_PG_ORD, JSON.stringify(ks)); } catch (er) {} const cur = (bar.querySelector(".prm-tab.on") || {}).dataset?.prm; bar.innerHTML = tabsHTML(); show(cur || ks[0]); bar.__moved = Date.now(); };
    document.addEventListener("pointerup", up); document.addEventListener("pointercancel", () => { clearTimeout(lp); if (drag) { drag.classList.remove("pg-drag"); drag = null; } }); }
  head.after(gbar); gbar.after(bar);
  const pane = document.createElement("div");
  pane.className = "prm-unit";
  pane.hidden = true;
  bar.after(pane);
  /* v739 : BIBLIOTHÈQUE DE PRIX (FORMAT 268) */
  const lpane = document.createElement("div");
  lpane.className = "prm-lib";
  lpane.hidden = true;
  pane.after(lpane);
  /* B2 (série B) : réglages ponctuels dans GÉNÉRAL ; autres onglets du paramétrage général (34b-parametrage-general.js) */
  const gpane = document.createElement("div"); gpane.className = "prm-pg"; gpane.hidden = true; lpane.after(gpane);
  const apane = document.createElement("div"); apane.className = "prm-ach"; apane.hidden = true; gpane.after(apane);   /* 05/11 : onglets dessinés par le module ACHATS */
  gpane.addEventListener("change", e => {
    const i = e.target; if (i.matches(".pg-soc-in")) { const o = sviPg(); o.soc = { ...sviSoc(), [i.dataset.f]: i.dataset.f === "mail" ? i.value.trim() : sviPgU(i.value) }; sviPgSave(o); return; }
    if (i.matches(".pg-logo-in")) { const f = i.files && i.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { const o = sviPg(); o.soc = { ...sviSoc(), logo: rd.result }; sviPgSave(o); sviPgDraw("gen", gpane); }; rd.readAsDataURL(f); return; }
    if (!i.matches(".pg-gv")) return; const g = i.dataset.g, s = String(i.value).trim();
    if (g === "tz") { const o = sviPg(); o.gen = { ...(o.gen || {}), tz: s }; sviPgSave(o); return; }
    const tab = g === "tva" ? "soc" : "gen";   /* E5 : la TVA PAR DÉFAUT est dans SOCIÉTÉ */
    if (s === "") { if (g === "tva") sviTvaSave(null); else sviTrKmSave(null); sviPgDraw(tab, gpane); return; }
    const v = num(s); if (!sviNumOk(s) || v < 0 || (g === "tva" && v > 100)) { svToast(g === "tva" ? "TVA NON VALIDE (0 À 100)." : "PRIX AU KM NON VALIDE.", 3000, i); sviPgDraw(tab, gpane); return; }
    if (g === "tva") sviTvaSave(v); else sviTrKmSave(v); sviPgDraw(tab, gpane); });
  const show = which => {
    if (!SVI_PG_TABS.some(T => T.k === which)) which = which === "tva" || which === "trk" ? "gen" : "gen";   /* anciens onglets (TVA, TRANSPORT, FORMAT) */
    const T = SVI_PG_TABS.find(x => x.k === which), h1 = head.querySelector("h1"), sub = head.querySelector("p");
    if (T.g !== grp) { grp = T.g; gbar.innerHTML = gbarHTML(); }
    bar.querySelectorAll(".prm-tab").forEach(b => { const t = SVI_PG_TABS.find(x => x.k === b.dataset.prm); b.hidden = !t || t.g !== grp; b.classList.toggle("on", b.dataset.prm === which); b.classList.toggle("active", b.dataset.prm === which); });
    pane.hidden = which !== "unit"; lpane.hidden = which !== "lib"; apane.hidden = !T.ach; gpane.hidden = which === "unit" || which === "lib" || !!T.ach;
    if (T.ach) { apane.innerHTML = apane.innerHTML || ""; (window.sviAchLoad ? sviAchLoad() : Promise.resolve()).then(() => { const v = document.getElementById("ach"); if (v && v.__prmMount && !apane.hidden) v.__prmMount(apane, T.ach); }).catch(() => svToast("ACHATS : CHARGEMENT IMPOSSIBLE.", 3000)); }
    { const gl = (SVI_PG_GRP.find(g => g[0] === grp) || ["", ""])[1];   /* C8 : pas de doublon « GÉNÉRAL — GÉNÉRAL » */
      if (h1) h1.textContent = "PARAMÉTRAGE — " + gl + (T.lab === gl ? "" : " — " + T.lab); }
    if (sub) sub.textContent = which === "lib" ? "RECETTES PAR ACTIVITÉ SECONDAIRE : CHARGES, UNITÉ, PRIX ET QUANTITÉ POUR UNE UNITÉ DE PRODUIT" : T.sub || "";
    if (which === "unit") draw();
    if (which === "lib") libDraw();
    if (!gpane.hidden) sviPgDraw(which, gpane);
    if (typeof sviPrmMoreUp === "function") setTimeout(() => sviPrmMoreUp(document.getElementById("chs")), 0);
    try { localStorage.setItem("svi_prm_v1", which); } catch (e) {}
  };
  /* v793 : UNITÉS au format commun des tableaux — loupe de tri / filtre sur chaque colonne, largeur des colonnes réglable et gardée */
  const UKIT = sviCfKit({ key: "prm_unit", shell: {}, refresh: () => draw() });
  const UCOLS = [["n", "UNITÉ", x => x.n, ""], ["a", "ABRÉVIATION", x => x.a, "center"]];
  const draw = () => {
    const L = sviUnits(), R = UKIT.cfApply("prm_unit", UCOLS, L.map((x, i) => ({ ...x, __i: i }))), CG = sviCwCols("prm_unit", [["n", 260], ["a", 160]], [["_cb", 44]]);
    pane.innerHTML = `<table class="prm-table" data-svcw="prm_unit" style="${CG.style}">${CG.cg}
      <thead><tr>${UCOLS.map(c => UKIT.cfHead("prm_unit", c[0], c[1], c[3])).join("")}<th class="center"><input type="checkbox" class="prm-all" title="Tout cocher"></th></tr></thead>
      <tbody>${R.map(x => x.__i).map(i => [L[i], i]).map(([x, i]) => `<tr data-i="${i}"><td><input class="prm-in" data-f="n" value="${esc(x.n)}" autocomplete="off"></td>
        <td class="center"><input class="prm-in center" data-f="a" value="${esc(x.a)}" autocomplete="off"></td>
        <td class="center"><input type="checkbox" class="prm-cb"></td></tr>`).join("")}
        <tr class="prm-new"><td><input class="prm-in" data-f="n" placeholder="CRÉER UNE UNITÉ ICI…" autocomplete="off"></td><td class="center"><input class="prm-in center" data-f="a" autocomplete="off"></td><td></td></tr></tbody></table>
      <div class="prm-foot"><button type="button" class="prm-del" disabled>SUPPRIMER LES LIGNES COCHÉES <span class="svi-cnt">0</span></button></div>`;
  };
  const clean = v => String(v ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  pane.addEventListener("change", e => {
    const L = sviUnits();
    if (e.target.matches(".prm-all")) { pane.querySelectorAll(".prm-cb").forEach(c => { c.checked = e.target.checked; }); }
    if (e.target.matches(".prm-cb, .prm-all")) {
      const n = pane.querySelectorAll(".prm-cb:checked").length;
      const b = pane.querySelector(".prm-del");
      b.disabled = !n; b.querySelector(".svi-cnt").textContent = n;
      return;
    }
    const inp = e.target.closest(".prm-in");
    if (!inp) return;
    const tr = inp.closest("tr"), f = inp.dataset.f, v = clean(inp.value);
    inp.value = v;
    const i = tr.dataset.i !== undefined ? +tr.dataset.i : -1;
    /* pas de doublon d'abréviation ni d'intitulé */
    const dup = v && L.some((x, j) => j !== i && clean(x[f]) === v);
    if (dup) { svToast("DOUBLON : " + v + " EXISTE DÉJÀ.", 3500, inp); inp.value = i >= 0 ? L[i][f] : ""; setTimeout(() => inp.focus(), 0); return; }
    if (i >= 0) {
      L[i][f] = v;
      /* intitulé et abréviation effacés : la ligne est supprimée (FORMAT 90) */
      if (!clean(L[i].n) && !clean(L[i].a)) { L.splice(i, 1); sviUnitsSave(L); draw(); return; }
      sviUnitsSave(L); return;
    }
    if (!v) return;
    const row = { n: "", a: "" };
    row[f] = v;
    tr.querySelectorAll(".prm-in").forEach(x => { row[x.dataset.f] = clean(x.value); });
    L.push(row);
    sviUnitsSave(L);
    draw();
    const nt = pane.querySelector(`tr[data-i="${L.length - 1}"] .prm-in[data-f="${f === "n" ? "a" : "n"}"]`);
    if (nt) nt.focus();
  });
  pane.addEventListener("click", async e => {
    const cf = e.target.closest(".cf-btn"); if (cf) { e.preventDefault(); e.stopPropagation(); UKIT.cfOpenMenu(cf); return; }
    if (!e.target.closest(".prm-del") || e.target.closest(".prm-del").disabled) return;
    const idx = [...pane.querySelectorAll(".prm-cb:checked")].map(c => +c.closest("tr").dataset.i);
    if (!idx.length) return;
    const L = sviUnits();
    const ok = await svConfirm({ title: "SUPPRIMER LES UNITÉS COCHÉES", html: `<ul class="svc-list">${idx.map(i => `<li>${esc(L[i].a + " — " + L[i].n)}</li>`).join("")}</ul>`, ok: "SUPPRIMER" });
    if (!ok) return;
    sviUnitsSave(L.filter((x, i) => !idx.includes(i)));
    draw();
  });
  bar.addEventListener("click", e => { if (Date.now() - (bar.__moved || 0) < 300) return; const b = e.target.closest(".prm-tab"); if (b && b.dataset.prm) show(b.dataset.prm); });
  /* v739 : BIBLIOTHÈQUE DE PRIX — activités à gauche, recettes et leurs charges à droite ; tout modifiable ; enregistré aussitôt */
  let libAct = "", libPt = "", libSrc = "";
  /* 05/11 : BIBLIOTHÈQUE — en tête de l'activité : un nuage de points par charge (un point par recette : quantité pour une unité), la MOYENNE pondérée
     au prorata des quantités produites en trait ; filtre TOUS LES BUDGETS / un budget ; dessous le tableau MOYENNE ; toucher un point = ce tableau montre
     la recette du point ; « i » après l'unité = ouvrir son budget */
  const libKey = c => U2(c.des) + "|" + U2(c.u);
  const libMean = (Rs, key) => { let sw = 0, sk = 0, sp = 0, n = 0; Rs.forEach(R => { const c = (R.chg || []).find(x => libKey(x) === key); if (!c) return; const wgt = N2(R.q) > 0 ? N2(R.q) : 1; sw += wgt; sk += wgt * N2(c.k); sp += wgt * N2(c.p); n++; });
    return { n, k: sw ? sk / sw : 0, p: sw ? sp / sw : 0 }; };
  const libChart = (Rs) => { if (!Rs.length) return "";
    const keys = [...new Set(Rs.flatMap(R => (R.chg || []).map(libKey)))], srcs = [...new Set(sviLibGet().filter(R => U2(R.act) === libAct).map(R => R.src).filter(Boolean))].sort();
    const chart = key => { const pts = Rs.map(R => { const c = (R.chg || []).find(x => libKey(x) === key); return c ? { R, k: N2(c.k) } : null; }).filter(Boolean), M = libMean(Rs, key);
      const W = 260, H = 110, mx = Math.max(...pts.map(p => p.k), M.k) * 1.15 || 1, y = v => H - 14 - v / mx * (H - 28), x = i => 20 + (pts.length > 1 ? i * (W - 40) / (pts.length - 1) : (W - 40) / 2);
      return `<div class="lib-ch"><div class="lib-ch-t">${esc(key.split("|")[0])} <small>(${esc(key.split("|")[1] || "")} POUR 1 ${esc(Rs[0].u || "U")})</small></div>
        <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><line x1="16" x2="${W - 8}" y1="${y(M.k)}" y2="${y(M.k)}" class="lib-mean"/><text x="${W - 8}" y="${y(M.k) - 3}" text-anchor="end" class="lib-mt">MOY. ${esc(F2(M.k, 3))}</text>
        ${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.k)}" r="${p.R.id === libPt ? 7 : 5}" class="lib-pt${p.R.id === libPt ? " on" : ""}" data-lpt="${esc(p.R.id)}"><title>${esc(p.R.nom + " — " + F2(p.k, 4) + (p.R.src ? " — " + p.R.src : ""))}</title></circle>`).join("")}</svg></div>`; };
    const P = libPt ? Rs.find(R => R.id === libPt) : null;
    const rows = P ? (P.chg || []).map(c => [c.des, c.u, N2(c.k), N2(c.p), P.src]) : keys.map(k => { const M = libMean(Rs, k); return [k.split("|")[0], k.split("|")[1], M.k, M.p, ""]; });
    return `<div class="lib-top"><div class="lib-flt">BUDGETS <select class="lib-src"><option value="">TOUS LES BUDGETS</option>${srcs.map(s => `<option${s === libSrc ? " selected" : ""}>${esc(s)}</option>`).join("")}</select></div>
      <div class="lib-chs">${keys.map(chart).join("")}</div>
      <table class="prm-table lib-moy"><thead><tr><th>${P ? "RECETTE : " + esc(P.nom) + ` <button type="button" class="ach-link" data-lpt="">‹ MOYENNE</button>` : "MOYENNE (" + Rs.length + " RECETTE" + (Rs.length > 1 ? "S" : "") + ", AU PRORATA DES QUANTITÉS PRODUITES)"}</th><th class="center">UNITÉ</th><th class="number">QTÉ POUR 1 ${esc(Rs[0].u || "U")}</th><th class="number">PRIX</th><th class="number">COÛT</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${esc(r[0])}</td><td class="center">${esc(r[1])}${r[4] ? ` <span class="bdg-d-badge lib-i" data-lsrc="${esc(r[4])}" role="button" title="Ouvrir le budget">i</span>` : ""}</td><td class="number">${esc(F2(r[2], 4))}</td><td class="number">${esc(F2(r[3], 2))}</td><td class="number">${esc(F2(r[2] * r[3], 2))}</td></tr>`).join("")}</tbody></table></div>`; };
  const U2 = v => String(v ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  const N2 = v => Number(String(v ?? "").replace(/\s/g, "").replace(",", ".")) || 0;
  const F2 = (v, d) => (Number(v) || 0).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  /* v793 : BIBLIOTHÈQUE au format commun — loupes sur chaque colonne, largeur réglable, cases à droite (plus de ✕ par ligne) */
  const LKIT = sviCfKit({ key: "prm_lib", shell: {}, refresh: () => libDraw() });
  const LACOLS = [["act", "ACTIVITÉ SECONDAIRE", x => x, ""], ["n", "RECETTES", x => sviLibGet().filter(R => U2(R.act) === x).length, "center"]];
  const LCCOLS = [["des", "CHARGE", x => x.c.des, ""], ["u", "UNITÉ", x => x.c.u, "center"], ["k", "QTÉ POUR 1 U", x => N2(x.c.k), "number"], ["p", "PCB", x => N2(x.c.p), "number"], ["c", "COÛT", x => N2(x.c.k) * N2(x.c.p), "number"]];
  const libDraw = () => {
    const L = sviLibGet(), acts0 = [...new Set(L.map(R => U2(R.act)))].sort((a, b) => a.localeCompare(b, "fr")), acts = LKIT.cfApply("prm_liba", LACOLS, acts0);
    if (!acts.includes(libAct)) libAct = acts[0] || "";
    const R0 = L.filter(R => U2(R.act) === libAct), RF = R0.filter(R => !libSrc || R.src === libSrc);
    /* v793 : largeur des colonnes réglable et gardée (moteur commun) */
    const LA = sviCwCols("prm_liba", [["act", 240], ["n", 100]]), LC = sviCwCols("prm_libc", [["des", 220], ["u", 80], ["k", 120], ["p", 110], ["c", 110]], [["_x", 44]]);
    lpane.innerHTML = `<div class="lib-wrap"><div class="lib-acts"><table class="prm-table" data-svcw="prm_liba" style="${LA.style}">${LA.cg}<thead><tr>${LACOLS.map(c => LKIT.cfHead("prm_liba", c[0], c[1], c[3])).join("")}</tr></thead><tbody>
        ${acts.map(a => `<tr class="lib-a${a === libAct ? " on" : ""}" data-act="${esc(a)}"><td>${esc(a)}</td><td class="center">${svCnt(L.filter(R => U2(R.act) === a).length)}</td></tr>`).join("") || `<tr><td colspan="2" class="empty">BIBLIOTHÈQUE VIDE : ELLE SE REMPLIT AU FIL DES BUDGETS FIGÉS, OU ICI.</td></tr>`}
        <tr class="prm-new"><td colspan="2"><input class="prm-in lib-newa" placeholder="CRÉER UNE RECETTE ICI… (ACTIVITÉ — VARIANTE)" autocomplete="off"></td></tr></tbody></table></div>
      <div class="lib-recs">${libChart(RF)}${R0.map(R => `<div class="lib-rec" data-rid="${esc(R.id)}"><div class="lib-rh"><b>${esc(U2(R.act))} —</b> <input class="prm-in lib-in" data-f="nom" value="${esc(R.nom)}" autocomplete="off"> <span>UNITÉ</span> <input class="prm-in lib-in center" data-f="u" value="${esc(R.u || "")}" style="width:60px" autocomplete="off">${R.chk ? ' <span class="lib-chk">À VÉRIFIER</span>' : ""}
          <small>${(R.des || []).length ? "UTILISÉE : " + esc((R.des || []).slice(0, 3).join(", ")) : ""}</small><button type="button" class="prm-del lib-del" data-rdel="${esc(R.id)}" title="Supprimer la recette">✕</button></div>
        <table class="prm-table lib-t" data-svcw="prm_libc" style="${LC.style}">${LC.cg}<thead><tr>${LCCOLS.map(c => LKIT.cfHead("prm_libc_" + R.id, c[0], c[0] === "k" ? "QTÉ POUR 1 " + esc(R.u || "U") : c[1], c[3])).join("")}<th class="center"><input type="checkbox" class="lib-call" aria-label="Tout cocher"></th></tr></thead><tbody>
          ${LKIT.cfApply("prm_libc_" + R.id, LCCOLS, (R.chg || []).map((c, i) => ({ c, i }))).map(({ c, i }) => `<tr data-ci="${i}"><td><input class="prm-in lib-c" data-f="des" value="${esc(c.des)}" autocomplete="off"></td><td><input class="prm-in lib-c center" data-f="u" value="${esc(c.u)}" autocomplete="off"></td>
            <td><input class="prm-in lib-c number" data-f="k" inputmode="decimal" value="${esc(F2(c.k, 4))}" autocomplete="off"></td><td><input class="prm-in lib-c number" data-f="p" inputmode="decimal" value="${esc(F2(c.p, 2))}" autocomplete="off"></td>
            <td class="number">${esc(F2(N2(c.k) * N2(c.p), 2))}</td><td class="center"><input type="checkbox" class="lib-ccb" data-cdel="${i}" aria-label="Cocher"></td></tr>`).join("")}
          <tr class="prm-new"><td colspan="6"><input class="prm-in lib-newc" placeholder="CRÉER UNE CHARGE ICI…" autocomplete="off"></td></tr></tbody></table>
        <div class="prm-foot"><button type="button" class="prm-del lib-cdels" disabled>SUPPRIMER LES LIGNES COCHÉES <span class="svi-cnt">0</span></button></div></div>`).join("") || `<div class="empty">CHOISIR UNE ACTIVITÉ, OU CRÉER UNE RECETTE (ACTIVITÉ — VARIANTE).</div>`}</div></div>`;
  };
  const libSave = (L, keep) => { sviLibSet(L); if (!keep) libDraw(); };
  lpane.addEventListener("click", e => {
    const a = e.target.closest(".lib-a"); if (a) { libAct = a.dataset.act; libPt = ""; libSrc = ""; libDraw(); return; }
    const pt = e.target.closest("[data-lpt]"); if (pt) { libPt = pt.dataset.lpt === libPt ? "" : pt.dataset.lpt; libDraw(); return; }
    const li = e.target.closest("[data-lsrc]"); if (li) { if (window.__sviAvOpen) { document.querySelector('#navMenu .nav-btn[data-view="bdg"]')?.click(); setTimeout(() => window.__sviAvOpen(li.dataset.lsrc), 50); } return; }
    const rd = e.target.closest("[data-rdel]"); if (rd) { (async () => { const L = sviLibGet(), R = L.find(x => x.id === rd.dataset.rdel); if (!R) return; if (typeof svConfirm === "function" && !(await svConfirm({ title: "SUPPRIMER LA RECETTE", text: U2(R.act) + " — " + R.nom, ok: "SUPPRIMER" }))) return; libSave(L.filter(x => x !== R)); })(); return; }
    const cf = e.target.closest(".cf-btn"); if (cf) { e.preventDefault(); e.stopPropagation(); LKIT.cfOpenMenu(cf); return; }
    const cd = e.target.closest(".lib-cdels"); if (cd && !cd.disabled) { const rec = cd.closest(".lib-rec"), L = sviLibGet(), R = L.find(x => x.id === rec.dataset.rid);
      const ix = [...rec.querySelectorAll(".lib-ccb:checked")].map(c => +c.dataset.cdel); if (R && ix.length) { R.chg = R.chg.filter((c, i) => !ix.includes(i)); libSave(L); } }
  });
  lpane.addEventListener("change", e => {
    const t = e.target, L = sviLibGet();
    if (t.matches(".lib-src")) { libSrc = t.value; libPt = ""; libDraw(); return; }
    if (t.matches(".lib-call, .lib-ccb")) { const rec = t.closest(".lib-rec"), cbs = [...rec.querySelectorAll(".lib-ccb")]; if (t.matches(".lib-call")) cbs.forEach(c => { c.checked = t.checked; });
      const n = cbs.filter(c => c.checked).length, d = rec.querySelector(".lib-cdels"); d.disabled = !n; d.querySelector(".svi-cnt").textContent = n; return; }
    if (t.classList.contains("lib-newa")) {
      const v = U2(t.value), [act, ...rest] = v.split(/\s+[—-]\s+/); if (!act) return;
      const R = sviLibAdd(L, { act: U2(act), nom: U2(rest.join(" — ")) || "RECETTE", u: "", chg: [], des: [], lot: [], src: "PARAMÉTRAGE", date: new Date().toISOString().slice(0, 10) });
      libAct = U2(R.act); libSave(L); return;
    }
    const rec = t.closest(".lib-rec"), R = rec && L.find(x => x.id === rec.dataset.rid); if (!R) return;
    if (t.classList.contains("lib-in")) { R[t.dataset.f] = U2(t.value); libSave(L); return; }
    if (t.classList.contains("lib-newc")) { const v = U2(t.value); if (!v) return; R.chg = R.chg || []; R.chg.push({ des: v, u: "", k: 0, p: 0 }); libSave(L);
      setTimeout(() => { const i = lpane.querySelector(`.lib-rec[data-rid="${CSS.escape(R.id)}"] tr[data-ci="${R.chg.length - 1}"] input[data-f="u"]`); if (i) i.focus(); }, 0); return; }
    if (t.classList.contains("lib-c")) { const c = R.chg[Number(t.closest("tr").dataset.ci)]; if (!c) return; const f = t.dataset.f; c[f] = f === "k" || f === "p" ? N2(t.value) : U2(t.value); libSave(L); }
  });
  /* B6 : le paramétrage général s'ouvre sur le premier onglet (GÉNÉRAL par défaut) */
  show(sviPgTabs()[0].k);
  view.__prmShow = show;   /* 05/11 : aller à un onglet du paramétrage depuis ailleurs */
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sviParamTabs); else sviParamTabs();
/* PARAMÉTRAGE › CALENDRIER : fenêtre CALENDRIER DU BUDGET (FORMAT 101) — un mois à la fois ;
   toucher un jour = travaillé ↔ non travaillé ; TOUS LES DIMANCHES / TOUS LES SAMEDIS ; ANNULER / ENREGISTRER */
function sviBdgCalWin(iso) {
  const L = window.__sviBdgLive;
  if (!L) return;
  if (!L.edit) { svToast("BUDGET FIGÉ OU VALIDÉ : LECTURE SEULE", 3000); return; }
  const c0 = L.cal(), cal = { we: c0.we.slice(), off: c0.off.slice(), on: c0.on.slice() };
  let cur = iso ? new Date(iso + "T00:00:00") : new Date(); if (isNaN(cur)) cur = new Date(); cur.setDate(1);
  const d = sviWinNew();
  const draw = () => {
    const y = cur.getFullYear(), m = cur.getMonth();
    const first = (new Date(y, m, 1).getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate();
    let cells = "";
    for (let i = 0; i < first; i++) cells += "<span></span>";
    for (let day = 1; day <= n; day++) {
      const di = sviIsoOf(new Date(y, m, day));
      const w = sviWork(cal, di), exc = cal.on.includes(di);
      cells += `<button type="button" data-d="${di}" class="${w ? "" : "off"}${exc ? " exc" : ""}">${day}</button>`;
    }
    d.innerHTML = `<div class="svc-card bcal-card" role="dialog" aria-modal="true">
      <button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
      <div class="svc-t">CALENDRIER DU BUDGET</div>
      <div class="svc-sub">${esc(L.ref || "")}</div>
      ${window.__sviDlyScale ? `<div class="bcal-sc"><span>AFFICHAGE DU GANTT</span>${[["j", "JOUR"], ["s", "SEMAINE"], ["m", "MOIS"]].map(([v, l]) => `<button type="button" data-sc="${v}" class="${window.__sviDlyScale.get() === v ? "on" : ""}">${l}</button>`).join("")}</div>` : ""}
      <div class="bcal-h"><button type="button" data-m="-1" aria-label="Mois précédent">‹</button><b>${SVI_MOIS[m]} ${y}</b><button type="button" data-m="1" aria-label="Mois suivant">›</button></div>
      <div class="bcal-w"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
      <div class="bcal-g">${cells}</div>
      <div class="bcal-rec"><label><input type="checkbox" data-we="0"${cal.we.includes(0) ? " checked" : ""}> TOUS LES DIMANCHES</label><label><input type="checkbox" data-we="6"${cal.we.includes(6) ? " checked" : ""}> TOUS LES SAMEDIS</label></div>
      <div class="svc-f"><button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button></div></div>`;
  };
  document.getElementById("svConf")?.remove();
  sviWinShow(d);
  draw();
  d.addEventListener("change", e => {
    const c = e.target.closest("[data-we]");
    if (!c) return;
    const k = Number(c.dataset.we);
    cal.we = cal.we.filter(x => x !== k);
    if (c.checked) cal.we.push(k);
    /* exceptions devenues inutiles retirées */
    cal.on = cal.on.filter(x => cal.we.includes(new Date(x + "T00:00:00").getDay()));
    cal.off = cal.off.filter(x => !cal.we.includes(new Date(x + "T00:00:00").getDay()));
    draw();
  });
  d.addEventListener("click", e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
    /* v546 (R17) : affichage du Gantt choisi ici (aussitôt, sans ENREGISTRER) */
    const sb = e.target.closest("[data-sc]");
    if (sb && window.__sviDlyScale) { window.__sviDlyScale.set(sb.dataset.sc); draw(); return; }
    const mb = e.target.closest("[data-m]");
    if (mb) { cur.setMonth(cur.getMonth() + Number(mb.dataset.m)); draw(); return; }
    const db = e.target.closest("[data-d]");
    if (db) {
      const di = db.dataset.d, rec = cal.we.includes(new Date(di + "T00:00:00").getDay());
      if (sviWork(cal, di)) { if (cal.on.includes(di)) cal.on = cal.on.filter(x => x !== di); else cal.off.push(di); }
      else { if (cal.off.includes(di)) cal.off = cal.off.filter(x => x !== di); else if (rec) cal.on.push(di); }
      draw(); return;
    }
    if (e.target.closest("[data-ok]")) {
      d.remove();
      L.setCal(cal);   /* FORMAT 32 : pas de message de fin d'action (détail dans l'historique) */
    }
  });
}
/* PARAMÉTRAGE › DATES DU BUDGET : DATE BUTOIR (contrat du client) et DATE OBJECTIF (cible interne, au plus tard la butoir) */
function sviBdgDatesWin() {
  const L = window.__sviBdgLive;
  if (!L) return;
  const v = L.dates();
  const d = sviWinNew();
  d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true">
    <button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
    <div class="svc-t">DATES DU BUDGET</div>
    <div class="svc-sub">${esc(L.ref || "")}</div>
    <div class="bdt-row"><span>DATE BUTOIR</span><input type="date" data-f="but" value="${esc(v.but)}"></div>
    <div class="bdt-row"><span>DATE OBJECTIF</span><input type="date" data-f="obj" value="${esc(v.obj)}"${v.but ? ` max="${esc(v.but)}"` : ""}></div>
    <div class="svc-f"><button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button></div></div>`;
  document.getElementById("svConf")?.remove();
  sviWinShow(d);
  d.querySelectorAll('input[type="date"]').forEach(sviDateField);
  const ib = d.querySelector('[data-f="but"]'), io = d.querySelector('[data-f="obj"]');
  /* le calendrier de l'OBJECTIF ne propose pas de date après la BUTOIR, et celui de la BUTOIR pas avant l'OBJECTIF */
  /* v902 : date refusée dès la saisie (même règle qu'INF) — la case reprend sa valeur d'avant, avec la raison */
  const prev = { but: ib.value, obj: io.value };
  d.addEventListener("change", e => {
    const i = e.target && e.target.closest && e.target.closest('input[data-f="but"], input[data-f="obj"]');
    if (i) { const why = sviBdgDateWhy(i.dataset.f, v.deb || "", io.value, ib.value);
      if (why) { i.value = prev[i.dataset.f]; svToast(why, 4500, i); } else prev[i.dataset.f] = i.value; }
    if (ib.value) io.setAttribute("max", ib.value); else io.removeAttribute("max");
    if (io.value) ib.setAttribute("min", io.value); else ib.removeAttribute("min");
  });
  d.dispatchEvent(new Event("change"));
  d.addEventListener("click", e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
    if (!e.target.closest("[data-ok]")) return;
    d.remove();
    L.setDates(ib.value, io.value);
  });
}


/* ⟪ src/34b-parametrage-general.js ⟫ */
/* =========================================================
   SÉRIE B (04/11/2026) : PARAMÉTRAGE GÉNÉRAL — commun à toute l'application (B2, B6, B7, B8, B9, B20, B22, B24, B26, B31, B38, B41)
   Une seule rangée d'onglets (forme des onglets du budget, même largeur, glissables pour changer l'ordre).
   Données : svi_pg_v1 (partagées par la base). Chaque liste = tableau au format commun (CRÉER … ICI, cases à droite, SUPPRIMER LES LIGNES COCHÉES) ;
   LIEUX et BANQUES = tableaux pliables (pays › région › ville ; banque › agence).
   ========================================================= */
const SVI_PG_K = "svi_pg_v1";
const SVI_PG_DEF = {
  grades: [{ id: "g1", n: "1", lab: "DIRECTEUR GÉNÉRAL" }, { id: "g2", n: "2", lab: "" }, { id: "g3", n: "3", lab: "" }],
  ftypes: [["FABRICANT", ""], ["DISTRIBUTEUR", ""], ["REVENDEUR", ""], ["LOUEUR", ""], ["SOUS-TRAITANT", "STR", "CNSS; ATTESTATION FISCALE; ASSURANCE RC"], ["ORGANISME FINANCIER", "FIN"]].map(([lab, pre, docs], i) => ({ id: "t" + (i + 1), lab, pre, docs: docs || "" })),
  devises: [{ id: "d1", code: "MAD", lab: "DIRHAM MAROCAIN", def: true }, { id: "d2", code: "EUR", lab: "EURO", def: false }, { id: "d3", code: "USD", lab: "DOLLAR AMÉRICAIN", def: false }],
  lieux: [{ id: "p1", p: "", lab: "MAROC" }],
  banques: [["ATTIJARIWAFA BANK", "AWB", "007"], ["BANQUE POPULAIRE", "BP", "101-199"], ["BANK OF AFRICA", "BOA", "011"], ["BMCI", "BMCI", "013"], ["CIH BANK", "CIH", "230"],
    ["CREDIT AGRICOLE DU MAROC", "CAM", "225"], ["CREDIT DU MAROC", "CDM", "021"], ["SOCIETE GENERALE MAROC", "SGMB", "022"], ["AL BARID BANK", "ABB", "350"]].map(([lab, abr, code], i) => ({ id: "B" + (i + 1), p: "", lab, abr, code })),
  langues: ["FRANÇAIS", "ARABE", "ANGLAIS", "ESPAGNOL"]
};
function sviPg() { let o = {}; try { o = JSON.parse(localStorage.getItem(SVI_PG_K) || "{}") || {}; } catch (e) {} return o; }
function sviPgSave(o) { try { localStorage.setItem(SVI_PG_K, JSON.stringify(o)); } catch (e) {} }
const sviPgL = k => { const v = sviPg()[k]; return Array.isArray(v) ? v : JSON.parse(JSON.stringify(SVI_PG_DEF[k] || [])); };
const sviPgLSave = (k, L) => { const o = sviPg(); o[k] = L; sviPgSave(o); };
const sviPgId = () => "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const sviPgU = v => String(v ?? "").replace(/\s+/g, " ").trim().toUpperCase();
/* SOCIÉTÉ (B7) — reprend l'ICE et l'IF déjà saisis dans les paramètres d'achat */
const SVI_SOC_F = [["rs", "RAISON SOCIALE"], ["adr", "ADRESSE"], ["rc", "RC"], ["ice", "ICE"], ["if", "IF"], ["patente", "PATENTE"], ["cnss", "CNSS"], ["tel", "TÉLÉPHONE"], ["mail", "E-MAIL"]];
function sviSoc() { const s = { ...(sviPg().soc || {}) };
  try { if (!s.ice || !s.if) { const P = JSON.parse(SVI_LZ.dec(localStorage.getItem("svi_ach_prm_v1") || "") || "{}") || {}; if (!s.ice && P.socIce) s.ice = P.socIce; if (!s.if && P.socIf) s.if = P.socIf; } } catch (e) {}
  return s; }
/* CALENDRIER DE LA SOCIÉTÉ (B38) : jours non travaillés de toute la société ; un budget sans calendrier propre les reprend */
let sviPgOffMem = null;
const sviPgOffDays = () => { let raw = null; try { raw = localStorage.getItem(SVI_PG_K); } catch (e) {} if (sviPgOffMem && sviPgOffMem.raw === raw) return sviPgOffMem.v.slice(); const out = []; sviPgL("cal").forEach(x => { if (!sviIsoOk(x.a)) return; const b = sviIsoOk(x.b) && x.b >= x.a ? x.b : x.a; for (let d = x.a, i = 0; d <= b && i < 400; d = sviIsoAdd(d, 1), i++) out.push(d); }); const v = [...new Set(out)].sort(); sviPgOffMem = { raw, v }; return v.slice(); };
/* villes (LIEUX) et langues (B41 : « ajouter… » depuis une fiche = ajoutée partout) */
const sviPgVilles = () => { const L = sviPgL("lieux"), path = x => { const p = L.find(y => y.id === x.p); return p ? path(p).concat(x.lab) : [x.lab]; };
  return L.filter(x => x.p && !L.some(y => y.p === x.id) && L.find(y => y.id === x.p) && L.find(y => y.id === x.p).p).map(x => ({ id: x.id, lab: x.lab, path: path(x).join(" › ") })); };
const sviLangues = () => { const v = sviPg().langues; return Array.isArray(v) ? v : SVI_PG_DEF.langues.slice(); };
function sviLangueAdd(l) { l = sviPgU(l); if (!l) return; const L = sviLangues(); if (!L.includes(l)) { L.push(l); const o = sviPg(); o.langues = L; sviPgSave(o); } }

/* ---------- tableau commun d'une liste ---------- */
const SVI_CPT_NAT = ["FOURNISSEUR", "CLIENT", "BANQUE", "TVA", "CHARGE", "PRODUIT", "AUTRE"];
const SVI_CPT_CLS = code => { const d = String(code || "").charAt(0); return /[1-8]/.test(d) ? d : ""; };
function sviPgTable(pane, c) {
  const L = sviPgL(c.k);
  const cell = (x, f, i) => { const [k, , , t, opts] = f, v = x ? x[k] : "";
    if (t === "ro") return `<td class="center">${x ? esc(opts(x)) : ""}</td>`;   /* 05/11 : colonne calculée */
    if (t === "check") return `<td class="center"><input type="checkbox" class="pg-in" data-f="${k}"${v ? " checked" : ""}${x ? "" : " disabled"}></td>`;
    if (t === "sel") return `<td><select class="pg-in" data-f="${k}"><option value=""></option>${(opts() || []).map(o => `<option value="${esc(o[0])}"${String(v) === String(o[0]) ? " selected" : ""}>${esc(o[1])}</option>`).join("")}</select></td>`;
    return `<td${t === "num" || t === "date" ? ' class="center"' : ""}><input class="prm-in pg-in${t === "num" ? " center" : ""}" data-f="${k}"${t === "date" ? ' type="date"' : ""} value="${esc(v ?? "")}"${!x && i === 0 ? ` placeholder="${esc(c.newLab)}"` : ""} autocomplete="off"></td>`; };
  pane.innerHTML = `<table class="prm-table pg-t" data-pgk="${c.k}"><colgroup>${c.cols.map(f => `<col style="width:${f[2]}px">`).join("")}<col style="width:44px"></colgroup>
    <thead><tr>${c.cols.map(f => `<th class="${f[3] === "num" || f[3] === "check" || f[3] === "date" ? "center" : ""}">${esc(f[1])}</th>`).join("")}<th class="center"><input type="checkbox" class="pg-all" aria-label="Tout cocher"></th></tr></thead>
    <tbody>${L.map((x, i) => `<tr data-i="${i}">${c.cols.map(f => cell(x, f, 1)).join("")}<td class="center"><input type="checkbox" class="pg-cb"></td></tr>`).join("")}
      <tr class="prm-new pg-new">${c.cols.map((f, j) => cell(null, f, j)).join("")}<td></td></tr></tbody></table>
    <div class="prm-foot"><button type="button" class="prm-del pg-del" disabled>SUPPRIMER LES LIGNES COCHÉES <span class="svi-cnt">0</span></button></div>`;
  if (pane.__pg) return; pane.__pg = true;
  pane.addEventListener("change", e => { const t = pane.querySelector("table.pg-t"); if (!t || !e.target.closest(".pg-t, .prm-foot")) return; const C = pane.__pgc;
    if (e.target.matches(".pg-all")) t.querySelectorAll(".pg-cb").forEach(x => { x.checked = e.target.checked; });
    if (e.target.matches(".pg-cb, .pg-all")) { const n = t.querySelectorAll(".pg-cb:checked").length, b = pane.querySelector(".pg-del"); b.disabled = !n; b.querySelector(".svi-cnt").textContent = n; return; }
    const i = e.target.closest(".pg-in"); if (!i) return; const tr = i.closest("tr"), L2 = sviPgL(C.k), f = i.dataset.f, col = C.cols.find(x => x[0] === f);
    const v = i.type === "checkbox" ? i.checked : col[3] === "date" ? i.value : sviPgU(i.value);
    if (col[3] === "num" && v !== "" && !/^\d+$/.test(v)) { svToast(col[1] + " : CHIFFRES SEULEMENT.", 2500, i); sviPgTable(pane, C); return; }
    if (C.uniq && f === C.uniq && v && L2.some((x, j) => sviPgU(x[f]) === v && String(j) !== tr.dataset.i)) { svToast(col[1] + " DÉJÀ PRIS.", 2500, i); sviPgTable(pane, C); return; }
    if (tr.classList.contains("pg-new")) { if (!v) return; const x = { id: sviPgId() }; C.cols.forEach(cc => { x[cc[0]] = cc[3] === "check" ? false : ""; }); x[f] = v; L2.push(x); }
    else { const x = L2[+tr.dataset.i]; if (!x) return; if (col[3] === "radio1" || C.one === f) L2.forEach(y => { y[f] = false; }); x[f] = v; }
    sviPgLSave(C.k, L2); if (C.after) C.after(); sviPgTable(pane, C); });
  pane.addEventListener("click", e => { const b = e.target.closest(".pg-del"); if (!b || b.disabled) return; const C = pane.__pgc, t = pane.querySelector("table.pg-t");
    const del = new Set([...t.querySelectorAll(".pg-cb:checked")].map(x => +x.closest("tr").dataset.i));
    svConfirm({ title: "SUPPRIMER LES LIGNES COCHÉES", text: del.size + " LIGNE(S) SUPPRIMÉE(S).", ok: "SUPPRIMER" }).then(go => { if (!go) return; sviPgLSave(C.k, sviPgL(C.k).filter((x, i) => !del.has(i))); if (C.after) C.after(); sviPgTable(pane, C); }); });
}
/* ---------- tableau pliable (LIEUX, BANQUES) : éléments { id, p (parent), lab, … } ---------- */
function sviPgTree(pane, c) {
  const L = sviPgL(c.k), kids = id => L.filter(x => (x.p || "") === id), fold = (() => { try { return JSON.parse(sessionStorage.getItem("svi_pgfold_" + c.k) || "{}"); } catch (e) { return {}; } })();
  const rows = [], walk = (p, lv) => { kids(p).forEach(x => { const n = kids(x.id).length, lf = c.levels[lv];
      rows.push(`<tr data-id="${esc(x.id)}" data-lv="${lv}" class="pg-lv${lv}">${lf.cols.map((f, j) => j === 0
        ? `<td><span class="pg-ind" style="width:${lv * 20}px"></span>${lv < c.levels.length - 1 ? `<button type="button" class="pg-fold" data-fold="${esc(x.id)}">${fold[x.id] ? "›" : "⌄"}</button>` : `<span class="pg-fold-sp"></span>`}<input class="prm-in pg-tin" data-f="${f[0]}" value="${esc(x[f[0]] ?? "")}" autocomplete="off">${lv < c.levels.length - 1 ? svCnt(n) : ""}</td>`
        : f[3] === "skip" ? `<td></td>` : f[3] === "btn" ? `<td><button type="button" class="ach-link pg-btn" data-f="${f[0]}">${esc(f[4](x))}</button></td>`
        : f[3] === "sel" ? `<td><select class="pg-tin" data-f="${f[0]}"><option value=""></option>${f[4]().map(o => `<option value="${esc(o[0])}"${String(x[f[0]] || "") === String(o[0]) ? " selected" : ""}>${esc(o[1])}</option>`).join("")}</select></td>`
        : `<td class="${f[3] === "num" ? "center" : ""}"><input class="prm-in pg-tin${f[3] === "num" ? " center" : ""}" data-f="${f[0]}" value="${esc(x[f[0]] ?? "")}" autocomplete="off"></td>`).join("")}${"<td></td>".repeat(Math.max(0, c.ncol - (lf.cols.length - 1)))}<td class="center"><input type="checkbox" class="pg-cb"></td></tr>`);
      if (lv < c.levels.length - 1 && !fold[x.id]) { walk(x.id, lv + 1); rows.push(`<tr class="prm-new pg-tnew" data-p="${esc(x.id)}" data-lv="${lv + 1}"><td><span class="pg-ind" style="width:${(lv + 1) * 20 + 22}px"></span><input class="prm-in pg-tin" data-f="${c.levels[lv + 1].cols[0][0]}" placeholder="${esc(c.levels[lv + 1].newLab)}" autocomplete="off"></td>${"<td></td>".repeat(c.ncol + 1)}</tr>`); } }); };
  walk("", 0);
  rows.push(`<tr class="prm-new pg-tnew" data-p="" data-lv="0"><td><span class="pg-ind" style="width:22px"></span><input class="prm-in pg-tin" data-f="${c.levels[0].cols[0][0]}" placeholder="${esc(c.levels[0].newLab)}" autocomplete="off"></td>${"<td></td>".repeat(c.ncol + 1)}</tr>`);
  pane.innerHTML = `<table class="prm-table pg-t pg-tree" data-pgk="${c.k}"><colgroup><col style="width:360px">${c.heads.slice(1).map(h => `<col style="width:${h[1]}px">`).join("")}<col style="width:44px"></colgroup>
    <thead><tr>${c.heads.map(h => `<th>${esc(h[0])}</th>`).join("")}<th class="center"><input type="checkbox" class="pg-all" aria-label="Tout cocher"></th></tr></thead><tbody>${rows.join("")}</tbody></table>
    <div class="prm-foot"><button type="button" class="prm-del pg-del" disabled>SUPPRIMER LES LIGNES COCHÉES <span class="svi-cnt">0</span></button></div>`;
  if (pane.__pgt) return; pane.__pgt = true;
  pane.addEventListener("click", e => { const C = pane.__pgc; const pb = e.target.closest(".pg-btn"); if (pb) { const tr = pb.closest("tr"), x = sviPgL(C.k).find(y => y.id === tr.dataset.id), f = (C.levels[+tr.dataset.lv].cols.find(c => c[0] === pb.dataset.f) || []); if (x && f[5]) f[5](x, pb); return; }
    const fb = e.target.closest(".pg-fold"); if (fb) { let F = {}; try { F = JSON.parse(sessionStorage.getItem("svi_pgfold_" + C.k) || "{}"); } catch (er) {} F[fb.dataset.fold] = !F[fb.dataset.fold]; try { sessionStorage.setItem("svi_pgfold_" + C.k, JSON.stringify(F)); } catch (er) {} sviPgTree(pane, C); return; }
    const b = e.target.closest(".pg-del"); if (!b || b.disabled) return; const ids = [...pane.querySelectorAll(".pg-cb:checked")].map(x => x.closest("tr").dataset.id), L2 = sviPgL(C.k), all = new Set(ids);
    let more = true; while (more) { more = false; L2.forEach(x => { if (x.p && all.has(x.p) && !all.has(x.id)) { all.add(x.id); more = true; } }); }
    svConfirm({ title: "SUPPRIMER LES LIGNES COCHÉES", text: all.size + " LIGNE(S) SUPPRIMÉE(S), AVEC CE QU'ELLES CONTIENNENT.", ok: "SUPPRIMER" }).then(go => { if (!go) return; sviPgLSave(C.k, L2.filter(x => !all.has(x.id))); sviPgTree(pane, C); }); });
  pane.addEventListener("change", e => { const C = pane.__pgc;
    if (e.target.matches(".pg-all")) pane.querySelectorAll(".pg-cb").forEach(x => { x.checked = e.target.checked; });
    if (e.target.matches(".pg-cb, .pg-all")) { const n = pane.querySelectorAll(".pg-cb:checked").length, b = pane.querySelector(".pg-del"); b.disabled = !n; b.querySelector(".svi-cnt").textContent = n; return; }
    const i = e.target.closest(".pg-tin"); if (!i) return; const tr = i.closest("tr"), L2 = sviPgL(C.k), lv = +tr.dataset.lv, f = i.dataset.f, col = C.levels[lv].cols.find(x => x[0] === f) || [f, f, 0, ""];
    const v = i.tagName === "SELECT" ? i.value : sviPgU(i.value);
    if (col[3] === "num" && v && !/^\d+$/.test(v)) { svToast(col[1] + " : CHIFFRES SEULEMENT.", 2500, i); sviPgTree(pane, C); return; }
    if (col[5] && v && v.length !== col[5]) { svToast(col[1] + " : " + col[5] + " CHIFFRES.", 2500, i); sviPgTree(pane, C); return; }
    if (tr.classList.contains("pg-tnew")) { if (!v) return; const p = tr.dataset.p;
      if (f === "lab" && L2.some(x => (x.p || "") === p && sviPgU(x.lab) === v)) { svToast("DÉJÀ DANS LA LISTE.", 2500, i); return; }
      L2.push({ id: sviPgId(), p, [f]: v }); }
    else { const x = L2.find(y => y.id === tr.dataset.id); if (!x) return; if (f === "lab" && L2.some(y => y !== x && (y.p || "") === (x.p || "") && sviPgU(y.lab) === v)) { svToast("DÉJÀ DANS LA LISTE.", 2500, i); sviPgTree(pane, C); return; } x[f] = v; }
    sviPgLSave(C.k, L2); sviPgTree(pane, C); });
}
/* ---------- onglets ---------- */
/* 05/11 : un seul écran PARAMÉTRAGE, avec une rangée de GROUPES (GÉNÉRAL, ACHATS, ARTICLES, PERSONNEL…) puis les onglets du groupe ;
   les onglets marqués « ach » sont dessinés par le module ACHATS (41 : view.__prmMount) */
const SVI_PG_GRP = [["gen", "GÉNÉRAL"], ["ach", "ACHATS"], ["art", "ARTICLES"], ["pers", "PERSONNEL"]];
const SVI_PG_TABS = [
  { k: "gen", lab: "GÉNÉRAL", sub: "RÉGLAGES PONCTUELS DE TOUTE L'APPLICATION" },
  { k: "soc", lab: "SOCIÉTÉ", sub: "IDENTITÉ DE LA SOCIÉTÉ (EN-TÊTE DES PIÈCES IMPRIMÉES)" },   /* C8 : SOCIÉTÉ dans son propre onglet, après GÉNÉRAL (B6) */
  { k: "unit", g: "art", lab: "UNITÉS", sub: "" }, { k: "lib", g: "art", lab: "BIBLIOTHÈQUE DE PRIX", sub: "" },
  { k: "cal", lab: "CALENDRIER", sub: "JOURS NON TRAVAILLÉS DE TOUTE LA SOCIÉTÉ (FÉRIÉS, GRÈVE, DEUIL NATIONAL, ÉVÉNEMENT…)" },
  { k: "lieux", lab: "LIEUX", sub: "PAYS › RÉGION › VILLE (ADRESSES, TRANSPORT, AGENCES BANCAIRES)" },
  { k: "banq", lab: "BANQUES", sub: "BANQUES ET AGENCES, COMMUNES À TOUTE L'APPLICATION" },
  { k: "cpt", lab: "COMPTABILITÉ", sub: "COMPTES (CODE, INTITULÉ), UTILISÉS PAR TOUTE L'APPLICATION" },
  { k: "grades", g: "pers", lab: "GRADES", sub: "GRADE 1 = DIRECTEUR GÉNÉRAL (MODULE PERSONNEL PLUS TARD)" },
  { k: "gprod", g: "art", lab: "GROUPES DE PRODUCTIVITÉ", sub: "GROUPES DES ARTICLES (MODULE PRODUCTIVITÉ PLUS TARD)" },
  { k: "gexp", g: "art", lab: "GROUPES D'EXPLOITATION", sub: "GROUPES DES ARTICLES (MODULE EXPLOITATION PLUS TARD)" },
  { k: "dev", lab: "DEVISES", sub: "LE DIRHAM PAR DÉFAUT ; LES AUTRES POUR L'IMPORT" },
  { k: "ref", ach: "ref", lab: "RÉFÉRENCES", sub: "FORMAT DES RÉFÉRENCES DES PIÈCES" },
  { k: "cat", g: "art", ach: "cat", lab: "CATÉGORIES", sub: "FAMILLES D'ARTICLES" },
  { k: "aregl", g: "ach", ach: "regl", lab: "RÈGLES INTERNES", sub: "" }, { k: "aalr", g: "ach", ach: "alr", lab: "ALERTES DE RETARD", sub: "" },
  { k: "ament", g: "ach", ach: "ment", lab: "MENTIONS IMPRIMÉES", sub: "" }, { k: "acla", g: "ach", ach: "cla", lab: "CLAUSES", sub: "" },
  { k: "ftypes", g: "ach", lab: "TYPES DE FOURNISSEURS", sub: "MÉTIER DU FOURNISSEUR, CHOISI SUR SA FICHE" }
].map(T => ({ g: "gen", ...T }));
const SVI_PG_ORD = "svi_pgord_v1";
const sviPgTabs = () => { let o = []; try { o = JSON.parse(localStorage.getItem(SVI_PG_ORD) || "[]") || []; } catch (e) {} const ks = SVI_PG_TABS.map(t => t.k);
  return o.filter(k => ks.includes(k)).concat(ks.filter(k => !o.includes(k))).map(k => SVI_PG_TABS.find(t => t.k === k)); };
const SVI_PG_CAL_M = [["FÉRIÉ", "FÉRIÉ"], ["GRÈVE", "GRÈVE"], ["DEUIL NATIONAL", "DEUIL NATIONAL"], ["ÉVÉNEMENT", "ÉVÉNEMENT"], ["AUTRE", "AUTRE"]];
function sviPgDraw(k, pane) {
  pane.__pgc = null;
  if (k === "gen") { const tv = sviTvaDef(), km = sviTrKm(), G = sviPg().gen || {}, D = sviPgL("devises");
    pane.innerHTML = `<table class="prm-table pg-gen"><colgroup><col style="width:440px"><col style="width:200px"></colgroup><thead><tr><th>RÉGLAGE</th><th class="center">VALEUR</th></tr></thead><tbody>
      <tr><td>PRIX DU TRANSPORT AU KILOMÈTRE (DH / KM)</td><td class="center"><input class="ins-in trk-km pg-gv number" data-g="km" inputmode="decimal" value="${km === null ? "" : esc(String(km).replace(".", ","))}"></td></tr>
      <tr><td>FUSEAU HORAIRE</td><td class="center"><select class="pg-gv" data-g="tz">${["-1", "0", "+1", "+2"].map(z => `<option value="${z}"${(G.tz || "+1") === z ? " selected" : ""}>GMT ${z === "0" ? "" : z}</option>`).join("")}</select></td></tr>
      <tr><td>DEVISE PAR DÉFAUT</td><td class="center">${esc((D.find(x => x.def) || D[0] || {}).code || "MAD")}</td></tr></tbody></table>`;
    pane.querySelectorAll(".pg-gv").forEach(i => i.closest("tr").cells[0].dataset.tip = { tva: "COMMUNE AU BUDGET ET AUX ACHATS ; VIDE : UNE DÉSIGNATION SANS TVA NE PEUT PAS ÊTRE ENREGISTRÉE", km: "DISTANCE À VOL D'OISEAU ENTRE LE DÉPÔT DU FOURNISSEUR ET LE CHANTIER", tz: "DÉCALAGE PAR RAPPORT À GMT : HEURE AFFICHÉE ET ENREGISTRÉE PAR L'APPLICATION" }[i.dataset.g] || "");
    return; }
  if (k === "soc") { pane.innerHTML = sviPgSocHTML(); return; }
  return sviPgDraw2(k, pane);
}
/* E5 (série E, 06/11) : TVA PAR DÉFAUT dans SOCIÉTÉ (plus dans GÉNÉRAL) — toujours commune au budget et aux achats */
/* C8 (série C) : SOCIÉTÉ dans son propre onglet (B6, B7), au format des fiches : intitulés au-dessus des champs */
function sviPgSocHTML() { const S = sviSoc();
  return `<div class="pg-soc-card"><div class="frs-g pg-soc">${SVI_SOC_F.map(([f, l]) => `<label class="frs-f${f === "rs" || f === "adr" ? " frs-w" : ""}"><span>${l}</span><input class="ins-in pg-soc-in" data-f="${f}" value="${esc(S[f] || "")}" autocomplete="off"${f === "mail" ? " data-keepcase" : ""}></label>`).join("")}
      <label class="frs-f"><span data-tip="COMMUNE AU BUDGET ET AUX ACHATS ; VIDE : UNE DÉSIGNATION SANS TVA NE PEUT PAS ÊTRE ENREGISTRÉE">TVA PAR DÉFAUT (%)</span><input class="ins-in tva-def pg-gv number" data-g="tva" data-fam="pct" inputmode="decimal" value="${(() => { const tv = sviTvaDef(); return tv === null ? "" : esc(String(tv).replace(".", ",")); })()}" autocomplete="off"></label>
      <div class="frs-f frs-w"><span>LOGO</span><div class="pg-logo">${S.logo ? `<img src="${esc(S.logo)}" alt="">` : ""}<input type="file" accept="image/*" class="pg-logo-in"></div></div></div></div>`; }
function sviPgDraw2(k, pane) {
  if (k === "cal") { sviPgCalPrev = sviPgOffDays(); pane.__pgc = { k: "cal", newLab: "AJOUTER UN JOUR ICI… (DATE)", cols: [["a", "DU", 160, "date"], ["b", "AU (FACULTATIF)", 160, "date"], ["m", "MOTIF", 200, "sel", () => SVI_PG_CAL_M], ["lab", "INTITULÉ", 320, ""]],
      after: () => sviPgCalImpact() }; sviPgTable(pane, pane.__pgc); pane.insertAdjacentHTML("afterbegin", `<div class="pg-ttl">JOURS NON TRAVAILLÉS DE LA SOCIÉTÉ</div>`);   /* 05/11 : titre du tableau */ return; }
  /* 05/11 : COMPTABILITÉ — classe (1er chiffre du code, plan comptable marocain), compte parent, nature, LETTRABLE ; rangés par code (à détailler plus tard) */
  if (k === "cpt") { const P = () => sviPgL("cpt").map(c => [String(c.code), c.code + " — " + (c.lab || "")]);
    pane.__pgc = { k: "cpt", uniq: "code", newLab: "CRÉER UN COMPTE ICI… (CODE)", cols: [["code", "CODE", 140, "num"], ["lab", "INTITULÉ", 380, ""], ["cls", "CLASSE", 90, "ro", x => SVI_CPT_CLS(x.code)],
      ["p", "COMPTE PARENT", 260, "sel", P], ["nat", "NATURE", 180, "sel", () => SVI_CPT_NAT.map(n => [n, n])], ["lett", "LETTRABLE", 100, "check"]],
      after: () => { const L = sviPgL("cpt").slice().sort((a, b) => String(a.code).localeCompare(String(b.code))); sviPgLSave("cpt", L); } };
    sviPgTable(pane, pane.__pgc); return; }
  if (k === "grades") { pane.__pgc = { k: "grades", uniq: "n", newLab: "CRÉER UN GRADE ICI… (N°)", cols: [["n", "GRADE", 120, "num"], ["lab", "INTITULÉ", 460, ""]] }; sviPgTable(pane, pane.__pgc); return; }
  if (k === "ftypes") { pane.__pgc = { k: "ftypes", uniq: "lab", newLab: "CRÉER UN TYPE ICI…", cols: [["lab", "TYPE", 260, ""], ["pre", "PRÉFIXE DE RÉFÉRENCE", 170, ""], ["docs", "DOCUMENTS EXIGÉS (SÉPARÉS PAR ;)", 420, ""]] }; sviPgTable(pane, pane.__pgc); return; }
  if (k === "gprod" || k === "gexp") { pane.__pgc = { k, uniq: "lab", newLab: "CRÉER UN GROUPE ICI…", cols: [["lab", "GROUPE", 360, ""]] }; sviPgTable(pane, pane.__pgc); return; }
  if (k === "dev") { pane.__pgc = { k: "devises", uniq: "code", one: "def", newLab: "CRÉER UNE DEVISE ICI… (CODE)", cols: [["code", "CODE", 120, ""], ["lab", "DEVISE", 320, ""], ["def", "PAR DÉFAUT", 120, "check"]] }; sviPgTable(pane, pane.__pgc); return; }
  if (k === "lieux") { pane.__pgc = { k: "lieux", ncol: 0, heads: [["PAYS › RÉGION › VILLE", 360]], levels: [{ newLab: "CRÉER UN PAYS ICI…", cols: [["lab", "PAYS"]] }, { newLab: "CRÉER UNE RÉGION ICI…", cols: [["lab", "RÉGION"]] }, { newLab: "CRÉER UNE VILLE ICI…", cols: [["lab", "VILLE"]] }] };
    sviPgTree(pane, pane.__pgc); return; }
  if (k === "banq") { const V = () => sviPgVilles().map(x => [x.id, x.lab]);
    /* 05/11 : banque › agence › MODES DE PAIEMENT de l'agence (chèque, effet, virement…, chacun avec son modèle d'impression) › CARNETS (du n° au n°, feuilles suivies) */
    pane.__pgc = { k: "banques", ncol: 3, heads: [["BANQUE › AGENCE › MODE DE PAIEMENT › CARNET", 360], ["ABRÉVIATION · DU N°", 150], ["CODE · AU N°", 200], ["VILLE · DÉTAIL", 220]],
      levels: [{ newLab: "CRÉER UNE BANQUE ICI…", cols: [["lab", "BANQUE"], ["abr", "ABRÉVIATION"], ["code", "CODE BANQUE", 0, "num", null, 3]] },
        { newLab: "CRÉER UNE AGENCE ICI…", cols: [["lab", "AGENCE"], ["abr", "ABRÉVIATION"], ["code", "CODE AGENCE", 0, "num"], ["ville", "VILLE", 0, "sel", V]] },
        { newLab: "AJOUTER UN MODE DE PAIEMENT ICI… (CHÈQUE, EFFET, VIREMENT…)", cols: [["lab", "MODE DE PAIEMENT"], ["_1", "", 0, "skip"], ["_2", "", 0, "skip"], ["mdl", "MODÈLE D'IMPRESSION", 0, "btn", () => "MODÈLE D'IMPRESSION", (x, b) => sviMdpModel(x)]] },
        { newLab: "AJOUTER UN CARNET ICI… (N° DU CARNET)", cols: [["lab", "CARNET"], ["de", "DU N°", 0, "num"], ["a", "AU N°", 0, "num"], ["fl", "FEUILLES", 0, "btn", x => "FEUILLES (" + sviCarnetUsed(x).length + " UTILISÉES)", (x, b) => sviCarnetWin(x)]] }] };
    sviPgTree(pane, pane.__pgc); return; }
}
/* B38 : changement du calendrier de la société — impact sur chaque projet en cours ; tous cochés, décocher un par un ;
   appliqué dès aujourd'hui aux projets restés cochés (les autres gardent leur calendrier d'avant) */
let sviPgCalPrev = null;
function sviPgCalImpact() {
  const before = sviPgCalPrev || [], now = sviPgOffDays(), today = new Date().toISOString().slice(0, 10);
  sviPgCalPrev = now;
  const added = now.filter(d => !before.includes(d) && d >= today), removed = before.filter(d => !now.includes(d) && d >= today);
  if (!added.length && !removed.length) return;
  let I = []; try { I = sviInstGet().filter(b => b && !b.virtual && b.state !== "valide" && !b.rclOf); } catch (e) {}
  if (!I.length) return;
  const hit = b => { const P = (b.data || {}).dlp || {}; let n = 0; Object.values(P).forEach(L => (L || []).forEach(p => { if ([...added, ...removed].some(d => d >= p.deb && d <= p.fin)) n++; })); return n; };
  const d = sviWinNew();
  d.innerHTML = sviWinCard({ title: "CALENDRIER DE LA SOCIÉTÉ — IMPACT SUR LES PROJETS EN COURS", close: "data-x",
    body: `<div class="svc-sub">${added.length ? added.length + " JOUR(S) NON TRAVAILLÉ(S) AJOUTÉ(S)" : ""}${added.length && removed.length ? " · " : ""}${removed.length ? removed.length + " RETIRÉ(S)" : ""}, À PARTIR D'AUJOURD'HUI. DÉCOCHER LES PROJETS À NE PAS CHANGER.</div>
      <table class="prm-table"><thead><tr><th>PROJET</th><th class="center">PÉRIODES DE TÂCHES TOUCHÉES</th><th class="center"><input type="checkbox" class="pgc-all" checked></th></tr></thead>
      <tbody>${I.map(b => `<tr><td>${esc((b.project || "") + " " + b.ref)}</td><td class="center">${svCnt(hit(b))}</td><td class="center"><input type="checkbox" class="pgc-cb" data-ref="${esc(b.ref)}" checked></td></tr>`).join("")}</tbody></table>`,
    foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>APPLIQUER</button>` });
  sviWinShow(d);
  d.addEventListener("change", e => { if (e.target.matches(".pgc-all")) d.querySelectorAll(".pgc-cb").forEach(x => { x.checked = e.target.checked; }); });
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) { /* aucun projet changé : chacun garde le calendrier d'avant */
      const L0 = sviInstGet(); L0.forEach(b => { if (I.some(x => x.ref === b.ref) && b.data && !b.data.cal) b.data.cal = { we: SVI_CAL_DEF.we.slice(), off: before.slice(), on: [] }; }); sviInstSet(L0); try { sviInstFlush(); } catch (er) {} d.remove(); return; }
    if (!e.target.closest("[data-ok]")) return;
    const on = new Set([...d.querySelectorAll(".pgc-cb:checked")].map(x => x.dataset.ref)), L = sviInstGet();
    L.forEach(b => { if (!I.some(x => x.ref === b.ref)) return; const D = b.data || (b.data = {});
      if (on.has(b.ref)) { if (D.cal) { const off = new Set(D.cal.off || []); added.forEach(x => off.add(x)); removed.forEach(x => off.delete(x)); D.cal.off = [...off].sort(); } }
      else if (!D.cal) D.cal = { we: SVI_CAL_DEF.we.slice(), off: before.slice(), on: [] }; });
    sviInstSet(L); try { sviInstFlush(); } catch (er) {} d.remove(); svToast("CALENDRIER APPLIQUÉ À " + on.size + " PROJET(S).", 3000); });
}

/* 05/11 : MODES DE PAIEMENT et CARNETS — modèle d'impression (aperçu MISE EN PAGE : montant en chiffres et en lettres, bénéficiaire, date, à placer
   et ajuster jusqu'à ce que l'impression tombe juste), carnets du n° au n° et suivi de chaque feuille (utilisée et pour quel paiement, abîmée, erronée) */
const sviCarnetNums = x => { const a = parseInt(x.de, 10), b = parseInt(x.a, 10); if (!(a >= 0) || !(b >= a)) return []; const L = []; for (let n = a; n <= b && L.length < 500; n++) L.push(n); return L; };
const sviCarnetUsed = x => { if (typeof achPaf !== "function") return []; const N = new Set(sviCarnetNums(x).map(String));
  return achPaf().filter(p => p.state !== "annule" && N.has(String(parseInt(String(p.num || "").replace(/\D/g, ""), 10)))); };
const sviCarnetOf = num => { const n = parseInt(String(num || "").replace(/\D/g, ""), 10); if (!(n >= 0)) return null; return sviPgL("banques").find(x => x.de !== undefined && sviCarnetNums(x).includes(n)) || null; };
function sviMdpModel(x, P) { P = P || {}; const ag = sviPgL("banques").find(y => y.id === x.p) || {}, bq = sviPgL("banques").find(y => y.id === ag.p) || {};
  sviMep.open({ key: "MDP-" + x.id, title: P.title || x.lab, ref: P.ref || "", party: P.party || "BÉNÉFICIAIRE", date: P.date || new Date().toLocaleDateString("fr-FR"), rows: [], cols: [], prelim: false,
    fields: { ttc: P.ttc || "1 234,56", lettres: P.lettres || "MILLE DEUX CENT TRENTE-QUATRE DIRHAMS ET CINQUANTE-SIX CENTIMES", projet: (bq.lab || "") + " — " + (ag.lab || "") },
    name: (P.ref || x.lab) + " " + (bq.abr || bq.lab || ""), save: async () => "" }); }
function sviCarnetWin(x) { const used = new Map(sviCarnetUsed(x).map(p => [String(parseInt(String(p.num).replace(/\D/g, ""), 10)), p])), d = sviWinNew(), ST = [["", "LIBRE"], ["abime", "ABÎMÉE"], ["errone", "ERRONÉE"]];
  const draw = () => { const fl = x.fl || {};
    d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: "CARNET " + esc(x.lab || "") + " — FEUILLES " + esc(x.de || "") + " À " + esc(x.a || ""),
      body: `<div class="frs-scroll"><table class="prm-table frs-sub"><thead><tr><th class="center">N°</th><th>ÉTAT</th><th>PAIEMENT</th></tr></thead><tbody>${sviCarnetNums(x).map(n => { const p = used.get(String(n));
        return `<tr><td class="center">${n}</td><td>${p ? "UTILISÉE" : `<select class="pg-fl" data-n="${n}">${ST.map(([k, l]) => `<option value="${k}"${(fl[n] || "") === k ? " selected" : ""}>${l}</option>`).join("")}</select>`}</td><td>${p ? esc((p.ref || "") + " · " + (typeof achFrsNom === "function" ? achFrsNom(p.frs) : "")) : ""}</td></tr>`; }).join("") || `<tr><td colspan="3" class="empty">DONNER LE PREMIER ET LE DERNIER N°</td></tr>`}</tbody></table></div>`,
      foot: `<button type="button" class="svc-b" data-x>FERMER</button>` });
    if (!d.isConnected) sviWinShow(d); };
  draw();
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) d.remove(); });
  d.addEventListener("change", e => { const s = e.target.closest(".pg-fl"); if (!s) return; const L = sviPgL("banques"), y = L.find(z => z.id === x.id); if (!y) return; y.fl = { ...(y.fl || {}) }; if (s.value) y.fl[s.dataset.n] = s.value; else delete y.fl[s.dataset.n]; sviPgLSave("banques", L); x.fl = y.fl; });
}
/* ⟪ src/35-calendrier-saisie.js ⟫ */
/* =========================================================
   CALENDRIER DE L'APPLICATION (FORMAT 76) : toutes les dates se choisissent dans un calendrier ;
   affichage JJ/MM/AAAA ; les dates refusées sont grisées.
   - champs « date » (ex. type=date) : convertis, .value garde la date AAAA-MM-JJ
   - DÉTAIL DÉLAIS : DÉBUT / FIN (dates hors règles grisées : fin avant début, chevauchement)
   ========================================================= */
const SVI_VAL = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
const SVI_MOIS = ["JANVIER", "FÉVRIER", "MARS", "AVRIL", "MAI", "JUIN", "JUILLET", "AOÛT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DÉCEMBRE"];
const sviIsoOf = dt => dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
function sviDateField(el) {
  if (el.__svDate) return;
  el.__svDate = true;
  const iso0 = SVI_VAL.get.call(el);
  el.type = "text";
  el.readOnly = true;
  el.setAttribute("inputmode", "none");
  el.classList.add("sv-date");
  if (!el.placeholder) el.placeholder = "JJ/MM/AAAA";
  Object.defineProperty(el, "value", {
    configurable: true,
    get() { return el.dataset.iso || ""; },
    set(v) {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
      el.dataset.iso = m ? m[0] : "";
      SVI_VAL.set.call(el, m ? m[3] + "/" + m[2] + "/" + m[1] : "");
    }
  });
  el.value = iso0;
}
function sviCal(anchor, { iso = "", dis = null, onPick, why = "" }) {
  document.getElementById("svCal")?.remove();
  const box = document.createElement("div");
  box.id = "svCal";
  box.__for = anchor; box.__t = Date.now();
  const today = sviIsoOf(new Date());
  let cur = iso ? new Date(iso + "T00:00:00") : new Date();
  if (isNaN(cur)) cur = new Date();
  cur.setDate(1);
  const draw = () => {
    const y = cur.getFullYear(), m = cur.getMonth();
    const first = (new Date(y, m, 1).getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate();
    let cells = "";
    for (let i = 0; i < first; i++) cells += "<span></span>";
    for (let day = 1; day <= n; day++) {
      const di = sviIsoOf(new Date(y, m, day));
      const off = dis ? dis(di) : false;
      cells += `<button type="button" data-d="${di}" class="${di === iso ? "on" : ""}${di === today ? " td" : ""}"${off ? " disabled" : ""}>${day}</button>`;
    }
    box.innerHTML = `<div class="svcal-h"><button type="button" data-m="-1" aria-label="Mois précédent">‹</button><b>${SVI_MOIS[m]} ${y}</b><button type="button" data-m="1" aria-label="Mois suivant">›</button><button type="button" class="svcal-x" data-x aria-label="Fermer">✕</button></div>
      <div class="svcal-w"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
      <div class="svcal-g">${cells}</div>${why ? `<div class="svcal-why">${esc(why)}</div>` : ""}`;
  };
  draw();
  document.body.appendChild(box);
  const r = anchor.getBoundingClientRect(), h = box.offsetHeight, w = box.offsetWidth;
  box.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + "px";
  box.style.top = (r.bottom + 6 + h <= sviViewH() - 8 ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + "px";
  const close = () => { box.remove(); document.removeEventListener("pointerdown", out, true); };
  const out = e => { if (!box.contains(e.target) && e.target !== anchor) close(); };
  setTimeout(() => document.addEventListener("pointerdown", out, true), 0);
  box.addEventListener("click", e => {
    e.stopPropagation();
    const mb = e.target.closest("[data-m]");
    if (mb) { cur.setMonth(cur.getMonth() + Number(mb.dataset.m)); draw(); return; }
    if (e.target.closest("[data-x]")) { close(); return; }
    const db = e.target.closest("[data-d]");
    if (!db || db.disabled) return;
    close();
    onPick && onPick(db.dataset.d);
  });
}
/* ouverture : toucher (ou arrivée du curseur) sur un champ date */
function sviCalOpen(el) {
  if (!el || el.disabled) return;
  const ex = document.getElementById("svCal");
  /* v618 (remarque 89) : DÉBUT / FIN du planning — 2e toucher, calendrier ouvert = saisie au clavier (17/10, 17 10 26…) */
  if (ex && ex.__for === el) { if (el.matches("input.dlp-in[data-f=deb], input.dlp-in[data-f=fin]") && Date.now() - (ex.__t || 0) > 450) sviDateType(el, ex); return; }
  if (el.__typing) return;
  if (el.classList.contains("sv-date")) {
    const mn = el.getAttribute("min") || "", mx = el.getAttribute("max") || "";
    sviCal(el, { iso: el.value, dis: d => (mn && d < mn) || (mx && d > mx), onPick: d => {
      el.value = d;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } });
    return;
  }
  if (el.matches("input.dlp-in[data-f=deb], input.dlp-in[data-f=fin]") && window.__sviDlyCal) {
    const o = window.__sviDlyCal(el);
    if (!o) return;
    sviCal(el, { iso: o.iso, dis: o.dis, why: o.why, onPick: d => {
      let t = el;
      if (!t.isConnected) t = document.querySelector(`${el.classList.contains("dlw-in") ? "#dlyAddW " : ""}input.dlp-in[data-task="${CSS.escape(el.dataset.task || "")}"][data-f="${el.dataset.f}"]`) || el;
      SVI_VAL.set.call(t, d.slice(8, 10) + "/" + d.slice(5, 7) + "/" + d.slice(0, 4));
      t.dispatchEvent(new Event("change", { bubbles: true }));
    } });
  }
}
/* v736 : DÉBUT / FIN du PLANNING comme les autres cases — 1er toucher = case sélectionnée (cadre), 2e toucher ou Entrée = calendrier */
const sviDlyDate = el => !!(el && el.matches && el.matches(".dly-table input.dlp-in[data-f=deb], .dly-table input.dlp-in[data-f=fin]"));
let SVI_DD_WAS = null;
document.addEventListener("pointerdown", e => { const el = e.target.closest && e.target.closest("input.dlp-in[data-f=deb], input.dlp-in[data-f=fin]"); SVI_DD_WAS = el && (document.activeElement === el || (window.sviCellOf && window.sviCellOf(document.activeElement) === el.closest("td"))) ? el : null; }, true);
document.addEventListener("click", e => {
  const el = e.target.closest && e.target.closest("input.sv-date, input.dlp-in[data-f=deb], input.dlp-in[data-f=fin]");
  if (!el) return;
  if (sviDlyDate(el) && SVI_DD_WAS !== el && !document.getElementById("svCal")) { SVI_DD_WAS = el; return; }
  sviCalOpen(el);
});
document.addEventListener("focusin", e => {
  const el = e.target.closest && e.target.closest("input.sv-date, input.dlp-in[data-f=deb], input.dlp-in[data-f=fin]");
  if (el && !sviDlyDate(el)) setTimeout(() => { if (document.activeElement === el) sviCalOpen(el); }, 0);
});
document.addEventListener("keydown", e => { const el = e.target; if (e.key === "Enter" && sviDlyDate(el) && !document.getElementById("svCal")) { e.preventDefault(); e.stopPropagation(); sviCalOpen(el); } }, true);
/* tout champ date ajouté à l'écran passe au calendrier de l'application */
(() => {
  const up = root => (root.querySelectorAll ? root.querySelectorAll('input[type="date"]') : []).forEach(sviDateField);
  const mo = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) { if (n.matches && n.matches('input[type="date"]')) sviDateField(n); else up(n); } })));
  const go = () => { up(document); mo.observe(document.body, { childList: true, subtree: true }); };
  if (document.body) go(); else document.addEventListener("DOMContentLoaded", go);
})();


/* =========================================================
   FORMAT 93 : Entrée et Tab = case saisissable suivante (Maj + Tab = précédente), partout ;
   cases grisées sautées ; dans une fenêtre, Entrée ne valide jamais toute seule ;
   IMPORT NON CRÉÉ : case encadrée (fautive) suivante
   ========================================================= */
/* v491 (remarque 5) : dans les tableaux, comme Excel / Google Sheets — Tab = case à droite, Entrée = case du dessous
   (dans la colonne où la suite de Tab a commencé ; s'il n'y a pas de ligne dessous, case suivante comme avant),
   Maj + Entrée = au-dessus ; flèches haut / bas = ligne voisine, gauche / droite = case voisine au bord du texte */
let sviTabStart = null;
const sviGridBox = el => el.closest("table.ins-table, table.dly-table, table.prm-table");
const sviGridOk = x => x && x.offsetParent !== null && !x.disabled && !x.readOnly && !x.matches('[type="checkbox"], [type="radio"], [type="file"], [type="hidden"]');
const sviGridCell = (tr, ci, dir) => {
  for (let t = dir > 0 ? tr.nextElementSibling : tr.previousElementSibling; t; t = dir > 0 ? t.nextElementSibling : t.previousElementSibling) {
    const td = t.cells && t.cells[ci];
    const x = td && [...td.querySelectorAll("input, select, textarea")].find(sviGridOk);
    if (x) return x;
  }
  return null;
};
const sviGo = nx => { try { window.__sviLastGo = { k: window.sviCellKey ? window.sviCellKey(nx) : null, t: performance.now() }; } catch (e) {} nx.focus(); try { if (nx.matches("input:not(.sv-date):not(.dlp-in)") && !nx.classList.contains("svi-nav")) nx.select(); } catch (err) {} sviKeepVisible(nx); };
/* v497 (remarques 30 et 33) : les flèches sont gérées par le mode « case sélectionnée » (comme Google Sheets), plus bas */
document.addEventListener("keydown", e => {
  if (e.key !== "Enter" && e.key !== "Tab") return;
  const el = e.target;
  if (!el || !el.matches || !el.matches("input, select, textarea.ins-in")) return;
  if (el.matches('[type="checkbox"], [type="radio"], [type="file"], .cf-q') || el.closest("#cfMenu, #svCal")) return;
  if (el.closest(".ins-hcol .ins-li")) return;   /* v512 : listes du bloc TÂCHES — gérées par le mécanisme commun (Entrée = dessous) */
  /* tableaux : Entrée descend */
  { const box = sviGridBox(el), td = el.closest("td"), tr = el.closest("tr");
    if (box && td && tr) {
      if (e.key === "Tab") { if (!sviTabStart || sviTabStart.tr !== tr) sviTabStart = { tr, ci: td.cellIndex }; }
      else {
        const ci = sviTabStart && sviTabStart.tr === tr ? sviTabStart.ci : td.cellIndex;
        sviTabStart = null;
        /* v523 (remarque 2) : Entrée = la ligne JUSTE en dessous, même si sa case est grisée (titre de charges regroupées,
           cumul…) — elle est alors sélectionnée (copie possible), et Entrée continue de descendre ligne par ligne */
        { const c0 = tr.cells[ci], cc = c0 && sviCellOf(c0);
          if (cc && cc.tagName === "TD" && window.__sviGrid) {
            const nt = sviNear(cc, e.shiftKey ? -1 : 1, 0);
            if (nt) {
              e.preventDefault();
              /* la case visée est notée AVANT de quitter la case (la valeur changée redessine le tableau tout de suite) */
              const ni = sviCellInput(nt);
              try { window.__sviLastGo = { k: sviCellKey(ni && !ni.readOnly && !ni.disabled ? ni : nt), t: performance.now() }; } catch (err) {}
              window.__sviGrid.go(nt); return;
            }
          } }
        const nx = sviGridCell(tr, ci, e.shiftKey ? -1 : 1);
        if (nx) { e.preventDefault(); sviGo(nx); return; }
        if (e.shiftKey) { e.preventDefault(); return; }
      }
    } }
  const back = e.key === "Tab" && e.shiftKey;
  const ok = x => x.offsetParent !== null && !x.disabled && !(x.readOnly && !x.classList.contains("sv-date") && !x.classList.contains("dlp-in")) && !x.matches('[type="checkbox"], [type="radio"], [type="file"], [type="hidden"]');
  let list = null;
  const inc = el.closest(".inc-table");
  if (inc) {
    list = [...inc.querySelectorAll("td.inc-bad input.inc-in")].filter(ok);
    if (!list.includes(el)) list = [...inc.querySelectorAll("input.inc-in")].filter(x => ok(x) && (x === el || x.closest("td.inc-bad")));
  } else {
    const box = el.closest("table.ins-table, .ins-hcol, .dly-table, .prm-table, .svc-card, .doc-card, .blk-card, .modal-card, form, #docPop, .view");
    if (!box) return;
    list = [...box.querySelectorAll("input, select, textarea")].filter(x => x === el || ok(x));
  }
  const i = list.indexOf(el);
  const nx = list[i + (back ? -1 : 1)];
  e.preventDefault();
  if (!nx) return;
  if (inc) { const tr = nx.closest("tr[data-inc]"); const sh = inc.closest(".novapp-list-shell") || document.body; sh.__incNext = { id: tr && tr.dataset.inc, f: nx.dataset.f, t: Date.now() }; }
  try { window.__sviLastGo = { k: window.sviCellKey ? window.sviCellKey(nx) : null, t: performance.now() }; } catch (e) {}
  nx.focus();
  try { if (nx.matches("input:not(.sv-date):not(.dlp-in)") && !nx.classList.contains("svi-nav")) nx.select(); } catch (err) {}
  sviKeepVisible(nx);
}, true);
/* v491 (remarque 1) : la case où l'on saisit reste visible — si elle est cachée (bas du tableau, clavier de l'iPad),
   le tableau remonte juste assez ; si elle est déjà visible, rien ne bouge */
/* v497 (remarque 30) : la case reste visible partout — dans le tableau (jamais sous l'en-tête ni sous la ligne TOTAL fixées),
   puis dans la page (au-dessus du clavier ou de la barre de raccourcis de l'iPad) */
const sviKeepVisible = el => {
  if (!el || !el.isConnected || el.offsetParent === null) return;
  const td = (el.closest && el.closest("td, th")) || el;
  let sc = td.parentElement;
  while (sc && sc !== document.body && sc !== document.documentElement) {
    const cs = getComputedStyle(sc);
    if ((/(auto|scroll)/.test(cs.overflowY) && sc.scrollHeight > sc.clientHeight + 1) || (/(auto|scroll)/.test(cs.overflowX) && sc.scrollWidth > sc.clientWidth + 1)) break;
    sc = sc.parentElement;
  }
  const tbl = td.closest && td.closest("table");
  const stuck = (row, side) => { const c = row && row.cells && row.cells[0]; if (!c) return 0; const cs = getComputedStyle(c); return cs.position === "sticky" ? row.getBoundingClientRect().height : 0; };
  if (sc && sc !== document.body && sc !== document.documentElement) {
    const R = sc.getBoundingClientRect(), r = td.getBoundingClientRect();
    const hd = tbl && tbl.tHead ? [...tbl.tHead.rows].reduce((t, x) => t + stuck(x), 0) : 0;
    const hsb = sc.offsetHeight - sc.clientHeight;
    /* v523 (remarque 1) : bas utile = haut réel de la ligne TOTAL quand elle est dans la zone visible */
    let bot = R.bottom - hsb;
    if (tbl && tbl.tFoot && td.closest("tbody")) { const fr = tbl.tFoot.getBoundingClientRect(); if (fr.height && fr.top < bot && fr.bottom > R.top) bot = Math.min(bot, fr.top); }
    const top = R.top + hd;
    if (r.bottom > bot - 1) sc.scrollTop += r.bottom - bot + 4;
    else if (r.top < top + 1) sc.scrollTop -= top - r.top + 4;
    if (r.width < R.width) { if (r.right > R.right - 1) sc.scrollLeft += r.right - R.right + 6; else if (r.left < R.left + 1) sc.scrollLeft -= R.left - r.left + 6; }
  }
  const vv = window.visualViewport, coarse = matchMedia("(pointer: coarse)").matches;
  const bottom = (vv ? vv.offsetTop + vv.height : window.innerHeight) - (coarse ? 80 : 10);
  let top = vv ? vv.offsetTop : 0;
  const tb = document.querySelector(".topbar");
  if (tb && /sticky|fixed/.test(getComputedStyle(tb).position)) top = Math.max(top, tb.getBoundingClientRect().bottom);
  const r = td.getBoundingClientRect();
  /* v546 (R32) : dans le PLANNING, la page ne glisse pas — c'est le planning qui défile (au-dessus du clavier et de l'histogramme) */
  const dsc = td.closest && td.closest(".dly-scroll");
  if (dsc) {
    const hi = dsc.querySelector("#dlyGantt .ghist"), hb = hi ? hi.getBoundingClientRect().top : 1e9;
    const lim = Math.min(bottom, hb - 4), dt = dsc.getBoundingClientRect().top + 60;
    if (r.bottom > lim) dsc.scrollTop += r.bottom - lim + 8;
    else if (r.top < dt) dsc.scrollTop -= dt - r.top + 8;
    return;
  }
  if (r.bottom > bottom) window.scrollBy(0, r.bottom - bottom + 30);
  else if (r.top < top + 4) window.scrollBy(0, r.top - top - 40);
};
/* v546 (R32) : saisie dans le PLANNING — si l'iPad fait glisser la page en ouvrant le clavier, elle est remise en place */
{
  let Y = null, T = 0;
  document.addEventListener("pointerdown", e => { if (e.target.closest && e.target.closest(".dly-scroll")) { Y = window.scrollY; T = Date.now(); } }, true);
  document.addEventListener("focusin", e => {
    const el = e.target;
    if (Y === null || Date.now() - T > 1500 || !el.closest || !el.closest(".dly-scroll") || !el.matches("input, textarea")) return;
    const y = Y;
    [60, 350, 700].forEach(ms => setTimeout(() => { if (document.activeElement === el && Math.abs(window.scrollY - y) > 2) { window.scrollTo(0, y); sviKeepVisible(el); } }, ms));
  });
}
{
  let raf = 0;
  const SEL = ".ins-table input, .ins-table textarea, .ins-hcol input, .sd-t input, .dly-table input, .qq-table input, .inc-table input, .prm-table input";
  const run = e => { const el = e.target; if (!el || !el.matches || !(el.matches(SEL) || el.matches("td.svi-tdf"))) return; cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setTimeout(() => sviKeepVisible(document.activeElement === el ? el : document.activeElement), 60)); };
  document.addEventListener("focusin", run);
  document.addEventListener("input", run);
}
/* clavier de l'iPad : touche « Suivant » */
document.addEventListener("focusin", e => {
  const el = e.target;
  if (el && el.matches && el.matches("input:not([type=checkbox]):not([type=radio])") && !el.getAttribute("enterkeyhint")) el.setAttribute("enterkeyhint", "next");
});

/* FORMAT 30 : double toucher sur la barre de titre d'un bloc (ou sa rangée d'onglets) = agrandir / réduire ;
   sur le titre d'une grande fenêtre réglable = plein écran / taille mémorisée.
   Jamais sur les boutons, cases, en-têtes de colonnes, en-tête du Gantt ni dans les lignes. */
(() => {
  let last = null;
  document.addEventListener("pointerup", e => {
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest("input, textarea, select, .blk-tools, .cf-btn, [data-onlyc], .col-rs, th, .gh, .blk-grip, .blk-rsz")) { last = null; return; }
    let zone = "", act = null;
    /* v545 (remarque 1) : plus de double toucher sur la barre de titre des blocs (bouton agrandir / réduire visible) */
    /* v785 : retour du double toucher sur la barre de titre d'un bloc (ou sa rangée d'onglets) = AGRANDIR / RÉDUIRE, partout (budget, achats) ;
       le bouton n'est plus dans l'en-tête : la commande est aussi dans le ⋯ du bloc */
    { const head = !t.closest("button, .bdg-d-tab, .rec-tab, [role=button], .svi-cnt, a") && t.closest(".bdg-d-block-title, .blk-tabrow, #bdgDetailHead, #bdgTabs");
      const blk = head && (head.closest(".bdg-d-block") || (head.matches("#bdgDetailHead, #bdgTabs") ? head : null));
      const mx = blk && (blk.querySelector(".blk-max-btn, [data-nvmax]") || (head.matches("#bdgDetailHead, #bdgTabs") ? document.querySelector('#bdgDetailHead .blk-max-btn') : null));
      if (mx) { zone = "b"; act = () => mx.click(); } }
    if (!zone) {
      const tt = t.closest(".svc-card .svc-t"), card = tt && tt.closest(".svc-card");
      if (card && card.querySelector('[class$="-rsz"]')) { zone = "w"; act = () => card.classList.toggle("svc-full"); }
    }
    if (!zone) { last = null; return; }
    const now = Date.now();
    if (last && last.zone === zone && now - last.t < SVI_G.dbl && Math.abs(e.clientX - last.x) < 30 && Math.abs(e.clientY - last.y) < 30) { last = null; act(); }
    else last = { zone, t: now, x: e.clientX, y: e.clientY };
  });
})();

/* =========================================================
   FORMAT 17 dans les fenêtres PRÉDÉCESSEURS et AJOUTER UNE TÂCHE (16/10/2026) :
   poignée au bord droit de chaque en-tête — LOT = largeur des deux volets ; ACTIVITÉ SECONDAIRE,
   TYPE, DÉCALAGE (J) = largeur de la colonne (le volet défile s'il devient trop large) ; mémorisé
   ========================================================= */
const SVI_DPK_COLS = "svi_dpk_cols_v1";
function sviDpkColsGet() { try { return JSON.parse(localStorage.getItem(SVI_DPK_COLS) || "{}") || {}; } catch (e) { return {}; } }
function sviDpkCols(root) {
  const W = sviDpkColsGet();
  const cols = root.querySelector(".dpk-cols");
  if (cols && W.split) cols.style.gridTemplateColumns = W.split + "px minmax(160px, 1fr)";
  const t = root.querySelectorAll(".dpk-t")[1];
  if (!t) return;
  const ths = [...t.querySelectorAll("thead th")];
  const pre = root.id === "dlyAddW" ? "a_" : "p_";
  const keyOf = th => pre + (th.querySelector('.col-rs[data-rs="dpk_sec"]') ? "sec" : th.classList.contains("dpk-ty") ? "ty" : th.classList.contains("dpk-of") ? "of" : "x");
  if (!ths.some(th => W[keyOf(th)])) return;
  let total = 0;
  ths.forEach(th => {
    const k = keyOf(th), w = W[k] || (k === pre + "sec" ? 0 : th.getBoundingClientRect().width || 36);
    if (k === pre + "sec" && !w) { th.style.width = ""; return; }
    th.style.width = w + "px"; total += w;
  });
  if (ths.every(th => th.style.width)) t.style.setProperty("width", total + "px", "important");
}
document.addEventListener("pointerdown", e => {
  const h = e.target.closest && e.target.closest(".dpk-card .col-rs");
  if (!h) return;
  e.preventDefault(); e.stopPropagation();
  const root = h.closest("#svConf, #dlyAddW"), rs = h.dataset.rs, x0 = e.clientX;
  const W = sviDpkColsGet();
  const cols = root.querySelector(".dpk-cols");
  const t = h.closest("table"), th = h.closest("th");
  h.classList.add("on");
  let apply;
  if (rs === "dpk_lot") {
    const w0 = root.querySelector(".dpk-col").getBoundingClientRect().width, cw = cols.getBoundingClientRect().width;
    apply = x => { W.split = Math.round(Math.max(120, Math.min(cw - 170, w0 + x - x0))); cols.style.gridTemplateColumns = W.split + "px minmax(160px, 1fr)"; };
  } else {
    const pre = root.id === "dlyAddW" ? "a_" : "p_";
    const k = pre + (rs === "dpk_sec" ? "sec" : rs === "dpk_ty" ? "ty" : "of");
    /* largeurs actuelles figées, puis la colonne tirée change seule */
    const ths = [...t.querySelectorAll("thead th")];
    const ws = ths.map(x => x.getBoundingClientRect().width);
    ths.forEach((x, i) => { x.style.width = ws[i] + "px"; });
    const i0 = ths.indexOf(th), w0 = ws[i0];
    apply = x => {
      const w = Math.round(Math.max(k.endsWith("sec") ? 120 : 60, w0 + x - x0));
      W[k] = w; th.style.width = w + "px";
      ths.forEach((y, i) => { const kk = y.querySelector('.col-rs[data-rs="dpk_sec"]') ? "sec" : y.classList.contains("dpk-ty") ? "ty" : y.classList.contains("dpk-of") ? "of" : ""; if (kk && pre + kk !== k && !W[pre + kk]) W[pre + kk] = Math.round(kk === "sec" ? Math.max(120, ws[i]) : ws[i]); });
      t.style.setProperty("width", ths.reduce((sum, y) => sum + (parseFloat(y.style.width) || 0), 0) + "px", "important");
    };
  }
  const mv = ev => { ev.preventDefault(); apply(ev.clientX); };
  const up = () => {
    document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
    h.classList.remove("on");
    try { localStorage.setItem(SVI_DPK_COLS, JSON.stringify(W)); } catch (err) {}
    /* le « clic » qui suit le glissement ne ferme pas la fenêtre et ne choisit rien */
    const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
    document.addEventListener("click", stop, { capture: true, once: true });
    setTimeout(() => document.removeEventListener("click", stop, { capture: true }), 350);
  };
  document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
}, true);

/* FORMAT 64 : superposition dans le PLANNING / Gantt = ligne visée en jaune, comme DÉSIGNATIONS CLIENT ; bande jaune sur la ligne de la barre */
document.addEventListener("pointerup", () => setTimeout(() => document.querySelectorAll(".gb-grp.gb-grp-tgt").forEach(n => n.classList.remove("gb-grp-tgt")), 0), true);
document.addEventListener("pointercancel", () => document.querySelectorAll(".gb-grp.gb-grp-tgt").forEach(n => n.classList.remove("gb-grp-tgt")), true);
function sviDlyRoSync() {
  document.querySelectorAll(".g-ro-band").forEach(b => b.remove());
  const tr = document.querySelector(".dlyg-l tr.ro-on"), body = document.querySelector("#dlyGantt .gbody");
  const onG = !!window.__sviDlySrcG;
  document.querySelectorAll(".dlyg").forEach(x => x.classList.toggle("dly-src-g", onG));
  if (!tr || !body || !onG) return;
  const r = tr.getBoundingClientRect(), g = body.getBoundingClientRect();
  const b = document.createElement("div");
  b.className = "g-ro-band"; b.style.top = (r.top - g.top) + "px"; b.style.height = r.height + "px";
  body.insertBefore(b, body.firstChild);
}
/* =========================================================
   DERNIÈRE VUE (v448) : à l'ouverture de n'importe quelle interface, on retrouve la dernière vue —
   défilement de la page, des blocs, du tableau et du Gantt du PLANNING, largeur tableau / Gantt.
   Mémorisé par budget (« bdg:<réf> ») et par écran (« view:<module> »).
   ========================================================= */
(() => {
  const KEY = "svi_vstate_v1";
  const SEL = ".bdg-d-client-scroll, .bdg-h-col, .ins-hcol, .bdg-d-tabbody .bdg-d-scroll, .bdg-d-tabbody .dlyg-l, .bdg-d-tabbody .dlyg-r, #dlyGantt, .rec-scroll, .table-wrap, .chs-scroll";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } };
  const shellOf = () => [...document.querySelectorAll(".novapp-list-shell")].find(x => x.offsetParent !== null) || null;
  const els = () => { const root = shellOf() || document.querySelector(".view.active-view") || document; return [...root.querySelectorAll(SEL)]; };
  let restoring = 0, saveT = null;
  const save = () => {
    const k = window.__sviCtx;
    if (!k || Date.now() < restoring) return;
    const all = load();
    const sh = shellOf();
    const o = { y: Math.round(window.scrollY), s: els().map(e => [Math.round(e.scrollTop), Math.round(e.scrollLeft)]), t: Date.now() };
    /* largeur du tableau gardée telle qu'elle est (choisie à la poignée, ou calculée à la 1re ouverture) : la prochaine ouverture la reprend sans recalcul */
    if (sh && sh.__dlygW && typeof sh.__dlygW.w === "number") o.w = sh.__dlygW.w;
    if (sh && sh.__dlygPrevW) o.pw = sh.__dlygPrevW;
    { const gg = document.querySelector("#dlyGantt"); if (gg) o.gx = Math.round(gg.scrollLeft); }
    all[k] = o;
    /* 80 vues au plus (les plus anciennes oubliées) */
    const ks = Object.keys(all);
    if (ks.length > 80) ks.sort((a, b) => (all[a].t || 0) - (all[b].t || 0)).slice(0, ks.length - 80).forEach(x => delete all[x]);
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {}
  };
  const later = () => { clearTimeout(saveT); saveT = setTimeout(save, 350); };
  document.addEventListener("scroll", later, true);
  window.addEventListener("pagehide", save);
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
  /* le doigt reprend la main : la restauration s'arrête */
  const stop = () => { restoring = 0; };
  ["touchstart", "wheel", "pointerdown", "keydown"].forEach(t => document.addEventListener(t, stop, { capture: true, passive: true }));
  window.__sviViewSave = save;
  window.__sviViewGet = k => load()[k] || null;
  window.__sviViewRestore = k => {
    window.__sviCtx = k;
    const o = load()[k];
    const until = Date.now() + 2200;
    restoring = until;
    const apply = () => {
      if (restoring !== until) return;
      if (!o) { window.scrollTo(window.scrollX, 0); return; }
      els().forEach((e, i) => { const v = o.s && o.s[i]; if (v) { e.scrollTop = v[0]; e.scrollLeft = v[1]; } });
      window.scrollTo(window.scrollX, o.y || 0);
    };
    [30, 250, 700, 1300, 2000].forEach(ms => setTimeout(apply, ms));
    setTimeout(() => { if (restoring === until) restoring = 0; }, 2250);
  };
})();

/* =========================================================
   FORMAT 116 (v460) : toucher ailleurs = ENTRÉE, partout.
   Sur iPad, toucher une zone non saisissable ne quitte pas la case : la saisie restait en suspens.
   Un vrai toucher (sans glisser) hors de la case en cours la valide (perte du focus → enregistrement
   comme par ENTRÉE), puis ce qui a été touché agit. Défilement : rien. ✕ / FERMER / ANNULER : saisie
   abandonnée. Saisie refusée (message affiché) : la case reste, le toucher n'agit pas.
   ========================================================= */
(() => {
  const TXT = 'input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]), textarea';
  const CANCEL = '[data-x], .svc-close, [data-cancel], button[data-v=""], button[data-r="0"]';
  const KEEP = "#svCal, #cfMenu, #svToast, .unit-sug, datalist, .blk-more, #blkMenu, #sviSelBar";   /* v514 : ⋯ et sa liste gardent la case (et la sélection) */
  let st = null;
  const toastOn = () => { const t = document.getElementById("svToast"); return !!(t && t.classList.contains("on")) ? t.querySelector(".svt-m").textContent : ""; };
  document.addEventListener("pointerdown", e => {
    st = null;
    const a = document.activeElement, t = e.target;
    if (!a || !a.matches || !a.matches(TXT) || a.readOnly || !t || !t.closest) return;
    if (a === t || a.contains(t) || t.closest(KEEP)) return;
    /* fermer / annuler : ce qui était tapé est abandonné */
    if (t.closest(CANCEL)) { if (a.value !== a.defaultValue) a.value = a.defaultValue; return; }
    /* une autre case saisissable : le navigateur change lui-même de case (enregistrement normal) */
    if (t.matches(TXT + ", select") && !t.readOnly) return;
    st = { a, t, x: e.clientX, y: e.clientY, toast: toastOn() };
  }, true);
  document.addEventListener("pointermove", e => { if (st && Math.hypot(e.clientX - st.x, e.clientY - st.y) > SVI_G.drag) st = null; }, true);
  document.addEventListener("pointercancel", () => { st = null; }, true);
  document.addEventListener("pointerup", () => {
    if (!st) return;
    const { a, toast } = st; st = null;
    if (!a.isConnected || document.activeElement !== a) return;
    const v0 = a.value;
    a.blur();
    /* refusée : un message vient d'apparaître et la case garde sa saisie → on y reste, le toucher n'agit pas */
    const msg = toastOn();
    if (msg && msg !== toast && a.isConnected && a.value === v0 && v0 !== a.defaultValue) {
      const stop = ev => { ev.preventDefault(); ev.stopPropagation(); };
      document.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => document.removeEventListener("click", stop, true), 400);
      setTimeout(() => { if (a.isConnected) a.focus(); }, 0);
    }
  }, true);
})();

/* =========================================================
   FORMAT 121 (v471) : cases de nombre — chiffres seulement, dès la frappe, partout.
   inputmode="decimal" : chiffres + une virgule (ou un point) ; inputmode="numeric" : chiffres seuls ;
   « − » seulement si la case porte data-neg. Espaces (séparateurs de milliers) tolérés.
   Tout autre caractère (frappe ou collage) est retiré aussitôt, avec un court message près de la case.
   ========================================================= */
document.addEventListener("input", e => {
  const el = e.target;
  if (!el || el.tagName !== "INPUT" || el.readOnly) return;
  const m = sviIm(el);
  if (m !== "decimal" && m !== "numeric") return;
  const v0 = el.value, dec = m === "decimal", neg = el.hasAttribute("data-neg");
  let out = "", sep = false, bad = false;
  for (let i = 0; i < v0.length; i++) {
    const c = v0[i];
    if (/[0-9]/.test(c) || c === " " || c === " " || c === " ") { out += c; continue; }
    if (dec && (c === "," || c === ".") && !sep) { sep = true; out += c; continue; }
    if (neg && (c === "-" || c === "−") && !out.trim()) { out += "-"; continue; }
    bad = true;
  }
  if (!bad) return;
  let pos = 0;
  try { pos = Math.max(0, (el.selectionStart || 0) - (v0.length - out.length)); } catch (err) {}
  el.value = out;
  try { el.setSelectionRange(pos, pos); } catch (err) {}
  if (typeof svToast === "function") svToast(dec ? "CHIFFRES SEULEMENT (UNE VIRGULE PERMISE)." : "CHIFFRES SEULEMENT.", 2200, el);
}, true);

/* =========================================================
   v512 (remarques 76 à 81) : MÉCANISME COMMUN À TOUS LES TABLEAUX (une seule règle, branchée partout)
   Tableaux couverts : DÉSIGNATIONS CLIENT, DÉTAIL CHARGES, DÉTAIL PRODUITS (table.ins-table), DÉTAIL QUALITÉ (qq-table),
   DÉTAIL DÉLAIS (dly-table), IMPORT NON CRÉÉ (inc-table), SAISIE DIRECTE (sd-t), planning (prm-table)
   ET les listes du bloc TÂCHES : LOT, ACTIVITÉ PRIMAIRE, ACTIVITÉ SECONDAIRE (.ins-hcol, une ligne = .ins-li).
   Une « cellule » = la case d'un tableau (td) ou, dans une liste, la case de saisie (intitulé) ou la case d'unité (.act-u).
   ========================================================= */
const SVI_TS = "table.ins-table, table.sd-t, table.dly-table, table.inc-table, table.prm-table, table.qq-table";
const SVI_ED = 'input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]):not(.sv-date):not(.dlp-in), textarea.ins-in';
/* cellule d'un élément (ou null) */
const sviCellOf = el => {
  if (!el || !el.closest) return null;
  const td = el.closest("td");
  if (td && td.closest(SVI_TS) && td.closest("tbody")) return td;
  const li = el.closest(".ins-hcol .ins-li");
  if (!li) return null;
  const u = el.closest(".act-u");
  if (u) return u;
  return el.matches && el.matches("input.ins-in, input.lot-gname") ? el : null;
};
const sviCellInput = c => !c ? null : c.matches && c.matches(SVI_ED) ? c : c.querySelector(SVI_ED);
/* lignes visibles et cellules d'une ligne */
const sviGridRows = c => {
  if (c.tagName === "TD") { const tb = c.closest("tbody"); return [...tb.rows].filter(tr => tr.offsetParent !== null); }
  const col = c.closest(".ins-hcol"); return [...col.querySelectorAll(".ins-li")].filter(r => r.offsetParent !== null);
};
const sviRowOf = c => c.tagName === "TD" ? c.parentElement : c.closest(".ins-li");
const sviRowCells = (row, td) => {
  if (td) return [...row.cells];
  const out = [];
  row.querySelectorAll("input.ins-in, input.lot-gname").forEach(i => { const c = sviCellOf(i); if (c && !out.includes(c) && c.offsetParent !== null) out.push(c); });
  return out;
};
/* une cellule qu'on peut sélectionner (saisissable ou grisée, pas une case à cocher ni un rond) */
const sviCellOk = c => !!c && c.offsetParent !== null && (c.tagName !== "TD" || (!c.querySelector('input[type=checkbox], .lk-rd') && !c.classList.contains("ins-rdc") && !c.classList.contains("ins-delc") && !c.classList.contains("sd-cbc")));
/* cellule voisine : dr = lignes (±1), dc = colonnes (±1) */
const sviNear = (c, dr, dc) => {
  const td = c.tagName === "TD", row = sviRowOf(c), R = sviGridRows(c);
  const cells = sviRowCells(row, td);
  let ci = td ? c.cellIndex : cells.indexOf(c);
  if (dc) {
    if (td) { for (let k = ci + dc; k >= 0 && k < row.cells.length; k += dc) if (sviCellOk(row.cells[k])) return row.cells[k]; return null; }
    const x = cells[ci + dc]; return x || null;
  }
  for (let r = R.indexOf(row) + dr; r >= 0 && r < R.length; r += dr) {
    if (td) { const x = R[r].cells[ci]; if (x && sviCellOk(x)) return x; continue; }
    const cs = sviRowCells(R[r], false); if (!cs.length) continue;
    /* même champ (intitulé / unité) dans la ligne voisine */
    const f = (sviCellInput(c) || {}).dataset?.f;
    return cs.find(x => (sviCellInput(x) || {}).dataset?.f === f) || cs[Math.min(ci, cs.length - 1)];
  }
  return null;
};
/* clé d'une cellule (pour la retrouver après un redessin) */
const sviCellKey = el => {
  const c = sviCellOf(el); if (!c) return null;
  const inp = sviCellInput(c), f = inp && inp.dataset ? inp.dataset.f || "" : "";
  if (c.tagName === "TD") {
    const tbl = c.closest("table"), tr = c.parentElement;
    const tsel = tbl.id ? "#" + tbl.id : tbl.dataset.ik ? `table.ins-table[data-ik="${tbl.dataset.ik}"]` : tbl.classList.contains("sd-t") ? "#sdW table.sd-t" : tbl.classList.contains("inc-table") ? "table.inc-table" : tbl.classList.contains("dly-table") ? "table.dly-table" : tbl.classList.contains("qq-table") ? "table.qq-table" : tbl.classList.contains("prm-table") ? "table.prm-table" : "";
    const rk = tr.dataset.iid ? `[data-iid="${tr.dataset.iid}"]` : tr.dataset.grp ? `[data-grp="${tr.dataset.grp}"]` : tr.dataset.inc ? `[data-inc="${tr.dataset.inc}"]` : tr.dataset.lid ? `[data-lid="${tr.dataset.lid}"]` : `:nth-child(${tr.sectionRowIndex + 1})`;
    return tsel && rk ? { t: tsel, row: "tr" + rk, ci: c.cellIndex, f, td: el.tagName === "TD" } : null;
  }
  const col = c.closest(".ins-hcol"), li = c.closest(".ins-li");
  return { t: `.ins-hcol[data-ik="${col.dataset.ik}"]`, row: ".ins-li" + (li.dataset.iid ? `[data-iid="${li.dataset.iid}"]` : li.dataset.path ? `[data-path="${li.dataset.path}"]` : ".ins-new"), f, list: true };
};
const sviCellFind = k => {
  if (!k) return null;
  const box = document.querySelector(k.t); if (!box) return null;
  const row = box.querySelector(k.row); if (!row) return null;
  if (k.list) return row.querySelector(k.f ? `[data-f="${k.f}"]` : "input.ins-in, input.lot-gname");
  const td = row.cells && row.cells[k.ci]; if (!td) return null;
  if (k.td) return td;
  return (k.f && td.querySelector(`[data-f="${k.f}"]`)) || td.querySelector(SVI_ED) || td;
};
window.sviCellKey = sviCellKey; window.sviCellFind = sviCellFind; window.sviCellOf = sviCellOf;

/* CADRE ET POINT de la cellule active : posés PAR-DESSUS la cellule (jamais masqués par un fond, un titre ou l'en-tête),
   sur toute la cellule ; ils suivent le défilement et disparaissent dès qu'il n'y a plus de cellule active visible */
const sviCellVis = c => {
  if (!c || !c.isConnected || c.offsetParent === null) return null;
  const r = c.getBoundingClientRect();
  let top = 0, bottom = window.innerHeight, left = 0, right = window.innerWidth;
  /* bandeau du budget et barre du haut (fixés) */
  const inModal = !!c.closest("#sdW:not(.sd-inplace), #docPop, #blkPop, .svc-wrap") || (!!c.closest("[role=dialog]") && !c.closest(".sd-inplace"));
  if (!inModal) document.querySelectorAll(".topbar, .bdg-d-sticky").forEach(b => { const br = b.getBoundingClientRect(); if (br.height && br.top <= 1 && /sticky|fixed/.test(getComputedStyle(b).position)) top = Math.max(top, br.bottom); });
  /* conteneur défilant et son en-tête fixé */
  const sc = c.closest(".bdg-d-scroll, .sd-scroll, .bdg-h-col, .bdg-d-client-scroll");
  if (sc) { const R = sc.getBoundingClientRect(); top = Math.max(top, R.top); bottom = Math.min(bottom, R.bottom); left = Math.max(left, R.left); right = Math.min(right, R.right); }
  const tbl = c.closest("table");
  if (tbl && tbl.tHead) { const hr = tbl.tHead.getBoundingClientRect(); if (hr.bottom > top && hr.top <= top + 2) top = Math.max(top, hr.bottom); }
  /* v523 (remarque 1) : jamais sur la ligne TOTAL — on prend sa vraie place à l'écran (fixée ou non, Safari compris) */
  if (tbl && tbl.tFoot && c.closest("tbody")) { const fr = tbl.tFoot.getBoundingClientRect(); if (fr.height && fr.top < bottom) bottom = Math.min(bottom, fr.top); }
  const hd = c.closest(".ins-hcol") && c.closest(".ins-hcol").querySelector(".bdg-h-head");
  if (hd) { const hr = hd.getBoundingClientRect(); if (hr.bottom > top) top = Math.max(top, hr.bottom); }
  const T = Math.max(r.top, top), B = Math.min(r.bottom, bottom), L = Math.max(r.left, left), Rr = Math.min(r.right, right);
  if (B - T < 4 || Rr - L < 4) return null;
  /* v638 : cellule cachée par autre chose (graphique agrandi, tableau replié…) = ni cadre ni point */
  { const tb = c.closest("table, .ins-hcol") || c, hit = document.elementsFromPoint((L + Rr) / 2, (T + B) / 2).find(x => x.id !== "sviSelHandle" && x.id !== "sviSelFrame");
    if (hit && !tb.contains(hit) && !hit.closest("#svCal, #sviSelBar, .th-fix, .gh-fix")) return null; }
  return { top: T, bottom: B, left: L, right: Rr, full: r };
};
let SVI_FR = null;
const sviFrame = () => {
  const a = document.activeElement, c = sviCellOf(a);
  if (!SVI_FR) { SVI_FR = document.createElement("div"); SVI_FR.id = "sviSelFrame"; document.body.appendChild(SVI_FR); }
  /* v638 : case de date (DÉBUT / FIN, calendrier) = pas de second cadre par-dessus le sien (FORMAT : v553) */
  /* v736 : un seul cadre, le même pour toutes les cases (dates et DURÉE comprises) ; seul un champ date hors tableau garde le sien */
  const isDate = !!(a && a.matches && a.matches("input.sv-date"));
  const v = c && !isDate && sviCellVis(c);
  if (!v) { SVI_FR.style.display = "none"; return; }
  /* v733 : nom d'un lot du PLANNING — le cadre n'entoure que le nom (ni le rond, ni le signe, ni le numéro) */
  if (a && a !== c && a.matches && a.matches("input.dly-nm")) { const r = a.getBoundingClientRect(); v.left = Math.max(v.left, r.left - 2); v.right = Math.min(v.right, r.right + 2); if (v.right - v.left < 4) { SVI_FR.style.display = "none"; return; } }
  /* v736 : case vide d'une colonne de noms (LOT, ACTIVITÉ SECONDAIRE) : le cadre commence là où commencent les noms de la colonne (pas sur la place du rond) */
  else if (c.tagName === "TD" && c.closest(".dly-table") && !c.querySelector("input.dly-nm")) {
    const ix = c.cellIndex, ref = [...c.closest("tbody").rows].map(tr => tr.cells[ix]).find(td => td && td !== c && td.querySelector("input.dly-nm"));
    if (ref) { const off = ref.querySelector("input.dly-nm").getBoundingClientRect().left - ref.getBoundingClientRect().left; v.left = Math.max(v.left, v.full.left + off - 2); }
  }
  /* v774 (point 7) : UN SEUL CADRE, FIN, DE TAILLE FIXE — le petit cadre autour du texte (3 px en retrait des bords, 22 px de haut au plus, centré),
     jamais toute la case ni la ligne ; le point rouge suit son coin bas droit */
  /* v788 (remarque 2) : liste du bloc TÂCHES — la case = toute la hauteur de la ligne, du début de la case (numéro compris) jusqu'à la case à cocher */
  /* v789 (règle commune) : une case = cette case seule — dans LOT / ACTIVITÉS, le nom seul (ni le numéro, ni l'unité), sur la hauteur de la ligne */
  { const li = c.tagName !== "TD" && c.closest && c.closest(".ins-li");
    if (li) { const F = v.full, lr = li.getBoundingClientRect();
      const cT = v.top > F.top + .5 ? v.top : -1e9, cB = v.bottom < F.bottom - .5 ? v.bottom : 1e9;
      v.full = { top: lr.top, bottom: lr.bottom, left: F.left, right: F.right, height: lr.height, width: F.right - F.left };
      v.top = Math.max(lr.top, cT); v.bottom = Math.min(lr.bottom, cB); } }
  /* v787 (Ahmed, 01/11) : le cadre prend exactement le bord de la case, sur toute sa largeur et toute sa hauteur */
  { v.left = Math.max(v.left, v.full.left); v.right = Math.min(v.right, v.full.right);
    v.top = Math.max(v.top, v.full.top); v.bottom = Math.min(v.bottom, v.full.bottom);
    if (v.bottom - v.top < 4 || v.right - v.left < 4) { SVI_FR.style.display = "none"; return; } }
  let col = (getComputedStyle(c).getPropertyValue("--inst") || "").trim() || "#111827";
  { const pgS = c.closest('[class*="bdg-inst-"]'); if (pgS && !pgS.matches(".bdg-inst-instance, .bdg-inst-fige")) col = "#98a2b3"; }   /* figé : vert gardé (31/10/2026) */   /* v736 : lecture seule = cadre gris */
  /* au-dessus d'une fenêtre (SAISIE DIRECTE en fenêtre, fenêtres d'import…) quand la cellule y est */
  SVI_FR.style.zIndex = (c.closest("#sdW:not(.sd-inplace), #docPop, #blkPop, .svc-wrap") || (c.closest("[role=dialog]") && !c.closest(".sd-inplace"))) ? "10096" : "45";
  if (window.__sviHandleZ) window.__sviHandleZ(SVI_FR.style.zIndex === "45" ? "46" : "10097");
  Object.assign(SVI_FR.style, { display: "block", left: (v.left + window.scrollX) + "px", top: (v.top + window.scrollY) + "px", width: (v.right - v.left) + "px", height: (v.bottom - v.top) + "px", borderColor: col });
};
window.sviFrame = sviFrame;
/* v788 (remarque 3) : plusieurs cases sélectionnées = UN SEUL bloc continu (fond teinté) entouré d'un seul cadre */
let SVI_SB = null;
const sviSelBox = () => {
  const els = [...document.querySelectorAll("td.svi-cs")].filter(x => x.offsetParent !== null)
    .concat([...document.querySelectorAll(".ins-hcol .svi-ls")].filter(x => x.offsetParent !== null).map(x => x.closest(".ins-li") || x));
  if (!SVI_SB) { SVI_SB = document.createElement("div"); SVI_SB.id = "sviSelBox"; document.body.appendChild(SVI_SB); }
  if (els.length < 2) { SVI_SB.style.display = "none"; document.querySelectorAll(".svi-cs1").forEach(x => x.classList.remove("svi-cs1")); return; }
  let t = 1e9, b = -1e9, l = 1e9, r = -1e9;
  els.forEach(e => { const v = sviCellVis(e.tagName === "TD" ? e : (e.querySelector(".svi-ls") || e)); const R = e.getBoundingClientRect(); if (!v) return;
    t = Math.min(t, Math.max(R.top, v.top)); b = Math.max(b, Math.min(R.bottom, v.bottom)); l = Math.min(l, e.tagName === "TD" ? R.left : (e.querySelector(".lot-in, .svi-ls") || e).getBoundingClientRect().left); r = Math.max(r, e.tagName === "TD" ? R.right : ((e.querySelector(".ins-delc") || {}).getBoundingClientRect ? e.querySelector(".ins-delc").getBoundingClientRect().left : R.right)); });
  if (!(b > t && r > l)) { SVI_SB.style.display = "none"; return; }
  /* v789 : cases choisies une à une (Ctrl / Cmd) — chacune son propre cadre ; le grand cadre seulement pour une plage continue */
  const area = els.reduce((s2, e) => { const R = e.getBoundingClientRect(); return s2 + (e.tagName === "TD" ? R.width : r - l) * R.height; }, 0);
  document.querySelectorAll(".svi-cs1").forEach(x => x.classList.remove("svi-cs1"));
  if (area < 0.97 * (r - l) * (b - t)) { els.forEach(e => e.classList.add("svi-cs1")); SVI_SB.style.display = "none"; return; }
  const col = (getComputedStyle(els[0]).getPropertyValue("--inst") || "").trim() || "#111827";
  Object.assign(SVI_SB.style, { display: "block", left: (l + window.scrollX) + "px", top: (t + window.scrollY) + "px", width: (r - l) + "px", height: (b - t) + "px", borderColor: col, zIndex: SVI_FR ? SVI_FR.style.zIndex || "45" : "45" });
};
window.sviSelBox = sviSelBox;
/* v788 (remarque 5) : SÉLECTION MULTIPLE au doigt — chaque toucher ajoute ou retire une case (comme Ctrl / Cmd) ; Échap ou le menu l'arrêtent */
function sviMultiSet(on) {
  window.__sviMulti = !!on; document.body.classList.toggle("svi-multi", !!on);
  if (typeof svToast === "function") svToast(on ? "SÉLECTION MULTIPLE : TOUCHER LES CASES À AJOUTER OU À RETIRER." : "SÉLECTION MULTIPLE ARRÊTÉE.", 2500);
}
window.sviMultiSet = sviMultiSet;
document.addEventListener("keydown", e => { if (e.key === "Escape" && window.__sviMulti) sviMultiSet(false); }, true);
{
  let q = 0; const go = () => { q = 0; try { sviFrame(); if (window.__sviHandle) window.__sviHandle(); sviSelBox(); } catch (e) {} };
  const later = () => { if (!q) q = requestAnimationFrame(go); };
  ["focusin", "focusout", "scroll", "resize", "pointerup", "keyup"].forEach(t => (t === "resize" ? window : document).addEventListener(t, () => setTimeout(later, 0), true));
  new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true });
}

/* v513 : collage — valeur comparée pour reconnaître un doublon (majuscules, sans accents, espaces réduits ; nombres : 1 000,00 = 1000) */
const sviPasteNorm = v => {
  let s = String(v == null ? "" : v).replace(/[\u00a0\u202f]/g, " ").replace(/\s+/g, " ").trim();
  if (/^-?[\d ]+([.,]\d+)?$/.test(s) && /\d/.test(s)) { const n = parseFloat(s.replace(/ /g, "").replace(",", ".")); if (isFinite(n)) return String(n); }
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
};
/* une ligne de tableau encore vide (SAISIR ICI…, nouvelle ligne de la SAISIE DIRECTE) */
const sviRowFree = tr => tr.matches(".ins-new, .qq-new, .qq-xnew, .dlw-newr") || ![...tr.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]), textarea')].some(i => String(i.value || "").trim());

/* v514 : PRESSE-PAPIERS — texte (colonnes séparées par tabulation, une ligne par ligne) ET tableau HTML,
   pour que Google Sheets / Excel (iPad compris) collent bien case par case. Écrit pendant le toucher (exigé par Safari). */
const sviTsvHtml = t => "<table>" + String(t || "").split("\n").map(l => "<tr>" + l.split("\t").map(v => "<td>" + String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</td>").join("") + "</tr>").join("") + "</table>";
function sviClipWrite(t) {
  window.__sviSelClip = t;
  /* 1) copie classique (marche partout, y compris Safari iPad, pendant un toucher) */
  let ok = false;
  try {
    const h = e => { e.preventDefault(); e.stopImmediatePropagation(); try { e.clipboardData.setData("text/plain", t); e.clipboardData.setData("text/html", sviTsvHtml(t)); ok = true; } catch (err) {} };
    window.addEventListener("copy", h, true);   /* avant tous les autres (fenêtre, phase de capture) */
    const ta = document.createElement("textarea");
    ta.value = t; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;";
    const back = document.activeElement, wasNav = !!(back && back.classList && back.classList.contains("svi-nav"));
    document.body.appendChild(ta); try { ta.focus({ preventScroll: true }); } catch (err) {} ta.select(); try { ta.setSelectionRange(0, t.length); } catch (err) {}
    try { document.execCommand("copy"); } catch (err) {}
    window.removeEventListener("copy", h, true);
    ta.remove();
    if (back && back.focus && back.isConnected) { back.__edit = !wasNav && !!sviCellOf(back); try { back.focus({ preventScroll: true }); } catch (err) {} }
  } catch (err) {}
  /* 2) API du presse-papiers (en plus, quand elle existe) */
  try {
    if (navigator.clipboard && window.ClipboardItem && navigator.clipboard.write) {
      navigator.clipboard.write([new ClipboardItem({ "text/plain": new Blob([t], { type: "text/plain" }), "text/html": new Blob([sviTsvHtml(t)], { type: "text/html" }) })]).catch(() => { if (!ok) try { navigator.clipboard.writeText(t); } catch (err) {} });
    } else if (!ok && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).catch(() => {});
  } catch (err) {}
  return ok;
}
window.sviClipWrite = sviClipWrite;

/* v523 (remarque 1) : en bas d'un tableau qui défile, la dernière ligne ne reste jamais cachée sous la ligne TOTAL fixée
   (Safari de l'iPad) : s'il le faut, la zone de défilement reçoit juste la place qui manque */
const sviFootRoom = sc => {
  if (!sc || !sc.isConnected || sc.scrollHeight <= sc.clientHeight + 2) return;
  if (sc.scrollTop < sc.scrollHeight - sc.clientHeight - 3) return;
  sc.querySelectorAll(":scope table").forEach(t => {
    if (!t.tFoot || !t.tBodies[0] || t.closest(".bdg-d-scroll, .bdg-d-client-scroll, .sd-scroll, .lk-scroll") !== sc) return;
    const rows = [...t.tBodies[0].rows].filter(r => r.offsetParent !== null); if (!rows.length) return;
    const lb = rows[rows.length - 1].getBoundingClientRect().bottom, ft = t.tFoot.getBoundingClientRect().top;
    const over = Math.ceil(lb - ft);
    if (over > 1) { const p = (parseFloat(sc.style.paddingBottom) || 0) + over; sc.style.setProperty("padding-bottom", p + "px", "important"); }
  });
};
window.sviFootRoom = sviFootRoom;
document.addEventListener("scroll", e => { const sc = e.target && e.target.closest && e.target.closest(".bdg-d-scroll, .bdg-d-client-scroll, .sd-scroll, .lk-scroll"); if (sc === e.target) sviFootRoom(sc); }, true);

/* =========================================================
   v491 (remarque 6) : SÉLECTION DE PLUSIEURS CASES, comme Excel / Google Sheets — dans tous les tableaux de saisie
   clavier : Maj + toucher (ou Maj + flèches) = plage depuis la case active ; Commande (Ctrl) + toucher = ajoute / retire une case ;
   au doigt : petite poignée ronde au coin de la case active, à tirer pour étendre la plage.
   Commande + C = copier la sélection (tableau, pour Excel / Google Sheets) ; SAISIE DIRECTE : Commande + V = coller à partir
   du coin haut gauche, Effacer (⌫) = vider les cases sélectionnées
   ========================================================= */
(() => {
  /* v619 (remarque 88) : sélection de cases (Maj = plage, Ctrl / Cmd = case ajoutée ou retirée) dans tous les tableaux, comme en SAISIE DIRECTE */
  const TSEL = "table.ins-table, table.sd-t, table.dly-table, table.qq-table, table.inc-table, table.prm-table, table.mg-table, table.lk-table, table.dpk-t, table.bdg-d-table";
  const S = { tbl: null, a: null, b: null, extra: new Set(), cut: new Set() };
  const posOf = td => { const tr = td.closest("tr"); return tr && tr.parentElement && tr.parentElement.tagName === "TBODY" ? { r: tr.sectionRowIndex, c: td.cellIndex } : null; };
  const tdAt = (tbl, r, c) => { const tr = tbl.tBodies[0] && tbl.tBodies[0].rows[r]; return tr ? tr.cells[c] || null : null; };
  const cells = () => {
    /* v514 : tableau redessiné (en quittant une case, au retour du menu ⋯) — la sélection est retrouvée sur le nouveau tableau */
    if (S.tbl && !S.tbl.isConnected && S.tk) { const t2 = document.querySelector(S.tk); if (t2) S.tbl = t2; }
    if (!S.tbl || !S.a || !S.tbl.isConnected) return [];
    const out = [], b = S.b || S.a;
    if (S.b) for (let r = Math.min(S.a.r, b.r); r <= Math.max(S.a.r, b.r); r++) for (let c = Math.min(S.a.c, b.c); c <= Math.max(S.a.c, b.c); c++) { const td = tdAt(S.tbl, r, c); if (td) out.push(td); }
    /* v523 (remarque 5) : Ctrl / Cmd + toucher — la case de départ fait partie de la sélection (sauf si on l'a retirée) */
    if (!S.b && S.extra.size && !S.extra.has("-" + S.a.r + ":" + S.a.c)) { const td = tdAt(S.tbl, S.a.r, S.a.c); if (td) out.push(td); }
    S.extra.forEach(k => { if (k[0] === "-") return; const [r, c] = k.split(":").map(Number); const td = tdAt(S.tbl, r, c); if (td && !out.includes(td)) out.push(td); });
    if (!out.length) { const td = tdAt(S.tbl, S.a.r, S.a.c); if (td) out.push(td); return out; }
    /* v513 : tableau filtré — seules les lignes visibles à l'écran comptent (copier, coller, vider), comme Google Sheets */
    const vis = out.filter(td => td.parentElement.offsetParent !== null);
    return vis.length ? vis : out;
  };
  const paint = () => {
    document.querySelectorAll("td.svi-cs").forEach(td => td.classList.remove("svi-cs"));
    const C = cells();
    if (C.length > 1) C.forEach(td => td.classList.add("svi-cs"));
    handle(); if (window.sviSelBox) window.sviSelBox();
  };
  const clear = () => { S.b = null; S.extra.clear(); paint(); };
  /* poignée ronde (doigt) au coin bas droit de la dernière case de la plage */
  let H = null;
  const handle = () => {
    /* v512 (remarques 73, 80, 81) : point au coin de la cellule active (tableaux ET listes du bloc TÂCHES), ou de la fin de la plage ;
       seulement s'il y a une cellule active visible */
    const act = document.activeElement, cell = sviCellOf(act);
    /* v553 (partie 11, remarque 5) : case de date (calendrier) = ni contour ni point au coin */
    const isDate = !!(document.getElementById("svCal") && act && act.matches && act.matches("input.sv-date, input.dlp-in[data-f=deb], input.dlp-in[data-f=fin]")) || !!(act && act.matches && act.matches("input.sv-date")) || !!(cell && cell.querySelector && cell.querySelector("input.sv-date, input.dlp-in[data-f=deb], input.dlp-in[data-f=fin]"));
    if (!cell || isDate || !matchMedia("(pointer: coarse)").matches) { if (H) H.style.display = "none"; return; }
    const td = cell.tagName === "TD" ? cell : null;
    let end = cell;
    if (td && S.tbl && S.a && td.closest("table") === S.tbl) end = tdAt(S.tbl, (S.b || S.a).r, (S.b || S.a).c) || td;
    else if (!td && window.__sviLS) end = window.__sviLS.end(cell) || cell;   /* v513 : fin de la plage d'une liste */
    const vis = sviCellVis(end);
    if (!vis) { if (H) H.style.display = "none"; return; }
    if (!H) {
      H = document.createElement("div"); H.id = "sviSelHandle"; document.body.appendChild(H);
      H.addEventListener("pointerdown", e => {
        e.preventDefault(); e.stopPropagation(); try { H.setPointerCapture(e.pointerId); } catch (err) {}
        const mv = ev => { const el = document.elementFromPoint(ev.clientX, ev.clientY), t2 = el && el.closest && el.closest("td"); if (t2 && t2.closest("table") === S.tbl) { const p = posOf(t2); if (p) { S.b = p; paint(); } } else if (window.__sviLS) { window.__sviLS.drag(el); handle(); } };
        const up = () => { H.removeEventListener("pointermove", mv); H.removeEventListener("pointerup", up); H.removeEventListener("pointercancel", up); };
        H.addEventListener("pointermove", mv); H.addEventListener("pointerup", up); H.addEventListener("pointercancel", up);
      });
    }
    { const c = getComputedStyle(end).getPropertyValue("--inst").trim(), pgS = end.closest('[class*="bdg-inst-"]'); H.style.background = pgS && !pgS.matches(".bdg-inst-instance, .bdg-inst-fige") ? "#98a2b3" : (c || "#111827"); }   /* v505 (remarque 55) ; v736 : gris en lecture seule */
    /* v736 : une seule case = le point pile au coin du cadre (cadre rétréci au nom, colonnes de noms) */
    let vr = vis.right, vb = vis.bottom;
    { const F = document.getElementById("sviSelFrame"); if (end === cell && F && F.style.display === "block") { const fr = F.getBoundingClientRect(); vr = fr.right; vb = fr.bottom; } }
    H.style.display = "block"; H.style.left = (vr - 7 + window.scrollX) + "px"; H.style.top = (vb - 7 + window.scrollY) + "px";
  };
  window.__sviHandle = () => { if (S.b || S.extra.size) { const C = cells(); if (C.length > 1 && !C[0].classList.contains("svi-cs")) C.forEach(td => td.classList.add("svi-cs")); } handle(); };
  window.__sviHandleZ = z => { if (H) H.style.zIndex = z; };
  document.addEventListener("focusin", e => {
    const td = e.target.closest && e.target.closest("td"), tbl = td && td.closest(TSEL);
    if (!tbl) { handle(); return; }
    if (S.keep) { S.keep = false; handle(); return; }
    const p = posOf(td); if (!p) return;
    if (S.tbl !== tbl || !S.a || S.a.r !== p.r || S.a.c !== p.c) { S.tbl = tbl; S.tk = (sviCellKey(td) || {}).t || null; S.a = p; S.b = null; S.extra.clear(); paint(); }
    else handle();
  });
  document.addEventListener("pointerdown", e => {
    if (e.target === H) return;
    const td = e.target.closest && e.target.closest("td"), tbl = td && td.closest(TSEL);
    /* v492 (remarque 11) : la sélection reste pour le menu ⋯ (copier / coller / effacer) ;
       v493 (remarque 14) : un toucher hors du tableau (ailleurs que sur un menu ⋯) l'annule et cache la poignée */
    if (!tbl) {
      if (e.target.closest && e.target.closest("#blkMenu, .sd-more, .blk-more, .blk-btn, #sviSelBar")) return;
      S.b = null; S.extra.clear(); S.a = null; S.tbl = null; paint(); if (H) H.style.display = "none";
      return;
    }
    const p = posOf(td); if (!p) return;
    const multi = !!window.__sviMulti && !e.shiftKey;   /* v788 (remarque 5) : SÉLECTION MULTIPLE au doigt = comme Ctrl / Cmd + toucher */
    if ((e.shiftKey || e.metaKey || e.ctrlKey || multi) && S.tbl === tbl && S.a) {
      e.preventDefault(); S.keep = true;
      if (e.shiftKey) S.b = p;
      else {
        /* v523 (remarque 5) : ajoute / retire une case, sans perdre les autres (une plage déjà faite est gardée case par case) */
        if (S.b) { cells().forEach(td => { const q = posOf(td); if (q) S.extra.add(q.r + ":" + q.c); }); S.b = null; }
        const k = p.r + ":" + p.c, isA = p.r === S.a.r && p.c === S.a.c;
        if (isA) { const m = "-" + k; if (S.extra.has(m)) S.extra.delete(m); else S.extra.add(m); }
        else if (S.extra.has(k)) S.extra.delete(k); else S.extra.add(k);
      }
      paint();
    } else if (!e.shiftKey && !e.metaKey && !e.ctrlKey && !td.querySelector("input, select, textarea, button")) {
      /* v619 : case sans saisie (MARGE, LIAISONS…) — un toucher en fait la case de départ */
      S.tbl = tbl; S.a = p; S.b = null; S.extra.clear(); S.tk = (sviCellKey(td) || {}).t || null; paint();
    } else if ((e.metaKey || e.ctrlKey || multi) && (!S.a || S.tbl !== tbl)) {
      /* première case touchée avec Ctrl / Cmd : elle devient la case de départ */
      S.tbl = tbl; S.a = p; S.b = null; S.extra.clear(); S.tk = (sviCellKey(td) || {}).t || null; paint();
    }
  }, true);
  window.addEventListener("scroll", () => { if (H && H.style.display === "block") handle(); }, true);
  const valOf = td => { const i = td.querySelector("input:not([type=checkbox]), textarea, select"); return String(i ? i.value : td.textContent || "").replace(/[\t\n]/g, " ").trim(); };
  const selTsv = C => {
    const rs = [...new Set(C.map(td => td.parentElement))].sort((x, y) => x.sectionRowIndex - y.sectionRowIndex);
    const cs = [...new Set(C.map(td => td.cellIndex))].sort((x, y) => x - y);
    return rs.map(tr => cs.map(c => { const td = tr.cells[c]; return td && C.includes(td) ? valOf(td) : ""; }).join("\t")).join("\n");
  };
  /* v497 (remarque 32) : coller / effacer dans tous les tableaux de saisie (cases saisissables seulement) */
  const editIn = td => { const i = td && td.querySelector('input:not([type=checkbox]):not([type=radio]):not([type=file]):not(.sv-date):not(.dlp-in), textarea'); return i && !i.readOnly && !i.disabled ? i : null; };
  const putIn = (td, v) => {
    const i = editIn(td); if (!i) return false;
    i.__sel = true; i.value = v; i.dispatchEvent(new Event("input", { bubbles: true }));
    if (!i.classList.contains("sd-in")) {
      i.dispatchEvent(new Event("change", { bubbles: true }));
      if (i.isConnected && sviIm(i) === "decimal" && String(i.value).trim() !== "" && typeof money === "function") i.value = money(i.value);
    }
    i.__sel = false; return true;
  };
  const markSd = () => { if (S.tbl) S.tbl.dispatchEvent(new CustomEvent("svimark", { bubbles: true })); };
  /* v497 (remarque 32) : collage comme Excel — plusieurs valeurs = une par case, vers le bas (lignes) et vers la droite (colonnes),
     à partir de la case active (ou du coin haut gauche de la sélection) ; une seule valeur et plusieurs cases sélectionnées =
     la valeur dans chacune. Lignes manquantes : la ligne vide « SAISIR ICI » en crée de nouvelles. Cases grisées sautées. */
  const shown = tbl => [...(tbl.tBodies[0] ? tbl.tBodies[0].rows : [])].filter(tr => tr.offsetParent !== null);
  const pasteText = (t, tbl, C) => {
    if (!tbl || !C || !C.length) return 0;
    const lines = String(t || "").replace(/\r/g, "").replace(/\n+$/, "").split("\n").map(l => l.split("\t"));
    let n = 0;
    if (tbl.classList.contains("sd-t")) markSd();
    if (lines.length === 1 && lines[0].length === 1 && C.length > 1) { C.forEach(td => { if (putIn(td, lines[0][0].trim())) n++; }); return n; }
    const R0 = shown(tbl), rs = C.map(td => R0.indexOf(td.parentElement)).filter(x => x >= 0);
    const r0 = rs.length ? Math.min(...rs) : 0, c0 = Math.min(...C.map(td => td.cellIndex));
    /* v513 : DOUBLONS IGNORÉS — une ligne collée qui irait sur une ligne NOUVELLE (vide) alors qu'une ligne identique existe déjà
       (mêmes valeurs dans les mêmes colonnes), ou qu'elle a déjà été collée, est simplement sautée. Les lignes existantes
       qu'on recouvre (ex. une colonne de prix) sont remplies comme avant, sans contrôle. */
    const w = Math.max(...lines.map(l => l.length));
    const keyOf = vs => vs.map(sviPasteNorm).join("\t");
    const rowKey = tr => keyOf(Array.from({ length: w }, (_, j) => { const td = tr.cells[c0 + j]; return td ? valOf(td) : ""; }));
    const seen = new Set(R0.filter(tr => !sviRowFree(tr)).map(rowKey));
    let ri = r0, skip = 0;
    lines.forEach(cl => {
      if (!tbl.isConnected) return;
      const tr = shown(tbl)[ri]; if (!tr) return;
      const k = keyOf(Array.from({ length: w }, (_, j) => (cl[j] || "").trim()));
      if (sviRowFree(tr)) {
        if (!k.replace(/\t/g, "")) return;                  /* ligne vide : rien à créer */
        if (seen.has(k)) { skip++; return; }                  /* doublon : ignoré, la ligne nouvelle reste pour la suite */
      }
      seen.add(k);
      cl.forEach((v, j) => { const td = tr.cells[c0 + j]; if (td && putIn(td, v.trim())) n++; });
      ri++;
    });
    pasteText.skipped = skip;
    document.querySelector(".sd-sug")?.remove();
    if (typeof sviUnitSugHide === "function") sviUnitSugHide();
    return n;
  };
  const isNav = el => !!el && (el.tagName === "TD" || (el.classList && el.classList.contains("svi-nav")));
  document.addEventListener("paste", e => {
    const act = document.activeElement, td0 = act && act.closest && act.closest("td"), tbl = td0 && td0.closest(TSEL);
    if (!tbl) return;
    const t = (e.clipboardData && e.clipboardData.getData("text/plain")) || "";
    const multi = /[\t\n]/.test(t.replace(/\r/g, "").replace(/\n+$/, ""));
    const C = S.tbl === tbl && S.a ? cells() : [td0];
    if (!multi && !isNav(act) && C.length < 2) return;   /* saisie en cours : collage normal dans le texte */
    e.preventDefault();
    pasteText.skipped = 0;
    const n = pasteText(t, tbl, C.length ? C : [td0]);
    if (typeof svToast === "function" && (multi || C.length > 1)) svToast(n + " CASE(S) COLLÉE(S)." + (pasteText.skipped ? " " + pasteText.skipped + " DOUBLON(S) IGNORÉ(S)." : ""), 2200);
  }, true);
  /* v497 (remarques 33 et 35) : copier une case sélectionnée (même grisée) ou une plage, pour Excel / Google Sheets */
  const copyEv = cut => e => {
    const act = document.activeElement, td0 = act && act.closest && act.closest("td"), tbl = td0 && td0.closest(TSEL);
    if (!tbl) return;
    const C = S.tbl === tbl && S.a ? cells() : [td0];
    if (!isNav(act) && C.length < 2) return;   /* texte sélectionné dans la saisie : copie normale */
    const txt = C.length > 1 ? selTsv(C) : valOf(td0);
    e.preventDefault();
    try { e.clipboardData.setData("text/plain", txt); e.clipboardData.setData("text/html", sviTsvHtml(txt)); } catch (err) {}
    window.__sviSelClip = txt;
    if (cut) { if (tbl.classList.contains("sd-t")) markSd(); C.forEach(td => putIn(td, "")); }
    if (typeof svToast === "function" && C.length > 1) svToast(C.length + " CASE(S) " + (cut ? "COUPÉE(S)" : "COPIÉE(S)") + ".", 1800);
  };
  document.addEventListener("copy", copyEv(false), true);
  document.addEventListener("cut", copyEv(true), true);
  /* API de la sélection (menu ⋯ de la SAISIE DIRECTE) */
  window.__sviSelTo = (from, to) => { const tbl = from.closest(TSEL), p = posOf(from), q = posOf(to); if (!tbl || !p || !q || to.closest("table") !== tbl) return;
    if (S.tbl !== tbl || !S.a) { S.tbl = tbl; S.tk = (sviCellKey(from) || {}).t || null; S.a = p; S.extra.clear(); } S.b = q; paint(); };
  window.__sviSel = {
    count: () => cells().length,
    copy: () => { const C = cells(); if (!C.length) return 0; const t = selTsv(C); sviClipWrite(t); return C.length; },
    tsv: () => { const C = cells(); return C.length ? selTsv(C) : ""; },
    clear: () => { let n = 0; cells().forEach(td => { if (putIn(td, "")) n++; }); document.querySelector(".sd-sug")?.remove(); return n; },
    paste: async () => {
      const C = cells(); if (!C.length || !S.tbl) return 0;
      let t = ""; try { t = navigator.clipboard && navigator.clipboard.readText ? await navigator.clipboard.readText() : ""; } catch (err) { t = ""; }
      if (!t) t = window.__sviSelClip || "";
      return pasteText(t, S.tbl, C);
    },
    pasteText: (t, tbl, C) => pasteText(t, tbl, C)
  };
  document.addEventListener("keydown", e => {
    const act = document.activeElement, td0 = act && act.closest && act.closest("td"), tbl = td0 && td0.closest(TSEL);
    if (!tbl || S.tbl !== tbl || !S.a) return;
    /* Maj + flèches : étendre la plage (case sélectionnée seulement ; en saisie, Maj + flèches sélectionne le texte) */
    if (e.shiftKey && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      if (!isNav(act)) return;
      e.preventDefault(); e.stopPropagation();
      const b = S.b || { ...S.a };
      if (e.key === "ArrowUp") b.r = Math.max(0, b.r - 1); else if (e.key === "ArrowDown") b.r = Math.min(tbl.tBodies[0].rows.length - 1, b.r + 1);
      else if (e.key === "ArrowLeft") b.c = Math.max(0, b.c - 1); else b.c = b.c + 1;
      S.b = b; paint();
      const end = tdAt(tbl, b.r, b.c); if (end && typeof sviKeepVisible === "function") sviKeepVisible(end);
      return;
    }
    const C = cells();
    if (C.length < 2 || !isNav(act)) return;
    const mod = e.metaKey || e.ctrlKey;
    if (!mod && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault(); e.stopPropagation();
      if (tbl.classList.contains("sd-t")) markSd();
      let n = 0; C.forEach(td => { if (putIn(td, "")) n++; });
      document.querySelector(".sd-sug")?.remove();
      if (typeof svToast === "function") svToast(n + " CASE(S) VIDÉE(S).", 1800);
    }
  }, true);
})();

/* v497 (remarques 30, 33 et 35) : CASES COMME GOOGLE SHEETS, dans tous les tableaux de saisie
   - un premier toucher (ou les flèches, Tab, Entrée, les flèches de la barre du clavier de l'iPad) SÉLECTIONNE la case :
     cadre, sans curseur ; ce qu'on tape remplace le contenu ; Commande + C / X / V copient, coupent, collent la case
     (plusieurs valeurs collées : une par case, vers le bas et vers la droite) ; ⌫ vide la case ;
   - un second toucher (double toucher), F2 ou la frappe passent EN SAISIE : curseur dans le texte ; les flèches, Maj + flèches,
     Commande + A / C / V agissent alors dans le texte ; Échap = revenir à la valeur d'avant et à la case sélectionnée ;
   - flèches (case sélectionnée) : case voisine, cases grisées comprises (elles se sélectionnent et se copient, sans saisie) ;
   - la case choisie reste toujours visible (en-tête et TOTAL fixés, clavier ou barre de l'iPad) */
(() => {
  /* v512 (remarque 80) : même comportement dans tous les tableaux ET dans les listes LOT / ACTIVITÉ PRIMAIRE / ACTIVITÉ SECONDAIRE */
  const ED = SVI_ED;
  const editable = i => !!i && i.matches && i.matches(ED) && !i.readOnly && !i.disabled && !!sviCellOf(i);
  const NOSEL = "button, a, label, .lk-rd, .lk-rdall, [role=button], input[type=checkbox], input[type=radio], .ins-grip, .blk-grip, .ins-fold, .ins-gfz";
  let nav = null;
  const end = i => { try { const L = String(i.value || "").length; i.setSelectionRange(L, L); } catch (err) {} };
  /* v513 : au doigt, une case seulement sélectionnée n'ouvre pas le clavier (inputmode="none", clavier d'origine gardé) */
  const touch = () => matchMedia("(pointer: coarse)").matches;
  const kbOff = i => { if (!touch() || i.dataset.svIm !== undefined) return; i.dataset.svIm = i.getAttribute("inputmode") || ""; i.setAttribute("inputmode", "none"); };
  const kbOn = i => { if (i.dataset.svIm === undefined) return; const m = i.dataset.svIm; delete i.dataset.svIm; if (m) i.setAttribute("inputmode", m); else i.removeAttribute("inputmode"); };
  const on = i => {
    if (nav && nav !== i) off(nav);
    nav = i; i.classList.add("svi-nav"); i.__v0 = i.value; kbOff(i); end(i);
  };
  const off = i => { i.classList.remove("svi-nav"); kbOn(i); if (nav === i) nav = null; };
  /* v513 : tout le contenu sélectionné (2e toucher) — on tape directement la nouvelle valeur par-dessus */
  const all = i => { try { i.setSelectionRange(0, String(i.value || "").length); } catch (err) {} };
  window.__sviNav = { on, off, isNav: i => !!i && i.classList.contains("svi-nav") };
  /* toucher : 1er = sélection (cadre, ni curseur ni clavier) ; 2e sur la même case = saisie, TOUT LE CONTENU SÉLECTIONNÉ (v513) ;
     3e = curseur placé dans le texte */
  let tap = null, tap2 = null;
  document.addEventListener("pointerdown", e => {
    const i = e.target.closest && e.target.closest(ED);
    tap = null; tap2 = null;
    if (!editable(i)) return;
    if (document.activeElement === i) { if (i.classList.contains("svi-nav")) { off(i); tap2 = i; } return; }
    tap = i;
  }, true);
  document.addEventListener("mouseup", e => { if ((tap && e.target === tap) || (tap2 && e.target === tap2)) e.preventDefault(); }, true);
  document.addEventListener("pointerup", () => { const t = tap; setTimeout(() => { if (tap === t) tap = null; }, 120); }, true);
  document.addEventListener("click", e => {
    const i = tap2; tap2 = null;
    if (!i || e.target !== i || !i.isConnected) return;
    /* iPad : le clavier ne revient qu'avec une nouvelle prise de focus, faite pendant le toucher */
    if (touch() && document.activeElement === i) { i.__edit = true; i.blur(); i.focus({ preventScroll: true }); }
    all(i);
    /* l'iPad place le curseur après le toucher : on resélectionne tout */
    setTimeout(() => { if (document.activeElement === i && !i.classList.contains("svi-nav")) all(i); }, 0);
    setTimeout(() => { if (document.activeElement === i && !i.classList.contains("svi-nav")) all(i); }, 80);
  }, true);
  document.addEventListener("focusin", e => {
    const i = e.target;
    if (!editable(i)) return;
    if (i.__edit) { i.__edit = false; off(i); return; }
    on(i);
    /* l'iPad place le curseur après la prise de focus : on le retire encore */
    setTimeout(() => { if (nav === i && document.activeElement === i) end(i); }, 0);
    setTimeout(() => { if (nav === i && document.activeElement === i) end(i); }, 80);
  });
  document.addEventListener("focusout", e => { const i = e.target; if (i && i.classList && i.classList.contains("svi-nav")) off(i); });
  /* frappe sur une case sélectionnée : remplace le contenu, puis saisie */
  document.addEventListener("beforeinput", e => {
    const i = e.target;
    if (!i || i !== nav || !i.classList.contains("svi-nav")) return;
    const t = e.inputType || "";
    if (t === "insertText" || t === "insertReplacementText") {
      e.preventDefault();
      off(i);
      i.value = e.data || "";
      end(i);
      i.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: e.data || "" }));
      return;
    }
    if (t.startsWith("delete")) {
      e.preventDefault();
      off(i);
      i.value = "";
      i.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: t }));
      return;
    }
    if (t === "insertFromPaste" || t === "insertFromDrop") return;   /* collage : géré à part (une valeur par case) */
    off(i);
  }, true);
  /* lettres accentuées (composition) : la case est vidée d'abord */
  document.addEventListener("compositionstart", e => { const i = e.target; if (i && i === nav && i.classList.contains("svi-nav")) { off(i); i.value = ""; } }, true);
  document.addEventListener("input", e => { const i = e.target; if (e.isTrusted && i && i === nav && i.classList.contains("svi-nav")) off(i); }, true);
  /* case grisée (ou sans saisie) : elle se sélectionne aussi, pour la copier */
  const focusTd = td => {
    td.classList.add("svi-tdf");
    if (!td.hasAttribute("tabindex")) td.setAttribute("tabindex", "-1");
    td.focus({ preventScroll: true });
  };
  document.addEventListener("focusout", e => { const t = e.target; if (t && t.classList && t.classList.contains("svi-tdf")) t.classList.remove("svi-tdf"); });
  document.addEventListener("click", e => {
    if (e.defaultPrevented || !e.target.closest || e.target.closest(NOSEL)) return;
    const td = e.target.closest("td");
    const c = td ? sviCellOf(td) : null;
    if (!c || !sviCellOk(c)) return;
    const i = c.querySelector(ED);
    /* toucher la cellule hors de sa zone de texte = la sélectionner aussi */
    if (i && !i.disabled && !i.readOnly) { if (e.target !== i && !i.contains(e.target) && document.activeElement !== i) i.focus(); return; }
    if (document.activeElement === c) return;
    focusTd(c);
  });
  /* aller à une cellule (sélectionnée) ; « quiet » : sans défilement (focus remis après un redessin) */
  const goCell = (c, quiet) => {
    if (!c) return;
    const i = sviCellInput(c);
    if (i && editable(i) && i.offsetParent !== null) i.focus({ preventScroll: true });
    else if (c.tagName === "TD") focusTd(c);
    else return;
    if (!quiet) { window.__sviLastGo = { k: sviCellKey(i || c), t: performance.now() }; if (typeof sviKeepVisible === "function") sviKeepVisible(c); }
  };
  window.__sviGrid = { go: goCell, near: sviNear, cellOf: sviCellOf };
  /* v788 (remarques 6 et 7) : ALLER / SÉLECTIONNER JUSQU'AU BOUT, comme Google Sheets — Ctrl (Cmd) + flèche, Ctrl + Début / Fin ;
     avec Maj = la plage jusqu'au bout. Au doigt : entrées du menu ⋯ (dernière case active). */
  const NEWR = ".ins-new, .rec-new, .scn-new, .qq-new, .qq-xnew, .dlw-newr, .dly-new, .bdg-newrow, .bdg-d-total-row";
  const far = (x, dr, dc) => { let y = x, n, g = 0; while (g++ < 5000 && (n = sviNear(y, dr, dc)) && !sviRowOf(n).matches(NEWR)) y = n; return y; };
  const jumpT = (c, k) => k === "Home" ? far(far(c, -1, 0), 0, -1) : k === "End" ? far(far(c, 1, 0), 0, 1)
    : far(c, k === "ArrowDown" ? 1 : k === "ArrowUp" ? -1 : 0, k === "ArrowRight" ? 1 : k === "ArrowLeft" ? -1 : 0);
  const jump = (c, k, sel) => { const t = jumpT(c, k); if (!t || t === c) return;
    if (sel) { if (c.tagName === "TD" && window.__sviSelTo) window.__sviSelTo(c, t); else if (window.__sviLS && window.__sviLS.range) window.__sviLS.range(c, t); if (typeof sviKeepVisible === "function") sviKeepVisible(t); }
    else goCell(t); };
  document.addEventListener("focusin", e => { const c = sviCellOf(e.target); if (c) window.__sviLastCell = c; }, true);
  window.__sviJump = (k, sel) => { const c = window.__sviLastCell; if (!c || !c.isConnected) { if (typeof svToast === "function") svToast("TOUCHER D'ABORD UNE CASE.", 2000); return; } jump(c, k, sel); };
  document.addEventListener("keydown", e => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const el = e.target, c = el && el.closest && sviCellOf(el); if (!c) return;
    const nav = el.tagName === "TD" || (el.classList && el.classList.contains("svi-nav"));
    if (!nav && !["Home", "End"].includes(e.key)) return;   /* en saisie : Ctrl + flèche reste celui du texte */
    e.preventDefault(); e.stopPropagation(); jump(c, e.key, e.shiftKey);
  }, true);
  document.addEventListener("keydown", e => {
    const el = e.target;
    if (!el || !el.closest) return;
    const c = sviCellOf(el);
    if (!c) return;
    const isTd = el.tagName === "TD", isNav = isTd || (el.classList && el.classList.contains("svi-nav"));
    const mod = e.metaKey || e.ctrlKey || e.altKey;
    /* en saisie : Échap = valeur d'avant, case sélectionnée */
    if (!isNav) {
      if (e.key === "Escape" && editable(el) && el.__v0 !== undefined && !document.querySelector("#svUnitSug, .sd-sug")) {
        e.preventDefault();
        if (el.value !== el.__v0) { el.value = el.__v0; el.dispatchEvent(new Event("input", { bubbles: true })); }
        on(el);
      }
      return;
    }
    if (e.key === "F2" && !isTd) { e.preventDefault(); off(el); end(el); return; }
    if (mod || e.shiftKey) return;
    const k = e.key;
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(k)) {
      /* case grisée : Entrée / Tab = case voisine */
      if (isTd && (k === "Enter" || k === "Tab")) { e.preventDefault(); goCell(sviNear(c, k === "Enter" ? 1 : 0, k === "Tab" ? 1 : 0)); }
      return;
    }
    if (document.querySelector("#svUnitSug, .sd-sug")) return;   /* flèches : dans la liste de choix */
    e.preventDefault(); e.stopPropagation();
    const nx = sviNear(c, k === "ArrowDown" ? 1 : k === "ArrowUp" ? -1 : 0, k === "ArrowRight" ? 1 : k === "ArrowLeft" ? -1 : 0);
    if (nx) goCell(nx);
  }, true);
  /* v512 (remarque 80) : listes du bloc TÂCHES — Entrée = même case de la ligne du dessous, Tab = case suivante (puis ligne suivante) */
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== "Tab") return;
    const el = e.target, c = el && sviCellOf(el);
    if (!c || c.tagName === "TD" || e.defaultPrevented) return;
    if (document.querySelector("#svUnitSug")) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const back = e.shiftKey;
    let nx;
    if (e.key === "Enter") nx = sviNear(c, back ? -1 : 1, 0);
    else { nx = sviNear(c, 0, back ? -1 : 1); if (!nx) { const r = sviNear(c, back ? -1 : 1, 0); if (r) { const cs = sviRowCells(sviRowOf(r), false); nx = back ? cs[cs.length - 1] : cs[0]; } } }
    if (nx) goCell(nx);
  }, true);
  /* v513 : SÉLECTION DE PLUSIEURS CASES DANS LES LISTES LOT / ACTIVITÉ PRIMAIRE / ACTIVITÉ SECONDAIRE, comme dans les tableaux :
     Maj + toucher (ou Maj + flèches) = plage depuis la case active ; au doigt, le point au coin de la case se tire vers le bas ;
     Commande + C = copier la plage (une ligne par case, unités en 2e colonne) ; coller = à partir du haut de la plage */
  const LS = { a: null, b: null, keep: false, x: [] };   /* v523 (remarque 5) : x = cases ajoutées par Ctrl / Cmd + toucher */
  const lsRows = c => sviGridRows(c).filter(r => !r.classList.contains("ins-new"));
  const lsCells = () => {
    const base = lsRange();
    const X = (LS.x || []).filter(c => c.isConnected && LS.a && c.closest(".ins-hcol") === LS.a.closest(".ins-hcol"));
    if (!X.length) return base;
    const off = X.filter(c => c.__lsOff), on = X.filter(c => !c.__lsOff);
    const out = base.filter(c => !off.includes(c)); on.forEach(c => { if (!out.includes(c)) out.push(c); });
    const R = LS.a ? sviGridRows(LS.a) : [];
    return out.sort((p, q) => R.indexOf(sviRowOf(p)) - R.indexOf(sviRowOf(q)));
  };
  const lsRange = () => {
    const { a, b } = LS;
    if (!a || !b || !a.isConnected || !b.isConnected || a.closest(".ins-hcol") !== b.closest(".ins-hcol")) return a && a.isConnected ? [a] : [];
    const R = sviGridRows(a), ra = R.indexOf(sviRowOf(a)), rb = R.indexOf(sviRowOf(b));
    if (ra < 0 || rb < 0) return [a];
    const fa = sviRowCells(sviRowOf(a), false).indexOf(a), fb = sviRowCells(sviRowOf(b), false).indexOf(b);
    const out = [];
    for (let r = Math.min(ra, rb); r <= Math.max(ra, rb); r++) {
      if (R[r].classList.contains("ins-new")) continue;
      const cs = sviRowCells(R[r], false);
      for (let j = Math.min(fa, fb); j <= Math.max(fa, fb); j++) if (cs[j]) out.push(cs[j]);
    }
    return out.length ? out : [a];
  };
  const lsPaint = () => {
    document.querySelectorAll(".ins-hcol .svi-ls").forEach(x => x.classList.remove("svi-ls"));
    const C = lsCells(); if (C.length > 1) C.forEach(x => x.classList.add("svi-ls"));
    if (window.sviSelBox) window.sviSelBox();
  };
  const lsClear = () => { LS.a = null; LS.b = null; LS.x = []; lsPaint(); };
  const lsTsv = C => {
    const rows = [...new Set(C.map(sviRowOf))];
    return rows.map(r => C.filter(x => sviRowOf(x) === r).map(x => { const i = sviCellInput(x); return String(i ? i.value : x.textContent || "").replace(/[\t\n]/g, " ").trim(); }).join("\t")).join("\n");
  };
  window.__sviLS = {
    range: (a, b) => { if (!a || !b || a.closest(".ins-hcol") !== b.closest(".ins-hcol")) return; LS.a = a; LS.b = b; LS.x = []; lsPaint(); },
    end: c => (LS.b && LS.b.isConnected && LS.a === c ? LS.b : null),
    /* point tiré au doigt : la plage va jusqu'à la case sous le doigt (même liste) */
    drag: el => {
      const a = sviCellOf(document.activeElement), t = el && sviCellOf(el);
      if (!a || a.tagName === "TD" || !t || t.tagName === "TD" || t.closest(".ins-hcol") !== a.closest(".ins-hcol")) return;
      if (sviRowOf(t).classList.contains("ins-new")) return;
      LS.a = a; LS.b = t; lsPaint();
    },
    count: () => lsCells().length,
    /* v514 : pour le menu ⋯ et la barre COPIER / COLLER / EFFACER */
    has: () => !!(LS.a && LS.a.isConnected),
    copy: () => { const C = lsCells(); if (!C.length) return 0; sviClipWrite(lsTsv(C)); return C.length; },
    clear: () => { const C = lsCells(); const n = lsEmpty(C); lsClear(); return n; },
    paste: t => lsPaste(t, LS.a && LS.a.isConnected ? LS.a : sviCellOf(document.activeElement))
  };
  document.addEventListener("pointerdown", e => {
    if (e.target && e.target.id === "sviSelHandle") return;
    const t = sviCellOf(e.target), a = sviCellOf(document.activeElement);
    if (t && t.tagName !== "TD" && e.shiftKey && a && a.tagName !== "TD" && a.closest(".ins-hcol") === t.closest(".ins-hcol")) {
      e.preventDefault(); LS.a = LS.a && LS.a.isConnected ? LS.a : a; LS.b = t; LS.x = []; LS.keep = true; lsPaint(); return;
    }
    /* v523 (remarque 5) : Ctrl / Cmd + toucher dans une liste = ajouter / retirer une case de la sélection */
    if (t && t.tagName !== "TD" && (e.metaKey || e.ctrlKey || (window.__sviMulti && !e.shiftKey)) && !sviRowOf(t).classList.contains("ins-new")) {
      e.preventDefault();
      if (!a || a.tagName === "TD" || a.closest(".ins-hcol") !== t.closest(".ins-hcol")) { LS.a = t; LS.b = null; LS.x = []; const i = sviCellInput(t); if (i) i.focus({ preventScroll: true }); lsPaint(); return; }
      LS.a = LS.a && LS.a.isConnected ? LS.a : a; LS.keep = true;
      const cur = lsCells();
      if (cur.includes(t)) { if (!LS.x.includes(t)) LS.x.push(t); t.__lsOff = true; }
      else { if (!LS.x.includes(t)) LS.x.push(t); t.__lsOff = false; }
      lsPaint(); return;
    }
    if (e.target.closest && e.target.closest("#blkMenu, .sd-more, .blk-more, .blk-btn, #sviSelBar")) return;
    if (LS.b || (LS.x && LS.x.length)) lsClear();
  }, true);
  document.addEventListener("focusin", e => {
    const c = sviCellOf(e.target);
    if (!c || c.tagName === "TD") return;
    if (LS.keep) { LS.keep = false; return; }
    if (LS.a !== c) { LS.a = c; LS.b = null; LS.x = []; lsPaint(); }
  });
  document.addEventListener("keydown", e => {
    if (!e.shiftKey || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
    const el = e.target, c = el && sviCellOf(el);
    if (!c || c.tagName === "TD" || !(el.classList && el.classList.contains("svi-nav"))) return;
    e.preventDefault(); e.stopPropagation();
    if (!LS.a || !LS.a.isConnected) LS.a = c;
    const nx = sviNear(LS.b && LS.b.isConnected ? LS.b : LS.a, e.key === "ArrowDown" ? 1 : -1, 0);
    if (nx && !sviRowOf(nx).classList.contains("ins-new")) { LS.b = nx; lsPaint(); if (typeof sviKeepVisible === "function") sviKeepVisible(nx); }
  }, true);
  /* v512 (remarque 80) : coller plusieurs valeurs dans une liste = une par ligne, vers le bas (lignes créées par SAISIR ICI…)
     v513 : DOUBLONS IGNORÉS — un intitulé déjà présent dans la liste (ou déjà collé) n'est pas recréé, il est simplement sauté */
  document.addEventListener("paste", e => {
    const a = document.activeElement, c0 = sviCellOf(a);
    if (!c0 || c0.tagName === "TD") return;
    const t = (e.clipboardData && e.clipboardData.getData("text/plain")) || "";
    const L = t.replace(/\r/g, "").replace(/\n+$/, "").split("\n").map(l => l.split("\t"));
    const sel = lsCells();
    if (L.length < 2 && L[0].length < 2 && !(a.classList && a.classList.contains("svi-nav")) && sel.length < 2) return;
    e.preventDefault();
    lsPaste(t, c0);
  }, true);
  /* coller un texte dans une liste, à partir du haut de la plage sélectionnée (sinon de la case donnée) ; renvoie le nombre de cases */
  const lsPaste = (t, c0) => {
    const L = String(t || "").replace(/\r/g, "").replace(/\n+$/, "").split("\n").map(l => l.split("\t"));
    const sel = lsCells();
    const c = sel.length > 1 ? sel[0] : c0;
    if (!c) return 0;
    let cur = c, n = 0, skip = 0;
    const col = c.closest(".ins-hcol"), k0 = col && col.dataset.ik;
    /* intitulés déjà présents (seulement quand on colle dans la colonne des intitulés, pas dans les unités) */
    const label = r => { const x = sviRowCells(r, false)[0], i = x && sviCellInput(x); return i ? sviPasteNorm(i.value) : ""; };
    const onLabel = sviRowCells(sviRowOf(c), false)[0] === c;
    const seen = new Set(onLabel ? lsRows(c).map(label).filter(Boolean) : []);
    const newCell = () => {
      const box = document.querySelector(`.ins-hcol[data-ik="${k0}"]`);
      const nw = box && [...box.querySelectorAll(".ins-li.ins-new")].pop();
      return nw ? sviCellOf(nw.querySelector("input.ins-in")) : null;
    };
    for (const line of L) {
      if (!cur || !cur.isConnected) { cur = newCell(); if (!cur) break; }
      const row = sviRowOf(cur), isNew = row.classList.contains("ins-new");
      if (onLabel) {
        const v = sviPasteNorm(line[0]);
        if (!v) continue;                                        /* ligne vide : rien à créer, rien à effacer */
        if (v === label(row) && !isNew) { cur = sviNear(cur, 1, 0); continue; }   /* déjà la même valeur à cette place */
        else if (seen.has(v)) { skip++; continue; }             /* doublon : ignoré */
        if (!isNew) seen.delete(label(row));
        if (v) seen.add(v);
      }
      const key = !isNew ? sviCellKey(sviCellInput(cur)) : null;
      let cc = cur;
      line.forEach((v, j) => {
        if (!cc) return;
        const i = sviCellInput(cc);
        if (i && !i.readOnly && !i.disabled) { i.__sel = true; i.value = v.trim(); i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); i.__sel = false; n++; }
        cc = j < line.length - 1 && cc.isConnected ? sviNear(cc, 0, 1) : cc;
      });
      if (cur.isConnected) cur = sviNear(cur, 1, 0);
      else if (key) { const x = sviCellFind(key); cur = x ? sviNear(sviCellOf(x), 1, 0) : null; }
      else cur = null;
    }
    lsClear();
    /* v523 (remarque 3) : lignes collées aussitôt complètes (numéro, rond, case à cocher) — la liste est redessinée */
    if (n) { let sh = col; while (sh && !sh.__ins) sh = sh.parentElement; const X = sh && sh.__ins;
      if (X && X.insRedraw && k0) setTimeout(() => { try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); X.insClean(k0); X.insSave(); X.insRedraw(k0); } catch (err) {} }, 0); }
    if (typeof svToast === "function") svToast(n + " CASE(S) COLLÉE(S)." + (skip ? " " + skip + " DOUBLON(S) IGNORÉ(S)." : ""), 2200);
    return n;
  };
  /* v514 : vider les cases sélectionnées d'une liste (une ligne dont l'intitulé est vidé disparaît, comme à la main) */
  const lsEmpty = C => {
    let n = 0;
    /* une liste peut se redessiner après chaque case vidée : chaque case est retrouvée par sa clé */
    const K = C.map(x => sviCellKey(sviCellInput(x) || x)).filter(Boolean);
    K.map(k => sviCellFind(k)).forEach(x => { const i = x && (sviCellInput(sviCellOf(x) || x) || x); if (i && i.isConnected && !i.readOnly && !i.disabled && i.value !== "") { i.__sel = true; i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); i.__sel = false; n++; } });
    return n;
  };
  document.addEventListener("keydown", e => {
    if (e.key !== "Backspace" && e.key !== "Delete") return;
    const el = e.target, c = el && sviCellOf(el);
    if (!c || c.tagName === "TD" || !(el.classList && el.classList.contains("svi-nav"))) return;
    const C = lsCells(); if (C.length < 2) return;
    e.preventDefault(); e.stopPropagation();
    const n = lsEmpty(C); lsClear();
    if (typeof svToast === "function") svToast(n + " CASE(S) VIDÉE(S).", 1800);
  }, true);
  /* copier une cellule de liste sélectionnée, ou la plage (v513) */
  document.addEventListener("copy", e => {
    const a = document.activeElement, c = sviCellOf(a);
    if (!c || c.tagName === "TD" || !(a.classList && a.classList.contains("svi-nav"))) return;
    const C = lsCells();
    const txt = C.length > 1 ? lsTsv(C) : (() => { const i = sviCellInput(c); return i ? i.value : ""; })();
    e.preventDefault(); try { e.clipboardData.setData("text/plain", txt); e.clipboardData.setData("text/html", sviTsvHtml(txt)); } catch (err) {}
    window.__sviSelClip = txt;
    if (C.length > 1 && typeof svToast === "function") svToast(C.length + " CASE(S) COPIÉE(S).", 1800);
  }, true);
})();


/* =========================================================
   v514 : CASES SÉLECTIONNÉES — COPIER / COLLER / EFFACER au doigt, dans tous les tableaux et les listes LOT / ACTIVITÉS
   - une petite barre COPIER · COLLER · EFFACER apparaît au-dessus de la sélection dès que plusieurs cases sont sélectionnées ;
   - les mêmes commandes sont en tête du menu ⋯ du bloc (la sélection est gardée quand on touche ⋯) ;
   - touche ⌫ (clavier) : vide les cases sélectionnées.
   ========================================================= */
window.__sviCells = (() => {
  const LS = () => window.__sviLS, TS = () => window.__sviSel;
  /* la sélection en cours : liste (plage) ou tableau */
  const kind = () => {
    const l = LS(), t = TS();
    if (l && l.has() && l.count() > 1) return "list";
    if (t && t.count() > 0) return "table";
    if (l && l.has()) return "list";
    return null;
  };
  const count = () => { const k = kind(); return k === "list" ? LS().count() : k === "table" ? TS().count() : 0; };
  const copy = () => { const k = kind(); const n = k === "list" ? LS().copy() : k === "table" ? TS().copy() : 0; if (n && typeof svToast === "function") svToast(n + " CASE(S) COPIÉE(S) — PRÊTES À COLLER (GOOGLE SHEETS, EXCEL…).", 2200); return n; };
  const clear = () => {
    const k = kind(); if (!k) return 0;
    if (k === "table") { const tbl = document.querySelector("td.svi-cs, :focus")?.closest("table.sd-t"); if (tbl) tbl.dispatchEvent(new CustomEvent("svimark", { bubbles: true })); }
    const n = k === "list" ? LS().clear() : TS().clear();
    if (typeof svToast === "function") svToast(n + " CASE(S) VIDÉE(S).", 1800);
    return n;
  };
  const paste = async () => {
    const k = kind(); if (!k) return 0;
    if (k === "table") {
      const n = await TS().paste();
      if (typeof svToast === "function") svToast(n ? n + " CASE(S) COLLÉE(S)." : "RIEN À COLLER : COPIEZ D'ABORD DES CASES.", 1800);
      return n;
    }
    let t = ""; try { t = navigator.clipboard && navigator.clipboard.readText ? await navigator.clipboard.readText() : ""; } catch (err) { t = ""; }
    if (!t) t = window.__sviSelClip || "";
    if (!t) { if (typeof svToast === "function") svToast("RIEN À COLLER : COPIEZ D'ABORD DES CASES.", 2200); return 0; }
    return LS().paste(t);
  };
  return { kind, count, copy, clear, paste };
})();
(() => {
  let B = null;
  const build = () => {
    B = document.createElement("div"); B.id = "sviSelBar";
    /* v788 (remarque 4) : petit menu de l'application (même forme que le ⋯), jamais une bulle façon iPad */
    B.innerHTML = '<button type="button" data-sb="copy">COPIER</button><button type="button" data-sb="paste">COLLER</button><div class="blk-sep"></div><button type="button" data-sb="clear" class="sb-del">EFFACER</button>';   /* v789 : seulement COPIER, COLLER, EFFACER */
    /* la case garde le focus (et la sélection) quand on touche la barre */
    B.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); });
    B.addEventListener("mousedown", e => e.preventDefault());
    B.addEventListener("click", e => {
      const b = e.target.closest("[data-sb]"); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      const v = b.dataset.sb, X = window.__sviCells;
      if (v === "multi") { sviMultiSet(!window.__sviMulti); setTimeout(place, 50); return; }
      if (v === "seldown") { window.__sviJump("ArrowDown", true); setTimeout(place, 50); return; }
      if (v === "copy") X.copy(); else if (v === "clear") X.clear(); else X.paste();
      setTimeout(place, 50);
    });
    document.body.appendChild(B);
  };
  const place = () => {
    const X = window.__sviCells;
    const n = X ? X.count() : 0;
    const sel = [...document.querySelectorAll("td.svi-cs, .ins-hcol .svi-ls")].filter(x => x.offsetParent !== null);
    if (n < 2 || !sel.length) { if (B) B.style.display = "none"; return; }
    if (!B) build();
    let top = Infinity, left = Infinity, bottom = -Infinity;
    sel.forEach(x => { const r = x.getBoundingClientRect(); top = Math.min(top, r.top); left = Math.min(left, r.left); bottom = Math.max(bottom, r.bottom); });
    B.style.display = "flex";
    const h = B.offsetHeight || 32, w = B.offsetWidth || 220;
    let y = top - h - 6; if (y < 70) y = bottom + 6;
    y = Math.max(4, Math.min(window.innerHeight - h - 4, y));
    const x = Math.max(4, Math.min(window.innerWidth - w - 4, left));
    B.style.top = y + "px"; B.style.left = x + "px";
  };
  window.__sviSelBar = place;
  let q = 0; const later = () => { if (!q) q = requestAnimationFrame(() => { q = 0; try { place(); } catch (e) {} }); };
  ["focusin", "pointerup", "keyup", "scroll", "resize"].forEach(t => (t === "resize" ? window : document).addEventListener(t, () => setTimeout(later, 0), true));
  new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
})();
/* clavier (Mac, ou clavier de l'iPad) : la touche retour arrière vide aussi la sélection quand le bouton ⋯ ou la barre ont la main */
document.addEventListener("keydown", e => {
  if (e.key !== "Backspace" && e.key !== "Delete") return;
  const a = document.activeElement;
  if (!a || !a.closest || !a.closest("#sviSelBar, #blkMenu")) return;
  if (!window.__sviCells || window.__sviCells.count() < 2) return;
  e.preventDefault(); window.__sviCells.clear();
}, true);
/* empêche ⋯ et son menu de prendre le focus (au clavier / souris) : la case et la sélection restent */
document.addEventListener("mousedown", e => {
  if (!e.target.closest || !e.target.closest(".blk-more, #blkMenu, #sviSelBar")) return;
  if (sviCellOf(document.activeElement)) e.preventDefault();
}, true);

/* v497 (remarque 36) : nombres au format de l'application en quittant la case — 35 → 35,00 (virgule, deux décimales,
   espace des milliers), dans DÉSIGNATIONS CLIENT, DÉTAIL PRODUITS / CHARGES, IMPORT NON CRÉÉ et SAISIE DIRECTE */
document.addEventListener("focusout", e => {
  const i = e.target;
  if (!i || i.tagName !== "INPUT" || sviIm(i) !== "decimal" || i.readOnly || i.disabled) return;
  if (!i.closest("table.ins-table, table.inc-table, table.sd-t")) return;
  const v = String(i.value || "").trim();
  if (!v || !/^-?[\d\s  ]*[.,]?\d*$/.test(v) || !/\d/.test(v)) return;
  const m = money(v);
  if (m !== i.value) { i.value = m; i.defaultValue = m; }
});

/* =========================================================
   v525 (remarque 6) : GLISSER UNE LIGNE PRÈS D'UN BORD = DÉFILEMENT AUTOMATIQUE, partout
   (désignations, lots, activités, détails, planning, blocs) : le tableau (ou la page) défile vers le haut / le bas,
   plus vite à mesure que le doigt s'approche du bord ; le trait de dépôt suit
   ========================================================= */
(() => {
  let last = null, raf = 0, sc0 = null, y0 = null;   /* y0 : doigt au début du glisser — rien ne défile tant qu'il n'a pas bougé */
  const E = 56;
  const scrollAnc = el => {
    for (let x = el && el.parentElement; x && x !== document.body && x !== document.documentElement; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (/(auto|scroll)/.test(cs.overflowY) && x.scrollHeight > x.clientHeight + 1) return x;
    }
    return null;
  };
  const speed = over => Math.min(24, Math.ceil(over / 3) + 2);
  const step = () => {
    raf = 0;
    if (!last || !document.body.classList.contains("svi-dragging")) { sc0 = null; y0 = null; return; }
    if (y0 === null) y0 = last.y;
    if (Math.abs(last.y - y0) < 12) return;
    if (!sc0 || !sc0.isConnected) { const src = document.querySelector(".ro-src, .gb-lift"); sc0 = src ? scrollAnc(src) : null; }
    const y = last.y;
    let moved = false, inside = false;
    if (sc0) {
      /* zone de bord proportionnée à la hauteur de la zone (petite liste : petite zone, pour pouvoir viser ses lignes) */
      const r = sc0.getBoundingClientRect(), b = sc0.scrollTop, e = Math.max(14, Math.min(E, r.height * 0.16));
      if (y < r.top + e) sc0.scrollTop -= speed(r.top + e - y);
      else if (y > r.bottom - e) sc0.scrollTop += speed(y - (r.bottom - e));
      else inside = true;   /* doigt dans la zone, loin de ses bords : la page ne bouge pas */
      moved = sc0.scrollTop !== b;
    }
    if (!moved && !inside) {
      let top = 0; const tb = document.querySelector(".topbar, .bdg-d-sticky");
      if (tb && /sticky|fixed/.test(getComputedStyle(tb).position)) top = Math.max(0, tb.getBoundingClientRect().bottom);
      const b = window.scrollY;
      if (y < top + E) window.scrollBy(0, -speed(top + E - y));
      else if (y > window.innerHeight - E) window.scrollBy(0, speed(y - (window.innerHeight - E)));
      moved = window.scrollY !== b;
    }
    if (moved) {
      try { document.dispatchEvent(new PointerEvent("pointermove", { clientX: last.x, clientY: last.y, bubbles: true, cancelable: true, pointerId: last.id, pointerType: last.t, isPrimary: true })); } catch (e) {}
      raf = requestAnimationFrame(step);
    }
  };
  document.addEventListener("pointermove", e => {
    if (!e.isTrusted) return;
    last = { x: e.clientX, y: e.clientY, id: e.pointerId, t: e.pointerType };
    if (!document.body.classList.contains("svi-dragging")) { y0 = null; return; }
    if (y0 === null) y0 = last.y;
    if (!raf) raf = requestAnimationFrame(step);
  }, true);
  const stop = () => { last = null; sc0 = null; y0 = null; if (raf) { cancelAnimationFrame(raf); raf = 0; } };
  document.addEventListener("pointerup", stop, true);
  document.addEventListener("pointercancel", stop, true);
})();

/* v618 (remarque 89) : date tapée dans DÉBUT / FIN — le calendrier se ferme, la case s'ouvre à la saisie (tout sélectionné) ;
   formats acceptés : 17/10, 17.10.26, 17 10 2026, 1710, 171026, 17102026 ; mêmes contrôles qu'une date choisie au calendrier */
function sviDateType(el, cal) {
  try { cal && cal.remove(); } catch (e) {}
  el.__typing = true; el.__y0 = (String(el.value).match(/(\d{4})$/) || [])[1] || String(new Date().getFullYear());
  el.readOnly = false; el.setAttribute("inputmode", "decimal");
  el.focus(); setTimeout(() => { try { el.setSelectionRange(0, el.value.length); } catch (e) {} }, 0);
  const off = () => { el.removeEventListener("blur", off); setTimeout(() => { el.__typing = false; el.readOnly = true; el.setAttribute("inputmode", "none"); }, 0); };
  el.addEventListener("blur", off);
}
const sviDateNorm = (v, y0) => {
  v = String(v || "").trim(); if (!v) return v;
  let d, m, y;
  const a = v.match(/^(\d{1,2})\D+(\d{1,2})(?:\D+(\d{2,4}))?$/), b = v.match(/^\d+$/);
  if (a) { d = a[1]; m = a[2]; y = a[3]; }
  else if (b && [4, 6, 8].includes(v.length)) { d = v.slice(0, 2); m = v.slice(2, 4); y = v.slice(4) || undefined; }
  else return v;
  y = !y ? y0 : y.length === 2 ? "20" + y : y;
  return String(d).padStart(2, "0") + "/" + String(m).padStart(2, "0") + "/" + y;
};
document.addEventListener("change", e => {
  const el = e.target;
  if (!el || !el.matches || !el.matches("input.dlp-in[data-f=deb], input.dlp-in[data-f=fin]") || !el.__typing) return;
  const n = sviDateNorm(el.value, el.__y0);
  if (n !== el.value) SVI_VAL.set.call(el, n);
}, true);
/* v618 (remarque 87, FORMAT 121) : case de nombre — chiffres seulement (une seule virgule pour les décimaux), le reste retiré
   aussitôt avec « CHIFFRES SEULEMENT » près de la case */
{
  let tT = 0;
  document.addEventListener("input", e => {
    const el = e.target;
    if (!el || el.tagName !== "INPUT" || el.__typing || el.matches(".dlp-in[data-f=deb], .dlp-in[data-f=fin]")) return;
    const im = (el.getAttribute("inputmode") || "").toLowerCase();
    if (im !== "numeric" && im !== "decimal") return;
    const v = el.value;
    let w = v.replace(/[\s\u00a0\u202f]/g, "");
    if (im === "numeric") w = w.replace(/\D/g, "");
    else { w = w.replace(/[^\d.,-]/g, "").replace(/(?!^)-/g, ""); let seen = false; w = w.replace(/[.,]/g, c => { if (seen) return ""; seen = true; return ","; }); }
    const bad = v.replace(/[\s\u00a0\u202f]/g, "").replace(/\./g, ",") !== w;
    if (w !== v) { SVI_VAL.set.call(el, w); try { el.setSelectionRange(w.length, w.length); } catch (err) {} }
    if (bad && Date.now() - tT > 1500) { tT = Date.now(); try { svToast("CHIFFRES SEULEMENT", 1500, el); } catch (err) {} }
  }, true);
}
/* v618 (remarque 87) : case seule (fenêtre, réglages, INF…) — un toucher ouvre la saisie avec tout le contenu sélectionné ;
   dans les tableaux, la règle des deux touchers reste (1er = case choisie, 2e = saisie, tout sélectionné) */
document.addEventListener("focusin", e => {
  const el = e.target;
  if (!el || el.tagName !== "INPUT" || el.readOnly || el.disabled || el.closest("td, th")) return;
  if (!/^(text|number|search|tel|email|url|)$/.test((el.getAttribute("type") || "").toLowerCase())) return;
  if (el.matches(".sv-date, .dlp-in")) return;
  const sel = () => { try { if (document.activeElement === el) el.setSelectionRange(0, el.value.length); } catch (err) {} };
  setTimeout(sel, 0); setTimeout(sel, 60);
}, true);
