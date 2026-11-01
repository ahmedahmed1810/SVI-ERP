/* =========================================================
   ACHATS — ÉCRAN (v749, étape 1)
   Onglets ARTICLES, FOURNISSEURS (livraison suivante), PARAMÈTRES.
   Mêmes briques que le budget : en-têtes à tri / filtre (sviCfKit, 09c), largeurs et ordre des colonnes mémorisés
   (cwLoad / coOrder, 09), case SAISIR ICI en bas, cases cochées pour les actions, H = historique, ⚠ = à compléter.
   ========================================================= */
function sviAchInit() {
  const view = document.getElementById("ach");
  if (!view || view.__achOn) return;
  view.__achOn = true;
  let tab = "art", showDel = false;
  try { const t = localStorage.getItem("svi_ach_tab_v1"); if (t === "art" || t === "prm") tab = t; } catch (e) {}
  const SEL = new Set();
  const kit = sviCfKit({ key: "ach", shell: view, refresh: () => draw() });
  const { cfApply, cfHead, cfOpenMenu, cfT } = kit;
  const F2 = v => (Number(v) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ | /g, " ");
  const body = view.querySelector(".ach-body"), bar = view.querySelector(".ach-tabs");
  const h1 = view.querySelector(".section-head h1"), sub = view.querySelector(".section-head p");
  /* ---------- ARTICLES ---------- */
  let BM = null;   /* charges des budgets (lien budget), recalculées à chaque dessin */
  const ART_COLS = () => [
    ["code", "CODE", a => a.code, "center"],
    ["des", "DÉSIGNATION", a => a.des, ""],
    ["u", "U", a => a.u, "center"],
    ["cat", "CATÉGORIE", a => a.cat || "", ""],
    ["stk", "STOCKÉ", a => a.stk ? "OUI" : "NON", "center"],
    ["tva", "TVA %", a => achN(a.tva), "number"],
    ["pref", "PRIX RÉF. HT", a => achN(a.pref), "number"],
    ["pmax", "PLAFOND HT", a => achN(a.pmax), "number"],
    ["bdg", "BUDGETS", a => achArtBudgets(a, BM).length, "center"],
    ["actif", "ACTIF", a => a.actif === false ? "NON" : "OUI", "center"]
  ];
  const ACH_W = { code: 92, des: 330, u: 70, cat: 190, stk: 80, tva: 70, pref: 110, pmax: 110, bdg: 90, actif: 70, n: 260, abr: 90, codeb: 110, cat1: 330 };
  const cw = (t, k) => cwLoad()["ach_" + t + "." + k] || ACH_W[k] || 100;
  const cellIn = (a, k) => {
    const ro = !!a.del;
    if (k === "code") return `<span class="ach-code">${esc(a.code)}</span>`;
    if (k === "bdg") { const n = achArtBudgets(a, BM).length; return n ? `<button type="button" class="ach-bdg" data-bdg="${esc(a.id)}">${n}</button>` : `<span class="ach-0">0</span>`; }
    if (k === "stk" || k === "actif") { const on = k === "stk" ? !!a.stk : a.actif !== false; return `<input type="checkbox" class="ach-ck" data-f="${k}"${on ? " checked" : ""}${ro ? " disabled" : ""}>`; }
    const num = k === "tva" || k === "pref" || k === "pmax";
    const v = num ? (achN(a[k]) || k === "tva" ? F2(a[k]) : "") : (a[k] || "");
    return `<input class="ins-in ach-in${num ? " number" : ""}${k === "u" ? " center" : ""}" data-f="${k}" value="${esc(v)}"${num ? ' inputmode="decimal"' : ""}${k === "cat" ? ' data-sug="cat"' : ""}${ro ? " readonly" : ""} autocomplete="off" enterkeyhint="next">`;
  };
  const artTable = () => {
    BM = achBudgetCharges();
    const all = achArts(), rows0 = all.filter(a => showDel ? !!a.del : !a.del);
    const cols = coOrder("ach_art", ART_COLS());
    const rows = cfApply("ach_art", cols, rows0);
    const nDel = all.filter(a => a.del).length, nSel = [...SEL].filter(id => rows0.some(a => a.id === id)).length;
    const W = cols.reduce((s, c) => s + cw("art", c[0]), 0) + 44 + 46;
    return `<div class="ach-tools">
        <span class="ach-cnt">${showDel ? "CORBEILLE" : "ARTICLES"} ${svCnt ? svCnt(rows.length, rows0.length) : rows.length}</span>
        ${showDel ? `<button type="button" class="ach-b" data-a="restore"${nSel ? "" : " disabled"}>RESTAURER LES COCHÉS <span class="svi-cnt">${nSel}</span></button><button type="button" class="ach-b" data-a="back">‹ RETOUR AUX ARTICLES</button>`
          : `<button type="button" class="ach-b" data-a="frombdg">REPRENDRE LES CHARGES DES BUDGETS</button>
             <button type="button" class="ach-b" data-a="merge"${nSel >= 2 ? "" : " disabled"}>FUSIONNER LES COCHÉS <span class="svi-cnt">${nSel}</span></button>
             <button type="button" class="ach-b" data-a="del"${nSel ? "" : " disabled"}>SUPPRIMER LES COCHÉS <span class="svi-cnt">${nSel}</span></button>
             <button type="button" class="ach-b" data-a="trash"${nDel ? "" : " disabled"}>CORBEILLE <span class="svi-cnt">${nDel}</span></button>`}
      </div>
      <div class="ach-scroll"><table id="achArtT" class="bdg-d-table prm-table ach-table" data-ach="art" style="width:${W}px">
        <colgroup><col style="width:46px">${cols.map(c => `<col data-w="ach_art.${c[0]}" style="width:${cw("art", c[0])}px">`).join("")}<col style="width:44px"></colgroup>
        <thead><tr><th class="center ach-hh">H</th>${cols.map(c => cfHead("ach_art", c[0], c[1], c[3])).join("")}<th class="center"><input type="checkbox" class="ach-all"${rows.length && rows.every(a => SEL.has(a.id)) ? " checked" : ""}></th></tr></thead>
        <tbody>${rows.map(a => { const why = achArtWhy(a); return `<tr data-id="${esc(a.id)}" data-iid="${esc(a.id)}" class="${why.length ? "ach-bad" : ""}${a.actif === false ? " ach-off" : ""}${a.del ? " ach-deleted" : ""}">
          <td class="center"><button type="button" class="ach-h" data-h="${esc(a.code)}" title="Historique">H</button>${why.length ? `<span class="ach-warn" data-why="${esc(why.join(" · "))}">⚠</span>` : ""}</td>
          ${cols.map(c => `<td class="${c[3]}">${cellIn(a, c[0])}</td>`).join("")}
          <td class="center ins-cbc"><input type="checkbox" class="ach-cb"${SEL.has(a.id) ? " checked" : ""}></td></tr>`; }).join("")}
          ${showDel ? "" : `<tr class="ach-new"><td></td>${cols.map(c => `<td class="${c[3]}">${c[0] === "des" ? `<input class="ins-in ach-newin" data-f="des" placeholder="CRÉER UN ARTICLE ICI…" autocomplete="off" enterkeyhint="next">` : ""}</td>`).join("")}<td></td></tr>`}
          ${!rows.length && showDel ? `<tr><td colspan="${cols.length + 2}" class="empty">CORBEILLE VIDE</td></tr>` : ""}
        </tbody></table></div>`;
  };
  /* ---------- PARAMÈTRES ---------- */
  const prmHTML = () => {
    const P = achPrm();
    const catRows = cfApply("ach_cat", [["cat1", "CATÉGORIE (FAMILLE D'ARTICLES)", x => x, ""]], P.cat);
    const bCols = coOrder("ach_bq", [["n", "BANQUE", b => b.n, ""], ["abr", "ABRÉVIATION", b => b.abr, "center"], ["codeb", "CODE RIB", b => b.code, "center"]]);
    const bRows = cfApply("ach_bq", bCols, P.banques);
    return `<div class="ach-prm">
      <div class="ach-pbox"><div class="ach-pt">TVA PAR DÉFAUT DES NOUVEAUX ARTICLES</div>
        <span class="ach-tvaw"><input class="ins-in ach-ptva number" inputmode="decimal" value="${esc(F2(P.tva))}" autocomplete="off"> %</span></div>
      <div class="ach-pbox"><div class="ach-pt">CATÉGORIES ${svCnt ? svCnt(catRows.length, P.cat.length) : ""}</div>
        <div class="ach-scroll"><table id="achCatT" class="bdg-d-table prm-table ach-table" data-ach="cat" style="width:${cw("cat", "cat1") + 44}px"><colgroup><col data-w="ach_cat.cat1" style="width:${cw("cat", "cat1")}px"><col style="width:44px"></colgroup>
          <thead><tr>${cfHead("ach_cat", "cat1", "CATÉGORIE (FAMILLE D'ARTICLES)")}<th class="center"></th></tr></thead>
          <tbody>${catRows.map(c => `<tr data-cat="${esc(c)}"><td><input class="ins-in ach-pin" data-p="cat" value="${esc(c)}" autocomplete="off"></td><td class="center"><button type="button" class="ach-x" data-xcat="${esc(c)}" title="Supprimer">✕</button></td></tr>`).join("")}
          <tr class="ach-new"><td><input class="ins-in ach-pnew" data-p="cat" placeholder="CRÉER UNE CATÉGORIE ICI…" autocomplete="off"></td><td></td></tr></tbody></table></div></div>
      <div class="ach-pbox"><div class="ach-pt">BANQUES ET CODES RIB ${svCnt ? svCnt(bRows.length, P.banques.length) : ""}</div>
        <div class="ach-scroll"><table id="achBqT" class="bdg-d-table prm-table ach-table" data-ach="bq" style="width:${bCols.reduce((s, c) => s + cw("bq", c[0]), 0) + 44}px"><colgroup>${bCols.map(c => `<col data-w="ach_bq.${c[0]}" style="width:${cw("bq", c[0])}px">`).join("")}<col style="width:44px"></colgroup>
          <thead><tr>${bCols.map(c => cfHead("ach_bq", c[0], c[1], c[3])).join("")}<th class="center"></th></tr></thead>
          <tbody>${bRows.map(b => `<tr data-bid="${esc(b.id)}" data-iid="${esc(b.id)}">${bCols.map(c => `<td class="${c[3]}"><input class="ins-in ach-bin${c[3] ? " " + c[3] : ""}" data-f="${c[0] === "codeb" ? "code" : c[0]}" value="${esc(c[0] === "codeb" ? b.code : b[c[0]])}" autocomplete="off"></td>`).join("")}<td class="center"><button type="button" class="ach-x" data-xbq="${esc(b.id)}" title="Supprimer">✕</button></td></tr>`).join("")}
          <tr class="ach-new"><td colspan="${bCols.length}"><input class="ins-in ach-bnew" placeholder="CRÉER UNE BANQUE ICI…" autocomplete="off"></td><td></td></tr></tbody></table></div>
        <div class="ach-note">CODE RIB : LES 3 PREMIERS CHIFFRES DU RIB (UNE PLAGE S'ÉCRIT 101-199) ; SERT À RECONNAÎTRE LA BANQUE D'UN RIB FOURNISSEUR.</div></div>
      <div class="ach-note">LES UNITÉS SONT CELLES DE PARAMÉTRAGE › UNITÉS, COMMUNES À TOUT LE SVI ERP.</div></div>`;
  };
  /* ---------- dessin ---------- */
  /* redessin sans bouger l'écran ; la case active (ou celle visée par Entrée / Tab) est retrouvée après */
  const keepPos = fn => {
    const sc = [...view.querySelectorAll(".ach-scroll")].map(e => [e.scrollTop, e.scrollLeft]), y = window.scrollY;
    const a = document.activeElement, tr = a && view.contains(a) && a.closest("tr");
    const fk = tr && a.dataset && a.dataset.f ? { id: tr.dataset.id || "", bid: tr.dataset.bid || "", f: a.dataset.f } : null;
    fn();
    view.querySelectorAll(".ach-scroll").forEach((e, i) => { if (sc[i]) { e.scrollTop = sc[i][0]; e.scrollLeft = sc[i][1]; } });
    window.scrollTo(window.scrollX, y);
    if (fk) { const r = fk.id ? view.querySelector(`tr[data-id="${CSS.escape(fk.id)}"]`) : fk.bid ? view.querySelector(`tr[data-bid="${CSS.escape(fk.bid)}"]`) : null;
      const x = r && r.querySelector(`input[data-f="${fk.f}"]`); if (x && !x.readOnly) { x.focus(); try { x.select(); } catch (e) {} } }
    /* Entrée / Tab de la navigation commune : la case visée (retirée par le redessin) est retrouvée dans le nouveau tableau */
    setTimeout(() => { const lg = window.__sviLastGo, a2 = document.activeElement;
      if (lg && lg.k && performance.now() - lg.t < 600 && (!a2 || a2 === document.body || !view.contains(a2)) && window.sviCellFind) { const el = window.sviCellFind(lg.k); if (el && el.isConnected && view.contains(el)) { el.focus(); try { el.select(); } catch (e) {} } } }, 0);
  };
  const draw = () => keepPos(() => {
    bar.querySelectorAll(".prm-tab").forEach(b => b.classList.toggle("on", b.dataset.ach === tab));
    if (h1) h1.textContent = tab === "prm" ? "ACHATS — PARAMÈTRES" : showDel ? "ACHATS — CORBEILLE DES ARTICLES" : "ACHATS — ARTICLES";
    if (sub) sub.textContent = tab === "prm" ? "CATÉGORIES, BANQUES, TVA PAR DÉFAUT ; COMMUNS À TOUS LES APPAREILS" : "UN ARTICLE = UNE CHARGE DU BUDGET (DÉSIGNATION + UNITÉ) ; COMMUN À TOUS LES BUDGETS ET À TOUS LES APPAREILS";
    body.innerHTML = tab === "prm" ? prmHTML() : artTable();
    body.querySelectorAll("input.ach-cb, input.ach-all").forEach(c => { if (c.classList.contains("ach-all")) { const n = body.querySelectorAll("input.ach-cb:checked").length, t = body.querySelectorAll("input.ach-cb").length; c.indeterminate = n > 0 && n < t; } });
  });
  view.__achDraw = draw;
  /* ---------- gestes ---------- */
  bar.addEventListener("click", e => {
    const b = e.target.closest(".prm-tab"); if (!b) return;
    if (b.classList.contains("off")) { svToast(b.dataset.why || "", 3000, b); return; }
    tab = b.dataset.ach; showDel = false; SEL.clear();
    try { localStorage.setItem("svi_ach_tab_v1", tab); } catch (err) {}
    draw();
  });
  const artOf = el => { const tr = el.closest("tr[data-id]"); if (!tr) return null; const L = achArts(); return { L, a: L.find(x => x.id === tr.dataset.id) }; };
  body.addEventListener("click", async e => {
    const cf = e.target.closest(".cf-btn"); if (cf) { e.stopPropagation(); cfOpenMenu(cf); return; }
    const w = e.target.closest(".ach-warn"); if (w) { svToast(w.dataset.why, 4000, w); return; }
    const hb = e.target.closest(".ach-h"); if (hb) { achHistWin(hb.dataset.h); return; }
    const bb = e.target.closest(".ach-bdg"); if (bb) { const L = achArts(), a = L.find(x => x.id === bb.dataset.bdg); if (a) achBdgWin(a); return; }
    const xc = e.target.closest("[data-xcat]"); if (xc) { const P = achPrm(); P.cat = P.cat.filter(c => c !== xc.dataset.xcat); achPrmSave(P); draw(); return; }
    const xb = e.target.closest("[data-xbq]"); if (xb) { const P = achPrm(); P.banques = P.banques.filter(b => b.id !== xb.dataset.xbq); achPrmSave(P); draw(); return; }
    const ab = e.target.closest(".ach-b"); if (!ab || ab.disabled) return;
    const L = achArts(), ids = [...SEL].filter(id => L.some(a => a.id === id));
    const act = ab.dataset.a;
    if (act === "trash") { showDel = true; SEL.clear(); draw(); return; }
    if (act === "back") { showDel = false; SEL.clear(); draw(); return; }
    if (act === "frombdg") {
      const n = achArtsFromBudgets(L);
      if (!n) { svToast("AUCUNE CHARGE DES BUDGETS SANS ARTICLE.", 3000, ab); return; }
      achArtsSave(L); svToast(n + " ARTICLE(S) CRÉÉ(S) DEPUIS LES CHARGES DES BUDGETS.", 3500, ab); draw(); return;
    }
    if (act === "del") {
      const A = ids.map(id => L.find(a => a.id === id)).filter(a => a && !a.del);
      if (!A.length || !(await svConfirm({ title: "METTRE À LA CORBEILLE", html: `<ul class="svc-list">${A.map(a => `<li>${esc(a.code + " — " + a.des)}</li>`).join("")}</ul><div class="svc-sub">RESTAURABLES DEPUIS LA CORBEILLE ; LEURS NUMÉROS NE SERONT PAS RÉUTILISÉS.</div>`, ok: "METTRE À LA CORBEILLE" }))) return;
      const t = new Date().toISOString(); A.forEach(a => { a.del = t; a.mod = t; achHist(a.code, "CORBEILLE", a.des); });
      achArtsSave(L); SEL.clear(); draw(); return;
    }
    if (act === "restore") {
      ids.forEach(id => { const a = L.find(x => x.id === id); if (!a || !a.del) return; if (achArtDup(L, a.des, a.u, a.id)) { svToast("RESTAURATION IMPOSSIBLE : " + a.code + " EXISTE DÉJÀ (MÊME DÉSIGNATION ET UNITÉ).", 4000, ab); return; } a.del = ""; delete a.mergedInto; a.mod = new Date().toISOString(); achHist(a.code, "RESTAURATION", a.des); });
      achArtsSave(L); SEL.clear(); draw(); return;
    }
    if (act === "merge") {
      const A = ids.map(id => L.find(a => a.id === id)).filter(a => a && !a.del);
      if (A.length < 2) return;
      if (new Set(A.map(a => achU(a.u))).size > 1) { svToast("FUSION IMPOSSIBLE : LES ARTICLES COCHÉS N'ONT PAS LA MÊME UNITÉ.", 4000, ab); return; }
      const keep = await svChooseArt(A); if (!keep) return;
      achArtMerge(L, keep.id, A.filter(a => a !== keep).map(a => a.id));
      achArtsSave(L); SEL.clear(); draw();
    }
  });
  body.addEventListener("change", e => {
    const t = e.target;
    /* case « CRÉER … ICI » : une seule création, même si « change » arrive deux fois (Entrée, puis case retirée) */
    if (t.matches && t.matches(".ach-newin, .ach-pnew, .ach-bnew")) { if (t.__achDone) return; t.__achDone = true; }
    if (t.classList.contains("ach-all")) { body.querySelectorAll("tr[data-id]").forEach(tr => { if (t.checked) SEL.add(tr.dataset.id); else SEL.delete(tr.dataset.id); }); draw(); return; }
    if (t.classList.contains("ach-cb")) { const tr = t.closest("tr[data-id]"); if (t.checked) SEL.add(tr.dataset.id); else SEL.delete(tr.dataset.id); draw(); return; }
    /* paramètres */
    if (t.classList.contains("ach-ptva")) { const P = achPrm(), v = achN(t.value); if (v < 0 || v > 100) { svToast("TVA NON VALIDE (0 À 100).", 3000, t); draw(); return; } P.tva = v; achPrmSave(P); draw(); return; }
    if (t.classList.contains("ach-pnew") || t.classList.contains("ach-pin")) {
      const P = achPrm(), v = achU(t.value), old = t.closest("tr").dataset.cat;
      if (v && P.cat.some(c => c === v && c !== old)) { svToast("DOUBLON : " + v + " EXISTE DÉJÀ.", 3000, t); draw(); return; }
      if (old !== undefined) { P.cat = v ? P.cat.map(c => c === old ? v : c) : P.cat.filter(c => c !== old); if (v && v !== old) { const L = achArts(); L.forEach(a => { if (a.cat === old) { a.cat = v; a.mod = new Date().toISOString(); } }); achArtsSave(L); } }
      else if (v) P.cat.push(v);
      achPrmSave(P); draw(); return;
    }
    if (t.classList.contains("ach-bnew")) { const v = achU(t.value); if (!v) return; const P = achPrm(); if (P.banques.some(b => achU(b.n) === v)) { svToast("DOUBLON : " + v + " EXISTE DÉJÀ.", 3000, t); draw(); return; } P.banques.push({ id: "B" + Date.now().toString(36), n: v, abr: "", code: "" }); achPrmSave(P); draw();
      setTimeout(() => body.querySelector(`tr[data-bid="${P.banques[P.banques.length - 1].id}"] input[data-f="abr"]`)?.focus(), 0); return; }
    if (t.classList.contains("ach-bin")) {
      const P = achPrm(), b = P.banques.find(x => x.id === t.closest("tr").dataset.bid); if (!b) return;
      const f = t.dataset.f, v = f === "code" ? String(t.value || "").replace(/[^\d\-,; ]/g, "").trim() : achU(t.value);
      if (f === "code" && v && !/^\d{3}(-\d{3})?([,; ]+\d{3}(-\d{3})?)*$/.test(v)) { svToast("CODE RIB : 3 CHIFFRES (EX. 007) OU UNE PLAGE (EX. 101-199).", 3500, t); draw(); return; }
      b[f] = v; achPrmSave(P); draw(); return;
    }
    /* articles */
    if (t.classList.contains("ach-newin")) {
      const v = achU(t.value); if (!v) return;
      const L = achArts(), a = achArtNew(L, { des: v, u: "" });
      achHist(a.code, "CRÉATION", v); achArtsSave(L); draw();
      setTimeout(() => body.querySelector(`tr[data-id="${a.id}"] input[data-f="u"]`)?.focus(), 0); return;
    }
    const o = artOf(t); if (!o || !o.a || o.a.del) return;
    const { L, a } = o, f = t.dataset.f;
    if (t.classList.contains("ach-ck")) { const old = f === "stk" ? !!a.stk : a.actif !== false; if (f === "stk") a.stk = t.checked; else a.actif = t.checked; a.mod = new Date().toISOString(); achHist(a.code, "MODIFICATION", (f === "stk" ? "STOCKÉ" : "ACTIF") + " : " + (old ? "OUI" : "NON") + " → " + (t.checked ? "OUI" : "NON")); achArtsSave(L); draw(); return; }
    if (!t.classList.contains("ach-in")) return;
    const num = f === "tva" || f === "pref" || f === "pmax";
    const v = num ? achN(t.value) : achU(t.value);
    if (num && String(t.value).trim() && !(typeof sviNumOk === "function" ? sviNumOk(t.value) : isFinite(achN(t.value)))) { svToast("NOMBRE NON VALIDE.", 3000, t); draw(); return; }
    if (f === "tva" && (v < 0 || v > 100)) { svToast("TVA NON VALIDE (0 À 100).", 3000, t); draw(); return; }
    if (f === "des" && !v) { svToast("DÉSIGNATION OBLIGATOIRE (POUR RETIRER L'ARTICLE : LE COCHER PUIS SUPPRIMER).", 3500, t); draw(); return; }
    const nx = { ...a, [f]: v };
    if (f === "des" || f === "u") {
      const d = achArtDup(L, nx.des, nx.u, a.id);
      if (d) { svToast("DOUBLON : " + d.code + " — " + d.des + " (" + d.u + ") EXISTE DÉJÀ.", 4000, t); draw(); return; }
      const nr = achArtNear(L, nx.des, nx.u, a.id);
      if (nr) svToast("PRESQUE IDENTIQUE À " + nr.code + " — " + nr.des + " : À FUSIONNER SI C'EST LE MÊME ARTICLE.", 4500, t);
    }
    if (f === "pref" && achN(a.pmax) > 0 && v > achN(a.pmax)) { svToast("PRIX DE RÉFÉRENCE AU-DESSUS DU PLAFOND (" + F2(a.pmax) + ").", 3500, t); draw(); return; }
    if (f === "pmax" && v > 0 && achN(a.pref) > v) { svToast("PLAFOND AU-DESSOUS DU PRIX DE RÉFÉRENCE (" + F2(a.pref) + ").", 3500, t); draw(); return; }
    if (f === "cat" && v && !achPrm().cat.includes(v)) { svToast("CATÉGORIE INCONNUE : LA CRÉER D'ABORD DANS ACHATS › PARAMÈTRES.", 3500, t); draw(); return; }
    const old = a[f];
    if (String(old ?? "") === String(v)) { draw(); return; }
    a[f] = v; a.mod = new Date().toISOString();
    const lab = { des: "DÉSIGNATION", u: "UNITÉ", cat: "CATÉGORIE", tva: "TVA %", pref: "PRIX RÉF. HT", pmax: "PLAFOND HT" }[f] || f;
    achHist(a.code, "MODIFICATION", lab + " : " + (num ? F2(old) : old || "—") + " → " + (num ? F2(v) : v || "—"));
    achArtsSave(L); draw();
  });
  /* catégories proposées sous la case (même liste que les unités) */
  body.addEventListener("input", e => {
    const i = e.target.closest('input[data-sug="cat"]'); if (!i) return;
    const q = achU(i.value), L = achPrm().cat.filter(c => !q || c.includes(q)).slice(0, 8);
    let b = document.getElementById("svUnitSug");
    if (!L.length) { b && b.remove(); return; }
    if (!b) { b = document.createElement("div"); b.id = "svUnitSug"; document.body.appendChild(b); }
    b.__for = i;
    b.innerHTML = L.map(c => `<button type="button" data-u="${esc(c)}"><b>${esc(c)}</b><span></span></button>`).join("");
    const r = i.getBoundingClientRect();
    b.style.left = Math.max(8, Math.min(r.left, window.innerWidth - b.offsetWidth - 8)) + "px";
    b.style.top = (r.bottom + 4 + b.offsetHeight <= (typeof sviViewH === "function" ? sviViewH() : window.innerHeight) - 8 ? r.bottom + 4 : Math.max(8, r.top - b.offsetHeight - 4)) + "px";
  });
  body.addEventListener("focusin", e => { const i = e.target.closest('input[data-sug="cat"]'); if (i) i.dispatchEvent(new Event("input", { bubbles: true })); });
  body.addEventListener("focusout", e => { if (e.target.closest('input[data-sug="cat"]')) setTimeout(() => { const b = document.getElementById("svUnitSug"); if (b && b.__for === e.target && document.activeElement !== e.target) b.remove(); }, 200); });
  /* largeur des colonnes (poignée du bord droit de l'en-tête) et ordre (glisser un en-tête) — même mémoire que le budget */
  body.addEventListener("pointerdown", e => {
    const h = e.target.closest(".col-rs");
    if (h) {
      e.preventDefault(); e.stopPropagation();
      const table = h.closest("table"), col = table.querySelector(`col[data-w="${h.dataset.rs}.${h.dataset.col}"]`); if (!col) return;
      const x0 = e.clientX, w0 = parseFloat(col.style.width) || col.getBoundingClientRect().width; let w = w0;
      h.classList.add("on");
      const mv = ev => { w = Math.max(28, Math.round(w0 + ev.clientX - x0)); col.style.width = w + "px"; table.style.width = [...table.querySelectorAll("col")].reduce((s, c) => s + (parseFloat(c.style.width) || 0), 0) + "px"; };
      const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up); h.classList.remove("on"); const all = cwLoad(); all[col.dataset.w] = w; cwSave(all); };
      document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
      return;
    }
    const th = e.target.closest("th"); if (!th || e.target.closest(".cf-btn, input") || !th.querySelector(".cf-btn")) return;
    const table = th.closest("table"), t = th.querySelector(".cf-btn").dataset.cf;
    const ths = () => [...table.querySelectorAll("thead tr:first-child > th")].filter(x => x.querySelector(".cf-btn"));
    const x0 = e.clientX; let on = false, target = null, ghost = null;
    const clear = () => ths().forEach(x => x.classList.remove("co-before", "co-after"));
    const mv = ev => {
      if (!on) { if (Math.abs(ev.clientX - x0) < 8) return; on = true; th.classList.add("co-src"); ghost = document.createElement("div"); ghost.id = "coGhost"; ghost.textContent = (th.querySelector(".cf-lab")?.textContent || "").trim(); document.body.appendChild(ghost); }
      ev.preventDefault(); ghost.style.left = ev.clientX + 8 + "px"; ghost.style.top = ev.clientY - 28 + "px"; clear(); target = null;
      const L = ths(); for (const x of L) { const r = x.getBoundingClientRect(); if (ev.clientX >= r.left && ev.clientX < r.right) { if (x !== th) { x.classList.add(L.indexOf(x) > L.indexOf(th) ? "co-after" : "co-before"); target = x; } break; } }
    };
    const up = () => {
      document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
      clear(); th.classList.remove("co-src"); ghost && ghost.remove();
      if (!on || !target) return;
      const keyOf = x => x.querySelector(".cf-btn").dataset.col, keys = ths().map(keyOf), from = keys.indexOf(keyOf(th)), to = keys.indexOf(keyOf(target));
      const [k] = keys.splice(from, 1); keys.splice(to, 0, k);
      const all = coLoad(); all[t] = keys; coSave(all);
      view.addEventListener("click", ev => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
      draw();
    };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
  });
  /* case « CRÉER … ICI » : Entrée ou Tab crée la ligne (avant la navigation commune, qui n'a pas de case suivante dans cette ligne) */
  window.addEventListener("keydown", e => {
    const i = e.target && e.target.closest && e.target.closest("#ach input.ach-newin, #ach input.ach-pnew, #ach input.ach-bnew");
    if (!i || (e.key !== "Enter" && e.key !== "Tab") || !String(i.value || "").trim()) return;
    e.preventDefault(); e.stopPropagation();
    /* la mise en majuscules pendant la frappe empêche le navigateur d'envoyer « change » : il est envoyé ici */
    i.dispatchEvent(new Event("change", { bubbles: true }));
    if (i.isConnected) i.blur();
  }, true);
  /* données reçues d'un autre appareil (base V3) : écran redessiné s'il est affiché */
  window.addEventListener("storage", () => { if (view.classList.contains("active-view")) draw(); });
  draw();
}
/* fenêtre H : historique d'un article */
function achHistWin(code) {
  const L = achHistGet(code).slice().reverse();
  const d = sviWinNew();
  d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true"><button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
    <div class="svc-t">HISTORIQUE — ${esc(code)}</div>
    <div class="svc-scroll"><table class="prm-table"><thead><tr><th>DATE</th><th>ACTION</th><th>DÉTAIL</th><th>PAR</th></tr></thead><tbody>
    ${L.map(h => `<tr><td>${esc(new Date(h.t).toLocaleString("fr-FR").replace(" ", " À ").slice(0, 21))}</td><td>${esc(h.a)}</td><td>${esc(h.d)}</td><td>${esc(h.u || "")}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">AUCUNE ACTION</td></tr>`}</tbody></table></div>
    <div class="svc-f"><button type="button" class="svc-b" data-x>FERMER</button></div></div>`;
  sviWinShow(d);
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) d.remove(); });
}
/* fenêtre BUDGETS : où l'article est prévu (lien budget) */
function achBdgWin(a) {
  const x = achBudgetCharges().get(achKey(a.des, a.u));
  const refs = x ? [...x.refs].filter(Boolean).sort() : [];
  const d = sviWinNew();
  d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true"><button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
    <div class="svc-t">BUDGETS — ${esc(a.code)}</div><div class="svc-sub">${esc(a.des)} (${esc(a.u)})</div>
    <ul class="svc-list">${refs.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
    ${x ? `<div class="svc-sub">QUANTITÉ PRÉVUE : ${esc((Math.round(x.q * 100) / 100).toLocaleString("fr-FR"))} ${esc(a.u)} · MONTANT HT : ${esc(x.mt.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}</div>` : ""}
    <div class="svc-f"><button type="button" class="svc-b" data-x>FERMER</button></div></div>`;
  sviWinShow(d);
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) d.remove(); });
}
/* fenêtre FUSIONNER : choix de l'article gardé */
function svChooseArt(A) {
  return new Promise(ok => {
    const d = sviWinNew();
    d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true"><button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
      <div class="svc-t">FUSIONNER ${A.length} ARTICLES</div><div class="svc-sub">CHOISIR L'ARTICLE GARDÉ ; LES AUTRES VONT À LA CORBEILLE AVEC LA MENTION « FUSIONNÉ DANS ».</div>
      <div class="ach-pick">${A.map((a, i) => `<label><input type="radio" name="achkeep" value="${i}"${i ? "" : " checked"}> <b>${esc(a.code)}</b> — ${esc(a.des)} (${esc(a.u)})</label>`).join("")}</div>
      <div class="svc-f"><button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>FUSIONNER</button></div></div>`;
    sviWinShow(d);
    d.addEventListener("click", e => {
      if (e.target === d || e.target.closest("[data-x]")) { d.remove(); ok(null); return; }
      if (e.target.closest("[data-ok]")) { const i = Number((d.querySelector('input[name="achkeep"]:checked') || {}).value || 0); d.remove(); ok(A[i]); }
    });
  });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sviAchInit); else sviAchInit();
document.addEventListener("click", e => { if (e.target.closest && e.target.closest('.nav-btn[data-view="ach"]')) setTimeout(() => { const v = document.getElementById("ach"); if (v && v.__achDraw) v.__achDraw(); }, 0); });
