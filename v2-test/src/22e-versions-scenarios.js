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
      const st = budget.inst ? sviAvName(budget.inst) : "BUDGET INITIAL";
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
        if (e.target.closest("[data-new]")) { if (V.L.filter(x => x.kind === "sc").length >= 10) { svToast("10 SCÉNARIOS AU PLUS PAR ÉTAPE.", 3500); return; } const used = new Set(V.L.map(x => (String(x.nom).match(/^SCÉNARIO (\d+)$/) || [])[1]).filter(Boolean).map(Number)); let n = 1; while (used.has(n)) n++;
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
    /* v690 : versions automatiques (Ⓐ) à FIGER et VALIDER — pas de nouvelle photo si rien n'a changé depuis la dernière ;
       version MANUELLE par PRENDRE UNE VERSION (menu ⋯ du haut) ; aucune limite, jamais effacées */
    shell.__verFreeze = (kind, auto = true) => {
      if (!INS || !budget.inst || budget.inst.virtual) return 0;
      INS.vfz = INS.vfz || [];
      const snap = verSnap(), last = INS.vfz[INS.vfz.length - 1];
      if (auto && last && JSON.stringify(last.d) === JSON.stringify(snap)) return 0;
      const n = INS.vfz.reduce((m, x) => Math.max(m, x.n || 0), 0) + 1;
      INS.vfz.push({ id: insId(), n, kind, auto: !!auto, u: typeof sviUser === "function" ? sviUser() : "", date: localDT(new Date()), d: snap });
      insSave(); histLog("VERSIONS", "VERSION " + n + (auto ? " (AUTOMATIQUE)" : ""), kind);
      try { verRender(); } catch (e) {}
      return n;
    };
    shell.__verTake = () => {
      if (!INS || !budget.inst || budget.inst.virtual) { svToast("PRENDRE UNE VERSION : SUR UNE ÉTAPE SEULEMENT.", 3500); return; }
      const n = shell.__verFreeze("MANUELLE", false);
      if (n) { svToast("VERSION " + n + " PRISE.", 2500); setTimeout(() => { const b = shell.querySelector(".blk-ver"); if (b && !b.hidden) b.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, 60); }
    };
    /* bloc VERSIONS (sous SCÉNARIOS) : une ligne par version ; toucher = la photo ouverte en lecture seule */
    const VER_COLS = [["vno", "VERSION", x => "VERSION " + x.n, ""], ["vkind", "NATURE", x => x.kind || "", ""], ["vdate", "PRISE LE", x => svDT(x.date || ""), ""], ["vuser", "PAR", x => x.u || "", ""]];
    let verShown = [];
    shell.__verData = () => { const oc = coOrder("vver", VER_COLS); return { head: oc.map(c => c[1]), rows: verShown.map(x => oc.map(c => c[2](x) + (c[0] === "vno" && x.auto ? " (A)" : ""))) }; };
    const verRender = () => {
      const blk = shell.querySelector(".blk-ver"), t = $("verTable");
      if (!blk || !t) return;
      const VF = INS && budget.inst && !budget.inst.virtual ? (INS.vfz || []) : [];
      blk.hidden = !VF.length;
      if (blk.hidden) return;
      const all = [...VF].sort((a, b) => (b.n || 0) - (a.n || 0)), rows = cfApply("vver", VER_COLS, all);
      verShown = rows;
      const ttl = $("verTitle"); if (ttl) ttl.innerHTML = SVI_ICON.ver + "VERSIONS " + svCnt(rows.length, all.length);
      const oc = coOrder("vver", VER_COLS);
      t.style.width = cwTableW("vver", VER_COLS) + "px";
      t.innerHTML = `<colgroup>${cwCols("vver", oc)}</colgroup><thead><tr>${oc.map(c => cfHead("vver", c[0], c[1], c[3])).join("")}</tr></thead>
        <tbody>${rows.map(x => `<tr class="ver-row" data-vn="${x.n}">${oc.map(c => `<td>${esc(c[2](x))}${c[0] === "vno" && x.auto ? ' <span class="auto-a" title="Créée automatiquement">Ⓐ</span>' : ""}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${oc.length}" class="empty">AUCUNE LIGNE (FILTRE)</td></tr>`}</tbody>`;
    };
    shell.__verRender = verRender;
    shell.querySelector(".blk-ver")?.addEventListener("click", e => {
      if (e.target.closest(".cf-btn, .col-rs, .blk-tools, .blk-grip, .blk-rsz")) return;
      const tr = e.target.closest("tr[data-vn]"); if (!tr) return;
      e.stopPropagation();
      window.__sviAvOpen(budget.inst.ref + "-V" + tr.dataset.vn, budget.inst.ref);
    });
    /* depuis une version ouverte : RESTAURER CETTE VERSION et EN FAIRE UN SCÉNARIO */
    {
      /* v694 : actions dans le menu ⋯ de la version (plus de bande à l'écran) */
      if (budget.inst && budget.inst.virtual && budget.inst.vname) {
        const pref = budget.inst.parent, vn = +((String(ref).match(/-V(\d+)$/) || [])[1] || 0);
        const L0 = () => sviInstGet(), par = () => L0().find(x => x.ref === pref);
        const vData = () => { const p = par(); const v = p && ((p.data || {}).vfz || []).find(x => x.n === vn); return v ? JSON.parse(JSON.stringify(v.d)) : null; };
        const hist = (r, a, d) => { try { const k = "svi_hist_v1:" + r, l = JSON.parse(localStorage.getItem(k) || "[]") || []; l.push({ t: new Date().toISOString(), b: "VERSIONS", a, d: String(d || "").toUpperCase(), u: typeof sviUser === "function" ? sviUser() : "" }); localStorage.setItem(k, JSON.stringify(l.slice(-1000))); } catch (e) {} };
        shell.__verAct = async act => {
          const b = undefined;
          const p = par(), d0 = vData();
          if (!p || !d0) { sviAlert("VERSION INTROUVABLE.", "VERSION"); return; }
          const D = p.data = p.data || {};
          if (act === "restore") {
            if ((p.state || "instance") !== "instance") { svToast("RESTAURER : L'ÉTAPE DOIT ÊTRE EN INSTANCE (" + (p.state === "valide" ? "VALIDÉE" : "FIGÉE") + " ACTUELLEMENT).", 4500, b); return; }
            if (!(await svConfirm({ title: "RESTAURER LA VERSION " + vn, text: "L'ÉTAPE " + pref + " REPREND L'ÉTAT DE LA VERSION " + vn + ". UNE VERSION AUTOMATIQUE DE L'ÉTAT ACTUEL EST PRISE AVANT.", ok: "RESTAURER", tone: "neutral" }))) return;
            const cur = JSON.parse(JSON.stringify(D)); delete cur.ver; delete cur.vfz;
            D.vfz = D.vfz || [];
            const last = D.vfz[D.vfz.length - 1];
            if (!last || JSON.stringify(last.d) !== JSON.stringify(cur)) { const n = D.vfz.reduce((m, x) => Math.max(m, x.n || 0), 0) + 1; D.vfz.push({ id: "v" + Date.now().toString(36), n, kind: "AVANT RESTAURATION", auto: true, u: typeof sviUser === "function" ? sviUser() : "", date: localDT(new Date()), d: cur }); }
            const keep = { ver: D.ver, vfz: D.vfz };
            p.data = { ...d0, ...keep }; if (!keep.ver) delete p.data.ver;
            sviInstSet(L0().map(x => x.ref === pref ? p : x)); await sviInstFlush();
            hist(pref, "VERSION RESTAURÉE", "VERSION " + vn);
            window.__sviAvOpen(pref); return;
          }
          if (act === "scn") {
            const V = D.ver = D.ver || { L: [], ind: [] }; V.L = V.L || [];
            const SC = V.L.filter(x => x.kind === "sc");
            if (SC.length >= 10) { svToast("10 SCÉNARIOS AU PLUS PAR ÉTAPE.", 3500, b); return; }
            const no = () => { const used = new Set(V.L.map(x => (String(x.nom).match(/^SCÉNARIO (\d+)$/) || [])[1]).filter(Boolean).map(Number)); let n = 1; while (used.has(n)) n++; return n; };
            if (!V.act || !V.L.some(x => x.id === V.act)) { const id = "s" + Date.now().toString(36); V.L.push({ id, kind: "sc", nom: "SCÉNARIO " + no(), date: localDT(new Date()) }); V.act = id; }
            if (V.L.filter(x => x.kind === "sc").length >= 10) { svToast("10 SCÉNARIOS AU PLUS PAR ÉTAPE.", 3500, b); return; }
            const nom = "SCÉNARIO " + no();
            V.L.push({ id: "s" + Date.now().toString(36) + "b", kind: "sc", nom, date: localDT(new Date()), d: d0 });
            sviInstSet(L0().map(x => x.ref === pref ? p : x)); await sviInstFlush();
            hist(pref, "NOUVEAU SCÉNARIO", nom + " — DEPUIS LA VERSION " + vn);
            svToast(nom + " CRÉÉ DEPUIS LA VERSION " + vn + ".", 3000);
            window.__sviAvOpen(pref); return;
          }
        };
      }
    }
    shell.__verOrig = () => verOrig();

    /* =========================================================
       v685 : SCÉNARIOS HORS DU MENU ⋯ (décisions du 29/10/2026, soir, suite)
       - bouton SCN (rangée DOC / TAF / OBS / INF) : crée aussitôt un scénario, copie de l'étape telle qu'elle est,
         numéro automatique (premier libre) ; 10 au plus par étape (le scénario actif = l'étape compte) ; SCN grisé au-delà,
         appui long (ou toucher grisé) = la raison. Au premier toucher, l'étape devient SCÉNARIO 1 (actif) et la copie SCÉNARIO 2.
       - bloc SCÉNARIOS entre le détail et DOCUMENTS / TAF / OBS : absent tant qu'il n'y a pas de copie ; indicateurs en
         lignes (ligne « + »), une colonne par scénario ; nom, OFFERT AU CLIENT, BASCULER / RETENIR / DÉSARCHIVER / ✕ ;
         pas de bouton + (SCN seul crée). FORMAT des autres blocs (tri / filtre, colonnes ajustables, poignée, agrandir).
       ========================================================= */
    const SCN_MAX = 10;
    const scnL = () => ((INS && INS.ver && INS.ver.L) || []).filter(x => x.kind === "sc");
    const scnEd = () => !!INS && !!budget.inst && !budget.inst.virtual && (budget.inst.state || "instance") === "instance";
    const scnWhy = () => !budget.inst || budget.inst.virtual ? "SCÉNARIOS : SUR UNE ÉTAPE SEULEMENT (PAS SUR LE CONSOLIDÉ NI SUR UNE VERSION)."
      : !scnEd() ? "SCN : ÉTAPE " + (budget.inst.state === "valide" ? "VALIDÉE" : "FIGÉE") + ", LECTURE SEULE — REVENIR EN ÉDITION POUR CRÉER UN SCÉNARIO."
      : scnL().length >= SCN_MAX ? "SCN : " + SCN_MAX + " SCÉNARIOS AU PLUS PAR ÉTAPE — SUPPRIMER UN SCÉNARIO POUR EN CRÉER UN AUTRE." : "";
    const scnNo = V => { const used = new Set(V.L.map(x => (String(x.nom).match(/^SCÉNARIO (\d+)$/) || [])[1]).filter(Boolean).map(Number)); let n = 1; while (used.has(n)) n++; return n; };
    /* d0 : état copié (par défaut l'étape telle qu'elle est) — renvoie le nom du scénario créé, ou "" */
    const scnAdd = (d0, why) => {
      if (scnWhy()) return "";
      INS.ver = INS.ver || { L: [], ind: [] };
      const V = INS.ver; V.L = V.L || []; V.ind = V.ind || [];
      /* v688 : le premier ajout fait de l'étape SCÉNARIO 1 (actif) ; les suivants sont des copies */
      if (!V.act || !V.L.some(x => x.id === V.act)) { const id = insId(), nom = "SCÉNARIO " + scnNo(V); V.L.push({ id, kind: "sc", nom, date: localDT(new Date()) }); V.act = id; insSave(); histLog("VERSIONS", "NOUVEAU SCÉNARIO", nom + " (L'ÉTAPE TELLE QU'ELLE EST)"); return nom; }
      if (scnL().length >= SCN_MAX) return "";
      const nom = "SCÉNARIO " + scnNo(V);
      V.L.push({ id: insId(), kind: "sc", nom, date: localDT(new Date()), d: d0 ? JSON.parse(JSON.stringify(d0)) : verSnap() });
      insSave(); histLog("VERSIONS", "NOUVEAU SCÉNARIO", nom + (why ? " — " + why : ""));
      return nom;
    };
    shell.__scnAdd = scnAdd;
    const scnPill = () => {
      const p = shell.querySelector('[data-pill="scn"]'); if (!p) return;
      const off = !!scnWhy();
      p.classList.toggle("pill-off", off);
      p.innerHTML = SVI_ICON.scn + `<span class="pl">SCN ${svCnt(scnL().length)}</span>`;
    };
    {
      const p = shell.querySelector('[data-pill="scn"]');
      if (p) {
        let lt = 0, longed = false;
        const clr = () => { clearTimeout(lt); lt = 0; };
        p.addEventListener("pointerdown", () => { longed = false; clr(); lt = setTimeout(() => { longed = true; svToast(scnWhy() || "SCN : CRÉE UN SCÉNARIO, COPIE DE L'ÉTAPE TELLE QU'ELLE EST (" + SCN_MAX + " AU PLUS).", 4500, p); }, 550); });
        ["pointerup", "pointercancel", "pointerleave"].forEach(ev => p.addEventListener(ev, clr));
        p.addEventListener("click", e => {
          e.stopPropagation();
          if (longed) { longed = false; return; }
          const w = scnWhy(); if (w) { svToast(w, 4500, p); return; }
          const nom = scnAdd();
          if (!nom) return;
          refreshAll();
          svToast(nom + " CRÉÉ : COPIE DE L'ÉTAPE TELLE QU'ELLE EST.", 3000, p);
          setTimeout(() => { const b = shell.querySelector(".blk-scn"); if (b && !b.hidden) b.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, 60);
        });
      }
    }
    /* =========================================================
       v686 : bloc SCÉNARIOS en deux vues (décision du 29/10/2026), au FORMAT des autres tableaux
       - LISTE (par défaut) : une ligne par scénario — NOM, ÉTAT, OFFERT AU CLIENT, RETENIR, DÉSARCHIVER (si archivé), 🗑 ;
         toucher le NOM = basculer sur ce scénario ; appui long sur le nom = renommer ; toucher ailleurs = COMPARAISON ;
         dernière ligne « AJOUTER UN SCÉNARIO ICI… » (comme SAISIR ICI) ; SCN ajoute aussi une ligne (10 au plus).
       - COMPARAISON : indicateurs en lignes (dernière ligne « AJOUTER UN INDICATEUR ICI… »), une colonne par scénario ;
         ✕ dans l'en-tête = cacher le scénario (mémorisé) ; + après la dernière colonne = réafficher un scénario caché.
       - bouton de l'en-tête (et menu ⋯) : passer d'une vue à l'autre ; aperçu et export suivent la vue affichée.
       ========================================================= */
    let scnView = "list";
    const SCN_HID_KEY = "svi_scnhid_v1:" + ref;
    const scnHid = () => { try { return JSON.parse(localStorage.getItem(SCN_HID_KEY) || "[]") || []; } catch (e) { return []; } };
    const scnHidSet = a => { try { localStorage.setItem(SCN_HID_KEY, JSON.stringify(a)); } catch (e) {} };
    const scnSt = x => { const V = INS.ver || {}; return x.id === V.act ? (x.arch ? "ACTIF — ARCHIVÉ" : "ACTIF") : x.arch ? "ARCHIVÉ" : "EN RÉSERVE"; };
    /* vue LISTE */
    const scnListCols = () => [["scnom", "NOM", x => x.nom, ""], ["scet", "ÉTAT", x => scnSt(x), ""], ["scof", "OFFERT AU CLIENT", x => x.of ? "OUI" : "NON", "center"],
      ["scret", "RETENIR", x => x.ret && !x.arch ? "RETENU" : "", "center"], ...(scnL().some(x => x.arch) ? [["scdes", "DÉSARCHIVER", x => x.arch ? "ARCHIVÉ" : "", "center"]] : []), ["scdel", "🗑", () => "", "center"]];
    /* vue COMPARAISON : clés sc1…sc10 = position du scénario dans la liste */
    const scnCmpCols = SC => { const H = scnHid(); return [["scnind", "INDICATEUR", r => r.nom, ""], ...SC.map((x, j) => ["sc" + (j + 1), x.nom, r => r.v[j] ? (r.v[j].val ?? r.v[j].txt) : "", "number"]).filter((c, j) => !H.includes(SC[j].id))]; };
    const scnRows = SC => {
      const LIB = indLoad(), V = INS.ver || { L: [], ind: [] }; V.ind = (V.ind || []).filter(k => LIB.some(I => I.id === k));
      const ST = SC.map(x => x.id === V.act ? INS : x.d || null), EL = ST.map(s2 => s2 ? indEls(s2) : null);
      return V.ind.map(k => { const IN = LIB.find(I => I.id === k); return { k, nom: IN.nom, v: ST.map((s2, j) => s2 ? indCalc(IN, s2, EL[j]) : null) }; });
    };
    let scnShown = [];
    shell.__scnData = () => {
      const SC = scnL();
      if (scnView === "list") { const cols = coOrder("scnl", scnListCols()).filter(c => c[0] !== "scdel"); return { head: cols.map(c => c[1]), rows: scnShown.map(x => cols.map(c => c[2](x))) }; }
      const cols = coOrder("scn", scnCmpCols(SC));
      return { head: cols.map(c => c[1]), rows: scnShown.map(r => cols.map(c => c[0] === "scnind" ? r.nom : (r.v[+c[0].slice(2) - 1] || {}).txt || "—")) };
    };
    const scnViewBtn = () => {
      const b = shell.querySelector('.blk-scn .blk-btn[data-act="view"]'); if (!b) return;
      b.title = scnView === "list" ? "Comparer les scénarios" : "Liste des scénarios";
      b.innerHTML = scnView === "list"
        ? '<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3v10M6.5 3v10M10.5 3v10M14 3v10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
        : '<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4h11M2.5 8h11M2.5 12h11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    };
    const scnRender = () => {
      scnPill();
      try { verRender(); } catch (e) {}
      try { shell.__rclRender && shell.__rclRender(); } catch (e) {}
      const blk = shell.querySelector(".blk-scn"), t = $("scnTable");
      if (!blk || !t) return;
      const SC = scnL();
      blk.hidden = !INS || !budget.inst || budget.inst.virtual;   /* v688 : toujours affiché sur une étape, même vide */
      if (blk.hidden) return;
      const V = INS.ver || { L: [], ind: [] }, ed = scnEd();
      scnViewBtn();
      blk.classList.toggle("scn-cmp", scnView !== "list");
      const ttl = $("scnTitle"); if (ttl) ttl.innerHTML = SVI_ICON.scn + "SCÉNARIOS " + (scnView === "list" ? "" : "— COMPARAISON ") + svCnt(SC.length);
      if (scnView === "list") {
        const cols = scnListCols(), rows = cfApply("scnl", cols, SC);
        scnShown = rows;
        const oc = coOrder("scnl", cols);
        const td = (c, x) => {
          const k = c[0], act = x.id === V.act;
          if (k === "scnom") return `<td class="scn-nm-c"><span class="scn-nm${ed && !act ? " scn-go" : ""}" data-nm="${x.id}" title="${ed && !act ? "Toucher : basculer sur ce scénario — appui long : renommer" : ""}">${esc(x.nom)}</span></td>`;
          if (k === "scet") return `<td>${scnSt(x)}</td>`;
          if (k === "scof") return `<td class="center"><input type="checkbox" class="ver-of" data-id="${x.id}"${x.of ? " checked" : ""}${ed && !x.arch ? "" : " disabled"}></td>`;
          if (k === "scret") return `<td class="center">${x.arch ? "" : x.ret && act ? "<b>RETENU</b>" : ed ? `<button type="button" class="svc-b svc-ok" data-keep="${x.id}">RETENIR</button>` : ""}</td>`;
          if (k === "scdes") return `<td class="center">${x.arch && ed ? `<button type="button" class="svc-b" data-unarch="${x.id}">DÉSARCHIVER</button>` : ""}</td>`;
          if (k === "scdel") return `<td class="center">${ed && !act ? `<button type="button" class="scn-del" data-del="${x.id}" title="Supprimer ce scénario">🗑</button>` : ""}</td>`;
          return "<td></td>";
        };
        const full = SC.length >= SCN_MAX;
        const add = ed ? `<tr class="scn-new${full ? " off" : ""}" data-scnadd><td colspan="${oc.length}">${full ? SCN_MAX + " SCÉNARIOS AU PLUS PAR ÉTAPE" : "AJOUTER UN SCÉNARIO ICI…"}</td></tr>` : "";
        t.style.width = cwTableW("scnl", cols) + "px";
        t.innerHTML = `<colgroup>${cwCols("scnl", oc)}</colgroup><thead><tr>${oc.map(c => cfHead("scnl", c[0], c[1], c[3])).join("")}</tr></thead>
          <tbody>${rows.map(x => `<tr class="scn-row${x.id === V.act ? " ver-act" : ""}${x.arch ? " scn-arch" : ""}" data-scn="${x.id}">${oc.map(c => td(c, x)).join("")}</tr>`).join("") || (SC.length ? `<tr><td colspan="${oc.length}" class="empty">AUCUNE LIGNE (FILTRE)</td></tr>` : "")}${add}</tbody>`;
        return;
      }
      /* COMPARAISON */
      const H = scnHid().filter(id => SC.some(x => x.id === id));
      const cols = scnCmpCols(SC), all = scnRows(SC), rows = cfApply("scn", cols, all);
      scnShown = rows;
      const oc = coOrder("scn", cols);
      const scOf = c => c[0] === "scnind" ? null : SC[+c[0].slice(2) - 1];
      const head = oc.map(c => { const x = scOf(c); if (!x) return cfHead("scn", c[0], c[1]);
        return cfHead("scn", c[0], `${esc(x.nom)} <small class="scn-st">${scnSt(x)}</small>`, "number" + (x.id === V.act ? " ver-act" : "") + (x.arch ? " ver-arch" : ""))
          .replace('<span class="cf-btn"', `<span class="scn-hide" data-hide="${x.id}" role="button" title="Cacher ce scénario">✕</span><span class="cf-btn"`); }).join("");
      const plusTh = H.length ? `<th class="scn-plus-th"><button type="button" class="scn-plus" data-unhide title="Réafficher un scénario caché">+</button></th>` : "";
      const plusTd = H.length ? "<td></td>" : "";
      const body = rows.map(r => `<tr>${oc.map(c => { const x = scOf(c);
        if (!x) return `<td><b>${esc(r.nom)}</b>${ed ? ` <button type="button" class="cmp-del" data-irm="${esc(r.k)}" title="Retirer du tableau">✕</button>` : ""}</td>`;
        const v = r.v[+c[0].slice(2) - 1]; return `<td class="number${x.id === V.act ? " ver-act" : ""}">${v ? `<span class="${v.err ? "rat-err" : ""}">${esc(v.txt)}</span>` : "—"}</td>`; }).join("")}${plusTd}</tr>`).join("");
      const add = ed ? `<tr class="scn-new" data-ip><td colspan="${oc.length + (H.length ? 1 : 0)}">AJOUTER UN INDICATEUR ICI…</td></tr>` : "";
      t.style.width = (cwTableW("scn", cols) + (H.length ? 44 : 0)) + "px";
      t.innerHTML = `<colgroup>${cwCols("scn", oc)}${H.length ? '<col style="width:44px">' : ""}</colgroup><thead><tr>${head}${plusTh}</tr></thead>
        <tbody>${body || (V.ind.length ? `<tr><td colspan="${oc.length}" class="empty">AUCUNE LIGNE (FILTRE)</td></tr>` : "")}${add}</tbody>`;
    };
    shell.__scnRender = scnRender;
    shell.__scnView = () => { scnView = scnView === "list" ? "cmp" : "list"; scnRender(); };
    {
      const blk = shell.querySelector(".blk-scn");
      const V$ = () => INS.ver;
      const archOf = () => { const x = V$().L.find(y => y.id === V$().act); return !!(x && x.arch); };
      const save = (what, det) => { insSave(); histLog("VERSIONS", what, det); };
      const reopen = () => openBudgetDetail(ref);
      const swap = id => {
        const V = V$(), x = V.L.find(y => y.id === id), cur = V.L.find(y => y.id === V.act);
        if (!x || !x.d || x.id === V.act) return;
        const was = archOf();
        if (cur) cur.d = verSnap();
        verLoad(x.d); delete x.d; V.act = x.id; save("BASCULE", x.nom + (x.arch ? " (ARCHIVÉ : LECTURE SEULE)" : ""));
        if (was !== archOf()) { reopen(); return; }
        refreshAll(); svToast(x.nom + " : SCÉNARIO ACTIF.", 2500);
      };
      const rename = el => {
        const V = V$(), x = V.L.find(y => y.id === el.dataset.nm); if (!x || x.arch) return;
        el.outerHTML = `<input class="cmp-nm scn-nm-in" data-id="${x.id}" value="${esc(x.nom)}">`;
        const inp = blk.querySelector(`.scn-nm-in[data-id="${x.id}"]`); if (!inp) return;
        inp.focus(); try { inp.select(); } catch (e) {}
        let done = false;
        const end = ok => { if (done) return; done = true; if (ok) { const v = inp.value.trim().toUpperCase(); if (v && v !== x.nom) { x.nom = v; save("SCÉNARIO RENOMMÉ", v); } } scnRender(); };
        inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); end(true); } else if (e.key === "Escape") end(false); });
        inp.addEventListener("blur", () => end(true));
      };
      if (blk) {
        /* appui long sur le nom = renommer */
        let lt = 0, longed = false;
        blk.addEventListener("pointerdown", e => {
          longed = false; clearTimeout(lt);
          const nm = e.target.closest("[data-nm]"); if (!nm || !scnEd()) return;
          lt = setTimeout(() => { longed = true; rename(nm); }, 550);
        });
        ["pointerup", "pointercancel", "pointerleave"].forEach(ev => blk.addEventListener(ev, () => { clearTimeout(lt); if (longed) setTimeout(() => { longed = false; }, 350); }));
        blk.addEventListener("change", e => {
          const t = e.target, V = V$(); if (!V) return;
          if (t.classList.contains("ver-of")) { const x = V.L.find(y => y.id === t.dataset.id); if (x) { x.of = t.checked; save(t.checked ? "OFFERT AU CLIENT" : "RETIRÉ DES OFFRES", x.nom); } }
        });
        blk.addEventListener("click", async e => {
          const vb = e.target.closest('.blk-btn[data-act="view"]'); if (vb) { e.stopPropagation(); shell.__scnView(); return; }
          const ad0 = e.target.closest("[data-scnadd]");
          if (ad0) { e.stopPropagation(); const w = scnWhy(); if (w) { svToast(w, 4000, ad0); return; } const nom = scnAdd(); if (nom) { refreshAll(); svToast(nom + " CRÉÉ.", 2500, ad0); } return; }
          const V = V$(); if (!V) return;
          if (!blk.contains(e.target.closest("#scnTable") || null)) return;
          if (longed) { longed = false; e.stopPropagation(); return; }   /* fin d'un appui long (renommer) */
          if (e.target.closest(".cf-btn, .col-rs, input")) return;   /* tri / filtre, largeur, cases : comme les autres tableaux */
          const ed = scnEd();
          const hd = e.target.closest("[data-hide]");
          if (hd) { e.stopPropagation(); const H = scnHid(); if (!H.includes(hd.dataset.hide)) H.push(hd.dataset.hide); if (scnL().every(x => H.includes(x.id))) { svToast("AU MOINS UN SCÉNARIO RESTE AFFICHÉ.", 3000, hd); return; } scnHidSet(H); scnRender(); return; }
          const uh = e.target.closest("[data-unhide]");
          if (uh) {
            e.stopPropagation();
            const H = scnHid(), hidden = scnL().filter(x => H.includes(x.id));
            if (!hidden.length) return;
            const pick = hidden.length === 1 ? hidden[0].id : await svChoose({ title: "RÉAFFICHER UN SCÉNARIO", buttons: hidden.map(x => ({ v: x.id, label: x.nom, tone: "neutral" })) });
            if (!pick) return;
            scnHidSet(H.filter(id => id !== pick)); scnRender(); return;
          }
          const ip = e.target.closest("[data-ip]");
          if (ip) { e.stopPropagation(); if (!ed) return; indPlusMenu(ip.querySelector("td") || ip, V.ind, id => { V.ind.push(id); save("INDICATEUR AJOUTÉ", (indLoad().find(I => I.id === id) || {}).nom || id); scnRender(); },
            w => { if (w === "new") indDesignWin(null, I => { if (I) { V.ind.push(I.id); save("INDICATEUR AJOUTÉ", I.nom); } scnRender(); }); else if (w === "list") indWin(() => scnRender()); }); return; }
          const ir = e.target.closest("[data-irm]"); if (ir) { e.stopPropagation(); if (!ed) return; V.ind = V.ind.filter(k => k !== ir.dataset.irm); save("INDICATEUR RETIRÉ", ir.dataset.irm); scnRender(); return; }
          const ad = e.target.closest("[data-scnadd]");
          if (ad) { e.stopPropagation(); const w = scnWhy(); if (w) { svToast(w, 4000, ad); return; } const nom = scnAdd(); if (nom) { refreshAll(); svToast(nom + " CRÉÉ.", 2500, ad); } return; }
          const ua = e.target.closest("[data-unarch]");
          if (ua) {
            e.stopPropagation();
            const x = V.L.find(y => y.id === ua.dataset.unarch);
            if (!(await svConfirm({ title: "DÉSARCHIVER " + x.nom, text: x.nom + " REPASSE EN RÉSERVE : IL REDEVIENT MODIFIABLE ET PEUT ÊTRE RETENU.", ok: "DÉSARCHIVER", tone: "neutral" }))) return;
            const was = archOf(); x.arch = false; save("SCÉNARIO DÉSARCHIVÉ", x.nom);
            if (was !== archOf()) { reopen(); return; }
            scnRender(); return;
          }
          const kp = e.target.closest("[data-keep]");
          if (kp) {
            e.stopPropagation();
            const x = V.L.find(y => y.id === kp.dataset.keep);
            if (!(await svConfirm({ title: "RETENIR " + x.nom, text: x.nom + " DEVIENT LE BUDGET DE RÉFÉRENCE ; LES AUTRES SCÉNARIOS SONT ARCHIVÉS (CONSULTABLES, EN LECTURE SEULE).", ok: "RETENIR", tone: "neutral" }))) return;
            const was = archOf();
            if (x.id !== V.act) { const cur = V.L.find(y => y.id === V.act); if (cur) cur.d = verSnap(); verLoad(x.d); delete x.d; V.act = x.id; }
            V.L.forEach(y => { if (y.kind === "sc") { y.arch = y.id !== x.id; y.ret = y.id === x.id; } });
            save("SCÉNARIO RETENU", x.nom);
            if (was !== archOf()) { reopen(); return; }
            refreshAll(); return;
          }
          const dl = e.target.closest("[data-del]");
          if (dl) {
            e.stopPropagation();
            const x = V.L.find(y => y.id === dl.dataset.del);
            if (await svConfirm({ title: "SUPPRIMER " + x.nom, text: "CE SCÉNARIO ET SES DONNÉES SERONT SUPPRIMÉS.", ok: "SUPPRIMER" })) { V.L = V.L.filter(y => y !== x); scnHidSet(scnHid().filter(id => id !== x.id)); save("SCÉNARIO SUPPRIMÉ", x.nom); refreshAll(); }
            return;
          }
          /* LISTE : toucher le nom = basculer ; toucher ailleurs sur la ligne = COMPARAISON */
          const nm = e.target.closest("[data-nm]");
          if (nm) { e.stopPropagation(); if (ed) swap(nm.dataset.nm); return; }
          const row = e.target.closest("tr[data-scn]");
          if (row) { e.stopPropagation(); scnView = "cmp"; scnRender(); }
        });
      }
    }
