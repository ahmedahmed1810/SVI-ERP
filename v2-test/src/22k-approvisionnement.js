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
    const APR_MODES = [["t", "PAR TÂCHE"], ["p", "PAR PÉRIODE"], ["f", "QUANTITÉ FIXE"], ["c", "COMMANDE CADRE"]];
    const APR_JOURS = [["", "—"], ["1", "LUNDI"], ["2", "MARDI"], ["3", "MERCREDI"], ["4", "JEUDI"], ["5", "VENDREDI"], ["6", "SAMEDI"], ["0", "DIMANCHE"]];
    /* v715 : les commandes sortent du graphique du planning (une seule fois par budget) */
    if (INS && INS.appro && INS.appro.on && !INS.aprMig) { INS.appro.on = false; INS.aprMig = 1; }
    /* QUANTITÉ FIXE : lot = contenu d'une unité d'achat × unités par camion (fenêtre emballage / livraison), sinon une unité d'achat */
    /* v728 (bloc 9.1) : réglage du titre de charges de ce budget ; découpe : une barre (longueur × poids) × barres par paquet */
    const aprLot = sk => { let c = null; try { c = condOf(INS, sk); } catch (e) {} c = c || {};
      if (c.mode === "c" && num(c.BL) > 0) { const f = condM2U(sk.split("|")[1], num(c.kgm)); if (f === null) return 0; const b = num(c.perT) || 0; return num(c.BL) * f * (b > 0 ? b : 1); }
      const a = num(c.per) || 0, b = num(c.perT) || 0; return a > 0 ? (b > 0 ? a * b : a) : 0; };
    /* jour d'approvisionnement : la commande recule au jour de la semaine choisi (au plus tard la date calculée) */
    const aprDay = (d, wd) => { if (wd === "" || wd === undefined) return d; const dt = new Date(d + "T00:00:00"), back = (dt.getDay() - Number(wd) + 7) % 7; return sviIsoAdd(d, -back); };
    const aprSt = () => { if (!INS) return { cfg: {}, sel: "all", open: {} }; INS.apr = INS.apr || {}; INS.apr.cfg = INS.apr.cfg || {}; INS.apr.open = INS.apr.open || {}; return INS.apr; };
    const aprCfg = sk => ({ mode: "t", dl: 0, gap: 0, cov: "m", nj: 30, wd: "", ...(aprSt().cfg[sk] || {}) });
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
      const cad = new Map();   /* COMMANDE CADRE : une commande par charge (total), livraisons échelonnées comme PAR TÂCHE */
      const put = (d0, sk, q, m, pu) => { if (!(q > 1e-9) && !(m > 1e-9)) return; const d = aprDay(d0, aprCfg(sk).wd); const c = C.get(sk) || { des: sk.split("|")[0], u: sk.split("|")[1] };
        const A = byD.get(d) || new Map(); const o = A.get(sk) || { sk, des: c.des, u: c.u, q: 0, m: 0, pu }; o.q += q; o.m += m; A.set(sk, o); byD.set(d, A); };
      N.forEach((L, sk) => {
        const c = aprCfg(sk), dl = Math.max(0, Number(c.dl) || 0);
        if (c.mode === "f" && aprLot(sk) > 0) {
          /* QUANTITÉ FIXE : un lot commandé chaque fois que la consommation cumulée dépasse ce qui est déjà commandé */
          const lot = aprLot(sk), day = new Map();
          L.forEach(x => { const n = Math.max(1, sviWDur(cal, x.deb, x.fin) || 1); let di = sviWNear(cal, x.deb, 1);
            for (let i = 0; i < n; i++, di = sviWAdd(cal, di, 1)) day.set(di, (day.get(di) || 0) + x.q / n); });
          let need = 0, got = 0; const pu = L[0].pu;
          [...day.keys()].sort().forEach(di => { need += day.get(di); while (need > got + 1e-9) { put(sviIsoAdd(di, -dl), sk, lot, lot * pu, pu); got += lot; } });
        } else if (c.mode === "p") {
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
          if (c.mode === "c") { const q = L.reduce((t, x) => t + x.q, 0), m = L.reduce((t, x) => t + x.m, 0), d0 = [...L].sort((a, b) => a.deb.localeCompare(b.deb))[0].deb;
            cad.set(sk, { sk, d: aprDay(sviIsoAdd(d0, -dl), c.wd), q, m, n: L.length }); }
        }
      });
      aprPlan.cadres = [...cad.values()];
      const P = [...byD.keys()].sort().map((d, i) => ({ d, ref: "APR-" + String(i + 1).padStart(3, "0"), items: [...byD.get(d).values()].sort((a, b) => a.des.localeCompare(b.des, "fr")) }));
      /* regroupement manuel (glisser un approvisionnement sur un autre) : titre parent ; date = la plus tôt, modifiable ;
         gardé par dates d'origine (le RECALAGE garde le regroupement et recalcule les quantités dedans) */
      const G = (aprSt().grp || []).map(g => ({ ...g, kids: P.filter(a => (g.ds || []).includes(a.d)) })).filter(g => g.kids.length);
      const inG = new Set(G.flatMap(g => g.kids.map(a => a.ref)));
      const out = P.filter(a => !inG.has(a.ref)).map(a => ({ ...a, kids: null }));
      G.forEach(g => { const d = g.d || g.kids.map(a => a.d).sort()[0], M = new Map();
        g.kids.forEach(a => a.items.forEach(x => { const o = M.get(x.sk) || { ...x, q: 0, m: 0 }; o.q += x.q; o.m += x.m; M.set(x.sk, o); }));
        out.push({ d, ref: "GRP-" + g.id, gid: g.id, items: [...M.values()], kids: g.kids }); });
      return out.sort((a, b) => a.d.localeCompare(b.d));
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
          <td>${g.mode === "p" ? sel(c.sk, "cov", [["w", "SEMAINE"], ["m", "MOIS"], ["n", "N JOURS"]], g.cov) + (g.cov === "n" ? " " + nin(c.sk, "nj", g.nj) : "") : g.mode === "f" ? (aprLot(c.sk) > 0 ? "LOT " + aprFmt(aprLot(c.sk)) + " " + esc(c.u) : '<span class="apr-badge">RÉGLER L\'EMBALLAGE / LIVRAISON</span>') : nin(c.sk, "gap", g.gap)}</td>
          <td>${sel(c.sk, "wd", APR_JOURS, g.wd)}</td>
          <td class="center">${set ? "" : '<span class="apr-badge">À RÉGLER</span>'}</td></tr>`; }).join("");
      const det = (a, ind) => a.items.map(x => `<tr class="apr-kid"><td></td><td style="padding-left:${ind}px">${esc(x.des)}</td><td class="number">${aprFmt(x.m)}</td><td class="number">${aprFmt(x.q)} ${esc(x.u)} × ${aprFmt(x.pu)}</td></tr>`).join("");
      const line = (a, cls, ind) => { const op = !!St.open[a.ref], tot = a.items.reduce((t, x) => t + x.m, 0);
        return `<tr class="apr-row${cls}" data-apr="${esc(a.ref)}" data-d="${esc(a.d)}"><td style="padding-left:${ind}px"><span class="bdg-fold">${op ? "⌄" : "›"}</span> ${esc(dFr(a.d))}</td><td>${esc(a.ref)}</td><td class="number">${aprFmt(tot)}</td><td class="center">${a.items.length}</td></tr>` + (op ? det(a, ind + 12) : ""); };
      const tbl = rowsT.map(a => !a.kids ? line(a, "", 8) : `<tr class="apr-row apr-grp" data-apr="${esc(a.ref)}" data-gid="${esc(a.gid)}"><td><span class="bdg-fold">${St.open[a.ref] ? "⌄" : "›"}</span> ${ed ? `<input type="date" class="apr-gd" data-gid="${esc(a.gid)}" value="${esc(a.d)}">` : esc(dFr(a.d))}</td><td>REGROUPEMENT (${a.kids.length})${ed ? ` <button type="button" class="apr-ungrp" data-gid="${esc(a.gid)}" title="Défaire le regroupement">✕</button>` : ""}</td><td class="number">${aprFmt(a.items.reduce((t, x) => t + x.m, 0))}</td><td class="center">${a.items.length}</td></tr>`
        + (St.open[a.ref] ? a.kids.map(k => line({ ...k, items: k.items.filter(vis) }, " apr-sub-r", 24)).join("") : "")).join("");
      const CAD = (aprPlan.cadres || []).filter(c => vis(c));
      const cadT = CAD.length ? `<div class="apr-sub">COMMANDES CADRE (UNE COMMANDE, LIVRAISONS ÉCHELONNÉES CI-DESSUS)</div><table class="bdg-d-table apr-t"><thead><tr><th>DATE</th><th>CHARGE</th><th class="number">QUANTITÉ</th><th class="number">MONTANT (DH)</th><th class="center">LIVRAISONS</th></tr></thead><tbody>${CAD.map(c => { const ch = CH.find(x => x.sk === c.sk) || {}; return `<tr><td>${esc(dFr(c.d))}</td><td>${esc(ch.des || c.sk)}</td><td class="number">${aprFmt(c.q)} ${esc(ch.u || "")}</td><td class="number">${aprFmt(c.m)}</td><td class="center">${c.n}</td></tr>`; }).join("")}</tbody></table>` : "";
      const nTodo = CH.filter(c => !St.cfg[c.sk]).length;
      return `<div class="bdg-d-scroll apr-wrap">
        <div class="apr-bar-h"><b>APPROVISIONNEMENT PRÉVISIONNEL</b>${nTodo ? `<span class="apr-badge">${nTodo} CHARGE${nTodo > 1 ? "S" : ""} À RÉGLER</span>` : ""}
          <span class="apr-seg">${[["all", "TOUTES LES CHARGES"], ["on", "CHARGES COCHÉES"]].map(([v, l]) => `<button type="button" class="svc-b${(St.sel || "all") === v ? " on" : ""}" data-aprsel="${v}">${l}</button>`).join("")}</span>
          <span class="apr-seg">${[["m", "MONTANT (DH)"], ["q", "QUANTITÉ"]].map(([v, l]) => `<button type="button" class="svc-b${(unitQ ? "q" : "m") === v ? " on" : ""}${v === "q" && !sameQ ? " off" : ""}" data-aprgu="${v}"${v === "q" && !sameQ ? ' data-why="QUANTITÉ : SEULEMENT POUR DES CHARGES DE MÊME UNITÉ ET DU MÊME GROUPE."' : ""}>${l}</button>`).join("")}</span></div>
        <div class="apr-graph">${rowsT.length ? `<svg width="${GW}" height="${GH}" class="apr-svg">${bars}</svg>` : `<div class="empty">AUCUN APPROVISIONNEMENT : LIER DES CHARGES À DES TÂCHES DATÉES.</div>`}</div>
        <table class="bdg-d-table apr-t"><thead><tr><th>DATE</th><th>RÉFÉRENCE</th><th class="number">MONTANT TOTAL (DH)</th><th class="center">CHARGES</th></tr></thead><tbody>${tbl || `<tr><td colspan="4" class="empty">AUCUN APPROVISIONNEMENT</td></tr>`}</tbody></table>${ed && rowsT.length > 1 ? `<div class="hcf-note">APPUI LONG SUR UN APPROVISIONNEMENT PUIS LE LÂCHER SUR UN AUTRE = LES REGROUPER.</div>` : ""}${cadT}
        <div class="apr-sub">MODE D'APPROVISIONNEMENT DES CHARGES</div>
        <table class="bdg-d-table apr-t apr-cfg"><thead><tr><th>DÉSIGNATION CHARGE</th><th class="center">UNITÉ</th><th>MODE</th><th>DÉLAI (J)</th><th>ÉCART MINIMUM (J) / COUVERTURE / LOT</th><th>JOUR D'APPROVISIONNEMENT</th><th></th></tr></thead><tbody>${cfgRows || `<tr><td colspan="7" class="empty">AUCUNE CHARGE</td></tr>`}</tbody></table>
      </div>`;
    };
    shell.__aprPlan = aprPlan;
    {
      /* v715 : gestionnaires rafraîchis à chaque ouverture (budget courant), branchés une seule fois sur le cadre */
      shell.__aprH = {};
      const rer = () => { try { renderTabK(); } catch (e) { try { refreshAll(); } catch (e2) {} } };
      shell.__aprH.click = e => {
        const w = e.target.closest && e.target.closest(".apr-wrap"); if (!w || !INS) return;
        const o = e.target.closest(".off[data-why]"); if (o) { svToast(o.dataset.why, 3000, o); return; }
        const s = e.target.closest("[data-aprsel]"); if (s) { aprSt().sel = s.dataset.aprsel; insSave(); rer(); return; }
        const g = e.target.closest("[data-aprgu]"); if (g) { aprSt().gu = g.dataset.aprgu; insSave(); rer(); return; }
        const ug = e.target.closest(".apr-ungrp[data-gid]"); if (ug) { const St = aprSt(); St.grp = (St.grp || []).filter(g => g.id !== ug.dataset.gid); histLog("APPROVISIONNEMENT", "REGROUPEMENT DÉFAIT", ""); insSave(); rer(); return; }
        if (e.target.closest(".apr-gd")) return;
        const r = e.target.closest("tr.apr-row[data-apr]"); if (r) { const St = aprSt(); St.open[r.dataset.apr] = !St.open[r.dataset.apr]; insSave(); rer(); }
      };
      shell.__aprH.change = e => {
        const gd = e.target.closest && e.target.closest(".apr-wrap .apr-gd[data-gid]");
        if (gd && INS) { const g = (aprSt().grp || []).find(x => x.id === gd.dataset.gid); if (g) { g.d = gd.value || ""; histLog("APPROVISIONNEMENT", "DATE DU REGROUPEMENT", dFr(g.d)); insSave(); rer(); } return; }
        const i = e.target.closest && e.target.closest(".apr-wrap .apr-in[data-sk]"); if (!i || !INS) return;
        const St = aprSt(), sk = i.dataset.sk, f = i.dataset.f, c = { ...aprCfg(sk) };
        c[f] = ["dl", "gap", "nj"].includes(f) ? Math.max(0, parseInt(i.value, 10) || 0) : i.value;
        St.cfg[sk] = c; histLog("APPROVISIONNEMENT", "MODE", sk.split("|")[0] + " — " + ((APR_MODES.find(x => x[0] === c.mode) || [])[1] || "") + ", DÉLAI " + c.dl + " J");
        insSave(); rer();
      };
      /* regroupement manuel : appui long sur une ligne, glisser, lâcher sur une autre */
      shell.__aprH.pointerdown = e => {
        const r = e.target.closest && e.target.closest(".apr-wrap tr.apr-row[data-d]"); if (!r || !INS || !(INS_EDIT && INS_REAL)) return;
        let drag = false, tgt = null; const x0 = e.clientX, y0 = e.clientY, refA = r.dataset.apr, gidA = r.dataset.gid || "", rowA = () => [...shell.querySelectorAll(".apr-wrap tr.apr-row[data-apr]")].find(x => x.dataset.apr === refA) || r;
        const lt = setTimeout(() => { drag = true; rowA().classList.add("apr-drag"); }, 450);
        const mv = ev => { if (!drag) { if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 8) end(); return; } ev.preventDefault();
          const el = document.elementFromPoint(ev.clientX, ev.clientY), t = el && el.closest && el.closest(".apr-wrap tr.apr-row");
          if (tgt && tgt !== t) tgt.classList.remove("apr-tgt"); tgt = t && t.dataset.apr !== refA ? t : null; if (tgt) tgt.classList.add("apr-tgt"); };
        const end = () => { clearTimeout(lt); document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", end);
          rowA().classList.remove("apr-drag"); if (tgt) tgt.classList.remove("apr-tgt"); };
        const up = () => { const t = tgt, was = drag; end(); if (!was || !t) return;
          const St = aprSt(), P = aprPlan(), dsOf = row => { const a = P.find(x => x.ref === row.dataset.apr); return a ? (a.kids ? a.kids.map(k => k.d) : [a.d]) : []; };
          const ga = gidA, gb = t.dataset.gid || "", ds = [...new Set([...dsOf({ dataset: { apr: refA } }), ...dsOf(t)])];
          St.grp = (St.grp || []).filter(g => g.id !== ga && g.id !== gb);
          St.grp.push({ id: gb || ga || insId(), ds, d: "" });
          histLog("APPROVISIONNEMENT", "REGROUPEMENT", ds.map(dFr).join(", ")); insSave(); rer(); };
        document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", end);
      };
    }
    if (!shell.__aprBound) { shell.__aprBound = true; ["click", "change", "pointerdown"].forEach(t => shell.addEventListener(t, e => { const h = shell.__aprH && shell.__aprH[t]; if (h) h(e); })); }
