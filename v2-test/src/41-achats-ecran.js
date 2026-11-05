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
  /* 05/11 : plus d'onglets ici — chaque partie est un onglet de PARAMÉTRAGE (ACHATS : RÈGLES INTERNES, ALERTES DE RETARD, MENTIONS IMPRIMÉES, CLAUSES ;
     GÉNÉRAL : RÉFÉRENCES ; ARTICLES : CATÉGORIES) ; le corps de l'écran des achats y est posé le temps de l'onglet (view.__prmMount) */
  const PTABS = [];
  let prmSub = "regl"; const prmTab = () => prmSub;
  const bodyHome = document.createComment("ach-body"); body.before(bodyHome);
  view.__prmMount = (host, s) => { prmSub = s; if (body.parentNode !== host) { host.innerHTML = ""; host.appendChild(body); } tab = "prm"; draw(); };
  const prmHTML = () => {
    const P = achPrm(), T = prmTab();
    const catRows = cfApply("ach_cat", [["cat1", "CATÉGORIE (FAMILLE D'ARTICLES)", x => x, ""]], P.cat);
    const tabs = "";
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
    const keep = { regl: ["ach-pgen", "ach-pesp", "ach-pseu"], alr: ["ach-palr"], ment: ["ach-pment"] }[T] || ["ach-pgen", "ach-pesp", "ach-pseu"];
    const tpl = document.createElement("template"); tpl.innerHTML = `<div class="ach-prm">
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
