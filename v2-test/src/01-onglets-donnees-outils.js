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

