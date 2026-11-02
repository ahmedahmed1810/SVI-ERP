/* =========================================================
   v763 : FACTURES, AVOIRS, PAIEMENTS (étape 5) — onglets de l'écran des achats (menu ☰ › ACHAT)
   Tableaux : achListMod (44) ; fiches ci-dessous ; règles : 40-achats-donnees.js (achFafTot, achFafWhy, achPafWhy…).
   ========================================================= */
const ACH_FAF_ST = { instance: "EN INSTANCE", reclame: "RÉCLAMÉE", bap: "BON À PAYER", annule: "ANNULÉE" };
const ACH_PAF_ST = { instance: "EN INSTANCE", emis: "ÉMIS", encaisse: "ENCAISSÉ", rejete: "REJETÉ", annule: "ANNULÉ" };
const achFafEtat = f => f.state === "bap" && achFafReste(f) <= 0.005 ? "PAYÉE" : f.state === "bap" && achFafPaid(f.id) > 0 ? "PAYÉE EN PARTIE" : ACH_FAF_ST[f.state] || "";
const achId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const achDin = v => String(v || "").slice(0, 10);
function achFafMod(ctx) {
  return achListMod(ctx, { k: "faf", t: "ach_faf", id: "achFafT", list: achFaf, name: "FACTURES", save: achFafSave, inst: f => f.state === "instance" || f.state === "reclame", etatKey: "svi_ach_faf_etat_v1", newLab: "NOUVELLE FACTURE", newRow: "CRÉER UNE FACTURE ICI… (OU DEPUIS LA COMMANDE : FACTURER)", open: (id, done) => achFafFiche(id, null, done),
    etats: [["actif", "À PAYER"], ["instance", "EN INSTANCE"], ["reclame", "RÉCLAMÉES"], ["bap", "BON À PAYER"], ["payee", "PAYÉES"], ["alerte", "ALERTE"], ["annule", "ANNULÉES"], ["tout", "TOUT"]],
    ok: (f, k, L) => k === "tout" ? true : k === "alerte" ? achFafWhy(f, L).length > 0 : k === "payee" ? f.state === "bap" && achFafReste(f) <= 0.005 : k === "actif" ? f.state !== "annule" && achFafReste(f) > 0.005 : f.state === k,
    why: (f, L) => achFafWhy(f, L),
    w: { ref: 150, num: 130, frs: 220, cmf: 150, dfac: 110, ech: 110, ttc: 130, reste: 130, etat: 140 },
    cols: () => [["ref", "RÉFÉRENCE", f => f.ref, ""], ["num", "N° FACTURE", f => f.num || "", ""], ["frs", "FOURNISSEUR", f => f.frs ? achFrsNom(f.frs) : "", ""],
      ["cmf", "COMMANDE", f => f.type === "acompte" ? "ACOMPTE" : ((achCmf().find(c => c.id === f.cmf) || {}).ref) || "SANS COMMANDE", ""], ["dfac", "DATE", f => achDFr(f.dFac), ""], ["ech", "ÉCHÉANCE", f => achDFr(achFafEch(f)), ""],
      ["ttc", "MONTANT TTC", f => achFafTot(f).ttc, "number"], ["reste", "RESTE À PAYER", f => f.state === "annule" ? "" : achFafReste(f), "number"], ["etat", "ÉTAT", f => achFafEtat(f), "center"]] });
}
function achAvfMod(ctx) {
  return achListMod(ctx, { k: "avf", t: "ach_avf", id: "achAvfT", list: achAvf, name: "AVOIRS", etatKey: "svi_ach_avf_etat_v1", newLab: "NOUVEL AVOIR", newRow: "CRÉER UN AVOIR ICI…", open: achAvfFiche,
    etats: [["actif", "À DÉDUIRE"], ["tout", "TOUT"], ["annule", "ANNULÉS"]],
    ok: (a, k) => k === "tout" ? true : k === "annule" ? a.state === "annule" : a.state !== "annule" && achAvfReste(a) > 0.005, why: () => [],
    w: { ref: 150, num: 130, frs: 220, fa: 150, date: 110, ttc: 130, reste: 130, motif: 220 },
    cols: () => [["ref", "RÉFÉRENCE", a => a.ref, ""], ["num", "N° AVOIR", a => a.num || "", ""], ["frs", "FOURNISSEUR", a => a.frs ? achFrsNom(a.frs) : "", ""], ["fa", "FACTURE", a => ((achFaf().find(f => f.id === a.fa) || {}).ref) || "", ""],
      ["date", "DATE", a => achDFr(a.date), ""], ["ttc", "MONTANT TTC", a => achN(a.ttc), "number"], ["reste", "RESTE À DÉDUIRE", a => a.state === "annule" ? "" : achAvfReste(a), "number"], ["motif", "MOTIF", a => a.motif || "", ""]] });
}
function achPafMod(ctx) {
  return achListMod(ctx, { k: "paf", t: "ach_paf", id: "achPafT", list: achPaf, name: "PAIEMENTS", save: achPafSave, inst: p => p.state === "instance", etatKey: "svi_ach_paf_etat_v1", newLab: "NOUVEAU PAIEMENT", newRow: "CRÉER UN PAIEMENT ICI… (OU DEPUIS LA FACTURE : PAYER)", open: (id, done) => achPafFiche(id, null, done),
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
function achFafFiche(id, o, done) {
  o = o || {};
  const f0 = id ? achFaf().find(x => x.id === id) : null; if (id && !f0) return;
  const cmfLines = (c, fid) => { const R = achRcp(), T = achRtr(), F = achFaf();
    return (c.lignes || []).map(l => ({ cl: l.id, des: l.des, u: l.u, pu: achN(l.pu), tva: l.tva, q: Math.max(0, Math.round((achRecQ(c.id, l.id, R, T) - achFacQ(c.id, l.id, fid, F)) * 1000) / 1000) })).filter(l => l.q > 1e-9); };
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
    d.innerHTML = sviWinCard({ cls: "frs-card faf-card", close: "data-x", title: (f0 ? "FACTURE — " + esc(P.ref) : "NOUVELLE FACTURE") + " · " + esc(f0 ? achFafEtat(P) : "EN INSTANCE"),
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}</div>` : ""}<div class="frs-scroll">
        <div class="frs-sec"><div class="frs-g">
          <label class="frs-f frs-w"><span>FOURNISSEUR <b>*</b></span><select class="ins-in fa-x" data-k="frs"${dis || (f0 || C0 ? " disabled" : "")}><option value=""></option>${opt(FR.map(f => [f.id, f.code + " — " + f.nom]), P.frs)}</select></label>
          <label class="frs-f"><span>TYPE</span><select class="ins-in fa-x" data-k="type"${dis}>${opt([["normale", "FACTURE"], ["acompte", "FACTURE D'ACOMPTE"]], P.type)}</select></label>
          <label class="frs-f"><span>COMMANDE</span><select class="ins-in fa-x" data-k="cmf"${dis || (f0 || C0 ? " disabled" : "")}><option value="">SANS COMMANDE</option>${opt(CM.map(c => [c.id, c.ref]), P.cmf)}</select></label>
          <label class="frs-f"><span>N° DE LA FACTURE <b>*</b></span><input class="ins-in fa-x" data-k="num" value="${esc(P.num)}"${dis} autocomplete="off"></label>
          <label class="frs-f"><span>DATE DE LA FACTURE <b>*</b></span><input type="date" class="ins-in fa-x" data-k="dFac" value="${esc(P.dFac)}"${dis}></label>
          <label class="frs-f"><span>REÇUE LE</span><input type="date" class="ins-in fa-x" data-k="dRec" value="${esc(P.dRec)}"${dis}></label>
          <label class="frs-f"><span>ÉCHÉANCE ${P.ech ? "(SAISIE)" : "(CONDITIONS DU FOURNISSEUR)"}</span><input type="date" class="ins-in fa-x" data-k="ech" value="${esc(achFafEch(P))}"${dis}></label>
          <label class="frs-f frs-w"><span>COPIE DE LA FACTURE</span>${achCopyBtn(P, ro)}</label></div></div>
        <div class="frs-sec"><div class="frs-st">LIGNES ${svCnt(P.lignes.length)} ${C ? `<small>(REÇU − DÉJÀ FACTURÉ ; REMISE ${esc(String(achN(P.rem)).replace(".", ","))} %)</small>` : ""}</div>
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
    if (e.target.closest("[data-save]")) { pull(); if (!check()) return; await store(f0 || achFaf().some(x => x.id === P.id) ? "MODIFICATION" : "CRÉATION"); draw(); return; }
    if (e.target.closest("[data-bap]")) { pull(); if (!check()) return;
      const stop = achFafStop(P); if (stop.length) { svToast("BON À PAYER IMPOSSIBLE : " + stop.join(" · "), 5000); return; }
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
    d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: (a0 ? "AVOIR — " + esc(P.ref) : "NOUVEL AVOIR FOURNISSEUR") + (P.state === "annule" ? " · ANNULÉ" : ""),
      body: `<div class="frs-scroll"><div class="frs-sec"><div class="frs-g">
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
    const FR = achLive(achFrs()).filter(f => f.actif !== false || f.id === P.frs);
    const FA = achFaf().filter(f => f.frs === P.frs && f.state === "bap" && (achFafReste(f) > 0.005 || (P.aff || []).some(a => a.fa === f.id)));
    const AV = achAvf().filter(a => a.frs === P.frs && a.state !== "annule" && (achAvfReste(a) > 0.005 || (P.ded || []).some(x => x.av === a.id)));
    const CM = achCmf().filter(c => c.frs === P.frs && (c.state === "valide" || c.state === "instance") && c.avT);
    const opt = (L, v) => L.map(x => `<option value="${esc(x[0])}"${x[0] === v ? " selected" : ""}>${esc(x[1])}</option>`).join("");
    const mine = (L, k, id) => achN(((L || []).find(a => a[k] === id) || {}).m);
    d.innerHTML = sviWinCard({ cls: "frs-card paf-card", close: "data-x", title: (p0 ? "PAIEMENT — " + esc(P.ref) : "NOUVEAU PAIEMENT") + " · " + esc(ACH_PAF_ST[P.state] || ""),
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}</div>` : ""}
        ${fr && achFrsAttExp(fr) && P.state === "instance" ? `<div class="frs-why pa-att">⚠ ATTESTATION DE RÉGULARITÉ FISCALE EXPIRÉE : ${P.deb ? `PAIEMENT DÉBLOQUÉ PAR ${esc(P.deb.u || "?")} LE ${esc(achDFr(String(P.deb.t).slice(0, 10)))} — ${esc(P.deb.why || "")}` : `PAIEMENT BLOQUÉ <button type="button" class="ach-b" data-attdeb>DÉBLOQUER</button>`}</div>` : ""}<div class="frs-scroll">
        <div class="frs-sec"><div class="frs-g">
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
  d.addEventListener("change", e => { if (!e.target.closest(".pa-x, .pa-a, .pa-d")) return; const k = e.target.dataset.k; pull();
    if (k === "frs") { P.aff = []; P.ded = []; P.cmf = ""; delete P.deb; if (!p0) P.mode = modeOf(P.frs); } if (k === "type") { P.aff = []; P.ded = []; P.cmf = ""; P.mt = 0; }
    if (k === "cmf") { const C = achCmf().find(c => c.id === P.cmf); P.mt = C ? Math.max(0, Math.round((achCmfTot(C).av - achAvVerse(C.id)) * 100) / 100) : 0; }
    draw(); });
  d.addEventListener("click", async e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (done) done(); return; }
    if (e.target.closest("[data-save]")) { pull(); if (!check()) return; store(p0 || achPaf().some(x => x.id === P.id) ? "MODIFICATION" : "CRÉATION"); draw(); return; }
    if (e.target.closest("[data-valid]")) { pull(); if (!check()) return;
      const fr = achFrs().find(f => f.id === P.frs);
      if (fr && achFrsAttExp(fr) && !P.deb) { svToast("ATTESTATION DE RÉGULARITÉ FISCALE EXPIRÉE : PAIEMENT BLOQUÉ (DÉBLOQUER AVEC UN MOTIF).", 5000); draw(); return; }
      if ((P.mode === "VIREMENT" || P.mode === "PRÉLÈVEMENT") && fr && fr.ribChg) { svToast("RIB DU FOURNISSEUR MODIFIÉ : À VÉRIFIER (FICHE FOURNISSEUR, RIB VÉRIFIÉ) AVANT TOUT PAIEMENT.", 5000); return; }
      if ((P.mode === "VIREMENT" || P.mode === "PRÉLÈVEMENT") && fr && !achFrsRibP(fr)) { svToast("AUCUN RIB POUR CE FOURNISSEUR.", 3500); return; }
      if ((P.mode === "CHÈQUE" || P.mode === "LCN") && !P.num) { svToast("N° DU " + P.mode + " OBLIGATOIRE.", 3000); return; }
      if (P.mode === "LCN" && !P.echL) { svToast("ÉCHÉANCE DE LA LCN OBLIGATOIRE.", 3000); return; }
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
