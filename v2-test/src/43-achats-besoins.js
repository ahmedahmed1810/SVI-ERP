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
  const stLab = b => b.state === "valide" ? "VALIDÉ" : b.state === "annule" ? "ANNULÉ" : "EN INSTANCE";
  const ctlLab = (b, L) => { if (b.centre === "SIÈGE") return "SIÈGE"; const c = achBsnCtl(b, L); if (!c) return ""; if (c.none) return "HORS BUDGET";
    return c.over ? (b.deb ? "DÉBLOQUÉ (" + Math.round(c.pct) + " %)" : "BLOQUÉ (" + Math.round(c.pct) + " %)") : Math.round(c.pct) + " %"; };
  const dFr = v => /^\d{4}-\d{2}-\d{2}/.test(String(v || "")) ? String(v).slice(8, 10) + "/" + String(v).slice(5, 7) + "/" + String(v).slice(0, 4) : "";
  const COLS = L => [["ref", "RÉFÉRENCE", b => b.ref, ""], ["bdg", "BUDGET", b => b.centre === "SIÈGE" ? "SIÈGE" : b.bdgLab || b.bdg || "", ""], ["des", "CHARGE", b => b.des || "", ""],
    ["u", "U", b => b.u || "", "center"], ["q", "QUANTITÉ", b => achN(b.q), "number"], ["pu", "PRIX ESTIMÉ", b => achN(b.pu), "number"], ["mt", "MONTANT", b => achN(b.q) * achN(b.pu), "number"],
    ["tache", "TÂCHE", b => b.tache || "", ""], ["prevue", "PRÉVU LE", b => dFr(b.datePrevue), ""], ["prio", "PRIORITÉ", b => b.prio || "", "center"],
    ["etat", "ÉTAT", b => stLab(b), "center"], ["ctl", "CONTRÔLE", b => ctlLab(b, L), "center"], ["dem", "DEMANDEUR", b => b.dem || "", ""]];
  const W0 = { ref: 150, bdg: 220, des: 220, u: 60, q: 100, pu: 110, mt: 120, tache: 220, prevue: 110, prio: 110, etat: 110, ctl: 130, dem: 120 };
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
        ${ctl && !ctl.none ? `<div class="bsn-ctl${ctl.over ? " over" : ctl.pct >= ACH_BSN_SEUIL ? " near" : ""}"><span>PRÉVU : <b>${esc(nf(ctl.planQ))} ${esc(B.u)}</b> · ${esc(nf(ctl.plan))} DH</span><span>DÉJÀ DEMANDÉ : <b>${esc(nf(ctl.usedQ))}</b></span><span>RESTE : <b>${esc(nf(ctl.restQ))}</b></span><span>AVEC CE BESOIN : <b>${Math.round(ctl.pct)} %</b></span></div>` : ""}
        <div class="frs-sec"><div class="frs-st">DEMANDE</div><div class="frs-g">
          <label class="frs-f"><span>QUANTITÉ <b>*</b></span><input class="ins-in bsn-x" data-k="q" value="${esc(B.q === "" ? "" : String(B.q).replace(".", ","))}" inputmode="decimal"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>PRIX ESTIMÉ HT</span><input class="ins-in bsn-x" data-k="pu" value="${esc(nf(B.pu))}" inputmode="decimal"${dis || (B.centre !== "SIÈGE" ? " readonly" : "")} autocomplete="off"></label>
          <label class="frs-f"><span>MONTANT ESTIMÉ</span><input class="ins-in" value="${esc(nf(achN(B.q) * achN(B.pu)))}" readonly></label>
          <label class="frs-f"><span>PRÉVU LE <b>*</b></span><input type="date" class="ins-in bsn-x" data-k="datePrevue" value="${esc(B.datePrevue)}"${dis}></label>
          <label class="frs-f"><span>PRIORITÉ</span><select class="ins-in bsn-x" data-k="prio"${dis}>${opt(ACH_PRIO.map(x => [x, x]), B.prio)}</select></label>
          <label class="frs-f"><span>DESTINATAIRE (LIEU, PERSONNE)</span><input class="ins-in bsn-x" data-k="dest" value="${esc(B.dest)}"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>DEMANDEUR</span><input class="ins-in" value="${esc(B.dem)}" readonly></label>
          <label class="frs-f frs-w"><span>OBSERVATION</span><input class="ins-in bsn-x" data-k="obs" value="${esc(B.obs)}"${dis} autocomplete="off"></label>
        </div></div>
        ${ctl && ctl.over && !ctl.none && B.state !== "annule" ? `<div class="frs-sec"><div class="frs-st">DÉPASSEMENT DU PRÉVU</div>
          ${B.deb ? `<div class="bsn-deb">DÉBLOQUÉ PAR ${esc(B.deb.u || "?")} LE ${esc(dFr2(B.deb.t))} — ${esc(B.deb.why || "")}</div>`
            : `<label class="frs-f frs-w"><span>JUSTIFICATION <b>*</b></span><input class="ins-in bsn-just" value="${esc(B.just || "")}" autocomplete="off"></label><button type="button" class="ach-b" data-deb>DÉBLOQUER</button><span class="bsn-note">DÉBLOCAGE SELON LES DROITS : POUR L'INSTANT, TOUT UTILISATEUR (NOTÉ DANS H).</span>`}</div>` : ""}
        ${B.couvert ? `<div class="bsn-deb">COUVERT PAR LA CONSULTATION ${esc(((achCaf().find(c => c.id === B.couvert) || {}).ref) || "")}.</div>` : B.direct ? `<div class="bsn-deb">ACHAT DIRECT (SANS CONSULTATION) — ${esc(dFr2(B.direct))}.</div>` : ""}
        <div class="bsn-note">STOCK DISPONIBLE : VÉRIFIÉ QUAND LE MODULE STOCK EXISTERA. PHOTO DU CHANTIER : PAR LES DOCUMENTS DE LA FICHE (À VENIR).</div>
      </div>`,
      foot: `<button type="button" class="svc-b" data-x>${ro || b0 ? "FERMER" : "ANNULER"}</button>
        ${b0 && B.state !== "annule" ? `<button type="button" class="svc-b" data-cancel>ANNULER LE BESOIN</button>` : ""}
        ${b0 && B.state === "annule" ? `<button type="button" class="svc-b" data-restore>RÉTABLIR</button>` : ""}
        ${!ro ? `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button>` : ""}
        ${b0 && B.state === "instance" ? `<button type="button" class="svc-b svc-ok" data-valid>VALIDER</button>` : ""}
        ${b0 && B.state === "valide" && !B.couvert && !B.direct ? `<button type="button" class="svc-b" data-direct>ACHAT DIRECT (SANS CONSULTATION)</button>` : ""}` });
    if (!d.isConnected) sviWinShow(d);
  };
  const dFr2 = v => String(v || "").slice(0, 10).split("-").reverse().join("/");
  const pull = () => { d.querySelectorAll(".bsn-x").forEach(i => { const k = i.dataset.k; B[k] = k === "q" || k === "pu" ? (String(i.value).trim() === "" ? "" : achN(i.value)) : k === "datePrevue" || k === "bdg" || k === "chg" || k === "tache" || k === "centre" ? i.value : achU(i.value); });
    const j = d.querySelector(".bsn-just"); if (j) B.just = achU(j.value); };
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
    if (e.target.closest("[data-cancel]")) { if (!cur) return; if (!(await svConfirm({ title: "ANNULER LE BESOIN", text: cur.ref + " PASSE EN ANNULÉ (GARDÉ, RÉTABLISSABLE) ; IL NE COMPTE PLUS DANS LE CONTRÔLE DU BUDGET.", ok: "ANNULER LE BESOIN" }))) return;
      cur.state = "annule"; cur.mod = new Date().toISOString(); save(L, cur, "ANNULÉ"); d.remove(); if (done) done(); return; }
    /* v761 : ACHAT DIRECT — besoin validé dont le montant estimé est sous le seuil (ACHATS › PARAMÈTRES) */
    if (e.target.closest("[data-direct]")) { if (!cur) return; const mt = achN(cur.q) * achN(cur.pu), S = achPrm().direct;
      if (mt > S) { svToast("ACHAT DIRECT IMPOSSIBLE : " + achF2(mt) + " HT DÉPASSE LE SEUIL DE " + achF2(S) + " HT (ACHATS › PARAMÈTRES) — PASSER PAR UNE CONSULTATION.", 5000); return; }
      cur.direct = new Date().toISOString(); cur.mod = cur.direct; save(L, cur, "ACHAT DIRECT"); d.remove(); if (done) done(); return; }
    if (e.target.closest("[data-restore]")) { if (!cur) return; cur.state = "instance"; delete cur.deb; cur.mod = new Date().toISOString(); save(L, cur, "RÉTABLI"); d.remove(); if (done) done(); return; }
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
