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
    if (valid && await achCircGate("bsn", b, achN(b.q) * achStdPu(b.des, b.u, b.pu, achPrjOfBdg(b.bdg)), async lab => { save(L, b, lab); })) { d.remove(); if (done) done(); return; }
    if (valid) { b.state = "valide"; b.valide = now; b.valPar = typeof sviUser === "function" ? sviUser() : ""; }
    save(L, b, cur ? (valid ? "VALIDÉ" : "MODIFICATION") : "CRÉATION");
    if (!cur && ctl && ctl.over) svToast(b.ref + " ENREGISTRÉ : DÉPASSEMENT DU PRÉVU, BLOQUÉ JUSQU'AU DÉBLOCAGE.", 4500);
    d.remove(); if (done) done();
  });
}
