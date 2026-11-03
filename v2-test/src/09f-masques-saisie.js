/* =========================================================
   v804 : MASQUES DE SAISIE (checklist C1.44) — réglés dans PARAMÉTRAGE › FORMAT › MASQUES DE SAISIE
   Écriture d'un masque : 9 = un chiffre, A = une lettre, tout autre signe est écrit tel quel.
   Un champ <input data-mask="clé"> se met en forme pendant la frappe ; sviMaskOk refuse à l'enregistrement
   une valeur qui ne suit pas le masque (LONGUEUR EXACTE : le masque doit être rempli en entier).
   ========================================================= */
const SVI_MASK_KEY = "svi_masks_v1";
const SVI_MASK_DEF = [
  { k: "ice", lab: "ICE", m: "999999999999999", ex: true },
  { k: "if", lab: "IDENTIFIANT FISCAL (IF)", m: "99999999", ex: true },
  { k: "rc", lab: "REGISTRE DE COMMERCE (RC)", m: "999999", ex: false },
  { k: "cnss", lab: "CNSS", m: "9999999", ex: true },
  { k: "tel", lab: "TÉLÉPHONE", m: "99 99 99 99 99", ex: true }
];
/* v811 : réglage mémorisé, relu seulement s'il a changé dans l'appareil (une copie est rendue, modifiable) */
let sviMaskMem = null;
function sviMasks() {
  let raw = null;
  try { raw = localStorage.getItem(SVI_MASK_KEY); } catch (e) {}
  if (!sviMaskMem || sviMaskMem.raw !== raw) {
    let o = {};
    try { o = JSON.parse(raw || "{}") || {}; } catch (e) {}
    sviMaskMem = { raw, L: SVI_MASK_DEF.map(d => Object.assign({}, d, o[d.k] || {})) };
  }
  return sviMaskMem.L.map(x => Object.assign({}, x));
}
function sviMasksSave(L) {
  const o = {};
  L.forEach(x => { o[x.k] = { m: String(x.m || ""), ex: !!x.ex }; });
  try { localStorage.setItem(SVI_MASK_KEY, JSON.stringify(o)); } catch (e) {}
}
const sviMaskOf = k => sviMasks().find(x => x.k === k) || null;
const sviMaskSlot = c => c === "9" || c === "A";
/* caractères utiles de la saisie (chiffres et lettres, en majuscules) */
const sviMaskRaw = v => String(v ?? "").toUpperCase().replace(/[^0-9A-ZÀ-Ý]/g, "");
/* met la saisie dans le masque : les signes fixes sont posés au fur et à mesure (un signe fixe déjà tapé n'est pas doublé) */
function sviMaskRun(m, v) {
  const s = String(v ?? "").toUpperCase();
  let out = "", i = 0, n = 0;
  for (const c of m) {
    if (i >= s.length) break;
    if (c === "9" || c === "A") {
      const ok = c === "9" ? (x => /\d/.test(x)) : (x => /[A-ZÀ-Ý]/.test(x));
      while (i < s.length && !ok(s[i])) i++;
      if (i >= s.length) break;
      out += s[i++]; n++;
    } else { out += c; if (s[i] === c) i++; }
  }
  return { out, n, rest: sviMaskRaw(s.slice(i)).length > 0 };
}
function sviMaskFmt(k, v) {
  const M = sviMaskOf(k), m = M ? M.m : "";
  return m ? sviMaskRun(m, v).out : String(v ?? "").toUpperCase();
}
/* vide = accepté (l'obligation est contrôlée ailleurs) */
function sviMaskOk(k, v) {
  const M = sviMaskOf(k);
  if (!sviMaskRaw(v) || !M || !M.m) return true;
  const r = sviMaskRun(M.m, v), need = [...M.m].filter(sviMaskSlot).length;
  return !r.rest && r.n > 0 && (M.ex ? r.n === need : r.n <= need);
}
const sviMaskLab = k => (sviMaskOf(k) || {}).lab || k;
/* mise en forme pendant la frappe, pour tout champ marqué data-mask */
document.addEventListener("input", e => {
  const i = e.target;
  if (!i || !i.matches || !i.matches("input[data-mask]")) return;
  const f = sviMaskFmt(i.dataset.mask, i.value);
  if (f !== i.value) { i.value = f; try { i.setSelectionRange(f.length, f.length); } catch (x) {} }
}, true);
/* =========================================================
   v904 (principe du 03/11/2026 : une erreur est refusée DÈS LA SAISIE, pas seulement à l'enregistrement)
   Règles de case communes : à la sortie d'une case qui ne respecte pas sa règle, la case reprend sa valeur d'avant,
   avec la raison près d'elle. Une règle = [sélecteur, contrôle(valeur, case), message]. Les contrôles de l'enregistrement restent.
   ========================================================= */
const SVI_ENTRY_RULES = [
  /* masques de saisie (PARAMÉTRAGE › FORMAT › MASQUES DE SAISIE) : ils mettaient en forme, ils refusent aussi */
  ["input[data-mask]", (v, i) => sviMaskOk(i.dataset.mask, v), i => sviMaskLab(i.dataset.mask) + " NON VALIDE : MASQUE " + ((sviMaskOf(i.dataset.mask) || {}).m || "") + "."],
  /* planning : décalage d'une liaison, capacité, approvisionnement, rendement */
  [".lkw-o", v => /^\d*$/.test(v), () => "DÉCALAGE NON VALIDE : NOMBRE DE JOURS ≥ 0."],
  [".gc-cap", v => v === "" || /^\d+$/.test(v), () => "CAPACITÉ : NOMBRE ENTIER D'OUVRIERS (VIDE = SANS LIMITE)."],
  [".apr-dl", v => /^\d+$/.test(v), () => "DÉLAI D'APPROVISIONNEMENT : NOMBRE ENTIER DE JOURS."],
  [".apr-nj", v => v === "" || (/^\d+$/.test(v) && Number(v) >= 1), () => "NOMBRE DE JOURS : ENTIER, 1 AU MOINS."],
  [".rd-min", v => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 100, () => "RENDEMENT MIN : DE 1 À 100 %."],
  [".rd-max", v => /^\d+$/.test(v) && Number(v) >= 100 && Number(v) <= 300, () => "RENDEMENT MAX : DE 100 À 300 %."],
  /* v907 : ACHATS — besoin, consultation, devis, commande, réception, facture : quantités, prix, taux, péremption */
  ['.bsn-x[data-k="q"], .caf-l[data-c="q"], .dvf-l[data-c="q"], .cmf-l[data-c="q"], .fa-l[data-c="q"]', v => v === "" || sviEntryN(v) > 0, () => "QUANTITÉ : NOMBRE SUPÉRIEUR À 0."],
  ['.rcp-l[data-c="q"], .rcp-l[data-c="qbl"]', v => v === "" || sviEntryN(v) >= 0, () => "QUANTITÉ : NOMBRE POSITIF OU NUL."],
  ['.bsn-x[data-k="pu"], .dvf-l[data-c="pu"], .cmf-l[data-c="pu"], .fa-l[data-c="pu"]', v => v === "" || sviEntryN(v) >= 0, () => "PRIX : NOMBRE POSITIF OU NUL."],
  ['.dvf-x[data-k="remG"], .dvf-l[data-c="rem"], .cmf-x[data-k="rem"], .dvf-l[data-c="tva"], .cmf-l[data-c="tva"], .fa-l[data-c="tva"], .fa-x[data-k="rasT"]', v => v === "" || (sviEntryN(v) >= 0 && sviEntryN(v) <= 100), () => "TAUX : DE 0 À 100 %."],
  [".inf-gps", v => !v || !!sviGpsParse(v), () => "GPS DU CHANTIER : LATITUDE, LONGITUDE (EX. 33.5731, -7.5898)."],
  ['.rcp-l[data-c="per"]', v => !v || v >= new Date().toISOString().slice(0, 10), () => "DATE DE PÉREMPTION DÉJÀ PASSÉE."]
];
/* nombre saisi (virgule ou point, espaces) ; NaN si ce n'est pas un nombre */
const sviEntryN = v => { const s = String(v ?? "").replace(/[\s\u00a0\u202f]/g, "").replace(",", "."); return s === "" || !/^[-+]?\d*\.?\d*$/.test(s) ? NaN : Number(s); };
const sviEntryRule = el => SVI_ENTRY_RULES.find(r => el.matches && el.matches(r[0]));
document.addEventListener("focusin", e => { const i = e.target; if (i && i.tagName === "INPUT" && sviEntryRule(i)) i.dataset.prev = i.value; }, true);
document.addEventListener("change", e => {
  const i = e.target; if (!i || i.tagName !== "INPUT") return;
  const R = sviEntryRule(i); if (!R) return;
  const v = String(i.value ?? "").trim();
  if (R[1](v, i)) { i.dataset.prev = i.value; return; }
  e.stopImmediatePropagation();
  i.value = i.dataset.prev ?? "";
  if (typeof svToast === "function") svToast(R[2](i), 3500, i);
}, true);
