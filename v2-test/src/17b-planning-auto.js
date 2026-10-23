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
    const dlyCurGK = () => { const R = dlyResSel(); return R && dlySameU(R) ? [...new Set(R.map(dlyResK))].sort().join(" § ") : ""; };
    const dlyGName = gk => [...new Set(String(gk).split(" § ").map(x => x.split("|")[0]))].join(" + ");
    /* quantité d'un groupe dans une tâche (charges de ses liaisons dont la clé est dans le groupe) */
    const dlyGQ = (k, keys) => {
      let t = 0; const seen = new Set();
      (INS.links || []).forEach(l => {
        if (l.lot + "|" + l.sec !== k) return;
        (l.chg || []).forEach(e => { if (seen.has(e.id)) return; seen.add(e.id); const r = INS.chg.find(x => x.id === e.id); if (r && !r.t && keys.has(dlyResK(r))) t += dlyResQty(r); });
      });
      return Math.round(t * 1000) / 1000;
    };
    /* quantité de la sélection dans une tâche (aucune case cochée = 0 : R25) */
    const dlyResQ = k => { const gk = dlyCurGK(); return gk ? dlyGQ(k, new Set(gk.split(" § "))) : 0; };
    /* réglage de capacité d'un groupe (créé à la demande) */
    const dlyCapSt = (gk = dlyCurGK()) => { if (!gk) return null; INS.plafR = INS.plafR || {}; return (INS.plafR[gk] = INS.plafR[gk] || {}); };
    /* valeur d'un morceau : nombre ≥ 1, 0 (pénurie) ou −1 (ILLIMITÉ, aussi quand rien n'est réglé) */
    const dlyCapV = v => v === undefined || v === null || v === "" || Number(v) < 0 ? -1 : Math.round(Number(v));
    /* groupes de capacité actifs ensemble (R24) : tous ceux réglés, plus la sélection */
    const dlyGroups = () => {
      const cur = dlyCurGK(), out = [];
      const has = st => st && (dlyCapV(st.plaf) >= 0 || (st.plafs || []).some(s => dlyCapV(s.n) >= 0));
      Object.keys(INS.plafR || {}).forEach(gk => { const st = INS.plafR[gk]; if (gk === cur || has(st)) out.push({ gk, keys: new Set(gk.split(" § ")), st: st || {} }); });
      if (cur && !out.some(g => g.gk === cur)) out.push({ gk: cur, keys: new Set(cur.split(" § ")), st: {} });
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
    const dlyPlanCompute = () => {
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
      const G = dlyGroups(), used = G.map(() => ({}));
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
      const place = (k, s0, dry) => {
        const q = G.map(g => dlyGQ(k, g.keys)), rel = G.map((g, i) => i).filter(i => q[i] > 0);
        const own = deb(k) && dlyFin(k) ? dlyHalves(k) : 0;
        const over = dry ? G.map(() => ({})) : used, U = (i, s) => (used[i][s] || 0) + (dry ? (over[i][s] || 0) : 0);
        const take = (i, s, v) => { over[i][s] = (over[i][s] || 0) + v; };
        if ((dlyInc(k) && own) || (!rel.length && own)) {
          rel.forEach(i => { for (let s = s0; s < s0 + own; s++) take(i, s, q[i] / own); });
          return { a: s0, b: s0 + own - 1 };
        }
        if (!rel.length) return { a: s0, b: s0 - 1, zero: true };
        let rem = 1, a = null, b = s0, s = s0;
        const cnt = {};
        for (let g = 0; rem > 1e-9 && g < 40000; g++, s++) {
          let f = rem, li = -1;
          rel.forEach(i => {
            const c = capAt(G[i], s);
            const al = c === Infinity ? (own ? 1 / own : .5 / q[i]) : Math.max(0, c - U(i, s)) / q[i];
            if (al < f - 1e-12) { f = al; li = i; }
          });
          if (li >= 0) cnt[li] = (cnt[li] || 0) + 1;
          if (f > 1e-9) { rel.forEach(i => take(i, s, f * q[i])); rem -= f; if (a === null) a = s; b = s; }
        }
        if (!dry) { const best = Object.keys(cnt).sort((x, y) => cnt[y] - cnt[x])[0]; if (best !== undefined) lim[k] = G[best].gk; }
        return { a: a === null ? s0 : a, b };
      };
      const hasR = k => G.some(g => dlyGQ(k, g.keys) > 0);
      const links = [];
      L.forEach((k, idx) => {
        const pre = idx ? L[idx - 1] : null;
        let e = 0;
        if (pre && S[pre]) e = Math.max(e, hasR(pre) && S[pre].b >= S[pre].a ? S[pre].b : S[pre].b + 1);
        dlyLinks(k).forEach(x => {
          const P = S[x.k];
          if (!P) return;
          if (x.t === "DD") e = Math.max(e, slotOf(sviWAdd(cal, D[x.k].deb, Math.max(0, x.o || 0))) + (D[x.k].dm ? 1 : 0));
          /* v544 : 0 = le jour même (dès qu'il reste des ouvriers libres), n = n jours travaillés après la fin */
          else if (!(x.o > 0)) e = Math.max(e, hasR(x.k) && P.b >= P.a ? P.b : P.b + 1);
          else e = Math.max(e, slotOf(sviWAdd(cal, D[x.k].fin || D[x.k].deb, x.o)));
        });
        /* une seule date : elle sert d'ancrage (R26) */
        const d0 = deb(k), f0 = dlyFin(k);
        if (d0 && !f0) e = Math.max(e, slotOf(d0));
        if (!d0 && f0) { const t = place(k, e, true), n = t.b - t.a + 1, end = dayIx(f0) * 2 + 1; e = Math.max(e, end - n + 1); }
        const r = place(k, e, false);
        S[k] = r;
        D[k] = r.zero ? { deb: dayAt(r.a >> 1), fin: "", dm: r.a & 1, fm: 0 } : { deb: dayAt(r.a >> 1), fin: dayAt(r.b >> 1), dm: r.a & 1, fm: (r.b & 1) ? 0 : 1 };
        if (pre && !dlyLinks(k).some(x => x.k === pre) && !dlyLinks(pre).some(x => x.k === k) && !dlyReach(pre, k)) links.push([pre, k]);
      });
      return { D, S, links, lim };
    };
    /* décalage d'une liaison FIN → DÉBUT créée (v544) : 0 = le jour même où finit a, 1 = le lendemain… */
    const dlyChainO = (a, b, D) => {
      const cal = insCal(), fa = D[a].fin || D[a].deb, db = D[b].deb;
      return db > fa ? Math.max(1, (Number(sviWDur(cal, fa, db)) || 2) - 1) : 0;
    };
    /* y a-t-il quelque chose à gagner ? (R27) */
    const dlyCanCompress = () => {
      if (!dlyResSel()) return { ok: false, why: "COCHER DES CHARGES : COMPRESSER NE PORTE QUE SUR LES CHARGES COCHÉES." };
      if (!dlyKeys().length) return { ok: false, why: "AUCUNE TÂCHE AU PLANNING." };
      const P = dlyPlanCompute();
      const same = Object.keys(P.D).every(k => {
        const x = P.D[k], L = dlyList(k), p = L[0];
        if (L.length > 1) return false;
        return (dlyDeb(k) || "") === x.deb && (dlyFin(k) || "") === (x.fin || "") && !!(p && dlyHalfS(p)) === !!x.dm && !!(p && dlyHalfE(p)) === !!(x.fm && x.fin);
      });
      return same && !P.links.length ? { ok: false, why: "DÉJÀ COMPRESSÉ : AUCUN JOUR À GAGNER." } : { ok: true, P };
    };
    const dlyHasDates = () => dlyKeys().some(k => dlyDeb(k) && dlyFin(k));
    /* dates calculées → brouillon de la tâche (une seule période), demi-journées comprises */
    const dlyWriteH = D => {
      Object.keys(D).forEach(k => {
        const x = D[k], L = dlyDraftKey(k);
        const p = L[0] || { id: insId() };
        L.splice(0, L.length, p);
        p.deb = x.deb; p.fin = x.fin || "";
        if (x.dm) p.dmd = x.deb; else delete p.dmd;
        if (x.fm && x.fin) p.fmd = x.fin; else delete p.fmd;
      });
    };
    const DLY_BUT_MSG = "AVEC CE NOMBRE VOUS RISQUEZ DE DÉPASSER LA DATE BUTOIR";
    /* R26 : GÉNÉRER = COMPRESSER — un seul calcul, enregistré aussitôt (↶ annule) */
    const dlyCompressRun = (opts = {}) => {
      const C = dlyCanCompress();
      if (!C.ok) {
        if (opts.plaf !== undefined) {
          /* R24 : la capacité de la sélection n'a plus d'effet — dire quelle ressource bloque */
          const cur = dlyCurGK(), by = cur ? [...new Set(dlyKeys().filter(k => dlyResQ(k) > 0).map(k => (INS.dlim || {})[k]).filter(g => g && g !== cur))] : [];
          svToast(by.length ? "BLOQUÉ PAR : " + by.map(dlyGName).join(", ") + "." : "AUCUN GAIN AVEC CE NOMBRE.", 3500, opts.anchor);
          insSave(); renderTabK();
        } else if (!opts.quiet) svToast(C.why, 3500, opts.anchor);
        return null;
      }
      const P = C.P, f0 = dlyEnd(dlyCurDates()), gen = !dlyHasDates();
      dlyWriteH(P.D);
      dlyCommitDrafts();
      INS.dpred = INS.dpred || {};
      P.links.forEach(([a, b]) => { INS.dpred[b] = dlyLinks(b).concat([{ k: a, t: "FD", o: dlyChainO(a, b, P.D) }]); });
      const cur = dlyCurGK();
      INS.dlim = {}; Object.keys(P.lim).forEach(k => { if (P.lim[k] !== cur) INS.dlim[k] = P.lim[k]; });
      if (!INS.gdeb) INS.gdeb = dlyProjStart();
      insSave();
      const f1 = dlyEnd(dlyCurDates());
      histLog("DÉLAIS", gen ? "GÉNÉRER LE PLANNING" : "COMPRESSER LE PLANNING", (opts.plaf !== undefined ? "CAPACITÉ " + (opts.plaf < 0 ? "ILLIMITÉE" : opts.plaf) + " — " : "") + "FIN " + dFr(f0) + " → " + dFr(f1) + (P.links.length ? " — " + P.links.length + " LIAISON(S) CRÉÉE(S)" : ""));
      renderTabK(); insRenderChain();
      if (opts.plaf === undefined) svToast((gen ? "PLANNING GÉNÉRÉ" : "PLANNING COMPRESSÉ") + " — FIN LE " + dFr(f1) + ".", 3500);
      if (INS.dbut && f1 > INS.dbut) svToast(DLY_BUT_MSG + " (FIN LE " + dFr(f1) + ", BUTOIR LE " + dFr(INS.dbut) + ").", 5000, opts.anchor);
      return P.D;
    };
    const dlyGenComp = () => dlyCompressRun();

    /* ---------- R21 à R23 : CAPACITÉ ---------- */
    /* couper la barre à une date : les tâches qui commencent avant restent dans le morceau de gauche (la coupe les suit) */
    const dlyCutPlaf = iso => {
      const st = dlyCapSt();
      if (!st) { svToast("COCHER DES CHARGES DE MÊME UNITÉ POUR RÉGLER UNE CAPACITÉ.", 3000); return; }
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
      svChoose({ title: "SUPPRIMER LA COUPE", html: `<div class="svc-sub">SUPPRIMER LA COUPE DU ${esc(dFr(s.d))} ?</div>`, buttons: [{ v: "go", label: "SUPPRIMER", tone: "danger" }] }).then(r => {
        if (r !== "go") return;
        st.plafs = (st.plafs || []).filter((c, j) => j + 1 !== i);
        histLog("DÉLAIS", "COUPE SUPPRIMÉE", dFr(s.d));
        dlyCompressRun({ plaf: dlyCapOf(s.d), quiet: true });
      });
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
    const DLY_SER = ["#2e90fa", "#f79009", "#12b76a", "#7a5af8", "#ee46bc", "#06aed4", "#a15c07", "#667085"];
    /* hauteur de l'histogramme : nombre de pixels (28 = miniaturisé en bas) ou « full » (plein écran, à la place du Gantt) */
    const dlyHHGet = () => { let v = ""; try { v = localStorage.getItem("svi_dlyhh_v1") || ""; } catch (e) {} return v === "full" ? "full" : Math.max(28, Math.min(2000, Number(v) || 110)); };
    const dlyHHSet = v => { try { localStorage.setItem("svi_dlyhh_v1", String(v)); } catch (e) {} };
    const dlyHSetPut = o => { INS.hset = { ...dlyHSet(), ...o }; insSave(); renderTabK(); };
    /* R19 / R20 : plage DÉBUT – FIN et filtre MIN – MAX (mémorisés par budget) */
    const dlyHRange = () => ({ a: "", b: "", ...(INS.hrange || {}) });
    const dlyHVal = () => ({ min: null, max: null, ...(INS.hval || {}) });
    /* consommation jour par jour de chaque charge cochée (répartie sur les jours travaillés de chaque tâche, demi-journées comprises) */
    const dlyHistData = () => {
      const R = dlyResSel();
      if (!R) return null;
      const mode = dlyResMode(R), cal = insCal(), cur = dlyCurDates(), ser = new Map(), det = {}, tot = {};
      [...new Set(R.map(dlyResK))].forEach(sk => ser.set(sk, { L: {} }));
      Object.keys(cur).forEach(k => {
        const p = cur[k], m = dlyResOf(k, R, mode);
        if (!m.size) return;
        const n = sviWDur(cal, p.deb, p.fin) || 1, fr = i => (i === 0 && p.hs ? .5 : 1) * (i === n - 1 && p.he ? .5 : 1);
        let t = 0; for (let i = 0; i < n; i++) t += fr(i);
        for (let i = 0, x = sviWNear(cal, p.deb, 1); i < n; i++, x = sviWAdd(cal, x, 1)) {
          let sum = 0; const per = {};
          m.forEach((v, sk) => { const w = v / (t || 1) * fr(i), S = ser.get(sk); if (S) S.L[x] = (S.L[x] || 0) + w; sum += w; per[sk] = w; });
          tot[x] = (tot[x] || 0) + sum;
          (det[x] = det[x] || []).push({ k, v: sum, inc: dlyInc(k), per });
        }
      });
      const H = { R, mode, ser, det, tot, unit: mode === "q" ? dlyResU(R[0]) : "DH" };
      H.cmd = dlyOrders(H);
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
    const dlyHistLab = () => {
      const R = dlyResSel();
      if (!R) return "CHARGES";
      const ks = [...new Set(R.map(r => U_(r.des)))], hs = dlyHSet();
      return esc(ks[0]) + (ks.length > 1 ? " + " + (ks.length - 1) : "") + "<br>(" + esc(dlyAppro().on ? "COMMANDES" : (dlyResMode(R) === "q" ? dlyResU(R[0]) : "DH") + (hs.aff === "c" ? " CUMULÉS" : " / JOUR")) + ")";
    };
    /* fenêtre APPROVISIONNEMENT PRÉVISIONNEL (menu ⋯, FORMAT 163) */
    const dlyApproWin = () => {
      const R = dlyResSel();
      if (!R) { svToast("COCHER DES CHARGES : L'APPROVISIONNEMENT PORTE SUR LES CHARGES COCHÉES.", 3500); return; }
      const c = dlyAppro(), mode = dlyResMode(R), d = document.createElement("div");
      const ks = [...new Set(R.map(dlyResK))];
      d.id = "svConf";
      d.innerHTML = `<div class="svc-card apr-card" role="dialog" aria-modal="true">
        <button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
        <div class="svc-t">APPROVISIONNEMENT PRÉVISIONNEL</div>
        <div class="bdt-row"><span>DÉLAI D'APPROVISIONNEMENT (J)</span><input class="apr-dl" inputmode="numeric" value="${esc(String(c.dl))}"></div>
        <div class="bdt-row"><span>PÉRIODE DE COUVERTURE</span><span class="cmd-g">${[["w", "SEMAINE"], ["m", "MOIS"], ["n", "N JOURS"]].map(([v, l]) => `<label><input type="radio" name="aprc" value="${v}"${c.cov === v ? " checked" : ""}> ${l}</label>`).join("")}<input class="apr-nj" inputmode="numeric" value="${esc(String(c.nj))}" title="NOMBRE DE JOURS"></span></div>
        <div class="bdt-row"><span>DATE DE DÉPART</span><input type="date" class="apr-dep" value="${esc(c.dep || "")}"></div>
        <div class="svc-sub">SEUIL DE COMMANDE (${mode === "q" ? "QUANTITÉ" : "MONTANT DH"}) — VIDE = SANS SEUIL</div>
        <table class="apr-t"><tr><th>DÉSIGNATION CHARGE</th><th>UNITÉ</th><th>SEUIL</th></tr>${ks.map(sk => `<tr><td>${esc(sk.split("|")[0])}</td><td class="center">${esc(mode === "q" ? sk.split("|")[1] : "DH")}</td><td><input class="apr-s" data-sk="${esc(sk)}" inputmode="decimal" value="${esc(String((c.seuil || {})[sk] ?? ""))}"></td></tr>`).join("")}</table>
        <div class="bdt-row"><span>AFFICHER LES COMMANDES PRÉVISIONNELLES</span><input type="checkbox" class="apr-on"${c.on ? " checked" : ""}></div>
        <div class="svc-f"><button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button></div></div>`;
      document.getElementById("svConf")?.remove();
      document.body.appendChild(d);
      d.querySelectorAll('input[type="date"]').forEach(sviDateField);
      d.addEventListener("click", e => {
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
        if (!e.target.closest("[data-ok]")) return;
        const dl = String(d.querySelector(".apr-dl").value).trim(), nj = String(d.querySelector(".apr-nj").value).trim();
        if (!/^\d+$/.test(dl)) { svToast("DÉLAI D'APPROVISIONNEMENT : NOMBRE ENTIER DE JOURS.", 3000, d.querySelector(".apr-dl")); return; }
        const cov = (d.querySelector('input[name="aprc"]:checked') || {}).value || "m";
        if (cov === "n" && (!/^\d+$/.test(nj) || Number(nj) < 1)) { svToast("NOMBRE DE JOURS : ENTIER, 1 AU MOINS.", 3000, d.querySelector(".apr-nj")); return; }
        const seuil = { ...(c.seuil || {}) };
        d.querySelectorAll(".apr-s").forEach(i => { const v = String(i.value).trim(); if (v === "") delete seuil[i.dataset.sk]; else seuil[i.dataset.sk] = num(v); });
        INS.appro = { dl: Number(dl), cov, nj: Number(nj) || 30, dep: d.querySelector(".apr-dep").value || "", seuil, on: d.querySelector(".apr-on").checked };
        d.remove();
        insSave(); histLog("DÉLAIS", "APPROVISIONNEMENT PRÉVISIONNEL", INS.appro.on ? "AFFICHÉ" : "MASQUÉ"); renderTabK();
      });
    };
