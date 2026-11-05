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
    /* v928 (remarque 15) : + masques posés sur un champ par appui long (clé « c:… », avec leur libellé) */
    sviMaskMem = { raw, L: SVI_MASK_DEF.map(d => Object.assign({}, d, o[d.k] || {})).concat(Object.keys(o).filter(k => !SVI_MASK_DEF.some(d => d.k === k) && o[k] && o[k].lab).map(k => ({ k, lab: o[k].lab, m: o[k].m || "", ex: !!o[k].ex }))) };
  }
  return sviMaskMem.L.map(x => Object.assign({}, x));
}
function sviMasksSave(L) {
  const o = {};
  L.forEach(x => { o[x.k] = { m: String(x.m || ""), ex: !!x.ex }; if (!SVI_MASK_DEF.some(d => d.k === x.k)) o[x.k].lab = x.lab || x.k; });
  try { localStorage.setItem(SVI_MASK_KEY, JSON.stringify(o)); } catch (e) {}
}
const sviMaskOf = k => sviMasks().find(x => x.k === k) || null;
const sviMaskSlot = c => c === "9" || c === "A";
/* v928 (remarque 15 du 04/11/2026) : écriture du masque — 9 = un chiffre, A = une lettre, "texte" entre guillemets = écrit d'office,
   tout autre signe (espace, tiret, +) placé d'office. Ex. « 999-AAA », « "ABC"-999 », « "+212" 9 99 99 99 99 » */
function sviMaskTok(m) {
  const T = []; let q = false;
  for (const c of String(m || "")) { if (c === '"') { q = !q; continue; } T.push(!q && (c === "9" || c === "A") ? { s: c } : { l: c }); }
  return T;
}
const sviMaskSlots = m => sviMaskTok(m).filter(x => x.s).length;
/* caractères utiles de la saisie (chiffres et lettres, en majuscules) */
const sviMaskRaw = v => String(v ?? "").toUpperCase().replace(/[^0-9A-ZÀ-Ý]/g, "");
/* met la saisie dans le masque : les signes fixes sont posés au fur et à mesure (un signe fixe déjà tapé n'est pas doublé) */
function sviMaskRun(m, v) {
  const s = String(v ?? "").toUpperCase();
  let out = "", i = 0, n = 0;
  for (const tk of sviMaskTok(m)) {
    if (i >= s.length) break;
    const c = tk.s || tk.l;
    if (tk.s) {
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
  const r = sviMaskRun(M.m, v), need = sviMaskSlots(M.m);
  return !r.rest && r.n > 0 && (M.ex ? r.n === need : r.n <= need);
}
const sviMaskLab = k => (sviMaskOf(k) || {}).lab || k;
/* v928 (remarque 15) : MASQUE POSÉ SUR UN CHAMP — appui long (clic droit sur ordinateur) sur un champ d'une fenêtre = fenêtre MASQUE DE SAISIE
   (administrateur ; ouvert à tous en attendant les droits). Le champ est reconnu par sa clé (data-k / data-f / id) et son libellé. */
function sviMaskLabOf(i) {
  const t = x => String(x || "").replace(/[*\s]+$/g, "").replace(/\s+/g, " ").trim().toUpperCase();
  const l = i.closest("label"); if (l) { const s = l.querySelector("span"); if (s && !s.contains(i)) return t(s.dataset.olab || s.textContent); }
  let p = i.closest(".fld-wrap") || i; p = p.previousElementSibling; if (p && /doc-lab|frs-l/.test(p.className)) return t(p.textContent);
  const td = i.closest("td"), tb = td && td.closest("table"); if (td && tb && tb.tHead) { const th = tb.tHead.rows[0] && tb.tHead.rows[0].cells[td.cellIndex]; if (th) return t(th.textContent); }
  return t(i.placeholder || i.name || i.id || "CHAMP");
}
const sviMaskKeyOf = i => i.dataset.mask || ("c:" + (i.dataset.k || i.dataset.f || i.dataset.c || i.id || "") + "|" + sviMaskLabOf(i));
const SVI_MASK_FIELD = "#svConf input, #docPop input";
const sviMaskable = i => !!(i && i.matches && i.matches(SVI_MASK_FIELD) && (!i.type || ["text", "tel", "search"].includes(i.type)) && !i.readOnly && !i.disabled);
document.addEventListener("focusin", e => { const i = e.target; if (!sviMaskable(i) || i.dataset.mask) return; const k = sviMaskKeyOf(i); if ((sviMaskOf(k) || {}).m) i.dataset.mask = k; }, true);
/* série B (B11, B17, B28) : RÉGLAGES D'UN CHAMP, valables partout où il apparaît — INTITULÉ (renommé), EXPLICATION (bulle à l'appui long
   sur l'intitulé), MASQUE, OBLIGATOIRE (pour tous, ou seulement certains groupes / types de fournisseurs), IMPRIMÉ SUR LA COMMANDE */
const SVI_FLD_K = "svi_fld_v1";
const sviFlds = () => { try { const o = JSON.parse(localStorage.getItem(SVI_FLD_K) || "{}"); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } };
const sviFldSave = o => { try { localStorage.setItem(SVI_FLD_K, JSON.stringify(o)); } catch (e) {} };
const sviFldSrc = i => { const m = String(i.className || "").match(/\b([a-z]+)-xs?\b/); return m ? m[1] : ""; };
const sviFldCtx = i => { const c = i.closest(".svc-card, .frs-card, #docPop") || document, v = s => ((c.querySelector(s) || {}).value || ""); return { g: v('select[data-k="grp"]'), t: v('select[data-k="type"]') }; };
const sviFldReq = (S, x) => !!S && (S.req === "all" || (S.req === "some" && (((S.reqG || []).includes(x.g)) || ((S.reqT || []).includes(x.t)))));
const SVI_FLD_SEL = "#svConf input, #svConf select, #svConf textarea, #docPop input, #docPop textarea";
const sviFldSpan = i => { const l = i.closest("label"); const s = l && l.querySelector("span"); return s && !s.contains(i) ? s : null; };
/* intitulé renommé, bulle d'explication, astérisque des champs obligatoires */
function sviFldApply(root) { const F = sviFlds(); if (!Object.keys(F).length) return;
  root.querySelectorAll(SVI_FLD_SEL).forEach(i => { if (["checkbox", "radio", "file", "hidden"].includes(i.type)) return; const s = sviFldSpan(i); if (!s) return;
    const k = sviMaskKeyOf(i), S = F[k]; if (!S) return;
    if (s.dataset.olab === undefined) s.dataset.olab = String(s.textContent || "").replace(/[*\s]+$/g, "").trim();
    const star = !!s.querySelector("b") || sviFldReq(S, sviFldCtx(i));
    s.innerHTML = esc(S.lab || s.dataset.olab) + (star ? " <b>*</b>" : ""); if (S.tip) s.dataset.tip = S.tip; else delete s.dataset.tip; });
}
/* OBLIGATOIRE : refusé à l'enregistrement ou à la validation de la fenêtre, quel que soit le champ */
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("#svConf [data-save], #svConf [data-valid], #svConf [data-save2]"); if (!b) return; const F = sviFlds(); if (!Object.keys(F).length) return;
  const card = b.closest("#svConf"); for (const i of card.querySelectorAll(SVI_FLD_SEL)) { if (i.disabled || ["checkbox", "radio", "file", "hidden"].includes(i.type) || i.closest("[hidden]")) continue;
    const S = F[sviMaskKeyOf(i)]; if (!sviFldReq(S, sviFldCtx(i)) || String(i.value || "").trim()) continue;
    e.preventDefault(); e.stopImmediatePropagation(); svToast("CHAMP OBLIGATOIRE : " + (S.lab || S.olab || sviMaskLabOf(i)) + ".", 3500, i); try { i.focus(); } catch (x) {} return; } }, true);
function sviMaskWin(i) {
  const k = sviMaskKeyOf(i), M = sviMaskOf(k) || { k, lab: sviMaskLabOf(i), m: "", ex: false }, S = sviFlds()[k] || {};
  document.getElementById("svMaskPop")?.remove();
  const p = document.createElement("div"); p.id = "svMaskPop";
  const ex = m => m ? sviMaskRun(m, "1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S").out : "";
  const GR = typeof achPrm === "function" ? achPrm().grp.map(g => [g.id, g.nom]) : [], TY = typeof sviPgL === "function" ? sviPgL("ftypes").map(t => [t.lab, t.lab]) : [], src = sviFldSrc(i);
  const ck = (cls, L, on) => L.map(([v, l]) => `<label class="mkp-c"><input type="checkbox" class="${cls}" value="${esc(v)}"${(on || []).includes(v) ? " checked" : ""}> ${esc(l)}</label>`).join("");
  p.innerHTML = `<div class="mkp-t">CHAMP — ${esc(S.lab || M.lab)}</div>
    <label class="mkp-f"><span>INTITULÉ</span><input class="mkp-lab" value="${esc(S.lab || M.lab)}" autocomplete="off"></label>
    <label class="mkp-f"><span>EXPLICATION (BULLE À L'APPUI LONG SUR L'INTITULÉ)</span><textarea class="mkp-tip" rows="2">${esc(S.tip || "")}</textarea></label>
    <label class="mkp-f"><span>OBLIGATOIRE</span><select class="mkp-req"><option value="">NON</option><option value="all"${S.req === "all" ? " selected" : ""}>POUR TOUS</option><option value="some"${S.req === "some" ? " selected" : ""}>SEULEMENT POUR…</option></select></label>
    <div class="mkp-some"${S.req === "some" ? "" : " hidden"}>${GR.length ? `<div class="mkp-n">GROUPES</div>${ck("mkp-rg", GR, S.reqG)}` : ""}${TY.length ? `<div class="mkp-n">TYPES DE FOURNISSEURS</div>${ck("mkp-rt", TY, S.reqT)}` : ""}</div>
    <label class="mkp-c"><input type="checkbox" class="mkp-prt"${S.prt ? " checked" : ""}> IMPRIMÉ SUR LA COMMANDE</label>
    <div class="mkp-t mkp-t2">MASQUE DE SAISIE</div>
    <label class="mkp-f"><span>MASQUE</span><input class="mkp-m" value="${esc(M.m)}" autocomplete="off" data-keepcase></label>
    <label class="mkp-c"><input type="checkbox" class="mkp-ex"${M.ex ? " checked" : ""}> LONGUEUR EXACTE</label>
    <div class="mkp-x">EXEMPLE : <b class="mkp-e">${esc(ex(M.m))}</b></div>
    <div class="mkp-n">9 = UN CHIFFRE · A = UNE LETTRE · "TEXTE" = ÉCRIT D'OFFICE · AUTRE SIGNE (ESPACE, TIRET) PLACÉ D'OFFICE · VIDE = AUCUN MASQUE</div>
    <div class="mkp-b"><button type="button" class="svc-b" data-mx>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ms>ENREGISTRER</button></div>`;
  document.body.appendChild(p);
  const r = i.getBoundingClientRect(); p.style.left = Math.max(8, Math.min(window.innerWidth - p.offsetWidth - 8, r.left)) + "px"; p.style.top = Math.max(8, Math.min(window.innerHeight - p.offsetHeight - 8, r.bottom + 6)) + "px";
  const mi = p.querySelector(".mkp-m"); setTimeout(() => { try { mi.focus(); } catch (e) {} }, 30);
  mi.addEventListener("input", () => { p.querySelector(".mkp-e").textContent = ex(mi.value.toUpperCase()); });
  p.querySelector(".mkp-req").addEventListener("change", e => { p.querySelector(".mkp-some").hidden = e.target.value !== "some"; });
  p.addEventListener("click", e => {
    if (e.target.closest("[data-mx]")) { p.remove(); return; }
    if (!e.target.closest("[data-ms]")) return;
    const m = String(mi.value || "").toUpperCase().replace(/\s+/g, " ").trim();
    if (m && !sviMaskSlots(m)) { svToast("MASQUE SANS 9 NI A : AUCUNE SAISIE POSSIBLE.", 3500, mi); return; }
    const L = sviMasks(), x = L.find(y => y.k === k); if (x) { x.m = m; x.ex = p.querySelector(".mkp-ex").checked; } else if (m) L.push({ k, lab: M.lab, m, ex: p.querySelector(".mkp-ex").checked });
    sviMasksSave(L);
    { const F = sviFlds(), lab = String(p.querySelector(".mkp-lab").value || "").replace(/\s+/g, " ").trim().toUpperCase(), tip = String(p.querySelector(".mkp-tip").value || "").replace(/\s+/g, " ").trim().toUpperCase();
      const o = { olab: M.lab, src, lab: lab && lab !== M.lab ? lab : "", tip, req: p.querySelector(".mkp-req").value, reqG: [...p.querySelectorAll(".mkp-rg:checked")].map(c => c.value), reqT: [...p.querySelectorAll(".mkp-rt:checked")].map(c => c.value), prt: p.querySelector(".mkp-prt").checked };
      if (!o.lab && !o.tip && !o.req && !o.prt) delete F[k]; else F[k] = o; sviFldSave(F); }
    p.remove(); { const r = i.closest("#svConf, #docPop"); if (r) { const s = sviFldSpan(i); if (s && sviFlds()[k] === undefined && s.dataset.olab !== undefined) s.textContent = s.dataset.olab; sviFldApply(r); } }
    if (m) { i.dataset.mask = k; const f = sviMaskFmt(k, i.value); if (f !== i.value) i.value = f; } else if (k.startsWith("c:")) delete i.dataset.mask;
    svToast("RÉGLAGES DU CHAMP ENREGISTRÉS" + (m ? " — MASQUE " + m : "") + ".", 2500, i);
  });
}
{ let tm = 0, x0 = 0, y0 = 0;
  document.addEventListener("pointerdown", e => { const i = e.target; if (!sviMaskable(i) || e.button > 0) return; x0 = e.clientX; y0 = e.clientY; clearTimeout(tm);
    tm = setTimeout(() => { tm = 0; sviMaskWin(i); }, (window.SVI_G && SVI_G.lp) || 450); }, true);
  document.addEventListener("pointermove", e => { if (tm && Math.hypot(e.clientX - x0, e.clientY - y0) > ((window.SVI_G && SVI_G.drag) || 8)) { clearTimeout(tm); tm = 0; } }, true);
  ["pointerup", "pointercancel"].forEach(t => document.addEventListener(t, () => { clearTimeout(tm); tm = 0; }, true));
  document.addEventListener("contextmenu", e => { if (!sviMaskable(e.target)) return; e.preventDefault(); clearTimeout(tm); tm = 0; sviMaskWin(e.target); }, true); }
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
