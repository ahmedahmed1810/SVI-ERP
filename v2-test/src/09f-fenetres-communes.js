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
    const idx = [...t.querySelectorAll(".sv-rmcb:checked")].map(c => c.dataset.rml).sort((a, b) => +String(b).split("|").pop() - +String(a).split("|").pop());
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
/* v930 (remarque 7 du 04/11/2026, document unique 10.2) : NOM DU CHAMP AU-DESSUS DU CHAMP, sur deux ou trois colonnes, dans toutes
   les fenêtres au format INF (#docPop : INF du budget, nouveau budget, avenant, documents, TAF, observations…) — chaque libellé et son champ
   forment une case ; ce qui n'est pas un champ (note, fichier) prend toute la largeur. Les fenêtres des achats l'ont déjà (NOUVELLE FACTURE). */
function sviGridTop(g) {
  if (!g || g.dataset.top) return; g.dataset.top = "1";
  const C = [...g.children];
  for (let i = 0; i < C.length; i++) {
    const c = C[i]; if (!c.matches(".doc-lab")) { c.classList.add("doc-span"); continue; }
    const cell = document.createElement("div"); cell.className = "doc-cell"; g.insertBefore(cell, c); cell.appendChild(c);
    const n = C[i + 1]; if (n && !n.matches(".doc-lab")) { cell.appendChild(n); i++; }
  }
}
/* champs des fenêtres des achats (#svConf) agrandissables par leur coin (même poignée que les fenêtres INF ; taille gardée par champ) */
function sviFldRszUp(i) {
  if (!i || i.__rsz || i.closest(".fld-wrap") || i.closest("table") || ["checkbox", "radio", "file", "color", "hidden"].includes(i.type)) return; i.__rsz = true;
  const lab = i.closest("label"), k = "fld.svc." + (i.dataset.k || i.dataset.f || i.id || ((lab && lab.querySelector("span")) || {}).textContent || "x").replace(/\s+/g, " ").trim();
  const wrap = document.createElement("span"); wrap.className = "fld-wrap svc-fw"; i.replaceWith(wrap); wrap.appendChild(i);
  const S = (() => { try { return psLoad()[k]; } catch (e) { return null; } })(); if (S && S.w) { wrap.style.width = S.w + "px"; wrap.classList.add("sized"); } if (S && S.h) i.style.height = S.h + "px";
  const hd = document.createElement("span"); hd.className = "fld-rsz"; hd.title = "Glisser pour régler la taille du champ"; wrap.appendChild(hd);
  hd.addEventListener("pointerdown", e => { const r = i.getBoundingClientRect(); let w = r.width, h = r.height;
    dragXY(e, (dx, dy) => { w = Math.max(60, Math.round(r.width + dx)); h = Math.max(28, Math.round(r.height + dy)); wrap.style.width = w + "px"; wrap.classList.add("sized"); i.style.height = h + "px"; }, () => psSet(k, { w, h })); });
  hd.addEventListener("dblclick", () => { wrap.style.width = ""; wrap.classList.remove("sized"); i.style.height = ""; psSet(k, null); });
}
/* B46 (série B, 05/11) : les messages d'alerte d'une fenêtre ne sont plus en bandeau — ils passent dans le TRIANGLE ⚠ à côté de la croix
   (pastille = nombre ; toucher = la liste) ; un bandeau qui porte un bouton d'action (RIB VÉRIFIÉ, DÉBLOQUER…) reste en place */
function sviWhyUp(card) {
  if (!card) return; const W = [...card.querySelectorAll(".frs-why")].filter(w => !w.querySelector("button, a, input"));
  let b = card.querySelector(":scope > .svc-alert"); const msgs = W.flatMap(w => { w.hidden = true; return String(w.textContent || "").replace(/^\s*[⚠↩]\s*/, "").split(" · ").map(s => s.trim()).filter(Boolean); });
  if (!msgs.length) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement("button"); b.type = "button"; b.className = "svc-alert"; b.setAttribute("aria-label", "Alertes"); card.appendChild(b);
    b.addEventListener("click", e => { e.stopPropagation(); svToast("⚠ " + (b.__msgs || []).join(" · "), 6000, b); }); }
  b.__msgs = msgs; b.innerHTML = `⚠<b>${msgs.length}</b>`;
}
function sviUpAll() {
  document.querySelectorAll(SVI_UP_SC).forEach(root => {
    root.querySelectorAll("select").forEach(sviSelUp);
    root.querySelectorAll('input[type="file"]').forEach(sviFileUp);
    root.querySelectorAll("button[data-addl]").forEach(sviAddRowUp);
    root.querySelectorAll("table").forEach(sviRmUp);
    root.querySelectorAll(".svc-f").forEach(sviFootUp);
    root.querySelectorAll(".doc-grid").forEach(sviGridTop);
    if (root.id === "svConf") root.querySelectorAll(".frs-f > input.ins-in, .frs-f > textarea.ins-in").forEach(sviFldRszUp);
    if (typeof sviFldApply === "function") sviFldApply(root);
    if (root.id === "svConf") root.querySelectorAll(".svc-card").forEach(sviWhyUp);   /* B11, B17 : réglages des champs */
  });
}
let sviUpRaf = 0;
new MutationObserver(muts => {
  if (!muts.some(m => m.addedNodes.length)) return;
  cancelAnimationFrame(sviUpRaf);
  sviUpRaf = requestAnimationFrame(sviUpAll);
}).observe(document.documentElement, { childList: true, subtree: true });
