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
  const id = t;   /* v796 (document unique 6.8) : un seul choix par tableau, listes EN INSTANCE et VALIDÉS comprises */
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
  let hid = (S[id] || S[id + "_v"] || S[id + "_i"] || SVI_COLH_DEF[t] || []).filter(k => keys.includes(k));
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
    const any = Object.keys(S).some(k => (S[k] || []).length) || Object.keys(SVI_COLH_DEF).length || document.querySelector(".svi-colh");
    document.querySelectorAll("table").forEach(t => { if (t.closest("#sviMep, .mep-page")) return; if (t.tHead && (t.dataset.colh || t.tHead.querySelector(".cf-btn[data-cf]"))) { sviColhReg(t); if (any) sviColhApply(t); } });
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
/* v926 (remarque 11 du 04/11/2026, document unique 6.8) : MASQUER LA COLONNE dans la loupe ; AFFICHER LES COLONNES MASQUÉES dans le ⋯ du bloc,
   avec le compteur — toutes réaffichées d'un coup pour ce tableau (ouvert à tous en attendant les droits) */
const sviColhSame = id => [...document.querySelectorAll("table")].filter(t => { const I = sviColhInfo(t); return I && I.id === id; });
function sviColhHide(table, key) {
  const I = sviColhInfo(table); if (!I || !I.cols.some(c => c.k === key)) return false;
  if (I.hid.includes(key)) return true;
  if (I.cols.length - I.hid.length <= 1) { svToast("UNE COLONNE AU MOINS RESTE AFFICHÉE.", 2500); return false; }
  const S = colhLoad(); S[I.id] = [...I.hid, key]; delete S[I.id + "_i"]; delete S[I.id + "_v"]; colhSave(S);
  sviColhSame(I.id).forEach(sviColhApply); return true;
}
function sviColhShowAll(table) {
  const I = sviColhInfo(table); if (!I) return false;
  const S = colhLoad(); S[I.id] = []; delete S[I.id + "_i"]; delete S[I.id + "_v"]; colhSave(S);
  sviColhSame(I.id).forEach(sviColhApply); return true;
}
function sviColhItems(table) {
  const I = sviColhInfo(table); if (!I || I.cols.length < 2 || !I.hid.length) return [];   /* rien de masqué : pas de ligne */
  const n = I.hid.length;
  return [{ k: "__colshow", lab: "AFFICHER LES COLONNES MASQUÉES — " + n + " COLONNE" + (n > 1 ? "S" : "") + " MASQUÉE" + (n > 1 ? "S" : "") }];
}
/* fenêtre commune : tableau des colonnes, une case par colonne (format des tableaux de l'application) */
function sviColhWin(table) { sviColhWinI(sviColhInfo(table)); }
function sviColhWinI(I) {
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
    if (typeof I.done === "function") I.done();
  });
}
function sviColhPick(a, table) {
  if (a === "__colshow") { const I = sviColhInfo(table); if (I && !I.hid.length) svToast("AUCUNE COLONNE MASQUÉE.", 2000); else sviColhShowAll(table); return true; }
  if (a === "__colwin" || a === "__colhide") { sviColhWin(table); return true; }
  return false;
}

/* v796 (document unique 6.8) : registre des tableaux vus à l'écran — PARAMÉTRAGE › FORMAT › COLONNES les liste tous
   (« INTERFACE › TABLEAU ») ; un tableau s'y inscrit la première fois qu'il est affiché */
const COLH_REG = "svi_colhreg_v1";
const colhRegLoad = () => { try { return JSON.parse(localStorage.getItem(COLH_REG) || "{}") || {}; } catch (e) { return {}; } };
const COLH_IF_LAB = { bdg: "BUDGET", bdgl: "LISTE DES BUDGETS", ach: "ACHATS", prm: "PARAMÉTRAGE", win: "FENÊTRES" };
function sviColhName(table) {
  const txt = el => { if (!el) return ""; const x = el.cloneNode(true); x.querySelectorAll(".svi-cnt, svg, button, input").forEach(e => e.remove()); return colhNorm(x.textContent).replace(/\s*\(.*\)\s*$/, ""); };
  const iface = (SVI_FMT_IF.find(x => x.sc.some(sel => table.closest(sel))) || {}).k;
  const blk = table.closest(".bdg-d-block, .nvp-blk");
  let name = "";
  if (blk && blk.id === "bdgTabBody") {
    const tab = document.querySelector("#bdgTabs .bdg-d-tab.active");
    const ttl = document.querySelector("#bdgDetailHead .ttl"), x = ttl && ttl.cloneNode(true); if (x) x.querySelectorAll(".dhead-sub").forEach(e => e.remove());
    name = (txt(x) || "DÉTAIL") + (tab ? " › " + txt(tab) : "");
  } else if (blk) {
    const tab = blk.querySelector(".rec-tab.active, .rec-tab.on, .nvp-tab.on");
    name = txt(blk.querySelector(".bdg-d-block-title .ttl")) + (tab ? " › " + txt(tab) : "");
  } else if (table.closest(".novapp-list-shell")) name = txt(table.closest(".novapp-list-shell").querySelector(".novapp-list-titlebar h1") || document.querySelector(".novapp-list-titlebar h1"));
  else if (table.closest("#svConf")) name = txt(table.closest("#svConf").querySelector(".svc-title, h2, h3"));
  return [COLH_IF_LAB[iface] || "", name].filter(Boolean).join(" › ");
}
let colhRegT = 0, colhRegP = null;
function sviColhReg(table) {
  if (!table.offsetParent) return;   /* onglet caché : inscrit quand il est ouvert (nom juste) */
  const I = sviColhInfo(table);
  if (!I || I.cols.length < 2) return;
  colhRegP = colhRegP || colhRegLoad();
  const R = colhRegP, old = R[I.id], cols = I.cols.map(c => [c.k, c.lab]);
  const lab = sviColhName(table) || (old && old.lab) || I.id.toUpperCase();
  if (old && old.lab === lab && JSON.stringify(old.cols) === JSON.stringify(cols)) return;
  R[I.id] = { lab, cols };
  clearTimeout(colhRegT);
  colhRegT = setTimeout(() => { try { localStorage.setItem(COLH_REG, JSON.stringify(R)); } catch (e) {} }, 300);
}
/* description d'un tableau d'après le registre (le tableau n'a pas besoin d'être à l'écran) */
function sviColhRegInfo(id) {
  const R = colhRegP || colhRegLoad(), E = R[id];
  if (!E) return null;
  const S = colhLoad(), keys = E.cols.map(c => c[0]);
  let hid = (S[id] || S[id + "_v"] || S[id + "_i"] || SVI_COLH_DEF[id] || []).filter(k => keys.includes(k));
  if (hid.length >= keys.length) hid = hid.slice(0, keys.length - 1);
  return { t: id, id, lab: E.lab, cols: E.cols.map(([k, lab]) => ({ k, lab })), hid };
}
function sviColhRegList() {
  const R = colhRegP || colhRegLoad();
  return Object.keys(R).map(sviColhRegInfo).filter(Boolean).sort((a, b) => a.lab.localeCompare(b.lab, "fr"));
}
document.addEventListener("click", () => setTimeout(() => document.querySelectorAll("table").forEach(t => { if (t.offsetParent && t.tHead && !t.closest("#sviMep, .mep-page") && (t.dataset.colh || t.tHead.querySelector(".cf-btn[data-cf]"))) sviColhReg(t); }), 400), true);
