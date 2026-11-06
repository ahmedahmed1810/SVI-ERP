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
/* 06/11/2026 (soir, décision d'Ahmed) : RÉGLAGE D'UNE COLONNE — appui long (clic droit sur ordinateur) sur le titre d'une colonne :
   on change son NOM et son ALIGNEMENT (À GAUCHE, CENTRÉ, À DROITE), pour ce tableau, dans toutes ses listes et fiches.
   Réglages gardés (svi_colset_v1, clé « tableau|colonne ») ; appliqués par tout l'écran (titres et cases de la colonne). */
const SVI_COLSET_K = "svi_colset_v1";
const sviColSet = () => { try { const o = JSON.parse(localStorage.getItem(SVI_COLSET_K) || "{}"); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } };
const sviColSetSave = o => { try { localStorage.setItem(SVI_COLSET_K, JSON.stringify(o)); } catch (e) {} sviColSetRun(); };
const sviColAl = (t, k) => ({ g: "left", c: "center", d: "number" }[(sviColSet()[t + "|" + k] || {}).al] || "");
const sviColLab = (t, k, def) => (sviColSet()[t + "|" + k] || {}).lab || def;
function sviColSetRun() { const S = sviColSet(); if (!Object.keys(S).length && !document.querySelector("[data-svcol-al]")) return;
  document.querySelectorAll("table thead th .cf-btn[data-cf][data-col]").forEach(b => { const th = b.closest("th"), tr = th && th.parentNode, tb = th && th.closest("table"); if (!tb || !tr) return;
    const o = S[b.dataset.cf + "|" + b.dataset.col] || {}, lab = th.querySelector(".cf-lab");
    if (lab && lab.lastChild && lab.lastChild.nodeType === 3 && th.dataset.svcolDef === undefined) th.dataset.svcolDef = lab.lastChild.textContent;
    if (lab && lab.lastChild && lab.lastChild.nodeType === 3 && !o.lab && th.dataset.svcolDef && lab.lastChild.textContent !== th.dataset.svcolDef) lab.lastChild.textContent = th.dataset.svcolDef;
    if (o.lab && lab && lab.lastChild && lab.lastChild.nodeType === 3 && lab.lastChild.textContent !== o.lab) lab.lastChild.textContent = o.lab;
    const al = { g: "left", c: "center", d: "right" }[o.al] || "", i = [...tr.cells].indexOf(th); if (i < 0) return;
    if ((th.dataset.svcolAl || "") === al && th.dataset.svcolN === String(tb.tBodies[0] ? tb.tBodies[0].rows.length : 0)) return;
    th.dataset.svcolAl = al; th.dataset.svcolN = String(tb.tBodies[0] ? tb.tBodies[0].rows.length : 0);
    th.style.textAlign = al; [...tb.tBodies].forEach(tbd => [...tbd.rows].forEach(r => { if (r.cells.length === tr.cells.length && r.cells[i]) r.cells[i].style.textAlign = al; })); }); }
{ let raf = 0; const go = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; try { sviColSetRun(); } catch (e) {} }); };
  const start = () => new MutationObserver(go).observe(document.body, { childList: true, subtree: true }); if (document.body) start(); else document.addEventListener("DOMContentLoaded", start); }
function sviColSetWin(t, k, def) {
  const S = sviColSet(), o = { ...(S[t + "|" + k] || {}) }, d = sviWinNew();
  const draw = () => { d.innerHTML = sviWinCard({ cls: "frs-card colset-card", close: "data-x", title: "COLONNE — " + esc(o.lab || def),
    body: `<div class="frs-g"><label class="frs-f frs-w"><span>NOM DE LA COLONNE</span><input class="ins-in cs-lab" value="${esc(o.lab || def)}" autocomplete="off"></label>
      <div class="frs-f frs-w"><span>ALIGNEMENT</span><div class="cs-al">${[["g", "À GAUCHE"], ["c", "CENTRÉ"], ["d", "À DROITE"]].map(([v, l]) => `<button type="button" class="svc-b${o.al === v ? " on" : ""}" data-al="${v}">${l}</button>`).join("")}</div></div></div>`,
    foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b" data-def>PAR DÉFAUT</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button>` });
    if (!d.isConnected) sviWinShow(d); };
  draw();
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
    const a = e.target.closest("[data-al]"); if (a) { o.lab = String(d.querySelector(".cs-lab").value || "").trim().toUpperCase(); o.al = a.dataset.al; draw(); return; }
    if (e.target.closest("[data-def]")) { const N = sviColSet(); delete N[t + "|" + k]; sviColSetSave(N); d.remove(); if (typeof svToast === "function") svToast("COLONNE REMISE PAR DÉFAUT.", 2000); document.dispatchEvent(new Event("svi-colset")); return; }
    if (e.target.closest("[data-ok]")) { const lab = String(d.querySelector(".cs-lab").value || "").trim().toUpperCase(), N = sviColSet(), x = {};
      if (lab && lab !== def) x.lab = lab; if (o.al) x.al = o.al; if (Object.keys(x).length) N[t + "|" + k] = x; else delete N[t + "|" + k]; sviColSetSave(N); d.remove(); document.dispatchEvent(new Event("svi-colset")); } });
}
{ let tm = 0, x0 = 0, y0 = 0;
  document.addEventListener("pointerdown", e => { clearTimeout(tm); const th = e.target.closest && e.target.closest("thead th"); if (!th || e.target.closest(".cf-btn, .col-rs, input")) return;
    const b = th.querySelector(".cf-btn[data-cf][data-col]"); if (!b) return; x0 = e.clientX; y0 = e.clientY;
    tm = setTimeout(() => { tm = 0; const lab = th.querySelector(".cf-lab"), def = (th.dataset.svcolDef || (lab && lab.lastChild ? lab.lastChild.textContent : th.textContent)).trim(); sviColSetWin(b.dataset.cf, b.dataset.col, def); }, SVI_G.lp); }, true);
  document.addEventListener("pointermove", e => { if (tm && Math.hypot(e.clientX - x0, e.clientY - y0) > SVI_G.drag) { clearTimeout(tm); tm = 0; } }, true);
  ["pointerup", "pointercancel"].forEach(t => document.addEventListener(t, () => { clearTimeout(tm); tm = 0; }, true)); }
