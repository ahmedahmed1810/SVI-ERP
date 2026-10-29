    /* =========================================================
       v670 (AXES 1 ET 4) : VERSIONS, AVENANTS ET SCÉNARIOS (menu ⋯ du haut : VERSIONS ET SCÉNARIOS).
       Un seul mécanisme : des copies complètes du budget (INS.ver.L[i].d), une seule ACTIVE (le budget à l'écran).
       - SCÉNARIO : variante du même projet (deux ingénieurs, deux approvisionnements…) ; on BASCULE de l'un à l'autre (l'actif
         est gardé avant), on compare dans un tableau (indicateurs en lignes, au choix ; scénarios en colonnes) et RETENIR
         le fait devenir le budget de référence, les autres sont archivés (lecture seule, consultables). Case OFFERT AU CLIENT
         pour les variantes ; on retient celle qu'il accepte.
       - AVENANT : NOUVEL AVENANT fige l'état actuel (MARCHÉ INITIAL, puis AVENANT 1, 2…) ; le budget continue sur l'avenant.
         Origine de chaque ligne = la première étape qui la contient ; QUANTITÉS AUGMENTÉES sur une ligne existante (tolérées par la
         commande initiale) distinguées des LIGNES NOUVELLES (avenant contractuel). Budget consolidé : pas de premier entré
         premier sorti, le réalisé se comparera au total.
       ========================================================= */
    const VER_IND = [["fin", "DATE DE FIN"], ["dur", "DURÉE (J CALENDAIRES)"], ["but", "MARGE SUR LA DATE BUTOIR (J)"], ["eff", "EFFECTIF MAXIMUM (J-H / JOUR)"],
      ["effT", "EFFECTIF MAXIMUM PAR TYPE D'OUVRIER"], ["mo", "COÛT DE LA MAIN-D'ŒUVRE (DH)"], ["chg", "CHARGES (DH)"], ["prd", "PRODUITS (DH)"], ["mg", "MARGE (DH)"], ["mgp", "MARGE (%)"], ["lots", "LOTS"]];
    const verSnap = () => { const o = JSON.parse(JSON.stringify(INS)); delete o.ver; delete o.vfz; return o; };
    const verLoad = snap => { const keep = INS.ver, kf = INS.vfz; Object.keys(INS).forEach(k => { delete INS[k]; }); Object.assign(INS, JSON.parse(JSON.stringify(snap))); INS.ver = keep; if (kf) INS.vfz = kf; };
    /* indicateurs d'un état du budget */
    const verInd = d => {
      const n = v => num(v || 0);
      const per = {}; Object.keys(d.dlp || {}).forEach(k => (d.dlp[k] || []).forEach(p => { if (p.deb) (per[k] = per[k] || []).push([p.deb, p.fin || p.deb]); }));
      const all = Object.values(per).flat(), deb = all.map(x => x[0]).sort()[0] || "", fin = all.map(x => x[1]).sort().pop() || "";
      const day = {}, dayT = {}, seen = new Set();
      (d.links || []).forEach(l => (l.chg || []).forEach(c => {
        if (seen.has(c.id)) return; const r = (d.chg || []).find(y => y.id === c.id); if (!r || r.t || !dlyIsLab(r)) return; seen.add(c.id);
        const P = per[l.lot + "|" + l.sec]; if (!P) return;
        const days = []; P.forEach(([a, b]) => { for (let t = new Date(a + "T12:00:00"); sviIsoOf(t) <= b && days.length < 3000; t.setDate(t.getDate() + 1)) days.push(sviIsoOf(t)); });
        const q = n(r.q) * (/^(H|HR|HEURE|HEURES)$/.test(U_(r.u)) ? 1 / 8 : 1);
        days.forEach(x => { day[x] = (day[x] || 0) + q / days.length; const T = dayT[U_(r.des)] = dayT[U_(r.des)] || {}; T[x] = (T[x] || 0) + q / days.length; });
      }));
      const chg = (d.chg || []).filter(r => !r.t).reduce((t, r) => t + n(r.q) * n(r.p), 0);
      const mo = (d.chg || []).filter(r => !r.t && dlyIsLab(r)).reduce((t, r) => t + n(r.q) * n(r.p), 0);
      const prd = (d.des || []).filter(r => !r.t).reduce((t, r) => t + (insLinkedQ(d, r.id) ?? n(r.q)) * n(r.p), 0);
      const mx = o => Math.max(0, ...Object.values(o));
      const but = d.dbut && fin ? Math.round((new Date(d.dbut + "T12:00:00") - new Date(fin + "T12:00:00")) / 864e5) : null;
      return { fin, dur: deb && fin ? Math.round((new Date(fin + "T12:00:00") - new Date(deb + "T12:00:00")) / 864e5) + 1 : null, but, eff: mx(day),
        effT: Object.keys(dayT).sort().map(k => k + " " + String(Math.round(mx(dayT[k]) * 10) / 10).replace(".", ",")).join(" · "),
        mo, chg, prd, mg: prd - chg, mgp: prd ? (prd - chg) / prd * 100 : null, lots: (d.lot || []).filter(r => !r.t).length };
    };
    const verFmt = (k, v) => v === null || v === undefined || v === "" ? "—" : k === "fin" ? dFr(v) : k === "effT" ? v : k === "mgp" ? String(Math.round(v * 10) / 10).replace(".", ",") + " %" : k === "eff" ? String(Math.round(v * 10) / 10).replace(".", ",") : ["mo", "chg", "prd", "mg"].includes(k) ? money(v) : String(v);
    /* v681 : origine des lignes = l'étape du budget (MARCHÉ INITIAL, AVENANT n) ; dans GLOBAL, les étapes d'où vient la ligne */
    const verOrig = () => {
      const st = budget.inst ? sviAvName(budget.inst) : "MARCHÉ INITIAL";
      const O = { des: {}, chg: {}, prd: {} };
      ["des", "chg", "prd"].forEach(k => (INS[k] || []).forEach(r => { O[k][r.id] = Array.isArray(r.__o) && r.__o.length ? r.__o.join(" + ") : st; }));
      return O;
    };
    /* v681 : VERSIONS ET SCÉNARIOS — scénarios de cette étape ; DÉSARCHIVER ; un archivé reste en lecture seule ;
       tableau des étapes (marché initial, avenants) avec une dernière colonne GLOBAL ; lignes = indicateurs de la liste commune */
    const verWin = () => {
      INS.ver = INS.ver || { L: [], ind: [] };
      const V = INS.ver; V.L = (V.L || []).filter(x => x.kind === "sc"); V.ind = V.ind || [];
      const ed = !!INS && (budget.inst.state || "instance") === "instance" && !budget.inst.virtual;   /* les boutons restent actifs sur un scénario archivé affiché */
      if (!V.act) { const id = insId(); V.L.push({ id, kind: "sc", nom: "SCÉNARIO 1", date: localDT(new Date()) }); V.act = id; }
      const d = sviWinNew();
      const reopenBudget = () => { d.remove(); openBudgetDetail(ref); setTimeout(() => { try { shell.__verWin && shell.__verWin(); } catch (e) {} }, 300); };
      const draw = () => {
        const SC = V.L.filter(x => x.kind === "sc");
        const LIB = indLoad(); V.ind = V.ind.filter(k => LIB.some(I => I.id === k));
        const ST = SC.map(x => x.id === V.act ? INS : x.d || null), EL = ST.map(s2 => s2 ? indEls(s2) : null);
        /* étapes : marché initial, avenants, puis GLOBAL */
        const STG = budget.inst && !budget.inst.virtual ? sviAvStages(budget.inst.ref) : [];
        const root = STG[0], cols = STG.map(st => ({ nom: sviAvName(st), ref: st.ref, state: st.state, d: st.ref === budget.inst.ref ? INS : sviBudgetData(JSON.parse(JSON.stringify(st))) }));
        if (root) cols.push({ nom: "GLOBAL", ref: "", state: "", d: sviAvMerge(root.ref, true) });
        const CE = cols.map(c => c.d ? indEls(c.d) : null);
        /* v682 : versions de cette étape = photos prises à chaque FIGER et à la VALIDATION, en lecture seule */
        const VF = budget.inst && budget.inst.virtual ? [] : (INS.vfz || []), VE = VF.map(x => x.d ? indEls(x.d) : null);
        const indRows = (vals, cls) => V.ind.map(k => { const IN = LIB.find(I => I.id === k); return `<tr><td><b>${esc(IN.nom)}</b> ${ed && cls === "sc" ? `<button type="button" class="cmp-del" data-irm="${esc(k)}">✕</button>` : ""}</td>${vals(IN)}</tr>`; }).join("");
        const stLab = s2 => s2 === "valide" ? "VALIDÉ" : s2 === "fige" ? "FIGÉ" : s2 ? "EN INSTANCE" : "CONSOLIDÉ";
        d.innerHTML = sviWinCard({ cls: "cmp-card svc-full", close: "data-x", title: "VERSIONS ET SCÉNARIOS — " + esc(budget.inst ? sviAvName(budget.inst) : ""),
          body: `<div class="fz-blk">SCÉNARIOS ${svCnt(SC.length)}</div>
            <div class="cmp-bar">${ed ? `<button type="button" class="svc-b" data-new>+ NOUVEAU SCÉNARIO (COPIE DE L'ACTIF)</button>` : ""}</div>
            <div class="cmp-scroll"><table class="cmp-t ver-t"><thead><tr><th>INDICATEUR</th>${SC.map(x => `<th class="${x.id === V.act ? "ver-act" : ""}${x.arch ? " ver-arch" : ""}">${ed && !x.arch ? `<input class="cmp-nm ver-nm" data-id="${x.id}" value="${esc(x.nom)}">` : esc(x.nom)}<br><small>${x.id === V.act ? (x.arch ? "ACTIF — ARCHIVÉ (LECTURE SEULE)" : "ACTIF") : x.arch ? "ARCHIVÉ" : "EN RÉSERVE"}</small></th>`).join("")}</tr></thead><tbody>
              ${indRows(IN => ST.map((s2, j) => `<td class="r${SC[j].id === V.act ? " ver-act" : ""}">${s2 ? esc(indCalc(IN, s2, EL[j]).txt) : "—"}</td>`).join(""), "sc")}
              <tr class="ver-plus"><td colspan="${SC.length + 1}">${ed ? `<button type="button" class="svc-b ver-ip" data-ip>+</button> <span class="cmp-leg">INDICATEUR DE LA LISTE OU NOUVEL INDICATEUR</span>` : ""}</td></tr>
              <tr><td><b>OFFERT AU CLIENT</b></td>${SC.map(x => `<td class="c"><input type="checkbox" class="ver-of" data-id="${x.id}"${x.of ? " checked" : ""}${ed && !x.arch ? "" : " disabled"}></td>`).join("")}</tr>
              ${ed ? `<tr><td></td>${SC.map(x => `<td class="c ver-acts">${x.id === V.act ? "" : `<button type="button" class="svc-b" data-sw="${x.id}">BASCULER</button>`}${x.arch ? `<button type="button" class="svc-b" data-unarch="${x.id}">DÉSARCHIVER</button>` : `<button type="button" class="svc-b svc-ok" data-keep="${x.id}">RETENIR</button>`}${x.id === V.act ? "" : `<button type="button" class="cmp-del" data-del="${x.id}">✕</button>`}</td>`).join("")}</tr>` : ""}
            </tbody></table></div>
            <div class="fz-blk">VERSIONS ${svCnt(VF.length)}</div>
            ${VF.length ? `<div class="cmp-scroll ver-vf"><table class="cmp-t ver-t"><thead><tr><th>INDICATEUR</th>${VF.map(x => `<th class="ver-arch">VERSION ${x.n}<br><small>${esc(x.kind)} LE ${esc(dFr(String(x.date || "").slice(0, 10)) + " " + String(x.date || "").slice(11, 16))}</small></th>`).join("")}</tr></thead><tbody>
              ${indRows(IN => VF.map((x, j) => `<td class="r">${x.d ? esc(indCalc(IN, x.d, VE[j]).txt) : "—"}</td>`).join(""), "vf") || `<tr><td colspan="${VF.length + 1}" class="empty">AJOUTER DES INDICATEURS PAR LA LIGNE « + » DES SCÉNARIOS</td></tr>`}
              <tr><td></td>${VF.map(x => `<td class="c ver-acts"><button type="button" class="svc-b" data-vfo="${x.n}">VOIR</button></td>`).join("")}</tr>
            </tbody></table></div>` : `<div class="cmp-leg">AUCUNE VERSION : UNE VERSION EST PRISE À CHAQUE FIGER ET À LA VALIDATION.</div>`}
            ${root ? `<div class="fz-blk">MARCHÉ INITIAL ET AVENANTS ${svCnt(STG.length - 1)}</div>
            <div class="cmp-scroll ver-av"><table class="cmp-t ver-t"><thead><tr><th>INDICATEUR</th>${cols.map(c => `<th class="${c.ref === budget.inst.ref ? "ver-act" : ""}">${esc(c.nom)}<br><small>${esc(c.ref ? c.ref + " · " + stLab(c.state) : "MARCHÉ + AVENANTS")}</small></th>`).join("")}</tr></thead><tbody>
              ${indRows(IN => cols.map((c, j) => `<td class="r${c.ref === budget.inst.ref ? " ver-act" : ""}">${c.d ? esc(indCalc(IN, c.d, CE[j]).txt) : "—"}</td>`).join(""), "av") || `<tr><td colspan="${cols.length + 1}" class="empty">AJOUTER DES INDICATEURS PAR LA LIGNE « + » DES SCÉNARIOS</td></tr>`}
            </tbody></table></div>
            <div class="cmp-leg">UN AVENANT EST UN BUDGET À PART (RÉF. ${esc(root.ref)}-AV1…) : LE PREMIER S'AJOUTE PAR LE MENU ⋯ DU BUDGET, UNE FOIS LE MARCHÉ INITIAL VALIDÉ ; LES SUIVANTS PAR LE + DU CONSOLIDÉ (« AVENANTS : »).</div>` : ""}`,
          foot: `<button type="button" class="svc-b svc-ok svc-neutral" data-x>FERMER</button>` });
      };
      const save = (what, det) => { insSave(); histLog("VERSIONS", what, det); };
      draw(); sviWinShow(d);
      const archOf = () => { const x = V.L.find(y => y.id === V.act); return !!(x && x.arch); };
      d.addEventListener("change", e => {
        const t = e.target;
        if (t.classList.contains("ver-nm")) { const x = V.L.find(y => y.id === t.dataset.id); if (x) { x.nom = t.value.trim().toUpperCase() || x.nom; save("SCÉNARIO RENOMMÉ", x.nom); } return; }
        if (t.classList.contains("ver-of")) { const x = V.L.find(y => y.id === t.dataset.id); if (x) { x.of = t.checked; save(t.checked ? "OFFERT AU CLIENT" : "RETIRÉ DES OFFRES", x.nom); } }
      });
      d.addEventListener("click", async e => {
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); refreshAll(); return; }
        /* v679 : ligne « + » — indicateur de la liste, ou NOUVEL INDICATEUR (fenêtre de calcul, puis ajouté au tableau) */
        const ip = e.target.closest("[data-ip]");
        if (ip) { indPlusMenu(ip, V.ind, id => { V.ind.push(id); save("INDICATEUR AJOUTÉ", (indLoad().find(I => I.id === id) || {}).nom || id); draw(); },
          w => { if (w === "new") { d.remove(); indDesignWin(null, I => { if (I) { V.ind.push(I.id); save("INDICATEUR AJOUTÉ", I.nom); } verWin(); }); } else if (w === "list") { d.remove(); indWin(() => verWin()); } }); return; }
        const vo = e.target.closest("[data-vfo]"); if (vo) { d.remove(); window.__sviAvOpen(budget.inst.ref + "-V" + vo.dataset.vfo); return; }
        const ir = e.target.closest("[data-irm]"); if (ir) { V.ind = V.ind.filter(k => k !== ir.dataset.irm); save("INDICATEUR RETIRÉ", ir.dataset.irm); draw(); return; }
        /* v681 : premier numéro libre */
        if (e.target.closest("[data-new]")) { const used = new Set(V.L.map(x => (String(x.nom).match(/^SCÉNARIO (\d+)$/) || [])[1]).filter(Boolean).map(Number)); let n = 1; while (used.has(n)) n++;
          V.L.push({ id: insId(), kind: "sc", nom: "SCÉNARIO " + n, date: localDT(new Date()), d: verSnap() }); save("NOUVEAU SCÉNARIO", "SCÉNARIO " + n); draw(); return; }
        const sw = e.target.closest("[data-sw]");
        if (sw) {
          const x = V.L.find(y => y.id === sw.dataset.sw), cur = V.L.find(y => y.id === V.act);
          if (!x || !x.d) return;
          const was = archOf();
          if (cur) cur.d = verSnap();
          verLoad(x.d); delete x.d; V.act = x.id; save("BASCULE", x.nom + (x.arch ? " (ARCHIVÉ : LECTURE SEULE)" : ""));
          if (was !== archOf()) { reopenBudget(); return; }   /* lecture seule mise ou levée */
          refreshAll(); draw(); return;
        }
        const ua = e.target.closest("[data-unarch]");
        if (ua) {
          const x = V.L.find(y => y.id === ua.dataset.unarch);
          d.remove();
          if (!(await svConfirm({ title: "DÉSARCHIVER " + x.nom, text: x.nom + " REPASSE EN RÉSERVE : IL REDEVIENT MODIFIABLE ET PEUT ÊTRE RETENU.", ok: "DÉSARCHIVER", tone: "neutral" }))) { sviWinShow(d); draw(); return; }
          const was = archOf(); x.arch = false; save("SCÉNARIO DÉSARCHIVÉ", x.nom);
          if (was !== archOf()) { reopenBudget(); return; }
          sviWinShow(d); draw(); return;
        }
        const kp = e.target.closest("[data-keep]");
        if (kp) {
          const x = V.L.find(y => y.id === kp.dataset.keep);
          d.remove();
          if (!(await svConfirm({ title: "RETENIR " + x.nom, text: x.nom + " DEVIENT LE BUDGET DE RÉFÉRENCE ; LES AUTRES SCÉNARIOS SONT ARCHIVÉS (CONSULTABLES, EN LECTURE SEULE).", ok: "RETENIR", tone: "neutral" }))) { sviWinShow(d); draw(); return; }
          const was = archOf();
          if (x.id !== V.act) { const cur = V.L.find(y => y.id === V.act); if (cur) cur.d = verSnap(); verLoad(x.d); delete x.d; V.act = x.id; }
          V.L.forEach(y => { if (y.kind === "sc") y.arch = y.id !== x.id; }); x.ret = true;
          save("SCÉNARIO RETENU", x.nom);
          if (was !== archOf()) { reopenBudget(); return; }
          refreshAll(); sviWinShow(d); draw(); return;
        }
        const dl = e.target.closest("[data-del]");
        if (dl) { const x = V.L.find(y => y.id === dl.dataset.del); d.remove(); if (await svConfirm({ title: "SUPPRIMER " + x.nom, text: "CE SCÉNARIO ET SES DONNÉES SERONT SUPPRIMÉS.", ok: "SUPPRIMER" })) { V.L = V.L.filter(y => y !== x); save("SCÉNARIO SUPPRIMÉ", x.nom); } sviWinShow(d); draw(); return; }
      });
    };
    shell.__verWin = () => verWin();
    /* v682 : photo de l'étape (VERSION n) prise à FIGER et à VALIDER */
    shell.__verFreeze = kind => {
      if (!INS || !budget.inst || budget.inst.virtual) return;
      INS.vfz = INS.vfz || [];
      const n = INS.vfz.reduce((m, x) => Math.max(m, x.n || 0), 0) + 1;
      INS.vfz.push({ id: insId(), n, kind, date: localDT(new Date()), d: verSnap() });
      insSave(); histLog("VERSIONS", "VERSION " + n, kind);
    };
    shell.__verOrig = () => verOrig();
