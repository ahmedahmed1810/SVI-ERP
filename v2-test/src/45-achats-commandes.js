/* =========================================================
   v762 : COMMANDES, RÉCEPTIONS, RETOURS (étape 4) — onglets de l'écran des achats (menu ☰ › ACHAT)
   Tableaux : achListMod (44) ; fiches ci-dessous ; règles : 40-achats-donnees.js (achCmfTot, achResteQ, achCmfWhy, achRcpWhy…).
   ========================================================= */
const ACH_CMF_ST = { instance: "EN INSTANCE", valide: "VALIDÉE", solde: "SOLDÉE", annule: "ANNULÉE" };
const achNow = () => new Date().toISOString();
function achCmfMod(ctx) {
  return achListMod(ctx, { k: "cmf", t: "ach_cmf", id: "achCmfT", list: achCmf, etatKey: "svi_ach_cmf_etat_v1", newLab: "NOUVELLE COMMANDE", newRow: "CRÉER UNE COMMANDE ICI…", open: achCmfFiche,
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
  return achListMod(ctx, { k: "rcp", t: "ach_rcp", id: "achRcpT", list: achRcp, etatKey: "svi_ach_rcp_etat_v1", newLab: "LIVRAISON SANS COMMANDE", newRow: "CRÉER UNE RÉCEPTION SANS COMMANDE ICI… (LES AUTRES : DEPUIS LA COMMANDE, RÉCEPTIONNER)", open: (id, done) => achRcpFiche(id, null, done),
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
  return achListMod(ctx, { k: "rtr" + kind, t: "ach_rtr" + kind, id: kind === "cmd" ? "achRtcT" : "achRtrT", list: () => achRtr().filter(x => x.kind === kind), etatKey: "svi_ach_rtr" + kind + "_etat_v1",
    newLab: kind === "cmd" ? "RETOUR DE COMMANDE (DEPUIS LA COMMANDE)" : "RETOUR DE RÉCEPTION (DEPUIS LA RÉCEPTION)", newRow: kind === "cmd" ? "UN RETOUR DE COMMANDE SE CRÉE DEPUIS LA COMMANDE (RETOUR DE COMMANDE, SOLDER)" : "UN RETOUR DE RÉCEPTION SE CRÉE DEPUIS LA RÉCEPTION (REFUS, RETOURNER)",
    open: (id, done) => { if (id) achRtrWin(id); else svToast(kind === "cmd" ? "OUVRIR LA COMMANDE PUIS « RETOUR DE COMMANDE » OU « SOLDER »." : "OUVRIR LA RÉCEPTION PUIS « RETOURNER » (OU REFUSER DES LIGNES).", 3500); },
    etats: [["tout", "TOUS"]], ok: () => true, why: () => [],
    w: { ref: 150, src: 150, frs: 220, date: 150, lig: 260, motif: 260 },
    cols: () => [["ref", "RÉFÉRENCE", x => x.ref, ""], ["src", kind === "cmd" ? "COMMANDE" : "RÉCEPTION", x => kind === "cmd" ? ((achCmf().find(c => c.id === x.cmf) || {}).ref || "") : ((achRcp().find(r => r.id === x.rcp) || {}).ref || ""), ""],
      ["frs", "FOURNISSEUR", x => x.frs ? achFrsNom(x.frs) : "", ""], ["date", "DATE", x => svDT(x.date || ""), ""], ["lig", "LIGNES", x => (x.lignes || []).map(l => l.des + " " + achF2(l.q) + " " + l.u).join(" · "), ""], ["motif", "MOTIF", x => x.motif || "", ""]] });
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
    lieu: o.lieu || "", dProm: "", dConf: "", urg: false, cond: "", avT: "", avV: 0, rem: 0, transp: "FRANCO", frais: 0, state: "instance", av: 0, cree: achNow(),
    lignes: (o.lignes || []).map(l => ({ id: achLid(), des: l.des, u: l.u, q: achN(l.q), pu: achN(l.pu), tva: l.tva === undefined ? achPrm().tva : l.tva, bsn: l.bsn || "", dvf: l.dvf || o.dvf || "" })) };
  L.push(c); achCmfSave(L); achHist(c.ref, "CRÉATION", o.why || ""); return c;
}
function achCmfFiche(id, done) {
  let c0 = id ? achCmf().find(x => x.id === id) : null;
  if (id && !c0) return;
  if (!c0) c0 = achCmfFrom({ why: "SAISIE LIBRE" });
  const C = JSON.parse(JSON.stringify(c0)), d = sviWinNew();
  let edAv = false;   /* avenant en cours : la commande validée redevient modifiable */
  const draw = () => {
    const ro = !(C.state === "instance" || edAv), dis = ro ? " disabled" : "", t = achCmfTot(C), why = achCmfWhy(C), R = achRcp(), T = achRtr();
    const BL = achBsn(), DV = achDvf(), PV = C.nat === "PRESTATIONS ET HONORAIRES";
    const opt = (L, v) => L.map(x => `<option value="${esc(x[0])}"${x[0] === v ? " selected" : ""}>${esc(x[1])}</option>`).join("");
    const FR = achLive(achFrs()).filter(f => f.actif !== false || f.id === C.frs);
    d.innerHTML = sviWinCard({ cls: "frs-card cmf-card", close: "data-x", title: "COMMANDE — " + esc(C.ref) + (C.av ? " · AVENANT " + C.av : "") + " · " + (ACH_CMF_ST[C.state] || "") + (edAv ? " (AVENANT EN COURS)" : ""),
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}</div>` : ""}<div class="frs-scroll">
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
        ${(C.avH || []).length ? `<div class="frs-sec"><div class="frs-st">AVENANTS</div>${C.avH.map(a => `<div class="bsn-note">AVENANT ${a.n} — ${esc(achDFr(a.t))} — ${esc(a.motif)} (AVANT : ${esc(achF2(a.ht))} HT)</div>`).join("")}</div>` : ""}
      </div>`,
      foot: `<button type="button" class="svc-b" data-x>FERMER</button>
        ${C.state === "instance" && !R.some(r => r.cmf === C.id && r.state !== "annule") ? `<button type="button" class="svc-b" data-cancel>ANNULER LA COMMANDE</button>` : ""}
        ${C.state === "valide" && !edAv ? `<button type="button" class="svc-b" data-rtc>RETOUR DE COMMANDE</button><button type="button" class="svc-b" data-solde>SOLDER</button><button type="button" class="svc-b" data-av>AVENANT</button><button type="button" class="svc-b svc-ok svc-neutral" data-rcp>${PV ? "PV DE SERVICE FAIT" : "RÉCEPTIONNER"}</button>` : ""}
        ${C.state === "valide" && !edAv ? `<button type="button" class="svc-b svc-ok svc-neutral" data-save2>ENREGISTRER</button>` : ""}
        ${(C.state === "valide" || C.state === "instance") && !edAv && C.avT && achCmfTot(C).av - achAvVerse(C.id) > 0.005 ? `<button type="button" class="svc-b" data-avpay>VERSER L'AVANCE</button>` : ""}
        ${(C.state === "valide" || C.state === "solde") && !edAv ? `<button type="button" class="svc-b" data-fac>FACTURER</button>` : ""}
        ${!ro ? `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER${edAv ? " L'AVENANT" : ""}</button>` : ""}${C.state === "instance" ? `<button type="button" class="svc-b svc-ok" data-valid>VALIDER</button>` : ""}` });
    if (!d.isConnected) sviWinShow(d);
  };
  const pull = () => { d.querySelectorAll(".cmf-x").forEach(i => { if (i.disabled) return; const k = i.dataset.k; C[k] = ["frais", "rem", "avV"].includes(k) ? achN(i.value) : ["dProm", "dConf", "frs", "nat", "transp", "avT"].includes(k) ? i.value : achU(i.value); });
    d.querySelectorAll(".cmf-xc").forEach(i => { if (!i.disabled) C[i.dataset.k] = i.checked; });
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
  d.addEventListener("click", async e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (done) done(); return; }
    if (e.target.closest("[data-addl]")) { pull(); C.lignes.push({ id: achLid(), des: "", u: "", q: "", pu: "", tva: achPrm().tva, bsn: "", dvf: "" }); draw(); return; }
    const rl = e.target.closest("[data-rml]"); if (rl) { pull(); C.lignes.splice(+rl.dataset.rml, 1); draw(); return; }
    if (e.target.closest("[data-adddir]")) {
      pull(); const used = new Set(achCmf().flatMap(c => (c.lignes || []).map(l => l.bsn)).filter(Boolean)), B = achBsn().filter(b => b.direct && !used.has(b.id) && b.state === "valide");
      if (!B.length) { svToast("AUCUN BESOIN EN ACHAT DIRECT À COMMANDER.", 3000); return; }
      const pick = await achPickWin("BESOINS EN ACHAT DIRECT", B.map(b => ({ v: b.id, lab: b.ref + " — " + b.des + " (" + achF2(b.q) + " " + b.u + ")" })));
      B.filter(b => pick.includes(b.id)).forEach(b => C.lignes.push({ id: achLid(), des: b.des, u: b.u, q: achN(b.q), pu: achN(b.pu), tva: achPrm().tva, bsn: b.id, dvf: "" })); draw(); return;
    }
    if (e.target.closest("[data-cancel]")) { if (!(await svConfirm({ title: "ANNULER LA COMMANDE", text: C.ref + " PASSE EN ANNULÉE (GARDÉE).", ok: "ANNULER LA COMMANDE" }))) return; C.state = "annule"; store("ANNULÉE"); d.remove(); if (done) done(); return; }
    if (e.target.closest("[data-save2]")) { pull(); store("DATE CONFIRMÉE / RÉGULARISATION"); draw(); return; }
    if (e.target.closest("[data-av]")) { const m = await achAsk("AVENANT À LA COMMANDE", "MOTIF DE L'AVENANT"); if (!m) return; C.__avM = m; C.__avHt = achCmfTot(C).ht; edAv = true; draw(); return; }
    if (e.target.closest("[data-save]")) {
      pull(); if (!check()) return;
      if (edAv) { const R = achRcp(), T = achRtr(); if (C.lignes.some(l => achN(l.q) + 1e-9 < achRecQ(C.id, l.id, R, T) + achCanQ(C.id, l.id, T))) { svToast("UNE QUANTITÉ NE PEUT PAS DESCENDRE SOUS LE DÉJÀ REÇU.", 3500); return; }
        C.av = (C.av || 0) + 1; C.avH = (C.avH || []).concat({ n: C.av, t: achNow(), motif: C.__avM, ht: C.__avHt }); delete C.__avM; delete C.__avHt; edAv = false; store("AVENANT " + C.av); draw(); return; }
      store("MODIFICATION"); draw(); return; }
    if (e.target.closest("[data-valid]")) { pull(); if (!check()) return;
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
  const P = r0 ? JSON.parse(JSON.stringify(r0)) : { id: "", ref: "", cmf: C ? C.id : "", frs: C ? C.frs : "", nbl: "", pv: !!C && C.nat === "PRESTATIONS ET HONORAIRES", date: achNow(), photo: "", state: "valide",
    lignes: C ? C.lignes.map(l => ({ cl: l.id, des: l.des, u: l.u, max: achResteQ(C, l, R0, T0), q: Math.round(achResteQ(C, l, R0, T0) * 1000) / 1000, st: "ok", motif: "", bon: "" })).filter(l => l.max > 1e-9) : [] };
  const ro = !!r0, d = sviWinNew();
  let photoBlob = null;
  const draw = () => {
    const why = r0 ? achRcpWhy(P) : [], dis = ro ? " disabled" : "", FR = achLive(achFrs()).filter(f => f.actif !== false || f.id === P.frs);
    const sel = (i, v) => `<select class="ins-in rcp-l" data-c="st" data-i="${i}"${dis}>${[["ok", "ACCEPTÉE"], ["res", "AVEC RÉSERVES"], ["ref", "REFUSÉE"]].map(([k, l]) => `<option value="${k}"${v === k ? " selected" : ""}>${l}</option>`).join("")}</select>`;
    d.innerHTML = sviWinCard({ cls: "frs-card rcp-card", close: "data-x", title: (r0 ? "RÉCEPTION — " + esc(P.ref) : P.pv ? "PROCÈS-VERBAL DE SERVICE FAIT" : "NOUVELLE RÉCEPTION") + (C ? " · " + esc(C.ref) : " · SANS COMMANDE"),
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}</div>` : ""}<div class="frs-scroll">
        <div class="frs-sec"><div class="frs-g">
          <label class="frs-f frs-w"><span>FOURNISSEUR <b>*</b></span><select class="ins-in rcp-x" data-k="frs"${dis || (C ? " disabled" : "")}><option value=""></option>${FR.map(f => `<option value="${esc(f.id)}"${f.id === P.frs ? " selected" : ""}>${esc(f.code + " — " + f.nom)}</option>`).join("")}</select></label>
          <label class="frs-f"><span>${P.pv ? "N° DU PV" : "N° DU BON DE LIVRAISON"}${P.pv ? "" : " <b>*</b>"}</span><input class="ins-in rcp-x" data-k="nbl" value="${esc(P.nbl)}"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>REÇU LE (DATE ET HEURE)</span><input class="ins-in" value="${esc(svDT(P.date))}" readonly></label>
          <label class="frs-f frs-w"><span>PHOTO DU BON</span>${ro ? (P.photo ? `<button type="button" class="ach-b" data-photo>VOIR LA PHOTO</button>` : `<span class="ach-0">AUCUNE</span>`) : `<input type="file" class="rcp-ph" accept="image/*" capture="environment">`}</label></div></div>
        <div class="frs-sec"><div class="frs-st">LIGNES ${svCnt(P.lignes.length)} ${C ? `<small>(TOLÉRANCE ${esc(String(tol).replace(".", ","))} % AU-DESSUS DU RESTE)</small>` : ""}</div>
          <table class="prm-table frs-sub"><thead><tr><th>DÉSIGNATION</th><th>U</th>${C && !ro ? `<th class="number">RESTE</th>` : ""}<th class="number">QUANTITÉ REÇUE</th><th>RÉSULTAT</th><th>MOTIF (RÉSERVE, REFUS)</th><th>N° DE BON (BÉTON, CAMION)</th>${C || ro ? "" : "<th></th>"}</tr></thead><tbody>
          ${P.lignes.map((l, i) => `<tr data-i="${i}"><td>${C || ro ? esc(l.des) : `<input class="ins-in rcp-l" data-c="des" data-i="${i}" value="${esc(l.des)}">`}</td><td>${C || ro ? esc(l.u) : `<input class="ins-in rcp-l" data-c="u" data-i="${i}" value="${esc(l.u)}">`}</td>
            ${C && !ro ? `<td class="number">${esc(achF2(l.max))}</td>` : ""}<td><input class="ins-in rcp-l number" data-c="q" data-i="${i}" inputmode="decimal" value="${esc(String(l.q ?? "").replace(".", ","))}"${dis}></td><td>${sel(i, l.st)}</td>
            <td><input class="ins-in rcp-l" data-c="motif" data-i="${i}" value="${esc(l.motif)}"${dis} autocomplete="off"></td><td><input class="ins-in rcp-l" data-c="bon" data-i="${i}" value="${esc(l.bon)}"${dis} autocomplete="off"></td>
            ${C || ro ? "" : `<td class="center"><button type="button" class="ach-x" data-rml="${i}">✕</button></td>`}</tr>`).join("") || `<tr><td colspan="8" class="empty">AUCUNE LIGNE (TOUT EST REÇU)</td></tr>`}</tbody></table>
          ${C || ro ? "" : `<button type="button" class="ach-b" data-addl>+ LIGNE</button>`}
          ${P.resLev ? `<div class="bsn-deb">RÉSERVES LEVÉES LE ${esc(svDT(P.resLev))}.</div>` : ""}</div>
        <div class="bsn-note">LES DEMANDEURS DES BESOINS SONT AVERTIS (NOTÉ SUR LEUR BESOIN). CONVERSION D'UNITÉ À LA RÉCEPTION : AVEC LE VOLET UNITÉS DES ARTICLES (À VENIR).</div></div>`,
      foot: `<button type="button" class="svc-b" data-x>${ro ? "FERMER" : "ANNULER"}</button>
        ${ro && P.state !== "annule" && P.lignes.some(l => l.st === "res") && !P.resLev ? `<button type="button" class="svc-b svc-ok svc-neutral" data-lev>LEVER LES RÉSERVES</button>` : ""}
        ${ro && P.state !== "annule" && P.cmf ? `<button type="button" class="svc-b" data-ret>RETOURNER</button>` : ""}
        ${!ro ? `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER LA RÉCEPTION</button>` : ""}` });
    if (!d.isConnected) sviWinShow(d);
  };
  const pull = () => { d.querySelectorAll(".rcp-x").forEach(i => { if (!i.disabled) P[i.dataset.k] = i.dataset.k === "frs" ? i.value : achU(i.value); });
    d.querySelectorAll(".rcp-l").forEach(i => { const l = P.lignes[+i.dataset.i]; if (!l || i.disabled) return; const c = i.dataset.c; l[c] = c === "q" ? achN(i.value) : c === "st" ? i.value : achU(i.value); }); };
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
    if (e.target.closest("[data-lev]")) { if (!cur) return; cur.resLev = achNow(); cur.lignes.forEach(l => { if (l.st === "res") l.st = "ok"; }); achRcpSave(L); achHist(cur.ref, "RÉSERVES LEVÉES", ""); d.remove(); if (done) done(); return; }
    if (e.target.closest("[data-ret]")) {
      if (!cur) return; const T = achRtr(), lines = cur.lignes.filter(l => l.st !== "ref").map(l => { const done0 = T.filter(x => x.kind === "rcp" && x.rcp === cur.id && x.after).reduce((t, x) => t + (x.lignes || []).filter(y => y.cl === l.cl).reduce((u, y) => u + achN(y.q), 0), 0); return { cl: l.cl, des: l.des, u: l.u, max: achN(l.q) - done0 }; }).filter(l => l.max > 1e-9);
      if (!lines.length) { svToast("RIEN À RETOURNER.", 3000); return; }
      const r = await achQtyWin("RETOUR DE RÉCEPTION — QUANTITÉS RENDUES AU FOURNISSEUR", lines, { chauffeur: true, ok: "RETOURNER" }); if (!r) return;
      achRtrAdd({ kind: "rcp", rcp: cur.id, cmf: cur.cmf, frs: cur.frs, lignes: r.lignes, motif: r.motif, chauffeur: r.chauffeur, after: true }); achHist(cur.ref, "RETOUR", r.motif); d.remove(); if (done) done(); return;
    }
    if (!e.target.closest("[data-save]")) return;
    pull();
    if (!P.frs) { svToast("FOURNISSEUR OBLIGATOIRE.", 3000); return; }
    if (!P.pv && !P.nbl) { svToast("N° DU BON DE LIVRAISON OBLIGATOIRE.", 3000); return; }
    P.lignes = P.lignes.filter(l => achN(l.q) > 0);
    if (!P.lignes.length) { svToast("AUCUNE QUANTITÉ REÇUE.", 3000); draw(); return; }
    if (P.lignes.some(l => !achU(l.des))) { svToast("CHAQUE LIGNE : DÉSIGNATION.", 3000); return; }
    if (C && P.lignes.some(l => achN(l.q) > l.max * (1 + tol / 100) + 1e-9)) { svToast("QUANTITÉ AU-DELÀ DU RESTE + TOLÉRANCE (" + tol + " %) : À REFUSER OU À COMMANDER PAR AVENANT.", 4500); return; }
    if (P.lignes.some(l => (l.st === "res" || l.st === "ref") && !l.motif)) { svToast("MOTIF OBLIGATOIRE POUR UNE RÉSERVE OU UN REFUS.", 3500); return; }
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
