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
/* ⟪ src/41-achats-ecran.js ⟫ */
/* =========================================================
   ACHATS — ÉCRAN (v749, étape 1)
   Onglets ARTICLES, FOURNISSEURS (livraison suivante), PARAMÈTRES.
   Mêmes briques que le budget : en-têtes à tri / filtre (sviCfKit, 09c), largeurs et ordre des colonnes mémorisés
   (cwLoad / coOrder, 09), case SAISIR ICI en bas, cases cochées pour les actions, H = historique, ⚠ = à compléter.
   ========================================================= */
function sviAchInit() {
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
  try { const t = localStorage.getItem("svi_ach_tab_v1"); if (t === "art" || t === "prm" || t === "frs") tab = t; } catch (e) {}
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
        ${showDel ? `<button type="button" class="ach-b" data-a="restore"${nSel ? "" : " disabled"}>RESTAURER LES COCHÉS <span class="svi-cnt">${nSel}</span></button><button type="button" class="ach-b" data-a="back">‹ RETOUR AUX ARTICLES</button>`
          : `<button type="button" class="ach-b" data-a="frombdg">REPRENDRE LES CHARGES DES BUDGETS</button>
             <button type="button" class="ach-b" data-a="merge"${nSel >= 2 ? "" : " disabled"}>FUSIONNER LES COCHÉS <span class="svi-cnt">${nSel}</span></button>
             <button type="button" class="ach-b" data-a="del"${nSel ? "" : " disabled"}>SUPPRIMER LES COCHÉS <span class="svi-cnt">${nSel}</span></button>
             <button type="button" class="ach-b" data-a="trash"${nDel ? "" : " disabled"}>CORBEILLE <span class="svi-cnt">${nDel}</span></button>`}
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
  /* ---------- PARAMÈTRES ---------- */
  const prmHTML = () => {
    const P = achPrm();
    const catRows = cfApply("ach_cat", [["cat1", "CATÉGORIE (FAMILLE D'ARTICLES)", x => x, ""]], P.cat);
    const bCols = coOrder("ach_bq", [["n", "BANQUE", b => b.n, ""], ["abr", "ABRÉVIATION", b => b.abr, "center"], ["codeb", "CODE RIB", b => b.code, "center"]]);
    const bRows = cfApply("ach_bq", bCols, P.banques);
    return `<div class="ach-prm">
      <div class="ach-pbox"><div class="ach-pt">TVA PAR DÉFAUT DES NOUVEAUX ARTICLES</div>
        <span class="ach-tvaw"><input class="ins-in ach-ptva number" inputmode="decimal" value="${esc(F2(P.tva))}" autocomplete="off"> %</span></div>
      <div class="ach-pbox"><div class="ach-pt">CATÉGORIES ${svCnt ? svCnt(catRows.length, P.cat.length) : ""}</div>
        <div class="ach-scroll"><table id="achCatT" class="bdg-d-table prm-table ach-table" data-ach="cat" style="width:${cw("cat", "cat1") + 44}px"><colgroup><col data-w="ach_cat.cat1" style="width:${cw("cat", "cat1")}px"><col style="width:44px"></colgroup>
          <thead><tr>${cfHead("ach_cat", "cat1", "CATÉGORIE (FAMILLE D'ARTICLES)")}<th class="center"></th></tr></thead>
          <tbody>${catRows.map(c => `<tr data-cat="${esc(c)}"><td><input class="ins-in ach-pin" data-p="cat" value="${esc(c)}" autocomplete="off"></td><td class="center"><button type="button" class="ach-x" data-xcat="${esc(c)}" title="Supprimer">✕</button></td></tr>`).join("")}
          <tr class="ach-new"><td><input class="ins-in ach-pnew" data-p="cat" placeholder="CRÉER UNE CATÉGORIE ICI…" autocomplete="off"></td><td></td></tr></tbody></table></div></div>
      <div class="ach-pbox"><div class="ach-pt">BANQUES ET CODES RIB ${svCnt ? svCnt(bRows.length, P.banques.length) : ""}</div>
        <div class="ach-scroll"><table id="achBqT" class="bdg-d-table prm-table ach-table" data-ach="bq" style="width:${bCols.reduce((s, c) => s + cw("bq", c[0]), 0) + 44}px"><colgroup>${bCols.map(c => `<col data-w="ach_bq.${c[0]}" style="width:${cw("bq", c[0])}px">`).join("")}<col style="width:44px"></colgroup>
          <thead><tr>${bCols.map(c => cfHead("ach_bq", c[0], c[1], c[3])).join("")}<th class="center"></th></tr></thead>
          <tbody>${bRows.map(b => `<tr data-bid="${esc(b.id)}" data-iid="${esc(b.id)}">${bCols.map(c => `<td class="${c[3]}"><input class="ins-in ach-bin${c[3] ? " " + c[3] : ""}" data-f="${c[0] === "codeb" ? "code" : c[0]}" value="${esc(c[0] === "codeb" ? b.code : b[c[0]])}" autocomplete="off"></td>`).join("")}<td class="center"><button type="button" class="ach-x" data-xbq="${esc(b.id)}" title="Supprimer">✕</button></td></tr>`).join("")}
          <tr class="ach-new"><td colspan="${bCols.length}"><input class="ins-in ach-bnew" placeholder="CRÉER UNE BANQUE ICI…" autocomplete="off"></td><td></td></tr></tbody></table></div>
        <div class="ach-note">CODE RIB : LES 3 PREMIERS CHIFFRES DU RIB (UNE PLAGE S'ÉCRIT 101-199) ; SERT À RECONNAÎTRE LA BANQUE D'UN RIB FOURNISSEUR.</div></div>
      <div class="ach-note">LES UNITÉS SONT CELLES DE PARAMÉTRAGE › UNITÉS, COMMUNES À TOUT LE SVI ERP.</div></div>`;
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
    if (h1) h1.textContent = tab === "prm" ? "ACHATS — PARAMÈTRES" : tab === "frs" ? "ACHATS — FOURNISSEURS" : showDel ? "ACHATS — CORBEILLE DES ARTICLES" : "ACHATS — ARTICLES";
    if (sub) sub.textContent = tab === "frs" ? "TOUCHER LE CODE : FICHE (RIB, DOCUMENTS FISCAUX, CONTACTS, ÉVALUATIONS, CONTRATS) ; COMMUN À TOUS LES APPAREILS" : tab === "prm" ? "CATÉGORIES, BANQUES, TVA PAR DÉFAUT ; COMMUNS À TOUS LES APPAREILS" : "UN ARTICLE = UNE CHARGE DU BUDGET (DÉSIGNATION + UNITÉ) ; COMMUN À TOUS LES BUDGETS ET À TOUS LES APPAREILS";
    body.innerHTML = tab === "prm" ? prmHTML() : tab === "frs" ? FRSM.html() : artTable();
    body.querySelectorAll("input.ach-cb, input.ach-all").forEach(c => { if (c.classList.contains("ach-all")) { const n = body.querySelectorAll("input.ach-cb:checked").length, t = body.querySelectorAll("input.ach-cb").length; c.indeterminate = n > 0 && n < t; } });
  });
  view.__achDraw = draw;
  /* v750 : entrée du menu ☰ (ACHAT › ARTICLES…) — ouvre l'onglet correspondant */
  view.__achTab = t => { if (t !== "art" && t !== "prm" && t !== "frs") return; tab = t; SEL.clear(); try { localStorage.setItem("svi_ach_tab_v1", tab); } catch (err) {} draw(); };
  /* ---------- gestes ---------- */
  bar.addEventListener("click", e => {
    const b = e.target.closest(".prm-tab"); if (!b) return;
    if (b.classList.contains("off")) { svToast(b.dataset.why || "", 3000, b); return; }
    tab = b.dataset.ach; SEL.clear();
    try { localStorage.setItem("svi_ach_tab_v1", tab); } catch (err) {}
    draw();
  });
  const artOf = el => { const tr = el.closest("tr[data-id]"); if (!tr) return null; const L = achArts(); return { L, a: L.find(x => x.id === tr.dataset.id) }; };
  body.addEventListener("click", async e => {
    const cf = e.target.closest(".cf-btn"); if (cf) { e.stopPropagation(); cfOpenMenu(cf); return; }
    const w = e.target.closest(".ach-warn"); if (w) { svToast(w.dataset.why, 4000, w); return; }
    const hb = e.target.closest(".ach-h"); if (hb) { achHistWin(hb.dataset.h); return; }
    if (tab === "frs" && await FRSM.click(e)) return;
    const bb = e.target.closest(".ach-bdg"); if (bb) { const L = achArts(), a = L.find(x => x.id === bb.dataset.bdg); if (a) achBdgWin(a); return; }
    const xc = e.target.closest("[data-xcat]"); if (xc) { const P = achPrm(); P.cat = P.cat.filter(c => c !== xc.dataset.xcat); achPrmSave(P); draw(); return; }
    const xb = e.target.closest("[data-xbq]"); if (xb) { const P = achPrm(); P.banques = P.banques.filter(b => b.id !== xb.dataset.xbq); achPrmSave(P); draw(); return; }
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
      if (!A.length || !(await svConfirm({ title: "METTRE À LA CORBEILLE", html: `<ul class="svc-list">${A.map(a => `<li>${esc(a.code + " — " + a.des)}</li>`).join("")}</ul><div class="svc-sub">RESTAURABLES DEPUIS LA CORBEILLE ; LEURS NUMÉROS NE SERONT PAS RÉUTILISÉS.</div>`, ok: "METTRE À LA CORBEILLE" }))) return;
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
    if (t.matches && t.matches(".ach-newin, .ach-pnew, .ach-bnew")) { if (t.__achDone) return; t.__achDone = true; }
    if (tab === "frs" && FRSM.change(e)) return;
    if (t.classList.contains("ach-all")) { body.querySelectorAll("tr[data-id]").forEach(tr => { if (t.checked) SEL.add(tr.dataset.id); else SEL.delete(tr.dataset.id); }); draw(); return; }
    if (t.classList.contains("ach-cb")) { const tr = t.closest("tr[data-id]"); if (t.checked) SEL.add(tr.dataset.id); else SEL.delete(tr.dataset.id); draw(); return; }
    /* paramètres */
    if (t.classList.contains("ach-ptva")) { const P = achPrm(), v = achN(t.value); if (v < 0 || v > 100) { svToast("TVA NON VALIDE (0 À 100).", 3000, t); draw(); return; } P.tva = v; achPrmSave(P); draw(); return; }
    if (t.classList.contains("ach-pnew") || t.classList.contains("ach-pin")) {
      const P = achPrm(), v = achU(t.value), old = t.closest("tr").dataset.cat;
      if (v && P.cat.some(c => c === v && c !== old)) { svToast("DOUBLON : " + v + " EXISTE DÉJÀ.", 3000, t); draw(); return; }
      if (old !== undefined) { P.cat = v ? P.cat.map(c => c === old ? v : c) : P.cat.filter(c => c !== old); if (v && v !== old) { const L = achArts(); L.forEach(a => { if (a.cat === old) { a.cat = v; a.mod = new Date().toISOString(); } }); achArtsSave(L); } }
      else if (v) P.cat.push(v);
      achPrmSave(P); draw(); return;
    }
    if (t.classList.contains("ach-bnew")) { const v = achU(t.value); if (!v) return; const P = achPrm(); if (P.banques.some(b => achU(b.n) === v)) { svToast("DOUBLON : " + v + " EXISTE DÉJÀ.", 3000, t); draw(); return; } P.banques.push({ id: "B" + Date.now().toString(36), n: v, abr: "", code: "" }); achPrmSave(P); draw();
      setTimeout(() => body.querySelector(`tr[data-bid="${P.banques[P.banques.length - 1].id}"] input[data-f="abr"]`)?.focus(), 0); return; }
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
    const i = e.target && e.target.closest && e.target.closest("#ach input.ach-newin, #ach input.ach-pnew, #ach input.ach-bnew");
    if (!i || (e.key !== "Enter" && e.key !== "Tab") || !String(i.value || "").trim()) return;
    e.preventDefault(); e.stopPropagation();
    /* la mise en majuscules pendant la frappe empêche le navigateur d'envoyer « change » : il est envoyé ici */
    i.dispatchEvent(new Event("change", { bubbles: true }));
    if (i.isConnected) i.blur();
  }, true);
  /* données reçues d'un autre appareil (base V3) : écran redessiné s'il est affiché */
  window.addEventListener("storage", () => { if (view.classList.contains("active-view")) draw(); });
  draw();
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
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sviAchInit); else sviAchInit();
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
    ["occ", "OCCASIONNEL", f => f.occ ? "OUI" : "NON", "center"], ["actif", "ACTIF", f => f.actif === false ? "NON" : "OUI", "center"]];
  const W0 = { code: 92, nom: 260, forme: 140, ville: 130, ice: 150, rib: 130, cond: 130, fam: 90, cte: 90, note: 90, occ: 100, actif: 70 };
  const cwF = k => (cwLoad()["ach_frs." + k]) || W0[k] || 100;
  const cellIn = (f, k) => {
    const ro = !!f.del;
    if (k === "code") return `<button type="button" class="ach-link" data-fiche="${esc(f.id)}" title="Ouvrir la fiche">${esc(f.code)}</button>`;
    if (k === "occ" || k === "actif") { const on = k === "occ" ? !!f.occ : f.actif !== false; return `<input type="checkbox" class="ach-ck frs-ck" data-f="${k}"${on ? " checked" : ""}${ro ? " disabled" : ""}>`; }
    if (k === "rib") { const r = achFrsRibP(f); return r ? `<button type="button" class="ach-link" data-fiche="${esc(f.id)}" data-sec="rib">${esc(ribTxt(r))}</button>` : `<span class="ach-0">—</span>`; }
    if (k === "fam" || k === "cte") { const n = (f[k] || []).length; return `<button type="button" class="ach-link" data-fiche="${esc(f.id)}" data-sec="${k}">${n}</button>`; }
    if (k === "note") { const n = achFrsNote(f); return n === null ? `<span class="ach-0">—</span>` : `<span>${esc(String(Math.round(n * 10) / 10).replace(".", ","))}</span>`; }
    const v = k === "ice" ? achDig(f.ice) : f[k] || "";
    return `<input class="ins-in ach-in frs-in${k === "ice" ? " center" : ""}" data-f="${k}" value="${esc(v)}"${k === "ice" ? ' inputmode="numeric"' : ""}${k === "forme" || k === "cond" ? ` data-sug="${k}"` : ""}${ro ? " readonly" : ""} autocomplete="off" enterkeyhint="next">`;
  };
  const html = () => {
    const all = achFrs(), rows0 = all.filter(f => fOk(f, fEtat));
    const cols = coOrder("ach_frs", FRS_COLS()), rows = cfApply("ach_frs", cols, rows0);
    const nDel = all.filter(f => f.del).length, nSel = [...SEL].filter(id => rows0.some(f => f.id === id)).length;
    const W = cols.reduce((s, c) => s + cwF(c[0]), 0) + 44 + 46, corb = fEtat === "corbeille";
    return `<div class="ach-tools">
        <button type="button" class="ach-b ach-etat" data-a="frs-etat">${(F_ETATS.find(x => x[0] === fEtat) || F_ETATS[0])[1]} ▾ ${svCnt(rows.length, rows0.length)}</button>
        ${corb ? `<button type="button" class="ach-b" data-a="frs-restore"${nSel ? "" : " disabled"}>RESTAURER LES COCHÉS <span class="svi-cnt">${nSel}</span></button><button type="button" class="ach-b" data-a="frs-back">‹ RETOUR AUX FOURNISSEURS</button>`
          : `<button type="button" class="ach-b" data-a="frs-del"${nSel ? "" : " disabled"}>SUPPRIMER LES COCHÉS <span class="svi-cnt">${nSel}</span></button>
             <button type="button" class="ach-b" data-a="frs-trash"${nDel ? "" : " disabled"}>CORBEILLE <span class="svi-cnt">${nDel}</span></button>`}
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
      if (!A.length || !(await svConfirm({ title: "METTRE À LA CORBEILLE", html: `<ul class="svc-list">${A.map(f => `<li>${esc(f.code + " — " + f.nom)}</li>`).join("")}</ul><div class="svc-sub">RESTAURABLES DEPUIS LA CORBEILLE ; LEURS NUMÉROS NE SERONT PAS RÉUTILISÉS.</div>`, ok: "METTRE À LA CORBEILLE" }))) return true;
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
    let v = k === "ice" ? achDig(t.value) : achU(t.value);
    if (k === "nom" && !v) { svToast("NOM OBLIGATOIRE (POUR RETIRER LE FOURNISSEUR : LE COCHER PUIS SUPPRIMER).", 3500, t); draw(); return true; }
    if (k === "ice" && v && !achIceOk(v)) { svToast("ICE NON VALIDE : 15 CHIFFRES.", 3500, t); draw(); return true; }
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
function achFrsFiche(id, sec, done) {
  const L0 = achFrs(), f0 = L0.find(x => x.id === id); if (!f0) return;
  const F = JSON.parse(JSON.stringify(f0)), ro = !!f0.del, P = achPrm();
  ["ribs", "docf", "cte", "evl", "cgf", "fam"].forEach(k => { if (!Array.isArray(F[k])) F[k] = []; });
  const d = sviWinNew();
  const inp = (k, lab, o = {}) => `<label class="frs-f${o.w ? " frs-w" : ""}"><span>${lab}${o.req ? " <b>*</b>" : ""}</span><input class="ins-in frs-x" data-k="${k}" value="${esc(F[k] ?? "")}"${o.num ? ' inputmode="numeric"' : ""}${o.keep ? " data-keepcase" : ""}${o.list ? ` list="frsL-${k}"` : ""}${ro ? " readonly" : ""} autocomplete="off">${o.list ? `<datalist id="frsL-${k}">${o.list.map(x => `<option value="${esc(x)}">`).join("")}</datalist>` : ""}</label>`;
  const chk = (k, lab) => `<label class="frs-c"><input type="checkbox" class="frs-xc" data-k="${k}"${F[k] ? " checked" : ""}${ro ? " disabled" : ""}> ${lab}</label>`;
  const sub = (k, cols, add) => `<table class="prm-table frs-sub" data-sub="${k}"><thead><tr>${cols.map(c => `<th>${c[1]}</th>`).join("")}<th></th></tr></thead><tbody>
      ${F[k].map((r, i) => `<tr data-i="${i}">${cols.map(c => `<td>${c[2] ? c[2](r, i) : `<input class="ins-in frs-s" data-c="${c[0]}" value="${esc(r[c[0]] ?? "")}"${c[3] || ""}${ro ? " readonly" : ""} autocomplete="off">`}</td>`).join("")}<td class="center">${ro ? "" : `<button type="button" class="ach-x" data-rm="${k}|${i}" title="Retirer">✕</button>`}</td></tr>`).join("") || `<tr><td colspan="${cols.length + 1}" class="empty">AUCUNE LIGNE</td></tr>`}
    </tbody></table>${ro ? "" : `<button type="button" class="ach-b frs-add" data-add="${k}">+ ${add}</button>`}`;
  const draw = () => {
    const why = achFrsWhy(F, achFrs()), note = achFrsNote(F);
    d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: "FICHE FOURNISSEUR — " + esc(F.code) + " · " + esc(F.nom || ""),
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}${F.ribChg && !ro ? ` <button type="button" class="ach-b" data-ribok>RIB VÉRIFIÉ</button>` : ""}</div>` : ""}
        <div class="frs-scroll">
        <div class="frs-sec" data-s="id"><div class="frs-st">IDENTITÉ</div><div class="frs-g">
          ${inp("nom", "NOM", { req: 1, w: 1 })}${inp("denom", "DÉNOMINATION SOCIALE", { w: 1 })}${inp("forme", "FORME JURIDIQUE", { list: ACH_FORMES })}${inp("ville", "VILLE")}
          ${inp("adresse", "ADRESSE", { w: 1 })}${inp("site", "SITE WEB", { keep: 1 })}${inp("resp", "RESPONSABLE INTERNE")}
          <div class="frs-cs">${chk("occ", "FOURNISSEUR OCCASIONNEL (FICHE SIMPLIFIÉE : ICE ET RIB FACULTATIFS)")}${chk("orgFin", "ORGANISME FINANCIER")}${chk("actif", "ACTIF")}</div></div></div>
        <div class="frs-sec" data-s="fisc"><div class="frs-st">FISCAL ET COMPTABLE</div><div class="frs-g">
          ${inp("ice", "ICE (15 CHIFFRES)", { req: !F.occ, num: 1 })}${inp("ifisc", "IDENTIFIANT FISCAL", { num: 1 })}${inp("rc", "REGISTRE DE COMMERCE", { num: 1 })}${inp("villeRc", "VILLE DU RC")}
          ${inp("patente", "PATENTE", { num: 1 })}${inp("capital", "CAPITAL (MAD)", { num: 1 })}${inp("codeCpt", "CODE COMPTABLE", { num: 1 })}${inp("intCpt", "INTITULÉ COMPTABLE")}</div></div>
        <div class="frs-sec" data-s="rib"><div class="frs-st">RIB ${svCnt(F.ribs.length)}</div>
          ${sub("ribs", [["rib", "RIB (24 CHIFFRES)", null, ' inputmode="numeric"'], ["bq", "BANQUE", r => esc((achBankOfRib(r.rib) || {}).n || (achDig(r.rib).length >= 3 ? "CODE " + achDig(r.rib).slice(0, 3) + " INCONNU" : "—"))],
            ["p", "PRINCIPAL", (r, i) => `<input type="radio" name="frsRibP" class="frs-rp" data-i="${i}"${r.p ? " checked" : ""}${ro ? " disabled" : ""}>`]], "AJOUTER UN RIB")}</div>
        <div class="frs-sec" data-s="cond"><div class="frs-st">CONDITIONS DE PAIEMENT</div><div class="frs-g">${inp("cond", "CONDITIONS", { list: ACH_CONDS })}</div></div>
        <div class="frs-sec" data-s="fam"><div class="frs-st">FAMILLES D'ARTICLES FOURNIES ${svCnt(F.fam.length)}</div><div class="frs-fam">${P.cat.map(c => `<label class="frs-c"><input type="checkbox" class="frs-fc" value="${esc(c)}"${F.fam.includes(c) ? " checked" : ""}${ro ? " disabled" : ""}> ${esc(c)}</label>`).join("") || `<span class="ach-0">AUCUNE CATÉGORIE (ACHATS › PARAMÈTRES)</span>`}</div></div>
        <div class="frs-sec" data-s="docf"><div class="frs-st">DOCUMENTS FISCAUX ${svCnt(F.docf.length)}</div>
          ${sub("docf", [["type", "DOCUMENT", (r, i) => `<select class="ins-in frs-s" data-c="type"${ro ? " disabled" : ""}>${ACH_DOCF.map(x => `<option${x === r.type ? " selected" : ""}>${esc(x)}</option>`).join("")}</select>`], ["no", "N°"], ["exp", "EXPIRE LE", (r) => `<input type="date" class="ins-in frs-s" data-c="exp" value="${esc(r.exp || "")}"${ro ? " readonly" : ""}>`]], "AJOUTER UN DOCUMENT")}</div>
        <div class="frs-sec" data-s="cte"><div class="frs-st">CONTACTS ${svCnt(F.cte.length)}</div>
          ${sub("cte", [["nom", "NOM"], ["fonction", "FONCTION"], ["tel", "TÉLÉPHONE", null, ' inputmode="tel"'], ["email", "E-MAIL", (r) => `<input class="ins-in frs-s" data-c="email" data-keepcase value="${esc(r.email || "")}" inputmode="email"${ro ? " readonly" : ""} autocomplete="off">`]], "AJOUTER UN CONTACT")}</div>
        <div class="frs-sec" data-s="evl"><div class="frs-st">ÉVALUATIONS ${svCnt(F.evl.length)}${note === null ? "" : " — MOYENNE " + esc(String(Math.round(note * 10) / 10).replace(".", ",")) + " / 10"}</div>
          ${F.evl.map((x, i) => `<div class="frs-evl">☆ ${esc(String(x.date || "").slice(0, 10).split("-").reverse().join("/"))} — <b>${esc(String(Math.round(achN(x.moy) * 10) / 10).replace(".", ","))} / 10</b> (${esc((x.crit || []).map(c => c.d + " " + c.n).join(", "))})${ro ? "" : ` <button type="button" class="ach-x" data-rm="evl|${i}">✕</button>`}</div>`).join("") || `<div class="ach-0">AUCUNE ÉVALUATION</div>`}
          ${ro ? "" : `<table class="prm-table frs-sub frs-ecrit"><thead><tr><th>CRITÈRE</th><th>NOTE (0 À 10)</th></tr></thead><tbody>${[0, 1, 2, 3, 4].map(i => `<tr><td><input class="ins-in frs-ed" data-i="${i}" placeholder="${["QUALITÉ", "DÉLAIS", "PRIX", "SERVICE", ""][i]}" autocomplete="off"></td><td><input class="ins-in frs-en" data-i="${i}" inputmode="decimal" autocomplete="off"></td></tr>`).join("")}</tbody></table><button type="button" class="ach-b frs-add" data-evladd>+ AJOUTER L'ÉVALUATION</button>`}</div>
        <div class="frs-sec" data-s="cgf"><div class="frs-st">CONTRATS ${svCnt(F.cgf.length)}</div>
          ${sub("cgf", [["intitule", "INTITULÉ"], ["debut", "DÉBUT", (r) => `<input type="date" class="ins-in frs-s" data-c="debut" value="${esc(r.debut || "")}"${ro ? " readonly" : ""}>`], ["fin", "FIN", (r) => `<input type="date" class="ins-in frs-s" data-c="fin" value="${esc(r.fin || "")}"${ro ? " readonly" : ""}>`]], "AJOUTER UN CONTRAT")}</div>
        </div>`,
      foot: `<button type="button" class="svc-b" data-x>${ro ? "FERMER" : "ANNULER"}</button>${ro ? "" : `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button>`}` });
    if (!d.isConnected) sviWinShow(d);
  };
  draw();
  if (sec) setTimeout(() => d.querySelector(`.frs-sec[data-s="${sec === "fam" ? "fam" : sec === "cte" ? "cte" : sec}"]`)?.scrollIntoView({ block: "start" }), 50);
  /* lecture des cases dans le brouillon (avant chaque redessin) */
  const pull = () => {
    d.querySelectorAll(".frs-x").forEach(i => { const k = i.dataset.k; F[k] = ["ice", "ifisc", "rc", "patente", "codeCpt"].includes(k) ? achDig(i.value) : k === "capital" ? achN(i.value) : k === "site" ? String(i.value || "").trim().toLowerCase() : achU(i.value); });
    d.querySelectorAll(".frs-xc").forEach(i => { F[i.dataset.k] = i.checked; });
    F.fam = [...d.querySelectorAll(".frs-fc:checked")].map(i => i.value);
    d.querySelectorAll(".frs-sub[data-sub]").forEach(t => { const k = t.dataset.sub; t.querySelectorAll("tr[data-i]").forEach(tr => { const r = F[k][+tr.dataset.i]; if (!r) return;
      tr.querySelectorAll(".frs-s").forEach(i => { const c = i.dataset.c; r[c] = c === "rib" ? achDig(i.value) : c === "email" ? String(i.value || "").trim().toLowerCase() : c === "exp" || c === "debut" || c === "fin" || c === "type" ? i.value : achU(i.value); }); }); });
    const rp = d.querySelector(".frs-rp:checked"); F.ribs.forEach((r, i) => { r.p = !!rp && +rp.dataset.i === i; });
  };
  d.addEventListener("click", async e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
    if (ro) return;
    const ad = e.target.closest("[data-add]");
    if (ad) { pull(); const k = ad.dataset.add; F[k].push(k === "ribs" ? { rib: "", p: !F.ribs.length } : k === "docf" ? { type: ACH_DOCF[0], no: "", exp: "" } : k === "cte" ? { nom: "", fonction: "", tel: "", email: "" } : { intitule: "", debut: "", fin: "" }); draw(); return; }
    const rm = e.target.closest("[data-rm]");
    if (rm) { pull(); const [k, i] = rm.dataset.rm.split("|"); F[k].splice(+i, 1); if (k === "ribs" && F.ribs.length && !F.ribs.some(r => r.p)) F.ribs[0].p = true; draw(); return; }
    if (e.target.closest("[data-evladd]")) {
      pull();
      const crit = [...d.querySelectorAll(".frs-ed")].map(i => ({ d: achU(i.value), n: Math.max(0, Math.min(10, achN((d.querySelector(`.frs-en[data-i="${i.dataset.i}"]`) || {}).value))) })).filter(c => c.d);
      if (!crit.length) { svToast("ÉVALUATION : AU MOINS UN CRITÈRE (NOM ET NOTE).", 3000); return; }
      F.evl.push({ date: new Date().toISOString(), crit, moy: crit.reduce((t, c) => t + c.n, 0) / crit.length }); draw(); return;
    }
    if (e.target.closest("[data-ribok]")) { pull(); F.ribChg = ""; F.__ribOk = true; draw(); return; }
    if (!e.target.closest("[data-save]")) return;
    pull();
    const L = achFrs(), f = L.find(x => x.id === id); if (!f) { d.remove(); return; }
    /* contrôles bloquants */
    if (!F.nom) { svToast("NOM OBLIGATOIRE.", 3000); return; }
    if (F.ice && !achIceOk(F.ice)) { svToast("ICE NON VALIDE : 15 CHIFFRES.", 3500); return; }
    { const x = achFrsDupIce(L, F.ice, id); if (x) { svToast("ICE DÉJÀ UTILISÉ PAR " + x.code + " — " + x.nom + ".", 4000); return; } }
    if (F.forme && !ACH_FORMES.includes(F.forme)) { svToast("FORME JURIDIQUE : CHOISIR DANS LA LISTE.", 3500); return; }
    if (F.cond && !ACH_CONDS.includes(F.cond)) { svToast("CONDITIONS DE PAIEMENT : CHOISIR DANS LA LISTE.", 3500); return; }
    F.ribs = F.ribs.filter(r => achDig(r.rib));
    if (F.ribs.some(r => !achRibOk(r.rib))) { svToast("RIB NON VALIDE : 24 CHIFFRES.", 3500); draw(); return; }
    if (new Set(F.ribs.map(r => achDig(r.rib))).size < F.ribs.length) { svToast("LE MÊME RIB EST SAISI DEUX FOIS.", 3500); draw(); return; }
    if (F.ribs.length && !F.ribs.some(r => r.p)) F.ribs[0].p = true;
    F.cte = F.cte.filter(c => c.nom || c.tel || c.email); F.cgf = F.cgf.filter(c => c.intitule); F.docf = F.docf.filter(x => x.type && (x.no || x.exp));
    /* changement de RIB : confirmé, noté, signalé jusqu'à vérification */
    const oldR = (f.ribs || []).map(r => achDig(r.rib)), newR = F.ribs.map(r => achDig(r.rib)), oldP = (achFrsRibP(f) || {}).rib || "", newP = (achFrsRibP(F) || {}).rib || "";
    const chg = oldR.length && (oldR.some(r => !newR.includes(r)) || newR.some(r => !oldR.includes(r)) || achDig(oldP) !== achDig(newP));
    if (chg) {
      if (!(await svConfirm({ title: "CHANGEMENT DE RIB", html: `<div class="svc-sub">${esc(F.code + " — " + F.nom)}</div><div class="svc-sub">AVANT : ${esc(oldR.join(" · ") || "—")}</div><div class="svc-sub">APRÈS : ${esc(newR.join(" · ") || "—")}</div><div class="svc-sub">UN CHANGEMENT DE RIB EST UNE FRAUDE COURANTE : LE CONFIRMER AUPRÈS DU FOURNISSEUR PAR UN AUTRE MOYEN (TÉLÉPHONE CONNU). LE FOURNISSEUR RESTE SIGNALÉ JUSQU'À « RIB VÉRIFIÉ ».</div>`, ok: "ENREGISTRER LE NOUVEAU RIB" }))) return;
      F.ribChg = new Date().toISOString();
      achHist(F.code, "RIB MODIFIÉ", (oldR.join(" · ") || "—") + " → " + (newR.join(" · ") || "—"));
    }
    if (F.__ribOk) { achHist(F.code, "RIB VÉRIFIÉ", newR.join(" · ")); delete F.__ribOk; }
    const LAB = { nom: "NOM", denom: "DÉNOMINATION", forme: "FORME", ville: "VILLE", adresse: "ADRESSE", site: "SITE WEB", resp: "RESPONSABLE", occ: "OCCASIONNEL", orgFin: "ORGANISME FINANCIER", actif: "ACTIF",
      ice: "ICE", ifisc: "IF", rc: "RC", villeRc: "VILLE RC", patente: "PATENTE", capital: "CAPITAL", codeCpt: "CODE COMPTABLE", intCpt: "INTITULÉ COMPTABLE", cond: "PAIEMENT", fam: "FAMILLES", docf: "DOCUMENTS FISCAUX", cte: "CONTACTS", evl: "ÉVALUATIONS", cgf: "CONTRATS" };
    const ch = Object.keys(LAB).filter(k => JSON.stringify(f[k] ?? "") !== JSON.stringify(F[k] ?? ""));
    Object.assign(f, F, { mod: new Date().toISOString() });
    if (ch.length) achHist(f.code, "MODIFICATION", ch.map(k => LAB[k]).join(", "));
    achFrsSave(L); d.remove(); if (done) done();
  });
}
