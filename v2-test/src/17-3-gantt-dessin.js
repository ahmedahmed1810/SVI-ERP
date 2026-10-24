    const dlyGanttDraw = () => {
      const host = shell.querySelector("#dlyGantt");
      if (!host || host.__drawn) return;
      dlyRhApply(dlyRhGet());
      const tbl = host.parentElement.querySelector(".dlyg-l table");
      const R = shell.__dlyRows || [];
      if (!tbl) return;
      /* onglet pas encore visible (ouverture du budget, ‹ ›) : lignes de hauteur 0 → on attend qu'elles soient affichées,
         sinon toutes les barres tomberaient sur la première ligne */
      if (!tbl.getBoundingClientRect().height) {
        if (!host.__ro && window.ResizeObserver) {
          host.__ro = new ResizeObserver(() => {
            if (!host.isConnected) { host.__ro.disconnect(); host.__ro = null; return; }
            if (!tbl.getBoundingClientRect().height || host.__drawn) return;
            host.__ro.disconnect(); host.__ro = null;
            dlyGanttDraw();
          });
          host.__ro.observe(tbl);
        }
        return;
      }
      host.__drawn = true;
      /* à l'ouverture : le tableau montre LOT, ACTIVITÉ SECONDAIRE… jusqu'à DURÉE (J), puis la poignée et le Gantt
         (réajusté juste après, les colonnes pouvant encore s'élargir à leur intitulé) */
      {
        const fit = () => {
          const o = shell.__dlygW, L = host.isConnected && host.parentElement.querySelector(".dlyg-l");
          /* v444 : largeur calculée une seule fois à l'ouverture, puis gardée — la poignée ne bouge plus quand on glisse une barre */
          if (!L || (dlygMine(o) && (!o.auto || o.fixed))) return;
          const th = [...L.querySelectorAll("thead th")].find(t => /^DURÉE/.test((t.textContent || "").trim()));
          if (!th) return;
          let w = 0;
          for (let k = 0; k < 4; k++) {
            const d = Math.round(th.getBoundingClientRect().right - L.getBoundingClientRect().right);
            if (k && Math.abs(d) <= 1) break;
            w = Math.round(L.getBoundingClientRect().width + d + 1);
            L.style.width = w + "px"; L.style.maxWidth = "none";
          }
          if (w > 60) { shell.__dlygW = { ins: INS, ref: DLYG_REF, w, auto: true }; shell.__dlygPrevW = shell.__dlygPrevW || w; }
        };
        /* v451 : une seule mise à la largeur, avant le premier affichage du planning (pas de saut visible), puis plus jamais */
        fit(); { const o = shell.__dlygW; if (dlygMine(o)) o.fixed = true; }
      }
      /* hauteur du tableau changée ensuite (police, repli, largeur) : le Gantt se redessine */
      if (window.ResizeObserver && !host.__ro2) {
        /* hauteur du tableau ou du bloc (agrandi / réduit) changée : le Gantt se redessine */
        const scr0 = host.closest(".bdg-d-scroll");
        /* v556 : hauteur gardée (capMax), pas la hauteur réelle qui suit le défilement — sinon redessin complet à chaque défilement (iPad figé) */
        const hk = () => tbl.getBoundingClientRect().height + "|" + (scr0 ? (scr0.__capMax || 0) : 0) + "|" + Math.ceil(host.clientWidth / (DLY_DW || 1));
        let h0 = hk();
        host.__ro2 = new ResizeObserver(() => {
          if (!host.isConnected) { host.__ro2.disconnect(); return; }
          const h = hk();
          if (!tbl.getBoundingClientRect().height || h === h0) return;
          h0 = h;
          cancelAnimationFrame(host.__raf);
          host.__raf = requestAnimationFrame(() => { host.__drawn = false; dlyGanttDraw(); });
        });
        host.__ro2.observe(tbl); host.__ro2.observe(host); if (scr0) host.__ro2.observe(scr0);
      }
      const cal = insCal(), tr0 = tbl.getBoundingClientRect();
      let dlyHHpx = dlyHHGet() === "full" ? 300 : dlyHHGet();
      const hasH = !!host.parentElement.querySelector(".dlyg-hh");
      const HD = dlyHistData();
      const thH = tbl.querySelector("thead").getBoundingClientRect().height;
      const trs = [...tbl.querySelectorAll("tbody tr")];
      const geo = trs.map(tr => { const r = tr.getBoundingClientRect(); return { y: r.top - tr0.top - thH, h: r.height }; });
      const rowsH = Math.max(geo.length ? geo[geo.length - 1].y + geo[geo.length - 1].h : 0, 40);
      /* le PLANNING occupe toute la hauteur du bloc (deux lignes vides au moins à la fin) ; tableau et Gantt restent alignés */
      let bodyH = rowsH + 2 * (geo.length ? geo[geo.length - 1].h : 24);
      {
        const gg = host.closest(".dlyg"), scr = gg && gg.closest(".bdg-d-scroll");
        /* v545 (remarque 2), v548 (FORMAT 197) : le bloc du PLANNING prend la hauteur visible de l'écran sous le bandeau et les onglets */
        dlyFitScr(scr);
        if (scr && scr.clientHeight) {
          const sr = scr.getBoundingClientRect(), top = gg.getBoundingClientRect().top - sr.top + scr.scrollTop;
          const addH = gg.nextElementSibling ? gg.nextElementSibling.getBoundingClientRect().height : 0;
          /* v545 (remarque 2) : hauteur VISIBLE du bloc (jamais sous le bas de l'écran) — planning et histogramme y tiennent ensemble */
          /* v550 : sans dépendre du défilement de la page (sinon, en glissant, le graphique grandissait sans fin) */
          const capM = scr.__capMax || scr.clientHeight;
          const visH = Math.max(160, capM);
          /* R12 : histogramme plein écran (à la place du Gantt) ou à la hauteur tirée à la poignée « = » */
          const capH = Math.max(80, Math.floor(capM - top - thH - addH - 8));
          if (dlyHHGet() === "full") dlyHHpx = capH;
          else if (dlyHHpx) dlyHHpx = Math.max(28, Math.min(dlyHHpx, capH));
          const histH = hasH ? dlyHHpx : 0;
          /* les tâches en trop défilent dans le planning, sous l'histogramme gardé en bas de l'écran ; place gardée pour voir les dernières */
          const ovB = 0;
          bodyH = Math.max(bodyH + ovB, Math.floor(visH - top - thH - histH - addH - 10));
        }
        const L = gg && gg.querySelector(".dlyg-l");
        if (L) {
          let f = L.querySelector(".dlyg-fill");
          if (!f) { f = document.createElement("div"); f.className = "dlyg-fill"; tbl.after(f); }
          /* v546 (R21) : le tableau descend jusqu'en bas du bloc (l'histogramme n'est que sous le Gantt) */
          f.style.height = (bodyH - rowsH + (hasH ? dlyHHpx : 0)) + "px";
        }
      }
      const dates = [];
      R.forEach(x => { if (x.deb) dates.push(x.deb); if (x.fin) dates.push(x.fin); });
      if (INS.dbut) dates.push(INS.dbut);
      if (HD && HD.cmd) dates.push(...Object.keys(HD.cmd.L));
      dates.sort();
      const today = sviIsoOf(new Date());
      /* v553 (partie 11, remarque 2) : le calendrier du Gantt (jours, semaines, mois) va seulement du début à la fin du projet :
         JOUR = 3 jours avant et après ; SEMAINE = du lundi de la 1re semaine au dimanche de la dernière ; MOIS = du 1er du 1er mois à la fin du dernier.
         La largeur d'un jour ne descend pas sous celle qui fait remplir la largeur du Gantt (pas de semaines vides au bout). */
      const SC = dlyScale();
      const dA = dates[0] || today, dZ = dates[dates.length - 1] || sviIsoAdd(today, 30);
      const wd = iso => (new Date(iso + "T00:00:00").getDay() + 6) % 7;   /* 0 = lundi */
      const d0 = SC === "s" ? sviIsoAdd(dA, -wd(dA)) : SC === "m" ? dA.slice(0, 8) + "01" : sviIsoAdd(dA, -3);
      const dE = SC === "s" ? sviIsoAdd(dZ, 6 - wd(dZ)) : SC === "m" ? (() => { const y = Number(dZ.slice(0, 4)), m = Number(dZ.slice(5, 7)); return dZ.slice(0, 8) + String(new Date(y, m, 0).getDate()).padStart(2, "0"); })() : sviIsoAdd(dZ, 3);
      const nD = dDiff(d0, dE) + 1;
      DLY_FILL = Math.floor((host.clientWidth || 600) / nD * 1000) / 1000;   /* v559 : non arrondi — FIN pile au bord droit */
      DLY_DW = dlyDwGet();
      host.style.setProperty("--dw", DLY_DW + "px");
      const W = nD * DLY_DW;
      const d1 = sviIsoAdd(d0, nD - 1);
      const X = iso => dDiff(d0, iso) * DLY_DW;
      let head = "", bg = "";
      for (let i = 0; i < nD; i++) {
        const di = sviIsoAdd(d0, i), dd = Number(di.slice(8, 10));
        const mo = Number(di.slice(5, 7)) - 1;
        if (SC === "m") {
          /* MOIS : année en haut, mois en bas */
          if ((dd === 1 && mo === 0) || i === 0) head += `<span class="gh-m" style="left:${i * DLY_DW}px">${di.slice(0, 4)}</span>`;
          if (dd === 1 || i === 0) { const nd = new Date(Number(di.slice(0, 4)), mo + 1, 0).getDate() - dd + 1;
            head += `<span class="gh-d gh-w" style="left:${i * DLY_DW}px;width:${nd * DLY_DW}px">${["JANV.", "FÉVR.", "MARS", "AVR.", "MAI", "JUIN", "JUIL.", "AOÛT", "SEPT.", "OCT.", "NOV.", "DÉC."][mo]}</span>`; }
          continue;
        }
        if (dd === 1 || i === 0) head += `<span class="gh-m" style="left:${i * DLY_DW}px">${SVI_MOIS[mo]} ${di.slice(0, 4)}</span>`;
        if (SC === "s") {
          /* SEMAINE : numéro de semaine (ISO) et date du lundi */
          const dt = new Date(di + "T00:00:00");
          if (dt.getDay() === 1 || i === 0) {
            const t = new Date(dt); t.setDate(t.getDate() + 3 - (t.getDay() + 6) % 7);
            const w1 = new Date(t.getFullYear(), 0, 4), wn = 1 + Math.round(((t - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7);
            head += `<span class="gh-d gh-w" style="left:${i * DLY_DW}px;width:${7 * DLY_DW}px">S${wn}${7 * DLY_DW >= 56 ? " " + di.slice(8, 10) + "/" + di.slice(5, 7) : ""}</span>`;
          }
          continue;
        }
        const off = !sviWork(cal, di);
        head += `<span class="gh-d${off ? " off" : ""}" style="left:${i * DLY_DW}px">${dd}</span>`;
        if (off) bg += `<div class="gbg-off" style="left:${i * DLY_DW}px"></div>`;
      }
      const vline = (iso, cls, lab) => iso && iso >= d0 && iso <= d1 ? `<div class="gv ${cls}" style="left:${X(iso) + DLY_DW}px" title="${lab}"><span>${lab}</span></div>` : "";
      let bars = "";
      const pos = {};
      R.forEach((x, i) => {
        const g = geo[i];
        if (!g) return;
        const BH = dlyBh(dlyRhGet()), y = g.y + Math.max(2, (g.h - BH) / 2), ty = y + (BH - 15) / 2;
        if (x.grp) {
          const segs = [];
          x.all.filter(t => t.deb && t.fin).map(t => [t.deb, t.fin, t.lo]).sort((a, b) => a[0].localeCompare(b[0])).forEach(([a, b, lo]) => {
            const s = segs[segs.length - 1];
            if (s && a <= sviIsoAdd(s.b, 1)) { if (b > s.b) s.b = b; if (s.lo !== lo) s.lo = ""; }
            else segs.push({ a, b, lo });
          });
          /* FORMAT 93 : signe › / ⌄ devant le nom du lot (ou du niveau) ; un toucher = replier / déplier */
          /* signe à gauche de la barre du lot, nom à droite ; les deux se touchent pour replier / déplier */
          const gname = (l, r) => `<span class="gb-n gb-out gb-fold gb-fsg" data-path="${esc(x.path)}" style="left:${Math.max(0, l - 17)}px;top:${ty}px">${x.fold ? "›" : "⌄"}</span>`
            /* nom court (sans le parent) ; un lot rangé dans un autre est décalé et marqué ↳ selon son niveau (comme le bloc LOT) */
            + (() => {
              /* v443 : nom du lot dans sa barre quand il y tient en entier (comme les tâches), sinon juste à droite */
              const LB = x.lab || lotLab(dlyLotPath(x.path)), bw = r - 5 - l, need = dlyTxtW(LB.full) + (x.lvl ? 14 : 0) + 16, inb = l > 0 && bw >= need;
              return `<span class="gb-n gb-out gb-grp gb-ren${inb ? " gb-gin" : ""}${x.fold ? " gb-gfd" : ""}" data-path="${esc(x.path)}" style="left:${inb ? l + 4 : r + x.lvl * 14}px;top:${ty}px;--c:${gcolOf()}">${x.lvl ? '<span class="gb-lv">↳</span>' : ""}${lotNoHTML(LB)}${esc(LB.name)}</span>`.replace(x.fold ? `top:${ty}px;--c` : "@@", `top:${y}px;height:${BH}px;line-height:${BH}px;font-size:${Math.max(8, Math.min(11, BH - 2))}px;--c`);
            })();
          const gcolOf = () => dlyLotColor((x.all.find(t => t.lo) || {}).lo);
          if (!segs.length) { bars += gname(17, 20); return; }
          const a0 = segs[0].a, b0 = segs[segs.length - 1].b;
          /* couleur d'un lot (FORMAT 91, 93) : celle de son lot, ou de son premier lot pour un niveau qui en regroupe plusieurs */
          const gcol = dlyLotColor((x.all.find(t => t.lo) || {}).lo);
          if (x.fold) {
            /* lot replié (FORMAT 92) : parties travaillées dans la couleur du lot, creux en blanc, trait fin en pointillé */
            bars += `<div class="gdot" data-path="${esc(x.path)}" style="left:${X(a0)}px;width:${X(b0) - X(a0) + DLY_DW}px;top:${y + BH / 2 - 0.5}px"></div>`;
            segs.forEach(s => { bars += `<div class="gseg" data-path="${esc(x.path)}" style="left:${X(s.a)}px;width:${X(s.b) - X(s.a) + DLY_DW - 1}px;top:${y}px;background:${s.lo ? dlyLotColor(s.lo) : gcol}"></div>`; });
            bars += gname(X(a0), X(b0) + DLY_DW + 5);
          } else bars += `<div class="gsum" data-path="${esc(x.path)}" style="left:${X(a0)}px;width:${X(b0) - X(a0) + DLY_DW - 1}px;top:${y + (BH - 6) / 2 - 0.5}px;--c:${gcol}"></div>`
            + gname(X(a0), X(b0) + DLY_DW + 5);
          return;
        }
        /* v546 (R14) : tâche sans ouvriers ni délai (DÉBUT = FIN, ni main-d'œuvre, ni durée fixée) = 0 jour, comme une tâche sans dates */
        const z0 = x.deb && x.fin && x.deb === x.fin && !x.hs && !x.he && !dlyInc(x.key) && dlyNoLab(x.key);
        if (!x.deb || !x.fin || z0) {
          /* R15 : tâche sans dates complètes = 0 jour — repère fin et gris à sa date (seul DÉBUT, seule FIN, ou date exigée par ses liaisons) ;
             la glisser vers la droite lui donne une durée */
          const at = x.deb || x.fin || dlyPredFin(x.key);
          if (!at || x.ext) return;
          const left = X(at) + (!x.deb && x.fin ? DLY_DW : 0);
          pos[x.key] = { l: left, r: left, y: y + BH / 2 };
          bars += `<div class="gb gb0${x.off ? " gb-off" : ""}" data-key="${esc(x.key)}" data-at="${esc(at)}" style="left:${left - 1}px;top:${y}px"><span class="gb-e"></span></div>`
            + `<span class="gb-n gb-out gb-ren gb0n" data-key="${esc(x.key)}" style="left:${left + 6}px;top:${ty}px">${esc(x.sec)}</span>`;
          return;
        }
        /* v547 (R22) : tâche en plusieurs morceaux — une barre par morceau, reliées par un trait fin en pointillé ;
           glisser un morceau = déplacer toute la tâche ; le bout du dernier morceau = sa FIN */
        if (x.per && x.per.length > 1) {
          const col = dlyLotColor(x.lo), P = x.per, last = P[P.length - 1];
          const L0 = X(P[0].deb) + (P[0].hs ? DLY_DW / 2 : 0), R0 = X(last.fin) + DLY_DW - 1 - (last.he ? DLY_DW / 2 : 0);
          pos[x.key] = { l: L0, r: R0, y: y + BH / 2 };
          bars += `<div class="gpc" style="left:${L0}px;width:${Math.max(0, R0 - L0)}px;top:${y + BH / 2 - 0.5}px;--c:${col}"></div>`;
          P.forEach((q, j) => {
            const l = X(q.deb) + (q.hs ? DLY_DW / 2 : 0), w = Math.max(3, X(q.fin) - X(q.deb) + DLY_DW - 1 - (q.hs ? DLY_DW / 2 : 0) - (q.he ? DLY_DW / 2 : 0));
            bars += `<div class="gb gb-pc${x.off ? " gb-off" : ""}${x.marge === 0 ? " crit" : ""}${w < 30 ? " gb-nar" : ""}" data-key="${esc(x.key)}" data-pc="${j}" style="left:${l}px;width:${w}px;top:${y}px;--c:${col}">${j === 0 ? '<span class="gb-s"></span>' : ""}${j === P.length - 1 ? '<span class="gb-e"></span>' : ""}</div>`;
          });
          bars += `<span class="gb-n gb-out gb-ren${x.off ? " gb-offn" : ""}" data-key="${esc(x.key)}" style="left:${R0 + 5}px;top:${ty}px">${dlyIncHTML(x.key)}${esc(x.sec)} <span class="gpc-n">${P.length} MORCEAUX</span>${x.jal ? ' <span class="gjal">★</span>' : ""}${dlyLimHTML(x.key)}</span>`;
          return;
        }
        /* v530 : demi-journée de début ou de fin = demi-case */
        const left = X(x.deb) + (x.hs ? DLY_DW / 2 : 0), w = Math.max(3, X(x.fin) - X(x.deb) + DLY_DW - 1 - (x.hs ? DLY_DW / 2 : 0) - (x.he ? DLY_DW / 2 : 0)), col = dlyLotColor(x.lo);
        const crit = x.marge === 0;
        const nm = esc(x.sec);
        /* FORMAT 91 : barre fine et arrondie, nom juste à droite */
        pos[x.key] = { l: left, r: left + w, y: y + BH / 2 };
        /* FORMAT 91 : nom dans la barre quand il y tient en entier, sinon juste à droite */
        const inside = dlyTxtW(x.sec) + 12 <= w;
        bars += `<div class="gb${x.ext ? " gb-ext" : ""}${x.off ? " gb-off" : ""}${crit ? " crit" : ""}${inside ? " gb-tin" : ""}${w < 30 ? " gb-nar" : ""}" data-key="${esc(x.key)}" style="left:${left}px;width:${w}px;top:${y}px;--c:${col}">`
          + (inside ? `<span class="gb-ti">${dlyInc(x.key) ? '<span class="gb-inc">▣ </span>' : ""}${nm}</span>` : "")
          + `<span class="gb-s"></span><span class="gb-e"></span></div>`
          + (inside ? (x.jal || qqArret(x.key) || dlyLimHTML(x.key) ? `<span class="gb-n gb-out" style="left:${left + w + 5}px;top:${ty}px">${x.jal ? '<span class="gjal">★</span>' : ""}${qqArret(x.key) ? '<span class="garr">■</span>' : ""}${dlyLimHTML(x.key)}</span>` : "")
            : `<span class="gb-n gb-out${x.ext ? " gb-extn" : " gb-ren"}${x.off ? " gb-offn" : ""}" data-key="${esc(x.key)}" style="left:${left + w + 5}px;top:${ty}px">${x.ext ? esc(lotLab(dlyLotPath(x.lot)).full) + " › " : ""}${dlyInc(x.key) ? '<span class="gb-inc">▣ </span>' : ""}${nm}${x.jal ? ' <span class="gjal">★</span>' : ""}${qqArret(x.key) ? ' <span class="garr">■</span>' : ""}${dlyLimHTML(x.key)}</span>`);
      });
      /* liaisons : fils fléchés (FIN → DÉBUT depuis la fin, DÉBUT → DÉBUT depuis le début) ; toucher le fil = fenêtre LIAISON */
      let lk = "";
      R.forEach(x => {
        if (x.grp || !pos[x.key]) return;
        dlyLinks(x.key).forEach(l => {
          const a = pos[l.k], b = pos[x.key];
          if (!a) return;
          const x2 = b.l, y2 = b.y;
          let dpath;
          if (l.t === "DD") { const x1 = a.l, mx = Math.min(x1, x2) - 8; dpath = `M${x1} ${a.y} H${mx} V${y2} H${x2 - 1}`; }
          else {
            const x1 = a.r;
            dpath = x2 - 8 >= x1 + 6 ? `M${x1} ${a.y} H${x1 + 6} V${y2} H${x2 - 1}` : `M${x1} ${a.y} H${x1 + 6} V${(a.y + y2) / 2} H${x2 - 10} V${y2} H${x2 - 1}`;
          }
          lk += `<path class="gl${x.off || (R.find(r => !r.grp && r.key === l.k) || {}).off ? " gl-off" : ""}" d="${dpath}" marker-end="url(#gArr)"/><path class="gl-hit" data-p="${esc(l.k)}" data-s="${esc(x.key)}" d="${dpath}"/>`;
        });
      });
      /* histogramme des charges cochées (R9, R11, R14 ; v543 : R17 à R21) : une couleur par charge ; jour par jour (barres) ou cumulé (courbe) ;
         plage DÉBUT – FIN (R19), filtre MIN – MAX (R20), barre CAPACITÉ (R21 à R23), commandes prévisionnelles (R17) */
      let hist = "";
      {
        const HH = dlyHHpx;
        if (!HH) hist = "";
        else if (!HD) hist = `<div class="ghist ghist-empty" style="width:${W}px;height:${HH}px"><div class="ghist-msg">SÉLECTIONNER DES CHARGES</div></div>`;
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
          const days = [...new Set(Object.keys(C ? C.L : HD.tot).concat(multi ? Object.keys(HD.prd || {}) : []))].sort();
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
          const vis = days.filter(di => di >= d0 && di <= d1);
          const shown = di => [...(multi ? [] : [val[di]]), ...(multi && sC ? [val[di]] : []), ...(sP ? [vP[di]] : []), ...(sG ? [vG[di]] : [])];
          const mx = Math.max(0, ...vis.flatMap(di => shown(di)).filter(v => v !== undefined));
          const mn = Math.min(0, ...vis.flatMap(di => shown(di)).filter(v => v !== undefined));
          const SG = canP ? dlyCapSegs() : [];
          /* v545 (remarque 5) : capacité jamais réglée = barre rouge posée juste au-dessus du jour le plus chargé, avec son nombre */
          const capDef = canP && SG.length === 1 && dlyCapDef(), mxAll = Math.max(0, ...days.map(di => val[di] || 0));
          if (capDef) SG[0] = { ...SG[0], n: Math.max(1, Math.ceil(mxAll - 1e-9)), def: true };
          const PM = Math.max(0, ...SG.map(x => x.n));
          const top = ((Math.max(mx, PM, VL.max || 0) - mn) || 1) * 1.08, sc = (HH - 36 - IB) / top, Y0 = HH - IB - (-mn) * sc;
          const pass = di => inR(di) && (multi || ((VL.min === null || val[di] >= VL.min - 1e-9) && (VL.max === null || val[di] <= VL.max + 1e-9)));
          const bw = Math.max(1, DLY_DW - (DLY_DW > 10 ? 6 : 0)), bo = DLY_DW > 10 ? 3 : 0;
          const capAt = di => { let n = -1; SG.forEach(x => { if (!x.def && (!x.d || x.d <= di)) n = x.n; }); return n; };
          /* nombres abrégés (R24) : 5 K, 1,5 M, 1 G */
          const fmtA = v => { const a = Math.abs(v), f = (x, u) => (Math.round(x * 10) / 10).toLocaleString("fr-FR") + " " + u; return a >= 1e9 ? f(v / 1e9, "G") : a >= 1e6 ? f(v / 1e6, "M") : a >= 1e4 ? f(v / 1e3, "K") : (Math.round(v * 100) / 100).toLocaleString("fr-FR"); };
          const fmtV = v => (Math.round(v * 100) / 100).toLocaleString("fr-FR");
          /* légende (R24) : par montant décroissant ; toutes les charges cochées = seulement celles qui font le % réglé, le reste en AUTRES */
          const totS = ks.map((sk, j) => [sk, days.reduce((t, di) => t + (HD.ser.get(sk).L[di] || 0), 0)]).sort((a, b) => b[1] - a[1]);
          const allOn = (INS.chg || []).filter(r => !r.t).every(r => r.on === true);
          const pct = Math.max(1, Math.min(100, Number(hs.pct) || 70)), grand = totS.reduce((t, x) => t + x[1], 0) || 1;
          const keep = new Set(); { let acc = 0; totS.forEach(([sk, v]) => { if (!allOn || acc < grand * pct / 100 - 1e-9) keep.add(sk); acc += v; }); }
          const col = {}; let ci = 0; totS.forEach(([sk]) => { col[sk] = keep.has(sk) ? DLY_SER[ci++ % DLY_SER.length] : "#98a2b3"; });
          const order = totS.map(x => ks.indexOf(x[0]));
          let hb = "", svg = "";
          /* v572 (remarque 16) : couleurs usuelles — PRODUITS en bleu, CHARGES en orange, MARGE en vert (rouge quand elle est négative) */
          const CC = "#f79009", CP = "#2e90fa", CG = "#12b76a", CGN = "#d92d20";
          if (hideC) vis.forEach(di => { hb += `<div class="ghb ghb-hit" data-d="${di}" style="left:${X(di)}px;width:${DLY_DW}px;height:${HH}px;bottom:0"></div>`; });
          else if (C && !curve) vis.forEach(di => { hb += `<div class="ghb ghc${pass(di) ? "" : " gh-off"}" data-d="${di}" style="left:${X(di) + bo}px;width:${bw}px;height:${Math.max(1, val[di] * sc)}px;bottom:${IB}px"></div>`; });
          else if (!curve && !multi) vis.forEach(di => {
            const v = val[di], n = capAt(di), over = !cum && n >= 0 && v > n + 1e-9, inc = over && (HD.det[di] || []).some(x => x.inc);
            const parts = ks.length > 1 && !cum ? order.map(j => { const w = sval[j][di]; return w ? `<i style="height:${w * sc}px;background:${col[ks[j]]}"></i>` : ""; }).join("") : "";
            hb += `<div class="ghb${over ? (inc ? " over-inc" : " over") : ""}${ks.length > 1 && !cum ? " ghb-st" : ""}${pass(di) ? "" : " gh-off"}" data-d="${di}" style="left:${X(di) + bo}px;width:${bw}px;height:${Math.max(1, v * sc)}px;bottom:${HH - Y0}px">${parts}</div>`;
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
            const poly = (L, M, c) => `<polyline points="${L.map(di => pt(di, M[di] || 0)).join(" ")}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
            const line = (M, c) => (runs.length === 1 && runs[0].length === vis.length ? "" : poly(vis, M, "#c0c6d0")) + runs.map(L => poly(L.length > 1 ? L : [L[0], L[0]], M, c)).join("");
            if (!multi || sC) svg += line(val, multi ? CC : "#344054");
            if (sP) svg += line(vP, CP);
            if (sG) { svg += line(vG, CG);
              /* marge négative : en rouge */
              let ng = []; const fl = () => { if (ng.length > 1) svg += `<polyline points="${ng.map(di => pt(di, vG[di] || 0)).join(" ")}" fill="none" stroke="${CGN}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`; ng = []; };
              vis.forEach((di, i) => { if ((vG[di] || 0) < 0 && pass(di)) { if (!ng.length && i) ng.push(vis[i - 1]); ng.push(di); } else { if (ng.length) { ng.push(di); fl(); } } }); fl(); }
            vis.forEach(di => { hb += `<div class="ghb ghb-hit" data-d="${di}" style="left:${X(di)}px;width:${DLY_DW}px;height:${HH}px;bottom:0"></div>`; });
          }
          /* v569 (remarque 13) : RENDEMENT par charge — quantité produite de l'activité (vert) et une courbe pointillée par charge cochée
             (sa couleur, sa propre échelle, valeur maximale affichée) */
          const RD = !C && !multi && HD.rd && HD.rd.ser ? HD.rd : null, rdPQ = {}, rdS = [];
          const RDC = ["#7a5af8", "#f79009", "#ee46bc", "#06aed4", "#a15c07", "#2e90fa", "#b42318", "#667085"];
          if (RD) {
            const cuM = M => cum ? cumOf(di => M[di] || 0) : M;
            const PQ = cuM(RD.L); vis.forEach(di => { rdPQ[di] = PQ[di] || 0; });
            const lab = (v, s, c, di) => di ? `<div class="grd-mx" style="left:${X(di) + DLY_DW / 2}px;top:${Math.max(2, Y0 - v * s - 18)}px;--c:${c}">${fmtA(v)}</div>` : "";
            const showP = crb.includes("p"), nB = RD.ser.length + (showP ? 1 : 0), w1 = Math.max(1, bw / (nB || 1));
            /* v571 : barres côte à côte dans le jour (HISTOGRAMME) ou courbes (COURBES), chacune à sa propre échelle */
            const barS = (M, s, c, j) => vis.forEach(di => { const v = M[di]; if (!v) return; hb += `<div class="ghb ghb-m${pass(di) ? "" : " gh-off"}" data-d="${di}" style="left:${X(di) + bo + j * w1}px;width:${w1}px;top:${Y0 - v * s}px;bottom:auto;height:${Math.max(1, v * s)}px;background:${c}"></div>`; });
            if (showP) {
              const mP = Math.max(1e-9, ...vis.map(di => rdPQ[di])), sP2 = (HH - 36 - IB) / (mP * 1.08);
              if (curve) svg += `<polyline points="${vis.map(di => `${X(di) + DLY_DW / 2},${Y0 - rdPQ[di] * sP2}`).join(" ")}" fill="none" stroke="#12b76a" stroke-width="2" stroke-linejoin="round"/>`;
              else barS(rdPQ, sP2, "#12b76a", 0);
              hb += lab(mP, sP2, "#12b76a", vis.find(di => rdPQ[di] === mP));
            }
            RD.ser.forEach((S, j0) => { const j = j0;
              const c = RDC[j % RDC.length], P2 = cuM(S.P), C2 = cuM(S.C), Rr = {};
              vis.forEach(di => { const cq = C2[di] || 0; Rr[di] = cq > 1e-9 ? (P2[di] || 0) / cq : null; });
              const mR = Math.max(1e-9, ...vis.map(di => Rr[di] || 0)), sR2 = (HH - 36 - IB) / (mR * 1.08);
              let seg = [];
              const flush = () => { if (seg.length) svg += `<polyline points="${(seg.length > 1 ? seg : [seg[0], seg[0]]).map(di => `${X(di) + DLY_DW / 2},${Y0 - Rr[di] * sR2}`).join(" ")}" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`; seg = []; };
              if (curve) { vis.forEach(di => { if (Rr[di] === null) flush(); else seg.push(di); }); flush(); }
              else barS(Rr, sR2, c, j + (showP ? 1 : 0));
              hb += lab(mR, sR2, c, vis.find(di => Rr[di] === mR));
              rdS.push({ name: S.sk.split("|")[0], u: S.sk.split("|")[1], c, R: Rr });
            });
          }
          host.__HV = { cum, curve, hideC, multi, val, vP, vG, unit: HD.unit, rd: RD ? { PQ: rdPQ, S: rdS, u: RD.u } : null };
          const late = INS.dbut && dlyEnd(dlyCurDates()) > INS.dbut;
          const legI = (c, t) => `<span><b style="background:${c}"></b>${esc(t)}</span>`;
          const legRd = HD.rd ? (HD.rd.ser ? (crb.includes("p") ? legI("#12b76a", "PRODUIT — " + lkName("sec", HD.rd.sec) + " (" + HD.rd.u + ")") : "") + rdS.map(s => legI(s.c, "RENDEMENT " + s.name + " (" + HD.rd.u + " / " + s.u + ")")).join("")
              + (HD.rd.miss || []).map(sk => `<span class="grd-miss">${esc(sk.split("|")[0])} — PAS DANS CETTE ACTIVITÉ</span>`).join("") : `<span class="grd-why">${esc(HD.rd.why)}</span>`) : "";
          const leg0 = C ? "" : multi ? `<div class="ghist-leg">${(sC ? legI(CC, "CHARGES") : "") + (sP ? legI(CP, "PRODUITS") : "") + (sG ? legI(CG, "MARGE") : "")}</div>`
            : cum ? (ks.length > 1 ? `<div class="ghist-leg">${legI("#344054", "TOTAL DES " + ks.length + " CHARGES")}</div>` : "")
            : ks.length > 1 ? `<div class="ghist-leg">${totS.filter(x => keep.has(x[0])).map(([sk]) => legI(col[sk], sk.split("|")[0])).join("")}${totS.some(x => !keep.has(x[0])) ? legI("#98a2b3", "AUTRES (" + totS.filter(x => !keep.has(x[0])).length + ")") : ""}</div>` : "";
          const leg = legRd ? (hideC ? `<div class="ghist-leg">${legRd}</div>` : leg0 ? leg0.replace(/<\/div>$/, legRd + "</div>") : `<div class="ghist-leg">${legI(cum ? "#344054" : "#6fa8dc", "CHARGES (" + HD.unit + ")")}${legRd}</div>`) : leg0;
          /* R21 à R23 : CAPACITÉ ; v546 : « / » traversé par la barre, trait vertical en pointillés entre deux morceaux, valeur du morceau au-dessus (R19, R20) */
          const yOf = n => n < 0 ? HH - IB / 2 : Y0 - n * sc;
          const pl = SG.map((g2, j) => {
            const l = g2.d ? Math.max(0, X(g2.d)) : 0, r = SG[j + 1] ? Math.max(0, X(SG[j + 1].d)) : W;
            if (r <= l) return "";
            const n = g2.n, y = yOf(n), cls = (n < 0 ? " gcap-inf" : n === 0 ? " gcap-zero" : "") + (g2.def ? " gcap-def" : "");
            const lab = n < 0 ? "ILLIMITÉ" : n === 0 ? "CAPACITÉ 0 — PÉNURIE" : "CAPACITÉ " + fmtA(n);
            const sum = days.filter(di => di >= (g2.d || "") && (!SG[j + 1] || di < SG[j + 1].d)).reduce((t, di) => t + (val[di] || 0), 0);
            const prev = j ? SG[j - 1] : null, py = prev ? yOf(prev.n) : y;
            return `<div class="gplaf${cls}" data-seg="${g2.i}" style="top:${y}px;left:${l}px;right:auto;width:${r - l}px"><span class="gplaf-v">${g2.d && j ? dFr(g2.d) + " : " : ""}${lab}</span>${!j && late ? `<span class="gplaf-w">${DLY_BUT_MSG}</span>` : ""}</div>`
              + (sum ? `<div class="gseg-v" style="left:${(l + Math.min(r, W)) / 2}px;top:${Math.max(0, Math.min(y, Y0) - 34)}px">${fmtA(sum)} ${esc(HD.unit)}</div>` : "")
              + (j && g2.d && Math.abs(py - y) > 1 ? `<div class="gcut-v" style="left:${l}px;top:${Math.min(py, y)}px;height:${Math.abs(py - y)}px"></div>` : "")
              + (j && g2.d ? `<span class="gcut" data-i="${g2.i}" data-eq="${prev && prev.n === n ? 1 : 0}" style="left:${l - 7}px;top:${y - 10}px" role="button" title="SUPPRIMER LA COUPE (APPUI LONG : DÉPLACER)">/</span>` : "");
          }).join("");
          /* R19 : traits DÉBUT et FIN ; total de la plage seulement quand une plage est posée */
          const xa = RG.a ? X(RG.a) : 0, xb = RG.b ? X(RG.b) + DLY_DW : W - 2;   /* v559 : FIN au bord droit, sans déborder */
          const sum = days.filter(di => inR(di) && pass(di)).reduce((t, di) => t + (C ? C.L[di] : gC(di)), 0);
          /* v563 (remarque 3) : total de la plage pour chaque courbe affichée (CHARGES, PRODUITS, MARGE), pas seulement les charges */
          const sumOf = g => days.filter(di => inR(di) && pass(di)).reduce((t, di) => t + g(di), 0);
          const sumTxt = C || !multi ? fmtA(sum) + " " + esc(HD.unit)
            : [...(sC ? [["CHARGES", gC]] : []), ...(sP ? [["PRODUITS", gP]] : []), ...(sG ? [["MARGE", gG]] : [])].map(([l, g]) => l + " " + fmtA(sumOf(g)) + " DH").join(" · ");
          const rng = `<div class="grng${RG.a ? "" : " grng-off"}" data-r="a" style="left:${xa}px"><span>DÉBUT${RG.a ? " " + dFr(RG.a).slice(0, 5) : ""}</span></div>`
            + `<div class="grng${RG.b ? "" : " grng-off"}" data-r="b" style="left:${xb}px"><span>FIN${RG.b ? " " + dFr(RG.b).slice(0, 5) : ""}</span></div>`
            + (RG.a || RG.b || VL.min !== null || VL.max !== null ? `<div class="grng-tot" style="left:${(xa + xb) / 2}px">${sumTxt}</div>` : "");
          /* R20 : lignes MIN et MAX (filtre par valeur, sur les charges) */
          const vl = (r, v, off) => `<div class="gval${off ? " gval-off" : ""}" data-v="${r}" style="top:${off ? (r === "max" ? 22 : Y0 - 1) : Y0 - v * sc}px"><span>${r.toUpperCase()}${off ? "" : " " + fmtA(v)}</span></div>`;
          /* v568 (remarque 12) : plus de lignes MIN / MAX (filtre) — une RÈGLE horizontale pour comparer à l'œil : sa valeur seule,
             tirée au doigt, affichée / cachée en touchant l'axe des montants ; au départ au niveau de la plus grande valeur */
          const rv = shell.__dlyRuleV !== undefined && shell.__dlyRuleV !== null ? shell.__dlyRuleV : mx;
          const vals = shell.__dlyRule ? `<div class="gval grule" style="top:${Y0 - rv * sc}px"><span>${fmtA(rv)}</span></div>` : "";
          void vl;
          /* échelle (R24) : unité en tête, nombres abrégés, toujours visible à gauche */
          const stp = (() => { const raw = top / 4, p = Math.pow(10, Math.floor(Math.log10(raw || 1))), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; })();
          let ax = "";
          if (HH >= 50) { for (let v = stp; Y0 - v * sc >= 18; v += stp) ax += `<span class="gax-t" style="top:${Y0 - v * sc}px">${fmtA(v)}</span>`; for (let v = -stp; Y0 - v * sc <= HH - 6; v -= stp) ax += `<span class="gax-t" style="top:${Y0 - v * sc}px">${fmtA(v)}</span>`; }
          ax = `<div class="ghist-ax" style="height:${HH}px"><span class="gax-hit${shell.__dlyRule ? " on" : ""}" style="height:${HH}px" role="button" aria-label="Règle"></span><span class="gax-u">${esc(dlyHistLab(HD))}</span>${ax}<span class="gax-t gax-0" style="top:${Y0}px">0</span></div>`;
          hist = `<div class="ghist${C ? " ghist-cmd" : ""}${curve || hideC ? " ghist-cum" : ""}" style="width:${W}px;height:${HH}px" data-sc="${sc}" data-y0="${Y0}" data-ib="${IB}" data-top="${top}">${ax}${bg}${leg}${C ? `<div class="ghist-leg"><span>${esc(C.lab)}</span></div>` : ""}${IB ? `<div class="ghist-inf" style="height:${IB}px"></div>` : ""}${hb}${svg ? `<svg class="ghist-svg" width="${W}" height="${HH}">${svg}</svg>` : ""}${pl}${rng}${vals}</div>`;
        }
      }
      host.innerHTML = `<div class="gh" style="width:${W}px;height:${thH}px">${head}</div>
        <div class="gbody" style="width:${W}px;height:${bodyH}px">${bg}${vline(today, "gv-today", "")}${vline(INS.dbut, "gv-but", "BUTOIR")}
          <svg class="glinks" width="${W}" height="${bodyH}"><defs><marker id="gArr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="#475467"/></marker></defs>${lk}</svg>
          ${bars}${(() => {
            /* v575 (remarque 3) : plage DÉBUT – FIN posée — tout le Gantt (barres des lots comprises) estompé avant DÉBUT et après FIN */
            const R = dlyHRange(); let s = "";
            if (R.a) { const x = Math.max(0, X(R.a)); if (x > 0) s += `<div class="g-rgsh" style="left:0;width:${x}px;height:${bodyH}px"></div>`; }
            if (R.b) { const x = Math.min(W, X(R.b) + DLY_DW); if (x < W) s += `<div class="g-rgsh" style="left:${x}px;width:${W - x}px;height:${bodyH}px"></div>`; }
            return s; })()}<svg class="gtmp" width="${W}" height="${bodyH}"></svg></div>${hist}`;
      host.__X = X; host.__d0 = d0; host.__HD = HD;
      /* R12 : poignée « = » entre le Gantt et l'histogramme, posée à la hauteur du haut de l'histogramme */
      { const hh = host.parentElement.querySelector(".dlyg-hh"); /* v552 (FORMAT 201) : la barre marron horizontale part de la barre marron verticale et va jusqu'au bord droit du cadre */
        if (hh) { const sp = host.parentElement.querySelector(".dlyg-sp"), sc = host.closest(".bdg-d-scroll"); hh.style.left = (sp ? sp.offsetLeft : host.offsetLeft) + "px"; hh.style.right = sc ? -(parseFloat(getComputedStyle(sc).paddingRight) || 0) + "px" : "0px"; } if (hh) hh.style.top = (host.offsetTop + thH + (dlyHHGet() === "full" ? 0 : bodyH) - 7) + "px"; shell.style.setProperty("--dly-hh", dlyHHpx + "px"); }
      try { dlyPickPaint(); } catch (e) {}
      host.parentElement.querySelectorAll("input.dlyp-cb[data-part]").forEach(c => { c.indeterminate = true; });
      /* défilement horizontal du Gantt gardé d'un dessin à l'autre */
      if (shell.__dlyGx !== undefined) host.scrollLeft = shell.__dlyGx;
      host.addEventListener("scroll", () => { shell.__dlyGx = host.scrollLeft; }, { passive: true });
      dlyStick(host.closest(".bdg-d-scroll, .lk-scroll"));
      dlyCfgPaint();
      requestAnimationFrame(dlyRngEdge);
      requestAnimationFrame(() => { try { dlyGhFix(); } catch (e) {} });
      if (!host.__ghFixS) { host.__ghFixS = true; host.addEventListener("scroll", () => { const f = shell.querySelector("#bdgTabBody > .gh-fix > .gh-fix-in"); if (f) f.style.transform = "translateX(" + (-host.scrollLeft) + "px)"; }, { passive: true }); }
      dlyLift();
    };
    /* v545 (remarque 2) : bas de l'écran visible (clavier de l'iPad compris) */
    const dlyVpB = () => { const vv = window.visualViewport; return vv ? vv.offsetTop + vv.height : window.innerHeight; };
    /* v551 (FORMAT 200) : le bloc du PLANNING est un cadre fermé dont le bas tombe au bas de l'écran visible.
       capMax = sa plus grande hauteur (bloc en haut de l'écran, sous le bandeau et les onglets) : sert au dessin, ne dépend pas du défilement ;
       hauteur réelle = du haut du bloc au bas de l'écran (jamais plus que capMax) : suit le défilement de la page, sans redessiner.
       Renvoie 2 si capMax a changé (redessiner), 1 si seule la hauteur a changé, 0 sinon */
    const dlyFitScr = scr => {
      if (!scr || !scr.classList.contains("dly-scroll")) return 0;
      let lim = 0; document.querySelectorAll(".topbar, .bdg-d-sticky").forEach(b => { const r = b.getBoundingClientRect(); if (r.height && /sticky|fixed/.test(getComputedStyle(b).position)) lim = Math.max(lim, r.bottom > 0 ? r.bottom : 0); });
      const tabs = document.getElementById("bdgTabs"), sr = scr.getBoundingClientRect(), vb = dlyVpB();
      const mx = !!scr.closest(".max-detail");
      /* v557 (FORMAT 202) : bloc non agrandi = hauteur commune du bloc détail (poignée du bas), plus la hauteur de l'écran */
      if (!mx) {
        if (scr.style.height) scr.style.removeProperty("height");
        const c = Math.max(160, Math.round(scr.clientHeight));
        if (Math.abs((scr.__capMax || 0) - c) > 1) { scr.__capMax = c; return 2; }
        return 0;
      }
      const top0 = mx ? sr.top + (window.scrollY || 0) : lim + (tabs ? Math.max(0, sr.top - tabs.getBoundingClientRect().top) : 0);
      const cap = Math.max(200, Math.floor(vb - top0 - 2));
      const want = Math.max(160, Math.min(cap, Math.floor(vb - Math.max(sr.top, mx ? 0 : top0) - 2)));
      let r = 0;
      if (Math.abs((scr.__capMax || 0) - cap) > 1) { scr.__capMax = cap; r = 2; }
      if (Math.abs((parseFloat(scr.style.height) || 0) - want) > 1) { scr.style.setProperty("height", want + "px", "important"); r = r || 1; }
      return r;
    };
    /* v558 : ⚙ (réglages du graphique) visible seulement quand l'histogramme est affiché : pas en vue tableau seul, ni graphique caché */
    const dlyCfgPaint = () => {
      const g = shell.querySelector(".blk-cfg-btn"); if (!g) return;
      const host = shell.querySelector("#dlyGantt"), h = host && host.querySelector(".ghist");
      const on = active === "dly" && !!shell.__insDly && !!h && h.offsetHeight > 0 && host.clientWidth > 30 && !shell.querySelector(".dlyg.dly-hnone");
      if (g.classList.contains("dly-on") !== on) g.classList.toggle("dly-on", on);
    };
    /* histogramme (et son libellé, et la poignée « = ») gardé en bas de la zone visible du planning : les tâches défilent dessous */
    /* v573 (remarque 18) : traits DÉBUT / FIN non posés = collés aux bords gauche et droit de la partie visible du Gantt (suivent le défilement) */
    const dlyRngEdge = () => {
      const host = shell.querySelector("#dlyGantt"); if (!host) return;
      const a = host.querySelector('.grng.grng-off[data-r="a"]'), b = host.querySelector('.grng.grng-off[data-r="b"]');
      const L = host.scrollLeft, W = host.clientWidth, full = host.scrollWidth;
      if (a && !a.__drag) { const x = Math.round(L) + "px"; if (a.style.left !== x) a.style.left = x; }
      if (b && !b.__drag) { const x = Math.round(Math.min(full - 2, L + W - 2)) + "px"; if (b.style.left !== x) b.style.left = x; }
    };
    /* v574 (partie 11, remarque 7) : en-tête du calendrier du Gantt parfaitement fixe pendant le défilement des tâches (rebond compris) —
       une copie de l'en-tête posée HORS de la zone qui défile (dans le bloc détail), alignée sur le Gantt, qui ne suit que le défilement
       horizontal ; le vrai en-tête, transparent, reste dessous et reçoit les touchers (calendrier, largeur des jours, pincement) */
    const dlyGhFix = () => {
      const host = shell.querySelector("#dlyGantt"), body = shell.querySelector("#bdgTabBody");
      let fx = body && body.querySelector(":scope > .gh-fix");
      const gh = host && host.querySelector(":scope > .gh"), scr = host && host.closest(".dly-scroll");
      if (!host || !gh || !scr || !body) { if (fx) fx.remove(); return; }
      if (!fx) { fx = document.createElement("div"); fx.className = "gh-fix"; fx.innerHTML = '<div class="gh-fix-in dlyg-r"></div>'; body.appendChild(fx); }
      const inn = fx.firstChild;
      if (gh.__fixSrc !== gh.innerHTML) { gh.__fixSrc = gh.innerHTML; inn.innerHTML = gh.outerHTML; const c = inn.firstChild; c.style.transform = ""; c.classList.remove("sv-stuck"); }
      const br = body.getBoundingClientRect(), hr = host.getBoundingClientRect(), sr = scr.getBoundingClientRect();
      let lim = 0; document.querySelectorAll(".topbar, .bdg-d-sticky").forEach(b => { const r = b.getBoundingClientRect(); if (r.height && /sticky|fixed/.test(getComputedStyle(b).position)) lim = Math.max(lim, r.bottom > 0 ? r.bottom : 0); });
      const top = Math.max(sr.top, Math.min(lim, sr.bottom - gh.offsetHeight)) - br.top;
      const s = fx.style;
      s.top = top + "px"; s.left = (hr.left - br.left) + "px"; s.width = host.clientWidth + "px"; s.height = gh.offsetHeight + "px";
      inn.style.width = gh.offsetWidth + "px";
      { const dw = host.style.getPropertyValue("--dw"); if (fx.style.getPropertyValue("--dw") !== dw) fx.style.setProperty("--dw", dw); }
      inn.style.transform = "translateX(" + (-host.scrollLeft) + "px)";
      gh.classList.add("gh-under");
    };
    const dlyLift = () => {
      dlyCfgPaint();
      dlyRngEdge();
      try { dlyGhFix(); } catch (e) {}
      const g = shell.querySelector(".dlyg"); if (!g) return;
      /* v548 : la hauteur suit les changements de mise en page (bloc agrandi / réduit, rotation, clavier) */
      { const sc = g.closest(".dly-scroll"), h = shell.querySelector("#dlyGantt"); if (sc && dlyFitScr(sc) === 2 && h) {
        /* v556 : un seul redessin, quand la hauteur de l'écran est stable (barre de Safari, rotation, clavier), jamais pendant le défilement */
        clearTimeout(shell.__dlyCapT);
        shell.__dlyCapT = setTimeout(() => { const h2 = shell.querySelector("#dlyGantt"); if (h2 && h2.isConnected) { h2.__drawn = false; try { dlyGanttDraw(); } catch (e) {} } }, 300);
      } }
      const hist = g.querySelector("#dlyGantt .ghist"), lab = g.querySelector(".dlyh-lab"), hh = g.querySelector(".dlyg-hh"), gh = g.querySelector("#dlyGantt > .gh");
      /* v550 : graphique caché (poignée tout en bas) = la barre marron « = » reste au bas de l'écran */
      const ref = hist || hh;
      if (!ref) return;
      const els = [hist, lab, hh].filter(Boolean);
      const cur = el => { const m = /translateY\((-?[\d.]+)px\)/.exec(el.style.transform || ""); return m ? +m[1] : 0; };
      const r = ref.getBoundingClientRect(), nb = r.bottom - cur(ref) + (hist ? 0 : 8), nt = r.top - cur(ref);
      const scr = g.closest(".bdg-d-scroll, .lk-scroll"), visB = Math.min(scr ? scr.getBoundingClientRect().bottom : 1e9, dlyVpB());
      const minT = gh ? gh.getBoundingClientRect().bottom : nt;
      const lift = g.classList.contains("dly-hfull") ? 0 : Math.max(0, Math.min(nb - visB, nt - minT));
      const v = lift > 0.5 ? "translateY(" + (-lift).toFixed(1) + "px)" : "";
      els.forEach(el => { if (el.style.transform !== v) el.style.transform = v; el.classList.toggle("dly-lift", !!v); });
    };
    if (!shell.__dlyLiftBound) {
      shell.__dlyLiftBound = true;
      let raf = 0; const go = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; dlyLift(); }); };
      document.addEventListener("scroll", go, true); window.addEventListener("resize", go);
      if (window.visualViewport) { window.visualViewport.addEventListener("resize", go); window.visualViewport.addEventListener("scroll", go); }
      /* v548 : aussi après tout changement de mise en page (bloc agrandi / réduit, onglets, redessin) */
      try { const ro = new ResizeObserver(go); ro.observe(document.documentElement); shell.__dlyLiftRO = ro; } catch (e) {}
      /* v556 : plus de vérification toutes les 0,4 s (calcul permanent, iPad figé) ; défilement, taille et ResizeObserver suffisent */
    }
    /* en-têtes du tableau et du Gantt fixés en haut quand le bloc défile verticalement */
    const dlyStick = sc => {
      if (!sc) return;
      const run = () => {
        const g = sc.querySelector(".dlyg");
        if (!g) return;
        /* FORMAT 21 : en-têtes du PLANNING et du Gantt placés par le suivi général (défilement du bloc ET de la page) */
        document.dispatchEvent(new Event("scroll"));
      };
      if (!sc.__dlyStick) { sc.__dlyStick = true; sc.addEventListener("scroll", run, { passive: true }); }
      run();
    };
