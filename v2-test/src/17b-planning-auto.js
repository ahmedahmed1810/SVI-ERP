    /* ===== PLANNING AUTOMATIQUE — v530, v542, v543 =====
       v530 : demi-journées (une période peut commencer à midi : p.dmd === p.deb, ou finir à midi : p.fmd === p.fin).
       v543 (décisions du 23/10/2026 après-midi, cahier 04 PLANNING, R17 à R29) :
       - R25 : seulement les charges COCHÉES (plus de main-d'œuvre devinée par l'unité) ;
       - R21 : CAPACITÉ par ressource (un nombre, 0 = pénurie, ILLIMITÉ = pas de lissage), INS.plafR[clé] = { plaf, plafs: [{ d, n, after }] } ;
         valeur −1 (ou rien) = ILLIMITÉ ;
       - R23 : une coupe est rattachée aux tâches d'avant (after) : elle glisse avec leur fin ;
       - R24 : toutes les capacités réglées agissent ensemble ; la ressource la plus limitante fixe la durée (INS.dlim) ;
       - R26 / R27 : un seul calcul (GÉNÉRER = COMPRESSER) sur toutes les tâches, liaisons FIN → DÉBUT créées avec la tâche du dessus ;
         bouton grisé quand il n'y a rien à gagner ;
       - R17 : APPROVISIONNEMENT PRÉVISIONNEL ; R18 : réglages de l'histogramme. */

    /* ---------- ressource cochée (R9, R11, R25) ---------- */
    const dlyResSel = () => { const R = (INS.chg || []).filter(r => !r.t && r.on === true); return R.length ? R : null; };
    const dlyResU = r => dlyIsLab(r) ? "J-H" : (U_(r.u) || "U");
    const dlyResK = r => U_(r.des) + "|" + dlyResU(r);
    const dlyResQty = r => dlyIsLab(r) ? dlyJHof(r) : num(r.q || 0) || 0;
    /* même unité pour toutes les charges cochées : la QUANTITÉ est possible ; sinon MONTANT seulement (R11) */
    const dlySameU = R => !!R && new Set(R.map(dlyResU)).size === 1;
    /* réglages de l'histogramme (R18), mémorisés par budget : u = q | m, aff = j | c, cum = r | a */
    const dlyHSet = () => ({ u: "q", aff: "j", cum: "r", ...(INS.hset || {}) });
    const dlyResMode = R => dlyHSet().u === "q" && dlySameU(R) ? "q" : "m";
    /* part de chaque charge cochée dans une tâche (clé désignation | unité), en quantité ou en montant */
    const dlyResOf = (k, R, m = dlyResMode(R)) => {
      const ids = new Set(R.map(r => r.id)), out = new Map(), seen = new Set();
      (INS.links || []).forEach(l => {
        if (l.lot + "|" + l.sec !== k) return;
        (l.chg || []).forEach(e => {
          if (!ids.has(e.id) || seen.has(e.id)) return;
          seen.add(e.id);
          const r = INS.chg.find(x => x.id === e.id);
          if (!r) return;
          const v = m === "q" ? dlyResQty(r) : (num(r.q || 0) || 0) * (num(r.p || 0) || 0);
          if (v) out.set(dlyResK(r), (out.get(dlyResK(r)) || 0) + v);
        });
      });
      return out;
    };
    /* groupe de capacité de la sélection : les charges cochées, si elles ont une même unité (sinon pas de capacité) */
    /* v546 (R24) : en MONTANT, la capacité est une capacité de financement (DH par jour), même avec des unités différentes ;
       clé de groupe « DH: … » ; en QUANTITÉ, seulement des charges de même unité */
    const dlyCurGK = () => { const R = dlyResSel(); if (!R) return ""; const ks = [...new Set(R.map(dlyResK))].sort().join(" § "); return dlyResMode(R) === "q" ? ks : "DH: " + ks; };
    const dlyGM = gk => /^DH: /.test(String(gk));
    const dlyGKeys = gk => new Set(String(gk).replace(/^DH: /, "").split(" § "));
    const dlyGName = gk => (dlyGM(gk) ? "DH : " : "") + [...new Set(String(gk).replace(/^DH: /, "").split(" § ").map(x => x.split("|")[0]))].join(" + ");
    /* quantité (ou montant, m) d'un groupe dans une tâche (charges de ses liaisons dont la clé est dans le groupe) */
    const dlyGQ = (k, keys, m) => {
      let t = 0; const seen = new Set();
      (INS.links || []).forEach(l => {
        if (l.lot + "|" + l.sec !== k) return;
        (l.chg || []).forEach(e => { if (seen.has(e.id)) return; seen.add(e.id); const r = INS.chg.find(x => x.id === e.id); if (r && !r.t && keys.has(dlyResK(r))) t += m ? (num(r.q || 0) || 0) * (num(r.p || 0) || 0) : dlyResQty(r); });
      });
      return Math.round(t * 1000) / 1000;
    };
    /* R14 : tâche sans ouvriers (aucune charge de main-d'œuvre liée) */
    const dlyNoLab = k => !(INS.links || []).some(l => l.lot + "|" + l.sec === k && (l.chg || []).some(e => { const r = INS.chg.find(x => x.id === e.id); return r && !r.t && dlyIsLab(r); }));
    /* quantité de la sélection dans une tâche (aucune case cochée = 0 : R25) */
    const dlyResQ = k => { const gk = dlyCurGK(); return gk ? dlyGQ(k, dlyGKeys(gk), dlyGM(gk)) : 0; };
    /* réglage de capacité d'un groupe (créé à la demande) */
    const dlyCapSt = (gk = dlyCurGK()) => { if (!gk) return null; INS.plafR = INS.plafR || {}; return (INS.plafR[gk] = INS.plafR[gk] || {}); };
    /* valeur d'un morceau : nombre ≥ 1, 0 (pénurie) ou −1 (ILLIMITÉ, aussi quand rien n'est réglé) */
    const dlyCapV = v => v === undefined || v === null || v === "" || Number(v) < 0 ? -1 : Math.round(Number(v));
    /* groupes de capacité actifs ensemble (R24) : tous ceux réglés, plus la sélection */
    const dlyGroups = () => {
      const cur = dlyCurGK(), out = [];
      const has = st => st && (dlyCapV(st.plaf) >= 0 || (st.plafs || []).some(s => dlyCapV(s.n) >= 0));
      Object.keys(INS.plafR || {}).forEach(gk => { const st = INS.plafR[gk]; if (gk === cur || has(st)) out.push({ gk, keys: dlyGKeys(gk), m: dlyGM(gk), st: st || {} }); });
      if (cur && !out.some(g => g.gk === cur)) out.push({ gk: cur, keys: dlyGKeys(cur), m: dlyGM(cur), st: {} });
      return out;
    };
    /* coupes d'un groupe : { d, n, after } ; une coupe rattachée à des tâches (after) se place juste après leur fin (R23) */
    const dlyCutsOf = st => ((st && st.plafs) || []).filter(s => s && (s.d || (s.after || []).length));
    /* date d'une coupe d'après des fins connues (finOf(k) → iso ou "") ; null si une de ses tâches n'est pas encore placée */
    const dlyCutDate = (c, finOf) => {
      const K = (c.after || []).filter(k => dlyKeys().includes(k));
      if (!K.length) return c.d || null;
      let m = "";
      for (const k of K) { const f = finOf(k); if (f === null) return null; if (f && f > m) m = f; }
      return m ? sviWAdd(insCal(), m, 1) : (c.d || null);
    };
    /* morceaux affichés (dates actuelles) : [{ d: date de début ("" = départ), n, i }] */
    const dlyCapSegs = (gk = dlyCurGK()) => {
      const st = gk ? (INS.plafR || {})[gk] : null;
      const fin = k => dlyFin(k) || dlyDeb(k) || "";
      const segs = [{ d: "", n: dlyCapV(st && st.plaf), i: 0 }];
      dlyCutsOf(st).forEach((c, j) => { const d = dlyCutDate(c, fin) || c.d; if (d) segs.push({ d, n: dlyCapV(c.n), i: j + 1 }); });
      return segs.sort((a, b) => (a.d || "").localeCompare(b.d || ""));
    };
    /* v545 (remarque 5) : capacité de la sélection jamais réglée (ni nombre, ni ILLIMITÉ, ni coupe) */
    const dlyCapDef = (gk = dlyCurGK()) => { const st = gk ? (INS.plafR || {})[gk] : null; return !st || ((st.plaf === undefined || st.plaf === null || st.plaf === "") && !dlyCutsOf(st).length); };
    const dlyCapOf = (iso, gk) => { let n = -1; dlyCapSegs(gk).forEach(s => { if (!s.d || s.d <= iso) n = s.n; }); return n; };

    /* ---------- R3 : tâche INCOMPRESSIBLE ---------- */
    const dlyInc = k => !!(INS.dinc || {})[k];
    const dlyIncSet = (k, on) => { INS.dinc = INS.dinc || {}; if (on) INS.dinc[k] = 1; else delete INS.dinc[k]; };
    const dlyIncHTML = k => dlyInc(k) ? `<span class="dly-inc" data-key="${esc(k)}" role="button" title="TÂCHE INCOMPRESSIBLE">▣</span>` : "";
    const dlyIncWin = k => svChoose({ title: "TÂCHE INCOMPRESSIBLE",
      html: `<div class="svc-sub"><b>${esc(dlyName(k))}</b></div><div class="svc-sub">SA DATE OU SA DURÉE A ÉTÉ CHANGÉE À LA MAIN : COMPRESSER ET LA CAPACITÉ GARDENT SA DURÉE, MÊME AU-DESSUS DE LA CAPACITÉ.</div>`,
      buttons: [{ v: "off", label: "RENDRE COMPRESSIBLE", tone: "neutral" }] }).then(r => {
      if (r !== "off") return;
      dlyIncSet(k, false); insSave(); histLog("DÉLAIS", "TÂCHE COMPRESSIBLE", dlyName(k)); renderTabK();
    });
    /* R24 : tâche dont la durée est fixée par une autre ressource que la sélection */
    const dlyLimHTML = k => { const g = (INS.dlim || {})[k]; return g && g !== dlyCurGK() ? `<span class="gb-lim" data-key="${esc(k)}" role="button">⧖</span>` : ""; };
    const dlyLimTxt = k => { const g = (INS.dlim || {})[k]; if (!g) return ""; const n = dlyCapOf(dlyDeb(k) || "", g); return "DURÉE FIXÉE PAR " + dlyGName(g) + (n >= 0 ? " (CAPACITÉ " + n + ")" : ""); };

    /* date de début du projet (INF), sinon celle de la génération, sinon le premier début */
    const dlyProjStart = () => INS.pdeb || INS.gdeb || dlyKeys().map(dlyDeb).filter(Boolean).sort()[0] || sviIsoOf(new Date());
    /* demi-journées d'une période : début à midi, fin à midi */
    const dlyHalfS = p => !!(p && p.deb && p.dmd === p.deb);
    const dlyHalfE = p => !!(p && p.fin && p.fmd === p.fin);
    /* DURÉE (J) d'une tâche : jours travaillés, moins les demi-journées (1,5 J…) */
    const dlyDurK = k => {
      const L = dlyList(k), p = L[0], d0 = dlyDeb(k), f0 = dlyFin(k);
      if (!d0 || !f0) return "";
      /* v547 (R22) : tâche en morceaux = somme des morceaux */
      if (L.length > 1) { const t = L.filter(q => q.deb && q.fin).reduce((a, q) => a + (Number(dDur(q.deb, q.fin)) || 0) - (dlyHalfS(q) ? .5 : 0) - (dlyHalfE(q) ? .5 : 0), 0); return t === Math.round(t) ? t : String(t).replace(".", ","); }
      const n = dDur(d0, f0);
      if (n === "" || L.length !== 1) return n;
      const v = n - (dlyHalfS(p) ? .5 : 0) - (dlyHalfE(p) ? .5 : 0);
      return v === Math.round(v) ? v : String(v).replace(".", ",");
    };
    const dlyHalves = k => Math.max(1, Math.round((Number(String(dlyDurK(k)).replace(",", ".")) || 1) * 2));
    /* tâches de haut en bas : l'ordre enregistré du PLANNING */
    const dlyTopDown = keys => { const K = new Set(keys); return [...dlyOrder(keys).keys()].filter(k => K.has(k)); };

    /* ---------- R26 : le calcul (sans rien écrire) ----------
       ordre : l'ordre du PLANNING ; les tâches datées y sont rangées par date de début, les autres restent à leur rang ;
       les liaisons existantes passent avant (prédécesseurs d'abord). Chaque tâche part de la tâche du dessus, en demi-journées,
       sous toutes les capacités (R24) ; liaison FIN → DÉBUT créée avec la tâche du dessus si aucune n'existe entre elles. */
    /* v570 (remarque longue 1) : opts.gen = GÉNÉRER seul — les tâches déjà datées ne bougent pas (elles occupent leurs ouvriers),
       seules les tâches sans dates (ou sans FIN : leur DÉBUT est gardé) sont placées ; liaisons manquantes proposées autour d'elles */
    const dlyPlanCompute = (opts = {}) => {
      const cal = insCal(), keys = dlyKeys(), td = dlyTopDown(keys);
      const deb = k => dlyDeb(k), dated = td.filter(deb).sort((a, b) => deb(a).localeCompare(deb(b)));
      let di = 0; const L0 = td.map(k => deb(k) ? dated[di++] : k);
      /* prédécesseurs d'abord (tri stable) */
      const pos = new Map(L0.map((k, i) => [k, i])), done = new Set(), L = [];
      const rest = [...L0];
      for (let g = 0; rest.length && g < 100000; g++) {
        let i = rest.findIndex(k => dlyPreds(k).every(p => !pos.has(p) || done.has(p)));
        if (i < 0) i = 0;
        const k = rest.splice(i, 1)[0]; done.add(k); L.push(k);
      }
      const start = sviWNear(cal, dlyProjStart(), 1), days = [start];
      const dayAt = i => { while (days.length <= i) days.push(sviWAdd(cal, days[days.length - 1], 1)); return days[Math.max(0, i)]; };
      const dayIx = iso => { if (!iso || iso <= days[0]) return 0; let i = 0; while (dayAt(i) < iso && i < 20000) i++; return i; };
      const slotOf = iso => dayIx(iso) * 2;
      const G = dlyGroups();
      /* v570 : chaque charge de main-d'œuvre est aussi un groupe (sans limite si sa CAPACITÉ est vide) — sa durée en découle */
      { const seen = new Set(); G.forEach(g => g.keys.forEach(x => seen.add(x)));
        (INS.chg || []).filter(r => !r.t && dlyIsLab(r)).forEach(r => { const sk = dlyResK(r); if (seen.has(sk)) return; seen.add(sk); G.push({ gk: sk, keys: new Set([sk]), m: false, st: (INS.plafR || {})[sk] || {} }); }); }
      const used = G.map(() => ({}));
      const S = {}, D = {}, lim = {};
      /* capacité d'un groupe pour une demi-journée : coupes rattachées aux tâches déjà placées (R23) */
      const finOf = k => S[k] ? (S[k].b >= S[k].a ? dayAt(S[k].b >> 1) : dayAt(S[k].a >> 1)) : (pos.has(k) ? null : (dlyFin(k) || ""));
      const capAt = (g, s) => {
        const iso = dayAt(s >> 1);
        let n = dlyCapV(g.st.plaf);
        const cs = dlyCutsOf(g.st).map(c => ({ d: dlyCutDate(c, finOf), n: dlyCapV(c.n) })).filter(c => c.d).sort((a, b) => a.d.localeCompare(b.d));
        cs.forEach(c => { if (c.d <= iso) n = c.n; });
        return n < 0 ? Infinity : n * .5;
      };
      const dead = (g, s) => { const iso = dayAt(s >> 1);
        return !dlyCutsOf(g.st).some(c => { const d = dlyCutDate(c, finOf); return dlyCapV(c.n) !== 0 && (!d || d > iso); }); };
      const place = (k, s0, dry) => {
        const q = G.map(g => dlyGQ(k, g.keys, g.m)), rel = G.map((g, i) => i).filter(i => q[i] > 0);
        const own = deb(k) && dlyFin(k) ? dlyHalves(k) : 0;
        const over = dry ? G.map(() => ({})) : used, U = (i, s) => (used[i][s] || 0) + (dry ? (over[i][s] || 0) : 0);
        const take = (i, s, v) => { over[i][s] = (over[i][s] || 0) + v; };
        if ((dlyInc(k) && own) || (!rel.length && own)) {
          /* v546 (R33) : une tâche INCOMPRESSIBLE garde sa durée mais attend la première place où elle tient sous les capacités
             (si elle ne tient nulle part : à sa place, pic accepté) */
          let st = s0;
          if (rel.length) {
            const fits = a => rel.every(i => { for (let s = a; s < a + own; s++) if (U(i, s) + q[i] / own > capAt(G[i], s) + 1e-9) return false; return true; });
            let t = s0; for (let g = 0; g < 2000 && !fits(t); g++) t++;
            if (fits(t)) st = t;
          }
          rel.forEach(i => { for (let s = st; s < st + own; s++) take(i, s, q[i] / own); });
          return { a: st, b: st + own - 1 };
        }
        if (!rel.length) return { a: s0, b: s0 - 1, zero: true };
        let rem = 1, a = null, b = s0, s = s0;
        const cnt = {}, got = [];
        for (let g = 0; rem > 1e-9 && g < 40000; g++, s++) {
          let f = rem, li = -1;
          rel.forEach(i => {
            const c = capAt(G[i], s);
            const al = c === Infinity ? (own ? 1 / own : .5 / q[i]) : Math.max(0, c - U(i, s)) / q[i];
            if (al < f - 1e-12) { f = al; li = i; }
          });
          if (li >= 0) cnt[li] = (cnt[li] || 0) + 1;
          /* v585 : plus aucune capacité plus loin pour ce groupe = la tâche ne pourra jamais être placée : arrêt (au lieu de 40 000 essais) */
          if (f <= 1e-9 && li >= 0 && capAt(G[li], s) === 0 && dead(G[li], s)) throw { dlyStuck: true };
          if (f > 1e-9) { rel.forEach(i => take(i, s, f * q[i])); rem -= f; if (a === null) a = s; b = s; got.push(s); }
        }
        if (!dry) { const best = Object.keys(cnt).sort((x, y) => cnt[y] - cnt[x])[0]; if (best !== undefined) lim[k] = G[best].gk; }
        return { a: a === null ? s0 : a, b, got };
      };
      const hasR = k => G.some(g => dlyGQ(k, g.keys, g.m) > 0);
      const links = [], FX = new Set();
      /* v570 : GÉNÉRER seul — les tâches complètes sont posées d'abord, à leurs dates, et occupent la capacité */
      if (opts.gen) L.forEach(k => {
        const P0 = dlyList(k).filter(p => p.deb && p.fin);
        if (!P0.length) return;
        FX.add(k);
        const sl = P0.map(p => ({ a: slotOf(p.deb) + (dlyHalfS(p) ? 1 : 0), b: slotOf(p.fin) + (dlyHalfE(p) ? 0 : 1) }));
        S[k] = { a: Math.min(...sl.map(x => x.a)), b: Math.max(...sl.map(x => x.b)) };
        D[k] = { deb: P0[0].deb, fin: P0[P0.length - 1].fin, dm: dlyHalfS(P0[0]) ? 1 : 0, fm: dlyHalfE(P0[P0.length - 1]) ? 1 : 0 };
        const n = sl.reduce((t, x) => t + (x.b - x.a + 1), 0) || 1;
        G.forEach((g, i) => { const q = dlyGQ(k, g.keys, g.m); if (q > 0) sl.forEach(x => { for (let s = x.a; s <= x.b; s++) used[i][s] = (used[i][s] || 0) + q / n; }); });
      });
      L.forEach((k, idx) => {
        const pre = idx ? L[idx - 1] : null;
        if (FX.has(k)) return;
        let e = 0;
        /* v578 (partie 11, remarque 10) : FIN → DÉBUT respecté — la suivante commence au plus tôt la demi-journée qui suit la fin de la précédente */
        if (pre && S[pre]) e = Math.max(e, S[pre].b + 1);
        dlyLinks(k).forEach(x => {
          const P = S[x.k];
          if (!P) return;
          if (x.t === "DD") e = Math.max(e, slotOf(sviWAdd(cal, D[x.k].deb, Math.max(0, x.o || 0))) + (D[x.k].dm ? 1 : 0));
          /* v544 : 0 = le jour même (dès qu'il reste des ouvriers libres), n = n jours travaillés après la fin */
          else if (!(x.o > 0)) e = Math.max(e, P.b + 1);
          else e = Math.max(e, slotOf(sviWAdd(cal, D[x.k].fin || D[x.k].deb, x.o)));
        });
        /* une seule date : elle sert d'ancrage (R26) */
        const d0 = deb(k), f0 = dlyFin(k);
        if (d0 && !f0) e = opts.gen ? slotOf(d0) : Math.max(e, slotOf(d0));
        if (!d0 && f0) { const t = place(k, e, true), n = t.b - t.a + 1, end = dayIx(f0) * 2 + 1; e = Math.max(e, end - n + 1); }
        const r = place(k, e, false);
        S[k] = r;
        D[k] = r.zero ? { deb: dayAt(r.a >> 1), fin: "", dm: r.a & 1, fm: 0 } : { deb: dayAt(r.a >> 1), fin: dayAt(r.b >> 1), dm: r.a & 1, fm: (r.b & 1) ? 0 : 1 };
        /* v547 (R22) : la tâche est coupée quand des demi-journées sans place l'interrompent (ses ouvriers vont ailleurs) */
        if (r.got && r.got.length && r.got[r.got.length - 1] - r.got[0] + 1 > r.got.length) {
          const runs = []; r.got.forEach(s => { const u = runs[runs.length - 1]; if (u && s === u[1] + 1) u[1] = s; else runs.push([s, s]); });
          D[k].per = runs.map(([s1, s2]) => ({ deb: dayAt(s1 >> 1), fin: dayAt(s2 >> 1), dm: s1 & 1, fm: (s2 & 1) ? 0 : 1 }));
        }
        if (pre && !dlyLinks(k).some(x => x.k === pre) && !dlyLinks(pre).some(x => x.k === k) && !dlyReach(pre, k)) links.push([pre, k]);
      });
      /* v570 : GÉNÉRER seul — on n'écrit que les tâches placées ; liaisons proposées seulement si l'une des deux était sans dates */
      if (opts.gen) { FX.forEach(k => { delete D[k]; }); return { D, S, links: links.filter(([a, b]) => !FX.has(a) || !FX.has(b)), lim, gen: true }; }
      return { D, S, links, lim };
    };
    /* décalage d'une liaison FIN → DÉBUT créée (v544) : 0 = le jour même où finit a, 1 = le lendemain… */
    const dlyChainO = (a, b, D) => {
      const da = D[a] || { deb: dlyDeb(a), fin: dlyFin(a) }, dbb = D[b] || { deb: dlyDeb(b) };
      const cal = insCal(), fa = da.fin || da.deb, db = dbb.deb;
      return db > fa ? Math.max(1, (Number(sviWDur(cal, fa, db)) || 2) - 1) : 0;
    };
    /* y a-t-il quelque chose à gagner ? (R27) */
    const dlyCanCompress = (opts = {}) => {
      if (!dlyKeys().length) return { ok: false, why: "AUCUNE TÂCHE AU PLANNING." };
      if (opts.gen && !dlyKeys().some(k => !(dlyDeb(k) && dlyFin(k)))) return { ok: false, why: "TOUTES LES TÂCHES ONT DÉJÀ LEURS DATES." };
      let P;
      /* v585 : capacité 0 jusqu'à la fin = arrêt immédiat du calcul, planning inchangé */
      try { P = dlyPlanCompute(opts); } catch (e) { if (e && e.dlyStuck) return { ok: false, stuck: true, why: "CAPACITÉ 0 JUSQU'À LA FIN : AUCUNE TÂCHE NE PEUT ÊTRE PLACÉE." }; throw e; }
      /* v547 (R22) : comparaison morceau par morceau */
      const sigC = k => dlyList(k).map(p => [p.deb || "", p.fin || "", dlyHalfS(p) ? 1 : 0, dlyHalfE(p) ? 1 : 0].join(",")).join(";");
      const sigP = x => (x.per || [x]).map(q => [q.deb || "", q.fin || "", q.dm ? 1 : 0, q.fm && q.fin ? 1 : 0].join(",")).join(";");
      const same = Object.keys(P.D).every(k => sigC(k) === sigP(P.D[k]));
      return same && !P.links.length ? { ok: false, why: "RIEN À AJUSTER : AUCUN JOUR NE DÉPASSE LA CAPACITÉ ET AUCUN JOUR À GAGNER." } : { ok: true, P };
    };
    const dlyHasDates = () => dlyKeys().some(k => dlyDeb(k) && dlyFin(k));
    /* dates calculées → brouillon de la tâche (une seule période), demi-journées comprises */
    const dlyWriteH = D => {
      Object.keys(D).forEach(k => {
        const x = D[k], L = dlyDraftKey(k);
        /* v547 (R22) : un morceau par période calculée */
        const nl = (x.per || [x]).map((q, i) => {
          const p = { ...(L[i] || {}), id: (L[i] || {}).id || insId() };
          p.deb = q.deb; p.fin = q.fin || "";
          if (q.dm) p.dmd = q.deb; else delete p.dmd;
          if (q.fm && q.fin) p.fmd = q.fin; else delete p.fmd;
          return p;
        });
        L.splice(0, L.length, ...nl);
      });
    };
    const DLY_BUT_MSG = "AVEC CE NOMBRE VOUS RISQUEZ DE DÉPASSER LA DATE BUTOIR";
    /* R26 : GÉNÉRER = COMPRESSER — un seul calcul, enregistré aussitôt (↶ annule) */
    const dlyCompressRun = (opts = {}) => {
      const C = dlyCanCompress({ gen: !!opts.gen });
      if (!C.ok) {
        if (C.stuck) { svToast(C.why, 5000, opts.anchor); insSave(); renderTabK(); return null; }
        if (opts.plaf !== undefined) {
          /* R24 : la capacité de la sélection n'a plus d'effet — dire quelle ressource bloque */
          const cur = dlyCurGK(), by = cur ? [...new Set(dlyKeys().filter(k => dlyResQ(k) > 0).map(k => (INS.dlim || {})[k]).filter(g => g && g !== cur))] : [];
          svToast(by.length ? "BLOQUÉ PAR : " + by.map(dlyGName).join(", ") + "." : "AUCUN GAIN AVEC CE NOMBRE.", 3500, opts.anchor);
          insSave(); renderTabK();
        } else if (!opts.quiet) svToast(C.why, 3500, opts.anchor);
        return null;
      }
      const P = C.P, f0 = dlyEnd(dlyCurDates()), gen = !!opts.gen || !dlyHasDates();
      dlyWriteH(P.D);
      dlyCommitDrafts();
      INS.dpred = INS.dpred || {};
      P.links.forEach(([a, b]) => { INS.dpred[b] = dlyLinks(b).concat([{ k: a, t: "FD", o: dlyChainO(a, b, P.D) }]); });
      const cur = dlyCurGK();
      if (!opts.gen) INS.dlim = {};
      INS.dlim = INS.dlim || {}; Object.keys(P.lim).forEach(k => { if (P.lim[k] !== cur) INS.dlim[k] = P.lim[k]; });
      if (!INS.gdeb) INS.gdeb = dlyProjStart();
      insSave();
      const f1 = dlyEnd(dlyCurDates());
      histLog("DÉLAIS", gen ? "GÉNÉRER LE PLANNING" : "COMPRESSER LE PLANNING", (opts.plaf !== undefined ? "CAPACITÉ " + (opts.plaf < 0 ? "ILLIMITÉE" : opts.plaf) + " — " : "") + "FIN " + dFr(f0) + " → " + dFr(f1) + (P.links.length ? " — " + P.links.length + " LIAISON(S) CRÉÉE(S)" : ""));
      renderTabK(); insRenderChain();
      if (opts.plaf === undefined) svToast((opts.gen ? "TÂCHES SANS DATES GÉNÉRÉES" : gen ? "PLANNING GÉNÉRÉ" : "PLANNING COMPRESSÉ") + " — FIN LE " + dFr(f1) + (P.links.length ? " — " + P.links.length + " LIAISON(S) PROPOSÉE(S)" : "") + ".", 3500);
      if (INS.dbut && f1 > INS.dbut) svToast(DLY_BUT_MSG + " (FIN LE " + dFr(f1) + ", BUTOIR LE " + dFr(INS.dbut) + ").", 5000, opts.anchor);
      return P.D;
    };
    /* v570 (remarque longue 1) : une seule commande ↻ = fenêtre GÉNÉRER / COMPRESSER — deux cases et la liste des CAPACITÉS
       (une ligne par charge de main-d'œuvre ; vide = sans limite ; la même valeur que le trait CAPACITÉ du graphique) */
    const dlyGCWin = () => {
      const miss = dlyKeys().filter(k => !(dlyDeb(k) && dlyFin(k))).length;
      const labs = []; { const seen = new Set(); (INS.chg || []).filter(r => !r.t && dlyIsLab(r)).forEach(r => { const sk = dlyResK(r); if (!seen.has(sk)) { seen.add(sk); labs.push(sk); } }); }
      labs.sort((a, b) => a.localeCompare(b, "fr"));
      const capTxt = sk => { const st = (INS.plafR || {})[sk]; const v = st ? dlyCapV(st.plaf) : -1; return v >= 0 ? String(v) : ""; };
      const cut = sk => dlyCutsOf((INS.plafR || {})[sk]).length > 0;
      const d = document.createElement("div");
      d.id = "svConf";
      d.innerHTML = `<div class="svc-card hcf-card gc-card" role="dialog" aria-modal="true">
        <button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
        <div class="svc-t">GÉNÉRER / COMPRESSER</div>
        <div class="hcf-cbs gc-cbs">
          <label${miss ? "" : ' class="off" data-why="TOUTES LES TÂCHES ONT DÉJÀ LEURS DATES."'}><input type="checkbox" class="gc-gen"${miss ? " checked" : " disabled"}><span>GÉNÉRER${miss ? " (" + miss + " TÂCHE" + (miss > 1 ? "S" : "") + " SANS DATES)" : ""}</span></label>
          <label><input type="checkbox" class="gc-comp"${miss ? "" : " checked"}><span>COMPRESSER</span></label>
        </div>
        <div class="hcf-note">GÉNÉRER : COMPLÈTE SEULEMENT CE QUI MANQUE (UN DÉBUT DÉJÀ SAISI EST GARDÉ). COMPRESSER : FAIT AVANCER TOUTES LES TÂCHES POUR REMPLIR LES JOURNÉES, LIAISONS ET TÂCHES INCOMPRESSIBLES RESPECTÉES. LES LIAISONS EXISTANTES SONT GARDÉES ; LES LIAISONS FIN → DÉBUT MANQUANTES SONT PROPOSÉES.</div>
        <div class="svc-sub">CAPACITÉS (OUVRIERS PAR JOUR) — VIDE = SANS LIMITE</div>
        ${labs.length ? `<table class="apr-t gc-t"><tr><th>MAIN-D'ŒUVRE</th><th>UNITÉ</th><th>CAPACITÉ</th></tr>${labs.map(sk => `<tr><td>${esc(sk.split("|")[0])}</td><td class="center">${esc(sk.split("|")[1])}</td><td>${cut(sk) ? '<span class="gc-cut">COUPÉE SUR LE GRAPHIQUE</span>' : `<input class="gc-cap hcf-pct" data-sk="${esc(sk)}" inputmode="numeric" value="${esc(capTxt(sk))}">`}</td></tr>`).join("")}</table>` : `<div class="hcf-note">AUCUNE CHARGE DE MAIN-D'ŒUVRE DANS LE BUDGET.</div>`}
        <div class="svc-f"><button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>LANCER</button></div></div>`;
      document.getElementById("svConf")?.remove();
      document.body.appendChild(d);
      const g = d.querySelector(".gc-gen"), c = d.querySelector(".gc-comp");
      /* COMPRESSER seul impossible tant qu'il manque des dates : cocher COMPRESSER coche GÉNÉRER */
      c.addEventListener("change", () => { if (c.checked && miss) g.checked = true; });
      g.addEventListener("change", () => { if (!g.checked && c.checked && miss) c.checked = false; });
      d.addEventListener("click", e => {
        { const o = e.target.closest && e.target.closest("label.off[data-why]"); if (o) { svToast(o.dataset.why, 3000, o); return; } }
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
        if (!e.target.closest("[data-ok]")) return;
        const bad = [...d.querySelectorAll(".gc-cap")].find(i => String(i.value).trim() !== "" && !/^\d+$/.test(String(i.value).trim()));
        if (bad) { svToast("CAPACITÉ : NOMBRE ENTIER D'OUVRIERS (VIDE = SANS LIMITE).", 3000, bad); return; }
        if (!g.checked && !c.checked) { svToast("COCHER GÉNÉRER OU COMPRESSER.", 3000, g); return; }
        INS.plafR = INS.plafR || {};
        d.querySelectorAll(".gc-cap").forEach(i => { const v = String(i.value).trim(), sk = i.dataset.sk; if (v === "") { if (INS.plafR[sk]) delete INS.plafR[sk].plaf; } else (INS.plafR[sk] = INS.plafR[sk] || {}).plaf = Number(v); });
        d.remove();
        if (c.checked) dlyCompressRun(); else dlyCompressRun({ gen: true });
      });
    };
    const dlyGenComp = () => dlyGCWin();

    /* ---------- R21 à R23 : CAPACITÉ ---------- */
    /* couper la barre à une date : les tâches qui commencent avant restent dans le morceau de gauche (la coupe les suit) */
    const dlyCutPlaf = iso => {
      const st = dlyCapSt();
      if (!st) { svToast("COCHER DES CHARGES POUR RÉGLER UNE CAPACITÉ.", 3000); return; }
      const cal = insCal(), d = sviWNear(cal, iso, 1);
      if (dlyCapSegs().some(s => s.d === d)) { svToast("LA CAPACITÉ EST DÉJÀ COUPÉE LE " + dFr(d) + ".", 3000); return; }
      const after = dlyKeys().filter(k => dlyDeb(k) && dlyDeb(k) < d && dlyResQ(k) > 0);
      st.plafs = (st.plafs || []).concat([{ d, n: dlyCapOf(d), after }]);
      insSave(); histLog("DÉLAIS", "CAPACITÉ COUPÉE", dFr(d)); renderTabK();
    };
    /* R22 : toucher le « / » d'une coupe = la supprimer (les deux morceaux se réunissent, valeur du morceau de gauche) */
    const dlyDelCut = i => {
      const S = dlyCapSegs(), s = S.find(x => x.i === i), st = dlyCapSt();
      if (!s || !st) return;
      /* v585 : le morceau fusionné garde une capacité qui permet de travailler — celle de droite quand la gauche est à 0,
         sinon au choix (pas de question quand les deux sont égales) */
      const L = S[S.indexOf(s) - 1] || S[0], nl = L.n, nr = s.n, lab = n => n < 0 ? "ILLIMITÉE" : String(n);
      const ask = nl !== nr && nl !== 0;
      svChoose({ title: "SUPPRIMER LA COUPE", html: `<div class="svc-sub">SUPPRIMER LA COUPE DU ${esc(dFr(s.d))} ?${ask ? "<br>CAPACITÉ À GARDER POUR LE MORCEAU FUSIONNÉ :" : ""}</div>`,
        buttons: ask ? [{ v: "l", label: "GAUCHE : " + lab(nl) }, { v: "r", label: "DROITE : " + lab(nr) }] : [{ v: "go", label: "SUPPRIMER", tone: "danger" }] }).then(r => {
        if (r !== "go" && r !== "l" && r !== "r") return;
        const keep = r === "l" ? nl : r === "r" || nl === 0 ? nr : nl;
        if (keep !== nl) { if (!L.i) st.plaf = keep; else if ((st.plafs || [])[L.i - 1]) st.plafs[L.i - 1].n = keep; }
        st.plafs = (st.plafs || []).filter((c, j) => j + 1 !== i);
        histLog("DÉLAIS", "COUPE SUPPRIMÉE", dFr(s.d));
        dlyCompressRun({ plaf: dlyCapOf(s.d), quiet: true });
      });
    };
    /* v546 (R19) : coupe déplacée à une autre date (seulement si les deux morceaux ont la même capacité) */
    const dlyMoveCut = (i, iso) => {
      const st = dlyCapSt(), c = st && (st.plafs || [])[i - 1];
      if (!c) return;
      const d = sviWNear(insCal(), iso, 1);
      if (dlyCapSegs().some(x => x.d === d && x.i !== i)) { svToast("LA CAPACITÉ EST DÉJÀ COUPÉE LE " + dFr(d) + ".", 3000); return; }
      c.d = d; c.after = dlyKeys().filter(k => dlyDeb(k) && dlyDeb(k) < d && dlyResQ(k) > 0);
      histLog("DÉLAIS", "COUPE DÉPLACÉE", dFr(d));
      dlyCompressRun({ plaf: dlyCapOf(d), quiet: true });
    };
    /* morceau tiré : n (≥ 1, 0 = pénurie, −1 = ILLIMITÉ) ; i = 0 : premier morceau ; le planning est recompressé (R2) */
    const dlySetPlaf = (i, n, anchor) => {
      const st = dlyCapSt();
      if (!st) return;
      n = n < 0 ? -1 : Math.round(n);
      if (!i) st.plaf = n;
      else { const c = (st.plafs || [])[i - 1]; if (!c) return; c.n = n; }
      histLog("DÉLAIS", "CAPACITÉ", (i ? "MORCEAU " + (i + 1) + " : " : "") + (n < 0 ? "ILLIMITÉE" : n));
      dlyCompressRun({ plaf: n, quiet: true, anchor });
    };

    /* ---------- histogramme : données, R17 approvisionnement, R18 réglages ---------- */
    const DLY_SER = ["#f79009", "#7a5af8", "#ee46bc", "#06aed4", "#a15c07", "#fdb022", "#9e165f"];   /* v588 : plus de gris dans les séries (le gris = hors DÉBUT – FIN) */
    /* hauteur de l'histogramme : nombre de pixels (28 = miniaturisé en bas) ou « full » (plein écran, à la place du Gantt) */
    /* v546 (R25) : 0 = histogramme entièrement caché (poignée tout en bas) */
    const dlyHHGet = () => { if (active === "gra") return "full"; let v = ""; try { v = localStorage.getItem("svi_dlyhh_v1") || ""; } catch (e) {} return v === "full" ? "full" : v === "0" ? 0 : Math.max(28, Math.min(2000, Number(v) || 110)); };
    const dlyHHSet = v => { try { localStorage.setItem("svi_dlyhh_v1", String(v)); } catch (e) {} };
    const dlyHSetPut = o => { INS.hset = { ...dlyHSet(), ...o }; insSave(); renderTabK(); };
    /* R19 / R20 : plage DÉBUT – FIN et filtre MIN – MAX (mémorisés par budget) */
    const dlyHRange = () => ({ a: "", b: "", ...(INS.hrange || {}) });
    const dlyHVal = () => ({ min: null, max: null, ...(INS.hval || {}) });
    /* consommation jour par jour de chaque charge cochée (répartie sur les jours travaillés de chaque tâche, demi-journées comprises) */
    /* v546 (R29) : courbes affichées — c = CHARGES, p = PRODUITS, g = MARGE (PRODUITS et MARGE : en MONTANT) */
    const dlyCrb = () => { const c = dlyHSet().crb; return Array.isArray(c) && c.length ? c : ["c"]; };
    /* produits retenus : cochés dans DÉTAIL PRODUITS, sinon ceux des lignes cochées des autres blocs, sinon tous */
    const dlyPrdSel = () => {
      const all = (INS.prd || []).filter(r => !r.t), on = all.filter(r => r.on === true);
      if (on.length) return on;
      let S = null; try { S = insCheckSet("prd"); } catch (e) { S = null; }
      return S ? all.filter(r => S.has(r.id)) : all;
    };
    /* valeur des produits par jour (répartie sur les jours de leur tâche) */
    const dlyPrdDays = cur => {
      const cal = insCal(), out = {}, det = {};
      dlyPrdSel().forEach(r => {
        const l = (INS.links || []).find(x => (x.prd || []).some(y => y.id === r.id));
        const k = l && l.lot + "|" + l.sec, p = k && cur[k], v = insHT("prd", r);
        if (!p || !v) return;
        const D2 = []; (p.per && p.per.length ? p.per : [p]).forEach(q => { const n = sviWDur(cal, q.deb, q.fin) || 1; for (let i = 0, x = sviWNear(cal, q.deb, 1); i < n; i++, x = sviWAdd(cal, x, 1)) D2.push(x); });
        D2.forEach(x => { out[x] = (out[x] || 0) + v / D2.length; (det[x] = det[x] || {})[k] = ((det[x] || {})[k] || 0) + v / D2.length; });
      });
      return { L: out, det };
    };
    /* v569 (remarque 13) : RENDEMENT par charge — l'activité secondaire choisie dans le bloc TÂCHES (case ou rond ; sinon celle des charges
       cochées si elle est unique) ; une courbe par charge cochée (un titre coché = toutes ses charges) : quantité produite de l'activité
       ÷ quantité de la charge, jour par jour ; une charge absente de l'activité reste dans la légende, en gris */
    const dlyRdData = H => {
      if (!H || !(H.crb || []).includes("r")) return null;
      const R = dlyResSel();
      if (!R) return { why: "RENDEMENT : COCHER DES CHARGES DANS DÉTAIL CHARGES." };
      const cur = dlyCurDates(), cal = insCal();
      let A = null;
      { const on = (INS.sec || []).filter(s => s.on === true).map(s => s.id); if (on.length === 1) A = on[0]; else if (on.length > 1) return { why: "RENDEMENT : UNE SEULE ACTIVITÉ SECONDAIRE À LA FOIS (" + on.length + " COCHÉES DANS TÂCHES)." }; }
      if (!A && LK && LK.sec) A = LK.sec;
      if (!A) { const S = new Set(); Object.keys(cur).forEach(k => { if (dlyResOf(k, R, "q").size) S.add(k.split("|")[1]); }); if (S.size === 1) A = [...S][0]; else return { why: "RENDEMENT : CHOISIR UNE ACTIVITÉ SECONDAIRE DANS LE BLOC TÂCHES." }; }
      const T = Object.keys(cur).filter(k => k.split("|")[1] === A);
      const us = new Set(), PT = {}, ser = new Map();
      T.forEach(k => {
        const [lo, se] = k.split("|"), P = new Map();
        (INS.links || []).filter(l => l.lot === lo && l.sec === se).forEach(l => (l.prd || []).forEach(x => { const r = INS.prd.find(y => y.id === x.id); if (r) P.set(r.id, r); }));
        let q = 0; P.forEach(r => { us.add(U_(r.u) || "U"); q += insPrdQ(r) || 0; });
        const p = cur[k]; if (!p) return;
        const D2 = []; (p.per && p.per.length ? p.per : [p]).forEach(qq => { const n = sviWDur(cal, qq.deb, qq.fin) || 1; for (let i = 0, x = sviWNear(cal, qq.deb, 1); i < n; i++, x = sviWAdd(cal, x, 1)) D2.push(x); });
        if (!D2.length) return;
        D2.forEach(x => { PT[x] = (PT[x] || 0) + q / D2.length; });
        dlyResOf(k, R, "q").forEach((v, sk) => {
          if (!ser.has(sk)) ser.set(sk, { sk, P: {}, C: {} });
          const S = ser.get(sk); D2.forEach(x => { S.C[x] = (S.C[x] || 0) + v / D2.length; S.P[x] = (S.P[x] || 0) + q / D2.length; });
        });
      });
      if (us.size > 1) return { why: "RENDEMENT : PRODUITS DE PLUSIEURS UNITÉS DANS L'ACTIVITÉ (" + [...us].join(", ") + ")." };
      const all = [...new Set(R.map(dlyResK))], miss = all.filter(sk => !ser.has(sk));
      if (!ser.size) return { why: "RENDEMENT : AUCUNE CHARGE COCHÉE DANS L'ACTIVITÉ " + lkName("sec", A) + "." , miss };
      return { L: PT, u: [...us][0] || "U", sec: A, ser: [...ser.values()], miss };
    };
    const dlyHistData = () => {
      const crb = dlyCrb(), money = crb.some(c => c === "p" || c === "g") && !crb.includes("r");   /* v567 / v571 : avec RENDEMENT, tout reste en quantité */
      const R0 = dlyResSel();
      /* v563 (remarque 4) : courbes en MONTANT avec CHARGES — sans charge cochée, toutes les charges retenues (celles des lignes cochées
         des autres blocs, sinon toutes), comme pour les produits */
      let R = R0;
      if (!R && money && crb.includes("c")) { const all = (INS.chg || []).filter(r => !r.t); let S = null; try { S = insCheckSet("chg"); } catch (e) { S = null; } R = S ? all.filter(r => S.has(r.id)) : all; if (!R.length) R = null; }
      if (!R && !money) return null;
      const mode = money || !R ? "m" : dlyResMode(R), cal = insCal(), cur = dlyCurDates(), ser = new Map(), det = {}, tot = {};
      if (R) [...new Set(R.map(dlyResK))].forEach(sk => ser.set(sk, { L: {} }));
      if (R) Object.keys(cur).forEach(k => {
        const p = cur[k], m = dlyResOf(k, R, mode);
        if (!m.size) return;
        /* v547 (R22) : jours de chaque morceau (demi-journées comprises) */
        const SL = [];
        (p.per && p.per.length ? p.per : [p]).forEach(q => { const n = sviWDur(cal, q.deb, q.fin) || 1; for (let i = 0, x = sviWNear(cal, q.deb, 1); i < n; i++, x = sviWAdd(cal, x, 1)) SL.push({ x, f: (i === 0 && q.hs ? .5 : 1) * (i === n - 1 && q.he ? .5 : 1) }); });
        let t = 0; SL.forEach(o => { t += o.f; });
        for (const { x, f: fi } of SL) {
          let sum = 0; const per = {};
          m.forEach((v, sk) => { const w = v / (t || 1) * fi, S = ser.get(sk); if (S) S.L[x] = (S.L[x] || 0) + w; sum += w; per[sk] = w; });
          tot[x] = (tot[x] || 0) + sum;
          (det[x] = det[x] || []).push({ k, v: sum, inc: dlyInc(k), per });
        }
      });
      const H = { R, mode, ser, det, tot, unit: mode === "q" ? dlyResU(R[0]) : "DH", crb };
      if (money) { const P = dlyPrdDays(cur); H.prd = P.L; H.pdet = P.det; }
      H.cmd = R0 ? dlyOrders(H) : null;
      H.rd = dlyRdData(H);
      return H;
    };
    /* R17 : APPROVISIONNEMENT PRÉVISIONNEL — réglages mémorisés par budget */
    const dlyAppro = () => ({ dl: 0, cov: "m", nj: 30, dep: "", seuil: {}, on: false, ...(INS.appro || {}) });
    /* début de la période de couverture d'un jour */
    const dlyPerStart = (day, c) => {
      const base0 = c.dep || dlyProjStart();
      if (c.cov === "m") {
        const m1 = day.slice(0, 8) + "01";
        return c.dep && day.slice(0, 7) === c.dep.slice(0, 7) && day >= c.dep ? c.dep : (base0.slice(0, 7) === day.slice(0, 7) && day >= base0 ? base0 : m1);
      }
      let base = base0;
      if (c.cov === "w" && !c.dep) { const dt = new Date(base0 + "T00:00:00"); base = sviIsoAdd(base0, -((dt.getDay() + 6) % 7)); }
      const len = c.cov === "w" ? 7 : Math.max(1, Number(c.nj) || 30);
      return sviIsoAdd(base, Math.floor(dDiff(base, day) / len) * len);
    };
    /* commandes : une par période et par charge, regroupées tant que le SEUIL de la charge n'est pas atteint ;
       lancées DÉLAI D'APPROVISIONNEMENT jours avant la 1re période couverte */
    const dlyOrders = H => {
      const c = dlyAppro();
      if (!c.on) return null;
      const dl = Math.max(0, Number(c.dl) || 0), L = {}, det = {};
      const add = (d, sk, v) => { if (!v) return; L[d] = (L[d] || 0) + v; (det[d] = det[d] || []).push({ sk, v }); };
      H.ser.forEach((S, sk) => {
        const per = {};
        Object.keys(S.L).forEach(di => { const p = dlyPerStart(di, c); per[p] = (per[p] || 0) + S.L[di]; });
        const th = Math.max(0, num((c.seuil || {})[sk] || 0) || 0);
        let acc = 0, first = null;
        Object.keys(per).sort().forEach(p => {
          acc += per[p]; first = first || p;
          if (acc >= th - 1e-9) { add(sviIsoAdd(first, -dl), sk, acc); acc = 0; first = null; }
        });
        if (acc > 1e-9 && first) add(sviIsoAdd(first, -dl), sk, acc);
      });
      const cv = c.cov === "w" ? "SEMAINE" : c.cov === "m" ? "MOIS" : (c.nj || 30) + " J";
      return { L, det, lab: "APPROVISIONNEMENT PRÉVISIONNEL — " + cv + (dl ? " — " + dl + " J D'AVANCE" : "") };
    };
    /* libellé à gauche de l'histogramme (sous le tableau) */
    /* v546 (R21) : titre de l'axe = l'unité seule (J-H / JOUR, DH / JOUR, DH CUMULÉS…) */
    const dlyHistLab = H => {
      if (!H) return "";
      const hs = dlyHSet();
      return H.cmd ? "COMMANDES" : H.unit + (hs.aff === "c" ? " CUMULÉS" : " / JOUR");
    };
    /* fenêtre APPROVISIONNEMENT PRÉVISIONNEL (menu ⋯, FORMAT 163) */
    const dlyApproWin = () => {
      const R = dlyResSel();
      if (!R) { svToast("COCHER DES CHARGES : L'APPROVISIONNEMENT PORTE SUR LES CHARGES COCHÉES.", 3500); return; }
      const c = dlyAppro(), mode = dlyResMode(R), d = document.createElement("div");
      const ks = [...new Set(R.map(dlyResK))];
      d.id = "svConf";
      /* v566 (remarque 9) : même format que RÉGLAGES DU GRAPHIQUE ; l'affichage des commandes se choisit dans RÉGLAGES DU GRAPHIQUE (DONNÉES) */
      d.innerHTML = `<div class="svc-card apr-card hcf-card" role="dialog" aria-modal="true">
        <button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
        <div class="svc-t">APPROVISIONNEMENT PRÉVISIONNEL</div>
        <div class="hcf-g">
        <span class="hcf-k">DÉLAI (JOURS AVANT)</span><span class="hcf-pl"><input class="apr-dl hcf-pct" inputmode="numeric" value="${esc(String(c.dl))}"> J</span>
        <span class="hcf-k">COUVERTURE</span><span class="hcf-pl"><span class="hcf-sw">${[["w", "SEMAINE"], ["m", "MOIS"], ["n", "N JOURS"]].map(([v, l]) => `<label class="hcf-seg${c.cov === v ? " on" : ""}"><input type="radio" name="aprc" value="${v}"${c.cov === v ? " checked" : ""}><span>${l}</span></label>`).join("")}</span><input class="apr-nj hcf-pct" inputmode="numeric" value="${esc(String(c.nj))}" title="NOMBRE DE JOURS"${c.cov === "n" ? "" : " disabled"}></span>
        <span class="hcf-k">DATE DE DÉPART</span><span class="hcf-pl"><input type="date" class="apr-dep" value="${esc(c.dep || "")}"></span>
        </div>
        <div class="hcf-note">SEUIL DE COMMANDE (${mode === "q" ? "QUANTITÉ" : "MONTANT DH"}) — VIDE = SANS SEUIL. AFFICHER LES COMMANDES : RÉGLAGES DU GRAPHIQUE ⚙, DONNÉES = COMMANDES.</div>
        <table class="apr-t"><tr><th>DÉSIGNATION CHARGE</th><th>UNITÉ</th><th>SEUIL</th></tr>${ks.map(sk => `<tr><td>${esc(sk.split("|")[0])}</td><td class="center">${esc(mode === "q" ? sk.split("|")[1] : "DH")}</td><td><input class="apr-s" data-sk="${esc(sk)}" inputmode="decimal" value="${esc(String((c.seuil || {})[sk] ?? ""))}"></td></tr>`).join("")}</table>
        <div class="svc-f"><button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button></div></div>`;
      document.getElementById("svConf")?.remove();
      document.body.appendChild(d);
      d.querySelectorAll('input[type="date"]').forEach(sviDateField);
      d.addEventListener("change", e => { const i = e.target.closest && e.target.closest(".hcf-seg input"); if (!i) return; d.querySelectorAll(".hcf-seg").forEach(s => s.classList.toggle("on", s.querySelector("input").checked)); d.querySelector(".apr-nj").disabled = i.value !== "n"; });
      d.addEventListener("click", e => {
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
        if (!e.target.closest("[data-ok]")) return;
        const dl = String(d.querySelector(".apr-dl").value).trim(), nj = String(d.querySelector(".apr-nj").value).trim();
        if (!/^\d+$/.test(dl)) { svToast("DÉLAI D'APPROVISIONNEMENT : NOMBRE ENTIER DE JOURS.", 3000, d.querySelector(".apr-dl")); return; }
        const cov = (d.querySelector('input[name="aprc"]:checked') || {}).value || "m";
        if (cov === "n" && (!/^\d+$/.test(nj) || Number(nj) < 1)) { svToast("NOMBRE DE JOURS : ENTIER, 1 AU MOINS.", 3000, d.querySelector(".apr-nj")); return; }
        const seuil = { ...(c.seuil || {}) };
        d.querySelectorAll(".apr-s").forEach(i => { const v = String(i.value).trim(); if (v === "") delete seuil[i.dataset.sk]; else seuil[i.dataset.sk] = num(v); });
        INS.appro = { dl: Number(dl), cov, nj: Number(nj) || 30, dep: d.querySelector(".apr-dep").value || "", seuil, on: c.on };
        d.remove();
        insSave(); histLog("DÉLAIS", "APPROVISIONNEMENT PRÉVISIONNEL", INS.appro.on ? "AFFICHÉ" : "MASQUÉ"); renderTabK();
      });
    };
    /* v546 (R29) : fenêtre RÉGLAGES DE L'HISTOGRAMME (icône ⚙) — UNITÉ, AFFICHAGE, DÉPART DU CUMUL, COURBES, % de la légende */
    const dlyHCfgWin = () => {
      const h = dlyHSet(), R = dlyResSel(), q = !!R && dlySameU(R), crb = dlyCrb(), d = document.createElement("div");
      /* v565 (remarque 7) : choix à deux options = interrupteur en deux parties collées ; courbes = petites cases sur une ligne */
      const rad = (n, v, l, on, dis) => `<label class="hcf-seg${on ? " on" : ""}${dis ? " off" : ""}"${dis ? ' data-why="QUANTITÉ : SEULEMENT AVEC DES CHARGES COCHÉES DE MÊME UNITÉ."' : ""}><input type="radio" name="${n}" value="${v}"${on ? " checked" : ""}${dis ? " disabled" : ""}><span>${l}</span></label>`;
      d.id = "svConf";
      d.innerHTML = `<div class="svc-card hcf-card" role="dialog" aria-modal="true">
        <button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
        <div class="svc-t">RÉGLAGES DU GRAPHIQUE</div>
        <div class="hcf-g">
          <span class="hcf-k">UNITÉ</span><span class="hcf-sw">${rad("hcu", "q", "QUANTITÉ", h.u === "q" && q, !q)}${rad("hcu", "m", "MONTANT (DH)", h.u !== "q" || !q)}</span>
          <span class="hcf-k">PRÉSENTATION</span><span class="hcf-sw">${rad("hca", "j", "PAR JOUR", h.aff !== "c")}${rad("hca", "c", "CUMULÉE", h.aff === "c")}</span>
          <span class="hcf-k">FORME</span><span class="hcf-sw">${(() => { const fo = h.forme || (dlyAppro().on && R ? "h" : crb.includes("r") ? "c" : h.aff === "c" ? "c" : "h"); return rad("hcf", "h", "HISTOGRAMME", fo === "h") + rad("hcf", "c", "COURBES", fo === "c"); })()}</span>
          <span class="hcf-k">POINT DE DÉPART</span><span class="hcf-sw">${rad("hcc", "r", "DEPUIS LE TRAIT DÉBUT", h.cum !== "a")}${rad("hcc", "a", "DEPUIS LE DÉBUT DU PROJET", h.cum === "a")}</span>
          <span class="hcf-k">COURBES</span><span class="hcf-cbs">${[["c", "CHARGES"], ["p", "PRODUITS"], ["g", "MARGE"], ["r", "RENDEMENT"]].map(([v, l]) => `<label${v === "r" && !R ? ' class="off" data-why="RENDEMENT : COCHER DES CHARGES DANS DÉTAIL CHARGES ET CHOISIR UNE ACTIVITÉ DANS TÂCHES."' : ""}><input type="checkbox" class="hcf-c" value="${v}"${crb.includes(v) && (v !== "r" || R) ? " checked" : ""}${v === "r" && !R ? " disabled" : ""}><span>${l}</span></label>`).join("")}</span>
          <span class="hcf-k">LÉGENDE</span><span class="hcf-pl">CHARGES QUI FONT <input class="hcf-pct" inputmode="numeric" value="${esc(String(h.pct || 70))}"> %</span>
          <span class="hcf-k">DONNÉES</span><span class="hcf-sw">${rad("hcd", "c", "CONSOMMATION", !(dlyAppro().on && R))}${rad("hcd", "o", "COMMANDES", !!(dlyAppro().on && R), !R).replace("QUANTITÉ : SEULEMENT AVEC DES CHARGES COCHÉES DE MÊME UNITÉ.", "COMMANDES : COCHER DES CHARGES DANS DÉTAIL CHARGES.")}</span>
          ${(() => { const a = dlyAppro(), hid = a.on && R ? "" : " hidden";
            /* v572 (remarque 17) : réglages des COMMANDES dans la même fenêtre, en dessous (plus de fenêtre APPROVISIONNEMENT ni de liste des charges) */
            return `<span class="hcf-k hcf-apr"${hid}>COUVERTURE</span><span class="hcf-pl hcf-apr"${hid}><span class="hcf-sw hcf-sw3">${[["w", "SEMAINE"], ["m", "MOIS"], ["n", "N JOURS"]].map(([v, l]) => `<label class="hcf-seg${a.cov === v ? " on" : ""}"><input type="radio" name="aprc" value="${v}"${a.cov === v ? " checked" : ""}><span>${l}</span></label>`).join("")}</span><input class="apr-nj hcf-pct" inputmode="numeric" value="${esc(String(a.nj))}"${a.cov === "n" ? "" : " disabled"}></span>
              <span class="hcf-k hcf-apr"${hid}>DÉLAI D'APPROVISIONNEMENT (J)</span><span class="hcf-pl hcf-apr"${hid}><input class="apr-dl hcf-pct" inputmode="numeric" value="${esc(String(a.dl))}"><span class="hcf-k hcf-k2">DATE DE DÉPART</span><input type="date" class="apr-dep" value="${esc(a.dep || "")}"></span>`; })()}
        </div>
        <div class="svc-f"><button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button></div></div>`;
      document.getElementById("svConf")?.remove();
      document.body.appendChild(d);
      d.querySelectorAll('input[type="date"]').forEach(sviDateField);
      d.addEventListener("change", e => { const i = e.target.closest && e.target.closest(".hcf-seg input"); if (!i) return; i.closest(".hcf-sw").querySelectorAll(".hcf-seg").forEach(s => s.classList.toggle("on", s.querySelector("input").checked));
        if (i.name === "hcd") d.querySelectorAll(".hcf-apr").forEach(x => { x.hidden = i.value !== "o"; });
        if (i.name === "aprc") d.querySelector(".apr-nj").disabled = i.value !== "n"; });
      d.addEventListener("click", e => {
        { const o = e.target.closest && e.target.closest(".hcf-seg.off[data-why], .hcf-cbs label.off[data-why]"); if (o) { svToast(o.dataset.why, 3500, o); return; } }
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
        if (!e.target.closest("[data-ok]")) return;
        const pc = String(d.querySelector(".hcf-pct").value).trim();
        if (!/^\d+$/.test(pc) || Number(pc) < 1 || Number(pc) > 100) { svToast("% DE LA LÉGENDE : NOMBRE ENTIER DE 1 À 100.", 3000, d.querySelector(".hcf-pct")); return; }
        const c = [...d.querySelectorAll(".hcf-c:checked")].map(i => i.value);
        if (!c.length) { svToast("COCHER AU MOINS UNE COURBE.", 3000, d.querySelector(".hcf-c")); return; }
        /* v567 (remarque 10) : RENDEMENT = en QUANTITÉ, avec les CHARGES, sans PRODUITS ni MARGE en montant */
        if (c.includes("r")) {
          /* v571 (remarque 14) : avec RENDEMENT, CHARGES et PRODUITS (quantité produite) sont facultatifs ; la MARGE (en montant) non */
          if (c.includes("g")) { svToast("RENDEMENT : EN QUANTITÉ — DÉCOCHER LA MARGE (EN MONTANT).", 3500, d.querySelector('.hcf-c[value="r"]')); return; }
          const qq = d.querySelector('input[name="hcu"][value="q"]'); if (qq && !qq.disabled) qq.checked = true;
        }
        const v = n => (d.querySelector(`input[name="${n}"]:checked`) || {}).value;
        INS.hset = { ...h, u: v("hcu") || "m", aff: v("hca") || "j", cum: v("hcc") || "r", crb: c, pct: Number(pc), forme: v("hcf") || "h" };
        /* v566 (remarque 9) / v572 (remarque 17) : COMMANDES = données du graphique ; ses réglages sont lus ici */
        const on = v("hcd") === "o", A0 = dlyAppro();
        if (on) {
          const dl = String(d.querySelector(".apr-dl").value).trim(), nj = String(d.querySelector(".apr-nj").value).trim(), cov = v("aprc") || "m";
          if (!/^\d+$/.test(dl)) { svToast("DÉLAI D'APPROVISIONNEMENT : NOMBRE ENTIER DE JOURS.", 3000, d.querySelector(".apr-dl")); return; }
          if (cov === "n" && (!/^\d+$/.test(nj) || Number(nj) < 1)) { svToast("NOMBRE DE JOURS : ENTIER, 1 AU MOINS.", 3000, d.querySelector(".apr-nj")); return; }
          INS.appro = { ...A0, on, dl: Number(dl), cov, nj: Number(nj) || 30, dep: d.querySelector(".apr-dep").value || "" };
        } else INS.appro = { ...A0, on };
        d.remove();
        insSave(); histLog("DÉLAIS", "RÉGLAGES DU GRAPHIQUE", c.map(x => ({ c: "CHARGES", p: "PRODUITS", g: "MARGE" })[x]).join(" + ")); renderTabK();
      });
    };
    /* v547 (R22, FORMAT 196) : fenêtre MORCEAUX d'une tâche coupée — DÉBUT, FIN, DURÉE de chaque morceau, ✕, + AJOUTER UN MORCEAU, RECOLLER */
    const dlyPiecesWin = k => {
      const cal = insCal();
      let rows = dlyList(k).filter(p => p.deb).map(p => ({ id: p.id || insId(), deb: p.deb, fin: p.fin || p.deb }));
      const d = document.createElement("div");
      d.id = "svConf";
      const draw = () => {
        const tot = rows.reduce((t, r) => t + (Number(dDur(r.deb, r.fin)) || 0), 0);
        d.innerHTML = `<div class="svc-card pcs-card" role="dialog" aria-modal="true">
          <button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
          <div class="svc-t">MORCEAUX — ${esc(dlyName(k))}</div>
          <div class="pcs-g"><b>DÉBUT</b><b>FIN</b><b class="center">DURÉE (J)</b><b></b>${rows.map((r, i) => `<span><input type="date" class="pcs-d" data-i="${i}" data-f="deb" value="${esc(r.deb)}"></span><span><input type="date" class="pcs-d" data-i="${i}" data-f="fin" value="${esc(r.fin)}"></span><span class="center">${esc(String(dDur(r.deb, r.fin)))}</span><button type="button" class="pcs-x" data-i="${i}"${rows.length < 2 ? " disabled" : ""} aria-label="Supprimer le morceau">✕</button>`).join("")}
          <i class="pcs-tot">TOTAL</i><i></i><i class="pcs-tot center">${tot}</i><i></i></div>
          <div class="pcs-acts"><button type="button" class="svc-b" data-add>+ AJOUTER UN MORCEAU</button><button type="button" class="svc-b" data-glue${rows.length < 2 ? " disabled" : ""}>RECOLLER</button></div>
          <div class="svc-f"><button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button></div></div>`;
        d.querySelectorAll('input[type="date"]').forEach(sviDateField);
      };
      document.getElementById("svConf")?.remove();
      document.body.appendChild(d);
      draw();
      d.addEventListener("change", e => { const i = e.target.closest(".pcs-d"); if (!i) return; rows[Number(i.dataset.i)][i.dataset.f] = i.value; draw(); });
      d.addEventListener("click", e => {
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
        const x = e.target.closest(".pcs-x");
        if (x && rows.length > 1) { rows.splice(Number(x.dataset.i), 1); draw(); return; }
        if (e.target.closest("[data-add]")) { const l = rows[rows.length - 1], a = sviWAdd(cal, l.fin, 2); rows.push({ id: insId(), deb: a, fin: a }); draw(); return; }
        if (e.target.closest("[data-glue]") && rows.length > 1) {
          const tot = rows.reduce((t, r) => t + (Number(dDur(r.deb, r.fin)) || 1), 0), a = rows[0].deb;
          rows = [{ id: rows[0].id, deb: a, fin: sviWFin(cal, a, tot) }]; draw(); return;
        }
        if (!e.target.closest("[data-ok]")) return;
        const R = rows.map(r => ({ ...r })).sort((a, b) => a.deb.localeCompare(b.deb));
        let err = "";
        const pf = dlyPredFin(k);
        R.forEach((r, i) => {
          if (err) return;
          if (!r.deb || !r.fin) err = "MORCEAU " + (i + 1) + " : DÉBUT ET FIN OBLIGATOIRES.";
          else if (!sviWork(cal, r.deb) || !sviWork(cal, r.fin)) err = "MORCEAU " + (i + 1) + " : JOUR NON TRAVAILLÉ DU CALENDRIER DU BUDGET.";
          else if (r.fin < r.deb) err = "MORCEAU " + (i + 1) + " : LA FIN EST AVANT LE DÉBUT.";
          else if (i && r.deb <= R[i - 1].fin) err = "LES MORCEAUX " + i + " ET " + (i + 1) + " SE CHEVAUCHENT.";
          else if (INS.dbut && r.fin > INS.dbut) err = "FIN REFUSÉE : APRÈS LA DATE BUTOIR DU " + dFr(INS.dbut) + ".";
        });
        if (!err && pf && R[0].deb < pf) err = "DÉBUT REFUSÉ : LES LIAISONS IMPOSENT LE " + dFr(pf) + " AU PLUS TÔT.";
        if (err) { svToast(err, 3500, d.querySelector("[data-ok]")); return; }
        const L = dlyDraftKey(k);
        L.splice(0, L.length, ...R.map(r => ({ id: r.id, deb: r.deb, fin: r.fin })));
        d.remove();
        dlyCommitDrafts(); dlyRespect(false); insSave();
        histLog("DÉLAIS", R.length > 1 ? "MORCEAUX" : "MORCEAUX RECOLLÉS", dlyName(k) + " : " + R.map(r => dFr(r.deb) + " → " + dFr(r.fin)).join(" ; "));
        renderTabK(); insRenderChain();
      });
    };

