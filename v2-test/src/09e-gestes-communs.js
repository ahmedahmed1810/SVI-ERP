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
  /* 08/11 : une case de LISTE dont le texte est coupé montre son texte entier dans la bulle (appui long) */
  const cut = t => { const td = t && t.closest && t.closest("table.nv-one tbody td, #budgetListTable tbody td"); return td && !td.querySelector("input, select, textarea") && td.scrollWidth > td.clientWidth + 1 ? td : null; };
  const pick = t => t.closest && t.closest(TIP);   /* G4 (08/11) : plus de bulle pour une case coupée — on la touche pour l'agrandir */
  const show = el => { const t = el.dataset.tip || el.getAttribute("title") || (el.matches("td") ? String(el.textContent || "").replace(/\s+/g, " ").trim() : ""); if (t && typeof svToast === "function") svToast(t, 7000, el); };
  document.addEventListener("pointerdown", e => { const el = pick(e.target); clearTimeout(tm); if (!el) return; x0 = e.clientX; y0 = e.clientY; tm = setTimeout(() => show(el), SVI_G.lp); }, true);
  document.addEventListener("pointermove", e => { if (tm && Math.hypot(e.clientX - x0, e.clientY - y0) > SVI_G.drag) clearTimeout(tm); }, true);
  ["pointerup", "pointercancel"].forEach(t => document.addEventListener(t, () => clearTimeout(tm), true));
  document.addEventListener("contextmenu", e => { const el = pick(e.target); if (!el) return; e.preventDefault(); e.stopPropagation(); clearTimeout(tm); show(el); }, true);
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
/* 08/11 : fit = LISTE (place disponible en px) — tant qu'aucune largeur n'a été réglée, le tableau tient dans l'écran (colonnes au prorata) */
function sviCwCols(t, cols, extra = [], fit = false) {
  const CW = cwLoad(), all = cols.concat(extra), w = c => CW[t + "." + c[0]] || c[1];
  const tot = all.reduce((s, c) => s + w(c), 0);
  /* B47 (05/11) : dès qu'une largeur a été réglée, le tableau garde la somme exacte (les autres colonnes ne bougent plus) */
  const set = all.some(c => CW[t + "." + c[0]]);
  /* fit = place disponible (px) : sans largeur réglée, les colonnes (pas les colonnes d'outils) sont ramenées au prorata pour tenir dans l'écran */
  const ex = extra.reduce((a, c) => a + w(c), 0), k = fit > 0 && !set && tot > fit ? Math.max(0.3, (fit - ex) / Math.max(1, tot - ex)) : 1;
  const cw = c => (extra.includes(c) ? w(c) : Math.max(64, Math.floor(w(c) * k))) + "px";
  return { cg: `<colgroup>${all.map(c => `<col data-k="${esc(c[0])}" style="width:${cw(c)}">`).join("")}</colgroup>`, style: set ? `width:${tot}px;min-width:${tot}px` : fit ? "width:100%;min-width:0" : `width:${tot}px;min-width:100%` };
}
/* 07/11 (vérification des gestes, document unique 6.1) : la poignée de largeur est posée SUR le trait entre deux colonnes ; sa moitié droite
   est recouverte par la colonne voisine (titres collants) — toucher le bord gauche d'un titre (10 px) revient à toucher la poignée de la colonne d'avant */
document.addEventListener("pointerdown", e => {
  if (!e.isTrusted || !e.target.closest || e.target.closest(".col-rs, .cf-btn, input, button")) return; const th = e.target.closest("thead th"); if (!th) return;
  const pv = th.previousElementSibling, h = pv && pv.querySelector(":scope > .col-rs, .col-rs"); if (!h) return;
  const r = th.getBoundingClientRect(); if (e.clientX - r.left > 10) return;
  e.preventDefault(); e.stopImmediatePropagation();
  h.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, composed: true, clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY, pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary, button: e.button, buttons: e.buttons }));
}, true);
document.addEventListener("pointerdown", e => {
  const h = e.target.closest && e.target.closest("table[data-svcw] .col-rs[data-col]"); if (!h) return;
  const table = h.closest("table"), t = table.dataset.svcw, col = table.querySelector(`colgroup col[data-k="${CSS.escape(h.dataset.col)}"]`); if (!col) return;
  e.preventDefault(); e.stopPropagation();
  const cols = [...table.querySelectorAll("colgroup col")], hs = [...table.tHead.rows[0].cells];
  /* B47 : toutes les colonnes figées à leur largeur affichée — seule la colonne tirée change, les autres ne bougent pas, et toutes sont gardées */
  { const W = hs.map(x => Math.round(x.getBoundingClientRect().width)); cols.forEach((c, i) => { if (W[i]) c.style.width = W[i] + "px"; }); const tw0 = W.reduce((a, b) => a + (b || 0), 0) + "px"; table.style.width = tw0; table.style.minWidth = tw0; }
  const x0 = e.clientX, w0 = parseFloat(col.style.width) || 120; let w = w0;
  h.classList.add("on");
  const mv = ev => { w = Math.max(/^_/.test(h.dataset.col) ? 28 : 64, Math.round(w0 + ev.clientX - x0)); col.style.width = w + "px"; const tw = cols.reduce((s, c) => s + (parseFloat(c.style.width) || 0), 0) + "px"; table.style.width = tw; table.style.minWidth = tw; };
  const up = () => { document.removeEventListener("pointermove", mv, true); document.removeEventListener("pointerup", up, true); document.removeEventListener("pointercancel", up, true); h.classList.remove("on");
    const all = cwLoad(); cols.forEach(c => { if (c.dataset.k) all[t + "." + c.dataset.k] = Math.round(parseFloat(c.style.width) || 0) || all[t + "." + c.dataset.k]; }); all[t + "." + h.dataset.col] = w; cwSave(all); };
  document.addEventListener("pointermove", mv, true); document.addEventListener("pointerup", up, true); document.addEventListener("pointercancel", up, true);
}, true);
/* v793 (DOCUMENT UNIQUE §6.4) : CASES À COCHER À DROITE des listes (budgets, achats) — dernière colonne ; case d'en-tête = toutes ;
   toucher la case (ou sa cellule) coche sans ouvrir la ligne ; l'APERÇU de la liste prend les lignes cochées s'il y en a */
/* 09/11 (Ahmed) : en tête de la colonne des cases, un entonnoir comme les autres colonnes (plus de case) :
   TOUT COCHER, TOUT DÉCOCHER, SEULEMENT LES COCHÉES, TOUT AFFICHER */
/* 11/11 (Ahmed, validé) : la colonne des cases à cocher se règle (poignée, 28 px au moins) et se DÉPLACE comme les autres colonnes ;
   sa place est gardée dans l'ordre des colonnes (clé « _cb ») et posée après chaque dessin ; par défaut : 28 px, en dernier */
function sviCbPlace(t) { const hr = t.tHead && t.tHead.rows[0]; if (!hr) return; const th = hr.querySelector(":scope > th[data-cokey='_cb']"); if (!th) return;
  const key = t.querySelector("thead .cf-btn[data-cf]")?.dataset.cf || t.dataset.svcw; let S = null; try { S = (coLoad() || {})[key]; } catch (e) {} if (!Array.isArray(S) || !S.includes("_cb")) return;
  const H = [...hr.cells], kOf = c => c.dataset.cokey || c.querySelector(".cf-btn[data-col]")?.dataset.col, nk = S.slice(S.indexOf("_cb") + 1).find(k => H.some(c => kOf(c) === k));
  const ti = nk ? H.findIndex(c => kOf(c) === nk) : -1, ci = th.cellIndex; if (ti < 0 || ci === ti - 1) return;
  const n = H.length, cols = [...t.querySelectorAll(":scope > colgroup > col")];
  if (cols.length === n) cols[0].parentElement.insertBefore(cols[ci], cols[ti]);
  [...t.rows].forEach(r => { if (r.cells.length !== n) return; r.insertBefore(r.cells[ci], r.cells[ti]); }); }
{ let q = 0; new MutationObserver(() => { if (q) return; q = requestAnimationFrame(() => { q = 0; document.querySelectorAll("th[data-cokey='_cb']").forEach(th => { try { sviCbPlace(th.closest("table")); } catch (e) {} }); }); })
    .observe(document.documentElement, { childList: true, subtree: true }); }
const SVI_NVL_ONLY = new Set();
const sviListCbTh = () => `<th class="center nvl-cbh" data-cokey="_cb"><input type="checkbox" class="nvl-all" hidden aria-label="Tout cocher"><span class="cf-btn nvl-cff" role="button" aria-label="Cases cochées">${SVI_CF_IC}</span><span class="col-rs" data-col="_cb"></span></th>`;
const sviListCbTd = () => `<td class="center nvl-cbc"><input type="checkbox" class="nvl-cb" aria-label="Cocher"></td>`;
document.addEventListener("click", e => {
  const c = e.target.closest && e.target.closest("td.nvl-cbc, th.nvl-cbh"); if (!c) return;
  e.stopPropagation();
  if (c.matches("th")) { e.preventDefault(); const table = c.closest("table"), key = table.id || table.dataset.svcw || "", btn = c.querySelector(".nvl-cff") || c;
    const cbs = () => [...table.querySelectorAll("tbody .nvl-cb")], setAll = v => { const all = table.querySelector(".nvl-all"); if (all) { all.checked = v; all.dispatchEvent(new Event("change", { bubbles: true })); } };
    const only = SVI_NVL_ONLY.has(key);
    if (typeof sviEtatMenu === "function") sviEtatMenu(btn, [{ k: "all", lab: "TOUT COCHER" }, { k: "none", lab: "TOUT DÉCOCHER" }, { k: "only", lab: "SEULEMENT LES COCHÉES" }, { k: "show", lab: "TOUT AFFICHER" }], only ? "only" : "show", k => {
      if (k === "all") setAll(true); else if (k === "none") setAll(false);
      else if (k === "only") { if (!cbs().some(x => x.checked)) { if (typeof svToast === "function") svToast("AUCUNE LIGNE COCHÉE.", 1800, btn); return; } SVI_NVL_ONLY.add(key); }
      else SVI_NVL_ONLY.delete(key);
      sviNvlPaint(); });
    return; }
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

function sviNvlPaint() { document.querySelectorAll("table").forEach(t => { const k = t.id || t.dataset.svcw || ""; if (!t.querySelector("th.nvl-cbh")) return; const on = SVI_NVL_ONLY.has(k);
  t.classList.toggle("nvl-only", on); const b = t.querySelector(".nvl-cff"); if (b) b.classList.toggle("cf-on", on); }); }
{ let q = 0; new MutationObserver(() => { if (SVI_NVL_ONLY.size && !q) q = requestAnimationFrame(() => { q = 0; sviNvlPaint(); }); }).observe(document.documentElement, { childList: true, subtree: true }); }
/* 09/11 (Ahmed, règle 10.4) : DÉPLACER UNE COLONNE = APPUI LONG sur son titre, puis glisser. Un glissé sans appui long (défilement) ne déplace rien.
   sviColArm(événement de départ, titre) → fonction(ev) qui dit si le déplacement peut commencer */
document.addEventListener("pointerdown", () => document.querySelectorAll(".co-arm").forEach(x => x.classList.remove("co-arm")), true);
function sviColArm(e, th) { const t0 = e.timeStamp; let dead = false, armed = false;
  const tm = setTimeout(() => { if (!dead) { armed = true; th.classList.add("co-arm"); } }, SVI_G.lp);
  /* iPad : une fois la colonne prise, le doigt qui glisse déplace la colonne et ne fait plus défiler l'écran */
  const tmv = ev => { if (armed && ev.cancelable) ev.preventDefault(); }; document.addEventListener("touchmove", tmv, { passive: false, capture: true });
  const end = () => { clearTimeout(tm); armed = false; th.classList.remove("co-arm"); document.removeEventListener("touchmove", tmv, { capture: true }); document.removeEventListener("pointerup", end, true); document.removeEventListener("pointercancel", end, true); document.removeEventListener("touchend", end, true); };
  document.addEventListener("pointerup", end, true); document.addEventListener("pointercancel", end, true); document.addEventListener("touchend", end, true);
  return ev => { if (dead) return false; if (ev.timeStamp - t0 < SVI_G.lp) { dead = true; clearTimeout(tm); th.classList.remove("co-arm"); return false; } return true; }; }
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
function sviColSetRun() { const S = sviColSet(); if (!Object.keys(S).length && !document.querySelector("[data-svcol-al], [data-svcol-s]")) return;
  /* 09/11 (remarque) : colonnes du bloc TÂCHES (LOT, ACTIVITÉ PRIMAIRE, SECONDAIRE) — nom et mise en forme de la loupe, comme une colonne de tableau */
  { const P = (c, k, v) => v ? c.style.setProperty(k, v, "important") : c.style.removeProperty(k);
    document.querySelectorAll('.bdg-h-col .bdg-h-head .cf-btn[data-cf][data-col="v"]').forEach(b => { const hd = b.closest(".bdg-h-head"), col = hd.closest(".bdg-h-col"), o = S[b.dataset.cf + "|v"] || {}, lt = hd.querySelector(".cf-tt");
      if (lt && hd.dataset.svcolDef === undefined) { hd.dataset.svcolDef = lt.textContent.replace(/\s+/g, " ").trim(); hd.dataset.svcolDefH = lt.innerHTML; }
      if (lt && !o.lab && hd.dataset.svcolDefH !== undefined && lt.innerHTML !== hd.dataset.svcolDefH) lt.innerHTML = hd.dataset.svcolDefH;
      if (lt && o.lab && lt.textContent !== o.lab) lt.textContent = o.lab;
      const al = { g: "left", c: "center", d: "right" }[o.al] || "", sig = [al, o.fs || "", o.b ?? "", o.i ?? "", o.u ?? ""].join("/");
      col.querySelectorAll(".ins-li:not(.ins-new), .bdg-h-item").forEach(it => {   /* budget validé : lignes .bdg-h-item (texte direct) */
        if (it.classList.contains("bdg-h-item")) P(it, "text-align", al); if (it.dataset.svcolS === sig) return; it.dataset.svcolS = sig;
        [it, ...it.querySelectorAll(":scope > span:not(.ins-rdc):not(.ins-delc), input.ins-in, .lot-in > span:not(.lot-fold-sp)")].forEach(z => {   /* champs imbriqués (LOT) compris */ P(z, "font-size", o.fs ? o.fs + "px" : ""); P(z, "font-weight", o.b === undefined ? "" : o.b ? "800" : "400"); P(z, "font-style", o.i === undefined ? "" : o.i ? "italic" : "normal"); P(z, "text-decoration", o.u === undefined ? "" : o.u ? "underline" : "none"); });
        it.querySelectorAll(":scope > span:not(.ins-rdc):not(.ins-delc):not([class*='act-u']), input.ins-in:not([type=checkbox])").forEach(z => { P(z, "text-align", al); if (z.tagName === "SPAN") P(z, "flex", al ? "1 1 auto" : ""); if (z.tagName === "INPUT") P(z, "flex", al ? "1 1 auto" : ""); }); }); }); }
  /* série I (I1) : bloc des dates à gauche des listes — la mise en forme de sa loupe s'applique à ses lignes (TOUT, années, mois, jours) */
  { const P = (c, k, v) => v ? c.style.setProperty(k, v, "important") : c.style.removeProperty(k);
    document.querySelectorAll(".novapp-date-head .cf-btn[data-cf][data-col]").forEach(b => { const o = S[b.dataset.cf + "|" + b.dataset.col] || {}, al = { g: "left", c: "center", d: "right" }[o.al] || "";
      const sig = [al, o.fs || "", o.b ?? "", o.i ?? "", o.u ?? ""].join("/"), box = b.closest(".novapp-date-head").parentElement; if (!box) return;
      box.querySelectorAll(".novapp-date-item, .novapp-date-head .svi-stf-head").forEach(it => { if (it.dataset.svcolS === sig) return; it.dataset.svcolS = sig;
        P(it, "font-size", o.fs ? o.fs + "px" : ""); P(it, "font-weight", o.b === undefined ? "" : o.b ? "800" : "400"); P(it, "font-style", o.i === undefined ? "" : o.i ? "italic" : "normal"); P(it, "text-decoration", o.u === undefined ? "" : o.u ? "underline" : "none");
        const lab = [...it.children].find(x => x.tagName === "SPAN" && !x.classList.contains("dt-f") && !x.classList.contains("svi-cnt") && !x.classList.contains("cf-btn"));
        if (lab) { lab.style.flex = al ? "1 1 auto" : ""; lab.style.textAlign = al; [...lab.querySelectorAll("*")].forEach(z => { if (!z.classList.contains("dt-arr")) z.style.fontWeight = ""; }); } }); }); }
  document.querySelectorAll("table thead th .cf-btn[data-cf][data-col]").forEach(b => { const th = b.closest("th"), tr = th && th.parentNode, tb = th && th.closest("table"); if (!tb || !tr) return;
    const o = S[b.dataset.cf + "|" + b.dataset.col] || {}, lt = th.querySelector(".cf-lt, .cf-tt");   /* correction G-7 : le titre entier (et non son dernier morceau) */
    if (lt && th.dataset.svcolDef === undefined) { th.dataset.svcolDef = lt.textContent.replace(/\s+/g, " ").trim(); th.dataset.svcolDefH = lt.innerHTML; }
    if (lt && !o.lab && th.dataset.svcolDefH !== undefined && lt.innerHTML !== th.dataset.svcolDefH) lt.innerHTML = th.dataset.svcolDefH;
    if (lt && o.lab && lt.textContent !== o.lab) lt.textContent = o.lab;
    const al = { g: "left", c: "center", d: "right" }[o.al] || "", i = [...tr.cells].indexOf(th); if (i < 0) return;
    /* G5 : mise en forme de la colonne (taille, gras, italique, souligné) — cases du corps */
    const sig = [al, o.fs || "", o.b ?? "", o.i ?? "", o.u ?? ""].join("/");
    /* correction G-6 : chaque case garde sa marque (une case redessinée est reprise) ; la mise en forme de la loupe passe devant celle propre à la colonne (DATE LIMITE…) */
    th.dataset.svcolAl = sig; th.style.textAlign = "";   /* série J (J5) : le titre reste à gauche, l'alignement ne vise que les cases */
    const P = (c, k, v) => v ? c.style.setProperty(k, v, "important") : c.style.removeProperty(k);
    [...tb.tBodies].forEach(tbd => [...tbd.rows].forEach(r => { const c = r.cells.length === tr.cells.length && r.cells[i]; if (!c || c.dataset.svcolS === sig) return; c.dataset.svcolS = sig;
      P(c, "text-align", al); P(c, "font-size", o.fs ? o.fs + "px" : ""); P(c, "font-weight", o.b === undefined ? "" : o.b ? "800" : "400"); P(c, "font-style", o.i === undefined ? "" : o.i ? "italic" : "normal"); P(c, "text-decoration", o.u === undefined ? "" : o.u ? "underline" : "none"); })); }); }
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
/* 08/11 (série G, G5) : plus de renommage ni de mise en forme d'une colonne par appui long — c'est dans le menu de la loupe */
/* F16 (série F, 06/11) : POIGNÉE DE LARGEUR dans tous les tableaux — un tableau à colgroup qui n'a pas encore de poignées (PARAMÉTRAGE,
   paramètres des achats…) reçoit le moteur commun (data-svcw, poignée sur chaque titre) ; largeur gardée par tableau */
{ let raf = 0;
  const run = () => { raf = 0; const CW = cwLoad();
    document.querySelectorAll("table.prm-table:not([data-svcw]), table.frs-sub:not([data-svcw])").forEach(t => {
      const cg = t.querySelector(":scope > colgroup"), tr = t.tHead && t.tHead.rows.length === 1 ? t.tHead.rows[0] : null; if (!cg || !tr || t.querySelector("thead .col-rs")) return;
      const cols = [...cg.children]; if (cols.length !== tr.cells.length || [...tr.cells].some(c => c.colSpan > 1)) return;
      const key = "auto_" + (t.dataset.pgk || t.dataset.colh || [...t.classList].filter(c => !/^(prm-table|frs-sub|bdg-d-table)$/.test(c)).join("_") || "t") + "_" + cols.length;
      t.dataset.svcw = key; let set = false;
      cols.forEach((c, i) => { c.dataset.k = "c" + i; const w = CW[key + ".c" + i]; if (w) { c.style.width = w + "px"; set = true; } });
      if (set) { const tw = cols.reduce((s, c) => s + (parseFloat(c.style.width) || 0), 0); if (tw) { t.style.width = tw + "px"; t.style.minWidth = tw + "px"; } }
      [...tr.cells].forEach((th, i) => { if (th.querySelector("input[type=checkbox]") && !th.textContent.trim()) return; th.insertAdjacentHTML("beforeend", `<span class="col-rs" data-col="c${i}"></span>`); }); }); };
  const go = () => { if (!raf) raf = requestAnimationFrame(run); };
  const start = () => new MutationObserver(go).observe(document.body, { childList: true, subtree: true }); if (document.body) start(); else document.addEventListener("DOMContentLoaded", start); }
/* 07/11 (vérification des gestes, document unique 3.4 et 9.4) : BALAYAGE COMMUN de la barre du haut = pièce précédente / suivante —
   posé dès le chargement pour TOUS les écrans (achats compris, même sans budget ouvert avant), au doigt et à la souris (cliquer-glisser).
   Budget : écrans voisins du même budget (consolidé › initial › avenants, décision v694, window.__sviBdgNav) ; achats : ‹ › de leur barre.
   Remplace les écouteurs qui n'étaient posés qu'à l'ouverture d'un budget (11-budget-ouverture : window.__sviSwipe déjà vrai). */
window.__sviSwipe = true; window.__sviNoWrap = 0;
{ let st = null, eat = false;
  /* 09/11 (compte rendu) : le texte du centre de la barre (#sviScreenTag, posé hors de la barre) compte comme la barre — balayage au doigt et à la souris */
  const begin = (t, x, y) => { const tg = t && t.closest && t.closest("#sviScreenTag"), hdr = tg ? document.querySelector(".view.active-view .bdg-d-sticky") : t && t.closest && t.closest(".bdg-d-sticky"), ach = hdr && hdr.closest(".nvp");
    const nav = ach ? { go: d => ach.querySelector(`[data-nvp="${d > 0 ? "next" : "prev"}"]`)?.click() } : window.__sviBdgNav;
    if (!hdr || !nav || !document.querySelector(".bdg-d-page")) return null;
    if (t.closest("#docPop, #blkPop, #blkMenu, #svConf, #svCal, .av-list-ov, input, textarea, select")) return null;
    for (let el = t; el && el !== document.body; el = el.parentElement) { const cs = getComputedStyle(el); if (el.scrollWidth > el.clientWidth + 2 && /(auto|scroll)/.test(cs.overflowX)) return null; }
    const pg = document.querySelector(".bdg-d-page"), mx = pg && [...pg.classList].find(c => /^max-/.test(c));
    return { x, y, t: Date.now(), max: mx ? mx.slice(4) : "", nav }; };
  const end = (x, y) => { const s0 = st; st = null; if (!s0) return false; const dx = x - s0.x, dy = y - s0.y;
    if (Date.now() - s0.t >= 700 || Math.abs(dx) < 90 || Math.abs(dy) > Math.abs(dx) * 0.5) return false;
    if (s0.max) window.__sviPendingMax = s0.max; if (s0.nav && s0.nav.go) s0.nav.go(dx < 0 ? 1 : -1); return true; };
  document.addEventListener("touchstart", e => { st = e.touches.length === 1 ? begin(e.target, e.touches[0].clientX, e.touches[0].clientY) : null; }, { passive: true });
  document.addEventListener("touchend", e => { if (st && st.m) return; end(e.changedTouches[0].clientX, e.changedTouches[0].clientY); }, { passive: true });
  document.addEventListener("pointerdown", e => { if (e.pointerType === "touch" || e.button) return; st = begin(e.target, e.clientX, e.clientY); if (st) st.m = 1; }, true);
  document.addEventListener("pointerup", e => { if (e.pointerType === "touch" || !st || !st.m) return; if (end(e.clientX, e.clientY)) { eat = true; setTimeout(() => { eat = false; }, 400); } }, true);
  document.addEventListener("click", e => { if (eat) { eat = false; e.preventDefault(); e.stopPropagation(); } }, true);
}
/* 08/11 (document unique 9.2, remarque d'Ahmed) : PINCEMENT SUR LES LIGNES D'UN TABLEAU = hauteur des lignes de ce tableau (gardée) ; le zoom
   de Safari y est bloqué ; ailleurs (vide sous les lignes, barre du haut, entre les blocs) le pincement garde le zoom de Safari.
   À l'ordinateur : Ctrl / Cmd + molette sur les lignes (9.4). Le Gantt et le DÉTAIL DÉLAIS gardent leur propre pincement. */
const SVI_ROWH_K = "svi_rowh_v1";
const sviRowHGet = () => { try { return JSON.parse(localStorage.getItem(SVI_ROWH_K) || "{}") || {}; } catch (e) { return {}; } };
/* 09/11 : partout, pas seulement dans les listes — tableaux des fiches (clé du filtre de colonne, ou bloc de la fiche) et lignes du bloc TÂCHES */
const sviRowKey = t => { if (t.matches(".ins-hcol, .bdg-h-col")) return t.dataset.ik ? "h:" + t.dataset.ik : "";
  const k = t.dataset.svcw || t.dataset.colh || t.dataset.ik || t.id; if (k) return k;
  const cf = t.tHead && t.tHead.querySelector(".cf-btn[data-cf]"); if (cf) return "cf:" + cf.dataset.cf;
  const nb = t.closest(".nvp-blk[data-nvb]"); return nb ? "nvb:" + nb.dataset.nvb : ""; };
function sviRowHApply() { let st = document.getElementById("sviRowHStyle"); if (!st) { st = document.createElement("style"); st.id = "sviRowHStyle"; (document.head || document.documentElement).appendChild(st); }
  const H = sviRowHGet(), q = v => String(v).replace(/["\\]/g, "\\$&");
  const Z = ":not(#svi-z1):not(#svi-z2):not(#svi-z3)", TR = " tbody tr:not(.ins-title):not(.nvp-gt) td";
  st.textContent = Object.keys(H).map(k => { const v = q(k.replace(/^(h|cf|nvb):/, ""));
    const s = k.startsWith("h:") ? `:is(.ins-hcol[data-ik="${v}"] .ins-li:not(.ins-new):not(.lot-grp), .bdg-h-col[data-ik="${v}"] .bdg-h-item)${Z}`
      : k.startsWith("cf:") ? `table:has(> thead .cf-btn[data-cf="${v}"])${Z}${TR}` : k.startsWith("nvb:") ? `.nvp-blk[data-nvb="${v}"] table${Z}${TR}`
      : `table:is([data-svcw="${q(k)}"], [data-colh="${q(k)}"], [data-ik="${q(k)}"], [id="${q(k)}"])${Z}${TR}`;
    return `${s} { height: ${H[k]}px !important; min-height: 0 !important; max-height: none !important; box-sizing: border-box !important; }`; }).join("\n"); }
sviRowHApply();
{ const zone = t => { if (!t || !t.closest) return null; if (t.closest("#dlyGantt, .dlyg-foot, .dlyg-l, .dly-table, .ghist, #svConf, #docPop")) return null;
    const li = t.closest(".ins-hcol .ins-li, .bdg-h-col .bdg-h-item"), hc = li && li.closest(".ins-hcol, .bdg-h-col"); if (hc) return sviRowKey(hc) ? hc : null;
    const td = t.closest("table tbody td"), tb = td && td.closest("table"); return tb && sviRowKey(tb) ? tb : null; };
  const set = (tb, h) => { const H = sviRowHGet(), k = sviRowKey(tb); H[k] = Math.round(Math.max(18, Math.min(60, h))); try { localStorage.setItem(SVI_ROWH_K, JSON.stringify(H)); } catch (e) {} sviRowHApply(); };
  const rowH = tb => { const td = tb.matches(".ins-hcol, .bdg-h-col") ? tb.querySelector(".ins-li:not(.ins-new):not(.lot-grp), .bdg-h-item") : tb.querySelector("tbody tr:not(.ins-title) td"); return td ? td.getBoundingClientRect().height : 21; };
  let P = null;
  const dy = T => Math.abs(T[0].clientY - T[1].clientY), d = T => Math.hypot(T[0].clientX - T[1].clientX, T[0].clientY - T[1].clientY);
  document.addEventListener("touchstart", e => { if (e.touches.length !== 2) { P = null; return; } const tb = zone(e.touches[0].target), tb2 = zone(e.touches[1].target);
    if (!tb || tb !== tb2) { P = null; return; } P = { tb, h0: rowH(tb), d0: Math.max(20, d(e.touches)) }; }, { passive: true, capture: true });
  document.addEventListener("touchmove", e => { if (!P || e.touches.length !== 2) return; e.preventDefault(); set(P.tb, P.h0 * Math.pow(Math.max(20, d(e.touches)) / P.d0, SVI_G.pinch || 1)); }, { passive: false, capture: true });
  document.addEventListener("touchend", e => { if (e.touches.length < 2) P = null; }, { passive: true, capture: true });
  /* Safari : les gestes natifs (zoom de la page) sont bloqués seulement sur les lignes d'un tableau */
  document.addEventListener("gesturestart", e => { if (zone(e.target)) e.preventDefault(); }, { passive: false, capture: true });
  document.addEventListener("gesturechange", e => { if (zone(e.target)) e.preventDefault(); }, { passive: false, capture: true });
  document.addEventListener("wheel", e => { if (!(e.ctrlKey || e.metaKey)) return; const tb = zone(e.target); if (!tb) return; e.preventDefault();
    set(tb, rowH(tb) * Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.01 * (SVI_G.pinch || 1))); }, { passive: false, capture: true });
}

/* 08/11 : hauteur réelle de la ligne TOTAL des listes (la ligne CRÉER se pose juste au-dessus) */
{ let q = 0; const up = () => { q = 0; const t = document.querySelector("table.nv-one tfoot tr, #budgetListTable tfoot tr"); if (t) { const h = Math.round(t.getBoundingClientRect().height); if (h) document.documentElement.style.setProperty("--svi-tot-h", h + "px"); } };
  new MutationObserver(() => { if (!q) q = requestAnimationFrame(up); }).observe(document.documentElement, { childList: true, subtree: true }); }

/* 08/11 (série G, G4, document unique 6.3) : VOIR ET COPIER UN TEXTE COUPÉ — toucher une case dont le texte est coupé agrandit sa ligne
   pour montrer tout le texte de CETTE case (les autres restent coupées, alignées en haut) ; elle reprend sa hauteur quand on sort de la case.
   Une case qui ouvre la pièce l'ouvre au 2e toucher. Appui long = petit menu de l'application : COPIER (tout le texte). Pas de sélection Safari. */
/* 09/11 (remarque) : même geste partout — cases des tableaux, lignes du bloc TÂCHES (LOT, activités) et champs (fiches, fenêtres, listes),
   en lecture seule comme modifiables ; détection au lâcher du doigt (Safari n'envoie pas toujours le « click » sur une case) ;
   un champ coupé montre son texte entier dans une bulle sous lui ; le message « LECTURE SEULE » n'apparaît que si rien n'est coupé */
/* 11/11 (compte rendu d'Ahmed) : un nom souligné n'est coupé que s'il dépasse VRAIMENT le bord de sa case (ou finit par « … ») —
   on mesure le nom lui-même, pas la case entière (signe « ! », épingle) qui donnait de faux « coupé » : 1er toucher sans effet */
const lkCut = (lk, td) => { const r = lk.getBoundingClientRect(), t = td.getBoundingClientRect(), cs = getComputedStyle(td);
  if (lk.clientWidth && lk.scrollWidth > lk.clientWidth + 1) return true;   /* nom en bloc, coupé par « … » */
  return r.right > t.right - (parseFloat(cs.paddingRight) || 0) + 1.5 || r.left < t.left - 1; };
const SVI_LK_CUT = ".ach-link, .nv-reflink, .bdg-reflink, .cafw-go, [data-nvgo], [data-gofrs], [data-goart]";
{ let cur = null, tip = null, tm = 0, x0 = 0, y0 = 0, t0 = 0, eat = false;
  const FLD = "input:not([type=checkbox]):not([type=radio]):not([type=color]):not([type=hidden]):not([type=file]), textarea";
  const cutTd = t => { if (!t || !t.closest || t.closest("#cfMenu, .fmw-card, .cmpm-pick")) return null;
    /* 09/11 : tous les champs — une case à champ grisé (disabled : le toucher arrive sur la case) montre aussi son champ */
    const td = t.closest("table tbody td, table tfoot td"); if (td) { if (td.querySelector("select, .sv-sel")) return td; const f = t.matches && t.matches(FLD) ? t : td.querySelector(FLD); return f || td; }
    const li = t.closest(".bdg-h-col .bdg-h-item, .ins-hcol .ins-li"); if (li) return li.querySelector(":scope input.ins-in, :scope .lot-in input.ins-in") || li;
    const f = t.closest(FLD); return f && f.closest(".bdg-d-page, .nvp, #svConf, #docPop, .novapp-list-shell, table") ? f : null; };
  const over = el => el.scrollWidth > el.clientWidth + 1 || (el.tagName === "TEXTAREA" && el.scrollHeight > el.clientHeight + 1);
  /* une case est coupée si elle-même ou un de ses morceaux de texte l'est (désignation dans un bloc, nom avec ses signes) */
  /* texte posé dans la case sans champ (morceaux en ligne) : on mesure le texte lui-même contre la largeur utile de la case */
  const txtW = el => { try { const rg = document.createRange(); rg.selectNodeContents(el); const cs = getComputedStyle(el); return rg.getBoundingClientRect().width > el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 1; } catch (e) { return false; } };
  const isCut = el => { if (el.matches(FLD) || over(el)) return over(el); return [...el.querySelectorAll("*")].some(x => !x.matches("input, button, svg, svg *") && x.clientWidth && over(x)) || txtW(el); };
  const txtOf = el => String(el.matches(FLD) ? el.value : el.textContent || "").replace(/\s+/g, " ").trim();
  /* 09/11 : le texte agrandi garde la forme du champ — fond de la première couche non transparente (champ, case, ligne, bloc) */
  /* couches semi-transparentes mélangées jusqu'à la première couche pleine : le fond affiché est celui qu'on voit vraiment */
  const bgOf = el => { const L = []; for (let x = el; x && x.nodeType === 1; x = x.parentElement) { const m = getComputedStyle(x).backgroundColor.match(/[\d.]+/g); if (!m) continue;
      const a = m.length > 3 ? +m[3] : 1; if (a > 0) L.push([+m[0], +m[1], +m[2], a]); if (a >= 1) break; }
    let c = document.documentElement.classList.contains("svi-nuit") ? [11, 18, 32] : [255, 255, 255];
    for (let i = L.length - 1; i >= 0; i--) { const [r, g, b, a] = L[i]; c = [r * a + c[0] * (1 - a), g * a + c[1] * (1 - a), b * a + c[2] * (1 - a)]; }
    return "rgb(" + c.map(Math.round).join(", ") + ")"; };
  let lastT = null, lastTt = 0;
  /* 09/11 (Ahmed) : 2e toucher = tout le contenu sélectionné, SANS bulle ; les actions passent par l'appui long */
  /* 09/11 (Ahmed) : case non modifiable — le 2e toucher ne colore rien (le cadre rouge suffit ; l'appui long copie) */
  const allSel = el => { document.querySelectorAll(".cell-all").forEach(x => x.classList.remove("cell-all")); };
  /* appui long : case modifiable (rouge) = COUPER, COPIER, COLLER, EFFACER ; case non modifiable (noire, lecture seule) = COPIER */
  const canEd = el => el.matches(FLD) && !el.disabled && !el.readOnly && !(window.__sviRO && el.closest(".bdg-d-page:not(.nvp)"));
  const setVal = (el, v) => { el.value = v; el.dispatchEvent(new InputEvent("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };
  /* 09/11 (Ahmed) : petit menu de l'application (forme du menu des cases) — chaque ligne à la hauteur d'une ligne du tableau, largeur selon le contenu */
  let LB = null; const lbOff = () => { if (LB) LB.style.display = "none"; }; window.__sviLbOff = () => lbOff();
  const lbBar = (el, html, act) => { if (!LB) { LB = document.createElement("div"); LB.id = "sviLpBar"; document.body.appendChild(LB); LB.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); }); }
    LB.innerHTML = html.join(""); const tr = el.closest("tr, .ins-li"), rh = Math.round(Math.max(18, Math.min(44, (tr || el).getBoundingClientRect().height))); LB.style.setProperty("--lph", rh + "px"); LB.style.display = "flex";
    const r = el.getBoundingClientRect(), h = LB.offsetHeight, w = LB.offsetWidth; let y = r.bottom + 4; if (y + h > innerHeight - 4) y = Math.max(4, r.top - h - 4);
    LB.style.left = Math.max(4, Math.min(innerWidth - w - 4, r.left)) + "px"; LB.style.top = y + "px";
    LB.onclick = e => { const b = e.target.closest("[data-lp]"); if (!b) return; e.preventDefault(); e.stopPropagation(); lbOff(); act(b.dataset.lp); }; };
  document.addEventListener("pointerdown", e => { if (LB && !LB.contains(e.target)) lbOff(); }, true);
  document.addEventListener("scroll", lbOff, true);
  let csSnap = []; document.addEventListener("pointerdown", () => { csSnap = [...document.querySelectorAll("td.svi-cs")].filter(x => x.offsetParent !== null); }, true);
  const lpMenu = el => { const sel = el.tagName === "TD" ? el.querySelector("select") : null, txt = sel ? (typeof sviSelLab === "function" ? sviSelLab(sel) : "") : txtOf(el), ed = sel ? !sel.disabled && !(window.__sviRO && el.closest(".bdg-d-page:not(.nvp)")) : canEd(el);
    /* une plage de cases a déjà sa barre (COPIER, COLLER, EFFACER) : un seul menu */
    { const td0 = el.closest("td"), SN = csSnap.filter(x => x.isConnected);
      if (td0 && SN.length > 1 && SN.includes(td0) && SN.every(x => x.matches("td.bdg-ied, td.nv-ed:not([data-edsel])"))) {   /* plage d'INTITULÉ / de cases des listes : le menu agit sur toute la plage */
        lbBar(td0, ['<button type="button" data-lp="copy">COPIER</button><button type="button" data-lp="paste">COLLER</button><div class="blk-sep"></div><button type="button" data-lp="clear" class="sb-del">EFFACER</button>'], async k => {
          if (k === "copy") { const t = SN.map(txtOf).join("\n"); try { await navigator.clipboard.writeText(t); } catch (er) {} window.__sviSelClip = t; if (typeof svToast === "function") svToast("COPIÉ.", 1500, td0); return; }
          if (SN.every(x => x.matches("td.bdg-ied")) && window.__sviIedApply) window.__sviIedApply(k, SN); else if (window.__sviNvEdApply) window.__sviNvEdApply(k, SN); }); return; }
      const c = el.closest("td.svi-cs"); if (c && [...document.querySelectorAll("td.svi-cs")].filter(x => x.offsetParent !== null).length > 1) { if (window.__sviSelBar) window.__sviSelBar(); return; } }
    /* 09/11 : INTITULÉ d'un budget en instance dans la liste (case modifiable sans champ) = COPIER, COLLER, EFFACER */
    if (el.matches && el.matches("td.nv-ed:not([data-edsel])") && window.__sviNvEdApply) { lbBar(el, ['<button type="button" data-lp="copy">COPIER</button><button type="button" data-lp="paste">COLLER</button><div class="blk-sep"></div><button type="button" data-lp="clear" class="sb-del">EFFACER</button>'], async k => {
        if (k === "copy") { try { await navigator.clipboard.writeText(txtOf(el)); } catch (er) {} window.__sviSelClip = txtOf(el); if (typeof svToast === "function") svToast("COPIÉ.", 1500, el); } else window.__sviNvEdApply(k, [el]); }); return; }
    if (el.matches && el.matches("td.bdg-ied") && window.__sviIedApply) { lbBar(el, ['<button type="button" data-lp="copy">COPIER</button><button type="button" data-lp="paste">COLLER</button><div class="blk-sep"></div><button type="button" data-lp="clear" class="sb-del">EFFACER</button>'], async k => {
        if (k === "copy") { try { await navigator.clipboard.writeText(txtOf(el)); } catch (er) {} window.__sviSelClip = txtOf(el); if (typeof svToast === "function") svToast("COPIÉ.", 1500, el); } else { const SI = [...document.querySelectorAll("td.svi-cs.bdg-ied")].filter(x => x.offsetParent !== null); window.__sviIedApply(k, SI.includes(el) ? SI : [el]); } }); return; }
    if (window.__sviCells && window.__sviCells.count() > 1 && (el.closest("td.svi-cs") || (el.closest(".ins-li") && el.closest(".ins-li").querySelector(".svi-ls")))) return;
    if (!LB) { LB = document.createElement("div"); LB.id = "sviLpBar"; document.body.appendChild(LB);
      LB.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); }); }
    LB.innerHTML = ed ? (sel ? "" : '<button type="button" data-lp="cut">COUPER</button>') + '<button type="button" data-lp="copy">COPIER</button><button type="button" data-lp="paste">COLLER</button><div class="blk-sep"></div><button type="button" data-lp="clear" class="sb-del">EFFACER</button>' : '<button type="button" data-lp="copy">COPIER</button>';
    const tr = el.closest("tr, .ins-li"), rh = Math.round(Math.max(18, Math.min(44, (tr || el).getBoundingClientRect().height)));
    LB.style.setProperty("--lph", rh + "px"); LB.style.display = "flex";
    const r = el.getBoundingClientRect(), h = LB.offsetHeight, w = LB.offsetWidth; let y = r.bottom + 4; if (y + h > innerHeight - 4) y = Math.max(4, r.top - h - 4);
    LB.style.left = Math.max(4, Math.min(innerWidth - w - 4, r.left)) + "px"; LB.style.top = y + "px";
    LB.onclick = async e => { const b = e.target.closest("[data-lp]"); if (!b) return; e.preventDefault(); e.stopPropagation(); const k = b.dataset.lp; lbOff();
      const say = m => { if (typeof svToast === "function") svToast(m, 1500, el); };
      /* liste de choix : COLLER = le choix dont le nom correspond au texte copié ; EFFACER = aucun choix */
      if (sel && (k === "paste" || k === "clear")) { let v = ""; if (k === "paste") { try { v = await navigator.clipboard.readText(); } catch (er) {} if (!v) v = window.__sviSelClip || ""; }
        const U = String(v || "").trim().toUpperCase(), o = k === "clear" ? [...sel.options].find(x => !x.value) : [...sel.options].find(x => String(x.textContent || "").trim().toUpperCase() === U);
        if (!o) { say("RIEN À COLLER : AUCUN CHOIX NE CORRESPOND."); return; } sel.value = o.value; if (typeof sviSelSync === "function") sviSelSync(sel);
        sel.dispatchEvent(new Event("input", { bubbles: true })); sel.dispatchEvent(new Event("change", { bubbles: true })); return; }
      if (k === "copy" || k === "cut") { try { await navigator.clipboard.writeText(txt); } catch (er) {} window.__sviSelClip = txt; if (k === "cut") setVal(el, ""); say(k === "cut" ? "COUPÉ." : "COPIÉ."); }
      else if (k === "paste") { let v = ""; try { v = await navigator.clipboard.readText(); } catch (er) {} if (!v) v = window.__sviSelClip || ""; setVal(el, String(v || "").toUpperCase()); }
      else if (k === "clear") setVal(el, "");
      el.classList.remove("cell-all"); }; };
  /* 09/11 (Ahmed) : 3e toucher sur une case déjà en saisie = le curseur se place là où on touche, et c'est tout (jamais la bulle de Safari) */
  /* 09/11 (Ahmed, règle 8.2) : CHAMP OUVERT DANS UNE CASE — tout est géré par l'application, jamais par Safari :
     toucher = curseur à l'endroit touché ; glisser = le curseur suit ; double toucher = un mot ; 2e toucher d'ouverture = tout le contenu ;
     une sélection montre DEUX POIGNÉES (taille de celles de Safari, zone de prise large) qu'on tire pour l'élargir, et le menu de l'application
     (COUPER, COPIER, COLLER, EFFACER) qui agit sur le texte sélectionné. */
  { let T3 = null, T2 = null; const cv = document.createElement("canvas").getContext("2d");
    const geo = i => { const cs = getComputedStyle(i), r = i.getBoundingClientRect(); cv.font = cs.font; const v = String(i.value || "");
      const pl = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth), pr = parseFloat(cs.paddingRight) + parseFloat(cs.borderRightWidth), w = r.width - pl - pr;
      const ls = parseFloat(cs.letterSpacing) || 0, W = k => cv.measureText(v.slice(0, k)).width + ls * k, tw = W(v.length);
      const off = cs.textAlign === "right" || cs.textAlign === "end" ? Math.max(0, w - tw) : cs.textAlign === "center" ? Math.max(0, (w - tw) / 2) : 0;
      return { r, v, pl, pr, w, W, tw, off, ls }; };
    const caretAt = (i, x) => { const g = geo(i);
      if (x >= g.r.right - g.pr - 10 && g.tw + g.ls > g.w + i.scrollLeft - 2) return g.v.length;   /* bord droit = la fin, même si le texte dépasse */
      const px = x - g.r.left - g.pl - g.off + i.scrollLeft; let best = 0, bd = 1e9; for (let k = 0; k <= g.v.length; k++) { const d = Math.abs(g.W(k) - px); if (d < bd) { bd = d; best = k; } } return best; };
    const xOf = (i, k) => { const g = geo(i); return g.r.left + g.pl + g.off + g.W(k) - i.scrollLeft; };
    const inCell = t => t && t.matches && t.matches(FLD) && t.closest("table tbody td, .ins-hcol .ins-li, .bdg-h-col .bdg-h-item");
    /* poignées et menu de la sélection */
    let HA = null, HB = null, SB = null, HI = null, cur = null, V = null, own = false;
    /* sélection DESSINÉE par l'application : le champ ne garde qu'un curseur, Safari n'a donc rien à montrer */
    const setV = (i, a, b) => { try { const L = window.__sviTxtLog = window.__sviTxtLog || []; L.push({ t: Date.now(), a, b, ptT0, age: Date.now() - ptAt, mDown, src: (new Error().stack || "").split("\n").slice(2, 4).map(z => z.trim()).join(" < ") }); if (L.length > 20) L.shift(); } catch (er) {}   /* trace pour l'agent de test */
      a = Math.max(0, Math.min(a, b)); b = Math.max(a, b); V = a === b ? null : { i, a, b }; own = true; try { i.setSelectionRange(b, b); } catch (er) {} setTimeout(() => { own = false; }, 0); };
    const getS = i => V && V.i === i ? [V.a, V.b] : [i.selectionStart, i.selectionEnd];
    const mk = cls => { const d = document.createElement("div"); d.className = "svi-th " + cls; d.innerHTML = '<i></i>'; document.body.appendChild(d); return d; };
    const hide = () => { [HA, HB, SB, HI].forEach(x => { if (x) x.style.display = "none"; }); cur = null; V = null; };
    const place = () => { const i = cur; const S = i ? getS(i) : null; if (!i || !i.isConnected || document.activeElement !== i || S[0] === S[1]) { hide(); return; }
      if (!HA) { HA = mk("svi-th-a"); HB = mk("svi-th-b"); [HA, HB].forEach(h => h.addEventListener("pointerdown", dragH, { passive: false }));
        SB = document.createElement("div"); SB.id = "sviTxtBar"; document.body.appendChild(SB); /* toucher le menu ne quitte jamais le champ : rien ne prend le focus, l'action part au lâcher */
        SB.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); }); SB.addEventListener("mousedown", e => { e.preventDefault(); e.stopPropagation(); });
        SB.addEventListener("touchstart", e => { e.preventDefault(); e.stopPropagation(); }, { passive: false }); SB.addEventListener("pointerup", act); SB.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); }); HI = document.createElement("div"); HI.id = "sviTxtHi"; document.body.appendChild(HI); }
      const r = i.getBoundingClientRect(), a = Math.max(r.left, Math.min(r.right, xOf(i, S[0]))), b = Math.max(r.left, Math.min(r.right, xOf(i, S[1]))), h = Math.max(14, r.height - 6);
      if (V) Object.assign(HI.style, { display: "block", left: a + "px", top: (r.top + 3) + "px", width: Math.max(1, b - a) + "px", height: h + "px" }); else HI.style.display = "none";
      Object.assign(HA.style, { display: "block", left: a + "px", top: (r.top + 3) + "px", height: h + "px" }); Object.assign(HB.style, { display: "block", left: b + "px", top: (r.top + 3) + "px", height: h + "px" });
      const ro = i.readOnly || i.disabled;
      SB.innerHTML = (ro ? "" : '<button type="button" data-tx="cut">COUPER</button>') + '<button type="button" data-tx="copy">COPIER</button>' + (ro ? "" : '<button type="button" data-tx="paste">COLLER</button><button type="button" data-tx="clear" class="sb-del">EFFACER</button>');
      SB.style.setProperty("--lph", Math.round(Math.max(18, Math.min(44, r.height))) + "px"); SB.style.display = "flex";
      const sh = SB.offsetHeight, sw = SB.offsetWidth; let y = r.top - sh - 8; if (y < 60) y = r.bottom + 8;
      SB.style.left = Math.max(4, Math.min(innerWidth - sw - 4, (a + b) / 2 - sw / 2)) + "px"; SB.style.top = y + "px"; };
    const show = i => { cur = i; requestAnimationFrame(place); };
    const dragH = e => { e.preventDefault(); e.stopPropagation(); const i = cur, isA = e.currentTarget === HA; if (!i) return; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) {}
      SB.style.display = "none"; const S0 = getS(i), fixed = isA ? S0[1] : S0[0];
      const mv = ev => { ev.preventDefault(); const r = i.getBoundingClientRect(); if (ev.clientX > r.right - 14) i.scrollLeft += 8; else if (ev.clientX < r.left + 14) i.scrollLeft = Math.max(0, i.scrollLeft - 8);
        const k = caretAt(i, ev.clientX); setV(i, Math.min(k, fixed), Math.max(k, fixed)); place(); SB.style.display = "none"; };
      const up = () => { e.currentTarget && e.currentTarget.releasePointerCapture && 0; document.removeEventListener("pointermove", mv, true); document.removeEventListener("pointerup", up, true); document.removeEventListener("pointercancel", up, true); place(); };
      document.addEventListener("pointermove", mv, true); document.addEventListener("pointerup", up, true); document.addEventListener("pointercancel", up, true); };
    const act = async e => { const b = e.target.closest("[data-tx]"); if (!b || !cur) return; e.preventDefault(); e.stopPropagation(); const i = cur, S = getS(i), a = S[0], z = S[1], v = String(i.value || ""), sel = v.slice(a, z), k = b.dataset.tx; V = null;
      const put = t => { i.value = v.slice(0, a) + t + v.slice(z); const c = a + t.length; i.setSelectionRange(c, c); i.__svDirty = true; i.dispatchEvent(new InputEvent("input", { bubbles: true })); };
      if (k === "copy") { window.__sviSelClip = sel; try { await navigator.clipboard.writeText(sel); } catch (er) {} if (typeof svToast === "function") svToast("COPIÉ.", 1400, i);
        if (document.activeElement !== i) i.focus({ preventScroll: true }); setV(i, a, z); show(i); return; }   /* COPIER : le champ reste ouvert, la sélection reste */
      if (k === "cut") { window.__sviSelClip = sel; try { await navigator.clipboard.writeText(sel); } catch (er) {} put(""); if (typeof svToast === "function") svToast("COUPÉ.", 1400, i); }
      else if (k === "paste") { let t = ""; try { t = await navigator.clipboard.readText(); } catch (er) {} if (!t) t = window.__sviSelClip || ""; put(String(t).replace(/[\r\n]+/g, " ").toUpperCase()); }
      else if (k === "clear") put("");
      if (document.activeElement !== i) i.focus({ preventScroll: true }); const c = i.selectionStart; hide(); try { i.setSelectionRange(c, c); } catch (er) {} };   /* le champ reste ouvert, curseur à la place du texte */
    /* au toucher, toute vraie sélection posée dans un champ ouvert (select(), 2e toucher d'un autre module…) devient la sélection dessinée : jamais les poignées bleues de Safari */
    /* 10/11 : souris = les poignées ne prennent plus la souris (la sélection à la souris reste celle de l'ordinateur) ; doigt = poignées actives */
    { const pt = e => document.documentElement.classList.toggle("svi-ptm", e.pointerType === "mouse"); document.addEventListener("pointermove", pt, true); document.addEventListener("pointerdown", pt, true); }
    let mDown = false; document.addEventListener("mousedown", () => { mDown = true; }, true); document.addEventListener("mouseup", () => { setTimeout(() => { mDown = false; }, 0); }, true);
    let ptT0 = false, ptAt = 0; const ptTs = () => ptT0 && Date.now() - ptAt < 1200;   /* doigt récent seulement : une sélection faite plus tard (souris, code) reste celle de l'ordinateur */
    Object.defineProperty(window, "__sviPtT", { get: ptTs, configurable: true });
    document.addEventListener("mousedown", e => { if (!e.sourceCapabilities || !e.sourceCapabilities.firesTouchEvents) { if (Date.now() - ptAt > 800) ptT0 = false; } }, true);
    document.addEventListener("pointerdown", e => { ptT0 = e.pointerType === "touch" || e.pointerType === "pen"; ptAt = Date.now();
      /* toucher ailleurs (autre case, autre champ) = la sélection d'avant disparaît, poignées et menu compris */
      const t = e.target; if (cur && t !== cur && !(t.closest && t.closest(".svi-th, #sviTxtBar"))) hide();
      if (e.pointerType === "mouse" && !(t.closest && t.closest(".svi-th, #sviTxtBar"))) { V = null; if (cur && t === cur) hide(); } }, true);
    document.addEventListener("selectionchange", () => { const i = document.activeElement; if (own || !ptTs() || mDown || !inCell(i) || i.selectionStart === i.selectionEnd) return; setV(i, i.selectionStart, i.selectionEnd); show(i); });
    document.addEventListener("selectionchange", () => { if (!cur || document.activeElement !== cur) return; if (V && !own && (cur.selectionStart !== V.b || cur.selectionEnd !== V.b)) V = null; requestAnimationFrame(place); });
    /* frappe, collage, effacement au clavier : remplacent la sélection dessinée, comme une vraie sélection */
    document.addEventListener("beforeinput", e => { const i = e.target; if (!V || V.i !== i || !e.cancelable) return; const t = e.inputType || "";
      let ins = null; if (t === "insertText" || t === "insertReplacementText") ins = e.data || ""; else if (t.startsWith("delete")) ins = ""; else if (t === "insertFromPaste") ins = (e.dataTransfer && e.dataTransfer.getData("text/plain")) || e.data || ""; if (ins === null) return;
      e.preventDefault(); const v = String(i.value || ""), a = V.a, b = V.b; ins = String(ins).replace(/[\r\n]+/g, " "); if (getComputedStyle(i).textTransform === "uppercase" || i.dataset.up !== undefined) ins = ins.toUpperCase();
      hide(); i.value = v.slice(0, a) + ins + v.slice(b); const c = a + ins.length; i.setSelectionRange(c, c); i.__svDirty = true; i.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: t, data: ins })); }, true);
    /* 10/11 : une valeur remplacée par l'application (sélection dessinée) n'est pas vue par le navigateur, qui n'envoie alors pas « change » en quittant le champ :
       l'application l'envoie elle-même (une seule fois ; rien si le navigateur l'a déjà envoyé) */
    document.addEventListener("change", e => { if (e.isTrusted && e.target) e.target.__svDirty = false; }, true);
    const flush = i => { if (!i || !i.__svDirty) return; i.__svDirty = false; i.dispatchEvent(new Event("change", { bubbles: true })); };
    document.addEventListener("focusout", e => flush(e.target), true);
    document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target && e.target.__svDirty && !e.target.matches("textarea")) flush(e.target); }, true);
    document.addEventListener("focusout", e => { if (e.target === cur) setTimeout(() => { if (document.activeElement !== cur) hide(); }, 0); }, true);
    document.addEventListener("input", e => { if (e.target === cur && e.inputType && !V) hide(); }, true);
    document.addEventListener("scroll", () => { if (cur) requestAnimationFrame(place); }, true);
    /* 2e toucher d'ouverture : la case passe en saisie, TOUT le contenu sélectionné, sans menu de Safari */
    let pdNav = false; document.addEventListener("pointerdown", e => { const t = e.target; pdNav = !!(t && t.classList && t.classList.contains("svi-nav")); }, true);
    document.addEventListener("focusout", e => { if (e.target && e.target.__ro2) e.target.__ro2 = false; }, true);
    document.addEventListener("touchstart", e => { const t = e.target; T3 = null; T2 = null; if (e.touches.length !== 1 || !inCell(t) || t !== document.activeElement) return;
      if (pdNav) { if (t.readOnly || t.disabled) return; e.preventDefault(); T2 = t; return; }
      if ((t.readOnly || t.disabled) && !t.__ro2) { e.preventDefault(); T2 = t; return; }   /* case en lecture seule : 2e toucher = tout le contenu, menu COPIER */
      if (t.classList.contains("svi-nav")) return;
      e.preventDefault(); T3 = { t, x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: false, capture: true });
    document.addEventListener("touchmove", e => { if (!T3 || e.touches.length !== 1) return; e.preventDefault(); const i = T3.t, x = e.touches[0].clientX, r = i.getBoundingClientRect();
      if (x > r.right - 18) i.scrollLeft += 10; else if (x < r.left + 18) i.scrollLeft = Math.max(0, i.scrollLeft - 10);
      try { const k = caretAt(i, x); i.setSelectionRange(k, k); if (k >= String(i.value || "").length) i.scrollLeft = i.scrollWidth; } catch (er) {} hide(); }, { passive: false, capture: true });
    let lastT3 = null;
    document.addEventListener("touchend", e => {
      if (T2 && (T2.readOnly || T2.disabled)) { const i = T2; T2 = null; i.__ro2 = true; setV(i, 0, String(i.value || "").length); show(i); return; }
      if (T2) { const i = T2; T2 = null; try { if (window.__sviNav) window.__sviNav.off(i); i.__edit = true; i.blur(); i.focus({ preventScroll: true }); setV(i, 0, String(i.value || "").length); } catch (er) {} show(i); return; }
      if (!T3) return; const c = e.changedTouches[0], P = T3; T3 = null;
      try { const k = caretAt(P.t, c.clientX), v = String(P.t.value || ""), now = Date.now();
        if (lastT3 && lastT3.t === P.t && now - lastT3.at < (SVI_G.dbl || 350) && Math.abs(c.clientX - lastT3.x) < 24) {
          let a = k, b = k; while (a > 0 && !/\s/.test(v[a - 1])) a--; while (b < v.length && !/\s/.test(v[b])) b++;
          if (a === b && b < v.length) { while (b < v.length && /\s/.test(v[b])) b++; a = b; while (b < v.length && !/\s/.test(v[b])) b++; }   /* entre deux mots : le mot qui suit */
          setV(P.t, a, b); lastT3 = null; show(P.t); return; }
        lastT3 = { t: P.t, at: now, x: c.clientX };
        P.t.setSelectionRange(k, k); if (k >= v.length) P.t.scrollLeft = P.t.scrollWidth; hide(); } catch (er) {} }, { passive: true, capture: true });
    /* ordinateur : sélection à la souris dans un champ ouvert = mêmes poignées et même menu */
    document.addEventListener("mouseup", e => { const t = e.target; if (inCell(t) && document.activeElement === t && !t.classList.contains("svi-nav")) setTimeout(() => { if (t.selectionStart !== t.selectionEnd) show(t); }, 0); }, true);
    { const sel0 = HTMLInputElement.prototype.select; HTMLInputElement.prototype.select = function () { if (ptTs() && !mDown && inCell(this) && document.activeElement === this) { setV(this, 0, String(this.value || "").length); show(this); return; } return sel0.apply(this, arguments); };
      const ssr0 = HTMLInputElement.prototype.setSelectionRange; HTMLInputElement.prototype.setSelectionRange = function (a, b) { if (!own && ptTs() && !mDown && a !== b && inCell(this) && document.activeElement === this) { setV(this, a, b); show(this); return; } return ssr0.apply(this, arguments); }; }
    window.__sviTxtSel = { show, hide }; }
  /* jamais la bulle de Safari (Copier / Rechercher la sélection) sur les cases des tableaux */
  document.addEventListener("selectstart", e => { const t = e.target && e.target.nodeType === 1 ? e.target : e.target && e.target.parentElement; if (t && t.closest && t.closest("table tbody td, .ins-hcol .ins-li") && !t.closest("input, textarea")) e.preventDefault(); }, true);
  document.addEventListener("pointerdown", e => { if (!e.target.closest || !e.target.closest(".cell-all, #sviEtatMenu")) document.querySelectorAll(".cell-all").forEach(x => x.classList.remove("cell-all")); }, true);
  const off = () => { if (TA && TA.ending) return; if (cur) { cur.classList.remove("cell-x"); cur.parentElement && cur.parentElement.classList.remove("row-x"); cur = null; } if (tip) { try { taEnd(); } catch (er) {} tip.remove(); tip = null; } };
  const show = el => { off(); if (el.matches(FLD)) { const r = el.getBoundingClientRect(); tip = document.createElement("div"); tip.id = "sviFullTip"; tip.textContent = txtOf(el);
      /* 09/11 (règle 6.9) : le texte entier s'affiche SUR le champ, à sa largeur exacte, sur plusieurs lignes — le champ semble s'agrandir vers le bas */
    const cs = getComputedStyle(el); Object.assign(tip.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", minHeight: r.height + "px", font: cs.font, color: cs.color, textAlign: cs.textAlign,
      paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight, letterSpacing: cs.letterSpacing, textTransform: cs.textTransform, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle, textDecoration: cs.textDecoration,
      color: cs.webkitTextFillColor && !/rgba\(0, 0, 0, 0\)/.test(cs.webkitTextFillColor) ? cs.webkitTextFillColor : cs.color, background: bgOf(el) }); document.body.appendChild(tip); tip.__el = el; tip.__t0 = Date.now(); tip.__y = r.top; tip.__x = r.left; return; }
    cur = el; el.classList.add("cell-x"); el.tagName === "TD" && el.parentElement.classList.add("row-x"); };
  document.addEventListener("pointerdown", e => { if (e.target && (e.target.id === "sviSelHandle" || (e.target.closest && e.target.closest("#sviLpBar, #sviSelBar, #sviFullTip, .svi-ta-h")))) return;   /* 09/11 : toucher le point ou un menu ne referme pas le texte agrandi */
    const el = cutTd(e.target); if ((cur && !cur.contains(e.target)) || (tip && (tip.__td ? !tip.contains(e.target) : (tip.__el !== el || document.activeElement === el)))) off();   /* 11/11 : un toucher hors du texte ouvert (hors du tableau compris) le referme */   /* 2e toucher sur le champ = saisie : le texte agrandi s'efface */ clearTimeout(tm); if (!el) return; x0 = e.clientX; y0 = e.clientY; t0 = Date.now();
    if (isCut(el)) window.__sviCutT = Date.now();   /* le message LECTURE SEULE se tait : le toucher sert à lire */
    tm = setTimeout(() => { tm = 0; lastT = null; lpMenu(el); }, SVI_G.lp); }, true);
  document.addEventListener("pointermove", e => { if (tm && Math.hypot(e.clientX - x0, e.clientY - y0) > SVI_G.drag) { clearTimeout(tm); tm = 0; } }, true);
  document.addEventListener("pointercancel", () => { clearTimeout(tm); tm = 0; }, true);
  document.addEventListener("pointerup", e => { const quick = !!tm; clearTimeout(tm); tm = 0; if (!quick || Math.hypot(e.clientX - x0, e.clientY - y0) > SVI_G.drag) return;
    const el0 = cutTd(e.target);
    /* 09/11 (règle 8.2) : 2e toucher sur une case qu'on ne modifie pas (listes, lecture seule) = tout son contenu sélectionné, prêt à copier */
    if (el0 && !e.target.closest("button, a, .bdg-reflink, input[type=checkbox], .lk-rd, .cf-btn, [data-why], td.bdg-ied, td.nv-ed, input.nv-edin")) {
      const ro = !el0.matches(FLD) || el0.disabled || el0.readOnly || !!(window.__sviRO && el0.closest(".bdg-d-page:not(.nvp)"));
      if (ro && lastT === el0 && Date.now() - lastTt < 8000) { lastT = null; allSel(el0); return; }
      lastT = el0; lastTt = Date.now(); } else lastT = null;
    /* 09/11 : champ déjà en saisie (3e toucher) = le curseur se place, rien d'autre (pas de texte agrandi) */
    if (el0 && el0.matches(FLD) && document.activeElement === el0 && !el0.classList.contains("svi-nav") && !el0.readOnly && !el0.disabled) return;
    /* 10/11 (Ahmed, document unique 2.10 complément) : NOM SOULIGNÉ COUPÉ — 1er toucher = le nom en entier (la case s'agrandit, deux lignes ou plus),
       2e toucher sur le même nom = sa fiche ; un nom entier ouvre sa fiche dès le 1er toucher */
    { const lk = e.target.closest(SVI_LK_CUT), td = lk && lk.closest("table tbody td");
      if (td && cur !== td && lkCut(lk, td)) { show(td); window.__sviCutT = Date.now(); eat = true; return; } }
    const el = el0; if (!el || el === cur || (tip && tip.__el === el) || e.target.closest("button, a, .ach-link, .nv-reflink, .bdg-reflink, .cf-btn, [data-why], .lk-rd, .ins-rd, .lot-fold, .ins-cb")) return; if (!isCut(el)) return;
    show(el); window.__sviCutT = Date.now();
    /* une case qui ouvre la pièce l'ouvre au 2e toucher ; un champ modifiable garde son 1er toucher */
    /* 09/11 : le toucher garde aussi son effet habituel (sélection, 2e toucher = modification) — plus rien n'est avalé */
    eat = false; }, true);
  document.addEventListener("pointerdown", () => { eat = false; }, true);
  /* 11/11 (Ahmed, validé, document unique 6.3) : TEXTE AGRANDI — tant qu'un texte coupé est agrandi (#sviFullTip), les touchers portent sur
     TOUT le texte agrandi, sur toutes ses lignes : 2e toucher = tout sélectionné (COPIER ; champ modifiable : saisie ouverte, COUPER / COPIER /
     COLLER / EFFACER) ; 3e toucher = sélection enlevée (champ modifiable : curseur à l'endroit touché) ; double toucher sur un mot = ce mot ;
     double toucher sur une case coupée = agrandi déjà tout sélectionné ; deux poignées pour élargir ou réduire ; toucher ailleurs = refermé
     (la saisie est enregistrée). Jamais la sélection de Safari. */
  const TA = { sel: null, down: null, lastT: 0, lastX: 0, lastY: 0, dirty: false, ed: false, on: false, hl: null, ha: null, hb: null };
  const taTxt = () => tip ? String(tip.textContent || "") : "";
  const taNode = () => { if (!tip.firstChild || tip.childNodes.length > 1 || tip.firstChild.nodeType !== 3) tip.textContent = taTxt().replace(/\n/g, " "); if (!tip.firstChild) tip.appendChild(document.createTextNode("")); return tip.firstChild; };
  const taRng = (a, b) => { const n = taNode(), L = n.length, r = document.createRange(); r.setStart(n, Math.max(0, Math.min(a, L))); r.setEnd(n, Math.max(0, Math.min(b, L))); return r; };
  const taAt = (x, y) => { let r = null; try { r = document.caretRangeFromPoint ? document.caretRangeFromPoint(x, y) : null; if (!r && document.caretPositionFromPoint) { const q = document.caretPositionFromPoint(x, y); if (q) { r = document.createRange(); r.setStart(q.offsetNode, q.offset); } } } catch (er) {}
    const L = taTxt().length; if (!r || !tip.contains(r.startContainer)) { const R = tip.getBoundingClientRect(); return y < R.top + 4 ? 0 : y > R.bottom - 4 ? L : x < R.left + R.width / 2 ? 0 : L; }
    return r.startContainer.nodeType === 3 ? Math.min(L, r.startOffset) : (r.startOffset ? L : 0); };
  const taWord = o => { const t = taTxt(), W = /[0-9A-Za-zÀ-ÿ'’._-]/; let a = o, b = o; while (a > 0 && W.test(t[a - 1])) a--; while (b < t.length && W.test(t[b])) b++; if (a === b && b < t.length) b++; return [a, b]; };
  const taHide = () => { [TA.hl, TA.ha, TA.hb].forEach(x => { if (x) x.style.display = "none"; }); if (TA.hl) TA.hl.innerHTML = ""; lbOff(); };
  const taCaret = o => { if (!TA.ed) return; try { const r = taRng(o, o), S = getSelection(); S.removeAllRanges(); S.addRange(r); } catch (er) {} };
  const taMenu = () => { const ed = TA.ed, H = ed ? ['<button type="button" data-lp="cut">COUPER</button><button type="button" data-lp="copy">COPIER</button><button type="button" data-lp="paste">COLLER</button><div class="blk-sep"></div><button type="button" data-lp="clear" class="sb-del">EFFACER</button>'] : ['<button type="button" data-lp="copy">COPIER</button>'];
    lbBar(tip, H, async k => { const [a, b] = TA.sel || [0, 0], t = taTxt(), part = t.slice(a, b);
      if (k === "copy" || k === "cut") { try { await navigator.clipboard.writeText(part); } catch (er) {} window.__sviSelClip = part; if (k === "copy") { if (typeof svToast === "function") svToast("COPIÉ.", 1500, tip); taDraw(); return; } }
      if (!ed) return; let v = ""; if (k === "paste") { try { v = await navigator.clipboard.readText(); } catch (er) {} if (!v) v = window.__sviSelClip || ""; v = String(v || "").replace(/\s+/g, " ").toUpperCase(); }
      taSet(t.slice(0, a) + v + t.slice(b), a + v.length); }); };
  const taDraw = () => { if (!tip) return; const sel = TA.sel; if (!sel || sel[0] === sel[1]) { taHide(); return; }
    if (!TA.hl) { TA.hl = document.createElement("div"); TA.hl.id = "sviTaHi"; document.body.appendChild(TA.hl); }
    const mk = c => { const d = document.createElement("div"); d.className = "svi-th svi-ta-h " + c; d.innerHTML = "<i></i>"; document.body.appendChild(d); d.addEventListener("pointerdown", taDrag); return d; };
    if (!TA.ha) TA.ha = mk("svi-th-a"); if (!TA.hb) TA.hb = mk("svi-th-b");
    const R = [...taRng(sel[0], sel[1]).getClientRects()].filter(q => q.width > 0.5); if (!R.length) { taHide(); return; }
    TA.hl.innerHTML = R.map(q => `<span style="left:${q.left}px;top:${q.top}px;width:${q.width}px;height:${q.height}px"></span>`).join(""); TA.hl.style.display = "block";
    const A = R[0], B = R[R.length - 1]; Object.assign(TA.ha.style, { display: "block", left: A.left + "px", top: A.top + "px", height: A.height + "px" }); Object.assign(TA.hb.style, { display: "block", left: B.right + "px", top: B.top + "px", height: B.height + "px" });
    taMenu(); };
  const taSel = (a, b) => { TA.sel = [Math.min(a, b), Math.max(a, b)]; if (TA.ed) taCaret(TA.sel[1]); taDraw(); };
  const taSet = (v, caret) => { tip.textContent = v; TA.sel = null; taHide(); const el = taEl(); if (el) { el.value = v; el.__svDirty = true; TA.dirty = true; } taCaret(caret); };
  function taDrag(e) { e.preventDefault(); e.stopPropagation(); const isA = this === TA.ha; const mv = ev => { if (!TA.sel) return; const o = taAt(ev.clientX, ev.clientY + (isA ? 6 : -6)); if (isA) TA.sel = [Math.min(o, TA.sel[1]), TA.sel[1]]; else TA.sel = [TA.sel[0], Math.max(o, TA.sel[0])]; taDraw(); };
    const up = () => { document.removeEventListener("pointermove", mv, true); document.removeEventListener("pointerup", up, true); document.removeEventListener("pointercancel", up, true); if (TA.sel && TA.ed) taCaret(TA.sel[1]); };
    document.addEventListener("pointermove", mv, true); document.addEventListener("pointerup", up, true); document.addEventListener("pointercancel", up, true); }
  /* ouverture : un champ modifiable devient la zone de saisie (le texte agrandi lui-même), sans jamais quitter l'affichage sur plusieurs lignes */
  const taEl = () => { const el = tip && tip.__el; if (el && el.isConnected) return el; let n = null; try { n = tip && tip.__key && window.sviCellFind ? window.sviCellFind(tip.__key) : null; } catch (er) {} if (n && tip) tip.__el = n; return n || el; };   /* le tableau a pu être redessiné */
  const taOpen = () => { if (TA.on || !tip) return; TA.on = true; TA.ed = !!(tip.__el && canEd(tip.__el)); TA.dirty = false; try { tip.__key = window.sviCellKey ? window.sviCellKey(tip.__el) : null; } catch (er) {}
    if (TA.ed) { tip.setAttribute("contenteditable", "true"); tip.setAttribute("spellcheck", "false"); tip.setAttribute("autocapitalize", "characters"); tip.classList.add("svi-ta-ed"); try { tip.focus({ preventScroll: true }); } catch (er) {} } };
  function taEnd() { if (!tip || TA.ending) return; TA.ending = true; try { taEnd0(); } finally { TA.ending = false; } }
  function taEnd0() { if (tip.__cb) { const cb = tip.__cb, ok = !TA.cancel, v = taTxt().replace(/\s+/g, " ").trim(); tip.__cb = null; taHide(); TA.sel = null; TA.on = false; TA.cancel = false;
      if (tip.isContentEditable) { tip.removeAttribute("contenteditable"); try { tip.blur(); } catch (er) {} } TA.ed = false; TA.dirty = false; if (tip.__td) { tip.__td.style.height = tip.__h0 || ""; tip.__td.classList.remove("svi-ta-src"); } try { cb(ok, v); } catch (er) {} return; }
    const el = taEl(); taHide(); TA.sel = null; TA.on = false; if (TA.ed && tip.isContentEditable) { tip.removeAttribute("contenteditable"); try { tip.blur(); } catch (er) {} }
    if (el && TA.dirty) { el.value = taTxt().replace(/\s+/g, " ").trim() ? taTxt().replace(/\n/g, " ") : ""; el.dispatchEvent(new InputEvent("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); el.__svDirty = false; } TA.dirty = false; TA.ed = false; }
  document.addEventListener("pointerdown", e => { const t = e.target.closest && e.target.closest("#sviFullTip"); TA.down = t && t === tip ? { x: e.clientX, y: e.clientY, t: Date.now() } : null; }, true);
  document.addEventListener("pointerup", e => { const d = TA.down; TA.down = null; if (!d || !tip || !(e.target.closest && e.target.closest("#sviFullTip"))) return; if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > SVI_G.drag) return;
    const now = Date.now(), dbl = now - TA.lastT < 350 && Math.hypot(e.clientX - TA.lastX, e.clientY - TA.lastY) < 24, young = now - (tip.__t0 || 0) < 450; TA.lastT = now; TA.lastX = e.clientX; TA.lastY = e.clientY;
    const o = taAt(e.clientX, e.clientY);
    if (young) { taOpen(); taSel(0, taTxt().length); return; }   /* double toucher sur une case coupée : agrandi et déjà tout sélectionné */
    if (dbl && TA.on) { taSel(...taWord(o)); return; }           /* double toucher sur un mot : ce mot */
    if (!TA.on) { taOpen(); taSel(0, taTxt().length); return; }  /* 2e toucher : tout le texte agrandi */
    if (TA.sel && TA.sel[0] !== TA.sel[1]) { TA.sel = null; taHide(); taCaret(o); return; }   /* 3e toucher : sélection enlevée */
    taCaret(o); }, true);
  /* saisie dans le texte agrandi : la sélection dessinée est remplacée ; une seule ligne de texte (ENTRÉE = enregistrer et refermer) */
  document.addEventListener("beforeinput", e => { if (!tip || e.target !== tip || !TA.ed) return; const t = taTxt();
    if (e.inputType === "insertParagraph" || e.inputType === "insertLineBreak") { e.preventDefault(); off(); return; }
    if (TA.sel && TA.sel[0] !== TA.sel[1]) { e.preventDefault(); const [a, b] = TA.sel; const ins = /^insert/.test(e.inputType) ? String(e.data || (e.dataTransfer && e.dataTransfer.getData("text")) || "").replace(/\s+/g, " ").toUpperCase() : ""; taSet(t.slice(0, a) + ins + t.slice(b), a + ins.length); } }, true);
  document.addEventListener("input", e => { if (!tip || e.target !== tip || !TA.ed) return; const S = getSelection(); let c = 0; try { const r = S.getRangeAt(0), pre = document.createRange(); pre.selectNodeContents(tip); pre.setEnd(r.endContainer, r.endOffset); c = pre.toString().length; } catch (er) {}
    const v = taTxt().replace(/\n/g, " "), up = v.toUpperCase(); if (tip.childNodes.length !== 1 || up !== v) { tip.textContent = up; taCaret(c); } TA.sel = null; taHide();
    const el = taEl(); if (el) { el.value = up; el.__svDirty = true; TA.dirty = true; } }, true);   /* enregistré à la fermeture (un redessin pendant la frappe perdrait le champ) */
  document.addEventListener("keydown", e => { if (tip && e.target === tip && e.key === "Escape") { e.preventDefault(); TA.cancel = true; off(); } }, true);
  /* 11/11 (Ahmed) : SAISIE D'UNE CASE DE LISTE OU DE BLOC SUR PLUSIEURS LIGNES — la case s'ouvre sur toute sa largeur, sur autant de lignes que le
     texte (la ligne du tableau grandit), tout le texte sélectionné ; mêmes gestes que le texte agrandi ; ENTRÉE / toucher ailleurs = enregistré, ÉCHAP = annulé */
  window.sviTaEdit = (td, v0, cb) => { off(); const r = td.getBoundingClientRect(), cs = getComputedStyle(td);
    tip = document.createElement("div"); tip.id = "sviFullTip"; tip.textContent = String(v0 ?? "");
    Object.assign(tip.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", minHeight: r.height + "px", font: cs.font, fontWeight: cs.fontWeight, textTransform: cs.textTransform, letterSpacing: cs.letterSpacing,
      color: cs.webkitTextFillColor && !/rgba\(0, 0, 0, 0\)/.test(cs.webkitTextFillColor) ? cs.webkitTextFillColor : cs.color, paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight, textAlign: "left", background: bgOf(td) });
    document.body.appendChild(tip); tip.__el = null; tip.__cb = cb; tip.__td = td; tip.__h0 = td.style.height; tip.__t0 = 0; tip.__y = r.top; tip.__x = r.left; td.classList.add("svi-ta-src");
    tip.__elFake = td; TA.on = true; TA.ed = true; TA.dirty = false; TA.cancel = false; tip.setAttribute("contenteditable", "true"); tip.setAttribute("spellcheck", "false"); tip.setAttribute("autocapitalize", "characters"); tip.classList.add("svi-ta-ed");
    try { tip.focus({ preventScroll: true }); } catch (er) {}
    const fit = () => { if (!tip || tip.__td !== td) return; const h = tip.getBoundingClientRect().height; td.style.height = Math.ceil(Math.max(h, r.height)) + "px"; };
    fit(); tip.addEventListener("input", () => requestAnimationFrame(fit));
    taSel(0, taTxt().length); return tip; };
  /* pas de sélection de Safari dans le texte agrandi : une sélection native devient la sélection dessinée */
  document.addEventListener("selectionchange", () => { if (!tip || !TA.on) return; const S = getSelection(); if (!S.rangeCount || S.isCollapsed) return; const r = S.getRangeAt(0); if (!tip.contains(r.startContainer)) return;
    const pre = document.createRange(); pre.selectNodeContents(tip); pre.setEnd(r.startContainer, r.startOffset); const a = pre.toString().length, b = a + r.toString().length; S.collapse(r.endContainer, r.endOffset); taSel(a, b); });
  window.__sviTa = TA;
  document.addEventListener("click", e => { if (!eat) return; eat = false; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }, true);
  /* 09/11 : le défilement que l'application fait elle-même juste après le toucher (case choisie, champ mis en vue) ne ferme pas le texte : il le suit ;
     ensuite, seul un vrai défilement du doigt (le champ bouge) le ferme */
  document.addEventListener("input", e => { if (tip && e.target === tip.__el) off(); }, true);
  /* champ ouvert en saisie (2e toucher) : le texte agrandi s'efface, le champ reste visible */
  document.addEventListener("focusin", e => { const t = e.target; if (!t || !t.matches || !t.matches(FLD)) return; setTimeout(() => { if (document.activeElement === t && !t.classList.contains("svi-nav") && !t.readOnly && !t.disabled) { off(); if (cur && cur.contains(t)) off(); } }, 0); }, true);
  document.addEventListener("scroll", () => { if (!tip) return; const r = (tip.__el || tip.__td).getBoundingClientRect(), moved = Math.abs(r.top - tip.__y) > 6 || Math.abs(r.left - tip.__x) > 6;
    if (TA.on) { tip.style.left = r.left + "px"; tip.style.top = r.top + "px"; tip.__y = r.top; tip.__x = r.left; taDraw(); return; }   /* 11/11 : en saisie ou sélection, le texte agrandi suit (clavier, défilement) */
    if (Date.now() - tip.__t0 < 700 || !moved) { tip.style.left = r.left + "px"; tip.style.top = r.top + "px"; if (Date.now() - tip.__t0 < 700) { tip.__y = r.top; tip.__x = r.left; } return; } off(); }, true);
  document.addEventListener("contextmenu", e => { if (cutTd(e.target)) e.preventDefault(); }, true);
}

/* 08/11 (correction G-3) : pas de menu du système à l'appui long sur un titre de colonne */
document.addEventListener("contextmenu", e => { if (e.target.closest && e.target.closest("table thead th") && !e.target.closest("input, textarea")) e.preventDefault(); }, true);
/* 08/11 (correction G-4) : DÉPLACER UNE COLONNE GARDE L'ÉCRAN STABLE — si l'ordre des titres a changé après le lâcher,
   le défilement (horizontal et vertical) du tableau et de la page est remis où il était */
{ let rec = null;
  const sig = tb => [...(tb.tHead && tb.tHead.rows[0] ? tb.tHead.rows[0].cells : [])].map(th => (th.querySelector(".cf-btn") || {}).dataset?.col || th.textContent.trim()).join("|");
  const scr = el => { const L = []; for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (p.scrollWidth > p.clientWidth + 1 || p.scrollHeight > p.clientHeight + 1) L.push(p); return L; };
  const find = () => { if (!rec) return null; if (rec.tb.isConnected) return rec.tb; return rec.key ? document.querySelector(`table[data-svcw="${CSS.escape(rec.key)}"]`) : null; };
  const fix = () => { const tb = find(); if (!tb || sig(tb) === rec.sig) return; const L = scr(tb);
    rec.S.forEach((v, i) => { const p = L[i]; if (p) { p.scrollLeft = v[0]; p.scrollTop = v[1]; } }); window.scrollTo(rec.wx, rec.wy); };
  document.addEventListener("pointerdown", e => { const th = e.target.closest && e.target.closest("table thead th"); if (!th) { rec = null; return; } const tb = th.closest("table");
    rec = { tb, key: tb.dataset.svcw || "", sig: sig(tb), S: scr(tb).map(p => [p.scrollLeft, p.scrollTop]), wx: window.scrollX, wy: window.scrollY }; }, true);
  document.addEventListener("pointerup", () => { if (!rec) return; const r0 = rec;
    if (rec.tb.isConnected) { rec.S = scr(rec.tb).map(p => [p.scrollLeft, p.scrollTop]); rec.wx = window.scrollX; rec.wy = window.scrollY; }   /* position au lâcher */ [0, 60, 200, 450].forEach(t => setTimeout(() => { if (rec === r0) fix(); }, t)); setTimeout(() => { if (rec === r0) rec = null; }, 500); }, true);
}

/* 09/11 (Ahmed, document unique 6.7) : le mot TOTAL (ou TOTAL PARTIEL) d'une ligne de total n'est plus en première colonne :
   il va dans la case juste avant le premier montant, collé à droite. Pour tous les tableaux, sans toucher au code de chacun. */
{ const NUM = /^-?[\d   ]+(,\d+)?\s*%?$/, LAB = /^TOTAL( PARTIEL)?$/;
  const fix = () => { document.querySelectorAll("table tfoot tr, table tr.bdg-d-total-row, table tr.caf-tot, table tr.cmp-tot, table tr.stot, table tr.nvp-tot").forEach(tr => {
      const C = [...tr.cells]; if (C.length < 2) return; const lab = C.find(c => LAB.test(String(c.textContent || "").trim()) && !c.querySelector("input, button, select")); if (!lab) return;
      const iL = C.indexOf(lab), iN = C.findIndex((c, i) => i > iL && NUM.test(String(c.textContent || "").trim()) && /\d/.test(c.textContent || "")); if (iN < 0) return;
      const prev = C[iN - 1]; if (prev === lab) { lab.style.textAlign = "right"; return; }
      if (String(prev.textContent || "").trim() || prev.querySelector("input, button, select")) return;
      prev.textContent = String(lab.textContent || "").trim(); prev.classList.add("svi-totlab"); lab.textContent = ""; }); };
  let q = 0; new MutationObserver(() => { if (!q) q = requestAnimationFrame(() => { q = 0; try { fix(); } catch (e) {} }); }).observe(document.documentElement, { childList: true, subtree: true });
  window.sviTotFix = fix; }

/* 10/11 (Ahmed) : LARGEUR OPTIMISÉE DES COLONNES — à la première ouverture d'un tableau (aucune largeur gardée pour lui sur cet appareil),
   chaque colonne prend la largeur de son plus long texte (titre ou lignes affichées) : au moins 64 px (6.1), au plus 360 px ; la largeur est
   ensuite gardée comme une largeur réglée à la main. ⋯ d'un tableau › LARGEUR OPTIMISÉE la recalcule ; DISPOSITION PAR DÉFAUT y ramène.
   Tableaux concernés : colonnes repérées (col[data-w="tableau.colonne"] ou table[data-svcw] + col[data-k]) ; colonnes d'outils (_…) inchangées. */
{
  const MIN = 64, MAX = 360, cv = document.createElement("canvas").getContext("2d");
  /* 11/11 (document unique 6.x) : largeurs posées par la largeur optimisée = disposition par défaut (une largeur tirée à la main en diffère) */
  const CWA_K = "svi_cw_auto_v1", cwaLoad = () => { try { return JSON.parse(localStorage.getItem(CWA_K) || "{}") || {}; } catch (e) { return {}; } };
  const cwAuto = W => { const A = cwaLoad(); Object.assign(A, W); try { localStorage.setItem(CWA_K, JSON.stringify(A)); } catch (e) {} };
  const keyOf = (t, c) => c.dataset.w || (t.dataset.svcw && c.dataset.k && !/^_/.test(c.dataset.k) ? t.dataset.svcw + "." + c.dataset.k : "");
  const NEWROW = "tr.ins-new, tr.rec-new, tr.bdg-newrow, tr.scn-new, tr.dly-new, tr.svi-empty-x";
  const txtOf = td => { const f = td.querySelector("input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, textarea");
    if (f) return f.tagName === "SELECT" ? ((f.options[f.selectedIndex] || {}).text || "") : String(f.value || f.placeholder || "");
    return String(td.innerText || td.textContent || "").replace(/\s+/g, " ").trim(); };
  const tw = (s, font) => { cv.font = font; return cv.measureText(s).width; };
  const grid = row => { const out = []; let i = 0; [...row.cells].forEach(c => { if (c.colSpan === 1) out[i] = c; i += c.colSpan || 1; }); return out; };
  /* mesure : rend { clé: largeur } pour les colonnes repérées, ou null (pas encore de ligne de données) */
  const measure = t => { const cols = [...t.querySelectorAll(":scope > colgroup > col")]; if (!cols.length || !t.tHead || !t.tBodies[0]) return null;
    const vis = [...t.tBodies[0].rows].filter(r => r.offsetParent !== null), rows = vis.slice(0, 200); if (!vis.some(r => !r.matches(NEWROW))) return null;   /* au moins une ligne de données ; la ligne CRÉER compte aussi dans la mesure */
    const hr = t.tHead.rows[t.tHead.rows.length - 1], H = grid(hr), W = {};
    cols.forEach((c, i) => { const k = keyOf(t, c); if (!k) return; let w = 0;
      const th = H[i]; if (th) { const cs = getComputedStyle(th), lab = th.querySelector(".cf-lab, .bdg-head-label, .cf-lt"), fb = th.querySelector(".cf-btn"), ls = getComputedStyle(lab || th);
        const lw = (tw(String((lab || th).textContent || "").trim(), ls.font) + (parseFloat(ls.letterSpacing) || 0) * String((lab || th).textContent || "").trim().length);
        w = lw + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + (fb ? fb.getBoundingClientRect().width + 12 : 0) + 14; }   /* titre jamais coupé */
      rows.forEach(r => { const td = grid(r)[i]; if (!td) return; const s = txtOf(td); if (!s) return; const cs = getComputedStyle(td.querySelector("input, select, textarea") || td);
        const tcs = getComputedStyle(td), first = td.querySelector("input, select, textarea, .sv-sel, span, b, div, button"), lo = first ? Math.max(parseFloat(tcs.paddingLeft), first.getBoundingClientRect().left - td.getBoundingClientRect().left) : parseFloat(tcs.paddingLeft);
        const pad = lo + parseFloat(tcs.paddingRight) + (td.querySelector("input, select, textarea") ? 14 : 0) + (td.querySelector("select, .sv-sel") ? 16 : 0) + 6;   /* retrait (titres, flèche) compris */
        w = Math.max(w, tw(s, cs.font) + (parseFloat(cs.letterSpacing) || 0) * s.length + pad + 8); });
      W[k] = Math.round(Math.max(MIN, Math.min(MAX, w))); });
    return Object.keys(W).length ? W : null; };
  const apply = (t, W) => { const cols = [...t.querySelectorAll(":scope > colgroup > col")]; cols.forEach(c => { const k = keyOf(t, c); if (k && W[k]) c.style.width = W[k] + "px"; });
    const H = grid(t.tHead.rows[t.tHead.rows.length - 1]), tot = cols.reduce((s, c, i) => c.classList.contains("svi-colh") || (H[i] && H[i].classList.contains("svi-colh")) ? s : s + (parseFloat(c.style.width) || (H[i] ? H[i].getBoundingClientRect().width : 0)), 0);   /* v1093 : colonnes masquées non comptées (sinon le surplus allait à la dernière colonne) */
    if (tot > 0) { t.style.width = tot + "px"; t.style.minWidth = tot + "px"; }
    /* zones de texte d'une ligne : hauteur recalculée à la nouvelle largeur (plus de ligne restée haute) */
    t.querySelectorAll("tbody textarea").forEach(ta => { if (!ta.style.height) return; ta.style.height = ""; if (ta.scrollHeight > ta.clientHeight + 2) ta.style.height = ta.scrollHeight + "px"; }); };
  const fit = (t, force) => { const cols = [...t.querySelectorAll(":scope > colgroup > col")], keys = cols.map(c => keyOf(t, c)).filter(Boolean); if (!keys.length) return false;
    const CW = cwLoad(); if (!force && keys.some(k => CW[k])) return false;   /* déjà réglé (à la main ou à une ouverture d'avant) */
    const W = measure(t); if (!W) return false; apply(t, W); grow(t, W); shrink(t, W); Object.assign(CW, W); cwSave(CW); cwAuto(W);
    setTimeout(() => { if (t.isConnected && grow(t, W)) { shrink(t, W); const C2 = cwLoad(); Object.assign(C2, W); cwSave(C2); cwAuto(W); } }, 700);   /* zones de texte ajustées après coup */
    return true; };
  /* le tableau reste dans la largeur de son bloc ou de sa liste (règles 6.11, DÉTAIL) : s'il déborde, les colonnes de texte long
     (désignation, détail, intitulé, nom, objet, tâche) rendent la place, jusqu'à 120 px au plus étroit */
  const LONG = /\.(designation|detail|des|intitule|nom|objet|tache|budget|txt|rtitle|rtext)$/;
  const shrink = (t, W) => { const box = t.closest(".novapp-budget-table-wrap, .bdg-d-scroll, .bdg-d-client-scroll, .rec-scroll, .ach-scroll, .frs-scroll, .bdg-d-block") || t.parentElement; if (!box) return;
    const avail = box.clientWidth - 4, tot = t.getBoundingClientRect().width; if (!(avail > 0) || tot <= avail) return;
    const L = Object.keys(W).filter(k => LONG.test(k) && W[k] > 72); if (!L.length) return;
    let over = tot - avail; const room = L.reduce((a, k) => a + (W[k] - 72), 0); if (room <= 0) return;
    L.forEach(k => { const cut = Math.min(W[k] - 72, Math.ceil(over * (W[k] - 72) / room)); W[k] -= cut; }); apply(t, W); };
  /* contrôle à l'écran : une case encore coupée ou passée à la ligne élargit sa colonne (3 passes au plus) ; rend true si une colonne a changé */
  const grow = (t, W) => { let any = false;
    for (let pass = 0; pass < 3; pass++) { const cols2 = [...t.querySelectorAll(":scope > colgroup > col")], rows = [...t.tBodies[0].rows].filter(r => r.offsetParent !== null).slice(0, 200);
      const base = Math.min(...rows.map(r => r.getBoundingClientRect().height).filter(h => h > 0), 999); let ch = false;
      cols2.forEach((c, i) => { const k = keyOf(t, c); if (!k || !W[k] || W[k] >= MAX) return; let add = 0;
        rows.forEach(r => { const td = grid(r)[i]; if (!td) return; const f = td.querySelector("input:not([type=checkbox]):not([type=radio]), textarea");
          if (td.getBoundingClientRect().height > base + 3 && txtOf(td)) add = Math.max(add, 24);   /* passée à la ligne (zone de texte, texte long) */
          else if (f && f.tagName === "INPUT" && f.scrollWidth > f.clientWidth + 1) add = Math.max(add, f.scrollWidth - f.clientWidth + 6);
          else if (!f && td.scrollWidth > td.clientWidth + 1) add = Math.max(add, td.scrollWidth - td.clientWidth + 6); });
        if (add) { W[k] = Math.min(MAX, W[k] + add); ch = true; } });
      if (!ch) break; any = true; apply(t, W); }
    return any; };
  window.sviCwFit = fit;
  /* v1093 : tableau plus étroit que sa liste (étiré à 100 %) — la place en plus va aux colonnes de texte, au prorata ; les colonnes d'outils
     (cases à cocher _cb, _del, _rd…) gardent leur largeur (28 px pour les cases) ; colonnes masquées ignorées. Largeurs gardées inchangées. */
  const spread = t => { const cols = [...t.querySelectorAll(":scope > colgroup > col")];
    cols.forEach(c => { if (c.dataset.cw0 !== undefined) { c.style.width = c.dataset.cw0; delete c.dataset.cw0; } });
    const vis = cols.filter(c => !c.classList.contains("svi-colh")); if (!vis.some(c => /^_/.test(c.dataset.k || ""))) return;
    if (vis.some(c => !/px$/.test(c.style.width || ""))) return;
    const sum = vis.reduce((a, c) => a + parseFloat(c.style.width), 0), extra = Math.floor(t.getBoundingClientRect().width - sum - 1); if (extra < 2) return;
    const tx = vis.filter(c => !/^_/.test(c.dataset.k || "")), base = tx.reduce((a, c) => a + parseFloat(c.style.width), 0); if (!tx.length || base <= 0) return;
    let left = extra; tx.forEach((c, i) => { const add = i === tx.length - 1 ? left : Math.floor(extra * parseFloat(c.style.width) / base); left -= add; c.dataset.cw0 = c.style.width; c.style.width = (parseFloat(c.style.width) + add) + "px"; }); };
  window.sviCwSpread = spread;
  let q = 0; const run = () => { q = 0; document.querySelectorAll("table:is([data-svcw], :has(> colgroup > col[data-w]))").forEach(t => { if (t.offsetParent !== null && !t.closest(".fmt-t")) { try { fit(t, false); } catch (e) {} try { spread(t); } catch (e) {} } }); };
  addEventListener("resize", () => { if (!q) q = setTimeout(run, 350); });
  const go = () => { if (!q) q = setTimeout(run, 350); };
  const start = () => new MutationObserver(go).observe(document.body, { childList: true, subtree: true });
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
  /* 11/11 (Ahmed, validé) : DISPOSITION PAR DÉFAUT n'apparaît dans le ⋯ que si la disposition de l'endroit a été changée
     (largeur tirée à la main, colonne masquée ou affichée, hauteur ou ordre des blocs du budget) ; la largeur optimisée compte comme défaut */
  const layDirty = host => { const CW = cwLoad(), A = cwaLoad(); let S = {}; try { S = colhLoad(); } catch (e) {}
    for (const t of host.querySelectorAll("table")) {
      for (const c of t.querySelectorAll(":scope > colgroup > col")) { const k = keyOf(t, c) || (t.dataset.svcw && c.dataset.k ? t.dataset.svcw + "." + c.dataset.k : ""); if (k && CW[k] && Math.abs(CW[k] - (A[k] || (/\._cb$/.test(k) ? 28 : 0))) > 1) return true; }
      { const S0 = (typeof coLoad === "function" ? coLoad() : {})[t.querySelector("thead .cf-btn[data-cf]")?.dataset.cf || t.dataset.svcw]; if (Array.isArray(S0) && S0.length) return true; }   /* ordre des colonnes changé */
      let id = null; try { const I = sviColhInfo(t); id = I && I.id; } catch (e) {} if (id && [S[id], S[id + "_i"], S[id + "_v"]].some(x => Array.isArray(x) && JSON.stringify(x) !== JSON.stringify(SVI_COLH_DEF[id] || []))) return true; }
    if (host.matches(".bdg-d-page") || host.querySelector(".bdg-d-page")) { let L = {}; try { L = layLoad(); } catch (e) {} if (!L.def && Object.keys(L).length) return true; }
    return false; };
  window.sviLayDirty = layDirty;
  new MutationObserver(() => { const m = document.getElementById("blkMenu"); if (!m || m.__laychk) return; m.__laychk = 1;
    const lay = [...m.querySelectorAll("button")].find(x => /DISPOSITION PAR DÉFAUT/.test(x.textContent || "")); if (!lay) return;
    const b0 = m.__btn && m.__btn.isConnected ? m.__btn : src && src.isConnected ? src : null;
    const host = (b0 && b0.closest(".bdg-d-page, .nvp, .novapp-list-shell, .view")) || document.querySelector(".view.active-view"); if (!host) return;
    let dirty = true; try { dirty = layDirty(host); } catch (e) {} if (dirty) return;
    lay.remove(); [...m.children].forEach((x, i, a) => { if (!x.classList.contains("blk-sep")) return; const p = x.previousElementSibling, n = x.nextElementSibling; if (!p || !n || n.classList.contains("blk-sep")) x.remove(); });
  }).observe(document.body || document.documentElement, { childList: true });
  /* ⋯ d'un bloc, d'une liste ou d'une fiche : LARGEUR OPTIMISÉE (tous les tableaux de l'endroit) */
  let src = null; document.addEventListener("pointerdown", e => { const b = e.target.closest && e.target.closest(".blk-more, [data-nvmore], .nvl-more, .bdg-more-btn, [data-blkmore]"); if (b) src = b; }, true);
  new MutationObserver(() => { const m = document.getElementById("blkMenu"); if (!m || m.__cwfit) return; const b0 = m.__btn || src; if (!b0 || !b0.closest) return; m.__cwfit = 1;
    const tabsOf = h => h ? [...h.querySelectorAll("table")].filter(t => t.offsetParent !== null && [...t.querySelectorAll(":scope > colgroup > col")].some(c => keyOf(t, c))) : [];
    const host = b0.isConnected ? b0.closest(".bdg-d-block, .nvp-blk, .ins-hcol, .novapp-list-shell, .svc-card, .doc-card") || b0.closest(".bdg-d-page, .nvp, .view") : null;
    /* v1090 : un ⋯ d'une liste cachée (autre écran) prend les tableaux de l'écran affiché, comme ses autres actions */
    let T = tabsOf(host); if (!T.length) T = tabsOf(document.querySelector(".view.active-view")); if (!T.length) return;
    /* v1090 : placé avec DISPOSITION PAR DÉFAUT (FERMER et SUPPRIMER restent en bas) */
    const lay = [...m.querySelectorAll("button")].find(x => /DISPOSITION PAR DÉFAUT/.test(x.textContent || ""));
    const H = `<button type="button" class="svi-cwfit"><i class="mi-sp"></i>LARGEUR OPTIMISÉE</button>`;
    const fe = [...m.querySelectorAll("button")].find(x => /^\s*FERMER\s*$/.test(x.textContent || "")), fp = fe && fe.previousElementSibling;
    if (lay) lay.insertAdjacentHTML("afterend", H);
    else if (fe && fp && fp.classList.contains("blk-sep")) fp.insertAdjacentHTML("beforebegin", `<div class="blk-sep"></div>` + H);   /* 11/11 : jamais après FERMER */
    else if (fe) fe.insertAdjacentHTML("beforebegin", H);
    else m.insertAdjacentHTML("beforeend", `<div class="blk-sep"></div>` + H);
    m.querySelector(".svi-cwfit").addEventListener("click", e => { e.stopPropagation(); let n = 0; T.forEach(t => { if (fit(t, true)) n++; }); m.remove(); if (typeof svToast === "function") svToast(n ? "LARGEUR OPTIMISÉE." : "RIEN À MESURER (TABLEAU VIDE).", 1800); });
  }).observe(document.body || document.documentElement, { childList: true });
}
