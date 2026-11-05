/* =========================================================
   v879 : DÉCOUPE DU GRAND BLOC (programme, point 4) — GESTES DU PLANNING (TABLEAU, GANTT, ÉCHELLE) sort de openBudgetDetail.
   Appelé depuis l'écran du budget (17-5-gestes-tableau.js) avec ce dont il a besoin ; refreshAll, lkName, dlyHRange, histLog (déclaré plus loin dans l'écran du budget) est lu au moment de l'appel.
   ========================================================= */
function sviBdgGestesPlanning(C) {
  const { DLYG_REF, DLY_SC, ECR, INS, body, dlyCfgPaint, dlyGanttDraw, dlyIsFolded, dlyRhApply, dlyRngEdge, dlyScale, grpFlush, insSave, lotDrop, lotLab, ref, shell } = C;
  const refreshAll = (...a) => C.refreshAll()(...a);
  const lkName = (...a) => C.lkName()(...a);
  const dlyHRange = (...a) => C.dlyHRange()(...a);
  const histLog = (...a) => C.histLog()(...a);
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
      if (gh) { const host = gh.closest("#dlyGantt"); const n = Math.floor((e.clientX - gh.getBoundingClientRect().left) / ECR.DLY_DW); sviBdgCalWin(sviIsoAdd(host.__d0, Math.max(0, n))); return; }
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
    shell.__dlyRowDrag = (e, srcTr, onDrop) => {};
    /* + AJOUTER UNE TÂCHE grisé : appui long = la raison (FORMAT 56) */
    shell.addEventListener("pointerdown", e => {
      const b = e.target.closest && e.target.closest(".dly-pred-new.off");
      if (!b) return;
      const t = setTimeout(() => svToast("TOUTES LES TÂCHES SONT DÉJÀ DANS LE PLANNING.", 3000, b), SVI_G.lp);
      const off = () => { clearTimeout(t); document.removeEventListener("pointerup", off); document.removeEventListener("pointercancel", off); };
      document.addEventListener("pointerup", off); document.addEventListener("pointercancel", off);
    });
    shell.addEventListener("pointerdown", e => {
      const X = shell.__insDly;
      const tr = e.target.closest && e.target.closest(".dlyg-l tr.dly-task, .dlyg-l tr.dly-grp");
      if (!X || !tr || tr.classList.contains("dly-ext") || e.target.closest("input[type=checkbox], .dly-pred, .dly-jal, .dly-fold, .cf-btn")) return;
      const x0 = e.clientX, y0 = e.clientY;
      let on = false, hit = null, far = false;
      const tm = setTimeout(() => { if (X.view() === "d" && !tr.classList.contains("dly-grp")) { svToast("VUE PAR DÉBUT : PASSER EN VUE PAR LOT POUR DÉPLACER.", 3000, tr); end(false); return; } on = true; tr.classList.add("ro-src"); grpFlush(true); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); try { window.getSelection().removeAllRanges(); } catch (err) {} document.body.classList.add("svi-dragging"); }, SVI_G.lp);
      const tmv = ev => { if (on) ev.preventDefault(); };
      document.addEventListener("touchmove", tmv, { passive: false });
      const isG = tr.classList.contains("dly-grp"), gRow = isG ? (shell.__dlyRows || []).find(r => r.grp && r.path === tr.dataset.path) : null;
      const mv = ev => {
        if (!on) { if (Math.abs(ev.clientX - x0) > 8 || Math.abs(ev.clientY - y0) > 8) end(); return; }
        ev.preventDefault();
        if (!far && Math.hypot(ev.clientX - x0, ev.clientY - y0) < SVI_G.drag) return;
        far = true;
        shell.__dlySrcG = window.__sviDlySrcG = false;
        if (gRow && X.view() === "d") { if (!tr.__vdMsg) { tr.__vdMsg = 1; svToast("VUE PAR DÉBUT : PASSER EN VUE PAR LOT POUR DÉPLACER.", 3000, tr); } hit = null; return; }
        if (gRow) {
          shell.querySelectorAll(".dlyg-l tr.ro-on").forEach(t => t.classList.remove("ro-on"));
          hit = dlyLotHit(ev, dlyLotPath(gRow.path), x0);
          if (!hit) document.getElementById("roLine")?.remove();
          else if (hit.on) { document.getElementById("roLine")?.remove(); hit.x.el.classList.add("ro-on"); }
          return;
        }
        if (tr.classList.contains("dly-task")) { hit = dlyTaskHit(ev, tr, tr.dataset.key, x0); if (!hit) document.getElementById("roLine")?.remove(); return; }
        hit = dlyRowAt(ev.clientY, tr);
        if (hit) dlyRowLine(hit); else document.getElementById("roLine")?.remove();
      };
      const end = drop => {
        clearTimeout(tm);
        if (shell.__gnRefresh) { shell.__gnRefresh = false; setTimeout(() => refreshAll(), 0); }
        document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", cc);
        setTimeout(() => document.removeEventListener("touchmove", tmv), 0);
        document.getElementById("roLine")?.remove(); tr.classList.remove("ro-src"); document.body.classList.remove("svi-dragging");
        shell.querySelectorAll(".dlyg-l tr.ro-on").forEach(t => t.classList.remove("ro-on")); sviDlyRoSync();
        if (on) { const stop = ev => { ev.stopPropagation(); ev.preventDefault(); }; shell.addEventListener("click", stop, { capture: true, once: true }); setTimeout(() => shell.removeEventListener("click", stop, { capture: true }), 350); }
        /* v461 : appui long sans glisser sur un lot ou un niveau = son menu (ISOLER) */
        if (drop && on && !far && gRow) { X.grpMenu(gRow.path, tr.querySelector(".dly-lotc") || tr); return; }
        if (drop && on && hit && far && gRow) {
          const rec = INS.lot.find(l => !l.t && U_(l.v) === U_(gRow.path)), sid = rec ? rec.id : "@" + gRow.path;
          if (hit.on) lotDrop(sid, dlyFakeT(hit.x.el), "on", null, { plan: true });
          else lotDrop(sid, dlyFakeT(hit.gap.el), "gap", hit.gap, { plan: true });
          return;
        }
        if (drop && on && hit && far) { if (gRow) X.moveGroup(gRow.path, hit, tr); else if (hit.on) X.superpose(tr.dataset.key, hit.on, tr); else if (tr.classList.contains("dly-task")) X.dropTaskTo(tr.dataset.key, hit, tr); else X.moveKeys(dlyRowKeys(tr), dlyRowKeys(hit.tr), hit.after); }
      };
      const up = () => end(true), cc = () => end(false);
      document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", cc);
    });
    /* barre CAPACITÉ (FORMAT 99, 167 ; R2, R21) : tirée au doigt, par paliers entiers ; 0 = pénurie ; sous le zéro = ILLIMITÉ ;
       v703 : le planning suit pendant le geste (baisser = allonger, monter = resserrer), un seul ↶ pour le geste. Appui long sans bouger = « / » et bulle COUPER ICI qui suivent le doigt jour par jour ;
       lâcher = couper à ce jour */
    shell.addEventListener("pointerdown", e => {
      const X = shell.__insDly;
      let pl = e.target.closest && e.target.closest(".dlyg-foot .gplaf");
      if (!X || !pl) return;
      e.preventDefault(); e.stopPropagation();
      const h = pl.closest(".ghist"), sc = Number(h.dataset.sc) || 1, Y0 = Number(h.dataset.y0) || h.offsetHeight, IB = Number(h.dataset.ib) || 0, r0 = h.getBoundingClientRect();
      let v0 = pl.querySelector(".gplaf-v"); const seg = Number(pl.dataset.seg) || 0, pre = (v0.textContent.match(/^\d\d\/\d\d\/\d{4} : /) || [""])[0];
      let P = null, cut = null, Plive = null, lvT = 0, lvTm = null;
      /* v703 : la barre n'a pas de bouton — le planning suit pendant le geste (dans les deux sens), ↶ annule tout le geste */
      const live = () => { lvTm = null; if (P === null || P === Plive) return; Plive = P; lvT = Date.now(); shell.__undoHold = true;
        X.plafSeg(seg, P, null, true);
        const npl = shell.querySelector(`.dlyg-foot .gplaf[data-seg="${seg}"]`) || shell.querySelector(".dlyg-foot .gplaf");
        if (npl && npl !== pl) { pl = npl; v0 = pl.querySelector(".gplaf-v") || v0; pl.classList.add("gcap-drag"); place(); } };
      const x0 = e.clientX, y0 = e.clientY, host = shell.querySelector("#dlyGantt");
      const dayAt = cx => { const n = Math.floor((cx - h.getBoundingClientRect().left) / ECR.DLY_DW); return sviIsoAdd(host.__d0, Math.max(0, n)); };
      const showCut = cx => {
        const iso = sviWNear(X.cal(), dayAt(cx), 1);
        let m = document.getElementById("dlyCutTip");
        if (!m) { m = document.createElement("div"); m.id = "dlyCutTip"; document.body.appendChild(m); }
        const hr = h.getBoundingClientRect(), xi = hr.left + dDiff(host.__d0, iso) * ECR.DLY_DW;
        m.innerHTML = `<span class="ct-sl" style="left:${xi - 4}px;top:${pl.getBoundingClientRect().top - 9}px">/</span><span class="ct-b" style="left:${xi - 50}px;top:${pl.getBoundingClientRect().top - 40}px">COUPER ICI<br><b>${esc(dFr(iso))}</b></span>`;
        cut = iso;
      };
      const lt = setTimeout(() => { if (P === null) showCut(x0); }, SVI_G.lp);
      const tmv = ev => ev.preventDefault();
      document.addEventListener("touchmove", tmv, { passive: false });
      const mv = ev => {
        if (cut) { ev.preventDefault(); showCut(ev.clientX); return; }
        if (P === null && Math.abs(ev.clientY - y0) < 6 && Math.abs(ev.clientX - x0) < 6) return;
        clearTimeout(lt);
        const y = ev.clientY - r0.top;
        P = IB && y > Y0 + IB / 3 ? -1 : Math.max(0, Math.round((Y0 - y) / sc));
        place();
        if (P !== Plive && !lvTm) lvTm = setTimeout(live, Math.max(0, 140 - (Date.now() - lvT)));
      };
      /* la barre reste sous le doigt (échelle du départ du geste), même quand le graphique est redessiné */
      const place = () => { if (P === null) return;
        pl.classList.toggle("gcap-inf", P < 0); pl.classList.toggle("gcap-zero", P === 0);
        const y = P < 0 ? Y0 + IB / 2 : Y0 - P * sc, hr = pl.offsetParent ? pl.offsetParent.getBoundingClientRect() : r0;
        pl.style.top = (y + r0.top - hr.top) + "px";
        if (v0) v0.textContent = pre + (P < 0 ? "ILLIMITÉ" : P === 0 ? "CAPACITÉ 0 — PÉNURIE" : "CAPACITÉ " + P); };
      const off = () => { clearTimeout(lt); clearTimeout(lvTm); lvTm = null; document.getElementById("dlyCutTip")?.remove(); document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", cc); setTimeout(() => document.removeEventListener("touchmove", tmv), 0); };
      const fin = () => { if (shell.__undoHold) { shell.__undoHold = false; if (shell.__undoLab !== undefined) shell.__undoLab = "CAPACITÉ"; if (shell.__undoTick) shell.__undoTick(); } };
      const up = () => { const c = cut; off(); try { if (c) X.cutPlaf(c); else if (P !== null) { shell.__undoHold = true; X.plafSeg(seg, P, pl); } } finally { fin(); } };
      const cc = () => { off(); try { if (P !== null && Plive !== null) { shell.__undoHold = true; X.plafSeg(seg, P, pl); } } finally { fin(); } };
      document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", cc);
    });
    /* R28 : zone touchée en dernier (tableau, Gantt, histogramme) — liseré, et ses entrées en premier dans le menu ⋯ */
    shell.addEventListener("pointerdown", e => {
      const g = e.target.closest && e.target.closest(".dlyg");
      if (!g) return;
      const z = e.target.closest(".dlyg-l") ? "tab" : e.target.closest(".ghist, .dlyg-hh, .dlyh-lab") ? "hist" : e.target.closest("#dlyGantt") ? "gantt" : "";
      if (!z || z === shell.__dlyZone) return;
      shell.__dlyZone = z;   /* v546 (R35) : plus de liseré ni de rubriques par zone */
    }, true);
    /* R22 : toucher le « / » d'une coupe = SUPPRIMER LA COUPE (fenêtre) */
    shell.addEventListener("click", e => { const c = e.target.closest && e.target.closest(".dlyg-foot .gcut[data-i]"); const X = shell.__insDly; if (!c || !X) return; e.stopPropagation(); if (Date.now() - (shell.__dlyCutLong || 0) < 600) return; X.delCut(Number(c.dataset.i)); }, true);
    /* v546 (R19) : appui long sur le « / » = le déplacer jour par jour (seulement si les deux morceaux ont la même capacité) */
    shell.addEventListener("pointerdown", e => {
      const X = shell.__insDly, c = e.target.closest && e.target.closest(".dlyg-foot .gcut[data-i]");
      if (!X || !c) return;
      e.stopPropagation();
      const host = shell.querySelector("#dlyGantt"), h = c.closest(".ghist"), x0 = e.clientX, y0 = e.clientY;
      let mov = false, iso = null;
      const tip = cx => {
        const n = Math.floor((cx - h.getBoundingClientRect().left) / ECR.DLY_DW); iso = sviWNear(X.cal(), sviIsoAdd(host.__d0, Math.max(0, n)), 1);
        let m = document.getElementById("dlyCutTip");
        if (!m) { m = document.createElement("div"); m.id = "dlyCutTip"; document.body.appendChild(m); }
        const xi = h.getBoundingClientRect().left + dDiff(host.__d0, iso) * ECR.DLY_DW, ty = c.getBoundingClientRect().top;
        m.innerHTML = `<span class="ct-sl" style="left:${xi - 4}px;top:${ty}px">/</span><span class="ct-b" style="left:${xi - 50}px;top:${ty - 34}px">DÉPLACER ICI<br><b>${esc(dFr(iso))}</b></span>`;
      };
      const lt = setTimeout(() => {
        shell.__dlyCutLong = Date.now();
        if (c.dataset.eq !== "1") { svToast("COUPE FIXE : LES DEUX MORCEAUX N'ONT PAS LA MÊME CAPACITÉ.", 3000, c); return; }
        mov = true; tip(x0);
      }, 500);
      const tmv = ev => { if (mov) ev.preventDefault(); };
      document.addEventListener("touchmove", tmv, { passive: false });
      const mv = ev => { if (mov) { ev.preventDefault(); tip(ev.clientX); } else if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) clearTimeout(lt); };
      const up = () => {
        clearTimeout(lt); document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
        setTimeout(() => document.removeEventListener("touchmove", tmv), 0);
        document.getElementById("dlyCutTip")?.remove();
        if (mov && iso) { shell.__dlyCutLong = Date.now(); X.moveCut(Number(c.dataset.i), iso); }
      };
      document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
    }, true);
    /* v547 (R22) : DÉBUT / FIN / DURÉE d'une tâche en morceaux = fenêtre MORCEAUX */
    shell.addEventListener("click", e => { const b = e.target.closest && e.target.closest(".dlp-multi[data-task]"); const X = shell.__insDly; if (!b || !X) return; e.stopPropagation(); X.piecesWin(b.dataset.task); }, true);
    /* v546 (R29) : ⚙ = RÉGLAGES DE L'HISTOGRAMME */
    shell.addEventListener("click", e => { const b = e.target.closest && e.target.closest(".dlyhh-cfg"); const X = shell.__insDly; if (!b || !X) return; e.stopPropagation(); X.hcfgWin(b); }, true);
    /* v736 : la case SUCCESSEURS se sélectionne comme les autres (cadre commun du module 35) ; bulle du texte complet à l'appui long */
    { let lt = 0;
      shell.addEventListener("pointerdown", e => { const b = e.target.closest && e.target.closest(".dly-succ[data-key]"); const X = shell.__insDly; clearTimeout(lt); if (!b || !X) return;
        lt = setTimeout(() => { const L = X.succs(b.dataset.key); svToast(L.length ? "SUCCESSEURS : " + L.join(" ; ") : "AUCUN SUCCESSEUR.", 5000, b); }, SVI_G.lp); }, true);
      ["pointerup", "pointercancel"].forEach(t => shell.addEventListener(t, () => clearTimeout(lt), true)); }
    /* R24 : repère ⧖ d'une tâche freinée par une autre ressource */
    shell.addEventListener("click", e => { const c = e.target.closest && e.target.closest("#dlyGantt .gb-lim[data-key]"); const X = shell.__insDly; if (!c || !X) return; e.stopPropagation(); svToast(X.limTxt(c.dataset.key), 3500, c); }, true);
    /* R19 : traits DÉBUT et FIN de l'histogramme — tirés au doigt ; contre un bord = pas de limite ; croisés = noms échangés */
    shell.addEventListener("pointerdown", e => {
      const X = shell.__insDly;
      const ln = e.target.closest && e.target.closest(".dlyg-foot .grng[data-r], #dlyGantt .grng-g[data-r]");
      if (!X || !ln) return;
      e.preventDefault(); e.stopPropagation();
      const h = ln.closest(".ghist") || ln.closest(".gbody"), host = shell.querySelector("#dlyGantt"), W = h.offsetWidth, sp = ln.querySelector("span");
      const R0 = X.hrange(), other = ln.dataset.r === "a" ? R0.b : R0.a;
      ln.__drag = true;
      let iso = R0[ln.dataset.r] || "", edge = "";
      const tmv = ev => ev.preventDefault();
      document.addEventListener("touchmove", tmv, { passive: false });
      /* v575 (remarque 8) : deux états — au repos (collé au bord visible, sans effet) ; touché ou glissé dans la partie visible = posé,
         même sur le dernier jour visible ; il ne revient au repos que tiré au-delà du bord visible du Gantt */
      let moved = false;
      const mv = ev => {
        ev.preventDefault();
        moved = true;
        const x = ev.clientX - h.getBoundingClientRect().left, hr = host.getBoundingClientRect();
        edge = ev.clientX < hr.left + 2 || x <= 0 ? "l" : ev.clientX > hr.right - 2 || x >= W ? "r" : "";
        iso = edge ? "" : sviIsoAdd(host.__d0, Math.max(0, Math.floor(x / ECR.DLY_DW)));
        ln.style.left = Math.max(0, Math.min(W, x)) + "px"; ln.classList.toggle("grng-off", !!edge);
        const lab = other && iso && (ln.dataset.r === "a" ? iso > other : iso < other) ? (ln.dataset.r === "a" ? "FIN" : "DÉBUT") : (ln.dataset.r === "a" ? "DÉBUT" : "FIN");
        sp.textContent = lab + (iso ? " " + dFr(iso).slice(0, 5) : "");
        /* v657 (point 165) : croisés = les deux noms s'échangent pendant le geste */
        const o = shell.querySelector(`.dlyg-foot .grng[data-r="${ln.dataset.r === "a" ? "b" : "a"}"] span`);
        if (o && other) o.textContent = (lab === "FIN" ? "DÉBUT" : "FIN") + " " + dFr(other).slice(0, 5);
      };
      const up = () => {
        document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
        setTimeout(() => document.removeEventListener("touchmove", tmv), 0);
        const R = { ...R0 };
        ln.__drag = false;
        /* v712 (point 6) : un simple toucher ne pose rien ; lâché là où il ne retient rien (avant la première tâche pour DÉBUT,
           après la dernière pour FIN) = rien ne change, le trait reste au repos (bouton « DÉBUT » / « FIN ») */
        if (!moved) { if (!R0[ln.dataset.r]) { X.hrangeSet(R0); } return; }
        if (!edge && iso) { const [s0, s1] = X.span ? X.span() : ["", ""];
          const lab = sp.textContent.slice(0, 3) === "FIN" ? "b" : "a";
          if ((lab === "a" && s0 && iso <= s0) || (lab === "b" && s1 && iso >= s1)) edge = lab === "a" ? "l" : "r";
          }
        if (edge === "l") R.a = ""; else if (edge === "r") R.b = ""; else R[ln.dataset.r] = iso;
        if (R.a && R.b && R.a > R.b) { const t = R.a; R.a = R.b; R.b = t; }
        X.hrangeSet(R);
      };
      document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
    });
    /* R20 : lignes MIN et MAX — tirées au doigt ; tout en bas (MIN) / tout en haut (MAX) = pas de limite ; croisées = noms échangés ;
       égales = les deux clignotent ; au lâcher, les charges des jours retenus sont cochées */
    shell.addEventListener("pointerdown", e => {
      const X = shell.__insDly;
      const ln = e.target.closest && e.target.closest(".dlyg-foot .gval[data-v]");
      if (!X || !ln) return;
      e.preventDefault(); e.stopPropagation();
      const h = ln.closest(".ghist"), sc = Number(h.dataset.sc) || 1, Y0 = Number(h.dataset.y0) || h.offsetHeight, top = Number(h.dataset.top) || 1, sp = ln.querySelector("span");
      const V0 = X.hval(), role = ln.dataset.v, oth = role === "min" ? V0.max : V0.min;
      let v = V0[role], pos = "";
      const fmtV = n => (Math.round(n * 100) / 100).toLocaleString("fr-FR");
      const tmv = ev => ev.preventDefault();
      document.addEventListener("touchmove", tmv, { passive: false });
      const mv = ev => {
        ev.preventDefault();
        const y = ev.clientY - h.getBoundingClientRect().top;
        const raw = (Y0 - y) / sc;
        pos = raw <= 0 ? "b" : raw >= top * .97 ? "t" : "";
        v = pos ? null : Math.round(raw * 100) / 100;
        ln.style.top = Math.max(0, Math.min(Y0, y)) + "px"; ln.classList.toggle("gval-off", !!pos);
        const isMax = v !== null ? (oth === null ? role === "max" : v > oth) : pos === "t";
        sp.textContent = (isMax ? "MAX" : "MIN") + (v !== null ? " " + fmtV(v) : "");
        const eq = v !== null && oth !== null && Math.abs(v - oth) < 1e-9;
        if (eq && !ln.__eq) { h.querySelectorAll(".gval").forEach(g => { g.classList.remove("gval-blink"); void g.offsetWidth; g.classList.add("gval-blink"); }); }
        ln.__eq = eq;
      };
      const up = () => {
        document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
        setTimeout(() => document.removeEventListener("touchmove", tmv), 0);
        /* les deux valeurs, rangées : la plus basse = MIN, la plus haute = MAX (tout en haut = pas de MAX, tout en bas = pas de MIN) */
        const a = { v, pos: v === null ? (pos || (role === "max" ? "t" : "b")) : "" }, b = { v: oth, pos: oth === null ? (role === "min" ? "t" : "b") : "" };
        const L = [a, b], mn = L.find(x => x.pos === "b"), mxx = L.find(x => x.pos === "t"), nums = L.filter(x => x.v !== null).map(x => x.v).sort((p, q) => p - q);
        let out;
        if (nums.length === 2) out = { min: nums[0], max: nums[1] };
        else if (nums.length === 1) out = mn && !mxx ? { min: null, max: nums[0] } : mxx && !mn ? { min: nums[0], max: null } : { min: nums[0], max: null };
        else out = { min: null, max: null };
        X.hvalSet(out);
      };
      document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
    });
    /* v564 (remarque 6) : appui long sur une courbe = repères en pointillés : horizontal vers l'axe des montants (valeur),
       vertical jusqu'à l'en-tête des dates (jour) ; ils suivent le doigt tant qu'il reste posé, et restent affichés au lâcher.
       v576 (remarques 4 et 5) : repères de la couleur de la courbe choisie ; un nouveau toucher au même endroit passe à la courbe suivante */
    const dlyXClear = () => { document.querySelectorAll(".dlyx-v, .dlyx-h, .dlyx-pt, .dlyx-l").forEach(x => x.remove()); };
    const dlyXSeries = (host, H, HV) => {
      const out = [];
      const add = (lab, M, c, s, u) => { if (M && Object.keys(M).length) out.push({ lab, M, c, s, u }); };
      if (!HV.hideC && (!HV.multi || (H.crb || []).includes("c"))) add("CHARGES", HV.val, "#f79009", 0, HV.unit);
      if (HV.multi && (H.crb || []).includes("p")) add("PRODUITS", HV.vP, "#2e90fa", 0, HV.unit);
      if (HV.multi && (H.crb || []).includes("g")) add("MARGE", HV.vG, "#12b76a", 0, HV.unit);
      if (HV.rd) {
        if (HV.rd.PQs) add("PRODUIT", HV.rd.PQ, "#2e90fa", HV.rd.PQs, HV.rd.u);
        (HV.rd.S || []).forEach(s => add("RENDEMENT " + s.name, s.R, s.c, s.s, HV.rd.u + " / " + s.u));
      }
      return out;
    };
    const dlyXFmt = v => { const a = Math.abs(v), f = (x, u) => (Math.round(x * 10) / 10).toLocaleString("fr-FR") + " " + u; return a >= 1e9 ? f(v / 1e9, "G") : a >= 1e6 ? f(v / 1e6, "M") : a >= 1e4 ? f(v / 1e3, "K") : (Math.round(v * 100) / 100).toLocaleString("fr-FR"); };
    const dlyXDraw = (host, h, cx, cy, step) => {
      const HV = host.__HV || {}, H = host.__HD || {}, S = dlyXSeries(host, H, HV);
      const hr = h.getBoundingClientRect(), Y0 = Number(h.dataset.y0) || hr.height, sc = Number(h.dataset.sc) || 1;
      const i = Math.max(0, Math.floor((cx - hr.left) / ECR.DLY_DW)), di = sviIsoAdd(host.__d0, i);
      /* v655 (FORMAT 246) : repères seulement sur un jour de la plage DÉBUT – FIN */
      const RG = dlyHRange(); if ((RG.a && di < RG.a) || (RG.b && di > RG.b)) return;
      /* courbes de ce jour, de la plus proche du doigt à la plus loin */
      const C = S.map(x => { const v = x.M[di]; return v === undefined || v === null ? null : { ...x, v, y: hr.top + Y0 - v * (x.s || sc) }; }).filter(Boolean).sort((a, b) => Math.abs(a.y - cy) - Math.abs(b.y - cy));
      if (!C.length) return;
      const k = step ? ((shell.__dlyX && shell.__dlyX.i === i ? shell.__dlyX.k : 0) + step) % C.length : 0, best = C[k];
      dlyXClear();
      const mk = (c) => { const d = document.createElement("div"); d.className = c; document.body.appendChild(d); return d; };
      const px = hr.left + i * ECR.DLY_DW + ECR.DLY_DW / 2, top = hr.top;   /* v594 : graphique dans le pied fixe — repères depuis le haut du graphique */
      const ax = Math.max(hr.left, host.getBoundingClientRect().left, RG.a ? hr.left + dDiff(host.__d0, RG.a) * ECR.DLY_DW : -1e9);   /* v655 : trait horizontal depuis DÉBUT (jamais hors plage) */
      const v = mk("dlyx-v"); v.style.left = px + "px"; v.style.top = top + "px"; v.style.height = Math.max(0, best.y - top) + "px"; v.style.borderLeftColor = best.c;
      const hz = mk("dlyx-h"); hz.style.left = ax + "px"; hz.style.top = best.y + "px"; hz.style.width = Math.max(0, px - ax) + "px"; hz.style.borderTopColor = best.c;
      const p = mk("dlyx-pt"); p.style.left = px + "px"; p.style.top = best.y + "px"; p.style.borderColor = best.c;
      const ld = mk("dlyx-l"); ld.textContent = dFr(di); ld.style.left = (px - ld.offsetWidth / 2) + "px"; ld.style.top = (top + 2) + "px"; ld.style.background = best.c;
      const lv = mk("dlyx-l"); lv.textContent = (S.length > 1 ? best.lab + " " : "") + dlyXFmt(best.v) + " " + (best.u || "DH") + (C.length > 1 ? "  (" + (k + 1) + "/" + C.length + ")" : ""); lv.style.left = (ax + 4) + "px"; lv.style.top = (best.y - lv.offsetHeight - 3) + "px"; lv.style.background = best.c;
      shell.__dlyX = { host, h, i, k, cy, px, y: best.y };
    };
    /* v611 (point 3) : FILTRE DU JOUR — nouvel appui long sur le point des repères : DÉBUT et FIN autour de ce jour, cases des charges
       de ce jour cochées (tout le reste suit) ; un toucher dans le graphique hors des courbes l'enlève (plage et cases d'avant remises) */
    /* v631 : filtre du jour posé / enlevé — l'écran reste sur les mêmes jours (pas d'ajustement, pas de saut) */
    const dlyXKeep = () => { const h = shell.querySelector("#dlyGantt"); shell.__dlyNoFit = true; shell.__dlyKeepD = h && h.__d0 ? sviIsoAdd(h.__d0, Math.round(h.scrollLeft / ECR.DLY_DW)) : ""; };
    const dlyXBack = () => { const d = shell.__dlyKeepD; const go = () => { const h = shell.querySelector("#dlyGantt"); if (h && h.__d0 && d) { h.scrollLeft = Math.max(0, dDiff(h.__d0, d) * ECR.DLY_DW); shell.__dlyGx = h.scrollLeft; } }; go(); requestAnimationFrame(() => { go(); setTimeout(() => { go(); shell.__dlyNoFit = false; }, 400); }); };
    const dlyXFilter = di => {
      const host = shell.querySelector("#dlyGantt"), H = host && host.__HD;
      if (!H) return;
      if (!shell.__dlyXF) shell.__dlyXF = { hr: JSON.stringify(INS.hrange || null), on: (INS.chg || []).filter(r => !r.t && r.on === true).map(r => r.id) };
      /* v659 (FORMAT 250) : COMMANDES — une barre = une commande : DÉBUT et FIN sur les jours qu'elle couvre, seules ses charges cochées */
      const pr = H.cmd && (H.cmd.per || {})[di];
      if (pr) {
        INS.hrange = { ...(INS.hrange || {}), a: pr.a, b: pr.b };
        const SK = new Set((H.cmd.det[di] || []).map(x => x.sk)), ids = new Set((H.R || []).filter(r => SK.has(dlyResK(r))).map(r => r.id));
        if (ids.size) (INS.chg || []).forEach(r => { if (!r.t) r.on = ids.has(r.id) ? true : (r.on === true ? false : r.on); });
        dlyXKeep(); insSave(); histLog("DÉLAIS", "FILTRE DE LA COMMANDE", dFr(di)); refreshAll(); dlyXBack();
        return;
      }
      INS.hrange = { ...(INS.hrange || {}), a: di, b: di };
      const R = new Set((H.R || []).map(r => r.id)), K = new Set(((H.det || {})[di] || []).map(x => x.k)), ids = new Set();
      (INS.links || []).forEach(l => { if (K.has(l.lot + "|" + l.sec)) (l.chg || []).forEach(y => { if (R.has(y.id)) ids.add(y.id); }); });
      if (ids.size) (INS.chg || []).forEach(r => { if (!r.t) r.on = ids.has(r.id) ? true : (r.on === true ? false : r.on); });
      dlyXKeep(); insSave(); histLog("DÉLAIS", "FILTRE DU JOUR", dFr(di)); refreshAll(); dlyXBack();
      const X0 = shell.__dlyX;
      if (X0) setTimeout(() => { const h2 = shell.querySelector("#dlyGantt"), g2 = shell.querySelector(".dlyg-foot .ghist"); if (h2 && g2 && shell.__dlyX) dlyXDraw(h2, g2, X0.px, X0.cy, 0); }, 350);
    };
    const dlyXUnfilter = () => {
      const F = shell.__dlyXF; if (!F) return;
      shell.__dlyXF = null;
      INS.hrange = JSON.parse(F.hr); const on = new Set(F.on);
      (INS.chg || []).forEach(r => { if (!r.t) r.on = on.has(r.id) ? true : (r.on === true ? false : r.on); });
      insSave(); histLog("DÉLAIS", "FILTRE DU JOUR ENLEVÉ", ""); dlyXKeep(); refreshAll(); dlyXBack();
    };
    /* courbe (ou haut de barre) près du doigt, ce jour-là */
    const dlyXNear = (host, h, cx, cy) => {
      const HV = host.__HV || {}, S = dlyXSeries(host, host.__HD || {}, HV), hr = h.getBoundingClientRect(), Y0 = Number(h.dataset.y0) || hr.height, sc = Number(h.dataset.sc) || 1;
      const di = sviIsoAdd(host.__d0, Math.max(0, Math.floor((cx - hr.left) / ECR.DLY_DW))), RG = dlyHRange();
      if ((RG.a && di < RG.a) || (RG.b && di > RG.b)) return false;
      return S.some(x => { const v = x.M[di]; return v !== undefined && v !== null && Math.abs(hr.top + Y0 - v * (x.s || sc) - cy) < 40; });
    };
    /* v566 (remarque 8) / v611 : repères posés — toucher le point = courbe suivante, appui long sur le point = FILTRE DU JOUR ;
       toucher une courbe = le point s'y déplace ; toucher le graphique hors des courbes = repères et filtre enlevés ;
       toucher ailleurs = repères enlevés (le filtre reste) */
    document.addEventListener("pointerdown", e => {
      /* v628 : barre choisie (HISTOGRAMME) — toucher ailleurs la libère ; dans le graphique hors des barres : filtre du jour enlevé aussi */
      if (shell.__dlyBarSel && !(e.target.closest && e.target.closest(".dlyg-foot .ghb[data-d], #dlyHb"))) {
        /* v631 : un toucher n'enlève plus le filtre du jour (3e appui long, plage élargie, ⚠ ou menu ⋯) */
        shell.querySelectorAll(".dlyg-foot .ghb-sel").forEach(b => b.classList.remove("ghb-sel")); shell.__dlyBarSel = null;
      }
      const X0 = shell.__dlyX;
      if (!X0 || !document.querySelector(".dlyx-pt")) { shell.__dlyX = null; return; }
      const host = shell.querySelector("#dlyGantt"), g = shell.querySelector(".dlyg-foot .ghist");
      if (host && g && Math.abs(e.clientX - X0.px) < 30 && Math.abs(e.clientY - X0.y) < 30) {
        e.stopPropagation(); e.preventDefault();
        host.__dlyXlp = true;
        const x0 = e.clientX, y0 = e.clientY; let fired = false;
        const tm = setTimeout(() => { fired = true; if (shell.__dlyXF) dlyXUnfilter(); else dlyXFilter(sviIsoAdd(host.__d0, X0.i)); }, SVI_G.lp);
        const mv = ev => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > SVI_G.drag) { clearTimeout(tm); fin(); } };
        const fin = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", fin); setTimeout(() => { host.__dlyXlp = false; }, 450); };
        const up = () => { clearTimeout(tm); fin(); if (!fired) dlyXDraw(host, g, X0.px, X0.cy, 1); };
        /* v637 : toucher repris par l'iPad (défilement, zoom) = rien ; avant, le délai continuait et posait un FILTRE DU JOUR */
        const cancel = () => { clearTimeout(tm); fin(); };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", cancel);
        return;
      }
      const inG = e.target.closest && e.target.closest(".dlyg-foot .ghist");
      if (inG && host && !e.target.closest(".grng, .gplaf, .gcut, .grdb, .grdc, .gax-hit, .grule, .gval, .dlyg-hh")) {
        if (dlyXNear(host, inG, e.clientX, e.clientY)) {
          e.stopPropagation(); e.preventDefault();
          host.__dlyXlp = true; setTimeout(() => { host.__dlyXlp = false; }, 450);
          dlyXDraw(host, inG, e.clientX, e.clientY, 0);
          return;
        }
        dlyXClear(); shell.__dlyX = null;   /* v631 : le filtre du jour reste */
        return;
      }
      dlyXClear(); shell.__dlyX = null;
    }, true);
    shell.addEventListener("pointerdown", e => {
      /* v611 (point 3) : appui long aussi sur une barre de l'histogramme */
      const hit = e.target.closest && e.target.closest(".dlyg-foot .ghist .ghb[data-d]");
      if (!hit || shell.__dlyX) return;
      const host = shell.querySelector("#dlyGantt"), h = hit.closest(".ghist");
      let on = false; const x0 = e.clientX, y0 = e.clientY;
      const tmv = ev => { if (on) ev.preventDefault(); };
      /* v628 : HISTOGRAMME — pas de point ni de pointillés : la barre est mise en évidence et sa bulle s'ouvre ;
         un second appui long sur la même barre = FILTRE DU JOUR */
      const barMode = !(host.__HV || {}).curve && !(host.__HV || {}).hideC;
      const tm = setTimeout(() => {
        on = true; host.__dlyXlp = true;
        if (!barMode) { dlyXDraw(host, h, x0, y0, 0); return; }
        const di = hit.dataset.d;
        /* v631 : 1er appui long = barre choisie + bulle ; 2e = filtre du jour ; 3e (filtre du jour en cours) = affichage d'avant */
        if (shell.__dlyXF) { document.getElementById("dlyHb")?.remove(); shell.querySelectorAll(".dlyg-foot .ghb-sel").forEach(b => b.classList.remove("ghb-sel")); shell.__dlyBarSel = null; dlyXUnfilter(); return; }
        if (shell.__dlyBarSel === di) { document.getElementById("dlyHb")?.remove(); dlyXFilter(di); return; }
        shell.querySelectorAll(".dlyg-foot .ghb-sel").forEach(b => b.classList.remove("ghb-sel"));
        shell.__dlyBarSel = di; shell.querySelectorAll(`.dlyg-foot .ghb[data-d="${di}"]`).forEach(b => b.classList.add("ghb-sel"));
        host.__dlyXlp = false; hit.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x0, clientY: y0 })); host.__dlyXlp = true;
      }, 450);
      const mv = ev => { if (!on) { if (Math.abs(ev.clientX - x0) > 8 || Math.abs(ev.clientY - y0) > 8) end(); return; } ev.preventDefault(); if (!barMode) dlyXDraw(host, h, ev.clientX, ev.clientY, 0); };
      const end = () => { clearTimeout(tm); document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", end); document.removeEventListener("pointercancel", end); setTimeout(() => document.removeEventListener("touchmove", tmv), 0); if (on) setTimeout(() => { host.__dlyXlp = false; }, 400); };
      document.addEventListener("touchmove", tmv, { passive: false });
      document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", end); document.addEventListener("pointercancel", end);
    });
    /* v568 (remarque 12) : toucher l'axe des montants = afficher / cacher la RÈGLE ; la règle se tire au doigt (valeur affichée) */
    shell.addEventListener("click", e => {
      const a = e.target.closest && e.target.closest(".dlyg-foot .gax-hit");
      if (!a) return;
      e.stopPropagation();
      /* v584 : toucher l'axe = faire apparaître la règle (l'appui long sur la ligne la fait disparaître) */
      /* v588 : la règle apparaît (ou se pose) à la hauteur touchée */
      const h = a.closest(".ghist"), sc = Number(h.dataset.sc) || 1, Y0 = Number(h.dataset.y0) || h.offsetHeight;
      shell.__dlyRule = true; shell.__dlyRuleV = (Y0 - (e.clientY - h.getBoundingClientRect().top)) / sc;
      const host = shell.querySelector("#dlyGantt"); host.__drawn = false; dlyGanttDraw();
    }, true);
    shell.addEventListener("pointerdown", e => {
      const ln = e.target.closest && e.target.closest(".dlyg-foot .grule");
      if (!ln) return;
      e.preventDefault(); e.stopPropagation();
      const h = ln.closest(".ghist"), sc = Number(h.dataset.sc) || 1, Y0 = Number(h.dataset.y0) || h.offsetHeight, sp = ln.querySelector("span");
      const fmt = v => { const a = Math.abs(v), f = (x, u) => (Math.round(x * 10) / 10).toLocaleString("fr-FR") + " " + u; return a >= 1e9 ? f(v / 1e9, "G") : a >= 1e6 ? f(v / 1e6, "M") : a >= 1e4 ? f(v / 1e3, "K") : (Math.round(v * 100) / 100).toLocaleString("fr-FR"); };
      const tmv = ev => ev.preventDefault();
      document.addEventListener("touchmove", tmv, { passive: false });
      /* v577 (remarque 6) : la règle s'aimante sur les valeurs rondes (10 K, 11 K, 12 K…) : petit arrêt ; en continuant à tirer, elle se détache */
      const stp = Number(h.dataset.stp) || 0, p10 = stp ? Math.pow(10, Math.floor(Math.log10(stp))) : 0, fine = p10 ? (stp / p10 <= 1.0001 ? p10 / 10 : p10) : 0;
      const x0 = e.clientX, y0 = e.clientY;
      const lp = setTimeout(() => { up(); shell.__dlyRule = false; shell.__dlyRuleV = null; const host = shell.querySelector("#dlyGantt"); if (host) { host.__drawn = false; dlyGanttDraw(); } }, SVI_G.lp);
      const mv = ev => { ev.preventDefault(); if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return; clearTimeout(lp); let y = Math.max(4, Math.min(Y0, ev.clientY - h.getBoundingClientRect().top)); let v = (Y0 - y) / sc;
        let snap = false;
        if (fine > 0) { const r = Math.round(v / fine) * fine, yr = Y0 - r * sc; if (Math.abs(yr - y) <= 7) { v = r; y = yr; snap = true; } }
        shell.__dlyRuleV = v; ln.style.top = y + "px"; sp.textContent = fmt(v); ln.classList.toggle("grule-snap", snap); };
      const up = () => { clearTimeout(lp); document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up); setTimeout(() => document.removeEventListener("touchmove", tmv), 0); };
      document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
    });
    /* v604 (remarque longue 4) : barre RENDEMENT — glisser = régler (entre MIN et MAX, au % près ; recompression au lâcher) ;
       appui long sans bouger = couper à ce jour ; toucher le « / » = supprimer la coupe */
    shell.addEventListener("click", e => { const c = e.target.closest && e.target.closest(".dlyg-foot .grdc[data-i]"); const X = shell.__insDly; if (!c || !X) return; e.stopPropagation(); X.rdDel(c.dataset.sk, c.dataset.sec, Number(c.dataset.i)); }, true);
    shell.addEventListener("pointerdown", e => {
      const X = shell.__insDly, bar = e.target.closest && e.target.closest(".dlyg-foot .grdb");
      if (!X || !bar || e.target.closest(".grdc")) return;
      e.preventDefault(); e.stopPropagation();
      const h = bar.closest(".ghist"), host = shell.querySelector("#dlyGantt"), Y0 = Number(h.dataset.y0) || h.offsetHeight, s = Number(bar.dataset.s) || 1, ref = Number(bar.dataset.ref) || 1;
      const L = X.rdLim(), sp = bar.querySelector(".grdb-v"), byV = !!bar.dataset.sec, x0 = e.clientX, y0 = e.clientY, p0 = Number(bar.dataset.pct) || 100;
      let p = p0, moved = false;
      const tmv = ev => ev.preventDefault();
      document.addEventListener("touchmove", tmv, { passive: false });
      const lp = setTimeout(() => { if (moved) return; done(); const hr = h.getBoundingClientRect(); X.rdCut(bar.dataset.sk, bar.dataset.sec, sviIsoAdd(host.__d0, Math.max(0, Math.floor((x0 - hr.left) / ECR.DLY_DW)))); }, SVI_G.lp);
      const mv = ev => {
        if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < SVI_G.drag) return;
        moved = true; clearTimeout(lp); ev.preventDefault();
        const y = ev.clientY - h.getBoundingClientRect().top;
        p = Math.max(L.min, Math.min(L.max, Math.round((Y0 - y) / s / ref * 100)));
        bar.style.top = Math.max(26, Math.min(h.offsetHeight, Y0 - ref * p / 100 * s)) + "px";
        sp.textContent = "RENDEMENT " + (byV ? (Math.round(ref * p) / 100).toLocaleString("fr-FR") + " / J-H" : p + " %") + (p > 100 ? " — HEURES SUP " + (Math.round((p - 100) * 8) / 100).toLocaleString("fr-FR") + " H / J" : "");
      };
      const done = () => { clearTimeout(lp); document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up); setTimeout(() => document.removeEventListener("touchmove", tmv), 0); };
      const up = () => { done(); if (moved && p !== p0) X.rdSet(bar.dataset.sk, bar.dataset.sec, Number(bar.dataset.seg) || 0, p); };
      document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
    });
    /* R8 : toucher une barre de l'histogramme = bulle des tâches de ce jour (répartition, fractions comprises) */
    shell.addEventListener("click", e => {
      { const hh = e.target.closest && e.target.closest("#dlyGantt, .dlyg-foot") && shell.querySelector("#dlyGantt"); if (hh && hh.__dlyXlp) return; }   /* v564 : pas de bulle après un appui long (repères) */
      const b = e.target.closest && e.target.closest(".dlyg-foot .ghb[data-d]");
      document.getElementById("dlyHb")?.remove();
      if (!b) return;
      const host = shell.querySelector("#dlyGantt"), H = host && host.__HD, di = b.dataset.d;
      if (!H) return;
      const fmt = v => (Math.round(v * 100) / 100).toLocaleString("fr-FR");
      let rows = "", tot = 0;
      const HV = host.__HV || {};
      if (HV.cum || HV.multi) {
        /* v546 (R15, R29) : en CUMULÉ, la date et le total à ce jour ; avec PRODUITS / MARGE, une ligne par grandeur */
        const m = document.createElement("div"); m.id = "dlyHb";
        const L = [[H.cmd ? "COMMANDES" : "CHARGES", HV.val], ["PRODUITS", HV.vP], ["MARGE", HV.vG]].filter(x => x[1] && Object.keys(x[1]).length && (x[0] !== "PRODUITS" && x[0] !== "MARGE" ? !HV.hideC && (!HV.multi || (H.crb || []).includes("c")) : (H.crb || []).includes(x[0] === "PRODUITS" ? "p" : "g")));
        m.innerHTML = `<button type="button" class="svt-x" aria-label="Fermer">✕</button><div class="hb-t">${esc(dFr(di))}${HV.cum ? " — CUMUL À CE JOUR" : ""}</div>` + L.map(([t, M]) => `<div><span>${t}</span><b>${fmt(M[di] || 0)} ${esc(HV.unit)}</b></div>`).join("") + dlyRdHb(HV, di) + dlyGoHb(H, di);
        document.body.appendChild(m);
        const r = b.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
        m.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.left + r.width / 2 - mw / 2)) + "px"; m.style.top = Math.max(8, Math.min(r.top, e.clientY) - mh - 6) + "px";
        m.addEventListener("click", ev => { if (ev.target.closest(".svt-x")) m.remove(); ev.stopPropagation(); });
        return;
      }
      let ext = "";
      if (H.cmd) { const C = H.cmd, pr = (C.per || {})[di]; tot = C.L[di] || 0; rows = `<div>${esc(C.lab)}</div>` + (pr ? `<div><span>COMMANDE DU ${esc(dFr(di).slice(0, 5))}</span><b>COUVRE DU ${esc(dFr(pr.a).slice(0, 5))} AU ${esc(dFr(pr.b).slice(0, 5))}</b></div>` : "") + (C.det[di] || []).map(x => `<div><span>${esc(x.sk.split("|")[0])}</span><b>${fmt(x.v)}</b></div>`).join("");
        /* v605 (remarque longue 5) : PRODUITS et MARGE de la période */
        if (HV.cPG) { if ((H.crb || []).includes("p")) ext += `<div class="hb-tot"><span>PRODUITS (DH)</span><b>${fmt((C.P || {})[di] || 0)}</b></div>`; if ((H.crb || []).includes("g")) { const g = (C.G || {})[di] || 0; ext += `<div class="hb-tot${g < 0 ? " hb-neg" : ""}"><span>MARGE (DH)</span><b>${fmt(g)}</b></div>`; } } }
      else (H.det[di] || []).forEach(x => { tot += x.v; rows += `<div><span>${esc(lotLab(dlyLotPath(lkName("lot", x.k.split("|")[0]))).full)} › ${esc(lkName("sec", x.k.split("|")[1]))}${x.inc ? " ▣" : ""}</span><b>${fmt(x.v)}</b></div>`; });
      const m = document.createElement("div");
      m.id = "dlyHb";
      m.innerHTML = `<button type="button" class="svt-x" aria-label="Fermer">✕</button><div class="hb-t">${esc(dFr(di))}</div>${rows}<div class="hb-tot"><span>TOTAL (${esc(H.cmd ? "COMMANDE" : H.unit)})</span><b>${fmt(tot)}</b></div>${ext}${HV.hsup && HV.hsup[di] ? `<div class="hb-hs"><span>HEURES SUP (RENDEMENT RÉGLÉ)</span><b>${fmt(HV.hsup[di])} H</b></div>` : ""}${dlyRdHb(HV, di)}${H.cmd ? "" : dlyGoHb(H, di)}`;
      document.body.appendChild(m);
      const r = b.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
      m.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.left + r.width / 2 - mw / 2)) + "px";
      m.style.top = Math.max(8, r.top - mh - 6) + "px";
      m.addEventListener("click", ev => { if (ev.target.closest(".svt-x")) m.remove(); ev.stopPropagation(); });
    });
    /* v567 (remarque 10) : bulle — rendement du jour, et pour chaque tâche du jour : CHARGES / PRODUITS / DÉLAIS
       (la tâche est choisie par les ronds, l'onglet s'ouvre sur ses lignes surlignées) */
    const dlyRdHb = (HV, di) => { const R = HV && HV.rd; if (!R) return ""; const f = v => (Math.round(v * 100) / 100).toLocaleString("fr-FR");
      return `<div class="hb-rd"><span>PRODUIT</span><b>${f(R.PQ[di] || 0)} ${esc(R.u)}</b></div>` + (R.S || []).map(s => `<div class="hb-rd" style="color:${s.c}"><span>RENDEMENT ${esc(s.name)}</span><b>${s.R[di] === null || s.R[di] === undefined ? "—" : f(s.R[di]) + " " + esc(R.u) + " / " + esc(s.u)}</b></div>`).join(""); };
    /* v574 : nom de la tâche pris dans la ligne du PLANNING (lot et activité tels qu'affichés), sinon dans les listes */
    const dlyHbName = k => { const x = (shell.__dlyRows || []).find(r => !r.grp && r.key === k); if (x && (x.lot || x.sec)) return (x.lot ? lotLab(dlyLotPath(x.lot)).full : "") + " › " + (x.sec || ""); const [lo, se] = k.split("|"); return (lkName("lot", lo) || lo) + " › " + (lkName("sec", se) || se); };
    const dlyGoHb = (H, di) => { const K = [...new Set((H.det && H.det[di] || []).map(x => x.k))]; if (!K.length) return "";
      return `<div class="hb-gos">` + K.map(k => `<div class="hb-go"><span>${esc(dlyHbName(k))}</span>${[["chg", "CHARGES"], ["prd", "PRODUITS"], ["dly", "DÉLAIS"]].map(([t, l]) => `<button type="button" class="hb-gob" data-go="${t}" data-k="${esc(k)}">${l}</button>`).join("")}</div>`).join("") + `</div>`; };
    document.addEventListener("click", e => {
      const b = e.target.closest && e.target.closest("#dlyHb .hb-gob[data-go]");
      if (!b) return;
      e.stopPropagation(); document.getElementById("dlyHb")?.remove();
      /* v610 : les boutons cochent les cases carrées (filtres) de la tâche, jamais les ronds (liaisons) ; la liste de l'onglet ouvert
         descend jusqu'à la première ligne cochée */
      const k = b.dataset.k, [lo, se] = k.split("|"), go = b.dataset.go, L = (INS.links || []).filter(l => l.lot === lo && l.sec === se);
      if (go === "chg" || go === "prd") {
        /* v615 : CHARGES = seulement les charges de la tâche qui sont dans la barre touchée (celles du graphique) */
        const HR = go === "chg" ? (((shell.querySelector("#dlyGantt") || {}).__HD || {}).R || null) : null, inBar = HR ? new Set(HR.map(r => r.id)) : null;
        const ids = new Set(); L.forEach(l => (l[go] || []).forEach(y => { if (!inBar || inBar.has(y.id)) ids.add(y.id); }));
        (INS[go] || []).forEach(r => { if (!r.t) r.on = ids.has(r.id) ? true : (r.on === true ? false : r.on); });
        insSave(); histLog("DÉLAIS", "CASES COCHÉES", (go === "chg" ? "CHARGES" : "PRODUITS") + " DE " + dlyHbName(k));
      } else shell.__dlySel = new Set([k]);
      const tb = document.querySelector(`.bdg-d-tab[data-tab="${b.dataset.go}"]`);
      if (tb && ECR.active !== b.dataset.go) tb.click(); else refreshAll();
      setTimeout(() => { const c = document.querySelector("#bdgTabBody tr input.ins-cb:checked, #bdgTabBody tr input.dlyp-cb[data-key]:checked"), r = c && c.closest("tr"); if (r) r.scrollIntoView({ block: "center" }); }, 350);
    }, true);
    document.addEventListener("pointerdown", e => { const m = document.getElementById("dlyHb"); if (m && !m.contains(e.target) && !(e.target.closest && e.target.closest(".ghb"))) m.remove(); }, true);
    /* R3 : signe ▣ d'une tâche incompressible = fenêtre RENDRE COMPRESSIBLE */
    shell.addEventListener("click", e => { const b = e.target.closest && e.target.closest(".dlyg-l .dly-inc[data-key]"); const X = shell.__insDly; if (!b || !X) return; e.stopPropagation(); X.incWin(b.dataset.key); }, true);
    /* R12, R13 : poignée « = » entre le Gantt et l'histogramme — toucher = d'un bord à l'autre (miniaturisé en bas ↔ plein écran) ;
       glisser = hauteur choisie (mémorisée) */
    shell.addEventListener("pointerdown", e => {
      const X = shell.__insDly;
      const pill = e.target.closest && e.target.closest(".dlyg-hh .dlyhh-pill");
      if (!X || !pill) return;
      e.preventDefault(); e.stopPropagation();
      /* v594 (remarque longue 2) : la poignée est en haut du pied fixe ; glisser = hauteur du pied (le graphique), suivie au doigt */
      const ft = pill.closest(".dlyg-foot"), bar = pill.closest(".dlyg-hh"), y0 = e.clientY;
      const scr = shell.querySelector("#bdgTabBody > .dly-scroll"), thH = (shell.querySelector(".dlyg-l thead") || shell.querySelector("#dlyGantt > .gh") || { offsetHeight: 34 }).offsetHeight;
      const tot = scr ? (scr.__capMax || scr.offsetHeight + (ft ? ft.offsetHeight : 0)) : 600;
      const maxH = Math.max(80, tot - thH - 2), h0 = Math.min(maxH, ft ? ft.offsetHeight : 110);
      let h = h0, on = false;
      try { pill.setPointerCapture(e.pointerId); } catch (err) {}
      const tmv = ev => ev.preventDefault();
      document.addEventListener("touchmove", tmv, { passive: false });
      /* tout mouvement compte comme un glissement ; seul un toucher net bascule d'un bord à l'autre */
      const mv = ev => { const dy = ev.clientY - y0; if (!on && !dy) return; on = true; ev.preventDefault(); h = Math.round(Math.max(0, Math.min(maxH, h0 - dy))); bar.style.transform = "translateY(" + (h0 - h) + "px)"; };
      const up = () => {
        document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
        setTimeout(() => document.removeEventListener("touchmove", tmv), 0);
        /* v546 (R25) : en bas = histogramme entièrement caché (0) */
        if (!on) { X.hh(X.hhGet() === "full" ? 0 : "full"); return; }
        X.hh(h >= maxH ? "full" : h <= 30 ? 0 : h);
      };
      document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
    });
    /* FORMAT 91 : largeur des jours — glisser horizontalement sur l'en-tête, ou pincer le Gantt ;
       le jour sous le doigt reste en place ; largeur mémorisée ; un toucher simple ouvre toujours le calendrier */
    const dlyDwSet = (host, w, ax, p) => {
      w = Math.max(ECR.DLY_DW_MIN, Math.min(ECR.DLY_DW_MAX, Math.round(w * 10) / 10));   /* v657 : au dixième de pixel (la plage remplit exactement l'écran) */
      if (Math.abs(w - ECR.DLY_DW) < 0.05) return;
      try { localStorage.setItem(DLY_SC[dlyScale()].k, ECR.DLY_FILL && w <= ECR.DLY_FILL + 0.01 ? "fit" : String(w)); } catch (e) {}   /* v559 : réduit au maximum = ajusté à l'écran */
      host.__drawn = false; dlyGanttDraw();
      const h2 = shell.querySelector("#dlyGantt");
      if (h2) { h2.scrollLeft = Math.max(0, p * w - ax); shell.__dlyGx = h2.scrollLeft; shell.__dlyFitT = performance.now(); }
      requestAnimationFrame(() => { try { dlyRngEdge(); } catch (e) {} });   /* v657 : traits au repos replacés au bord visible après l'ajustement */
      let lab = document.getElementById("dlyDwLab");
      if (!lab) { lab = document.createElement("div"); lab.id = "dlyDwLab"; document.body.appendChild(lab); }
      const r = (h2 || host).getBoundingClientRect();
      lab.textContent = "1 JOUR = " + Math.round(w * 10) / 10 + " PX";
      lab.style.left = (r.left + ax) + "px"; lab.style.top = (r.top + 4) + "px";
      clearTimeout(lab.__tm); lab.__tm = setTimeout(() => lab.remove(), 900);
    };
    shell.__dlyDwSet = dlyDwSet;   /* v628 : ajustement à l'ouverture (17-3) */
    shell.addEventListener("pointerdown", e => {
      const gh = e.target.closest && e.target.closest("#dlyGantt .gh");
      if (!gh || e.button > 0 || shell.__dlyPinch) return;
      const host = gh.closest("#dlyGantt"), hr = host.getBoundingClientRect();
      const x0 = e.clientX, y0 = e.clientY, w0 = ECR.DLY_DW, ax = x0 - hr.left, p = (ax + host.scrollLeft) / w0;
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
        const host = e.target.closest && e.target.closest("#dlyGantt, .dlyg-foot, .dlyg-l") && shell.querySelector("#dlyGantt");   /* v594 : graphique dans le pied fixe ; v610 : tableau aussi (pincement vertical seulement) */
        if (!host || e.touches.length !== 2) return;
        const hr = host.getBoundingClientRect(), mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - hr.left;
        /* écarter à l'horizontale = largeur des jours ; à la verticale = hauteur des lignes et des barres (sens choisi au premier mouvement) */
        P0 = { y1: e.touches[0].clientY, y2: e.touches[1].clientY, t0: Date.now(), host, d: Math.max(20, dist(e.touches)), dy: Math.max(20, distY(e.touches)), rh0: dlyRhGet(), mode: "", rx: dist(e.touches), ry: distY(e.touches), w0: ECR.DLY_DW, ax: mx, p: (mx + host.scrollLeft) / ECR.DLY_DW };
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
          if (P0.z0 === undefined) {
            P0.z0 = shell.__dlyYZ || 1;
            /* v582 : la valeur entre les deux doigts au début du pincement reste à la même hauteur */
            const gh = P0.tg.closest(".ghist"), r = gh.getBoundingClientRect();
            P0.my = (P0.y1 + P0.y2) / 2 - r.top;
            P0.vm = ((+gh.dataset.y0 || 0) - P0.my) / (+gh.dataset.sc || 1);
          }
          const z = Math.max(1, Math.min(50, P0.z0 * Math.max(20, distY(e.touches)) / P0.dy));
          if (Math.abs(z - (shell.__dlyYZ || 1)) > 0.02) { shell.__dlyYZ = z;
            const G = shell.__dlyYGeo;
            if (G) { const tp = G.RG / z, sc2 = (G.HH - 44 - G.IB) / tp, y0b = G.HH - G.IB - 8 - Math.min(-G.mn, tp) * sc2;
              shell.__dlyYO = z > 1.01 ? Math.max(0, Math.min(G.RG - tp, (P0.my + P0.vm * sc2 - y0b) / sc2)) : 0; } clearTimeout(P0.ht); P0.ht = setTimeout(() => { const H = shell.querySelector("#dlyGantt"); if (H) { H.__drawn = false; dlyGanttDraw(); } }, 30); }
          return;
        }
        if (P0.mode === "h" && P0.tg && P0.tg.closest && P0.tg.closest(".dlyg-l")) return;
        if (P0.mode === "v") {
          const rh = Math.round(Math.max(SVI_G.ganttMin, Math.min(SVI_G.ganttMax, P0.rh0 * Math.pow(Math.max(20, distY(e.touches)) / P0.dy, SVI_G.pinch))));   /* v785 : réglage commun (24 à 80 px) */
          if (rh !== dlyRhGet()) { try { localStorage.setItem(DLY_RH_KEY, String(rh)); } catch (err) {} dlyRhApply(rh); }
          return;
        }
        const w = P0.w0 * Math.pow(Math.max(20, dist(e.touches)) / P0.d, SVI_G.pinch);
        dlyDwSet(shell.querySelector("#dlyGantt") || P0.host, w, P0.ax, P0.p);
      };
      shell.addEventListener("touchmove", pmv, { passive: false });
      const end = e => { if (!P0 || (e.touches && e.touches.length >= 2)) return; const tg = P0.tg; if (tg) { tg.removeEventListener("touchmove", pmv); tg.removeEventListener("touchend", end); tg.removeEventListener("touchcancel", end); }
        /* v451 : les deux doigts ne servent qu'au pincement (le tableau ne revient que par la poignée) */
        P0 = null; setTimeout(() => { shell.__dlyPinch = false; }, 50);
      };
      shell.addEventListener("touchend", end); shell.addEventListener("touchcancel", end);
      /* v929 (remarque 16 du 04/11/2026, document unique 9.4) : SUR ORDINATEUR — pincement du trackpad ou Ctrl / Cmd + molette = hauteur des lignes
         (24 à 80 px) ; Option + molette = échelle du temps (Gantt et graphique) ; le zoom de la page est bloqué sur ces zones ; boutons + / − dans les réglages */
      const zRh = f => { const rh = Math.round(Math.max(SVI_G.ganttMin, Math.min(SVI_G.ganttMax, dlyRhGet() * f))); if (rh !== dlyRhGet()) { try { localStorage.setItem(DLY_RH_KEY, String(rh)); } catch (err) {} dlyRhApply(rh); } return rh; };
      const zDw = (f, cx) => { const host = shell.querySelector("#dlyGantt"); if (!host) return; const hr = host.getBoundingClientRect(), ax = cx === undefined ? host.clientWidth / 2 : Math.max(0, cx - hr.left);
        dlyDwSet(host, ECR.DLY_DW * f, ax, (ax + host.scrollLeft) / ECR.DLY_DW); };
      shell.__dlyZoom = { rh: zRh, dw: zDw };
      const zZone = t => t && t.closest && t.closest("#dlyGantt, .dlyg-foot, .dlyg-l");
      shell.addEventListener("wheel", e => {
        if (!zZone(e.target) || !(e.ctrlKey || e.metaKey || e.altKey)) return;
        e.preventDefault();
        const f = Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.01 * (SVI_G.pinch || 1));
        if (e.altKey) zDw(f, e.clientX); else zRh(f);
      }, { passive: false });
      let G0 = 0;
      shell.addEventListener("gesturestart", e => { if (!zZone(e.target)) return; e.preventDefault(); G0 = dlyRhGet(); }, { passive: false });
      shell.addEventListener("gesturechange", e => { if (!zZone(e.target) || !G0) return; e.preventDefault(); zRh(G0 * e.scale / dlyRhGet()); }, { passive: false });
      shell.addEventListener("gestureend", () => { G0 = 0; });
      /* v582 : graphique zoomé — un doigt à la verticale fait monter ou descendre l'échelle (le sens dominant du geste décide) ;
         double toucher = échelle entière */
      const yRedraw = () => { if (shell.__dlyYRaf) return; shell.__dlyYRaf = requestAnimationFrame(() => { shell.__dlyYRaf = 0; const H = shell.querySelector("#dlyGantt"); if (H) { H.__drawn = false; dlyGanttDraw(); } }); };
      /* v628 : double toucher = échelle entière ET ajustement à l'écran (comme à l'ouverture) */
      const yFull = () => { document.getElementById("dlyHb")?.remove(); shell.__dlyYZ = 1; shell.__dlyYO = 0; shell.__dlyCenter = true; yRedraw(); };
      let V = null, lastTap = null;
      const NOV = ".gplaf, .gcut, .grng, .grng-g, .grng-h, .grule, .gax-hit, .gval, .dlyg-hh, .grdb, .grdc";
      shell.addEventListener("touchstart", e => {
        V = null;
        const gh = e.target.closest && e.target.closest(".dlyg-foot .ghist");
        if (!gh || e.touches.length !== 1) return;
        const t = e.touches[0];
        V = { x: t.clientX, y: t.clientY, t: Date.now(), gh, zoom: (shell.__dlyYZ || 1) > 1.01 && !e.target.closest(NOV), mode: "", yo: shell.__dlyYO || 0, sc: +gh.dataset.sc || 1, mv: false };
        if (V.zoom) { const tg = e.target; V.tg = tg; tg.addEventListener("touchmove", vmv, { passive: false }); }
      }, { capture: true, passive: true });
      const vmv = e => {
        if (!V || e.touches.length !== 1 || e.__sviV) return;
        e.__sviV = true;
        const t = e.touches[0], dx = t.clientX - V.x, dy = t.clientY - V.y;
        if (Math.hypot(dx, dy) > SVI_G.drag) V.mv = true;
        if (!V.zoom || shell.__dlyPinch) return;
        if (!V.mode) { if (Math.max(Math.abs(dx), Math.abs(dy)) < SVI_G.drag) { e.preventDefault(); return; } V.mode = Math.abs(dy) > Math.abs(dx) ? "v" : "h"; }
        if (V.mode !== "v") return;
        e.preventDefault(); e.stopPropagation();
        shell.__dlyYO = Math.max(0, V.yo + dy / V.sc);
        yRedraw();
      };
      shell.addEventListener("touchmove", e => { if (V) { const t = e.touches[0]; if (t && Math.hypot(t.clientX - V.x, t.clientY - V.y) > 6) V.mv = true; if (V.zoom) vmv(e); } }, { capture: true, passive: false });
      shell.addEventListener("touchend", e => {
        if (!V) return;
        if (V.tg) V.tg.removeEventListener("touchmove", vmv);
        const tap = !V.mv && Date.now() - V.t < SVI_G.dbl && !e.touches.length, x = V.x, y = V.y;
        V = null;
        if (!tap) { lastTap = null; return; }
        if (lastTap && Date.now() - lastTap.t < SVI_G.dbl && Math.hypot(x - lastTap.x, y - lastTap.y) < 30) { lastTap = null; setTimeout(yFull, 0); return; }
        lastTap = { t: Date.now(), x, y };
      }, { capture: true, passive: true });
      shell.addEventListener("dblclick", e => { if (e.target.closest && e.target.closest(".dlyg-foot .ghist") && !e.target.closest(NOV)) yFull(); });
    }
    /* v461 : appui long sur le NOM d'un lot ou d'un niveau sur le Gantt = son menu (ISOLER) */
    shell.addEventListener("pointerdown", e => {
      const X = shell.__insDly;
      const gn = e.target.closest && e.target.closest("#dlyGantt .gb-grp[data-path]");
      if (!X || !gn || e.button > 0) return;
      const x0 = e.clientX, y0 = e.clientY;
      const t = setTimeout(() => { shell.__dlyGLong = Date.now(); X.grpMenu(gn.dataset.path, gn); }, SVI_G.lp);
      const mv = ev => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > SVI_G.drag) stop(); };
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
      const t = setTimeout(() => { if (mode) return; mode = "vert"; els.forEach(b => b.classList.add("gb-lift")); document.body.classList.add("svi-dragging"); }, SVI_G.lp);
      const tmv = ev => { if (mode) ev.preventDefault(); };
      document.addEventListener("touchmove", tmv, { passive: false });
      const mv = ev => {
        if (shell.__dlyPinch) { clearTimeout(t); return; }
        const dx = ev.clientX - x0;
        if (mode === "vert") { ev.preventDefault(); if (!gfar && Math.hypot(dx, ev.clientY - y0) < 10) return; if (X.view() === "d") { if (!gfar) svToast("VUE PAR DÉBUT : PASSER EN VUE PAR LOT POUR DÉPLACER.", 3000, gb); gfar = true; hit = null; return; } gfar = true; shell.__dlySrcG = window.__sviDlySrcG = true; hit = g ? dlyGrpHit(ev, path, g.lvl, x0) : null; dlyGrpShow(hit); return; }
        if (!mode && Math.abs(dx) > SVI_G.drag) { mode = "time"; clearTimeout(t); moving.forEach(b => { b.__l0 = b.offsetLeft; b.classList.add("gb-drag"); }); }
        if (mode !== "time") return;
        ev.preventDefault();
        days = Math.round(dx / ECR.DLY_DW);
        moving.forEach(b => { b.style.left = (b.__l0 + days * ECR.DLY_DW) + "px"; });
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
      let moved = false, link = false, days = 0, vert = false, hitV = null, vmv = false;
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
        if (vert && !vmv && Math.abs(dy) <= SVI_G.drag) return;   /* v900 : appui long sans glisser = menu INCOMPRESSIBLE (au lâcher) */
        if (vert) { vmv = true; shell.__dlySrcG = window.__sviDlySrcG = true; hitV = dlyTaskHit(ev, null, key, x0); if (!hitV) document.getElementById("roLine")?.remove(); return; }
        if (!moved && Math.abs(dx) > SVI_G.drag) {
          /* v900 : tâche INCOMPRESSIBLE — son bout ne se tire pas (durée bloquée), refusé tout de suite */
          if (mode === "end" && X.isInc && X.isInc(key)) { clearTimeout(t); document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
            svToast("TÂCHE INCOMPRESSIBLE : SA DURÉE EST BLOQUÉE. APPUI LONG SUR SA BARRE → RENDRE COMPRESSIBLE.", 3500, bar); return; }
          moved = true; clearTimeout(t); bar.classList.add("gb-drag"); }
        if (!moved) return;
        days = Math.round(dx / ECR.DLY_DW);
        if (mode === "end") bar.style.width = Math.max(ECR.DLY_DW - 1, W0 + days * ECR.DLY_DW) + "px";
        else bar.style.left = (L0 + days * ECR.DLY_DW) + "px";
      };
      const up = ev => {
        clearTimeout(t);
        document.removeEventListener("pointermove", mv);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        bar.classList.remove("gb-link", "gb-drag", "gb-lift");
        host.querySelectorAll(".gb.gb-tgt").forEach(b => b.classList.remove("gb-tgt", "gb-ts", "gb-te"));
        if (shell.__dlyPinch || shell.__dlyPinched) { shell.__dlyPinched = false; tmp.innerHTML = ""; document.getElementById("roLine")?.remove(); return; }
        if (vert && !vmv) { document.getElementById("roLine")?.remove(); if (X.incWin) X.incWin(key); return; }
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
}
