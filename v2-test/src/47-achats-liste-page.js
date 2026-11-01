/* =========================================================
   v764 : LISTES ET PAGES DES ACHATS AU FORMAT DU BUDGET (décision d'Ahmed du 01/11/2026, d'après NovApp)
   LISTE : deux listes, EN INSTANCE et VALIDÉS, basculées par l'icône à côté du titre (comme les budgets) ; à gauche le
   tableau des dates (bouton d'état ACTIF ▾, une ligne par date avec son nombre ; toucher une date filtre la liste) ;
   en bas une ligne CRÉER … ICI toujours visible : elle ouvre la fenêtre de saisie (tous les champs) ; après ENREGISTRER,
   l'élément prend sa place en instance et la ligne vide attend en bas. Les éléments en instance sont en rouge, avec la corbeille.
   PAGE (toucher la référence) : comme la page d'un budget — en-tête (référence, H, nom), toucher le NOM ouvre la fenêtre des
   informations ; DOCUMENTS / TAF / OBSERVATIONS dans UN bloc à trois onglets ; menu ⋯ (VALIDER, UNITÉ DE CONVERSION…) ;
   dessous, les tableaux liés (consultations, devis, commandes…). ‹ › : élément précédent / suivant de la liste.
   Appliqué aux ARTICLES et aux FOURNISSEURS ; les autres listes suivront.
   ========================================================= */
const achSt = x => x && x.st === "instance" ? "instance" : "valide";
const achDay = v => String(v || "").slice(0, 10);
const ACH_TRASH = `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>`;
const ACH_SW = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ---------- bloc DOCUMENTS / TAF / OBSERVATIONS d'un élément des achats (clés partagées svi_docs|taf|obs_v1:ACH-<code>) ---------- */
function achRecBlock(code) {
  const K = { doc: "svi_docs_v1:ACH-" + code, taf: "svi_taf_v1:ACH-" + code, obs: "svi_obs_v1:ACH-" + code };
  const get = k => { const L = achJ(K[k], []); return Array.isArray(L) ? L : []; };
  let tab = "doc"; try { const t = localStorage.getItem("svi_ach_rtab_v1"); if (K[t]) tab = t; } catch (e) {}
  const dt = v => svDT ? svDT(v || "") : String(v || "");
  const html = () => {
    const L = get(tab);
    const head = { doc: ["RÉFÉRENCE", "DATE", "INTITULÉ", "FICHIER"], taf: ["RÉFÉRENCE", "DATE", "TÂCHE", "ÉCHÉANCE", "FAIT"], obs: ["DATE", "OBSERVATION", "IMPORTANTE"] }[tab];
    const row = (x, i) => tab === "doc" ? `<td>${esc(x.ref || "")}</td><td>${esc(dt(x.date))}</td><td>${esc(x.title || "")}</td><td class="center">${x.fk ? `<button type="button" class="ach-link" data-recf="${i}">OUVRIR</button>` : ""}</td>`
      : tab === "taf" ? `<td>${esc(x.ref || "")}</td><td>${esc(dt(x.date))}</td><td>${esc(x.title || "")}</td><td>${esc(achDFr(x.ech))}</td><td class="center"><input type="checkbox" class="rec-done" data-i="${i}"${x.done ? " checked" : ""}></td>`
      : `<td>${esc(dt(x.date))}</td><td>${esc(x.text || "")}</td><td class="center">${x.important ? "<b>!</b>" : ""}</td>`;
    return `<div class="bdg-d-block blk-rec nvp-rec"><div class="bdg-d-block-title blk-head"><span class="rec-tabs">
        ${["doc", "taf", "obs"].map(k => `<button type="button" class="rec-tab${k === tab ? " active" : ""}" data-nvr="${k}">${SVI_ICON[k] || ""}${{ doc: "DOCUMENTS", taf: "TAF", obs: "OBSERVATIONS" }[k]} ${svCnt(get(k).length)}</button>`).join("")}</span>
        <span class="blk-tools"><button type="button" class="blk-btn" data-nvradd title="AJOUTER"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button></span></div>
      <div class="rec-scroll"><table class="bdg-d-table rec-table"><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${L.slice().reverse().map((x, j) => `<tr>${row(x, L.length - 1 - j)}</tr>`).join("") || `<tr><td colspan="${head.length}" class="empty">${{ doc: "AUCUN DOCUMENT", taf: "AUCUNE TÂCHE", obs: "AUCUNE OBSERVATION" }[tab]}</td></tr>`}</tbody></table></div></div>`;
  };
  const add = () => new Promise(ok => {
    const d = sviWinNew(), now = new Date().toISOString();
    d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: { doc: "NOUVEAU DOCUMENT", taf: "NOUVELLE TÂCHE", obs: "NOUVELLE OBSERVATION" }[tab] + " — " + esc(code),
      body: `<div class="frs-g">${tab === "obs" ? `<label class="frs-f frs-w"><span>OBSERVATION <b>*</b></span><input class="ins-in nr-t" autocomplete="off"></label><div class="frs-cs"><label class="frs-c"><input type="checkbox" class="nr-i"> IMPORTANTE (!)</label></div>`
        : `<label class="frs-f frs-w"><span>${tab === "doc" ? "INTITULÉ" : "TÂCHE"} <b>*</b></span><input class="ins-in nr-t" autocomplete="off"></label>${tab === "doc" ? `<label class="frs-f frs-w"><span>FICHIER</span><input type="file" class="nr-f"></label>` : `<label class="frs-f"><span>ÉCHÉANCE</span><input type="date" class="ins-in nr-e"></label>`}`}</div>`,
      foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button>` });
    sviWinShow(d);
    d.addEventListener("click", async e => {
      if (e.target === d || e.target.closest("[data-x]")) { d.remove(); ok(false); return; }
      if (!e.target.closest("[data-ok]")) return;
      const t = achU(d.querySelector(".nr-t").value); if (!t) { svToast("À REMPLIR.", 2500); return; }
      const L = get(tab), n = L.length + 1, x = tab === "obs" ? { date: now, text: t, important: d.querySelector(".nr-i").checked } : { ref: "ACH " + (tab === "doc" ? "DOC" : "TAF") + " " + code + "/" + String(n).padStart(3, "0"), date: now, title: t };
      if (tab === "taf") x.ech = d.querySelector(".nr-e").value;
      const f = tab === "doc" && d.querySelector(".nr-f").files[0];
      if (f) { try { const k = "ach:doc:" + code + ":" + Date.now().toString(36); await sviFiles.put(k, f); x.fk = k; x.fname = f.name; } catch (err) {} }
      L.push(x); achW(K[tab], L); achHist(code, tab === "obs" ? "OBSERVATION" : tab === "doc" ? "DOCUMENT" : "TAF", t); d.remove(); ok(true);
    });
  });
  /* rend true si le geste concerne le bloc ; redraw() redessine la page */
  const click = async (e, redraw) => {
    const t = e.target.closest("[data-nvr]"); if (t) { tab = t.dataset.nvr; try { localStorage.setItem("svi_ach_rtab_v1", tab); } catch (err) {} redraw(); return true; }
    if (e.target.closest("[data-nvradd]")) { if (await add()) redraw(); return true; }
    const f = e.target.closest("[data-recf]"); if (f) { const x = get("doc")[+f.dataset.recf]; if (x && x.fk) achCopyOpen(x.fk); return true; }
    return false;
  };
  const change = e => { const c = e.target.closest(".rec-done"); if (!c) return false; const L = get("taf"), x = L[+c.dataset.i]; if (x) { x.done = c.checked; achW(K.taf, L); } return true; };
  return { html, click, change };
}

/* ---------- LISTE au format du budget ----------
   o = { k, t, name ("ARTICLES"), one ("ARTICLE"), all(), save(L), code(x), nom(x), cols(mode), why(x), newRow, add(done), page(id) } */
function achNvList(ctx, o) {
  const { cfApply, cfHead, draw } = ctx;
  const ETATS = [["actif", "ACTIF"], ["inactif", "INACTIF"], ["corbeille", "CORBEILLE"], ["tout", "TOUT"]];
  const KM = "svi_ach_" + o.k + "_mode_v1", KE = "svi_ach_" + o.k + "_etat2_v1";
  let mode = "valid", etat = "actif", dSel = "", order = [];
  try { mode = localStorage.getItem(KM) === "inst" ? "inst" : "valid"; const e0 = localStorage.getItem(KE); if (ETATS.some(x => x[0] === e0)) etat = e0; } catch (e) {}
  /* v765 : crochets pour les pièces (consultations, devis, commandes…) — o.etats / o.ok, o.inst, o.dI / o.dV, o.kill, o.bang */
  if (o.etats) ETATS.splice(0, ETATS.length, ...o.etats);
  const isI = x => o.inst ? !!o.inst(x) : achSt(x) === "instance";
  const eOk = (x, k, L) => o.ok ? o.ok(x, k, L) : k === "tout" ? true : k === "corbeille" ? !!x.del : !x.del && (k === "inactif" ? x.actif === false : x.actif !== false);
  const mOk = x => mode === "inst" ? isI(x) : !isI(x);
  const dOf = x => mode === "inst" ? achDay(o.dI ? o.dI(x) : x.cree) : achDay(o.dV ? o.dV(x) : x.val || x.cree);
  const cwX = k => (cwLoad()[o.t + "." + k]) || (o.w || {})[k] || 120;
  const counts = () => { const A = o.all(), L = A.filter(x => eOk(x, etat, A)); return { inst: L.filter(isI).length, valid: L.filter(x => !isI(x)).length }; };
  const h1 = () => {
    const n = counts(); if (!n[mode] && n[mode === "inst" ? "valid" : "inst"]) mode = mode === "inst" ? "valid" : "inst";
    const other = mode === "inst" ? "valid" : "inst", can = n[other] > 0;
    return esc(o.name) + (mode === "inst" ? " (EN INSTANCE)" : " (VALIDÉS)") + " " + svCnt(n[mode]) + ` <button type="button" class="bdg-mode-sw nv-sw${can ? "" : " off"}" data-nvsw title="${can ? (other === "inst" ? "VOIR LA LISTE EN INSTANCE" : "VOIR LA LISTE DES VALIDÉS") : (other === "inst" ? "RIEN EN INSTANCE." : "RIEN DE VALIDÉ.")}">${ACH_SW}</button>`;
  };
  const html = () => {
    h1();
    const all = o.all(), base = all.filter(x => eOk(x, etat, all) && mOk(x));
    const days = [...base.reduce((m, x) => m.set(dOf(x), (m.get(dOf(x)) || 0) + 1), new Map())].sort((a, b) => b[0].localeCompare(a[0]));
    if (dSel && !days.some(d => d[0] === dSel)) dSel = "";
    const rows0 = base.filter(x => !dSel || dOf(x) === dSel), cols = coOrder(o.t, o.cols(mode)), rows = cfApply(o.t, cols, rows0);
    order = rows.map(x => x.id);
    const inst = mode === "inst", W = cols.reduce((s, c) => s + cwX(c[0]), 0) + (inst ? 40 : 0);
    const cell = (x, c) => { const v = c[2](x);
      const bg = c[0] === (o.bang || "nom") ? (w => w.length ? `<span class="ach-warn nv-bang" data-why="${esc(w.join(" · "))}">!</span> ` : "")(o.why(x, all)) : "";
      if (c[0] === "ref") return bg + `<button type="button" class="ach-link nv-ref" data-nvo="${esc(x.id)}">${esc(v)}</button>`;
      if (bg) return bg + esc(v);
      return esc(typeof v === "number" ? achF2(v) : v); };
    return `<div class="nv-wrap">
      <div class="nv-dates"><button type="button" class="ach-b ach-etat nv-etat" data-a="${o.k}-etat">${(ETATS.find(x => x[0] === etat) || ETATS[0])[1]} ▾ ${svCnt(base.length)}</button>
        ${days.map(([d, n]) => `<button type="button" class="nv-day${d === dSel ? " on" : ""}" data-nvday="${esc(d)}"><span>${esc(achDFr(d) || "SANS DATE")}</span>${svCnt(n)}</button>`).join("") || `<div class="nv-none">—</div>`}</div>
      <div class="ach-scroll nv-scroll"><table id="${o.id}" class="bdg-d-table prm-table ach-table nv-table${inst ? " nv-inst" : ""}" data-ach="${o.k}" style="width:${W}px">
        <colgroup>${cols.map(c => `<col data-w="${o.t}.${c[0]}" style="width:${cwX(c[0])}px">`).join("")}${inst ? `<col style="width:40px">` : ""}</colgroup>
        <thead><tr>${cols.map(c => cfHead(o.t, c[0], c[1], c[3])).join("")}${inst ? "<th></th>" : ""}</tr></thead>
        <tbody>${rows.map(x => `<tr data-id="${esc(x.id)}" data-iid="${esc(x.id)}" class="nv-row${x.actif === false ? " ach-off" : ""}${x.del ? " ach-deleted" : ""}">${cols.map(c => `<td class="${c[3]}">${cell(x, c)}</td>`).join("")}${inst ? `<td class="center">${x.del || x.state === "annule" ? "" : `<button type="button" class="nv-del" data-nvdel="${esc(x.id)}" title="METTRE À LA CORBEILLE">${ACH_TRASH}</button>`}</td>` : ""}</tr>`).join("")}
          ${etat === "corbeille" || etat === "inactif" || etat === "annule" ? "" : `<tr class="ach-new nv-new" data-nvnew><td colspan="${cols.length + (inst ? 1 : 0)}">${esc(o.newRow)}</td></tr>`}</tbody></table></div></div>`;
  };
  const click = async e => {
    if (e.target.closest("[data-nvsw]")) { const b = e.target.closest("[data-nvsw]"); if (b.classList.contains("off")) { svToast(b.title, 2500, b); return true; } mode = mode === "inst" ? "valid" : "inst"; dSel = ""; try { localStorage.setItem(KM, mode); } catch (err) {} draw(); return true; }
    const dy = e.target.closest("[data-nvday]"); if (dy) { dSel = dSel === dy.dataset.nvday ? "" : dy.dataset.nvday; draw(); return true; }
    const eb = e.target.closest(`[data-a="${o.k}-etat"]`);
    if (eb) { const L = o.all(); sviEtatMenu(eb, ETATS.map(([k, lab]) => ({ k, lab, n: L.filter(x => eOk(x, k, L) && mOk(x)).length })), etat, k => { etat = k; try { localStorage.setItem(KE, k); } catch (err) {} draw(); }); return true; }
    const w = e.target.closest(".nv-bang"); if (w) { e.stopPropagation(); svToast(w.dataset.why, 4000, w); return true; }
    const dl = e.target.closest("[data-nvdel]");
    if (dl && o.kill) { const x = o.all().find(y => y.id === dl.dataset.nvdel); if (x && await o.kill(x)) draw(); return true; }
    if (dl) { const L = o.all(), x = L.find(y => y.id === dl.dataset.nvdel); if (!x) return true;
      if (!(await svConfirm({ title: "METTRE À LA CORBEILLE", text: o.code(x) + " — " + o.nom(x) + " (RESTAURABLE ; SON NUMÉRO NE SERA PAS RÉUTILISÉ).", ok: "METTRE À LA CORBEILLE" }))) return true;
      x.del = achNow(); x.mod = x.del; o.save(L); achHist(o.code(x), "CORBEILLE", o.nom(x)); draw(); return true; }
    if (e.target.closest("[data-nvnew]")) { o.add(id => { if (id) { mode = "inst"; try { localStorage.setItem(KM, mode); } catch (err) {} } draw(); }); return true; }
    const r = e.target.closest("[data-nvo]") || (e.target.closest("tr.nv-row") && !e.target.closest("input, button, .cf-btn") ? e.target.closest("tr.nv-row") : null);
    if (r) { o.page(r.dataset.nvo || r.dataset.id); return true; }
    return false;
  };
  return { html, click, h1, order: () => order };
}

/* ---------- PAGE d'un élément ----------
   p = { id, code, nom, title, st, why[], del, info(), menu: [{k, lab}], act(k), links: [{ t, cols:[lab…], rows:[{cells:[…], cls, open}] }] } */
function achNvPageHTML(p, rec) {
  return `<div class="nvp">
    <div class="nvp-bar"><span class="nvp-tools"><button type="button" class="nvp-ic" data-nvp="prev" title="PRÉCÉDENT">‹</button><button type="button" class="nvp-ic" data-nvp="next" title="SUIVANT">›</button>
      <button type="button" class="nvp-ic" data-nvp="more" title="MENU">⋯</button><button type="button" class="nvp-ic" data-nvp="close" title="FERMER">✕</button></span></div>
    <div class="nvp-card${p.st === "instance" ? " nvp-inst" : ""}">
      <div class="nvp-top"><span class="nvp-code">${esc(p.code)}</span><button type="button" class="ach-h" data-h="${esc(p.code)}" title="Historique">H</button>
        <span class="nvp-st">${p.del ? "CORBEILLE" : p.st === "instance" ? "EN INSTANCE" : "VALIDÉ"}${p.inactif ? " · INACTIF" : ""}</span></div>
      <button type="button" class="nvp-name" data-nvp="info" title="INFORMATIONS">${p.why.length ? "! " : ""}${esc(p.title)}</button>
      ${p.why.length ? `<div class="frs-why">⚠ ${p.why.map(esc).join(" · ")}</div>` : ""}</div>
    ${rec.html()}
    ${p.links.map(L => `<div class="bdg-d-block nvp-blk"><div class="bdg-d-block-title blk-head"><span class="ttl">${esc(L.t)} ${svCnt(L.rows.length)}</span></div>
      <div class="rec-scroll"><table class="bdg-d-table rec-table"><thead><tr>${L.cols.map(c => `<th class="${c[1] || ""}">${esc(c[0])}</th>`).join("")}</tr></thead>
      <tbody>${L.rows.map((r, i) => `<tr class="${r.cls || ""}">${r.cells.map((v, j) => `<td class="${L.cols[j][1] || ""}">${j === 0 && r.open ? `<button type="button" class="ach-link" data-nvl="${esc(L.t)}|${i}">${esc(v)}</button>` : esc(typeof v === "number" ? achF2(v) : v)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${L.cols.length}" class="empty">AUCUN</td></tr>`}</tbody></table></div></div>`).join("")}
  </div>`;
}
/* module complet liste + page : cfg = { list: options de achNvList (sans page), pageOf(id) → p, back } */
function achNvMod(ctx, cfg) {
  let pid = null, P = null, rec = null;
  const open = id => { pid = id; rec = null; ctx.draw(); };
  const LST = achNvList(ctx, { ...cfg.list, page: open });
  const html = () => {
    if (pid) { P = cfg.pageOf(pid); if (!P) pid = null; }
    if (!pid) return LST.html();
    if (!rec || rec.__c !== P.code) { rec = achRecBlock(P.code); rec.__c = P.code; }
    return achNvPageHTML(P, rec);
  };
  const h1 = () => pid && P ? esc(cfg.list.one) + " — " + esc(P.title) : LST.h1();
  const click = async e => {
    if (!pid) return LST.click(e);
    if (await rec.click(e, () => ctx.draw())) return true;
    const b = e.target.closest("[data-nvp]");
    if (b) { const k = b.dataset.nvp, ord = LST.order(), i = ord.indexOf(pid);
      if (k === "close") { pid = null; ctx.draw(); return true; }
      if (k === "prev" || k === "next") { const j = i + (k === "next" ? 1 : -1); if (i < 0 || j < 0 || j >= ord.length) { svToast(k === "next" ? "DERNIER DE LA LISTE." : "PREMIER DE LA LISTE.", 2000, b); return true; } open(ord[j]); return true; }
      if (k === "info") { P.info(() => ctx.draw()); return true; }
      if (k === "more") { sviEtatMenu(b, P.menu.map(m => ({ k: m.k, lab: m.lab })), "", async a => { await P.act(a, () => ctx.draw(), id => open(id)); }); return true; }
    }
    const l = e.target.closest("[data-nvl]"); if (l) { const [t, i] = l.dataset.nvl.split("|"), L = P.links.find(x => x.t === t), r = L && L.rows[+i]; if (r && r.open) r.open(() => ctx.draw()); return true; }
    return false;
  };
  const change = e => pid && rec ? rec.change(e) : false;
  return { html, click, change, h1, open, close: () => { pid = null; }, isPage: () => !!pid };
}

/* ---------- ARTICLES ---------- */
/* fenêtre des informations d'un article (création si id = null : l'article naît EN INSTANCE) */
function achArtFiche(id, done) {
  const a0 = id ? achArts().find(x => x.id === id) : null; if (id && !a0) return;
  const A = a0 ? JSON.parse(JSON.stringify(a0)) : { des: "", u: "", cat: "", stk: false, tva: achPrm().tva, pref: 0, pmax: 0, actif: true, cpt: "", cptI: "" };
  const ro = !!(a0 && a0.del), dis = ro ? " readonly" : "", d = sviWinNew(), P = achPrm();
  const inp = (k, lab, o = {}) => `<label class="frs-f${o.w ? " frs-w" : ""}"><span>${lab}${o.req ? " <b>*</b>" : ""}</span><input class="ins-in art-x${o.num ? " number" : ""}" data-k="${k}" value="${esc(o.num ? (achN(A[k]) || k === "tva" ? achF2(A[k]) : "") : A[k] ?? "")}"${o.num ? ' inputmode="decimal"' : ""}${o.list ? ` list="artL-${k}"` : ""}${dis} autocomplete="off">${o.list ? `<datalist id="artL-${k}">${o.list.map(x => `<option value="${esc(x)}">`).join("")}</datalist>` : ""}</label>`;
  const units = (() => { try { return (typeof sviUnits === "function" ? sviUnits() : []).map(u => u.a || u).filter(Boolean); } catch (e) { return []; } })();
  d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: a0 ? esc(a0.des + " (" + a0.u + ") : " + a0.code) : "NOUVEL ARTICLE",
    body: `<div class="frs-scroll"><div class="frs-g">${inp("des", "DÉSIGNATION", { req: 1, w: 1 })}${inp("u", "UNITÉ", { req: 1, list: units })}${inp("cat", "CATÉGORIE", { req: 1, list: P.cat })}
      ${inp("pref", "PRIX DE RÉFÉRENCE HT", { num: 1 })}${inp("pmax", "PLAFOND HT", { num: 1 })}${inp("tva", "TVA %", { num: 1 })}
      ${inp("cpt", "CODE COMPTABLE")}${inp("cptI", "INTITULÉ COMPTABLE")}
      <div class="frs-cs"><label class="frs-c"><input type="checkbox" class="art-c" data-k="stk"${A.stk ? " checked" : ""}${ro ? " disabled" : ""}> STOCKÉ</label><label class="frs-c"><input type="checkbox" class="art-c" data-k="actif"${A.actif !== false ? " checked" : ""}${ro ? " disabled" : ""}> ACTIF</label></div></div></div>`,
    foot: `<button type="button" class="svc-b" data-x>ANNULER</button>${ro ? "" : `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button>`}` });
  sviWinShow(d);
  d.addEventListener("click", e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (done) done(null); return; }
    if (!e.target.closest("[data-save]")) return;
    d.querySelectorAll(".art-x").forEach(i => { const k = i.dataset.k; A[k] = ["tva", "pref", "pmax"].includes(k) ? achN(i.value) : achU(i.value); });
    d.querySelectorAll(".art-c").forEach(i => { A[i.dataset.k] = i.checked; });
    const L = achArts();
    if (!A.des || !A.u) { svToast("DÉSIGNATION ET UNITÉ OBLIGATOIRES.", 3000); return; }
    if (!A.cat) { svToast("CATÉGORIE OBLIGATOIRE.", 3000); return; }
    if (!P.cat.includes(A.cat)) { svToast("CATÉGORIE INCONNUE : LA CRÉER D'ABORD DANS ACHATS › PARAMÈTRES.", 3500); return; }
    if (A.tva < 0 || A.tva > 100) { svToast("TVA NON VALIDE (0 À 100).", 3000); return; }
    if (A.pmax > 0 && A.pref > A.pmax) { svToast("PRIX DE RÉFÉRENCE AU-DESSUS DU PLAFOND.", 3000); return; }
    const dup = achArtDup(L, A.des, A.u, a0 ? a0.id : ""); if (dup) { svToast("DOUBLON : " + dup.code + " — " + dup.des + " (" + dup.u + ") EXISTE DÉJÀ.", 4000); return; }
    const nr = achArtNear(L, A.des, A.u, a0 ? a0.id : ""); if (nr) svToast("PRESQUE IDENTIQUE À " + nr.code + " — " + nr.des + " : À FUSIONNER SI C'EST LE MÊME ARTICLE.", 4500);
    let a;
    if (a0) { a = L.find(x => x.id === a0.id); const LAB = { des: "DÉSIGNATION", u: "UNITÉ", cat: "CATÉGORIE", stk: "STOCKÉ", tva: "TVA", pref: "PRIX RÉF.", pmax: "PLAFOND", actif: "ACTIF", cpt: "CODE COMPTABLE", cptI: "INTITULÉ COMPTABLE" };
      const ch = Object.keys(LAB).filter(k => JSON.stringify(a[k] ?? "") !== JSON.stringify(A[k] ?? "")); Object.assign(a, A, { mod: achNow() }); if (ch.length) achHist(a.code, "MODIFICATION", ch.map(k => LAB[k]).join(", ")); }
    else { a = achArtNew(L, A); a.st = "instance"; a.cpt = A.cpt; a.cptI = A.cptI; achHist(a.code, "CRÉATION", a.des + " (" + a.u + ")"); }
    achArtsSave(L); d.remove(); if (done) done(a.id);
  });
}
/* UNITÉ DE CONVERSION (menu ⋯ de l'article) : 1 unité de l'article = RATIO unité cible */
function achArtCv(id, done) {
  const L0 = achArts(), a0 = L0.find(x => x.id === id); if (!a0) return;
  const C = JSON.parse(JSON.stringify(a0.cv || [])), d = sviWinNew();
  const draw = () => {
    d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: "UNITÉ DE CONVERSION — " + esc(a0.des + " (" + a0.u + ")"),
      body: `<table class="prm-table frs-sub"><thead><tr><th>UNITÉ CIBLE</th><th class="number">RATIO</th><th>CONVERSION</th><th></th></tr></thead><tbody>
        ${C.map((c, i) => `<tr data-i="${i}"><td><input class="ins-in cv-x" data-c="u" value="${esc(c.u)}" autocomplete="off"></td><td><input class="ins-in cv-x number" data-c="r" inputmode="decimal" value="${esc(c.r ? String(c.r).replace(".", ",") : "")}"></td>
          <td>${c.u && c.r ? esc("1 " + a0.u + " = " + String(c.r).replace(".", ",") + " " + c.u) : "—"}</td><td class="center"><button type="button" class="ach-x" data-rm="${i}">✕</button></td></tr>`).join("") || `<tr><td colspan="4" class="empty">AUCUNE CONVERSION</td></tr>`}</tbody></table>
        <button type="button" class="ach-b" data-add>+ CONVERSION</button>`,
      foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button>` });
    if (!d.isConnected) sviWinShow(d);
  };
  const pull = () => d.querySelectorAll("tr[data-i]").forEach(tr => { const c = C[+tr.dataset.i]; tr.querySelectorAll(".cv-x").forEach(i => { c[i.dataset.c] = i.dataset.c === "r" ? achN(i.value) : achU(i.value); }); });
  draw();
  d.addEventListener("change", e => { if (e.target.closest(".cv-x")) { pull(); draw(); } });
  d.addEventListener("click", e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (done) done(); return; }
    if (e.target.closest("[data-add]")) { pull(); C.push({ u: "", r: 0 }); draw(); return; }
    const rm = e.target.closest("[data-rm]"); if (rm) { pull(); C.splice(+rm.dataset.rm, 1); draw(); return; }
    if (!e.target.closest("[data-save]")) return;
    pull(); const K = C.filter(c => c.u || c.r);
    if (K.some(c => !c.u || !(c.r > 0))) { svToast("CHAQUE CONVERSION : UNITÉ CIBLE ET RATIO (> 0).", 3000); return; }
    if (K.some(c => c.u === a0.u)) { svToast("L'UNITÉ CIBLE DOIT DIFFÉRER DE L'UNITÉ DE L'ARTICLE.", 3000); return; }
    if (new Set(K.map(c => c.u)).size < K.length) { svToast("MÊME UNITÉ CIBLE DEUX FOIS.", 3000); return; }
    const L = achArts(), a = L.find(x => x.id === id); a.cv = K; a.mod = achNow(); achArtsSave(L); achHist(a.code, "UNITÉ DE CONVERSION", K.map(c => "1 " + a.u + " = " + c.r + " " + c.u).join(" · ") || "AUCUNE");
    d.remove(); if (done) done();
  });
}
/* validation d'un élément (articles, fournisseurs) : contrôles puis confirmation */
async function achNvValider(L, x, code, nom, why, save) {
  if (why.length) { svToast("VALIDATION IMPOSSIBLE : " + why.join(" · "), 4500); return false; }
  if (!(await svConfirm({ title: "VALIDER", text: code + " — " + nom + " PASSE DANS LA LISTE DES VALIDÉS.", ok: "VALIDER", tone: "neutral" }))) return false;
  x.st = "valide"; x.val = achNow(); x.mod = x.val; save(L); achHist(code, "VALIDATION", nom); return true;
}
function achArtNvMod(ctx) {
  const same = (l, a) => achKey(l.des, l.u) === achKey(a.des, a.u);
  const artWhy = a => achArtWhy(a).concat(a.cat ? [] : ["CATÉGORIE MANQUANTE"]);
  return achNvMod(ctx, {
    list: { k: "art", t: "ach_art2", id: "achArtT", name: "ARTICLES", one: "ARTICLE", all: achArts, save: achArtsSave, code: a => a.code, nom: a => a.des, why: artWhy,
      newRow: "CRÉER UN ARTICLE ICI…", add: done => achArtFiche(null, done),
      w: { ref: 110, nom: 360, u: 70, cat: 200, pref: 110, pmax: 110, val: 110, cree: 110 },
      cols: mode => [["ref", "RÉFÉRENCE", a => a.code, ""], ["nom", "DÉSIGNATION", a => a.des, ""], ["u", "UNT", a => a.u, "center"], ["cat", "CATÉGORIE", a => a.cat || "", ""],
        ["pref", "PRIX RÉF. HT", a => achN(a.pref), "number"], ["pmax", "PLAFOND HT", a => achN(a.pmax) ? achN(a.pmax) : "", "number"]]
        .concat(mode === "valid" ? [["val", "VALIDÉ LE", a => achDFr(a.val || a.cree), "center"]] : []).concat([["cree", "SAISI LE", a => achDFr(a.cree), "center"]]) },
    pageOf: id => { const a = achArts().find(x => x.id === id); if (!a) return null;
      const C = achCaf().filter(c => (c.lignes || []).some(l => same(l, a))), D = achDvf().filter(v => (v.lignes || []).some(l => same(l, a))), M = achCmf().filter(c => (c.lignes || []).some(l => same(l, a)));
      const lp = (v, k) => (v.lignes || []).find(l => same(l, a)) || {};
      return { id, code: a.code, title: a.des + " (" + a.u + ")", st: achSt(a), del: !!a.del, inactif: a.actif === false, why: artWhy(a),
        info: done => achArtFiche(id, () => done()),
        menu: [achSt(a) === "instance" && !a.del ? { k: "val", lab: "VALIDER" } : null, { k: "cv", lab: "UNITÉ DE CONVERSION" + ((a.cv || []).length ? " (" + a.cv.length + ")" : "") }, { k: "bdg", lab: "BUDGETS (" + achArtBudgets(a).length + ")" },
          a.del ? { k: "rest", lab: "RESTAURER" } : { k: "del", lab: "METTRE À LA CORBEILLE" }].filter(Boolean),
        act: async (k, redraw) => { const L = achArts(), x = L.find(y => y.id === id); if (!x) return;
          if (k === "val") { if (await achNvValider(L, x, x.code, x.des, artWhy(x), achArtsSave)) redraw(); return; }
          if (k === "cv") { achArtCv(id, redraw); return; }
          if (k === "bdg") { achBdgWin(x); return; }
          if (k === "del") { if (!(await svConfirm({ title: "METTRE À LA CORBEILLE", text: x.code + " — " + x.des + " (RESTAURABLE).", ok: "METTRE À LA CORBEILLE" }))) return; x.del = achNow(); achArtsSave(L); achHist(x.code, "CORBEILLE", x.des); redraw(); return; }
          if (k === "rest") { if (achArtDup(L, x.des, x.u, x.id)) { svToast("RESTAURATION IMPOSSIBLE : UN ARTICLE IDENTIQUE EXISTE.", 3500); return; } x.del = ""; achArtsSave(L); achHist(x.code, "RESTAURATION", x.des); redraw(); } },
        links: [
          { t: "CONSULTATIONS", cols: [["RÉFÉRENCE"], ["OBJET"], ["QUANTITÉ", "number"], ["ÉTAT", "center"]], rows: C.map(c => ({ cells: [c.ref, c.objet || "", achN(lp(c).q), { ouverte: "OUVERTE", close: "CLOSE", annule: "ANNULÉE" }[c.state] || ""], open: r => achCafFiche(c.id, r), cls: c.state === "annule" ? "nv-strike" : "" })) },
          { t: "DEVIS", cols: [["RÉFÉRENCE"], ["FOURNISSEUR"], ["PRIX HT", "number"], ["PRIX TTC", "number"]], rows: D.map(v => { const l = lp(v), t = l.tva === "" || l.tva === undefined ? achPrm().tva : achN(l.tva); return { cells: [v.ref, achFrsNom(v.frs), achN(l.pu), achN(l.pu) * (1 + t / 100)], open: r => achDvfFiche(v.id, r), cls: v.state === "rejete" || v.state === "annule" ? "nv-strike" : "" }; }) },
          { t: "COMMANDES", cols: [["RÉFÉRENCE"], ["FOURNISSEUR"], ["QUANTITÉ", "number"], ["PRIX HT", "number"], ["ÉTAT", "center"]], rows: M.map(c => { const l = lp(c); return { cells: [c.ref, achFrsNom(c.frs), achN(l.q), achN(l.pu), ACH_CMF_ST[c.state] || ""], open: r => achCmfFiche(c.id, r), cls: c.state === "annule" ? "nv-strike" : "" }; }) }] }; }
  });
}

/* ---------- FOURNISSEURS ---------- */
function achFrsNvMod(ctx) {
  const frsWhy = f => achFrsWhy(f, achFrs());
  return achNvMod(ctx, {
    list: { k: "frs", t: "ach_frs2", id: "achFrsT", name: "FOURNISSEURS", one: "FOURNISSEUR", all: achFrs, save: achFrsSave, code: f => f.code, nom: f => f.nom, why: frsWhy,
      newRow: "CRÉER UN FOURNISSEUR ICI…",
      add: async done => { const nom = await achAsk("NOUVEAU FOURNISSEUR", "NOM"); if (!nom) { done(null); return; } const L = achFrs(), dn = achFrsDupNom(L, nom, "");
        if (dn) svToast("UN FOURNISSEUR DU MÊME NOM EXISTE : " + dn.code + ".", 3500);
        const f = achFrsNew(L, { nom }); f.st = "instance"; achFrsSave(L); achHist(f.code, "CRÉATION", f.nom); done(f.id); achFrsFiche(f.id, "", () => done(f.id)); },
      w: { ref: 110, nom: 320, ville: 140, ice: 160, cond: 140, val: 110, cree: 110 },
      cols: mode => [["ref", "RÉFÉRENCE", f => f.code, ""], ["nom", "NOM", f => f.nom, ""], ["ville", "VILLE", f => f.ville || "", ""], ["ice", "ICE", f => achDig(f.ice), "center"], ["cond", "PAIEMENT", f => f.cond || "", ""]]
        .concat(mode === "valid" ? [["val", "VALIDÉ LE", f => achDFr(f.val || f.cree), "center"]] : []).concat([["cree", "SAISI LE", f => achDFr(f.cree), "center"]]) },
    pageOf: id => { const f = achFrs().find(x => x.id === id); if (!f) return null;
      const D = achDvf().filter(v => v.frs === id), M = achCmf().filter(c => c.frs === id), FA = achFaf().filter(x => x.frs === id), PA = achPaf().filter(x => x.frs === id);
      const arts = new Map(); D.filter(v => v.state !== "rejete" && v.state !== "annule").forEach(v => (v.lignes || []).forEach(l => { if (achN(l.pu) > 0) arts.set(achKey(l.des, l.u), { l, v }); }));
      return { id, code: f.code, title: f.nom, st: achSt(f), del: !!f.del, inactif: f.actif === false, why: frsWhy(f),
        info: done => achFrsFiche(id, "", () => done()),
        menu: [achSt(f) === "instance" && !f.del ? { k: "val", lab: "VALIDER" } : null, { k: "rib", lab: "RIB" }, { k: "cte", lab: "CONTACTS (" + (f.cte || []).length + ")" }, { k: "evl", lab: "ÉVALUATIONS (" + (f.evl || []).length + ")" },
          { k: "cgf", lab: "CONTRATS (" + (f.cgf || []).length + ")" }, { k: "docf", lab: "DOCUMENTS FISCAUX (" + (f.docf || []).length + ")" }, f.del ? { k: "rest", lab: "RESTAURER" } : { k: "del", lab: "METTRE À LA CORBEILLE" }].filter(Boolean),
        act: async (k, redraw) => { const L = achFrs(), x = L.find(y => y.id === id); if (!x) return;
          if (k === "val") { if (await achNvValider(L, x, x.code, x.nom, frsWhy(x), achFrsSave)) redraw(); return; }
          if (["rib", "cte", "evl", "cgf", "docf"].includes(k)) { achFrsFiche(id, k === "rib" ? "rib" : k, redraw); return; }
          if (k === "del") { if (!(await svConfirm({ title: "METTRE À LA CORBEILLE", text: x.code + " — " + x.nom + " (RESTAURABLE).", ok: "METTRE À LA CORBEILLE" }))) return; x.del = achNow(); achFrsSave(L); achHist(x.code, "CORBEILLE", x.nom); redraw(); return; }
          if (k === "rest") { x.del = ""; achFrsSave(L); achHist(x.code, "RESTAURATION", x.nom); redraw(); } },
        links: [
          { t: "ARTICLES (DEVIS EN COURS)", cols: [["DÉSIGNATION"], ["U", "center"], ["PRIX HT", "number"], ["PRIX TTC", "number"], ["DEVIS"]], rows: [...arts.values()].map(({ l, v }) => { const t = l.tva === "" || l.tva === undefined ? achPrm().tva : achN(l.tva); return { cells: [l.des, l.u, achN(l.pu), achN(l.pu) * (1 + t / 100), v.ref] }; }) },
          { t: "DEVIS", cols: [["RÉFÉRENCE"], ["ARTICLES"], ["MONTANT TTC", "number"]], rows: D.map(v => ({ cells: [v.ref, (v.lignes || []).map(l => l.des).join("; "), achDvfTot(v).ttc], open: r => achDvfFiche(v.id, r), cls: v.state === "rejete" || v.state === "annule" ? "nv-strike" : "" })) },
          { t: "COMMANDES", cols: [["RÉFÉRENCE"], ["ARTICLES"], ["MONTANT TTC", "number"], ["ÉTAT", "center"]], rows: M.map(c => ({ cells: [c.ref, (c.lignes || []).map(l => l.des).join("; "), achCmfTot(c).ttc, ACH_CMF_ST[c.state] || ""], open: r => achCmfFiche(c.id, r), cls: c.state === "annule" ? "nv-strike" : "" })) },
          { t: "FACTURES", cols: [["RÉFÉRENCE"], ["N°"], ["MONTANT TTC", "number"], ["RESTE À PAYER", "number"], ["ÉTAT", "center"]], rows: FA.map(x => ({ cells: [x.ref, x.num || "", achFafTot(x).ttc, x.state === "annule" ? "" : achFafReste(x), achFafEtat(x)], open: r => achFafFiche(x.id, null, r), cls: x.state === "annule" ? "nv-strike" : "" })) },
          { t: "PAIEMENTS", cols: [["RÉFÉRENCE"], ["MODE"], ["MONTANT", "number"], ["ÉTAT", "center"]], rows: PA.map(p => ({ cells: [p.ref, p.mode, achN(p.mt), ACH_PAF_ST[p.state] || ""], open: r => achPafFiche(p.id, null, r), cls: p.state === "annule" || p.state === "rejete" ? "nv-strike" : "" })) }] }; }
  });
}
