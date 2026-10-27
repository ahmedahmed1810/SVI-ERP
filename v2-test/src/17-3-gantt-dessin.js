    const dlyGanttDraw = () => {
      sviStep("PLANNING : DESSIN");
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
      const hasH = !!shell.querySelector(".dlyg-hh");   /* v594 : la poignée peut déjà être dans le pied (graphique fixe en bas) */
      sviStep("PLANNING : DONNÉES DU GRAPHIQUE");
      const HD = dlyHistData();
      sviStep("PLANNING : BARRES ET GRAPHIQUE");
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
        if (scr && scr.__capMax) {
          /* v594 (remarque longue 2) : le bloc = zone des tâches (qui défile) + pied fixe en bas (graphique et poignée « = »), hors de la zone qui défile ;
             tot = hauteur totale du bloc ; le pied prend la hauteur tirée à la poignée (ou tout, sous les en-têtes, en plein écran) */
          const tot = scr.__capMax;
          let F = 0;
          if (hasH) {
            /* v596 : le pied ne grandit jamais le bloc — il prend sa place dans la hauteur commune */
            const room = Math.max(0, tot - Math.ceil(thH) - 2);
            if (dlyHHGet() === "full") F = room;
            else F = dlyHHpx ? Math.max(0, Math.min(dlyHHpx, room - 24, Math.max(28, room - 24))) : 0;
          }
          dlyHHpx = F;
          shell.__dlyFootH = hasH ? Math.max(F, 0) : 0;
          if (scr.closest(".max-detail")) { const want = tot; if (Math.abs((parseFloat(scr.style.height) || 0) - want) > 0.5) scr.style.setProperty("height", want + "px", "important"); }
          /* v597 : le pied est posé SUR le bas du Gantt (le tableau va jusqu'en bas) : place gardée sous les tâches pour voir les dernières */
          bodyH = Math.max(bodyH + shell.__dlyFootH, Math.floor(tot - thH - 2));
        }
        const L = gg && gg.querySelector(".dlyg-l");
        if (L) {
          let f = L.querySelector(".dlyg-fill");
          if (!f) { f = document.createElement("div"); f.className = "dlyg-fill"; tbl.after(f); }
          /* v546 (R21) : le tableau descend jusqu'en bas du bloc (l'histogramme n'est que sous le Gantt) */
          f.style.height = Math.max(0, bodyH - rowsH) + "px";
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
          const sumTxt = cPG && !cum ? ["COMMANDES " + fmtA(sum)].concat(sP ? ["PRODUITS " + fmtA(sumOf(di => C.P[di] || 0))] : [], sG ? ["MARGE " + fmtA(sumOf(di => C.G[di] || 0))] : []).join(" · ") + " DH"
            : C || !multi ? fmtA(sum) + " " + esc(HD.unit)
            : mgP ? (() => { const p = sumOf(gP); return "MARGE " + (Math.abs(p) > 1e-9 ? fmtA(sumOf(gG) / p * 100) + " %" : "—"); })()
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
          if (HH >= 50) { for (let v = stp; Y0 - v * sc >= 18; v += stp) if (Y0 - v * sc <= HH - 6) ax += `<span class="gax-t" style="top:${Y0 - v * sc}px">${fmtA(v)}</span>`; for (let v = -stp; Y0 - v * sc <= HH - 6; v -= stp) ax += `<span class="gax-t" style="top:${Y0 - v * sc}px">${fmtA(v)}</span>`; }
          ax = `<div class="ghist-ax" style="height:${HH}px"><span class="gax-hit${shell.__dlyRule ? " on" : ""}" style="top:26px;height:${Math.max(0, HH - 26)}px" role="button" aria-label="Règle"></span><span class="gax-u">${esc((mgP ? "MARGE EN %" + (cum ? " (CUMULÉE)" : " / JOUR") : dlyHistLab(HD)))}</span>${ax}${Y0 <= HH ? `<span class="gax-t gax-0" style="top:${Y0}px">0</span>` : ""}</div>${Y0 <= HH ? `<div class="gzero" style="top:${Y0}px;width:${W}px"></div>` : ""}`;
          hist = `<div class="ghist${YZ > 1.01 ? " ghist-zoom" : ""}${C ? " ghist-cmd" : ""}${curve || hideC ? " ghist-cum" : ""}" style="width:${W}px;height:${HH}px" data-sc="${sc}" data-y0="${Y0}" data-stp="${stp}" data-ib="${IB}" data-top="${top}">${ax}${bg}${vline(today, "gv-today", "")}${vline(INS.dbut, "gv-but", "BUTOIR")}${leg}${C ? `<div class="ghist-leg"><span>${esc(C.lab)}</span></div>` : ""}${IB ? `<div class="ghist-inf" style="height:${IB}px"></div>` : ""}${hb}${svg ? `<svg class="ghist-svg" width="${W}" height="${HH}">${svg}</svg>` : ""}${pl}${rng}${vals}</div>`;
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
            /* v612 (point 12) : les traits DÉBUT et FIN posés traversent aussi le Gantt — une seule plage, tirée de l'un ou de l'autre */
            if (R.a) s += `<div class="grng grng-g" data-r="a" style="left:${X(R.a)}px;height:${bodyH}px"><span>DÉBUT ${dFr(R.a).slice(0, 5)}</span></div>`;
            if (R.b) s += `<div class="grng grng-g" data-r="b" style="left:${Math.min(W - 2, X(R.b) + DLY_DW)}px;height:${bodyH}px"><span>FIN ${dFr(R.b).slice(0, 5)}</span></div>`;
            return s; })()}<svg class="gtmp" width="${W}" height="${bodyH}"></svg></div>`;
      host.__X = X; host.__d0 = d0; host.__HD = HD;
      /* v594 (remarque longue 2) : graphique et poignée « = » dans un PIED FIXE sous la zone des tâches (hors de ce qui défile) :
         ils ne bougent plus pendant le défilement vertical ; le pied défile seulement à l'horizontale, avec le Gantt */
      sviStep("PLANNING : PIED DU GRAPHIQUE");
      dlyFoot(host, hist);
      sviStep("PLANNING : FIN DU DESSIN");
      /* v628 : barre choisie par un appui long (HISTOGRAMME) — gardée en évidence après un nouveau dessin */
      if (shell.__dlyBarSel) shell.querySelectorAll(`.dlyg-foot .ghb[data-d="${shell.__dlyBarSel}"]`).forEach(b => b.classList.add("ghb-sel"));
      try { dlyPickPaint(); } catch (e) {}
      host.parentElement.querySelectorAll("input.dlyp-cb[data-part]").forEach(c => { c.indeterminate = true; });
      /* défilement horizontal du Gantt gardé d'un dessin à l'autre */
      if (shell.__dlyGx !== undefined) host.scrollLeft = shell.__dlyGx;
      /* v603 : à l'ouverture du graphique (premier dessin, onglet DÉLAIS ou GRAPHIQUE) et après ENREGISTRER des réglages,
         la partie qui a des valeurs (du premier au dernier jour non nul) est centrée à l'écran ; plus large que l'écran : son début */
      /* v639 : jours utilisés avec les filtres en cours — s'ils changent (case, loupe, ISOLER, DÉBUT / FIN, EFFACER…), nouvel ajustement ;
         pas pendant un filtre du jour (l'écran reste sur le jour) ; le zoom au doigt est gardé jusqu'au changement suivant */
      const fNz = new Set(); if (HD) [HD.tot, HD.prd, HD.cmd && HD.cmd.L, HD.cmd && HD.cmd.P].forEach(M => M && Object.keys(M).forEach(k => { if (Math.abs(M[k] || 0) > 1e-9) fNz.add(k); }));
      const fRg = dlyHRange(), fT = R.filter(x => !x.grp), fDd = [...fNz].concat(fT.map(x => x.deb), fT.map(x => x.fin)).filter(Boolean).sort();
      const fA = fRg.a || fDd[0], fB = fRg.b || fDd[fDd.length - 1], fitSig = (fA || "") + "|" + (fB || "");
      const sigNew = !shell.__dlyXF && !shell.__dlyNoFit && shell.__dlyFitSig !== undefined && shell.__dlyFitSig !== fitSig;
      if (!shell.__dlyXF && !shell.__dlyNoFit) shell.__dlyFitSig = fitSig;
      if ((shell.__dlyCenter || shell.__dlyGx === undefined || sigNew) && HD && !shell.__dlyNoFit) {
        /* v632 : l'ajustement ne se fait qu'UNE fois par ouverture (ou double toucher / réglages / v639 : filtres changés) — jamais en boucle */
        const fitNow = !!shell.__dlyCenter || !shell.__dlyFitOnce || sigNew; shell.__dlyFitOnce = 1;
        shell.__dlyCenter = false;
        /* v628 : AJUSTÉ À L'OUVERTURE — premier jour au bord gauche, dernier au bord droit (petite marge), plage DÉBUT – FIN si posée,
           BUTOIR non compris (v629) ; une seule barre : au centre, au plus large permis ; le Gantt suit (même échelle) */
        {
          /* v629 : calé sur la dernière date utilisée (fin de la dernière tâche), jamais sur le BUTOIR */
          if (fA && fB && fitNow && !shell.__dlyFitting) {
            shell.__dlyFitting = true;
            /* après la mise en page : largeur réellement visible du Gantt */
            requestAnimationFrame(() => { try {
              const h2 = shell.querySelector("#dlyGantt"); if (!h2) return;
              const r = h2.getBoundingClientRect(), vw = Math.min(h2.clientWidth, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0));
              const n = Math.max(1, dDiff(fA, fB) + 1), mg = 12, want = Math.max(DLY_DW_MIN, Math.min(DLY_DW_MAX, (vw - 2 * mg) / n));
              if (vw > 60 && Math.abs(want - DLY_DW) > 0.5) (shell.__dlyDwSet || (() => {}))(h2, want, mg + Math.max(0, (vw - 2 * mg - n * Math.round(want)) / 2), dDiff(h2.__d0, fA));
            } finally { shell.__dlyFitting = false; document.getElementById("dlyDwLab")?.remove(); } });
          } }
        /* v639 : plage utilisée (avec DÉBUT / FIN) centrée, même sans changement de zoom */
        if (fA && fB) { const x1 = X(fA), x2 = X(fB) + DLY_DW, w = host.clientWidth;
          const t = x2 - x1 <= w ? (x1 + x2) / 2 - w / 2 : x1 - 2 * DLY_DW;
          host.scrollLeft = Math.max(0, Math.min(host.scrollWidth - w, t)); shell.__dlyGx = host.scrollLeft; }
      }
      host.addEventListener("scroll", () => { shell.__dlyGx = host.scrollLeft; }, { passive: true });
      dlyStick(host.closest(".bdg-d-scroll, .lk-scroll"));
      dlyCfgPaint();
      requestAnimationFrame(dlyRngEdge);
      dlyKbPaint();
      requestAnimationFrame(() => { try { dlyGhFix(); } catch (e) {} try { dlyThFix(); } catch (e) {} });
      if (!host.__ghFixS) { host.__ghFixS = true; host.addEventListener("scroll", () => { const f = shell.querySelector("#bdgTabBody > .gh-fix > .gh-fix-in"); if (f) f.style.transform = "translateX(" + (-host.scrollLeft) + "px)"; }, { passive: true }); }
      dlyLift();
    };
    /* v597 : pied du graphique posé sous le Gantt seulement (bas du cadre, aligné sur le Gantt) ; le tableau descend jusqu'en bas */
    const dlyFootPos = () => {
      const host = shell.querySelector("#dlyGantt"), body = shell.querySelector("#bdgTabBody"), ft = body && body.querySelector(":scope > .dlyg-foot"), scr = body && body.querySelector(":scope > .dly-scroll");
      if (!host || !ft || !scr) return;
      const br = body.getBoundingClientRect(), hr = host.getBoundingClientRect(), sr = scr.getBoundingClientRect(), F = ft.offsetHeight;
      const s = ft.style, l = (hr.left - br.left) + "px", w = host.clientWidth + "px", t = (sr.top - br.top + scr.clientHeight - F) + "px";
      if (s.left !== l) s.left = l; if (s.width !== w) s.width = w; if (s.top !== t) s.top = t;
    };
    const dlyFoot = (host, hist) => {
      const body = shell.querySelector("#bdgTabBody"), scr = host.closest(".bdg-d-scroll"), hh = shell.querySelector(".dlyg-hh");
      let ft = body && body.querySelector(":scope > .dlyg-foot");
      if (!body || !scr || !hh) { if (ft) ft.remove(); shell.__dlyFootH = 0; return; }
      if (!ft) {
        ft = document.createElement("div"); ft.className = "dlyg-foot";
        ft.innerHTML = '<div class="dlyf-sc"><div class="dlyf-in"></div></div>';
        const sc0 = ft.firstChild;
        /* défilement horizontal lié dans les deux sens au Gantt */
        sc0.addEventListener("scroll", () => { const h = shell.querySelector("#dlyGantt"); if (h && Math.abs(h.scrollLeft - sc0.scrollLeft) > 0.5) h.scrollLeft = sc0.scrollLeft; }, { passive: true });
      }
      if (ft.parentElement !== body) body.appendChild(ft);
      if (hh.parentElement !== ft) ft.appendChild(hh);
      const sc = ft.firstChild, inn = sc.firstChild;
      inn.innerHTML = hist || "";
      const F = shell.__dlyFootH || 0;
      ft.style.height = F + "px";
      ft.classList.toggle("dlyf-empty", !hist);
      dlyFootPos();
      ft.classList.toggle("dlyf-gra", !!shell.querySelector(".dlyg.dly-gra"));
      const br = body.getBoundingClientRect(), hr = host.getBoundingClientRect(), sp = shell.querySelector(".dlyg-sp");
      inn.style.width = (host.scrollWidth || 0) + "px";
      { const dw = host.style.getPropertyValue("--dw"); if (ft.style.getPropertyValue("--dw") !== dw) ft.style.setProperty("--dw", dw); }
      /* la barre marron horizontale part de la barre marron verticale et va jusqu'au bord droit du cadre (FORMAT 201) */
      hh.style.left = ((sp ? sp.getBoundingClientRect().left : hr.left) - hr.left) + "px"; hh.style.right = -Math.max(0, scr.getBoundingClientRect().right - (hr.left + host.clientWidth)) + "px"; hh.style.top = (F ? -7 : -15) + "px"; hh.style.transform = "";
      if (Math.abs(sc.scrollLeft - host.scrollLeft) > 0.5) sc.scrollLeft = host.scrollLeft;
      if (!host.__footS) { host.__footS = true; host.addEventListener("scroll", () => { const f = shell.querySelector("#bdgTabBody > .dlyg-foot > .dlyf-sc"); if (f && Math.abs(f.scrollLeft - host.scrollLeft) > 0.5) f.scrollLeft = host.scrollLeft; }, { passive: true }); }
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
      const tabs = document.getElementById("bdgTabs"), vb = dlyVpB();
      const mx = !!scr.closest(".max-detail");
      document.documentElement.classList.toggle("dly-lock", mx && scr.isConnected);
      /* v594 (remarque longue 2) : bloc agrandi — la ligne des onglets toujours entière juste sous le bandeau du budget */
      if (mx && tabs) { const t = tabs.getBoundingClientRect().top; if (t < lim - 0.5 || (t > lim + 0.5 && window.scrollY > 0)) window.scrollBy(0, t - lim); }
      const sr = scr.getBoundingClientRect();
      /* tot = hauteur totale du bloc (zone des tâches + pied du graphique) : bloc agrandi = jusqu'au bas de l'écran visible ;
         sinon la hauteur commune du bloc détail (FORMAT 202), moins les bandeaux posés au-dessus (ISOLÉ…) */
      let tot;
      if (mx) tot = Math.max(160, Math.floor(vb - sr.top - 2));
      else {
        const hd = parseFloat(getComputedStyle(scr).getPropertyValue("--h-detail")) || 148;
        let ban = 0; scr.parentElement && scr.parentElement.querySelectorAll(":scope > .dly-iso").forEach(b => { ban += b.offsetHeight; });
        tot = Math.max(60, Math.round(hd - ban));   /* v596 : exactement la hauteur commune du bloc détail (même hauteur que les autres onglets) */
      }
      let r = 0;
      if (Math.abs((scr.__capMax || 0) - tot) > 1) { scr.__capMax = tot; r = 2; }
      /* v598 : bloc réduit — la hauteur suit directement la poignée du bas (variable --h-detail), moins les bandeaux posés au-dessus */
      if (!mx) {
        let ban = 0; scr.parentElement && scr.parentElement.querySelectorAll(":scope > .dly-iso").forEach(b => { ban += b.offsetHeight; });
        const v = ban ? `calc(var(--h-detail, 148px) - ${ban}px)` : "";
        if (scr.style.getPropertyValue("height") !== v) { if (v) scr.style.setProperty("height", v, "important"); else scr.style.removeProperty("height"); }
        return r;
      }
      const want = tot;   /* v597 : le pied du graphique est posé par-dessus le bas du Gantt */
      if (Math.abs((parseFloat(scr.style.height) || 0) - want) > 1) { scr.style.setProperty("height", want + "px", "important"); r = r || 1; }
      return r;
    };
    /* v558 : ⚙ (réglages du graphique) visible seulement quand l'histogramme est affiché : pas en vue tableau seul, ni graphique caché */
    const dlyCfgPaint = () => {
      const g = shell.querySelector(".blk-cfg-btn"); if (!g) return;
      const host = shell.querySelector("#dlyGantt"), h = shell.querySelector(".dlyg-foot .ghist");
      const on = (active === "dly" || active === "gra") && !!shell.__insDly && !!h && h.offsetHeight > 0 && host.clientWidth > 30 && !shell.querySelector(".dlyg.dly-hnone");
      if (g.classList.contains("dly-on") !== on) g.classList.toggle("dly-on", on);
    };
    /* histogramme (et son libellé, et la poignée « = ») gardé en bas de la zone visible du planning : les tâches défilent dessous */
    /* v573 (remarque 18) : traits DÉBUT / FIN non posés = collés aux bords gauche et droit de la partie visible du Gantt (suivent le défilement) */
    const dlyRngEdge = () => {
      const host = shell.querySelector("#dlyGantt"); if (!host) return;
      const a = shell.querySelector('.dlyg-foot .grng.grng-off[data-r="a"]'), b = shell.querySelector('.dlyg-foot .grng.grng-off[data-r="b"]');
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
    /* v594 (remarque longue 2) : en-tête du TABLEAU du planning fixe, comme celui du calendrier — une copie posée hors de la zone qui défile,
       à la même hauteur que l'en-tête du Gantt (une seule bande d'en-têtes), qui ne suit que le défilement horizontal du tableau ;
       le vrai en-tête, transparent, reste dessous et reçoit les touchers (loupes, tri, largeur des colonnes) */
    const dlyThFix = () => {
      const L = shell.querySelector(".dlyg-l"), body = shell.querySelector("#bdgTabBody"), tbl = L && L.querySelector("table"), th = tbl && tbl.querySelector(":scope > thead"), scr = L && L.closest(".dly-scroll");
      let fx = body && body.querySelector(":scope > .th-fix");
      if (!L || !th || !scr || !body || L.clientWidth < 3 || L.closest(".dly-gra")) { if (fx) fx.remove(); if (th) th.classList.remove("th-under"); return; }
      if (!fx) { fx = document.createElement("div"); fx.className = "th-fix"; fx.innerHTML = '<table></table>'; body.appendChild(fx); }
      const t = fx.firstChild;
      if (th.__fixSrc !== th.innerHTML || t.className !== tbl.className + " th-fix-t") {
        th.__fixSrc = th.innerHTML; t.className = tbl.className + " th-fix-t"; t.innerHTML = th.outerHTML;
        t.querySelectorAll("thead, tr, th").forEach(x => { x.style.transform = ""; x.classList.remove("sv-stuck"); });
        th.__wk = "";
      }
      const rs = [...th.querySelectorAll("th")], cs = [...t.querySelectorAll("th")];
      const ws = rs.map(x => x.getBoundingClientRect().width), wk = ws.map(w => w.toFixed(1)).join(",") + "|" + tbl.offsetWidth;
      if (th.__wk !== wk) { th.__wk = wk; cs.forEach((c, i) => { const w = (ws[i] || 0) + "px"; c.style.width = w; c.style.minWidth = w; c.style.maxWidth = w; c.style.boxSizing = "border-box"; }); t.style.width = tbl.offsetWidth + "px"; }
      const br = body.getBoundingClientRect(), lr = L.getBoundingClientRect(), sr = scr.getBoundingClientRect();
      let lim = 0; document.querySelectorAll(".topbar, .bdg-d-sticky").forEach(b => { const r = b.getBoundingClientRect(); if (r.height && /sticky|fixed/.test(getComputedStyle(b).position)) lim = Math.max(lim, r.bottom > 0 ? r.bottom : 0); });
      const gh = shell.querySelector("#dlyGantt > .gh"), H = Math.max(th.offsetHeight, gh ? gh.offsetHeight : 0);
      const top = Math.max(sr.top, Math.min(lim, sr.bottom - H)) - br.top, st = fx.style;
      st.top = top + "px"; st.left = (lr.left - br.left) + "px"; st.width = L.clientWidth + "px"; st.height = H + "px";
      t.style.transform = "translateX(" + (-L.scrollLeft) + "px)";
      if (!L.__thFixS) { L.__thFixS = true; L.addEventListener("scroll", () => { const f = shell.querySelector("#bdgTabBody > .th-fix > table"); if (f) f.style.transform = "translateX(" + (-L.scrollLeft) + "px)"; }, { passive: true }); }
      th.classList.add("th-under");
    };
    /* v579 (partie 11, remarque 13) : clavier sur le PLANNING — ↓, Tab, Entrée = tâche suivante ; ↑, Maj + Tab = précédente ;
       la tâche choisie est encadrée dans le tableau et sur le Gantt, et l'écran la suit (← → ne font rien) */
    const dlyKbPaint = (scroll) => {
      const k = shell.__dlyKb;
      shell.querySelectorAll(".dlyg-l tr.dly-kb, #dlyGantt .gb.gb-kb").forEach(x => x.classList.remove("dly-kb", "gb-kb"));
      /* v638 : encadrée seulement après ↓ ↑ Tab Entrée au clavier — un toucher choisit le point de départ sans cadre */
      if (!k || !shell.__dlyKbShow) return;
      const tr = shell.querySelector(`.dlyg-l tr.dly-task[data-key="${CSS.escape(k)}"]`), b = shell.querySelector(`#dlyGantt .gb[data-key="${CSS.escape(k)}"]`);
      if (tr) tr.classList.add("dly-kb");
      shell.querySelectorAll(`#dlyGantt .gb[data-key="${CSS.escape(k)}"]`).forEach(x => x.classList.add("gb-kb"));
      if (scroll && tr) {
        const sc = tr.closest(".dly-scroll"), r = tr.getBoundingClientRect(), sr = sc ? sc.getBoundingClientRect() : null;
        if (sc && sr) { const head = 40, hist = 0; if (r.top < sr.top + head) sc.scrollTop -= sr.top + head - r.top; else if (r.bottom > sr.bottom - hist - 8) sc.scrollTop += r.bottom - (sr.bottom - hist - 8); }
        if (b) { const H = shell.querySelector("#dlyGantt"), bl = b.offsetLeft, bw = b.offsetWidth; if (bl < H.scrollLeft || bl + Math.min(bw, H.clientWidth) > H.scrollLeft + H.clientWidth) H.scrollLeft = Math.max(0, bl - 40); }
      }
    };
    if (!shell.__dlyKbBound) {
      shell.__dlyKbBound = true;
      document.addEventListener("pointerdown", e => { shell.__dlyKbOn = !!(e.target.closest && e.target.closest(".dlyg")) && !(e.target.closest && e.target.closest("input, textarea, select")); const g = e.target.closest && e.target.closest(".dlyg [data-key]"); if (shell.__dlyKbOn && g && g.dataset.key && g.dataset.key.includes("|")) shell.__dlyKb = g.dataset.key; if (shell.__dlyKbShow) { shell.__dlyKbShow = false; dlyKbPaint(); } }, true);
      document.addEventListener("keydown", e => {
        if (!shell.__dlyKbOn || !shell.isConnected || !shell.querySelector(".dlyg")) return;
        const a = document.activeElement; if (a && a.matches && a.matches("input, textarea, select, [contenteditable]")) return;
        if (document.getElementById("svConf") || document.getElementById("blkMenu")) return;
        const down = e.key === "ArrowDown" || e.key === "Enter" || (e.key === "Tab" && !e.shiftKey), up = e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey);
        if (!down && !up) return;
        const K = (shell.__dlyRows || []).filter(r => !r.grp && r.key).map(r => r.key);
        if (!K.length) return;
        e.preventDefault(); e.stopPropagation();
        let i = K.indexOf(shell.__dlyKb);
        i = i < 0 ? (down ? 0 : K.length - 1) : Math.max(0, Math.min(K.length - 1, i + (down ? 1 : -1)));
        shell.__dlyKb = K[i]; shell.__dlyKbShow = true;
        dlyKbPaint(true);
      }, true);
    }
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
      /* v594 (remarque longue 2) : plus de recalage du graphique pendant le défilement — il est dans le pied fixe ; seuls la position
         horizontale du pied (largeur du tableau changée, rotation) et l'en-tête fixe du tableau sont remis à jour */
      try { dlyFootPos(); } catch (e) {}
      try { dlyThFix(); } catch (e) {}
    };
    if (!shell.__dlyLiftBound) {
      shell.__dlyLiftBound = true;
      /* v594 (remarque longue 2) : bloc agrandi sur le PLANNING — la page ne glisse jamais (rebond compris) ; seules les zones qui défilent bougent */
      document.addEventListener("touchmove", e => {
        if (!shell.isConnected || e.defaultPrevented || e.touches.length > 1) return;
        const scr = shell.querySelector("#bdgTabBody > .dly-scroll");
        if (!scr || !scr.closest(".max-detail")) { document.documentElement.classList.remove("dly-lock"); return; }
        const t = e.target;
        if (t.closest && t.closest(".dly-scroll, .dlyf-sc, .dlyg-l, #dlyGantt, #bdgTabs, #svConf, #blkMenu, [role=dialog], input, textarea, select")) return;
        e.preventDefault();
      }, { passive: false });
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
      if (!sc.__dlyStick) { sc.__dlyStick = true; sc.addEventListener("scroll", run, { passive: true });
        /* v580 (partie 11, remarques 8 et 12) : graphique et poignée « = » recalés AU MÊME MOMENT que le défilement des tâches
           (et non une image plus tard), pour qu'ils ne tremblent plus, rebond compris */
        sc.addEventListener("scroll", () => { try { dlyLift(); } catch (e) {} }, { passive: true });
        sc.addEventListener("touchmove", () => { try { dlyLift(); } catch (e) {} }, { passive: true }); }
      run();
    };
