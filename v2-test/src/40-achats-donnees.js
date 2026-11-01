/* =========================================================
   ACHATS — DONNÉES ET RÈGLES (v749, étape 1 : articles et paramètres)
   Décisions du 31/10/2026 (checklist Qualité, Achat et Droits, bloc C) :
   - une seule façon de faire : tableaux, tri / filtre, largeurs, ordre des colonnes du budget ;
   - un ARTICLE = une charge du budget (désignation + unité) ; le budget peut aussi contenir des charges sans article ;
   - données PARTAGÉES par la base V3 (02e : clés svi_ach_…_v1 dans SVI_SHARE_RX), communes à tous les budgets ;
   - rien n'est effacé : une suppression met l'article à la CORBEILLE (restaurable), un numéro n'est jamais réutilisé.
   Règles reprises de achats.html (validées par Ahmed) : catégories, banques et codes RIB, TVA par défaut 20 %.
   ========================================================= */
const ACH_K = { art: "svi_ach_art_v1", prm: "svi_ach_prm_v1", frs: "svi_ach_frs_v1" };
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
const achJ = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v === null ? d : v; } catch (e) { return d; } };
const achW = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
/* ---------- paramètres d'achat ---------- */
const achPrm = () => { const p = achJ(ACH_K.prm, null) || {}; return { tva: p.tva === undefined ? ACH_PRM_DEF.tva : achN(p.tva), cat: Array.isArray(p.cat) ? p.cat : ACH_PRM_DEF.cat.slice(), banques: Array.isArray(p.banques) ? p.banques : ACH_PRM_DEF.banques.map(b => ({ ...b })) }; };
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
const achHistGet = code => achJ("svi_hist_v1:ACH-" + code, []) || [];
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
const ACH_DOCF = ["ATTESTATION DE RÉGULARITÉ FISCALE", "ATTESTATION CNSS", "MODÈLE J (REGISTRE DE COMMERCE)", "ATTESTATION DE RIB", "ASSURANCE", "AUTRE"];
const achDig = v => String(v ?? "").replace(/\D/g, "");
const achIceOk = v => /^\d{15}$/.test(achDig(v));
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
const achFrsWhy = (f, L) => {
  const w = [], today = new Date().toISOString().slice(0, 10), soon = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  if (!achU(f.nom)) w.push("NOM MANQUANT");
  if (!achDig(f.ice) && !f.occ) w.push("ICE MANQUANT (OU COCHER OCCASIONNEL)");
  if (achDig(f.ice) && !achIceOk(f.ice)) w.push("ICE NON VALIDE (15 CHIFFRES)");
  if (L && achDig(f.ice) && achFrsDupIce(L, f.ice, f.id)) w.push("ICE EN DOUBLE AVEC " + achFrsDupIce(L, f.ice, f.id).code);
  if ((f.ribs || []).some(r => !achRibOk(r.rib))) w.push("RIB NON VALIDE (24 CHIFFRES)");
  if (!(f.ribs || []).length && !f.occ) w.push("AUCUN RIB");
  if ((f.ribs || []).length > 1 && !(f.ribs || []).some(r => r.p)) w.push("AUCUN RIB PRINCIPAL");
  if (f.ribChg) w.push("RIB MODIFIÉ LE " + String(f.ribChg).slice(0, 10).split("-").reverse().join("/") + " : À VÉRIFIER AVANT TOUT PAIEMENT");
  (f.docf || []).forEach(d => { if (d.exp && d.exp < today) w.push("DOCUMENT EXPIRÉ : " + d.type); else if (d.exp && d.exp <= soon) w.push("DOCUMENT BIENTÔT EXPIRÉ : " + d.type); });
  return w;
};
