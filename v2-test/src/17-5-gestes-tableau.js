    if (!shell.__dlyPlanBound) {
      shell.__dlyPlanBound = true;
      shell.addEventListener("click", e => {
        const X = shell.__insDly;
        if (!X) return;
        const pc = e.target.closest && e.target.closest(".dly-pred");
        if (pc) { e.stopPropagation(); X.pickPreds(pc.dataset.key); return; }
        if (e.target.closest && e.target.closest(".dly-pred-new")) { X.addWin(); return; }
        if (e.target.closest && e.target.closest(".dly-gen")) { X.gen(); return; }
        /* v562 : AFFICHER PAR LOT du bandeau d'abord (il porte aussi la classe dly-iso-x) */
        if (e.target.closest && e.target.closest(".dly-vd-x")) { X.viewSet("l"); return; }
        if (e.target.closest && e.target.closest(".dly-crit-x")) { shell.__dlyCrit = null; refreshAll(); return; }   /* v666 (axe 8) */
        if (e.target.closest && e.target.closest(".dly-iso-x")) { X.isoOff(); return; }
        /* ‹ PLANNING : retour au PLANNING (lot et activités libérés, la désignation reste choisie ; brouillon gardé) */
        /* en-tête du Gantt : calendrier du budget, ouvert sur le mois touché */
        /* nom d'un lot ou d'une activité sur le Gantt : toucher = le modifier sur place */
        const gr = e.target.closest && e.target.closest("#dlyGantt .gb-ren");
        if (gr && Date.now() - (shell.__dlyGLong || 0) < 600) { e.stopPropagation(); return; }
        if (gr) { e.stopPropagation(); dlyGEdit(gr); return; }
        const gf = e.target.closest && e.target.closest("#dlyGantt .gb-fold");
        if (gf) { e.stopPropagation(); X.fold(gf.dataset.path); return; }
        const gh = e.target.closest && e.target.closest("#dlyGantt .gh");
        if (gh && shell.__dlyNoClick) { shell.__dlyNoClick = false; return; }
        /* v449 : deux doigts posés sur le Gantt (pincement pour élargir) : le calendrier ne s'ouvre pas */
        if (gh && Date.now() - (shell.__dlyMultiT || 0) < 800) return;
        if (gh) { const host = gh.closest("#dlyGantt"); const n = Math.floor((e.clientX - gh.getBoundingClientRect().left) / DLY_DW); sviBdgCalWin(sviIsoAdd(host.__d0, Math.max(0, n))); return; }
        const lv = e.target.closest && e.target.closest(".dly-lev");
        if (lv) { if (!lv.disabled) X.level(); return; }
        /* repli d'un lot (› / ⌄) */
        const fo = e.target.closest && e.target.closest(".dly-fold");
        if (fo) { e.stopPropagation(); X.fold(fo.dataset.path); return; }
        /* JALON : toucher l'étoile = poser / retirer le jalon */
        const ja = e.target.closest && e.target.closest(".dly-jal");
        if (ja) { e.stopPropagation(); X.jal(ja.dataset.key); return; }
        /* fil d'une liaison sur le Gantt : fenêtre LIAISON */
        const gl = e.target.closest && e.target.closest(".gl-hit");
        if (gl) { e.stopPropagation(); X.linkWin(gl.dataset.p, gl.dataset.s); return; }
        /* v454 : les dates se saisissent dans la ligne ; toucher la ligne ne change plus les choix des ronds */
      });
      /* gestes sur le Gantt (FORMAT 96) : glisser une barre = la déplacer ; tirer son bout = changer la FIN ;
         appui long sur la fin (ou le début) puis glisser jusqu'à une autre barre = liaison FIN → DÉBUT (ou DÉBUT → DÉBUT) */
      /* PLANNING : cases à cocher (tâche, lot = toutes ses tâches, en-tête = toutes les tâches affichées) et noms modifiables */
      shell.addEventListener("change", e => {
        const X = shell.__insDly;
        if (!X) return;
        const c = e.target.closest && e.target.closest("input.dlyp-cb, input.dlyp-cball");
        if (c) {
          const S = shell.__dlySel = shell.__dlySel || new Set(), R = shell.__dlyRows || [];
          let keys = [];
          if (c.classList.contains("dlyp-cball")) keys = R.flatMap(x => x.grp ? x.all.map(t => t.key) : [x.key]);
          else if (c.dataset.path) { const g = R.find(x => x.grp && x.path === c.dataset.path); keys = g ? g.all.map(t => t.key) : []; }
          else keys = [c.dataset.key];
          keys.forEach(k => { if (c.checked) S.add(k); else S.delete(k); });
          /* v537 : les autres blocs suivent (filtre des cases cochées) */
          refreshAll();
          return;
        }
        const n = e.target.closest && e.target.closest("input.dly-nm:not(.dly-gin)");
        if (n && !n.__gnDone && n.value !== n.defaultValue) { n.__gnDone = true; shell.__gnPend = null; X.rename(n); return; }
        const ni = e.target.closest && e.target.closest("input.dly-newin");
        if (ni) {
          const tr = ni.closest("tr"), g = f => tr.querySelector(`input.dly-newin[data-f="${f}"]`);
          if (tr.dataset.done) return;
          if (g("lot").value.trim() && g("sec").value.trim()) { tr.dataset.done = "1"; X.newTask(g("lot").value, g("sec").value, ni); }
          else { const o = g(ni.dataset.f === "lot" ? "sec" : "lot"); if (o && !o.value.trim()) setTimeout(() => o.focus(), 0); }
          return;
        }
      });
      /* ligne SAISIR ICI… du PLANNING : Entrée / Tab sur l'activité (lot et activité remplis) = créer la tâche */
      shell.addEventListener("keydown", e => {
        const ni = e.target.closest && e.target.closest("input.dly-newin");
        if (!ni || (e.key !== "Enter" && e.key !== "Tab") || e.shiftKey) return;
        const tr = ni.closest("tr"), g = f => tr.querySelector(`input.dly-newin[data-f="${f}"]`);
        if (!g("lot").value.trim() || !g("sec").value.trim()) { if (ni.dataset.f === "lot") { e.preventDefault(); e.stopPropagation(); g("sec").focus(); } return; }
        e.preventDefault(); e.stopPropagation();
        if (tr.dataset.done) return; tr.dataset.done = "1";
        const X = shell.__insDly; if (X) X.newTask(g("lot").value, g("sec").value, ni);
      }, true);
      /* séparation tableau / Gantt (FORMAT 90) : poignée ‖ tirée au doigt ; largeur du tableau mémorisée */
      shell.addEventListener("pointerdown", e => {
        /* v455 : la poignée ne réagit que sur sa pastille ‖ (le reste du trait est insensible) */
        const sp = e.target.closest && e.target.closest(".dlyg-hd") && e.target.closest(".dlyg-sp");
        if (!sp) return;
        e.preventDefault(); e.stopPropagation();
        const g = sp.closest(".dlyg"), L = g.querySelector(".dlyg-l"), gw = g.getBoundingClientRect();
        const x0 = e.clientX, w0 = L.getBoundingClientRect().width;
        sp.classList.add("on");
        let w = w0;
        /* de 0 (tableau caché) à toute la largeur (Gantt caché) */
        /* la poignée suit le doigt jusqu'au lâcher : doigt capturé, défilement de la page bloqué pendant le geste */
        try { sp.setPointerCapture(e.pointerId); } catch (err) {}
        const tmv = ev => ev.preventDefault();
        document.addEventListener("touchmove", tmv, { passive: false });
        const mv = ev => { if (ev.pointerId !== e.pointerId) return; ev.preventDefault(); w = Math.round(Math.max(0, Math.min(gw.width - 3, w0 + ev.clientX - x0))); L.style.width = w + "px"; L.style.maxWidth = "none"; };
        const up = ev => {
          if (ev && ev.pointerId !== e.pointerId) return;
          document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
          document.removeEventListener("touchmove", tmv);
          sp.classList.remove("on");
          /* R13 : simple toucher du signe « = » = la poignée va d'un bord à l'autre (tableau caché ↔ Gantt caché) */
          if (Math.abs(w - w0) < 3) {
            w = w0 > (gw.width - 3) / 2 ? 0 : Math.round(gw.width - 3);
            L.scrollLeft = 0; L.style.width = w + "px"; L.style.maxWidth = "none";
          }
          if (w > 2) shell.__dlygPrevW = Math.round(w);
          g.classList.toggle("tbl-hid", w < 3);
          requestAnimationFrame(dlyCfgPaint);
          /* largeur gardée (et retrouvée à l'ouverture, FORMAT 114) ; seule la poignée la change */
          shell.__dlygW = { ins: shell.__insDly && shell.__insDly.INS, ref: DLYG_REF, w: Math.round(w), auto: false };
          if (window.__sviViewSave) window.__sviViewSave();
        };
        document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
      });
      /* modifier sur le Gantt le nom d'un lot (titre de barre) ou d'une activité secondaire (barre ou nom à droite) :
         même saisie que dans le tableau (Entrée / quitter = enregistrer ; nom vide ou en double refusé) */
      /* v597 : nom sur le Gantt — 1er toucher = sélectionné (cadre fin de la forme de la barre, sans clavier),
         2e toucher = saisie dans un cadre rouge qui épouse la barre (sans grande case ni poignées de sélection de l'iPad) */
      const dlyGSelOff = () => { document.getElementById("dlyGSelF")?.remove(); shell.__dlyGSel = null; };
      if (!shell.__dlyGSelB) { shell.__dlyGSelB = true;
        document.addEventListener("pointerdown", e => { const f = document.getElementById("dlyGSelF"); if (!f) return; const t = e.target.closest && e.target.closest("#dlyGantt .gb-ren, #dlyGantt .gb.gb-tin"); if (!t || (t.dataset.key || t.dataset.path) !== shell.__dlyGSel) dlyGSelOff(); }, true);
        document.addEventListener("scroll", () => { if (document.getElementById("dlyGSelF")) dlyGSelOff(); }, true); }
      const dlyGShape = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return { r, rad: cs.borderRadius && cs.borderRadius !== "0px" ? cs.borderRadius : "6px" }; };
      const dlyGEdit = el => {
        const host = el.closest("#dlyGantt"), body = host && host.querySelector(".gbody");
        if (!body) return;
        const id = el.dataset.key || el.dataset.path;
        if (shell.__dlyGSel !== id || !document.getElementById("dlyGSelF")) {
          dlyGSelOff();
          const { r, rad } = dlyGShape(el), f = document.createElement("div");
          f.id = "dlyGSelF"; f.style.cssText = `position:fixed;left:${r.left - 2}px;top:${r.top - 2}px;width:${r.width + 4}px;height:${r.height + 4}px;border-radius:${rad}`;
          document.body.appendChild(f); shell.__dlyGSel = id;
          return;
        }
        dlyGSelOff();
        document.querySelector("input.dly-gin")?.remove();
        const key = el.dataset.key, path = el.dataset.path;
        const sid = key ? key.split("|")[1] : "", val = key ? lkName("sec", sid) : lotLab(dlyLotPath(path)).name || "";
        const r = el.getBoundingClientRect();
        /* v465 : case posée sur la page (pas dans le Gantt) : un redessin du Gantt (clavier de l'iPad qui s'ouvre…) ne l'efface plus ;
           enregistrée à la sortie de la case (ENTRÉE ou toucher ailleurs), après la fin de la saisie prédictive (mot sans espace) */
        const i = document.createElement("input");
        i.className = "dly-nm dly-gin"; i.autocomplete = "off"; i.setAttribute("enterkeyhint", "done"); i.setAttribute("autocapitalize", "characters");
        i.dataset.kind = key ? "sec" : "grp";
        if (key) i.dataset.sid = sid; else i.dataset.path = path;
        i.value = val;
        { const rad = dlyGShape(el).rad, w = Math.max(r.width + 4, dlyTxtW(val) + 24), h = Math.max(18, r.height + 4);
          i.style.cssText = `position:fixed;left:${Math.max(4, r.left - 2)}px;top:${r.top - 2}px;width:${w}px;height:${h}px;border-radius:${rad};z-index:10050`; }
        document.body.appendChild(i);
        i.focus(); try { const n = i.value.length; i.setSelectionRange(n, n); } catch (err) {}
        let done = false, cancel = false;
        const commit = () => {
          if (done) return; done = true;
          setTimeout(() => {
            const v = i.value; i.remove();
            if (cancel || U_(sviClean(v)) === U_(val)) return;
            const X = shell.__insDly; if (X) X.rename(i);
          }, 40);
        };
        i.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === "Tab") { ev.preventDefault(); ev.stopPropagation(); i.blur(); } else if (ev.key === "Escape") { cancel = true; i.value = val; i.blur(); } });
        i.addEventListener("blur", commit);
      };
      /* PLANNING : appui long sur une tâche ou un lot puis glisser = la / le déplacer (un seul trait) */
      const dlyRowKeys = tr => { if (!tr) return []; if (tr.classList.contains("dly-task")) return [tr.dataset.key]; const g = (shell.__dlyRows || []).find(x => x.grp && x.path === tr.dataset.path); return g ? g.all.map(t => t.key) : []; };
      const dlyRowAt = (y, src) => {
        for (const r0 of shell.querySelectorAll(".dlyg-l tbody tr.dly-task, .dlyg-l tbody tr.dly-grp")) {
          const r = r0.getBoundingClientRect();
          if (y >= r.top && y <= r.bottom && r0 !== src) return { tr: r0, r, after: y > (r.top + r.bottom) / 2 };
        }
        return null;
      };
      const dlyRowLine = h => {
        let l = document.getElementById("roLine");
        if (!l) { l = document.createElement("div"); l.id = "roLine"; document.body.appendChild(l); }
        /* le trait n'apparaît que là où l'on agit (FORMAT 64) : glissement sur le tableau = trait sur le tableau,
           décalé de 20 px par niveau comme DÉSIGNATIONS CLIENT ; sur le Gantt = trait sur le Gantt, 40 px par niveau, petit trait vertical au départ */
        const box = h.tr.closest(".dlyg"), onG = !!shell.__dlySrcG;
        const pane = box.querySelector(onG ? ".dlyg-r" : ".dlyg-l") || box, g = pane.getBoundingClientRect();
        let ind = onG ? 8 + (h.lvl || 0) * 40 : (h.lvl ? 6 + h.lvl * 20 : 0);
        /* v445 (Ahmed) : le trait part du TITRE PARENT (lot d'arrivée) et file jusqu'au bord droit —
           tableau : aligné sur le titre du lot dans la colonne LOT ; Gantt : aligné sur la date de début du lot (bord gauche de sa barre).
           Racine (pas de lot parent) : titres / barres de premier niveau. Nom du lot d'arrivée surligné en jaune sur le Gantt. */
        box.querySelectorAll(".gb-grp.gb-grp-tgt").forEach(n => n.classList.remove("gb-grp-tgt"));
        if (h.parent !== undefined) {
          const E = v => (window.CSS && CSS.escape ? CSS.escape(v) : String(v).replace(/"/g, '\\"'));
          const vis = r => r && r.width && r.right > g.left && r.left < g.right;
          const lefts = els => els.map(e2 => e2.getBoundingClientRect()).filter(vis).map(r => r.left);
          let xs;
          if (onG) {
            xs = h.parent ? lefts([...box.querySelectorAll(`.dlyg-r :is(.gsum, .gseg, .gdot)[data-path="${E(h.parent)}"]`)])
              : lefts([...box.querySelectorAll(".dlyg-r :is(.gsum, .gseg, .gdot)")]);
            const nm = h.parent ? box.querySelector(`.dlyg-r .gb-grp[data-path="${E(h.parent)}"]`) : null;
            if (nm) nm.classList.add("gb-grp-tgt");
          } else {
            xs = h.parent ? lefts([...box.querySelectorAll(`.dlyg-l tr.dly-grp[data-path="${E(h.parent)}"] .dly-lotc .dly-fold`)])
              : lefts([...box.querySelectorAll(".dlyg-l tr.dly-grp .dly-lotc .dly-fold")]);
          }
          if (xs.length) ind = Math.min(...xs) - g.left;
          ind = Math.max(0, Math.min(g.width - 40, ind));
        }
        const y = (h.after ? h.r.bottom : h.r.top) - 1.5;
        l.style.cssText = `position:fixed;z-index:10060;pointer-events:none;height:3px;border-radius:2px;background:${h.keep === true ? "#2563eb" : h.keep === false ? "#111827" : "var(--inst,#12355b)"};left:${g.left + ind}px;width:${Math.max(40, g.width - ind)}px;top:${y}px`;
        l.innerHTML = "";
      };
      /* lot glissé en hauteur (tableau ou Gantt) : endroit et niveau d'arrivée (FORMAT 64 / 44) —
         le trait commence au niveau d'arrivée ; doigt vers la droite = plus profond, vers la gauche = moins ;
         au milieu d'un lot ou d'un titre = superposé (ligne encadrée) */
      const dlyGrpHit = (ev, path, lvl0, x0) => {
        const R = shell.__dlyRows || [], P = dlyLotPath(path);
        const inSrc = x => { const s2 = dlyLotPath(x.grp ? x.path : x.lot); return s2.length >= P.length && P.every((g, i) => U_(g) === U_(s2[i])); };
        const rows = [...shell.querySelectorAll(".dlyg-l tbody tr.dly-task, .dlyg-l tbody tr.dly-grp")].map(tr => {
          const x = tr.classList.contains("dly-grp") ? R.find(r => r.grp && r.path === tr.dataset.path) : R.find(r => !r.grp && r.key === tr.dataset.key);
          return x ? { tr, x, r: tr.getBoundingClientRect() } : null;
        }).filter(o => o && !inSrc(o.x));
        shell.querySelectorAll(".dlyg-l tr.ro-on").forEach(t => t.classList.remove("ro-on")); sviDlyRoSync();
        if (!rows.length) return null;
        let i = rows.findIndex(o => ev.clientY < o.r.bottom);
        if (i < 0) i = rows.length;
        const o = rows[i];
        if (o && o.x.grp && ev.clientY >= o.r.top + o.r.height / 3 && ev.clientY <= o.r.bottom - o.r.height / 3) {
          o.tr.classList.add("ro-on"); sviDlyRoSync();
          let j = i + 1; while (j < rows.length && rows[j].x.lvl > o.x.lvl) j++;
          const nx = rows.slice(j).find(q => !q.x.grp);
          return { on: o.x.path, before: nx ? nx.x.key : "", tr: o.tr, r: o.r, after: false, line: false };
        }
        if (o && ev.clientY > o.r.top + o.r.height / 2) i++;
        const prev = rows[i - 1], next = rows[i];
        const maxL = prev ? (prev.x.grp ? prev.x.lvl + 1 : prev.x.lvl) : 0, minL = next ? next.x.lvl : 0;
        let L = Math.round(lvl0 + (ev.clientX - x0) / 30);
        L = Math.max(Math.min(minL, maxL), Math.min(maxL, Math.max(minL, L)));
        let parent = "";
        if (L > 0) for (let k = i - 1; k >= 0; k--) if (rows[k].x.grp && rows[k].x.lvl === L - 1) { parent = rows[k].x.path; break; }
        const nx = rows.slice(i).find(q => !q.x.grp);
        const ref = next || prev;
        /* v463 : doigt resté au niveau de départ = trait BLEU : le lot garde son titre d'origine et son numéro, seule sa place change ;
           doigt décalé à gauche / à droite = trait NOIR aligné sur le titre visé : il y entre (nouveau numéro) ; plus à gauche = niveau supérieur */
        const keep = Math.round((ev.clientX - x0) / 30) === 0;
        if (keep) { const own = P.slice(0, -1).join(" / "); return { keep: true, parent: own, into: !!own, before: nx ? nx.x.key : "", tr: ref.tr, r: ref.r, after: !next, lvl: P.length - 1, line: true }; }
        return { keep: false, parent, into: !!parent, before: nx ? nx.x.key : "", tr: ref.tr, r: ref.r, after: !next, lvl: L, line: true };
      };
      /* tâche glissée : au milieu d'une autre tâche (ligne encadrée) = superposer ; sinon trait (rang / lot) */
      /* tâche glissée (tableau ou Gantt), même logique que DÉSIGNATIONS CLIENT (FORMAT 44 / 64) :
         au milieu d'une autre tâche (ligne en jaune) = superposer ; sinon un trait à l'endroit du dépôt, qui commence au niveau d'arrivée :
         doigt vers la droite = trait court = la tâche entre dans le lot du dessus (plus profond) ; vers la gauche = trait long = lot de niveau supérieur.
         Une tâche est toujours dans un lot (jamais à la racine, jamais dans un simple niveau sans lot). */
      const dlyTaskHit = (ev, srcTr, srcKey, x0) => {
        shell.querySelectorAll(".dlyg-l tr.ro-on").forEach(t => t.classList.remove("ro-on")); sviDlyRoSync();
        const R = shell.__dlyRows || [];
        const rows = [...shell.querySelectorAll(".dlyg-l tbody tr.dly-task, .dlyg-l tbody tr.dly-grp")].map(tr => {
          const x = tr.classList.contains("dly-grp") ? R.find(r => r.grp && r.path === tr.dataset.path) : R.find(r => !r.grp && r.key === tr.dataset.key);
          return x ? { tr, x, r: tr.getBoundingClientRect() } : null;
        }).filter(o => o && !(srcKey && !o.x.grp && o.x.key === srcKey));
        if (!rows.length) return null;
        let i = rows.findIndex(o => ev.clientY < o.r.bottom);
        if (i < 0) i = rows.length;
        const o = rows[i];
        if (o && !o.x.grp && ev.clientY >= o.r.top + o.r.height / 3 && ev.clientY <= o.r.bottom - o.r.height / 3) {
          o.tr.classList.add("ro-on"); sviDlyRoSync(); document.getElementById("roLine")?.remove();
          return { tr: o.tr, r: o.r, after: false, on: o.x.key };
        }
        if (o && ev.clientY > o.r.top + o.r.height / 2) i++;
        const prev = rows[i - 1], next = rows[i];
        if (!prev) { document.getElementById("roLine")?.remove(); return null; }   /* tout en haut : pas de lot au-dessus */
        const isLot = path => INS.lot.some(l => !l.t && dlyLotPath(l.v).join(" / ") === path);
        /* niveaux possibles (niveau d'une tâche = niveau de son lot + 1) */
        const maxL = prev.x.grp ? prev.x.lvl + 1 : prev.x.lvl, minL = Math.max(1, next ? (next.x.grp ? next.x.lvl : next.x.lvl) : 1);
        const parentAt = L => { for (let k = i - 1; k >= 0; k--) if (rows[k].x.grp && rows[k].x.lvl === L - 1) return rows[k]; return null; };
        const ok = [];
        for (let L = Math.min(minL, maxL); L <= maxL; L++) { const pa = parentAt(L); if (L >= 1 && pa && isLot(pa.x.path)) ok.push(L); }
        if (!ok.length) { document.getElementById("roLine")?.remove(); return null; }
        const src = srcKey ? R.find(r => !r.grp && r.key === srcKey) : null;
        const want = Math.round((src ? src.lvl : maxL) + (ev.clientX - (x0 === undefined ? ev.clientX : x0)) / 30);
        const L = ok.reduce((b, v) => Math.abs(v - want) < Math.abs(b - want) ? v : b, ok[0]);
        const pa = parentAt(L);
        const nextT = rows.slice(i).find(q => !q.x.grp), prevT = [...rows.slice(0, i)].reverse().find(q => !q.x.grp);
        const h = { tr: (next || prev).tr, r: (next || prev).r, after: !next, lvl: L, parent: pa.x.path,
          before: next && !next.x.grp ? next.x.key : "", afterKey: !(next && !next.x.grp) && prevT ? prevT.x.key : "", nextKey: nextT ? nextT.x.key : "" };
        dlyRowLine(h);
        return h;
      };
      const dlyGrpShow = h => { if (h && h.line) dlyRowLine(h); else document.getElementById("roLine")?.remove(); };
      /* v539 : lots et titres du PLANNING glissés avec les MÊMES règles que la liste des lots du bloc TÂCHES :
         milieu d'un titre / d'un lot = regroupement (titre sur titre ou lot sur lot = nouveau titre ; lot sur titre = dedans) ;
         juste sous un titre déplié ou entre deux lignes d'un groupe = dans ce groupe ; sous la dernière ligne d'un groupe
         ou sous un groupe replié : doigt à droite = trait court = dedans, à gauche = trait long = même rang */
      const dlyFakeT = tr => {
        const path = tr.dataset.path, rec = INS.lot.find(l => !l.t && U_(l.v) === U_(path));
        const base = { getBoundingClientRect: () => tr.getBoundingClientRect(), closest: () => null };
        return rec ? { ...base, classList: { contains: () => false }, dataset: { iid: rec.id } } : { ...base, classList: { contains: c => c === "lot-grp" }, dataset: { path } };
      };
      const dlyLotHit = (ev, srcP, x0) => {
        const tb = shell.querySelector(".dlyg-l table tbody");
        if (!tb) return null;
        const all = [...tb.querySelectorAll("tr.dly-grp, tr.dly-task")].filter(t => !t.classList.contains("dly-ext"));
        const inSrc = sg => sg.length >= srcP.length && srcP.every((g, i) => U_(g) === U_(sg[i]));
        const G = all.filter(t => t.classList.contains("dly-grp")).map(t => { const segs = dlyLotPath(t.dataset.path);
          return { el: t, segs, kids: INS.lot.some(l => !l.t && lotSegs(l).length > segs.length && lotUnder(l, segs)), folded: dlyIsFolded(t.dataset.path) }; }).filter(o => !inSrc(o.segs));
        const tr = all.find(t => { const r = t.getBoundingClientRect(); return ev.clientY >= r.top && ev.clientY <= r.bottom; });
        if (!tr) return null;
        const r = tr.getBoundingClientRect(), f = (ev.clientY - r.top) / (r.height || 1);
        let x, pos;
        if (tr.classList.contains("dly-grp")) { x = G.find(o => o.el === tr); pos = f > .25 && f < .75 ? "on" : f >= .75 ? "after" : "before"; }
        else { let g = tr.previousElementSibling; while (g && !g.classList.contains("dly-grp")) g = g.previousElementSibling; x = G.find(o => o.el === g); pos = "after"; }
        if (!x) return null;
        if (pos === "on") return { on: true, x };
        const ix = G.indexOf(x), pv = pos === "after" ? G[ix] : G[ix - 1], nx = pos === "after" ? G[ix + 1] : G[ix];
        let D, Dmin, Dmax, inStart = false;
        if (!pv) D = Dmin = Dmax = 0;
        else if (pv.kids && !pv.folded) { inStart = true; D = Dmin = Dmax = pv.segs.length; }
        else {
          Dmax = pv.kids ? pv.segs.length : pv.segs.length - 1;
          Dmin = nx ? Math.min(Dmax, nx.segs.length - 1) : 0;
          D = Math.max(Dmin, Math.min(Dmax, Dmax + Math.round((ev.clientX - x0) / 28)));
        }
        const cell = (x.el.querySelector(".dly-lotc") || x.el).getBoundingClientRect(), rowR = tr.getBoundingClientRect();
        const left = cell.left + 6 + D * 20, y = pos === "before" ? rowR.top : rowR.bottom;
        let l = document.getElementById("roLine");
        if (!l) { l = document.createElement("div"); l.id = "roLine"; document.body.appendChild(l); }
        const tbr = tb.getBoundingClientRect();
        l.style.cssText = `position:fixed;z-index:10060;pointer-events:none;height:3px;border-radius:2px;background:var(--inst,#12355b);left:${left}px;width:${Math.max(20, tbr.right - left)}px;top:${y - 1.5}px`;
        return { gap: { prev: pv ? pv.segs : null, D, inStart, el: pv ? pv.el : x.el } };
      };
