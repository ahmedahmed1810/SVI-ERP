/* =========================================================
   v834 : DÉCOUPE DU GRAND BLOC (programme, point 4) — les ONGLETS DU BLOC DES ÉTAPES (avenants, scénarios, versions, recalages) sort de openBudgetDetail.
   Appelé depuis l'écran du budget (22o-etapes-onglets.js) avec ce dont il a besoin ; histLog (déclaré plus loin dans l'écran du budget) est lu au moment de l'appel.
   ========================================================= */
function sviBdgEtapesOnglets(C) {
  const { AV_ROOT, INS, budget, budgetData, cfApply, cfHead, insSave, ref, refreshAll, shell } = C;
  const histLog = (...a) => C.histLog()(...a);
  /* =========================================================
     v756 : BLOC À ONGLETS AVENANTS / SCÉNARIOS / VERSIONS / RECALAGES (prompt du 01/11/2026, module BUDGET, points 2 à 5)
     - un seul bloc en bas du budget ; chaque onglet garde son tableau (SCÉNARIOS, VERSIONS, RECALAGES : 22e, 22j) ;
     - AVENANTS (surtout utile sur le consolidé) : budget initial puis chaque avenant — montant TTC et état ; toucher = l'ouvrir ;
     - les scénarios ne se voient que dans l'onglet SCÉNARIOS ;
     - menu ⋯ du bloc : COMPARER, CRÉER (propre à l'onglet), APERÇU, EXPORTER ; les boutons suivent l'onglet ouvert (data-blk) ;
     - ouverture depuis la liste : le budget lui-même (scénario RETENU s'il y en a un), jamais un autre scénario.
     ========================================================= */
  {
    const ETP_K = "svi_etp_tab_v1";
    const ETP_LAB = { av: "BUDGETS", scn: "SCÉNARIOS", ver: "VERSIONS", rcl: "RECALAGES" };
    const ETP_NEW = { av: "CRÉER UN AVENANT", scn: "CRÉER UN SCÉNARIO", ver: "PRENDRE UNE VERSION", rcl: "CRÉER UN RECALAGE" };
    const bi = budget.inst;
    /* étapes de la famille (budget initial puis avenants) : depuis une étape, le consolidé ou un recalage */
    const etpRoot = () => {
      if (!bi) return "";
      if (AV_ROOT) return AV_ROOT;
      if (bi.virtual) return "";
      const st = bi.rclOf ? sviInstGet().find(x => x.ref === bi.rclOf) : bi;
      return st ? (st.parent || st.ref) : "";
    };
    const etpOn = () => !!bi && bi.ref !== "CUMUL" && !(bi.virtual && bi.vname) && !!INS;
    const etpWhy = k => {
      if (k === "av") return etpRoot() ? "" : "PAS D'AVENANT ICI.";
      if (bi.virtual) return "CONSOLIDÉ : " + ETP_LAB[k] + " SUR CHAQUE ÉTAPE (ONGLET BUDGETS › TOUCHER UNE ÉTAPE).";
      return "";
    };
    let etpTab = "";
    try { etpTab = localStorage.getItem(ETP_K) || ""; } catch (e) {}
    /* ---------- AVENANTS ---------- */
    /* v782 (remarque 2) : plus de colonne ÉTAPE — la nature est dans la référence (INI, AVn, CNS) */
    const AV_COLS = [["avref", "RÉFÉRENCE", x => x.r, ""], ["avint", "INTITULÉ", x => x.int, ""],
      ["avttc", "MONTANT TTC", x => x.ttc, "number"], ["avst", "ÉTAT", x => x.st, "center"], ["avdt", "VALIDÉ LE", x => x.val, ""]];
    let avShown = [];
    const avRows = () => {
      const root = etpRoot(); if (!root) return [];
      /* v780 (remarque 6) : onglet BUDGETS — CONSOLIDÉ (CNS) en première ligne, puis BUDGET INITIAL (INI), puis les avenants (AVn) ; toucher = l'ouvrir */
      const S = sviAvStages(root);
      const out = S.map(st => {
        let bd = {}; try { bd = budgetData({ ref: st.ref, project: st.project, rows: [], first: {}, inst: st, __noFam: true }); } catch (e) {}
        const s0 = st.state === "valide" ? "VALIDÉ" : st.state === "fige" ? "FIGÉ" : "EN INSTANCE";
        return { ref: st.ref, cls: st.xp ? "expire" : st.state || "instance", nat: st.parent ? "AVENANT " + (st.avn || 1) : "BUDGET INITIAL", r: sviRefDisp(st.ref, st.project), int: st.intitule || "",
          ttc: Math.round((bd.ttc || 0) * 100) / 100, st: st.xp ? s0 + " — EXPIRÉ" : s0, val: st.state === "valide" ? svDT(st.validated || "") : "", xp: !!st.xp };
      });
      if (S.length > 1) out.unshift({ ref: root + "-GLOBAL", cls: "valide", nat: "BUDGET CONSOLIDÉ", r: sviRefDisp(root + "-GLOBAL", S[0].project), int: S[0].intitule || "",
        ttc: Math.round(out.filter(x => !x.xp && x.cls === "valide").reduce((t, x) => t + x.ttc, 0) * 100) / 100, st: "CONSOLIDÉ", val: "" });
      return out;
    };
    shell.__avData = () => { const oc = coOrder("vav", AV_COLS); return { head: oc.map(c => c[1]), rows: avShown.map(x => oc.map(c => c[0] === "avttc" ? money(c[2](x)) : c[2](x))) }; };
    const avRender = () => {
      const t = $("avTable"), pane = shell.querySelector(".blk-etp .blk-av"); if (!t || !pane) return;
      const all = avRows(); pane.hidden = !all.length;
      const ttl = $("avTitle");
      if (!all.length) { if (ttl) ttl.innerHTML = "BUDGETS " + svCnt(0); t.innerHTML = ""; return; }
      const rows = cfApply("vav", AV_COLS, all); avShown = rows;
      if (ttl) ttl.innerHTML = "BUDGETS " + svCnt(rows.length);
      const oc = coOrder("vav", AV_COLS), S = sviAvStages(etpRoot()), last = S[S.length - 1], ok = !!last && last.state === "valide";
      t.style.width = cwTableW("vav", AV_COLS) + "px";
      t.innerHTML = `<colgroup>${cwCols("vav", oc)}</colgroup><thead><tr>${oc.map(c => cfHead("vav", c[0], c[1], c[3])).join("")}</tr></thead>
        <tbody>${rows.map(x => `<tr class="av-row st-${x.cls}${x.ref === ref ? " ver-act" : ""}" data-avr="${esc(x.ref)}">${oc.map(c => `<td class="${c[3]}">${esc(c[0] === "avttc" ? money(c[2](x)) : c[2](x))}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${oc.length}" class="empty">AUCUNE LIGNE (FILTRE)</td></tr>`}
        ${ok ? `<tr class="scn-new" data-avadd><td colspan="${oc.length}">CRÉER UN AVENANT ICI…</td></tr>` : ""}</tbody>`;   /* v782 (remarque 1) : seulement si le budget initial est validé et qu'aucun avenant n'est en instance */
    };
    shell.querySelector(".blk-etp .blk-av")?.addEventListener("click", e => {
      if (e.target.closest(".cf-btn, .col-rs")) return;
      const na = e.target.closest("tr[data-avadd]");
      if (na) { e.stopPropagation(); if (na.classList.contains("off")) { svToast(na.dataset.why, 4000, na); return; } window.__sviAvNew && window.__sviAvNew(etpRoot(), ref); return; }
      const tr = e.target.closest("tr[data-avr]"); if (!tr) return;
      e.stopPropagation();
      if (tr.dataset.avr === ref) return;
      window.__sviAvOpen(tr.dataset.avr, ref);   /* la flèche ramène à cet écran (le consolidé) */
    });
    /* ---------- onglets ---------- */
    const etpSync = () => {
      const blk = shell.querySelector(".blk-etp"); if (!blk) return;
      blk.hidden = !etpOn();
      if (blk.hidden) return;
      try { avRender(); } catch (e) {}
      const keys = ["av", "scn", "ver", "rcl"], ok = k => !etpWhy(k);
      if (!keys.includes(etpTab) || !ok(etpTab)) etpTab = AV_ROOT ? "av" : keys.find(ok) || "av";
      keys.forEach(k => {
        const b = blk.querySelector(`[data-etab="${k}"]`), p = blk.querySelector(`.etp-pane[data-pane="${k}"]`), w = etpWhy(k);
        if (b) { b.classList.toggle("active", k === etpTab); b.classList.toggle("off", !!w); if (w) b.dataset.why = w; else delete b.dataset.why;
          /* onglet vide (tableau non dessiné) : son nombre à zéro */
          if (p && p.hidden && k !== "av" && !/svi-cnt/.test(b.innerHTML)) b.innerHTML = (SVI_ICON[k] || "") + ETP_LAB[k] + " " + svCnt(0); }
        if (p) p.classList.toggle("on", k === etpTab);
      });
      blk.querySelectorAll(".blk-tools .blk-btn[data-etp]").forEach(x => {
        x.dataset.blk = etpTab;
        /* v758 : IMPORTER dans AVENANTS, SCÉNARIOS et RECALAGES, pas dans VERSIONS */
        if (x.dataset.act === "import" || x.dataset.act === "noimport") { x.dataset.act = etpTab === "ver" ? "noimport" : "import"; x.title = "IMPORTER — " + { av: "NOUVEL AVENANT", scn: "NOUVEAU SCÉNARIO", rcl: "NOUVEAU RECALAGE", ver: "" }[etpTab]; }
        if (x.dataset.act === "new") x.title = ETP_NEW[etpTab];
      });
    };
    let etpQ = false;
    shell.__etpLater = () => { if (etpQ) return; etpQ = true; queueMicrotask(() => { etpQ = false; try { etpSync(); } catch (e) {} }); };
    shell.__etpSync = etpSync;
    /* =========================================================
       v773 : CASES À COCHER et ACTION GROUPÉE dans les quatre onglets (décisions d'Ahmed du 01/11/2026) :
       - AVENANTS : en instance (rouges) = SUPPRIMÉS ; validés = EXPIRÉS (ligne barrée, hors consolidé, remplaçables) ;
       - SCÉNARIOS : non validés (ni retenus ni offerts) = SUPPRIMÉS ; validés = ARCHIVÉS ; l'actif n'est pas touché ;
       - VERSIONS : ARCHIVÉES ; RECALAGES : en cours = SUPPRIMÉS, enregistrés = ARCHIVÉS.
       Confirmation avec le nombre d'éléments par action ; ce qui ne peut pas être traité est ignoré, avec la raison.
       ========================================================= */
    const ETP_SEL = { av: new Set(), scn: new Set(), ver: new Set(), rcl: new Set() };
    const ETP_ROW = { av: ["avTable", "avr"], scn: ["scnTable", "scn"], ver: ["verTable", "vn"], rcl: ["rclTable", "rcl"] };
    const etpDecor = () => ["av", "scn", "ver", "rcl"].forEach(k => {
      const t = $(ETP_ROW[k][0]); if (!t || !t.tHead || !t.tHead.rows[0] || t.tHead.querySelector(".etp-cbh")) return;
      const at = ETP_ROW[k][1], rows = [...t.querySelectorAll(`tbody tr[data-${at}]`)];
      const cg = t.querySelector("colgroup"); if (cg) cg.insertAdjacentHTML("beforeend", '<col style="width:36px">');
      if (t.style.width) t.style.width = (parseFloat(t.style.width) + 36) + "px";
      const ids = rows.map(r => r.dataset[at]); [...ETP_SEL[k]].forEach(id => { if (!ids.includes(id)) ETP_SEL[k].delete(id); });
      t.tHead.rows[0].insertAdjacentHTML("beforeend", `<th class="center etp-cbh"><input type="checkbox" class="etp-all" data-k="${k}"${ids.length && ids.every(id => ETP_SEL[k].has(id)) ? " checked" : ""}></th>`);
      rows.forEach(r => r.insertAdjacentHTML("beforeend", `<td class="center etp-cbc"><input type="checkbox" class="etp-cb" data-k="${k}" data-id="${esc(r.dataset[at])}"${ETP_SEL[k].has(r.dataset[at]) ? " checked" : ""}></td>`));
      t.querySelectorAll("tbody tr:not([data-" + at + "]) td[colspan]").forEach(td => { td.colSpan = td.colSpan + 1; });
      if (k === "ver") { const VF = INS.vfz || []; rows.forEach(r => { const x = VF.find(v => String(v.n) === r.dataset.vn); if (x && x.arch) r.classList.add("etp-arch"); }); }
      if (k === "rcl") rows.forEach(r => { const x = sviInstGet().find(v => v.ref === r.dataset.rcl); if (x && x.arch) r.classList.add("etp-arch"); });
    });
    { const blk0 = shell.querySelector(".blk-etp");
      if (blk0 && !blk0.__cbOn) { blk0.__cbOn = true;
        blk0.addEventListener("click", e => { if (e.target.closest(".etp-cbc, .etp-cbh")) e.stopPropagation(); }, true);
        blk0.addEventListener("change", e => {
          const a = e.target.closest(".etp-all"), c = e.target.closest(".etp-cb");
          if (a) { const k = a.dataset.k; a.closest("table").querySelectorAll(".etp-cb").forEach(x => { x.checked = a.checked; if (a.checked) ETP_SEL[k].add(x.dataset.id); else ETP_SEL[k].delete(x.dataset.id); }); return; }
          if (c) { const k = c.dataset.k; if (c.checked) ETP_SEL[k].add(c.dataset.id); else ETP_SEL[k].delete(c.dataset.id); }
        }, true); } }
    const etpSync0 = etpSync;
    shell.__etpSync = () => { etpSync0(); try { etpDecor(); } catch (e) {} };
    shell.__etpLater = () => { if (etpQ) return; etpQ = true; queueMicrotask(() => { etpQ = false; try { etpSync0(); etpDecor(); } catch (e) {} }); };
    shell.__etpDel = async k => {
      const ids = [...ETP_SEL[k]]; if (!ids.length) { svToast("COCHER D'ABORD LES LIGNES À TRAITER.", 3000); return; }
      const L = sviInstGet(), plan = { del: [], arch: [], xp: [], skip: [] };
      if (k === "av") ids.forEach(r => { const st = L.find(x => x.ref === r); if (!st) return;
        if (!st.parent) plan.skip.push(r + " : BUDGET INITIAL (SE SUPPRIME OU S'ARCHIVE PAR LE MENU ⋯ DU BUDGET)");
        else if (st.state !== "valide") plan.del.push(r); else if (st.xp) plan.skip.push(r + " : DÉJÀ EXPIRÉ"); else plan.xp.push(r); });
      if (k === "scn") { const V = INS.ver || {}; ids.forEach(id => { const x = (V.L || []).find(y => y.id === id); if (!x) return;
        if (id === V.act) plan.skip.push((x.nom || id) + " : SCÉNARIO ACTIF"); else if (x.ret || x.of) { if (x.arch) plan.skip.push((x.nom || id) + " : DÉJÀ ARCHIVÉ"); else plan.arch.push(id); } else plan.del.push(id); }); }
      if (k === "ver") ids.forEach(n => { const x = (INS.vfz || []).find(v => String(v.n) === n); if (!x) return; if (x.arch) plan.skip.push("VERSION " + n + " : DÉJÀ ARCHIVÉE"); else plan.arch.push(n); });
      if (k === "rcl") ids.forEach(r => { const x = L.find(v => v.ref === r); if (!x) return; if (x.state !== "valide") plan.del.push(r); else if (x.arch) plan.skip.push(r + " : DÉJÀ ARCHIVÉ"); else plan.arch.push(r); });
      const nm = { av: "AVENANT(S)", scn: "SCÉNARIO(S)", ver: "VERSION(S)", rcl: "RECALAGE(S)" }[k];
      const li = [plan.del.length && `<li><b>SUPPRIMER</b> ${plan.del.length} ${nm}</li>`, plan.xp.length && `<li><b>EXPIRER</b> ${plan.xp.length} ${nm} (LIGNE BARRÉE, HORS CONSOLIDÉ)</li>`, plan.arch.length && `<li><b>ARCHIVER</b> ${plan.arch.length} ${nm}</li>`].filter(Boolean);
      if (!li.length) { svToast("RIEN À TRAITER : " + plan.skip.join(" · "), 5000); return; }
      if (!(await svConfirm({ title: "ACTION SUR LES " + ids.length + " LIGNE(S) COCHÉE(S)", html: `<ul class="svc-list">${li.join("")}</ul>${plan.skip.length ? `<div class="svc-sub">IGNORÉ : ${esc(plan.skip.join(" · "))}</div>` : ""}`, ok: "CONFIRMER" }))) return;
      let goRoot = "";
      if (k === "av" || k === "rcl") {
        const del = new Set(plan.del), xp = new Set(plan.xp), ar = new Set(plan.arch);
        if (del.has(ref)) goRoot = (L.find(x => x.ref === ref) || {}).parent || (L.find(x => x.ref === ref) || {}).rclOf || "";
        sviInstSet(L.filter(x => !del.has(x.ref)).map(x => xp.has(x.ref) ? { ...x, xp: true } : ar.has(x.ref) ? { ...x, arch: true } : x));
        plan.del.forEach(r => histLog(k === "av" ? "AVENANT" : "RECALAGE", "SUPPRIMÉ", r)); plan.xp.forEach(r => histLog("AVENANT", "EXPIRÉ", r)); plan.arch.forEach(r => histLog("RECALAGE", "ARCHIVÉ", r));
        try { await sviInstFlush(); } catch (e) {}
      }
      if (k === "scn") { const V = INS.ver; V.L = V.L.filter(x => !plan.del.includes(x.id)); V.L.forEach(x => { if (plan.arch.includes(x.id)) x.arch = true; }); insSave(); histLog("SCÉNARIOS", "ACTION GROUPÉE", plan.del.length + " SUPPRIMÉ(S), " + plan.arch.length + " ARCHIVÉ(S)"); }
      if (k === "ver") { (INS.vfz || []).forEach(x => { if (plan.arch.includes(String(x.n))) x.arch = true; }); insSave(); histLog("VERSIONS", "ARCHIVÉES", plan.arch.join(", ")); }
      ETP_SEL[k].clear();
      svToast("FAIT : " + [plan.del.length && plan.del.length + " SUPPRIMÉ(S)", plan.xp.length && plan.xp.length + " EXPIRÉ(S)", plan.arch.length && plan.arch.length + " ARCHIVÉ(S)"].filter(Boolean).join(", ") + ".", 3500);
      if (goRoot) { window.__sviAvRet = null; window.__sviAvOpen(goRoot); return; }
      if (k === "av" || k === "rcl") { window.__sviAvRet = window.__sviAvRet || null; window.__sviAvOpen(ref); return; }
      try { refreshAll(); } catch (e) {} shell.__etpSync();
    };
    /* v771 : FERMER de la fenêtre de SÉLECTION — retour à l'onglet d'origine, bloc remis à l'écran */
    shell.__etpTabSet = k => { if (!["av", "scn", "ver", "rcl"].includes(k)) return; etpTab = k; try { localStorage.setItem(ETP_K, k); } catch (e) {} etpSync();
      const blk = shell.querySelector(".blk-etp"); if (blk && !blk.hidden) { const r = blk.getBoundingClientRect(); if (r.top < 0 || r.top > window.innerHeight - 80) blk.scrollIntoView({ block: "center" }); } };
    shell.querySelector(".blk-etp .etp-tabs")?.addEventListener("click", e => {
      const b = e.target.closest("[data-etab]"); if (!b) return;
      e.stopPropagation();
      if (b.classList.contains("off")) { svToast(b.dataset.why || "", 3500, b); return; }
      etpTab = b.dataset.etab;
      try { localStorage.setItem(ETP_K, etpTab); } catch (err) {}
      document.getElementById("blkMenu")?.remove();
      etpSync();
    });
    /* COMPARER et CRÉER (menu ⋯ du bloc) */
    shell.__etpAct = (k, act) => {
      if (act === "cmp") { if (shell.__cmpMulti) shell.__cmpMulti(k); else if (shell.__cmpPick) shell.__cmpPick(); return; }
      /* v758 : IMPORTER = l'élément est créé (avenant, scénario, recalage), puis la fenêtre d'import unique s'ouvre sur lui (TOUT coché) */
      if (act === "import") {
        if (k === "av") { const S = sviAvStages(etpRoot()), last = S[S.length - 1];
          if (!last || last.state !== "valide") { svToast("LE DERNIER AVENANT (OU LE BUDGET INITIAL) DOIT ÊTRE VALIDÉ AVANT D'AJOUTER UN AVENANT.", 4000); return; }
          window.__sviImpNext = { k: "av", t: Date.now() }; window.__sviAvNew && window.__sviAvNew(etpRoot(), ref); return; }
        if (k === "scn") { const r = $("scnTable") && $("scnTable").querySelector("tr[data-scnadd]");
          if (!r) { svToast(window.__sviRO || "IMPORTER : BUDGET EN LECTURE SEULE.", 3500); return; }
          if (r.classList.contains("off")) { svToast(r.textContent.trim(), 3500); return; }
          const before = new Set(((INS.ver || {}).L || []).map(x => x.id)), prevAct = (INS.ver || {}).act; r.click();
          const nw = ((INS.ver || {}).L || []).filter(x => x.kind === "sc" && !before.has(x.id)).pop();
          if (!nw) return;
          if (shell.__scnSwap) shell.__scnSwap(nw.id);
          setTimeout(() => shell.__impMenu && shell.__impMenu("budget", "NOUVEAU SCÉNARIO — " + nw.nom, () => shell.__scnUndoNew && shell.__scnUndoNew(nw.id, prevAct)), 200); return; }
        if (k === "rcl") { window.__sviImpNext = { k: "rcl", t: Date.now() }; if (shell.__rclNew) shell.__rclNew(); return; }
        return;
      }
      if (act !== "new") return;
      if (k === "av") { const S = sviAvStages(etpRoot()), last = S[S.length - 1];
        if (!last || last.state !== "valide") { svToast("LE DERNIER AVENANT (OU LE BUDGET INITIAL) DOIT ÊTRE VALIDÉ AVANT D'AJOUTER UN AVENANT.", 4000); return; }
        window.__sviAvNew && window.__sviAvNew(etpRoot(), ref); return; }
      if (k === "scn") { const r = $("scnTable") && $("scnTable").querySelector("tr[data-scnadd]");
        if (!r) { svToast(window.__sviRO || "CRÉER UN SCÉNARIO : BUDGET EN LECTURE SEULE.", 3500); return; }
        if (r.classList.contains("off")) { svToast(r.textContent.trim(), 3500); return; }
        r.click(); return; }
      if (k === "ver") { if (shell.__verTake) shell.__verTake(); return; }
      if (k === "rcl") { if (shell.__rclNew) shell.__rclNew(); return; }
    };
    shell.__etpSync();
    /* v758 : avenant ou recalage créé par IMPORTER — la fenêtre d'import s'ouvre sur lui dès son ouverture */
    { const N = window.__sviImpNext;
      if (N && Date.now() - N.t < 120000 && bi && !bi.virtual && (bi.state || "instance") === "instance" && ((N.k === "av" && bi.parent) || (N.k === "rcl" && bi.rclOf))) {
        window.__sviImpNext = null;
        setTimeout(() => shell.__impMenu && shell.__impMenu("budget", (N.k === "av" ? "NOUVEL AVENANT — " : "NOUVEAU RECALAGE — ") + ref), 400);
      } }
    /* v771 : avenant ou recalage créé par CUMULER — le cumul y est versé dès son ouverture */
    { const N = window.__sviCumNext;
      if (N && Date.now() - N.t < 120000 && bi && !bi.virtual && (bi.state || "instance") === "instance" && ((N.k === "av" && bi.parent) || (N.k === "rcl" && bi.rclOf)) && window.__sviCumApply) {
        window.__sviCumNext = null;
        try { window.__sviCumApply(INS, N.d, N.k === "rcl"); insSave(); histLog(N.k === "av" ? "AVENANT" : "RECALAGE", "CUMUL", N.why || ""); } catch (e) {}
        setTimeout(() => { try { refreshAll(); } catch (e) {} svToast("CUMUL ENREGISTRÉ DANS " + (N.k === "av" ? "LE NOUVEL AVENANT " : "LE NOUVEAU RECALAGE ") + ref + (N.k === "rcl" ? " (DÉSIGNATIONS CLIENT ET RÉALISÉ GARDÉS)" : "") + ".", 4500); }, 300);
      } }
    /* point 1 : ouvert depuis la liste = le budget lui-même — le scénario RETENU s'il y en a un (la dernière vue, elle, reste celle qu'on avait) */
    if (window.__sviFromList === ref) {
      window.__sviFromList = null;
      const V = INS && INS.ver, r = V && (V.L || []).find(x => x.kind === "sc" && x.ret && !x.arch);
      if (r && r.id !== V.act && shell.__scnSwap) setTimeout(() => { try { shell.__scnSwap(r.id); } catch (e) {} }, 0);
    }
  }
}
