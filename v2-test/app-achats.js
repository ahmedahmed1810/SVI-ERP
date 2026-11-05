/* ⟪ src/40-achats-donnees.js ⟫ */
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
/* v899 : la TVA des achats est la TVA PAR DÉFAUT commune (PARAMÉTRAGE › BUDGET › TVA), vide = 0 dans les calculs */
const achPrm = () => { const p = achJ(ACH_K.prm, null) || {}; return { ...achPrm0(p), tva: sviTvaDef() ?? 0 }; };
/* série B (B12, B13, B14, B25, B32, B42) : plafonds en espèces par période, alertes de retard par étape (vide = pas d'alerte), mentions imprimées,
   seuils de validation, seuils de fréquence, plafond de transactions par défaut */
const ACH_ALR = [["bsn", "BESOIN NON COMMANDÉ"], ["cmd", "COMMANDE NON REÇUE"], ["rcp", "RÉCEPTION NON FACTURÉE"], ["faf", "FACTURE NON PAYÉE"], ["chq", "PAIEMENT (CHÈQUE, LCN) NON ENCAISSÉ"], ["av", "AVANCE NON RÉCUPÉRÉE (LE RESTE, SI PARTIELLE)"]];
const achAlr = p => { const a = p.alr && typeof p.alr === "object" ? p.alr : {}; return Object.fromEntries(ACH_ALR.map(([k]) => [k, a[k] !== undefined ? a[k] : k === "chq" ? (p.chqj === undefined ? 30 : achN(p.chqj)) : k === "av" ? (p.avj === undefined ? 90 : achN(p.avj)) : ""])); };
const achAlrJ = (p, k, d) => { const v = achAlr(p)[k]; return v === "" || v === null ? Infinity : achN(v); };
const ACH_ESP_PER = [["jour", "JOUR", 1], ["semaine", "SEMAINE", 7], ["15j", "QUINZE JOURS", 15], ["mois", "MOIS", 30], ["annee", "ANNÉE", 365], ["n", "NOMBRE DE JOURS", 0]];
const achEspL = p => Array.isArray(p.espL) ? p.espL : [{ id: "e1", per: "jour", n: "", mt: p.esp === undefined ? 5000 : achN(p.esp) }];
const achEspJour = p => { const L = achEspL(p), j = L.find(x => x.per === "jour") || L[0]; return j ? achN(j.mt) : Infinity; };
/* série B (B27) : RÉFÉRENCES — un modèle par type de pièce ; texte fixe tel quel, variables {AA} (année, 2 chiffres), {AAAA}, {MM}, {JJ},
   {NNN} (compteur, autant de chiffres que de N) ; compteur remis à zéro chaque jour (par défaut), mois, année ou jamais */
const ACH_REF_T = [["BSN", "BESOIN"], ["CAF", "CONSULTATION (DEMANDE DE DEVIS)"], ["DVF", "DEVIS DU FOURNISSEUR"], ["CMF", "COMMANDE"], ["RTC", "RETOUR DE COMMANDE"], ["RCP", "RÉCEPTION"],
  ["RTR", "RETOUR DE RÉCEPTION"], ["FAF", "FACTURE DU FOURNISSEUR"], ["AVF", "AVOIR DU FOURNISSEUR"], ["PAF", "PAIEMENT"]];
const ACH_REF_RZ = [["jour", "CHAQUE JOUR"], ["mois", "CHAQUE MOIS"], ["annee", "CHAQUE ANNÉE"], ["jamais", "JAMAIS"]];
const achRefs = p => { const r = p.refs && typeof p.refs === "object" ? p.refs : {};
  return Object.fromEntries(ACH_REF_T.map(([k]) => { const x = r[k] || {}; return [k, { m: String(x.m || "").trim() || k + " {AA}-{MM}{JJ}/{NNN}", rz: ACH_REF_RZ.some(z => z[0] === x.rz) ? x.rz : "jour" }]; })); };
const achRefFill = (m, d, n) => { const p2 = x => String(x).padStart(2, "0");
  return m.replace(/\{AAAA\}/g, d.getFullYear()).replace(/\{AA\}/g, p2(d.getFullYear() % 100)).replace(/\{MM\}/g, p2(d.getMonth() + 1)).replace(/\{JJ\}/g, p2(d.getDate()))
    .replace(/\{(N+)\}/g, (_, N) => String(n).padStart(N.length, "0")); };
const achRefRx = m => new RegExp("^" + m.split(/(\{AAAA\}|\{AA\}|\{MM\}|\{JJ\}|\{N+\})/).map(s => s === "{AAAA}" ? "\\d{4}" : /^\{(AA|MM|JJ)\}$/.test(s) ? "\\d{2}" : /^\{N+\}$/.test(s) ? "(\\d+)" : s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("") + "$");
/* série B (B29, B30) : CLAUSES — chaque article a un TYPE qui reprend sa valeur par défaut ; GÉNÉRALES = contrat type repris sur chaque nouveau
   fournisseur ; PARTICULIÈRES = reprises sur chaque nouvelle commande (imprimées en page annexe) ; modifiées sur la fiche ou la commande seulement */
const ACH_CLT = [["pay", "DÉLAI DE PAIEMENT", "60 JOURS APRÈS LA DATE DE LA FACTURE (DÉLAI LÉGAL MAXIMUM)"], ["liv", "DÉLAI DE LIVRAISON", ""], ["pen", "PÉNALITÉS DE RETARD", ""],
  ["val", "VALIDITÉ DU DEVIS", "30 JOURS"], ["av", "AVANCE SUR COMMANDE", ""], ["cond", "CONDITIONS DE PAIEMENT", ""], ["autre", "AUTRE", ""]];
const achCltDef = t => (ACH_CLT.find(x => x[0] === t) || ["", "", ""])[2];
const achCltLab = t => (ACH_CLT.find(x => x[0] === t) || ["", ""])[1];
const achClG = p => Array.isArray(p.clG) ? p.clG : ACH_CLT.filter(x => x[0] !== "autre").map((x, i) => ({ id: "g" + (i + 1), t: x[0], txt: x[2] }));
const achClP = p => Array.isArray(p.clP) ? p.clP : [{ id: "p1", t: "liv", txt: "" }, { id: "p2", t: "pen", txt: "" }];
const achClCopy = L => (L || []).map(x => ({ t: x.t, txt: x.txt || "" }));
const achPrm0 = p => ({ tol: p.tol === undefined ? 5 : achN(p.tol), direct: p.direct === undefined ? 5000 : achN(p.direct), ecart: p.ecart === undefined ? 1 : achN(p.ecart), esp: achEspJour(p), rasT: p.rasT === undefined ? 75 : achN(p.rasT), avj: achAlrJ(p, "av", p.avj === undefined ? 90 : achN(p.avj)), chqj: achAlrJ(p, "chq", p.chqj === undefined ? 30 : achN(p.chqj)), dorm: p.dorm === undefined ? 12 : achN(p.dorm), directJ: p.directJ === undefined ? 30 : Math.max(1, Math.round(achN(p.directJ)) || 1), nfrs: p.nfrs === undefined ? 3 : Math.max(1, Math.round(achN(p.nfrs)) || 1), avMax: p.avMax === undefined ? 30 : achN(p.avMax), delaiLeg: p.delaiLeg === undefined ? 60 : Math.max(1, achN(p.delaiLeg) || 60), seuilBdg: p.seuilBdg === undefined ? 90 : Math.min(100, Math.max(1, achN(p.seuilBdg) || 90)), exFin: p.exFin === undefined ? 12 : Math.min(12, Math.max(1, Math.round(achN(p.exFin)) || 12)), cat: Array.isArray(p.cat) ? p.cat : ACH_PRM_DEF.cat.slice(), socIce: p.socIce || "", socIf: p.socIf || "", banques: Array.isArray(p.banques) ? p.banques : ACH_PRM_DEF.banques.map(b => ({ ...b })), grp: (Array.isArray(p.grp) && p.grp.length ? p.grp : ACH_GRP_DEF.map(g => ({ ...g, req: g.req.slice() }))).filter(g => !ACH_GRP_OLD[g.id]), alr: achAlr(p), espL: achEspL(p), ment: p.ment && typeof p.ment === "object" ? p.ment : { ice: true, if: true }, seuV: Array.isArray(p.seuV) ? p.seuV : [],
  freqA: p.freqA === undefined ? 3 : achN(p.freqA), freqB: p.freqB === undefined ? 6 : achN(p.freqB), plafT: p.plafT === undefined ? "" : p.plafT, plafU: p.plafU === "%" ? "%" : "DH", nrep: p.nrep === undefined ? 3 : Math.max(1, Math.round(achN(p.nrep)) || 1), mrep: p.mrep === undefined ? 10 : achN(p.mrep), refs: achRefs(p), clG: achClG(p), clP: achClP(p) });
const achPrmSave = p => achW(ACH_K.prm, p);
/* v811 : lectures mémorisées. Une donnée dérivée n'est recalculée que si le texte gardé dans l'appareil a changé :
   rien à remettre à zéro, quel que soit celui qui écrit. Le résultat se lit seulement, il ne se modifie jamais. */
const ACH_MEMO = {};
const achMemo = (name, keys, fn) => { let raws; try { raws = keys.map(k => localStorage.getItem(k)); } catch (e) { return fn(); }
  const c = ACH_MEMO[name]; if (c && c.raws.length === raws.length && c.raws.every((r, i) => r === raws[i])) return c.v;
  const v = fn(); ACH_MEMO[name] = { raws, v }; return v; };
/* index rangé sur le tableau lui-même (un tableau relu = un nouvel index) */
const ACH_IDX = new WeakMap();
const achIdx = (L, name, fn) => { if (!L || typeof L !== "object") return fn(L || []); let m = ACH_IDX.get(L); if (!m) { m = {}; ACH_IDX.set(L, m); } if (!(name in m)) m[name] = fn(L); return m[name]; };
/* banque d'un RIB : ses 3 premiers chiffres (code « 101-199 » = plage) */
const achBankHasCode = (b, c) => String(b.code || "").split(/[,;\s]+/).filter(Boolean).some(x => { const m = x.match(/^(\d{3})-(\d{3})$/); return m ? +c >= +m[1] && +c <= +m[2] : x === c; });
/* B9 (série B) : les banques sont celles du PARAMÉTRAGE GÉNÉRAL › BANQUES (communes) ; les banques réglées avant dans les achats y sont reprises une fois */
const achBanks = () => { const o = sviPg();
  if (!Array.isArray(o.banques)) { const p = achJ(ACH_K.prm, null) || {}; if (Array.isArray(p.banques) && p.banques.length) { o.banques = p.banques.map(b => ({ id: b.id, p: "", lab: b.n, abr: b.abr || "", code: b.code || "" })); sviPgSave(o); } }
  return sviPgL("banques").filter(b => !b.p).map(b => ({ id: b.id, n: b.lab, abr: b.abr || "", code: b.code || "" })); };
const achAgences = bid => sviPgL("banques").filter(a => a.p === bid);
const achBankOfRib = rib => { const c = String(rib || "").replace(/\D/g, "").slice(0, 3); return c.length < 3 ? null : achBanks().find(b => achBankHasCode(b, c)) || null; };
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
/* v807 : onglet RISQUE ET MOYENS (C1.27, C1.30) */
const ACH_SOLVA = ["BONNE", "MOYENNE", "FAIBLE", "INCONNUE"];
const ACH_STRAT = ["STRATÉGIQUE", "DE SECOURS", "ORDINAIRE"];
/* v810 : groupes de fournisseurs (C1.39) — préfixe de la référence (suite simple par préfixe) et champs obligatoires, réglés dans PARAMÈTRES */
const ACH_GRP_CH = [["ice", "ICE"], ["rib", "RIB"], ["ifisc", "IF"], ["rc", "RC"], ["cnss", "CNSS"], ["attf", "ATTESTATION FISCALE"], ["assRc", "ASSURANCE RC"], ["qualif", "QUALIFICATION"], ["pays", "PAYS"], ["adresse", "ADRESSE"], ["cte", "UN CONTACT"]];
const ACH_GRP_DEF = [{ id: "loc", nom: "LOCAL", pre: "FRS", req: ["ice", "rib"] }, { id: "etr", nom: "ÉTRANGER", pre: "FRE", req: ["pays", "rib"] },
  { id: "str", nom: "SOUS-TRAITANT", pre: "STR", req: ["ice", "rib", "cnss", "attf", "assRc"] }, { id: "occ", nom: "OCCASIONNEL", pre: "OCC", req: [] }, { id: "fin", nom: "ORGANISME FINANCIER", pre: "FIN", req: [] }];
const ACH_DOCF = ["ATTESTATION DE RÉGULARITÉ FISCALE", "ATTESTATION CNSS", "MODÈLE J (REGISTRE DE COMMERCE)", "ATTESTATION DE RIB", "ASSURANCE", "ASSURANCE RESPONSABILITÉ CIVILE", "CERTIFICAT DE QUALIFICATION", "CERTIFICATION", "CONDITIONS GÉNÉRALES D'ACHAT SIGNÉES", "AUTRE"];
const achDig = v => String(v ?? "").replace(/\D/g, "");
/* v804 : l'ICE suit son masque de saisie (PARAMÉTRAGE › FORMAT › MASQUES DE SAISIE, C1.44) */
const achIceOk = v => typeof sviMaskOk === "function" ? !!sviMaskRaw(v) && sviMaskOk("ice", v) : /^\d{15}$/.test(achDig(v));
const achIceMsg = () => "ICE NON VALIDE : FORMAT " + ((typeof sviMaskOf === "function" && (sviMaskOf("ice") || {}).m) || "15 CHIFFRES");
/* v810 : clé du RIB (C1.40, validée par Ahmed le 02/11/2026) — 24 chiffres divisibles par 97, sinon refusé */
const achRibOk = v => achRibOk0(v) && achRibKeyOk(v);
const achRibKeyOk = v => { const d = achDig(v); try { return d.length === 24 && BigInt(d) % 97n === 0n; } catch (e) { return true; } };
/* B21 (série B) : RIB contrôlé avec la banque et l'agence choisies (code banque = 3 premiers chiffres, code de l'agence = 3 suivants, code ville du RIB) */
const achRibBqWhy = r => { const d = achDig(r.rib); if (d.length < 6) return ""; const B = r.bqId ? achBanks().find(b => b.id === r.bqId) : null, A = r.ag ? achAgences(r.bqId).find(a => a.id === r.ag) : null;
  if (B && B.code && !achBankHasCode(B, d.slice(0, 3))) return "RIB " + d.slice(0, 3) + "… : NE CORRESPOND PAS À LA BANQUE " + B.n + " (CODE " + B.code + ")";
  if (A && /^\d{3}$/.test(String(A.code || "")) && A.code !== d.slice(3, 6)) return "RIB : CODE VILLE " + d.slice(3, 6) + " ≠ AGENCE " + A.lab + " (" + A.code + ")";
  return ""; };
const achRibOk0 = v => /^\d{24}$/.test(achDig(v));
const achFrs = () => { const L = achJ(ACH_K.frs, []); return Array.isArray(L) ? L : []; };
const achFrsSave = L => achW(ACH_K.frs, L);
const achFrsNextCode = L => "FRS-" + String(L.reduce((m, a) => Math.max(m, Number(String(a.code || "").replace(/\D/g, "")) || 0), 0) + 1).padStart(4, "0");
const achFrsDupIce = (L, ice, id) => { const c = achDig(ice); if (!c) return null;
  const ix = achIdx(L, "ice", A => { const m = new Map(); achLive(A).forEach(f => { const k = achDig(f.ice); if (!k) return; if (!m.has(k)) m.set(k, []); m.get(k).push(f); }); return m; });
  return (ix.get(c) || []).find(f => f.id !== id) || null; };
/* v811 : liste des fournisseurs à lire seulement (mémorisée) */
const achFrsRO = () => achMemo("frs", [ACH_K.frs], achFrs);
const achFrsDupNom = (L, nom, id) => achLive(L).find(f => f.id !== id && achU(f.nom) === achU(nom)) || null;
const achFrsNew = (L, o) => {
  const now = new Date().toISOString();
  const f = { id: "F" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), code: achFrsNextCode(L), nom: achU(o.nom), denom: "", forme: "", ville: "", adresse: "", site: "", resp: "",
    ice: "", ifisc: "", rc: "", villeRc: "", patente: "", capital: 0, codeCpt: "", intCpt: "", ribs: [], cond: "", fam: [], occ: !!o.occ, orgFin: false, actif: true,
    docf: [], cte: [], evl: [], cgf: [], cla: achClCopy(achPrm().clG), plafT: achPrm().plafT, plafU: achPrm().plafU, ribChg: "", cree: now, mod: now, del: "" };
  L.push(f);
  return f;
};
const achFrsRibP = f => (f.ribs || []).find(r => r.p) || (f.ribs || [])[0] || null;
const achFrsNote = f => { const E = f.evl || []; return E.length ? E.reduce((t, x) => t + achN(x.moy), 0) / E.length : null; };
/* contrôles d'un fournisseur : liste de messages (vide = correct) */
/* v804 (checklist C1.43) : attestation de régularité fiscale expirée (la plus récente) → paiement bloqué, sauf déblocage avec motif */
const achFrsAttExp = f => { const A = ((f && f.docf) || []).filter(d => d.type === "ATTESTATION DE RÉGULARITÉ FISCALE" && d.exp).map(d => d.exp).sort();
  return A.length ? A[A.length - 1] < new Date().toISOString().slice(0, 10) : false; };
/* v809 : fournisseur utilisable dans une nouvelle pièce = ni supprimé, ni inactif, ni bloqué, ni archivé */
const achFrsOk = f => !!f && !f.del && f.actif !== false && !f.bloq && !f.arch;
/* C1.45 : dernier achat (commande ou facture) ; dormant = sans achat depuis PARAMÈTRES › dorm mois ; archivage proposé au mois de clôture de l'exercice */
/* série B (B42) : dates des commandes et dernier achat de chaque fournisseur, calculés une fois (mémorisés) */
const achFrsDates = () => achMemo("frsd", [ACH_K.cmf, ACH_K.faf], () => { const M = new Map(), of = id => { if (!M.has(id)) M.set(id, { cmd: [], last: "" }); return M.get(id); };
  achCmf().filter(c => c.frs && c.state !== "annule").forEach(c => { const x = String(c.valide || c.cree || "").slice(0, 10), o = of(c.frs); if (x) { o.cmd.push(x); if (x > o.last) o.last = x; } });
  achFaf().filter(x => x.frs && x.state !== "annule").forEach(x => { const y = String(x.dFac || x.cree || "").slice(0, 10), o = of(x.frs); if (y > o.last) o.last = y; });
  M.forEach(o => o.cmd.sort()); return M; });
const achFrsLast = id => (achFrsDates().get(id) || {}).last || "";
const achFrsDormant = f => { const d = achFrsLast(f.id) || String(f.cree || "").slice(0, 10), lim = new Date(); lim.setMonth(lim.getMonth() - achPrm().dorm); return !!d && d < lim.toISOString().slice(0, 10); };
const achExFinMois = () => new Date().getMonth() + 1 === achPrm().exFin;
/* B42 : FRÉQUENCE calculée — écart moyen entre deux commandes : FRÉQUENT jusqu'à freqA mois, NORMAL jusqu'à freqB, OCCASIONNEL au-delà ;
   DORMANT sans achat depuis « fournisseur dormant » ; moins de deux commandes = pas encore de fréquence */
const ACH_FREQ = [["frequent", "FRÉQUENT"], ["normal", "NORMAL"], ["occasionnel", "OCCASIONNEL"], ["dormant", "DORMANT"]];
const achFrsFreq = f => { if (!f) return { k: "", lab: "" }; if (achFrsDormant(f)) return { k: "dormant", lab: "DORMANT" };
  const C = (achFrsDates().get(f.id) || {}).cmd || []; if (C.length < 2) return { k: "", lab: "" };
  const P = achPrm(), m = (new Date(C[C.length - 1]) - new Date(C[0])) / 864e5 / (C.length - 1) / 30.44;
  const k = m <= P.freqA ? "frequent" : m <= P.freqB ? "normal" : "occasionnel"; return { k, lab: ACH_FREQ.find(x => x[0] === k)[1], m }; };
/* B40 (série B) : fournisseurs LIÉS (maison mère, filiale, même groupe) = un seul pour la répartition — racine commune du groupe de liens */
const achFrsRootMap = () => achMemo("froot", [ACH_K.frs], () => { const L = achFrsRO().filter(f => !f.del), P = new Map(L.map(f => [f.id, f.id]));
  const find = x => { while (P.get(x) !== x) { P.set(x, P.get(P.get(x))); x = P.get(x); } return x; };
  L.forEach(f => { if (f.lie && P.has(f.lie)) { const a = find(f.id), b = find(f.lie); if (a !== b) P.set(a < b ? b : a, a < b ? a : b); } });
  const M = new Map(); L.forEach(f => M.set(f.id, find(f.id))); return M; });
const achFrsRoot = id => achFrsRootMap().get(id) || id;
/* B33, B34, B35, B43 : achats par article sur l'année glissante (12 derniers mois) — commandes validées ou soldées, montant HT par groupe de fournisseurs */
const achBuy12 = () => achMemo("buy12", [ACH_K.cmf, ACH_K.frs], () => { const lim = new Date(); lim.setFullYear(lim.getFullYear() - 1); const L0 = lim.toISOString().slice(0, 10), M = new Map();
  achCmf().filter(c => (c.state === "valide" || c.state === "solde") && c.frs && String(c.valide || c.cree || "").slice(0, 10) >= L0).forEach(c => { const g = achFrsRoot(c.frs), r = 1 - achN(c.rem) / 100;
    (c.lignes || []).forEach(l => { const k = achKey(l.des, l.u), mt = achN(l.q) * achN(l.pu) * r; if (!(mt > 0)) return; if (!M.has(k)) M.set(k, new Map()); const m = M.get(k); m.set(g, (m.get(g) || 0) + mt); }); });
  return M; });
/* articles qu'un fournisseur vend (devis non annulés + commandes) et leurs catégories = sa SPÉCIALITÉ */
const achFrsArts = () => achMemo("frsart", [ACH_K.dvf, ACH_K.cmf, ACH_K.art], () => { const M = new Map(), add = (f, l) => { if (!f || !l.des) return; if (!M.has(f)) M.set(f, new Set()); M.get(f).add(achKey(l.des, l.u)); };
  achDvf().filter(v => v.state !== "annule").forEach(v => (v.lignes || []).forEach(l => add(v.frs, l))); achCmf().filter(c => c.state !== "annule").forEach(c => (c.lignes || []).forEach(l => add(c.frs, l))); return M; });
const achArtCatOf = k => { const a = achArts().find(x => !x.del && achKey(x.des, x.u) === k); return a ? a.cat || "" : ""; };
const achFrsSpec = f => [...new Set([...(achFrsArts().get(f.id) || [])].map(achArtCatOf).filter(Boolean))].sort();
const achFrsSim = f => { const A = achFrsArts().get(f.id) || new Set(), C = new Set(achFrsSpec(f)); if (!A.size && !C.size) return [];
  return achLive(achFrsRO()).filter(x => x.id !== f.id && !x.arch).map(x => { const B = achFrsArts().get(x.id) || new Set(), ca = [...B].filter(k => A.has(k)), cc = [...new Set([...B].map(achArtCatOf).filter(c => C.has(c)))];
    return { f: x, arts: ca, cats: cc }; }).filter(s => s.arts.length || s.cats.length).sort((a, b) => b.arts.length - a.arts.length || b.cats.length - a.cats.length || a.f.nom.localeCompare(b.f.nom)); };
/* B43 : STATISTIQUES du fournisseur — fréquence, commandes, montant sur 12 mois, part par article (son groupe de liens compte comme un seul) */
const achFrsStats = f => { const g = achFrsRoot(f.id), B = achBuy12(), parts = []; let mt = 0;
  B.forEach((m, k) => { const v = m.get(g) || 0; if (!(v > 0)) return; const tot = [...m.values()].reduce((s, x) => s + x, 0); mt += v; const [des, u] = k.split("|"); parts.push({ k, des, u, mt: v, tot, pct: tot ? v / tot * 100 : 0, n: m.size }); });
  parts.sort((a, b) => b.mt - a.mt); const D = achFrsDates().get(f.id) || { cmd: [] }; return { freq: achFrsFreq(f), n: D.cmd.length, mt, parts }; };
/* B34 : RÉPARTITION article par article — fournisseurs actifs (commande sur 12 mois, liés = un seul, sortis si leur dernier devis de l'article
   est expiré) ; part cible = 100 % ÷ nombre de fournisseurs actifs, avec la marge ± (ACHATS › PARAMÈTRES) ; alerte tant qu'il en manque */
const achDvfLastExp = () => achMemo("dvfexp", [ACH_K.dvf, ACH_K.frs], () => { const today = new Date().toISOString().slice(0, 10), M = new Map();
  achDvf().filter(v => v.frs && v.state !== "annule" && v.state !== "rejete").forEach(v => { const g = achFrsRoot(v.frs), d = String(v.date || v.cree || "").slice(0, 10);
    (v.lignes || []).forEach(l => { const k = achKey(l.des, l.u) + "#" + g, o = M.get(k); if (!o || d >= o.d) M.set(k, { d, exp: !!(v.validite && v.validite < today) }); }); });
  return M; });
const achRep = k => { const B = achBuy12().get(k) || new Map(), X = achDvfLastExp(), P = achPrm(), A = [...B.entries()].filter(([g]) => !(X.get(k + "#" + g) || {}).exp);
  const tot = A.reduce((s, [, v]) => s + v, 0), n = A.length, cible = n ? 100 / n : 0;
  return { n, need: P.nrep, cible, marge: P.mrep, tot, rows: A.map(([g, mt]) => ({ g, mt, pct: tot ? mt / tot * 100 : 0 })).sort((a, b) => b.mt - a.mt) }; };
const achRepWhy = (lignes, frs) => { const w = [], seen = new Set(), g = frs ? achFrsRoot(frs) : "", cat = new Set(achArts().filter(a => !a.del).map(a => achKey(a.des, a.u)));
  (lignes || []).forEach(l => { const k = achKey(l.des, l.u); if (seen.has(k) || !cat.has(k)) return; seen.add(k); const R = achRep(k);
    if (R.n < R.need) w.push("RÉPARTITION " + achU(l.des) + " : " + R.n + " FOURNISSEUR" + (R.n > 1 ? "S" : "") + " ACTIF" + (R.n > 1 ? "S" : "") + " SUR " + R.need + " PRÉVUS");
    const me = R.rows.find(r => r.g === g); if (me && R.n > 1 && me.pct > R.cible + R.marge) w.push("PART DU FOURNISSEUR SUR " + achU(l.des) + " : " + Math.round(me.pct) + " % (CIBLE " + Math.round(R.cible) + " % ± " + R.marge + ")"); });
  return w; };
/* B32 : PLAFOND DE TRANSACTIONS par fournisseur (montant HT sur 12 mois, ou part en % de tous les achats) ; atteint = commande refusée */
const achBuyGrp = () => achMemo("buyg", [ACH_K.cmf, ACH_K.frs], () => { const M = new Map(); let t = 0; achBuy12().forEach(m => m.forEach((v, g) => { M.set(g, (M.get(g) || 0) + v); t += v; })); return { M, t }; });
const achFrsPlafNo = (f, add) => { if (!f || f.plafT === "" || f.plafT === undefined || f.plafT === null) return ""; const L = achN(f.plafT); if (!(L > 0)) return "";
  const B = achBuyGrp(), g = achFrsRoot(f.id), mine = (B.M.get(g) || 0) + achN(add);
  if (f.plafU === "%") { const pct = B.t + achN(add) > 0 ? mine / (B.t + achN(add)) * 100 : 0; return pct > L ? "PLAFOND DE TRANSACTIONS ATTEINT : " + Math.round(pct) + " % DES ACHATS SUR 12 MOIS (PLAFOND " + L + " %)" : ""; }
  return mine > L ? "PLAFOND DE TRANSACTIONS ATTEINT : " + achF2(mine) + " HT SUR 12 MOIS (PLAFOND " + achF2(L) + " HT)" : ""; };
/* B25, B45 (série B) : CIRCUIT DE VALIDATION des commandes — le seuil le plus haut dépassé (montant HT) donne les grades qui valident ;
   RESPECTER LA HIÉRARCHIE = dans l'ordre, du plus bas au plus haut (grade 3 avant grade 1) ; sinon chaque grade peut valider seul.
   La commande envoyée est verrouillée ; un valideur l'accepte ou la renvoie avec ses remarques ; corrigée, elle repart dans le circuit. */
const achCmfSeu = c => { const ht = achCmfTot(c).ht, S = achPrm().seuV.filter(x => achN(x.mt) > 0 && ht > achN(x.mt) && (x.g || []).length).sort((a, b) => b.mt - a.mt)[0];
  return S ? { mt: achN(S.mt), g: [...new Set(S.g.map(String))].sort((a, b) => +b - +a), h: !!S.h } : null; };
const achCircNext = c => { const K = c.circ; if (!K) return []; const done = new Set((K.ok || []).map(x => String(x.g))), rest = K.g.filter(g => !done.has(g)); return K.h ? rest.slice(0, 1) : rest; };
const achCircDone = c => !!c.circ && achCircNext(c).length === 0;
const achGradeLab = g => { const x = sviPgL("grades").find(y => String(y.n) === String(g)); return "GRADE " + g + (x && x.lab ? " (" + x.lab + ")" : ""); };
/* B44 : ARCHIVÉ — dormant depuis plus de 12 mois (ou le délai « dormant » s'il est plus long), au mois de clôture de l'exercice, soldé, sans pièce
   en cours ou en attente ; liste des empêchements (vide = archivage possible) */
const achFrsArchWhy = f => { const w = [], P = achPrm(), n = Math.max(12, P.dorm), d = achFrsLast(f.id) || String(f.cree || "").slice(0, 10), lim = new Date(); lim.setMonth(lim.getMonth() - n);
  if (!d || d >= lim.toISOString().slice(0, 10)) w.push("DERNIER ACHAT IL Y A MOINS DE " + n + " MOIS");
  if (!achExFinMois()) w.push("ARCHIVAGE AU MOIS DE CLÔTURE DE L'EXERCICE (MOIS " + P.exFin + ")");
  achCmf().filter(c => c.frs === f.id && (c.state === "instance" || c.state === "valide")).forEach(c => w.push("COMMANDE EN COURS : " + c.ref));
  const PA = achPaf(); achFaf().filter(x => x.frs === f.id && x.state !== "annule" && achFafReste(x, PA) > 0.005).forEach(x => w.push("FACTURE NON SOLDÉE : " + x.ref));
  PA.filter(p => p.frs === f.id && (p.state === "instance" || p.state === "emis")).forEach(p => w.push("PAIEMENT EN COURS : " + p.ref));
  achDvf().filter(v => v.frs === f.id && v.state === "recu" && (!v.validite || v.validite >= new Date().toISOString().slice(0, 10))).forEach(v => w.push("DEVIS EN ATTENTE : " + v.ref));
  return w; };
/* B44 : un ARTICLE bloqué suit la même règle (commande arrêtée sauf autorisation exceptionnelle) */
async function achArtStop(lignes, what) { const B = achArts().filter(a => !a.del && a.bloq), hit = B.filter(a => (lignes || []).some(l => achKey(l.des, l.u) === achKey(a.des, a.u))); if (!hit.length) return false;
  const m = await achAsk("ARTICLE BLOQUÉ — " + hit.map(a => a.des).join(", "), "BLOQUÉ : " + hit.map(a => (a.bloq.why || "")).join(" ; ") + ". AUTORISATION EXCEPTIONNELLE D'UN SUPÉRIEUR POUR : " + what + " (NOM ET MOTIF)");
  if (!m) return true; hit.forEach(a => achHist(a.code, "AUTORISATION EXCEPTIONNELLE", what + " — " + m)); return false; }
/* B44 : BLOQUÉ (à la main) — plus de commande, réception, facture ni paiement, sauf AUTORISATION EXCEPTIONNELLE d'un supérieur (nom et motif, notée dans H) ;
   ARCHIVÉ — rien du tout. Renvoie true si l'opération est arrêtée. */
async function achFrsStop(fr, what) { if (!fr || !(fr.bloq || fr.arch || fr.actif === false)) return false;
  if (fr.arch) { svToast("FOURNISSEUR ARCHIVÉ : " + what + " IMPOSSIBLE (LE DÉSARCHIVER D'ABORD).", 4500); return true; }
  const m = await achAsk("FOURNISSEUR BLOQUÉ — " + fr.nom, (fr.bloq ? "BLOQUÉ : " + (fr.bloq.why || "") + ". " : "") + "AUTORISATION EXCEPTIONNELLE D'UN SUPÉRIEUR POUR : " + what + " (NOM ET MOTIF)");
  if (!m) return true; achHist(fr.code, "AUTORISATION EXCEPTIONNELLE", what + " — " + m); return false; }
/* grp absent (fiches d'avant v810) : déduit des anciennes cases ; grp vide = fournisseur créé sans groupe choisi */
/* B10, B41 (série B) : SOUS-TRAITANT et ORGANISME FINANCIER ne sont plus des groupes mais des TYPES (PARAMÉTRAGE GÉNÉRAL › TYPES DE FOURNISSEURS) :
   un fournisseur de l'ancien groupe est LOCAL, avec ce type ; le préfixe de référence et les documents exigés viennent du type */
/* B39 (série B) : pièces qu'un contact reçoit par e-mail (colonne REÇOIT des CONTACTS) ; destinataires repris par défaut sur chaque pièce */
const ACH_RECV = [["dvf", "DEV", "DEMANDES DE DEVIS"], ["cmf", "CMD", "COMMANDES"], ["rcp", "RCP", "RÉCEPTIONS"], ["faf", "FAC", "FACTURES"], ["paf", "PAI", "PAIEMENTS"]];
const achFrsRecv = (f, k) => ((f && f.cte) || []).filter(c => c.email && (c.rec || []).includes(k)).map(c => c.email);
const ACH_GRP_OLD = { str: "SOUS-TRAITANT", fin: "ORGANISME FINANCIER" };
const achFrsGrpId = f => { const g = f && typeof f.grp === "string" ? f.grp : (f && f.orgFin ? "fin" : f && f.occ ? "occ" : "loc"); return ACH_GRP_OLD[g] ? "loc" : g; };
const achFrsTypeLab = f => (f && f.type) || (f && ACH_GRP_OLD[f.grp]) || (f && f.orgFin && typeof f.grp !== "string" ? ACH_GRP_OLD.fin : "") || "";
const achFrsType = f => { const l = achFrsTypeLab(f); return l ? sviPgL("ftypes").find(t => t.lab === l) || null : null; };
const achFrsTypeDocs = f => String((achFrsType(f) || {}).docs || "").split(";").map(s => achU(s)).filter(Boolean);
const achFrsGrp = f => { const G = achMemo("grp", [ACH_K.prm], () => achPrm().grp), id = achFrsGrpId(f); return G.find(g => g.id === id) || G[0] || ACH_GRP_DEF[0]; };
const achFrsPfx = f => ((achFrsType(f) || {}).pre || "").trim() || achFrsGrp(f).pre || "FRS";
/* v811 : toutes les références calculées en une fois (même règle que achRefSvi, par préfixe) */
const achFrsRefMap = () => achMemo("ref", [ACH_K.frs, ACH_K.prm], () => {
  const out = new Map(), byP = new Map();
  achFrsRO().forEach(y => { const p = achFrsPfx(y); if (!byP.has(p)) byP.set(p, []); byP.get(p).push(y); });
  byP.forEach((G, p) => {
    const used = new Map(), byD = new Map();
    G.forEach(y => { if (y.nov) { const m = String(y.nov).match(/ (\d{2}-\d{4})\/(\d+)$/); if (m) used.set(m[1], Math.max(used.get(m[1]) || 0, +m[2])); return; }
      const d = String(y.cree || "").slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return; if (!byD.has(d)) byD.set(d, []); byD.get(d).push(y); });
    G.forEach(y => { const d = String(y.cree || "").slice(0, 10); if (y.nov || !/^\d{4}-\d{2}-\d{2}$/.test(d)) out.set(y.id, { ref: y.nov || y.code, pfx: p, cree: y.cree, nov: y.nov || "" }); });
    byD.forEach((S, d) => { const tag = d.slice(2, 4) + "-" + d.slice(5, 7) + d.slice(8, 10), u = used.get(tag) || 0;
      S.sort((a, b) => String(a.cree).localeCompare(String(b.cree)) || String(a.code).localeCompare(String(b.code)))
        .forEach((y, i) => out.set(y.id, { ref: p + " " + tag + "/" + String(u + i + 1).padStart(3, "0"), pfx: p, cree: y.cree, nov: "" })); });
  });
  return out; });
const achFrsRef = f => { const e = achFrsRefMap().get(f.id);
  if (e && e.pfx === achFrsPfx(f) && e.cree === f.cree && e.nov === (f.nov || "")) return e.ref;
  return typeof achRefSvi === "function" ? achRefSvi(f, achFrsRO().filter(y => achFrsPfx(y) === achFrsPfx(f)), achFrsPfx(f)) : f.code; };
const achFrsHas = (f, k) => k === "rib" ? (f.ribs || []).some(r => achDig(r.rib)) : k === "cte" ? (f.cte || []).some(c => c.nom || c.tel || c.email)
  : k === "attf" ? (f.docf || []).some(d => d.type === "ATTESTATION DE RÉGULARITÉ FISCALE") : k === "assRc" ? !!f.assRc : !!String(f[k] ?? "").trim();
const achFrsMissing = f => (achFrsGrp(f).req || []).filter(k => !achFrsHas(f, k)).map(k => (ACH_GRP_CH.find(c => c[0] === k) || [k, k])[1]);
/* B41 : documents exigés par le type — un nom de champ connu (CNSS, ATTESTATION FISCALE, ASSURANCE RC…) ou un document de la fiche du même nom */
const achFrsTypeMissing = f => achFrsTypeDocs(f).filter(n => { const c = ACH_GRP_CH.find(x => x[1] === n); if (c) return !achFrsHas(f, c[0]);
  return !(f.docf || []).some(d => achU(d.type) === n || (achU(d.type) === "AUTRE" && achU(d.no) === n)); });
const achFrsWhy = (f, L) => {
  const w = [], today = new Date().toISOString().slice(0, 10), soon = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  if (!achU(f.nom)) w.push("NOM MANQUANT");
  if (f.grp === "") w.push("GROUPE MANQUANT");
  else { const m = achFrsMissing(f); if (m.length) w.push("GROUPE " + achFrsGrp(f).nom + " : " + m.join(", ") + " MANQUANT" + (m.length > 1 ? "S" : "")); }
  { const m = achFrsTypeMissing(f); if (m.length) w.push("TYPE " + achFrsTypeLab(f) + " : " + m.join(", ") + " MANQUANT" + (m.length > 1 ? "S" : "")); }
  if (achDig(f.ice) && !achIceOk(f.ice)) w.push(achIceMsg());
  if (L && achDig(f.ice) && achFrsDupIce(L, f.ice, f.id)) w.push("ICE EN DOUBLE AVEC " + achFrsDupIce(L, f.ice, f.id).code);
  if ((f.ribs || []).some(r => !achRibOk(r.rib))) w.push("RIB NON VALIDE (24 CHIFFRES ET CLÉ)");
  if ((f.ribs || []).length > 1 && !(f.ribs || []).some(r => r.p)) w.push("AUCUN RIB PRINCIPAL");
  if (f.ribChg) w.push("RIB MODIFIÉ LE " + String(f.ribChg).slice(0, 10).split("-").reverse().join("/") + " : À VÉRIFIER AVANT TOUT PAIEMENT");
  /* v803 : revue de la fiche une fois par an (checklist C1.55) */
  if (f.revue && f.revue < new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10)) w.push("FICHE À REVOIR : DERNIÈRE REVUE LE " + String(f.revue).split("-").reverse().join("/"));
  if (f.bloq) w.push("BLOQUÉ : " + (f.bloq.why || ""));
  if (f.arch) w.push("ARCHIVÉ LE " + String(f.arch).slice(0, 10).split("-").reverse().join("/"));
  /* v806 : clé du RIB (C1.40) — le RIB de 24 chiffres doit être divisible par 97 ; signalé, pas bloquant */
  { const t = (f.tar || []).filter(x => x.valid && x.valid < today); if (t.length) w.push("TARIF EXPIRÉ : " + t.map(x => x.des).join(", ")); }
  /* v805 : RIB partagé avec un autre fournisseur (C1.41) ; encours au-delà du plafond ; caution échue ou bientôt échue (C1.52) */
  if (L) { const ix = achIdx(L, "rib", A => { const m = new Map(); A.forEach(o => { if (o.del) return; (o.ribs || []).forEach(q => { const k = achDig(q.rib); if (!k) return; if (!m.has(k)) m.set(k, []); m.get(k).push(o); }); }); return m; });
    (f.ribs || []).forEach(r => { const x = achDig(r.rib) && (ix.get(achDig(r.rib)) || []).find(o => o.id !== f.id); if (x) w.push("RIB PARTAGÉ AVEC " + x.code + " — " + x.nom + " : FRAUDE POSSIBLE"); }); }
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
/* v812 : seuil d'alerte du budget réglable dans PARAMÈTRES (90 % au départ) */
const achBsnSeuil = () => achPrm().seuilBdg;
/* v812 : ACHAT DIRECT cumulé (contre le fractionnement) : tous les achats directs du jour ; par article (désignation + unité)
   et par fournisseur (à la validation de la commande) sur la période de PARAMÈTRES (30 jours au départ) */
const achDirFrom = () => { const d = new Date(); d.setDate(d.getDate() - (achPrm().directJ - 1)); return d.toISOString().slice(0, 10); };
const achDirCheck = b => { const S = achPrm().direct, from = achDirFrom(), mt = achN(b.q) * achN(b.pu);
  const D = achBsn().filter(x => x.id !== b.id && x.direct && x.state !== "annule" && String(x.direct).slice(0, 10) >= from), sum = L => L.reduce((t, x) => t + achN(x.q) * achN(x.pu), 0);
  if (mt > S) return "ACHAT DIRECT IMPOSSIBLE : " + achF2(mt) + " HT DÉPASSE LE SEUIL DE " + achF2(S) + " HT";
  const today = new Date().toISOString().slice(0, 10), tot = sum(D.filter(x => String(x.direct).slice(0, 10) === today)) + mt; if (tot > S) return "ACHAT DIRECT IMPOSSIBLE : CUMUL DES ACHATS DIRECTS DU JOUR " + achF2(tot) + " HT, AU-DELÀ DU SEUIL DE " + achF2(S) + " HT";
  const k = achKey(b.des, b.u), ta = sum(D.filter(x => achKey(x.des, x.u) === k)) + mt; if (ta > S) return "ACHAT DIRECT IMPOSSIBLE : CUMUL POUR " + b.des + " " + achF2(ta) + " HT SUR " + achPrm().directJ + " JOURS, AU-DELÀ DU SEUIL DE " + achF2(S) + " HT";
  return ""; };
const achDirCmfCheck = C => { const S = achPrm().direct, from = achDirFrom(), B = new Map(achBsn().filter(b => b.direct).map(b => [b.id, b]));
  const dir = c => (c.lignes || []).filter(l => l.bsn && B.has(l.bsn)).reduce((t, l) => t + achN(l.q) * achN(l.pu), 0);
  const mine = dir(C); if (!mine) return "";
  const tot = mine + achCmf().filter(c => c.id !== C.id && c.frs === C.frs && (c.state === "valide" || c.state === "solde") && String(c.valide || "").slice(0, 10) >= from).reduce((t, c) => t + dir(c), 0);
  return tot > S ? "ACHAT DIRECT IMPOSSIBLE : CUMUL CHEZ CE FOURNISSEUR " + achF2(tot) + " HT SUR " + achPrm().directJ + " JOURS, AU-DELÀ DU SEUIL DE " + achF2(S) + " HT — PASSER PAR UNE CONSULTATION" : ""; };
const achBsn = () => { const L = achJ(ACH_K.bsn, []); return Array.isArray(L) ? L : []; };
const achBsnSave = L => achW(ACH_K.bsn, L);
const achBsnNextRef = (L, d) => achNextRef("BSN", L, d);
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
/* v813 : avancement des besoins (C4.33), calculé en une fois : en consultation, commandé, reçu (retours déduits) */
const achBsnAvMap = () => achMemo("bsnav", [ACH_K.caf, ACH_K.cmf, ACH_K.rcp, ACH_K.rtr], () => { const m = new Map(), g = id => { if (!m.has(id)) m.set(id, { cons: false, cmdQ: 0, recQ: 0 }); return m.get(id); };
  achCaf().filter(c => c.state === "ouverte").forEach(c => (c.lignes || []).forEach(l => { if (l.bsn) g(l.bsn).cons = true; }));
  const R = achRcp(), T = achRtr();
  achCmf().filter(c => c.state === "valide" || c.state === "solde").forEach(c => (c.lignes || []).forEach(l => { if (!l.bsn) return; const x = g(l.bsn);
    x.cmdQ += achN(l.q) - achCanQ(c.id, l.id, T); x.recQ += achRecQ(c.id, l.id, R, T); }));
  return m; });
const achBsnAv = b => achBsnAvMap().get(b.id) || { cons: false, cmdQ: 0, recQ: 0 };
/* v813 : quantité déjà commandée pour la même charge du même budget (C4.12), autres besoins */
const achBsnCmdChg = b => achBsn().filter(x => x.id !== b.id && x.state !== "annule" && x.bdg && x.bdg === b.bdg && x.chg === b.chg).reduce((t, x) => t + achBsnAv(x).cmdQ, 0);
const achBsnRecu = b => b.state === "valide" && achN(b.q) > 0 && achBsnAv(b).recQ >= achN(b.q) - 1e-9;
const achBsnAvLab = b => { if (b.state === "annule") return b.refus ? "REFUSÉ" : "ANNULÉ"; if (b.state !== "valide") return "EN INSTANCE";
  const a = achBsnAv(b), q = achN(b.q), pc = v => Math.round(v / q * 100) + " %";
  if (q && a.recQ >= q - 1e-9) return "REÇU (CLÔTURÉ)"; if (a.recQ > 0) return "REÇU EN PARTIE (" + pc(a.recQ) + ")";
  if (q && a.cmdQ >= q - 1e-9) return "COMMANDÉ"; if (a.cmdQ > 0) return "COMMANDÉ EN PARTIE (" + pc(a.cmdQ) + ")";
  if (b.couvert) return "DEVIS RETENU"; if (a.cons) return "EN CONSULTATION"; if (b.direct) return "ACHAT DIRECT"; return "À ACHETER"; };
/* v813 : urgence déduite de la date souhaitée (C4.6), pas de champ priorité ; risque d'arrêt du chantier = TRÈS URGENTE (C4.38) */
const achBsnJours = b => b.datePrevue ? Math.round((new Date(b.datePrevue + "T00:00:00") - new Date(new Date().toISOString().slice(0, 10) + "T00:00:00")) / 864e5) : null;
const achBsnUrg = b => { const j = achBsnJours(b); return b.arret || (j !== null && j <= 2) ? "TRÈS URGENTE" : j !== null && j <= 7 ? "URGENTE" : "NORMALE"; };
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
  else if (c && c.pct >= achBsnSeuil()) w.push("SEUIL ATTEINT : " + Math.round(c.pct) + " % DU PRÉVU DE LA CHARGE");
  /* v813 : rappel quand la date souhaitée approche (7 jours) et que rien n'est commandé (C4.34) ; risque d'arrêt signalé (C4.38) */
  if (b.state === "valide" && !b.direct) { const j = achBsnJours(b), a = achBsnAv(b);
    if (j !== null && j <= 7 && a.cmdQ < achN(b.q) - 1e-9) w.push((j < 0 ? "DATE SOUHAITÉE DÉPASSÉE DE " + (-j) + " JOUR(S)" : "DATE SOUHAITÉE DANS " + j + " JOUR(S)") + " : " + (a.cmdQ > 0 ? "PAS ENTIÈREMENT COMMANDÉ" : "RIEN COMMANDÉ") + (b.arret ? " — RISQUE D'ARRÊT DU CHANTIER" : "")); }
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
/* B27 : numéro suivant d'après le modèle du type de pièce (ACHATS › PARAMÈTRES › RÉFÉRENCES) ; le compteur ne compte que les pièces de la même
   période (jour, mois ou année de création) dont la référence suit le modèle */
const achNextRef = (pfx, L, d) => { d = d || new Date(); const R = achPrm().refs[pfx] || { m: pfx + " {AA}-{MM}{JJ}/{NNN}", rz: "jour" }, rx = achRefRx(R.m);
  const key = x => { const t = x instanceof Date ? x : new Date(x); if (isNaN(t)) return null; return R.rz === "annee" ? "" + t.getFullYear() : R.rz === "mois" ? t.getFullYear() + "-" + t.getMonth() : t.getFullYear() + "-" + t.getMonth() + "-" + t.getDate(); };
  const k0 = key(d), same = b => { if (R.rz === "jamais") return true; const v = b.cree || b.date; if (!v) return true; return key(v) === k0; };
  const n = (L || []).reduce((m, b) => { const g = String(b.ref || "").match(rx); return g && same(b) ? Math.max(m, Number(g[1]) || 0) : m; }, 0) + 1;
  return achRefFill(R.m, d, n); };
/* besoins validés pas encore couverts (ni consultation close, ni achat direct, ni dans une consultation ouverte) */
const achBsnOpen = (B, C) => { B = B || achBsn(); C = C || achCaf();
  const inOpen = new Set(C.filter(c => c.state === "ouverte").flatMap(c => (c.lignes || []).map(l => l.bsn).filter(Boolean)));
  return B.filter(b => b.state === "valide" && !b.couvert && !b.direct && !inOpen.has(b.id)); };
/* v814 : remise par ligne et remise globale (%), frais de transport HT (C5.54, C5.55) ; prix net d'une ligne = prix × (1 − remise) × (1 − remise globale) */
const achDvfPuNet = (v, l) => achN(l.pu) * (1 - achN(l.rem) / 100) * (1 - achN(v.remG) / 100);
const achDvfTot = v => { let ht = 0, ttc = 0, brut = 0; (v.lignes || []).forEach(l => { const b = achN(l.q) * achN(l.pu), m = achN(l.q) * achDvfPuNet(v, l); brut += b; ht += m; ttc += m * (1 + (l.tva === "" || l.tva === undefined ? achPrm().tva : achN(l.tva)) / 100); });
  const tr = achN(v.transp); ht += tr; ttc += tr * (1 + achPrm().tva / 100); return { ht, ttc, brut, transp: tr }; };
const achDvfWhy = v => { const w = achRepWhy(v.state === "recu" ? v.lignes : [], v.frs), today = new Date().toISOString().slice(0, 10);
  if (v.state === "rejete" || v.state === "annule") return w;
  if (!(v.lignes || []).some(l => achN(l.pu) > 0)) w.push("PRIX MANQUANTS");
  if (!v.refFrs) w.push("N° DU DEVIS FOURNISSEUR MANQUANT");
  if (v.validite && v.validite < today && v.state !== "retenu") w.push("DEVIS EXPIRÉ (VALIDITÉ " + v.validite.split("-").reverse().join("/") + ")");
  /* v814 : expiration proche (C5.60), reçu après la date limite (C5.44), total écrit ≠ calcul (C5.46), lignes non chiffrées (C5.43),
     délai trop tardif pour la date souhaitée (C5.74), documents du fournisseur expirés (C5.51) */
  else if (v.validite && v.state === "recu") { const n = Math.round((new Date(v.validite) - new Date(today)) / 864e5); if (n <= 7) w.push("DEVIS EXPIRE DANS " + n + " JOUR(S)"); }
  const c = v.caf ? achCaf().find(x => x.id === v.caf) : null;
  if (c && c.dlim && v.date && v.date > c.dlim) w.push("REÇU APRÈS LA DATE LIMITE" + (v.tardOk ? " (ACCEPTÉ : " + v.tardOk + ")" : ""));
  if (achN(v.totFrs) > 0 && Math.abs(achN(v.totFrs) - achDvfTot(v).ht) > achPrm().ecart) w.push("TOTAL ÉCRIT PAR LE FOURNISSEUR (" + achF2(v.totFrs) + ") ≠ CALCUL (" + achF2(achDvfTot(v).ht) + ")");
  { const n = (v.lignes || []).filter(l => !(achN(l.pu) > 0)).length; if (n && (v.lignes || []).some(l => achN(l.pu) > 0)) w.push(n + " LIGNE(S) NON CHIFFRÉE(S) : DEVIS PARTIEL"); }
  (v.lignes || []).forEach(l => { const b = l.bsn ? achBsn().find(x => x.id === l.bsn) : null; if (b && b.datePrevue && achN(l.delai) > 0) { const dl = new Date(Date.now() + achN(l.delai) * 864e5).toISOString().slice(0, 10); if (dl > b.datePrevue) w.push(l.des + " : LIVRÉ VERS LE " + dl.split("-").reverse().join("/") + ", APRÈS LA DATE SOUHAITÉE"); } });
  { const f = achFrs().find(x => x.id === v.frs); if (f && (f.docf || []).some(d => d.exp && d.exp < today)) w.push("FOURNISSEUR : DOCUMENT FISCAL EXPIRÉ"); }
  return w; };
const achCafWhy = (c, D) => { const w = [], today = new Date().toISOString().slice(0, 10);
  if (c.state !== "ouverte") return w;
  if (!(c.lignes || []).length) w.push("AUCUNE LIGNE");
  if (!(c.frs || []).length) w.push("AUCUN FOURNISSEUR CONSULTÉ");
  const att = (c.frs || []).filter(f => ((c.rep || {})[f] || {}).st !== "repondu" && ((c.rep || {})[f] || {}).st !== "decline");
  if (c.dlim && c.dlim < today && att.length) w.push("DATE LIMITE DÉPASSÉE : " + att.length + " RÉPONSE(S) EN ATTENTE");
  const nd = (D || achDvf()).filter(v => v.caf === c.id && v.state !== "annule").length;
  { const n = Math.min(achPrm().nfrs, (c.frs || []).length); if ((c.frs || []).length && nd < n) w.push("MOINS DE " + n + " DEVIS"); }
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
  achRepWhy(c.lignes, c.frs).forEach(x => w.push(x));
  const d = c.dConf || c.dProm, rest = (c.lignes || []).some(l => achResteQ(c, l, R, T) > 1e-9);
  if (c.state === "valide" && d && d < today && rest) w.push("LIVRAISON EN RETARD (PRÉVUE LE " + d.split("-").reverse().join("/") + ")");
  if (c.state === "valide" && !rest) w.push("TOUT EST REÇU : À SOLDER");
  /* v815 : suspension, litige, ancienne commande non soldée, date promise après la date souhaitée, doublon récent, avance au-delà du plafond (C6.45, 6.46, 6.54, 6.71, 6.76, 6.77) */
  if (c.susp) w.push("SUSPENDUE : " + (c.susp.why || ""));
  if (c.litige) w.push("EN LITIGE : " + (c.litige.why || ""));
  if (c.state === "valide" && rest && c.valide && String(c.valide).slice(0, 10) < new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10)) w.push("VALIDÉE DEPUIS PLUS DE 90 JOURS SANS ÊTRE SOLDÉE");
  if (c.state === "instance" || c.state === "valide") {
    const B = achBsn(); (c.lignes || []).forEach(l => { const b = l.bsn && B.find(x => x.id === l.bsn); if (b && b.datePrevue && d && d > b.datePrevue) w.push(l.des + " : PROMIS LE " + d.split("-").reverse().join("/") + ", APRÈS LA DATE SOUHAITÉE"); });
    const lim = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10), keys = new Set((c.lignes || []).map(l => achKey(l.des, l.u)));
    const dup = achCmf().find(x => x.id !== c.id && x.frs === c.frs && x.state !== "annule" && String(x.cree || "").slice(0, 10) >= lim && (x.lignes || []).some(l => keys.has(achKey(l.des, l.u))));
    if (dup && c.frs) w.push("COMMANDE RÉCENTE AU MÊME FOURNISSEUR POUR LE MÊME ARTICLE : " + dup.ref);
    if (c.avT === "pct" ? achN(c.avV) > achPrm().avMax : c.avT === "mt" && achCmfTot(c).ttc > 0 && achN(c.avV) / achCmfTot(c).ttc * 100 > achPrm().avMax) w.push("AVANCE AU-DELÀ DE " + achPrm().avMax + " %");
    if (!(c.lignes || []).some(l => l.bsn || l.dvf) && (c.lignes || []).length && !c.motifSans) w.push("COMMANDE SANS BESOIN NI DEVIS : MOTIF À DONNER");
  }
  return w; };
/* v815 : échéance prévisionnelle du paiement (C6.39) — date promise (ou confirmée) + délai des conditions du fournisseur */
const achCmfEch = c => { const d = c.dConf || c.dProm; if (!d) return ""; const f = achFrs().find(x => x.id === c.frs), n = Number((String((f || {}).cond || "").match(/(\d+)\s*JOURS/) || [])[1]) || 0;
  const x = new Date(d + "T00:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
/* v815 : contrôles bloquants de la validation (C6.44, 6.48, 6.50, 6.53) ; rend le motif du refus ou "" */
const achCmfValNo = c => { const today = new Date().toISOString().slice(0, 10), DV = achDvf(), f = achFrs().find(x => x.id === c.frs);
  if (f && (f.docf || []).some(x => x.exp && x.exp < today)) return "DOCUMENT FISCAL DU FOURNISSEUR EXPIRÉ : LE METTRE À JOUR (FICHE FOURNISSEUR)";
  { const no = achFrsPlafNo(f, (c.lignes || []).reduce((t, l) => t + achN(l.q) * achN(l.pu), 0) * (1 - achN(c.rem) / 100)); if (no) return no; }
  for (const l of c.lignes || []) { const v = l.dvf && DV.find(x => x.id === l.dvf); if (!v) continue;
    if (v.state === "rejete" || v.state === "annule") return "DEVIS " + v.ref + " NON RETENU OU ANNULÉ : COMMANDE REFUSÉE";
    if (v.validite && v.validite < today) return "DEVIS " + v.ref + " EXPIRÉ : COMMANDE REFUSÉE";
    const z = (v.lignes || []).find(y => achKey(y.des, y.u) === achKey(l.des, l.u)); if (z && Math.abs(achDvfPuNet(v, z) - achN(l.pu)) > 0.005 && !c.motifPrix) return "PRIX DE " + l.des + " DIFFÉRENT DU DEVIS : MOTIF DU CHANGEMENT DE PRIX À DONNER"; }
  if (f && achN(f.plafEnc) > 0) { const enc = achFrsEnc(f.id) + achCmfTot(c).ttc;   /* reste à payer des factures + cette commande */
    if (enc > achN(f.plafEnc) + 0.005) return "PLAFOND D'ENCOURS DU FOURNISSEUR DÉPASSÉ (" + achF2(enc) + " / " + achF2(f.plafEnc) + ")"; }
  if (!(c.lignes || []).some(l => l.bsn || l.dvf) && !c.motifSans) return "COMMANDE SANS BESOIN NI DEVIS : MOTIF OBLIGATOIRE";
  return ""; };
/* v913 (checklist C1.51) : distance dépôt du fournisseur → chantier du budget de la commande (à vol d'oiseau) et transport estimé */
const achCmfDist = c => {
  const f = achFrs().find(x => x.id === c.frs), B = achBsn(), refs = [...new Set((c.lignes || []).map(l => (B.find(b => b.id === l.bsn) || {}).bdg).filter(Boolean))];
  if (!f || !sviGpsParse(f.gps)) return { why: "GPS DU DÉPÔT DU FOURNISSEUR À SAISIR (FICHE)" };
  if (!refs.length) return { why: "AUCUN BUDGET LIÉ (BESOIN)" };
  let bd = null; try { bd = (sviInstGet().find(b => b.ref === refs[0]) || {}).data || null; } catch (e) { bd = null; }
  const g = bd && sviGpsParse(bd.gps); if (!g) return { why: "GPS DU CHANTIER À SAISIR (INF DU BUDGET)" };
  const km = sviGpsKm(sviGpsParse(f.gps), g), p = sviTrKm();
  return { km, cost: p === null ? null : km * p };
};
const achRcpWhy = r => { const w = [];
  if (r.state === "annule") return w;
  if (!r.nbl && !r.pv) w.push("N° DU BON DE LIVRAISON MANQUANT");
  if (!r.cmf) w.push("LIVRAISON SANS COMMANDE : À RÉGULARISER");
  if ((r.lignes || []).some(l => l.st === "res") && !r.resLev) w.push("RÉSERVES À LEVER");
  /* v816 : en attente d'essai (C7.26, C7.34), écart BL / compté (C7.20), péremption (C7.27), documents exigés (C7.24), sans facture depuis 60 jours (C7.68) */
  if ((r.lignes || []).some(l => l.st === "att") && !r.resLev) w.push("EN ATTENTE D'ESSAI : ACCEPTATION PROVISOIRE");
  (r.lignes || []).forEach(l => { if (l.qbl !== "" && l.qbl !== undefined && Math.abs(achN(l.qbl) - achN(l.q)) > 1e-9) w.push(l.des + " : BL " + achF2(l.qbl) + " / COMPTÉ " + achF2(l.q));
    if (l.per && l.per < new Date().toISOString().slice(0, 10)) w.push(l.des + " : PÉRIMÉ LE " + l.per.split("-").reverse().join("/")); });
  if (r.docsExig && !r.docsOk) w.push("DOCUMENTS EXIGÉS NON REÇUS");
  if (r.cmf && String(r.date || "").slice(0, 10) < new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10) && !achFaf().some(f => f.cmf === r.cmf && f.state !== "annule")) w.push("RÉCEPTION SANS FACTURE DEPUIS PLUS DE 60 JOURS");
  return w; };
/* v816 : réception verrouillée dès qu'une facture existe sur sa commande (C7.65) */
const achRcpFacturee = r => !!r.cmf && achFaf().some(f => f.cmf === r.cmf && f.state !== "annule");
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
/* v811 : encours de tous les fournisseurs calculé en une fois */
const achFrsEncMap = () => achMemo("enc", [ACH_K.faf, ACH_K.paf], () => { const paid = new Map(), m = new Map();
  achPafLive().forEach(p => (p.aff || []).forEach(a => paid.set(a.fa, (paid.get(a.fa) || 0) + achN(a.m))));
  achFaf().forEach(x => { if (x.del || x.state === "annule") return; const r = achFafTot(x).net - (paid.get(x.id) || 0); m.set(x.frs, (m.get(x.frs) || 0) + Math.max(0, r)); }); return m; });
const achFrsEnc = id => achFrsEncMap().get(id) || 0;
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
/* ⟪ src/41-achats-ecran.js ⟫ */
/* =========================================================
   ACHATS — ÉCRAN (v749, étape 1)
   Onglets ARTICLES, FOURNISSEURS (livraison suivante), PARAMÈTRES.
   Mêmes briques que le budget : en-têtes à tri / filtre (sviCfKit, 09c), largeurs et ordre des colonnes mémorisés
   (cwLoad / coOrder, 09), case SAISIR ICI en bas, cases cochées pour les actions, H = historique, ⚠ = à compléter.
   ========================================================= */
function sviAchInit() {
  /* v797 : forme commune des blocs posée même si aucun budget n'a encore été ouvert */
  if (typeof sviBdgRuntimeStyle === "function") sviBdgRuntimeStyle();
  const view = document.getElementById("ach");
  if (!view || view.__achOn) return;
  view.__achOn = true;
  let tab = "art", showDel = false;
  /* v755 : FILTRE PAR ÉTAT des articles (commun à toutes les listes) — ACTIF, INACTIF, CORBEILLE, TOUT ; CORBEILLE = ancien bouton */
  const A_ETATS = [["actif", "ACTIF"], ["inactif", "INACTIF"], ["corbeille", "CORBEILLE"], ["tout", "TOUT"]];
  let aEtat = "actif"; try { const e0 = localStorage.getItem("svi_ach_etat_v1"); if (A_ETATS.some(x => x[0] === e0)) aEtat = e0; } catch (e) {}
  const aOk = (a, k) => k === "tout" ? true : k === "corbeille" ? !!a.del : !a.del && (k === "inactif" ? a.actif === false : a.actif !== false);
  const setEtat = k => { aEtat = k; showDel = k === "corbeille"; try { localStorage.setItem("svi_ach_etat_v1", k); } catch (e) {} };
  showDel = aEtat === "corbeille";
  try { const t = localStorage.getItem("svi_ach_tab_v1"); if (["art", "prm", "frs", "bsn", "caf", "dvf", "cmf", "rcp", "rtc", "rtr", "faf", "avf", "paf"].includes(t)) tab = t; } catch (e) {}
  const SEL = new Set();
  const kit = sviCfKit({ key: "ach", shell: view, refresh: () => draw() });
  const { cfApply, cfHead, cfOpenMenu, cfT } = kit;
  const F2 = v => (Number(v) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ | /g, " ");
  const body = view.querySelector(".ach-body"), bar = view.querySelector(".ach-tabs");
  const h1 = view.querySelector(".section-head h1"), sub = view.querySelector(".section-head p");
  /* ---------- ARTICLES ---------- */
  let BM = null;   /* charges des budgets (lien budget), recalculées à chaque dessin */
  const ART_COLS = () => [
    ["code", "CODE", a => a.code, "center"],
    ["des", "DÉSIGNATION", a => a.des, ""],
    ["u", "U", a => a.u, "center"],
    ["cat", "CATÉGORIE", a => a.cat || "", ""],
    ["stk", "STOCKÉ", a => a.stk ? "OUI" : "NON", "center"],
    ["tva", "TVA %", a => achN(a.tva), "number"],
    ["pref", "PRIX RÉF. HT", a => achN(a.pref), "number"],
    ["pmax", "PLAFOND HT", a => achN(a.pmax), "number"],
    ["bdg", "BUDGETS", a => achArtBudgets(a, BM).length, "center"],
    ["actif", "ACTIF", a => a.actif === false ? "NON" : "OUI", "center"]
  ];
  const ACH_W = { code: 92, des: 330, u: 70, cat: 190, stk: 80, tva: 70, pref: 110, pmax: 110, bdg: 90, actif: 70, n: 260, abr: 90, codeb: 110, cat1: 330 };
  const cw = (t, k) => cwLoad()["ach_" + t + "." + k] || ACH_W[k] || 100;
  const cellIn = (a, k) => {
    const ro = !!a.del;
    if (k === "code") return `<span class="ach-code">${esc(a.code)}</span>`;
    if (k === "bdg") { const n = achArtBudgets(a, BM).length; return n ? `<button type="button" class="ach-bdg" data-bdg="${esc(a.id)}">${n}</button>` : `<span class="ach-0">0</span>`; }
    if (k === "stk" || k === "actif") { const on = k === "stk" ? !!a.stk : a.actif !== false; return `<input type="checkbox" class="ach-ck" data-f="${k}"${on ? " checked" : ""}${ro ? " disabled" : ""}>`; }
    const num = k === "tva" || k === "pref" || k === "pmax";
    const v = num ? (achN(a[k]) || k === "tva" ? F2(a[k]) : "") : (a[k] || "");
    return `<input class="ins-in ach-in${num ? " number" : ""}${k === "u" ? " center" : ""}" data-f="${k}" value="${esc(v)}"${num ? ' inputmode="decimal"' : ""}${k === "cat" ? ' data-sug="cat"' : ""}${ro ? " readonly" : ""} autocomplete="off" enterkeyhint="next">`;
  };
  const artTable = () => {
    BM = achBudgetCharges();
    const all = achArts(), rows0 = all.filter(a => aOk(a, aEtat));
    const cols = coOrder("ach_art", ART_COLS());
    const rows = cfApply("ach_art", cols, rows0);
    const nDel = all.filter(a => a.del).length, nSel = [...SEL].filter(id => rows0.some(a => a.id === id)).length;
    const W = cols.reduce((s, c) => s + cw("art", c[0]), 0) + 44 + 46;
    return `<div class="ach-tools">
        <button type="button" class="ach-b ach-etat" data-a="etat">${(A_ETATS.find(x => x[0] === aEtat) || A_ETATS[0])[1]} ▾ ${svCnt(rows.length, rows0.length)}</button>
        ${showDel ? `<button type="button" class="ach-b" data-a="restore"${nSel ? "" : " disabled"}>RESTAURER LES COCHÉS ${svCnt(nSel)}</button><button type="button" class="ach-b" data-a="back">‹ RETOUR AUX ARTICLES</button>`
          : `<button type="button" class="ach-b" data-a="frombdg">REPRENDRE LES CHARGES DES BUDGETS</button>
             <button type="button" class="ach-b" data-a="merge"${nSel >= 2 ? "" : " disabled"}>FUSIONNER LES COCHÉS ${svCnt(nSel)}</button>
             <button type="button" class="ach-b" data-a="del"${nSel ? "" : " disabled"}>SUPPRIMER LES COCHÉS ${svCnt(nSel)}</button>
             <button type="button" class="ach-b" data-a="trash"${nDel ? "" : " disabled"}>CORBEILLE ${svCnt(nDel)}</button>`}
      </div>
      <div class="ach-scroll"><table id="achArtT" class="bdg-d-table prm-table ach-table" data-ach="art" style="width:${W}px">
        <colgroup><col style="width:46px">${cols.map(c => `<col data-w="ach_art.${c[0]}" style="width:${cw("art", c[0])}px">`).join("")}<col style="width:44px"></colgroup>
        <thead><tr><th class="center ach-hh">H</th>${cols.map(c => cfHead("ach_art", c[0], c[1], c[3])).join("")}<th class="center"><input type="checkbox" class="ach-all"${rows.length && rows.every(a => SEL.has(a.id)) ? " checked" : ""}></th></tr></thead>
        <tbody>${rows.map(a => { const why = achArtWhy(a); return `<tr data-id="${esc(a.id)}" data-iid="${esc(a.id)}" class="${why.length ? "ach-bad" : ""}${a.actif === false ? " ach-off" : ""}${a.del ? " ach-deleted" : ""}">
          <td class="center"><button type="button" class="ach-h" data-h="${esc(a.code)}" title="Historique">H</button>${why.length ? `<span class="ach-warn" data-why="${esc(why.join(" · "))}">⚠</span>` : ""}</td>
          ${cols.map(c => `<td class="${c[3]}">${cellIn(a, c[0])}</td>`).join("")}
          <td class="center ins-cbc"><input type="checkbox" class="ach-cb"${SEL.has(a.id) ? " checked" : ""}></td></tr>`; }).join("")}
          ${aEtat === "corbeille" || aEtat === "inactif" ? "" : `<tr class="ach-new"><td></td>${cols.map(c => `<td class="${c[3]}">${c[0] === "des" ? `<input class="ins-in ach-newin" data-f="des" placeholder="CRÉER UN ARTICLE ICI…" autocomplete="off" enterkeyhint="next">` : ""}</td>`).join("")}<td></td></tr>`}
          ${!rows.length && showDel ? `<tr><td colspan="${cols.length + 2}" class="empty">CORBEILLE VIDE</td></tr>` : ""}
        </tbody></table></div>`;
  };
  /* ---------- FOURNISSEURS (v759, 42-achats-fournisseurs.js) ---------- */
  const FRSM = achFrsMod({ view, body, cfApply, cfHead, cw, SEL, draw: () => draw(), F2 });
  /* ---------- BESOINS (v760, 43-achats-besoins.js) ---------- */
  const BSNM = achBsnMod({ view, body, cfApply, cfHead, cw, SEL, draw: () => draw(), F2 });
  /* ---------- CONSULTATIONS et DEVIS (v761, 44-achats-consultations.js) ---------- */
  const CAFM = achCafMod({ view, body, cfApply, cfHead, cw, SEL, draw: () => draw(), F2 }), DVFM = achDvfMod({ view, body, cfApply, cfHead, cw, SEL, draw: () => draw(), F2 });
  /* ---------- COMMANDES, RÉCEPTIONS, RETOURS (v762, 45-achats-commandes.js) ---------- */
  const X = { view, body, cfApply, cfHead, cw, SEL, draw: () => draw(), F2 };
  /* v764 : ARTICLES et FOURNISSEURS au format du budget (47-achats-liste-page.js) — listes EN INSTANCE / VALIDÉS, page de l'élément */
  const NV = { art: achArtNvMod(X), frs: achFrsNvMod(X) };
  const MODS = { caf: CAFM, dvf: DVFM, cmf: achCmfMod(X), rcp: achRcpMod(X), rtc: achRtrMod(X, "cmd"), rtr: achRtrMod(X, "rcp"), faf: achFafMod(X), avf: achAvfMod(X), paf: achPafMod(X) };
  const TTL = { cmf: ["ACHATS — COMMANDES", "NATURE, LIVRAISON, AVANCE, REMISE, TRANSPORT ; VALIDER = ENGAGEMENT SUR LE BUDGET ; RÉCEPTIONNER, RETOUR DE COMMANDE, SOLDER, AVENANT"],
    rcp: ["ACHATS — RÉCEPTIONS", "BON DE LIVRAISON ET PHOTO, ACCEPTÉE / AVEC RÉSERVES / REFUSÉE PAR LIGNE, TOLÉRANCE DE QUANTITÉ ; LIVRAISON SANS COMMANDE À RÉGULARISER"],
    rtc: ["ACHATS — RETOURS DE COMMANDE", "QUANTITÉS ANNULÉES CHEZ LE FOURNISSEUR (RETOUR DE COMMANDE, COMMANDE SOLDÉE)"], rtr: ["ACHATS — RETOURS DE RÉCEPTION", "QUANTITÉS REFUSÉES OU RENDUES AU FOURNISSEUR"],
    faf: ["ACHATS — FACTURES", "N° ET COPIE, DATE DE RÉCEPTION, RAPPROCHEMENT AVEC LA COMMANDE ET LE REÇU, ÉCART (RÉCLAMER / ACCEPTER), RETENUE À LA SOURCE, AVANCE IMPUTÉE, ÉCHÉANCE ; BON À PAYER, PAYER"],
    avf: ["ACHATS — AVOIRS FOURNISSEUR", "N°, FACTURE D'ORIGINE, RETOUR LIÉ, MONTANT ; DÉDUIT DANS UN PAIEMENT"],
    paf: ["ACHATS — PAIEMENTS", "RÈGLEMENT DE FACTURES (AVOIRS DÉDUITS) OU AVANCE SUR COMMANDE ; VIREMENT, CHÈQUE, LCN, ESPÈCES, PRÉLÈVEMENT ; ÉMIS → ENCAISSÉ OU REJETÉ"] };
  /* ---------- PARAMÈTRES ---------- */
  /* ---------- PARAMÈTRES ---------- */
  /* série B (B10, B12a, B36) : ACHATS › PARAMÈTRES au format commun — onglets GÉNÉRAL, CATÉGORIES, GROUPES DE FOURNISSEURS ;
     GÉNÉRAL = règles internes (B30) alignées en colonnes régulières, puis ALERTES DE RETARD (B13), PLAFONDS EN ESPÈCES (B12),
     MENTIONS IMPRIMÉES (B14) et SEUILS DE VALIDATION (B25). Banques : PARAMÉTRAGE GÉNÉRAL (B9) ; TVA et transport : PARAMÉTRAGE GÉNÉRAL › GÉNÉRAL (B2) ;
     l'alerte du prévu du budget ira au module PRODUCTIVITÉ (B19). Les explications passent dans la bulle des champs (B16, B17). */
  const PTABS = [["gen", "GÉNÉRAL"], ["cat", "CATÉGORIES"], ["grp", "GROUPES DE FOURNISSEURS"], ["ref", "RÉFÉRENCES"], ["cla", "CLAUSES"]];
  const prmTab = () => { let k = "gen"; try { k = localStorage.getItem("svi_achprm_tab_v1") || "gen"; } catch (e) {} return PTABS.some(x => x[0] === k) ? k : "gen"; };
  const prmHTML = () => {
    const P = achPrm(), T = prmTab();
    const catRows = cfApply("ach_cat", [["cat1", "CATÉGORIE (FAMILLE D'ARTICLES)", x => x, ""]], P.cat);
    const tabs = `<div class="bdg-d-tabs ach-ptabs">${PTABS.map(([k, l]) => `<button type="button" class="bdg-d-tab tab-eq${k === T ? " active" : ""}" data-ptab="${k}">${l}</button>`).join("")}</div>`;
    /* B27 : RÉFÉRENCES — modèle et remise à zéro du compteur par type de pièce */
    if (T === "ref") return `<div class="ach-prm">${tabs}
      <div class="ach-pbox"><div class="ach-pt">RÉFÉRENCES DES PIÈCES</div><table class="bdg-d-table prm-table ach-pref"><colgroup><col style="width:300px"><col style="width:280px"><col style="width:220px"><col style="width:220px"></colgroup>
        <thead><tr><th>TYPE DE PIÈCE</th><th data-tip="TEXTE FIXE TEL QUEL ; VARIABLES ENTRE ACCOLADES : {AA} ANNÉE SUR 2 CHIFFRES ({AAAA} SUR 4), {MM} MOIS, {JJ} JOUR, {NNN} COMPTEUR (AUTANT DE CHIFFRES QUE DE N). EXEMPLE : DVF {AA}-{MM}{JJ}/{NNN} → DVF 26-0101/012">MODÈLE</th><th>EXEMPLE (AUJOURD'HUI, N° 12)</th><th>REMISE À ZÉRO DU COMPTEUR</th></tr></thead>
        <tbody>${ACH_REF_T.map(([k, l]) => { const R = P.refs[k]; return `<tr><td>${l}</td><td><input class="ins-in ach-ref" data-k="${k}" data-f="m" value="${esc(R.m)}" autocomplete="off"></td><td>${esc(achRefFill(R.m, new Date(), 12))}</td>
          <td><select class="ins-in ach-ref" data-k="${k}" data-f="rz">${ACH_REF_RZ.map(([v, t]) => `<option value="${v}"${v === R.rz ? " selected" : ""}>${t}</option>`).join("")}</select></td></tr>`; }).join("")}</tbody></table></div>
      </div>`;
    /* B29 : CLAUSES — deux tableaux pliables (générales : chaque nouveau fournisseur ; particulières : chaque nouvelle commande, page annexe) */
    if (T === "cla") { const tb = (l, ttl, L) => `<details class="ach-pbox ach-pfold" open><summary class="ach-pt">${ttl} ${svCnt(L.length)}</summary>
        <table class="bdg-d-table prm-table ach-pcl"><colgroup><col style="width:60px"><col style="width:260px"><col style="width:620px"><col style="width:44px"></colgroup>
        <thead><tr><th class="center">N°</th><th>TYPE</th><th>ARTICLE</th><th class="center"><input type="checkbox" class="ach-pall" aria-label="Tout cocher"></th></tr></thead>
        <tbody>${L.map((x, i) => `<tr data-clid="${esc(x.id)}"><td class="center">${i + 1}</td><td><select class="ins-in ach-cl" data-l="${l}" data-f="t">${ACH_CLT.map(([k, t]) => `<option value="${k}"${k === x.t ? " selected" : ""}>${t}</option>`).join("")}</select></td>
          <td><input class="ins-in ach-cl" data-l="${l}" data-f="txt" value="${esc(x.txt || "")}" autocomplete="off"></td><td class="center"><input type="checkbox" class="ach-pcb" data-xcl="${l}|${esc(x.id)}"></td></tr>`).join("")}
          <tr class="ach-new"><td></td><td colspan="2"><input class="ins-in ach-clnew" data-l="${l}" placeholder="CRÉER UN ARTICLE ICI…" autocomplete="off"></td><td></td></tr></tbody></table>
        <div class="prm-foot"><button type="button" class="prm-del ach-pdel" data-pdel="cl${l}" disabled>SUPPRIMER LES LIGNES COCHÉES <span class="svi-cnt">0</span></button></div></details>`;
      return `<div class="ach-prm">${tabs}${tb("G", "CLAUSES GÉNÉRALES D'ACHAT (CONTRAT TYPE, REPRIS SUR CHAQUE NOUVEAU FOURNISSEUR)", P.clG)}${tb("P", "CLAUSES PARTICULIÈRES (REPRISES SUR CHAQUE NOUVELLE COMMANDE, IMPRIMÉES EN ANNEXE)", P.clP)}</div>`; }
    if (T === "cat") return `<div class="ach-prm">${tabs}
      <div class="ach-pbox"><div class="ach-pt">CATÉGORIES ${svCnt ? svCnt(catRows.length, P.cat.length) : ""}</div>
        <div class="ach-scroll"><table id="achCatT" class="bdg-d-table prm-table ach-table" data-ach="cat" style="width:${cw("cat", "cat1") + 44}px"><colgroup><col data-w="ach_cat.cat1" style="width:${cw("cat", "cat1")}px"><col style="width:44px"></colgroup>
          <thead><tr>${cfHead("ach_cat", "cat1", "CATÉGORIE (FAMILLE D'ARTICLES)")}<th class="center"><input type="checkbox" class="ach-pall" aria-label="Tout cocher"></th></tr></thead>
          <tbody>${catRows.map(c => `<tr data-cat="${esc(c)}"><td><input class="ins-in ach-pin" data-p="cat" value="${esc(c)}" autocomplete="off"></td><td class="center"><input type="checkbox" class="ach-pcb" data-xcat="${esc(c)}" aria-label="Cocher"></td></tr>`).join("")}
          <tr class="ach-new"><td><input class="ins-in ach-pnew" data-p="cat" placeholder="CRÉER UNE CATÉGORIE ICI…" autocomplete="off"></td><td></td></tr></tbody></table></div>
        <div class="prm-foot"><button type="button" class="prm-del ach-pdel" data-pdel="cat" disabled>SUPPRIMER LES LIGNES COCHÉES <span class="svi-cnt">0</span></button></div></div>
      </div>`;
    if (T === "grp") return `<div class="ach-prm">${tabs}
      <div class="ach-pbox"><div class="ach-pt" data-tip="LE PRÉFIXE DONNE LA RÉFÉRENCE DU FOURNISSEUR (EX. FRE 26-1102/001), AVEC UNE SUITE PROPRE À CHAQUE PRÉFIXE ; LES CHAMPS OBLIGATOIRES SONT EXIGÉS À LA VALIDATION DU FOURNISSEUR">GROUPES DE FOURNISSEURS ${svCnt ? svCnt(P.grp.length) : ""}</div>
        <div class="ach-scroll"><table id="achGrpT" class="bdg-d-table prm-table ach-table" data-ach="grp" style="width:774px"><colgroup><col style="width:220px"><col style="width:90px"><col style="width:420px"><col style="width:44px"></colgroup>
          <thead><tr><th>GROUPE</th><th class="center">PRÉFIXE</th><th>CHAMPS OBLIGATOIRES</th><th class="center"><input type="checkbox" class="ach-pall" aria-label="Tout cocher"></th></tr></thead>
          <tbody>${P.grp.map(g => `<tr data-gid="${esc(g.id)}"><td><input class="ins-in ach-gin" data-f="nom" value="${esc(g.nom)}" autocomplete="off"></td><td class="center"><input class="ins-in ach-gin center" data-f="pre" value="${esc(g.pre || "")}" autocomplete="off"></td>
            <td><button type="button" class="ach-link ach-greq" data-greq="${esc(g.id)}">${esc((g.req || []).map(k => (ACH_GRP_CH.find(c => c[0] === k) || [k, k])[1]).join(", ") || "—")}</button></td><td class="center"><input type="checkbox" class="ach-pcb" data-xgrp="${esc(g.id)}" aria-label="Cocher"></td></tr>`).join("")}
          <tr class="ach-new"><td colspan="3"><input class="ins-in ach-gnew" placeholder="CRÉER UN GROUPE ICI…" autocomplete="off"></td><td></td></tr></tbody></table></div>
        <div class="prm-foot"><button type="button" class="prm-del ach-pdel" data-pdel="grp" disabled>SUPPRIMER LES LIGNES COCHÉES <span class="svi-cnt">0</span></button></div>
</div>
      </div>`;
    const R = [["direct", "SEUIL DE L'ACHAT DIRECT (SANS CONSULTATION), MONTANT HT", "DH", "ach-pdirect"], ["directJ", "ACHAT DIRECT — PÉRIODE DE CUMUL (J)", "JOURS"], ["tol", "TOLÉRANCE DE QUANTITÉ À LA RÉCEPTION", "%", "ach-ptol"],
      ["ecart", "ÉCART TOLÉRÉ ENTRE LA FACTURE ET LE CALCUL, TTC", "DH"], ["rasT", "RETENUE À LA SOURCE SUR LA TVA, TAUX PAR DÉFAUT", "% DE LA TVA"], ["avMax", "AVANCE SUR COMMANDE : ALERTE AU-DELÀ DE", "%"],
      ["dorm", "FOURNISSEUR DORMANT : SANS ACHAT DEPUIS", "MOIS"], ["freqA", "FRÉQUENCE : FRÉQUENT JUSQU'À", "MOIS ENTRE DEUX COMMANDES"], ["freqB", "FRÉQUENCE : NORMAL JUSQU'À (OCCASIONNEL AU-DELÀ)", "MOIS"],
      ["plafT", "PLAFOND DE TRANSACTIONS PAR FOURNISSEUR (PAR DÉFAUT)", P.plafU], ["nfrs", "NOMBRE MINIMUM DE DEVIS PAR CONSULTATION", "DEVIS"], ["nrep", "RÉPARTITION : NOMBRE DE FOURNISSEURS PAR ARTICLE", "FOURNISSEURS"], ["mrep", "RÉPARTITION : MARGE AUTOUR DE LA PART CIBLE", "± POINTS DE %"], ["exFin", "MOIS DE CLÔTURE DE L'EXERCICE (ARCHIVAGE JAMAIS AVANT 12 MOIS)", "MOIS (1 À 12)"]];
    const tip = { directJ: "LE JOUR EST TOUJOURS CUMULÉ ; PAR ARTICLE ET PAR FOURNISSEUR", tol: "AU-DESSUS DU RESTE À RECEVOIR", ecart: "ARRONDIS", nfrs: "NON BLOQUANT : MOINS DE DEVIS = ! DEVANT LE PRIX RETENU", plafT: "REPRIS À LA CRÉATION DE CHAQUE FOURNISSEUR, MODIFIABLE SUR SA FICHE ; ATTEINT = FOURNISSEUR BLOQUÉ" };
    const G = sviPgL("grades"), gl = s => String(s || "").split(/[,;\s]+/).filter(Boolean);
    return `<div class="ach-prm">${tabs}
      <div class="ach-pbox"><div class="ach-pt">RÈGLES INTERNES</div><table class="bdg-d-table prm-table ach-pgen"><colgroup><col style="width:520px"><col style="width:140px"><col style="width:220px"></colgroup>
        <thead><tr><th>RÉGLAGE</th><th class="center">VALEUR</th><th>UNITÉ</th></tr></thead><tbody>${R.map(([k, l, u, cls]) => `<tr><td${tip[k] ? ` data-tip="${esc(tip[k])}"` : ""}>${l}</td>
          <td class="center"><input class="ins-in ${cls || "ach-pnum"} number" data-pk="${k}" inputmode="decimal" value="${P[k] === "" || P[k] === undefined ? "" : esc(F2(P[k]))}" title="${esc(tip[k] || "")}" autocomplete="off"></td>
          <td>${k === "plafT" ? `<select class="ach-pplu"><option${P.plafU === "DH" ? " selected" : ""}>DH</option><option${P.plafU === "%" ? " selected" : ""}>%</option></select>` : u}</td></tr>`).join("")}</tbody></table></div>
      <div class="ach-pbox"><div class="ach-pt">ALERTES DE RETARD</div><table class="bdg-d-table prm-table ach-palr"><colgroup><col style="width:520px"><col style="width:140px"><col style="width:220px"></colgroup>
        <thead><tr><th>ÉTAPE</th><th class="center">ALERTE APRÈS</th><th>UNITÉ</th></tr></thead><tbody>${ACH_ALR.map(([k, l]) => `<tr><td>${l}</td><td class="center"><input class="ins-in ach-alr number" data-k="${k}" inputmode="numeric" value="${esc(P.alr[k] === "" ? "" : String(P.alr[k]))}" title="VIDE = PAS D'ALERTE" autocomplete="off"></td><td>JOURS</td></tr>`).join("")}</tbody></table></div>
      <div class="ach-pbox"><div class="ach-pt">PLAFONDS DES PAIEMENTS EN ESPÈCES (PAR FOURNISSEUR)</div><table class="bdg-d-table prm-table ach-pesp"><colgroup><col style="width:260px"><col style="width:120px"><col style="width:160px"><col style="width:44px"></colgroup>
        <thead><tr><th>PÉRIODE</th><th class="center">NOMBRE DE JOURS</th><th class="center">MONTANT MAXIMUM (DH)</th><th class="center"><input type="checkbox" class="ach-pall" aria-label="Tout cocher"></th></tr></thead>
        <tbody>${P.espL.map(x => `<tr data-eid="${esc(x.id)}"><td><select class="ach-esp" data-f="per">${ACH_ESP_PER.map(([k, l]) => `<option value="${k}"${x.per === k ? " selected" : ""}>${l}</option>`).join("")}</select></td>
          <td class="center"><input class="ins-in ach-esp number" data-f="n" inputmode="numeric" value="${esc(x.per === "n" ? String(x.n || "") : "")}"${x.per === "n" ? "" : " disabled"}></td><td class="center"><input class="ins-in ach-esp number" data-f="mt" inputmode="decimal" value="${esc(F2(x.mt))}"></td>
          <td class="center"><input type="checkbox" class="ach-pcb" data-xesp="${esc(x.id)}"></td></tr>`).join("")}
          <tr class="ach-new"><td colspan="3"><button type="button" class="ach-link ach-espnew">CRÉER UN PLAFOND ICI…</button></td><td></td></tr></tbody></table>
        <div class="prm-foot"><button type="button" class="prm-del ach-pdel" data-pdel="esp" disabled>SUPPRIMER LES LIGNES COCHÉES <span class="svi-cnt">0</span></button></div></div>
      <div class="ach-pbox"><div class="ach-pt">MENTIONS IMPRIMÉES SUR LES PIÈCES D'ACHAT</div><table class="bdg-d-table prm-table ach-pment"><colgroup><col style="width:520px"><col style="width:140px"></colgroup>
        <thead><tr><th>MENTION (PARAMÉTRAGE GÉNÉRAL › SOCIÉTÉ)</th><th class="center">IMPRIMÉE</th></tr></thead><tbody>${SVI_SOC_F.filter(([f]) => f !== "rs" && f !== "adr").map(([f, l]) => `<tr><td>${l}${sviSoc()[f] ? " : " + esc(sviSoc()[f]) : ""}</td><td class="center"><input type="checkbox" class="ach-ment" data-f="${f}"${P.ment[f] ? " checked" : ""}></td></tr>`).join("")}</tbody></table></div>
      <div class="ach-pbox"><div class="ach-pt">SEUILS DE VALIDATION DES COMMANDES</div><table class="bdg-d-table prm-table ach-pseu"><colgroup><col style="width:200px"><col style="width:260px"><col style="width:200px"><col style="width:44px"></colgroup>
        <thead><tr><th class="center">AU-DELÀ DE (DH HT)</th><th>GRADES QUI VALIDENT (N°, SÉPARÉS PAR ,)</th><th class="center">RESPECTER LA HIÉRARCHIE</th><th class="center"><input type="checkbox" class="ach-pall" aria-label="Tout cocher"></th></tr></thead>
        <tbody>${P.seuV.map(x => `<tr data-sid="${esc(x.id)}"><td class="center"><input class="ins-in ach-seu number" data-f="mt" inputmode="decimal" value="${esc(F2(x.mt))}"></td>
          <td><input class="ins-in ach-seu" data-f="g" value="${esc((x.g || []).join(", "))}" title="${esc(G.map(g => g.n + " = " + (g.lab || "GRADE " + g.n)).join(" ; "))}"></td>
          <td class="center"><input type="checkbox" class="ach-seu" data-f="h"${x.h ? " checked" : ""}></td><td class="center"><input type="checkbox" class="ach-pcb" data-xseu="${esc(x.id)}"></td></tr>`).join("")}
          <tr class="ach-new"><td colspan="3"><input class="ins-in ach-seunew number" inputmode="decimal" placeholder="CRÉER UN SEUIL ICI… (MONTANT)" autocomplete="off"></td><td></td></tr></tbody></table>
        <div class="prm-foot"><button type="button" class="prm-del ach-pdel" data-pdel="seu" disabled>SUPPRIMER LES LIGNES COCHÉES <span class="svi-cnt">0</span></button></div></div>
      </div>`;
  };
  /* ---------- dessin ---------- */
  /* redessin sans bouger l'écran ; la case active (ou celle visée par Entrée / Tab) est retrouvée après */
  const keepPos = fn => {
    const sc = [...view.querySelectorAll(".ach-scroll")].map(e => [e.scrollTop, e.scrollLeft]), y = window.scrollY;
    const a = document.activeElement, tr = a && view.contains(a) && a.closest("tr");
    const fk = tr && a.dataset && a.dataset.f ? { id: tr.dataset.id || "", bid: tr.dataset.bid || "", f: a.dataset.f } : null;
    fn();
    view.querySelectorAll(".ach-scroll").forEach((e, i) => { if (sc[i]) { e.scrollTop = sc[i][0]; e.scrollLeft = sc[i][1]; } });
    window.scrollTo(window.scrollX, y);
    if (fk) { const r = fk.id ? view.querySelector(`tr[data-id="${CSS.escape(fk.id)}"]`) : fk.bid ? view.querySelector(`tr[data-bid="${CSS.escape(fk.bid)}"]`) : null;
      const x = r && r.querySelector(`input[data-f="${fk.f}"]`); if (x && !x.readOnly) { x.focus(); try { x.select(); } catch (e) {} } }
    /* Entrée / Tab de la navigation commune : la case visée (retirée par le redessin) est retrouvée dans le nouveau tableau */
    setTimeout(() => { const lg = window.__sviLastGo, a2 = document.activeElement;
      if (lg && lg.k && performance.now() - lg.t < 600 && (!a2 || a2 === document.body || !view.contains(a2)) && window.sviCellFind) { const el = window.sviCellFind(lg.k); if (el && el.isConnected && view.contains(el)) { el.focus(); try { el.select(); } catch (e) {} } } }, 0);
  };
  const draw = () => keepPos(() => {
    bar.querySelectorAll(".prm-tab").forEach(b => b.classList.toggle("on", b.dataset.ach === tab));
    /* v765 : plus de rangée d'onglets : on passe d'une liste à l'autre par le menu ☰ (comme les budgets) ; pas d'étiquette du budget ici */
    bar.style.display = "none"; document.getElementById("sviScreenTag")?.remove(); document.body.classList.remove("bdg-screen");
    /* v766 : les listes ont la forme exacte de la liste des budgets (titre et ☰ dans la liste elle-même) ; la page garde l'en-tête de l'écran */
    const PM = NV[tab] || MODS[tab] || (tab === "bsn" ? BSNM : null);
    if (PM && PM.isPage) { const M = PM; body.innerHTML = M.html(); if (h1) h1.innerHTML = M.isPage() ? M.h1() : "";
      /* v776 : page = étiquette de l'écran en haut au centre (comme « BUDGET »), en-tête de l'écran caché */
      if (M.isPage()) { const t = document.createElement("div"); t.id = "sviScreenTag"; t.innerHTML = M.h1(); view.appendChild(t);   /* v787 : dans l'écran des achats — disparaît avec lui (jamais sur un budget) */ document.body.classList.add("bdg-screen"); } if (sub) sub.textContent = ""; view.classList.toggle("ach-page", M.isPage()); view.classList.toggle("ach-bdgl", !M.isPage()); achBdglSync(body); return; }
    view.classList.remove("ach-page");
    const LM = tab === "bsn" ? BSNM : MODS[tab];
    if (LM && LM.h1) { body.innerHTML = LM.html(); if (sub) sub.textContent = ""; view.classList.add("ach-bdgl"); achBdglSync(body); return; }
    view.classList.remove("ach-bdgl");
    /* v785 : PARAMÈTRES (et tout écran des achats sans liste) : même barre commune à droite du titre */
    { const sh = view.querySelector(".section-head"); if (sh && !sh.querySelector(".svi-hdr")) { sh.insertAdjacentHTML("beforeend", sviListBar()); sh.style.display = "flex"; sh.style.alignItems = "center"; } }
    if (h1 && TTL[tab]) h1.textContent = TTL[tab][0];
    else if (h1) h1.textContent = tab === "caf" ? "ACHATS — CONSULTATIONS" : tab === "dvf" ? "ACHATS — DEVIS" : tab === "bsn" ? "BESOINS" : tab === "prm" ? "ACHATS — PARAMÈTRES" : tab === "frs" ? "ACHATS — FOURNISSEURS" : showDel ? "ACHATS — CORBEILLE DES ARTICLES" : "ACHATS — ARTICLES";
    if (sub && TTL[tab]) sub.textContent = TTL[tab][1];
    else if (sub) sub.textContent = tab === "caf" ? "UNE CONSULTATION POUR PLUSIEURS FOURNISSEURS ; RÉPONSE = DEVIS ; COMPARATIF ; CLÔTURE AVEC LE RETENU (BESOINS COUVERTS)" : tab === "dvf" ? "DEVIS DES FOURNISSEURS (RÉPONSES AUX CONSULTATIONS OU HORS CONSULTATION) ; DATE DE VALIDITÉ" : tab === "bsn" ? "UN BESOIN = UNE QUANTITÉ D'UNE CHARGE DU BUDGET POUR UNE TÂCHE ; CONTRÔLÉ PAR LE PRÉVU (BLOQUÉ AU-DELÀ, JUSTIFIER PUIS DÉBLOQUER)" : tab === "frs" ? "TOUCHER LE CODE : FICHE (RIB, DOCUMENTS FISCAUX, CONTACTS, ÉVALUATIONS, CONTRATS) ; COMMUN À TOUS LES APPAREILS" : tab === "prm" ? "RÈGLES, CATÉGORIES, GROUPES ; COMMUNS À TOUS LES APPAREILS" : "UN ARTICLE = UNE CHARGE DU BUDGET (DÉSIGNATION + UNITÉ) ; COMMUN À TOUS LES BUDGETS ET À TOUS LES APPAREILS";
    body.innerHTML = MODS[tab] ? MODS[tab].html() : tab === "bsn" ? BSNM.html() : tab === "prm" ? prmHTML() : tab === "frs" ? FRSM.html() : artTable();
    body.querySelectorAll("input.ach-cb, input.ach-all").forEach(c => { if (c.classList.contains("ach-all")) { const n = body.querySelectorAll("input.ach-cb:checked").length, t = body.querySelectorAll("input.ach-cb").length; c.indeterminate = n > 0 && n < t; } });
  });
  view.__achDraw = draw;
  /* v764 : icône de bascule EN INSTANCE ⇄ VALIDÉS, placée dans le titre (hors du corps) */
  if (h1) h1.addEventListener("click", e => { const M = NV[tab] || (tab === "bsn" ? BSNM : MODS[tab]); if (M && e.target.closest("[data-nvsw]")) M.click(e); });
  /* v750 : entrée du menu ☰ (ACHAT › ARTICLES…) — ouvre l'onglet correspondant */
  view.__achOpen = (t, id) => { const M = NV[t] || MODS[t] || (t === "bsn" ? BSNM : null); if (M && M.open) M.open(id); };   /* v779 : page d'une pièce liée */
  view.__achTab = t => { Object.values(NV).forEach(M => M.close()); Object.values(MODS).forEach(M => M.close && M.close()); if (BSNM.close) BSNM.close(); if (!["art", "prm", "frs", "bsn", "caf", "dvf", "cmf", "rcp", "rtc", "rtr", "faf", "avf", "paf"].includes(t)) return; tab = t; SEL.clear(); try { localStorage.setItem("svi_ach_tab_v1", tab); } catch (err) {} draw(); };
  /* ---------- gestes ---------- */
  bar.addEventListener("click", e => {
    const b = e.target.closest(".prm-tab"); if (!b) return;
    if (b.classList.contains("off")) { svToast(b.dataset.why || "", 3000, b); return; }
    tab = b.dataset.ach; SEL.clear();
    try { localStorage.setItem("svi_ach_tab_v1", tab); } catch (err) {}
    draw();
  });
  const artOf = el => { const tr = el.closest("tr[data-id]"); if (!tr) return null; const L = achArts(); return { L, a: L.find(x => x.id === tr.dataset.id) }; };
  body.addEventListener("change", e => { const t = e.target; if (!t.matches(".ach-pall, .ach-pcb")) return; const bx = t.closest(".ach-pbox"), cbs = [...bx.querySelectorAll(".ach-pcb")];
    if (t.matches(".ach-pall")) cbs.forEach(c => { c.checked = t.checked; });
    const n = cbs.filter(c => c.checked).length, d = bx.querySelector(".ach-pdel"); if (d) { d.disabled = !n; d.querySelector(".svi-cnt").textContent = n; } });
  body.addEventListener("click", async e => {
    /* série B : onglets d'ACHATS › PARAMÈTRES ; nouveau plafond en espèces */
    const pt = e.target.closest("[data-ptab]"); if (pt) { try { localStorage.setItem("svi_achprm_tab_v1", pt.dataset.ptab); } catch (er) {} draw(); return; }
    if (e.target.closest(".ach-espnew")) { const P = achPrm(); P.espL = P.espL.concat([{ id: "e" + Date.now().toString(36), per: "mois", n: "", mt: 0 }]); achPrmSave(P); draw(); return; }
    const cf = e.target.closest(".cf-btn"); if (cf) { e.stopPropagation(); cfOpenMenu(cf); return; }
    const w = e.target.closest(".ach-warn"); if (w) { svToast(w.dataset.why, 4000, w); return; }
    const hb = e.target.closest(".ach-h"); if (hb) { achHistWin(hb.dataset.h); return; }
    if (NV[tab]) { await NV[tab].click(e); return; }
    if (tab === "frs" && await FRSM.click(e)) return;
    if (tab === "bsn" && await BSNM.click(e)) return;
    if (MODS[tab] && await MODS[tab].click(e)) return;
    const bb = e.target.closest(".ach-bdg"); if (bb) { const L = achArts(), a = L.find(x => x.id === bb.dataset.bdg); if (a) achBdgWin(a); return; }
    /* v793 (DOCUMENT UNIQUE §6.4) : cases à droite + SUPPRIMER LES LIGNES COCHÉES (plus de ✕ par ligne) */
    const pd = e.target.closest("[data-pdel]");
    if (pd) { if (pd.disabled) return; const tb = pd.closest(".ach-pbox").querySelector("table"), ck = [...tb.querySelectorAll(".ach-pcb:checked")];
      const xg = new Set(ck.map(c => c.dataset.xgrp).filter(Boolean));
      if (xg.size) { const u = achFrs().find(f => !f.del && xg.has(achFrsGrpId(f))); if (u) { svToast("GROUPE UTILISÉ PAR " + u.code + " — " + u.nom + " : SUPPRESSION REFUSÉE.", 4000); return; }
        if (xg.size >= achPrm().grp.length) { svToast("IL FAUT GARDER AU MOINS UN GROUPE.", 3000); return; } }
      const labs = ck.map(c => c.dataset.xcat || ((achPrm().grp.find(g => g.id === c.dataset.xgrp) || {}).nom || "") || (c.dataset.xesp ? "PLAFOND EN ESPÈCES" : "") || (c.dataset.xseu ? "SEUIL DE VALIDATION" : "") || (c.dataset.xcl ? "ARTICLE " + ((c.closest("tr").querySelector('input[data-f="txt"]') || {}).value || "") : "")).filter(Boolean);
      if (!ck.length || !(await svConfirm({ title: "SUPPRIMER LES LIGNES COCHÉES", html: `<ul class="svc-list">${labs.map(l => `<li>${esc(l)}</li>`).join("")}</ul>`, ok: "SUPPRIMER" }))) return;
      const P = achPrm(), xc = new Set(ck.map(c => c.dataset.xcat).filter(Boolean)), xb = new Set(ck.map(c => c.dataset.xbq).filter(Boolean));
      const xe = new Set(ck.map(c => c.dataset.xesp).filter(Boolean)), xs = new Set(ck.map(c => c.dataset.xseu).filter(Boolean));
      P.cat = P.cat.filter(c => !xc.has(c)); P.grp = P.grp.filter(g => !xg.has(g.id)); P.espL = P.espL.filter(x => !xe.has(x.id)); P.seuV = P.seuV.filter(x => !xs.has(x.id));
      const xl = new Set(ck.map(c => c.dataset.xcl).filter(Boolean)); P.clG = P.clG.filter(x => !xl.has("G|" + x.id)); P.clP = P.clP.filter(x => !xl.has("P|" + x.id)); achPrmSave(P); draw(); return; }
    /* v810 : champs obligatoires d'un groupe de fournisseurs */
    const gq = e.target.closest(".ach-greq");
    if (gq) { const P0 = achPrm(), g0 = P0.grp.find(g => g.id === gq.dataset.greq); if (!g0) return; const d = sviWinNew();
      d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: "CHAMPS OBLIGATOIRES — " + esc(g0.nom),
        body: `<div class="frs-cs">${ACH_GRP_CH.map(c => `<label class="frs-c"><input type="checkbox" class="grq-c" value="${c[0]}"${(g0.req || []).includes(c[0]) ? " checked" : ""}> ${esc(c[1])}</label>`).join("")}</div>`,
        foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button>` });
      sviWinShow(d);
      d.addEventListener("click", ev => { if (ev.target === d || ev.target.closest("[data-x]")) { d.remove(); return; } if (!ev.target.closest("[data-ok]")) return;
        const P = achPrm(), g = P.grp.find(x => x.id === g0.id); if (g) { g.req = [...d.querySelectorAll(".grq-c:checked")].map(i => i.value); achPrmSave(P); } d.remove(); draw(); });
      return; }
    const ab = e.target.closest(".ach-b"); if (!ab || ab.disabled) return;
    const L = achArts(), ids = [...SEL].filter(id => L.some(a => a.id === id));
    const act = ab.dataset.a;
    if (act === "trash") { setEtat("corbeille"); SEL.clear(); draw(); return; }
    if (act === "back") { setEtat("actif"); SEL.clear(); draw(); return; }
    if (act === "etat") { const L = achArts(); sviEtatMenu(e.target.closest("[data-a]"), A_ETATS.map(([k, lab]) => ({ k, lab, n: L.filter(a => aOk(a, k)).length })), aEtat, k => { setEtat(k); SEL.clear(); draw(); }); return; }
    if (act === "frombdg") {
      const n = achArtsFromBudgets(L);
      if (!n) { svToast("AUCUNE CHARGE DES BUDGETS SANS ARTICLE.", 3000, ab); return; }
      achArtsSave(L); svToast(n + " ARTICLE(S) CRÉÉ(S) DEPUIS LES CHARGES DES BUDGETS.", 3500, ab); draw(); return;
    }
    if (act === "del") {
      const A = ids.map(id => L.find(a => a.id === id)).filter(a => a && !a.del);
      if (!A.length || !(await svConfirm({ title: "SUPPRIMER LES ARTICLES COCHÉS", ok: "SUPPRIMER", html: `<ul class="svc-list">${A.map(a => `<li>${esc(a.code + " — " + a.des)}</li>`).join("")}</ul><div class="svc-sub">RESTAURABLES DEPUIS LA CORBEILLE ; LEURS NUMÉROS NE SERONT PAS RÉUTILISÉS.</div>`, ok: "METTRE À LA CORBEILLE" }))) return;
      const t = new Date().toISOString(); A.forEach(a => { a.del = t; a.mod = t; achHist(a.code, "CORBEILLE", a.des); });
      achArtsSave(L); SEL.clear(); draw(); return;
    }
    if (act === "restore") {
      ids.forEach(id => { const a = L.find(x => x.id === id); if (!a || !a.del) return; if (achArtDup(L, a.des, a.u, a.id)) { svToast("RESTAURATION IMPOSSIBLE : " + a.code + " EXISTE DÉJÀ (MÊME DÉSIGNATION ET UNITÉ).", 4000, ab); return; } a.del = ""; delete a.mergedInto; a.mod = new Date().toISOString(); achHist(a.code, "RESTAURATION", a.des); });
      achArtsSave(L); SEL.clear(); draw(); return;
    }
    if (act === "merge") {
      const A = ids.map(id => L.find(a => a.id === id)).filter(a => a && !a.del);
      if (A.length < 2) return;
      if (new Set(A.map(a => achU(a.u))).size > 1) { svToast("FUSION IMPOSSIBLE : LES ARTICLES COCHÉS N'ONT PAS LA MÊME UNITÉ.", 4000, ab); return; }
      const keep = await svChooseArt(A); if (!keep) return;
      achArtMerge(L, keep.id, A.filter(a => a !== keep).map(a => a.id));
      achArtsSave(L); SEL.clear(); draw();
    }
  });
  body.addEventListener("change", e => {
    const t = e.target;
    /* case « CRÉER … ICI » : une seule création, même si « change » arrive deux fois (Entrée, puis case retirée) */
    if (t.matches && t.matches(".ach-newin, .ach-pnew, .ach-bnew, .ach-gnew")) { if (t.__achDone) return; t.__achDone = true; }
    if (NV[tab]) { NV[tab].change(e); return; }
    { const PM = MODS[tab] || (tab === "bsn" ? BSNM : null); if (PM && PM.isPage && PM.isPage() && PM.change(e)) return; }   /* v779 */
    if (tab === "frs" && FRSM.change(e)) return;
    if (t.classList.contains("ach-all")) { body.querySelectorAll("tr[data-id]").forEach(tr => { if (t.checked) SEL.add(tr.dataset.id); else SEL.delete(tr.dataset.id); }); draw(); return; }
    if (t.classList.contains("ach-cb")) { const tr = t.closest("tr[data-id]"); if (t.checked) SEL.add(tr.dataset.id); else SEL.delete(tr.dataset.id); draw(); return; }
    /* paramètres — série B : plafond de transactions (unité), alertes de retard, plafonds en espèces, mentions, seuils de validation */
    if (t.classList.contains("ach-ref")) { const P = achPrm(), k = t.dataset.k, f = t.dataset.f, v = f === "m" ? String(t.value).trim() : t.value;
      if (f === "m" && v && !/\{N+\}/.test(v)) { svToast("LE MODÈLE DOIT CONTENIR LE COMPTEUR {NNN}.", 3500, t); draw(); return; }
      P.refs = { ...P.refs, [k]: { ...P.refs[k], [f]: v } }; achPrmSave(P); draw(); return; }
    if (t.classList.contains("ach-cl") || t.classList.contains("ach-clnew")) { const P = achPrm(), l = "cl" + t.dataset.l, L = P[l].map(x => ({ ...x }));
      if (t.classList.contains("ach-clnew")) { const v = achU(t.value); if (!v) return; L.push({ id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), t: "autre", txt: v }); }
      else { const x = L.find(y => y.id === t.closest("tr").dataset.clid); if (!x) return;
        if (t.dataset.f === "t") { if (!x.txt || x.txt === achCltDef(x.t)) x.txt = achCltDef(t.value); x.t = t.value; } else x.txt = achU(t.value); }
      P[l] = L; achPrmSave(P); draw(); return; }
    if (t.classList.contains("ach-pplu")) { const P = achPrm(); P.plafU = t.value; achPrmSave(P); draw(); return; }
    if (t.classList.contains("ach-alr")) { const P = achPrm(), s = String(t.value).trim(); if (s && !/^\d+$/.test(s)) { svToast("NOMBRE DE JOURS (VIDE = PAS D'ALERTE).", 3000, t); draw(); return; } P.alr = { ...P.alr, [t.dataset.k]: s === "" ? "" : +s }; achPrmSave(P); draw(); return; }
    if (t.classList.contains("ach-esp")) { const P = achPrm(), x = P.espL.find(y => y.id === t.closest("tr").dataset.eid); if (!x) return; const f = t.dataset.f;
      if (f === "per") x.per = t.value; else { const v = achN(t.value); if (v < 0 || (f === "n" && !(v >= 1))) { svToast("VALEUR NON VALIDE.", 3000, t); draw(); return; } x[f] = v; } achPrmSave(P); draw(); return; }
    if (t.classList.contains("ach-ment")) { const P = achPrm(); P.ment = { ...P.ment, [t.dataset.f]: t.checked }; achPrmSave(P); return; }
    if (t.classList.contains("ach-seu") || t.classList.contains("ach-seunew")) { const P = achPrm(), gr = sviPgL("grades").map(g => String(g.n));
      if (t.classList.contains("ach-seunew")) { const v = achN(t.value); if (!(v > 0)) return; P.seuV = P.seuV.concat([{ id: "s" + Date.now().toString(36), mt: v, g: [], h: true }]).sort((a, b) => a.mt - b.mt); achPrmSave(P); draw(); return; }
      const x = P.seuV.find(y => y.id === t.closest("tr").dataset.sid); if (!x) return; const f = t.dataset.f;
      if (f === "h") x.h = t.checked; else if (f === "mt") { const v = achN(t.value); if (!(v > 0)) { svToast("MONTANT NON VALIDE.", 3000, t); draw(); return; } x.mt = v; }
      else { const L = String(t.value).split(/[,;\s]+/).filter(Boolean), bad = L.filter(g => !gr.includes(g)); if (bad.length) { svToast("GRADE INCONNU : " + bad.join(", ") + " (PARAMÉTRAGE GÉNÉRAL › GRADES).", 3500, t); draw(); return; } x.g = [...new Set(L)].sort((a, b) => b - a); }
      P.seuV.sort((a, b) => a.mt - b.mt); achPrmSave(P); draw(); return; }
    if (t.classList.contains("ach-ptol")) { const P = achPrm(), v = achN(t.value); if (v < 0 || v > 100) { svToast("TOLÉRANCE NON VALIDE (0 À 100 %).", 3000, t); draw(); return; } P.tol = v; achPrmSave(P); draw(); return; }
    if (t.classList.contains("ach-pdirect")) { const P = achPrm(), v = achN(t.value); if (v < 0) { svToast("SEUIL NON VALIDE.", 3000, t); draw(); return; } P.direct = v; achPrmSave(P); draw(); return; }
    if (t.classList.contains("ach-pnum") && t.dataset.pk === "plafT" && String(t.value).trim() === "") { const P = achPrm(); P.plafT = ""; achPrmSave(P); draw(); return; }
    if (t.classList.contains("ach-pnum")) { const P = achPrm(), v = achN(t.value), k = t.dataset.pk; if (v < 0 || ((k === "rasT" || k === "seuilBdg") && v > 100) || (["directJ", "nfrs", "nrep", "seuilBdg", "exFin"].includes(k) && v < 1) || (k === "mrep" && v > 100) || (k === "exFin" && v > 12)) { svToast("VALEUR NON VALIDE.", 3000, t); draw(); return; } P[k] = v; achPrmSave(P); draw(); return; }
    if (t.classList.contains("ach-ptxt")) { const P = achPrm(), k = t.dataset.pk, v = achDig(t.value); if (k === "socIce" && v && !achIceOk(v)) { svToast(achIceMsg() + ".", 3500, t); draw(); return; } P[k] = v; achPrmSave(P); draw(); return; }
    if (t.classList.contains("ach-pnew") || t.classList.contains("ach-pin")) {
      const P = achPrm(), v = achU(t.value), old = t.closest("tr").dataset.cat;
      if (v && P.cat.some(c => c === v && c !== old)) { svToast("DOUBLON : " + v + " EXISTE DÉJÀ.", 3000, t); draw(); return; }
      if (old !== undefined) { P.cat = v ? P.cat.map(c => c === old ? v : c) : P.cat.filter(c => c !== old); if (v && v !== old) { const L = achArts(); L.forEach(a => { if (a.cat === old) { a.cat = v; a.mod = new Date().toISOString(); } }); achArtsSave(L); } }
      else if (v) P.cat.push(v);
      achPrmSave(P); draw(); return;
    }
    if (t.classList.contains("ach-bnew")) { const v = achU(t.value); if (!v) return; const P = achPrm(); if (P.banques.some(b => achU(b.n) === v)) { svToast("DOUBLON : " + v + " EXISTE DÉJÀ.", 3000, t); draw(); return; } P.banques.push({ id: "B" + Date.now().toString(36), n: v, abr: "", code: "" }); achPrmSave(P); draw();
      setTimeout(() => body.querySelector(`tr[data-bid="${P.banques[P.banques.length - 1].id}"] input[data-f="abr"]`)?.focus(), 0); return; }
    /* v810 : groupes de fournisseurs */
    if (t.classList.contains("ach-gnew")) { const v = achU(t.value); if (!v) return; const P = achPrm(); if (P.grp.some(g => achU(g.nom) === v)) { svToast("DOUBLON : " + v + " EXISTE DÉJÀ.", 3000, t); draw(); return; }
      const id = "G" + Date.now().toString(36); P.grp.push({ id, nom: v, pre: "", req: [] }); achPrmSave(P); draw(); setTimeout(() => body.querySelector(`tr[data-gid="${id}"] input[data-f="pre"]`)?.focus(), 0); return; }
    if (t.classList.contains("ach-gin")) { const P = achPrm(), g = P.grp.find(x => x.id === t.closest("tr").dataset.gid); if (!g) return; const f = t.dataset.f, v = achU(t.value);
      if (f === "nom") { if (!v) { svToast("NOM DU GROUPE OBLIGATOIRE.", 3000, t); draw(); return; } if (P.grp.some(x => x.id !== g.id && achU(x.nom) === v)) { svToast("DOUBLON : " + v + " EXISTE DÉJÀ.", 3000, t); draw(); return; } }
      if (f === "pre") { if (!/^[A-Z]{2,5}$/.test(v)) { svToast("PRÉFIXE : 2 À 5 LETTRES (EX. FRE).", 3500, t); draw(); return; }
        const u = achFrs().find(x => !x.del && achSt(x) !== "instance" && !x.nov && achFrsGrpId(x) === g.id); if (u && v !== g.pre) { svToast("PRÉFIXE FIGÉ : LE GROUPE A DES FOURNISSEURS VALIDÉS (" + u.code + "), LEUR RÉFÉRENCE CHANGERAIT.", 4500, t); draw(); return; } }
      g[f] = v; achPrmSave(P); draw(); return; }
    if (t.classList.contains("ach-bin")) {
      const P = achPrm(), b = P.banques.find(x => x.id === t.closest("tr").dataset.bid); if (!b) return;
      const f = t.dataset.f, v = f === "code" ? String(t.value || "").replace(/[^\d\-,; ]/g, "").trim() : achU(t.value);
      if (f === "code" && v && !/^\d{3}(-\d{3})?([,; ]+\d{3}(-\d{3})?)*$/.test(v)) { svToast("CODE RIB : 3 CHIFFRES (EX. 007) OU UNE PLAGE (EX. 101-199).", 3500, t); draw(); return; }
      b[f] = v; achPrmSave(P); draw(); return;
    }
    /* articles */
    if (t.classList.contains("ach-newin")) {
      const v = achU(t.value); if (!v) return;
      const L = achArts(), a = achArtNew(L, { des: v, u: "" });
      achHist(a.code, "CRÉATION", v); achArtsSave(L); draw();
      setTimeout(() => body.querySelector(`tr[data-id="${a.id}"] input[data-f="u"]`)?.focus(), 0); return;
    }
    const o = artOf(t); if (!o || !o.a || o.a.del) return;
    const { L, a } = o, f = t.dataset.f;
    if (t.classList.contains("ach-ck")) { const old = f === "stk" ? !!a.stk : a.actif !== false; if (f === "stk") a.stk = t.checked; else a.actif = t.checked; a.mod = new Date().toISOString(); achHist(a.code, "MODIFICATION", (f === "stk" ? "STOCKÉ" : "ACTIF") + " : " + (old ? "OUI" : "NON") + " → " + (t.checked ? "OUI" : "NON")); achArtsSave(L); draw(); return; }
    if (!t.classList.contains("ach-in")) return;
    const num = f === "tva" || f === "pref" || f === "pmax";
    const v = num ? achN(t.value) : achU(t.value);
    if (num && String(t.value).trim() && !(typeof sviNumOk === "function" ? sviNumOk(t.value) : isFinite(achN(t.value)))) { svToast("NOMBRE NON VALIDE.", 3000, t); draw(); return; }
    if (f === "tva" && (v < 0 || v > 100)) { svToast("TVA NON VALIDE (0 À 100).", 3000, t); draw(); return; }
    if (f === "des" && !v) { svToast("DÉSIGNATION OBLIGATOIRE (POUR RETIRER L'ARTICLE : LE COCHER PUIS SUPPRIMER).", 3500, t); draw(); return; }
    const nx = { ...a, [f]: v };
    if (f === "des" || f === "u") {
      const d = achArtDup(L, nx.des, nx.u, a.id);
      if (d) { svToast("DOUBLON : " + d.code + " — " + d.des + " (" + d.u + ") EXISTE DÉJÀ.", 4000, t); draw(); return; }
      const nr = achArtNear(L, nx.des, nx.u, a.id);
      if (nr) svToast("PRESQUE IDENTIQUE À " + nr.code + " — " + nr.des + " : À FUSIONNER SI C'EST LE MÊME ARTICLE.", 4500, t);
    }
    if (f === "pref" && achN(a.pmax) > 0 && v > achN(a.pmax)) { svToast("PRIX DE RÉFÉRENCE AU-DESSUS DU PLAFOND (" + F2(a.pmax) + ").", 3500, t); draw(); return; }
    if (f === "pmax" && v > 0 && achN(a.pref) > v) { svToast("PLAFOND AU-DESSOUS DU PRIX DE RÉFÉRENCE (" + F2(a.pref) + ").", 3500, t); draw(); return; }
    if (f === "cat" && v && !achPrm().cat.includes(v)) { svToast("CATÉGORIE INCONNUE : LA CRÉER D'ABORD DANS ACHATS › PARAMÈTRES.", 3500, t); draw(); return; }
    const old = a[f];
    if (String(old ?? "") === String(v)) { draw(); return; }
    a[f] = v; a.mod = new Date().toISOString();
    const lab = { des: "DÉSIGNATION", u: "UNITÉ", cat: "CATÉGORIE", tva: "TVA %", pref: "PRIX RÉF. HT", pmax: "PLAFOND HT" }[f] || f;
    achHist(a.code, "MODIFICATION", lab + " : " + (num ? F2(old) : old || "—") + " → " + (num ? F2(v) : v || "—"));
    achArtsSave(L); draw();
  });
  /* catégories proposées sous la case (même liste que les unités) */
  body.addEventListener("input", e => {
    const i = e.target.closest('input[data-sug]'); if (!i) return;
    /* v759 : mêmes listes pour la FORME JURIDIQUE et les CONDITIONS DE PAIEMENT des fournisseurs */
    const src = i.dataset.sug === "forme" ? ACH_FORMES : i.dataset.sug === "cond" ? ACH_CONDS : achPrm().cat;
    const q = achU(i.value), L = src.filter(c => !q || c.includes(q)).slice(0, 8);
    let b = document.getElementById("svUnitSug");
    if (!L.length) { b && b.remove(); return; }
    if (!b) { b = document.createElement("div"); b.id = "svUnitSug"; document.body.appendChild(b); }
    b.__for = i;
    b.innerHTML = L.map(c => `<button type="button" data-u="${esc(c)}"><b>${esc(c)}</b><span></span></button>`).join("");
    const r = i.getBoundingClientRect();
    b.style.left = Math.max(8, Math.min(r.left, window.innerWidth - b.offsetWidth - 8)) + "px";
    b.style.top = (r.bottom + 4 + b.offsetHeight <= (typeof sviViewH === "function" ? sviViewH() : window.innerHeight) - 8 ? r.bottom + 4 : Math.max(8, r.top - b.offsetHeight - 4)) + "px";
  });
  body.addEventListener("focusin", e => { const i = e.target.closest('input[data-sug]'); if (i) i.dispatchEvent(new Event("input", { bubbles: true })); });
  body.addEventListener("focusout", e => { if (e.target.closest('input[data-sug]')) setTimeout(() => { const b = document.getElementById("svUnitSug"); if (b && b.__for === e.target && document.activeElement !== e.target) b.remove(); }, 200); });
  /* largeur des colonnes (poignée du bord droit de l'en-tête) et ordre (glisser un en-tête) — même mémoire que le budget */
  body.addEventListener("pointerdown", e => {
    const nh = e.target.closest(".nvp-rsz"); if (nh) { achNvhDrag(e, nh); return; }   /* v771 : hauteur des blocs de la page */
    const h = e.target.closest(".col-rs");
    if (h) {
      e.preventDefault(); e.stopPropagation();
      const table = h.closest("table"), col = table.querySelector(`col[data-w="${h.dataset.rs}.${h.dataset.col}"]`); if (!col) return;
      const x0 = e.clientX, w0 = parseFloat(col.style.width) || col.getBoundingClientRect().width; let w = w0;
      h.classList.add("on");
      const mv = ev => { w = Math.max(28, Math.round(w0 + ev.clientX - x0)); col.style.width = w + "px"; table.style.width = [...table.querySelectorAll("col")].reduce((s, c) => s + (parseFloat(c.style.width) || 0), 0) + "px"; };
      const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up); h.classList.remove("on"); const all = cwLoad(); all[col.dataset.w] = w; cwSave(all); };
      document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
      return;
    }
    const th = e.target.closest("th"); if (!th || e.target.closest(".cf-btn, input") || !th.querySelector(".cf-btn")) return;
    const table = th.closest("table"), t = th.querySelector(".cf-btn").dataset.cf;
    const ths = () => [...table.querySelectorAll("thead tr:first-child > th")].filter(x => x.querySelector(".cf-btn"));
    const x0 = e.clientX; let on = false, target = null, ghost = null;
    const clear = () => ths().forEach(x => x.classList.remove("co-before", "co-after"));
    const mv = ev => {
      if (!on) { if (Math.abs(ev.clientX - x0) < 8) return; on = true; th.classList.add("co-src"); ghost = document.createElement("div"); ghost.id = "coGhost"; ghost.textContent = (th.querySelector(".cf-lab")?.textContent || "").trim(); document.body.appendChild(ghost); }
      ev.preventDefault(); ghost.style.left = ev.clientX + 8 + "px"; ghost.style.top = ev.clientY - 28 + "px"; clear(); target = null;
      const L = ths(); for (const x of L) { const r = x.getBoundingClientRect(); if (ev.clientX >= r.left && ev.clientX < r.right) { if (x !== th) { x.classList.add(L.indexOf(x) > L.indexOf(th) ? "co-after" : "co-before"); target = x; } break; } }
    };
    const up = () => {
      document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
      clear(); th.classList.remove("co-src"); ghost && ghost.remove();
      if (!on || !target) return;
      const keyOf = x => x.querySelector(".cf-btn").dataset.col, keys = ths().map(keyOf), from = keys.indexOf(keyOf(th)), to = keys.indexOf(keyOf(target));
      const [k] = keys.splice(from, 1); keys.splice(to, 0, k);
      const all = coLoad(); all[t] = keys; coSave(all);
      view.addEventListener("click", ev => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
      draw();
    };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
  });
  /* case « CRÉER … ICI » : Entrée ou Tab crée la ligne (avant la navigation commune, qui n'a pas de case suivante dans cette ligne) */
  window.addEventListener("keydown", e => {
    const i = e.target && e.target.closest && e.target.closest("#ach input.ach-newin, #ach input.ach-pnew, #ach input.ach-bnew, #ach input.ach-gnew");
    if (!i || (e.key !== "Enter" && e.key !== "Tab") || !String(i.value || "").trim()) return;
    e.preventDefault(); e.stopPropagation();
    /* la mise en majuscules pendant la frappe empêche le navigateur d'envoyer « change » : il est envoyé ici */
    i.dispatchEvent(new Event("change", { bubbles: true }));
    if (i.isConnected) i.blur();
  }, true);
  /* données reçues d'un autre appareil (base V3) : écran redessiné s'il est affiché */
  window.addEventListener("storage", () => { if (view.classList.contains("active-view")) draw(); });
  draw();
  if (SVI_BIG.ready) SVI_BIG.ready.then(() => draw());   /* v770 : listes lues dans IndexedDB */
}
/* fenêtre H : historique d'un article */
function achHistWin(code) {
  const L = achHistGet(code).slice().reverse();
  const d = sviWinNew();
  d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true"><button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
    <div class="svc-t">HISTORIQUE — ${esc(code)}</div>
    <div class="svc-scroll"><table class="prm-table"><thead><tr><th>DATE</th><th>ACTION</th><th>DÉTAIL</th><th>PAR</th></tr></thead><tbody>
    ${L.map(h => `<tr><td>${esc(new Date(h.t).toLocaleString("fr-FR").replace(" ", " À ").slice(0, 21))}</td><td>${esc(h.a)}</td><td>${esc(h.d)}</td><td>${esc(h.u || "")}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">AUCUNE ACTION</td></tr>`}</tbody></table></div>
    <div class="svc-f"><button type="button" class="svc-b" data-x>FERMER</button></div></div>`;
  sviWinShow(d);
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) d.remove(); });
}
/* fenêtre BUDGETS : où l'article est prévu (lien budget) */
function achBdgWin(a) {
  const x = achBudgetCharges().get(achKey(a.des, a.u));
  const refs = x ? [...x.refs].filter(Boolean).sort() : [];
  const d = sviWinNew();
  d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true"><button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
    <div class="svc-t">BUDGETS — ${esc(a.code)}</div><div class="svc-sub">${esc(a.des)} (${esc(a.u)})</div>
    <ul class="svc-list">${refs.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
    ${x ? `<div class="svc-sub">QUANTITÉ PRÉVUE : ${esc((Math.round(x.q * 100) / 100).toLocaleString("fr-FR"))} ${esc(a.u)} · MONTANT HT : ${esc(x.mt.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}</div>` : ""}
    <div class="svc-f"><button type="button" class="svc-b" data-x>FERMER</button></div></div>`;
  sviWinShow(d);
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) d.remove(); });
}
/* fenêtre FUSIONNER : choix de l'article gardé */
function svChooseArt(A) {
  return new Promise(ok => {
    const d = sviWinNew();
    d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true"><button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
      <div class="svc-t">FUSIONNER ${A.length} ARTICLES</div><div class="svc-sub">CHOISIR L'ARTICLE GARDÉ ; LES AUTRES VONT À LA CORBEILLE AVEC LA MENTION « FUSIONNÉ DANS ».</div>
      <div class="ach-pick">${A.map((a, i) => `<label><input type="radio" name="achkeep" value="${i}"${i ? "" : " checked"}> <b>${esc(a.code)}</b> — ${esc(a.des)} (${esc(a.u)})</label>`).join("")}</div>
      <div class="svc-f"><button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>FUSIONNER</button></div></div>`;
    sviWinShow(d);
    d.addEventListener("click", e => {
      if (e.target === d || e.target.closest("[data-x]")) { d.remove(); ok(null); return; }
      if (e.target.closest("[data-ok]")) { const i = Number((d.querySelector('input[name="achkeep"]:checked') || {}).value || 0); d.remove(); ok(A[i]); }
    });
  });
}
/* v916 : module chargé à la demande (page déjà prête) — démarré après la lecture de tous ses fichiers (ACH_SW… déclarés plus loin) */
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sviAchInit); else setTimeout(sviAchInit, 0);
document.addEventListener("click", e => { const nb = e.target.closest && e.target.closest('.nav-btn[data-view="ach"]'); if (nb) setTimeout(() => { const v = document.getElementById("ach"); if (!v) return; if (nb.dataset.ach && v.__achTab) v.__achTab(nb.dataset.ach); else if (v.__achDraw) v.__achDraw(); }, 0); });
/* ⟪ src/42-achats-fournisseurs.js ⟫ */
/* =========================================================
   v759 : ACHATS — FOURNISSEURS (étape 1, suite)
   Tableau au format des ARTICLES (tri / filtre communs, largeurs et ordre mémorisés, état ACTIF / INACTIF / CORBEILLE / TOUT,
   H = historique, ⚠ = à compléter, case CRÉER UN FOURNISSEUR ICI…) ; le CODE souligné ouvre la FICHE (lien vers la fiche source) :
   identité, fiscal, RIB (plusieurs, un principal), conditions de paiement, familles d'articles, documents fiscaux, contacts,
   évaluations, contrats. Règles : 40-achats-donnees.js (achFrsWhy…).
   achFrsMod(ctx) — ctx = { view, body, cfApply, cfHead, cw, SEL, draw, F2 } ; rend { html, click, change }.
   ========================================================= */
function achFrsMod(ctx) {
  const { body, cfApply, cfHead, cw, SEL, draw } = ctx;
  const F_ETATS = [["actif", "ACTIF"], ["inactif", "INACTIF"], ["corbeille", "CORBEILLE"], ["tout", "TOUT"]];
  let fEtat = "actif"; try { const e0 = localStorage.getItem("svi_ach_frs_etat_v1"); if (F_ETATS.some(x => x[0] === e0)) fEtat = e0; } catch (e) {}
  const fOk = (f, k) => k === "tout" ? true : k === "corbeille" ? !!f.del : !f.del && (k === "inactif" ? f.actif === false : f.actif !== false);
  const setEtat = k => { fEtat = k; try { localStorage.setItem("svi_ach_frs_etat_v1", k); } catch (e) {} };
  const ribTxt = r => { if (!r) return ""; const b = achBankOfRib(r.rib), d = achDig(r.rib); return (b ? b.abr || b.n : "?") + " …" + d.slice(-4); };
  const FRS_COLS = () => [
    ["code", "CODE", f => f.code, "center"], ["nom", "NOM", f => f.nom, ""], ["forme", "FORME", f => f.forme || "", ""], ["ville", "VILLE", f => f.ville || "", ""],
    ["ice", "ICE", f => achDig(f.ice), "center"], ["rib", "RIB PRINCIPAL", f => ribTxt(achFrsRibP(f)), "center"], ["cond", "PAIEMENT", f => f.cond || "", ""],
    ["fam", "FAMILLES", f => (f.fam || []).length, "center"], ["cte", "CONTACTS", f => (f.cte || []).length, "center"],
    ["note", "NOTE / 10", f => { const n = achFrsNote(f); return n === null ? "" : Math.round(n * 10) / 10; }, "center"],
    ["freq", "FRÉQUENCE", f => achFrsFreq(f).lab, "center"]];
  const W0 = { code: 92, nom: 260, forme: 140, ville: 130, ice: 150, rib: 130, cond: 130, fam: 90, cte: 90, note: 90, occ: 100, actif: 70 };
  const cwF = k => (cwLoad()["ach_frs." + k]) || W0[k] || 100;
  const cellIn = (f, k) => {
    const ro = !!f.del;
    if (k === "code") return `<button type="button" class="ach-link" data-fiche="${esc(f.id)}" title="Ouvrir la fiche">${esc(f.code)}</button>`;
    if (k === "freq") return `<span>${esc(achFrsFreq(f).lab || "—")}</span>`;
    if (k === "occ" || k === "actif") { const on = k === "occ" ? !!f.occ : f.actif !== false; return `<input type="checkbox" class="ach-ck frs-ck" data-f="${k}"${on ? " checked" : ""}${ro ? " disabled" : ""}>`; }
    if (k === "rib") { const r = achFrsRibP(f); return r ? `<button type="button" class="ach-link" data-fiche="${esc(f.id)}" data-sec="rib">${esc(ribTxt(r))}</button>` : `<span class="ach-0">—</span>`; }
    if (k === "fam" || k === "cte") { const n = (f[k] || []).length; return `<button type="button" class="ach-link" data-fiche="${esc(f.id)}" data-sec="${k}">${n}</button>`; }
    if (k === "note") { const n = achFrsNote(f); return n === null ? `<span class="ach-0">—</span>` : `<span>${esc(String(Math.round(n * 10) / 10).replace(".", ","))}</span>`; }
    const v = k === "ice" ? achDig(f.ice) : f[k] || "";
    return `<input class="ins-in ach-in frs-in${k === "ice" ? " center" : ""}" data-f="${k}" value="${esc(k === "ice" ? sviMaskFmt("ice", v) : v)}"${k === "ice" ? ' inputmode="numeric" data-mask="ice"' : ""}${k === "forme" || k === "cond" ? ` data-sug="${k}"` : ""}${ro ? " readonly" : ""} autocomplete="off" enterkeyhint="next">`;
  };
  const html = () => {
    const all = achFrs(), rows0 = all.filter(f => fOk(f, fEtat));
    const cols = coOrder("ach_frs", FRS_COLS()), rows = cfApply("ach_frs", cols, rows0);
    const nDel = all.filter(f => f.del).length, nSel = [...SEL].filter(id => rows0.some(f => f.id === id)).length;
    const W = cols.reduce((s, c) => s + cwF(c[0]), 0) + 44 + 46, corb = fEtat === "corbeille";
    return `<div class="ach-tools">
        <button type="button" class="ach-b ach-etat" data-a="frs-etat">${(F_ETATS.find(x => x[0] === fEtat) || F_ETATS[0])[1]} ▾ ${svCnt(rows.length, rows0.length)}</button>
        ${corb ? `<button type="button" class="ach-b" data-a="frs-restore"${nSel ? "" : " disabled"}>RESTAURER LES COCHÉS ${svCnt(nSel)}</button><button type="button" class="ach-b" data-a="frs-back">‹ RETOUR AUX FOURNISSEURS</button>`
          : `<button type="button" class="ach-b" data-a="frs-del"${nSel ? "" : " disabled"}>SUPPRIMER LES COCHÉS ${svCnt(nSel)}</button>
             <button type="button" class="ach-b" data-a="frs-trash"${nDel ? "" : " disabled"}>CORBEILLE ${svCnt(nDel)}</button>`}
      </div>
      <div class="ach-scroll"><table id="achFrsT" class="bdg-d-table prm-table ach-table" data-ach="frs" style="width:${W}px">
        <colgroup><col style="width:46px">${cols.map(c => `<col data-w="ach_frs.${c[0]}" style="width:${cwF(c[0])}px">`).join("")}<col style="width:44px"></colgroup>
        <thead><tr><th class="center ach-hh">H</th>${cols.map(c => cfHead("ach_frs", c[0], c[1], c[3])).join("")}<th class="center"><input type="checkbox" class="ach-all"${rows.length && rows.every(f => SEL.has(f.id)) ? " checked" : ""}></th></tr></thead>
        <tbody>${rows.map(f => { const why = achFrsWhy(f, all); return `<tr data-id="${esc(f.id)}" data-iid="${esc(f.id)}" class="${why.length ? "ach-bad" : ""}${f.actif === false ? " ach-off" : ""}${f.del ? " ach-deleted" : ""}">
          <td class="center"><button type="button" class="ach-h" data-h="${esc(f.code)}" title="Historique">H</button>${why.length ? `<span class="ach-warn" data-why="${esc(why.join(" · "))}">⚠</span>` : ""}</td>
          ${cols.map(c => `<td class="${c[3]}">${cellIn(f, c[0])}</td>`).join("")}
          <td class="center ins-cbc"><input type="checkbox" class="ach-cb"${SEL.has(f.id) ? " checked" : ""}></td></tr>`; }).join("")}
          ${fEtat === "corbeille" || fEtat === "inactif" ? "" : `<tr class="ach-new"><td></td>${cols.map(c => `<td class="${c[3]}">${c[0] === "nom" ? `<input class="ins-in ach-newin" data-k="frs" data-f="nom" placeholder="CRÉER UN FOURNISSEUR ICI…" autocomplete="off" enterkeyhint="next">` : ""}</td>`).join("")}<td></td></tr>`}
          ${!rows.length && corb ? `<tr><td colspan="${cols.length + 2}" class="empty">CORBEILLE VIDE</td></tr>` : ""}
        </tbody></table></div>`;
  };
  const frsOf = el => { const tr = el.closest("tr[data-id]"); if (!tr) return null; const L = achFrs(); return { L, f: L.find(x => x.id === tr.dataset.id) }; };
  const click = async e => {
    const fi = e.target.closest("[data-fiche]"); if (fi) { e.stopPropagation(); achFrsFiche(fi.dataset.fiche, fi.dataset.sec || "", () => draw()); return true; }
    const ab = e.target.closest(".ach-b"); if (!ab || !/^frs-/.test(ab.dataset.a || "")) return false;
    if (ab.disabled) return true;
    const L = achFrs(), ids = [...SEL].filter(id => L.some(f => f.id === id)), act = ab.dataset.a;
    if (act === "frs-etat") { sviEtatMenu(ab, F_ETATS.map(([k, lab]) => ({ k, lab, n: L.filter(f => fOk(f, k)).length })), fEtat, k => { setEtat(k); SEL.clear(); draw(); }); return true; }
    if (act === "frs-trash") { setEtat("corbeille"); SEL.clear(); draw(); return true; }
    if (act === "frs-back") { setEtat("actif"); SEL.clear(); draw(); return true; }
    if (act === "frs-del") {
      const A = ids.map(id => L.find(f => f.id === id)).filter(f => f && !f.del);
      if (!A.length || !(await svConfirm({ title: "SUPPRIMER LES FOURNISSEURS COCHÉS", ok: "SUPPRIMER", html: `<ul class="svc-list">${A.map(f => `<li>${esc(f.code + " — " + f.nom)}</li>`).join("")}</ul><div class="svc-sub">RESTAURABLES DEPUIS LA CORBEILLE ; LEURS NUMÉROS NE SERONT PAS RÉUTILISÉS.</div>`, ok: "METTRE À LA CORBEILLE" }))) return true;
      const t = new Date().toISOString(); A.forEach(f => { f.del = t; f.mod = t; achHist(f.code, "CORBEILLE", f.nom); });
      achFrsSave(L); SEL.clear(); draw(); return true;
    }
    if (act === "frs-restore") {
      ids.forEach(id => { const f = L.find(x => x.id === id); if (!f || !f.del) return; const d = achFrsDupIce(L, f.ice, f.id);
        if (d) { svToast("RESTAURATION IMPOSSIBLE : " + d.code + " A DÉJÀ L'ICE " + achDig(f.ice) + ".", 4000, ab); return; }
        f.del = ""; f.mod = new Date().toISOString(); achHist(f.code, "RESTAURATION", f.nom); });
      achFrsSave(L); SEL.clear(); draw(); return true;
    }
    return true;
  };
  const change = e => {
    const t = e.target;
    if (t.classList.contains("ach-newin") && t.dataset.k === "frs") {
      const v = achU(t.value); if (!v) return true;
      const L = achFrs(), d = achFrsDupNom(L, v, null);
      if (d) svToast("UN FOURNISSEUR DU MÊME NOM EXISTE : " + d.code + " (VÉRIFIER QUE CE N'EST PAS LE MÊME).", 4000, t);
      const f = achFrsNew(L, { nom: v }); achHist(f.code, "CRÉATION", v); achFrsSave(L); draw();
      setTimeout(() => body.querySelector(`tr[data-id="${f.id}"] input[data-f="forme"]`)?.focus(), 0); return true;
    }
    if (!t.closest("#achFrsT") || t.classList.contains("ach-cb") || t.classList.contains("ach-all")) return false;
    const o = frsOf(t); if (!o || !o.f || o.f.del) return true;
    const { L, f } = o, k = t.dataset.f;
    if (t.classList.contains("frs-ck")) { const old = k === "occ" ? !!f.occ : f.actif !== false; if (k === "occ") f.occ = t.checked; else f.actif = t.checked; f.mod = new Date().toISOString();
      achHist(f.code, "MODIFICATION", (k === "occ" ? "OCCASIONNEL" : "ACTIF") + " : " + (old ? "OUI" : "NON") + " → " + (t.checked ? "OUI" : "NON")); achFrsSave(L); draw(); return true; }
    if (!t.classList.contains("frs-in")) return true;
    let v = k === "ice" ? sviMaskRaw(t.value) : achU(t.value);
    if (k === "nom" && !v) { svToast("NOM OBLIGATOIRE (POUR RETIRER LE FOURNISSEUR : LE COCHER PUIS SUPPRIMER).", 3500, t); draw(); return true; }
    if (k === "ice" && v && !achIceOk(v)) { svToast(achIceMsg() + ".", 3500, t); draw(); return true; }
    if (k === "ice" && v) { const d = achFrsDupIce(L, v, f.id); if (d) { svToast("ICE DÉJÀ UTILISÉ PAR " + d.code + " — " + d.nom + ".", 4000, t); draw(); return true; } }
    if (k === "forme" && v && !ACH_FORMES.includes(v)) { svToast("FORME JURIDIQUE : CHOISIR DANS LA LISTE (" + ACH_FORMES.join(", ") + ").", 4500, t); draw(); return true; }
    if (k === "cond" && v && !ACH_CONDS.includes(v)) { svToast("CONDITIONS DE PAIEMENT : CHOISIR DANS LA LISTE.", 3500, t); draw(); return true; }
    if (k === "nom") { const d = achFrsDupNom(L, v, f.id); if (d) svToast("UN FOURNISSEUR DU MÊME NOM EXISTE : " + d.code + ".", 3500, t); }
    const old = f[k];
    if (String(old ?? "") === String(v)) { draw(); return true; }
    f[k] = v; f.mod = new Date().toISOString();
    achHist(f.code, "MODIFICATION", ({ nom: "NOM", forme: "FORME", ville: "VILLE", ice: "ICE", cond: "PAIEMENT" }[k] || k) + " : " + (old || "—") + " → " + (v || "—"));
    achFrsSave(L); draw(); return true;
  };
  return { html, click, change };
}

/* ---------- FICHE FOURNISSEUR ---------- */
/* v912 (checklist : évaluations sorties du i) : NOUVELLE ÉVALUATION depuis la page du fournisseur (menu ⋯ › ÉVALUATIONS) ;
   la liste des évaluations est le bloc ÉVALUATIONS de la page. Critères : nom + note de 0 à 10 (note refusée dès la saisie hors de 0 à 10) */
function achFrsEvalWin(id, done) {
  const L = achFrs(), f = L.find(x => x.id === id); if (!f) return;
  if (f.del) { svToast("FOURNISSEUR SUPPRIMÉ : LECTURE SEULE.", 3000); return; }
  const d = sviWinNew();
  d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: "NOUVELLE ÉVALUATION — " + esc(f.nom || ""),
    body: `<table class="prm-table frs-sub frs-ecrit"><thead><tr><th>CRITÈRE</th><th>NOTE (0 À 10)</th></tr></thead><tbody>${[0, 1, 2, 3, 4].map(i => `<tr><td><input class="ins-in frs-ed" data-i="${i}" value="${["QUALITÉ", "DÉLAIS", "PRIX", "SERVICE", ""][i]}" autocomplete="off"></td><td><input class="ins-in frs-en number" data-i="${i}" inputmode="decimal" autocomplete="off"></td></tr>`).join("")}</tbody></table>`,
    foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button>` });
  sviWinShow(d);
  d.addEventListener("change", e => { const i = e.target.closest && e.target.closest(".frs-en"); if (!i) return; const s = String(i.value).trim(), n = achN(s);
    if (s && (!sviNumOk(s) || n < 0 || n > 10)) { i.value = ""; svToast("NOTE : DE 0 À 10.", 3000, i); } });
  d.addEventListener("click", e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
    if (!e.target.closest("[data-ok]")) return;
    const crit = [...d.querySelectorAll(".frs-ed")].map(i => { const ni = d.querySelector(`.frs-en[data-i="${i.dataset.i}"]`), s = String((ni || {}).value || "").trim(); return { d: achU(i.value), s, n: Math.max(0, Math.min(10, achN(s))) }; }).filter(c => c.d && c.s !== "").map(({ d: dd, n }) => ({ d: dd, n }));
    if (!crit.length) { svToast("ÉVALUATION : AU MOINS UN CRITÈRE (NOM ET NOTE).", 3000); return; }
    const L2 = achFrs(), f2 = L2.find(x => x.id === id); if (!f2) { d.remove(); return; }
    f2.evl = f2.evl || []; f2.evl.push({ date: new Date().toISOString(), crit, moy: crit.reduce((t, c) => t + c.n, 0) / crit.length }); f2.mod = new Date().toISOString();
    achFrsSave(L2); achHist(f2.code, "ÉVALUATION", crit.map(c => c.d + " " + c.n).join(", "));
    d.remove(); if (done) done();
  });
}
function achFrsFiche(id, sec, done) {
  const L0 = achFrs(), f0 = L0.find(x => x.id === id); if (!f0) return;
  const F = JSON.parse(JSON.stringify(f0)), ro = !!f0.del || f0.st === "fige", P = achPrm();   /* v922 : figé (vert) = lecture seule, comme le budget (REVENIR EN INSTANCE pour modifier) */
  F.type = achFrsTypeLab(F); F.grp = achFrsGrpId(F);   /* B41 : un ancien groupe (sous-traitant, organisme financier) devient le type ; le groupe devient LOCAL */
  ["ribs", "docf", "cte", "evl", "cgf", "fam", "cau", "jours", "tar", "fermJ", "refs"].forEach(k => { if (!Array.isArray(F[k])) F[k] = []; });
  if (!Array.isArray(F.cla)) F.cla = achClCopy(P.clG);
  /* B39 : les anciens E-MAIL DE COMMANDE / DE FACTURATION deviennent des contacts qui reçoivent ces pièces */
  [["mailCmd", "cmf"], ["mailFac", "faf"]].forEach(([k, p]) => { const m = String(F[k] || "").trim().toLowerCase(); if (!m) return; let c = F.cte.find(x => String(x.email || "").toLowerCase() === m);
    if (!c) { c = { nom: "", fonction: "", role: "", tel: "", email: m, rec: [] }; F.cte.push(c); } c.rec = [...new Set([...(c.rec || []), p])]; F[k] = ""; });   /* B29 : fournisseur d'avant les clauses = clauses générales du modèle */
  const d = sviWinNew();
  const inp = (k, lab, o = {}) => `<label class="frs-f${o.w ? " frs-w" : ""}"><span>${lab}${o.req ? " <b>*</b>" : ""}</span><input class="ins-in frs-x" data-k="${k}"${o.mask ? ` data-mask="${o.mask}"` : ""} value="${esc(o.mask ? sviMaskFmt(o.mask, F[k] ?? "") : F[k] ?? "")}"${o.num ? ' inputmode="numeric"' : ""}${o.date ? ' type="date"' : ""}${o.keep ? " data-keepcase" : ""}${o.list ? ` list="frsL-${k}"` : ""}${ro ? " readonly" : ""} autocomplete="off">${o.list ? `<datalist id="frsL-${k}">${o.list.map(x => `<option value="${esc(x)}">`).join("")}</datalist>` : ""}</label>`;
  const sel = (k, lab, opts, o = {}) => `<label class="frs-f${o.w ? " frs-w" : ""}"><span>${lab}</span><select class="ins-in frs-xs" data-k="${k}"${ro || o.dis ? " disabled" : ""}><option value="">—</option>${opts.map(x => { const v = Array.isArray(x) ? x[0] : x, t = Array.isArray(x) ? x[1] : x; return `<option value="${esc(v)}"${String(F[k] ?? "") === String(v) ? " selected" : ""}>${esc(t)}</option>`; }).join("")}</select></label>`;
  const chk = (k, lab) => `<label class="frs-c"><input type="checkbox" class="frs-xc" data-k="${k}"${F[k] ? " checked" : ""}${ro ? " disabled" : ""}> ${lab}</label>`;
  const sub = (k, cols, add) => `<table class="prm-table frs-sub" data-sub="${k}"><thead><tr>${cols.map(c => `<th>${c[1]}</th>`).join("")}<th></th></tr></thead><tbody>
      ${F[k].map((r, i) => `<tr data-i="${i}">${cols.map(c => `<td>${c[2] ? c[2](r, i) : `<input class="ins-in frs-s" data-c="${c[0]}" value="${esc(r[c[0]] ?? "")}"${c[3] || ""}${ro ? " readonly" : ""} autocomplete="off">`}</td>`).join("")}<td class="center">${ro ? "" : `<button type="button" class="ach-x" data-rm="${k}|${i}" data-rml="${k}|${i}" title="Retirer">✕</button>`}</td></tr>`).join("") || `<tr><td colspan="${cols.length + 1}" class="empty">AUCUNE LIGNE</td></tr>`}
    </tbody></table>${ro ? "" : `<button type="button" class="ach-b frs-add" data-add="${k}" data-addl>+ ${add}</button>`}`;
  /* v801 : la fenêtre i a cinq onglets (checklist, fenêtre i du fournisseur, 02/11/2026) */
  const TABS = [["id", "IDENTITÉ", ["id", "cte"]], ["leg", "FISCAL ET LÉGAL", ["fisc", "qual", "secu", "docf"]], ["bq", "BANQUE ET PAIEMENT", ["rib", "cpt", "enc", "cau"]],
    ["ach", "CONDITIONS D'ACHAT", ["cond", "com", "imp", "ferm", "sav", "tar", "fam", "cgf", "cla"]], ["rsq", "RISQUE ET MOYENS", ["rsq", "moy", "refs"]], ["sim", "FOURNISSEURS SIMILAIRES", ["sim"]], ["stat", "STATISTIQUES", ["stat"]]];
  let tab = (TABS.find(t => t[2].includes(sec)) || TABS[0])[0];
  const draw = () => {
    const why = achFrsWhy(F, achFrs()), note = achFrsNote(F);
    d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: esc(F.nom || "") + " : " + esc(achFrsRef(F)),
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}${F.ribChg && !ro ? ` <button type="button" class="ach-b" data-ribok>RIB VÉRIFIÉ</button>` : ""}</div>` : ""}
        <div class="rec-tabs frs-tabs">${TABS.map(t => `<button type="button" class="rec-tab${t[0] === tab ? " active on" : ""}" data-ftab="${t[0]}">${t[1]}</button>`).join("")}</div>
        <div class="frs-scroll">
        <div class="frs-sec" data-s="id"><div class="frs-st">IDENTITÉ</div><div class="frs-g">
          ${inp("nom", "NOM", { req: 1, w: 1 })}${sel("grp", "GROUPE <b>*</b>", achPrm().grp.map(g => [g.id, g.nom + " (" + g.pre + ")"]), { dis: achSt(f0) !== "instance" })}${inp("denom", "DÉNOMINATION SOCIALE", { w: 1 })}${inp("forme", "FORME JURIDIQUE", { list: ACH_FORMES })}${inp("ville", "VILLE", { list: sviPgVilles().map(x => x.lab) })}
          ${(() => { const T = sviPgL("ftypes").map(t => [t.lab, t.lab + (t.pre ? " (" + t.pre + ")" : "")]); if (F.type && !T.some(t => t[0] === F.type)) T.push([F.type, F.type]);
            return sel("type", "TYPE DE FOURNISSEUR", T, { dis: achSt(f0) !== "instance" && !!(achFrsType(f0) || {}).pre }); })()}${inp("pays", "PAYS", { list: sviPgL("lieux").filter(x => !x.p).map(x => x.lab) })}${(() => { const L = sviLangues().slice(); if (F.lang && !L.includes(F.lang)) L.push(F.lang);
            return sel("lang", "LANGUE", [...L, ["__add", "AJOUTER…"]]); })()}
          ${inp("adresse", "ADRESSE", { w: 1 })}${inp("site", "SITE WEB", { keep: 1 })}${inp("resp", "RESPONSABLE INTERNE")}
          ${inp("origine", "ORIGINE (TROUVÉ COMMENT, RECOMMANDÉ PAR QUI)", { w: 1 })}
          ${sel("lie", "FOURNISSEUR LIÉ", achFrs().filter(x => !x.del && x.id !== id).map(x => [x.id, x.nom]))}${sel("lieT", "LIEN", ACH_FLIENS)}
          <div class="frs-f frs-w frs-logo"><span>LOGO</span><div>${F.logo ? `<img src="${esc(F.logo)}" alt="">` : ""}${ro ? "" : `<input type="file" accept="image/*" class="frs-logo-in">${F.logo ? ` <button type="button" class="ach-b" data-logorm>RETIRER LE LOGO</button>` : ""}`}</div></div>
          <label class="frs-f"><span data-tip="CALCULÉE D'APRÈS L'ÉCART MOYEN ENTRE LES COMMANDES (SEUILS : ACHATS › PARAMÈTRES › GÉNÉRAL)">FRÉQUENCE</span><input class="ins-in" value="${esc(achFrsFreq(f0).lab || "—")}" readonly></label></div></div>
        <div class="frs-sec" data-s="fisc"><div class="frs-st">FISCAL ET LÉGAL</div><div class="frs-g">
          ${inp("ice", "ICE", { req: (achFrsGrp(F).req || []).includes("ice"), num: 1, mask: "ice" })}${inp("ifisc", "IDENTIFIANT FISCAL", { num: 1, mask: "if" })}${inp("rc", "REGISTRE DE COMMERCE", { num: 1, mask: "rc" })}${inp("villeRc", "VILLE DU RC")}
          ${inp("patente", "PATENTE", { num: 1 })}${inp("capital", "CAPITAL (MAD)", { num: 1 })}
          ${inp("cnss", "N° CNSS", { num: 1, mask: "cnss" })}${inp("dateCrea", "DATE DE CRÉATION", { date: 1 })}${inp("dirigeant", "DIRIGEANT", { w: 1 })}
          ${F.forme === "AUTO-ENTREPRENEUR" ? `${inp("aeNo", "N° AUTO-ENTREPRENEUR", { num: 1 })}${inp("aeCin", "CIN DU TITULAIRE")}` : ""}</div></div>
        <div class="frs-sec" data-s="qual"><div class="frs-st">QUALIFICATION ET CERTIFICATIONS</div><div class="frs-g">
          ${inp("qualif", "QUALIFICATION (CERTIFICAT DU MINISTÈRE)", { w: 1 })}${inp("classe", "CLASSIFICATION")}${inp("effectif", "EFFECTIF", { num: 1 })}
          ${inp("certif", "CERTIFICATIONS (EX. ISO 9001)", { w: 1 })}</div></div>
        <div class="frs-sec" data-s="secu"><div class="frs-st">ASSURANCES, SÉCURITÉ ET CONDITIONS GÉNÉRALES</div><div class="frs-g">
          ${inp("cgaDate", "CONDITIONS GÉNÉRALES SIGNÉES LE", { date: 1 })}${inp("revue", "DERNIÈRE REVUE DE LA FICHE", { date: 1 })}
          <div class="frs-cs">${chk("assRc", "ASSURANCE RESPONSABILITÉ CIVILE")}${chk("secu", "RESPECTE LES RÈGLES DE SÉCURITÉ SUR CHANTIER")}${chk("cga", "CONDITIONS GÉNÉRALES D'ACHAT SIGNÉES ET ACCEPTÉES")}</div></div></div>
        <div class="frs-sec" data-s="cpt"><div class="frs-st">COMPTE COMPTABLE</div><div class="frs-g">${(() => { const CP = sviPgL("cpt"); /* B21 : choisi dans PARAMÉTRAGE GÉNÉRAL › COMPTABILITÉ */
            if (!CP.length) return inp("codeCpt", "CODE COMPTABLE", { num: 1 }) + inp("intCpt", "INTITULÉ COMPTABLE");
            const O = CP.map(c => [String(c.code), c.code + " — " + (c.lab || "")]); if (F.codeCpt && !O.some(o => o[0] === String(F.codeCpt))) O.push([String(F.codeCpt), F.codeCpt + " — " + (F.intCpt || "")]);
            return sel("codeCpt", "COMPTE COMPTABLE (PARAMÉTRAGE GÉNÉRAL › COMPTABILITÉ)", O, { w: 1 }); })()}</div></div>
        <div class="frs-sec" data-s="rib"><div class="frs-st">RIB ${svCnt(F.ribs.length)}</div>
          ${sub("ribs", [["bqId", "BANQUE", r => { const B = achBanks(), g = r.bqId || (achBankOfRib(r.rib) || {}).id || ""; return `<select class="ins-in frs-s" data-c="bqId"${ro ? " disabled" : ""}><option value="">—</option>${B.map(b => `<option value="${esc(b.id)}"${b.id === g ? " selected" : ""}>${esc(b.n)}</option>`).join("")}</select>`; }],
            ["ag", "AGENCE", r => { const g = r.bqId || (achBankOfRib(r.rib) || {}).id || "", A = g ? achAgences(g) : []; return `<select class="ins-in frs-s" data-c="ag"${ro || !A.length ? " disabled" : ""}><option value="">—</option>${A.map(a => `<option value="${esc(a.id)}"${a.id === r.ag ? " selected" : ""}>${esc(a.lab + (a.code ? " (" + a.code + ")" : ""))}</option>`).join("")}</select>`; }],
            ["rib", "RIB (24 CHIFFRES)", null, ' inputmode="numeric"'], ["ck", "CONTRÔLE", r => { const m = achRibBqWhy({ ...r, bqId: r.bqId || (achBankOfRib(r.rib) || {}).id || "" }); return m ? `<span class="ach-warn" title="${esc(m)}">⚠ ${esc(m)}</span>` : achRibOk(r.rib) ? "✓" : "—"; }],
            ["p", "PRINCIPAL", (r, i) => `<input type="radio" name="frsRibP" class="frs-rp" data-i="${i}"${r.p ? " checked" : ""}${ro ? " disabled" : ""}>`]], "AJOUTER UN RIB")}</div>
        <div class="frs-sec" data-s="enc"><div class="frs-st">ENCOURS ET ENCAISSEMENT</div><div class="frs-g">
          ${inp("plafEnc", "PLAFOND D'ENCOURS (MAD)", { num: 1 })}${inp("plafT", "PLAFOND DE TRANSACTIONS (12 MOIS)", { num: 1 })}${sel("plafU", "UNITÉ DU PLAFOND", [["DH", "DH HT"], ["%", "% DES ACHATS"]])}<label class="frs-f"><span>ENCOURS ACTUEL</span><input class="ins-in" value="${esc(achF2(achFrsEnc(id)))}" readonly></label>
          ${inp("encNom", "PERSONNE AUTORISÉE À RETIRER LES CHÈQUES", { w: 1 })}
          <div class="frs-f frs-w"><span>JOURS DE PAIEMENT HABITUELS</span><div class="frs-cs">${ACH_JOURS.map(j => `<label class="frs-c"><input type="checkbox" class="frs-jr" value="${j}"${F.jours.includes(j) ? " checked" : ""}${ro ? " disabled" : ""}> ${j}</label>`).join("")}</div></div></div></div>
        <div class="frs-sec" data-s="cau"><div class="frs-st">CAUTIONS ET GARANTIES BANCAIRES REÇUES ${svCnt(F.cau.length)}</div>
          ${sub("cau", [["type", "TYPE", (r) => `<select class="ins-in frs-s" data-c="type"${ro ? " disabled" : ""}>${ACH_CAUT.map(x => `<option${x === r.type ? " selected" : ""}>${esc(x)}</option>`).join("")}</select>`], ["no", "N°"], ["bq", "BANQUE"],
            ["mt", "MONTANT", (r) => `<input class="ins-in frs-s number" data-c="mt" inputmode="decimal" value="${esc(r.mt ? achF2(r.mt) : "")}"${ro ? " readonly" : ""} autocomplete="off">`],
            ["ech", "ÉCHÉANCE", (r) => `<input type="date" class="ins-in frs-s" data-c="ech" value="${esc(r.ech || "")}"${ro ? " readonly" : ""}>`]], "AJOUTER UNE CAUTION")}</div>
        <div class="frs-sec" data-s="cond"><div class="frs-st">CONDITIONS DE PAIEMENT</div><div class="frs-g">${inp("cond", "CONDITIONS (DÉLAI)", { list: ACH_CONDS })}${sel("modeReg", "MODE DE RÈGLEMENT", ACH_MODES)}
          ${inp("escTaux", "ESCOMPTE (%)", { num: 1 })}${inp("escJours", "SI PAYÉ SOUS (JOURS)", { num: 1 })}
          ${inp("retTaux", "RETENUE DE GARANTIE (%)", { num: 1 })}<div class="frs-cs">${chk("retAcc", "RETENUE DE GARANTIE ACCEPTÉE")}</div></div></div>
        <div class="frs-sec" data-s="com"><div class="frs-st">COMMANDE ET LIVRAISON</div><div class="frs-g">
          ${inp("delai", "DÉLAI DE LIVRAISON (JOURS)", { num: 1 })}${sel("devise", "DEVISE", ACH_DEVISES)}${inp("minCmd", "MINIMUM DE COMMANDE", { num: 1 })}${inp("franco", "FRANCO DE PORT À PARTIR DE", { num: 1 })}
          ${inp("remise", "REMISE HABITUELLE (%)", { num: 1 })}${sel("envoi", "ENVOI DES COMMANDES", ACH_ENVOIS)}${sel("livr", "LIVRAISON", ACH_LIVR)}${inp("heuresLiv", "HEURES DE LIVRAISON")}
          ${inp("gps", "DÉPÔT : POSITION GPS (LATITUDE, LONGITUDE)", { w: 1, keep: 1 })}</div></div>
        <div class="frs-sec" data-s="imp"><div class="frs-st">IMPORT</div><div class="frs-g">${sel("incoterm", "INCOTERM", ACH_INCOTERMS)}${inp("transit", "TRANSITAIRE", { w: 1 })}</div></div>
        <div class="frs-sec" data-s="ferm"><div class="frs-st">FERMETURES</div><div class="frs-g">${inp("conges", "CONGÉS (PÉRIODES)", { w: 1 })}
          <div class="frs-f frs-w"><span>JOURS SANS LIVRAISON</span><div class="frs-cs">${ACH_JOURS.concat("DIM").map(j => `<label class="frs-c"><input type="checkbox" class="frs-fj" value="${j}"${F.fermJ.includes(j) ? " checked" : ""}${ro ? " disabled" : ""}> ${j}</label>`).join("")}</div></div></div></div>
        <div class="frs-sec" data-s="sav"><div class="frs-st">GARANTIE ET APRÈS-VENTE</div><div class="frs-g">${inp("garMois", "DURÉE DE GARANTIE (MOIS)", { num: 1 })}${inp("savContact", "CONTACT SAV", { w: 1 })}</div></div>
        <div class="frs-sec" data-s="tar"><div class="frs-st">TARIFS ${svCnt(F.tar.length)}</div>
          ${sub("tar", [["des", "DÉSIGNATION"], ["u", "UNITÉ"], ["pu", "PRIX", (r) => `<input class="ins-in frs-s number" data-c="pu" inputmode="decimal" value="${esc(r.pu ? achF2(r.pu) : "")}"${ro ? " readonly" : ""} autocomplete="off">`],
            ["valid", "VALABLE JUSQU'AU", (r) => `<input type="date" class="ins-in frs-s" data-c="valid" value="${esc(r.valid || "")}"${ro ? " readonly" : ""}>`]], "AJOUTER UN PRIX")}</div>
        <div class="frs-sec" data-s="fam"><div class="frs-st">FAMILLES D'ARTICLES FOURNIES ${svCnt(F.fam.length)}</div><div class="frs-fam">${P.cat.map(c => `<label class="frs-c"><input type="checkbox" class="frs-fc" value="${esc(c)}"${F.fam.includes(c) ? " checked" : ""}${ro ? " disabled" : ""}> ${esc(c)}</label>`).join("") || `<span class="ach-0">AUCUNE CATÉGORIE (ACHATS › PARAMÈTRES)</span>`}</div></div>
        <div class="frs-sec" data-s="docf"><div class="frs-st">DOCUMENTS FISCAUX ${svCnt(F.docf.length)}</div>
          ${sub("docf", [["type", "DOCUMENT", (r, i) => `<select class="ins-in frs-s" data-c="type"${ro ? " disabled" : ""}>${ACH_DOCF.map(x => `<option${x === r.type ? " selected" : ""}>${esc(x)}</option>`).join("")}</select>`], ["no", "N°"], ["exp", "EXPIRE LE", (r) => `<input type="date" class="ins-in frs-s" data-c="exp" value="${esc(r.exp || "")}"${ro ? " readonly" : ""}>`]], "AJOUTER UN DOCUMENT")}</div>
        <div class="frs-sec" data-s="cte"><div class="frs-st">CONTACTS ${svCnt(F.cte.length)}</div>
          ${sub("cte", [["nom", "NOM"], ["fonction", "FONCTION"], ["role", "RÔLE", (r) => `<select class="ins-in frs-s" data-c="role"${ro ? " disabled" : ""}><option value="">—</option>${ACH_CROLES.map(x => `<option${x === r.role ? " selected" : ""}>${esc(x)}</option>`).join("")}</select>`], ["tel", "TÉLÉPHONE", null, ' inputmode="tel" data-mask="tel"'], ["email", "E-MAIL", (r) => `<input class="ins-in frs-s" data-c="email" data-keepcase value="${esc(r.email || "")}" inputmode="email"${ro ? " readonly" : ""} autocomplete="off">`],
            ["rec", `<span data-tip="PIÈCES QUE CE CONTACT REÇOIT PAR E-MAIL : ${ACH_RECV.map(x => x[1] + " = " + x[2]).join(", ")} ; REPRIS PAR DÉFAUT SUR CHAQUE PIÈCE, MODIFIABLES POUR UNE PIÈCE PRÉCISE">REÇOIT</span>`, (r) => `<span class="frs-rcs">${ACH_RECV.map(([k, a, l]) => `<label class="frs-rc" title="${l}"><input type="checkbox" class="frs-rcb" value="${k}"${(r.rec || []).includes(k) ? " checked" : ""}${ro ? " disabled" : ""}>${a}</label>`).join("")}</span>`]], "AJOUTER UN CONTACT")}</div>
        <div class="frs-sec" data-s="rsq"><div class="frs-st">RISQUE</div><div class="frs-g">${sel("solva", "SOLVABILITÉ", ACH_SOLVA)}${sel("strat", "PLACE DU FOURNISSEUR", ACH_STRAT)}</div></div>
        <div class="frs-sec" data-s="moy"><div class="frs-st">MOYENS</div><div class="frs-g">${inp("camions", "NOMBRE DE CAMIONS", { num: 1 })}${inp("capJour", "LIVRAISON PAR JOUR (EX. 200 M3)")}${inp("materiel", "MATÉRIEL", { w: 1 })}</div></div>
        <div class="frs-sec" data-s="refs"><div class="frs-st">RÉFÉRENCES (CHANTIERS DÉJÀ LIVRÉS) ${svCnt(F.refs.length)}</div>
          ${sub("refs", [["chantier", "CHANTIER"], ["client", "CLIENT"], ["annee", "ANNÉE", null, ' inputmode="numeric"'],
            ["mt", "MONTANT", (r) => `<input class="ins-in frs-s number" data-c="mt" inputmode="decimal" value="${esc(r.mt ? achF2(r.mt) : "")}"${ro ? " readonly" : ""} autocomplete="off">`]], "AJOUTER UNE RÉFÉRENCE")}</div>
        <div class="frs-sec" data-s="evl"><div class="frs-st">ÉVALUATIONS ${svCnt(F.evl.length)}${note === null ? "" : " — MOYENNE " + esc(String(Math.round(note * 10) / 10).replace(".", ",")) + " / 10"}</div>
          ${F.evl.map((x, i) => `<div class="frs-evl">☆ ${esc(String(x.date || "").slice(0, 10).split("-").reverse().join("/"))} — <b>${esc(String(Math.round(achN(x.moy) * 10) / 10).replace(".", ","))} / 10</b> (${esc((x.crit || []).map(c => c.d + " " + c.n).join(", "))})${ro ? "" : ` <button type="button" class="ach-x" data-rm="evl|${i}">✕</button>`}</div>`).join("") || `<div class="ach-0">AUCUNE ÉVALUATION</div>`}
          ${ro ? "" : `<table class="prm-table frs-sub frs-ecrit"><thead><tr><th>CRITÈRE</th><th>NOTE (0 À 10)</th></tr></thead><tbody>${[0, 1, 2, 3, 4].map(i => `<tr><td><input class="ins-in frs-ed" data-i="${i}" placeholder="${["QUALITÉ", "DÉLAIS", "PRIX", "SERVICE", ""][i]}" autocomplete="off"></td><td><input class="ins-in frs-en" data-i="${i}" inputmode="decimal" autocomplete="off"></td></tr>`).join("")}</tbody></table><button type="button" class="ach-b frs-add" data-evladd>+ AJOUTER L'ÉVALUATION</button>`}</div>
        <div class="frs-sec" data-s="cgf"><div class="frs-st">CONTRATS ${svCnt(F.cgf.length)}</div>
          ${sub("cgf", [["intitule", "INTITULÉ"], ["debut", "DÉBUT", (r) => `<input type="date" class="ins-in frs-s" data-c="debut" value="${esc(r.debut || "")}"${ro ? " readonly" : ""}>`], ["fin", "FIN", (r) => `<input type="date" class="ins-in frs-s" data-c="fin" value="${esc(r.fin || "")}"${ro ? " readonly" : ""}>`]], "AJOUTER UN CONTRAT")}</div>
        ${(() => { const SP = achFrsSpec(f0), S = achFrsSim(f0); /* B33 : spécialité (catégories des articles vendus) et fournisseurs qui vendent les mêmes articles ou catégories */
          return `<div class="frs-sec" data-s="sim"><div class="frs-st">SPÉCIALITÉ</div><div class="bsn-note">${SP.length ? SP.map(esc).join(" · ") : "— (CATÉGORIES DES ARTICLES VENDUS, D'APRÈS SES DEVIS ET COMMANDES)"}</div>
            <div class="frs-st">FOURNISSEURS SIMILAIRES ${svCnt(S.length)}</div><table class="prm-table frs-sub frs-sim"><thead><tr><th>FOURNISSEUR</th><th class="center">ARTICLES COMMUNS</th><th>CATÉGORIES COMMUNES</th><th>FRÉQUENCE</th></tr></thead><tbody>
            ${S.map(s => `<tr><td>${esc(achFrsRef(s.f) + " — " + s.f.nom)}</td><td class="center" title="${esc(s.arts.map(k => k.replace("|", " (") + ")").join(", "))}">${s.arts.length}</td><td>${esc(s.cats.join(", "))}</td><td>${esc(achFrsFreq(s.f).lab || "—")}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">AUCUN</td></tr>`}</tbody></table></div>`; })()}
        ${(() => { const T = achFrsStats(f0), F2 = v => achF2(v); /* B43 : statistiques (les courbes viendront plus tard) */
          return `<div class="frs-sec" data-s="stat"><div class="frs-st">STATISTIQUES (12 DERNIERS MOIS)</div><div class="frs-g">
            <label class="frs-f"><span>FRÉQUENCE</span><input class="ins-in" value="${esc(T.freq.lab ? T.freq.lab + (T.freq.m !== undefined ? " (" + String(Math.round(T.freq.m * 10) / 10).replace(".", ",") + " MOIS ENTRE DEUX COMMANDES)" : "") : "—")}" readonly></label>
            <label class="frs-f"><span>COMMANDES (EN TOUT)</span><input class="ins-in" value="${T.n}" readonly></label><label class="frs-f"><span>ACHETÉ SUR 12 MOIS (HT)</span><input class="ins-in" value="${esc(F2(T.mt))}" readonly></label></div>
            <div class="frs-st">PARTS PAR ARTICLE ${svCnt(T.parts.length)}</div><table class="prm-table frs-sub frs-stat"><thead><tr><th>ARTICLE</th><th>U</th><th class="number">ACHETÉ ICI (HT)</th><th class="number">TOTAL ARTICLE (HT)</th><th class="number">PART</th><th class="center">FOURNISSEURS</th></tr></thead><tbody>
            ${T.parts.map(p => `<tr><td>${esc(p.des)}</td><td>${esc(p.u)}</td><td class="number">${esc(F2(p.mt))}</td><td class="number">${esc(F2(p.tot))}</td><td class="number">${esc(String(Math.round(p.pct)))} %</td><td class="center">${p.n}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">AUCUN ACHAT SUR 12 MOIS</td></tr>`}</tbody></table></div>`; })()}
        <div class="frs-sec" data-s="cla"><div class="frs-st">CLAUSES GÉNÉRALES D'ACHAT ${svCnt(F.cla.length)}</div>
          ${sub("cla", [["t", "TYPE", (r) => `<select class="ins-in frs-s" data-c="t"${ro ? " disabled" : ""}>${ACH_CLT.map(([k, l]) => `<option value="${k}"${k === r.t ? " selected" : ""}>${l}</option>`).join("")}</select>`], ["txt", "ARTICLE"]], "AJOUTER UN ARTICLE")}</div>
        </div>`,
      foot: `<button type="button" class="svc-b" data-x>${ro ? "FERMER" : "ANNULER"}</button>${ro ? "" : `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button>`}` });
    const on = (TABS.find(t => t[0] === tab) || TABS[0])[2];
    d.querySelectorAll(".frs-sec[data-s]").forEach(x => { x.hidden = !on.includes(x.dataset.s); });
    if (!d.isConnected) sviWinShow(d);
  };
  draw();
  if (sec) setTimeout(() => d.querySelector(`.frs-sec[data-s="${sec}"]`)?.scrollIntoView({ block: "start" }), 50);
  /* lecture des cases dans le brouillon (avant chaque redessin) */
  const pull = () => {
    d.querySelectorAll(".frs-x").forEach(i => { const k = i.dataset.k; F[k] = ["ice", "ifisc", "rc", "cnss"].includes(k) ? sviMaskRaw(i.value) : ["patente", "codeCpt", "aeNo"].includes(k) ? achDig(i.value) : ["capital", "effectif", "plafEnc", "plafT", "escTaux", "escJours", "retTaux", "delai", "minCmd", "franco", "remise", "garMois", "camions"].includes(k) ? (String(i.value || "").trim() === "" ? "" : achN(i.value)) : ["dateCrea", "cgaDate", "revue"].includes(k) ? i.value : ["site", "mailCmd", "mailFac"].includes(k) ? String(i.value || "").trim().toLowerCase() : k === "gps" ? String(i.value || "").trim() : achU(i.value); });
    d.querySelectorAll(".frs-xs").forEach(i => { F[i.dataset.k] = i.value; });
    if (d.querySelector('select.frs-xs[data-k="codeCpt"]')) { const c = sviPgL("cpt").find(x => String(x.code) === String(F.codeCpt)); if (c) F.intCpt = achU(c.lab || ""); }
    d.querySelectorAll(".frs-xc").forEach(i => { F[i.dataset.k] = i.checked; });
    F.fam = [...d.querySelectorAll(".frs-fc:checked")].map(i => i.value);
    F.jours = [...d.querySelectorAll(".frs-jr:checked")].map(i => i.value);
    F.fermJ = [...d.querySelectorAll(".frs-fj:checked")].map(i => i.value);
    d.querySelectorAll('.frs-sub[data-sub="cte"] tr[data-i]').forEach(tr => { const r = F.cte[+tr.dataset.i]; if (r && !ro) r.rec = [...tr.querySelectorAll(".frs-rcb:checked")].map(i => i.value); });
    d.querySelectorAll(".frs-sub[data-sub]").forEach(t => { const k = t.dataset.sub; t.querySelectorAll("tr[data-i]").forEach(tr => { const r = F[k][+tr.dataset.i]; if (!r) return;
      tr.querySelectorAll(".frs-s").forEach(i => { const c = i.dataset.c; if (c === "bqId") return; /* B21 : la banque n'est gardée que choisie (sinon déduite du RIB) */ r[c] = c === "rib" ? achDig(i.value) : c === "email" ? String(i.value || "").trim().toLowerCase() : c === "mt" || c === "pu" ? achN(i.value) : c === "exp" || c === "ech" || c === "valid" || c === "debut" || c === "fin" || c === "type" || c === "role" || c === "t" || c === "bqId" || c === "ag" ? i.value : achU(i.value); }); }); });
    const rp = d.querySelector(".frs-rp:checked"); F.ribs.forEach((r, i) => { r.p = !!rp && +rp.dataset.i === i; });
  };
  /* v906 (principe du 03/11/2026 : erreur refusée dès la saisie) : chaque case de la fiche est contrôlée en la quittant —
     la case fautive reprend sa valeur d'avant, avec la raison (les contrôles d'ENREGISTRER restent ; masques IF / RC / CNSS / TÉLÉPHONE : règle commune, 09f) */
  const frsWhy = i => {
    const k = i.dataset.k || i.dataset.c, raw = String(i.value ?? "").trim(), v = achU(raw);
    if (i.classList.contains("frs-x")) {
      if (k === "nom" && !v) return "NOM OBLIGATOIRE.";
      if (k === "ice" && sviMaskRaw(raw)) { const c = sviMaskRaw(raw); if (!achIceOk(c)) return achIceMsg() + "."; const x = achFrsDupIce(achFrs(), c, id); if (x) return "ICE DÉJÀ UTILISÉ PAR " + x.code + " — " + x.nom + "."; }
      if (k === "forme" && v && !ACH_FORMES.includes(v)) return "FORME JURIDIQUE : CHOISIR DANS LA LISTE.";
      if (k === "cond" && v && !ACH_CONDS.includes(v)) return "CONDITIONS DE PAIEMENT : CHOISIR DANS LA LISTE.";
      if ((k === "mailCmd" || k === "mailFac") && raw && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(raw)) return "E-MAIL NON VALIDE.";
      if (["escTaux", "retTaux", "remise"].includes(k) && achN(raw) > 100) return "UN TAUX NE PEUT PAS DÉPASSER 100 %.";
      if (k === "gps" && raw && !/^-?\d{1,2}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?$/.test(raw)) return "POSITION GPS : LATITUDE, LONGITUDE (EX. 33.5731, -7.5898).";
    }
    if (i.classList.contains("frs-xs") && k === "grp" && !i.value) return "GROUPE OBLIGATOIRE.";
    if (i.classList.contains("frs-s")) {
      if (k === "email" && raw && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(raw)) return "E-MAIL NON VALIDE.";
      if (k === "annee" && raw && !/^(19|20)\d{2}$/.test(raw)) return "RÉFÉRENCES : ANNÉE SUR 4 CHIFFRES.";
      if (k === "pu" && raw && !(achN(raw) > 0)) return "TARIFS : PRIX SUPÉRIEUR À 0.";
      if (k === "rib" && achDig(raw)) { const r = achDig(raw); if (!achRibOk(r)) return "RIB NON VALIDE : 24 CHIFFRES ET CLÉ (LE RIB DOIT ÊTRE DIVISIBLE PAR 97).";
        const tr = i.closest("tr[data-i]"), me = tr ? +tr.dataset.i : -1;
        if ((F.ribs || []).some((x, j) => j !== me && achDig(x.rib) === r)) return "LE MÊME RIB EST SAISI DEUX FOIS."; }
    }
    return "";
  };
  /* B29 : changer le TYPE d'un article reprend sa valeur par défaut (si l'article était vide ou gardait celle de l'ancien type) */
  d.addEventListener("change", e => { const s = e.target.closest && e.target.closest('table[data-sub="cla"] select[data-c="t"]'); if (!s) return; const tr = s.closest("tr[data-i]"), x = F.cla[+tr.dataset.i]; if (!x) return;
    const inp = tr.querySelector('input[data-c="txt"]'), cur = inp ? achU(inp.value) : x.txt; if (!cur || cur === achCltDef(x.t)) { if (inp) inp.value = achCltDef(s.value); } x.t = s.value; x.txt = inp ? achU(inp.value) : x.txt; });
  /* B21 : changer la banque d'un RIB recharge ses agences */
  d.addEventListener("change", e => { const s = e.target.closest && e.target.closest('table[data-sub="ribs"] select[data-c="bqId"]'); if (!s) return; pull(); const r = F.ribs[+s.closest("tr[data-i]").dataset.i]; if (r) { r.bqId = s.value; r.ag = ""; } draw(); });
  /* B41 : LANGUE — « AJOUTER… » en bas de la liste ; la langue ajoutée l'est partout (PARAMÉTRAGE GÉNÉRAL) */
  d.addEventListener("change", async e => { const s = e.target.closest && e.target.closest('select[data-k="lang"]'); if (!s || s.value !== "__add") return; e.stopImmediatePropagation();
    let v = ""; const h = ev => { if (ev.target && ev.target.id === "frsLangNew") v = ev.target.value; }; document.addEventListener("input", h, true);
    const ok = await svConfirm({ title: "AJOUTER UNE LANGUE", html: `<input class="ins-in" id="frsLangNew" autocomplete="off" style="width:100%">`, ok: "AJOUTER", tone: "neutral" });
    document.removeEventListener("input", h, true); v = sviPgU(v);
    if (ok && v) { sviLangueAdd(v); pull(); F.lang = v; } else s.value = F.lang || ""; draw(); }, true);
  d.addEventListener("focusin", e => { const i = e.target.closest && e.target.closest(".frs-x, .frs-xs, .frs-s"); if (i) i.dataset.prev = i.value; });
  d.addEventListener("change", e => {
    const i = e.target.closest && e.target.closest(".frs-x, .frs-xs, .frs-s"); if (!i || ro) return;
    const why = frsWhy(i); if (!why) return;
    e.stopImmediatePropagation();
    i.value = i.dataset.prev ?? ""; svToast(why, 4000, i);
  }, true);
  /* logo réduit à 96 px pour rester léger dans la base */
  d.addEventListener("change", e => {
    if (e.target.matches('.frs-x[data-k="forme"], .frs-xs[data-k="grp"]')) { pull(); draw(); return; }
    const fi = e.target.closest(".frs-logo-in"); if (!fi || !fi.files || !fi.files[0]) return;
    const rd = new FileReader();
    rd.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, 96 / Math.max(im.width, im.height)), c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k)); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      pull(); F.logo = c.toDataURL("image/png"); draw(); }; im.src = rd.result; };
    rd.readAsDataURL(fi.files[0]);
  });
  d.addEventListener("click", async e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
    const ft = e.target.closest("[data-ftab]");
    if (ft) { if (!ro) pull(); tab = ft.dataset.ftab; draw(); return; }
    if (ro) return;
    const ad = e.target.closest("[data-add]");
    if (ad) { pull(); const k = ad.dataset.add; F[k].push(k === "cla" ? { t: "autre", txt: "" } : k === "refs" ? { chantier: "", client: "", annee: "", mt: 0 } : k === "tar" ? { des: "", u: "", pu: 0, valid: "" } : k === "cau" ? { type: ACH_CAUT[0], no: "", bq: "", mt: 0, ech: "" } : k === "ribs" ? { rib: "", p: !F.ribs.length } : k === "docf" ? { type: ACH_DOCF[0], no: "", exp: "" } : k === "cte" ? { nom: "", fonction: "", role: "", tel: "", email: "" } : { intitule: "", debut: "", fin: "" }); draw(); return; }
    const rm = e.target.closest("[data-rm]");
    if (rm) { pull(); const [k, i] = rm.dataset.rm.split("|"); F[k].splice(+i, 1); if (k === "ribs" && F.ribs.length && !F.ribs.some(r => r.p)) F.ribs[0].p = true; draw(); return; }
    if (e.target.closest("[data-evladd]")) {
      pull();
      const crit = [...d.querySelectorAll(".frs-ed")].map(i => ({ d: achU(i.value), n: Math.max(0, Math.min(10, achN((d.querySelector(`.frs-en[data-i="${i.dataset.i}"]`) || {}).value))) })).filter(c => c.d);
      if (!crit.length) { svToast("ÉVALUATION : AU MOINS UN CRITÈRE (NOM ET NOTE).", 3000); return; }
      F.evl.push({ date: new Date().toISOString(), crit, moy: crit.reduce((t, c) => t + c.n, 0) / crit.length }); draw(); return;
    }
    if (e.target.closest("[data-logorm]")) { pull(); F.logo = ""; draw(); return; }
    if (e.target.closest("[data-ribok]")) { pull(); F.ribChg = ""; F.__ribOk = true; draw(); return; }
    if (!e.target.closest("[data-save]")) return;
    pull();
    const L = achFrs(), f = L.find(x => x.id === id); if (!f) { d.remove(); return; }
    /* contrôles bloquants */
    if (!F.nom) { svToast("NOM OBLIGATOIRE.", 3000); return; }
    if (F.ice && !achIceOk(F.ice)) { svToast(achIceMsg() + ".", 3500); return; }
    { const x = achFrsDupIce(L, F.ice, id); if (x) { svToast("ICE DÉJÀ UTILISÉ PAR " + x.code + " — " + x.nom + ".", 4000); return; } }
    if (F.forme && !ACH_FORMES.includes(F.forme)) { svToast("FORME JURIDIQUE : CHOISIR DANS LA LISTE.", 3500); return; }
    if (["mailCmd", "mailFac"].some(k => F[k] && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(F[k]))) { svToast("E-MAIL NON VALIDE.", 3000); return; }
    for (const [k, m] of [["ifisc", "if"], ["rc", "rc"], ["cnss", "cnss"]]) if (F[k] && !sviMaskOk(m, F[k])) { svToast(sviMaskLab(m) + " NON VALIDE : FORMAT " + sviMaskOf(m).m + ".", 3500); return; }
    { const c = F.cte.find(c => c.tel && !sviMaskOk("tel", c.tel)); if (c) { svToast("TÉLÉPHONE NON VALIDE (" + (c.nom || c.tel) + ") : FORMAT " + sviMaskOf("tel").m + ".", 3500); return; } }
    for (const k of ["escTaux", "retTaux", "remise"]) if (achN(F[k]) > 100) { svToast("UN TAUX NE PEUT PAS DÉPASSER 100 %.", 3000); return; }
    if (F.gps && !/^-?\d{1,2}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?$/.test(F.gps)) { svToast("POSITION GPS : LATITUDE, LONGITUDE (EX. 33.5731, -7.5898).", 3500); return; }
    if (F.refs.some(x => x.annee && !/^(19|20)\d{2}$/.test(String(x.annee)))) { svToast("RÉFÉRENCES : ANNÉE SUR 4 CHIFFRES.", 3000); return; }
    if (F.tar.some(x => !(achN(x.pu) > 0))) { svToast("TARIFS : PRIX OBLIGATOIRE.", 3000); return; }
    { const m = F.ribs.map(r => achRibBqWhy({ ...r, bqId: r.bqId || (achBankOfRib(r.rib) || {}).id || "" })).find(Boolean); if (m) { svToast(m + ".", 4500); return; } }
    if (!F.grp || !achPrm().grp.some(g => g.id === F.grp)) { svToast("GROUPE OBLIGATOIRE.", 3000); return; }
    if (achSt(f0) !== "instance" && achFrsGrpId(f0) !== F.grp) { svToast("LE GROUPE NE SE CHANGE PLUS APRÈS LA VALIDATION (LA RÉFÉRENCE CHANGERAIT).", 4000); return; }
    if (achSt(f0) !== "instance" && achFrsPfx(f0) !== achFrsPfx(F)) { svToast("LE TYPE NE SE CHANGE PLUS APRÈS LA VALIDATION (LE PRÉFIXE DE LA RÉFÉRENCE CHANGERAIT).", 4000); return; }
    F.occ = F.grp === "occ"; F.orgFin = F.type === ACH_GRP_OLD.fin;
    if (F.cga && !F.cgaDate) { svToast("CONDITIONS GÉNÉRALES SIGNÉES : DONNER LA DATE.", 3000); return; }
    if (F.forme !== "AUTO-ENTREPRENEUR") { F.aeNo = ""; F.aeCin = ""; }
    if (F.lie && !F.lieT) { svToast("FOURNISSEUR LIÉ : CHOISIR LE LIEN.", 3000); return; }
    if (!F.lie) F.lieT = "";
    if (F.cond && !ACH_CONDS.includes(F.cond)) { svToast("CONDITIONS DE PAIEMENT : CHOISIR DANS LA LISTE.", 3500); return; }
    F.ribs = F.ribs.filter(r => achDig(r.rib));
    if (F.ribs.some(r => !achRibOk(r.rib))) { svToast("RIB NON VALIDE : 24 CHIFFRES ET CLÉ (LE RIB DOIT ÊTRE DIVISIBLE PAR 97).", 4000); draw(); return; }
    if (new Set(F.ribs.map(r => achDig(r.rib))).size < F.ribs.length) { svToast("LE MÊME RIB EST SAISI DEUX FOIS.", 3500); draw(); return; }
    if (F.ribs.length && !F.ribs.some(r => r.p)) F.ribs[0].p = true;
    F.cte = F.cte.filter(c => c.nom || c.tel || c.email); F.cgf = F.cgf.filter(c => c.intitule); F.cla = F.cla.filter(c => c.txt || c.t !== "autre"); F.docf = F.docf.filter(x => x.type && (x.no || x.exp)); F.cau = F.cau.filter(x => x.no || x.mt || x.ech); F.tar = F.tar.filter(x => x.des); F.refs = F.refs.filter(x => x.chantier);
    /* changement de RIB : confirmé, noté, signalé jusqu'à vérification */
    const oldR = (f.ribs || []).map(r => achDig(r.rib)), newR = F.ribs.map(r => achDig(r.rib)), oldP = (achFrsRibP(f) || {}).rib || "", newP = (achFrsRibP(F) || {}).rib || "";
    const chg = oldR.length && (oldR.some(r => !newR.includes(r)) || newR.some(r => !oldR.includes(r)) || achDig(oldP) !== achDig(newP));
    if (chg) {
      if (!(await svConfirm({ title: "CHANGEMENT DE RIB", html: `<div class="svc-sub">${esc(F.code + " — " + F.nom)}</div><div class="svc-sub">AVANT : ${esc(oldR.join(" · ") || "—")}</div><div class="svc-sub">APRÈS : ${esc(newR.join(" · ") || "—")}</div><div class="svc-sub">UN CHANGEMENT DE RIB EST UNE FRAUDE COURANTE : LE CONFIRMER AUPRÈS DU FOURNISSEUR PAR UN AUTRE MOYEN (TÉLÉPHONE CONNU). LE FOURNISSEUR RESTE SIGNALÉ JUSQU'À « RIB VÉRIFIÉ ».</div>`, ok: "ENREGISTRER LE NOUVEAU RIB" }))) return;
      F.ribChg = new Date().toISOString();
      achHist(F.code, "RIB MODIFIÉ", (oldR.join(" · ") || "—") + " → " + (newR.join(" · ") || "—"));
    }
    if (F.__ribOk) { achHist(F.code, "RIB VÉRIFIÉ", newR.join(" · ")); delete F.__ribOk; }
    const LAB = { nom: "NOM", denom: "DÉNOMINATION", forme: "FORME", ville: "VILLE", adresse: "ADRESSE", site: "SITE WEB", resp: "RESPONSABLE", type: "TYPE", pays: "PAYS", lang: "LANGUE", mailCmd: "E-MAIL DE COMMANDE", mailFac: "E-MAIL DE FACTURATION", origine: "ORIGINE", lie: "FOURNISSEUR LIÉ", lieT: "LIEN", logo: "LOGO", grp: "GROUPE", cnss: "CNSS", dateCrea: "DATE DE CRÉATION", dirigeant: "DIRIGEANT", aeNo: "N° AUTO-ENTREPRENEUR", aeCin: "CIN", qualif: "QUALIFICATION", classe: "CLASSIFICATION", effectif: "EFFECTIF", certif: "CERTIFICATIONS", assRc: "ASSURANCE RC", secu: "SÉCURITÉ", cga: "CONDITIONS GÉNÉRALES", cgaDate: "DATE DES CONDITIONS GÉNÉRALES", revue: "REVUE", occ: "OCCASIONNEL", orgFin: "ORGANISME FINANCIER", actif: "ACTIF",
      ice: "ICE", ifisc: "IF", rc: "RC", villeRc: "VILLE RC", patente: "PATENTE", capital: "CAPITAL", codeCpt: "CODE COMPTABLE", intCpt: "INTITULÉ COMPTABLE", cond: "PAIEMENT", fam: "FAMILLES", docf: "DOCUMENTS FISCAUX", plafEnc: "PLAFOND D'ENCOURS", encNom: "PERSONNE QUI ENCAISSE", jours: "JOURS DE PAIEMENT", cau: "CAUTIONS", modeReg: "MODE DE RÈGLEMENT", escTaux: "ESCOMPTE", escJours: "DÉLAI D'ESCOMPTE", retAcc: "RETENUE ACCEPTÉE", retTaux: "TAUX DE RETENUE", delai: "DÉLAI", devise: "DEVISE", minCmd: "MINIMUM", franco: "FRANCO", remise: "REMISE", envoi: "ENVOI DES COMMANDES", livr: "LIVRAISON", heuresLiv: "HEURES DE LIVRAISON", gps: "GPS DU DÉPÔT", incoterm: "INCOTERM", transit: "TRANSITAIRE", conges: "CONGÉS", fermJ: "JOURS SANS LIVRAISON", garMois: "GARANTIE", savContact: "CONTACT SAV", tar: "TARIFS", solva: "SOLVABILITÉ", strat: "PLACE DU FOURNISSEUR", camions: "CAMIONS", capJour: "CAPACITÉ PAR JOUR", materiel: "MATÉRIEL", refs: "RÉFÉRENCES", cte: "CONTACTS", evl: "ÉVALUATIONS", cgf: "CONTRATS", cla: "CLAUSES GÉNÉRALES" };
    const ch = Object.keys(LAB).filter(k => JSON.stringify(f[k] ?? "") !== JSON.stringify(F[k] ?? ""));
    Object.assign(f, F, { mod: new Date().toISOString() });
    if (ch.length) achHist(f.code, "MODIFICATION", ch.map(k => LAB[k]).join(", "));
    achFrsSave(L); d.remove(); if (done) done();
  });
}
/* ⟪ src/43-achats-besoins.js ⟫ */
/* =========================================================
   v760 : BESOINS (étape 2) — menu ☰ › BESOIN (à part) ; même écran que les achats, onglet BESOINS
   Tableau au format des articles (tri / filtre communs, largeurs et ordre mémorisés, filtre par état, H, ⚠) ;
   la RÉFÉRENCE soulignée ouvre la FICHE ; ligne CRÉER UN BESOIN ICI… ; règles et contrôle : 40-achats-donnees.js (achBsnCtl…).
   ========================================================= */
function achBsnMod(ctx) {
  const { body, cfApply, cfHead, SEL, draw, F2 } = ctx;
  const B_ETATS = [["actif", "ACTIF"], ["instance", "EN INSTANCE"], ["valide", "VALIDÉS"], ["alerte", "ALERTE"], ["annule", "ANNULÉS"], ["tout", "TOUT"]];
  let bEtat = "actif"; try { const e0 = localStorage.getItem("svi_ach_bsn_etat_v1"); if (B_ETATS.some(x => x[0] === e0)) bEtat = e0; } catch (e) {}
  const bOk = (b, k, L) => k === "tout" ? true : k === "annule" ? b.state === "annule" : k === "valide" ? b.state === "valide" : k === "instance" ? b.state !== "valide" && b.state !== "annule"
    : k === "alerte" ? achBsnWhy(b, L).length > 0 : b.state !== "annule";
  const stLab = b => b.state === "valide" ? (achBsnRecu(b) ? "CLÔTURÉ" : "VALIDÉ") : b.state === "annule" ? (b.refus ? "REFUSÉ" : "ANNULÉ") : "EN INSTANCE";
  const ctlLab = (b, L) => { if (b.centre === "SIÈGE") return "SIÈGE"; const c = achBsnCtl(b, L); if (!c) return ""; if (c.none) return "HORS BUDGET";
    return c.over ? (b.deb ? "DÉBLOQUÉ (" + Math.round(c.pct) + " %)" : "BLOQUÉ (" + Math.round(c.pct) + " %)") : Math.round(c.pct) + " %"; };
  const dFr = v => /^\d{4}-\d{2}-\d{2}/.test(String(v || "")) ? String(v).slice(8, 10) + "/" + String(v).slice(5, 7) + "/" + String(v).slice(0, 4) : "";
  const COLS = L => [["ref", "RÉFÉRENCE", b => b.ref, ""], ["bdg", "BUDGET", b => b.centre === "SIÈGE" ? "SIÈGE" : b.bdgLab || b.bdg || "", ""], ["des", "CHARGE", b => b.des || "", ""],
    ["u", "U", b => b.u || "", "center"], ["q", "QUANTITÉ", b => achN(b.q), "number"], ["pu", "PRIX ESTIMÉ", b => achN(b.pu), "number"], ["mt", "MONTANT", b => achN(b.q) * achN(b.pu), "number"],
    ["tache", "TÂCHE", b => b.tache || "", ""], ["prevue", "PRÉVU LE", b => dFr(b.datePrevue), ""], ["prio", "URGENCE", b => achBsnUrg(b), "center"], ["av", "AVANCEMENT", b => achBsnAvLab(b), "center"],
    ["etat", "ÉTAT", b => stLab(b), "center"], ["ctl", "CONTRÔLE", b => ctlLab(b, L), "center"], ["dem", "DEMANDEUR", b => b.dem || "", ""]];
  const W0 = { ref: 150, bdg: 220, des: 220, u: 60, q: 100, pu: 110, mt: 120, tache: 220, prevue: 110, prio: 120, av: 170, etat: 110, ctl: 130, dem: 120 };
  /* v765 : liste au format du budget (achListMod → achNvList) : EN INSTANCE / VALIDÉS, dates, CRÉER UN BESOIN ICI… en bas */
  return achListMod(ctx, { k: "bsn", t: "ach_bsn", id: "achBsnT", name: "BESOINS", list: achBsn, save: achBsnSave, inst: b => b.state !== "valide" && b.state !== "annule",
    open: achBsnFiche, why: (b, L) => achBsnWhy(b, L), w: W0, cols: () => COLS(achBsn()), newRow: "CRÉER UN BESOIN ICI…" });
}
function achBsnFiche(id, done) {
  const L0 = achBsn(), b0 = id ? L0.find(x => x.id === id) : null;
  if (id && !b0) return;
  const B = b0 ? JSON.parse(JSON.stringify(b0)) : { id: "", ref: "", centre: "CHANTIER", bdg: "", bdgLab: "", chg: "", des: "", u: "", tache: "", q: "", pu: 0, datePrevue: "", prio: "NORMALE", dest: "", obs: "", dem: typeof sviUser === "function" ? sviUser() : "", state: "instance" };
  const ro = !!b0 && b0.state !== "instance";
  const BL = achBdgList(), d = sviWinNew();
  const opt = (L, v) => L.map(x => `<option value="${esc(x[0])}"${x[0] === v ? " selected" : ""}>${esc(x[1])}</option>`).join("");
  const draw = () => {
    const C = B.centre === "SIÈGE" || !B.bdg ? [] : achBdgCharges(B.bdg), ch = C.find(x => x.key === B.chg);
    if (ch) { B.des = ch.des; B.u = ch.u; B.pu = Math.round(ch.p * 100) / 100; }
    const ctl = achBsnCtl(B, achBsn()), why = achBsnWhy(B, achBsn());
    const nf = v => (Number(v) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dis = ro ? " disabled" : "";
    d.innerHTML = sviWinCard({ cls: "frs-card bsn-card", close: "data-x", title: (b0 ? "BESOIN — " + esc(B.ref) + " · " + (B.state === "valide" ? "VALIDÉ" : B.state === "annule" ? "ANNULÉ" : "EN INSTANCE") : "NOUVEAU BESOIN"),
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}</div>` : ""}<div class="frs-scroll">
        <div class="frs-sec"><div class="frs-st">AFFECTATION</div><div class="frs-g">
          <label class="frs-f"><span>CENTRE DE COÛT</span><select class="ins-in bsn-x" data-k="centre"${dis}>${opt([["CHANTIER", "CHANTIER (BUDGET)"], ["SIÈGE", "SIÈGE (HORS BUDGET)"]], B.centre)}</select></label>
          ${B.centre === "SIÈGE" ? `<label class="frs-f frs-w"><span>CHARGE <b>*</b></span><input class="ins-in bsn-x" data-k="des" value="${esc(B.des)}"${dis} autocomplete="off"></label>
            <label class="frs-f"><span>UNITÉ</span><input class="ins-in bsn-x" data-k="u" value="${esc(B.u)}"${dis} autocomplete="off"></label>`
          : `<label class="frs-f frs-w"><span>BUDGET <b>*</b></span><select class="ins-in bsn-x" data-k="bdg"${dis}><option value=""></option>${opt(BL.map(x => [x.ref, x.lab]), B.bdg)}</select></label>
            <label class="frs-f frs-w"><span>CHARGE DU BUDGET <b>*</b></span><select class="ins-in bsn-x" data-k="chg"${dis}><option value=""></option>${opt(C.map(x => [x.key, x.des + " (" + x.u + ")"]), B.chg)}</select></label>
            <label class="frs-f frs-w"><span>TÂCHE</span><select class="ins-in bsn-x" data-k="tache"${dis}><option value=""></option>${opt((ch ? ch.tasks : []).map(t => [t, t]), B.tache)}</select></label>`}
        </div></div>
        ${ctl && !ctl.none ? `<div class="bsn-ctl${ctl.over ? " over" : ctl.pct >= achBsnSeuil() ? " near" : ""}"><span>PRÉVU : <b>${esc(nf(ctl.planQ))} ${esc(B.u)}</b> · ${esc(nf(ctl.plan))} DH</span><span>DÉJÀ DEMANDÉ : <b>${esc(nf(ctl.usedQ))}</b></span><span>DÉJÀ COMMANDÉ : <b>${esc(nf(achBsnCmdChg(B)))}</b></span><span>RESTE : <b>${esc(nf(ctl.restQ))}</b></span><span>AVEC CE BESOIN : <b>${Math.round(ctl.pct)} %</b></span></div>` : ""}
        <div class="frs-sec"><div class="frs-st">DEMANDE</div><div class="frs-g">
          <label class="frs-f"><span>QUANTITÉ <b>*</b></span><input class="ins-in bsn-x" data-k="q" value="${esc(B.q === "" ? "" : String(B.q).replace(".", ","))}" inputmode="decimal"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>PRIX ESTIMÉ HT</span><input class="ins-in bsn-x" data-k="pu" value="${esc(nf(B.pu))}" inputmode="decimal"${dis || (B.centre !== "SIÈGE" ? " readonly" : "")} autocomplete="off"></label>
          <label class="frs-f"><span>MONTANT ESTIMÉ</span><input class="ins-in" value="${esc(nf(achN(B.q) * achN(B.pu)))}" readonly></label>
          <label class="frs-f"><span>PRÉVU LE <b>*</b></span><input type="date" class="ins-in bsn-x" data-k="datePrevue" value="${esc(B.datePrevue)}"${dis}></label>
          <label class="frs-f"><span>URGENCE (SELON LA DATE)</span><input class="ins-in" value="${esc(achBsnUrg(B))}" readonly></label>
          <label class="frs-f"><span>DESTINATAIRE (PERSONNE)</span><input class="ins-in bsn-x" data-k="dest" value="${esc(B.dest)}"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>LIEU DE LIVRAISON (BLOC, ZONE)</span><input class="ins-in bsn-x" data-k="lieu" value="${esc(B.lieu || "")}"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>DEMANDEUR</span><input class="ins-in" value="${esc(B.dem)}" readonly></label>
          <label class="frs-f frs-w"><span>USAGE PRÉVU (COMMENTAIRE DU DEMANDEUR)</span><input class="ins-in bsn-x" data-k="usage" value="${esc(B.usage || "")}"${dis} autocomplete="off"></label>
          <label class="frs-f frs-w"><span>OBSERVATION</span><input class="ins-in bsn-x" data-k="obs" value="${esc(B.obs)}"${dis} autocomplete="off"></label>
          <div class="frs-cs"><label class="frs-c"><input type="checkbox" class="bsn-arret"${B.arret ? " checked" : ""}${dis}> RISQUE D'ARRÊT DU CHANTIER SI LA LIVRAISON N'ARRIVE PAS À TEMPS</label></div>
        </div></div>
        ${ctl && ctl.over && !ctl.none && B.state !== "annule" ? `<div class="frs-sec"><div class="frs-st">DÉPASSEMENT DU PRÉVU</div>
          ${B.deb ? `<div class="bsn-deb">DÉBLOQUÉ PAR ${esc(B.deb.u || "?")} LE ${esc(dFr2(B.deb.t))} — ${esc(B.deb.why || "")}</div>`
            : `<label class="frs-f frs-w"><span>JUSTIFICATION <b>*</b></span><input class="ins-in bsn-just" value="${esc(B.just || "")}" autocomplete="off"></label><button type="button" class="ach-b" data-deb>DÉBLOQUER</button><span class="bsn-note">DÉBLOCAGE SELON LES DROITS : POUR L'INSTANT, TOUT UTILISATEUR (NOTÉ DANS H).</span>`}</div>` : ""}
        ${b0 && B.state !== "instance" ? `<div class="bsn-deb">AVANCEMENT : ${esc(achBsnAvLab(B))}${B.refus ? " — " + esc(B.refus.why || "") + " (" + esc(B.refus.u || "") + ")" : ""}${B.qInit ? " — RESTE ANNULÉ : " + esc(nf(achN(B.qInit) - achN(B.q))) + " " + esc(B.u) : ""}</div>` : ""}
        ${B.couvert ? `<div class="bsn-deb">COUVERT PAR LA CONSULTATION ${esc(((achCaf().find(c => c.id === B.couvert) || {}).ref) || "")}.</div>` : B.direct ? `<div class="bsn-deb">ACHAT DIRECT (SANS CONSULTATION) — ${esc(dFr2(B.direct))}.</div>` : ""}

      </div>`,
      foot: `<button type="button" class="svc-b" data-x>${ro || b0 ? "FERMER" : "ANNULER"}</button>
        ${b0 && B.state !== "annule" ? `<button type="button" class="svc-b" data-cancel>ANNULER LE BESOIN</button>` : ""}
        ${b0 && B.state === "annule" ? `<button type="button" class="svc-b" data-restore>RÉTABLIR</button>` : ""}
        ${b0 ? `<button type="button" class="svc-b" data-dup>DUPLIQUER</button>` : ""}
        ${b0 && B.state === "instance" ? `<button type="button" class="svc-b" data-refus>REFUSER</button>` : ""}
        ${!ro ? `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button>` : ""}
        ${b0 && B.state === "instance" ? `<button type="button" class="svc-b svc-ok" data-valid>VALIDER</button>` : ""}
        ${b0 && B.state === "valide" && !B.couvert && !B.direct ? `<button type="button" class="svc-b" data-direct>ACHAT DIRECT (SANS CONSULTATION)</button>` : ""}` });
    if (!d.isConnected) sviWinShow(d);
  };
  const dFr2 = v => String(v || "").slice(0, 10).split("-").reverse().join("/");
  const pull = () => { d.querySelectorAll(".bsn-x").forEach(i => { const k = i.dataset.k; B[k] = k === "q" || k === "pu" ? (String(i.value).trim() === "" ? "" : achN(i.value)) : k === "datePrevue" || k === "bdg" || k === "chg" || k === "tache" || k === "centre" ? i.value : achU(i.value); });
    const j = d.querySelector(".bsn-just"); if (j) B.just = achU(j.value);
    const ar = d.querySelector(".bsn-arret"); if (ar && !ar.disabled) B.arret = ar.checked; };
  draw();
  d.addEventListener("change", e => {
    if (!e.target.closest(".bsn-x")) return;
    const k = e.target.dataset.k; pull();
    if (k === "bdg") { B.chg = ""; B.tache = ""; B.bdgLab = (BL.find(x => x.ref === B.bdg) || {}).lab || ""; }
    if (k === "chg") { B.tache = ""; const ch = achBdgCharges(B.bdg).find(x => x.key === B.chg); if (ch && ch.tasks.length === 1) B.tache = ch.tasks[0]; }
    if (k === "centre") { B.bdg = ""; B.chg = ""; B.tache = ""; B.des = ""; B.u = ""; B.pu = 0; }
    draw();
  });
  const save = (L, b, act) => { achBsnSave(L); achHist(b.ref, act, [b.des, b.u, achN(b.q) || ""].filter(Boolean).join(" · ")); };
  d.addEventListener("click", async e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
    const L = achBsn(), cur = b0 ? L.find(x => x.id === b0.id) : null;
    /* v813 : DUPLIQUER (C4.11) — nouveau besoin EN INSTANCE, mêmes affectation et demande, date à revoir */
    if (e.target.closest("[data-dup]")) { if (!cur) return; const now = new Date().toISOString(), n = { id: "N" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ref: achBsnNextRef(L), cree: now, mod: now, state: "instance",
        centre: cur.centre, bdg: cur.bdg, bdgLab: cur.bdgLab, chg: cur.chg, des: cur.des, u: cur.u, tache: cur.tache, q: cur.qInit || cur.q, pu: cur.pu, datePrevue: "", dest: cur.dest, lieu: cur.lieu || "", usage: cur.usage || "", obs: cur.obs, arret: !!cur.arret, dem: typeof sviUser === "function" ? sviUser() : cur.dem };
      L.push(n); save(L, n, "CRÉATION (DUPLIQUÉ DE " + cur.ref + ")"); d.remove(); if (done) done(); achBsnFiche(n.id, done); return; }
    /* v813 : REFUSER (C4.27) — motif écrit, gardé ; le demandeur le voit sur son besoin (REFUSÉ) */
    if (e.target.closest("[data-refus]")) { if (!cur) return; const m = await achAsk("REFUSER LE BESOIN " + cur.ref, "MOTIF DU REFUS"); if (!m) return;
      cur.state = "annule"; cur.refus = { u: typeof sviUser === "function" ? sviUser() : "", t: new Date().toISOString(), why: m }; cur.mod = cur.refus.t; save(L, cur, "REFUSÉ — " + m); d.remove(); if (done) done(); return; }
    /* v813 : un besoin validé déjà commandé en partie : seul le reste non commandé est annulé (C4.26) */
    if (e.target.closest("[data-cancel]") && cur && cur.state === "valide" && achBsnAv(cur).cmdQ > 0) { const a = achBsnAv(cur), rest = achN(cur.q) - a.cmdQ;
      if (rest <= 1e-9) { svToast("BESOIN ENTIÈREMENT COMMANDÉ : RIEN À ANNULER (ANNULER LA COMMANDE D'ABORD).", 4000); return; }
      if (!(await svConfirm({ title: "ANNULER LE RESTE DU BESOIN", text: cur.ref + " : " + achF2(a.cmdQ) + " " + cur.u + " DÉJÀ COMMANDÉS SONT GARDÉS ; SEUL LE RESTE (" + achF2(rest) + " " + cur.u + ") EST ANNULÉ.", ok: "ANNULER LE RESTE" }))) return;
      cur.qInit = cur.qInit || cur.q; cur.q = Math.round(a.cmdQ * 1000) / 1000; cur.mod = new Date().toISOString(); save(L, cur, "RESTE ANNULÉ (" + achF2(rest) + " " + cur.u + ")"); d.remove(); if (done) done(); return; }
    if (e.target.closest("[data-cancel]")) { if (!cur) return; if (!(await svConfirm({ title: "ANNULER LE BESOIN", text: cur.ref + " PASSE EN ANNULÉ (GARDÉ, RÉTABLISSABLE) ; IL NE COMPTE PLUS DANS LE CONTRÔLE DU BUDGET.", ok: "ANNULER LE BESOIN" }))) return;
      cur.state = "annule"; cur.mod = new Date().toISOString(); save(L, cur, "ANNULÉ"); d.remove(); if (done) done(); return; }
    /* v761 : ACHAT DIRECT — besoin validé dont le montant estimé est sous le seuil (ACHATS › PARAMÈTRES) */
    if (e.target.closest("[data-direct]")) { if (!cur) return; const no = achDirCheck(cur);
      if (no) { svToast(no + " (ACHATS › PARAMÈTRES) — PASSER PAR UNE CONSULTATION.", 5500); return; }
      cur.direct = new Date().toISOString(); cur.mod = cur.direct; save(L, cur, "ACHAT DIRECT"); d.remove(); if (done) done(); return; }
    if (e.target.closest("[data-restore]")) { if (!cur) return; cur.state = "instance"; delete cur.deb; delete cur.refus; cur.mod = new Date().toISOString(); save(L, cur, "RÉTABLI"); d.remove(); if (done) done(); return; }
    if (e.target.closest("[data-deb]")) {
      pull(); if (!B.just) { svToast("JUSTIFICATION OBLIGATOIRE AVANT DE DÉBLOQUER.", 3000); return; }
      B.deb = { u: typeof sviUser === "function" ? sviUser() : "", t: new Date().toISOString(), why: B.just };
      if (cur) { cur.deb = B.deb; cur.just = B.just; cur.mod = B.deb.t; save(L, cur, "DÉBLOQUÉ — " + B.just); }
      draw(); return;
    }
    const valid = e.target.closest("[data-valid]");
    if (!e.target.closest("[data-save]") && !valid) return;
    pull();
    /* contrôles bloquants */
    if (B.centre !== "SIÈGE" && (!B.bdg || !B.chg)) { svToast("CHOISIR LE BUDGET ET LA CHARGE (OU LE CENTRE DE COÛT SIÈGE).", 3500); return; }
    if (!achU(B.des)) { svToast("CHARGE OBLIGATOIRE.", 3000); return; }
    if (!(achN(B.q) > 0)) { svToast("QUANTITÉ OBLIGATOIRE (> 0).", 3000); return; }
    if (!B.datePrevue) { svToast("DATE PRÉVUE OBLIGATOIRE.", 3000); return; }
    const ctl = achBsnCtl(B, L);
    if (valid && ctl && !ctl.none && ctl.over && !B.deb) { svToast("DÉPASSEMENT DU PRÉVU : JUSTIFIER PUIS DÉBLOQUER AVANT DE VALIDER.", 4000); draw(); return; }
    if (valid && ctl && ctl.none) { svToast("CHARGE ABSENTE DU BUDGET : VALIDATION IMPOSSIBLE.", 4000); return; }
    const now = new Date().toISOString();
    let b = cur;
    if (!b) { b = { ...B, id: "N" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ref: achBsnNextRef(L), cree: now }; L.push(b); }
    else Object.assign(b, B);
    b.bdgLab = b.centre === "SIÈGE" ? "" : (BL.find(x => x.ref === b.bdg) || {}).lab || b.bdgLab || b.bdg; b.mod = now;
    if (valid) { b.state = "valide"; b.valide = now; b.valPar = typeof sviUser === "function" ? sviUser() : ""; }
    save(L, b, cur ? (valid ? "VALIDÉ" : "MODIFICATION") : "CRÉATION");
    if (!cur && ctl && ctl.over) svToast(b.ref + " ENREGISTRÉ : DÉPASSEMENT DU PRÉVU, BLOQUÉ JUSQU'AU DÉBLOCAGE.", 4500);
    d.remove(); if (done) done();
  });
}
/* ⟪ src/44-achats-consultations.js ⟫ */
/* =========================================================
   v761 : CONSULTATIONS et DEVIS (étape 3) — onglets CONSULTATIONS et DEVIS de l'écran des achats (menu ☰ › ACHAT)
   Tableaux au format des articles ; la RÉFÉRENCE soulignée ouvre la fiche ; règles : 40-achats-donnees.js (achCafWhy, achDvfWhy…).
   ========================================================= */
const achDFr = v => /^\d{4}-\d{2}-\d{2}/.test(String(v || "")) ? String(v).slice(8, 10) + "/" + String(v).slice(5, 7) + "/" + String(v).slice(0, 4) : "";
const achF2 = v => (Number(v) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ | /g, " ");
/* v921 (remarque 4 du 04/11/2026) : une pièce désigne son fournisseur par son identifiant ; une pièce venue d'ailleurs (import) peut porter
   sa référence, son code ou son nom — reconnue aussi, pour que la pièce s'affiche dans la liste ET sur la page du fournisseur */
const achFrsIs = (v, f) => !!v && !!f && (v === f.id || v === f.code || (!!f.nov && v === f.nov) || achU(v) === achU(f.nom) || (typeof achFrsRef === "function" && v === achFrsRef(f)));
const achFrsOf = v => { if (!v) return null; const L = achFrs(); return L.find(x => x.id === v) || L.find(x => !x.del && achFrsIs(v, x)) || null; };
const achFrsNom = id => { const f = achFrsOf(id); return f ? f.nom : "?"; };   /* v779 : le nom seul (la référence FRS-000n ne parle pas) */
/* tableau générique d'une liste d'achats (consultations, devis) : même format que les articles */
/* v765 : toutes les listes des achats au format du budget (47 : achNvList) — EN INSTANCE / VALIDÉS, dates, CRÉER… en bas,
   corbeille des lignes en instance (= ANNULER, la pièce est gardée) ; toucher une ligne ouvre sa fiche */
function achListMod(ctx, o) {
  const dead = x => x.state === "annule";
  /* v817 : annulation d'une pièce toujours avec motif (C5.27, C6.72, C8.71), la pièce est gardée */
  const kill = o.save ? async x => { const m = await achAsk("ANNULER " + x.ref + " (GARDÉ, VISIBLE DANS ANNULÉS)", "MOTIF DE L'ANNULATION"); if (!m) return false;
      const L = o.list(), y = L.find(z => z.id === x.id); if (!y) return false; y.state = "annule"; y.motifAnn = m; y.mod = achNow(); o.save(L); achHist(y.ref, "ANNULÉ — " + m, ""); return true; } : null;
  /* v779 : chaque pièce a sa PAGE au format de l'écran d'un budget (référence, i = la fiche, H, barre, blocs liés, SUIVI) */
  const ONE = { bsn: "BESOIN", caf: "CONSULTATION", dvf: "DEVIS", cmf: "COMMANDE", rcp: "RÉCEPTION", rtrcmd: "RETOUR DE COMMANDE", rtrrcp: "RETOUR DE RÉCEPTION", faf: "FACTURE", avf: "AVOIR", paf: "PAIEMENT" };
  return achNvMod(ctx, {
    list: { k: o.k, t: o.t, id: o.id, name: o.name, one: ONE[o.k] || o.name, all: o.list, why: (x, L) => o.why(x, L || o.list()), bang: "ref", w: o.w,
      etats: [["actif", "ACTIF"], ["alerte", "ALERTE"], ["annule", "ANNULÉS"], ["tout", "TOUT"]],
      ok: (x, k, L) => k === "tout" ? true : k === "annule" ? dead(x) : !dead(x) && (k !== "alerte" || o.why(x, L || o.list()).length > 0),
      inst: o.inst || (() => false), dI: x => x.cree || x.date || "", dV: x => x.valide || x.val || x.bap || x.solde || x.cree || x.date || "",
      cols: () => o.cols(), newRow: o.newRow, kill,
      /* v800 (document unique 3.6) : CRÉER … ICI ouvre la fenêtre de la pièce ; une fois enregistrée, sa page s'ouvre */
      add: done => { const before = new Set(o.list().map(x => x.id)); let fin = false;
        const end = () => { if (fin) return; fin = true; clearInterval(tm); const n = o.list().find(x => !before.has(x.id)); done(n ? n.id : "x"); };
        /* dès que la nouvelle pièce est enregistrée, sa fenêtre se ferme et sa page s'ouvre */
        const tm = setInterval(() => { const n = o.list().find(x => !before.has(x.id)); if (n) { document.getElementById("svConf")?.remove(); end(); } else if (!document.getElementById("svConf")) end(); }, 250);
        o.open(null, end); } },
    pageOf: id => { const x = o.list().find(y => y.id === id); if (!x) return null; const D = achDocPage(o.k, x);
      return { id, code: x.ref, ref: x.ref, title: D.title || x.ref, party: x.frs ? achFrsNom(x.frs) : "", partyGo: x.frs ? "frs|" + x.frs : "", date: achDFr(x.date || x.dFac || x.cree), tot: D.tot || [], ttc: D.ttc || 0, numFrs: x.refFrs || x.num || x.nbl || "", st: (o.inst || (() => false))(x) ? "instance" : "valide", del: dead(x), why: o.why(x, o.list()),
        info: done => (o.info || o.open)(id, () => done()),
        menu: [{ k: "fiche", lab: "OUVRIR LA FICHE" }].concat(D.menu || []).concat(kill && !dead(x) ? [{ k: "del", lab: "ANNULER" }] : []),
        act: async (k, redraw) => { if (k === "fiche") { o.open(id, redraw); return; } if (D.act && await D.act(k, redraw)) return; if (k === "del") { const y = o.list().find(z => z.id === id); if (y && await kill(y)) redraw(); } },
        links: D.links.map(L => L.add && !dead(x) && (L.addAny || (o.inst || (() => false))(x)) ? { ...L, addFn: redraw => o.open(id, redraw) } : { ...L, add: "" }) }; }
  });
}
/* v779 : contenu de la page d'une pièce — LIGNES puis les pièces liées (un toucher ouvre leur page) */
function achGo(t, id) { const v = document.getElementById("ach"); if (!v || !v.__achTab) return; v.__achTab(t); if (v.__achOpen) v.__achOpen(t, id); }
function achDocPage(k, x) {
  const fr = id => id ? achFrsNom(id) : "", ref = (L, id) => ((L.find(y => y.id === id) || {}).ref) || "";
  /* v800 (document unique 3.6 – 3.7) : toucher un article ou un fournisseur dans un tableau ouvre sa page */
  const AK = new Map(achArts().filter(a => !a.del).map(a => [achKey(a.des, a.u), a.id]));
  const tv = l => l.tva === "" || l.tva === undefined ? achPrm().tva : achN(l.tva), tv0 = tv;
  const lig = (t, withPu, withSt) => ({ t, add: "CRÉER UNE LIGNE ICI…", cols: [["DÉSIGNATION"], ["U", "center"], ["QUANTITÉ", "number"]].concat(withPu ? [["PU HT", "number"], ["TVA %", "number"], ["MONTANT HT", "number"]] : []).concat(withSt ? [["RÉSULTAT", "center"]] : []),
    rows: (x.lignes || []).map(l => ({ go: AK.get(achKey(l.des, l.u)) ? [[0, "art", AK.get(achKey(l.des, l.u))]] : [], cells: [l.des || "", l.u || "", achN(l.q)].concat(withPu ? [achN(l.pu), tv(l), achN(l.q) * achN(l.pu)] : []).concat(withSt ? [{ ok: "ACCEPTÉE", res: "RÉSERVES", ref: "REFUSÉE" }[l.st] || ""] : []) })) });
  const docs = (t, L, cols, cells, kk) => ({ t, cols, rows: L.map(y => ({ cells: cells(y), open: () => achGo(kk, y.id), go: y.frs && cols[1] && cols[1][0] === "FOURNISSEUR" ? [[1, "frs", y.frs]] : [], cls: ["annule", "rejete"].includes(y.state) ? "nv-strike" : "" })) });
  const DV = (t, L) => docs(t, L, [["RÉFÉRENCE"], ["FOURNISSEUR"], ["MONTANT TTC", "number"], ["ÉTAT", "center"]], v => [v.ref, fr(v.frs), achDvfTot(v).ttc, { recu: "REÇU", retenu: "RETENU", rejete: "REJETÉ", annule: "ANNULÉ" }[v.state] || ""], "dvf");
  const CM = (t, L) => docs(t, L, [["RÉFÉRENCE"], ["FOURNISSEUR"], ["MONTANT TTC", "number"], ["ÉTAT", "center"]], c => [c.ref, fr(c.frs), achCmfTot(c).ttc, ACH_CMF_ST[c.state] || ""], "cmf");
  const RC = (t, L) => docs(t, L, [["RÉFÉRENCE"], ["N° BL"], ["REÇU LE"], ["LIGNES", "center"]], r => [r.ref, r.pv ? "PV DE SERVICE FAIT" : r.nbl || "", svDT(r.date || ""), String((r.lignes || []).length)], "rcp");
  const FA = (t, L) => docs(t, L, [["RÉFÉRENCE"], ["N° FACTURE"], ["MONTANT TTC", "number"], ["RESTE À PAYER", "number"], ["ÉTAT", "center"]], f => [f.ref, f.num || "", achFafTot(f).ttc, f.state === "annule" ? "" : achFafReste(f), achFafEtat(f)], "faf");
  const PA = (t, L) => docs(t, L, [["RÉFÉRENCE"], ["MODE"], ["DATE"], ["MONTANT", "number"], ["ÉTAT", "center"]], p => [p.ref, p.mode || "", achDFr(p.date), achN(p.mt), ACH_PAF_ST[p.state] || ""], "paf");
  const AV = (t, L) => docs(t, L, [["RÉFÉRENCE"], ["N° AVOIR"], ["MONTANT TTC", "number"], ["RESTE À DÉDUIRE", "number"]], a => [a.ref, a.num || "", -achN(a.ttc), a.state === "annule" ? "" : achAvfReste(a)], "avf");
  /* B37 : retours liés dans les deux sens — la pièce d'origine affiche en bas ses retours (montant négatif) */
  const RT = (t, L, kk) => docs(t, L, [["RÉFÉRENCE"], ["MOTIF"], ["DATE"], ["MONTANT HT", "number"]], r => [r.ref, r.motif || "", svDT(r.date || ""), achRtrMt(r)], kk);
  const CA = (t, L) => docs(t, L, [["RÉFÉRENCE"], ["OBJET"], ["ÉTAT", "center"]], c => [c.ref, c.objet || "", { ouverte: "OUVERTE", close: "CLOSE", annule: "ANNULÉE" }[c.state] || ""], "caf");
  const has = (L, id) => (L || []).includes(id);
  if (k === "caf") { const R = x.rep || {};
    /* v780 (remarque 9) : TABLEAU COMPARATIF (une ligne par fournisseur ayant répondu, ★ = le moins cher), RETENU et MOTIF DU CHOIX ; CRÉER LA COMMANDE dans le ⋯ principal */
    const DD = achDvf().filter(v => v.caf === x.id && v.state !== "annule"), dvOf = f => DD.find(v => v.frs === f), HT = (x.frs || []).map(f => dvOf(f) ? achDvfTot(dvOf(f)).ht : null).filter(v => v !== null && v > 0), MIN = HT.length ? Math.min(...HT) : null;
    const CMP = { t: "TABLEAU COMPARATIF", cols: [["FOURNISSEUR"], ["DEVIS"], ["MONTANT HT", "number"], ["MONTANT TTC", "number"], ["RETENU", "center"], ["MOTIF DU CHOIX"]],
      rows: (x.frs || []).filter(dvOf).map(f => { const v = dvOf(f), t = achDvfTot(v), bang = x.retenu === f && HT.length < achPrm().nfrs; return { cells: [fr(f) + (MIN !== null && Math.abs(t.ht - MIN) < 0.005 ? " ★" : ""), v.ref, bang ? "! " + achF2(t.ht) : t.ht, t.ttc, x.retenu === f ? "RETENU" : "", x.retenu === f ? x.motif || "" : ""], cls: x.retenu === f ? "nvp-ret" : "" }; }) };
    const canCmd = x.state === "close" && !achCmf().some(c => c.caf === x.id && c.state !== "annule");
    return { title: x.objet || "", menu: canCmd ? [{ k: "mkcmf", lab: "CRÉER LA COMMANDE" }] : [],
      act: async k => { if (k !== "mkcmf") return false; const v = achDvf().find(y => y.caf === x.id && y.state === "retenu"); if (!v) { svToast("AUCUN DEVIS RETENU.", 3000); return true; }
        const m = achCmfFrom({ frs: v.frs, caf: x.id, dvf: v.id, lignes: v.lignes, why: "DEPUIS " + x.ref + " — " + v.ref }); achGo("cmf", m.id); return true; },
      links: [lig("LIGNES"), { t: "FOURNISSEURS CONSULTÉS", add: "AJOUTER UN FOURNISSEUR ICI…", cols: [["FOURNISSEUR"], ["RÉPONSE", "center"], ["DEVIS"]], rows: (x.frs || []).map(f => ({ go: [[0, "frs", f]], cells: [fr(f), (R[f] || {}).st === "repondu" ? "RÉPONDU" : (R[f] || {}).st === "decline" ? "DÉCLINÉ" : "EN ATTENTE", ref(achDvf(), (R[f] || {}).dvf)] })) },
      CMP, DV("DEVIS", achDvf().filter(v => v.caf === x.id)), CM("COMMANDES", achCmf().filter(c => c.caf === x.id))] }; }
  const TOT = t => [["MONTANT HT", t.ht], ["MONTANT TVA", t.ttc - t.ht], ["MONTANT TTC", t.ttc]];
  if (k === "dvf") return { title: fr(x.frs), tot: TOT(achDvfTot(x)), ttc: achDvfTot(x).ttc, links: [lig("LIGNES", true), CA("CONSULTATION", achCaf().filter(c => c.id === x.caf)), CM("COMMANDES", achCmf().filter(c => c.dvf === x.id || (c.lignes || []).some(l => l.dvf === x.id)))] };
  if (k === "cmf") return { title: fr(x.frs), tot: TOT(achCmfTot(x)), ttc: achCmfTot(x).ttc, links: [lig("LIGNES", true), DV("DEVIS", achDvf().filter(v => v.id === x.dvf || (x.lignes || []).some(l => l.dvf === v.id))), { ...RC("RÉCEPTIONS", achRcp().filter(r => r.cmf === x.id)), add: "CRÉER UNE RÉCEPTION ICI…", addAny: x.state === "valide" },
    { ...FA("FACTURES", achFaf().filter(f => f.cmf === x.id || has(f.cmfs, x.id))), add: "CRÉER UNE FACTURE ICI…", addAny: x.state === "valide" }, { ...PA("PAIEMENTS", achPaf().filter(p => p.cmf === x.id)), add: "CRÉER UN PAIEMENT (AVANCE) ICI…", addAny: x.state === "valide" }, RT("RETOURS DE COMMANDE", achRtr().filter(r => r.kind === "cmd" && r.cmf === x.id), "rtrcmd")] };
  if (k === "rcp") return { title: fr(x.frs), links: [lig("LIGNES", false, true), CM("COMMANDE", achCmf().filter(c => c.id === x.cmf)), FA("FACTURES", achFaf().filter(f => has(f.rcps, x.id))), RT("RETOURS DE RÉCEPTION", achRtr().filter(r => r.kind === "rcp" && r.rcp === x.id), "rtrrcp")] };
  if (k === "rtrcmd" || k === "rtrrcp") return { title: fr(x.frs), tot: [["MONTANT HT", achRtrMt(x)]], ttc: achRtrMt(x), links: [lig("LIGNES"), CM("COMMANDE", achCmf().filter(c => c.id === x.cmf)), RC("RÉCEPTION", achRcp().filter(r => r.id === x.rcp))] };
  /* v817 : page de la facture (C8.90 – C8.93) — DÉTAIL FACTURE STANDARD (depuis les réceptions), DÉTAIL FACTURE FOURNISSEUR (saisi), puis besoins, devis, commandes, réceptions, paiements, avoirs */
  if (k === "faf") { const cids = [x.cmf].concat(x.cmfs || []).filter(Boolean), CL = achCmf().filter(c => cids.includes(c.id)), RL = achRcp().filter(r => r.state !== "annule" && (has(x.rcps, r.id) || (!(x.rcps || []).length && cids.includes(r.cmf))));
    const BS = achBsn(), lineOf = (r, l) => { const c = CL.find(y => y.id === r.cmf); return c ? (c.lignes || []).find(y => y.id === l.cl) : null; };
    const STD = { t: "DÉTAIL FACTURE STANDARD", cols: [["RÉCEPTION"], ["CHANTIER"], ["DÉSIGNATION"], ["U", "center"], ["QUANTITÉ", "number"], ["PRIX HT", "number"], ["MONTANT HT", "number"], ["TVA %", "number"], ["MONTANT TVA", "number"], ["MONTANT TTC", "number"]],
      rows: RL.flatMap(r => (r.lignes || []).filter(l => l.st !== "ref").map(l => { const cl = lineOf(r, l) || {}, b = cl.bsn ? BS.find(y => y.id === cl.bsn) : null, pu = achN(cl.pu), tv = tv0(cl), ht = achN(l.q) * pu;
        return { cells: [r.ref, b ? (b.centre === "SIÈGE" ? "SIÈGE" : b.bdgLab || b.bdg || "") : "", l.des || "", l.u || "", achN(l.q), pu, ht, tv, ht * tv / 100, ht * (1 + tv / 100)], open: () => achGo("rcp", r.id), go: AK.get(achKey(l.des, l.u)) ? [[2, "art", AK.get(achKey(l.des, l.u))]] : [] }; })) };
    const BIDS = new Set(CL.flatMap(c => (c.lignes || []).map(l => l.bsn)).filter(Boolean)), DIDS = new Set(CL.flatMap(c => [c.dvf].concat((c.lignes || []).map(l => l.dvf))).filter(Boolean));
    const BSB = { t: "BESOINS", cols: [["RÉFÉRENCE"], ["CHARGE"], ["QUANTITÉ", "number"], ["AVANCEMENT", "center"]], rows: BS.filter(b => BIDS.has(b.id)).map(b => ({ cells: [b.ref, b.des || "", achN(b.q), achBsnAvLab(b)], open: () => achGo("bsn", b.id) })) };
    return { title: fr(x.frs), tot: TOT(achFafTot(x)), ttc: achFafTot(x).ttc, links: [STD, lig("DÉTAIL FACTURE FOURNISSEUR", true), BSB, DV("DEVIS", achDvf().filter(v => DIDS.has(v.id))), CM("COMMANDES", CL), RC("RÉCEPTIONS", RL),
      PA("PAIEMENTS", achPaf().filter(p => (p.aff || []).some(a => a.fa === x.id))), AV("AVOIRS", achAvf().filter(a => a.fa === x.id))] }; }
  if (k === "avf") return { title: fr(x.frs), links: [FA("FACTURE", achFaf().filter(f => f.id === x.fa))] };
  if (k === "paf") return { title: fr(x.frs), links: [FA("FACTURES RÉGLÉES", achFaf().filter(f => (x.aff || []).some(a => a.fa === f.id))), CM("COMMANDE (AVANCE)", achCmf().filter(c => c.id === x.cmf))] };
  if (k === "bsn") return { title: (x.des || "") + (x.u ? " (" + x.u + ")" : ""), links: [CA("CONSULTATIONS", achCaf().filter(c => (c.lignes || []).some(l => l.bsn === x.id))), CM("COMMANDES", achCmf().filter(c => (c.lignes || []).some(l => l.bsn === x.id)))] };
  return { title: fr(x.frs), links: [] };
}
function achCafMod(ctx) {
  const st = { ouverte: "OUVERTE", close: "CLOSE", annule: "ANNULÉE" };
  return achListMod(ctx, { k: "caf", t: "ach_caf", id: "achCafT", list: achCaf, name: "CONSULTATIONS", save: achCafSave, inst: c => c.state === "ouverte", etatKey: "svi_ach_caf_etat_v1", newLab: "NOUVELLE CONSULTATION", newRow: "CRÉER UNE CONSULTATION ICI…", open: achCafFiche,
    etats: [["actif", "OUVERTES"], ["close", "CLOSES"], ["alerte", "ALERTE"], ["annule", "ANNULÉES"], ["tout", "TOUT"]],
    ok: (c, k, L) => k === "tout" ? true : k === "alerte" ? achCafWhy(c).length > 0 : k === "actif" ? c.state === "ouverte" : c.state === k,
    why: c => achCafWhy(c),
    w: { ref: 150, objet: 260, lig: 80, frs: 100, rep: 100, dlim: 110, etat: 100, ret: 220, saisi: 110 },
    cols: () => [["ref", "RÉFÉRENCE", c => c.ref, ""], ["objet", "OBJET", c => c.objet || "", ""], ["lig", "LIGNES", c => String((c.lignes || []).length), "center"],
      ["frs", "FOURNISSEURS", c => String((c.frs || []).length), "center"], ["rep", "RÉPONSES", c => (c.frs || []).filter(f => ((c.rep || {})[f] || {}).st === "repondu").length + " / " + (c.frs || []).length, "center"],
      ["dlim", "DATE LIMITE", c => achDFr(c.dlim), ""], ["etat", "ÉTAT", c => st[c.state] || "", "center"], ["ret", "RETENU", c => c.retenu ? achFrsNom(c.retenu) : "", ""], ["saisi", "SAISI LE", c => achDFr(c.cree), ""]] });
}
function achDvfMod(ctx) {
  const st = { recu: "REÇU", retenu: "RETENU", rejete: "REJETÉ", annule: "ANNULÉ" };
  return achListMod(ctx, { k: "dvf", t: "ach_dvf", id: "achDvfT", list: achDvf, name: "DEVIS", save: achDvfSave, inst: v => v.state === "recu" || !v.state, etatKey: "svi_ach_dvf_etat_v1", newLab: "NOUVEAU DEVIS", newRow: "CRÉER UN DEVIS ICI… (HORS CONSULTATION)", open: achDvfFiche,
    etats: [["actif", "REÇUS"], ["retenu", "RETENUS"], ["rejete", "REJETÉS"], ["alerte", "ALERTE"], ["annule", "ANNULÉS"], ["tout", "TOUT"]],
    ok: (v, k) => k === "tout" ? true : k === "alerte" ? achDvfWhy(v).length > 0 : k === "actif" ? v.state === "recu" : v.state === k,
    why: v => achDvfWhy(v),
    w: { ref: 150, caf: 150, frs: 240, nfrs: 130, date: 110, val: 110, ht: 130, ttc: 130, etat: 100 },
    cols: () => [["ref", "RÉFÉRENCE", v => v.ref, ""], ["caf", "CONSULTATION", v => ((achCaf().find(c => c.id === v.caf) || {}).ref) || "", ""], ["frs", "FOURNISSEUR", v => achFrsNom(v.frs), ""],
      ["nfrs", "N° FOURNISSEUR", v => v.refFrs || "", ""], ["date", "DATE", v => achDFr(v.date), ""], ["val", "VALIDITÉ", v => achDFr(v.validite), ""],
      ["ht", "MONTANT HT", v => achDvfTot(v).ht, "number"], ["ttc", "MONTANT TTC", v => achDvfTot(v).ttc, "number"], ["etat", "ÉTAT", v => st[v.state] || "", "center"]] });
}

/* ---------- FICHE CONSULTATION ---------- */
function achCafFiche(id, done) {
  const L0 = achCaf(), c0 = id ? L0.find(x => x.id === id) : null; if (id && !c0) return;
  const C = c0 ? JSON.parse(JSON.stringify(c0)) : { id: "", ref: "", objet: "", dlim: "", lignes: [], frs: [], rep: {}, state: "ouverte", motif: "" };
  C.rep = C.rep || {};
  const ro = !!c0 && c0.state !== "ouverte", d = sviWinNew();
  const now = () => new Date().toISOString();
  const draw = () => {
    const D = achDvf().filter(v => v.caf === C.id && v.state !== "annule"), why = C.id ? achCafWhy(C, achDvf()) : [];
    const dis = ro ? " disabled" : "";
    /* comparatif : une colonne par fournisseur qui a un devis */
    const dv = f => D.find(v => v.frs === f);
    const tot = C.frs.map(f => { const v = dv(f); return v ? achDvfTot(v).ht : null; }), mins = tot.filter(x => x !== null && x > 0), min = mins.length ? Math.min(...mins) : null;
    d.innerHTML = sviWinCard({ cls: "frs-card caf-card", close: "data-x", title: C.id ? "CONSULTATION — " + esc(C.ref) + " · " + ({ ouverte: "OUVERTE", close: "CLOSE", annule: "ANNULÉE" }[C.state]) : "NOUVELLE CONSULTATION",
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}</div>` : ""}<div class="frs-scroll">
        <div class="frs-sec"><div class="frs-g"><label class="frs-f frs-w"><span>OBJET</span><input class="ins-in caf-x" data-k="objet" value="${esc(C.objet)}"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>DATE LIMITE DE RÉPONSE</span><input type="date" class="ins-in caf-x" data-k="dlim" value="${esc(C.dlim)}"${dis}></label></div></div>
        <div class="frs-sec"><div class="frs-st">CONDITIONS DEMANDÉES (ENVOYÉES AUX FOURNISSEURS)</div><div class="frs-g">
          <label class="frs-f frs-w"><span>LIEU DE LIVRAISON</span><input class="ins-in caf-x" data-k="lieu" value="${esc(C.lieu || "")}"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>LIVRAISON SOUHAITÉE LE</span><input type="date" class="ins-in caf-x" data-k="dSouh" value="${esc(C.dSouh || "")}"${dis}></label>
          <label class="frs-f"><span>PAIEMENT DEMANDÉ</span><input class="ins-in caf-x" data-k="condPay" value="${esc(C.condPay || "")}" list="cafCond"${dis} autocomplete="off"><datalist id="cafCond">${ACH_CONDS.map(x => `<option value="${esc(x)}">`).join("")}</datalist></label>
          <label class="frs-f"><span>VALIDITÉ DE L'OFFRE (JOURS)</span><input class="ins-in caf-x" data-k="valJ" value="${esc(C.valJ || "")}" inputmode="numeric"${dis} autocomplete="off"></label>
          <label class="frs-f frs-w"><span>DOCUMENTS À JOINDRE À L'OFFRE (FICHE TECHNIQUE, CERTIFICAT, ÉCHANTILLON)</span><input class="ins-in caf-x" data-k="docs" value="${esc(C.docs || "")}"${dis} autocomplete="off"></label>
          <div class="frs-cs"><label class="frs-c"><input type="checkbox" class="caf-c" data-k="franco"${C.franco ? " checked" : ""}${dis}> FRANCO CHANTIER</label><label class="frs-c"><input type="checkbox" class="caf-c" data-k="variante"${C.variante ? " checked" : ""}${dis}> VARIANTE OU ARTICLE ÉQUIVALENT AUTORISÉ</label></div></div></div>
        <div class="frs-sec"><div class="frs-st">LIGNES ${svCnt(C.lignes.length)}</div>
          <table class="prm-table frs-sub"><thead><tr><th>BESOIN</th><th>DÉSIGNATION</th><th>U</th><th>QUANTITÉ</th><th class="number">BUDGET HT (NON ENVOYÉ)</th><th></th></tr></thead><tbody>
          ${C.lignes.map((l, i) => `<tr data-i="${i}"><td>${esc(((achBsn().find(b => b.id === l.bsn) || {}).ref) || "—")}</td><td><input class="ins-in caf-l" data-c="des" value="${esc(l.des)}"${dis || (l.bsn ? " readonly" : "")}></td><td><input class="ins-in caf-l" data-c="u" value="${esc(l.u)}"${dis || (l.bsn ? " readonly" : "")}></td><td><input class="ins-in caf-l" data-c="q" inputmode="decimal" value="${esc(String(l.q ?? "").replace(".", ","))}"${dis}></td><td class="number">${(() => { const b = achBsn().find(x => x.id === l.bsn); return b ? esc(achF2(achN(b.q) * achN(b.pu))) : "—"; })()}</td><td class="center">${ro ? "" : `<button type="button" class="ach-x" data-rml="${i}">✕</button>`}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">AUCUNE LIGNE</td></tr>`}
          </tbody></table>${ro ? "" : `<button type="button" class="ach-b" data-addbsn>+ BESOINS VALIDÉS NON COUVERTS ${svCnt(achBsnOpen().length)}</button> <button type="button" class="ach-b" data-addl>+ LIGNE LIBRE</button>`}</div>
        <div class="frs-sec"><div class="frs-st">FOURNISSEURS CONSULTÉS ${svCnt(C.frs.length)}</div>
          <table class="prm-table frs-sub"><thead><tr><th>FOURNISSEUR</th><th>E-MAIL</th><th>RÉPONSE</th><th>DEVIS</th><th></th></tr></thead><tbody>
          ${C.frs.map(f => { const r = C.rep[f] || {}, v = dv(f), F = achFrs().find(x => x.id === f) || {}; return `<tr data-f="${esc(f)}"><td>${esc(achFrsNom(f))}</td><td>${esc(((F.cte || []).find(x => x.email) || {}).email || "—")}</td>
            <td><select class="ins-in caf-rep" data-f="${esc(f)}"${dis || (v ? " disabled" : "")}>${[["attente", "EN ATTENTE"], ["repondu", "RÉPONDU"], ["decline", "DÉCLINÉ"]].map(([k, l]) => `<option value="${k}"${(r.st || "attente") === k ? " selected" : ""}>${l}</option>`).join("")}</select></td>
            <td>${v ? `<button type="button" class="ach-link" data-opendvf="${esc(v.id)}">${esc(v.ref)}</button> ${esc(achF2(achDvfTot(v).ht))} HT` : r.st === "decline" ? esc(r.motif ? "DÉCLINÉ : " + r.motif : "—") : ro ? "—" : `<button type="button" class="ach-b" data-mkdvf="${esc(f)}">SAISIR LE DEVIS</button>`}</td>
            <td class="center">${ro || v ? "" : `<button type="button" class="ach-x" data-rmf="${esc(f)}">✕</button>`}</td></tr>`; }).join("") || `<tr><td colspan="5" class="empty">AUCUN FOURNISSEUR</td></tr>`}
          </tbody></table>${ro ? "" : `<button type="button" class="ach-b" data-addfrs>+ FOURNISSEURS</button> <button type="button" class="ach-b" data-mail>ENVOYER (E-MAIL GROUPÉ)</button>`}</div>
        ${D.length ? `<div class="frs-sec"><div class="frs-st">TABLEAU COMPARATIF</div>
          <table class="prm-table frs-sub caf-cmp"><thead><tr><th>LIGNE</th>${C.frs.filter(dv).map(f => `<th class="number">${esc(achFrsNom(f))}</th>`).join("")}</tr></thead><tbody>
          ${C.lignes.map(l => `<tr><td>${esc(l.des)} (${esc(achF2(l.q))} ${esc(l.u)})</td>${C.frs.filter(dv).map(f => { const x = (dv(f).lignes || []).find(y => achU(y.des) === achU(l.des) && achU(y.u) === achU(l.u)); return `<td class="number">${x && achN(x.pu) ? esc(achF2(achDvfPuNet(dv(f), x))) + (achDvfLow(C, D, l, dv(f), x) ? " ⚠ BAS" : "") : "—"}</td>`; }).join("")}</tr>`).join("")}
          <tr><td>TRANSPORT HT</td>${C.frs.filter(dv).map(f => `<td class="number">${achN(dv(f).transp) ? esc(achF2(dv(f).transp)) : "FRANCO"}</td>`).join("")}</tr>
          <tr class="caf-tot"><td><b>TOTAL RENDU CHANTIER HT</b></td>${C.frs.filter(dv).map(f => { const t = achDvfTot(dv(f)).ht; const nd = C.frs.filter(dv).filter(g => achDvfTot(dv(g)).ht > 0).length; return `<td class="number">${C.retenu === f && nd < achPrm().nfrs ? `<b class="caf-bang" data-tip="MOINS DE ${achPrm().nfrs} DEVIS (${nd}) : MINIMUM NON BLOQUANT">!</b> ` : ""}<b>${esc(achF2(t))}</b>${t === min ? " ★" : ""}</td>`; }).join("")}</tr>
          <tr><td><b>RETENU</b></td>${C.frs.filter(dv).map(f => `<td class="center"><input type="radio" name="cafRet" class="caf-ret" value="${esc(f)}"${C.retenu === f ? " checked" : ""}${dis}></td>`).join("")}</tr></tbody></table>
          <label class="frs-f frs-w"><span>MOTIF DU CHOIX (OBLIGATOIRE SI LE RETENU N'EST PAS LE MOINS CHER ★)</span><input class="ins-in caf-x" data-k="motif" value="${esc(C.motif || "")}"${dis} autocomplete="off"></label></div>` : ""}
        ${C.state === "close" ? `<div class="bsn-note">CLOSE LE ${esc(achDFr(C.close))} : RETENU ${esc(achFrsNom(C.retenu))}.${(() => { const m = achCmf().find(x => x.caf === C.id && x.state !== "annule"); return m ? " COMMANDE : " + esc(m.ref) + "." : ""; })()}</div>` : ""}
      </div>`,
      foot: `<button type="button" class="svc-b" data-x>${ro || C.id ? "FERMER" : "ANNULER"}</button>${C.id && C.state === "ouverte" ? `<button type="button" class="svc-b" data-cancel>ANNULER LA CONSULTATION</button>` : ""}
        ${C.state === "close" && !achCmf().some(x => x.caf === C.id && x.state !== "annule") ? `<button type="button" class="svc-b svc-ok svc-neutral" data-mkcmf>CRÉER LA COMMANDE</button>` : ""}
        ${!ro ? `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button>` : ""}${C.id && C.state === "ouverte" && D.length ? `<button type="button" class="svc-b svc-ok" data-close>CLÔTURER AVEC LE RETENU</button>` : ""}` });
    if (!d.isConnected) sviWinShow(d);
  };
  const pull = () => { d.querySelectorAll(".caf-x").forEach(i => { C[i.dataset.k] = i.dataset.k === "dlim" || i.dataset.k === "dSouh" ? i.value : i.dataset.k === "valJ" ? achN(i.value) || "" : achU(i.value); });
    d.querySelectorAll(".caf-c").forEach(i => { if (!i.disabled) C[i.dataset.k] = i.checked; });
    d.querySelectorAll("tr[data-i]").forEach(tr => { const l = C.lignes[+tr.dataset.i]; if (!l) return; tr.querySelectorAll(".caf-l").forEach(i => { l[i.dataset.c] = i.dataset.c === "q" ? achN(i.value) : achU(i.value); }); });
    d.querySelectorAll(".caf-rep").forEach(s => { if (!s.disabled) C.rep[s.dataset.f] = { ...(C.rep[s.dataset.f] || {}), st: s.value, date: (C.rep[s.dataset.f] || {}).date || (s.value !== "attente" ? now() : "") }; });
    const r = d.querySelector(".caf-ret:checked"); if (r) C.retenu = r.value; };
  /* enregistre la consultation (création si besoin) ; rend l'objet enregistré */
  const store = act => {
    const L = achCaf(); let c = C.id ? L.find(x => x.id === C.id) : null;
    if (!c) { c = { ...JSON.parse(JSON.stringify(C)), id: "C" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ref: achNextRef("CAF", L), cree: now() }; L.push(c); Object.assign(C, { id: c.id, ref: c.ref, cree: c.cree }); }
    else Object.assign(c, JSON.parse(JSON.stringify(C)));
    c.mod = now(); achCafSave(L); achHist(c.ref, act, (c.objet || "") + " — " + c.lignes.length + " LIGNE(S), " + c.frs.length + " FOURNISSEUR(S)"); return c;
  };
  draw();
  /* v814 : motif d'un fournisseur qui décline (C5.22) */
  d.addEventListener("change", async e => { const s = e.target.closest(".caf-rep"); if (!s || s.value !== "decline") return; const f = s.dataset.f;
    const m = await achAsk("RÉPONSE DE " + achFrsNom(f) + " : DÉCLINÉ", "MOTIF DONNÉ PAR LE FOURNISSEUR"); pull(); if (!m) { C.rep[f] = { ...(C.rep[f] || {}), st: "attente" }; draw(); return; }
    C.rep[f] = { ...(C.rep[f] || {}), st: "decline", motif: m, date: new Date().toISOString() }; draw(); });
  d.addEventListener("click", async e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (done) done(); return; }
    const od = e.target.closest("[data-opendvf]"); if (od) { achDvfFiche(od.dataset.opendvf, () => draw()); return; }
    /* v762 : lancement de la commande depuis la consultation close (devis retenu : lignes et prix repris) */
    if (e.target.closest("[data-mkcmf]")) { const v = achDvf().find(x => x.caf === C.id && x.state === "retenu"); if (!v) { svToast("AUCUN DEVIS RETENU.", 3000); return; }
      const m = achCmfFrom({ frs: v.frs, caf: C.id, dvf: v.id, lignes: achDvfCmfLines(v), why: "DEPUIS " + C.ref + " — " + v.ref }); d.remove(); achCmfFiche(m.id, done); return; }
    if (ro) return;
    if (e.target.closest("[data-addl]")) { pull(); C.lignes.push({ des: "", u: "", q: "" }); draw(); return; }
    const rl = e.target.closest("[data-rml]"); if (rl) { pull(); C.lignes.splice(+rl.dataset.rml, 1); draw(); return; }
    const rf = e.target.closest("[data-rmf]"); if (rf) { pull(); C.frs = C.frs.filter(x => x !== rf.dataset.rmf); delete C.rep[rf.dataset.rmf]; draw(); return; }
    if (e.target.closest("[data-addbsn]")) {
      pull(); const have = new Set(C.lignes.map(l => l.bsn).filter(Boolean)), B = achBsnOpen().filter(b => !have.has(b.id));
      if (!B.length) { svToast("AUCUN BESOIN VALIDÉ NON COUVERT.", 3000); return; }
      const pick = await achPickWin("BESOINS VALIDÉS NON COUVERTS", B.map(b => ({ v: b.id, lab: b.ref + " — " + b.des + " (" + achF2(b.q) + " " + b.u + ")" + (b.datePrevue ? " — PRÉVU LE " + achDFr(b.datePrevue) : "") })));
      B.filter(b => pick.includes(b.id)).forEach(b => C.lignes.push({ bsn: b.id, des: b.des, u: b.u, q: achN(b.q) })); draw(); return;
    }
    if (e.target.closest("[data-addfrs]")) {
      pull(); const cats = new Set(C.lignes.map(l => (achArts().find(a => achKey(a.des, a.u) === achKey(l.des, l.u)) || {}).cat).filter(Boolean));
      const F = achLive(achFrs()).filter(f => achFrsOk(f) && !C.frs.includes(f.id)).map(f => ({ f, s: (f.fam || []).some(x => cats.has(x)) })).sort((a, b) => b.s - a.s || a.f.nom.localeCompare(b.f.nom, "fr"));
      if (!F.length) { svToast("AUCUN AUTRE FOURNISSEUR ACTIF (ACHAT › FOURNISSEURS).", 3000); return; }
      const pick = await achPickWin("FOURNISSEURS À CONSULTER", F.map(x => ({ v: x.f.id, lab: x.f.code + " — " + x.f.nom + (x.s ? "  ★ FOURNIT CES FAMILLES" : "") })));
      pick.forEach(f => { C.frs.push(f); C.rep[f] = { st: "attente" }; }); draw(); return;
    }
    if (e.target.closest("[data-mail]")) {
      pull(); const F = achFrs().filter(f => C.frs.includes(f.id)), to = F.map(f => ((f.cte || []).find(x => x.email) || {}).email).filter(Boolean);
      if (!to.length) { svToast("AUCUNE ADRESSE E-MAIL DANS LES CONTACTS DES FOURNISSEURS CONSULTÉS.", 3500); return; }
      const cnd = [C.lieu ? "LIEU DE LIVRAISON : " + C.lieu : "", C.dSouh ? "LIVRAISON SOUHAITÉE LE : " + achDFr(C.dSouh) : "", C.condPay ? "PAIEMENT DEMANDÉ : " + C.condPay : "", C.franco ? "PRIX FRANCO CHANTIER" : "",
        C.valJ ? "VALIDITÉ DE L'OFFRE : " + C.valJ + " JOURS" : "", C.docs ? "DOCUMENTS À JOINDRE : " + C.docs : "", C.variante ? "VARIANTE OU ARTICLE ÉQUIVALENT ACCEPTÉ (À PRÉCISER)" : ""].filter(Boolean);
      const txt = "MADAME, MONSIEUR,\n\nMERCI DE NOUS TRANSMETTRE VOTRE MEILLEURE OFFRE POUR :\n" + C.lignes.map(l => "- " + l.des + " : " + achF2(l.q) + " " + l.u).join("\n") + (cnd.length ? "\n\n" + cnd.join("\n") : "") + (C.dlim ? "\n\nDATE LIMITE DE RÉPONSE : " + achDFr(C.dlim) : "") + "\n\nMERCI DE RAPPELER LA RÉFÉRENCE " + (C.ref || "DE LA CONSULTATION") + " DANS VOTRE DEVIS.\n\nCORDIALEMENT.";
      location.href = "mailto:?bcc=" + encodeURIComponent(to.join(",")) + "&subject=" + encodeURIComponent("CONSULTATION " + (C.ref || "") + (C.objet ? " — " + C.objet : "")) + "&body=" + encodeURIComponent(txt);
      return;
    }
    const mk = e.target.closest("[data-mkdvf]");
    if (mk) { pull(); if (!C.lignes.length) { svToast("AJOUTER D'ABORD LES LIGNES.", 3000); return; }
      const c = store(C.id ? "MODIFICATION" : "CRÉATION"), L = achDvf(), f = mk.dataset.mkdvf;
      const v = { id: "V" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ref: achNextRef("DVF", L), caf: c.id, frs: f, refFrs: "", date: now().slice(0, 10), validite: "", state: "recu", cree: now(),
        lignes: C.lignes.map(l => ({ bsn: l.bsn || "", des: l.des, u: l.u, q: achN(l.q), pu: "", tva: achPrm().tva })) };
      L.push(v); achDvfSave(L); achHist(v.ref, "CRÉATION", "RÉPONSE DE " + achFrsNom(f) + " À " + c.ref);
      C.rep[f] = { st: "repondu", date: now(), dvf: v.id }; store("RÉPONSE REÇUE");
      achDvfFiche(v.id, () => draw()); draw(); return; }
    if (e.target.closest("[data-cancel]")) { const m = await achAsk("ANNULER LA CONSULTATION " + C.ref + " (SES BESOINS REDEVIENNENT À CONSULTER)", "MOTIF DE L'ANNULATION"); if (!m) return;
      C.state = "annule"; C.motifAnn = m; store("ANNULÉE — " + m); d.remove(); if (done) done(); return; }
    const sv = e.target.closest("[data-save]"), cl = e.target.closest("[data-close]");
    if (!sv && !cl) return;
    pull();
    if (C.lignes.some(l => !achU(l.des) || !(achN(l.q) > 0))) { svToast("CHAQUE LIGNE : DÉSIGNATION ET QUANTITÉ.", 3000); return; }
    if (cl) {
      const D = achDvf().filter(v => v.caf === C.id && v.state !== "annule"), v = D.find(x => x.frs === C.retenu);
      if (!v) { svToast("CHOISIR LE FOURNISSEUR RETENU (TABLEAU COMPARATIF).", 3500); return; }
      if (achDvfWhy(v).some(m => /REÇU APRÈS LA DATE LIMITE$/.test(m))) { svToast("DEVIS REÇU APRÈS LA DATE LIMITE : L'ACCEPTER AVEC UN MOTIF (FICHE DU DEVIS) AVANT DE LE RETENIR.", 5000); return; }
      if (achDvfWhy(v).some(m => /PRIX MANQUANTS|DEVIS EXPIRÉ/.test(m))) { svToast("DEVIS RETENU INCOMPLET OU EXPIRÉ : " + achDvfWhy(v).join(" · "), 4500); return; }
      const min = Math.min(...D.map(x => achDvfTot(x).ht).filter(x => x > 0));
      if (achDvfTot(v).ht > min + 1e-6 && !C.motif) { svToast("LE RETENU N'EST PAS LE MOINS CHER : MOTIF OBLIGATOIRE.", 4000); return; }
      if (!(await svConfirm({ title: "CLÔTURER LA CONSULTATION", text: C.ref + " : RETENU " + achFrsNom(C.retenu) + " (" + achF2(achDvfTot(v).ht) + " HT). LES AUTRES DEVIS SONT REJETÉS ; LES BESOINS DES LIGNES DEVIENNENT COUVERTS.", ok: "CLÔTURER", tone: "neutral" }))) return;
      const DL = achDvf(); DL.forEach(x => { if (x.caf === C.id && x.state !== "annule") { x.state = x.id === v.id ? "retenu" : "rejete"; x.mod = now(); achHist(x.ref, x.state === "retenu" ? "RETENU" : "REJETÉ", C.ref); } }); achDvfSave(DL);
      /* v814 : seules les lignes chiffrées par le retenu couvrent leur besoin ; les autres restent à reconsulter (C5.24, C5.43) */
      const priced = l => (v.lignes || []).some(y => (y.bsn ? y.bsn === l.bsn : achU(y.des) === achU(l.des) && achU(y.u) === achU(l.u)) && achN(y.pu) > 0);
      const BL = achBsn(); C.lignes.filter(priced).forEach(l => { const b = BL.find(x => x.id === l.bsn); if (b) { b.couvert = C.id; b.mod = now(); achHist(b.ref, "COUVERT", C.ref + " — " + achFrsNom(C.retenu)); } }); achBsnSave(BL);
      C.state = "close"; C.close = now(); store("CLOSE — RETENU " + achFrsNom(C.retenu) + (C.motif ? " — " + C.motif : ""));
      d.remove(); if (done) done(); return;
    }
    store(C.id ? "MODIFICATION" : "CRÉATION"); draw();
  });
}

/* ---------- FICHE DEVIS ---------- */
function achDvfFiche(id, done) {
  const L0 = achDvf(), v0 = id ? L0.find(x => x.id === id) : null; if (id && !v0) return;
  const V = v0 ? JSON.parse(JSON.stringify(v0)) : { id: "", ref: "", caf: "", frs: "", refFrs: "", date: new Date().toISOString().slice(0, 10), validite: "", lignes: [], state: "recu" };
  const ro = !!v0 && v0.state !== "recu", d = sviWinNew();
  const draw = () => {
    const t = achDvfTot(V), why = V.id ? achDvfWhy(V) : [], dis = ro ? " disabled" : "", FR = achLive(achFrs()).filter(f => achFrsOk(f) || f.id === V.frs);
    d.innerHTML = sviWinCard({ cls: "frs-card dvf-card", close: "data-x", title: v0 ? "DEVIS — " + esc(V.ref) + " · " + ({ recu: "REÇU", retenu: "RETENU", rejete: "REJETÉ", annule: "ANNULÉ" }[V.state]) : "NOUVEAU DEVIS",
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}</div>` : ""}<div class="frs-scroll">
        <div class="frs-sec"><div class="frs-g">
          <label class="frs-f frs-w"><span>FOURNISSEUR <b>*</b></span><select class="ins-in dvf-x" data-k="frs"${dis || (V.caf ? " disabled" : "")}><option value=""></option>${FR.map(f => `<option value="${esc(f.id)}"${f.id === V.frs ? " selected" : ""}>${esc(f.code + " — " + f.nom)}</option>`).join("")}</select></label>
          <label class="frs-f"><span>N° DU DEVIS FOURNISSEUR</span><input class="ins-in dvf-x" data-k="refFrs" value="${esc(V.refFrs)}"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>CONSULTATION</span><input class="ins-in" value="${esc(((achCaf().find(c => c.id === V.caf) || {}).ref) || "HORS CONSULTATION")}" readonly></label>
          <label class="frs-f"><span>DATE</span><input type="date" class="ins-in dvf-x" data-k="date" value="${esc(V.date)}"${dis}></label>
          <label class="frs-f"><span>VALIDE JUSQU'AU</span><input type="date" class="ins-in dvf-x" data-k="validite" value="${esc(V.validite)}"${dis}></label>
          <label class="frs-f"><span>REMISE GLOBALE (%)</span><input class="ins-in dvf-x number" data-k="remG" inputmode="decimal" value="${esc(V.remG ? String(V.remG).replace(".", ",") : "")}"${dis}></label>
          <label class="frs-f"><span>TRANSPORT HT (VIDE = FRANCO)</span><input class="ins-in dvf-x number" data-k="transp" inputmode="decimal" value="${esc(V.transp ? achF2(V.transp) : "")}"${dis}></label>
          <label class="frs-f"><span>TOTAL HT ÉCRIT PAR LE FOURNISSEUR</span><input class="ins-in dvf-x number" data-k="totFrs" inputmode="decimal" value="${esc(V.totFrs ? achF2(V.totFrs) : "")}"${dis}></label>
          <label class="frs-f"><span>PAIEMENT PROPOSÉ</span><input class="ins-in dvf-x" data-k="condPay" value="${esc(V.condPay || "")}"${dis} autocomplete="off"></label>
          <label class="frs-f frs-w"><span>CONTACT (DEVIS VERBAL OU TÉLÉPHONE)</span><input class="ins-in dvf-x" data-k="contact" value="${esc(V.contact || "")}"${dis} autocomplete="off"></label>
          <label class="frs-f frs-w"><span>MÉMO INTERNE DE L'ACHETEUR (NON IMPRIMÉ)</span><input class="ins-in dvf-x" data-k="memo" value="${esc(V.memo || "")}"${dis} autocomplete="off"></label>
          ${(() => { const c = V.caf ? achCaf().find(x => x.id === V.caf) : null; return c && c.dlim && V.date > c.dlim ? `<label class="frs-f frs-w"><span>REÇU APRÈS LA DATE LIMITE : ACCEPTÉ, MOTIF</span><input class="ins-in dvf-x" data-k="tardOk" value="${esc(V.tardOk || "")}"${dis} autocomplete="off"></label>` : ""; })()}</div></div>
        <div class="frs-sec"><div class="frs-st">LIGNES ${svCnt(V.lignes.length)}</div>
          <table class="prm-table frs-sub"><thead><tr><th>DÉSIGNATION</th><th>U</th><th class="number">QUANTITÉ</th><th class="number">PRIX HT</th><th class="number">REMISE %</th><th class="number">DÉLAI (JOURS)</th><th class="number">TVA %</th><th class="number">MONTANT NET HT</th><th></th></tr></thead><tbody>
          ${V.lignes.map((l, i) => `<tr data-i="${i}"><td><input class="ins-in dvf-l" data-c="des" value="${esc(l.des)}"${dis || (V.caf ? " readonly" : "")}></td><td><input class="ins-in dvf-l" data-c="u" value="${esc(l.u)}"${dis || (V.caf ? " readonly" : "")}></td>
            <td><input class="ins-in dvf-l number" data-c="q" inputmode="decimal" value="${esc(String(l.q ?? "").replace(".", ","))}"${dis}></td><td><input class="ins-in dvf-l number" data-c="pu" inputmode="decimal" value="${l.pu === "" ? "" : esc(achF2(l.pu))}"${dis}></td>
            <td><input class="ins-in dvf-l number" data-c="rem" inputmode="decimal" value="${l.rem ? esc(String(l.rem).replace(".", ",")) : ""}"${dis}></td><td><input class="ins-in dvf-l number" data-c="delai" inputmode="numeric" value="${l.delai ? esc(String(l.delai)) : ""}"${dis}></td>
            <td><input class="ins-in dvf-l number" data-c="tva" inputmode="decimal" value="${esc(String(l.tva ?? achPrm().tva).replace(".", ","))}"${dis}></td><td class="number">${esc(achF2(achN(l.q) * achDvfPuNet(V, l)))}</td>
            <td class="center">${ro || V.caf ? "" : `<button type="button" class="ach-x" data-rml="${i}">✕</button>`}</td></tr>`).join("") || `<tr><td colspan="9" class="empty">AUCUNE LIGNE</td></tr>`}
          <tr class="caf-tot"><td colspan="7"><b>TOTAL HT · TTC${t.transp ? " (TRANSPORT " + esc(achF2(t.transp)) + " COMPRIS)" : ""}</b></td><td class="number"><b>${esc(achF2(t.ht))}</b><br>${esc(achF2(t.ttc))}</td><td></td></tr></tbody></table>
          ${ro || V.caf ? "" : `<button type="button" class="ach-b" data-addl>+ LIGNE</button>`}</div></div>`,
      foot: `<button type="button" class="svc-b" data-x>${ro || v0 ? "FERMER" : "ANNULER"}</button>${v0 && V.state === "recu" ? `<button type="button" class="svc-b" data-cancel>ANNULER LE DEVIS</button>` : ""}${!ro ? `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button>` : ""}` });
    if (!d.isConnected) sviWinShow(d);
  };
  const pull = () => { d.querySelectorAll(".dvf-x").forEach(i => { if (i.disabled) return; const k = i.dataset.k; V[k] = ["remG", "transp", "totFrs"].includes(k) ? (String(i.value).trim() === "" ? "" : achN(i.value)) : ["refFrs", "condPay", "contact", "memo", "tardOk"].includes(k) ? achU(i.value) : i.value; });
    d.querySelectorAll("tr[data-i]").forEach(tr => { const l = V.lignes[+tr.dataset.i]; if (!l) return; tr.querySelectorAll(".dvf-l").forEach(i => { const c = i.dataset.c; l[c] = c === "q" || c === "tva" || c === "rem" || c === "delai" ? achN(i.value) : c === "pu" ? (String(i.value).trim() === "" ? "" : achN(i.value)) : achU(i.value); }); }); };
  draw();
  d.addEventListener("change", e => { if (e.target.closest(".dvf-l, .dvf-x")) { pull(); draw(); } });
  d.addEventListener("click", async e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (done) done(); return; }
    if (ro) return;
    if (e.target.closest("[data-addl]")) { pull(); V.lignes.push({ des: "", u: "", q: "", pu: "", tva: achPrm().tva }); draw(); return; }
    const rl = e.target.closest("[data-rml]"); if (rl) { pull(); V.lignes.splice(+rl.dataset.rml, 1); draw(); return; }
    const L = achDvf(), now = new Date().toISOString();
    if (e.target.closest("[data-cancel]")) { const v = L.find(x => x.id === V.id); if (!v) return; if (!(await svConfirm({ title: "ANNULER LE DEVIS", text: v.ref + " PASSE EN ANNULÉ (GARDÉ).", ok: "ANNULER LE DEVIS" }))) return;
      v.state = "annule"; v.mod = now; achDvfSave(L); achHist(v.ref, "ANNULÉ", ""); d.remove(); if (done) done(); return; }
    if (!e.target.closest("[data-save]")) return;
    pull();
    if (!V.frs) { svToast("FOURNISSEUR OBLIGATOIRE.", 3000); return; }
    { const f = achFrs().find(x => x.id === V.frs); if (f && !achFrsOk(f) && !(v0 && v0.frs === V.frs)) { svToast("FOURNISSEUR BLOQUÉ, ARCHIVÉ OU INACTIF : DEVIS REFUSÉ.", 4000); return; } }
    if (achN(V.remG) > 100 || V.lignes.some(l => achN(l.rem) > 100)) { svToast("UNE REMISE NE PEUT PAS DÉPASSER 100 %.", 3000); return; }
    if (!V.lignes.length || V.lignes.some(l => !achU(l.des) || !(achN(l.q) > 0))) { svToast("AU MOINS UNE LIGNE ; CHAQUE LIGNE : DÉSIGNATION ET QUANTITÉ.", 3500); return; }
    if (V.lignes.some(l => l.pu !== "" && achN(l.pu) < 0)) { svToast("PRIX NON VALIDE.", 3000); return; }
    let v = V.id ? L.find(x => x.id === V.id) : null;
    if (!v) { v = { ...JSON.parse(JSON.stringify(V)), id: "V" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ref: achNextRef("DVF", L), cree: now }; L.push(v); }
    else Object.assign(v, JSON.parse(JSON.stringify(V)));
    v.mod = now; achDvfSave(L); achHist(v.ref, V.id ? "MODIFICATION" : "CRÉATION", achFrsNom(v.frs) + " — " + achF2(achDvfTot(v).ht) + " HT");
    d.remove(); if (done) done();
  });
}

/* v814 : lignes de commande depuis un devis — prix net (remises déduites) ; transport en ligne à part */
function achDvfCmfLines(v) {
  const L = (v.lignes || []).filter(l => achN(l.pu) > 0).map(l => ({ ...l, pu: Math.round(achDvfPuNet(v, l) * 10000) / 10000 }));
  if (achN(v.transp) > 0) L.push({ des: "TRANSPORT", u: "FORFAIT", q: 1, pu: achN(v.transp), tva: achPrm().tva, bsn: "" });
  return L; }
/* v814 : prix anormalement bas (C5.68) — sous 70 % de la moyenne des autres offres pour la même ligne */
function achDvfLow(C, D, l, v, x) {
  const p = achDvfPuNet(v, x), o = D.filter(y => y.id !== v.id).map(y => { const z = (y.lignes || []).find(q => achU(q.des) === achU(l.des) && achU(q.u) === achU(l.u)); return z && achN(z.pu) > 0 ? achDvfPuNet(y, z) : 0; }).filter(Boolean);
  return o.length > 0 && p > 0 && p < 0.7 * o.reduce((a, b) => a + b, 0) / o.length; }
/* fenêtre de choix multiple (besoins, fournisseurs) : rend la liste des valeurs cochées */
function achPickWin(title, items) {
  return new Promise(ok => {
    const d = sviWinNew();
    d.innerHTML = sviWinCard({ cls: "cmpm-pick", close: "data-x", title: esc(title), body: `<div class="cmpm-list">${items.map(x => `<label class="cmpm-it"><input type="checkbox" value="${esc(x.v)}"> ${esc(x.lab)}</label>`).join("")}</div>`,
      foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>AJOUTER</button>` });
    sviWinShow(d);
    d.addEventListener("click", e => {
      if (e.target === d || e.target.closest("[data-x]")) { d.remove(); ok([]); return; }
      if (e.target.closest("[data-ok]")) { const v = [...d.querySelectorAll("input:checked")].map(i => i.value); d.remove(); ok(v); }
    });
  });
}
/* ⟪ src/45-achats-commandes.js ⟫ */
/* =========================================================
   v762 : COMMANDES, RÉCEPTIONS, RETOURS (étape 4) — onglets de l'écran des achats (menu ☰ › ACHAT)
   Tableaux : achListMod (44) ; fiches ci-dessous ; règles : 40-achats-donnees.js (achCmfTot, achResteQ, achCmfWhy, achRcpWhy…).
   ========================================================= */
const ACH_CMF_ST = { instance: "EN INSTANCE", valide: "VALIDÉE", solde: "SOLDÉE", annule: "ANNULÉE" };
const achNow = () => new Date().toISOString();
function achCmfMod(ctx) {
  return achListMod(ctx, { k: "cmf", t: "ach_cmf", id: "achCmfT", list: achCmf, name: "COMMANDES", save: achCmfSave, inst: c => c.state === "instance", etatKey: "svi_ach_cmf_etat_v1", newLab: "NOUVELLE COMMANDE", newRow: "CRÉER UNE COMMANDE ICI…", open: achCmfFiche,
    etats: [["actif", "EN COURS"], ["instance", "EN INSTANCE"], ["valide", "VALIDÉES"], ["solde", "SOLDÉES"], ["alerte", "ALERTE"], ["annule", "ANNULÉES"], ["tout", "TOUT"]],
    ok: (c, k) => k === "tout" ? true : k === "alerte" ? achCmfWhy(c).length > 0 : k === "actif" ? c.state === "instance" || c.state === "valide" : c.state === k,
    why: c => achCmfWhy(c),
    w: { ref: 150, nat: 160, frs: 220, lieu: 160, prom: 110, ht: 130, ttc: 130, recu: 100, etat: 110 },
    cols: () => [["ref", "RÉFÉRENCE", c => c.ref + (c.av ? " AV" + c.av : ""), ""], ["nat", "NATURE", c => c.nat || "", ""], ["frs", "FOURNISSEUR", c => c.frs ? achFrsNom(c.frs) : "", ""],
      ["lieu", "LIVRAISON", c => c.lieu || "", ""], ["prom", "DATE PROMISE", c => achDFr(c.dConf || c.dProm), ""], ["ht", "MONTANT HT", c => achCmfTot(c).ht, "number"], ["ttc", "MONTANT TTC", c => achCmfTot(c).ttc, "number"],
      ["recu", "REÇU", c => { const L = c.lignes || []; const q = L.reduce((t, l) => t + achN(l.q), 0), r = L.reduce((t, l) => t + achN(l.q) - achResteQ(c, l), 0); return q ? Math.round(r / q * 100) + " %" : ""; }, "center"],
      ["etat", "ÉTAT", c => ACH_CMF_ST[c.state] || "", "center"]] });
}
function achRcpMod(ctx) {
  return achListMod(ctx, { k: "rcp", t: "ach_rcp", id: "achRcpT", list: achRcp, name: "RÉCEPTIONS", etatKey: "svi_ach_rcp_etat_v1", newLab: "LIVRAISON SANS COMMANDE", newRow: "CRÉER UNE RÉCEPTION SANS COMMANDE ICI… (LES AUTRES : DEPUIS LA COMMANDE, RÉCEPTIONNER)", open: (id, done) => achRcpFiche(id, null, done),
    etats: [["actif", "ACTIVES"], ["alerte", "ALERTE"], ["annule", "ANNULÉES"], ["tout", "TOUT"]],
    ok: (r, k) => k === "tout" ? true : k === "alerte" ? achRcpWhy(r).length > 0 : k === "annule" ? r.state === "annule" : r.state !== "annule",
    why: r => achRcpWhy(r),
    w: { ref: 150, cmf: 150, frs: 220, nbl: 130, date: 150, lig: 80, res: 150, etat: 100 },
    cols: () => [["ref", "RÉFÉRENCE", r => r.ref, ""], ["cmf", "COMMANDE", r => ((achCmf().find(c => c.id === r.cmf) || {}).ref) || "SANS COMMANDE", ""], ["frs", "FOURNISSEUR", r => r.frs ? achFrsNom(r.frs) : "", ""],
      ["nbl", "N° BL", r => r.pv ? "PV DE SERVICE FAIT" : r.nbl || "", ""], ["date", "REÇU LE", r => svDT(r.date || ""), ""], ["lig", "LIGNES", r => String((r.lignes || []).length), "center"],
      ["res", "RÉSULTAT", r => { const L = r.lignes || []; return L.some(l => l.st === "ref") ? (L.every(l => l.st === "ref") ? "REFUSÉE" : "REFUS PARTIEL") : L.some(l => l.st === "res") ? (r.resLev ? "RÉSERVES LEVÉES" : "AVEC RÉSERVES") : "ACCEPTÉE"; }, "center"],
      ["etat", "ÉTAT", r => r.state === "annule" ? "ANNULÉE" : "ENREGISTRÉE", "center"]] });
}
function achRtrMod(ctx, kind) {
  return achListMod(ctx, { k: "rtr" + kind, t: "ach_rtr" + kind, id: kind === "cmd" ? "achRtcT" : "achRtrT", name: kind === "cmd" ? "RETOURS DE COMMANDE" : "RETOURS DE RÉCEPTION", list: () => achRtr().filter(x => x.kind === kind), etatKey: "svi_ach_rtr" + kind + "_etat_v1",
    newLab: kind === "cmd" ? "RETOUR DE COMMANDE (DEPUIS LA COMMANDE)" : "RETOUR DE RÉCEPTION (DEPUIS LA RÉCEPTION)", newRow: kind === "cmd" ? "UN RETOUR DE COMMANDE SE CRÉE DEPUIS LA COMMANDE (RETOUR DE COMMANDE, SOLDER)" : "UN RETOUR DE RÉCEPTION SE CRÉE DEPUIS LA RÉCEPTION (REFUS, RETOURNER)",
    open: (id, done) => { if (id) achRtrWin(id); else svToast(kind === "cmd" ? "OUVRIR LA COMMANDE PUIS « RETOUR DE COMMANDE » OU « SOLDER »." : "OUVRIR LA RÉCEPTION PUIS « RETOURNER » (OU REFUSER DES LIGNES).", 3500); },
    etats: [["tout", "TOUS"]], ok: () => true, why: () => [],
    w: { ref: 150, src: 150, frs: 220, date: 150, lig: 260, mt: 130, motif: 260 },
    cols: () => [["ref", "RÉFÉRENCE", x => x.ref, ""], ["src", kind === "cmd" ? "COMMANDE" : "RÉCEPTION", x => kind === "cmd" ? ((achCmf().find(c => c.id === x.cmf) || {}).ref || "") : ((achRcp().find(r => r.id === x.rcp) || {}).ref || ""), ""],
      ["frs", "FOURNISSEUR", x => x.frs ? achFrsNom(x.frs) : "", ""], ["date", "DATE", x => svDT(x.date || ""), ""], ["lig", "LIGNES", x => (x.lignes || []).map(l => l.des + " " + achF2(l.q) + " " + l.u).join(" · "), ""], ["mt", "MONTANT HT", x => achRtrMt(x), "number"], ["motif", "MOTIF", x => x.motif || "", ""]] });
}
function achRtrWin(id) {
  const x = achRtr().find(y => y.id === id); if (!x) return;
  const d = sviWinNew();
  d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: (x.kind === "cmd" ? "RETOUR DE COMMANDE — " : "RETOUR DE RÉCEPTION — ") + esc(x.ref),
    body: `<div class="bsn-note">FOURNISSEUR : ${esc(x.frs ? achFrsNom(x.frs) : "")} · DATE : ${esc(svDT(x.date || ""))}${x.chauffeur ? " · REMIS À : " + esc(x.chauffeur) : ""}</div><div class="bsn-note">MOTIF : ${esc(x.motif || "")}</div>
      <table class="prm-table frs-sub"><thead><tr><th>DÉSIGNATION</th><th>U</th><th class="number">QUANTITÉ</th></tr></thead><tbody>${(x.lignes || []).map(l => `<tr><td>${esc(l.des)}</td><td>${esc(l.u)}</td><td class="number">${esc(achF2(l.q))}</td></tr>`).join("")}</tbody></table>`,
    foot: `<button type="button" class="svc-b svc-ok svc-neutral" data-x>FERMER</button>` });
  sviWinShow(d);
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) d.remove(); });
}
/* retour (de commande ou de réception) : enregistré et noté dans H */
/* B37 (série B) : un retour est une pièce de montant NÉGATIF (prix des lignes de la commande d'origine) */
const achRtrMt = x => { const c = achCmf().find(y => y.id === x.cmf), CL = (c && c.lignes) || [];
  return -(x.lignes || []).reduce((t, l) => { const o = CL.find(y => y.id === l.cl) || CL.find(y => achKey(y.des, y.u) === achKey(l.des, l.u)) || {}; return t + achN(l.q) * achN(o.pu) * (1 - achN(c && c.rem) / 100); }, 0); };
const achRtrAdd = o => { const L = achRtr(); const x = { id: "T" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ref: achNextRef(o.kind === "cmd" ? "RTC" : "RTR", L.filter(y => y.kind === o.kind)), date: achNow(), ...o }; L.push(x); achRtrSave(L);
  achHist(x.ref, "CRÉATION", (x.motif || "") + " — " + (x.lignes || []).map(l => l.des + " " + achF2(l.q)).join(" · ")); return x; };
/* fenêtre de quantités par ligne (retour, avenant…) : rend [{ cl, des, u, q }] (q > 0) et le motif, ou null */
function achQtyWin(title, lines, o = {}) {
  return new Promise(ok => {
    const d = sviWinNew();
    d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: esc(title),
      body: `<table class="prm-table frs-sub"><thead><tr><th>DÉSIGNATION</th><th>U</th><th class="number">MAXIMUM</th><th class="number">QUANTITÉ</th></tr></thead><tbody>
        ${lines.map((l, i) => `<tr><td>${esc(l.des)}</td><td>${esc(l.u)}</td><td class="number">${esc(achF2(l.max))}</td><td><input class="ins-in aq-q number" data-i="${i}" inputmode="decimal" value="${o.full ? esc(String(l.max).replace(".", ",")) : ""}"></td></tr>`).join("")}</tbody></table>
        <label class="frs-f frs-w"><span>MOTIF <b>*</b></span><input class="ins-in aq-m" value="${esc(o.motif || "")}" autocomplete="off"></label>${o.chauffeur ? `<label class="frs-f frs-w"><span>REMIS AU CHAUFFEUR (NOM)</span><input class="ins-in aq-c" autocomplete="off"></label>` : ""}`,
      foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>${esc(o.ok || "ENREGISTRER")}</button>` });
    sviWinShow(d);
    /* v908 (principe du 03/11/2026) : quantité au-dessus du MAXIMUM refusée en quittant la case */
    d.addEventListener("focusin", e => { const i = e.target.closest && e.target.closest(".aq-q"); if (i) i.dataset.prev = i.value; });
    d.addEventListener("change", e => { const i = e.target.closest && e.target.closest(".aq-q"); if (!i) return; const l = lines[+i.dataset.i], q = achN(i.value);
      if (String(i.value).trim() && (!(q >= 0) || q > l.max + 1e-9)) { i.value = i.dataset.prev || ""; svToast("QUANTITÉ : DE 0 AU MAXIMUM (" + achF2(l.max) + ").", 3500, i); } });
    d.addEventListener("click", e => {
      if (e.target === d || e.target.closest("[data-x]")) { d.remove(); ok(null); return; }
      if (!e.target.closest("[data-ok]")) return;
      const m = achU(d.querySelector(".aq-m").value); if (!m) { svToast("MOTIF OBLIGATOIRE.", 3000); return; }
      const out = []; let bad = false;
      d.querySelectorAll(".aq-q").forEach(i => { const l = lines[+i.dataset.i], q = achN(i.value); if (q > l.max + 1e-9) bad = true; if (q > 0) out.push({ cl: l.cl, des: l.des, u: l.u, q }); });
      if (bad) { svToast("QUANTITÉ AU-DESSUS DU MAXIMUM.", 3000); return; }
      if (!out.length) { svToast("AUCUNE QUANTITÉ.", 3000); return; }
      const c = d.querySelector(".aq-c"); d.remove(); ok({ lignes: out, motif: m, chauffeur: c ? achU(c.value) : "" });
    });
  });
}

/* ---------- FICHE COMMANDE ---------- */
/* nouvelle commande depuis une consultation close (devis retenu) ou des besoins en achat direct */
function achCmfFrom(o) {
  const L = achCmf(), c = { id: "M" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ref: achNextRef("CMF", L), nat: "FOURNITURES", frs: o.frs || "", caf: o.caf || "", dvf: o.dvf || "",
    lieu: o.lieu || "", dProm: "", dConf: "", urg: false, cond: "", avT: "", avV: 0, rem: 0, transp: "FRANCO", frais: 0, state: "instance", av: 0, cree: achNow(), cla: achClCopy(achPrm().clP),
    lignes: (o.lignes || []).map(l => ({ id: achLid(), des: l.des, u: l.u, q: achN(l.q), pu: achN(l.pu), tva: l.tva === undefined ? achPrm().tva : l.tva, bsn: l.bsn || "", dvf: l.dvf || o.dvf || "" })) };
  L.push(c); achCmfSave(L); achHist(c.ref, "CRÉATION", o.why || ""); return c;
}
function achCmfFiche(id, done) {
  let c0 = id ? achCmf().find(x => x.id === id) : null;
  if (id && !c0) return;
  if (!c0) c0 = achCmfFrom({ why: "SAISIE LIBRE" });
  const C = JSON.parse(JSON.stringify(c0)), d = sviWinNew();
  if (!Array.isArray(C.cla)) C.cla = achClCopy(achPrm().clP);   /* B29 : commande d'avant les clauses = clauses particulières du modèle */
  let edAv = false;   /* avenant en cours : la commande validée redevient modifiable */
  const draw = () => {
    const circ = C.state === "instance" && !!C.circ && !achCircDone(C), SEU = C.state === "instance" ? achCmfSeu(C) : null;
    const ro = !(C.state === "instance" || edAv) || circ, dis = ro ? " disabled" : "", t = achCmfTot(C), why = achCmfWhy(C), R = achRcp(), T = achRtr();
    const BL = achBsn(), DV = achDvf(), PV = C.nat === "PRESTATIONS ET HONORAIRES";
    const opt = (L, v) => L.map(x => `<option value="${esc(x[0])}"${x[0] === v ? " selected" : ""}>${esc(x[1])}</option>`).join("");
    const FR = achLive(achFrs()).filter(f => achFrsOk(f) || f.id === C.frs);
    d.innerHTML = sviWinCard({ cls: "frs-card cmf-card", close: "data-x", title: "COMMANDE — " + esc(C.ref) + (C.av ? " · AVENANT " + C.av : "") + " · " + (ACH_CMF_ST[C.state] || "") + (edAv ? " (AVENANT EN COURS)" : ""),
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}</div>` : ""}${(C.renv || []).length && C.state === "instance" && !C.circ ? `<div class="frs-why">↩ RENVOYÉE PAR ${esc(achGradeLab(C.renv[C.renv.length - 1].g))}${C.renv[C.renv.length - 1].u ? " — " + esc(C.renv[C.renv.length - 1].u) : ""} : ${esc(C.renv[C.renv.length - 1].why)}</div>` : ""}<div class="frs-scroll">
        ${C.circ && C.state === "instance" ? `<div class="frs-sec cmf-circ"><div class="frs-st">CIRCUIT DE VALIDATION — AU-DELÀ DE ${esc(achF2(C.circ.mt))} HT${C.circ.h ? " (HIÉRARCHIE RESPECTÉE)" : ""}</div>
          <table class="prm-table frs-sub"><thead><tr><th>GRADE</th><th>ÉTAT</th><th>PAR</th><th>LE</th></tr></thead><tbody>${C.circ.g.map(g => { const o = (C.circ.ok || []).find(x => String(x.g) === g), nx = achCircNext(C).includes(g);
            return `<tr class="${o ? "nvr-valide" : nx ? "nvr-instance" : ""}"><td>${esc(achGradeLab(g))}</td><td>${o ? "ACCEPTÉE" : nx ? "À VALIDER" : "EN ATTENTE"}</td><td>${esc(o ? o.u || "" : "")}</td><td>${esc(o ? achDFr(o.t) : "")}</td></tr>`; }).join("")}</tbody></table></div>` : ""}
        <div class="frs-sec"><div class="frs-g">
          <label class="frs-f"><span>NATURE</span><select class="ins-in cmf-x" data-k="nat"${dis}>${opt(ACH_NAT.map(x => [x, x]), C.nat)}</select></label>
          <label class="frs-f frs-w"><span>FOURNISSEUR <b>*</b></span><select class="ins-in cmf-x" data-k="frs"${dis || (C.caf ? " disabled" : "")}><option value=""></option>${opt(FR.map(f => [f.id, f.code + " — " + f.nom]), C.frs)}</select></label>
          <label class="frs-f"><span>LIEU DE LIVRAISON</span><input class="ins-in cmf-x" data-k="lieu" value="${esc(C.lieu)}"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>DATE PROMISE</span><input type="date" class="ins-in cmf-x" data-k="dProm" value="${esc(C.dProm)}"${dis}></label>
          <label class="frs-f"><span>DATE CONFIRMÉE</span><input type="date" class="ins-in cmf-x" data-k="dConf" value="${esc(C.dConf)}"${C.state === "annule" || C.state === "solde" ? " disabled" : ""}></label>
          <label class="frs-f"><span>TRANSPORT</span><select class="ins-in cmf-x" data-k="transp"${dis}>${opt([["FRANCO", "FRANCO (COMPRIS)"], ["DÉPART", "DÉPART (À NOTRE CHARGE)"]], C.transp)}</select></label>
          <label class="frs-f"><span>FRAIS DE TRANSPORT HT</span><input class="ins-in cmf-x" data-k="frais" inputmode="decimal" value="${esc(achF2(C.frais))}"${dis}></label>
          <label class="frs-f"><span>REMISE (%)</span><input class="ins-in cmf-x" data-k="rem" inputmode="decimal" value="${esc(String(achN(C.rem)).replace(".", ","))}"${dis}></label>
          <label class="frs-f"><span>AVANCE</span><select class="ins-in cmf-x" data-k="avT"${dis}>${opt([["", "AUCUNE"], ["pct", "EN %"], ["mt", "EN MONTANT"]], C.avT)}</select></label>
          <label class="frs-f"><span>AVANCE (VALEUR)</span><input class="ins-in cmf-x" data-k="avV" inputmode="decimal" value="${esc(String(achN(C.avV)).replace(".", ","))}"${dis || (!C.avT ? " disabled" : "")}></label>
          <label class="frs-f frs-w"><span>CONDITIONS ET PÉNALITÉS (IMPRIMÉES SUR LA COMMANDE)</span><input class="ins-in cmf-x" data-k="cond" value="${esc(C.cond)}"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>CONTACT DU FOURNISSEUR</span><input class="ins-in cmf-x" data-k="ctFrs" value="${esc(C.ctFrs || "")}"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>RESPONSABLE DE LA RÉCEPTION</span><input class="ins-in cmf-x" data-k="respRec" value="${esc(C.respRec || "")}"${dis} autocomplete="off"></label>
          <label class="frs-f frs-w"><span>HORAIRES, ACCÈS AU CHANTIER, DÉCHARGEMENT</span><input class="ins-in cmf-x" data-k="acces" value="${esc(C.acces || "")}"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>MARCHÉ CLIENT ET LOT</span><input class="ins-in cmf-x" data-k="marche" value="${esc(C.marche || "")}"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>ÉCHÉANCE PRÉVUE DU PAIEMENT</span><input class="ins-in" value="${esc(achDFr(achCmfEch(C)) || "—")}" readonly></label>
          ${(() => { const X = achCmfDist(C); /* v913 (C1.51) : distance au chantier et transport estimé */
            return `<label class="frs-f"><span data-tip="À VOL D'OISEAU, ENTRE LE DÉPÔT DU FOURNISSEUR ET LE CHANTIER">DISTANCE AU CHANTIER</span><input class="ins-in" value="${esc(X.km === undefined ? X.why : achF2(X.km) + " KM")}" readonly></label>
          <label class="frs-f"><span>TRANSPORT ESTIMÉ</span><input class="ins-in" value="${esc(X.km === undefined ? "—" : X.cost === null ? "PRIX AU KM À RÉGLER (PARAMÉTRAGE › BUDGET › TRANSPORT)" : achF2(X.cost) + " DH")}" readonly></label>`; })()}
          ${!(C.lignes || []).some(l => l.bsn || l.dvf) ? `<label class="frs-f frs-w"><span>MOTIF D'UNE COMMANDE SANS BESOIN NI DEVIS (SIÈGE, URGENCE) <b>*</b></span><input class="ins-in cmf-x${!C.motifSans && !ro ? " ins-need" : ""}" data-k="motifSans" value="${esc(C.motifSans || "")}"${dis} autocomplete="off"></label>` : ""}
          ${(C.lignes || []).some(l => l.dvf) ? (() => { /* v911 (principe du 03/11/2026) : prix différent du devis = motif obligatoire, signalé tout de suite (et non plus à VALIDER) */
            const DV = achDvf(), need = (C.lignes || []).some(l => { const v = l.dvf && DV.find(x => x.id === l.dvf); const z = v && (v.lignes || []).find(y => achKey(y.des, y.u) === achKey(l.des, l.u)); return z && Math.abs(achDvfPuNet(v, z) - achN(l.pu)) > 0.005; });
            return `<label class="frs-f frs-w"><span>MOTIF SI UN PRIX DIFFÈRE DU DEVIS${need ? " <b>*</b>" : ""}</span><input class="ins-in cmf-x${need && !C.motifPrix && !ro ? " ins-need" : ""}" data-k="motifPrix" value="${esc(C.motifPrix || "")}"${dis} autocomplete="off"></label>`; })() : ""}
          <label class="frs-f frs-w"><span>NOTE INTERNE (NON IMPRIMÉE)</span><input class="ins-in cmf-x" data-k="note" value="${esc(C.note || "")}"${C.state === "annule" ? " disabled" : ""} autocomplete="off"></label>
          <div class="frs-cs"><label class="frs-c"><input type="checkbox" class="cmf-xc" data-k="urg"${C.urg ? " checked" : ""}${C.state === "annule" ? " disabled" : ""}> COMMANDE URGENTE PASSÉE AVANT LES PAPIERS — À RÉGULARISER</label></div></div></div>
        <div class="frs-sec"><div class="frs-st">LIGNES ${svCnt(C.lignes.length)}</div>
          <table class="prm-table frs-sub"><thead><tr><th>DÉSIGNATION</th><th>U</th><th class="number">QUANTITÉ</th><th class="number">PRIX HT</th><th class="number">TVA %</th><th class="number">MONTANT HT</th><th>DEVIS · BESOIN</th><th class="number">REÇU</th><th class="number">RESTE</th><th></th></tr></thead><tbody>
          ${C.lignes.map((l, i) => { const rq = achRecQ(C.id, l.id, R, T), rs = achResteQ(C, l, R, T); return `<tr data-i="${i}"><td><input class="ins-in cmf-l" data-c="des" value="${esc(l.des)}"${dis}></td><td><input class="ins-in cmf-l" data-c="u" value="${esc(l.u)}"${dis}></td>
            <td><input class="ins-in cmf-l number" data-c="q" inputmode="decimal" value="${esc(String(l.q ?? "").replace(".", ","))}"${dis}></td><td><input class="ins-in cmf-l number" data-c="pu" inputmode="decimal" value="${esc(achF2(l.pu))}"${dis}></td>
            <td><input class="ins-in cmf-l number" data-c="tva" inputmode="decimal" value="${esc(String(l.tva ?? achPrm().tva).replace(".", ","))}"${dis}></td><td class="number">${esc(achF2(achN(l.q) * achN(l.pu) * (1 - achN(C.rem) / 100)))}</td>
            <td class="cmf-src">${esc([((DV.find(v => v.id === l.dvf) || {}).ref) || "", ((BL.find(b => b.id === l.bsn) || {}).ref) || ""].filter(Boolean).join(" · ") || "—")}</td>
            <td class="number">${esc(achF2(rq))}</td><td class="number">${esc(achF2(rs))}</td><td class="center">${ro || rq > 0 ? "" : `<button type="button" class="ach-x" data-rml="${i}">✕</button>`}</td></tr>`; }).join("") || `<tr><td colspan="10" class="empty">AUCUNE LIGNE</td></tr>`}
          <tr class="caf-tot"><td colspan="5"><b>TOTAL HT${achN(C.frais) ? " (TRANSPORT COMPRIS)" : ""} · TVA · TTC${C.avT ? " · AVANCE" : ""}</b></td><td class="number" colspan="5"><b>${esc(achF2(t.ht))}</b> · ${esc(achF2(t.tva))} · <b>${esc(achF2(t.ttc))}</b>${C.avT ? " · AVANCE " + esc(achF2(t.av)) : ""}</td></tr></tbody></table>
          ${ro ? "" : `<button type="button" class="ach-b" data-addl>+ LIGNE</button> <button type="button" class="ach-b" data-adddir>+ BESOINS EN ACHAT DIRECT</button>`}
          <div class="bsn-note">ARRÊTÉE À LA SOMME DE : ${esc(frMoney(t.ttc))} TTC.${PV ? " PRESTATIONS : LA RÉCEPTION SE FAIT PAR PROCÈS-VERBAL DE SERVICE FAIT." : ""}</div></div>
        <div class="frs-sec"><div class="frs-st">CLAUSES PARTICULIÈRES ${svCnt(C.cla.length)}</div>
          <table class="prm-table frs-sub cmf-cla"><thead><tr><th class="center">N°</th><th>TYPE</th><th>ARTICLE</th><th></th></tr></thead><tbody>
          ${C.cla.map((x, i) => `<tr data-ci="${i}"><td class="center">${i + 1}</td><td><select class="ins-in cmf-cl" data-c="t"${dis}>${ACH_CLT.map(([k, l]) => `<option value="${k}"${k === x.t ? " selected" : ""}>${l}</option>`).join("")}</select></td>
            <td><input class="ins-in cmf-cl" data-c="txt" value="${esc(x.txt || "")}"${dis} autocomplete="off"></td><td class="center">${ro ? "" : `<button type="button" class="ach-x" data-rmcl="${i}">✕</button>`}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">AUCUN ARTICLE</td></tr>`}</tbody></table>
          ${ro ? "" : `<button type="button" class="ach-b" data-addcl>+ ARTICLE</button>`}</div>
        ${(C.avH || []).length ? `<div class="frs-sec"><div class="frs-st">AVENANTS</div>${C.avH.map(a => `<div class="bsn-note">AVENANT ${a.n} — ${esc(achDFr(a.t))} — ${esc(a.motif)} (AVANT : ${esc(achF2(a.ht))} HT)</div>`).join("")}</div>` : ""}
      </div>`,
      foot: `<button type="button" class="svc-b" data-x>FERMER</button>
        ${C.state === "instance" && !R.some(r => r.cmf === C.id && r.state !== "annule") ? `<button type="button" class="svc-b" data-cancel>ANNULER LA COMMANDE</button>` : ""}
        ${C.id ? `<button type="button" class="svc-b" data-dup>DUPLIQUER</button><button type="button" class="svc-b" data-wa>WHATSAPP</button>` : ""}
        ${C.state === "valide" && !edAv ? (C.susp ? `<button type="button" class="svc-b" data-repr>REPRENDRE</button>` : `<button type="button" class="svc-b" data-susp>SUSPENDRE</button>`) + (C.litige ? `<button type="button" class="svc-b" data-litok>LEVER LE LITIGE</button>` : `<button type="button" class="svc-b" data-lit>LITIGE</button>`) : ""}
        ${C.state === "valide" && !edAv && !C.susp ? `<button type="button" class="svc-b" data-rtc>RETOUR DE COMMANDE</button><button type="button" class="svc-b" data-solde>SOLDER</button><button type="button" class="svc-b" data-av>AVENANT</button><button type="button" class="svc-b svc-ok svc-neutral" data-rcp>${PV ? "PV DE SERVICE FAIT" : "RÉCEPTIONNER"}</button>` : ""}
        ${C.state === "valide" && !edAv ? `<button type="button" class="svc-b svc-ok svc-neutral" data-save2>ENREGISTRER</button>` : ""}
        ${(C.state === "valide" || C.state === "instance") && !edAv && C.avT && achCmfTot(C).av - achAvVerse(C.id) > 0.005 ? `<button type="button" class="svc-b" data-avpay>VERSER L'AVANCE</button>` : ""}
        ${(C.state === "valide" || C.state === "solde") && !edAv ? `<button type="button" class="svc-b" data-fac>FACTURER</button>` : ""}
        ${!ro ? `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER${edAv ? " L'AVENANT" : ""}</button>` : ""}${C.state === "instance" ? (circ ? achCircNext(C).map(g => `<button type="button" class="svc-b" data-cret="${g}">RENVOYER (${esc("GRADE " + g)})</button><button type="button" class="svc-b svc-ok" data-cacc="${g}">ACCEPTER (${esc("GRADE " + g)})</button>`).join("")
          : SEU && !achCircDone(C) ? `<button type="button" class="svc-b svc-ok" data-circ>ENVOYER EN VALIDATION</button>` : `<button type="button" class="svc-b svc-ok" data-valid>VALIDER</button>`) : ""}` });
    if (!d.isConnected) sviWinShow(d);
  };
  const pull = () => { d.querySelectorAll(".cmf-x").forEach(i => { if (i.disabled) return; const k = i.dataset.k; C[k] = ["frais", "rem", "avV"].includes(k) ? achN(i.value) : ["dProm", "dConf", "frs", "nat", "transp", "avT"].includes(k) ? i.value : achU(i.value); });
    d.querySelectorAll(".cmf-xc").forEach(i => { if (!i.disabled) C[i.dataset.k] = i.checked; });
    d.querySelectorAll("tr[data-ci]").forEach(tr => { const x = C.cla[+tr.dataset.ci]; if (!x) return; [...tr.querySelectorAll(".cmf-cl")].sort((a, b) => (a.dataset.c === "t") - (b.dataset.c === "t")).forEach(i => { if (i.disabled) return; const c = i.dataset.c, ov = x.t; x[c] = c === "t" ? i.value : achU(i.value); if (c === "t" && ov !== x.t && (!x.txt || x.txt === achCltDef(ov))) x.txt = achCltDef(x.t); }); });
    d.querySelectorAll("tr[data-i]").forEach(tr => { const l = C.lignes[+tr.dataset.i]; if (!l) return; tr.querySelectorAll(".cmf-l").forEach(i => { if (i.disabled) return; const c = i.dataset.c; l[c] = ["q", "pu", "tva"].includes(c) ? achN(i.value) : achU(i.value); }); }); };
  const store = act => { const L = achCmf(), c = L.find(x => x.id === C.id); if (!c) return null; Object.assign(c, JSON.parse(JSON.stringify(C)), { mod: achNow() }); achCmfSave(L); achHist(c.ref, act, (c.frs ? achFrsNom(c.frs) : "") + " — " + achF2(achCmfTot(c).ht) + " HT"); return c; };
  const check = () => {
    if (!C.frs) { svToast("FOURNISSEUR OBLIGATOIRE.", 3000); return false; }
    if (!C.lignes.length || C.lignes.some(l => !achU(l.des) || !(achN(l.q) > 0) || !(achN(l.pu) > 0))) { svToast("AU MOINS UNE LIGNE ; CHAQUE LIGNE : DÉSIGNATION, QUANTITÉ ET PRIX.", 3500); return false; }
    if (achN(C.rem) < 0 || achN(C.rem) > 100) { svToast("REMISE NON VALIDE (0 À 100 %).", 3000); return false; }
    if (C.avT === "pct" && (achN(C.avV) < 0 || achN(C.avV) > 100)) { svToast("AVANCE NON VALIDE (0 À 100 %).", 3000); return false; }
    return true; };
  draw();
  d.addEventListener("change", e => { if (e.target.closest(".cmf-l, .cmf-x, .cmf-xc")) { pull(); draw(); } });
  d.addEventListener("change", e => { if (e.target.matches(".cmf-cl[data-c='t']")) { pull(); draw(); } });
  d.addEventListener("click", async e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (done) done(); return; }
    if (e.target.closest("[data-addl]")) { pull(); C.lignes.push({ id: achLid(), des: "", u: "", q: "", pu: "", tva: achPrm().tva, bsn: "", dvf: "" }); draw(); return; }
    const rl = e.target.closest("[data-rml]"); if (rl) { pull(); C.lignes.splice(+rl.dataset.rml, 1); draw(); return; }
    if (e.target.closest("[data-addcl]")) { pull(); C.cla.push({ t: "autre", txt: "" }); draw(); return; }
    const rc = e.target.closest("[data-rmcl]"); if (rc) { pull(); C.cla.splice(+rc.dataset.rmcl, 1); draw(); return; }
    if (e.target.closest("[data-adddir]")) {
      pull(); const used = new Set(achCmf().flatMap(c => (c.lignes || []).map(l => l.bsn)).filter(Boolean)), B = achBsn().filter(b => b.direct && !used.has(b.id) && b.state === "valide");
      if (!B.length) { svToast("AUCUN BESOIN EN ACHAT DIRECT À COMMANDER.", 3000); return; }
      const pick = await achPickWin("BESOINS EN ACHAT DIRECT", B.map(b => ({ v: b.id, lab: b.ref + " — " + b.des + " (" + achF2(b.q) + " " + b.u + ")" })));
      B.filter(b => pick.includes(b.id)).forEach(b => C.lignes.push({ id: achLid(), des: b.des, u: b.u, q: achN(b.q), pu: achN(b.pu), tva: achPrm().tva, bsn: b.id, dvf: "" })); draw(); return;
    }
    if (e.target.closest("[data-cancel]")) { const m = await achAsk("ANNULER LA COMMANDE " + C.ref + " (GARDÉE)", "MOTIF DE L'ANNULATION"); if (!m) return; C.state = "annule"; C.motifAnn = m; store("ANNULÉE — " + m); d.remove(); if (done) done(); return; }
    /* v815 : DUPLIQUER (C6.9), WHATSAPP préformaté (C6.64), SUSPENDRE / REPRENDRE (C6.71), LITIGE (C6.77) */
    if (e.target.closest("[data-dup]")) { const n = achCmfFrom({ frs: C.frs, lignes: C.lignes.map(l => ({ des: l.des, u: l.u, q: l.q, pu: l.pu, tva: l.tva })), why: "DUPLIQUÉE DE " + C.ref });
      const L = achCmf(), x = L.find(y => y.id === n.id); if (x) { Object.assign(x, { nat: C.nat, lieu: C.lieu, cond: C.cond, transp: C.transp, frais: C.frais, rem: C.rem, acces: C.acces || "", respRec: C.respRec || "", ctFrs: C.ctFrs || "", marche: C.marche || "" }); achCmfSave(L); }
      d.remove(); if (done) done(); achCmfFiche(n.id, done); return; }
    if (e.target.closest("[data-wa]")) { const t = achCmfTot(C), txt = "BON DE COMMANDE " + C.ref + " — " + achFrsNom(C.frs) + "\n" + C.lignes.map(l => "- " + l.des + " : " + achF2(l.q) + " " + l.u + " × " + achF2(l.pu) + " HT").join("\n")
        + "\nTOTAL : " + achF2(t.ttc) + " TTC" + (C.dProm ? "\nLIVRAISON : " + achDFr(C.dProm) : "") + (C.lieu ? "\nLIEU : " + C.lieu : "") + "\nMERCI DE RAPPELER LE N° " + C.ref + " SUR LE BON DE LIVRAISON ET LA FACTURE.";
      window.open("https://wa.me/?text=" + encodeURIComponent(txt), "_blank"); return; }
    if (e.target.closest("[data-susp]")) { const m = await achAsk("SUSPENDRE LA COMMANDE " + C.ref, "MOTIF (CHANTIER ARRÊTÉ…)"); if (!m) return; C.susp = { t: achNow(), why: m }; store("SUSPENDUE — " + m); draw(); return; }
    if (e.target.closest("[data-repr]")) { delete C.susp; store("REPRISE"); draw(); return; }
    if (e.target.closest("[data-lit]")) { const m = await achAsk("COMMANDE EN LITIGE " + C.ref, "MOTIF DU LITIGE"); if (!m) return; C.litige = { t: achNow(), why: m }; store("LITIGE — " + m); draw(); return; }
    if (e.target.closest("[data-litok]")) { const m = await achAsk("LEVER LE LITIGE " + C.ref, "RÉSOLUTION"); if (!m) return; delete C.litige; store("LITIGE LEVÉ — " + m); draw(); return; }
    if (e.target.closest("[data-save2]")) { pull(); store("DATE CONFIRMÉE / RÉGULARISATION"); draw(); return; }
    if (e.target.closest("[data-av]")) { const m = await achAsk("AVENANT À LA COMMANDE", "MOTIF DE L'AVENANT"); if (!m) return; C.__avM = m; C.__avHt = achCmfTot(C).ht; edAv = true; draw(); return; }
    if (e.target.closest("[data-save]")) {
      pull(); if (!check()) return;
      if (edAv) { const R = achRcp(), T = achRtr(); if (C.lignes.some(l => achN(l.q) + 1e-9 < achRecQ(C.id, l.id, R, T) + achCanQ(C.id, l.id, T))) { svToast("UNE QUANTITÉ NE PEUT PAS DESCENDRE SOUS LE DÉJÀ REÇU.", 3500); return; }
        C.av = (C.av || 0) + 1; C.avH = (C.avH || []).concat({ n: C.av, t: achNow(), motif: C.__avM, ht: C.__avHt }); delete C.__avM; delete C.__avHt; edAv = false; store("AVENANT " + C.av); draw(); return; }
      store("MODIFICATION"); draw(); return; }
    /* B25, B45 : circuit de validation */
    if (e.target.closest("[data-circ]")) { pull(); if (!check()) return; const S = achCmfSeu(C); if (!S) { draw(); return; }
      { const no = achDirCmfCheck(C) || achCmfValNo(C); if (no) { svToast(no + ".", 5500); return; } }
      if (!(await svConfirm({ title: "ENVOYER EN VALIDATION", text: C.ref + " : " + achF2(achCmfTot(C).ht) + " HT, AU-DELÀ DE " + achF2(S.mt) + " HT — VALIDATION PAR " + S.g.map(achGradeLab).join(S.h ? " PUIS " : " OU ") + ". LA COMMANDE EST VERROUILLÉE PENDANT LE CIRCUIT.", ok: "ENVOYER", tone: "neutral" }))) return;
      C.circ = { ...S, ok: [], t: achNow() }; store("ENVOYÉE EN VALIDATION"); draw(); return; }
    const ca = e.target.closest("[data-cacc]"), cr = e.target.closest("[data-cret]");
    if (ca || cr) { const g = (ca || cr).dataset.cacc || (ca || cr).dataset.cret; if (!achCircNext(C).includes(g)) { svToast("CE GRADE NE PEUT PAS VALIDER MAINTENANT (HIÉRARCHIE).", 3500); return; }
      if (cr) { const m = await achAsk("RENVOYER " + C.ref + " AU GRADE INFÉRIEUR", "REMARQUES (" + achGradeLab(g) + ")"); if (!m) return; C.renv = (C.renv || []).concat([{ g, u: sviUser(), t: achNow(), why: m }]); C.circ = null; store("RENVOYÉE PAR GRADE " + g + " : " + m); draw(); return; }
      C.circ.ok = (C.circ.ok || []).concat([{ g, u: sviUser(), t: achNow() }]); store("ACCEPTÉE PAR GRADE " + g); draw();
      if (achCircDone(C)) setTimeout(() => { const v = d.querySelector("[data-valid]"); if (v) v.click(); }, 0); return; }
    if (e.target.closest("[data-valid]")) { pull(); if (!check()) return;
      if (achCmfSeu(C) && !achCircDone(C)) { svToast("AU-DELÀ DU SEUIL DE VALIDATION : ENVOYER EN VALIDATION.", 3500); return; }
      { const no = achDirCmfCheck(C) || achCmfValNo(C); if (no) { svToast(no + ".", 5500); return; } }
      if (await achFrsStop(achFrs().find(f => f.id === C.frs), "VALIDER LA COMMANDE " + C.ref)) return;
      if (await achArtStop(C.lignes, "VALIDER LA COMMANDE " + C.ref)) return;
      if (!(await svConfirm({ title: "VALIDER LA COMMANDE", text: C.ref + " : " + achF2(achCmfTot(C).ttc) + " TTC (" + frMoney(achCmfTot(C).ttc) + "). LE MONTANT EST ENGAGÉ SUR LE BUDGET DES BESOINS.", ok: "VALIDER", tone: "neutral" }))) return;
      C.state = "valide"; C.valide = achNow(); store("VALIDÉE"); draw(); return; }
    if (e.target.closest("[data-fac]")) { achFafFiche(null, { cmf: C.id }, () => draw()); return; }
    if (e.target.closest("[data-avpay]")) { pull(); store("MODIFICATION"); achPafFiche(null, { type: "avance", cmf: C.id }, () => draw()); return; }
    if (e.target.closest("[data-rcp]")) { pull(); store("MODIFICATION"); achRcpFiche(null, C.id, () => draw()); return; }
    if (e.target.closest("[data-rtc]") || e.target.closest("[data-solde]")) {
      const solde = !!e.target.closest("[data-solde]"), R = achRcp(), T = achRtr(), lines = C.lignes.map(l => ({ cl: l.id, des: l.des, u: l.u, max: achResteQ(C, l, R, T) })).filter(l => l.max > 1e-9);
      if (solde && !lines.length) { C.state = "solde"; C.solde = achNow(); store("SOLDÉE"); d.remove(); if (done) done(); return; }
      if (!lines.length) { svToast("PLUS RIEN À RECEVOIR SUR CETTE COMMANDE.", 3000); return; }
      const r = await achQtyWin(solde ? "SOLDER LA COMMANDE — RESTE ANNULÉ CHEZ LE FOURNISSEUR" : "RETOUR DE COMMANDE — QUANTITÉS ANNULÉES", lines, { full: solde, motif: solde ? "COMMANDE SOLDÉE" : "", ok: solde ? "SOLDER" : "ENREGISTRER" });
      if (!r) return;
      if (solde && r.lignes.length < lines.length) { svToast("SOLDER : TOUT LE RESTE EST ANNULÉ.", 3000); return; }
      achRtrAdd({ kind: "cmd", cmf: C.id, frs: C.frs, lignes: r.lignes, motif: r.motif });
      if (solde) { C.state = "solde"; C.solde = achNow(); store("SOLDÉE — " + r.motif); d.remove(); if (done) done(); return; }
      store("RETOUR DE COMMANDE — " + r.motif); draw(); return;
    }
  });
}
/* petite question au format de l'application : rend le texte saisi (en majuscules) ou "" */
function achAsk(title, lab) {
  return new Promise(ok => { const d = sviWinNew();
    d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: esc(title), body: `<label class="frs-f frs-w"><span>${esc(lab)} <b>*</b></span><input class="ins-in ask-v" autocomplete="off"></label>`,
      foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>CONTINUER</button>` });
    sviWinShow(d); setTimeout(() => d.querySelector(".ask-v")?.focus(), 50);
    d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) { d.remove(); ok(""); return; }
      if (e.target.closest("[data-ok]")) { const v = achU(d.querySelector(".ask-v").value); if (!v) { svToast("À REMPLIR.", 2500); return; } d.remove(); ok(v); } }); });
}

/* ---------- FICHE RÉCEPTION ---------- */
function achRcpFiche(id, cmfId, done) {
  const r0 = id ? achRcp().find(x => x.id === id) : null; if (id && !r0) return;
  const C = cmfId ? achCmf().find(c => c.id === cmfId) : r0 && r0.cmf ? achCmf().find(c => c.id === r0.cmf) : null;
  const tol = achPrm().tol, R0 = achRcp(), T0 = achRtr();
  const P = r0 ? JSON.parse(JSON.stringify(r0)) : { id: "", ref: "", cmf: C ? C.id : "", frs: C ? C.frs : "", nbl: "", transp: "", chauf: "", immat: "", hArr: "", hDep: "", fraisAtt: "", note: "", docsExig: !!(C && C.cond && /CERTIFICAT|FICHE TECHNIQUE|PV|ESSAI/.test(C.cond)), docsOk: false, pv: !!C && C.nat === "PRESTATIONS ET HONORAIRES", date: achNow(), photo: "", state: "valide",
    lignes: C ? C.lignes.map(l => ({ cl: l.id, des: l.des, u: l.u, max: achResteQ(C, l, R0, T0), q: Math.round(achResteQ(C, l, R0, T0) * 1000) / 1000, st: "ok", motif: "", bon: "" })).filter(l => l.max > 1e-9) : [] };
  const ro = !!r0, d = sviWinNew();
  let photoBlob = null;
  const draw = () => {
    const why = r0 ? achRcpWhy(P) : [], dis = ro ? " disabled" : "", FR = achLive(achFrs()).filter(f => f.actif !== false || f.id === P.frs);
    const sel = (i, v) => `<select class="ins-in rcp-l" data-c="st" data-i="${i}"${dis}>${[["ok", "ACCEPTÉE"], ["res", "AVEC RÉSERVES"], ["att", "EN ATTENTE D'ESSAI"], ["ref", "REFUSÉE"]].map(([k, l]) => `<option value="${k}"${v === k ? " selected" : ""}>${l}</option>`).join("")}</select>`;
    d.innerHTML = sviWinCard({ cls: "frs-card rcp-card", close: "data-x", title: (r0 ? "RÉCEPTION — " + esc(P.ref) : P.pv ? "PROCÈS-VERBAL DE SERVICE FAIT" : "NOUVELLE RÉCEPTION") + (C ? " · " + esc(C.ref) : " · SANS COMMANDE"),
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}</div>` : ""}<div class="frs-scroll">
        <div class="frs-sec"><div class="frs-g">
          <label class="frs-f frs-w"><span>FOURNISSEUR <b>*</b></span><select class="ins-in rcp-x" data-k="frs"${dis || (C ? " disabled" : "")}><option value=""></option>${FR.map(f => `<option value="${esc(f.id)}"${f.id === P.frs ? " selected" : ""}>${esc(f.code + " — " + f.nom)}</option>`).join("")}</select></label>
          <label class="frs-f"><span>${P.pv ? "N° DU PV" : "N° DU BON DE LIVRAISON"}${P.pv ? "" : " <b>*</b>"}</span><input class="ins-in rcp-x" data-k="nbl" value="${esc(P.nbl)}"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>REÇU LE (DATE ET HEURE)</span><input class="ins-in" value="${esc(svDT(P.date))}" readonly></label>
          <label class="frs-f"><span>TRANSPORTEUR</span><input class="ins-in rcp-x" data-k="transp" value="${esc(P.transp || "")}"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>CHAUFFEUR</span><input class="ins-in rcp-x" data-k="chauf" value="${esc(P.chauf || "")}"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>IMMATRICULATION</span><input class="ins-in rcp-x" data-k="immat" value="${esc(P.immat || "")}"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>ARRIVÉE DU CAMION</span><input type="time" class="ins-in rcp-x" data-k="hArr" value="${esc(P.hArr || "")}"${dis}></label>
          <label class="frs-f"><span>DÉPART DU CAMION</span><input type="time" class="ins-in rcp-x" data-k="hDep" value="${esc(P.hDep || "")}"${dis}></label>
          <label class="frs-f"><span>FRAIS D'ATTENTE OU DE DÉCHARGEMENT HT</span><input class="ins-in rcp-x" data-k="fraisAtt" inputmode="decimal" value="${esc(P.fraisAtt ? achF2(P.fraisAtt) : "")}"${dis} autocomplete="off"></label>
          <label class="frs-f frs-w"><span>NOTE DU RÉCEPTIONNAIRE</span><input class="ins-in rcp-x" data-k="note" value="${esc(P.note || "")}"${dis} autocomplete="off"></label>
          <div class="frs-cs"><label class="frs-c"><input type="checkbox" class="rcp-c" data-k="docsExig"${P.docsExig ? " checked" : ""}${dis}> DOCUMENTS EXIGÉS (CERTIFICAT, FICHE TECHNIQUE, BON D'ESSAI)</label><label class="frs-c"><input type="checkbox" class="rcp-c" data-k="docsOk"${P.docsOk ? " checked" : ""}${P.state === "annule" ? " disabled" : ""}> DOCUMENTS REÇUS</label></div>
          <label class="frs-f frs-w"><span>PHOTO DU BON</span>${ro ? (P.photo ? `<button type="button" class="ach-b" data-photo>VOIR LA PHOTO</button>` : `<span class="ach-0">AUCUNE</span>`) : `<input type="file" class="rcp-ph" accept="image/*" capture="environment">`}</label></div></div>
        <div class="frs-sec"><div class="frs-st">LIGNES ${svCnt(P.lignes.length)} ${C ? `<small>(TOLÉRANCE ${esc(String(tol).replace(".", ","))} % AU-DESSUS DU RESTE)</small>` : ""}</div>
          <table class="prm-table frs-sub"><thead><tr><th>DÉSIGNATION</th><th>U</th>${C && !ro ? `<th class="number">RESTE</th>` : ""}<th class="number">QTÉ SUR LE BL</th><th class="number">QUANTITÉ COMPTÉE</th><th>RÉSULTAT</th><th>PÉREMPTION</th><th>MOTIF (RÉSERVE, REFUS)</th><th>N° DE BON (BÉTON, CAMION)</th>${C || ro ? "" : "<th></th>"}</tr></thead><tbody>
          ${P.lignes.map((l, i) => `<tr data-i="${i}"><td>${C || ro ? esc(l.des) : `<input class="ins-in rcp-l" data-c="des" data-i="${i}" value="${esc(l.des)}">`}</td><td>${C || ro ? esc(l.u) : `<input class="ins-in rcp-l" data-c="u" data-i="${i}" value="${esc(l.u)}">`}</td>
            ${C && !ro ? `<td class="number">${esc(achF2(l.max))}</td>` : ""}<td><input class="ins-in rcp-l number" data-c="qbl" data-i="${i}" inputmode="decimal" value="${esc(String(l.qbl ?? "").replace(".", ","))}"${dis}></td><td><input class="ins-in rcp-l number" data-c="q" data-i="${i}" inputmode="decimal" value="${esc(String(l.q ?? "").replace(".", ","))}"${dis}></td><td>${sel(i, l.st)}</td>
            <td><input type="date" class="ins-in rcp-l" data-c="per" data-i="${i}" value="${esc(l.per || "")}"${dis}></td>
            <td><input class="ins-in rcp-l" data-c="motif" data-i="${i}" value="${esc(l.motif)}"${dis} autocomplete="off"></td><td><input class="ins-in rcp-l" data-c="bon" data-i="${i}" value="${esc(l.bon)}"${dis} autocomplete="off"></td>
            ${C || ro ? "" : `<td class="center"><button type="button" class="ach-x" data-rml="${i}">✕</button></td>`}</tr>`).join("") || `<tr><td colspan="10" class="empty">AUCUNE LIGNE (TOUT EST REÇU)</td></tr>`}</tbody></table>
          ${C || ro ? "" : `<button type="button" class="ach-b" data-addl>+ LIGNE</button>`}
          ${P.resLev ? `<div class="bsn-deb">RÉSERVES LEVÉES LE ${esc(svDT(P.resLev))}.</div>` : ""}</div>
</div>`,
      foot: `<button type="button" class="svc-b" data-x>${ro ? "FERMER" : "ANNULER"}</button>
        ${ro && P.state !== "annule" && P.lignes.some(l => l.st === "res" || l.st === "att") && !P.resLev ? `<button type="button" class="svc-b svc-ok svc-neutral" data-lev>LEVER LES RÉSERVES / ESSAI CONFORME</button>` : ""}
        ${ro && P.state !== "annule" && !achRcpFacturee(P) ? `<button type="button" class="svc-b" data-rcpann>ANNULER LA RÉCEPTION</button>` : ""}
        ${ro && P.state !== "annule" && P.docsExig && !P.docsOk ? `<button type="button" class="svc-b" data-docok>DOCUMENTS REÇUS</button>` : ""}
        ${ro && P.state !== "annule" && P.cmf ? `<button type="button" class="svc-b" data-ret>RETOURNER</button>` : ""}
        ${!ro ? `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER LA RÉCEPTION</button>` : ""}` });
    if (!d.isConnected) sviWinShow(d);
  };
  const pull = () => { d.querySelectorAll(".rcp-x").forEach(i => { if (i.disabled) return; const k = i.dataset.k; P[k] = ["frs", "hArr", "hDep"].includes(k) ? i.value : k === "fraisAtt" ? (String(i.value).trim() === "" ? "" : achN(i.value)) : achU(i.value); });
    d.querySelectorAll(".rcp-c").forEach(i => { if (!i.disabled) P[i.dataset.k] = i.checked; });
    d.querySelectorAll(".rcp-l").forEach(i => { const l = P.lignes[+i.dataset.i]; if (!l || i.disabled) return; const c = i.dataset.c; l[c] = c === "q" ? achN(i.value) : c === "qbl" ? (String(i.value).trim() === "" ? "" : achN(i.value)) : c === "st" || c === "per" ? i.value : achU(i.value); }); };
  draw();
  d.addEventListener("change", e => {
    const ph = e.target.closest(".rcp-ph"); if (ph) { photoBlob = ph.files && ph.files[0] || null; return; }
    if (e.target.closest(".rcp-l[data-c=st]")) { pull(); draw(); }
  });
  d.addEventListener("click", async e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (done) done(); return; }
    if (e.target.closest("[data-photo]")) { try { const b = await sviFiles.get(P.photo); if (b) window.open(URL.createObjectURL(b), "_blank"); } catch (err) {} return; }
    if (e.target.closest("[data-addl]")) { pull(); P.lignes.push({ cl: "", des: "", u: "", q: "", st: "ok", motif: "", bon: "" }); draw(); return; }
    const rl = e.target.closest("[data-rml]"); if (rl) { pull(); P.lignes.splice(+rl.dataset.rml, 1); draw(); return; }
    const L = achRcp(), cur = r0 ? L.find(x => x.id === r0.id) : null;
    /* v816 : annulation avec motif tant qu'aucune facture n'existe (C7.63, C7.65) ; documents reçus ensuite (C7.24) */
    if (e.target.closest("[data-rcpann]")) { if (!cur) return; if (achRcpFacturee(cur)) { svToast("RÉCEPTION FACTURÉE : CORRIGER PAR UN AVOIR OU UNE RÉGULARISATION.", 4000); return; }
      const m = await achAsk("ANNULER LA RÉCEPTION " + cur.ref, "MOTIF DE L'ANNULATION"); if (!m) return; cur.state = "annule"; cur.motifAnn = m; cur.mod = achNow(); achRcpSave(L); achHist(cur.ref, "ANNULÉE — " + m, ""); d.remove(); if (done) done(); return; }
    if (e.target.closest("[data-docok]")) { if (!cur) return; cur.docsOk = true; cur.mod = achNow(); achRcpSave(L); achHist(cur.ref, "DOCUMENTS EXIGÉS REÇUS", ""); d.remove(); if (done) done(); return; }
    if (e.target.closest("[data-lev]")) { if (!cur) return; cur.resLev = achNow(); cur.lignes.forEach(l => { if (l.st === "res" || l.st === "att") l.st = "ok"; }); achRcpSave(L); achHist(cur.ref, "RÉSERVES LEVÉES", ""); d.remove(); if (done) done(); return; }
    if (e.target.closest("[data-ret]")) {
      if (!cur) return; const T = achRtr(), lines = cur.lignes.filter(l => l.st !== "ref").map(l => { const done0 = T.filter(x => x.kind === "rcp" && x.rcp === cur.id && x.after).reduce((t, x) => t + (x.lignes || []).filter(y => y.cl === l.cl).reduce((u, y) => u + achN(y.q), 0), 0); return { cl: l.cl, des: l.des, u: l.u, max: achN(l.q) - done0 }; }).filter(l => l.max > 1e-9);
      if (!lines.length) { svToast("RIEN À RETOURNER.", 3000); return; }
      const r = await achQtyWin("RETOUR DE RÉCEPTION — QUANTITÉS RENDUES AU FOURNISSEUR", lines, { chauffeur: true, ok: "RETOURNER" }); if (!r) return;
      achRtrAdd({ kind: "rcp", rcp: cur.id, cmf: cur.cmf, frs: cur.frs, lignes: r.lignes, motif: r.motif, chauffeur: r.chauffeur, after: true }); achHist(cur.ref, "RETOUR", r.motif); d.remove(); if (done) done(); return;
    }
    if (!e.target.closest("[data-save]")) return;
    pull();
    if (!P.frs) { svToast("FOURNISSEUR OBLIGATOIRE.", 3000); return; }
    if (await achFrsStop(achFrs().find(f => f.id === P.frs), "ENREGISTRER UNE RÉCEPTION")) return;
    if (!P.pv && !P.nbl) { svToast("N° DU BON DE LIVRAISON OBLIGATOIRE.", 3000); return; }
    P.lignes = P.lignes.filter(l => achN(l.q) > 0);
    if (!P.lignes.length) { svToast("AUCUNE QUANTITÉ REÇUE.", 3000); draw(); return; }
    if (P.lignes.some(l => !achU(l.des))) { svToast("CHAQUE LIGNE : DÉSIGNATION.", 3000); return; }
    if (C && P.lignes.some(l => achN(l.q) > l.max * (1 + tol / 100) + 1e-9)) { svToast("QUANTITÉ AU-DELÀ DU RESTE + TOLÉRANCE (" + tol + " %) : À REFUSER OU À COMMANDER PAR AVENANT.", 4500); return; }
    if (P.lignes.some(l => l.per && l.per < new Date().toISOString().slice(0, 10) && l.st !== "ref")) { svToast("PRODUIT PÉRIMÉ : À REFUSER.", 3500); return; }
    if (P.lignes.some(l => (l.st === "res" || l.st === "ref" || l.st === "att") && !l.motif)) { svToast("MOTIF OBLIGATOIRE POUR UNE RÉSERVE OU UN REFUS.", 3500); return; }
    let chauffeur = "";
    if (P.lignes.some(l => l.st === "ref")) { chauffeur = await achAsk("REFUS REMIS AU CHAUFFEUR", "NOM DU CHAUFFEUR"); if (!chauffeur) return; }
    const now = achNow(), r = { ...JSON.parse(JSON.stringify(P)), id: "R" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ref: achNextRef("RCP", L), date: now, cree: now };
    r.lignes.forEach(l => { delete l.max; });
    if (photoBlob) { try { const k = "ach:bl:" + r.id; await sviFiles.put(k, photoBlob); r.photo = k; } catch (err) {} }
    L.push(r); achRcpSave(L); achHist(r.ref, "CRÉATION", (C ? C.ref : "SANS COMMANDE") + " — BL " + (r.nbl || "PV"));
    const ref = r.lignes.filter(l => l.st === "ref");
    if (ref.length) achRtrAdd({ kind: "rcp", rcp: r.id, cmf: r.cmf, frs: r.frs, lignes: ref.map(l => ({ cl: l.cl, des: l.des, u: l.u, q: achN(l.q) })), motif: ref.map(l => l.motif).join(" · "), chauffeur });
    /* demandeurs avertis : noté sur leur besoin */
    if (C) { const B = achBsn(), who = new Set(); C.lignes.forEach(l => { if (!r.lignes.some(x => x.cl === l.id && x.st !== "ref")) return; const b = B.find(x => x.id === l.bsn); if (!b) return; b.livre = now; who.add(b.dem || "?"); achHist(b.ref, "LIVRÉ", r.ref + " — " + achFrsNom(r.frs)); });
      achBsnSave(B); if (who.size) svToast("RÉCEPTION " + r.ref + " ENREGISTRÉE — DEMANDEUR(S) AVERTI(S) : " + [...who].join(", ") + ".", 4000); }
    d.remove(); if (done) done();
  });
}
/* ⟪ src/46-achats-factures.js ⟫ */
/* =========================================================
   v763 : FACTURES, AVOIRS, PAIEMENTS (étape 5) — onglets de l'écran des achats (menu ☰ › ACHAT)
   Tableaux : achListMod (44) ; fiches ci-dessous ; règles : 40-achats-donnees.js (achFafTot, achFafWhy, achPafWhy…).
   ========================================================= */
const ACH_FAF_ST = { instance: "EN INSTANCE", reclame: "RÉCLAMÉE", bap: "BON À PAYER", annule: "ANNULÉE" };
const ACH_PAF_ST = { instance: "EN INSTANCE", emis: "ÉMIS", encaisse: "ENCAISSÉ", rejete: "REJETÉ", annule: "ANNULÉ" };
const achFafEtat = f => f.state === "bap" && achFafReste(f) <= 0.005 ? "PAYÉE" : f.state === "bap" && achFafPaid(f.id) > 0 ? "PAYÉE EN PARTIE" : ACH_FAF_ST[f.state] || "";
const achId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
function achFafMod(ctx) {
  return achListMod(ctx, { k: "faf", t: "ach_faf", id: "achFafT", list: achFaf, name: "FACTURES", save: achFafSave, info: achFafInfo, inst: f => f.state === "instance" || f.state === "reclame", etatKey: "svi_ach_faf_etat_v1", newLab: "NOUVELLE FACTURE", newRow: "CRÉER UNE FACTURE ICI… (OU DEPUIS LA COMMANDE : FACTURER)", open: (id, done) => achFafFiche(id, null, done),
    etats: [["actif", "À PAYER"], ["instance", "EN INSTANCE"], ["reclame", "RÉCLAMÉES"], ["bap", "BON À PAYER"], ["payee", "PAYÉES"], ["alerte", "ALERTE"], ["annule", "ANNULÉES"], ["tout", "TOUT"]],
    ok: (f, k, L) => k === "tout" ? true : k === "alerte" ? achFafWhy(f, L).length > 0 : k === "payee" ? f.state === "bap" && achFafReste(f) <= 0.005 : k === "actif" ? f.state !== "annule" && achFafReste(f) > 0.005 : f.state === k,
    why: (f, L) => achFafWhy(f, L),
    w: { ref: 150, num: 130, frs: 220, cmf: 150, dfac: 110, ech: 110, ttc: 130, reste: 130, etat: 140 },
    cols: () => [["ref", "RÉFÉRENCE", f => f.ref, ""], ["num", "N° FACTURE", f => f.num || "", ""], ["frs", "FOURNISSEUR", f => f.frs ? achFrsNom(f.frs) : "", ""],
      ["cmf", "COMMANDE", f => f.type === "acompte" ? "ACOMPTE" : ((achCmf().find(c => c.id === f.cmf) || {}).ref) || "SANS COMMANDE", ""], ["dfac", "DATE", f => achDFr(f.dFac), ""], ["ech", "ÉCHÉANCE", f => achDFr(achFafEch(f)), ""],
      ["ttc", "MONTANT TTC", f => achFafTot(f).ttc, "number"], ["reste", "RESTE À PAYER", f => f.state === "annule" ? "" : achFafReste(f), "number"], ["etat", "ÉTAT", f => achFafEtat(f), "center"]] });
}
function achAvfMod(ctx) {
  return achListMod(ctx, { k: "avf", t: "ach_avf", id: "achAvfT", list: achAvf, name: "AVOIRS", etatKey: "svi_ach_avf_etat_v1", newLab: "NOUVEL AVOIR", newRow: "CRÉER UN AVOIR ICI…", open: achAvfFiche,
    etats: [["actif", "À DÉDUIRE"], ["tout", "TOUT"], ["annule", "ANNULÉS"]],
    ok: (a, k) => k === "tout" ? true : k === "annule" ? a.state === "annule" : a.state !== "annule" && achAvfReste(a) > 0.005, why: () => [],
    w: { ref: 150, num: 130, frs: 220, fa: 150, date: 110, ttc: 130, reste: 130, motif: 220 },
    cols: () => [["ref", "RÉFÉRENCE", a => a.ref, ""], ["num", "N° AVOIR", a => a.num || "", ""], ["frs", "FOURNISSEUR", a => a.frs ? achFrsNom(a.frs) : "", ""], ["fa", "FACTURE", a => ((achFaf().find(f => f.id === a.fa) || {}).ref) || "", ""],
      ["date", "DATE", a => achDFr(a.date), ""], ["ttc", "MONTANT TTC", a => -achN(a.ttc), "number"],   /* B37 : avoir = facture de montant négatif */ ["reste", "RESTE À DÉDUIRE", a => a.state === "annule" ? "" : achAvfReste(a), "number"], ["motif", "MOTIF", a => a.motif || "", ""]] });
}
function achPafMod(ctx) {
  return achListMod(ctx, { k: "paf", t: "ach_paf", id: "achPafT", list: achPaf, name: "PAIEMENTS", save: achPafSave, inst: p => p.state === "instance", etatKey: "svi_ach_paf_etat_v1", newLab: "NOUVEAU PAIEMENT", newRow: "CRÉER UN PAIEMENT ICI… (OU DEPUIS LA FACTURE : PAYER)", open: (id, done) => achPafFiche(id, null, done),
    etats: [["actif", "EN COURS"], ["instance", "EN INSTANCE"], ["emis", "ÉMIS (NON ENCAISSÉS)"], ["encaisse", "ENCAISSÉS"], ["avance", "AVANCES"], ["alerte", "ALERTE"], ["rejete", "REJETÉS / ANNULÉS"], ["tout", "TOUT"]],
    ok: (p, k, L) => k === "tout" ? true : k === "alerte" ? achPafWhy(p, L).length > 0 : k === "avance" ? p.type === "avance" && p.state !== "annule" && p.state !== "rejete" : k === "rejete" ? p.state === "rejete" || p.state === "annule" : k === "actif" ? p.state === "instance" || p.state === "emis" : p.state === k,
    why: (p, L) => achPafWhy(p, L),
    w: { ref: 150, type: 110, frs: 220, mode: 110, num: 120, date: 110, mt: 130, objet: 240, etat: 110 },
    cols: () => [["ref", "RÉFÉRENCE", p => p.ref, ""], ["type", "TYPE", p => p.type === "avance" ? "AVANCE" : "RÈGLEMENT", "center"], ["frs", "FOURNISSEUR", p => p.frs ? achFrsNom(p.frs) : "", ""],
      ["mode", "MODE", p => p.mode || "", "center"], ["num", "N°", p => p.num || "", ""], ["date", "DATE", p => achDFr(p.date), ""], ["mt", "MONTANT", p => achN(p.mt), "number"],
      ["objet", "OBJET", p => p.type === "avance" ? ((achCmf().find(c => c.id === p.cmf) || {}).ref || "") : (p.aff || []).map(a => (achFaf().find(f => f.id === a.fa) || {}).ref || "").filter(Boolean).join(" · "), ""], ["etat", "ÉTAT", p => ACH_PAF_ST[p.state] || "", "center"]] });
}
/* copie d'une pièce (facture, avoir) : IndexedDB, clé ach:<k>:<id> */
const achCopyBtn = (P, ro) => ro || P.copie ? (P.copie ? `<button type="button" class="ach-b" data-copy>VOIR LA COPIE</button>${ro ? "" : ` <input type="file" class="fa-cp" accept="image/*,application/pdf">`}` : `<span class="ach-0">AUCUNE</span>`) : `<input type="file" class="fa-cp" accept="image/*,application/pdf" capture="environment">`;
const achCopyOpen = async k => { try { const b = await sviFiles.get(k); if (b) window.open(URL.createObjectURL(b), "_blank"); } catch (e) {} };

/* ---------- FICHE FACTURE ---------- */
/* v817 : i de la facture (C8.88) — seulement les informations de la facture elle-même ; la saisie complète reste dans la fiche */
function achFafInfo(id, done) {
  const f = achFaf().find(x => x.id === id); if (!f) return; const d = sviWinNew(), C = achCmf().find(c => c.id === f.cmf);
  const row = (l, v) => `<label class="frs-f"><span>${l}</span><input class="ins-in" value="${esc(v || "—")}" readonly></label>`;
  d.innerHTML = sviWinCard({ cls: "frs-card faf-info", close: "data-x", title: "FACTURE — " + esc(f.ref) + " · " + esc(achFafEtat(f)),
    body: `<div class="frs-scroll"><div class="frs-sec"><div class="frs-g">${row("N° DE LA FACTURE", f.num)}${row("TYPE", { normale: "FACTURE", acompte: "ACOMPTE" }[f.type] || String(f.type || "").toUpperCase())}
      ${row("ÉMISE LE", achDFr(f.dFac))}${row("REÇUE LE", achDFr(f.dRec))}${row("ÉCHÉANCE", achDFr(achFafEch(f)))}${row("COMMANDE", C ? C.ref : f.type === "acompte" ? "ACOMPTE" : "SANS COMMANDE")}
      ${row("FOURNISSEUR", f.frs ? achFrsNom(f.frs) : "")}${row("MONTANT TTC", achF2(achFafTot(f).ttc))}${row("RESTE À PAYER", f.state === "annule" ? "" : achF2(achFafReste(f)))}
      ${f.motifAnn ? row("MOTIF DE L'ANNULATION", f.motifAnn) : ""}<label class="frs-f"><span>COPIE</span>${f.copie ? `<button type="button" class="ach-b" data-copy>VOIR LA COPIE</button>` : `<input class="ins-in" value="AUCUNE" readonly>`}</label></div></div></div>`,
    foot: `<button type="button" class="svc-b" data-x>FERMER</button><button type="button" class="svc-b svc-ok svc-neutral" data-full>OUVRIR LA FICHE COMPLÈTE</button>` });
  sviWinShow(d);
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (done) done(); return; }
    if (e.target.closest("[data-copy]")) { achCopyOpen(f.copie); return; }
    if (e.target.closest("[data-full]")) { d.remove(); achFafFiche(id, {}, done); } });
}
function achFafFiche(id, o, done) {
  o = o || {};
  const f0 = id ? achFaf().find(x => x.id === id) : null; if (id && !f0) return;
  const cmfLines = (c, fid) => { const R = achRcp(), T = achRtr(), F = achFaf();
    return (c.lignes || []).map(l => ({ cl: l.id, des: l.des, u: l.u, pu: achN(l.pu), tva: l.tva, q: Math.max(0, Math.round((achRecQ(c.id, l.id, R, T) - achFacQ(c.id, l.id, fid, F)) * 1000) / 1000) })).filter(l => l.q > 1e-9); };
  const C0 = o.cmf ? achCmf().find(c => c.id === o.cmf) : null;
  const P = f0 ? JSON.parse(JSON.stringify(f0)) : { id: achId("F"), ref: "", frs: C0 ? C0.frs : "", cmf: C0 ? C0.id : "", type: "normale", num: "", dFac: "", dRec: new Date().toISOString().slice(0, 10), ech: "", sTtc: "", sTva: "",
    ras: false, rasT: achPrm().rasT, avImp: C0 ? achAvReste(C0.id, null) : 0, rem: C0 ? achN(C0.rem) : 0, frais: C0 && !achFaf().some(x => x.cmf === C0.id && x.state !== "annule" && achN(x.frais)) ? achN(C0.frais) : 0,
    lignes: C0 ? cmfLines(C0, "") : [], state: "instance", copie: "" };
  const d = sviWinNew(); let cpBlob = null;
  const draw = () => {
    const ro = !!f0 && (P.state === "annule" || P.state === "bap"), dis = ro ? " disabled" : "", C = P.cmf ? achCmf().find(c => c.id === P.cmf) : null;
    const t = achFafTot(P), why = f0 ? achFafWhy(P) : [], paid = f0 ? achFafPaid(P.id) : 0, PL = achPaf().filter(p => (p.aff || []).some(a => a.fa === P.id));
    const FR = achLive(achFrs()).filter(f => f.actif !== false || f.id === P.frs), CM = achCmf().filter(c => c.frs === P.frs && (c.state === "valide" || c.state === "solde"));
    const opt = (L, v) => L.map(x => `<option value="${esc(x[0])}"${x[0] === v ? " selected" : ""}>${esc(x[1])}</option>`).join("");
    const num = v => esc(v === "" || v === undefined ? "" : achF2(v));
    d.innerHTML = sviWinCard({ cls: "frs-card faf-card", close: "data-x", title: (f0 ? "FACTURE — " + esc(P.ref) : "NOUVELLE FACTURE") + " · " + esc(f0 ? achFafEtat(P) : "EN INSTANCE"),
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}</div>` : ""}<div class="frs-scroll">
        <div class="frs-sec"><div class="frs-g">
          <label class="frs-f frs-w"><span>FOURNISSEUR <b>*</b></span><select class="ins-in fa-x" data-k="frs"${dis || (f0 || C0 ? " disabled" : "")}><option value=""></option>${opt(FR.map(f => [f.id, f.code + " — " + f.nom]), P.frs)}</select></label>
          <label class="frs-f"><span>TYPE</span><select class="ins-in fa-x" data-k="type"${dis}>${opt([["normale", "FACTURE"], ["acompte", "FACTURE D'ACOMPTE"]], P.type)}</select></label>
          <label class="frs-f"><span>COMMANDE</span><select class="ins-in fa-x" data-k="cmf"${dis || (f0 || C0 ? " disabled" : "")}><option value="">SANS COMMANDE</option>${opt(CM.map(c => [c.id, c.ref]), P.cmf)}</select></label>
          <label class="frs-f"><span>N° DE LA FACTURE <b>*</b></span><input class="ins-in fa-x" data-k="num" value="${esc(P.num)}"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>DATE DE LA FACTURE <b>*</b></span><input type="date" class="ins-in fa-x" data-k="dFac" value="${esc(P.dFac)}"${dis}></label>
          <label class="frs-f"><span>REÇUE LE</span><input type="date" class="ins-in fa-x" data-k="dRec" value="${esc(P.dRec)}"${dis}></label>
          <label class="frs-f"><span>ÉCHÉANCE ${P.ech ? "(SAISIE)" : "(CONDITIONS DU FOURNISSEUR)"}</span><input type="date" class="ins-in fa-x" data-k="ech" value="${esc(achFafEch(P))}"${dis}></label>
          <label class="frs-f frs-w"><span>COPIE DE LA FACTURE</span>${achCopyBtn(P, ro)}</label></div></div>
        <div class="frs-sec"><div class="frs-st">LIGNES ${svCnt(P.lignes.length)} ${C ? `<small>(REÇU − DÉJÀ FACTURÉ ; REMISE ${esc(String(achN(P.rem)).replace(".", ","))} %)</small>` : ""}</div>
          <table class="prm-table frs-sub"><thead><tr><th>DÉSIGNATION</th><th>U</th><th class="number">QUANTITÉ</th><th class="number">PRIX HT</th><th class="number">TVA %</th><th class="number">MONTANT HT</th>${C ? `<th class="number">REÇU NON FACTURÉ</th>` : ""}<th></th></tr></thead><tbody>
          ${P.lignes.map((l, i) => { const lk = C && l.cl ? " disabled" : dis, rnf = C && l.cl ? achRecQ(C.id, l.cl) - achFacQ(C.id, l.cl, P.id) : null; return `<tr data-i="${i}">
            <td><input class="ins-in fa-l" data-c="des" value="${esc(l.des)}"${lk}></td><td><input class="ins-in fa-l" data-c="u" value="${esc(l.u)}"${lk}></td>
            <td><input class="ins-in fa-l number" data-c="q" inputmode="decimal" value="${esc(String(l.q ?? "").replace(".", ","))}"${dis}></td><td><input class="ins-in fa-l number" data-c="pu" inputmode="decimal" value="${esc(achF2(l.pu))}"${lk}></td>
            <td><input class="ins-in fa-l number" data-c="tva" inputmode="decimal" value="${esc(String(l.tva ?? achPrm().tva).replace(".", ","))}"${lk}></td><td class="number">${esc(achF2(achN(l.q) * achN(l.pu) * (1 - achN(P.rem) / 100)))}</td>
            ${C ? `<td class="number${rnf !== null && achN(l.q) > rnf + 1e-9 ? " fa-over" : ""}">${rnf === null ? "" : esc(achF2(rnf))}</td>` : ""}<td class="center">${ro ? "" : `<button type="button" class="ach-x" data-rml="${i}">✕</button>`}</td></tr>`; }).join("") || `<tr><td colspan="8" class="empty">${P.type === "acompte" ? "FACTURE D'ACOMPTE : MONTANT SAISI CI-DESSOUS" : "AUCUNE LIGNE"}</td></tr>`}
          ${achN(P.frais) ? `<tr><td colspan="5">FRAIS DE TRANSPORT</td><td class="number">${esc(achF2(P.frais))}</td><td colspan="2"></td></tr>` : ""}</tbody></table>
          ${ro ? "" : `<button type="button" class="ach-b" data-addl>+ LIGNE</button>${C ? ` <button type="button" class="ach-b" data-relines>REPRENDRE LE REÇU NON FACTURÉ</button>` : ""}`}</div>
        <div class="frs-sec"><div class="frs-st">MONTANTS</div><div class="frs-g">
          <label class="frs-f"><span>CALCULÉ TTC</span><input class="ins-in number" value="${esc(achF2(t.calc.ttc))}" readonly></label>
          <label class="frs-f"><span>TTC DE LA FACTURE${P.type === "acompte" ? " <b>*</b>" : ""}</span><input class="ins-in fa-x number" data-k="sTtc" inputmode="decimal" value="${num(P.sTtc)}" placeholder="${esc(achF2(t.calc.ttc))}"${dis}></label>
          <label class="frs-f"><span>TVA DE LA FACTURE</span><input class="ins-in fa-x number" data-k="sTva" inputmode="decimal" value="${num(P.sTva)}" placeholder="${esc(achF2(t.calc.tva))}"${dis}></label>
          <label class="frs-f"><span>ÉCART</span><input class="ins-in number${Math.abs(t.ecart) > achPrm().ecart ? " fa-over" : ""}" value="${esc(achF2(t.ecart))}${P.ecOk ? " (ACCEPTÉ)" : ""}" readonly></label>
          <div class="frs-cs"><label class="frs-c"><input type="checkbox" class="fa-xc" data-k="ras"${P.ras ? " checked" : ""}${dis}> RETENUE À LA SOURCE SUR LA TVA</label></div>
          <label class="frs-f"><span>TAUX DE LA RETENUE (% DE LA TVA)</span><input class="ins-in fa-x number" data-k="rasT" inputmode="decimal" value="${esc(String(achN(P.rasT)).replace(".", ","))}"${dis || (!P.ras ? " disabled" : "")}></label>
          <label class="frs-f"><span>AVANCE IMPUTÉE${C ? " (DISPONIBLE " + esc(achF2(achAvReste(C.id, P.id))) + ")" : ""}</span><input class="ins-in fa-x number" data-k="avImp" inputmode="decimal" value="${esc(achF2(P.avImp))}"${dis || (!C ? " disabled" : "")}></label></div>
          <table class="prm-table frs-sub"><tbody>
            <tr><td>TTC</td><td class="number"><b>${esc(achF2(t.ttc))}</b></td></tr>${t.ras ? `<tr><td>RETENUE À LA SOURCE (TVA)</td><td class="number">− ${esc(achF2(t.ras))}</td></tr>` : ""}${t.av ? `<tr><td>AVANCE IMPUTÉE</td><td class="number">− ${esc(achF2(t.av))}</td></tr>` : ""}
            <tr class="caf-tot"><td><b>NET À PAYER</b></td><td class="number"><b>${esc(achF2(t.net))}</b></td></tr>${f0 ? `<tr><td>DÉJÀ PAYÉ</td><td class="number">${esc(achF2(paid))}</td></tr><tr class="caf-tot"><td><b>RESTE À PAYER</b></td><td class="number"><b>${esc(achF2(t.net - paid))}</b></td></tr>` : ""}</tbody></table>
          <div class="bsn-note">ARRÊTÉE À LA SOMME DE : ${esc(frMoney(t.ttc))} TTC.</div></div>
        ${PL.length ? `<div class="frs-sec"><div class="frs-st">PAIEMENTS</div>${PL.map(p => `<div class="bsn-note"><button type="button" class="ach-link" data-opaf="${esc(p.id)}">${esc(p.ref)}</button> — ${esc(p.mode)} ${esc(p.num || "")} — ${esc(achDFr(p.date))} — ${esc(achF2((p.aff || []).filter(a => a.fa === P.id).reduce((s, a) => s + achN(a.m), 0)))} — ${esc(ACH_PAF_ST[p.state] || "")}</div>`).join("")}</div>` : ""}
      </div>`,
      foot: `<button type="button" class="svc-b" data-x>FERMER</button>
        ${f0 && P.state !== "annule" && !paid ? `<button type="button" class="svc-b" data-cancel>ANNULER LA FACTURE</button>` : ""}
        ${f0 && P.state === "bap" && !paid ? `<button type="button" class="svc-b" data-unbap>RETIRER LE BON À PAYER</button>` : ""}
        ${!ro && Math.abs(t.ecart) > achPrm().ecart && !P.ecOk ? `<button type="button" class="svc-b" data-ecok>ACCEPTER L'ÉCART</button>${P.state !== "reclame" ? `<button type="button" class="svc-b" data-recl>RÉCLAMER</button>` : ""}` : ""}
        ${!ro ? `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button><button type="button" class="svc-b svc-ok" data-bap>BON À PAYER</button>` : ""}
        ${f0 && P.state === "bap" && t.net - paid > 0.005 ? `<button type="button" class="svc-b svc-ok" data-pay>PAYER</button>` : ""}` });
    if (!d.isConnected) sviWinShow(d);
  };
  const pull = () => { d.querySelectorAll(".fa-x").forEach(i => { if (i.disabled) return; const k = i.dataset.k;
      P[k] = ["avImp", "rasT"].includes(k) ? achN(i.value) : ["sTtc", "sTva"].includes(k) ? (String(i.value).trim() === "" ? "" : achN(i.value)) : ["frs", "cmf", "type", "dFac", "dRec"].includes(k) ? i.value : k === "ech" ? (i.value && i.value !== achFafEch({ ...P, ech: "" }) ? i.value : "") : achU(i.value); });
    d.querySelectorAll(".fa-xc").forEach(i => { if (!i.disabled) P[i.dataset.k] = i.checked; });
    d.querySelectorAll("tr[data-i]").forEach(tr => { const l = P.lignes[+tr.dataset.i]; if (!l) return; tr.querySelectorAll(".fa-l").forEach(i => { if (i.disabled) return; const c = i.dataset.c; l[c] = ["q", "pu", "tva"].includes(c) ? achN(i.value) : achU(i.value); }); }); };
  const store = async act => { const L = achFaf(); let f = L.find(x => x.id === P.id);
    if (!f) { P.ref = achNextRef("FAF", L); P.cree = achNow(); f = {}; L.push(f); }
    if (cpBlob) { try { const k = "ach:fa:" + P.id; await sviFiles.put(k, cpBlob); P.copie = k; cpBlob = null; } catch (e) {} }
    Object.assign(f, JSON.parse(JSON.stringify(P)), { mod: achNow() }); achFafSave(L); achHist(f.ref, act, (f.frs ? achFrsNom(f.frs) : "") + " — N° " + (f.num || "?") + " — " + achF2(achFafTot(f).ttc) + " TTC"); return f; };
  const check = () => { if (!P.frs) { svToast("FOURNISSEUR OBLIGATOIRE.", 3000); return false; }
    if (!P.num) { svToast("N° DE LA FACTURE OBLIGATOIRE.", 3000); return false; }
    if (achFaf().some(x => x.id !== P.id && x.state !== "annule" && x.frs === P.frs && achU(x.num) === achU(P.num))) { svToast("N° DE FACTURE DÉJÀ ENREGISTRÉ CHEZ CE FOURNISSEUR.", 3500); return false; }
    if (!P.dFac) { svToast("DATE DE LA FACTURE OBLIGATOIRE.", 3000); return false; }
    if (P.type === "acompte" ? !(achN(P.sTtc) > 0) : !P.lignes.length) { svToast(P.type === "acompte" ? "MONTANT TTC DE LA FACTURE D'ACOMPTE OBLIGATOIRE." : "AU MOINS UNE LIGNE.", 3000); return false; }
    if (P.lignes.some(l => !achU(l.des) || !(achN(l.q) > 0))) { svToast("CHAQUE LIGNE : DÉSIGNATION ET QUANTITÉ.", 3000); return false; }
    if (P.cmf && achN(P.avImp) > achAvReste(P.cmf, P.id) + 0.005) { svToast("AVANCE IMPUTÉE AU-DELÀ DE L'AVANCE DISPONIBLE.", 3500); return false; }
    return true; };
  draw();
  /* v907 (principe du 03/11/2026) : N° de facture déjà enregistré chez ce fournisseur refusé en quittant la case */
  d.addEventListener("focusin", e => { const i = e.target.closest && e.target.closest('.fa-x[data-k="num"]'); if (i) i.dataset.prev = i.value; });
  d.addEventListener("change", e => { const i = e.target.closest && e.target.closest('.fa-x[data-k="num"]'); if (!i) return;
    const fr = (d.querySelector('.fa-x[data-k="frs"]') || {}).value || P.frs, n = achU(i.value);
    if (n && fr && achFaf().some(x => x.id !== P.id && x.state !== "annule" && x.frs === fr && achU(x.num) === n)) { e.stopImmediatePropagation(); i.value = i.dataset.prev || ""; svToast("N° DE FACTURE DÉJÀ ENREGISTRÉ CHEZ CE FOURNISSEUR.", 3500, i); } }, true);
  d.addEventListener("change", e => {
    const cp = e.target.closest(".fa-cp"); if (cp) { cpBlob = cp.files && cp.files[0] || null; if (cpBlob) P.copie = P.copie || "ach:fa:" + P.id; return; }
    if (!e.target.closest(".fa-x, .fa-xc, .fa-l")) return;
    const k = e.target.dataset.k; pull();
    if (k === "cmf") { const C = achCmf().find(c => c.id === P.cmf); P.lignes = C ? cmfLines(C, P.id) : []; P.rem = C ? achN(C.rem) : 0; P.avImp = C ? achAvReste(C.id, P.id) : 0; P.frais = 0; }
    if (k === "frs") { P.cmf = ""; P.lignes = []; P.rem = 0; P.avImp = 0; P.frais = 0; }
    draw();
  });
  d.addEventListener("click", async e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (done) done(); return; }
    if (e.target.closest("[data-copy]")) { achCopyOpen(P.copie); return; }
    const op = e.target.closest("[data-opaf]"); if (op) { achPafFiche(op.dataset.opaf, null, () => { const f = achFaf().find(x => x.id === P.id); if (f) Object.assign(P, JSON.parse(JSON.stringify(f))); draw(); }); return; }
    if (e.target.closest("[data-addl]")) { pull(); P.lignes.push({ cl: "", des: "", u: "", q: "", pu: "", tva: achPrm().tva }); draw(); return; }
    if (e.target.closest("[data-relines]")) { pull(); const C = achCmf().find(c => c.id === P.cmf); if (C) P.lignes = cmfLines(C, P.id); draw(); return; }
    const rl = e.target.closest("[data-rml]"); if (rl) { pull(); P.lignes.splice(+rl.dataset.rml, 1); draw(); return; }
    if (e.target.closest("[data-cancel]")) { if (!(await svConfirm({ title: "ANNULER LA FACTURE", text: (P.ref || "LA FACTURE") + " PASSE EN ANNULÉE (GARDÉE).", ok: "ANNULER LA FACTURE" }))) return; P.state = "annule"; await store("ANNULÉE"); d.remove(); if (done) done(); return; }
    if (e.target.closest("[data-unbap]")) { P.state = "instance"; await store("BON À PAYER RETIRÉ"); draw(); return; }
    if (e.target.closest("[data-ecok]")) { pull(); const m = await achAsk("ACCEPTER L'ÉCART", "MOTIF"); if (!m) return; P.ecOk = { t: achNow(), motif: m }; if (P.state === "reclame") P.state = "instance"; if (check()) await store("ÉCART ACCEPTÉ — " + m); draw(); return; }
    if (e.target.closest("[data-recl]")) { pull(); if (!check()) return; P.state = "reclame"; await store("ÉCART RÉCLAMÉ AU FOURNISSEUR"); draw(); return; }
    if (e.target.closest("[data-save]")) { pull(); if (!check()) return; const isNew = !(f0 || achFaf().some(x => x.id === P.id));
      if (isNew && await achFrsStop(achFrs().find(f => f.id === P.frs), "ENREGISTRER UNE FACTURE")) return; await store(isNew ? "CRÉATION" : "MODIFICATION"); draw(); return; }
    if (e.target.closest("[data-bap]")) { pull(); if (!check()) return; if (await achFrsStop(achFrs().find(f => f.id === P.frs), "BON À PAYER")) return;
      const stop = achFafStop(P); if (stop.length) { svToast("BON À PAYER IMPOSSIBLE : " + stop.join(" · "), 5000); return; }
      if (!(await svConfirm({ title: "BON À PAYER", text: (P.ref || "LA FACTURE") + " : NET À PAYER " + achF2(achFafTot(P).net) + " (ÉCHÉANCE " + achDFr(achFafEch(P)) + ").", ok: "BON À PAYER", tone: "neutral" }))) return;
      P.state = "bap"; P.bap = achNow(); await store("BON À PAYER"); draw(); return; }
    if (e.target.closest("[data-pay]")) { achPafFiche(null, { frs: P.frs, fa: P.id }, () => { draw(); }); return; }
  });
}

/* ---------- FICHE AVOIR ---------- */
function achAvfFiche(id, done) {
  const a0 = id ? achAvf().find(x => x.id === id) : null; if (id && !a0) return;
  const P = a0 ? JSON.parse(JSON.stringify(a0)) : { id: achId("V"), ref: "", frs: "", num: "", date: new Date().toISOString().slice(0, 10), fa: "", rtr: "", ht: "", tva: "", ttc: 0, motif: "", state: "valide", copie: "" };
  const d = sviWinNew(); let cpBlob = null;
  const draw = () => {
    const used = a0 ? achAvfUsed(P.id) : 0, ro = P.state === "annule" || used > 0, dis = ro ? " disabled" : "";
    const FR = achLive(achFrs()).filter(f => f.actif !== false || f.id === P.frs), FA = achFaf().filter(f => f.frs === P.frs && f.state !== "annule"), RT = achRtr().filter(x => x.frs === P.frs && x.kind === "rcp");
    const opt = (L, v) => L.map(x => `<option value="${esc(x[0])}"${x[0] === v ? " selected" : ""}>${esc(x[1])}</option>`).join("");
    d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: (a0 ? "AVOIR — " + esc(P.ref) : "NOUVEL AVOIR FOURNISSEUR") + (P.state === "annule" ? " · ANNULÉ" : ""),
      body: `<div class="frs-scroll"><div class="frs-sec"><div class="frs-g">
          <label class="frs-f frs-w"><span>FOURNISSEUR <b>*</b></span><select class="ins-in av-x" data-k="frs"${dis || (a0 ? " disabled" : "")}><option value=""></option>${opt(FR.map(f => [f.id, f.code + " — " + f.nom]), P.frs)}</select></label>
          <label class="frs-f"><span>N° DE L'AVOIR <b>*</b></span><input class="ins-in av-x" data-k="num" value="${esc(P.num)}"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>DATE</span><input type="date" class="ins-in av-x" data-k="date" value="${esc(P.date)}"${dis}></label>
          <label class="frs-f"><span>FACTURE D'ORIGINE</span><select class="ins-in av-x" data-k="fa"${dis}><option value=""></option>${opt(FA.map(f => [f.id, f.ref + " — N° " + f.num]), P.fa)}</select></label>
          <label class="frs-f"><span>RETOUR LIÉ</span><select class="ins-in av-x" data-k="rtr"${dis}><option value=""></option>${opt(RT.map(x => [x.id, x.ref + " — " + (x.motif || "")]), P.rtr)}</select></label>
          <label class="frs-f"><span>MONTANT HT <b>*</b></span><input class="ins-in av-x number" data-k="ht" inputmode="decimal" value="${esc(P.ht === "" ? "" : achF2(P.ht))}"${dis}></label>
          <label class="frs-f"><span>TVA</span><input class="ins-in av-x number" data-k="tva" inputmode="decimal" value="${esc(P.tva === "" ? "" : achF2(P.tva))}" placeholder="${esc(achF2(achN(P.ht) * achPrm().tva / 100))}"${dis}></label>
          <label class="frs-f"><span>MONTANT TTC</span><input class="ins-in number" value="${esc(achF2(P.ttc))}" readonly></label>
          <label class="frs-f frs-w"><span>MOTIF <b>*</b></span><input class="ins-in av-x" data-k="motif" value="${esc(P.motif)}"${dis} autocomplete="off"></label>
          <label class="frs-f frs-w"><span>COPIE DE L'AVOIR</span>${achCopyBtn(P, ro)}</label></div></div>
        ${a0 ? `<div class="bsn-note">DÉDUIT DANS LES PAIEMENTS : ${esc(achF2(used))} · RESTE À DÉDUIRE : <b>${esc(achF2(achN(P.ttc) - used))}</b></div>` : ""}
        ${!ro && P.rtr ? `<button type="button" class="ach-b" data-fromrtr>MONTANT DEPUIS LE RETOUR (PRIX DE LA COMMANDE)</button>` : ""}</div>`,
      foot: `<button type="button" class="svc-b" data-x>FERMER</button>${a0 && !ro ? `<button type="button" class="svc-b" data-cancel>ANNULER L'AVOIR</button>` : ""}${!ro ? `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button>` : ""}` });
    if (!d.isConnected) sviWinShow(d);
  };
  const calc = () => { P.ttc = achN(P.ht) + (P.tva === "" ? achN(P.ht) * achPrm().tva / 100 : achN(P.tva)); };
  const pull = () => { d.querySelectorAll(".av-x").forEach(i => { if (i.disabled) return; const k = i.dataset.k; P[k] = k === "ht" || k === "tva" ? (String(i.value).trim() === "" ? "" : achN(i.value)) : ["frs", "fa", "rtr", "date"].includes(k) ? i.value : achU(i.value); }); calc(); };
  draw();
  /* v908 (principe du 03/11/2026) : N° d'avoir déjà enregistré chez ce fournisseur refusé en quittant la case */
  d.addEventListener("focusin", e => { const i = e.target.closest && e.target.closest('.av-x[data-k="num"]'); if (i) i.dataset.prev = i.value; });
  d.addEventListener("change", e => { const i = e.target.closest && e.target.closest('.av-x[data-k="num"]'); if (!i) return;
    const fr = (d.querySelector('.av-x[data-k="frs"]') || {}).value || P.frs, n = achU(i.value);
    if (n && fr && achAvf().some(x => x.id !== P.id && x.state !== "annule" && x.frs === fr && achU(x.num) === n)) { e.stopImmediatePropagation(); i.value = i.dataset.prev || ""; svToast("N° D'AVOIR DÉJÀ ENREGISTRÉ CHEZ CE FOURNISSEUR.", 3500, i); } }, true);
  d.addEventListener("change", e => { const cp = e.target.closest(".fa-cp"); if (cp) { cpBlob = cp.files && cp.files[0] || null; return; } if (e.target.closest(".av-x")) { const k = e.target.dataset.k; pull(); if (k === "frs") { P.fa = ""; P.rtr = ""; } draw(); } });
  d.addEventListener("click", async e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (done) done(); return; }
    if (e.target.closest("[data-copy]")) { achCopyOpen(P.copie); return; }
    if (e.target.closest("[data-fromrtr]")) { pull(); const x = achRtr().find(y => y.id === P.rtr), C = x && achCmf().find(c => c.id === x.cmf); if (!x || !C) { svToast("RETOUR SANS COMMANDE : MONTANT À SAISIR.", 3000); return; }
      let ht = 0, tva = 0; (x.lignes || []).forEach(l => { const cl = C.lignes.find(y => y.id === l.cl); if (!cl) return; const m = achN(l.q) * achN(cl.pu) * (1 - achN(C.rem) / 100); ht += m; tva += m * achN(cl.tva ?? achPrm().tva) / 100; });
      P.ht = Math.round(ht * 100) / 100; P.tva = Math.round(tva * 100) / 100; if (!P.motif) P.motif = "RETOUR " + x.ref; calc(); draw(); return; }
    const L = achAvf();
    if (e.target.closest("[data-cancel]")) { if (!(await svConfirm({ title: "ANNULER L'AVOIR", text: P.ref + " PASSE EN ANNULÉ (GARDÉ).", ok: "ANNULER L'AVOIR" }))) return; const a = L.find(x => x.id === P.id); if (a) { a.state = "annule"; a.mod = achNow(); achAvfSave(L); achHist(a.ref, "ANNULÉ", ""); } d.remove(); if (done) done(); return; }
    if (!e.target.closest("[data-save]")) return;
    pull();
    if (!P.frs || !P.num || !(achN(P.ht) > 0) || !P.motif) { svToast("FOURNISSEUR, N° DE L'AVOIR, MONTANT HT ET MOTIF OBLIGATOIRES.", 3500); return; }
    if (L.some(x => x.id !== P.id && x.state !== "annule" && x.frs === P.frs && achU(x.num) === achU(P.num))) { svToast("N° D'AVOIR DÉJÀ ENREGISTRÉ CHEZ CE FOURNISSEUR.", 3500); return; }
    let a = L.find(x => x.id === P.id); const isNew = !a; if (isNew) { P.ref = achNextRef("AVF", L); P.cree = achNow(); a = {}; L.push(a); }
    if (cpBlob) { try { const k = "ach:av:" + P.id; await sviFiles.put(k, cpBlob); P.copie = k; cpBlob = null; } catch (err) {} }
    Object.assign(a, JSON.parse(JSON.stringify(P)), { mod: achNow() }); achAvfSave(L); achHist(a.ref, isNew ? "CRÉATION" : "MODIFICATION", achFrsNom(a.frs) + " — N° " + a.num + " — " + achF2(a.ttc) + " TTC");
    d.remove(); if (done) done();
  });
}

/* ---------- FICHE PAIEMENT ---------- */
function achPafFiche(id, o, done) {
  o = o || {};
  const p0 = id ? achPaf().find(x => x.id === id) : null; if (id && !p0) return;
  const today = new Date().toISOString().slice(0, 10);
  const P = p0 ? JSON.parse(JSON.stringify(p0)) : { id: achId("P"), ref: "", type: o.type || "reglement", frs: o.frs || "", mode: "VIREMENT", num: "", echL: "", date: today, cmf: o.cmf || "", mt: 0, aff: [], ded: [], state: "instance", motif: "" };
  /* v806 : mode de règlement par défaut du fournisseur (C1.22) */
  const modeOf = id => { const f = achFrs().find(x => x.id === id); return f && ACH_MODES.includes(f.modeReg) ? f.modeReg : "VIREMENT"; };
  if (!p0 && P.frs) P.mode = modeOf(P.frs);
  if (!p0 && o.cmf) { const C = achCmf().find(c => c.id === o.cmf); if (C) { P.frs = C.frs; P.mt = Math.max(0, Math.round((achCmfTot(C).av - achAvVerse(C.id)) * 100) / 100); } }
  if (!p0 && o.cmf && P.frs) P.mode = modeOf(P.frs);
  if (!p0 && o.fa) { const f = achFaf().find(x => x.id === o.fa); if (f) P.aff = [{ fa: f.id, m: Math.round(achFafReste(f) * 100) / 100 }]; }
  const d = sviWinNew();
  const sum = () => { if (P.type === "reglement") P.mt = Math.round(((P.aff || []).reduce((t, a) => t + achN(a.m), 0) - (P.ded || []).reduce((t, a) => t + achN(a.m), 0)) * 100) / 100; };
  const draw = () => {
    sum();
    const ro = P.state !== "instance", dis = ro ? " disabled" : "", why = p0 ? achPafWhy(P) : [], fr = achFrs().find(f => f.id === P.frs), rib = fr ? achFrsRibP(fr) : null;
    const FR = achLive(achFrs()).filter(f => achFrsOk(f) || f.id === P.frs);
    const FA = achFaf().filter(f => f.frs === P.frs && f.state === "bap" && (achFafReste(f) > 0.005 || (P.aff || []).some(a => a.fa === f.id)));
    const AV = achAvf().filter(a => a.frs === P.frs && a.state !== "annule" && (achAvfReste(a) > 0.005 || (P.ded || []).some(x => x.av === a.id)));
    const CM = achCmf().filter(c => c.frs === P.frs && (c.state === "valide" || c.state === "instance") && c.avT);
    const opt = (L, v) => L.map(x => `<option value="${esc(x[0])}"${x[0] === v ? " selected" : ""}>${esc(x[1])}</option>`).join("");
    const mine = (L, k, id) => achN(((L || []).find(a => a[k] === id) || {}).m);
    d.innerHTML = sviWinCard({ cls: "frs-card paf-card", close: "data-x", title: (p0 ? "PAIEMENT — " + esc(P.ref) : "NOUVEAU PAIEMENT") + " · " + esc(ACH_PAF_ST[P.state] || ""),
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}</div>` : ""}
        ${fr && achFrsAttExp(fr) && P.state === "instance" ? `<div class="frs-why pa-att">⚠ ATTESTATION DE RÉGULARITÉ FISCALE EXPIRÉE : ${P.deb ? `PAIEMENT DÉBLOQUÉ PAR ${esc(P.deb.u || "?")} LE ${esc(achDFr(String(P.deb.t).slice(0, 10)))} — ${esc(P.deb.why || "")}` : `PAIEMENT BLOQUÉ <button type="button" class="ach-b" data-attdeb>DÉBLOQUER</button>`}</div>` : ""}<div class="frs-scroll">
        <div class="frs-sec"><div class="frs-g">
          <label class="frs-f"><span>TYPE</span><select class="ins-in pa-x" data-k="type"${dis || (p0 || o.fa || o.cmf ? " disabled" : "")}>${opt([["reglement", "RÈGLEMENT DE FACTURES"], ["avance", "AVANCE SUR COMMANDE"]], P.type)}</select></label>
          <label class="frs-f frs-w"><span>FOURNISSEUR <b>*</b></span><select class="ins-in pa-x" data-k="frs"${dis || (p0 || o.fa || o.cmf ? " disabled" : "")}><option value=""></option>${opt(FR.map(f => [f.id, f.code + " — " + f.nom]), P.frs)}</select></label>
          <label class="frs-f"><span>MODE</span><select class="ins-in pa-x" data-k="mode"${dis}>${opt(ACH_MODES.map(x => [x, x]), P.mode)}</select></label>
          <label class="frs-f"><span>DATE</span><input type="date" class="ins-in pa-x" data-k="date" value="${esc(P.date)}"${dis}></label>
          ${P.mode === "CHÈQUE" || P.mode === "LCN" ? `<label class="frs-f"><span>N° DU ${esc(P.mode)} <b>*</b></span><input class="ins-in pa-x" data-k="num" value="${esc(P.num)}"${dis} autocomplete="off"></label>` : ""}
          ${P.mode === "LCN" ? `<label class="frs-f"><span>ÉCHÉANCE DE LA LCN <b>*</b></span><input type="date" class="ins-in pa-x" data-k="echL" value="${esc(P.echL)}"${dis}></label>` : ""}
          ${P.mode === "VIREMENT" || P.mode === "PRÉLÈVEMENT" ? `<label class="frs-f frs-w"><span>RIB DU FOURNISSEUR (PRINCIPAL)</span><input class="ins-in" value="${esc(rib ? achDig(rib.rib) : "AUCUN RIB")}${fr && fr.ribChg ? " — À VÉRIFIER" : ""}" readonly></label>` : ""}
          ${P.type === "avance" ? `<label class="frs-f frs-w"><span>COMMANDE <b>*</b></span><select class="ins-in pa-x" data-k="cmf"${dis || (o.cmf ? " disabled" : "")}><option value=""></option>${opt(CM.map(c => [c.id, c.ref + " — AVANCE " + achF2(achCmfTot(c).av) + " (VERSÉ " + achF2(achAvVerse(c.id)) + ")"]), P.cmf)}</select></label>
            <label class="frs-f"><span>MONTANT DE L'AVANCE <b>*</b></span><input class="ins-in pa-x number" data-k="mt" inputmode="decimal" value="${esc(achF2(P.mt))}"${dis}></label>` : ""}</div></div>
        ${P.type === "reglement" ? `<div class="frs-sec"><div class="frs-st">FACTURES (BON À PAYER) ${svCnt(FA.length)}</div>
          <table class="prm-table frs-sub"><thead><tr><th>FACTURE</th><th>N°</th><th>ÉCHÉANCE</th><th class="number">RESTE</th><th class="number">PAYÉ ICI</th></tr></thead><tbody>
          ${FA.map(f => `<tr><td>${esc(f.ref)}</td><td>${esc(f.num)}</td><td>${esc(achDFr(achFafEch(f)))}</td><td class="number">${esc(achF2(achFafReste(f)))}</td><td><input class="ins-in pa-a number" data-fa="${esc(f.id)}" inputmode="decimal" value="${esc(mine(P.aff, "fa", f.id) ? achF2(mine(P.aff, "fa", f.id)) : "")}"${dis}></td></tr>`).join("") || `<tr><td colspan="5" class="empty">AUCUNE FACTURE EN BON À PAYER</td></tr>`}</tbody></table>
          ${AV.length ? `<div class="frs-st">AVOIRS À DÉDUIRE</div><table class="prm-table frs-sub"><thead><tr><th>AVOIR</th><th>N°</th><th>MOTIF</th><th class="number">RESTE</th><th class="number">DÉDUIT ICI</th></tr></thead><tbody>
          ${AV.map(a => `<tr><td>${esc(a.ref)}</td><td>${esc(a.num)}</td><td>${esc(a.motif)}</td><td class="number">${esc(achF2(achAvfReste(a)))}</td><td><input class="ins-in pa-d number" data-av="${esc(a.id)}" inputmode="decimal" value="${esc(mine(P.ded, "av", a.id) ? achF2(mine(P.ded, "av", a.id)) : "")}"${dis}></td></tr>`).join("")}</tbody></table>` : ""}</div>` : ""}
        <table class="prm-table frs-sub"><tbody><tr class="caf-tot"><td><b>MONTANT DU PAIEMENT</b></td><td class="number"><b>${esc(achF2(P.mt))}</b></td></tr></tbody></table>
        <div class="bsn-note">${esc(frMoney(P.mt))}.${P.motif ? " MOTIF : " + esc(P.motif) + "." : ""}</div></div>`,
      foot: `<button type="button" class="svc-b" data-x>FERMER</button>
        ${P.state === "instance" || P.state === "emis" ? `<button type="button" class="svc-b" data-cancel>ANNULER LE PAIEMENT</button>` : ""}
        ${P.state === "emis" && (P.mode === "CHÈQUE" || P.mode === "LCN") ? `<button type="button" class="svc-b" data-rej>REJETÉ</button><button type="button" class="svc-b svc-ok" data-enc>ENCAISSÉ</button>` : ""}
        ${!ro ? `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button><button type="button" class="svc-b svc-ok" data-valid>VALIDER LE PAIEMENT</button>` : ""}` });
    if (!d.isConnected) sviWinShow(d);
  };
  const pull = () => { d.querySelectorAll(".pa-x").forEach(i => { if (i.disabled) return; const k = i.dataset.k; P[k] = k === "mt" ? achN(i.value) : ["type", "frs", "mode", "date", "echL", "cmf"].includes(k) ? i.value : achU(i.value); });
    if (P.type === "reglement") { P.aff = [...d.querySelectorAll(".pa-a")].map(i => ({ fa: i.dataset.fa, m: achN(i.value) })).filter(a => a.m > 0); P.ded = [...d.querySelectorAll(".pa-d")].map(i => ({ av: i.dataset.av, m: achN(i.value) })).filter(a => a.m > 0); } sum(); };
  const store = act => { const L = achPaf(); let p = L.find(x => x.id === P.id); if (!p) { P.ref = achNextRef("PAF", L); P.cree = achNow(); p = {}; L.push(p); }
    Object.assign(p, JSON.parse(JSON.stringify(P)), { mod: achNow() }); achPafSave(L); achHist(p.ref, act, (p.frs ? achFrsNom(p.frs) : "") + " — " + p.mode + " — " + achF2(p.mt)); return p; };
  const check = () => { if (!P.frs) { svToast("FOURNISSEUR OBLIGATOIRE.", 3000); return false; }
    if (P.type === "avance" && (!P.cmf || !(achN(P.mt) > 0))) { svToast("COMMANDE ET MONTANT DE L'AVANCE OBLIGATOIRES.", 3000); return false; }
    if (P.type === "reglement") { if (!P.aff.length) { svToast("AUCUNE FACTURE PAYÉE.", 3000); return false; }
      const F = achFaf(), A = achAvf(), others = achPaf().filter(x => x.id !== P.id);
      for (const a of P.aff) { const f = F.find(x => x.id === a.fa); if (f && a.m > achFafReste(f, others) + 0.005) { svToast("MONTANT AU-DELÀ DU RESTE DE " + f.ref + ".", 3500); return false; } }
      for (const x of P.ded) { const a = A.find(y => y.id === x.av); if (a && x.m > achAvfReste(a, others) + 0.005) { svToast("DÉDUCTION AU-DELÀ DU RESTE DE " + a.ref + ".", 3500); return false; } }
      if (!(P.mt > 0)) { svToast("MONTANT DU PAIEMENT NUL OU NÉGATIF (AVOIRS TROP ÉLEVÉS).", 3500); return false; } }
    return true; };
  draw();
  /* v908 (principe du 03/11/2026) : montant payé ou déduit au-delà du reste refusé en quittant la case */
  d.addEventListener("focusin", e => { const i = e.target.closest && e.target.closest(".pa-a, .pa-d"); if (i) i.dataset.prev = i.value; });
  d.addEventListener("change", e => { const i = e.target.closest && e.target.closest(".pa-a, .pa-d"); if (!i) return;
    const m = achN(i.value), others = achPaf().filter(x => x.id !== P.id);
    const x = i.classList.contains("pa-a") ? achFaf().find(f => f.id === i.dataset.fa) : achAvf().find(a => a.id === i.dataset.av);
    const rest = !x ? Infinity : i.classList.contains("pa-a") ? achFafReste(x, others) : achAvfReste(x, others);
    if (m < 0 || m > rest + 0.005) { e.stopImmediatePropagation(); i.value = i.dataset.prev || ""; svToast((i.classList.contains("pa-a") ? "MONTANT AU-DELÀ DU RESTE DE " : "DÉDUCTION AU-DELÀ DU RESTE DE ") + (x ? x.ref : "") + " (" + achF2(rest) + ").", 4000, i); } }, true);
  d.addEventListener("change", e => { if (!e.target.closest(".pa-x, .pa-a, .pa-d")) return; const k = e.target.dataset.k; pull();
    if (k === "frs") { P.aff = []; P.ded = []; P.cmf = ""; delete P.deb; if (!p0) P.mode = modeOf(P.frs); } if (k === "type") { P.aff = []; P.ded = []; P.cmf = ""; P.mt = 0; }
    if (k === "cmf") { const C = achCmf().find(c => c.id === P.cmf); P.mt = C ? Math.max(0, Math.round((achCmfTot(C).av - achAvVerse(C.id)) * 100) / 100) : 0; }
    draw(); });
  d.addEventListener("click", async e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (done) done(); return; }
    if (e.target.closest("[data-save]")) { pull(); if (!check()) return; store(p0 || achPaf().some(x => x.id === P.id) ? "MODIFICATION" : "CRÉATION"); draw(); return; }
    if (e.target.closest("[data-valid]")) { pull(); if (!check()) return;
      const fr = achFrs().find(f => f.id === P.frs);
      if (await achFrsStop(fr, "VALIDER LE PAIEMENT")) return;
      if (fr && achFrsAttExp(fr) && !P.deb) { svToast("ATTESTATION DE RÉGULARITÉ FISCALE EXPIRÉE : PAIEMENT BLOQUÉ (DÉBLOQUER AVEC UN MOTIF).", 5000); draw(); return; }
      if ((P.mode === "VIREMENT" || P.mode === "PRÉLÈVEMENT") && fr && fr.ribChg) { svToast("RIB DU FOURNISSEUR MODIFIÉ : À VÉRIFIER (FICHE FOURNISSEUR, RIB VÉRIFIÉ) AVANT TOUT PAIEMENT.", 5000); return; }
      if ((P.mode === "VIREMENT" || P.mode === "PRÉLÈVEMENT") && fr && !achFrsRibP(fr)) { svToast("AUCUN RIB POUR CE FOURNISSEUR.", 3500); return; }
      if ((P.mode === "CHÈQUE" || P.mode === "LCN") && !P.num) { svToast("N° DU " + P.mode + " OBLIGATOIRE.", 3000); return; }
      if (P.mode === "LCN" && !P.echL) { svToast("ÉCHÉANCE DE LA LCN OBLIGATOIRE.", 3000); return; }
      const esp = P.mode === "ESPÈCES" && P.mt > achPrm().esp ? " ATTENTION : ESPÈCES AU-DELÀ DU PLAFOND (" + achF2(achPrm().esp) + ")." : "";
      if (!(await svConfirm({ title: "VALIDER LE PAIEMENT", text: P.mode + " DE " + achF2(P.mt) + " (" + frMoney(P.mt) + ") À " + achFrsNom(P.frs) + "." + esp, ok: "VALIDER", tone: esp ? "" : "neutral" }))) return;
      P.state = P.mode === "CHÈQUE" || P.mode === "LCN" ? "emis" : "encaisse"; P.valide = achNow(); store(P.state === "emis" ? "ÉMIS" : "PAYÉ"); draw(); return; }
    if (e.target.closest("[data-attdeb]")) { pull();
      const m = await achAsk("DÉBLOQUER LE PAIEMENT", "MOTIF (ATTESTATION FISCALE EXPIRÉE)"); if (!m) return;
      P.deb = { u: typeof sviUser === "function" ? sviUser() : "", t: achNow(), why: m };
      if (achPaf().some(x => x.id === P.id)) store("DÉBLOQUÉ (ATTESTATION FISCALE EXPIRÉE) — " + m); else achHist(achFrs().find(f => f.id === P.frs)?.code || "", "PAIEMENT DÉBLOQUÉ (ATTESTATION FISCALE EXPIRÉE)", m);
      draw(); return; }
    if (e.target.closest("[data-enc]")) { P.state = "encaisse"; P.enc = achNow(); store("ENCAISSÉ"); draw(); return; }
    if (e.target.closest("[data-rej]") || e.target.closest("[data-cancel]")) { const rej = !!e.target.closest("[data-rej]");
      const m = await achAsk(rej ? P.mode + " REJETÉ" : "ANNULER LE PAIEMENT", rej ? "MOTIF DU REJET" : "MOTIF DE L'ANNULATION"); if (!m) return;
      P.state = rej ? "rejete" : "annule"; P.motif = m; if (achPaf().some(x => x.id === P.id)) store((rej ? "REJETÉ — " : "ANNULÉ — ") + m); d.remove(); if (done) done();
      svToast((rej ? "REJETÉ" : "ANNULÉ") + " : LES FACTURES CONCERNÉES REDEVIENNENT À PAYER.", 3500); return; }
  });
}

/* =========================================================
   v818 : PROPOSITION DE PAIEMENT (C9.1 – C9.4, C9.7 – C9.10) — ⋯ de la liste des PAIEMENTS
   Factures BON À PAYER avec un reste, triées par échéance (échues d'abord), fournisseurs bloqués exclus ; priorité :
   ÉCHUE, DÉLAI LÉGAL PROCHE (date de facture + délai légal de PARAMÈTRES), FOURNISSEUR STRATÉGIQUE ; décaissements de la semaine et du mois ;
   CRÉER LES PAIEMENTS : un règlement EN INSTANCE par fournisseur, mode de règlement du fournisseur, avoirs disponibles déduits.
   ========================================================= */
const achPafPropRows = () => { const today = new Date().toISOString().slice(0, 10), F = achFrs(), lim = achPrm().delaiLeg;
  return achFaf().filter(f => f.state === "bap" && achFafReste(f) > 0.005).map(f => { const fr = F.find(x => x.id === f.frs), ech = achFafEch(f) || today;
    let leg = ""; if (f.dFac) { const x = new Date(f.dFac + "T00:00:00"); x.setDate(x.getDate() + lim); leg = x.toISOString().slice(0, 10); }
    const prio = ech < today ? "ÉCHUE" : leg && leg <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10) ? "DÉLAI LÉGAL PROCHE" : fr && fr.strat === "STRATÉGIQUE" ? "STRATÉGIQUE" : "NORMALE";
    return { f, fr, ech, leg, prio, reste: achFafReste(f), ok: !!fr && achFrsOk(fr) }; })
    .sort((a, b) => (a.prio === "ÉCHUE" ? 0 : 1) - (b.prio === "ÉCHUE" ? 0 : 1) || a.ech.localeCompare(b.ech)); };
function achPafProp(done) {
  let hz = "mois"; const d = sviWinNew(), sel = new Set();
  const end = () => { const x = new Date(); x.setDate(x.getDate() + (hz === "semaine" ? 7 : hz === "mois" ? 31 : 3650)); return x.toISOString().slice(0, 10); };
  const draw = () => { const A = achPafPropRows(), R = A.filter(r => r.ech <= end()), wk = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), mo = new Date(Date.now() + 31 * 864e5).toISOString().slice(0, 10);
    const sum = L => L.reduce((t, r) => t + r.reste, 0), tot = sum(R.filter(r => sel.has(r.f.id)));
    d.innerHTML = sviWinCard({ cls: "frs-card paf-prop", close: "data-x", title: "PROPOSITION DE PAIEMENT",
      body: `<div class="frs-scroll"><div class="rec-tabs">${[["semaine", "SEMAINE"], ["mois", "MOIS"], ["tout", "TOUT"]].map(([k, l]) => `<button type="button" class="rec-tab${hz === k ? " active on" : ""}" data-hz="${k}">${l}</button>`).join("")}</div>
        <div class="bsn-note">À DÉCAISSER CETTE SEMAINE : <b>${esc(achF2(sum(A.filter(r => r.ok && r.ech <= wk))))}</b> · CE MOIS : <b>${esc(achF2(sum(A.filter(r => r.ok && r.ech <= mo))))}</b> · COCHÉ : <b>${esc(achF2(tot))}</b></div>
        <table class="prm-table frs-sub"><thead><tr><th data-tip="SEULES LES FACTURES BON À PAYER SONT PROPOSÉES (PAS CELLES EN INSTANCE NI RÉCLAMÉES)">ÉCHÉANCE</th><th>PRIORITÉ</th><th>FOURNISSEUR</th><th>FACTURE</th><th>N°</th><th class="number">RESTE À PAYER</th><th class="center"></th></tr></thead><tbody>
        ${R.map(r => `<tr${r.prio === "ÉCHUE" ? ' class="nv-alert"' : ""}><td>${esc(achDFr(r.ech))}</td><td>${esc(r.ok ? r.prio : "FOURNISSEUR BLOQUÉ")}</td><td>${esc(r.fr ? r.fr.nom : "?")}</td><td>${esc(r.f.ref)}</td><td>${esc(r.f.num || "")}</td><td class="number">${esc(achF2(r.reste))}</td>
          <td class="center"><input type="checkbox" class="pp-cb" data-fa="${esc(r.f.id)}"${sel.has(r.f.id) ? " checked" : ""}${r.ok ? "" : " disabled"}></td></tr>`).join("") || `<tr><td colspan="7" class="empty">AUCUNE FACTURE À PAYER SUR CETTE PÉRIODE</td></tr>`}</tbody></table>
</div>`,
      foot: `<button type="button" class="svc-b" data-x>FERMER</button><button type="button" class="svc-b" data-all>TOUT COCHER</button><button type="button" class="svc-b svc-ok svc-neutral" data-mk${sel.size ? "" : " disabled"}>CRÉER LES PAIEMENTS (${sel.size})</button>` });
    if (!d.isConnected) sviWinShow(d); };
  draw();
  d.addEventListener("change", e => { const c = e.target.closest(".pp-cb"); if (!c) return; if (c.checked) sel.add(c.dataset.fa); else sel.delete(c.dataset.fa); draw(); });
  d.addEventListener("click", e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (done) done(); return; }
    const h = e.target.closest("[data-hz]"); if (h) { hz = h.dataset.hz; draw(); return; }
    if (e.target.closest("[data-all]")) { achPafPropRows().filter(r => r.ok && r.ech <= end()).forEach(r => sel.add(r.f.id)); draw(); return; }
    if (!e.target.closest("[data-mk]") || !sel.size) return;
    const rows = achPafPropRows().filter(r => sel.has(r.f.id) && r.ok), by = new Map(); rows.forEach(r => { if (!by.has(r.f.frs)) by.set(r.f.frs, []); by.get(r.f.frs).push(r); });
    const L = achPaf(), made = [];
    by.forEach((rs, frs) => { const fr = achFrs().find(x => x.id === frs), aff = rs.map(r => ({ fa: r.f.id, m: Math.round(r.reste * 100) / 100 })), tot = aff.reduce((t, a) => t + a.m, 0);
      let left = tot - 0.01; const ded = []; achAvf().filter(a => a.frs === frs && a.state !== "annule" && achAvfReste(a) > 0.005).forEach(a => { if (left <= 0) return; const m = Math.min(achAvfReste(a), left); ded.push({ av: a.id, m: Math.round(m * 100) / 100 }); left -= m; });
      const p = { id: achId("P"), ref: achNextRef("PAF", L), type: "reglement", frs, mode: fr && ACH_MODES.includes(fr.modeReg) ? fr.modeReg : "VIREMENT", num: "", echL: "", date: new Date().toISOString().slice(0, 10), cmf: "",
        aff, ded, mt: Math.round((tot - ded.reduce((t, x) => t + x.m, 0)) * 100) / 100, state: "instance", motif: "", cree: achNow() };
      L.push(p); made.push(p); achHist(p.ref, "CRÉATION", "PROPOSITION DE PAIEMENT — " + (fr ? fr.nom : "") + " — " + achF2(p.mt)); });
    achPafSave(L); svToast(made.length + " PAIEMENT(S) CRÉÉ(S) EN INSTANCE : À VÉRIFIER PUIS VALIDER.", 4000); d.remove(); if (done) done();
  });
}
window.SVI_LIST_EXTRA = (window.SVI_LIST_EXTRA || []).concat([{ when: t => /^PAIEMENTS/.test(t), items: [{ k: "pafprop", lab: "PROPOSITION DE PAIEMENT" }], act: () => achPafProp(() => { const v = document.getElementById("ach"); if (v && v.__achTab) v.__achTab("paf"); }) }]);
/* ⟪ src/47-achats-liste-page.js ⟫ */
/* =========================================================
   v764 : LISTES ET PAGES DES ACHATS AU FORMAT DU BUDGET (décision d'Ahmed du 01/11/2026, d'après NovApp)
   LISTE : deux listes, EN INSTANCE et VALIDÉS, basculées par l'icône à côté du titre (comme les budgets) ; à gauche le
   tableau des dates (bouton d'état ACTIF ▾, une ligne par date avec son nombre ; toucher une date filtre la liste) ;
   en bas une ligne CRÉER … ICI toujours visible : elle ouvre la fenêtre de saisie (tous les champs) ; après ENREGISTRER,
   l'élément prend sa place en instance et la ligne vide attend en bas. Les éléments en instance sont en rouge, avec la corbeille.
   PAGE (toucher la référence) : comme la page d'un budget — en-tête (référence, H, nom), toucher le NOM ouvre la fenêtre des
   informations ; DOCUMENTS / TAF / OBSERVATIONS dans UN bloc à trois onglets ; menu ⋯ (VALIDER, UNITÉ DE CONVERSION…) ;
   dessous, les tableaux liés (consultations, devis, commandes…). ‹ › : élément précédent / suivant de la liste.
   Appliqué aux ARTICLES et aux FOURNISSEURS ; les autres listes suivront.
   ========================================================= */
/* v921 (remarque 3 du 04/11/2026) : même cycle que le budget — EN INSTANCE (rouge) → FIGÉ (vert) → VALIDÉ (noir) ;
   un élément figé reste dans la liste EN INSTANCE (achSt = « instance »), en vert ; achStF dit l'état exact */
const achSt = x => x && (x.st === "instance" || x.st === "fige") ? "instance" : "valide";
const achStF = x => x && x.st === "fige" ? "fige" : achSt(x);
const achDay = v => String(v || "").slice(0, 10);
const ACH_TRASH = `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>`;
const ACH_SW = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ---------- bloc DOCUMENTS / TAF / OBSERVATIONS d'un élément des achats (clés partagées svi_docs|taf|obs_v1:ACH-<code>) ---------- */
function achRecBlock(code) {
  const K = { doc: "svi_docs_v1:ACH-" + code, taf: "svi_taf_v1:ACH-" + code, obs: "svi_obs_v1:ACH-" + code };
  const get = k => { const L = achJ(K[k], []); return Array.isArray(L) ? L : []; };
  let tab = "doc"; try { const t = localStorage.getItem("svi_ach_rtab_v1"); if (K[t]) tab = t; } catch (e) {}
  const dt = v => svDT ? svDT(v || "") : String(v || "");
  const html = ctx => {
    const L = get(tab);
    const head = { doc: ["RÉFÉRENCE", "DATE", "INTITULÉ", "FICHIER"], taf: ["RÉFÉRENCE", "DATE", "TÂCHE", "ÉCHÉANCE", "FAIT"], obs: ["DATE", "OBSERVATION", "IMPORTANTE"] }[tab];
    /* v793 : SUIVI des fiches d'achat au format du SUIVI du budget — loupe sur chaque colonne, largeur des colonnes réglable et gardée */
    const ACC = { doc: [x => x.ref || "", x => dt(x.date), x => x.title || "", x => x.fk ? "OUVRIR" : ""], taf: [x => x.ref || "", x => dt(x.date), x => x.title || "", x => achDFr(x.ech), x => x.done ? "OUI" : "NON"], obs: [x => dt(x.date), x => x.text || "", x => x.important ? "!" : ""] }[tab];
    const tk = "achrec_" + tab, C = head.map((h, j) => ["c" + j, h, r => ACC[j](r.x), /FICHIER|FAIT|IMPORTANTE/.test(h) ? "center" : ""]);
    const R0 = L.map((x, i) => ({ x, i })).reverse(), R = ctx && ctx.cfApply ? ctx.cfApply(tk, C, R0) : R0;
    const CG = sviCwCols(tk, C.map((c, j) => [c[0], /DATE|ÉCHÉANCE/.test(c[1]) ? 140 : c[3] === "center" ? 100 : j === 0 && tab !== "obs" ? 170 : 260]));
    const th = c => ctx && ctx.cfHead ? ctx.cfHead(tk, c[0], c[1], c[3]) : `<th class="${c[3]}">${esc(c[1])}</th>`;
    const row = (x, i) => tab === "doc" ? `<td>${esc(x.ref || "")}</td><td>${esc(dt(x.date))}</td><td>${esc(x.title || "")}</td><td class="center">${x.fk ? `<button type="button" class="ach-link" data-recf="${i}">OUVRIR</button>` : ""}</td>`
      : tab === "taf" ? `<td>${esc(x.ref || "")}</td><td>${esc(dt(x.date))}</td><td>${esc(x.title || "")}</td><td>${esc(achDFr(x.ech))}</td><td class="center"><input type="checkbox" class="rec-done" data-i="${i}"${x.done ? " checked" : ""}></td>`
      : `<td>${esc(dt(x.date))}</td><td>${esc(x.text || "")}</td><td class="center">${x.important ? "<b>!</b>" : ""}</td>`;
    /* v776 : bloc SUIVI comme celui du budget — en-tête SUIVI (agrandir, ⋯), rangée d'onglets, ligne CRÉER … ICI */
    return `<div class="bdg-d-block blk-rec blk-suivi nvp-rec nvp-blk" data-nvb="rec"><div class="bdg-d-block-title blk-head"><span class="ttl">${SVI_ICON.doc || ""}SUIVI</span>${achBlkTools("rec")}</div>
      <div class="blk-tabrow"><span class="rec-tabs">${["doc", "taf", "obs"].map(k => `<button type="button" class="rec-tab${k === tab ? " active" : ""}" data-nvr="${k}">${SVI_ICON[k] || ""}${{ doc: "DOCUMENTS", taf: "TAF", obs: "OBSERVATIONS" }[k]} ${svCnt(get(k).length)}</button>`).join("")}</span></div>
      <div class="rec-scroll" style="max-height:var(--nvh-rec, var(--svi-hdef-a, 200px))"><table class="bdg-d-table rec-table" data-svcw="${tk}" style="${CG.style}">${CG.cg}<thead><tr>${C.map(th).join("")}</tr></thead>
        <tbody>${R.map(r => `<tr>${row(r.x, r.i)}</tr>`).join("")}<tr class="rec-new" data-nvradd><td colspan="${head.length}">${{ doc: "CRÉER UN DOCUMENT ICI…", taf: "CRÉER UN TAF ICI…", obs: "CRÉER UNE OBSERVATION ICI…" }[tab]}</td></tr></tbody></table></div><div class="blk-rsz nvp-rsz" data-nvh="rec" title="Glisser pour changer la hauteur"></div></div>`;
  };
  const add = () => new Promise(ok => {
    const d = sviWinNew(), now = new Date().toISOString();
    d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: { doc: "NOUVEAU DOCUMENT", taf: "NOUVELLE TÂCHE", obs: "NOUVELLE OBSERVATION" }[tab] + " — " + esc(code),
      body: `<div class="frs-g">${tab === "obs" ? `<label class="frs-f frs-w"><span>OBSERVATION <b>*</b></span><input class="ins-in nr-t" autocomplete="off"></label><div class="frs-cs"><label class="frs-c"><input type="checkbox" class="nr-i"> IMPORTANTE (!)</label></div>`
        : `<label class="frs-f frs-w"><span>${tab === "doc" ? "INTITULÉ" : "TÂCHE"} <b>*</b></span><input class="ins-in nr-t" autocomplete="off"></label>${tab === "doc" ? `<label class="frs-f frs-w"><span>FICHIER</span><input type="file" class="nr-f"></label>` : `<label class="frs-f"><span>ÉCHÉANCE</span><input type="date" class="ins-in nr-e"></label>`}`}</div>`,
      foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button>` });
    sviWinShow(d);
    d.addEventListener("click", async e => {
      if (e.target === d || e.target.closest("[data-x]")) { d.remove(); ok(false); return; }
      if (!e.target.closest("[data-ok]")) return;
      const t = achU(d.querySelector(".nr-t").value); if (!t) { svToast("À REMPLIR.", 2500); return; }
      const L = get(tab), n = L.length + 1, x = tab === "obs" ? { date: now, text: t, important: d.querySelector(".nr-i").checked } : { ref: "ACH " + (tab === "doc" ? "DOC" : "TAF") + " " + code + "/" + String(n).padStart(3, "0"), date: now, title: t };
      if (tab === "taf") x.ech = d.querySelector(".nr-e").value;
      const f = tab === "doc" && d.querySelector(".nr-f").files[0];
      if (f) { try { const k = "ach:doc:" + code + ":" + Date.now().toString(36); await sviFiles.put(k, f); x.fk = k; x.fname = f.name; } catch (err) {} }
      L.push(x); achW(K[tab], L); achHist(code, tab === "obs" ? "OBSERVATION" : tab === "doc" ? "DOCUMENT" : "TAF", t); d.remove(); ok(true);
    });
  });
  /* rend true si le geste concerne le bloc ; redraw() redessine la page */
  const click = async (e, redraw) => {
    const t = e.target.closest("[data-nvr]"); if (t) { tab = t.dataset.nvr; try { localStorage.setItem("svi_ach_rtab_v1", tab); } catch (err) {} redraw(); return true; }
    if (e.target.closest("[data-nvradd]")) { if (await add()) redraw(); return true; }
    const f = e.target.closest("[data-recf]"); if (f) { const x = get("doc")[+f.dataset.recf]; if (x && x.fk) achCopyOpen(x.fk); return true; }
    return false;
  };
  const change = e => { const c = e.target.closest(".rec-done"); if (!c) return false; const L = get("taf"), x = L[+c.dataset.i]; if (x) { x.done = c.checked; achW(K.taf, L); } return true; };
  /* v783 : GÉNÉRER PDF de l'aperçu = classé dans DOCUMENTS de la pièce */
  const savePdf = async (blob, name) => { const L = get("doc"), n = L.length + 1, k = "ach:doc:" + code + ":" + Date.now().toString(36);
    try { await sviFiles.put(k, new File([blob], name, { type: "application/pdf" })); } catch (e) {}
    const x = { ref: "ACH DOC " + code + "/" + String(n).padStart(3, "0"), date: new Date().toISOString(), title: name.replace(/\.pdf$/i, ""), fk: k, fname: name };
    L.push(x); achW(K.doc, L); achHist(code, "DOCUMENT", x.title); return x.ref; };
  return { html, click, change, savePdf };
}

/* ---------- LISTE au format du budget ----------
   o = { k, t, name ("ARTICLES"), one ("ARTICLE"), all(), save(L), code(x), nom(x), cols(mode), why(x), newRow, add(done), page(id) } */
function achNvList(ctx, o) {
  const { cfApply, cfHead, draw } = ctx;
  const ETATS = [["actif", "ACTIF"], ["inactif", "INACTIF"], ["corbeille", "CORBEILLE"], ["tout", "TOUT"]];
  const KM = "svi_ach_" + o.k + "_mode_v1", KE = "svi_ach_" + o.k + "_etat2_v1";
  let mode = "valid", etat = "actif", dSel = "", order = [], chosen = false;
  try { mode = localStorage.getItem(KM) === "inst" ? "inst" : "valid"; const e0 = localStorage.getItem(KE); if (ETATS.some(x => x[0] === e0)) etat = e0; } catch (e) {}
  /* v765 : crochets pour les pièces (consultations, devis, commandes…) — o.etats / o.ok, o.inst, o.dI / o.dV, o.kill, o.bang */
  if (o.etats) ETATS.splice(0, ETATS.length, ...o.etats);
  try { const e1 = localStorage.getItem(KE); if (e1 && ETATS.some(x => x[0] === e1)) etat = e1; } catch (e) {} if (!ETATS.some(x => x[0] === etat)) etat = ETATS[0][0];
  const isI = x => o.inst ? !!o.inst(x) : achSt(x) === "instance";
  const eOk = (x, k, L) => o.ok ? o.ok(x, k, L) : k === "tout" ? true : k === "corbeille" ? !!x.del : !x.del && (k === "inactif" ? x.actif === false : x.actif !== false);
  const mOk = x => mode === "inst" ? isI(x) : !isI(x);
  const dOf = x => mode === "inst" ? achDay(o.dI ? o.dI(x) : x.cree) : achDay(o.dV ? o.dV(x) : x.val || x.cree);
  /* v766 : MÊME FORME QUE LA LISTE DES BUDGETS (mêmes classes : novapp-list-shell, novapp-date-panel, novapp-budget-table) ;
     colonnes : celles de la liste puis SAISI LE (en instance) ou VALIDÉ LE et SAISI LE (validés), dates au format du budget ;
     corbeille en bout de ligne et CRÉER … ICI seulement dans la liste EN INSTANCE (comme les budgets) */
  const dI = x => o.dI ? o.dI(x) : x.cree, dV = x => o.dV ? o.dV(x) : x.val || x.cree;
  const colsOf = () => o.cols(mode).filter(c => c[1] !== "SAISI LE" && c[1] !== "VALIDÉ LE")
    .concat(mode === "valid" ? [["_val", "VALIDÉ LE", x => svDT(dV(x) || ""), ""]] : []).concat([["_cree", "SAISI LE", x => svDT(dI(x) || ""), ""]]);
  const counts = () => { const A = o.all(), L = A.filter(x => eOk(x, etat, A)); return { inst: L.filter(isI).length, valid: L.filter(x => !isI(x)).length }; };
  const h1 = () => {
    const n = counts(), keep = chosen; chosen = false; if (!keep && !n[mode] && n[mode === "inst" ? "valid" : "inst"]) mode = mode === "inst" ? "valid" : "inst";
    const other = mode === "inst" ? "valid" : "inst", can = other === "inst" || n[other] > 0;
    return esc(o.name) + (mode === "inst" ? " (EN INSTANCE)" : " (VALIDÉS)") + ` <span class="bdgl-cnt">${svCnt(n[mode])}</span>`
      + `<button type="button" class="bdg-mode-sw${can ? "" : " off"}" data-nvsw title="${can ? (other === "inst" ? "VOIR LA LISTE EN INSTANCE" : "VOIR LA LISTE DES VALIDÉS") : "RIEN DE VALIDÉ."}" aria-label="BASCULER">${ACH_SW}</button>`;
  };
  const html = () => {
    const t1 = h1();
    const all = o.all(), base = all.filter(x => eOk(x, etat, all) && mOk(x));
    const days = [...base.reduce((m, x) => m.set(dOf(x), (m.get(dOf(x)) || 0) + 1), new Map())].sort((a, b) => b[0].localeCompare(a[0]));
    if (dSel && !days.some(d => d[0] === dSel)) dSel = "";
    const rows0 = base.filter(x => !dSel || dOf(x) === dSel), cols = coOrder(o.t + (mode === "inst" ? "_i" : "_v"), colsOf()), rows = cfApply(o.t, cols, rows0);
    order = rows.map(x => x.id);
    const inst = mode === "inst", W = o.w || {}, CW = cwLoad(), tot = cols.reduce((t, c) => t + (W[c[0]] || 120), 0);
    const cell = (x, c) => { const v = c[2](x), cl = c[3] === "number" ? "number" : "";
      if (c[0] === "ref") { const w = o.why(x, all); return `<td class="bdg-ref-c">${w.length ? `<b class="obs-bang val-bang nv-bang" role="button" data-why="${esc(w.join(" · "))}">!</b> ` : ""}${esc(v)}</td>`; }
      /* v910 (checklist C1.38) : 5e élément d'une colonne = image (logo) devant le texte, à la hauteur de la ligne */
      const im = c[4] ? c[4](x) : "";
      const t = typeof v === "number" ? achF2(v) : String(v ?? ""); return `<td class="${cl}" title="${esc(t)}">${im ? `<img class="nv-logo" src="${esc(im)}" alt="">` : ""}${esc(t)}</td>`; };
    return `<div class="novapp-list-shell"><div class="novapp-list-titlebar"><button class="novapp-menu open-menu" type="button" aria-label="Menu">☰</button><h1>${t1}</h1>${sviListBar()}</div>
      <div class="novapp-budget-layout"><aside class="novapp-date-panel svi-bdgp">
        <div class="novapp-date-head"><button type="button" class="novapp-date-filter" data-a="${o.k}-etat"><span>${(ETATS.find(x => x[0] === etat) || ETATS[0])[1]} <i class="dt-arr">▾</i></span>${svCnt(base.length)}</button></div>
        <div class="novapp-date-list">${days.map(([d, n]) => `<button type="button" data-nvday="${esc(d)}" class="novapp-date-item ${d === dSel ? "selected" : ""}"><span>${esc(achDFr(d) || "SANS DATE")}</span>${svCnt(n)}</button>`).join("")}</div></aside>
      <div class="novapp-budget-table-wrap"><table id="${o.id}" class="novapp-budget-table svi-bdgl${inst ? " nv-inst" : ""}" data-ach="${o.k}">
        <colgroup>${cols.map(c => `<col data-w="${o.t}.${c[0]}" style="width:${CW[o.t + "." + c[0]] ? CW[o.t + "." + c[0]] + "px" : ((W[c[0]] || 120) / tot * 100).toFixed(2) + "%"}">`).join("")}<col style="width:44px"><col style="width:40px"></colgroup>
        <thead><tr>${cols.map(c => cfHead(o.t, c[0], c[1], "bdg-list-head" + (c[3] === "number" ? " number" : ""))).join("")}<th class="bdg-act-h"></th>${sviListCbTh()}</tr></thead>
        <tbody>${rows.map(x => `<tr data-id="${esc(x.id)}" data-iid="${esc(x.id)}" data-nvo="${esc(x.id)}" class="${x.st === "fige" ? "inst-fige" : isI(x) ? "inst-instance" : "inst-valide"}${x.del || x.state === "annule" ? " etat-bloque" : ""}${x.actif === false ? " etat-archive" : ""}">${cols.map(c => cell(x, c)).join("")}<td class="bdg-action-cell">${inst && !x.del && x.state !== "annule" ? `<button type="button" class="bdg-row-action bdg-row-del" data-nvdel="${esc(x.id)}" title="Supprimer" aria-label="Supprimer">${SVI_DEL_ICON}</button>` : ""}</td>${sviListCbTd()}</tr>`).join("")
          || ""}
          ${inst && etat !== "corbeille" && etat !== "inactif" && etat !== "annule" ? `<tr class="bdg-newrow" data-nvnew><td colspan="${cols.length + 2}">${esc(o.newRow)}</td></tr>` : ""}</tbody></table></div></div></div>`;
  };
  const click = async e => {
    if (e.target.closest("[data-nvsw]")) { const b = e.target.closest("[data-nvsw]"); if (b.classList.contains("off") && mode === "inst") { svToast(b.title, 2500, b); return true; } mode = mode === "inst" ? "valid" : "inst"; dSel = ""; chosen = true; try { localStorage.setItem(KM, mode); } catch (err) {} draw(); return true; }
    const dy = e.target.closest("[data-nvday]"); if (dy) { dSel = dSel === dy.dataset.nvday ? "" : dy.dataset.nvday; draw(); return true; }
    const eb = e.target.closest(`[data-a="${o.k}-etat"]`);
    if (eb) { const L = o.all(); sviEtatMenu(eb, ETATS.map(([k, lab]) => ({ k, lab, n: L.filter(x => eOk(x, k, L) && mOk(x)).length })), etat, k => { etat = k; try { localStorage.setItem(KE, k); } catch (err) {} draw(); }); return true; }
    const w = e.target.closest(".nv-bang"); if (w) { e.stopPropagation(); svToast(w.dataset.why, 4000, w); return true; }
    const dl = e.target.closest("[data-nvdel]");
    if (dl && o.kill) { const x = o.all().find(y => y.id === dl.dataset.nvdel); if (x && await o.kill(x)) draw(); return true; }
    if (dl) { const L = o.all(), x = L.find(y => y.id === dl.dataset.nvdel); if (!x) return true;
      if (!(await svConfirm({ title: "SUPPRIMER" + (o.one ? " " + achCe(o.one) : ""), text: o.code(x) + " — " + o.nom(x) + " (RESTAURABLE DEPUIS LA CORBEILLE ; SON NUMÉRO NE SERA PAS RÉUTILISÉ).", ok: "SUPPRIMER" }))) return true;
      x.del = achNow(); x.mod = x.del; o.save(L); achHist(o.code(x), "CORBEILLE", o.nom(x)); draw(); return true; }
    if (e.target.closest("[data-nvnew]")) { o.add(id => { if (id) { mode = "inst"; try { localStorage.setItem(KM, mode); } catch (err) {} } draw();
      if (id && id !== "x" && o.page && o.all().some(x => x.id === id)) o.page(id); }); return true; }   /* v800 (3.6) : la page de la nouvelle pièce s'ouvre */
    const r = e.target.closest("button, .cf-btn, thead") ? e.target.closest("button[data-nvo]") : e.target.closest("[data-nvo]");
    if (r) { o.page(r.dataset.nvo || r.dataset.id); return true; }
    return false;
  };
  return { html, click, h1, order: () => order };
}

/* ---------- PAGE d'un élément ----------
   p = { id, code, nom, title, st, why[], del, info(), menu: [{k, lab}], act(k), links: [{ t, cols:[lab…], rows:[{cells:[…], cls, open}] }] } */
/* v771 : hauteur des blocs de la page — 5 lignes par défaut, défilement au-delà, poignée en bas (hauteur mémorisée par bloc) */
/* v919 (remarque 5 du 04/11/2026) : libellés communs « SUPPRIMER CE … » — CE / CET (voyelle) / CETTE (noms féminins des achats) */
const achCe = n => { const u = String(n || "").toUpperCase(); return (/^(CONSULTATION|COMMANDE|RÉCEPTION|FACTURE|DEMANDE|PIÈCE|ÉVALUATION)/.test(u) ? "CETTE " : /^[AEIOUÉÈÊH]/.test(u) ? "CET " : "CE ") + u; };
/* B3 : état d'une pièce d'après le libellé de son état (colonne ÉTAT d'un bloc lié) */
const achStTxt = v => { const u = String(v || "").toUpperCase(); if (!u) return ""; if (/ANNUL|REJET/.test(u)) return "";
  if (/PARTIEL/.test(u)) return "partiel"; if (/FIG/.test(u)) return "fige"; if (/ÉMIS|REMIS/.test(u)) return "remis"; if (/INSTANCE|OUVERTE|RÉCLAM|ATTENTE/.test(u)) return "instance"; return "valide"; };
const achNvhKey = t => String(t).toLowerCase().replace(/[^a-z]+/g, "");
const ACH_NVH_K = "svi_ach_nvh_v1";
const achNvhStyle = () => { let H = {}; try { H = JSON.parse(localStorage.getItem(ACH_NVH_K) || "{}") || {}; } catch (e) {} return Object.keys(H).map(k => "--nvh-" + k + ":" + H[k] + "px").join(";"); };
function achNvhDrag(e, h) {
  e.preventDefault(); const pg = h.closest(".nvp"), k = h.dataset.nvh, sc = h.parentNode.querySelector(".rec-scroll"); if (!pg || !sc) return;
  const y0 = e.clientY, b0 = sc.getBoundingClientRect().height; let v = b0; h.classList.add("on");
  const mv = ev => { ev.preventDefault(); v = Math.max(60, Math.round(b0 + ev.clientY - y0)); pg.style.setProperty("--nvh-" + k, v + "px"); };
  const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up); h.classList.remove("on");
    try { const H = JSON.parse(localStorage.getItem(ACH_NVH_K) || "{}") || {}; H[k] = v; localStorage.setItem(ACH_NVH_K, JSON.stringify(H)); } catch (err) {} };
  document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
}
/* v776 : PAGE au format exact de l'écran d'un budget — en-tête : ☰, RÉFÉRENCE (rouge soulignée en instance), i (informations), H (historique),
   barre commune à droite ; étiquette de l'écran en haut au centre ; puis les blocs liés (agrandir, ⋯) et le SUIVI (DOC / TAF / OBS) */
const ACH_MAX_IC = '<svg class="ic-max" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6.5v-4h4M2.5 2.5l4.5 4.5M13.5 9.5v4h-4M13.5 13.5 9 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><svg class="ic-min" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M7 3v4H3M7 7 2.5 2.5M9 13V9h4M9 9l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const achBlkTools = k => `<span class="blk-tools"><button type="button" class="blk-btn blk-max-btn" data-nvmax="${esc(k)}" title="Agrandir / réduire">${ACH_MAX_IC}</button><button type="button" class="blk-more" data-nvmore="${esc(k)}" title="Actions" aria-label="Actions">⋯</button></span>`;
/* v790 (DOCUMENT UNIQUE §6) : blocs des pages d'achat au format commun des tableaux — loupe de tri / filtre sur chaque colonne,
   case à cocher à droite (case d'en-tête), pas de ligne « AUCUN » (le compteur 0 suffit), ligne TOTAL dans LIGNES */
function achNvPageHTML(p, rec, ctx) {
  const blk = L => { const k = achNvhKey(L.t), t = "achp_" + k, n = L.cols.length;
    const C = L.cols.map((c, j) => ["c" + j, c[0], r => r.cells[j], c[1] || ""]);
    const R0 = L.rows.map((r, i) => ({ ...r, __i: i })), R = ctx && ctx.cfApply ? ctx.cfApply(t, C, R0) : R0;
    const head = C.map(c => ctx && ctx.cfHead ? ctx.cfHead(t, c[0], c[1], c[3]) : `<th class="${c[3]}">${esc(c[1])}</th>`).join("");
    /* v793 : largeur des colonnes réglable et gardée (moteur commun sviCwCols / data-svcw) */
    const CG = sviCwCols(t, C.map((c, j) => [c[0], j === 0 ? 170 : /number/.test(c[3]) ? 110 : /center/.test(c[3]) ? 90 : 150]), [["_cb", 40]]);
    const iM = L.cols.findIndex(c => /^MONTANT/.test(c[0])), isL = /^LIGNES/.test(L.t) && iM >= 0;
    /* B3 (série B, 04/11/2026) : toute la ligne d'une pièce liée prend la couleur de son état (rouge, vert, bleu, orange, noir) */
    const iE = L.cols.findIndex(c => /^ÉTAT|^RÉPONSE/.test(c[0])), stOf = r => r.st !== undefined ? r.st : iE < 0 ? "" : achStTxt(r.cells[iE]);
    const tot = isL ? R.reduce((s2, r) => s2 + (typeof r.cells[iM] === "number" ? r.cells[iM] : achN(r.cells[iM]) || 0), 0) : 0;
    return `<div class="bdg-d-block nvp-blk" data-nvb="${k}"><div class="bdg-d-block-title blk-head"><span class="ttl">${esc(L.t)} ${svCnt(R.length, L.rows.length)}</span>${achBlkTools(k)}</div>
      <div class="rec-scroll" style="max-height:var(--nvh-${k}, var(--svi-hdef-a, 200px))"><table class="bdg-d-table rec-table" data-colh="${esc(t)}" data-svcw="${esc(t)}" style="${CG.style}">${CG.cg}<thead><tr>${head}<th class="center nvp-cbh"><input type="checkbox" class="nvp-all" aria-label="Tout cocher"></th></tr></thead>
      <tbody>${R.map(r => `<tr class="${r.cls || ""}${stOf(r) ? " nvr-" + stOf(r) : ""}">${r.cells.map((v, j) => { const g = (r.go || []).find(z => z[0] === j); return `<td class="${L.cols[j][1] || ""}">${j === 0 && r.open ? `<button type="button" class="ach-link" data-nvl="${esc(L.t)}|${r.__i}">${esc(v)}</button>` : g ? `<button type="button" class="ach-link" data-nvgo="${esc(g[1] + "|" + g[2])}">${esc(v)}</button>` : esc(typeof v === "number" ? achF2(v) : v)}</td>`; }).join("")}<td class="center"><input type="checkbox" class="nvp-cb"></td></tr>`).join("")}${L.add ? `<tr class="rec-new" data-nvadd="${k}"><td colspan="${n + 1}">${esc(L.add)}</td></tr>` : ""}</tbody>
      ${isL ? `<tfoot><tr class="bdg-d-total-row">${L.cols.map((c, j) => j === iM ? `<td class="number">${achF2(tot)}</td>` : j === iM - 1 ? `<td class="number">${R.length < L.rows.length ? "TOTAL PARTIEL" : "TOTAL"}</td>` : "<td></td>").join("")}<td></td></tr></tfoot>` : ""}</table></div>
      <div class="blk-rsz nvp-rsz" data-nvh="${k}" title="Glisser pour changer la hauteur"></div></div>`; };
  return `<div class="nvp bdg-d-page ${p.st === "fige" && !p.del ? "bdg-inst-fige" : p.st === "instance" && !p.del ? "bdg-inst-instance" : "nvp-valide"}" style="${achNvhStyle()}">
    <div class="bdg-d-sticky"><div class="novapp-list-titlebar">
      <button type="button" class="novapp-menu open-menu" aria-label="Menu">☰</button>
      <h1 class="bdg-d-h1 nvp-ref${p.del ? " nv-strike" : ""}">${esc(p.ref || p.code)}</h1>
      <span class="bdg-d-badge bdg-d-inf" data-nvp="info" role="button" title="Informations">i</span>
      <span class="bdg-d-badge ach-h" data-h="${esc(p.code)}" role="button" title="Historique">H</span>
      ${p.partyGo ? `<button type="button" class="ach-link nvp-party" data-nvgo="${esc(p.partyGo)}">${esc(p.party)}</button>` : ""}
      ${sviHdrBar({ attr: "nvp", n: p.why.length, why: { undo: "RIEN À ANNULER SUR CETTE FICHE.", redo: "RIEN À RÉTABLIR SUR CETTE FICHE.", todo: p.why.length ? "" : "AUCUNE ALERTE." } })}
    </div></div>
    ${p.links.map(blk).join("")}
    ${rec.html(ctx)}
  </div>`;
}
/* module complet liste + page : cfg = { list: options de achNvList (sans page), pageOf(id) → p, back } */
/* v783 : APERÇU d'une pièce ou d'une fiche — l'éditeur MISE EN PAGE unique (sviMep) ; corps = LIGNES (sinon le premier bloc lié) */
/* v819 : mise en page des pièces (étape 6) — montant en lettres et mention à reporter sous les totaux, ICE / IF de la société en champ ;
   o.noPrice : BON SANS PRIX pour le chauffeur ou le magasin (C6.68) — prix, montants et totaux retirés */
/* B28 : champs cochés IMPRIMÉ SUR LA COMMANDE (réglages du champ), quelle que soit leur origine : fournisseur, commande, devis, besoin */
const achPrtAuto = P => { const C = achCmf().find(c => c.ref === (P.ref || P.code)); if (!C || typeof sviFlds !== "function") return [];
  const R = { cmf: C, frs: achFrs().find(f => f.id === C.frs), dvf: achDvf().find(v => v.id === C.dvf), bsn: achBsn().find(b => (C.lignes || []).some(l => l.bsn === b.id)) };
  return Object.entries(sviFlds()).filter(([, S]) => S.prt).map(([k, S]) => { const f = (String(k).match(/^c:([^|]*)\|/) || [])[1], rec = R[S.src]; const v = f && rec ? rec[f] : "";
    return [String(k).replace(/[^a-z0-9]/gi, "_"), S.lab || S.olab || f, v === undefined || v === null ? "" : String(v)]; }).filter(x => x[2] !== ""); };
function achMepOpen(cfg, P, rec, redraw, o) {
  o = o || {};
  const Lg0 = P.links.find(l => /^LIGNES|^DÉTAIL FACTURE FOURNISSEUR/.test(l.t)) || P.links[0] || { t: "", cols: [], rows: [] };
  /* v786 : l'aperçu suit les colonnes affichées à l'écran */
  const tb = document.querySelector(`#ach table[data-colh="achp_${achNvhKey(Lg0.t)}"]`), vis = tb ? sviColhVis(tb) : null, vf = a => vis ? a.filter((_, i) => vis.includes(i)) : a;
  let Lg = { ...Lg0, cols: vf(Lg0.cols), rows: Lg0.rows.map(r => ({ ...r, cells: vf(r.cells) })) };
  if (o.noPrice) { const keep = Lg.cols.map((c, i) => /PU|PRIX|MONTANT|TVA/.test(c[0]) ? -1 : i).filter(i => i >= 0); Lg = { ...Lg, cols: keep.map(i => Lg.cols[i]), rows: Lg.rows.map(r => ({ ...r, cells: keep.map(i => r.cells[i]) })) }; }
  const K = cfg.list.k, pr = achPrm(), lettres = P.ttc && !o.noPrice ? "ARRÊTÉ(E) À LA SOMME DE : " + frMoney(P.ttc) + " TTC." : "";
  const mention = K === "cmf" ? "N° " + (P.ref || P.code) + " À REPORTER SUR LE BON DE LIVRAISON ET LA FACTURE." : K === "caf" ? "MERCI DE RAPPELER LA RÉFÉRENCE " + (P.ref || P.code) + " DANS VOTRE DEVIS." : "";
  /* B14 (série B) : mentions de la société cochées dans ACHATS › PARAMÈTRES (valeurs de PARAMÉTRAGE GÉNÉRAL › SOCIÉTÉ) */
  const SO = sviSoc(), soc = SVI_SOC_F.filter(([f]) => f !== "rs" && f !== "adr" && pr.ment[f] && SO[f]).map(([f, l]) => l + " : " + SO[f]).join(" — ");
  sviMep.open({ key: "ACH-" + String(cfg.list.k || "X").toUpperCase() + (o.noPrice ? "-SP" : ""), title: cfg.list.one + (o.noPrice ? " (SANS PRIX)" : ""), ref: P.ref || P.code, party: P.party || P.title, date: P.date || "", prelim: P.st === "instance" || P.st === "fige",
    cols: Lg.cols.map((c, i) => ["c" + i, c[0], c[1] || ""]), rows: Lg.rows.map(r => r.cells), tot: o.noPrice ? [] : P.tot || [], note: [lettres, mention, soc].filter(Boolean).join("\n"),
    auto: K === "cmf" ? achPrtAuto(P) : [],
    annex: K === "cmf" ? (() => { const C = achCmf().find(c => c.ref === (P.ref || P.code)), L = (C && Array.isArray(C.cla) ? C.cla : achClCopy(pr.clP)).filter(x => x.txt || x.t !== "autre");
      return { title: "CLAUSES PARTICULIÈRES", items: L.map(x => [x.t === "autre" ? "" : achCltLab(x.t), x.txt || ""]) }; })() : null,
    fields: { ...Object.fromEntries((K === "cmf" ? achPrtAuto(P) : []).map(([id, l, v]) => ["a_" + id, l + " : " + v])), projet: P.projet || "", ttc: P.ttc && !o.noPrice ? achF2(P.ttc) + " MAD" : "", numFrs: P.numFrs || "", lettres, mention, soc },
    name: (P.ref || P.code) + " " + cfg.list.one, save: async (b, n) => { const r = await rec.savePdf(b, n); if (redraw) setTimeout(redraw, 0); return r; } });
}
function achNvMod(ctx, cfg) {
  let pid = null, P = null, rec = null;
  const open = id => { pid = id; rec = null; ctx.draw(); };
  const LST = achNvList(ctx, { ...cfg.list, page: open });
  const html = () => {
    if (pid) { P = cfg.pageOf(pid); if (!P) pid = null; }
    if (!pid) return LST.html();
    if (!rec || rec.__c !== P.code) { rec = achRecBlock(P.code); rec.__c = P.code; }
    return achNvPageHTML(P, rec, ctx);
  };
  const h1 = () => pid && P ? esc(cfg.list.one) + " — " + esc(P.title) : LST.h1();
  const click = async e => {
    if (!pid) return LST.click(e);
    if (await rec.click(e, () => ctx.draw())) return true;
    const b = e.target.closest("[data-nvp]");
    if (b) { const k = b.dataset.nvp, ord = LST.order(), i = ord.indexOf(pid);
      if (k === "close") { pid = null; ctx.draw(); return true; }
      if (k === "prev" || k === "next") { const j = i + (k === "next" ? 1 : -1); if (i < 0 || j < 0 || j >= ord.length) { svToast(k === "next" ? "DERNIER DE LA LISTE." : "PREMIER DE LA LISTE.", 2000, b); return true; } open(ord[j]); return true; }
      if (k === "info") { P.info(() => ctx.draw()); return true; }
      if (b.classList.contains("hdr-off")) { svToast(b.dataset.why || "", 3000, b); return true; }
      if (k === "todo") { svToast("⚠ " + P.why.join(" · "), 5000, b); return true; }
      /* v774 : ⋯ principal commun — VALIDER en tête ; actions ; CORBEILLE / RESTAURER et FERMER en bas, séparés par un trait */
      /* v920 (remarques 1 et 2 du 04/11/2026) : même ordre que le ⋯ du budget — FIGER / VALIDER ; actions ; DISPOSITION PAR DÉFAUT ; SUPPRIMER (ou ANNULER / RESTAURER) et FERMER ; une icône par ligne */
      if (k === "more") { const M = P.menu.concat([{ k: "__apr", lab: "APERÇU" }]).concat(cfg.list.k === "cmf" || cfg.list.k === "rcp" ? [{ k: "__aprsp", lab: "BON SANS PRIX (CHAUFFEUR, MAGASIN)" }] : []), top = M.filter(m => m.k === "val" || m.k === "fige" || m.k === "defige"), bot = M.filter(m => m.k === "del" || m.k === "rest").map(m => ({ ...m, del: m.k === "del" })), mid = M.filter(m => !top.includes(m) && !["del", "rest"].includes(m.k));
        sviHdrMenu(b, [top, mid, [{ k: "__fmt", lab: "MODIFIER LE FORMAT" }, { k: "__lay", lab: "DISPOSITION PAR DÉFAUT" }], [...bot, { k: "__close", lab: "FERMER" }]], async a => { if (a === "__close") { pid = null; ctx.draw(); return; }
          if (a === "__fmt") { sviFmtCurWin(); return; }   /* v927 (remarque 12) */
          if (a === "__lay") { if (!(await sviLayAsk())) return; const pg = b.closest(".nvp") || document.querySelector("#ach .nvp"); sviLayReset(pg);
            try { localStorage.removeItem(ACH_NVH_K); } catch (e) {} if (pg) { pg.querySelectorAll(".nvp-max").forEach(x => x.classList.remove("nvp-max")); pg.removeAttribute("style"); } ctx.draw(); return; } if (a === "__apr") { achMepOpen(cfg, P, rec, () => ctx.draw()); return; } if (a === "__aprsp") { achMepOpen(cfg, P, rec, () => ctx.draw(), { noPrice: true }); return; } await P.act(a, () => ctx.draw(), id => open(id)); }); return true; }
    }
    /* v776 : AGRANDIR / RÉDUIRE un bloc de la page ; ⋯ du bloc (EXPORTER, APERÇU ; SUIVI : CRÉER) */
    const mx = e.target.closest("[data-nvmax]"); if (mx) { const bl = mx.closest(".nvp-blk"); const on = !bl.classList.contains("nvp-max"); bl.classList.toggle("nvp-max", on); mx.classList.toggle("on", on); return true; }
    const mo = e.target.closest("[data-nvmore]"); if (mo) { const k = mo.dataset.nvmore, bl = mo.closest(".nvp-blk"), L = P.links.find(x => achNvhKey(x.t) === k);
      const tsv = () => { const t = bl.querySelector("table"); return [...t.rows].filter(r => !r.classList.contains("rec-new")).map(r => [...r.cells].filter(c => !c.classList.contains("svi-colh")).map(c => c.textContent.trim()).join("\t")).join("\n"); };
      const bt = bl.querySelector("table"), vis = sviColhVis(bt), vf = a => a.filter((_, i) => vis.includes(i));
      sviHdrMenu(mo, [[{ k: "max", lab: bl.classList.contains("nvp-max") ? "RÉDUIRE" : "AGRANDIR" }, { k: "hdef", lab: sviBlkRows().n + " LIGNES (PAR DÉFAUT)" }, { k: "hred", lab: "MODE RÉDUIT (" + sviBlkRows().r + " LIGNE" + (sviBlkRows().r > 1 ? "S" : "") + ")" }].concat(k === "rec" ? [{ k: "add", lab: "CRÉER" }] : []), sviColhItems(bt), [{ k: "exp", lab: "EXPORTER" }, { k: "apr", lab: "APERÇU" }]], async a => {
        if (sviColhPick(a, bt)) return;
        if (a === "max") { bl.querySelector("[data-nvmax]")?.click(); return; }
        /* B4 (série B) : hauteur commune des blocs — lignes par défaut ou mode réduit (réglages communs), gardée par bloc */
        if (a === "hdef" || a === "hred") { const pg = bl.closest(".nvp"); let H = {}; try { H = JSON.parse(localStorage.getItem(ACH_NVH_K) || "{}") || {}; } catch (e) {}
          if (a === "hdef") { delete H[k]; pg && pg.style.removeProperty("--nvh-" + k); }
          else { const sc = bl.querySelector(".rec-scroll"), th = sc && sc.querySelector("thead"), r1 = sc && sc.querySelector("tbody tr"), v = Math.ceil((th ? th.getBoundingClientRect().height : 22) + sviBlkRows().r * (r1 ? r1.getBoundingClientRect().height : 21) + 4);
            H[k] = v; pg && pg.style.setProperty("--nvh-" + k, v + "px"); }
          try { localStorage.setItem(ACH_NVH_K, JSON.stringify(H)); } catch (e) {} return; }
        if (a === "add") { if (await rec.click({ target: bl.querySelector("[data-nvradd]") }, () => ctx.draw())) return; }
        const ttl = (P.ref || P.code) + " — " + (L ? L.t : "SUIVI");
        if (a === "exp") { const b = new Blob(["\ufeff" + tsv().split("\n").map(l => l.split("\t").map(v => /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
          const u = URL.createObjectURL(b), an = document.createElement("a"); an.href = u; an.download = ttl.replace(/[\\/:*?"<>|]/g, "-") + ".csv"; document.body.appendChild(an); an.click(); setTimeout(() => { URL.revokeObjectURL(u); an.remove(); }, 1000); }
        if (a === "apr") { const Lb = L || { t: "SUIVI", cols: [...bl.querySelectorAll("thead th")].map(th => [th.textContent.trim(), ""]), rows: [...bl.querySelectorAll("tbody tr:not(.rec-new)")].map(tr => ({ cells: [...tr.cells].map(c => c.textContent.trim()) })) };   /* v783 : l'aperçu unique (MISE EN PAGE) */
          sviMep.open({ key: "ACH-BLOC-" + achNvhKey(Lb.t).toUpperCase(), title: Lb.t, ref: P.ref || P.code, party: P.party || P.title, prelim: P.st === "instance" || P.st === "fige", cols: vf(Lb.cols).map((c, i) => ["c" + i, c[0], c[1] || ""]), rows: Lb.rows.map(r => vf(r.cells)), name: ttl, save: (b, n) => rec.savePdf(b, n) }); } });
      return true; }
    const na = e.target.closest("[data-nvadd]"); if (na) { const L = P.links.find(x => achNvhKey(x.t) === na.dataset.nvadd); if (L && L.addFn) L.addFn(() => ctx.draw()); else P.info(() => ctx.draw()); return true; }   /* v780 : ligne CRÉER … ICI */
    const gg = e.target.closest("[data-nvgo]"); if (gg) { const [t, gid] = gg.dataset.nvgo.split("|"); achGo(t, gid); return true; }   /* v800 (3.6 – 3.7) : un nom ouvre sa page */
    const l = e.target.closest("[data-nvl]"); if (l) { const [t, i] = l.dataset.nvl.split("|"), L = P.links.find(x => x.t === t), r = L && L.rows[+i]; if (r && r.open) r.open(() => ctx.draw()); return true; }
    return false;
  };
  const change = e => pid && rec ? rec.change(e) : false;
  return { html, click, change, h1, open, close: () => { pid = null; }, isPage: () => !!pid };
}

/* ---------- ARTICLES ---------- */
/* fenêtre des informations d'un article (création si id = null : l'article naît EN INSTANCE) */
function achArtFiche(id, done) {
  const a0 = id ? achArts().find(x => x.id === id) : null; if (id && !a0) return;
  const A = a0 ? JSON.parse(JSON.stringify(a0)) : { des: "", u: "", cat: "", stk: false, tva: achPrm().tva, pref: 0, pmax: 0, actif: true, cpt: "", cptI: "" };
  const ro = !!(a0 && (a0.del || a0.st === "fige")), dis = ro ? " readonly" : "", d = sviWinNew(), P = achPrm();
  const inp = (k, lab, o = {}) => `<label class="frs-f${o.w ? " frs-w" : ""}"><span>${lab}${o.req ? " <b>*</b>" : ""}</span><input class="ins-in art-x${o.num ? " number" : ""}" data-k="${k}" value="${esc(o.num ? (achN(A[k]) || k === "tva" ? achF2(A[k]) : "") : A[k] ?? "")}"${o.num ? ' inputmode="decimal"' : ""}${o.list ? ` list="artL-${k}"` : ""}${dis} autocomplete="off">${o.list ? `<datalist id="artL-${k}">${o.list.map(x => `<option value="${esc(x)}">`).join("")}</datalist>` : ""}</label>`;
  const units = (() => { try { return (typeof sviUnits === "function" ? sviUnits() : []).map(u => u.a || u).filter(Boolean); } catch (e) { return []; } })();
  d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: a0 ? esc(a0.des + " (" + a0.u + ") : " + achRefSvi(a0, achArts(), "ARA")) : "NOUVEL ARTICLE",
    body: `<div class="frs-scroll art-scroll" data-at="inf">${a0 ? `<div class="rec-tabs frs-tabs"><button type="button" class="rec-tab active on" data-atab="inf">INFORMATIONS</button><button type="button" class="rec-tab" data-atab="frs">FOURNISSEURS</button></div>` : ""}<div class="frs-g">${inp("des", "DÉSIGNATION", { req: 1, w: 1 })}${inp("u", "UNITÉ", { req: 1, list: units })}${inp("cat", "CATÉGORIE", { req: 1, list: P.cat })}
      ${inp("pref", "PRIX DE RÉFÉRENCE HT", { num: 1 })}${inp("pmax", "PLAFOND HT", { num: 1 })}${inp("tva", "TVA %", { num: 1 })}
      ${inp("cpt", "CODE COMPTABLE")}${inp("cptI", "INTITULÉ COMPTABLE")}
      ${a0 ? (() => { const R = achRep(achKey(a0.des, a0.u)), FR = achFrsRO(), nm = g => { const L = FR.filter(f => achFrsRoot(f.id) === g); return L.map(f => f.nom).join(" + ") || g; };
        return `<div class="frs-f frs-w art-frs"><span>FOURNISSEURS (12 DERNIERS MOIS) ${svCnt(R.n)}${R.n < R.need ? ` <b class="art-bang" title="MOINS DE ${R.need} FOURNISSEURS">!</b>` : ""} — PART CIBLE ${Math.round(R.cible)} % ± ${R.marge}</span>
          <table class="prm-table frs-sub art-frst"><thead><tr><th>FOURNISSEUR</th><th class="number">ACHETÉ (HT)</th><th class="number">PART</th></tr></thead><tbody>${R.rows.map(r => `<tr${R.n > 1 && Math.abs(r.pct - R.cible) > R.marge ? ' class="nv-alert"' : ""}><td>${esc(nm(r.g))}</td><td class="number">${esc(achF2(r.mt))}</td><td class="number">${Math.round(r.pct)} %</td></tr>`).join("") || `<tr><td colspan="3" class="empty">AUCUN ACHAT SUR 12 MOIS</td></tr>`}</tbody></table></div>`; })() : ""}
      <div class="frs-cs"><label class="frs-c"><input type="checkbox" class="art-c" data-k="stk"${A.stk ? " checked" : ""}${ro ? " disabled" : ""}> STOCKÉ</label><label class="frs-c"><input type="checkbox" class="art-c" data-k="actif"${A.actif !== false ? " checked" : ""}${ro ? " disabled" : ""}> ACTIF</label></div></div></div>`,
    foot: `<button type="button" class="svc-b" data-x>ANNULER</button>${ro ? "" : `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button>`}` });
  sviWinShow(d);
  d.addEventListener("click", e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (done) done(null); return; }
    const at = e.target.closest("[data-atab]"); if (at) { d.querySelector(".art-scroll").dataset.at = at.dataset.atab; d.querySelectorAll("[data-atab]").forEach(b => b.classList.toggle("active", b === at) || b.classList.toggle("on", b === at)); d.querySelectorAll("[data-atab]").forEach(b => b.classList.toggle("on", b === at)); return; }
    if (!e.target.closest("[data-save]")) return;
    d.querySelectorAll(".art-x").forEach(i => { const k = i.dataset.k; A[k] = ["tva", "pref", "pmax"].includes(k) ? achN(i.value) : achU(i.value); });
    d.querySelectorAll(".art-c").forEach(i => { A[i.dataset.k] = i.checked; });
    const L = achArts();
    if (!A.des || !A.u) { svToast("DÉSIGNATION ET UNITÉ OBLIGATOIRES.", 3000); return; }
    if (!A.cat) { svToast("CATÉGORIE OBLIGATOIRE.", 3000); return; }
    if (!P.cat.includes(A.cat)) { svToast("CATÉGORIE INCONNUE : LA CRÉER D'ABORD DANS ACHATS › PARAMÈTRES.", 3500); return; }
    if (A.tva < 0 || A.tva > 100) { svToast("TVA NON VALIDE (0 À 100).", 3000); return; }
    if (A.pmax > 0 && A.pref > A.pmax) { svToast("PRIX DE RÉFÉRENCE AU-DESSUS DU PLAFOND.", 3000); return; }
    const dup = achArtDup(L, A.des, A.u, a0 ? a0.id : ""); if (dup) { svToast("DOUBLON : " + dup.code + " — " + dup.des + " (" + dup.u + ") EXISTE DÉJÀ.", 4000); return; }
    const nr = achArtNear(L, A.des, A.u, a0 ? a0.id : ""); if (nr) svToast("PRESQUE IDENTIQUE À " + nr.code + " — " + nr.des + " : À FUSIONNER SI C'EST LE MÊME ARTICLE.", 4500);
    let a;
    if (a0) { a = L.find(x => x.id === a0.id); const LAB = { des: "DÉSIGNATION", u: "UNITÉ", cat: "CATÉGORIE", stk: "STOCKÉ", tva: "TVA", pref: "PRIX RÉF.", pmax: "PLAFOND", actif: "ACTIF", cpt: "CODE COMPTABLE", cptI: "INTITULÉ COMPTABLE" };
      const ch = Object.keys(LAB).filter(k => JSON.stringify(a[k] ?? "") !== JSON.stringify(A[k] ?? "")); Object.assign(a, A, { mod: achNow() }); if (ch.length) achHist(a.code, "MODIFICATION", ch.map(k => LAB[k]).join(", ")); }
    else { a = achArtNew(L, A); a.st = "instance"; a.cpt = A.cpt; a.cptI = A.cptI; achHist(a.code, "CRÉATION", a.des + " (" + a.u + ")"); }
    achArtsSave(L); d.remove(); if (done) done(a.id);
  });
}
/* UNITÉ DE CONVERSION (menu ⋯ de l'article) : 1 unité de l'article = RATIO unité cible */
function achArtCv(id, done) {
  const L0 = achArts(), a0 = L0.find(x => x.id === id); if (!a0) return;
  const C = JSON.parse(JSON.stringify(a0.cv || [])), d = sviWinNew();
  const draw = () => {
    d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: "UNITÉ DE CONVERSION — " + esc(a0.des + " (" + a0.u + ")"),
      body: `<table class="prm-table frs-sub"><thead><tr><th>UNITÉ CIBLE</th><th class="number">RATIO</th><th>CONVERSION</th><th></th></tr></thead><tbody>
        ${C.map((c, i) => `<tr data-i="${i}"><td><input class="ins-in cv-x" data-c="u" value="${esc(c.u)}" autocomplete="off"></td><td><input class="ins-in cv-x number" data-c="r" inputmode="decimal" value="${esc(c.r ? String(c.r).replace(".", ",") : "")}"></td>
          <td>${c.u && c.r ? esc("1 " + a0.u + " = " + String(c.r).replace(".", ",") + " " + c.u) : "—"}</td><td class="center"><button type="button" class="ach-x" data-rm="${i}">✕</button></td></tr>`).join("") || `<tr><td colspan="4" class="empty">AUCUNE CONVERSION</td></tr>`}</tbody></table>
        <button type="button" class="ach-b" data-add>+ CONVERSION</button>`,
      foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button>` });
    if (!d.isConnected) sviWinShow(d);
  };
  const pull = () => d.querySelectorAll("tr[data-i]").forEach(tr => { const c = C[+tr.dataset.i]; tr.querySelectorAll(".cv-x").forEach(i => { c[i.dataset.c] = i.dataset.c === "r" ? achN(i.value) : achU(i.value); }); });
  draw();
  d.addEventListener("change", e => { if (e.target.closest(".cv-x")) { pull(); draw(); } });
  d.addEventListener("click", e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (done) done(); return; }
    if (e.target.closest("[data-add]")) { pull(); C.push({ u: "", r: 0 }); draw(); return; }
    const rm = e.target.closest("[data-rm]"); if (rm) { pull(); C.splice(+rm.dataset.rm, 1); draw(); return; }
    if (!e.target.closest("[data-save]")) return;
    pull(); const K = C.filter(c => c.u || c.r);
    if (K.some(c => !c.u || !(c.r > 0))) { svToast("CHAQUE CONVERSION : UNITÉ CIBLE ET RATIO (> 0).", 3000); return; }
    if (K.some(c => c.u === a0.u)) { svToast("L'UNITÉ CIBLE DOIT DIFFÉRER DE L'UNITÉ DE L'ARTICLE.", 3000); return; }
    if (new Set(K.map(c => c.u)).size < K.length) { svToast("MÊME UNITÉ CIBLE DEUX FOIS.", 3000); return; }
    const L = achArts(), a = L.find(x => x.id === id); a.cv = K; a.mod = achNow(); achArtsSave(L); achHist(a.code, "UNITÉ DE CONVERSION", K.map(c => "1 " + a.u + " = " + c.r + " " + c.u).join(" · ") || "AUCUNE");
    d.remove(); if (done) done();
  });
}
/* validation d'un élément (articles, fournisseurs) : contrôles puis confirmation */
/* v921 (remarque 3) : FIGER (rouge → vert ; refusé tant qu'il reste une alerte) et REVENIR EN INSTANCE (vert → rouge) ; VALIDER seulement après FIGER */
const achNvCycle = (x) => x.del ? [] : x.st === "fige" ? [{ k: "val", lab: "VALIDER" }, { k: "defige", lab: "REVENIR EN INSTANCE" }] : x.st === "instance" ? [{ k: "fige", lab: "FIGER" }] : [];
async function achNvFiger(L, x, code, nom, why, save) {
  if (why.length) { svToast("FIGER IMPOSSIBLE : " + why.join(" · "), 4500); return false; }
  if (!(await svConfirm({ title: "FIGER", text: code + " — " + nom + " PASSE EN VERT : IL ATTEND SA VALIDATION.", ok: "FIGER", tone: "neutral" }))) return false;
  x.st = "fige"; x.fige = achNow(); x.mod = x.fige; save(L); achHist(code, "FIGÉ", nom); return true;
}
function achNvDefiger(L, x, code, nom, save) { x.st = "instance"; delete x.fige; x.mod = achNow(); save(L); achHist(code, "REVENU EN INSTANCE", nom); return true; }
async function achNvValider(L, x, code, nom, why, save) {
  if (x.st === "instance") { svToast("FIGER D'ABORD : LA VALIDATION SUIT LE FIGEAGE.", 3500); return false; }
  if (why.length) { svToast("VALIDATION IMPOSSIBLE : " + why.join(" · "), 4500); return false; }
  if (!(await svConfirm({ title: "VALIDER", text: code + " — " + nom + " PASSE DANS LA LISTE DES VALIDÉS.", ok: "VALIDER", tone: "neutral" }))) return false;
  x.st = "valide"; x.val = achNow(); x.mod = x.val; save(L); achHist(code, "VALIDATION", nom); return true;
}
/* v776 : RÉFÉRENCE SVI (« FRS 26-1010/001 ») — celle d'origine (NovApp) gardée ; sinon date de création AA-MMJJ + rang du jour (001, 002…) */
function achRefSvi(x, L, pfx) {
  if (x.nov) return x.nov;
  const d = String(x.cree || "").slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return x.code;
  const tag = d.slice(2, 4) + "-" + d.slice(5, 7) + d.slice(8, 10), rx = new RegExp(" " + tag + "/(\\d+)$");
  const used = Math.max(0, ...L.map(y => { const m = String(y.nov || "").match(rx); return m ? +m[1] : 0; }));
  const same = L.filter(y => !y.nov && String(y.cree || "").slice(0, 10) === d).sort((a, b) => String(a.cree).localeCompare(String(b.cree)) || String(a.code).localeCompare(String(b.code)));
  return pfx + " " + tag + "/" + String(used + Math.max(0, same.findIndex(y => y.id === x.id)) + 1).padStart(3, "0");
}
function achArtNvMod(ctx) {
  const same = (l, a) => achKey(l.des, l.u) === achKey(a.des, a.u);
  const artWhy = a => achArtWhy(a).concat(a.cat ? [] : ["CATÉGORIE MANQUANTE"]).concat(a.bloq ? ["BLOQUÉ : " + (a.bloq.why || "")] : []);
  return achNvMod(ctx, {
    list: { k: "art", t: "ach_art2", id: "achArtT", name: "ARTICLES", one: "ARTICLE", all: achArts, save: achArtsSave, code: a => achRefSvi(a, achArts(), "ARA"), nom: a => a.des, why: artWhy,
      newRow: "CRÉER UN ARTICLE ICI…", add: done => achArtFiche(null, done),
      w: { ref: 110, nom: 360, u: 70, cat: 200, pref: 110, pmax: 110, nfr: 120, val: 110, cree: 110 },
      cols: mode => [["ref", "RÉFÉRENCE", a => achRefSvi(a, achArts(), "ARA"), ""], ["nom", "DÉSIGNATION", a => a.des, ""], ["u", "UNT", a => a.u, "center"], ["cat", "CATÉGORIE", a => a.cat || "", ""],
        ["pref", "PRIX RÉF. HT", a => achN(a.pref), "number"], ["pmax", "PLAFOND HT", a => achN(a.pmax) ? achN(a.pmax) : "", "number"],
        ["nfr", "FOURNISSEURS", a => { const R = achRep(achKey(a.des, a.u)); return R.n + (R.n < R.need ? " !" : ""); }, "center"]]
        .concat(mode === "valid" ? [["val", "VALIDÉ LE", a => achDFr(a.val || a.cree), "center"]] : []).concat([["cree", "SAISI LE", a => achDFr(a.cree), "center"]]) },
    pageOf: id => { const a = achArts().find(x => x.id === id); if (!a) return null;
      const C = achCaf().filter(c => (c.lignes || []).some(l => same(l, a))), D = achDvf().filter(v => (v.lignes || []).some(l => same(l, a))), M = achCmf().filter(c => (c.lignes || []).some(l => same(l, a)));
      const lp = (v, k) => (v.lignes || []).find(l => same(l, a)) || {};
      return { id, code: a.code, ref: achRefSvi(a, achArts(), "ARA"), tag: "ARTICLE", title: a.des + " (" + a.u + ")", st: achStF(a), del: !!a.del, inactif: a.actif === false, why: artWhy(a),
        info: done => achArtFiche(id, () => done()),
        menu: [...achNvCycle(a), { k: "cv", lab: "UNITÉ DE CONVERSION" + ((a.cv || []).length ? " (" + a.cv.length + ")" : "") }, { k: "bdg", lab: "BUDGETS (" + achArtBudgets(a).length + ")" },
          a.del ? null : a.bloq ? { k: "debl", lab: "DÉBLOQUER" } : { k: "bloq", lab: "BLOQUER" },
          a.del ? { k: "rest", lab: "RESTAURER" } : { k: "del", lab: "SUPPRIMER CET ARTICLE" }].filter(Boolean),
        act: async (k, redraw) => { const L = achArts(), x = L.find(y => y.id === id); if (!x) return;
          if (k === "bloq") { const m = await achAsk("BLOQUER " + x.des, "MOTIF DU BLOCAGE"); if (!m) return; x.bloq = { u: sviUser(), t: achNow(), why: m }; x.mod = achNow(); achArtsSave(L); achHist(x.code, "BLOQUÉ", m); redraw(); return; }
          if (k === "debl") { const m = await achAsk("DÉBLOQUER " + x.des, "MOTIF DU DÉBLOCAGE"); if (!m) return; delete x.bloq; x.mod = achNow(); achArtsSave(L); achHist(x.code, "DÉBLOQUÉ", m); redraw(); return; }
          if (k === "fige") { if (await achNvFiger(L, x, x.code, x.des, artWhy(x), achArtsSave)) redraw(); return; }
          if (k === "defige") { achNvDefiger(L, x, x.code, x.des, achArtsSave); redraw(); return; }
          if (k === "val") { if (await achNvValider(L, x, x.code, x.des, artWhy(x), achArtsSave)) redraw(); return; }
          if (k === "cv") { achArtCv(id, redraw); return; }
          if (k === "bdg") { achBdgWin(x); return; }
          if (k === "del") { if (!(await svConfirm({ title: "SUPPRIMER CET ARTICLE", text: x.code + " — " + x.des + " (RESTAURABLE DEPUIS LA CORBEILLE).", ok: "SUPPRIMER" }))) return; x.del = achNow(); achArtsSave(L); achHist(x.code, "CORBEILLE", x.des); redraw(); return; }
          if (k === "rest") { if (achArtDup(L, x.des, x.u, x.id)) { svToast("RESTAURATION IMPOSSIBLE : UN ARTICLE IDENTIQUE EXISTE.", 3500); return; } x.del = ""; achArtsSave(L); achHist(x.code, "RESTAURATION", x.des); redraw(); } },
        links: [
          { t: "CONSULTATIONS", cols: [["RÉFÉRENCE"], ["OBJET"], ["QUANTITÉ", "number"], ["ÉTAT", "center"]], rows: C.map(c => ({ cells: [c.ref, c.objet || "", achN(lp(c).q), { ouverte: "OUVERTE", close: "CLOSE", annule: "ANNULÉE" }[c.state] || ""], open: () => achGo("caf", c.id), cls: c.state === "annule" ? "nv-strike" : "" })) },
          { t: "DEVIS", cols: [["RÉFÉRENCE"], ["FOURNISSEUR"], ["PRIX HT", "number"], ["PRIX TTC", "number"]], rows: D.map(v => { const l = lp(v), t = l.tva === "" || l.tva === undefined ? achPrm().tva : achN(l.tva); return { cells: [v.ref, achFrsNom(v.frs), achN(l.pu), achN(l.pu) * (1 + t / 100)], open: () => achGo("dvf", v.id), cls: v.state === "rejete" || v.state === "annule" ? "nv-strike" : "" }; }) },
          { t: "COMMANDES", cols: [["RÉFÉRENCE"], ["FOURNISSEUR"], ["QUANTITÉ", "number"], ["PRIX HT", "number"], ["ÉTAT", "center"]], rows: M.map(c => { const l = lp(c); return { cells: [c.ref, achFrsNom(c.frs), achN(l.q), achN(l.pu), ACH_CMF_ST[c.state] || ""], open: () => achGo("cmf", c.id), cls: c.state === "annule" ? "nv-strike" : "" }; }) }] }; }
  });
}

/* ---------- FOURNISSEURS ---------- */
function achFrsNvMod(ctx) {
  const frsWhy = f => achFrsWhy(f, achFrsRO());
  return achNvMod(ctx, {
    list: { k: "frs", t: "ach_frs2", id: "achFrsT", name: "FOURNISSEURS", one: "FOURNISSEUR", all: achFrs, save: achFrsSave, code: f => achFrsRef(f), nom: f => f.nom, why: frsWhy,
      newRow: "CRÉER UN FOURNISSEUR ICI…",
      add: async done => { const nom = await achAsk("NOUVEAU FOURNISSEUR", "NOM"); if (!nom) { done(null); return; } const L = achFrs(), dn = achFrsDupNom(L, nom, "");
        if (dn) svToast("UN FOURNISSEUR DU MÊME NOM EXISTE : " + dn.code + ".", 3500);
        const f = achFrsNew(L, { nom }); f.st = "instance"; f.grp = ""; achFrsSave(L); achHist(f.code, "CRÉATION", f.nom); done(f.id); achFrsFiche(f.id, "", () => done(f.id)); },
      w: { ref: 110, grp: 150, nom: 320, ville: 140, ice: 160, cond: 140, freq: 120, val: 110, cree: 110 },
      /* B42, B44 : états du fournisseur (la case ACTIF a disparu ; une ancienne fiche « inactive » compte comme bloquée) */
      etats: [["actif", "ACTIFS"], ["frequent", "FRÉQUENTS"], ["normal", "NORMAUX"], ["occasionnel", "OCCASIONNELS"], ["dormant", "DORMANTS"], ["bloque", "BLOQUÉS"], ["archive", "ARCHIVÉS"], ["corbeille", "CORBEILLE"], ["tout", "TOUT"]],
      ok: (x, k) => k === "tout" ? true : k === "corbeille" ? !!x.del : x.del ? false : k === "archive" ? !!x.arch : k === "bloque" ? !x.arch && (!!x.bloq || x.actif === false)
        : x.arch || x.bloq || x.actif === false ? false : k === "actif" ? true : achFrsFreq(x).k === k,
      cols: mode => [["ref", "RÉFÉRENCE", f => achFrsRef(f), ""], ["grp", "GROUPE", f => achFrsGrp(f).nom, ""], ["nom", "NOM", f => f.nom, "", f => f.logo || ""], ["ville", "VILLE", f => f.ville || "", ""], ["ice", "ICE", f => achDig(f.ice), "center"], ["cond", "PAIEMENT", f => f.cond || "", ""], ["freq", "FRÉQUENCE", f => achFrsFreq(f).lab, "center"]]
        .concat(mode === "valid" ? [["val", "VALIDÉ LE", f => achDFr(f.val || f.cree), "center"]] : []).concat([["cree", "SAISI LE", f => achDFr(f.cree), "center"]]) },
    pageOf: id => { const f = achFrs().find(x => x.id === id); if (!f) return null;
      /* v921 (remarque 4) : toutes les pièces liées au fournisseur — consultations, devis, commandes, réceptions, retours, factures, avoirs, paiements */
      const me = v => achFrsIs(v, f), yo = x => !(f.archOld || []).includes(String(x.cree || x.date || "").slice(0, 4));   /* B44 : années restées archivées */
      const D = achDvf().filter(v => me(v.frs) && yo(v)), M = achCmf().filter(c => me(c.frs) && yo(c)), FA = achFaf().filter(x => me(x.frs) && yo(x)), PA = achPaf().filter(x => me(x.frs) && yo(x));
      const CA = achCaf().filter(c => (c.frs || []).some(me) && yo(c)), RC = achRcp().filter(r => (me(r.frs) || M.some(c => c.id === r.cmf)) && yo(r)), RT = achRtr().filter(x => (me(x.frs) || M.some(c => c.id === x.cmf) || RC.some(r => r.id === x.rcp)) && yo(x)), AV = achAvf().filter(x => me(x.frs) && yo(x));
      const twins = achFrs().filter(x => x.id !== id && !x.del && achU(x.nom) === achU(f.nom));
      const arts = new Map(); D.filter(v => v.state !== "rejete" && v.state !== "annule").forEach(v => (v.lignes || []).forEach(l => { if (achN(l.pu) > 0) arts.set(achKey(l.des, l.u), { l, v }); }));
      return { id, code: f.code, ref: achFrsRef(f), tag: "FOURNISSEUR", title: f.nom, st: achStF(f), del: !!f.del, inactif: f.actif === false, why: frsWhy(f),
        info: done => achFrsFiche(id, "", () => done()),
        menu: [...achNvCycle(f), { k: "rib", lab: "RIB" }, { k: "cte", lab: "CONTACTS (" + (f.cte || []).length + ")" }, { k: "evl", lab: "ÉVALUATIONS (" + (f.evl || []).length + ")" },
          { k: "cgf", lab: "CONTRATS (" + (f.cgf || []).length + ")" }, { k: "docf", lab: "DOCUMENTS FISCAUX (" + (f.docf || []).length + ")" },
          f.del ? null : f.bloq ? { k: "debl", lab: "DÉBLOQUER" } : { k: "bloq", lab: "BLOQUER" },
          f.del ? null : f.arch ? { k: "desarch", lab: "DÉSARCHIVER" } : achFrsDormant(f) ? { k: "arch", lab: "ARCHIVER (DORMANT)" } : null, f.del ? { k: "rest", lab: "RESTAURER" } : { k: "del", lab: "SUPPRIMER CE FOURNISSEUR" }].filter(Boolean),
        act: async (k, redraw) => { const L = achFrs(), x = L.find(y => y.id === id); if (!x) return;
          if (k === "fige") { if (await achNvFiger(L, x, x.code, x.nom, frsWhy(x), achFrsSave)) redraw(); return; }
          if (k === "defige") { achNvDefiger(L, x, x.code, x.nom, achFrsSave); redraw(); return; }
          if (k === "val") { if (await achNvValider(L, x, x.code, x.nom, frsWhy(x), achFrsSave)) redraw(); return; }
          if (k === "evl") { achFrsEvalWin(id, redraw); return; }   /* v912 : évaluations hors du i */
          if (["rib", "cte", "cgf", "docf"].includes(k)) { achFrsFiche(id, k === "rib" ? "rib" : k, redraw); return; }
          /* v809 : BLOQUER (motif, noté dans H) — refusé dans les nouvelles consultations, devis, commandes et paiements ; ARCHIVER au mois de clôture si dormant (C1.45) */
          if (k === "bloq") { const m = await achAsk("BLOQUER " + x.nom, "MOTIF DU BLOCAGE"); if (!m) return; x.bloq = { u: typeof sviUser === "function" ? sviUser() : "", t: achNow(), why: m }; x.mod = achNow(); achFrsSave(L); achHist(x.code, "BLOQUÉ", m); redraw(); return; }
          if (k === "debl") { const m = await achAsk("DÉBLOQUER " + x.nom, "MOTIF DU DÉBLOCAGE"); if (!m) return; delete x.bloq; x.mod = achNow(); achFrsSave(L); achHist(x.code, "DÉBLOQUÉ", m); redraw(); return; }
          if (k === "arch") { const why = achFrsArchWhy(x); if (why.length) { await svConfirm({ title: "ARCHIVAGE IMPOSSIBLE", html: `<ul class="svc-list">${why.map(w => `<li>${esc(w)}</li>`).join("")}</ul>`, ok: "OK", tone: "neutral" }); return; }
            if (!(await svConfirm({ title: "ARCHIVER", text: x.code + " — " + x.nom + " : DERNIER ACHAT " + (achDFr(achFrsLast(x.id)) || "AUCUN") + ". IL NE POURRA PLUS ÊTRE CHOISI DANS UNE NOUVELLE PIÈCE.", ok: "ARCHIVER" }))) return;
            x.arch = achNow(); x.mod = x.arch; achFrsSave(L); achHist(x.code, "ARCHIVÉ", "DORMANT"); redraw(); return; }
          if (k === "desarch") { /* B44 : cocher les années d'historique à faire revenir (les 3 dernières cochées) ; les autres restent archivées */
            const me = v => achFrsIs(v, x), Y = [...new Set([achDvf(), achCmf(), achFaf(), achPaf(), achRcp(), achAvf()].flatMap(Lp => Lp.filter(v => me(v.frs)).map(v => String(v.cree || v.date || "").slice(0, 4))).filter(y => /^\d{4}$/.test(y)))].sort().reverse();
            let keep = new Set(Y.slice(0, 3)); const h = ev => { const c = ev.target; if (c && c.classList && c.classList.contains("frs-yr")) { if (c.checked) keep.add(c.value); else keep.delete(c.value); } }; document.addEventListener("change", h, true);
            const ok = await svConfirm({ title: "DÉSARCHIVER " + x.nom, html: Y.length ? `<div>ANNÉES D'HISTORIQUE À FAIRE REVENIR :</div>${Y.map(y => `<label class="frs-c"><input type="checkbox" class="frs-yr" value="${y}"${keep.has(y) ? " checked" : ""}> ${y}</label>`).join("")}` : "AUCUNE PIÈCE ARCHIVÉE.", ok: "DÉSARCHIVER", tone: "neutral" });
            document.removeEventListener("change", h, true); if (!ok) return;
            delete x.arch; x.archOld = Y.filter(y => !keep.has(y)); x.mod = achNow(); achFrsSave(L); achHist(x.code, "DÉSARCHIVÉ", x.nom + (x.archOld.length ? " — RESTENT ARCHIVÉES : " + x.archOld.join(", ") : "")); redraw(); return; }
          if (k === "del") { if (!(await svConfirm({ title: "SUPPRIMER CE FOURNISSEUR", text: x.code + " — " + x.nom + " (RESTAURABLE DEPUIS LA CORBEILLE).", ok: "SUPPRIMER" }))) return; x.del = achNow(); achFrsSave(L); achHist(x.code, "CORBEILLE", x.nom); redraw(); return; }
          if (k === "rest") { x.del = ""; achFrsSave(L); achHist(x.code, "RESTAURATION", x.nom); redraw(); } },
        links: [
          { t: "ARTICLES (DEVIS EN COURS)", cols: [["DÉSIGNATION"], ["U", "center"], ["PRIX HT", "number"], ["PRIX TTC", "number"], ["DEVIS"]], rows: [...arts.values()].map(({ l, v }) => { const t = l.tva === "" || l.tva === undefined ? achPrm().tva : achN(l.tva); return { cells: [l.des, l.u, achN(l.pu), achN(l.pu) * (1 + t / 100), v.ref] }; }) },
          ...(twins.length ? [{ t: "AUTRES FICHES DU MÊME NOM", cols: [["RÉFÉRENCE"], ["NOM"], ["VILLE"], ["ÉTAT", "center"]], rows: twins.map(x => ({ cells: [achFrsRef(x), x.nom, x.ville || "", achStF(x) === "fige" ? "FIGÉ" : achSt(x) === "instance" ? "EN INSTANCE" : "VALIDÉ"], open: () => achGo("frs", x.id) })) }] : []),
          { t: "CONSULTATIONS", cols: [["RÉFÉRENCE"], ["OBJET"], ["RÉPONSE", "center"], ["ÉTAT", "center"]], rows: CA.map(c => { const k = (c.frs || []).find(me), rp = (c.rep || {})[k] || {}; return { cells: [c.ref, c.objet || "", rp.st === "repondu" ? "RÉPONDU" : "EN ATTENTE", { ouverte: "OUVERTE", close: "CLOSE", annule: "ANNULÉE" }[c.state] || ""], open: () => achGo("caf", c.id), cls: c.state === "annule" ? "nv-strike" : "" }; }) },
          { t: "DEVIS", cols: [["RÉFÉRENCE"], ["ARTICLES"], ["MONTANT TTC", "number"]], rows: D.map(v => ({ cells: [v.ref, (v.lignes || []).map(l => l.des).join("; "), achDvfTot(v).ttc], open: () => achGo("dvf", v.id), st: v.state === "retenu" ? "valide" : v.state === "rejete" || v.state === "annule" ? "" : "instance", cls: v.state === "rejete" || v.state === "annule" ? "nv-strike" : "" })) },
          { t: "COMMANDES", cols: [["RÉFÉRENCE"], ["ARTICLES"], ["MONTANT TTC", "number"], ["ÉTAT", "center"]], rows: M.map(c => ({ cells: [c.ref, (c.lignes || []).map(l => l.des).join("; "), achCmfTot(c).ttc, ACH_CMF_ST[c.state] || ""], open: () => achGo("cmf", c.id), cls: c.state === "annule" ? "nv-strike" : "" })) },
          { t: "RÉCEPTIONS", cols: [["RÉFÉRENCE"], ["COMMANDE"], ["N° BL"], ["REÇU LE", "center"], ["ÉTAT", "center"]], rows: RC.map(r => ({ cells: [r.ref, ((achCmf().find(c => c.id === r.cmf) || {}).ref) || "SANS COMMANDE", r.pv ? "PV DE SERVICE FAIT" : r.nbl || "", achDFr(r.date), r.state === "annule" ? "ANNULÉE" : "ENREGISTRÉE"], open: () => achGo("rcp", r.id), cls: r.state === "annule" ? "nv-strike" : "" })) },
          { t: "RETOURS", cols: [["RÉFÉRENCE"], ["ORIGINE"], ["DATE", "center"], ["MOTIF"]], rows: RT.map(x => ({ cells: [x.ref, x.kind === "cmd" ? ((achCmf().find(c => c.id === x.cmf) || {}).ref || "") : ((achRcp().find(r => r.id === x.rcp) || {}).ref || ""), achDFr(x.date), x.motif || ""], open: () => achGo(x.kind === "cmd" ? "rtc" : "rtr", x.id) })) },
          { t: "FACTURES", cols: [["RÉFÉRENCE"], ["N°"], ["MONTANT TTC", "number"], ["RESTE À PAYER", "number"], ["ÉTAT", "center"]], rows: FA.map(x => ({ cells: [x.ref, x.num || "", achFafTot(x).ttc, x.state === "annule" ? "" : achFafReste(x), achFafEtat(x)], open: () => achGo("faf", x.id), cls: x.state === "annule" ? "nv-strike" : "" })) },
          { t: "AVOIRS", cols: [["RÉFÉRENCE"], ["N°"], ["FACTURE"], ["MONTANT TTC", "number"]], rows: AV.map(x => ({ cells: [x.ref, x.num || "", ((achFaf().find(y => y.id === x.fa) || {}).ref) || "", achN(x.ttc)], open: () => achGo("avf", x.id), cls: x.state === "annule" ? "nv-strike" : "" })) },
          { t: "PAIEMENTS", cols: [["RÉFÉRENCE"], ["MODE"], ["MONTANT", "number"], ["ÉTAT", "center"]], rows: PA.map(p => ({ cells: [p.ref, p.mode, achN(p.mt), ACH_PAF_ST[p.state] || ""], open: () => achGo("paf", p.id), cls: p.state === "annule" || p.state === "rejete" ? "nv-strike" : "" })) },
          /* v808 : blocs de la page du fournisseur (checklist, hors du i) — encours et solde, litiges, évaluations, dépendance */
          (() => { const fa = FA.filter(x => !x.del && x.state !== "annule"), fac = fa.reduce((t, x) => t + achFafTot(x).ttc, 0), enc = achFrsEnc(id),
              av = achAvf().filter(a => me(a.frs) && a.state !== "annule").reduce((t, a) => t + Math.max(0, achAvfReste(a)), 0), pl = achN(f.plafEnc);
            return { t: "ENCOURS ET SOLDE", cols: [["FACTURÉ TTC", "number"], ["PAYÉ", "number"], ["AVOIRS À DÉDUIRE", "number"], ["ENCOURS", "number"], ["PLAFOND", "number"], ["SOLDE DÛ", "number"]],
              rows: fa.length || av ? [{ cells: [fac, fac - enc, av, enc, pl || "", enc - av], cls: pl && enc > pl + 0.005 ? "nv-alert" : "" }] : [] }; })(),
          { t: "LITIGES", cols: [["TYPE"], ["RÉFÉRENCE"], ["MOTIF"], ["DATE", "center"]],
            rows: FA.filter(x => x.state === "reclame").map(x => ({ cells: ["FACTURE RÉCLAMÉE", x.ref, x.motif || x.recl || "", achDFr(x.mod || x.cree)], open: () => achGo("faf", x.id) }))
              .concat(achRtr().filter(r => me(r.frs)).map(r => ({ cells: [r.kind === "cmd" ? "RETOUR DE COMMANDE" : "RETOUR DE MARCHANDISE", r.ref, r.motif || "", achDFr(r.date)] })))
              .concat(PA.filter(p => p.state === "rejete").map(p => ({ cells: [p.mode + " REJETÉ", p.ref, p.motif || "", achDFr(p.mod)], open: () => achGo("paf", p.id) }))) },
          { t: "ÉVALUATIONS", cols: [["DATE", "center"], ["NOTE / 10", "number"], ["CRITÈRES"]],
            rows: (f.evl || []).map(x => ({ cells: [achDFr(x.date), Math.round(achN(x.moy) * 10) / 10, (x.crit || []).map(c => c.d + " " + c.n).join(", ")],  })) },
          (() => { const ok = c => c.state === "valide" || c.state === "solde", all = achCmf().filter(c => ok(c) && !c.del), tot = all.reduce((t, c) => t + achCmfTot(c).ttc, 0), lui = all.filter(c => c.frs === id).reduce((t, c) => t + achCmfTot(c).ttc, 0);
            return { t: "DÉPENDANCE", cols: [["ACHATS CHEZ LUI TTC", "number"], ["ACHATS TOTAUX TTC", "number"], ["PART DE NOS ACHATS", "number"]],
              rows: lui > 0 ? [{ cells: [lui, tot, (Math.round(lui / tot * 1000) / 10).toLocaleString("fr-FR") + " %"] }] : [] }; })()] }; }
  });
}

/* v766 : panneau des dates aux hauteurs de la liste (comme les budgets) — à appeler après le dessin */
function achBdglSync(root) {
  requestAnimationFrame(() => { try { root.querySelectorAll(".svi-bdgp").forEach(pn => { const tb = pn.parentNode.querySelector("table.svi-bdgl"); if (!tb || !tb.tHead) return;
    const tr = tb.querySelector("tbody tr:not(.bdg-newrow)") || tb.querySelector("tbody tr");
    pn.style.setProperty("--bdg-head-h", Math.round(tb.tHead.getBoundingClientRect().height) + "px"); if (tr) pn.style.setProperty("--bdg-row-h", Math.round(tr.getBoundingClientRect().height) + "px"); }); } catch (e) {} });
}
/* v790 : case d'en-tête des blocs des pages d'achat = toutes les lignes du bloc */
document.addEventListener("change", e => { const a = e.target.closest && e.target.closest(".nvp-all"); if (!a) return; a.closest("table").querySelectorAll(".nvp-cb").forEach(c => { c.checked = a.checked; }); });
/* ⟪ src/48-achats-import-novapp.js ⟫ */
/* =========================================================
   v767 : (ancien) IMPORT DES ACHATS DE NOVAPP (ACHATS › PARAMÈTRES › IMPORTER LES DONNÉES DE NOVAPP)
   Fichier novapp-achats.json préparé depuis l'export NovApp (articles, fournisseurs, besoins, consultations, devis, commandes,
   réceptions, factures, paiements, historique). Décisions d'Ahmed (01/11/2026) :
   - références RENUMÉROTÉES au format du SVI ERP, DATES D'ORIGINE GARDÉES ; l'ancienne référence NovApp reste dans l'historique (H) ;
   - besoin : budget du PROJET, charge de même désignation, PREMIÈRE TÂCHE trouvée ; F26 = SIÈGE ; sinon rattaché au projet, à compléter.
   Les données des achats de l'appareil sont REMPLACÉES (copie de sécurité gardée sur l'appareil : svi_ach_backup_v1).
   ========================================================= */
const ACH_NOV_K = "svi_ach_nov_v1";
const achNovOf = code => { const M = achJ(ACH_NOV_K, {}) || {}; return M[code] || null; };
/* historique H : lignes NovApp (ancienne référence, actions d'origine) puis celles du SVI ERP */
const achHistNov = code => { const x = achNovOf(code); if (!x) return [];
  return [{ t: (x.h[0] || [])[0] || "", a: "ANCIENNE RÉFÉRENCE NOVAPP", d: x.o, u: "IMPORT" }].concat((x.h || []).map(([t, a]) => ({ t, a, d: "NOVAPP — " + x.o, u: "" }))); };
/* B15 (série B, 04/11/2026) : plus de bouton ni de procédure d'import NovApp (un import éventuel se fera autrement) ;
   seule la lecture de l'historique des pièces déjà importées est gardée (ancienne référence dans H). */
