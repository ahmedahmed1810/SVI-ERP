    /* ===== v530 : GÉNÉRER / COMPRESSER LE PLANNING, PLAFOND PAR PÉRIODES, DEMI-JOURNÉES =====
       - effectif (plafond) par périodes : st.plaf = première période ; st.plafs = [{ d: date de début, n: ouvriers }]
         (st = INS sans charge cochée ; sinon un plafond par ressource cochée dans INS.plafR — v542, R9)
       - demi-journées : une période de tâche peut commencer à midi (p.dmd === p.deb) ou finir à midi (p.fmd === p.fin)
       - GÉNÉRER : tâches SANS dates, dans l'ordre du PLANNING ; durée = quantité ÷ plafond ;
         une demi-journée où des ouvriers restent libres est prise par la tâche suivante (chevauchement) ;
         liaison FIN → DÉBUT posée entre chaque tâche et celle du dessous (décalage −1 J = même jour)
       - COMPRESSER : tâches AVEC dates, dans l'ordre de leur début, resserrées pour ne laisser aucun ouvrier sans travail
       v542 (remarques du planning 1 à 16, 23/10/2026) : un seul bouton GÉNÉRER / COMPRESSER (R5), tâches INCOMPRESSIBLES (R3),
       ressource = charges cochées (R9, R11, R14), plafond en direct (R2), tâches sans la ressource et sans durée à 0 jour (R6, R15) */
    /* ressource choisie (R9, R11, R14) : charges cochées du DÉTAIL CHARGES ; sans case cochée : toute la main d'œuvre (J-H) */
    const dlyResSel = () => { const R = (INS.chg || []).filter(r => !r.t && r.on === true); return R.length ? R : null; };
    const dlyResU = r => dlyIsLab(r) ? "J-H" : (U_(r.u) || "U");
    const dlyResK = r => U_(r.des) + "|" + dlyResU(r);
    /* même unité pour toutes les charges cochées : QUANTITÉ ; sinon MONTANT seulement (R11) */
    const dlyResMode = R => !R || new Set(R.map(dlyResU)).size === 1 ? "q" : "m";
    /* part de la ressource dans une tâche, par charge (clé désignation | unité) */
    const dlyResOf = (k, R) => {
      const ids = new Set(R.map(r => r.id)), m = dlyResMode(R), out = new Map(), seen = new Set();
      (INS.links || []).forEach(l => {
        if (l.lot + "|" + l.sec !== k) return;
        (l.chg || []).forEach(e => {
          if (!ids.has(e.id) || seen.has(e.id)) return;
          seen.add(e.id);
          const r = INS.chg.find(x => x.id === e.id);
          if (!r) return;
          const v = m === "q" ? (dlyIsLab(r) ? dlyJHof(r) : num(r.q || 0) || 0) : (num(r.q || 0) || 0) * (num(r.p || 0) || 0);
          if (v) out.set(dlyResK(r), (out.get(dlyResK(r)) || 0) + v);
        });
      });
      return out;
    };
    /* quantité de la ressource portée par une tâche (GÉNÉRER / COMPRESSER, plafond) */
    const dlyResQ = k => { const R = dlyResSel(); if (!R || dlyResMode(R) !== "q") return dlyJH(k); let t = 0; dlyResOf(k, R).forEach(v => { t += v; }); return Math.round(t * 100) / 100; };
    /* plafond de la ressource en cours : un par ressource cochée (R9 : chaque ressource se compresse séparément) */
    const dlyCapSt = () => {
      const R = dlyResSel();
      if (!R || dlyResMode(R) !== "q") return INS;
      const k = [...new Set(R.map(dlyResK))].sort().join(" § ");
      INS.plafR = INS.plafR || {};
      return (INS.plafR[k] = INS.plafR[k] || {});
    };
    const dlyCapBase = () => { const st = dlyCapSt(); return Math.max(1, Math.round(Number(st.plaf) || (st === INS ? Number(INS.ouv) : 0) || 1)); };
    /* R2 : un morceau coupé peut descendre à 0 (personne sur place : les tâches sont repoussées après lui) */
    const dlyCapSegs = () => [{ d: "", n: dlyCapBase() }].concat((dlyCapSt().plafs || []).filter(s => s && s.d && Number(s.n) >= 0).sort((a, b) => a.d.localeCompare(b.d)));
    const dlyCapOf = iso => { let n = dlyCapBase(); dlyCapSegs().forEach(s => { if (s.d && s.d <= iso) n = Number(s.n); }); return n; };
    /* R3 : tâche INCOMPRESSIBLE (date ou durée changée à la main) — sa durée est gardée, elle n'obéit pas au plafond */
    const dlyInc = k => !!(INS.dinc || {})[k];
    const dlyIncSet = (k, on) => { INS.dinc = INS.dinc || {}; if (on) INS.dinc[k] = 1; else delete INS.dinc[k]; };
    const dlyIncHTML = k => dlyInc(k) ? `<span class="dly-inc" data-key="${esc(k)}" role="button" title="TÂCHE INCOMPRESSIBLE">▣</span>` : "";
    const dlyIncWin = k => svChoose({ title: "TÂCHE INCOMPRESSIBLE",
      html: `<div class="svc-sub"><b>${esc(dlyName(k))}</b></div><div class="svc-sub">SA DATE OU SA DURÉE A ÉTÉ CHANGÉE À LA MAIN : COMPRESSER ET LA BARRE DE PLAFOND GARDENT SA DURÉE, MÊME AU-DESSUS DU PLAFOND.</div>`,
      buttons: [{ v: "off", label: "RENDRE COMPRESSIBLE", tone: "neutral" }] }).then(r => {
      if (r !== "off") return;
      dlyIncSet(k, false); insSave(); histLog("DÉLAIS", "TÂCHE COMPRESSIBLE", dlyName(k)); renderTabK();
    });
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
    /* tâches de haut en bas, comme elles s'affichent : l'ordre du PLANNING (R16 : plus de regroupement par lot) */
    const dlyTopDown = keys => { const K = new Set(keys); return [...dlyOrder(keys).keys()].filter(k => K.has(k)); };
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
        const jh = dlyResQ(k), n = Math.max(1, b - a + 1);
        if (jh > 0) for (let s = a; s <= b; s++) used[s] = (used[s] || 0) + jh / n;
      });
      let ptr = 0, prevK = null;
      const slotOf = iso => dayIx(iso) * 2;
      order.forEach(k => {
        /* tâche juste au-dessus (placée ou gardée) : la suivante commence dès sa dernière demi-journée si des ouvriers y restent libres */
        const pk = opts.pre ? opts.pre(k) : prevK;
        let e = ptr;
        if (pk && S[pk]) { const lab = dlyResQ(pk) > 0; e = Math.max(opts.pre ? 0 : e, lab ? S[pk].b : S[pk].b + 1); }
        else if (opts.pre) e = 0;
        /* autres liaisons de la tâche (hors tâche du dessus) : respectées */
        dlyLinks(k).forEach(x => {
          if (x.k === pk || !D[x.k]) return;
          if (x.t === "DD") e = Math.max(e, slotOf(sviWAdd(cal, sviWNear(cal, D[x.k].deb, 1), Math.max(0, x.o || 0))));
          else e = Math.max(e, (opts.relax && S[x.k] ? S[x.k].b : slotOf(sviWAdd(cal, D[x.k].fin, 1 + Math.max(-1, x.o || 0)))));
        });
        const jh = dlyResQ(k);
        let a, b, zero = false;
        if (dlyInc(k) && dlyDeb(k) && dlyFin(k)) {
          /* R3 : tâche incompressible — sa durée (demi-journées comprises), sans regarder le plafond */
          const n = Math.max(1, Math.round((Number(String(dlyDurK(k)).replace(",", ".")) || 1) * 2));
          a = e; b = e + n - 1;
          if (jh > 0) for (let s = a; s <= b; s++) used[s] = (used[s] || 0) + jh / n;
          if (opts.pre) ptr = b + 1;   /* COMPRESSER : elle n'arrête pas les tâches suivantes, qui prennent les ouvriers restés libres */
        } else if (jh > 0) {
          let s = e, rem = jh, g = 0;
          while (free(s) <= 1e-9 && g++ < 40000) s++;
          a = s;
          for (g = 0; rem > 1e-9 && g < 40000; g++) {
            const f = free(s);
            if (f > 1e-9) { const t = Math.min(f, rem); used[s] = (used[s] || 0) + t; rem -= t; b = s; }
            if (rem > 1e-9) s++;
          }
          ptr = free(b) > 1e-9 ? b : b + 1;
        } else if (dlyDeb(k) && dlyFin(k)) {
          /* sans la ressource, déjà datée : sa durée actuelle, sans occuper d'ouvriers */
          const n = Math.max(1, Math.round((Number(String(dlyDurK(k)).replace(",", ".")) || 1) * 2));
          a = e; b = e + n - 1; if (opts.pre) ptr = b + 1;
        } else {
          /* R6 / R15 : sans la ressource et sans durée = 0 jour (seul le DÉBUT est posé), à sa place dans la chaîne */
          a = e; b = e - 1; zero = true;
        }
        S[k] = { a, b };
        D[k] = zero ? { deb: dayAt(a >> 1), fin: "", dm: 0, fm: 0 } : { deb: dayAt(a >> 1), fin: dayAt(b >> 1), dm: a & 1, fm: (b & 1) ? 0 : 1 };
        /* COMPRESSER : une tâche sans la ressource ne retient pas la suivante */
        if (opts.pre || jh > 0) prevK = k;
      });
      return { D, S };
    };
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
    /* liaison FIN → DÉBUT de b vers a (remplacée si elle existe) : décalage = jours travaillés entre la fin de a et le début de b, −1 = même jour */
    const dlyChainLink = (a, b, D) => {
      if (!a || !b || a === b || dlyReach(a, b)) return;
      const cal = insCal(), fa = D[a] ? D[a].fin || D[a].deb : dlyFin(a) || dlyDeb(a), db = D[b] ? D[b].deb : dlyDeb(b);
      if (!fa || !db) return;
      const o = db >= fa ? Math.max(-1, (Number(sviWDur(cal, fa, db)) || 1) - 2) : -1;
      INS.dpred = INS.dpred || {};
      const L = dlyLinks(b).filter(x => x.k !== a);
      L.push({ k: a, t: "FD", o });
      INS.dpred[b] = L;
    };
    /* GÉNÉRER : seules les tâches sans dates sont placées ; celles qui ont déjà des dates restent où elles sont */
    const dlyAutoGen = (start, N, keep) => {
      if (!keep) { INS.ouv = N; dlyCapSt().plaf = N; }
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
      const dated = td.filter(k => dlyDeb(k) && (dlyFin(k) || !(dlyResQ(k) > 0))).sort((a, b) => dlyDeb(a).localeCompare(dlyDeb(b)) || ti.get(a) - ti.get(b));
      if (!dated.some(k => dlyFin(k))) return null;
      /* depuis la date de début du projet (elle ne change pas) */
      const start = [INS.pdeb || INS.gdeb, dlyDeb(dated[0])].filter(Boolean).sort()[0];
      const ord = dlyTopo(dated, dlyDeb);
      const { D } = dlyPack(ord, [], start, { relax: true });
      dlyWriteH(D);
      dlyCommitDrafts();
      /* décalages des liaisons FIN → DÉBUT ramenés à l'écart réel (jamais plus grands qu'avant) */
      const cal = insCal();
      Object.keys(INS.dpred || {}).forEach(b => {
        if (!D[b]) return;
        INS.dpred[b] = dlyLinks(b).map(x => {
          if (x.t === "DD" || !D[x.k] || !D[x.k].fin) return x;
          const g = D[b].deb >= D[x.k].fin ? (Number(sviWDur(cal, D[x.k].fin, D[b].deb)) || 1) - 2 : -1;
          return { ...x, o: Math.min(x.o || 0, Math.max(-1, g)) };
        });
      });
      return D;
    };
    /* R5 : un seul bouton — GÉNÉRER sur un planning sans dates, sinon COMPRESSER (sans confirmation : ↶ annule) ;
       les tâches sans dates qui portent la ressource sont d'abord placées comme par GÉNÉRER */
    const dlyHasDates = () => dlyKeys().some(k => dlyDeb(k) && dlyFin(k));
    const dlyCompressRun = (opts = {}) => {
      const snap = () => JSON.stringify(dlyCurDates()), before = snap(), f0 = dlyEnd(dlyCurDates());
      const und = dlyKeys().filter(k => (!dlyDeb(k) || !dlyFin(k)) && dlyResQ(k) > 0);
      if (und.length) dlyAutoGen(dlyProjStart(), dlyCapBase(), true);
      const D = dlyCompress();
      if (!D && !und.length) { if (!opts.quiet) svToast("AUCUNE TÂCHE DATÉE À COMPRESSER.", 3000); renderTabK(); return null; }
      insSave();
      const f1 = dlyEnd(dlyCurDates()), same = snap() === before;
      histLog("DÉLAIS", "COMPRESSER LE PLANNING", (opts.plaf !== undefined ? "PLAFOND " + opts.plaf + " — " : "") + "FIN " + dFr(f0) + " → " + dFr(f1));
      renderTabK(); insRenderChain();
      if (same) svToast(opts.plaf !== undefined ? "AUCUN GAIN AVEC CE NOMBRE." : "RIEN À RESSERRER : LE PLANNING EST DÉJÀ COMPRESSÉ.", 3000, opts.anchor);
      else if (opts.plaf === undefined) svToast("PLANNING COMPRESSÉ — FIN LE " + dFr(f1) + ".", 3500);
      if (INS.dbut && f1 > INS.dbut) svToast(DLY_BUT_MSG + " (FIN LE " + dFr(f1) + ", BUTOIR LE " + dFr(INS.dbut) + ").", 5000, opts.anchor);
      return D;
    };
    const dlyGenComp = () => dlyHasDates() ? dlyCompressRun() : dlyGenWin();
    /* couper le plafond à une date : la partie de droite garde l'effectif, puis se tire seule */
    const dlyCutPlaf = iso => {
      const cal = insCal(), d = sviWNear(cal, iso, 1);
      if (dlyCapSegs().some(s => s.d === d)) { svToast("LE PLAFOND EST DÉJÀ COUPÉ LE " + dFr(d) + ".", 3000); return; }
      const st = dlyCapSt();
      st.plafs = (st.plafs || []).concat([{ d, n: dlyCapOf(d) }]);
      insSave(); histLog("DÉLAIS", "PLAFOND COUPÉ", dFr(d)); renderTabK();
    };
    /* morceau de plafond tiré : n (entier ; 1 au moins pour la première période, 0 possible ensuite) ; i = 0 : première période ;
       R2 : le planning est aussitôt recompressé sous le nouveau plafond (plus de bouton APPLIQUER LE NIVELLEMENT) */
    const dlySetPlaf = (i, n, anchor) => {
      const st = dlyCapSt();
      if (!i) st.plaf = Math.max(1, n);
      else { const S = dlyCapSegs(), s = S[i]; if (!s) return; st.plafs = (st.plafs || []).map(x => x.d === s.d ? { d: x.d, n: Math.max(0, n) } : x); }
      /* deux morceaux voisins au même effectif : réunis */
      const S2 = dlyCapSegs(); st.plafs = S2.slice(1).filter((s, j) => Number(s.n) !== Number(S2[j].n)).map(s => ({ d: s.d, n: Number(s.n) }));
      histLog("DÉLAIS", "PLAFOND", (i ? "À PARTIR DU " + dFr((dlyCapSegs()[i] || {}).d || "") + " : " : "") + n);
      if (!dlyHasDates() && !dlyKeys().some(k => dlyResQ(k) > 0)) { insSave(); renderTabK(); return; }
      dlyCompressRun({ plaf: n, quiet: true, anchor });
    };
    /* ===== v542 : histogramme de la ressource cochée (R9, R11, R14), commandes (R10, R11), hauteur réglable (R12) ===== */
    const DLY_SER = ["#2e90fa", "#f79009", "#12b76a", "#7a5af8", "#ee46bc", "#06aed4", "#a15c07", "#667085"];
    /* hauteur de l'histogramme : nombre de pixels (28 = miniaturisé en bas) ou « full » (plein écran, à la place du Gantt) */
    const dlyHHGet = () => { let v = ""; try { v = localStorage.getItem("svi_dlyhh_v1") || ""; } catch (e) {} return v === "full" ? "full" : Math.max(28, Math.min(2000, Number(v) || 110)); };
    const dlyHHSet = v => { try { localStorage.setItem("svi_dlyhh_v1", String(v)); } catch (e) {} };
    const dlyCmdCfg = () => ({ grp: "f", pv: 0, fq: 30, on: false, ...(INS.cmd || {}) });
    /* consommation jour par jour de chaque charge cochée (répartie sur les jours travaillés de chaque tâche, demi-journées comprises) */
    const dlyHistData = () => {
      const R = dlyResSel();
      if (!R) return null;
      const mode = dlyResMode(R), cal = insCal(), cur = dlyCurDates(), ser = new Map(), det = {}, tot = {};
      [...new Set(R.map(dlyResK))].forEach(sk => ser.set(sk, { L: {} }));
      Object.keys(cur).forEach(k => {
        const p = cur[k], m = dlyResOf(k, R);
        if (!m.size) return;
        const n = sviWDur(cal, p.deb, p.fin) || 1, fr = i => (i === 0 && p.hs ? .5 : 1) * (i === n - 1 && p.he ? .5 : 1);
        let t = 0; for (let i = 0; i < n; i++) t += fr(i);
        for (let i = 0, x = sviWNear(cal, p.deb, 1); i < n; i++, x = sviWAdd(cal, x, 1)) {
          let sum = 0;
          m.forEach((v, sk) => { const w = v / (t || 1) * fr(i), S = ser.get(sk); if (S) S.L[x] = (S.L[x] || 0) + w; sum += w; });
          tot[x] = (tot[x] || 0) + sum;
          (det[x] = det[x] || []).push({ k, v: sum, inc: dlyInc(k) });
        }
      });
      const H = { R, mode, ser, det, tot, unit: mode === "q" ? dlyResU(R[0]) : "DH" };
      H.cmd = dlyOrders(H);
      return H;
    };
    /* commandes (R10, R11) : PAR TÂCHE, PAR GROUPE (lot de 1er niveau) ou PAR FRÉQUENCE (tous les N jours), passées PRÉAVIS jours avant */
    const dlyOrders = H => {
      const c = dlyCmdCfg();
      if (!c.on) return null;
      const L = {}, pv = Math.max(0, Number(c.pv) || 0), add = (iso, v) => { if (!v) return; const d = sviIsoAdd(iso, -pv); L[d] = (L[d] || 0) + v; };
      const days = Object.keys(H.tot).sort();
      if (c.grp === "f") {
        const fq = Math.max(1, Number(c.fq) || 30), s0 = [dlyProjStart(), days[0]].filter(Boolean).sort()[0];
        days.forEach(di => add(sviIsoAdd(s0, Math.floor(dDiff(s0, di) / fq) * fq), H.tot[di]));
      } else {
        const per = {};
        Object.keys(H.det).forEach(di => H.det[di].forEach(x => {
          const gk = c.grp === "t" ? x.k : (dlyLotPath(lkName("lot", x.k.split("|")[0]))[0] || x.k);
          const o = per[gk] = per[gk] || { d: di, v: 0 };
          if (di < o.d) o.d = di; o.v += x.v;
        }));
        Object.values(per).forEach(o => add(o.d, o.v));
      }
      return { L, lab: "COMMANDES " + (c.grp === "f" ? "TOUS LES " + c.fq + " J" : c.grp === "t" ? "PAR TÂCHE" : "PAR GROUPE (LOT)") + (pv ? " — " + pv + " J D'AVANCE" : "") };
    };
    /* libellé à gauche de l'histogramme (sous le tableau) */
    const dlyHistLab = () => {
      const R = dlyResSel();
      if (!R) return "CHARGES";
      const ks = [...new Set(R.map(r => U_(r.des)))];
      return esc(ks[0]) + (ks.length > 1 ? " + " + (ks.length - 1) : "") + "<br>(" + esc(dlyCmdCfg().on ? "COMMANDES" : dlyResMode(R) === "q" ? dlyResU(R[0]) + " / JOUR" : "DH / JOUR") + ")";
    };
    /* fenêtre COMMANDES (menu ⋯, FORMAT 159) */
    const dlyCmdWin = () => {
      const c = dlyCmdCfg(), d = document.createElement("div");
      d.id = "svConf";
      d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true">
        <button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
        <div class="svc-t">COMMANDES</div>
        <div class="bdt-row"><span>GROUPEMENT</span><span class="cmd-g">${[["t", "PAR TÂCHE"], ["g", "PAR GROUPE (LOT)"], ["f", "PAR FRÉQUENCE"]].map(([v, l]) => `<label><input type="radio" name="cmdg" value="${v}"${c.grp === v ? " checked" : ""}> ${l}</label>`).join("")}</span></div>
        <div class="bdt-row"><span>PRÉAVIS (J)</span><input class="cmd-pv" inputmode="numeric" value="${esc(String(c.pv))}"></div>
        <div class="bdt-row"><span>FRÉQUENCE (J)</span><input class="cmd-fq" inputmode="numeric" value="${esc(String(c.fq))}"></div>
        <div class="bdt-row"><span>AFFICHER LES COMMANDES</span><input type="checkbox" class="cmd-on"${c.on ? " checked" : ""}></div>
        <div class="svc-sub">CALCUL SUR LES CHARGES COCHÉES ; MÊME CALCUL POUR LA MAIN D'ŒUVRE (EX. FRÉQUENCE 30, PRÉAVIS 0 = J-H PAR MOIS POUR LA PAIE).</div>
        <div class="svc-f"><button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button></div></div>`;
      document.getElementById("svConf")?.remove();
      document.body.appendChild(d);
      d.addEventListener("click", e => {
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
        if (!e.target.closest("[data-ok]")) return;
        const pv = String(d.querySelector(".cmd-pv").value).trim(), fq = String(d.querySelector(".cmd-fq").value).trim();
        if (!/^\d+$/.test(pv)) { svToast("PRÉAVIS : NOMBRE ENTIER DE JOURS.", 3000, d.querySelector(".cmd-pv")); return; }
        if (!/^\d+$/.test(fq) || Number(fq) < 1) { svToast("FRÉQUENCE : NOMBRE ENTIER DE JOURS (1 AU MOINS).", 3000, d.querySelector(".cmd-fq")); return; }
        INS.cmd = { grp: (d.querySelector('input[name="cmdg"]:checked') || {}).value || "f", pv: Number(pv), fq: Number(fq), on: d.querySelector(".cmd-on").checked };
        d.remove();
        insSave(); histLog("DÉLAIS", "COMMANDES", dlyOrders({ tot: {}, det: {} }) ? "AFFICHÉES" : "MASQUÉES"); renderTabK();
      });
    };
