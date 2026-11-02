/* =========================================================
   v798 : MOTEUR COMMUN DES FENÊTRES ET DES ÉCRANS D'ACHAT (document unique 6.4, 6.5, 8.6, 10.2)
   Appliqué tout seul, sans toucher au code de chaque fenêtre, à tout ce qui s'affiche dans les fenêtres
   (#svConf, #docPop) et dans l'écran des achats (#ach) :
   - liste déroulante de l'iPad (<select>) → bouton au format de l'application qui ouvre le menu commun
     (✓ devant le choix) ; la liste d'origine reste, cachée, et reçoit le choix (mêmes événements) ;
   - bouton « Choisir le fichier » de Safari → bouton CHOISIR UN FICHIER en majuscules et nom du fichier ;
   - bouton « + LIGNE » sous un tableau → ligne rouge CRÉER UNE LIGNE ICI… en bas du tableau (6.5) ;
   - ✕ au bout des lignes d'un tableau → case à droite et SUPPRIMER LES LIGNES COCHÉES (6.4) ;
   - pied des fenêtres : FERMER devient ANNULER quand la fenêtre a une action (10.2).
   Une liste, un fichier ou un bouton marqué data-native garde sa forme d'origine.
   ========================================================= */
const SVI_UP_SC = "#svConf, #docPop, #ach";
function sviSelLab(s) { const o = s.options[s.selectedIndex]; return o ? String(o.textContent || "").trim().toUpperCase() : ""; }
function sviSelSync(s) {
  const b = s.__svBtn;
  if (!b) return;
  b.querySelector(".sv-sel-t").textContent = sviSelLab(s);
  b.disabled = !!s.disabled;
}
function sviSelUp(s) {
  if (s.__svBtn || s.multiple || s.hasAttribute("data-native")) { if (s.__svBtn) sviSelSync(s); return; }
  const b = document.createElement("button");
  b.type = "button";
  b.className = "sv-sel";
  b.innerHTML = `<span class="sv-sel-t"></span><i class="sv-sel-a">▾</i>`;
  s.__svBtn = b;
  s.classList.add("sv-natsel");
  s.after(b);
  sviSelSync(s);
  b.addEventListener("click", e => {
    e.preventDefault(); e.stopPropagation();
    if (s.disabled) return;
    const items = [...s.options].filter(o => !o.disabled).map(o => ({ k: o.value, lab: String(o.textContent || "").trim().toUpperCase() || "—" }));
    sviEtatMenu(b, items, s.value, v => {
      s.value = v;
      sviSelSync(s);
      s.dispatchEvent(new Event("input", { bubbles: true }));
      s.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const m = document.getElementById("sviEtatMenu");
    if (m) { m.style.zIndex = "100020"; m.style.maxHeight = "60vh"; m.style.overflow = "auto"; }
  });
  s.addEventListener("change", () => sviSelSync(s));
}
function sviFileUp(f) {
  if (f.__svBtn || f.hasAttribute("data-native")) return;
  const w = document.createElement("span");
  w.className = "sv-file";
  w.innerHTML = `<button type="button" class="sv-file-b">CHOISIR UN FICHIER</button><span class="sv-file-n">AUCUN FICHIER CHOISI</span>`;
  f.__svBtn = w;
  f.classList.add("sv-natfile");
  f.after(w);
  const b = w.querySelector(".sv-file-b"), n = w.querySelector(".sv-file-n");
  b.disabled = !!f.disabled;
  b.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); if (!f.disabled) f.click(); });
  f.addEventListener("change", () => { const x = f.files && f.files[0]; n.textContent = x ? String(x.name).toUpperCase() : "AUCUN FICHIER CHOISI"; });
}
/* « + LIGNE » → ligne CRÉER … ICI en bas du tableau qui le précède */
function sviAddRowUp(btn) {
  if (btn.__svRow || btn.hasAttribute("data-native")) return;
  let t = btn.previousElementSibling;
  while (t && t.tagName !== "TABLE") t = t.previousElementSibling;
  if (!t || !t.tBodies[0]) return;
  const n = t.tHead && t.tHead.rows[0] ? [...t.tHead.rows[0].cells].reduce((a, c) => a + (c.colSpan || 1), 0) : 1;
  const tr = document.createElement("tr");
  tr.className = "rec-new sv-addrow";
  tr.innerHTML = `<td colspan="${n}">CRÉER UNE LIGNE ICI…</td>`;
  tr.addEventListener("click", () => btn.click());
  const tb = t.tBodies[0];
  [...tb.rows].forEach(r => { if (r.cells.length === 1 && /^AUCUNE? /.test(String(r.textContent || "").trim())) r.remove(); });
  tb.appendChild(tr);
  btn.__svRow = tr;
  btn.classList.add("sv-hidebtn");
}
/* ✕ au bout des lignes → case à droite ; SUPPRIMER LES LIGNES COCHÉES sous le tableau */
function sviRmUp(t) {
  if (t.__svRm) return;
  const xs = [...t.querySelectorAll("tbody button.ach-x[data-rml]")];
  if (!xs.length) return;
  t.__svRm = true;
  xs.forEach(x => {
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "sv-rmcb";
    cb.dataset.rml = x.dataset.rml;
    x.classList.add("sv-hidebtn");
    x.after(cb);
  });
  const bar = document.createElement("div");
  bar.className = "sv-rmbar";
  bar.innerHTML = `<button type="button" class="ach-b sv-rmall" disabled>SUPPRIMER LES LIGNES COCHÉES <span class="svi-cnt">0</span></button>`;
  t.after(bar);
  const del = bar.querySelector(".sv-rmall"), cnt = del.querySelector(".svi-cnt");
  t.addEventListener("change", e => { if (!e.target.matches(".sv-rmcb")) return; const n = t.querySelectorAll(".sv-rmcb:checked").length; del.disabled = !n; cnt.textContent = n; });
  del.addEventListener("click", e => {
    e.preventDefault();
    const root = t.closest(SVI_UP_SC) || document;
    const idx = [...t.querySelectorAll(".sv-rmcb:checked")].map(c => c.dataset.rml).sort((a, b) => +b - +a);
    /* chaque suppression redessine la fenêtre : on retrouve le ✕ suivant à chaque fois, du dernier au premier */
    idx.forEach(i => { const x = root.querySelector(`button.ach-x[data-rml="${i}"]`); if (x) x.click(); });
  });
}
function sviFootUp(f) {
  if (f.__svFoot) return;
  f.__svFoot = true;
  const bs = [...f.querySelectorAll("button")];
  const x = bs.find(b => b.hasAttribute("data-x") && /^FERMER$/.test(String(b.textContent || "").trim()));
  /* v799 : pas de « ANNULER » à côté de « ANNULER LA COMMANDE / LE PAIEMENT… » — FERMER est alors gardé, pour ne pas confondre */
  const twin = bs.some(b => b !== x && /^ANNULER\s/.test(String(b.textContent || "").trim()));
  if (x && bs.length > 1 && !twin) { x.textContent = "ANNULER"; f.prepend(x); }
}
function sviUpAll() {
  document.querySelectorAll(SVI_UP_SC).forEach(root => {
    root.querySelectorAll("select").forEach(sviSelUp);
    root.querySelectorAll('input[type="file"]').forEach(sviFileUp);
    root.querySelectorAll("button[data-addl]").forEach(sviAddRowUp);
    root.querySelectorAll("table").forEach(sviRmUp);
    root.querySelectorAll(".svc-f").forEach(sviFootUp);
  });
}
let sviUpRaf = 0;
new MutationObserver(muts => {
  if (!muts.some(m => m.addedNodes.length)) return;
  cancelAnimationFrame(sviUpRaf);
  sviUpRaf = requestAnimationFrame(sviUpAll);
}).observe(document.documentElement, { childList: true, subtree: true });
