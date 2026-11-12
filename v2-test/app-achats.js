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
const ACH_K = { art: "svi_ach_art_v1", prm: "svi_ach_prm_v1", frs: "svi_ach_frs_v1", bsn: "svi_ach_bsn_v1", caf: "svi_ach_caf_v1", dvf: "svi_ach_dvf_v1", cmf: "svi_ach_cmf_v1", rcp: "svi_ach_rcp_v1", rtr: "svi_ach_rtr_v1", faf: "svi_ach_faf_v1", avf: "svi_ach_avf_v1", paf: "svi_ach_paf_v1", cli: "svi_ach_cli_v1", prj: "svi_ach_prj_v1" };
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
/* B48 (05/11) : ouverture des fiches plus rapide — le texte décompressé de chaque liste est gardé tant que la liste ne change pas
   (la décompression coûtait à chaque lecture) ; chaque lecture rend toujours une copie neuve (JSON.parse), qu'on peut modifier sans risque */
const ACH_DEC = new Map();
const achDec = k => { const raw = localStorage.getItem(k); if (raw === null) return null; const c = ACH_DEC.get(k); if (c && c.raw === raw) return c.txt; const txt = SVI_LZ.dec(raw); ACH_DEC.set(k, { raw, txt }); return txt; };
const achJ = (k, d) => { try { const v = JSON.parse(achDec(k) || "null"); return v === null ? d : v; } catch (e) { return d; } };
const achW = (k, v) => { try { const s = JSON.stringify(v); localStorage.setItem(k, /^svi_ach_/.test(k) && s.length > 4000 ? SVI_LZ.enc(s) : s); return true; } catch (e) { return false; } };
/* ---------- paramètres d'achat ---------- */
/* v899 : la TVA des achats est la TVA PAR DÉFAUT commune (PARAMÉTRAGE › GÉNÉRAL › SOCIÉTÉ), vide = 0 dans les calculs */
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
const ACH_REF_T = [["BSN", "BESOIN"], ["CAF", "CONSULTATION (CFA)"], ["DVF", "DEVIS DU FOURNISSEUR"], ["CMF", "COMMANDE"], ["RTC", "RETOUR DE COMMANDE"], ["RCP", "RÉCEPTION"],
  ["RTR", "RETOUR DE RÉCEPTION"], ["FAF", "FACTURE DU FOURNISSEUR"], ["AVF", "AVOIR DU FOURNISSEUR"], ["PAF", "PAIEMENT"]];
const ACH_REF_RZ = [["jour", "CHAQUE JOUR"], ["mois", "CHAQUE MOIS"], ["annee", "CHAQUE ANNÉE"], ["jamais", "JAMAIS"]];
const achRefs = p => { const r = p.refs && typeof p.refs === "object" ? p.refs : {};
  return Object.fromEntries(ACH_REF_T.map(([k]) => { const x = r[k] || {}; return [k, { m: String(x.m || "").trim() || (k === "CAF" ? "CFA" : k) + " {AA}-{MM}{JJ}/{NNN}", rz: ACH_REF_RZ.some(z => z[0] === x.rz) ? x.rz : "jour", l: String(x.l || "").trim() || ACH_REF_LDEF, ...(k === "CAF" ? { f: String(x.f || "").trim() || ACH_REF_FDEF } : {}) }]; })); };
/* 08/11 (série H, H1) : RÉFÉRENCE DES CONSULTATIONS PAR FOURNISSEUR (filles) — {PARENT} = référence de la consultation mère, {FF} = numéro du fournisseur
   dans la consultation (autant de chiffres que de F, jamais réutilisé) ; le « F » la distingue des détails (-001) */
const ACH_REF_FDEF = "{PARENT}-F{FF}";
/* série I (I9, document unique 10.2) : toute fenêtre i de pièce commence par la DATE DE CRÉATION — remplie seule, non modifiable (date et heure en entier) */
/* 09/11 (remarque) : bandeau des fenêtres i = la référence, puis H (historique de la pièce), comme dans la barre du haut */
const achWinTtl = (ref, nouv) => ref ? esc(ref) + ` <span class="bdg-d-badge svi-win-h" data-wh="${esc(ref)}" role="button" title="Historique">H</span>` : nouv;
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-wh]"); if (!b) return; e.preventDefault(); e.stopPropagation(); if (typeof achHistWin === "function") achHistWin(b.dataset.wh); }, true);
const achCreeFr = x => { const t = x && x.cree ? new Date(x.cree) : new Date(); if (isNaN(t)) return String(x.cree || "");
  const p2 = n => String(n).padStart(2, "0"); return p2(t.getDate()) + "/" + p2(t.getMonth() + 1) + "/" + t.getFullYear() + " " + p2(t.getHours()) + ":" + p2(t.getMinutes()); };
const achCreeFld = x => `<label class="frs-f ach-cree"><span>DATE DE CRÉATION</span><input class="ins-in" value="${esc(achCreeFr(x))}" readonly tabindex="-1"></label>`;
const achFilRef = (c, n) => String((((achPrm().refs || {}).CAF) || {}).f || ACH_REF_FDEF).replace(/\{PARENT\}/g, c.ref || "").replace(/\{(F+)\}/g, (_, F) => String(n).padStart(F.length, "0"));
/* C6 (série C, document unique 6.14) : RÉFÉRENCE DES LIGNES d'une pièce — modèle par type : {PARENT} = référence de la pièce,
   {LLL} = compteur des lignes (autant de chiffres que de L), qui repart à 1 dans chaque pièce — distinct du compteur {NNN} des pièces */
const ACH_REF_LDEF = "{PARENT}-{LLL}";
const achLineRef = (pfx, parent, i) => { const m = (((achPrm().refs || {})[String(pfx || "").toUpperCase()]) || {}).l || ACH_REF_LDEF;
  return m.replace(/\{PARENT\}/g, parent || "").replace(/\{(L+)\}/g, (z, L) => String(i + 1).padStart(L.length, "0")); };
const achRefFill = (m, d, n) => { const p2 = x => String(x).padStart(2, "0");
  return m.replace(/\{AAAA\}/g, d.getFullYear()).replace(/\{AA\}/g, p2(d.getFullYear() % 100)).replace(/\{MM\}/g, p2(d.getMonth() + 1)).replace(/\{JJ\}/g, p2(d.getDate()))
    .replace(/\{(N+)\}/g, (_, N) => String(n).padStart(N.length, "0")); };
const achRefRx = m => new RegExp("^" + m.split(/(\{AAAA\}|\{AA\}|\{MM\}|\{JJ\}|\{N+\})/).map(s => s === "{AAAA}" ? "\\d{4}" : /^\{(AA|MM|JJ)\}$/.test(s) ? "\\d{2}" : /^\{N+\}$/.test(s) ? "(\\d+)" : s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("") + "$");
/* série B (B29, B30) : CLAUSES — chaque article a un TYPE qui reprend sa valeur par défaut ; GÉNÉRALES = contrat type repris sur chaque nouveau
   fournisseur ; PARTICULIÈRES = reprises sur chaque nouvelle commande (imprimées en page annexe) ; modifiées sur la fiche ou la commande seulement */
/* 05/11 : chaque TYPE d'article de contrat peut être un champ de la fiche fournisseur : la VALEUR de l'article et le champ sont liés
   (changer l'un change l'autre) ; [clé, intitulé, désignation par défaut, champ de la fiche, unité, valeur par défaut] */
const ACH_CLT = [["pay", "DÉLAI DE PAIEMENT", "DÉLAI DE PAIEMENT APRÈS LA DATE DE LA FACTURE (60 JOURS AU PLUS)", "cond", "", "60 JOURS"], ["liv", "DÉLAI DE LIVRAISON", "", "delai", "JOURS", ""],
  ["mode", "MODE DE RÈGLEMENT", "", "modeReg", "", ""], ["plafT", "PLAFOND DE TRANSACTIONS (MONTANT)", "", "plafT", "DH HT", ""], ["plafP", "PLAFOND DE TRANSACTIONS (PART)", "", "plafP", "%", ""],
  ["esc", "ESCOMPTE", "", "escTaux", "%", ""], ["escJ", "ESCOMPTE — PAYÉ SOUS", "", "escJours", "JOURS", ""], ["ret", "RETENUE DE GARANTIE", "", "retTaux", "%", ""],
  ["min", "MINIMUM DE COMMANDE", "", "minCmd", "DH", ""], ["franco", "FRANCO DE PORT À PARTIR DE", "", "franco", "DH", ""], ["rem", "REMISE HABITUELLE", "", "remise", "%", ""],
  ["pen", "PÉNALITÉS DE RETARD", "", "", "", ""], ["val", "VALIDITÉ DU DEVIS", "", "", "JOURS", "30"], ["av", "AVANCE SUR COMMANDE", "", "", "%", ""], ["cond", "CONDITIONS DE PAIEMENT", "", "", "", ""], ["autre", "AUTRE", "", "", "", ""]];
const achCltOf = t => ACH_CLT.find(x => x[0] === t) || ["", "", "", "", "", ""];
const achCltDef = t => achCltOf(t)[2];
const achCltLab = t => achCltOf(t)[1];
const achCltFld = t => achCltOf(t)[3];
const achCltU = t => achCltOf(t)[4];
const ACH_CLT_NUM = ["delai", "plafT", "plafP", "escTaux", "escJours", "retTaux", "minCmd", "franco", "remise"];
const achClTxt = x => [x.t === "autre" ? "" : achCltLab(x.t), [x.txt, [x.v, x.u].filter(s => s !== "" && s !== undefined && s !== null).join(" ")].filter(Boolean).join(" : ")].filter(Boolean);
const achClG = p => Array.isArray(p.clG) ? p.clG : [["pay"], ["val"]].map(([t], i) => ({ id: "g" + (i + 1), t, txt: achCltDef(t), v: achCltOf(t)[5], u: achCltU(t) }));
const achClP = p => Array.isArray(p.clP) ? p.clP : [{ id: "p1", t: "liv", txt: "" }, { id: "p2", t: "pen", txt: "" }];
const achClCopy = L => (L || []).map(x => ({ t: x.t, txt: x.txt || "", v: x.v ?? "", u: x.u ?? achCltU(x.t) }));
const achPrm0 = p => ({ tol: p.tol === undefined ? 5 : achN(p.tol), direct: p.direct === undefined ? 5000 : achN(p.direct), ecart: p.ecart === undefined ? 1 : achN(p.ecart), esp: achEspJour(p), rasT: p.rasT === undefined ? 75 : achN(p.rasT), avj: achAlrJ(p, "av", p.avj === undefined ? 90 : achN(p.avj)), chqj: achAlrJ(p, "chq", p.chqj === undefined ? 30 : achN(p.chqj)), dorm: p.dorm === undefined ? 12 : achN(p.dorm), directJ: p.directJ === undefined ? 30 : Math.max(1, Math.round(achN(p.directJ)) || 1), nfrs: p.nfrs === undefined ? 3 : Math.max(1, Math.round(achN(p.nfrs)) || 1), ncons: p.ncons === undefined ? 3 : Math.max(1, Math.round(achN(p.ncons)) || 1), avMax: p.avMax === undefined ? 30 : achN(p.avMax), delaiLeg: p.delaiLeg === undefined ? 60 : Math.max(1, achN(p.delaiLeg) || 60), seuilBdg: p.seuilBdg === undefined ? 90 : Math.min(100, Math.max(1, achN(p.seuilBdg) || 90)), exFin: p.exFin === undefined ? 12 : Math.min(12, Math.max(1, Math.round(achN(p.exFin)) || 12)), cat: Array.isArray(p.cat) ? p.cat : ACH_PRM_DEF.cat.slice(), socIce: p.socIce || "", socIf: p.socIf || "", banques: Array.isArray(p.banques) ? p.banques : ACH_PRM_DEF.banques.map(b => ({ ...b })), grp: ACH_ORIG.map(g => ({ ...g, req: g.req.slice() })), alr: achAlr(p), espL: achEspL(p), ment: p.ment && typeof p.ment === "object" ? p.ment : { ice: true, if: true }, seuV: Array.isArray(p.seuV) ? p.seuV : [], seuT: p.seuT && typeof p.seuT === "object" ? p.seuT : {},
  freqA: p.freqA === undefined ? 3 : achN(p.freqA), freqB: p.freqB === undefined ? 6 : achN(p.freqB), plafT: p.plafU === "%" || p.plafT === undefined ? "" : p.plafT, plafP: p.plafP !== undefined ? p.plafP : p.plafU === "%" && p.plafT !== undefined ? p.plafT : "", plafU: "DH", nrep: p.nrep === undefined ? 3 : Math.max(1, Math.round(achN(p.nrep)) || 1), mrep: p.mrep === undefined ? 10 : achN(p.mrep), cafMan: p.cafMan !== false, refs: achRefs(p), clG: achClG(p), clP: achClP(p) });   /* v1134 (L24) : cafMan = prix saisi à la main → validateur obligatoire (OUI par défaut) */
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
/* 09/11 (compte rendu) : type de la pièce dans l'historique d'après sa référence (CONSULTATION, DEVIS, COMMANDE…), ARTICLE sinon */
const achHistB = code => { try { const R = achPrm().refs || {}; for (const [k, lab] of ACH_REF_T) { const m = (R[k] || {}).m; if (m && achRefRx(m).test(String(code))) return lab.replace(/\s*\(.*\)$/, ""); } } catch (e) {} return /^FRS/.test(String(code)) ? "FOURNISSEUR" : "ARTICLE"; };
const achHist = (code, action, detail) => { try { const k = "svi_hist_v1:ACH-" + code, l = JSON.parse(localStorage.getItem(k) || "[]") || []; l.push({ t: new Date().toISOString(), b: achHistB(code), a: action, d: achU(detail), u: typeof sviUser === "function" ? sviUser() : "" }); localStorage.setItem(k, JSON.stringify(l.slice(-500))); } catch (e) {} };
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
    ice: "", ifisc: "", rc: "", villeRc: "", patente: "", capital: 0, codeCpt: "", intCpt: "", ribs: [], cond: "", fam: [], occ: !!o.occ, orgFin: false,
    docf: [], cte: [], evl: [], cgf: [], cla: achClCopy(achPrm().clG), plafT: achPrm().plafT, plafP: achPrm().plafP, ribChg: "", cree: now, mod: now, del: "" };
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
/* D3 (série D) : plus aucune case ACTIF pour les fournisseurs — une ancienne fiche « inactive » devient BLOQUÉE (une fois pour toutes) */
function achFrsMigActif() { const L = achFrs(); let ch = false; L.forEach(f => { if (f.actif === undefined) return; if (f.actif === false && !f.bloq && !f.arch) f.bloq = true; delete f.actif; ch = true; }); if (ch) achFrsSave(L); }
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
/* E4 (série E) : STATUTS DES ARTICLES — comme les fournisseurs : FRÉQUENT, NORMAL, OCCASIONNEL (écart moyen entre deux commandes de l'article),
   DORMANT (sans commande depuis « fournisseur dormant » mois) ; moins de deux commandes = pas encore de fréquence */
const achArtDates = () => achMemo("artd", [ACH_K.cmf], () => { const M = new Map();
  achCmf().filter(c => c.state !== "annule").forEach(c => { const x = String(c.valide || c.cree || "").slice(0, 10); if (!x) return;
    new Set((c.lignes || []).map(l => achKey(l.des, l.u))).forEach(k => { if (!M.has(k)) M.set(k, []); M.get(k).push(x); }); });
  M.forEach(L => L.sort()); return M; });
const achArtFreq = a => { if (!a) return { k: "", lab: "" }; const C = achArtDates().get(achKey(a.des, a.u)) || [], P = achPrm(), lim = new Date(); lim.setMonth(lim.getMonth() - P.dorm);
  const last = C[C.length - 1] || String(a.cree || "").slice(0, 10); if (last && last < lim.toISOString().slice(0, 10)) return { k: "dormant", lab: "DORMANT" };
  if (C.length < 2) return { k: "", lab: "" };
  const m = (new Date(C[C.length - 1]) - new Date(C[0])) / 864e5 / (C.length - 1) / 30.44, k = m <= P.freqA ? "frequent" : m <= P.freqB ? "normal" : "occasionnel";
  return { k, lab: ACH_FREQ.find(x => x[0] === k)[1], m }; };
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
/* 05/11 : deux plafonds en même temps sur la fiche — montant HT (plafT) et part en % de tous les achats (plafP) ; dépasser l'un = refusé
   (une ancienne fiche « en % » garde sa valeur comme plafond en %) */
const achFrsPlafs = f => { const old = f && f.plafU === "%" && f.plafP === undefined; return { dh: old ? "" : f ? f.plafT : "", pct: old ? f.plafT : f ? f.plafP : "" }; };
const achFrsPlafNo = (f, add) => { if (!f) return ""; const Q = achFrsPlafs(f), D = achN(Q.dh), PC = achN(Q.pct); if (!(D > 0) && !(PC > 0)) return "";
  const B = achBuyGrp(), g = achFrsRoot(f.id), mine = (B.M.get(g) || 0) + achN(add);
  if (D > 0 && mine > D) return "PLAFOND DE TRANSACTIONS ATTEINT : " + achF2(mine) + " HT SUR 12 MOIS (PLAFOND " + achF2(D) + " HT)";
  if (PC > 0) { const pct = B.t + achN(add) > 0 ? mine / (B.t + achN(add)) * 100 : 0; if (pct > PC) return "PLAFOND DE TRANSACTIONS ATTEINT : " + Math.round(pct) + " % DES ACHATS SUR 12 MOIS (PLAFOND " + PC + " %)"; }
  return ""; };
/* 05/11 : % maximum d'un fournisseur sur un article (fiche ARTICLE) ; seulement s'il y a d'autres fournisseurs actifs pour cet article */
const achArtPartNo = (c, f) => { if (!f) return ""; const g = achFrsRoot(f.id), r = 1 - achN(c.rem) / 100;
  for (const l of c.lignes || []) { const k = achKey(l.des, l.u), a = achArts().find(x => !x.del && achKey(x.des, x.u) === k), M = achN(a && a.partMax); if (!(M > 0)) continue;
    const m = achBuy12().get(k) || new Map(), others = [...m.keys()].filter(x => x !== g).length; if (!others) continue;
    const add = achN(l.q) * achN(l.pu) * r, tot = [...m.values()].reduce((s, v) => s + v, 0) + add, pct = tot ? ((m.get(g) || 0) + add) / tot * 100 : 0;
    if (pct > M) return "PART MAXIMUM DU FOURNISSEUR SUR " + achU(l.des) + " DÉPASSÉE : " + Math.round(pct) + " % (MAXIMUM " + M + " %, FICHE ARTICLE)"; }
  return ""; };
/* B25, B45 (série B) : CIRCUIT DE VALIDATION des commandes — le seuil le plus haut dépassé (montant HT) donne les grades qui valident ;
   RESPECTER LA HIÉRARCHIE = dans l'ordre, du plus bas au plus haut (grade 3 avant grade 1) ; sinon chaque grade peut valider seul.
   La commande envoyée est verrouillée ; un valideur l'accepte ou la renvoie avec ses remarques ; corrigée, elle repart dans le circuit. */
/* 06/11/2026 (décision d'Ahmed) : CHAQUE TYPE DE PIÈCE A SON PROPRE CIRCUIT DE VALIDATION — seuils réglés type par type (PARAMÉTRAGE › ACHATS ›
   RÈGLES INTERNES › SEUILS DE VALIDATION) ; le seuil GÉNÉRAL de la société n'est que proposé par défaut : un type sans réglage propre le reprend */
const ACH_CIRC_T = [["gen", "GÉNÉRAL (PROPOSÉ PAR DÉFAUT)"], ["bsn", "BESOINS"], ["caf", "CONSULTATIONS"], ["dvf", "DEVIS"], ["cmf", "COMMANDES"], ["faf", "FACTURES"], ["paf", "PAIEMENTS"]];
/* 06/11 (soir) : montant d'une pièce sans prix d'achat (besoin, consultation, devis) = quantités × PRIX STANDARD de l'article (prix de référence
   de la liste des articles) ; une ligne hors liste prend le prix saisi sur la ligne */
const achArtOf = (des, u) => achArts().find(a => !a.del && achKey(a.des, a.u) === achKey(des, u)) || null;
const achStdPu = (des, u, pu) => { const a = achArtOf(des, u); return a && achN(a.pref) > 0 ? achN(a.pref) : achN(pu); };
const achStdMt = L => (L || []).reduce((t, l) => t + achN(l.q) * achStdPu(l.des, l.u, l.pu), 0);
/* v1134 (L24, décision d'Ahmed du 11/11) : PRIX ESTIMÉ d'un article de consultation — prix du budget actif qui le porte (le moins cher s'il est
   dans plusieurs budgets), sinon prix standard de l'article ; dans ces deux cas il est bloqué (gris : les seuils de validation ne se contournent pas) ;
   saisi à la main seulement s'il n'existe nulle part. Budgets actifs = étapes de l'appareil, ni archivés, ni supprimés, ni versions / scénarios / recalages */
const achCafBdgPx = () => { const M = new Map(); let L = []; try { L = sviInstGet(); } catch (e) {}
  (L || []).filter(b => b && !b.parent && !b.rclOf && !b.virtual && !b.arch && !b.del).forEach(b => { let C = []; try { C = achBdgCharges(b.ref); } catch (e) {}
    C.forEach(c => { if (!(c.p > 0)) return; const o = M.get(c.key); if (!o || c.p < o.p) M.set(c.key, { p: c.p, ref: b.ref, prj: achU(b.project || "") || b.ref }); }); });
  return M; };
const achCafEst = (l, BP) => { const b = (BP || achCafBdgPx()).get(achKey(l.des, l.u)); if (b) return { pu: b.p, src: "bdg", lab: "BUDGET " + b.prj, ref: b.ref, lock: true };   /* v1136 (L24) : « BUDGET IME » (nom du projet) */
  const a = achArtOf(l.des, l.u); if (a && achN(a.pref) > 0) return { pu: achN(a.pref), src: "std", lab: "STANDARD", lock: true };
  return { pu: achN(l.pu), src: "man", lab: achN(l.pu) > 0 ? "SAISI À LA MAIN" : "À SAISIR", lock: false }; };
const achCafEstMt = (c, BP) => { BP = BP || achCafBdgPx(); return (c.lignes || []).reduce((t, l) => t + achN(l.q) * achCafEst(l, BP).pu, 0); };
/* une consultation avec au moins un prix saisi à la main passe par un validateur, quel que soit le seuil (réglage PARAMÉTRAGE › ACHATS › CONSULTATIONS) */
/* v1136 (L24) : lignes à prix saisi à la main, signalées au validateur */
const achCafManLines = c => { const BP = achCafBdgPx(); return (c.lignes || []).filter(l => String(l.des || "").trim() && achCafEst(l, BP).src === "man").map(l => l.des + " : " + achF2(achN(l.pu)) + " HT"); };
const achCafManForce = c => { if (achPrm().cafMan === false) return ""; const BP = achCafBdgPx(); return (c.lignes || []).some(l => String(l.des || "").trim() && achCafEst(l, BP).src === "man") ? "PRIX SAISI À LA MAIN" : ""; };
const achCafGate = (C, persist) => achCircGate("caf", C, achCafEstMt(C), persist, achCafManForce(C));
const achSeuOwn = k => { const T = achPrm().seuT || {}; return !!k && k !== "gen" && Array.isArray(T[k]); };
const achSeuL = k => achSeuOwn(k) ? achPrm().seuT[k] : achPrm().seuV;
/* F4 (série F) : chaque NIVEAU a un seuil de départ et de fin (fin vide = sans fin ; 0 et vide = tout passe par ce niveau) ; les niveaux dont
   la plage contient le montant valident tous (grades réunis, du plus bas au plus haut si l'un demande la hiérarchie) */
const achPcSeu = (k, ht) => { const S = achSeuL(k).filter(x => (x.g || []).length && (achN(x.mt) > 0 ? ht > achN(x.mt) : ht >= 0) && (x.fin === "" || x.fin === undefined || ht <= achN(x.fin)));
  if (!S.length) return null; const top = S.slice().sort((a, b) => achN(b.mt) - achN(a.mt))[0];
  return { mt: achN(top.mt), g: [...new Set(S.flatMap(x => x.g.map(String)))].sort((a, b) => +b - +a), h: S.some(x => x.h), k }; };
const achCmfSeu = c => achCmfSeuK(c, achPcSeu("cmf", achCmfTot(c).ht));   /* série K : contrôle des dépenses du budget (49-clients-projets.js) */
const achCircNext = c => { const K = c.circ; if (!K) return []; const done = new Set((K.ok || []).map(x => String(x.g))), rest = K.g.filter(g => !done.has(g)); return K.h ? rest.slice(0, 1) : rest; };
const achCircDone = c => !!c.circ && achCircNext(c).length === 0;
/* 06/11 : circuit d'une pièce autre que la commande (facture : BON À PAYER ; paiement : VALIDER) — rend true tant que la pièce ne peut pas être validée :
   1er appel = ENVOYER EN VALIDATION (pièce verrouillée) ; ensuite, fenêtre du circuit : chaque grade attendu ACCEPTE ou RENVOIE avec ses remarques */
/* v1134 (L24) : force = validation obligatoire quel que soit le montant (ex. consultation avec un prix saisi à la main) — premier niveau réglé */
const achPcSeuMin = k => { const S = achSeuL(k).filter(x => (x.g || []).length).sort((a, b) => achN(a.mt) - achN(b.mt))[0]; return S ? { mt: achN(S.mt), g: S.g.map(String), h: !!S.h, k, force: true } : null; };
async function achCircGate(k, X, ht, persist, force) {
  if (achCircDone(X)) return false;
  const S = achPcSeu(k, ht) || (force ? achPcSeuMin(k) : null);
  if (!S && force) { svToast(force + " : AUCUN VALIDATEUR RÉGLÉ (PARAMÉTRAGE › ACHATS › CONSULTATIONS › VALIDATION).", 5000); return true; }
  if (!S) return false;
  if (!X.circ) { if (!(await svConfirm({ title: "ENVOYER EN VALIDATION", text: (X.ref || "") + " : " + achF2(ht) + " HT" + (S.force && !achPcSeu(k, ht) ? " — " + force + " : VALIDATION OBLIGATOIRE" : ", AU-DELÀ DE " + achF2(S.mt) + " HT") + " — VALIDATION PAR " + S.g.map(achGradeLab).join(S.h ? " PUIS " : " OU ") + ". LA PIÈCE EST VERROUILLÉE PENDANT LE CIRCUIT.", ok: "ENVOYER", tone: "neutral" }))) return true;
    X.circ = { ...S, ok: [], t: achNow() }; await persist("ENVOYÉ EN VALIDATION"); return true; }
  const nx = achCircNext(X), d = sviWinNew();
  d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: "CIRCUIT DE VALIDATION — " + esc(X.ref || ""),
    body: `<div class="frs-st">${X.circ.force ? "VALIDATION OBLIGATOIRE (PRIX SAISI À LA MAIN)" : "AU-DELÀ DE " + esc(achF2(X.circ.mt)) + " HT"}${X.circ.h ? " (HIÉRARCHIE RESPECTÉE)" : ""}</div>${(ML => ML.length ? `<div class="frs-st">PRIX SAISIS À LA MAIN (${ML.length}) :</div>${ML.length > 5 ? `<div>${ML.length} LIGNES — VOIR LA COLONNE SOURCE DU PRIX</div>` : ML.map(m => `<div>- ${esc(m)}</div>`).join("")}` : "")(k === "caf" && typeof achCafManLines === "function" ? achCafManLines(X) : [])}<table class="prm-table frs-sub"><thead><tr><th>GRADE</th><th>ÉTAT</th><th>PAR</th><th>LE</th></tr></thead><tbody>${X.circ.g.map(g => { const o = (X.circ.ok || []).find(y => String(y.g) === g);
      return `<tr><td>${esc(achGradeLab(g))}</td><td>${o ? "ACCEPTÉ" : nx.includes(g) ? "À VALIDER" : "EN ATTENTE"}</td><td>${esc(o ? o.u || "" : "")}</td><td>${esc(o ? svDT(o.t) : "")}</td></tr>`; }).join("")}</tbody></table>`,
    foot: `<button type="button" class="svc-b" data-x>ANNULER</button>${nx.map(g => `<button type="button" class="svc-b" data-cret="${g}">RENVOYER (${esc("GRADE " + g)})</button><button type="button" class="svc-b svc-ok svc-neutral" data-cacc="${g}">ACCEPTER (${esc("GRADE " + g)})</button>`).join("")}` });
  sviWinShow(d);
  return new Promise(res => d.addEventListener("click", async e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); res(true); return; }
    const a = e.target.closest("[data-cacc]"), r = e.target.closest("[data-cret]"); if (!a && !r) return; const g = (a || r).dataset.cacc || (a || r).dataset.cret;
    if (r) { const m = await achAsk("RENVOYER " + (X.ref || "") + " AU GRADE INFÉRIEUR", "REMARQUES (" + achGradeLab(g) + ")"); if (!m) return;
      X.renv = (X.renv || []).concat([{ g, u: sviUser(), t: achNow(), why: m }]); X.circ = null; d.remove(); await persist("RENVOYÉ PAR GRADE " + g + " : " + m); res(true); return; }
    X.circ.ok = (X.circ.ok || []).concat([{ g, u: sviUser(), t: achNow() }]); d.remove(); await persist("ACCEPTÉ PAR GRADE " + g); res(!achCircDone(X)); }));
}
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
/* 05/11 : PLUS DE GROUPES — LOCAL ou ÉTRANGER vient du PAYS de la fiche (vide ou MAROC = local ; une ancienne fiche ÉTRANGER sans pays le reste) ;
   préfixe FRS / FRE (ou celui du type) ; un ancien OCCASIONNEL garde sa dispense d'ICE et de RIB et son préfixe OCC */
const ACH_ORIG = [{ id: "loc", nom: "LOCAL", pre: "FRS", req: ["ice", "rib"] }, { id: "etr", nom: "ÉTRANGER", pre: "FRE", req: ["pays", "rib"] }, { id: "occ", nom: "OCCASIONNEL", pre: "OCC", req: [] }];
const achPaysLocal = p => { p = achU(p || ""); return !p || p === "MAROC" || p === "MA"; };
const achFrsGrpId = f => { if (!f) return "loc"; const g = typeof f.grp === "string" ? f.grp : f.occ ? "occ" : ""; if (g === "occ") return "occ"; if (!achU(f.pays || "")) return g === "etr" ? "etr" : "loc"; return achPaysLocal(f.pays) ? "loc" : "etr"; };
const achFrsTypeLab = f => (f && f.type) || (f && ACH_GRP_OLD[f.grp]) || (f && f.orgFin && typeof f.grp !== "string" ? ACH_GRP_OLD.fin : "") || "";
const achFrsType = f => { const l = achFrsTypeLab(f); return l ? sviPgL("ftypes").find(t => t.lab === l) || null : null; };
const achFrsTypeDocs = f => String((achFrsType(f) || {}).docs || "").split(";").map(s => achU(s)).filter(Boolean);
const achFrsGrp = f => ACH_ORIG.find(g => g.id === achFrsGrpId(f)) || ACH_ORIG[0];
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
  { const m = achFrsMissing(f); if (m.length) w.push(achFrsGrp(f).nom + " : " + m.join(", ") + " MANQUANT" + (m.length > 1 ? "S" : "")); }
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
  /* 06/11 (soir) : un besoin ne vise qu'un article de la liste des articles (son prix standard donne le montant de validation) */
  else if (!achArtOf(b.des, b.u)) w.push("ARTICLE ABSENT DE LA LISTE DES ARTICLES");
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
const achNextRef = (pfx, L, d) => { d = d || new Date(); const R = achPrm().refs[pfx] || { m: (pfx === "CAF" ? "CFA" : pfx) + " {AA}-{MM}{JJ}/{NNN}", rz: "jour" }, rx = achRefRx(R.m);
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
  /* 06/11 (soir) : une ligne hors de la liste des articles doit avoir un prix (montant de validation) */
  /* v1134 (L24) : prix à saisir seulement s'il n'existe ni dans un budget actif ni en prix standard */
  { const BP = achCafBdgPx(); (c.lignes || []).forEach(l => { if (l.des && achCafEst(l, BP).src === "man" && !(achN(l.pu) > 0)) w.push(l.des + " : NI BUDGET NI PRIX STANDARD, PRIX ESTIMÉ À SAISIR"); }); }
  /* 07/11 : lignes importées non encore vérifiées */
  { const ni = (c.lignes || []).filter(l => l.imp).length; if (ni) w.push(ni + " DÉTAIL(S) IMPORTÉ(S) À VÉRIFIER"); }
  if (!(c.frs || []).length) w.push("AUCUN FOURNISSEUR CONSULTÉ");
  /* E6 (série E) : nombre minimum de fournisseurs consultés (PARAMÉTRAGE › ACHATS › RÈGLES INTERNES), non bloquant */
  else if ((c.frs || []).length < achPrm().ncons) w.push((c.frs || []).length + " FOURNISSEUR(S) CONSULTÉ(S) SUR " + achPrm().ncons + " AU MOINS");
  const att = (c.frs || []).filter(f => ((c.rep || {})[f] || {}).st !== "repondu" && ((c.rep || {})[f] || {}).st !== "decline");
  if (c.dlim && c.dlim < today && att.length) w.push("DATE LIMITE DÉPASSÉE : " + att.length + " RÉPONSE(S) EN ATTENTE");
  /* F8 (série F) : un détail chiffré deux fois par le même fournisseur — rien n'est choisi d'office : prix à choisir (comparatif) */
  if (typeof achCafPrices === "function") (c.frs || []).forEach(f => (c.lignes || []).forEach(l => { if (!l.id || !(((c.lf || {})[l.id] || []).includes(f))) return; const p = achCafPrice(c, f, l, D); if (p.st === "choix") w.push(l.des + " CHIFFRÉ " + p.n + " FOIS PAR " + achFrsNom(f) + " : PRIX À CHOISIR (COMPARATIF)"); }));
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
  { const no = achFrsPlafNo(f, (c.lignes || []).reduce((t, l) => t + achN(l.q) * achN(l.pu), 0) * (1 - achN(c.rem) / 100)) || achArtPartNo(c, f); if (no) return no; }
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
  try { const t = localStorage.getItem("svi_ach_tab_v1"); if (["art", "prm", "frs", "cli", "prj", "bsn", "caf", "dvf", "cmf", "rcp", "rtc", "rtr", "faf", "avf", "paf"].includes(t)) tab = achGoMap[t] || t;   /* D1 : plus d'interface RETOURS / AVOIRS */ } catch (e) {}
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
  const NV = { art: achArtNvMod(X), frs: achFrsNvMod(X), cli: achCliNvMod(X), prj: achPrjNvMod(X) };   /* 10/11 : CLIENTS et PROJETS (49-clients-projets.js) */
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
  /* 05/11 : plus d'onglets ici — chaque partie est un onglet de PARAMÉTRAGE (ACHATS : RÈGLES INTERNES, ALERTES DE RETARD, MENTIONS IMPRIMÉES, CLAUSES ;
     GÉNÉRAL : RÉFÉRENCES ; ARTICLES : CATÉGORIES) ; le corps de l'écran des achats y est posé le temps de l'onglet (view.__prmMount) */
  const PTABS = [];
  let prmSub = "regl"; const prmTab = () => prmSub;
  const bodyHome = document.createComment("ach-body"); body.before(bodyHome);
  view.__prmMount = (host, s) => { prmSub = s; if (body.parentNode !== host) { host.innerHTML = ""; host.appendChild(body); } tab = "prm"; draw(); };
  /* 06/11 : type de pièce dont on règle les seuils (GÉNÉRAL = proposé par défaut aux types sans réglage propre) */
  let seuK = "gen";
  /* v1135 (L25) : k = type réglé (par défaut l'onglet choisi ; « caf » pour l'emplacement VALIDATION de PARAMÉTRAGE › ACHATS › CONSULTATIONS) */
  const seuEdit = (P, k = seuK) => { if (k === "gen") return P.seuV; P.seuT = P.seuT || {}; if (!Array.isArray(P.seuT[k])) P.seuT[k] = JSON.parse(JSON.stringify(P.seuV)); return P.seuT[k]; };
  const seuKOf = t => (t && t.closest && t.closest("[data-seuk]") || {}).dataset?.seuk || seuK;
  const prmHTML = () => {
    const P = achPrm(), T = prmTab();
    const catRows = cfApply("ach_cat", [["cat1", "CATÉGORIE (FAMILLE D'ARTICLES)", x => x, ""]], P.cat);
    const tabs = "";
    /* B27 : RÉFÉRENCES — modèle et remise à zéro du compteur par type de pièce */
    if (T === "ref") return `<div class="ach-prm">${tabs}
      <div class="ach-pbox"><div class="ach-pt">RÉFÉRENCES DES PIÈCES</div><table class="bdg-d-table prm-table ach-pref"><colgroup><col style="width:260px"><col style="width:240px"><col style="width:190px"><col style="width:200px"><col style="width:200px"><col style="width:220px"></colgroup>
        <thead><tr><th>TYPE DE PIÈCE</th><th data-tip="TEXTE FIXE TEL QUEL ; VARIABLES ENTRE ACCOLADES : {AA} ANNÉE SUR 2 CHIFFRES ({AAAA} SUR 4), {MM} MOIS, {JJ} JOUR, {NNN} COMPTEUR (AUTANT DE CHIFFRES QUE DE N). EXEMPLE : DVF {AA}-{MM}{JJ}/{NNN} → DVF 26-0101/012">MODÈLE</th><th>EXEMPLE (AUJOURD'HUI, N° 12)</th><th>REMISE À ZÉRO DU COMPTEUR</th><th data-tip="{PARENT} = RÉFÉRENCE DE LA PIÈCE ; {LLL} = COMPTEUR DES LIGNES (AUTANT DE CHIFFRES QUE DE L), QUI REPART À 001 DANS CHAQUE PIÈCE">MODÈLE DES DÉTAILS</th><th>EXEMPLE (LIGNE 2)</th></tr></thead>
        <tbody>${ACH_REF_T.map(([k, l]) => { const R = P.refs[k]; return `<tr><td>${l}</td><td><input class="ins-in ach-ref" data-k="${k}" data-f="m" value="${esc(R.m)}" autocomplete="off"></td><td>${esc(achRefFill(R.m, new Date(), 12))}</td>
          <td><select class="ins-in ach-ref" data-k="${k}" data-f="rz">${ACH_REF_RZ.map(([v, t]) => `<option value="${v}"${v === R.rz ? " selected" : ""}>${t}</option>`).join("")}</select></td>
          <td><input class="ins-in ach-ref" data-k="${k}" data-f="l" value="${esc(R.l)}" autocomplete="off"></td><td>${esc(achLineRef(k, achRefFill(R.m, new Date(), 12), 1))}</td></tr>`
          /* série H (H1) : modèle à part pour les consultations par fournisseur, sous la consultation */
          + (k === "CAF" ? `<tr><td>CONSULTATION PAR FOURNISSEUR</td><td><input class="ins-in ach-ref" data-k="CAF" data-f="f" value="${esc(R.f)}" autocomplete="off" data-tip="{PARENT} = RÉFÉRENCE DE LA CONSULTATION ; {FF} = NUMÉRO DU FOURNISSEUR DANS LA CONSULTATION"></td><td>${esc(achFilRef({ ref: achRefFill(R.m, new Date(), 12) }, 1))}</td><td>—</td><td>—</td><td></td></tr>` : ""); }).join("")}</tbody></table></div>
      </div>`;
    /* B29 : CLAUSES — deux tableaux pliables (générales : chaque nouveau fournisseur ; particulières : chaque nouvelle commande, page annexe) */
    const tb = (l, ttl, L) => `<details class="ach-pbox ach-pfold" open><summary class="ach-pt">${ttl} ${svCnt(L.length)}</summary>
        <table class="bdg-d-table prm-table ach-pcl"><colgroup><col style="width:60px"><col style="width:260px"><col style="width:440px"><col style="width:140px"><col style="width:110px"><col style="width:44px"></colgroup>
        <thead><tr><th class="center">N°</th><th>TYPE</th><th>DÉSIGNATION</th><th>VALEUR</th><th>UNITÉ</th><th class="center"><input type="checkbox" class="ach-pall" aria-label="Tout cocher"></th></tr></thead>
        <tbody>${L.map((x, i) => `<tr data-clid="${esc(x.id)}"><td class="center">${i + 1}</td><td><select class="ins-in ach-cl" data-l="${l}" data-f="t">${ACH_CLT.map(([k, t]) => `<option value="${k}"${k === x.t ? " selected" : ""}>${t}</option>`).join("")}</select></td>
          <td><input class="ins-in ach-cl" data-l="${l}" data-f="txt" value="${esc(x.txt || "")}" autocomplete="off"></td><td><input class="ins-in ach-cl" data-l="${l}" data-f="v" value="${esc(x.v ?? "")}" autocomplete="off"></td>
          <td><input class="ins-in ach-cl" data-l="${l}" data-f="u" value="${esc(x.u ?? achCltU(x.t))}" autocomplete="off"></td><td class="center"><input type="checkbox" class="ach-pcb" data-xcl="${l}|${esc(x.id)}"></td></tr>`).join("")}
          <tr class="ach-new"><td></td><td colspan="4"><input class="ins-in ach-clnew" data-l="${l}" placeholder="CRÉER UN ARTICLE ICI…" autocomplete="off"></td><td></td></tr></tbody></table>
        <div class="prm-foot"><button type="button" class="prm-del ach-pdel" data-pdel="cl${l}" disabled>SUPPRIMER LES LIGNES COCHÉES <span class="svi-cnt">0</span></button></div></details>`;
    /* v1121 (L16, série L) : le catalogue des CONDITIONS PARTICULIÈRES passe dans PARAMÉTRAGE › ACHATS › CONSULTATIONS (déplacé, pas doublé : même contenu, P.clP) ;
       c'est lui qui alimente le menu déroulant des consultations et les clauses particulières des commandes. L17 : le minimum de fournisseurs consultés par article y est réglé (un seul endroit) */
    if (T === "cla") return `<div class="ach-prm">${tabs}${tb("G", "CLAUSES GÉNÉRALES D'ACHAT (CONTRAT TYPE, REPRIS SUR CHAQUE NOUVEAU FOURNISSEUR)", P.clG)}</div>`;
    if (T === "caf") return `<div class="ach-prm">${tabs}
      <div class="ach-pbox"><div class="ach-pt">CONSULTATIONS</div><table class="bdg-d-table prm-table ach-pgen ach-pcaf"><colgroup><col style="width:520px"><col style="width:140px"><col style="width:220px"></colgroup>
        <thead><tr><th>RÉGLAGE</th><th class="center">VALEUR</th><th>UNITÉ</th></tr></thead><tbody><tr><td data-tip="NON BLOQUANT : MOINS DE FOURNISSEURS CONSULTÉS POUR UN ARTICLE = ALERTE SUR LA CONSULTATION">NOMBRE MINIMUM DE FOURNISSEURS CONSULTÉS PAR ARTICLE</td>
          <td class="center"><input class="ins-in ach-pnum number" data-pk="ncons" inputmode="decimal" value="${P.ncons === "" || P.ncons === undefined ? "" : esc(F2(P.ncons))}" autocomplete="off"></td><td>FOURNISSEURS</td></tr>
          <tr><td data-tip="UNE CONSULTATION AVEC AU MOINS UN PRIX ESTIMÉ SAISI À LA MAIN (NI BUDGET ACTIF NI PRIX STANDARD) PASSE PAR UN VALIDATEUR, QUEL QUE SOIT SON MONTANT">PRIX SAISI À LA MAIN = VALIDATEUR OBLIGATOIRE</td>
          <td class="center"><input type="checkbox" class="ach-pcafman"${P.cafMan !== false ? " checked" : ""} aria-label="Validation obligatoire"></td><td>${P.cafMan !== false ? "OUI" : "NON"}</td></tr></tbody></table></div>
      ${tb("P", "CONDITIONS PARTICULIÈRES (MENU DES CONSULTATIONS ; REPRISES SUR CHAQUE NOUVELLE COMMANDE, IMPRIMÉES EN ANNEXE)", P.clP)}
      ${(() => { /* v1135 (L25, décision d'Ahmed du 11/11) : VALIDATION — tranches de montant estimé (MIN, MAX) et UN validateur (grade) par tranche ;
           mêmes seuils que SEUILS DE VALIDATION › CONSULTATIONS ; validation conjointe à deux personnes : plus tard */
        const GR = sviPgL("grades"), own = achSeuOwn("caf");
        return `<div class="ach-pbox" data-seuk="caf"><div class="ach-pt">VALIDATION ${svCnt(achSeuL("caf").length)}</div>
        <div class="ach-seuinfo">${own ? "TRANCHES PROPRES AUX CONSULTATIONS (MONTANT ESTIMÉ HT). " : "SEUIL GÉNÉRAL PROPOSÉ PAR DÉFAUT : LE MODIFIER ICI LE RÈGLE POUR LES CONSULTATIONS SEULEMENT. "}UN PRIX SAISI À LA MAIN PASSE PAR LE VALIDATEUR DE LA PREMIÈRE TRANCHE SI LE RÉGLAGE CI-DESSUS EST SUR OUI.</div>
        <table class="bdg-d-table prm-table ach-pseu ach-pcafv"><colgroup><col style="width:170px"><col style="width:170px"><col style="width:300px"><col style="width:44px"></colgroup>
        <thead><tr><th class="center">MIN (DH HT)</th><th class="center" data-tip="VIDE = SANS MAXIMUM">MAX (DH HT)</th><th>VALIDATEUR (GRADE)</th><th class="center"><input type="checkbox" class="ach-pall" aria-label="Tout cocher"></th></tr></thead>
        <tbody>${achSeuL("caf").map(x => `<tr data-sid="${esc(x.id)}"><td class="center"><input class="ins-in ach-seu number" data-f="mt" inputmode="decimal" value="${esc(F2(x.mt))}"></td><td class="center"><input class="ins-in ach-seu number" data-f="fin" inputmode="decimal" value="${x.fin === "" || x.fin === undefined ? "" : esc(F2(x.fin))}" placeholder="SANS MAXIMUM"></td>
          <td><select class="ins-in ach-seu" data-f="g1"><option value="">—</option>${GR.map(g => `<option value="${esc(String(g.n))}"${String((x.g || [])[0] ?? "") === String(g.n) ? " selected" : ""}>${esc(g.lab || "GRADE " + g.n)}</option>`).join("")}</select>${(x.g || []).length > 1 ? ` <i class="ach-seuinfo">(+${(x.g || []).length - 1} AUTRE(S) GRADE(S) — CHOISIR UN SEUL VALIDATEUR)</i>` : ""}</td>
          <td class="center"><input type="checkbox" class="ach-pcb" data-xseu="${esc(x.id)}"></td></tr>`).join("")}
          <tr class="ach-new"><td colspan="3"><input class="ins-in ach-seunew number" inputmode="decimal" placeholder="CRÉER UNE TRANCHE ICI… (MONTANT MIN)" autocomplete="off"></td><td></td></tr></tbody></table>
        <div class="prm-foot"><button type="button" class="prm-del ach-pdel" data-pdel="seu" disabled>SUPPRIMER LES LIGNES COCHÉES <span class="svi-cnt">0</span></button></div></div>`; })()}</div>`;
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
      ["plafT", "PLAFOND DE TRANSACTIONS PAR FOURNISSEUR (PAR DÉFAUT), MONTANT SUR 12 MOIS", "DH HT"], ["plafP", "PLAFOND DE TRANSACTIONS PAR FOURNISSEUR (PAR DÉFAUT), PART DES ACHATS", "%"], ["nfrs", "NOMBRE MINIMUM DE DEVIS PAR CONSULTATION", "DEVIS"], ["nrep", "RÉPARTITION : NOMBRE DE FOURNISSEURS PAR ARTICLE", "FOURNISSEURS"], ["mrep", "RÉPARTITION : MARGE AUTOUR DE LA PART CIBLE", "± POINTS DE %"], ["exFin", "MOIS DE CLÔTURE DE L'EXERCICE (ARCHIVAGE JAMAIS AVANT 12 MOIS)", "MOIS (1 À 12)"]];
    const tip = { directJ: "LE JOUR EST TOUJOURS CUMULÉ ; PAR ARTICLE ET PAR FOURNISSEUR", tol: "AU-DESSUS DU RESTE À RECEVOIR", ecart: "ARRONDIS", nfrs: "NON BLOQUANT : MOINS DE DEVIS = ! DEVANT LE PRIX RETENU", ncons: "NON BLOQUANT : MOINS DE FOURNISSEURS CONSULTÉS = ALERTE ⚠ SUR LA CONSULTATION", plafT: "REPRIS À LA CRÉATION DE CHAQUE FOURNISSEUR, MODIFIABLE SUR SA FICHE ; ATTEINT = FOURNISSEUR BLOQUÉ" };
    const G = sviPgL("grades"), gl = s => String(s || "").split(/[,;\s]+/).filter(Boolean);
    const keep = { regl: ["ach-pgen", "ach-pesp", "ach-pseu"], alr: ["ach-palr"], ment: ["ach-pment"] }[T] || ["ach-pgen", "ach-pesp", "ach-pseu"];
    const tpl = document.createElement("template"); tpl.innerHTML = `<div class="ach-prm">
      <div class="ach-pbox"><div class="ach-pt">RÈGLES INTERNES</div><table class="bdg-d-table prm-table ach-pgen"><colgroup><col style="width:520px"><col style="width:140px"><col style="width:220px"></colgroup>
        <thead><tr><th>RÉGLAGE</th><th class="center">VALEUR</th><th>UNITÉ</th></tr></thead><tbody>${R.map(([k, l, u, cls]) => `<tr><td${tip[k] ? ` data-tip="${esc(tip[k])}"` : ""}>${l}</td>
          <td class="center"><input class="ins-in ${cls || "ach-pnum"} number" data-pk="${k}" inputmode="decimal" value="${P[k] === "" || P[k] === undefined ? "" : esc(F2(P[k]))}" title="${esc(tip[k] || "")}" autocomplete="off"></td>
          <td>${u}</td></tr>`).join("")}</tbody></table></div>
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
      <div class="ach-pbox"><div class="ach-pt">SEUILS DE VALIDATION — CIRCUIT PROPRE À CHAQUE TYPE DE PIÈCE</div>
        <div class="rec-tabs ach-seut">${ACH_CIRC_T.map(([k, l]) => `<button type="button" class="rec-tab${k === seuK ? " active on" : ""}" data-seut="${k}">${l}${k !== "gen" && !achSeuOwn(k) ? " · GÉNÉRAL" : ""}</button>`).join("")}</div>
        ${seuK !== "gen" ? `<div class="ach-seuinfo">${achSeuOwn(seuK) ? `RÉGLAGE PROPRE À CE TYPE. <button type="button" class="ach-link" data-seugen>REPRENDRE LE SEUIL GÉNÉRAL</button>` : "SEUIL GÉNÉRAL PROPOSÉ PAR DÉFAUT : LE MODIFIER ICI LE RÈGLE POUR CE TYPE SEULEMENT."}</div>` : ""}
        <table class="bdg-d-table prm-table ach-pseu"><colgroup><col style="width:170px"><col style="width:170px"><col style="width:260px"><col style="width:200px"><col style="width:44px"></colgroup>
        <thead><tr><th class="center" data-tip="F4 : LE NIVEAU S'APPLIQUE DE CE MONTANT…">DE (DH HT)</th><th class="center" data-tip="… JUSQU'À CE MONTANT ; VIDE = SANS FIN. 0 ET VIDE = TOUT PASSE PAR CE NIVEAU">À (DH HT)</th><th>GRADES QUI VALIDENT (N°, SÉPARÉS PAR ,)</th><th class="center">RESPECTER LA HIÉRARCHIE</th><th class="center"><input type="checkbox" class="ach-pall" aria-label="Tout cocher"></th></tr></thead>
        <tbody>${achSeuL(seuK).map(x => `<tr data-sid="${esc(x.id)}"><td class="center"><input class="ins-in ach-seu number" data-f="mt" inputmode="decimal" value="${esc(F2(x.mt))}"></td><td class="center"><input class="ins-in ach-seu number" data-f="fin" inputmode="decimal" value="${x.fin === "" || x.fin === undefined ? "" : esc(F2(x.fin))}" placeholder="SANS FIN"></td>
          <td><input class="ins-in ach-seu" data-f="g" value="${esc((x.g || []).join(", "))}" title="${esc(G.map(g => g.n + " = " + (g.lab || "GRADE " + g.n)).join(" ; "))}"></td>
          <td class="center"><input type="checkbox" class="ach-seu" data-f="h"${x.h ? " checked" : ""}></td><td class="center"><input type="checkbox" class="ach-pcb" data-xseu="${esc(x.id)}"></td></tr>`).join("")}
          <tr class="ach-new"><td colspan="4"><input class="ins-in ach-seunew number" inputmode="decimal" placeholder="CRÉER UN NIVEAU ICI… (MONTANT DE DÉPART)" autocomplete="off"></td><td></td></tr></tbody></table>
        <div class="prm-foot"><button type="button" class="prm-del ach-pdel" data-pdel="seu" disabled>SUPPRIMER LES LIGNES COCHÉES <span class="svi-cnt">0</span></button></div></div>
      </div>`;
    tpl.content.querySelectorAll(".ach-pbox").forEach(b => { if (!keep.some(c => b.querySelector("table." + c))) b.remove(); });
    return tpl.innerHTML;
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
    if (tab === "prm" && body.parentNode === bodyHome.parentNode) tab = "art";   /* 05/11 : ACHATS › PARAMÈTRES est dans PARAMÉTRAGE */
    if (tab !== "prm" && body.parentNode !== bodyHome.parentNode) bodyHome.after(body);
    bar.querySelectorAll(".prm-tab").forEach(b => b.classList.toggle("on", b.dataset.ach === tab));
    /* v765 : plus de rangée d'onglets : on passe d'une liste à l'autre par le menu ☰ (comme les budgets) ; pas d'étiquette du budget ici */
    bar.style.display = "none"; document.getElementById("sviScreenTag")?.remove(); document.body.classList.remove("bdg-screen");
    /* v766 : les listes ont la forme exacte de la liste des budgets (titre et ☰ dans la liste elle-même) ; la page garde l'en-tête de l'écran */
    const PM = NV[tab] || MODS[tab] || (tab === "bsn" ? BSNM : null);
    if (PM && PM.isPage) { const M = PM; body.innerHTML = M.html(); if (h1) h1.innerHTML = M.isPage() ? M.h1() : "";
      /* v776 : page = étiquette de l'écran en haut au centre (comme « BUDGET »), en-tête de l'écran caché */
      if (M.isPage()) { const t = document.createElement("div"); t.id = "sviScreenTag"; t.innerHTML = M.h1(); view.appendChild(t);
        /* 05/11 : le bandeau du centre est du texte sur la barre — fond, couleur, police et taille de la référence (suivent MODIFIER LE FORMAT) */
        requestAnimationFrame(() => { const r = view.querySelector(".nvp-ref"), bar = r && r.closest(".novapp-list-titlebar"); if (!r || !t.isConnected) return; const cs = getComputedStyle(r), bs = getComputedStyle(bar);
          Object.assign(t.style, { fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, color: cs.color, background: bs.backgroundColor === "rgba(0, 0, 0, 0)" ? "transparent" : bs.backgroundColor, top: (r.getBoundingClientRect().top + window.scrollY) + "px", lineHeight: cs.lineHeight }); });   /* v787 : dans l'écran des achats — disparaît avec lui (jamais sur un budget) */ document.body.classList.add("bdg-screen"); } if (sub) sub.textContent = ""; view.classList.toggle("ach-page", M.isPage()); view.classList.toggle("ach-bdgl", !M.isPage()); achBdglSync(body); return; }
    view.classList.remove("ach-page");
    const LM = tab === "bsn" ? BSNM : MODS[tab];
    if (LM && LM.h1) { body.innerHTML = LM.html(); if (sub) sub.textContent = ""; view.classList.add("ach-bdgl"); achBdglSync(body); return; }
    view.classList.remove("ach-bdgl");
    /* v785 : PARAMÈTRES (et tout écran des achats sans liste) : même barre commune à droite du titre */
    { const sh = view.querySelector(".section-head"); if (sh && !sh.querySelector(".svi-hdr")) { { const h = sh.querySelector("h1, h2"); if (h && !sh.querySelector(".nvl-h")) h.insertAdjacentHTML("afterend", sviListIH(true)); } sh.insertAdjacentHTML("beforeend", sviListBar()); sh.style.display = "flex"; sh.style.alignItems = "center"; } }
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
  view.__achWhere = () => { const M = NV[tab] || MODS[tab] || (tab === "bsn" ? BSNM : null); return { t: tab, id: M && M.cur ? M.cur() : null }; };   /* série I (I3) : où l'on est */
  view.__achOpen = (t, id) => { const M = NV[t] || MODS[t] || (t === "bsn" ? BSNM : null); if (M && M.open) M.open(id); };   /* v779 : page d'une pièce liée */
  view.__achTab = (t, noDraw) => { Object.values(NV).forEach(M => M.close()); Object.values(MODS).forEach(M => M.close && M.close()); if (BSNM.close) BSNM.close(); if (!["art", "prm", "frs", "cli", "prj", "bsn", "caf", "dvf", "cmf", "rcp", "rtc", "rtr", "faf", "avf", "paf"].includes(t)) return; tab = t; SEL.clear(); try { localStorage.setItem("svi_ach_tab_v1", tab); } catch (err) {} if (!noDraw) draw(); };   /* B48 : pas de dessin de la liste quand on ouvre directement une pièce */
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
    const sk = e.target.closest("[data-seut]"); if (sk) { seuK = sk.dataset.seut; draw(); return; }
    if (e.target.closest("[data-seugen]")) { const P = achPrm(); if (P.seuT) delete P.seuT[seuK]; achPrmSave(P); draw(); return; }
    const pd = e.target.closest("[data-pdel]");
    if (pd) { if (pd.disabled) return; const tb = pd.closest(".ach-pbox").querySelector("table"), ck = [...tb.querySelectorAll(".ach-pcb:checked")];
      const xg = new Set(ck.map(c => c.dataset.xgrp).filter(Boolean));
      if (xg.size) { const u = achFrs().find(f => !f.del && xg.has(achFrsGrpId(f))); if (u) { svToast("GROUPE UTILISÉ PAR " + u.code + " — " + u.nom + " : SUPPRESSION REFUSÉE.", 4000); return; }
        if (xg.size >= achPrm().grp.length) { svToast("IL FAUT GARDER AU MOINS UN GROUPE.", 3000); return; } }
      const labs = ck.map(c => c.dataset.xcat || ((achPrm().grp.find(g => g.id === c.dataset.xgrp) || {}).nom || "") || (c.dataset.xesp ? "PLAFOND EN ESPÈCES" : "") || (c.dataset.xseu ? "SEUIL DE VALIDATION" : "") || (c.dataset.xcl ? "ARTICLE " + ((c.closest("tr").querySelector('input[data-f="txt"]') || {}).value || "") : "")).filter(Boolean);
      if (!ck.length || !(await svConfirm({ title: "SUPPRIMER LES LIGNES COCHÉES", html: `<ul class="svc-list">${labs.map(l => `<li>${esc(l)}</li>`).join("")}</ul>`, ok: "SUPPRIMER" }))) return;
      const P = achPrm(), xc = new Set(ck.map(c => c.dataset.xcat).filter(Boolean)), xb = new Set(ck.map(c => c.dataset.xbq).filter(Boolean));
      const xe = new Set(ck.map(c => c.dataset.xesp).filter(Boolean)), xs = new Set(ck.map(c => c.dataset.xseu).filter(Boolean));
      P.cat = P.cat.filter(c => !xc.has(c)); P.grp = P.grp.filter(g => !xg.has(g.id)); P.espL = P.espL.filter(x => !xe.has(x.id)); if (xs.size) { const SL = seuEdit(P, seuKOf(ck.find(c => c.dataset.xseu))); SL.splice(0, SL.length, ...SL.filter(x => !xs.has(x.id))); }
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
      if (f === "f" && v && !(/\{F+\}/.test(v) && /\{PARENT\}/.test(v))) { svToast("LE MODÈLE DES CONSULTATIONS PAR FOURNISSEUR DOIT CONTENIR {PARENT} ET LE NUMÉRO {FF}.", 3500, t); draw(); return; }
      if (f === "l" && v && !(/\{L+\}/.test(v) && /\{PARENT\}/.test(v))) { svToast("LE MODÈLE DES DÉTAILS DOIT CONTENIR {PARENT} ET LE COMPTEUR {LLL}.", 3500, t); draw(); return; }
      P.refs = { ...P.refs, [k]: { ...P.refs[k], [f]: v } }; achPrmSave(P); draw(); return; }
    if (t.classList.contains("ach-cl") || t.classList.contains("ach-clnew")) { const P = achPrm(), l = "cl" + t.dataset.l, L = P[l].map(x => ({ ...x }));
      if (t.classList.contains("ach-clnew")) { const v = achU(t.value); if (!v) return; L.push({ id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), t: "autre", txt: v }); }
      else { const x = L.find(y => y.id === t.closest("tr").dataset.clid); if (!x) return;
        if (t.dataset.f === "t") { if (!x.txt || x.txt === achCltDef(x.t)) x.txt = achCltDef(t.value); if (!x.u || x.u === achCltU(x.t)) x.u = achCltU(t.value); if (!x.v || x.v === achCltOf(x.t)[5]) x.v = achCltOf(t.value)[5]; x.t = t.value; } else x[t.dataset.f] = achU(t.value); }
      P[l] = L; achPrmSave(P); draw(); return; }
    if (t.classList.contains("ach-pplu")) { const P = achPrm(); P.plafU = t.value; achPrmSave(P); draw(); return; }
    if (t.classList.contains("ach-alr")) { const P = achPrm(), s = String(t.value).trim(); if (s && !/^\d+$/.test(s)) { svToast("NOMBRE DE JOURS (VIDE = PAS D'ALERTE).", 3000, t); draw(); return; } P.alr = { ...P.alr, [t.dataset.k]: s === "" ? "" : +s }; achPrmSave(P); draw(); return; }
    if (t.classList.contains("ach-esp")) { const P = achPrm(), x = P.espL.find(y => y.id === t.closest("tr").dataset.eid); if (!x) return; const f = t.dataset.f;
      if (f === "per") x.per = t.value; else { const v = achN(t.value); if (v < 0 || (f === "n" && !(v >= 1))) { svToast("VALEUR NON VALIDE.", 3000, t); draw(); return; } x[f] = v; } achPrmSave(P); draw(); return; }
    if (t.classList.contains("ach-ment")) { const P = achPrm(); P.ment = { ...P.ment, [t.dataset.f]: t.checked }; achPrmSave(P); return; }
    if (t.classList.contains("ach-seu") || t.classList.contains("ach-seunew")) { const P = achPrm(), gr = sviPgL("grades").map(g => String(g.n));
      const SL = seuEdit(P, seuKOf(t));
      if (t.classList.contains("ach-seunew")) { const v = achN(t.value); if (!(v >= 0) || String(t.value).trim() === "") return; SL.push({ id: "s" + Date.now().toString(36), mt: v, fin: "", g: [], h: true }); SL.sort((a, b) => a.mt - b.mt); achPrmSave(P); draw(); return; }
      const x = SL.find(y => y.id === t.closest("tr").dataset.sid); if (!x) return; const f = t.dataset.f;
      if (f === "g1") x.g = t.value ? [t.value] : [];   /* v1135 (L25) : un seul validateur par tranche */
      else if (f === "h") x.h = t.checked; else if (f === "mt") { const v = achN(t.value); if (!(v >= 0) || String(t.value).trim() === "") { svToast("MONTANT NON VALIDE.", 3000, t); draw(); return; } x.mt = v; }
      else if (f === "fin") { const s0 = String(t.value).trim(), v = achN(s0); if (s0 && !(v > achN(x.mt))) { svToast("LA FIN DOIT ÊTRE AU-DESSUS DU DÉPART (VIDE = SANS FIN).", 3500, t); draw(); return; } x.fin = s0 ? v : ""; }
      else { const L = String(t.value).split(/[,;\s]+/).filter(Boolean), bad = L.filter(g => !gr.includes(g)); if (bad.length) { svToast("GRADE INCONNU : " + bad.join(", ") + " (PARAMÉTRAGE GÉNÉRAL › GRADES).", 3500, t); draw(); return; } x.g = [...new Set(L)].sort((a, b) => b - a); }
      SL.sort((a, b) => a.mt - b.mt); achPrmSave(P); draw(); return; }
    if (t.classList.contains("ach-pcafman")) { const P = achPrm(); P.cafMan = !!t.checked; achPrmSave(P); draw(); return; }   /* v1134 (L24) */
    if (t.classList.contains("ach-ptol")) { const P = achPrm(), v = achN(t.value); if (v < 0 || v > 100) { svToast("TOLÉRANCE NON VALIDE (0 À 100 %).", 3000, t); draw(); return; } P.tol = v; achPrmSave(P); draw(); return; }
    if (t.classList.contains("ach-pdirect")) { const P = achPrm(), v = achN(t.value); if (v < 0) { svToast("SEUIL NON VALIDE.", 3000, t); draw(); return; } P.direct = v; achPrmSave(P); draw(); return; }
    if (t.classList.contains("ach-pnum") && (t.dataset.pk === "plafT" || t.dataset.pk === "plafP") && String(t.value).trim() === "") { const P = achPrm(); P[t.dataset.pk] = ""; achPrmSave(P); draw(); return; }
    if (t.classList.contains("ach-pnum")) { const P = achPrm(), v = achN(t.value), k = t.dataset.pk; if (v < 0 || ((k === "rasT" || k === "seuilBdg") && v > 100) || (["directJ", "nfrs", "ncons", "nrep", "seuilBdg", "exFin"].includes(k) && v < 1) || (k === "mrep" && v > 100) || (k === "exFin" && v > 12)) { svToast("VALEUR NON VALIDE.", 3000, t); draw(); return; } P[k] = v; achPrmSave(P); draw(); return; }
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
    const th = e.target.closest("th"); if (!th || e.target.closest(".cf-btn:not(.nvl-cff), input") || !(th.querySelector(".cf-btn") || th.dataset.cokey)) return;   /* 11/11 : la colonne des cases se déplace aussi */
    const table = th.closest("table"), t = th.querySelector(".cf-btn").dataset.cf || table.querySelector("thead .cf-btn[data-cf]")?.dataset.cf;
    const ths = () => [...table.querySelectorAll("thead tr:first-child > th")].filter(x => x.querySelector(".cf-btn") || x.dataset.cokey);
    const x0 = e.clientX; let on = false, target = null, ghost = null; const arm = sviColArm(e, th);
    const clear = () => ths().forEach(x => x.classList.remove("co-before", "co-after"));
    const mv = ev => {
      if (!on) { if (Math.abs(ev.clientX - x0) < 8) return; if (!arm(ev)) return; on = true; th.classList.add("co-src"); ghost = document.createElement("div"); ghost.id = "coGhost"; ghost.textContent = (th.querySelector(".cf-lab")?.textContent || "").trim(); document.body.appendChild(ghost); }
      ev.preventDefault(); ghost.style.left = ev.clientX + 8 + "px"; ghost.style.top = ev.clientY - 28 + "px"; clear(); target = null;
      const L = ths(); for (const x of L) { const r = x.getBoundingClientRect(); if (ev.clientX >= r.left && ev.clientX < r.right) { if (x !== th) { x.classList.add(L.indexOf(x) > L.indexOf(th) ? "co-after" : "co-before"); target = x; } break; } }
    };
    const up = () => {
      document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
      clear(); th.classList.remove("co-src"); ghost && ghost.remove();
      if (!on || !target) return;
      const keyOf = x => x.dataset.cokey || x.querySelector(".cf-btn").dataset.col, keys = ths().map(keyOf), from = keys.indexOf(keyOf(th)), to = keys.indexOf(keyOf(target));
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
    ["ice", "ICE", f => achDig(f.ice), "center"], ["rib", "RIB PRINCIPAL", f => ribTxt(achFrsRibP(f)), "center"],
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
  const F = JSON.parse(JSON.stringify(f0)), ro = !!f0.del, P = achPrm();   /* v922 : figé (vert) = lecture seule, comme le budget (REVENIR EN INSTANCE pour modifier) */
  F.type = achFrsTypeLab(F); F.grp = achFrsGrpId(F);   /* B41 : un ancien groupe (sous-traitant, organisme financier) devient le type ; le groupe devient LOCAL */
  ["ribs", "docf", "cte", "evl", "cgf", "fam", "cau", "jours", "tar", "fermJ", "refs"].forEach(k => { if (!Array.isArray(F[k])) F[k] = []; });
  if (!Array.isArray(F.cla)) F.cla = achClCopy(P.clG);
  /* 05/11 : un article dont le TYPE est un champ de la fiche prend sa valeur (ou la donne au champ vide) */
  F.cla.forEach(x => { if (x.u === undefined) x.u = achCltU(x.t); if (x.v === undefined) x.v = ""; const k = achCltFld(x.t); if (!k) return; if (F[k] !== "" && F[k] !== undefined && F[k] !== null) x.v = String(F[k]); else if (x.v !== "") F[k] = ACH_CLT_NUM.includes(k) ? achN(x.v) : x.v; });
  const claSnap = () => JSON.stringify(F.cla.map(x => [x.t, x.txt || "", String(x.v ?? ""), x.u || ""]));
  let syncC = [], syncF = {}; const syncMark = () => { syncC = F.cla.map(x => String(x.v ?? "")); syncF = {}; F.cla.forEach(x => { const k = achCltFld(x.t); if (k) syncF[k] = String(F[k] ?? ""); }); };
  { const Q = achFrsPlafs(F); F.plafT = Q.dh; F.plafP = Q.pct; F.plafU = "DH"; }   /* 05/11 : deux plafonds */
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
  const draw = () => { syncMark();
    const why = achFrsWhy(F, achFrs()), note = achFrsNote(F);
    d.innerHTML = sviWinCard({ st: achPcSt("frs", f0), cls: "frs-card", close: "data-x", title: esc(F.nom || "") + " : " + esc(achFrsRef(F)),
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}${F.ribChg && !ro ? ` <button type="button" class="ach-b" data-ribok>RIB VÉRIFIÉ</button>` : ""}</div>` : ""}
        <div class="rec-tabs frs-tabs">${TABS.map(t => `<button type="button" class="rec-tab${t[0] === tab ? " active on" : ""}" data-ftab="${t[0]}">${t[1]}</button>`).join("")}</div>
        <div class="frs-scroll">
        <div class="frs-sec" data-s="id"><div class="frs-st">IDENTITÉ</div><div class="frs-g">
          ${inp("nom", "NOM", { req: 1, w: 1 })}${inp("denom", "DÉNOMINATION SOCIALE", { w: 1 })}${inp("forme", "FORME JURIDIQUE", { list: ACH_FORMES })}${inp("ville", "VILLE", { list: sviPgVilles().map(x => x.lab) })}
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
          ${inp("plafEnc", "PLAFOND D'ENCOURS (MAD)", { num: 1 })}${inp("plafT", "PLAFOND DE TRANSACTIONS (12 MOIS, DH HT)", { num: 1 })}${inp("plafP", "PLAFOND DE TRANSACTIONS (% DES ACHATS)", { num: 1 })}<label class="frs-f"><span>ENCOURS ACTUEL</span><input class="ins-in" value="${esc(achF2(achFrsEnc(id)))}" readonly></label>
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
        <div class="frs-sec" data-s="cla"><div class="frs-st ${F.claOk ? "" : "cla-inst"}">CLAUSES GÉNÉRALES D'ACHAT ${svCnt(F.cla.length)} — ${F.claOk ? "CONTRAT VALIDÉ LE " + esc(achDFr(F.claOk)) + ((F.claHist || []).length ? " (VERSION " + ((F.claHist || []).length + 1) + ")" : "") : "CONTRAT EN INSTANCE" + ((F.claHist || []).length ? " (NOUVELLE VERSION " + ((F.claHist || []).length + 1) + ")" : "")}</div>
          ${sub("cla", [["t", "TYPE", (r) => `<select class="ins-in frs-s" data-c="t"${ro ? " disabled" : ""}>${ACH_CLT.map(([k, l]) => `<option value="${k}"${k === r.t ? " selected" : ""}>${l}</option>`).join("")}</select>`], ["txt", "DÉSIGNATION"], ["v", "VALEUR"], ["u", "UNITÉ"]], "AJOUTER UN ARTICLE")}
          ${!ro && !F.claOk ? `<button type="button" class="ach-b" data-claok>VALIDER LE CONTRAT</button>` : ""}</div>
        </div>`,
      foot: `<button type="button" class="svc-b" data-x>${ro ? "FERMER" : "ANNULER"}</button>${ro ? "" : `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button>`}` });
    const on = (TABS.find(t => t[0] === tab) || TABS[0])[2];
    d.querySelectorAll(".frs-sec[data-s]").forEach(x => { x.hidden = !on.includes(x.dataset.s); });
    { const cd = d.querySelector(".frs-card"); if (cd) { cd.dataset.freq = achFrsFreq(f0).k || ""; cd.dataset.grp = achFrsGrpId(F); } }   /* 05/11 : contexte des champs obligatoires */
    if (!d.isConnected) sviWinShow(d);
  };
  draw();
  if (sec) setTimeout(() => d.querySelector(`.frs-sec[data-s="${sec}"]`)?.scrollIntoView({ block: "start" }), 50);
  /* lecture des cases dans le brouillon (avant chaque redessin) */
  const pull = () => {
    d.querySelectorAll(".frs-x").forEach(i => { const k = i.dataset.k; F[k] = ["ice", "ifisc", "rc", "cnss"].includes(k) ? sviMaskRaw(i.value) : ["patente", "codeCpt", "aeNo"].includes(k) ? achDig(i.value) : ["capital", "effectif", "plafEnc", "plafT", "plafP", "escTaux", "escJours", "retTaux", "delai", "minCmd", "franco", "remise", "garMois", "camions"].includes(k) ? (String(i.value || "").trim() === "" ? "" : achN(i.value)) : ["dateCrea", "cgaDate", "revue"].includes(k) ? i.value : ["site", "mailCmd", "mailFac"].includes(k) ? String(i.value || "").trim().toLowerCase() : k === "gps" ? String(i.value || "").trim() : achU(i.value); });
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
    /* 05/11 : synchronisation article lié ↔ champ de la fiche (celui qu'on vient de changer l'emporte) */
    F.cla.forEach((x, i) => { const k = achCltFld(x.t); if (!k) return; const cv = String(x.v ?? ""), fv = String(F[k] ?? "");
      if (cv !== (syncC[i] ?? cv)) F[k] = cv === "" ? "" : ACH_CLT_NUM.includes(k) ? achN(cv) : cv; else if (fv !== (syncF[k] ?? fv)) x.v = fv; });
    syncMark();
  };
  /* v906 (principe du 03/11/2026 : erreur refusée dès la saisie) : chaque case de la fiche est contrôlée en la quittant —
     la case fautive reprend sa valeur d'avant, avec la raison (les contrôles d'ENREGISTRER restent ; masques IF / RC / CNSS / TÉLÉPHONE : règle commune, 09f) */
  const frsWhy = i => {
    const k = i.dataset.k || i.dataset.c, raw = String(i.value ?? "").trim(), v = achU(raw);
    if (i.classList.contains("frs-x")) {
      if (k === "nom" && !v) return "NOM OBLIGATOIRE.";
      if (k === "ice" && sviMaskRaw(raw)) { const c = sviMaskRaw(raw); if (!achIceOk(c)) return achIceMsg() + "."; const x = achFrsDupIce(achFrs(), c, id); if (x) return "ICE DÉJÀ UTILISÉ PAR " + x.code + " — " + x.nom + "."; }
      if (k === "forme" && v && !ACH_FORMES.includes(v)) return "FORME JURIDIQUE : CHOISIR DANS LA LISTE.";
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
    const inp = tr.querySelector('input[data-c="txt"]'), cur = inp ? achU(inp.value) : x.txt; if (!cur || cur === achCltDef(x.t)) { if (inp) inp.value = achCltDef(s.value); } x.t = s.value; x.txt = inp ? achU(inp.value) : x.txt;
    pull(); x.u = achCltU(x.t); const k = achCltFld(x.t); if (k) x.v = String(F[k] ?? ""); syncMark(); draw(); });
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
    if (ad) { pull(); const k = ad.dataset.add; F[k].push(k === "cla" ? { t: "autre", txt: "", v: "", u: "" } : k === "refs" ? { chantier: "", client: "", annee: "", mt: 0 } : k === "tar" ? { des: "", u: "", pu: 0, valid: "" } : k === "cau" ? { type: ACH_CAUT[0], no: "", bq: "", mt: 0, ech: "" } : k === "ribs" ? { rib: "", p: !F.ribs.length } : k === "docf" ? { type: ACH_DOCF[0], no: "", exp: "" } : k === "cte" ? { nom: "", fonction: "", role: "", tel: "", email: "" } : { intitule: "", debut: "", fin: "" }); draw(); return; }
    const rm = e.target.closest("[data-rm]");
    if (rm) { pull(); const [k, i] = rm.dataset.rm.split("|"); F[k].splice(+i, 1); if (k === "ribs" && F.ribs.length && !F.ribs.some(r => r.p)) F.ribs[0].p = true; draw(); return; }
    if (e.target.closest("[data-evladd]")) {
      pull();
      const crit = [...d.querySelectorAll(".frs-ed")].map(i => ({ d: achU(i.value), n: Math.max(0, Math.min(10, achN((d.querySelector(`.frs-en[data-i="${i.dataset.i}"]`) || {}).value))) })).filter(c => c.d);
      if (!crit.length) { svToast("ÉVALUATION : AU MOINS UN CRITÈRE (NOM ET NOTE).", 3000); return; }
      F.evl.push({ date: new Date().toISOString(), crit, moy: crit.reduce((t, c) => t + c.n, 0) / crit.length }); draw(); return;
    }
    if (e.target.closest("[data-logorm]")) { pull(); F.logo = ""; draw(); return; }
    if (e.target.closest("[data-claok]")) { pull(); F.claOk = achNow(); F.claSnap = claSnap(); draw(); return; }   /* 05/11 : VALIDER LE CONTRAT (enregistré avec la fiche) */
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
    F.grp = achFrsGrpId(F);
    if (achSt(f0) !== "instance" && achFrsPfx(f0) !== achFrsPfx(F)) { svToast("LE PAYS (LOCAL / ÉTRANGER) OU LE TYPE NE SE CHANGE PLUS APRÈS LA VALIDATION : LE PRÉFIXE DE LA RÉFÉRENCE CHANGERAIT.", 4500); return; }
    F.occ = F.grp === "occ"; F.orgFin = F.type === ACH_GRP_OLD.fin;
    if (F.cga && !F.cgaDate) { svToast("CONDITIONS GÉNÉRALES SIGNÉES : DONNER LA DATE.", 3000); return; }
    if (F.forme !== "AUTO-ENTREPRENEUR") { F.aeNo = ""; F.aeCin = ""; }
    if (F.lie && !F.lieT) { svToast("FOURNISSEUR LIÉ : CHOISIR LE LIEN.", 3000); return; }
    if (!F.lie) F.lieT = "";
    F.ribs = F.ribs.filter(r => achDig(r.rib));
    if (F.ribs.some(r => !achRibOk(r.rib))) { svToast("RIB NON VALIDE : 24 CHIFFRES ET CLÉ (LE RIB DOIT ÊTRE DIVISIBLE PAR 97).", 4000); draw(); return; }
    if (new Set(F.ribs.map(r => achDig(r.rib))).size < F.ribs.length) { svToast("LE MÊME RIB EST SAISI DEUX FOIS.", 3500); draw(); return; }
    if (F.ribs.length && !F.ribs.some(r => r.p)) F.ribs[0].p = true;
    F.cte = F.cte.filter(c => c.nom || c.tel || c.email); F.cgf = F.cgf.filter(c => c.intitule); F.cla = F.cla.filter(c => c.txt || c.v || c.t !== "autre");
    /* 05/11 : contrat validé puis modifié (article ou champ lié) = nouvelle version EN INSTANCE ; l'ancienne est gardée */
    if (f0.claOk && f0.claSnap && claSnap() !== f0.claSnap) { F.claHist = (f0.claHist || []).concat([{ t: f0.claOk, cla: JSON.parse(f0.claSnap) }]); F.claOk = ""; F.claSnap = ""; } F.docf = F.docf.filter(x => x.type && (x.no || x.exp)); F.cau = F.cau.filter(x => x.no || x.mt || x.ech); F.tar = F.tar.filter(x => x.des); F.refs = F.refs.filter(x => x.chantier);
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
  return achListMod(ctx, { k: "bsn", t: "ach_bsn", id: "achBsnT", name: "BESOINS", list: achBsn, save: achBsnSave, edit: ACH_ED.bsn, inst: b => b.state !== "valide" && b.state !== "annule",
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
    d.innerHTML = sviWinCard({ st: b0 ? achPcSt("bsn", b0) : "instance", cls: "frs-card bsn-card", close: "data-x", title: achWinTtl(b0 && B.ref, "NOUVEAU BESOIN"),
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}</div>` : ""}<div class="frs-scroll">
        <div class="frs-sec"><div class="frs-st">AFFECTATION</div><div class="frs-g">${achCreeFld(b0)}
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
    /* 06/11 (soir) : circuit de validation propre aux BESOINS — montant = quantité × prix standard de l'article */
    if (valid && await achCircGate("bsn", b, achN(b.q) * achStdPu(b.des, b.u, b.pu), async lab => { save(L, b, lab); })) { d.remove(); if (done) done(); return; }
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
/* D1 (série D) : RETOURS ET AVOIRS sans interface à part — une liste peut accueillir les pièces négatives d'une autre (o.merge) :
   retours de commande dans COMMANDES, retours de réception dans RÉCEPTIONS, avoirs dans FACTURES. Chacun garde son nom, sa numérotation,
   sa page et son lien avec la pièce d'origine ; les données restent où elles sont (aucune reprise, aucun doublon possible). */
const achGoMap = { rtc: "cmf", rtrcmd: "cmf", rtr: "rcp", rtrrcp: "rcp", avf: "faf" };
function achListMod(ctx, o) {
  const dead = x => x.state === "annule";
  const M = o.merge || [], o0 = o;
  if (M.length) { const base = o.list, mOf = x => x.__m === undefined ? null : M[x.__m];
    o = { ...o, list: () => base().concat(...M.map((m, i) => m.o.list().map(x => Object.assign(x, { __m: i })))),
      save: o.save ? L => o0.save(L.filter(x => x.__m === undefined)) : o.save,
      inst: x => mOf(x) ? false : (o0.inst || (() => false))(x), why: (x, L) => mOf(x) ? [] : o0.why(x, (L || base()).filter(y => y.__m === undefined)),
      cols: () => o0.cols().map(c => [c[0], c[1], x => { const m = mOf(x); return m ? (m.col[c[0]] ? m.col[c[0]](x) : "") : c[2](x); }, ...c.slice(3)]) };
    o.mOf = mOf; }
  /* v817 : annulation d'une pièce toujours avec motif (C5.27, C6.72, C8.71), la pièce est gardée */
  const kill = o.save ? async x => { if (o.mOf && o.mOf(x)) { svToast("ANNULER DEPUIS LA PAGE DE " + x.ref + ".", 3000); return false; } const m = await achAsk("ANNULER " + x.ref + " (GARDÉ, VISIBLE DANS ANNULÉS)", "MOTIF DE L'ANNULATION"); if (!m) return false;
      const L = o.list(), y = L.find(z => z.id === x.id); if (!y) return false; y.state = "annule"; y.motifAnn = m; y.mod = achNow(); o.save(L); achHist(y.ref, "ANNULÉ — " + m, ""); return true; } : null;
  /* v779 : chaque pièce a sa PAGE au format de l'écran d'un budget (référence, i = la fiche, H, barre, blocs liés, SUIVI) */
  const ONE = { bsn: "BESOIN", caf: "CONSULTATION", dvf: "DEVIS", cmf: "COMMANDE", rcp: "RÉCEPTION", rtrcmd: "RETOUR DE COMMANDE", rtrrcp: "RETOUR DE RÉCEPTION", faf: "FACTURE", avf: "AVOIR", paf: "PAIEMENT" };
  return achNvMod(ctx, {
    list: { k: o.k, t: o.t, id: o.id, name: o.name, one: ONE[o.k] || o.name, all: o.list, why: (x, L) => o.why(x, L || o.list()), bang: "ref", w: o.w,
      etats: [["actif", "ACTIF"], ["alerte", "ALERTE"], ["annule", "ANNULÉS"], ["tout", "TOUT"]],
      ok: (x, k, L) => k === "tout" ? true : k === "annule" ? dead(x) : !dead(x) && (k !== "alerte" || o.why(x, L || o.list()).length > 0),
      inst: o.inst || (() => false), dI: x => x.cree || x.date || "", dV: x => x.valide || x.val || x.bap || x.solde || x.cree || x.date || "",
      /* 06/11 : une seule liste — état commun de chaque ligne (cases à cocher à gauche) et étape exacte (colonne ÉTAT, E3) */
      edit: o.edit, mOf: o.mOf, save: o.save, code: x => x.ref,
      stOf: x => { const m = o.mOf && o.mOf(x); if (m) return x.state === "annule" ? "annule" : "valide"; return achPcSt(o.k, x) || ((o.inst || (() => false))(x) ? "instance" : "valide"); },
      step: x => { const m = o.mOf && o.mOf(x); if (m) return m.col.etat ? m.col.etat(x) : ""; return achPcStep(o.k, x); },
      cols: () => o.cols(), newRow: o.newRow, kill,
      /* v800 (document unique 3.6) : CRÉER … ICI ouvre la fenêtre de la pièce ; une fois enregistrée, sa page s'ouvre */
      add: done => { const before = new Set(o.list().map(x => x.id)); let fin = false;
        const end = () => { if (fin) return; fin = true; clearInterval(tm); const n = o.list().find(x => !before.has(x.id)); done(n ? n.id : "x"); };
        /* dès que la nouvelle pièce est enregistrée, sa fenêtre se ferme et sa page s'ouvre */
        const tm = setInterval(() => { const n = o.list().find(x => !before.has(x.id)); if (n) { document.getElementById("svConf")?.remove(); end(); } else if (!document.getElementById("svConf")) end(); }, 250);
        o.open(null, end); } },
    pageOf: id => { const x = o.list().find(y => y.id === id); if (!x) return null; if (o.mOf && o.mOf(x)) return achListPage(o.mOf(x).o, id);
      const D = achDocPage(o.k, x);
      return { id, code: x.ref, ref: x.ref, title: D.title || x.ref, party: x.frs ? achFrsNom(x.frs) : "", partyGo: x.frs ? "frs|" + x.frs : "", date: achDFr(x.date || x.dFac || x.cree), tot: D.tot || [], ttc: D.ttc || 0, numFrs: x.refFrs || x.num || x.nbl || "", st: achPcSt(o.k, x) || ((o.inst || (() => false))(x) ? "instance" : "valide"), step: achPcStep(o.k, x), del: dead(x), why: o.why(x, o.list()),
        info: done => (o.info || o.open)(id, () => done()), click: D.click, change: D.change, lkBar: D.lkBar || "",   /* v1126 (L6 – L8) */
        menu: [{ k: "fiche", lab: "OUVRIR LA FICHE" }].concat(D.menu || []).concat(kill && !dead(x) ? [{ k: "del", lab: "ANNULER" }] : []),
        act: async (k, redraw) => { if (k === "fiche") { o.open(id, redraw); return; } if (D.act && await D.act(k, redraw)) return; if (k === "del") { const y = o.list().find(z => z.id === id); if (y && await kill(y)) redraw(); } },
        links: D.links.map(L => L.add && !dead(x) && (L.addAny || (o.inst || (() => false))(x)) ? { ...L, addFn: L.addFn || (redraw => o.open(id, redraw)) } : { ...L, add: "" }) }; }
  });
}
/* v779 : contenu de la page d'une pièce — LIGNES puis les pièces liées (un toucher ouvre leur page) */
/* D1 : page d'une pièce venue d'une autre liste (retour, avoir) — même page que dans son ancienne interface */
function achListPage(o, id) { const x = o.list().find(y => y.id === id); if (!x) return null; const D = achDocPage(o.k, x), inst = (o.inst || (() => false))(x);
  return { id, code: x.ref, ref: x.ref, title: (o.one || "") + (D.title ? " — " + D.title : ""), party: x.frs ? achFrsNom(x.frs) : "", partyGo: x.frs ? "frs|" + x.frs : "", date: achDFr(x.date || x.dFac || x.cree), tot: D.tot || [], ttc: D.ttc || 0, numFrs: x.refFrs || x.num || x.nbl || "", st: x.state === "annule" ? "annule" : inst ? "instance" : "valide", del: x.state === "annule", why: [],
    info: done => o.open(id, () => done()), menu: [{ k: "fiche", lab: "OUVRIR LA FICHE" }].concat(D.menu || []),
    act: async (k, redraw) => { if (k === "fiche") { o.open(id, redraw); return; } if (D.act) await D.act(k, redraw); }, links: D.links.map(L => ({ ...L, add: "" })) }; }
function achGo(t, id) { t = achGoMap[t] || t; const v = document.getElementById("ach"); if (!v || !v.__achTab) return;
  /* série I (I3) : la page quittée entre dans le chemin suivi (sauf retour par FERMER) */
  if (typeof ACH_PATH !== "undefined" && !(typeof achPathBack === "function" && achPathBack.on) && v.__achWhere) { const w = v.__achWhere(); if (w && !(w.t === t && (w.id || null) === (id || null))) { try { w.snap = achPosSnap(v); } catch (er) {} ACH_PATH.push(w); } } achGo.busy = true; try { v.__achTab(t, !!(id && v.__achOpen)); if (v.__achOpen) v.__achOpen(t, id); } finally { achGo.busy = false; } }
function achDocPage(k, x) {
  const fr = id => id ? achFrsNom(id) : "", ref = (L, id) => ((L.find(y => y.id === id) || {}).ref) || "";
  /* v800 (document unique 3.6 – 3.7) : toucher un article ou un fournisseur dans un tableau ouvre sa page */
  const AK = new Map(achArts().filter(a => !a.del).map(a => [achKey(a.des, a.u), a.id]));
  const tv = l => l.tva === "" || l.tva === undefined ? achPrm().tva : achN(l.tva), tv0 = tv;
  /* 05/11 : référence de chaque ligne = référence de la pièce + « -001 », « -002 »… */
  const lref = i => achLineRef(k, x.ref || x.code || "", i);   /* C6 : modèle des lignes (RÉFÉRENCES) */
  /* F1 (série F) : DÉTAIL + nom de la pièce ; colonne ARTICLE = numéro du détail, de 1 à n, refait sans trou après suppression ou déplacement */
  /* F2 (série F) : groupes dans les DÉTAILS (titres GROUPE n, numérotation comme les LOTS : 2, puis 2.1, 2.2) — GROUPER LES COCHÉS dans le ⋯ du bloc */
  const ST = { dvf: [achDvf, achDvfSave, y => y.state === "recu" || !y.state], cmf: [achCmf, achCmfSave, y => y.state === "instance"], faf: [achFaf, achFafSave, y => y.state === "instance" || y.state === "recu" || y.state === "reclame"] }[k];
  const lig = (t, withPu, withSt) => { const nC = 5 + (withPu ? 3 : 0) + (withSt ? 1 : 0), N = achDetNum(x.lignes || [], x.grp), ed = ST && ST[2](x);
    /* 07/11 (9.3) : glisser une ligne au doigt, comme dans le budget et la consultation */
    if (typeof ACH_DET_DRAG === "object") ACH_DET_DRAG[achNvhKey(t)] = { open: !!ed, rows: N.map(o => o.title ? { g: o.title.id } : { l: o.l.id || "#" + o.i }),
      apply: f => { const L = ST[0](), y = L.find(z => z.id === x.id); if (!y) return; if (f(y) === false) return; y.mod = achNow(); ST[1](L); achHist(y.ref, "DÉTAIL DÉPLACÉ", ""); } };
    return { t, add: "CRÉER UN DÉTAIL ICI…", cols: [["ARTICLE", "center"], ["RÉFÉRENCE"], ["DÉSIGNATION"], ["U", "center"], ["QUANTITÉ", "number"]].concat(withPu ? [["PU HT", "number"], ["TVA %", "number"], ["MONTANT HT", "number"]] : []).concat(withSt ? [["RÉSULTAT", "center"]] : []),
    rows: N.map(o => o.title ? { cls: "ins-title nvp-gt", cells: [o.no, "", o.lab].concat(Array(nC - 3).fill("")) } : (l => ({ li: o.i, go: AK.get(achKey(l.des, l.u)) ? [[2, "art", AK.get(achKey(l.des, l.u))]] : [], cells: [o.no, lref(o.i), l.des || "", l.u || "", achN(l.q)].concat(withPu ? [achN(l.pu), tv(l), achN(l.q) * achN(l.pu)] : []).concat(withSt ? [{ ok: "ACCEPTÉE", res: "RÉSERVES", ref: "REFUSÉE" }[l.st] || ""] : []) }))(o.l)),
    menu: ed ? [{ k: "up", lab: "MONTER LES COCHÉS" }, { k: "down", lab: "DESCENDRE LES COCHÉS" }, { k: "grp", lab: "GROUPER LES COCHÉS" }, { k: "ungrp", lab: "SORTIR LES COCHÉS DE LEUR GROUPE" }] : [],
    act: async (a, ck, redraw) => { const idx = ck.map(i => (N[i] || {}).i).filter(i => i !== undefined); if (!idx.length) { svToast("COCHER D'ABORD DES DÉTAILS.", 2500); return; }
      const L = ST[0](), y = L.find(z => z.id === x.id); if (!y) return;
      if (a === "up" || a === "down") y.lignes = achDetMove(y.lignes, idx.map(i => (y.lignes[i] || {}).id || i), a === "up" ? -1 : 1);
      else if (a === "grp") { y.grp = y.grp || []; const g = { id: "G" + Date.now().toString(36) }; y.grp.push(g); idx.forEach(i => { if (y.lignes[i]) y.lignes[i].g = g.id; }); }
      else idx.forEach(i => { if (y.lignes[i]) delete y.lignes[i].g; });
      y.mod = achNow(); ST[1](L); achHist(y.ref, a === "grp" ? "GROUPE CRÉÉ" : "SORTIS DU GROUPE", ""); redraw(); } }; };
  const docs = (t, L, cols, cells, kk) => ({ t, cols, rows: L.map(y => ({ cells: cells(y), open: () => achGo(kk, y.id), ap: kk + "|" + y.id, go: y.frs && cols[1] && cols[1][0] === "FOURNISSEUR" ? [[1, "frs", y.frs]] : [], cls: ["annule", "rejete"].includes(y.state) ? "nv-strike" : "" })) });
  const DV = (t, L) => docs(t, L, [["RÉFÉRENCE"], ["FOURNISSEUR"], ["MONTANT TTC", "number"], ["ÉTAT", "center"]], v => [v.ref, fr(v.frs), achDvfTot(v).ttc, { recu: "REÇU", retenu: "RETENU", rejete: "REJETÉ", annule: "ANNULÉ" }[v.state] || ""], "dvf");
  const CM = (t, L) => docs(t, L, [["RÉFÉRENCE"], ["FOURNISSEUR"], ["MONTANT TTC", "number"], ["ÉTAT", "center"]], c => [c.ref, fr(c.frs), achCmfTot(c).ttc, ACH_CMF_ST[c.state] || ""], "cmf");
  /* B52 : dans le devis, plus de colonne FOURNISSEUR dans COMMANDES (le nom est dans le titre) */
  const CM1 = (t, L) => docs(t, L, [["RÉFÉRENCE"], ["MONTANT TTC", "number"], ["ÉTAT", "center"]], c => [c.ref, achCmfTot(c).ttc, ACH_CMF_ST[c.state] || ""], "cmf");
  const RC = (t, L) => docs(t, L, [["RÉFÉRENCE"], ["N° BL"], ["REÇU LE"], ["DÉTAILS", "center"]], r => [r.ref, r.pv ? "PV DE SERVICE FAIT" : r.nbl || "", svDT(r.date || ""), String((r.lignes || []).length)], "rcp");
  const FA = (t, L) => docs(t, L, [["RÉFÉRENCE"], ["N° FACTURE"], ["MONTANT TTC", "number"], ["RESTE À PAYER", "number"], ["ÉTAT", "center"]], f => [f.ref, f.num || "", achFafTot(f).ttc, f.state === "annule" ? "" : achFafReste(f), achFafEtat(f)], "faf");
  const PA = (t, L) => docs(t, L, [["RÉFÉRENCE"], ["MODE"], ["DATE"], ["MONTANT", "number"], ["ÉTAT", "center"]], p => [p.ref, p.mode || "", achDFr(p.date), achN(p.mt), ACH_PAF_ST[p.state] || ""], "paf");
  const AV = (t, L) => docs(t, L, [["RÉFÉRENCE"], ["N° AVOIR"], ["MONTANT TTC", "number"], ["RESTE À DÉDUIRE", "number"]], a => [a.ref, a.num || "", -achN(a.ttc), a.state === "annule" ? "" : achAvfReste(a)], "avf");
  /* B37 : retours liés dans les deux sens — la pièce d'origine affiche en bas ses retours (montant négatif) */
  const RT = (t, L, kk) => docs(t, L, [["RÉFÉRENCE"], ["MOTIF"], ["DATE"], ["MONTANT HT", "number"]], r => [r.ref, r.motif || "", svDT(r.date || ""), achRtrMt(r)], kk);
  const CA = (t, L) => docs(t, L, [["RÉFÉRENCE"], ["OBJET"], ["ÉTAT", "center"]], c => [c.ref, c.objet || "", { ouverte: "OUVERTE", close: "CLOSE", annule: "ANNULÉE" }[c.state] || ""], "caf");
  const has = (L, id) => (L || []).includes(id);
  if (k === "caf") return achCafPage(x, { DV, CM });   /* F3 (série F) : page de la consultation sur le modèle du budget */
  const TOT = t => [["MONTANT HT", t.ht], ["MONTANT TVA", t.ttc - t.ht], ["MONTANT TTC", t.ttc]];
  if (k === "dvf") return { title: fr(x.frs), tot: TOT(achDvfTot(x)), ttc: achDvfTot(x).ttc,
    menu: x.state === "retenu" && !achCmf().some(c => (c.dvf === x.id || (c.lignes || []).some(l => l.dvf === x.id)) && c.state !== "annule") ? [{ k: "mkcmf", lab: "CRÉER LA COMMANDE" }] : [],   /* v1119 (L13) */
    act: async k => { if (k !== "mkcmf") return false; achDvfMkCmf(x.id); return true; }, links: [lig("DÉTAIL DEVIS", true), CA("CONSULTATION", achCaf().filter(c => c.id === x.caf)), CM1("COMMANDES", achCmf().filter(c => c.dvf === x.id || (c.lignes || []).some(l => l.dvf === x.id)))] };
  if (k === "cmf") return { title: fr(x.frs), tot: TOT(achCmfTot(x)), ttc: achCmfTot(x).ttc, links: [lig("DÉTAIL COMMANDE", true), DV("DEVIS", achDvf().filter(v => v.id === x.dvf || (x.lignes || []).some(l => l.dvf === v.id))), { ...RC("RÉCEPTIONS", achRcp().filter(r => r.cmf === x.id)), add: "CRÉER UNE RÉCEPTION ICI…", addAny: x.state === "valide" },
    { ...FA("FACTURES", achFaf().filter(f => f.cmf === x.id || has(f.cmfs, x.id))), add: "CRÉER UNE FACTURE ICI…", addAny: x.state === "valide" }, { ...PA("PAIEMENTS", achPaf().filter(p => p.cmf === x.id)), add: "CRÉER UN PAIEMENT (AVANCE) ICI…", addAny: x.state === "valide" }, RT("RETOURS DE COMMANDE", achRtr().filter(r => r.kind === "cmd" && r.cmf === x.id), "rtrcmd")] };
  if (k === "rcp") return { title: fr(x.frs), links: [lig("DÉTAIL RÉCEPTION", false, true), CM("COMMANDE", achCmf().filter(c => c.id === x.cmf)), FA("FACTURES", achFaf().filter(f => has(f.rcps, x.id))), RT("RETOURS DE RÉCEPTION", achRtr().filter(r => r.kind === "rcp" && r.rcp === x.id), "rtrrcp")] };
  if (k === "rtrcmd" || k === "rtrrcp") return { title: fr(x.frs), tot: [["MONTANT HT", achRtrMt(x)]], ttc: achRtrMt(x), links: [lig("DÉTAIL RETOUR"), CM("COMMANDE", achCmf().filter(c => c.id === x.cmf)), RC("RÉCEPTION", achRcp().filter(r => r.id === x.rcp))] };
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
  const st = { ouverte: "OUVERTE", close: "CLOSE", annule: "ANNULÉE" }, DV = () => achDvf().filter(v => v.state !== "annule" && v.state !== "rejete");
  return achListMod(ctx, { k: "caf", t: "ach_caf", id: "achCafT", list: achCaf, name: "CONSULTATIONS", save: achCafSave, edit: ACH_ED.caf, inst: c => c.state === "ouverte", etatKey: "svi_ach_caf_etat_v1", newLab: "NOUVELLE CONSULTATION", newRow: "CRÉER UNE CONSULTATION ICI…", open: (id, done) => achCafInfo(id || null, done),   /* v1119 (L2) : une seule fenêtre — création, en instance, close */ info: achCafInfo,   /* série I (I9) : le i = DATE DE CRÉATION et OBJET */
    etats: [["actif", "OUVERTES"], ["close", "CLOSES"], ["alerte", "ALERTE"], ["annule", "ANNULÉES"], ["tout", "TOUT"]],
    ok: (c, k, L) => k === "tout" ? true : k === "alerte" ? achCafWhy(c).length > 0 : k === "actif" ? c.state === "ouverte" : c.state === k,
    why: c => achCafWhy(c),
    w: { ref: 150, objet: 260, lig: 80, frs: 100, rep: 100, ndv: 80, mht: 130, dlim: 110, etat: 100, ret: 220, saisi: 110 },
    cols: () => [["ref", "RÉFÉRENCE", c => c.ref, ""], ["objet", "OBJET", c => c.objet || "", ""], ["lig", "DÉTAILS", c => String((c.lignes || []).length), "center"],
      ["frs", "FOURNISSEURS", c => (c.frs || []).map(achFrsNom).join(", "), ""], ["rep", "RÉPONSES", c => (c.frs || []).filter(f => ((c.rep || {})[f] || {}).st === "repondu").length + " / " + (c.frs || []).length, "center"],
      /* E7 (série E) : liste des consultations — devis reçus et moins-disant (HT) */
      ["ndv", "DEVIS", c => String(DV().filter(v => v.caf === c.id).length), "center"],
      ["mht", "MOINS-DISANT HT", c => { const H = DV().filter(v => v.caf === c.id).map(v => achDvfTot(v).ht).filter(v => v > 0); return H.length ? Math.min(...H) : ""; }, "number"],
      ["dlim", "DATE LIMITE", c => achDFr(c.dlim), ""], ["etat", "ÉTAT", c => st[c.state] || "", "center"], ["ret", "RETENU", c => c.retenu ? achFrsNom(c.retenu) : "", ""], ["saisi", "SAISI LE", c => achDFr(c.cree), ""]] });
}
function achDvfMod(ctx) {
  const st = { recu: "REÇU", retenu: "RETENU", rejete: "REJETÉ", annule: "ANNULÉ" };
  return achListMod(ctx, { k: "dvf", t: "ach_dvf", id: "achDvfT", list: achDvf, name: "DEVIS", save: achDvfSave, edit: ACH_ED.dvf, inst: v => v.state === "recu" || !v.state, etatKey: "svi_ach_dvf_etat_v1", newLab: "NOUVEAU DEVIS", newRow: "CRÉER UN DEVIS ICI… (HORS CONSULTATION)", open: achDvfFiche,
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
    d.innerHTML = sviWinCard({ cls: "frs-card caf-card", close: "data-x", title: achWinTtl(C.id && C.ref, "NOUVELLE CONSULTATION"),
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}</div>` : ""}<div class="frs-scroll">
        <div class="frs-sec"><div class="frs-g">${achCreeFld(c0)}<label class="frs-f frs-w"><span>OBJET</span><input class="ins-in caf-x" data-k="objet" value="${esc(C.objet)}"${dis} autocomplete="off"></label>
</div></div>
        <div class="cafw-top">
        <div class="frs-sec cafw-art"><div class="frs-st">ARTICLES CONSULTÉS ${svCnt(C.lignes.length)}</div>
          <table class="prm-table frs-sub"><thead><tr><th class="center">ARTICLE</th><th>BESOIN</th><th>CODE ARTICLE</th><th>DÉSIGNATION</th><th class="center">U</th><th class="number">QUANTITÉ</th><th class="number">PRIX ESTIMÉ</th><th class="number">MONTANT BUDGÉTÉ (NON ENVOYÉ)</th><th></th></tr></thead><tbody>
          ${C.lignes.map((l, i) => { const b = l.bsn ? achBsn().find(x => x.id === l.bsn) : null, a = achArtOf(l.des, l.u), std = achStdPu(l.des, l.u, l.pu);
            /* besoin (facultatif) : le menu montre aussi l'article, la désignation, l'unité et la quantité ; une désignation déjà prise par un besoin n'est plus proposée */
            const usedB = new Set(C.lignes.filter((y, j) => j !== i && y.bsn).map(y => y.bsn)), BO = achBsnOpen().filter(x => !usedB.has(x.id) || x.id === l.bsn).concat(b && !achBsnOpen().some(x => x.id === b.id) ? [b] : []);
            const takenD = new Set(C.lignes.filter((y, j) => j !== i && y.bsn).map(y => achKey(y.des, y.u)));
            const AO = achArts().filter(x => !x.del && !x.bloq && !x.arch).filter(x => !takenD.has(achKey(x.des, x.u)) || achKey(x.des, x.u) === achKey(l.des, l.u));
            const ao = x => { const z = achArtOf(x.des, x.u); return z ? achRefSvi(z, achArts(), "ARA") : ""; };
            return `<tr data-i="${i}" class="cafw-r"><td class="center">${i + 1}</td><td><select class="ins-in caf-bsn" data-i="${i}"${dis}><option value="">—</option>${BO.map(x => `<option value="${esc(x.id)}"${x.id === l.bsn ? " selected" : ""}>${esc(x.ref + " · " + (ao(x) || "HORS LISTE") + " · " + x.des + " · " + x.u + " · " + achF2(x.q))}</option>`).join("")}</select></td>
            <td>${a ? `<button type="button" class="ach-link cafw-go" data-goart="${esc(a.id)}">${esc(achRefSvi(a, achArts(), "ARA"))}</button>` : "HORS LISTE"}</td>
            <td>${l.libre ? `<input class="ins-in caf-l" data-c="des" value="${esc(l.des)}"${dis}>` : `<select class="ins-in caf-des" data-i="${i}"${dis}><option value="">—</option>${AO.map(x => `<option value="${esc(x.id)}"${achKey(x.des, x.u) === achKey(l.des, l.u) ? " selected" : ""}>${esc(x.des + " (" + x.u + ")")}</option>`).join("")}</select>`}</td>
            <td class="center">${l.libre ? `<input class="ins-in caf-l center" data-c="u" value="${esc(l.u)}"${dis}>` : esc(l.u || "")}</td>
            <td><input class="ins-in caf-l number" data-c="q" inputmode="decimal" value="${esc(String(l.q ?? "").replace(".", ","))}"${dis}></td>
            <td class="number">${a ? esc(achF2(std)) : `<input class="ins-in caf-l number" data-c="pu" inputmode="decimal" value="${esc(String(l.pu ?? "").replace(".", ","))}"${dis} placeholder="PRIX ESTIMÉ À SAISIR" data-tip="ARTICLE HORS LISTE : PRIX ESTIMÉ OBLIGATOIRE (IL N'EST PAS ÉCRIT DANS LA FICHE D'UN ARTICLE ; JAMAIS ENVOYÉ NI IMPRIMÉ)">`}</td>
            <td class="number">${b ? esc(achF2(achN(l.q) * achN(b.pu))) : "—"}</td><td class="center">${ro ? "" : `<button type="button" class="ach-x" data-rml="${i}">✕</button>`}</td></tr>`; }).join("")}
          </tbody></table>${ro ? "" : `<button type="button" class="ach-b" data-addl>+ ARTICLE</button> <button type="button" class="ach-b" data-addbsn>+ BESOINS VALIDÉS NON COUVERTS ${svCnt(achBsnOpen().length)}</button> <button type="button" class="ach-b" data-addlib>+ LIGNE HORS LISTE</button>`}</div>
        <div class="frs-sec cafw-frs"><div class="frs-st">FOURNISSEURS CONSULTÉS ${svCnt(C.frs.length)}</div>
          <table class="prm-table frs-sub"><thead><tr><th>FOURNISSEUR</th><th>E-MAIL</th><th>RÉPONSE</th><th>DEVIS</th><th></th></tr></thead><tbody>
          ${C.frs.map(f => { const r = C.rep[f] || {}, v = dv(f), F = achFrs().find(x => x.id === f) || {}; return `<tr data-f="${esc(f)}" class="cafw-r"><td><button type="button" class="ach-link cafw-go" data-gofrs="${esc(f)}">${esc(achFrsNom(f))}</button></td><td>${esc(((F.cte || []).find(x => x.email) || {}).email || "—")}</td>
            <td><select class="ins-in caf-rep" data-f="${esc(f)}"${dis || (v ? " disabled" : "")}>${[["attente", "EN ATTENTE"], ["repondu", "RÉPONDU"], ["decline", "DÉCLINÉ"]].map(([k, l]) => `<option value="${k}"${(r.st || "attente") === k ? " selected" : ""}>${l}</option>`).join("")}</select></td>
            <td>${v ? `<button type="button" class="ach-link" data-opendvf="${esc(v.id)}">${esc(v.ref)}</button> ${esc(achF2(achDvfTot(v).ht))} HT` : r.st === "decline" ? esc(r.motif ? "DÉCLINÉ : " + r.motif : "—") : ro ? "—" : `<button type="button" class="ach-b" data-mkdvf="${esc(f)}">SAISIR LE DEVIS</button>`}</td>
            <td class="center">${ro || v ? "" : `<button type="button" class="ach-x" data-rmf="${esc(f)}">✕</button>`}</td></tr>`; }).join("") || `<tr><td colspan="5" class="empty">AUCUN FOURNISSEUR</td></tr>`}
          </tbody></table>${ro ? "" : `<button type="button" class="ach-b" data-addfrs>+ FOURNISSEURS</button> <button type="button" class="ach-b" data-mail>ENVOYER (E-MAIL GROUPÉ)</button>`}</div>
        </div>
        <div class="bsn-note">F5 (série F) : DOCUMENTS ET CONDITIONS PARTICULIÈRES SONT SUR LA PAGE DE LA CONSULTATION.</div>
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

        ${!ro ? `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button>` : ""}${C.id && C.state === "ouverte" && D.length ? `<button type="button" class="svc-b svc-ok" data-close>CLÔTURER AVEC LE RETENU</button>` : ""}` });
    if (!d.isConnected) sviWinShow(d);
  };
  const pull = () => { d.querySelectorAll(".caf-x").forEach(i => { C[i.dataset.k] = i.dataset.k === "dlim" || i.dataset.k === "dSouh" ? i.value : i.dataset.k === "valJ" ? achN(i.value) || "" : achU(i.value); });
    d.querySelectorAll(".caf-c").forEach(i => { if (!i.disabled) C[i.dataset.k] = i.checked; });
    d.querySelectorAll("tr[data-i]").forEach(tr => { const l = C.lignes[+tr.dataset.i]; if (!l) return; tr.querySelectorAll(".caf-l").forEach(i => { l[i.dataset.c] = i.dataset.c === "q" || i.dataset.c === "pu" ? achN(i.value) : achU(i.value); }); });
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
  /* 06/11 (soir) : besoin (facultatif) choisi → la ligne prend son article, sa désignation, son unité et sa quantité ;
     désignation changée → le besoin de la ligne s'efface */
  d.addEventListener("change", e => {
    const sb = e.target.closest(".caf-bsn"); if (sb) { pull(); const l = C.lignes[+sb.dataset.i]; if (!l) return; const b = achBsn().find(x => x.id === sb.value);
      if (b) Object.assign(l, { bsn: b.id, des: b.des, u: b.u, q: achN(b.q), libre: false }); else delete l.bsn; draw(); return; }
    const sd = e.target.closest(".caf-des"); if (sd) { pull(); const l = C.lignes[+sd.dataset.i]; if (!l) return; const a = achArts().find(x => x.id === sd.value);
      if (a) { if (achKey(a.des, a.u) !== achKey(l.des, l.u)) delete l.bsn; l.des = a.des; l.u = a.u; } draw(); } });
  /* 06/11 (soir) : dans les blocs ARTICLES et FOURNISSEURS, un toucher choisit la ligne ; un second toucher sur un nom souligné l'ouvre */
  d.addEventListener("click", e => { const r = e.target.closest("tr.cafw-r"); if (!r || e.target.closest("input, select, .sv-sel, .ach-x, .ach-b, [data-mkdvf], [data-opendvf]")) return;
    const go = e.target.closest(".cafw-go");
    if (!r.classList.contains("sel")) { d.querySelectorAll("tr.cafw-r.sel").forEach(x => x.classList.remove("sel")); r.classList.add("sel"); e.stopImmediatePropagation(); return; }
    if (!go) return; e.stopImmediatePropagation();
    if (go.dataset.goart) achArtFiche(go.dataset.goart, () => draw()); else if (go.dataset.gofrs) achFrsFiche(go.dataset.gofrs, "", () => draw()); }, true);
  /* 09/11 : QUANTITÉ, PRIX, DÉSIGNATION et UNITÉ du détail : chaque modification s'annule (ANNULER / RÉTABLIR) */
  { const v0 = new WeakMap();
    d.addEventListener("focusin", e => { const i = e.target.closest && e.target.closest("input.caf-l"); if (i) v0.set(i, i.value); }, true);
    d.addEventListener("change", e => { const i = e.target.closest && e.target.closest("input.caf-l"); if (!i || !v0.has(i)) return; const a = v0.get(i), z = i.value; if (a === z) return; v0.set(i, z);
      const tr = i.closest("tr[data-i]"); if (!tr || typeof sviUndoPush !== "function") return; const ix = tr.dataset.i, c = i.dataset.c;
      sviUndoPush(dir => { if (!d.isConnected) return; const f = d.querySelector(`tr[data-i="${ix}"] input.caf-l[data-c="${c}"]`); if (!f) return; f.value = dir === "undo" ? a : z; v0.set(f, f.value); pull(); draw(); },
        c === "q" ? "MODIFICATION DE LA QUANTITÉ" : "MODIFICATION DU DÉTAIL"); }, true); }
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
    if (e.target.closest("[data-addfil]")) { pull(); const f = V.frs; if (!f || !V.caf) return;   /* série H : le fournisseur rejoint la consultation, lié aux détails qu'il chiffre (sinon à tous) */
      achCafSaveOne(V.caf, c => { if (c.frs.includes(f)) return; c.frs.push(f); c.rep[f] = { st: "attente" }; const K = new Set(V.lignes.map(y => achKey(y.des, y.u))), mine = c.lignes.filter(l => K.has(achKey(l.des, l.u)));
        (mine.length ? mine : c.lignes).forEach(l => { c.lf[l.id] = (c.lf[l.id] || []).concat([f]); }); achCafUp(c); }, "FOURNISSEUR AJOUTÉ DEPUIS LE DEVIS — " + achFrsNom(f)); draw(); return; }
    if (e.target.closest("[data-addl]")) { pull(); C.lignes.push({ des: "", u: "", q: "" }); draw(); return; }
    if (e.target.closest("[data-addlib]")) { pull(); C.lignes.push({ des: "", u: "", q: "", pu: "", libre: true }); draw(); return; }
    const rl = e.target.closest("[data-rml]"); if (rl) { pull(); C.lignes.splice(+rl.dataset.rml, 1); draw(); return; }
    const rf = e.target.closest("[data-rmf]"); if (rf) { pull(); C.frs = C.frs.filter(x => x !== rf.dataset.rmf); delete C.rep[rf.dataset.rmf]; draw(); return; }
    if (e.target.closest("[data-addbsn]")) {
      pull(); const have = new Set(C.lignes.map(l => l.bsn).filter(Boolean)), B = achBsnOpen().filter(b => !have.has(b.id));
      if (!B.length) { svToast("AUCUN BESOIN VALIDÉ NON COUVERT.", 3000); return; }
      const pick = await achPickWin("BESOINS VALIDÉS NON COUVERTS", B.map(b => ({ v: b.id, lab: b.ref + " — " + b.des + " (" + achF2(b.q) + " " + b.u + ")" + (b.datePrevue ? " — PRÉVU LE " + achDFr(b.datePrevue) : "") })));
      B.filter(b => pick.includes(b.id)).forEach(b => C.lignes.push({ bsn: b.id, des: b.des, u: b.u, q: achN(b.q) })); draw(); return;
    }
    if (e.target.closest("[data-addfrs]")) {
      /* F12 (série F) : d'abord ceux qui ont déjà VENDU des articles de la consultation (commandes), sauf les BLOQUÉS ; les autres restent proposés dessous */
      pull(); const K = new Set(C.lignes.map(l => achKey(l.des, l.u))), sold = new Map();
      achCmf().filter(c => c.frs && c.state !== "annule" && c.state !== "instance").forEach(c => (c.lignes || []).forEach(l => { const k = achKey(l.des, l.u); if (K.has(k)) { if (!sold.has(c.frs)) sold.set(c.frs, new Set()); sold.get(c.frs).add(k); } }));
      const F = achLive(achFrs()).filter(f => achFrsOk(f) && !f.bloq && !C.frs.includes(f.id)).map(f => ({ f, n: (sold.get(f.id) || new Set()).size })).sort((a, b) => b.n - a.n || a.f.nom.localeCompare(b.f.nom, "fr"));
      if (!F.length) { svToast("AUCUN AUTRE FOURNISSEUR ACTIF (ACHAT › FOURNISSEURS).", 3000); return; }
      const pick = await achPickWin("FOURNISSEURS À CONSULTER", F.map(x => ({ v: x.f.id, lab: x.f.code + " — " + x.f.nom + (x.n ? "  ★ A DÉJÀ VENDU " + x.n + " DE CES ARTICLES" : "") })));
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
    if (mk) { pull(); if (!C.lignes.length) { svToast("AJOUTER D'ABORD LES DÉTAILS.", 3000); return; }
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
      /* 06/11 (soir) : circuit de validation propre aux CONSULTATIONS (montant au prix standard) ; DEVIS : seulement s'il a son propre réglage */
      if (await achCafGate(C, async lab => { store(lab); draw(); })) return;
      if (achSeuOwn("dvf")) { const DL0 = achDvf(), v0 = DL0.find(x => x.id === v.id); if (v0 && await achCircGate("dvf", v0, achStdMt(v0.lignes), async lab => { v0.mod = now(); achDvfSave(DL0); achHist(v0.ref, lab, ""); draw(); })) return; }
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
    d.innerHTML = sviWinCard({ st: v0 ? achPcSt("dvf", v0) : "instance", cls: "frs-card dvf-card", close: "data-x", title: achWinTtl(v0 && V.ref, "NOUVEAU DEVIS"),   /* série I (I8) : bandeau = la référence seule */
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}</div>` : ""}<div class="frs-scroll">
        <div class="frs-sec"><div class="frs-g">${achCreeFld(v0)}
          <label class="frs-f frs-w"><span>FOURNISSEUR <b>*</b></span><select class="ins-in dvf-x" data-k="frs"${dis || (V.caf ? " disabled" : "")}><option value=""></option>${FR.map(f => `<option value="${esc(f.id)}"${f.id === V.frs ? " selected" : ""}>${esc(f.code + " — " + f.nom)}</option>`).join("")}</select></label>
          <label class="frs-f"><span>N° DU DEVIS FOURNISSEUR</span><input class="ins-in dvf-x" data-k="refFrs" value="${esc(V.refFrs)}"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>CONSULTATION</span>${ro ? `<input class="ins-in" value="${esc(((achCaf().find(c => c.id === V.caf) || {}).ref) || "HORS CONSULTATION")}" readonly>` : `<select class="ins-in dvf-x" data-k="caf"><option value="">HORS CONSULTATION</option>${achCaf().filter(c => c.state === "ouverte" || c.id === V.caf).map(c => `<option value="${esc(c.id)}"${c.id === V.caf ? " selected" : ""}>${esc(c.ref + (c.objet ? " — " + c.objet : ""))}</option>`).join("")}</select>`}</label>
          ${(() => { /* série H (H1) : la fille est déduite du FOURNISSEUR du devis — affichée seule, non modifiable ; absente = proposer d'ajouter le fournisseur */
            let c = V.caf ? achCaf().find(y => y.id === V.caf) : null; if (!c) return ""; if (typeof achCafUp === "function" && achCafUp(c)) c = achCafSaveOne(c.id, () => {}) || c;
            const r = V.frs && typeof achFilRefOf === "function" ? achFilRefOf(c, V.frs) : "";
            return `<label class="frs-f"><span>CONSULTATION PAR FOURNISSEUR</span>${r || !V.frs ? `<input class="ins-in dvf-fil" value="${esc(r || "(CHOISIR LE FOURNISSEUR)")}" readonly>`
              : `<span class="dvf-nofil">CE FOURNISSEUR N'EST PAS DANS LA CONSULTATION.${ro ? "" : ` <button type="button" class="ach-b" data-addfil>L'AJOUTER À LA CONSULTATION</button>`}</span>`}</label>`; })()}
          <label class="frs-f"><span>DATE</span><input type="date" class="ins-in dvf-x" data-k="date" value="${esc(V.date)}"${dis}></label>
          <label class="frs-f"><span>VALIDE JUSQU'AU</span><input type="date" class="ins-in dvf-x" data-k="validite" value="${esc(V.validite)}"${dis}></label>
          <label class="frs-f"><span>REMISE GLOBALE (%)</span><input class="ins-in dvf-x number" data-k="remG" inputmode="decimal" value="${esc(V.remG ? String(V.remG).replace(".", ",") : "")}"${dis}></label>
          <label class="frs-f"><span>TRANSPORT HT (VIDE = FRANCO)</span><input class="ins-in dvf-x number" data-k="transp" inputmode="decimal" value="${esc(V.transp ? achF2(V.transp) : "")}"${dis}></label>
          <label class="frs-f"><span>TOTAL HT ÉCRIT PAR LE FOURNISSEUR</span><input class="ins-in dvf-x number" data-k="totFrs" inputmode="decimal" value="${esc(V.totFrs ? achF2(V.totFrs) : "")}"${dis}></label>
          <label class="frs-f"><span>PAIEMENT PROPOSÉ</span><input class="ins-in dvf-x" data-k="condPay" value="${esc(V.condPay || "")}"${dis} autocomplete="off"></label>
          <label class="frs-f frs-w"><span>CONTACT (DEVIS VERBAL OU TÉLÉPHONE)</span><input class="ins-in dvf-x" data-k="contact" value="${esc(V.contact || "")}"${dis} autocomplete="off"></label>
          <label class="frs-f frs-w"><span>MÉMO INTERNE DE L'ACHETEUR (NON IMPRIMÉ)</span><input class="ins-in dvf-x" data-k="memo" value="${esc(V.memo || "")}"${dis} autocomplete="off"></label>
          ${(() => { const c = V.caf ? achCaf().find(x => x.id === V.caf) : null; return c && c.dlim && V.date > c.dlim ? `<label class="frs-f frs-w"><span>REÇU APRÈS LA DATE LIMITE : ACCEPTÉ, MOTIF</span><input class="ins-in dvf-x" data-k="tardOk" value="${esc(V.tardOk || "")}"${dis} autocomplete="off"></label>` : ""; })()}</div></div>
        <div class="frs-sec"><div class="frs-st">DÉTAIL DEVIS ${svCnt(V.lignes.length)}</div>
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
    if (e.target.closest("[data-addfil]")) { pull(); const f = V.frs; if (!f || !V.caf) return;   /* série H : le fournisseur rejoint la consultation, lié aux détails qu'il chiffre (sinon à tous) */
      achCafSaveOne(V.caf, c => { if (c.frs.includes(f)) return; c.frs.push(f); c.rep[f] = { st: "attente" }; const K = new Set(V.lignes.map(y => achKey(y.des, y.u))), mine = c.lignes.filter(l => K.has(achKey(l.des, l.u)));
        (mine.length ? mine : c.lignes).forEach(l => { c.lf[l.id] = (c.lf[l.id] || []).concat([f]); }); achCafUp(c); }, "FOURNISSEUR AJOUTÉ DEPUIS LE DEVIS — " + achFrsNom(f)); draw(); return; }
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
    d.innerHTML = sviWinCard({ cls: "cmpm-pick", close: "data-x", title: esc(title), body: `<div class="cmpm-list">${items.map(x => `<label class="cmpm-it"><input type="checkbox" value="${esc(x.v)}"${x.on ? " checked" : ""}> ${esc(x.lab)}</label>`).join("")}</div>`,
      foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>AJOUTER</button>` });
    sviWinShow(d);
    d.addEventListener("click", e => {
      if (e.target === d || e.target.closest("[data-x]")) { d.remove(); ok([]); return; }
      if (e.target.closest("[data-ok]")) { const v = [...d.querySelectorAll("input:checked")].map(i => i.value); d.remove(); ok(v); }
    });
  });
}
/* ⟪ src/44b-achats-consultation-page.js ⟫ */
/* v1119 (L13, série L) : CRÉER LA COMMANDE depuis la page d'un devis RETENU (plus depuis la consultation).
   Devis issu d'une consultation : lignes = détails liés au retenu, au prix gardé (F8), conditions particulières envoyées → clauses (F5, règle 12.3). */
function achDvfMkCmf(dvfId) { const v = achDvf().find(y => y.id === dvfId); if (!v) return null;
  if (achCmf().some(c => (c.dvf === v.id || (c.lignes || []).some(l => l.dvf === v.id)) && c.state !== "annule")) { svToast("CE DEVIS A DÉJÀ SA COMMANDE.", 3000); return null; }
  const x = v.caf ? achCaf().find(y => y.id === v.caf) : null;
  if (!x) { const m = achCmfFrom({ frs: v.frs, dvf: v.id, lignes: v.lignes || [], why: "DEPUIS " + v.ref }); achGo("cmf", m.id); return m; }
  const C0 = x, LL = (C0.lignes || []).filter(l => ((C0.lf || {})[l.id] || []).includes(v.frs)).map(l => { const p = achCafPrice(C0, v.frs, l); return p.st === "ok" ? { ...p.p.y, q: achN(l.q), bsn: l.bsn || p.p.y.bsn || "", dvf: p.p.v.id } : null; }).filter(Boolean);
  const m = achCmfFrom({ frs: v.frs, caf: x.id, dvf: v.id, lignes: LL.length ? LL : v.lignes, why: "DEPUIS " + x.ref + " — " + v.ref });
  try { const L = achCmf(), cm = L.find(y => y.id === m.id); if (cm) { cm.cla = (Array.isArray(cm.cla) ? cm.cla : achClCopy(achPrm().clP)).concat(achCafCondOf(x, v.frs).filter(cd => String(cd.v ?? "").trim()).map(cd => ({ id: "c" + cd.id, t: "autre", txt: cd.lab + " : " + cd.v }))); achCmfSave(L); } } catch (e) {}
  achGo("cmf", m.id); return m; }
/* =========================================================
   F3 – F12 (série F, 06/11/2026) : PAGE DE LA CONSULTATION sur le modèle du budget — une seule page, quatre blocs liés par les
   ronds à gauche (règle 2.5) : DÉTAIL CONSULTATION, FOURNISSEURS, DOCUMENTS, CONDITIONS PARTICULIÈRES ; puis le comparatif et les pièces liées.
   Liaisons gardées sur la consultation : lf (détail → fournisseurs), ld (détail → documents), lc (détail → conditions),
   fd (fournisseur → documents), fc (fournisseur → conditions). Choisir un détail éclaire ses fournisseurs, documents et conditions ; choisir un
   fournisseur éclaire ses détails (et ses documents, conditions). Toucher le rond d'une autre ligne pendant un choix = lier / délier.
   Un fournisseur ajouté est lié aux détails qu'il a déjà vendus (sinon à tous) : chaque fournisseur a son propre bordereau.
   ========================================================= */
/* v1130 (L6 – L8, 2e livraison ; document unique partie 3, exception à 6.4, validé le 11/11) : CASES COCHÉES = FILTRE DES AUTRES BLOCS —
   articles, fournisseurs, documents, conditions : ne restent que les lignes liées aux cochées (un document ou une condition liés au fournisseur
   coché par un article comptent) ; à l'écran, sans redessin ; compteur « retenues/total » et TOTAL PARTIEL des ARTICLES CONSULTÉS */
let ACH_CAF_FLT = null;
/* v1133 : cases cochées de la page gardées au redessin (rond, rond d'en-tête, ✓ LIER…) puis filtre réappliqué ; oubliées à l'ouverture (achNvMod.open) */
let ACH_CAF_CK = null;
const achCafCkSave = () => { const F = ACH_CAF_FLT, pg = document.querySelector("#ach .nvp"); if (!F || !pg) return;
  ACH_CAF_CK = { id: F.id, S: new Set([...pg.querySelectorAll(".nvp-blk tbody tr[data-ri]")].filter(tr => tr.querySelector(".nvp-cb:checked")).map(tr => (tr.querySelector(".nvp-rd[data-rd]") || {}).dataset?.rd).filter(Boolean)) }; };
const achCafCkOf = (x, k) => !!(ACH_CAF_CK && ACH_CAF_CK.id === x.id && ACH_CAF_CK.S.has(k));
function achCafFilter() { const F = ACH_CAF_FLT, pg = document.querySelector("#ach .nvp"); if (!F || !pg) return;
  const h1 = pg.querySelector(".nvp-ref"); if (!h1 || h1.textContent.trim() !== String(F.ref)) return;
  const rows = [...pg.querySelectorAll(".nvp-blk tbody tr[data-ri]")].map(tr => { const b = tr.querySelector(".nvp-rd[data-rd]"); if (!b) return null; const [g, id] = b.dataset.rd.split("|");
    return { tr, g, id, ck: !!tr.querySelector(".nvp-cb:checked") }; }).filter(Boolean);
  const hidAll = sviLkDomFilter(F.LK, rows, "tr.nvp-gt");
  pg.querySelectorAll(".nvp-blk").forEach(bl => { if (!bl.querySelector(".nvp-rd[data-rd]")) return; const R = [...bl.querySelectorAll("tbody tr[data-ri]")].filter(tr => tr.querySelector(".nvp-rd[data-rd]")), nv = R.filter(tr => !tr.classList.contains("svlk-hid")).length;
    /* v1131 : compteur = articles seulement (titres de groupe non comptés, comme à l'affichage) ; rien de caché = compteur d'origine */
    const cn = bl.querySelector(".blk-head .ttl .svi-cnt"); if (cn) { if (!bl.dataset.cnt0) bl.dataset.cnt0 = cn.outerHTML; const tot = +(bl.dataset.cnt0.match(/>([\d/]+)</) || [, ""])[1].split("/").pop() || R.length;
      cn.outerHTML = nv === R.length ? bl.dataset.cnt0 : svCnt(nv, tot); }
    const ft = bl.querySelector("tfoot .bdg-d-total-row"); if (!ft) return; const C = [...ft.cells], i = C.findIndex(c => /^TOTAL/.test(c.textContent.trim())); if (i < 0) return;
    if (!C[i].dataset.lab0) C[i].dataset.lab0 = C[i].textContent.trim();
    const num = t => { const v = String(t || "").replace(/[\s\u00a0\u202f]/g, "").replace(",", "."); return /^-?\d+(\.\d+)?$/.test(v) ? +v : 0; };
    const sum = R.filter(tr => !tr.classList.contains("svlk-hid")).reduce((a, tr) => a + num((tr.cells[i + 1] || {}).textContent), 0);
    C[i].textContent = nv < R.length || C[i].dataset.lab0 === "TOTAL PARTIEL" ? "TOTAL PARTIEL" : "TOTAL"; if (C[i + 1]) C[i + 1].textContent = achF2(sum); });
  if (typeof achNvpAllSt === "function") pg.querySelectorAll(".nvp-blk table").forEach(achNvpAllSt); }   /* v1133 : état des cases d'en-tête recalculé après le filtre */
document.addEventListener("change", e => { if (e.target.closest && e.target.closest("#ach .nvp .nvp-blk") && e.target.matches(".nvp-cb, .nvp-all")) setTimeout(() => { achCafFilter(); achCafCkSave(); }, 0); });
/* v1126 (L6 – L8) : liaisons par le moteur commun (09g, sviLk) — choix de plusieurs lignes, puis ✓ LIER / ✕ DÉLIER en haut à droite */
const ACH_CAF_LKG = { a: ["ARTICLE", "ARTICLES"], f: ["FOURNISSEUR", "FOURNISSEURS"], d: ["DOCUMENT", "DOCUMENTS"], c: ["CONDITION", "CONDITIONS"] };
const achCafLk = (key, data, alive, G) => sviLk(key, { groups: G || ACH_CAF_LKG, data, alive, hub: G ? "L" : "a",
  pairs: G ? { "L-F": "lf", "L-D": "ld", "L-K": "lc", "F-D": "fd", "F-K": "fc" } : { "a-f": "lf", "a-d": "ld", "a-c": "lc", "f-d": "fd", "f-c": "fc" } });
/* conditions particulières par défaut (F5) — le catalogue est ACHATS › CLAUSES ; une condition ajoutée ici y est ajoutée aussi */
const ACH_CAF_COND = [["dlim", "DATE LIMITE DE RÉPONSE", "date"], ["lieu", "LIEU DE LIVRAISON", "text"], ["dSouh", "LIVRAISON SOUHAITÉE LE", "date"],
  ["pay", "CONDITIONS DE PAIEMENT", "text"], ["avance", "AVANCE (%)", "num"], ["equiv", "ARTICLE ÉQUIVALENT AUTORISÉ", "on"], ["franco", "FRANCO CHANTIER", "on"]];
const achCafId = () => "K" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
/* mise à niveau d'une consultation : identifiants des détails, conditions en tableau (reprises des anciens champs), liaisons */
function achCafUp(c) { let ch = false;
  (c.lignes || []).forEach(l => { if (!l.id) { l.id = achCafId(); ch = true; } });
  if (!Array.isArray(c.cond)) { ch = true; c.cond = ACH_CAF_COND.map(([k, lab, t]) => ({ id: k, k, lab, t, v: k === "dlim" ? c.dlim || "" : k === "lieu" ? c.lieu || "" : k === "dSouh" ? c.dSouh || "" : k === "equiv" ? (c.variante ? "OUI" : "NON") : k === "franco" ? (c.franco ? "OUI" : "NON") : "" })); }
  /* v1119 (L15) : les CONDITIONS DE PAIEMENT sont une condition particulière (plus une colonne des fournisseurs ; l'avance reste une condition à part) */
  if (!c.cond.some(x => x.k === "pay")) { const P = Object.values(c.rep || {}).map(r => r && r.pay).filter(Boolean); const i = c.cond.findIndex(x => x.k === "avance");
    c.cond.splice(i < 0 ? c.cond.length : i, 0, { id: "pay", k: "pay", lab: "CONDITIONS DE PAIEMENT", t: "text", v: P[0] || "" }); ch = true; }
  c.cond.forEach(x => { if (x.k === "avance" && x.lab === "CONDITIONS DE PAIEMENT — AVANCE (%)") { x.lab = "AVANCE (%)"; ch = true; } });
  ["lf", "ld", "lc", "fd", "fc"].forEach(k => { if (!c[k] || typeof c[k] !== "object") { c[k] = {}; ch = true; } });
  (c.lignes || []).forEach(l => { if (!Array.isArray(c.lf[l.id])) { c.lf[l.id] = (c.frs || []).slice(); ch = true; } });
  /* série H (H1) : une CONSULTATION PAR FOURNISSEUR (fille) pour chaque fournisseur consulté — numéro jamais réutilisé */
  if (!c.fil || typeof c.fil !== "object") { c.fil = {}; ch = true; }
  (c.frs || []).forEach(f => { if (!c.fil[f]) { c.filN = (+c.filN || 0) + 1; c.fil[f] = { n: c.filN, cree: achNow() }; ch = true; } });
  return ch; }
/* série H : articles de la fille (détails liés au fournisseur), empreinte (pour À RENVOYER), référence et état */
const achFilLig = (c, f) => (c.lignes || []).filter(l => ((c.lf || {})[l.id] || []).includes(f));
const achFilSig = (c, f) => achFilLig(c, f).map(l => [l.id, achU(l.des), achU(l.u), achN(l.q)].join("~")).join("|");
const achFilRefOf = (c, f) => { const o = (c.fil || {})[f]; return o ? achFilRef(c, o.n) : ""; };
const ACH_FIL_ST = { instance: "EN INSTANCE", remis: "ENVOYÉE", renvoyer: "À RENVOYER", valide: "RÉPONDU", annule: "DÉCLINÉ" };
const achFilSt = (c, f, D) => { const o = (c.fil || {})[f] || {}, r = (c.rep || {})[f] || {};
  if (r.st === "decline") return "annule"; if (o.env && o.sig !== undefined && o.sig !== achFilSig(c, f)) return "renvoyer";
  if ((D || achDvf()).some(v => v.caf === c.id && v.frs === f && v.state !== "annule")) return "valide"; return o.env || r.env ? "remis" : "instance"; };
const achCafSaveOne = (id, mut, act) => { const L = achCaf(), c = L.find(x => x.id === id); if (!c) return null; achCafUp(c); mut(c); c.mod = achNow(); achCafSave(L); if (act) achHist(c.ref, act, c.objet || ""); return c; };
/* détails qu'un fournisseur a déjà vendus (commandes validées) */
const achFrsSold = f => { const S = new Set(); achCmf().filter(c => c.frs === f && c.state !== "annule" && c.state !== "instance").forEach(c => (c.lignes || []).forEach(l => S.add(achKey(l.des, l.u)))); return S; };
/* F8 : prix d'un détail chez un fournisseur — tous ses devis de la consultation qui chiffrent ce détail */
const achCafPrices = (c, f, l, D) => (D || achDvf()).filter(v => v.caf === c.id && v.frs === f && v.state !== "annule").flatMap(v => (v.lignes || []).filter(y => (l.bsn && y.bsn ? y.bsn === l.bsn : achKey(y.des, y.u) === achKey(l.des, l.u)) && achN(y.pu) > 0).map(y => ({ v, y })));
const achCafPrice = (c, f, l, D) => { const P = achCafPrices(c, f, l, D); if (!P.length) return { st: "nc" }; if (P.length === 1) return { st: "ok", p: P[0] };
  const k = ((c.pick || {})[l.id] || {})[f], q = P.find(x => x.v.id === k); return q ? { st: "ok", p: q } : { st: "choix", n: P.length, P }; };
/* groupes du détail (F2) : numérotation comme les LOTS — 2 pour le groupe, 2.1, 2.2 pour ses articles ; sans groupe, 1 à n */
function achDetNum(L, G) { G = G || []; const out = [], seen = new Set(); let n = 0;
  if (!G.length || !L.some(l => l.g)) { L.forEach((l, i) => out.push({ l, i, no: String(i + 1) })); return out; }
  L.forEach((l, i) => { if (!l.g || !G.some(g => g.id === l.g)) { out.push({ l, i, no: String(++n) }); return; }
    if (seen.has(l.g)) return; seen.add(l.g); const gn = ++n, g = G.find(x => x.id === l.g); out.push({ title: g, no: String(gn), lab: g.lab || "GROUPE " + (G.indexOf(g) + 1) });
    let m = 0; L.forEach((y, j) => { if (y.g === l.g) out.push({ l: y, i: j, no: gn + "." + (++m) }); }); });
  return out; }
function achCafPage(x, B) {
  const BP = achCafBdgPx();   /* v1134 (L24) : prix des budgets actifs, lus une fois par dessin */
  if (achCafUp(x)) { const L = achCaf(), i = L.findIndex(y => y.id === x.id); if (i >= 0) { L[i] = x; achCafSave(L); } }   /* mêmes identifiants que ceux affichés */
  /* F8 : un devis lié depuis sa fiche (champ CONSULTATION) amène son fournisseur, lié aux détails qu'il chiffre */
  { const miss = achDvf().filter(v => v.caf === x.id && v.state !== "annule" && v.frs && !(x.frs || []).includes(v.frs));
    if (miss.length) { const c = achCafSaveOne(x.id, c => miss.forEach(v => { if (c.frs.includes(v.frs)) return; c.frs.push(v.frs); c.rep[v.frs] = { st: "repondu", dvf: v.id };
      const K = new Set((v.lignes || []).map(y => achKey(y.des, y.u))); c.lignes.filter(l => K.has(achKey(l.des, l.u))).forEach(l => { c.lf[l.id] = (c.lf[l.id] || []).concat([v.frs]); }); }), "DEVIS LIÉ DEPUIS SA FICHE");
      if (c) Object.assign(x, c); } }
  const open = x.state === "ouverte", D = achDvf(), DD = D.filter(v => v.caf === x.id && v.state !== "annule"), fr = id => id ? achFrsNom(id) : "";
  const lk = (o, a, b) => ((x[o] || {})[a] || []).includes(b);
  /* v1126 (L6 – L8) : état du rond et couleur de la ligne par le moteur commun — choisi (rond plein), lié à ce qui est choisi (bleu foncé), lié (bleu clair) */
  const DOCS0 = (achJ("svi_docs_v1:ACH-" + (x.ref || x.code), []) || []).map((d0, i) => d0.ref || "d" + i).filter(id => !(x.dhide || []).includes(id));
  const ALV = { a: new Set((x.lignes || []).map(l => l.id)), f: new Set(x.frs || []), d: new Set(DOCS0), c: new Set((x.cond || []).map(c => c.id)) };
  const LK = achCafLk("caf:" + x.id, () => achCaf().find(y => y.id === x.id) || x, (g, id) => ALV[g] && ALV[g].has(id));
  const rdSt = k => { const [t, id] = k.split("|"); return LK.state(t, id); };
  const lkC = k => LK.rowCls(rdSt(k));
  ACH_CAF_FLT = { id: x.id, ref: x.ref || x.code, LK };   /* v1130 : filtre des blocs liés par les cases cochées (achCafFilter) */
  const ckC = k => achCafCkOf(x, k); requestAnimationFrame(() => achCafFilter());   /* v1133 : cases gardées et filtre réappliqué après chaque dessin */
  const dis = open ? "" : " disabled";
  /* ---- DÉTAIL CONSULTATION ---- */
  const usedB = new Set((x.lignes || []).filter(l => l.bsn).map(l => l.bsn)), takenD = new Set((x.lignes || []).filter(l => l.bsn).map(l => achKey(l.des, l.u)));
  const det = achDetNum(x.lignes || [], x.grp).map(o => { if (o.title) return { cls: "ins-title nvp-gt svlk-gt-" + o.title.id, gid: o.title.id, cells: [o.no, { h: "<b>" + esc(o.lab) + "</b>", t: o.lab }, "", "", "", "", "", "", "", ""] };
    const l = o.l, i = o.i, a = achArtOf(l.des, l.u), b = l.bsn ? achBsn().find(y => y.id === l.bsn) : null, es = achCafEst(l, BP), k = "a|" + l.id;
    const BO = achBsnOpen().filter(y => !usedB.has(y.id) || y.id === l.bsn).concat(b && !achBsnOpen().some(y => y.id === b.id) ? [b] : []);
    const AO = achArts().filter(y => !y.del && !y.bloq && !y.arch && (!takenD.has(achKey(y.des, y.u)) || achKey(y.des, y.u) === achKey(l.des, l.u)));
    const nF = ((x.lf || {})[l.id] || []).filter(f => (x.frs || []).includes(f)).length;
    return { rd: { k, st: rdSt(k) }, ck: ckC(k), cls: (l.imp ? "cafp-imp " : "") + (l.g && (x.grp || []).some(g => g.id === l.g) ? "svlk-g-" + l.g + " " : "") + lkC(k), go: a ? [[2, "art", a.id]] : [], cells: [o.no,
      { h: `<select class="ins-in cafp-bsn" data-li="${esc(l.id)}"${dis}><option value="">—</option>${BO.map(y => `<option value="${esc(y.id)}"${y.id === l.bsn ? " selected" : ""}>${esc(y.ref + " · " + (achArtOf(y.des, y.u) ? achRefSvi(achArtOf(y.des, y.u), achArts(), "ARA") : "HORS LISTE") + " · " + y.des + " · " + y.u + " · " + achF2(y.q))}</option>`).join("")}</select>`, t: b ? b.ref : "" },
      a ? achRefSvi(a, achArts(), "ARA") : "HORS LISTE",
      l.libre ? { h: `<input class="ins-in cafp-l" data-li="${esc(l.id)}" data-c="des" value="${esc(l.des || "")}"${dis}>`, t: l.des || "" } : { h: `<select class="ins-in cafp-des" data-li="${esc(l.id)}"${dis}><option value="">—</option>${AO.map(y => `<option value="${esc(y.id)}"${achKey(y.des, y.u) === achKey(l.des, l.u) ? " selected" : ""}>${esc(y.des + " (" + y.u + ")")}</option>`).join("")}</select>`, t: l.des || "" },
      l.libre ? { h: `<input class="ins-in cafp-l center" data-li="${esc(l.id)}" data-c="u" value="${esc(l.u || "")}"${dis}>`, t: l.u || "" } : l.u || "",
      { h: `<input class="ins-in cafp-l number" data-li="${esc(l.id)}" data-c="q" inputmode="decimal" value="${esc(String(l.q ?? "").replace(".", ","))}"${dis}>`, t: achN(l.q) },
      /* v1134 (L24) : prix du budget ou prix standard = bloqué (gris) ; à saisir seulement s'il n'existe nulle part ; source dans la colonne suivante */
      es.lock ? { h: `<span class="cafp-lock" data-tip="${esc(es.lab)}">${esc(achF2(es.pu))}</span>`, t: es.pu } : { h: `<input class="ins-in cafp-l number" data-li="${esc(l.id)}" data-c="pu" inputmode="decimal" value="${esc(String(l.pu ?? "").replace(".", ","))}" placeholder="À SAISIR"${dis}>`, t: achN(l.pu) },
      es.lab, achN(l.q) * es.pu, String(nF)] }; });
  ACH_DET_DRAG[achNvhKey("ARTICLES CONSULTÉS")] = { open, rows: det.map(r => r.rd ? { l: r.rd.k.slice(2) } : { g: r.gid }), apply: f => achCafSaveOne(x.id, c => f(c), "DÉTAIL DÉPLACÉ") };
  const DET = { t: "ARTICLES CONSULTÉS", lines: true, rdh: LK.rdAll("a"), add: open ? "CRÉER UN DÉTAIL ICI…" : "", cols: [["ARTICLE", "center"], ["BESOIN"], ["CODE ARTICLE"], ["DÉSIGNATION"], ["U", "center"], ["QUANTITÉ", "number"], ["PRIX ESTIMÉ", "number"], ["SOURCE DU PRIX"], ["MONTANT ESTIMÉ", "number"], ["FOURNISSEURS", "center"]],   /* v1134 (L24) : plus de MONTANT BUDGÉTÉ */
    rows: det, addFn: redraw => { achCafSaveOne(x.id, c => { const id = achCafId(); c.lignes.push({ id, des: "", u: "", q: "" }); c.lf[id] = (c.frs || []).slice(); }, "DÉTAIL AJOUTÉ"); redraw(); },
    menu: open ? [{ k: "imp", lab: "IMPORTER (EXCEL, GOOGLE SHEETS, CSV, PDF)" }].concat((x.lignes || []).some(l => l.imp) ? [{ k: "impok", lab: "CONFIRMER LES COCHÉS (VÉRIFIÉS)" }] : []).concat([{ k: "bsn", lab: "AJOUTER LES BESOINS VALIDÉS NON COUVERTS" }, { k: "libre", lab: "AJOUTER UN ARTICLE HORS LISTE" }, { k: "up", lab: "MONTER LES COCHÉS" }, { k: "down", lab: "DESCENDRE LES COCHÉS" }, { k: "grp", lab: "GROUPER LES COCHÉS" }, { k: "ungrp", lab: "SORTIR LES COCHÉS DE LEUR GROUPE" }, { k: "rm", lab: "SUPPRIMER LES COCHÉS" }]) : [],
    act: async (a, ck, redraw) => { const rowsL = ck.map(i => det[i]).filter(r => r && r.rd).map(r => r.rd.k.slice(2));
      if (a === "imp") { await achCafImport(x, redraw); return; }
      if (a === "libre") { achCafSaveOne(x.id, c => { const id = achCafId(); c.lignes.push({ id, des: "", u: "", q: "", pu: "", libre: true }); c.lf[id] = (c.frs || []).slice(); }, "DÉTAIL HORS LISTE AJOUTÉ"); redraw(); return; }
      if (a === "bsn") { const have = new Set((x.lignes || []).map(l => l.bsn).filter(Boolean)), BB = achBsnOpen().filter(b => !have.has(b.id)); if (!BB.length) { svToast("AUCUN BESOIN VALIDÉ NON COUVERT.", 3000); return; }
        const pick = await achPickWin("BESOINS VALIDÉS NON COUVERTS", BB.map(b => ({ v: b.id, lab: b.ref + " — " + b.des + " (" + achF2(b.q) + " " + b.u + ")" }))); if (!pick.length) return;
        achCafSaveOne(x.id, c => BB.filter(b => pick.includes(b.id)).forEach(b => { const id = achCafId(); c.lignes.push({ id, bsn: b.id, des: b.des, u: b.u, q: achN(b.q) }); c.lf[id] = (c.frs || []).slice(); }), "BESOINS AJOUTÉS"); redraw(); return; }
      if (!rowsL.length) { svToast("COCHER D'ABORD DES DÉTAILS.", 2500); return; }
      if (a === "impok") { achCafSaveOne(x.id, c => c.lignes.forEach(l => { if (rowsL.includes(l.id)) delete l.imp; }), "DÉTAILS IMPORTÉS VÉRIFIÉS"); redraw(); return; }
      if (a === "up" || a === "down") { achCafSaveOne(x.id, c => { c.lignes = achDetMove(c.lignes, rowsL, a === "up" ? -1 : 1); }, "DÉTAILS DÉPLACÉS"); redraw(); return; }
      if (a === "grp") { achCafSaveOne(x.id, c => { c.grp = c.grp || []; const g = { id: achCafId() }; c.grp.push(g); c.lignes.forEach(l => { if (rowsL.includes(l.id)) l.g = g.id; }); }, "GROUPE CRÉÉ"); redraw(); return; }
      if (a === "ungrp") { achCafSaveOne(x.id, c => c.lignes.forEach(l => { if (rowsL.includes(l.id)) delete l.g; }), "SORTIS DU GROUPE"); redraw(); return; }
      if (a === "rm") { if (!(await svConfirm({ title: "SUPPRIMER LES DÉTAILS COCHÉS", text: rowsL.length + " DÉTAIL(S) ; LA NUMÉROTATION SE REFAIT.", ok: "SUPPRIMER" }))) return;
        achCafSaveOne(x.id, c => { c.lignes = c.lignes.filter(l => !rowsL.includes(l.id)); rowsL.forEach(id => { delete c.lf[id]; delete c.ld[id]; delete c.lc[id]; }); }, "DÉTAILS SUPPRIMÉS"); redraw(); } } };
  /* ---- FOURNISSEURS (F12) ---- */
  /* v1119 (L10, série L) : UN SEUL BLOC FOURNISSEURS — regroupe FOURNISSEURS CONSULTÉS, CONSULTATIONS PAR FOURNISSEUR et DEVIS : par fournisseur, son nom (lié),
     la référence de sa consultation fille (H1), l'état de la fille (F18), ses devis (références liées) et leur montant TTC ; le principe mère / filles reste */
  const FRS = { t: "FOURNISSEURS", rdh: LK.rdAll("f"), add: open ? "AJOUTER UN FOURNISSEUR ICI…" : "", cols: [["FOURNISSEUR"], ["CONSULTATION"], ["ÉTAT", "center"], ["DEVIS"], ["MONTANT TTC", "number"]],
    rows: (x.frs || []).map(f => { const V = DD.filter(v => v.frs === f), k = "f|" + f, fil = (x.fil || {})[f], s0 = fil ? achFilSt(x, f, D) : "", mt = V.filter(v => v.state !== "annule" && v.state !== "rejete").reduce((t, v) => t + achDvfTot(v).ttc, 0);
      return { rd: { k, st: rdSt(k) }, ck: ckC(k), cls: lkC(k), go: [[0, "frs", f]], st: s0 || undefined, cells: [fr(f), fil ? achFilRefOf(x, f) : "", s0 ? ACH_FIL_ST[s0] : "",
        { h: V.map(v => `<button type="button" class="ach-link" data-nvgo="dvf|${esc(v.id)}">${esc(v.ref)}</button>`).join(", ") + (open ? ` <button type="button" class="ach-b cafp-mkdvf" data-f="${esc(f)}">CRÉER SON DEVIS</button>` : ""), t: V.map(v => v.ref).join(", ") },
        V.length ? mt : ""] }; }),
    addFn: async redraw => { const K = new Set((x.lignes || []).map(l => achKey(l.des, l.u)));
      const F = achLive(achFrs()).filter(f => achFrsOk(f) && !f.bloq && !(x.frs || []).includes(f.id)).map(f => { const S = achFrsSold(f.id); return { f, n: [...K].filter(k => S.has(k)).length }; }).sort((a, b) => b.n - a.n || a.f.nom.localeCompare(b.f.nom, "fr"));
      if (!F.length) { svToast("AUCUN AUTRE FOURNISSEUR ACTIF (ACHAT › FOURNISSEURS).", 3000); return; }
      const pick = await achPickWin("FOURNISSEURS À CONSULTER", F.map(y => ({ v: y.f.id, lab: y.f.code + " — " + y.f.nom + (y.n ? "  ★ A DÉJÀ VENDU " + y.n + " DE CES ARTICLES" : "") }))); if (!pick.length) return;
      achCafSaveOne(x.id, c => pick.forEach(f => { c.frs.push(f); c.rep = c.rep || {}; c.rep[f] = { st: "attente" }; const S = achFrsSold(f), mine = c.lignes.filter(l => S.has(achKey(l.des, l.u)));
        (mine.length ? mine : c.lignes).forEach(l => { c.lf[l.id] = (c.lf[l.id] || []).concat([f]); }); }), "FOURNISSEURS AJOUTÉS"); redraw(); },
    menu: open ? [{ k: "dec", lab: "LES COCHÉS ONT DÉCLINÉ" }, { k: "att", lab: "LES COCHÉS : EN ATTENTE" }, { k: "rmf", lab: "RETIRER LES COCHÉS (SANS DEVIS)" }] : [],
    act: async (a, ck, redraw) => { if (a === "dec" || a === "att") { const F2 = ck.map(i => (x.frs || [])[i]).filter(Boolean); if (!F2.length) { svToast("COCHER D'ABORD DES FOURNISSEURS.", 2500); return; }   /* v1119 (L10) : la réponse passe par le ⋯ (plus de colonne RÉPONSE) */
        achCafSaveOne(x.id, c => F2.forEach(f => { c.rep[f] = { ...(c.rep[f] || {}), st: a === "dec" ? "decline" : "attente" }; }), a === "dec" ? "FOURNISSEURS : DÉCLINÉ" : "FOURNISSEURS : EN ATTENTE"); redraw(); return; }
      const F = ck.map(i => (x.frs || [])[i]).filter(Boolean).filter(f => !DD.some(v => v.frs === f)); if (!F.length) { svToast("COCHER DES FOURNISSEURS SANS DEVIS.", 2500); return; }
      achCafSaveOne(x.id, c => { c.frs = c.frs.filter(f => !F.includes(f)); F.forEach(f => { delete c.rep[f]; delete c.fd[f]; delete c.fc[f]; Object.keys(c.lf).forEach(l => { c.lf[l] = c.lf[l].filter(y => y !== f); }); }); }, "FOURNISSEURS RETIRÉS"); redraw(); } };
  /* ---- série H (H1) : CONSULTATIONS PAR FOURNISSEUR — une fille par fournisseur, ses seuls articles ; À RENVOYER si ses articles ont changé depuis l'envoi ---- */
  const FIL = { t: "CONSULTATIONS PAR FOURNISSEUR", cols: [["RÉFÉRENCE"], ["FOURNISSEUR"], ["ARTICLES", "center"], ["ENVOYÉE LE", "center"], ["DEVIS"], ["ÉTAT", "center"]],
    rows: (x.frs || []).filter(f => (x.fil || {})[f]).map(f => { const o = x.fil[f], s0 = achFilSt(x, f, D), V = DD.filter(v => v.frs === f), env = o.env || ((x.rep || {})[f] || {}).env || "";
      return { st: s0, go: [[1, "frs", f]],   /* correction : l'état de la fille seul décide de la couleur (plus de « validé » ajouté par le texte de l'état) */ cells: [achFilRefOf(x, f), fr(f), String(achFilLig(x, f).length), env ? achDFr(String(env).slice(0, 10)) : "",
        { h: V.map(v => `<button type="button" class="ach-link" data-nvgo="dvf|${esc(v.id)}">${esc(v.ref)}</button>`).join(", "), t: V.map(v => v.ref).join(", ") }, ACH_FIL_ST[s0]] }; }) };
  /* ---- DOCUMENTS : ceux de l'onglet DOCUMENTS du SUIVI ; cochés = à envoyer ---- */
  const DOCS = (achJ("svi_docs_v1:ACH-" + (x.ref || x.code), []) || []).map((d0, i) => ({ ...d0, __id: d0.ref || "d" + i })).filter(d0 => !(x.dhide || []).includes(d0.__id));   /* 11/11 : documents retirés de la consultation (gardés au SUIVI) */
  const DOC = { t: "DOCUMENTS ENVOYÉS", rdh: LK.rdAll("d"), add: open ? "AJOUTER UN DOCUMENT ICI… (IL S'AJOUTE AUSSI AU SUIVI)" : "", cols: [["RÉFÉRENCE"], ["INTITULÉ"]],   /* 11/11 (Ahmed) : la référence soulignée ouvre le document (plus de colonne FICHIER) */
    rows: DOCS.map((d0, i) => { const id = d0.__id, k = "d|" + id; return { rd: { k, st: rdSt(k) }, ck: ckC(k), cls: lkC(k), cells: [d0.fk ? { h: `<button type="button" class="ach-link cafp-doc" data-fk="${esc(d0.fk)}">${esc(d0.ref || "DOCUMENT")}</button>`, t: d0.ref || "" } : d0.ref || "", d0.title || ""] }; }),
    addFn: async redraw => { const R = achRecBlock(x.ref || x.code); if (await R.addTab("doc")) { const L2 = R.list("doc"), n = L2[L2.length - 1]; void n; } redraw(); },
    /* 11/11 (Ahmed) : SUPPRIMER LES DOCUMENTS COCHÉS — retirés de la consultation (plus envoyés, liaisons retirées), gardés au SUIVI */
    menu: open ? [{ k: "rmd", lab: "SUPPRIMER LES DOCUMENTS COCHÉS", del: true }] : [],
    act: async (a, ck, redraw) => { if (a !== "rmd") return; const D0 = ck.map(i => DOCS[i]).filter(Boolean); if (!D0.length) { svToast("COCHER D'ABORD LES DOCUMENTS À SUPPRIMER (CASES À DROITE).", 3000); return; }
      if (!(await svConfirm({ title: "SUPPRIMER LES DOCUMENTS COCHÉS", html: D0.map(d0 => `<div>- ${esc((d0.ref || "") + (d0.title ? " — " + d0.title : ""))}</div>`).join("") + `<div style="margin-top:12px">ILS RESTENT DANS LE SUIVI.</div>`, ok: "SUPPRIMER" }))) return;
      const ids = D0.map(d0 => d0.__id), snap = JSON.stringify({ dhide: x.dhide || [], fd: x.fd || {}, ld: x.ld || {} });
      const run = () => achCafSaveOne(x.id, c => { c.dhide = [...new Set((c.dhide || []).concat(ids))]; Object.keys(c.fd || {}).forEach(f => { c.fd[f] = (c.fd[f] || []).filter(y => !ids.includes(y)); }); Object.keys(c.ld || {}).forEach(l => { c.ld[l] = (c.ld[l] || []).filter(y => !ids.includes(y)); }); }, "DOCUMENTS RETIRÉS");
      run(); if (typeof sviUndoPush === "function") sviUndoPush(dir => { if (dir === "undo") { const S = JSON.parse(snap); achCafSaveOne(x.id, c => { c.dhide = S.dhide; c.fd = S.fd; c.ld = S.ld; }, "DOCUMENTS RÉTABLIS"); } else run(); redraw(); }, "SUPPRESSION DE DOCUMENTS"); redraw(); } };
  /* ---- CONDITIONS PARTICULIÈRES (F5) ---- */
  const CND = { t: "CONDITIONS PARTICULIÈRES", rdh: LK.rdAll("c"), add: open ? "AJOUTER UNE CONDITION ICI…" : "", cols: [["CONDITION"], ["VALEUR"]],
    rows: (x.cond || []).map(cd => { const k = "c|" + cd.id, inp = cd.t === "on" ? `<select class="ins-in cafp-cv" data-cd="${esc(cd.id)}"${dis}>${["", "OUI", "NON"].map(v => `<option value="${v}"${cd.v === v ? " selected" : ""}>${v || "—"}</option>`).join("")}</select>`
        : `<input class="ins-in cafp-cv${cd.t === "num" ? " number" : ""}" data-cd="${esc(cd.id)}"${cd.t === "date" ? ' type="date"' : ""}${cd.t === "num" ? ' inputmode="decimal"' : ""} value="${esc(cd.v || "")}"${dis}>`;
      const miss = achCafCondLinked(x, cd) && !String(cd.v ?? "").trim();
      return { rd: { k, st: rdSt(k) }, ck: ckC(k), cls: lkC(k), cells: [miss ? { h: `<b class="obs-bang val-bang nv-bang" role="button" data-why="VALEUR MANQUANTE">!</b> ${esc(cd.lab)}`, t: cd.lab } : cd.lab, { h: inp, t: cd.v || "" }] }; }),
    addFn: async redraw => { const lab = await achAsk("NOUVELLE CONDITION PARTICULIÈRE", "INTITULÉ (AJOUTÉ AUSSI À ACHATS › CLAUSES)"); if (!lab) return;
      achCafSaveOne(x.id, c => { c.cond.push({ id: achCafId(), k: "autre", lab: achU(lab), t: "text", v: "" }); }, "CONDITION AJOUTÉE");
      /* un seul catalogue : la condition rejoint les clauses particulières (ACHATS › CLAUSES) si elle n'y est pas */
      const P = achPrm(), Lp = achClP(P); if (!Lp.some(y => achU(y.txt) === achU(lab))) { P.clP = Lp.concat([{ id: "p" + Date.now().toString(36), t: "autre", txt: achU(lab) }]); achPrmSave(P); }
      redraw(); },
    /* 11/11 (Ahmed) : SUPPRIMER LES CONDITIONS COCHÉES — avec leurs liaisons (fournisseurs, articles) ; ANNULER possible */
    menu: open ? [{ k: "rmc", lab: "SUPPRIMER LES CONDITIONS COCHÉES", del: true }] : [],
    act: async (a, ck, redraw) => { if (a !== "rmc") return; const C0 = ck.map(i => (x.cond || [])[i]).filter(Boolean); if (!C0.length) { svToast("COCHER D'ABORD LES CONDITIONS À SUPPRIMER (CASES À DROITE).", 3000); return; }
      if (!(await svConfirm({ title: "SUPPRIMER LES CONDITIONS COCHÉES", html: C0.map(cd => `<div>- ${esc(cd.lab)}</div>`).join(""), ok: "SUPPRIMER" }))) return;
      const ids = C0.map(cd => cd.id), snap = JSON.stringify({ cond: x.cond || [], fc: x.fc || {}, lc: x.lc || {} });
      const run = () => achCafSaveOne(x.id, c => { c.cond = (c.cond || []).filter(cd => !ids.includes(cd.id)); Object.keys(c.fc || {}).forEach(f => { c.fc[f] = (c.fc[f] || []).filter(y => !ids.includes(y)); }); Object.keys(c.lc || {}).forEach(l => { c.lc[l] = (c.lc[l] || []).filter(y => !ids.includes(y)); }); }, "CONDITIONS SUPPRIMÉES");
      run(); if (typeof sviUndoPush === "function") sviUndoPush(dir => { if (dir === "undo") { const S = JSON.parse(snap); achCafSaveOne(x.id, c => { c.cond = S.cond; c.fc = S.fc; c.lc = S.lc; }, "CONDITIONS RÉTABLIES"); } else run(); redraw(); }, "SUPPRESSION DE CONDITIONS"); redraw(); } };
  /* ---- COMPARATIF (F8 : devis partiels, plusieurs devis, prix à choisir) ---- */
  const FC = (x.frs || []).filter(f => DD.some(v => v.frs === f));
  /* v1119 (L14, série L) : TABLEAU COMPARATIF — ARTICLE (avec son unité), QUANTITÉ, puis par fournisseur (son nom en titre) PRIX UNITAIRE TTC et MONTANT TTC ;
     par article : moins-disant en vert, plus cher en rouge, les autres en dégradé entre les deux (comme les indicateurs du budget) ; même mise en forme pour les totaux */
  const ttcOf = (f, l) => { if (!lk("lf", l.id, f)) return null; const p = achCafPrice(x, f, l, D); if (p.st !== "ok") return p; const y = p.p.y, tv = y.tva === "" || y.tva === undefined ? achPrm().tva : achN(y.tva), pu = achN(y.pu) * (1 + tv / 100); return { st: "ok", pu, mt: pu * achN(l.q) }; };
  const grad = (v, A) => { const V = A.filter(a => a !== null), lo = Math.min(...V), hi = Math.max(...V); if (V.length < 2 || hi - lo < 1e-9) return V.length > 1 ? "background:hsl(130,55%,84%) !important" : ""; const t = (v - lo) / (hi - lo);
    return `background:hsl(${Math.round(130 * (1 - t))},62%,${Math.round(84 - 4 * Math.abs(t - .5))}%) !important;color:#172033 !important;-webkit-text-fill-color:#172033 !important`; };
  const cmpRows = (x.lignes || []).map(l => { const P = FC.map(f => ttcOf(f, l)), M = P.map(p => p && p.st === "ok" ? p.mt : null);
    return { cells: [l.des + (l.u ? " (" + l.u + ")" : ""), achN(l.q)].concat(...FC.map((f, i) => { const p = P[i];
      if (!p) return ["—", "—"]; if (p.st === "nc") return ["NON CHIFFRÉ", ""];
      if (p.st === "choix") return [{ h: `<button type="button" class="ach-b cafp-pick" data-f="${esc(f)}" data-li="${esc(l.id)}">À CHOISIR (${p.n} PRIX)</button>`, t: "À CHOISIR" }, ""];
      const st = grad(p.mt, M); return [{ h: achF2(p.pu), t: p.pu, st }, { h: achF2(p.mt), t: p.mt, st }]; })) }; });
  const TT = FC.map(f => (x.lignes || []).reduce((t, l) => { const p = ttcOf(f, l); return t + (p && p.st === "ok" ? p.mt : 0); }, 0));
  const CMP = { t: "TABLEAU COMPARATIF", cols: [["ARTICLE"], ["QUANTITÉ", "number"]].concat(...FC.map(() => [["PRIX UNITAIRE TTC", "number"], ["MONTANT TTC", "number"]])),
    grp: ["", ""].concat(...FC.map(f => [fr(f), fr(f)])),
    rows: cmpRows.concat([{ cls: "caf-tot", cells: ["TOTAL TTC (ARTICLES CHIFFRÉS)", ""].concat(...TT.map(v => ["", { h: achF2(v), t: v, st: grad(v, TT) }])) }]) };
  return { title: x.objet || "", lkBar: open ? LK.bar() : "",   /* v1126 (L6 – L8) : ✓ LIER / ✕ DÉLIER en haut à droite */
    menu: (open ? [x.val ? { k: "send", lab: "REMETTRE LA CONSULTATION (ENVOI AUX FOURNISSEURS)" } : { k: "val", lab: x.circ && !achCircDone(x) ? "CIRCUIT DE VALIDATION" : "VALIDER LA CONSULTATION" }].concat(FC.length ? [{ k: "close", lab: "CLÔTURER (CHOIX DU RETENU)" }] : []) : []),   /* v1119 (L13) : une commande ne se crée que depuis un devis (page du devis retenu) */
    act: async (k, redraw) => {
      if (k === "send") { achCafSend(x.id, redraw); return true; }
      /* v1121 (L20) : VALIDER avant la remise — circuit de validation des consultations s'il s'applique (vert), puis validée, à remettre (orange) */
      if (k === "val") { const L = achCaf(), C = L.find(y => y.id === x.id); if (!C) return true;
        if (!(C.lignes || []).length || !(C.frs || []).length) { svToast("IL FAUT AU MOINS UN ARTICLE ET UN FOURNISSEUR.", 3000); return true; }
        if (await achCafGate(C, async lab => { C.mod = achNow(); achCafSave(L); achHist(C.ref, lab, ""); redraw(); })) return true;
        if (!(await svConfirm({ title: "VALIDER LA CONSULTATION", text: C.ref + " : VALIDÉE, ELLE POURRA ÊTRE REMISE AUX FOURNISSEURS.", ok: "VALIDER", tone: "neutral" }))) return true;
        C.val = achNow(); C.mod = achNow(); achCafSave(L); achHist(C.ref, "VALIDÉE — À REMETTRE", ""); redraw(); return true; }
      if (k === "close") { achCafClose(x.id, redraw); return true; }
      return false; },
    links: [DET, FRS, DOC, CND].concat(FC.length ? [CMP] : []).concat([B.CM("COMMANDES", achCmf().filter(c => c.caf === x.id))]),   /* v1119 (L10) : plus de blocs CONSULTATIONS PAR FOURNISSEUR ni DEVIS */
    /* ronds, devis, choix du prix, documents */
    click: async (e, redraw) => {
      /* v1126 (L6 – L8) : le rond choisit ou libère (plusieurs lignes par bloc) ; rien n'est lié avant ✓ LIER (consultation close : choix pour voir seulement) */
      /* v1132 (L6 – L8) : rond d'en-tête = tout choisir (lignes affichées du bloc) / tout libérer ; grisé si une ligne est choisie à la main */
      const ra = e.target.closest("[data-rdall]"); if (ra && ra.closest(".nvp")) { const g = ra.dataset.rdall;
        if (LK.hand(g)) { svToast("UNE LIGNE DE CE BLOC EST DÉJÀ CHOISIE À LA MAIN — LA LIBÉRER D'ABORD.", 3000, ra); return true; }
        const ids = [...ra.closest(".nvp-blk").querySelectorAll("tbody tr[data-ri]:not(.svlk-hid) .nvp-rd[data-rd]")].map(b => b.dataset.rd.split("|")[1]);
        LK.setAll(g, ids, !LK.allOn(g)); redraw(); return true; }
      const rd = e.target.closest(".nvp-rd[data-rd]"); if (rd && rd.closest(".nvp")) { const [t, id] = rd.dataset.rd.split("|"); LK.toggle(t, id); redraw(); return true; }
      const lb = e.target.closest("[data-svlk]"); if (lb && lb.closest(".nvp") && open) { const on = lb.dataset.svlk === "lier", snap = JSON.stringify(["lf", "ld", "lc", "fd", "fc"].map(m => x[m] || {}));
        const done = await LK.apply(lb.dataset.svlk, (L, on2) => achCafSaveOne(x.id, c => sviLkWrite(c, L, on2), (on2 ? "LIÉ : " : "DÉLIÉ : ") + L.length + " LIAISON(S)"));
        if (done && typeof sviUndoPush === "function") { const after = JSON.stringify(["lf", "ld", "lc", "fd", "fc"].map(m => (achCaf().find(y => y.id === x.id) || {})[m] || {}));
          sviUndoPush(dir => { const V = JSON.parse(dir === "undo" ? snap : after); achCafSaveOne(x.id, c => ["lf", "ld", "lc", "fd", "fc"].forEach((m, i) => { c[m] = V[i]; })); const v = document.getElementById("ach"); if (v && v.__achDraw) v.__achDraw(); else redraw(); }, on ? "LIAISON" : "DÉLIER"); }
        redraw(); return true; }
      const mk = e.target.closest(".cafp-mkdvf"); if (mk) { achCafMkDvf(x.id, mk.dataset.f, redraw); return true; }
      const pk = e.target.closest(".cafp-pick"); if (pk) { const f = pk.dataset.f, l = (x.lignes || []).find(y => y.id === pk.dataset.li), P = l ? achCafPrices(x, f, l) : []; if (!P.length) return true;
        const ch = await achPickWin("PRIX À GARDER — " + l.des + " — " + fr(f), P.map(p => ({ v: p.v.id, lab: p.v.ref + " — " + achF2(p.y.pu) + " HT" }))); if (!ch.length) return true;
        achCafSaveOne(x.id, c => { c.pick = c.pick || {}; c.pick[l.id] = { ...(c.pick[l.id] || {}), [f]: ch[0] }; }, "PRIX GARDÉ — " + l.des); redraw(); return true; }
      const dk = e.target.closest(".cafp-doc"); if (dk) { achCopyOpen(dk.dataset.fk); return true; }
      return false; },
    change: (e, redraw) => { const t = e.target; if (!t.closest || !t.closest(".nvp")) return false;
      if (t.matches(".cafp-bsn")) { const b = achBsn().find(y => y.id === t.value); achCafSaveOne(x.id, c => { const l = c.lignes.find(y => y.id === t.dataset.li); if (!l) return; if (b) Object.assign(l, { bsn: b.id, des: b.des, u: b.u, q: achN(b.q), libre: false }); else delete l.bsn; }, "BESOIN DU DÉTAIL"); redraw(); return true; }
      if (t.matches(".cafp-des")) { const a = achArts().find(y => y.id === t.value); achCafSaveOne(x.id, c => { const l = c.lignes.find(y => y.id === t.dataset.li); if (!l || !a) return; if (achKey(a.des, a.u) !== achKey(l.des, l.u)) delete l.bsn; l.des = a.des; l.u = a.u; }, "DÉSIGNATION DU DÉTAIL"); redraw(); return true; }
      if (t.matches(".cafp-l")) { const li = t.dataset.li, f = t.dataset.c, nv = f === "q" || f === "pu" ? achN(t.value) : achU(t.value), c0 = achCaf().find(y => y.id === x.id), l0 = c0 && (c0.lignes || []).find(y => y.id === li), ov = l0 ? l0[f] : undefined;
        const lab = { q: "QUANTITÉ", pu: "PRIX ESTIMÉ", des: "DÉSIGNATION", u: "UNITÉ" }[f] || "DÉTAIL", put = v => achCafSaveOne(x.id, c => { const l = c.lignes.find(y => y.id === li); if (l) l[f] = v; }, lab + " DU DÉTAIL : " + (v ?? ""));
        put(nv); redraw();
        /* 10/11 : ANNULER / RÉTABLIR de la saisie du détail */
        if (String(ov ?? "") !== String(nv ?? "") && typeof sviUndoPush === "function") sviUndoPush(dir => { put(dir === "undo" ? ov : nv); const v = document.getElementById("ach"); if (v && v.__achDraw) v.__achDraw(); else redraw(); }, "MODIFICATION " + (f === "q" ? "DE LA QUANTITÉ" : "DU DÉTAIL"));
        return true; }
      if (t.matches(".cafp-pay")) { achCafSaveOne(x.id, c => { c.rep[t.dataset.f] = { ...(c.rep[t.dataset.f] || {}), pay: achU(t.value) }; }, "CONDITIONS DE PAIEMENT"); return true; }
      if (t.matches(".cafp-rep")) { achCafSaveOne(x.id, c => { c.rep[t.dataset.f] = { ...(c.rep[t.dataset.f] || {}), st: t.value, date: achNow() }; }, "RÉPONSE"); redraw(); return true; }
      if (t.matches(".cafp-cv")) { achCafSaveOne(x.id, c => { const cd = c.cond.find(y => y.id === t.dataset.cd); if (!cd) return; cd.v = cd.t === "num" ? String(achN(t.value)) : cd.t === "date" || cd.t === "on" ? t.value : achU(t.value);
        if (cd.k === "dlim") c.dlim = t.value; if (cd.k === "lieu") c.lieu = cd.v; if (cd.k === "dSouh") c.dSouh = t.value; if (cd.k === "franco") c.franco = cd.v === "OUI"; if (cd.k === "equiv") c.variante = cd.v === "OUI"; }, "CONDITION : " + t.value); redraw(); return true; }
      return false; } };
}
/* 11/11 (Ahmed, validé) : CONDITIONS PARTICULIÈRES ENVOYÉES PAR LA LIAISON — une condition part chez un fournisseur seulement si elle lui est liée
   par le rond : directement (fc) ou par un article (lc) lié à ce fournisseur (lf) ; une condition liée à rien n'est envoyée à personne ; la colonne
   À ENVOYER est retirée (champ env des anciennes données ignoré) ; une condition liée doit avoir une valeur */
const achCafCondOf = (c, f) => { const fc = ((c.fc || {})[f] || []), L = (c.lignes || []).filter(l => ((c.lf || {})[l.id] || []).includes(f));
  return (c.cond || []).filter(cd => fc.includes(cd.id) || L.some(l => ((c.lc || {})[l.id] || []).includes(cd.id))); };
const achCafCondLinked = (c, cd) => (c.frs || []).some(f => achCafCondOf(c, f).includes(cd));
/* 11/11 (Ahmed, validé) : les DOCUMENTS partent comme les conditions — liés au fournisseur par le rond, directement (fd) ou par un article (ld) */
const achCafDocOf = (c, f, DOCS) => { const fd = ((c.fd || {})[f] || []), L = (c.lignes || []).filter(l => ((c.lf || {})[l.id] || []).includes(f));
  return DOCS.filter((d0, i) => { const id = d0.__id || d0.ref || "d" + i; return fd.includes(id) || L.some(l => ((c.ld || {})[l.id] || []).includes(id)); }); };
const achCafCondMiss = c => (c.cond || []).filter(cd => achCafCondLinked(c, cd) && !String(cd.v ?? "").trim());
/* F8 : CRÉER SON DEVIS — prérempli avec les détails liés au fournisseur ; il reste les prix (plusieurs devis du même fournisseur possibles) */
function achCafMkDvf(id, f, redraw) { const c = achCaf().find(y => y.id === id); if (!c) return; achCafUp(c);
  const Ls = c.lignes.filter(l => ((c.lf || {})[l.id] || []).includes(f)); if (!Ls.length) { svToast("AUCUN DÉTAIL LIÉ À CE FOURNISSEUR.", 3000); return; }
  const L = achDvf(), now = achNow(), v = { id: "V" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ref: achNextRef("DVF", L), caf: c.id, frs: f, refFrs: "", date: now.slice(0, 10), validite: "", state: "recu", cree: now,
    lignes: Ls.map(l => ({ bsn: l.bsn || "", des: l.des, u: l.u, q: achN(l.q), pu: "", tva: achPrm().tva })) };
  L.push(v); achDvfSave(L); achHist(v.ref, "CRÉATION", "RÉPONSE DE " + achFrsNom(f) + " À " + c.ref);
  achCafSaveOne(id, x => { x.rep[f] = { ...(x.rep[f] || {}), st: "repondu", date: now, dvf: v.id }; }, "DEVIS CRÉÉ — " + v.ref);
  achDvfFiche(v.id, () => { if (redraw) redraw(); }); }
/* F9 : ENVOYER LA CONSULTATION — pour chaque bloc : TOUS, ou seulement les cochés ; un bordereau par fournisseur (ses détails liés), sans aucun prix */
function achCafSend(id, redraw) { const c = achCaf().find(y => y.id === id); if (!c) return; achCafUp(c);
  if (!c.val) { svToast("VALIDER D'ABORD LA CONSULTATION (⋯ › VALIDER LA CONSULTATION).", 3500); return; }   /* v1121 (L20) */
  { const Mi = achCafCondMiss(c); if (Mi.length) { svToast("ENVOI IMPOSSIBLE : CONDITION(S) LIÉE(S) SANS VALEUR — " + Mi.map(cd => cd.lab).join(", ") + ".", 6000); return; } }
  { const ni = (c.lignes || []).filter(l => l.imp).length; if (ni) { svToast("ENVOI IMPOSSIBLE : " + ni + " DÉTAIL(S) IMPORTÉ(S) À VÉRIFIER (EN ROUGE) — LES COCHER PUIS « CONFIRMER LES COCHÉS ».", 5000); return; } }
  const ck = key => { const bl = document.querySelector(`#ach .nvp-blk[data-nvb="${key}"]`); return bl ? [...bl.querySelectorAll("tbody tr[data-ri]")].filter(tr => tr.querySelector(".nvp-cb:checked")).map(tr => +tr.dataset.ri) : []; };
  const B = [["det", "ARTICLES CONSULTÉS", achNvhKey("ARTICLES CONSULTÉS")], ["frs", "FOURNISSEURS", achNvhKey("FOURNISSEURS")], ["doc", "DOCUMENTS ENVOYÉS", achNvhKey("DOCUMENTS ENVOYÉS")], ["cnd", "CONDITIONS PARTICULIÈRES ET DÉLAIS", achNvhKey("CONDITIONS PARTICULIÈRES")]];
  const CK = Object.fromEntries(B.map(([k, , key]) => [k, ck(key)])), M = Object.fromEntries(B.map(([k]) => [k, CK[k].length ? "ck" : "all"])), d = sviWinNew();
  const det0 = achDetNum(c.lignes, c.grp).filter(o => !o.title);
  const pickL = () => M.det === "ck" ? det0.filter((o, i) => CK.det.includes(achDetNum(c.lignes, c.grp).indexOf(o))).map(o => o.l) : c.lignes;
  const pickF = () => M.frs === "ck" ? CK.frs.map(i => c.frs[i]).filter(Boolean) : c.frs.slice();
  const DOCS = (achJ("svi_docs_v1:ACH-" + c.ref, []) || []).map((d0, i) => ({ ...d0, __id: d0.ref || "d" + i })).filter(d0 => !(c.dhide || []).includes(d0.__id)), pickD = () => (M.doc === "ck" ? CK.doc.map(i => DOCS[i]).filter(Boolean) : DOCS.slice());   /* 11/11 : cases cochées = réduction parmi les documents liés */
  const pickC = () => (M.cnd === "ck" ? CK.cnd.map(i => c.cond[i]).filter(Boolean) : c.cond.slice()).filter(x => String(x.v ?? "").trim());   /* 11/11 : cases cochées = réduction parmi les conditions liées */
  const txtOf = f => { const Ls = pickL().filter(l => ((c.lf || {})[l.id] || []).includes(f)), Cd = (() => { const Lk = achCafCondOf(c, f); return pickC().filter(cd => Lk.includes(cd)); })(), Dc = (() => { const Lk = achCafDocOf(c, f, DOCS); return pickD().filter(d0 => Lk.includes(d0)); })();
    const pay = ((c.rep || {})[f] || {}).pay; const N = achDetNum(Ls, c.grp);
    return { n: Ls.length, N, Cd, Dc, pay, ref: achFilRefOf(c, f) || c.ref, txt: "MADAME, MONSIEUR,\n\nMERCI DE NOUS TRANSMETTRE VOTRE MEILLEURE OFFRE POUR :\n" + N.map(o => o.title ? "\n" + o.no + " " + o.lab : o.no + " — " + o.l.des + " : " + achF2(o.l.q) + " " + (o.l.u || "")).join("\n")
      + (Cd.length || pay ? "\n\nCONDITIONS PARTICULIÈRES :\n" + Cd.map(cd => "- " + cd.lab + " : " + (cd.t === "date" ? achDFr(cd.v) : cd.v)).concat(pay && !Cd.some(cd => cd.k === "pay") ? ["- CONDITIONS DE PAIEMENT : " + pay] : []).join("\n") : "")
      + (Dc.length ? "\n\nDOCUMENTS JOINTS : " + Dc.map(x => x.title || x.ref).join(", ") : "") + "\n\nMERCI DE RAPPELER LA RÉFÉRENCE " + (achFilRefOf(c, f) || c.ref) + " DANS VOTRE DEVIS.\n\nCORDIALEMENT." }; };
  const draw = () => { d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: "ENVOYER LA CONSULTATION — " + esc(c.ref),
    body: `<table class="prm-table frs-sub"><thead><tr><th>BLOC</th><th class="center">TOUS</th><th class="center">LES COCHÉS</th></tr></thead><tbody>${B.map(([k, l]) => `<tr><td>${l}</td><td class="center"><input type="radio" name="snd${k}" data-sm="${k}" value="all"${M[k] === "all" ? " checked" : ""}></td><td class="center"><input type="radio" name="snd${k}" data-sm="${k}" value="ck"${M[k] === "ck" ? " checked" : ""}${CK[k].length ? "" : " disabled"}> ${svCnt(CK[k].length)}</td></tr>`).join("")}</tbody></table>
      <div class="frs-st">BORDEREAU DE CHAQUE FOURNISSEUR (SES DÉTAILS LIÉS — AUCUN PRIX ENVOYÉ)</div>
      <table class="prm-table frs-sub"><thead><tr><th>CONSULTATION PAR FOURNISSEUR</th><th>FOURNISSEUR</th><th>E-MAIL</th><th class="center">DÉTAILS</th><th></th></tr></thead><tbody>${pickF().map(f => { const F = achFrs().find(y => y.id === f) || {}, em = ((F.cte || []).find(y => y.email) || {}).email || "";
        return `<tr><td>${esc(achFilRefOf(c, f))} · <span style="color:var(--st-${achFilSt(c, f)}, ${({ instance: "#b91c1c", remis: "#ea580c", renvoyer: "#CA8A04", valide: "#172033", annule: "#9ca3af" })[achFilSt(c, f)]})">${esc(ACH_FIL_ST[achFilSt(c, f)])}</span></td><td>${esc(achFrsNom(f))}</td><td>${esc(em || "—")}</td><td class="center">${svCnt(txtOf(f).n)}</td><td>${em ? `<button type="button" class="ach-b" data-send="${esc(f)}">ENVOYER</button>` : ""}</td></tr>`; }).join("")}</tbody></table>`,
    foot: `<button type="button" class="svc-b" data-x>FERMER</button>` }); if (!d.isConnected) sviWinShow(d); };
  draw();
  d.addEventListener("change", e => { const r = e.target.closest("[data-sm]"); if (r) { M[r.dataset.sm] = r.value; draw(); } });
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
    const sb = e.target.closest("[data-send]"); if (!sb) return; const f = sb.dataset.send, F = achFrs().find(y => y.id === f) || {}, em = ((F.cte || []).find(y => y.email) || {}).email || "", T = txtOf(f);
    if (!T.n) { svToast("AUCUN DÉTAIL POUR CE FOURNISSEUR.", 2500, sb); return; }
    location.href = "mailto:" + encodeURIComponent(em) + "?subject=" + encodeURIComponent("CONSULTATION " + (achFilRefOf(c, f) || c.ref) + (c.objet ? " — " + c.objet : "")) + "&body=" + encodeURIComponent(T.txt);
    achCafSendPdf(c, f, T, redraw);   /* v1123 (L21) : PDF du fournisseur classé dans SUIVI › DOCUMENTS */
    /* série H : la fille est ENVOYÉE ; son empreinte est gardée (un changement de ses articles la met À RENVOYER) */
    achCafSaveOne(id, x => { const t0 = achNow(); x.rep[f] = { ...(x.rep[f] || {}), env: t0 }; x.fil[f] = { ...(x.fil[f] || {}), env: t0, sig: achFilSig(x, f) }; }, "ENVOYÉE À " + achFrsNom(f) + " (" + achFilRefOf(c, f) + ")"); sb.textContent = "ENVOYÉ"; });
}
/* v1123 (L21) : à l'envoi, le PDF de la consultation de ce fournisseur (ses articles, ses conditions, ses documents joints, aucun prix)
   est rangé dans SUIVI › DOCUMENTS de la consultation (mise en page « ACH-CAF-ENV », réglable dans l'aperçu) ; il n'entre pas dans
   les DOCUMENTS ENVOYÉS (c.dhide) — c'est une trace de l'envoi, pas une pièce jointe à renvoyer */
async function achCafSendPdf(c, f, T, redraw) { const nom = achFrsNom(f);
  const D = { key: "ACH-CAF-ENV", title: "CONSULTATION", ref: T.ref, party: nom, date: achDFr(achNow()),
    cols: [["no", "ARTICLE", "center"], ["des", "DÉSIGNATION", ""], ["u", "U", "center"], ["q", "QUANTITÉ", "number"]],
    rows: T.N.map(o => o.title ? [o.no, o.lab, "", ""] : [o.no, o.l.des || "", o.l.u || "", achF2(o.l.q)]),
    note: [(T.Cd.length || T.pay ? "CONDITIONS PARTICULIÈRES :\n" + T.Cd.map(cd => "- " + cd.lab + " : " + (cd.t === "date" ? achDFr(cd.v) : cd.v)).concat(T.pay && !T.Cd.some(cd => cd.k === "pay") ? ["- CONDITIONS DE PAIEMENT : " + T.pay] : []).join("\n") : ""),
      T.Dc.length ? "DOCUMENTS JOINTS : " + T.Dc.map(x => x.title || x.ref).join(", ") : "", "MERCI DE RAPPELER LA RÉFÉRENCE " + T.ref + " DANS VOTRE DEVIS."].filter(Boolean).join("\n\n") };
  const title = "CONSULTATION " + T.ref + " — " + nom, name = title.replace(/[\\/:*?"<>|]+/g, "-").trim() + ".pdf";   /* v1124 : vrai intitulé au SUIVI, nom nettoyé pour le fichier seulement */
  try { const blob = await sviMep.pdf(D), r = await achRecBlock(c.ref).savePdf(blob, name, title);
    achCafSaveOne(c.id, x => { x.dhide = [...new Set((x.dhide || []).concat([r]))]; });
    svToast("PDF DE " + nom + " CLASSÉ DANS SUIVI › DOCUMENTS (" + r + ").", 3500);
    if (typeof redraw === "function") redraw(); }
  catch (e) { svToast("ENVOI FAIT, MAIS LE PDF DE " + nom + " N'A PAS PU ÊTRE CRÉÉ (CONNEXION ?).", 5000); } }
/* fenêtre i de la consultation — 11/11 (Ahmed, validé, document unique 10.2 modifiée) : à la création comme à la réouverture,
   DATE DE CRÉATION (remplie seule), OBJET, puis quatre blocs : ARTICLES CONSULTÉS (besoin, article, unité, quantité ; IMPORTER),
   FOURNISSEURS CONSULTÉS, DOCUMENTS ENVOYÉS, CONDITIONS PARTICULIÈRES (avec valeur). Besoin choisi parmi les existants (jamais créé ici) ;
   article ou fournisseur inconnu = créé au nom tapé, EN INSTANCE, « CRÉÉ DEPUIS LA CONSULTATION » (fournisseur occasionnel : ni ICE ni RIB exigés).
   ENREGISTRER crée ou met à jour la consultation puis sa page s'ouvre ; liaisons (rond) dans la page ; consultation close = lecture seule. */
function achCafInfo(id, done) { const L0 = achCaf(), c0 = id ? L0.find(x => x.id === id) : null; if (id && !c0) return;
  /* 11/11 (Ahmed, validé) : forme du bloc TÂCHES / DÉSIGNATIONS CLIENT — un bloc CONSULTATION, quatre listes côte à côte (ARTICLES, FOURNISSEURS,
     DOCUMENTS, CONDITIONS) : ronds de liaison, loupe par colonne (tri, filtre, masquer), titres glissés = ordre des colonnes, bords tirés = largeur,
     case d'en-tête et cases des lignes, ligne CRÉER … ICI ; ⋯ du bloc : IMPORTER, SUPPRIMER LES COCHÉS, MODIFIER LE FORMAT */
  const ro = !!c0 && c0.state !== "ouverte", d = sviWinNew(), dis = ro ? " disabled" : "";
  const C = JSON.parse(JSON.stringify(c0 || { objet: "", lignes: [], frs: [] })); if (!c0) { C.lignes = []; C.frs = []; } achCafUp(C);
  const code0 = c0 ? (c0.ref || c0.code) : "";
  const BSN = achBsnOpen(), BS = new Map(achBsn().map(b => [b.id, b])), ARTS = achArts().filter(a => !a.del), FRS = achFrs().filter(f => !f.del);
  const docs0 = code0 ? (achJ("svi_docs_v1:ACH-" + code0, []) || []).map((d0, i) => ({ ...d0, __id: d0.ref || "d" + i })) : [];
  const S = { L: C.lignes.map(l => ({ ...l })), F: C.frs.map(f => ({ k: f, id: f, nom: achFrsNom(f) })), D: docs0.filter(x => !(C.dhide || []).includes(x.__id)).map(x => ({ ...x, k: x.__id })), Dh: [],
    K: (C.cond || []).map(x => ({ ...x })), lk: {}, sel: null };
  ["lf", "ld", "lc", "fd", "fc"].forEach(o => { S.lk[o] = JSON.parse(JSON.stringify(C[o] || {})); });
  /* v1115 (Ahmed) : une ligne en cours de création (encore vide) cache la ligne « CRÉER … ICI » de sa liste */
  const EMPTY = { L: () => S.L.some(r => !r.des && !r.bsn), F: () => S.F.some(r => !r.nom), D: () => false, K: () => S.K.some(r => r.k === "autre" && !r.lab) };
  /* v1126 (L6 – L8) : moteur de liaisons commun sur les cartes de la fenêtre (S.lk) — enregistrées avec ENREGISTRER */
  const LKW = achCafLk("cai:" + (id || "new"), () => S.lk, (g, k) => (LST[g] ? LST[g]() : []).some(r => kOf(g, r) === k), { L: ["ARTICLE", "ARTICLES"], F: ["FOURNISSEUR", "FOURNISSEURS"], D: ["DOCUMENT", "DOCUMENTS"], K: ["CONDITION", "CONDITIONS"] });
  LKW.clear();
  const rdSt = (g, k) => LKW.state(g, k);
  const LST = { L: () => S.L, F: () => S.F, D: () => S.D, K: () => S.K };
  const COLS = {
    L: [["bsn", "BESOIN", r => { const b = BS.get(r.bsn); return b ? b.ref : ""; }], ["des", "ARTICLES", r => r.des || ""], ["u", "U", r => r.u || "", "center"], ["q", "QTÉ", r => r.q === "" || r.q === undefined ? "" : achN(r.q), "number"]],
    F: [["nom", "FOURNISSEURS", r => r.nom || ""]], D: [["title", "DOCUMENTS", r => (r.title || r.ref || "")]], K: [["lab", "CONDITIONS", r => r.lab || ""], ["v", "VALEUR", r => r.v || ""]] };
  const NEW = { L: "CRÉER UN ARTICLE ICI…", F: "CRÉER UN FOURNISSEUR ICI…", D: "CRÉER UN DOCUMENT ICI…", K: "CRÉER UNE CONDITION ICI…" };
  const KIT = sviCfKit({ key: "cai", shell: d, refresh: () => draw() });
  const kOf = (g, r) => g === "L" ? r.id : g === "F" ? r.k : g === "D" ? r.k : r.id;
  const opt = (v, t, sel) => `<option value="${esc(v)}"${sel ? " selected" : ""}>${esc(t)}</option>`;
  /* 11/11 : cases au format des listes du budget — texte affiché ; 1er toucher = case choisie, 2e = saisie (sur plusieurs lignes), liste de choix = menu */
  const ED = { L: ["bsn", "des", "u", "q"], F: ["nom"], D: ["title"], K: ["lab", "v"] };
  const shown = (g, k, r) => { if (g === "L" && k === "bsn") { const b = BS.get(r.bsn); return b ? b.ref + " — " + b.des : ""; } if (g === "L" && k === "q") return r.q === "" || r.q === undefined ? "" : achF2(r.q);
    if (g === "K" && k === "v") return r.t === "date" ? achDFr(r.v || "") : r.v || ""; return String(r[k] ?? ""); };
  const cell = (g, c, r, i) => { const k = c[0], cl = c[3] || "", v = shown(g, k, r);
    const canEd = !ro && (ED[g] || []).includes(k) && !(g === "F" && r.id) && !(g === "D" && r.fk) && !(g === "K" && k === "lab" && r.k !== "autre");
    const sel = (g === "L" && k === "bsn") || (g === "K" && k === "v" && r.t === "on");
    if (g === "F" && r.id) return `<td><span class="ach-link" data-nvgo="frs|${esc(r.id)}">${esc(r.nom)}</span></td>`;
    if (g === "D" && r.fk) return `<td><span class="ach-link cafp-doc" data-fk="${esc(r.fk)}">${esc(r.title || r.ref || "")}</span></td>`;
    const nw = (g === "F" && !r.id) || (g === "D" && !r.fk) ? ' <i class="cai-new">(NOUVEAU)</i>' : "";
    return `<td class="${cl}${canEd ? " nv-ed" : ""}"${canEd ? ` data-ed="${k}" data-g="${g}" data-i="${i}"${sel ? ' data-edsel="1"' : ""}` : ""} title="${esc(v)}">${esc(v)}${nw}</td>`; };
  const list = g => { const t = "cai_" + g, C0 = COLS[g], CO = coOrder(t, C0.map(c => [c[0], c[1], c[2], c[3] || ""])), R0 = LST[g]().map((r, i) => ({ ...r, __i: i })); let R = KIT.cfApply(t, CO, R0);
    /* v1119 (L12, F2) : articles groupés sous leurs titres (même numérotation que la page : 1, 2, 2.1…) — l'ordre des groupes, sauf tri choisi à la loupe */
    const GT = {}; if (g === "L" && (C.grp || []).length && S.L.some(l => l.g)) { const N = achDetNum(S.L, C.grp), inR = new Set(R.map(r => r.__i)), pos = new Map(); let cur = null;
      N.forEach((o, k) => { if (o.title) { cur = o; return; } pos.set(o.i, k); if (cur && inR.has(o.i)) { GT[o.i] = cur; cur = null; } });
      if (!(KIT.CF[t] && KIT.CF[t].sort)) R = R.slice().sort((a, b2) => (pos.get(a.__i) ?? 1e9) - (pos.get(b2.__i) ?? 1e9)); }
    /* largeurs : partagées dans la largeur de la liste, sauf celles réglées à la main (bord tiré) */
    const CW = cwLoad(), PR = { bsn: 1, des: 1.6, u: .75, q: .85, nom: 1, title: 1, lab: 1.3, v: 1 };
    const sum = CO.reduce((x, c) => x + (CW[t + "." + c[0]] ? 0 : PR[c[0]] || 1), 0) || 1;
    const WD = CO.map(c => { const w = CW[t + "." + c[0]]; return w ? w + "px" : Math.floor((PR[c[0]] || 1) / sum * 82) + "%"; });
    const cg = `<colgroup><col data-k="_rd" style="width:30px">${CO.map((c, j) => `<col data-k="${c[0]}" data-wd="${WD[j]}" style="width:${WD[j]}">`).join("")}<col data-k="_cb" style="width:32px"></colgroup>`
      /* largeurs tenues (les moteurs de largeur des pages ne s'appliquent pas à cette fenêtre) */
      + `<style>.cai-card .cai-t[data-svcw="${t}"]{width:100%!important;min-width:0!important}.cai-card .cai-t[data-svcw="${t}"] col:nth-child(1){width:30px!important}.cai-card .cai-t[data-svcw="${t}"] col:nth-child(${CO.length + 2}){width:32px!important}</style>`;
        const [cg1, st1] = cg.split("<style>"); return `<div class="cai-ls" data-g="${g}"><style>${st1}<table class="bdg-d-table rec-table cai-t" id="caiT${g}" data-svcw="${t}" style="width:100%">${cg1}<thead><tr><th class="cai-rdh">${LKW.rdAll(g)}</th>${CO.map(c => KIT.cfHead(t, c[0], c[1] + (c[0] === { L: "des", F: "nom", D: "title", K: "lab" }[g] ? " " + svCnt(R.length, R0.length) : ""), c[3])).join("")}${sviListCbTh()}</tr></thead>
      <tbody>${R.map(r => `${GT[r.__i] ? `<tr class="ins-title cai-gt svlk-gt-${esc(GT[r.__i].title.id)}"><td></td><td colspan="${CO.length}"><b>${esc(GT[r.__i].no + " " + GT[r.__i].lab)}</b></td><td class="center nvl-cbc"><input type="checkbox" class="nvl-cb cai-gcb" aria-label="Cocher le groupe"></td></tr>` : ""}<tr data-g="${g}" data-i="${r.__i}" class="${r.imp ? "cai-imp " : ""}${g === "L" && r.g ? "svlk-g-" + esc(r.g) + " " : ""}${LKW.rowCls(rdSt(g, kOf(g, r)))}"><td class="center"><button type="button" class="nvp-rd${(st => st ? " rd-" + st : "")(rdSt(g, kOf(g, r)))}" data-rg="${g}" data-rk="${esc(kOf(g, r))}" aria-label="Liaison"></button></td>${CO.map(c => cell(g, c, r, r.__i)).join("")}<td class="center nvl-cbc"><input type="checkbox" class="nvl-cb" aria-label="Cocher"${(S.ck[g] || new Set()).has(r.__i) ? " checked" : ""}></td></tr>`).join("")}
      ${ro || EMPTY[g]() ? "" : `<tr class="rec-new" data-cai-new="${g}"><td colspan="${CO.length + 2}">${NEW[g]}</td></tr>`}</tbody></table></div>`; };
  S.ck = {};
  const draw = () => { S.drawT = Date.now(); if (d.isConnected) ckRead(); const ob = d.querySelector('.cafi-x[data-k="objet"]'); if (ob) C.objet = achU(ob.value);
    d.innerHTML = sviWinCard({ st: c0 ? achPcSt("caf", c0) : "instance", cls: "frs-card caf-card caf-info cai-card",   /* v1121 (L2) : seule la couleur change selon l'état */ close: "data-x", title: "DÉTAIL CONSULTATION",   /* 11/11 (validé, 10.2) : même fenêtre à la création, en instance et validée (référence dans la barre) */
      body: `<div class="frs-g cafi-g">${achCreeFld(c0)}<label class="frs-f frs-w"><span>OBJET</span><input class="ins-in cafi-x" data-k="objet" value="${esc(C.objet || "")}"${dis} autocomplete="off"></label></div>
        <div class="bdg-d-block cai-blk${S.max ? " cai-blk-max" : ""}"><div class="bdg-d-block-title blk-head"><span class="ttl">CONSULTATION</span>${ro ? "" : `<span class="svlk-win">${LKW.bar()}</span>`}<span class="blk-tools"><button type="button" class="blk-btn blk-max-btn cai-max${S.max ? " on" : ""}" aria-label="Agrandir / réduire"></button>${ro ? "" : `<button type="button" class="blk-more cai-more" aria-label="Actions">⋯</button>`}</span></div>
        <div class="cai-grid">${["L", "F", "D", "K"].map(list).join("")}</div></div>
`,
      foot: `<button type="button" class="svc-b" data-x>ANNULER</button>${ro ? "" : `<button type="button" class="svc-b svc-ok svc-neutral" data-ok>${c0 ? "ENREGISTRER" : "CRÉER"}</button>`}` }); fltW(); };
  /* v1130 (L6 – L8, exception 6.4) : cases cochées = filtre des autres listes de la fenêtre (articles, fournisseurs, documents, conditions) */
  const fltW = () => { const rows = [...d.querySelectorAll("tr[data-g][data-i]")].map(tr => { const b = tr.querySelector("[data-rg]"); return b ? { tr, g: b.dataset.rg, id: b.dataset.rk, ck: !!tr.querySelector(".nvl-cb:checked") } : null; }).filter(Boolean);
    sviLkDomFilter(LKW, rows, "tr.cai-gt");
    /* v1133 : état de la case d'en-tête de chaque liste = lignes affichées seulement */
    /* v1136 (L8 A) : titre de groupe coché quand toutes les lignes affichées de son groupe le sont, à moitié sinon */
    d.querySelectorAll("tr.cai-gt").forEach(tt => { const m = String(tt.className).match(/\bsvlk-gt-(\S+)/), cb = tt.querySelector(".cai-gcb"); if (!m || !cb) return; const I = [...d.querySelectorAll("tr.svlk-g-" + CSS.escape(m[1]) + ":not(.svlk-hid) .nvl-cb")], k = I.filter(c => c.checked).length; cb.checked = k > 0 && k === I.length; cb.indeterminate = k > 0 && k < I.length; });
    d.querySelectorAll(".cai-t").forEach(t => { const all = t.querySelector(".nvl-all"); if (!all) return; const C = [...t.querySelectorAll("tbody tr[data-i]:not(.svlk-hid) .nvl-cb")], n = C.filter(c => c.checked).length; all.checked = n > 0 && n === C.length; all.indeterminate = n > 0 && n < C.length; }); };
  d.addEventListener("change", e => { if (!(e.target.matches && e.target.matches(".nvl-cb, .nvl-all"))) return;
    if (e.target.matches(".cai-gcb")) { const m = String(e.target.closest("tr").className).match(/\bsvlk-gt-(\S+)/); if (m) d.querySelectorAll("tr.svlk-g-" + CSS.escape(m[1]) + ":not(.svlk-hid) .nvl-cb").forEach(x => { x.checked = e.target.checked; x.closest("tr").classList.toggle("nvl-on", x.checked); }); }   /* v1136 (L8 A) */
    setTimeout(fltW, 0); });
  const sync = () => { d.querySelectorAll(".cai-x").forEach(i => { const g = i.dataset.g, k = i.dataset.k, o = (g === "L" ? S.L : S.K)[+i.dataset.i]; if (!o) return;
      if (g === "L" && k === "q") o.q = String(i.value).trim() === "" ? "" : achN(i.value); else if (g === "L" && k === "bsn") o.bsn = i.value || ""; else o[k] = k === "v" && i.type === "date" ? i.value : achU(i.value); });
    const ob = d.querySelector('.cafi-x[data-k="objet"]'); if (ob) C.objet = achU(ob.value); };
  /* suppression des lignes cochées (toutes les listes) : leurs liaisons partent avec elles ; un fournisseur qui a un devis est gardé */
  const ckRead = () => { S.ck = {}; d.querySelectorAll("tr[data-g] .nvl-cb:checked").forEach(x => { const tr = x.closest("tr"), A = S.ck[tr.dataset.g] = S.ck[tr.dataset.g] || new Set(); A.add(+tr.dataset.i); }); };
  const rmChecked = async () => { ckRead(); const n = Object.values(S.ck).reduce((a, x) => a + x.size, 0); if (!n) { svToast("COCHER D'ABORD LES LIGNES À SUPPRIMER (CASES À DROITE).", 3000); return; }
    const D0 = achDvf(), keepF = S.F.filter((f, i) => (S.ck.F || new Set()).has(i) && f.id && D0.some(v => v.caf === (c0 && c0.id) && v.frs === f.id && v.state !== "annule"));
    const lab = g => [...(S.ck[g] || [])].map(i => LST[g]()[i]).filter(Boolean).filter(r => !keepF.includes(r)).map(r => "- " + (r.des || r.nom || r.title || r.lab || ""));
    const all = ["L", "F", "D", "K"].flatMap(lab); if (!all.length) { svToast("GARDÉ(S) : FOURNISSEUR AVEC DEVIS.", 3000); return; }
    if (!(await sub(() => svConfirm({ title: "SUPPRIMER LES LIGNES COCHÉES", html: all.map(x => `<div>${esc(x)}</div>`).join("") + (keepF.length ? `<div style="margin-top:12px">GARDÉ(S) (DEVIS REÇU) : ${esc(keepF.map(f => f.nom).join(", "))}</div>` : ""), ok: "SUPPRIMER" })))) return;
    const gone = { L: new Set(), F: new Set(), D: new Set(), K: new Set() };
    ["L", "F", "D", "K"].forEach(g => [...(S.ck[g] || [])].forEach(i => { const r = LST[g]()[i]; if (r && !keepF.includes(r)) gone[g].add(kOf(g, r)); }));
    S.Dh = S.Dh.concat(S.D.filter(x => gone.D.has(x.k) && x.fk && x.__id).map(x => x.__id));
    S.L = S.L.filter(r => !gone.L.has(r.id)); S.F = S.F.filter(r => !gone.F.has(r.k)); S.D = S.D.filter(r => !gone.D.has(r.k)); S.K = S.K.filter(r => !gone.K.has(r.id));
    const G = { lf: ["L", "F"], ld: ["L", "D"], lc: ["L", "K"], fd: ["F", "D"], fc: ["F", "K"] };
    Object.keys(G).forEach(o => { const M = S.lk[o] || {}, [ga, gb] = G[o]; Object.keys(M).forEach(a => { if (gone[ga].has(a)) { delete M[a]; return; } M[a] = (M[a] || []).filter(b => !gone[gb].has(b)); }); });
    S.ck = {}; draw(); };   /* v1126 : une ligne choisie supprimée sort des choix (moteur commun, alive) */
  /* une seule fenêtre à la fois (#svConf) : une fenêtre ouverte depuis celle-ci la remplace le temps de la réponse, puis celle-ci revient telle quelle */
  const sub = async fn => { sync(); d.remove(); try { return await fn(); } finally { document.getElementById("svConf")?.remove(); document.body.appendChild(d); } };
  const subWin = open => sub(() => new Promise(ok => { open(); const t0 = Date.now(); const tm = setInterval(() => { if (Date.now() - t0 > 300 && !document.getElementById("svConf")) { clearInterval(tm); ok(); } }, 250); }));
  /* largeurs tenues : les colonnes reprennent leur part de la liste, sauf une largeur tirée à la main (gardée) */
  const hold = () => { if (d.querySelector(".col-rs.on")) return; const CW = cwLoad(); d.querySelectorAll(".cai-t col[data-wd]").forEach(c => { const t = c.closest("table").dataset.svcw; if (CW[t + "." + c.dataset.k]) { c.style.width = CW[t + "." + c.dataset.k] + "px"; return; } if (c.style.width !== c.dataset.wd) c.style.width = c.dataset.wd; }); };
  new MutationObserver(() => requestAnimationFrame(hold)).observe(d, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
  ["L", "F", "D", "K"].forEach(g => { (window.__sviNvEdMods = window.__sviNvEdMods || {})["cai_" + g] = async (v, tds) => { let lines = [""];
      if (v === "paste") { let t = ""; try { t = await navigator.clipboard.readText(); } catch (er) {} if (!t) t = window.__sviSelClip || ""; lines = String(t).split(/\r?\n/).map(z => z.split("\t")[0].trim()).filter(Boolean); if (!lines.length) return; }
      tds.forEach((td, n) => { const r = LST[td.dataset.g]()[+td.dataset.i], k = td.dataset.ed; if (!r || !k || td.dataset.edsel) return; const w = lines[Math.min(n, lines.length - 1)] || "";
        if (k === "q") r.q = w === "" ? "" : achN(w); else r[k] = achU(w); }); draw(); }; });
  draw(); sviWinShow(d);
  /* menu de suggestions (articles, fournisseurs) sous la case en saisie — menu de l'application, filtré au fil de la frappe */
  let SUG = null; const sugOff = () => { if (SUG) { SUG.remove(); SUG = null; } };
  const sugOn = (tip, items, pickFn) => { const paint = () => { if (!tip.isConnected) { sugOff(); return; } const q = achU(tip.textContent || "").trim(), L = items.filter(x => !q || achU(x.lab).includes(q)).slice(0, 12);
      if (!L.length) { sugOff(); return; } if (!SUG) { SUG = document.createElement("div"); SUG.id = "caiSug"; SUG.className = "svi-stf-menu cai-sug"; document.body.appendChild(SUG); }
      SUG.innerHTML = L.map((x, n) => `<button type="button" data-n="${n}"><b>${esc(x.lab)}</b>${x.sub ? `<span>${esc(x.sub)}</span>` : ""}</button>`).join(""); SUG.__L = L;
      /* v1115 : menu lisible — 8 lignes au plus (défilement), ouvert au-dessus de la case s'il n'y a pas la place dessous */
      const r = tip.getBoundingClientRect(); Object.assign(SUG.style, { left: Math.max(4, Math.min(r.left, innerWidth - 260)) + "px", minWidth: r.width + "px", top: "0px", bottom: "auto" });
      const h = SUG.getBoundingClientRect().height, below = innerHeight - r.bottom - 6; SUG.style.top = (h > below && r.top - 6 > below ? Math.max(4, r.top - 2 - h) : r.bottom + 2) + "px"; };
    const pk = x => { tip.textContent = x.lab; pickFn(x); };   /* v1115 : aucun menu au départ (liste vide) = plus d'erreur */
    paint(); if (SUG) SUG.__pick = pk; tip.addEventListener("input", () => requestAnimationFrame(() => { paint(); if (SUG) SUG.__pick = pk; }));
  };
  window.addEventListener("pointerdown", e => { const b = SUG && e.target.closest && e.target.closest("#caiSug [data-n]"); if (!b) return; e.preventDefault(); const x = SUG.__L[+b.dataset.n]; SUG.__pick(x); }, true);
  const editCell = td => { const g = td.dataset.g, k = td.dataset.ed, i = +td.dataset.i, r = LST[g]()[i]; if (!r) return;
    if (td.dataset.edsel) { const O = g === "L" ? [{ k: "", lab: "—" }].concat(BSN.map(b => ({ k: b.id, lab: b.ref + " — " + b.des + " (" + achF2(b.q) + " " + b.u + ")" }))) : ["", "OUI", "NON"].map(v => ({ k: v, lab: v || "—" }));
      sviEtatMenu(td, O, String(g === "L" ? r.bsn || "" : r.v || ""), nv => { if (g === "L") { r.bsn = nv; const b = BS.get(nv); if (b) { r.des = b.des; r.u = b.u; r.q = achN(b.q); } } else r.v = nv; draw(); }); return; }
    const v0 = g === "K" && k === "v" && r.t === "date" ? achDFr(r.v || "") : g === "L" && k === "q" ? (r.q === "" || r.q === undefined ? "" : String(r.q).replace(".", ",")) : String(r[k] ?? "");
    let pick = null;
    const tip = window.sviTaEdit(td, v0, (ok, v) => { sugOff(); const dropL = () => { S.L = S.L.filter(x => x !== r); Object.values(S.lk).forEach(M => { delete M[r.id]; }); };   /* ligne d'article vide retirée */
      if (!ok) { if (g === "L" && !r.des && !r.bsn) dropL(); if (g === "F" && !r.nom) S.F = S.F.filter(x => x !== r); if (g === "K" && !r.lab) S.K = S.K.filter(x => x !== r); draw(); return; }
      if (g === "L" && k === "q") r.q = String(v).trim() === "" ? "" : achN(v);
      else if (g === "K" && k === "v" && r.t === "date") r.v = (typeof cfDate === "function" && cfDate(v)) || v;
      else if (g === "F") { const nom = achU(v); if (!nom) { if (!r.nom) S.F = S.F.filter(x => x !== r); draw(); return; } const f = FRS.find(x => achU(x.nom) === nom);
        if (S.F.some(x => x !== r && ((f && x.id === f.id) || achU(x.nom) === nom))) { svToast("DÉJÀ DANS LA CONSULTATION.", 2500); if (!r.nom) S.F = S.F.filter(x => x !== r); draw(); return; }
        r.nom = f ? f.nom : nom; if (f) { const old = r.k; r.id = f.id; r.k = f.id; Object.values(S.lk).forEach(M => { if (M[old]) { M[f.id] = M[old]; delete M[old]; } Object.keys(M).forEach(a => { M[a] = (M[a] || []).map(b => b === old ? f.id : b); }); }); LKW.rename("F", old, f.id); } }
      else if (g === "L" && k === "des" && achU(v) && S.L.some(x => x !== r && achU(x.des) === achU(v))) { svToast("ARTICLE DÉJÀ DANS LA CONSULTATION.", 2500); if (!r.des && !r.bsn) dropL(); draw(); return; }   /* v1115 : pas d'article en double */
      else if (g === "L" && k === "des" && !achU(v) && !r.bsn) { dropL(); draw(); return; }
      else if (g === "K" && k === "lab" && r.k === "autre" && !achU(v)) { S.K = S.K.filter(x => x !== r); draw(); return; }   /* v1116 : condition laissée vide retirée, CRÉER revient */
      else { r[k] = achU(v); if (g === "L" && k === "des") { const a = (pick && achU(pick.lab) === achU(v)) ? pick.a : ARTS.find(y => achU(y.des) === achU(v)); if (a && (!r.u || pick)) r.u = a.u || r.u; } }
      if (g === "K" && k === "lab" && r.lab) { const P = achPrm(), Lp = achClP(P); if (!Lp.some(y => achU(y.txt) === r.lab)) { P.clP = Lp.concat([{ id: "p" + Date.now().toString(36), t: "autre", txt: r.lab }]); achPrmSave(P); } }
      draw(); });
    if (tip && g === "L" && k === "des") sugOn(tip, ARTS.filter(a => !S.L.some(x => x !== r && achU(x.des) === achU(a.des))).map(a => ({ lab: a.des, sub: a.u || "", a })), x => { pick = x; });
    /* v1121 (L16) : le catalogue des CONDITIONS PARTICULIÈRES (PARAMÉTRAGE › ACHATS › CONSULTATIONS) alimente le menu de la condition */
    if (tip && g === "K" && k === "lab") { const have = new Set(S.K.filter(y => y !== r).map(y => achU(y.lab))); sugOn(tip, achClP(achPrm()).map(c => achU(c.txt) || ((ACH_CLT.find(t => t[0] === c.t) || [])[1] || "")).filter(l => l && !have.has(l)).filter((l, i, A) => A.indexOf(l) === i).map(l => ({ lab: l })), () => {}); }
    if (tip && g === "F") sugOn(tip, FRS.filter(f => !S.F.some(x => x.id === f.id)).map(f => ({ lab: f.nom, sub: f.ville || "" })), () => {}); };
  const pickCell = td => { d.querySelectorAll("td.nv-sel").forEach(x => x.classList.remove("nv-sel")); td.classList.add("nv-sel"); if (!td.hasAttribute("tabindex")) td.setAttribute("tabindex", "-1"); td.classList.add("svi-tdf"); try { td.focus({ preventScroll: true }); } catch (er) {} };
  /* glisser un titre de colonne = ordre des colonnes de cette liste (gardé) */
  d.addEventListener("pointerdown", e => { const th = e.target.closest && e.target.closest(".cai-t thead th"); if (!th || e.target.closest(".cf-btn, .col-rs, input") || !th.querySelector(".cf-btn")) return;
    const table = th.closest("table"), t = th.querySelector(".cf-btn").dataset.cf, ths = () => [...table.querySelectorAll("thead tr:first-child > th")].filter(x => x.querySelector(".cf-btn"));
    const x0 = e.clientX; let on = false, target = null, ghost = null; const arm = sviColArm(e, th); const clear = () => ths().forEach(x => x.classList.remove("co-before", "co-after"));
    const mv = ev => { if (!on) { if (Math.abs(ev.clientX - x0) < 8) return; if (!arm(ev)) return; on = true; th.classList.add("co-src"); ghost = document.createElement("div"); ghost.id = "coGhost"; ghost.textContent = (th.querySelector(".cf-lt")?.textContent || "").trim(); document.body.appendChild(ghost); }
      ev.preventDefault(); ghost.style.left = ev.clientX + 8 + "px"; ghost.style.top = ev.clientY - 28 + "px"; clear(); target = null;
      const L = ths(); for (const x of L) { const r = x.getBoundingClientRect(); if (ev.clientX >= r.left && ev.clientX < r.right) { if (x !== th) { x.classList.add(L.indexOf(x) > L.indexOf(th) ? "co-after" : "co-before"); target = x; } break; } } };
    const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up); clear(); th.classList.remove("co-src"); ghost && ghost.remove();
      if (!on || !target) return; sync(); const kf = x => x.querySelector(".cf-btn").dataset.col, keys = ths().map(kf), from = keys.indexOf(kf(th)), to = keys.indexOf(kf(target)); const [k] = keys.splice(from, 1); keys.splice(to, 0, k);
      const all = coLoad(); all[t] = keys; coSave(all); d.addEventListener("click", ev => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true }); draw(); };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up); });
  d.addEventListener("click", async e => {
    if (e.target === d && Date.now() - (S.drawT || 0) < 600) return;   /* v1122 : clic d'un double toucher reporté sur le fond après un redessin (AGRANDIR / RÉDUIRE) — la fenêtre ne se ferme pas */
    if (e.target === d || e.target.closest("[data-x]")) { KIT.cfClose(); d.remove(); if (done) done(); return; }
    const cfb = e.target.closest(".cf-btn[data-cf]"); if (cfb) { e.stopPropagation(); sync(); KIT.cfOpenMenu(cfb); return; }
    if (e.target.closest(".cafp-doc")) { achCopyOpen(e.target.closest(".cafp-doc").dataset.fk); return; }
    /* v1115 (Ahmed) : consultation close — toucher un rond le choisit pour VOIR ses liaisons (rien n'est lié ni délié) */
    /* v1119 (L4, règle 4.2) : AGRANDIR / RÉDUIRE du bloc CONSULTATION (⋯ ou double toucher sur sa barre de titre) */
    if (e.target.closest(".cai-max")) { sync(); S.max = !S.max; draw(); return; }
    /* v1132 (L6 – L8) : rond d'en-tête de chaque liste = tout choisir / tout libérer (lignes affichées) */
    { const ra = e.target.closest("[data-rdall]"); if (ra) { const g = ra.dataset.rdall; sync();
      if (LKW.hand(g)) { svToast("UNE LIGNE DE CETTE LISTE EST DÉJÀ CHOISIE À LA MAIN — LA LIBÉRER D'ABORD.", 3000, ra); return; }
      LKW.setAll(g, [...d.querySelectorAll(`tr[data-g="${g}"]:not(.svlk-hid) [data-rg]`)].map(b => b.dataset.rk), !LKW.allOn(g)); draw(); return; } }
    if (ro) { const rr = e.target.closest("[data-rg]"); if (rr) { LKW.toggle(rr.dataset.rg, rr.dataset.rk); draw(); return; }
      if (e.target.closest("[data-ok]")) { d.remove(); if (done) done(); } return; }
    const ed = e.target.closest("td.nv-ed"); if (ed && d.contains(ed)) { if (ed.classList.contains("nv-sel")) editCell(ed); else pickCell(ed); return; }
    /* v1126 (L6 – L8) : le rond choisit ou libère (plusieurs lignes par liste) ; ✓ LIER / ✕ DÉLIER en haut à droite du bloc */
    const rd = e.target.closest("[data-rg]"); if (rd) { sync(); LKW.toggle(rd.dataset.rg, rd.dataset.rk); draw(); return; }
    const lb = e.target.closest("[data-svlk]"); if (lb) { sync(); await LKW.apply(lb.dataset.svlk, (L, on) => sviLkWrite(S.lk, L, on), ask => sub(ask)); draw(); return; }
    const mo = e.target.closest(".cai-more"); if (mo) { e.stopPropagation(); sync();
      sviHdrMenu(mo, [[{ k: "max", lab: S.max ? "RÉDUIRE" : "AGRANDIR" }], [{ k: "imp", lab: "IMPORTER DES ARTICLES" }], [{ k: "__fmt", lab: "MODIFIER LE FORMAT" }], [{ k: "rm", lab: "SUPPRIMER LES COCHÉS", del: true }]], async a => {
        if (a === "max") { S.max = !S.max; draw(); return; }
        if (a === "__fmt") { await subWin(() => sviFmtCurWin()); draw(); return; } if (a === "rm") { rmChecked(); return; }
        if (a === "imp") { const R = await sub(() => achCafImpRead(S.D.filter(x => x.fk), c0 && c0.id)); if (!R) return; let g = null; const G = C.grp = C.grp || [];
          R.rows.forEach(r => { if (r.title) { g = { id: achCafId(), lab: achU(r.title) }; G.push(g); return; } const ar = achArtOf(r.des, r.u), lid = achCafId(); S.L.push({ id: lid, bsn: "", des: ar ? ar.des : achU(r.des), u: ar ? ar.u : achU(r.u), q: r.q, imp: true, ...(g ? { g: g.id } : {}) }); S.lk.lf[lid] = S.F.map(f => f.k); });
          if (R.file) { const k = "n" + Date.now().toString(36); S.D.push({ k, title: "IMPORT — " + R.file.name, f: R.file }); } const n = R.rows.filter(r => !r.title).length;
          svToast(n ? n + " ARTICLE(S) IMPORTÉ(S) : À VÉRIFIER DANS LA PAGE (EN ROUGE) PUIS CONFIRMER." : "AUCUNE LIGNE RECONNUE DANS « " + R.from + " ».", 4000); draw(); } }); return; }
    const nw = e.target.closest("[data-cai-new]"); if (nw) { sync(); const g = nw.dataset.caiNew;
      const go = (gg, kk) => { const td = d.querySelector(`#caiT${gg} td.nv-ed[data-i="${LST[gg]().length - 1}"][data-ed="${kk}"]`); if (td) { pickCell(td); editCell(td); } };
      if (g === "L") { const lid = achCafId(); S.L.push({ id: lid, bsn: "", des: "", u: "", q: "" }); S.lk.lf[lid] = S.F.map(f => f.k); draw(); go("L", "des"); return; }
      if (g === "F") { const k = "n:" + Date.now().toString(36); S.F.push({ k, id: "", nom: "" }); S.L.forEach(l => { const A = S.lk.lf[l.id] = S.lk.lf[l.id] || []; if (!A.includes(k)) A.push(k); }); draw(); go("F", "nom"); return; }
      if (g === "D") { const f = await new Promise(ok => { const i = document.createElement("input"); i.type = "file"; i.onchange = () => ok(i.files[0] || null); i.click(); }); if (!f) return;
        S.D.push({ k: "n" + Date.now().toString(36), title: achU(f.name.replace(/\.[^.]+$/, "")), f }); draw(); go("D", "title"); return; }
      if (g === "K") { S.K.push({ id: achCafId(), k: "autre", lab: "", t: "text", v: "" }); draw(); go("K", "lab"); return; }
      return; }
    if (!e.target.closest("[data-ok]")) return;
    sync(); const now = achNow(), Lc = achCaf(); KIT.cfClose();
    let c = c0 ? Lc.find(x => x.id === id) : null;
    if (!c) { c = { id: "C" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ref: achNextRef("CAF", Lc), objet: C.objet, date: now.slice(0, 10), dlim: "", lignes: [], frs: [], rep: {}, state: "ouverte", cree: now }; achCafUp(c); Lc.push(c); }
    const ref = c.ref, AL = achArts(); let na = 0;
    S.L.filter(l => achU(l.des)).forEach(l => { if (!achArtOf(l.des, l.u)) { const a = achArtNew(AL, { des: l.des, u: l.u, src: "CONSULTATION " + ref }); a.st = "instance"; a.fromCaf = ref; achHist(a.code, "CRÉATION", "CRÉÉ DEPUIS LA CONSULTATION " + ref); na++; } }); if (na) achArtsSave(AL);
    S.F = S.F.filter(f => f.id || achU(f.nom)); S.K = S.K.filter(x => achU(x.lab)); const FL = achFrs(), KM = {}; let nf = 0; S.F.forEach(f => { if (f.id) { KM[f.k] = f.id; return; } const n = achFrsNew(FL, { nom: f.nom, occ: true }); n.st = "instance"; n.fromCaf = ref; f.id = n.id; KM[f.k] = n.id; achHist(n.code, "CRÉATION", "CRÉÉ DEPUIS LA CONSULTATION " + ref); nf++; }); if (nf) achFrsSave(FL);
    const DM = {}; S.D.forEach(x => { if (x.__id) DM[x.k] = x.__id; }); for (const x of S.D.filter(y => y.f)) { try { const dx = await achCafDocAdd(ref, x.f, x.title); DM[x.k] = dx.ref; } catch (er) {} }
    const LIDS = new Set(S.L.filter(l => achU(l.des)).map(l => l.id)), KIDS = new Set(S.K.map(x => x.id)), mapK = { L: k => LIDS.has(k) ? k : null, F: k => KM[k] || null, D: k => DM[k] || null, K: k => KIDS.has(k) ? k : null };
    const G = { lf: ["L", "F"], ld: ["L", "D"], lc: ["L", "K"], fd: ["F", "D"], fc: ["F", "K"] };
    Object.keys(G).forEach(o => { const [ga, gb] = G[o], M = {}; Object.keys(S.lk[o] || {}).forEach(a => { const A = mapK[ga](a); if (!A) return; const B = (S.lk[o][a] || []).map(mapK[gb]).filter(Boolean); if (B.length) M[A] = [...new Set(B)]; }); c[o] = M; });
    const oldF = c.frs || [], newF = S.F.map(f => f.id); oldF.filter(f => !newF.includes(f)).forEach(f => { delete (c.rep || {})[f]; });
    c.objet = C.objet; c.frs = newF; const old = new Map((c.lignes || []).map(l => [l.id, l]));
    c.lignes = S.L.filter(l => achU(l.des)).map(l => { const o = old.get(l.id) || {}, a = achArtOf(l.des, l.u); return { ...o, id: l.id, bsn: l.bsn || "", des: a ? a.des : achU(l.des), u: a ? a.u : achU(l.u), q: l.q === "" ? "" : achN(l.q), ...(l.imp ? { imp: true } : {}), ...(l.g ? { g: l.g } : {}) }; });
    c.lignes.forEach(l => { if (!Array.isArray(c.lf[l.id])) c.lf[l.id] = []; });
    c.grp = (C.grp || c.grp || []).filter(g => c.lignes.some(l => l.g === g.id)); c.cond = S.K;
    c.dhide = [...new Set((c.dhide || []).concat(S.Dh))]; c.mod = now; achCafUp(c); achCafSave(Lc); achHist(ref, c0 ? "MODIFICATION" : "CRÉATION", c.objet);
    if (na || nf) svToast((na ? na + " ARTICLE(S)" : "") + (na && nf ? " ET " : "") + (nf ? nf + " FOURNISSEUR(S)" : "") + " CRÉÉ(S) EN INSTANCE (DEPUIS LA CONSULTATION).", 3500);
    d.remove(); if (done) done(); });
}

/* F1 (série F) : déplacer des détails d'un cran (la numérotation se refait seule, sans trou) ; un détail groupé reste dans son groupe */
function achDetMove(L, ids, dir) { const A = L.slice(), sel = new Set(ids), idx = A.map((l, i) => sel.has(l.id || i) ? i : -1).filter(i => i >= 0);
  (dir < 0 ? idx : idx.reverse()).forEach(i => { let j = i + dir; while (j >= 0 && j < A.length && (A[j].g || "") !== (A[i].g || "") && A[i].g) j += dir; if (j < 0 || j >= A.length || sel.has(A[j].id || j)) return; const t = A[i]; A[i] = A[j]; A[j] = t; });
  return A; }
/* F8 (série F) : CLÔTURER sur la page — total HT de chaque fournisseur avec les prix retenus (un prix par détail, choisi s'il y en a plusieurs),
   choix du RETENU, motif s'il n'est pas le moins cher ; circuit de validation ; les devis du retenu sont RETENUS, les autres REJETÉS ;
   les besoins des détails chiffrés par le retenu deviennent couverts */
function achCafClose(id, done) { const c0 = achCaf().find(y => y.id === id); if (!c0) return; achCafUp(c0); const D = achDvf();
  const F = (c0.frs || []).filter(f => D.some(v => v.caf === id && v.frs === f && v.state !== "annule"));
  const R = F.map(f => { let ht = 0, n = 0, wait = 0, use = new Set(); c0.lignes.forEach(l => { if (!((c0.lf || {})[l.id] || []).includes(f)) return; const p = achCafPrice(c0, f, l, D);
    if (p.st === "ok") { ht += achN(l.q) * achN(p.p.y.pu); n++; use.add(p.p.v.id); } else if (p.st === "choix") wait++; }); return { f, ht, n, wait, use }; });
  const min = Math.min(...R.filter(r => r.ht > 0 && !r.wait).map(r => r.ht)); let ret = c0.retenu && F.includes(c0.retenu) ? c0.retenu : "", motif = c0.motif || ""; const d = sviWinNew();
  const draw = () => { d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: "CLÔTURER — " + esc(c0.ref),
    body: `<table class="prm-table frs-sub"><thead><tr><th>FOURNISSEUR</th><th class="center">DÉTAILS CHIFFRÉS</th><th class="center">PRIX À CHOISIR</th><th class="number">TOTAL HT</th><th class="center">RETENU</th></tr></thead><tbody>${R.map(r => `<tr><td>${esc(achFrsNom(r.f))}${r.ht === min ? " ★" : ""}</td><td class="center">${r.n} / ${c0.lignes.filter(l => ((c0.lf || {})[l.id] || []).includes(r.f)).length}</td><td class="center">${r.wait || ""}</td><td class="number">${esc(achF2(r.ht))}</td><td class="center"><input type="radio" name="cafRet2" value="${esc(r.f)}"${ret === r.f ? " checked" : ""}></td></tr>`).join("")}</tbody></table>
      <label class="frs-f frs-w"><span>MOTIF DU CHOIX (OBLIGATOIRE SI LE RETENU N'EST PAS LE MOINS CHER ★)</span><input class="ins-in cafc-m" value="${esc(motif)}" autocomplete="off"></label>`,
    foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok" data-ok>CLÔTURER AVEC LE RETENU</button>` }); if (!d.isConnected) sviWinShow(d); };
  draw();
  d.addEventListener("change", e => { if (e.target.name === "cafRet2") ret = e.target.value; });
  d.addEventListener("click", async e => { if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; } if (!e.target.closest("[data-ok]")) return;
    motif = achU((d.querySelector(".cafc-m") || {}).value || ""); const r = R.find(z => z.f === ret);
    if (!r) { svToast("CHOISIR LE FOURNISSEUR RETENU.", 3000); return; }
    if (r.wait) { svToast("PRIX À CHOISIR CHEZ CE FOURNISSEUR (TABLEAU COMPARATIF) AVANT DE LE RETENIR.", 4000); return; }
    if (!r.n) { svToast("AUCUN DÉTAIL CHIFFRÉ PAR CE FOURNISSEUR.", 3000); return; }
    if (r.ht > min + 1e-6 && !motif) { svToast("LE RETENU N'EST PAS LE MOINS CHER : MOTIF OBLIGATOIRE.", 4000); return; }
    const used = D.filter(v => r.use.has(v.id)); if (used.some(v => achDvfWhy(v).some(m => /REÇU APRÈS LA DATE LIMITE$|DEVIS EXPIRÉ/.test(m)))) { svToast("UN DEVIS RETENU EST EXPIRÉ OU REÇU APRÈS LA DATE LIMITE : L'ACCEPTER AVEC UN MOTIF (FICHE DU DEVIS).", 5000); return; }
    const C = achCaf().find(y => y.id === id); if (!C) return; achCafUp(C);
    if (await achCafGate(C, async lab => { const L = achCaf(), i = L.findIndex(y => y.id === id); if (i >= 0) { L[i] = C; C.mod = achNow(); achCafSave(L); achHist(C.ref, lab, ""); } })) { d.remove(); if (done) done(); return; }
    if (!(await svConfirm({ title: "CLÔTURER LA CONSULTATION", text: C.ref + " : RETENU " + achFrsNom(ret) + " (" + achF2(r.ht) + " HT). LES AUTRES DEVIS SONT REJETÉS ; LES BESOINS DES DÉTAILS CHIFFRÉS DEVIENNENT COUVERTS.", ok: "CLÔTURER", tone: "neutral" }))) return;
    const now = achNow(), DL = achDvf(); DL.forEach(v => { if (v.caf === id && v.state !== "annule") { v.state = r.use.has(v.id) ? "retenu" : "rejete"; v.mod = now; achHist(v.ref, v.state === "retenu" ? "RETENU" : "REJETÉ", C.ref); } }); achDvfSave(DL);
    const BL = achBsn(); C.lignes.forEach(l => { if (!l.bsn || !((C.lf || {})[l.id] || []).includes(ret)) return; const p = achCafPrice(C, ret, l, DL.map(v => ({ ...v, state: v.state === "rejete" ? "recu" : v.state }))); if (p.st !== "ok") return; const b = BL.find(y => y.id === l.bsn); if (b) { b.couvert = id; b.mod = now; achHist(b.ref, "COUVERT", C.ref + " — " + achFrsNom(ret)); } }); achBsnSave(BL);
    achCafSaveOne(id, x => { x.retenu = ret; x.motif = motif; x.state = "close"; x.close = now; }, "CLOSE — RETENU " + achFrsNom(ret) + (motif ? " — " + motif : ""));
    d.remove(); if (done) done(); });
}

/* ---------- IMPORTER dans le DÉTAIL CONSULTATION (07/11) ----------
   source : un fichier de l'extérieur (Excel, CSV, PDF), un lien Google Sheets, ou un document déjà dans les DOCUMENTS de la consultation ;
   un fichier venu de l'extérieur s'ajoute aussi aux DOCUMENTS ; toute ligne importée arrive « À VÉRIFIER » (en rouge) et doit être confirmée */
const achPdfLib = () => window.pdfjsLib ? Promise.resolve(window.pdfjsLib) : new Promise((ok, ko) => { const sc = document.createElement("script");
  sc.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  sc.onload = () => { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; } catch (e) {} ok(window.pdfjsLib); };
  sc.onerror = () => ko(new Error("LECTEUR PDF INDISPONIBLE (CONNEXION ?)")); document.head.appendChild(sc); });
async function achPdfText(blob) { const lib = await achPdfLib(), pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise, lines = [];
  for (let i = 1; i <= pdf.numPages; i++) { const tc = await (await pdf.getPage(i)).getTextContent(); let y = null, ln = "";
    tc.items.forEach(it => { const yy = Math.round(it.transform[5]); if (y !== null && Math.abs(yy - y) > 2) { lines.push(ln); ln = ""; } y = yy; ln += (ln && !ln.endsWith(" ") ? " " : "") + it.str; }); if (ln) lines.push(ln); }
  return lines.join("\n"); }
const achImpNum = v => { const t = String(v ?? "").trim(); return /^-?[\d\s\u00a0\u202f]*[.,]?\d+$/.test(t) ? achN(t) : NaN; };
/* tableau (lignes × colonnes) → détails : en-tête reconnu (DÉSIGNATION, U, QUANTITÉ, PRIX), sinon colonnes devinées ; ligne sans quantité = titre de groupe */
function achImpRows(aoa) { const A = (aoa || []).map(r => (r || []).map(v => String(v ?? "").trim())).filter(r => r.some(Boolean)); if (!A.length) return [];
  const RX = { des: /D[ÉE]SIGNATION|LIBELL|DESCRIPTION|ARTICLE|NATURE/i, u: /^U\.?$|^UNIT|^UNITÉ/i, q: /QT[ÉE]|QUANT/i, pu: /^P\.?\s?U|PRIX/i };
  let h = -1, C = {}; for (let i = 0; i < Math.min(A.length, 15) && h < 0; i++) { const r = A[i], c = {};
    r.forEach((v, j) => { Object.keys(RX).forEach(k => { if (c[k] === undefined && RX[k].test(v) && !(k === "des" && /PRIX/i.test(v))) c[k] = j; }); });
    if (c.des !== undefined && c.q !== undefined) { h = i; C = c; } }
  if (h < 0) { const n = Math.max(...A.map(r => r.length)), avg = j => A.reduce((s, r) => s + (isNaN(achImpNum(r[j])) ? (r[j] || "").length : 0), 0) / A.length;
    let d = 0; for (let j = 1; j < n; j++) if (avg(j) > avg(d)) d = j; C.des = d;
    for (let j = d + 1; j < n; j++) { const num = A.filter(r => !isNaN(achImpNum(r[j]))).length, sh = A.filter(r => r[j] && isNaN(achImpNum(r[j])) && r[j].length <= 5).length;
      if (C.u === undefined && sh >= A.length / 3) C.u = j; else if (C.q === undefined && num >= A.length / 3) C.q = j; else if (C.pu === undefined && C.q !== undefined && num >= A.length / 3) C.pu = j; } }
  const out = []; A.slice(h + 1).forEach(r => { const des = (r[C.des] || "").replace(/\s+/g, " "), q = C.q !== undefined ? achImpNum(r[C.q]) : NaN; if (!des || /^TOTAL|^SOUS[- ]TOTAL/i.test(des)) return;
    if (isNaN(q) || q <= 0) { if (!(C.u !== undefined && r[C.u])) out.push({ title: des }); return; }
    out.push({ des, u: C.u !== undefined ? (r[C.u] || "") : "", q, pu: C.pu !== undefined && !isNaN(achImpNum(r[C.pu])) ? achImpNum(r[C.pu]) : "" }); });
  return out; }
/* texte d'un PDF → détails : « [N°] DÉSIGNATION  U  QUANTITÉ  [PRIX …] » ; le reste ignoré (tout est à vérifier) */
function achImpPdfRows(txt) { const out = [], NUM = "(?:\\d{1,3}(?:[\\s\\u00a0\\u202f]\\d{3})+|\\d+)(?:[.,]\\d+)?";
  const RE = new RegExp("^(?:\\d+(?:[.]\\d+)*[.)]?\\s+)?(.+?)\\s+(U|UN|M|ML|M2|M²|M3|M³|KG|T|TONNE|L|LITRE|ENS|ENSEMBLE|FF|FORFAIT|PCE|PC|PIECE|PIÈCE|SAC|H|J|JOUR|BOITE|ROULEAU|PAIRE|LOT)\\.?\\s+(" + NUM + ")(?:\\s+(" + NUM + "))?", "i");
  String(txt || "").split(/\n/).forEach(l => { const m = l.trim().match(RE); if (!m) return; const q = achImpNum(m[3].trim()); if (!(q > 0)) return;
    out.push({ des: m[1].replace(/\s+/g, " ").trim(), u: m[2].toUpperCase().replace("M²", "M2").replace("M³", "M3"), q, pu: m[4] && !isNaN(achImpNum(m[4].trim())) ? achImpNum(m[4].trim()) : "" }); });
  return out; }
/* lecture d'un fichier (Excel / CSV / PDF) en détails */
async function achImpBlob(f) { const nm = String(f.name || "") + " " + String(f.type || "");
  if (/pdf/i.test(nm)) return achImpPdfRows(await achPdfText(f));
  const X = await loadXLSX(), wb = /csv|text/i.test(nm) ? X.read(await f.text(), { type: "string", raw: true }) : X.read(await f.arrayBuffer(), { type: "array" });
  return achImpRows(X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false })); }
const achImpSrcWin = DOCS => new Promise(ok => { const d = sviWinNew(), D = DOCS.filter(x => x.fk);
  d.innerHTML = sviWinCard({ cls: "cmpm-pick", close: "data-x", title: "IMPORTER DANS LE DÉTAIL CONSULTATION", body: `<div class="cmpm-list">
    <button type="button" class="svc-b" data-s="file">UN FICHIER DE L'EXTÉRIEUR (EXCEL, CSV, PDF)</button>
    <button type="button" class="svc-b" data-s="gs">UN LIEN GOOGLE SHEETS</button>
    <button type="button" class="svc-b" data-s="caf">UNE AUTRE CONSULTATION DE L'APPLICATION</button>
    ${D.length ? `<div class="frs-st">UN DOCUMENT DE LA CONSULTATION</div>` + D.map((x, i) => `<button type="button" class="svc-b" data-s="d${i}">${esc((x.ref || "") + " — " + (x.title || x.fname || ""))}</button>`).join("") : ""}
</div>`,   /* 10.5 : pas de bandeau ; le message après l'import dit que les lignes sont à vérifier */
    foot: `<button type="button" class="svc-b" data-x>ANNULER</button>` });
  sviWinShow(d);
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) { d.remove(); ok(null); return; }
    const b = e.target.closest("[data-s]"); if (!b) return; const s = b.dataset.s; d.remove(); ok(s[0] === "d" ? { doc: D[+s.slice(1)] } : { s }); }); });
/* 11/11 (Ahmed, validé, 10.2) : LECTURE D'UN IMPORT, sans rien enregistrer — { rows, from, file } ; source en plus : UNE AUTRE CONSULTATION de l'application
   (on coche ses articles à reprendre ; titres de groupes repris ; les besoins liés ne sont pas repris) */
async function achCafImpRead(DOCS, selfId) { const src = await achImpSrcWin(DOCS || []); if (!src) return null;
  let rows = null, from = "", file = null;
  try {
    if (src.doc) { const f = await sviFiles.get(src.doc.fk); if (!f) { svToast("FICHIER DU DOCUMENT INTROUVABLE SUR CET APPAREIL.", 3500); return null; } rows = await achImpBlob(f.name ? f : new File([f], src.doc.fname || "doc", { type: f.type })); from = src.doc.ref || "DOCUMENT"; }
    else if (src.s === "caf") { const C = achCaf().filter(c => c.id !== selfId && (c.lignes || []).length); if (!C.length) { svToast("AUCUNE AUTRE CONSULTATION AVEC DES ARTICLES.", 3000); return null; }
      const pk = await achPickWin("REPRENDRE LES ARTICLES D'UNE CONSULTATION", C.map(c => ({ v: c.id, lab: c.ref + " — " + (c.objet || "") + " (" + c.lignes.length + " ARTICLE(S))" }))); if (!pk.length) return null;
      const c = C.find(y => y.id === pk[0]), G = new Map((c.grp || []).map(g => [g.id, g.lab || ""]));
      const L = await achPickWin("ARTICLES À REPRENDRE — " + c.ref, c.lignes.map((l, i) => ({ v: String(i), lab: (l.des || "") + " — " + achF2(l.q) + " " + (l.u || ""), on: true }))); if (!L.length) return null;
      rows = []; let g0 = null; c.lignes.forEach((l, i) => { if (!L.includes(String(i))) return; const gl = l.g ? G.get(l.g) || "" : ""; if (gl && gl !== g0) { rows.push({ title: gl }); g0 = gl; } rows.push({ des: l.des, u: l.u, q: achN(l.q), pu: "" }); }); from = c.ref; }
    else if (src.s === "gs") { const url = await achAsk("IMPORTER UN LIEN GOOGLE SHEETS", "LIEN DE LA FEUILLE (PARTAGÉE EN LECTURE)"); if (!url) return null;
      const id = (url.match(/\/d\/([a-zA-Z0-9_-]+)/) || [])[1], gid = (url.match(/[#&?]gid=(\d+)/) || [])[1] || "0"; if (!id) { svToast("LIEN GOOGLE SHEETS NON RECONNU.", 3000); return null; }
      const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`); if (!r.ok) throw new Error("ACCÈS REFUSÉ (FEUILLE NON PARTAGÉE ?)");
      const X = await loadXLSX(), wb = X.read(await r.text(), { type: "string", raw: true }); rows = achImpRows(X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false })); from = "GOOGLE SHEETS"; }
    else { const f = await new Promise(ok => { const i = document.createElement("input"); i.type = "file"; i.accept = ".xlsx,.xls,.csv,.pdf"; i.onchange = () => ok(i.files[0] || null); i.click(); }); if (!f) return null;
      rows = await achImpBlob(f); from = f.name; file = f; }
  } catch (err) { svToast("IMPORT IMPOSSIBLE : " + String(err && err.message || err).toUpperCase(), 4500); return null; }
  return { rows: rows || [], from, file }; }
/* un fichier venu de l'extérieur rejoint les DOCUMENTS de la consultation (SUIVI) */
async function achCafDocAdd(code, f, title) { const L = achJ("svi_docs_v1:ACH-" + code, []) || [], k = "ach:doc:" + code + ":" + Date.now().toString(36) + Math.random().toString(36).slice(2, 4); try { await sviFiles.put(k, f); } catch (e) {}
  const dx = { ref: "ACH DOC " + code + "/" + String(L.length + 1).padStart(3, "0"), date: new Date().toISOString(), title: title || f.name, fk: k, fname: f.name }; L.push(dx); achW("svi_docs_v1:ACH-" + code, L); achHist(code, "DOCUMENT", dx.title); return dx; }
async function achCafImport(x, redraw) { const code = x.ref || x.code, DOCS = achJ("svi_docs_v1:ACH-" + code, []) || [], R = await achCafImpRead(DOCS, x.id); if (!R) return;
  const { rows, from, file } = R; if (file) await achCafDocAdd(code, file, "IMPORT — " + file.name);
  const n = (rows || []).filter(r => !r.title).length; if (!n) { svToast("AUCUNE LIGNE RECONNUE DANS « " + from + " ».", 4000); if (redraw) redraw(); return; }
  achCafSaveOne(x.id, c => { let g = null; c.grp = c.grp || [];
    rows.forEach(r => { if (r.title) { g = { id: achCafId(), lab: achU(r.title) }; g.n = 0; c.grp.push(g); return; }
      const a = achArtOf(r.des, r.u), id = achCafId(), l = a ? { id, des: a.des, u: a.u, q: r.q, imp: true } : { id, des: achU(r.des), u: achU(r.u), q: r.q, pu: r.pu, libre: true, imp: true };
      if (g) { l.g = g.id; g.n++; } c.lignes.push(l); c.lf[id] = (c.frs || []).slice(); });
    c.grp = c.grp.filter(y => y.n !== 0).map(y => { delete y.n; return y; }); }, "IMPORT — " + n + " DÉTAIL(S) À VÉRIFIER (" + from + ")");
  svToast(n + " DÉTAIL(S) IMPORTÉ(S), EN ROUGE : À VÉRIFIER PUIS CONFIRMER (COCHER › CONFIRMER LES COCHÉS).", 5000); if (redraw) redraw(); }

/* ---------- GLISSER UNE LIGNE DU DÉTAIL CONSULTATION (07/11), comme dans le budget ----------
   appui long sur une ligne = la prendre (les cochées partent avec elle si elle est cochée) ; la déposer :
   - au-dessus / au-dessous d'une ligne : même niveau qu'elle (entre dans son groupe ou en sort) ;
   - au-dessus d'un titre de groupe : avant le groupe, hors du groupe ; au-dessous : en tête du groupe ;
   - sur une ligne : nouveau groupe avec elle (ou dans son groupe) ; sur un titre : à la fin du groupe ;
   un groupe devenu vide disparaît */
/* 07/11 (vérification des gestes, 9.3) : le glisser vaut pour TOUS les DÉTAILS des pages d'achat — chaque bloc DÉTAIL s'inscrit ici
   (clé = son bloc) avec ses lignes affichées et la façon d'enregistrer ; une ligne sans identifiant est repérée par sa place (#n) */
const ACH_DET_DRAG = {};
const achDetDropIn = (c, ids, tgt, mode) => { const L0 = c.lignes || [], tmp = L0.map((l, i) => ({ ...l, id: l.id || "#" + i, __t: !l.id }));
  const r = achDetDrop(tmp, c.grp, ids, tgt, mode); if (!r) return false; c.lignes = r.L.map(l => { const y = { ...l }; if (y.__t) delete y.id; delete y.__t; return y; }); c.grp = r.G; return true; };
function achDetDrop(L, G, ids, tgt, mode) { L = L.map(l => ({ ...l })); G = (G || []).map(g => ({ ...g })); const S = new Set(ids);
  if (tgt.l && S.has(tgt.l)) return null; const mv = L.filter(l => S.has(l.id)), rest = L.filter(l => !S.has(l.id)); if (!mv.length) return null;
  const setG = gid => mv.forEach(l => { if (gid) l.g = gid; else delete l.g; }); let at;
  if (tgt.l) { const i = rest.findIndex(l => l.id === tgt.l); if (i < 0) return null; const t = rest[i];
    if (mode === "on") { if (!t.g) { const g = { id: "K" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }; G.push(g); t.g = g.id; } setG(t.g); at = i + 1; }
    else { setG(t.g); at = mode === "before" ? i : i + 1; } }
  else { const I = rest.map((l, i) => l.g === tgt.g ? i : -1).filter(i => i >= 0);
    if (!I.length) { setG(mode === "before" ? "" : tgt.g); at = rest.length; }
    else if (mode === "before") { setG(""); at = I[0]; } else if (mode === "after") { setG(tgt.g); at = I[0]; } else { setG(tgt.g); at = I[I.length - 1] + 1; } }
  rest.splice(at, 0, ...mv); const used = new Set(rest.map(l => l.g).filter(Boolean)); return { L: rest, G: G.filter(g => used.has(g.id)) }; }
{ let T = null, D = null;
  const keyOf = el => { const b = el && el.closest && el.closest("#ach .nvp-blk"); const h = b && b.querySelector("[data-nvh]"); return h && ACH_DET_DRAG[h.dataset.nvh] ? h.dataset.nvh : ""; };
  const blkOf = el => keyOf(el) ? el.closest("#ach .nvp-blk") : null;
  const clr = () => document.querySelectorAll("#ach tr.cafp-dg, #ach tr.cafp-db, #ach tr.cafp-da, #ach tr.cafp-do").forEach(t => t.classList.remove("cafp-dg", "cafp-db", "cafp-da", "cafp-do"));
  const stop = () => { if (T) clearTimeout(T.h); T = null; D = null; clr(); document.documentElement.classList.remove("cafp-dragging"); };
  const at = (x, y) => { const el = document.elementFromPoint(x, y), tr = el && el.closest && el.closest("tr[data-ri]"); if (!tr || !D || !blkOf(tr) || tr === D.tr) return null;
    const r = tr.getBoundingClientRect(), f = (y - r.top) / Math.max(1, r.height); return { tr, mode: f < 0.3 ? "before" : f > 0.7 ? "after" : "on" }; };
  document.addEventListener("pointerdown", e => { const tr = e.target.closest && e.target.closest("tr[data-ri]"), K = tr && keyOf(tr), G = K && ACH_DET_DRAG[K]; if (!G || !G.open) return;
    if (e.target.closest("input, select, button, textarea, .nvp-rd, a")) return; const R = G.rows[+tr.dataset.ri]; if (!R || !R.l) return;
    T = { x: e.clientX, y: e.clientY, tr, h: setTimeout(() => { if (!T) return; const cb = tr.querySelector(".nvp-cb");
      const ids = cb && cb.checked ? [...blkOf(tr).querySelectorAll("tbody tr[data-ri]")].filter(t => t.querySelector(".nvp-cb:checked")).map(t => G.rows[+t.dataset.ri]).filter(r => r && r.l).map(r => r.l) : [R.l];
      D = { tr, ids, G }; tr.classList.add("cafp-dg"); document.documentElement.classList.add("cafp-dragging"); try { navigator.vibrate && navigator.vibrate(15); } catch (err) {} }, 450) }; }, true);
  document.addEventListener("pointermove", e => { if (T && !D && Math.hypot(e.clientX - T.x, e.clientY - T.y) > 8) { stop(); return; } if (!D) return;
    clr(); D.tr.classList.add("cafp-dg"); const a = at(e.clientX, e.clientY); D.a = a; if (a) a.tr.classList.add({ before: "cafp-db", after: "cafp-da", on: "cafp-do" }[a.mode]); }, true);
  document.addEventListener("touchmove", e => { if (D) e.preventDefault(); }, { passive: false, capture: true });
  document.addEventListener("pointerup", () => { if (!D) { stop(); return; } const d = D, a = D.a; stop(); if (!a) return; const R = d.G.rows[+a.tr.dataset.ri]; if (!R) return;
    let ok = false; d.G.apply(c => { ok = achDetDropIn(c, d.ids, R, a.mode); });
    if (ok && ACH_NV_REDRAW) ACH_NV_REDRAW(); }, true);
  document.addEventListener("pointercancel", stop, true);
  document.addEventListener("click", e => { if (document.documentElement.classList.contains("cafp-dragging")) { e.preventDefault(); e.stopPropagation(); } }, true);
}
/* ⟪ src/45-achats-commandes.js ⟫ */
/* =========================================================
   v762 : COMMANDES, RÉCEPTIONS, RETOURS (étape 4) — onglets de l'écran des achats (menu ☰ › ACHAT)
   Tableaux : achListMod (44) ; fiches ci-dessous ; règles : 40-achats-donnees.js (achCmfTot, achResteQ, achCmfWhy, achRcpWhy…).
   ========================================================= */
const ACH_CMF_ST = { instance: "EN INSTANCE", valide: "VALIDÉE", solde: "SOLDÉE", annule: "ANNULÉE" };
const achNow = () => new Date().toISOString();
function achCmfMod(ctx) {
  return achListMod(ctx, { k: "cmf", t: "ach_cmf", id: "achCmfT", list: achCmf, name: "COMMANDES", save: achCmfSave, edit: ACH_ED.cmf,
    /* D1 : les retours de commande sont des commandes de montant négatif, rangées ici */
    merge: [{ o: achRtrCfg("cmd"), col: { ref: x => x.ref, nat: () => "RETOUR DE COMMANDE", frs: x => x.frs ? achFrsNom(x.frs) : "", prom: x => achDFr(x.date), ht: x => achRtrMt(x), ttc: x => achRtrTtc(x), recu: x => achRtrSrc(x), etat: x => x.state === "annule" ? "ANNULÉ" : "RETOUR" } }], inst: c => c.state === "instance", etatKey: "svi_ach_cmf_etat_v1", newLab: "NOUVELLE COMMANDE", newRow: "CRÉER UNE COMMANDE ICI…", open: achCmfFiche,
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
  return achListMod(ctx, { k: "rcp", t: "ach_rcp", id: "achRcpT", list: achRcp, name: "RÉCEPTIONS",
    /* D1 : les retours de réception sont des réceptions négatives, rangées ici */
    merge: [{ o: achRtrCfg("rcp"), col: { ref: x => x.ref, cmf: x => ((achCmf().find(c => c.id === x.cmf) || {}).ref) || "", frs: x => x.frs ? achFrsNom(x.frs) : "", nbl: x => "RETOUR DE " + achRtrSrc(x), date: x => svDT(x.date || ""), lig: x => String((x.lignes || []).length), res: x => x.motif || "", etat: x => x.state === "annule" ? "ANNULÉ" : "RETOUR" } }], etatKey: "svi_ach_rcp_etat_v1", newLab: "LIVRAISON SANS COMMANDE", newRow: "CRÉER UNE RÉCEPTION SANS COMMANDE ICI… (LES AUTRES : DEPUIS LA COMMANDE, RÉCEPTIONNER)", open: (id, done) => achRcpFiche(id, null, done),
    etats: [["actif", "ACTIVES"], ["alerte", "ALERTE"], ["annule", "ANNULÉES"], ["tout", "TOUT"]],
    ok: (r, k) => k === "tout" ? true : k === "alerte" ? achRcpWhy(r).length > 0 : k === "annule" ? r.state === "annule" : r.state !== "annule",
    why: r => achRcpWhy(r),
    w: { ref: 150, cmf: 150, frs: 220, nbl: 130, date: 150, lig: 80, res: 150, etat: 100 },
    cols: () => [["ref", "RÉFÉRENCE", r => r.ref, ""], ["cmf", "COMMANDE", r => ((achCmf().find(c => c.id === r.cmf) || {}).ref) || "SANS COMMANDE", ""], ["frs", "FOURNISSEUR", r => r.frs ? achFrsNom(r.frs) : "", ""],
      ["nbl", "N° BL", r => r.pv ? "PV DE SERVICE FAIT" : r.nbl || "", ""], ["date", "REÇU LE", r => svDT(r.date || ""), ""], ["lig", "DÉTAILS", r => String((r.lignes || []).length), "center"],
      ["res", "RÉSULTAT", r => { const L = r.lignes || []; return L.some(l => l.st === "ref") ? (L.every(l => l.st === "ref") ? "REFUSÉE" : "REFUS PARTIEL") : L.some(l => l.st === "res") ? (r.resLev ? "RÉSERVES LEVÉES" : "AVEC RÉSERVES") : "ACCEPTÉE"; }, "center"],
      ["etat", "ÉTAT", r => r.state === "annule" ? "ANNULÉE" : "ENREGISTRÉE", "center"]] });
}
function achRtrMod(ctx, kind) { return achListMod(ctx, achRtrCfg(kind)); }
function achRtrCfg(kind) {
  return { k: "rtr" + kind, one: kind === "cmd" ? "RETOUR DE COMMANDE" : "RETOUR DE RÉCEPTION", t: "ach_rtr" + kind, id: kind === "cmd" ? "achRtcT" : "achRtrT", name: kind === "cmd" ? "RETOURS DE COMMANDE" : "RETOURS DE RÉCEPTION", list: () => achRtr().filter(x => x.kind === kind), etatKey: "svi_ach_rtr" + kind + "_etat_v1",
    newLab: kind === "cmd" ? "RETOUR DE COMMANDE (DEPUIS LA COMMANDE)" : "RETOUR DE RÉCEPTION (DEPUIS LA RÉCEPTION)", newRow: kind === "cmd" ? "UN RETOUR DE COMMANDE SE CRÉE DEPUIS LA COMMANDE (RETOUR DE COMMANDE, SOLDER)" : "UN RETOUR DE RÉCEPTION SE CRÉE DEPUIS LA RÉCEPTION (REFUS, RETOURNER)",
    open: (id, done) => { if (id) achRtrWin(id); else svToast(kind === "cmd" ? "OUVRIR LA COMMANDE PUIS « RETOUR DE COMMANDE » OU « SOLDER »." : "OUVRIR LA RÉCEPTION PUIS « RETOURNER » (OU REFUSER DES LIGNES).", 3500); },
    etats: [["tout", "TOUS"]], ok: () => true, why: () => [],
    w: { ref: 150, src: 150, frs: 220, date: 150, lig: 260, mt: 130, motif: 260 },
    cols: () => [["ref", "RÉFÉRENCE", x => x.ref, ""], ["src", kind === "cmd" ? "COMMANDE" : "RÉCEPTION", x => kind === "cmd" ? ((achCmf().find(c => c.id === x.cmf) || {}).ref || "") : ((achRcp().find(r => r.id === x.rcp) || {}).ref || ""), ""],
      ["frs", "FOURNISSEUR", x => x.frs ? achFrsNom(x.frs) : "", ""], ["date", "DATE", x => svDT(x.date || ""), ""], ["lig", "DÉTAILS", x => (x.lignes || []).map(l => l.des + " " + achF2(l.q) + " " + l.u).join(" · "), ""], ["mt", "MONTANT HT", x => achRtrMt(x), "number"], ["motif", "MOTIF", x => x.motif || "", ""]] };
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
/* D1 : montant TTC d'un retour (négatif), TVA des lignes de la commande */
const achRtrTtc = x => { const c = achCmf().find(y => y.id === x.cmf), CL = (c && c.lignes) || [];
  return -(x.lignes || []).reduce((t, l) => { const o = CL.find(y => y.id === l.cl) || CL.find(y => achKey(y.des, y.u) === achKey(l.des, l.u)) || {}, tv = o.tva === "" || o.tva === undefined ? achPrm().tva : achN(o.tva);
    return t + achN(l.q) * achN(o.pu) * (1 - achN(c && c.rem) / 100) * (1 + tv / 100); }, 0); };
const achRtrSrc = x => x.kind === "cmd" ? ((achCmf().find(c => c.id === x.cmf) || {}).ref || "") : ((achRcp().find(r => r.id === x.rcp) || {}).ref || "");
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
    d.innerHTML = sviWinCard({ st: c0 ? achPcSt("cmf", c0) : "instance", cls: "frs-card cmf-card", close: "data-x", title: achWinTtl(C.ref, ""),
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}</div>` : ""}${(C.renv || []).length && C.state === "instance" && !C.circ ? `<div class="frs-why">↩ RENVOYÉE PAR ${esc(achGradeLab(C.renv[C.renv.length - 1].g))}${C.renv[C.renv.length - 1].u ? " — " + esc(C.renv[C.renv.length - 1].u) : ""} : ${esc(C.renv[C.renv.length - 1].why)}</div>` : ""}<div class="frs-scroll">
        ${C.circ && C.state === "instance" ? `<div class="frs-sec cmf-circ"><div class="frs-st">CIRCUIT DE VALIDATION — AU-DELÀ DE ${esc(achF2(C.circ.mt))} HT${C.circ.h ? " (HIÉRARCHIE RESPECTÉE)" : ""}</div>
          <table class="prm-table frs-sub"><thead><tr><th>GRADE</th><th>ÉTAT</th><th>PAR</th><th>LE</th></tr></thead><tbody>${C.circ.g.map(g => { const o = (C.circ.ok || []).find(x => String(x.g) === g), nx = achCircNext(C).includes(g);
            return `<tr class="${o ? "nvr-valide" : nx ? "nvr-instance" : ""}"><td>${esc(achGradeLab(g))}</td><td>${o ? "ACCEPTÉE" : nx ? "À VALIDER" : "EN ATTENTE"}</td><td>${esc(o ? o.u || "" : "")}</td><td>${esc(o ? achDFr(o.t) : "")}</td></tr>`; }).join("")}</tbody></table></div>` : ""}
        <div class="frs-sec"><div class="frs-g">${achCreeFld(C)}
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
        <div class="frs-sec"><div class="frs-st">DÉTAIL COMMANDE ${svCnt(C.lignes.length)}</div>
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
          <table class="prm-table frs-sub cmf-cla"><thead><tr><th class="center">N°</th><th>TYPE</th><th>DÉSIGNATION</th><th>VALEUR</th><th>UNITÉ</th><th></th></tr></thead><tbody>
          ${C.cla.map((x, i) => `<tr data-ci="${i}"><td class="center">${i + 1}</td><td><select class="ins-in cmf-cl" data-c="t"${dis}>${ACH_CLT.map(([k, l]) => `<option value="${k}"${k === x.t ? " selected" : ""}>${l}</option>`).join("")}</select></td>
            <td><input class="ins-in cmf-cl" data-c="txt" value="${esc(x.txt || "")}"${dis} autocomplete="off"></td><td><input class="ins-in cmf-cl" data-c="v" value="${esc(x.v ?? "")}"${dis} autocomplete="off"></td><td><input class="ins-in cmf-cl" data-c="u" value="${esc(x.u ?? achCltU(x.t))}"${dis} autocomplete="off"></td><td class="center">${ro ? "" : `<button type="button" class="ach-x" data-rmcl="${i}">✕</button>`}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">AUCUN ARTICLE</td></tr>`}</tbody></table>
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
    d.querySelectorAll("tr[data-ci]").forEach(tr => { const x = C.cla[+tr.dataset.ci]; if (!x) return; [...tr.querySelectorAll(".cmf-cl")].sort((a, b) => (a.dataset.c === "t") - (b.dataset.c === "t")).forEach(i => { if (i.disabled) return; const c = i.dataset.c, ov = x.t; x[c] = c === "t" ? i.value : achU(i.value); if (c === "t" && ov !== x.t) { if (!x.txt || x.txt === achCltDef(ov)) x.txt = achCltDef(x.t); if (!x.u || x.u === achCltU(ov)) x.u = achCltU(x.t); } }); });
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
    if (e.target.closest("[data-addcl]")) { pull(); C.cla.push({ t: "autre", txt: "", v: "", u: "" }); draw(); return; }
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
      if (!(await svConfirm({ title: "ENVOYER EN VALIDATION", text: C.ref + " : " + achF2(achCmfTot(C).ht) + " HT" + (S.mt ? ", AU-DELÀ DE " + achF2(S.mt) + " HT" : "") + (S.why ? " — CONTRÔLE DU BUDGET : " + S.why.join(" · ") : "") + " — VALIDATION PAR " + S.g.map(achGradeLab).join(S.h ? " PUIS " : " OU ") + ". LA COMMANDE EST VERROUILLÉE PENDANT LE CIRCUIT.", ok: "ENVOYER", tone: "neutral" }))) return;
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
    d.innerHTML = sviWinCard({ st: r0 ? achPcSt("rcp", r0) : "instance", cls: "frs-card rcp-card", close: "data-x", title: achWinTtl(r0 && P.ref, P.pv ? "PROCÈS-VERBAL DE SERVICE FAIT" : "NOUVELLE RÉCEPTION"),
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}</div>` : ""}<div class="frs-scroll">
        <div class="frs-sec"><div class="frs-g">${achCreeFld(r0)}
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
        <div class="frs-sec"><div class="frs-st">DÉTAIL RÉCEPTION ${svCnt(P.lignes.length)} ${C ? `<small>(TOLÉRANCE ${esc(String(tol).replace(".", ","))} % AU-DESSUS DU RESTE)</small>` : ""}</div>
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
  return achListMod(ctx, { k: "faf", t: "ach_faf", id: "achFafT", list: achFaf, name: "FACTURES", save: achFafSave, edit: ACH_ED.faf,
    /* D1 : les avoirs sont des factures de montant négatif, rangés ici */
    merge: [{ o: achAvfCfg(), col: { ref: a => a.ref, num: a => a.num || "", frs: a => a.frs ? achFrsNom(a.frs) : "", cmf: a => "AVOIR SUR " + (((achFaf().find(f => f.id === a.fa) || {}).ref) || "—"), dfac: a => achDFr(a.date), ttc: a => -achN(a.ttc), reste: a => a.state === "annule" ? "" : -achAvfReste(a), etat: a => a.state === "annule" ? "ANNULÉ" : "AVOIR" } }], info: achFafInfo, inst: f => f.state === "instance" || f.state === "reclame", etatKey: "svi_ach_faf_etat_v1", newLab: "NOUVELLE FACTURE", newRow: "CRÉER UNE FACTURE ICI… (OU DEPUIS LA COMMANDE : FACTURER)", open: (id, done) => achFafFiche(id, null, done),
    etats: [["actif", "À PAYER"], ["instance", "EN INSTANCE"], ["reclame", "RÉCLAMÉES"], ["bap", "BON À PAYER"], ["payee", "PAYÉES"], ["alerte", "ALERTE"], ["annule", "ANNULÉES"], ["tout", "TOUT"]],
    ok: (f, k, L) => k === "tout" ? true : k === "alerte" ? achFafWhy(f, L).length > 0 : k === "payee" ? f.state === "bap" && achFafReste(f) <= 0.005 : k === "actif" ? f.state !== "annule" && achFafReste(f) > 0.005 : f.state === k,
    why: (f, L) => achFafWhy(f, L),
    w: { ref: 150, num: 130, frs: 220, cmf: 150, dfac: 110, ech: 110, ttc: 130, reste: 130, etat: 140 },
    cols: () => [["ref", "RÉFÉRENCE", f => f.ref, ""], ["num", "N° FACTURE", f => f.num || "", ""], ["frs", "FOURNISSEUR", f => f.frs ? achFrsNom(f.frs) : "", ""],
      ["cmf", "COMMANDE", f => f.type === "acompte" ? "ACOMPTE" : ((achCmf().find(c => c.id === f.cmf) || {}).ref) || "SANS COMMANDE", ""], ["dfac", "DATE", f => achDFr(f.dFac), ""], ["ech", "ÉCHÉANCE", f => achDFr(achFafEch(f)), ""],
      ["ttc", "MONTANT TTC", f => achFafTot(f).ttc, "number"], ["reste", "RESTE À PAYER", f => f.state === "annule" ? "" : achFafReste(f), "number"], ["etat", "ÉTAT", f => achFafEtat(f), "center"]] });
}
function achAvfMod(ctx) { return achListMod(ctx, achAvfCfg()); }
function achAvfCfg() {
  return { k: "avf", one: "AVOIR", t: "ach_avf", id: "achAvfT", list: achAvf, name: "AVOIRS", etatKey: "svi_ach_avf_etat_v1", newLab: "NOUVEL AVOIR", newRow: "CRÉER UN AVOIR ICI…", open: achAvfFiche,
    etats: [["actif", "À DÉDUIRE"], ["tout", "TOUT"], ["annule", "ANNULÉS"]],
    ok: (a, k) => k === "tout" ? true : k === "annule" ? a.state === "annule" : a.state !== "annule" && achAvfReste(a) > 0.005, why: () => [],
    w: { ref: 150, num: 130, frs: 220, fa: 150, date: 110, ttc: 130, reste: 130, motif: 220 },
    cols: () => [["ref", "RÉFÉRENCE", a => a.ref, ""], ["num", "N° AVOIR", a => a.num || "", ""], ["frs", "FOURNISSEUR", a => a.frs ? achFrsNom(a.frs) : "", ""], ["fa", "FACTURE", a => ((achFaf().find(f => f.id === a.fa) || {}).ref) || "", ""],
      ["date", "DATE", a => achDFr(a.date), ""], ["ttc", "MONTANT TTC", a => -achN(a.ttc), "number"],   /* B37 : avoir = facture de montant négatif */ ["reste", "RESTE À DÉDUIRE", a => a.state === "annule" ? "" : achAvfReste(a), "number"], ["motif", "MOTIF", a => a.motif || "", ""]] };
}
function achPafMod(ctx) {
  return achListMod(ctx, { k: "paf", t: "ach_paf", id: "achPafT", list: achPaf, name: "PAIEMENTS", save: achPafSave, edit: ACH_ED.paf, inst: p => p.state === "instance", etatKey: "svi_ach_paf_etat_v1", newLab: "NOUVEAU PAIEMENT", newRow: "CRÉER UN PAIEMENT ICI… (OU DEPUIS LA FACTURE : PAYER)", open: (id, done) => achPafFiche(id, null, done),
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
  d.innerHTML = sviWinCard({ cls: "frs-card faf-info", close: "data-x", title: achWinTtl(f.ref, ""),
    body: `<div class="frs-scroll"><div class="frs-sec"><div class="frs-g">${achCreeFld(f)}${row("N° DE LA FACTURE", f.num)}${row("TYPE", { normale: "FACTURE", acompte: "ACOMPTE" }[f.type] || String(f.type || "").toUpperCase())}
      ${row("ÉMISE LE", achDFr(f.dFac))}${row("REÇUE LE", achDFr(f.dRec))}${row("ÉCHÉANCE", achDFr(achFafEch(f)))}${row("COMMANDE", C ? C.ref : f.type === "acompte" ? "ACOMPTE" : "SANS COMMANDE")}
      ${row("FOURNISSEUR", f.frs ? achFrsNom(f.frs) : "")}${row("MONTANT TTC", achF2(achFafTot(f).ttc))}${row("RESTE À PAYER", f.state === "annule" ? "" : achF2(achFafReste(f)))}
      ${f.motifAnn ? row("MOTIF DE L'ANNULATION", f.motifAnn) : ""}<label class="frs-f"><span>COPIE</span>${f.copie ? `<button type="button" class="ach-b" data-copy>VOIR LA COPIE</button>` : `<input class="ins-in" value="AUCUNE" readonly>`}</label></div></div></div>`,
    foot: `<button type="button" class="svc-b" data-x>FERMER</button><button type="button" class="svc-b svc-ok svc-neutral" data-full>OUVRIR LA FICHE COMPLÈTE</button>` });
  sviWinShow(d);
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (done) done(); return; }
    if (e.target.closest("[data-copy]")) { achCopyOpen(f.copie); return; }
    if (e.target.closest("[data-full]")) { d.remove(); achFafFiche(id, {}, done); } });
}
/* lignes d'une facture tirées de sa commande (reçu non encore facturé) — fiche et liste (F14) */
function achFafCmfLines(c, fid) { const R = achRcp(), T = achRtr(), F = achFaf();
  return (c.lignes || []).map(l => ({ cl: l.id, des: l.des, u: l.u, pu: achN(l.pu), tva: l.tva, q: Math.max(0, Math.round((achRecQ(c.id, l.id, R, T) - achFacQ(c.id, l.id, fid, F)) * 1000) / 1000) })).filter(l => l.q > 1e-9); }
function achFafFiche(id, o, done) {
  o = o || {};
  const f0 = id ? achFaf().find(x => x.id === id) : null; if (id && !f0) return;
  const cmfLines = achFafCmfLines;
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
    d.innerHTML = sviWinCard({ st: f0 ? achPcSt("faf", f0) : "instance", cls: "frs-card faf-card", close: "data-x", title: achWinTtl(f0 && P.ref, "NOUVELLE FACTURE"),
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}</div>` : ""}<div class="frs-scroll">
        <div class="frs-sec"><div class="frs-g">${achCreeFld(f0)}
          <label class="frs-f frs-w"><span>FOURNISSEUR <b>*</b></span><select class="ins-in fa-x" data-k="frs"${dis || (f0 || C0 ? " disabled" : "")}><option value=""></option>${opt(FR.map(f => [f.id, f.code + " — " + f.nom]), P.frs)}</select></label>
          <label class="frs-f"><span>TYPE</span><select class="ins-in fa-x" data-k="type"${dis}>${opt([["normale", "FACTURE"], ["acompte", "FACTURE D'ACOMPTE"]], P.type)}</select></label>
          <label class="frs-f"><span>COMMANDE</span><select class="ins-in fa-x" data-k="cmf"${dis || (f0 || C0 ? " disabled" : "")}><option value="">SANS COMMANDE</option>${opt(CM.map(c => [c.id, c.ref]), P.cmf)}</select></label>
          <label class="frs-f"><span>N° DE LA FACTURE <b>*</b></span><input class="ins-in fa-x" data-k="num" value="${esc(P.num)}"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>DATE DE LA FACTURE <b>*</b></span><input type="date" class="ins-in fa-x" data-k="dFac" value="${esc(P.dFac)}"${dis}></label>
          <label class="frs-f"><span>REÇUE LE</span><input type="date" class="ins-in fa-x" data-k="dRec" value="${esc(P.dRec)}"${dis}></label>
          <label class="frs-f"><span>ÉCHÉANCE ${P.ech ? "(SAISIE)" : "(CONDITIONS DU FOURNISSEUR)"}</span><input type="date" class="ins-in fa-x" data-k="ech" value="${esc(achFafEch(P))}"${dis}></label>
          <label class="frs-f frs-w"><span>COPIE DE LA FACTURE</span>${achCopyBtn(P, ro)}</label></div></div>
        <div class="frs-sec"><div class="frs-st">DÉTAIL FACTURE ${svCnt(P.lignes.length)} ${C ? `<small>(REÇU − DÉJÀ FACTURÉ ; REMISE ${esc(String(achN(P.rem)).replace(".", ","))} %)</small>` : ""}</div>
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
      /* 06/11 : circuit de validation propre aux FACTURES (seuils de ce type, sinon le seuil général) */
      if (await achCircGate("faf", P, achFafTot(P).ht, async lab => { await store(lab); draw(); })) return;
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
    d.innerHTML = sviWinCard({ st: a0 ? achPcSt("avf", a0) : "instance", cls: "frs-card", close: "data-x", title: achWinTtl(a0 && P.ref, "NOUVEL AVOIR FOURNISSEUR"),
      body: `<div class="frs-scroll"><div class="frs-sec"><div class="frs-g">${achCreeFld(a0)}
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
    d.innerHTML = sviWinCard({ st: p0 ? achPcSt("paf", p0) : "instance", cls: "frs-card paf-card", close: "data-x", title: achWinTtl(p0 && P.ref, "NOUVEAU PAIEMENT"),
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}</div>` : ""}
        ${fr && achFrsAttExp(fr) && P.state === "instance" ? `<div class="frs-why pa-att">⚠ ATTESTATION DE RÉGULARITÉ FISCALE EXPIRÉE : ${P.deb ? `PAIEMENT DÉBLOQUÉ PAR ${esc(P.deb.u || "?")} LE ${esc(achDFr(String(P.deb.t).slice(0, 10)))} — ${esc(P.deb.why || "")}` : `PAIEMENT BLOQUÉ <button type="button" class="ach-b" data-attdeb>DÉBLOQUER</button>`}</div>` : ""}<div class="frs-scroll">
        <div class="frs-sec"><div class="frs-g">${achCreeFld(p0)}
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
        ${(P.mode === "CHÈQUE" || P.mode === "LCN") && P.num ? `<button type="button" class="svc-b" data-prtchq>IMPRIMER ${P.mode === "LCN" ? "L'EFFET" : "LE CHÈQUE"}</button>` : ""}
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
    if (e.target.closest("[data-prtchq]")) { const c = typeof sviCarnetOf === "function" ? sviCarnetOf(P.num) : null, m = c && sviPgL("banques").find(y => y.id === c.p);   /* 05/11 */
      if (!m) { svToast("AUCUN CARNET NE CONTIENT LE N° " + P.num + " (PARAMÉTRAGE › BANQUES).", 3500); return; }
      sviMdpModel(m, { title: m.lab, ref: P.ref, party: P.frs ? achFrsNom(P.frs) : "", date: achDFr(P.date), ttc: achF2(P.mt), lettres: frMoney(achN(P.mt)) }); return; }
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
      /* 06/11 : circuit de validation propre aux PAIEMENTS (seuils de ce type, sinon le seuil général) */
      if (await achCircGate("paf", P, achN(P.mt), async lab => { store(lab); draw(); })) return;
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
/* B51 (05/11) : un nom lié (fournisseur, article, pièce) prend la couleur de SON état, simplement souligné — jamais de bleu par défaut */
const ACH_LK_LIST = { frs: "frs", art: "art", caf: "caf", dvf: "dvf", cmf: "cmf", rcp: "rcp", faf: "faf", avf: "avf", paf: "paf", bsn: "bsn", cli: "cli", prj: "prj" };
/* 05/11 (document unique 6.13) : liste validée — pas de colonne de corbeille (rien à supprimer) */
/* B48 : lecture seule, mémorisée (index par id) — pas une lecture complète de la liste par nom lié */
const achLkIdx = t => { const k = ACH_K[ACH_LK_LIST[t]]; return k ? achMemo("lk_" + t, [k], () => new Map((achJ(k, []) || []).map(x => [x.id, x]))) : new Map(); };
const achLkSt = (t, id) => { if (!ACH_LK_LIST[t]) return ""; let x = null; try { x = achLkIdx(t).get(id); } catch (e) {} if (!x) return "";
  /* 05/11 (2.10), 06/11 : comme dans sa propre liste — même état commun (achPcSt) */
  return achPcSt(t, x); };
function achLkPaint(root) { (root || document).querySelectorAll(".ach-link[data-nvgo]").forEach(b => { const [t, id] = String(b.dataset.nvgo).split("|"), s = achLkSt(t, id);
  if (b.dataset.lk === s) return; ["instance", "partiel", "remis", "valide", "annule", "bloque", "encours", "expire", "archive"].forEach(k => b.classList.toggle("lk-" + k, k === s)); b.dataset.lk = s; }); }
{ let raf = 0; new MutationObserver(() => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const v = document.getElementById("ach"); if (v) { achLkPaint(v); try { achListCloseSync(); } catch (e) {} } try { sviSyncState(); } catch (e) {} const c = document.getElementById("svConf"); if (c) achLkPaint(c); }); })
    .observe(document.documentElement, { childList: true, subtree: true }); }
const achSt = x => x && (x.st === "instance" || x.st === "fige") ? "instance" : "valide";
const achStF = x => achSt(x);
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
    const head = { doc: ["RÉFÉRENCE", "DATE", "INTITULÉ"],   /* 11/11 (Ahmed) : plus de colonne FICHIER — la référence soulignée ouvre le document */
      taf: ["RÉFÉRENCE", "DATE", "TÂCHE", "ÉCHÉANCE", "FAIT"], obs: ["DATE", "OBSERVATION", "IMPORTANTE"] }[tab];
    /* v793 : SUIVI des fiches d'achat au format du SUIVI du budget — loupe sur chaque colonne, largeur des colonnes réglable et gardée */
    const ACC = { doc: [x => x.ref || "", x => dt(x.date), x => x.title || ""], taf: [x => x.ref || "", x => dt(x.date), x => x.title || "", x => achDFr(x.ech), x => x.done ? "OUI" : "NON"], obs: [x => dt(x.date), x => x.text || "", x => x.important ? "!" : ""] }[tab];
    const tk = "achrec_" + tab, C = head.map((h, j) => ["c" + j, h, r => ACC[j](r.x), /FICHIER|FAIT|IMPORTANTE/.test(h) ? "center" : ""]);
    const R0 = L.map((x, i) => ({ x, i })).reverse(), R = ctx && ctx.cfApply ? ctx.cfApply(tk, C, R0) : R0;
    const CG = sviCwCols(tk, C.map((c, j) => [c[0], /DATE|ÉCHÉANCE/.test(c[1]) ? 140 : c[3] === "center" ? 100 : j === 0 && tab !== "obs" ? 170 : 260]));
    const th = c => ctx && ctx.cfHead ? ctx.cfHead(tk, c[0], c[1], c[3]) : `<th class="${c[3]}">${esc(c[1])}</th>`;
    const row = (x, i) => tab === "doc" ? `<td>${x.fk ? `<button type="button" class="ach-link" data-recf="${i}">${esc(x.ref || "DOCUMENT")}</button>` : esc(x.ref || "")}</td><td>${esc(dt(x.date))}</td><td>${esc(x.title || "")}</td>`
      : tab === "taf" ? `<td>${esc(x.ref || "")}</td><td>${esc(dt(x.date))}</td><td>${esc(x.title || "")}</td><td>${esc(achDFr(x.ech))}</td><td class="center"><input type="checkbox" class="rec-done" data-i="${i}"${x.done ? " checked" : ""}></td>`
      : `<td>${esc(dt(x.date))}</td><td>${esc(x.text || "")}</td><td class="center">${x.important ? "<b>!</b>" : ""}</td>`;
    /* v776 : bloc SUIVI comme celui du budget — en-tête SUIVI (agrandir, ⋯), rangée d'onglets, ligne CRÉER … ICI */
    return `<div class="bdg-d-block blk-rec blk-suivi nvp-rec nvp-blk" data-nvb="rec"><div class="bdg-d-block-title blk-head"><span class="ttl">${SVI_ICON.doc || ""}SUIVI</span>${achBlkTools("rec")}</div>
      <div class="blk-tabrow"><span class="rec-tabs">${["doc", "taf", "obs"].map(k => `<button type="button" class="rec-tab${k === tab ? " active" : ""}" data-nvr="${k}">${SVI_ICON[k] || ""}${{ doc: "DOCUMENTS", taf: "TAF", obs: "OBSERVATIONS" }[k]} ${svCnt(get(k).length)}</button>`).join("")}</span></div>
      <div class="rec-scroll" style="${achNvhSc("rec")}"><table class="bdg-d-table rec-table" data-svcw="${tk}" style="${CG.style}">${CG.cg}<thead><tr>${C.map(th).join("")}</tr></thead>
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
  /* v1124 : title = intitulé exact (facultatif ; sinon le nom du fichier sans .pdf, comme avant) */
  const savePdf = async (blob, name, title) => { const L = get("doc"), n = L.length + 1, k = "ach:doc:" + code + ":" + Date.now().toString(36);
    try { await sviFiles.put(k, new File([blob], name, { type: "application/pdf" })); } catch (e) {}
    const x = { ref: "ACH DOC " + code + "/" + String(n).padStart(3, "0"), date: new Date().toISOString(), title: title || name.replace(/\.pdf$/i, ""), fk: k, fname: name };
    L.push(x); achW(K.doc, L); achHist(code, "DOCUMENT", x.title); return x.ref; };
  return { html, click, change, savePdf, addTab: t => { tab = t; return add(); }, list: get };
}

/* ---------- LISTE au format du budget ----------
   o = { k, t, name ("ARTICLES"), one ("ARTICLE"), all(), save(L), code(x), nom(x), cols(), why(x), newRow, add(done), page(id), stOf(x), step(x) } */
/* 06/11/2026 (décision, document unique 3.9) : UNE SEULE LISTE par type de pièce — plus de listes EN INSTANCE / VALIDÉS ni de bascule ;
   à gauche, TOUT puis des cases à cocher combinables par état (choix gardé), puis les dates ; colonne ÉTAT = étape exacte (E3) ;
   ligne CRÉER … ICI toujours là ; corbeille seulement sur les lignes qu'on peut supprimer (colonne absente s'il n'y en a aucune, 6.13) */
function achNvList(ctx, o) {
  const { cfApply, cfHead, draw } = ctx;
  const SK = "ach_" + o.k, KEYS = o.stKeys || SVI_STF_PIECE;
  let dSel = "", order = [];
  const isI = x => o.inst ? !!o.inst(x) : achSt(x) === "instance";
  const stOf = (x, all) => { const s = o.stOf ? o.stOf(x) : achPcSt(o.k, x) || (isI(x) ? "instance" : "valide"); const w = o.why(x, all); return w && w.length ? [s, "alerte"] : [s]; };
  const dI = x => o.dI ? o.dI(x) : x.cree, dV = x => o.dV ? o.dV(x) : x.val || x.cree;
  const dOf = x => achDay(isI(x) ? dI(x) : dV(x) || dI(x));
  const step = x => o.step ? o.step(x) : achPcStep(o.k, x);
  /* colonnes : celles de la liste, ÉTAT (étape exacte), puis VALIDÉ LE et SAISI LE */
  const colsOf = () => { const C0 = o.cols("all").filter(c => c[1] !== "SAISI LE" && c[1] !== "VALIDÉ LE"), i = C0.findIndex(c => c[1] === "ÉTAT");
    const ET = ["_etat", "ÉTAT", x => step(x), "center"]; if (i >= 0) C0[i] = [C0[i][0], "ÉTAT", x => step(x), "center"]; else C0.push(ET);
    return C0.concat([["_val", "VALIDÉ LE", x => isI(x) ? "" : svDT(dV(x) || ""), ""], ["_cree", "SAISI LE", x => svDT(dI(x) || ""), ""]]); };
  const h1 = () => { const all = o.all(), sel = sviStfGet(SK), n = all.filter(x => sviStfOk(sel, stOf(x, all))).length;
    return esc(o.name) + ` <span class="bdgl-cnt">${svCnt(n)}</span>`; };
  /* 06/11 (soir) : compteurs des états pour le menu ▾ */
  const counts = () => { const all = o.all(), C = { tout: all.length }; all.forEach(x => stOf(x, all).forEach(k => { C[k] = (C[k] || 0) + 1; })); return C; };
  const html = () => {
    SVI_STF_REG[SK] = { keys: KEYS, L: o.stLab, counts, redraw: () => { dSel = ""; draw(); } };
    const t1 = h1();
    const all = o.all(), sel = sviStfGet(SK), ST = new Map(all.map(x => [x.id, stOf(x, all)]));
    /* états (menu ▾) puis filtre commun des dates (entonnoir) : les deux se cumulent */
    const base0 = all.filter(x => sviStfOk(sel, ST.get(x.id))), base = cfApply(o.t + "_d", [["_jour", "DATE", x => achDFr(dOf(x)) || "SANS DATE", ""]], base0);
    const days = [...base.reduce((m, x) => m.set(dOf(x), (m.get(dOf(x)) || 0) + 1), new Map())].sort((a, b) => b[0].localeCompare(a[0]));
    if (dSel && !days.some(d => sviDateIn(d[0], dSel))) dSel = "";
    /* 06/11 (soir) : par défaut, la liste est classée de la plus récente à la plus ancienne (un tri par colonne passe devant) */
    const rows0 = base.filter(x => sviDateIn(dOf(x), dSel)).slice().sort((a, b) => String(dI(b) || "").localeCompare(String(dI(a) || "")) || String(o.code ? o.code(b) : b.ref || "").localeCompare(String(o.code ? o.code(a) : a.ref || ""), "fr", { numeric: true }));
    const cols = coOrder(o.t, colsOf()), rows = sviPinSort(cfApply(o.t, cols, rows0), x => x.ref || x.code);   /* série I (I4) : épinglées en tête */
    order = rows.map(x => x.id);
    const canDel = x => isI(x) && !x.del && x.state !== "annule", delCol = false;   /* série J (J4) : plus de corbeille par ligne — SUPPRIMER LES … COCHÉ(E)S dans le ⋯ */
    /* 06/11 (soir) : largeur des colonnes au moteur commun (chaque colonne se règle seule, gardée) */
    /* série J (J4) : SUPPRIMER LES … COCHÉ(E)S (⋯ de la barre du haut) — mêmes règles que l'ancienne corbeille (EN INSTANCE ; restaurable, numéro jamais réutilisé) */
    const cdOf = x => o.code ? o.code(x) : x.ref || x.code || x.id, nmOf = x => { const n = o.nom ? o.nom(x) : x.objet || x.des || ""; return cdOf(x) + (n ? " — " + n : ""); };
    { const fem = /^CETTE/.test(achCe(o.one || "")); (window.SVI_LDEL = window.SVI_LDEL || {})[o.t] = { lab: "SUPPRIMER LES " + String(o.name || "PIÈCES").toUpperCase() + (fem ? " COCHÉES" : " COCHÉS"),
      ok: id => { const x = o.all().find(y => y.id === id); return !!(x && canDel(x) && !(o.mOf && o.mOf(x))); }, nom: id => { const x = o.all().find(y => y.id === id); return x ? nmOf(x) : id; },
      /* correction (compte rendu v1006) : pièces d'achat = ANNULÉES avec un motif, gardées (comme l'ancienne corbeille, v817) ; articles, fournisseurs = corbeille restaurable */
      run: async ids => { if (o.kill) { const m = await achAsk("ANNULER LES PIÈCES COCHÉES (GARDÉES, VISIBLES DANS ANNULÉS)", "MOTIF DE L'ANNULATION"); if (!m) return;
          const L = o.all(), now = achNow(); ids.forEach(id => { const x = L.find(y => y.id === id); if (!x || !canDel(x) || (o.mOf && o.mOf(x))) return; x.state = "annule"; x.motifAnn = m; x.mod = now; achHist(x.ref || cdOf(x), "ANNULÉ — " + m, ""); }); o.save(L); draw(); return; }
        const L = o.all(), now = achNow(); ids.forEach(id => { const x = L.find(y => y.id === id); if (!x || !canDel(x)) return; x.del = now; x.mod = now; achHist(cdOf(x), "CORBEILLE", nmOf(x)); }); o.save(L); draw(); } }; }
    const W = o.w || {}, CG = sviCwCols(o.t, cols.map(c => [c[0], W[c[0]] || 120]), (delCol ? [["_del", 44]] : []).concat(ACH_AP_ON(o.k) ? [["_ap", 30]] : [], [["_cb", 28]]));
    const ED = o.edit || {};
    /* F14 (fin) : une colonne peut dépendre de la pièce (ex. CHARGE d'un besoin : liste des charges du budget, ou texte libre au SIÈGE) */
    const edOf = (k, x) => { const E = ED[k]; return typeof E === "function" ? E(x) : E; };
    const cell = (x, c) => { const v = c[2](x), cl = c[3] === "number" ? "number" : c[3] === "center" ? "center" : "";
      /* F7 (série F) : la RÉFÉRENCE est soulignée — elle ouvre la pièce */
      if (c[0] === "ref") { const w = o.why(x, all); return `<td class="bdg-ref-c ${cl}"><span class="nv-bslot">${w.length ? `<b class="obs-bang val-bang nv-bang" role="button" data-why="${esc(w.join(" · "))}">!</b>` : ""}</span><button type="button" class="nv-reflink" data-nvo="${esc(x.id)}">${esc(v)}</button>${sviPinMk(x.ref || x.code)}</td>`; }
      /* F17 (série F), 2.10 : fournisseurs = noms soulignés, chacun dans la couleur de son propre état ; toucher = sa fiche */
      const edOk = edOf(c[0], x) && isI(x) && !x.del;
      if (c[0] === "frs" && x.frs && !(o.mOf && o.mOf(x))) { const F = (Array.isArray(x.frs) ? x.frs : [x.frs]).filter(Boolean);
        return `<td class="${cl} nv-lk${edOk ? " nv-ed" : ""}"${edOk ? ` data-ed="${esc(c[0])}" data-edsel="1"` : ""} title="${esc(F.map(achFrsNom).join(", "))}">${F.map(f => `<button type="button" class="ach-link" data-nvgo="frs|${esc(f)}">${esc(achFrsNom(f))}</button>`).join(", ")}</td>`; }
      /* F14 (série F) : pièce EN INSTANCE — champ modifiable directement dans la liste (1er toucher = case choisie, 2e = saisie, règle 8.2) */
      if (edOf(c[0], x) && isI(x) && !x.del) { const t = typeof v === "number" ? achF2(v) : String(v ?? ""), E1 = edOf(c[0], x); return `<td class="${cl} nv-ed" data-ed="${esc(c[0])}"${E1 && E1.type === "sel" ? ' data-edsel="1"' : ""} title="${esc(t)}">${esc(t)}</td>`; }
      /* v910 (checklist C1.38) : 5e élément d'une colonne = image (logo) devant le texte, à la hauteur de la ligne */
      const im = c[4] ? c[4](x) : "";
      const t = typeof v === "number" ? achF2(v) : String(v ?? ""); return `<td class="${cl}" title="${esc(t)}">${im ? `<img class="nv-logo" src="${esc(im)}" alt="">` : ""}${esc(t)}</td>`; };
    /* 08/11 (document unique 6.7, remarque d'Ahmed) : ligne TOTAL des colonnes de montants (lignes affichées) ; TOTAL PARTIEL si un filtre en cache */
    const totRow = () => { const M = cols.map((c, i) => c[3] === "number" && /MONTANT|TTC|\bHT\b|RESTE|TOTAL|MOINS-DISANT/.test(String(c[1]).toUpperCase()) ? i : -1).filter(i => i >= 0); if (!M.length) return "";
      const part = rows.length < all.filter(x => !x.del).length, lab = part ? "TOTAL PARTIEL" : "TOTAL", sum = i => rows.reduce((a, x) => { const v = cols[i][2](x); return a + (typeof v === "number" ? v : 0); }, 0), li = M.includes(0) ? -1 : 0;
      return `<tfoot><tr class="bdg-d-total-row">${cols.map((c, i) => M.includes(i) ? `<td class="number">${achF2(sum(i))}</td>` : i === li ? `<td><b>${lab}</b></td>` : "<td></td>").join("")}${delCol ? "<td></td>" : ""}<td></td></tr></tfoot>`; };
    const rowCls = x => { const s = ST.get(x.id)[0]; return (s === "instance" ? "inst-instance" : s === "fige" ? "inst-fige" : "inst-valide") + " st-" + s; };
    return `<div class="novapp-list-shell"><div class="novapp-list-titlebar"><button class="novapp-menu open-menu" type="button" aria-label="Menu">☰</button><h1>${t1}</h1>${sviListIH()}${sviListBar()}</div>
      <div class="novapp-budget-layout"><aside class="novapp-date-panel svi-bdgp">
        <div class="novapp-date-head">${sviDateFold("ach_" + o.k)}${sviStfHead(SK, base.length, o.stLab, o.t + "_d")}</div>
        <div class="novapp-date-list">${sviDateTree("ach_" + o.k, days, dSel, "data-nvday", () => draw())}</div></aside>
      <div class="novapp-budget-table-wrap"><table id="${o.id}" class="novapp-budget-table svi-bdgl nv-one" data-sdel="${esc(o.t)}" data-ach="${o.k}" data-stf="${esc(SK)}" data-svcw="${esc(o.t)}" style="${CG.style}">
        ${CG.cg}
        <thead><tr>${cols.map(c => cfHead(o.t, c[0], c[1], "bdg-list-head" + (c[3] === "number" ? " number" : ""))).join("")}${delCol ? '<th class="bdg-act-h"></th>' : ""}${ACH_AP_ON(o.k) ? achApTh() : ""}${sviListCbTh()}</tr></thead>
        <tbody>${rows.map(x => `<tr data-id="${esc(x.id)}" data-iid="${esc(x.id)}" data-nvo="${esc(x.id)}" data-st="${esc(ST.get(x.id)[0])}" class="${rowCls(x)}${x.del || x.state === "annule" ? " etat-bloque" : ""}${x.actif === false ? " etat-archive" : ""}">${cols.map(c => cell(x, c)).join("")}${delCol ? `<td class="bdg-action-cell">${canDel(x) ? `<button type="button" class="bdg-row-action bdg-row-del" data-nvdel="${esc(x.id)}" title="Supprimer" aria-label="Supprimer">${SVI_DEL_ICON}</button>` : ""}</td>` : ""}${ACH_AP_ON(o.k) ? achApTd(o.k + "|" + x.id) : ""}${sviListCbTd()}</tr>`).join("")
          || ""}
          ${o.newRow ? `<tr class="bdg-newrow" data-nvnew data-st="instance"><td colspan="${cols.length + (delCol ? 2 : 1)}">${esc(o.newRow)}</td></tr>` : ""}</tbody>${totRow()}</table></div></div></div>`;
  };
  /* F14 : saisie dans la case (ENTRÉE ou toucher ailleurs = enregistré ; ÉCHAP = annulé) */
  const edit = td => { const id = td.closest("tr").dataset.id, k = td.dataset.ed, L = o.all(), x = L.find(y => y.id === id), E0 = (o.edit || {})[k], E = x && (typeof E0 === "function" ? E0(x) : E0); if (!E || !x) return;
    const v0 = E.get ? E.get(x) : x[k] ?? "", f = E.f || k;
    /* choix dans une liste (fournisseur, catégorie, mode…) : le menu commun de l'application, jamais celui de l'iPad */
    if (E.type === "sel") { const O = (E.opts ? E.opts(x) : []); sviEtatMenu(td, O.map(([v, l]) => ({ k: String(v), lab: l })), String(v0 ?? ""), nv => {
        const L2 = o.all(), y = L2.find(z => z.id === id); if (!y || String(nv) === String(v0 ?? "")) { draw(); return; } const bad = E.check ? E.check(y, nv, L2) : ""; if (bad) { svToast(bad, 3500, td); draw(); return; }
        if (E.set) E.set(y, nv); else y[f] = nv; y.mod = achNow(); o.save(L2); achHist(o.code ? o.code(y) : y.ref, "MODIFIÉ DANS LA LISTE", (E.lab || k).toUpperCase() + " : " + ((O.find(z => String(z[0]) === String(nv)) || [nv, nv])[1])); draw(); }); return; }
    /* 11/11 (Ahmed, règle 6.9) : un texte se saisit sur PLUSIEURS LIGNES (la case s'ouvre sur toute sa largeur, la ligne grandit, tout est visible) ;
       nombres et dates gardent leur champ d'une ligne */
    const ML = E.type !== "num" && E.type !== "date" && typeof window.sviTaEdit === "function";
    const inp = ML ? { value: String(v0 ?? ""), isConnected: false, addEventListener() {}, focus() {}, select() {} } : document.createElement("input"); inp.className = "ins-in nv-edin" + (E.type === "num" ? " number" : "");
    if (E.type === "date") inp.type = "date"; else if (E.type === "num") inp.inputMode = "decimal"; inp.value = E.type === "num" ? String(v0 ?? "").replace(".", ",") : String(v0 ?? "");
    const txt0 = td.textContent; inp.__edit = true; if (!ML) { td.textContent = ""; td.appendChild(inp); inp.focus(); try { inp.select(); } catch (er) {} }
    /* 10/11 (comme l'INTITULÉ de la liste BDG) : la case est remise en place SANS redessiner — ENTRÉE / ÉCHAP gardent la case sélectionnée ; ANNULER / RÉTABLIR */
    const t0 = Date.now(); let done = false; const fin = ok => { if (done) return; if (ok === "blur" && Date.now() - t0 < 600 && inp.isConnected) { setTimeout(() => { inp.__edit = true; inp.focus(); }, 0); return; } done = true; let show = txt0;
      if (ok) { const nv = E.type === "num" ? achN(inp.value) : E.type === "date" ? inp.value : E.keep ? String(inp.value).trim() : achU(inp.value);
        if (String(nv) !== String(v0 ?? "")) { const L2 = o.all(), y = L2.find(z => z.id === id); if (y) { const bad = E.check ? E.check(y, nv, L2) : ""; if (bad) { svToast(bad, 3500, td); draw(); return; }
          const before = E.get ? E.get(y) : y[f]; if (E.set) E.set(y, nv); else y[f] = nv; y.mod = achNow(); o.save(L2); achHist(o.code ? o.code(y) : y.ref, "MODIFIÉ DANS LA LISTE", (E.lab || k).toUpperCase() + " : " + nv);
            const col = colsOf().find(c => c[0] === k), v1 = col ? col[2](y) : nv; show = typeof v1 === "number" ? achF2(v1) : String(v1 ?? "");
            if (typeof sviUndoPush === "function") sviUndoPush(dir => { const L3 = o.all(), z = L3.find(q => q.id === id); if (!z) return; const w = dir === "undo" ? before : nv; if (E.set) E.set(z, w); else z[f] = w; z.mod = achNow(); o.save(L3); draw(); }, "MODIFICATION " + (E.lab ? "DE « " + String(E.lab).toUpperCase() + " »" : "DANS LA LISTE")); } } }
      td.textContent = show; td.title = show; td.classList.remove("nv-sel");
      if (ok !== "blur") { if (!td.hasAttribute("tabindex")) td.setAttribute("tabindex", "-1"); td.classList.add("svi-tdf"); try { td.focus({ preventScroll: true }); } catch (er) {} } };
    inp.addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); fin(true); } if (ev.key === "Escape") { ev.preventDefault(); fin(false); } });
    inp.addEventListener("blur", () => fin("blur"));
    if (ML) window.sviTaEdit(td, inp.value, (ok, v) => { inp.value = v; fin(ok); }); };
  /* 10/11 : plage de cases modifiables de la liste — COLLER (une ligne par case, ou la même partout) / EFFACER sur chaque case, une seule annulation */
  (window.__sviNvEdMods = window.__sviNvEdMods || {})[o.t] = async (v, tds) => { let lines = [""];
    if (v === "paste") { let t = ""; try { t = await navigator.clipboard.readText(); } catch (er) {} if (!t) t = window.__sviSelClip || ""; lines = String(t).split(/\r?\n/).map(z => z.split("\t")[0].trim()).filter(Boolean); if (!lines.length) { svToast("RIEN À COLLER : COPIEZ D'ABORD DES CASES.", 2200); return; } }
    const L = o.all(), B4 = [], AF = []; let n = 0;
    tds.forEach((td, i) => { const tr = td.closest("tr"), id = tr && tr.dataset.id, k = td.dataset.ed, x = L.find(y => y.id === id), E0 = (o.edit || {})[k], E = x && (typeof E0 === "function" ? E0(x) : E0); if (!E || E.type === "sel" || !isI(x) || x.del) return;
      const raw = v === "clear" ? "" : String(lines.length > 1 ? (lines[i] || "") : lines[0]), nv = E.type === "num" ? (raw === "" ? "" : achN(raw)) : E.type === "date" ? raw : E.keep ? raw.trim() : achU(raw), f = E.f || k;
      const bad = E.check && nv !== "" ? E.check(x, nv, L) : ""; if (bad) return; const before = E.get ? E.get(x) : x[f]; if (String(before ?? "") === String(nv)) return;
      B4.push([id, E, f, before]); AF.push([id, E, f, nv]); if (E.set) E.set(x, nv); else x[f] = nv; x.mod = achNow(); n++; });
    if (n) { o.save(L); const put = A => { const L2 = o.all(); A.forEach(([id, E, f, w]) => { const z = L2.find(q => q.id === id); if (!z) return; if (E.set) E.set(z, w); else z[f] = w; z.mod = achNow(); }); o.save(L2); draw(); };
      if (typeof sviUndoPush === "function") sviUndoPush(dir => put(dir === "undo" ? B4 : AF), v === "clear" ? "EFFACEMENT DES CASES" : "COLLAGE DES CASES"); }
    draw(); svToast(n + " CASE(S) " + (v === "clear" ? "EFFACÉE(S)." : "COLLÉE(S)."), 1800); };
  const click = async e => {
    const gl0 = e.target.closest(".ach-link[data-nvgo]"); if (gl0) { const [t, gid] = gl0.dataset.nvgo.split("|"); achGo(t, gid); return true; }   /* nom souligné = sa propre fiche */
    const ed = e.target.closest("td.nv-ed"); if (ed && !e.target.closest("input")) { if (ed.classList.contains("nv-sel")) edit(ed); else { document.querySelectorAll("td.nv-sel").forEach(t => t.classList.remove("nv-sel")); ed.classList.add("nv-sel");
        if (!ed.hasAttribute("tabindex")) ed.setAttribute("tabindex", "-1"); ed.classList.add("svi-tdf"); try { if (document.activeElement !== ed) ed.focus({ preventScroll: true }); } catch (er) {} } return true; }
    if (e.target.closest("input.nv-edin")) return true;
    const gl = e.target.closest(".ach-link[data-nvgo]"); if (gl) { const [t, gid] = gl.dataset.nvgo.split("|"); achGo(t, gid); return true; }
    const dy = e.target.closest("[data-nvday]"); if (dy) { dSel = dSel === dy.dataset.nvday ? "" : dy.dataset.nvday; draw(); return true; }
    const w = e.target.closest(".nv-bang"); if (w) { e.stopPropagation(); svToast(w.dataset.why, 4000, w); return true; }
    const dl = e.target.closest("[data-nvdel]");
    if (dl && o.kill) { const x = o.all().find(y => y.id === dl.dataset.nvdel); if (x && await o.kill(x)) draw(); return true; }
    if (dl) { const L = o.all(), x = L.find(y => y.id === dl.dataset.nvdel); if (!x) return true;
      if (!(await svConfirm({ title: "SUPPRIMER" + (o.one ? " " + achCe(o.one) : ""), text: o.code(x) + " — " + o.nom(x) + " (RESTAURABLE : CASE ANNULÉ ; SON NUMÉRO NE SERA PAS RÉUTILISÉ).", ok: "SUPPRIMER" }))) return true;
      x.del = achNow(); x.mod = x.del; o.save(L); achHist(o.code(x), "CORBEILLE", o.nom(x)); draw(); return true; }
    if (e.target.closest("[data-nvnew]")) { o.add(id => { draw();
      if (id && id !== "x" && o.page && o.all().some(x => x.id === id)) o.page(id); }); return true; }   /* v800 (3.6) : la page de la nouvelle pièce s'ouvre */
    /* 09/11 (règle 2.10) : une ligne qui a sa référence soulignée ne s'ouvre que par elle ; la partie vide suit la règle commune (sélection) */
    const tr0 = e.target.closest("tr[data-nvo]"), viaLink = tr0 && tr0.querySelector("button[data-nvo]");
    const r = e.target.closest("button, .cf-btn, thead") || viaLink ? e.target.closest("button[data-nvo]") : e.target.closest("[data-nvo]");
    if (r) { o.page(r.dataset.nvo || r.dataset.id); return true; }
    return false;
  };
  return { html, click, h1, order: () => order };
}
/* F14 (série F, 06/11) : TOUS LES CHAMPS MODIFIABLES DIRECTEMENT DANS LES LISTES (pièce EN INSTANCE) — colonne → champ de la fiche, type (texte,
   nombre, date, choix) et contrôle ; les colonnes calculées (montants, compteurs, état, dates de saisie) et la référence restent en lecture seule */
const achEdFrs = () => achLive(achFrs()).filter(f => achFrsOk(f)).map(f => [f.id, f.nom]);
const ACH_ED = {
  caf: { objet: { lab: "OBJET" }, dlim: { lab: "DATE LIMITE", type: "date" } },
  dvf: { caf: { lab: "CONSULTATION", type: "sel", opts: () => [["", "HORS CONSULTATION"]].concat(achCaf().filter(c => c.state === "ouverte").map(c => [c.id, c.ref + (c.objet ? " — " + c.objet : "")])) },
    frs: { lab: "FOURNISSEUR", type: "sel", opts: achEdFrs }, nfrs: { lab: "N° FOURNISSEUR", f: "refFrs" }, date: { lab: "DATE", type: "date" }, val: { lab: "VALIDITÉ", type: "date", f: "validite" } },
  cmf: { nat: { lab: "NATURE" }, frs: { lab: "FOURNISSEUR", type: "sel", opts: achEdFrs }, lieu: { lab: "LIVRAISON" }, prom: { lab: "DATE PROMISE", type: "date", f: "dProm", get: c => c.dProm || "" } },
  faf: { cmf: f => f.fa !== undefined || f.type === "acompte" ? null : { lab: "COMMANDE", type: "sel", opts: y => [["", "SANS COMMANDE"]].concat(achCmf().filter(c => c.frs === y.frs && (c.state === "valide" || c.state === "solde")).map(c => [c.id, c.ref])), get: y => y.cmf || "",
      set: (y, v) => { const C = achCmf().find(c => c.id === v); y.cmf = v; y.lignes = C ? achFafCmfLines(C, y.id) : []; y.rem = C ? achN(C.rem) : 0; y.avImp = C ? achAvReste(C.id, y.id) : 0; y.frais = 0; } },
    num: { lab: "N° FACTURE" }, frs: { lab: "FOURNISSEUR", type: "sel", opts: achEdFrs }, dfac: { lab: "DATE", type: "date", f: "dFac" } },
  avf: { num: { lab: "N° AVOIR" }, date: { lab: "DATE", type: "date" }, ttc: { lab: "MONTANT TTC", type: "num", get: a => achN(a.ttc) }, motif: { lab: "MOTIF" } },
  paf: { frs: { lab: "FOURNISSEUR", type: "sel", opts: achEdFrs }, mode: { lab: "MODE", type: "sel", opts: () => ACH_MODES.map(m => [m, m]) }, num: { lab: "N°" }, date: { lab: "DATE", type: "date" },
    mt: { lab: "MONTANT", type: "num", check: (p, v) => v > 0 ? "" : "MONTANT NON VALIDE." } },
  rcp: { nbl: { lab: "N° BL" } },
  rtr: { motif: { lab: "MOTIF" } },
  bsn: { bdg: { lab: "BUDGET", type: "sel", opts: () => [["SIÈGE", "SIÈGE (HORS BUDGET)"]].concat(achBdgList().map(x => [x.ref, x.lab])), get: b => b.centre === "SIÈGE" ? "SIÈGE" : b.bdg || "",
      set: (b, v) => { b.chg = ""; b.tache = ""; b.des = ""; b.u = ""; b.pu = 0;
        if (v === "SIÈGE") { b.centre = "SIÈGE"; b.bdg = ""; b.bdgLab = ""; } else { b.centre = "CHANTIER"; b.bdg = v; b.bdgLab = (achBdgList().find(x => x.ref === v) || {}).lab || v; } } },
    des: b => b.centre === "SIÈGE" ? { lab: "CHARGE", check: (y, v) => v ? "" : "CHARGE OBLIGATOIRE." }
      : b.bdg ? { lab: "CHARGE", type: "sel", opts: y => achBdgCharges(y.bdg).map(c => [c.key, c.des + " (" + c.u + ")"]), get: y => y.chg || "",
        set: (y, v) => { const c = achBdgCharges(y.bdg).find(z => z.key === v); y.chg = v; y.tache = c && c.tasks.length === 1 ? c.tasks[0] : ""; if (c) { y.des = c.des; y.u = c.u; y.pu = Math.round(c.p * 100) / 100; } } } : null,
    q: { lab: "QUANTITÉ", type: "num", check: (b, v) => v > 0 ? "" : "QUANTITÉ OBLIGATOIRE (> 0)." }, tache: { lab: "TÂCHE" }, prevue: { lab: "PRÉVU LE", type: "date", f: "datePrevue" }, dem: { lab: "DEMANDEUR" } },
  art: { nom: { lab: "DÉSIGNATION", f: "des", check: (a, v, L) => !v ? "DÉSIGNATION OBLIGATOIRE." : achArtDup(L, v, a.u, a.id) ? "UN ARTICLE IDENTIQUE EXISTE." : "" },
    u: { lab: "UNITÉ", check: (a, v, L) => !v ? "UNITÉ OBLIGATOIRE." : achArtDup(L, a.des, v, a.id) ? "UN ARTICLE IDENTIQUE EXISTE." : "" },
    cat: { lab: "CATÉGORIE", type: "sel", opts: () => [["", "—"]].concat(achPrm().cat.map(c => [c, c])) }, pref: { lab: "PRIX RÉF. HT", type: "num" }, pmax: { lab: "PLAFOND HT", type: "num" } },
  frs: { nom: { lab: "NOM", check: (f, v) => v ? "" : "NOM OBLIGATOIRE." }, ville: { lab: "VILLE" }, ice: { lab: "ICE", f: "ice", check: (f, v) => !v || achIceOk(v) ? "" : "ICE : 15 CHIFFRES." }, cond: { lab: "PAIEMENT" } }
};
const achPcCirc = x => !!x.circ && !["valide", "bap", "emis", "encaisse", "solde", "annule", "retenu"].includes(x.state) && typeof achCircDone === "function" && !achCircDone(x);
/* 06/11 : ÉTAT d'une pièce, d'un fournisseur, d'un article — un des états communs de la palette (liste, fiche, fenêtre, noms liés) */
/* v1119 (L20) : une consultation est « envoyée » dès qu'une consultation fille (par fournisseur) est partie */
const achCafSent = x => Object.values((x && x.fil) || {}).some(f => f && f.env) || Object.values((x && x.rep) || {}).some(r => r && r.env);
/* v1121 (L20) : tous les fournisseurs consultés ont répondu (devis reçu ou décliné) */
const achCafAllRep = x => { const F = (x && x.frs) || []; if (!F.length || !achCafSent(x)) return false; const D = achDvf(); return F.every(f => ((x.rep || {})[f] || {}).st === "decline" || D.some(v => v.caf === x.id && v.frs === f && v.state !== "annule")); };
const achPcSt = (t, x) => { if (!x) return "";
  if (x.del || x.state === "annule" || x.state === "rejete") return "annule";
  if (t === "frs" || t === "art" || t === "cli" || t === "prj") { if (x.arch) return "archive"; if (x.bloq || x.actif === false) return "bloque";
    if (t === "frs" && achSt(x) !== "instance" && typeof achFrsAttExp === "function") { try { if (achFrsAttExp(x)) return "expire"; } catch (e) {} } return achSt(x); }
  if (achPcCirc(x)) return "encours";
  if (x.susp || x.litige) return "bloque";
  if (t === "dvf") { if (x.state === "recu" || !x.state) { const L = x.lignes || []; if (L.some(l => achN(l.pu) > 0) && L.some(l => !(achN(l.pu) > 0))) return "partiel"; return "instance"; }
    if (x.exp && String(x.exp).slice(0, 10) < new Date().toISOString().slice(0, 10) && x.state !== "retenu") return "expire"; return "valide"; }
  if (t === "cmf" && x.state === "valide") { try { const R = achRcp(), T = achRtr(), L = x.lignes || [], got = L.some(l => achRecQ(x.id, l.id, R, T) > 0), rest = L.some(l => achResteQ(x, l, R, T) > 1e-9);
    if (got && rest) return "partiel"; if (!got && x.envoi) return "remis"; } catch (e) {} return "valide"; }
  if (t === "faf") { if (x.state === "bap") { try { if (achFafReste(x) > 0.005 && achFafPaid(x.id) > 0) return "partiel"; } catch (e) {} return "valide"; } return "instance"; }
  if (t === "paf") return x.state === "emis" ? "remis" : x.state === "encaisse" ? "valide" : "instance";
  if (t === "bsn") { if (x.state !== "valide") return "instance"; try { const a = achBsnAv(x), q = achN(x.q); if (a.cmdQ > 0 && q && a.recQ < q - 1e-9) return "partiel"; } catch (e) {} return "valide"; }
  /* v1121 (L20, série L, cycle d'Ahmed, règle 1.2 sans exception) : ROUGE en création ; VERT en cours de validation (circuit, plus haut) ;
     ORANGE validée mais pas encore remise ; BLEU remise, des devis encore attendus ; NOIR tous les fournisseurs ont répondu, ou close par un validateur */
  if (t === "caf") return x.state !== "ouverte" || achCafAllRep(x) ? "valide" : achCafSent(x) ? "partiel" : x.val ? "remis" : "instance";
  if (x.state === "instance" || x.state === "ouverte" || x.state === "recu" || x.state === "reclame") return "instance";
  if (x.state === "emis") return "remis";
  return "valide"; };
/* E3 (série E) : colonne ÉTAT = l'étape exacte où en est la pièce */
const achPcStep = (t, x) => { if (!x) return "";
  if (x.del) return "SUPPRIMÉ";
  if (t === "frs" || t === "art" || t === "cli" || t === "prj") { const s = achPcSt(t, x); return { instance: "EN INSTANCE", valide: "VALIDÉ", bloque: "BLOQUÉ", archive: "ARCHIVÉ", expire: "ATTESTATION FISCALE EXPIRÉE" }[s] || ""; }
  if (achPcCirc(x)) return "EN COURS DE VALIDATION — " + achCircNext(x).map(achGradeLab).join(x.circ.h ? " PUIS " : " OU ");
  if (x.renv && x.renv.length && x.state === "instance" && !x.circ) return "RENVOYÉE PAR " + achGradeLab(x.renv[x.renv.length - 1].g);
  if (x.susp) return "SUSPENDUE"; if (x.litige) return "EN LITIGE";
  try {
    if (t === "bsn") return achBsnAvLab(x);
    if (t === "caf") { if (x.state === "ouverte" && achCafAllRep(x)) return "TOUS LES FOURNISSEURS ONT RÉPONDU — À CLÔTURER"; if (x.state === "ouverte" && !achCafSent(x) && x.val) return "VALIDÉE — À REMETTRE"; if (x.state === "ouverte" && achCafSent(x)) { const F = x.frs || [], n = F.filter(f => achDvf().some(v => v.caf === x.id && v.frs === f && v.state !== "annule")).length; return "REMISE — " + n + " / " + F.length + " DEVIS"; } return { ouverte: "EN RÉDACTION", close: "CLOSE", annule: "ANNULÉE" }[x.state] || ""; }
    if (t === "dvf") { const s = achPcSt(t, x); return x.state === "retenu" ? "RETENU" : x.state === "rejete" ? "REJETÉ" : x.state === "annule" ? "ANNULÉ" : s === "partiel" ? "CHIFFRÉ EN PARTIE" : s === "expire" ? "EXPIRÉ" : "REÇU"; }
    if (t === "cmf") { const s = achPcSt(t, x); if (x.state === "valide") return s === "partiel" ? "REÇUE EN PARTIE" : s === "remis" ? "REMISE AU FOURNISSEUR" : (x.lignes || []).length && (x.lignes || []).every(l => achResteQ(x, l) <= 1e-9) ? "REÇUE" : "VALIDÉE";
      return ACH_CMF_ST[x.state] || ""; }
    if (t === "rcp") return x.state === "annule" ? "ANNULÉE" : x.pv ? "PV DE SERVICE FAIT" : "RÉCEPTIONNÉE";
    if (t === "faf") return achFafEtat(x);
    if (t === "paf") return ACH_PAF_ST[x.state] || "";
  } catch (e) {}
  return { instance: "EN INSTANCE", valide: "VALIDÉ", annule: "ANNULÉ" }[x.state] || ""; };

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
/* 11/11 (Ahmed, validé) : blocs de la consultation renommés — ARTICLES CONSULTÉS, FOURNISSEURS CONSULTÉS, DOCUMENTS ENVOYÉS ;
   les réglages gardés sous les anciens noms (hauteur, largeurs, colonnes masquées, ordre) sont recopiés une fois sous les nouveaux */
(() => { try { if (localStorage.getItem("svi_mig_cafblk_v1")) return; const M = [["dtailconsultation", "articlesconsults"], ["fournisseurs", "fournisseursconsults"], ["documents", "documentsenvoys"]];
  const J = k => { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch (e) { return {}; } }, S = (k, o) => { try { localStorage.setItem(k, JSON.stringify(o)); } catch (e) {} };
  const H = J(ACH_NVH_K); M.forEach(([a, b]) => { if (H[a] !== undefined && H[b] === undefined) H[b] = H[a]; }); S(ACH_NVH_K, H);
  ["svi_colw_v1", "svi_colh_v1", "svi_colorder_v1"].forEach(k => { const O = J(k); Object.keys(O).forEach(x => M.forEach(([a, b]) => { const pa = "achp_" + a, pb = "achp_" + b;
    if (x === pa || x.startsWith(pa + ".") || x === pa + "_i" || x === pa + "_v") { const y = pb + x.slice(pa.length); if (O[y] === undefined) O[y] = O[x]; } })); S(k, O); });
  localStorage.setItem("svi_mig_cafblk_v1", "1"); } catch (e) {} })();
/* 05/11 (document unique 4.3) : pendant la saisie, la DERNIÈRE ligne écrite se voit — après une création par la ligne CRÉER … ICI d'un bloc,
   son tableau descend jusqu'en bas dès qu'il est redessiné avec une ligne de plus (au repos, il montre la première) */
{ let pend = null;
  const keyOf = el => { const b = el.closest(".nvp-blk, .bdg-d-block"); const h = b && b.querySelector("[data-nvh]"); return h ? h.dataset.nvh : b && b.querySelector(".rec-scroll") ? "rec" : ""; };
  const rows = sc => sc.querySelectorAll("tbody tr:not(.rec-new):not(.bdg-newrow):not(.ach-new):not([data-nvnew]):not([data-nvradd])").length;
  document.addEventListener("click", e => { const r = e.target.closest && e.target.closest("tr.rec-new, tr.bdg-newrow, tr[data-nvnew], tr[data-nvradd], tr.ach-new"); if (!r || !r.closest(".nvp")) return;
    const k = keyOf(r), sc = r.closest(".rec-scroll"); if (!k || !sc) return; pend = { k, n: rows(sc), t: Date.now() }; }, true);
  new MutationObserver(() => { if (!pend) return; if (Date.now() - pend.t > 120000) { pend = null; return; }
    const pg = document.querySelector("#ach .nvp"); if (!pg) return; const h = pg.querySelector(`[data-nvh="${pend.k}"]`), b = h && h.closest(".nvp-blk, .bdg-d-block"), sc = b && b.querySelector(".rec-scroll");
    if (!sc || rows(sc) <= pend.n) return; if (!pend.ok) { pend.ok = Date.now(); const me = pend; setTimeout(() => { if (pend === me) pend = null; }, 1500); }
    const go = () => { if (sc.isConnected) sc.scrollTop = sc.scrollHeight; }; go(); requestAnimationFrame(go); setTimeout(go, 120); }).observe(document.documentElement, { childList: true, subtree: true });
}
/* 07/11 (document unique 4.3, vérification des gestes) : une hauteur réglée à la poignée est gardée telle quelle, même au-delà des lignes (vide dessous permis) */
const achNvhSet = k => { try { return !!(JSON.parse(localStorage.getItem(ACH_NVH_K) || "{}") || {})[k]; } catch (e) { return false; } };
const achNvhSc = k => achNvhSet(k) ? `height:var(--nvh-${k});max-height:none` : `max-height:var(--nvh-${k}, var(--svi-hdef-a, 200px))`;
const achNvhStyle = () => { let H = {}; try { H = JSON.parse(localStorage.getItem(ACH_NVH_K) || "{}") || {}; } catch (e) {} return Object.keys(H).map(k => "--nvh-" + k + ":" + H[k] + "px").join(";"); };
/* 08/11 (document unique 4.3, remarque d'Ahmed) : hauteur minimale d'un bloc = titres des colonnes + r lignes de DONNÉES + ligne CRÉER … ICI
   + ligne TOTAL — jamais un bloc réduit qui ne montre que le TOTAL */
function achNvhMin(sc, r) { const th = sc.querySelector("thead"), rows = [...sc.querySelectorAll("tbody tr, tfoot tr")];
  const isN = x => x.matches(".rec-new, .bdg-newrow, .ach-new, [data-nvnew], [data-nvradd]"), isT = x => x.matches(".bdg-d-total-row, tfoot tr") || /^\s*TOTAL/.test(x.textContent || "");
  const nr = rows.find(isN), tr = rows.find(isT), d1 = rows.find(x => !isN(x) && !isT(x)), h = x => x ? x.getBoundingClientRect().height : 0;
  return Math.ceil((th ? h(th) : 22) + r * (d1 ? h(d1) : 21) + h(nr) + h(tr)) + 4; }
/* 11/11 (Ahmed) : hauteur par défaut d'un bloc de fiche = titres + n lignes de données (PARAMÉTRAGE › BLOCS › LIGNES AFFICHÉES PAR DÉFAUT)
   + ligne CRÉER + ligne TOTAL, mesurée sur les vraies lignes (avant : formule fixe pour des lignes de 34 px, soit 8 à 9 lignes visibles) ; hauteur réglée à la main gardée */
function achNvhFloor() { let n = 5; try { n = sviBlkRows().n; } catch (e) {}
  document.querySelectorAll("#ach .nvp .rec-scroll").forEach(sc => { if (sc.style.maxHeight === "none") return; sc.style.maxHeight = achNvhMin(sc, n) + "px";
    const m = achNvhMin(sc, 1); if (sc.getBoundingClientRect().height < m - 1) sc.style.height = m + "px"; }); }
function achNvhDrag(e, h) {
  e.preventDefault(); const pg = h.closest(".nvp"), k = h.dataset.nvh, sc = h.parentNode.querySelector(".rec-scroll"); if (!pg || !sc) return;
  const y0 = e.clientY, b0 = sc.getBoundingClientRect().height; let v = b0; h.classList.add("on");
  /* 05/11 : hauteur d'un bloc — il grandit avec ses lignes jusqu'à 5 (vide : titres seuls) ; la poignée le règle ; jamais moins d'une ligne,
     deux s'il a sa ligne CRÉER … ICI (la ligne CRÉER et une ligne de données) */
  const minH = achNvhMin(sc, 1);
  const mv = ev => { ev.preventDefault(); v = Math.max(minH, Math.round(b0 + ev.clientY - y0)); pg.style.setProperty("--nvh-" + k, v + "px"); sc.style.height = "var(--nvh-" + k + ")"; sc.style.maxHeight = "none"; };
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
/* 11/11 (Ahmed, validé) : fiche d'une pièce — un bloc de pièces liées vide ne s'affiche pas, sauf s'il permet d'en créer une (ligne CRÉER) ou s'il porte les lignes (DÉTAIL) */
function achNvPageHTML(p, rec, ctx) {
  /* v1119 (L14) : rangée de titres de groupes au-dessus des colonnes (ex. nom du fournisseur sur PRIX UNITAIRE TTC et MONTANT TTC) — suit l'ordre des colonnes */
  const grpRow = (L, J, RD, AP) => { const out = []; J.forEach(j => { const g = L.grp[j] || "", last = out[out.length - 1]; if (last && last.g === g && g) last.n++; else out.push({ g, n: 1 }); });
    return `<tr class="nvp-grp">${RD ? "<th></th>" : ""}${out.map(o => `<th colspan="${o.n}" class="center">${esc(o.g)}</th>`).join("")}${AP ? "<th></th>" : ""}<th></th></tr>`; };
  const blk = L => { const k = achNvhKey(L.t), t = "achp_" + k, n = L.cols.length;
    /* B47 (05/11) : ordre des colonnes gardé (glisser un titre, moteur commun coOrder, comme le budget) */
    /* F3 (série F) : une case peut porter du HTML (champ de saisie, bouton) — { h: html, t: texte pour le tri et le filtre } */
    const tv = v => v && typeof v === "object" && v.h !== undefined ? v.t ?? "" : v;
    const C = coOrder(t, L.cols.map((c, j) => ["c" + j, c[0], r => tv(r.cells[j]), c[1] || ""])), J = C.map(c => +c[0].slice(1));
    /* F3 : RONDS à gauche (liaisons, règle 2.5) — r.rd = { k, st : "" | "lie" | "choisi" } */
    const RD = L.rows.some(r => r.rd);
    const R0 = L.rows.map((r, i) => ({ ...r, __i: i })), R = ctx && ctx.cfApply ? ctx.cfApply(t, C, R0) : R0;
    const head = C.map(c => ctx && ctx.cfHead ? ctx.cfHead(t, c[0], c[1], c[3]) : `<th class="${c[3]}">${esc(c[1])}</th>`).join("");
    /* v793 : largeur des colonnes réglable et gardée (moteur commun sviCwCols / data-svcw) */
    const CG = sviCwCols(t, (L.rows.some(r => r.rd) ? [["_rd", 28]] : []).concat(C.map((c, j) => [c[0], j === 0 ? 170 : /number/.test(c[3]) ? 110 : /center/.test(c[3]) ? 90 : 150])), (R0.some(achApOf) ? [["_ap", 30]] : []).concat([["_cb", 28]]));
    const AP = R0.some(achApOf);
    const iM = L.cols.findIndex(c => /^MONTANT/.test(c[0])), isL = (/^DÉTAIL (?!FACTURE STANDARD)/.test(L.t) || L.lines) && iM >= 0;   /* F11 : TOTAL des DÉTAILS (TOTAL PARTIEL si filtre) */
    /* B3 (série B, 04/11/2026) : toute la ligne d'une pièce liée prend la couleur de son état (rouge, vert, bleu, orange, noir) */
    const iE = L.cols.findIndex(c => /^ÉTAT|^RÉPONSE/.test(c[0])), stOf = r => r.st !== undefined ? r.st : iE < 0 ? "" : achStTxt(r.cells[iE]);
    const tot = isL ? R.reduce((s2, r) => s2 + (typeof tv(r.cells[iM]) === "number" ? tv(r.cells[iM]) : achN(tv(r.cells[iM])) || 0), 0) : 0;
    return `<div class="bdg-d-block nvp-blk" data-nvb="${k}"><div class="bdg-d-block-title blk-head"><span class="ttl">${esc(L.t)} ${(nt => svCnt(R.filter(nt).length, L.rows.filter(nt).length))(r => !/\bnvp-gt\b/.test(r.cls || ""))}</span>${achBlkTools(k)}</div>
      <div class="rec-scroll" style="${achNvhSc(k)}"><table class="bdg-d-table rec-table" data-colh="${esc(t)}" data-svcw="${esc(t)}" style="${CG.style}">${CG.cg}<thead>${L.grp ? grpRow(L, J, RD, AP) : ""}<tr>${RD ? `<th class="nvp-rdh">${L.rdh || ""}</th>` : ""}${head}${AP ? achApTh() : ""}<th class="center nvp-cbh" data-cokey="_cb"><input type="checkbox" class="nvp-all" aria-label="Tout cocher"></th></tr></thead>
      <tbody>${R.map(r => `<tr class="${r.cls || ""}${stOf(r) ? " nvr-" + stOf(r) : ""}" data-ri="${r.__i}">${RD ? `<td class="nvp-rdc">${r.rd ? `<button type="button" class="nvp-rd${r.rd.st ? " rd-" + r.rd.st : ""}" data-rd="${esc(r.rd.k)}" aria-label="Liaison"></button>` : ""}</td>` : ""}${J.map(j => { const v = r.cells[j], g = (r.go || []).find(z => z[0] === j); if (v && typeof v === "object" && v.h !== undefined) return `<td class="${L.cols[j][1] || ""}"${v.st ? ` style="${esc(v.st)}"` : ""}>${v.h}</td>`;   /* v1119 : style de case (dégradé du comparatif) */ return `<td class="${L.cols[j][1] || ""}">${j === 0 && r.open ? `<button type="button" class="ach-link" data-nvl="${esc(L.t)}|${r.__i}">${esc(v)}</button>` : g ? `<button type="button" class="ach-link" data-nvgo="${esc(g[1] + "|" + g[2])}">${esc(v)}</button>` : esc(typeof v === "number" ? achF2(v) : v)}</td>`; }).join("")}${AP ? achApTd(achApOf(r)) : ""}<td class="center"><input type="checkbox" class="nvp-cb"${r.ck ? " checked" : ""}></td></tr>`).join("")}${L.add ? `<tr class="rec-new" data-nvadd="${k}"><td colspan="${n + 1 + (RD ? 1 : 0) + (AP ? 1 : 0)}">${esc(L.add)}</td></tr>` : ""}</tbody>
      ${isL ? `<tfoot><tr class="bdg-d-total-row">${RD ? "<td></td>" : ""}${J.map((j, jj) => j === iM ? `<td class="number">${achF2(tot)}</td>` : jj === J.indexOf(iM) - 1 ? `<td class="number">${R.length < L.rows.length ? "TOTAL PARTIEL" : "TOTAL"}</td>` : "<td></td>").join("")}${AP ? "<td></td>" : ""}<td></td></tr></tfoot>` : ""}</table></div>
      <div class="blk-rsz nvp-rsz" data-nvh="${k}" title="Glisser pour changer la hauteur"></div></div>`; };
  /* 06/11 (décision) : un seul type de fiche, colorée selon l'état de la pièce (palette : en instance, remise, en cours de validation, en partie, validée…) */
  const pst = p.del ? "annule" : p.st || "valide", pcl = pst === "instance" ? "bdg-inst-instance" : pst === "valide" ? "nvp-valide" : pst === "fige" ? "bdg-inst-fige" : "bdg-inst-fige nvp-stc";
  return `<div class="nvp bdg-d-page ${pcl}" data-st="${esc(pst)}" style="${achNvhStyle()}${pcl.includes("nvp-stc") ? ";--inst:var(--st-" + pst + ");--inst-bg:#f6f7f9;--inst-hatch:#eef0f3" : ""}">
    <div class="bdg-d-sticky"><div class="novapp-list-titlebar">
      <button type="button" class="novapp-menu open-menu" aria-label="Menu">☰</button>
      <h1 class="bdg-d-h1 nvp-ref${p.del ? " nv-strike" : ""}">${esc(p.ref || p.code)}</h1>
      <span class="bdg-d-badge bdg-d-inf" data-nvp="info" role="button" title="Informations">i</span>
      <span class="bdg-d-badge ach-h" data-h="${esc(p.code)}" role="button" title="Historique">H</span>${sviPinBtn(p.ref || p.code)}
      ${sviHdrBar({ attr: "nvp", n: p.why.length, why: { undo: "RIEN À ANNULER SUR CETTE FICHE.", redo: "RIEN À RÉTABLIR SUR CETTE FICHE.", todo: p.why.length ? "" : "AUCUNE ALERTE." } })}
    </div>${p.lkBar ? `<div class="nvp-lkbar">${p.lkBar}</div>` : ""}</div>   <!-- v1126 (L6 – L8) : ✓ LIER / ✕ DÉLIER en haut à droite -->
    ${p.links.filter(L => (L.rows && L.rows.length) || L.add || L.lines || /^DÉTAIL/.test(L.t)).map(blk).join("")}
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
  const Lg0 = P.links.find(l => l.lines || /^DÉTAIL (?!FACTURE STANDARD)/.test(l.t)) || P.links[0] || { t: "", cols: [], rows: [] };
  /* v786 : l'aperçu suit les colonnes affichées à l'écran */
  const tb = document.querySelector(`#ach table[data-colh="achp_${achNvhKey(Lg0.t)}"]`), vis = tb ? sviColhVis(tb) : null, vf = a => vis ? a.filter((_, i) => vis.includes(i)) : a;
  let Lg = { ...Lg0, cols: vf(Lg0.cols), rows: Lg0.rows.map(r => ({ ...r, cells: vf(r.cells) })) };
  /* F10 (série F) : le prix standard, le PRIX ESTIMÉ et les montants estimés ou budgétés ne sont JAMAIS imprimés pour le fournisseur */
  { const keep = Lg.cols.map((c, i) => /PRIX ESTIMÉ|PRIX STANDARD|MONTANT ESTIMÉ|BUDGÉTÉ|BUDGET HT|SOURCE DU PRIX/.test(c[0]) ? -1 : i).filter(i => i >= 0); if (keep.length < Lg.cols.length) Lg = { ...Lg, cols: keep.map(i => Lg.cols[i]), rows: Lg.rows.map(r => ({ ...r, cells: keep.map(i => r.cells[i]) })) }; }
  if (o.noPrice) { const keep = Lg.cols.map((c, i) => /PU|PRIX|MONTANT|TVA/.test(c[0]) ? -1 : i).filter(i => i >= 0); Lg = { ...Lg, cols: keep.map(i => Lg.cols[i]), rows: Lg.rows.map(r => ({ ...r, cells: keep.map(i => r.cells[i]) })) }; }
  const K = cfg.list.k, pr = achPrm(), lettres = P.ttc && !o.noPrice ? "ARRÊTÉ(E) À LA SOMME DE : " + frMoney(P.ttc) + " TTC." : "";
  const mention = K === "cmf" ? "N° " + (P.ref || P.code) + " À REPORTER SUR LE BON DE LIVRAISON ET LA FACTURE." : K === "caf" ? "MERCI DE RAPPELER LA RÉFÉRENCE " + (P.ref || P.code) + " DANS VOTRE DEVIS." : "";
  /* B14 (série B) : mentions de la société cochées dans ACHATS › PARAMÈTRES (valeurs de PARAMÉTRAGE GÉNÉRAL › SOCIÉTÉ) */
  const SO = sviSoc(), soc = SVI_SOC_F.filter(([f]) => f !== "rs" && f !== "adr" && pr.ment[f] && SO[f]).map(([f, l]) => l + " : " + SO[f]).join(" — ");
  sviMep.open({ key: "ACH-" + String(cfg.list.k || "X").toUpperCase() + (o.noPrice ? "-SP" : ""), title: cfg.list.one + (o.noPrice ? " (SANS PRIX)" : ""), ref: P.ref || P.code, party: P.party || P.title, date: P.date || "", prelim: ["instance", "fige", "encours"].includes(P.st),
    cols: Lg.cols.map((c, i) => ["c" + i, c[0], c[1] || ""]), rows: Lg.rows.map(r => r.cells), tot: o.noPrice ? [] : P.tot || [], note: [lettres, mention, soc].filter(Boolean).join("\n"),
    auto: K === "cmf" ? achPrtAuto(P) : [],
    annex: K === "cmf" ? (() => { const C = achCmf().find(c => c.ref === (P.ref || P.code)), L = (C && Array.isArray(C.cla) ? C.cla : achClCopy(pr.clP)).filter(x => x.txt || x.v || x.t !== "autre");
      return { title: "CLAUSES PARTICULIÈRES", items: L.map(x => { const [a, b] = achClTxt(x).length === 2 ? achClTxt(x) : x.t === "autre" ? ["", achClTxt(x)[0] || ""] : [achClTxt(x)[0], ""]; return [a, b]; }) }; })() : null,
    fields: { ...Object.fromEntries((K === "cmf" ? achPrtAuto(P) : []).map(([id, l, v]) => ["a_" + id, l + " : " + v])), projet: P.projet || "", ttc: P.ttc && !o.noPrice ? achF2(P.ttc) + " MAD" : "", numFrs: P.numFrs || "", lettres, mention, soc },
    name: (P.ref || P.code) + " " + cfg.list.one, save: async (b, n) => { const r = await rec.savePdf(b, n); if (redraw) setTimeout(redraw, 0); return r; } });
}
/* 08/11 (série I, I3, document unique 3.1) : FERMER REVIENT PAS À PAS — chemin suivi d'une page à l'autre (liste › consultation › devis › fournisseur) ;
   FERMER ramène à la page d'avant, puis à celle d'avant… jusqu'à la liste ; le menu ≡ repart d'un chemin vide (aller ailleurs d'un coup) */
const ACH_PATH = [];
/* correction (compte rendu v1003) : le nom du tiers dans le bandeau du centre (#sviScreenTag, hors du corps de l'écran) ouvre sa fiche */
document.addEventListener("click", e => { const g = e.target.closest && e.target.closest("#sviScreenTag [data-nvgo]"); if (!g) return; e.preventDefault(); e.stopPropagation(); const [t, id] = g.dataset.nvgo.split("|"); achGo(t, id); }, true);
/* 10/11 (document unique 3.7, complément) : FERMER ramène EXACTEMENT à la position d'avant — liste ou fiche, défilement, ligne sélectionnée ; filtres et recherche restent ceux de la liste */
const achPosKey = (el, root) => { const c = String(el.className && el.className.baseVal === undefined ? el.className : "").trim().split(/\s+/)[0] || ""; const sel = el.tagName.toLowerCase() + (c ? "." + CSS.escape(c) : ""); return [sel, [...root.querySelectorAll(sel)].indexOf(el)]; };
function achPosSnap(v) { const S = { sc: [], win: [scrollX, scrollY], cell: null };
  v.querySelectorAll("*").forEach(el => { if (el.scrollTop > 0 || el.scrollLeft > 0) S.sc.push([...achPosKey(el, v), el.scrollLeft, el.scrollTop]); });
  const a = document.activeElement, l = achPosSnap.last, td = (a && v.contains(a) && a.closest("td")) || (l && l.isConnected && v.contains(l) && l.closest("td")), tr = td && td.closest("tr[data-id]");
  if (tr) S.cell = [tr.dataset.id, td.cellIndex]; return S; }
document.addEventListener("pointerdown", e => { achPosSnap.last = e.target; }, true); document.addEventListener("click", e => { achPosSnap.last = e.target; }, true);
function achPosRestore(v, S) { if (!v || !S) return; const go = () => {
    S.sc.forEach(([sel, i, l, t]) => { const el = v.querySelectorAll(sel)[i]; if (el) { el.scrollLeft = l; el.scrollTop = t; } });
    if (S.win) window.scrollTo(S.win[0], S.win[1]);
    if (S.cell) { const tr = [...v.querySelectorAll("tr[data-id]")].find(r => r.dataset.id === S.cell[0]), td = tr && tr.cells[S.cell[1]];
      if (td && document.activeElement !== td) { if (!td.hasAttribute("tabindex")) td.setAttribute("tabindex", "-1"); td.classList.add("svi-tdf"); try { td.focus({ preventScroll: true }); } catch (er) {} } } };
  requestAnimationFrame(() => requestAnimationFrame(go)); setTimeout(go, 220); }
const achPathBack = () => { const w = ACH_PATH.pop(); if (!w) return false; achPathBack.on = true;
  try { if (w.view) { const nb = document.querySelector(`#navMenu .nav-btn[data-view="${w.view}"]:not([data-ach])`); if (nb) nb.click(); return true; }
    const v = document.getElementById("ach"); if (v && !v.classList.contains("active-view")) { const nb = document.querySelector(`#navMenu .nav-btn[data-ach="${w.t}"]`); if (nb) nb.click(); }
    achGo(w.t, w.id); } finally { achPathBack.on = false; } achPosRestore(document.getElementById("ach"), w.snap); return true; };
/* 11/11 (Ahmed, document unique 3.1 modifié) : le menu ≡ NE VIDE PLUS le chemin — l'écran quitté par le menu y entre comme les autres ;
   seule la première interface ouverte (rien derrière) a son ✕ grisé. Un autre module (accueil, budgets…) entre aussi : le ✕ y ramène. */
document.addEventListener("click", e => { const nb = e.target.closest && e.target.closest("#navMenu .nav-btn"); if (!nb || achPathBack.on) return;
  const cv = document.querySelector(".view.active-view"), v = document.getElementById("ach"); if (!cv) return;
  if (cv === v && v.__achWhere) { const w = v.__achWhere(); if (!w || (nb.dataset.view === "ach" && nb.dataset.ach === w.t && !w.id)) return; try { w.snap = achPosSnap(v); } catch (er) {} ACH_PATH.push(w); return; }
  if ((nb.dataset.view === "ach" || nb.dataset.view === "home") && cv.id && cv.id !== nb.dataset.view) ACH_PATH.push({ view: cv.id }); }, true);
/* 11/11 (Ahmed, validé, 3.1) : l'ACCUEIL a son ✕ — même règle de retour ; grisé quand rien n'est derrière */
const ACH_HCLOSE_WHY = "ACCUEIL : RIEN À FERMER (MENU ☰ POUR CHANGER D'ÉCRAN).";
function achHomeCloseSync() { const b = document.getElementById("homeClose"); if (!b) return; const on = ACH_PATH.length > 0; b.classList.toggle("hdr-off", !on); b.title = on ? "Fermer" : ACH_HCLOSE_WHY; }
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("#homeClose"); if (!b) return; e.preventDefault(); e.stopPropagation();
  if (ACH_PATH.length) achPathBack(); else if (typeof svToast === "function") svToast(ACH_HCLOSE_WHY, 3000, b); setTimeout(achHomeCloseSync, 50); }, true);
document.addEventListener("click", e => { if (e.target.closest && e.target.closest("#navMenu .nav-btn")) setTimeout(achHomeCloseSync, 60); }, true);
setTimeout(achHomeCloseSync, 0);
/* 10/11 (Ahmed, document unique 3.1 complément) : le ✕ D'UNE LISTE suit le même chemin — arrivé depuis un autre écran, il y ramène (à sa position) ;
   ouverte depuis le menu ≡ (chemin vide), il reste grisé */
const ACH_LCLOSE_WHY = "LISTE : RIEN À FERMER (MENU ☰ POUR CHANGER D'ÉCRAN).";
function achListCloseSync() { const v = document.getElementById("ach"); if (!v) return; const on = ACH_PATH.length > 0;
  v.querySelectorAll('[data-nvl="close"]').forEach(b => { if (b.classList.contains("hdr-off") === !on) return; b.classList.toggle("hdr-off", !on);
    if (on) { b.removeAttribute("data-why"); b.title = "Fermer"; } else { b.dataset.why = ACH_LCLOSE_WHY; b.title = ACH_LCLOSE_WHY; } }); }
document.addEventListener("pointerdown", e => { if (e.target.closest && e.target.closest('#ach [data-nvl="close"]')) achListCloseSync(); }, true);
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest('#ach [data-nvl="close"]'); if (!b || !ACH_PATH.length) return;
  e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); achPathBack(); }, true);
/* v1119 (L19, série L) : ICÔNE D'APERÇU juste avant la case à cocher de chaque ligne (listes et blocs de pièces) — l'APERÇU de la pièce (MISE EN PAGE),
   sans ouvrir sa page. ACH_PREV[type] est posé par le module de la pièce (achNvMod) ; une ligne de bloc donne sa pièce par son lien (go de la 1re colonne) */
const ACH_PREV = {};
const ACH_AP_ON = k => !!ACH_PREV[k];
const ACH_AP_IC = '<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>';
const achApOf = r => { if (r.ap) return ACH_PREV[String(r.ap).split("|")[0]] ? r.ap : ""; const g = (r.go || []).find(z => z[0] === 0) || (r.go || [])[0]; return g && ACH_PREV[g[1]] ? g[1] + "|" + g[2] : ""; };
const achApTh = () => `<th class="center nv-aph" data-cokey="_ap" aria-label="Aperçu"><span class="col-rs" data-col="_ap"></span></th>`;
const achApTd = k => `<td class="center nv-apc">${k ? `<button type="button" class="nv-ap" data-ap="${esc(k)}" title="Aperçu" aria-label="Aperçu">${ACH_AP_IC}</button>` : ""}</td>`;
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest(".nv-ap[data-ap]"); if (!b) return; e.preventDefault(); e.stopPropagation();
  const [t, ...r] = b.dataset.ap.split("|"), f = ACH_PREV[t]; if (f) f(r.join("|")); }, true);
/* 07/11 : redessin de la page ouverte (gestes hors clic : glisser une ligne) */
let ACH_NV_REDRAW = null;
function achNvMod(ctx, cfg) {
  let pid = null, P = null, rec = null;
  /* 11/11 (compte rendu v1089 – v1101, série I3) : une fiche ouverte DEPUIS SA LISTE (ligne, création) revient à cette liste au FERMER — un seul cran,
     sans prendre l'écran d'avant la liste dans le chemin ; une fiche ouverte par un lien (achGo) suit le chemin */
  let viaList = false;
  /* v1130 (décision d'Ahmed, 11/11) : les ronds choisis d'une pièce sont libérés à chaque ouverture (moteur commun, clé « type:id ») */
  const open = id => { if (id && typeof SVI_LK === "object") delete SVI_LK[(cfg.list && cfg.list.k) + ":" + id]; if (typeof ACH_CAF_CK !== "undefined") ACH_CAF_CK = null;   /* v1133 : cases gardées au redessin, oubliées à l'ouverture */ pid = id; rec = null; viaList = !!id && !(typeof achGo === "function" && achGo.busy) && !(typeof achPathBack === "function" && achPathBack.on); ctx.draw(); };
  const LST = achNvList(ctx, { ...cfg.list, page: open });
  if (cfg.list && cfg.list.k) ACH_PREV[cfg.list.k] = id => { const Pp = cfg.pageOf(id); if (Pp) achMepOpen(cfg, Pp, achRecBlock(Pp.code), () => {}); };   /* v1119 (L19) */
  const html = () => {
    if (pid) { P = cfg.pageOf(pid); if (!P) pid = null; else ACH_NV_REDRAW = () => ctx.draw(); }
    if (!pid) return LST.html();
    if (!rec || rec.__c !== P.code) { rec = achRecBlock(P.code); rec.__c = P.code; }
    requestAnimationFrame(achNvhFloor);   /* 08/11 : une hauteur gardée trop petite remonte au minimum (une ligne de données visible) */
    return achNvPageHTML(P, rec, ctx);
  };
  /* 11/11 (compte rendu v1089 – v1092, 2.10 / 3.6) : le nom du tiers est TOUJOURS un lien (souligné, couleur de son état) — seul, dans le titre ou à sa suite */
  const pLk = () => `<button type="button" class="ach-link nvp-party" data-nvgo="${esc(P.partyGo)}">${esc(P.party)}</button>`;
  const h1 = () => { if (!(pid && P)) return LST.h1(); const T = String(P.title || ""), N = String(P.party || "");
    if (cfg.list.k === "caf") return "DÉTAIL CONSULTATION";   /* v1122 (décision d'Ahmed) : la barre du haut d'une consultation = « DÉTAIL CONSULTATION » seul */
    if (!P.partyGo || !N) return esc(cfg.list.one) + " — " + esc(T);
    const i = T.indexOf(N); return esc(cfg.list.one) + " — " + (i >= 0 ? esc(T.slice(0, i)) + pLk() + esc(T.slice(i + N.length)) : (T && T !== P.ref ? esc(T) + " — " : "") + pLk()); };
  const click = async e => {
    if (!pid) return LST.click(e);
    if (await rec.click(e, () => ctx.draw())) return true;
    if (P && P.click && await P.click(e, () => ctx.draw())) return true;   /* F3 : gestes propres à la page (ronds, boutons des blocs) */
    const b = e.target.closest("[data-nvp]");
    if (b) { const k = b.dataset.nvp, ord = LST.order(), i = ord.indexOf(pid);
      if (k === "close") { if (!viaList && achPathBack()) return true; viaList = false; pid = null; ctx.draw(); return true; }   /* série I (I3) : FERMER revient d'un cran */
      if (k === "prev" || k === "next") { const j = i + (k === "next" ? 1 : -1); if (i < 0 || j < 0 || j >= ord.length) { svToast(k === "next" ? "DERNIER DE LA LISTE." : "PREMIER DE LA LISTE.", 2000, b); return true; } open(ord[j]); return true; }
      if (k === "info") { P.info(() => ctx.draw()); return true; }
      if (b.classList.contains("hdr-off")) { svToast(b.dataset.why || "", 3000, b); return true; }
      if (k === "todo") { svToast("⚠ " + P.why.join(" · "), 5000, b); return true; }
      /* v774 : ⋯ principal commun — VALIDER en tête ; actions ; CORBEILLE / RESTAURER et FERMER en bas, séparés par un trait */
      /* v920 (remarques 1 et 2 du 04/11/2026) : même ordre que le ⋯ du budget — FIGER / VALIDER ; actions ; DISPOSITION PAR DÉFAUT ; SUPPRIMER (ou ANNULER / RESTAURER) et FERMER ; une icône par ligne */
      if (k === "more") { const M = P.menu.concat([{ k: "__apr", lab: "APERÇU" }]).concat(cfg.list.k === "cmf" || cfg.list.k === "rcp" ? [{ k: "__aprsp", lab: "BON SANS PRIX (CHAUFFEUR, MAGASIN)" }] : []), top = M.filter(m => m.k === "val" || m.k === "fige" || m.k === "defige"), bot = M.filter(m => m.k === "del" || m.k === "rest").map(m => ({ ...m, del: m.k === "del" })), mid = M.filter(m => !top.includes(m) && !["del", "rest"].includes(m.k));
        sviHdrMenu(b, [top, mid, [{ k: "__fmt", lab: "MODIFIER LE FORMAT" }, { k: "__lay", lab: "DISPOSITION PAR DÉFAUT" }], [...bot, { k: "__close", lab: "FERMER" }]], async a => { if (a === "__close") { if (!viaList && achPathBack()) return; viaList = false; pid = null; ctx.draw(); return; }
          if (a === "__fmt") { sviFmtCurWin(); return; }   /* v927 (remarque 12) */
          if (a === "__lay") { if (!(await sviLayAsk())) return; const pg = b.closest(".nvp") || document.querySelector("#ach .nvp"); sviLayReset(pg);
            try { localStorage.removeItem(ACH_NVH_K); } catch (e) {} if (pg) { pg.querySelectorAll(".nvp-max").forEach(x => x.classList.remove("nvp-max")); pg.removeAttribute("style"); } ctx.draw(); return; } if (a === "__apr") { achMepOpen(cfg, P, rec, () => ctx.draw()); return; } if (a === "__aprsp") { achMepOpen(cfg, P, rec, () => ctx.draw(), { noPrice: true }); return; } await P.act(a, () => ctx.draw(), id => open(id)); }); return true; }
    }
    /* v776 : AGRANDIR / RÉDUIRE un bloc de la page ; ⋯ du bloc (EXPORTER, APERÇU ; SUIVI : CRÉER) */
    const mx = e.target.closest("[data-nvmax]"); if (mx) { const bl = mx.closest(".nvp-blk"); const on = !bl.classList.contains("nvp-max"); bl.classList.toggle("nvp-max", on); mx.classList.toggle("on", on); return true; }
    const mo = e.target.closest("[data-nvmore]"); if (mo) { const k = mo.dataset.nvmore, bl = mo.closest(".nvp-blk"), L = P.links.find(x => achNvhKey(x.t) === k);
      const tsv = () => { const t = bl.querySelector("table"); return [...t.rows].filter(r => !r.classList.contains("rec-new")).map(r => [...r.cells].filter(c => !c.classList.contains("svi-colh")).map(c => c.textContent.trim()).join("\t")).join("\n"); };
      const bt = bl.querySelector("table"), vis = sviColhVis(bt), vf = a => a.filter((_, i) => vis.includes(i));
      sviHdrMenu(mo, [[{ k: "max", lab: bl.classList.contains("nvp-max") ? "RÉDUIRE" : "AGRANDIR" }, { k: "hdef", lab: sviBlkRows().n + " LIGNES (PAR DÉFAUT)" }, { k: "hred", lab: "MODE RÉDUIT (" + sviBlkRows().r + " LIGNE" + (sviBlkRows().r > 1 ? "S" : "") + ")" }].concat(k === "rec" ? [{ k: "add", lab: "CRÉER" }] : []).concat(L && L.menu ? L.menu.filter(m => !m.del) : []), sviColhItems(bt), [{ k: "exp", lab: "EXPORTER" }, { k: "apr", lab: "APERÇU" }], L && L.menu ? L.menu.filter(m => m.del) : []].filter(g => g.length), async a => {   /* 11/11 : SUPPRIMER … en bas du ⋯ */
        if (sviColhPick(a, bt)) return;
        if (a === "max") { bl.querySelector("[data-nvmax]")?.click(); return; }
        /* F2, F3 : actions propres au bloc (lignes cochées passées) */
        if (L && L.act && (L.menu || []).some(m => m.k === a)) { const ck = [...bl.querySelectorAll("tbody tr[data-ri]")].filter(tr => tr.querySelector(".nvp-cb:checked")).map(tr => +tr.dataset.ri); await L.act(a, ck, () => ctx.draw()); return; }
        /* B4 (série B) : hauteur commune des blocs — lignes par défaut ou mode réduit (réglages communs), gardée par bloc */
        if (a === "hdef" || a === "hred") { const pg = bl.closest(".nvp"); let H = {}; try { H = JSON.parse(localStorage.getItem(ACH_NVH_K) || "{}") || {}; } catch (e) {}
          if (a === "hdef") { delete H[k]; pg && pg.style.removeProperty("--nvh-" + k); }
          else { const sc = bl.querySelector(".rec-scroll"), v = sc ? achNvhMin(sc, sviBlkRows().r) : 60;
            H[k] = v; pg && pg.style.setProperty("--nvh-" + k, v + "px"); }
          try { localStorage.setItem(ACH_NVH_K, JSON.stringify(H)); } catch (e) {} return; }
        if (a === "add") { if (await rec.click({ target: bl.querySelector("[data-nvradd]") }, () => ctx.draw())) return; }
        const ttl = (P.ref || P.code) + " — " + (L ? L.t : "SUIVI");
        if (a === "exp") { const b = new Blob(["\ufeff" + tsv().split("\n").map(l => l.split("\t").map(v => /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
          const u = URL.createObjectURL(b), an = document.createElement("a"); an.href = u; an.download = ttl.replace(/[\\/:*?"<>|]/g, "-") + ".csv"; document.body.appendChild(an); an.click(); setTimeout(() => { URL.revokeObjectURL(u); an.remove(); }, 1000); }
        if (a === "apr") { const Lb = L || { t: "SUIVI", cols: [...bl.querySelectorAll("thead th")].map(th => [th.textContent.trim(), ""]), rows: [...bl.querySelectorAll("tbody tr:not(.rec-new)")].map(tr => ({ cells: [...tr.cells].map(c => c.textContent.trim()) })) };   /* v783 : l'aperçu unique (MISE EN PAGE) */
          sviMep.open({ key: "ACH-BLOC-" + achNvhKey(Lb.t).toUpperCase(), title: Lb.t, ref: P.ref || P.code, party: P.party || P.title, prelim: ["instance", "fige", "encours"].includes(P.st), cols: vf(Lb.cols).map((c, i) => ["c" + i, c[0], c[1] || ""]), rows: Lb.rows.map(r => vf(r.cells)), name: ttl, save: (b, n) => rec.savePdf(b, n) }); } });
      return true; }
    const na = e.target.closest("[data-nvadd]"); if (na) { const L = P.links.find(x => achNvhKey(x.t) === na.dataset.nvadd); if (L && L.addFn) L.addFn(() => ctx.draw()); else P.info(() => ctx.draw()); return true; }   /* v780 : ligne CRÉER … ICI */
    const gg = e.target.closest("[data-nvgo]"); if (gg) { const [t, gid] = gg.dataset.nvgo.split("|"); achGo(t, gid); return true; }   /* v800 (3.6 – 3.7) : un nom ouvre sa page */
    const l = e.target.closest("[data-nvl]"); if (l) { const [t, i] = l.dataset.nvl.split("|"), L = P.links.find(x => x.t === t), r = L && L.rows[+i]; if (r && r.open) r.open(() => ctx.draw()); return true; }
    return false;
  };
  const change = e => { if (!pid) return false; if (P && P.change && P.change(e, () => ctx.draw())) return true; return rec ? rec.change(e) : false; };
  return { html, click, change, h1, open, close: () => { pid = null; }, isPage: () => !!pid, cur: () => pid };
}

/* ---------- ARTICLES ---------- */
/* fenêtre des informations d'un article (création si id = null : l'article naît EN INSTANCE) */
function achArtFiche(id, done) {
  const a0 = id ? achArts().find(x => x.id === id) : null; if (id && !a0) return;
  const A = a0 ? JSON.parse(JSON.stringify(a0)) : { des: "", u: "", cat: "", stk: false, tva: achPrm().tva, pref: 0, pmax: 0, actif: true, cpt: "", cptI: "" };
  const ro = !!(a0 && a0.del), dis = ro ? " readonly" : "", d = sviWinNew(), P = achPrm();
  const inp = (k, lab, o = {}) => `<label class="frs-f${o.w ? " frs-w" : ""}"><span>${lab}${o.req ? " <b>*</b>" : ""}</span><input class="ins-in art-x${o.num ? " number" : ""}" data-k="${k}" value="${esc(o.num ? (achN(A[k]) || k === "tva" ? achF2(A[k]) : "") : A[k] ?? "")}"${o.num ? ' inputmode="decimal"' : ""}${o.list ? ` list="artL-${k}"` : ""}${dis} autocomplete="off">${o.list ? `<datalist id="artL-${k}">${o.list.map(x => `<option value="${esc(x)}">`).join("")}</datalist>` : ""}</label>`;
  const units = (() => { try { return (typeof sviUnits === "function" ? sviUnits() : []).map(u => u.a || u).filter(Boolean); } catch (e) { return []; } })();
  d.innerHTML = sviWinCard({ st: a0 ? achPcSt("art", a0) : "instance", cls: "frs-card", close: "data-x", title: a0 ? esc(a0.des + " (" + a0.u + ") : " + achRefSvi(a0, achArts(), "ARA")) : "NOUVEL ARTICLE",
    body: `<div class="frs-scroll art-scroll" data-at="inf">${a0 ? `<div class="rec-tabs frs-tabs"><button type="button" class="rec-tab active on" data-atab="inf">INFORMATIONS</button><button type="button" class="rec-tab" data-atab="frs">FOURNISSEURS</button></div>` : ""}<div class="frs-g">${inp("des", "DÉSIGNATION", { req: 1, w: 1 })}${inp("u", "UNITÉ", { req: 1, list: units })}${inp("cat", "CATÉGORIE", { req: 1, list: P.cat })}
      ${inp("pref", "PRIX DE RÉFÉRENCE HT", { num: 1 })}${inp("pmax", "PLAFOND HT", { num: 1 })}${inp("partMax", "PART MAXIMUM D'UN FOURNISSEUR (%)", { num: 1 })}${inp("tva", "TVA %", { num: 1 })}
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
    d.querySelectorAll(".art-x").forEach(i => { const k = i.dataset.k; A[k] = ["tva", "pref", "pmax", "partMax"].includes(k) ? achN(i.value) : achU(i.value); });
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
/* 05/11 : PLUS DE FIGER — une fiche passe directement d'EN INSTANCE (rouge) à VALIDÉE (noir) ; une ancienne fiche « figée » est en instance */
const achNvCycle = (x) => x.del ? [] : x.st === "fige" || x.st === "instance" ? [{ k: "val", lab: "VALIDER" }] : [];
async function achNvFiger(L, x, code, nom, why, save) {
  if (why.length) { svToast("FIGER IMPOSSIBLE : " + why.join(" · "), 4500); return false; }
  if (!(await svConfirm({ title: "FIGER", text: code + " — " + nom + " PASSE EN VERT : IL ATTEND SA VALIDATION.", ok: "FIGER", tone: "neutral" }))) return false;
  x.st = "fige"; x.fige = achNow(); x.mod = x.fige; save(L); achHist(code, "FIGÉ", nom); return true;
}
function achNvDefiger(L, x, code, nom, save) { x.st = "instance"; delete x.fige; x.mod = achNow(); save(L); achHist(code, "REVENU EN INSTANCE", nom); return true; }
async function achNvValider(L, x, code, nom, why, save) {
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
    list: { k: "art", t: "ach_art2", id: "achArtT", name: "ARTICLES", one: "ARTICLE", stKeys: ["instance", "valide", "bloque", "archive", "annule", "alerte"], edit: ACH_ED.art, all: achArts, save: achArtsSave, code: a => achRefSvi(a, achArts(), "ARA"), nom: a => a.des, why: artWhy,
      newRow: "CRÉER UN ARTICLE ICI…", add: done => achArtFiche(null, done),
      w: { ref: 110, nom: 360, u: 70, cat: 200, pref: 110, pmax: 110, nfr: 120, freq: 120, val: 110, cree: 110 },
      cols: mode => [["ref", "RÉFÉRENCE", a => achRefSvi(a, achArts(), "ARA"), ""], ["nom", "DÉSIGNATION", a => a.des, ""], ["u", "UNT", a => a.u, "center"], ["cat", "CATÉGORIE", a => a.cat || "", ""],
        ["pref", "PRIX RÉF. HT", a => achN(a.pref), "number"], ["pmax", "PLAFOND HT", a => achN(a.pmax) ? achN(a.pmax) : "", "number"],
        ["nfr", "FOURNISSEURS", a => { const R = achRep(achKey(a.des, a.u)); return R.n + (R.n < R.need ? " !" : ""); }, "center"], ["freq", "FRÉQUENCE", a => achArtFreq(a).lab, "center"]]
        .concat(mode === "valid" ? [["val", "VALIDÉ LE", a => achDFr(a.val || a.cree), "center"]] : []).concat([["cree", "SAISI LE", a => achDFr(a.cree), "center"]]) },
    pageOf: id => { const a = achArts().find(x => x.id === id); if (!a) return null;
      const C = achCaf().filter(c => (c.lignes || []).some(l => same(l, a))), D = achDvf().filter(v => (v.lignes || []).some(l => same(l, a))), M = achCmf().filter(c => (c.lignes || []).some(l => same(l, a)));
      const lp = (v, k) => (v.lignes || []).find(l => same(l, a)) || {};
      return { id, code: a.code, ref: achRefSvi(a, achArts(), "ARA"), tag: "ARTICLE", title: a.des + " (" + a.u + ")", st: achPcSt("art", a), del: !!a.del, inactif: a.actif === false, why: artWhy(a),
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
    list: { k: "frs", t: "ach_frs2", id: "achFrsT", name: "FOURNISSEURS", one: "FOURNISSEUR", stKeys: ["instance", "valide", "expire", "bloque", "archive", "annule", "alerte"], edit: ACH_ED.frs, all: () => { achFrsMigActif(); return achFrs(); }, save: achFrsSave, code: f => achFrsRef(f), nom: f => f.nom, why: frsWhy,
      newRow: "CRÉER UN FOURNISSEUR ICI…",
      add: async done => { const nom = await achAsk("NOUVEAU FOURNISSEUR", "NOM"); if (!nom) { done(null); return; } const L = achFrs(), dn = achFrsDupNom(L, nom, "");
        if (dn) svToast("UN FOURNISSEUR DU MÊME NOM EXISTE : " + dn.code + ".", 3500);
        const f = achFrsNew(L, { nom }); f.st = "instance"; f.grp = ""; achFrsSave(L); achHist(f.code, "CRÉATION", f.nom); done(f.id); achFrsFiche(f.id, "", () => done(f.id)); },
      w: { ref: 110, grp: 150, nom: 320, ville: 140, ice: 160, cond: 140, freq: 120, val: 110, cree: 110 },
      /* B42, B44 : états du fournisseur (la case ACTIF a disparu ; une ancienne fiche « inactive » compte comme bloquée) */
      /* D3 (série D) : le filtre ne propose plus que les statuts (plus d'ACTIF / INACTIF) ; TOUT par défaut */
      etat0: "tout", etats: [["frequent", "FRÉQUENTS"], ["normal", "NORMAUX"], ["occasionnel", "OCCASIONNELS"], ["dormant", "DORMANTS"], ["bloque", "BLOQUÉS"], ["archive", "ARCHIVÉS"], ["corbeille", "CORBEILLE"], ["tout", "TOUT"]],
      ok: (x, k) => k === "corbeille" ? !!x.del : x.del ? false : k === "tout" ? true : k === "archive" ? !!x.arch : k === "bloque" ? !x.arch && (!!x.bloq || x.actif === false)
        : x.arch || x.bloq || x.actif === false ? false : k === "actif" ? true : achFrsFreq(x).k === k,
      cols: mode => [["ref", "RÉFÉRENCE", f => achFrsRef(f), ""], ["grp", "ORIGINE", f => achFrsGrp(f).nom, ""], ["nom", "NOM", f => f.nom, "", f => f.logo || ""], ["ville", "VILLE", f => f.ville || "", ""], ["ice", "ICE", f => achDig(f.ice), "center"], ["freq", "FRÉQUENCE", f => achFrsFreq(f).lab, "center"]]
        .concat(mode === "valid" ? [["val", "VALIDÉ LE", f => achDFr(f.val || f.cree), "center"]] : []).concat([["cree", "SAISI LE", f => achDFr(f.cree), "center"]]) },
    pageOf: id => { const f = achFrs().find(x => x.id === id); if (!f) return null;
      /* v921 (remarque 4) : toutes les pièces liées au fournisseur — consultations, devis, commandes, réceptions, retours, factures, avoirs, paiements */
      const me = v => achFrsIs(v, f), yo = x => !(f.archOld || []).includes(String(x.cree || x.date || "").slice(0, 4));   /* B44 : années restées archivées */
      const D = achDvf().filter(v => me(v.frs) && yo(v)), M = achCmf().filter(c => me(c.frs) && yo(c)), FA = achFaf().filter(x => me(x.frs) && yo(x)), PA = achPaf().filter(x => me(x.frs) && yo(x));
      const CA = achCaf().filter(c => (c.frs || []).some(me) && yo(c)), RC = achRcp().filter(r => (me(r.frs) || M.some(c => c.id === r.cmf)) && yo(r)), RT = achRtr().filter(x => (me(x.frs) || M.some(c => c.id === x.cmf) || RC.some(r => r.id === x.rcp)) && yo(x)), AV = achAvf().filter(x => me(x.frs) && yo(x));
      const twins = achFrs().filter(x => x.id !== id && !x.del && achU(x.nom) === achU(f.nom));
      const arts = new Map(); D.filter(v => v.state !== "rejete" && v.state !== "annule").forEach(v => (v.lignes || []).forEach(l => { if (achN(l.pu) > 0) arts.set(achKey(l.des, l.u), { l, v }); }));
      return { id, code: f.code, ref: achFrsRef(f), tag: "FOURNISSEUR", title: f.nom, st: achPcSt("frs", f), del: !!f.del, inactif: f.actif === false, why: frsWhy(f),
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
          /* D1 : retours de commande dans COMMANDES, retours de réception dans RÉCEPTIONS, avoirs dans FACTURES (montants négatifs) */
          { t: "COMMANDES", cols: [["RÉFÉRENCE"], ["ARTICLES"], ["MONTANT TTC", "number"], ["ÉTAT", "center"]], rows: M.map(c => ({ cells: [c.ref, (c.lignes || []).map(l => l.des).join("; "), achCmfTot(c).ttc, ACH_CMF_ST[c.state] || ""], open: () => achGo("cmf", c.id), cls: c.state === "annule" ? "nv-strike" : "" }))
            .concat(RT.filter(x => x.kind === "cmd").map(x => ({ cells: [x.ref, "RETOUR DE COMMANDE — " + achRtrSrc(x), achRtrTtc(x), x.state === "annule" ? "ANNULÉ" : "RETOUR"], open: () => achGo("cmf", x.id), cls: x.state === "annule" ? "nv-strike" : "" }))) },
          { t: "RÉCEPTIONS", cols: [["RÉFÉRENCE"], ["COMMANDE"], ["N° BL"], ["REÇU LE", "center"], ["ÉTAT", "center"]], rows: RC.map(r => ({ cells: [r.ref, ((achCmf().find(c => c.id === r.cmf) || {}).ref) || "SANS COMMANDE", r.pv ? "PV DE SERVICE FAIT" : r.nbl || "", achDFr(r.date), r.state === "annule" ? "ANNULÉE" : "ENREGISTRÉE"], open: () => achGo("rcp", r.id), cls: r.state === "annule" ? "nv-strike" : "" }))
            .concat(RT.filter(x => x.kind === "rcp").map(x => ({ cells: [x.ref, ((achCmf().find(c => c.id === x.cmf) || {}).ref) || "", "RETOUR DE " + achRtrSrc(x), achDFr(x.date), x.state === "annule" ? "ANNULÉ" : "RETOUR"], open: () => achGo("rcp", x.id), cls: x.state === "annule" ? "nv-strike" : "" }))) },
          { t: "FACTURES", cols: [["RÉFÉRENCE"], ["N°"], ["MONTANT TTC", "number"], ["RESTE À PAYER", "number"], ["ÉTAT", "center"]], rows: FA.map(x => ({ cells: [x.ref, x.num || "", achFafTot(x).ttc, x.state === "annule" ? "" : achFafReste(x), achFafEtat(x)], open: () => achGo("faf", x.id), cls: x.state === "annule" ? "nv-strike" : "" }))
            .concat(AV.map(x => ({ cells: [x.ref, x.num || "", -achN(x.ttc), x.state === "annule" ? "" : -achAvfReste(x), x.state === "annule" ? "ANNULÉ" : "AVOIR"], open: () => achGo("faf", x.id), cls: x.state === "annule" ? "nv-strike" : "" }))) },
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
/* v1132 (L6 – L8) : TOUT COCHER = les lignes affichées (pas celles cachées par le filtre des blocs liés) ; case d'en-tête à trois états (vide, à moitié, pleine) */
/* v1133 : lignes de données seulement (ni titre de groupe, ni ligne cachée) */
const ACH_NVP_ROWCB = "tbody tr[data-ri]:not(.svlk-hid):not(.nvp-gt) .nvp-cb";
/* v1136 (L8, choix A d'Ahmed) : titres de groupe compris — un titre (svlk-gt-<g>) est coché quand toutes les lignes affichées de son groupe le sont, à moitié sinon */
const achNvpAllSt = t => { if (!t) return; t.querySelectorAll("tbody tr.nvp-gt").forEach(tt => { const m = String(tt.className).match(/\bsvlk-gt-(\S+)/), cb = tt.querySelector(".nvp-cb"); if (!m || !cb) return;
    const I = [...t.querySelectorAll("tbody tr.svlk-g-" + CSS.escape(m[1]) + ":not(.svlk-hid) .nvp-cb")], k = I.filter(c => c.checked).length; cb.checked = k > 0 && k === I.length; cb.indeterminate = k > 0 && k < I.length; });
  const all = t.querySelector(".nvp-all"); if (!all) return; const C = [...t.querySelectorAll(ACH_NVP_ROWCB)], n = C.filter(c => c.checked).length;
  all.checked = n > 0 && n === C.length; all.indeterminate = n > 0 && n < C.length; };
document.addEventListener("change", e => { const a = e.target.closest && e.target.closest(".nvp-all"); if (a) { const t = a.closest("table"); t.querySelectorAll(ACH_NVP_ROWCB).forEach(c => { c.checked = a.checked; }); achNvpAllSt(t); return; }
  const c = e.target.closest && e.target.closest(".nvp-cb"); if (!c) return; const t = c.closest("table"), m = String(c.closest("tr").className).match(/\bsvlk-gt-(\S+)/);
  if (m) t.querySelectorAll("tbody tr.svlk-g-" + CSS.escape(m[1]) + ":not(.svlk-hid) .nvp-cb").forEach(x => { x.checked = c.checked; });   /* v1136 (L8 A) : cocher un titre = tout son groupe */
  achNvpAllSt(t); });
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
/* ⟪ src/49-clients-projets.js ⟫ */
/* =========================================================
   10/11/2026 (Ahmed) : MODULES CLIENTS ET PROJETS — au menu principal juste après ACHAT, chacun avec sa LISTE, sa FICHE (page)
   et sa fenêtre i, construits comme le module FOURNISSEURS (même moteur : achNvMod / achNvList, mêmes règles de forme, liste BDG).
   CLIENT  : la fiche du fournisseur, retournée vers la vente — IDENTITÉ (et CONTACTS), FISCAL ET LÉGAL, BANQUE ET PAIEMENT,
             CONDITIONS DE VENTE, RISQUE, CLIENTS SIMILAIRES, STATISTIQUES ; page : ses PROJETS et ses BUDGETS.
   PROJET  : IDENTITÉ (code, intitulé, client, chef de projet), MARCHÉ, CHANTIER, DATES, INTERVENANTS ; page : ses BUDGETS.
   Les projets déjà nommés dans les budgets sont repris une fois (client, marché, GPS lus dans le budget) — rien n'est effacé du budget.
   Données : svi_ach_cli_v1, svi_ach_prj_v1 (partagées comme les autres données des achats).
   ========================================================= */
const achCli = () => { const L = achJ(ACH_K.cli, []); return Array.isArray(L) ? L : []; };
const achCliSave = L => achW(ACH_K.cli, L);
const achPrj = () => { const L = achJ(ACH_K.prj, []); return Array.isArray(L) ? L : []; };
const achPrjSave = L => { L.forEach(p => { try { p.dbutCalc = achPrjButoir(p); } catch (e) {} }); return achW(ACH_K.prj, L); };   /* série K : date butoir calculée gardée (lue par le budget) */
const achCliNextCode = L => "CLI-" + String(L.reduce((m, a) => Math.max(m, Number(String(a.code || "").replace(/\D/g, "")) || 0), 0) + 1).padStart(4, "0");
const achCliNew = (L, o) => { const now = achNow();
  const c = { id: "K" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), code: achCliNextCode(L), nom: achU(o.nom || ""), denom: "", forme: "", type: o.type || "", grp: "", pays: "", ville: "", adresse: "", lang: "", site: "",
    dirigeant: "", resp: "", logo: "", lie: "", mailSit: "", mailFac: "", cte: [], ice: "", ifisc: "", rc: "", villeRc: "", patente: "", capital: "", cnss: "", docs: [],
    codeCpt: "", intCpt: "", ribs: [], plafEnc: "", jours: "", payeur: "", cau: [], modeReg: "", delai: "", retTaux: "", escTaux: "", devise: "", cgf: [], cla: [], solva: "", strat: "", evl: [],
    st: "instance", cree: now, mod: now, del: "" };
  L.push(c); return c; };
const achPrjNew = (L, o) => { const now = achNow();
  const p = { id: "J" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), code: achU(o.code || ""), intitule: achU(o.intitule || ""), cli: o.cli || "", chef: "", cons: !!o.cons, aoNum: o.aoNum || "", aoObj: o.aoObj || "", marche: "",
    adresse: "", ville: "", gps: o.gps || "", deb: "", fin: "", butoir: "", interv: [], st: "instance", cree: o.cree || now, mod: now, del: "" };
  L.push(p); return p; };
const achCliNom = id => ((achCli().find(c => c.id === id) || {}).nom) || "";
/* budgets d'un projet (référence de projet du budget = CODE PROJET) */
const achPrjBdg = code => { let L = []; try { L = sviInstGet(); } catch (e) {} const k = achU(code); return L.filter(b => achU(b.project || "") === k && !b.del); };
const achBdgTtc = ref => { try { const r = (window.bdgRows || (typeof bdgRows !== "undefined" ? bdgRows : []) || []).find(x => x && x.ref === ref); return r ? +r.ttc || 0 : ""; } catch (e) { return ""; } };
const achBdgNat = b => b.virtual ? "CONSOLIDÉ" : b.rclOf ? "RECALAGE" : b.parent ? "AVENANT " + (b.avn || 1) : "INITIAL";
const achBdgEt = b => ({ instance: "EN INSTANCE", fige: "FIGÉ", valide: "VALIDÉ", annule: "ANNULÉ" }[b.state || "instance"] || String(b.state || "").toUpperCase());
const achBdgGo = ref => { document.querySelector('#navMenu .nav-btn[data-view="bdg"]')?.click(); setTimeout(() => { try { if (window.__sviAvOpen) window.__sviAvOpen(ref); } catch (e) {} }, 350); };
/* reprise : un projet par référence de projet trouvée dans les budgets (client, marché et GPS lus dans le budget) */
function achPrjSync() { let B = []; try { B = sviInstGet(); } catch (e) { return; } if (!B.length) return;
  const P = achPrj(), C = achCli(), have = new Set(P.map(p => achU(p.code))); let chP = false, chC = false;
  B.forEach(b => { const code = achU(b.project || ""); if (!code || have.has(code)) return; have.add(code);
    const D = b.data || {}, A = D.ao || {}, nm = achU(b.client || ""); let cli = "";
    if (nm) { let c = C.find(x => !x.del && achU(x.nom) === nm); if (!c) { c = achCliNew(C, { nom: nm, type: A.pub === true ? "PUBLIC" : A.pub === false ? "PRIVÉ" : "" }); chC = true; } cli = c.id; }
    achPrjNew(P, { code, cli, cons: !!A.cons, aoNum: A.num || "", aoObj: A.obj || "", gps: D.gps || "", cree: b.created || "" }); chP = true; });
  if (chC) achCliSave(C); if (chP) achPrjSave(P); }
const ACH_CLI_TYPES = ["PUBLIC", "PRIVÉ"];
const ACH_PRJ_ROLES = ["ARCHITECTE", "BUREAU D'ÉTUDES", "BUREAU DE CONTRÔLE", "LABORATOIRE", "TOPOGRAPHE", "AUTRE"];
const achCliWhy = c => { const w = []; if (!c.nom) w.push("NOM MANQUANT"); if (c.type === "PRIVÉ" && !achDig(c.ice)) w.push("ICE MANQUANT"); return w; };
const achPrjWhy = p => { const w = []; if (!p.code) w.push("CODE PROJET MANQUANT"); if (!p.cli) w.push("CLIENT MANQUANT"); return w; };
const achCpSt = x => x.del ? "annule" : x.arch ? "archive" : x.bloq ? "bloque" : achSt(x);

/* ---------- fenêtre i commune (onglets, sections, tableaux de lignes) — même forme que la fenêtre i du fournisseur ---------- */
function achCpWin(o) {
  /* o = { L, save, id, ttl, tabs: [[k, lab, [sections]]], secs: { k: (F, h) => html }, subs: { k: { cols, blank } }, check(F, L) → msg, hist } */
  const L0 = o.L(), x0 = L0.find(y => y.id === o.id); if (!x0) return;
  const F = JSON.parse(JSON.stringify(x0)), ro = !!x0.del || achSt(x0) !== "instance" && !o.editValid;
  Object.keys(o.subs || {}).forEach(k => { if (!Array.isArray(F[k])) F[k] = []; });
  const T0 = (o.focusK && o.tabs.find(t => t[2].some(sk => (o.secKeys || {})[sk] && o.secKeys[sk].includes(o.focusK)))) || o.tabs[0];
  let tab = T0[0]; const d = sviWinNew(), OPEN = new Set([T0[2].find(sk => o.focusK && (o.secKeys || {})[sk] && o.secKeys[sk].includes(o.focusK)) || T0[2][0]]);
  const h = {
    inp: (k, lab, q = {}) => `<label class="frs-f${q.w ? " frs-w" : ""}"><span>${lab}${q.req ? " <b>*</b>" : ""}</span><input class="ins-in cp-x" data-k="${k}"${q.mask ? ` data-mask="${q.mask}"` : ""} value="${esc(q.mask && typeof sviMaskFmt === "function" ? sviMaskFmt(q.mask, F[k] ?? "") : F[k] ?? "")}"${q.num ? ' inputmode="numeric"' : ""}${q.date ? ' type="date"' : ""}${q.keep ? " data-keepcase" : ""}${q.list ? ` list="cpL-${k}"` : ""}${ro || q.ro ? " readonly" : ""} autocomplete="off">${q.list ? `<datalist id="cpL-${k}">${q.list.map(v => `<option value="${esc(v)}">`).join("")}</datalist>` : ""}</label>`,
    sel: (k, lab, opts, q = {}) => `<label class="frs-f${q.w ? " frs-w" : ""}"><span>${lab}${q.req ? " <b>*</b>" : ""}</span><select class="ins-in cp-xs" data-k="${k}"${ro ? " disabled" : ""}><option value="">—</option>${opts.map(v => { const a = Array.isArray(v) ? v[0] : v, t = Array.isArray(v) ? v[1] : v; return `<option value="${esc(a)}"${String(F[k] ?? "") === String(a) ? " selected" : ""}>${esc(t)}</option>`; }).join("")}</select></label>`,
    chk: (k, lab) => `<label class="frs-c"><input type="checkbox" class="cp-xc" data-k="${k}"${F[k] ? " checked" : ""}${ro ? " disabled" : ""}> ${lab}</label>`,
    ro: (lab, v) => `<label class="frs-f"><span>${lab}</span><input class="ins-in" value="${esc(v ?? "")}" readonly tabindex="-1"></label>`,
    area: (k, lab) => `<label class="frs-f frs-w cp-wide"><span>${lab}</span><textarea class="ins-in cp-x" data-k="${k}" rows="3"${ro ? " readonly" : ""}>${esc(F[k] ?? "")}</textarea></label>`,
    color: (k, lab) => `<label class="frs-f"><span>${lab}</span><input type="color" class="cp-x cp-col" data-k="${k}" value="${esc(F[k] || "#13447a")}"${ro ? " disabled" : ""}></label>`,
    photo: (k, lab) => `<div class="frs-f frs-w frs-logo"><span>${lab}</span><div>${F[k] ? `<img src="${esc(F[k])}" alt="">` : ""}${ro ? "" : `<input type="file" accept="image/*" class="cp-logo-in" data-k="${k}">${F[k] ? ` <button type="button" class="ach-b" data-logorm="${k}">RETIRER</button>` : ""}`}</div></div>`,
    /* colonnes : [clé, titre, classe, type ("date" | "sel" | "calc"), choix (sel) ou calcul (calc, en gris)] */
    sub: (k, add) => { const S = o.subs[k], cell = (c, r) => c[3] === "calc" ? `<input class="ins-in cp-calc${c[2] === "number" ? " number" : ""}" value="${esc(c[4](r) ?? "")}" readonly tabindex="-1">`
        : c[3] === "sel" ? `<select class="ins-in cp-s" data-c="${c[0]}"${ro ? " disabled" : ""}><option value="">—</option>${(typeof c[4] === "function" ? c[4]() : c[4]).map(v => `<option value="${esc(v)}"${String(r[c[0]] ?? "") === String(v) ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>`
        : `<input class="ins-in cp-s${c[2] === "number" ? " number" : ""}" data-c="${c[0]}" value="${esc(r[c[0]] ?? "")}"${c[3] === "date" ? ' type="date"' : c[2] === "number" ? ' inputmode="decimal"' : ""}${c[3] === "list" ? ` list="cpS-${k}-${c[0]}"` : ""}${ro ? " readonly" : ""} autocomplete="off">`;
      const dl = S.cols.filter(c => c[3] === "list").map(c => `<datalist id="cpS-${k}-${c[0]}">${(typeof c[4] === "function" ? c[4]() : c[4]).map(v => `<option value="${esc(v)}">`).join("")}</datalist>`).join("");
      return `${dl}<table class="prm-table frs-sub cp-sub" data-sub="${k}"><thead><tr>${S.cols.map(c => `<th${c[2] ? ` class="${c[2]}"` : ""}>${c[1]}</th>`).join("")}${ro ? "" : '<th class="center"></th>'}</tr></thead><tbody>
      ${F[k].map((r, i) => `<tr data-i="${i}">${S.cols.map(c => `<td${c[2] ? ` class="${c[2]}"` : ""}>${cell(c, r)}</td>`).join("")}${ro ? "" : `<td class="center"><button type="button" class="ach-x" data-cprm="${k}|${i}" title="Retirer">✕</button></td>`}</tr>`).join("")}
      ${ro ? "" : `<tr class="rec-new" data-cpadd="${k}"><td colspan="${S.cols.length + 1}">CRÉER ${esc(add)} ICI…</td></tr>`}</tbody></table>`; } };
  const pull = () => { d.querySelectorAll(".cp-x").forEach(i => { const k = i.dataset.k; F[k] = i.type === "date" || i.type === "color" || i.hasAttribute("data-keepcase") ? String(i.value).trim() : i.dataset.mask ? achDig(i.value) || String(i.value).trim() : achU(i.value); });
    d.querySelectorAll(".cp-xs").forEach(s => { F[s.dataset.k] = s.value; }); d.querySelectorAll(".cp-xc").forEach(c => { F[c.dataset.k] = !!c.checked; });
    d.querySelectorAll("table[data-sub]").forEach(t => { const k = t.dataset.sub; t.querySelectorAll("tbody tr[data-i]").forEach(tr => { const r = F[k][+tr.dataset.i]; if (!r) return; tr.querySelectorAll(".cp-s").forEach(i => { r[i.dataset.c] = i.type === "date" || i.tagName === "SELECT" ? i.value : i.classList.contains("number") ? (String(i.value).trim() === "" ? "" : achN(i.value)) : /mail/i.test(i.dataset.c) ? String(i.value).trim().toLowerCase() : achU(i.value); }); }); }); };
  const draw = () => { const why = o.why ? o.why(F) : [];
    d.innerHTML = sviWinCard({ cls: "frs-card cp-card", close: "data-x", title: achWinTtl(o.ttl(F), o.ttl(F)),
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}</div>` : ""}<div class="rec-tabs frs-tabs">${o.tabs.map(t => `<button type="button" class="rec-tab${t[0] === tab ? " active on" : ""}" data-cptab="${t[0]}">${t[1]}</button>`).join("")}</div>
        <div class="frs-scroll">${o.tabs.map(t => t[2].map(s => !o.fold ? `<div class="frs-sec" data-s="${s}"${t[0] === tab ? "" : " hidden"}>${o.secs[s](F, h, ro)}</div>`
          /* K1 : section à titre pliable (› / ⌄) et pastille (nombre de champs, ou de lignes d'un tableau) ; la 1re de l'onglet dépliée à l'ouverture */
          : (() => { const S = o.fold[s], on = OPEN.has(s), n = S[1] === "t" ? (F[S[2]] || []).length : S[1]; return `<div class="frs-sec cp-fsec${on ? " on" : ""}" data-s="${s}"${t[0] === tab ? "" : " hidden"}><button type="button" class="frs-st cp-st" data-cpsec="${s}"><span class="cp-ar">${on ? "⌄" : "›"}</span>${S[0]} ${svCnt(n)}</button><div class="cp-body"${on ? "" : " hidden"}>${o.secs[s](F, h, ro)}</div></div>`; })()).join("")).join("")}</div>`,
      foot: `<button type="button" class="svc-b" data-x>ANNULER</button>${ro ? "" : `<button type="button" class="svc-b svc-ok svc-neutral" data-cpok>ENREGISTRER</button>`}` }); };
  draw(); sviWinShow(d);
  if (o.focusK) setTimeout(() => { const i = d.querySelector(`.cp-x[data-k="${o.focusK}"]`); if (i) { i.scrollIntoView({ block: "center" }); i.focus(); } }, 60);
  d.addEventListener("change", e => { const f = e.target.closest(".cp-logo-in"); if (f && f.files && f.files[0]) { const r = new FileReader(); r.onload = () => { pull(); F[f.dataset.k || "logo"] = String(r.result || ""); draw(); }; r.readAsDataURL(f.files[0]); return; }
    if (o.live && e.target.closest(".cp-x, .cp-xs, .cp-xc, .cp-s")) { pull(); draw(); } });   /* K1 : champs calculés recalculés à la saisie */
  d.addEventListener("click", async e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (o.done) o.done(); return; }
    const tb = e.target.closest("[data-cptab]"); if (tb) { if (!ro) pull(); tab = tb.dataset.cptab; OPEN.clear(); OPEN.add((o.tabs.find(t => t[0] === tab) || [0, 0, []])[2][0]); draw(); return; }
    const sc = e.target.closest("[data-cpsec]"); if (sc) { if (!ro) pull(); const k = sc.dataset.cpsec; if (OPEN.has(k)) OPEN.delete(k); else OPEN.add(k); draw(); return; }
    if (ro) return;
    const ad = e.target.closest("[data-cpadd]"); if (ad) { pull(); const k = ad.dataset.cpadd; F[k].push(JSON.parse(JSON.stringify(o.subs[k].blank))); draw(); return; }
    const rm = e.target.closest("[data-cprm]"); if (rm) { pull(); const [k, i] = rm.dataset.cprm.split("|"); F[k].splice(+i, 1); draw(); return; }
    const lr = e.target.closest("[data-logorm]"); if (lr) { pull(); F[lr.dataset.logorm || "logo"] = ""; draw(); return; }
    if (!e.target.closest("[data-cpok]")) return;
    pull(); const L = o.L(), x = L.find(y => y.id === o.id); if (!x) return;
    const bad = o.check ? o.check(F, L) : ""; if (bad) { svToast(bad, 3500); return; }
    const ch = Object.keys(o.labs).filter(k => JSON.stringify(x[k] ?? "") !== JSON.stringify(F[k] ?? ""));
    Object.assign(x, F, { mod: achNow() }); o.save(L); if (ch.length) achHist(x.code, "MODIFICATION", ch.map(k => o.labs[k]).join(", "));
    d.remove(); if (o.done) o.done(); });
}

/* ---------- CLIENT : fenêtre i ---------- */
const ACH_CLI_LAB = { nom: "NOM", denom: "DÉNOMINATION", forme: "FORME", type: "TYPE", grp: "GROUPE", pays: "PAYS", ville: "VILLE", adresse: "ADRESSE", lang: "LANGUE", site: "SITE WEB", dirigeant: "DIRIGEANT", resp: "RESPONSABLE INTERNE", logo: "LOGO", lie: "CLIENT LIÉ",
  mailSit: "E-MAIL DES SITUATIONS", mailFac: "E-MAIL DE FACTURATION", cte: "CONTACTS", ice: "ICE", ifisc: "IF", rc: "RC", villeRc: "VILLE RC", patente: "PATENTE", capital: "CAPITAL", cnss: "CNSS", docs: "DOCUMENTS",
  codeCpt: "CODE COMPTABLE", intCpt: "INTITULÉ COMPTABLE", ribs: "RIB", plafEnc: "PLAFOND D'ENCOURS", jours: "JOURS DE PAIEMENT HABITUELS", payeur: "PERSONNE QUI PAIE", cau: "CAUTIONS", modeReg: "MODE DE RÈGLEMENT", delai: "DÉLAI DE PAIEMENT",
  retTaux: "RETENUE DE GARANTIE", escTaux: "ESCOMPTE", devise: "DEVISE", cgf: "CONTRATS", cla: "CLAUSES", solva: "SOLVABILITÉ", strat: "PLACE DU CLIENT", evl: "ÉVALUATIONS" };
function achCliFiche(id, done) {
  achCpWin({ L: achCli, save: achCliSave, id, done, labs: ACH_CLI_LAB, why: achCliWhy, ttl: F => esc(F.nom || "") + " : " + esc(F.code || ""),
    check: (F, L) => !F.nom ? "NOM OBLIGATOIRE." : (achDig(F.ice) && L.some(y => y.id !== id && !y.del && achDig(y.ice) === achDig(F.ice))) ? "UN AUTRE CLIENT A CET ICE." : "",
    tabs: [["id", "IDENTITÉ", ["id", "cte"]], ["leg", "FISCAL ET LÉGAL", ["fisc", "docs"]], ["bq", "BANQUE ET PAIEMENT", ["cpt", "rib", "enc", "cau"]], ["vte", "CONDITIONS DE VENTE", ["cond", "cgf", "cla"]],
      ["rsq", "RISQUE", ["rsq", "evl"]], ["sim", "CLIENTS SIMILAIRES", ["sim"]], ["stat", "STATISTIQUES", ["stat"]]],
    subs: { cte: { cols: [["nom", "NOM"], ["fonction", "FONCTION"], ["tel", "TÉLÉPHONE"], ["email", "E-MAIL"]], blank: { nom: "", fonction: "", tel: "", email: "" } },
      docs: { cols: [["type", "DOCUMENT"], ["no", "N°"], ["exp", "EXPIRE LE", "", "date"]], blank: { type: "", no: "", exp: "" } },
      ribs: { cols: [["rib", "RIB"], ["bq", "BANQUE"]], blank: { rib: "", bq: "" } },
      cau: { cols: [["type", "TYPE"], ["no", "N°"], ["bq", "BANQUE"], ["mt", "MONTANT", "number"], ["ech", "ÉCHÉANCE", "", "date"]], blank: { type: "", no: "", bq: "", mt: "", ech: "" } },
      cgf: { cols: [["intitule", "INTITULÉ"], ["debut", "DÉBUT", "", "date"], ["fin", "FIN", "", "date"], ["mt", "MONTANT", "number"]], blank: { intitule: "", debut: "", fin: "", mt: "" } },
      cla: { cols: [["txt", "CLAUSE"]], blank: { txt: "" } },
      evl: { cols: [["date", "DATE", "", "date"], ["note", "NOTE / 5", "number"], ["obs", "OBSERVATION"]], blank: { date: "", note: "", obs: "" } } },
    secs: {
      id: (F, h) => `<div class="frs-st">IDENTITÉ</div><div class="frs-g">${achCreeFld(F)}${h.inp("nom", "NOM", { req: 1, w: 1 })}${h.inp("denom", "DÉNOMINATION SOCIALE", { w: 1 })}${h.sel("type", "TYPE DE CLIENT", ACH_CLI_TYPES)}
        ${h.inp("forme", "FORME JURIDIQUE", { list: ["ADMINISTRATION", "ÉTABLISSEMENT PUBLIC", "COLLECTIVITÉ", "SA", "SARL", "SARL AU", "SNC", "PARTICULIER"] })}${h.inp("grp", "GROUPE")}${h.inp("pays", "PAYS")}
        ${h.inp("ville", "VILLE", { list: typeof sviPgVilles === "function" ? sviPgVilles().map(x => x.lab) : [] })}${h.inp("adresse", "ADRESSE", { w: 1 })}${h.inp("lang", "LANGUE")}${h.inp("site", "SITE WEB", { keep: 1 })}
        ${h.inp("dirigeant", "DIRIGEANT")}${h.inp("resp", "RESPONSABLE INTERNE")}${h.sel("lie", "CLIENT LIÉ", achCli().filter(y => !y.del && y.id !== F.id).map(y => [y.id, y.nom]))}
        ${h.inp("mailSit", "E-MAIL DES SITUATIONS", { keep: 1 })}${h.inp("mailFac", "E-MAIL DE FACTURATION", { keep: 1 })}
        <div class="frs-f frs-w frs-logo"><span>LOGO</span><div>${F.logo ? `<img src="${esc(F.logo)}" alt="">` : ""}<input type="file" accept="image/*" class="cp-logo-in">${F.logo ? ` <button type="button" class="ach-b" data-logorm>RETIRER LE LOGO</button>` : ""}</div></div></div>`,
      cte: (F, h) => `<div class="frs-st">CONTACTS ${svCnt(F.cte.length)}</div>${h.sub("cte", "UN CONTACT")}`,
      fisc: (F, h) => `<div class="frs-st">FISCAL ET LÉGAL</div><div class="frs-g">${h.inp("ice", "ICE", { num: 1, mask: "ice", req: F.type === "PRIVÉ" })}${h.inp("ifisc", "IDENTIFIANT FISCAL", { num: 1, mask: "if" })}${h.inp("rc", "REGISTRE DE COMMERCE", { num: 1, mask: "rc" })}
        ${h.inp("villeRc", "VILLE RC")}${h.inp("patente", "PATENTE", { num: 1 })}${h.inp("capital", "CAPITAL", { num: 1 })}${h.inp("cnss", "N° CNSS", { num: 1, mask: "cnss" })}</div>`,
      docs: (F, h) => `<div class="frs-st">DOCUMENTS ${svCnt(F.docs.length)}</div>${h.sub("docs", "UN DOCUMENT")}`,
      cpt: (F, h) => `<div class="frs-st">COMPTE COMPTABLE</div><div class="frs-g">${h.inp("codeCpt", "CODE COMPTABLE")}${h.inp("intCpt", "INTITULÉ COMPTABLE", { w: 1 })}</div>`,
      rib: (F, h) => `<div class="frs-st">RIB ${svCnt(F.ribs.length)}</div>${h.sub("ribs", "UN RIB")}`,
      enc: (F, h) => `<div class="frs-st">ENCOURS ET ENCAISSEMENT</div><div class="frs-g">${h.ro("ENCOURS ACTUEL", "—")}${h.inp("plafEnc", "PLAFOND D'ENCOURS", { num: 1 })}${h.inp("jours", "JOURS DE PAIEMENT HABITUELS", { num: 1 })}${h.inp("payeur", "PERSONNE QUI PAIE")}</div>`,
      cau: (F, h) => `<div class="frs-st">CAUTIONS ET GARANTIES DONNÉES ${svCnt(F.cau.length)}</div>${h.sub("cau", "UNE CAUTION")}`,
      cond: (F, h) => `<div class="frs-st">CONDITIONS DE PAIEMENT</div><div class="frs-g">${h.inp("modeReg", "MODE DE RÈGLEMENT", { list: typeof ACH_MODES !== "undefined" ? ACH_MODES : [] })}${h.inp("delai", "DÉLAI DE PAIEMENT (JOURS)", { num: 1 })}
        ${h.inp("retTaux", "RETENUE DE GARANTIE (%)", { num: 1 })}${h.inp("escTaux", "ESCOMPTE (%)", { num: 1 })}${h.inp("devise", "DEVISE", { list: ["MAD", "EUR", "USD"] })}</div>`,
      cgf: (F, h) => `<div class="frs-st">CONTRATS ${svCnt(F.cgf.length)}</div>${h.sub("cgf", "UN CONTRAT")}`,
      cla: (F, h) => `<div class="frs-st">CLAUSES ${svCnt(F.cla.length)}</div>${h.sub("cla", "UNE CLAUSE")}`,
      rsq: (F, h) => `<div class="frs-st">RISQUE</div><div class="frs-g">${h.sel("solva", "SOLVABILITÉ", ["BONNE", "MOYENNE", "FAIBLE"])}${h.sel("strat", "PLACE DU CLIENT", ["STRATÉGIQUE", "IMPORTANT", "COURANT", "OCCASIONNEL"])}</div>`,
      evl: (F, h) => `<div class="frs-st">ÉVALUATIONS ${svCnt(F.evl.length)}</div>${h.sub("evl", "UNE ÉVALUATION")}`,
      sim: F => { const S = achCli().filter(y => !y.del && y.id !== F.id && ((F.grp && y.grp === F.grp) || (F.type && y.type === F.type && F.ville && y.ville === F.ville)));
        return `<div class="frs-st">CLIENTS SIMILAIRES ${svCnt(S.length)}</div><table class="prm-table frs-sub"><thead><tr><th>RÉFÉRENCE</th><th>NOM</th><th>TYPE</th><th>VILLE</th></tr></thead><tbody>${S.map(y => `<tr><td>${esc(y.code)}</td><td>${esc(y.nom)}</td><td>${esc(y.type || "")}</td><td>${esc(y.ville || "")}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">MÊME GROUPE, OU MÊME TYPE ET MÊME VILLE : AUCUN.</td></tr>`}</tbody></table>`; },
      stat: (F, h) => { const P = achPrj().filter(p => !p.del && p.cli === F.id), B = P.flatMap(p => achPrjBdg(p.code));
        return `<div class="frs-st">STATISTIQUES</div><div class="frs-g">${h.ro("PROJETS", P.length)}${h.ro("PROJETS EN COURS", P.filter(p => !p.arch && achSt(p) === "instance").length)}${h.ro("BUDGETS", B.length)}${h.ro("MONTANT FACTURÉ (12 MOIS)", "—")}${h.ro("MONTANT ENCAISSÉ (12 MOIS)", "—")}</div>`; } } });
}
/* ---------- PROJET : fenêtre i (série K, K1) — 6 onglets, 18 sections pliables ---------- */
const ACH_PRJ_AV = 30;   /* K1 : alerte ⚠ des échéances, jours d'avance par défaut (proposé) */
const achDPlus = (d, j) => { const t = new Date(String(d).slice(0, 10) + "T12:00:00"); if (isNaN(t)) return ""; t.setDate(t.getDate() + Math.round(j)); return t.toISOString().slice(0, 10); };
const achDMois = (d, m) => { const t = new Date(String(d).slice(0, 10) + "T12:00:00"); if (isNaN(t)) return ""; t.setMonth(t.getMonth() + Math.round(m)); return t.toISOString().slice(0, 10); };
const achJours = (a, b) => { const x = new Date(String(a).slice(0, 10) + "T12:00:00"), y = new Date(String(b).slice(0, 10) + "T12:00:00"); return isNaN(x) || isNaN(y) ? "" : Math.max(0, Math.round((y - x) / 864e5)); };
/* DATE BUTOIR = OS DE COMMENCEMENT + DÉLAI D'EXÉCUTION + PROLONGATIONS (délais des avenants, jours) + JOURS D'ARRÊT ; sans OS ou sans délai : saisie */
const achPrjButoir = p => !p.dOs || !(achN(p.delaiMois) > 0) ? p.butoir || "" : achDPlus(achDMois(p.dOs, achN(p.delaiMois)), (p.avn || []).reduce((t, a) => t + achN(a.delai), 0) + (p.arrets || []).reduce((t, a) => t + (achJours(a.dArr, a.dRep) || 0), 0));
const achPrjTtc = p => achN(p.mtHt) * (1 + achN(p.tva) / 100);
const achPrjEtat = p => p.del ? "SUPPRIMÉ" : p.arch ? "ARCHIVÉ" : p.clot ? "CLÔTURÉ" : "EN INSTANCE";
const achPrjStOf = p => p.del ? "annule" : p.arch ? "archive" : p.bloq ? "bloque" : p.clot ? "valide" : "instance";
const achPrjDist = p => { try { const a = sviGpsParse(p.gps), G = (typeof sviPg === "function" ? sviPg().gen : {}) || {}, b = sviGpsParse(G.gpsDep || G.gps || ""); return a && b ? Math.round(sviGpsKm(a, b)) + " KM" : "—"; } catch (e) { return "—"; } };
/* échéances du projet (alerte ⚠ avant la date, 10.5) */
const achPrjEch = p => { const out = [], lim = achDPlus(new Date().toISOString(), ACH_PRJ_AV), push = (d, lab) => { if (d && String(d).slice(0, 10) <= lim) out.push(lab + " : " + achDFr(d)); };
  if (!p.clot && !p.arch) push(achPrjButoir(p), "DATE BUTOIR");
  (p.cau || []).forEach(c => { if (!c.mainlevee) push(c.ech, "CAUTION " + (c.type || "") + " — ÉCHÉANCE"); });
  (p.ass || []).forEach(a => push(a.ech, "ASSURANCE " + (a.type || "") + " — ÉCHÉANCE"));
  push(p.odpEch, "OCCUPATION DU DOMAINE PUBLIC — ÉCHÉANCE");
  (p.res || []).forEach(r => { if (!r.levee) push(r.avant, "RÉSERVE " + (r.no || "") + " À LEVER AVANT"); });
  return out; };
const achPrjWhyK = p => achPrjWhy(p).concat(p.del ? [] : achPrjEch(p));
const ACH_PRJ_LAB = { code: "CODE PROJET", intitule: "INTITULÉ", typeOuv: "TYPE D'OUVRAGE", nature: "NATURE", prio: "PRIORITÉ", couleur: "COULEUR", photo: "PHOTO", chef: "CHEF DE PROJET", conduc: "CONDUCTEUR DE TRAVAUX", chefCh: "CHEF DE CHANTIER", desc: "DESCRIPTION",
  adresse: "ADRESSE", ville: "VILLE", province: "PROVINCE", gps: "GPS DU CHANTIER", surface: "EMPRISE / SURFACE", baseVie: "BASE VIE / DÉPÔT", contact: "CONTACT SUR PLACE", acces: "ACCÈS ET CONTRAINTES",
  cli: "CLIENT", moad: "MAÎTRE D'OUVRAGE DÉLÉGUÉ", aoNum: "N° D'APPEL D'OFFRES", dPlis: "OUVERTURE DES PLIS", aoObj: "OBJET DU MARCHÉ", marche: "N° DU MARCHÉ", dSign: "SIGNATURE", dAppr: "APPROBATION", dNotif: "NOTIFICATION",
  mtHt: "MONTANT HT", tva: "TVA", modePrix: "MODE DE PRIX", revision: "RÉVISION DES PRIX", avance: "AVANCE", penTaux: "PÉNALITÉS (TAUX)", penPlaf: "PÉNALITÉS (PLAFOND)", grpMand: "GROUPEMENT — MANDATAIRE", grpParts: "GROUPEMENT — PARTS", finance: "SOURCE DE FINANCEMENT",
  lots: "LOTS DU MARCHÉ", avn: "AVENANTS", ccli: "CONTACTS DU CLIENT", interv: "INTERVENANTS", str: "SOUS-TRAITANCE",
  delaiMois: "DÉLAI D'EXÉCUTION", dOs: "OS DE COMMENCEMENT", deb: "DATE DE DÉBUT", fin: "DATE DE FIN", butoir: "DATE BUTOIR", arrets: "OS D'ARRÊT ET DE REPRISE", recProv: "RÉCEPTION PROVISOIRE", recDef: "RÉCEPTION DÉFINITIVE", garantie: "DÉLAI DE GARANTIE",
  eff: "EFFECTIF PRÉVU", mat: "MATÉRIEL AFFECTÉ", horaires: "HORAIRES", cal: "CALENDRIER", reuJour: "RÉUNION — JOUR", reuHeure: "RÉUNION — HEURE", reuPer: "RÉUNION — PÉRIODICITÉ", reuPart: "RÉUNION — PARTICIPANTS",
  decPer: "PÉRIODICITÉ DES DÉCOMPTES", decMode: "MODE DE FACTURATION", delaiPay: "DÉLAI DE PAIEMENT", interets: "INTÉRÊTS MORATOIRES", cau: "CAUTIONS", rgTaux: "RETENUE DE GARANTIE (%)", rgPlaf: "RETENUE DE GARANTIE (PLAFOND)", rgDate: "RESTITUTION DE LA RETENUE", ass: "ASSURANCES",
  analyt: "CODE ANALYTIQUE", devise: "DEVISE", tvaReg: "RÉGIME DE TVA", tvaRef: "RÉFÉRENCE DE L'EXONÉRATION", banque: "BANQUE DU CHANTIER",
  pcNo: "PERMIS — N°", pcDate: "PERMIS — DATE", pcAut: "PERMIS — AUTORITÉ", odpNo: "DOMAINE PUBLIC — N°", odpDate: "DOMAINE PUBLIC — DATE", odpEch: "DOMAINE PUBLIC — ÉCHÉANCE", doc: "DÉCLARATION D'OUVERTURE", br: "BRANCHEMENTS",
  coordSec: "COORDINATEUR SÉCURITÉ", pss: "PLAN DE SÉCURITÉ", panneau: "PANNEAU DE CHANTIER", dechFil: "DÉCHETS — FILIÈRE", dechPrest: "DÉCHETS — PRESTATAIRE", acc: "ACCIDENTS ET INCIDENTS", res: "RÉSERVES", recl: "RÉCLAMATIONS" };
const ON = ["OUI", "NON"];
const achBanques = () => { try { return sviPgL("banques").filter(x => !x.p).map(x => x.lab); } catch (e) { return []; } };
const achDevises = () => { try { const D = sviPgL("devises").map(x => x.code); return D.length ? D : ["MAD"]; } catch (e) { return ["MAD"]; } };
const achQqNoms = () => { try { const S = new Set(); (sviInstGet() || []).forEach(b => ((b.data || {}).qlt || []).forEach(q => { [q.org, q.labo, q.bc, q.nom].forEach(v => { if (v) S.add(achU(v)); }); })); achPrj().forEach(p => (p.interv || []).forEach(x => { if (x.nom) S.add(achU(x.nom)); })); return [...S].sort(); } catch (e) { return []; } };
function achPrjFiche(id, done, focusK) {
  const p0 = achPrj().find(x => x.id === id); if (!p0) return;
  achCpWin({ L: achPrj, save: achPrjSave, id, done, focusK, secKeys: { mar: ["cli", "moad", "aoNum", "dPlis", "cons", "aoObj", "marche", "mtHt", "tva"], cht: ["gps", "adresse", "ville"], dl: ["butoir", "dOs", "delaiMois"] }, labs: ACH_PRJ_LAB, why: achPrjWhyK, live: true, editValid: true, ttl: F => esc(F.code || ""),   /* I8 : code du projet seul au bandeau */
    check: (F, L) => !F.code ? "CODE PROJET OBLIGATOIRE." : L.some(y => y.id !== id && !y.del && achU(y.code) === achU(F.code)) ? "CE CODE PROJET EXISTE DÉJÀ." : "",
    tabs: [["id", "IDENTITÉ", ["gen", "cht"]], ["mar", "MARCHÉ", ["mar", "lots", "avn"]], ["itv", "INTERVENANTS", ["ccli", "interv", "str"]], ["del", "DÉLAIS ET MOYENS", ["dl", "moy", "reu"]],
      ["fin", "FINANCES", ["fac", "gar", "cpt"]], ["cnf", "CONFORMITÉ ET SUIVI", ["aut", "sec", "res", "recl"]]],
    fold: { gen: ["GÉNÉRAL", 14], cht: ["CHANTIER", 9], mar: ["MARCHÉ", 22], lots: ["LOTS DU MARCHÉ", "t", "lots"], avn: ["AVENANTS", "t", "avn"], ccli: ["CONTACTS DU CLIENT", "t", "ccli"], interv: ["INTERVENANTS", "t", "interv"], str: ["SOUS-TRAITANCE", "t", "str"],
      dl: ["DÉLAIS", 9], moy: ["MOYENS", 4], reu: ["RÉUNIONS", 4], fac: ["FACTURATION", 5], gar: ["GARANTIES ET ASSURANCES", 5], cpt: ["COMPTABILITÉ", 5], aut: ["AUTORISATIONS", 8], sec: ["SÉCURITÉ ET ENVIRONNEMENT", 6], res: ["RÉSERVES", "t", "res"], recl: ["RÉCLAMATIONS ET CONTENTIEUX", "t", "recl"] },
    subs: { lots: { cols: [["no", "N°"], ["intitule", "INTITULÉ"], ["mt", "MONTANT", "number"], ["attr", "ATTRIBUÉ", "center", "sel", ON]], blank: { no: "", intitule: "", mt: "", attr: "" } },
      avn: { cols: [["no", "N°"], ["date", "DATE", "", "date"], ["objet", "OBJET"], ["mt", "MONTANT", "number"], ["delai", "DÉLAI SUPPLÉMENTAIRE (JOURS)", "number"]], blank: { no: "", date: "", objet: "", mt: "", delai: "" } },
      ccli: { cols: [["nom", "NOM"], ["fonction", "FONCTION"], ["tel", "TÉLÉPHONE"], ["email", "E-MAIL"], ["role", "RÔLE", "", "sel", ["SIGNATAIRE", "SUIVI TECHNIQUE", "PAIEMENT"]]], blank: { nom: "", fonction: "", tel: "", email: "", role: "" } },
      interv: { cols: [["role", "RÔLE", "", "sel", ACH_PRJ_ROLES], ["nom", "NOM", "", "list", achQqNoms], ["contact", "CONTACT"], ["refc", "RÉFÉRENCE DU CONTRAT"]], blank: { role: "", nom: "", contact: "", refc: "" } },
      str: { cols: [["frs", "SOUS-TRAITANT", "", "sel", () => achFrs().filter(f => !f.del && !f.arch).map(f => f.nom)], ["trav", "TRAVAUX CONFIÉS"], ["mt", "MONTANT", "number"], ["agr", "AGRÉMENT DU M.O.", "center", "sel", ON], ["dAgr", "DATE D'AGRÉMENT", "", "date"], ["cmd", "COMMANDE", "", "sel", () => achCmf().filter(c => !c.del && c.state !== "annule").map(c => c.ref)]], blank: { frs: "", trav: "", mt: "", agr: "", dAgr: "", cmd: "" } },
      arrets: { cols: [["dArr", "DATE D'ARRÊT", "", "date"], ["dRep", "DATE DE REPRISE", "", "date"], ["motif", "MOTIF"], ["j", "JOURS D'ARRÊT", "number", "calc", r => achJours(r.dArr, r.dRep)]], blank: { dArr: "", dRep: "", motif: "" } },
      eff: { cols: [["metier", "MÉTIER"], ["nb", "EFFECTIF", "number"]], blank: { metier: "", nb: "" } },
      mat: { cols: [["engin", "ENGIN"], ["du", "DU", "", "date"], ["au", "AU", "", "date"]], blank: { engin: "", du: "", au: "" } },
      cau: { cols: [["type", "CAUTION", "", "sel", ["PROVISOIRE", "DÉFINITIVE", "D'AVANCE"]], ["mt", "MONTANT", "number"], ["bq", "BANQUE", "", "sel", achBanques], ["ech", "ÉCHÉANCE", "", "date"], ["mainlevee", "MAINLEVÉE LE", "", "date"]], blank: { type: "", mt: "", bq: "", ech: "", mainlevee: "" } },
      ass: { cols: [["type", "ASSURANCE", "", "sel", ["TOUS RISQUES CHANTIER", "RESPONSABILITÉ CIVILE", "DÉCENNALE"]], ["assureur", "ASSUREUR"], ["police", "N° DE POLICE"], ["ech", "ÉCHÉANCE", "", "date"]], blank: { type: "", assureur: "", police: "", ech: "" } },
      br: { cols: [["type", "BRANCHEMENT", "", "sel", ["EAU", "ÉLECTRICITÉ", "ASSAINISSEMENT"]], ["op", "OPÉRATEUR"], ["dossier", "N° DE DOSSIER"], ["mes", "MISE EN SERVICE", "", "date"]], blank: { type: "", op: "", dossier: "", mes: "" } },
      acc: { cols: [["date", "DATE", "", "date"], ["nature", "NATURE"], ["suite", "SUITE DONNÉE"]], blank: { date: "", nature: "", suite: "" } },
      res: { cols: [["no", "N°"], ["desc", "DESCRIPTION"], ["lot", "LOT"], ["emise", "ÉMISE LE", "", "date"], ["avant", "À LEVER AVANT", "", "date"], ["levee", "LEVÉE LE", "", "date"], ["etat", "ÉTAT", "center", "calc", r => r.levee ? "LEVÉE" : "À LEVER"]], blank: { no: "", desc: "", lot: "", emise: "", avant: "", levee: "" } },
      recl: { cols: [["date", "DATE", "", "date"], ["objet", "OBJET"], ["mtR", "MONTANT RÉCLAMÉ", "number"], ["partie", "PARTIE", "", "sel", ["CLIENT", "SOUS-TRAITANT", "FOURNISSEUR"]], ["etat", "ÉTAT", "", "sel", ["EN COURS", "ACCEPTÉE", "REJETÉE", "EN CONTENTIEUX", "CLOSE"]], ["mtO", "MONTANT OBTENU", "number"]], blank: { date: "", objet: "", mtR: "", partie: "", etat: "", mtO: "" } } },
    secs: {
      gen: (F, h) => `<div class="frs-g">${achCreeFld(F)}${h.inp("code", "CODE PROJET", { req: 1, ro: achPrjBdg(p0.code).length > 0 })}${h.inp("intitule", "INTITULÉ", { w: 1 })}${h.ro("ÉTAT", achPrjEtat(F))}
        ${h.sel("typeOuv", "TYPE D'OUVRAGE", ["BÂTIMENT", "VRD", "GÉNIE CIVIL", "OUVRAGE D'ART", "HYDRAULIQUE", "AUTRE"])}${h.sel("nature", "NATURE", ["MARCHÉ PUBLIC", "MARCHÉ PRIVÉ", "SOUS-TRAITANCE"])}${h.sel("prio", "PRIORITÉ", ["HAUTE", "NORMALE", "BASSE"])}
        ${h.color("couleur", "COULEUR DU PROJET")}${h.inp("chef", "CHEF DE PROJET")}${h.inp("conduc", "CONDUCTEUR DE TRAVAUX")}${h.inp("chefCh", "CHEF DE CHANTIER")}${h.photo("photo", "PHOTO DU PROJET")}${h.area("desc", "DESCRIPTION")}</div>`,
      cht: (F, h) => `<div class="frs-g">${h.inp("adresse", "ADRESSE", { w: 1 })}${h.inp("ville", "VILLE", { list: typeof sviPgVilles === "function" ? sviPgVilles().map(x => x.lab) : [] })}${h.inp("province", "PROVINCE")}${h.inp("gps", "GPS DU CHANTIER", { keep: 1 })}
        ${h.inp("surface", "EMPRISE / SURFACE")}${h.inp("baseVie", "BASE VIE / DÉPÔT")}${h.ro("DISTANCE AU DÉPÔT", achPrjDist(F))}${h.inp("contact", "CONTACT SUR PLACE")}${h.inp("acces", "ACCÈS ET CONTRAINTES", { w: 1 })}</div>`,
      mar: (F, h) => `<div class="frs-g">${h.sel("cli", "CLIENT / MAÎTRE D'OUVRAGE", achCli().filter(y => !y.del).map(y => [y.id, y.nom]), { req: 1 })}${h.inp("moad", "MAÎTRE D'OUVRAGE DÉLÉGUÉ")}${h.ro("TYPE DE CLIENT", ((achCli().find(c => c.id === F.cli) || {}).type) || "—")}
        ${h.inp("aoNum", "N° D'APPEL D'OFFRES")}${h.inp("dPlis", "DATE D'OUVERTURE DES PLIS", { date: 1 })}${h.chk("cons", "SUR CONSULTATION")}${h.inp("aoObj", "OBJET DU MARCHÉ", { w: 1 })}${h.inp("marche", "N° DU MARCHÉ")}
        ${h.inp("dSign", "DATE DE SIGNATURE", { date: 1 })}${h.inp("dAppr", "DATE D'APPROBATION", { date: 1 })}${h.inp("dNotif", "DATE DE NOTIFICATION", { date: 1 })}
        ${h.inp("mtHt", "MONTANT HT", { num: 1 })}${h.inp("tva", "TVA (%)", { num: 1 })}${h.ro("MONTANT TTC", achF2(achPrjTtc(F)))}${h.ro("MONTANT AVEC AVENANTS (TTC)", achF2(achPrjTtc(F) + (F.avn || []).reduce((t, a) => t + achN(a.mt), 0)))}
        ${h.sel("modePrix", "MODE DE PRIX", ["BORDEREAU DES PRIX", "FORFAIT", "MIXTE"])}${h.sel("revision", "RÉVISION DES PRIX", ON)}${h.inp("avance", "AVANCE (%)", { num: 1 })}${h.inp("penTaux", "PÉNALITÉS DE RETARD (TAUX ‰ / JOUR)", { num: 1 })}${h.inp("penPlaf", "PÉNALITÉS — PLAFOND (%)", { num: 1 })}
        ${h.inp("grpMand", "GROUPEMENT — MANDATAIRE")}${h.inp("grpParts", "GROUPEMENT — PART DE CHACUN")}${h.inp("finance", "SOURCE DE FINANCEMENT")}</div>`,
      lots: (F, h) => h.sub("lots", "UN LOT"), avn: (F, h) => h.sub("avn", "UN AVENANT"), ccli: (F, h) => h.sub("ccli", "UN CONTACT"), interv: (F, h) => h.sub("interv", "UN INTERVENANT"), str: (F, h) => h.sub("str", "UNE SOUS-TRAITANCE"),
      dl: (F, h) => { const bc = !!(F.dOs && achN(F.delaiMois) > 0);
        return `<div class="frs-g">${h.inp("delaiMois", "DÉLAI D'EXÉCUTION (MOIS)", { num: 1 })}${h.inp("dOs", "DATE DE L'OS DE COMMENCEMENT", { date: 1 })}${h.inp("deb", "DATE DE DÉBUT", { date: 1 })}${h.inp("fin", "DATE DE FIN", { date: 1 })}
        ${bc ? h.ro("DATE BUTOIR (OS + DÉLAI + PROLONGATIONS + ARRÊTS)", achDFr(achPrjButoir(F))) : h.inp("butoir", "DATE BUTOIR", { date: 1 })}${h.inp("recProv", "RÉCEPTION PROVISOIRE", { date: 1 })}${h.inp("recDef", "RÉCEPTION DÉFINITIVE", { date: 1 })}${h.inp("garantie", "DÉLAI DE GARANTIE (MOIS)", { num: 1 })}</div>
        <div class="frs-sst">OS D'ARRÊT ET DE REPRISE</div>${h.sub("arrets", "UN OS D'ARRÊT")}`; },
      moy: (F, h) => `<div class="frs-sst">EFFECTIF PRÉVU PAR MÉTIER</div>${h.sub("eff", "UN MÉTIER")}<div class="frs-sst">MATÉRIEL AFFECTÉ</div>${h.sub("mat", "UN ENGIN")}
        <div class="frs-g">${h.inp("horaires", "HORAIRES DE TRAVAIL")}${h.sel("cal", "CALENDRIER DU CHANTIER", ["CALENDRIER DE LA SOCIÉTÉ"])}</div>`,
      reu: (F, h) => `<div class="frs-g">${h.sel("reuJour", "JOUR", ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"])}${h.inp("reuHeure", "HEURE", { keep: 1 })}${h.sel("reuPer", "PÉRIODICITÉ", ["HEBDOMADAIRE", "TOUS LES 15 JOURS", "MENSUELLE"])}${h.inp("reuPart", "PARTICIPANTS", { w: 1 })}</div>`,
      fac: (F, h) => `<div class="frs-g">${h.sel("decPer", "PÉRIODICITÉ DES DÉCOMPTES", ["MENSUELLE", "BIMESTRIELLE", "TRIMESTRIELLE", "À L'AVANCEMENT"])}${h.sel("decMode", "MODE", ["ATTACHEMENTS", "SITUATIONS"])}${h.inp("delaiPay", "DÉLAI DE PAIEMENT CONTRACTUEL (JOURS)", { num: 1 })}
        ${h.sel("interets", "INTÉRÊTS MORATOIRES", ON)}${h.ro("DÉCOMPTE SUIVANT N°", "1")}</div>`,
      gar: (F, h) => `<div class="frs-sst">CAUTIONS</div>${h.sub("cau", "UNE CAUTION")}<div class="frs-g">${h.inp("rgTaux", "RETENUE DE GARANTIE (%)", { num: 1 })}${h.inp("rgPlaf", "PLAFOND (%)", { num: 1 })}${h.inp("rgDate", "DATE DE RESTITUTION", { date: 1 })}</div>
        <div class="frs-sst">ASSURANCES</div>${h.sub("ass", "UNE ASSURANCE")}`,
      cpt: (F, h) => `<div class="frs-g">${h.inp("analyt", "CODE ANALYTIQUE / CENTRE DE COÛT")}${h.sel("devise", "DEVISE", achDevises())}${h.sel("tvaReg", "RÉGIME DE TVA", ["NORMAL", "EXONÉRÉ"])}${h.inp("tvaRef", "RÉFÉRENCE DE L'EXONÉRATION")}${h.sel("banque", "BANQUE DU CHANTIER", achBanques())}</div>`,
      aut: (F, h) => `<div class="frs-g">${h.inp("pcNo", "PERMIS DE CONSTRUIRE — N°")}${h.inp("pcDate", "PERMIS — DATE", { date: 1 })}${h.inp("pcAut", "PERMIS — AUTORITÉ")}
        ${h.inp("odpNo", "OCCUPATION DU DOMAINE PUBLIC — N°")}${h.inp("odpDate", "OCCUPATION — DATE", { date: 1 })}${h.inp("odpEch", "OCCUPATION — ÉCHÉANCE", { date: 1 })}${h.inp("doc", "DÉCLARATION D'OUVERTURE DE CHANTIER", { date: 1 })}</div>
        <div class="frs-sst">BRANCHEMENTS</div>${h.sub("br", "UN BRANCHEMENT")}`,
      sec: (F, h) => `<div class="frs-g">${h.sel("coordSec", "COORDINATEUR SÉCURITÉ", (F.interv || []).filter(x => x.nom).map(x => x.nom))}${h.inp("pss", "PLAN DE SÉCURITÉ REMIS LE", { date: 1 })}${h.inp("panneau", "PANNEAU DE CHANTIER POSÉ LE", { date: 1 })}
        ${h.inp("dechFil", "GESTION DES DÉCHETS — FILIÈRE")}${h.inp("dechPrest", "GESTION DES DÉCHETS — PRESTATAIRE")}</div><div class="frs-sst">ACCIDENTS ET INCIDENTS</div>${h.sub("acc", "UN ACCIDENT OU INCIDENT")}`,
      res: (F, h) => h.sub("res", "UNE RÉSERVE"), recl: (F, h) => h.sub("recl", "UNE RÉCLAMATION") } });
}
/* ---------- cycle commun (VALIDER, BLOQUER, ARCHIVER, SUPPRIMER) ---------- */
const achCpAct = (L0, save, id, one, nomOf) => async (k, redraw) => { const L = L0(), x = L.find(y => y.id === id); if (!x) return; const nm = nomOf(x);
  if (k === "val") { if (await achNvValider(L, x, x.code, nm, [], save)) redraw(); return; }
  if (k === "bloq") { const m = await achAsk("BLOQUER " + nm, "MOTIF DU BLOCAGE"); if (!m) return; x.bloq = { u: typeof sviUser === "function" ? sviUser() : "", t: achNow(), why: m }; x.mod = achNow(); save(L); achHist(x.code, "BLOQUÉ", m); redraw(); return; }
  if (k === "debl") { const m = await achAsk("DÉBLOQUER " + nm, "MOTIF DU DÉBLOCAGE"); if (!m) return; delete x.bloq; x.mod = achNow(); save(L); achHist(x.code, "DÉBLOQUÉ", m); redraw(); return; }
  if (k === "arch") { if (!(await svConfirm({ title: "ARCHIVER", text: x.code + " — " + nm + " : IL NE SERA PLUS PROPOSÉ.", ok: "ARCHIVER" }))) return; x.arch = achNow(); x.mod = x.arch; save(L); achHist(x.code, "ARCHIVÉ", nm); redraw(); return; }
  if (k === "desarch") { delete x.arch; x.mod = achNow(); save(L); achHist(x.code, "DÉSARCHIVÉ", nm); redraw(); return; }
  if (k === "del") { if (!(await svConfirm({ title: "SUPPRIMER " + achCe(one), text: x.code + " — " + nm + " (RESTAURABLE DEPUIS LA CORBEILLE).", ok: "SUPPRIMER" }))) return; x.del = achNow(); save(L); achHist(x.code, "CORBEILLE", nm); redraw(); return; }
  if (k === "rest") { x.del = ""; save(L); achHist(x.code, "RESTAURATION", nm); redraw(); } };
const achCpMenu = (x, one) => [...achNvCycle(x), x.del ? null : x.bloq ? { k: "debl", lab: "DÉBLOQUER" } : { k: "bloq", lab: "BLOQUER" }, x.del ? null : x.arch ? { k: "desarch", lab: "DÉSARCHIVER" } : { k: "arch", lab: "ARCHIVER" },
  x.del ? { k: "rest", lab: "RESTAURER" } : { k: "del", lab: "SUPPRIMER " + achCe(one) }].filter(Boolean);
const ACH_CP_ETATS = [["actif", "ACTIFS"], ["bloque", "BLOQUÉS"], ["archive", "ARCHIVÉS"], ["corbeille", "CORBEILLE"], ["tout", "TOUT"]];
const achCpOk = (x, k) => k === "corbeille" ? !!x.del : x.del ? false : k === "tout" ? true : k === "archive" ? !!x.arch : k === "bloque" ? !x.arch && !!x.bloq : !x.arch && !x.bloq;
const achBdgRows = B => B.map(b => ({ cells: [b.ref, b.intitule || "", achBdgNat(b), achBdgTtc(b.ref), achBdgEt(b)], open: () => achBdgGo(b.ref), st: (b.state || "instance") === "instance" ? "instance" : b.state === "annule" ? "" : "valide", cls: b.state === "annule" ? "nv-strike" : "" }));
const ACH_BDG_COLS = [["RÉFÉRENCE"], ["INTITULÉ"], ["NATURE"], ["MONTANT TTC", "number"], ["ÉTAT", "center"]];

/* ---------- CLIENTS : liste et page ---------- */
function achCliNvMod(ctx) {
  return achNvMod(ctx, {
    list: { k: "cli", t: "ach_cli", id: "achCliT", name: "CLIENTS", one: "CLIENT", stKeys: ["instance", "valide", "bloque", "archive", "annule", "alerte"], edit: ACH_ED.cli, all: () => { achPrjSync(); return achCli(); }, save: achCliSave, code: c => c.code, nom: c => c.nom, why: achCliWhy,
      newRow: "CRÉER UN CLIENT ICI…",
      add: async done => { const nom = await achAsk("NOUVEAU CLIENT", "NOM"); if (!nom) { done(null); return; } const L = achCli(); if (L.some(y => !y.del && achU(y.nom) === achU(nom))) svToast("UN CLIENT DU MÊME NOM EXISTE.", 3500);
        const c = achCliNew(L, { nom }); achCliSave(L); achHist(c.code, "CRÉATION", c.nom); done(c.id); achCliFiche(c.id, () => done(c.id)); },
      w: { ref: 110, nom: 300, type: 100, ville: 140, ice: 160, prj: 90, cree: 110 },
      etat0: "tout", etats: ACH_CP_ETATS, ok: achCpOk,
      cols: () => [["ref", "RÉFÉRENCE", c => c.code, ""], ["nom", "NOM", c => c.nom, "", c => c.logo || ""], ["type", "TYPE", c => c.type || "", "center"], ["ville", "VILLE", c => c.ville || "", ""], ["ice", "ICE", c => achDig(c.ice), "center"],
        ["prj", "PROJETS", c => String(achPrj().filter(p => !p.del && p.cli === c.id).length), "center"]] },
    pageOf: id => { const c = achCli().find(x => x.id === id); if (!c) return null;
      const P = achPrj().filter(p => !p.del && p.cli === id), B = P.flatMap(p => achPrjBdg(p.code));
      return { id, code: c.code, ref: c.code, tag: "CLIENT", title: c.nom, st: achCpSt(c), del: !!c.del, why: achCliWhy(c),
        info: done => achCliFiche(id, () => done()), menu: achCpMenu(c, "CLIENT"), act: achCpAct(achCli, achCliSave, id, "CLIENT", x => x.nom),
        links: [
          { t: "PROJETS", cols: [["CODE"], ["INTITULÉ"], ["VILLE"], ["BUDGETS", "center"], ["ÉTAT", "center"]], rows: P.map(p => ({ cells: [p.code, p.intitule || "", p.ville || "", String(achPrjBdg(p.code).length), achPcStep("prj", p)], open: () => achGo("prj", p.id), st: achSt(p) })) },
          { t: "BUDGETS", cols: [["PROJET"]].concat(ACH_BDG_COLS), rows: B.map(b => { const r = achBdgRows([b])[0]; r.cells.unshift(achU(b.project || "")); return r; }) },
          { t: "CONTACTS", cols: [["NOM"], ["FONCTION"], ["TÉLÉPHONE"], ["E-MAIL"]], rows: (c.cte || []).map(x => ({ cells: [x.nom || "", x.fonction || "", x.tel || "", x.email || ""] })) }] }; } });
}
/* ---------- PROJETS : liste et page ---------- */
function achPrjNvMod(ctx) {
  return achNvMod(ctx, {
    list: { k: "prj", t: "ach_prj", id: "achPrjT", name: "PROJETS", one: "PROJET", stKeys: ["instance", "valide", "bloque", "archive", "annule", "alerte"], stLab: { instance: "EN INSTANCE", valide: "CLÔTURÉS" }, stOf: achPrjStOf, step: achPrjEtat, inst: p => !p.clot && !p.del && !p.arch, dV: p => p.clot || p.cree,
      edit: ACH_ED.prj, all: () => { achPrjSync(); return achPrj(); }, save: achPrjSave, code: p => p.code, nom: p => p.intitule, why: achPrjWhyK,
      newRow: "CRÉER UN PROJET ICI…",
      add: async done => { const code = await achAsk("NOUVEAU PROJET", "CODE PROJET"); if (!code) { done(null); return; } const L = achPrj(); if (L.some(y => !y.del && achU(y.code) === achU(code))) { svToast("CE CODE PROJET EXISTE DÉJÀ.", 3500); done(null); return; }
        const p = achPrjNew(L, { code }); achPrjSave(L); achHist(p.code, "CRÉATION", p.code); done(p.id); achPrjFiche(p.id, () => done(p.id)); },
      w: { ref: 110, intitule: 280, cli: 220, ville: 140, bdg: 90, cree: 110 },
      etat0: "tout", etats: ACH_CP_ETATS, ok: achCpOk,
      cols: () => [["ref", "CODE PROJET", p => p.code, ""], ["intitule", "INTITULÉ", p => p.intitule || "", ""], ["cli", "CLIENT", p => achCliNom(p.cli), ""], ["ville", "VILLE", p => p.ville || "", ""],
        ["bdg", "BUDGETS", p => String(achPrjBdg(p.code).length), "center"]] },
    pageOf: id => { const p = achPrj().find(x => x.id === id); if (!p) return null; const c = achCli().find(x => x.id === p.cli);
      const B = achPrjBdg(p.code), refs = new Set(B.map(b => b.ref)), BS = achBsn().filter(x => !x.del && refs.has(x.bdg)), bsIds = new Set(BS.map(x => x.id)), CM = achCmf().filter(c => !c.del && (c.lignes || []).some(l => bsIds.has(l.bsn)));
      const actK = achCpAct(achPrj, achPrjSave, id, "PROJET", x => x.intitule || x.code);
      return { id, code: p.code, ref: p.code, tag: "PROJET", title: p.intitule || p.code, party: c ? c.nom : "", partyGo: c ? "cli|" + c.id : "", st: achPrjStOf(p), del: !!p.del, why: achPrjWhyK(p),
        info: done => achPrjFiche(id, () => done()),
        menu: [p.del || p.arch ? null : p.clot ? { k: "rouvrir", lab: "ROUVRIR (EN INSTANCE)" } : { k: "clot", lab: "CLÔTURER (ACHEVÉ)" }].concat(achCpMenu(p, "PROJET").filter(m => m.k !== "val")).filter(Boolean),
        act: async (k, redraw) => { const L = achPrj(), x = L.find(y => y.id === id); if (!x) return;
          if (k === "clot") { if (!(await svConfirm({ title: "CLÔTURER LE PROJET", text: x.code + " — " + (x.intitule || "") + " : CHANTIER ACHEVÉ.", ok: "CLÔTURER", tone: "neutral" }))) return; x.clot = achNow(); x.mod = x.clot; achPrjSave(L); achHist(x.code, "CLÔTURÉ", ""); redraw(); return; }
          if (k === "rouvrir") { delete x.clot; x.mod = achNow(); achPrjSave(L); achHist(x.code, "ROUVERT", ""); redraw(); return; }
          return actK(k, redraw); },
        links: [
          { t: "BUDGETS", cols: ACH_BDG_COLS, rows: achBdgRows(B) },
          { t: "DÉCOMPTES / SITUATIONS", cols: [["N°"], ["PÉRIODE"], ["MONTANT TTC", "number"], ["ÉTAT", "center"]], rows: [] },
          { t: "ACHATS DU CHANTIER", cols: [["RÉFÉRENCE"], ["PIÈCE"], ["DÉSIGNATION"], ["MONTANT TTC", "number"]], rows: BS.map(x => ({ cells: [x.ref || "", "BESOIN", x.des || "", achN(x.q) * achN(x.pu)], open: () => achGo("bsn", x.id) }))
            .concat(CM.map(cm => ({ cells: [cm.ref, "COMMANDE", (cm.lignes || []).map(l => l.des).join("; "), achCmfTot(cm).ttc], open: () => achGo("cmf", cm.id), cls: cm.state === "annule" ? "nv-strike" : "" }))) }] }; } });
}

/* ---------- série K (K2 §7, réponse d'Ahmed du 10/11) : CONTRÔLE DES DÉPENSES — jamais de blocage : la commande passe par la validation
   d'un supérieur (circuit de la série E) quand (a) les commandes engagées (celle-ci comprise) atteignent le SEUIL (%) du budget d'une charge
   ou de tout le budget, ou (b) le rapport CHARGES / PRODUITS réalisé dépasse celui du budget (produits réalisés = décomptes, à venir) ---------- */
function achCmfBdgWhy(c) { try {
  const B = achBsn(), lb = l => l.bsn ? B.find(b => b.id === l.bsn) : null, eng = new Map(), cur = new Map(), add = (M, k, v) => M.set(k, (M.get(k) || 0) + v);
  const mtL = (cm, l) => achN(l.q) * achN(l.pu) * (1 - achN(cm.rem) / 100);
  (c.lignes || []).forEach(l => { const b = lb(l); if (b && b.bdg) add(cur, b.bdg + "§" + (b.chg || ""), mtL(c, l)); });
  if (!cur.size) return [];
  achCmf().filter(x => x.id !== c.id && !x.del && ["valide", "solde", "partiel", "recu", "livre"].includes(x.state)).forEach(x => (x.lignes || []).forEach(l => { const b = lb(l); if (b && b.bdg) add(eng, b.bdg + "§" + (b.chg || ""), mtL(x, l)); }));
  const out = [], refs = [...new Set([...cur.keys()].map(k => k.split("§")[0]))];
  refs.forEach(ref => { const it = (sviInstGet() || []).find(b => b.ref === ref); if (!it) return; const D = it.data || {}, seuil = achN(((D.k2 || {}).seuil) ?? 90) || 90, CH = achBdgCharges(ref);
    const totB = CH.reduce((t, x) => t + x.mt, 0); let totE = 0;
    [...cur.keys()].filter(k => k.startsWith(ref + "§")).forEach(k => { const ch = CH.find(x => x.key === k.slice(ref.length + 1)); const e = (eng.get(k) || 0) + cur.get(k); totE += cur.get(k);
      if (ch && ch.mt > 0 && e >= ch.mt * seuil / 100) out.push(ref + " — " + ch.des + " : " + Math.round(e / ch.mt * 100) + " % DU BUDGET (SEUIL " + seuil + " %)"); });
    [...eng.keys()].filter(k => k.startsWith(ref + "§")).forEach(k => { totE += eng.get(k); });
    if (totB > 0 && totE >= totB * seuil / 100) out.push(ref + " : " + Math.round(totE / totB * 100) + " % DU BUDGET ENGAGÉ (SEUIL " + seuil + " %)");
    /* (b) rapport charges / produits : produits réalisés = décomptes du projet (module à venir) — inactif tant qu'il n'y en a pas */
    const prdB = (D.des || []).filter(r => !r.t).reduce((t, r) => t + (typeof insLinkedQ === "function" ? (insLinkedQ(D, r.id) ?? achN(r.q)) : achN(r.q)) * achN(r.p), 0), prdR = achN(((D.k2 || {}).prdReal) || 0);
    if (prdB > 0 && prdR > 0 && totB > 0 && totE / prdR > totB / prdB) out.push(ref + " : CHARGES / PRODUITS RÉALISÉ (" + (totE / prdR).toFixed(2) + ") AU-DESSUS DU BUDGET (" + (totB / prdB).toFixed(2) + ")"); });
  return out; } catch (e) { return []; } }
function achCmfSeuK(c, S) { const why = achCmfBdgWhy(c); if (!why.length) return S;
  const G = (typeof sviPgL === "function" ? sviPgL("grades") : []).map(x => String(x.n)).filter(Boolean).sort((a, b) => +b - +a);
  if (S) return { ...S, why };
  return { mt: 0, g: G.length ? [G[0]] : ["1"], h: false, k: "cmf", why }; }
