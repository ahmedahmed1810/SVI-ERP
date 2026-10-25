    const dlyDraft = () => {
      const key = insDlyKey();
      LK.dlpDraft = LK.dlpDraft || {};
      if (key && !LK.dlpDraft[key]) LK.dlpDraft[key] = ((INS.dlp || {})[key] || []).map(p => ({ ...p }));
      return LK.dlpDraft;
    };
    /* FORMAT 22 : actions du planning (Gantt compris) — l'écran ne bouge jamais */
    const renderTabK = () => { grpFlush(); keepScroll(() => renderTab()); };
    shell.__insDly = INS && INS_EDIT ? { INS, dAdd, dDiff, dParse, dFr, insId, insSave, err: "", draft: dlyDraft,
      predFin: k => dlyPredFin(k), succs: k => dlySuccs(k), deb: k => dlyDeb(k), name: k => dlyName(k), shift: (k, g) => dlyShift(k, g),
      cal: () => insCal(), glued: k => dlyGlued(k), links: k => dlyLinks(k), apply: (k, q, o) => dlyApply(k, q, o),
      /* FORMAT 22 : replier / déplier sans faire bouger l'écran */
      fold: p => { dlyFoldToggle(p); keepScroll(() => renderTab()); },
      jal: k => { INS.jal = INS.jal || {}; if (INS.jal[k]) delete INS.jal[k]; else INS.jal[k] = true; insSave(); histLog("DÉLAIS", "JALON", dlyName(k) + (INS.jal[k] ? " — POSÉ" : " — RETIRÉ")); renderTabK(); },
      linkWin: (p, k) => dlyLinkWin(p, k), reach: (a, b) => dlyReach(a, b), addLink: (p, k, t, a) => dlyAddLink(p, k, t, a),
      gen: () => dlyCompressRun(), gcWin: () => dlyGCWin(), genOnly: () => dlyCompressRun({ gen: true }), keys: () => dlyKeys(), comp: () => dlyCompressRun(), hasDates: () => dlyHasDates(), canComp: () => dlyCanCompress(),
      moveCut: (i, iso) => dlyMoveCut(i, iso), rdSet: (sk, sec, i, p) => dlyRdSetV(sk, sec, i, p), rdCut: (sk, sec, iso) => dlyRdCut(sk, sec, iso), rdDel: (sk, sec, i) => dlyRdDel(sk, sec, i), rdLim: () => dlyRdLim(), piecesWin: k => dlyPiecesWin(k), hcfgWin: () => dlyHCfgWin(), succs: k => dlySuccs(k).map(dlyName), cutPlaf: iso => dlyCutPlaf(iso), plafSeg: (i, n, a) => dlySetPlaf(i, n, a), delCut: i => dlyDelCut(i), limTxt: k => dlyLimTxt(k),
      incWin: k => dlyIncWin(k), apprWin: () => dlyApproWin(), hh: v => { dlyHHSet(v); keepScroll(() => renderTab()); }, hhGet: () => dlyHHGet(),
      /* R18 : réglages de l'histogramme ; R19 / R20 : plage et filtre */
      hset: () => dlyHSet(), hsetPut: o => dlyHSetPut(o), sameU: () => dlySameU(dlyResSel()), hasSel: () => !!dlyResSel(),
      hrange: () => dlyHRange(), hrangeSet: R => { INS.hrange = R; insSave(); renderTabK(); },
      hval: () => dlyHVal(),
      hvalSet: V => {
        INS.hval = V; insSave();
        /* au lâcher : charges des jours retenus (plage et filtre) cochées dans DÉTAIL CHARGES, les autres charges cochées décochées */
        const H = dlyHistData();
        if (H && (V.min !== null || V.max !== null)) {
          const RG = dlyHRange(), C = H.cmd, hs = dlyHSet();
          const days = Object.keys(C ? C.L : H.tot).sort();
          let t = 0; const val = {};
          days.forEach(di => { t += C ? C.L[di] : H.tot[di]; val[di] = C || hs.aff !== "c" ? (C ? C.L[di] : H.tot[di]) : t; });
          if (!C && hs.aff === "c" && hs.cum === "r" && RG.a) { const b0 = days.filter(di => di < RG.a).reduce((x, di) => x + H.tot[di], 0); days.forEach(di => { val[di] -= b0; }); }
          const keep = days.filter(di => (!RG.a || di >= RG.a) && (!RG.b || di <= RG.b) && (V.min === null || val[di] >= V.min - 1e-9) && (V.max === null || val[di] <= V.max + 1e-9));
          if (keep.length) {
            /* charges des tâches de ces jours (commandes : par désignation | unité) */
            const sks = new Set(), ids = new Set(), tk = new Set();
            keep.forEach(di => { if (C) (C.det[di] || []).forEach(x => sks.add(x.sk)); else (H.det[di] || []).forEach(x => tk.add(x.k)); });
            (INS.links || []).forEach(l => { if (tk.has(l.lot + "|" + l.sec)) (l.chg || []).forEach(e => ids.add(e.id)); });
            let ch = 0, n = 0;
            H.R.forEach(r => { const on = C ? sks.has(dlyResK(r)) : ids.has(r.id); if (on) n++; if (r.on !== on) { r.on = on; ch++; } });
            if (ch) { insSave(); histLog("DÉLAIS", "FILTRE MIN / MAX", n + " CHARGE(S) COCHÉE(S)"); refreshAll(); return; }
          }
        }
        renderTabK();
      },
      /* R29 : affichage PAR LOT / PAR DÉBUT (vue, mémorisée par budget) ; R28 : zone touchée en dernier */
      view: () => dlyView(), viewSet: v => { dlyViewSet(v); keepScroll(() => renderTab()); }, zone: () => shell.__dlyZone || "gantt",
      /* R15 : repère d'une tâche à 0 jour glissé vers la droite = lui donner une durée (n jours travaillés) */
      giveDur: (k, at, n, a) => { const cal = insCal(), deb = sviWNear(cal, at, 1); dlyApply(k, { deb, fin: sviWFin(cal, deb, Math.max(1, n)) }, { anchor: a }); },
      /* v461 : menu d'un lot ou d'un niveau (appui long) : ISOLER / TOUT AFFICHER */
      grpMenu: (path, el) => {
        document.getElementById("blkMenu")?.remove();
        const m = document.createElement("div");
        m.id = "blkMenu"; m.dataset.for = "dlyGrp";
        const now = dlyIsoPath() === path;
        m.innerHTML = `<div class="blk-hint">${esc(lotLab(dlyLotPath(path)).full)}</div>`
          + `<button type="button" data-g="iso"><span>${now ? "TOUT AFFICHER" : "ISOLER"}</span></button>`
          + (dlyIsoPath() && !now ? `<button type="button" data-g="all"><span>TOUT AFFICHER</span></button>` : "");
        document.body.appendChild(m);
        sviPlaceMenu(m, el.getBoundingClientRect());
        const off = ev => { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener("pointerdown", off, true); } };
        setTimeout(() => document.addEventListener("pointerdown", off, true), 0);
        m.addEventListener("click", ev => {
          const b = ev.target.closest("[data-g]");
          if (!b) return;
          ev.stopPropagation();
          m.remove(); document.removeEventListener("pointerdown", off, true);
          shell.__dlyIso = b.dataset.g === "iso" && !now ? { ref: DLYG_REF, path } : null;
          refreshAll();
        });
      },
      isoOff: () => { shell.__dlyIso = null; refreshAll(); },
      moveRow: (k, t, after) => shell.__insDly.moveKeys([k], [t], after),
      /* déplacer un bloc de lignes (une tâche, ou toutes les tâches d'un lot) avant / après un autre */
      moveKeys: (ks, ts, after) => {
        const K = new Set(ks);
        if (!ks.length || !ts.length || ts.every(t => K.has(t))) return;
        dlyOrder(dlyKeys());
        const O = (INS.dord || []).filter(x => !K.has(x));
        const pos = ts.filter(t => !K.has(t)).map(t => O.indexOf(t)).filter(i => i >= 0);
        if (!pos.length) return;
        const j = after ? Math.max(...pos) + 1 : Math.min(...pos);
        O.splice(j, 0, ...(INS.dord || []).filter(x => K.has(x)));
        INS.dord = O; dlyTasksFromPlan(); insSave(); histLog("DÉLAIS", "ORDRE DES LIGNES", ks.map(dlyName).join(" ; ").slice(0, 120)); refreshAll();
      },
      /* changer une tâche de lot (cahier, Planning budgétaire) : seul le lot change ; désignation, activités,
         produits / charges, dates et liaisons du planning gardés. Renvoie la nouvelle clé, ou "" (refus, message) */
      changeLot: (key, nl, anchor) => {
        const [lo, se] = String(key).split("|"), nk = nl + "|" + se;
        if (!nl || lo === nl) return key;
        const L = INS.links || [];
        if (dlyKeys().includes(nk) || L.some(l => l.lot === nl && l.sec === se)) { svToast("CHANGEMENT REFUSÉ : " + lkName("sec", se) + " EXISTE DÉJÀ DANS LE LOT " + lkName("lot", nl) + ".", 4000, anchor); return ""; }
        const mine = L.filter(l => l.lot === lo && l.sec === se);
        for (const l of mine) {
          const t = L.find(m => m.lot === nl && m.prim === l.prim && m.des !== l.des);
          if (t) { svToast("RÈGLE A : LA TÂCHE PRIMAIRE " + lkName("lot", nl) + " › " + lkName("prim", l.prim) + " EST DÉJÀ LIÉE À " + lkName("des", t.des) + ".", 4500, anchor); return ""; }
        }
        mine.forEach(l => { l.lot = nl; });
        const mv = o => { if (o && Object.prototype.hasOwnProperty.call(o, key)) { o[nk] = o[key]; delete o[key]; } };
        mv(INS.dlp); mv(LK.dlpDraft); mv(INS.jal); mv(INS.dpred);
        Object.keys(INS.dpred || {}).forEach(s2 => { INS.dpred[s2] = dlyLinks(s2).map(x => x.k === key ? { ...x, k: nk } : x); });
        INS.dord = (INS.dord || []).map(x => x === key ? nk : x);
        if (shell.__dlySel && shell.__dlySel.has(key)) { shell.__dlySel.delete(key); shell.__dlySel.add(nk); }
        histLog("DÉLAIS", "CHANGEMENT DE LOT", lkName("sec", se) + " : " + lkName("lot", lo) + " → " + lkName("lot", nl));
        return nk;
      },
      /* même intitulé d'activité secondaire déjà dans le lot d'arrivée → clé de cette tâche, sinon "" */
      sameIn: (key, nl) => {
        const se = String(key).split("|")[1], nm = U_(lkName("sec", se));
        return dlyKeys().find(k => { const [lo, s2] = k.split("|"); return lo === nl && k !== key && U_(lkName("sec", s2)) === nm; }) || "";
      },
      /* fenêtre TÂCHE DÉJÀ DANS LE LOT : FUSIONNER / REMPLACER / ANNULER (cahier, Planning budgétaire) */
      mergeAsk: async (key, ek, anchor) => {
        const X = shell.__insDly, plan = X.mergePlan(key, ek);
        const line = k => esc(dlyName(k)) + " — " + (dlyDeb(k) ? esc(dFr(dlyDeb(k))) + " → " + esc(dFr(dlyFin(k))) : "SANS DATES") + " — " + (INS.links || []).filter(l => l.lot + "|" + l.sec === k).length + " LIAISON(S)";
        const v = await svChoose({ title: "TÂCHE DÉJÀ DANS LE LOT",
          html: `<div class="svc-sub">${esc(lkName("sec", ek.split("|")[1]))} EXISTE DÉJÀ DANS ${esc(lkName("lot", ek.split("|")[0]))}</div>
            <ul class="svc-list"><li>${line(ek)}</li><li>${line(key)} (TÂCHE LÂCHÉE)</li></ul>
            ${plan.err ? `<div class="svc-sub svc-warn">IMPOSSIBLE : ${esc(plan.err)}</div>` : ""}`,
          buttons: [{ v: "rep", label: "REMPLACER", tone: "neutral", disabled: !!plan.err }, { v: "fus", label: "FUSIONNER", tone: "neutral", disabled: !!plan.err }] });
        if (!v || plan.err) { renderTabK(); return ""; }
        return X.mergeDo(key, ek, plan, v === "fus" ? "fus" : "rep");
      },
      /* plan de la fusion : tâche gardée (la primaire s'il y en a une, sinon celle du lot) et liaisons du budget réunies */
      mergePlan: (key, ek) => {
        const [lo, se] = key.split("|"), [nl, es] = ek.split("|");
        const L = INS.links || [];
        const mine = L.filter(l => l.lot === lo && l.sec === se), theirs = L.filter(l => l.lot === nl && l.sec === es);
        const isP = A => A.some(l => insIsPrimLink(l.prim, l.sec));
        const keepMine = isP(mine) && !isP(theirs);
        const S = keepMine ? nl + "|" + se : ek;
        const tgt = keepMine ? mine : theirs, oth = keepMine ? theirs : mine;
        const tPrim = isP(tgt) ? (tgt.find(l => insIsPrimLink(l.prim, l.sec)) || {}).prim : null, tSec = S.split("|")[1];
        const out = L.filter(l => !mine.includes(l) && !theirs.includes(l)).map(l => ({ ...l }));
        const add = (l, prim) => {
          const n = { ...l, lot: nl, sec: tSec, prim: prim || l.prim, prd: (l.prd || []).map(x => ({ ...x })), chg: (l.chg || []).map(x => ({ ...x })) };
          const same = out.find(o => o.des === n.des && o.lot === n.lot && o.prim === n.prim && o.sec === n.sec);
          if (!same) { out.push(n); return; }
          ["prd", "chg"].forEach(f => n[f].forEach(x => { if (!(same[f] || []).some(y => y.id === x.id)) (same[f] = same[f] || []).push(x); }));
        };
        tgt.forEach(l => add(l, null)); oth.forEach(l => add(l, tPrim));
        let err = "";
        const P = new Map(), Sx = new Map();
        out.forEach(l => {
          const tp = l.lot + "|" + l.prim, ts = l.lot + "|" + l.sec;
          if (P.has(tp) && P.get(tp) !== l.des && !err && l.lot === nl) err = "RÈGLE A : LA TÂCHE PRIMAIRE " + lkName("lot", l.lot) + " › " + lkName("prim", l.prim) + " SERAIT LIÉE À DEUX DÉSIGNATIONS (" + lkName("des", P.get(tp)) + " ET " + lkName("des", l.des) + ").";
          P.set(tp, l.des);
          if (Sx.has(ts) && Sx.get(ts) !== l.des && !err && l.lot === nl) err = "RÈGLE A : LA TÂCHE " + lkName("lot", l.lot) + " › " + lkName("sec", l.sec) + " SERAIT LIÉE À DEUX DÉSIGNATIONS (" + lkName("des", Sx.get(ts)) + " ET " + lkName("des", l.des) + ").";
          Sx.set(ts, l.des);
        });
        return { S, links: out, err };
      },
      /* fusion / remplacement : une seule tâche S ; key = tâche lâchée, ek = tâche du lot */
      mergeDo: (key, ek, plan, mode) => {
        const S = plan.S, both = [key, ek];
        const db = mode === "fus" ? [dlyDeb(key), dlyDeb(ek)].filter(Boolean).sort()[0] || "" : dlyDeb(key);
        const fn = mode === "fus" ? [dlyFin(key), dlyFin(ek)].filter(Boolean).sort().pop() || "" : dlyFin(key);
        const pr = (mode === "fus" ? [...dlyLinks(ek), ...dlyLinks(key)] : dlyLinks(key)).filter(x => !both.includes(x.k));
        const jal = mode === "fus" ? !!((INS.jal || {})[key] || (INS.jal || {})[ek]) : !!(INS.jal || {})[key];
        INS.links = plan.links;
        both.forEach(k => { if (INS.dlp) delete INS.dlp[k]; if (LK.dlpDraft) delete LK.dlpDraft[k]; if (INS.dpred) delete INS.dpred[k]; if (INS.jal) delete INS.jal[k]; });
        if (db || fn) { INS.dlp = INS.dlp || {}; INS.dlp[S] = [{ id: insId(), deb: db, fin: fn }]; }
        INS.jal = INS.jal || {}; if (jal) INS.jal[S] = true;
        /* successeurs des deux tâches reportés sur S (sans doublon) */
        Object.keys(INS.dpred || {}).forEach(s2 => {
          const seen = new Set();
          INS.dpred[s2] = dlyLinks(s2).map(x => both.includes(x.k) ? { ...x, k: S } : x).filter(x => x.k !== s2 && !seen.has(x.k) && seen.add(x.k));
          if (!INS.dpred[s2].length) delete INS.dpred[s2];
        });
        /* prédécesseurs de S, sans boucle ni doublon */
        const kept = [];
        pr.forEach(x => { if (x.k === S || kept.some(y => y.k === x.k) || dlyReach(x.k, S)) return; kept.push({ ...x }); });
        if (kept.length) { INS.dpred = INS.dpred || {}; INS.dpred[S] = kept; }
        const pos = (INS.dord || []).indexOf(ek);
        INS.dord = (INS.dord || []).filter(x => !both.includes(x) && x !== S);
        INS.dord.splice(pos >= 0 ? Math.min(pos, INS.dord.length) : INS.dord.length, 0, S);
        if (shell.__dlySel) both.forEach(k => shell.__dlySel.delete(k));
        histLog("DÉLAIS", mode === "fus" ? "TÂCHES FUSIONNÉES" : "TÂCHE REMPLACÉE", dlyName(key) + " → " + dlyName(S));
        dlyTasksFromPlan(); insSave(); refreshAll();
        return S;
      },
      /* lot (ou titre) déplacé dans le temps (23/10/2026) : toutes ses tâches du même nombre de jours travaillés, durées gardées ;
         vers la droite, les tâches suivantes sont poussées ; vers la gauche, les prédécesseurs hors du lot sont poussés plus tôt,
         de proche en proche ; début du projet atteint : fenêtre DÉBUT DU PROJET ATTEINT ; date butoir jamais dépassée */
      shiftGroup: (path, nCal, anchor) => {
        const g = (shell.__dlyRows || []).find(x => x.grp && x.path === path);
        if (!g || !nCal) { renderTabK(); return; }
        const cal = insCal(), G = new Set(g.all.map(t => t.key));
        const ks = [...G].filter(k => dlyDeb(k) && dlyFin(k));
        if (!ks.length) { renderTabK(); return; }
        const d0 = ks.map(dlyDeb).sort()[0];
        const nd = sviWNear(cal, sviIsoAdd(d0, nCal), nCal > 0 ? 1 : -1);
        const w = nd >= d0 ? (sviWDur(cal, d0, nd) || 1) - 1 : -((sviWDur(cal, nd, d0) || 1) - 1);
        if (!w) { renderTabK(); return; }
        const N = {}, cur = k => N[k] || { deb: dlyDeb(k), fin: dlyFin(k) };
        ks.forEach(k => { const c = cur(k), dur = sviWDur(cal, c.deb, c.fin) || 1, deb = sviWAdd(cal, sviWNear(cal, c.deb, 1), w); N[k] = { deb, fin: sviWFin(cal, deb, dur) }; });
        if (w < 0) {
          const q = [...ks];
          for (let guard = 0; q.length && guard < 5000; guard++) {
            const k = q.shift(), c = cur(k);
            dlyLinks(k).forEach(x => {
              const pc = cur(x.k);
              if (!pc.deb) return;
              const pdur = pc.fin ? sviWDur(cal, pc.deb, pc.fin) || 1 : 0;
              let nf = null;
              if (x.t === "DD") { const lim = sviWAdd(cal, sviWNear(cal, c.deb, 1), -Math.max(0, x.o || 0)); if (pc.deb > lim) nf = { deb: lim }; }
              else { const lim = sviWAdd(cal, c.deb, -Math.max(0, x.o || 0)), f = pc.fin || pc.deb; if (f > lim) nf = { fin: sviWNear(cal, lim, -1) }; }
              if (!nf) return;
              if (nf.deb) N[x.k] = { deb: nf.deb, fin: pdur ? sviWFin(cal, nf.deb, pdur) : "" };
              else N[x.k] = pdur ? { deb: sviWDeb(cal, nf.fin, pdur), fin: nf.fin } : { deb: nf.fin, fin: "" };
              q.push(x.k);
            });
          }
        }
        const apply = () => {
          const back = JSON.stringify({ dlp: INS.dlp || {}, dr: LK.dlpDraft || {} });
          Object.keys(N).forEach(k => {
            const L = dlyDraftKey(k);
            if (L.length > 1 && N[k].deb) { dlyShiftList(L, N[k].deb); return; }
            if (!L[0]) L.push({ id: insId() });
            L.splice(1); L[0].deb = N[k].deb; L[0].fin = N[k].fin || ""; delete L[0].dmd; delete L[0].fmd;
          });
          dlyCommitDrafts(); dlyRespect(false);
          const f1 = dlyEnd(dlyCurDates());
          if (INS.dbut && f1 > INS.dbut) {
            const b = JSON.parse(back); INS.dlp = b.dlp; LK.dlpDraft = b.dr;
            svToast("DÉPLACEMENT REFUSÉ : LA DATE BUTOIR DU " + dFr(INS.dbut) + " SERAIT DÉPASSÉE (FIN LE " + dFr(f1) + ").", 4500, anchor);
            renderTabK(); return;
          }
          const pushed = Object.keys(N).filter(k => !G.has(k)).length;
          histLog("DÉLAIS", "LOT DÉPLACÉ", g.name + " : " + (w > 0 ? "+" : "") + w + " J" + (pushed ? " (" + pushed + " TÂCHE(S) POUSSÉE(S))" : ""));
          insSave(); renderTabK(); insRenderChain();
        };
        const p0 = INS.pdeb || INS.gdeb || "", minD = Object.values(N).map(v => v.deb).filter(Boolean).sort()[0] || "";
        if (w < 0 && p0 && minD && minD < p0) {
          const first = Object.keys(N).find(k => N[k].deb === minD);
          svChoose({ title: "DÉBUT DU PROJET ATTEINT",
            html: `<div class="svc-sub">LA TÂCHE ${esc(dlyName(first))} DEVRAIT COMMENCER LE ${esc(dFr(minD))}, AVANT LE DÉBUT DU PROJET (${esc(dFr(p0))}).</div>`,
            buttons: [{ v: "go", label: "AVANCER LE DÉBUT DU PROJET", tone: "neutral" }] }).then(r => {
            if (r !== "go") { renderTabK(); return; }
            INS.pdeb = minD; INS.gdeb = minD;
            histLog("DÉLAIS", "DÉBUT DU PROJET AVANCÉ", dFr(p0) + " → " + dFr(minD));
            apply();
          });
          return;
        }
        apply();
      },
      /* lot (ou titre) déplacé en hauteur : rang, et titre d'arrivée (son nom prend le chemin du titre, comme dans TÂCHES) ;
         plan = { parent: chemin du titre d'arrivée ("" = racine), before: clé de la tâche devant laquelle il se place, on: chemin superposé } */
      moveGroup: (path, plan, anchor) => {
        const L = INS.lot, src = dlyLotPath(path);
        /* v461 : glissé entre deux lignes = la PLACE change, jamais le parent (le numéro garde l'appartenance ; placé hors du
           bloc de son parent, il s'affiche seul à sa place) ; superposé sur un titre = rangé dans ce titre */
        let base = plan.on ? [] : plan.keep ? src.slice(0, -1) : plan.parent ? dlyLotPath(plan.parent) : [], extra = null, N = "";
        const under = (v, P) => { const s2 = dlyLotPath(v); return s2.length >= P.length && P.every((g, i) => U_(g) === U_(s2[i])); };
        if (plan.on) {
          const T = dlyLotPath(plan.on);
          const own = L.some(x => U_(x.v) === U_(T.join(" / "))), kids = L.some(x => dlyLotPath(x.v).length > T.length && under(x.v, T));
          if (own && !kids) {
            /* superposé sur un lot simple : nouveau niveau qui regroupe les deux (comme dans TÂCHES) */
            N = insNextLevel(T.slice(0, -1));
            base = T.slice(0, -1).concat(N); extra = { P: T, base };
          } else base = T;
        }
        if (base.length >= src.length && src.every((g, i) => U_(g) === U_(base[i]))) { renderTabK(); return; }   /* pas dans sa propre branche */
        /* déjà rangé là (même parent) : on le dit, au lieu de ne rien faire en silence */
        if (!extra && !plan.keep && U_(src.slice(0, -1).join(" / ")) === U_(base.join(" / ")) && (plan.on || !plan.before)) { svToast(src[src.length - 1] + (base.length ? " EST DÉJÀ DANS " + base[base.length - 1] : " N'EST DANS AUCUN GROUPE") + ".", 3500, anchor); }
        const ren = new Map();
        const add = (P0, b0) => L.filter(x => !x.t && under(x.v, P0)).forEach(x => ren.set(x.id, b0.concat(dlyLotPath(x.v).slice(P0.length - 1)).join(" / ")));
        add(src, base); if (extra) add(extra.P, extra.base);
        const ids = new Set(ren.keys()), vals = [...ren.values()].map(U_);
        const clash = [...ren.values()].find(v => L.some(y => !ids.has(y.id) && U_(y.v) === U_(v))) || vals.find((v, i) => vals.indexOf(v) !== i);
        if (clash) { svToast("LOT « " + clash + " » EXISTE DÉJÀ : DÉPLACEMENT REFUSÉ.", 4000, anchor); renderTabK(); return; }
        const moved = new Set([...ren.keys()].filter(id => !(extra && under((L.find(x => x.id === id) || {}).v, extra.P) && !under((L.find(x => x.id === id) || {}).v, src))));
        ren.forEach((v, id) => { L.find(x => x.id === id).v = v; });
        /* rang : les tâches du bloc se placent devant « before » (sinon à la fin) */
        const keys = [...dlyOrder(dlyKeys()).keys()];
        const mine = keys.filter(k => moved.has(k.split("|")[0])), rest = keys.filter(k => !moved.has(k.split("|")[0]));
        let j = plan.before ? rest.indexOf(plan.before) : -1;
        if (j < 0) j = rest.length;
        rest.splice(j, 0, ...mine);
        INS.dord = rest;
        dlyTasksFromPlan(); insSave();
        histLog("DÉLAIS", N ? "GROUPE DE LOTS CRÉÉ" : plan.keep ? "LOT DÉPLACÉ (PLACE, MÊME TITRE)" : "LOT DÉPLACÉ", dlyLotPath(path).pop() + (plan.keep ? "" : " → " + (base.length ? base.join(" / ") : "RACINE")));
        refreshAll();
        if (N) setTimeout(() => { const i = [...shell.querySelectorAll("input.dly-nm")].find(x => x.dataset.path === base.join(" / ")); if (i) { i.focus(); try { i.select(); } catch (e) {} } }, 80);
      },
      /* SUPERPOSER une tâche B (glissée) sur une tâche A (cahier, Planning budgétaire, 16/10/2026) :
         CRÉER UN NIVEAU (deux tâches sous un sous-lot « NIVEAU n » du lot de A) / FUSIONNER (une seule tâche) / ANNULER ;
         puis, s'il y a des produits en double (même désignation, même unité) : GARDER LES DOUBLONS (doublons de B → IMPORT NON CRÉÉ)
         / IGNORER (doublons de B supprimés) / ANNULER */
      superpose: (B, A, anchor) => {
        const X = shell.__insDly;
        if (!A || !B || A === B) { renderTabK(); return; }
        const linksOf = k => (INS.links || []).filter(l => l.lot + "|" + l.sec === k);
        const nm = (k, i) => lkName(i ? "sec" : "lot", k.split("|")[i ? 1 : 0]);
        const lvlErr = () => {
          /* règle A dans le nouveau niveau : une même activité primaire ne peut pas y avoir deux désignations */
          const P = new Map(); let e = "";
          [...linksOf(A), ...linksOf(B)].forEach(l => { if (P.has(l.prim) && P.get(l.prim) !== l.des && !e) e = "RÈGLE A : LA TÂCHE PRIMAIRE › " + lkName("prim", l.prim) + " SERAIT LIÉE À DEUX DÉSIGNATIONS (" + lkName("des", P.get(l.prim)) + " ET " + lkName("des", l.des) + ")."; P.set(l.prim, l.des); });
          return e;
        };
        const d = document.createElement("div");
        d.id = "svConf";
        const draw = () => {
          const same = U_(nm(A, 1)) === U_(nm(B, 1));
          const eL = same ? "" : lvlErr(), eF = X.mergePlan(B, A).err;
          const row = (k, lab) => { const [lo, se] = k.split("|"), segs = dlyLotPath(lkName("lot", lo));
            return `<div class="sup-r"><div class="sup-l">${lab}</div>
              <label>LOT<span class="sup-pre">${esc(segs.slice(0, -1).map(x => x + " / ").join(""))}</span><input class="sup-in" data-kind="lot" data-path="${esc(segs.join(" / "))}" value="${esc(segs[segs.length - 1] || "")}"></label>
              <label>ACTIVITÉ SECONDAIRE<span class="sup-pre"></span><input class="sup-in${same ? " sup-bad" : ""}" data-kind="sec" data-sid="${esc(se)}" value="${esc(lkName("sec", se))}"></label></div>`; };
          d.innerHTML = `<div class="svc-card sup-card" role="dialog" aria-modal="true">
            <button type="button" class="svc-close" data-v="" aria-label="Fermer">✕</button>
            <div class="svc-t">SUPERPOSER</div>
            <div class="svc-x svc-html">${row(A, "TÂCHE VISÉE")}${row(B, "TÂCHE GLISSÉE")}
              ${same ? `<div class="svc-sub svc-warn">MÊME ACTIVITÉ « ${esc(nm(A, 1))} » : CHANGER UN INTITULÉ POUR CRÉER UN GROUPE (OU FUSIONNER).</div>` : ""}
              ${eL ? `<div class="svc-sub svc-warn">CRÉER UN GROUPE IMPOSSIBLE : ${esc(eL)}</div>` : ""}
              ${eF ? `<div class="svc-sub svc-warn">FUSIONNER IMPOSSIBLE : ${esc(eF)}</div>` : ""}</div>
            <div class="svc-f"><button type="button" class="svc-b" data-v="">ANNULER</button>
              <button type="button" class="svc-b svc-ok svc-neutral" data-v="fus"${eF ? " disabled" : ""}>FUSIONNER</button>
              <button type="button" class="svc-b svc-ok svc-neutral" data-v="lvl"${same || eL ? " disabled" : ""}>CRÉER UN GROUPE</button></div></div>`;
        };
        document.getElementById("svConf")?.remove();
        document.body.appendChild(d);
        draw();
        /* lot et activité modifiables à tout moment (mêmes règles que le PLANNING : pas de doublon) */
        d.addEventListener("change", e => { const i = e.target.closest("input.sup-in"); if (!i) return; X.rename(i); setTimeout(() => { if (d.isConnected) draw(); }, 0); });
        d.addEventListener("click", e => {
          const b = e.target.closest("[data-v]");
          if (!b && e.target !== d) return;
          if (b && b.disabled) return;
          const v = b ? b.dataset.v : "";
          d.remove();
          if (!v) { renderTabK(); return; }
          X.supDups(B, A, () => v === "lvl" ? X.supLevel(B, A) : X.mergeDo(B, A, X.mergePlan(B, A), "fus"), anchor);
        });
      },
      /* produits en double entre A et B (même désignation + même unité) : fenêtre DOUBLONS DE PRODUITS, puis suite */
      supDups: (B, A, then, anchor) => {
        const linksOf = k => (INS.links || []).filter(l => l.lot + "|" + l.sec === k);
        const pk = id => { const r = INS.prd.find(x => x.id === id) || {}; return U_(r.des) + "|" + U_(r.u); };
        const inA = new Set(linksOf(A).flatMap(l => (l.prd || []).map(x => pk(x.id))));
        const dup = [...new Set(linksOf(B).flatMap(l => (l.prd || []).filter(x => inA.has(pk(x.id))).map(x => x.id)))];
        if (!dup.length) { then(); return; }
        const names = dup.map(id => { const r = INS.prd.find(x => x.id === id) || {}; return (r.des || "") + (r.u ? " (" + r.u + ")" : ""); });
        svChoose({ title: "DOUBLONS DE PRODUITS",
          html: `<div class="svc-sub">${dup.length} PRODUIT(S) DE ${esc(dlyName(B))} EXISTE(NT) DÉJÀ DANS ${esc(dlyName(A))} :</div><ul class="svc-list">${names.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`,
          buttons: [{ v: "ign", label: "IGNORER", tone: "neutral" }, { v: "keep", label: "GARDER LES DOUBLONS", tone: "neutral" }] }).then(v => {
          if (!v) { renderTabK(); return; }
          const ids = new Set(dup), V = (k, id) => (INS[k].find(x => x.id === id) || {});
          if (v === "keep") {
            /* doublons gardés dans l'onglet IMPORT NON CRÉÉ, avec leur chaîne, pour être revus */
            const items = [];
            linksOf(B).forEach(l => (l.prd || []).filter(x => ids.has(x.id)).forEach(x => {
              const r = V("prd", x.id), D = V("des", l.des);
              items.push({ id: insId(), on: false, bad: ["des"], why: "DOUBLON À LA SUPERPOSITION (" + dlyName(B) + " SUR " + dlyName(A) + ")", line: "",
                src: { art: String(D.art || ""), dc: D.des || "", upb: D.u || "", lot: V("lot", l.lot).v || "", prim: V("prim", l.prim).v || "", sec: V("sec", l.sec).v || "",
                  type: "PRD", article: "", des: r.des || "", u: r.u || "", nbr: String(r.nbr ?? ""), d1: String(r.d1 ?? ""), d2: String(r.d2 ?? ""), d3: String(r.d3 ?? ""), q: "" } });
            }));
            INS.inc = (INS.inc || []).concat(items);
          }
          INS.links = (INS.links || []).map(l => l.lot + "|" + l.sec === B ? { ...l, prd: (l.prd || []).filter(x => !ids.has(x.id)) } : l).filter(l => (l.prd || []).length);
          /* une ligne produit qui n'est plus liée nulle part est retirée du détail produits */
          INS.prd = INS.prd.filter(r => !ids.has(r.id) || (INS.links || []).some(l => (l.prd || []).some(x => x.id === r.id)));
          histLog("DÉLAIS", "SUPERPOSITION — DOUBLONS " + (v === "keep" ? "GARDÉS (IMPORT NON CRÉÉ)" : "IGNORÉS"), dup.length + " PRODUIT(S) DE " + dlyName(B));
          insSave();
          then();
        });
      },
      /* CRÉER UN NIVEAU : sous-lot « NIVEAU n » du lot de A ; A puis B y passent (seul le lot change) */
      supLevel: (B, A) => {
        const X = shell.__insDly, la = A.split("|")[0], N = insNextLevel(dlyLotPath(lkName("lot", la)));
        const nl = { id: insId(), v: dlyLotPath(lkName("lot", la)).concat(N).join(" / ") };
        const i = INS.lot.findIndex(x => x.id === la);
        INS.lot.splice(i < 0 ? INS.lot.length : i + 1, 0, nl);
        const kA = X.changeLot(A, nl.id), kB = kA ? X.changeLot(B, nl.id) : "";
        if (!kA || !kB) { if (!kA) INS.lot = INS.lot.filter(x => x !== nl); insSave(); refreshAll(); return; }
        INS.dord = (INS.dord || []).filter(x => x !== kB);
        INS.dord.splice(INS.dord.indexOf(kA) + 1, 0, kB);
        dlyTasksFromPlan(); insSave();
        histLog("DÉLAIS", "GROUPE DE LOTS CRÉÉ", dlyName(kA) + " + " + dlyName(kB));
        refreshAll();
        setTimeout(() => { const inp = [...shell.querySelectorAll("input.dly-nm")].find(x => x.dataset.path === nl.v); if (inp) { inp.focus(); try { inp.select(); } catch (e) {} } }, 80);
      },
      /* tâche lâchée sur une ligne (tableau ou Gantt) : autre lot → changement de lot, puis rang */
      /* dépôt d'une tâche au niveau choisi : lot d'arrivée (trait court / long), puis rang (devant la tâche suivante, sinon après la précédente) */
      dropTaskTo: (key, h, anchor) => {
        const X = shell.__insDly;
        const lt = INS.lot.find(l => !l.t && dlyLotPath(l.v).join(" / ") === h.parent);
        if (!lt) { renderTabK(); return; }
        let k = key;
        if (lt.id !== key.split("|")[0]) {
          const ek = X.sameIn(key, lt.id);
          if (ek) { X.mergeAsk(key, ek, anchor); return; }
          k = X.changeLot(key, lt.id, anchor); if (!k) { renderTabK(); return; } insSave(); insRenderChain();
        }
        /* v517 : tâche déplacée DANS SON LOT — seul son rang change dans le lot ; le lot reste à sa place
           (avant : ses tâches, dispersées dans l'ordre général, pouvaient faire descendre tout le lot en bas) */
        { const lo = k.split("|")[0];
          dlyOrder(dlyKeys());
          const D = INS.dord || [], S = D.filter(x => x.split("|")[0] === lo);
          const inS = x => !!x && x !== k && S.includes(x);
          if (S.length > 1 && (inS(h.before) || inS(h.afterKey) || (!h.before && !h.afterKey))) {
            const seq = S.filter(x => x !== k);
            if (inS(h.before)) seq.splice(seq.indexOf(h.before), 0, k);
            else if (inS(h.afterKey)) seq.splice(seq.indexOf(h.afterKey) + 1, 0, k);
            else seq.push(k);
            const at = D.findIndex(x => S.includes(x));
            const rest = D.filter(x => !S.includes(x)), nb = D.slice(0, at).filter(x => !S.includes(x)).length;
            rest.splice(nb, 0, ...seq);
            if (rest.join("\n") === D.join("\n")) { renderTabK(); return; }
            INS.dord = rest; dlyTasksFromPlan(); insSave();
            histLog("DÉLAIS", "ORDRE DES LIGNES", dlyName(k) + " (DANS SON LOT)");
            refreshAll(); return;
          }
          /* déposée à la limite du lot (devant la première tâche du lot suivant) : dernière de son lot */
          if (S.length > 1 && h.before && !S.includes(h.before)) {
            const seq = S.filter(x => x !== k).concat(k), at = D.findIndex(x => S.includes(x));
            const rest = D.filter(x => !S.includes(x)), nb = D.slice(0, at).filter(x => !S.includes(x)).length;
            rest.splice(nb, 0, ...seq);
            INS.dord = rest; dlyTasksFromPlan(); insSave(); histLog("DÉLAIS", "ORDRE DES LIGNES", dlyName(k) + " (DANS SON LOT)"); refreshAll(); return;
          }
        }
        if (h.before && h.before !== k) X.moveKeys([k], [h.before], false);
        else if (h.afterKey && h.afterKey !== k) X.moveKeys([k], [h.afterKey], true);
        else renderTabK();
      },
      dropTask: (key, tr, after) => {
        const X = shell.__insDly;
        let nl = null;
        if (tr.classList.contains("dly-task")) nl = String(tr.dataset.key).split("|")[0];
        else if (after) {
          const lt = INS.lot.find(x => dlyLotPath(x.v).join(" / ") === tr.dataset.path);
          if (!lt) { svToast("CHANGEMENT REFUSÉ : " + tr.dataset.path + " EST UN GROUPE, PAS UN LOT. LÂCHER LA TÂCHE PARMI LES TÂCHES D'UN LOT.", 4500, tr); return; }
          nl = lt.id;
        }
        let k = key;
        if (nl && nl !== key.split("|")[0]) {
          const ek = X.sameIn(key, nl);
          if (ek) { X.mergeAsk(key, ek, tr); return; }
          k = X.changeLot(key, nl, tr); if (!k) { renderTabK(); return; } insSave(); insRenderChain();
        }
        const g = tr.classList.contains("dly-task") ? null : (shell.__dlyRows || []).find(x => x.grp && x.path === tr.dataset.path);
        const ts = (g ? g.all.map(t => t.key) : [tr.dataset.key]).map(t => t === key ? k : t).filter(t => t && t !== k);
        if (ts.length) X.moveKeys([k], ts, after); else renderTabK();
      },
      linked: k => (INS.links || []).some(l => l.lot + "|" + l.sec === k),
      /* tâches retirées du planning (non liées seulement, règle G) : dates, liaisons de planning et jalon */
      removeTasks: keys => {
        keys.forEach(k => {
          if (INS.dlp) delete INS.dlp[k];
          if (LK.dlpDraft) delete LK.dlpDraft[k];
          if (INS.dpred) delete INS.dpred[k];
          if (INS.jal) delete INS.jal[k];
          Object.keys(INS.dpred || {}).forEach(s2 => { INS.dpred[s2] = dlyLinks(s2).filter(x => x.k !== k); if (!INS.dpred[s2].length) delete INS.dpred[s2]; });
          if (shell.__dlySel) shell.__dlySel.delete(k);
        });
        insSave();
      },
      /* nom modifié dans le PLANNING : même lot / même activité que dans TÂCHES (doublons refusés) */
      /* v533 : quiet = nom gardé sans redessiner (au début d'un glissement : la ligne sous le doigt ne doit pas disparaître) ;
         les chemins affichés sont mis à jour sur place, le tableau est redessiné à la fin du glissement */
      rename: (inp, opts = {}) => {
        const v = U_(sviClean(inp.value));
        const back = () => { if (opts.quiet) { inp.value = inp.defaultValue; return; } renderTabK(); };
        const done = () => { if (opts.quiet) { inp.defaultValue = inp.value = v; shell.__gnRefresh = true; } else refreshAll(); };
        if (inp.dataset.kind === "sec") {
          const id = inp.dataset.sid, r = INS.sec.find(x => x.id === id);
          if (!r || v === U_(r.v)) { back(); return; }
          if (!v) { svToast("NOM VIDE REFUSÉ.", 3000, inp); back(); return; }
          if (INS.sec.some(x => x.id !== id && U_(x.v) === v)) { svToast("ACTIVITÉ SECONDAIRE « " + v + " » EXISTE DÉJÀ.", 3500, inp); back(); return; }
          /* activité jumelle d'une activité primaire : renommées ensemble (si le nom est libre côté primaire) */
          const old = r.v, tw = INS.prim.find(p => p.tw === id && U_(p.v) === U_(old));
          if (tw && INS.prim.some(p => p !== tw && U_(p.v) === v)) { svToast("ACTIVITÉ PRIMAIRE « " + v + " » EXISTE DÉJÀ.", 3500, inp); back(); return; }
          r.v = v; if (tw) tw.v = v;
          insSave(); histLog("SAISIE", "ACTIVITÉ SECONDAIRE RENOMMÉE", old + " → " + v + (tw ? " (AVEC L'ACTIVITÉ PRIMAIRE)" : ""));
          done();
          return;
        }
        /* lot ou niveau de lot (« / ») : toutes les tâches dessous suivent */
        const segs = dlyLotPath(inp.dataset.path), lvl = segs.length;
        if (!v || v.includes("/")) { svToast(!v ? "NOM VIDE REFUSÉ." : "« / » SÉPARE LES GROUPES : NOM REFUSÉ.", 3500, inp); back(); return; }
        if (v === segs[lvl - 1] || (LVL_AUTO.test(segs[lvl - 1] || "") && v === U_(lotLab(segs).name))) { back(); return; }
        const hit = INS.lot.filter(x => !x.t && (() => { const p = dlyLotPath(x.v); return p.length >= lvl && segs.every((sg, i) => U_(p[i]) === U_(sg)); })());
        const nv = x => { const p = dlyLotPath(x.v); p[lvl - 1] = v; return p.join(" / "); };
        const ids = new Set(hit.map(x => x.id));
        const clash = hit.find(x => INS.lot.some(y => !ids.has(y.id) && U_(y.v) === U_(nv(x))));
        if (clash) { svToast("LOT « " + nv(clash) + " » EXISTE DÉJÀ.", 3500, inp); back(); return; }
        hit.forEach(x => { x.v = nv(x); });
        /* l'état replié suit le nouveau nom */
        { const f = dlyFoldAll(), o = dlyFoldK(inp.dataset.path); if (f[o]) { delete f[o]; f[dlyFoldK(segs.slice(0, lvl - 1).concat(v).join(" / "))] = 1; try { localStorage.setItem("svi_lotfold_v1", JSON.stringify(f)); } catch (e) {} } }
        insSave(); histLog("SAISIE", "LOT RENOMMÉ", inp.dataset.path + " → " + v + " (" + hit.length + " LOT(S))");
        if (opts.quiet) {
          const oldP = inp.dataset.path, newP = segs.slice(0, lvl - 1).concat(v).join(" / "), O = U_(oldP);
          shell.querySelectorAll("[data-path]").forEach(el => { const p = el.dataset.path, P = U_(p); if (P === O || P.startsWith(O + " / ")) el.dataset.path = newP + p.slice(oldP.length); });
        }
        done();
      },
      /* nouvelle tâche tapée dans le PLANNING : lot et activité secondaire repris s'ils existent, sinon créés (sans liaison) */
      newTask: (lv, sv, anchor) => {
        const Lv = dlyLotPath(U_(sviClean(lv))).map(x => x.trim()).filter(Boolean).join(" / "), Sv = U_(sviClean(sv));
        if (!Lv || !Sv) return;
        let lo = INS.lot.find(x => !x.t && U_(x.v) === Lv), se = INS.sec.find(x => U_(x.v) === Sv);
        const k0 = lo && se ? lo.id + "|" + se.id : "";
        if (k0 && dlyKeys().includes(k0)) { svToast("TÂCHE DÉJÀ DANS LE PLANNING : " + Lv + " › " + Sv + ".", 3500, anchor); setTimeout(() => dlyAddWin(lo.id, se.id), 60); return; }
        if (!lo) { lo = { id: insId(), v: Lv, on: false }; INS.lot.push(lo); }
        if (!se) { se = { id: insId(), v: Sv, on: false }; INS.sec.push(se); }
        const k = lo.id + "|" + se.id;
        INS.dlp = INS.dlp || {}; INS.dlp[k] = [{ id: insId(), deb: "", fin: "" }];
        INS.dord = (INS.dord || []).filter(x => x !== k).concat(k);
        dlyTasksFromPlan(); insSave();
        histLog("DÉLAIS", "TÂCHE AJOUTÉE AU PLANNING (SANS LIAISON)", Lv + " › " + Sv);
        refreshAll();
        setTimeout(() => dlyAddWin(lo.id, se.id), 60);
      },
      /* barre glissée de n jours : FIN seule (bout tiré) ou tâche entière, durée gardée (jours travaillés) */
      dragTo: (k, mode, n, a) => {
        const cal = insCal(), d0 = dlyDeb(k), f0 = dlyFin(k);
        if (!d0 || !f0) return;
        /* v547 (R22) : tâche en morceaux — glisser = tous les morceaux ; bout = FIN du dernier morceau */
        if (dlyList(k).length > 1) {
          const L = dlyDraftKey(k), last = L[L.length - 1];
          if (mode === "end") { let f = sviWNear(cal, sviIsoAdd(f0, n), n > 0 ? 1 : -1); if (f < last.deb) f = last.deb; if (INS.dbut && f > INS.dbut) { svToast("FIN REFUSÉE : APRÈS LA DATE BUTOIR DU " + dFr(INS.dbut) + ".", 3500, a); renderTabK(); return; } last.fin = f; delete last.fmd; }
          else { const pf = dlyPredFin(k); let d = sviWNear(cal, sviIsoAdd(d0, n), n > 0 ? 1 : -1); if (pf && d < pf) d = sviWNear(cal, pf, 1); dlyShiftList(L, d); }
          dlyCommitDrafts(); dlyRespect(false); insSave(); histLog("DÉLAIS", "TÂCHE EN MORCEAUX", dlyName(k) + " : " + dFr(dlyDeb(k)) + " → " + dFr(dlyFin(k))); renderTabK(); insRenderChain(); return;
        }
        if (mode === "end") { let f = sviWNear(cal, sviIsoAdd(f0, n), n > 0 ? 1 : -1); if (f < d0) f = d0; dlyApply(k, { deb: d0, fin: f }, { anchor: a, fromDur: true }); return; }
        const dur = sviWDur(cal, d0, f0) || 1, pf = dlyPredFin(k);
        let d = sviWNear(cal, sviIsoAdd(d0, n), n > 0 ? 1 : -1);
        /* glissée trop tôt : la barre revient à la première date permise par ses liaisons */
        if (pf && d < pf) d = sviWNear(cal, pf, 1);
        if (d === d0) { renderTabK(); insRenderChain(); return; }
        dlyApply(k, { deb: d, fin: sviWFin(cal, d, dur) }, { anchor: a });
      },
      pickPreds: k => dlyPickPreds(k), addWin: () => dlyAddWin(),
      scale: v => { try { localStorage.setItem("svi_dlyg_sc_v1", v); } catch (e) {} keepScroll(() => renderTab()); }, scaleOf: () => dlyScale(),
      go: k => { const [lo, se] = k.split("|"); LK.lot = lo; LK.sec = se; LK.prim = null; refreshAll(); },
      render: () => { renderTabK(); insRenderChain(); } } : null;
    /* budget ouvert, pour PARAMÉTRAGE › CALENDRIER et DATES DU BUDGET (15/10/2026) */
