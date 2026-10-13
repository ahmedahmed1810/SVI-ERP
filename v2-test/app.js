const API_URL = "https://script.google.com/macros/s/AKfycbzFgUloyiRJe-QmR7nRqJ4bfWqvfA_6LSgotJRrRt87yeRfWtdY7nxXMR9avafSJUPg4Q/exec";
const API_KEY = "nZYYROPFeFXBims8v4NCPcbXG8Nl";

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
const SVI_LOGO = "data:image/jpeg;base64,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";

/* cachet et signature de la société (impression, sur demande) */
const SVI_STAMP = "data:image/jpeg;base64,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";

/* signature provisoire (tirée du modèle), en attendant celle fournie */
const SVI_SIGN = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCADAAfQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD7LooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAqvf/wCrT/e/pViq9/8A6tP97+lAEK9KKE+7RQBeooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoozRmgAopM0m6lcB1FNBOadRcAooopgFFFFABRSZ5xQKAFooooAKKKKACiiigAooooAKKKKA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";

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
/* délais par TÂCHE SECONDAIRE (lot + act. scd), 12/10/2026 : les périodes saisies par tâche primaire
   sont recopiées dans chacune de ses tâches secondaires (sans chevauchement) ; une seule fois par budget */
const sviDlpSec = d => {
  if (!d || d.dlpSec) return false;
  const out = {};
  Object.keys(d.dlp || {}).forEach(key => {
    const [lo, pr] = key.split("|");
    const secs = [...new Set((d.links || []).filter(l => l.lot === lo && l.prim === pr).map(l => l.sec))];
    secs.forEach(se => {
      const list = out[lo + "|" + se] = out[lo + "|" + se] || [];
      (d.dlp[key] || []).forEach(p => {
        if (list.some(x => x.deb && x.fin && p.deb && p.fin && p.deb < x.fin && x.deb < p.fin)) return;
        list.push({ id: p.id + (secs.length > 1 ? "s" + se : ""), deb: p.deb || "", fin: p.fin || "" });
      });
    });
  });
  d.dlp = out;
  d.dlpSec = true;
  return true;
};
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
/* =========================================================
   ONGLETS DÉPLAÇABLES (comme les colonnes) : on glisse un onglet
   pour changer l'ordre ; ordre mémorisé par jeu d'onglets
   (détail : le même en saisie, liaisons et validé ; suivi DOC/TAF/OBS ;
   import ; historique).
   ========================================================= */
const SV_TABSETS = [
  { c: "#bdgTabs", t: ".bdg-d-tab", k: "tab", set: "detail" },
  { c: ".lk-tabs", t: ".bdg-d-tab", k: "lktab", set: "detail" },
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
    let w = saved[set.c];
    if (!w) {
      /* largeur naturelle du plus long intitulé */
      ts.forEach(t => { t.style.width = ""; t.style.flex = "none"; t.style.whiteSpace = "nowrap"; });
      const nat = Math.ceil(Math.max(...ts.map(t => t.getBoundingClientRect().width)));
      /* place disponible : le bloc, moins ce qui n'est pas un onglet (⋯, poignée…) */
      const par = c.parentElement;
      let avail = c.clientWidth;
      const others = [...c.children].filter(x => !ts.includes(x)).reduce((t, x) => t + x.getBoundingClientRect().width, 0);
      if (par && getComputedStyle(par).display.includes("flex") && !getComputedStyle(par).flexDirection.startsWith("column")
        && c.getBoundingClientRect().width < par.clientWidth - 4) {
        avail = par.clientWidth - [...par.children].filter(x => x !== c).reduce((t, x) => t + x.getBoundingClientRect().width, 0);
      }
      const gap = parseFloat(getComputedStyle(c).columnGap) || 0;
      const fit = Math.floor((avail - others - 16 - gap * ts.length) / ts.length);
      w = Math.max(80, Math.min(nat, fit));
    }
    ts.forEach(t => { t.style.boxSizing = "border-box"; t.style.width = w + "px"; t.style.flex = "none";
      t.style.whiteSpace = "normal"; t.style.justifyContent = "center"; t.style.textAlign = "center"; t.classList.add("tab-eq"); });
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
    if (!ms.some(m => { const el = m.target.nodeType === 1 ? m.target : m.target.parentElement; return el && (el.closest(sel) || (el.querySelector && el.querySelector(sel))); })) return;
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
  document.querySelectorAll("table").forEach(tb => {
    if (tb.offsetParent === null) return;
    const cols = tb.querySelectorAll(":scope > colgroup > col");
    const ths = tb.querySelectorAll(":scope > thead > tr:first-child > th");
    if (!cols.length || cols.length !== ths.length) return;
    let add = 0;
    ths.forEach((th, i) => {
      const lab = th.querySelector(".cf-lab");
      if (!lab || lab.scrollWidth <= lab.clientWidth + 1) return;   /* intitulé déjà entier */
      const need = Math.ceil(lab.scrollWidth + (th.clientWidth - lab.clientWidth)) + 2;
      const cur = th.getBoundingClientRect().width;
      if (need > cur + 1) { cols[i].style.width = need + "px"; add += need - cur; }
    });
    if (add && tb.style.width) tb.style.width = (parseFloat(tb.style.width) + add) + "px";
  });
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
const svCnt = (n, total) => {
  const a = Number(n) || 0;
  if (total === undefined || total === null || Number(total) === a) return `<span class="svi-cnt">${a}</span>`;
  return `<span class="svi-cnt">${a}/${Number(total) || 0}</span>`;
};
/* onglets vides (compteur 0) : mise en forme spéciale, même facultatifs */
const sviMarkEmptyTabs = root => (root || document).querySelectorAll(".bdg-d-tab, .rec-tab, .imp-tab").forEach(b => {
  const c = b.querySelector(".svi-cnt");
  b.classList.toggle("tab-vide", !!c && c.textContent.trim() === "0" && !b.classList.contains("cf-on"));
});

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

async function apiPost(action, data = {}) {
  const r = await fetch(API_URL, {
    method: "POST",
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

/* =========================================================
   BOOTSTRAP CHS / BDS
   ========================================================= */

function mapBootstrap(data) {
  db.chs = (data.chs || []).map(x => ({
    id: x.ID,
    article: x.ARTICLE,
    designation: x.DESIGNATION,
    unit: x.UNITE,
    pcs: num(x.PCS),
    /* colonne TVA (à créer dans la feuille CHS) : vide = 20 % */
    tva: x.TVA === undefined || x.TVA === "" ? 20 : num(x.TVA)
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
    sviAlert(
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
              ? "VERSION 2 — PARAMÉTRAGE"
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

  /* FORMAT 83 : recherche active → « retenues/total » */
  $("chsCount").innerHTML = svCnt(rows.length, db.chs.length);

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

      sviAlert(
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
    return sviAlert(
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
    return sviAlert(
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
   BASE V3 → lignes au format de l'ancien onglet BDG (colonnes A:Z),
   pour que tout l'écran du budget fonctionne sans changement
   ========================================================= */
/* intitulé d'un budget : saisi dans INF (budget en instance), sinon base V3 ; à défaut « À COMPLÉTER » */
function sviIntitule(ref, project, inst) {
  if (inst) return String(inst.intitule || "").trim().toUpperCase() || "À COMPLÉTER";
  const I = window.SVI_V3_INT || { byRef: {}, byPrj: {} };
  const R = String(ref || "").trim().toUpperCase(), P = String(project || "").trim().toUpperCase();
  return I.byRef[R] || I.byRef[(P + " " + R).trim()] || I.byPrj[P] || "À COMPLÉTER";
}
/* client d'un budget : saisi dans INF (budgets créés dans l'application) ; sinon « À COMPLÉTER » */
function sviClient(inst) {
  return (inst && String(inst.client || "").trim().toUpperCase()) || "À COMPLÉTER";
}
function v3ToRows(v3) {
  const tab = name => {
    const t = v3[name] || [];
    if (t.length < 2) return [];
    const h = t[0].map(x => String(x).trim());
    return t.slice(1).map(r => Object.fromEntries(h.map((k, i) => [k, r[i]])));
  };
  const fr = v => typeof v === "number" ? String(v).replace(".", ",") : String(v ?? "");
  const budgets = tab("budgets"), desig = tab("designations"), taches = tab("taches"), details = tab("details");
  const bud = new Map(budgets.map(b => [String(b.REF), b]));
  /* intitulé des budgets validés : base V3 (onglet BUDGETS, colonne INTITULE) ; BDS n'est plus lu */
  window.SVI_V3_INT = { byRef: {}, byPrj: {} };
  budgets.forEach(b => {
    const it = String(b.INTITULE ?? "").trim().toUpperCase();
    if (!it) return;
    window.SVI_V3_INT.byRef[String(b.REF).trim().toUpperCase()] = it;
    const pj = String(b.PROJET ?? "").trim().toUpperCase();
    if (pj && !window.SVI_V3_INT.byPrj[pj]) window.SVI_V3_INT.byPrj[pj] = it;
  });
  const des = new Map(desig.map(d => [String(d.ID), d]));
  const tch = new Map(taches.map(t => [String(t.ID), t]));
  const HEAD = ["", "", "", "", "", "", "PRJ", "N°", "DESIGNATION", "UDB", "LOT", "ACTIVITE", "CLE",
    "ACTIVITE PRIMAIRE", "CHG/PRD", "DETAIL BUDGET", "UTB", "NBR", "DIM1", "DIM2", "DIM3", "QTB", "PUB", "MNB", "", ""];
  return details
    .sort((a, b) => (Number(a.ORDRE) || 0) - (Number(b.ORDRE) || 0))
    .map(e => {
      const t = tch.get(String(e.TACHE_ID)) || {};
      const d = des.get(String(t.DESIGNATION_ID)) || {};
      const b = bud.get(String(t.BDG)) || {};
      const q = Number(e.QTE) || 0, pu = Number(e.PRIX) || 0;
      const cols = new Array(26).fill("");
      cols[6] = b.PROJET || ""; cols[7] = fr(d.ART); cols[8] = d.DESIGNATION || ""; cols[9] = d.UNITE || "";
      cols[10] = t.LOT || ""; cols[11] = t.ACT_SECONDAIRE || ""; cols[12] = e.CLE || "";
      cols[13] = t.ACT_PRIMAIRE || ""; cols[14] = e.TYPE || ""; cols[15] = e.DESIGNATION || "";
      cols[16] = e.UNITE || ""; cols[17] = fr(e.NBR); cols[18] = fr(e.DIM1); cols[19] = fr(e.DIM2);
      cols[20] = fr(e.DIM3); cols[21] = fr(e.QTE); cols[22] = fr(e.PRIX); cols[23] = q && pu ? fr(q * pu) : "";
      const obj = {};
      HEAD.forEach((h, i) => { if (h) obj[h] = cols[i]; });
      Object.defineProperty(obj, "__cols", { value: cols, enumerable: false });
      /* délais de la tâche (onglet TACHES : DEBUT / FIN) */
      const iso = v => { if (!v) return ""; const d = new Date(v); return isNaN(d) ? "" :
        d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
      Object.defineProperty(obj, "__deb", { value: iso(t.DEBUT), enumerable: false });
      Object.defineProperty(obj, "__fin", { value: iso(t.FIN), enumerable: false });
      return obj;
    });
}

/* =========================================================
   BDG — CHARGEMENT
   ========================================================= */

async function ensureBDGLoaded() {
  if (bdgLoaded || bdgLoading) return;

  bdgLoading = true;

  try {
    setBDGLoadingState();
    /* budgets en instance lus sur l'appareil (IndexedDB) avant d'afficher la liste */
    await SVI_INST_READY;

    /* VERSION TEST : lecture de la base V3 (repli sur l'ancien onglet BDG) */
    try {
      const v3 = await apiSrc("v3Read");
      bdgRows = v3ToRows(v3);
      if (!bdgRows.length) throw new Error("BASE V3 VIDE");
      window.SVI_SRC = "V3";
      const tag = document.getElementById("sviTestTag");
      if (tag) tag.textContent = "VERSION TEST — BASE V3";
      bdgLoaded = true;
      renderBudgetList();
      return;
    } catch (e) {
      window.SVI_SRC = "BDG";
      const tag = document.getElementById("sviTestTag");
      if (tag) tag.textContent = "VERSION TEST — ANCIEN BDG (V3 : " + (e && e.message || e) + ")";
    }

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
      .rec-exp { width: 16px; height: 16px; accent-color: var(--svst); cursor: pointer; }
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
      #blkPop .blk-title { font-weight: 800; color: #172033; padding-right: 30px; }
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
      #cfMenu { padding-left: 8px !important; }
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
        font-weight: 800; cursor: pointer; background: var(--svst, #172033); color: #fff;
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
        display: flex; align-items: flex-start; gap: 6px; padding: 3px 8px;
        white-space: normal; overflow-wrap: anywhere; cursor: pointer;
      }
      #cfMenu .cf-rsz { position: absolute; left: 0; bottom: 0; width: 30px; height: 30px; cursor: nesw-resize; touch-action: none; z-index: 3; }
      #cfMenu .cf-rsz::after { content: ""; position: absolute; left: 5px; bottom: 5px; width: 14px; height: 14px; border-left: 3px solid #9aa3af; border-bottom: 3px solid #9aa3af; border-radius: 0 0 0 4px; }
      #cfMenu .cf-foot { padding-left: 22px; }
      #cfMenu .cf-all .cf-n { margin-left: auto; flex: none; background: #eef1f6; color: #374151; border-radius: 10px; padding: 1px 8px; font-size: 11px; font-weight: 800; }
      #cfMenu .cf-item input { margin-top: 2px; flex: none; }
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

  /* ===== BUDGETS EN INSTANCE (création) — gardés sur l'appareil pendant les essais ===== */
  const instLoad = () => sviInstGet();
  const instSave = l => sviInstSet(l);
  instLoad().forEach(b => groups.set(b.ref, { ref: b.ref, project: b.project, rows: [], first: {}, inst: b }));

  /* liste affichée : VALIDÉS (noir) ou EN INSTANCE (rouge / vert si figé) */
  let listMode = "valid";
  try { if (localStorage.getItem("svi_listmode_v1") === "inst") listMode = "inst"; } catch (e) {}

  bdgGroups = groups;

  const budgets =
    [...groups.values()].filter(g => {
      const live = !!g.inst && g.inst.state !== "valide";
      return listMode === "inst" ? live : !live;
    });

  /* titre, couleur et boutons de la barre de la liste */
  shell.classList.remove("bdg-inst-instance", "bdg-inst-fige");
  shell.classList.toggle("list-inst", listMode === "inst");
  sviWatchState(shell);
  {
    const h1 = shell.querySelector(".novapp-list-titlebar h1");
    if (h1) h1.innerHTML = (listMode === "inst" ? "BUDGETS (EN INSTANCE)" : "BUDGETS (VALIDÉS)") + ' <span id="bdgListCount"></span>';
    const acts = shell.querySelector(".novapp-list-actions");
    if (acts) {
      /* ⌛ : budgets en instance — ≡ : budgets validés (bouton de la liste affichée surligné) */
      const hg = acts.querySelector('[aria-label="Historique"]');
      const ls = acts.querySelector('[aria-label="Liste"]');
      if (hg) { hg.title = "Budgets en instance"; hg.classList.toggle("on", listMode === "inst"); }
      if (ls) { ls.title = "Budgets validés"; ls.classList.toggle("on", listMode !== "inst"); }
      const setMode = m => {
        try { localStorage.setItem("svi_listmode_v1", m); } catch (err) {}
        renderBudgetList();
      };
      acts.onclick = e => {
        const b = e.target.closest("button");
        if (!b) return;
        if (b.getAttribute("aria-label") === "Historique") setMode("inst");
        else if (b.getAttribute("aria-label") === "Liste") setMode("valid");
        else if (b.getAttribute("aria-label") === "Ajouter") {
          openNewBudget();
        }
      };
    }
  }

  /* prochaine référence : la suite continue pour toujours (tous budgets confondus) */
  const nextBudgetRef = d => {
    const n = Math.max(0, ...[...groups.keys()].map(r => Number((String(r).match(/\/(\d+)\s*$/) || [])[1]) || 0)) + 1;
    const p2 = x => String(x).padStart(2, "0");
    return "BDG " + p2(d.getFullYear() % 100) + "-" + p2(d.getMonth() + 1) + p2(d.getDate()) + "/" + String(n).padStart(3, "0");
  };

  /* bouton + : fenêtre rouge NOUVEAU BUDGET (date de création, nouveau projet) */
  function openNewBudget() {
    document.getElementById("docPop")?.remove();
    const now = new Date();
    const p2 = x => String(x).padStart(2, "0");
    const local = now.getFullYear() + "-" + p2(now.getMonth() + 1) + "-" + p2(now.getDate()) + "T" + p2(now.getHours()) + ":" + p2(now.getMinutes());
    const p = document.createElement("div");
    p.id = "docPop";
    p.className = "pop-new-bdg";
    p.innerHTML = `
      <div class="doc-card" role="dialog" aria-modal="true" style="max-width:760px">
        <div class="doc-head">
          <span class="doc-title">AJOUT <span id="nbRefT"></span></span>
          <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
        </div>
        <div class="doc-body">
          <div class="doc-grid">
            <label class="doc-lab" for="nbDate">DATE CRÉATION <b>*</b></label>
            <input id="nbDate" class="doc-in" type="datetime-local" value="${local}">
            <label class="doc-lab" for="nbPrj">PROJET <b>*</b></label>
            <input id="nbPrj" class="doc-in" type="text" autocomplete="off" placeholder="CODE PROJET">
            <label class="doc-lab" for="nbName">INTITULÉ</label>
            <input id="nbName" class="doc-in nb-wide" type="text" autocomplete="off" placeholder="INTITULÉ DU PROJET">
          </div>
          <div id="nbErr" class="doc-err"></div>
        </div>
        <div class="doc-foot">
          <button type="button" class="doc-btn" data-cancel>ANNULER</button>
          <button type="button" class="doc-btn nb-save" id="nbGo">ENREGISTRER</button>
        </div>
      </div>`;
    document.body.appendChild(p);
    try { popEnhance(p, "newbdg"); } catch (e) {}
    const val = id => (p.querySelector(id)?.value || "").trim();
    const refNow = () => {
      const d = new Date(val("#nbDate"));
      const r = isNaN(d) ? "" : nextBudgetRef(d);
      p.querySelector("#nbRefT").textContent = r ? ((val("#nbPrj").toUpperCase() ? val("#nbPrj").toUpperCase() + " " : "") + r) : "";
      return isNaN(d) ? "" : r;
    };
    refNow();
    p.addEventListener("input", refNow);
    p.addEventListener("change", refNow);
    p.addEventListener("click", e => {
      if (e.target === p || e.target.closest("[data-cancel]")) p.remove();
    });
    setTimeout(() => p.querySelector("#nbPrj")?.focus(), 50);
    p.querySelector("#nbGo").addEventListener("click", () => {
      const prj = val("#nbPrj").toUpperCase().replace(/\s+/g, " ");
      const r = refNow();
      const miss = [];
      if (!r) miss.push("date");
      if (!prj) miss.push("projet");
      if (miss.length) { p.querySelector("#nbErr").textContent = "À COMPLÉTER (*) : " + miss.join(", ").toUpperCase() + "."; return; }
      const list = instLoad();
      list.push({ ref: r, project: prj, intitule: val("#nbName").toUpperCase() || "À COMPLÉTER",
        created: val("#nbDate"), state: "instance" });
      instSave(list);
      p.remove();
      try { localStorage.setItem("svi_listmode_v1", "inst"); } catch (e) {}
      renderBudgetList();
      /* consigne : l'élément créé s'ouvre directement (budget en rouge, mode SAISIE) */
      setTimeout(() => {
        const tr = [...document.querySelectorAll("tr[data-budget-ref]")].find(x => x.dataset.budgetRef === r);
        if (tr) tr.click();
      }, 30);
    });
  }

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

    /* intitulé : saisi dans INF, sinon base V3 (BDS n'est plus lu) */
    const intitule = sviIntitule(budget.ref, budgetName, budget.inst);

    if (budget.inst) {
      const c = String(budget.inst.created || "");
      const m = c.match(/^(\d{4})-(\d{2})-(\d{2})/);
      return {
        ref: budget.ref, budget: budgetName, intitule: budget.inst.intitule || "À COMPLÉTER",
        /* total TTC des désignations saisies (titres exclus) */
        ...(() => {
          const ds = ((budget.inst.data || {}).des || []).filter(r => !r.t);
          const D = budget.inst.data || {};
          const qq = r => { const lq = insLinkedQ(D, r.id); return lq !== null ? lq : 0; };
          const ht = ds.reduce((t, r) => t + qq(r) * num(r.p || 0), 0);
          const ttc = ds.reduce((t, r) => t + qq(r) * num(r.p || 0) *
            (1 + (r.tva === "" || r.tva === undefined ? 20 : num(r.tva)) / 100), 0);
          return { ht, ttc };
        })(),
        validated: svDT(budget.inst.validated || ""),
        entered: m ? svDT(c) : "",
        state: budget.inst.state || "instance", source: budget
      };
    }

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
    { const c = $("bdgListCount"); if (c) c.innerHTML = svCnt(data.length, budgets.length); }

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
          class="${item.state ? "inst-" + item.state : ""}"
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
            ${item.state === "instance" ? `<button type="button" class="bdg-row-action bdg-row-del" data-del-budget="${esc(item.ref)}"
              title="Supprimer" aria-label="Supprimer">🗑</button>` : ""}

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
      const liveOf = g => !!g.inst && g.inst.state !== "valide";
      const refs = [...groups.keys()].filter(k => liveOf(groups.get(k)) === liveOf(budget)).sort((x, y) => String(x).localeCompare(String(y), "fr", { numeric: true }));
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
          if (scrollsX(t) || t.closest("#docPop, #blkPop, #cfMenu, #blkMenu, input, textarea, select, .blk-rsz, .blk-grip, .col-rs, th, .bdg-d-tab, .rec-tab, .imp-tab, .hist-f")) { st = null; return; }
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
        deb: row.__deb || "", fin: row.__fin || "",
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
      { key: "dly", title: "DÉTAIL DÉLAIS" },
      /* budget en instance : les liaisons validées sont un onglet du détail */
      ...(budget.inst ? [{ key: "lnk", title: "LIAISONS VALIDÉES" }, { key: "unl", title: "LIGNES NON LIÉES" }, { key: "inc", title: "IMPORT NON CRÉÉ" }] : [])
    ];

    /* dernier onglet du détail ouvert (charges, produits, qualité, délais) */
    let active = "chg";
    try {
      const t = localStorage.getItem("svi_dtab_v1");
      if (["chg", "prd", "qlt", "dly"].includes(t)) active = t;
    } catch (e) {}
    /* référence affichée du budget : « H88 BDG 26-1001/001 » */
    const fullRef = String(budget.project).trim().toUpperCase() + " " + ref;
    /* budget en instance : rouge (édition) ou vert (figé) */
    shell.classList.remove("bdg-inst-instance", "bdg-inst-fige", "list-inst");
    /* en instance (rouge) ou figé (vert) ; validé : présentation noire normale */
    const INST_LIVE = !!budget.inst && budget.inst.state !== "valide";
    if (INST_LIVE) shell.classList.add("bdg-inst-" + (budget.inst.state || "instance"));
    sviWatchState(shell);

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
          ${INST_LIVE ? 'style="display:none"' : ""}
        >
          ←
        </button>

        <h1 class="bdg-d-h1">
          ${esc(budget.project)}
        </h1>

        <div class="bdg-d-hright">
          ${INST_LIVE ? `
          <button type="button" class="inst-nav" id="instPrev" title="Budget précédent" aria-label="Précédent"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <button type="button" class="inst-nav" id="instNext" title="Budget suivant" aria-label="Suivant"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <button type="button" class="inst-act" id="instLock"
            title="${budget.inst.state === "fige" ? "Revenir en édition" : "Figer (lecture seule)"}"
            aria-label="Figer">${budget.inst.state === "fige" ? `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V8a4 4 0 0 1 7.5-1.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>` : `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`}</button>
          ${budget.inst.state === "fige"
            ? `<button type="button" class="inst-act" id="instValid" title="Valider le budget" aria-label="Valider"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`
            : `<button type="button" class="inst-act" id="instDel" title="Supprimer ce budget" aria-label="Supprimer"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`}
          <button type="button" class="inst-act" id="instClose" title="Fermer" aria-label="Fermer"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>` : ""}
          <button type="button" class="inst-act" id="instDup" hidden title="Dupliquer ce budget" aria-label="Dupliquer"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></button>
          <button type="button" class="inst-act bdg-more-btn" id="bdgMore" title="Actions du budget" aria-label="Actions du budget">⋯</button>
          <button type="button" class="bdg-lay-btn" id="layResetBtn" disabled style="display:none"
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
          ${INST_LIVE ? '<div class="lk-chain lk-chain-top" id="insChain" hidden></div>' : ""}
        </div>

      </div>
      </div>

      <div class="bdg-d-page">
        <div id="insLinkView" class="ins-link-view"></div>

        <div class="bdg-d-block blk-client">
          <div class="bdg-d-block-title blk-head" id="bdgClientTitle">
            <span class="ttl">${SVI_ICON.client}DÉSIGNATIONS CLIENT</span>
            <span class="blk-tools">
              <button type="button" class="blk-btn" data-blk="client" data-act="import" title="Importer"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <button type="button" class="blk-btn" data-blk="client" data-act="export" title="Exporter"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10V2M4.5 5.5 8 2l3.5 3.5M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <button type="button" class="blk-btn" data-blk="client" data-act="pdf" title="Aperçu PDF"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5h5.5L12.5 4.5v10h-8.5z M9.5 1.5v3h3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6 8.5h4.5M6 11h4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>
              ${INST_LIVE && (budget.inst.state || "instance") === "instance" ? `<button type="button" class="blk-btn" data-blk="client" data-act="copy" title="Copier les lignes cochées">${SVI_COPY_ICON}</button><button type="button" class="blk-btn" data-blk="client" data-act="cut" title="Couper les lignes cochées">${SVI_CUT_ICON}</button><button type="button" class="blk-btn" data-blk="client" data-act="paste" title="Coller">${SVI_PASTE_ICON}</button>` : ""}
              ${INST_LIVE && (budget.inst.state || "instance") === "instance" ? `<button type="button" class="blk-btn" data-blk="client" data-act="del" title="Supprimer les lignes cochées">${SVI_DEL_ICON}</button>` : ""}
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
              ${INST_LIVE && (budget.inst.state || "instance") === "instance" ? `<button type="button" class="blk-btn" data-blk="hier" data-act="copy" title="Copier les lignes cochées">${SVI_COPY_ICON}</button><button type="button" class="blk-btn" data-blk="hier" data-act="cut" title="Couper les lignes cochées">${SVI_CUT_ICON}</button><button type="button" class="blk-btn" data-blk="hier" data-act="paste" title="Coller">${SVI_PASTE_ICON}</button>` : ""}
              ${INST_LIVE && (budget.inst.state || "instance") === "instance" ? `<button type="button" class="blk-btn" data-blk="hier" data-act="del" title="Supprimer les lignes cochées">${SVI_DEL_ICON}</button>` : ""}
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
              ${INST_LIVE && (budget.inst.state || "instance") === "instance" ? `<button type="button" class="blk-btn" data-blk="detail" data-act="copy" title="Copier les lignes cochées">${SVI_COPY_ICON}</button><button type="button" class="blk-btn" data-blk="detail" data-act="cut" title="Couper les lignes cochées">${SVI_CUT_ICON}</button><button type="button" class="blk-btn" data-blk="detail" data-act="paste" title="Coller">${SVI_PASTE_ICON}</button>` : ""}
              ${INST_LIVE && (budget.inst.state || "instance") === "instance" ? `<button type="button" class="blk-btn" data-blk="detail" data-act="del" title="Supprimer les lignes cochées">${SVI_DEL_ICON}</button>` : ""}
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
        const st0 = cfT(t);
        cfOpen = { t, key, draft: new Set(st0.f[key] ? [...st0.f[key]] : cfValues(t, key)) };
      }
      const m = document.createElement("div");
      m.id = "cfMenu";
      m.innerHTML = `
        <div class="cf-rsz" title="Largeur et hauteur"></div>
        <button type="button" class="cf-x" aria-label="Fermer">✕</button>
        <button type="button" class="cf-sort" data-dir="asc">↑ TRI CROISSANT</button>
        <button type="button" class="cf-sort" data-dir="desc">↓ TRI DÉCROISSANT</button>
        <div class="cf-search">🔍 <input type="search" class="cf-q" placeholder="RECHERCHER…"></div>
        <div class="cf-list"></div>
        <div class="cf-foot">
          <button type="button" class="cf-clear">EFFACER</button>
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
          if (keep.size === all.length) delete st.f[key]; else st.f[key] = keep;
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
          delete st.f[key];
          if (st.sort && st.sort.col === key) st.sort = null;
          m.querySelector(".cf-q").value = "";
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
      if (e.target.closest("#cfMenu") || e.target.closest(".cf-btn") || window.__cfRsz) return;
      cfClose();
    };
    document.addEventListener("click", window.__cfDocHandler, true);
    document.getElementById("cfMenu")?.remove();

    /* =========================================================
       BUDGET EN INSTANCE : SAISIE DIRECTE
       - dernière ligne de chaque bloc vide : on la touche et on écrit,
         la ligne est créée (case à cocher au début) et une nouvelle
         ligne vide apparaît dessous ;
       - désignations : case T = ligne titre (seuls ART et DÉSIGNATION
         sont saisissables), niveaux I / I.1 / I.1.1, sous-total par titre ;
       - budget figé : lecture seule.
       ========================================================= */
    const INS = budget.inst
      ? (budget.inst.data = Object.assign(
          { des: [], lot: [], prim: [], sec: [], chg: [], prd: [], qlt: [], dly: {}, links: [] },
          budget.inst.data || {}))
      : null;
    const INS_EDIT = !!INS && (budget.inst.state || "instance") === "instance";
    const INS_DLP_MIG = !!INS && sviDlpSec(INS);
    /* budget en instance (rouge) : les charges venues de CHS suivent CHS (prix, TVA, unité…) ;
       figé (vert) ou validé (noir) : on garde les valeurs du moment */
    if (INS_EDIT) (INS.chg || []).forEach(r => {
      const c = r.chs && chsById(r.chs);
      if (!c) return;
      r.art = c.article ?? r.art; r.des = c.designation ?? r.des; r.u = c.unit ?? r.u; r.p = c.pcs; r.tva = c.tva;
    });
    let insSeq = Date.now();
    const insId = () => "i" + (insSeq++).toString(36);
    const U_ = v => String(v ?? "").trim().toUpperCase();
    let insTimer = null;
    /* FORMAT 91 : LIGNES NON LIÉES (compteur, liste ouverte, hachures, FIGER) et LIAISONS VALIDÉES
       recalculés aussitôt après chaque changement du budget */
    let insLiveT = null;
    const insLiveSync = () => {
      clearTimeout(insLiveT);
      insLiveT = setTimeout(() => {
        try {
          insMarkUnlinked();
          const lb = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="lnk"] .svi-cnt`);
          if (lb && active !== "lnk") lb.outerHTML = svCnt((INS.links || []).length);
          if (active === "unl" && body && !body.contains(document.activeElement)) {
            const sc = body.querySelector(".bdg-d-scroll"), top = sc ? sc.scrollTop : 0, left = sc ? sc.scrollLeft : 0;
            body.innerHTML = `<div class="bdg-d-scroll">${insUnlHTML()}</div>`;
            const ns = body.querySelector(".bdg-d-scroll");
            if (ns) { ns.scrollTop = top; ns.scrollLeft = left; }
          }
        } catch (e) {}
      }, 60);
    };
    const insSave = () => {
      if (INS_EDIT) insLiveSync();
      clearTimeout(insTimer);
      insTimer = setTimeout(() => {
        const list = instLoad();
        const r = list.find(x => x.ref === budget.inst.ref);
        if (!r) return;
        /* délier en attente de ✓ VALIDER : l'état enregistré garde les liaisons d'avant */
        let lb = null;
        try { lb = LK.linksBak; } catch (e) {}
        r.data = lb ? { ...INS, links: lb } : INS;
        instSave(list);
      }, 250);
    };
    if (INS_DLP_MIG) insSave();

    const insNum = v => {
      const s = String(v ?? "").trim();
      return s === "" ? "" : num(s);
    };
    const insFmt = v => (v === "" || v === null || v === undefined) ? "" : money(v);
    /* niveau d'un titre d'après sa numérotation : I = 1, I.1 = 2, I.1.1 = 3 */
    const insLevel = art => Math.min(3, String(art || "").split(".").filter(x => x.trim() !== "").length || 1);
    /* niveau enregistré à part (FORMAT 61) : r.d = nombre de titres au-dessus de la ligne.
       Calculé une fois depuis l'ART (lignes anciennes / importées), puis changé seulement par le glissement ;
       l'ART reste tel que saisi. Pas de limite de niveaux. */
    const dOf = r => Number(r && r.d) || 0;
    /* liaison primaire : l'activité secondaire porte le même intitulé que l'activité primaire */
    const insIsPrimLink = (pid, sid) => {
      const P = INS && INS.prim.find(x => x.id === pid), S = INS && INS.sec.find(x => x.id === sid);
      return !!(P && S && U_(P.v) && U_(P.v) === U_(S.v));
    };
    /* activité primaire = aussi une activité secondaire (sa jumelle, même intitulé) : créée avec elle,
       renommée et supprimée avec elle tant qu'elle n'est liée à rien d'autre */
    const insTwins = () => {
      if (!INS || !INS.prim || !INS.sec) return false;
      let ch = false;
      const usedElse = (sid, pid) => (INS.links || []).some(l => l.sec === sid && l.prim !== pid);
      const keep = new Set();
      INS.prim.forEach(p => {
        const v = U_(p.v);
        if (!v || p.t) return;
        let t = p.tw && INS.sec.find(x => x.id === p.tw);
        if (t && U_(t.v) !== v) {
          const other = INS.sec.find(x => x !== t && U_(x.v) === v);
          if (!other && !usedElse(t.id, p.id)) { t.v = p.v; ch = true; }
          else t = other || null;
        }
        if (!t) t = INS.sec.find(x => U_(x.v) === v);
        if (!t) { t = { id: insId(), v: p.v, on: false, tw: 1 }; INS.sec.push(t); ch = true; }
        if (p.tw !== t.id) { p.tw = t.id; ch = true; }
        keep.add(t.id);
      });
      const n0 = INS.sec.length;
      INS.sec = INS.sec.filter(x => !x.tw || keep.has(x.id) || (INS.links || []).some(l => l.sec === x.id));
      if (INS.sec.length !== n0) ch = true;
      return ch;
    };
    const insNorm = () => {
      if (!INS) return;
      if (insTwins()) insSave();
      try { if (dlyClean()) insSave(); } catch (e) {}
      const stack = [];
      INS.des.forEach(r => {
        if (r.d === undefined || r.d === null || r.d === "") {
          if (r.t) {
            const L = insLevel(r.art);
            while (stack.length && insLevel(stack[stack.length - 1].art) >= L) stack.pop();
            r.d = stack.length;
          } else r.d = stack.length;
        }
        r.d = Math.max(0, Math.min(Number(r.d) || 0, stack.length));
        while (stack.length > r.d) stack.pop();
        if (r.t) stack.push(r);
      });
    };
    /* quantité d'un détail produit : NBR × DIM si renseignés, sinon la saisie */
    const insQty = (k, r) => {
      if (k === "prd") return insPrdQ(r);
      /* QPB désignation : toujours calculée = somme des produits de ses tâches primaires (0 sans liaison) */
      if (k === "des") { const lq = r.id ? insLinkedQ(INS, r.id) : null; return lq !== null ? lq : 0; }
      return r.q === "" || r.q === undefined ? 0 : num(r.q);
    };
    const insPrice = (k, r) => k === "prd" ? insPrdPrice(INS, r.id) : r.p;
    const insHT = (k, r) => r.t ? 0 : insQty(k, r) * num(insPrice(k, r) || 0);
    const insTVA = r => (r.tva === "" || r.tva === undefined) ? 20 : num(r.tva);
    /* TVA de la ligne : produits = celle de la désignation liée (vide sans liaison) */
    const insTVAk = (k, r) => k === "prd" ? insPrdTVA(INS, r.id) : insTVA(r);
    const insTTC = (k, r) => insHT(k, r) * (1 + num(insTVAk(k, r) || 0) / 100);

    /* colonnes : [champ, libellé, classe, type, largeur] ; type : txt / num / calc */
    const INS_COLS = {
      qlt: [["v", "QUALITÉ", "", "txt", "qlt"]],   /* une seule colonne : toute la largeur du bloc (voir insTableHTML) */
      des: [
        ["art", "ART", "center", "txt", "article"],
        ["des", "DÉSIGNATION", "", "txt", "designation"],
        ["u", "UPB", "center", "txt", "unit"],
        ["q", "QPB", "number", "num", "qty"],
        ["p", "PPB", "number", "num", "price"],
        ["ht", "MPB HT", "number", "calc", "ht"],
        ["tva", "TVA %", "number", "num", "tva"],
        ["ttc", "MPB TTC", "number", "calc", "ttc"]
      ],
      chg: [
        ["art", "ART", "center", "txt", "article"],
        ["des", "DÉSIGNATION", "", "txt", "detail"],
        ["u", "UCB", "center", "txt", "unit"],
        ["q", "QCB", "number", "num", "qty"],
        ["p", "PCB", "number", "num", "price"],
        ["ht", "MCB HT", "number", "calc", "amount"],
        ["tva", "TVA %", "number", "num", "tva"],
        ["ttc", "MCB TTC", "number", "calc", "ttc"]
      ],
      prd: [   /* pas de colonne ART : un produit n'a pas d'article */
        ["des", "DÉSIGNATION", "", "txt", "detail"],
        ["u", "UPB", "center", "txt", "unit"],
        ["nbr", "NBR", "number", "num", "nbr"],
        ["d1", "DIM 1", "number", "num", "d1"],
        ["d2", "DIM 2", "number", "num", "d2"],
        ["d3", "DIM 3", "number", "num", "d3"],
        ["q", "QPB", "number", "num", "qty"],
        ["p", "PPB", "number", "num", "price"],
        ["ht", "MPB HT", "number", "calc", "amount"],
        ["tva", "TVA %", "number", "num", "tva"],
        ["ttc", "MPB TTC", "number", "calc", "ttc"]
      ]
    };
    /* champs non saisissables (calculés ou venus d'ailleurs) : fond gris ; les autres gardent le fond normal
       désignations : QPB, montants (TVA saisissable, 20 % par défaut) ;
       charges : PCB (s'il vient de CHS), montants, TVA (de CHS) — une charge absente de CHS garde son PCB saisissable ;
       produits : QPB, PPB, montants, TVA (celle de la désignation liée) ; unité, NBR et DIM se saisissent */
    const INS_LOCK = { des: ["q", "ht", "ttc"], chg: ["ht", "tva", "ttc"], prd: ["q", "p", "ht", "tva", "ttc"] };
    const insCalc = (k, r, f) =>
      f === "ht" ? insHT(k, r) : f === "ttc" ? insTTC(k, r)
        : f === "q" ? insQty(k, r) : f === "tva" ? insTVAk(k, r) : (f === "p" && k === "prd") ? insPrice(k, r) : r[f];
    /* erreur d'une ligne (FORMAT 75) : on ne passe pas à la ligne suivante tant qu'elle reste */
    const insRowErr = (k, r) => {
      if (!r || r.t || !INS || !(INS[k] || []).includes(r)) return null;
      const z = v => v === "" || v === undefined || v === null || num(v) === 0;
      if (k === "prd") {
        if (z(r.nbr)) return { f: "nbr", m: "NBR VIDE OU 0 : SAISIR LE NOMBRE." };
        const nd = sviUnitDims(r.u);
        const known = ["U", "F", "M", "ML", "M2", "M3"].includes(U_(r.u));
        if (known) for (let i = 1; i <= nd; i++) if (z(r["d" + i])) return { f: "d" + i, m: "UNITÉ " + (U_(r.u) || "") + " : DIM " + i + " À SAISIR." };
      }
      if (k === "chg") {
        if (z(r.q)) return { f: "q", m: "QTE VIDE OU 0 : SAISIR LA QUANTITÉ." };
        if (!r.chs && z(r.p)) return { f: "p", m: "CHARGE ABSENTE DE CHS : SAISIR LE PCB." };
      }
      return null;
    };
    /* une cellule : champ saisissable, ou verrouillé (titre, calculé) */
    const insCell = (k, r, c) => {
      const [f, , cls, type] = c;
      const isNew = !r;
      r = r || {};
      /* QPB produits = NBR × DIM 1 × DIM 2 × DIM 3 ; QPB désignation liée = somme des produits de ses tâches */
      const qAuto = (f === "q" && (k === "prd" || k === "des")) || (f === "p" && k === "prd");
      const locked = !INS_EDIT || type === "calc" || qAuto || (INS_LOCK[k] || []).includes(f) || (k === "chg" && (f === "p" || f === "u") && !!r.chs) || (r.t && f !== "art" && f !== "des")
        /* DIM que l'unité n'autorise pas : grisées (FORMAT 74, R10) */
        || (k === "prd" && /^d[123]$/.test(f) && !isNew && +f[1] > sviUnitDims(r.u));
      const er = !isNew && INS_EDIT ? insRowErr(k, r) : null;
      let val = "";
      /* ligne vide « SAISIR ICI » des désignations : TVA 20 % affichée par défaut */
      if (isNew && f === "tva" && k !== "prd") val = "20,00";
      if (!isNew) {
        if (r.t && f !== "art" && f !== "des") val = "";
        else if (type === "calc" || qAuto) val = insFmt(insCalc(k, r, f));
        else if (k === "prd" && f === "tva") val = insFmt(insPrdTVA(INS, r.id));
        else if (type === "num") val = f === "tva" ? (r.tva === "" || r.tva === undefined ? "20,00" : insFmt(r.tva)) : insFmt(r[f]);
        else val = r[f] || "";
      }
      if (!INS_EDIT) return `<td class="${cls}">${esc(val)}${f === "tva" && val ? " %" : ""}</td>`;
      return `<td class="${cls} ins-td${locked ? " ins-lock" : ""}${er && er.f === f ? " ins-bad" : ""}"${er && er.f === f ? ` data-why="${esc(er.m)}"` : ""}><input class="ins-in ${cls}" data-f="${f}" enterkeyhint="next"
        ${type === "num" ? 'inputmode="decimal"' : ""} ${locked ? "disabled" : ""}
        value="${esc(val)}" ${isNew && f === "des" ? 'placeholder="SAISIR ICI…"' : ""} autocomplete="off"></td>`;
    };
    const INS_TRASH = `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    /* page unique : rond à gauche = choix pour la liaison (2e toucher = libère le choix) ;
       case à droite = suppression (cochée, elle devient 🗑 ; ANNULER la décoche) */
    /* rond d'en-tête (FORMAT) : « toutes les lignes déjà liées » du bloc sont choisies, pour les délier d'un coup */
    const lkAllLinked = (k, id) => LK.des && k !== "des" ? lkIsLinked(k, id) : lkAnyLinked(k, id);
    const lkOn = (k, id) => (k === "prd" || k === "chg") ? LK[k][id] !== undefined : (LK.all && LK.all[k] ? lkAllLinked(k, id) : LK[k] === id);
    /* lignes déjà liées à la désignation choisie (comme le choix du budget validé, niveau par niveau) :
       lots de la désignation ; activités primaires du lot choisi ; secondaires de la primaire choisie ;
       produits / charges de la secondaire choisie */
    const lkLinks = upTo => (INS.links || []).filter(l => l.des === LK.des
      && (upTo < 1 || !LK.lot || l.lot === LK.lot) && (upTo < 2 || !LK.prim || l.prim === LK.prim) && (upTo < 3 || !LK.sec || l.sec === LK.sec));
    const lkLinked = () => {
      const S = { lot: new Set(), prim: new Set(), sec: new Set(), prd: new Set(), chg: new Set() };
      /* aucune désignation choisie : toutes les lignes liées sont en bleu */
      if (!LK.des) return insUsed();
      S.des = new Set((INS.links || []).some(l => l.des === LK.des) ? [LK.des] : []);   /* la désignation choisie, si elle est liée */
      lkLinks(0).forEach(l => S.lot.add(l.lot));
      lkLinks(1).forEach(l => S.prim.add(l.prim));
      lkLinks(2).forEach(l => S.sec.add(l.sec));
      lkLinks(3).forEach(l => { (l.prd || []).forEach(x => S.prd.add(x.id)); (l.chg || []).forEach(x => S.chg.add(x.id)); });
      return S;
    };
    /* lignes liées EXACTEMENT à ce qui est choisi (désignation, lot, activités, produits, charges) :
       elles remontent et passent en bleu foncé, dans tous les blocs, quel que soit l'élément choisi
       (le rond à point reste réservé aux lignes liées à la désignation choisie) */
    const lkHits = () => {
      const ch = ["des", "lot", "prim", "sec"].filter(k => LK[k]);
      const cp = Object.keys(LK.prd || {}), cc = Object.keys(LK.chg || {});
      if (!ch.length && !cp.length && !cc.length) return null;
      const S = { des: new Set(), lot: new Set(), prim: new Set(), sec: new Set(), prd: new Set(), chg: new Set() };
      (INS.links || []).filter(l => ch.every(k => l[k] === LK[k])
        && cp.every(id => (l.prd || []).some(x => x.id === id)) && cc.every(id => (l.chg || []).some(x => x.id === id)))
        .forEach(l => {
          ["des", "lot", "prim", "sec"].forEach(k => S[k].add(l[k]));
          (l.prd || []).forEach(x => S.prd.add(x.id)); (l.chg || []).forEach(x => S.chg.add(x.id));
        });
      return S;
    };
    let LKH = null;
    const lkHit = (k, id) => !!(LKH && LKH[k] && LKH[k].has(id)) && !lkOn(k, id);
    /* une ligne qu'on ne peut pas choisir (avec les choix déjà faits) : grisée d'avance, son rond ne réagit pas ;
       appui long = la raison s'affiche près de la ligne (gain de temps : on ne commet plus l'erreur) */
    const LK_T = { des: "UNE DÉSIGNATION", lot: "UN LOT", prim: "UNE ACTIVITÉ PRIMAIRE", sec: "UNE ACTIVITÉ SECONDAIRE" };
    const lkBan = (k, id) => {
      if (!INS_EDIT || !id || lkOn(k, id)) return "";
      if (LK.all && LK.all[k]) return "TOUTES LES LIGNES LIÉES SONT CHOISIES : TOUCHER LE ROND D'EN-TÊTE POUR LIBÉRER.";
      if (LK_T[k] && LK[k] && LK[k] !== id) return LK_T[k] + " EST DÉJÀ CHOISI(E) : LIBÉREZ-LA D'ABORD.";
      /* désignation sans UPB : elle ne peut pas être liée */
      if (k === "des") { const D = INS.des.find(x => x.id === id); if (D && !D.t && !U_(D.u)) return "UPB MANQUANTE : SAISIR L'UNITÉ DE LA DÉSIGNATION AVANT DE LA LIER."; }
      if (k === "prim" || k === "sec") {
        const a = lkRuleA(k, id);
        if (a) return a;
        /* règle B : la liaison primaire (act. scd = act. prm) n'a que des produits de l'unité de la désignation */
        const D = LK.des && INS.des.find(x => x.id === LK.des), du = U_(D && D.u);
        const pid = k === "prim" ? id : LK.prim, sid = k === "sec" ? id : LK.sec;
        if (du && pid && sid && insIsPrimLink(pid, sid)) {
          const bad = Object.keys(LK.prd || {}).find(x => { const P = INS.prd.find(y => y.id === x); return P && U_(P.u) && U_(P.u) !== du; });
          if (bad) return "RÈGLE B : LIAISON PRIMAIRE — " + lkName("prd", bad) + " N'A PAS L'UNITÉ DE LA DÉSIGNATION (" + du + ").";
        }
        return "";
      }
      if (k === "prd" && LK.des && LK.prim && LK.sec && insIsPrimLink(LK.prim, LK.sec)) {
        const D = INS.des.find(x => x.id === LK.des), P = INS.prd.find(x => x.id === id);
        const du = String((D && D.u) || "").trim().toUpperCase(), pu = String((P && P.u) || "").trim().toUpperCase();
        if (du && pu && du !== pu) return "RÈGLE B : LIAISON PRIMAIRE — UNITÉ " + pu + " ≠ UNITÉ DE LA DÉSIGNATION (" + du + ").";
      }
      if ((k === "prd" || k === "chg") && LK.lot && LK.sec) {
        const l = (INS.links || []).find(l => l.lot === LK.lot && l.sec === LK.sec && !(l.des === LK.des && l.prim === LK.prim)
          && (l[k] || []).some(x => x.id === id));
        if (l) return "RÈGLE D : DÉJÀ DANS LA TÂCHE SECONDAIRE " + lkName("lot", LK.lot) + " › " + lkName("sec", LK.sec) + ".";
      }
      return "";
    };
    const lkBanAttr = (k, r) => { const b = r && !r.t ? lkBan(k, r.id) : ""; return b ? ` data-ban="${esc(b)}"` : ""; };
    let LKS = null, LKG = null;   /* calculés à chaque dessin : liées à la désignation choisie / liées à n'importe quelle désignation */
    const lkIsLinked = (k, id) => !!(LKS && LKS[k] && LKS[k].has(id));
    const lkAnyLinked = (k, id) => !!(LKG && LKG[k] && LKG[k].has(id));
    /* lignes liées en haut du tableau (consigne 14) */
    /* ordre : lignes au rond coché (choisies ou liées) en haut, puis lignes cochées pour suppression, puis le reste */
    /* ordre : 1) rond coché (choisies), 2) cochées pour suppression, 3) liées (bleu), 4) le reste */
    /* ordre : 1) choisies, 2) cochées, 3) liées à ce qui est choisi, 4) autres lignes qu'on peut choisir
       (liées puis non liées), 5) en bas, les lignes grisées qu'on ne peut pas choisir */
    const lkRank = (k, r) => lkOn(k, r.id) ? 0 : r.on === true ? 1 : (lkHit(k, r.id) || (LK.des && lkIsLinked(k, r.id))) ? 2
      : (k !== "des" && lkBan(k, r.id)) ? 5 : lkAnyLinked(k, r.id) ? 3 : 4;
    const lkTop = (k, rows) => {
      if (!INS_EDIT) return rows;
      return rows.map((r, i) => ({ r, i, g: r.t ? 4 : lkRank(k, r) })).sort((a, b) => a.g - b.g || a.i - b.i).map(o => o.r);
    };
    /* rond d'en-tête : accessible seulement si aucune ligne du bloc n'est choisie (ou s'il est déjà actif) */
    const lkRdAll = k => {
      if (!INS_EDIT || !["des", "lot", "prim", "sec", "prd", "chg"].includes(k)) return "";
      const multi = k === "prd" || k === "chg";
      const on = multi ? (Object.keys(LK[k]).length > 0 && LK.allm && LK.allm[k]) : !!(LK.all && LK.all[k]);
      const busy = multi ? (Object.keys(LK[k]).length > 0 && !on) : !!LK[k];
      return `<span class="lk-rd lk-rdall${on ? " on" : ""}${busy ? " off" : ""}" data-rdall="${k}" role="button" aria-label="Choisir toutes les lignes liées"></span>`;
    };
    const lkRd = (k, r) => INS_EDIT && r && !r.t ? `<span class="lk-rd${lkOn(k, r.id) ? " on" : ""}${LK.des && lkIsLinked(k, r.id) ? " lnk" : ""}" data-rd="${k}" role="button" aria-label="Choisir pour la liaison"></span>` : "";
    /* case à droite : elle coche seulement (suppression, export, aperçu passent par le menu ⋯ du bloc) */
    const insDelCell = r => !r ? "" : `<input type="checkbox" class="ins-cb${r.t ? " ins-tcb" : ""}" ${!r.t && r.on === true ? "checked" : ""}>`;
    const insQCol = k => false;   /* plus de colonne QUANTITÉ DE LA TÂCHE : la quantité liée est la QPB du produit */
    const insRowHTML = (k, r, lvl) => {
      const cols = INS_COLS[k];
      const tcell = "";   /* plus de colonne T : un titre se crée en superposant deux lignes (FORMAT 61) */
      const sel = r && !r.t && lkOn(k, r.id);
      const dim = k === "des" && r && !r.t && LK.des && !sel;
      const qc = insQCol(k) ? `<td class="number lk-qc">${r ? `<input class="lk-q" data-qk="${k}" inputmode="decimal" value="${sel ? esc(LK[k][r.id] ?? "") : ""}" ${sel ? "" : "disabled"}>` : ""}</td>` : "";
      const lnk = r && !r.t && lkAnyLinked(k, r.id);   /* bleu = liée (à n'importe quelle désignation) */
      return `<tr class="ins-row${r ? "" : " ins-new"}${r && r.t ? " ins-title lv" + Math.min(3, dOf(r) + 1) : ""}${sel ? " lk-sel" : ""}${lnk ? " lk-link" : ""}${r && !r.t && lkHit(k, r.id) ? " lk-hit" : ""}${dim && !(r && lkHit(k, r.id)) ? " lk-dim" : ""}${lkBanAttr(k, r) ? " lk-ban" : ""}"
          data-ik="${k}" ${r ? `data-iid="${r.id}"` : ""}${lkBanAttr(k, r)}${k === "des" && r ? ` style="--d:${dOf(r)}"` : ""}>
        <td class="center ins-rdc">${k === "des" && r && r.t ? foldBtn(r) : lkRd(k, r)}</td>${tcell}${cols.map(c => insCell(k, r, c)).join("")}${qc}${INS_EDIT
          ? `<td class="center ins-delc">${insDelCell(r)}</td>` : ""}</tr>`;
    };
    /* lignes + sous-totaux de titres (désignations) */
    /* filtres / tri de colonne (mêmes menus que la version validée) :
       une ligne filtrée garde son titre ; un tri affiche la liste à plat */
    const insCfT = k => k === "des" ? "client" : k;
    const insCfCols = k => INS_COLS[k].map(c => [c[4], c[1],
      r => c[3] === "txt" ? (r[c[0]] || "") : (r.t ? "" : insCalc(k, r, c[0])), c[2]]);
    const insShown = k => {
      const t = insCfT(k);
      const normal = INS[k].filter(r => !r.t);
      const shown = cfApply(t, insCfCols(k), normal);
      const st = cfT(t);
      const sorting = !!(st.sort && !st.sort.def);
      const filtering = Object.keys(st.f).length > 0;
      if (k !== "des" || sorting) return shown;
      if (!filtering) return INS.des;
      const keep = new Set(shown.map(r => r.id));
      return INS.des.filter((r, i) => {
        if (!r.t) return keep.has(r.id);
        for (let j = i + 1; j < INS.des.length; j++) {
          const x = INS.des[j];
          if (dOf(x) <= dOf(r)) break;
          if (!x.t && keep.has(x.id)) return true;
        }
        return false;
      });
    };
    /* branche d'un titre : lignes (non titres) jusqu'au prochain titre de même niveau ou plus haut */
    const insBranch = t => {
      const out = [];
      for (let i = INS.des.indexOf(t) + 1; i < INS.des.length; i++) {
        const r = INS.des[i];
        if (dOf(r) <= dOf(t)) break;
        if (!r.t) out.push(r);
      }
      return out;
    };
    /* case d'un titre : cochée si toute sa branche l'est, à moitié (grisée) si une partie seulement */
    const insSyncTitles = () => {
      $("bdgClientBody")?.querySelectorAll("tr.ins-title[data-iid] input.ins-tcb").forEach(cb => {
        const t = INS.des.find(x => x.id === cb.closest("tr").dataset.iid);
        const b = t ? insBranch(t) : [];
        const n = b.filter(r => r.on === true).length;
        cb.checked = b.length ? n === b.length : !!(t && t.on === true);
        cb.indeterminate = n > 0 && n < b.length;
      });
    };
    const insSubOf = t => {
      const i0 = INS.des.indexOf(t);
      let ht = 0, ttc = 0;
      for (let i = i0 + 1; i < INS.des.length; i++) {
        const r = INS.des[i];
        if (dOf(r) <= dOf(t)) break;
        if (!r.t) { ht += insHT("des", r); ttc += insTTC("des", r); }
      }
      return { ht, ttc };
    };
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
    /* ===== titres repliables (FORMAT 60) : › replié / ⌄ déplié ; état mémorisé par budget ===== */
    const FOLD_KEY = "svi_fold_v1";
    const foldAll = () => { try { return JSON.parse(localStorage.getItem(FOLD_KEY) || "{}") || {}; } catch (e) { return {}; } };
    const foldGet = () => foldAll()[ref] || {};
    const foldSet = (id, on) => {
      const a = foldAll(), m = a[ref] || {};
      if (on) m[id] = 1; else delete m[id];
      a[ref] = m;
      try { localStorage.setItem(FOLD_KEY, JSON.stringify(a)); } catch (e) {}
    };
    /* titres parents de chaque ligne (désignations) */
    const insAnc = () => {
      const out = new Map(), stack = [];
      INS.des.forEach(r => {
        while (stack.length && dOf(stack[stack.length - 1]) >= dOf(r)) stack.pop();
        out.set(r.id, stack.slice());
        if (r.t) stack.push(r);
      });
      return out;
    };
    /* ligne cachée : un de ses titres parents est replié */
    const insHiddenFn = () => {
      const F = foldGet(), A = insAnc();
      return r => (A.get(r.id) || []).some(t => F[t.id]);
    };
    /* toucher › / ⌄ : replier / déplier (budget en instance, figé ou validé) */
    shell.__fold = INS ? id => { foldSet(id, !foldGet()[id]); keepScroll(() => insRenderClient()); } : null;
    if (!shell.__foldBound) {
      shell.__foldBound = true;
      shell.addEventListener("click", e => {
        const b = e.target.closest && e.target.closest(".ins-fold");
        if (!b || !shell.__fold) return;
        e.stopPropagation(); e.preventDefault();
        shell.__fold(b.dataset.fold);
      }, true);
    }
    const foldBtn = r => r && r.t ? `<span class="ins-fold${foldGet()[r.id] ? "" : " open"}" data-fold="${r.id}" role="button" aria-label="Replier / déplier">${foldGet()[r.id] ? "›" : "⌄"}</span>` : "";
    /* grands tableaux (détail produits / charges) : lignes dessinées par paquets, au fil du défilement (rapidité) */
    const INS_CHUNK = 120;
    const insMore = {};
    const insBodyHTML = k => {
      LKS = lkLinked(); LKG = insUsed(); LKH = lkHits();
      const rows = k === "des" ? insShown(k) : lkTop(k, insShown(k));
      const ncol = INS_COLS[k].length + 1;
      let html = "";
      if (k !== "des") {
        const first = rows.length > INS_CHUNK * 1.5 ? rows.slice(0, INS_CHUNK) : rows;
        insMore[k] = rows.slice(first.length);
        html = first.map(r => insRowHTML(k, r, 0)).join("");
      } else {
        const sub = t => {
          const { ht, ttc } = insSubOf(t);
          return `<tr class="ins-sub lv${Math.min(3, dOf(t) + 1)}" data-sub="${t.id}" style="--d:${dOf(t)}"><td></td><td></td>
            <td colspan="4" class="number">TOTAL ${esc(t.des || t.art || "")}</td>
            <td class="number ins-sht">${money(ht)}</td><td></td><td class="number ins-sttc">${money(ttc)}</td>${INS_EDIT ? "<td></td>" : ""}</tr>`;
        };
        /* désignations : les lignes choisies puis cochées montent en haut avec leur titre ;
           les autres lignes du même titre restent à leur place */
        const top = INS_EDIT ? rows.map((r, i) => ({ r, i })).filter(o => !o.r.t && lkRank(k, o.r) < 4)
          .sort((a, b) => lkRank(k, a.r) - lkRank(k, b.r) || a.i - b.i).map(o => o.r) : [];
        /* une ligne choisie ou liée à ce qui est choisi : ses titres repliés se déplient */
        { const A = insAnc(), F = foldGet();
          top.filter(r => { const g = lkRank(k, r); return g === 0 || g === 2; })
            .forEach(r => (A.get(r.id) || []).forEach(t => { if (F[t.id]) foldSet(t.id, false); })); }
        const hid = insHiddenFn();
        let head = "";
        const done = new Set();   /* titres déjà affichés en haut */
        if (top.length) {
          top.forEach(r => {
            const anc = [];
            for (let i = INS.des.indexOf(r) - 1, L = dOf(r); i >= 0 && L > 0; i--) {
              const t = INS.des[i];
              if (t.t && dOf(t) < L) { anc.unshift(t); L = dOf(t); if (L <= 0) break; }
            }
            /* un titre caché par un titre replié au-dessus n'apparaît pas, même en haut */
            anc.forEach(t => { if (!done.has(t.id) && !hid(t)) { done.add(t.id); head += insRowHTML(k, t, dOf(t)).replace('class="ins-row', 'class="ins-row ins-top'); } });
            /* titre replié : la ligne reste cachée (le titre, lui, est affiché avec ›) */
            if (!hid(r)) head += insRowHTML(k, r, dOf(r));
          });
        }
        const topIds = new Set(top.map(r => r.id));
        const rest = rows.filter(r => !topIds.has(r.id));
        /* plus de total par titre (seulement le total général) ; un titre n'apparaît qu'une fois,
           sauf s'il garde des lignes plus bas */
        const restIds = new Set(rest.filter(r => !r.t).map(r => r.id));
        const hasRest = t => { for (let i = INS.des.indexOf(t) + 1; i < INS.des.length && dOf(INS.des[i]) > dOf(t); i++) if (restIds.has(INS.des[i].id) && !hid(INS.des[i])) return true; return false; };
        html = head + insOrder(rest).filter(x => !x.sub && !hid(x.r) && !(x.r.t && done.has(x.r.id) && !hasRest(x.r)))
          .map(x => insRowHTML(k, x.r, x.lvl)).join("");
      }
      if (INS_EDIT) html += insRowHTML(k, null, 0);
      if (!rows.length && !INS_EDIT) html += `<tr><td colspan="${ncol}" class="empty">AUCUNE LIGNE</td></tr>`;
      return html;
    };
    const insFootHTML = k => {
      if (k === "qlt") return "";
      const rows = insShown(k).filter(r => !r.t);
      const ht = rows.reduce((t, r) => t + insHT(k, r), 0);
      const ttc = rows.reduce((t, r) => t + insTTC(k, r), 0);
      const n = INS_COLS[k].length + 1;
      return `<tr class="bdg-d-total-row">${"<td></td>".repeat(n - 4)}<td class="number">TOTAL</td>
        <td class="number">${money(ht)}</td><td class="number">${money(ttc - ht)}</td><td class="number">${money(ttc)}</td>${insQCol(k) ? "<td></td>" : ""}${INS_EDIT ? "<td></td>" : ""}</tr>`;
    };
    /* case d'en-tête : toutes les lignes visibles (hors titres) cochées */
    const insAllOn = k => { const v = insShown(k).filter(r => !r.t); return v.length > 0 && v.every(r => r.on === true); };
    const insTableHTML = k => {
      const cols = INS_COLS[k];
      const lead = 1;
      const qw = insQCol(k) ? 160 : 0;
      const w = 36 * lead + (INS_EDIT ? 40 : 0) + qw + cols.reduce((t, c) => t + cwGet(k === "des" ? "client" : k, c[4]), 0);
      const t = insCfT(k);
      /* DÉTAIL QUALITÉ (une seule colonne) : toute la largeur du bloc, sauf largeur réglée à la main */
      const full = k === "qlt" && !cwLoad()["qlt.qlt"];
      return `<table class="bdg-d-table ins-table" data-ik="${k}" style="width:${full ? "100%" : w + "px"}">
        <colgroup>${'<col style="width:36px">'.repeat(lead)}${cols.map(c => `<col data-w="${t}.${c[4]}" ${full ? "" : `style="width:${cwGet(t, c[4])}px"`}>`).join("")}${qw ? `<col style="width:${qw}px">` : ""}${INS_EDIT ? '<col style="width:40px">' : ""}</colgroup>
        <thead><tr><th class="center ins-rdc">${lkRdAll(k)}</th>${cols.map(c => cfHead(t, c[4], c[1], c[2])).join("")}${qw ? '<th class="number lk-qh">QUANTITÉ DE LA TÂCHE</th>' : ""}${INS_EDIT
          ? `<th class="center ins-hdel"><input type="checkbox" class="ins-cball" title="Tout cocher"${insAllOn(k) ? " checked" : ""}></th>` : ""}</tr></thead>
        <tbody>${insBodyHTML(k)}</tbody>
        <tfoot>${insFootHTML(k)}</tfoot></table>`;
    };
    const insRenderClient = () => {
      insNorm();
      const t = document.querySelector("#bdgClientTitle .ttl");
      const shownD = insShown("des");
      if (t) t.innerHTML = SVI_ICON.client + "DÉSIGNATIONS CLIENT " + svCnt(shownD.filter(r => !r.t).length, INS.des.filter(r => !r.t).length);
      lastShown.client = { cols: insCfCols("des"), rows: shownD, ins: true };
      lastClientKeys = new Set();
      /* même tableau que la version validée (identifiants gardés) */
      const tbl = $("bdgClientBody")?.closest("table");
      if (!tbl) return;
      const tmp = document.createElement("div");
      tmp.innerHTML = insTableHTML("des");
      const src = tmp.firstElementChild;
      tbl.classList.add("ins-table");
      tbl.dataset.ik = "des";
      tbl.style.width = src.style.width;
      $("bdgClientCols").innerHTML = src.querySelector("colgroup").innerHTML;
      $("bdgClientHead").innerHTML = src.querySelector("thead").innerHTML;
      $("bdgClientBody").innerHTML = src.querySelector("tbody").innerHTML;
      $("bdgClientFoot").innerHTML = src.querySelector("tfoot").innerHTML;
      insSyncTitles();
      insDim();
    };
    /* une désignation cochée : les autres lignes se grisent (une seule à la fois) */
    const insDim = () => {
      return;   /* mode SAISIE : la case sert à choisir des lignes ; le choix unique est en mode LIAISONS */
      const body = $("bdgClientBody");
      if (!body) return;
      const on = new Set(INS.des.filter(r => r.on === true && !r.t).map(r => r.id));
      /* les titres de la ligne cochée restent normaux */
      const stack = [];
      INS.des.forEach(r => {
        if (r.t) {
          while (stack.length && insLevel(stack[stack.length - 1].art) >= insLevel(r.art)) stack.pop();
          stack.push(r);
        } else if (r.on === true) stack.forEach(t => on.add(t.id));
      });
      body.querySelectorAll("tr[data-iid]").forEach(tr => {
        const dim = on.size > 0 && !on.has(tr.dataset.iid);
        tr.classList.toggle("ins-dim", dim);
        const cb = tr.querySelector("input.ins-cb");
        if (cb && INS_EDIT) cb.disabled = dim;
      });
    };
    const insRenderHier = only => {
      LKS = lkLinked(); LKG = insUsed(); LKH = lkHits();
      const col = (title, k) => {
        const list = lkTop(k, cfApply(k, [["v", title, r => r.v || "", ""]], INS[k]));
        lastShown.hier[k] = list.map(r => r.v || "");
        const on = !!cfT(k).f.v;
        return `
        <div class="bdg-h-col ins-hcol" data-ik="${k}">
          <div class="bdg-h-head ${on ? "cf-on" : ""}">${INS_EDIT ? `<span class="ins-rdc">${lkRdAll(k)}</span>` : ""}<span class="cf-wrap"><span class="cf-lab">${title}${svCnt(list.length, INS[k].length)}</span><span class="cf-btn"
            data-cf="${k}" data-col="v" role="button" aria-label="Trier / filtrer">${cfIcon}</span></span>${INS_EDIT
            ? `<span class="ins-hdel"><input type="checkbox" class="ins-cball" title="Tout cocher"${list.length && list.every(r => r.on === true) ? " checked" : ""}></span>` : ""}</div>
          ${list.map(r => `<div class="ins-li${INS_EDIT && LK[k] === r.id ? " lk-sel" : ""}${INS_EDIT && lkAnyLinked(k, r.id) ? " lk-link" : ""}${INS_EDIT && lkHit(k, r.id) ? " lk-hit" : ""}${INS_EDIT && LK[k] && LK[k] !== r.id && !(LK.des && lkIsLinked(k, r.id)) ? " lk-dim" : ""}${lkBanAttr(k, r) ? " lk-ban" : ""}" data-ik="${k}" data-iid="${r.id}"${lkBanAttr(k, r)}>
              ${INS_EDIT ? `<span class="ins-rdc">${lkRd(k, r)}</span><input class="ins-in" data-f="v" enterkeyhint="next" value="${esc(r.v || "")}" autocomplete="off">
                <span class="ins-delc">${insDelCell(r)}</span>` : `<span>${esc(r.v || "")}</span>`}
            </div>`).join("")}
          ${INS_EDIT ? `<div class="ins-li ins-new" data-ik="${k}"><span class="ins-rdc"></span>
              <input class="ins-in" data-f="v" enterkeyhint="next" placeholder="SAISIR ICI…" autocomplete="off"><span class="ins-delc"></span></div>`
            : (list.length ? "" : `<div class="bdg-h-item" style="opacity:.5;cursor:default">—</div>`)}
        </div>`;
      };
      const T = { lot: "LOT", prim: "ACTIVITÉ PRIMAIRE", sec: "ACTIVITÉ SECONDAIRE" };
      const old = only && $("bdgHier").querySelector(`.ins-hcol[data-ik="${only}"]`);
      if (old) {
        const tmp = document.createElement("div");
        tmp.innerHTML = col(T[only], only);
        old.replaceWith(tmp.firstElementChild);
        return;
      }
      $("bdgHier").style.gridTemplateColumns = "";
      $("bdgHier").innerHTML = col(T.lot, "lot") + col(T.prim, "prim") + col(T.sec, "sec");
    };
    const insMoreRows = k => {
      const rest = insMore[k];
      const tb = $("bdgTabBody")?.querySelector(`table.ins-table[data-ik="${k}"] tbody`);
      if (!rest || !rest.length || !tb) return;
      const part = rest.splice(0, INS_CHUNK * 2);
      LKS = lkLinked(); LKG = insUsed(); LKH = lkHits();
      const tmp = document.createElement("tbody");
      tmp.innerHTML = part.map(r => insRowHTML(k, r, 0)).join("");
      const before = tb.querySelector("tr.ins-new");
      [...tmp.children].forEach(tr => tb.insertBefore(tr, before));
      insMarkUnlinked();
    };
    if (!shell.__moreBound) {
      shell.__moreBound = true;
      shell.addEventListener("scroll", e => {
        const sc = e.target;
        if (!sc || !sc.matches || !sc.matches(".bdg-d-tabbody .bdg-d-scroll") || !shell.__insMore) return;
        if (sc.scrollTop + sc.clientHeight > sc.scrollHeight - 300) shell.__insMore();
      }, true);
    }
    /* LIAISONS VALIDÉES (onglet du détail) : chaîne, produits, charges, quantité, PPB, MPB HT ; DÉLIER */
    const insLinksHTML = () => {
      const D = id => INS.des.find(x => x.id === id) || {};
      /* quantité = somme des QPB de ses produits ; prix = PPB de la désignation si la liaison est primaire */
      const qOf = l => (l.prd || []).reduce((t, x) => { const p = INS.prd.find(r => r.id === x.id); return t + (p ? insPrdQ(p) : 0); }, 0);
      const pOf = l => insLinkPrim(INS, l) ? num(D(l.des).p || 0) : "";
      const LC = [["art", "ART", l => D(l.des).art || "", "center"], ["des", "DÉSIGNATION", l => D(l.des).des || "", ""],
        ["lot", "LOT", l => lkName("lot", l.lot), ""], ["prim", "ACTIVITÉ PRIMAIRE", l => lkName("prim", l.prim), ""],
        ["sec", "ACTIVITÉ SECONDAIRE", l => lkName("sec", l.sec), ""], ["np", "PRODUITS", l => (l.prd || []).length, "center"],
        ["nc", "CHARGES", l => (l.chg || []).length, "center"], ["lq", "QUANTITÉ", l => insFmt(qOf(l)), "number"],
        ["lp", "PPB", l => pOf(l) === "" ? "" : insFmt(pOf(l)), "number"], ["lm", "MPB HT", l => pOf(l) === "" ? "" : insFmt(qOf(l) * pOf(l)), "number"]];
      const W = { art: 70, des: 300, lot: 150, prim: 170, sec: 190, np: 110, nc: 110, lq: 120, lp: 110, lm: 140 };
      const oc = coOrder("lk_links", LC);
      const w = k => cwLoad()["lk_links." + k] || W[k] || 120;
      const D2 = id => INS.des.find(x => x.id === id) || {};
      const rows = cfApply("lk_links", LC, (INS.links || []).slice().sort((a, b) => desCmp(D2(a.des), D2(b.des)) || natCmp(lkName("lot", a.lot), lkName("lot", b.lot))));
      lastShown.detail = { cols: LC, rows, kind: "lnk" };
      /* case à droite (cocher seulement) : ✕ DÉLIER LES LIGNES COCHÉES par le menu ⋯ */
      const dw = INS_EDIT ? 40 : 0;
      const allOn = rows.length && rows.every(l => l.on === true);
      return `<table class="bdg-d-table lk-table lnk-table" style="width:${oc.reduce((t, c) => t + w(c[0]), 0) + dw}px">
        <colgroup>${oc.map(c => `<col data-w="lk_links.${c[0]}" style="width:${w(c[0])}px">`).join("")}${dw ? `<col style="width:${dw}px">` : ""}</colgroup>
        <thead><tr>${oc.map(c => cfHead("lk_links", c[0], c[1], c[3])).join("")}${dw ? `<th class="center"><input type="checkbox" class="lnk-cball"${allOn ? " checked" : ""}></th>` : ""}</tr></thead>
        <tbody>${rows.map(l => `<tr data-lid="${l.id}">${oc.map(c => `<td class="${c[3]}">${esc(c[2](l))}</td>`).join("")}${dw
          ? `<td class="center"><input type="checkbox" class="lnk-cb"${l.on === true ? " checked" : ""}></td>` : ""}</tr>`).join("")
          || `<tr><td colspan="${oc.length + (dw ? 1 : 0)}" class="empty">AUCUNE LIGNE</td></tr>`}</tbody></table>`;
    };
    /* IMPORT NON CRÉÉ (onglet du détail) : lignes du fichier qui n'ont pas pu être liées ;
       corrigées ici (case fautive encadrée), elles créent leur liaison et sortent de l'onglet */
    const INC_COLS = [["art", "ART", 60, "center"], ["dc", "DÉSIGNATION CLIENT", 240, ""], ["upb", "UPB", 60, "center"], ["lot", "LOT", 150, ""],
      ["prim", "ACTIVITÉ PRIMAIRE", 170, ""], ["sec", "ACTIVITÉ SECONDAIRE", 170, ""], ["type", "TYPE", 70, "center"], ["article", "ARTICLE", 80, "center"],
      ["des", "DÉSIGNATION", 220, ""], ["u", "UNITÉ", 60, "center"], ["nbr", "NBR", 60, "number"], ["d1", "DIM 1", 60, "number"], ["d2", "DIM 2", 60, "number"],
      ["d3", "DIM 3", 60, "number"], ["q", "QTE", 70, "number"], ["deb", "DÉBUT", 100, "center"], ["fin", "FIN", 100, "center"], ["pred", "PRÉDÉCESSEURS", 220, ""]];
    const insIncHTML = () => {
      /* justificatif : numéro de la ligne dans le tableau source + raison */
      const why = x => (x.line ? "LIGNE " + x.line + " — " : "") + (x.why || "");
      const UC = [...INC_COLS.map(c => [c[0], c[1], x => x.src[c[0]] || "", c[3]]), ["why", "RAISON", why, ""]];
      /* classement (FORMAT 92) : raisons par ordre alphabétique, puis lignes du fichier par ordre croissant ;
         doublons : les lignes en doublon d'une même ligne d'origine se suivent (groupes par ligne d'origine) */
      const incKey = x => {
        const w = String(x.why || ""), m = /IDENTIQUE À LA LIGNE (\d+)/.exec(w);
        return m ? "DOUBLON DANS LE FICHIER " + String(m[1]).padStart(7, "0") : w.replace(/^LIAISON DU BUDGET DÉLIÉE — /, "");
      };
      const incLn = x => { const n = parseInt(x.line, 10); return isNaN(n) ? Infinity : n; };
      const rows = cfApply("lk_inc", UC, (INS.inc || []).slice().sort((a, b) => incKey(a).localeCompare(incKey(b), "fr") || incLn(a) - incLn(b) || natCmp(a.src.dc, b.src.dc)));
      lastShown.detail = { cols: UC, rows, kind: "inc" };
      const w = k => cwLoad()["lk_inc." + k] || ((INC_COLS.find(c => c[0] === k) || [])[2]) || 320;
      const ed = INS_EDIT;
      const all = rows.length && rows.every(x => x.on === true);
      return `<table class="bdg-d-table ins-table lk-table inc-table" style="width:${UC.reduce((t, c) => t + w(c[0]), 0) + 40}px">
        <colgroup>${UC.map(c => `<col data-w="lk_inc.${c[0]}" style="width:${w(c[0])}px">`).join("")}<col style="width:40px"></colgroup>
        <thead><tr>${UC.map(c => cfHead("lk_inc", c[0], c[1], c[3])).join("")}<th class="center">${ed ? `<input type="checkbox" class="inc-cball"${all ? " checked" : ""}>` : ""}</th></tr></thead>
        <tbody>${rows.map(x => `<tr data-inc="${x.id}">${INC_COLS.map(c => `<td class="${c[3]} ins-td${(x.bad || []).includes(c[0]) ? " inc-bad" : ""}">${ed
            ? `<input class="ins-in inc-in ${c[3]}" data-f="${c[0]}" value="${esc(x.src[c[0]] || "")}" autocomplete="off">` : esc(x.src[c[0]] || "")}</td>`).join("")}
          <td class="inc-why">${esc(why(x))}</td><td class="center">${ed ? `<input type="checkbox" class="inc-cb"${x.on === true ? " checked" : ""}>` : ""}</td></tr>`).join("")
          || `<tr><td colspan="${UC.length + 1}" class="empty">AUCUNE LIGNE</td></tr>`}</tbody></table>`;
    };
    if (!shell.__incBound) {
      shell.__incBound = true;
      shell.addEventListener("change", e => {
        const X = shell.__incX;
        if (!X || !e.target.closest || !e.target.closest(".inc-table")) return;
        const tr = e.target.closest("tr[data-inc]");
        if (e.target.classList.contains("inc-cball")) {
          /* case d'en-tête : seulement les lignes affichées par le filtre (FORMAT 84) */
          const vi = new Set([...e.target.closest("table").querySelectorAll("tbody tr[data-inc]")].map(tr => tr.dataset.inc));
          (X.INS.inc || []).forEach(x => { if (vi.has(x.id)) x.on = e.target.checked; }); X.save(); X.refresh(); return; }
        const it = tr && (X.INS.inc || []).find(x => x.id === tr.dataset.inc);
        if (!it) return;
        if (e.target.classList.contains("inc-cb")) { it.on = e.target.checked; X.save(); return; }
        const inp = e.target.closest("input.inc-in");
        if (inp) {
          it.src[inp.dataset.f] = inp.value.trim().toUpperCase();
          /* toutes les cases effacées : la ligne est supprimée (FORMAT 90) */
          if (INC_COLS.every(c => String(it.src[c[0]] ?? "").trim() === "")) { X.INS.inc = (X.INS.inc || []).filter(x => x.id !== it.id); X.save(); X.refresh(); return; }
          const idx = [...inp.closest("tbody").querySelectorAll("tr[data-inc]")].indexOf(tr);
          const want = shell.__incNext && Date.now() - shell.__incNext.t < 1500 ? shell.__incNext : null;
          X.tryIt(it);
          /* le curseur va à la case fautive voulue ; ligne sortie : 1re case fautive de la ligne qui prend sa place */
          if (want) setTimeout(() => {
            const tb = shell.querySelector(".inc-table tbody");
            if (!tb) return;
            let el = tb.querySelector(`tr[data-inc="${want.id}"] input[data-f="${want.f}"]`);
            if (!el || !el.closest("td.inc-bad")) { const trs = [...tb.querySelectorAll("tr[data-inc]")]; const r2 = trs[Math.min(idx, trs.length - 1)]; el = r2 && r2.querySelector("td.inc-bad input.inc-in"); }
            if (el) { el.focus(); try { el.select(); } catch (err) {} el.scrollIntoView({ block: "nearest", inline: "nearest" }); }
          }, 30);
        }
      });
    }
    shell.__incX = INS && INS_EDIT ? { INS, save: () => insSave(), refresh: () => refreshAll(), tryIt: it => incTry(it) } : null;
    /* ===== AUCUN DOUBLON (FORMAT) : lots / activités / qualité = même intitulé ;
       désignations et charges = ART + DÉSIGNATION + UNITÉ ; produits = DÉSIGNATION + UNITÉ.
       Une saisie qui crée un doublon ouvre la fenêtre DOUBLON : RÉTABLIR ou FUSIONNER (liaisons reportées) ===== */
    const DUP_LAB = { des: "DÉSIGNATIONS CLIENT", lot: "LOTS", prim: "ACTIVITÉS PRIMAIRES", sec: "ACTIVITÉS SECONDAIRES", chg: "DÉTAIL CHARGES", prd: "DÉTAIL PRODUITS", qlt: "DÉTAIL QUALITÉ" };
    const dupKeyOf = (k, r) => {
      if (!r || r.t) return "";
      if (k === "lot" || k === "prim" || k === "sec" || k === "qlt") return U_(r.v);
      if (!U_(r.des)) return "";
      return impId(k, r);
    };
    const dupName = (k, r) => (k === "lot" || k === "prim" || k === "sec" || k === "qlt") ? U_(r.v) : [r.art, r.des].filter(Boolean).join(" — ") + (r.u ? " (" + U_(r.u) + ")" : "");
    const dupLinks = (k, id) => (INS.links || []).filter(l => k === "prd" || k === "chg" ? (l[k] || []).some(x => x.id === id) : l[k] === id).length;
    /* liaisons après fusion (drop → keep), avec contrôle de la règle A */
    const dupMerged = (k, keep, drop) => {
      const L = JSON.parse(JSON.stringify(INS.links || []));
      L.forEach(l => {
        if (k === "prd" || k === "chg") (l[k] || []).forEach(x => { if (x.id === drop) x.id = keep; });
        else if (l[k] === drop) l[k] = keep;
      });
      const out = [];
      L.forEach(l => {
        if (k === "prd" || k === "chg") { const seen = new Set(); l[k] = (l[k] || []).filter(x => !seen.has(x.id) && seen.add(x.id)); }
        const same = out.find(o => o.des === l.des && o.lot === l.lot && o.prim === l.prim && o.sec === l.sec);
        if (!same) { out.push(l); return; }
        ["prd", "chg"].forEach(f => (l[f] || []).forEach(x => { if (!(same[f] || []).some(y => y.id === x.id)) (same[f] = same[f] || []).push(x); }));
      });
      const P = new Map(), S = new Map();
      let err = "";
      out.forEach(l => {
        const tp = l.lot + "|" + l.prim;
        if (P.has(tp) && P.get(tp) !== l.des) err = "RÈGLE A : LA TÂCHE PRIMAIRE " + lkName("lot", l.lot) + " › " + lkName("prim", l.prim) + " SERAIT LIÉE À DEUX DÉSIGNATIONS.";
        P.set(tp, l.des);
        const ts = l.lot + "|" + l.sec;
        if (S.has(ts) && S.get(ts) !== l.des) err = err || "RÈGLE A : LA TÂCHE SECONDAIRE " + lkName("lot", l.lot) + " › " + lkName("sec", l.sec) + " SERAIT LIÉE À DEUX DÉSIGNATIONS.";
        S.set(ts, l.des);
      });
      return { links: out, err };
    };
    const dupMerge = (k, keep, drop, links) => {
      INS.links = links;
      /* délais : clés « lot|act. scd » reportées */
      if ((k === "lot" || k === "sec") && INS.dlp) {
        Object.keys(INS.dlp).forEach(key => {
          const [lo, pr] = key.split("|");
          const nk = (k === "lot" && lo === drop ? keep : lo) + "|" + (k === "sec" && pr === drop ? keep : pr);
          if (nk !== key) { INS.dlp[nk] = (INS.dlp[nk] || []).concat(INS.dlp[key]); delete INS.dlp[key]; }
        });
      }
      INS[k] = INS[k].filter(r => r.id !== drop);
      histLog("SAISIE", "DOUBLON FUSIONNÉ", DUP_LAB[k] + " — " + dupName(k, INS[k].find(r => r.id === keep) || {}));
    };
    /* fenêtre DOUBLON ; renvoie "merge" ou "back" */
    const dupAsk = async (k, keepR, dropR, opts = {}) => {
      const m = dupMerged(k, keepR.id, dropR.id);
      const v = await svChoose({ title: opts.title || "DOUBLON",
        html: `<div class="svc-sub">${esc(DUP_LAB[k])} : CE LIBELLÉ EXISTE DÉJÀ</div>
          <ul class="svc-list"><li>${esc(dupName(k, keepR))} — ${dupLinks(k, keepR.id)} LIAISON(S)</li><li>${esc(dupName(k, dropR))} — ${dupLinks(k, dropR.id)} LIAISON(S)${opts.typed ? " (SAISIE)" : ""}</li></ul>
          ${m.err ? `<div class="svc-sub svc-warn">FUSION IMPOSSIBLE : ${esc(m.err)}</div>` : `<div class="svc-sub">FUSIONNER : UNE SEULE LIGNE, TOUTES LES LIAISONS REPORTÉES.</div>`}`,
        noCancel: true,
        buttons: [{ v: "back", label: opts.backLabel || "RÉTABLIR", tone: "neutral" }, { v: "merge", label: "FUSIONNER", tone: "danger", disabled: !!m.err }] });
      if (v === "merge" && !m.err) { dupMerge(k, keepR.id, dropR.id, m.links); return "merge"; }
      return "back";
    };
    if (!shell.__dupBound) {
      shell.__dupBound = true;
      /* valeur avant saisie */
      shell.addEventListener("focusin", e => {
        const X = shell.__dupX, inp = e.target.closest && e.target.closest("input.ins-in");
        if (!X || !inp) return;
        const h = inp.closest("[data-iid]"), k = h && (h.dataset.ik || h.closest("[data-ik]")?.dataset.ik);
        const r = k && X.INS[k] && X.INS[k].find(x => x.id === h.dataset.iid);
        shell.__dupOld = r ? { k, id: r.id, row: { ...r } } : null;
      });
      shell.addEventListener("change", async e => {
        const X = shell.__dupX, inp = e.target.closest && e.target.closest("input.ins-in");
        if (!X || !inp || !["v", "des", "art", "u"].includes(inp.dataset.f)) return;
        const h = inp.closest("[data-ik]"), k = h && h.dataset.ik;
        if (!k || !DUP_LAB[k]) return;
        const id = inp.closest("[data-iid]")?.dataset.iid || (X.INS[k][X.INS[k].length - 1] || {}).id;
        const r = X.INS[k].find(x => x.id === id);
        /* FORMAT 88 : même désignation (ART + DÉSIGNATION ; produit : DÉSIGNATION) avec une autre unité → refusée */
        if (k === "des" && r && !r.t && U_(r.des) && U_(r.u)) {
          const o = X.INS[k].find(x => x.id !== r.id && !x.t && U_(x.des) === U_(r.des) && U_(x.u) && U_(x.u) !== U_(r.u));
          if (o) {
            const f = inp.dataset.f, old = shell.__dupOld && shell.__dupOld.id === r.id ? shell.__dupOld.row : null;
            svToast(U_(r.des) + " EXISTE DÉJÀ EN " + U_(o.u) + " : UNITÉ " + U_(r.u) + " REFUSÉE.", 4500, inp);
            r[f] = old ? (old[f] ?? "") : "";
            X.save(); X.refresh();
            return;
          }
        }
        const key = dupKeyOf(k, r);
        if (!key) return;
        const other = X.INS[k].find(x => x.id !== r.id && dupKeyOf(k, x) === key);
        if (!other) return;
        const old = shell.__dupOld && shell.__dupOld.id === r.id ? shell.__dupOld.row : null;
        const v = await X.ask(k, other, r, { typed: true, backLabel: old ? "RÉTABLIR" : "EFFACER LA SAISIE" });
        if (v === "back") {
          if (old) Object.assign(r, old); else X.INS[k] = X.INS[k].filter(x => x.id !== r.id);
        }
        X.save(); X.refresh();
      }, true);
    }
    /* ===== CLASSEMENT PAR DÉFAUT (FORMAT) : désignations client par ART croissant (ordre naturel ; ART vide en tête ;
       même ART → par désignation), en gardant les titres (classement à l'intérieur de chaque titre) ;
       autres tableaux par désignation / intitulé croissant. Appliqué à l'ouverture (une fois), après un import
       ou un collage ; le glisser reste libre ensuite. ===== */
    const natCmp = (a, b) => String(a ?? "").localeCompare(String(b ?? ""), "fr", { numeric: true, sensitivity: "base" });
    const desCmp = (a, b) => {
      const A = String(a.art ?? "").trim(), B = String(b.art ?? "").trim();
      if (!A !== !B) return A ? 1 : -1;   /* ART vide en tête */
      return natCmp(A, B) || natCmp(a.des, b.des);
    };
    const insSortKind = k => {
      if (!INS || !INS[k] || INS[k].length < 2) return;
      if (k !== "des") { INS[k].sort((a, b) => natCmp(k === "lot" || k === "prim" || k === "sec" || k === "qlt" ? a.v : a.des, k === "lot" || k === "prim" || k === "sec" || k === "qlt" ? b.v : b.des) || natCmp(a.u, b.u)); return; }
      insNorm();
      /* arbre (niveau r.d) → frères classés → remis à plat */
      const root = { kids: [] }, stack = [root];
      INS.des.forEach(r => {
        const d = Number(r.d) || 0;
        while (stack.length - 1 > d) stack.pop();
        const node = { r, kids: [] };
        stack[stack.length - 1].kids.push(node);
        if (r.t) stack.push(node);
      });
      const flat = [];
      const walk = n => { n.kids.sort((x, y) => desCmp(x.r, y.r)); n.kids.forEach(c => { flat.push(c.r); walk(c); }); };
      walk(root);
      INS.des.splice(0, INS.des.length, ...flat);
    };
    const insSortAll = () => ["des", "lot", "prim", "sec", "chg", "prd", "qlt"].forEach(insSortKind);
    /* espaces nettoyés une fois dans les données déjà enregistrées (FORMAT) */
    if (INS && INS_EDIT && !INS.cleanV1) {
      ["des", "lot", "prim", "sec", "chg", "prd", "qlt"].forEach(k => (INS[k] || []).forEach(r => ["art", "des", "u", "v"].forEach(f => { if (typeof r[f] === "string") r[f] = sviClean(r[f]); })));
      INS.cleanV1 = true; insSave();
    }
    if (INS && INS_EDIT && !INS.sortedV1) { insSortAll(); INS.sortedV1 = true; insSave(); }
    shell.__dupX = INS && INS_EDIT ? { INS, ask: (k, a, b, o) => dupAsk(k, a, b, o), save: () => insSave(), refresh: () => refreshAll() } : null;
    /* doublons déjà présents (anciens budgets, imports) : proposés à l'ouverture, un par un ; IGNORER = plus redemandé pendant la séance */
    const dupExisting = async () => {
      if (!INS || !INS_EDIT || shell.__dupBusy) return;
      shell.__dupBusy = true;
      try {
        let skip = {};
        try { skip = JSON.parse(sessionStorage.getItem("svi_dupskip") || "{}"); } catch (e) {}
        let changed = false;
        for (const k of Object.keys(DUP_LAB)) {
          const seen = new Map();
          for (const r of INS[k].slice()) {
            const key = dupKeyOf(k, r);
            if (!key) continue;
            const first = seen.get(key);
            if (!first) { seen.set(key, r); continue; }
            const sk = ref + "|" + k + "|" + key;
            if (skip[sk]) continue;
            const v = await dupAsk(k, first, r, { title: "DOUBLON EXISTANT", backLabel: "IGNORER" });
            if (v === "merge") changed = true;
            else { skip[sk] = 1; try { sessionStorage.setItem("svi_dupskip", JSON.stringify(skip)); } catch (e) {} }
          }
        }
        if (changed) { insSave(); refreshAll(); }
      } finally { shell.__dupBusy = false; }
    };
    if (INS && INS_EDIT) setTimeout(dupExisting, 600);
    /* LIGNES NON LIÉES (onglet du détail) : BLOC, LIBELLÉ ; cases à cocher, suppression par le menu ⋯ */
    const UNL_BLOC = { des: "DÉSIGNATION CLIENT", lot: "LOT", prim: "ACTIVITÉ PRIMAIRE", sec: "ACTIVITÉ SECONDAIRE", prd: "PRODUIT", chg: "CHARGE" };
    const insUnlRows = () => {
      const u = insUnlinked(), out = [];
      /* RÉF. : ART (désignations, charges) sinon numéro de la ligne dans son bloc */
      const pos = {};
      INS_LINKED_KINDS.forEach(k => { pos[k] = new Map(INS[k].filter(r => !r.t).map((r, i) => [r.id, i + 1])); });
      INS_LINKED_KINDS.forEach(k => u[k].forEach(r => out.push({ k, r, id: r.id,
        ref: ((k === "des" || k === "chg") && String(r.art || "").trim()) ? String(r.art).trim() : "N° " + (pos[k].get(r.id) || ""),
        bloc: UNL_BLOC[k], lib: (k === "lot" || k === "prim" || k === "sec") ? (r.v || "") : [r.art, r.des].filter(Boolean).join(" — ") + (r.u ? " (" + r.u + ")" : "") })));
      return out;
    };
    const insUnlHTML = () => {
      const UC = [["ref", "RÉF.", x => x.ref, "center"], ["bloc", "BLOC", x => x.bloc, ""], ["lib", "LIBELLÉ", x => x.lib, ""]];
      const W = { ref: 90, bloc: 200, lib: 520 };
      const oc = coOrder("lk_unl", UC);
      const w = k => cwLoad()["lk_unl." + k] || W[k] || 160;
      const rows = cfApply("lk_unl", UC, insUnlRows().sort((a, b) => natCmp(a.bloc, b.bloc) || natCmp(a.lib, b.lib)));
      lastShown.detail = { cols: UC, rows, kind: "unl" };
      const dw = INS_EDIT ? 40 : 0;
      const all = rows.length && rows.every(x => x.r.on === true);
      return `<table class="bdg-d-table lk-table unl-table" style="width:${oc.reduce((t, c) => t + w(c[0]), 0) + dw}px">
        <colgroup>${oc.map(c => `<col data-w="lk_unl.${c[0]}" style="width:${w(c[0])}px">`).join("")}${dw ? `<col style="width:${dw}px">` : ""}</colgroup>
        <thead><tr>${oc.map(c => cfHead("lk_unl", c[0], c[1], c[3])).join("")}${dw ? `<th class="center"><input type="checkbox" class="unl-cball"${all ? " checked" : ""}></th>` : ""}</tr></thead>
        <tbody>${rows.map(x => `<tr data-uk="${x.k}" data-uid="${x.id}" class="unl-go" title="Aller à la ligne">${oc.map(c => `<td class="${c[3]}">${esc(c[2](x))}</td>`).join("")}${dw
          ? `<td class="center"><input type="checkbox" class="unl-cb"${x.r.on === true ? " checked" : ""}></td>` : ""}</tr>`).join("")
          || `<tr><td colspan="${oc.length + (dw ? 1 : 0)}" class="empty">AUCUNE LIGNE</td></tr>`}</tbody></table>`;
    };
    if (!shell.__unlBound) {
      shell.__unlBound = true;
      shell.addEventListener("change", e => {
        const X = shell.__unl;
        if (!X) return;
        const cb = e.target.closest && e.target.closest("input.unl-cb, input.unl-cball");
        if (!cb) return;
        if (cb.classList.contains("unl-cball")) {
          cb.closest("table").querySelectorAll("tbody tr[data-uk]").forEach(tr => { const r = X.INS[tr.dataset.uk].find(x => x.id === tr.dataset.uid); if (r) r.on = cb.checked; });
        } else {
          const tr = cb.closest("tr[data-uk]");
          const r = tr && X.INS[tr.dataset.uk].find(x => x.id === tr.dataset.uid);
          if (r) r.on = cb.checked;
        }
        X.save(); X.refresh();
      });
    }
    shell.__unl = INS ? { INS, save: () => insSave(), refresh: () => refreshAll(),
      /* toucher une ligne : l'écran va à la ligne dans son bloc, encadrée un instant */
      go: (k, id) => {
        const find = () => shell.querySelector(`[data-ik="${k}"][data-iid="${id}"]`);
        const show = () => {
          const el = find();
          if (!el) { svToast("LIGNE CACHÉE (TITRE REPLIÉ OU FILTRE) : DÉPLIER OU EFFACER LE FILTRE."); return; }
          el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
          el.classList.remove("unl-flash"); void el.offsetWidth; el.classList.add("unl-flash");
          setTimeout(() => el.classList.remove("unl-flash"), 2200);
        };
        if (k === "prd" || k === "chg") {
          const b = shell.querySelector(`#bdgTabs .bdg-d-tab[data-tab="${k}"]`);
          if (b) b.click();
          setTimeout(show, 120);
        } else show();
      } } : null;
    if (!shell.__lnkCbBound) {
      shell.__lnkCbBound = true;
      shell.addEventListener("change", e => {
        const cb = e.target.closest && e.target.closest("input.lnk-cb, input.lnk-cball");
        if (!cb || !shell.__unl) return;
        const L = shell.__unl.INS.links || [];
        const trs = cb.classList.contains("lnk-cball") ? [...cb.closest("table").querySelectorAll("tbody tr[data-lid]")] : [cb.closest("tr[data-lid]")];
        trs.forEach(tr => { const l = L.find(x => x.id === tr.dataset.lid); if (l) l.on = cb.checked; });
        shell.__unl.save(); shell.__unl.refresh();
      });
    }
    if (!shell.__unlGoBound) {
      shell.__unlGoBound = true;
      shell.addEventListener("click", e => {
        const tr = e.target.closest && e.target.closest("tr.unl-go");
        if (!tr || e.target.closest("input, .cf-btn") || !shell.__unl) return;
        shell.__unl.go(tr.dataset.uk, tr.dataset.uid);
      });
    }
    /* modification en attente : produits / charges choisis, ou délais changés et pas encore validés */
    const lkDlyDirty = () => {
      const D = LK.dlpDraft || {};
      const clean = l => JSON.stringify((l || []).map(p => [p.deb || "", p.fin || ""]).sort());
      return Object.keys(D).some(k => clean(D[k]) !== clean((INS.dlp || {})[k]));
    };
    /* que fait le bouton ? (consigne 37 : construire ET détruire passent par le bouton)
       - chaîne complète + produits / charges nouveaux, ou délais modifiés : ✓ VALIDER
       - sinon, les éléments choisis désignent des liaisons existantes : ✕ DÉLIER
         · produits / charges choisis : ils sont retirés des liaisons qui contiennent tous les éléments choisis
         · aucun produit / charge : ces liaisons sont détruites */
    const lkPlan = () => {
      const L = INS.links || [], keys = ["des", "lot", "prim", "sec"].filter(k => LK[k]);
      const P = Object.keys(LK.prd), C = Object.keys(LK.chg);
      const full = keys.length === 4;
      const anyAll = Object.values(LK.all || {}).some(Boolean);
      if (!keys.length && !P.length && !C.length && !anyAll) return { mode: "none" };
      const M = L.filter(l => keys.every(k => l[k] === LK[k]));
      const inM = (k, id) => M.some(l => (l[k] || []).some(x => x.id === id));
      const addP = P.filter(id => !inM("prd", id)), addC = C.filter(id => !inM("chg", id));
      const remP = P.filter(id => inM("prd", id)), remC = C.filter(id => inM("chg", id));
      const nAdd = addP.length + addC.length, nRem = remP.length + remC.length;
      if (nAdd && nRem) return { mode: "mix" };
      if (lkDlyDirty() && !nRem && (!nAdd || full)) return { mode: "add", full, same: full && M.length > 0 };
      if (nAdd) return full ? { mode: "add", full, same: M.length > 0 } : { mode: "incomplete" };
      if (nRem) {
        const hit = M.filter(l => (l.prd || []).some(x => remP.includes(x.id)) || (l.chg || []).some(x => remC.includes(x.id)));
        return { mode: "del", links: hit, remP, remC, n: hit.length };
      }
      if ((!keys.length && !anyAll) || !M.length) return { mode: "none" };
      return { mode: "del", links: M, remP: [], remC: [], n: M.length };
    };
    const lkPending = () => { const m = lkPlan().mode; return m === "add" || lkDlyDirty(); };
    /* bandeau CHAÎNE … ✓ VALIDER LA LIAISON (visible quand une désignation est choisie) */
    const insRenderChain = () => {
      const el = $("insChain");
      if (!el) return;
      el.hidden = false;
      /* la place est toujours réservée : rien ne bouge quand le bandeau apparaît */
      const any = INS_EDIT && (LK.des || LK.lot || LK.prim || LK.sec || Object.keys(LK.prd).length || Object.keys(LK.chg).length || Object.values(LK.all || {}).some(Boolean));
      el.classList.toggle("off", !any);
      if (!any) { el.innerHTML = '<button type="button" class="lk-go" disabled>✓ VALIDER LA LIAISON</button>'; return; }
      const pl = lkPlan();
      const nPrd = Object.keys(LK.prd).length;
      let btn;
      if (pl.mode === "del") btn = `<button type="button" class="lk-go lk-del-go">✕ DÉLIER (${pl.n})</button>`;
      else if (pl.mode === "add") {
        const ok = lkDlyDirty() || (pl.same || nPrd > 0);
        btn = `<button type="button" class="lk-go" ${ok ? "" : "disabled"}>${pl.same || (!pl.full && lkDlyDirty()) ? "✓ VALIDER LES MODIFICATIONS" : "✓ VALIDER LA LIAISON"}</button>`;
      } else if (pl.mode === "mix") btn = `<button type="button" class="lk-go lk-mix">✓ VALIDER LA LIAISON</button>`;
      else btn = `<button type="button" class="lk-go" disabled>✓ VALIDER LA LIAISON</button>`;
      el.innerHTML = `${LK.des ? '<button type="button" class="lk-info" title="Voir la liaison" aria-label="Voir la liaison">i</button>' : ""}${btn}`;
    };
    const insRenderTab = () => {
      ["chg", "prd", "qlt"].forEach(k => {
        const b = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="${k}"]`);
        if (b) b.innerHTML = (SVI_ICON[k] || "") + tabs.find(x => x.key === k).title + (k === "prd" ? ' <b class="req-star">*</b>' : "") + " " + svCnt(insShown(k).length, INS[k].filter(r => !r.t).length);
      });
      { const b = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="dly"]`);
        if (b) b.innerHTML = (SVI_ICON.dly || "") + "DÉTAIL DÉLAIS " + svCnt(INS_EDIT ? (insDlyKey() ? insDlyList(insDlyKey()).length : insDlyRecap() ? insDlyRecap().filter(x => x.deb || x.fin).length : dlyKeys().length) : insTasks().length); }
      /* IMPORT NON CRÉÉ : visible seulement s'il reste des lignes */
      { const b = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="inc"]`), n = (INS.inc || []).length;
        if (b) { b.innerHTML = (SVI_ICON.hier || "") + "IMPORT NON CRÉÉ " + svCnt(n); b.hidden = !n; b.style.display = n ? "" : "none"; }
        if (!n && active === "inc") { active = "prd"; try { localStorage.setItem("svi_dtab_v1", "prd"); } catch (e) {} document.querySelectorAll("#bdgTabs .bdg-d-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === active)); } }
      { const b = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="lnk"]`);
        if (b) b.innerHTML = (SVI_ICON.hier || "") + "LIAISONS VALIDÉES " + svCnt((INS.links || []).length); }
      sviMarkEmptyTabs(shell);
      /* onglet actif (liaisons validées, lignes non liées, import non créé) : « retenues/total » une fois dessiné */
      setTimeout(() => {
        const ls = lastShown.detail;
        if (!ls || !["lnk", "unl", "inc"].includes(ls.kind) || ls.kind !== active) return;
        const b = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="${active}"] .svi-cnt`);
        const tot = active === "lnk" ? (INS.links || []).length : active === "inc" ? (INS.inc || []).length : insUnlCount();
        if (b) b.outerHTML = svCnt(ls.rows.length, tot);
      }, 0);
      if (active === "dly") {
        /* délais : saisis ici (périodes par tâche secondaire ; tâche primaire choisie = récapitulatif) */
        body.innerHTML = `<div class="bdg-d-scroll">${insDlyHTML(INS_EDIT, shell.__insDly && shell.__insDly.err)}</div>`;
        return;
      }
      if (active === "lnk") { body.innerHTML = `<div class="bdg-d-scroll">${insLinksHTML()}</div>`; return; }
      if (active === "unl") { body.innerHTML = `<div class="bdg-d-scroll">${insUnlHTML()}</div>`; insMarkUnlinked(); return; }
      if (active === "inc") { body.innerHTML = `<div class="bdg-d-scroll">${insIncHTML()}</div>`; return; }
      body.innerHTML = `<div class="bdg-d-scroll">${insTableHTML(active)}</div>`;
      shell.__insMore = () => insMoreRows(active);
      lastShown.detail = { cols: insCfCols(active), rows: insShown(active), kind: active, ins: true };
      insMarkUnlinked();
    };
    /* met à jour les montants calculés, sous-totaux et totaux sans redessiner
       (la saisie en cours garde le clavier) */
    const insLive = (k, tr, r) => {
      const tbl = tr.closest("table");
      /* case fautive de la ligne encadrée en rouge (FORMAT 75) */
      if (k === "prd" || k === "chg") {
        const er = insRowErr(k, r);
        tr.querySelectorAll("td.ins-td").forEach(td => {
          const on = !!er && td.querySelector("input")?.dataset.f === er.f;
          td.classList.toggle("ins-bad", on);
          if (on) td.dataset.why = er.m; else delete td.dataset.why;
        });
      }
      tr.querySelectorAll("input.ins-in").forEach(inp => {
        const f = inp.dataset.f;
        const c = INS_COLS[k].find(x => x[0] === f);
        if (!c || inp === document.activeElement) return;
        const qAuto = (f === "q" && (k === "prd" || k === "des")) || (f === "p" && k === "prd") || (f === "tva" && k === "prd");
        if (c[3] === "calc" || qAuto) inp.value = r.t ? "" : insFmt(insCalc(k, r, f));
      });
      if (k === "des") {
        tbl.querySelectorAll("tr.ins-sub").forEach(s => {
          const t = INS.des.find(x => x.id === s.dataset.sub);
          if (!t) return;
          const i0 = INS.des.indexOf(t);
          let ht = 0, ttc = 0;
          for (let i = i0 + 1; i < INS.des.length; i++) {
            const x = INS.des[i];
            if (dOf(x) <= dOf(t)) break;
            if (!x.t) { ht += insHT(k, x); ttc += insTTC(k, x); }
          }
          s.querySelector(".ins-sht").textContent = money(ht);
          s.querySelector(".ins-sttc").textContent = money(ttc);
        });
      }
      const ft = tbl.querySelector("tfoot");
      if (ft) ft.innerHTML = insFootHTML(k);
    };
    /* redessine le bloc (structure changée) si le doigt n'est plus dedans */
    const insRedraw = k => {
      /* seul ce bloc est redessiné : la saisie ailleurs garde le clavier */
      const box = k === "des" ? shell.querySelector(".bdg-d-client-scroll")
        : (k === "chg" || k === "prd" || k === "qlt") ? body.querySelector(".bdg-d-scroll")
        : $("bdgHier")?.querySelector(`.ins-hcol[data-ik="${k}"]`);
      const top = box ? box.scrollTop : 0;
      const x = window.scrollX, y = window.scrollY;
      if (k === "des") insRenderClient();
      else if (k === "chg" || k === "prd" || k === "qlt") insRenderTab();
      else insRenderHier(k);
      if (k === "prim" && insTwins()) { insSave(); insRenderHier("sec"); }
      insMarkUnlinked();
      const nb = k === "des" ? shell.querySelector(".bdg-d-client-scroll")
        : (k === "chg" || k === "prd" || k === "qlt") ? body.querySelector(".bdg-d-scroll")
        : $("bdgHier")?.querySelector(`.ins-hcol[data-ik="${k}"]`);
      if (nb) nb.scrollTop = top;
      window.scrollTo(x, y);
    };
    /* ligne vide (FORMAT 90) : toutes ses cases saisissables effacées (TVA par défaut, PCB / TVA de CHS ne comptent pas) */
    const INS_ENTRY = { des: ["art", "des", "u"], chg: ["art", "des", "u", "q"], prd: ["des", "u", "nbr", "d1", "d2", "d3"], lot: ["v"], prim: ["v"], sec: ["v"], qlt: ["v"] };
    const insRowEmpty = (k, r) => r.t ? !String(r.art || "").trim() && !String(r.des || "").trim()
      : (INS_ENTRY[k] || Object.keys(r).filter(f => !["id", "on", "t", "tw", "d"].includes(f))).concat(k === "chg" && !r.chs ? ["p"] : [])
        .every(f => String(r[f] ?? "").trim() === "");
    const insClean = k => {
      const used = ["des", "lot", "prim", "sec", "prd", "chg"].includes(k) ? insUsed()[k] : new Set();
      const empty = r => insRowEmpty(k, r) && !used.has(r.id);
      const before = INS[k].length;
      INS[k] = INS[k].filter(r => !empty(r));
      return INS[k].length !== before;
    };
    shell.__ins = INS_EDIT ? { INS, rowErr: (k, r) => insRowErr(k, r), cleanLinks: () => insCleanLinks(), insDim, insShown, insId, insSave, insNum, insLive, insRedraw, insClean, insRowHTML, insLevel, insBranch, insSyncTitles,
      /* ligne utilisée par une liaison (validée, ou déliée mais pas encore validée) : suppression interdite */
      isUsed: (k, id) => {
        if (!["des", "lot", "prim", "sec", "prd", "chg"].includes(k)) return false;
        let bak = null;
        try { bak = LK.linksBak; } catch (e) {}
        return [INS.links || [], bak || []].some(L => L.some(l => k === "prd" || k === "chg" ? (l[k] || []).some(x => x.id === id) : l[k] === id));
      } } : null;
    if (!shell.__insBound) {
      shell.__insBound = true;
      shell.addEventListener("input", e => {
        const X = shell.__ins;
        const inp = e.target.closest("input.ins-in");
        if (!X || !inp) return;
        const holder = inp.closest("[data-ik]");
        if (!holder) return;   /* délais : gérés à part */
        const k = holder.dataset.ik;
        const f = inp.dataset.f;
        const c = (X.insRowHTML && ["des", "chg", "prd"].includes(k)) ? true : false;
        let r = holder.dataset.iid ? X.INS[k].find(x => x.id === holder.dataset.iid) : null;
        if (!r) {
          /* première frappe dans la ligne vide : la ligne est créée */
          r = { id: X.insId(), on: false };   /* nouvelle ligne : décochée par défaut */
          if (k === "des") {
            r.t = false; r.tva = 20;   /* TVA 20 % par défaut */
            /* niveau : celui de la dernière ligne (ou dans le dernier titre) */
            const last = X.INS.des[X.INS.des.length - 1];
            r.d = !last ? 0 : last.t ? (Number(last.d) || 0) + 1 : (Number(last.d) || 0);
          }
          X.INS[k].push(r);
          holder.dataset.iid = r.id;
          holder.classList.remove("ins-new");
          inp.removeAttribute("placeholder");
          const cbc = holder.querySelector(".ins-cbc");
          if (cbc) cbc.innerHTML = `<input type="checkbox" class="ins-cb">`;
          const tc = holder.querySelector(".ins-tc");
          if (tc) tc.innerHTML = `<span class="ins-t" role="button" title="Ligne titre">T</span>`;
          if (k === "des") X.insDim();
          /* nouvelle ligne vide dessous */
          if (c) {
            const tmp = document.createElement("tbody");
            tmp.innerHTML = X.insRowHTML(k, null, 0);
            holder.after(tmp.firstElementChild);
          } else {
            const d = document.createElement("div");
            d.className = "ins-li ins-new";
            d.dataset.ik = k;
            d.innerHTML = `<span class="ins-cbc"></span><input class="ins-in" data-f="v" enterkeyhint="next" placeholder="SAISIR ICI…" autocomplete="off">`;
            holder.after(d);
            const lab = holder.closest(".ins-hcol")?.querySelector(".svi-cnt");
            if (lab) lab.textContent = X.INS[k].length;
          }
        }
        const isNum = inp.getAttribute("inputmode") === "decimal";
        r[f] = isNum ? inp.value.trim() : inp.value.toUpperCase();
        if (isNum) r[f] = r[f] === "" ? "" : X.insNum(r[f]);
        if (c) X.insLive(k, holder, r);
        X.insSave();
      });
      shell.addEventListener("click", e => {
        const X = shell.__ins;
        if (!X) return;
        /* 🗑 d'une ligne */
        const xb = e.target.closest(".ins-x");
        if (xb) {
          e.stopPropagation();
          const h = xb.closest("[data-iid]");
          const k = h?.dataset.ik;
          const r = k && X.INS[k].find(x => x.id === h.dataset.iid);
          if (!r) return;
          const br = r.t ? X.insBranch(r).filter(x => x.on === true) : [];
          /* une donnée ne se supprime que si elle est déliée de partout */
          const used = [r, ...br].filter(x => !x.t && X.isUsed(k, x.id));
          if (used.length) { svToast("SUPPRESSION REFUSÉE : " + (used[0].des || used[0].v || used[0].art || "") + (used.length > 1 ? " ET " + (used.length - 1) + " AUTRE(S)" : "") + " EST LIÉ(E). DÉLIEZ D'ABORD."); return; }
          svConfirm({ title: r.t ? "SUPPRIMER LE TITRE" : "SUPPRIMER LA LIGNE", text: (r.des || r.v || r.art || "") + (br.length ? " ET " + br.length + " LIGNE(S) COCHÉE(S)" : ""), ok: "SUPPRIMER" }).then(go => {
            /* ANNULER : la ligne est décochée (la case revient à la place du 🗑) */
            if (!go) { if (r.t) X.insBranch(r).forEach(x => { x.on = false; }); r.on = false; X.insSave(); X.insRedraw(k); return; }
            const gone = new Set([r.id, ...br.map(x => x.id)]);
            X.INS[k] = X.INS[k].filter(x => !gone.has(x.id));
            X.cleanLinks(); X.insSave(); X.insRedraw(k);
          });
          return;
        }
        /* case d'en-tête et 🗑 d'en-tête (lignes cochées) */
        const ca = e.target.closest("input.ins-cball");
        const xa = e.target.closest(".ins-xall");
        if (ca || xa) {
          e.stopPropagation();
          const box = e.target.closest("table.ins-table, .ins-hcol");
          const k = box?.dataset.ik;
          if (!k) return;
          const vis = k === "lot" || k === "prim" || k === "sec"
            ? [...box.querySelectorAll(".ins-li[data-iid]")].map(li => X.INS[k].find(x => x.id === li.dataset.iid)).filter(Boolean)
            : X.insShown(k).filter(x => !x.t);
          if (ca) {
            vis.forEach(r => { r.on = ca.checked; });
            X.insSave(); X.insRedraw(k);
            return;
          }
          const del = vis.filter(r => r.on === true);
          if (!del.length) return;
          const used = del.filter(r => X.isUsed(k, r.id));
          if (used.length) { svToast("SUPPRESSION REFUSÉE : " + used.length + " LIGNE(S) COCHÉE(S) SONT LIÉES. DÉLIEZ-LES D'ABORD."); return; }
          svConfirm({ title: "SUPPRIMER LES LIGNES COCHÉES", text: del.length + " LIGNE(S) SERONT SUPPRIMÉES.", ok: "SUPPRIMER" }).then(go => {
            /* ANNULER : toutes les lignes sont décochées */
            if (!go) { vis.forEach(r => { r.on = false; }); X.insSave(); X.insRedraw(k); return; }
            const ids = new Set(del.map(r => r.id));
            X.INS[k] = X.INS[k].filter(x => !ids.has(x.id));
            X.cleanLinks(); X.insSave(); X.insRedraw(k);
          });
          return;
        }
        const t = e.target.closest(".ins-t");
        const cb = e.target.closest("input.ins-cb");
        if (!t && !cb) return;
        e.stopPropagation();
        const holder = e.target.closest("[data-ik]");
        const k = holder.dataset.ik;
        const r = X.INS[k].find(x => x.id === holder.dataset.iid);
        if (!r) return;
        if (cb && r.t) {
          /* case d'un titre : coche / décoche toute sa branche ; titre vide : le titre lui-même */
          const br = X.insBranch(r);
          r.on = cb.checked;   /* le titre lui-même est coché (copier / couper / déplacer l'emportent) */
          br.forEach(x => { x.on = cb.checked; });
          X.insSave(); X.insRedraw(k);
          return;
        }
        if (cb) {
          r.on = cb.checked; X.insSave(); if (k === "des") { X.insDim(); X.insSyncTitles(); }
          /* ligne cochée : elle remonte (après les lignes au rond coché) */
          X.insRedraw(k);
          return;
          /* case d'en-tête à jour */
          const box = cb.closest("table.ins-table, .ins-hcol");
          const all = box?.querySelector("input.ins-cball");
          if (all) all.checked = [...box.querySelectorAll("[data-iid] input.ins-cb")].every(c => c.checked);
          return;
        }
        /* ligne titre : unité, quantité, prix, TVA masqués et verrouillés, mais gardés
           (retour possible) ; seule la validation du budget les efface */
        r.t = !r.t;
        X.insSave();
        X.insRedraw(k);
      }, true);
      /* touche Entrée : case suivante (fin de ligne : 1re case de la ligne suivante) */
      /* (Entrée / Tab : voir la règle générale FORMAT 93, plus bas) */
      /* le doigt quitte un bloc : lignes vidées retirées, titres et sous-totaux remis en place */
      shell.addEventListener("focusout", e => {
        const X = shell.__ins;
        const inp = e.target.closest && e.target.closest("input.ins-in");
        if (!X || !inp) return;
        const box = inp.closest("table.ins-table, .ins-hcol");
        const k = box?.dataset.ik;
        if (!k) return;
        setTimeout(() => {
          if (box.contains(document.activeElement) || shell.__insDragging) return;
          X.insClean(k);
          X.insSave();
          X.insRedraw(k);
        }, 0);
      });
    }

    /* =========================================================
       BUDGET EN INSTANCE : MODE SAISIE / MODE LIAISONS
       - SAISIE : les 8 tableaux (désignations, lots, activités primaires,
         secondaires, charges, produits, qualité, délais) ; lignes non liées
         hachurées, à supprimer avant FIGER ;
       - LIAISONS : chaîne désignation › lot › primaire › secondaire › produits
         (+ charges facultatives), validée par ✓ ; liste des liaisons, délier.
       ========================================================= */
    /* page unique : la saisie et les liaisons se font sur la même page */
    const INS_MODE = () => "saisie";
    /* lignes utilisées par au moins une liaison validée */
    const insUsed = () => {
      const u = { des: new Set(), lot: new Set(), prim: new Set(), sec: new Set(), chg: new Set(), prd: new Set() };
      (INS.links || []).forEach(l => {
        u.des.add(l.des); u.lot.add(l.lot); u.prim.add(l.prim); u.sec.add(l.sec);
        (l.prd || []).forEach(x => u.prd.add(x.id));
        (l.chg || []).forEach(x => u.chg.add(x.id));
      });
      /* un titre est « utilisé » si une de ses lignes l'est */
      insNorm();
      const stack = [];
      INS.des.forEach(r => {
        while (stack.length && dOf(stack[stack.length - 1]) >= dOf(r)) stack.pop();
        if (r.t) stack.push(r);
        else if (u.des.has(r.id)) stack.forEach(t => u.des.add(t.id));
      });
      return u;
    };
    const INS_LINKED_KINDS = ["des", "lot", "prim", "sec", "chg", "prd"];
    const insUnlinked = () => {
      const u = insUsed(), out = {};
      /* activité secondaire jumelle créée automatiquement : pas comptée « non liée » (elle suit son activité primaire) */
      INS_LINKED_KINDS.forEach(k => { out[k] = INS[k].filter(r => !u[k].has(r.id) && !(k === "sec" && r.tw)); });
      return out;
    };
    /* FIGER (FORMAT 96) : impossible tant qu'il reste une cause ; chaque cause = libellé, nombre, onglet où aller */
    const insFigeBlocks = () => {
      const out = [];
      if (!INS || !INS_EDIT) return out;
      const nU = insUnlCount();
      if (nU) out.push({ lab: "LIGNES NON LIÉES", n: nU, go: "unl" });
      const nI = (INS.inc || []).length;
      if (nI) out.push({ lab: "LIGNES DANS IMPORT NON CRÉÉ", n: nI, go: "inc" });
      const linked = new Set((INS.links || []).map(l => l.lot + "|" + l.sec));
      const keys = Object.keys(INS.dlp || {}).filter(k => (INS.dlp[k] || []).length);
      const nl = keys.filter(k => !linked.has(k));
      if (nl.length) out.push({ lab: "TÂCHES AVEC DÉLAIS NON LIÉES", n: nl.length, go: "dly", list: nl });
      const np = keys.reduce((t, k) => t + INS.dlp[k].filter(p => !p.deb || !p.fin).length, 0);
      if (np) out.push({ lab: "PÉRIODES SANS DÉBUT OU SANS FIN", n: np, go: "dly" });
      const nD = INS.des.filter(r => !r.t && !String(r.u || "").trim()).length;
      if (nD) out.push({ lab: "DÉSIGNATIONS CLIENT SANS UPB", n: nD, go: "des" });
      ["prd", "chg"].forEach(k => { const n = INS[k].filter(r => !r.t && insRowErr(k, r)).length; if (n) out.push({ lab: "LIGNES EN ERREUR — " + (k === "prd" ? "DÉTAIL PRODUITS" : "DÉTAIL CHARGES"), n, go: k }); });
      try { if (lkPending()) out.push({ lab: "MODIFICATION EN ATTENTE DE ✓ VALIDER", n: 1, go: "" }); } catch (e) {}
      return out;
    };
    const insFigeWhy = () => {
      const B = insFigeBlocks();
      document.getElementById("svConf")?.remove();
      const d = document.createElement("div");
      d.id = "svConf";
      d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true"><button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
        <div class="svc-t">FIGER IMPOSSIBLE</div>
        <div class="svc-x">${B.map((b, i) => `<button type="button" class="fz-why" data-i="${i}"><span>${esc(b.lab)}${b.list ? " : " + esc(b.list.slice(0, 3).map(dlyName).join(" ; ")) + (b.list.length > 3 ? "…" : "") : ""}</span>${svCnt(b.n)}</button>`).join("")}</div>
        <div class="svc-f"><button type="button" class="svc-b svc-ok svc-neutral" data-x>FERMER</button></div></div>`;
      document.body.appendChild(d);
      d.addEventListener("click", e => {
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
        const it = e.target.closest(".fz-why");
        if (!it) return;
        const b = B[+it.dataset.i];
        d.remove();
        if (!b.go) return;
        if (b.go === "des") { shell.querySelector(".bdg-d-client-scroll")?.scrollIntoView({ block: "start", behavior: "smooth" }); return; }
        if (b.go === "dly") { LK.lot = LK.sec = LK.prim = null; }
        const t = shell.querySelector(`#bdgTabs .bdg-d-tab[data-tab="${b.go}"]`);
        if (t) { t.click(); t.scrollIntoView({ block: "start", behavior: "smooth" }); }
      });
    };
    shell.__figeWhy = () => insFigeWhy();
    shell.__figeBlocks = () => insFigeBlocks();
    const insUnlCount = () => { const n = insUnlinked(); return INS_LINKED_KINDS.reduce((t, k) => t + n[k].length, 0); };
    /* liaisons dont une ligne a disparu : nettoyées */
    const insCleanLinks = () => {
      const has = k => new Set(INS[k].map(r => r.id));
      const H = Object.fromEntries(INS_LINKED_KINDS.map(k => [k, has(k)]));
      INS.links = (INS.links || []).filter(l => H.des.has(l.des) && H.lot.has(l.lot) && H.prim.has(l.prim) && H.sec.has(l.sec))
        .map(l => ({ ...l, prd: (l.prd || []).filter(x => H.prd.has(x.id)), chg: (l.chg || []).filter(x => H.chg.has(x.id)) }));
    };
    /* hachures « NON LIÉE » (mode SAISIE) et bouton 🗑 NON LIÉES de l'en-tête */
    const insMarkUnlinked = () => {
      if (!INS) return;
      const u = insUsed();
      shell.querySelectorAll(".ins-table[data-ik] tr[data-iid], .ins-hcol .ins-li[data-iid]").forEach(el => {
        const k = el.dataset.ik || el.closest("[data-ik]")?.dataset.ik;
        if (!u[k]) return;
        el.classList.toggle("ins-unl", !u[k].has(el.dataset.iid));
      });
      /* FIGER grisé tant que l'onglet LIGNES NON LIÉES n'est pas à 0 */
      const lk = $("instLock");
      if (lk && INS_EDIT) { const B = insFigeBlocks(); lk.disabled = false; lk.classList.toggle("off", B.length > 0); lk.title = B.length ? "FIGER IMPOSSIBLE : TOUCHER POUR VOIR POURQUOI" : "Figer (lecture seule)"; }
      const tb = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="unl"]`);
      /* LIGNES NON LIÉES : visible seulement s'il reste des lignes */
      if (tb) {
        const nU = insUnlCount();
        tb.innerHTML = (SVI_ICON.hier || "") + "LIGNES NON LIÉES " + svCnt(nU);
        tb.hidden = !nU; tb.style.display = nU ? "" : "none";
        if (!nU && active === "unl") {
          active = "prd";
          try { localStorage.setItem("svi_dtab_v1", "prd"); } catch (e) {}
          setTimeout(() => refreshAll(), 0);
        }
      }
      if (shell.__markCut) shell.__markCut();
    };

    /* ---------- DÉTAIL DÉLAIS (instance) : une ligne par activité secondaire ---------- */
    const dIso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const dAdd = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return dIso(d); };
    const dDiff = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
    const dFr = iso => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "";
    /* ---------- DÉTAIL DÉLAIS (instance) : une ou plusieurs périodes par TÂCHE PRIMAIRE
       (tâche primaire = un lot associé à une activité primaire, d'après les liaisons validées).
       Saisie en mode LIAISONS seulement ; périodes sans chevauchement dans une même tâche. ---------- */
    const dParse = v => {
      const t = String(v || "").trim();
      if (!t) return "";
      let m = t.match(/^(\d{1,2})[\/.\- ](\d{1,2})[\/.\- ](\d{2,4})$/) || t.match(/^(\d{2})(\d{2})(\d{4})$/);
      if (!m) return null;
      let y = Number(m[3]); if (y < 100) y += 2000;
      const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
      if (isNaN(d) || d.getDate() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1) return null;
      return dIso(d);
    };
    const insTasks = () => {
      const m = new Map();
      (INS.links || []).forEach(l => {
        const k = l.lot + "|" + l.sec;
        if (!m.has(k)) m.set(k, { key: k, lot: (INS.lot.find(x => x.id === l.lot) || {}).v || "", sec: (INS.sec.find(x => x.id === l.sec) || {}).v || "" });
      });
      return [...m.values()];
    };
    /* tâche SECONDAIRE choisie (désignation + lot + activité secondaire), seulement si elle est déjà liée */
    /* tâche secondaire choisie par les ronds (lot + activité secondaire), liée ou non : le planning peut précéder les liaisons */
    const insDlyKey = () => LK.lot && LK.sec ? LK.lot + "|" + LK.sec : null;
    /* ===== PLANNING (FORMAT 94) : prédécesseurs (plusieurs, communs à toutes les périodes de la tâche) ;
       une tâche commence au plus tôt le jour de la fin de tous ses prédécesseurs ===== */
    const dlyName = key => { const [lo, se] = String(key).split("|"); return lkName("lot", lo) + " › " + lkName("sec", se); };
    const dlyPreds = key => ((INS.dpred || {})[key] || []).slice();
    const dlySuccs = key => Object.keys(INS.dpred || {}).filter(k => (INS.dpred[k] || []).includes(key));
    const dlyList = key => (LK.dlpDraft && LK.dlpDraft[key]) || (INS.dlp || {})[key] || [];
    const dlyFin = key => dlyList(key).map(p => p.fin).filter(Boolean).sort().pop() || "";
    const dlyDeb = key => dlyList(key).map(p => p.deb).filter(Boolean).sort()[0] || "";
    const dlyPredFin = key => dlyPreds(key).map(dlyFin).filter(Boolean).sort().pop() || "";
    /* la tâche k est-elle (de proche en proche) un prédécesseur de c ? (boucle interdite) */
    const dlyReach = (c, k, seen = new Set()) => { if (c === k) return true; if (seen.has(c)) return false; seen.add(c); return dlyPreds(c).some(x => dlyReach(x, k, seen)); };
    const dlyDraftKey = key => { LK.dlpDraft = LK.dlpDraft || {}; if (!LK.dlpDraft[key]) LK.dlpDraft[key] = ((INS.dlp || {})[key] || []).map(p => ({ ...p })); return LK.dlpDraft[key]; };
    /* décaler les tâches suivantes (durées gardées) pour qu'elles commencent après la fin de leurs prédécesseurs */
    const dlyShift = from => {
      const q = [from], moved = [];
      let guard = 0;
      while (q.length && guard++ < 500) {
        const k = q.shift();
        dlySuccs(k).forEach(S => {
          const need = dlyPredFin(S), st = dlyDeb(S);
          if (need && st && st < need) {
            const dd = dDiff(st, need);
            dlyDraftKey(S).forEach(p => { if (p.deb) p.deb = dAdd(p.deb, dd); if (p.fin) p.fin = dAdd(p.fin, dd); });
            moved.push(S); q.push(S);
          }
        });
      }
      return moved;
    };
    /* tâches à afficher dans le planning : liées, avec périodes ou avec prédécesseurs */
    const dlyKeys = () => {
      const S = new Set();
      (INS.links || []).forEach(l => S.add(l.lot + "|" + l.sec));
      Object.keys(INS.dlp || {}).forEach(k => { if ((INS.dlp[k] || []).length) S.add(k); });
      Object.keys(LK.dlpDraft || {}).forEach(k => { if ((LK.dlpDraft[k] || []).length) S.add(k); });
      Object.keys(INS.dpred || {}).forEach(k => { S.add(k); (INS.dpred[k] || []).forEach(x => S.add(x)); });
      const ok = k => { const [lo, se] = k.split("|"); return INS.lot.some(x => x.id === lo) && INS.sec.some(x => x.id === se); };
      return [...S].filter(ok);
    };
    /* tâche supprimée (lot ou activité secondaire) : ses délais et ses liens de prédécesseurs disparaissent */
    const dlyClean = () => {
      if (!INS) return false;
      const L = new Set(INS.lot.map(x => x.id)), Sc = new Set(INS.sec.map(x => x.id));
      const ok = k => { const [lo, se] = String(k).split("|"); return L.has(lo) && Sc.has(se); };
      let ch = false;
      Object.keys(INS.dlp || {}).forEach(k => { if (!ok(k)) { delete INS.dlp[k]; ch = true; } });
      Object.keys(INS.dpred || {}).forEach(k => {
        if (!ok(k)) { delete INS.dpred[k]; ch = true; return; }
        const n = INS.dpred[k].filter(ok);
        if (n.length !== INS.dpred[k].length) { INS.dpred[k] = n; ch = true; }
      });
      return ch;
    };
    /* tâche primaire choisie (sans activité secondaire) : récapitulatif des dates de ses tâches secondaires */
    const insDlyRecap = () => {
      if (!(LK.des && LK.lot && LK.prim && !LK.sec)) return null;
      const secs = [...new Set((INS.links || []).filter(l => l.des === LK.des && l.lot === LK.lot && l.prim === LK.prim).map(l => l.sec))];
      if (!secs.length) return null;
      const rows = [];
      secs.forEach(se => {
        const ps = [...insDlyList(LK.lot + "|" + se)].sort((a, b) => String(a.deb || "9").localeCompare(String(b.deb || "9")));
        const sv = (INS.sec.find(x => x.id === se) || {}).v || "";
        if (!ps.length) rows.push({ sec: sv, per: "", deb: "", fin: "", dur: "" });
        ps.forEach((p, i) => rows.push({ sec: sv, per: i + 1, deb: p.deb || "", fin: p.fin || "", dur: p.deb && p.fin ? dDiff(p.deb, p.fin) : "" }));
      });
      return rows;
    };
    /* périodes affichées : brouillon en cours (à valider) ou périodes validées */
    const insDlyList = key => (LK.dlpDraft && LK.dlpDraft[key]) || (INS.dlp || {})[key] || [];
    const insDlyHTML = (edit, err) => {
      INS.dlp = INS.dlp || {};
      if (edit) {
        /* saisie : les périodes de la tâche primaire choisie (les ronds du haut disent laquelle) */
        const key = insDlyKey();
        const rc = !key && insDlyRecap();
        if (rc) {
          const rows = cfApply("dlyr", DLY_COLS_R, rc);
          lastShown.detail = { cols: DLY_COLS_R, rows, kind: "dly" };
          const ds = rc.map(x => x.deb).filter(Boolean).sort(), fs = rc.map(x => x.fin).filter(Boolean).sort();
          const d0 = ds[0] || "", f0 = fs[fs.length - 1] || "";
          return `<div class="dly-recap-t">RÉCAPITULATIF — ${esc(lkName("lot", LK.lot))} › ${esc(lkName("prim", LK.prim))}</div>` + dlyTable(rows, x => ({ sec: esc(x.sec), per: x.per, deb: esc(dFr(x.deb)), fin: esc(dFr(x.fin)), dur: x.dur }), () => "", false, DLY_COLS_R)
            + `<div class="dly-recap-f"><span>DÉBUT : <b>${esc(dFr(d0)) || "—"}</b></span><span>FIN : <b>${esc(dFr(f0)) || "—"}</b></span><span>DURÉE : <b>${d0 && f0 ? dDiff(d0, f0) + " J" : "—"}</b></span></div>`;
        }
        if (!key) {
          /* PLANNING : une ligne par tâche secondaire ; toucher une ligne = saisir ses périodes ;
             toucher PRÉDÉCESSEURS = les choisir */
          const P = dlyKeys().map(k => { const d0 = dlyDeb(k), f0 = dlyFin(k); const [lo, se] = k.split("|");
            return { key: k, lot: lkName("lot", lo), sec: lkName("sec", se), pred: dlyPreds(k).map(dlyName).join(" ; "), deb: d0, fin: f0, dur: d0 && f0 ? dDiff(d0, f0) : "" }; })
            .sort((a, b) => String(a.deb || "9").localeCompare(String(b.deb || "9")) || natCmp(a.lot, b.lot) || natCmp(a.sec, b.sec));
          const rows = cfApply("dlyp", DLY_COLS_P, P);
          lastShown.detail = { cols: DLY_COLS_P, rows, kind: "dly" };
          return `<div class="dly-recap-t">PLANNING — TOUCHER UNE TÂCHE POUR SAISIR SES PÉRIODES, TOUCHER PRÉDÉCESSEURS POUR LES CHOISIR</div>`
            + dlyTable(rows, x => ({ lot: esc(x.lot), sec: esc(x.sec), pred: `<span class="dly-pred" data-key="${esc(x.key)}">${esc(x.pred) || "<i>CHOISIR…</i>"}</span>`, deb: esc(dFr(x.deb)), fin: esc(dFr(x.fin)), dur: x.dur }),
              x => `class="dly-task" data-key="${esc(x.key)}"`, false, DLY_COLS_P)
            + `<div class="dly-add"><button type="button" class="dly-pred-new">+ AJOUTER UNE TÂCHE AU PLANNING</button></div>`;
        }
        const ps = key ? [...insDlyList(key)].sort((a, b) => String(a.deb || "9").localeCompare(String(b.deb || "9"))) : [];
        const all = ps.map((p, i) => ({ task: key, pid: p.id, on: p.on === true, per: i + 1, deb: p.deb || "", fin: p.fin || "", dur: p.deb && p.fin ? dDiff(p.deb, p.fin) : "" }));
        if (key) all.push({ task: key, pid: "", per: "", deb: "", fin: "", dur: "", nw: true });
        const rows = cfApply("dlyi", DLY_COLS_I, all);
        lastShown.detail = { cols: DLY_COLS_I, rows: rows.filter(x => !x.nw), kind: "dly" };
        const inp = (x, f) => `<input class="ins-in dlp-in${f === "dur" ? " number" : " center"}" data-task="${x.task}" data-pid="${x.pid}" data-f="${f}" type="text"
            ${f === "dur" ? "" : "readonly"} inputmode="${f === "dur" ? "numeric" : "none"}" placeholder="${x.nw && (f === "deb" || f === "fin") ? "SAISIR ICI…" : f === "dur" ? "" : "JJ/MM/AAAA"}" value="${esc(f === "dur" ? x.dur : dFr(x[f]))}">`;
        const pf = dlyPredFin(key);
        return `<div class="dly-recap-t">${esc(dlyName(key))} — PRÉDÉCESSEURS : <span class="dly-pred" data-key="${esc(key)}">${esc(dlyPreds(key).map(dlyName).join(" ; ")) || "<i>CHOISIR…</i>"}</span>${pf ? " — DÉBUT AU PLUS TÔT LE " + esc(dFr(pf)) : ""}</div>`
          + dlyTable(rows, x => ({ per: x.per, deb: inp(x, "deb"), fin: inp(x, "fin"), dur: inp(x, "dur"),
          __td_deb: " ins-td", __td_fin: " ins-td", __td_dur: " ins-td",
          __cb: x.pid ? `<input type="checkbox" class="dlp-cb" data-task="${x.task}" data-pid="${x.pid}" ${x.on ? "checked" : ""}>` : "",
          __x: "" }),
          x => `class="${x.nw ? "ins-new" : ""}"`, true, DLY_COLS_I);
      }
      const all = [];
      insTasks().forEach(t => {
        const ps = [...(INS.dlp[t.key] || [])].sort((a, b) => String(a.deb || "9").localeCompare(String(b.deb || "9")));
        ps.forEach((p, i) => all.push({ task: t.key, pid: p.id, on: p.on === true, lot: t.lot, sec: t.sec, per: i + 1, deb: p.deb || "", fin: p.fin || "",
          dur: p.deb && p.fin ? dDiff(p.deb, p.fin) : "" }));
        /* mode SAISIE : seulement les périodes saisies (en mode LIAISONS) */
        if (edit) all.push({ task: t.key, pid: "", lot: t.lot, sec: t.sec, per: "", deb: "", fin: "", dur: "", nw: true });
      });
      /* ordre par défaut : chronologique (début), puis alphabétique */
      all.sort((a, b) => String(a.deb || "9").localeCompare(String(b.deb || "9")) || a.lot.localeCompare(b.lot, "fr") || a.sec.localeCompare(b.sec, "fr") || (a.nw - b.nw));
      const rows = cfApply("dlys", DLY_COLS_S, all);
      lastShown.detail = { cols: DLY_COLS_S, rows: rows.filter(x => !x.nw), kind: "dly" };
      const inp = (x, f) => edit
        ? `<input class="ins-in dlp-in${f === "dur" ? " number" : " center"}" data-task="${x.task}" data-pid="${x.pid}" data-f="${f}" type="text"
            ${f === "dur" ? "" : "readonly"} inputmode="${f === "dur" ? "numeric" : "none"}" placeholder="${x.nw && f === "deb" ? "SAISIR ICI…" : f === "dur" ? "" : "JJ/MM/AAAA"}" value="${esc(f === "dur" ? x.dur : dFr(x[f]))}">`
        : esc(f === "dur" ? x.dur : dFr(x[f]));
      const td = edit ? " ins-td" : "";
      return (err ? `<div class="lk-err dlp-err">${esc(err)}</div>` : "") + dlyTable(rows, x => ({ lot: esc(x.lot), sec: esc(x.sec), per: x.per,
        deb: inp(x, "deb"), fin: inp(x, "fin"), dur: inp(x, "dur"),
        __td_deb: td, __td_fin: td, __td_dur: td,
        __cb: edit && x.pid ? `<input type="checkbox" class="dlp-cb" data-task="${x.task}" data-pid="${x.pid}" ${x.on ? "checked" : ""}>` : "",
        __x: "" }),
        x => `class="${x.nw ? "ins-new" : ""}"`, edit, DLY_COLS_S);
    };
    /* saisie : début + durée → fin ; fin → durée ; refus d'un chevauchement dans la même tâche */
    if (!shell.__dlyBound) {
      shell.__dlyBound = true;
      shell.addEventListener("change", e => {
        const X = shell.__insDly;
        const cb = e.target.closest && e.target.closest("input.dlp-cb, input.dlp-cball");
        if (cb && X) {
          const D = X.draft();
          const boxes = cb.classList.contains("dlp-cball") ? [...cb.closest("table").querySelectorAll("input.dlp-cb")] : [cb];
          boxes.forEach(b => { const p = (D[b.dataset.task] || []).find(x => x.id === b.dataset.pid); if (p) { p.on = cb.checked; b.checked = cb.checked; } });
          const all = cb.closest("table").querySelector("input.dlp-cball");
          const list = [...cb.closest("table").querySelectorAll("input.dlp-cb")];
          if (all) all.checked = list.length > 0 && list.every(b => b.checked);
          X.insSave();
          return;
        }
        const i = e.target.closest && e.target.closest("input.dlp-in");
        if (!i || !X) return;
        const D = X.draft();
        const list = D[i.dataset.task] = D[i.dataset.task] || [];
        let p = list.find(x => x.id === i.dataset.pid);
        const q = p ? { ...p } : { id: X.insId(), deb: "", fin: "" };
        const f = i.dataset.f, v = i.value.trim();
        X.err = "";
        if (f === "dur") {
          if (v === "") q.fin = "";
          else if (!/^\d+$/.test(v)) X.err = "DURÉE NON VALIDE : NOMBRE DE JOURS ATTENDU.";
          else if (q.deb) q.fin = X.dAdd(q.deb, Number(v));
          else X.err = "SAISISSEZ D'ABORD LA DATE DE DÉBUT.";
        } else {
          const iso = X.dParse(v);
          if (iso === null) X.err = "DATE NON VALIDE : FORMAT JJ/MM/AAAA.";
          else q[f] = iso;
        }
        if (!X.err && q.deb && q.fin && q.fin < q.deb) X.err = "LA FIN EST AVANT LE DÉBUT.";
        if (!X.err && (q.deb || q.fin)) {
          /* une date seule ne doit pas tomber dans une autre période de la même tâche */
          const a = q.deb || q.fin, z = q.fin || q.deb;
          const o = list.find(x => x.id !== q.id && x.deb && x.fin && (q.deb && q.fin ? a < x.fin && x.deb < z : a >= x.deb && a < x.fin));
          if (o) X.err = "PÉRIODE REFUSÉE : ELLE CHEVAUCHE LA PÉRIODE DU " + X.dFr(o.deb) + " AU " + X.dFr(o.fin) + ".";
        }
        /* deux périodes de la même tâche ne se touchent pas (fin le jour du début, ou la veille, d'une autre) */
        if (!X.err && q.deb && q.fin) {
          const o = list.find(x => x.id !== q.id && x.deb && x.fin && (q.fin === x.deb || X.dAdd(q.fin, 1) === x.deb || q.deb === x.fin || q.deb === X.dAdd(x.fin, 1)));
          if (o) X.err = "PÉRIODE REFUSÉE : ELLE TOUCHE LA PÉRIODE DU " + X.dFr(o.deb) + " AU " + X.dFr(o.fin) + " — PROLONGER CETTE PÉRIODE.";
        }
        /* prédécesseurs : la tâche commence au plus tôt le jour de leur fin */
        if (!X.err && q.deb) { const pf = X.predFin(i.dataset.task); if (pf && q.deb < pf) X.err = "DÉBUT REFUSÉ : LES PRÉDÉCESSEURS FINISSENT LE " + X.dFr(pf) + "."; }
        if (X.err) { svToast(X.err, 4000, i); X.err = ""; X.render(); return; }
        const apply = () => { if (p) Object.assign(p, q); else if (q.deb || q.fin) list.push(q); };
        /* la fin dépasse le début d'une tâche suivante : on propose de garder la durée et de décaler les suivantes */
        const late = q.fin ? X.succs(i.dataset.task).filter(S => { const d0 = X.deb(S); return d0 && d0 < q.fin; }) : [];
        if (late.length) {
          svChoose({ title: "TÂCHES SUIVANTES", html: `<div class="svc-sub">LA FIN DU ${esc(X.dFr(q.fin))} DÉPASSE LE DÉBUT DE :</div><ul class="svc-list">${late.map(k => `<li>${esc(X.name(k))} — ${esc(X.dFr(X.deb(k)))}</li>`).join("")}</ul><div class="svc-sub">RESPECTER LA DURÉE ET DÉCALER CES TÂCHES ET TOUTES CELLES QUI VIENNENT APRÈS ?</div>`,
            buttons: [{ v: "shift", label: "DÉCALER LES TÂCHES SUIVANTES", tone: "neutral" }] }).then(v => {
            if (v === "shift") { apply(); const mv = X.shift(i.dataset.task); if (mv.length) svToast(mv.length + " TÂCHE(S) DÉCALÉE(S) — À VALIDER.", 3000); }
            X.render();
          });
          X.render();
          return;
        }
        apply();
        X.render();
        /* le curseur passe à la case suivante de la même période */
        const nx = { deb: "fin", fin: "dur" }[f];
        const el = !X.err && nx && shell.querySelector(`input.dlp-in[data-pid="${q.id}"][data-f="${nx}"]`);
        if (el) { el.focus(); try { el.select(); } catch (err) {} }
      });
      /* SUPPRIMER LES LIGNES COCHÉES (menu ⋯) : périodes cochées */
      shell.__insDlyDel = () => {
        const X = shell.__insDly;
        if (!X) return;
        const D = X.draft();
        const n = Object.values(D).reduce((t, l) => t + l.filter(p => p.on === true).length, 0);
        if (!n) return;
        svConfirm({ title: "SUPPRIMER LES PÉRIODES COCHÉES", text: n + " PÉRIODE(S) SERONT SUPPRIMÉES.", ok: "SUPPRIMER" }).then(go => {
          if (!go) return;
          Object.keys(D).forEach(k => { D[k] = D[k].filter(p => p.on !== true); });
          X.render();
        });
      };
      shell.addEventListener("click", e => {
        const X = shell.__insDly;
        const xa = e.target.closest && e.target.closest(".dlp-xall");
        if (xa && X) {
          e.stopPropagation();
          shell.__insDlyDel();
          return;
        }
        if (false) {
          const D = X.draft();
          const n = Object.values(D).reduce((t, l) => t + l.filter(p => p.on === true).length, 0);
          if (!n) return;
          svConfirm({ title: "SUPPRIMER LES PÉRIODES COCHÉES", text: n + " PÉRIODE(S) SERONT SUPPRIMÉES.", ok: "SUPPRIMER" }).then(go => {
            if (!go) return;
            Object.keys(D).forEach(k => { D[k] = D[k].filter(p => p.on !== true); });
            X.render();
          });
          return;
        }
        const b = e.target.closest && e.target.closest(".dlp-x");
        if (!b || !X) return;
        e.stopPropagation();
        svConfirm({ title: "SUPPRIMER LA PÉRIODE", text: "LA PÉRIODE SERA SUPPRIMÉE.", ok: "SUPPRIMER" }).then(go => {
          if (!go) return;
          const D = X.draft();
          D[b.dataset.task] = (D[b.dataset.task] || []).filter(x => x.id !== b.dataset.pid);
          X.render();
        });
      }, true);
    }
    /* brouillon des délais de la tâche choisie : copie des périodes validées, enregistrée par ✓ VALIDER LA LIAISON */
    /* calendrier des délais : dates refusées grisées (fin avant début, début après fin, chevauchement
       avec une autre période de la même tâche secondaire) */
    window.__sviDlyCal = el => {
      if (!INS_EDIT) return null;
      const D = dlyDraft(), list = D[el.dataset.task] || (INS.dlp || {})[el.dataset.task] || [];
      const q = list.find(x => x.id === el.dataset.pid) || { deb: "", fin: "" };
      const oth = list.filter(x => x.id !== q.id && x.deb && x.fin);
      const f = el.dataset.f, pf = dlyPredFin(el.dataset.task);
      const dis = d => {
        if (f === "deb") {
          if (pf && d < pf) return true;
          if (q.fin && d > q.fin) return true;
          if (oth.some(o => d >= o.deb && d < o.fin)) return true;
          return !!q.fin && oth.some(o => d < o.fin && o.deb < q.fin);
        }
        if (q.deb && d < q.deb) return true;
        if (!q.deb) return oth.some(o => d >= o.deb && d < o.fin);
        return oth.some(o => q.deb < o.fin && o.deb < d);
      };
      return { iso: q[f] || (f === "fin" ? q.deb : "") || "", dis };
    };
    /* fenêtre PRÉDÉCESSEURS (ou AJOUTER UNE TÂCHE) : lot à gauche, activités secondaires à droite ;
       toutes les tâches, liées ou non ; la tâche elle-même et celles qui feraient une boucle sont grisées */
    const dlyPickPreds = key => {
      const add = !key;
      const sel = new Set(add ? [] : dlyPreds(key));
      let lot = ([...sel][0] || "").split("|")[0] || (INS.lot.find(x => !x.t) || {}).id || "";
      const d = document.createElement("div");
      d.id = "svConf";
      const nSel = lo => [...sel].filter(k => k.startsWith(lo + "|")).length;
      const size = (() => { try { return JSON.parse(localStorage.getItem("svi_dpk_v1") || "null"); } catch (e) { return null; } })();
      const draw = () => {
        const sc = [...d.querySelectorAll(".dpk-col")].map(c => c.scrollTop);
        const LC = [["v", "LOT", r => r.v || "", ""]], SC = [["v", "ACTIVITÉ SECONDAIRE", r => r.v || "", ""]];
        const lotsAll = INS.lot.filter(x => !x.t), secsAll = INS.sec.filter(x => !x.t);
        const lots = cfApply("dpk_lot", LC, lotsAll), secs = cfApply("dpk_sec", SC, secsAll);
        const okSec = x => { const k = lot + "|" + x.id; return add || !(k === key || dlyReach(k, key)); };
        const allOn = secs.filter(okSec).length && secs.filter(okSec).every(x => sel.has(lot + "|" + x.id));
        const card = d.querySelector(".dpk-card");
        const w = card ? card.style.width : (size && size.w ? size.w + "px" : ""), h = card ? card.style.height : (size && size.h ? size.h + "px" : "");
        d.innerHTML = `<div class="svc-card dpk-card" role="dialog" aria-modal="true" style="${w ? "width:" + w + ";" : ""}${h ? "height:" + h + ";" : ""}">
          <button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
          <div class="svc-t">${add ? "AJOUTER UNE TÂCHE AU PLANNING" : "PRÉDÉCESSEURS — " + esc(dlyName(key))}</div>
          <div class="dpk-cols">
            <div class="dpk-col"><table class="dpk-t"><thead><tr>${cfHead("dpk_lot", "v", "LOT " + svCnt(lots.length, lotsAll.length))}</tr></thead>
              <tbody>${lots.map(x => `<tr class="dpk-lot${x.id === lot ? " cur" : ""}${nSel(x.id) ? " chosen" : ""}" data-lot="${x.id}"><td>${esc(x.v)}${nSel(x.id) ? " " + svCnt(nSel(x.id)) : ""}</td></tr>`).join("")}</tbody></table></div>
            <div class="dpk-col"><table class="dpk-t"><thead><tr>${cfHead("dpk_sec", "v", "ACTIVITÉ SECONDAIRE " + svCnt(secs.length, secsAll.length))}<th class="center dpk-cbh">${add ? "" : `<input type="checkbox" class="dpk-all"${allOn ? " checked" : ""}>`}</th></tr></thead>
              <tbody>${secs.map(x => { const k = lot + "|" + x.id, off = !okSec(x), on = sel.has(k);
                return `<tr class="dpk-sec${off ? " off" : ""}${on ? " chosen" : ""}"><td>${esc(x.v)}</td><td class="center"><input type="${add ? "radio" : "checkbox"}" name="dpk" data-k="${k}"${on ? " checked" : ""}${off ? " disabled" : ""}></td></tr>`; }).join("")}</tbody></table></div>
          </div>
          <div class="svc-f"><button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok${add && !sel.size ? " disabled" : ""}>${add ? "SAISIR SES PÉRIODES" : "VALIDER"}</button></div>
          <div class="dpk-rsz" title="Largeur et hauteur"></div></div>`;
        d.querySelectorAll(".dpk-col").forEach((c, n) => { c.scrollTop = sc[n] || 0; });
      };
      document.getElementById("svConf")?.remove();
      document.body.appendChild(d);
      draw();
      window.__sviDpkRefresh = () => { if (d.isConnected) draw(); else window.__sviDpkRefresh = null; };
      const close = () => { d.remove(); window.__sviDpkRefresh = null; };
      /* poignée d'angle : largeur et hauteur, mémorisées */
      d.addEventListener("pointerdown", e => {
        const hd = e.target.closest(".dpk-rsz");
        if (!hd) return;
        e.preventDefault();
        const card = d.querySelector(".dpk-card"), r0 = card.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
        const mv = ev => {
          const w = Math.max(420, Math.min(window.innerWidth - 16, r0.width + 2 * (ev.clientX - x0)));
          const h = Math.max(300, Math.min(window.innerHeight - 16, r0.height + 2 * (ev.clientY - y0)));
          card.style.width = w + "px"; card.style.height = h + "px";
          try { localStorage.setItem("svi_dpk_v1", JSON.stringify({ w: Math.round(w), h: Math.round(h) })); } catch (err) {}
        };
        const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
      });
      d.addEventListener("change", e => {
        if (e.target.matches(".dpk-all")) {
          d.querySelectorAll("input[data-k]:not([disabled])").forEach(c => { if (e.target.checked) sel.add(c.dataset.k); else sel.delete(c.dataset.k); });
          draw(); return;
        }
        const c = e.target.closest("[data-k]");
        if (!c) return;
        if (add) { sel.clear(); if (c.checked) sel.add(c.dataset.k); } else if (c.checked) sel.add(c.dataset.k); else sel.delete(c.dataset.k);
        draw();
      });
      d.addEventListener("click", e => {
        const cfb = e.target.closest(".cf-btn");
        if (cfb) { e.stopPropagation(); cfOpenMenu(cfb); return; }
        if (e.target === d || e.target.closest("[data-x]")) { close(); return; }
        const l = e.target.closest("[data-lot]");
        if (l) { lot = l.dataset.lot; draw(); return; }
        if (!e.target.closest("[data-ok]") || e.target.closest("[data-ok]").disabled) return;
        close();
        if (add) { const k = [...sel][0]; if (k && shell.__insDly) shell.__insDly.go(k); return; }
        INS.dpred = INS.dpred || {};
        if (sel.size) INS.dpred[key] = [...sel]; else delete INS.dpred[key];
        insSave();
        histLog("DÉLAIS", "PRÉDÉCESSEURS", dlyName(key) + " : " + ([...sel].map(dlyName).join(" ; ") || "AUCUN"));
        /* la tâche commence avant la fin d'un prédécesseur : proposer de la décaler (durée gardée) */
        const pf = dlyPredFin(key), st = dlyDeb(key);
        if (pf && st && st < pf) {
          svChoose({ title: "TÂCHE À DÉCALER", html: `<div class="svc-sub">${esc(dlyName(key))} COMMENCE LE ${esc(dFr(st))}, AVANT LA FIN DE SES PRÉDÉCESSEURS (${esc(dFr(pf))}).</div><div class="svc-sub">RESPECTER LA DURÉE ET DÉCALER CETTE TÂCHE ET TOUTES CELLES QUI VIENNENT APRÈS ?</div>`,
            buttons: [{ v: "shift", label: "DÉCALER", tone: "neutral" }] }).then(v => {
            if (v === "shift") { const dd = dDiff(st, pf); dlyDraftKey(key).forEach(p => { if (p.deb) p.deb = dAdd(p.deb, dd); if (p.fin) p.fin = dAdd(p.fin, dd); }); dlyShift(key); svToast("TÂCHES DÉCALÉES — À VALIDER.", 3000); }
            refreshAll();
          });
        }
        refreshAll();
      });
    };
    if (!shell.__dlyPlanBound) {
      shell.__dlyPlanBound = true;
      shell.addEventListener("click", e => {
        const X = shell.__insDly;
        if (!X) return;
        const pc = e.target.closest && e.target.closest(".dly-pred");
        if (pc) { e.stopPropagation(); X.pickPreds(pc.dataset.key); return; }
        if (e.target.closest && e.target.closest(".dly-pred-new")) { X.pickPreds(null); return; }
        const tr = e.target.closest && e.target.closest("tr.dly-task");
        if (tr && !e.target.closest(".cf-btn, input")) X.go(tr.dataset.key);
      });
    }
    const dlyDraft = () => {
      const key = insDlyKey();
      LK.dlpDraft = LK.dlpDraft || {};
      if (key && !LK.dlpDraft[key]) LK.dlpDraft[key] = ((INS.dlp || {})[key] || []).map(p => ({ ...p }));
      return LK.dlpDraft;
    };
    shell.__insDly = INS && INS_EDIT ? { INS, dAdd, dDiff, dParse, dFr, insId, insSave, err: "", draft: dlyDraft,
      predFin: k => dlyPredFin(k), succs: k => dlySuccs(k), deb: k => dlyDeb(k), name: k => dlyName(k), shift: k => dlyShift(k),
      pickPreds: k => dlyPickPreds(k), go: k => { const [lo, se] = k.split("|"); LK.lot = lo; LK.sec = se; LK.prim = null; refreshAll(); },
      render: () => { renderTab(); insRenderChain(); } } : null;

    /* ---------- MODE LIAISONS ---------- */
    const LK = { des: null, lot: null, prim: null, sec: null, prd: {}, chg: {}, err: "" };
    const lkName = (k, id) => { const r = INS[k].find(x => x.id === id); return r ? (k === "des" ? ((r.art ? r.art + " " : "") + (r.des || "")) : (r.v || r.des || "")) : ""; };
    const insRenderLinks = () => {
      const box = $("insLinkView");
      if (!box) return;
      const RO = !INS_EDIT;
      const U = insUsed();
      const az = (a, b) => String(a).localeCompare(String(b), "fr", { numeric: true });
      /* lignes choisies en haut (consigne 14), filtres / tri de colonne (7), colonnes réglables (9) */
      const top = (rows, isSel) => rows.map((r, i) => ({ r, i })).sort((a, b) => (isSel(b.r) - isSel(a.r)) || a.i - b.i).map(o => o.r);
      const W = { art: 70, des: 340, u: 70, q: 110, lnk: 120, v: 220, lot: 160, prim: 180, sec: 200, np: 110, nc: 110, act: 110, qt: 200, lq: 120, lp: 110, lm: 140 };
      const tbl = (t, cols, rows, lead, rowHTML) => {
        const oc = coOrder(t, cols);
        const w = k => cwLoad()[t + "." + k] || W[k] || 120;
        return `<table class="bdg-d-table lk-table" style="width:${(lead ? 40 : 0) + oc.reduce((s, c) => s + w(c[0]), 0)}px">
          <colgroup>${lead ? '<col style="width:40px">' : ""}${oc.map(c => `<col data-w="${t}.${c[0]}" style="width:${w(c[0])}px">`).join("")}</colgroup>
          <thead><tr>${lead ? '<th class="center"></th>' : ""}${oc.map(c => cfHead(t, c[0], c[1], c[3])).join("")}</tr></thead>
          <tbody>${rows.map(r => rowHTML(r, oc)).join("") || `<tr><td colspan="${oc.length + (lead ? 1 : 0)}" class="empty">AUCUNE LIGNE</td></tr>`}</tbody></table>`;
      };
      const radio = (k, id) => `<input type="radio" name="lk_${k}" data-lk="${k}" value="${id}" ${LK[k] === id ? "checked" : ""} ${RO ? "disabled" : ""}>`;
      const nLinks = id => (INS.links || []).filter(l => l.des === id).length;
      const unl = (k, id) => U[k] && !U[k].has(id) ? " ins-unl" : "";
      /* DÉSIGNATIONS */
      const DC = [["art", "ART", r => r.art || "", "center"], ["des", "DÉSIGNATION", r => r.des || "", ""], ["u", "UPB", r => r.u || "", "center"],
        ["q", "QPB", r => r.q === "" || r.q === undefined ? "" : num(r.q), "number"], ["lnk", "LIAISONS", r => nLinks(r.id) ? nLinks(r.id) + " VALIDÉE(S)" : "", ""]];
      const desList = top(cfApply("lk_des", DC, INS.des.filter(r => !r.t)), r => r.id === LK.des);
      const desHTML = tbl("lk_des", DC, desList, true, (r, oc) => `<tr class="${LK.des === r.id ? "lk-sel" : LK.des ? "lk-dim" : ""}${unl("des", r.id)}" data-pick="des" data-id="${r.id}">
          <td class="center">${radio("des", r.id)}</td>${oc.map(c => `<td class="${c[3]}">${c[0] === "lnk" ? (nLinks(r.id) ? `<span class="lk-ok">${nLinks(r.id)} VALIDÉE(S)</span>` : "")
            : c[0] === "q" ? insFmt(insQty("des", r)) : esc(c[2](r))}</td>`).join("")}</tr>`);
      /* TÂCHES : trois blocs (ordre alphabétique, largeur réglable) */
      const ws = ["lot", "prim", "sec"].map(k => cwLoad()["lk_hier." + k]);
      const gridCols = ws.every(Boolean) && window.innerWidth > 700 ? ws.map(x => x + "px").join(" ") : "";
      const col = (k, title) => {
        const C = [["v", title, r => r.v || "", ""]];
        const list = top(cfApply("lk_" + k, C, [...INS[k]].sort((a, b) => az(a.v || "", b.v || ""))), r => r.id === LK[k]);
        return `<div class="lk-col" data-lk-col="${k}"><div class="lk-ch bdg-h-head ${cfT("lk_" + k).f.v ? "cf-on" : ""}"><span class="cf-wrap"><span class="cf-lab">${title}${svCnt(list.length)}</span><span class="cf-btn"
            data-cf="lk_${k}" data-col="v" role="button" aria-label="Trier / filtrer">${cfIcon}</span></span><span class="col-rs lk-rs"></span></div>
          ${list.map(r => `<label class="lk-li ${LK[k] === r.id ? "lk-sel" : ""}${unl(k, r.id)}" data-pick="${k}" data-id="${r.id}">${radio(k, r.id)}<span>${esc(r.v || "")}</span></label>`).join("")
            || `<div class="lk-li empty">AUCUNE LIGNE</div>`}</div>`;
      };
      /* DÉTAILS : produits (obligatoire = étoile), charges (ordre alphabétique) */
      const det = k => {
        const C = [["des", "DÉSIGNATION", r => r.des || "", ""], ["u", k === "prd" ? "UPB" : "UCB", r => r.u || "", "center"],
          ["qt", "QUANTITÉ DE LA TÂCHE", r => LK[k][r.id] ?? "", "number"]];
        let rows = [...INS[k]];
        if (k === "chg") rows.sort((a, b) => az(a.des || "", b.des || ""));
        rows = top(cfApply("lk_" + k, C, rows), r => LK[k][r.id] !== undefined);
        detN[k] = rows.length;
        return `<div class="lk-scroll">${tbl("lk_" + k, C, rows, true, (r, oc) => {
            const on = LK[k][r.id] !== undefined;
            return `<tr class="${on ? "lk-sel" : ""}${unl(k, r.id)}" data-det="${k}" data-id="${r.id}"><td class="center"><input type="checkbox" class="lk-cb" ${on ? "checked" : ""} ${RO ? "disabled" : ""}></td>
              ${oc.map(c => `<td class="${c[3]}">${c[0] === "qt" ? `<input class="lk-q" inputmode="decimal" value="${on ? esc(LK[k][r.id]) : ""}" ${RO ? "disabled" : ""}>` : esc(c[2](r))}</td>`).join("")}</tr>`;
          })}</div>`;
      };
      /* DÉTAILS sous onglets, même format que SAISIE / validé */
      const detN = {};
      const lkTab = ["prd", "qlt", "dly"].includes(LK.tab) ? LK.tab : "chg";
      /* QUALITÉ : lecture (saisie en mode SAISIE) ; DÉLAIS : saisis ici seulement */
      const qltHTML = () => `<table class="bdg-d-table" style="width:600px"><thead><tr><th>QUALITÉ</th></tr></thead><tbody>${
        (INS.qlt || []).map(r => `<tr><td>${esc(r.v || "")}</td></tr>`).join("") || '<tr><td class="empty">AUCUNE LIGNE</td></tr>'}</tbody></table>`;
      const detBody = lkTab === "qlt" ? `<div class="lk-scroll">${qltHTML()}</div>`
        : lkTab === "dly" ? `<div class="lk-scroll">${insDlyHTML(!RO, shell.__insDly && shell.__insDly.err)}</div>` : det(lkTab);
      detN.qlt = (INS.qlt || []).length;
      detN.dly = insTasks().length;
      if (detN.prd === undefined) detN.prd = cfApply("lk_prd", [["des", "", r => r.des || ""], ["u", "", r => r.u || ""], ["qt", "", r => LK.prd[r.id] ?? ""]], [...INS.prd]).length;
      if (detN.chg === undefined) detN.chg = cfApply("lk_chg", [["des", "", r => r.des || ""], ["u", "", r => r.u || ""], ["qt", "", r => LK.chg[r.id] ?? ""]], [...INS.chg]).length;
      const tabBtn = (k, title, extra) => `<button type="button" class="bdg-d-tab${lkTab === k ? " active" : ""}${Object.keys(cfT("lk_" + k).f).length ? " cf-on" : ""}" data-lktab="${k}">${SVI_ICON[k] || ""}${title} ${svCnt(detN[k])}${extra || ""}</button>`;
      const detHTML = `<div class="lk-dettabs"><div class="bdg-d-tabs lk-tabs">${tabBtn("chg", "DÉTAIL CHARGES")}${tabBtn("prd", 'DÉTAIL PRODUITS <b class="req-star">*</b>')}${tabBtn("qlt", "DÉTAIL QUALITÉ")}${tabBtn("dly", "DÉTAIL DÉLAIS")}</div>
        <div class="bdg-d-block bdg-d-tabbody lk-blk lk-det">${detBody}<div class="blk-rsz lk-hrsz" data-lkh="det"></div></div></div>`;
      const nPrd = Object.keys(LK.prd).length;
      const complete = LK.des && LK.lot && LK.prim && LK.sec && nPrd > 0;
      const chain = [lkName("des", LK.des), lkName("lot", LK.lot), lkName("prim", LK.prim), lkName("sec", LK.sec)]
        .map(x => x || "…").join(" › ") + " › " + nPrd + " PRODUIT(S)" + (Object.keys(LK.chg).length ? " + " + Object.keys(LK.chg).length + " CHARGE(S)" : "");
      /* LIAISONS VALIDÉES */
      const LC = [["art", "ART", l => (INS.des.find(x => x.id === l.des) || {}).art || "", "center"],
        ["des", "DÉSIGNATION", l => (INS.des.find(x => x.id === l.des) || {}).des || "", ""],
        ["lot", "LOT", l => lkName("lot", l.lot), ""], ["prim", "ACTIVITÉ PRIMAIRE", l => lkName("prim", l.prim), ""],
        ["sec", "ACTIVITÉ SECONDAIRE", l => lkName("sec", l.sec), ""], ["np", "PRODUITS", l => (l.prd || []).length, "center"],
        ["nc", "CHARGES", l => (l.chg || []).length, "center"],
        /* prix de la tâche primaire = PPB de la désignation client */
        ["lq", "QUANTITÉ", l => insFmt((l.prd || []).reduce((t, x) => t + num(x.q || 0), 0)), "number"],
        ["lp", "PPB", l => insFmt(num((INS.des.find(x => x.id === l.des) || {}).p || 0)), "number"],
        ["lm", "MPB HT", l => insFmt((l.prd || []).reduce((t, x) => t + num(x.q || 0), 0) * num((INS.des.find(x => x.id === l.des) || {}).p || 0)), "number"]];
      const lrows = cfApply("lk_links", LC, INS.links || []);
      const linksHTML = tbl("lk_links", LC, lrows, false, (l, oc) => `<tr>${oc.map(c => `<td class="${c[3]}">${esc(c[2](l))}</td>`).join("")}</tr>`)
        .replace(/<\/tr><\/thead>/, RO ? "</tr></thead>" : `<th class="center" style="width:110px"></th></tr></thead>`);
      box.innerHTML = `
        <div class="bdg-d-block lk-blk"><div class="bdg-d-block-title"><span class="ttl">${SVI_ICON.client}DÉSIGNATIONS CLIENT ${svCnt(desList.length)}</span></div>
          <div class="lk-scroll" style="height:var(--lkh-des,170px)">${desHTML}</div><div class="blk-rsz lk-hrsz" data-lkh="des"></div></div>
        <div class="bdg-d-block lk-blk"><div class="bdg-d-block-title"><span class="ttl">${SVI_ICON.hier}TÂCHES</span></div>
          <div class="lk-grid" style="${gridCols ? "grid-template-columns:" + gridCols : ""}">${col("lot", "LOT")}${col("prim", "ACTIVITÉ PRIMAIRE")}${col("sec", "ACTIVITÉ SECONDAIRE")}</div><div class="blk-rsz lk-hrsz" data-lkh="hier"></div></div>
        ${detHTML}
        ${RO ? "" : `<div class="lk-chain"><span class="lk-path">CHAÎNE : ${esc(chain)}</span>
          ${LK.err ? `<span class="lk-err">${esc(LK.err)}</span>` : ""}
          <button type="button" class="lk-go" ${complete ? "" : "disabled"}>✓ VALIDER LA LIAISON</button></div>`}
        <div class="bdg-d-block lk-blk"><div class="bdg-d-block-title"><span class="ttl">LIAISONS VALIDÉES ${svCnt(lrows.length)}</span></div>
          <div class="lk-scroll lk-links" style="height:var(--lkh-links,170px)">${linksHTML}</div><div class="blk-rsz lk-hrsz" data-lkh="links"></div></div>`;
      /* hauteurs des blocs réglées par la poignée (mémorisées) */
      try { const H = JSON.parse(localStorage.getItem("svi_lkh_v1") || "{}"); Object.keys(H).forEach(k => box.style.setProperty("--lkh-" + k, H[k] + "px")); } catch (e) {}
      sviMarkEmptyTabs(box);
      /* bouton DÉLIER au bout de chaque liaison */
      if (!RO) box.querySelectorAll(".lk-links tbody tr").forEach((tr, i) => {
        const l = lrows[i];
        if (!l) return;
        const td = document.createElement("td");
        td.className = "center";
        td.innerHTML = `<button type="button" class="lk-del" data-lid="${l.id}">${INS_TRASH} DÉLIER</button>`;
        tr.appendChild(td);
      });
    };
    /* contrôle des règles avant validation (cahier des charges A et D) */
    /* règle A au moment du choix : message passager et choix refusé */
    const lkRuleA = (k, id) => {
      const L = INS.links || [];
      if (!LK.des || !id) return "";
      if (k === "prim") {
        const t = LK.lot && L.find(l => l.lot === LK.lot && l.prim === id && l.des !== LK.des);
        if (t) return "RÈGLE A : LA TÂCHE PRIMAIRE " + lkName("lot", LK.lot) + " › " + lkName("prim", id) + " EST DÉJÀ LIÉE À " + lkName("des", t.des) + ".";
      }
      if (k === "sec" && LK.lot) {
        const t = L.find(l => l.lot === LK.lot && l.sec === id && l.des !== LK.des);
        if (t) return "RÈGLE A : LA TÂCHE SECONDAIRE " + lkName("lot", LK.lot) + " › " + lkName("sec", id) + " EST DÉJÀ LIÉE À " + lkName("des", t.des) + ".";
      }
      return "";
    };
    const lkCheck = () => {
      const L = INS.links || [];
      /* liaison déjà validée : on y ajoute les nouveaux détails (pas d'erreur) */
      /* règle A (11/10/2026) : lot, désignation et activité secondaire se lient librement ;
         une activité primaire n'a qu'une désignation ; une tâche primaire (lot + act. prm)
         et une tâche secondaire (lot + act. scd) n'ont qu'une désignation */
      const ra = lkRuleA("prim", LK.prim) || lkRuleA("sec", LK.sec);
      if (ra) return ra;
      const D = INS.des.find(x => x.id === LK.des);
      const du = U_(D && D.u);
      const bad = du && insIsPrimLink(LK.prim, LK.sec) && Object.keys(LK.prd).find(id => { const p = INS.prd.find(x => x.id === id); return p && U_(p.u) && U_(p.u) !== du; });
      if (bad) return "UNITÉ : " + lkName("prd", bad) + " (" + U_(INS.prd.find(x => x.id === bad).u) + ") N'A PAS L'UNITÉ DE LA DÉSIGNATION (" + du + ").";
      const dup = Object.keys(LK.prd).find(id => L.some(l => l.lot === LK.lot && l.sec === LK.sec && (l.prd || []).some(x => x.id === id)));
      if (dup) return "RÈGLE D : " + lkName("prd", dup) + " EST DÉJÀ DANS LA TÂCHE SECONDAIRE " + lkName("lot", LK.lot) + " › " + lkName("sec", LK.sec) + ".";
      return "";
    };
    if (!shell.__lkBound) {
      shell.__lkBound = true;
      shell.addEventListener("change", e => {
        const X = shell.__lk;
        if (!X || !e.target.closest("#insLinkView")) return;
        const r = e.target.closest("input[data-lk]");
        if (r) { X.LK[r.dataset.lk] = r.value; X.LK.err = ""; X.render(); return; }
        const cb = e.target.closest("input.lk-cb");
        if (cb) {
          const tr = cb.closest("tr[data-det]");
          const k = tr.dataset.det, id = tr.dataset.id;
          if (cb.checked) X.LK[k][id] = tr.querySelector(".lk-q").value || ""; else delete X.LK[k][id];
          X.LK.err = ""; X.render(); return;
        }
        const q = e.target.closest("input.lk-q");
        if (q) {
          const tr = q.closest("tr[data-det]");
          X.LK[tr.dataset.det][tr.dataset.id] = q.value.trim();
          X.render();
        }
      });
      shell.addEventListener("click", e => {
        const X = shell.__lk;
        if (!X || !e.target.closest("#insLinkView")) return;
        /* toucher la ligne = toucher le rond (ou la case) */
        if (!e.target.closest("input, button, .cf-btn, label")) {
          const tr = e.target.closest("tr[data-pick]");
          if (tr && !X.RO()) { X.LK[tr.dataset.pick] = tr.dataset.id; X.LK.err = ""; X.render(); return; }
          const td = e.target.closest("tr[data-det]");
          if (td && !X.RO()) { td.querySelector(".lk-cb")?.click(); return; }
        }
        const lt = e.target.closest(".bdg-d-tab[data-lktab]");
        if (lt && !e.target.closest(".cf-btn")) { X.LK.tab = lt.dataset.lktab; X.render(); return; }
        const del = e.target.closest(".lk-del");
        if (del) {
          svConfirm({ title: "DÉLIER", text: "LA LIAISON SERA DÉFAITE ; LES LIGNES RESTENT DANS LE BUDGET.", ok: "DÉLIER" }).then(go => {
            if (!go) return;
            X.INS.links = (X.INS.links || []).filter(l => l.id !== del.dataset.lid);
            X.save("DÉLIER"); X.render();
          });
          return;
        }
        if (e.target.closest(".lk-go")) {
          const err = X.check();
          if (err) { X.LK.err = err; X.render(); return; }
          const L = X.LK;
          X.INS.links = X.INS.links || [];
          X.INS.links.push({ id: X.insId(), des: L.des, lot: L.lot, prim: L.prim, sec: L.sec,
            prd: Object.entries(L.prd).map(([id, q]) => ({ id, q: q === "" ? "" : num(q) })),
            chg: Object.entries(L.chg).map(([id, q]) => ({ id, q: q === "" ? "" : num(q) })) });
          /* on garde la désignation et le lot pour enchaîner la tâche suivante */
          L.prim = null; L.sec = null; L.prd = {}; L.chg = {}; L.err = "";
          X.save("LIAISON VALIDÉE"); X.render();
        }
      });
    }
    shell.__lk = INS ? { INS, LK, insId, check: lkCheck, render: () => insRenderLinks(), RO: () => !INS_EDIT,
      save: what => { insSave(); histLog("LIAISONS", what, fullRef); } } : null;
    /* détail produits : alerte (non bloquante) si les dimensions ne correspondent pas à l'unité
       U / F : NBR seul ; M / ML : NBR + 1 DIM ; M2 : NBR + 2 DIM ; M3 : NBR + 3 DIM */
    if (!shell.__dimBound) {
      shell.__dimBound = true;
      shell.addEventListener("change", e => {
        const inp = e.target.closest && e.target.closest("input.ins-in");
        const X = shell.__ins;
        if (!inp || !X || !["u", "nbr", "d1", "d2", "d3"].includes(inp.dataset.f)) return;
        const tr = inp.closest('tr[data-ik="prd"][data-iid]');
        if (!tr) return;
        const r = X.INS.prd.find(x => x.id === tr.dataset.iid);
        if (!r) return;
        const u = String(r.u || "").trim().toUpperCase();
        const max = { U: 0, F: 0, M: 1, ML: 1, M2: 2, M3: 3 }[u];
        if (max === undefined) return;
        const nd = ["d1", "d2", "d3"].filter(f => r[f] !== "" && r[f] !== undefined && r[f] !== null).length;
        if (nd > max) svToast("ATTENTION : UNITÉ " + u + " → " + (max === 0 ? "NBR SEUL" : "NBR ET " + max + " DIM") + " (" + nd + " DIM RENSEIGNÉE" + (nd > 1 ? "S" : "") + ").", 3500, inp);
      });
    }
    /* détail charges : ART ou désignation saisi → désignation, unité, PCB et TVA viennent de CHS ;
       charge absente de CHS : acceptée, son PCB reste saisissable */
    if (!shell.__chsBound) {
      shell.__chsBound = true;
      shell.addEventListener("change", e => {
        const inp = e.target.closest && e.target.closest("input.ins-in");
        const X = shell.__ins;
        if (!inp || !X || !["art", "des"].includes(inp.dataset.f)) return;
        const tr = inp.closest('tr[data-ik="chg"][data-iid]');
        if (!tr) return;
        const r = X.INS.chg.find(x => x.id === tr.dataset.iid);
        if (!r) return;
        const c = chsFind(inp.dataset.f === "art" ? r.art : "", inp.dataset.f === "des" ? r.des : "");
        if (c) { r.chs = c.id; r.art = String(c.article ?? r.art ?? "").toUpperCase(); r.des = String(c.designation ?? r.des ?? "").toUpperCase();
          r.u = String(c.unit ?? r.u ?? "").toUpperCase(); r.p = c.pcs; r.tva = c.tva; }
        else if (r.chs) { delete r.chs; }
        else return;
        X.insSave();
        /* la ligne seule est redessinée (le PCB passe en gris ou redevient saisissable) */
        const tmp = document.createElement("tbody");
        tmp.innerHTML = X.insRowHTML("chg", r, 0);
        const nr = tmp.firstElementChild;
        const foc = document.activeElement && tr.contains(document.activeElement) ? document.activeElement.dataset.f : null;
        tr.replaceWith(nr);
        X.insLive("chg", nr, r);
        if (foc) nr.querySelector(`input[data-f="${foc}"]`)?.focus();
      });
    }
    /* FORMAT 74-75 : nombre non valide refusé ; unité d'un produit → DIM non autorisées effacées et grisées ;
       on ne passe pas à une autre ligne tant que la ligne quittée a une erreur */
    if (!shell.__ruleBound) {
      shell.__ruleBound = true;
      shell.addEventListener("change", e => {
        const inp = e.target.closest && e.target.closest("input.ins-in");
        const X = shell.__ins;
        if (!inp || !X) return;
        const tr = inp.closest("[data-ik][data-iid]");
        if (!tr) return;
        const k = tr.dataset.ik, r = X.INS[k] && X.INS[k].find(x => x.id === tr.dataset.iid);
        if (!r) return;
        /* ligne liée entièrement vidée : refusée, la valeur revient (FORMAT 90) */
        if (insRowEmpty(k, r) && X.isUsed(k, r.id)) {
          const old = shell.__dupOld && shell.__dupOld.id === r.id ? shell.__dupOld.row : null;
          if (old) { r[inp.dataset.f] = old[inp.dataset.f] ?? ""; inp.value = inp.getAttribute("inputmode") === "decimal" ? insFmt(r[inp.dataset.f]) : String(r[inp.dataset.f] ?? ""); }
          svToast("LIGNE LIÉE : DÉLIER D'ABORD.", 3500, inp);
          X.insSave();
          return;
        }
        if (inp.getAttribute("inputmode") === "decimal" && !sviNumOk(inp.value)) {
          svToast("NOMBRE NON VALIDE : CHIFFRES SEULEMENT (EX. 1 234,56).", 3500, inp);
          inp.value = ""; r[inp.dataset.f] = ""; X.insSave();
          setTimeout(() => inp.focus(), 0);
          return;
        }
        if (k === "prd" && inp.dataset.f === "u") {
          const nd = sviUnitDims(r.u);
          const gone = [1, 2, 3].filter(i => i > nd && String(r["d" + i] ?? "") !== "");
          gone.forEach(i => { r["d" + i] = ""; });
          if (gone.length) svToast("UNITÉ " + U_(r.u) + " : " + (nd ? "NBR ET " + nd + " DIM" : "NBR SEUL") + " — DIM " + gone.join(", ") + " EFFACÉE(S).", 3500, inp);
          X.insSave();
          const tmp = document.createElement("tbody");
          tmp.innerHTML = X.insRowHTML("prd", r, 0);
          const nr = tmp.firstElementChild;
          if (tr.contains(document.activeElement)) document.activeElement.blur();
          const cur = tr.isConnected ? tr : shell.querySelector(`tr[data-ik="prd"][data-iid="${r.id}"]`);
          if (!cur || !cur.parentNode) return;
          try { cur.replaceWith(nr); } catch (err) { return; }
          X.insLive("prd", nr, r);
          setTimeout(() => { const nx = nr.querySelector('input[data-f="nbr"]'); if (nx && !document.activeElement?.closest("tr")) nx.focus(); }, 0);
        }
      });
      let lastRow = null;
      shell.addEventListener("focusin", e => {
        const inp = e.target.closest && e.target.closest("input.ins-in");
        const X = shell.__ins;
        if (!inp || !X) return;
        const tr = inp.closest("tr[data-ik]");
        const prev = lastRow;
        lastRow = tr && tr.dataset.iid ? { k: tr.dataset.ik, id: tr.dataset.iid } : null;
        if (!prev || (tr && tr.dataset.ik === prev.k && tr.dataset.iid === prev.id)) return;
        const r = (X.INS[prev.k] || []).find(x => x.id === prev.id);
        const er = r && X.rowErr(prev.k, r);
        if (!er) return;
        const back = shell.querySelector(`tr[data-ik="${prev.k}"][data-iid="${prev.id}"] input[data-f="${er.f}"]`);
        if (!back || back.disabled) return;
        lastRow = prev;
        e.preventDefault();
        setTimeout(() => { back.focus(); svToast(er.m, 3500, back); }, 0);
      });
    }
    /* page unique : rond (choix de la chaîne), quantité de la tâche, ✓ VALIDER, DÉLIER */
    if (!shell.__fuseBound) {
      shell.__fuseBound = true;
      shell.addEventListener("click", e => {
        const X = shell.__fuse;
        if (!X) return;
        const ra = e.target.closest(".lk-rdall");
        if (ra) {
          e.stopPropagation(); e.preventDefault();
          if (ra.classList.contains("off")) return;
          X.allToggle(ra.dataset.rdall);
          return;
        }
        const rd = e.target.closest(".lk-rd");
        if (rd) {
          e.stopPropagation(); e.preventDefault();
          const k = rd.dataset.rd, id = rd.closest("[data-iid]")?.dataset.iid;
          if (!id) return;
          if (rd.closest(".lk-ban")) return;   /* ligne grisée : on ne peut pas la choisir (appui long = raison) */
          const L = X.LK, multi = k === "prd" || k === "chg";
          const chosen = multi ? L[k][id] !== undefined : L[k] === id;
          if (!multi && L[k] && !chosen) return;   /* une ligne déjà choisie : les autres attendent qu'on la libère */
          /* libérer la désignation avec une modification non validée : proposer de valider d'abord */
          if (k === "des" && chosen && X.pending()) { X.guard().then(ok => { if (ok) { L.des = null; L.lot = L.prim = L.sec = null; L.prd = {}; L.chg = {}; L.dlpDraft = null; X.light("des"); } }); return; }
          const pick = () => {
            if ((k === "prim" || k === "sec") && L[k] !== id) {
              const ra = X.ruleA(k, id);
              if (ra) { svToast(ra); return; }   /* refusé tout de suite */
            }
            if (k === "prd" && L[k][id] === undefined) {
              const bad = X.unitErr(id);
              if (bad) { svToast(bad); return; }   /* unité différente : refusé tout de suite */
            }
            if (multi) { if (L[k][id] !== undefined) delete L[k][id]; else L[k][id] = ""; }
            else {
              L[k] = L[k] === id ? null : id;      /* 2e toucher : le choix est libéré */
              if (k === "des" && !L.des) { L.lot = L.prim = L.sec = null; L.prd = {}; L.chg = {}; }
              if (k === "lot" && !L.lot) { L.prim = L.sec = null; }
              if (k === "prim" && !L.prim) { L.sec = null; }
            }
            L.err = "";
            X.light(k);
          };
          /* le rond ne fait que choisir / libérer ; délier passe par le bouton ✕ DÉLIER */
          pick();
          return;
        }
        if (e.target.closest("#insChain .lk-info")) { X.info(); return; }
        if (e.target.closest("#insChain .lk-go")) {
          X.commit();
          return;
        }
        const del = e.target.closest(".lk-del");
        if (del && !e.target.closest("#insLinkView")) {
          svConfirm({ title: "DÉLIER", text: "LA LIAISON SERA DÉFAITE ; LES LIGNES RESTENT DANS LE BUDGET.", ok: "DÉLIER" }).then(go => {
            if (!go) return;
            X.INS.links = (X.INS.links || []).filter(l => l.id !== del.dataset.lid);
            X.save("DÉLIER"); X.refresh();
          });
        }
      }, true);
      shell.addEventListener("change", e => {
        const X = shell.__fuse;
        const q = e.target.closest && e.target.closest("input.lk-q");
        if (!X || !q || e.target.closest("#insLinkView")) return;
        const id = q.closest("[data-iid]")?.dataset.iid;
        if (id && X.LK[q.dataset.qk][id] !== undefined) { X.LK[q.dataset.qk][id] = q.value.trim(); X.chain(); }
      });
    }
    /* briser la liaison d'une ligne, dans le contexte choisi (désignation, et lot / activités s'ils sont choisis) */
    const lkUnlink = (k, id) => {
      /* délier = modification de la liaison : à valider (✓ VALIDER), annulable (ABANDONNER) */
      if (!LK.linksBak) LK.linksBak = JSON.parse(JSON.stringify(INS.links || []));
      const lvl = { lot: 0, prim: 1, sec: 2, prd: 3, chg: 3 }[k];
      const hit = new Set(lkLinks(lvl).map(l => l.id));
      if (k === "prd" || k === "chg") {
        INS.links.forEach(l => { if (hit.has(l.id)) l[k] = (l[k] || []).filter(x => x.id !== id); });
        INS.links = INS.links.filter(l => (l.prd || []).length);
      } else INS.links = INS.links.filter(l => !(hit.has(l.id) && l[k] === id));
      LK.unlinked = (LK.unlinked || []).concat(lkName("des", LK.des) + " — " + lkName(k, id));
      refreshAll();
    };
    /* toucher un rond : on ne redessine que ce qui change (rapidité) */
    const lkLight = k => {
      keepScroll(() => {
        if ((k === "prd" || k === "chg") && !(INS.links || []).length) {
          /* produit / charge sans aucune liaison : le tableau seul est redessiné (la ligne choisie monte) */
          renderTab();
          insMarkUnlinked();
        } else {
          /* tout choix fait remonter, dans les autres blocs, les lignes qui lui sont liées */
          insRenderClient();
          insRenderHier();
          renderTab();   /* compteurs des onglets et tableau du détail (produits, charges, délais de la tâche choisie) */
          insMarkUnlinked();
        }
        insRenderChain();
      });
    };
    /* ✓ VALIDER LA LIAISON : nouvelle liaison, ajout de détails à une liaison existante, délais de la tâche */
    /* ✕ DÉLIER : fenêtre de confirmation (liaisons concernées, délais supprimés), puis destruction */
    const lkDestroy = pl => {
      const tag = l => [lkName("des", l.des), lkName("lot", l.lot), lkName("prim", l.prim), lkName("sec", l.sec)].join(" › ");
      const rem = pl.remP.length || pl.remC.length;
      const names = [...pl.remP.map(id => lkName("prd", id)), ...pl.remC.map(id => lkName("chg", id))];
      const ids = new Set(pl.links.map(l => l.id));
      /* liaisons après l'opération (un produit retiré : la liaison sans produit disparaît) */
      const after = (INS.links || []).map(l => !ids.has(l.id) ? l : !rem ? null
        : { ...l, prd: (l.prd || []).filter(x => !pl.remP.includes(x.id)), chg: (l.chg || []).filter(x => !pl.remC.includes(x.id)) })
        .filter(l => l && (l.prd || []).length);
      const gone = pl.links.filter(l => !after.some(a => a.id === l.id));
      /* délais des tâches secondaires qui n'ont plus aucune liaison */
      /* délais : indépendants des liaisons (planning possible avant les liaisons) — gardés */
      const dK = [];
      const nD = dK.reduce((t, k) => t + INS.dlp[k].length, 0);
      const html = `${rem ? `<div class="svc-sub">À RETIRER : ${esc(names.join(", "))}</div>` : ""}
        <div class="svc-sub">${rem ? "DANS" : "LIAISONS DÉLIÉES"} ${svCnt(pl.links.length)} :</div>
        <ul class="svc-list">${pl.links.map(l => `<li>${esc(tag(l))}${rem && gone.includes(l) ? " <b>(PLUS AUCUN PRODUIT : DÉLIÉE)</b>" : ""}</li>`).join("")}</ul>
        ${nD ? `<div class="svc-sub svc-warn">${nD} PÉRIODE${nD > 1 ? "S" : ""} DE DÉLAIS ${nD > 1 ? "SERONT SUPPRIMÉES" : "SERA SUPPRIMÉE"}.</div>` : ""}`;
      return svConfirm({ title: rem ? "RETIRER DES LIAISONS" : "DÉLIER", html, ok: "✕ DÉLIER" }).then(go => {
        if (!go) return false;
        INS.links = after;
        dK.forEach(k => { delete INS.dlp[k]; });
        histLog("LIAISONS", "DÉLIER", (rem ? names.join(", ") + " — " : "") + pl.links.map(tag).join(" ; "));
        LK.prd = {}; LK.chg = {}; LK.lot = LK.prim = LK.sec = null; LK.dlpDraft = null; LK.all = {}; LK.allm = {};
        if (LK.des && !INS.des.some(x => x.id === LK.des)) LK.des = null;
        insSave();
        refreshAll();
        return true;
      });
    };
    const lkCommit = () => {
      const pl = lkPlan();
      if (pl.mode === "mix") { svToast("CHOISIR SOIT DES LIGNES À AJOUTER, SOIT DES LIGNES À DÉLIER (EN DEUX FOIS)."); return false; }
      if (pl.mode === "del") return lkDestroy(pl);
      const L = LK, hasNew = Object.keys(L.prd).length || Object.keys(L.chg).length;
      if (hasNew && L.des && L.lot && L.prim && L.sec) {
        const err = lkCheck();
        if (err) { svToast(err); return false; }
        INS.links = INS.links || [];
        const ent = o => Object.keys(o).map(id => ({ id, q: "" }));
        const same = INS.links.find(l => l.des === L.des && l.lot === L.lot && l.prim === L.prim && l.sec === L.sec);
        if (same) {
          ent(L.prd).forEach(x => { if (!(same.prd || []).some(y => y.id === x.id)) (same.prd = same.prd || []).push(x); });
          ent(L.chg).forEach(x => { if (!(same.chg || []).some(y => y.id === x.id)) (same.chg = same.chg || []).push(x); });
        } else {
          if (!Object.keys(L.prd).length) { svToast("UNE LIAISON DOIT AVOIR AU MOINS UN PRODUIT."); return false; }
          INS.links.push({ id: insId(), des: L.des, lot: L.lot, prim: L.prim, sec: L.sec, prd: ent(L.prd), chg: ent(L.chg) });
        }
        L.prd = {}; L.chg = {};
      }
      if (lkDlyDirty()) {
        INS.dlp = INS.dlp || {};
        Object.keys(L.dlpDraft).forEach(k => { INS.dlp[k] = L.dlpDraft[k].map(p => ({ id: p.id, deb: p.deb || "", fin: p.fin || "" })); });
      }
      if (L.linksBak) {
        (L.unlinked || []).forEach(t => histLog("LIAISONS", "DÉLIER", t));
        L.linksBak = null; L.unlinked = null;
      }
      L.dlpDraft = null; L.err = "";
      /* après validation : seule la désignation reste choisie ; lot et activités repassent en « liés » (bleu) */
      L.lot = L.prim = L.sec = null;
      insSave(); histLog("LIAISONS", "LIAISON VALIDÉE", lkName("des", L.des));
      refreshAll();
      return true;
    };
    /* modification non validée : avant de passer à autre chose, on propose de valider */
    /* ce qui sera abandonné (consigne 27) : produits / charges à ajouter, délais modifiés, liaisons déliées */
    const lkPendingHTML = () => {
      const add = [...Object.keys(LK.prd || {}).map(id => lkName("prd", id)), ...Object.keys(LK.chg || {}).map(id => lkName("chg", id))];
      const out = [];
      if (add.length) out.push(`<div class="svc-sub">À AJOUTER :</div><ul class="svc-list">${add.map(n => `<li>${esc(n)}</li>`).join("")}</ul>`);
      if (lkDlyDirty()) out.push(`<div class="svc-sub">DÉLAIS MODIFIÉS</div>`);
      if ((LK.unlinked || []).length) out.push(`<div class="svc-sub">DÉLIÉES :</div><ul class="svc-list">${LK.unlinked.map(n => `<li>${esc(n)}</li>`).join("")}</ul>`);
      return out.join("");
    };
    const lkGuard = () => !lkPending() ? Promise.resolve(true)
      : svChoose({ title: "LIAISON EN COURS NON VALIDÉE", html: lkPendingHTML(),
          buttons: [{ v: "drop", label: "ABANDONNER", tone: "danger" }, { v: "ok", label: "✓ VALIDER", tone: "neutral" }] })
        .then(v => {
          if (v === "ok") return lkCommit();
          if (v === "drop") {
            LK.prd = {}; LK.chg = {}; LK.dlpDraft = null; LK.all = {}; LK.allm = {};
            LK.lot = LK.prim = LK.sec = null;
            if (LK.linksBak) { INS.links = LK.linksBak; LK.linksBak = null; LK.unlinked = null; insSave(); }
            return true;
          }
          return false;
        });
    shell.__lkGuard = INS && INS_EDIT ? lkGuard : null;
    /* rond d'en-tête : 1er toucher = choisir toutes les lignes déjà liées du bloc ; 2e = tout libérer */
    const lkAllToggle = k => {
      LK.all = LK.all || {}; LK.allm = LK.allm || {};
      if (k === "prd" || k === "chg") {
        if (LK.allm[k]) { LK[k] = {}; LK.allm[k] = false; }
        else { insShown(k).filter(r => !r.t && lkAllLinked(k, r.id)).forEach(r => { LK[k][r.id] = ""; }); LK.allm[k] = Object.keys(LK[k]).length > 0; }
      } else {
        LK.all[k] = !LK.all[k];
        if (LK.all[k]) LK[k] = null;
      }
      lkLight(k);
    };
    shell.__fuse = INS && INS_EDIT ? { INS, LK, insId, check: lkCheck, allToggle: k => lkAllToggle(k), chain: () => insRenderChain(), refresh: () => refreshAll(),
      commit: () => lkCommit(), guard: () => lkGuard(), pending: () => lkPending(), ruleA: (k, id) => lkRuleA(k, id),
      light: k => lkLight(k), unlink: (k, id) => lkUnlink(k, id), name: (k, id) => lkName(k, id),
      unitErr: id => {
        const D = INS.des.find(x => x.id === LK.des), P = INS.prd.find(x => x.id === id);
        const du = String((D && D.u) || "").trim().toUpperCase(), pu = String((P && P.u) || "").trim().toUpperCase();
        return du && pu && du !== pu && LK.prim && LK.sec && insIsPrimLink(LK.prim, LK.sec) ? "UNITÉ REFUSÉE : " + (P.des || "") + " (" + pu + ") N'A PAS L'UNITÉ DE LA DÉSIGNATION (" + du + ")." : "";
      },
      info: () => {
        /* fenêtre au format INF : titre, ✕, libellés à gauche, état de la liaison, produits et charges, FERMER */
        document.getElementById("docPop")?.remove();
        const n = (k, id) => esc(lkName(k, id) || "—");
        const same = LK.des && LK.lot && LK.prim && LK.sec
          && (INS.links || []).find(l => l.des === LK.des && l.lot === LK.lot && l.prim === LK.prim && l.sec === LK.sec);
        const st = same ? "LIAISON DÉJÀ ÉTABLIE" + (Object.keys(LK.prd).length || Object.keys(LK.chg).length || lkDlyDirty() || LK.linksBak ? " — MODIFICATIONS À VALIDER" : "")
          : LK.des && LK.lot && LK.prim && LK.sec ? "NOUVELLE LIAISON — À VALIDER" : "LIAISON INCOMPLÈTE";
        /* tableaux de la fenêtre : tri / filtre sur chaque colonne (consigne 7) */
        const list = k => [...(same ? (same[k] || []).map(x => ({ id: x.id, st: "LIÉ" })) : []), ...Object.keys(LK[k]).map(id => ({ id, st: "À AJOUTER" }))]
          .map(o => { const r = INS[k].find(x => x.id === o.id) || {}; return { des: r.des || "", u: r.u || "", q: k === "prd" ? insPrdQ(r) : num(r.q || 0), st: o.st }; });
        const C = k => [["des", "DÉSIGNATION", x => x.des, ""], ["u", k === "prd" ? "UPB" : "UCB", x => x.u, "center"],
          ["q", k === "prd" ? "QPB" : "QCB", x => x.q, "number"], ["st", "ÉTAT", x => x.st, "center"]];
        const tbl = (k, lab) => {
          const t = "lki_" + k, rows = cfApply(t, C(k), list(k));
          return `<div class="doc-lab" style="margin-top:12px">${lab} ${svCnt(rows.length)}</div>
            <table class="bdg-d-table" style="width:100%;margin-top:6px"><thead><tr>${C(k).map(c => cfHead(t, c[0], c[1], c[3])).join("")}</tr></thead>
            <tbody>${rows.map(x => `<tr>${C(k).map(c => `<td class="${c[3]}">${c[0] === "q" ? insFmt(x.q) : esc(c[2](x))}</td>`).join("")}</tr>`).join("")
              || `<tr><td colspan="4" class="empty">AUCUNE LIGNE</td></tr>`}</tbody></table>`;
        };
        const p = document.createElement("div");
        p.id = "docPop";
        p.innerHTML = `<div class="doc-card" role="dialog" aria-modal="true" style="max-width:760px">
            <div class="doc-head"><span class="doc-title">LIAISON EN COURS</span><button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button></div>
            <div class="doc-body">
              <div class="lk-info-st${same ? " ok" : ""}">${st}</div>
              <div class="doc-grid">
                <span class="doc-lab">DÉSIGNATION</span><span class="lk-info-v">${n("des", LK.des)}</span>
                <span class="doc-lab">LOT</span><span class="lk-info-v">${n("lot", LK.lot)}</span>
                <span class="doc-lab">ACTIVITÉ PRIMAIRE</span><span class="lk-info-v">${n("prim", LK.prim)}</span>
                <span class="doc-lab">ACTIVITÉ SECONDAIRE</span><span class="lk-info-v">${n("sec", LK.sec)}</span>
              </div>
              <div class="lk-info-t">${tbl("prd", "DÉTAIL PRODUITS")}${tbl("chg", "DÉTAIL CHARGES")}</div>
            </div>
            <div class="doc-foot"><span></span><button type="button" class="doc-btn" data-cancel>FERMER</button></div>
          </div>`;
        document.body.appendChild(p);
        try { popEnhance(p, "lkinfo"); } catch (e) {}
        p.addEventListener("click", e => {
          const cfb = e.target.closest(".cf-btn");
          if (cfb) { e.stopPropagation(); cfOpenMenu(cfb); return; }
          if (e.target === p || e.target.closest("[data-cancel]")) { p.remove(); window.__sviInfoRefresh = null; }
        });
        window.__sviInfoRefresh = () => { const b = p.isConnected && p.querySelector(".lk-info-t"); if (b) b.innerHTML = tbl("prd", "DÉTAIL PRODUITS") + tbl("chg", "DÉTAIL CHARGES"); };
      },
      isLinked: (k, id) => { const S = lkLinked(); return !!(S[k] && S[k].has(id)); },
      save: what => { insSave(); histLog("LIAISONS", what, fullRef); } } : null;
    /* bascule SAISIE / LIAISONS */
    const insApplyMode = () => {
      if (!INS) return;
      shell.classList.remove("ins-mode-link");
      insRenderChain();
      insMarkUnlinked();
    };

    const renderClient = () => {
      if (INS) { insRenderClient(); return; }
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
        if (t) t.innerHTML = SVI_ICON.client + "DÉSIGNATIONS CLIENT " + svCnt(shownClient.length, base.length); }
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
      if (INS) { insRenderHier(); return; }
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
          <div class="bdg-h-head ${on ? "cf-on" : ""}"><span class="cf-wrap"><span class="cf-lab">${title}${svCnt(items.length, all.length)}</span><span class="cf-btn"
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
      /* FORMAT : un tableau redessiné ne fait jamais bouger l'écran (vertical ET horizontal) */
      /* redessins enchaînés : on garde la position d'avant le premier (pas celle, provisoire, d'entre deux) */
      const P = keepScroll.pend && performance.now() < keepScroll.pend.until ? keepScroll.pend : null;
      const saved = P ? P.saved : [...shell.querySelectorAll(sel)].map(el => [el.scrollTop, el.scrollLeft]);
      const toTop = keepScroll.toTop || (P ? P.toTop : false); keepScroll.toTop = false;
      const x = P ? P.x : window.scrollX, y = P ? P.y : window.scrollY;
      keepScroll.pend = { saved, toTop, x, y, until: performance.now() + 200 };
      const active = document.activeElement;
      if (active && active.blur &&
          !active.classList.contains("bdg-tva-input") &&
          !active.closest("#cfMenu")) {
        active.blur();
      }

      fn();

      const restore = () => {
        shell.querySelectorAll(sel).forEach((el, i) => {
          if (saved[i] === undefined) return;
          /* après un filtre : si la partie regardée n'existe plus, premières lignes retenues */
          el.scrollTop = toTop && saved[i][0] > el.scrollHeight - el.clientHeight ? 0 : saved[i][0];
          el.scrollLeft = saved[i][1];
        });
        window.scrollTo(x, y);
      };
      restore();
      requestAnimationFrame(restore);
      /* un tableau qui s'élargit juste après (largeur des en-têtes) : position remise avant l'affichage */
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(restore);
        shell.querySelectorAll(sel).forEach(el => [...el.children].forEach(c => ro.observe(c)));
        setTimeout(() => ro.disconnect(), 200);
      }
      /* mises en page tardives (largeurs d'en-tête, onglets) : position remise encore une fois */
      setTimeout(() => { restore(); }, 120);
      setTimeout(() => { if (keepScroll.pend && performance.now() >= keepScroll.pend.until) keepScroll.pend = null; }, 220);
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
      shell.querySelectorAll("#bdgTabs .bdg-d-tab").forEach(b => {
        const t = b.dataset.tab;
        /* bleu de l'onglet : seulement un choix de lignes (budget validé), pas le filtre (loupe) */
        b.classList.toggle("cf-on", !INS && (t === "chg" || t === "prd") && rowsOf(t));
      });
      $("bdgClientTitle")?.classList.toggle("cf-on", !INS && selDesig.size > 0);
      sviMarkEmptyTabs(shell);
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
        if (window.__sviImpRefresh) window.__sviImpRefresh();
        if (window.__sviDpkRefresh) window.__sviDpkRefresh();
        if (window.__sviInfoRefresh) window.__sviInfoRefresh();
        if (INS) insApplyMode();
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
      /* détail produits : pas de colonne ART (FORMAT 6) */
      ...(prd ? [] : [["article", "ART", l => l.article, "center"]]),
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

    /* ===== DÉTAIL DÉLAIS : colonnes (tri / filtre, largeur et ordre réglables) ===== */
    /* une ligne par période d'une TÂCHE PRIMAIRE (lot + activité primaire) */
    const DLY_COLS = [
      ["lot", "LOT", x => x.lot || "", ""],
      ["prim", "ACTIVITÉ PRIMAIRE", x => x.prim || "", ""],
      ["per", "PÉRIODE", x => x.per ?? "", "center"],
      ["deb", "DÉBUT", x => x.deb || "", "center"],
      ["fin", "FIN", x => x.fin || "", "center"],
      ["dur", "DURÉE (J)", x => x.dur === "" || x.dur === undefined ? "" : Number(x.dur), "number"]
    ];
    const DLY_W = { lot: 200, prim: 280, sec: 280, pred: 320, per: 120, deb: 140, fin: 140, dur: 110 };
    /* budget en instance / figé : une ligne par période d'une TÂCHE SECONDAIRE (lot + activité secondaire) */
    const DLY_COLS_S = [DLY_COLS[0], ["sec", "ACTIVITÉ SECONDAIRE", x => x.sec || "", ""], ...DLY_COLS.slice(2)];
    /* récapitulatif d'une tâche primaire : ses tâches secondaires */
    const DLY_COLS_R = DLY_COLS_S.slice(1);
    /* planning : lot, activité secondaire, prédécesseurs, début, fin, durée */
    const DLY_COLS_P = [DLY_COLS[0], ["sec", "ACTIVITÉ SECONDAIRE", x => x.sec || "", ""], ["pred", "PRÉDÉCESSEURS", x => x.pred || "", ""],
      ["deb", "DÉBUT", x => x.deb || "", "center"], ["fin", "FIN", x => x.fin || "", "center"], ["dur", "DURÉE (J)", x => x.dur === "" || x.dur === undefined ? "" : Number(x.dur), "number"]];
    /* budget en instance : la tâche est donnée par les ronds du haut (pas de colonnes LOT / ACT. PRIMAIRE) */
    const DLY_COLS_I = DLY_COLS.filter(c => c[0] !== "lot" && c[0] !== "prim");
    /* cells(x) → { cle: html } ; la ligne garde ses attributs (data-sec en saisie) */
    /* del : mode modifiable (case au début de chaque période, 🗑 à la fin, case et 🗑 en tête) */
    const dlyTable = (rows, cells, trAttr = () => "", del = false, base = DLY_COLS) => {
      const tk = base === DLY_COLS ? "dly" : base === DLY_COLS_S ? "dlys" : base === DLY_COLS_R ? "dlyr" : base === DLY_COLS_P ? "dlyp" : "dlyi";
      const cols = coOrder(tk, base);
      const w = k => cwLoad()["dly." + k] || DLY_W[k];
      /* FORMAT : case à droite de chaque ligne (cocher seulement) ; suppression par le menu ⋯ */
      return `<table class="bdg-d-table dly-table" style="width:${cols.reduce((t, c) => t + w(c[0]), 0) + (del ? 44 : 0)}px">
        <colgroup>${cols.map(c => `<col data-w="dly.${c[0]}" style="width:${w(c[0])}px">`).join("")}${del ? '<col style="width:44px">' : ""}</colgroup>
        <thead><tr>${cols.map(c => cfHead(tk, c[0], c[1], c[3])).join("")}${del ? '<th class="center"><input type="checkbox" class="dlp-cball" title="Tout cocher"></th>' : ""}</tr></thead>
        <tbody>${rows.map(x => { const h = cells(x); return `<tr ${trAttr(x)}>${cols.map(c => `<td class="${c[3]}${h["__td_" + c[0]] || ""}">${h[c[0]] ?? ""}</td>`).join("")}${del ? `<td class="center ins-cbc">${h.__cb || ""}</td>` : ""}</tr>`; }).join("")
          || ""}</tbody></table>`;
    };
    const renderTab = () => { renderTab0(); sviMarkEmptyTabs(shell); };
    const renderTab0 = () => {
      shell
        .querySelectorAll("#bdgTabs .bdg-d-tab")
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
        const gl = groupLines(byKindNow()[k]);
        const n = cfApply(k, tcolsFor(k === "prd"), gl).length;
        const t = tabs.find(x => x.key === k);
        b.innerHTML = (SVI_ICON[k] || "") + t.title + " " + svCnt(n, gl.length);
      });

      if (INS) { insRenderTab(); return; }
      { const q = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="qlt"]`);
        if (q) q.innerHTML = (SVI_ICON.qlt || "") + "DÉTAIL QUALITÉ " + svCnt(0);
        const d = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="dly"]`);
        if (d) d.innerHTML = (SVI_ICON.dly || "") + "DÉTAIL DÉLAIS " + svCnt(new Set(lines.filter(l => String(l.lot || "").trim() || String(l.prim || "").trim()).map(l => String(l.lot || "").trim() + "|" + String(l.prim || "").trim())).size); }
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
        /* DÉTAIL QUALITÉ : une seule colonne (contenu à venir) */
        body.innerHTML = `<div class="bdg-d-scroll"><table class="bdg-d-table"><thead><tr><th>QUALITÉ</th></tr></thead>
          <tbody><tr><td class="empty">AUCUNE LIGNE</td></tr></tbody></table></div>`;

        return;
      }

      /* DÉTAIL DÉLAIS : une ligne par activité secondaire (lots, début, durée, fin, arrêts) */
      {
        const fr = iso => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "";
        /* une ligne par TÂCHE PRIMAIRE (lot + activité primaire) : du premier début à la dernière fin */
        const m = new Map();
        lines.forEach(l => {
          const lot = String(l.lot || "").trim(), prim = String(l.prim || "").trim();
          if (!lot && !prim) return;
          const k = lot + "|" + prim;
          if (!m.has(k)) m.set(k, { lot, prim, per: 1, deb: "", fin: "" });
          const x = m.get(k);
          if (l.deb && (!x.deb || l.deb < x.deb)) x.deb = l.deb;
          if (l.fin && (!x.fin || l.fin > x.fin)) x.fin = l.fin;
        });
        const dur = x => x.deb && x.fin ? Math.round((new Date(x.fin) - new Date(x.deb)) / 86400000) : "";
        /* ordre par défaut : chronologique (début), puis alphabétique */
        const all = [...m.values()].map(x => ({ ...x, dur: dur(x) }))
          .sort((a, b) => String(a.deb || "9").localeCompare(String(b.deb || "9")) || a.lot.localeCompare(b.lot, "fr") || a.prim.localeCompare(b.prim, "fr"));
        const rows = cfApply("dly", DLY_COLS, all);
        { const b = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="dly"]`);
          if (b) b.innerHTML = (SVI_ICON.dly || "") + "DÉTAIL DÉLAIS " + svCnt(rows.length); }
        lastShown.detail = { cols: DLY_COLS, rows, kind: "dly" };
        body.innerHTML = `<div class="bdg-d-scroll">${dlyTable(rows, x => DLY_COLS.map(c => c[0])
          .reduce((o, k) => (o[k] = k === "deb" || k === "fin" ? fr(x[k]) : esc(x[k] ?? ""), o), {}))}</div>`;
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
      /* ↻ toujours affiché ; grisé quand les blocs sont déjà à leur place d'origine */
      if (rb) { rb.disabled = !custom; }   /* ↻ : dans le menu ⋯ du haut, grisé quand il n'y a rien à remettre en place */
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

    /* ===== budget en instance : appui long sur une ligne saisie = glisser la ligne
       (un titre emmène ses lignes et sous-titres) ===== */
    /* désignations : dépôt d'une ligne ou d'un titre (avec sa branche) — FORMAT 61
       - avant une ligne / un titre : même niveau que lui ;
       - après une ligne : même niveau (entre dans son titre) ;
       - après un titre déplié : entre dans ce titre ; après un titre replié : à côté de lui (après sa branche) ;
       - superposé : nouveau titre « NOUVEAU TITRE n » qui regroupe la ligne visée puis la ligne glissée ;
       - titres devenus vides : supprimés après confirmation (ANNULER = glissement annulé) */
    /* lignes sélectionnées d'un bloc (cases cochées) ; désignations : un titre coché (branche entière ou titre vide) emporte sa branche */
    /* lignes affichées (filtres compris) : les actions ne portent que sur elles (FORMAT 84) */
    const insVis = k => new Set((["lot", "prim", "sec"].includes(k) ? cfApply(k, [["v", "", r => r.v || "", ""]], INS[k]) : insShown(k)).map(r => r.id));
    const insSelIds = k => {
      const L = INS[k] || [], out = new Set(), vis = insVis(k);
      if (k !== "des") { L.forEach(r => { if (r.on === true && vis.has(r.id)) out.add(r.id); }); return out; }
      insNorm();
      const D = r => Number(r.d) || 0;
      L.forEach((r, i) => {
        if (!r.t) { if (r.on === true && vis.has(r.id)) out.add(r.id); return; }
        if (!vis.has(r.id)) return;
        let e = i + 1; while (e < L.length && D(L[e]) > D(r)) e++;
        const br = L.slice(i + 1, e).filter(x => x.t ? vis.has(x.id) : vis.has(x.id)), lines = br.filter(x => !x.t);
        /* titre retenu seulement si sa propre case est cochée (et toute sa branche, s'il en a une) */
        if (r.on === true && (!lines.length || lines.every(x => x.on === true))) { out.add(r.id); br.forEach(x => out.add(x.id)); }
      });
      return out;
    };
    const desDrop = async (arr, ids, tid, mode) => {
      insNorm();
      const snap = arr.map(r => ({ ...r }));
      const D = r => Number(r.d) || 0;
      const bset = new Set(ids);
      const i0 = arr.findIndex(r => bset.has(r.id));
      const block = arr.filter(r => bset.has(r.id));
      arr.splice(0, arr.length, ...arr.filter(r => !bset.has(r.id)));
      const shift = (rows, base) => { const d0 = D(rows[0]); rows.forEach(r => { r.d = base + D(r) - d0; }); };
      let j = arr.findIndex(r => r.id === tid);
      if (j < 0) { arr.splice(0, arr.length, ...snap); return; }
      const T = arr[j];
      const branchEnd = i => { let e = i + 1; while (e < arr.length && D(arr[e]) > D(arr[i])) e++; return e; };
      let created = null;
      if (mode === "on") {
        const e = branchEnd(j);
        const tb = arr.splice(j, e - j);
        const used = INS.des.concat(snap).map(r => (String(r.des || "").match(/^NOUVEAU TITRE (\d+)$/) || [])[1]).filter(Boolean).map(Number);
        created = { id: insId(), t: true, art: "", des: "NOUVEAU TITRE " + ((used.length ? Math.max(...used) : 0) + 1), d: D(T), on: false };
        shift(tb, D(T) + 1); shift(block, D(T) + 1);
        arr.splice(j, 0, created, ...tb, ...block);
      } else if (mode === "before") {
        shift(block, D(T)); arr.splice(j, 0, ...block);
      } else if (T.t && !foldGet()[T.id]) {
        shift(block, D(T) + 1); arr.splice(j + 1, 0, ...block);
      } else if (T.t && mode === "afterIn") {
        /* titre replié, doigt à droite : ajouté à la fin de ses lignes ; le titre reste replié */
        shift(block, D(T) + 1); arr.splice(branchEnd(j), 0, ...block);
      } else if (T.t) {
        shift(block, D(T)); arr.splice(branchEnd(j), 0, ...block);
      } else {
        shift(block, D(T)); arr.splice(j + 1, 0, ...block);
      }
      insNorm();
      /* titres vides (sans aucune ligne, sous-titres vides compris) */
      /* titres devenus vides PAR CE GLISSEMENT (un titre déjà vide et gardé n'est plus redemandé) */
      const emptyIn = L => new Set(L.filter((r, i) => {
        if (!r.t) return false;
        for (let x = i + 1; x < L.length && D(L[x]) > D(r); x++) if (!L[x].t) return false;
        return true;
      }).map(r => r.id));
      const was = emptyIn(snap), now = emptyIn(arr);
      const empty = arr.filter(r => now.has(r.id) && !was.has(r.id) && !(created && r.id === created.id));
      let choice = "";
      if (empty.length) {
        /* ANNULER = glissement annulé ; GARDER = glissement fait, titres vides gardés ; SUPPRIMER = titres vides supprimés */
        const v = await svChoose({ title: "TITRES VIDES",
          html: `<div class="svc-sub">CES TITRES N'ONT PLUS AUCUNE LIGNE :</div><ul class="svc-list">${empty.map(r => `<li>${esc([r.art, r.des].filter(Boolean).join(" "))}</li>`).join("")}</ul>`,
          buttons: [{ v: "keep", label: "GARDER", tone: "neutral" }, { v: "del", label: "SUPPRIMER", tone: "danger" }] });
        if (!v) { arr.splice(0, arr.length, ...snap); insSave(); insRedraw("des"); return; }
        choice = v;
      }
      if (choice === "del") {
        const gone = new Set(empty.map(r => r.id));
        const keep = arr.filter(r => !gone.has(r.id));
        arr.splice(0, arr.length, ...keep);
        insNorm();
        histLog("DÉSIGNATIONS CLIENT", "TITRES VIDES SUPPRIMÉS", empty.map(r => r.des || r.art || "").join(", "));
      }
      insSave();
      histLog("DÉSIGNATIONS CLIENT", created ? "NOUVEAU TITRE" : "ORDRE DES LIGNES", String(created ? created.des : (block[0].des || block[0].art || "")));
      insRedraw("des");
      /* nouveau titre : l'intitulé est prêt à être saisi */
      if (created) setTimeout(() => {
        const i = shell.querySelector(`#bdgClientBody tr[data-iid="${created.id}"] input[data-f="des"]`);
        if (i) { i.focus(); try { i.select(); } catch (e) {} i.scrollIntoView({ block: "nearest" }); }
      }, 30);
    };
    const insDrag = (event, el) => {
      const X = shell.__ins;
      if (!X) return;
      const holder = el.closest("[data-ik]");
      const k = el.dataset.ik || holder?.dataset.ik;
      const isRow = el.tagName === "TR";
      { const st = CF[k === "des" ? "client" : k]; if (st && st.sort && !st.sort.def) return; }
      const inp = event.target.closest("input.ins-in");
      const tapFocus = inp && inp !== document.activeElement ? inp : null;
      const sibs = () => isRow
        ? [...el.parentElement.querySelectorAll("tr[data-iid]")]
        : [...el.parentElement.querySelectorAll(".ins-li[data-iid]")];
      const x0 = event.clientX, y0 = event.clientY;
      let on = false, moved = false, target = null, after = false, over = false, inside = false;
      /* repères de glissement effacés partout (même si le tableau a été redessiné entre-temps) */
      const clear = () => {
        shell.querySelectorAll(".ro-before, .ro-after, .ro-in, .ro-on").forEach(x => x.classList.remove("ro-before", "ro-after", "ro-in", "ro-on"));
        document.getElementById("roLine")?.remove();
      };
      /* désignations : un seul trait à l'endroit du dépôt, décalé selon le niveau d'arrivée
         (même trait entre deux lignes d'un même titre ; en bas d'un titre : décalé = reste dedans, plus à gauche = sort) */
      const roLine = (row, y, depth) => {
        let l = document.getElementById("roLine");
        if (!l) { l = document.createElement("div"); l.id = "roLine"; document.body.appendChild(l); }
        const cell = row.querySelector('input[data-f="des"]')?.closest("td") || row;
        const c = cell.getBoundingClientRect(), t = row.closest("table").getBoundingClientRect(), box = row.closest(".bdg-d-scroll") || row.closest("table");
        const b = box.getBoundingClientRect();
        const x0 = Math.max(b.left, c.left + 4 + depth * 14), x1 = Math.min(b.right, t.right);
        l.style.cssText = `position:fixed;z-index:10060;pointer-events:none;height:3px;border-radius:2px;background:var(--inst,#12355b);left:${x0}px;width:${Math.max(20, x1 - x0)}px;top:${y - 1.5}px`;
      };
      const timer = setTimeout(() => {
        on = true;
        /* le doigt est bloqué seulement pendant le glissement (le défilement normal reste libre) */
        document.addEventListener("touchmove", tm, { passive: false });
        shell.__insDragging = true;
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        /* pas de sélection de texte (poignées bleues) pendant le glissement */
        try { window.getSelection && window.getSelection().removeAllRanges(); } catch (e) {}
        document.body.classList.add("svi-dragging");
        el.classList.add("ro-src");
        try { navigator.vibrate && navigator.vibrate(15); } catch (e) {}
      }, 350);
      const tm = e => { if (on) e.preventDefault(); };
      const move = e => {
        if (!on) {
          if (Math.abs(e.clientX - x0) > 8 || Math.abs(e.clientY - y0) > 8) { moved = true; end(false); }
          return;
        }
        e.preventDefault();
        clear();
        target = null;
        for (const x of sibs()) {
          const r = x.getBoundingClientRect();
          if (e.clientY >= r.top && e.clientY <= r.bottom) {
            if (x !== el) {
              target = x;
              over = false;
              if (k === "des") {
                /* désignations : haut = avant, milieu = superposer (nouveau titre), bas = après */
                const f = (e.clientY - r.top) / (r.height || 1);
                over = f > .25 && f < .75;
                after = f >= .75;
                const tr0 = X.INS.des.find(q => q.id === x.dataset.iid);
                const d0 = Number(tr0 && tr0.d) || 0;
                /* sous un titre replié : doigt vers la droite = entre dans le titre, vers la gauche = à l'extérieur */
                inside = false;
                if (after && tr0 && tr0.t && foldGet()[tr0.id]) {
                  const c = (x.querySelector('input[data-f="des"]')?.closest("td") || x).getBoundingClientRect();
                  inside = e.clientX > c.left + 8 + d0 * 14 + 24;
                }
                if (over) x.classList.add("ro-on");
                else roLine(x, after ? r.bottom : r.top, !after ? d0 : (tr0 && tr0.t && (!foldGet()[tr0.id] || inside)) ? d0 + 1 : d0);
              } else {
                after = e.clientY > (r.top + r.bottom) / 2;
                x.classList.add(after ? "ro-after" : "ro-before");
              }
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
        shell.querySelectorAll(".ro-src").forEach(x => x.classList.remove("ro-src"));
        document.body.classList.remove("svi-dragging");
        try { window.getSelection && window.getSelection().removeAllRanges(); } catch (e) {}
        shell.__insDragging = false;
        if (!on) {
          /* simple toucher sur une case : saisie normale */
          if (drop && !moved && tapFocus) {
            tapFocus.focus();
            try { const n = tapFocus.value.length; tapFocus.setSelectionRange(n, n); } catch (e) {}
          }
          return;
        }
        const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
        shell.addEventListener("click", stop, { capture: true, once: true });
        setTimeout(() => shell.removeEventListener("click", stop, { capture: true }), 350);
        if (!drop || !target) return;
        const arr = X.INS[k];
        const i0 = arr.findIndex(r => r.id === el.dataset.iid);
        if (i0 < 0) return;
        /* bloc déplacé : la ligne, ou le titre avec ses lignes */
        let n = 1;
        if (k === "des" && arr[i0].t) {
          while (i0 + n < arr.length && (Number(arr[i0 + n].d) || 0) > (Number(arr[i0].d) || 0)) n++;
        }
        let blockIds = arr.slice(i0, i0 + n).map(r => r.id);
        /* ligne cochée : toutes les lignes cochées du bloc se déplacent ensemble (dans leur ordre) */
        const sel = insSelIds(k);
        if (sel.has(arr[i0].id) && sel.size > 1) blockIds = arr.filter(r => sel.has(r.id)).map(r => r.id);
        if (blockIds.includes(target.dataset.iid)) return;
        if (k === "des") { desDrop(arr, blockIds, target.dataset.iid, over ? "on" : after ? (inside ? "afterIn" : "after") : "before"); return; }
        const bset = new Set(blockIds);
        const block = arr.filter(r => bset.has(r.id));
        arr.splice(0, arr.length, ...arr.filter(r => !bset.has(r.id)));
        let j = arr.findIndex(r => r.id === target.dataset.iid);
        if (after) j++;
        arr.splice(j, 0, ...block);
        X.insSave();
        histLog(k === "des" ? "DÉSIGNATIONS CLIENT" : k === "chg" ? "DÉTAIL CHARGES" : k === "prd" ? "DÉTAIL PRODUITS" : "TÂCHES",
          "ORDRE DES LIGNES", String(block[0].des || block[0].v || block[0].art || ""));
        X.insRedraw(k);
      };
      const up = () => end(true);
      const cancel = () => end(false);
      document.addEventListener("pointermove", move, { passive: false });
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", cancel);
    };
    /* iPad : l'appui sur une case non active ne lance ni la loupe ni le clavier ;
       le simple toucher la rend active (ci-dessus), l'appui long glisse la ligne */
    if (!shell.__insTouch) {
      shell.__insTouch = true;
      /* plus de blocage du toucher : il empêchait de faire défiler la page en partant d'une case.
         La loupe est évitée par le style (pas de sélection sur une case non active). */
    }

    shell.onpointerdown = event => {
      /* mode LIAISONS : la poignée d'en-tête règle la largeur des blocs TÂCHES */
      /* mode LIAISONS : poignée du bas = hauteur du bloc (mémorisée) */
      const lkH = event.target.closest(".lk-hrsz");
      if (lkH) {
        event.preventDefault(); event.stopPropagation();
        const k = lkH.dataset.lkh, box = $("insLinkView");
        const ref = lkH.parentElement.querySelector(k === "hier" ? ".lk-col" : ".lk-scroll");
        const y0 = event.clientY, h0 = ref ? ref.getBoundingClientRect().height : 170;
        let h = h0;
        lkH.classList.add("on");
        const mv = ev => { h = Math.max(80, Math.round(h0 + ev.clientY - y0)); box.style.setProperty("--lkh-" + k, h + "px"); };
        const up = () => {
          lkH.classList.remove("on");
          document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
          try { const H = JSON.parse(localStorage.getItem("svi_lkh_v1") || "{}"); H[k] = h; localStorage.setItem("svi_lkh_v1", JSON.stringify(H)); } catch (e) {}
        };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
        return;
      }
      const lkRs = event.target.closest(".lk-col .lk-rs");
      if (lkRs) {
        event.preventDefault(); event.stopPropagation();
        const grid = lkRs.closest(".lk-grid");
        const colsEl = [...grid.querySelectorAll(".lk-col")];
        const i = colsEl.indexOf(lkRs.closest(".lk-col"));
        const ws = colsEl.map(c => c.getBoundingClientRect().width);
        const x0 = event.clientX, w0 = ws[i];
        const mv = ev => { ws[i] = Math.max(120, Math.round(w0 + ev.clientX - x0)); grid.style.gridTemplateColumns = ws.map(v => v + "px").join(" "); };
        const up = () => {
          document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
          const all = cwLoad();
          ["lot", "prim", "sec"].forEach((k, j) => { all["lk_hier." + k] = Math.round(ws[j]); });
          cwSave(all);
        };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
        return;
      }
      const insEl = INS_EDIT && event.target.closest(".ins-table tr[data-iid], .ins-hcol .ins-li[data-iid]");
      if (insEl && insEl.classList.contains("lk-ban") && !event.target.closest("input.ins-cb, .ins-t")) {
        const x0 = event.clientX, y0 = event.clientY;
        const tmr = setTimeout(() => { svToast(insEl.dataset.ban || "", 3500, insEl); off(); }, 450);
        const mv = e => { if (Math.abs(e.clientX - x0) > 10 || Math.abs(e.clientY - y0) > 10) off(); };
        const off = () => { clearTimeout(tmr); document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", off); document.removeEventListener("pointercancel", off); };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", off); document.addEventListener("pointercancel", off);
        return;
      }
      if (insEl && !event.target.closest(".ins-t, .ins-cb, .ins-x, .lk-rd, .lk-q, .ins-fold") &&
          event.target.closest("input.ins-in") !== document.activeElement) { insDrag(event, insEl); return; }
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
                      doc: "DOCUMENTS", taf: "TAF", obs: "OBSERVATIONS", suivi: "SUIVI", hist: "HISTORIQUE", budget: "BUDGET COMPLET" };
    const REC_KINDS = ["doc", "taf", "obs"];

    const tabTitle = () => (tabs.find(t => t.key === active) || {}).title || "DÉTAIL";
    /* libellé affiché (avec accents) ; blkLabel reste pour les noms de fichiers */
    const blkDisp = blk => ({ client: "DÉSIGNATIONS CLIENT", hier: "TÂCHES", metre: "AVANT MÉTRÉ" }[blk] || blkLabel(blk));
    const blkLabel = blk => blk === "detail" ? tabTitle()
      : blk === "metre" ? "AVANT METRE" : blk === "interne" ? "DÉTAIL PRODUITS FORMAT INTERNE" : blkName[blk];

    const blkEmpty = blk => {
      try {
        if (blk === "detail" && active === "qlt" && !INS) return true;
        const b = blk === "suivi" ? recActive : blk;
        const d = blkData(b);
        return !d || !d.rows || !d.rows.length;
      } catch (e) { return false; }
    };
    const blkData = blk => {
      if (blk === "budget") return budgetFlat();
      if (blk === "detail" && active === "qlt" && !INS) return { head: [], rows: [] };
      if (blk === "detail" && active === "dly") {
        /* délais : tableau affiché (filtres compris), dates JJ/MM/AAAA */
        const src = lastShown.detail && lastShown.detail.kind === "dly" ? lastShown.detail : { cols: DLY_COLS, rows: [] };
        const fr = v => /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(8, 10) + "/" + String(v).slice(5, 7) + "/" + String(v).slice(0, 4) : v;
        const oc = coOrder("dly", src.cols);
        return { head: oc.map(c => c[1]), rows: src.rows.map(r => oc.map(c => fr(c[2](r)))) };
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
      /* désignations (budget en instance) : titres repliés = titre et son total seulement */
      if (blk === "client" && src.ins) {
        const hid = insHiddenFn(), F = foldGet();
        return {
          head: oc.map(c => c[1]),
          rows: src.rows.filter(r => !hid(r)).map(r => oc.map(c => c[2](r)))
        };
      }
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
      const projet = (() => { const it = sviIntitule(ref, budget.project, budget.inst); return it !== "À COMPLÉTER" ? it : budget.project; })();
      return {
        date: "Agadir, le " + String(d0.getDate()).padStart(2, "0") + " " + mois[d0.getMonth()] + " " + d0.getFullYear(),
        budget: "BUDGET N° : " + fullRef, client: "CLIENT : " + sviClient(budget.inst), projet: "PROJET : " + projet,
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
      if (!head.length) { sviAlert("Aucune donnée à exporter dans " + blkLabel(blk) + "."); return; }
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
        if (!w) { sviAlert(t); return; }
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
      if (!head.length) { sviAlert("Aucune donnée à exporter dans " + blkLabel(blk) + "."); return; }
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
        if (!w) { sviAlert(msg); return; }
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
          const projet = (() => { const it = sviIntitule(ref, budget.project, budget.inst); return it !== "À COMPLÉTER" ? it : budget.project; })();
          const top = [
            ["Agadir, le " + String(d0.getDate()).padStart(2, "0") + " " + mois[d0.getMonth()] + " " + d0.getFullYear()],
            ["BUDGET N° : " + fullRef], ["CLIENT : " + sviClient(budget.inst)], ["PROJET : " + projet],
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
          X.utils.book_append_sheet(wb, ws, blk === "budget" ? "BUDGET" : blkLabel(blk).slice(0, 31));
          /* EXPORTER LE BUDGET : 2e onglet DÉLAIS (une ligne par période, prédécesseurs) — FORMAT 57 */
          if (blk === "budget" && INS) {
            const DH = DLY_HEAD, DR = dlyExportRows();
            const ws2 = X.utils.aoa_to_sheet([DH, ...DR]);
            DH.forEach((_, c) => { const a = X.utils.encode_cell({ r: 0, c }); ws2[a].s = { font: font(true), border, fill: { fgColor: { rgb: "D9DEE6" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true } }; });
            DR.forEach((row, i) => DH.forEach((h, c) => { const a = X.utils.encode_cell({ r: i + 1, c }); ws2[a] = ws2[a] || { t: "s", v: "" }; ws2[a].s = { font: font(false), border, alignment: { horizontal: c >= 2 && c <= 5 ? "center" : "left", vertical: "top", wrapText: true } }; }));
            ws2["!cols"] = [{ wch: 24 }, { wch: 32 }, { wch: 9 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 48 }];
            X.utils.book_append_sheet(wb, ws2, "DÉLAIS");
          }
          const out = X.write(wb, { bookType: "xlsx", type: "array" });
          await deliver(base + ".xlsx", new Blob([out], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          }), dest);
        } catch (e) {
          sviAlert(e.message);
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

    /* fenêtre au format INF : lien de la feuille Google à importer */
    const askSheetLink = () => new Promise(res => {
      document.getElementById("docPop")?.remove();
      const p = document.createElement("div");
      p.id = "docPop";
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
      document.body.appendChild(p);
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

    const importGSheet = async () => {
      const url = await askSheetLink();
      if (!url) return;
      const id = (url.match(/\/d\/([a-zA-Z0-9_-]+)/) || [])[1];
      const gid = (url.match(/[#&?]gid=(\d+)/) || [])[1] || "0";
      if (!id) { svImportFail({ source: url, tries: [{ err: "LIEN GOOGLE SHEETS NON RECONNU" }], hint: "COPIER LE LIEN COMPLET DE LA FEUILLE (IL CONTIENT /spreadsheets/d/…)." }); return; }
      /* lecture par le script (avec votre compte : pas besoin de partager la feuille) */
      let first = "";
      for (const call of [() => apiGet("sheetRead", { link: url }), () => apiPost("sheetRead", { link: url })]) {
        try {
          const d = await call();
          if (d && d.ok && Array.isArray(d.values)) {
            showImport(d.name || "Google Sheets", d.values[0] || [], d.values.slice(1));
            return;
          }
          first = first || "LE SCRIPT NE CONNAÎT PAS ENCORE LA LECTURE DE FEUILLE (NOUVELLE VERSION À DÉPLOYER)";
        } catch (e) { first = first || (e && e.message) || String(e); }
      }
      /* repli : feuille partagée « Toute personne disposant du lien » */
      try {
        const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`);
        if (!r.ok) throw new Error("HTTP " + r.status + " — ACCÈS REFUSÉ (FEUILLE NON PARTAGÉE)");
        const X = await loadXLSX();
        const wb = X.read(await r.text(), { type: "string" });
        const aoa = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
        showImport("Google Sheets", aoa[0] || [], aoa.slice(1));
      } catch (e) {
        svImportFail({ source: "GOOGLE SHEETS — " + url, tries: [{ via: "PAR LE SCRIPT", err: first }, { via: "PAR LE LIEN PUBLIC", err: e }], hint: "VÉRIFIER LE LIEN, QUE VOTRE COMPTE GOOGLE A ACCÈS À LA FEUILLE, OU LA PARTAGER « TOUTE PERSONNE DISPOSANT DU LIEN » ; SINON EXPORTER LA FEUILLE EN EXCEL ET IMPORTER LE FICHIER." });
      }
    };

    /* ===== IMPORTER depuis un autre budget de l'application =====
       budget source au choix, lignes cochées par onglet ;
       options : SANS / AVEC LIAISONS, TOUT LE BUDGET */
    const IMP_TABS = [
      ["des", "DÉSIGNATIONS CLIENT"], ["hier", "TÂCHES"],
      ["chg", "DÉTAIL CHARGES"], ["prd", "DÉTAIL PRODUITS"],
      ["qlt", "DÉTAIL QUALITÉ"], ["dly", "DÉTAIL DÉLAIS"]
    ];
    const impFr = iso => iso ? String(iso).slice(8, 10) + "/" + String(iso).slice(5, 7) + "/" + String(iso).slice(0, 4) : "";
    /* U_ : défini plus haut (utilisé dès l'ouverture du budget) */
    /* identité d'une ligne : deux lignes identiques = doublon (jamais importé deux fois)
       désignations / charges : ART + DÉSIGNATION + UNITÉ (+ titre) ;
       produits : idem (ART + DÉSIGNATION + UNITÉ) */
    const impId = (k, r) => {
      const n = v => v === "" || v === undefined || v === null ? "" : (Math.round(num(v) * 1000) / 1000).toString();
      /* produits : sans article — DÉSIGNATION + UNITÉ */
      /* FORMAT 89 : une désignation (et une charge) se reconnaît par sa DÉSIGNATION + UNITÉ, sans l'ART ;
         seuls les titres gardent leur ART */
      const base = [r.t ? U_(r.art) : "", U_(r.des), U_(r.u), r.t ? "T" : ""];
      return base.join("|");
    };
    /* charges, lots et activités : ordre alphabétique */
    const impSort = m => {
      const az = (a, b) => String(a).localeCompare(String(b), "fr", { numeric: true });
      m.chg.sort((a, b) => az(a.row.des, b.row.des) || az(a.row.u, b.row.u));
      m.hier.sort((a, b) => az(a.row.v, b.row.v));
    };
    /* modèle d'un budget source : lignes de chaque onglet + liens (lignes de détail) */
    const impModel = ref => {
      const g = groups.get(ref);
      const m = { des: [], hier: [], chg: [], prd: [], qlt: [], dly: [], links: [] };
      if (!g) return m;
      if (g.inst) {
        const d = g.inst.data || {};
        const seen = new Set();
        ["des", "chg", "prd"].forEach(k => (d[k] || []).forEach(r => {
          const id = k + "|" + impId(k, r);
          if (seen.has(id)) return;
          seen.add(id);
          const row = { ...r };
          if (k === "prd") ["art", "nbr", "d1", "d2", "d3", "q", "p"].forEach(f => delete row[f]);
          m[k].push({ key: id, row });
        }));
        ["lot", "prim", "sec"].forEach(k => (d[k] || []).forEach(r => {
          const id = k + "|" + U_(r.v);
          if (!U_(r.v) || seen.has(id)) return;
          seen.add(id);
          m.hier.push({ key: id, lvl: k, row: { v: U_(r.v) } });
        }));
        /* qualité (une colonne) et délais (périodes par tâche primaire) */
        (d.qlt || []).forEach(r => { const id = "qlt|" + U_(r.v); if (U_(r.v) && !seen.has(id)) { seen.add(id); m.qlt.push({ key: id, row: { v: U_(r.v) } }); } });
        const dD = d.dlpSec ? d : (() => { const c = { links: d.links, dlp: d.dlp }; sviDlpSec(c); return c; })();
        Object.keys(dD.dlp || {}).forEach(tk => {
          const [lo, se] = tk.split("|");
          const ln = U_(((d.lot || []).find(x => x.id === lo) || {}).v), sn = U_(((d.sec || []).find(x => x.id === se) || {}).v);
          if (!ln || !sn) return;
          (dD.dlp[tk] || []).forEach(pp => m.dly.push({ key: "dly|" + ln + "|" + sn + "|" + (pp.deb || "") + "|" + (pp.fin || ""),
            row: { lot: ln, sec: sn, deb: impFr(pp.deb), fin: impFr(pp.fin), _deb: pp.deb || "", _fin: pp.fin || "" } }));
        });
        /* liaisons validées du budget source : un chemin par produit / charge */
        const byId = (k, id) => (d[k] || []).find(x => x.id === id);
        (d.links || []).forEach(l => {
          const D = byId("des", l.des), L = byId("lot", l.lot), P = byId("prim", l.prim), S = byId("sec", l.sec);
          if (!D || !L || !P || !S) return;
          const base = { dk: "des|" + impId("des", D), lot: "lot|" + U_(L.v), prim: "prim|" + U_(P.v), sec: "sec|" + U_(S.v) };
          (l.prd || []).forEach(x => { const r = byId("prd", x.id); if (r) m.links.push({ ...base, pk: "prd|" + impId("prd", r), q: x.q }); });
          (l.chg || []).forEach(x => { const r = byId("chg", x.id); if (r) m.links.push({ ...base, ck: "chg|" + impId("chg", r), q: x.q }); });
        });
        impSort(m);
        return m;
      }
      /* type CHG / PRD lu dans le budget source (l'écran courant, vide, ne le connaît pas) */
      const tk = Object.keys(g.rows[0] || {}).find(k => { const n = nk(k); return n.includes("CHG") && n.includes("PRD"); });
      const ls = g.rows.map((row, i) => {
        const l = toLine(row, i);
        const t = nk(tk ? row[tk] : "");
        l.kind = t.startsWith("PRD") || t.startsWith("PROD") ? "prd" : t.startsWith("CHG") || t.startsWith("CHARGE") ? "chg" : "";
        if (l.kind === "prd" && !l.qty) {
          const f = [l.nbr, ...l.dims].filter(v => normalise(v) !== "").map(num);
          if (f.length) l.qty = f.reduce((a, b) => a * b, 1);
        }
        return l;
      });
      const dmap = new Map(), cmap = new Map(), hset = new Map(), pset = new Set();
      ls.forEach(l => {
        const dk = "d" + U_(l.article) + "||" + U_(l.designation);
        if (!dmap.has(dk)) dmap.set(dk, { key: dk, ms: [] });
        dmap.get(dk).ms.push(l);
        const ks = { dk, q: Number(l.qty) || "" };
        [["lot", l.lot], ["prim", l.prim], ["sec", l.sec]].forEach(([k, v]) => {
          if (!U_(v)) return;
          const hk = k + "|" + U_(v);
          if (!hset.has(hk)) hset.set(hk, { key: hk, lvl: k, row: { v: U_(v) } });
          ks[k] = hk;
        });
        if (l.kind === "chg") {
          const ck = "c" + U_(l.detail) + "||" + U_(l.dunit);
          if (!cmap.has(ck)) cmap.set(ck, { key: ck, ms: [] });
          cmap.get(ck).ms.push(l);
          ks.ck = ck;
        } else if (l.kind === "prd") {
          /* produit : ART, DÉSIGNATION, UNITÉ ; quantité et prix propres à chaque tâche, non repris */
          const row = { des: U_(l.detail), u: U_(l.dunit || l.unit), tva: 20 };
          /* produit identique déjà listé : une seule ligne (ses liens sont gardés) */
          const pk = "p" + impId("prd", row);
          if (!pset.has(pk)) { pset.add(pk); m.prd.push({ key: pk, row }); }
          ks.pk = pk;
        }
        m.links.push(ks);
      });
      dmap.forEach(x => {
        /* même calcul que l'écran : clés primaires (produit au prix non nul) */
        const prim = l => l.kind !== "chg" && (l.cprice || l.priceTTC);
        const k = x.ms.find(prim) || x.ms[0];
        const q = x.ms.filter(prim).reduce((t, l) => t + (Number(l.qty) || 0), 0);
        m.des.push({ key: x.key, row: { art: k.article, des: U_(k.designation), u: U_(k.dunit || k.unit), q, p: k.price, tva: 20 } });
      });
      cmap.forEach(x => {
        const f = x.ms[0];
        const q = x.ms.reduce((t, l) => t + (Number(l.qty) || 0), 0);
        const a = x.ms.reduce((t, l) => t + (Number(l.amount) || 0), 0);
        m.chg.push({ key: x.key, row: { art: "", des: U_(f.detail), u: U_(f.dunit), q, p: q ? a / q : 0, tva: 20 } });
      });
      m.hier = [...hset.values()];
      /* délais du budget validé : une période par tâche secondaire (du premier début à la dernière fin) */
      { const dm = new Map();
        ls.forEach(l => {
          const ln = U_(l.lot), pn = U_(l.sec);
          if (!ln || !pn || (!l.deb && !l.fin)) return;
          const k = ln + "|" + pn;
          if (!dm.has(k)) dm.set(k, { lot: ln, sec: pn, _deb: "", _fin: "" });
          const x = dm.get(k);
          if (l.deb && (!x._deb || l.deb < x._deb)) x._deb = l.deb;
          if (l.fin && (!x._fin || l.fin > x._fin)) x._fin = l.fin;
        });
        dm.forEach(x => m.dly.push({ key: "dly|" + x.lot + "|" + x.sec + "|" + x._deb + "|" + x._fin, row: { ...x, deb: impFr(x._deb), fin: impFr(x._fin) } })); }
      m.des.sort((a, b) => String(a.row.art).localeCompare(String(b.row.art), "fr", { numeric: true }));
      impSort(m);
      return m;
    };
    /* DUPLIQUER : copie complète (désignations, tâches, détails, qualité, liaisons, délais) dans un nouveau budget en instance ;
       DOCUMENTS / TAF / OBSERVATIONS et historique ne sont pas copiés ; le nouveau budget s'ouvre directement */
    const dupData = () => {
      if (budget.inst) return JSON.parse(JSON.stringify(budget.inst.data || {}));
      const m = impModel(ref), kid = new Map();
      const d = { des: [], lot: [], prim: [], sec: [], chg: [], prd: [], qlt: [], dly: {}, dlp: {}, dlpSec: true, links: [] };
      ["des", "chg", "prd", "qlt"].forEach(k => m[k].forEach(x => { const r = { ...x.row, id: insId(), on: false }; if (k === "des") r.t = !!r.t; d[k].push(r); kid.set(x.key, r.id); }));
      m.hier.forEach(x => { const r = { id: insId(), v: x.row.v }; d[x.lvl].push(r); kid.set(x.key, r.id); });
      m.links.forEach(l => {
        const des = kid.get(l.dk), lot = kid.get(l.lot), prim = kid.get(l.prim), sec = kid.get(l.sec);
        const pid = l.pk && kid.get(l.pk), cid = l.ck && kid.get(l.ck);
        if (!des || !lot || !prim || !sec) return;
        let L = d.links.find(x => x.des === des && x.lot === lot && x.prim === prim && x.sec === sec);
        if (!L) { L = { id: insId(), des, lot, prim, sec, prd: [], chg: [] }; d.links.push(L); }
        if (pid && !L.prd.some(y => y.id === pid)) L.prd.push({ id: pid, q: "" });
        if (cid && !L.chg.some(y => y.id === cid)) L.chg.push({ id: cid, q: "" });
      });
      d.links = d.links.filter(x => x.prd.length);
      m.dly.forEach(x => { const lo = kid.get("lot|" + x.row.lot), pr = kid.get("sec|" + x.row.sec); if (lo && pr) (d.dlp[lo + "|" + pr] = d.dlp[lo + "|" + pr] || []).push({ id: insId(), deb: x.row._deb, fin: x.row._fin }); });
      return d;
    };
    $("instDup")?.addEventListener("click", () => {
      const go = () => {
        const now = new Date(), p2 = n => String(n).padStart(2, "0");
        const nr = nextBudgetRef(now);
        const list = instLoad();
        list.push({ ref: nr, project: budget.project, intitule: (budget.inst && budget.inst.intitule) || "À COMPLÉTER", client: (budget.inst && budget.inst.client) || "",
          created: now.getFullYear() + "-" + p2(now.getMonth() + 1) + "-" + p2(now.getDate()) + "T" + p2(now.getHours()) + ":" + p2(now.getMinutes()),
          state: "instance", data: dupData() });
        instSave(list);
        histLog("BUDGET", "DUPLIQUÉ", fullRef + " → " + budget.project + " " + nr);
        try { localStorage.setItem("svi_listmode_v1", "inst"); } catch (e) {}
        $("budgetBackBtn")?.click();
        setTimeout(() => {
          renderBudgetList();
          setTimeout(() => { const tr = [...document.querySelectorAll("tr[data-budget-ref]")].find(x => x.dataset.budgetRef === nr); if (tr) tr.click(); }, 40);
        }, 40);
      };
      (shell.__lkGuard ? shell.__lkGuard() : Promise.resolve(true)).then(ok => { if (ok) go(); });
    });
    const openImportBudget = blk => {
      if (!INS) return;
      const startTab = blk === "client" ? "des" : blk === "hier" ? "hier" : (active === "prd" ? "prd" : "chg");
      const refs = [...groups.keys()].filter(r => r !== ref)
        .sort((a, b) => String(a).localeCompare(String(b), "fr", { numeric: true }));
      /* couleur de l'état, comme dans la liste des budgets */
      const stCls = g => !g.inst || g.inst.state === "valide" ? "" : g.inst.state === "fige" ? "imp-fige" : "imp-inst";
      const refLab = r => { const g = groups.get(r); return U_(g.project) + " " + r; };
      let src = refs[0] || "", model = impModel(src), tab = startTab, withLinks = false, all = false;
      const sel = { des: new Set(), hier: new Set(), chg: new Set(), prd: new Set(), qlt: new Set(), dly: new Set() };
      /* lignes liées décochées à la main : la liaison est coupée à cet endroit */
      const cut = new Set();
      document.getElementById("docPop")?.remove();
      const p = document.createElement("div");
      p.id = "docPop";
      p.className = "pop-new-bdg";
      p.innerHTML = `
        <div class="doc-card imp-card" role="dialog" aria-modal="true">
          <div class="doc-head">
            <span class="doc-title">IMPORTER — ${esc(blkDisp(blk))}</span>
            <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
          </div>
          <div class="doc-body">
            <div class="imp-row"><span class="doc-lab">BUDGET SOURCE <b>*</b></span>
              <div class="imp-src">
                <button type="button" class="imp-src-btn" id="impSrc"></button>
                <div class="imp-src-list" hidden>${refs.map(r =>
                  `<button type="button" class="imp-src-it ${stCls(groups.get(r))}" data-ref="${esc(r)}">${esc(refLab(r))}</button>`).join("")}</div>
              </div></div>
            <div class="imp-opts">
              <label><input type="radio" name="impLk" value="0" checked> SANS LIAISONS <small>(LIGNES COCHÉES SEULEMENT)</small></label>
              <label><input type="radio" name="impLk" value="1"> AVEC LIAISONS <small>(+ TÂCHES ET DÉTAILS LIÉS)</small></label>
            </div>
            <div class="imp-tabs"></div>
            <div class="imp-scroll"><table class="bdg-d-table imp-table"></table></div>
          </div>
          <div class="doc-foot imp-foot">
            <span class="imp-n"></span>
            <span><button type="button" class="doc-btn" data-cancel>ANNULER</button>
            <button type="button" class="doc-btn nb-save" id="impGo">IMPORTER</button></span>
          </div>
        </div>`;
      document.body.appendChild(p);
      try { popEnhance(p, "impbdg"); } catch (e) {}
      const cols = {
        des: [["art", "ART"], ["des", "DÉSIGNATION"], ["u", "UPB"], ["q", "QPB", 1], ["p", "PPB", 1]],
        hier: [["lvl", "NIVEAU"], ["v", "LIBELLÉ"]],
        chg: [["des", "DÉSIGNATION"], ["u", "UCB"], ["q", "QCB", 1], ["p", "PCB", 1]],
        prd: [["des", "DÉSIGNATION"], ["u", "UPB"]],
        qlt: [["v", "QUALITÉ"]],
        dly: [["lot", "LOT"], ["sec", "ACTIVITÉ SECONDAIRE"], ["deb", "DÉBUT"], ["fin", "FIN"]]
      };
      const LV = { lot: "LOT", prim: "ACTIVITÉ PRIMAIRE", sec: "ACTIVITÉ SECONDAIRE" };
      const val = (x, f, isNum) => f === "lvl" ? LV[x.lvl] : x.row.t && isNum ? "" : isNum ? money(f === "q" ? insQty(tab === "prd" ? "prd" : "des", x.row) : x.row[f]) : (x.row[f] ?? "");
      /* tri et filtre par colonne (mêmes menus que les autres tableaux) */
      const cfCols = () => cols[tab].map(c => [c[0], c[1],
        x => c[0] === "lvl" ? LV[x.lvl] : c[2] ? (x.row.t ? "" : c[0] === "q" ? insQty(tab === "prd" ? "prd" : "des", x.row) : num(x.row[c[0]] || 0)) : (x.row[c[0]] ?? ""),
        c[2] ? "number" : ""]);
      /* ART et unité centrés, nombres à droite */
      const impCls = c => c[2] ? "number" : (c[0] === "art" || c[0] === "u") ? "center" : "";
      const shownRows = () => cfApply("imp_" + tab, cfCols(), model[tab]);
      /* lignes retenues : cochées, + liées (AVEC LIAISONS), ou tout le budget */
      const picked = (noCut = false) => {
        const out = { des: new Set(), hier: new Set(), chg: new Set(), prd: new Set(), qlt: new Set(), dly: new Set() };
        if (all) { IMP_TABS.forEach(([k]) => model[k].forEach(x => out[k].add(x.key))); return out; }
        IMP_TABS.forEach(([k]) => sel[k].forEach(x => out[k].add(x)));
        if (withLinks) {
          /* chaque ligne de détail = un chemin DÉSIGNATION › LOT › PRIMAIRE › SECONDAIRE › DÉTAIL.
             Depuis une ligne cochée, on descend et on remonte le chemin ;
             une ligne décochée à la main coupe le chemin : elle et tout ce qui est
             au-delà (en dessous quand on descend, au-dessus quand on remonte) ne suivent plus. */
          model.links.forEach(l => {
            const path = [["des", l.dk], ["hier", l.lot], ["hier", l.prim], ["hier", l.sec],
              ["chg", l.ck], ["prd", l.pk]].filter(x => x[1]);
            path.forEach(([t, k], i) => {
              if (!sel[t].has(k)) return;
              const ok = k2 => noCut || !cut.has(k2);
              for (let j = i + 1; j < path.length && ok(path[j][1]); j++) out[path[j][0]].add(path[j][1]);
              for (let j = i - 1; j >= 0 && ok(path[j][1]); j--) out[path[j][0]].add(path[j][1]);
            });
          });
          /* délais : ils suivent leur tâche primaire (lot et activité primaire retenus) */
          model.dly.forEach(x => { if (out.hier.has("lot|" + x.row.lot) && out.hier.has("sec|" + x.row.sec)) out.dly.add(x.key); });
        }
        return out;
      };
      /* lignes retenues (cochées ou liées) en haut du tableau, comme les lignes bleues de l'écran */
      const upTop = (rows, set) => rows.map((x, i) => ({ x, i }))
        .sort((a, b) => (set.has(b.x.key) - set.has(a.x.key)) || a.i - b.i).map(o => o.x);
      const render = () => {
        /* coupures sans objet (plus aucune liaison n'y passe) : oubliées */
        const pAll = withLinks ? picked(true) : null;
        if (pAll) [...cut].forEach(k => { if (!IMP_TABS.some(([t]) => pAll[t].has(k))) cut.delete(k); });
        const pk = picked();
        const n = IMP_TABS.reduce((t, [k]) => t + pk[k].size, 0);
        p.querySelector(".imp-tabs").innerHTML = IMP_TABS.map(([k, lab]) =>
          /* pastille grise : lignes disponibles ; pastille rouge : lignes retenues */
          `<button type="button" class="imp-tab${k === tab ? " on" : ""}" data-tab="${k}">${lab} ${svCnt(model[k].length)}${pk[k].size ? `<span class="imp-selcnt">${pk[k].size}</span>` : ""}</button>`).join("");
        sviMarkEmptyTabs(p.querySelector(".imp-tabs"));
        const box = p.querySelector(".imp-scroll");
        /* TÂCHES : trois blocs côte à côte (lots, activités primaires, secondaires) */
        if (tab === "hier") {
          box.classList.add("imp-hier");
          /* largeur de chaque bloc : réglable par la poignée de son en-tête, mémorisée */
          const ws = ["lot", "prim", "sec"].map(lv => cwLoad()["imp_hier." + lv]);
          box.style.gridTemplateColumns = ws.every(Boolean) && window.innerWidth > 700 ? ws.map(w => w + "px").join(" ") : "";
          box.innerHTML = ["lot", "prim", "sec"].map(lv => {
            const rows = upTop(cfApply("imp_" + lv, [["v", LV[lv], x => x.row.v || "", ""]], model.hier.filter(x => x.lvl === lv)), pk.hier);
            const allOn = rows.length && rows.every(x => pk.hier.has(x.key));
            return `<div class="imp-hcol"><table class="bdg-d-table imp-table">
              <thead><tr><th class="center" style="width:34px"><input type="checkbox" class="imp-cball" data-lvl="${lv}" ${allOn ? "checked" : ""}></th>
                ${cfHead("imp_" + lv, "v", LV[lv] + " " + svCnt(rows.length), "")}</tr></thead>
              <tbody>${rows.map(x => {
                const on = pk.hier.has(x.key), linked = on && !sel.hier.has(x.key);
                const isCut = withLinks && cut.has(x.key) && !on && pAll && pAll.hier.has(x.key);
                return `<tr class="${linked ? "imp-linked" : ""}${isCut ? " imp-cut" : ""}" data-k="${esc(x.key)}">
                  <td class="center"><input type="checkbox" class="imp-cb" ${on ? "checked" : ""}></td>
                  <td>${esc(x.row.v)}</td></tr>`;
              }).join("") || `<tr><td colspan="2" class="empty">—</td></tr>`}</tbody></table></div>`;
          }).join("");
        } else {
        if (box.classList.contains("imp-hier") || !box.querySelector(".imp-table")) {
          box.classList.remove("imp-hier");
          box.style.gridTemplateColumns = "";
          box.innerHTML = `<table class="bdg-d-table imp-table"></table>`;
        }
        /* colonnes : ordre et largeurs réglables (glisser l'en-tête / la poignée), mémorisés */
        const cs = coOrder("imp_" + tab, cols[tab]), rows = upTop(shownRows(), pk[tab]);
        const allOn = rows.length && rows.every(x => pk[tab].has(x.key));
        const IMPW = { art: 70, des: 340, u: 70, q: 110, p: 110 };
        const wOf = k => cwLoad()["imp_" + tab + "." + k] || IMPW[k] || 110;
        const tbl = p.querySelector(".imp-table");
        tbl.style.width = (40 + cs.reduce((t, c) => t + wOf(c[0]), 0)) + "px";
        tbl.style.tableLayout = "fixed";
        tbl.innerHTML =
          `<colgroup><col style="width:40px">${cs.map(c => `<col data-w="imp_${tab}.${c[0]}" style="width:${wOf(c[0])}px">`).join("")}</colgroup><thead><tr><th class="center" style="width:34px"><input type="checkbox" class="imp-cball" ${allOn ? "checked" : ""} ${all ? "disabled" : ""}></th>${cs.map(c => cfHead("imp_" + tab, c[0], c[1], impCls(c))).join("")}</tr></thead>
           <tbody>${rows.map(x => {
             const on = pk[tab].has(x.key), linked = on && !sel[tab].has(x.key) && !all;
             const isCut = withLinks && cut.has(x.key) && !on && pAll && pAll[tab].has(x.key);
             return `<tr class="${x.row.t ? "imp-tt" : ""}${linked ? " imp-linked" : ""}${isCut ? " imp-cut" : ""}" data-k="${esc(x.key)}">
               <td class="center"><input type="checkbox" class="imp-cb" ${on ? "checked" : ""} ${all || (tab === "dly" && !withLinks) ? "disabled" : ""}></td>
               ${cs.map(c => `<td class="${impCls(c)}">${esc(val(x, c[0], c[2]))}</td>`).join("")}</tr>`;
           }).join("") || `<tr><td colspan="${cs.length + 1}" class="empty">AUCUNE LIGNE</td></tr>`}</tbody>`;
        }
        p.querySelector(".imp-n").textContent = n + " LIGNE(S) À IMPORTER" + (withLinks && !all ? " (LIAISONS COMPRISES)" : "");
        p.querySelector("#impGo").textContent = "IMPORTER (" + n + ")";
        p.querySelector("#impGo").disabled = !n;
      };
      /* poignées de largeur et glisser des en-têtes : même mécanisme que l'écran */
      p.addEventListener("pointerdown", e => {
        /* TÂCHES : la poignée d'en-tête règle la largeur du bloc */
        const hrs = e.target.closest(".imp-hcol .col-rs");
        if (hrs) {
          e.preventDefault(); e.stopPropagation();
          const grid = p.querySelector(".imp-scroll.imp-hier");
          const colsEl = [...grid.querySelectorAll(".imp-hcol")];
          const i = colsEl.indexOf(hrs.closest(".imp-hcol"));
          const ws = colsEl.map(c => c.getBoundingClientRect().width);
          const x0 = e.clientX, w0 = ws[i];
          hrs.classList.add("on");
          const mv = ev => {
            ws[i] = Math.max(120, Math.round(w0 + ev.clientX - x0));
            grid.style.gridTemplateColumns = ws.map(v => v + "px").join(" ");
          };
          const up = () => {
            document.removeEventListener("pointermove", mv);
            document.removeEventListener("pointerup", up);
            document.removeEventListener("pointercancel", up);
            hrs.classList.remove("on");
            const all = cwLoad();
            ["lot", "prim", "sec"].forEach((lv, j) => { all["imp_hier." + lv] = Math.round(ws[j]); });
            cwSave(all);
          };
          document.addEventListener("pointermove", mv);
          document.addEventListener("pointerup", up);
          document.addEventListener("pointercancel", up);
          return;
        }
        if (e.target.closest(".col-rs") || (e.target.closest(".imp-table th") && !e.target.closest(".cf-btn, input"))) {
          if (typeof shell.onpointerdown === "function") shell.onpointerdown(e);
        }
      });
      const showSrc = () => {
        const b = p.querySelector("#impSrc");
        b.className = "imp-src-btn " + (src ? stCls(groups.get(src)) : "");
        b.textContent = src ? refLab(src) : "AUCUN AUTRE BUDGET";
        p.querySelectorAll(".imp-src-it").forEach(x => x.classList.toggle("on", x.dataset.ref === src));
      };
      showSrc();
      render();
      /* un tri / filtre choisi redessine la fenêtre */
      window.__sviImpRefresh = () => { if (document.body.contains(p)) render(); else window.__sviImpRefresh = null; };
      /* liste des budgets : même présentation et mêmes couleurs que l'application */
      p.querySelector(".imp-src").addEventListener("click", e => {
        e.stopPropagation();
        const list = p.querySelector(".imp-src-list");
        const it = e.target.closest(".imp-src-it");
        if (it) {
          list.hidden = true;
          if (it.dataset.ref !== src) {
            src = it.dataset.ref; model = impModel(src);
            IMP_TABS.forEach(([k]) => sel[k].clear());
            cut.clear();
            showSrc(); render();
          }
          return;
        }
        if (e.target.closest("#impSrc")) list.hidden = !list.hidden;
      });
      p.addEventListener("change", e => {
        if (e.target.name === "impLk") { withLinks = e.target.value === "1"; render(); return; }
        if (e.target.classList.contains("imp-cball")) {
          const lv = e.target.dataset.lvl;
          const rows = lv
            ? cfApply("imp_" + lv, [["v", LV[lv], x => x.row.v || "", ""]], model.hier.filter(x => x.lvl === lv))
            : shownRows();
          rows.forEach(x => {
            if (e.target.checked) { sel[tab].add(x.key); cut.delete(x.key); }
            else sel[tab].delete(x.key);
          });
          render(); return;
        }
        const tr = e.target.closest("tr[data-k]");
        if (tr && e.target.classList.contains("imp-cb")) {
          const k = tr.dataset.k;
          if (e.target.checked) { sel[tab].add(k); cut.delete(k); }
          else {
            sel[tab].delete(k);
            /* encore retenue par une liaison : la liaison est coupée ici */
            if (withLinks && picked()[tab].has(k)) cut.add(k);
          }
          render();
        }
      });
      p.addEventListener("click", e => {
        const cfb = e.target.closest(".cf-btn");
        if (cfb) { e.stopPropagation(); cfOpenMenu(cfb); return; }
        const t = e.target.closest("[data-tab]");
        if (t) { tab = t.dataset.tab; render(); return; }
        if (!e.target.closest(".imp-src")) { const l = p.querySelector(".imp-src-list"); if (l) l.hidden = true; }
        if (e.target === p || e.target.closest("[data-cancel]")) { p.remove(); return; }
        if (!e.target.closest("#impGo")) return;
        const pk = picked();
        const lk = withLinks || all;
        /* lignes à importer, rangées par bloc du budget */
        const inc = { des: [], chg: [], prd: [], qlt: [], lot: [], prim: [], sec: [] };
        ["des", "chg", "prd", "qlt"].forEach(k => model[k].filter(x => pk[k].has(x.key)).forEach(x => inc[k].push(x)));
        model.hier.filter(x => pk.hier.has(x.key)).forEach(x => inc[x.lvl].push(x));
        const LAB = { des: "DÉSIGNATIONS CLIENT", lot: "LOTS", prim: "ACTIVITÉS PRIMAIRES", sec: "ACTIVITÉS SECONDAIRES",
          chg: "DÉTAIL CHARGES", prd: "DÉTAIL PRODUITS", qlt: "DÉTAIL QUALITÉ" };
        const busy = Object.keys(inc).filter(k => inc[k].length && INS[k].length);
        const run = mode => {
          let added = 0, upd = 0, skip = 0;
          const kid = new Map();   /* clé du budget source → id de la ligne dans ce budget */
          const same = (k, a, b) => k === "lot" || k === "prim" || k === "sec" || k === "qlt"
            ? U_(a.v) === U_(b.v)
            : impId(k, a) === impId(k, b);
          Object.keys(inc).forEach(k => {
            if (!inc[k].length) return;
            if (mode === "replace") INS[k] = [];
            inc[k].forEach(x => {
              const hierK = k === "lot" || k === "prim" || k === "sec" || k === "qlt";
              const r = hierK ? { v: x.row.v } : { ...x.row };
              const old = INS[k].find(o => same(k, o, r));
              if (old) kid.set(x.key, old.id);
              if (old) {
                if (mode !== "update" || hierK) { skip++; return; }
                let ch = false;
                ["q", "p", "tva", "nbr", "d1", "d2", "d3"].forEach(f => {
                  if (r[f] !== undefined && String(r[f]) !== String(old[f] ?? "")) { old[f] = r[f]; ch = true; }
                });
                ch ? upd++ : skip++;
                return;
              }
              r.id = insId(); r.on = false;
              if (k === "des") r.t = !!r.t;
              if (lk) r.lk = { src, key: x.key, links: hierK ? undefined
                : model.links.filter(l => l.dk === x.key || l.ck === x.key || l.pk === x.key) };
              INS[k].push(r); added++;
              kid.set(x.key, r.id);
            });
          });
          /* AVEC LIAISONS : les chemins du budget source deviennent des liaisons validées */
          let nl = 0;
          if (lk) {
            if (mode === "replace") INS.links = [];
            INS.links = INS.links || [];
            const ok = { des: new Set(INS.des.map(x => x.id)), lot: new Set(INS.lot.map(x => x.id)), prim: new Set(INS.prim.map(x => x.id)),
              sec: new Set(INS.sec.map(x => x.id)), prd: new Set(INS.prd.map(x => x.id)), chg: new Set(INS.chg.map(x => x.id)) };
            const fresh = new Set();
            model.links.forEach(l => {
              const des = kid.get(l.dk), lot = kid.get(l.lot), prim = kid.get(l.prim), sec = kid.get(l.sec);
              const pid = l.pk && kid.get(l.pk), cid = l.ck && kid.get(l.ck);
              if (!ok.des.has(des) || !ok.lot.has(lot) || !ok.prim.has(prim) || !ok.sec.has(sec)) return;
              if (!(pid && ok.prd.has(pid)) && !(cid && ok.chg.has(cid))) return;
              let L = INS.links.find(x => x.des === des && x.lot === lot && x.prim === prim && x.sec === sec);
              if (!L) { L = { id: insId(), des, lot, prim, sec, prd: [], chg: [] }; INS.links.push(L); nl++; }
              const add = (arr, id) => {
                const e = arr.find(x => x.id === id);
                /* même produit plusieurs fois sur la même tâche : quantités additionnées (une seule fois par import) */
                if (e) { if (fresh.has(e) && l.q !== "" && l.q !== undefined) e.q = (Number(e.q) || 0) + Number(l.q); }
                else { const n = { id, q: l.q === undefined ? "" : l.q }; arr.push(n); fresh.add(n); }
              };
              if (pid && ok.prd.has(pid)) add(L.prd = L.prd || [], pid);
              if (cid && ok.chg.has(cid)) add(L.chg = L.chg || [], cid);
            });
            /* une liaison doit avoir au moins un produit */
            INS.links = INS.links.filter(x => (x.prd || []).length);
            /* délais : rattachés à la tâche secondaire importée (lot + activité secondaire), seulement avec les liaisons */
            INS.dlp = INS.dlp || {};
            if (mode === "replace") INS.dlp = {};
            model.dly.filter(x => pk.dly.has(x.key)).forEach(x => {
              const lo = kid.get("lot|" + x.row.lot), pr = kid.get("sec|" + x.row.sec);
              if (!lo || !pr) return;
              const key = lo + "|" + pr, list = INS.dlp[key] = INS.dlp[key] || [];
              if (!list.some(p => p.deb === x.row._deb && p.fin === x.row._fin)) list.push({ id: insId(), deb: x.row._deb, fin: x.row._fin });
            });
          }
          insSave();
          const M = { add: "AJOUT", replace: "REMPLACEMENT", update: "MISE À JOUR" }[mode];
          insSortAll(); insSave();
          histLog("IMPORT", "DEPUIS UN AUTRE BUDGET — " + M, src + " — " + added + " AJOUTÉE(S), " + upd + " MISE(S) À JOUR, " + skip + " IGNORÉE(S)" + (lk ? " — " + nl + " LIAISON(S)" : ""));
          p.remove();
          refreshAll();
        };
        if (!busy.length) { run("add"); return; }
        /* des lignes existent déjà : l'utilisateur choisit */
        p.querySelector(".imp-ask")?.remove();
        const ask = document.createElement("div");
        ask.className = "imp-ask";
        ask.innerHTML = `<div class="imp-ask-card" role="dialog" aria-modal="true">
            <div class="imp-ask-t">DONNÉES DÉJÀ PRÉSENTES</div>
            <button type="button" class="imp-ask-b" data-mode="add"><b>AJOUTER</b><span>LES LIGNES EXISTANTES SONT GARDÉES ; LES LIGNES IDENTIQUES NE SONT PAS AJOUTÉES</span></button>
            <button type="button" class="imp-ask-b" data-mode="update"><b>METTRE À JOUR</b><span>LES LIGNES IDENTIQUES PRENNENT LA QUANTITÉ ET LE PRIX IMPORTÉS ; LES NOUVELLES S'AJOUTENT</span></button>
            <button type="button" class="imp-ask-b imp-ask-r" data-mode="replace"><b>REMPLACER</b><span>LES BLOCS CI-DESSUS SONT VIDÉS PUIS REMPLIS AVEC LES LIGNES IMPORTÉES</span></button>
            <div class="imp-ask-f"><button type="button" class="doc-btn" data-ask-cancel>ANNULER</button></div>
          </div>`;
        p.appendChild(ask);
        ask.addEventListener("click", ev => {
          ev.stopPropagation();
          if (ev.target === ask || ev.target.closest("[data-ask-cancel]")) { ask.remove(); return; }
          const b = ev.target.closest("[data-mode]");
          if (!b) return;
          /* REMPLACER : confirmation dans la fenêtre (pas de message Safari) */
          if (b.dataset.mode === "replace" && !ask.classList.contains("imp-ask-confirm")) {
            ask.classList.add("imp-ask-confirm");
            ask.querySelector(".imp-ask-card").innerHTML = `
              <div class="imp-ask-t">REMPLACER</div>
              <div class="imp-ask-w">LES LIGNES EXISTANTES DE ${busy.map(k => LAB[k]).join(", ")} SERONT SUPPRIMÉES.</div>
              <div class="imp-ask-f">
                <button type="button" class="doc-btn" data-ask-cancel>ANNULER</button>
                <button type="button" class="doc-btn imp-ask-ok" data-mode="replace">REMPLACER</button>
              </div>`;
            return;
          }
          run(b.dataset.mode);
        });
      });
    };

    /* ===== BUDGET ENTIER SUR UN SEUL ONGLET (export / import)
       une ligne par produit ou charge, avec toute sa chaîne ; les lignes non liées figurent seules.
       Ni prix, ni montant, ni TVA, ni délais ; QTE seulement pour les charges. ===== */
    const BF_HEAD = ["ART", "DÉSIGNATION CLIENT", "UPB", "LOT", "ACTIVITÉ PRIMAIRE", "ACTIVITÉ SECONDAIRE",
      "TYPE (PRD / CHG)", "ARTICLE", "DÉSIGNATION", "UNITÉ", "NBR", "DIM 1", "DIM 2", "DIM 3", "QTE"];
    const budgetFlat = () => {
      const d = dupData();
      const by = (k, id) => (d[k] || []).find(x => x.id === id) || {};
      const n = v => v === "" || v === undefined || v === null ? "" : num(v);
      const desC = D => [D.art || "", U_(D.des), D.t ? "" : U_(D.u)];
      /* produits : pas d'article (FORMAT 6) — colonne ARTICLE vide sur les lignes PRD */
      const prdC = P => ["PRD", "", U_(P.des), U_(P.u), n(P.nbr), n(P.d1), n(P.d2), n(P.d3), ""];
      const chgC = (C, q) => ["CHG", C.art || "", U_(C.des), U_(C.u), "", "", "", "", n(q !== "" && q !== undefined ? q : C.q)];
      const rows = [], used = { lot: new Set(), prim: new Set(), sec: new Set(), prd: new Set(), chg: new Set() };
      (d.des || []).forEach(D => {
        const L = (d.links || []).filter(l => l.des === D.id);
        if (!L.length) { rows.push([...desC(D), "", "", "", "", "", "", "", "", "", "", "", ""]); return; }
        L.forEach(l => {
          const ch = [U_(by("lot", l.lot).v), U_(by("prim", l.prim).v), U_(by("sec", l.sec).v)];
          ["lot", "prim", "sec"].forEach(k => used[k].add(l[k]));
          (l.prd || []).forEach(x => { used.prd.add(x.id); rows.push([...desC(D), ...ch, ...prdC(by("prd", x.id))]); });
          (l.chg || []).forEach(x => { used.chg.add(x.id); rows.push([...desC(D), ...ch, ...chgC(by("chg", x.id), x.q)]); });
        });
      });
      [["lot", 3], ["prim", 4], ["sec", 5]].forEach(([k, c]) => (d[k] || []).filter(r => !used[k].has(r.id)).forEach(r => {
        const row = Array(BF_HEAD.length).fill(""); row[c] = U_(r.v); rows.push(row);
      }));
      (d.prd || []).filter(r => !used.prd.has(r.id)).forEach(P => rows.push(["", "", "", "", "", "", ...prdC(P)]));
      (d.chg || []).filter(r => !used.chg.has(r.id)).forEach(C => rows.push(["", "", "", "", "", "", ...chgC(C)]));
      return { head: BF_HEAD, rows };
    };
    /* lecture d'un onglet : ligne d'en-tête trouvée (DÉSIGNATION CLIENT), colonnes par leur nom */
    const bfNorm = v => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
    const bfModel = aoa => {
      const hi = aoa.findIndex(r => (r || []).some(c => bfNorm(c) === "DESIGNATION CLIENT"));
      if (hi < 0) throw new Error("COLONNE « DÉSIGNATION CLIENT » INTROUVABLE");
      const H = aoa[hi].map(bfNorm);
      const col = (...names) => H.findIndex(h => names.some(x => h === x || (x.endsWith("*") && h.startsWith(x.slice(0, -1)))));
      const C = { art: col("ART"), dc: col("DESIGNATION CLIENT"), upb: col("UPB"), lot: col("LOT"), prim: col("ACTIVITE PRIMAIRE"),
        sec: col("ACTIVITE SECONDAIRE"), type: col("TYPE*"), article: col("ARTICLE"), des: col("DESIGNATION"), u: col("UNITE"),
        nbr: col("NBR"), d1: col("DIM 1", "DIM1"), d2: col("DIM 2", "DIM2"), d3: col("DIM 3", "DIM3"), q: col("QTE", "QUANTITE") };
      const g = (r, k) => C[k] < 0 ? "" : sviClean(r[C[k]] ?? "");
      const nn = v => String(v ?? "").trim() === "" ? "" : num(v);
      const m = { des: [], hier: [], chg: [], prd: [], qlt: [], dly: [], links: [], rej: [] };
      const seen = new Map();
      const RAW = ["art", "dc", "upb", "lot", "prim", "sec", "type", "article", "des", "u", "nbr", "d1", "d2", "d3", "q"];
      const put = (k, key, row, hier) => { if (!seen.has(key)) { seen.set(key, true); hier ? m.hier.push({ key, lvl: k, row }) : m[k].push({ key, row }); } return key; };
      const seenLine = new Map();   /* doublons dans le fichier : tout identique sauf NBR / DIM / QTE */
      /* FORMAT 88 : une même désignation (ART + DÉSIGNATION) / un même produit (DÉSIGNATION) n'a qu'une unité ;
         la plus fréquente l'emporte (budget compris ; égalité : le budget, puis l'ordre du fichier) */
      const UW = { d: new Map(), p: new Map() };
      let uo = 0;
      const uAdd = (g, key, u, n) => { if (!key || !u) return; const M = UW[g].get(key) || UW[g].set(key, new Map()).get(key); const e = M.get(u) || M.set(u, { n: 0, o: uo++ }).get(u); e.n += n; };
      if (INS) {
        const nL = (k, id) => (INS.links || []).reduce((t, l) => t + (k === "des" ? (l.des === id ? (l.prd || []).length + (l.chg || []).length : 0) : (l.prd || []).some(x => x.id === id) ? 1 : 0), 0);
        INS.des.forEach(x => { if (!x.t) uAdd("d", U_(x.des), U_(x.u), Math.max(1, nL("des", x.id))); });
        INS.prd.forEach(x => uAdd("p", U_(x.des), U_(x.u), Math.max(1, nL("prd", x.id))));
      }
      aoa.slice(hi + 1).forEach(r => {
        if (!r) return;
        const dc = U_(g(r, "dc")), t = bfNorm(g(r, "type")), dn = U_(g(r, "des"));
        if (dc && U_(g(r, "upb"))) uAdd("d", dc, U_(g(r, "upb")), 1);
        if (dn && t.startsWith("PRD") && U_(g(r, "u"))) uAdd("p", dn, U_(g(r, "u")), 1);
      });
      const uWin = (g, key) => { const M = UW[g].get(key); if (!M || M.size < 2) return null; const b = [...M].sort((a, c) => c[1].n - a[1].n || a[1].o - c[1].o)[0]; return { u: b[0], n: b[1].n }; };
      aoa.slice(hi + 1).forEach((r, ri) => {
        if (!r || !r.some(c => String(c ?? "").trim() !== "")) return;
        const lineNo = (aoa.__line0 || 0) + hi + 2 + ri;   /* numéro de ligne dans le tableau source */
        const dc = U_(g(r, "dc")), lot = U_(g(r, "lot")), prim = U_(g(r, "prim")), sec = U_(g(r, "sec"));
        const t = bfNorm(g(r, "type")), dn = U_(g(r, "des"));
        let dk = "", pk = "", ck = "";
        /* ligne de liaison complète : mêmes règles que la saisie (FORMAT 74) ; non conforme → IMPORT NON CRÉÉ,
           et ni sa désignation sans UPB, ni son produit / sa charge ne sont créés */
        const isP = !!dn && t.startsWith("PRD"), isC = !!dn && t.startsWith("CHG");
        let lineBad = null;
        if (dc && lot && prim && sec && (isP || isC)) {
            /* mêmes règles que la saisie (FORMAT 74) : la ligne non conforme va dans IMPORT NON CRÉÉ */
            const bad = [], why = [];
            const z = v => String(v ?? "").trim() === "" || num(v) === 0;
            if (!U_(g(r, "upb"))) { bad.push("upb"); why.push("UPB MANQUANTE : LA DÉSIGNATION CLIENT NE PEUT PAS ÊTRE LIÉE"); }
            else {
              const w = uWin("d", dc);
              if (w && w.u !== U_(g(r, "upb"))) { bad.push("upb"); why.push("UPB " + U_(g(r, "upb")) + " ≠ UPB DE LA DÉSIGNATION " + dc + " (" + w.u + ", " + w.n + " LIGNE" + (w.n > 1 ? "S" : "") + ")"); }
            }
            /* produits : plusieurs unités permises (même repère en M3 et en M2) ; seule la liaison primaire
               impose l'unité de la désignation (règle B) */
            ["nbr", "d1", "d2", "d3", "q"].forEach(f => { if (!sviNumOk(g(r, f))) { bad.push(f); why.push("NOMBRE NON VALIDE : " + f.toUpperCase().replace(/^D(\d)$/, "DIM $1")); } });
            if (isP) {
              const u = U_(g(r, "u")), nd = sviUnitDims(u), known = ["U", "F", "M", "ML", "M2", "M3"].includes(u);
              if (z(g(r, "nbr"))) { bad.push("nbr"); why.push("NBR VIDE OU 0"); }
              [1, 2, 3].forEach(i => {
                const v = g(r, "d" + i);
                if (i > nd && String(v ?? "").trim() !== "") { bad.push("d" + i); why.push("UNITÉ " + u + " : " + (nd ? "NBR ET " + nd + " DIM" : "NBR SEUL") + " (DIM " + i + " EN TROP)"); }
                else if (known && i <= nd && z(v)) { bad.push("d" + i); why.push("UNITÉ " + u + " : DIM " + i + " À SAISIR"); }
              });
            }
            if (isC) {
              if (z(g(r, "q"))) { bad.push("q"); why.push("QTE VIDE OU 0"); }
              const c = chsFind(String(g(r, "article") ?? "").trim(), dn);
              if (c && U_(g(r, "u")) && U_(c.unit) && U_(g(r, "u")) !== U_(c.unit)) { bad.push("u"); why.push("UNITÉ " + U_(g(r, "u")) + " ≠ UNITÉ DE CHS (" + U_(c.unit) + ")"); }
            }
            if (bad.length) lineBad = { bad, why: why.join(" ; ") };
        }
        if (dc && !(lineBad && lineBad.bad.includes("upb"))) {
          const row = { art: String(g(r, "art") ?? "").trim(), des: dc, u: U_(g(r, "upb")), tva: 20 };
          /* titre : ni unité, ni tâche, ni détail */
          if (!row.u && !lot && !t && !dn) row.t = true;
          dk = put("des", "des|" + impId("des", row), row);
        }
        const hk = [["lot", lot], ["prim", prim], ["sec", sec]].map(([k, v]) => v ? put(k, k + "|" + v, { v }, true) : "");
        if (lineBad) { /* rien de plus n'est créé */ }
        else if (dn && t.startsWith("PRD")) {
          const row = { des: dn, u: U_(g(r, "u")), nbr: nn(g(r, "nbr")), d1: nn(g(r, "d1")), d2: nn(g(r, "d2")), d3: nn(g(r, "d3")) };
          pk = put("prd", "prd|" + impId("prd", row), row);
        } else if (dn && t.startsWith("CHG")) {
          const row = { art: String(g(r, "article") ?? "").trim(), des: dn, u: U_(g(r, "u")), q: nn(g(r, "q")), tva: 20 };
          /* prix et TVA : depuis CHS */
          const c = chsFind(row.art, row.des);
          if (c) { row.chs = c.id; row.p = c.pcs; row.tva = c.tva; row.u = row.u || U_(c.unit); }
          ck = put("chg", "chg|" + impId("chg", row), row);
        }
        const src = Object.fromEntries(RAW.map(k => [k, String(g(r, k) ?? "").trim()]));
        src.__line = aoa.__lineFix || lineNo;
        if (lineBad) { m.rej.push({ src, bad: lineBad.bad, why: lineBad.why }); return; }
        if (dk && hk[0] && hk[1] && hk[2] && (pk || ck)) {
          const lk = ["dc", "upb", "lot", "prim", "sec", "type", "des", "u"].map(f => U_(src[f])).join("|");
          if (seenLine.has(lk)) { m.rej.push({ src, bad: ["des"], why: "DOUBLON DANS LE FICHIER : IDENTIQUE À LA LIGNE " + seenLine.get(lk) + " (SEULS NBR / DIM / QTE PEUVENT DIFFÉRER)" }); return; }
          seenLine.set(lk, src.__line);
          m.links.push({ dk, lot: hk[0], prim: hk[1], sec: hk[2], pk: pk || undefined, ck: ck || undefined, q: "", src }); return;
        }
        /* ligne qui voulait une liaison mais incomplète → onglet IMPORT NON CRÉÉ (raison + cases fautives) */
        const chain = !!(lot || prim || sec), det = !!(t || dn);
        if (!((dc && (chain || det)) || (chain && det))) return;
        const bad = [], why = [];
        if (!dc) { bad.push("dc"); why.push("DÉSIGNATION CLIENT MANQUANTE"); }
        if (!lot) { bad.push("lot"); why.push("LOT MANQUANT"); }
        if (!prim) { bad.push("prim"); why.push("ACTIVITÉ PRIMAIRE MANQUANTE"); }
        if (!sec) { bad.push("sec"); why.push("ACTIVITÉ SECONDAIRE MANQUANTE"); }
        if (!t.startsWith("PRD") && !t.startsWith("CHG")) { bad.push("type"); why.push(t ? "TYPE NON RECONNU (PRD OU CHG)" : "TYPE MANQUANT (PRD OU CHG)"); }
        if (!dn) { bad.push("des"); why.push("DÉSIGNATION DU DÉTAIL MANQUANTE"); }
        m.rej.push({ src, bad, why: why.join(" ; ") });
      });
      return m;
    };
    /* RÈGLE A à l'import (FORMAT) : une activité primaire, et une tâche secondaire (lot + activité secondaire),
       n'ont qu'une désignation client. On compte toutes les lignes (fichier, refusées comprises, et budget :
       une ligne par produit / charge de ses liaisons) ; le plus grand nombre l'emporte ; égalité : le budget,
       puis l'ordre du fichier. Les liaisons du budget qui perdent sont déliées (après confirmation) et vont
       dans IMPORT NON CRÉÉ. */
    const bfRuleA = (m, mode) => {
      const dKey = row => "des|" + impId("des", row);
      const G = { p: new Map(), s: new Map() };
      const names = new Map();
      let ord = 0;
      const add = (g, gk, dk, n, name) => {
        if (!gk || !dk) return;
        const M = G[g].get(gk) || G[g].set(gk, new Map()).get(gk);
        const e = M.get(dk) || M.set(dk, { n: 0, o: ord++ }).get(dk);
        e.n += n;
        if (name && !names.has(dk)) names.set(dk, name);
      };
      const byIdK = (k, id) => INS[k].find(x => x.id === id) || {};
      /* budget d'abord (prioritaire à égalité) — sauf REMPLACER */
      const exist = mode === "replace" ? [] : (INS.links || []).map(l => {
        const d = byIdK("des", l.des), lo = byIdK("lot", l.lot), pr = byIdK("prim", l.prim), se = byIdK("sec", l.sec);
        const dk = dKey(d), pk = "lot|" + U_(lo.v) + "#prim|" + U_(pr.v), sk = "lot|" + U_(lo.v) + "#sec|" + U_(se.v);
        const n = (l.prd || []).length + (l.chg || []).length;
        return { l, dk, pk, sk, n, name: d.des || "" };
      });
      exist.forEach(x => { add("p", x.pk, x.dk, x.n, x.name); add("s", x.sk, x.dk, x.n, x.name); });
      /* fichier : toutes les lignes, refusées comprises */
      /* une ligne refusée pour son unité ne compte pas pour la règle A (sa désignation est la même, mal écrite) */
      [...m.links.map(l => l.src), ...(m.rej || []).filter(r => !(r.bad || []).includes("upb")).map(r => r.src)].forEach(src => {
        if (!src) return;
        const dc = U_(src.dc);
        if (!dc) return;
        const dk = dKey({ art: String(src.art ?? "").trim(), des: dc, u: U_(src.upb) });
        if (U_(src.lot) && U_(src.prim)) add("p", "lot|" + U_(src.lot) + "#prim|" + U_(src.prim), dk, 1, dc);
        if (U_(src.lot) && U_(src.sec)) add("s", "lot|" + U_(src.lot) + "#sec|" + U_(src.sec), dk, 1, dc);
      });
      const win = g => new Map([...G[g]].map(([gk, M]) => {
        const best = [...M].sort((a, b) => b[1].n - a[1].n || a[1].o - b[1].o)[0];
        return [gk, { dk: best[0], n: best[1].n, name: names.get(best[0]) || "" }];
      }));
      const W = { p: win("p"), s: win("s") };
      /* liaisons du budget qui perdent */
      const lose = exist.filter(x => (W.p.get(x.pk) && W.p.get(x.pk).dk !== x.dk) || (W.s.get(x.sk) && W.s.get(x.sk).dk !== x.dk))
        .map(x => ({ ...x, by: W.p.get(x.pk).dk !== x.dk ? { g: "p", w: W.p.get(x.pk) } : { g: "s", w: W.s.get(x.sk) } }));
      return { W, lose, names };
    };
    const bfRuleAWhy = (g, w) => "RÈGLE A : " + (g === "p" ? "TÂCHE PRIMAIRE" : "TÂCHE SECONDAIRE") + " LIÉE À " + w.name + " (" + w.n + " LIGNE" + (w.n > 1 ? "S" : "") + ")";
    /* fenêtre de confirmation : liaisons du budget à délier */
    const bfRuleAAsk = plan => {
      if (!plan.lose.length) return Promise.resolve(true);
      const byIdK = (k, id) => INS[k].find(x => x.id === id) || {};
      const nDl = new Set(plan.lose.map(x => x.l.lot + "|" + x.l.sec).filter(k => (INS.dlp || {})[k] && INS.dlp[k].length
        && !(INS.links || []).some(l => !plan.lose.some(y => y.l === l) && l.lot + "|" + l.sec === k))).size;
      const html = `<div class="svc-sub">LIAISONS DU BUDGET À DÉLIER ${svCnt(plan.lose.length)} :</div>
        <ul class="svc-list">${plan.lose.map(x => `<li>${esc([x.name, byIdK("lot", x.l.lot).v, byIdK("prim", x.l.prim).v, byIdK("sec", x.l.sec).v].join(" › "))} — ${x.n} LIGNE${x.n > 1 ? "S" : ""}<br><b>GARDÉE : ${esc(x.by.w.name)} — ${x.by.w.n} LIGNE${x.by.w.n > 1 ? "S" : ""}</b></li>`).join("")}</ul>
        <div class="svc-sub">LES LIGNES DÉLIÉES VONT DANS L'ONGLET IMPORT NON CRÉÉ.</div>
`;
      return svConfirm({ title: "RÈGLE A — LIAISONS À DÉLIER", html, ok: "IMPORTER" });
    };
    /* ajoute le modèle au budget : AJOUTER / METTRE À JOUR / REMPLACER */
    const bfApply = (m, mode, srcName, quiet, plan) => {
      let added = 0, upd = 0, skip = 0, nl = 0;
      const kid = new Map();
      const K = ["des", "lot", "prim", "sec", "chg", "prd"];
      const inc = { des: m.des, chg: m.chg, prd: m.prd, lot: [], prim: [], sec: [] };
      m.hier.forEach(x => inc[x.lvl].push(x));
      K.forEach(k => {
        if (!inc[k].length) return;
        if (mode === "replace") INS[k] = [];
        const hierK = k === "lot" || k === "prim" || k === "sec";
        inc[k].forEach(x => {
          const r = hierK ? { v: x.row.v } : { ...x.row };
          const old = INS[k].find(o => hierK ? U_(o.v) === U_(r.v) : impId(k, o) === impId(k, r));
          if (old) {
            kid.set(x.key, old.id);
            if (mode !== "update" || hierK) { skip++; return; }
            let ch = false;
            ["q", "nbr", "d1", "d2", "d3", "p", "tva", "chs"].forEach(f => { if (r[f] !== undefined && String(r[f]) !== String(old[f] ?? "")) { old[f] = r[f]; ch = true; } });
            ch ? upd++ : skip++;
            return;
          }
          r.id = insId(); r.on = false;
          if (k === "des") r.t = !!r.t;
          INS[k].push(r); added++;
          kid.set(x.key, r.id);
        });
      });
      if (mode === "replace") { INS.links = []; INS.dlp = {}; }
      INS.links = INS.links || [];
      const rej = (m.rej || []).slice();
      /* règle A : sans confirmation (correction dans l'onglet), le budget n'est jamais délié */
      plan = plan || bfRuleA(m, mode);
      if (plan.lose.length && !plan.ok) plan.lose.forEach(x => { plan.W[x.by.g].set(x.by.g === "p" ? x.pk : x.sk, { dk: x.dk, n: x.n, name: x.name }); });
      if (plan.lose.length && plan.ok) {
        const by = (k, id) => INS[k].find(x => x.id === id) || {};
        const gone = new Set(plan.lose.map(x => x.l));
        plan.lose.forEach(x => {
          const d = by("des", x.l.des), base = { art: d.art || "", dc: d.des || "", upb: d.u || "", lot: by("lot", x.l.lot).v || "", prim: by("prim", x.l.prim).v || "", sec: by("sec", x.l.sec).v || "" };
          const why = "LIAISON DU BUDGET DÉLIÉE — " + bfRuleAWhy(x.by.g, x.by.w), bad = x.by.g === "p" ? ["lot", "prim"] : ["lot", "sec"];
          (x.l.prd || []).forEach(y => { const r = by("prd", y.id); rej.push({ src: { ...base, type: "PRD", article: "", des: r.des || "", u: r.u || "", nbr: r.nbr ?? "", d1: r.d1 ?? "", d2: r.d2 ?? "", d3: r.d3 ?? "", q: "" }, bad, why }); });
          (x.l.chg || []).forEach(y => { const r = by("chg", y.id); rej.push({ src: { ...base, type: "CHG", article: r.art || "", des: r.des || "", u: r.u || "", nbr: "", d1: "", d2: "", d3: "", q: y.q !== "" && y.q !== undefined ? y.q : (r.q ?? "") }, bad, why }); });
        });
        INS.links = INS.links.filter(l => !gone.has(l));
        /* délais : indépendants des liaisons — gardés */
        histLog("IMPORT", "RÈGLE A — LIAISONS DÉLIÉES", plan.lose.length + " LIAISON(S) DU BUDGET");
      }
      const byId = (k, id) => INS[k].find(x => x.id === id) || {};
      /* liaisons déjà dans le budget avant l'import : une ligne identique va dans IMPORT NON CRÉÉ */
      const had = new Set();
      (INS.links || []).forEach(l => { const c = [l.des, l.lot, l.prim, l.sec].join("|"); (l.prd || []).forEach(x => had.add(c + "|p|" + x.id)); (l.chg || []).forEach(x => had.add(c + "|c|" + x.id)); });
      const chgOnly = new Map();   /* liaison sans produit : ses charges iront dans IMPORT NON CRÉÉ */
      m.links.forEach(l => {
        const des = kid.get(l.dk), lot = kid.get(l.lot), prim = kid.get(l.prim), sec = kid.get(l.sec);
        const pid = l.pk && kid.get(l.pk), cid = l.ck && kid.get(l.ck);
        if (!des || !lot || !prim || !sec || (!pid && !cid)) return;
        const ch0 = [des, lot, prim, sec].join("|");
        if ((pid && had.has(ch0 + "|p|" + pid)) || (cid && had.has(ch0 + "|c|" + cid))) { rej.push({ src: l.src, bad: ["des"], why: "DOUBLON : EXISTE DÉJÀ DANS LE BUDGET (SEULS NBR / DIM / QTE PEUVENT DIFFÉRER)" }); return; }
        /* règle A : la désignation qui a le plus de lignes l'emporte (activité primaire, puis tâche secondaire) */
        const wp = plan.W.p.get(l.lot + "#" + l.prim), ws = plan.W.s.get(l.lot + "#" + l.sec);
        if (wp && wp.dk !== l.dk) { rej.push({ src: l.src, bad: ["lot", "prim"], why: bfRuleAWhy("p", wp) }); return; }
        if (ws && ws.dk !== l.dk) { rej.push({ src: l.src, bad: ["lot", "sec"], why: bfRuleAWhy("s", ws) }); return; }
        const other = INS.links.find(x => x.lot === lot && x.prim === prim && x.des !== des);
        if (other) { rej.push({ src: l.src, bad: ["lot", "prim"], why: "RÈGLE A : TÂCHE PRIMAIRE DÉJÀ LIÉE À " + (byId("des", other.des).des || "") }); return; }
        /* règle D : un produit / une charge une seule fois dans une tâche secondaire (lot + act. scd) */
        const dD = INS.links.find(x => x.lot === lot && x.sec === sec && !(x.des === des && x.prim === prim)
          && ((pid && (x.prd || []).some(y => y.id === pid)) || (cid && (x.chg || []).some(y => y.id === cid))));
        if (dD) { rej.push({ src: l.src, bad: ["des"], why: "RÈGLE D : DÉJÀ DANS LA TÂCHE SECONDAIRE " + (byId("lot", lot).v || "") + " › " + (byId("sec", sec).v || "") }); return; }
        /* règle B : liaison primaire (act. scd = act. prm) → produit de l'unité de la désignation */
        if (pid && U_(byId("prim", prim).v) === U_(byId("sec", sec).v)) {
          const du = U_(byId("des", des).u), pu = U_(byId("prd", pid).u);
          if (du && pu && du !== pu) { rej.push({ src: l.src, bad: ["u", "upb"], why: "RÈGLE B : LIAISON PRIMAIRE — UNITÉ " + pu + " ≠ UNITÉ DE LA DÉSIGNATION (" + du + ")" }); return; }
        }
        let L = INS.links.find(x => x.des === des && x.lot === lot && x.prim === prim && x.sec === sec);
        if (!pid && !(L && (L.prd || []).length)) { const key = [des, lot, prim, sec].join("|"); (chgOnly.get(key) || chgOnly.set(key, []).get(key)).push(l.src); }
        if (!L) { L = { id: insId(), des, lot, prim, sec, prd: [], chg: [] }; INS.links.push(L); nl++; }
        if (pid && !(L.prd = L.prd || []).some(y => y.id === pid)) L.prd.push({ id: pid, q: "" });
        if (cid && !(L.chg = L.chg || []).some(y => y.id === cid)) L.chg.push({ id: cid, q: "" });
      });
      /* charges d'une tâche restée sans produit */
      INS.links.filter(x => !(x.prd || []).length).forEach(x => {
        (chgOnly.get([x.des, x.lot, x.prim, x.sec].join("|")) || []).forEach(src => rej.push({ src, bad: ["type"], why: "AUCUN PRODUIT DANS CETTE TÂCHE (UNE LIAISON DOIT AVOIR AU MOINS UN PRODUIT)" }));
      });
      INS.links = INS.links.filter(x => (x.prd || []).length);
      insCleanLinks();
      if (mode === "replace") INS.inc = [];
      /* une même ligne refusée deux fois (import refait) n'apparaît qu'une fois */
      const incKey = x => JSON.stringify(["art", "dc", "upb", "lot", "prim", "sec", "type", "article", "des", "u", "nbr", "d1", "d2", "d3", "q"].map(f => U_((x.src || {})[f])));
      const inK = new Set((INS.inc || []).map(incKey));
      INS.inc = (INS.inc || []).concat(rej.filter(x => { const kk = incKey(x); if (inK.has(kk)) return false; inK.add(kk); return true; })
        .map(x => ({ id: insId(), on: false, src: x.src, bad: x.bad, why: x.why, line: (x.src || {}).__line || "" })));
      insSave();
      if (quiet) { refreshAll(); return rej; }
      insSortAll();
      const M = { add: "AJOUT", replace: "REMPLACEMENT", update: "MISE À JOUR" }[mode];
      histLog("IMPORT", "BUDGET COMPLET — " + M, srcName + " — " + added + " AJOUTÉE(S), " + upd + " MISE(S) À JOUR, " + skip + " IGNORÉE(S) — " + nl + " LIAISON(S)" + (rej.length ? " — " + rej.length + " NON CRÉÉE(S)" : ""));
      /* des liaisons n'ont pas pu être créées : l'onglet IMPORT NON CRÉÉ s'ouvre */
      if (rej.length) { active = "inc"; try { localStorage.setItem("svi_dtab_v1", "inc"); } catch (e) {} }
      refreshAll();
      return rej;
    };
    /* correction dans l'onglet : la ligne est réessayée ; complète et conforme, elle crée sa liaison et sort de l'onglet */
    const incTry = item => {
      INS.inc = (INS.inc || []).filter(x => x.id !== item.id);
      const s0 = item.src;
      /* ligne de délai : réessayée avec les règles des délais */
      if (U_(s0.type) === "DÉLAI") {
        const aoa = [DLY_HEAD, [s0.lot || "", s0.sec || "", "", s0.deb || "", s0.fin || "", "", s0.pred || ""]];
        aoa.__lineFix = s0.__line || item.line || "";
        const before = (INS.inc || []).length;
        dlyImportAoa(aoa, "CORRECTION", true);
        const again = (INS.inc || []).slice(before);
        if (again.length) { again[0].id = item.id; again[0].on = item.on; }
        else histLog("IMPORT", "DÉLAI CRÉÉ (CORRECTION)", [s0.lot, s0.sec, s0.deb, s0.fin].filter(Boolean).join(" › "));
        insSave(); refreshAll();
        return;
      }
      const aoa = [BF_HEAD, ["art", "dc", "upb", "lot", "prim", "sec", "type", "article", "des", "u", "nbr", "d1", "d2", "d3", "q"].map(k => s0[k] ?? "")];
      aoa.__lineFix = s0.__line || item.line || "";
      const before = (INS.inc || []).length;
      bfApply(bfModel(aoa), "add", "CORRECTION", true);
      const again = (INS.inc || []).slice(before);
      /* toujours refusée : elle garde sa place dans la liste */
      if (again.length) { again[0].id = item.id; again[0].on = item.on; }
      else histLog("IMPORT", "LIAISON CRÉÉE (CORRECTION)", [s0.dc, s0.lot, s0.prim, s0.sec, s0.des].filter(Boolean).join(" › "));
      insSave(); refreshAll();
    };
    /* ===== DÉLAIS dans l'export / l'import du budget (onglet DÉLAIS) ===== */
    const DLY_HEAD = ["LOT", "ACTIVITÉ SECONDAIRE", "PÉRIODE", "DÉBUT", "FIN", "DURÉE (J)", "PRÉDÉCESSEURS"];
    const dlyExportRows = () => {
      const out = [];
      const keys = Object.keys(INS.dlp || {}).filter(k => (INS.dlp[k] || []).length);
      Object.keys(INS.dpred || {}).forEach(k => { if (!keys.includes(k)) keys.push(k); });
      keys.map(k => ({ k, n: dlyName(k) })).sort((a, b) => String(((INS.dlp[a.k] || [])[0] || {}).deb || "9").localeCompare(String(((INS.dlp[b.k] || [])[0] || {}).deb || "9")) || natCmp(a.n, b.n)).forEach(({ k }) => {
        const [lo, se] = k.split("|");
        const pr = ((INS.dpred || {})[k] || []).map(dlyName).join(" ; ");
        const ps = [...((INS.dlp || {})[k] || [])].sort((a, b) => String(a.deb || "9").localeCompare(String(b.deb || "9")));
        if (!ps.length) out.push([lkName("lot", lo), lkName("sec", se), "", "", "", "", pr]);
        ps.forEach((p, i) => out.push([lkName("lot", lo), lkName("sec", se), i + 1, dFr(p.deb || ""), dFr(p.fin || ""), p.deb && p.fin ? dDiff(p.deb, p.fin) : "", i ? "" : pr]));
      });
      return out;
    };
    /* nature d'un onglet : budget (DÉSIGNATION CLIENT) ou délais (ACTIVITÉ SECONDAIRE + DÉBUT / FIN, sans DÉSIGNATION CLIENT) */
    const sheetKind = aoa => {
      const rows = (aoa || []).slice(0, 15).map(r => (r || []).map(bfNorm));
      if (rows.some(r => r.includes("DESIGNATION CLIENT"))) return "budget";
      if (rows.some(r => r.includes("ACTIVITE SECONDAIRE") && (r.includes("DEBUT") || r.includes("FIN") || r.includes("PREDECESSEURS")))) return "dly";
      return "";
    };
    const dlyDate = v => {
      if (v === "" || v === null || v === undefined) return "";
      if (typeof v === "number" && v > 20000) { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000); return d.toISOString().slice(0, 10); }
      const t = String(v).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
      const iso = dParse(t);
      return iso === null ? null : iso;
    };
    /* import de l'onglet DÉLAIS : mêmes règles que la saisie ; ligne refusée → IMPORT NON CRÉÉ (TYPE DÉLAI) */
    const dlyImportAoa = (aoa, srcName, quiet) => {
      const hi = (aoa || []).findIndex(r => (r || []).map(bfNorm).includes("ACTIVITE SECONDAIRE"));
      if (hi < 0) return 0;
      const H = aoa[hi].map(bfNorm), col = n => H.indexOf(n);
      const C = { lot: col("LOT"), sec: col("ACTIVITE SECONDAIRE"), deb: col("DEBUT"), fin: col("FIN"), dur: H.findIndex(h => h.startsWith("DUREE")), pred: col("PREDECESSEURS") };
      const g = (r, k) => C[k] < 0 ? "" : r[C[k]];
      const idOf = (k, name) => { const v = sviClean(name); if (!v) return ""; let r = INS[k].find(x => U_(x.v) === U_(v)); if (!r) { r = { id: insId(), v: U_(v), on: false }; INS[k].push(r); } return r.id; };
      const keyOf = txt => { const [a, b] = String(txt || "").split("›").map(x => x.trim()); return a && b ? idOf("lot", a) + "|" + idOf("sec", b) : ""; };
      INS.dlp = INS.dlp || {}; INS.dpred = INS.dpred || {};
      const rej = [], added = [];
      const srcOf = (r, ln) => ({ lot: sviClean(g(r, "lot")), sec: sviClean(g(r, "sec")), type: "DÉLAI", deb: String(g(r, "deb") ?? "").trim(), fin: String(g(r, "fin") ?? "").trim(), pred: sviClean(g(r, "pred")), __line: aoa.__lineFix || ln });
      aoa.slice(hi + 1).forEach((r, ri) => {
        if (!r || !r.some(c => String(c ?? "").trim() !== "")) return;
        const ln = hi + 2 + ri, src = srcOf(r, ln);
        if (!src.lot || !src.sec) { rej.push({ src, bad: [!src.lot ? "lot" : "sec"], why: !src.lot ? "LOT MANQUANT" : "ACTIVITÉ SECONDAIRE MANQUANTE" }); return; }
        const key = idOf("lot", src.lot) + "|" + idOf("sec", src.sec);
        /* prédécesseurs (« LOT › ACTIVITÉ SECONDAIRE ; … ») : la tâche elle-même et les boucles refusées */
        if (src.pred) {
          const bad = [];
          src.pred.split(";").map(x => x.trim()).filter(Boolean).forEach(t => {
            const pk = keyOf(t);
            if (!pk) { bad.push("« " + t + " » : ÉCRIRE LOT › ACTIVITÉ SECONDAIRE"); return; }
            if (pk === key || dlyReach(pk, key)) { bad.push(t + " : BOUCLE"); return; }
            const L = INS.dpred[key] = INS.dpred[key] || [];
            if (!L.includes(pk)) L.push(pk);
          });
          if (bad.length) rej.push({ src: { ...src, deb: "", fin: "" }, bad: ["pred"], why: "PRÉDÉCESSEURS REFUSÉS : " + bad.join(" ; ") });
        }
        let deb = dlyDate(g(r, "deb")), fin = dlyDate(g(r, "fin"));
        if (!deb && !fin) return;
        if (deb === null || fin === null) { rej.push({ src, bad: [deb === null ? "deb" : "fin"], why: "DATE NON VALIDE : FORMAT JJ/MM/AAAA" }); return; }
        if (deb && !fin && String(g(r, "dur") ?? "").trim() !== "" && /^\d+$/.test(String(g(r, "dur")).trim())) fin = dAdd(deb, Number(g(r, "dur")));
        if (!deb || !fin) { rej.push({ src, bad: [!deb ? "deb" : "fin"], why: !deb ? "DÉBUT MANQUANT" : "FIN MANQUANTE" }); return; }
        if (fin < deb) { rej.push({ src, bad: ["fin"], why: "LA FIN EST AVANT LE DÉBUT" }); return; }
        if (((INS.dlp || {})[key] || []).some(x => x.deb === deb && x.fin === fin) || added.some(x => x.key === key && x.deb === deb && x.fin === fin)) return;   /* déjà là */
        added.push({ key, deb, fin, src });
      });
      /* 1) une tâche commence au plus tôt le jour de la fin de ses prédécesseurs (fins connues : budget + fichier) */
      const finOf = k => [...((INS.dlp || {})[k] || []), ...added.filter(x => x.key === k)].map(x => x.fin).filter(Boolean).sort().pop() || "";
      const ok1 = added.filter(c => {
        const pf = ((INS.dpred || {})[c.key] || []).map(finOf).filter(Boolean).sort().pop() || "";
        if (pf && c.deb < pf) { rej.push({ src: c.src, bad: ["deb"], why: "DÉBUT AVANT LA FIN DES PRÉDÉCESSEURS (" + dFr(pf) + ")" }); return false; }
        return true;
      });
      /* 2) pas de chevauchement, et deux périodes d'une même tâche ne se touchent pas */
      let nAdd = 0;
      ok1.forEach(c => {
        const list = INS.dlp[c.key] = INS.dlp[c.key] || [];
        const o = list.find(x => x.deb && x.fin && c.deb <= x.fin && x.deb <= c.fin) || list.find(x => x.deb && x.fin && (dAdd(c.fin, 1) === x.deb || c.deb === dAdd(x.fin, 1)));
        if (o) { rej.push({ src: c.src, bad: ["deb", "fin"], why: "PÉRIODE QUI CHEVAUCHE OU TOUCHE LA PÉRIODE DU " + dFr(o.deb) + " AU " + dFr(o.fin) }); return; }
        list.push({ id: insId(), deb: c.deb, fin: c.fin }); nAdd++;
      });
      const kk = x => JSON.stringify(["lot", "sec", "type", "deb", "fin", "pred"].map(f => U_((x.src || {})[f])));
      const inK = new Set((INS.inc || []).map(kk));
      INS.inc = (INS.inc || []).concat(rej.filter(x => { const k = kk(x); if (inK.has(k)) return false; inK.add(k); return true; })
        .map(x => ({ id: insId(), on: false, src: x.src, bad: x.bad, why: x.why, line: x.src.__line || "" })));
      if (!quiet) {
        histLog("IMPORT", "DÉLAIS", (srcName || "") + " — " + nAdd + " PÉRIODE(S)" + (rej.length ? " — " + rej.length + " NON CRÉÉE(S)" : ""));
        if (rej.length) { active = "inc"; try { localStorage.setItem("svi_dtab_v1", "inc"); } catch (e) {} }
      }
      insSave(); refreshAll();
      return rej.length;
    };
    const bfImportAoa = async (aoa, srcName) => {
      /* onglet DÉLAIS seul : seuls les délais sont importés */
      if (sheetKind(aoa) === "dly") { dlyImportAoa(aoa, srcName); return true; }
      let m;
      try { m = bfModel(aoa); } catch (e) {
        svImportFail({ source: srcName, tries: [{ err: e }], found: (aoa || []).find(r => (r || []).some(c => String(c ?? "").trim())) || [],
          hint: "LA PREMIÈRE LIGNE DU TABLEAU DOIT PORTER LES COLONNES : ART, DÉSIGNATION CLIENT, UPB, LOT, ACTIVITÉ PRIMAIRE, ACTIVITÉ SECONDAIRE, TYPE (PRD / CHG), ARTICLE, DÉSIGNATION, UNITÉ, NBR, DIM 1 À 3, QTE. EXPORTER UN BUDGET DONNE LE BON MODÈLE." });
        return;
      }
      if (!m.des.length && !m.hier.length && !m.prd.length && !m.chg.length) {
        svImportFail({ source: srcName, tries: [{ err: "AUCUNE LIGNE À IMPORTER SOUS L'EN-TÊTE" }], found: (aoa || []).find(r => (r || []).some(c => String(c ?? "").trim())) || [],
          hint: "VÉRIFIER QUE LES LIGNES SONT REMPLIES SOUS LA LIGNE D'EN-TÊTE, DANS LE BON ONGLET." });
        return;
      }
      const busy = ["des", "lot", "prim", "sec", "chg", "prd"].some(k => INS[k].length);
      if (!busy) { bfApply(m, "add", srcName); return true; }
      let done = false;
      const goA = async mode => { const plan = bfRuleA(m, mode); if (!(await bfRuleAAsk(plan))) return; plan.ok = true; bfApply(m, mode, srcName, false, plan); done = true; };
      const v = await svChoose({ title: "DONNÉES DÉJÀ PRÉSENTES", buttons: [
        { v: "add", label: "AJOUTER", tone: "neutral" }, { v: "update", label: "METTRE À JOUR", tone: "neutral" }, { v: "replace", label: "REMPLACER", tone: "danger" }] });
      if (!v) return;
      if (v === "replace" && !(await svConfirm({ title: "REMPLACER", text: "TOUTES LES LIGNES ET LIAISONS DU BUDGET SERONT SUPPRIMÉES PUIS REMPLACÉES PAR CELLES DU FICHIER.", ok: "REMPLACER" }))) return;
      await goA(v);
      return done;
    };
    /* IMPORTER UN BUDGET : fichier Excel (iPad) ou Google Sheets (Drive) ; un seul onglet */
    const openBudgetImport = () => {
      const p = popup(`
        <div class="blk-card">
          <button type="button" class="blk-x" data-close>✕</button>
          <div class="blk-title">IMPORTER UN BUDGET</div>
          <button type="button" class="blk-choice" data-src="file">FICHIER EXCEL (SUR L'IPAD)</button>
          <button type="button" class="blk-choice" data-src="gsheet">GOOGLE SHEETS (DRIVE)</button>
        </div>`);
      p.addEventListener("click", async e => {
        const b = e.target.closest("[data-src]");
        if (!b) return;
        p.remove();
        if (b.dataset.src === "file") {
          const inp = document.createElement("input");
          inp.type = "file";
          inp.accept = ".xlsx,.xls,.csv";
          inp.onchange = async () => {
            const f = inp.files[0];
            if (!f) return;
            try {
              const X = await loadXLSX();
              const wb = X.read(await f.arrayBuffer(), { type: "array" });
              let sh = wb.SheetNames[0];
              /* onglets BUDGET et DÉLAIS (export de l'application) : les deux sont importés */
              const kinds = wb.SheetNames.map(n => ({ n, k: sheetKind(X.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: "" })) }));
              const bS = kinds.filter(x => x.k === "budget"), dS = kinds.filter(x => x.k === "dly");
              if (bS.length === 1 && dS.length === 1) {
                const ok = await bfImportAoa(X.utils.sheet_to_json(wb.Sheets[bS[0].n], { header: 1, defval: "" }), f.name + " › " + bS[0].n);
                if (ok) dlyImportAoa(X.utils.sheet_to_json(wb.Sheets[dS[0].n], { header: 1, defval: "" }), f.name + " › " + dS[0].n);
                return;
              }
              /* plusieurs onglets : lequel ? */
              if (wb.SheetNames.length > 1) {
                sh = await svChoose({ title: "QUEL ONGLET ?", buttons: wb.SheetNames.map(n => ({ v: n, label: n, tone: "neutral" })) });
                if (!sh) return;
              }
              const aoa = X.utils.sheet_to_json(wb.Sheets[sh], { header: 1, defval: "" });
              bfImportAoa(aoa, f.name + " › " + sh);
            } catch (err) { svImportFail({ source: f.name, tries: [{ err }], hint: "VÉRIFIER QUE LE FICHIER EST UN EXCEL (.XLSX) OU UN CSV, NON PROTÉGÉ PAR MOT DE PASSE." }); }
          };
          inp.click();
          return;
        }
        /* Google Sheets : lien de la feuille (l'onglet ouvert dans le lien est celui lu) */
        const url = await askSheetLink();
        if (!url) return;
        if (!/\/d\/[a-zA-Z0-9_-]+/.test(url)) { svImportFail({ source: url, tries: [{ err: "LIEN GOOGLE SHEETS NON RECONNU" }], hint: "COPIER LE LIEN COMPLET DE LA FEUILLE (IL CONTIENT /spreadsheets/d/…)." }); return; }
        let first = "";
        for (const call of [() => apiGet("sheetRead", { link: url }), () => apiPost("sheetRead", { link: url })]) {
          try {
            const d = await call();
            if (d && d.ok && Array.isArray(d.values)) { bfImportAoa(d.values, d.name || "GOOGLE SHEETS"); return; }
            first = first || "LE SCRIPT NE CONNAÎT PAS ENCORE LA LECTURE DE FEUILLE (NOUVELLE VERSION À DÉPLOYER)";
          } catch (err) { first = first || (err && err.message) || String(err); }
        }
        /* repli : feuille partagée « Toute personne disposant du lien » */
        try {
          const id = url.match(/\/d\/([a-zA-Z0-9_-]+)/)[1], gid = (url.match(/[#&?]gid=(\d+)/) || [])[1] || "0";
          const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`);
          if (!r.ok) throw new Error("HTTP " + r.status + " — ACCÈS REFUSÉ (FEUILLE NON PARTAGÉE)");
          const X = await loadXLSX();
          const wb = X.read(await r.text(), { type: "string" });
          bfImportAoa(X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" }), "GOOGLE SHEETS");
          return;
        } catch (err2) { var pub = err2; }
        svImportFail({ source: "GOOGLE SHEETS — " + url, tries: [{ via: "PAR LE SCRIPT", err: first }, { via: "PAR LE LIEN PUBLIC", err: pub }], hint: "VÉRIFIER LE LIEN, QUE VOTRE COMPTE GOOGLE A ACCÈS À LA FEUILLE, OU LA PARTAGER « TOUTE PERSONNE DISPOSANT DU LIEN » ; SINON EXPORTER LA FEUILLE EN EXCEL ET IMPORTER LE FICHIER." });
      });
    };
    /* menu ⋯ du haut : DUPLIQUER, DISPOSITION PAR DÉFAUT, EXPORTER / IMPORTER LE BUDGET */
    const openBdgMore = btn => {
      const old = document.getElementById("blkMenu");
      if (old && old.dataset.for === "bdgMore") { old.remove(); return; }
      old?.remove();
      const rb = $("layResetBtn");
      const items = [
        { a: "dup", lab: "DUPLIQUER", ic: '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>' },
        { a: "lay", lab: "DISPOSITION PAR DÉFAUT", off: !rb || rb.disabled, ic: '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M4 3.8v4.6h4.6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
        { a: "exp", lab: "EXPORTER LE BUDGET", ic: '<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10V2M4.5 5.5 8 2l3.5 3.5M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
        ...(INS_EDIT ? [{ a: "imp", lab: "IMPORTER UN BUDGET", ic: '<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' }] : [])
      ];
      const m = document.createElement("div");
      m.id = "blkMenu";
      m.dataset.for = "bdgMore";
      m.innerHTML = items.map(x => `<button type="button" data-a="${x.a}" class="${x.off ? "blk-del off" : ""}" ${x.off ? "disabled" : ""}>${x.ic}<span>${x.lab}</span></button>`).join("");
      document.body.appendChild(m);
      const r = btn.getBoundingClientRect();
      m.style.top = r.bottom + 4 + "px";
      m.style.left = Math.max(8, r.right - m.offsetWidth) + "px";
      m.addEventListener("click", e => {
        const it = e.target.closest("[data-a]");
        if (!it || it.classList.contains("off")) return;
        m.remove();
        if (it.dataset.a === "dup") $("instDup")?.click();
        else if (it.dataset.a === "lay") $("layResetBtn")?.click();
        else if (it.dataset.a === "exp") openExportMenu("budget");
        else if (it.dataset.a === "imp") openBudgetImport();
      });
      setTimeout(() => document.addEventListener("click", function off(e) {
        if (!e.target.closest("#blkMenu")) { m.remove(); document.removeEventListener("click", off, true); }
      }, true), 0);
    };
    const openImportMenu = blk => {
      const p = popup(`
        <div class="blk-card">
          <button type="button" class="blk-x" data-close>✕</button>
          <div class="blk-title">IMPORTER — ${esc(blkDisp(blk))}</div>
          <button type="button" class="blk-choice" data-src="file">Fichier (Excel, CSV, JSON)</button>
          <button type="button" class="blk-choice" data-src="gsheet">Google Sheets (lien)</button>
          ${INS ? `<button type="button" class="blk-choice" data-src="bdg">Autre budget de l'application</button>` : ""}
        </div>`);
      p.addEventListener("click", e => {
        const b = e.target.closest("[data-src]");
        if (!b) return;
        p.remove();
        if (b.dataset.src === "gsheet") importGSheet();
        else if (b.dataset.src === "bdg") openImportBudget(blk);
        else doImport(blk);
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
          svImportFail({ source: f.name, tries: [{ err: e }], hint: "VÉRIFIER QUE LE FICHIER EST UN EXCEL (.XLSX), UN CSV OU UN JSON, NON PROTÉGÉ PAR MOT DE PASSE." });
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
        const str = cfg.docTitle + "|" + cfg.table + "|" + cfg.end +
          (budget && budget.inst ? "|" + (budget.inst.state || "instance") : "");
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
      const projet = (() => { const it = sviIntitule(ref, budget.project, budget.inst); return it !== "À COMPLÉTER" ? it : budget.project; })();
      const fileName = (fullRef + " " + cfg.fileTag).replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "_") + ".pdf";

      const w = window.open("", "_blank");
      if (!w) { sviAlert("Autorisez les fenêtres pop-up pour l'aperçu."); return; }
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
  #side label.ck input { width: 18px; height: 18px; accent-color: var(--svst); }
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
  /* filigrane PROVISOIRE : budget en instance (rouge) ou figé (vert) */
  .page .wm { position: absolute; inset: 0; z-index: 0; pointer-events: none; display: flex;
              align-items: center; justify-content: center; overflow: hidden; }
  .page .wm span { transform: rotate(-30deg); font-family: Arial, Helvetica, sans-serif; font-weight: 900;
                   font-size: 96pt; letter-spacing: 4mm; white-space: nowrap; color: var(--wm); opacity: .13; }
  body.portrait .page .wm span { font-size: 66pt; transform: rotate(-52deg); }
  .page > .head, .page > .content, .page > .foot { position: relative; z-index: 1; }
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
    <div class="t">BUDGET N° : ${esc(fullRef)}<br>CLIENT : ${esc(sviClient(budget.inst))}<br>PROJET : ${esc(projet)}${cfg.headLine ? "<br>" + esc(cfg.headLine) : ""}</div>
  </div>
  ${cfg.table}
  <div id="end">${cfg.end}</div>
  <div class="foot"><div class="pg">Page 1 / 1</div><hr>
    <div class="ad">N°35, Bloc G3 Cité DAKHLA Agadir, BP : 8837 Dakhla Agadir - Tél : 05 28 23 34 31<br>
    Sarl. Au capital de 500 000,00 Dhs - Patente 67505605 - I.F. 60201815 - R.C. 57784 I.C.E. : 003434605000090</div></div>
</div>
<script>
  const WM = ${JSON.stringify(budget && budget.inst && budget.inst.state !== "valide" ? (budget.inst.state === "fige" ? "#15803d" : "#b91c1c") : "")};
  const WMT = ${JSON.stringify(budget && budget.inst && budget.inst.state === "fige" ? "PROVISOIRE" : "EN INSTANCE")};
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
      if (WM) {
        const wm = document.createElement("div"); wm.className = "wm";
        wm.style.setProperty("--wm", WM); wm.innerHTML = "<span>" + WMT + "</span>";
        pg.appendChild(wm);
      }
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
      (function (m) { var d = document.createElement("div"); d.textContent = m; d.style.cssText = "position:fixed;left:50%;top:40%;transform:translateX(-50%);max-width:90vw;background:#fff;border:1.5px solid #b91c1c;color:#b91c1c;padding:12px 16px;border-radius:10px;font:800 12px Arial,sans-serif;z-index:99999;box-shadow:0 10px 30px rgba(15,23,42,.2)"; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 6000); })("OUVERTURE DU DOSSIER IMPOSSIBLE : " + String(op.__sviDriveErr ? op.__sviDriveErr(err) : err).toUpperCase());
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
      if (!src || !src.rows.length) { sviAlert("Aucune désignation à afficher."); return; }
      if (src.ins) return printClientIns(src.rows);
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

    /* budget en instance : même modèle, avec lignes titres et sous-totaux */
    const printClientIns = rows => {
      const td = (v, cls = "") => `<td class="${cls}">${v}</td>`;
      const hid = insHiddenFn();
      const body = insOrder(rows).filter(x => !x.sub && !hid(x.r)).map(x => {
        if (x.sub) {
          const { ht } = insSubOf(x.sub);
          return `<tr>${td("")}${td("<b>TOTAL " + esc(x.sub.des || x.sub.art || "") + "</b>", "r")}${td("")}${td("")}${td("")}${td("")}${td("<b>" + money(ht) + "</b>", "r")}</tr>`;
        }
        const r = x.r;
        if (r.t) return `<tr>${td("<b>" + esc(r.art || "") + "</b>", "c")}${td("<b>" + esc(r.des || "") + "</b>")}${td("")}${td("")}${td("")}${td("")}${td("")}</tr>`;
        const pu = Math.round(num(r.p || 0) * 100) / 100;
        return `<tr>${td(esc(r.art || ""), "c")}${td(esc(r.des || ""))}${td(esc(r.u || ""), "c")}` +
          `${td(money(insQty("des", r)), "r")}${td(money(pu), "r")}${td(esc(frMoney(pu)), "c")}${td(money(insHT("des", r)), "r")}</tr>`;
      }).join("");
      const ls = rows.filter(r => !r.t);
      const ht = ls.reduce((t, r) => t + insHT("des", r), 0);
      const ttc = ls.reduce((t, r) => t + insTTC("des", r), 0);
      const tva = ttc - ht;
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
      if (!list.length) { sviAlert("Aucune tâche à afficher."); return; }
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
      if (!groups.length) { sviAlert("Aucune désignation à afficher."); return; }
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
      if (!src || !src.rows.length) { sviAlert("Aucune désignation à afficher."); return; }
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
        if (!d.rows.length) { sviAlert("Aucune donnée dans " + label + "."); return; }
        /* historique : date, branche et action étroites, détail large */
        cols = d.head.map((h, i) => [blk === "hist" ? ["hdt", "hbr", "hac", "hde"][i] : "c" + i, h, r => r[i], blk === "hist" && i ? "" : "center"]);
        rows = d.rows;
      } else if (REC_KINDS.includes(blk)) {
        if (!recLoad(blk).length) { sviAlert("Aucune donnée dans " + label + "."); return; }
        cols = coOrder(blk, recCols[blk]);
        rows = recShown[blk] || recSorted(blk);
      } else {
        const src = lastShown.detail;
        if (!src || !src.rows.length) { sviAlert("Aucune donnée dans " + label + "."); return; }
        cols = coOrder(active, src.cols);
        rows = src.rows;
        const ht = rows.reduce((t, l) => t + (l.amount || 0), 0);
        const tv = rows.reduce((t, l) => t + (l.tvaAmt || 0), 0);
        if (active === "chg" || active === "prd") end = `<div class="tot">
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
      /* budget en instance : aperçu standard des lignes saisies */
      if (INS && (blk === "hier" || blk === "detail")) return printGeneric(blk);
      if (blk === "hier") return printTasks("plain");
      if (blk === "detail" && active === "chg") return printTasks("chg");
      if (blk === "detail" && active === "prd") return printTasks("prd");
      if (blk === "detail" && active === "dly") return printGeneric(blk);
      if (!(blk === "detail" && active === "qlt")) return printGeneric(blk);
      histLog(blkLabel(blk), "APERÇU PDF");
      let tableHTML;
      if (blk === "detail" && active === "qlt") {
        sviAlert("Aucune donnée dans " + blkLabel(blk) + ".");
        return;
      }
      if (REC_KINDS.includes(blk) && !recLoad(blk).length) {
        sviAlert("Aucune donnée dans " + blkLabel(blk) + ".");
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
      if (!w) { sviAlert("Autorisez les fenêtres pop-up pour l'aperçu PDF."); return; }
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
        <div class="pv-bar"><span>APERÇU — ${esc(blkDisp(blk))}</span>
          <button type="button" onclick="window.print()">🖨 IMPRIMER</button>
          <button type="button" class="x" onclick="window.close()">✕ FERMER</button></div>
        <h1>${esc(budget.project)} — ${esc(ref)}</h1>
        <h2>${esc(blkDisp(blk))} — ${new Date().toLocaleDateString("fr-FR")}</h2>
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
            <button type="button" data-ha="export"${histData().rows.length ? "" : ' class="off" disabled'}><span>Exporter</span></button>
            <button type="button" data-ha="pdf"${histData().rows.length ? "" : ' class="off" disabled'}><span>Aperçu PDF</span></button>
            <button type="button" data-ha="max"><span>${big ? "Réduire" : "Agrandir"}</span></button>`;
          document.body.appendChild(m);
          const r = more.getBoundingClientRect();
          m.style.top = r.bottom + 4 + "px";
          m.style.left = Math.max(8, r.right - m.offsetWidth) + "px";
          m.style.zIndex = 10010;
          m.addEventListener("click", ev => {
            const it = ev.target.closest("[data-ha]");
            if (!it || it.disabled) return;
            m.remove();
            const a = it.dataset.ha;
            if (a === "max") {
              const c = p.querySelector(".hist-card");
              const on = c.classList.toggle("hist-max");
              if (on) { c.dataset.sw = c.style.width; c.dataset.sh = c.style.height; c.style.width = ""; c.style.height = ""; }
              else { c.style.width = c.dataset.sw || ""; c.style.height = c.dataset.sh || ""; }
              return;
            }
            if (!histData().rows.length) { sviAlert("Aucune donnée dans l'historique."); return; }
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
          p.querySelector("#docErr").textContent = "À COMPLÉTER (*) : " + miss.join(", ").toUpperCase() + ".";
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
          }).catch(err => sviAlert("DOCUMENT " + savedRef + " ENREGISTRÉ SUR L'IPAD, MAIS PAS DANS LE DRIVE : " + driveErrText(err)));
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
      rref: 210, rdate: 150, rtitle: 360, rfile: 120, rexp: 110, robj: 200, rtext: 420,
      rresp: 180, rprev: 140, rdelay: 150, relap: 150, rimp: 60
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
      if (title) title.innerHTML = SVI_ICON[kind] + esc(blkName[kind]) + " " + svCnt(list.length, all.length);
      const st = cfT(kind);
      title?.classList.remove("cf-on");   /* pas de bleu d'onglet pour un filtre (loupe) */
      if (title) sviMarkEmptyTabs(title.parentNode);

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
        ["INTITULÉ", sviIntitule(ref, budget.project, budget.inst)],
        ["CLIENT", sviClient(budget.inst)],
      ];
      /* budget en instance : l'INTITULÉ se saisit ici (repris dans les listes, exports et aperçus) */
      const editInt = !!(budget.inst && (budget.inst.state || "instance") === "instance");
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
                ${(k === "INTITULÉ" || k === "CLIENT") && editInt
                  ? `<input class="doc-in inf-int" id="${k === "CLIENT" ? "infCli" : "infInt"}" value="${esc(v === "À COMPLÉTER" ? "" : v)}" placeholder="À COMPLÉTER" autocomplete="off">`
                  : `<span class="doc-in doc-ro inf-val">${esc(v)}</span>`}`).join("")}
            </div>
          </div>
          <div class="doc-foot">
            <button type="button" class="doc-btn doc-save" data-cancel>FERMER</button>
          </div>
        </div>`;
      document.body.appendChild(p);
      popEnhance(p, "inf");
      /* INTITULÉ et CLIENT : enregistrés à la fermeture de la fenêtre */
      const saveInt = () => {
        [["#infInt", "intitule", "INTITULÉ", "À COMPLÉTER"], ["#infCli", "client", "CLIENT", ""]].forEach(([sel, f, lab, def]) => {
          const i = p.querySelector(sel);
          if (!i) return;
          const v = i.value.trim().toUpperCase();
          if (v === String(budget.inst[f] || "").trim().toUpperCase()) return;
          budget.inst[f] = v || def;
          sviInstSet(sviInstGet().map(x => x.ref === ref ? { ...x, [f]: budget.inst[f] } : x));
          histLog("INF", lab, budget.inst[f] || "—");
        });
      };
      p.querySelectorAll("#infInt, #infCli").forEach(i => i.addEventListener("input", e => { e.target.value = e.target.value.toUpperCase(); }));
      p.addEventListener("click", e => {
        if (e.target === p || e.target.closest("[data-cancel]")) { saveInt(); p.remove(); }
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
          if (!blob) { w && w.close(); sviAlert("Document non disponible sur cet appareil."); return; }
          const url = URL.createObjectURL(blob);
          if (w) w.location.href = url; else download(d.name, blob);
        }).catch(e => { w && w.close(); sviAlert("Ouverture impossible : " + e.message); });
        return;
      }
      if (!d || !d.data) { sviAlert("Document non disponible sur cet appareil."); return; }
      try {
        const [meta, b64] = d.data.split(",");
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
        const blob = new Blob([arr], { type: (meta.match(/data:([^;]+)/) || [])[1] || d.type || "" });
        const url = URL.createObjectURL(blob);
        const w = window.open(url, "_blank");
        if (!w) download(d.name, blob);
      } catch (e) { sviAlert("Ouverture impossible : " + e.message); }
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
          $p("recErr").textContent = "À COMPLÉTER (*) : " + miss.join(", ").toUpperCase() + ".";
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

    /* budget en instance : lignes cochées d'un bloc (les cases servent à supprimer, exporter, aperçu) */
    const insBlkKinds = blk => blk === "client" ? ["des"] : blk === "hier" ? ["lot", "prim", "sec"]
      : blk === "detail" && ["chg", "prd", "qlt"].includes(active) ? [active]
      : blk === "detail" && active === "unl" ? ["des", "lot", "prim", "sec", "chg", "prd"] : [];
    /* ✕ DÉLIER LES LIGNES COCHÉES (menu ⋯) : liaisons qui contiennent une ligne cochée (et affichée) du bloc ;
       produits / charges cochés : retirés de leurs liaisons ; LIAISONS VALIDÉES : liaisons cochées */
    const insUnlPlan = blk => {
      if (!INS || !INS_EDIT) return null;
      const L = INS.links || [];
      if (blk === "detail" && active === "lnk") {
        const vi = new Set((lastShown.detail && lastShown.detail.kind === "lnk" ? lastShown.detail.rows : []).map(l => l.id));
        const hit = L.filter(l => l.on === true && vi.has(l.id));
        return { mode: "del", links: hit, remP: [], remC: [], n: hit.length };
      }
      if (blk === "detail" && !["chg", "prd"].includes(active)) return null;
      const ks = insBlkKinds(blk).filter(k => k !== "qlt");
      if (!ks.length) return null;
      const sel = {};
      ks.forEach(k => { sel[k] = insSelIds(k); });
      const remP = sel.prd ? [...sel.prd].filter(id => L.some(l => (l.prd || []).some(x => x.id === id))) : [];
      const remC = sel.chg ? [...sel.chg].filter(id => L.some(l => (l.chg || []).some(x => x.id === id))) : [];
      const hit = L.filter(l => ["des", "lot", "prim", "sec"].some(k => sel[k] && sel[k].has(l[k]))
        || (l.prd || []).some(x => remP.includes(x.id)) || (l.chg || []).some(x => remC.includes(x.id)));
      return { mode: "del", links: hit, remP, remC, n: hit.length };
    };
    /* suppression : seules les lignes cochées ET déliées partent ; une ligne liée n'est jamais proposée */
    const insDelPlan = blk => {
      const X = shell.__ins;
      const out = { del: {}, n: 0, kept: 0 };
      if (!X) return out;
      /* IMPORT NON CRÉÉ : les lignes cochées de l'onglet (les données déjà importées restent) */
      /* DÉTAIL DÉLAIS : périodes cochées (le brouillon de la liaison en cours) */
      if (blk === "detail" && active === "dly") { const Y = shell.__insDly; if (Y && Y.draft) { const D = Y.draft(); out.n = Object.values(D).reduce((t, l) => t + l.filter(p => p.on === true).length, 0); if (out.n) out.del.dly = true; } return out; }
      if (blk === "detail" && active === "inc") { const vi = new Set(lastShown.detail && lastShown.detail.kind === "inc" ? lastShown.detail.rows.map(x => x.id) : []);
        const ids = new Set((INS.inc || []).filter(x => x.on === true && vi.has(x.id)).map(x => x.id)); if (ids.size) { out.del.inc = ids; out.n = ids.size; } return out; }
      const unlTab = blk === "detail" && active === "unl";
      insBlkKinds(blk).forEach(k => {
        /* onglet LIGNES NON LIÉES : seulement ses lignes (non liées), titres compris */
        const vu = unlTab ? new Set((lastShown.detail && lastShown.detail.kind === "unl" ? lastShown.detail.rows : []).filter(x => x.k === k).map(x => x.id)) : insVis(k);
        const rows = unlTab ? X.INS[k].filter(r => r.on === true && vu.has(r.id) && !X.isUsed(k, r.id)) : X.INS[k].filter(r => !r.t && r.on === true && vu.has(r.id));
        const free = rows.filter(r => !X.isUsed(k, r.id));
        out.kept += rows.length - free.length;
        const ids = new Set(free.map(r => r.id));
        /* un titre part avec sa branche quand toute sa branche part */
        if (k === "des") X.INS.des.forEach(t => { if (t.t) { const b = X.insBranch(t);
          if (b.length && b.every(r => ids.has(r.id))) ids.add(t.id);
          /* titre vide coché : supprimé lui aussi (et compté) */
          else if (!b.length && t.on === true && !unlTab) { ids.add(t.id); out.n++; } } });
        if (ids.size) { out.del[k] = ids; out.n += free.length; }
      });
      return out;
    };
    /* détail d'un compteur de lignes cochées par bloc : « 5 CHARGES + 42 PRODUITS » */
    const DEL_LAB = { des: ["DÉSIGNATION", "DÉSIGNATIONS"], lot: ["LOT", "LOTS"], prim: ["ACTIVITÉ PRIMAIRE", "ACTIVITÉS PRIMAIRES"], sec: ["ACTIVITÉ SECONDAIRE", "ACTIVITÉS SECONDAIRES"], chg: ["CHARGE", "CHARGES"], prd: ["PRODUIT", "PRODUITS"] };
    const insDelSplit = pl => Object.keys(pl.del || {}).filter(k => DEL_LAB[k] && pl.del[k].size).map(k => pl.del[k].size + " " + DEL_LAB[k][pl.del[k].size > 1 ? 1 : 0]).join(" + ");
    const insDelRun = blk => {
      const X = shell.__ins;
      const pl = insDelPlan(blk);
      if (!pl.n) return;
      if (pl.del.dly) { shell.__insDlyDel && shell.__insDlyDel(); return; }
      if (!X) return;
      if (pl.del.inc) {
        svConfirm({ title: "EFFACER LES LIGNES D'IMPORT", text: pl.n + " LIGNE(S) EFFACÉE(S) DE L'ONGLET IMPORT NON CRÉÉ. LES DONNÉES DÉJÀ IMPORTÉES RESTENT.", ok: "EFFACER" }).then(go => {
          if (!go) return;
          INS.inc = (INS.inc || []).filter(x => !pl.del.inc.has(x.id));
          histLog("IMPORT", "LIGNES NON CRÉÉES EFFACÉES", pl.n + " LIGNE(S)");
          insSave(); refreshAll();
        });
        return;
      }
      svConfirm({ title: "SUPPRIMER LES LIGNES COCHÉES",
        text: pl.n + " LIGNE(S) SERONT SUPPRIMÉES" + (Object.keys(pl.del).length > 1 ? " : " + insDelSplit(pl) : "") + "." + (pl.kept ? " " + pl.kept + " LIGNE(S) LIÉE(S) RESTENT." : ""), ok: "SUPPRIMER" }).then(go => {
        if (!go) return;
        Object.keys(pl.del).forEach(k => {
          X.INS[k] = X.INS[k].filter(x => !pl.del[k].has(x.id));
          histLog("SAISIE", "LIGNES SUPPRIMÉES", pl.del[k].size + " LIGNE(S)");
        });
        X.cleanLinks(); X.insSave();
        if (blk === "detail" && active === "unl") refreshAll(); else Object.keys(pl.del).forEach(k => X.insRedraw(k));
      });
    };
    /* export / aperçu : s'il y a des lignes cochées dans le bloc, seulement celles-là */
    const insOnlyChecked = blk => {
      const X = shell.__ins;
      if (!X || !lastShown) return;
      if (blk === "client" && lastShown.client && lastShown.client.ins) {
        const on = new Set(X.INS.des.filter(r => !r.t && r.on === true).map(r => r.id));
        if (!on.size) return;
        const keep = new Set();
        X.INS.des.forEach(t => { if (t.t && X.insBranch(t).some(r => on.has(r.id))) keep.add(t.id); });
        lastShown.client = { ...lastShown.client, rows: lastShown.client.rows.filter(r => on.has(r.id) || keep.has(r.id)) };
      } else if (blk === "hier" && lastShown.hier) {
        ["lot", "prim", "sec"].forEach(k => {
          const vis = insVis(k);
          const on = X.INS[k].filter(r => r.on === true && vis.has(r.id));
          if (on.length) lastShown.hier[k] = on.map(r => r.v || "");
        });
      } else if (blk === "detail" && lastShown.detail && lastShown.detail.ins) {
        const rows = lastShown.detail.rows.filter(r => r.on === true);
        if (rows.length) lastShown.detail = { ...lastShown.detail, rows };
      }
    };
    /* ===== COPIER / COUPER / COLLER (FORMAT) : lignes cochées d'un bloc ;
       collées à la fin du même bloc, dans ce budget ou un autre, sans liaison ;
       « COPIE DE » seulement en cas de doublon ; COUPER = lignes non liées, retirées au COLLER ;
       copie aussi dans le presse-papiers de l'iPad (tableau) ===== */
    const CLIP_KEY = "svi_clip_v1";
    const clipGet = () => { try { return JSON.parse(localStorage.getItem(CLIP_KEY) || "null"); } catch (e) { return null; } };
    const clipSet = c => { try { c ? localStorage.setItem(CLIP_KEY, JSON.stringify(c)) : localStorage.removeItem(CLIP_KEY); } catch (e) {} };
    const clipKinds = blk => blk === "detail" && !["chg", "prd", "qlt"].includes(active) ? [] : insBlkKinds(blk);
    /* ===== onglets de contrôle (FORMAT 99) : IMPORT NON CRÉÉ (COPIER / COUPER / COLLER = réimport),
       LIGNES NON LIÉES et LIAISONS VALIDÉES (COPIER) — lignes cochées ET affichées ===== */
    const ctlTab = blk => blk === "detail" && ["inc", "unl", "lnk"].includes(active) ? active : "";
    const ctlRows = () => {
      const ls = lastShown.detail;
      if (!ls || ls.kind !== active) return [];
      return ls.rows.filter(x => active === "unl" ? x.r && x.r.on === true : x.on === true);
    };
    const ctlCount = (blk, act) => {
      const t = ctlTab(blk);
      if (!t || !INS_EDIT && act !== "copy") return 0;
      if (act === "copy") return ctlRows().length;
      if (t !== "inc") return 0;
      if (act === "cut") return ctlRows().length;
      return -1;   /* COLLER : toujours proposé (le presse-papiers est lu au toucher) */
    };
    const ctlCopy = async (cut) => {
      const ls = lastShown.detail, rows = ctlRows();
      if (!rows.length) return;
      const cols = coOrder(ls.kind === "inc" ? "lk_inc" : ls.kind === "unl" ? "lk_unl" : "lk_links", ls.cols);
      const cell = v => String(v ?? "").replace(/[\t\n]/g, " ");
      const tsv = [cols.map(c => c[1]).join("\t"), ...rows.map(r => cols.map(c => cell(c[2](r))).join("\t"))].join("\n");
      try { navigator.clipboard && await navigator.clipboard.writeText(tsv); } catch (e) {}
      if (!cut) { svToast(rows.length + " LIGNE(S) COPIÉE(S) DANS LE PRESSE-PAPIERS.", 2500); histLog("SAISIE", "COPIER", rows.length + " LIGNE(S) — " + ls.kind.toUpperCase()); return; }
      if (!(await svConfirm({ title: "COUPER LES LIGNES COCHÉES", text: rows.length + " LIGNE(S) COPIÉE(S) PUIS RETIRÉE(S) DE L'ONGLET IMPORT NON CRÉÉ.", ok: "COUPER" }))) return;
      const ids = new Set(rows.map(x => x.id));
      INS.inc = (INS.inc || []).filter(x => !ids.has(x.id));
      histLog("IMPORT", "COUPER", rows.length + " LIGNE(S) — IMPORT NON CRÉÉ");
      insSave(); refreshAll();
    };
    /* COLLER dans IMPORT NON CRÉÉ : lignes corrigées (Excel / Google Sheets, avec en-têtes) réimportées */
    const ctlPaste = async () => {
      let txt = "";
      try { txt = await navigator.clipboard.readText(); } catch (e) { svToast("COLLAGE IMPOSSIBLE : AUTORISER L'ACCÈS AU PRESSE-PAPIERS.", 4000); return; }
      const aoa = String(txt || "").replace(/\r/g, "").split("\n").filter(l => l.trim()).map(l => l.split("\t"));
      if (!aoa.length) { svToast("PRESSE-PAPIERS VIDE.", 3000); return; }
      const H = (aoa.find(r => r.map(bfNorm).includes("DESIGNATION CLIENT") || r.map(bfNorm).includes("ACTIVITE SECONDAIRE")) || []).map(bfNorm);
      if (!H.length) { svToast("EN-TÊTES ATTENDUS (ART, DÉSIGNATION CLIENT… ou LOT, ACTIVITÉ SECONDAIRE, DÉBUT, FIN).", 4500); return; }
      const hi = aoa.findIndex(r => r.map(bfNorm).join("|") === H.join("|"));
      const body = aoa.slice(hi + 1), ti = H.indexOf("TYPE");
      const isD = r => ti >= 0 && bfNorm(r[ti]) === "DELAI";
      const bRows = body.filter(r => !isD(r)), dRows = body.filter(isD);
      /* la colonne LIGNE n de la raison garde le numéro d'origine */
      const before = (INS.inc || []).length;
      if (bRows.length && H.includes("DESIGNATION CLIENT")) bfApply(bfModel([aoa[hi], ...bRows]), "add", "COLLER", true);
      if (dRows.length || (!H.includes("DESIGNATION CLIENT") && body.length)) {
        const pick = n => H.indexOf(n);
        const D = (dRows.length ? dRows : body).map(r => [r[pick("LOT")] ?? "", r[pick("ACTIVITE SECONDAIRE")] ?? "", "", r[pick("DEBUT")] ?? "", r[pick("FIN")] ?? "", "", r[pick("PREDECESSEURS")] ?? ""]);
        dlyImportAoa([DLY_HEAD, ...D], "COLLER", true);
      }
      const n = body.length, left = (INS.inc || []).length - before;
      histLog("IMPORT", "COLLER (RÉIMPORT)", n + " LIGNE(S)" + (left > 0 ? " — " + left + " NON CRÉÉE(S)" : ""));
      insSave(); refreshAll();
    };
    const clipPick = (blk, cut) => {
      const X = shell.__ins, out = {};
      if (!X) return out;
      clipKinds(blk).forEach(k => {
        const sel = insSelIds(k);
        let rows = X.INS[k].filter(r => sel.has(r.id));
        if (cut) {
          /* couper : seulement les lignes non liées (un titre dont une ligne est liée reste) */
          const used = new Set(rows.filter(r => !r.t && X.isUsed(k, r.id)).map(r => r.id));
          rows = rows.filter(r => !used.has(r.id) && !(r.t && X.insBranch(r).some(x => used.has(x.id))));
        }
        if (rows.length) out[k] = rows;
      });
      return out;
    };
    const clipCount = (blk, act) => {
      if (act === "paste") { const c = clipGet(); return c ? clipKinds(blk).reduce((t, k) => t + ((c.items || {})[k] || []).length, 0) : 0; }
      const p = clipPick(blk, act === "cut");
      return Object.values(p).reduce((t, a) => t + a.length, 0);
    };
    const clipTake = (blk, cut) => {
      const p = clipPick(blk, cut);
      if (!Object.keys(p).length) return;
      const items = {}, tsv = [];
      Object.keys(p).forEach(k => {
        const minD = Math.min(...p[k].map(r => Number(r.d) || 0));
        items[k] = p[k].map(r => { const c = JSON.parse(JSON.stringify(r)); delete c.on; delete c.lk; if (k === "des") c.d = (Number(r.d) || 0) - minD; return c; });
        /* presse-papiers : en-tête + lignes, séparées par des tabulations */
        if (INS_COLS[k]) {
          tsv.push(INS_COLS[k].map(c => c[1]).join("\t"));
          p[k].forEach(r => tsv.push(INS_COLS[k].map(c => { const v = r.t && !["art", "des"].includes(c[0]) ? "" : (c[3] === "txt" ? (r[c[0]] || "") : insFmt(insCalc(k, r, c[0]))); return String(v ?? "").replace(/[\t\n]/g, " "); }).join("\t")));
        } else { tsv.push({ lot: "LOT", prim: "ACTIVITÉ PRIMAIRE", sec: "ACTIVITÉ SECONDAIRE" }[k] || k.toUpperCase()); p[k].forEach(r => tsv.push(r.v || "")); }
        tsv.push("");
      });
      clipSet({ items, cut: cut ? { ref, ids: Object.fromEntries(Object.keys(p).map(k => [k, p[k].map(r => r.id)])) } : null, from: fullRef });
      try { navigator.clipboard && navigator.clipboard.writeText(tsv.join("\n").trim()).catch(() => {}); } catch (e) {}
      histLog("SAISIE", cut ? "COUPER" : "COPIER", Object.values(p).reduce((t, a) => t + a.length, 0) + " LIGNE(S)");
      insMarkCut();
    };
    /* lignes coupées : en pointillés jusqu'au COLLER */
    const insMarkCut = () => {
      const c = clipGet(), ids = new Set(c && c.cut && c.cut.ref === ref ? Object.values(c.cut.ids).flat() : []);
      shell.querySelectorAll(".ins-table tr[data-iid], .ins-hcol .ins-li[data-iid]").forEach(el => el.classList.toggle("ins-cut", ids.has(el.dataset.iid)));
    };
    shell.__markCut = insMarkCut;
    const clipPaste = blk => {
      const X = shell.__ins, c = clipGet();
      if (!X || !c) return;
      let n = 0;
      clipKinds(blk).forEach(k => {
        const rows = (c.items || {})[k] || [];
        if (!rows.length) return;
        const fresh = rows.map(r => {
          const x = JSON.parse(JSON.stringify(r));
          x.id = insId(); x.on = false;
          const lab = (k === "lot" || k === "prim" || k === "sec" || k === "qlt") ? "v" : "des";
          /* doublon dans ce bloc (copie, pas coupe dans ce même budget) : « COPIE DE » */
          const cutHere = c.cut && c.cut.ref === ref;
          const dup = lab === "v" ? X.INS[k].some(o => U_(o.v) === U_(x.v)) : X.INS[k].some(o => impId(k, o) === impId(k, x));
          if (dup && !cutHere) x[lab] = "COPIE DE " + (x[lab] || "");
          return x;
        });
        X.INS[k].push(...fresh);
        n += fresh.length;
      });
      if (!n) return;
      /* coupe : les lignes d'origine sont retirées (dans ce budget ou dans l'autre) */
      if (c.cut) {
        const gone = c.cut.ids || {};
        if (c.cut.ref === ref) Object.keys(gone).forEach(k => { const s0 = new Set(gone[k]); X.INS[k] = X.INS[k].filter(r => !s0.has(r.id)); });
        else sviInstSet(sviInstGet().map(b => b.ref !== c.cut.ref ? b : { ...b, data: Object.fromEntries(Object.entries(b.data || {}).map(([k, v]) => [k, gone[k] ? v.filter(r => !gone[k].includes(r.id)) : v])) }));
        c.cut = null; clipSet(c);
      }
      insSortAll(); insNorm(); X.cleanLinks(); X.insSave();
      histLog("SAISIE", "COLLER", n + " LIGNE(S) — DEPUIS " + (c.from || ""));
      refreshAll();
    };
    const runBlkAct = (blk, act) => {
      if (act === "max") return toggleMax(blk);
      if (act === "del") return insDelRun(blk);
      if (ctlTab(blk) && (act === "copy" || act === "cut")) return ctlCopy(act === "cut");
      if (ctlTab(blk) === "inc" && act === "paste") return ctlPaste();
      if (act === "copy" || act === "cut") return clipTake(blk, act === "cut");
      if (act === "paste") return clipPaste(blk);
      if (act === "export" || act === "pdf") insOnlyChecked(blk);
      if (!INS && blk === "detail" && active === "prd" && (act === "export" || act === "pdf")) return chooseFormat(act);
      const b = blk === "suivi" ? recActive : blk;
      if (act === "export") openExportMenu(b);
      else if (act === "import") { if (budget.inst && (budget.inst.state || "instance") === "instance") openImportMenu(b); }
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
      const readOnly = !budget.inst || (budget.inst.state || "instance") !== "instance";
      const acts = [...tools.querySelectorAll(".blk-btn")].filter(a => !(readOnly && a.dataset.act === "import"));
      const m = document.createElement("div");
      m.id = "blkMenu";
      m.dataset.for = btn.dataset.for;
      m.innerHTML = acts.map((a, i) => {
        let lab = a.title;
        if (a.dataset.act === "max") lab = a.classList.contains("on") ? "Réduire" : "Agrandir";
        /* supprimer : grisé s'il n'y a aucune ligne cochée et déliée (l'erreur n'est pas proposée) */
        if (["copy", "cut", "paste"].includes(a.dataset.act) && ctlTab(a.dataset.blk)) {
          const n = ctlCount(a.dataset.blk, a.dataset.act);
          const lb = a.dataset.act === "paste" && ctlTab(a.dataset.blk) === "inc" ? "COLLER (RÉIMPORTER)" : lab;
          return `<button type="button" data-i="${i}" class="blk-del blk-clip${n ? "" : " off"}" ${n ? "" : "disabled"}>${a.innerHTML}<span>${esc(lb)}</span>${n > 0 || n === 0 ? svCnt(n) : ""}</button>`;
        }
        if (["copy", "cut", "paste"].includes(a.dataset.act)) {
          const n = clipCount(a.dataset.blk, a.dataset.act);
          return `<button type="button" data-i="${i}" class="blk-del blk-clip${n ? "" : " off"}" ${n ? "" : "disabled"}>${a.innerHTML}<span>${esc(lab)}</span>${svCnt(n)}</button>`;
        }
        /* exporter / aperçu : grisés si le bloc est vide (l'erreur n'est pas proposée) */
        if ((a.dataset.act === "export" || a.dataset.act === "pdf") && blkEmpty(a.dataset.blk)) {
          return `<button type="button" data-i="${i}" class="off" disabled>${a.innerHTML}<span>${esc(lab)}</span></button>`;
        }
        if (a.dataset.act === "del") {
          const up = insUnlPlan(a.dataset.blk);
          const un = up ? up.n : 0;
          const dl = up ? `<button type="button" data-unl="${esc(a.dataset.blk)}" class="blk-del blk-unl${un ? "" : " off"}" ${un ? "" : "disabled"}><span>✕ DÉLIER LES LIGNES COCHÉES</span>${svCnt(un)}</button>` : "";
          if (a.dataset.blk === "detail" && active === "lnk") return dl;
          const dp = insDelPlan(a.dataset.blk), n = dp.n, sp = Object.keys(dp.del).length > 1 ? insDelSplit(dp) : "";
          return dl + `<button type="button" data-i="${i}" class="blk-del${n ? "" : " off"}" ${n ? "" : "disabled"}>${a.innerHTML}<span>${esc(lab)}${sp ? `<small class="del-split">${esc(sp)}</small>` : ""}</span>${svCnt(n)}</button>`;
        }
        if (false) {
          const n = 0;
          return `<button type="button" data-i="${i}" class="blk-del${n ? "" : " off"}" ${n ? "" : "disabled"}>${a.innerHTML}<span>${esc(lab)}</span>${svCnt(n)}</button>`;
        }
        return `<button type="button" data-i="${i}">${a.innerHTML}<span>${esc(lab)}</span></button>`;
      }).join("");
      document.body.appendChild(m);
      const r = btn.getBoundingClientRect();
      m.style.top = r.bottom + 4 + "px";
      m.style.left = Math.max(8, r.right - m.offsetWidth) + "px";
      m.addEventListener("click", e => {
        const ub = e.target.closest("[data-unl]");
        if (ub) {
          if (ub.disabled) return;
          m.remove();
          const pl = insUnlPlan(ub.dataset.unl);
          if (pl && pl.n) lkDestroy(pl);
          return;
        }
        const it = e.target.closest("[data-i]");
        if (!it || it.classList.contains("off")) return;
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
        if (r && !r.expired) svConfirm({ title: "MARQUER EXPIRÉ", text: r.ref + " SERA MARQUÉ EXPIRÉ (CHOIX DÉFINITIF).", ok: "EXPIRÉ" }).then(go => {
          if (!go) { renderRec("doc"); return; }
          r.expired = true;
          r.expiredAt = localDT(new Date());
          docsSave(list);
          histLog("DOC", "EXPIRÉ", r.ref + " — " + (r.title || ""));
          updPill("doc");
        });
        else renderRec("doc");
        return;
      }
      if (event.target.closest(".blk-grip, .blk-rsz")) return;
      const bm = event.target.closest("#bdgMore");
      if (bm) { event.stopPropagation(); openBdgMore(bm); return; }
      if (event.target.closest("#layResetBtn")) {
        if ($("layResetBtn").disabled) return;
        svConfirm({ title: "DISPOSITION PAR DÉFAUT", text: "TOUS LES BLOCS REVIENNENT À LEUR PLACE ET À LEUR TAILLE D'ORIGINE.", ok: "RÉTABLIR", tone: "neutral" }).then(go => {
          if (!go) return;
          laySave({});
          histLog("DISPOSITION", "PAR DÉFAUT", "BLOCS REMIS À L'ORIGINE");
          layApply();
        });
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

    /* budget en instance : ‹ › navigation, 🔒 figer / revenir en édition, 🗑 supprimer, ✕ fermer */
    if (budget.inst && budget.inst.state !== "valide") {
      const toList = () => $("budgetBackBtn")?.click();
      const instUpd = fn => {
        try {
          const l = sviInstGet();
          const out = fn(l);
          sviInstSet(out);
        } catch (e) {}
      };
      const go = d => {
        const nav = window.__sviBdgNav;
        if (!nav) return;
        const j = nav.refs.indexOf(nav.cur) + d;
        if (j >= 0 && j < nav.refs.length) { nav.open(nav.refs[j]); window.scrollTo(0, 0); }
      };
      /* sortie avec une liaison modifiée non validée : on propose de valider d'abord */
      const guarded = fn => () => (shell.__lkGuard ? shell.__lkGuard() : Promise.resolve(true)).then(ok => { if (ok) fn(); });
      $("instPrev")?.addEventListener("click", guarded(() => go(-1)));
      $("instNext")?.addEventListener("click", guarded(() => go(1)));
      $("instClose")?.addEventListener("click", guarded(toList));
      $("instDel")?.addEventListener("click", () => {
        svConfirm({ title: "SUPPRIMER LE BUDGET", text: "LE BUDGET EN INSTANCE " + fullRef + " SERA SUPPRIMÉ.", ok: "SUPPRIMER" }).then(go => {
          if (!go) return;
          instUpd(l => l.filter(x => x.ref !== ref));
          groups.delete(ref);
          toList();
        });
      });
      /* ✓ : le budget figé passe dans BUDGETS (VALIDÉS), en noir, lecture seule */
      $("instValid")?.addEventListener("click", () => {
        svConfirm({ title: "VALIDER LE BUDGET", text: fullRef + " PASSERA DANS BUDGETS (VALIDÉS), EN LECTURE SEULE.", ok: "✓ VALIDER", tone: "neutral" }).then(go => {
        if (!go) return;
        /* validation : les données gardées sous les lignes titre sont effacées */
        ((budget.inst.data || {}).des || []).forEach(r => { if (r.t) ["u", "q", "p", "tva"].forEach(f => { delete r[f]; }); });
        budget.inst.state = "valide";
        const d = new Date(), p2 = n => String(n).padStart(2, "0");
        budget.inst.validated = d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + "T" + p2(d.getHours()) + ":" + p2(d.getMinutes());
        instUpd(l => l.map(x => x.ref === ref ? { ...x, data: budget.inst.data || x.data, state: "valide", validated: budget.inst.validated } : x));
        histLog("BUDGET", "VALIDÉ", fullRef);
        try { localStorage.setItem("svi_listmode_v1", "valid"); } catch (e) {}
        toList();
        });
      });
      /* bascule SAISIE / LIAISONS (mémorisée pour ce budget) */
      $("insModeSw")?.addEventListener("click", e => {
        const b = e.target.closest("[data-mode]");
        if (!b) return;
        budget.inst.mode = b.dataset.mode;
        instUpd(l => l.map(x => x.ref === ref ? { ...x, mode: budget.inst.mode } : x));
        insApplyMode();
        window.scrollTo(0, 0);
      });
      /* 🗑 NON LIÉES : supprime toutes les lignes qu'aucune liaison n'utilise */
      $("insUnlBtn")?.addEventListener("click", async () => {
        /* liaisons déliées pas encore validées : valider ou abandonner d'abord */
        if (shell.__lkGuard && !(await shell.__lkGuard())) return;
        const n = insUnlCount();
        if (!n || !(await svConfirm({ title: "SUPPRIMER LES LIGNES NON LIÉES", text: n + " LIGNE(S) NON LIÉE(S) SERONT SUPPRIMÉES.", ok: "SUPPRIMER" }))) return;
        const u = insUsed();
        INS_LINKED_KINDS.forEach(k => { INS[k] = INS[k].filter(r => u[k].has(r.id)); });
        insCleanLinks(); insSave();
        histLog("SAISIE", "LIGNES NON LIÉES SUPPRIMÉES", n + " LIGNE(S)");
        refreshAll();
      });
      $("instLock")?.addEventListener("click", async () => {
        /* liaison modifiée non validée : valider ou abandonner d'abord */
        if (shell.__lkGuard && !(await shell.__lkGuard())) return;
        const fige = budget.inst.state === "fige";
        /* FIGER : impossible tant qu'il reste une cause (FORMAT 96) : la fenêtre dit pourquoi */
        if (!fige && INS && shell.__figeBlocks && shell.__figeBlocks().length) { shell.__figeWhy(); return; }
        if (!(await svConfirm(fige
          ? { title: "REVENIR EN ÉDITION", text: fullRef, ok: "REVENIR EN ÉDITION" }
          : { title: "FIGER", text: fullRef + " PASSE EN LECTURE SEULE (RETOUR EN ÉDITION POSSIBLE).", ok: "FIGER" }))) return;
        budget.inst.state = fige ? "instance" : "fige";
        instUpd(l => l.map(x => x.ref === ref ? { ...x, state: budget.inst.state } : x));
        histLog("BUDGET", fige ? "RETOUR EN ÉDITION" : "FIGÉ", fullRef);
        openBudgetDetail(ref);
      });
    }
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

    /* budget en instance : suppression (après confirmation) */
    const delButton = event.target.closest("[data-del-budget]");
    if (delButton) {
      event.preventDefault();
      event.stopPropagation();
      const r = delButton.dataset.delBudget;
      const g = bdgGroups.get(r);
      if (!g || !g.inst) return;
      svConfirm({ title: "SUPPRIMER LE BUDGET", text: "LE BUDGET EN INSTANCE " + g.project + " " + r + " SERA SUPPRIMÉ.", ok: "SUPPRIMER" }).then(go => {
        if (!go) return;
        try {
          const l = sviInstGet().filter(x => x.ref !== r);
          sviInstSet(l);
        } catch (e) {}
        renderBudgetList();
      });
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
    sviAlert("Budget introuvable.");
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
    sviAlert("Impossible d'ouvrir le document. Autorisez les fenêtres pop-up.");
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

  const intitule = sviIntitule(ref, group.project, group.inst);

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
          <div>${esc(sviClient(group.inst))}</div>
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
        sviAlert(
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

  sviAlert(lines);
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
              await svConfirm({ title: "SUPPRIMER", text: "LA LIGNE SERA SUPPRIMÉE.", ok: "SUPPRIMER" })
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
            sviAlert(
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
  t.textContent = String(msg || "").toUpperCase();
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
    const w = t.offsetWidth, h = t.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
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
  document.getElementById("svConf")?.remove();
  const d = document.createElement("div");
  d.id = "svConf";
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
  document.body.appendChild(d);
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-r]")) d.remove(); });
}
/* couleur d'état reportée sur toute la page (cases, fenêtres) : rouge en instance, vert figé, noir sinon */
const SVI_ST_WATCH = new WeakSet();
function sviSyncState() {
  const sh = [...document.querySelectorAll(".novapp-list-shell")].find(x => x.offsetParent !== null) || document.querySelector(".novapp-list-shell");
  let st = "";
  if (sh) st = sh.classList.contains("bdg-inst-fige") ? "fige" : (sh.classList.contains("bdg-inst-instance") || sh.classList.contains("list-inst")) ? "instance" : "";
  if (document.documentElement.dataset.svst !== st) document.documentElement.dataset.svst = st;
}
function sviWatchState(shell) {
  if (shell && !SVI_ST_WATCH.has(shell)) { SVI_ST_WATCH.add(shell); new MutationObserver(sviSyncState).observe(shell, { attributes: true, attributeFilter: ["class"] }); }
  sviSyncState();
}
/* message au format de l'application (jamais de fenêtre Safari) : titre, texte, FERMER */
function sviAlert(msg, title = "INFORMATION") {
  document.getElementById("svConf")?.remove();
  const d = document.createElement("div");
  d.id = "svConf";
  d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true">
      <button type="button" class="svc-close" data-r="0" aria-label="Fermer">✕</button>
      <div class="svc-t">${esc(String(title).toUpperCase())}</div>
      <div class="svc-x" style="white-space:pre-line">${esc(String(msg ?? "").toUpperCase())}</div>
      <div class="svc-f"><button type="button" class="svc-b svc-ok svc-neutral" data-r="0">FERMER</button></div>
    </div>`;
  document.body.appendChild(d);
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-r]")) d.remove(); });
}
/* fenêtre de choix de l'application : ANNULER + boutons [{ v, label, tone }] ; résout la valeur choisie ou null */
function svChoose({ title = "", text = "", html = "", buttons = [], noCancel = false } = {}) {
  return new Promise(res => {
    document.getElementById("svConf")?.remove();
    const d = document.createElement("div");
    d.id = "svConf";
    d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true">
        <button type="button" class="svc-close" data-v="" aria-label="Fermer">✕</button>
        <div class="svc-t">${esc(title)}</div>
        ${text ? `<div class="svc-x">${esc(text)}</div>` : ""}${html ? `<div class="svc-x svc-html">${html}</div>` : ""}
        <div class="svc-f">${noCancel ? "" : '<button type="button" class="svc-b" data-v="">ANNULER</button>'}
          ${buttons.map(b => `<button type="button" class="svc-b svc-ok${b.tone === "danger" ? "" : " svc-neutral"}" data-v="${esc(b.v)}"${b.disabled ? " disabled" : ""}>${esc(b.label)}</button>`).join("")}</div>
      </div>`;
    document.body.appendChild(d);
    d.addEventListener("click", e => {
      const b = e.target.closest("[data-v]");
      if (!b && e.target !== d) return;
      if (b && b.disabled) return;
      d.remove();
      res(b && b.dataset.v ? b.dataset.v : null);
    });
  });
}
function svConfirm({ title = "CONFIRMER", text = "", html = "", ok = "OK", tone = "danger" } = {}) {
  return new Promise(res => {
    document.getElementById("svConf")?.remove();
    const d = document.createElement("div");
    d.id = "svConf";
    d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true">
        <button type="button" class="svc-close" data-r="0" aria-label="Fermer">✕</button>
        <div class="svc-t">${esc(title)}</div>
        ${text ? `<div class="svc-x">${esc(text)}</div>` : ""}${html ? `<div class="svc-x svc-html">${html}</div>` : ""}
        <div class="svc-f"><button type="button" class="svc-b" data-r="0">ANNULER</button>
          <button type="button" class="svc-b svc-ok${tone === "danger" ? "" : " svc-neutral"}" data-r="1">${esc(ok)}</button></div>
      </div>`;
    document.body.appendChild(d);
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
  document.getElementById("svConf")?.remove();
  const lines = String(msg ?? "").toUpperCase().split("\n").map(x => x.trim()).filter(Boolean);
  const d = document.createElement("div");
  d.id = "svConf";
  d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true">
      <div class="svc-t">${esc(lines.length > 1 ? lines[0] : "INFORMATION")}</div>
      <div class="svc-x">${esc((lines.length > 1 ? lines.slice(1) : lines).join("\n"))}</div>
      <div class="svc-f"><button type="button" class="svc-b svc-ok svc-neutral" data-r="1">OK</button></div>
    </div>`;
  document.body.appendChild(d);
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
        row("CHS, BDS", field("main", "ONGLETS CHS, BDS_V2, BRD_V2 — MODIFIABLE DEPUIS LA VERSION VALIDÉE")) +
        row("BUDGETS EN INSTANCE", "SUR CET APPAREIL SEULEMENT<span class=\"src-note\">PAS ENCORE ENREGISTRÉS DANS GOOGLE SHEETS</span>");
    } else {
      rows +=
        row("BDG, CHS, BDS", field("main", "ONGLETS BDG, CHS, BDS_V2, BRD_V2" + (files.main.folder ? " — DOSSIER " + esc(files.main.folder) : "")));
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
    lpTimer = setTimeout(() => { lpDone = true; msg(""); setMode(f.dataset.which); }, 550);
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
    const lab = editing === "v3" ? "LA BASE DES BUDGETS (V3)" : "LE FICHIER PRINCIPAL (CHS, BDS, BDG)";
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
function sviUnitsList() {
  let dl = document.getElementById("sviUnitsDl");
  if (!dl) { dl = document.createElement("datalist"); dl.id = "sviUnitsDl"; document.body.appendChild(dl); }
  dl.innerHTML = sviUnits().filter(x => x.a).map(x => `<option value="${esc(x.a)}">${esc(x.n)}</option>`).join("");
}
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
  b.style.top = (r.bottom + 4 + b.offsetHeight <= window.innerHeight - 8 ? r.bottom + 4 : Math.max(8, r.top - b.offsetHeight - 4)) + "px";
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
document.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === "Escape") sviUnitSugHide(); }, true);
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
function sviParamTabs() {
  const view = document.getElementById("chs");
  if (!view || view.querySelector(".prm-tabs")) return;
  const head = view.querySelector(".section-head");
  const bar = document.createElement("div");
  bar.className = "prm-tabs";
  bar.innerHTML = `<button type="button" class="prm-tab on" data-prm="chs">CHS — CHARGES STANDARDS</button><button type="button" class="prm-tab" data-prm="unit">UNITÉS</button>`;
  head.after(bar);
  const pane = document.createElement("div");
  pane.className = "prm-unit";
  pane.hidden = true;
  bar.after(pane);
  const others = () => [...view.children].filter(x => x !== head && x !== bar && x !== pane);
  const show = which => {
    bar.querySelectorAll(".prm-tab").forEach(b => b.classList.toggle("on", b.dataset.prm === which));
    others().forEach(x => { x.style.display = which === "chs" ? "" : "none"; });
    pane.hidden = which !== "unit";
    const add = document.getElementById("addChsBtn");
    if (add) add.style.display = which === "chs" ? "" : "none";
    const h1 = head.querySelector("h1"), sub = head.querySelector("p");
    if (h1) h1.textContent = which === "chs" ? "CHS — CHARGES STANDARDS" : "UNITÉS";
    if (sub) sub.textContent = which === "chs" ? "BIBLIOTHÈQUE DES CHARGES STANDARDS" : "INTITULÉ ET ABRÉVIATION (L'ABRÉVIATION EST CELLE UTILISÉE DANS LES TABLEAUX)";
    if (which === "unit") draw();
    try { localStorage.setItem("svi_prm_v1", which); } catch (e) {}
  };
  const draw = () => {
    const L = sviUnits();
    pane.innerHTML = `<table class="prm-table"><colgroup><col><col style="width:160px"><col style="width:44px"></colgroup>
      <thead><tr><th>UNITÉ</th><th class="center">ABRÉVIATION</th><th class="center"><input type="checkbox" class="prm-all" title="Tout cocher"></th></tr></thead>
      <tbody>${L.map((x, i) => `<tr data-i="${i}"><td><input class="prm-in" data-f="n" value="${esc(x.n)}" autocomplete="off"></td>
        <td class="center"><input class="prm-in center" data-f="a" value="${esc(x.a)}" autocomplete="off"></td>
        <td class="center"><input type="checkbox" class="prm-cb"></td></tr>`).join("")}
        <tr class="prm-new"><td><input class="prm-in" data-f="n" placeholder="SAISIR ICI…" autocomplete="off"></td><td class="center"><input class="prm-in center" data-f="a" autocomplete="off"></td><td></td></tr></tbody></table>
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
    if (!e.target.closest(".prm-del") || e.target.closest(".prm-del").disabled) return;
    const idx = [...pane.querySelectorAll(".prm-cb")].map((c, i) => c.checked ? i : -1).filter(i => i >= 0);
    if (!idx.length) return;
    const L = sviUnits();
    const ok = await svConfirm({ title: "SUPPRIMER LES UNITÉS COCHÉES", html: `<ul class="svc-list">${idx.map(i => `<li>${esc(L[i].a + " — " + L[i].n)}</li>`).join("")}</ul>`, ok: "SUPPRIMER" });
    if (!ok) return;
    sviUnitsSave(L.filter((x, i) => !idx.includes(i)));
    draw();
  });
  bar.addEventListener("click", e => { const b = e.target.closest(".prm-tab"); if (b) show(b.dataset.prm); });
  let start = "chs";
  try { start = localStorage.getItem("svi_prm_v1") || "chs"; } catch (e) {}
  show(start);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sviParamTabs); else sviParamTabs();


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
function sviCal(anchor, { iso = "", dis = null, onPick }) {
  document.getElementById("svCal")?.remove();
  const box = document.createElement("div");
  box.id = "svCal";
  box.__for = anchor;
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
      <div class="svcal-g">${cells}</div>`;
  };
  draw();
  document.body.appendChild(box);
  const r = anchor.getBoundingClientRect(), h = box.offsetHeight, w = box.offsetWidth;
  box.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + "px";
  box.style.top = (r.bottom + 6 + h <= window.innerHeight - 8 ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + "px";
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
  if (ex && ex.__for === el) return;
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
    sviCal(el, { iso: o.iso, dis: o.dis, onPick: d => {
      SVI_VAL.set.call(el, d.slice(8, 10) + "/" + d.slice(5, 7) + "/" + d.slice(0, 4));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } });
  }
}
document.addEventListener("click", e => {
  const el = e.target.closest && e.target.closest("input.sv-date, input.dlp-in[data-f=deb], input.dlp-in[data-f=fin]");
  if (el) sviCalOpen(el);
});
document.addEventListener("focusin", e => {
  const el = e.target.closest && e.target.closest("input.sv-date, input.dlp-in[data-f=deb], input.dlp-in[data-f=fin]");
  if (el) setTimeout(() => { if (document.activeElement === el) sviCalOpen(el); }, 0);
});
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
document.addEventListener("keydown", e => {
  if (e.key !== "Enter" && e.key !== "Tab") return;
  const el = e.target;
  if (!el || !el.matches || !el.matches("input, select")) return;
  if (el.matches('[type="checkbox"], [type="radio"], [type="file"], .cf-q') || el.closest("#cfMenu, #svCal")) return;
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
  nx.focus();
  try { if (nx.matches("input:not(.sv-date):not(.dlp-in)")) nx.select(); } catch (err) {}
  nx.scrollIntoView({ block: "nearest", inline: "nearest" });
}, true);
/* clavier de l'iPad : touche « Suivant » */
document.addEventListener("focusin", e => {
  const el = e.target;
  if (el && el.matches && el.matches("input:not([type=checkbox]):not([type=radio])") && !el.getAttribute("enterkeyhint")) el.setAttribute("enterkeyhint", "next");
});
