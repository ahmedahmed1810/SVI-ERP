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
    const verSnap = () => { const o = JSON.parse(JSON.stringify(INS)); delete o.ver; return o; };
    const verLoad = snap => { const keep = INS.ver; Object.keys(INS).forEach(k => { delete INS[k]; }); Object.assign(INS, JSON.parse(JSON.stringify(snap))); INS.ver = keep; };
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
    /* origine des lignes (avenants) : première étape (MARCHÉ INITIAL, AVENANT n) qui contient la ligne ; sinon l'avenant en cours */
    const verOrig = () => {
      const V = INS.ver || {}, A = (V.L || []).filter(x => x.kind === "av").sort((a, b) => a.n - b.n);
      const O = { des: {}, chg: {}, prd: {} };
      ["des", "chg", "prd"].forEach(k => (INS[k] || []).forEach(r => {
        const st = A.find(a => ((a.d || {})[k] || []).some(x => x.id === r.id));
        O[k][r.id] = st ? st.nom : (V.avCur ? "AVENANT " + V.avCur : "MARCHÉ INITIAL");
      }));
      return O;
    };
    const verWin = () => {
      INS.ver = INS.ver || { L: [], ind: ["fin", "dur", "but", "eff", "mo", "chg", "mg", "mgp"] };
      const V = INS.ver; V.L = V.L || []; V.ind = V.ind || ["fin", "dur", "eff", "mg"];
      const ed = INS_EDIT;
      if (!V.act) { const id = insId(); V.L.push({ id, kind: "sc", nom: "SCÉNARIO 1", date: localDT(new Date()) }); V.act = id; }
      const d = sviWinNew();
      const draw = () => {
        const SC = V.L.filter(x => x.kind === "sc"), AV = V.L.filter(x => x.kind === "av").sort((a, b) => a.n - b.n);
        const indOf = x => x.id === V.act ? verInd(INS) : x.d ? verInd(x.d) : null;
        const I = SC.map(indOf);
        /* avenants : montants par origine, quantités augmentées */
        const O = verOrig(), byO = {};
        INS.des.filter(r => !r.t).forEach(r => { const o = O.des[r.id], m = (insLinkedQ(INS, r.id) ?? num(r.q || 0)) * num(r.p || 0); byO[o] = (byO[o] || 0) + m; });
        const ini = AV[0] && AV[0].d, inc = ini ? INS.des.filter(r => !r.t).map(r => { const o = (ini.des || []).find(x => x.id === r.id); if (!o) return null; const q0 = insLinkedQ(ini, o.id) ?? num(o.q || 0), q1 = insLinkedQ(INS, r.id) ?? num(r.q || 0); return q1 > q0 + 1e-9 ? { r, q0, q1 } : null; }).filter(Boolean) : [];
        d.innerHTML = sviWinCard({ cls: "cmp-card svc-full", close: "data-x", title: "VERSIONS ET SCÉNARIOS",
          body: `<div class="fz-blk">SCÉNARIOS ${svCnt(SC.length)}</div>
            <div class="cmp-bar">${ed ? `<button type="button" class="svc-b" data-new>+ NOUVEAU SCÉNARIO (COPIE DE L'ACTIF)</button>` : ""}
              <select class="rat-add ver-ia"><option value="">+ INDICATEUR…</option>${VER_IND.filter(x => !V.ind.includes(x[0])).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></div>
            <div class="cmp-scroll"><table class="cmp-t ver-t"><thead><tr><th>INDICATEUR</th>${SC.map(x => `<th class="${x.id === V.act ? "ver-act" : ""}${x.arch ? " ver-arch" : ""}">${ed && !x.arch ? `<input class="cmp-nm ver-nm" data-id="${x.id}" value="${esc(x.nom)}">` : esc(x.nom)}<br><small>${x.id === V.act ? "ACTIF" : x.arch ? "ARCHIVÉ" : "EN RÉSERVE"}</small></th>`).join("")}</tr></thead><tbody>
              ${V.ind.map(k => `<tr><td><b>${esc((VER_IND.find(x => x[0] === k) || ["", k])[1])}</b> ${ed ? `<button type="button" class="cmp-del" data-irm="${k}">✕</button>` : ""}</td>${I.map((v, j) => `<td class="${k === "effT" ? "" : "r"}${SC[j].id === V.act ? " ver-act" : ""}">${v ? esc(verFmt(k, v[k])) : "—"}</td>`).join("")}</tr>`).join("")}
              <tr><td><b>OFFERT AU CLIENT</b></td>${SC.map(x => `<td class="c"><input type="checkbox" class="ver-of" data-id="${x.id}"${x.of ? " checked" : ""}${ed ? "" : " disabled"}></td>`).join("")}</tr>
              ${ed ? `<tr><td></td>${SC.map(x => `<td class="c ver-acts">${x.id === V.act ? "" : `<button type="button" class="svc-b" data-sw="${x.id}">BASCULER</button>`}${x.arch ? "" : `<button type="button" class="svc-b svc-ok" data-keep="${x.id}">RETENIR</button>`}${x.id === V.act ? "" : `<button type="button" class="cmp-del" data-del="${x.id}">✕</button>`}</td>`).join("")}</tr>` : ""}
            </tbody></table></div>
            <div class="fz-blk">MARCHÉ INITIAL ET AVENANTS ${svCnt(AV.length)}</div>
            <div class="cmp-bar">${ed ? `<button type="button" class="svc-b" data-av>${AV.length ? "+ NOUVEL AVENANT (AVENANT " + (AV.length) + " FIGÉ)" : "+ FIGER LE MARCHÉ INITIAL ET OUVRIR L'AVENANT 1"}</button>` : ""}
              <span class="cmp-leg">${AV.length ? "EN COURS : AVENANT " + (V.avCur || AV.length) : "AUCUN AVENANT : TOUT LE BUDGET EST LE MARCHÉ INITIAL"}</span></div>
            ${AV.length ? `<table class="pv-t"><thead><tr><th>ORIGINE</th><th class="number">MONTANT HT</th></tr></thead><tbody>${Object.keys(byO).sort().map(o => `<tr><td>${esc(o)}</td><td class="number">${money(byO[o])}</td></tr>`).join("")}<tr><td><b>BUDGET CONSOLIDÉ</b></td><td class="number"><b>${money(Object.values(byO).reduce((a, b) => a + b, 0))}</b></td></tr></tbody></table>
              <div class="fz-blk">QUANTITÉS AUGMENTÉES SUR DES LIGNES DU MARCHÉ INITIAL (TOLÉRÉES PAR LA COMMANDE) ${svCnt(inc.length)}</div>
              ${inc.length ? `<table class="pv-t"><thead><tr><th>DÉSIGNATION</th><th class="number">QPB INITIALE</th><th class="number">QPB ACTUELLE</th></tr></thead><tbody>${inc.map(x => `<tr><td>${esc(lkName("des", x.r.id))}</td><td class="number">${money(x.q0)}</td><td class="number">${money(x.q1)}</td></tr>`).join("")}</tbody></table>` : `<div class="fz-none">AUCUNE</div>`}` : ""}`,
          foot: `<button type="button" class="svc-b svc-ok svc-neutral" data-x>FERMER</button>` });
      };
      const save = (what, det) => { insSave(); histLog("VERSIONS", what, det); };
      draw(); sviWinShow(d);
      d.addEventListener("change", e => {
        const t = e.target;
        if (t.classList.contains("ver-ia") && t.value) { V.ind.push(t.value); save("INDICATEUR", t.value); draw(); return; }
        if (t.classList.contains("ver-nm")) { const x = V.L.find(y => y.id === t.dataset.id); if (x) { x.nom = t.value.trim().toUpperCase() || x.nom; save("SCÉNARIO RENOMMÉ", x.nom); } return; }
        if (t.classList.contains("ver-of")) { const x = V.L.find(y => y.id === t.dataset.id); if (x) { x.of = t.checked; save(t.checked ? "OFFERT AU CLIENT" : "RETIRÉ DES OFFRES", x.nom); } }
      });
      d.addEventListener("click", async e => {
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); refreshAll(); return; }
        const ir = e.target.closest("[data-irm]"); if (ir) { V.ind = V.ind.filter(k => k !== ir.dataset.irm); save("INDICATEUR RETIRÉ", ir.dataset.irm); draw(); return; }
        if (e.target.closest("[data-new]")) { const n = V.L.filter(x => x.kind === "sc").length + 1; V.L.push({ id: insId(), kind: "sc", nom: "SCÉNARIO " + n, date: localDT(new Date()), d: verSnap() }); save("NOUVEAU SCÉNARIO", "SCÉNARIO " + n); draw(); return; }
        const sw = e.target.closest("[data-sw]");
        if (sw) {
          const x = V.L.find(y => y.id === sw.dataset.sw), cur = V.L.find(y => y.id === V.act);
          if (!x || !x.d) return;
          if (cur) cur.d = verSnap();
          verLoad(x.d); delete x.d; V.act = x.id; save("BASCULE", x.nom); refreshAll(); draw(); return;
        }
        const kp = e.target.closest("[data-keep]");
        if (kp) {
          const x = V.L.find(y => y.id === kp.dataset.keep);
          d.remove();
          if (!(await svConfirm({ title: "RETENIR " + x.nom, text: x.nom + " DEVIENT LE BUDGET DE RÉFÉRENCE ; LES AUTRES SCÉNARIOS SONT ARCHIVÉS (CONSULTABLES, EN LECTURE SEULE).", ok: "RETENIR", tone: "neutral" }))) { sviWinShow(d); draw(); return; }
          if (x.id !== V.act) { const cur = V.L.find(y => y.id === V.act); if (cur) cur.d = verSnap(); verLoad(x.d); delete x.d; V.act = x.id; }
          V.L.forEach(y => { if (y.kind === "sc") y.arch = y.id !== x.id; }); x.ret = true;
          save("SCÉNARIO RETENU", x.nom); refreshAll(); sviWinShow(d); draw(); return;
        }
        const dl = e.target.closest("[data-del]");
        if (dl) { const x = V.L.find(y => y.id === dl.dataset.del); d.remove(); if (await svConfirm({ title: "SUPPRIMER " + x.nom, text: "CE SCÉNARIO ET SES DONNÉES SERONT SUPPRIMÉS.", ok: "SUPPRIMER" })) { V.L = V.L.filter(y => y !== x); save("SCÉNARIO SUPPRIMÉ", x.nom); } sviWinShow(d); draw(); return; }
        if (e.target.closest("[data-av]")) {
          const AV = V.L.filter(x => x.kind === "av"), n = AV.length, nom = n ? "AVENANT " + n : "MARCHÉ INITIAL";
          d.remove();
          if (!(await svConfirm({ title: "FIGER " + nom, text: "L'ÉTAT ACTUEL DU BUDGET EST GARDÉ COMME « " + nom + " » ; LE BUDGET CONTINUE SUR L'AVENANT " + (n + 1) + ". CHAQUE LIGNE GARDE SON ORIGINE.", ok: "FIGER", tone: "neutral" }))) { sviWinShow(d); draw(); return; }
          V.L.push({ id: insId(), kind: "av", n, nom, date: localDT(new Date()), d: verSnap() }); V.avCur = n + 1;
          save("AVENANT", nom + " FIGÉ — AVENANT " + (n + 1) + " OUVERT"); sviWinShow(d); draw();
        }
      });
    };
    shell.__verWin = () => verWin();
    shell.__verOrig = () => verOrig();
