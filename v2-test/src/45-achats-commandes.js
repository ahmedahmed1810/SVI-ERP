/* =========================================================
   v762 : COMMANDES, RÉCEPTIONS, RETOURS (étape 4) — onglets de l'écran des achats (menu ☰ › ACHAT)
   Tableaux : achListMod (44) ; fiches ci-dessous ; règles : 40-achats-donnees.js (achCmfTot, achResteQ, achCmfWhy, achRcpWhy…).
   ========================================================= */
const ACH_CMF_ST = { instance: "EN INSTANCE", valide: "VALIDÉE", solde: "SOLDÉE", annule: "ANNULÉE" };
const achNow = () => new Date().toISOString();
function achCmfMod(ctx) {
  return achListMod(ctx, { k: "cmf", t: "ach_cmf", id: "achCmfT", list: achCmf, name: "COMMANDES", save: achCmfSave,
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
