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
