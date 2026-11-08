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
  const pick = t => (t.closest && t.closest(TIP)) || cut(t);
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
  const begin = (t, x, y) => { const hdr = t && t.closest && t.closest(".bdg-d-sticky"), ach = hdr && hdr.closest(".nvp");
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
const sviRowKey = t => t.dataset.svcw || t.dataset.colh || t.dataset.ik || t.id || "";
function sviRowHApply() { let st = document.getElementById("sviRowHStyle"); if (!st) { st = document.createElement("style"); st.id = "sviRowHStyle"; (document.head || document.documentElement).appendChild(st); }
  const H = sviRowHGet(), q = v => String(v).replace(/["\\]/g, "\\$&");
  st.textContent = Object.keys(H).map(k => { const s = `table:is([data-svcw="${q(k)}"], [data-colh="${q(k)}"], [data-ik="${q(k)}"], [id="${q(k)}"]):not(#svi-z1):not(#svi-z2):not(#svi-z3) tbody tr:not(.ins-title):not(.nvp-gt) td`;
    return `${s} { height: ${H[k]}px !important; min-height: 0 !important; box-sizing: border-box !important; }`; }).join("\n"); }
sviRowHApply();
{ const zone = t => { if (!t || !t.closest) return null; if (t.closest("#dlyGantt, .dlyg-foot, .dlyg-l, .dly-table, .ghist, #svConf, #docPop")) return null;
    const td = t.closest("table tbody td"), tb = td && td.closest("table"); return tb && sviRowKey(tb) ? tb : null; };
  const set = (tb, h) => { const H = sviRowHGet(), k = sviRowKey(tb); H[k] = Math.round(Math.max(18, Math.min(60, h))); try { localStorage.setItem(SVI_ROWH_K, JSON.stringify(H)); } catch (e) {} sviRowHApply(); };
  const rowH = tb => { const td = tb.querySelector("tbody tr:not(.ins-title) td"); return td ? td.getBoundingClientRect().height : 21; };
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
