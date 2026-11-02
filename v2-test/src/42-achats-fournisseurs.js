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
    ["occ", "OCCASIONNEL", f => f.occ ? "OUI" : "NON", "center"], ["actif", "ACTIF", f => f.actif === false ? "NON" : "OUI", "center"]];
  const W0 = { code: 92, nom: 260, forme: 140, ville: 130, ice: 150, rib: 130, cond: 130, fam: 90, cte: 90, note: 90, occ: 100, actif: 70 };
  const cwF = k => (cwLoad()["ach_frs." + k]) || W0[k] || 100;
  const cellIn = (f, k) => {
    const ro = !!f.del;
    if (k === "code") return `<button type="button" class="ach-link" data-fiche="${esc(f.id)}" title="Ouvrir la fiche">${esc(f.code)}</button>`;
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
      if (!A.length || !(await svConfirm({ title: "METTRE À LA CORBEILLE", html: `<ul class="svc-list">${A.map(f => `<li>${esc(f.code + " — " + f.nom)}</li>`).join("")}</ul><div class="svc-sub">RESTAURABLES DEPUIS LA CORBEILLE ; LEURS NUMÉROS NE SERONT PAS RÉUTILISÉS.</div>`, ok: "METTRE À LA CORBEILLE" }))) return true;
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
    if (k === "cond" && v && !ACH_CONDS.includes(v)) { svToast("CONDITIONS DE PAIEMENT : CHOISIR DANS LA LISTE.", 3500, t); draw(); return true; }
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
function achFrsFiche(id, sec, done) {
  const L0 = achFrs(), f0 = L0.find(x => x.id === id); if (!f0) return;
  const F = JSON.parse(JSON.stringify(f0)), ro = !!f0.del, P = achPrm();
  ["ribs", "docf", "cte", "evl", "cgf", "fam"].forEach(k => { if (!Array.isArray(F[k])) F[k] = []; });
  const d = sviWinNew();
  const inp = (k, lab, o = {}) => `<label class="frs-f${o.w ? " frs-w" : ""}"><span>${lab}${o.req ? " <b>*</b>" : ""}</span><input class="ins-in frs-x" data-k="${k}"${o.mask ? ` data-mask="${o.mask}"` : ""} value="${esc(o.mask ? sviMaskFmt(o.mask, F[k] ?? "") : F[k] ?? "")}"${o.num ? ' inputmode="numeric"' : ""}${o.date ? ' type="date"' : ""}${o.keep ? " data-keepcase" : ""}${o.list ? ` list="frsL-${k}"` : ""}${ro ? " readonly" : ""} autocomplete="off">${o.list ? `<datalist id="frsL-${k}">${o.list.map(x => `<option value="${esc(x)}">`).join("")}</datalist>` : ""}</label>`;
  const sel = (k, lab, opts, o = {}) => `<label class="frs-f${o.w ? " frs-w" : ""}"><span>${lab}</span><select class="ins-in frs-xs" data-k="${k}"${ro ? " disabled" : ""}><option value="">—</option>${opts.map(x => { const v = Array.isArray(x) ? x[0] : x, t = Array.isArray(x) ? x[1] : x; return `<option value="${esc(v)}"${String(F[k] ?? "") === String(v) ? " selected" : ""}>${esc(t)}</option>`; }).join("")}</select></label>`;
  const chk = (k, lab) => `<label class="frs-c"><input type="checkbox" class="frs-xc" data-k="${k}"${F[k] ? " checked" : ""}${ro ? " disabled" : ""}> ${lab}</label>`;
  const sub = (k, cols, add) => `<table class="prm-table frs-sub" data-sub="${k}"><thead><tr>${cols.map(c => `<th>${c[1]}</th>`).join("")}<th></th></tr></thead><tbody>
      ${F[k].map((r, i) => `<tr data-i="${i}">${cols.map(c => `<td>${c[2] ? c[2](r, i) : `<input class="ins-in frs-s" data-c="${c[0]}" value="${esc(r[c[0]] ?? "")}"${c[3] || ""}${ro ? " readonly" : ""} autocomplete="off">`}</td>`).join("")}<td class="center">${ro ? "" : `<button type="button" class="ach-x" data-rm="${k}|${i}" data-rml="${k}|${i}" title="Retirer">✕</button>`}</td></tr>`).join("") || `<tr><td colspan="${cols.length + 1}" class="empty">AUCUNE LIGNE</td></tr>`}
    </tbody></table>${ro ? "" : `<button type="button" class="ach-b frs-add" data-add="${k}" data-addl>+ ${add}</button>`}`;
  /* v801 : la fenêtre i a cinq onglets (checklist, fenêtre i du fournisseur, 02/11/2026) */
  const TABS = [["id", "IDENTITÉ", ["id", "cte"]], ["leg", "FISCAL ET LÉGAL", ["fisc", "qual", "secu", "docf"]], ["bq", "BANQUE ET PAIEMENT", ["rib", "cpt"]],
    ["ach", "CONDITIONS D'ACHAT", ["cond", "fam", "cgf"]], ["rsq", "RISQUE ET MOYENS", ["evl"]]];
  let tab = (TABS.find(t => t[2].includes(sec)) || TABS[0])[0];
  const draw = () => {
    const why = achFrsWhy(F, achFrs()), note = achFrsNote(F);
    d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: esc(F.nom || "") + " : " + esc(typeof achRefSvi === "function" ? achRefSvi(F, achFrs(), "FRS") : F.code),
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}${F.ribChg && !ro ? ` <button type="button" class="ach-b" data-ribok>RIB VÉRIFIÉ</button>` : ""}</div>` : ""}
        <div class="rec-tabs frs-tabs">${TABS.map(t => `<button type="button" class="rec-tab${t[0] === tab ? " active on" : ""}" data-ftab="${t[0]}">${t[1]}</button>`).join("")}</div>
        <div class="frs-scroll">
        <div class="frs-sec" data-s="id"><div class="frs-st">IDENTITÉ</div><div class="frs-g">
          ${inp("nom", "NOM", { req: 1, w: 1 })}${inp("denom", "DÉNOMINATION SOCIALE", { w: 1 })}${inp("forme", "FORME JURIDIQUE", { list: ACH_FORMES })}${inp("ville", "VILLE")}
          ${sel("type", "TYPE DE FOURNISSEUR", ACH_FTYPES)}${inp("pays", "PAYS")}${sel("lang", "LANGUE", ACH_LANGS)}
          ${inp("adresse", "ADRESSE", { w: 1 })}${inp("site", "SITE WEB", { keep: 1 })}${inp("resp", "RESPONSABLE INTERNE")}
          ${inp("mailCmd", "E-MAIL DE COMMANDE", { keep: 1 })}${inp("mailFac", "E-MAIL DE FACTURATION", { keep: 1 })}${inp("origine", "ORIGINE (TROUVÉ COMMENT, RECOMMANDÉ PAR QUI)", { w: 1 })}
          ${sel("lie", "FOURNISSEUR LIÉ", achFrs().filter(x => !x.del && x.id !== id).map(x => [x.id, x.nom]))}${sel("lieT", "LIEN", ACH_FLIENS)}
          <div class="frs-f frs-w frs-logo"><span>LOGO</span><div>${F.logo ? `<img src="${esc(F.logo)}" alt="">` : ""}${ro ? "" : `<input type="file" accept="image/*" class="frs-logo-in">${F.logo ? ` <button type="button" class="ach-b" data-logorm>RETIRER LE LOGO</button>` : ""}`}</div></div>
          <div class="frs-cs">${chk("occ", "FOURNISSEUR OCCASIONNEL (FICHE SIMPLIFIÉE : ICE ET RIB FACULTATIFS)")}${chk("orgFin", "ORGANISME FINANCIER")}${chk("actif", "ACTIF")}</div></div></div>
        <div class="frs-sec" data-s="fisc"><div class="frs-st">FISCAL ET LÉGAL</div><div class="frs-g">
          ${inp("ice", "ICE", { req: !F.occ, num: 1, mask: "ice" })}${inp("ifisc", "IDENTIFIANT FISCAL", { num: 1, mask: "if" })}${inp("rc", "REGISTRE DE COMMERCE", { num: 1, mask: "rc" })}${inp("villeRc", "VILLE DU RC")}
          ${inp("patente", "PATENTE", { num: 1 })}${inp("capital", "CAPITAL (MAD)", { num: 1 })}
          ${inp("cnss", "N° CNSS", { num: 1, mask: "cnss" })}${inp("dateCrea", "DATE DE CRÉATION", { date: 1 })}${inp("dirigeant", "DIRIGEANT", { w: 1 })}
          ${F.forme === "AUTO-ENTREPRENEUR" ? `${inp("aeNo", "N° AUTO-ENTREPRENEUR", { num: 1 })}${inp("aeCin", "CIN DU TITULAIRE")}` : ""}</div></div>
        <div class="frs-sec" data-s="qual"><div class="frs-st">QUALIFICATION ET CERTIFICATIONS</div><div class="frs-g">
          ${inp("qualif", "QUALIFICATION (CERTIFICAT DU MINISTÈRE)", { w: 1 })}${inp("classe", "CLASSIFICATION")}${inp("effectif", "EFFECTIF", { num: 1 })}
          ${inp("certif", "CERTIFICATIONS (EX. ISO 9001)", { w: 1 })}</div></div>
        <div class="frs-sec" data-s="secu"><div class="frs-st">ASSURANCES, SÉCURITÉ ET CONDITIONS GÉNÉRALES</div><div class="frs-g">
          ${inp("cgaDate", "CONDITIONS GÉNÉRALES SIGNÉES LE", { date: 1 })}${inp("revue", "DERNIÈRE REVUE DE LA FICHE", { date: 1 })}
          <div class="frs-cs">${chk("assRc", "ASSURANCE RESPONSABILITÉ CIVILE")}${chk("secu", "RESPECTE LES RÈGLES DE SÉCURITÉ SUR CHANTIER")}${chk("cga", "CONDITIONS GÉNÉRALES D'ACHAT SIGNÉES ET ACCEPTÉES")}</div></div></div>
        <div class="frs-sec" data-s="cpt"><div class="frs-st">COMPTE COMPTABLE</div><div class="frs-g">${inp("codeCpt", "CODE COMPTABLE", { num: 1 })}${inp("intCpt", "INTITULÉ COMPTABLE")}</div></div>
        <div class="frs-sec" data-s="rib"><div class="frs-st">RIB ${svCnt(F.ribs.length)}</div>
          ${sub("ribs", [["rib", "RIB (24 CHIFFRES)", null, ' inputmode="numeric"'], ["bq", "BANQUE", r => esc((achBankOfRib(r.rib) || {}).n || (achDig(r.rib).length >= 3 ? "CODE " + achDig(r.rib).slice(0, 3) + " INCONNU" : "—"))],
            ["p", "PRINCIPAL", (r, i) => `<input type="radio" name="frsRibP" class="frs-rp" data-i="${i}"${r.p ? " checked" : ""}${ro ? " disabled" : ""}>`]], "AJOUTER UN RIB")}</div>
        <div class="frs-sec" data-s="cond"><div class="frs-st">CONDITIONS DE PAIEMENT</div><div class="frs-g">${inp("cond", "CONDITIONS", { list: ACH_CONDS })}</div></div>
        <div class="frs-sec" data-s="fam"><div class="frs-st">FAMILLES D'ARTICLES FOURNIES ${svCnt(F.fam.length)}</div><div class="frs-fam">${P.cat.map(c => `<label class="frs-c"><input type="checkbox" class="frs-fc" value="${esc(c)}"${F.fam.includes(c) ? " checked" : ""}${ro ? " disabled" : ""}> ${esc(c)}</label>`).join("") || `<span class="ach-0">AUCUNE CATÉGORIE (ACHATS › PARAMÈTRES)</span>`}</div></div>
        <div class="frs-sec" data-s="docf"><div class="frs-st">DOCUMENTS FISCAUX ${svCnt(F.docf.length)}</div>
          ${sub("docf", [["type", "DOCUMENT", (r, i) => `<select class="ins-in frs-s" data-c="type"${ro ? " disabled" : ""}>${ACH_DOCF.map(x => `<option${x === r.type ? " selected" : ""}>${esc(x)}</option>`).join("")}</select>`], ["no", "N°"], ["exp", "EXPIRE LE", (r) => `<input type="date" class="ins-in frs-s" data-c="exp" value="${esc(r.exp || "")}"${ro ? " readonly" : ""}>`]], "AJOUTER UN DOCUMENT")}</div>
        <div class="frs-sec" data-s="cte"><div class="frs-st">CONTACTS ${svCnt(F.cte.length)}</div>
          ${sub("cte", [["nom", "NOM"], ["fonction", "FONCTION"], ["role", "RÔLE", (r) => `<select class="ins-in frs-s" data-c="role"${ro ? " disabled" : ""}><option value="">—</option>${ACH_CROLES.map(x => `<option${x === r.role ? " selected" : ""}>${esc(x)}</option>`).join("")}</select>`], ["tel", "TÉLÉPHONE", null, ' inputmode="tel" data-mask="tel"'], ["email", "E-MAIL", (r) => `<input class="ins-in frs-s" data-c="email" data-keepcase value="${esc(r.email || "")}" inputmode="email"${ro ? " readonly" : ""} autocomplete="off">`]], "AJOUTER UN CONTACT")}</div>
        <div class="frs-sec" data-s="evl"><div class="frs-st">ÉVALUATIONS ${svCnt(F.evl.length)}${note === null ? "" : " — MOYENNE " + esc(String(Math.round(note * 10) / 10).replace(".", ",")) + " / 10"}</div>
          ${F.evl.map((x, i) => `<div class="frs-evl">☆ ${esc(String(x.date || "").slice(0, 10).split("-").reverse().join("/"))} — <b>${esc(String(Math.round(achN(x.moy) * 10) / 10).replace(".", ","))} / 10</b> (${esc((x.crit || []).map(c => c.d + " " + c.n).join(", "))})${ro ? "" : ` <button type="button" class="ach-x" data-rm="evl|${i}">✕</button>`}</div>`).join("") || `<div class="ach-0">AUCUNE ÉVALUATION</div>`}
          ${ro ? "" : `<table class="prm-table frs-sub frs-ecrit"><thead><tr><th>CRITÈRE</th><th>NOTE (0 À 10)</th></tr></thead><tbody>${[0, 1, 2, 3, 4].map(i => `<tr><td><input class="ins-in frs-ed" data-i="${i}" placeholder="${["QUALITÉ", "DÉLAIS", "PRIX", "SERVICE", ""][i]}" autocomplete="off"></td><td><input class="ins-in frs-en" data-i="${i}" inputmode="decimal" autocomplete="off"></td></tr>`).join("")}</tbody></table><button type="button" class="ach-b frs-add" data-evladd>+ AJOUTER L'ÉVALUATION</button>`}</div>
        <div class="frs-sec" data-s="cgf"><div class="frs-st">CONTRATS ${svCnt(F.cgf.length)}</div>
          ${sub("cgf", [["intitule", "INTITULÉ"], ["debut", "DÉBUT", (r) => `<input type="date" class="ins-in frs-s" data-c="debut" value="${esc(r.debut || "")}"${ro ? " readonly" : ""}>`], ["fin", "FIN", (r) => `<input type="date" class="ins-in frs-s" data-c="fin" value="${esc(r.fin || "")}"${ro ? " readonly" : ""}>`]], "AJOUTER UN CONTRAT")}</div>
        </div>`,
      foot: `<button type="button" class="svc-b" data-x>${ro ? "FERMER" : "ANNULER"}</button>${ro ? "" : `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button>`}` });
    const on = (TABS.find(t => t[0] === tab) || TABS[0])[2];
    d.querySelectorAll(".frs-sec[data-s]").forEach(x => { x.hidden = !on.includes(x.dataset.s); });
    if (!d.isConnected) sviWinShow(d);
  };
  draw();
  if (sec) setTimeout(() => d.querySelector(`.frs-sec[data-s="${sec}"]`)?.scrollIntoView({ block: "start" }), 50);
  /* lecture des cases dans le brouillon (avant chaque redessin) */
  const pull = () => {
    d.querySelectorAll(".frs-x").forEach(i => { const k = i.dataset.k; F[k] = ["ice", "ifisc", "rc", "cnss"].includes(k) ? sviMaskRaw(i.value) : ["patente", "codeCpt", "aeNo"].includes(k) ? achDig(i.value) : ["capital", "effectif"].includes(k) ? (String(i.value || "").trim() === "" ? "" : achN(i.value)) : ["dateCrea", "cgaDate", "revue"].includes(k) ? i.value : ["site", "mailCmd", "mailFac"].includes(k) ? String(i.value || "").trim().toLowerCase() : achU(i.value); });
    d.querySelectorAll(".frs-xs").forEach(i => { F[i.dataset.k] = i.value; });
    d.querySelectorAll(".frs-xc").forEach(i => { F[i.dataset.k] = i.checked; });
    F.fam = [...d.querySelectorAll(".frs-fc:checked")].map(i => i.value);
    d.querySelectorAll(".frs-sub[data-sub]").forEach(t => { const k = t.dataset.sub; t.querySelectorAll("tr[data-i]").forEach(tr => { const r = F[k][+tr.dataset.i]; if (!r) return;
      tr.querySelectorAll(".frs-s").forEach(i => { const c = i.dataset.c; r[c] = c === "rib" ? achDig(i.value) : c === "email" ? String(i.value || "").trim().toLowerCase() : c === "exp" || c === "debut" || c === "fin" || c === "type" || c === "role" ? i.value : achU(i.value); }); }); });
    const rp = d.querySelector(".frs-rp:checked"); F.ribs.forEach((r, i) => { r.p = !!rp && +rp.dataset.i === i; });
  };
  /* logo réduit à 96 px pour rester léger dans la base */
  d.addEventListener("change", e => {
    if (e.target.matches('.frs-x[data-k="forme"]')) { pull(); draw(); return; }
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
    if (ad) { pull(); const k = ad.dataset.add; F[k].push(k === "ribs" ? { rib: "", p: !F.ribs.length } : k === "docf" ? { type: ACH_DOCF[0], no: "", exp: "" } : k === "cte" ? { nom: "", fonction: "", role: "", tel: "", email: "" } : { intitule: "", debut: "", fin: "" }); draw(); return; }
    const rm = e.target.closest("[data-rm]");
    if (rm) { pull(); const [k, i] = rm.dataset.rm.split("|"); F[k].splice(+i, 1); if (k === "ribs" && F.ribs.length && !F.ribs.some(r => r.p)) F.ribs[0].p = true; draw(); return; }
    if (e.target.closest("[data-evladd]")) {
      pull();
      const crit = [...d.querySelectorAll(".frs-ed")].map(i => ({ d: achU(i.value), n: Math.max(0, Math.min(10, achN((d.querySelector(`.frs-en[data-i="${i.dataset.i}"]`) || {}).value))) })).filter(c => c.d);
      if (!crit.length) { svToast("ÉVALUATION : AU MOINS UN CRITÈRE (NOM ET NOTE).", 3000); return; }
      F.evl.push({ date: new Date().toISOString(), crit, moy: crit.reduce((t, c) => t + c.n, 0) / crit.length }); draw(); return;
    }
    if (e.target.closest("[data-logorm]")) { pull(); F.logo = ""; draw(); return; }
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
    if (F.cga && !F.cgaDate) { svToast("CONDITIONS GÉNÉRALES SIGNÉES : DONNER LA DATE.", 3000); return; }
    if (F.forme !== "AUTO-ENTREPRENEUR") { F.aeNo = ""; F.aeCin = ""; }
    if (F.lie && !F.lieT) { svToast("FOURNISSEUR LIÉ : CHOISIR LE LIEN.", 3000); return; }
    if (!F.lie) F.lieT = "";
    if (F.cond && !ACH_CONDS.includes(F.cond)) { svToast("CONDITIONS DE PAIEMENT : CHOISIR DANS LA LISTE.", 3500); return; }
    F.ribs = F.ribs.filter(r => achDig(r.rib));
    if (F.ribs.some(r => !achRibOk(r.rib))) { svToast("RIB NON VALIDE : 24 CHIFFRES.", 3500); draw(); return; }
    if (new Set(F.ribs.map(r => achDig(r.rib))).size < F.ribs.length) { svToast("LE MÊME RIB EST SAISI DEUX FOIS.", 3500); draw(); return; }
    if (F.ribs.length && !F.ribs.some(r => r.p)) F.ribs[0].p = true;
    F.cte = F.cte.filter(c => c.nom || c.tel || c.email); F.cgf = F.cgf.filter(c => c.intitule); F.docf = F.docf.filter(x => x.type && (x.no || x.exp));
    /* changement de RIB : confirmé, noté, signalé jusqu'à vérification */
    const oldR = (f.ribs || []).map(r => achDig(r.rib)), newR = F.ribs.map(r => achDig(r.rib)), oldP = (achFrsRibP(f) || {}).rib || "", newP = (achFrsRibP(F) || {}).rib || "";
    const chg = oldR.length && (oldR.some(r => !newR.includes(r)) || newR.some(r => !oldR.includes(r)) || achDig(oldP) !== achDig(newP));
    if (chg) {
      if (!(await svConfirm({ title: "CHANGEMENT DE RIB", html: `<div class="svc-sub">${esc(F.code + " — " + F.nom)}</div><div class="svc-sub">AVANT : ${esc(oldR.join(" · ") || "—")}</div><div class="svc-sub">APRÈS : ${esc(newR.join(" · ") || "—")}</div><div class="svc-sub">UN CHANGEMENT DE RIB EST UNE FRAUDE COURANTE : LE CONFIRMER AUPRÈS DU FOURNISSEUR PAR UN AUTRE MOYEN (TÉLÉPHONE CONNU). LE FOURNISSEUR RESTE SIGNALÉ JUSQU'À « RIB VÉRIFIÉ ».</div>`, ok: "ENREGISTRER LE NOUVEAU RIB" }))) return;
      F.ribChg = new Date().toISOString();
      achHist(F.code, "RIB MODIFIÉ", (oldR.join(" · ") || "—") + " → " + (newR.join(" · ") || "—"));
    }
    if (F.__ribOk) { achHist(F.code, "RIB VÉRIFIÉ", newR.join(" · ")); delete F.__ribOk; }
    const LAB = { nom: "NOM", denom: "DÉNOMINATION", forme: "FORME", ville: "VILLE", adresse: "ADRESSE", site: "SITE WEB", resp: "RESPONSABLE", type: "TYPE", pays: "PAYS", lang: "LANGUE", mailCmd: "E-MAIL DE COMMANDE", mailFac: "E-MAIL DE FACTURATION", origine: "ORIGINE", lie: "FOURNISSEUR LIÉ", lieT: "LIEN", logo: "LOGO", cnss: "CNSS", dateCrea: "DATE DE CRÉATION", dirigeant: "DIRIGEANT", aeNo: "N° AUTO-ENTREPRENEUR", aeCin: "CIN", qualif: "QUALIFICATION", classe: "CLASSIFICATION", effectif: "EFFECTIF", certif: "CERTIFICATIONS", assRc: "ASSURANCE RC", secu: "SÉCURITÉ", cga: "CONDITIONS GÉNÉRALES", cgaDate: "DATE DES CONDITIONS GÉNÉRALES", revue: "REVUE", occ: "OCCASIONNEL", orgFin: "ORGANISME FINANCIER", actif: "ACTIF",
      ice: "ICE", ifisc: "IF", rc: "RC", villeRc: "VILLE RC", patente: "PATENTE", capital: "CAPITAL", codeCpt: "CODE COMPTABLE", intCpt: "INTITULÉ COMPTABLE", cond: "PAIEMENT", fam: "FAMILLES", docf: "DOCUMENTS FISCAUX", cte: "CONTACTS", evl: "ÉVALUATIONS", cgf: "CONTRATS" };
    const ch = Object.keys(LAB).filter(k => JSON.stringify(f[k] ?? "") !== JSON.stringify(F[k] ?? ""));
    Object.assign(f, F, { mod: new Date().toISOString() });
    if (ch.length) achHist(f.code, "MODIFICATION", ch.map(k => LAB[k]).join(", "));
    achFrsSave(L); d.remove(); if (done) done();
  });
}
