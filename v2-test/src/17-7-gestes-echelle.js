      const dlyDwSet = (host, w, ax, p) => {
        w = Math.max(DLY_DW_MIN, Math.min(DLY_DW_MAX, Math.round(w)));
        if (w === DLY_DW) return;
        try { localStorage.setItem(DLY_SC[dlyScale()].k, DLY_FILL && w <= DLY_FILL + 0.01 ? "fit" : String(w)); } catch (e) {}   /* v559 : réduit au maximum = ajusté à l'écran */
        host.__drawn = false; dlyGanttDraw();
        const h2 = shell.querySelector("#dlyGantt");
        if (h2) h2.scrollLeft = Math.max(0, p * w - ax);
        let lab = document.getElementById("dlyDwLab");
        if (!lab) { lab = document.createElement("div"); lab.id = "dlyDwLab"; document.body.appendChild(lab); }
        const r = (h2 || host).getBoundingClientRect();
        lab.textContent = "1 JOUR = " + Math.round(w * 10) / 10 + " PX";
        lab.style.left = (r.left + ax) + "px"; lab.style.top = (r.top + 4) + "px";
        clearTimeout(lab.__tm); lab.__tm = setTimeout(() => lab.remove(), 900);
      };
      shell.addEventListener("pointerdown", e => {
        const gh = e.target.closest && e.target.closest("#dlyGantt .gh");
        if (!gh || e.button > 0 || shell.__dlyPinch) return;
        const host = gh.closest("#dlyGantt"), hr = host.getBoundingClientRect();
        const x0 = e.clientX, y0 = e.clientY, w0 = DLY_DW, ax = x0 - hr.left, p = (ax + host.scrollLeft) / w0;
        let on = false, raf = 0;
        const mv = ev => {
          if (shell.__dlyPinch) return;   /* deuxième doigt posé : c'est le pincement qui agit */
          const dx = ev.clientX - x0;
          if (!on) { if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(ev.clientY - y0)) return; on = true; }
          ev.preventDefault();
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => dlyDwSet(host, w0 * Math.pow(2, dx / 160), ax, p));
        };
        const up = () => {
          document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
          if (on) { shell.__dlyNoClick = true; setTimeout(() => { shell.__dlyNoClick = false; }, 400); }
        };
        document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
      });
      if (!shell.__dlyPinchBound) {
        shell.__dlyPinchBound = true;
        /* plusieurs doigts sur le Gantt : noté, pour ne pas prendre la fin du geste pour un toucher (calendrier) */
        const multi = e => { if (e.touches && e.touches.length >= 2 && e.target.closest && e.target.closest("#dlyGantt")) shell.__dlyMultiT = Date.now(); };
        shell.addEventListener("touchstart", multi, { capture: true, passive: true });
        shell.addEventListener("touchmove", multi, { capture: true, passive: true });
        shell.addEventListener("touchend", e => { if (Date.now() - (shell.__dlyMultiT || 0) < 800) shell.__dlyMultiT = Date.now(); }, { capture: true, passive: true });
        let P0 = null;
        const dist = t => Math.abs(t[0].clientX - t[1].clientX), distY = t => Math.abs(t[0].clientY - t[1].clientY);
        shell.addEventListener("touchstart", e => {
          const host = e.target.closest && e.target.closest("#dlyGantt");
          if (!host || e.touches.length !== 2) return;
          const hr = host.getBoundingClientRect(), mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - hr.left;
          /* écarter à l'horizontale = largeur des jours ; à la verticale = hauteur des lignes et des barres (sens choisi au premier mouvement) */
          P0 = { t0: Date.now(), host, d: Math.max(20, dist(e.touches)), dy: Math.max(20, distY(e.touches)), rh0: dlyRhGet(), mode: "", rx: dist(e.touches), ry: distY(e.touches), w0: DLY_DW, ax: mx, p: (mx + host.scrollLeft) / DLY_DW };
          shell.__dlyPinch = true; shell.__dlyPinched = true;
          P0.tg = e.target; e.target.addEventListener("touchmove", pmv, { passive: false }); e.target.addEventListener("touchend", end); e.target.addEventListener("touchcancel", end);
          e.preventDefault();
        }, { passive: false });
        /* le Gantt se redessine pendant le geste : le doigt touche alors un élément retiré, qui garde ses événements ;
           on écoute donc aussi l'élément touché au départ */
        const pmv = e => {
          if (!P0 || e.touches.length !== 2 || e.__sviPinch) return;
          e.__sviPinch = true;
          e.preventDefault();
          if (!P0.mode) {
            const ex = Math.abs(dist(e.touches) - P0.rx), ey = Math.abs(distY(e.touches) - P0.ry);
            if (Math.max(ex, ey) < 12) return;
            P0.mode = ey > ex ? "v" : "h";
          }
          if (P0.mode === "v" && P0.tg && P0.tg.closest && P0.tg.closest(".ghist")) {
            /* v577 (remarque 7) : sur le graphique, écarter à la verticale = agrandir l'échelle des valeurs (les petites barres deviennent
               lisibles, les grandes dépassent en haut) ; rapprocher = réduire ; l'axe suit (la hauteur du graphique se règle à la poignée « = ») */
            if (P0.z0 === undefined) P0.z0 = shell.__dlyYZ || 1;
            const z = Math.max(1, Math.min(50, P0.z0 * Math.max(20, distY(e.touches)) / P0.dy));
            if (Math.abs(z - (shell.__dlyYZ || 1)) > 0.02) { shell.__dlyYZ = z; clearTimeout(P0.ht); P0.ht = setTimeout(() => { const H = shell.querySelector("#dlyGantt"); if (H) { H.__drawn = false; dlyGanttDraw(); } }, 30); }
            return;
          }
          if (P0.mode === "v") {
            const rh = Math.round(Math.max(24, Math.min(64, P0.rh0 * Math.max(20, distY(e.touches)) / P0.dy)));
            if (rh !== dlyRhGet()) { try { localStorage.setItem(DLY_RH_KEY, String(rh)); } catch (err) {} dlyRhApply(rh); }
            return;
          }
          const w = P0.w0 * Math.max(20, dist(e.touches)) / P0.d;
          dlyDwSet(shell.querySelector("#dlyGantt") || P0.host, w, P0.ax, P0.p);
        };
        shell.addEventListener("touchmove", pmv, { passive: false });
        const end = e => { if (!P0 || (e.touches && e.touches.length >= 2)) return; const tg = P0.tg; if (tg) { tg.removeEventListener("touchmove", pmv); tg.removeEventListener("touchend", end); tg.removeEventListener("touchcancel", end); }
          /* v449 : toucher bref à deux doigts (sans écarter) n'importe où sur le Gantt = Gantt sur toute la largeur ↔ tableau de nouveau affiché */
          const tap = !P0.mode && Date.now() - P0.t0 < 450 && e.type === "touchend";
          P0 = null; setTimeout(() => { shell.__dlyPinch = false; }, 50);
          void tap;   /* v451 : les deux doigts ne servent qu'au pincement (le tableau ne revient que par la poignée) */
        };
        shell.addEventListener("touchend", end); shell.addEventListener("touchcancel", end);
      }
      /* v461 : appui long sur le NOM d'un lot ou d'un niveau sur le Gantt = son menu (ISOLER) */
      shell.addEventListener("pointerdown", e => {
        const X = shell.__insDly;
        const gn = e.target.closest && e.target.closest("#dlyGantt .gb-grp[data-path]");
        if (!X || !gn || e.button > 0) return;
        const x0 = e.clientX, y0 = e.clientY;
        const t = setTimeout(() => { shell.__dlyGLong = Date.now(); X.grpMenu(gn.dataset.path, gn); }, 500);
        const mv = ev => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) stop(); };
        const stop = () => { clearTimeout(t); document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", stop); document.removeEventListener("pointercancel", stop); };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", stop); document.addEventListener("pointercancel", stop);
      });
      /* barre d'un lot (ou d'un titre) sur le Gantt : glisser sans attendre = déplacer toutes ses tâches dans le temps ;
         appui long puis glisser vers le haut ou le bas = changer son rang ou son titre (FORMAT 96) */
      shell.addEventListener("pointerdown", e => {
        const X = shell.__insDly;
        const gb = e.target.closest && e.target.closest("#dlyGantt .gsum, #dlyGantt .gseg, #dlyGantt .gdot");
        if (!X || !gb || e.button > 0 || shell.__dlyPinch) return;
        e.preventDefault(); e.stopPropagation();
        const host = gb.closest("#dlyGantt"), path = gb.dataset.path;
        const els = [...host.querySelectorAll(".gsum, .gseg, .gdot")].filter(b => b.dataset.path === path);
        const g = (shell.__dlyRows || []).find(r => r.grp && r.path === path);
        const G = new Set(g ? g.all.map(t => t.key) : []);
        const bars = [...host.querySelectorAll(".gb")].filter(b => G.has(b.dataset.key));
        const moving = [...els, ...bars];
        const x0 = e.clientX, y0 = e.clientY;
        let mode = "", hit = null, days = 0, gfar = false;
        const t = setTimeout(() => { if (mode) return; mode = "vert"; els.forEach(b => b.classList.add("gb-lift")); document.body.classList.add("svi-dragging"); }, 500);
        const tmv = ev => { if (mode) ev.preventDefault(); };
        document.addEventListener("touchmove", tmv, { passive: false });
        const mv = ev => {
          if (shell.__dlyPinch) { clearTimeout(t); return; }
          const dx = ev.clientX - x0;
          if (mode === "vert") { ev.preventDefault(); if (!gfar && Math.hypot(dx, ev.clientY - y0) < 10) return; if (X.view() === "d") { if (!gfar) svToast("VUE PAR DÉBUT : PASSER EN VUE PAR LOT POUR DÉPLACER.", 3000, gb); gfar = true; hit = null; return; } gfar = true; shell.__dlySrcG = window.__sviDlySrcG = true; hit = g ? dlyGrpHit(ev, path, g.lvl, x0) : null; dlyGrpShow(hit); return; }
          if (!mode && Math.abs(dx) > 4) { mode = "time"; clearTimeout(t); moving.forEach(b => { b.__l0 = b.offsetLeft; b.classList.add("gb-drag"); }); }
          if (mode !== "time") return;
          ev.preventDefault();
          days = Math.round(dx / DLY_DW);
          moving.forEach(b => { b.style.left = (b.__l0 + days * DLY_DW) + "px"; });
        };
        const up = () => {
          clearTimeout(t);
          document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
          setTimeout(() => document.removeEventListener("touchmove", tmv), 0);
          document.getElementById("roLine")?.remove(); document.body.classList.remove("svi-dragging");
          shell.querySelectorAll(".dlyg-l tr.ro-on").forEach(r => r.classList.remove("ro-on")); sviDlyRoSync();
          moving.forEach(b => b.classList.remove("gb-drag", "gb-lift"));
          if (shell.__dlyPinched) { shell.__dlyPinched = false; X.render(); return; }
          if (mode === "vert") { if (!gfar) { X.grpMenu(path, gb); return; } if (hit) X.moveGroup(path, hit, gb); else X.render(); return; }
          if (mode === "time") { if (days) X.shiftGroup(path, days, gb); else X.render(); }
        };
        document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
      });
      shell.addEventListener("pointerdown", e => {
        const X = shell.__insDly;
        const bar = e.target.closest && e.target.closest("#dlyGantt .gb");
        if (!X || !bar || e.button > 0) return;
        if (bar.classList.contains("gb-ext")) { e.preventDefault(); svToast("TÂCHE HORS DE LA BRANCHE ISOLÉE : LECTURE SEULE (TOUT AFFICHER POUR LA MODIFIER).", 3000, bar); return; }
        const host = bar.closest("#dlyGantt"), body = host.querySelector(".gbody"), tmp = host.querySelector(".gtmp");
        const zero = bar.classList.contains("gb0");
        const key = bar.dataset.key, mode = zero || e.target.closest(".gb-e") ? "end" : e.target.closest(".gb-s") ? "start" : "body";
        e.preventDefault();
        const x0 = e.clientX, y0b = e.clientY, L0 = bar.offsetLeft, W0 = bar.offsetWidth;
        let moved = false, link = false, days = 0, vert = false, hitV = null;
        /* appui long : sur un bout = liaison ; sur le milieu = changer le rang (barre soulevée) */
        const t = setTimeout(() => { if (moved) return; if (mode !== "body") { link = true; bar.classList.add("gb-link"); } else if (X.view() === "d") { svToast("VUE PAR DÉBUT : PASSER EN VUE PAR LOT POUR DÉPLACER.", 3000, bar); } else { vert = true; bar.classList.add("gb-lift"); } }, 500);
        const br = () => body.getBoundingClientRect();
        /* liaison selon le bout de départ ET le bout d'arrivée (moitié gauche = début, moitié droite = fin) :
           fin → début = FD ; début → fin = FD dans l'autre sens ; début → début = DD ; fin → fin = rien */
        const linkPlan = ev => {
          /* les fils (flèches) peuvent couvrir le bout d'une barre : on prend la première barre sous le doigt */
          let tg = document.elementsFromPoint(ev.clientX, ev.clientY).map(e => e.closest && e.closest("#dlyGantt .gb")).find(Boolean);
          /* v517 : plus de sensibilité — sans barre exactement sous le doigt, la barre la plus proche (jusqu'à 26 px) est visée */
          if (!tg || tg.dataset.key === key) {
            let best = null, bd = 26;
            host.querySelectorAll(".gb:not(.gb-ext)").forEach(b => {
              if (b.dataset.key === key || !b.dataset.key) return;
              const q = b.getBoundingClientRect();
              const dx = Math.max(q.left - ev.clientX, 0, ev.clientX - q.right), dy = Math.max(q.top - ev.clientY, 0, ev.clientY - q.bottom);
              const d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = b; }
            });
            tg = best;
          }
          if (!tg || tg.dataset.key === key) return null;
          const r = tg.getBoundingClientRect(), side = ev.clientX > r.left + r.width / 2 ? "end" : "start", o = tg.dataset.key;
          let P = null;
          if (mode === "end" && side === "start") P = { pred: key, succ: o, t: "FD" };
          else if (mode === "start" && side === "end") P = { pred: o, succ: key, t: "FD" };
          else if (mode === "start" && side === "start") P = { pred: key, succ: o, t: "DD" };
          if (!P || X.reach(P.pred, P.succ)) return null;
          return { ...P, tg, side };
        };
        const ax = mode === "end" ? L0 + W0 : L0, ay = bar.offsetTop + bar.offsetHeight / 2;
        const mv = ev => {
          if (shell.__dlyPinch) { clearTimeout(t); return; }
          const dx = ev.clientX - x0;
          if (link) {
            const r = br();
            tmp.innerHTML = `<line x1="${ax}" y1="${ay}" x2="${ev.clientX - r.left}" y2="${ev.clientY - r.top}" stroke="#b42318" stroke-width="2" stroke-dasharray="4 3"/>`;
            /* FORMAT 96 : la barre survolée passe aussi en pointillés, bout visé marqué d'un point rouge
               (sauf liaison impossible : elle-même, une boucle, fin → fin) */
            const P = linkPlan(ev);
            host.querySelectorAll(".gb.gb-tgt").forEach(b => { if (!P || b !== P.tg) b.classList.remove("gb-tgt", "gb-ts", "gb-te"); });
            if (P) { P.tg.classList.add("gb-tgt"); P.tg.classList.toggle("gb-ts", P.side === "start"); P.tg.classList.toggle("gb-te", P.side === "end"); }
            return;
          }
          /* glisser la barre vers le haut ou le bas = changer le rang de la tâche (un seul trait) */
          const dy = ev.clientY - y0b;
          if (vert) { shell.__dlySrcG = window.__sviDlySrcG = true; hitV = dlyTaskHit(ev, null, key, x0); if (!hitV) document.getElementById("roLine")?.remove(); return; }
          if (!moved && Math.abs(dx) > 4) { moved = true; clearTimeout(t); bar.classList.add("gb-drag"); }
          if (!moved) return;
          days = Math.round(dx / DLY_DW);
          if (mode === "end") bar.style.width = Math.max(DLY_DW - 1, W0 + days * DLY_DW) + "px";
          else bar.style.left = (L0 + days * DLY_DW) + "px";
        };
        const up = ev => {
          clearTimeout(t);
          document.removeEventListener("pointermove", mv);
          document.removeEventListener("pointerup", up);
          document.removeEventListener("pointercancel", up);
          bar.classList.remove("gb-link", "gb-drag", "gb-lift");
          host.querySelectorAll(".gb.gb-tgt").forEach(b => b.classList.remove("gb-tgt", "gb-ts", "gb-te"));
          if (shell.__dlyPinch || shell.__dlyPinched) { shell.__dlyPinched = false; tmp.innerHTML = ""; document.getElementById("roLine")?.remove(); return; }
          if (vert) { document.getElementById("roLine")?.remove(); shell.querySelectorAll(".dlyg-l tr.ro-on").forEach(t => t.classList.remove("ro-on")); sviDlyRoSync(); if (hitV && hitV.on) X.superpose(key, hitV.on, bar); else if (hitV) X.dropTaskTo(key, hitV, bar); return; }
          if (link) {
            tmp.innerHTML = "";
            const P = linkPlan(ev);
            if (P) X.addLink(P.pred, P.succ, P.t, P.tg);
            return;
          }
          if (!moved && mode === "body" && bar.classList.contains("gb-tin")) { dlyGEdit(bar); return; }   /* nom dans la barre : toucher = le modifier */
          if (!moved || !days) { X.render(); return; }
          if (zero) { if (days > 0) X.giveDur(key, bar.dataset.at, days, bar); else X.render(); return; }
          X.dragTo(key, mode, days, bar);
        };
        document.addEventListener("pointermove", mv);
        document.addEventListener("pointerup", up);
        document.addEventListener("pointercancel", up);
      });
    }
