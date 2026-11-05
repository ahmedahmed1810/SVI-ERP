/* =========================================================
   v754 : COULEURS DES ÉTATS — paramétrables (PARAMÉTRAGE › COULEURS), communes à toute l'application
   Une seule couleur par état (plus deux rouges différents) : variables CSS --st-<état> posées sur la page.
   EN INSTANCE, FIGÉ et VALIDÉ servent dès maintenant (liste des budgets, écran d'un budget) ;
   EXPIRÉ, BLOQUÉ et ARCHIVÉ servent aux états des budgets (lot 2).
   ========================================================= */
const SVI_COL_KEY = "svi_colors_v1";
/* v923 (remarque 1 du 04/11/2026) : REMIS orange (commande remise au fournisseur, paiement remis) ; NON LETTRÉ violet (banque, pour plus tard — distinct du violet d'ARCHIVÉ) */
const SVI_COL_DEF = { instance: "#b91c1c", fige: "#15803d", partiel: "#1d4ed8", remis: "#ea580c", valide: "#172033", nonlettre: "#a21caf", expire: "#b45309", bloque: "#6b7280", archive: "#6d28d9" };
const SVI_COL_LAB = [["instance", "EN INSTANCE"], ["fige", "FIGÉ"], ["partiel", "PARTIELLEMENT ACHEVÉ"], ["remis", "REMIS"], ["valide", "VALIDÉ"], ["nonlettre", "NON LETTRÉ"], ["expire", "EXPIRÉ"], ["bloque", "BLOQUÉ"], ["archive", "ARCHIVÉ"]];   /* v790 : PARTIELLEMENT ACHEVÉ (bleu) */
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
  /* v924 (remarques 3 et 4 du 04/11/2026) : une HAUTEUR (h, px) pour chaque élément ; parties des fenêtres (win: réglées une fois pour toutes les fenêtres) */
  { k: "top", lab: "BARRE DU HAUT DE L'INTERFACE", sel: [".bdg-d-sticky .novapp-list-titlebar", ".novapp-list-shell > .novapp-list-titlebar"], def: { bg: "#ffffff", c: "#172033", fs: 28, b: 1, h: 54 } },
  /* B5 (série B) : le bandeau du milieu de la barre du haut (« FOURNISSEUR — … ») fait partie de la barre */
  { k: "toptag", lab: "BARRE DU HAUT — BANDEAU DU MILIEU", sel: ["#sviScreenTag"], def: { bg: "#172033", c: "#ffffff", fs: 13, b: 1 } },
  { k: "blk", lab: "EN-TÊTE DE BLOC", sel: [".bdg-d-block > .bdg-d-block-title"], def: { bg: "#dde2e9", c: "#b91c1c", fs: 11, b: 1, h: 29 } },
  /* v923 (remarque 2) : FOND DES ONGLETS — seule la couleur du fond a un sens (f = réglages permis) */
  { k: "tabs", lab: "FOND DES ONGLETS", sel: [".bdg-d-tabs", "#bdgTabs", ".rec-tabs"], def: { bg: "#eceff3" }, f: ["bg"] },
  { k: "tab", lab: "ONGLET", sel: [".bdg-d-tab:not(.active)", ".rec-tab:not(.on)"], def: { bg: "#eceff3", c: "#6b7280", fs: 12, b: 1, h: 33 } },
  { k: "taba", lab: "ONGLET ACTIF", sel: [".bdg-d-tab.active", ".rec-tab.on"], def: { bg: "#ffffff", c: "#b91c1c", fs: 12, b: 1, h: 33 } },
  { k: "th", lab: "TITRES DES COLONNES (EN-TÊTE DE TABLEAU)", sel: ["table thead th", ".ins-hcol .bdg-h-head"], def: { bg: "#f6f7f9", c: "#6b7480", fs: 11, b: 1, h: 22 } },
  { k: "ttl", lab: "LIGNES DE TITRE DANS UN TABLEAU", sel: ["tr.ins-title td", "tr.ins-gtitle td", ".dly-grp td", ".ins-hcol .ins-li.lot-grp"], def: { bg: "#ece8e1", c: "#2f2a24", fs: 12, b: 1, h: 21 } },
  { k: "row", lab: "LIGNES D'UN TABLEAU", sel: ["table tbody td"], def: { bg: "#ffffff", c: "#172033", fs: 12, b: 0, h: 21 } },
  { k: "new", lab: "LIGNE CRÉER … ICI", sel: ["tbody tr.ins-new td", "tbody tr.rec-new td", "tbody tr.scn-new td", "tbody tr.dly-new td", "tbody tr.bdg-newrow td", ".ins-hcol .ins-li.ins-new"], def: { bg: "#fdf0f0", c: "#b91c1c", fs: 12, b: 0, h: 21 } },
  { k: "tot", lab: "LIGNE TOTAL", sel: ["tfoot td", "tr.bdg-d-total-row td"], def: { bg: "#fdf0f0", c: "#b91c1c", fs: 12, b: 1, h: 21 } },
  { k: "win", lab: "BANDEAU DES FENÊTRES", sel: ["#svConf .svc-card > .svc-t", "#docPop .doc-head"], def: { bg: "#dde2e9", c: "#172033", fs: 15, b: 1, h: 41 }, win: 1 },
  { k: "winbg", lab: "FENÊTRES — FOND DE LA FENÊTRE", sel: ["#svConf .svc-card", "#docPop .doc-card"], def: { bg: "#ffffff" }, f: ["bg"], win: 1 },
  { k: "winlab", lab: "FENÊTRES — NOMS DES CHAMPS", sel: ["#svConf .frs-f > span", "#svConf label > span:first-child", "#docPop .doc-lab"], def: { c: "#475467", fs: 11, b: 1 }, f: ["c", "fs", "b", "i", "u"], win: 1 },
  { k: "winin", lab: "FENÊTRES — CHAMPS DE SAISIE", sel: ["#svConf input:not([type=checkbox]):not([type=radio]):not([type=color])", "#svConf select", "#svConf textarea", "#docPop .doc-in"], def: { bg: "#ffffff", c: "#172033", fs: 13, b: 0, h: 34 }, win: 1 },
  { k: "wincan", lab: "FENÊTRES — BOUTON ANNULER", sel: ["#svConf .svc-f .svc-b:not(.svc-ok)", "#docPop .doc-foot .doc-btn:not(.ok)"], def: { bg: "#ffffff", c: "#172033", fs: 13, b: 1, h: 38 }, win: 1 },
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
const SVI_IF_ACH = [["caf", "CONSULTATION", "CONSULTATIONS"], ["dvf", "DEVIS", "DEVIS"], ["cmf", "COMMANDE", "COMMANDES"], ["rtc", "RETOUR DE COMMANDE", "RETOURS DE COMMANDE"],
  ["rcp", "RÉCEPTION", "RÉCEPTIONS"], ["rtr", "RETOUR DE RÉCEPTION", "RETOURS DE RÉCEPTION"], ["faf", "FACTURE", "FACTURES"], ["avf", "AVOIR", "AVOIRS"], ["paf", "PAIEMENT", "PAIEMENTS"],
  ["frs", "FOURNISSEUR", "FOURNISSEURS"], ["art", "ARTICLE", "ARTICLES"], ["bsn", "BESOIN", "BESOINS"]];
const SVI_IFS = [
  { k: "bdgl_i", grp: "BUDGET", lab: "BUDGETS EN INSTANCE (LISTE)" }, { k: "bdgl_v", grp: "BUDGET", lab: "BUDGETS VALIDÉS (LISTE)" }, { k: "bdg", grp: "BUDGET", lab: "FICHE BUDGET" },
  ...SVI_IF_ACH.flatMap(([k, one, many]) => [{ k: k + "_li", grp: "ACHATS", lab: many + " EN INSTANCE (LISTE)" }, { k: k + "_lv", grp: "ACHATS", lab: many + " VALIDÉS (LISTE)" },
    { k: k + "_fi", grp: "ACHATS", lab: "FICHE " + one + " EN INSTANCE" }, { k: k + "_fv", grp: "ACHATS", lab: "FICHE " + one + " VALIDÉE" }]),
  { k: "achprm", grp: "ACHATS", lab: "PARAMÈTRES ACHATS" }, { k: "prm", grp: "PARAMÉTRAGE", lab: "PARAMÉTRAGE" }
];
function sviIfCur() {
  const on = id => { const v = document.getElementById(id); return !!v && v.classList.contains("active-view"); };
  if (on("bdg")) { if (document.querySelector("#bdg .bdg-d-page")) return "bdg"; let m = "inst"; try { m = localStorage.getItem("svi_listmode_v1") || "inst"; } catch (e) {} return m === "valid" ? "bdgl_v" : "bdgl_i"; }
  if (on("ach")) { let t = "art"; try { t = localStorage.getItem("svi_ach_tab_v1") || "art"; } catch (e) {} if (t === "prm") return "achprm";
    const pg = document.querySelector("#ach .nvp"); if (pg) return t + (pg.matches(".bdg-inst-instance, .bdg-inst-fige") ? "_fi" : "_fv");
    return t + (document.querySelector("#ach table.nv-inst") ? "_li" : "_lv"); }
  if (on("chs")) return "prm";
  return "";
}
{ let raf = 0; const set = () => { raf = 0; const k = sviIfCur(), r = document.documentElement; if ((r.dataset.svif || "") !== k) { if (k) r.dataset.svif = k; else delete r.dataset.svif; } };
  const go = () => { if (!raf) raf = requestAnimationFrame(set); };
  const start = () => { new MutationObserver(go).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] }); go(); };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start); }
function sviFmt() {
  let v = null; try { v = JSON.parse(localStorage.getItem(SVI_FMT_KEY) || "null"); } catch (e) {}
  return v && typeof v === "object" ? { el: v.el || {}, to: Array.isArray(v.to) ? v.to : null, blk: v.blk || {}, by: v.by && typeof v.by === "object" ? v.by : {} } : { el: {}, to: null, blk: {}, by: {} };
}
/* v927 (remarque 12 du 04/11/2026) : réglage propre à une interface (MODIFIER LE FORMAT) — F.by[interface] = { el, st: { c, bg } } ;
   il passe devant le réglage commun, seulement quand cette interface est affichée (html[data-svif]) */
const sviFmtDecl = o => { const d = [];
  if (o.bg) d.push(`background:${o.bg}!important`);
  if (o.c) d.push(`color:${o.c}!important;-webkit-text-fill-color:${o.c}!important`);
  if (o.fs) d.push(`font-size:${+o.fs}px!important`);
  if (o.b !== undefined) d.push(`font-weight:${o.b ? 800 : 400}!important`);
  if (o.i !== undefined) d.push(`font-style:${o.i ? "italic" : "normal"}!important`);
  if (o.u !== undefined) d.push(`text-decoration:${o.u ? "underline" : "none"}!important`);
  if (+o.h >= 10 && +o.h <= 120) d.push(`height:${+o.h}px!important;min-height:0!important;box-sizing:border-box!important`);
  return d; };
function sviFmtCssBy(F) {
  const out = [];
  Object.keys(F.by || {}).forEach(k => { const B = F.by[k] || {}, P = `html[data-svif="${k}"] body `;
    SVI_FMT_EL.forEach(E => { if (E.win) return; const o0 = (B.el || {})[E.k]; if (!o0) return;
      const o = E.f ? Object.fromEntries(Object.entries(o0).filter(([f]) => E.f.includes(f))) : o0, d = sviFmtDecl(o); if (!d.length) return;
      out.push(E.sel.map(x => P + x).join(", ") + " { " + d.join("; ") + " }"); });
    const st = B.st || {};
    if (st.c) out.push(`${P}.bdg-d-page, ${P}.nvp, ${P}.novapp-list-shell { --inst: ${st.c}; --st-instance: ${st.c}; --st-valide: ${st.c}; }`);
    if (st.bg) out.push(`html[data-svif="${k}"] body, ${P}.view, ${P}.bdg-d-page, ${P}.nvp { background: ${st.bg} !important; }`); });
  return out.join("\n");
}
function sviFmtCss(F) {
  const out = [], all = !F.to || F.to.length >= SVI_FMT_IF.length;
  const SC = all ? null : SVI_FMT_IF.filter(x => F.to.includes(x.k)).flatMap(x => x.sc);
  SVI_FMT_EL.forEach(E => {
    const o0 = F.el[E.k]; if (!o0) return;
    const o = E.f ? Object.fromEntries(Object.entries(o0).filter(([f]) => E.f.includes(f))) : o0;   /* v923 : seulement les réglages permis */
    const d = [];
    if (o.bg) d.push(`background:${o.bg}!important`);
    if (o.c) d.push(`color:${o.c}!important;-webkit-text-fill-color:${o.c}!important`);
    if (o.fs) d.push(`font-size:${+o.fs}px!important`);
    if (o.b !== undefined) d.push(`font-weight:${o.b ? 800 : 400}!important`);
    if (o.i !== undefined) d.push(`font-style:${o.i ? "italic" : "normal"}!important`);
    if (o.u !== undefined) d.push(`text-decoration:${o.u ? "underline" : "none"}!important`);
    if (+o.h >= 10 && +o.h <= 120) d.push(`height:${+o.h}px!important;min-height:0!important;box-sizing:border-box!important`);   /* v924 : hauteur */
    if (!d.length) return;
    const sels = SC && !E.win ? SC.flatMap(sc => E.sel.map(x => x.startsWith(sc) ? x : sc + " " + x)).filter(x => !(x.startsWith("#svConf ") && x.indexOf(" #svConf") > 0)) : E.sel;
    if (!sels.length) return;
    out.push(sels.map(x => "html body " + x).join(", ") + " { " + d.join("; ") + " }");
  });
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
function sviFmtWin(ifk) {
  const D = JSON.parse(JSON.stringify(sviFmt())); D.by = D.by || {};
  const CD = { ...sviColors() };
  const S = ifk ? (D.by[ifk] = D.by[ifk] || { el: {}, st: {} }) : D; S.el = S.el || {}; if (ifk) S.st = S.st || {};
  const IF = ifk ? (SVI_IFS.find(x => x.k === ifk) || { lab: ifk }) : null, valid = ifk && /_(lv|fv)$|bdgl_v/.test(ifk);
  const ELS = SVI_FMT_EL.filter(E => !ifk || !E.win);
  const val = (E, f) => { const o = S.el[E.k] || {}; if (o[f] !== undefined) return o[f]; if (ifk && (D.el[E.k] || {})[f] !== undefined) return D.el[E.k][f]; return E.def[f]; };
  const ok = (E, f) => !E.f || E.f.includes(f), NA = '<td class="center fmt-na">—</td>';
  const preview = () => { const st = document.getElementById("sviFmtStyle"); if (st) st.textContent = sviFmtCss(D); const r = document.documentElement; Object.keys(CD).forEach(k => r.style.setProperty("--st-" + k, CD[k])); };
  const d = sviWinNew();
  const draw = () => {
    const stRow = ifk ? `<table class="prm-table fmt-t fmt-st"><colgroup><col style="width:300px"><col style="width:110px"><col style="width:110px"></colgroup><thead><tr><th>ÉTAT DE L'ÉCRAN</th><th class="center">TEXTE</th><th class="center">FOND</th></tr></thead>
        <tbody><tr><td>${valid ? "VALIDÉ" : "EN INSTANCE"}</td><td class="center"><input type="color" class="fmw-st" data-f="c" value="${esc(S.st.c || (valid ? CD.valide : CD.instance))}"></td><td class="center"><input type="color" class="fmw-st" data-f="bg" value="${esc(S.st.bg || "#f4f7fb")}"></td></tr></tbody></table>`
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
    d.innerHTML = sviWinCard({ cls: "fmw-card", close: "data-x", title: ifk ? "MODIFIER LE FORMAT — " + esc(IF.lab) : "RÉGLAGES COMMUNS — TOUT LE PROGRAMME",
      body: `<div class="fmw-scroll">${stRow}${elT}${blkT}</div>`,
      foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b" data-def>PAR DÉFAUT</button><button type="button" class="svc-b svc-ok svc-neutral" data-save>${ifk ? "ENREGISTRER" : "APPLIQUER PARTOUT"}</button>` });
  };
  draw(); sviWinShow(d);
  const num = (v, a, b) => { const n = parseInt(String(v).replace(/\D/g, ""), 10); return n >= a && n <= b ? n : null; };
  d.addEventListener("input", e => { const i = e.target;
    if (i.matches(".fmw-st")) { S.st[i.dataset.f] = i.value; preview(); return; }
    if (i.matches(".fmw-col")) { CD[i.dataset.col] = i.value; preview(); return; }
    if (i.matches(".fmw-in") && i.type !== "checkbox") { const k = i.closest("tr").dataset.el, f = i.dataset.f; S.el[k] = S.el[k] || {};
      if (f === "fs" || f === "h") { const n = f === "fs" ? num(i.value, 8, 40) : num(i.value, 10, 120); if (n === null) return; S.el[k][f] = n; } else S.el[k][f] = i.value; preview(); } });
  d.addEventListener("change", e => { const i = e.target;
    if (i.matches(".fmw-in") && i.type === "checkbox") { const k = i.closest("tr").dataset.el; S.el[k] = S.el[k] || {}; S.el[k][i.dataset.f] = i.checked ? 1 : 0; preview(); }
    if (i.matches(".fmw-blk")) { const n = num(i.value, 1, 30); if (n === null) { svToast("ENTRE 1 ET 30 LIGNES.", 2500, i); return; } D.blk = { ...sviBlkRows(D), [i.dataset.b]: n }; D.blk = sviBlkRows(D); } });
  d.addEventListener("click", e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); sviFmtApply(); sviColorsApply(); return; }
    if (e.target.closest("[data-def]")) { if (ifk) { S.el = {}; S.st = {}; } else { D.el = {}; D.blk = {}; Object.assign(CD, SVI_COL_DEF); } preview(); draw(); return; }
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
