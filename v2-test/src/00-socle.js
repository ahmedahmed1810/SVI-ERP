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
  const c = (d && d.cal) || {};
  return { we: Array.isArray(c.we) ? c.we.slice() : SVI_CAL_DEF.we.slice(), off: (c.off || []).slice(), on: (c.on || []).slice() };
};
const sviIsoAdd = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
/* jour travaillé ? */
const sviWork = (cal, iso) => {
  if (!iso) return false;
  if ((cal.on || []).includes(iso)) return true;
  if ((cal.off || []).includes(iso)) return false;
  return !(cal.we || []).includes(new Date(iso + "T00:00:00").getDay());
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
/* TVA d'un produit : celle de la désignation client à laquelle il est lié ; vide s'il n'est lié à rien */
const insPrdTVA = (data, id) => {
  const l = ((data || {}).links || []).find(l => (l.prd || []).some(x => x.id === id));
  if (!l) return "";
  const d = (data.des || []).find(x => x.id === l.des);
  return !d ? "" : (d.tva === "" || d.tva === undefined ? 20 : num(d.tva));
};
/* charges : catalogue CHS (ARTICLE, DÉSIGNATION, UNITÉ, PCS, TVA) */
const chsFind = (art, des) => {
  const L = (typeof db !== "undefined" && db.chs) || [];
  const n = v => String(v ?? "").trim().toUpperCase();
  if (n(art)) { const x = L.find(c => n(c.article) === n(art)); if (x) return x; }
  if (n(des)) { const x = L.find(c => n(c.designation) === n(des)); if (x) return x; }
  return null;
};
const chsById = id => ((typeof db !== "undefined" && db.chs) || []).find(c => String(c.id) === String(id)) || null;
