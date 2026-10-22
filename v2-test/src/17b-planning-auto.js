    /* ===== v530 : GÉNÉRER / COMPRESSER LE PLANNING, PLAFOND PAR PÉRIODES, DEMI-JOURNÉES =====
       - effectif (plafond) par périodes : INS.plaf = première période ; INS.plafs = [{ d: date de début, n: ouvriers }]
         (appui long sur la barre du plafond = la couper à cette date ; chaque morceau se tire seul, par ouvrier entier)
       - demi-journées : une période de tâche peut commencer à midi (p.dmd === p.deb) ou finir à midi (p.fmd === p.fin)
       - GÉNÉRER : tâches SANS dates, de haut en bas (lot puis ses activités secondaires) ; durée = J-H ÷ ouvriers ;
         une demi-journée où des ouvriers restent libres est prise par la tâche suivante (chevauchement) ;
         liaison FIN → DÉBUT posée entre chaque tâche et celle du dessous (décalage −1 J = même jour)
       - COMPRESSER : tâches AVEC dates, dans l'ordre de leur début, resserrées pour ne laisser aucun ouvrier sans travail */
    const dlyCapBase = () => Math.max(1, Math.round(Number(INS.plaf) || Number(INS.ouv) || 1));
    const dlyCapSegs = () => [{ d: "", n: dlyCapBase() }].concat((INS.plafs || []).filter(s => s && s.d && Number(s.n) >= 1).sort((a, b) => a.d.localeCompare(b.d)));
    const dlyCapOf = iso => { let n = dlyCapBase(); dlyCapSegs().forEach(s => { if (s.d && s.d <= iso) n = Number(s.n); }); return n; };
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
    /* tâches de haut en bas, comme elles s'affichent (arborescence des lots, ordre du PLANNING) */
    const dlyTopDown = keys => {
      const O = dlyOrder(keys), ord = keys.slice().sort((a, b) => O.get(a) - O.get(b));
      const first = new Map();
      const lotP = k => dlyLotPath(lkName("lot", k.split("|")[0]));
      ord.forEach((k, i) => { const s = lotP(k); for (let j = 1; j <= s.length; j++) { const p = U_(s.slice(0, j).join(" / ")); if (!first.has(p)) first.set(p, i); } });
      const pos = new Map(ord.map((k, i) => [k, i]));
      const key = k => { const s = lotP(k); return s.map((_, j) => first.get(U_(s.slice(0, j + 1).join(" / ")))).concat(pos.get(k)); };
      const K = new Map(ord.map(k => [k, key(k)]));
      return ord.slice().sort((a, b) => { const A = K.get(a), B = K.get(b); for (let i = 0; i < Math.min(A.length, B.length); i++) if (A[i] !== B[i]) return A[i] - B[i]; return A.length - B.length; });
    };
    /* ordonnancement en demi-journées : order = tâches à placer (dans cet ordre), fixed = tâches gardées (elles occupent des ouvriers),
       start = premier jour ; chain = lier chaque tâche à la précédente de la liste ; pre = tâche (gardée) juste au-dessus de chacune */
    const dlyPack = (order, fixed, start, opts = {}) => {
      const cal = insCal(), days = [sviWNear(cal, start, 1)];
      const dayAt = i => { while (days.length <= i) days.push(sviWAdd(cal, days[days.length - 1], 1)); return days[i]; };
      const dayIx = iso => { if (!iso || iso <= days[0]) return 0; let i = 0; while (dayAt(i) < iso && i < 20000) i++; return i; };
      const used = {}, cap = s => dlyCapOf(dayAt(s >> 1)) * .5, free = s => cap(s) - (used[s] || 0);
      const D = {}, S = {};   /* D : dates ; S : demi-journées de début et de fin */
      /* tâches gardées : leurs J-H occupent leurs demi-journées */
      fixed.forEach(k => {
        const L = dlyList(k), p = L[0], d0 = dlyDeb(k), f0 = dlyFin(k);
        if (!d0 || !f0) return;
        if (f0 < days[0]) { S[k] = { a: -2, b: -1 }; D[k] = { deb: d0, fin: f0 }; return; }   /* finie avant le début : n'occupe personne */
        const a = dayIx(d0) * 2 + (L.length === 1 && dlyHalfS(p) ? 1 : 0), b = dayIx(f0) * 2 + (L.length === 1 && dlyHalfE(p) ? 0 : 1);
        S[k] = { a, b }; D[k] = { deb: d0, fin: f0 };
        const jh = dlyJH(k), n = Math.max(1, b - a + 1);
        if (jh > 0) for (let s = a; s <= b; s++) used[s] = (used[s] || 0) + jh / n;
      });
      let ptr = 0, prevK = null;
      const slotOf = iso => dayIx(iso) * 2;
      order.forEach(k => {
        /* tâche juste au-dessus (placée ou gardée) : la suivante commence dès sa dernière demi-journée si des ouvriers y restent libres */
        const pk = opts.pre ? opts.pre(k) : prevK;
        let e = ptr;
        if (pk && S[pk]) { const lab = dlyJH(pk) > 0; e = Math.max(opts.pre ? 0 : e, lab ? S[pk].b : S[pk].b + 1); }
        else if (opts.pre) e = 0;
        /* autres liaisons de la tâche (hors tâche du dessus) : respectées */
        dlyLinks(k).forEach(x => {
          if (x.k === pk || !D[x.k]) return;
          if (x.t === "DD") e = Math.max(e, slotOf(sviWAdd(cal, sviWNear(cal, D[x.k].deb, 1), Math.max(0, x.o || 0))));
          else e = Math.max(e, (opts.relax && S[x.k] ? S[x.k].b : slotOf(sviWAdd(cal, D[x.k].fin, 1 + Math.max(-1, x.o || 0)))));
        });
        const jh = dlyJH(k);
        let a, b;
        if (jh > 0) {
          let s = e, rem = jh, g = 0;
          while (free(s) <= 1e-9 && g++ < 40000) s++;
          a = s;
          for (g = 0; rem > 1e-9 && g < 40000; g++) {
            const f = free(s);
            if (f > 1e-9) { const t = Math.min(f, rem); used[s] = (used[s] || 0) + t; rem -= t; b = s; }
            if (rem > 1e-9) s++;
          }
          ptr = free(b) > 1e-9 ? b : b + 1;
        } else {
          /* sans main d'œuvre : sa durée actuelle (1 J sinon), sans occuper d'ouvriers */
          const d0 = dlyDeb(k), f0 = dlyFin(k), n = d0 && f0 ? Math.max(1, Math.round((Number(String(dlyDurK(k)).replace(",", ".")) || 1) * 2)) : 2;
          a = e; b = e + n - 1; ptr = b + 1;
        }
        S[k] = { a, b };
        D[k] = { deb: dayAt(a >> 1), fin: dayAt(b >> 1), dm: a & 1, fm: (b & 1) ? 0 : 1 };
        prevK = k;
      });
      return { D, S };
    };
    /* dates calculées → brouillon de la tâche (une seule période), demi-journées comprises */
    const dlyWriteH = D => {
      Object.keys(D).forEach(k => {
        const x = D[k], L = dlyDraftKey(k);
        const p = L[0] || { id: insId() };
        L.splice(0, L.length, p);
        p.deb = x.deb; p.fin = x.fin;
        if (x.dm) p.dmd = x.deb; else delete p.dmd;
        if (x.fm) p.fmd = x.fin; else delete p.fmd;
      });
    };
    /* liaison FIN → DÉBUT de b vers a (remplacée si elle existe) : décalage = jours travaillés entre la fin de a et le début de b, −1 = même jour */
    const dlyChainLink = (a, b, D) => {
      if (!a || !b || a === b || dlyReach(a, b)) return;
      const cal = insCal(), fa = D[a] ? D[a].fin : dlyFin(a), db = D[b] ? D[b].deb : dlyDeb(b);
      if (!fa || !db) return;
      const o = db >= fa ? Math.max(-1, (Number(sviWDur(cal, fa, db)) || 1) - 2) : -1;
      INS.dpred = INS.dpred || {};
      const L = dlyLinks(b).filter(x => x.k !== a);
      L.push({ k: a, t: "FD", o });
      INS.dpred[b] = L;
    };
    /* GÉNÉRER : seules les tâches sans dates sont placées ; celles qui ont déjà des dates restent où elles sont */
    const dlyAutoGen = (start, N) => {
      INS.ouv = N; INS.plaf = N;
      const all = dlyTopDown(dlyKeys()), todo = all.filter(k => !dlyDeb(k) || !dlyFin(k)), fixed = all.filter(k => !todo.includes(k));
      if (!todo.length) return null;
      const above = new Map(all.map((k, i) => [k, i ? all[i - 1] : null]));
      /* ordre de placement : de haut en bas ; la tâche du dessus (gardée ou placée) sert de point de départ */
      const { D } = dlyPack(todo, fixed, start, { pre: k => above.get(k) });
      dlyWriteH(D);
      dlyCommitDrafts();
      todo.forEach(k => { const a = above.get(k); if (a) dlyChainLink(a, k, D); });
      return D;
    };
    /* COMPRESSER : tâches avec dates, dans l'ordre de leur début (puis de haut en bas), resserrées sous le plafond ;
       les liaisons restent respectées (une liaison FIN → DÉBUT peut chevaucher la dernière demi-journée) */
    const dlyCompress = () => {
      const td = dlyTopDown(dlyKeys()), ti = new Map(td.map((k, i) => [k, i]));
      const dated = td.filter(k => dlyDeb(k) && dlyFin(k)).sort((a, b) => dlyDeb(a).localeCompare(dlyDeb(b)) || ti.get(a) - ti.get(b));
      if (!dated.length) return null;
      const start = dlyDeb(dated[0]);
      const ord = dlyTopo(dated, dlyDeb);
      const { D } = dlyPack(ord, [], start, { relax: true });
      dlyWriteH(D);
      dlyCommitDrafts();
      /* décalages des liaisons FIN → DÉBUT ramenés à l'écart réel (jamais plus grands qu'avant) */
      const cal = insCal();
      Object.keys(INS.dpred || {}).forEach(b => {
        if (!D[b]) return;
        INS.dpred[b] = dlyLinks(b).map(x => {
          if (x.t === "DD" || !D[x.k]) return x;
          const g = D[b].deb >= D[x.k].fin ? (Number(sviWDur(cal, D[x.k].fin, D[b].deb)) || 1) - 2 : -1;
          return { ...x, o: Math.min(x.o || 0, Math.max(-1, g)) };
        });
      });
      return D;
    };
    /* fenêtre COMPRESSER LE PLANNING */
    const dlyCompWin = () => {
      const n = dlyKeys().filter(k => dlyDeb(k) && dlyFin(k)).length;
      if (!n) { svToast("AUCUNE TÂCHE DATÉE À COMPRESSER : UTILISER GÉNÉRER LE PLANNING.", 3500); return; }
      const f0 = dlyEnd(dlyCurDates());
      svChoose({ title: "COMPRESSER LE PLANNING", html: `<div class="svc-sub">${n} TÂCHE(S) DATÉE(S) RESSERRÉE(S) POUR QU'AUCUN OUVRIER NE RESTE SANS TRAVAIL, SOUS LE PLAFOND (EFFECTIF PAR PÉRIODE), EN DEMI-JOURNÉES. LES LIAISONS SONT GARDÉES.</div><div class="svc-sub">FIN ACTUELLE : ${esc(dFr(f0))}</div>`,
        buttons: [{ v: "go", label: "COMPRESSER", tone: "neutral" }] }).then(r => {
        if (r !== "go") return;
        const D = dlyCompress();
        if (!D) return;
        insSave();
        histLog("DÉLAIS", "COMPRESSER LE PLANNING", n + " TÂCHE(S) — FIN " + dFr(f0) + " → " + dFr(dlyEnd(D)));
        renderTab(); insRenderChain();
        svToast("PLANNING COMPRESSÉ — FIN LE " + dFr(dlyEnd(dlyCurDates())) + ".", 3500);
      });
    };
    /* couper le plafond à une date : la partie de droite garde l'effectif, puis se tire seule */
    const dlyCutPlaf = iso => {
      const cal = insCal(), d = sviWNear(cal, iso, 1);
      if (dlyCapSegs().some(s => s.d === d)) { svToast("LE PLAFOND EST DÉJÀ COUPÉ LE " + dFr(d) + ".", 3000); return; }
      INS.plafs = (INS.plafs || []).concat([{ d, n: dlyCapOf(d) }]);
      insSave(); histLog("DÉLAIS", "PLAFOND COUPÉ", dFr(d)); renderTabK();
    };
    /* morceau de plafond tiré : n ouvriers (entier ≥ 1) ; i = 0 : première période */
    const dlySetPlaf = (i, n) => {
      if (!i) { INS.plaf = n; }
      else { const S = dlyCapSegs(), s = S[i]; if (!s) return; INS.plafs = (INS.plafs || []).map(x => x === s ? { ...x, n } : x); }
      /* deux morceaux voisins au même effectif : réunis */
      const S2 = dlyCapSegs(); INS.plafs = S2.slice(1).filter((s, j) => Number(s.n) !== Number(S2[j].n)).map(s => ({ d: s.d, n: Number(s.n) }));
      insSave(); histLog("DÉLAIS", "PLAFOND MAIN D'ŒUVRE", (i ? "À PARTIR DU " + dFr((dlyCapSegs()[i] || {}).d || "") + " : " : "") + n); renderTabK();
    };
