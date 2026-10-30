    /* =========================================================
       v714 (point 3, étape 1) : onglet APPROVISIONNEMENT PRÉVISIONNEL du bloc détail (au niveau de DÉTAIL CHARGES / DÉTAIL DÉLAIS).
       - Mode choisi charge par charge, propre au budget (INS.apr.cfg[clé charge]) :
           PAR TÂCHE (défaut) : une commande au début de chaque tâche (chaque morceau d'une tâche coupée compte à part) moins le DÉLAI ;
             ÉCART MINIMUM (J) entre deux commandes : les commandes trop proches sont regroupées sur la plus tôt ;
           PAR PÉRIODE (mode v543) : une commande par période de couverture (SEMAINE, MOIS ou N JOURS) moins le DÉLAI ;
             rien n'est livré pendant une coupure : la période repart au début du morceau suivant.
       - Charge jamais réglée : signalée À RÉGLER (calculée en PAR TÂCHE, délai 0).
       - Tableau : une ligne par approvisionnement (DATE, RÉFÉRENCE, MONTANT), repliable ; déplié : chaque charge (QUANTITÉ, UNITÉ, PU, MONTANT).
       - Graphique : dates en abscisse, montants (ou quantités si même unité et même groupe) ; toutes les charges ou seulement les cochées.
       - Étape 2 : QUANTITÉ FIXE, COMMANDE CADRE, jour d'approvisionnement, fournisseurs, regroupement manuel ; étape 3 : RECALAGE.
       ========================================================= */
    const APR_MODES = [["t", "PAR TÂCHE"], ["p", "PAR PÉRIODE"]];
    const aprSt = () => { if (!INS) return { cfg: {}, sel: "all", open: {} }; INS.apr = INS.apr || {}; INS.apr.cfg = INS.apr.cfg || {}; INS.apr.open = INS.apr.open || {}; return INS.apr; };
    const aprCfg = sk => ({ mode: "t", dl: 0, gap: 0, cov: "m", nj: 30, ...(aprSt().cfg[sk] || {}) });
    /* charges du budget, regroupées par clé (désignation | unité) */
    const aprCharges = () => {
      const M = new Map();
      (INS && INS.chg || []).filter(r => !r.t).forEach(r => {
        const sk = dlyResK(r);
        if (!M.has(sk)) M.set(sk, { sk, des: U_(r.des), u: U_(r.u) || "U", rows: [], on: false, grp: "" });
        const c = M.get(sk); c.rows.push(r); if (r.on === true) c.on = true;
      });
      /* groupe = titre juste au-dessus dans DÉTAIL CHARGES */
      let g = ""; (INS && INS.chg || []).forEach(x => { if (x.t) g = x.id; else { const c = M.get(dlyResK(x)); if (c && !c.grp) c.grp = g; } });
      return [...M.values()];
    };
    /* besoins : pour chaque charge, quantité et montant par morceau de tâche (prorata des jours travaillés) */
    const aprNeeds = () => {
      const cal = insCal(), byRow = new Map();
      (INS.links || []).forEach(l => (l.chg || []).forEach(e => { const k = l.lot + "|" + l.sec; const a = byRow.get(e.id) || new Set(); a.add(k); byRow.set(e.id, a); }));
      const out = new Map();
      (INS.chg || []).filter(r => !r.t).forEach(r => {
        const ks = [...(byRow.get(r.id) || [])]; if (!ks.length) return;
        const q = num(r.q || 0) || 0, pu = num(r.p || 0) || 0, sk = dlyResK(r);
        ks.forEach(k => {
          const P = dlyList(k).filter(p => p.deb && p.fin); if (!P.length) return;
          const D = P.map(p => Math.max(1, sviWDur(cal, p.deb, p.fin) || 1)), tot = D.reduce((a, b) => a + b, 0);
          P.forEach((p, i) => { const f = D[i] / tot / ks.length;
            const L = out.get(sk) || []; L.push({ k, deb: p.deb, fin: p.fin, q: q * f, m: q * pu * f, pu }); out.set(sk, L); });
        });
      });
      return out;
    };
    /* approvisionnements : liste { d, ref, items: [{ sk, des, u, q, m, pu }] } triée par date */
    const aprPlan = () => {
      const cal = insCal(), N = aprNeeds(), C = new Map(aprCharges().map(c => [c.sk, c])), byD = new Map();
      const put = (d, sk, q, m, pu) => { if (!(q > 1e-9) && !(m > 1e-9)) return; const c = C.get(sk) || { des: sk.split("|")[0], u: sk.split("|")[1] };
        const A = byD.get(d) || new Map(); const o = A.get(sk) || { sk, des: c.des, u: c.u, q: 0, m: 0, pu }; o.q += q; o.m += m; A.set(sk, o); byD.set(d, A); };
      N.forEach((L, sk) => {
        const c = aprCfg(sk), dl = Math.max(0, Number(c.dl) || 0);
        if (c.mode === "p") {
          /* consommation jour par jour ; la période repart au début de chaque morceau (rien pendant une coupure) */
          const per = new Map();
          L.forEach(x => { const n = Math.max(1, sviWDur(cal, x.deb, x.fin) || 1); let di = sviWNear(cal, x.deb, 1);
            for (let i = 0; i < n; i++, di = sviWAdd(cal, di, 1)) { let p = dlyPerStart(di, { cov: c.cov, nj: c.nj, dep: "" }); if (p < x.deb) p = x.deb;
              const o = per.get(p) || { q: 0, m: 0 }; o.q += x.q / n; o.m += x.m / n; per.set(p, o); } });
          [...per.keys()].sort().forEach(p => { const o = per.get(p); put(sviIsoAdd(p, -dl), sk, o.q, o.m, L[0].pu); });
        } else {
          /* PAR TÂCHE : début du morceau moins le délai ; écart minimum = regroupement sur la commande la plus tôt */
          const gap = Math.max(0, Number(c.gap) || 0);
          let last = null, acc = null;
          [...L].sort((a, b) => a.deb.localeCompare(b.deb)).forEach(x => {
            const d = sviIsoAdd(x.deb, -dl);
            if (acc && gap && dDiff(last, d) < gap) { acc.q += x.q; acc.m += x.m; return; }
            if (acc) put(last, sk, acc.q, acc.m, x.pu);
            last = d; acc = { q: x.q, m: x.m };
          });
          if (acc) put(last, sk, acc.q, acc.m, L[0].pu);
        }
      });
      return [...byD.keys()].sort().map((d, i) => ({ d, ref: "APR-" + String(i + 1).padStart(3, "0"), items: [...byD.get(d).values()].sort((a, b) => a.des.localeCompare(b.des, "fr")) }));
    };
    const aprFmt = v => (Math.round((Number(v) || 0) * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    shell.__aprHTML = () => {
      if (!INS) return `<div class="bdg-d-scroll"><div class="empty">APPROVISIONNEMENT : BUDGET EN INSTANCE SEULEMENT.</div></div>`;
      const St = aprSt(), CH = aprCharges(), ed = INS_EDIT && INS_REAL, PL = aprPlan();
      const selOnly = St.sel === "on", onSet = new Set(CH.filter(c => c.on).map(c => c.sk));
      const vis = it => !selOnly || onSet.has(it.sk);
      const rowsT = PL.map(a => ({ ...a, items: a.items.filter(vis) })).filter(a => a.items.length);
      /* graphique : quantités seulement si même unité et même groupe parmi les charges retenues */
      const used = CH.filter(c => !selOnly || c.on), sameQ = used.length > 0 && new Set(used.map(c => c.u)).size === 1 && new Set(used.map(c => c.grp)).size === 1;
      const unitQ = sameQ && St.gu === "q", val = a => a.items.reduce((t, x) => t + (unitQ ? x.q : x.m), 0);
      const mx = Math.max(1, ...rowsT.map(val)), GW = Math.max(rowsT.length * 46, 300), GH = 150;
      const bars = rowsT.map((a, i) => { const h = Math.round(val(a) / mx * (GH - 34)), x = 20 + i * 46;
        return `<g><rect x="${x}" y="${GH - 20 - h}" width="26" height="${h}" rx="3" class="apr-bar"/><text x="${x + 13}" y="${GH - 6}" text-anchor="middle" class="apr-gx">${esc(dFr(a.d).slice(0, 5))}</text><text x="${x + 13}" y="${GH - 24 - h}" text-anchor="middle" class="apr-gv">${esc(unitQ ? aprFmt(val(a)) : Math.round(val(a)).toLocaleString("fr-FR"))}</text></g>`; }).join("");
      const sel = (sk, f, opts, v) => `<select class="apr-in" data-sk="${esc(sk)}" data-f="${f}"${ed ? "" : " disabled"}>${opts.map(([o, l]) => `<option value="${o}"${String(v) === o ? " selected" : ""}>${l}</option>`).join("")}</select>`;
      const nin = (sk, f, v) => `<input class="apr-in apr-n" data-sk="${esc(sk)}" data-f="${f}" inputmode="numeric" value="${esc(String(v))}"${ed ? "" : " readonly"}>`;
      const cfgRows = CH.map(c => { const g = aprCfg(c.sk), set = !!St.cfg[c.sk];
        return `<tr class="${set ? "" : "apr-todo"}"><td>${esc(c.des)}</td><td class="center">${esc(c.u)}</td><td>${sel(c.sk, "mode", APR_MODES, g.mode)}</td><td>${nin(c.sk, "dl", g.dl)}</td>
          <td>${g.mode === "p" ? sel(c.sk, "cov", [["w", "SEMAINE"], ["m", "MOIS"], ["n", "N JOURS"]], g.cov) + (g.cov === "n" ? " " + nin(c.sk, "nj", g.nj) : "") : nin(c.sk, "gap", g.gap)}</td>
          <td class="center">${set ? "" : '<span class="apr-badge">À RÉGLER</span>'}</td></tr>`; }).join("");
      const tbl = rowsT.map(a => { const op = !!St.open[a.ref], tot = a.items.reduce((t, x) => t + x.m, 0);
        return `<tr class="apr-row" data-apr="${esc(a.ref)}"><td><span class="bdg-fold">${op ? "⌄" : "›"}</span> ${esc(dFr(a.d))}</td><td>${esc(a.ref)}</td><td class="number">${aprFmt(tot)}</td><td class="center">${a.items.length}</td></tr>`
          + (op ? a.items.map(x => `<tr class="apr-kid"><td></td><td>${esc(x.des)}</td><td class="number">${aprFmt(x.m)}</td><td class="number">${aprFmt(x.q)} ${esc(x.u)} × ${aprFmt(x.pu)}</td></tr>`).join("") : ""); }).join("");
      const nTodo = CH.filter(c => !St.cfg[c.sk]).length;
      return `<div class="bdg-d-scroll apr-wrap">
        <div class="apr-bar-h"><b>APPROVISIONNEMENT PRÉVISIONNEL</b>${nTodo ? `<span class="apr-badge">${nTodo} CHARGE${nTodo > 1 ? "S" : ""} À RÉGLER</span>` : ""}
          <span class="apr-seg">${[["all", "TOUTES LES CHARGES"], ["on", "CHARGES COCHÉES"]].map(([v, l]) => `<button type="button" class="svc-b${(St.sel || "all") === v ? " on" : ""}" data-aprsel="${v}">${l}</button>`).join("")}</span>
          <span class="apr-seg">${[["m", "MONTANT (DH)"], ["q", "QUANTITÉ"]].map(([v, l]) => `<button type="button" class="svc-b${(unitQ ? "q" : "m") === v ? " on" : ""}${v === "q" && !sameQ ? " off" : ""}" data-aprgu="${v}"${v === "q" && !sameQ ? ' data-why="QUANTITÉ : SEULEMENT POUR DES CHARGES DE MÊME UNITÉ ET DU MÊME GROUPE."' : ""}>${l}</button>`).join("")}</span></div>
        <div class="apr-graph">${rowsT.length ? `<svg width="${GW}" height="${GH}" class="apr-svg">${bars}</svg>` : `<div class="empty">AUCUN APPROVISIONNEMENT : LIER DES CHARGES À DES TÂCHES DATÉES.</div>`}</div>
        <table class="bdg-d-table apr-t"><thead><tr><th>DATE</th><th>RÉFÉRENCE</th><th class="number">MONTANT TOTAL (DH)</th><th class="center">CHARGES</th></tr></thead><tbody>${tbl || `<tr><td colspan="4" class="empty">AUCUN APPROVISIONNEMENT</td></tr>`}</tbody></table>
        <div class="apr-sub">MODE D'APPROVISIONNEMENT DES CHARGES</div>
        <table class="bdg-d-table apr-t apr-cfg"><thead><tr><th>DÉSIGNATION CHARGE</th><th class="center">UNITÉ</th><th>MODE</th><th>DÉLAI (J)</th><th>ÉCART MINIMUM (J) / COUVERTURE</th><th></th></tr></thead><tbody>${cfgRows || `<tr><td colspan="6" class="empty">AUCUNE CHARGE</td></tr>`}</tbody></table>
      </div>`;
    };
    shell.__aprPlan = aprPlan;
    if (!shell.__aprBound) {
      shell.__aprBound = true;
      const rer = () => { try { renderTabK(); } catch (e) { try { refreshAll(); } catch (e2) {} } };
      shell.addEventListener("click", e => {
        const w = e.target.closest && e.target.closest(".apr-wrap"); if (!w || !INS) return;
        const o = e.target.closest(".off[data-why]"); if (o) { svToast(o.dataset.why, 3000, o); return; }
        const s = e.target.closest("[data-aprsel]"); if (s) { aprSt().sel = s.dataset.aprsel; insSave(); rer(); return; }
        const g = e.target.closest("[data-aprgu]"); if (g) { aprSt().gu = g.dataset.aprgu; insSave(); rer(); return; }
        const r = e.target.closest("tr.apr-row[data-apr]"); if (r) { const St = aprSt(); St.open[r.dataset.apr] = !St.open[r.dataset.apr]; insSave(); rer(); }
      });
      shell.addEventListener("change", e => {
        const i = e.target.closest && e.target.closest(".apr-wrap .apr-in[data-sk]"); if (!i || !INS) return;
        const St = aprSt(), sk = i.dataset.sk, f = i.dataset.f, c = { ...aprCfg(sk) };
        c[f] = ["dl", "gap", "nj"].includes(f) ? Math.max(0, parseInt(i.value, 10) || 0) : i.value;
        St.cfg[sk] = c; histLog("APPROVISIONNEMENT", "MODE", sk.split("|")[0] + " — " + (c.mode === "p" ? "PAR PÉRIODE" : "PAR TÂCHE") + ", DÉLAI " + c.dl + " J");
        insSave(); rer();
      });
    }
