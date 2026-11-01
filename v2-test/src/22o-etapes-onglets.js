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
      const ETP_LAB = { av: "AVENANTS", scn: "SCÉNARIOS", ver: "VERSIONS", rcl: "RECALAGES" };
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
        if (bi.virtual) return "CONSOLIDÉ : " + ETP_LAB[k] + " SUR CHAQUE ÉTAPE (ONGLET AVENANTS › TOUCHER UNE ÉTAPE).";
        return "";
      };
      let etpTab = "";
      try { etpTab = localStorage.getItem(ETP_K) || ""; } catch (e) {}
      /* ---------- AVENANTS ---------- */
      const AV_COLS = [["avnat", "ÉTAPE", x => x.nat, ""], ["avref", "RÉFÉRENCE", x => x.r, ""], ["avint", "INTITULÉ", x => x.int, ""],
        ["avttc", "MONTANT TTC", x => x.ttc, "number"], ["avst", "ÉTAT", x => x.st, "center"], ["avdt", "VALIDÉ LE", x => x.val, ""]];
      let avShown = [];
      const avRows = () => {
        const root = etpRoot(); if (!root) return [];
        return sviAvStages(root).map(st => {
          let bd = {}; try { bd = budgetData({ ref: st.ref, project: st.project, rows: [], first: {}, inst: st, __noFam: true }); } catch (e) {}
          const s0 = st.state === "valide" ? "VALIDÉ" : st.state === "fige" ? "FIGÉ" : "EN INSTANCE";
          return { ref: st.ref, cls: st.xp ? "expire" : st.state || "instance", nat: st.parent ? "AVENANT " + (st.avn || 1) : "BUDGET INITIAL", r: U_(st.project || "") + " " + st.ref, int: st.intitule || "",
            ttc: Math.round((bd.ttc || 0) * 100) / 100, st: st.xp ? s0 + " — EXPIRÉ" : s0, val: st.state === "valide" ? svDT(st.validated || "") : "" };
        });
      };
      shell.__avData = () => { const oc = coOrder("vav", AV_COLS); return { head: oc.map(c => c[1]), rows: avShown.map(x => oc.map(c => c[0] === "avttc" ? money(c[2](x)) : c[2](x))) }; };
      const avRender = () => {
        const t = $("avTable"), pane = shell.querySelector(".blk-etp .blk-av"); if (!t || !pane) return;
        const all = avRows(); pane.hidden = !all.length;
        const ttl = $("avTitle");
        if (!all.length) { if (ttl) ttl.innerHTML = "AVENANTS " + svCnt(0); t.innerHTML = ""; return; }
        const rows = cfApply("vav", AV_COLS, all); avShown = rows;
        if (ttl) ttl.innerHTML = "AVENANTS " + svCnt(rows.filter(x => x.nat !== "BUDGET INITIAL").length);
        const oc = coOrder("vav", AV_COLS), S = sviAvStages(etpRoot()), last = S[S.length - 1], ok = !!last && last.state === "valide";
        t.style.width = cwTableW("vav", AV_COLS) + "px";
        t.innerHTML = `<colgroup>${cwCols("vav", oc)}</colgroup><thead><tr>${oc.map(c => cfHead("vav", c[0], c[1], c[3])).join("")}</tr></thead>
          <tbody>${rows.map(x => `<tr class="av-row st-${x.cls}${x.ref === ref ? " ver-act" : ""}" data-avr="${esc(x.ref)}">${oc.map(c => `<td class="${c[3]}">${esc(c[0] === "avttc" ? money(c[2](x)) : c[2](x))}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${oc.length}" class="empty">AUCUNE LIGNE (FILTRE)</td></tr>`}
          <tr class="scn-new${ok ? "" : " off"}" data-avadd${ok ? "" : ` data-why="LE DERNIER AVENANT (OU LE BUDGET INITIAL) DOIT ÊTRE VALIDÉ AVANT D'AJOUTER UN AVENANT."`}><td colspan="${oc.length}">CRÉER UN AVENANT ICI…</td></tr></tbody>`;
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
          if (x.dataset.act === "new") x.title = ETP_NEW[etpTab];
        });
      };
      let etpQ = false;
      shell.__etpLater = () => { if (etpQ) return; etpQ = true; queueMicrotask(() => { etpQ = false; try { etpSync(); } catch (e) {} }); };
      shell.__etpSync = etpSync;
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
      etpSync();
      /* point 1 : ouvert depuis la liste = le budget lui-même — le scénario RETENU s'il y en a un (la dernière vue, elle, reste celle qu'on avait) */
      if (window.__sviFromList === ref) {
        window.__sviFromList = null;
        const V = INS && INS.ver, r = V && (V.L || []).find(x => x.kind === "sc" && x.ret && !x.arch);
        if (r && r.id !== V.act && shell.__scnSwap) setTimeout(() => { try { shell.__scnSwap(r.id); } catch (e) {} }, 0);
      }
    }
