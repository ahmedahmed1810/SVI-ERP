/* =========================================================
   v754 : COULEURS DES ÉTATS — paramétrables (PARAMÉTRAGE › COULEURS), communes à toute l'application
   Une seule couleur par état (plus deux rouges différents) : variables CSS --st-<état> posées sur la page.
   EN INSTANCE, FIGÉ et VALIDÉ servent dès maintenant (liste des budgets, écran d'un budget) ;
   EXPIRÉ, BLOQUÉ et ARCHIVÉ servent aux états des budgets (lot 2).
   ========================================================= */
const SVI_COL_KEY = "svi_colors_v1";
const SVI_COL_DEF = { instance: "#b91c1c", fige: "#15803d", valide: "#172033", expire: "#b45309", bloque: "#6b7280", archive: "#6d28d9" };
const SVI_COL_LAB = [["instance", "EN INSTANCE"], ["fige", "FIGÉ"], ["valide", "VALIDÉ"], ["expire", "EXPIRÉ"], ["bloque", "BLOQUÉ"], ["archive", "ARCHIVÉ"]];
function sviColors() {
  let v = null; try { v = JSON.parse(localStorage.getItem(SVI_COL_KEY) || "null"); } catch (e) {}
  const o = { ...SVI_COL_DEF };
  if (v && typeof v === "object") Object.keys(o).forEach(k => { if (/^#[0-9a-f]{6}$/i.test(String(v[k] || ""))) o[k] = v[k]; });
  return o;
}
function sviColorsApply() {
  const C = sviColors(), r = document.documentElement;
  Object.keys(C).forEach(k => r.style.setProperty("--st-" + k, C[k]));
}
function sviColorsSave(o) {
  try { localStorage.setItem(SVI_COL_KEY, JSON.stringify(o)); } catch (e) {}
  sviColorsApply();
}
sviColorsApply();
