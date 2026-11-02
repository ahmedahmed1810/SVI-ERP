/* =========================================================
   v754 : COULEURS DES ÉTATS — paramétrables (PARAMÉTRAGE › COULEURS), communes à toute l'application
   Une seule couleur par état (plus deux rouges différents) : variables CSS --st-<état> posées sur la page.
   EN INSTANCE, FIGÉ et VALIDÉ servent dès maintenant (liste des budgets, écran d'un budget) ;
   EXPIRÉ, BLOQUÉ et ARCHIVÉ servent aux états des budgets (lot 2).
   ========================================================= */
const SVI_COL_KEY = "svi_colors_v1";
const SVI_COL_DEF = { instance: "#b91c1c", fige: "#15803d", partiel: "#1d4ed8", valide: "#172033", expire: "#b45309", bloque: "#6b7280", archive: "#6d28d9" };
const SVI_COL_LAB = [["instance", "EN INSTANCE"], ["fige", "FIGÉ"], ["partiel", "PARTIELLEMENT ACHEVÉ"], ["valide", "VALIDÉ"], ["expire", "EXPIRÉ"], ["bloque", "BLOQUÉ"], ["archive", "ARCHIVÉ"]];   /* v790 : PARTIELLEMENT ACHEVÉ (bleu) */
function sviColors() {
  let v = null; try { v = JSON.parse(localStorage.getItem(SVI_COL_KEY) || "null"); } catch (e) {}
  const o = { ...SVI_COL_DEF };
  if (v && typeof v === "object") Object.keys(o).forEach(k => { if (/^#[0-9a-f]{6}$/i.test(String(v[k] || ""))) o[k] = v[k]; });
  return o;
}
function sviColorsApply() {
  const C = sviColors(), r = document.documentElement;
  Object.keys(C).forEach(k => r.style.setProperty("--st-" + k, C[k]));
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
  { k: "top", lab: "BARRE DU HAUT DE L'INTERFACE", sel: [".bdg-d-sticky .novapp-list-titlebar", ".novapp-list-shell > .novapp-list-titlebar"], def: { bg: "#ffffff", c: "#172033", fs: 28, b: 1 } },
  { k: "blk", lab: "EN-TÊTE DE BLOC", sel: [".bdg-d-block > .bdg-d-block-title"], def: { bg: "#dde2e9", c: "#b91c1c", fs: 11, b: 1 } },
  { k: "tabs", lab: "RANGÉE D'ONGLETS", sel: [".bdg-d-tabs", "#bdgTabs", ".rec-tabs"], def: { bg: "#eceff3", c: "#6b7280", fs: 12, b: 1 } },
  { k: "tab", lab: "ONGLET", sel: [".bdg-d-tab:not(.active)", ".rec-tab:not(.on)"], def: { bg: "#eceff3", c: "#6b7280", fs: 12, b: 1 } },
  { k: "taba", lab: "ONGLET ACTIF", sel: [".bdg-d-tab.active", ".rec-tab.on"], def: { bg: "#ffffff", c: "#b91c1c", fs: 12, b: 1 } },
  { k: "th", lab: "TITRES DES COLONNES (EN-TÊTE DE TABLEAU)", sel: ["table thead th", ".ins-hcol .bdg-h-head"], def: { bg: "#f6f7f9", c: "#6b7480", fs: 11, b: 1 } },
  { k: "ttl", lab: "LIGNES DE TITRE DANS UN TABLEAU", sel: ["tr.ins-title td", "tr.ins-gtitle td", ".dly-grp td", ".ins-hcol .ins-li.lot-grp"], def: { bg: "#ece8e1", c: "#2f2a24", fs: 12, b: 1 } },
  { k: "new", lab: "LIGNE CRÉER … ICI", sel: ["tbody tr.ins-new td", "tbody tr.rec-new td", "tbody tr.scn-new td", "tbody tr.dly-new td", "tbody tr.bdg-newrow td", ".ins-hcol .ins-li.ins-new"], def: { bg: "#fdf0f0", c: "#b91c1c", fs: 12, b: 0 } },
  { k: "tot", lab: "LIGNE TOTAL", sel: ["tfoot td", "tr.bdg-d-total-row td"], def: { bg: "#fdf0f0", c: "#b91c1c", fs: 12, b: 1 } },
  { k: "win", lab: "BANDEAU DES FENÊTRES", sel: ["#svConf .svc-card > .svc-t"], def: { bg: "#dde2e9", c: "#172033", fs: 15, b: 1 } }
];
/* interfaces auxquelles la palette peut s'appliquer (APPLIQUER À) */
const SVI_FMT_IF = [
  { k: "bdg", lab: "BUDGET (ÉCRAN D'UN BUDGET)", sc: [".bdg-d-page"] },
  { k: "bdgl", lab: "LISTE DES BUDGETS", sc: ["#bdg .novapp-list-shell"] },
  { k: "ach", lab: "ACHATS (LISTES ET PIÈCES)", sc: ["#ach"] },
  { k: "prm", lab: "PARAMÉTRAGE", sc: ["#chs"] },
  { k: "win", lab: "FENÊTRES", sc: ["#svConf"] }
];
function sviFmt() {
  let v = null; try { v = JSON.parse(localStorage.getItem(SVI_FMT_KEY) || "null"); } catch (e) {}
  return v && typeof v === "object" ? { el: v.el || {}, to: Array.isArray(v.to) ? v.to : null } : { el: {}, to: null };
}
function sviFmtCss(F) {
  const out = [], all = !F.to || F.to.length >= SVI_FMT_IF.length;
  const SC = all ? null : SVI_FMT_IF.filter(x => F.to.includes(x.k)).flatMap(x => x.sc);
  SVI_FMT_EL.forEach(E => {
    const o = F.el[E.k]; if (!o) return;
    const d = [];
    if (o.bg) d.push(`background:${o.bg}!important`);
    if (o.c) d.push(`color:${o.c}!important;-webkit-text-fill-color:${o.c}!important`);
    if (o.fs) d.push(`font-size:${+o.fs}px!important`);
    if (o.b !== undefined) d.push(`font-weight:${o.b ? 800 : 400}!important`);
    if (o.i !== undefined) d.push(`font-style:${o.i ? "italic" : "normal"}!important`);
    if (o.u !== undefined) d.push(`text-decoration:${o.u ? "underline" : "none"}!important`);
    if (!d.length) return;
    const sels = SC ? SC.flatMap(sc => E.sel.map(x => x.startsWith(sc) ? x : sc + " " + x)).filter(x => !(x.startsWith("#svConf ") && x.indexOf(" #svConf") > 0)) : E.sel;
    if (!sels.length) return;
    out.push(sels.map(x => "html body " + x).join(", ") + " { " + d.join("; ") + " }");
  });
  return out.join("\n");
}
function sviFmtApply() {
  let st = document.getElementById("sviFmtStyle");
  if (!st) { st = document.createElement("style"); st.id = "sviFmtStyle"; (document.head || document.documentElement).appendChild(st); }
  st.textContent = sviFmtCss(sviFmt());
}
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
/* ⋯ principal commun : groupes séparés par un trait (même présentation que le ⋯ d'un budget) */
function sviHdrMenu(btn, groups, pick) {
  const old = document.getElementById("blkMenu"); if (old) { const same = old.__btn === btn; old.remove(); if (same) return; }
  const m = document.createElement("div"); m.id = "blkMenu"; m.__btn = btn;
  m.innerHTML = groups.map(g => g.filter(Boolean)).filter(g => g.length).map(g => g.map(x => `<button type="button" data-a="${esc(x.k)}" class="${x.del ? "blk-del" : ""}"><span>${esc(x.lab)}</span></button>`).join("")).join('<div class="blk-sep"></div>');
  document.body.appendChild(m); sviPlaceMenu(m, btn.getBoundingClientRect());
  m.addEventListener("click", e => { const it = e.target.closest("[data-a]"); if (!it) return; e.stopPropagation(); m.remove(); pick(it.dataset.a); });
  /* v790 (DOCUMENT UNIQUE §10.1) : un 2e toucher sur le même ⋯ ferme le menu (sans le rouvrir) */
  setTimeout(() => document.addEventListener("click", function off(e) { if (!m.isConnected) { document.removeEventListener("click", off, true); return; } if (!e.target.closest("#blkMenu")) { if (btn.contains(e.target)) { e.stopPropagation(); e.preventDefault(); } m.remove(); document.removeEventListener("click", off, true); } }, true), 0);
}
