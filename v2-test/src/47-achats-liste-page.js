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
/* v921 (remarque 3 du 04/11/2026) : même cycle que le budget — EN INSTANCE (rouge) → FIGÉ (vert) → VALIDÉ (noir) ;
   un élément figé reste dans la liste EN INSTANCE (achSt = « instance »), en vert ; achStF dit l'état exact */
/* B51 (05/11) : un nom lié (fournisseur, article, pièce) prend la couleur de SON état, simplement souligné — jamais de bleu par défaut */
const ACH_LK_LIST = { frs: "frs", art: "art", caf: "caf", dvf: "dvf", cmf: "cmf", rcp: "rcp", faf: "faf", avf: "avf", paf: "paf", bsn: "bsn", cli: "cli", prj: "prj" };
/* 05/11 (document unique 6.13) : liste validée — pas de colonne de corbeille (rien à supprimer) */
/* B48 : lecture seule, mémorisée (index par id) — pas une lecture complète de la liste par nom lié */
const achLkIdx = t => { const k = ACH_K[ACH_LK_LIST[t]]; return k ? achMemo("lk_" + t, [k], () => new Map((achJ(k, []) || []).map(x => [x.id, x]))) : new Map(); };
const achLkSt = (t, id) => { if (!ACH_LK_LIST[t]) return ""; let x = null; try { x = achLkIdx(t).get(id); } catch (e) {} if (!x) return "";
  /* 05/11 (2.10), 06/11 : comme dans sa propre liste — même état commun (achPcSt) */
  return achPcSt(t, x); };
function achLkPaint(root) { (root || document).querySelectorAll(".ach-link[data-nvgo]").forEach(b => { const [t, id] = String(b.dataset.nvgo).split("|"), s = achLkSt(t, id);
  if (b.dataset.lk === s) return; ["instance", "partiel", "remis", "valide", "annule", "bloque", "encours", "expire", "archive"].forEach(k => b.classList.toggle("lk-" + k, k === s)); b.dataset.lk = s; }); }
{ let raf = 0; new MutationObserver(() => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const v = document.getElementById("ach"); if (v) { achLkPaint(v); try { achListCloseSync(); } catch (e) {} } try { sviSyncState(); } catch (e) {} const c = document.getElementById("svConf"); if (c) achLkPaint(c); }); })
    .observe(document.documentElement, { childList: true, subtree: true }); }
const achSt = x => x && (x.st === "instance" || x.st === "fige") ? "instance" : "valide";
const achStF = x => achSt(x);
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
    const head = { doc: ["RÉFÉRENCE", "DATE", "INTITULÉ"],   /* 11/11 (Ahmed) : plus de colonne FICHIER — la référence soulignée ouvre le document */
      taf: ["RÉFÉRENCE", "DATE", "TÂCHE", "ÉCHÉANCE", "FAIT"], obs: ["DATE", "OBSERVATION", "IMPORTANTE"] }[tab];
    /* v793 : SUIVI des fiches d'achat au format du SUIVI du budget — loupe sur chaque colonne, largeur des colonnes réglable et gardée */
    const ACC = { doc: [x => x.ref || "", x => dt(x.date), x => x.title || ""], taf: [x => x.ref || "", x => dt(x.date), x => x.title || "", x => achDFr(x.ech), x => x.done ? "OUI" : "NON"], obs: [x => dt(x.date), x => x.text || "", x => x.important ? "!" : ""] }[tab];
    const tk = "achrec_" + tab, C = head.map((h, j) => ["c" + j, h, r => ACC[j](r.x), /FICHIER|FAIT|IMPORTANTE/.test(h) ? "center" : ""]);
    const R0 = L.map((x, i) => ({ x, i })).reverse(), R = ctx && ctx.cfApply ? ctx.cfApply(tk, C, R0) : R0;
    const CG = sviCwCols(tk, C.map((c, j) => [c[0], /DATE|ÉCHÉANCE/.test(c[1]) ? 140 : c[3] === "center" ? 100 : j === 0 && tab !== "obs" ? 170 : 260]));
    const th = c => ctx && ctx.cfHead ? ctx.cfHead(tk, c[0], c[1], c[3]) : `<th class="${c[3]}">${esc(c[1])}</th>`;
    const row = (x, i) => tab === "doc" ? `<td>${x.fk ? `<button type="button" class="ach-link" data-recf="${i}">${esc(x.ref || "DOCUMENT")}</button>` : esc(x.ref || "")}</td><td>${esc(dt(x.date))}</td><td>${esc(x.title || "")}</td>`
      : tab === "taf" ? `<td>${esc(x.ref || "")}</td><td>${esc(dt(x.date))}</td><td>${esc(x.title || "")}</td><td>${esc(achDFr(x.ech))}</td><td class="center"><input type="checkbox" class="rec-done" data-i="${i}"${x.done ? " checked" : ""}></td>`
      : `<td>${esc(dt(x.date))}</td><td>${esc(x.text || "")}</td><td class="center">${x.important ? "<b>!</b>" : ""}</td>`;
    /* v776 : bloc SUIVI comme celui du budget — en-tête SUIVI (agrandir, ⋯), rangée d'onglets, ligne CRÉER … ICI */
    return `<div class="bdg-d-block blk-rec blk-suivi nvp-rec nvp-blk" data-nvb="rec"><div class="bdg-d-block-title blk-head"><span class="ttl">${SVI_ICON.doc || ""}SUIVI</span>${achBlkTools("rec")}</div>
      <div class="blk-tabrow"><span class="rec-tabs">${["doc", "taf", "obs"].map(k => `<button type="button" class="rec-tab${k === tab ? " active" : ""}" data-nvr="${k}">${SVI_ICON[k] || ""}${{ doc: "DOCUMENTS", taf: "TAF", obs: "OBSERVATIONS" }[k]} ${svCnt(get(k).length)}</button>`).join("")}</span></div>
      <div class="rec-scroll" style="${achNvhSc("rec")}"><table class="bdg-d-table rec-table" data-svcw="${tk}" style="${CG.style}">${CG.cg}<thead><tr>${C.map(th).join("")}</tr></thead>
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
  /* v1124 : title = intitulé exact (facultatif ; sinon le nom du fichier sans .pdf, comme avant) */
  const savePdf = async (blob, name, title) => { const L = get("doc"), n = L.length + 1, k = "ach:doc:" + code + ":" + Date.now().toString(36);
    try { await sviFiles.put(k, new File([blob], name, { type: "application/pdf" })); } catch (e) {}
    const x = { ref: "ACH DOC " + code + "/" + String(n).padStart(3, "0"), date: new Date().toISOString(), title: title || name.replace(/\.pdf$/i, ""), fk: k, fname: name };
    L.push(x); achW(K.doc, L); achHist(code, "DOCUMENT", x.title); return x.ref; };
  return { html, click, change, savePdf, addTab: t => { tab = t; return add(); }, list: get };
}

/* ---------- LISTE au format du budget ----------
   o = { k, t, name ("ARTICLES"), one ("ARTICLE"), all(), save(L), code(x), nom(x), cols(), why(x), newRow, add(done), page(id), stOf(x), step(x) } */
/* 06/11/2026 (décision, document unique 3.9) : UNE SEULE LISTE par type de pièce — plus de listes EN INSTANCE / VALIDÉS ni de bascule ;
   à gauche, TOUT puis des cases à cocher combinables par état (choix gardé), puis les dates ; colonne ÉTAT = étape exacte (E3) ;
   ligne CRÉER … ICI toujours là ; corbeille seulement sur les lignes qu'on peut supprimer (colonne absente s'il n'y en a aucune, 6.13) */
function achNvList(ctx, o) {
  const { cfApply, cfHead, draw } = ctx;
  const SK = "ach_" + o.k, KEYS = o.stKeys || SVI_STF_PIECE;
  let dSel = "", order = [];
  const isI = x => o.inst ? !!o.inst(x) : achSt(x) === "instance";
  const stOf = (x, all) => { const s = o.stOf ? o.stOf(x) : achPcSt(o.k, x) || (isI(x) ? "instance" : "valide"); const w = o.why(x, all); return w && w.length ? [s, "alerte"] : [s]; };
  const dI = x => o.dI ? o.dI(x) : x.cree, dV = x => o.dV ? o.dV(x) : x.val || x.cree;
  const dOf = x => achDay(isI(x) ? dI(x) : dV(x) || dI(x));
  const step = x => o.step ? o.step(x) : achPcStep(o.k, x);
  /* colonnes : celles de la liste, ÉTAT (étape exacte), puis VALIDÉ LE et SAISI LE */
  const colsOf = () => { const C0 = o.cols("all").filter(c => c[1] !== "SAISI LE" && c[1] !== "VALIDÉ LE"), i = C0.findIndex(c => c[1] === "ÉTAT");
    const ET = ["_etat", "ÉTAT", x => step(x), "center"]; if (i >= 0) C0[i] = [C0[i][0], "ÉTAT", x => step(x), "center"]; else C0.push(ET);
    return C0.concat([["_val", "VALIDÉ LE", x => isI(x) ? "" : svDT(dV(x) || ""), ""], ["_cree", "SAISI LE", x => svDT(dI(x) || ""), ""]]); };
  const h1 = () => { const all = o.all(), sel = sviStfGet(SK), n = all.filter(x => sviStfOk(sel, stOf(x, all))).length;
    return esc(o.name) + ` <span class="bdgl-cnt">${svCnt(n)}</span>`; };
  /* 06/11 (soir) : compteurs des états pour le menu ▾ */
  const counts = () => { const all = o.all(), C = { tout: all.length }; all.forEach(x => stOf(x, all).forEach(k => { C[k] = (C[k] || 0) + 1; })); return C; };
  const html = () => {
    SVI_STF_REG[SK] = { keys: KEYS, L: o.stLab, counts, redraw: () => { dSel = ""; draw(); } };
    const t1 = h1();
    const all = o.all(), sel = sviStfGet(SK), ST = new Map(all.map(x => [x.id, stOf(x, all)]));
    /* états (menu ▾) puis filtre commun des dates (entonnoir) : les deux se cumulent */
    const base0 = all.filter(x => sviStfOk(sel, ST.get(x.id))), base = cfApply(o.t + "_d", [["_jour", "DATE", x => achDFr(dOf(x)) || "SANS DATE", ""]], base0);
    const days = [...base.reduce((m, x) => m.set(dOf(x), (m.get(dOf(x)) || 0) + 1), new Map())].sort((a, b) => b[0].localeCompare(a[0]));
    if (dSel && !days.some(d => sviDateIn(d[0], dSel))) dSel = "";
    /* 06/11 (soir) : par défaut, la liste est classée de la plus récente à la plus ancienne (un tri par colonne passe devant) */
    const rows0 = base.filter(x => sviDateIn(dOf(x), dSel)).slice().sort((a, b) => String(dI(b) || "").localeCompare(String(dI(a) || "")) || String(o.code ? o.code(b) : b.ref || "").localeCompare(String(o.code ? o.code(a) : a.ref || ""), "fr", { numeric: true }));
    const cols = coOrder(o.t, colsOf()), rows = sviPinSort(cfApply(o.t, cols, rows0), x => x.ref || x.code);   /* série I (I4) : épinglées en tête */
    order = rows.map(x => x.id);
    const canDel = x => isI(x) && !x.del && x.state !== "annule", delCol = false;   /* série J (J4) : plus de corbeille par ligne — SUPPRIMER LES … COCHÉ(E)S dans le ⋯ */
    /* 06/11 (soir) : largeur des colonnes au moteur commun (chaque colonne se règle seule, gardée) */
    /* série J (J4) : SUPPRIMER LES … COCHÉ(E)S (⋯ de la barre du haut) — mêmes règles que l'ancienne corbeille (EN INSTANCE ; restaurable, numéro jamais réutilisé) */
    const cdOf = x => o.code ? o.code(x) : x.ref || x.code || x.id, nmOf = x => { const n = o.nom ? o.nom(x) : x.objet || x.des || ""; return cdOf(x) + (n ? " — " + n : ""); };
    { const fem = /^CETTE/.test(achCe(o.one || "")); (window.SVI_LDEL = window.SVI_LDEL || {})[o.t] = { lab: "SUPPRIMER LES " + String(o.name || "PIÈCES").toUpperCase() + (fem ? " COCHÉES" : " COCHÉS"),
      ok: id => { const x = o.all().find(y => y.id === id); return !!(x && canDel(x) && !(o.mOf && o.mOf(x))); }, nom: id => { const x = o.all().find(y => y.id === id); return x ? nmOf(x) : id; },
      /* correction (compte rendu v1006) : pièces d'achat = ANNULÉES avec un motif, gardées (comme l'ancienne corbeille, v817) ; articles, fournisseurs = corbeille restaurable */
      run: async ids => { if (o.kill) { const m = await achAsk("ANNULER LES PIÈCES COCHÉES (GARDÉES, VISIBLES DANS ANNULÉS)", "MOTIF DE L'ANNULATION"); if (!m) return;
          const L = o.all(), now = achNow(); ids.forEach(id => { const x = L.find(y => y.id === id); if (!x || !canDel(x) || (o.mOf && o.mOf(x))) return; x.state = "annule"; x.motifAnn = m; x.mod = now; achHist(x.ref || cdOf(x), "ANNULÉ — " + m, ""); }); o.save(L); draw(); return; }
        const L = o.all(), now = achNow(); ids.forEach(id => { const x = L.find(y => y.id === id); if (!x || !canDel(x)) return; x.del = now; x.mod = now; achHist(cdOf(x), "CORBEILLE", nmOf(x)); }); o.save(L); draw(); } }; }
    const W = o.w || {}, CG = sviCwCols(o.t, cols.map(c => [c[0], W[c[0]] || 120]), (delCol ? [["_del", 44]] : []).concat(ACH_AP_ON(o.k) ? [["_ap", o.k === "art" ? 56 : 30]] : [], [["_cb", 28]]));
    const ED = o.edit || {};
    /* F14 (fin) : une colonne peut dépendre de la pièce (ex. CHARGE d'un besoin : liste des charges du budget, ou texte libre au SIÈGE) */
    const edOf = (k, x) => { const E = ED[k]; return typeof E === "function" ? E(x) : E; };
    const cell = (x, c) => { const v = c[2](x), cl = c[3] === "number" ? "number" : c[3] === "center" ? "center" : "";
      /* F7 (série F) : la RÉFÉRENCE est soulignée — elle ouvre la pièce */
      if (c[0] === "ref") { const w = o.why(x, all); return `<td class="bdg-ref-c ${cl}"><span class="nv-bslot">${w.length ? `<b class="obs-bang val-bang nv-bang" role="button" data-why="${esc(w.join(" · "))}">!</b>` : ""}</span><button type="button" class="nv-reflink" data-nvo="${esc(x.id)}">${esc(v)}</button>${sviPinMk(x.ref || x.code)}</td>`; }
      /* F17 (série F), 2.10 : fournisseurs = noms soulignés, chacun dans la couleur de son propre état ; toucher = sa fiche */
      const edOk = edOf(c[0], x) && isI(x) && !x.del;
      if (c[0] === "frs" && x.frs && !(o.mOf && o.mOf(x))) { const F = (Array.isArray(x.frs) ? x.frs : [x.frs]).filter(Boolean);
        return `<td class="${cl} nv-lk${edOk ? " nv-ed" : ""}"${edOk ? ` data-ed="${esc(c[0])}" data-edsel="1"` : ""} title="${esc(F.map(achFrsNom).join(", "))}">${F.map(f => `<button type="button" class="ach-link" data-nvgo="frs|${esc(f)}">${esc(achFrsNom(f))}</button>`).join(", ")}</td>`; }
      /* F14 (série F) : pièce EN INSTANCE — champ modifiable directement dans la liste (1er toucher = case choisie, 2e = saisie, règle 8.2) */
      if (edOf(c[0], x) && isI(x) && !x.del) { const t = typeof v === "number" ? achF2(v) : String(v ?? ""), E1 = edOf(c[0], x); return `<td class="${cl} nv-ed" data-ed="${esc(c[0])}"${E1 && E1.type === "sel" ? ' data-edsel="1"' : ""} title="${esc(t)}">${esc(t)}</td>`; }
      /* v910 (checklist C1.38) : 5e élément d'une colonne = image (logo) devant le texte, à la hauteur de la ligne */
      const im = c[4] ? c[4](x) : "";
      const t = typeof v === "number" ? achF2(v) : String(v ?? ""); return `<td class="${cl}" title="${esc(t)}">${im ? `<img class="nv-logo" src="${esc(im)}" alt="">` : ""}${esc(t)}</td>`; };
    /* 08/11 (document unique 6.7, remarque d'Ahmed) : ligne TOTAL des colonnes de montants (lignes affichées) ; TOTAL PARTIEL si un filtre en cache */
    const totRow = () => { const M = cols.map((c, i) => c[3] === "number" && /MONTANT|TTC|\bHT\b|RESTE|TOTAL|MOINS-DISANT/.test(String(c[1]).toUpperCase()) ? i : -1).filter(i => i >= 0); if (!M.length) return "";
      const part = rows.length < all.filter(x => !x.del).length, lab = part ? "TOTAL PARTIEL" : "TOTAL", sum = i => rows.reduce((a, x) => { const v = cols[i][2](x); return a + (typeof v === "number" ? v : 0); }, 0), li = M.includes(0) ? -1 : 0;
      return `<tfoot><tr class="bdg-d-total-row">${cols.map((c, i) => M.includes(i) ? `<td class="number">${achF2(sum(i))}</td>` : i === li ? `<td><b>${lab}</b></td>` : "<td></td>").join("")}${delCol ? "<td></td>" : ""}<td></td></tr></tfoot>`; };
    const rowCls = x => { const s = ST.get(x.id)[0]; return (s === "instance" ? "inst-instance" : s === "fige" ? "inst-fige" : "inst-valide") + " st-" + s; };
    return `<div class="novapp-list-shell"><div class="novapp-list-titlebar"><button class="novapp-menu open-menu" type="button" aria-label="Menu">☰</button><h1>${t1}</h1>${sviListIH()}${sviListBar()}</div>
      <div class="novapp-budget-layout"><aside class="novapp-date-panel svi-bdgp">
        <div class="novapp-date-head">${sviDateFold("ach_" + o.k)}${sviStfHead(SK, base.length, o.stLab, o.t + "_d")}</div>
        <div class="novapp-date-list">${sviDateTree("ach_" + o.k, days, dSel, "data-nvday", () => draw())}</div></aside>
      <div class="novapp-budget-table-wrap"><table id="${o.id}" class="novapp-budget-table svi-bdgl nv-one" data-sdel="${esc(o.t)}" data-ach="${o.k}" data-stf="${esc(SK)}" data-svcw="${esc(o.t)}" style="${CG.style}">
        ${CG.cg}
        <thead><tr>${cols.map(c => cfHead(o.t, c[0], c[1], "bdg-list-head" + (c[3] === "number" ? " number" : ""))).join("")}${delCol ? '<th class="bdg-act-h"></th>' : ""}${ACH_AP_ON(o.k) ? achApTh() : ""}${sviListCbTh()}</tr></thead>
        <tbody>${rows.map(x => `<tr data-id="${esc(x.id)}" data-iid="${esc(x.id)}" data-nvo="${esc(x.id)}" data-st="${esc(ST.get(x.id)[0])}" class="${rowCls(x)}${x.del || x.state === "annule" ? " etat-bloque" : ""}${x.actif === false ? " etat-archive" : ""}">${cols.map(c => cell(x, c)).join("")}${delCol ? `<td class="bdg-action-cell">${canDel(x) ? `<button type="button" class="bdg-row-action bdg-row-del" data-nvdel="${esc(x.id)}" title="Supprimer" aria-label="Supprimer">${SVI_DEL_ICON}</button>` : ""}</td>` : ""}${ACH_AP_ON(o.k) ? achApTd(o.k + "|" + x.id, o.k === "art" && !x.del ? x.id : "") : ""}${sviListCbTd()}</tr>`).join("")
          || ""}
          ${o.newRow ? `<tr class="bdg-newrow" data-nvnew data-st="instance"><td colspan="${cols.length + (delCol ? 2 : 1)}">${esc(o.newRow)}</td></tr>` : ""}</tbody>${totRow()}</table></div></div></div>`;
  };
  /* F14 : saisie dans la case (ENTRÉE ou toucher ailleurs = enregistré ; ÉCHAP = annulé) */
  const edit = td => { const id = td.closest("tr").dataset.id, k = td.dataset.ed, L = o.all(), x = L.find(y => y.id === id), E0 = (o.edit || {})[k], E = x && (typeof E0 === "function" ? E0(x) : E0); if (!E || !x) return;
    const v0 = E.get ? E.get(x) : x[k] ?? "", f = E.f || k;
    /* choix dans une liste (fournisseur, catégorie, mode…) : le menu commun de l'application, jamais celui de l'iPad */
    if (E.type === "sel") { const O = (E.opts ? E.opts(x) : []); sviEtatMenu(td, O.map(([v, l]) => ({ k: String(v), lab: l })), String(v0 ?? ""), nv => {
        const L2 = o.all(), y = L2.find(z => z.id === id); if (!y || String(nv) === String(v0 ?? "")) { draw(); return; } const bad = E.check ? E.check(y, nv, L2) : ""; if (bad) { svToast(bad, 3500, td); draw(); return; }
        if (E.set) E.set(y, nv); else y[f] = nv; y.mod = achNow(); o.save(L2); achHist(o.code ? o.code(y) : y.ref, "MODIFIÉ DANS LA LISTE", (E.lab || k).toUpperCase() + " : " + ((O.find(z => String(z[0]) === String(nv)) || [nv, nv])[1])); draw(); }); return; }
    /* 11/11 (Ahmed, règle 6.9) : un texte se saisit sur PLUSIEURS LIGNES (la case s'ouvre sur toute sa largeur, la ligne grandit, tout est visible) ;
       nombres et dates gardent leur champ d'une ligne */
    const ML = E.type !== "num" && E.type !== "date" && typeof window.sviTaEdit === "function";
    const inp = ML ? { value: String(v0 ?? ""), isConnected: false, addEventListener() {}, focus() {}, select() {} } : document.createElement("input"); inp.className = "ins-in nv-edin" + (E.type === "num" ? " number" : "");
    if (E.type === "date") inp.type = "date"; else if (E.type === "num") inp.inputMode = "decimal"; inp.value = E.type === "num" ? String(v0 ?? "").replace(".", ",") : String(v0 ?? "");
    const txt0 = td.textContent; inp.__edit = true; if (!ML) { td.textContent = ""; td.appendChild(inp); inp.focus(); try { inp.select(); } catch (er) {} }
    /* 10/11 (comme l'INTITULÉ de la liste BDG) : la case est remise en place SANS redessiner — ENTRÉE / ÉCHAP gardent la case sélectionnée ; ANNULER / RÉTABLIR */
    const t0 = Date.now(); let done = false; const fin = ok => { if (done) return; if (ok === "blur" && Date.now() - t0 < 600 && inp.isConnected) { setTimeout(() => { inp.__edit = true; inp.focus(); }, 0); return; } done = true; let show = txt0;
      if (ok) { const nv = E.type === "num" ? achN(inp.value) : E.type === "date" ? inp.value : E.keep ? String(inp.value).trim() : achU(inp.value);
        if (String(nv) !== String(v0 ?? "")) { const L2 = o.all(), y = L2.find(z => z.id === id); if (y) { const bad = E.check ? E.check(y, nv, L2) : ""; if (bad) { svToast(bad, 3500, td); draw(); return; }
          const before = E.get ? E.get(y) : y[f]; if (E.set) E.set(y, nv); else y[f] = nv; y.mod = achNow(); o.save(L2); achHist(o.code ? o.code(y) : y.ref, "MODIFIÉ DANS LA LISTE", (E.lab || k).toUpperCase() + " : " + nv);
            const col = colsOf().find(c => c[0] === k), v1 = col ? col[2](y) : nv; show = typeof v1 === "number" ? achF2(v1) : String(v1 ?? "");
            if (typeof sviUndoPush === "function") sviUndoPush(dir => { const L3 = o.all(), z = L3.find(q => q.id === id); if (!z) return; const w = dir === "undo" ? before : nv; if (E.set) E.set(z, w); else z[f] = w; z.mod = achNow(); o.save(L3); draw(); }, "MODIFICATION " + (E.lab ? "DE « " + String(E.lab).toUpperCase() + " »" : "DANS LA LISTE")); } } }
      td.textContent = show; td.title = show; td.classList.remove("nv-sel");
      if (ok !== "blur") { if (!td.hasAttribute("tabindex")) td.setAttribute("tabindex", "-1"); td.classList.add("svi-tdf"); try { td.focus({ preventScroll: true }); } catch (er) {} } };
    inp.addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); fin(true); } if (ev.key === "Escape") { ev.preventDefault(); fin(false); } });
    inp.addEventListener("blur", () => fin("blur"));
    if (ML) window.sviTaEdit(td, inp.value, (ok, v) => { inp.value = v; fin(ok); }); };
  /* 10/11 : plage de cases modifiables de la liste — COLLER (une ligne par case, ou la même partout) / EFFACER sur chaque case, une seule annulation */
  (window.__sviNvEdMods = window.__sviNvEdMods || {})[o.t] = async (v, tds) => { let lines = [""];
    if (v === "paste") { let t = ""; try { t = await navigator.clipboard.readText(); } catch (er) {} if (!t) t = window.__sviSelClip || ""; lines = String(t).split(/\r?\n/).map(z => z.split("\t")[0].trim()).filter(Boolean); if (!lines.length) { svToast("RIEN À COLLER : COPIEZ D'ABORD DES CASES.", 2200); return; } }
    const L = o.all(), B4 = [], AF = []; let n = 0;
    tds.forEach((td, i) => { const tr = td.closest("tr"), id = tr && tr.dataset.id, k = td.dataset.ed, x = L.find(y => y.id === id), E0 = (o.edit || {})[k], E = x && (typeof E0 === "function" ? E0(x) : E0); if (!E || E.type === "sel" || !isI(x) || x.del) return;
      const raw = v === "clear" ? "" : String(lines.length > 1 ? (lines[i] || "") : lines[0]), nv = E.type === "num" ? (raw === "" ? "" : achN(raw)) : E.type === "date" ? raw : E.keep ? raw.trim() : achU(raw), f = E.f || k;
      const bad = E.check && nv !== "" ? E.check(x, nv, L) : ""; if (bad) return; const before = E.get ? E.get(x) : x[f]; if (String(before ?? "") === String(nv)) return;
      B4.push([id, E, f, before]); AF.push([id, E, f, nv]); if (E.set) E.set(x, nv); else x[f] = nv; x.mod = achNow(); n++; });
    if (n) { o.save(L); const put = A => { const L2 = o.all(); A.forEach(([id, E, f, w]) => { const z = L2.find(q => q.id === id); if (!z) return; if (E.set) E.set(z, w); else z[f] = w; z.mod = achNow(); }); o.save(L2); draw(); };
      if (typeof sviUndoPush === "function") sviUndoPush(dir => put(dir === "undo" ? B4 : AF), v === "clear" ? "EFFACEMENT DES CASES" : "COLLAGE DES CASES"); }
    draw(); svToast(n + " CASE(S) " + (v === "clear" ? "EFFACÉE(S)." : "COLLÉE(S)."), 1800); };
  const click = async e => {
    const gl0 = e.target.closest(".ach-link[data-nvgo]"); if (gl0) { const [t, gid] = gl0.dataset.nvgo.split("|"); achGo(t, gid); return true; }   /* nom souligné = sa propre fiche */
    const ed = e.target.closest("td.nv-ed"); if (ed && !e.target.closest("input")) { if (ed.classList.contains("nv-sel")) edit(ed); else { document.querySelectorAll("td.nv-sel").forEach(t => t.classList.remove("nv-sel")); ed.classList.add("nv-sel");
        if (!ed.hasAttribute("tabindex")) ed.setAttribute("tabindex", "-1"); ed.classList.add("svi-tdf"); try { if (document.activeElement !== ed) ed.focus({ preventScroll: true }); } catch (er) {} } return true; }
    if (e.target.closest("input.nv-edin")) return true;
    const gl = e.target.closest(".ach-link[data-nvgo]"); if (gl) { const [t, gid] = gl.dataset.nvgo.split("|"); achGo(t, gid); return true; }
    const dy = e.target.closest("[data-nvday]"); if (dy) { dSel = dSel === dy.dataset.nvday ? "" : dy.dataset.nvday; draw(); return true; }
    const w = e.target.closest(".nv-bang"); if (w) { e.stopPropagation(); svToast(w.dataset.why, 4000, w); return true; }
    const dl = e.target.closest("[data-nvdel]");
    if (dl && o.kill) { const x = o.all().find(y => y.id === dl.dataset.nvdel); if (x && await o.kill(x)) draw(); return true; }
    if (dl) { const L = o.all(), x = L.find(y => y.id === dl.dataset.nvdel); if (!x) return true;
      if (!(await svConfirm({ title: "SUPPRIMER" + (o.one ? " " + achCe(o.one) : ""), text: o.code(x) + " — " + o.nom(x) + " (RESTAURABLE : CASE ANNULÉ ; SON NUMÉRO NE SERA PAS RÉUTILISÉ).", ok: "SUPPRIMER" }))) return true;
      x.del = achNow(); x.mod = x.del; o.save(L); achHist(o.code(x), "CORBEILLE", o.nom(x)); draw(); return true; }
    if (e.target.closest("[data-nvnew]")) { o.add(id => { draw();
      if (id && id !== "x" && o.page && o.all().some(x => x.id === id)) o.page(id); }); return true; }   /* v800 (3.6) : la page de la nouvelle pièce s'ouvre */
    /* 09/11 (règle 2.10) : une ligne qui a sa référence soulignée ne s'ouvre que par elle ; la partie vide suit la règle commune (sélection) */
    const tr0 = e.target.closest("tr[data-nvo]"), viaLink = tr0 && tr0.querySelector("button[data-nvo]");
    const r = e.target.closest("button, .cf-btn, thead") || viaLink ? e.target.closest("button[data-nvo]") : e.target.closest("[data-nvo]");
    if (r) { o.page(r.dataset.nvo || r.dataset.id); return true; }
    return false;
  };
  return { html, click, h1, order: () => order };
}
/* F14 (série F, 06/11) : TOUS LES CHAMPS MODIFIABLES DIRECTEMENT DANS LES LISTES (pièce EN INSTANCE) — colonne → champ de la fiche, type (texte,
   nombre, date, choix) et contrôle ; les colonnes calculées (montants, compteurs, état, dates de saisie) et la référence restent en lecture seule */
const achEdFrs = () => achLive(achFrs()).filter(f => achFrsOk(f)).map(f => [f.id, f.nom]);
const ACH_ED = {
  caf: { objet: { lab: "OBJET" }, dlim: { lab: "DATE LIMITE", type: "date" } },
  dvf: { caf: { lab: "CONSULTATION", type: "sel", opts: () => [["", "HORS CONSULTATION"]].concat(achCaf().filter(c => c.state === "ouverte").map(c => [c.id, c.ref + (c.objet ? " — " + c.objet : "")])) },
    frs: { lab: "FOURNISSEUR", type: "sel", opts: achEdFrs }, nfrs: { lab: "N° FOURNISSEUR", f: "refFrs" }, date: { lab: "DATE", type: "date" }, val: { lab: "VALIDITÉ", type: "date", f: "validite" } },
  cmf: { nat: { lab: "NATURE" }, frs: { lab: "FOURNISSEUR", type: "sel", opts: achEdFrs }, lieu: { lab: "LIVRAISON" }, prom: { lab: "DATE PROMISE", type: "date", f: "dProm", get: c => c.dProm || "" } },
  faf: { cmf: f => f.fa !== undefined || f.type === "acompte" ? null : { lab: "COMMANDE", type: "sel", opts: y => [["", "SANS COMMANDE"]].concat(achCmf().filter(c => c.frs === y.frs && (c.state === "valide" || c.state === "solde")).map(c => [c.id, c.ref])), get: y => y.cmf || "",
      set: (y, v) => { const C = achCmf().find(c => c.id === v); y.cmf = v; y.lignes = C ? achFafCmfLines(C, y.id) : []; y.rem = C ? achN(C.rem) : 0; y.avImp = C ? achAvReste(C.id, y.id) : 0; y.frais = 0; } },
    num: { lab: "N° FACTURE" }, frs: { lab: "FOURNISSEUR", type: "sel", opts: achEdFrs }, dfac: { lab: "DATE", type: "date", f: "dFac" } },
  avf: { num: { lab: "N° AVOIR" }, date: { lab: "DATE", type: "date" }, ttc: { lab: "MONTANT TTC", type: "num", get: a => achN(a.ttc) }, motif: { lab: "MOTIF" } },
  paf: { frs: { lab: "FOURNISSEUR", type: "sel", opts: achEdFrs }, mode: { lab: "MODE", type: "sel", opts: () => ACH_MODES.map(m => [m, m]) }, num: { lab: "N°" }, date: { lab: "DATE", type: "date" },
    mt: { lab: "MONTANT", type: "num", check: (p, v) => v > 0 ? "" : "MONTANT NON VALIDE." } },
  rcp: { nbl: { lab: "N° BL" } },
  rtr: { motif: { lab: "MOTIF" } },
  bsn: { bdg: { lab: "BUDGET", type: "sel", opts: () => [["SIÈGE", "SIÈGE (HORS BUDGET)"]].concat(achBdgList().map(x => [x.ref, x.lab])), get: b => b.centre === "SIÈGE" ? "SIÈGE" : b.bdg || "",
      set: (b, v) => { b.chg = ""; b.tache = ""; b.des = ""; b.u = ""; b.pu = 0;
        if (v === "SIÈGE") { b.centre = "SIÈGE"; b.bdg = ""; b.bdgLab = ""; } else { b.centre = "CHANTIER"; b.bdg = v; b.bdgLab = (achBdgList().find(x => x.ref === v) || {}).lab || v; } } },
    des: b => b.centre === "SIÈGE" ? { lab: "CHARGE", check: (y, v) => v ? "" : "CHARGE OBLIGATOIRE." }
      : b.bdg ? { lab: "CHARGE", type: "sel", opts: y => achBdgCharges(y.bdg).map(c => [c.key, c.des + " (" + c.u + ")"]), get: y => y.chg || "",
        set: (y, v) => { const c = achBdgCharges(y.bdg).find(z => z.key === v); y.chg = v; y.tache = c && c.tasks.length === 1 ? c.tasks[0] : ""; if (c) { y.des = c.des; y.u = c.u; y.pu = Math.round(c.p * 100) / 100; } } } : null,
    q: { lab: "QUANTITÉ", type: "num", check: (b, v) => v > 0 ? "" : "QUANTITÉ OBLIGATOIRE (> 0)." }, tache: { lab: "TÂCHE" }, prevue: { lab: "PRÉVU LE", type: "date", f: "datePrevue" }, dem: { lab: "DEMANDEUR" } },
  art: { nom: { lab: "DÉSIGNATION", f: "des", check: (a, v, L) => !v ? "DÉSIGNATION OBLIGATOIRE." : achArtDup(L, v, a.u, a.id) ? "UN ARTICLE IDENTIQUE EXISTE." : "" },
    u: { lab: "UNITÉ", check: (a, v, L) => !v ? "UNITÉ OBLIGATOIRE." : achArtDup(L, a.des, v, a.id) ? "UN ARTICLE IDENTIQUE EXISTE." : "" },
    cat: { lab: "CATÉGORIE", type: "sel", opts: () => [["", "—"]].concat(achPrm().cat.map(c => [c, c])) }, pref: { lab: "PRIX RÉF. HT", type: "num" }, pmax: { lab: "PLAFOND HT", type: "num" } },
  frs: { nom: { lab: "NOM", check: (f, v) => v ? "" : "NOM OBLIGATOIRE." }, ville: { lab: "VILLE" }, ice: { lab: "ICE", f: "ice", check: (f, v) => !v || achIceOk(v) ? "" : "ICE : 15 CHIFFRES." }, cond: { lab: "PAIEMENT" } }
};
const achPcCirc = x => !!x.circ && !["valide", "bap", "emis", "encaisse", "solde", "annule", "retenu"].includes(x.state) && typeof achCircDone === "function" && !achCircDone(x);
/* 06/11 : ÉTAT d'une pièce, d'un fournisseur, d'un article — un des états communs de la palette (liste, fiche, fenêtre, noms liés) */
/* v1119 (L20) : une consultation est « envoyée » dès qu'une consultation fille (par fournisseur) est partie */
const achCafSent = x => Object.values((x && x.fil) || {}).some(f => f && f.env) || Object.values((x && x.rep) || {}).some(r => r && r.env);
/* v1121 (L20) : tous les fournisseurs consultés ont répondu (devis reçu ou décliné) */
const achCafAllRep = x => { const F = (x && x.frs) || []; if (!F.length || !achCafSent(x)) return false; const D = achDvf(); return F.every(f => ((x.rep || {})[f] || {}).st === "decline" || D.some(v => v.caf === x.id && v.frs === f && v.state !== "annule")); };
const achPcSt = (t, x) => { if (!x) return "";
  if (x.del || x.state === "annule" || x.state === "rejete") return "annule";
  if (t === "frs" || t === "art" || t === "cli" || t === "prj") { if (x.arch) return "archive"; if (x.bloq || x.actif === false) return "bloque";
    if (t === "frs" && achSt(x) !== "instance" && typeof achFrsAttExp === "function") { try { if (achFrsAttExp(x)) return "expire"; } catch (e) {} } return achSt(x); }
  if (achPcCirc(x)) return "encours";
  if (x.susp || x.litige) return "bloque";
  if (t === "dvf") { if (x.state === "recu" || !x.state) { const L = x.lignes || []; if (L.some(l => achN(l.pu) > 0) && L.some(l => !(achN(l.pu) > 0))) return "partiel"; return "instance"; }
    if (x.exp && String(x.exp).slice(0, 10) < new Date().toISOString().slice(0, 10) && x.state !== "retenu") return "expire"; return "valide"; }
  if (t === "cmf" && x.state === "valide") { try { const R = achRcp(), T = achRtr(), L = x.lignes || [], got = L.some(l => achRecQ(x.id, l.id, R, T) > 0), rest = L.some(l => achResteQ(x, l, R, T) > 1e-9);
    if (got && rest) return "partiel"; if (!got && x.envoi) return "remis"; } catch (e) {} return "valide"; }
  if (t === "faf") { if (x.state === "bap") { try { if (achFafReste(x) > 0.005 && achFafPaid(x.id) > 0) return "partiel"; } catch (e) {} return "valide"; } return "instance"; }
  if (t === "paf") return x.state === "emis" ? "remis" : x.state === "encaisse" ? "valide" : "instance";
  if (t === "bsn") { if (x.state !== "valide") return "instance"; try { const a = achBsnAv(x), q = achN(x.q); if (a.cmdQ > 0 && q && a.recQ < q - 1e-9) return "partiel"; } catch (e) {} return "valide"; }
  /* v1121 (L20, série L, cycle d'Ahmed, règle 1.2 sans exception) : ROUGE en création ; VERT en cours de validation (circuit, plus haut) ;
     ORANGE validée mais pas encore remise ; BLEU remise, des devis encore attendus ; NOIR tous les fournisseurs ont répondu, ou close par un validateur */
  if (t === "caf") return x.state !== "ouverte" || achCafAllRep(x) ? "valide" : achCafSent(x) ? "partiel" : x.val ? "remis" : "instance";
  if (x.state === "instance" || x.state === "ouverte" || x.state === "recu" || x.state === "reclame") return "instance";
  if (x.state === "emis") return "remis";
  return "valide"; };
/* E3 (série E) : colonne ÉTAT = l'étape exacte où en est la pièce */
const achPcStep = (t, x) => { if (!x) return "";
  if (x.del) return "SUPPRIMÉ";
  if (t === "frs" || t === "art" || t === "cli" || t === "prj") { const s = achPcSt(t, x); return { instance: "EN INSTANCE", valide: "VALIDÉ", bloque: "BLOQUÉ", archive: "ARCHIVÉ", expire: "ATTESTATION FISCALE EXPIRÉE" }[s] || ""; }
  if (achPcCirc(x)) return "EN COURS DE VALIDATION — " + achCircNext(x).map(achGradeLab).join(x.circ.h ? " PUIS " : " OU ");
  if (x.renv && x.renv.length && x.state === "instance" && !x.circ) return "RENVOYÉE PAR " + achGradeLab(x.renv[x.renv.length - 1].g);
  if (x.susp) return "SUSPENDUE"; if (x.litige) return "EN LITIGE";
  try {
    if (t === "bsn") return achBsnAvLab(x);
    if (t === "caf") { if (x.state === "ouverte" && achCafAllRep(x)) return "TOUS LES FOURNISSEURS ONT RÉPONDU — À CLÔTURER"; if (x.state === "ouverte" && !achCafSent(x) && x.val) return "VALIDÉE — À REMETTRE"; if (x.state === "ouverte" && achCafSent(x)) { const F = x.frs || [], n = F.filter(f => achDvf().some(v => v.caf === x.id && v.frs === f && v.state !== "annule")).length; return "REMISE — " + n + " / " + F.length + " DEVIS"; } return { ouverte: "EN RÉDACTION", close: "CLOSE", annule: "ANNULÉE" }[x.state] || ""; }
    if (t === "dvf") { const s = achPcSt(t, x); return x.state === "retenu" ? "RETENU" : x.state === "rejete" ? "REJETÉ" : x.state === "annule" ? "ANNULÉ" : s === "partiel" ? "CHIFFRÉ EN PARTIE" : s === "expire" ? "EXPIRÉ" : "REÇU"; }
    if (t === "cmf") { const s = achPcSt(t, x); if (x.state === "valide") return s === "partiel" ? "REÇUE EN PARTIE" : s === "remis" ? "REMISE AU FOURNISSEUR" : (x.lignes || []).length && (x.lignes || []).every(l => achResteQ(x, l) <= 1e-9) ? "REÇUE" : "VALIDÉE";
      return ACH_CMF_ST[x.state] || ""; }
    if (t === "rcp") return x.state === "annule" ? "ANNULÉE" : x.pv ? "PV DE SERVICE FAIT" : "RÉCEPTIONNÉE";
    if (t === "faf") return achFafEtat(x);
    if (t === "paf") return ACH_PAF_ST[x.state] || "";
  } catch (e) {}
  return { instance: "EN INSTANCE", valide: "VALIDÉ", annule: "ANNULÉ" }[x.state] || ""; };

/* ---------- PAGE d'un élément ----------
   p = { id, code, nom, title, st, why[], del, info(), menu: [{k, lab}], act(k), links: [{ t, cols:[lab…], rows:[{cells:[…], cls, open}] }] } */
/* v771 : hauteur des blocs de la page — 5 lignes par défaut, défilement au-delà, poignée en bas (hauteur mémorisée par bloc) */
/* v919 (remarque 5 du 04/11/2026) : libellés communs « SUPPRIMER CE … » — CE / CET (voyelle) / CETTE (noms féminins des achats) */
const achCe = n => { const u = String(n || "").toUpperCase(); return (/^(CONSULTATION|COMMANDE|RÉCEPTION|FACTURE|DEMANDE|PIÈCE|ÉVALUATION)/.test(u) ? "CETTE " : /^[AEIOUÉÈÊH]/.test(u) ? "CET " : "CE ") + u; };
/* B3 : état d'une pièce d'après le libellé de son état (colonne ÉTAT d'un bloc lié) */
const achStTxt = v => { const u = String(v || "").toUpperCase(); if (!u) return ""; if (/ANNUL|REJET/.test(u)) return "";
  if (/PARTIEL/.test(u)) return "partiel"; if (/FIG/.test(u)) return "fige"; if (/ÉMIS|REMIS/.test(u)) return "remis"; if (/INSTANCE|OUVERTE|RÉCLAM|ATTENTE/.test(u)) return "instance"; return "valide"; };
const achNvhKey = t => String(t).toLowerCase().replace(/[^a-z]+/g, "");
const ACH_NVH_K = "svi_ach_nvh_v1";
/* 11/11 (Ahmed, validé) : blocs de la consultation renommés — ARTICLES CONSULTÉS, FOURNISSEURS CONSULTÉS, DOCUMENTS ENVOYÉS ;
   les réglages gardés sous les anciens noms (hauteur, largeurs, colonnes masquées, ordre) sont recopiés une fois sous les nouveaux */
(() => { try { if (localStorage.getItem("svi_mig_cafblk_v1")) return; const M = [["dtailconsultation", "articlesconsults"], ["fournisseurs", "fournisseursconsults"], ["documents", "documentsenvoys"]];
  const J = k => { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch (e) { return {}; } }, S = (k, o) => { try { localStorage.setItem(k, JSON.stringify(o)); } catch (e) {} };
  const H = J(ACH_NVH_K); M.forEach(([a, b]) => { if (H[a] !== undefined && H[b] === undefined) H[b] = H[a]; }); S(ACH_NVH_K, H);
  ["svi_colw_v1", "svi_colh_v1", "svi_colorder_v1"].forEach(k => { const O = J(k); Object.keys(O).forEach(x => M.forEach(([a, b]) => { const pa = "achp_" + a, pb = "achp_" + b;
    if (x === pa || x.startsWith(pa + ".") || x === pa + "_i" || x === pa + "_v") { const y = pb + x.slice(pa.length); if (O[y] === undefined) O[y] = O[x]; } })); S(k, O); });
  localStorage.setItem("svi_mig_cafblk_v1", "1"); } catch (e) {} })();
/* 05/11 (document unique 4.3) : pendant la saisie, la DERNIÈRE ligne écrite se voit — après une création par la ligne CRÉER … ICI d'un bloc,
   son tableau descend jusqu'en bas dès qu'il est redessiné avec une ligne de plus (au repos, il montre la première) */
{ let pend = null;
  const keyOf = el => { const b = el.closest(".nvp-blk, .bdg-d-block"); const h = b && b.querySelector("[data-nvh]"); return h ? h.dataset.nvh : b && b.querySelector(".rec-scroll") ? "rec" : ""; };
  const rows = sc => sc.querySelectorAll("tbody tr:not(.rec-new):not(.bdg-newrow):not(.ach-new):not([data-nvnew]):not([data-nvradd])").length;
  document.addEventListener("click", e => { const r = e.target.closest && e.target.closest("tr.rec-new, tr.bdg-newrow, tr[data-nvnew], tr[data-nvradd], tr.ach-new"); if (!r || !r.closest(".nvp")) return;
    const k = keyOf(r), sc = r.closest(".rec-scroll"); if (!k || !sc) return; pend = { k, n: rows(sc), t: Date.now() }; }, true);
  new MutationObserver(() => { if (!pend) return; if (Date.now() - pend.t > 120000) { pend = null; return; }
    const pg = document.querySelector("#ach .nvp"); if (!pg) return; const h = pg.querySelector(`[data-nvh="${pend.k}"]`), b = h && h.closest(".nvp-blk, .bdg-d-block"), sc = b && b.querySelector(".rec-scroll");
    if (!sc || rows(sc) <= pend.n) return; if (!pend.ok) { pend.ok = Date.now(); const me = pend; setTimeout(() => { if (pend === me) pend = null; }, 1500); }
    const go = () => { if (sc.isConnected) sc.scrollTop = sc.scrollHeight; }; go(); requestAnimationFrame(go); setTimeout(go, 120); }).observe(document.documentElement, { childList: true, subtree: true });
}
/* 07/11 (document unique 4.3, vérification des gestes) : une hauteur réglée à la poignée est gardée telle quelle, même au-delà des lignes (vide dessous permis) */
const achNvhSet = k => { try { return !!(JSON.parse(localStorage.getItem(ACH_NVH_K) || "{}") || {})[k]; } catch (e) { return false; } };
const achNvhSc = k => achNvhSet(k) ? `height:var(--nvh-${k});max-height:none` : `max-height:var(--nvh-${k}, var(--svi-hdef-a, 200px))`;
const achNvhStyle = () => { let H = {}; try { H = JSON.parse(localStorage.getItem(ACH_NVH_K) || "{}") || {}; } catch (e) {} return Object.keys(H).map(k => "--nvh-" + k + ":" + H[k] + "px").join(";"); };
/* 08/11 (document unique 4.3, remarque d'Ahmed) : hauteur minimale d'un bloc = titres des colonnes + r lignes de DONNÉES + ligne CRÉER … ICI
   + ligne TOTAL — jamais un bloc réduit qui ne montre que le TOTAL */
function achNvhMin(sc, r) { const th = sc.querySelector("thead"), rows = [...sc.querySelectorAll("tbody tr, tfoot tr")];
  const isN = x => x.matches(".rec-new, .bdg-newrow, .ach-new, [data-nvnew], [data-nvradd]"), isT = x => x.matches(".bdg-d-total-row, tfoot tr") || /^\s*TOTAL/.test(x.textContent || "");
  const nr = rows.find(isN), tr = rows.find(isT), d1 = rows.find(x => !isN(x) && !isT(x)), h = x => x ? x.getBoundingClientRect().height : 0;
  return Math.ceil((th ? h(th) : 22) + r * (d1 ? h(d1) : 21) + h(nr) + h(tr)) + 4; }
/* 11/11 (Ahmed) : hauteur par défaut d'un bloc de fiche = titres + n lignes de données (PARAMÉTRAGE › BLOCS › LIGNES AFFICHÉES PAR DÉFAUT)
   + ligne CRÉER + ligne TOTAL, mesurée sur les vraies lignes (avant : formule fixe pour des lignes de 34 px, soit 8 à 9 lignes visibles) ; hauteur réglée à la main gardée */
function achNvhFloor() { let n = 5; try { n = sviBlkRows().n; } catch (e) {}
  document.querySelectorAll("#ach .nvp .rec-scroll").forEach(sc => { if (sc.style.maxHeight === "none") return; sc.style.maxHeight = achNvhMin(sc, n) + "px";
    const m = achNvhMin(sc, 1); if (sc.getBoundingClientRect().height < m - 1) sc.style.height = m + "px"; }); }
function achNvhDrag(e, h) {
  e.preventDefault(); const pg = h.closest(".nvp"), k = h.dataset.nvh, sc = h.parentNode.querySelector(".rec-scroll"); if (!pg || !sc) return;
  const y0 = e.clientY, b0 = sc.getBoundingClientRect().height; let v = b0; h.classList.add("on");
  /* 05/11 : hauteur d'un bloc — il grandit avec ses lignes jusqu'à 5 (vide : titres seuls) ; la poignée le règle ; jamais moins d'une ligne,
     deux s'il a sa ligne CRÉER … ICI (la ligne CRÉER et une ligne de données) */
  const minH = achNvhMin(sc, 1);
  const mv = ev => { ev.preventDefault(); v = Math.max(minH, Math.round(b0 + ev.clientY - y0)); pg.style.setProperty("--nvh-" + k, v + "px"); sc.style.height = "var(--nvh-" + k + ")"; sc.style.maxHeight = "none"; };
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
/* 11/11 (Ahmed, validé) : fiche d'une pièce — un bloc de pièces liées vide ne s'affiche pas, sauf s'il permet d'en créer une (ligne CRÉER) ou s'il porte les lignes (DÉTAIL) */
function achNvPageHTML(p, rec, ctx) {
  /* v1119 (L14) : rangée de titres de groupes au-dessus des colonnes (ex. nom du fournisseur sur PRIX UNITAIRE TTC et MONTANT TTC) — suit l'ordre des colonnes */
  const grpRow = (L, J, RD, AP) => { const out = []; J.forEach(j => { const g = L.grp[j] || "", last = out[out.length - 1]; if (last && last.g === g && g) last.n++; else out.push({ g, n: 1 }); });
    return `<tr class="nvp-grp">${RD ? "<th></th>" : ""}${out.map(o => `<th colspan="${o.n}" class="center">${esc(o.g)}</th>`).join("")}${AP ? "<th></th>" : ""}<th></th></tr>`; };
  const blk = L => { const k = achNvhKey(L.t), t = "achp_" + k, n = L.cols.length;
    /* B47 (05/11) : ordre des colonnes gardé (glisser un titre, moteur commun coOrder, comme le budget) */
    /* F3 (série F) : une case peut porter du HTML (champ de saisie, bouton) — { h: html, t: texte pour le tri et le filtre } */
    const tv = v => v && typeof v === "object" && v.h !== undefined ? v.t ?? "" : v;
    const C = coOrder(t, L.cols.map((c, j) => ["c" + j, c[0], r => tv(r.cells[j]), c[1] || ""])), J = C.map(c => +c[0].slice(1));
    /* F3 : RONDS à gauche (liaisons, règle 2.5) — r.rd = { k, st : "" | "lie" | "choisi" } */
    const RD = L.rows.some(r => r.rd);
    const R0 = L.rows.map((r, i) => ({ ...r, __i: i })), R = ctx && ctx.cfApply ? ctx.cfApply(t, C, R0) : R0;
    const head = C.map(c => ctx && ctx.cfHead ? ctx.cfHead(t, c[0], c[1], c[3]) : `<th class="${c[3]}">${esc(c[1])}</th>`).join("");
    /* v793 : largeur des colonnes réglable et gardée (moteur commun sviCwCols / data-svcw) */
    const CG = sviCwCols(t, (L.rows.some(r => r.rd) ? [["_rd", 28]] : []).concat(C.map((c, j) => [c[0], j === 0 ? 170 : /number/.test(c[3]) ? 110 : /center/.test(c[3]) ? 90 : 150])), (R0.some(achApOf) ? [["_ap", 30]] : []).concat([["_cb", 28]]));
    const AP = R0.some(achApOf);
    const iM = L.cols.findIndex(c => /^MONTANT/.test(c[0])), isL = (/^DÉTAIL (?!FACTURE STANDARD)/.test(L.t) || L.lines) && iM >= 0;   /* F11 : TOTAL des DÉTAILS (TOTAL PARTIEL si filtre) */
    /* B3 (série B, 04/11/2026) : toute la ligne d'une pièce liée prend la couleur de son état (rouge, vert, bleu, orange, noir) */
    const iE = L.cols.findIndex(c => /^ÉTAT|^RÉPONSE/.test(c[0])), stOf = r => r.st !== undefined ? r.st : iE < 0 ? "" : achStTxt(r.cells[iE]);
    const tot = isL ? R.reduce((s2, r) => s2 + (typeof tv(r.cells[iM]) === "number" ? tv(r.cells[iM]) : achN(tv(r.cells[iM])) || 0), 0) : 0;
    return `<div class="bdg-d-block nvp-blk" data-nvb="${k}"><div class="bdg-d-block-title blk-head"><span class="ttl">${esc(L.t)} ${(nt => svCnt(R.filter(nt).length, L.rows.filter(nt).length))(r => !/\bnvp-gt\b/.test(r.cls || ""))}</span>${achBlkTools(k)}</div>
      <div class="rec-scroll" style="${achNvhSc(k)}"><table class="bdg-d-table rec-table" data-colh="${esc(t)}" data-svcw="${esc(t)}" style="${CG.style}">${CG.cg}<thead>${L.grp ? grpRow(L, J, RD, AP) : ""}<tr>${RD ? `<th class="nvp-rdh">${L.rdh || ""}</th>` : ""}${head}${AP ? achApTh() : ""}<th class="center nvp-cbh" data-cokey="_cb"><input type="checkbox" class="nvp-all" aria-label="Tout cocher"></th></tr></thead>
      <tbody>${R.map(r => `<tr class="${r.cls || ""}${stOf(r) ? " nvr-" + stOf(r) : ""}" data-ri="${r.__i}">${RD ? `<td class="nvp-rdc">${r.rd ? `<button type="button" class="nvp-rd${r.rd.st ? " rd-" + r.rd.st : ""}" data-rd="${esc(r.rd.k)}" aria-label="Liaison"></button>` : ""}</td>` : ""}${J.map(j => { const v = r.cells[j], g = (r.go || []).find(z => z[0] === j); if (v && typeof v === "object" && v.h !== undefined) return `<td class="${L.cols[j][1] || ""}"${v.st ? ` style="${esc(v.st)}"` : ""}>${v.h}</td>`;   /* v1119 : style de case (dégradé du comparatif) */ return `<td class="${L.cols[j][1] || ""}">${j === 0 && r.open ? `<button type="button" class="ach-link" data-nvl="${esc(L.t)}|${r.__i}">${esc(v)}</button>` : g ? `<button type="button" class="ach-link" data-nvgo="${esc(g[1] + "|" + g[2])}">${esc(v)}</button>` : esc(typeof v === "number" ? achF2(v) : v)}</td>`; }).join("")}${AP ? achApTd(achApOf(r)) : ""}<td class="center"><input type="checkbox" class="nvp-cb"${r.ck ? " checked" : ""}></td></tr>`).join("")}${L.add ? `<tr class="rec-new" data-nvadd="${k}"><td colspan="${n + 1 + (RD ? 1 : 0) + (AP ? 1 : 0)}">${esc(L.add)}</td></tr>` : ""}</tbody>
      ${isL ? `<tfoot><tr class="bdg-d-total-row">${RD ? "<td></td>" : ""}${J.map((j, jj) => j === iM ? `<td class="number">${achF2(tot)}</td>` : jj === J.indexOf(iM) - 1 ? `<td class="number">${R.length < L.rows.length ? "TOTAL PARTIEL" : "TOTAL"}</td>` : "<td></td>").join("")}${AP ? "<td></td>" : ""}<td></td></tr></tfoot>` : ""}</table></div>
      <div class="blk-rsz nvp-rsz" data-nvh="${k}" title="Glisser pour changer la hauteur"></div></div>`; };
  /* 06/11 (décision) : un seul type de fiche, colorée selon l'état de la pièce (palette : en instance, remise, en cours de validation, en partie, validée…) */
  const pst = p.del ? "annule" : p.st || "valide", pcl = pst === "instance" ? "bdg-inst-instance" : pst === "valide" ? "nvp-valide" : pst === "fige" ? "bdg-inst-fige" : "bdg-inst-fige nvp-stc";
  return `<div class="nvp bdg-d-page ${pcl}" data-st="${esc(pst)}" style="${achNvhStyle()}${pcl.includes("nvp-stc") ? ";--inst:var(--st-" + pst + ");--inst-bg:#f6f7f9;--inst-hatch:#eef0f3" : ""}">
    <div class="bdg-d-sticky"><div class="novapp-list-titlebar">
      <button type="button" class="novapp-menu open-menu" aria-label="Menu">☰</button>
      <h1 class="bdg-d-h1 nvp-ref${p.del ? " nv-strike" : ""}">${esc(p.ref || p.code)}</h1>
      <span class="bdg-d-badge bdg-d-inf" data-nvp="info" role="button" title="Informations">i</span>
      <span class="bdg-d-badge ach-h" data-h="${esc(p.code)}" role="button" title="Historique">H</span>${sviPinBtn(p.ref || p.code)}
      ${sviHdrBar({ attr: "nvp", n: p.why.length, why: { undo: "RIEN À ANNULER SUR CETTE FICHE.", redo: "RIEN À RÉTABLIR SUR CETTE FICHE.", todo: p.why.length ? "" : "AUCUNE ALERTE." } })}
    </div>${p.lkBar ? `<div class="nvp-lkbar">${p.lkBar}</div>` : ""}</div>   <!-- v1126 (L6 – L8) : ✓ LIER / ✕ DÉLIER en haut à droite -->
    ${p.links.filter(L => (L.rows && L.rows.length) || L.add || L.lines || /^DÉTAIL/.test(L.t)).map(blk).join("")}
    ${rec.html(ctx)}
  </div>`;
}
/* module complet liste + page : cfg = { list: options de achNvList (sans page), pageOf(id) → p, back } */
/* v783 : APERÇU d'une pièce ou d'une fiche — l'éditeur MISE EN PAGE unique (sviMep) ; corps = LIGNES (sinon le premier bloc lié) */
/* v819 : mise en page des pièces (étape 6) — montant en lettres et mention à reporter sous les totaux, ICE / IF de la société en champ ;
   o.noPrice : BON SANS PRIX pour le chauffeur ou le magasin (C6.68) — prix, montants et totaux retirés */
/* B28 : champs cochés IMPRIMÉ SUR LA COMMANDE (réglages du champ), quelle que soit leur origine : fournisseur, commande, devis, besoin */
const achPrtAuto = P => { const C = achCmf().find(c => c.ref === (P.ref || P.code)); if (!C || typeof sviFlds !== "function") return [];
  const R = { cmf: C, frs: achFrs().find(f => f.id === C.frs), dvf: achDvf().find(v => v.id === C.dvf), bsn: achBsn().find(b => (C.lignes || []).some(l => l.bsn === b.id)) };
  return Object.entries(sviFlds()).filter(([, S]) => S.prt).map(([k, S]) => { const f = (String(k).match(/^c:([^|]*)\|/) || [])[1], rec = R[S.src]; const v = f && rec ? rec[f] : "";
    return [String(k).replace(/[^a-z0-9]/gi, "_"), S.lab || S.olab || f, v === undefined || v === null ? "" : String(v)]; }).filter(x => x[2] !== ""); };
function achMepOpen(cfg, P, rec, redraw, o) {
  o = o || {};
  const Lg0 = P.links.find(l => l.lines || /^DÉTAIL (?!FACTURE STANDARD)/.test(l.t)) || P.links[0] || { t: "", cols: [], rows: [] };
  /* v786 : l'aperçu suit les colonnes affichées à l'écran */
  const tb = document.querySelector(`#ach table[data-colh="achp_${achNvhKey(Lg0.t)}"]`), vis = tb ? sviColhVis(tb) : null, vf = a => vis ? a.filter((_, i) => vis.includes(i)) : a;
  let Lg = { ...Lg0, cols: vf(Lg0.cols), rows: Lg0.rows.map(r => ({ ...r, cells: vf(r.cells) })) };
  /* F10 (série F) : le prix standard, le PRIX ESTIMÉ et les montants estimés ou budgétés ne sont JAMAIS imprimés pour le fournisseur */
  { const keep = Lg.cols.map((c, i) => /PRIX ESTIMÉ|PRIX STANDARD|MONTANT ESTIMÉ|BUDGÉTÉ|BUDGET HT|SOURCE DU PRIX/.test(c[0]) ? -1 : i).filter(i => i >= 0); if (keep.length < Lg.cols.length) Lg = { ...Lg, cols: keep.map(i => Lg.cols[i]), rows: Lg.rows.map(r => ({ ...r, cells: keep.map(i => r.cells[i]) })) }; }
  if (o.noPrice) { const keep = Lg.cols.map((c, i) => /PU|PRIX|MONTANT|TVA/.test(c[0]) ? -1 : i).filter(i => i >= 0); Lg = { ...Lg, cols: keep.map(i => Lg.cols[i]), rows: Lg.rows.map(r => ({ ...r, cells: keep.map(i => r.cells[i]) })) }; }
  const K = cfg.list.k, pr = achPrm(), lettres = P.ttc && !o.noPrice ? "ARRÊTÉ(E) À LA SOMME DE : " + frMoney(P.ttc) + " TTC." : "";
  const mention = K === "cmf" ? "N° " + (P.ref || P.code) + " À REPORTER SUR LE BON DE LIVRAISON ET LA FACTURE." : K === "caf" ? "MERCI DE RAPPELER LA RÉFÉRENCE " + (P.ref || P.code) + " DANS VOTRE DEVIS." : "";
  /* B14 (série B) : mentions de la société cochées dans ACHATS › PARAMÈTRES (valeurs de PARAMÉTRAGE GÉNÉRAL › SOCIÉTÉ) */
  const SO = sviSoc(), soc = SVI_SOC_F.filter(([f]) => f !== "rs" && f !== "adr" && pr.ment[f] && SO[f]).map(([f, l]) => l + " : " + SO[f]).join(" — ");
  sviMep.open({ key: "ACH-" + String(cfg.list.k || "X").toUpperCase() + (o.noPrice ? "-SP" : ""), title: cfg.list.one + (o.noPrice ? " (SANS PRIX)" : ""), ref: P.ref || P.code, party: P.party || P.title, date: P.date || "", prelim: ["instance", "fige", "encours"].includes(P.st),
    cols: Lg.cols.map((c, i) => ["c" + i, c[0], c[1] || ""]), rows: Lg.rows.map(r => r.cells), tot: o.noPrice ? [] : P.tot || [], note: [lettres, mention, soc].filter(Boolean).join("\n"),
    auto: K === "cmf" ? achPrtAuto(P) : [],
    annex: K === "cmf" ? (() => { const C = achCmf().find(c => c.ref === (P.ref || P.code)), L = (C && Array.isArray(C.cla) ? C.cla : achClCopy(pr.clP)).filter(x => x.txt || x.v || x.t !== "autre");
      return { title: "CLAUSES PARTICULIÈRES", items: L.map(x => { const [a, b] = achClTxt(x).length === 2 ? achClTxt(x) : x.t === "autre" ? ["", achClTxt(x)[0] || ""] : [achClTxt(x)[0], ""]; return [a, b]; }) }; })() : null,
    fields: { ...Object.fromEntries((K === "cmf" ? achPrtAuto(P) : []).map(([id, l, v]) => ["a_" + id, l + " : " + v])), projet: P.projet || "", ttc: P.ttc && !o.noPrice ? achF2(P.ttc) + " MAD" : "", numFrs: P.numFrs || "", lettres, mention, soc },
    name: (P.ref || P.code) + " " + cfg.list.one, save: async (b, n) => { const r = await rec.savePdf(b, n); if (redraw) setTimeout(redraw, 0); return r; } });
}
/* 08/11 (série I, I3, document unique 3.1) : FERMER REVIENT PAS À PAS — chemin suivi d'une page à l'autre (liste › consultation › devis › fournisseur) ;
   FERMER ramène à la page d'avant, puis à celle d'avant… jusqu'à la liste ; le menu ≡ repart d'un chemin vide (aller ailleurs d'un coup) */
const ACH_PATH = [];
/* correction (compte rendu v1003) : le nom du tiers dans le bandeau du centre (#sviScreenTag, hors du corps de l'écran) ouvre sa fiche */
document.addEventListener("click", e => { const g = e.target.closest && e.target.closest("#sviScreenTag [data-nvgo]"); if (!g) return; e.preventDefault(); e.stopPropagation(); const [t, id] = g.dataset.nvgo.split("|"); achGo(t, id); }, true);
/* 10/11 (document unique 3.7, complément) : FERMER ramène EXACTEMENT à la position d'avant — liste ou fiche, défilement, ligne sélectionnée ; filtres et recherche restent ceux de la liste */
const achPosKey = (el, root) => { const c = String(el.className && el.className.baseVal === undefined ? el.className : "").trim().split(/\s+/)[0] || ""; const sel = el.tagName.toLowerCase() + (c ? "." + CSS.escape(c) : ""); return [sel, [...root.querySelectorAll(sel)].indexOf(el)]; };
function achPosSnap(v) { const S = { sc: [], win: [scrollX, scrollY], cell: null };
  v.querySelectorAll("*").forEach(el => { if (el.scrollTop > 0 || el.scrollLeft > 0) S.sc.push([...achPosKey(el, v), el.scrollLeft, el.scrollTop]); });
  const a = document.activeElement, l = achPosSnap.last, td = (a && v.contains(a) && a.closest("td")) || (l && l.isConnected && v.contains(l) && l.closest("td")), tr = td && td.closest("tr[data-id]");
  if (tr) S.cell = [tr.dataset.id, td.cellIndex]; return S; }
document.addEventListener("pointerdown", e => { achPosSnap.last = e.target; }, true); document.addEventListener("click", e => { achPosSnap.last = e.target; }, true);
function achPosRestore(v, S) { if (!v || !S) return; const go = () => {
    S.sc.forEach(([sel, i, l, t]) => { const el = v.querySelectorAll(sel)[i]; if (el) { el.scrollLeft = l; el.scrollTop = t; } });
    if (S.win) window.scrollTo(S.win[0], S.win[1]);
    if (S.cell) { const tr = [...v.querySelectorAll("tr[data-id]")].find(r => r.dataset.id === S.cell[0]), td = tr && tr.cells[S.cell[1]];
      if (td && document.activeElement !== td) { if (!td.hasAttribute("tabindex")) td.setAttribute("tabindex", "-1"); td.classList.add("svi-tdf"); try { td.focus({ preventScroll: true }); } catch (er) {} } } };
  requestAnimationFrame(() => requestAnimationFrame(go)); setTimeout(go, 220); }
const achPathBack = () => { const w = ACH_PATH.pop(); if (!w) return false; achPathBack.on = true;
  try { if (w.view) { const nb = document.querySelector(`#navMenu .nav-btn[data-view="${w.view}"]:not([data-ach])`); if (nb) nb.click(); return true; }
    const v = document.getElementById("ach"); if (v && !v.classList.contains("active-view")) { const nb = document.querySelector(`#navMenu .nav-btn[data-ach="${w.t}"]`); if (nb) nb.click(); }
    achGo(w.t, w.id); } finally { achPathBack.on = false; } achPosRestore(document.getElementById("ach"), w.snap); return true; };
/* 11/11 (Ahmed, document unique 3.1 modifié) : le menu ≡ NE VIDE PLUS le chemin — l'écran quitté par le menu y entre comme les autres ;
   seule la première interface ouverte (rien derrière) a son ✕ grisé. Un autre module (accueil, budgets…) entre aussi : le ✕ y ramène. */
document.addEventListener("click", e => { const nb = e.target.closest && e.target.closest("#navMenu .nav-btn"); if (!nb || achPathBack.on) return;
  const cv = document.querySelector(".view.active-view"), v = document.getElementById("ach"); if (!cv) return;
  if (cv === v && v.__achWhere) { const w = v.__achWhere(); if (!w || (nb.dataset.view === "ach" && nb.dataset.ach === w.t && !w.id)) return; try { w.snap = achPosSnap(v); } catch (er) {} ACH_PATH.push(w); return; }
  if ((nb.dataset.view === "ach" || nb.dataset.view === "home") && cv.id && cv.id !== nb.dataset.view) ACH_PATH.push({ view: cv.id }); }, true);
/* 11/11 (Ahmed, validé, 3.1) : l'ACCUEIL a son ✕ — même règle de retour ; grisé quand rien n'est derrière */
const ACH_HCLOSE_WHY = "ACCUEIL : RIEN À FERMER (MENU ☰ POUR CHANGER D'ÉCRAN).";
function achHomeCloseSync() { const b = document.getElementById("homeClose"); if (!b) return; const on = ACH_PATH.length > 0; b.classList.toggle("hdr-off", !on); b.title = on ? "Fermer" : ACH_HCLOSE_WHY; }
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("#homeClose"); if (!b) return; e.preventDefault(); e.stopPropagation();
  if (ACH_PATH.length) achPathBack(); else if (typeof svToast === "function") svToast(ACH_HCLOSE_WHY, 3000, b); setTimeout(achHomeCloseSync, 50); }, true);
document.addEventListener("click", e => { if (e.target.closest && e.target.closest("#navMenu .nav-btn")) setTimeout(achHomeCloseSync, 60); }, true);
setTimeout(achHomeCloseSync, 0);
/* 10/11 (Ahmed, document unique 3.1 complément) : le ✕ D'UNE LISTE suit le même chemin — arrivé depuis un autre écran, il y ramène (à sa position) ;
   ouverte depuis le menu ≡ (chemin vide), il reste grisé */
const ACH_LCLOSE_WHY = "LISTE : RIEN À FERMER (MENU ☰ POUR CHANGER D'ÉCRAN).";
function achListCloseSync() { const v = document.getElementById("ach"); if (!v) return; const on = ACH_PATH.length > 0;
  v.querySelectorAll('[data-nvl="close"]').forEach(b => { if (b.classList.contains("hdr-off") === !on) return; b.classList.toggle("hdr-off", !on);
    if (on) { b.removeAttribute("data-why"); b.title = "Fermer"; } else { b.dataset.why = ACH_LCLOSE_WHY; b.title = ACH_LCLOSE_WHY; } }); }
document.addEventListener("pointerdown", e => { if (e.target.closest && e.target.closest('#ach [data-nvl="close"]')) achListCloseSync(); }, true);
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest('#ach [data-nvl="close"]'); if (!b || !ACH_PATH.length) return;
  e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); achPathBack(); }, true);
/* v1119 (L19, série L) : ICÔNE D'APERÇU juste avant la case à cocher de chaque ligne (listes et blocs de pièces) — l'APERÇU de la pièce (MISE EN PAGE),
   sans ouvrir sa page. ACH_PREV[type] est posé par le module de la pièce (achNvMod) ; une ligne de bloc donne sa pièce par son lien (go de la 1re colonne) */
const ACH_PREV = {};
const ACH_AP_ON = k => !!ACH_PREV[k];
const ACH_AP_IC = '<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>';
const achApOf = r => { if (r.ap) return ACH_PREV[String(r.ap).split("|")[0]] ? r.ap : ""; const g = (r.go || []).find(z => z[0] === 0) || (r.go || [])[0]; return g && ACH_PREV[g[1]] ? g[1] + "|" + g[2] : ""; };
const achApTh = () => `<th class="center nv-aph" data-cokey="_ap" aria-label="Aperçu"><span class="col-rs" data-col="_ap"></span></th>`;
const ACH_PXH_IC = '<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 14.5h13M2.5 11l3.5-4 3 2.5 4.5-6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const achApTd = (k, pxh) => `<td class="center nv-apc">${pxh ? `<button type="button" class="nv-ap nv-pxh" data-pxh="${esc(pxh)}" title="Historique des prix" aria-label="Historique des prix">${ACH_PXH_IC}</button>` : ""}${k ? `<button type="button" class="nv-ap" data-ap="${esc(k)}" title="Aperçu" aria-label="Aperçu">${ACH_AP_IC}</button>` : ""}</td>`;
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest(".nv-pxh[data-pxh]"); if (!b) return; e.preventDefault(); e.stopPropagation(); achArtPxHist(b.dataset.pxh); }, true);
/* v1178 (C2.11) : HISTORIQUE DES PRIX d'un article — devis et commandes (hors annulés), par fournisseur et par date : tableau et graphique */
const achArtPxRows = a => { const k = achKey(a.des, a.u), out = [], d0 = x => String(x || "").slice(0, 10);
  achDvf().filter(v => v.state !== "annule").forEach(v => (v.lignes || []).forEach(l => { if (achKey(l.des, l.u) !== k || !(achN(l.pu) > 0)) return; out.push({ d: d0(v.date || v.cree), t: "DEVIS", ref: v.ref || "", frs: v.frs, px: achDvfPuNet(v, l), go: ["dvf", v.id] }); }));
  achCmf().filter(c => c.state !== "annule").forEach(c => (c.lignes || []).forEach(l => { if (achKey(l.des, l.u) !== k || !(achN(l.pu) > 0)) return; out.push({ d: d0(c.date || c.valide || c.cree), t: "COMMANDE", ref: c.ref || "", frs: c.frs, px: achN(l.pu) * (1 - achN(c.rem) / 100), go: ["cmf", c.id] }); }));
  return out.filter(r => r.d).sort((x, y) => y.d.localeCompare(x.d)); };
function achArtPxHist(id) { const a = achArts().find(x => x.id === id); if (!a) return; const R = achArtPxRows(a), FR = [...new Set(R.map(r => r.frs).filter(Boolean))], d = sviWinNew(); let f = "";
  const COL = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#4b5563"];
  const chart = L => { if (L.length < 1) return `<div class="bsn-note">AUCUN PRIX : NI DEVIS NI COMMANDE POUR CET ARTICLE.</div>`;
    const W = 640, H = 220, P = 44, ds = L.map(r => Date.parse(r.d)), x0 = Math.min(...ds), x1 = Math.max(...ds), std = achN(a.pref), ys = L.map(r => r.px).concat(std > 0 ? [std] : []), y0 = Math.min(...ys) * .95, y1 = Math.max(...ys) * 1.05 || 1;
    const X = t => P + (x1 > x0 ? (t - x0) / (x1 - x0) : .5) * (W - P - 10), Y = v => H - 24 - (y1 > y0 ? (v - y0) / (y1 - y0) : .5) * (H - 40);
    const ser = FR.filter(g => !f || g === f).map((g, i) => { const pts = L.filter(r => r.frs === g).slice().reverse(), c = COL[FR.indexOf(g) % COL.length];
      return `<polyline fill="none" stroke="${c}" stroke-width="2" points="${pts.map(r => X(Date.parse(r.d)).toFixed(1) + "," + Y(r.px).toFixed(1)).join(" ")}"/>${pts.map(r => `<circle cx="${X(Date.parse(r.d)).toFixed(1)}" cy="${Y(r.px).toFixed(1)}" r="3.5" fill="${c}"><title>${esc(achFrsNom(g) + " — " + achDFr(r.d) + " — " + achF2(r.px))}</title></circle>`).join("")}`; }).join("");
    return `<svg class="art-pxg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Graphique des prix"><line x1="${P}" y1="${H - 24}" x2="${W - 10}" y2="${H - 24}" stroke="currentColor" stroke-opacity=".3"/>
      ${std > 0 ? `<line x1="${P}" y1="${Y(std).toFixed(1)}" x2="${W - 10}" y2="${Y(std).toFixed(1)}" stroke="currentColor" stroke-dasharray="5 4" stroke-opacity=".6"/><text x="${W - 12}" y="${(Y(std) - 4).toFixed(1)}" text-anchor="end" font-size="10" fill="currentColor">STANDARD ${esc(achF2(std))}</text>` : ""}
      <text x="${P - 6}" y="${Y(y1 / 1.05).toFixed(1)}" text-anchor="end" font-size="10" fill="currentColor">${esc(achF2(y1 / 1.05))}</text><text x="${P - 6}" y="${Y(y0 / .95).toFixed(1)}" text-anchor="end" font-size="10" fill="currentColor">${esc(achF2(y0 / .95))}</text>
      <text x="${P}" y="${H - 8}" font-size="10" fill="currentColor">${esc(achDFr(new Date(x0).toISOString().slice(0, 10)))}</text><text x="${W - 10}" y="${H - 8}" text-anchor="end" font-size="10" fill="currentColor">${esc(achDFr(new Date(x1).toISOString().slice(0, 10)))}</text>${ser}</svg>
      <div class="art-pxl">${FR.filter(g => !f || g === f).map(g => `<span><i style="background:${COL[FR.indexOf(g) % COL.length]}"></i>${esc(achFrsNom(g))}</span>`).join("")}</div>`; };
  const draw = () => { const L = R.filter(r => !f || r.frs === f);
    d.innerHTML = sviWinCard({ cls: "frs-card art-pxcard", close: "data-x", title: "HISTORIQUE DES PRIX — " + esc(a.des + " (" + a.u + ")"),
      body: `<div class="frs-scroll"><label class="frs-f"><span>FOURNISSEUR</span><select class="ins-in art-pxf"><option value="">TOUS (${FR.length})</option>${FR.map(g => `<option value="${esc(g)}"${g === f ? " selected" : ""}>${esc(achFrsNom(g))}</option>`).join("")}</select></label>
        ${chart(L)}
        <table class="prm-table frs-sub art-pxt"><thead><tr><th>DATE</th><th>PIÈCE</th><th>RÉFÉRENCE</th><th>FOURNISSEUR</th><th class="number">PRIX HT</th></tr></thead><tbody>${L.map(r => `<tr><td>${esc(achDFr(r.d))}</td><td>${r.t}</td><td><button type="button" class="ach-link" data-pxgo="${esc(r.go.join("|"))}">${esc(r.ref)}</button></td><td>${esc(r.frs ? achFrsNom(r.frs) : "")}</td><td class="number">${esc(achF2(r.px))}</td></tr>`).join("") || `<tr><td colspan="5" class="ach-0">AUCUN PRIX</td></tr>`}</tbody></table></div>`,
      foot: `<button type="button" class="svc-b" data-x>FERMER</button>` });
  };
  draw(); sviWinShow(d);
  d.addEventListener("change", e => { if (e.target.closest(".art-pxf")) { f = e.target.value; draw(); } });
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; } const g = e.target.closest("[data-pxgo]"); if (g) { const [t, gid] = g.dataset.pxgo.split("|"); d.remove(); achGo(t, gid); } });
}
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest(".nv-ap[data-ap]"); if (!b) return; e.preventDefault(); e.stopPropagation();
  const [t, ...r] = b.dataset.ap.split("|"), f = ACH_PREV[t]; if (f) f(r.join("|")); }, true);
/* 07/11 : redessin de la page ouverte (gestes hors clic : glisser une ligne) */
let ACH_NV_REDRAW = null;
function achNvMod(ctx, cfg) {
  let pid = null, P = null, rec = null;
  /* 11/11 (compte rendu v1089 – v1101, série I3) : une fiche ouverte DEPUIS SA LISTE (ligne, création) revient à cette liste au FERMER — un seul cran,
     sans prendre l'écran d'avant la liste dans le chemin ; une fiche ouverte par un lien (achGo) suit le chemin */
  let viaList = false;
  /* v1130 (décision d'Ahmed, 11/11) : les ronds choisis d'une pièce sont libérés à chaque ouverture (moteur commun, clé « type:id ») */
  const open = id => { if (id && typeof SVI_LK === "object") delete SVI_LK[(cfg.list && cfg.list.k) + ":" + id]; if (typeof ACH_CAF_CK !== "undefined") ACH_CAF_CK = null;   /* v1133 : cases gardées au redessin, oubliées à l'ouverture */ pid = id; rec = null; viaList = !!id && !(typeof achGo === "function" && achGo.busy) && !(typeof achPathBack === "function" && achPathBack.on); ctx.draw(); };
  const LST = achNvList(ctx, { ...cfg.list, page: open });
  if (cfg.list && cfg.list.k) ACH_PREV[cfg.list.k] = id => { const Pp = cfg.pageOf(id); if (Pp) achMepOpen(cfg, Pp, achRecBlock(Pp.code), () => {}); };   /* v1119 (L19) */
  const html = () => {
    if (pid) { P = cfg.pageOf(pid); if (!P) pid = null; else ACH_NV_REDRAW = () => ctx.draw(); }
    if (!pid) return LST.html();
    if (!rec || rec.__c !== P.code) { rec = achRecBlock(P.code); rec.__c = P.code; }
    requestAnimationFrame(achNvhFloor);   /* 08/11 : une hauteur gardée trop petite remonte au minimum (une ligne de données visible) */
    /* v1147 (L3) : blocs libres de la fiche — disposition propre au type de pièce */
    requestAnimationFrame(() => requestAnimationFrame(() => { const pg = document.querySelector("#ach .nvp"); if (pg && typeof sviFreeMount === "function") sviFreeMount(pg, "nvp:" + (cfg.list && cfg.list.k || "x"), ".nvp-blk[data-nvb]", b => b.dataset.nvb); }));
    return achNvPageHTML(P, rec, ctx);
  };
  /* 11/11 (compte rendu v1089 – v1092, 2.10 / 3.6) : le nom du tiers est TOUJOURS un lien (souligné, couleur de son état) — seul, dans le titre ou à sa suite */
  const pLk = () => `<button type="button" class="ach-link nvp-party" data-nvgo="${esc(P.partyGo)}">${esc(P.party)}</button>`;
  const h1 = () => { if (!(pid && P)) return LST.h1(); const T = String(P.title || ""), N = String(P.party || "");
    if (cfg.list.k === "caf") return "DÉTAIL CONSULTATION";   /* v1122 (décision d'Ahmed) : la barre du haut d'une consultation = « DÉTAIL CONSULTATION » seul */
    if (!P.partyGo || !N) return esc(cfg.list.one) + " — " + esc(T);
    const i = T.indexOf(N); return esc(cfg.list.one) + " — " + (i >= 0 ? esc(T.slice(0, i)) + pLk() + esc(T.slice(i + N.length)) : (T && T !== P.ref ? esc(T) + " — " : "") + pLk()); };
  const click = async e => {
    if (!pid) return LST.click(e);
    if (await rec.click(e, () => ctx.draw())) return true;
    if (P && P.click && await P.click(e, () => ctx.draw())) return true;   /* F3 : gestes propres à la page (ronds, boutons des blocs) */
    const b = e.target.closest("[data-nvp]");
    if (b) { const k = b.dataset.nvp, ord = LST.order(), i = ord.indexOf(pid);
      if (k === "close") { if (!viaList && achPathBack()) return true; viaList = false; pid = null; ctx.draw(); return true; }   /* série I (I3) : FERMER revient d'un cran */
      if (k === "prev" || k === "next") { const j = i + (k === "next" ? 1 : -1); if (i < 0 || j < 0 || j >= ord.length) { svToast(k === "next" ? "DERNIER DE LA LISTE." : "PREMIER DE LA LISTE.", 2000, b); return true; } open(ord[j]); return true; }
      if (k === "info") { P.info(() => ctx.draw()); return true; }
      if (b.classList.contains("hdr-off")) { svToast(b.dataset.why || "", 3000, b); return true; }
      if (k === "todo") { svToast("⚠ " + P.why.join(" · "), 5000, b); return true; }
      /* v774 : ⋯ principal commun — VALIDER en tête ; actions ; CORBEILLE / RESTAURER et FERMER en bas, séparés par un trait */
      /* v920 (remarques 1 et 2 du 04/11/2026) : même ordre que le ⋯ du budget — FIGER / VALIDER ; actions ; DISPOSITION PAR DÉFAUT ; SUPPRIMER (ou ANNULER / RESTAURER) et FERMER ; une icône par ligne */
      if (k === "more") { const M = P.menu.concat([{ k: "__apr", lab: "APERÇU" }]).concat(cfg.list.k === "cmf" || cfg.list.k === "rcp" ? [{ k: "__aprsp", lab: "BON SANS PRIX (CHAUFFEUR, MAGASIN)" }] : []), top = M.filter(m => m.k === "val" || m.k === "fige" || m.k === "defige"), bot = M.filter(m => m.k === "del" || m.k === "rest").map(m => ({ ...m, del: m.k === "del" })), mid = M.filter(m => !top.includes(m) && !["del", "rest"].includes(m.k));
        sviHdrMenu(b, [top, mid, [{ k: "__fmt", lab: "MODIFIER LE FORMAT" }, { k: "__lay", lab: "DISPOSITION PAR DÉFAUT" }], [...bot, { k: "__close", lab: "FERMER" }]], async a => { if (a === "__close") { if (!viaList && achPathBack()) return; viaList = false; pid = null; ctx.draw(); return; }
          if (a === "__fmt") { sviFmtCurWin(); return; }   /* v927 (remarque 12) */
          if (a === "__lay") { if (!(await sviLayAsk())) return; const pg = b.closest(".nvp") || document.querySelector("#ach .nvp"); sviLayReset(pg); if (typeof sviFreeClear === "function") sviFreeClear("nvp:" + (cfg.list && cfg.list.k || "x"));   /* v1147 (L3) */
            try { localStorage.removeItem(ACH_NVH_K); } catch (e) {} if (pg) { pg.querySelectorAll(".nvp-max").forEach(x => x.classList.remove("nvp-max")); pg.removeAttribute("style"); } ctx.draw(); return; } if (a === "__apr") { achMepOpen(cfg, P, rec, () => ctx.draw()); return; } if (a === "__aprsp") { achMepOpen(cfg, P, rec, () => ctx.draw(), { noPrice: true }); return; } await P.act(a, () => ctx.draw(), id => open(id)); }); return true; }
    }
    /* v776 : AGRANDIR / RÉDUIRE un bloc de la page ; ⋯ du bloc (EXPORTER, APERÇU ; SUIVI : CRÉER) */
    const mx = e.target.closest("[data-nvmax]"); if (mx) { const bl = mx.closest(".nvp-blk"); const on = !bl.classList.contains("nvp-max"); bl.classList.toggle("nvp-max", on); mx.classList.toggle("on", on); return true; }
    const mo = e.target.closest("[data-nvmore]"); if (mo) { const k = mo.dataset.nvmore, bl = mo.closest(".nvp-blk"), L = P.links.find(x => achNvhKey(x.t) === k);
      const tsv = () => { const t = bl.querySelector("table"); return [...t.rows].filter(r => !r.classList.contains("rec-new")).map(r => [...r.cells].filter(c => !c.classList.contains("svi-colh")).map(c => c.textContent.trim()).join("\t")).join("\n"); };
      const bt = bl.querySelector("table"), vis = sviColhVis(bt), vf = a => a.filter((_, i) => vis.includes(i));
      sviHdrMenu(mo, [[{ k: "max", lab: bl.classList.contains("nvp-max") ? "RÉDUIRE" : "AGRANDIR" }, { k: "hdef", lab: sviBlkRows().n + " LIGNES (PAR DÉFAUT)" }, { k: "hred", lab: "MODE RÉDUIT (" + sviBlkRows().r + " LIGNE" + (sviBlkRows().r > 1 ? "S" : "") + ")" }].concat(k === "rec" ? [{ k: "add", lab: "CRÉER" }] : []).concat(L && L.menu ? L.menu.filter(m => !m.del) : []), sviColhItems(bt), [{ k: "exp", lab: "EXPORTER" }, { k: "apr", lab: "APERÇU" }], L && L.menu ? L.menu.filter(m => m.del) : []].filter(g => g.length), async a => {   /* 11/11 : SUPPRIMER … en bas du ⋯ */
        if (sviColhPick(a, bt)) return;
        if (a === "max") { bl.querySelector("[data-nvmax]")?.click(); return; }
        /* F2, F3 : actions propres au bloc (lignes cochées passées) */
        if (L && L.act && (L.menu || []).some(m => m.k === a)) { const ck = [...bl.querySelectorAll("tbody tr[data-ri]")].filter(tr => tr.querySelector(".nvp-cb:checked")).map(tr => +tr.dataset.ri); await L.act(a, ck, () => ctx.draw()); return; }
        /* B4 (série B) : hauteur commune des blocs — lignes par défaut ou mode réduit (réglages communs), gardée par bloc */
        if (a === "hdef" || a === "hred") { const pg = bl.closest(".nvp"); let H = {}; try { H = JSON.parse(localStorage.getItem(ACH_NVH_K) || "{}") || {}; } catch (e) {}
          if (a === "hdef") { delete H[k]; pg && pg.style.removeProperty("--nvh-" + k); }
          else { const sc = bl.querySelector(".rec-scroll"), v = sc ? achNvhMin(sc, sviBlkRows().r) : 60;
            H[k] = v; pg && pg.style.setProperty("--nvh-" + k, v + "px"); }
          try { localStorage.setItem(ACH_NVH_K, JSON.stringify(H)); } catch (e) {} return; }
        if (a === "add") { if (await rec.click({ target: bl.querySelector("[data-nvradd]") }, () => ctx.draw())) return; }
        const ttl = (P.ref || P.code) + " — " + (L ? L.t : "SUIVI");
        if (a === "exp") { const b = new Blob(["\ufeff" + tsv().split("\n").map(l => l.split("\t").map(v => /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
          const u = URL.createObjectURL(b), an = document.createElement("a"); an.href = u; an.download = ttl.replace(/[\\/:*?"<>|]/g, "-") + ".csv"; document.body.appendChild(an); an.click(); setTimeout(() => { URL.revokeObjectURL(u); an.remove(); }, 1000); }
        if (a === "apr") { const Lb = L || { t: "SUIVI", cols: [...bl.querySelectorAll("thead th")].map(th => [th.textContent.trim(), ""]), rows: [...bl.querySelectorAll("tbody tr:not(.rec-new)")].map(tr => ({ cells: [...tr.cells].map(c => c.textContent.trim()) })) };   /* v783 : l'aperçu unique (MISE EN PAGE) */
          sviMep.open({ key: "ACH-BLOC-" + achNvhKey(Lb.t).toUpperCase(), title: Lb.t, ref: P.ref || P.code, party: P.party || P.title, prelim: ["instance", "fige", "encours"].includes(P.st), cols: vf(Lb.cols).map((c, i) => ["c" + i, c[0], c[1] || ""]), rows: Lb.rows.map(r => vf(r.cells)), name: ttl, save: (b, n) => rec.savePdf(b, n) }); } });
      return true; }
    const na = e.target.closest("[data-nvadd]"); if (na) { const L = P.links.find(x => achNvhKey(x.t) === na.dataset.nvadd); if (L && L.addFn) L.addFn(() => ctx.draw()); else P.info(() => ctx.draw()); return true; }   /* v780 : ligne CRÉER … ICI */
    const gg = e.target.closest("[data-nvgo]"); if (gg) { const [t, gid] = gg.dataset.nvgo.split("|"); achGo(t, gid); return true; }   /* v800 (3.6 – 3.7) : un nom ouvre sa page */
    const l = e.target.closest("[data-nvl]"); if (l) { const [t, i] = l.dataset.nvl.split("|"), L = P.links.find(x => x.t === t), r = L && L.rows[+i]; if (r && r.open) r.open(() => ctx.draw()); return true; }
    return false;
  };
  const change = e => { if (!pid) return false; if (P && P.change && P.change(e, () => ctx.draw())) return true; return rec ? rec.change(e) : false; };
  return { html, click, change, h1, open, close: () => { pid = null; }, isPage: () => !!pid, cur: () => pid };
}

/* ---------- ARTICLES ---------- */
/* fenêtre des informations d'un article (création si id = null : l'article naît EN INSTANCE) */
function achArtFiche(id, done) {
  const a0 = id ? achArts().find(x => x.id === id) : null; if (id && !a0) return;
  const A = a0 ? JSON.parse(JSON.stringify(a0)) : { des: "", u: "", cat: "", stk: false, tva: achPrm().tva, pref: 0, pmax: 0, actif: true, cpt: "", cptI: "" };
  const ro = !!(a0 && a0.del), dis = ro ? " readonly" : "", d = sviWinNew(), P = achPrm();
  const inp = (k, lab, o = {}) => `<label class="frs-f${o.w ? " frs-w" : ""}"><span>${lab}${o.req ? " <b>*</b>" : ""}</span><input class="ins-in art-x${o.num ? " number" : ""}" data-k="${k}" value="${esc(o.num ? (achN(A[k]) || k === "tva" ? achF2(A[k]) : "") : A[k] ?? "")}"${o.num ? ' inputmode="decimal"' : ""}${o.list ? ` list="artL-${k}"` : ""}${dis} autocomplete="off">${o.list ? `<datalist id="artL-${k}">${o.list.map(x => `<option value="${esc(x)}">`).join("")}</datalist>` : ""}</label>`;
  const units = (() => { try { return (typeof sviUnits === "function" ? sviUnits() : []).map(u => u.a || u).filter(Boolean); } catch (e) { return []; } })();
  d.innerHTML = sviWinCard({ st: a0 ? achPcSt("art", a0) : "instance", cls: "frs-card", close: "data-x", title: a0 ? esc(a0.des + " (" + a0.u + ") : " + achRefSvi(a0, achArts(), "ARA")) : "NOUVEL ARTICLE",
    body: `<div class="frs-scroll art-scroll" data-at="inf">${a0 ? `<div class="rec-tabs frs-tabs"><button type="button" class="rec-tab active on" data-atab="inf">INFORMATIONS</button><button type="button" class="rec-tab" data-atab="frs">FOURNISSEURS</button></div>` : ""}<div class="frs-g">${inp("des", "DÉSIGNATION", { req: 1, w: 1 })}${inp("u", "UNITÉ", { req: 1, list: units })}${inp("ua", "UNITÉ D'ACHAT PAR DÉFAUT", { list: units })}${inp("cat", "FAMILLE", { req: 1, list: P.cat })}${inp("sfam", "SOUS-FAMILLE", { list: sviPgL("sfam").filter(x => !A.cat || achU(x.fam) === achU(A.cat)).map(x => x.lab) })}
      ${inp("nat", "TYPE (NATURE)", { list: sviPgL("atypes").map(x => x.lab) })}${inp("cons", "DURÉE DE CONSERVATION (JOURS)", { num: 1 })}${inp("fab", "FABRICANTS (POUR INFORMATION)", { w: 1 })}
      ${inp("poids", "POIDS UNITAIRE (KG)", { num: 1 })}${inp("vol", "VOLUME UNITAIRE (M³)", { num: 1 })}${inp("cb", "CODE-BARRES")}${inp("qmin", "QUANTITÉ MINIMALE DE COMMANDE", { num: 1 })}<label class="frs-f frs-w art-conso"><span>CONSOMMATION MOYENNE (12 MOIS)</span><input class="ins-in no-fw" data-fam="long" style="width:100%" value="${a0 ? esc(achArtConso(a0)) : "—"}" readonly></label>
      ${inp("pref", "PRIX DE RÉFÉRENCE HT", { num: 1 })}${inp("pmax", "PLAFOND HT", { num: 1 })}${inp("partMax", "PART MAXIMUM D'UN FOURNISSEUR (%)", { num: 1 })}${inp("tva", "TVA %", { num: 1 })}
      ${inp("cpt", "CODE COMPTABLE")}${inp("cptI", "INTITULÉ COMPTABLE")}
      <div class="frs-f frs-w frs-logo art-photo"><span>PHOTO</span><div>${A.photo ? `<img src="${esc(A.photo)}" alt="">` : ""}${ro ? "" : `<input type="file" accept="image/*" class="art-photo-in">${A.photo ? ` <button type="button" class="ach-b" data-photorm>RETIRER LA PHOTO</button>` : ""}`}</div></div>
      <div class="frs-f frs-w art-frh"><span>FOURNISSEURS HABITUELS (PAR ORDRE DE PRÉFÉRENCE)</span><div class="art-frh-box"></div></div>
      <div class="frs-f frs-w art-pstd"><span>PRIX STANDARD PAR PROJET OU PAR ZONE (SINON LE PRIX DE RÉFÉRENCE)</span><div class="art-pstd-box"></div></div>
      <div class="frs-f frs-w art-eqv"><span>ARTICLES ÉQUIVALENTS (PAR ORDRE DE PRÉFÉRENCE)</span><div class="art-eqv-box"></div></div>
      <div class="frs-f frs-w"><span>FICHE TECHNIQUE</span><div>${A.ft ? `<button type="button" class="ach-b" data-ftsee>VOIR LA FICHE TECHNIQUE</button> ` : ""}${ro ? "" : `<input type="file" class="art-ft-in" accept="image/*,application/pdf">`}</div></div>
      ${a0 ? (() => { const R = achRep(achKey(a0.des, a0.u)), FR = achFrsRO(), nm = g => { const L = FR.filter(f => achFrsRoot(f.id) === g); return L.map(f => f.nom).join(" + ") || g; };
        return `<div class="frs-f frs-w art-frs"><span>FOURNISSEURS (12 DERNIERS MOIS) ${svCnt(R.n)}${R.n < R.need ? ` <b class="art-bang" title="MOINS DE ${R.need} FOURNISSEURS">!</b>` : ""} — PART CIBLE ${Math.round(R.cible)} % ± ${R.marge}</span>
          <table class="prm-table frs-sub art-frst"><thead><tr><th>FOURNISSEUR</th><th class="number">ACHETÉ (HT)</th><th class="number">PART</th></tr></thead><tbody>${R.rows.map(r => `<tr${R.n > 1 && Math.abs(r.pct - R.cible) > R.marge ? ' class="nv-alert"' : ""}><td>${esc(nm(r.g))}</td><td class="number">${esc(achF2(r.mt))}</td><td class="number">${Math.round(r.pct)} %</td></tr>`).join("") || `<tr><td colspan="3" class="empty">AUCUN ACHAT SUR 12 MOIS</td></tr>`}</tbody></table></div>`; })() : ""}
      <div class="frs-cs"><label class="frs-c"><input type="checkbox" class="art-c" data-k="stk"${A.stk ? " checked" : ""}${ro ? " disabled" : ""}> STOCKABLE</label><label class="frs-c"><input type="checkbox" class="art-c" data-k="per"${A.per ? " checked" : ""}${ro ? " disabled" : ""}> PÉRISSABLE</label><label class="frs-c"><input type="checkbox" class="art-c" data-k="actif"${A.actif !== false ? " checked" : ""}${ro ? " disabled" : ""}> ACTIF</label></div></div></div>`,
    foot: `<button type="button" class="svc-b" data-x>ANNULER</button>${ro ? "" : `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button>`}` });
  sviWinShow(d);
  /* v1172 (C2.6) : articles équivalents classés par ordre de préférence (▲ ▼ pour l'ordre ; « — » retire) */
  A.eqv = Array.isArray(A.eqv) ? A.eqv.slice() : [];
  const eqvDraw = () => { const box = d.querySelector(".art-eqv-box"); if (!box) return; const AL = achLive(achArts()).filter(x => x.id !== (a0 && a0.id));
    const opt = v => `<option value="">—</option>${AL.map(x => `<option value="${esc(x.id)}"${x.id === v ? " selected" : ""}>${esc(x.des + " (" + x.u + ")")}</option>`).join("")}`;
    box.innerHTML = `<table class="prm-table frs-sub art-eqvt"><thead><tr><th class="center">RANG</th><th>ARTICLE</th><th class="center">ORDRE</th></tr></thead><tbody>${A.eqv.map((id, i) => `<tr data-i="${i}"><td class="center">${i + 1}</td><td><select class="ins-in art-eqs" data-i="${i}"${ro ? " disabled" : ""}>${opt(id)}</select></td><td class="center">${ro ? "" : `<button type="button" class="ach-b" data-equp="${i}"${i ? "" : " disabled"}>▲</button> <button type="button" class="ach-b" data-eqdn="${i}"${i < A.eqv.length - 1 ? "" : " disabled"}>▼</button>`}</td></tr>`).join("")}
      ${ro ? "" : `<tr class="rec-new"><td></td><td><select class="ins-in art-eqs" data-i="new">${opt("")}</select></td><td></td></tr>`}</tbody></table>`; };
  eqvDraw();
  /* v1175 (C2.9) : prix standard propres à un projet ou à une zone */
  A.pstd = Array.isArray(A.pstd) ? A.pstd.map(x => ({ ...x })) : [];
  const pstdDraw = () => { const box = d.querySelector(".art-pstd-box"); if (!box) return; let PJ = []; try { PJ = achPrj().filter(p => !p.del); } catch (e) {}
    const O = [...PJ.map(p => ["prj:" + achU(p.code || p.intitule), "PROJET " + (p.code ? achU(p.code) + (p.intitule ? " — " + achU(p.intitule) : "") : achU(p.intitule || ""))]), ...sviPgL("zones").filter(z => z.lab).map(z => ["zone:" + achU(z.lab), "ZONE " + achU(z.lab)])];
    const opt = v => `<option value="">—</option>${O.concat(v && !O.some(o => o[0] === v) ? [[v, v]] : []).map(o => `<option value="${esc(o[0])}"${o[0] === v ? " selected" : ""}>${esc(o[1])}</option>`).join("")}`;
    box.innerHTML = `<table class="prm-table frs-sub art-pstdt"><thead><tr><th>PROJET OU ZONE</th><th class="number">PRIX STANDARD HT</th></tr></thead><tbody>${A.pstd.map((x, i) => `<tr data-i="${i}"><td><select class="ins-in art-psk" data-i="${i}"${ro ? " disabled" : ""}>${opt(x.k)}</select></td><td><input class="ins-in number art-psp" data-i="${i}" inputmode="decimal" value="${esc(x.px ? achF2(x.px) : "")}"${ro ? " readonly" : ""} autocomplete="off"></td></tr>`).join("")}
      ${ro ? "" : `<tr class="rec-new"><td><select class="ins-in art-psk" data-i="new">${opt("")}</select></td><td></td></tr>`}</tbody></table>`; };
  pstdDraw();
  /* v1180 (C2.12) : fournisseurs habituels classés ; ceux qui ont vendu l'article ces 12 mois sont PROPOSÉS (un toucher les ajoute) */
  A.frsH = Array.isArray(A.frsH) ? A.frsH.slice() : [];
  const frhDraw = () => { const box = d.querySelector(".art-frh-box"); if (!box) return; const FL = achLive(achFrs()).filter(f => f.actif !== false || A.frsH.includes(f.id));
    const opt = v => `<option value="">—</option>${FL.map(f => `<option value="${esc(f.id)}"${f.id === v ? " selected" : ""}>${esc((f.code ? f.code + " — " : "") + f.nom)}</option>`).join("")}`;
    let sug = []; try { sug = a0 ? achRep(achKey(a0.des, a0.u)).rows.map(r => r.g).filter(g => g && !A.frsH.includes(g) && FL.some(f => f.id === g)) : []; } catch (e) {}
    box.innerHTML = `<table class="prm-table frs-sub art-eqvt"><thead><tr><th class="center">RANG</th><th>FOURNISSEUR</th><th class="center">ORDRE</th></tr></thead><tbody>${A.frsH.map((id, i) => `<tr><td class="center">${i + 1}</td><td><select class="ins-in art-frs" data-i="${i}"${ro ? " disabled" : ""}>${opt(id)}</select></td><td class="center">${ro ? "" : `<button type="button" class="ach-b" data-frup="${i}"${i ? "" : " disabled"}>▲</button> <button type="button" class="ach-b" data-frdn="${i}"${i < A.frsH.length - 1 ? "" : " disabled"}>▼</button>`}</td></tr>`).join("")}
      ${ro ? "" : `<tr class="rec-new"><td></td><td><select class="ins-in art-frs" data-i="new">${opt("")}</select></td><td></td></tr>`}</tbody></table>
      ${!ro && sug.length ? `<div class="bsn-note">PROPOSÉS (ACHETÉS CES 12 MOIS) : ${sug.map(g => `<button type="button" class="ach-link" data-frsug="${esc(g)}">${esc(achFrsNom(g))}</button>`).join(" · ")}</div>` : ""}`; };
  frhDraw();
  d.addEventListener("change", e => { const s2 = e.target.closest(".art-frs"); if (!s2) return; const v = s2.value, i = s2.dataset.i;
    if (i === "new") { if (v && !A.frsH.includes(v)) A.frsH.push(v); } else if (!v) A.frsH.splice(+i, 1); else if (!A.frsH.includes(v)) A.frsH[+i] = v; frhDraw(); });
  d.addEventListener("click", e => { const sg = e.target.closest("[data-frsug]"); if (sg) { if (!A.frsH.includes(sg.dataset.frsug)) A.frsH.push(sg.dataset.frsug); frhDraw(); return; }
    const u = e.target.closest("[data-frup], [data-frdn]"); if (!u) return; const i = +(u.dataset.frup ?? u.dataset.frdn), j = u.dataset.frup !== undefined ? i - 1 : i + 1;
    if (j < 0 || j >= A.frsH.length) return; [A.frsH[i], A.frsH[j]] = [A.frsH[j], A.frsH[i]]; frhDraw(); });
  d.addEventListener("change", e => { const k = e.target.closest(".art-psk"), p2 = e.target.closest(".art-psp"); if (!k && !p2) return;
    if (k) { const i = k.dataset.i, v = k.value; if (i === "new") { if (v && !A.pstd.some(x => x.k === v)) A.pstd.push({ k: v, px: 0 }); } else if (!v) A.pstd.splice(+i, 1); else if (!A.pstd.some((x, j) => x.k === v && j !== +i)) A.pstd[+i].k = v; else svToast("DÉJÀ DANS LA LISTE.", 2500, k); pstdDraw(); return; }
    const x = A.pstd[+p2.dataset.i]; if (x) { const n = achN(p2.value); if (n < 0) { svToast("PRIX NON VALIDE.", 2500, p2); pstdDraw(); return; } x.px = n; } });
  d.addEventListener("change", e => { const s2 = e.target.closest(".art-eqs"); if (!s2) return; const v = s2.value, i = s2.dataset.i;
    if (i === "new") { if (v && !A.eqv.includes(v)) A.eqv.push(v); } else if (!v) A.eqv.splice(+i, 1); else if (!A.eqv.includes(v)) A.eqv[+i] = v; eqvDraw(); });
  d.addEventListener("click", e => { const u = e.target.closest("[data-equp], [data-eqdn]"); if (!u) return; const i = +(u.dataset.equp ?? u.dataset.eqdn), j = u.dataset.equp !== undefined ? i - 1 : i + 1;
    if (j < 0 || j >= A.eqv.length) return; [A.eqv[i], A.eqv[j]] = [A.eqv[j], A.eqv[i]]; eqvDraw(); });
  d.addEventListener("click", e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (done) done(null); return; }
    const at = e.target.closest("[data-atab]"); if (at) { d.querySelector(".art-scroll").dataset.at = at.dataset.atab; d.querySelectorAll("[data-atab]").forEach(b => b.classList.toggle("active", b === at) || b.classList.toggle("on", b === at)); d.querySelectorAll("[data-atab]").forEach(b => b.classList.toggle("on", b === at)); return; }
    if (!e.target.closest("[data-save]")) return;
    d.querySelectorAll(".art-x").forEach(i => { const k = i.dataset.k; A[k] = ["tva", "pref", "pmax", "partMax", "cons", "poids", "vol", "qmin"].includes(k) ? achN(i.value) : k === "fab" ? achU(i.value) : achU(i.value); });
    d.querySelectorAll(".art-c").forEach(i => { A[i.dataset.k] = i.checked; });
    const L = achArts();
    if (!A.des || !A.u) { svToast("DÉSIGNATION ET UNITÉ OBLIGATOIRES.", 3000); return; }
    if (/^DIVERS\b/.test(A.des)) { svToast("PAS D'ARTICLE « DIVERS » : DONNER UNE DÉSIGNATION PRÉCISE.", 4000); return; }
    if (!A.cat) { svToast("FAMILLE OBLIGATOIRE.", 3000); return; }
    if (!P.cat.includes(A.cat)) { svToast("FAMILLE INCONNUE : LA CRÉER D'ABORD DANS PARAMÉTRAGE › ARTICLES › FAMILLES.", 3500); return; }
    if (A.tva < 0 || A.tva > 100) { svToast("TVA NON VALIDE (0 À 100).", 3000); return; }
    /* v1169 (C2.1, C2.4, C2.8) : nature, sous-famille, pas d'article « divers » */
    if (A.sfam && !sviPgL("sfam").some(x => achU(x.lab) === A.sfam && achU(x.fam) === A.cat)) { svToast("SOUS-FAMILLE INCONNUE POUR LA FAMILLE " + A.cat + " : LA CRÉER D'ABORD DANS PARAMÉTRAGE › ARTICLES › SOUS-FAMILLES.", 4500); return; }
    if (A.nat && !sviPgL("atypes").some(x => achU(x.lab) === A.nat)) { svToast("TYPE INCONNU : CHOISIR DANS LA LISTE (PARAMÉTRAGE › ARTICLES › TYPES D'ARTICLE).", 4000); return; }
    /* v1172 (C2.7) : unité d'achat ≠ unité de l'article → une conversion doit exister (article ou PARAMÉTRAGE › ARTICLES › CONVERSIONS, dans les deux sens) */
    if (A.ua && A.ua !== A.u && sviUnitConv(1, A.ua, A.u, A.cv || (a0 && a0.cv), A.u) === null) { svToast("CONVERSION MANQUANTE ENTRE " + A.ua + " ET " + A.u + " : L'AJOUTER DANS PARAMÉTRAGE › ARTICLES › CONVERSIONS (OU ⋯ › UNITÉ DE CONVERSION DE L'ARTICLE).", 5000); return; }
    if (A.ua === A.u) A.ua = "";
    A.pstd = (A.pstd || []).filter(x => x.k && achN(x.px) > 0);   /* v1175 : ligne sans prix non gardée */
    if (A.per && !(A.cons > 0)) { svToast("ARTICLE PÉRISSABLE : DURÉE DE CONSERVATION OBLIGATOIRE (JOURS).", 3500); return; }
    if (!A.per) A.cons = 0;
    if (A.qmin < 0) { svToast("QUANTITÉ MINIMALE : NOMBRE POSITIF.", 3000); return; }
    if (A.poids < 0 || A.vol < 0 || A.cons < 0) { svToast("POIDS, VOLUME ET DURÉE : NOMBRES POSITIFS.", 3000); return; }
    if (A.cb) { const x = L.find(y => y.id !== (a0 ? a0.id : "") && !y.del && achU(y.cb || "") === A.cb); if (x) { svToast("CODE-BARRES DÉJÀ DONNÉ À " + x.code + " — " + x.des + ".", 4000); return; } }
    if (A.pmax > 0 && A.pref > A.pmax) { svToast("PRIX DE RÉFÉRENCE AU-DESSUS DU PLAFOND.", 3000); return; }
    const dup = achArtDup(L, A.des, A.u, a0 ? a0.id : ""); if (dup) { svToast("DOUBLON : " + dup.code + " — " + dup.des + " (" + dup.u + ") EXISTE DÉJÀ.", 4000); return; }
    const nr = achArtNear(L, A.des, A.u, a0 ? a0.id : ""); if (nr) svToast("PRESQUE IDENTIQUE À " + nr.code + " — " + nr.des + " : À FUSIONNER SI C'EST LE MÊME ARTICLE.", 4500);
    let a;
    if (a0) { a = L.find(x => x.id === a0.id); const LAB = { des: "DÉSIGNATION", u: "UNITÉ", cat: "FAMILLE", stk: "STOCKÉ", tva: "TVA", pref: "PRIX RÉF.", pmax: "PLAFOND", actif: "ACTIF", cpt: "CODE COMPTABLE", cptI: "INTITULÉ COMPTABLE", sfam: "SOUS-FAMILLE", nat: "TYPE", per: "PÉRISSABLE", cons: "DURÉE DE CONSERVATION", fab: "FABRICANTS", poids: "POIDS", vol: "VOLUME", cb: "CODE-BARRES", photo: "PHOTO", ft: "FICHE TECHNIQUE", ua: "UNITÉ D'ACHAT", eqv: "ÉQUIVALENTS", qmin: "QUANTITÉ MINIMALE", frsH: "FOURNISSEURS HABITUELS", pstd: "PRIX STANDARD PAR PROJET / ZONE" };
      const nz = v => v === undefined || v === null || v === false || v === 0 || v === "" || (Array.isArray(v) && !v.length) ? "" : v;   /* v1173 : champ absent = vide */
      const ch = Object.keys(LAB).filter(k => JSON.stringify(nz(a[k])) !== JSON.stringify(nz(A[k]))); Object.assign(a, A, { mod: achNow() }); if (ch.length) achHist(a.code, "MODIFICATION", ch.map(k => LAB[k]).join(", ")); }
    else { a = achArtNew(L, A); a.st = "instance"; a.cpt = A.cpt; a.cptI = A.cptI; ["sfam", "nat", "per", "cons", "fab", "poids", "vol", "cb", "photo", "ft", "ua", "eqv", "pstd", "qmin", "frsH"].forEach(k => { if (A[k] !== undefined) a[k] = A[k]; }); achHist(a.code, "CRÉATION", a.des + " (" + a.u + ")"); }
    if (ftBlob) { const k = "ach:art-ft:" + a.id; sviFiles.put(k, ftBlob).catch(() => {}); a.ft = k; ftBlob = null; }
    achArtsSave(L); d.remove(); if (done) done(a.id);
  });
  /* v1169 (C2.2) : photo (réduite) et fiche technique (fichier gardé sur l'appareil, comme la copie d'une facture) */
  let ftBlob = null;
  d.addEventListener("change", e => {
    const fi = e.target.closest(".art-photo-in"); if (fi && fi.files && fi.files[0]) { const rd = new FileReader();
      rd.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, 480 / Math.max(im.width, im.height)), c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k)); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        A.photo = c.toDataURL("image/jpeg", .8); const box = d.querySelector(".art-photo > div"); if (box) { let img = box.querySelector("img"); if (!img) { img = document.createElement("img"); box.prepend(img); } img.src = A.photo;
          if (!box.querySelector("[data-photorm]")) { const b = document.createElement("button"); b.type = "button"; b.className = "ach-b"; b.dataset.photorm = "1"; b.textContent = "RETIRER LA PHOTO"; box.append(" ", b); } } }; im.src = rd.result; };
      rd.readAsDataURL(fi.files[0]); fi.value = ""; return; }
    const ft = e.target.closest(".art-ft-in"); if (ft && ft.files && ft.files[0]) { ftBlob = ft.files[0]; A.ft = A.ft || "ach:art-ft:" + (a0 ? a0.id : "new");
      let n = ft.parentElement.querySelector(".art-ft-nm"); if (!n) { n = document.createElement("span"); n.className = "art-ft-nm ach-0"; ft.after(n); } n.textContent = " CHOISIE : " + achU(ftBlob.name || "") + " (ENREGISTRER POUR LA GARDER)"; ft.value = ""; }
  });
  d.addEventListener("click", async e => {
    if (e.target.closest("[data-photorm]")) { A.photo = ""; const img = d.querySelector(".art-photo img"); if (img) img.remove(); e.target.closest("[data-photorm]").remove(); const pi = d.querySelector(".art-photo-in"); if (pi) pi.value = ""; return; }
    if (e.target.closest("[data-ftsee]")) { try { const b = await sviFiles.get(A.ft); if (!b) { svToast("FICHE TECHNIQUE INTROUVABLE SUR CET APPAREIL.", 3000); return; } const u = URL.createObjectURL(b); window.open(u, "_blank"); setTimeout(() => URL.revokeObjectURL(u), 60000); } catch (er) { svToast("FICHE TECHNIQUE ILLISIBLE.", 3000); } }
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
/* v921 (remarque 3) : FIGER (rouge → vert ; refusé tant qu'il reste une alerte) et REVENIR EN INSTANCE (vert → rouge) ; VALIDER seulement après FIGER */
/* 05/11 : PLUS DE FIGER — une fiche passe directement d'EN INSTANCE (rouge) à VALIDÉE (noir) ; une ancienne fiche « figée » est en instance */
const achNvCycle = (x) => x.del ? [] : x.st === "fige" || x.st === "instance" ? [{ k: "val", lab: "VALIDER" }] : [];
async function achNvFiger(L, x, code, nom, why, save) {
  if (why.length) { svToast("FIGER IMPOSSIBLE : " + why.join(" · "), 4500); return false; }
  if (!(await svConfirm({ title: "FIGER", text: code + " — " + nom + " PASSE EN VERT : IL ATTEND SA VALIDATION.", ok: "FIGER", tone: "neutral" }))) return false;
  x.st = "fige"; x.fige = achNow(); x.mod = x.fige; save(L); achHist(code, "FIGÉ", nom); return true;
}
function achNvDefiger(L, x, code, nom, save) { x.st = "instance"; delete x.fige; x.mod = achNow(); save(L); achHist(code, "REVENU EN INSTANCE", nom); return true; }
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
  const artWhy = a => achArtWhy(a).concat(a.cat ? [] : ["CATÉGORIE MANQUANTE"]).concat(a.bloq ? ["BLOQUÉ : " + (a.bloq.why || "")] : []);
  return achNvMod(ctx, {
    list: { k: "art", t: "ach_art2", id: "achArtT", name: "ARTICLES", one: "ARTICLE", stKeys: ["instance", "valide", "bloque", "archive", "annule", "alerte"], edit: ACH_ED.art, all: achArts, save: achArtsSave, code: a => achRefSvi(a, achArts(), "ARA"), nom: a => a.des, why: artWhy,
      newRow: "CRÉER UN ARTICLE ICI…", add: done => achArtFiche(null, done),
      w: { ref: 110, nom: 360, u: 70, cat: 200, pref: 110, pmax: 110, nfr: 120, freq: 120, val: 110, cree: 110 },
      cols: mode => [["ref", "RÉFÉRENCE", a => achRefSvi(a, achArts(), "ARA"), ""], ["nom", "DÉSIGNATION", a => a.des, ""], ["u", "UNT", a => a.u, "center"], ["cat", "FAMILLE", a => a.cat || "", ""],
        ["pref", "PRIX RÉF. HT", a => achN(a.pref), "number"], ["pmax", "PLAFOND HT", a => achN(a.pmax) ? achN(a.pmax) : "", "number"],
        ["nfr", "FOURNISSEURS", a => { const R = achRep(achKey(a.des, a.u)); return R.n + (R.n < R.need ? " !" : ""); }, "center"], ["freq", "FRÉQUENCE", a => achArtFreq(a).lab, "center"]]
        .concat(mode === "valid" ? [["val", "VALIDÉ LE", a => achDFr(a.val || a.cree), "center"]] : []).concat([["cree", "SAISI LE", a => achDFr(a.cree), "center"]]) },
    pageOf: id => { const a = achArts().find(x => x.id === id); if (!a) return null;
      const C = achCaf().filter(c => (c.lignes || []).some(l => same(l, a))), D = achDvf().filter(v => (v.lignes || []).some(l => same(l, a))), M = achCmf().filter(c => (c.lignes || []).some(l => same(l, a)));
      const lp = (v, k) => (v.lignes || []).find(l => same(l, a)) || {};
      return { id, code: a.code, ref: achRefSvi(a, achArts(), "ARA"), tag: "ARTICLE", title: a.des + " (" + a.u + ")", st: achPcSt("art", a), del: !!a.del, inactif: a.actif === false, why: artWhy(a),
        info: done => achArtFiche(id, () => done()),
        menu: [...achNvCycle(a), { k: "cv", lab: "UNITÉ DE CONVERSION" + ((a.cv || []).length ? " (" + a.cv.length + ")" : "") }, { k: "bdg", lab: "BUDGETS (" + achArtBudgets(a).length + ")" },
          a.del ? null : a.bloq ? { k: "debl", lab: "DÉBLOQUER" } : { k: "bloq", lab: "BLOQUER" },
          a.del ? { k: "rest", lab: "RESTAURER" } : { k: "del", lab: "SUPPRIMER CET ARTICLE" }].filter(Boolean),
        act: async (k, redraw) => { const L = achArts(), x = L.find(y => y.id === id); if (!x) return;
          if (k === "bloq") { const m = await achAsk("BLOQUER " + x.des, "MOTIF DU BLOCAGE"); if (!m) return; x.bloq = { u: sviUser(), t: achNow(), why: m }; x.mod = achNow(); achArtsSave(L); achHist(x.code, "BLOQUÉ", m); redraw(); return; }
          if (k === "debl") { const m = await achAsk("DÉBLOQUER " + x.des, "MOTIF DU DÉBLOCAGE"); if (!m) return; delete x.bloq; x.mod = achNow(); achArtsSave(L); achHist(x.code, "DÉBLOQUÉ", m); redraw(); return; }
          if (k === "fige") { if (await achNvFiger(L, x, x.code, x.des, artWhy(x), achArtsSave)) redraw(); return; }
          if (k === "defige") { achNvDefiger(L, x, x.code, x.des, achArtsSave); redraw(); return; }
          if (k === "val") { if (await achNvValider(L, x, x.code, x.des, artWhy(x), achArtsSave)) redraw(); return; }
          if (k === "cv") { achArtCv(id, redraw); return; }
          if (k === "bdg") { achBdgWin(x); return; }
          if (k === "del") { if (!(await svConfirm({ title: "SUPPRIMER CET ARTICLE", text: x.code + " — " + x.des + " (RESTAURABLE DEPUIS LA CORBEILLE).", ok: "SUPPRIMER" }))) return; x.del = achNow(); achArtsSave(L); achHist(x.code, "CORBEILLE", x.des); redraw(); return; }
          if (k === "rest") { if (achArtDup(L, x.des, x.u, x.id)) { svToast("RESTAURATION IMPOSSIBLE : UN ARTICLE IDENTIQUE EXISTE.", 3500); return; } x.del = ""; achArtsSave(L); achHist(x.code, "RESTAURATION", x.des); redraw(); } },
        links: [
          { t: "CONSULTATIONS", cols: [["RÉFÉRENCE"], ["OBJET"], ["QUANTITÉ", "number"], ["ÉTAT", "center"]], rows: C.map(c => ({ cells: [c.ref, c.objet || "", achN(lp(c).q), { ouverte: "OUVERTE", close: "CLOSE", annule: "ANNULÉE" }[c.state] || ""], open: () => achGo("caf", c.id), cls: c.state === "annule" ? "nv-strike" : "" })) },
          { t: "DEVIS", cols: [["RÉFÉRENCE"], ["FOURNISSEUR"], ["PRIX HT", "number"], ["PRIX TTC", "number"]], rows: D.map(v => { const l = lp(v), t = l.tva === "" || l.tva === undefined ? achPrm().tva : achN(l.tva); return { cells: [v.ref, achFrsNom(v.frs), achN(l.pu), achN(l.pu) * (1 + t / 100)], open: () => achGo("dvf", v.id), cls: v.state === "rejete" || v.state === "annule" ? "nv-strike" : "" }; }) },
          { t: "COMMANDES", cols: [["RÉFÉRENCE"], ["FOURNISSEUR"], ["QUANTITÉ", "number"], ["PRIX HT", "number"], ["ÉTAT", "center"]], rows: M.map(c => { const l = lp(c); return { cells: [c.ref, achFrsNom(c.frs), achN(l.q), achN(l.pu), ACH_CMF_ST[c.state] || ""], open: () => achGo("cmf", c.id), cls: c.state === "annule" ? "nv-strike" : "" }; }) }] }; }
  });
}

/* ---------- FOURNISSEURS ---------- */
function achFrsNvMod(ctx) {
  const frsWhy = f => achFrsWhy(f, achFrsRO());
  return achNvMod(ctx, {
    list: { k: "frs", t: "ach_frs2", id: "achFrsT", name: "FOURNISSEURS", one: "FOURNISSEUR", stKeys: ["instance", "valide", "expire", "bloque", "archive", "annule", "alerte"], edit: ACH_ED.frs, all: () => { achFrsMigActif(); return achFrs(); }, save: achFrsSave, code: f => achFrsRef(f), nom: f => f.nom, why: frsWhy,
      newRow: "CRÉER UN FOURNISSEUR ICI…",
      add: async done => { const nom = await achAsk("NOUVEAU FOURNISSEUR", "NOM"); if (!nom) { done(null); return; } const L = achFrs(), dn = achFrsDupNom(L, nom, "");
        if (dn) svToast("UN FOURNISSEUR DU MÊME NOM EXISTE : " + dn.code + ".", 3500);
        const f = achFrsNew(L, { nom }); f.st = "instance"; f.grp = ""; achFrsSave(L); achHist(f.code, "CRÉATION", f.nom); done(f.id); achFrsFiche(f.id, "", () => done(f.id)); },
      w: { ref: 110, grp: 150, nom: 320, ville: 140, ice: 160, cond: 140, freq: 120, val: 110, cree: 110 },
      /* B42, B44 : états du fournisseur (la case ACTIF a disparu ; une ancienne fiche « inactive » compte comme bloquée) */
      /* D3 (série D) : le filtre ne propose plus que les statuts (plus d'ACTIF / INACTIF) ; TOUT par défaut */
      etat0: "tout", etats: [["frequent", "FRÉQUENTS"], ["normal", "NORMAUX"], ["occasionnel", "OCCASIONNELS"], ["dormant", "DORMANTS"], ["bloque", "BLOQUÉS"], ["archive", "ARCHIVÉS"], ["corbeille", "CORBEILLE"], ["tout", "TOUT"]],
      ok: (x, k) => k === "corbeille" ? !!x.del : x.del ? false : k === "tout" ? true : k === "archive" ? !!x.arch : k === "bloque" ? !x.arch && (!!x.bloq || x.actif === false)
        : x.arch || x.bloq || x.actif === false ? false : k === "actif" ? true : achFrsFreq(x).k === k,
      cols: mode => [["ref", "RÉFÉRENCE", f => achFrsRef(f), ""], ["grp", "ORIGINE", f => achFrsGrp(f).nom, ""], ["nom", "NOM", f => f.nom, "", f => f.logo || ""], ["ville", "VILLE", f => f.ville || "", ""], ["ice", "ICE", f => achDig(f.ice), "center"], ["freq", "FRÉQUENCE", f => achFrsFreq(f).lab, "center"]]
        .concat(mode === "valid" ? [["val", "VALIDÉ LE", f => achDFr(f.val || f.cree), "center"]] : []).concat([["cree", "SAISI LE", f => achDFr(f.cree), "center"]]) },
    pageOf: id => { const f = achFrs().find(x => x.id === id); if (!f) return null;
      /* v921 (remarque 4) : toutes les pièces liées au fournisseur — consultations, devis, commandes, réceptions, retours, factures, avoirs, paiements */
      const me = v => achFrsIs(v, f), yo = x => !(f.archOld || []).includes(String(x.cree || x.date || "").slice(0, 4));   /* B44 : années restées archivées */
      const D = achDvf().filter(v => me(v.frs) && yo(v)), M = achCmf().filter(c => me(c.frs) && yo(c)), FA = achFaf().filter(x => me(x.frs) && yo(x)), PA = achPaf().filter(x => me(x.frs) && yo(x));
      const CA = achCaf().filter(c => (c.frs || []).some(me) && yo(c)), RC = achRcp().filter(r => (me(r.frs) || M.some(c => c.id === r.cmf)) && yo(r)), RT = achRtr().filter(x => (me(x.frs) || M.some(c => c.id === x.cmf) || RC.some(r => r.id === x.rcp)) && yo(x)), AV = achAvf().filter(x => me(x.frs) && yo(x));
      const twins = achFrs().filter(x => x.id !== id && !x.del && achU(x.nom) === achU(f.nom));
      const arts = new Map(); D.filter(v => v.state !== "rejete" && v.state !== "annule").forEach(v => (v.lignes || []).forEach(l => { if (achN(l.pu) > 0) arts.set(achKey(l.des, l.u), { l, v }); }));
      return { id, code: f.code, ref: achFrsRef(f), tag: "FOURNISSEUR", title: f.nom, st: achPcSt("frs", f), del: !!f.del, inactif: f.actif === false, why: frsWhy(f),
        info: done => achFrsFiche(id, "", () => done()),
        menu: [...achNvCycle(f), { k: "rib", lab: "RIB" }, { k: "cte", lab: "CONTACTS (" + (f.cte || []).length + ")" }, { k: "evl", lab: "ÉVALUATIONS (" + (f.evl || []).length + ")" },
          { k: "cgf", lab: "CONTRATS (" + (f.cgf || []).length + ")" }, { k: "docf", lab: "DOCUMENTS FISCAUX (" + (f.docf || []).length + ")" },
          f.del ? null : f.bloq ? { k: "debl", lab: "DÉBLOQUER" } : { k: "bloq", lab: "BLOQUER" },
          f.del ? null : f.arch ? { k: "desarch", lab: "DÉSARCHIVER" } : achFrsDormant(f) ? { k: "arch", lab: "ARCHIVER (DORMANT)" } : null, f.del ? { k: "rest", lab: "RESTAURER" } : { k: "del", lab: "SUPPRIMER CE FOURNISSEUR" }].filter(Boolean),
        act: async (k, redraw) => { const L = achFrs(), x = L.find(y => y.id === id); if (!x) return;
          if (k === "fige") { if (await achNvFiger(L, x, x.code, x.nom, frsWhy(x), achFrsSave)) redraw(); return; }
          if (k === "defige") { achNvDefiger(L, x, x.code, x.nom, achFrsSave); redraw(); return; }
          if (k === "val") { if (await achNvValider(L, x, x.code, x.nom, frsWhy(x), achFrsSave)) redraw(); return; }
          if (k === "evl") { achFrsEvalWin(id, redraw); return; }   /* v912 : évaluations hors du i */
          if (["rib", "cte", "cgf", "docf"].includes(k)) { achFrsFiche(id, k === "rib" ? "rib" : k, redraw); return; }
          /* v809 : BLOQUER (motif, noté dans H) — refusé dans les nouvelles consultations, devis, commandes et paiements ; ARCHIVER au mois de clôture si dormant (C1.45) */
          if (k === "bloq") { const m = await achAsk("BLOQUER " + x.nom, "MOTIF DU BLOCAGE"); if (!m) return; x.bloq = { u: typeof sviUser === "function" ? sviUser() : "", t: achNow(), why: m }; x.mod = achNow(); achFrsSave(L); achHist(x.code, "BLOQUÉ", m); redraw(); return; }
          if (k === "debl") { const m = await achAsk("DÉBLOQUER " + x.nom, "MOTIF DU DÉBLOCAGE"); if (!m) return; delete x.bloq; x.mod = achNow(); achFrsSave(L); achHist(x.code, "DÉBLOQUÉ", m); redraw(); return; }
          if (k === "arch") { const why = achFrsArchWhy(x); if (why.length) { await svConfirm({ title: "ARCHIVAGE IMPOSSIBLE", html: `<ul class="svc-list">${why.map(w => `<li>${esc(w)}</li>`).join("")}</ul>`, ok: "OK", tone: "neutral" }); return; }
            if (!(await svConfirm({ title: "ARCHIVER", text: x.code + " — " + x.nom + " : DERNIER ACHAT " + (achDFr(achFrsLast(x.id)) || "AUCUN") + ". IL NE POURRA PLUS ÊTRE CHOISI DANS UNE NOUVELLE PIÈCE.", ok: "ARCHIVER" }))) return;
            x.arch = achNow(); x.mod = x.arch; achFrsSave(L); achHist(x.code, "ARCHIVÉ", "DORMANT"); redraw(); return; }
          if (k === "desarch") { /* B44 : cocher les années d'historique à faire revenir (les 3 dernières cochées) ; les autres restent archivées */
            const me = v => achFrsIs(v, x), Y = [...new Set([achDvf(), achCmf(), achFaf(), achPaf(), achRcp(), achAvf()].flatMap(Lp => Lp.filter(v => me(v.frs)).map(v => String(v.cree || v.date || "").slice(0, 4))).filter(y => /^\d{4}$/.test(y)))].sort().reverse();
            let keep = new Set(Y.slice(0, 3)); const h = ev => { const c = ev.target; if (c && c.classList && c.classList.contains("frs-yr")) { if (c.checked) keep.add(c.value); else keep.delete(c.value); } }; document.addEventListener("change", h, true);
            const ok = await svConfirm({ title: "DÉSARCHIVER " + x.nom, html: Y.length ? `<div>ANNÉES D'HISTORIQUE À FAIRE REVENIR :</div>${Y.map(y => `<label class="frs-c"><input type="checkbox" class="frs-yr" value="${y}"${keep.has(y) ? " checked" : ""}> ${y}</label>`).join("")}` : "AUCUNE PIÈCE ARCHIVÉE.", ok: "DÉSARCHIVER", tone: "neutral" });
            document.removeEventListener("change", h, true); if (!ok) return;
            delete x.arch; x.archOld = Y.filter(y => !keep.has(y)); x.mod = achNow(); achFrsSave(L); achHist(x.code, "DÉSARCHIVÉ", x.nom + (x.archOld.length ? " — RESTENT ARCHIVÉES : " + x.archOld.join(", ") : "")); redraw(); return; }
          if (k === "del") { if (!(await svConfirm({ title: "SUPPRIMER CE FOURNISSEUR", text: x.code + " — " + x.nom + " (RESTAURABLE DEPUIS LA CORBEILLE).", ok: "SUPPRIMER" }))) return; x.del = achNow(); achFrsSave(L); achHist(x.code, "CORBEILLE", x.nom); redraw(); return; }
          if (k === "rest") { x.del = ""; achFrsSave(L); achHist(x.code, "RESTAURATION", x.nom); redraw(); } },
        links: [
          { t: "ARTICLES (DEVIS EN COURS)", cols: [["DÉSIGNATION"], ["U", "center"], ["PRIX HT", "number"], ["PRIX TTC", "number"], ["DEVIS"]], rows: [...arts.values()].map(({ l, v }) => { const t = l.tva === "" || l.tva === undefined ? achPrm().tva : achN(l.tva); return { cells: [l.des, l.u, achN(l.pu), achN(l.pu) * (1 + t / 100), v.ref] }; }) },
          ...(twins.length ? [{ t: "AUTRES FICHES DU MÊME NOM", cols: [["RÉFÉRENCE"], ["NOM"], ["VILLE"], ["ÉTAT", "center"]], rows: twins.map(x => ({ cells: [achFrsRef(x), x.nom, x.ville || "", achStF(x) === "fige" ? "FIGÉ" : achSt(x) === "instance" ? "EN INSTANCE" : "VALIDÉ"], open: () => achGo("frs", x.id) })) }] : []),
          { t: "CONSULTATIONS", cols: [["RÉFÉRENCE"], ["OBJET"], ["RÉPONSE", "center"], ["ÉTAT", "center"]], rows: CA.map(c => { const k = (c.frs || []).find(me), rp = (c.rep || {})[k] || {}; return { cells: [c.ref, c.objet || "", rp.st === "repondu" ? "RÉPONDU" : "EN ATTENTE", { ouverte: "OUVERTE", close: "CLOSE", annule: "ANNULÉE" }[c.state] || ""], open: () => achGo("caf", c.id), cls: c.state === "annule" ? "nv-strike" : "" }; }) },
          { t: "DEVIS", cols: [["RÉFÉRENCE"], ["ARTICLES"], ["MONTANT TTC", "number"]], rows: D.map(v => ({ cells: [v.ref, (v.lignes || []).map(l => l.des).join("; "), achDvfTot(v).ttc], open: () => achGo("dvf", v.id), st: v.state === "retenu" ? "valide" : v.state === "rejete" || v.state === "annule" ? "" : "instance", cls: v.state === "rejete" || v.state === "annule" ? "nv-strike" : "" })) },
          /* D1 : retours de commande dans COMMANDES, retours de réception dans RÉCEPTIONS, avoirs dans FACTURES (montants négatifs) */
          { t: "COMMANDES", cols: [["RÉFÉRENCE"], ["ARTICLES"], ["MONTANT TTC", "number"], ["ÉTAT", "center"]], rows: M.map(c => ({ cells: [c.ref, (c.lignes || []).map(l => l.des).join("; "), achCmfTot(c).ttc, ACH_CMF_ST[c.state] || ""], open: () => achGo("cmf", c.id), cls: c.state === "annule" ? "nv-strike" : "" }))
            .concat(RT.filter(x => x.kind === "cmd").map(x => ({ cells: [x.ref, "RETOUR DE COMMANDE — " + achRtrSrc(x), achRtrTtc(x), x.state === "annule" ? "ANNULÉ" : "RETOUR"], open: () => achGo("cmf", x.id), cls: x.state === "annule" ? "nv-strike" : "" }))) },
          { t: "RÉCEPTIONS", cols: [["RÉFÉRENCE"], ["COMMANDE"], ["N° BL"], ["REÇU LE", "center"], ["ÉTAT", "center"]], rows: RC.map(r => ({ cells: [r.ref, ((achCmf().find(c => c.id === r.cmf) || {}).ref) || "SANS COMMANDE", r.pv ? "PV DE SERVICE FAIT" : r.nbl || "", achDFr(r.date), r.state === "annule" ? "ANNULÉE" : "ENREGISTRÉE"], open: () => achGo("rcp", r.id), cls: r.state === "annule" ? "nv-strike" : "" }))
            .concat(RT.filter(x => x.kind === "rcp").map(x => ({ cells: [x.ref, ((achCmf().find(c => c.id === x.cmf) || {}).ref) || "", "RETOUR DE " + achRtrSrc(x), achDFr(x.date), x.state === "annule" ? "ANNULÉ" : "RETOUR"], open: () => achGo("rcp", x.id), cls: x.state === "annule" ? "nv-strike" : "" }))) },
          { t: "FACTURES", cols: [["RÉFÉRENCE"], ["N°"], ["MONTANT TTC", "number"], ["RESTE À PAYER", "number"], ["ÉTAT", "center"]], rows: FA.map(x => ({ cells: [x.ref, x.num || "", achFafTot(x).ttc, x.state === "annule" ? "" : achFafReste(x), achFafEtat(x)], open: () => achGo("faf", x.id), cls: x.state === "annule" ? "nv-strike" : "" }))
            .concat(AV.map(x => ({ cells: [x.ref, x.num || "", -achN(x.ttc), x.state === "annule" ? "" : -achAvfReste(x), x.state === "annule" ? "ANNULÉ" : "AVOIR"], open: () => achGo("faf", x.id), cls: x.state === "annule" ? "nv-strike" : "" }))) },
          { t: "PAIEMENTS", cols: [["RÉFÉRENCE"], ["MODE"], ["MONTANT", "number"], ["ÉTAT", "center"]], rows: PA.map(p => ({ cells: [p.ref, p.mode, achN(p.mt), ACH_PAF_ST[p.state] || ""], open: () => achGo("paf", p.id), cls: p.state === "annule" || p.state === "rejete" ? "nv-strike" : "" })) },
          /* v808 : blocs de la page du fournisseur (checklist, hors du i) — encours et solde, litiges, évaluations, dépendance */
          (() => { const fa = FA.filter(x => !x.del && x.state !== "annule"), fac = fa.reduce((t, x) => t + achFafTot(x).ttc, 0), enc = achFrsEnc(id),
              av = achAvf().filter(a => me(a.frs) && a.state !== "annule").reduce((t, a) => t + Math.max(0, achAvfReste(a)), 0), pl = achN(f.plafEnc);
            return { t: "ENCOURS ET SOLDE", cols: [["FACTURÉ TTC", "number"], ["PAYÉ", "number"], ["AVOIRS À DÉDUIRE", "number"], ["ENCOURS", "number"], ["PLAFOND", "number"], ["SOLDE DÛ", "number"]],
              rows: fa.length || av ? [{ cells: [fac, fac - enc, av, enc, pl || "", enc - av], cls: pl && enc > pl + 0.005 ? "nv-alert" : "" }] : [] }; })(),
          { t: "LITIGES", cols: [["TYPE"], ["RÉFÉRENCE"], ["MOTIF"], ["DATE", "center"]],
            rows: FA.filter(x => x.state === "reclame").map(x => ({ cells: ["FACTURE RÉCLAMÉE", x.ref, x.motif || x.recl || "", achDFr(x.mod || x.cree)], open: () => achGo("faf", x.id) }))
              .concat(achRtr().filter(r => me(r.frs)).map(r => ({ cells: [r.kind === "cmd" ? "RETOUR DE COMMANDE" : "RETOUR DE MARCHANDISE", r.ref, r.motif || "", achDFr(r.date)] })))
              .concat(PA.filter(p => p.state === "rejete").map(p => ({ cells: [p.mode + " REJETÉ", p.ref, p.motif || "", achDFr(p.mod)], open: () => achGo("paf", p.id) }))) },
          { t: "ÉVALUATIONS", cols: [["DATE", "center"], ["NOTE / 10", "number"], ["CRITÈRES"]],
            rows: (f.evl || []).map(x => ({ cells: [achDFr(x.date), Math.round(achN(x.moy) * 10) / 10, (x.crit || []).map(c => c.d + " " + c.n).join(", ")],  })) },
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
/* v1132 (L6 – L8) : TOUT COCHER = les lignes affichées (pas celles cachées par le filtre des blocs liés) ; case d'en-tête à trois états (vide, à moitié, pleine) */
/* v1133 : lignes de données seulement (ni titre de groupe, ni ligne cachée) */
const ACH_NVP_ROWCB = "tbody tr[data-ri]:not(.svlk-hid):not(.nvp-gt) .nvp-cb";
/* v1136 (L8, choix A d'Ahmed) : titres de groupe compris — un titre (svlk-gt-<g>) est coché quand toutes les lignes affichées de son groupe le sont, à moitié sinon */
const achNvpAllSt = t => { if (!t) return; t.querySelectorAll("tbody tr.nvp-gt").forEach(tt => { const m = String(tt.className).match(/\bsvlk-gt-(\S+)/), cb = tt.querySelector(".nvp-cb"); if (!m || !cb) return;
    const I = [...t.querySelectorAll("tbody tr.svlk-g-" + CSS.escape(m[1]) + ":not(.svlk-hid) .nvp-cb")], k = I.filter(c => c.checked).length; cb.checked = k > 0 && k === I.length; cb.indeterminate = k > 0 && k < I.length; });
  const all = t.querySelector(".nvp-all"); if (!all) return; const C = [...t.querySelectorAll(ACH_NVP_ROWCB)], n = C.filter(c => c.checked).length;
  all.checked = n > 0 && n === C.length; all.indeterminate = n > 0 && n < C.length; };
document.addEventListener("change", e => { const a = e.target.closest && e.target.closest(".nvp-all"); if (a) { const t = a.closest("table"); t.querySelectorAll(ACH_NVP_ROWCB).forEach(c => { c.checked = a.checked; }); achNvpAllSt(t); return; }
  const c = e.target.closest && e.target.closest(".nvp-cb"); if (!c) return; const t = c.closest("table"), m = String(c.closest("tr").className).match(/\bsvlk-gt-(\S+)/);
  if (m) t.querySelectorAll("tbody tr.svlk-g-" + CSS.escape(m[1]) + ":not(.svlk-hid) .nvp-cb").forEach(x => { x.checked = c.checked; });   /* v1136 (L8 A) : cocher un titre = tout son groupe */
  achNvpAllSt(t); });
