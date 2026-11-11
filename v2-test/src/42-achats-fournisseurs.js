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
    ["freq", "FRÉQUENCE", f => achFrsFreq(f).lab, "center"]];
  const W0 = { code: 92, nom: 260, forme: 140, ville: 130, ice: 150, rib: 130, cond: 130, fam: 90, cte: 90, note: 90, occ: 100, actif: 70 };
  const cwF = k => (cwLoad()["ach_frs." + k]) || W0[k] || 100;
  const cellIn = (f, k) => {
    const ro = !!f.del;
    if (k === "code") return `<button type="button" class="ach-link" data-fiche="${esc(f.id)}" title="Ouvrir la fiche">${esc(f.code)}</button>`;
    if (k === "freq") return `<span>${esc(achFrsFreq(f).lab || "—")}</span>`;
    if (k === "occ" || k === "actif") { const on = k === "occ" ? !!f.occ : f.actif !== false; return `<input type="checkbox" class="ach-ck frs-ck" data-f="${k}"${on ? " checked" : ""}${ro ? " disabled" : ""}>`; }
    if (k === "rib") { const r = achFrsRibP(f); return r ? `<button type="button" class="ach-link" data-fiche="${esc(f.id)}" data-sec="rib">${esc(ribTxt(r))}</button>` : `<span class="ach-0">—</span>`; }
    if (k === "fam" || k === "cte") { const n = (f[k] || []).length; return `<button type="button" class="ach-link" data-fiche="${esc(f.id)}" data-sec="${k}">${n}</button>`; }
    if (k === "note") { const n = achFrsNote(f); return n === null ? `<span class="ach-0">—</span>` : `<span>${esc(String(Math.round(n * 10) / 10).replace(".", ","))}</span>`; }
    const v = k === "ice" ? achDig(f.ice) : f[k] || "";
    return `<input class="ins-in ach-in frs-in${k === "ice" ? " center" : ""}" data-f="${k}" value="${esc(k === "ice" ? sviMaskFmt("ice", v) : v)}"${k === "ice" ? ' inputmode="numeric" data-mask="ice"' : ""}${k === "forme" || k === "cond" ? ` data-sug="${k}"` : ""}${ro ? " readonly" : ""} autocomplete="off" enterkeyhint="next">`;
  };
  const html = () => {
    const all = achFrs(), rows0 = all.filter(f => fOk(f, fEtat));
    const cols = coOrder("ach_frs", FRS_COLS()), rows = cfApply("ach_frs", cols, rows0);
    const nDel = all.filter(f => f.del).length, nSel = [...SEL].filter(id => rows0.some(f => f.id === id)).length;
    const W = cols.reduce((s, c) => s + cwF(c[0]), 0) + 44 + 46, corb = fEtat === "corbeille";
    return `<div class="ach-tools">
        <button type="button" class="ach-b ach-etat" data-a="frs-etat">${(F_ETATS.find(x => x[0] === fEtat) || F_ETATS[0])[1]} ▾ ${svCnt(rows.length, rows0.length)}</button>
        ${corb ? `<button type="button" class="ach-b" data-a="frs-restore"${nSel ? "" : " disabled"}>RESTAURER LES COCHÉS ${svCnt(nSel)}</button><button type="button" class="ach-b" data-a="frs-back">‹ RETOUR AUX FOURNISSEURS</button>`
          : `<button type="button" class="ach-b" data-a="frs-del"${nSel ? "" : " disabled"}>SUPPRIMER LES COCHÉS ${svCnt(nSel)}</button>
             <button type="button" class="ach-b" data-a="frs-trash"${nDel ? "" : " disabled"}>CORBEILLE ${svCnt(nDel)}</button>`}
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
      if (!A.length || !(await svConfirm({ title: "SUPPRIMER LES FOURNISSEURS COCHÉS", ok: "SUPPRIMER", html: `<ul class="svc-list">${A.map(f => `<li>${esc(f.code + " — " + f.nom)}</li>`).join("")}</ul><div class="svc-sub">RESTAURABLES DEPUIS LA CORBEILLE ; LEURS NUMÉROS NE SERONT PAS RÉUTILISÉS.</div>`, ok: "METTRE À LA CORBEILLE" }))) return true;
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
    let v = k === "ice" ? sviMaskRaw(t.value) : achU(t.value);
    if (k === "nom" && !v) { svToast("NOM OBLIGATOIRE (POUR RETIRER LE FOURNISSEUR : LE COCHER PUIS SUPPRIMER).", 3500, t); draw(); return true; }
    if (k === "ice" && v && !achIceOk(v)) { svToast(achIceMsg() + ".", 3500, t); draw(); return true; }
    if (k === "ice" && v) { const d = achFrsDupIce(L, v, f.id); if (d) { svToast("ICE DÉJÀ UTILISÉ PAR " + d.code + " — " + d.nom + ".", 4000, t); draw(); return true; } }
    if (k === "forme" && v && !ACH_FORMES.includes(v)) { svToast("FORME JURIDIQUE : CHOISIR DANS LA LISTE (" + ACH_FORMES.join(", ") + ").", 4500, t); draw(); return true; }
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
/* v912 (checklist : évaluations sorties du i) : NOUVELLE ÉVALUATION depuis la page du fournisseur (menu ⋯ › ÉVALUATIONS) ;
   la liste des évaluations est le bloc ÉVALUATIONS de la page. Critères : nom + note de 0 à 10 (note refusée dès la saisie hors de 0 à 10) */
function achFrsEvalWin(id, done) {
  const L = achFrs(), f = L.find(x => x.id === id); if (!f) return;
  if (f.del) { svToast("FOURNISSEUR SUPPRIMÉ : LECTURE SEULE.", 3000); return; }
  const d = sviWinNew();
  d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: "NOUVELLE ÉVALUATION — " + esc(f.nom || ""),
    body: `<table class="prm-table frs-sub frs-ecrit"><thead><tr><th>CRITÈRE</th><th>NOTE (0 À 10)</th></tr></thead><tbody>${[0, 1, 2, 3, 4].map(i => `<tr><td><input class="ins-in frs-ed" data-i="${i}" value="${["QUALITÉ", "DÉLAIS", "PRIX", "SERVICE", ""][i]}" autocomplete="off"></td><td><input class="ins-in frs-en number" data-i="${i}" inputmode="decimal" autocomplete="off"></td></tr>`).join("")}</tbody></table>`,
    foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button>` });
  sviWinShow(d);
  d.addEventListener("change", e => { const i = e.target.closest && e.target.closest(".frs-en"); if (!i) return; const s = String(i.value).trim(), n = achN(s);
    if (s && (!sviNumOk(s) || n < 0 || n > 10)) { i.value = ""; svToast("NOTE : DE 0 À 10.", 3000, i); } });
  d.addEventListener("click", e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
    if (!e.target.closest("[data-ok]")) return;
    const crit = [...d.querySelectorAll(".frs-ed")].map(i => { const ni = d.querySelector(`.frs-en[data-i="${i.dataset.i}"]`), s = String((ni || {}).value || "").trim(); return { d: achU(i.value), s, n: Math.max(0, Math.min(10, achN(s))) }; }).filter(c => c.d && c.s !== "").map(({ d: dd, n }) => ({ d: dd, n }));
    if (!crit.length) { svToast("ÉVALUATION : AU MOINS UN CRITÈRE (NOM ET NOTE).", 3000); return; }
    const L2 = achFrs(), f2 = L2.find(x => x.id === id); if (!f2) { d.remove(); return; }
    f2.evl = f2.evl || []; f2.evl.push({ date: new Date().toISOString(), crit, moy: crit.reduce((t, c) => t + c.n, 0) / crit.length }); f2.mod = new Date().toISOString();
    achFrsSave(L2); achHist(f2.code, "ÉVALUATION", crit.map(c => c.d + " " + c.n).join(", "));
    d.remove(); if (done) done();
  });
}
function achFrsFiche(id, sec, done) {
  const L0 = achFrs(), f0 = L0.find(x => x.id === id); if (!f0) return;
  const F = JSON.parse(JSON.stringify(f0)), ro = !!f0.del, P = achPrm();   /* v922 : figé (vert) = lecture seule, comme le budget (REVENIR EN INSTANCE pour modifier) */
  F.type = achFrsTypeLab(F); F.grp = achFrsGrpId(F);   /* B41 : un ancien groupe (sous-traitant, organisme financier) devient le type ; le groupe devient LOCAL */
  ["ribs", "docf", "cte", "evl", "cgf", "fam", "cau", "jours", "tar", "fermJ", "refs"].forEach(k => { if (!Array.isArray(F[k])) F[k] = []; });
  if (!Array.isArray(F.cla)) F.cla = achClCopy(P.clG);
  /* 05/11 : un article dont le TYPE est un champ de la fiche prend sa valeur (ou la donne au champ vide) */
  F.cla.forEach(x => { if (x.u === undefined) x.u = achCltU(x.t); if (x.v === undefined) x.v = ""; const k = achCltFld(x.t); if (!k) return; if (F[k] !== "" && F[k] !== undefined && F[k] !== null) x.v = String(F[k]); else if (x.v !== "") F[k] = ACH_CLT_NUM.includes(k) ? achN(x.v) : x.v; });
  const claSnap = () => JSON.stringify(F.cla.map(x => [x.t, x.txt || "", String(x.v ?? ""), x.u || ""]));
  let syncC = [], syncF = {}; const syncMark = () => { syncC = F.cla.map(x => String(x.v ?? "")); syncF = {}; F.cla.forEach(x => { const k = achCltFld(x.t); if (k) syncF[k] = String(F[k] ?? ""); }); };
  { const Q = achFrsPlafs(F); F.plafT = Q.dh; F.plafP = Q.pct; F.plafU = "DH"; }   /* 05/11 : deux plafonds */
  /* B39 : les anciens E-MAIL DE COMMANDE / DE FACTURATION deviennent des contacts qui reçoivent ces pièces */
  [["mailCmd", "cmf"], ["mailFac", "faf"]].forEach(([k, p]) => { const m = String(F[k] || "").trim().toLowerCase(); if (!m) return; let c = F.cte.find(x => String(x.email || "").toLowerCase() === m);
    if (!c) { c = { nom: "", fonction: "", role: "", tel: "", email: m, rec: [] }; F.cte.push(c); } c.rec = [...new Set([...(c.rec || []), p])]; F[k] = ""; });   /* B29 : fournisseur d'avant les clauses = clauses générales du modèle */
  const d = sviWinNew();
  const inp = (k, lab, o = {}) => `<label class="frs-f${o.w ? " frs-w" : ""}"><span>${lab}${o.req ? " <b>*</b>" : ""}</span><input class="ins-in frs-x" data-k="${k}"${o.mask ? ` data-mask="${o.mask}"` : ""} value="${esc(o.mask ? sviMaskFmt(o.mask, F[k] ?? "") : F[k] ?? "")}"${o.num ? ' inputmode="numeric"' : ""}${o.date ? ' type="date"' : ""}${o.keep ? " data-keepcase" : ""}${o.list ? ` list="frsL-${k}"` : ""}${ro ? " readonly" : ""} autocomplete="off">${o.list ? `<datalist id="frsL-${k}">${o.list.map(x => `<option value="${esc(x)}">`).join("")}</datalist>` : ""}</label>`;
  const sel = (k, lab, opts, o = {}) => `<label class="frs-f${o.w ? " frs-w" : ""}"><span>${lab}</span><select class="ins-in frs-xs" data-k="${k}"${ro || o.dis ? " disabled" : ""}><option value="">—</option>${opts.map(x => { const v = Array.isArray(x) ? x[0] : x, t = Array.isArray(x) ? x[1] : x; return `<option value="${esc(v)}"${String(F[k] ?? "") === String(v) ? " selected" : ""}>${esc(t)}</option>`; }).join("")}</select></label>`;
  const chk = (k, lab) => `<label class="frs-c"><input type="checkbox" class="frs-xc" data-k="${k}"${F[k] ? " checked" : ""}${ro ? " disabled" : ""}> ${lab}</label>`;
  const sub = (k, cols, add) => `<table class="prm-table frs-sub" data-sub="${k}"><thead><tr>${cols.map(c => `<th>${c[1]}</th>`).join("")}<th></th></tr></thead><tbody>
      ${F[k].map((r, i) => `<tr data-i="${i}">${cols.map(c => `<td>${c[2] ? c[2](r, i) : `<input class="ins-in frs-s" data-c="${c[0]}" value="${esc(r[c[0]] ?? "")}"${c[3] || ""}${ro ? " readonly" : ""} autocomplete="off">`}</td>`).join("")}<td class="center">${ro ? "" : `<button type="button" class="ach-x" data-rm="${k}|${i}" data-rml="${k}|${i}" title="Retirer">✕</button>`}</td></tr>`).join("") || `<tr><td colspan="${cols.length + 1}" class="empty">AUCUNE LIGNE</td></tr>`}
    </tbody></table>${ro ? "" : `<button type="button" class="ach-b frs-add" data-add="${k}" data-addl>+ ${add}</button>`}`;
  /* v801 : la fenêtre i a cinq onglets (checklist, fenêtre i du fournisseur, 02/11/2026) */
  const TABS = [["id", "IDENTITÉ", ["id", "cte"]], ["leg", "FISCAL ET LÉGAL", ["fisc", "qual", "secu", "docf"]], ["bq", "BANQUE ET PAIEMENT", ["rib", "cpt", "enc", "cau"]],
    ["ach", "CONDITIONS D'ACHAT", ["cond", "com", "imp", "ferm", "sav", "tar", "fam", "cgf", "cla"]], ["rsq", "RISQUE ET MOYENS", ["rsq", "moy", "refs"]], ["sim", "FOURNISSEURS SIMILAIRES", ["sim"]], ["stat", "STATISTIQUES", ["stat"]]];
  let tab = (TABS.find(t => t[2].includes(sec)) || TABS[0])[0];
  const draw = () => { syncMark();
    const why = achFrsWhy(F, achFrs()), note = achFrsNote(F);
    d.innerHTML = sviWinCard({ st: achPcSt("frs", f0), cls: "frs-card", close: "data-x", title: esc(F.nom || "") + " : " + esc(achFrsRef(F)),
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}${F.ribChg && !ro ? ` <button type="button" class="ach-b" data-ribok>RIB VÉRIFIÉ</button>` : ""}</div>` : ""}
        <div class="rec-tabs frs-tabs">${TABS.map(t => `<button type="button" class="rec-tab${t[0] === tab ? " active on" : ""}" data-ftab="${t[0]}">${t[1]}</button>`).join("")}</div>
        <div class="frs-scroll">
        <div class="frs-sec" data-s="id"><div class="frs-st">IDENTITÉ</div><div class="frs-g">
          ${inp("nom", "NOM", { req: 1, w: 1 })}${inp("denom", "DÉNOMINATION SOCIALE", { w: 1 })}${inp("forme", "FORME JURIDIQUE", { list: ACH_FORMES })}${inp("ville", "VILLE", { list: sviPgVilles().map(x => x.lab) })}
          ${(() => { const T = sviPgL("ftypes").map(t => [t.lab, t.lab + (t.pre ? " (" + t.pre + ")" : "")]); if (F.type && !T.some(t => t[0] === F.type)) T.push([F.type, F.type]);
            return sel("type", "TYPE DE FOURNISSEUR", T, { dis: achSt(f0) !== "instance" && !!(achFrsType(f0) || {}).pre }); })()}${inp("pays", "PAYS", { list: sviPgL("lieux").filter(x => !x.p).map(x => x.lab) })}${(() => { const L = sviLangues().slice(); if (F.lang && !L.includes(F.lang)) L.push(F.lang);
            return sel("lang", "LANGUE", [...L, ["__add", "AJOUTER…"]]); })()}
          ${inp("adresse", "ADRESSE", { w: 1 })}${inp("site", "SITE WEB", { keep: 1 })}${inp("resp", "RESPONSABLE INTERNE")}
          ${inp("origine", "ORIGINE (TROUVÉ COMMENT, RECOMMANDÉ PAR QUI)", { w: 1 })}
          ${sel("lie", "FOURNISSEUR LIÉ", achFrs().filter(x => !x.del && x.id !== id).map(x => [x.id, x.nom]))}${sel("lieT", "LIEN", ACH_FLIENS)}
          <div class="frs-f frs-w frs-logo"><span>LOGO</span><div>${F.logo ? `<img src="${esc(F.logo)}" alt="">` : ""}${ro ? "" : `<input type="file" accept="image/*" class="frs-logo-in">${F.logo ? ` <button type="button" class="ach-b" data-logorm>RETIRER LE LOGO</button>` : ""}`}</div></div>
          <label class="frs-f"><span data-tip="CALCULÉE D'APRÈS L'ÉCART MOYEN ENTRE LES COMMANDES (SEUILS : ACHATS › PARAMÈTRES › GÉNÉRAL)">FRÉQUENCE</span><input class="ins-in" value="${esc(achFrsFreq(f0).lab || "—")}" readonly></label></div></div>
        <div class="frs-sec" data-s="fisc"><div class="frs-st">FISCAL ET LÉGAL</div><div class="frs-g">
          ${inp("ice", "ICE", { req: (achFrsGrp(F).req || []).includes("ice"), num: 1, mask: "ice" })}${inp("ifisc", "IDENTIFIANT FISCAL", { num: 1, mask: "if" })}${inp("rc", "REGISTRE DE COMMERCE", { num: 1, mask: "rc" })}${inp("villeRc", "VILLE DU RC")}
          ${inp("patente", "PATENTE", { num: 1 })}${inp("capital", "CAPITAL (MAD)", { num: 1 })}
          ${inp("cnss", "N° CNSS", { num: 1, mask: "cnss" })}${inp("dateCrea", "DATE DE CRÉATION", { date: 1 })}${inp("dirigeant", "DIRIGEANT", { w: 1 })}
          ${F.forme === "AUTO-ENTREPRENEUR" ? `${inp("aeNo", "N° AUTO-ENTREPRENEUR", { num: 1 })}${inp("aeCin", "CIN DU TITULAIRE")}` : ""}</div></div>
        <div class="frs-sec" data-s="qual"><div class="frs-st">QUALIFICATION ET CERTIFICATIONS</div><div class="frs-g">
          ${inp("qualif", "QUALIFICATION (CERTIFICAT DU MINISTÈRE)", { w: 1 })}${inp("classe", "CLASSIFICATION")}${inp("effectif", "EFFECTIF", { num: 1 })}
          ${inp("certif", "CERTIFICATIONS (EX. ISO 9001)", { w: 1 })}</div></div>
        <div class="frs-sec" data-s="secu"><div class="frs-st">ASSURANCES, SÉCURITÉ ET CONDITIONS GÉNÉRALES</div><div class="frs-g">
          ${inp("cgaDate", "CONDITIONS GÉNÉRALES SIGNÉES LE", { date: 1 })}${inp("revue", "DERNIÈRE REVUE DE LA FICHE", { date: 1 })}
          <div class="frs-cs">${chk("assRc", "ASSURANCE RESPONSABILITÉ CIVILE")}${chk("secu", "RESPECTE LES RÈGLES DE SÉCURITÉ SUR CHANTIER")}${chk("cga", "CONDITIONS GÉNÉRALES D'ACHAT SIGNÉES ET ACCEPTÉES")}</div></div></div>
        <div class="frs-sec" data-s="cpt"><div class="frs-st">COMPTE COMPTABLE</div><div class="frs-g">${(() => { const CP = sviPgL("cpt"); /* B21 : choisi dans PARAMÉTRAGE GÉNÉRAL › COMPTABILITÉ */
            if (!CP.length) return inp("codeCpt", "CODE COMPTABLE", { num: 1 }) + inp("intCpt", "INTITULÉ COMPTABLE");
            const O = CP.map(c => [String(c.code), c.code + " — " + (c.lab || "")]); if (F.codeCpt && !O.some(o => o[0] === String(F.codeCpt))) O.push([String(F.codeCpt), F.codeCpt + " — " + (F.intCpt || "")]);
            return sel("codeCpt", "COMPTE COMPTABLE (PARAMÉTRAGE GÉNÉRAL › COMPTABILITÉ)", O, { w: 1 }); })()}</div></div>
        <div class="frs-sec" data-s="rib"><div class="frs-st">RIB ${svCnt(F.ribs.length)}</div>
          ${sub("ribs", [["bqId", "BANQUE", r => { const B = achBanks(), g = r.bqId || (achBankOfRib(r.rib) || {}).id || ""; return `<select class="ins-in frs-s" data-c="bqId"${ro ? " disabled" : ""}><option value="">—</option>${B.map(b => `<option value="${esc(b.id)}"${b.id === g ? " selected" : ""}>${esc(b.n)}</option>`).join("")}</select>`; }],
            ["ag", "AGENCE", r => { const g = r.bqId || (achBankOfRib(r.rib) || {}).id || "", A = g ? achAgences(g) : []; return `<select class="ins-in frs-s" data-c="ag"${ro || !A.length ? " disabled" : ""}><option value="">—</option>${A.map(a => `<option value="${esc(a.id)}"${a.id === r.ag ? " selected" : ""}>${esc(a.lab + (a.code ? " (" + a.code + ")" : ""))}</option>`).join("")}</select>`; }],
            ["rib", "RIB (24 CHIFFRES)", null, ' inputmode="numeric"'], ["ck", "CONTRÔLE", r => { const m = achRibBqWhy({ ...r, bqId: r.bqId || (achBankOfRib(r.rib) || {}).id || "" }); return m ? `<span class="ach-warn" title="${esc(m)}">⚠ ${esc(m)}</span>` : achRibOk(r.rib) ? "✓" : "—"; }],
            ["p", "PRINCIPAL", (r, i) => `<input type="radio" name="frsRibP" class="frs-rp" data-i="${i}"${r.p ? " checked" : ""}${ro ? " disabled" : ""}>`]], "AJOUTER UN RIB")}</div>
        <div class="frs-sec" data-s="enc"><div class="frs-st">ENCOURS ET ENCAISSEMENT</div><div class="frs-g">
          ${inp("plafEnc", "PLAFOND D'ENCOURS (MAD)", { num: 1 })}${inp("plafT", "PLAFOND DE TRANSACTIONS (12 MOIS, DH HT)", { num: 1 })}${inp("plafP", "PLAFOND DE TRANSACTIONS (% DES ACHATS)", { num: 1 })}<label class="frs-f"><span>ENCOURS ACTUEL</span><input class="ins-in" value="${esc(achF2(achFrsEnc(id)))}" readonly></label>
          ${inp("encNom", "PERSONNE AUTORISÉE À RETIRER LES CHÈQUES", { w: 1 })}
          <div class="frs-f frs-w"><span>JOURS DE PAIEMENT HABITUELS</span><div class="frs-cs">${ACH_JOURS.map(j => `<label class="frs-c"><input type="checkbox" class="frs-jr" value="${j}"${F.jours.includes(j) ? " checked" : ""}${ro ? " disabled" : ""}> ${j}</label>`).join("")}</div></div></div></div>
        <div class="frs-sec" data-s="cau"><div class="frs-st">CAUTIONS ET GARANTIES BANCAIRES REÇUES ${svCnt(F.cau.length)}</div>
          ${sub("cau", [["type", "TYPE", (r) => `<select class="ins-in frs-s" data-c="type"${ro ? " disabled" : ""}>${ACH_CAUT.map(x => `<option${x === r.type ? " selected" : ""}>${esc(x)}</option>`).join("")}</select>`], ["no", "N°"], ["bq", "BANQUE"],
            ["mt", "MONTANT", (r) => `<input class="ins-in frs-s number" data-c="mt" inputmode="decimal" value="${esc(r.mt ? achF2(r.mt) : "")}"${ro ? " readonly" : ""} autocomplete="off">`],
            ["ech", "ÉCHÉANCE", (r) => `<input type="date" class="ins-in frs-s" data-c="ech" value="${esc(r.ech || "")}"${ro ? " readonly" : ""}>`]], "AJOUTER UNE CAUTION")}</div>
        <div class="frs-sec" data-s="cond"><div class="frs-st">CONDITIONS DE PAIEMENT</div><div class="frs-g">${inp("cond", "CONDITIONS (DÉLAI)", { list: ACH_CONDS })}${sel("modeReg", "MODE DE RÈGLEMENT", ACH_MODES)}
          ${inp("escTaux", "ESCOMPTE (%)", { num: 1 })}${inp("escJours", "SI PAYÉ SOUS (JOURS)", { num: 1 })}
          ${inp("retTaux", "RETENUE DE GARANTIE (%)", { num: 1 })}<div class="frs-cs">${chk("retAcc", "RETENUE DE GARANTIE ACCEPTÉE")}</div></div></div>
        <div class="frs-sec" data-s="com"><div class="frs-st">COMMANDE ET LIVRAISON</div><div class="frs-g">
          ${inp("delai", "DÉLAI DE LIVRAISON (JOURS)", { num: 1 })}${sel("devise", "DEVISE", ACH_DEVISES)}${inp("minCmd", "MINIMUM DE COMMANDE", { num: 1 })}${inp("franco", "FRANCO DE PORT À PARTIR DE", { num: 1 })}
          ${inp("remise", "REMISE HABITUELLE (%)", { num: 1 })}${sel("envoi", "ENVOI DES COMMANDES", ACH_ENVOIS)}${sel("livr", "LIVRAISON", ACH_LIVR)}${inp("heuresLiv", "HEURES DE LIVRAISON")}
          ${inp("gps", "DÉPÔT : POSITION GPS (LATITUDE, LONGITUDE)", { w: 1, keep: 1 })}</div></div>
        <div class="frs-sec" data-s="imp"><div class="frs-st">IMPORT</div><div class="frs-g">${sel("incoterm", "INCOTERM", ACH_INCOTERMS)}${inp("transit", "TRANSITAIRE", { w: 1 })}</div></div>
        <div class="frs-sec" data-s="ferm"><div class="frs-st">FERMETURES</div><div class="frs-g">${inp("conges", "CONGÉS (PÉRIODES)", { w: 1 })}
          <div class="frs-f frs-w"><span>JOURS SANS LIVRAISON</span><div class="frs-cs">${ACH_JOURS.concat("DIM").map(j => `<label class="frs-c"><input type="checkbox" class="frs-fj" value="${j}"${F.fermJ.includes(j) ? " checked" : ""}${ro ? " disabled" : ""}> ${j}</label>`).join("")}</div></div></div></div>
        <div class="frs-sec" data-s="sav"><div class="frs-st">GARANTIE ET APRÈS-VENTE</div><div class="frs-g">${inp("garMois", "DURÉE DE GARANTIE (MOIS)", { num: 1 })}${inp("savContact", "CONTACT SAV", { w: 1 })}</div></div>
        <div class="frs-sec" data-s="tar"><div class="frs-st">TARIFS ${svCnt(F.tar.length)}</div>
          ${sub("tar", [["des", "DÉSIGNATION"], ["u", "UNITÉ"], ["pu", "PRIX", (r) => `<input class="ins-in frs-s number" data-c="pu" inputmode="decimal" value="${esc(r.pu ? achF2(r.pu) : "")}"${ro ? " readonly" : ""} autocomplete="off">`],
            ["valid", "VALABLE JUSQU'AU", (r) => `<input type="date" class="ins-in frs-s" data-c="valid" value="${esc(r.valid || "")}"${ro ? " readonly" : ""}>`]], "AJOUTER UN PRIX")}</div>
        <div class="frs-sec" data-s="fam"><div class="frs-st">FAMILLES D'ARTICLES FOURNIES ${svCnt(F.fam.length)}</div><div class="frs-fam">${P.cat.map(c => `<label class="frs-c"><input type="checkbox" class="frs-fc" value="${esc(c)}"${F.fam.includes(c) ? " checked" : ""}${ro ? " disabled" : ""}> ${esc(c)}</label>`).join("") || `<span class="ach-0">AUCUNE CATÉGORIE (ACHATS › PARAMÈTRES)</span>`}</div></div>
        <div class="frs-sec" data-s="docf"><div class="frs-st">DOCUMENTS FISCAUX ${svCnt(F.docf.length)}</div>
          ${sub("docf", [["type", "DOCUMENT", (r, i) => `<select class="ins-in frs-s" data-c="type"${ro ? " disabled" : ""}>${ACH_DOCF.map(x => `<option${x === r.type ? " selected" : ""}>${esc(x)}</option>`).join("")}</select>`], ["no", "N°"], ["exp", "EXPIRE LE", (r) => `<input type="date" class="ins-in frs-s" data-c="exp" value="${esc(r.exp || "")}"${ro ? " readonly" : ""}>`]], "AJOUTER UN DOCUMENT")}</div>
        <div class="frs-sec" data-s="cte"><div class="frs-st">CONTACTS ${svCnt(F.cte.length)}</div>
          ${sub("cte", [["nom", "NOM"], ["fonction", "FONCTION"], ["role", "RÔLE", (r) => `<select class="ins-in frs-s" data-c="role"${ro ? " disabled" : ""}><option value="">—</option>${ACH_CROLES.map(x => `<option${x === r.role ? " selected" : ""}>${esc(x)}</option>`).join("")}</select>`], ["tel", "TÉLÉPHONE", null, ' inputmode="tel" data-mask="tel"'], ["email", "E-MAIL", (r) => `<input class="ins-in frs-s" data-c="email" data-keepcase value="${esc(r.email || "")}" inputmode="email"${ro ? " readonly" : ""} autocomplete="off">`],
            ["rec", `<span data-tip="PIÈCES QUE CE CONTACT REÇOIT PAR E-MAIL : ${ACH_RECV.map(x => x[1] + " = " + x[2]).join(", ")} ; REPRIS PAR DÉFAUT SUR CHAQUE PIÈCE, MODIFIABLES POUR UNE PIÈCE PRÉCISE">REÇOIT</span>`, (r) => `<span class="frs-rcs">${ACH_RECV.map(([k, a, l]) => `<label class="frs-rc" title="${l}"><input type="checkbox" class="frs-rcb" value="${k}"${(r.rec || []).includes(k) ? " checked" : ""}${ro ? " disabled" : ""}>${a}</label>`).join("")}</span>`]], "AJOUTER UN CONTACT")}</div>
        <div class="frs-sec" data-s="rsq"><div class="frs-st">RISQUE</div><div class="frs-g">${sel("solva", "SOLVABILITÉ", ACH_SOLVA)}${sel("strat", "PLACE DU FOURNISSEUR", ACH_STRAT)}</div></div>
        <div class="frs-sec" data-s="moy"><div class="frs-st">MOYENS</div><div class="frs-g">${inp("camions", "NOMBRE DE CAMIONS", { num: 1 })}${inp("capJour", "LIVRAISON PAR JOUR (EX. 200 M3)")}${inp("materiel", "MATÉRIEL", { w: 1 })}</div></div>
        <div class="frs-sec" data-s="refs"><div class="frs-st">RÉFÉRENCES (CHANTIERS DÉJÀ LIVRÉS) ${svCnt(F.refs.length)}</div>
          ${sub("refs", [["chantier", "CHANTIER"], ["client", "CLIENT"], ["annee", "ANNÉE", null, ' inputmode="numeric"'],
            ["mt", "MONTANT", (r) => `<input class="ins-in frs-s number" data-c="mt" inputmode="decimal" value="${esc(r.mt ? achF2(r.mt) : "")}"${ro ? " readonly" : ""} autocomplete="off">`]], "AJOUTER UNE RÉFÉRENCE")}</div>
        <div class="frs-sec" data-s="evl"><div class="frs-st">ÉVALUATIONS ${svCnt(F.evl.length)}${note === null ? "" : " — MOYENNE " + esc(String(Math.round(note * 10) / 10).replace(".", ",")) + " / 10"}</div>
          ${F.evl.map((x, i) => `<div class="frs-evl">☆ ${esc(String(x.date || "").slice(0, 10).split("-").reverse().join("/"))} — <b>${esc(String(Math.round(achN(x.moy) * 10) / 10).replace(".", ","))} / 10</b> (${esc((x.crit || []).map(c => c.d + " " + c.n).join(", "))})${ro ? "" : ` <button type="button" class="ach-x" data-rm="evl|${i}">✕</button>`}</div>`).join("") || `<div class="ach-0">AUCUNE ÉVALUATION</div>`}
          ${ro ? "" : `<table class="prm-table frs-sub frs-ecrit"><thead><tr><th>CRITÈRE</th><th>NOTE (0 À 10)</th></tr></thead><tbody>${[0, 1, 2, 3, 4].map(i => `<tr><td><input class="ins-in frs-ed" data-i="${i}" placeholder="${["QUALITÉ", "DÉLAIS", "PRIX", "SERVICE", ""][i]}" autocomplete="off"></td><td><input class="ins-in frs-en" data-i="${i}" inputmode="decimal" autocomplete="off"></td></tr>`).join("")}</tbody></table><button type="button" class="ach-b frs-add" data-evladd>+ AJOUTER L'ÉVALUATION</button>`}</div>
        <div class="frs-sec" data-s="cgf"><div class="frs-st">CONTRATS ${svCnt(F.cgf.length)}</div>
          ${sub("cgf", [["intitule", "INTITULÉ"], ["debut", "DÉBUT", (r) => `<input type="date" class="ins-in frs-s" data-c="debut" value="${esc(r.debut || "")}"${ro ? " readonly" : ""}>`], ["fin", "FIN", (r) => `<input type="date" class="ins-in frs-s" data-c="fin" value="${esc(r.fin || "")}"${ro ? " readonly" : ""}>`]], "AJOUTER UN CONTRAT")}</div>
        ${(() => { const SP = achFrsSpec(f0), S = achFrsSim(f0); /* B33 : spécialité (catégories des articles vendus) et fournisseurs qui vendent les mêmes articles ou catégories */
          return `<div class="frs-sec" data-s="sim"><div class="frs-st">SPÉCIALITÉ</div><div class="bsn-note">${SP.length ? SP.map(esc).join(" · ") : "— (CATÉGORIES DES ARTICLES VENDUS, D'APRÈS SES DEVIS ET COMMANDES)"}</div>
            <div class="frs-st">FOURNISSEURS SIMILAIRES ${svCnt(S.length)}</div><table class="prm-table frs-sub frs-sim"><thead><tr><th>FOURNISSEUR</th><th class="center">ARTICLES COMMUNS</th><th>CATÉGORIES COMMUNES</th><th>FRÉQUENCE</th></tr></thead><tbody>
            ${S.map(s => `<tr><td>${esc(achFrsRef(s.f) + " — " + s.f.nom)}</td><td class="center" title="${esc(s.arts.map(k => k.replace("|", " (") + ")").join(", "))}">${s.arts.length}</td><td>${esc(s.cats.join(", "))}</td><td>${esc(achFrsFreq(s.f).lab || "—")}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">AUCUN</td></tr>`}</tbody></table></div>`; })()}
        ${(() => { const T = achFrsStats(f0), F2 = v => achF2(v); /* B43 : statistiques (les courbes viendront plus tard) */
          return `<div class="frs-sec" data-s="stat"><div class="frs-st">STATISTIQUES (12 DERNIERS MOIS)</div><div class="frs-g">
            <label class="frs-f"><span>FRÉQUENCE</span><input class="ins-in" value="${esc(T.freq.lab ? T.freq.lab + (T.freq.m !== undefined ? " (" + String(Math.round(T.freq.m * 10) / 10).replace(".", ",") + " MOIS ENTRE DEUX COMMANDES)" : "") : "—")}" readonly></label>
            <label class="frs-f"><span>COMMANDES (EN TOUT)</span><input class="ins-in" value="${T.n}" readonly></label><label class="frs-f"><span>ACHETÉ SUR 12 MOIS (HT)</span><input class="ins-in" value="${esc(F2(T.mt))}" readonly></label></div>
            <div class="frs-st">PARTS PAR ARTICLE ${svCnt(T.parts.length)}</div><table class="prm-table frs-sub frs-stat"><thead><tr><th>ARTICLE</th><th>U</th><th class="number">ACHETÉ ICI (HT)</th><th class="number">TOTAL ARTICLE (HT)</th><th class="number">PART</th><th class="center">FOURNISSEURS</th></tr></thead><tbody>
            ${T.parts.map(p => `<tr><td>${esc(p.des)}</td><td>${esc(p.u)}</td><td class="number">${esc(F2(p.mt))}</td><td class="number">${esc(F2(p.tot))}</td><td class="number">${esc(String(Math.round(p.pct)))} %</td><td class="center">${p.n}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">AUCUN ACHAT SUR 12 MOIS</td></tr>`}</tbody></table></div>`; })()}
        <div class="frs-sec" data-s="cla"><div class="frs-st ${F.claOk ? "" : "cla-inst"}">CLAUSES GÉNÉRALES D'ACHAT ${svCnt(F.cla.length)} — ${F.claOk ? "CONTRAT VALIDÉ LE " + esc(achDFr(F.claOk)) + ((F.claHist || []).length ? " (VERSION " + ((F.claHist || []).length + 1) + ")" : "") : "CONTRAT EN INSTANCE" + ((F.claHist || []).length ? " (NOUVELLE VERSION " + ((F.claHist || []).length + 1) + ")" : "")}</div>
          ${sub("cla", [["t", "TYPE", (r) => `<select class="ins-in frs-s" data-c="t"${ro ? " disabled" : ""}>${ACH_CLT.map(([k, l]) => `<option value="${k}"${k === r.t ? " selected" : ""}>${l}</option>`).join("")}</select>`], ["txt", "DÉSIGNATION"], ["v", "VALEUR"], ["u", "UNITÉ"]], "AJOUTER UN ARTICLE")}
          ${!ro && !F.claOk ? `<button type="button" class="ach-b" data-claok>VALIDER LE CONTRAT</button>` : ""}</div>
        </div>`,
      foot: `<button type="button" class="svc-b" data-x>${ro ? "FERMER" : "ANNULER"}</button>${ro ? "" : `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button>`}` });
    const on = (TABS.find(t => t[0] === tab) || TABS[0])[2];
    d.querySelectorAll(".frs-sec[data-s]").forEach(x => { x.hidden = !on.includes(x.dataset.s); });
    { const cd = d.querySelector(".frs-card"); if (cd) { cd.dataset.freq = achFrsFreq(f0).k || ""; cd.dataset.grp = achFrsGrpId(F); } }   /* 05/11 : contexte des champs obligatoires */
    if (!d.isConnected) sviWinShow(d);
  };
  draw();
  if (sec) setTimeout(() => d.querySelector(`.frs-sec[data-s="${sec}"]`)?.scrollIntoView({ block: "start" }), 50);
  /* lecture des cases dans le brouillon (avant chaque redessin) */
  const pull = () => {
    d.querySelectorAll(".frs-x").forEach(i => { const k = i.dataset.k; F[k] = ["ice", "ifisc", "rc", "cnss"].includes(k) ? sviMaskRaw(i.value) : ["patente", "codeCpt", "aeNo"].includes(k) ? achDig(i.value) : ["capital", "effectif", "plafEnc", "plafT", "plafP", "escTaux", "escJours", "retTaux", "delai", "minCmd", "franco", "remise", "garMois", "camions"].includes(k) ? (String(i.value || "").trim() === "" ? "" : achN(i.value)) : ["dateCrea", "cgaDate", "revue"].includes(k) ? i.value : ["site", "mailCmd", "mailFac"].includes(k) ? String(i.value || "").trim().toLowerCase() : k === "gps" ? String(i.value || "").trim() : achU(i.value); });
    d.querySelectorAll(".frs-xs").forEach(i => { F[i.dataset.k] = i.value; });
    if (d.querySelector('select.frs-xs[data-k="codeCpt"]')) { const c = sviPgL("cpt").find(x => String(x.code) === String(F.codeCpt)); if (c) F.intCpt = achU(c.lab || ""); }
    d.querySelectorAll(".frs-xc").forEach(i => { F[i.dataset.k] = i.checked; });
    F.fam = [...d.querySelectorAll(".frs-fc:checked")].map(i => i.value);
    F.jours = [...d.querySelectorAll(".frs-jr:checked")].map(i => i.value);
    F.fermJ = [...d.querySelectorAll(".frs-fj:checked")].map(i => i.value);
    d.querySelectorAll('.frs-sub[data-sub="cte"] tr[data-i]').forEach(tr => { const r = F.cte[+tr.dataset.i]; if (r && !ro) r.rec = [...tr.querySelectorAll(".frs-rcb:checked")].map(i => i.value); });
    d.querySelectorAll(".frs-sub[data-sub]").forEach(t => { const k = t.dataset.sub; t.querySelectorAll("tr[data-i]").forEach(tr => { const r = F[k][+tr.dataset.i]; if (!r) return;
      tr.querySelectorAll(".frs-s").forEach(i => { const c = i.dataset.c; if (c === "bqId") return; /* B21 : la banque n'est gardée que choisie (sinon déduite du RIB) */ r[c] = c === "rib" ? achDig(i.value) : c === "email" ? String(i.value || "").trim().toLowerCase() : c === "mt" || c === "pu" ? achN(i.value) : c === "exp" || c === "ech" || c === "valid" || c === "debut" || c === "fin" || c === "type" || c === "role" || c === "t" || c === "bqId" || c === "ag" ? i.value : achU(i.value); }); }); });
    const rp = d.querySelector(".frs-rp:checked"); F.ribs.forEach((r, i) => { r.p = !!rp && +rp.dataset.i === i; });
    /* 05/11 : synchronisation article lié ↔ champ de la fiche (celui qu'on vient de changer l'emporte) */
    F.cla.forEach((x, i) => { const k = achCltFld(x.t); if (!k) return; const cv = String(x.v ?? ""), fv = String(F[k] ?? "");
      if (cv !== (syncC[i] ?? cv)) F[k] = cv === "" ? "" : ACH_CLT_NUM.includes(k) ? achN(cv) : cv; else if (fv !== (syncF[k] ?? fv)) x.v = fv; });
    syncMark();
  };
  /* v906 (principe du 03/11/2026 : erreur refusée dès la saisie) : chaque case de la fiche est contrôlée en la quittant —
     la case fautive reprend sa valeur d'avant, avec la raison (les contrôles d'ENREGISTRER restent ; masques IF / RC / CNSS / TÉLÉPHONE : règle commune, 09f) */
  const frsWhy = i => {
    const k = i.dataset.k || i.dataset.c, raw = String(i.value ?? "").trim(), v = achU(raw);
    if (i.classList.contains("frs-x")) {
      if (k === "nom" && !v) return "NOM OBLIGATOIRE.";
      if (k === "ice" && sviMaskRaw(raw)) { const c = sviMaskRaw(raw); if (!achIceOk(c)) return achIceMsg() + "."; const x = achFrsDupIce(achFrs(), c, id); if (x) return "ICE DÉJÀ UTILISÉ PAR " + x.code + " — " + x.nom + "."; }
      if (k === "forme" && v && !ACH_FORMES.includes(v)) return "FORME JURIDIQUE : CHOISIR DANS LA LISTE.";
      if ((k === "mailCmd" || k === "mailFac") && raw && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(raw)) return "E-MAIL NON VALIDE.";
      if (["escTaux", "retTaux", "remise"].includes(k) && achN(raw) > 100) return "UN TAUX NE PEUT PAS DÉPASSER 100 %.";
      if (k === "gps" && raw && !/^-?\d{1,2}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?$/.test(raw)) return "POSITION GPS : LATITUDE, LONGITUDE (EX. 33.5731, -7.5898).";
    }
    if (i.classList.contains("frs-xs") && k === "grp" && !i.value) return "GROUPE OBLIGATOIRE.";
    if (i.classList.contains("frs-s")) {
      if (k === "email" && raw && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(raw)) return "E-MAIL NON VALIDE.";
      if (k === "annee" && raw && !/^(19|20)\d{2}$/.test(raw)) return "RÉFÉRENCES : ANNÉE SUR 4 CHIFFRES.";
      if (k === "pu" && raw && !(achN(raw) > 0)) return "TARIFS : PRIX SUPÉRIEUR À 0.";
      if (k === "rib" && achDig(raw)) { const r = achDig(raw); if (!achRibOk(r)) return "RIB NON VALIDE : 24 CHIFFRES ET CLÉ (LE RIB DOIT ÊTRE DIVISIBLE PAR 97).";
        const tr = i.closest("tr[data-i]"), me = tr ? +tr.dataset.i : -1;
        if ((F.ribs || []).some((x, j) => j !== me && achDig(x.rib) === r)) return "LE MÊME RIB EST SAISI DEUX FOIS."; }
    }
    return "";
  };
  /* B29 : changer le TYPE d'un article reprend sa valeur par défaut (si l'article était vide ou gardait celle de l'ancien type) */
  d.addEventListener("change", e => { const s = e.target.closest && e.target.closest('table[data-sub="cla"] select[data-c="t"]'); if (!s) return; const tr = s.closest("tr[data-i]"), x = F.cla[+tr.dataset.i]; if (!x) return;
    const inp = tr.querySelector('input[data-c="txt"]'), cur = inp ? achU(inp.value) : x.txt; if (!cur || cur === achCltDef(x.t)) { if (inp) inp.value = achCltDef(s.value); } x.t = s.value; x.txt = inp ? achU(inp.value) : x.txt;
    pull(); x.u = achCltU(x.t); const k = achCltFld(x.t); if (k) x.v = String(F[k] ?? ""); syncMark(); draw(); });
  /* B21 : changer la banque d'un RIB recharge ses agences */
  d.addEventListener("change", e => { const s = e.target.closest && e.target.closest('table[data-sub="ribs"] select[data-c="bqId"]'); if (!s) return; pull(); const r = F.ribs[+s.closest("tr[data-i]").dataset.i]; if (r) { r.bqId = s.value; r.ag = ""; } draw(); });
  /* B41 : LANGUE — « AJOUTER… » en bas de la liste ; la langue ajoutée l'est partout (PARAMÉTRAGE GÉNÉRAL) */
  d.addEventListener("change", async e => { const s = e.target.closest && e.target.closest('select[data-k="lang"]'); if (!s || s.value !== "__add") return; e.stopImmediatePropagation();
    let v = ""; const h = ev => { if (ev.target && ev.target.id === "frsLangNew") v = ev.target.value; }; document.addEventListener("input", h, true);
    const ok = await svConfirm({ title: "AJOUTER UNE LANGUE", html: `<input class="ins-in" id="frsLangNew" autocomplete="off" style="width:100%">`, ok: "AJOUTER", tone: "neutral" });
    document.removeEventListener("input", h, true); v = sviPgU(v);
    if (ok && v) { sviLangueAdd(v); pull(); F.lang = v; } else s.value = F.lang || ""; draw(); }, true);
  d.addEventListener("focusin", e => { const i = e.target.closest && e.target.closest(".frs-x, .frs-xs, .frs-s"); if (i) i.dataset.prev = i.value; });
  d.addEventListener("change", e => {
    const i = e.target.closest && e.target.closest(".frs-x, .frs-xs, .frs-s"); if (!i || ro) return;
    const why = frsWhy(i); if (!why) return;
    e.stopImmediatePropagation();
    i.value = i.dataset.prev ?? ""; svToast(why, 4000, i);
  }, true);
  /* logo réduit à 96 px pour rester léger dans la base */
  d.addEventListener("change", e => {
    if (e.target.matches('.frs-x[data-k="forme"], .frs-xs[data-k="grp"]')) { pull(); draw(); return; }
    const fi = e.target.closest(".frs-logo-in"); if (!fi || !fi.files || !fi.files[0]) return;
    const rd = new FileReader();
    rd.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, 96 / Math.max(im.width, im.height)), c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k)); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      pull(); F.logo = c.toDataURL("image/png"); draw(); }; im.src = rd.result; };
    rd.readAsDataURL(fi.files[0]);
  });
  d.addEventListener("click", async e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
    const ft = e.target.closest("[data-ftab]");
    if (ft) { if (!ro) pull(); tab = ft.dataset.ftab; draw(); return; }
    if (ro) return;
    const ad = e.target.closest("[data-add]");
    if (ad) { pull(); const k = ad.dataset.add; F[k].push(k === "cla" ? { t: "autre", txt: "", v: "", u: "" } : k === "refs" ? { chantier: "", client: "", annee: "", mt: 0 } : k === "tar" ? { des: "", u: "", pu: 0, valid: "" } : k === "cau" ? { type: ACH_CAUT[0], no: "", bq: "", mt: 0, ech: "" } : k === "ribs" ? { rib: "", p: !F.ribs.length } : k === "docf" ? { type: ACH_DOCF[0], no: "", exp: "" } : k === "cte" ? { nom: "", fonction: "", role: "", tel: "", email: "" } : { intitule: "", debut: "", fin: "" }); draw(); return; }
    const rm = e.target.closest("[data-rm]");
    if (rm) { pull(); const [k, i] = rm.dataset.rm.split("|"); F[k].splice(+i, 1); if (k === "ribs" && F.ribs.length && !F.ribs.some(r => r.p)) F.ribs[0].p = true; draw(); return; }
    if (e.target.closest("[data-evladd]")) {
      pull();
      const crit = [...d.querySelectorAll(".frs-ed")].map(i => ({ d: achU(i.value), n: Math.max(0, Math.min(10, achN((d.querySelector(`.frs-en[data-i="${i.dataset.i}"]`) || {}).value))) })).filter(c => c.d);
      if (!crit.length) { svToast("ÉVALUATION : AU MOINS UN CRITÈRE (NOM ET NOTE).", 3000); return; }
      F.evl.push({ date: new Date().toISOString(), crit, moy: crit.reduce((t, c) => t + c.n, 0) / crit.length }); draw(); return;
    }
    if (e.target.closest("[data-logorm]")) { pull(); F.logo = ""; draw(); return; }
    if (e.target.closest("[data-claok]")) { pull(); F.claOk = achNow(); F.claSnap = claSnap(); draw(); return; }   /* 05/11 : VALIDER LE CONTRAT (enregistré avec la fiche) */
    if (e.target.closest("[data-ribok]")) { pull(); F.ribChg = ""; F.__ribOk = true; draw(); return; }
    if (!e.target.closest("[data-save]")) return;
    pull();
    const L = achFrs(), f = L.find(x => x.id === id); if (!f) { d.remove(); return; }
    /* contrôles bloquants */
    if (!F.nom) { svToast("NOM OBLIGATOIRE.", 3000); return; }
    if (F.ice && !achIceOk(F.ice)) { svToast(achIceMsg() + ".", 3500); return; }
    { const x = achFrsDupIce(L, F.ice, id); if (x) { svToast("ICE DÉJÀ UTILISÉ PAR " + x.code + " — " + x.nom + ".", 4000); return; } }
    if (F.forme && !ACH_FORMES.includes(F.forme)) { svToast("FORME JURIDIQUE : CHOISIR DANS LA LISTE.", 3500); return; }
    if (["mailCmd", "mailFac"].some(k => F[k] && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(F[k]))) { svToast("E-MAIL NON VALIDE.", 3000); return; }
    for (const [k, m] of [["ifisc", "if"], ["rc", "rc"], ["cnss", "cnss"]]) if (F[k] && !sviMaskOk(m, F[k])) { svToast(sviMaskLab(m) + " NON VALIDE : FORMAT " + sviMaskOf(m).m + ".", 3500); return; }
    { const c = F.cte.find(c => c.tel && !sviMaskOk("tel", c.tel)); if (c) { svToast("TÉLÉPHONE NON VALIDE (" + (c.nom || c.tel) + ") : FORMAT " + sviMaskOf("tel").m + ".", 3500); return; } }
    for (const k of ["escTaux", "retTaux", "remise"]) if (achN(F[k]) > 100) { svToast("UN TAUX NE PEUT PAS DÉPASSER 100 %.", 3000); return; }
    if (F.gps && !/^-?\d{1,2}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?$/.test(F.gps)) { svToast("POSITION GPS : LATITUDE, LONGITUDE (EX. 33.5731, -7.5898).", 3500); return; }
    if (F.refs.some(x => x.annee && !/^(19|20)\d{2}$/.test(String(x.annee)))) { svToast("RÉFÉRENCES : ANNÉE SUR 4 CHIFFRES.", 3000); return; }
    if (F.tar.some(x => !(achN(x.pu) > 0))) { svToast("TARIFS : PRIX OBLIGATOIRE.", 3000); return; }
    { const m = F.ribs.map(r => achRibBqWhy({ ...r, bqId: r.bqId || (achBankOfRib(r.rib) || {}).id || "" })).find(Boolean); if (m) { svToast(m + ".", 4500); return; } }
    F.grp = achFrsGrpId(F);
    if (achSt(f0) !== "instance" && achFrsPfx(f0) !== achFrsPfx(F)) { svToast("LE PAYS (LOCAL / ÉTRANGER) OU LE TYPE NE SE CHANGE PLUS APRÈS LA VALIDATION : LE PRÉFIXE DE LA RÉFÉRENCE CHANGERAIT.", 4500); return; }
    F.occ = F.grp === "occ"; F.orgFin = F.type === ACH_GRP_OLD.fin;
    if (F.cga && !F.cgaDate) { svToast("CONDITIONS GÉNÉRALES SIGNÉES : DONNER LA DATE.", 3000); return; }
    if (F.forme !== "AUTO-ENTREPRENEUR") { F.aeNo = ""; F.aeCin = ""; }
    if (F.lie && !F.lieT) { svToast("FOURNISSEUR LIÉ : CHOISIR LE LIEN.", 3000); return; }
    if (!F.lie) F.lieT = "";
    F.ribs = F.ribs.filter(r => achDig(r.rib));
    if (F.ribs.some(r => !achRibOk(r.rib))) { svToast("RIB NON VALIDE : 24 CHIFFRES ET CLÉ (LE RIB DOIT ÊTRE DIVISIBLE PAR 97).", 4000); draw(); return; }
    if (new Set(F.ribs.map(r => achDig(r.rib))).size < F.ribs.length) { svToast("LE MÊME RIB EST SAISI DEUX FOIS.", 3500); draw(); return; }
    if (F.ribs.length && !F.ribs.some(r => r.p)) F.ribs[0].p = true;
    F.cte = F.cte.filter(c => c.nom || c.tel || c.email); F.cgf = F.cgf.filter(c => c.intitule); F.cla = F.cla.filter(c => c.txt || c.v || c.t !== "autre");
    /* 05/11 : contrat validé puis modifié (article ou champ lié) = nouvelle version EN INSTANCE ; l'ancienne est gardée */
    if (f0.claOk && f0.claSnap && claSnap() !== f0.claSnap) { F.claHist = (f0.claHist || []).concat([{ t: f0.claOk, cla: JSON.parse(f0.claSnap) }]); F.claOk = ""; F.claSnap = ""; } F.docf = F.docf.filter(x => x.type && (x.no || x.exp)); F.cau = F.cau.filter(x => x.no || x.mt || x.ech); F.tar = F.tar.filter(x => x.des); F.refs = F.refs.filter(x => x.chantier);
    /* changement de RIB : confirmé, noté, signalé jusqu'à vérification */
    const oldR = (f.ribs || []).map(r => achDig(r.rib)), newR = F.ribs.map(r => achDig(r.rib)), oldP = (achFrsRibP(f) || {}).rib || "", newP = (achFrsRibP(F) || {}).rib || "";
    const chg = oldR.length && (oldR.some(r => !newR.includes(r)) || newR.some(r => !oldR.includes(r)) || achDig(oldP) !== achDig(newP));
    if (chg) {
      if (!(await svConfirm({ title: "CHANGEMENT DE RIB", html: `<div class="svc-sub">${esc(F.code + " — " + F.nom)}</div><div class="svc-sub">AVANT : ${esc(oldR.join(" · ") || "—")}</div><div class="svc-sub">APRÈS : ${esc(newR.join(" · ") || "—")}</div><div class="svc-sub">UN CHANGEMENT DE RIB EST UNE FRAUDE COURANTE : LE CONFIRMER AUPRÈS DU FOURNISSEUR PAR UN AUTRE MOYEN (TÉLÉPHONE CONNU). LE FOURNISSEUR RESTE SIGNALÉ JUSQU'À « RIB VÉRIFIÉ ».</div>`, ok: "ENREGISTRER LE NOUVEAU RIB" }))) return;
      F.ribChg = new Date().toISOString();
      achHist(F.code, "RIB MODIFIÉ", (oldR.join(" · ") || "—") + " → " + (newR.join(" · ") || "—"));
    }
    if (F.__ribOk) { achHist(F.code, "RIB VÉRIFIÉ", newR.join(" · ")); delete F.__ribOk; }
    const LAB = { nom: "NOM", denom: "DÉNOMINATION", forme: "FORME", ville: "VILLE", adresse: "ADRESSE", site: "SITE WEB", resp: "RESPONSABLE", type: "TYPE", pays: "PAYS", lang: "LANGUE", mailCmd: "E-MAIL DE COMMANDE", mailFac: "E-MAIL DE FACTURATION", origine: "ORIGINE", lie: "FOURNISSEUR LIÉ", lieT: "LIEN", logo: "LOGO", grp: "GROUPE", cnss: "CNSS", dateCrea: "DATE DE CRÉATION", dirigeant: "DIRIGEANT", aeNo: "N° AUTO-ENTREPRENEUR", aeCin: "CIN", qualif: "QUALIFICATION", classe: "CLASSIFICATION", effectif: "EFFECTIF", certif: "CERTIFICATIONS", assRc: "ASSURANCE RC", secu: "SÉCURITÉ", cga: "CONDITIONS GÉNÉRALES", cgaDate: "DATE DES CONDITIONS GÉNÉRALES", revue: "REVUE", occ: "OCCASIONNEL", orgFin: "ORGANISME FINANCIER", actif: "ACTIF",
      ice: "ICE", ifisc: "IF", rc: "RC", villeRc: "VILLE RC", patente: "PATENTE", capital: "CAPITAL", codeCpt: "CODE COMPTABLE", intCpt: "INTITULÉ COMPTABLE", cond: "PAIEMENT", fam: "FAMILLES", docf: "DOCUMENTS FISCAUX", plafEnc: "PLAFOND D'ENCOURS", encNom: "PERSONNE QUI ENCAISSE", jours: "JOURS DE PAIEMENT", cau: "CAUTIONS", modeReg: "MODE DE RÈGLEMENT", escTaux: "ESCOMPTE", escJours: "DÉLAI D'ESCOMPTE", retAcc: "RETENUE ACCEPTÉE", retTaux: "TAUX DE RETENUE", delai: "DÉLAI", devise: "DEVISE", minCmd: "MINIMUM", franco: "FRANCO", remise: "REMISE", envoi: "ENVOI DES COMMANDES", livr: "LIVRAISON", heuresLiv: "HEURES DE LIVRAISON", gps: "GPS DU DÉPÔT", incoterm: "INCOTERM", transit: "TRANSITAIRE", conges: "CONGÉS", fermJ: "JOURS SANS LIVRAISON", garMois: "GARANTIE", savContact: "CONTACT SAV", tar: "TARIFS", solva: "SOLVABILITÉ", strat: "PLACE DU FOURNISSEUR", camions: "CAMIONS", capJour: "CAPACITÉ PAR JOUR", materiel: "MATÉRIEL", refs: "RÉFÉRENCES", cte: "CONTACTS", evl: "ÉVALUATIONS", cgf: "CONTRATS", cla: "CLAUSES GÉNÉRALES" };
    const ch = Object.keys(LAB).filter(k => JSON.stringify(f[k] ?? "") !== JSON.stringify(F[k] ?? ""));
    Object.assign(f, F, { mod: new Date().toISOString() });
    if (ch.length) achHist(f.code, "MODIFICATION", ch.map(k => LAB[k]).join(", "));
    achFrsSave(L); d.remove(); if (done) done();
  });
}
