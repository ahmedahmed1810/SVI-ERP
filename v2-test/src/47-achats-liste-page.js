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
  const html = ctx => {
    const L = get(tab);
    const head = { doc: ["RÉFÉRENCE", "DATE", "INTITULÉ", "FICHIER"], taf: ["RÉFÉRENCE", "DATE", "TÂCHE", "ÉCHÉANCE", "FAIT"], obs: ["DATE", "OBSERVATION", "IMPORTANTE"] }[tab];
    /* v793 : SUIVI des fiches d'achat au format du SUIVI du budget — loupe sur chaque colonne, largeur des colonnes réglable et gardée */
    const ACC = { doc: [x => x.ref || "", x => dt(x.date), x => x.title || "", x => x.fk ? "OUVRIR" : ""], taf: [x => x.ref || "", x => dt(x.date), x => x.title || "", x => achDFr(x.ech), x => x.done ? "OUI" : "NON"], obs: [x => dt(x.date), x => x.text || "", x => x.important ? "!" : ""] }[tab];
    const tk = "achrec_" + tab, C = head.map((h, j) => ["c" + j, h, r => ACC[j](r.x), /FICHIER|FAIT|IMPORTANTE/.test(h) ? "center" : ""]);
    const R0 = L.map((x, i) => ({ x, i })).reverse(), R = ctx && ctx.cfApply ? ctx.cfApply(tk, C, R0) : R0;
    const CG = sviCwCols(tk, C.map((c, j) => [c[0], /DATE|ÉCHÉANCE/.test(c[1]) ? 140 : c[3] === "center" ? 100 : j === 0 && tab !== "obs" ? 170 : 260]));
    const th = c => ctx && ctx.cfHead ? ctx.cfHead(tk, c[0], c[1], c[3]) : `<th class="${c[3]}">${esc(c[1])}</th>`;
    const row = (x, i) => tab === "doc" ? `<td>${esc(x.ref || "")}</td><td>${esc(dt(x.date))}</td><td>${esc(x.title || "")}</td><td class="center">${x.fk ? `<button type="button" class="ach-link" data-recf="${i}">OUVRIR</button>` : ""}</td>`
      : tab === "taf" ? `<td>${esc(x.ref || "")}</td><td>${esc(dt(x.date))}</td><td>${esc(x.title || "")}</td><td>${esc(achDFr(x.ech))}</td><td class="center"><input type="checkbox" class="rec-done" data-i="${i}"${x.done ? " checked" : ""}></td>`
      : `<td>${esc(dt(x.date))}</td><td>${esc(x.text || "")}</td><td class="center">${x.important ? "<b>!</b>" : ""}</td>`;
    /* v776 : bloc SUIVI comme celui du budget — en-tête SUIVI (agrandir, ⋯), rangée d'onglets, ligne CRÉER … ICI */
    return `<div class="bdg-d-block blk-rec blk-suivi nvp-rec nvp-blk" data-nvb="rec"><div class="bdg-d-block-title blk-head"><span class="ttl">${SVI_ICON.doc || ""}SUIVI</span>${achBlkTools("rec")}</div>
      <div class="blk-tabrow"><span class="rec-tabs">${["doc", "taf", "obs"].map(k => `<button type="button" class="rec-tab${k === tab ? " active" : ""}" data-nvr="${k}">${SVI_ICON[k] || ""}${{ doc: "DOCUMENTS", taf: "TAF", obs: "OBSERVATIONS" }[k]} ${svCnt(get(k).length)}</button>`).join("")}</span></div>
      <div class="rec-scroll" style="max-height:var(--nvh-rec, 200px)"><table class="bdg-d-table rec-table" data-svcw="${tk}" style="${CG.style}">${CG.cg}<thead><tr>${C.map(th).join("")}</tr></thead>
        <tbody>${R.map(r => `<tr>${row(r.x, r.i)}</tr>`).join("")}<tr class="rec-new" data-nvradd><td colspan="${head.length}">${{ doc: "CRÉER UN DOCUMENT ICI…", taf: "CRÉER UN TAF ICI…", obs: "CRÉER UNE OBSERVATION ICI…" }[tab]}</td></tr></tbody></table></div><div class="blk-rsz nvp-rsz" data-nvh="rec" title="Glisser pour changer la hauteur"></div></div>`;
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
  /* v783 : GÉNÉRER PDF de l'aperçu = classé dans DOCUMENTS de la pièce */
  const savePdf = async (blob, name) => { const L = get("doc"), n = L.length + 1, k = "ach:doc:" + code + ":" + Date.now().toString(36);
    try { await sviFiles.put(k, new File([blob], name, { type: "application/pdf" })); } catch (e) {}
    const x = { ref: "ACH DOC " + code + "/" + String(n).padStart(3, "0"), date: new Date().toISOString(), title: name.replace(/\.pdf$/i, ""), fk: k, fname: name };
    L.push(x); achW(K.doc, L); achHist(code, "DOCUMENT", x.title); return x.ref; };
  return { html, click, change, savePdf };
}

/* ---------- LISTE au format du budget ----------
   o = { k, t, name ("ARTICLES"), one ("ARTICLE"), all(), save(L), code(x), nom(x), cols(mode), why(x), newRow, add(done), page(id) } */
function achNvList(ctx, o) {
  const { cfApply, cfHead, draw } = ctx;
  const ETATS = [["actif", "ACTIF"], ["inactif", "INACTIF"], ["corbeille", "CORBEILLE"], ["tout", "TOUT"]];
  const KM = "svi_ach_" + o.k + "_mode_v1", KE = "svi_ach_" + o.k + "_etat2_v1";
  let mode = "valid", etat = "actif", dSel = "", order = [], chosen = false;
  try { mode = localStorage.getItem(KM) === "inst" ? "inst" : "valid"; const e0 = localStorage.getItem(KE); if (ETATS.some(x => x[0] === e0)) etat = e0; } catch (e) {}
  /* v765 : crochets pour les pièces (consultations, devis, commandes…) — o.etats / o.ok, o.inst, o.dI / o.dV, o.kill, o.bang */
  if (o.etats) ETATS.splice(0, ETATS.length, ...o.etats);
  const isI = x => o.inst ? !!o.inst(x) : achSt(x) === "instance";
  const eOk = (x, k, L) => o.ok ? o.ok(x, k, L) : k === "tout" ? true : k === "corbeille" ? !!x.del : !x.del && (k === "inactif" ? x.actif === false : x.actif !== false);
  const mOk = x => mode === "inst" ? isI(x) : !isI(x);
  const dOf = x => mode === "inst" ? achDay(o.dI ? o.dI(x) : x.cree) : achDay(o.dV ? o.dV(x) : x.val || x.cree);
  /* v766 : MÊME FORME QUE LA LISTE DES BUDGETS (mêmes classes : novapp-list-shell, novapp-date-panel, novapp-budget-table) ;
     colonnes : celles de la liste puis SAISI LE (en instance) ou VALIDÉ LE et SAISI LE (validés), dates au format du budget ;
     corbeille en bout de ligne et CRÉER … ICI seulement dans la liste EN INSTANCE (comme les budgets) */
  const dI = x => o.dI ? o.dI(x) : x.cree, dV = x => o.dV ? o.dV(x) : x.val || x.cree;
  const colsOf = () => o.cols(mode).filter(c => c[1] !== "SAISI LE" && c[1] !== "VALIDÉ LE")
    .concat(mode === "valid" ? [["_val", "VALIDÉ LE", x => svDT(dV(x) || ""), ""]] : []).concat([["_cree", "SAISI LE", x => svDT(dI(x) || ""), ""]]);
  const counts = () => { const A = o.all(), L = A.filter(x => eOk(x, etat, A)); return { inst: L.filter(isI).length, valid: L.filter(x => !isI(x)).length }; };
  const h1 = () => {
    const n = counts(), keep = chosen; chosen = false; if (!keep && !n[mode] && n[mode === "inst" ? "valid" : "inst"]) mode = mode === "inst" ? "valid" : "inst";
    const other = mode === "inst" ? "valid" : "inst", can = other === "inst" || n[other] > 0;
    return esc(o.name) + (mode === "inst" ? " (EN INSTANCE)" : " (VALIDÉS)") + ` <span class="bdgl-cnt">${svCnt(n[mode])}</span>`
      + `<button type="button" class="bdg-mode-sw${can ? "" : " off"}" data-nvsw title="${can ? (other === "inst" ? "VOIR LA LISTE EN INSTANCE" : "VOIR LA LISTE DES VALIDÉS") : "RIEN DE VALIDÉ."}" aria-label="BASCULER">${ACH_SW}</button>`;
  };
  const html = () => {
    const t1 = h1();
    const all = o.all(), base = all.filter(x => eOk(x, etat, all) && mOk(x));
    const days = [...base.reduce((m, x) => m.set(dOf(x), (m.get(dOf(x)) || 0) + 1), new Map())].sort((a, b) => b[0].localeCompare(a[0]));
    if (dSel && !days.some(d => d[0] === dSel)) dSel = "";
    const rows0 = base.filter(x => !dSel || dOf(x) === dSel), cols = coOrder(o.t + (mode === "inst" ? "_i" : "_v"), colsOf()), rows = cfApply(o.t, cols, rows0);
    order = rows.map(x => x.id);
    const inst = mode === "inst", W = o.w || {}, CW = cwLoad(), tot = cols.reduce((t, c) => t + (W[c[0]] || 120), 0);
    const cell = (x, c) => { const v = c[2](x), cl = c[3] === "number" ? "number" : "";
      if (c[0] === "ref") { const w = o.why(x, all); return `<td class="bdg-ref-c">${w.length ? `<b class="obs-bang val-bang nv-bang" role="button" data-why="${esc(w.join(" · "))}">!</b> ` : ""}${esc(v)}</td>`; }
      const t = typeof v === "number" ? achF2(v) : String(v ?? ""); return `<td class="${cl}" title="${esc(t)}">${esc(t)}</td>`; };
    return `<div class="novapp-list-shell"><div class="novapp-list-titlebar"><button class="novapp-menu open-menu" type="button" aria-label="Menu">☰</button><h1>${t1}</h1>${sviListBar()}</div>
      <div class="novapp-budget-layout"><aside class="novapp-date-panel svi-bdgp">
        <div class="novapp-date-head"><button type="button" class="novapp-date-filter" data-a="${o.k}-etat"><span>${(ETATS.find(x => x[0] === etat) || ETATS[0])[1]} <i class="dt-arr">▾</i></span>${svCnt(base.length)}</button></div>
        <div class="novapp-date-list">${days.map(([d, n]) => `<button type="button" data-nvday="${esc(d)}" class="novapp-date-item ${d === dSel ? "selected" : ""}"><span>${esc(achDFr(d) || "SANS DATE")}</span>${svCnt(n)}</button>`).join("")}</div></aside>
      <div class="novapp-budget-table-wrap"><table id="${o.id}" class="novapp-budget-table svi-bdgl${inst ? " nv-inst" : ""}" data-ach="${o.k}">
        <colgroup>${cols.map(c => `<col data-w="${o.t}.${c[0]}" style="width:${CW[o.t + "." + c[0]] ? CW[o.t + "." + c[0]] + "px" : ((W[c[0]] || 120) / tot * 100).toFixed(2) + "%"}">`).join("")}<col style="width:44px"><col style="width:40px"></colgroup>
        <thead><tr>${cols.map(c => cfHead(o.t, c[0], c[1], "bdg-list-head" + (c[3] === "number" ? " number" : ""))).join("")}<th class="bdg-act-h"></th>${sviListCbTh()}</tr></thead>
        <tbody>${rows.map(x => `<tr data-id="${esc(x.id)}" data-iid="${esc(x.id)}" data-nvo="${esc(x.id)}" class="${isI(x) ? "inst-instance" : "inst-valide"}${x.del || x.state === "annule" ? " etat-bloque" : ""}${x.actif === false ? " etat-archive" : ""}">${cols.map(c => cell(x, c)).join("")}<td class="bdg-action-cell">${inst && !x.del && x.state !== "annule" ? `<button type="button" class="bdg-row-action bdg-row-del" data-nvdel="${esc(x.id)}" title="Supprimer" aria-label="Supprimer">${SVI_DEL_ICON}</button>` : ""}</td>${sviListCbTd()}</tr>`).join("")
          || ""}
          ${inst && etat !== "corbeille" && etat !== "inactif" && etat !== "annule" ? `<tr class="bdg-newrow" data-nvnew><td colspan="${cols.length + 2}">${esc(o.newRow)}</td></tr>` : ""}</tbody></table></div></div></div>`;
  };
  const click = async e => {
    if (e.target.closest("[data-nvsw]")) { const b = e.target.closest("[data-nvsw]"); if (b.classList.contains("off") && mode === "inst") { svToast(b.title, 2500, b); return true; } mode = mode === "inst" ? "valid" : "inst"; dSel = ""; chosen = true; try { localStorage.setItem(KM, mode); } catch (err) {} draw(); return true; }
    const dy = e.target.closest("[data-nvday]"); if (dy) { dSel = dSel === dy.dataset.nvday ? "" : dy.dataset.nvday; draw(); return true; }
    const eb = e.target.closest(`[data-a="${o.k}-etat"]`);
    if (eb) { const L = o.all(); sviEtatMenu(eb, ETATS.map(([k, lab]) => ({ k, lab, n: L.filter(x => eOk(x, k, L) && mOk(x)).length })), etat, k => { etat = k; try { localStorage.setItem(KE, k); } catch (err) {} draw(); }); return true; }
    const w = e.target.closest(".nv-bang"); if (w) { e.stopPropagation(); svToast(w.dataset.why, 4000, w); return true; }
    const dl = e.target.closest("[data-nvdel]");
    if (dl && o.kill) { const x = o.all().find(y => y.id === dl.dataset.nvdel); if (x && await o.kill(x)) draw(); return true; }
    if (dl) { const L = o.all(), x = L.find(y => y.id === dl.dataset.nvdel); if (!x) return true;
      if (!(await svConfirm({ title: "METTRE À LA CORBEILLE", text: o.code(x) + " — " + o.nom(x) + " (RESTAURABLE ; SON NUMÉRO NE SERA PAS RÉUTILISÉ).", ok: "METTRE À LA CORBEILLE" }))) return true;
      x.del = achNow(); x.mod = x.del; o.save(L); achHist(o.code(x), "CORBEILLE", o.nom(x)); draw(); return true; }
    if (e.target.closest("[data-nvnew]")) { o.add(id => { if (id) { mode = "inst"; try { localStorage.setItem(KM, mode); } catch (err) {} } draw();
      if (id && id !== "x" && o.page && o.all().some(x => x.id === id)) o.page(id); }); return true; }   /* v800 (3.6) : la page de la nouvelle pièce s'ouvre */
    const r = e.target.closest("button, .cf-btn, thead") ? e.target.closest("button[data-nvo]") : e.target.closest("[data-nvo]");
    if (r) { o.page(r.dataset.nvo || r.dataset.id); return true; }
    return false;
  };
  return { html, click, h1, order: () => order };
}

/* ---------- PAGE d'un élément ----------
   p = { id, code, nom, title, st, why[], del, info(), menu: [{k, lab}], act(k), links: [{ t, cols:[lab…], rows:[{cells:[…], cls, open}] }] } */
/* v771 : hauteur des blocs de la page — 5 lignes par défaut, défilement au-delà, poignée en bas (hauteur mémorisée par bloc) */
const achNvhKey = t => String(t).toLowerCase().replace(/[^a-z]+/g, "");
const ACH_NVH_K = "svi_ach_nvh_v1";
const achNvhStyle = () => { let H = {}; try { H = JSON.parse(localStorage.getItem(ACH_NVH_K) || "{}") || {}; } catch (e) {} return Object.keys(H).map(k => "--nvh-" + k + ":" + H[k] + "px").join(";"); };
function achNvhDrag(e, h) {
  e.preventDefault(); const pg = h.closest(".nvp"), k = h.dataset.nvh, sc = h.parentNode.querySelector(".rec-scroll"); if (!pg || !sc) return;
  const y0 = e.clientY, b0 = sc.getBoundingClientRect().height; let v = b0; h.classList.add("on");
  const mv = ev => { ev.preventDefault(); v = Math.max(60, Math.round(b0 + ev.clientY - y0)); pg.style.setProperty("--nvh-" + k, v + "px"); };
  const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up); h.classList.remove("on");
    try { const H = JSON.parse(localStorage.getItem(ACH_NVH_K) || "{}") || {}; H[k] = v; localStorage.setItem(ACH_NVH_K, JSON.stringify(H)); } catch (err) {} };
  document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
}
/* v776 : PAGE au format exact de l'écran d'un budget — en-tête : ☰, RÉFÉRENCE (rouge soulignée en instance), i (informations), H (historique),
   barre commune à droite ; étiquette de l'écran en haut au centre ; puis les blocs liés (agrandir, ⋯) et le SUIVI (DOC / TAF / OBS) */
const ACH_MAX_IC = '<svg class="ic-max" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6.5v-4h4M2.5 2.5l4.5 4.5M13.5 9.5v4h-4M13.5 13.5 9 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><svg class="ic-min" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M7 3v4H3M7 7 2.5 2.5M9 13V9h4M9 9l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const achBlkTools = k => `<span class="blk-tools"><button type="button" class="blk-btn blk-max-btn" data-nvmax="${esc(k)}" title="Agrandir / réduire">${ACH_MAX_IC}</button><button type="button" class="blk-more" data-nvmore="${esc(k)}" title="Actions" aria-label="Actions">⋯</button></span>`;
/* v790 (DOCUMENT UNIQUE §6) : blocs des pages d'achat au format commun des tableaux — loupe de tri / filtre sur chaque colonne,
   case à cocher à droite (case d'en-tête), pas de ligne « AUCUN » (le compteur 0 suffit), ligne TOTAL dans LIGNES */
function achNvPageHTML(p, rec, ctx) {
  const blk = L => { const k = achNvhKey(L.t), t = "achp_" + k, n = L.cols.length;
    const C = L.cols.map((c, j) => ["c" + j, c[0], r => r.cells[j], c[1] || ""]);
    const R0 = L.rows.map((r, i) => ({ ...r, __i: i })), R = ctx && ctx.cfApply ? ctx.cfApply(t, C, R0) : R0;
    const head = C.map(c => ctx && ctx.cfHead ? ctx.cfHead(t, c[0], c[1], c[3]) : `<th class="${c[3]}">${esc(c[1])}</th>`).join("");
    /* v793 : largeur des colonnes réglable et gardée (moteur commun sviCwCols / data-svcw) */
    const CG = sviCwCols(t, C.map((c, j) => [c[0], j === 0 ? 170 : /number/.test(c[3]) ? 110 : /center/.test(c[3]) ? 90 : 150]), [["_cb", 40]]);
    const iM = L.cols.findIndex(c => /^MONTANT/.test(c[0])), isL = /^LIGNES/.test(L.t) && iM >= 0;
    const tot = isL ? R.reduce((s2, r) => s2 + (typeof r.cells[iM] === "number" ? r.cells[iM] : achN(r.cells[iM]) || 0), 0) : 0;
    return `<div class="bdg-d-block nvp-blk" data-nvb="${k}"><div class="bdg-d-block-title blk-head"><span class="ttl">${esc(L.t)} ${svCnt(R.length, L.rows.length)}</span>${achBlkTools(k)}</div>
      <div class="rec-scroll" style="max-height:var(--nvh-${k}, 200px)"><table class="bdg-d-table rec-table" data-colh="${esc(t)}" data-svcw="${esc(t)}" style="${CG.style}">${CG.cg}<thead><tr>${head}<th class="center nvp-cbh"><input type="checkbox" class="nvp-all" aria-label="Tout cocher"></th></tr></thead>
      <tbody>${R.map(r => `<tr class="${r.cls || ""}">${r.cells.map((v, j) => { const g = (r.go || []).find(z => z[0] === j); return `<td class="${L.cols[j][1] || ""}">${j === 0 && r.open ? `<button type="button" class="ach-link" data-nvl="${esc(L.t)}|${r.__i}">${esc(v)}</button>` : g ? `<button type="button" class="ach-link" data-nvgo="${esc(g[1] + "|" + g[2])}">${esc(v)}</button>` : esc(typeof v === "number" ? achF2(v) : v)}</td>`; }).join("")}<td class="center"><input type="checkbox" class="nvp-cb"></td></tr>`).join("")}${L.add ? `<tr class="rec-new" data-nvadd="${k}"><td colspan="${n + 1}">${esc(L.add)}</td></tr>` : ""}</tbody>
      ${isL ? `<tfoot><tr class="bdg-d-total-row">${L.cols.map((c, j) => j === iM ? `<td class="number">${achF2(tot)}</td>` : j === iM - 1 ? `<td class="number">${R.length < L.rows.length ? "TOTAL PARTIEL" : "TOTAL"}</td>` : "<td></td>").join("")}<td></td></tr></tfoot>` : ""}</table></div>
      <div class="blk-rsz nvp-rsz" data-nvh="${k}" title="Glisser pour changer la hauteur"></div></div>`; };
  return `<div class="nvp bdg-d-page ${p.st === "instance" && !p.del ? "bdg-inst-instance" : "nvp-valide"}" style="${achNvhStyle()}">
    <div class="bdg-d-sticky"><div class="novapp-list-titlebar">
      <button type="button" class="novapp-menu open-menu" aria-label="Menu">☰</button>
      <h1 class="bdg-d-h1 nvp-ref${p.del ? " nv-strike" : ""}">${esc(p.ref || p.code)}</h1>
      <span class="bdg-d-badge bdg-d-inf" data-nvp="info" role="button" title="Informations">i</span>
      <span class="bdg-d-badge ach-h" data-h="${esc(p.code)}" role="button" title="Historique">H</span>
      ${p.partyGo ? `<button type="button" class="ach-link nvp-party" data-nvgo="${esc(p.partyGo)}">${esc(p.party)}</button>` : ""}
      ${sviHdrBar({ attr: "nvp", n: p.why.length, why: { undo: "RIEN À ANNULER SUR CETTE FICHE.", redo: "RIEN À RÉTABLIR SUR CETTE FICHE.", todo: p.why.length ? "" : "AUCUNE ALERTE." } })}
    </div></div>
    ${p.links.map(blk).join("")}
    ${rec.html(ctx)}
  </div>`;
}
/* module complet liste + page : cfg = { list: options de achNvList (sans page), pageOf(id) → p, back } */
/* v783 : APERÇU d'une pièce ou d'une fiche — l'éditeur MISE EN PAGE unique (sviMep) ; corps = LIGNES (sinon le premier bloc lié) */
function achMepOpen(cfg, P, rec, redraw) {
  const Lg0 = P.links.find(l => /^LIGNES/.test(l.t)) || P.links[0] || { t: "", cols: [], rows: [] };
  /* v786 : l'aperçu suit les colonnes affichées à l'écran */
  const tb = document.querySelector(`#ach table[data-colh="achp_${achNvhKey(Lg0.t)}"]`), vis = tb ? sviColhVis(tb) : null, vf = a => vis ? a.filter((_, i) => vis.includes(i)) : a;
  const Lg = { ...Lg0, cols: vf(Lg0.cols), rows: Lg0.rows.map(r => ({ ...r, cells: vf(r.cells) })) };
  sviMep.open({ key: "ACH-" + String(cfg.list.k || "X").toUpperCase(), title: cfg.list.one, ref: P.ref || P.code, party: P.party || P.title, date: P.date || "", prelim: P.st === "instance",
    cols: Lg.cols.map((c, i) => ["c" + i, c[0], c[1] || ""]), rows: Lg.rows.map(r => r.cells), tot: P.tot || [], fields: { projet: P.projet || "", ttc: P.ttc ? achF2(P.ttc) + " MAD" : "", numFrs: P.numFrs || "" },
    name: (P.ref || P.code) + " " + cfg.list.one, save: async (b, n) => { const r = await rec.savePdf(b, n); if (redraw) setTimeout(redraw, 0); return r; } });
}
function achNvMod(ctx, cfg) {
  let pid = null, P = null, rec = null;
  const open = id => { pid = id; rec = null; ctx.draw(); };
  const LST = achNvList(ctx, { ...cfg.list, page: open });
  const html = () => {
    if (pid) { P = cfg.pageOf(pid); if (!P) pid = null; }
    if (!pid) return LST.html();
    if (!rec || rec.__c !== P.code) { rec = achRecBlock(P.code); rec.__c = P.code; }
    return achNvPageHTML(P, rec, ctx);
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
      if (b.classList.contains("hdr-off")) { svToast(b.dataset.why || "", 3000, b); return true; }
      if (k === "todo") { svToast("⚠ " + P.why.join(" · "), 5000, b); return true; }
      /* v774 : ⋯ principal commun — VALIDER en tête ; actions ; CORBEILLE / RESTAURER et FERMER en bas, séparés par un trait */
      if (k === "more") { const M = P.menu.concat([{ k: "__apr", lab: "APERÇU" }]), top = M.filter(m => m.k === "val"), bot = M.filter(m => m.k === "del" || m.k === "rest").map(m => ({ ...m, del: m.k === "del" })), mid = M.filter(m => !top.includes(m) && !["del", "rest"].includes(m.k));
        sviHdrMenu(b, [top, mid, [...bot, { k: "__close", lab: "FERMER" }]], async a => { if (a === "__close") { pid = null; ctx.draw(); return; } if (a === "__apr") { achMepOpen(cfg, P, rec, () => ctx.draw()); return; } await P.act(a, () => ctx.draw(), id => open(id)); }); return true; }
    }
    /* v776 : AGRANDIR / RÉDUIRE un bloc de la page ; ⋯ du bloc (EXPORTER, APERÇU ; SUIVI : CRÉER) */
    const mx = e.target.closest("[data-nvmax]"); if (mx) { const bl = mx.closest(".nvp-blk"); const on = !bl.classList.contains("nvp-max"); bl.classList.toggle("nvp-max", on); mx.classList.toggle("on", on); return true; }
    const mo = e.target.closest("[data-nvmore]"); if (mo) { const k = mo.dataset.nvmore, bl = mo.closest(".nvp-blk"), L = P.links.find(x => achNvhKey(x.t) === k);
      const tsv = () => { const t = bl.querySelector("table"); return [...t.rows].filter(r => !r.classList.contains("rec-new")).map(r => [...r.cells].filter(c => !c.classList.contains("svi-colh")).map(c => c.textContent.trim()).join("\t")).join("\n"); };
      const bt = bl.querySelector("table"), vis = sviColhVis(bt), vf = a => a.filter((_, i) => vis.includes(i));
      sviHdrMenu(mo, [[{ k: "max", lab: bl.classList.contains("nvp-max") ? "RÉDUIRE" : "AGRANDIR" }].concat(k === "rec" ? [{ k: "add", lab: "CRÉER" }] : []), sviColhItems(bt), [{ k: "exp", lab: "EXPORTER" }, { k: "apr", lab: "APERÇU" }]], async a => {
        if (sviColhPick(a, bt)) return;
        if (a === "max") { bl.querySelector("[data-nvmax]")?.click(); return; }
        if (a === "add") { if (await rec.click({ target: bl.querySelector("[data-nvradd]") }, () => ctx.draw())) return; }
        const ttl = (P.ref || P.code) + " — " + (L ? L.t : "SUIVI");
        if (a === "exp") { const b = new Blob(["\ufeff" + tsv().split("\n").map(l => l.split("\t").map(v => /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
          const u = URL.createObjectURL(b), an = document.createElement("a"); an.href = u; an.download = ttl.replace(/[\\/:*?"<>|]/g, "-") + ".csv"; document.body.appendChild(an); an.click(); setTimeout(() => { URL.revokeObjectURL(u); an.remove(); }, 1000); }
        if (a === "apr") { const Lb = L || { t: "SUIVI", cols: [...bl.querySelectorAll("thead th")].map(th => [th.textContent.trim(), ""]), rows: [...bl.querySelectorAll("tbody tr:not(.rec-new)")].map(tr => ({ cells: [...tr.cells].map(c => c.textContent.trim()) })) };   /* v783 : l'aperçu unique (MISE EN PAGE) */
          sviMep.open({ key: "ACH-BLOC-" + achNvhKey(Lb.t).toUpperCase(), title: Lb.t, ref: P.ref || P.code, party: P.party || P.title, prelim: P.st === "instance", cols: vf(Lb.cols).map((c, i) => ["c" + i, c[0], c[1] || ""]), rows: Lb.rows.map(r => vf(r.cells)), name: ttl, save: (b, n) => rec.savePdf(b, n) }); } });
      return true; }
    const na = e.target.closest("[data-nvadd]"); if (na) { const L = P.links.find(x => achNvhKey(x.t) === na.dataset.nvadd); if (L && L.addFn) L.addFn(() => ctx.draw()); else P.info(() => ctx.draw()); return true; }   /* v780 : ligne CRÉER … ICI */
    const gg = e.target.closest("[data-nvgo]"); if (gg) { const [t, gid] = gg.dataset.nvgo.split("|"); achGo(t, gid); return true; }   /* v800 (3.6 – 3.7) : un nom ouvre sa page */
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
  d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: a0 ? esc(a0.des + " (" + a0.u + ") : " + achRefSvi(a0, achArts(), "ARA")) : "NOUVEL ARTICLE",
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
/* v776 : RÉFÉRENCE SVI (« FRS 26-1010/001 ») — celle d'origine (NovApp) gardée ; sinon date de création AA-MMJJ + rang du jour (001, 002…) */
function achRefSvi(x, L, pfx) {
  if (x.nov) return x.nov;
  const d = String(x.cree || "").slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return x.code;
  const tag = d.slice(2, 4) + "-" + d.slice(5, 7) + d.slice(8, 10), rx = new RegExp(" " + tag + "/(\\d+)$");
  const used = Math.max(0, ...L.map(y => { const m = String(y.nov || "").match(rx); return m ? +m[1] : 0; }));
  const same = L.filter(y => !y.nov && String(y.cree || "").slice(0, 10) === d).sort((a, b) => String(a.cree).localeCompare(String(b.cree)) || String(a.code).localeCompare(String(b.code)));
  return pfx + " " + tag + "/" + String(used + Math.max(0, same.findIndex(y => y.id === x.id)) + 1).padStart(3, "0");
}
function achArtNvMod(ctx) {
  const same = (l, a) => achKey(l.des, l.u) === achKey(a.des, a.u);
  const artWhy = a => achArtWhy(a).concat(a.cat ? [] : ["CATÉGORIE MANQUANTE"]);
  return achNvMod(ctx, {
    list: { k: "art", t: "ach_art2", id: "achArtT", name: "ARTICLES", one: "ARTICLE", all: achArts, save: achArtsSave, code: a => achRefSvi(a, achArts(), "ARA"), nom: a => a.des, why: artWhy,
      newRow: "CRÉER UN ARTICLE ICI…", add: done => achArtFiche(null, done),
      w: { ref: 110, nom: 360, u: 70, cat: 200, pref: 110, pmax: 110, val: 110, cree: 110 },
      cols: mode => [["ref", "RÉFÉRENCE", a => achRefSvi(a, achArts(), "ARA"), ""], ["nom", "DÉSIGNATION", a => a.des, ""], ["u", "UNT", a => a.u, "center"], ["cat", "CATÉGORIE", a => a.cat || "", ""],
        ["pref", "PRIX RÉF. HT", a => achN(a.pref), "number"], ["pmax", "PLAFOND HT", a => achN(a.pmax) ? achN(a.pmax) : "", "number"]]
        .concat(mode === "valid" ? [["val", "VALIDÉ LE", a => achDFr(a.val || a.cree), "center"]] : []).concat([["cree", "SAISI LE", a => achDFr(a.cree), "center"]]) },
    pageOf: id => { const a = achArts().find(x => x.id === id); if (!a) return null;
      const C = achCaf().filter(c => (c.lignes || []).some(l => same(l, a))), D = achDvf().filter(v => (v.lignes || []).some(l => same(l, a))), M = achCmf().filter(c => (c.lignes || []).some(l => same(l, a)));
      const lp = (v, k) => (v.lignes || []).find(l => same(l, a)) || {};
      return { id, code: a.code, ref: achRefSvi(a, achArts(), "ARA"), tag: "ARTICLE", title: a.des + " (" + a.u + ")", st: achSt(a), del: !!a.del, inactif: a.actif === false, why: artWhy(a),
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
          { t: "CONSULTATIONS", cols: [["RÉFÉRENCE"], ["OBJET"], ["QUANTITÉ", "number"], ["ÉTAT", "center"]], rows: C.map(c => ({ cells: [c.ref, c.objet || "", achN(lp(c).q), { ouverte: "OUVERTE", close: "CLOSE", annule: "ANNULÉE" }[c.state] || ""], open: () => achGo("caf", c.id), cls: c.state === "annule" ? "nv-strike" : "" })) },
          { t: "DEVIS", cols: [["RÉFÉRENCE"], ["FOURNISSEUR"], ["PRIX HT", "number"], ["PRIX TTC", "number"]], rows: D.map(v => { const l = lp(v), t = l.tva === "" || l.tva === undefined ? achPrm().tva : achN(l.tva); return { cells: [v.ref, achFrsNom(v.frs), achN(l.pu), achN(l.pu) * (1 + t / 100)], open: () => achGo("dvf", v.id), cls: v.state === "rejete" || v.state === "annule" ? "nv-strike" : "" }; }) },
          { t: "COMMANDES", cols: [["RÉFÉRENCE"], ["FOURNISSEUR"], ["QUANTITÉ", "number"], ["PRIX HT", "number"], ["ÉTAT", "center"]], rows: M.map(c => { const l = lp(c); return { cells: [c.ref, achFrsNom(c.frs), achN(l.q), achN(l.pu), ACH_CMF_ST[c.state] || ""], open: () => achGo("cmf", c.id), cls: c.state === "annule" ? "nv-strike" : "" }; }) }] }; }
  });
}

/* ---------- FOURNISSEURS ---------- */
function achFrsNvMod(ctx) {
  const frsWhy = f => achFrsWhy(f, achFrs());
  return achNvMod(ctx, {
    list: { k: "frs", t: "ach_frs2", id: "achFrsT", name: "FOURNISSEURS", one: "FOURNISSEUR", all: achFrs, save: achFrsSave, code: f => achRefSvi(f, achFrs(), "FRS"), nom: f => f.nom, why: frsWhy,
      newRow: "CRÉER UN FOURNISSEUR ICI…",
      add: async done => { const nom = await achAsk("NOUVEAU FOURNISSEUR", "NOM"); if (!nom) { done(null); return; } const L = achFrs(), dn = achFrsDupNom(L, nom, "");
        if (dn) svToast("UN FOURNISSEUR DU MÊME NOM EXISTE : " + dn.code + ".", 3500);
        const f = achFrsNew(L, { nom }); f.st = "instance"; achFrsSave(L); achHist(f.code, "CRÉATION", f.nom); done(f.id); achFrsFiche(f.id, "", () => done(f.id)); },
      w: { ref: 110, nom: 320, ville: 140, ice: 160, cond: 140, val: 110, cree: 110 },
      cols: mode => [["ref", "RÉFÉRENCE", f => achRefSvi(f, achFrs(), "FRS"), ""], ["nom", "NOM", f => f.nom, ""], ["ville", "VILLE", f => f.ville || "", ""], ["ice", "ICE", f => achDig(f.ice), "center"], ["cond", "PAIEMENT", f => f.cond || "", ""]]
        .concat(mode === "valid" ? [["val", "VALIDÉ LE", f => achDFr(f.val || f.cree), "center"]] : []).concat([["cree", "SAISI LE", f => achDFr(f.cree), "center"]]) },
    pageOf: id => { const f = achFrs().find(x => x.id === id); if (!f) return null;
      const D = achDvf().filter(v => v.frs === id), M = achCmf().filter(c => c.frs === id), FA = achFaf().filter(x => x.frs === id), PA = achPaf().filter(x => x.frs === id);
      const arts = new Map(); D.filter(v => v.state !== "rejete" && v.state !== "annule").forEach(v => (v.lignes || []).forEach(l => { if (achN(l.pu) > 0) arts.set(achKey(l.des, l.u), { l, v }); }));
      return { id, code: f.code, ref: achRefSvi(f, achFrs(), "FRS"), tag: "FOURNISSEUR", title: f.nom, st: achSt(f), del: !!f.del, inactif: f.actif === false, why: frsWhy(f),
        info: done => achFrsFiche(id, "", () => done()),
        menu: [achSt(f) === "instance" && !f.del ? { k: "val", lab: "VALIDER" } : null, { k: "rib", lab: "RIB" }, { k: "cte", lab: "CONTACTS (" + (f.cte || []).length + ")" }, { k: "evl", lab: "ÉVALUATIONS (" + (f.evl || []).length + ")" },
          { k: "cgf", lab: "CONTRATS (" + (f.cgf || []).length + ")" }, { k: "docf", lab: "DOCUMENTS FISCAUX (" + (f.docf || []).length + ")" },
          f.del ? null : f.bloq ? { k: "debl", lab: "DÉBLOQUER" } : { k: "bloq", lab: "BLOQUER" },
          f.del ? null : f.arch ? { k: "desarch", lab: "DÉSARCHIVER" } : achExFinMois() && achFrsDormant(f) ? { k: "arch", lab: "ARCHIVER (DORMANT)" } : null, f.del ? { k: "rest", lab: "RESTAURER" } : { k: "del", lab: "METTRE À LA CORBEILLE" }].filter(Boolean),
        act: async (k, redraw) => { const L = achFrs(), x = L.find(y => y.id === id); if (!x) return;
          if (k === "val") { if (await achNvValider(L, x, x.code, x.nom, frsWhy(x), achFrsSave)) redraw(); return; }
          if (["rib", "cte", "evl", "cgf", "docf"].includes(k)) { achFrsFiche(id, k === "rib" ? "rib" : k, redraw); return; }
          /* v809 : BLOQUER (motif, noté dans H) — refusé dans les nouvelles consultations, devis, commandes et paiements ; ARCHIVER au mois de clôture si dormant (C1.45) */
          if (k === "bloq") { const m = await achAsk("BLOQUER " + x.nom, "MOTIF DU BLOCAGE"); if (!m) return; x.bloq = { u: typeof sviUser === "function" ? sviUser() : "", t: achNow(), why: m }; x.mod = achNow(); achFrsSave(L); achHist(x.code, "BLOQUÉ", m); redraw(); return; }
          if (k === "debl") { const m = await achAsk("DÉBLOQUER " + x.nom, "MOTIF DU DÉBLOCAGE"); if (!m) return; delete x.bloq; x.mod = achNow(); achFrsSave(L); achHist(x.code, "DÉBLOQUÉ", m); redraw(); return; }
          if (k === "arch") { if (!(await svConfirm({ title: "ARCHIVER", text: x.code + " — " + x.nom + " : DERNIER ACHAT " + (achDFr(achFrsLast(x.id)) || "AUCUN") + ". IL NE POURRA PLUS ÊTRE CHOISI DANS UNE NOUVELLE PIÈCE.", ok: "ARCHIVER" }))) return;
            x.arch = achNow(); x.mod = x.arch; achFrsSave(L); achHist(x.code, "ARCHIVÉ", "DORMANT"); redraw(); return; }
          if (k === "desarch") { delete x.arch; x.mod = achNow(); achFrsSave(L); achHist(x.code, "DÉSARCHIVÉ", x.nom); redraw(); return; }
          if (k === "del") { if (!(await svConfirm({ title: "METTRE À LA CORBEILLE", text: x.code + " — " + x.nom + " (RESTAURABLE).", ok: "METTRE À LA CORBEILLE" }))) return; x.del = achNow(); achFrsSave(L); achHist(x.code, "CORBEILLE", x.nom); redraw(); return; }
          if (k === "rest") { x.del = ""; achFrsSave(L); achHist(x.code, "RESTAURATION", x.nom); redraw(); } },
        links: [
          { t: "ARTICLES (DEVIS EN COURS)", cols: [["DÉSIGNATION"], ["U", "center"], ["PRIX HT", "number"], ["PRIX TTC", "number"], ["DEVIS"]], rows: [...arts.values()].map(({ l, v }) => { const t = l.tva === "" || l.tva === undefined ? achPrm().tva : achN(l.tva); return { cells: [l.des, l.u, achN(l.pu), achN(l.pu) * (1 + t / 100), v.ref] }; }) },
          { t: "DEVIS", cols: [["RÉFÉRENCE"], ["ARTICLES"], ["MONTANT TTC", "number"]], rows: D.map(v => ({ cells: [v.ref, (v.lignes || []).map(l => l.des).join("; "), achDvfTot(v).ttc], open: () => achGo("dvf", v.id), cls: v.state === "rejete" || v.state === "annule" ? "nv-strike" : "" })) },
          { t: "COMMANDES", cols: [["RÉFÉRENCE"], ["ARTICLES"], ["MONTANT TTC", "number"], ["ÉTAT", "center"]], rows: M.map(c => ({ cells: [c.ref, (c.lignes || []).map(l => l.des).join("; "), achCmfTot(c).ttc, ACH_CMF_ST[c.state] || ""], open: () => achGo("cmf", c.id), cls: c.state === "annule" ? "nv-strike" : "" })) },
          { t: "FACTURES", cols: [["RÉFÉRENCE"], ["N°"], ["MONTANT TTC", "number"], ["RESTE À PAYER", "number"], ["ÉTAT", "center"]], rows: FA.map(x => ({ cells: [x.ref, x.num || "", achFafTot(x).ttc, x.state === "annule" ? "" : achFafReste(x), achFafEtat(x)], open: () => achGo("faf", x.id), cls: x.state === "annule" ? "nv-strike" : "" })) },
          { t: "PAIEMENTS", cols: [["RÉFÉRENCE"], ["MODE"], ["MONTANT", "number"], ["ÉTAT", "center"]], rows: PA.map(p => ({ cells: [p.ref, p.mode, achN(p.mt), ACH_PAF_ST[p.state] || ""], open: () => achGo("paf", p.id), cls: p.state === "annule" || p.state === "rejete" ? "nv-strike" : "" })) },
          /* v808 : blocs de la page du fournisseur (checklist, hors du i) — encours et solde, litiges, évaluations, dépendance */
          (() => { const fa = FA.filter(x => !x.del && x.state !== "annule"), fac = fa.reduce((t, x) => t + achFafTot(x).ttc, 0), enc = achFrsEnc(id),
              av = achAvf().filter(a => a.frs === id && a.state !== "annule").reduce((t, a) => t + Math.max(0, achAvfReste(a)), 0), pl = achN(f.plafEnc);
            return { t: "ENCOURS ET SOLDE", cols: [["FACTURÉ TTC", "number"], ["PAYÉ", "number"], ["AVOIRS À DÉDUIRE", "number"], ["ENCOURS", "number"], ["PLAFOND", "number"], ["SOLDE DÛ", "number"]],
              rows: fa.length || av ? [{ cells: [fac, fac - enc, av, enc, pl || "", enc - av], cls: pl && enc > pl + 0.005 ? "nv-alert" : "" }] : [] }; })(),
          { t: "LITIGES", cols: [["TYPE"], ["RÉFÉRENCE"], ["MOTIF"], ["DATE", "center"]],
            rows: FA.filter(x => x.state === "reclame").map(x => ({ cells: ["FACTURE RÉCLAMÉE", x.ref, x.motif || x.recl || "", achDFr(x.mod || x.cree)], open: () => achGo("faf", x.id) }))
              .concat(achRtr().filter(r => r.frs === id).map(r => ({ cells: [r.kind === "cmd" ? "RETOUR DE COMMANDE" : "RETOUR DE MARCHANDISE", r.ref, r.motif || "", achDFr(r.date)] })))
              .concat(PA.filter(p => p.state === "rejete").map(p => ({ cells: [p.mode + " REJETÉ", p.ref, p.motif || "", achDFr(p.mod)], open: () => achGo("paf", p.id) }))) },
          { t: "ÉVALUATIONS", cols: [["DATE", "center"], ["NOTE / 10", "number"], ["CRITÈRES"]],
            rows: (f.evl || []).map(x => ({ cells: [achDFr(x.date), Math.round(achN(x.moy) * 10) / 10, (x.crit || []).map(c => c.d + " " + c.n).join(", ")], open: () => achFrsFiche(id, "evl", () => {}) })) },
          (() => { const ok = c => c.state === "valide" || c.state === "solde", all = achCmf().filter(c => ok(c) && !c.del), tot = all.reduce((t, c) => t + achCmfTot(c).ttc, 0), lui = all.filter(c => c.frs === id).reduce((t, c) => t + achCmfTot(c).ttc, 0);
            return { t: "DÉPENDANCE", cols: [["ACHATS CHEZ LUI TTC", "number"], ["ACHATS TOTAUX TTC", "number"], ["PART DE NOS ACHATS", "number"]],
              rows: lui > 0 ? [{ cells: [lui, tot, (Math.round(lui / tot * 1000) / 10).toLocaleString("fr-FR") + " %"] }] : [] }; })()] }; }
  });
}

/* v766 : panneau des dates aux hauteurs de la liste (comme les budgets) — à appeler après le dessin */
function achBdglSync(root) {
  requestAnimationFrame(() => { try { root.querySelectorAll(".svi-bdgp").forEach(pn => { const tb = pn.parentNode.querySelector("table.svi-bdgl"); if (!tb || !tb.tHead) return;
    const tr = tb.querySelector("tbody tr:not(.bdg-newrow)") || tb.querySelector("tbody tr");
    pn.style.setProperty("--bdg-head-h", Math.round(tb.tHead.getBoundingClientRect().height) + "px"); if (tr) pn.style.setProperty("--bdg-row-h", Math.round(tr.getBoundingClientRect().height) + "px"); }); } catch (e) {} });
}
/* v790 : case d'en-tête des blocs des pages d'achat = toutes les lignes du bloc */
document.addEventListener("change", e => { const a = e.target.closest && e.target.closest(".nvp-all"); if (!a) return; a.closest("table").querySelectorAll(".nvp-cb").forEach(c => { c.checked = a.checked; }); });
