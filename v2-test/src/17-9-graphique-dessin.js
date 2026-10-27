    /* =========================================================
       REFONTE, ÉTAPE 7 (v644) : DESSIN DU GRAPHIQUE (histogramme, courbes, commandes, rendement, CAPACITÉ, règle, DÉBUT / FIN)
       sorti de dlyGanttDraw — il reçoit tout ce dont il a besoin (G) et rend le HTML du graphique ;
       données : 17b (dlyHistData…) ; gestes : 17-6 et 17-7 ; pied fixe : dlyFoot (17-3).
       G = { HD (données), R (lignes du planning), W (largeur), X (date → x), bg (fond des jours), d0 / d1 (premier / dernier jour),
             dlyHHpx (hauteur), host (#dlyGantt : host.__HV pour la bulle), today, vline (trait vertical d'une date) }
       ========================================================= */
    const dlyGraphHTML = ({ HD, R, W, X, bg, d0, d1, dlyHHpx, host, today, vline }) => {
      /* histogramme des charges cochées (R9, R11, R14 ; v543 : R17 à R21) : une couleur par charge ; jour par jour (barres) ou cumulé (courbe) ;
         plage DÉBUT – FIN (R19), filtre MIN – MAX (R20), barre CAPACITÉ (R21 à R23), commandes prévisionnelles (R17) */
      let hist = "";
      {
        const HH = dlyHHpx;
        if (!HH) hist = "";
        else if (!HD) hist = `<div class="ghist ghist-empty" style="width:${W}px;height:${HH}px"><div class="ghist-msg">${(INS.chg || []).some(r => !r.t) ? "AUCUNE CHARGE POUR LES FILTRES EN COURS" : "AUCUNE CHARGE DANS CE BUDGET : SAISIR LE DÉTAIL CHARGES"}</div></div>`;
        else {
          /* v546 : R20 valeur par morceau, R24 capacité en MONTANT, échelle abrégée, légende (70 %), R28 cumul = une courbe,
             R29 courbes CHARGES / PRODUITS / MARGE */
          const C = HD.cmd, ks = [...HD.ser.keys()], hs = dlyHSet(), cum = hs.aff === "c", crb = HD.crb || ["c"];   /* v566 (remarque 9) : COMMANDES aussi en CUMULÉE */
          /* v571 (remarques 14 et 15) : FORME HISTOGRAMME / COURBES pour tout ce qui est affiché (départ : histogramme pour les commandes,
             courbes avec RENDEMENT, sinon selon la présentation) ; avec RENDEMENT, CHARGES et PRODUITS (quantité produite) sont facultatifs */
          const hasRd = crb.includes("r"), curve = hs.forme ? hs.forme === "c" : (C ? false : hasRd ? true : cum);
          const sC = crb.includes("c") && !!HD.R, sP = crb.includes("p") && !hasRd, sG = crb.includes("g") && !hasRd, multi = !C && (sP || sG);
          const hideC = hasRd && !crb.includes("c") && !C;
          const RG = dlyHRange(), VL = { min: null, max: null }, inR = di => (!RG.a || di >= RG.a) && (!RG.b || di <= RG.b);
          const cur = dlyCurGK(), canP = !C && !cum && !curve && !multi && !hideC && !!cur && !!HD.R, IB = canP ? 14 : 0;
          const days = [...new Set(Object.keys(C ? C.L : HD.tot).concat(multi ? Object.keys(HD.prd || {}) : []).concat(C && C.P && (sP || sG) ? Object.keys(C.P) : []))].sort();
          /* valeurs par jour (ou cumul : relatif = repart de 0 au trait DÉBUT) */
          const cumOf = get => { const o = {}; let t = 0, b = 0; days.forEach(di => { const v = get(di); if (hs.cum === "r" && RG.a && di < RG.a) b += v; t += v; o[di] = t - b; }); return o; };
          const gC = di => HD.tot[di] || 0, gP = di => (HD.prd || {})[di] || 0, gG = di => gP(di) - gC(di);
          const val = {}, sval = ks.map(() => ({}));
          if (C && cum) Object.assign(val, cumOf(di => C.L[di] || 0));
          else if (C) days.forEach(di => { val[di] = C.L[di]; });
          else if (!cum) days.forEach(di => { val[di] = gC(di); ks.forEach((sk, j) => { sval[j][di] = HD.ser.get(sk).L[di] || 0; }); });
          else Object.assign(val, cumOf(gC));
          const vP = multi ? (cum ? cumOf(gP) : Object.fromEntries(days.map(di => [di, gP(di)]))) : {};
          const vG = multi ? (cum ? cumOf(gG) : Object.fromEntries(days.map(di => [di, gG(di)]))) : {};
          /* v605 (remarque longue 5) : avec les COMMANDES, PRODUITS et MARGE de la période couverte, au jour de l'envoi (cumulés : en escalier) */
          const cPG = !!(C && C.P && (sP || sG));
          if (cPG) { const cu = M => cum ? cumOf(di => M[di] || 0) : Object.fromEntries(days.map(di => [di, M[di] || 0])); if (sP) Object.assign(vP, cu(C.P)); if (sG) Object.assign(vG, cu(C.G)); }
          /* v600 : MARGE seule en % = marge ÷ produits × 100 (par jour, ou sur le cumul en CUMULÉE) ; jour sans produit = pas de valeur */
          const mgP = multi && sG && !sC && !sP && hs.mg === "p";
          if (mgP) Object.keys(vG).forEach(di => { const P = vP[di]; if (Math.abs(P || 0) > 1e-9) vG[di] = vG[di] / P * 100; else delete vG[di]; });
          const vis = days.filter(di => di >= d0 && di <= d1);
          const shown = di => [...(multi ? [] : [val[di]]), ...(multi && sC ? [val[di]] : []), ...(sP ? [vP[di]] : []), ...(sG ? [vG[di]] : [])];
          const mx = Math.max(0, ...vis.flatMap(di => shown(di)).filter(v => v !== undefined));
          const mn = Math.min(0, ...vis.flatMap(di => shown(di)).filter(v => v !== undefined));
          const SG = canP ? dlyCapSegs() : [];
          /* v545 (remarque 5) : capacité jamais réglée = barre rouge posée juste au-dessus du jour le plus chargé, avec son nombre */
          const capDef = canP && SG.length === 1 && dlyCapDef(), mxAll = Math.max(0, ...days.map(di => val[di] || 0));
          if (capDef) SG[0] = { ...SG[0], n: Math.max(1, Math.ceil(mxAll - 1e-9)), def: true };
          const PM = Math.max(0, ...SG.map(x => x.n));
          /* v577 (remarque 7) : échelle des valeurs agrandie au pincement vertical (shell.__dlyYZ) */
          const YZ = Math.max(1, shell.__dlyYZ || 1);
          const YRG = ((Math.max(mx, PM, VL.max || 0) - mn) || 1) * 1.08;
          /* v609 : marge de 8 px sous le zéro (les barres ne semblent plus partir sous le bord) */
          const top = YRG / YZ, sc = (HH - 44 - IB) / top, Y0b = HH - IB - 8 - Math.min(-mn, top) * sc;
          /* v582 : après le zoom, l'échelle peut monter ou descendre (shell.__dlyYO, en valeur) pour voir le haut des barres */
          const YO = YZ > 1.01 ? Math.max(0, Math.min(YRG - top, shell.__dlyYO || 0)) : 0;
          shell.__dlyYO = YO;
          const Y0 = Y0b + YO * sc;
          shell.__dlyYGeo = { RG: YRG, mn, HH, IB };
          const pass = di => inR(di) && (multi || ((VL.min === null || val[di] >= VL.min - 1e-9) && (VL.max === null || val[di] <= VL.max + 1e-9)));
          const bw = Math.max(1, DLY_DW - (DLY_DW > 10 ? 6 : 0)), bo = DLY_DW > 10 ? 3 : 0;
          const capAt = di => { let n = -1; SG.forEach(x => { if (!x.def && (!x.d || x.d <= di)) n = x.n; }); return n; };
          /* v604 : rendement réglé (charge de main-d'œuvre seule sélectionnée) et heures sup du jour */
          const rdGK = (() => { const g = dlyCurGK(); return g && /\|J-H$/.test(g) && !g.includes(" § ") ? g : ""; })(), rdSt0 = rdGK ? dlyRdSt(rdGK, "", false) : null;
          const rdDay = di => rdSt0 && dlyRdSet0(rdSt0) ? dlyRdAt(di, rdSt0) / 100 : 1, hsup = {};
          /* nombres abrégés (R24) : 5 K, 1,5 M, 1 G */
          const fmtA = v => { const a = Math.abs(v), f = (x, u) => (Math.round(x * 10) / 10).toLocaleString("fr-FR") + " " + u; return a >= 1e9 ? f(v / 1e9, "G") : a >= 1e6 ? f(v / 1e6, "M") : a >= 1e4 ? f(v / 1e3, "K") : (Math.round(v * 100) / 100).toLocaleString("fr-FR"); };
          const fmtV = v => (Math.round(v * 100) / 100).toLocaleString("fr-FR");
          /* légende (R24) : par montant décroissant ; toutes les charges cochées = seulement celles qui font le % réglé, le reste en AUTRES */
          /* v628 : avec une plage DÉBUT – FIN, la légende est calculée sur la plage seulement (séries absentes de la plage retirées) */
          const totS = ks.map((sk, j) => [sk, days.filter(inR).reduce((t, di) => t + (HD.ser.get(sk).L[di] || 0), 0)]).filter(x => !(RG.a || RG.b) || x[1] > 1e-9).sort((a, b) => b[1] - a[1]);
          const allOn = (INS.chg || []).filter(r => !r.t).every(r => r.on === true);
          const pct = Math.max(1, Math.min(100, Number(INS.chgPar) || 70)), grand = totS.reduce((t, x) => t + x[1], 0) || 1;
          const keep = new Set(); { let acc = 0; totS.forEach(([sk, v]) => { if (!allOn || acc < grand * pct / 100 - 1e-9) keep.add(sk); acc += v; }); }
          const col = {}; let ci = 0; totS.forEach(([sk]) => { col[sk] = keep.has(sk) ? DLY_SER[ci++ % DLY_SER.length] : "#7f5539"; });
          const order = totS.map(x => ks.indexOf(x[0]));
          let hb = "", svg = "";
          /* v572 (remarque 16) : couleurs usuelles — PRODUITS en bleu, CHARGES en orange, MARGE en vert (rouge quand elle est négative) */
          const CC = "#f79009", CP = "#2e90fa", CG = "#12b76a", CGN = "#d92d20";
          /* v589 : une charge garde sa couleur partout — orange si elle est seule, sinon celle de la légende */
          const colOf = (sk, j) => ks.length > 1 ? (col[sk] || DLY_SER[j % DLY_SER.length]) : CC;
          if (!C && !hideC && !curve && !multi && !cum) {
            /* v628 : jour avec au moins une tâche en cours mais sans charge = barre aplatie à zéro (couleur de la série) */
            const cal = insCal(), busy = new Set();
            R.filter(x => !x.grp && x.deb).forEach(x => { const f = x.fin || x.deb; for (let d = x.deb, g = 0; d <= f && g < 2000; d = sviIsoAdd(d, 1), g++) if (d >= d0 && d <= d1 && sviWork(cal, d)) busy.add(d); });
            vis.forEach(di => { if (busy.has(di) && !(Math.abs(val[di] || 0) > 1e-9) && pass(di)) hb += `<div class="ghb ghb-z" data-d="${di}" style="left:${X(di) + bo}px;width:${bw}px;bottom:${HH - Y0}px;background:${ks.length === 1 ? colOf(ks[0], 0) : CC}"></div>`; });
          }
          if (hideC) vis.forEach(di => { hb += `<div class="ghb ghb-hit" data-d="${di}" style="left:${X(di)}px;width:${DLY_DW}px;height:${HH}px;bottom:0"></div>`; });
          else if (C && !curve) {
            /* v589 : commandes prévisionnelles — barres fines hachurées, empilées à la couleur de chaque charge commandée */
            const nb = 1 + (cPG && sP ? 1 : 0) + (cPG && sG ? 1 : 0), w1 = bw / nb;
            const cw = nb > 1 ? Math.max(1, w1) : Math.max(1, Math.round(bw * .55)), co = nb > 1 ? bo : bo + Math.round((bw - cw) / 2), acc = {};
            if (nb > 1) vis.forEach(di => [...(sP ? [[vP, CP]] : []), ...(sG ? [[vG, CG]] : [])].forEach(([M, c], j) => { const v = M[di] || 0; if (!v) return;
              hb += `<div class="ghb ghb-m${pass(di) ? "" : " gh-off"}" data-d="${di}" style="left:${X(di) + bo + (j + 1) * w1}px;width:${w1}px;top:${Y0 - Math.max(v, 0) * sc}px;bottom:auto;height:${Math.max(1, Math.abs(v) * sc)}px;background:${c === CG && v < 0 ? CGN : c}"></div>`; }));
            vis.forEach(di => {
              const P = {}; (C.det[di] || []).forEach(x => { P[x.sk] = (P[x.sk] || 0) + x.v; });
              if (cum) { Object.keys(P).forEach(sk => { acc[sk] = (acc[sk] || 0) + P[sk]; }); Object.keys(acc).forEach(sk => { P[sk] = acc[sk]; }); }
              const v = val[di] || 0; if (!v) return;
              const parts = Object.keys(P).map((sk, j) => P[sk] ? `<i style="height:${P[sk] * sc}px;background-color:${colOf(sk, j)}"></i>` : "").join("");
              hb += `<div class="ghb ghc ghb-st${pass(di) ? "" : " gh-off"}" data-d="${di}" style="left:${X(di) + co}px;width:${cw}px;height:${Math.max(1, v * sc)}px;bottom:${HH - Y0}px">${parts}</div>`;
            });
          }
          else if (!curve && !multi) vis.forEach(di => {
            /* v604 : rendement réglé > 100 % = la capacité en J-H du jour monte d'autant (heures sup) ; au-delà seulement, dépassement */
            const v = val[di], n = capAt(di), rf = rdDay(di), over = !cum && n >= 0 && v > n * rf + 1e-9, inc = over && (HD.det[di] || []).some(x => x.inc);
            const hsv = !cum && n >= 0 && rf > 1 && v > n + 1e-9 ? Math.min(v, n * rf) - n : 0;
            if (hsv > 1e-9) { hsup[di] = hsv * 8; if (pass(di)) hb += `<div class="ghb-hs" style="left:${X(di) + bo}px;width:${bw}px;height:${Math.max(1, hsv * sc)}px;bottom:${HH - Y0 + n * sc}px"></div>`; }
            const parts = ks.length > 1 && !cum ? order.map(j => { const w = sval[j][di]; return w ? `<i style="height:${w * sc}px;background:${col[ks[j]]}"></i>` : ""; }).join("") : "";
            hb += `<div class="ghb${over ? (inc ? " over-inc" : " over") : ""}${ks.length > 1 && !cum ? " ghb-st" : ""}${pass(di) ? "" : " gh-off"}" data-d="${di}" style="left:${X(di) + bo}px;width:${bw}px;height:${Math.max(1, v * sc)}px;bottom:${HH - Y0}px">${parts}</div>`;
            /* v592 : la barre garde la couleur de la charge ; seule la partie au-dessus de la CAPACITÉ est hachurée (rouge, violet si INCOMPRESSIBLE) */
            if (over && pass(di)) hb += `<div class="ghb-ovr${inc ? " ghb-ovr-inc" : ""}" style="left:${X(di) + bo}px;width:${bw}px;height:${Math.max(1, (v - n * rf) * sc)}px;bottom:${HH - Y0 + n * rf * sc}px"></div>`;
          });
          else if (!curve) {
            /* R29 : barres côte à côte dans le jour — CHARGES, PRODUITS, MARGE (signée, sous le zéro si négative) */
            const S = [...(sC ? [[val, CC]] : []), ...(sP ? [[vP, CP]] : []), ...(sG ? [[vG, CG]] : [])], w1 = Math.max(1, bw / (S.length || 1));
            vis.forEach(di => {
              S.forEach(([M, c], j) => { const v = M[di] || 0; if (!v) return; hb += `<div class="ghb ghb-m${pass(di) ? "" : " gh-off"}" data-d="${di}" style="left:${X(di) + bo + j * w1}px;width:${w1}px;top:${Y0 - Math.max(v, 0) * sc}px;bottom:auto;height:${Math.max(1, Math.abs(v) * sc)}px;background:${c === CG && v < 0 ? CGN : c}"></div>`; });
            });
          } else {
            /* R28 : une seule courbe par grandeur (le total), plus une par charge */
            const pt = (di, v) => `${X(di) + DLY_DW / 2},${Y0 - v * sc}`;
            /* v562 : courbe continue — grise sur toute la durée, puis en couleur seulement sur les jours retenus (plage DÉBUT – FIN, MIN – MAX) ;
               plus de voile blanc jour par jour (rayures quand la largeur d'un jour n'est pas entière) */
            const runs = []; { let cur = []; vis.forEach(di => { if (pass(di)) cur.push(di); else { if (cur.length) runs.push(cur); cur = []; } }); if (cur.length) runs.push(cur); }
            /* v605 : commandes cumulées = escalier, une marche à chaque envoi */
            const stepPts = (L, M) => L.map((di, i) => (i ? `${X(di) + DLY_DW / 2},${Y0 - (M[L[i - 1]] || 0) * sc} ` : "") + pt(di, M[di] || 0)).join(" ");
            const poly = (L, M, c) => `<polyline points="${C && cum ? stepPts(L, M) : L.map(di => pt(di, M[di] || 0)).join(" ")}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
            /* v587 : la couleur s'arrête exactement aux traits DÉBUT et FIN (gris à l'extérieur seulement) */
            const cxa = RG.a ? X(RG.a) : 0, cxb = RG.b ? X(RG.b) + DLY_DW : W, part = !!(RG.a || RG.b);
            if (part) svg += `<defs><clipPath id="ghRgClip"><rect x="${cxa}" y="-10" width="${Math.max(0, cxb - cxa)}" height="${HH + 20}"/></clipPath></defs>`;
            const clip = h => part ? `<g clip-path="url(#ghRgClip)">${h}</g>` : h;
            /* v611 (point 4) : hors de la plage, plus de courbe grise — seule la partie retenue est tracée */
            const line = (M, c) => clip(poly(vis, M, c));
            /* v587 : CHARGES toujours en orange, quel que soit le réglage */
            if (!multi || sC) svg += line(val, CC);
            if (sP) svg += line(vP, CP);
            if (sG) { svg += line(vG, CG);
              /* marge négative : en rouge */
              let ng = []; const fl = () => { if (ng.length > 1) svg += clip(`<polyline points="${ng.map(di => pt(di, vG[di] || 0)).join(" ")}" fill="none" stroke="${CGN}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`); ng = []; };
              vis.forEach((di, i) => { if ((vG[di] || 0) < 0) { if (!ng.length && i) ng.push(vis[i - 1]); ng.push(di); } else { if (ng.length) { ng.push(di); fl(); } } }); fl(); }
            vis.forEach(di => { hb += `<div class="ghb ghb-hit" data-d="${di}" style="left:${X(di)}px;width:${DLY_DW}px;height:${HH}px;bottom:0"></div>`; });
          }
          /* v569 (remarque 13) : RENDEMENT par charge — quantité produite de l'activité (vert) et une courbe pointillée par charge cochée
             (sa couleur, sa propre échelle, valeur maximale affichée) */
          const RD = !C && !multi && HD.rd && HD.rd.ser ? HD.rd : null, rdPQ = {}, rdS = []; let rdBar = false;
          if (RD) {
            const cuM = M => cum ? cumOf(di => M[di] || 0) : M;
            const PQ = cuM(RD.L); vis.forEach(di => { rdPQ[di] = PQ[di] || 0; });
            const lab = (v, s, c, di) => di ? `<div class="grd-mx" style="left:${X(di) + DLY_DW / 2}px;top:${Math.max(2, Y0 - v * s - 18)}px;--c:${c}">${fmtA(v)}</div>` : "";
            const showP = crb.includes("p"), nB = RD.ser.length + (showP ? 1 : 0), w1 = Math.max(1, bw / (nB || 1));
            /* v571 : barres côte à côte dans le jour (HISTOGRAMME) ou courbes (COURBES), chacune à sa propre échelle */
            const barS = (M, s, c, j) => vis.forEach(di => { const v = M[di]; if (!v) return; hb += `<div class="ghb ghb-m${pass(di) ? "" : " gh-off"}" data-d="${di}" style="left:${X(di) + bo + j * w1}px;width:${w1}px;top:${Y0 - v * s}px;bottom:auto;height:${Math.max(1, v * s)}px;background:${c}"></div>`; });
            if (showP) {
              const mP = Math.max(1e-9, ...vis.map(di => rdPQ[di])), sP2 = (HH - 44 - IB) / (mP * 1.08) * YZ;   /* v601 : le zoom vertical agit aussi sur le RENDEMENT */ rdPQ.__s = sP2;
              if (curve) svg += `<polyline points="${vis.map(di => `${X(di) + DLY_DW / 2},${Y0 - rdPQ[di] * sP2}`).join(" ")}" fill="none" stroke="#2e90fa" stroke-width="2" stroke-linejoin="round"/>`;
              else barS(rdPQ, sP2, "#2e90fa", 0);
              hb += lab(mP, sP2, "#2e90fa", vis.find(di => rdPQ[di] === mP));
            }
            RD.ser.forEach((S, j0) => { const j = j0;
              const c = colOf(S.sk, j), P2 = cuM(S.P), C2 = cuM(S.C), Rr = {};
              vis.forEach(di => { const cq = C2[di] || 0; Rr[di] = cq > 1e-9 ? (P2[di] || 0) / cq : null; });
              const mR = Math.max(1e-9, ...vis.map(di => Rr[di] || 0)), sR2 = (HH - 44 - IB) / (mR * 1.08) * YZ;
              let seg = [];
              const flush = () => { if (seg.length) svg += `<polyline points="${(seg.length > 1 ? seg : [seg[0], seg[0]]).map(di => `${X(di) + DLY_DW / 2},${Y0 - Rr[di] * sR2}`).join(" ")}" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`; seg = []; };
              if (curve) { vis.forEach(di => { if (Rr[di] === null) flush(); else seg.push(di); }); flush(); }
              else barS(Rr, sR2, c, j + (showP ? 1 : 0));
              hb += lab(mR, sR2, c, vis.find(di => Rr[di] === mR));
              rdS.push({ name: S.sk.split("|")[0], u: S.sk.split("|")[1], c, R: Rr, s: sR2 });
              /* v604 (remarque longue 4) : barre RENDEMENT de la 1re charge de main-d'œuvre — en % (toute la charge) ou en VALEUR (cette activité),
                 bornes MIN / MAX en pointillés, coupes « / » comme la CAPACITÉ */
              if (!rdBar && /\|J-H$/.test(S.sk)) {
                rdBar = true;
                const sP0 = Object.values(S.P).reduce((t, x) => t + (x || 0), 0), sC0 = Object.values(S.C).reduce((t, x) => t + (x || 0), 0), ref = sC0 > 1e-9 ? sP0 / sC0 : 0;
                if (ref > 0) {
                  const byV = hs.rdu === "v", sec = byV ? RD.sec : "", src = byV ? dlyRdSrc(S.sk, RD.sec) : dlyRdSt(S.sk, "", false), segs = dlyRdSegs(src), Lm = dlyRdLim();
                  const yP = p => Math.max(26, Math.min(HH - IB, Y0 - ref * p / 100 * sR2)), labP = p => byV ? fmtV(ref * p / 100) + " " + RD.u + " / J-H" : p + " %";
                  [["MIN", Lm.min], ["MAX", Lm.max]].forEach(([t, p]) => { hb += `<div class="grdm" style="top:${yP(p)}px"><span>${t} ${esc(labP(p))}</span></div>`; });
                  segs.forEach((g2, j) => {
                    const l = g2.d ? Math.max(0, X(g2.d)) : 0, nx = segs[j + 1], r = nx ? Math.min(W, X(nx.d)) : W, y = yP(g2.n);
                    if (r <= l) return;
                    hb += `<div class="grdb" data-sk="${esc(S.sk)}" data-sec="${esc(sec)}" data-seg="${g2.i}" data-ref="${ref}" data-s="${sR2}" data-pct="${g2.n}" style="top:${y}px;left:${l}px;width:${r - l}px;--c:${c}"><span class="grdb-v">${g2.d && j ? dFr(g2.d).slice(0, 5) + " : " : ""}RENDEMENT ${esc(labP(g2.n))}${g2.n > 100 ? " — HEURES SUP " + fmtV((g2.n - 100) / 100 * 8) + " H / J" : ""}</span></div>`
                      /* v608 (remarque 83) : « / » de la coupe à la couleur de la droite ; trait vertical en pointillés à la coupe,
                         qui relie le morceau d'avant, celui d'après et les bornes MIN / MAX */
                      + (j && g2.d ? (() => { const yp = yP(segs[j - 1].n), t = Math.min(yp, y, yP(Lm.max)), b = Math.max(yp, y, yP(Lm.min));
                          return `<div class="grdj" style="left:${l}px;top:${t}px;height:${b - t}px;--c:${c}"></div>`; })()
                        + `<span class="grdc" data-sk="${esc(S.sk)}" data-sec="${esc(sec)}" data-i="${g2.i}" style="left:${l - 7}px;top:${y - 10}px;--c:${c}" role="button" title="SUPPRIMER LA COUPE">/</span>` : "");
                  });
                }
              }
            });
          }
          host.__HV = { cPG, hsup, cum, curve, hideC, multi, val, vP, vG, mgP, unit: mgP ? "%" : HD.unit, rd: RD ? { PQ: rdPQ, PQs: rdPQ.__s || 0, S: rdS, u: RD.u } : null };
          const late = INS.dbut && dlyEnd(dlyCurDates()) > INS.dbut;
          const legI = (c, t) => `<span><b style="background:${c}"></b>${esc(t)}</span>`;
          const legRd = HD.rd ? (HD.rd.ser ? (crb.includes("p") ? legI("#2e90fa", "PRODUIT — " + lkName("sec", HD.rd.sec) + " (" + HD.rd.u + ")") : "") + rdS.map(s => legI(s.c, "RENDEMENT " + s.name + " (" + HD.rd.u + " / " + s.u + ")")).join("")
              + (HD.rd.miss || []).map(sk => `<span class="grd-miss">${esc(sk.split("|")[0])} — PAS DANS CETTE ACTIVITÉ</span>`).join("") : `<span class="grd-why">${esc(HD.rd.why)}</span>`) : "";
          const leg0 = C ? (cPG ? `<div class="ghist-leg">${legI(CC, "COMMANDES") + (sP ? legI(CP, "PRODUITS DE LA PÉRIODE") : "") + (sG ? legI(CG, "MARGE DE LA PÉRIODE") : "")}</div>` : "") : multi ? `<div class="ghist-leg">${(sC ? legI(CC, "CHARGES") : "") + (sP ? legI(CP, "PRODUITS") : "") + (sG ? legI(CG, "MARGE") : "")}</div>`
            : cum ? (ks.length > 1 ? `<div class="ghist-leg">${legI("#f79009", "TOTAL DES " + ks.length + " CHARGES")}</div>` : "")
            : ks.length > 1 ? `<div class="ghist-leg">${totS.filter(x => keep.has(x[0])).map(([sk]) => legI(col[sk], sk.split("|")[0])).join("")}${totS.some(x => !keep.has(x[0])) ? legI("#7f5539", "AUTRES (" + totS.filter(x => !keep.has(x[0])).length + ")") : ""}</div>` : "";
          const leg = legRd ? (hideC ? `<div class="ghist-leg">${legRd}</div>` : leg0 ? leg0.replace(/<\/div>$/, legRd + "</div>") : `<div class="ghist-leg">${legI(cum ? "#f79009" : "#f79009", "CHARGES (" + HD.unit + ")")}${legRd}</div>`) : leg0;
          /* R21 à R23 : CAPACITÉ ; v546 : « / » traversé par la barre, trait vertical en pointillés entre deux morceaux, valeur du morceau au-dessus (R19, R20) */
          /* v601 : la barre CAPACITÉ reste toujours visible et attrapable, même zoomée (collée au bord haut ou bas du graphique) */
          const yOf = n => n < 0 ? HH - IB / 2 : Math.max(26, Math.min(HH - IB, Y0 - n * sc));
          const pl = SG.map((g2, j) => {
            const l = g2.d ? Math.max(0, X(g2.d)) : 0, r = SG[j + 1] ? Math.max(0, X(SG[j + 1].d)) : W;
            if (r <= l) return "";
            const n = g2.n, y = yOf(n), cls = (n < 0 ? " gcap-inf" : n === 0 ? " gcap-zero" : "") + (g2.def ? " gcap-def" : "");
            const lab = n < 0 ? "ILLIMITÉ" : n === 0 ? "CAPACITÉ 0 — PÉNURIE" : "CAPACITÉ " + fmtA(n);
            const sum = days.filter(di => di >= (g2.d || "") && (!SG[j + 1] || di < SG[j + 1].d) && pass(di)).reduce((t, di) => t + (val[di] || 0), 0);
            const prev = j ? SG[j - 1] : null, py = prev ? yOf(prev.n) : y;
            return `<div class="gplaf${cls}" data-seg="${g2.i}" style="top:${y}px;left:${l}px;right:auto;width:${r - l}px"><span class="gplaf-v">${g2.d && j ? dFr(g2.d) + " : " : ""}${lab}</span>${!j && late ? `<span class="gplaf-w">${DLY_BUT_MSG}</span>` : ""}</div>`
              /* v651 (FORMAT 245) : total du morceau 2 px au-dessus de son trait CAPACITÉ (v652 : 2 px ; seulement les jours retenus, plage DÉBUT – FIN comprise) */
              + (sum ? `<div class="gseg-v" style="left:${(l + Math.min(r, W)) / 2}px;top:${Math.max(16, y - 2)}px">${fmtA(sum)} ${esc(HD.unit)}</div>` : "")
              + (j && g2.d && Math.abs(py - y) > 1 ? `<div class="gcut-v" style="left:${l}px;top:${Math.min(py, y)}px;height:${Math.abs(py - y)}px"></div>` : "")
              + (j && g2.d ? `<span class="gcut" data-i="${g2.i}" data-eq="${prev && prev.n === n ? 1 : 0}" style="left:${l - 7}px;top:${y - 10}px" role="button" title="SUPPRIMER LA COUPE (APPUI LONG : DÉPLACER)">/</span>` : "");
          }).join("");
          /* v651 (FORMAT 245) : capacité coupée = total de tous les morceaux, centré sous la poignée « = » (posé par dlyFoot) */
          { const segs = SG.filter((g2, j) => { const l = g2.d ? Math.max(0, X(g2.d)) : 0, r = SG[j + 1] ? Math.max(0, X(SG[j + 1].d)) : W; return r > l; });
            const tot = segs.length > 1 ? days.filter(pass).reduce((t, di) => t + (val[di] || 0), 0) : 0;
            host.__capTot = tot ? "TOTAL " + fmtA(tot) + " " + HD.unit : ""; }
          /* R19 : traits DÉBUT et FIN ; total de la plage seulement quand une plage est posée */
          const xa = RG.a ? X(RG.a) : 0, xb = RG.b ? X(RG.b) + DLY_DW : W - 2;   /* v559 : FIN au bord droit, sans déborder */
          const sum = days.filter(di => inR(di) && pass(di)).reduce((t, di) => t + (C ? C.L[di] : gC(di)), 0);
          /* v563 (remarque 3) : total de la plage pour chaque courbe affichée (CHARGES, PRODUITS, MARGE), pas seulement les charges */
          const sumOf = g => days.filter(di => inR(di) && pass(di)).reduce((t, di) => t + g(di), 0);
          const sumTxt = cPG && !cum ? ["COMMANDES " + fmtA(sum)].concat(sP ? ["PRODUITS " + fmtA(sumOf(di => C.P[di] || 0))] : [], sG ? ["MARGE " + fmtA(sumOf(di => C.G[di] || 0))] : []).join(" · ") + " DH"
            : C || !multi ? fmtA(sum) + " " + esc(HD.unit)
            : mgP ? (() => { const p = sumOf(gP); return "MARGE " + (Math.abs(p) > 1e-9 ? fmtA(sumOf(gG) / p * 100) + " %" : "—"); })()
            : [...(sC ? [["CHARGES", gC]] : []), ...(sP ? [["PRODUITS", gP]] : []), ...(sG ? [["MARGE", gG]] : [])].map(([l, g]) => l + " " + fmtA(sumOf(g)) + " DH").join(" · ");
          const rng = `<div class="grng${RG.a ? "" : " grng-off"}" data-r="a" style="left:${xa}px"><span>DÉBUT${RG.a ? " " + dFr(RG.a).slice(0, 5) : ""}</span></div>`
            + `<div class="grng${RG.b ? "" : " grng-off"}" data-r="b" style="left:${xb}px"><span>FIN${RG.b ? " " + dFr(RG.b).slice(0, 5) : ""}</span></div>`
            /* v652 : total des charges déjà écrit sur la CAPACITÉ (morceaux, TOTAL) = pas de second total en haut */
            + ((RG.a || RG.b || VL.min !== null || VL.max !== null) && !(!cPG && (C || !multi) && pl.includes("gseg-v")) ? `<div class="grng-tot" style="left:${(xa + xb) / 2}px">${sumTxt}</div>` : "");
          /* v568 (remarque 12) : plus de lignes MIN / MAX (filtre) — une RÈGLE horizontale pour comparer à l'œil : sa valeur seule,
             tirée au doigt, affichée / cachée en touchant l'axe des montants ; au départ au niveau de la plus grande valeur */
          const rv = shell.__dlyRuleV !== undefined && shell.__dlyRuleV !== null ? shell.__dlyRuleV : mx;
          const vals = shell.__dlyRule ? `<div class="gval grule" style="top:${Y0 - rv * sc}px"><span>${fmtA(rv)}</span></div>` : "";
          /* échelle (R24) : unité en tête, nombres abrégés, toujours visible à gauche */
          const stp = (() => { const raw = top / 4, p = Math.pow(10, Math.floor(Math.log10(raw || 1))), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; })();
          let ax = "";
          if (HH >= 50) { for (let v = stp; Y0 - v * sc >= 18; v += stp) if (Y0 - v * sc <= HH - 6) ax += `<span class="gax-t" style="top:${Y0 - v * sc}px">${fmtA(v)}</span>`; for (let v = -stp; Y0 - v * sc <= HH - 6; v -= stp) ax += `<span class="gax-t" style="top:${Y0 - v * sc}px">${fmtA(v)}</span>`; }
          ax = `<div class="ghist-ax" style="height:${HH}px"><span class="gax-hit${shell.__dlyRule ? " on" : ""}" style="top:26px;height:${Math.max(0, HH - 26)}px" role="button" aria-label="Règle"></span><span class="gax-u">${esc((mgP ? "MARGE EN %" + (cum ? " (CUMULÉE)" : " / JOUR") : dlyHistLab(HD)))}</span>${ax}${Y0 <= HH ? `<span class="gax-t gax-0" style="top:${Y0}px">0</span>` : ""}</div>${Y0 <= HH ? `<div class="gzero" style="top:${Y0}px;width:${W}px"></div>` : ""}`;
          hist = `<div class="ghist${YZ > 1.01 ? " ghist-zoom" : ""}${C ? " ghist-cmd" : ""}${curve || hideC ? " ghist-cum" : ""}" style="width:${W}px;height:${HH}px" data-sc="${sc}" data-y0="${Y0}" data-stp="${stp}" data-ib="${IB}" data-top="${top}">${ax}${bg}${vline(today, "gv-today", "")}${vline(INS.dbut, "gv-but", "BUTOIR")}${leg}${C ? `<div class="ghist-leg"><span>${esc(C.lab)}</span></div>` : ""}${IB ? `<div class="ghist-inf" style="height:${IB}px"></div>` : ""}${hb}${svg ? `<svg class="ghist-svg" width="${W}" height="${HH}">${svg}</svg>` : ""}${pl}${rng}${vals}</div>`;
        }
      }
      return hist;
    };
