/* =========================================================
   ACHATS — DONNÉES ET RÈGLES (v749, étape 1 : articles et paramètres)
   Décisions du 31/10/2026 (checklist Qualité, Achat et Droits, bloc C) :
   - une seule façon de faire : tableaux, tri / filtre, largeurs, ordre des colonnes du budget ;
   - un ARTICLE = une charge du budget (désignation + unité) ; le budget peut aussi contenir des charges sans article ;
   - données PARTAGÉES par la base V3 (02e : clés svi_ach_…_v1 dans SVI_SHARE_RX), communes à tous les budgets ;
   - rien n'est effacé : une suppression met l'article à la CORBEILLE (restaurable), un numéro n'est jamais réutilisé.
   Règles reprises de achats.html (validées par Ahmed) : catégories, banques et codes RIB, TVA par défaut 20 %.
   ========================================================= */
const ACH_K = { art: "svi_ach_art_v1", prm: "svi_ach_prm_v1", frs: "svi_ach_frs_v1", bsn: "svi_ach_bsn_v1", caf: "svi_ach_caf_v1", dvf: "svi_ach_dvf_v1", cmf: "svi_ach_cmf_v1", rcp: "svi_ach_rcp_v1", rtr: "svi_ach_rtr_v1", faf: "svi_ach_faf_v1", avf: "svi_ach_avf_v1", paf: "svi_ach_paf_v1" };
const ACH_PRM_DEF = {
  tva: 20,
  cat: ["COFFRAGE", "LOCATION MATERIEL", "MATERIAUX NON STOCKABLE", "MATERIAUX STOCKABLE", "MATERIEL DE BUREAU", "MATERIEL ET OUTILLAGE", "SERVICES", "SOUS TRAITANCE", "TRANSPORT"],
  banques: [{ id: "B1", n: "ATTIJARIWAFA BANK", abr: "AWB", code: "007" }, { id: "B2", n: "BANQUE POPULAIRE", abr: "BP", code: "101-199" },
    { id: "B3", n: "BANK OF AFRICA", abr: "BOA", code: "011" }, { id: "B4", n: "BMCI", abr: "BMCI", code: "013" }, { id: "B5", n: "CIH BANK", abr: "CIH", code: "230" },
    { id: "B6", n: "CREDIT AGRICOLE DU MAROC", abr: "CAM", code: "225" }, { id: "B7", n: "CREDIT DU MAROC", abr: "CDM", code: "021" },
    { id: "B8", n: "SOCIETE GENERALE MAROC", abr: "SGMB", code: "022" }, { id: "B9", n: "AL BARID BANK", abr: "ABB", code: "350" }]
};
const achU = v => String(v ?? "").replace(/\s+/g, " ").trim().toUpperCase();
const achN = v => { const n = Number(String(v ?? "").replace(/\s| | /g, "").replace(",", ".")); return isFinite(n) ? n : 0; };
/* v769 : grandes listes des achats COMPRESSÉES dans la mémoire de l'appareil (SVI_LZ, 02e) — environ 9 fois moins de place */
const achJ = (k, d) => { try { const v = JSON.parse(SVI_LZ.dec(localStorage.getItem(k)) || "null"); return v === null ? d : v; } catch (e) { return d; } };
const achW = (k, v) => { try { const s = JSON.stringify(v); localStorage.setItem(k, /^svi_ach_/.test(k) && s.length > 4000 ? SVI_LZ.enc(s) : s); return true; } catch (e) { return false; } };
/* ---------- paramètres d'achat ---------- */
const achPrm = () => { const p = achJ(ACH_K.prm, null) || {}; return { tol: p.tol === undefined ? 5 : achN(p.tol), direct: p.direct === undefined ? 5000 : achN(p.direct), ecart: p.ecart === undefined ? 1 : achN(p.ecart), esp: p.esp === undefined ? 5000 : achN(p.esp), rasT: p.rasT === undefined ? 75 : achN(p.rasT), avj: p.avj === undefined ? 90 : achN(p.avj), chqj: p.chqj === undefined ? 30 : achN(p.chqj), tva: p.tva === undefined ? ACH_PRM_DEF.tva : achN(p.tva), cat: Array.isArray(p.cat) ? p.cat : ACH_PRM_DEF.cat.slice(), banques: Array.isArray(p.banques) ? p.banques : ACH_PRM_DEF.banques.map(b => ({ ...b })) }; };
const achPrmSave = p => achW(ACH_K.prm, p);
/* banque d'un RIB : ses 3 premiers chiffres (code « 101-199 » = plage) */
const achBankHasCode = (b, c) => String(b.code || "").split(/[,;\s]+/).filter(Boolean).some(x => { const m = x.match(/^(\d{3})-(\d{3})$/); return m ? +c >= +m[1] && +c <= +m[2] : x === c; });
const achBankOfRib = rib => { const c = String(rib || "").replace(/\D/g, "").slice(0, 3); return c.length < 3 ? null : achPrm().banques.find(b => achBankHasCode(b, c)) || null; };
/* ---------- articles ---------- */
const achArts = () => { const L = achJ(ACH_K.art, []); return Array.isArray(L) ? L : []; };
const achArtsSave = L => achW(ACH_K.art, L);
const achLive = L => L.filter(a => !a.del);
/* code ART-0001… : suit le plus grand numéro jamais donné (corbeille comprise) → jamais de réutilisation */
const achArtNextCode = L => "ART-" + String(L.reduce((m, a) => Math.max(m, Number(String(a.code || "").replace(/\D/g, "")) || 0), 0) + 1).padStart(4, "0");
const achKey = (des, u) => achU(des) + "|" + achU(u);
/* doublon exact (même désignation et même unité) parmi les articles actifs ou inactifs non supprimés */
const achArtDup = (L, des, u, id) => achLive(L).find(a => a.id !== id && achKey(a.des, a.u) === achKey(des, u)) || null;
/* presque identique (même unité) : signalé, pas refusé */
const achArtNear = (L, des, u, id) => achLive(L).find(a => a.id !== id && achU(a.u) === achU(u) && achU(a.des) !== achU(des) && typeof sviIsNear === "function" && sviIsNear(a.des, des)) || null;
const achIsDivers = a => /^DIVERS\b/.test(achU(a.des));
/* contrôles d'un article : liste de messages (vide = correct) */
const achArtWhy = a => {
  const w = [];
  if (!achU(a.des)) w.push("DÉSIGNATION MANQUANTE");
  if (!achU(a.u)) w.push("UNITÉ MANQUANTE");
  if (achN(a.pmax) > 0 && achN(a.pref) > achN(a.pmax)) w.push("PRIX DE RÉFÉRENCE AU-DESSUS DU PLAFOND");
  if (achIsDivers(a) && !(achN(a.pmax) > 0)) w.push("ARTICLE DIVERS : PLAFOND OBLIGATOIRE");
  return w;
};
const achArtNew = (L, o) => {
  const now = new Date().toISOString();
  const a = { id: "A" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), code: achArtNextCode(L), des: achU(o.des), u: achU(o.u), cat: achU(o.cat || ""),
    stk: !!o.stk, tva: o.tva === undefined ? achPrm().tva : achN(o.tva), pref: achN(o.pref), pmax: achN(o.pmax), actif: o.actif !== false, src: o.src || "", cree: now, mod: now, del: "" };
  L.push(a);
  return a;
};
/* historique d'un article : même format que celui du budget (H) */
const achHist = (code, action, detail) => { try { const k = "svi_hist_v1:ACH-" + code, l = JSON.parse(localStorage.getItem(k) || "[]") || []; l.push({ t: new Date().toISOString(), b: "ARTICLE", a: action, d: achU(detail), u: typeof sviUser === "function" ? sviUser() : "" }); localStorage.setItem(k, JSON.stringify(l.slice(-500))); } catch (e) {} };
const achHistGet = code => (typeof achHistNov === "function" ? achHistNov(code) : []).concat(achJ("svi_hist_v1:ACH-" + code, []) || []);   /* v767 : historique NovApp devant */
/* fusion de doublons : l'article gardé reprend l'origine de l'autre ; l'autre va à la corbeille avec la mention */
const achArtMerge = (L, keepId, dropIds) => {
  const k = L.find(a => a.id === keepId); if (!k) return 0;
  let n = 0;
  dropIds.forEach(id => { const d = L.find(a => a.id === id); if (!d || d === k || d.del) return; d.del = new Date().toISOString(); d.mergedInto = k.code; d.mod = d.del; n++;
    if (!k.pref && d.pref) k.pref = d.pref; if (!k.pmax && d.pmax) k.pmax = d.pmax; if (!k.cat && d.cat) k.cat = d.cat;
    achHist(d.code, "FUSION", "FUSIONNÉ DANS " + k.code); achHist(k.code, "FUSION", "REPREND " + d.code + " — " + d.des); });
  k.mod = new Date().toISOString();
  return n;
};
/* ---------- lien avec le budget ---------- */
/* charges de tous les budgets de l'appareil (en instance, figés, validés) : { key → { des, u, refs:Set, q, mt, p:[prix] } } */
const achBudgetCharges = () => {
  const M = new Map();
  let B = []; try { B = typeof sviInstGet === "function" ? sviInstGet() : []; } catch (e) {}
  (B || []).forEach(b => {
    const d = (b && (b.data || (b.inst && b.inst.data))) || {};
    (d.chg || []).forEach(r => {
      if (!r || r.t || !achU(r.des)) return;
      const k = achKey(r.des, r.u), x = M.get(k) || { des: achU(r.des), u: achU(r.u), refs: new Set(), q: 0, mt: 0, p: [], tva: r.tva };
      x.refs.add(String(b.ref || "")); const q = achN(r.q), p = achN(r.p); x.q += q; x.mt += q * p; if (p > 0) x.p.push(p);
      M.set(k, x);
    });
  });
  return M;
};
/* budgets qui utilisent un article (même désignation et même unité) */
const achArtBudgets = (a, M) => { const x = (M || achBudgetCharges()).get(achKey(a.des, a.u)); return x ? [...x.refs].filter(Boolean).sort() : []; };
/* charges des budgets sans article → nouveaux articles (prix de référence = prix moyen pondéré des budgets) ; rend le nombre créé */
const achArtsFromBudgets = L => {
  const M = achBudgetCharges(); let n = 0;
  M.forEach(x => {
    if (achArtDup(L, x.des, x.u, null)) return;
    const a = achArtNew(L, { des: x.des, u: x.u, pref: x.q > 0 ? Math.round(x.mt / x.q * 100) / 100 : (x.p[0] || 0), tva: x.tva === undefined || x.tva === "" ? undefined : x.tva, src: "BUDGETS" });
    achHist(a.code, "CRÉATION", "REPRIS DES CHARGES DES BUDGETS : " + [...x.refs].join(", "));
    n++;
  });
  return n;
};

/* =========================================================
   v759 : FOURNISSEURS (étape 1, suite — checklist Bloc C, chapitre 1 ; champs repris de achats.html)
   - code FRS-0001… jamais réutilisé ; corbeille restaurable ; historique H (même format que les articles) ;
   - ICE : 15 chiffres, jamais deux fournisseurs actifs avec le même ICE ; obligatoire sauf fournisseur OCCASIONNEL (fiche simplifiée) ;
   - plusieurs RIB (24 chiffres), un seul PRINCIPAL ; banque reconnue par les 3 premiers chiffres (ACHATS › PARAMÈTRES) ;
   - tout changement de RIB est confirmé, noté dans H et signalé (⚠ RIB MODIFIÉ) jusqu'à ce qu'il soit marqué VÉRIFIÉ ;
   - documents fiscaux avec date d'expiration (⚠ expiré, ou dans les 30 jours) ; contacts (CTE), évaluations (EVL), contrats (CGF) ;
   - conditions de paiement, familles d'articles fournies (catégories des articles), forme juridique.
   ========================================================= */
const ACH_FORMES = ["SARL", "SARL AU", "SA", "SNC", "SCS", "AUTO-ENTREPRENEUR", "PERSONNE PHYSIQUE", "COOPÉRATIVE", "ÉTABLISSEMENT PUBLIC", "AUTRE"];
const ACH_CONDS = ["COMPTANT", "À LA COMMANDE", "À LA LIVRAISON", "30 JOURS", "45 JOURS", "60 JOURS", "90 JOURS", "120 JOURS"];
/* v802 : onglet IDENTITÉ du fournisseur (checklist C1.24, C1.34, C1.54, C1.57, C1.58) */
const ACH_FTYPES = ["FABRICANT", "DISTRIBUTEUR", "REVENDEUR", "LOUEUR DE MATÉRIEL", "SOUS-TRAITANT"];
const ACH_CROLES = ["COMMANDE", "FACTURATION", "LIVRAISON", "DIRECTION"];
const ACH_FLIENS = ["MAISON MÈRE", "FILIALE", "PAYÉ À SA PLACE"];
const ACH_LANGS = ["FRANÇAIS", "ARABE", "ANGLAIS", "ESPAGNOL"];
/* v805 : onglet BANQUE ET PAIEMENT (C1.52, C1.53) */
const ACH_CAUT = ["CAUTION DE BONNE EXÉCUTION", "CAUTION DE RESTITUTION D'AVANCE", "CAUTION DE RETENUE DE GARANTIE", "AUTRE GARANTIE BANCAIRE"];
const ACH_JOURS = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM"];
/* v806 : onglet CONDITIONS D'ACHAT (C1.22, C1.23, C1.25, C1.26, C1.32, C1.35 – C1.37, C1.50, C1.51) */
const ACH_DEVISES = ["MAD", "EUR", "USD", "CNY"];
const ACH_ENVOIS = ["E-MAIL", "WHATSAPP", "TÉLÉPHONE"];
const ACH_LIVR = ["LIVRÉ SUR CHANTIER", "ENLÈVEMENT À SON DÉPÔT", "LES DEUX"];
const ACH_INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];
const ACH_DOCF = ["ATTESTATION DE RÉGULARITÉ FISCALE", "ATTESTATION CNSS", "MODÈLE J (REGISTRE DE COMMERCE)", "ATTESTATION DE RIB", "ASSURANCE", "ASSURANCE RESPONSABILITÉ CIVILE", "CERTIFICAT DE QUALIFICATION", "CERTIFICATION", "CONDITIONS GÉNÉRALES D'ACHAT SIGNÉES", "AUTRE"];
const achDig = v => String(v ?? "").replace(/\D/g, "");
/* v804 : l'ICE suit son masque de saisie (PARAMÉTRAGE › FORMAT › MASQUES DE SAISIE, C1.44) */
const achIceOk = v => typeof sviMaskOk === "function" ? !!sviMaskRaw(v) && sviMaskOk("ice", v) : /^\d{15}$/.test(achDig(v));
const achIceMsg = () => "ICE NON VALIDE : FORMAT " + ((typeof sviMaskOf === "function" && (sviMaskOf("ice") || {}).m) || "15 CHIFFRES");
const achRibKeyOk = v => { const d = achDig(v); try { return d.length === 24 && BigInt(d) % 97n === 0n; } catch (e) { return true; } };
const achRibOk = v => /^\d{24}$/.test(achDig(v));
const achFrs = () => { const L = achJ(ACH_K.frs, []); return Array.isArray(L) ? L : []; };
const achFrsSave = L => achW(ACH_K.frs, L);
const achFrsNextCode = L => "FRS-" + String(L.reduce((m, a) => Math.max(m, Number(String(a.code || "").replace(/\D/g, "")) || 0), 0) + 1).padStart(4, "0");
const achFrsDupIce = (L, ice, id) => { const c = achDig(ice); return c ? achLive(L).find(f => f.id !== id && achDig(f.ice) === c) || null : null; };
const achFrsDupNom = (L, nom, id) => achLive(L).find(f => f.id !== id && achU(f.nom) === achU(nom)) || null;
const achFrsNew = (L, o) => {
  const now = new Date().toISOString();
  const f = { id: "F" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), code: achFrsNextCode(L), nom: achU(o.nom), denom: "", forme: "", ville: "", adresse: "", site: "", resp: "",
    ice: "", ifisc: "", rc: "", villeRc: "", patente: "", capital: 0, codeCpt: "", intCpt: "", ribs: [], cond: "", fam: [], occ: !!o.occ, orgFin: false, actif: true,
    docf: [], cte: [], evl: [], cgf: [], ribChg: "", cree: now, mod: now, del: "" };
  L.push(f);
  return f;
};
const achFrsRibP = f => (f.ribs || []).find(r => r.p) || (f.ribs || [])[0] || null;
const achFrsNote = f => { const E = f.evl || []; return E.length ? E.reduce((t, x) => t + achN(x.moy), 0) / E.length : null; };
/* contrôles d'un fournisseur : liste de messages (vide = correct) */
/* v804 (checklist C1.43) : attestation de régularité fiscale expirée (la plus récente) → paiement bloqué, sauf déblocage avec motif */
const achFrsAttExp = f => { const A = ((f && f.docf) || []).filter(d => d.type === "ATTESTATION DE RÉGULARITÉ FISCALE" && d.exp).map(d => d.exp).sort();
  return A.length ? A[A.length - 1] < new Date().toISOString().slice(0, 10) : false; };
const achFrsWhy = (f, L) => {
  const w = [], today = new Date().toISOString().slice(0, 10), soon = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  if (!achU(f.nom)) w.push("NOM MANQUANT");
  if (!achDig(f.ice) && !f.occ) w.push("ICE MANQUANT (OU COCHER OCCASIONNEL)");
  if (achDig(f.ice) && !achIceOk(f.ice)) w.push(achIceMsg());
  if (L && achDig(f.ice) && achFrsDupIce(L, f.ice, f.id)) w.push("ICE EN DOUBLE AVEC " + achFrsDupIce(L, f.ice, f.id).code);
  if ((f.ribs || []).some(r => !achRibOk(r.rib))) w.push("RIB NON VALIDE (24 CHIFFRES)");
  if (!(f.ribs || []).length && !f.occ) w.push("AUCUN RIB");
  if ((f.ribs || []).length > 1 && !(f.ribs || []).some(r => r.p)) w.push("AUCUN RIB PRINCIPAL");
  if (f.ribChg) w.push("RIB MODIFIÉ LE " + String(f.ribChg).slice(0, 10).split("-").reverse().join("/") + " : À VÉRIFIER AVANT TOUT PAIEMENT");
  /* v803 : revue de la fiche une fois par an (checklist C1.55) */
  if (f.revue && f.revue < new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10)) w.push("FICHE À REVOIR : DERNIÈRE REVUE LE " + String(f.revue).split("-").reverse().join("/"));
  /* v806 : clé du RIB (C1.40) — le RIB de 24 chiffres doit être divisible par 97 ; signalé, pas bloquant */
  (f.ribs || []).forEach(r => { if (achRibOk(r.rib) && !achRibKeyOk(r.rib)) w.push("CLÉ DU RIB À VÉRIFIER : " + achDig(r.rib)); });
  { const t = (f.tar || []).filter(x => x.valid && x.valid < today); if (t.length) w.push("TARIF EXPIRÉ : " + t.map(x => x.des).join(", ")); }
  /* v805 : RIB partagé avec un autre fournisseur (C1.41) ; encours au-delà du plafond ; caution échue ou bientôt échue (C1.52) */
  if (L) (f.ribs || []).forEach(r => { const x = achDig(r.rib) && L.find(o => o.id !== f.id && !o.del && (o.ribs || []).some(q => achDig(q.rib) === achDig(r.rib))); if (x) w.push("RIB PARTAGÉ AVEC " + x.code + " — " + x.nom + " : FRAUDE POSSIBLE"); });
  if (achN(f.plafEnc) > 0 && typeof achFrsEnc === "function" && achFrsEnc(f.id) > achN(f.plafEnc) + 0.005) w.push("ENCOURS AU-DELÀ DU PLAFOND (" + achF2(achFrsEnc(f.id)) + " / " + achF2(f.plafEnc) + ")");
  (f.cau || []).forEach(c => { if (c.ech && c.ech < today) w.push("CAUTION ÉCHUE : " + (c.no || c.type)); else if (c.ech && c.ech <= soon) w.push("CAUTION BIENTÔT ÉCHUE : " + (c.no || c.type)); });
  (f.docf || []).forEach(d => { if (d.exp && d.exp < today) w.push("DOCUMENT EXPIRÉ : " + d.type); else if (d.exp && d.exp <= soon) w.push("DOCUMENT BIENTÔT EXPIRÉ : " + d.type); });
  return w;
};

/* =========================================================
   v760 : BESOINS (étape 2 — checklist Bloc C, chapitre 3)
   Un besoin = une quantité d'une CHARGE d'un budget (désignation + unité), pour une TÂCHE (lot › activité secondaire),
   à une date prévue, avec une priorité, un demandeur et un destinataire ; ou centre de coût SIÈGE (hors budget).
   CONTRÔLE : prévu de la charge (quantité × prix du budget, consolidé s'il y a des avenants) − déjà demandé (besoins non annulés)
   → un besoin qui dépasse est BLOQUÉ : justification puis DÉBLOQUER (selon les droits plus tard, B1) ; ⚠ à 90 % du prévu.
   États : EN INSTANCE → VALIDÉ (responsable, B7 plus tard) ; ANNULÉ (gardé, jamais effacé). Référence BSN AA-MMJJ/nnn jamais réutilisée.
   ========================================================= */
const ACH_PRIO = ["NORMALE", "URGENTE", "TRÈS URGENTE"];
const ACH_BSN_SEUIL = 90;
const achBsn = () => { const L = achJ(ACH_K.bsn, []); return Array.isArray(L) ? L : []; };
const achBsnSave = L => achW(ACH_K.bsn, L);
const achBsnNextRef = (L, d) => { d = d || new Date(); const p2 = x => String(x).padStart(2, "0");
  const n = L.reduce((m, b) => Math.max(m, Number((String(b.ref || "").match(/\/(\d+)$/) || [])[1]) || 0), 0) + 1;
  return "BSN " + p2(d.getFullYear() % 100) + "-" + p2(d.getMonth() + 1) + p2(d.getDate()) + "/" + String(n).padStart(3, "0"); };
/* budgets proposés : étapes de l'appareil (pas les versions, scénarios ni recalages), hors archivés ; famille = consolidé */
const achBdgList = () => { let L = []; try { L = sviInstGet(); } catch (e) {}
  return L.filter(b => b && !b.parent && !b.rclOf && !b.virtual && !b.arch).map(b => ({ ref: b.ref, lab: achU(b.project) + " " + b.ref + (b.intitule ? " — " + achU(b.intitule) : ""), prj: achU(b.project) }))
    .sort((a, b) => a.lab.localeCompare(b.lab, "fr", { numeric: true })); };
/* charges d'un budget (consolidé s'il y a des avenants) : [{ key, des, u, q, p, mt, tasks:[« LOT › ACTIVITÉ »] }] */
const achBdgCharges = bref => {
  let d = null; try { const S = sviAvStages(bref); d = S.length > 1 ? sviAvMerge(bref) : (S[0] || {}).data; } catch (e) {}
  d = d || {};
  const nm = (k, id) => achU(((d[k] || []).find(x => x.id === id) || {}).v || "");
  const M = new Map();
  (d.chg || []).forEach(r => { if (!r || r.t || !achU(r.des)) return; const k = achKey(r.des, r.u), x = M.get(k) || { key: k, des: achU(r.des), u: achU(r.u), q: 0, mt: 0, tasks: new Set() };
    x.q += achN(r.q); x.mt += achN(r.q) * achN(r.p);
    (d.links || []).forEach(l => { if ((l.chg || []).some(c => c.id === r.id)) { const t = nm("lot", l.lot) + " › " + nm("sec", l.sec); if (t.trim() !== "›") x.tasks.add(t); } });
    M.set(k, x); });
  return [...M.values()].map(x => ({ ...x, p: x.q ? x.mt / x.q : 0, tasks: [...x.tasks].sort() })).sort((a, b) => a.des.localeCompare(b.des, "fr", { numeric: true }));
};
/* contrôle d'un besoin : prévu, déjà demandé par les AUTRES besoins non annulés, reste, dépassement, % */
const achBsnCtl = (b, L) => {
  if (!b || b.centre === "SIÈGE" || !b.bdg) return null;
  const C = achBdgCharges(b.bdg).find(x => x.key === b.chg); if (!C) return { plan: 0, planQ: 0, used: 0, usedQ: 0, rest: 0, over: true, pct: 0, none: true };
  const O = (L || achBsn()).filter(x => x.id !== b.id && x.state !== "annule" && x.bdg === b.bdg && x.chg === b.chg);
  const usedQ = O.reduce((t, x) => t + achN(x.q), 0), mine = achN(b.q), tot = usedQ + mine;
  return { plan: C.mt, planQ: C.q, pu: C.p, usedQ, used: usedQ * C.p, restQ: C.q - usedQ, over: tot > C.q + 1e-9, pct: C.q ? tot / C.q * 100 : 0 };
};
const achBsnWhy = (b, L) => {
  const w = [];
  if (b.state === "annule") return w;
  if (b.centre !== "SIÈGE" && !b.bdg) w.push("BUDGET MANQUANT (OU CENTRE DE COÛT SIÈGE)");
  if (!achU(b.des)) w.push("CHARGE MANQUANTE");
  if (!(achN(b.q) > 0)) w.push("QUANTITÉ MANQUANTE");
  if (!b.datePrevue) w.push("DATE PRÉVUE MANQUANTE");
  const c = achBsnCtl(b, L);
  if (c && c.none) w.push("CHARGE ABSENTE DU BUDGET");
  else if (c && c.over && !b.deb) w.push("DÉPASSEMENT DU PRÉVU (" + Math.round(c.pct) + " %) : BLOQUÉ — JUSTIFIER PUIS DÉBLOQUER");
  else if (c && c.over && b.deb) { /* dépassement débloqué (justifié) : plus d'alerte */ }
  else if (c && c.pct >= ACH_BSN_SEUIL) w.push("SEUIL ATTEINT : " + Math.round(c.pct) + " % DU PRÉVU DE LA CHARGE");
  return w;
};

/* =========================================================
   v761 : CONSULTATIONS et DEVIS (étape 3 — checklist Bloc C, chapitre 4)
   CONSULTATION (CAF) : une seule consultation pour PLUSIEURS fournisseurs ; lignes = besoins VALIDÉS non couverts (ou lignes libres) ;
   date limite de réponse ; suivi de la réponse de chaque fournisseur (EN ATTENTE, RÉPONDU, DÉCLINÉ) ; la réponse devient un DEVIS
   (lignes reprises, prix à saisir) ; tableau comparatif ; CLÔTURE avec le fournisseur retenu (motif obligatoire s'il n'est pas le moins cher) :
   ses besoins deviennent COUVERTS, les autres devis REJETÉS ; consultation annulée = besoins à reconsulter.
   DEVIS (DVF) : fournisseur, n° du devis fournisseur, date de validité (⚠ expiré), lignes (quantité × prix HT, TVA).
   ACHAT DIRECT : un besoin validé dont le montant estimé est sous le SEUIL (ACHATS › PARAMÈTRES) se passe de consultation.
   ========================================================= */
const achCaf = () => { const L = achJ(ACH_K.caf, []); return Array.isArray(L) ? L : []; };
const achCafSave = L => achW(ACH_K.caf, L);
const achDvf = () => { const L = achJ(ACH_K.dvf, []); return Array.isArray(L) ? L : []; };
const achDvfSave = L => achW(ACH_K.dvf, L);
const achNextRef = (pfx, L, d) => { d = d || new Date(); const p2 = x => String(x).padStart(2, "0");
  const n = L.reduce((m, b) => Math.max(m, Number((String(b.ref || "").match(/\/(\d+)$/) || [])[1]) || 0), 0) + 1;
  return pfx + " " + p2(d.getFullYear() % 100) + "-" + p2(d.getMonth() + 1) + p2(d.getDate()) + "/" + String(n).padStart(3, "0"); };
/* besoins validés pas encore couverts (ni consultation close, ni achat direct, ni dans une consultation ouverte) */
const achBsnOpen = (B, C) => { B = B || achBsn(); C = C || achCaf();
  const inOpen = new Set(C.filter(c => c.state === "ouverte").flatMap(c => (c.lignes || []).map(l => l.bsn).filter(Boolean)));
  return B.filter(b => b.state === "valide" && !b.couvert && !b.direct && !inOpen.has(b.id)); };
const achDvfTot = v => { let ht = 0, ttc = 0; (v.lignes || []).forEach(l => { const m = achN(l.q) * achN(l.pu); ht += m; ttc += m * (1 + (l.tva === "" || l.tva === undefined ? achPrm().tva : achN(l.tva)) / 100); }); return { ht, ttc }; };
const achDvfWhy = v => { const w = [], today = new Date().toISOString().slice(0, 10);
  if (v.state === "rejete" || v.state === "annule") return w;
  if (!(v.lignes || []).some(l => achN(l.pu) > 0)) w.push("PRIX MANQUANTS");
  if (!v.refFrs) w.push("N° DU DEVIS FOURNISSEUR MANQUANT");
  if (v.validite && v.validite < today && v.state !== "retenu") w.push("DEVIS EXPIRÉ (VALIDITÉ " + v.validite.split("-").reverse().join("/") + ")");
  return w; };
const achCafWhy = (c, D) => { const w = [], today = new Date().toISOString().slice(0, 10);
  if (c.state !== "ouverte") return w;
  if (!(c.lignes || []).length) w.push("AUCUNE LIGNE");
  if (!(c.frs || []).length) w.push("AUCUN FOURNISSEUR CONSULTÉ");
  const att = (c.frs || []).filter(f => ((c.rep || {})[f] || {}).st !== "repondu" && ((c.rep || {})[f] || {}).st !== "decline");
  if (c.dlim && c.dlim < today && att.length) w.push("DATE LIMITE DÉPASSÉE : " + att.length + " RÉPONSE(S) EN ATTENTE");
  const nd = (D || achDvf()).filter(v => v.caf === c.id && v.state !== "annule").length;
  if ((c.frs || []).length && nd < Math.min(3, (c.frs || []).length)) w.push("MOINS DE " + Math.min(3, (c.frs || []).length) + " DEVIS");
  return w; };

/* =========================================================
   v762 : COMMANDES, RÉCEPTIONS, RETOURS (étape 4 — checklist Bloc C, chapitres 5 et 6)
   COMMANDE (CMF) : nature (adapte la réception : PRESTATIONS = procès-verbal de service fait), fournisseur, lieu de livraison,
   date promise / confirmée, urgente à régulariser, conditions et pénalités, avance (montant ou %), remise (RMS), transport FRANCO /
   DÉPART et frais, lignes (devis d'origine et besoin rappelés), montant en lettres ; EN INSTANCE → VALIDÉE (engagement sur le budget)
   → SOLDÉE ; AVENANT (modification d'une commande validée, numérotée) ; ANNULÉE seulement sans réception.
   RÉCEPTION (RCP) : n° du bon de livraison (sauf PV), photo, date et heure, ligne par ligne ACCEPTÉE / AVEC RÉSERVES / REFUSÉE (motif),
   n° de bon (béton, camion) ; tolérance de quantité (ACHATS › PARAMÈTRES) ; levée des réserves ; livraison sans commande (à régulariser) ;
   demandeurs avertis (noté sur leur besoin). RETOURS (RTR) : de réception (lignes refusées, ou retour après acceptation) et de commande
   (reste annulé chez le fournisseur, ou commande soldée).
   ========================================================= */
const ACH_NAT = ["FOURNITURES", "PRESTATIONS ET HONORAIRES", "TRANSPORT", "LOCATION D'ENGINS", "ABONNEMENT / CONTRAT RÉCURRENT", "CARBURANT (BONS OU CARTES)"];
const achCmf = () => { const L = achJ(ACH_K.cmf, []); return Array.isArray(L) ? L : []; };
const achCmfSave = L => achW(ACH_K.cmf, L);
const achRcp = () => { const L = achJ(ACH_K.rcp, []); return Array.isArray(L) ? L : []; };
const achRcpSave = L => achW(ACH_K.rcp, L);
const achRtr = () => { const L = achJ(ACH_K.rtr, []); return Array.isArray(L) ? L : []; };
const achRtrSave = L => achW(ACH_K.rtr, L);
const achLid = () => "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const achCmfTot = c => { let ht = 0, tva = 0; const r = 1 - achN(c.rem) / 100;
  (c.lignes || []).forEach(l => { const m = achN(l.q) * achN(l.pu) * r; ht += m; tva += m * (l.tva === "" || l.tva === undefined ? achPrm().tva : achN(l.tva)) / 100; });
  const fr = achN(c.frais); ht += fr; tva += fr * achPrm().tva / 100;
  const ttc = ht + tva, av = c.avT === "pct" ? ttc * achN(c.avV) / 100 : c.avT === "mt" ? achN(c.avV) : 0;
  return { ht, tva, ttc, av }; };
/* quantité reçue d'une ligne de commande (acceptée ou avec réserves ; les refus et retours de réception sont déduits) */
const achRecQ = (cmfId, lid, R, T) => {
  const rec = (R || achRcp()).filter(r => r.cmf === cmfId && r.state !== "annule").reduce((t, r) => t + (r.lignes || []).filter(l => l.cl === lid && l.st !== "ref").reduce((u, l) => u + achN(l.q), 0), 0);
  const ret = (T || achRtr()).filter(x => x.kind === "rcp" && x.cmf === cmfId && x.after).reduce((t, x) => t + (x.lignes || []).filter(l => l.cl === lid).reduce((u, l) => u + achN(l.q), 0), 0);
  return rec - ret; };
/* quantité annulée chez le fournisseur (retours de commande) */
const achCanQ = (cmfId, lid, T) => (T || achRtr()).filter(x => x.kind === "cmd" && x.cmf === cmfId).reduce((t, x) => t + (x.lignes || []).filter(l => l.cl === lid).reduce((u, l) => u + achN(l.q), 0), 0);
const achResteQ = (c, l, R, T) => Math.max(0, achN(l.q) - achRecQ(c.id, l.id, R, T) - achCanQ(c.id, l.id, T));
const achCmfWhy = (c, R, T) => { const w = [], today = new Date().toISOString().slice(0, 10);
  if (c.state === "annule" || c.state === "solde") return w;
  if (!c.frs) w.push("FOURNISSEUR MANQUANT");
  if (!(c.lignes || []).length) w.push("AUCUNE LIGNE");
  if ((c.lignes || []).some(l => !(achN(l.pu) > 0))) w.push("PRIX MANQUANTS");
  if (c.urg) w.push("COMMANDE URGENTE À RÉGULARISER");
  const d = c.dConf || c.dProm, rest = (c.lignes || []).some(l => achResteQ(c, l, R, T) > 1e-9);
  if (c.state === "valide" && d && d < today && rest) w.push("LIVRAISON EN RETARD (PRÉVUE LE " + d.split("-").reverse().join("/") + ")");
  if (c.state === "valide" && !rest) w.push("TOUT EST REÇU : À SOLDER");
  return w; };
const achRcpWhy = r => { const w = [];
  if (r.state === "annule") return w;
  if (!r.nbl && !r.pv) w.push("N° DU BON DE LIVRAISON MANQUANT");
  if (!r.cmf) w.push("LIVRAISON SANS COMMANDE : À RÉGULARISER");
  if ((r.lignes || []).some(l => l.st === "res") && !r.resLev) w.push("RÉSERVES À LEVER");
  return w; };
/* engagement sur un budget : commandes validées (ou soldées) dont les lignes viennent de besoins de ce budget */
const achEngage = (bdg, chg) => { const B = achBsn(); let t = 0;
  achCmf().filter(c => c.state === "valide" || c.state === "solde").forEach(c => { const r = 1 - achN(c.rem) / 100;
    (c.lignes || []).forEach(l => { const b = B.find(x => x.id === l.bsn); if (b && b.bdg === bdg && (!chg || b.chg === chg)) t += achN(l.q) * achN(l.pu) * r; }); });
  return t; };

/* =========================================================
   v763 : FACTURES, AVOIRS, PAIEMENTS (étape 5 — checklist Bloc C, chapitres 7 et 8)
   FACTURE (FAF) : fournisseur, n° de la facture (doublon interdit chez le même fournisseur), date de la facture, date de RÉCEPTION
   de la facture, commande (sinon « sans commande » à régulariser), type NORMALE / ACOMPTE ; lignes reprises de la commande
   (reçu − déjà facturé) ; montants SAISIS (ceux de la facture) comparés au calcul : écart au-delà du seuil (ACHATS › PARAMÈTRES)
   → RÉCLAMER ou ACCEPTER L'ÉCART ; quantité facturée au-delà du reçu → EN ATTENTE DE RÉCEPTION ; retenue à la source sur la TVA ;
   AVANCE IMPUTÉE (avances versées sur la commande, non encore récupérées) ; échéance calculée par les conditions du fournisseur ;
   mentions obligatoires (n°, copie, ICE et IF du fournisseur) ; BON À PAYER ; reste à payer ; PAYER → paiement.
   AVOIR (AVF) : fournisseur, n° de l'avoir, facture d'origine, retour lié, montant ; déduit dans un paiement.
   PAIEMENT (PAF) : RÈGLEMENT (factures, avoirs déduits) ou AVANCE (commande) ; mode VIREMENT / CHÈQUE / LCN / ESPÈCES / PRÉLÈVEMENT ;
   n° et échéance (chèque, LCN) ; RIB principal (bloqué si le RIB est à vérifier) ; ÉMIS → ENCAISSÉ, ou REJETÉ / ANNULÉ (les factures
   redeviennent dues) ; alertes : chèque non encaissé, espèces au-delà du plafond, avance non récupérée après le délai.
   ========================================================= */
const ACH_MODES = ["VIREMENT", "CHÈQUE", "LCN", "ESPÈCES", "PRÉLÈVEMENT"];
const achFaf = () => { const L = achJ(ACH_K.faf, []); return Array.isArray(L) ? L : []; };
const achFafSave = L => achW(ACH_K.faf, L);
const achAvf = () => { const L = achJ(ACH_K.avf, []); return Array.isArray(L) ? L : []; };
const achAvfSave = L => achW(ACH_K.avf, L);
const achPaf = () => { const L = achJ(ACH_K.paf, []); return Array.isArray(L) ? L : []; };
const achPafSave = L => achW(ACH_K.paf, L);
const achPafLive = P => (P || achPaf()).filter(p => p.state !== "annule" && p.state !== "rejete" && p.state !== "instance");
/* montants calculés d'une facture (lignes × prix, remise de la commande, frais) */
const achFafCalc = f => { let ht = 0, tva = 0; const r = 1 - achN(f.rem) / 100;
  (f.lignes || []).forEach(l => { const m = achN(l.q) * achN(l.pu) * r; ht += m; tva += m * (l.tva === "" || l.tva === undefined ? achPrm().tva : achN(l.tva)) / 100; });
  const fr = achN(f.frais); ht += fr; tva += fr * achPrm().tva / 100; return { ht, tva, ttc: ht + tva }; };
/* montants retenus : ceux saisis (la facture) s'ils existent, sinon le calcul */
const achFafTot = f => { const c = achFafCalc(f), ttc = f.sTtc !== undefined && f.sTtc !== "" ? achN(f.sTtc) : c.ttc, tva = f.sTva !== undefined && f.sTva !== "" ? achN(f.sTva) : c.tva;
  const ras = f.ras ? tva * achN(f.rasT === undefined ? achPrm().rasT : f.rasT) / 100 : 0;
  return { calc: c, ttc, tva, ht: ttc - tva, ras, av: achN(f.avImp), net: ttc - ras - achN(f.avImp), ecart: ttc - c.ttc }; };
const achFafPaid = (fid, P) => achPafLive(P).reduce((t, p) => t + (p.aff || []).filter(a => a.fa === fid).reduce((u, a) => u + achN(a.m), 0), 0);
const achFafReste = (f, P) => achFafTot(f).net - achFafPaid(f.id, P);
/* v805 : encours du fournisseur = reste à payer de ses factures (hors annulées et supprimées) */
const achFrsEnc = id => achFaf().filter(x => x.frs === id && !x.del && x.state !== "annule").reduce((t, x) => t + Math.max(0, achFafReste(x)), 0);
const achAvfUsed = (aid, P) => achPafLive(P).reduce((t, p) => t + (p.ded || []).filter(a => a.av === aid).reduce((u, a) => u + achN(a.m), 0), 0);
const achAvfReste = (a, P) => achN(a.ttc) - achAvfUsed(a.id, P);
/* quantité déjà facturée d'une ligne de commande (hors la facture fid) */
const achFacQ = (cmfId, cl, fid, F) => (F || achFaf()).filter(f => f.cmf === cmfId && f.id !== fid && f.state !== "annule").reduce((t, f) => t + (f.lignes || []).filter(l => l.cl === cl).reduce((u, l) => u + achN(l.q), 0), 0);
/* avances d'une commande : versées (paiements AVANCE) − imputées sur ses factures */
const achAvVerse = (cmfId, P) => achPafLive(P).filter(p => p.type === "avance" && p.cmf === cmfId).reduce((t, p) => t + achN(p.mt), 0);
const achAvImpute = (cmfId, fid, F) => (F || achFaf()).filter(f => f.cmf === cmfId && f.id !== fid && f.state !== "annule").reduce((t, f) => t + achN(f.avImp), 0);
const achAvReste = (cmfId, fid, P, F) => Math.max(0, achAvVerse(cmfId, P) - achAvImpute(cmfId, fid, F));
/* échéance : date de la facture + jours des conditions de paiement du fournisseur (COMPTANT, À LA LIVRAISON… = le jour même) */
const achFafEch = f => { if (f.ech) return f.ech; if (!f.dFac) return ""; const fr = achFrs().find(x => x.id === f.frs), n = Number((String((fr || {}).cond || "").match(/(\d+)\s*JOURS/) || [])[1]) || 0;
  const d = new Date(f.dFac + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const achFafWhy = (f, F, P) => { const w = [], today = new Date().toISOString().slice(0, 10);
  if (f.state === "annule") return w;
  const fr = achFrs().find(x => x.id === f.frs);
  if (!f.frs) w.push("FOURNISSEUR MANQUANT");
  if (!f.num) w.push("N° DE FACTURE MANQUANT");
  else if ((F || achFaf()).some(x => x.id !== f.id && x.state !== "annule" && x.frs === f.frs && achU(x.num) === achU(f.num))) w.push("N° DE FACTURE EN DOUBLE CHEZ CE FOURNISSEUR");
  if (!f.copie) w.push("COPIE DE LA FACTURE MANQUANTE");
  if (fr && !fr.occ && !achDig(fr.ice)) w.push("ICE DU FOURNISSEUR MANQUANT");
  if (fr && !fr.occ && !achDig(fr.ifisc)) w.push("IF DU FOURNISSEUR MANQUANT");
  if (!f.dRec) w.push("DATE DE RÉCEPTION DE LA FACTURE MANQUANTE");
  if (!f.cmf && f.type !== "acompte") w.push("FACTURE SANS COMMANDE : À RÉGULARISER");
  if (f.cmf && f.type !== "acompte") { const R = achRcp(), T = achRtr();
    if ((f.lignes || []).some(l => l.cl && achN(l.q) > achRecQ(f.cmf, l.cl, R, T) - achFacQ(f.cmf, l.cl, f.id, F) + 1e-9)) w.push("EN ATTENTE DE RÉCEPTION (FACTURÉ AU-DELÀ DU REÇU)"); }
  const t = achFafTot(f);
  if (Math.abs(t.ecart) > achPrm().ecart && !f.ecOk) w.push((f.state === "reclame" ? "ÉCART RÉCLAMÉ : " : "ÉCART AVEC LE CALCUL : ") + achF2(t.ecart) + " TTC");
  const r = t.net - achFafPaid(f.id, P), e = achFafEch(f);
  if (r > 0.005 && e && e < today) w.push("ÉCHÉANCE DÉPASSÉE (" + e.split("-").reverse().join("/") + ")");
  return w; };
/* ce qui empêche le BON À PAYER (les autres alertes restent des avertissements) */
const achFafStop = (f, F) => achFafWhy(f, F).filter(x => /^(FOURNISSEUR|N° DE FACTURE|COPIE|EN ATTENTE|ÉCART)/.test(x));
const achPafWhy = (p, P) => { const w = [], today = new Date().toISOString().slice(0, 10), prm = achPrm();
  if (p.state === "annule" || p.state === "rejete") return w;
  const fr = achFrs().find(x => x.id === p.frs);
  if ((p.mode === "CHÈQUE" || p.mode === "LCN") && !p.num) w.push("N° DU " + p.mode + " MANQUANT");
  if (p.mode === "LCN" && !p.echL) w.push("ÉCHÉANCE DE LA LCN MANQUANTE");
  if ((p.mode === "VIREMENT" || p.mode === "PRÉLÈVEMENT") && fr && fr.ribChg) w.push("RIB DU FOURNISSEUR À VÉRIFIER");
  if (p.mode === "ESPÈCES" && achN(p.mt) > prm.esp) w.push("ESPÈCES AU-DELÀ DU PLAFOND (" + achF2(prm.esp) + ")");
  if (p.state === "emis" && (p.mode === "CHÈQUE" || p.mode === "LCN")) { const d0 = p.mode === "LCN" && p.echL ? p.echL : String(p.date || "").slice(0, 10);
    const lim = new Date(d0 + "T12:00:00"); lim.setDate(lim.getDate() + prm.chqj); if (d0 && lim.toISOString().slice(0, 10) < today) w.push(p.mode + " NON ENCAISSÉ APRÈS " + prm.chqj + " JOURS"); }
  if (p.type === "avance" && p.cmf && p.state !== "instance") { const lim = new Date(String(p.date || "").slice(0, 10) + "T12:00:00"); lim.setDate(lim.getDate() + prm.avj);
    if (lim.toISOString().slice(0, 10) < today && achAvReste(p.cmf, null, P) > 0.005) w.push("AVANCE NON RÉCUPÉRÉE APRÈS " + prm.avj + " JOURS"); }
  return w; };
