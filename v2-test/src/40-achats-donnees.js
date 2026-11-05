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
  freqA: p.freqA === undefined ? 3 : achN(p.freqA), freqB: p.freqB === undefined ? 6 : achN(p.freqB), plafT: p.plafT === undefined ? "" : p.plafT, plafU: p.plafU === "%" ? "%" : "DH", refs: achRefs(p), clG: achClG(p), clP: achClP(p) });
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
    docf: [], cte: [], evl: [], cgf: [], cla: achClCopy(achPrm().clG), ribChg: "", cree: now, mod: now, del: "" };
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
const achFrsLast = id => { let d = ""; achCmf().filter(c => c.frs === id && c.state !== "annule").forEach(c => { const x = String(c.valide || c.cree || "").slice(0, 10); if (x > d) d = x; });
  achFaf().filter(x => x.frs === id && x.state !== "annule").forEach(x => { const y = String(x.dFac || x.cree || "").slice(0, 10); if (y > d) d = y; }); return d; };
const achFrsDormant = f => { const d = achFrsLast(f.id) || String(f.cree || "").slice(0, 10), lim = new Date(); lim.setMonth(lim.getMonth() - achPrm().dorm); return !!d && d < lim.toISOString().slice(0, 10); };
const achExFinMois = () => new Date().getMonth() + 1 === achPrm().exFin;
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
const achDvfWhy = v => { const w = [], today = new Date().toISOString().slice(0, 10);
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
