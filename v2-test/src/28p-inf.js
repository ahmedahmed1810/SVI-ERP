/* =========================================================
   v869 : DÉCOUPE DU GRAND BLOC (programme, point 4) — INF sort de openBudgetDetail.
   Appelé depuis l'écran du budget (25-inf.js) avec ce dont il a besoin.
   ========================================================= */
/* 10/11 (série K) : le budget LIT son projet (fiche du module PROJETS) — client, marché (type de client, AO, objet), GPS du chantier et date butoir ;
   les lecteurs existants (bordereau, transport, planning) gardent INS.ao / INS.gps / INS.dbut, remplis ici depuis le projet, jamais saisis dans le budget */
const sviAchRaw = k => { try { const raw = localStorage.getItem(k); if (!raw) return []; const L = JSON.parse(SVI_LZ.dec(raw)); return Array.isArray(L) ? L : []; } catch (e) { return []; } };
function sviBdgPrjSync(budget, INS) { try {
  const code = String((budget && budget.project) || "").trim().toUpperCase(); if (!code) return;
  const P = sviAchRaw("svi_ach_prj_v1").find(x => !x.del && String(x.code || "").toUpperCase() === code); if (!P) return;
  const C = sviAchRaw("svi_ach_cli_v1").find(x => x.id === P.cli) || null;
  if (budget.inst) budget.inst.client = C ? C.nom : budget.inst.client || "";
  if (!INS) return;
  const A = INS.ao || {}; INS.ao = { ...A, pub: C && C.type ? C.type === "PUBLIC" : A.pub, cons: !!P.cons || (C && C.type === "PUBLIC"), num: P.aoNum || "", obj: P.aoObj || "" };
  INS.gps = P.gps || ""; const but = P.dbutCalc || P.butoir || ""; if (but) INS.dbut = but;
} catch (e) {} }
window.sviBdgPrjSync = sviBdgPrjSync;
function sviBdgInf(C) {
  { try { sviBdgPrjSync(C.budget, C.INS); } catch (e) {} }
  const { ECR, INS, INS_EDIT, attFormHTML, attRead, budget, dlyDeb, dlyFin, dlyKeys, docsLoad, fullRef, histLog, insCal, insDlyKey, insSave, insSelIds, insUnlinked, insVis, keepScroll, lines, nextRecRef, openExportMenu, printMetre, printTasks, recLoad, recSave, recSorted, ref, refreshAll, shell, updPill } = C;
  /* ===== INF : dates du projet (v452) — DÉBUT (modifiable : tout le planning se décale), FIN et DURÉE calculées,
     DATE OBJECTIF et DATE BUTOIR (déplacées depuis PARAMÉTRAGE) ===== */
  /* ===== INF (v457) : DÉBUT* (modifiable : tout le planning se décale), FIN DU PROJET* (= date objectif), DURÉE (calculée,
     jours du calendrier, en années / mois / jours), DATE BUTOIR* ; DATE CRÉATION* (date, heure) et PROJET* modifiables en instance ===== */
  const infProj = () => {
    const ks = dlyKeys().filter(k => dlyDeb(k) && dlyFin(k));
    const deb = INS.pdeb || ks.map(dlyDeb).sort()[0] || INS.gdeb || "", pfin = ks.map(dlyFin).sort().pop() || "";
    /* v546 (R30) : DATE DE FIN DU PROJET = fin du planning (plus de date objectif saisie) */
    return { ks, deb, pfin, fin: pfin };
  };
  const infDatesHTML = ed => {
    const P = infProj();
    const din = (f, v, extra = "") => ed ? `<input class="doc-in inf-date" type="date" data-f="${f}" value="${esc(v)}"${extra}>` : `<span class="doc-in doc-ro inf-val">${esc(dFr(v))}</span>`;
    return `<span class="doc-lab">DATE DE DÉBUT DU PROJET${STAR}</span>${din("deb", P.deb)}
      <span class="doc-lab" data-tip="FIN DU PLANNING">DATE DE FIN DU PROJET</span><span class="inf-cell"><span class="doc-in doc-ro inf-val" data-v="pfin0">${esc(dFr(P.fin))}</span><small class="inf-sub" data-v="pfin"></small></span>
      <span class="doc-lab" data-tip="VISÉE PAR GÉNÉRER / COMPRESSER">DATE OBJECTIF</span>${din("obj", INS.dobj || "")}
      <span class="doc-lab">DURÉE</span><span class="doc-in doc-ro inf-val" data-v="dur">${esc(infYMD(P.deb, P.fin))}</span>
      <span class="doc-lab">DATE BUTOIR${STAR}</span>${din("but", INS.dbut || "")}`;
  };
  /* v477 (remarque 5) : rien n'est retenu avant ENREGISTRER — les dates saisies vont dans pend, appliquées par infApply */
  const infDatesBind = (p, ed, pend) => {
    const cur = () => { const P = infProj(); return { deb: pend.deb ?? P.deb, fin: P.fin, obj: pend.obj ?? (INS.dobj || ""), but: pend.but ?? (INS.dbut || ""), pfin: P.pfin }; };
    const paint = () => {
      const P = cur();
      const d = p.querySelector('[data-v="dur"]'), pf = p.querySelector('[data-v="pfin"]');
      if (d) d.textContent = infYMD(P.deb, P.fin);
      if (pf) { pf.textContent = P.pfin && P.but && P.pfin > P.but ? "DÉPASSE LA DATE BUTOIR" : P.pfin && P.obj && P.pfin > P.obj ? "DÉPASSE LA DATE OBJECTIF" : ""; pf.classList.toggle("inf-late", !!(P.pfin && ((P.but && P.pfin > P.but) || (P.obj && P.pfin > P.obj)))); }
      const io = p.querySelector('[data-f="obj"]'), ib = p.querySelector('[data-f="but"]');
      if (io) { if (P.but) io.setAttribute("max", P.but); else io.removeAttribute("max"); if (P.deb) io.setAttribute("min", P.deb); }
      if (ib) ib.removeAttribute("min");
    };
    paint();
    if (!ed) return;
    p.querySelectorAll("input.inf-date").forEach(sviDateField);
    p.addEventListener("change", e => {
      const i = e.target.closest && e.target.closest("input.inf-date");
      if (!i) return;
      /* v902 (principe du 03/11/2026) : DATE OBJECTIF / DATE BUTOIR refusées dès la saisie (avant ENREGISTRER) — la case reprend sa valeur */
      if (i.dataset.f === "obj" || i.dataset.f === "but") {
        const P = cur(), nv = { ...P, [i.dataset.f]: i.value }, why = sviBdgDateWhy(i.dataset.f, nv.deb, nv.obj, nv.but);
        if (why) { i.value = P[i.dataset.f] || ""; svToast(why, 4500, i); return; }
      }
      pend[i.dataset.f] = i.value;
      paint();
    });
  };
  /* applique les dates d'INF (ENREGISTRER) : DÉBUT décale tout le planning, FIN DU PROJET (objectif), BUTOIR */
  const infApplyDates = (pend, anchor) => {
    /* v715 : DATE OBJECTIF saisie, entre le début du projet et la date butoir */
    if (pend.obj !== undefined && pend.obj !== (INS.dobj || "")) {
      const deb = pend.deb || infProj().deb, but = pend.but ?? (INS.dbut || "");
      if (pend.obj && ((deb && pend.obj < deb) || (but && pend.obj > but))) svToast("DATE OBJECTIF REFUSÉE : ENTRE LE DÉBUT DU PROJET ET LA DATE BUTOIR.", 4500, anchor);
      else { INS.dobj = pend.obj; histLog("INF", "DATE OBJECTIF", dFr(pend.obj) || "—"); } }
    /* v820 (cahier, à coder) : DATE BUTOIR refusée avant le début du projet ou avant la date objectif */
    if (pend.but !== undefined && pend.but !== (INS.dbut || "")) { const deb = pend.deb || infProj().deb, obj = pend.obj !== undefined ? pend.obj : (INS.dobj || "");
      if (pend.but && ((deb && pend.but < deb) || (obj && pend.but < obj))) svToast("DATE BUTOIR REFUSÉE : ELLE NE PEUT ÊTRE NI AVANT LE DÉBUT DU PROJET, NI AVANT LA DATE OBJECTIF.", 5000, anchor);
      else { INS.dbut = pend.but; histLog("INF", "DATE BUTOIR", dFr(pend.but) || "—"); } }
    if (pend.deb !== undefined && pend.deb) {
      const cal = insCal(), P = infProj(), v = pend.deb;
      const nv = sviWNear(cal, v, 1);
      const old = P.ks.map(dlyDeb).sort()[0] || P.deb;
      if (nv !== (INS.pdeb || "")) {
        INS.pdeb = nv; INS.gdeb = nv;
        if (P.ks.length && old && nv !== sviWNear(cal, old, 1)) {
          const from = sviWNear(cal, old, 1);
          const n = nv > from ? sviWDur(cal, from, nv) - 1 : -(sviWDur(cal, nv, from) - 1);
          P.ks.forEach(k => {
            (INS.dlp[k] || []).forEach(q => { if (!q.deb || !q.fin) return; const du = sviWDur(cal, q.deb, q.fin) || 1; q.deb = sviWAdd(cal, sviWNear(cal, q.deb, 1), n); q.fin = sviWFin(cal, q.deb, du); });
            if (ECR.LK.dlpDraft && ECR.LK.dlpDraft[k]) delete ECR.LK.dlpDraft[k];
          });
          histLog("INF", "PROJET DÉCALÉ", dFr(old) + " → " + dFr(nv) + " (" + (n > 0 ? "+" : "") + n + " J TRAVAILLÉS, " + P.ks.length + " TÂCHE(S))");
        } else histLog("INF", "DATE DE DÉBUT DU PROJET", dFr(nv));
        const P2 = infProj();
        if (INS.dbut && P2.pfin > INS.dbut) svToast("AVEC CE DÉCALAGE, LA FIN DU PLANNING (" + dFr(P2.pfin) + ") DÉPASSE LA DATE BUTOIR (" + dFr(INS.dbut) + ").", 6000, anchor);
      }
    }
  };
  /* champs d'INF à compléter (bouton ⚠ et FIGER) : étoile = exigé pour FIGER */
  const infMissing = () => {
    if (!INS) return [];
    const P = infProj(), out = [];
    const add = (lab, req) => out.push({ lab: "INF : " + lab, n: 1, go: "inf", req });
    if (!String(budget.project || "").trim()) add("PROJET", true);
    if (!budget.inst.created) add("DATE CRÉATION", true);
    if (!P.deb) add("DATE DE DÉBUT DU PROJET", true);
    /* v546 (R30) : DATE DE FIN DU PROJET calculée — n'est plus exigée */
    if (!INS.dbut) add("DATE BUTOIR (FICHE DU PROJET)", true);   /* série K : la date butoir et le client se lisent dans le projet */
    const it = String(budget.inst.intitule || "").trim();
    if (!it || it === "À COMPLÉTER") add("INTITULÉ", false);
    if (!String(budget.inst.client || "").trim()) add("CLIENT (FICHE DU PROJET)", false);
    return out;
  };
  /* v663 (axe 12) : marché — CLIENT PUBLIC / PRIVÉ, SUR CONSULTATION (cochée d'office pour un client public),
     N° D'APPEL D'OFFRES OU DE CONSULTATION et OBJET DU MARCHÉ (facultatifs) ; repris en tête du bordereau */
  const infAoHTML = ed => {
    const A = INS.ao || {}, dis = ed ? "" : " disabled";
    return `<span class="doc-lab">TYPE DE CLIENT</span><span class="inf-cell inf-ao">
        <label><input type="radio" name="infAoT" value="pub"${A.pub === true ? " checked" : ""}${dis}> PUBLIC</label>
        <label><input type="radio" name="infAoT" value="prv"${A.pub === false ? " checked" : ""}${dis}> PRIVÉ</label>
        <label class="inf-ao-c"><input type="checkbox" id="infAoC"${A.cons || A.pub === true ? " checked" : ""}${A.pub === true || !ed ? " disabled" : ""}> SUR CONSULTATION</label></span>
      <span class="doc-lab" data-tip="OU DE CONSULTATION">N° D'APPEL D'OFFRES</span>${ed ? `<input class="doc-in inf-int" id="infAoN" value="${esc(A.num || "")}" placeholder="${esc(fullRef)}" autocomplete="off">` : `<span class="doc-in doc-ro inf-val">${esc(A.num || "")}</span>`}
      <span class="doc-lab">OBJET DU MARCHÉ</span>${ed ? `<input class="doc-in inf-int" id="infAoO" value="${esc(A.obj || "")}" autocomplete="off">` : `<span class="doc-in doc-ro inf-val">${esc(A.obj || "")}</span>`}`;
  };
  /* ===== 10/11 (série K, K2) : EN-TÊTE DU BUDGET (fenêtre i) — sections pliables (10.8), 1re dépliée ; ce qui vient du PROJET se lit dans sa fiche,
     rien n'est recopié dans le budget (client, marché, GPS, dates du projet, date butoir : lus dans le projet par sviBdgPrjSync) ===== */
  const K2 = () => { INS.k2 = INS.k2 || {}; return INS.k2; };
  const k2Type0 = () => budget.inst.rclOf ? "RÉVISION" : budget.inst.parent ? "AVENANT" : "BUDGET D'EXÉCUTION";
  const k2Nat = () => budget.inst.virtual ? "CONSOLIDÉ" : budget.inst.rclOf ? "RECALAGE" : budget.inst.parent ? "AVENANT " + (budget.inst.avn || 1) : "INITIAL";
  const k2Coef = k => { const c = K2().coef || {}; return (1 + n0(c.fc) / 100) * (1 + n0(c.fg) / 100) * (1 + n0(c.al) / 100) * (1 + n0(c.mg) / 100); };
  function n0(v) { const x = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return isNaN(x) ? 0 : x; }
  /* déboursé sec par désignation (charges liées, comptées une fois — comme le SOUS-DÉTAIL DES PRIX) */
  const k2Sdp = () => { const seen = new Set(), M = new Map();
    (INS.links || []).forEach(l => (l.chg || []).forEach(x => { if (seen.has(x.id)) return; const r = (INS.chg || []).find(y => y.id === x.id); if (!r || r.t) return; seen.add(x.id); if (!M.has(l.des)) M.set(l.des, []); M.get(l.des).push(r); }));
    return (INS.des || []).filter(d => !d.t && M.has(d.id)).map(d => { const tot = M.get(d.id).reduce((t, r) => t + n0(r.q) * n0(r.p), 0), lq = insLinkedQ(INS, d.id), q = lq ? lq : n0(d.q); return { d, tot, q, du: q ? tot / q : 0 }; }); };   /* quantité liée nulle (liaison non primaire, sans produit) : quantité de la désignation */
  const openInfo = (focus) => {
    /* le budget lit son projet : la liste des projets (module PROJETS) doit être chargée */
    if (typeof achPrjSync !== "function" && typeof sviAchLoad === "function") { sviAchLoad().then(() => openInfo(focus)).catch(() => {}); return; }
    try { achPrjSync(); } catch (e) {}
    sviBdgPrjSync(budget, INS);
    const dt = typeof budgetDate === "function" ? budgetDate(ref) : null;
    const prd = lines.filter(l => l.kind === "prd"), chg = lines.filter(l => l.kind === "chg"), sum = (arr, f) => arr.reduce((t, l) => t + (f(l) || 0), 0);
    const prdHT = sum(prd, l => l.amount), prdTTC = sum(prd, l => l.ttcAmount), chgHT = sum(chg, l => l.amount);
    const editInt = !!(budget.inst && (budget.inst.state || "instance") === "instance"), ed = editInt && !!INS;
    const PR = typeof achPrj === "function" ? achPrj().filter(x => !x.del) : [], PJ = PR.find(x => String(x.code || "").toUpperCase() === String(budget.project || "").toUpperCase()) || null;
    let k = INS ? JSON.parse(JSON.stringify(K2())) : {}; const TY = () => k.type || k2Type0(); const SD = INS ? k2Sdp() : [], DS = SD.reduce((t, x) => t + x.tot, 0) || chgHT;
    const Kc = INS ? k2Coef() : 1, Kr = DS ? prdHT / DS : 0, PRV = DS * (INS ? (1 + n0((k.coef || {}).fc) / 100) * (1 + n0((k.coef || {}).fg) / 100) * (1 + n0((k.coef || {}).al) / 100) : 1);
    const P = INS ? infProj() : {}, today = new Date().toISOString().slice(0, 10), but = PJ ? PJ.dbutCalc || PJ.butoir || "" : INS && INS.dbut || "";
    const STB = { instance: "EN INSTANCE", fige: "FIGÉ", valide: "VALIDÉ", annule: "ANNULÉ" }[budget.inst.state || "instance"] || "";
    const ro = (lab, v, tip, dv) => `<span class="doc-lab"${tip ? ` data-tip="${esc(tip)}"` : ""}>${lab}</span><span class="doc-in doc-ro inf-val inf-calc"${dv ? ` data-k2v="${dv}"` : ""}>${esc(v ?? "")}</span>`;
    const inp = (id, lab, v, q = {}) => `<span class="doc-lab">${lab}${q.req ? STAR : ""}</span>${ed ? `<input class="doc-in inf-int k2-x" id="${id}" value="${esc(v ?? "")}"${q.num ? ' inputmode="decimal"' : ""}${q.ph ? ` placeholder="${esc(q.ph)}"` : ""} autocomplete="off">` : `<span class="doc-in doc-ro inf-val">${esc(v ?? "")}</span>`}`;
    const sel = (id, lab, opts, v, q = {}) => `<span class="doc-lab">${lab}${q.req ? STAR : ""}</span>${ed ? `<select class="doc-in k2-x" id="${id}"><option value="">—</option>${opts.map(o => { const a = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o; return `<option value="${esc(a)}"${String(v ?? "") === String(a) ? " selected" : ""}>${esc(t)}</option>`; }).join("")}</select>` : `<span class="doc-in doc-ro inf-val">${esc((opts.find(o => (Array.isArray(o) ? o[0] : o) === v) || [v, v])[1] ?? v ?? "")}</span>`}`;
    const PCOL = PJ ? (PJ.clot ? "valide" : PJ.arch ? "archive" : "instance") : "";
    const SECS = [
      ["id", "IDENTIFICATION", 5, () => `
        <span class="doc-lab">DATE DE CRÉATION${STAR}</span>${editInt ? `<input class="doc-in inf-cre" type="datetime-local" value="${esc((String(budget.inst.created || "").slice(0, 10) || ((dt && dt.key) || "")) + "T" + (String(budget.inst.created || "").slice(11, 16) || "00:00"))}">` : `<span class="doc-in doc-ro inf-val">${esc(budget.inst && budget.inst.created ? svDT(budget.inst.created) : (dt && dt.label) || "")}</span>`}
        <span class="doc-lab">PROJET${STAR}</span><span class="inf-cell k2-prj">${editInt ? `<select class="doc-in" id="infPrj">${PR.map(x => `<option value="${esc(x.code)}"${x === PJ ? " selected" : ""}>${esc(x.code + (x.intitule ? " — " + x.intitule : ""))}</option>`).join("")}${PJ ? "" : `<option value="${esc(budget.project || "")}" selected>${esc(budget.project || "")}</option>`}</select>` : ""}${PJ ? `<button type="button" class="ach-link k2-go lk-${PCOL}" data-k2prj="${esc(PJ.id)}">FICHE DU PROJET ${esc(PJ.code)}</button>` : ""}</span>
        ${inp("infInt", "INTITULÉ DU BUDGET", (() => { const v = sviIntitule(ref, budget.project, budget.inst); return v === "À COMPLÉTER" ? "" : v; })(), { ph: "À COMPLÉTER" })}
        ${sel("k2Lot", "LOT DU MARCHÉ", ((PJ && PJ.lots) || []).filter(x => x.no || x.intitule).map(x => [String(x.no || x.intitule), (x.no ? x.no + " — " : "") + (x.intitule || "")]), k.lot)}
        ${inp("k2Ana", "CODE ANALYTIQUE", k.analyt || "", { ph: (PJ && PJ.analyt) || "REPRIS DU PROJET" })}`],
      ["typ", "TYPE ET VERSION", 5, () => `
        ${sel("k2Type", "TYPE", ["BUDGET DE SOUMISSION", "BUDGET D'EXÉCUTION", "AVENANT", "RÉVISION"], TY())}
        ${TY() === "AVENANT" ? sel("k2Avn", "AVENANT N°", ((PJ && PJ.avn) || []).filter(x => x.no).map(x => [String(x.no), x.no + (x.objet ? " — " + x.objet : "")]), k.avn || String(budget.inst.avn || "")) : ""}
        ${sel("k2Ref", "BUDGET DE RÉFÉRENCE", sviInstGet().filter(b => !b.del && b.ref !== ref && String(b.project || "").toUpperCase() === String(budget.project || "").toUpperCase()).map(b => [b.ref, b.ref + (b.intitule && b.intitule !== "À COMPLÉTER" ? " — " + b.intitule : "")]), k.ref || budget.inst.parent || "")}
        ${TY() === "RÉVISION" ? inp("k2Mot", "MOTIF DE LA RÉVISION", k.motif || "") : ""}
        ${ro("ANCIENNE NATURE", k2Nat(), "AVANT LA SÉRIE K ; CONSOLIDÉ RESTE UN ÉTAT, LES VERSIONS RESTENT DANS RÉVISIONS")}`],
      ["et", "ÉTAT ET VALIDATION", 6, () => { const I = budget.inst, w = (d, u) => (d ? svDT(d) : "—") + (u ? " — " + u : "");
        return `${ro("ÉTAT", budget.inst.virtual ? "CONSOLIDÉ" : STB)}${ro("ÉTABLI PAR", I.by || I.user || "—")}${ro("SOUMIS LE / PAR", w(I.submitted, I.subBy))}${ro("VALIDÉ LE / PAR", w(I.validated, I.valBy))}${ro("FIGÉ LE / PAR", w(I.figed || I.fige, I.figeBy))}`; }],
      ["dat", "DATES ET DURÉES", 6, () => `
        <span class="doc-lab" data-tip="VISÉE PAR GÉNÉRER / COMPRESSER">DATE OBJECTIF</span>${editInt ? `<input class="doc-in inf-date" type="date" data-f="obj" value="${esc(INS.dobj || "")}">` : `<span class="doc-in doc-ro inf-val">${esc(dFr(INS.dobj || ""))}</span>`}
        <span class="doc-lab" data-tip="LU DANS LE PLANNING DU BUDGET (DÉTAIL › DÉLAIS) ; LE CHANGER DÉCALE TOUT LE PLANNING">DÉBUT DU BUDGET${STAR}</span>${editInt ? `<input class="doc-in inf-date" type="date" data-f="deb" value="${esc(P.deb || "")}">` : `<span class="doc-in doc-ro inf-val">${esc(dFr(P.deb || ""))}</span>`}
        <span class="doc-lab" data-tip="FIN DU PLANNING">FIN DU BUDGET</span><span class="inf-cell"><span class="doc-in doc-ro inf-val inf-calc" data-v="pfin0">${esc(dFr(P.fin))}</span><small class="inf-sub" data-v="pfin"></small></span>
        ${ro("DURÉE", infYMD(P.deb, P.fin))}${ro("DURÉE ÉCOULÉE", P.deb && P.deb <= today ? infYMD(P.deb, today < P.fin || !P.fin ? today : P.fin) : "—")}
        ${ro("DATE BUTOIR DU PROJET", dFr(but) || "—", "LUE DANS LA FICHE DU PROJET")}
        ${INS.dobj && but && INS.dobj > but ? `<div class="inf-note inf-late k2-wide">⚠ LA DATE OBJECTIF DÉPASSE LA DATE BUTOIR DU PROJET.</div>` : ""}`],
      ["coef", "COEFFICIENTS DE PRIX", 6, () => { const c = k.coef || {};
        return `${inp("k2Fc", "FRAIS DE CHANTIER (%)", c.fc ?? "", { num: 1 })}${inp("k2Fg", "FRAIS GÉNÉRAUX (%)", c.fg ?? "", { num: 1 })}${inp("k2Al", "ALÉAS / IMPRÉVUS (%)", c.al ?? "", { num: 1 })}${inp("k2Mg", "MARGE (%)", c.mg ?? "", { num: 1 })}
        ${ro("COEFFICIENT K (COEFFICIENTS)", Kc.toFixed(4).replace(".", ","), "K = (1 + FRAIS DE CHANTIER) × (1 + FRAIS GÉNÉRAUX) × (1 + ALÉAS) × (1 + MARGE)", "kc")}${ro("K RÉEL (PRIX ÷ DÉBOURSÉ SEC)", Kr ? Kr.toFixed(4).replace(".", ",") : "—", "POUR INFORMATION")}
        ${ed ? `<span class="doc-lab"></span><span class="inf-cell"><button type="button" class="doc-btn k2-propose">PROPOSER LES PRIX AVEC K</button></span>` : ""}`; }],
      ["mt", "MONTANTS", 5, () => `${ro("DÉBOURSÉ SEC", money(DS))}${ro("PRIX DE REVIENT", money(PRV), "DÉBOURSÉ SEC × FRAIS DE CHANTIER × FRAIS GÉNÉRAUX × ALÉAS", "prv")}${ro("MONTANT HT", money(prdHT))}${ro("TVA", money(prdTTC - prdHT))}${ro("MONTANT TTC", money(prdTTC))}`],
      ["ctl", "CONTRÔLE DES DÉPENSES", 3, () => `${inp("k2Seuil", "SEUIL DE VALIDATION (%)", k.seuil ?? 90, { num: 1 })}${ro("DEVISE", (PJ && PJ.devise) || "MAD", "REPRISE DU PROJET")}${inp("k2Taux", "TAUX DE CHANGE", k.taux ?? "", { num: 1, ph: "FIGÉ À LA VALIDATION" })}
        <div class="inf-note k2-wide">AU-DELÀ DU SEUIL (PAR CHARGE OU POUR TOUT LE BUDGET), OU QUAND LE RAPPORT CHARGES / PRODUITS RÉALISÉ DÉPASSE CELUI DU BUDGET, UNE COMMANDE PASSE PAR LA VALIDATION D'UN SUPÉRIEUR (JAMAIS BLOQUÉE).</div>`]
    ];
    const OPEN = new Set([focus === "ao" ? "id" : focus || "id"]);
    const p = sviPopNew();
    const body = () => `${budget.inst && budget.inst.virtual && budget.inst.vname ? `<div class="inf-note">${esc(budget.inst.vname)} : PHOTO EN LECTURE SEULE — FILTRES, TRIS, APERÇUS ET EXPORTS PERMIS ; MENU ⋯ : RESTAURER CETTE VERSION, EN FAIRE UN SCÉNARIO.</div>` : ""}
          ${budget.inst && budget.inst.rclOf ? `<div class="inf-note">RECALAGE R${esc(budget.inst.rcn)} DE ${esc(budget.inst.rclOf)} — ${budget.inst.state === "valide" ? "ENREGISTRÉ : LECTURE SEULE." : "EN COURS : DÉSIGNATIONS CLIENT ET PRIX EN LECTURE SEULE ; 🔒 = ENREGISTRER LE RECALAGE."}</div>` : ""}
          ${SECS.filter(x => INS || x[0] === "id").map(([sk, t, n, f]) => { const on = OPEN.has(sk); return `<div class="frs-sec cp-fsec${on ? " on" : ""}" data-s="${sk}"><button type="button" class="frs-st cp-st" data-k2sec="${sk}"><span class="cp-ar">${on ? "⌄" : "›"}</span>${t} ${svCnt(n)}</button><div class="cp-body"${on ? "" : " hidden"}><div class="doc-grid inf-grid">${f()}</div></div></div>`; }).join("")}`;
    p.innerHTML = `
      <div class="doc-card cp-card k2-card" role="dialog" aria-modal="true">
        <div class="doc-head"><span class="doc-title">${esc(fullRef)}</span><button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button></div>
        <div class="doc-body">${body()}</div>
        <div class="doc-foot">${editInt ? `<button type="button" class="doc-btn" data-cancel>ANNULER</button><button type="button" class="doc-btn doc-save inf-save">ENREGISTRER</button>` : `<button type="button" class="doc-btn doc-save" data-cancel>FERMER</button>`}</div>
      </div>`;
    sviPopShow(p);
    popEnhance(p, "inf");
    const pend = {};
    if (INS) infDatesBind(p, editInt, pend);
    const up = i => i.addEventListener("input", e => { if (e.target.tagName !== "INPUT" || e.target.inputMode === "decimal") return; const c = e.target.selectionStart; e.target.value = e.target.value.toUpperCase(); try { e.target.setSelectionRange(c, c); } catch (err) {} });
    p.querySelectorAll("#infInt, .k2-x").forEach(up);
    const v = id => { const i = p.querySelector("#" + id); return i ? String(i.value || "").trim().toUpperCase() : undefined; };
    const collect = () => { const out = { ...pend }, cd = p.querySelector("input.inf-cre");
      const pj = p.querySelector("#infPrj"); if (pj) out.project = pj.value.trim().toUpperCase();
      const ii = p.querySelector("#infInt"); if (ii) out.intitule = ii.value.trim().toUpperCase();
      if (cd) out.created = cd.value ? cd.value.slice(0, 10) + "T" + (cd.value.slice(11, 16) || "00:00") : "";
      if (INS) { const c0 = K2(), nk = { ...c0 }; const set = (f, id) => { const x = v(id); if (x !== undefined) nk[f] = x; };
        set("lot", "k2Lot"); set("analyt", "k2Ana"); set("type", "k2Type"); set("avn", "k2Avn"); set("ref", "k2Ref"); set("motif", "k2Mot"); set("seuil", "k2Seuil"); set("taux", "k2Taux");
        const cf = { ...(c0.coef || {}) }; [["fc", "k2Fc"], ["fg", "k2Fg"], ["al", "k2Al"], ["mg", "k2Mg"]].forEach(([f, id]) => { const x = v(id); if (x !== undefined) cf[f] = x; }); nk.coef = cf; out.k2 = nk; }
      return out; };
    const changed = o => (o.project !== undefined && o.project !== String(budget.project || ""))
      || (o.intitule !== undefined && o.intitule !== String(budget.inst.intitule === "À COMPLÉTER" ? "" : budget.inst.intitule || "").trim().toUpperCase())
      || (o.created !== undefined && o.created && o.created !== String(budget.inst.created || "")) || ["deb", "obj"].some(f => o[f] !== undefined)
      || (o.k2 && JSON.stringify(o.k2) !== K2BASE);
    /* type changé : seule la section TYPE ET VERSION est redessinée (les autres saisies restent en place) */
    const redrawTyp = () => { const o = collect(); if (o.k2) k = o.k2; const g = p.querySelector('.cp-fsec[data-s="typ"] .doc-grid'); if (g) { g.innerHTML = SECS.find(x => x[0] === "typ")[3](); g.querySelectorAll(".k2-x").forEach(up); try { popEnhance(p, "inf"); } catch (e) {} } };
    const save = () => {
      const o = collect();
      if (o.project !== undefined && !o.project) { svToast("PROJET OBLIGATOIRE.", 3000, p.querySelector("#infPrj")); return false; }
      const patch = {};
      if (o.project !== undefined && o.project !== String(budget.project || "")) { budget.project = o.project; budget.inst.project = o.project; patch.project = o.project; const h1 = $("refTxt"); if (h1) h1.textContent = o.project + " " + ref; histLog("INF", "PROJET", o.project); sviBdgPrjSync(budget, INS); patch.client = budget.inst.client || ""; }
      if (o.created && o.created !== String(budget.inst.created || "")) { budget.inst.created = o.created; patch.created = o.created; histLog("INF", "DATE CRÉATION", o.created.replace("T", " À ")); }
      if (o.intitule !== undefined && o.intitule !== String(budget.inst.intitule === "À COMPLÉTER" ? "" : budget.inst.intitule || "").trim().toUpperCase()) { budget.inst.intitule = o.intitule || "À COMPLÉTER"; patch.intitule = budget.inst.intitule; histLog("INF", "INTITULÉ", budget.inst.intitule); }
      if (Object.keys(patch).length) sviInstSet(sviInstGet().map(x => x.ref === ref ? { ...x, ...patch } : x));
      if (INS && o.k2) { const a = JSON.stringify(K2()); INS.k2 = o.k2; if (a !== JSON.stringify(o.k2)) histLog("INF", "EN-TÊTE DU BUDGET", "TYPE " + (o.k2.type || k2Type0()) + (o.k2.lot ? ", LOT " + o.k2.lot : "") + ", SEUIL " + (o.k2.seuil || 90) + " %"); }
      if (INS) { infApplyDates(pend, p.querySelector(".doc-foot")); insSave(); }
      try { keepScroll(() => refreshAll()); } catch (e) {}
      try { document.title = (budget.project || "") + " " + (fullRef || ""); } catch (e) {}
      return true;
    };
    const K2BASE = JSON.stringify(collect().k2 || null);
    /* K et PRIX DE REVIENT recalculés à la saisie des coefficients */
    p.addEventListener("input", e => { if (!e.target.closest("#k2Fc, #k2Fg, #k2Al, #k2Mg")) return; const g = id => n0((p.querySelector("#" + id) || {}).value), a = (1 + g("k2Fc") / 100) * (1 + g("k2Fg") / 100) * (1 + g("k2Al") / 100);
      const kc = p.querySelector('[data-k2v="kc"]'), pr = p.querySelector('[data-k2v="prv"]'); if (kc) kc.textContent = (a * (1 + g("k2Mg") / 100)).toFixed(4).replace(".", ","); if (pr) pr.textContent = money(DS * a); });   /* état à l'ouverture : FERMER sans rien changer ne demande rien */
    p.addEventListener("change", e => { if (e.target.closest("#k2Type")) redrawTyp(); });
    p.addEventListener("click", async e => {
      const sc = e.target.closest("[data-k2sec]"); if (sc) { const sec = sc.closest(".cp-fsec"), on = !sec.classList.contains("on"); sec.classList.toggle("on", on); sec.querySelector(".cp-body").hidden = !on; sc.querySelector(".cp-ar").textContent = on ? "⌄" : "›"; return; }
      const go = e.target.closest("[data-k2prj]"); if (go) { if (typeof achPrjFiche === "function") achPrjFiche(go.dataset.k2prj, () => {}); return; }
      if (e.target.closest(".k2-propose")) { const o = collect(); const c = o.k2.coef || {}, Kx = (1 + n0(c.fc) / 100) * (1 + n0(c.fg) / 100) * (1 + n0(c.al) / 100) * (1 + n0(c.mg) / 100);
        const T = k2Sdp().filter(x => !(n0(x.d.p) > 0) && x.du > 0);
        if (!T.length) { svToast("AUCUNE DÉSIGNATION SANS PRIX AVEC DES CHARGES LIÉES.", 3500); return; }
        if (!(await svConfirm({ title: "PROPOSER LES PRIX AVEC K", text: T.length + " DÉSIGNATION(S) SANS PRIX : PRIX = DÉBOURSÉ SEC UNITAIRE × " + Kx.toFixed(4).replace(".", ",") + ". LES PRIX DÉJÀ SAISIS NE CHANGENT PAS.", ok: "PROPOSER", tone: "neutral" }))) return;
        INS.k2 = o.k2; T.forEach(x => { x.d.p = Math.round(x.du * Kx * 100) / 100; }); histLog("INF", "PRIX PROPOSÉS AVEC K", T.length + " DÉSIGNATION(S), K = " + Kx.toFixed(4)); insSave(); try { keepScroll(() => refreshAll()); } catch (er) {} svToast(T.length + " PRIX PROPOSÉ(S).", 2500); return; }
      if (e.target.closest(".inf-save")) { if (save()) { p.remove(); svToast("ENREGISTRÉ.", 1800); } return; }
      if (!(e.target === p || e.target.closest("[data-cancel]"))) return;
      if (editInt && changed(collect())) {
        const r = await svChoose({ title: "MODIFICATIONS NON ENREGISTRÉES", text: "ENREGISTRER LES MODIFICATIONS ?", buttons: [{ v: "drop", label: "ABANDONNER", tone: "danger" }, { v: "save", label: "ENREGISTRER", tone: "neutral" }] });
        if (!r) return;
        if (r === "save" && !save()) return;
      }
      p.remove();
    });
  };

  /* fenêtre centrée : observations marquées « ! » */
  const openObsAlert = () => {
    const list = recSorted("obs").filter(r => r.important);
    const p = sviPopNew();
    p.innerHTML = `
      <div class="doc-card" role="dialog" aria-modal="true">
        <div class="doc-head">
          <span class="doc-title">OBSERVATIONS IMPORTANTES — ${esc(fullRef)} ${svCnt(list.length)}</span>
          <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
        </div>
        <div class="doc-body">
          <div class="obs-alert-list">
            ${list.map(r => `
              <div class="obs-alert-item">
                <span class="obs-alert-meta">⚠ ${esc(r.ref)} — ${esc(fmtDT(r.date))}</span>
                <span class="obs-alert-text">${esc(r.text)}</span><span class="obs-alert-more">▾</span>
              </div>`).join("") || `<div class="obs-alert-text">Aucune observation importante.</div>`}
          </div>
        </div>
        <div class="doc-foot">
          <button type="button" class="doc-btn doc-save" data-cancel>FERMER</button>
        </div>
      </div>`;
    sviPopShow(p);
    popEnhance(p, "alert");
    obsAlertWire(p);
    p.addEventListener("click", e => {
      if (e.target === p || e.target.closest("[data-cancel]")) p.remove();
    });
  };

  /* ouvrir un document gardé sur l'appareil */
  const openDoc = i => {
    const d = docsLoad()[i];
    if (d && !d.idb && !d.data && d.drive) { openGoogleLink(d.drive, window.open("", "_blank")); return; }
    if (d && d.idb) {
      /* fenêtre ouverte tout de suite (sinon bloquée par Safari), fichier ensuite */
      const w = window.open("", "_blank");
      sviFiles.get(d.idb).then(blob => {
        if (!blob) { w && w.close(); sviAlert("Document non disponible sur cet appareil."); return; }
        const url = URL.createObjectURL(blob);
        if (w) w.location.href = url; else download(d.name, blob);
      }).catch(e => { w && w.close(); sviAlert("Ouverture impossible : " + e.message); });
      return;
    }
    if (!d || !d.data) { sviAlert("Document non disponible sur cet appareil."); return; }
    try {
      const [meta, b64] = d.data.split(",");
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
      const blob = new Blob([arr], { type: (meta.match(/data:([^;]+)/) || [])[1] || d.type || "" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (!w) download(d.name, blob);
    } catch (e) { sviAlert("Ouverture impossible : " + e.message); }
  };

  const openRecForm = kind => {
    const now = new Date();
    let recRef = nextRecRef(kind, now);
    const tafObj = "";

    const fieldsHTML = kind === "obs" ? `
        <div class="doc-grid doc-grid-2">
          <label class="doc-lab" for="recDate">DATE CRÉATION <b>*</b></label>
          <div class="doc-row">
            <input id="recDate" class="doc-in" type="datetime-local" value="${localDT(now)}">
            <button type="button" class="doc-flag" id="recFlag" title="Observation importante">!</button>
          </div>
          <label class="doc-lab" for="recText">INTITULÉ <b>*</b></label>
          <textarea id="recText" class="doc-in doc-ta" placeholder="INTITULÉ"></textarea>
          ${attFormHTML()}
        </div>` : `
        <div class="doc-grid">
          <label class="doc-lab" for="recDate">DATE CRÉATION <b>*</b></label>
          <input id="recDate" class="doc-in" type="datetime-local" value="${localDT(now)}">
          <label class="doc-lab" for="recObj">OBJET TAF</label>
          <input id="recObj" class="doc-in" type="text" value="${esc(tafObj)}">

          <label class="doc-lab" for="recText">DESCRIPTIF TAF <b>*</b></label>
          <textarea id="recText" class="doc-in doc-ta doc-ta-s" placeholder="DESCRIPTIF TAF"></textarea>
          <label class="doc-lab" for="recResp">RESPONSABLE <b>*</b></label>
          <input id="recResp" class="doc-in" type="text" placeholder="RESPONSABLE" autocomplete="off">

          <label class="doc-lab" for="recPDate">DATE PRÉVUE TRAITEMENT <b>*</b></label>
          <input id="recPDate" class="doc-in" type="date" value="${localDT(now).slice(0, 10)}">
          <label class="doc-lab" for="recPTime">HEURE PRÉVUE TRAITEMENT <b>*</b></label>
          <input id="recPTime" class="doc-in" type="time" value="${localDT(now).slice(11)}">

          <label class="doc-lab">DÉLAI TRAITEMENT PLANIFIÉ</label>
          <input id="recDelay" class="doc-in doc-ro" type="text" value="0:00" readonly>
          <label class="doc-lab">DURÉE ÉCOULÉE</label>
          <input id="recElapsed" class="doc-in doc-ro" type="text" value="0:00" readonly>
          ${attFormHTML()}
        </div>`;

    const p = sviPopNew();
    p.innerHTML = `
      <div class="doc-card" role="dialog" aria-modal="true">
        <div class="doc-head">
          <span class="doc-title"><span id="recRef">${esc(recRef)}</span></span>
          <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
        </div>
        <div class="doc-body">
          ${fieldsHTML}
          <div id="recErr" class="doc-err"></div>
        </div>
        <div class="doc-foot">
          <button type="button" class="doc-btn" data-cancel>ANNULER</button>
          <button type="button" class="doc-btn doc-save" id="recSave">ENREGISTRER</button>
        </div>
      </div>`;
    sviPopShow(p);
    popEnhance(p, kind);
    setTimeout(() => p.querySelector("#recText")?.focus(), 50);

    const close = () => { clearInterval(timer); p.remove(); };
    p.addEventListener("click", e => {
      if (e.target === p || e.target.closest("[data-cancel]")) close();
    });

    const $p = id => p.querySelector("#" + id);
    $p("recFlag")?.addEventListener("click", e => e.currentTarget.classList.toggle("on"));

    /* TAF : délai planifié = prévu − création ; durée écoulée = maintenant − création */
    const updTimes = () => {
      if (kind !== "taf") return;
      const c = new Date($p("recDate").value);
      const plan = new Date($p("recPDate").value + "T" + ($p("recPTime").value || "00:00"));
      $p("recDelay").value = hm(plan - c);
      $p("recElapsed").value = hm(Date.now() - c);
    };
    const timer = setInterval(updTimes, 30000);
    updTimes();
    ["recPDate", "recPTime"].forEach(id => $p(id)?.addEventListener("input", updTimes));

    $p("recDate").addEventListener("change", e => {
      const d = new Date(e.target.value);
      if (!isNaN(d)) {
        recRef = nextRecRef(kind, d);
        $p("recRef").textContent = recRef;
      }
      updTimes();
    });

    /* v903 (principe du 03/11/2026 : erreur refusée dès la saisie) : intitulé / descriptif déjà pris = refusé en quittant la case ;
       ENREGISTRER grisé tant qu'une case obligatoire est vide (le toucher dit lesquelles) */
    const recReq = () => kind === "obs" ? [["recDate", "date"], ["recText", "intitulé"]]
      : [["recDate", "date"], ["recText", "descriptif"], ["recResp", "responsable"], ["recPDate", "date prévue"], ["recPTime", "heure prévue"]];
    const recLive = () => { const miss = recReq().filter(([id]) => !String(($p(id) || {}).value || "").trim()); $p("recSave").classList.toggle("off", miss.length > 0); };
    p.addEventListener("input", recLive); p.addEventListener("change", e => {
      recLive();
      if (e.target && e.target.id === "recText") { const dupR = findDup(recLoad(kind), r => r.text, e.target.value);
        e.target.classList.toggle("bad", !!dupR);
        $p("recErr").textContent = dupR ? (kind === "obs" ? "Cet intitulé" : "Ce descriptif") + " existe déjà (" + dupR.ref + ")." : "";
        if (dupR) { svToast((kind === "obs" ? "CET INTITULÉ" : "CE DESCRIPTIF") + " EXISTE DÉJÀ (" + dupR.ref + ").", 3500, e.target); } }
    });
    setTimeout(recLive, 0);
    $p("recSave").addEventListener("click", () => {
      const req = kind === "obs"
        ? [["recDate", "date"], ["recText", "intitulé"]]
        : [["recDate", "date"], ["recText", "descriptif"], ["recResp", "responsable"],
           ["recPDate", "date prévue"], ["recPTime", "heure prévue"]];
      const miss = [];
      p.querySelectorAll(".doc-in, .dt-native").forEach(x => x.classList.remove("bad"));
      req.forEach(([id, lab]) => {
        if (!String($p(id).value).trim()) { miss.push(lab); $p(id).classList.add("bad"); }
      });
      if (miss.length) {
        $p("recErr").textContent = "À COMPLÉTER (*) : " + miss.join(", ").toUpperCase() + ".";
        return;
      }
      const dupR = findDup(recLoad(kind), r => r.text, $p("recText").value);
      if (dupR) {
        $p("recText").classList.add("bad");
        $p("recErr").textContent = (kind === "obs" ? "Cet intitulé" : "Ce descriptif") +
          " existe déjà (" + dupR.ref + ").";
        return;
      }
      const rec = kind === "obs"
        ? { ref: recRef, date: $p("recDate").value, text: $p("recText").value.trim(),
            important: $p("recFlag").classList.contains("on") }
        : { ref: recRef, date: $p("recDate").value, objet: $p("recObj").value.trim(),
            text: $p("recText").value.trim(), responsable: $p("recResp").value.trim(),
            prevu: $p("recPDate").value + "T" + $p("recPTime").value };
      const at = attRead(); if (at) rec.att = at;   /* v719 : chemin des ronds */
      const list = recLoad(kind);
      list.push(rec);
      recSave(kind, list);
      histLog(kind.toUpperCase(), "CRÉATION", rec.ref + " — " + (rec.text || "") +
        (rec.important ? " (IMPORTANTE)" : "") + (rec.responsable ? " — " + rec.responsable : ""));
      close();
      updPill(kind);
    });
  };

  /* agrandir un bloc : il occupe tout l'écran sous l'en-tête figé */
  /* budget ouvert par un balayage depuis un bloc agrandi : même bloc agrandi (l'onglet ouvert est déjà gardé) */
  setTimeout(() => { const b = window.__sviPendingMax; if (!b) return; window.__sviPendingMax = ""; const pg = shell.querySelector(".bdg-d-page"); if (pg && !pg.classList.contains("max-" + b)) toggleMax(b); }, 0);
  const toggleMax = blk => {
    const page = shell.querySelector(".bdg-d-page");
    const cls = "max-" + blk;
    const on = !page.classList.contains(cls);
    page.classList.remove("max-client", "max-hier", "max-detail", "max-rec", "max-suivi", "max-scn", "max-ver", "max-rcl", "max-etp");
    shell.querySelectorAll(".blk-rec").forEach(b =>
      b.classList.toggle("blk-rec-on", on && b.dataset.rec === blk));
    if (on && ["suivi", "scn", "ver", "rcl", "etp"].includes(blk)) page.classList.add("max-rec");
    if (on) {
      const head = shell.querySelector(".bdg-d-sticky");
      const avail = window.innerHeight - (head ? head.offsetHeight : 0) - 40;
      page.style.setProperty("--avail", Math.max(260, avail) + "px");
      page.classList.add(cls);
      const top = page.getBoundingClientRect().top + window.scrollY -
        (head ? head.offsetHeight : 0);
      window.scrollTo(0, Math.max(0, top));
    }
    shell.querySelectorAll(".blk-max-btn").forEach(b =>
      b.classList.toggle("on", on && b.dataset.blk === blk)
    );
  };

  /* DÉTAIL PRODUITS : choix du format avant aperçu ou export */
  const chooseFormat = act => {
    const p = sviPopNew();
    p.innerHTML = `
      <div class="doc-card" role="dialog" aria-modal="true" style="max-width:520px">
        <div class="doc-head">
          <span class="doc-title">${act === "export" ? "EXPORTER" : "APERÇU"} — DÉTAIL PRODUITS</span>
          <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
        </div>
        <div class="doc-body">
          <div class="fmt-choice">
            <button type="button" class="doc-btn fmt-btn" data-fmt="metre">FORMAT MÉTRÉ</button>
            <button type="button" class="doc-btn fmt-btn" data-fmt="interne">FORMAT INTERNE</button>
          </div>
        </div>
        <div class="doc-foot"><button type="button" class="doc-btn" data-cancel>ANNULER</button></div>
      </div>`;
    sviPopShow(p);
    p.addEventListener("click", e => {
      const f = e.target.closest("[data-fmt]");
      if (f) {
        p.remove();
        const metre = f.dataset.fmt === "metre";
        if (act === "export") openExportMenu(metre ? "metre" : "interne");
        else if (metre) printMetre();
        else printTasks("prd");
        return;
      }
      if (e.target === p || e.target.closest("[data-cancel]")) p.remove();
    });
  };

  /* budget en instance : lignes cochées d'un bloc (les cases servent à supprimer, exporter, aperçu) */
  const insBlkKinds = blk => blk === "client" ? ["des"] : blk === "hier" ? ["lot", "prim", "sec"]
    : blk === "detail" && ["chg", "prd", "qlt"].includes(ECR.active) ? [ECR.active]
    : blk === "detail" && ECR.active === "unl" ? ["des", "lot", "prim", "sec", "chg", "prd"] : [];
  /* ✕ DÉLIER LES LIGNES COCHÉES (menu ⋯) : liaisons qui contiennent une ligne cochée (et affichée) du bloc ;
     produits / charges cochés : retirés de leurs liaisons ; LIAISONS VALIDÉES : liaisons cochées */
  const insUnlPlan = blk => {
    if (!INS || !INS_EDIT) return null;
    const L = INS.links || [];
    /* bloc détail : tous ses onglets (FORMAT 104) — liaisons cochées (délier en entier) + produits / charges cochés (retirés) */
    if (blk === "detail") {
      const vi = ECR.active === "lnk" && ECR.lastShown.detail && ECR.lastShown.detail.kind === "lnk" ? new Set(ECR.lastShown.detail.rows.map(l => l.id)) : null;
      const whole = L.filter(l => l.on === true && (!vi || vi.has(l.id)));
      const sp = insSelIds("prd"), sc = insSelIds("chg");
      const remP = [...sp].filter(id => L.some(l => (l.prd || []).some(x => x.id === id)));
      const remC = [...sc].filter(id => L.some(l => (l.chg || []).some(x => x.id === id)));
      const hit = L.filter(l => whole.includes(l) || (l.prd || []).some(x => remP.includes(x.id)) || (l.chg || []).some(x => remC.includes(x.id)));
      return { mode: "del", links: hit, remP, remC, whole: new Set(whole.map(l => l.id)), n: hit.length };
    }
    const ks = insBlkKinds(blk).filter(k => k !== "qlt");
    if (!ks.length) return null;
    const sel = {};
    ks.forEach(k => { sel[k] = insSelIds(k); });
    const remP = sel.prd ? [...sel.prd].filter(id => L.some(l => (l.prd || []).some(x => x.id === id))) : [];
    const remC = sel.chg ? [...sel.chg].filter(id => L.some(l => (l.chg || []).some(x => x.id === id))) : [];
    const hit = L.filter(l => ["des", "lot", "prim", "sec"].some(k => sel[k] && sel[k].has(l[k]))
      || (l.prd || []).some(x => remP.includes(x.id)) || (l.chg || []).some(x => remC.includes(x.id)));
    return { mode: "del", links: hit, remP, remC, n: hit.length };
  };
  /* suppression : seules les lignes cochées ET déliées partent ; une ligne liée n'est jamais proposée */
  const insDelPlan = blk => {
    const X = shell.__ins;
    const out = { del: {}, n: 0, kept: 0 };
    if (!X) return out;
    /* FORMAT 104 : bloc détail = lignes cochées de TOUS ses onglets (filtre de chaque onglet respecté) ;
       une ligne cochée dans deux onglets n'est comptée qu'une fois ; les lignes liées restent */
    if (blk === "detail") {
      const add = (k, id) => { (out.del[k] = out.del[k] || new Set()).add(id); };
      ["chg", "prd", "qlt"].forEach(k => {
        const vis = insVis(k);
        X.INS[k].forEach(r => { if (r.t || r.on !== true || !vis.has(r.id)) return; if (k !== "qlt" && X.isUsed(k, r.id)) out.kept++; else add(k, r.id); });
      });
      /* LIGNES NON LIÉES : ses lignes cochées des autres blocs (désignations, lots, activités) */
      const uv = ECR.active === "unl" && ECR.lastShown.detail && ECR.lastShown.detail.kind === "unl" ? new Set(ECR.lastShown.detail.rows.map(x => x.k + "|" + x.id)) : null;
      const un = insUnlinked();
      ["des", "lot", "prim", "sec", "chg", "prd"].forEach(k => (un[k] || []).forEach(r => { if (r.uon === true && !r.t && (!uv || uv.has(k + "|" + r.id))) add(k, r.id); }));
      /* IMPORT NON CRÉÉ */
      const vi = ECR.active === "inc" && ECR.lastShown.detail && ECR.lastShown.detail.kind === "inc" ? new Set(ECR.lastShown.detail.rows.map(x => x.id)) : null;
      (INS.inc || []).forEach(x => { if (x.on === true && (!vi || vi.has(x.id))) add("inc", x.id); });
      /* DÉTAIL DÉLAIS : périodes cochées */
      const Y = shell.__insDly;
      if (Y && Y.draft) Object.values(Y.draft()).forEach(l => l.forEach(p => { if (p.on === true) add("dly", p.id); }));
      /* PLANNING : tâches cochées ; une tâche liée reste (règle G) */
      if (Y && Y.linked) (shell.__dlySel || new Set()).forEach(k => { if (Y.linked(k)) out.kept++; else add("plan", k); });
      out.n = Object.values(out.del).reduce((t, S) => t + S.size, 0);
      return out;
    }
    /* IMPORT NON CRÉÉ : les lignes cochées de l'onglet (les données déjà importées restent) */
    /* DÉTAIL DÉLAIS : périodes cochées (le brouillon de la liaison en cours) */
    if (blk === "detail" && ECR.active === "dly") {
      const Y = shell.__insDly, S = new Set(), P = new Set();
      if (Y && Y.draft) Object.values(Y.draft()).forEach(l => l.forEach(p => { if (p.on === true) S.add(p.id); }));
      /* PLANNING : tâches cochées ; une tâche liée reste (règle G) */
      if (Y && !insDlyKey()) (shell.__dlySel || new Set()).forEach(k => { if (Y.linked(k)) out.kept++; else P.add(k); });
      if (S.size) out.del.dly = S;
      if (P.size) out.del.plan = P;
      out.n = S.size + P.size;
      return out;
    }
    if (blk === "detail" && ECR.active === "inc") { const vi = new Set(ECR.lastShown.detail && ECR.lastShown.detail.kind === "inc" ? ECR.lastShown.detail.rows.map(x => x.id) : []);
      const ids = new Set((INS.inc || []).filter(x => x.on === true && vi.has(x.id)).map(x => x.id)); if (ids.size) { out.del.inc = ids; out.n = ids.size; } return out; }
    const unlTab = blk === "detail" && ECR.active === "unl";
    insBlkKinds(blk).forEach(k => {
      /* onglet LIGNES NON LIÉES : seulement ses lignes (non liées), titres compris */
      const vu = unlTab ? new Set((ECR.lastShown.detail && ECR.lastShown.detail.kind === "unl" ? ECR.lastShown.detail.rows : []).filter(x => x.k === k).map(x => x.id)) : insVis(k);
      const rows = unlTab ? X.INS[k].filter(r => r.uon === true && vu.has(r.id) && !X.isUsed(k, r.id)) : X.INS[k].filter(r => !r.t && r.on === true && vu.has(r.id));
      const free = rows.filter(r => !X.isUsed(k, r.id));
      out.kept += rows.length - free.length;
      const ids = new Set(free.map(r => r.id));
      /* un titre part avec sa branche quand toute sa branche part */
      if (k === "des") X.INS.des.forEach(t => { if (t.t) { const b = X.insBranch(t);
        if (b.length && b.every(r => ids.has(r.id))) ids.add(t.id);
        /* titre vide coché : supprimé lui aussi (et compté) */
        else if (!b.length && t.on === true && !unlTab) { ids.add(t.id); out.n++; } } });
      if (ids.size) { out.del[k] = ids; out.n += free.length; }
    });
    return out;
  };
  /* détail d'un compteur de lignes cochées par bloc : « 5 CHARGES + 42 PRODUITS » */
  const DEL_LAB = { des: ["DÉSIGNATION", "DÉSIGNATIONS"], lot: ["LOT", "LOTS"], prim: ["ACTIVITÉ PRIMAIRE", "ACTIVITÉS PRIMAIRES"], sec: ["ACTIVITÉ SECONDAIRE", "ACTIVITÉS SECONDAIRES"], chg: ["CHARGE", "CHARGES"], prd: ["PRODUIT", "PRODUITS"],
    qlt: ["LIGNE QUALITÉ", "LIGNES QUALITÉ"], inc: ["LIGNE D'IMPORT NON CRÉÉ", "LIGNES D'IMPORT NON CRÉÉ"], dly: ["DÉLAI", "DÉLAIS"], plan: ["TÂCHE DU PLANNING", "TÂCHES DU PLANNING"] };
  const insDelSplit = pl => Object.keys(pl.del || {}).filter(k => DEL_LAB[k] && pl.del[k].size).map(k => pl.del[k].size + " " + DEL_LAB[k][pl.del[k].size > 1 ? 1 : 0]).join(" + ");
  const insDelRun = blk => {
    const X = shell.__ins;
    const pl = insDelPlan(blk);
    if (!pl.n) return;
    if (blk === "detail" && X) {
      svConfirm({ title: "SUPPRIMER LES LIGNES COCHÉES",
        text: pl.n + " LIGNE(S) SERONT SUPPRIMÉES : " + insDelSplit(pl) + "." + (pl.del.inc ? " (IMPORT NON CRÉÉ : LES DONNÉES DÉJÀ IMPORTÉES RESTENT.)" : "") + (pl.kept ? " " + pl.kept + " LIGNE(S) LIÉE(S) RESTENT." : ""), ok: "SUPPRIMER" }).then(go => {
        if (!go) return;
        Object.keys(pl.del).forEach(k => {
          if (k === "inc") { INS.inc = (INS.inc || []).filter(x => !pl.del.inc.has(x.id)); return; }
          if (k === "dly") { const D = shell.__insDly.draft(); Object.keys(D).forEach(t => { D[t] = D[t].filter(p => !pl.del.dly.has(p.id)); }); return; }
          if (k === "plan") { shell.__insDly.removeTasks([...pl.del.plan]); return; }
          X.INS[k] = X.INS[k].filter(x => !pl.del[k].has(x.id));
        });
        histLog("SAISIE", "LIGNES SUPPRIMÉES", pl.n + " LIGNE(S) — " + insDelSplit(pl));
        X.cleanLinks(); X.insSave(); refreshAll();
      });
      return;
    }
    if (pl.del.dly) { shell.__insDlyDel && shell.__insDlyDel(); return; }
    if (!X) return;
    if (pl.del.inc) {
      svConfirm({ title: "EFFACER LES LIGNES D'IMPORT", text: pl.n + " LIGNE(S) EFFACÉE(S) DE L'ONGLET IMPORT NON CRÉÉ. LES DONNÉES DÉJÀ IMPORTÉES RESTENT.", ok: "EFFACER" }).then(go => {
        if (!go) return;
        INS.inc = (INS.inc || []).filter(x => !pl.del.inc.has(x.id));
        histLog("IMPORT", "LIGNES NON CRÉÉES EFFACÉES", pl.n + " LIGNE(S)");
        insSave(); refreshAll();
      });
      return;
    }
    svConfirm({ title: "SUPPRIMER LES LIGNES COCHÉES",
      text: pl.n + " LIGNE(S) SERONT SUPPRIMÉES" + (Object.keys(pl.del).length > 1 ? " : " + insDelSplit(pl) : "") + "." + (pl.kept ? " " + pl.kept + " LIGNE(S) LIÉE(S) RESTENT." : ""), ok: "SUPPRIMER" }).then(go => {
      if (!go) return;
      Object.keys(pl.del).forEach(k => {
        X.INS[k] = X.INS[k].filter(x => !pl.del[k].has(x.id));
        histLog("SAISIE", "LIGNES SUPPRIMÉES", pl.del[k].size + " LIGNE(S)");
      });
      X.cleanLinks(); X.insSave();
      /* v523 (remarque 4) : TOUS les tableaux et listes redessinés — les lignes cochées supprimées ne filtrent plus les autres blocs */
      refreshAll();
    });
  };
  /* export / aperçu : s'il y a des lignes cochées dans le bloc, seulement celles-là */
  const insOnlyChecked = blk => {
    const X = shell.__ins;
    if (!X || !ECR.lastShown) return;
    if (blk === "client" && ECR.lastShown.client && ECR.lastShown.client.ins) {
      const on = new Set(X.INS.des.filter(r => !r.t && r.on === true).map(r => r.id));
      if (!on.size) return;
      const keep = new Set();
      X.INS.des.forEach(t => { if (t.t && X.insBranch(t).some(r => on.has(r.id))) keep.add(t.id); });
      ECR.lastShown.client = { ...ECR.lastShown.client, rows: ECR.lastShown.client.rows.filter(r => on.has(r.id) || keep.has(r.id)) };
    } else if (blk === "hier" && ECR.lastShown.hier) {
      ["lot", "prim", "sec"].forEach(k => {
        const vis = insVis(k);
        const on = X.INS[k].filter(r => r.on === true && vis.has(r.id));
        if (on.length) ECR.lastShown.hier[k] = on.map(r => r.v || "");
      });
    } else if (blk === "detail" && ECR.lastShown.detail && ECR.lastShown.detail.ins) {
      const rows = ECR.lastShown.detail.rows.filter(r => r.on === true);
      if (rows.length) ECR.lastShown.detail = { ...ECR.lastShown.detail, rows };
    }
  };
  return { infMissing, openInfo, chooseFormat, insBlkKinds, insDelPlan, insDelRun, insDelSplit, insOnlyChecked, insUnlPlan, openDoc, openObsAlert, openRecForm, toggleMax };
}
