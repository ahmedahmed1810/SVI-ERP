    /* ===== GÉNÉRER LE PLANNING, MAIN D'ŒUVRE, NIVELLEMENT (v403) ===== */
    /* une charge de main d'œuvre : unité en journées-homme (JH, J/H, JOUR…) ou en heures (H, comptées 8 par jour),
       ou désignation « MAIN D'ŒUVRE … » (sous-traitance comprise) */
    /* v547 (R22) : per = morceaux datés de la tâche (un seul le plus souvent) */
    const dlyCurDates = () => { const D = {}; dlyKeys().forEach(k => { const d = dlyDeb(k), f = dlyFin(k), L = dlyList(k); if (d && f) D[k] = { deb: d, fin: f, hs: L.length === 1 && dlyHalfS(L[0]), he: L.length === 1 && dlyHalfE(L[0]),
      per: L.filter(p => p.deb && p.fin).map(p => ({ deb: p.deb, fin: p.fin, hs: dlyHalfS(p), he: dlyHalfE(p) })) }; }); return D; };
    /* périodes affichées : brouillon en cours (à valider) ou périodes validées */
    const insDlyList = key => (LK.dlpDraft && LK.dlpDraft[key]) || (INS.dlp || {})[key] || [];
    /* v454 : dates saisies dans le PLANNING (ou sur le Gantt) enregistrées aussitôt (annulables par ↶) */
    const dlyCommitDrafts = () => {
      if (!INS_EDIT || !LK.dlpDraft) return;
      let ch = false;
      Object.keys(LK.dlpDraft).forEach(k => {
        /* v530 : demi-journées gardées tant que la date n'a pas changé */
        INS.dlp[k] = (LK.dlpDraft[k] || []).filter(p => p.deb || p.fin).map(p => ({ id: p.id, deb: p.deb || "", fin: p.fin || "", ...(dlyHalfS(p) ? { dmd: p.deb } : {}), ...(dlyHalfE(p) ? { fmd: p.fin } : {}) }));
        if (!INS.dlp[k].length) delete INS.dlp[k];
        delete LK.dlpDraft[k]; ch = true;
      });
      if (ch) setTimeout(() => insSave(), 0);
    };
    /* tâche choisie par les ronds (lot + activité secondaire), ou tâches de l'activité primaire choisie : surlignées */
    /* v464 : ronds pleins (désignation, lot, activités, produits, charges) → tâches des liaisons correspondantes surlignées
       dans le PLANNING (ligne et barre), les autres grisées ; null = aucun rond plein */
    const dlyPickSet = () => {
      const ch = ["des", "lot", "prim", "sec"].filter(k => LK[k]);
      const cp = Object.keys(LK.prd || {}), cc = Object.keys(LK.chg || {});
      /* v538 : rond d'un titre de lots (ou rond d'en-tête) = ses tâches surlignées dans le PLANNING */
      if (!ch.length && !cp.length && !cc.length && LK.all && LK.all.lot) return new Set(dlyKeys().filter(k => lkOn("lot", k.split("|")[0])));
      if (!ch.length && !cp.length && !cc.length) return null;
      const S = new Set();
      (INS.links || []).filter(l => ch.every(k => l[k] === LK[k]) && cp.every(id => (l.prd || []).some(x => x.id === id)) && cc.every(id => (l.chg || []).some(x => x.id === id)))
        .forEach(l => S.add(l.lot + "|" + l.sec));
      if (LK.lot && LK.sec && !LK.des && !cp.length && !cc.length) S.add(LK.lot + "|" + LK.sec);
      return S;
    };
    const dlyPicked = k => { const S = shell.__dlyPS; return !!(S && S.has(k)); };
    const dlyPickPaint = () => {
      const S = shell.__dlyPS, box = shell.querySelector(".dlyg");
      if (!box) return;
      box.classList.toggle("dly-picking", !!S);
      const R = shell.__dlyRows || [];
      box.querySelectorAll("#dlyGantt .gb[data-key], #dlyGantt .gb-n[data-key]").forEach(b => { const on = !!(S && S.has(b.dataset.key)); b.classList.toggle("gb-pick", on); b.classList.toggle("gb-dim", !!S && !on); });
      box.querySelectorAll("#dlyGantt [data-path]").forEach(b => { const g = R.find(r => r.grp && r.path === b.dataset.path); const on = !!(S && g && g.all.some(t => S.has(t.key))); b.classList.toggle("gb-dim", !!S && !on); });
      box.querySelectorAll(".dlyg-l tr.dly-grp").forEach(tr => { const g = R.find(r => r.grp && r.path === tr.dataset.path); const on = !!(S && g && g.all.some(t => S.has(t.key))); tr.classList.toggle("dly-dim", !!S && !on); });
      box.querySelectorAll(".dlyg-l tr.dly-task").forEach(tr => { const on = !!(S && S.has(tr.dataset.key)); tr.classList.toggle("dly-dim", !!S && !on); });
    };
    shell.__dlyPickPaint = dlyPickPaint;
    /* tableau caché : ouvert jusqu'à la colonne DURÉE (J) (même règle que le toucher de la pastille) */
    const dlyOpenToDur = () => {
      const g = shell.querySelector(".dlyg"), L = g && g.querySelector(".dlyg-l");
      if (!L || L.getBoundingClientRect().width > 2) return;
      const gw = g.getBoundingClientRect();
      L.style.width = Math.round(gw.width - 3) + "px"; L.style.maxWidth = "none";
      const th = [...L.querySelectorAll("thead th")].find(t => /^DURÉE/.test((t.textContent || "").trim()));
      let w = th ? Math.round(th.getBoundingClientRect().right - L.getBoundingClientRect().left + L.scrollLeft + 1) : (shell.__dlygPrevW || Math.round(gw.width * 0.55));
      w = Math.max(60, Math.min(Math.round(gw.width - 3), w));
      L.scrollLeft = 0; L.style.width = w + "px";
      shell.__dlygPrevW = w; g.classList.remove("tbl-hid");
      shell.__dlygW = { ins: INS, ref: DLYG_REF, w, auto: false };
      if (window.__sviViewSave) window.__sviViewSave();
      const host = g.querySelector("#dlyGantt"); if (host) { host.__drawn = false; dlyGanttDraw(); }
    };
    shell.__dlyOpenToDur = dlyOpenToDur;
    const dlyCellIn = (x, f) => {
      if (!INS_EDIT) return esc(f === "dur" ? x.dur : dFr(x[f]));
      /* v547 (R22) : tâche en morceaux — DÉBUT du premier, FIN du dernier (pastille du nombre de morceaux), DURÉE = somme ; un toucher = fenêtre MORCEAUX */
      if (x.per && x.per.length > 1) return `<span class="dlp-multi" data-task="${esc(x.key)}" role="button">${esc(f === "dur" ? String(x.dur) : dFr(x[f]))}${f === "fin" ? `<b class="dlp-pcn">${x.per.length}</b>` : ""}</span>`;
      const p = (insDlyList(x.key) || [])[0] || {};
      const nw = !x.deb && !x.fin;
      return `<input class="ins-in dlp-in${f === "dur" ? " number" : " center"}" data-task="${esc(x.key)}" data-pid="${esc(p.id || "")}" data-f="${f}" type="text"
        ${f === "dur" ? "" : "readonly"} inputmode="${f === "dur" ? "numeric" : "none"}" placeholder="${nw && f !== "dur" ? "SAISIR ICI…" : ""}" value="${esc(f === "dur" ? (x.dur || (shell.__dlyPendDur || {})[x.key] || "") : dFr(x[f]))}">`;
    };
    /* v748 (rapidité) : lignes du PLANNING ajoutées après le premier affichage (première ouverture d'un gros planning seulement) */
    const DLY_FIRST = 60, DLY_FIRST_MAX = 90;
    const dlyFillRest = () => {
      const rest = shell.__dlyRest; shell.__dlyRest = null; clearTimeout(shell.__dlyFillT);
      if (!rest || !rest.length) return false;
      const tb = shell.querySelector(".dlyg-l table.dly-table > tbody"), host = shell.querySelector("#dlyGantt");
      if (!tb || !host) return false;
      const tmp = document.createElement("tbody"); tmp.innerHTML = rest.join("");
      tb.append(...tmp.children);
      tb.querySelectorAll("input.dlyp-cb[data-part]").forEach(c => { c.indeterminate = true; });
      /* un seul nouveau dessin du Gantt, avec toutes les lignes (barres, liaisons, hauteur) */
      host.__drawn = false; dlyGanttDraw();
      return true;
    };
    shell.__dlyFillRest = dlyFillRest;
    const dlyFillSoon = () => {
      clearTimeout(shell.__dlyFillT);
      /* après l'affichage des premières lignes (deux images plus tard) */
      requestAnimationFrame(() => requestAnimationFrame(() => { shell.__dlyFillT = setTimeout(() => { try { dlyFillRest(); } catch (e) {} }, 0); }));
      if (!shell.__dlyFillBound) {
        shell.__dlyFillBound = true;
        /* toucher ou touche avant la fin : toutes les lignes d'abord, pour que le geste trouve sa ligne */
        const now = e => { if (shell.__dlyRest && !(e.target && e.target.closest && e.target.closest("#dlyGantt"))) { try { dlyFillRest(); } catch (err) {} } };
        shell.addEventListener("pointerdown", now, true); document.addEventListener("keydown", now, true);
      }
    };
    const insDlyHTML = (edit, err) => {
      INS.dlp = INS.dlp || {};
      if (edit) {
        /* saisie : les périodes de la tâche primaire choisie (les ronds du haut disent laquelle) */
        /* v454 : plus d'écran de saisie d'une seule tâche ni de récapitulatif — toujours le PLANNING ;
           la tâche choisie (ou les tâches de l'activité primaire choisie) y est surlignée */
        {
          dlyCommitDrafts();
          /* R15 (23/10/2026) : une tâche sans dates n'est plus mise au début du projet pour 1 jour (v457 retiré) : 0 jour, à son rang */
          /* PLANNING (FORMAT 64, 90) : tableau à gauche (lots repliables, tâches), Gantt à droite, lignes alignées */
          /* liaisons non respectées (anciennes dates, import) : corrigées à l'ouverture du planning */
          if (INS_EDIT && dlyRespect(false)) setTimeout(() => insSave(), 0);
          /* un seul ordre : la première fois, le bloc TÂCHES prend l'ordre du PLANNING */
          if (INS_EDIT && !INS.ordSyncV1 && dlyKeys().length) { INS.ordSyncV1 = true; dlyTasksFromPlan(); setTimeout(() => { insSave(); refreshAll(); }, 0); }
          shell.__dlyPS = dlyPickSet();
          const PR = dlyPlanRows();
          shell.__dlyRows = PR.rows;
          lastShown.detail = { cols: DLY_COLS_P, rows: PR.flat, kind: "dly" };
          /* v748 : hauteur des lignes posée avant l'affichage du tableau (posée au dessin, elle refaisait le style de toute la page) */
          dlyRhApply(dlyRhGet());
          requestAnimationFrame(() => dlyGanttDraw());
          const ind = n => `style="padding-left:${6 + n * 20}px"`;
          /* v538 : lots du PLANNING = mêmes ronds que les lots du bloc TÂCHES — un lot : son rond (le choisir) ;
             un titre (ou un lot qui a des sous-lots) : pastille chiffrée = toutes ses lignes, sous-titres allumés, parent à moitié */
          const dlyGrpRd = path => {
            if (!INS_EDIT) return "";
            const P = dlyLotPath(path), r = INS.lot.find(l => !l.t && U_(l.v) === U_(P.join(" / ")));
            const kids = INS.lot.some(l => !l.t && l !== r && lotUnder(l, P));
            return r && !kids ? lkRd("lot", r).replace('<span class="lk-rd', `<span data-iid="${r.id}" class="dly-grd lk-rd`) : `<span class="dly-grd">${lkRdPart("lot", P.join(" / "))}</span>`;
          };
          /* cases à cocher (FORMAT 64) : la case d'un lot coche toutes ses tâches */
          const SEL = shell.__dlySel = shell.__dlySel || new Set();
          const allK = new Set(PR.flat.map(x => x.key));
          [...SEL].forEach(k => { if (!allK.has(k)) SEL.delete(k); });
          const nm = (kind, attr, v) => `<input class="dly-nm" data-kind="${kind}" ${attr} value="${esc(v)}" autocomplete="off" enterkeyhint="next">`;
          /* dernière ligne « SAISIR ICI… » : LOT et ACTIVITÉ SECONDAIRE tapés (existants proposés, ou nouveaux) = nouvelle tâche du planning,
             sans produit ni charge, non liée (rouge dans TÂCHES) ; ses dates se saisissent aussitôt (cahier, Planning budgétaire) */
          const dl = (id, list) => `<datalist id="${id}">${list.map(v => `<option value="${esc(v)}"></option>`).join("")}</datalist>`;
          const newIn = (f, lid) => `<input class="dly-newin" data-f="${f}" list="${lid}" placeholder="${f === "lot" ? "CRÉER UNE TÂCHE ICI…" : ""}" autocomplete="off" enterkeyhint="next">`;
          /* v666 (axe 8) : en-tête BATTEMENT TOTAL ou LIBRE selon PARAMÉTRAGE DU PLANNING */
          { const cm = DLY_COLS_P.find(c => c[0] === "marge"); if (cm) cm[1] = dlyPP().bt === "l" ? "BATTEMENT LIBRE" : "BATTEMENT TOTAL"; }
          /* v748 (rapidité) : première ouverture du PLANNING dans ce budget — un gros planning n'affiche d'abord que ses premières lignes ;
             les autres sont ajoutées juste après l'affichage (dlyFillRest), ou aussitôt au premier toucher / à la première touche */
          const cutO = shell.__dlyFullOnce ? null : { cut: { first: DLY_FIRST, max: DLY_FIRST_MAX } };
          shell.__dlyFullOnce = true; shell.__dlyRest = null;
          const tbl = dlyTable(PR.rows.concat(INS_EDIT ? [{ nw: true }] : []), x => x.nw
            ? { lot: newIn("lot", "dlyLotDl"), sec: newIn("sec", "dlySecDl"), pred: "", succ: "", deb: "", fin: "", dur: "", marge: "", jal: "", __cb: "", __td_marge: " dly-calc", __td_succ: " dly-calc" }
            : x.grp
            ? { lot: `<span class="dly-lotc" ${ind(x.lvl)}>${dlyGrpRd(x.path)}<span class="dly-fold" data-path="${esc(x.path)}"><b>${x.fold ? "›" : "⌄"}</b></span>${lotNoHTML(x.lab)}${nm("grp", `data-path="${esc(x.path)}"`, x.lab.name)}</span>`, sec: "", pred: "", succ: "", __td_succ: " dly-calc",
                deb: `<b>${esc(dFr(x.deb))}</b>`, fin: `<b>${esc(dFr(x.fin))}</b>`, dur: x.dur === "" ? "" : `<b>${x.dur}</b>`, marge: "", jal: "", __td_marge: " dly-calc",
                __td_deb: " dly-calc", __td_fin: " dly-calc", __td_dur: " dly-calc",   /* v561 : dates des titres calculées = fond gris */
                __cb: `<input type="checkbox" class="dlyp-cb" data-path="${esc(x.path)}"${x.all.length && x.all.every(t => SEL.has(t.key)) ? " checked" : ""}${x.all.some(t => SEL.has(t.key)) && !x.all.every(t => SEL.has(t.key)) ? " data-part=\"1\"" : ""}>` }
            : x.ext
            ? { lot: "", sec: `<span class="dly-lotc dly-extn" ${ind(0)}>${esc(lotLab(dlyLotPath(x.lot)).full)} › ${esc(x.sec)}</span>`, pred: esc(x.pred), succ: esc(x.succ), __td_succ: " dly-calc", deb: esc(dFr(x.deb)), fin: esc(dFr(x.fin)), dur: x.dur === "" ? "" : x.dur,
                marge: x.mshow === "" || x.mshow === undefined ? "" : x.mshow, jal: x.jal ? "★" : "", __cb: "", __td_marge: " dly-calc" }
            : { lot: "", sec: `<span class="dly-lotc" ${ind(x.lvl)}>${x.away ? `<span class="dly-ldot" style="--c:${dlyLotColor(x.lo)}" title="${esc(lotLab(dlyLotPath(x.lot)).full)}"></span>` : ""}${x.vno ? `<b class="lvl-no dly-vno">${esc(x.vno)}</b><span class="dly-vsep">›</span>` : ""}${dlyIncHTML(x.key)}${INS_EDIT ? `<span class="lk-rd dly-rd${LK.lot === x.key.split("|")[0] && LK.sec === x.key.split("|")[1] ? " on" : dlyPicked(x.key) ? " lnk" : ""}" data-dkey="${esc(x.key)}" role="button" aria-label="Voir ce qui est lié à la tâche"></span>` : ""}${nm("sec", `data-sid="${esc(x.key.split("|")[1])}"`, x.sec)}</span>`, pred: `<span class="dly-pred" data-key="${esc(x.key)}">${esc(x.pred) || "<i>CHOISIR…</i>"}</span>`, succ: x.succ ? `<span class="dly-succ" data-key="${esc(x.key)}">${esc(x.succ)}</span>` : "", __td_succ: " dly-calc",
                deb: dlyCellIn(x, "deb"), fin: dlyCellIn(x, "fin"), dur: dlyCellIn(x, "dur"), marge: x.mshow === "" || x.mshow === undefined ? "" : x.mshow,
                __td_deb: (INS_EDIT ? " ins-td" : "") + ((dlyLock(x.key) || {}).deb ? " dly-lkd" : ""), __td_fin: (INS_EDIT ? " ins-td" : "") + ((dlyLock(x.key) || {}).fin ? (dlyFin(x.key) > dlyLock(x.key).fin ? " dly-lkd dly-lkx" : " dly-lkd") : ""), __td_dur: INS_EDIT ? " ins-td" : "",
                jal: `<span class="dly-jal${x.jal ? " on" : ""}" data-key="${esc(x.key)}">${x.jal ? "★" : "☆"}</span>`, __td_marge: " dly-calc",
                __cb: `<input type="checkbox" class="dlyp-cb" data-key="${esc(x.key)}"${SEL.has(x.key) ? " checked" : ""}>` },
            x => x.nw ? `class="dly-new ins-new"` : x.grp ? `class="dly-grp${x.det ? " dly-det" : ""}" data-path="${esc(x.path)}"` : `class="dly-task${x.ext ? " dly-ext" : ""}${x.off ? " dly-off" : ""}${!x.deb || !x.fin ? " dly-nod" : ""}${x.marge === 0 ? " dly-crit" : x.qc ? " dly-qcrit" : ""}${dlyPicked(x.key) ? " dly-pick" : ""}${LK.lot && LK.sec && x.key === LK.lot + "|" + LK.sec ? " dly-sel" : ""}${(INS.links || []).some(l => l.lot + "|" + l.sec === x.key) ? " dly-lnk" : ""}" data-key="${esc(x.key)}"`, true, DLY_COLS_P, cutO);
          /* FORMAT 64 / 33 : pas de ligne d'explication au-dessus du PLANNING */
          /* FORMAT 97 : commandes du planning dans le menu ⋯ du bloc détail (plus de rangée de boutons) */
          const dls = dl("dlyLotDl", [...new Set(INS.lot.filter(x => !x.t).map(x => x.v))].sort((a, b) => a.localeCompare(b, "fr")))
            + dl("dlySecDl", [...new Set(INS.sec.map(x => x.v))].sort((a, b) => a.localeCompare(b, "fr")));
          /* v561 : vue PAR DÉBUT = bandeau jaune pâle avec retour AFFICHER PAR LOT (comme ISOLER) */
          const viewB = "";   /* v594 (remarque longue 2, FORMAT 188) : plus de bandeau AFFICHÉ PAR DÉBUT — la vue se lit à la coche ✓ du menu ⋯ */
          const isoB = viewB + (PR.crit ? `<div class="dly-iso dly-critb"><span><b>CHEMIN CRITIQUE</b></span><small>TÂCHES À BATTEMENT TOTAL NUL : UN RETARD SUR L'UNE DÉCALE LA FIN DU CHANTIER</small><button type="button" class="dly-iso-x dly-crit-x">TOUT AFFICHER</button></div>` : "") + (PR.iso ? `<div class="dly-iso"><span>ISOLÉ : <b>${esc(lotLab(dlyLotPath(PR.iso)).full)}</b></span><small>LIAISONS, DÉCALAGES ET CALENDRIER RESTENT APPLIQUÉS · TÂCHES LIÉES HORS DE LA BRANCHE EN GRIS (LECTURE SEULE)</small><button type="button" class="dly-iso-x">TOUT AFFICHER</button></div>` : "");
          if (cutO && cutO.rest) { shell.__dlyRest = cutO.rest; dlyFillSoon(); }
          return dls + isoB + `<div class="dlyg${(() => { const o = shell.__dlygW; return dlygMine(o) && o.w < 3 ? " tbl-hid" : ""; })()}${dlyHHGet() === "full" ? " dly-hfull" : ""}${dlyHHGet() === 0 ? " dly-hnone" : ""}"><div class="dlyg-l"${(() => { const o = shell.__dlygW; return dlygMine(o) ? ` style="width:${o.w}px;max-width:none"` : ""; })()}>${tbl}</div><div class="dlyg-sp"><span class="dlyg-hd" title="Largeur du tableau et du Gantt"><i>=</i></span></div><div class="dlyg-r" id="dlyGantt"></div>${PR.flat.length ? `<div class="dlyg-hh"><span class="dlyhh-pill" title="Hauteur du graphique">=</span></div>` : ""}</div>`
            /* v549 : plus de bouton « + CRÉER UNE TÂCHE OU SES DÉLAIS » sous le planning (ligne SAISIR ICI… et menu ⋯) */
            ;
        }
      }
      const all = [];
      insTasks().forEach(t => {
        const ps = [...(INS.dlp[t.key] || [])].sort((a, b) => String(a.deb || "9").localeCompare(String(b.deb || "9")));
        ps.slice(0, 1).forEach(p => all.push({ task: t.key, pid: p.id, on: p.on === true, lot: t.lot, sec: t.sec, deb: p.deb || "", fin: p.fin || "",
          dur: p.deb && p.fin ? dDur(p.deb, p.fin) : "" }));
        /* mode SAISIE : seulement les périodes saisies (en mode LIAISONS) */
        if (edit && !ps.length) all.push({ task: t.key, pid: "", lot: t.lot, sec: t.sec, deb: "", fin: "", dur: "", nw: true });
      });
      /* ordre par défaut : chronologique (début), puis alphabétique */
      all.sort((a, b) => String(a.deb || "9").localeCompare(String(b.deb || "9")) || a.lot.localeCompare(b.lot, "fr") || a.sec.localeCompare(b.sec, "fr") || (a.nw - b.nw));
      const rows = cfApply("dlys", DLY_COLS_S, all);
      lastShown.detail = { cols: DLY_COLS_S, rows: rows.filter(x => !x.nw), kind: "dly" };
      const inp = (x, f) => edit
        ? `<input class="ins-in dlp-in${f === "dur" ? " number" : " center"}" data-task="${x.task}" data-pid="${x.pid}" data-f="${f}" type="text"
            ${f === "dur" ? "" : "readonly"} inputmode="${f === "dur" ? "numeric" : "none"}" placeholder="${x.nw && f === "deb" ? "SAISIR ICI…" : f === "dur" ? "" : "JJ/MM/AAAA"}" value="${esc(f === "dur" ? (x.dur || (shell.__dlyPendDur || {})[x.task] || "") : dFr(x[f]))}">`
        : esc(f === "dur" ? x.dur : dFr(x[f]));
      const td = edit ? " ins-td" : "";
      return (err ? `<div class="lk-err dlp-err">${esc(err)}</div>` : "") + dlyTable(rows, x => ({ lot: esc(x.lot), sec: esc(x.sec),
        deb: inp(x, "deb"), fin: inp(x, "fin"), dur: inp(x, "dur"),
        __td_deb: td, __td_fin: td, __td_dur: td,
        __cb: edit && x.pid ? `<input type="checkbox" class="dlp-cb" data-task="${x.task}" data-pid="${x.pid}" ${x.on ? "checked" : ""}>` : "",
        __x: "" }),
        x => `class="${x.nw ? "ins-new" : ""}"`, edit, DLY_COLS_S);
    };
    /* saisie : début + durée → fin ; fin → durée ; refus d'un chevauchement dans la même tâche */
    if (!shell.__dlyBound) {
      shell.__dlyBound = true;
      shell.addEventListener("change", e => {
        const X = shell.__insDly;
        const cb = e.target.closest && e.target.closest("input.dlp-cb, input.dlp-cball");
        if (cb && X) {
          const D = X.draft();
          const boxes = cb.classList.contains("dlp-cball") ? [...cb.closest("table").querySelectorAll("input.dlp-cb")] : [cb];
          boxes.forEach(b => { const p = (D[b.dataset.task] || []).find(x => x.id === b.dataset.pid); if (p) { p.on = cb.checked; b.checked = cb.checked; } });
          const all = cb.closest("table").querySelector("input.dlp-cball");
          const list = [...cb.closest("table").querySelectorAll("input.dlp-cb")];
          if (all) all.checked = list.length > 0 && list.every(b => b.checked);
          X.insSave();
          return;
        }
        const i = e.target.closest && e.target.closest("input.dlp-in");
        if (!i || !X) return;
        const D = X.draft();
        const task = i.dataset.task;
        const list = D[task] = D[task] || ((X.INS.dlp || {})[task] || []).map(p => ({ ...p }));
        /* une seule période par tâche (fragmentation reportée) */
        let p = list.find(x => x.id === i.dataset.pid) || list[0];
        const q = p ? { ...p } : { id: X.insId(), deb: "", fin: "" };
        const cal = X.cal(task);
        const f = i.dataset.f, v = i.value.trim();
        const durOld = q.deb && q.fin ? sviWDur(cal, q.deb, q.fin) : 0;
        X.err = "";
        if (f === "dur") {
          if (v === "") q.fin = "";
          else if (!/^\d+$/.test(v) || Number(v) < 1) X.err = "DURÉE NON VALIDE : NOMBRE DE JOURS TRAVAILLÉS ATTENDU (1 = DÉBUT ET FIN LE MÊME JOUR).";
          else if (q.deb) q.fin = sviWFin(cal, q.deb, Number(v));
          else if (q.fin) q.deb = sviWDeb(cal, q.fin, Number(v));   /* FIN + DURÉE → DÉBUT */
          else { (shell.__dlyPendDur = shell.__dlyPendDur || {})[task] = Number(v); }   /* DURÉE d'abord : gardée, la première date calculera l'autre */
        } else {
          const iso = X.dParse(v);
          if (iso === null) X.err = "DATE NON VALIDE : FORMAT JJ/MM/AAAA.";
          else if (iso && !sviWork(cal, iso)) X.err = "JOUR NON TRAVAILLÉ DANS LE CALENDRIER DU BUDGET.";
          else {
            q[f] = iso;
            const pd = (shell.__dlyPendDur || {})[task];
            if (pd && iso && !(f === "deb" ? q.fin : q.deb)) { if (f === "deb") q.fin = sviWFin(cal, iso, pd); else q.deb = sviWDeb(cal, iso, pd); }
          }
        }
        if (q.deb && q.fin && shell.__dlyPendDur) delete shell.__dlyPendDur[task];
        if (X.err) { svToast(X.err, 4000, i); X.err = ""; X.render(); return; }
        /* mêmes contrôles et même fenêtre TÂCHES SUIVANTES que le Gantt */
        if (!X.apply(task, q, { anchor: i, fromDur: f === "dur" })) return;
        /* DÉBUT, FIN, DURÉE : dès que deux valeurs sont connues, la troisième est calculée ; sinon le curseur va à celle qui manque */
        const done = q.deb && q.fin;
        /* DURÉE saisie d'abord : on touche la date de son choix (DÉBUT ou FIN), le curseur ne bouge pas */
        const nx = done || (f === "dur" && !q.deb && !q.fin) ? "" : (q.deb ? "fin" : "deb");
        const el = !done && (i.closest("#dlyAddW") || shell).querySelector(`input.dlp-in[data-task="${task}"][data-f="${nx}"]`);
        if (el) { el.focus(); try { el.select(); } catch (err) {} }
      });
      /* SUPPRIMER LES LIGNES COCHÉES (menu ⋯) : périodes cochées */
      shell.__insDlyDel = () => {
        const X = shell.__insDly;
        if (!X) return;
        const D = X.draft();
        const n = Object.values(D).reduce((t, l) => t + l.filter(p => p.on === true).length, 0);
        if (!n) return;
        svConfirm({ title: "SUPPRIMER LES DATES COCHÉES", text: "LES DATES DE " + n + " TÂCHE(S) SERONT SUPPRIMÉES.", ok: "SUPPRIMER" }).then(go => {
          if (!go) return;
          Object.keys(D).forEach(k => { D[k] = D[k].filter(p => p.on !== true); });
          X.render();
        });
      };
      shell.addEventListener("click", e => {
        const X = shell.__insDly;
        const xa = e.target.closest && e.target.closest(".dlp-xall");
        if (xa && X) {
          e.stopPropagation();
          shell.__insDlyDel();
          return;
        }
        const b = e.target.closest && e.target.closest(".dlp-x");
        if (!b || !X) return;
        e.stopPropagation();
        svConfirm({ title: "SUPPRIMER LA PÉRIODE", text: "LA PÉRIODE SERA SUPPRIMÉE.", ok: "SUPPRIMER" }).then(go => {
          if (!go) return;
          const D = X.draft();
          D[b.dataset.task] = (D[b.dataset.task] || []).filter(x => x.id !== b.dataset.pid);
          X.render();
        });
      }, true);
    }
    /* brouillon des délais de la tâche choisie : copie des périodes validées, enregistrée par ✓ VALIDER LA LIAISON */
    /* calendrier des délais : dates refusées grisées (fin avant début, début après fin, chevauchement
       avec une autre période de la même tâche secondaire) */
    window.__sviDlyCal = el => {
      if (!INS_EDIT) return null;
      const D = dlyDraft(), list = D[el.dataset.task] || (INS.dlp || {})[el.dataset.task] || [];
      const q = list.find(x => x.id === el.dataset.pid) || list[0] || { deb: "", fin: "" };
      const f = el.dataset.f, pf = dlyPredFin(el.dataset.task), cal = insCal(el.dataset.task);
      /* FORMAT 10 : une date grisée = une date que la saisie refuserait (jour non travaillé, fin avant début,
         fin après la date butoir, début avant la date exigée par les liaisons) ; une FIN qui dépasse une tâche suivante reste choisissable */
      const dis = d => {
        if (!sviWork(cal, d)) return true;
        const z = { ...q, [f]: d };
        /* v639 : DÉBUT après la FIN permis — la tâche se déplace avec sa durée (FIN recalculée) */
        if (f === "deb" && q.deb && q.fin && d > q.fin) z.fin = sviPlanMove(cal, q.deb, q.fin, d).fin;   /* règle : 02c */
        if (z.deb && z.fin && z.fin < z.deb) return true;
        if (z.fin && INS.dbut && z.fin > INS.dbut) return true;
        /* v712 : la FIN ne refuse plus tout le calendrier quand le DÉBUT déjà posé ne respecte pas une liaison (seul le DÉBUT est contrôlé) */
        if (f === "deb" && z.deb && pf && z.deb < pf) return true;
        return false;
      };
      /* v712 : aucun jour permis = la raison écrite dans le calendrier */
      const why = f === "fin" && q.deb && INS.dbut && INS.dbut < q.deb ? "AUCUNE FIN POSSIBLE : LA DATE BUTOIR (" + dFr(INS.dbut) + ") EST AVANT LE DÉBUT (" + dFr(q.deb) + "). CORRIGER LA DATE BUTOIR (INF) OU LE DÉBUT."
        : f === "deb" && pf && INS.dbut && INS.dbut < pf ? "AUCUN DÉBUT POSSIBLE : LES LIAISONS EXIGENT LE " + dFr(pf) + ", APRÈS LA DATE BUTOIR (" + dFr(INS.dbut) + ")." : "";
      return { iso: q[f] || (f === "fin" ? q.deb : "") || "", dis, why };
    };
    /* fenêtre PRÉDÉCESSEURS (ou AJOUTER UNE TÂCHE) : lot à gauche, activités secondaires à droite ;
       toutes les tâches, liées ou non ; la tâche elle-même et celles qui feraient une boucle sont grisées */
    const dlyPickPreds = key => {
      const add = !key;
      const sel = new Set(add ? [] : dlyPreds(key));
      /* type et décalage de chaque liaison (FIN → DÉBUT, 0 par défaut ; jamais négatif) */
      const meta = {};
      if (!add) dlyLinks(key).forEach(x => { meta[x.k] = { t: x.t === "DD" ? "DD" : "FD", o: Math.max(0, Number(x.o) || 0) }; });
      const mt = k => meta[k] || (meta[k] = { t: "FD", o: 0 });
      let lot = ([...sel][0] || "").split("|")[0] || (INS.lot.find(x => !x.t) || {}).id || "";
      const d = sviWinNew();
      const nSel = lo => [...sel].filter(k => k.startsWith(lo + "|")).length;
      const size = (() => { try { return JSON.parse(localStorage.getItem("svi_dpk_v1") || "null"); } catch (e) { return null; } })();
      const draw = () => {
        const sc = [...d.querySelectorAll(".dpk-col")].map(c => c.scrollTop);
        const LC = [["v", "LOT", r => r.v || "", ""]], SC = [["v", "ACTIVITÉ SECONDAIRE", r => r.v || "", ""]];
        const lotsAll = INS.lot.filter(x => !x.t), secsAll = INS.sec.filter(x => !x.t);
        const lots = cfApply("dpk_lot", LC, lotsAll), secs = cfApply("dpk_sec", SC, secsAll);
        /* AJOUTER : une tâche déjà dans le planning n'est pas proposée (grisée ; ses dates se saisissent en touchant sa ligne) */
        const inPlan = new Set(add ? dlyKeys() : []);
        const okSec = x => { const k = lot + "|" + x.id; return add ? !inPlan.has(k) : !(k === key || dlyReach(k, key)); };
        const allOn = secs.filter(okSec).length && secs.filter(okSec).every(x => sel.has(lot + "|" + x.id));
        const card = d.querySelector(".dpk-card");
        const w = card ? card.style.width : (size && size.w ? size.w + "px" : ""), h = card ? card.style.height : (size && size.h ? size.h + "px" : "");
        d.innerHTML = `<div class="svc-card dpk-card" role="dialog" aria-modal="true" style="${w ? "width:" + w + ";" : ""}${h ? "height:" + h + ";" : ""}">
          <button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
          <div class="svc-t">${add ? "AJOUTER UNE TÂCHE OU SES DÉLAIS" : "PRÉDÉCESSEURS — " + esc(dlyName(key))}</div>
          <div class="dpk-cols">
            <div class="dpk-col"><table class="dpk-t"><thead><tr>${cfHead("dpk_lot", "v", "LOT " + svCnt(lots.length, lotsAll.length))}</tr></thead>
              <tbody>${lots.map(x => `<tr class="dpk-lot${x.id === lot ? " cur" : ""}${nSel(x.id) ? " chosen" : ""}" data-lot="${x.id}"><td>${esc(x.v)}${nSel(x.id) ? " " + svCnt(nSel(x.id)) : ""}</td></tr>`).join("")}</tbody></table></div>
            <div class="dpk-col"><table class="dpk-t"><thead><tr>${cfHead("dpk_sec", "v", "ACTIVITÉ SECONDAIRE " + svCnt(secs.length, secsAll.length))}${add ? "" : '<th class="center dpk-ty">TYPE<span class="col-rs" data-rs="dpk_ty"></span></th><th class="center dpk-of">DÉCALAGE (J)<span class="col-rs" data-rs="dpk_of"></span></th>'}<th class="center dpk-cbh">${add ? "" : `<input type="checkbox" class="dpk-all"${allOn ? " checked" : ""}>`}</th></tr></thead>
              <tbody>${secs.map(x => { const k = lot + "|" + x.id, off = !okSec(x), on = sel.has(k);
                const lk = on ? mt(k) : null;
                const ty = add ? "" : `<td class="center dpk-ty">${on ? `<select class="dpk-t-in" data-k="${k}" data-f="t"><option value="FD"${lk.t === "FD" ? " selected" : ""}>FIN → DÉBUT</option><option value="DD"${lk.t === "DD" ? " selected" : ""}>DÉBUT → DÉBUT</option></select>` : ""}</td>
                  <td class="center dpk-of">${on ? `<input class="dpk-o-in number" data-k="${k}" data-f="o" inputmode="numeric" value="${lk.o}">` : ""}</td>`;
                return `<tr class="dpk-sec${off ? " off" : ""}${on ? " chosen" : ""}"><td>${esc(x.v)}</td>${ty}<td class="center"><input type="${add ? "radio" : "checkbox"}" name="dpk" data-k="${k}"${on ? " checked" : ""}${off ? " disabled" : ""}></td></tr>`; }).join("")}</tbody></table></div>
          </div>
          <div class="svc-f"><button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok${add && !sel.size ? " disabled" : ""}>${add ? "AJOUTER" : "VALIDER"}</button></div>
          <div class="dpk-rsz" title="Largeur et hauteur"></div></div>`;
        d.querySelectorAll(".dpk-col").forEach((c, n) => { c.scrollTop = sc[n] || 0; });
        sviDpkCols(d);
      };
      document.getElementById("svConf")?.remove();
      sviWinShow(d);
      draw();
      window.__sviDpkRefresh = () => { if (d.isConnected) draw(); else window.__sviDpkRefresh = null; };
      const close = () => { d.remove(); window.__sviDpkRefresh = null; };
      /* poignée d'angle : largeur et hauteur, mémorisées */
      d.addEventListener("pointerdown", e => {
        const hd = e.target.closest(".dpk-rsz");
        if (!hd) return;
        e.preventDefault();
        const card = d.querySelector(".dpk-card"), r0 = card.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
        const mv = ev => {
          const w = Math.max(420, Math.min(window.innerWidth - 16, r0.width + 2 * (ev.clientX - x0)));
          const h = Math.max(300, Math.min(window.innerHeight - 16, r0.height + 2 * (ev.clientY - y0)));
          card.style.width = w + "px"; card.style.height = h + "px";
          try { localStorage.setItem("svi_dpk_v1", JSON.stringify({ w: Math.round(w), h: Math.round(h) })); } catch (err) {}
        };
        const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
      });
      /* FORMAT 56 / 66 : appui long sur une ligne grisée = la raison */
      let lpT = null;
      d.addEventListener("pointerdown", e => {
        const r = e.target.closest("tr.dpk-sec.off");
        if (!r) return;
        clearTimeout(lpT);
        lpT = setTimeout(() => svToast(add ? "DÉJÀ DANS LE PLANNING : TOUCHER SA LIGNE POUR SAISIR SES DATES." : "IMPOSSIBLE : LA TÂCHE ELLE-MÊME OU UNE BOUCLE.", 3500, r), 550);
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach(t => d.addEventListener(t, () => clearTimeout(lpT)));
      d.addEventListener("change", e => {
        if (e.target.matches(".dpk-t-in")) { mt(e.target.dataset.k).t = e.target.value === "DD" ? "DD" : "FD"; return; }
        if (e.target.matches(".dpk-o-in")) {
          const v = String(e.target.value).trim();
          /* décalage : nombre entier de jours travaillés, jamais négatif */
          if (!/^\d*$/.test(v)) { svToast("DÉCALAGE NON VALIDE : NOMBRE DE JOURS ≥ 0.", 3500, e.target); e.target.value = mt(e.target.dataset.k).o; return; }
          mt(e.target.dataset.k).o = Number(v || 0); e.target.value = mt(e.target.dataset.k).o; return;
        }
        if (e.target.matches(".dpk-all")) {
          d.querySelectorAll("input[data-k]:not([disabled])").forEach(c => { if (e.target.checked) sel.add(c.dataset.k); else sel.delete(c.dataset.k); });
          draw(); return;
        }
        const c = e.target.closest("input[type=checkbox][data-k], input[type=radio][data-k]");
        if (!c) return;
        if (add) { sel.clear(); if (c.checked) sel.add(c.dataset.k); } else if (c.checked) sel.add(c.dataset.k); else sel.delete(c.dataset.k);
        draw();
      });
      d.addEventListener("click", e => {
        const cfb = e.target.closest(".cf-btn");
        if (cfb) { e.stopPropagation(); cfOpenMenu(cfb); return; }
        if (e.target === d || e.target.closest("[data-x]")) { close(); return; }
        const l = e.target.closest("[data-lot]");
        if (l) { lot = l.dataset.lot; draw(); return; }
        if (!e.target.closest("[data-ok]") || e.target.closest("[data-ok]").disabled) return;
        close();
        if (add) { const k = [...sel][0]; if (k && shell.__insDly) shell.__insDly.go(k); return; }
        INS.dpred = INS.dpred || {};
        if (sel.size) INS.dpred[key] = [...sel].map(k => ({ k, t: mt(k).t, o: mt(k).o })); else delete INS.dpred[key];
        insSave();
        histLog("DÉLAIS", "PRÉDÉCESSEURS", dlyName(key) + " : " + (dlyPredTxt(key) || "AUCUN"));
        /* liaisons toujours respectées (cahier, Planning budgétaire) : décalage automatique, sans fenêtre */
        const pf = dlyPredFin(key), st = dlyDeb(key);
        if (pf && st && st < pf) dlyRespect(true);
        refreshAll();
      });
    };
    /* fenêtre AJOUTER UNE TÂCHE AU PLANNING (FORMAT 66) : on ne crée pas de tâche, on donne ses dates à une tâche du budget.
       Lots à gauche, activités secondaires à droite (toutes) ; rouge = au moins une tâche sans ses deux dates, noir = tout daté,
       gris = aucune tâche (ou, une ligne étant choisie de l'autre côté, ne forme pas de tâche avec elle) — tout reste touchable ;
       un lot et une activité choisis : DÉBUT, FIN, DURÉE (J) se saisissent dans la fenêtre, une tâche à la fois */
    const dlyAddWin = (lot0, sec0) => {
      let lot = lot0 || "", sec = sec0 || "";
      const d = document.createElement("div");
      d.id = "dlyAddW";
      const size = (() => { try { return JSON.parse(localStorage.getItem("svi_dpk_v1") || "null"); } catch (e) { return null; } })();
      const dated = k => !!(dlyDeb(k) && dlyFin(k));
      const st = keys => !keys.length ? "none" : keys.some(k => !dated(k)) ? "red" : "black";
      const draw = () => {
        if (!d.isConnected) return;
        const sc = [...d.querySelectorAll(".dpk-col")].map(c => c.scrollTop);
        const T = dlyKeys();
        const LC = [["v", "LOT", r => r.v || "", ""]], SC = [["v", "ACTIVITÉ SECONDAIRE", r => r.v || "", ""]];
        const lotsAll = INS.lot.filter(x => !x.t), secsAll = INS.sec.filter(x => !x.t);
        const lots = cfApply("dpk_lot", LC, lotsAll), secs = cfApply("dpk_sec", SC, secsAll);
        const lotSt = x => st(T.filter(k => k.split("|")[0] === x.id && (!sec || k.split("|")[1] === sec)));
        const secSt = x => st(T.filter(k => k.split("|")[1] === x.id && (!lot || k.split("|")[0] === lot)));
        const card = d.querySelector(".dpk-card");
        const w = card ? card.style.width : (size && size.w ? size.w + "px" : ""), h = card ? card.style.height : (size && size.h ? size.h + "px" : "");
        const key = lot && sec ? lot + "|" + sec : "";
        /* FORMAT 66 : ligne SAISIR ICI… en bas de chaque liste = nouveau lot / nouvelle activité, choisi aussitôt */
        const newRow = k => `<tr class="dlw-newr"><td><input class="dlw-new" data-k="${k}" placeholder="${k === "lot" ? "CRÉER UN LOT ICI…" : "CRÉER UNE ACTIVITÉ ICI…"}" autocomplete="off" enterkeyhint="done"></td></tr>`;
        let panel = "";
        if (key) {
          const p0 = ((LK.dlpDraft && LK.dlpDraft[key]) || (INS.dlp || {})[key] || [])[0] || {};
          const dur = p0.deb && p0.fin ? dDur(p0.deb, p0.fin) : ((shell.__dlyPendDur || {})[key] || "");
          const s0 = T.includes(key) ? (dated(key) ? "black" : "red") : "none";
          const inp = (f, v, ph) => `<input class="ins-in dlp-in dlw-in${f === "dur" ? " number" : " center"}" data-task="${esc(key)}" data-pid="${esc(p0.id || "")}" data-f="${f}" type="text" ${f === "dur" ? "" : "readonly"} inputmode="${f === "dur" ? "numeric" : "none"}" placeholder="${ph}" value="${esc(v)}">`;
          /* pas d'intitulé ni d'état au-dessus des dates : la tâche se lit déjà dans les deux listes */
          panel = `<div class="dlw-p"><div class="dlw-f"><label>DÉBUT${inp("deb", dFr(p0.deb || ""), "SAISIR ICI…")}</label><label>FIN${inp("fin", dFr(p0.fin || ""), "SAISIR ICI…")}</label><label>DURÉE (J)${inp("dur", dur, "")}</label></div></div>`;
        }
        d.innerHTML = `<div class="svc-card dpk-card" role="dialog" aria-modal="true" style="${w ? "width:" + w + ";" : ""}${h ? "height:" + h + ";" : ""}">
          <button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
          <div class="svc-t">AJOUTER UNE TÂCHE OU SES DÉLAIS</div>
          <div class="dpk-cols">
            <div class="dpk-col"><table class="dpk-t"><thead><tr>${cfHead("dpk_lot", "v", "LOT " + svCnt(lots.length, lotsAll.length))}</tr></thead>
              <tbody>${lots.map(x => `<tr class="dpk-lot dlw-r dlw-${lotSt(x)}${x.id === lot ? " cur" : ""}" data-lot="${x.id}"><td>${esc(x.v)}</td></tr>`).join("")}${newRow("lot")}</tbody></table></div>
            <div class="dpk-col"><table class="dpk-t"><thead><tr>${cfHead("dpk_sec", "v", "ACTIVITÉ SECONDAIRE " + svCnt(secs.length, secsAll.length))}</tr></thead>
              <tbody>${secs.map(x => `<tr class="dpk-sec dlw-r dlw-${secSt(x)}${x.id === sec ? " cur" : ""}" data-sec="${x.id}"><td>${esc(x.v)}</td></tr>`).join("")}${newRow("sec")}</tbody></table></div>
          </div>${panel}
          <div class="svc-f"><button type="button" class="svc-b" data-x>FERMER</button></div>
          <div class="dpk-rsz" title="Largeur et hauteur"></div></div>`;
        d.querySelectorAll(".dpk-col").forEach((c, n) => { c.scrollTop = sc[n] || 0; });
        sviDpkCols(d);
      };
      document.getElementById("dlyAddW")?.remove();
      shell.appendChild(d);
      draw();
      /* ouverte sur une tâche (nouvelle tâche tapée dans le PLANNING) : calendrier de DÉBUT ouvert */
      if (lot && sec) setTimeout(() => { const i = d.querySelector('input.dlw-in[data-f="deb"]'); if (i && !i.value) i.focus(); }, 0);
      window.__sviDpkRefresh = () => { if (d.isConnected) draw(); else window.__sviDpkRefresh = null; };
      const close = () => { d.remove(); window.__sviDpkRefresh = null; document.getElementById("svCal")?.remove(); };
      d.addEventListener("pointerdown", e => {
        const hd = e.target.closest(".dpk-rsz");
        if (!hd) return;
        e.preventDefault();
        const card = d.querySelector(".dpk-card"), r0 = card.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
        const mv = ev => {
          const w = Math.max(420, Math.min(window.innerWidth - 16, r0.width + 2 * (ev.clientX - x0)));
          const h = Math.max(300, Math.min(window.innerHeight - 16, r0.height + 2 * (ev.clientY - y0)));
          card.style.width = w + "px"; card.style.height = h + "px";
          try { localStorage.setItem("svi_dpk_v1", JSON.stringify({ w: Math.round(w), h: Math.round(h) })); } catch (err) {}
        };
        const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
      });
      /* une date saisie (gérée comme dans le PLANNING) : la fenêtre se redessine (couleurs, durée) */
      /* FORMAT 65 : une seule date connue = le calendrier de l'autre date s'ouvre tout seul */
      d.addEventListener("change", e => { const i = e.target.closest("input.dlw-in"); if (!i) return; const f = i.dataset.f; setTimeout(draw, 0);
        setTimeout(() => { draw(); if (!d.isConnected || (f !== "deb" && f !== "fin")) return;
          const g = q => d.querySelector('input.dlw-in[data-f="' + q + '"]'), o = g(f === "deb" ? "fin" : "deb");
          if (o && !o.value && g(f) && g(f).value) { o.focus(); sviCalOpen(o); } }, 400); });
      /* nouveau lot / nouvelle activité tapé dans la fenêtre : repris s'il existe déjà (même nom), sinon créé (non lié) */
      const addNew = i => {
        if (i.dataset.done) return;
        const k = i.dataset.k, raw = U_(sviClean(i.value));
        const v = k === "lot" ? dlyLotPath(raw).map(x => x.trim()).filter(Boolean).join(" / ") : raw;
        if (!v) return;
        i.dataset.done = "1";
        const list = k === "lot" ? INS.lot : INS.sec;
        let r = list.find(x => !x.t && U_(x.v) === v);
        if (!r) { r = { id: insId(), v, on: false }; list.push(r); insSave(); histLog("DÉLAIS", k === "lot" ? "LOT AJOUTÉ" : "ACTIVITÉ SECONDAIRE AJOUTÉE", v); refreshAll(); }
        if (k === "lot") lot = r.id; else sec = r.id;
        setTimeout(() => {
          if (!d.isConnected) return;
          draw();
          const c = d.querySelector(`[data-${k}="${r.id}"]`); if (c) c.scrollIntoView({ block: "nearest" });
          if (lot && sec) { const di = d.querySelector('input.dlw-in[data-f="deb"]'); if (di && !di.value) di.focus(); }
          else { const o = d.querySelector(`input.dlw-new[data-k="${k === "lot" ? "sec" : "lot"}"]`); if (o) o.focus(); }
        }, 0);
      };
      d.addEventListener("keydown", e => { const i = e.target.closest("input.dlw-new"); if (!i || (e.key !== "Enter" && e.key !== "Tab")) return; e.preventDefault(); e.stopPropagation(); addNew(i); }, true);
      d.addEventListener("change", e => { const i = e.target.closest("input.dlw-new"); if (i) addNew(i); });
      d.addEventListener("click", e => {
        const cfb = e.target.closest(".cf-btn");
        if (cfb) { e.stopPropagation(); cfOpenMenu(cfb); return; }
        if (e.target === d || e.target.closest("[data-x]")) { close(); return; }
        if (e.target.closest("input.dlw-new")) return;
        const l = e.target.closest("[data-lot]");
        if (l) { lot = lot === l.dataset.lot ? "" : l.dataset.lot; draw(); return; }
        const s2 = e.target.closest("[data-sec]");
        if (s2) { sec = sec === s2.dataset.sec ? "" : s2.dataset.sec; draw(); if (lot && sec) setTimeout(() => { const i = d.querySelector('input.dlw-in[data-f="deb"]'); if (i && !i.value) i.focus(); }, 0); return; }
      });
    };
