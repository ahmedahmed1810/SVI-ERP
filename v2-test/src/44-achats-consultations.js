/* =========================================================
   v761 : CONSULTATIONS et DEVIS (étape 3) — onglets CONSULTATIONS et DEVIS de l'écran des achats (menu ☰ › ACHAT)
   Tableaux au format des articles ; la RÉFÉRENCE soulignée ouvre la fiche ; règles : 40-achats-donnees.js (achCafWhy, achDvfWhy…).
   ========================================================= */
const achDFr = v => /^\d{4}-\d{2}-\d{2}/.test(String(v || "")) ? String(v).slice(8, 10) + "/" + String(v).slice(5, 7) + "/" + String(v).slice(0, 4) : "";
const achF2 = v => (Number(v) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ | /g, " ");
const achFrsNom = id => { const L = achFrs(), f = L.find(x => x.id === id); return f ? f.nom : "?"; };   /* v779 : le nom seul (la référence FRS-000n ne parle pas) */
/* tableau générique d'une liste d'achats (consultations, devis) : même format que les articles */
/* v765 : toutes les listes des achats au format du budget (47 : achNvList) — EN INSTANCE / VALIDÉS, dates, CRÉER… en bas,
   corbeille des lignes en instance (= ANNULER, la pièce est gardée) ; toucher une ligne ouvre sa fiche */
function achListMod(ctx, o) {
  const dead = x => x.state === "annule";
  const kill = o.save ? async x => { if (!(await svConfirm({ title: "ANNULER", text: x.ref + " PASSE EN ANNULÉ (GARDÉ, VISIBLE DANS ANNULÉS).", ok: "ANNULER" }))) return false;
      const L = o.list(), y = L.find(z => z.id === x.id); if (!y) return false; y.state = "annule"; y.mod = achNow(); o.save(L); achHist(y.ref, "ANNULÉ", ""); return true; } : null;
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
        info: done => o.open(id, () => done()),
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
  const tv = l => l.tva === "" || l.tva === undefined ? achPrm().tva : achN(l.tva);
  const lig = (t, withPu, withSt) => ({ t, add: "CRÉER UNE LIGNE ICI…", cols: [["DÉSIGNATION"], ["U", "center"], ["QUANTITÉ", "number"]].concat(withPu ? [["PU HT", "number"], ["TVA %", "number"], ["MONTANT HT", "number"]] : []).concat(withSt ? [["RÉSULTAT", "center"]] : []),
    rows: (x.lignes || []).map(l => ({ go: AK.get(achKey(l.des, l.u)) ? [[0, "art", AK.get(achKey(l.des, l.u))]] : [], cells: [l.des || "", l.u || "", achN(l.q)].concat(withPu ? [achN(l.pu), tv(l), achN(l.q) * achN(l.pu)] : []).concat(withSt ? [{ ok: "ACCEPTÉE", res: "RÉSERVES", ref: "REFUSÉE" }[l.st] || ""] : []) })) });
  const docs = (t, L, cols, cells, kk) => ({ t, cols, rows: L.map(y => ({ cells: cells(y), open: () => achGo(kk, y.id), go: y.frs && cols[1] && cols[1][0] === "FOURNISSEUR" ? [[1, "frs", y.frs]] : [], cls: ["annule", "rejete"].includes(y.state) ? "nv-strike" : "" })) });
  const DV = (t, L) => docs(t, L, [["RÉFÉRENCE"], ["FOURNISSEUR"], ["MONTANT TTC", "number"], ["ÉTAT", "center"]], v => [v.ref, fr(v.frs), achDvfTot(v).ttc, { recu: "REÇU", retenu: "RETENU", rejete: "REJETÉ", annule: "ANNULÉ" }[v.state] || ""], "dvf");
  const CM = (t, L) => docs(t, L, [["RÉFÉRENCE"], ["FOURNISSEUR"], ["MONTANT TTC", "number"], ["ÉTAT", "center"]], c => [c.ref, fr(c.frs), achCmfTot(c).ttc, ACH_CMF_ST[c.state] || ""], "cmf");
  const RC = (t, L) => docs(t, L, [["RÉFÉRENCE"], ["N° BL"], ["REÇU LE"], ["LIGNES", "center"]], r => [r.ref, r.pv ? "PV DE SERVICE FAIT" : r.nbl || "", svDT(r.date || ""), String((r.lignes || []).length)], "rcp");
  const FA = (t, L) => docs(t, L, [["RÉFÉRENCE"], ["N° FACTURE"], ["MONTANT TTC", "number"], ["RESTE À PAYER", "number"], ["ÉTAT", "center"]], f => [f.ref, f.num || "", achFafTot(f).ttc, f.state === "annule" ? "" : achFafReste(f), achFafEtat(f)], "faf");
  const PA = (t, L) => docs(t, L, [["RÉFÉRENCE"], ["MODE"], ["DATE"], ["MONTANT", "number"], ["ÉTAT", "center"]], p => [p.ref, p.mode || "", achDFr(p.date), achN(p.mt), ACH_PAF_ST[p.state] || ""], "paf");
  const AV = (t, L) => docs(t, L, [["RÉFÉRENCE"], ["N° AVOIR"], ["MONTANT TTC", "number"], ["RESTE À DÉDUIRE", "number"]], a => [a.ref, a.num || "", achN(a.ttc), a.state === "annule" ? "" : achAvfReste(a)], "avf");
  const CA = (t, L) => docs(t, L, [["RÉFÉRENCE"], ["OBJET"], ["ÉTAT", "center"]], c => [c.ref, c.objet || "", { ouverte: "OUVERTE", close: "CLOSE", annule: "ANNULÉE" }[c.state] || ""], "caf");
  const has = (L, id) => (L || []).includes(id);
  if (k === "caf") { const R = x.rep || {};
    /* v780 (remarque 9) : TABLEAU COMPARATIF (une ligne par fournisseur ayant répondu, ★ = le moins cher), RETENU et MOTIF DU CHOIX ; CRÉER LA COMMANDE dans le ⋯ principal */
    const DD = achDvf().filter(v => v.caf === x.id && v.state !== "annule"), dvOf = f => DD.find(v => v.frs === f), HT = (x.frs || []).map(f => dvOf(f) ? achDvfTot(dvOf(f)).ht : null).filter(v => v !== null && v > 0), MIN = HT.length ? Math.min(...HT) : null;
    const CMP = { t: "TABLEAU COMPARATIF", cols: [["FOURNISSEUR"], ["DEVIS"], ["MONTANT HT", "number"], ["MONTANT TTC", "number"], ["RETENU", "center"], ["MOTIF DU CHOIX"]],
      rows: (x.frs || []).filter(dvOf).map(f => { const v = dvOf(f), t = achDvfTot(v); return { cells: [fr(f) + (MIN !== null && Math.abs(t.ht - MIN) < 0.005 ? " ★" : ""), v.ref, t.ht, t.ttc, x.retenu === f ? "RETENU" : "", x.retenu === f ? x.motif || "" : ""], cls: x.retenu === f ? "nvp-ret" : "" }; }) };
    const canCmd = x.state === "close" && !achCmf().some(c => c.caf === x.id && c.state !== "annule");
    return { title: x.objet || "", menu: canCmd ? [{ k: "mkcmf", lab: "CRÉER LA COMMANDE" }] : [],
      act: async k => { if (k !== "mkcmf") return false; const v = achDvf().find(y => y.caf === x.id && y.state === "retenu"); if (!v) { svToast("AUCUN DEVIS RETENU.", 3000); return true; }
        const m = achCmfFrom({ frs: v.frs, caf: x.id, dvf: v.id, lignes: v.lignes, why: "DEPUIS " + x.ref + " — " + v.ref }); achGo("cmf", m.id); return true; },
      links: [lig("LIGNES"), { t: "FOURNISSEURS CONSULTÉS", add: "AJOUTER UN FOURNISSEUR ICI…", cols: [["FOURNISSEUR"], ["RÉPONSE", "center"], ["DEVIS"]], rows: (x.frs || []).map(f => ({ go: [[0, "frs", f]], cells: [fr(f), (R[f] || {}).st === "repondu" ? "RÉPONDU" : (R[f] || {}).st === "decline" ? "DÉCLINÉ" : "EN ATTENTE", ref(achDvf(), (R[f] || {}).dvf)] })) },
      CMP, DV("DEVIS", achDvf().filter(v => v.caf === x.id)), CM("COMMANDES", achCmf().filter(c => c.caf === x.id))] }; }
  const TOT = t => [["MONTANT HT", t.ht], ["MONTANT TVA", t.ttc - t.ht], ["MONTANT TTC", t.ttc]];
  if (k === "dvf") return { title: fr(x.frs), tot: TOT(achDvfTot(x)), ttc: achDvfTot(x).ttc, links: [lig("LIGNES", true), CA("CONSULTATION", achCaf().filter(c => c.id === x.caf)), CM("COMMANDES", achCmf().filter(c => c.dvf === x.id || (c.lignes || []).some(l => l.dvf === x.id)))] };
  if (k === "cmf") return { title: fr(x.frs), tot: TOT(achCmfTot(x)), ttc: achCmfTot(x).ttc, links: [lig("LIGNES", true), DV("DEVIS", achDvf().filter(v => v.id === x.dvf || (x.lignes || []).some(l => l.dvf === v.id))), { ...RC("RÉCEPTIONS", achRcp().filter(r => r.cmf === x.id)), add: "CRÉER UNE RÉCEPTION ICI…", addAny: x.state === "valide" },
    { ...FA("FACTURES", achFaf().filter(f => f.cmf === x.id || has(f.cmfs, x.id))), add: "CRÉER UNE FACTURE ICI…", addAny: x.state === "valide" }, { ...PA("PAIEMENTS", achPaf().filter(p => p.cmf === x.id)), add: "CRÉER UN PAIEMENT (AVANCE) ICI…", addAny: x.state === "valide" }] };
  if (k === "rcp") return { title: fr(x.frs), links: [lig("LIGNES", false, true), CM("COMMANDE", achCmf().filter(c => c.id === x.cmf)), FA("FACTURES", achFaf().filter(f => has(f.rcps, x.id)))] };
  if (k === "rtrcmd" || k === "rtrrcp") return { title: fr(x.frs), links: [lig("LIGNES"), CM("COMMANDE", achCmf().filter(c => c.id === x.cmf)), RC("RÉCEPTION", achRcp().filter(r => r.id === x.rcp))] };
  if (k === "faf") return { title: fr(x.frs), tot: TOT(achFafTot(x)), ttc: achFafTot(x).ttc, links: [lig("LIGNES", true), CM("COMMANDES", achCmf().filter(c => c.id === x.cmf || has(x.cmfs, c.id))), RC("RÉCEPTIONS", achRcp().filter(r => has(x.rcps, r.id))),
    PA("PAIEMENTS", achPaf().filter(p => (p.aff || []).some(a => a.fa === x.id))), AV("AVOIRS", achAvf().filter(a => a.fa === x.id))] };
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
        <div class="frs-sec"><div class="frs-st">LIGNES ${svCnt(C.lignes.length)}</div>
          <table class="prm-table frs-sub"><thead><tr><th>BESOIN</th><th>DÉSIGNATION</th><th>U</th><th>QUANTITÉ</th><th></th></tr></thead><tbody>
          ${C.lignes.map((l, i) => `<tr data-i="${i}"><td>${esc(((achBsn().find(b => b.id === l.bsn) || {}).ref) || "—")}</td><td><input class="ins-in caf-l" data-c="des" value="${esc(l.des)}"${dis || (l.bsn ? " readonly" : "")}></td><td><input class="ins-in caf-l" data-c="u" value="${esc(l.u)}"${dis || (l.bsn ? " readonly" : "")}></td><td><input class="ins-in caf-l" data-c="q" inputmode="decimal" value="${esc(String(l.q ?? "").replace(".", ","))}"${dis}></td><td class="center">${ro ? "" : `<button type="button" class="ach-x" data-rml="${i}">✕</button>`}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">AUCUNE LIGNE</td></tr>`}
          </tbody></table>${ro ? "" : `<button type="button" class="ach-b" data-addbsn>+ BESOINS VALIDÉS NON COUVERTS ${svCnt(achBsnOpen().length)}</button> <button type="button" class="ach-b" data-addl>+ LIGNE LIBRE</button>`}</div>
        <div class="frs-sec"><div class="frs-st">FOURNISSEURS CONSULTÉS ${svCnt(C.frs.length)}</div>
          <table class="prm-table frs-sub"><thead><tr><th>FOURNISSEUR</th><th>E-MAIL</th><th>RÉPONSE</th><th>DEVIS</th><th></th></tr></thead><tbody>
          ${C.frs.map(f => { const r = C.rep[f] || {}, v = dv(f), F = achFrs().find(x => x.id === f) || {}; return `<tr data-f="${esc(f)}"><td>${esc(achFrsNom(f))}</td><td>${esc(((F.cte || []).find(x => x.email) || {}).email || "—")}</td>
            <td><select class="ins-in caf-rep" data-f="${esc(f)}"${dis || (v ? " disabled" : "")}>${[["attente", "EN ATTENTE"], ["repondu", "RÉPONDU"], ["decline", "DÉCLINÉ"]].map(([k, l]) => `<option value="${k}"${(r.st || "attente") === k ? " selected" : ""}>${l}</option>`).join("")}</select></td>
            <td>${v ? `<button type="button" class="ach-link" data-opendvf="${esc(v.id)}">${esc(v.ref)}</button> ${esc(achF2(achDvfTot(v).ht))} HT` : ro || r.st === "decline" ? "—" : `<button type="button" class="ach-b" data-mkdvf="${esc(f)}">SAISIR LE DEVIS</button>`}</td>
            <td class="center">${ro || v ? "" : `<button type="button" class="ach-x" data-rmf="${esc(f)}">✕</button>`}</td></tr>`; }).join("") || `<tr><td colspan="5" class="empty">AUCUN FOURNISSEUR</td></tr>`}
          </tbody></table>${ro ? "" : `<button type="button" class="ach-b" data-addfrs>+ FOURNISSEURS</button> <button type="button" class="ach-b" data-mail>ENVOYER (E-MAIL GROUPÉ)</button>`}</div>
        ${D.length ? `<div class="frs-sec"><div class="frs-st">TABLEAU COMPARATIF</div>
          <table class="prm-table frs-sub caf-cmp"><thead><tr><th>LIGNE</th>${C.frs.filter(dv).map(f => `<th class="number">${esc(achFrsNom(f))}</th>`).join("")}</tr></thead><tbody>
          ${C.lignes.map(l => `<tr><td>${esc(l.des)} (${esc(achF2(l.q))} ${esc(l.u)})</td>${C.frs.filter(dv).map(f => { const x = (dv(f).lignes || []).find(y => achU(y.des) === achU(l.des) && achU(y.u) === achU(l.u)); return `<td class="number">${x && achN(x.pu) ? esc(achF2(x.pu)) : "—"}</td>`; }).join("")}</tr>`).join("")}
          <tr class="caf-tot"><td><b>TOTAL HT</b></td>${C.frs.filter(dv).map(f => { const t = achDvfTot(dv(f)).ht; return `<td class="number"><b>${esc(achF2(t))}</b>${t === min ? " ★" : ""}</td>`; }).join("")}</tr>
          <tr><td><b>RETENU</b></td>${C.frs.filter(dv).map(f => `<td class="center"><input type="radio" name="cafRet" class="caf-ret" value="${esc(f)}"${C.retenu === f ? " checked" : ""}${dis}></td>`).join("")}</tr></tbody></table>
          <label class="frs-f frs-w"><span>MOTIF DU CHOIX (OBLIGATOIRE SI LE RETENU N'EST PAS LE MOINS CHER ★)</span><input class="ins-in caf-x" data-k="motif" value="${esc(C.motif || "")}"${dis} autocomplete="off"></label></div>` : ""}
        ${C.state === "close" ? `<div class="bsn-note">CLOSE LE ${esc(achDFr(C.close))} : RETENU ${esc(achFrsNom(C.retenu))}.${(() => { const m = achCmf().find(x => x.caf === C.id && x.state !== "annule"); return m ? " COMMANDE : " + esc(m.ref) + "." : ""; })()}</div>` : ""}
      </div>`,
      foot: `<button type="button" class="svc-b" data-x>${ro || C.id ? "FERMER" : "ANNULER"}</button>${C.id && C.state === "ouverte" ? `<button type="button" class="svc-b" data-cancel>ANNULER LA CONSULTATION</button>` : ""}
        ${C.state === "close" && !achCmf().some(x => x.caf === C.id && x.state !== "annule") ? `<button type="button" class="svc-b svc-ok svc-neutral" data-mkcmf>CRÉER LA COMMANDE</button>` : ""}
        ${!ro ? `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button>` : ""}${C.id && C.state === "ouverte" && D.length ? `<button type="button" class="svc-b svc-ok" data-close>CLÔTURER AVEC LE RETENU</button>` : ""}` });
    if (!d.isConnected) sviWinShow(d);
  };
  const pull = () => { d.querySelectorAll(".caf-x").forEach(i => { C[i.dataset.k] = i.dataset.k === "dlim" ? i.value : achU(i.value); });
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
  d.addEventListener("click", async e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (done) done(); return; }
    const od = e.target.closest("[data-opendvf]"); if (od) { achDvfFiche(od.dataset.opendvf, () => draw()); return; }
    /* v762 : lancement de la commande depuis la consultation close (devis retenu : lignes et prix repris) */
    if (e.target.closest("[data-mkcmf]")) { const v = achDvf().find(x => x.caf === C.id && x.state === "retenu"); if (!v) { svToast("AUCUN DEVIS RETENU.", 3000); return; }
      const m = achCmfFrom({ frs: v.frs, caf: C.id, dvf: v.id, lignes: v.lignes, why: "DEPUIS " + C.ref + " — " + v.ref }); d.remove(); achCmfFiche(m.id, done); return; }
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
      const F = achLive(achFrs()).filter(f => f.actif !== false && !C.frs.includes(f.id)).map(f => ({ f, s: (f.fam || []).some(x => cats.has(x)) })).sort((a, b) => b.s - a.s || a.f.nom.localeCompare(b.f.nom, "fr"));
      if (!F.length) { svToast("AUCUN AUTRE FOURNISSEUR ACTIF (ACHAT › FOURNISSEURS).", 3000); return; }
      const pick = await achPickWin("FOURNISSEURS À CONSULTER", F.map(x => ({ v: x.f.id, lab: x.f.code + " — " + x.f.nom + (x.s ? "  ★ FOURNIT CES FAMILLES" : "") })));
      pick.forEach(f => { C.frs.push(f); C.rep[f] = { st: "attente" }; }); draw(); return;
    }
    if (e.target.closest("[data-mail]")) {
      pull(); const F = achFrs().filter(f => C.frs.includes(f.id)), to = F.map(f => ((f.cte || []).find(x => x.email) || {}).email).filter(Boolean);
      if (!to.length) { svToast("AUCUNE ADRESSE E-MAIL DANS LES CONTACTS DES FOURNISSEURS CONSULTÉS.", 3500); return; }
      const txt = "MADAME, MONSIEUR,\n\nMERCI DE NOUS TRANSMETTRE VOTRE MEILLEURE OFFRE POUR :\n" + C.lignes.map(l => "- " + l.des + " : " + achF2(l.q) + " " + l.u).join("\n") + (C.dlim ? "\n\nDATE LIMITE DE RÉPONSE : " + achDFr(C.dlim) : "") + "\n\nCORDIALEMENT.";
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
    if (e.target.closest("[data-cancel]")) { if (!(await svConfirm({ title: "ANNULER LA CONSULTATION", text: C.ref + " EST ANNULÉE (GARDÉE) ; SES BESOINS REDEVIENNENT À CONSULTER.", ok: "ANNULER LA CONSULTATION" }))) return;
      C.state = "annule"; store("ANNULÉE"); d.remove(); if (done) done(); return; }
    const sv = e.target.closest("[data-save]"), cl = e.target.closest("[data-close]");
    if (!sv && !cl) return;
    pull();
    if (C.lignes.some(l => !achU(l.des) || !(achN(l.q) > 0))) { svToast("CHAQUE LIGNE : DÉSIGNATION ET QUANTITÉ.", 3000); return; }
    if (cl) {
      const D = achDvf().filter(v => v.caf === C.id && v.state !== "annule"), v = D.find(x => x.frs === C.retenu);
      if (!v) { svToast("CHOISIR LE FOURNISSEUR RETENU (TABLEAU COMPARATIF).", 3500); return; }
      if (achDvfWhy(v).some(m => /PRIX MANQUANTS|EXPIRÉ/.test(m))) { svToast("DEVIS RETENU INCOMPLET OU EXPIRÉ : " + achDvfWhy(v).join(" · "), 4500); return; }
      const min = Math.min(...D.map(x => achDvfTot(x).ht).filter(x => x > 0));
      if (achDvfTot(v).ht > min + 1e-6 && !C.motif) { svToast("LE RETENU N'EST PAS LE MOINS CHER : MOTIF OBLIGATOIRE.", 4000); return; }
      if (!(await svConfirm({ title: "CLÔTURER LA CONSULTATION", text: C.ref + " : RETENU " + achFrsNom(C.retenu) + " (" + achF2(achDvfTot(v).ht) + " HT). LES AUTRES DEVIS SONT REJETÉS ; LES BESOINS DES LIGNES DEVIENNENT COUVERTS.", ok: "CLÔTURER", tone: "neutral" }))) return;
      const DL = achDvf(); DL.forEach(x => { if (x.caf === C.id && x.state !== "annule") { x.state = x.id === v.id ? "retenu" : "rejete"; x.mod = now(); achHist(x.ref, x.state === "retenu" ? "RETENU" : "REJETÉ", C.ref); } }); achDvfSave(DL);
      const BL = achBsn(); C.lignes.forEach(l => { const b = BL.find(x => x.id === l.bsn); if (b) { b.couvert = C.id; b.mod = now(); achHist(b.ref, "COUVERT", C.ref + " — " + achFrsNom(C.retenu)); } }); achBsnSave(BL);
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
    const t = achDvfTot(V), why = V.id ? achDvfWhy(V) : [], dis = ro ? " disabled" : "", FR = achLive(achFrs()).filter(f => f.actif !== false || f.id === V.frs);
    d.innerHTML = sviWinCard({ cls: "frs-card dvf-card", close: "data-x", title: v0 ? "DEVIS — " + esc(V.ref) + " · " + ({ recu: "REÇU", retenu: "RETENU", rejete: "REJETÉ", annule: "ANNULÉ" }[V.state]) : "NOUVEAU DEVIS",
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}</div>` : ""}<div class="frs-scroll">
        <div class="frs-sec"><div class="frs-g">
          <label class="frs-f frs-w"><span>FOURNISSEUR <b>*</b></span><select class="ins-in dvf-x" data-k="frs"${dis || (V.caf ? " disabled" : "")}><option value=""></option>${FR.map(f => `<option value="${esc(f.id)}"${f.id === V.frs ? " selected" : ""}>${esc(f.code + " — " + f.nom)}</option>`).join("")}</select></label>
          <label class="frs-f"><span>N° DU DEVIS FOURNISSEUR</span><input class="ins-in dvf-x" data-k="refFrs" value="${esc(V.refFrs)}"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>CONSULTATION</span><input class="ins-in" value="${esc(((achCaf().find(c => c.id === V.caf) || {}).ref) || "HORS CONSULTATION")}" readonly></label>
          <label class="frs-f"><span>DATE</span><input type="date" class="ins-in dvf-x" data-k="date" value="${esc(V.date)}"${dis}></label>
          <label class="frs-f"><span>VALIDE JUSQU'AU</span><input type="date" class="ins-in dvf-x" data-k="validite" value="${esc(V.validite)}"${dis}></label></div></div>
        <div class="frs-sec"><div class="frs-st">LIGNES ${svCnt(V.lignes.length)}</div>
          <table class="prm-table frs-sub"><thead><tr><th>DÉSIGNATION</th><th>U</th><th class="number">QUANTITÉ</th><th class="number">PRIX HT</th><th class="number">TVA %</th><th class="number">MONTANT HT</th><th></th></tr></thead><tbody>
          ${V.lignes.map((l, i) => `<tr data-i="${i}"><td><input class="ins-in dvf-l" data-c="des" value="${esc(l.des)}"${dis || (V.caf ? " readonly" : "")}></td><td><input class="ins-in dvf-l" data-c="u" value="${esc(l.u)}"${dis || (V.caf ? " readonly" : "")}></td>
            <td><input class="ins-in dvf-l number" data-c="q" inputmode="decimal" value="${esc(String(l.q ?? "").replace(".", ","))}"${dis}></td><td><input class="ins-in dvf-l number" data-c="pu" inputmode="decimal" value="${l.pu === "" ? "" : esc(achF2(l.pu))}"${dis}></td>
            <td><input class="ins-in dvf-l number" data-c="tva" inputmode="decimal" value="${esc(String(l.tva ?? achPrm().tva).replace(".", ","))}"${dis}></td><td class="number">${esc(achF2(achN(l.q) * achN(l.pu)))}</td>
            <td class="center">${ro || V.caf ? "" : `<button type="button" class="ach-x" data-rml="${i}">✕</button>`}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">AUCUNE LIGNE</td></tr>`}
          <tr class="caf-tot"><td colspan="5"><b>TOTAL HT · TTC</b></td><td class="number"><b>${esc(achF2(t.ht))}</b><br>${esc(achF2(t.ttc))}</td><td></td></tr></tbody></table>
          ${ro || V.caf ? "" : `<button type="button" class="ach-b" data-addl>+ LIGNE</button>`}</div></div>`,
      foot: `<button type="button" class="svc-b" data-x>${ro || v0 ? "FERMER" : "ANNULER"}</button>${v0 && V.state === "recu" ? `<button type="button" class="svc-b" data-cancel>ANNULER LE DEVIS</button>` : ""}${!ro ? `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button>` : ""}` });
    if (!d.isConnected) sviWinShow(d);
  };
  const pull = () => { d.querySelectorAll(".dvf-x").forEach(i => { if (!i.disabled) V[i.dataset.k] = i.dataset.k === "refFrs" ? achU(i.value) : i.value; });
    d.querySelectorAll("tr[data-i]").forEach(tr => { const l = V.lignes[+tr.dataset.i]; if (!l) return; tr.querySelectorAll(".dvf-l").forEach(i => { const c = i.dataset.c; l[c] = c === "q" || c === "tva" ? achN(i.value) : c === "pu" ? (String(i.value).trim() === "" ? "" : achN(i.value)) : achU(i.value); }); }); };
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
    if (!V.lignes.length || V.lignes.some(l => !achU(l.des) || !(achN(l.q) > 0))) { svToast("AU MOINS UNE LIGNE ; CHAQUE LIGNE : DÉSIGNATION ET QUANTITÉ.", 3500); return; }
    if (V.lignes.some(l => l.pu !== "" && achN(l.pu) < 0)) { svToast("PRIX NON VALIDE.", 3000); return; }
    let v = V.id ? L.find(x => x.id === V.id) : null;
    if (!v) { v = { ...JSON.parse(JSON.stringify(V)), id: "V" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ref: achNextRef("DVF", L), cree: now }; L.push(v); }
    else Object.assign(v, JSON.parse(JSON.stringify(V)));
    v.mod = now; achDvfSave(L); achHist(v.ref, V.id ? "MODIFICATION" : "CRÉATION", achFrsNom(v.frs) + " — " + achF2(achDvfTot(v).ht) + " HT");
    d.remove(); if (done) done();
  });
}

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
