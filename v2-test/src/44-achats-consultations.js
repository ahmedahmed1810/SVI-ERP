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
        info: done => (o.info || o.open)(id, () => done()), click: D.click, change: D.change,
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
  const docs = (t, L, cols, cells, kk) => ({ t, cols, rows: L.map(y => ({ cells: cells(y), open: () => achGo(kk, y.id), go: y.frs && cols[1] && cols[1][0] === "FOURNISSEUR" ? [[1, "frs", y.frs]] : [], cls: ["annule", "rejete"].includes(y.state) ? "nv-strike" : "" })) });
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
  if (k === "dvf") return { title: fr(x.frs), tot: TOT(achDvfTot(x)), ttc: achDvfTot(x).ttc, links: [lig("DÉTAIL DEVIS", true), CA("CONSULTATION", achCaf().filter(c => c.id === x.caf)), CM1("COMMANDES", achCmf().filter(c => c.dvf === x.id || (c.lignes || []).some(l => l.dvf === x.id)))] };
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
  return achListMod(ctx, { k: "caf", t: "ach_caf", id: "achCafT", list: achCaf, name: "CONSULTATIONS", save: achCafSave, edit: ACH_ED.caf, inst: c => c.state === "ouverte", etatKey: "svi_ach_caf_etat_v1", newLab: "NOUVELLE CONSULTATION", newRow: "CRÉER UNE CONSULTATION ICI…", open: (id, done) => id ? achCafFiche(id, done) : achCafInfo(null, done), info: achCafInfo,   /* série I (I9) : le i = DATE DE CRÉATION et OBJET */
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
        ${C.state === "close" && !achCmf().some(x => x.caf === C.id && x.state !== "annule") ? `<button type="button" class="svc-b svc-ok svc-neutral" data-mkcmf>CRÉER LA COMMANDE</button>` : ""}
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
      if (await achCircGate("caf", C, achStdMt(C.lignes), async lab => { store(lab); draw(); })) return;
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
    d.innerHTML = sviWinCard({ cls: "frs-card dvf-card", close: "data-x", title: achWinTtl(v0 && V.ref, "NOUVEAU DEVIS"),   /* série I (I8) : bandeau = la référence seule */
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
