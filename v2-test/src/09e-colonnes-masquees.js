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
    const lab = colhNorm((th.querySelector(".cf-lab") || th).textContent);
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
/* entrées du ⋯ : seulement MASQUER quand tout est affiché ; MASQUER et AFFICHER dès qu'une colonne est masquée */
function sviColhItems(table) {
  const I = sviColhInfo(table);
  if (!I || I.cols.length < 2) return [];
  const out = [{ k: "__colhide", lab: "MASQUER DES COLONNES…" }];
  if (I.hid.length) out.push({ k: "__colshow", lab: "AFFICHER DES COLONNES… (" + I.hid.length + ")" });
  return out;
}
/* fenêtre commune : liste à cocher */
function sviColhWin(table, mode) {
  const I = sviColhInfo(table);
  if (!I) return;
  const hide = mode === "hide";
  const L = I.cols.filter(c => hide ? !I.hid.includes(c.k) : I.hid.includes(c.k));
  if (!L.length) return;
  const d = sviWinNew();
  d.innerHTML = sviWinCard({ cls: "pv-card colh-card", close: "data-x", title: hide ? "MASQUER DES COLONNES" : "AFFICHER DES COLONNES",
    body: `<div class="pv-sub">${hide ? "COCHER LES COLONNES À MASQUER. AU MOINS UNE COLONNE RESTE AFFICHÉE." : "COCHER LES COLONNES À AFFICHER DE NOUVEAU."}</div>
      <div class="pv-scroll colh-list">${L.map(c => `<label class="colh-r"><input type="checkbox" data-k="${esc(c.k)}"><span>${esc(c.lab)}</span></label>`).join("")}</div>
      <div class="colh-err" hidden></div>`,
    foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>${hide ? "MASQUER" : "AFFICHER"}</button>` });
  sviWinShow(d);
  const err = d.querySelector(".colh-err");
  d.addEventListener("click", e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
    if (!e.target.closest("[data-ok]")) return;
    const K = [...d.querySelectorAll(".colh-r input:checked")].map(i => i.dataset.k);
    if (!K.length) { d.remove(); return; }
    const next = hide ? [...I.hid, ...K] : I.hid.filter(k => !K.includes(k));
    if (next.length >= I.cols.length) { err.hidden = false; err.textContent = "AU MOINS UNE COLONNE DOIT RESTER AFFICHÉE."; return; }
    const S = colhLoad(); S[I.id] = next; colhSave(S);
    d.remove();
    document.querySelectorAll("table").forEach(t => { const J = t.tHead && sviColhInfo(t); if (J && J.id === I.id) sviColhApply(t); });
  });
}
function sviColhPick(a, table) {
  if (a === "__colhide") { sviColhWin(table, "hide"); return true; }
  if (a === "__colshow") { sviColhWin(table, "show"); return true; }
  return false;
}
