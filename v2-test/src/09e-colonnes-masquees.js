/* =========================================================
   v786 (prompt codage, point 2) : MASQUER / AFFICHER LES COLONNES — un seul mécanisme pour tous les tableaux.
   - Un tableau est reconnu par ses en-têtes (.cf-btn data-cf / data-col) ou, à défaut, par data-colh="clé" sur la table
     (les colonnes sont alors nommées par leur titre).
   - Choix gardé par tableau (svi_colh_v1) ; listes : choix séparé EN INSTANCE (_i) / VALIDÉS (_v).
   - Au moins une colonne reste affichée. Colonnes masquées par défaut : SVI_COLH_DEF.
   - Aperçu, export et copie suivent l'écran (screenCols, sviColhVis).
   ========================================================= */
const COLH_KEY = "svi_colh_v1";
const SVI_COLH_DEF = {};   /* { cléTableau: [colonnes masquées tant que l'utilisateur n'a rien choisi] } */
const colhLoad = () => { try { return JSON.parse(localStorage.getItem(COLH_KEY) || "{}") || {}; } catch (e) { return {}; } };
const colhSave = o => { try { localStorage.setItem(COLH_KEY, JSON.stringify(o)); } catch (e) {} };
const colhNorm = s => String(s || "").replace(/\s+/g, " ").trim().toUpperCase();
/* description d'un tableau affiché : clé, colonnes (index réel, clé, titre), colonnes masquées */
function sviColhInfo(table) {
  if (!table || !table.tHead || !table.tHead.rows[0]) return null;
  const tr = table.tHead.rows[0], b0 = tr.querySelector(".cf-btn[data-cf]");
  let t = b0 ? b0.dataset.cf : table.dataset.colh;
  if (!t) return null;
  if (table.tHead.rows.length > 1 && [...tr.cells].some(c => c.colSpan > 1)) return null;   /* en-tête sur deux lignes : exception */
  const sh = table.closest(".novapp-list-shell");
  const id = sh ? t + (table.classList.contains("nv-inst") || table.closest(".list-inst") ? "_i" : "_v") : t;
  let x = 0;
  const cols = [];
  [...tr.cells].forEach(th => {
    const b = th.querySelector(".cf-btn[data-col]");
    /* v788 (remarque 11) : le nom seul — sans le signe de pliage ni le compteur */
    const lab = (() => { const x = (th.querySelector(".cf-lab") || th).cloneNode(true); x.querySelectorAll(".fold-all, .svi-cnt, .ins-fold, .cf-btn, .col-rs").forEach(e => e.remove()); return colhNorm(x.textContent); })();
    const k = b ? b.dataset.col : (!b0 && lab && !th.querySelector("input") ? lab : null);
    if (k) cols.push({ i: x, k, lab: lab || k, th });
    x += th.colSpan || 1;
  });
  if (!cols.length) return null;
  const S = colhLoad(), keys = cols.map(c => c.k);
  let hid = (S[id] || SVI_COLH_DEF[t] || []).filter(k => keys.includes(k));
  if (hid.length >= keys.length) hid = hid.slice(0, keys.length - 1);
  return { t, id, cols, hid, n: x };
}
/* applique le masquage à un tableau (idempotent) */
function sviColhApply(table) {
  const I = sviColhInfo(table);
  table.querySelectorAll(".svi-colh").forEach(c => c.classList.remove("svi-colh"));
  table.querySelectorAll("[data-cs0]").forEach(c => { c.colSpan = +c.dataset.cs0; c.removeAttribute("data-cs0"); });
  if (table.dataset.w0) { table.style.width = table.dataset.w0; table.removeAttribute("data-w0"); }
  if (!I || !I.hid.length) return;
  const H = new Set(I.cols.filter(c => I.hid.includes(c.k)).map(c => c.i));
  let wOff = 0;
  table.querySelectorAll("colgroup").forEach(cg => { let x = 0;
    [...cg.children].forEach(col => { const sp = col.span || 1; if (sp === 1 && H.has(x)) { col.classList.add("svi-colh"); wOff += parseFloat(col.style.width) && /px$/.test(col.style.width) ? parseFloat(col.style.width) : 0; } x += sp; }); });
  [...table.rows].forEach(r => { let x = 0;
    [...r.cells].forEach(c => { const sp = c.colSpan || 1; let nh = 0; for (let j = x; j < x + sp; j++) if (H.has(j)) nh++;
      if (nh === sp) c.classList.add("svi-colh"); else if (nh) { c.dataset.cs0 = sp; c.colSpan = sp - nh; }
      x += sp; }); });
  if (wOff && /px$/.test(table.style.width || "")) { table.dataset.w0 = table.style.width; table.style.width = Math.max(120, parseFloat(table.style.width) - wOff) + "px"; }
}
/* index des colonnes affichées d'un tableau (aperçus, exports qui lisent l'écran) */
function sviColhVis(table) {
  const r = table && table.tHead && table.tHead.rows[0];
  if (!r) return [];
  return [...r.cells].map((c, i) => c.classList.contains("svi-colh") ? -1 : i).filter(i => i >= 0);
}
let colhRaf = 0;
function sviColhAll() {
  cancelAnimationFrame(colhRaf);
  colhRaf = requestAnimationFrame(() => {
    const S = colhLoad();
    if (!Object.keys(S).some(k => (S[k] || []).length) && !Object.keys(SVI_COLH_DEF).length && !document.querySelector(".svi-colh")) return;
    document.querySelectorAll("table").forEach(t => { if (t.closest("#sviMep, .mep-page")) return; if (t.tHead && (t.dataset.colh || t.tHead.querySelector(".cf-btn[data-cf]"))) sviColhApply(t); });
  });
}
new MutationObserver(muts => { if (muts.some(m => m.addedNodes.length)) sviColhAll(); }).observe(document.documentElement, { childList: true, subtree: true });
/* tableau concerné par un ⋯ : le premier tableau visible du bloc / de l'écran */
function sviColhTableNear(el) {
  const root = el && (el.closest(".nvp-blk, .bdg-d-block, .bdg-blk, [data-blk-box], .novapp-list-shell, #ach, section") || null);
  const scope = root || document;
  const T = [...scope.querySelectorAll("table")].filter(t => t.offsetParent && sviColhInfo(t));
  return T[0] || null;
}
/* v788 (remarque 17) : UNE seule entrée « MASQUER / AFFICHER LES COLONNES » — une seule fenêtre, toutes les colonnes,
   cochée = affichée, décochée = masquée ; au moins une reste cochée */
function sviColhItems(table) {
  const I = sviColhInfo(table);
  if (!I || I.cols.length < 2) return [];
  return [{ k: "__colwin", lab: "MASQUER / AFFICHER LES COLONNES" + (I.hid.length ? " (" + I.hid.length + " MASQUÉE" + (I.hid.length > 1 ? "S" : "") + ")" : "") }];
}
/* fenêtre commune : tableau des colonnes, une case par colonne (format des tableaux de l'application) */
function sviColhWin(table) {
  const I = sviColhInfo(table);
  if (!I) return;
  const d = sviWinNew();
  d.innerHTML = sviWinCard({ cls: "pv-card colh-card", close: "data-x", title: "MASQUER / AFFICHER LES COLONNES",
    body: `<div class="pv-scroll colh-list"><table class="bdg-d-table rec-table colh-t"><colgroup><col style="width:110px"><col></colgroup><thead><tr><th class="center colh-c">AFFICHÉE</th><th>COLONNE</th></tr></thead>
      <tbody>${I.cols.map(c => `<tr class="colh-r"><td class="center colh-c"><input type="checkbox" data-k="${esc(c.k)}"${I.hid.includes(c.k) ? "" : " checked"}></td><td>${esc(c.lab)}</td></tr>`).join("")}</tbody></table></div>
      <div class="colh-err" hidden></div>`,
    foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button>` });
  sviWinShow(d);
  const err = d.querySelector(".colh-err");
  d.addEventListener("click", e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
    const row = e.target.closest("tr.colh-r");
    if (row && !e.target.matches("input")) { const i = row.querySelector("input"); i.checked = !i.checked; }
    if (row) { const on = d.querySelectorAll(".colh-r input:checked").length; err.hidden = on > 0; err.textContent = on ? "" : "AU MOINS UNE COLONNE DOIT RESTER AFFICHÉE."; return; }
    if (!e.target.closest("[data-ok]")) return;
    const next = [...d.querySelectorAll(".colh-r input")].filter(i => !i.checked).map(i => i.dataset.k);
    if (next.length >= I.cols.length) { err.hidden = false; err.textContent = "AU MOINS UNE COLONNE DOIT RESTER AFFICHÉE."; return; }
    const S = colhLoad(); S[I.id] = next; colhSave(S);
    d.remove();
    document.querySelectorAll("table").forEach(t => { const J = t.tHead && sviColhInfo(t); if (J && J.id === I.id) sviColhApply(t); });
  });
}
function sviColhPick(a, table) {
  if (a === "__colwin" || a === "__colhide" || a === "__colshow") { sviColhWin(table); return true; }
  return false;
}
