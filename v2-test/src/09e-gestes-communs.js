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
  return { cg: `<colgroup>${all.map(c => `<col data-k="${esc(c[0])}" style="width:${w(c)}px">`).join("")}</colgroup>`, style: `width:${tot}px;min-width:100%` };
}
document.addEventListener("pointerdown", e => {
  const h = e.target.closest && e.target.closest("table[data-svcw] .col-rs[data-col]"); if (!h) return;
  const table = h.closest("table"), t = table.dataset.svcw, col = table.querySelector(`colgroup col[data-k="${CSS.escape(h.dataset.col)}"]`); if (!col) return;
  e.preventDefault(); e.stopPropagation();
  const cols = [...table.querySelectorAll("colgroup col")], hs = [...table.tHead.rows[0].cells];
  cols.forEach((c, i) => { if (!/px$/.test(c.style.width || "") && hs[i]) c.style.width = Math.round(hs[i].getBoundingClientRect().width) + "px"; });
  const x0 = e.clientX, w0 = parseFloat(col.style.width) || 120; let w = w0;
  h.classList.add("on");
  const mv = ev => { w = Math.max(64, Math.round(w0 + ev.clientX - x0)); col.style.width = w + "px"; table.style.width = cols.reduce((s, c) => s + (parseFloat(c.style.width) || 0), 0) + "px"; };
  const up = () => { document.removeEventListener("pointermove", mv, true); document.removeEventListener("pointerup", up, true); document.removeEventListener("pointercancel", up, true); h.classList.remove("on");
    const all = cwLoad(); all[t + "." + h.dataset.col] = w; cwSave(all); };
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
