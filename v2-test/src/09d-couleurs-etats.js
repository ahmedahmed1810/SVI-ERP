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
  { k: "top", lab: "BARRE DU HAUT DE L'INTERFACE", sel: [".bdg-d-sticky .novapp-list-titlebar", ".novapp-list-shell > .novapp-list-titlebar", "#chs > .section-head"], tsel: ["h1", ".bdg-d-h1", ".nvp-ref"], def: { bg: "#ffffff", c: "#172033", fs: 28, b: 1, h: 54 } },
  /* B5 (série B) : le bandeau du milieu de la barre du haut (« FOURNISSEUR — … ») fait partie de la barre */
  /* 05/11 : le bandeau du milieu n'est plus un élément à part — il prend le fond, la couleur, la police et la taille de la barre du haut */
  /* 05/11 : l'en-tête DÉTAIL du budget (hors .bdg-d-block) et l'onglet actif des blocs SUIVI / RÉVISIONS (.active) suivent aussi le format */
  { k: "blk", lab: "EN-TÊTE DE BLOC", sel: [".bdg-d-block > .bdg-d-block-title", "#bdgDetailHead.bdg-d-block-title"], tsel: [".ttl"], def: { bg: "#dde2e9", c: "#b91c1c", fs: 11, b: 1, h: 29 } },
  /* v923 (remarque 2) : FOND DES ONGLETS — seule la couleur du fond a un sens (f = réglages permis) */
  { k: "tabs", lab: "FOND DES ONGLETS", sel: [".bdg-d-tabs:not(.pg-grps):not(.pg-tabs)", "#bdgTabs", ".rec-tabs"], def: { bg: "#eceff3" }, f: ["bg"] },
  { k: "tab", lab: "ONGLET", sel: [".bdg-d-tab:not(.active):not(.on):not(.prm-grp):not(.prm-tab)", ".rec-tab:not(.on):not(.active)"], def: { bg: "#eceff3", c: "#6b7280", fs: 12, b: 1, h: 33 } },
  { k: "taba", lab: "ONGLET ACTIF", sel: [".bdg-d-tab.active:not(.prm-grp):not(.prm-tab)", ".bdg-d-tab.on:not(.prm-grp):not(.prm-tab)", ".rec-tab.on", ".rec-tab.active"], def: { bg: "#ffffff", c: "#b91c1c", fs: 12, b: 1, h: 33 } },
  /* C9 (série C, document unique 5.4) : PARAMÉTRAGE — deux rangées d'onglets, réglées séparément : ONGLETS DE MODULE (onglets de classeur
     sur une bande gris-vert, l'actif clair et raccordé à la rangée du dessous) et SOUS-ONGLETS (légers, l'actif marqué d'un trait dessous) */
  { k: "tabm", lab: "ONGLETS DE MODULE", sel: [".pg-grps .prm-grp:not(.on)"], def: { bg: "#cfd9d2", c: "#3f4d44", fs: 12, b: 1, h: 32 } },
  { k: "tabsub", lab: "SOUS-ONGLETS", sel: [".pg-tabs > .prm-tab"], def: { bg: "#f7f9f8", c: "#5b6670", fs: 11, b: 1, h: 30 } },
  { k: "th", lab: "TITRES DES COLONNES (EN-TÊTE DE TABLEAU)", sel: ["table thead th", ".ins-hcol .bdg-h-head"], tsel: [".cf-lab", ".bdg-head-label"], def: { bg: "#f6f7f9", c: "#6b7480", fs: 11, b: 1, h: 22 } },
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
const SVI_IF_ACH = [["caf", "CONSULTATION FOURNISSEURS", "CONSULTATIONS FOURNISSEURS"], ["dvf", "DEVIS", "DEVIS"], ["cmf", "COMMANDE", "COMMANDES"],
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
/* F15 (série F, 06/11) : un réglage du format passe devant les règles de la feuille de styles (même celles qui visent un identifiant) —
   sélecteur renforcé (sviFmtZ) ; le texte d'un élément (titre de la barre du haut, nom des colonnes, titre du bloc) suit la taille, le gras,
   l'italique, le souligné et la couleur réglés (E.tsel = parties texte de l'élément) */
const sviFmtZ = x => x.split(",").map(y => y.trim() + ":not(#svi-z1):not(#svi-z2)").join(", ");
const sviFmtTxt = (sels, E, o) => { if (!E || !E.tsel) return ""; const d = [];
  if (o.c) d.push(`color:${o.c}!important;-webkit-text-fill-color:${o.c}!important`); if (o.fs) d.push(`font-size:${+o.fs}px!important`);
  if (o.b !== undefined) d.push(`font-weight:${o.b ? 800 : 400}!important`); if (o.i !== undefined) d.push(`font-style:${o.i ? "italic" : "normal"}!important`);
  if (o.u !== undefined) d.push(`text-decoration:${o.u ? "underline" : "none"}!important`);
  return d.length ? sels.flatMap(s => E.tsel.map(t => sviFmtZ(s + " " + t))).join(", ") + " { " + d.join("; ") + " }" : ""; };
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
      { const SS = pre.flatMap(p => E.sel.map(s => p + " body " + s)); out.push(SS.map(sviFmtZ).join(", ") + " { " + d.join("; ") + " }"); const tx = sviFmtTxt(SS, E, o); if (tx) out.push(tx); }
      const vv = sviFmtVars(E, o); if (vv) out.push(pre.map(p => p + " body").join(", ") + " { " + vv + " }"); }); });
  return out.join("\n"); }
function sviFmtCssBy(F) {
  const out = [];
  Object.keys(F.by || {}).forEach(k => { const B = F.by[k] || {}, W = /_w$/.test(k), PP = W ? sviIfWinOf(k).map(x => `html[data-svif="${x}"] body `) : [`html[data-svif="${k}"] body `], P = PP[0];
    /* 06/11 : FENÊTRE d'une pièce (k_w) — seulement les parties des fenêtres, quand la liste ou la fiche de cette pièce est affichée */
    SVI_FMT_EL.forEach(E => { if (!!E.win !== W) return; const o0 = (B.el || {})[E.k]; if (!o0) return;
      const o = E.f ? Object.fromEntries(Object.entries(o0).filter(([f]) => E.f.includes(f))) : o0, d = sviFmtDecl(o, E); if (!d.length) return;
      { const SS = PP.flatMap(p => E.sel.map(x => p + x)); out.push(SS.map(sviFmtZ).join(", ") + " { " + d.join("; ") + " }"); const tx = sviFmtTxt(SS, E, o); if (tx) out.push(tx); } const vv = sviFmtVars(E, o); if (vv) out.push(PP.map(p => p.trim()).join(", ") + " { " + vv + " }"); });
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
    { const SS = sels.map(x => "html body " + x); out.push(SS.map(sviFmtZ).join(", ") + " { " + d.join("; ") + " }"); const tx = sviFmtTxt(SS, E, o); if (tx) out.push(tx); }
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
/* 06/11 (soir, décision) : les états ne sont plus affichés en permanence — en haut du panneau, « TOUT ▾ » (ou les états choisis) ouvre le menu des
   états à cocher (TOUT en haut) ; à côté, l'entonnoir = le filtre commun des DATES (tri, condition, valeurs) ; les deux se cumulent (intersection) */
const sviStfLab = (key, L) => { const s = sviStfGet(key); if (s === null) return "TOUT"; if (!s.length) return "AUCUN";
  if (s.length === 1) return (L && L[s[0]]) || (SVI_STF.find(x => x[0] === s[0]) || [s[0], s[0]])[1]; return s.length + " ÉTATS"; };
const SVI_CF_IC = '<svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M1 2h11M3 5h7M5 8h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>';
const sviStfHead = (key, n, L, dcf) => `<button type="button" class="novapp-date-filter svi-stf-head" data-stfm="${esc(key)}"><span>${esc(sviStfLab(key, L))} <i class="dt-arr">▾</i></span>${svCnt(n)}</button>`
  + (dcf ? `<span class="cf-btn svi-stf-cf" data-cf="${esc(dcf)}" data-col="_jour" role="button" aria-label="Filtrer les dates">${SVI_CF_IC}</span>` : "");
const sviStfItems = (key, C, keys, L) => { const sel = sviStfGet(key), lab = k => (L && L[k]) || (SVI_STF.find(x => x[0] === k) || [k, k])[1], on = sel === null;
  return `<button type="button" class="svi-stf-r svi-stf-all" data-stfk="tout"><span><input type="checkbox" tabindex="-1"${on ? " checked" : ""}${!on && sel.length ? ' class="part"' : ""}> TOUT</span>${svCnt(C.tout || 0)}</button>`
    + keys.map(k => `<button type="button" class="svi-stf-r stf-${k}" data-stfk="${k}"><span><input type="checkbox" tabindex="-1"${on || sel.includes(k) ? " checked" : ""}> ${esc(lab(k))}</span>${svCnt(C[k] || 0)}</button>`).join(""); };
const sviStfHtml = () => "";   /* plus de cases affichées en permanence */
/* menu des états : chaque toucher coche / décoche et la liste suit aussitôt ; le menu reste ouvert (toucher ailleurs = fermer)
   o = { key, keys, L, counts() → { tout, état: n }, redraw() } */
/* registre des listes (clé → { keys, L, counts, redraw }) : un seul écouteur pour tous les boutons ▾ des états */
const SVI_STF_REG = {};
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-stfm]"); if (!b) return; const o = SVI_STF_REG[b.dataset.stfm]; if (!o) return;
  e.preventDefault(); e.stopPropagation(); sviStfMenu(b, { key: b.dataset.stfm, ...o }); }, true);
function sviStfMenu(btn, o) {
  const old = document.getElementById("sviEtatMenu"); if (old) { const same = old.__key === o.key; old.remove(); if (same) return; }
  const m = document.createElement("div"); m.id = "sviEtatMenu"; m.className = "svi-stf-menu"; m.__key = o.key;
  const fill = () => { m.innerHTML = sviStfItems(o.key, o.counts(), o.keys, o.L); m.querySelectorAll("input.part").forEach(i => { i.indeterminate = true; }); };
  fill(); document.body.appendChild(m); sviPlaceMenu(m, btn.getBoundingClientRect());
  m.addEventListener("click", e => { const b = e.target.closest("[data-stfk]"); if (!b) return; e.preventDefault(); e.stopPropagation(); sviStfPick(o.key, b.dataset.stfk, o.keys); o.redraw(); fill(); });
  setTimeout(() => document.addEventListener("pointerdown", function off(e) {
    if (!document.body.contains(m)) { document.removeEventListener("pointerdown", off, true); return; }
    if (!e.target.closest("#sviEtatMenu") && !e.target.closest("[data-stfm]")) { m.remove(); document.removeEventListener("pointerdown", off, true); } }, true), 0);
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
