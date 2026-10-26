    /* =========================================================
       ANNULER / RÉTABLIR (cahier, section Annuler / rétablir ; FORMAT 113) — v447
       une étape = les changements enregistrés sans pause de plus de 0,4 s (une frappe continue = une étape) ;
       50 étapes par budget, gardées tant que l'application reste ouverte
       ========================================================= */
    if (INS && INS_EDIT) {
      const UR = (window.__sviUndo = window.__sviUndo || {});
      const ref = budget.inst.ref;
      const snapNow = () => JSON.stringify(INS);
      let st = UR[ref];
      { const s0 = snapNow(); if (!st || st.cur !== s0) st = UR[ref] = { u: [], r: [], cur: s0, quiet: 0 }; }
      /* mises en ordre faites à l'ouverture (migrations, liaisons respectées…) : pas une étape à annuler */
      st.quiet = Date.now() + 2500;
      let tm = null;
      const paint = () => {
        const a = $("instUndo"), b = $("instRedo");
        if (a) { a.disabled = !st.u.length; a.classList.toggle("off", !st.u.length); }
        if (b) { b.disabled = !st.r.length; b.classList.toggle("off", !st.r.length); }
      };
      shell.__undoTick = () => {
        clearTimeout(tm);
        tm = setTimeout(() => {
          const s = snapNow();
          if (Date.now() < st.quiet) { st.cur = s; shell.__undoLab = ""; return; }
          if (s === st.cur) return;
          st.u.push({ snap: st.cur, lab: shell.__undoLab || "MODIFICATION" });
          if (st.u.length > 50) st.u.shift();
          st.r = []; st.cur = s; shell.__undoLab = "";
          paint();
        }, 400);
      };
      const apply = snap => {
        clearTimeout(tm);
        const o = JSON.parse(snap);
        Object.keys(INS).forEach(k => { delete INS[k]; });
        Object.assign(INS, o);
        /* choix en cours (ronds, délier en attente) abandonnés */
        LK.des = LK.lot = LK.prim = LK.sec = null; LK.prd = {}; LK.chg = {}; LK.dlpDraft = null; LK.all = {}; LK.allm = {}; LK.allp = {}; LK.linksBak = null; LK.unlinked = null;
        st.cur = snap; st.quiet = Date.now() + 900;
        insSave();
        keepScroll(() => refreshAll());
        paint();
      };
      const go = dir => {
        const from = dir < 0 ? st.u : st.r, to = dir < 0 ? st.r : st.u;
        if (!from.length) return;
        const e = from.pop();
        to.push({ snap: st.cur, lab: e.lab });
        apply(e.snap);
        histLog("BUDGET", dir < 0 ? "ANNULER" : "RÉTABLIR", e.lab);
        shell.__undoLab = "";
      };
      const bind = (id, dir) => {
        const b = $(id);
        if (!b) return;
        let lp = null, shown = false;
        b.addEventListener("pointerdown", () => {
          shown = false;
          lp = setTimeout(() => {
            const L = dir < 0 ? st.u : st.r, e = L[L.length - 1];
            shown = true;
            svToast(e ? (dir < 0 ? "ANNULER : " : "RÉTABLIR : ") + e.lab : (dir < 0 ? "RIEN À ANNULER" : "RIEN À RÉTABLIR"), 3500, b);
          }, 500);
        });
        ["pointerup", "pointercancel", "pointerleave"].forEach(t => b.addEventListener(t, () => clearTimeout(lp)));
        b.addEventListener("click", e => { e.preventDefault(); if (shown) { shown = false; return; } go(dir); });
      };
      bind("instUndo", -1); bind("instRedo", 1);
      paint();
    }
    window.__sviBdgLive = INS ? {
      ref: budget.inst.ref, project: budget.project || "", edit: INS_EDIT,
      cal: () => insCal(), dates: () => ({ but: INS.dbut || "", obj: INS.dobj || "" }),
      /* changer un jour (travaillé ↔ non travaillé) recale seulement les tâches qui le traversent, avec leur chaîne ;
         liaisons, durées et décalages restent */
      setCal: nc => {
        const oc = insCal();
        /* dates affichées : brouillon en attente de ✓ VALIDER s'il y en a un, sinon dates validées */
        const cur = k => dlyList(k)[0];
        const keys = [...new Set([...Object.keys(INS.dlp || {}), ...Object.keys(LK.dlpDraft || {})])].filter(k => { const p = cur(k); return p && p.deb && p.fin; });
        const glue = {};
        keys.forEach(k => { glue[k] = dlyGlued(k); });
        const durs = {};
        keys.forEach(k => { const p = cur(k); durs[k] = sviWDur(oc, p.deb, p.fin) || 1; });
        INS.cal = { we: [...new Set(nc.we || [])].sort(), off: [...new Set(nc.off || [])].sort(), on: [...new Set(nc.on || [])].sort() };
        const ncal = insCal(), moved = new Set();
        keys.forEach(k => {
          const p = cur(k);
          let hit = !sviWork(ncal, p.deb) || !sviWork(ncal, p.fin);
          for (let d = p.deb, i = 0; !hit && d <= p.fin && i < 20000; d = sviIsoAdd(d, 1), i++) if (sviWork(oc, d) !== sviWork(ncal, d)) hit = true;
          if (!hit) return;
          const q = dlyDraftKey(k)[0];
          q.deb = sviWNear(ncal, q.deb, 1); q.fin = sviWFin(ncal, q.deb, durs[k]);
          moved.add(k);
        });
        [...moved].forEach(k => dlyShift(k, glue[k] || new Set()).forEach(x => moved.add(x)));
        moved.forEach(k => { if (LK.dlpDraft && LK.dlpDraft[k]) { INS.dlp[k] = LK.dlpDraft[k].map(p => ({ id: p.id, deb: p.deb || "", fin: p.fin || "" })); delete LK.dlpDraft[k]; } });
        insSave();
        histLog("PARAMÉTRAGE", "CALENDRIER DU BUDGET", moved.size + " TÂCHE(S) RECALÉE(S)");
        refreshAll();
        return moved.size;
      },
      setDates: (but, obj) => {
        INS.dbut = but || ""; INS.dobj = obj || "";
        insSave();
        histLog("PARAMÉTRAGE", "DATES DU BUDGET", "BUTOIR " + (dFr(INS.dbut) || "—") + " — OBJECTIF " + (dFr(INS.dobj) || "—"));
        refreshAll();
      }
    } : null;

    /* ---------- MODE LIAISONS ---------- */
    const LK = { des: null, lot: null, prim: null, sec: null, prd: {}, chg: {}, err: "" };
    const lkName = (k, id) => { const r = INS[k].find(x => x.id === id); return r ? (k === "des" ? ((r.art ? r.art + " " : "") + (r.des || "")) : (r.v || r.des || "")) : ""; };
    const insRenderLinks = () => {
      const box = $("insLinkView");
      if (!box) return;
      const RO = !INS_EDIT;
      const U = insUsed();
      const az = (a, b) => String(a).localeCompare(String(b), "fr", { numeric: true });
      /* lignes choisies en haut (consigne 14), filtres / tri de colonne (7), colonnes réglables (9) */
      const top = (rows, isSel) => rows.map((r, i) => ({ r, i })).sort((a, b) => (isSel(b.r) - isSel(a.r)) || a.i - b.i).map(o => o.r);
      const W = { art: 70, des: 340, u: 70, q: 110, lnk: 120, v: 220, lot: 160, prim: 180, sec: 200, np: 110, nc: 110, act: 110, qt: 200, lq: 120, lp: 110, lm: 140 };
      const tbl = (t, cols, rows, lead, rowHTML) => {
        const oc = coOrder(t, cols);
        const w = k => cwLoad()[t + "." + k] || W[k] || 120;
        return `<table class="bdg-d-table lk-table" style="width:${(lead ? 40 : 0) + oc.reduce((s, c) => s + w(c[0]), 0)}px">
          <colgroup>${lead ? '<col style="width:40px">' : ""}${oc.map(c => `<col data-w="${t}.${c[0]}" style="width:${w(c[0])}px">`).join("")}</colgroup>
          <thead><tr>${lead ? '<th class="center"></th>' : ""}${oc.map(c => cfHead(t, c[0], c[1], c[3])).join("")}</tr></thead>
          <tbody>${rows.map(r => rowHTML(r, oc)).join("") || `<tr><td colspan="${oc.length + (lead ? 1 : 0)}" class="empty">AUCUNE LIGNE</td></tr>`}</tbody></table>`;
      };
      const radio = (k, id) => `<input type="radio" name="lk_${k}" data-lk="${k}" value="${id}" ${LK[k] === id ? "checked" : ""} ${RO ? "disabled" : ""}>`;
      const nLinks = id => (INS.links || []).filter(l => l.des === id).length;
      const unl = (k, id) => U[k] && !U[k].has(id) ? " ins-unl" : "";
      /* DÉSIGNATIONS */
      const DC = [["art", "ART", r => r.art || "", "center"], ["des", "DÉSIGNATION", r => r.des || "", ""], ["u", "UPB", r => r.u || "", "center"],
        ["q", "QPB", r => r.q === "" || r.q === undefined ? "" : num(r.q), "number"], ["lnk", "LIAISONS", r => nLinks(r.id) ? nLinks(r.id) + " VALIDÉE(S)" : "", ""]];
      const desList = top(cfApply("lk_des", DC, INS.des.filter(r => !r.t)), r => r.id === LK.des);
      const desHTML = tbl("lk_des", DC, desList, true, (r, oc) => `<tr class="${LK.des === r.id ? "lk-sel" : LK.des ? "lk-dim" : ""}${unl("des", r.id)}" data-pick="des" data-id="${r.id}">
          <td class="center">${radio("des", r.id)}</td>${oc.map(c => `<td class="${c[3]}">${c[0] === "lnk" ? (nLinks(r.id) ? `<span class="lk-ok">${nLinks(r.id)} VALIDÉE(S)</span>` : "")
            : c[0] === "q" ? insFmt(insQty("des", r)) : esc(c[2](r))}</td>`).join("")}</tr>`);
      /* TÂCHES : trois blocs (ordre alphabétique, largeur réglable) */
      const ws = ["lot", "prim", "sec"].map(k => cwLoad()["lk_hier." + k]);
      const gridCols = ws.every(Boolean) && window.innerWidth > 700 ? ws.map(x => x + "px").join(" ") : "";
      const col = (k, title) => {
        const C = [["v", title, r => r.v || "", ""]];
        const list = top(cfApply("lk_" + k, C, [...INS[k]].sort((a, b) => az(a.v || "", b.v || ""))), r => r.id === LK[k]);
        return `<div class="lk-col" data-lk-col="${k}"><div class="lk-ch bdg-h-head ${cfT("lk_" + k).f.v ? "cf-on" : ""}"><span class="cf-wrap"><span class="cf-lab">${title}${svCnt(list.length)}</span><span class="cf-btn"
            data-cf="lk_${k}" data-col="v" role="button" aria-label="Trier / filtrer">${cfIcon}</span></span><span class="col-rs lk-rs"></span></div>
          ${list.map(r => `<label class="lk-li ${LK[k] === r.id ? "lk-sel" : ""}${unl(k, r.id)}" data-pick="${k}" data-id="${r.id}">${radio(k, r.id)}<span>${esc(r.v || "")}</span></label>`).join("")
            || `<div class="lk-li empty">AUCUNE LIGNE</div>`}</div>`;
      };
      /* DÉTAILS : produits (obligatoire = étoile), charges (ordre alphabétique) */
      const det = k => {
        const C = [["des", k === "prd" ? "DÉSIGNATION PRODUIT" : "DÉSIGNATION CHARGE", r => r.des || "", ""], ["u", k === "prd" ? "UPB" : "UCB", r => r.u || "", "center"],
          ["qt", "QUANTITÉ DE LA TÂCHE", r => LK[k][r.id] ?? "", "number"]];
        let rows = [...INS[k]];
        if (k === "chg") rows.sort((a, b) => az(a.des || "", b.des || ""));
        rows = top(cfApply("lk_" + k, C, rows), r => LK[k][r.id] !== undefined);
        detN[k] = rows.length;
        return `<div class="lk-scroll">${tbl("lk_" + k, C, rows, true, (r, oc) => {
            const on = LK[k][r.id] !== undefined;
            return `<tr class="${on ? "lk-sel" : ""}${unl(k, r.id)}" data-det="${k}" data-id="${r.id}"><td class="center"><input type="checkbox" class="lk-cb" ${on ? "checked" : ""} ${RO ? "disabled" : ""}></td>
              ${oc.map(c => `<td class="${c[3]}">${c[0] === "qt" ? `<input class="lk-q" inputmode="decimal" value="${on ? esc(LK[k][r.id]) : ""}" ${RO ? "disabled" : ""}>` : esc(c[2](r))}</td>`).join("")}</tr>`;
          })}</div>`;
      };
      /* DÉTAILS sous onglets, même format que SAISIE / validé */
      const detN = {};
      const lkTab = ["prd", "qlt", "dly"].includes(LK.tab) ? LK.tab : "chg";
      /* QUALITÉ : lecture (saisie en mode SAISIE) ; DÉLAIS : saisis ici seulement */
      const qltHTML = () => `<table class="bdg-d-table" style="width:600px"><thead><tr><th>QUALITÉ</th></tr></thead><tbody>${
        (INS.qlt || []).map(r => `<tr><td>${esc(r.v || "")}</td></tr>`).join("") || '<tr><td class="empty">AUCUNE LIGNE</td></tr>'}</tbody></table>`;
      const detBody = lkTab === "qlt" ? `<div class="lk-scroll">${qltHTML()}</div>`
        : lkTab === "dly" ? `<div class="lk-scroll">${insDlyHTML(!RO, shell.__insDly && shell.__insDly.err)}</div>` : det(lkTab);
      detN.qlt = (INS.qlt || []).length;
      detN.dly = insTasks().length;
      if (detN.prd === undefined) detN.prd = cfApply("lk_prd", [["des", "", r => r.des || ""], ["u", "", r => r.u || ""], ["qt", "", r => LK.prd[r.id] ?? ""]], [...INS.prd]).length;
      if (detN.chg === undefined) detN.chg = cfApply("lk_chg", [["des", "", r => r.des || ""], ["u", "", r => r.u || ""], ["qt", "", r => LK.chg[r.id] ?? ""]], [...INS.chg]).length;
      const tabBtn = (k, title, extra) => `<button type="button" class="bdg-d-tab${lkTab === k ? " active" : ""}${Object.keys(cfT("lk_" + k).f).length ? " cf-on" : ""}" data-lktab="${k}">${SVI_ICON[k] || ""}${title} ${svCnt(detN[k])}${extra || ""}</button>`;
      const detHTML = `<div class="lk-dettabs"><div class="bdg-d-tabs lk-tabs">${tabBtn("chg", "DÉTAIL CHARGES")}${tabBtn("prd", 'DÉTAIL PRODUITS <b class="req-star">*</b>')}${tabBtn("qlt", "DÉTAIL QUALITÉ")}${tabBtn("dly", "DÉTAIL DÉLAIS")}</div>
        <div class="bdg-d-block bdg-d-tabbody lk-blk lk-det">${detBody}<div class="blk-rsz lk-hrsz" data-lkh="det"></div></div></div>`;
      const nPrd = Object.keys(LK.prd).length;
      const complete = LK.des && LK.lot && LK.prim && LK.sec && nPrd > 0;
      const chain = [lkName("des", LK.des), lkName("lot", LK.lot), lkName("prim", LK.prim), lkName("sec", LK.sec)]
        .map(x => x || "…").join(" › ") + " › " + nPrd + " PRODUIT(S)" + (Object.keys(LK.chg).length ? " + " + Object.keys(LK.chg).length + " CHARGE(S)" : "");
      /* LIAISONS VALIDÉES */
      const LC = [["art", "ART", l => (INS.des.find(x => x.id === l.des) || {}).art || "", "center"],
        ["des", "DÉSIGNATION", l => (INS.des.find(x => x.id === l.des) || {}).des || "", ""],
        ["lot", "LOT", l => lkName("lot", l.lot), ""], ["prim", "ACTIVITÉ PRIMAIRE", l => lkName("prim", l.prim), ""],
        ["sec", "ACTIVITÉ SECONDAIRE", l => lkName("sec", l.sec), ""], ["np", "PRODUITS", l => (l.prd || []).length, "center"],
        ["nc", "CHARGES", l => (l.chg || []).length, "center"],
        /* prix de la tâche primaire = PPB de la désignation client */
        ["lq", "QUANTITÉ", l => insFmt((l.prd || []).reduce((t, x) => t + num(x.q || 0), 0)), "number"],
        ["lp", "PPB", l => insFmt(num((INS.des.find(x => x.id === l.des) || {}).p || 0)), "number"],
        ["lm", "MPB HT", l => insFmt((l.prd || []).reduce((t, x) => t + num(x.q || 0), 0) * num((INS.des.find(x => x.id === l.des) || {}).p || 0)), "number"]];
      const lrows = cfApply("lk_links", LC, INS.links || []);
      const linksHTML = tbl("lk_links", LC, lrows, false, (l, oc) => `<tr>${oc.map(c => `<td class="${c[3]}">${esc(c[2](l))}</td>`).join("")}</tr>`)
        .replace(/<\/tr><\/thead>/, RO ? "</tr></thead>" : `<th class="center" style="width:110px"></th></tr></thead>`);
      box.innerHTML = `
        <div class="bdg-d-block lk-blk"><div class="bdg-d-block-title"><span class="ttl">${SVI_ICON.client}DÉSIGNATIONS CLIENT ${svCnt(desList.length)}</span></div>
          <div class="lk-scroll" style="height:var(--lkh-des,170px)">${desHTML}</div><div class="blk-rsz lk-hrsz" data-lkh="des"></div></div>
        <div class="bdg-d-block lk-blk"><div class="bdg-d-block-title"><span class="ttl">${SVI_ICON.hier}TÂCHES</span></div>
          <div class="lk-grid" style="${gridCols ? "grid-template-columns:" + gridCols : ""}">${col("lot", "LOT")}${col("prim", "ACTIVITÉ PRIMAIRE")}${col("sec", "ACTIVITÉ SECONDAIRE")}</div><div class="blk-rsz lk-hrsz" data-lkh="hier"></div></div>
        ${detHTML}
        ${RO ? "" : `<div class="lk-chain"><span class="lk-path">CHAÎNE : ${esc(chain)}</span>
          ${LK.err ? `<span class="lk-err">${esc(LK.err)}</span>` : ""}
          <button type="button" class="lk-go" ${complete ? "" : "disabled"}>✓ VALIDER LA LIAISON</button></div>`}
        <div class="bdg-d-block lk-blk"><div class="bdg-d-block-title"><span class="ttl">LIAISONS VALIDÉES ${svCnt(lrows.length)}</span></div>
          <div class="lk-scroll lk-links" style="height:var(--lkh-links,170px)">${linksHTML}</div><div class="blk-rsz lk-hrsz" data-lkh="links"></div></div>`;
      /* hauteurs des blocs réglées par la poignée (mémorisées) */
      try { const H = JSON.parse(localStorage.getItem("svi_lkh_v1") || "{}"); Object.keys(H).forEach(k => box.style.setProperty("--lkh-" + k, H[k] + "px")); } catch (e) {}
      sviMarkEmptyTabs(box);
      /* bouton DÉLIER au bout de chaque liaison */
      if (!RO) box.querySelectorAll(".lk-links tbody tr").forEach((tr, i) => {
        const l = lrows[i];
        if (!l) return;
        const td = document.createElement("td");
        td.className = "center";
        td.innerHTML = `<button type="button" class="lk-del" data-lid="${l.id}">${INS_TRASH} DÉLIER</button>`;
        tr.appendChild(td);
      });
    };
    /* contrôle des règles avant validation (cahier des charges A et D) */
    /* règle A au moment du choix : message passager et choix refusé */
    const lkRuleA = (k, id) => {
      const L = INS.links || [];
      if (!LK.des || !id) return "";
      if (k === "prim") {
        const t = LK.lot && L.find(l => l.lot === LK.lot && l.prim === id && l.des !== LK.des);
        if (t) return "RÈGLE A : LA TÂCHE PRIMAIRE " + lkName("lot", LK.lot) + " › " + lkName("prim", id) + " EST DÉJÀ LIÉE À " + lkName("des", t.des) + ".";
      }
      if (k === "sec" && LK.lot) {
        const t = L.find(l => l.lot === LK.lot && l.sec === id && l.des !== LK.des);
        if (t) return "RÈGLE A : LA TÂCHE SECONDAIRE " + lkName("lot", LK.lot) + " › " + lkName("sec", id) + " EST DÉJÀ LIÉE À " + lkName("des", t.des) + ".";
      }
      return "";
    };
    const lkCheck = () => {
      const L = INS.links || [];
      /* liaison déjà validée : on y ajoute les nouveaux détails (pas d'erreur) */
      /* règle A (11/10/2026) : lot, désignation et activité secondaire se lient librement ;
         une activité primaire n'a qu'une désignation ; une tâche primaire (lot + act. prm)
         et une tâche secondaire (lot + act. scd) n'ont qu'une désignation */
      const ra = lkRuleA("prim", LK.prim) || lkRuleA("sec", LK.sec);
      if (ra) return ra;
      const D = INS.des.find(x => x.id === LK.des);
      const du = U_(D && D.u);
      /* v471 : unité d'un produit ≠ désignation dans une liaison primaire : plus refusée (elle sera celle de la désignation) */
      const pk = id => impId("prd", INS.prd.find(x => x.id === id) || {});
      const dup = Object.keys(LK.prd).find(id => L.some(l => l.lot === LK.lot && l.sec === LK.sec && (l.prd || []).some(x => x.id === id || pk(x.id) === pk(id))));
      if (dup) return "RÈGLE D : " + lkName("prd", dup) + " EST DÉJÀ DANS LA TÂCHE SECONDAIRE " + lkName("lot", LK.lot) + " › " + lkName("sec", LK.sec) + ".";
      return "";
    };
    if (!shell.__lkBound) {
      shell.__lkBound = true;
      shell.addEventListener("change", e => {
        const X = shell.__lk;
        if (!X || !e.target.closest("#insLinkView")) return;
        const r = e.target.closest("input[data-lk]");
        if (r) { X.LK[r.dataset.lk] = r.value; X.LK.err = ""; X.render(); return; }
        const cb = e.target.closest("input.lk-cb");
        if (cb) {
          const tr = cb.closest("tr[data-det]");
          const k = tr.dataset.det, id = tr.dataset.id;
          if (cb.checked) X.LK[k][id] = tr.querySelector(".lk-q").value || ""; else delete X.LK[k][id];
          X.LK.err = ""; X.render(); return;
        }
        const q = e.target.closest("input.lk-q");
        if (q) {
          const tr = q.closest("tr[data-det]");
          X.LK[tr.dataset.det][tr.dataset.id] = q.value.trim();
          X.render();
        }
      });
      shell.addEventListener("click", e => {
        const X = shell.__lk;
        if (!X || !e.target.closest("#insLinkView")) return;
        /* toucher la ligne = toucher le rond (ou la case) */
        if (!e.target.closest("input, button, .cf-btn, label")) {
          const tr = e.target.closest("tr[data-pick]");
          if (tr && !X.RO()) { X.LK[tr.dataset.pick] = tr.dataset.id; X.LK.err = ""; X.render(); return; }
          const td = e.target.closest("tr[data-det]");
          if (td && !X.RO()) { td.querySelector(".lk-cb")?.click(); return; }
        }
        const lt = e.target.closest(".bdg-d-tab[data-lktab]");
        if (lt && !e.target.closest(".cf-btn")) { X.LK.tab = lt.dataset.lktab; X.render(); return; }
        const del = e.target.closest(".lk-del");
        if (del) {
          svConfirm({ title: "DÉLIER", text: "LA LIAISON SERA DÉFAITE ; LES LIGNES RESTENT DANS LE BUDGET.", ok: "DÉLIER" }).then(go => {
            if (!go) return;
            X.INS.links = (X.INS.links || []).filter(l => l.id !== del.dataset.lid);
            X.save("DÉLIER"); X.render();
          });
          return;
        }
        if (e.target.closest(".lk-go")) {
          const err = X.check();
          if (err) { X.LK.err = err; X.render(); return; }
          const L = X.LK;
          X.INS.links = X.INS.links || [];
          X.INS.links.push({ id: X.insId(), des: L.des, lot: L.lot, prim: L.prim, sec: L.sec,
            prd: Object.entries(L.prd).map(([id, q]) => ({ id, q: q === "" ? "" : num(q) })),
            chg: Object.entries(L.chg).map(([id, q]) => ({ id, q: q === "" ? "" : num(q) })) });
          /* on garde la désignation et le lot pour enchaîner la tâche suivante */
          L.prim = null; L.sec = null; L.prd = {}; L.chg = {}; L.err = "";
          X.save("LIAISON VALIDÉE"); X.render();
        }
      });
    }
    shell.__lk = INS ? { INS, LK, insId, check: lkCheck, render: () => insRenderLinks(), RO: () => !INS_EDIT,
      save: what => { insSave(); histLog("LIAISONS", what, fullRef); } } : null;
    /* détail produits : alerte (non bloquante) si les dimensions ne correspondent pas à l'unité
       U / F : NBR seul ; M / ML : NBR + 1 DIM ; M2 : NBR + 2 DIM ; M3 : NBR + 3 DIM */
    if (!shell.__dimBound) {
      shell.__dimBound = true;
      shell.addEventListener("change", e => {
        const inp = e.target.closest && e.target.closest(".ins-in");
        const X = shell.__ins;
        if (!inp || !X || !["u", "nbr", "d1", "d2", "d3"].includes(inp.dataset.f)) return;
        const tr = inp.closest('tr[data-ik="prd"][data-iid]');
        if (!tr) return;
        const r = X.INS.prd.find(x => x.id === tr.dataset.iid);
        if (!r) return;
        const u = String(r.u || "").trim().toUpperCase();
        const max = { U: 0, F: 0, M: 1, ML: 1, M2: 2, M3: 3 }[u];
        if (max === undefined) return;
        const nd = ["d1", "d2", "d3"].filter(f => r[f] !== "" && r[f] !== undefined && r[f] !== null).length;
        if (nd > max) svToast("ATTENTION : UNITÉ " + u + " → " + (max === 0 ? "NBR SEUL" : "NBR ET " + max + " DIM") + " (" + nd + " DIM RENSEIGNÉE" + (nd > 1 ? "S" : "") + ").", 3500, inp);
      });
    }
    /* détail charges : ART ou désignation saisi → désignation, unité, PCB et TVA viennent de CHS ;
       charge absente de CHS : acceptée, son PCB reste saisissable */
    if (!shell.__chsBound) {
      shell.__chsBound = true;
      shell.addEventListener("change", e => {
        const inp = e.target.closest && e.target.closest(".ins-in");
        const X = shell.__ins;
        if (!inp || !X || !["art", "des"].includes(inp.dataset.f)) return;
        const tr = inp.closest('tr[data-ik="chg"][data-iid]');
        if (!tr) return;
        const r = X.INS.chg.find(x => x.id === tr.dataset.iid);
        if (!r) return;
        const c = chsFind(inp.dataset.f === "art" ? r.art : "", inp.dataset.f === "des" ? r.des : "");
        if (c) { r.chs = c.id; r.art = String(c.article ?? r.art ?? "").toUpperCase(); r.des = String(c.designation ?? r.des ?? "").toUpperCase();
          r.u = String(c.unit ?? r.u ?? "").toUpperCase(); r.p = c.pcs; r.tva = c.tva; }
        else if (r.chs) { delete r.chs; }
        else return;
        X.insSave();
        /* la ligne seule est redessinée (le PCB passe en gris ou redevient saisissable) */
        const tmp = document.createElement("tbody");
        tmp.innerHTML = X.insRowHTML("chg", r, 0);
        const nr = tmp.firstElementChild;
        const foc = document.activeElement && tr.contains(document.activeElement) ? document.activeElement.dataset.f : null;
        tr.replaceWith(nr);
        X.insLive("chg", nr, r);
        if (foc) nr.querySelector(`input[data-f="${foc}"]`)?.focus();
      });
    }
    /* FORMAT 74-75 : nombre non valide refusé ; unité d'un produit → DIM non autorisées effacées et grisées ;
       on ne passe pas à une autre ligne tant que la ligne quittée a une erreur */
    if (!shell.__ruleBound) {
      shell.__ruleBound = true;
      shell.addEventListener("change", e => {
        const inp = e.target.closest && e.target.closest(".ins-in");
        const X = shell.__ins;
        if (!inp || !X) return;
        const tr = inp.closest("[data-ik][data-iid]");
        if (!tr) return;
        const k = tr.dataset.ik, r = X.INS[k] && X.INS[k].find(x => x.id === tr.dataset.iid);
        if (!r) return;
        /* ligne liée entièrement vidée : refusée, la valeur revient (FORMAT 90) */
        if (insRowEmpty(k, r) && X.isUsed(k, r.id)) {
          const old = shell.__dupOld && shell.__dupOld.id === r.id ? shell.__dupOld.row : null;
          if (old) { r[inp.dataset.f] = old[inp.dataset.f] ?? ""; inp.value = sviIm(inp) === "decimal" ? insFmt(r[inp.dataset.f]) : String(r[inp.dataset.f] ?? ""); }
          svToast("LIGNE LIÉE : DÉLIER D'ABORD.", 3500, inp);
          X.insSave();
          return;
        }
        if (sviIm(inp) === "decimal" && !sviNumOk(inp.value)) {
          svToast("NOMBRE NON VALIDE : CHIFFRES SEULEMENT (EX. 1 234,56).", 3500, inp);
          inp.value = ""; r[inp.dataset.f] = ""; X.insSave();
          setTimeout(() => inp.focus(), 0);
          return;
        }
        if (k === "prd" && inp.dataset.f === "u") {
          const nd = sviUnitDims(r.u);
          const gone = [1, 2, 3].filter(i => i > nd && String(r["d" + i] ?? "") !== "");
          gone.forEach(i => { r["d" + i] = ""; });
          if (gone.length) svToast("UNITÉ " + U_(r.u) + " : " + (nd ? "NBR ET " + nd + " DIM" : "NBR SEUL") + " — DIM " + gone.join(", ") + " EFFACÉE(S).", 3500, inp);
          X.insSave();
          const tmp = document.createElement("tbody");
          tmp.innerHTML = X.insRowHTML("prd", r, 0);
          const nr = tmp.firstElementChild;
          if (tr.contains(document.activeElement)) document.activeElement.blur();
          const cur = tr.isConnected ? tr : shell.querySelector(`tr[data-ik="prd"][data-iid="${r.id}"]`);
          if (!cur || !cur.parentNode) return;
          try { cur.replaceWith(nr); } catch (err) { return; }
          X.insLive("prd", nr, r);
          setTimeout(() => { const nx = nr.querySelector('input[data-f="nbr"]'); if (nx && !document.activeElement?.closest("tr")) nx.focus(); }, 0);
        }
      });
      let lastRow = null;
      shell.addEventListener("focusin", e => {
        const inp = e.target.closest && e.target.closest(".ins-in");
        const X = shell.__ins;
        if (!inp || !X) return;
        const tr = inp.closest("tr[data-ik]");
        const prev = lastRow;
        lastRow = tr && tr.dataset.iid ? { k: tr.dataset.ik, id: tr.dataset.iid } : null;
        if (!prev || (tr && tr.dataset.ik === prev.k && tr.dataset.iid === prev.id)) return;
        const r = (X.INS[prev.k] || []).find(x => x.id === prev.id);
        const er = r && X.rowErr(prev.k, r);
        if (!er) return;
        const back = shell.querySelector(`tr[data-ik="${prev.k}"][data-iid="${prev.id}"] input[data-f="${er.f}"]`);
        /* v497 (remarque 31) : PCB manquant (charge absente de CHS) — on peut sortir ; la case reste encadrée en rouge,
           la ligne est signalée dans À COMPLÉTER et empêche seulement de figer */
        if (prev.k === "chg" && er.f === "p") { svToast(er.m + " (À COMPLÉTER)", 2500, back || undefined); return; }
        if (!back || back.disabled) return;
        lastRow = prev;
        e.preventDefault();
        setTimeout(() => { back.focus(); svToast(er.m, 3500, back); }, 0);
      });
    }
    /* page unique : rond (choix de la chaîne), quantité de la tâche, ✓ VALIDER, DÉLIER */
    if (!shell.__fuseBound) {
      shell.__fuseBound = true;
      shell.addEventListener("click", e => {
        const X = shell.__fuse;
        if (!X) return;
        const ra = e.target.closest(".lk-rdall");
        if (ra) {
          e.stopPropagation(); e.preventDefault();
          if (ra.classList.contains("off")) return;
          X.allToggle(ra.dataset.rdall);
          return;
        }
        const rg = e.target.closest(".lk-rdgrp");
        if (rg) {
          e.stopPropagation(); e.preventDefault();
          if (rg.classList.contains("off")) { svToast("UNE LIGNE (OU UN AUTRE TITRE) EST DÉJÀ CHOISIE : LIBÉREZ-LA D'ABORD.", 3000, rg); return; }
          X.partToggle(rg.dataset.rdgrp, rg.dataset.key);
          return;
        }
        /* v507 (remarque 63) : pastille d'un titre de charges regroupées = rond de toutes ses charges */
        const gr = e.target.closest(".ins-gtitle .ins-grd");
        if (gr) {
          e.stopPropagation(); e.preventDefault();
          /* v530 : même pastille pour les titres du DÉTAIL PRODUITS */
          const gk = gr.closest("table")?.dataset.ik === "prd" ? "prd" : "chg";
          const L = X.LK, ids = (gr.closest("tr").dataset.grp || "").split(",").filter(Boolean);
          const all = ids.length && ids.every(id => L[gk][id] !== undefined);
          ids.forEach(id => { if (all) delete L[gk][id]; else if (L[gk][id] === undefined) L[gk][id] = ""; });
          L.err = ""; X.light(gk);
          return;
        }
        /* v537 : rond d'une tâche du PLANNING = son lot et son activité secondaire choisis : tout ce qui lui est lié s'allume
           (désignations, activités, produits, charges) ; retoucher = libérer */
        const dr = e.target.closest(".dly-rd");
        if (dr) {
          e.stopPropagation(); e.preventDefault();
          const L = X.LK, [lo, se] = String(dr.dataset.dkey || "").split("|");
          if (L.lot === lo && L.sec === se) { L.lot = L.sec = null; L.prim = null; X.light("lot"); return; }
          if (L.des || L.lot || L.prim || L.sec || (L.all && Object.values(L.all).some(Boolean))) { svToast("UNE LIGNE (OU UN TITRE) EST DÉJÀ CHOISIE : LIBÉREZ-LA D'ABORD.", 3000, dr); return; }
          L.lot = lo; L.sec = se; X.light("lot");
          return;
        }
        const rd = e.target.closest(".lk-rd");
        if (rd) {
          e.stopPropagation(); e.preventDefault();
          const k = rd.dataset.rd, id = rd.closest("[data-iid]")?.dataset.iid;
          if (!id) return;
          if (rd.closest(".lk-ban")) return;   /* ligne grisée : on ne peut pas la choisir (appui long = raison) */
          const L = X.LK, multi = k === "prd" || k === "chg";
          const chosen = multi ? L[k][id] !== undefined : L[k] === id;
          if (!multi && L[k] && !chosen) return;   /* une ligne déjà choisie : les autres attendent qu'on la libère */
          /* libérer la désignation avec une modification non validée : proposer de valider d'abord */
          if (k === "des" && chosen && X.pending()) { X.guard().then(ok => { if (ok) { L.des = null; L.lot = L.prim = L.sec = null; L.prd = {}; L.chg = {}; L.dlpDraft = null; X.light("des"); } }); return; }
          const pick = () => {
            if ((k === "prim" || k === "sec") && L[k] !== id) {
              const ra = X.ruleA(k, id);
              if (ra) { svToast(ra); return; }   /* refusé tout de suite */
            }
            if (k === "prd" && L[k][id] === undefined) {
              const bad = X.unitErr(id);
              if (bad) { svToast(bad); return; }   /* unité différente : refusé tout de suite */
            }
            if (multi) { if (L[k][id] !== undefined) delete L[k][id]; else L[k][id] = ""; }
            else {
              L[k] = L[k] === id ? null : id;      /* 2e toucher : le choix est libéré */
              /* v478 (remarque 9) : libérer un rond laisse les autres ronds de la chaîne en place */
            }
            L.err = "";
            X.light(k);
          };
          /* le rond ne fait que choisir / libérer ; délier passe par le bouton ✕ DÉLIER */
          pick();
          return;
        }
        if (e.target.closest("#insChain .lk-info")) { X.info(); return; }
        if (e.target.closest("#insChain .lk-go")) {
          const g = e.target.closest("#insChain .lk-go");
          if (g.classList.contains("lk-off")) { svToast(g.dataset.why || "VALIDATION IMPOSSIBLE.", 4000, g); return; }
          X.commit();
          return;
        }
        const del = e.target.closest(".lk-del");
        if (del && !e.target.closest("#insLinkView")) {
          svConfirm({ title: "DÉLIER", text: "LA LIAISON SERA DÉFAITE ; LES LIGNES RESTENT DANS LE BUDGET.", ok: "DÉLIER" }).then(go => {
            if (!go) return;
            X.INS.links = (X.INS.links || []).filter(l => l.id !== del.dataset.lid);
            X.save("DÉLIER"); X.refresh();
          });
        }
      }, true);
      shell.addEventListener("change", e => {
        const X = shell.__fuse;
        const q = e.target.closest && e.target.closest("input.lk-q");
        if (!X || !q || e.target.closest("#insLinkView")) return;
        const id = q.closest("[data-iid]")?.dataset.iid;
        if (id && X.LK[q.dataset.qk][id] !== undefined) { X.LK[q.dataset.qk][id] = q.value.trim(); X.chain(); }
      });
    }
    /* briser la liaison d'une ligne, dans le contexte choisi (désignation, et lot / activités s'ils sont choisis) */
    const lkUnlink = (k, id) => {
      /* délier = modification de la liaison : à valider (✓ VALIDER), annulable (ABANDONNER) */
      if (!LK.linksBak) LK.linksBak = JSON.parse(JSON.stringify(INS.links || []));
      const lvl = { lot: 0, prim: 1, sec: 2, prd: 3, chg: 3 }[k];
      const hit = new Set(lkLinks(lvl).map(l => l.id));
      if (k === "prd" || k === "chg") {
        INS.links.forEach(l => { if (hit.has(l.id)) l[k] = (l[k] || []).filter(x => x.id !== id); });
        INS.links = INS.links.filter(l => (l.prd || []).length);
      } else INS.links = INS.links.filter(l => !(hit.has(l.id) && l[k] === id));
      LK.unlinked = (LK.unlinked || []).concat(lkName("des", LK.des) + " — " + lkName(k, id));
      refreshAll();
    };
    /* toucher un rond : on ne redessine que ce qui change (rapidité) */
    const lkLight = k => {
      keepScroll(() => {
        if ((k === "prd" || k === "chg") && !(INS.links || []).length) {
          /* produit / charge sans aucune liaison : le tableau seul est redessiné (la ligne choisie monte) */
          renderTab();
          insMarkUnlinked();
        } else {
          /* tout choix fait remonter, dans les autres blocs, les lignes qui lui sont liées */
          insRenderClient();
          insRenderHier();
          renderTab();   /* compteurs des onglets et tableau du détail (produits, charges, délais de la tâche choisie) */
          insMarkUnlinked();
        }
        insRenderChain();
      });
    };
    /* ✓ VALIDER LA LIAISON : nouvelle liaison, ajout de détails à une liaison existante, délais de la tâche */
    /* ✕ DÉLIER : fenêtre de confirmation (liaisons concernées, délais supprimés), puis destruction */
    const lkDestroy = pl => {
      const tag = l => [lkName("des", l.des), lkName("lot", l.lot), lkName("prim", l.prim), lkName("sec", l.sec)].join(" › ");
      /* v490 (remarque 3) : chaque liaison citée — DÉSIGNATION CLIENT / LOT / ACTIVITÉ PRIMAIRE / ACTIVITÉ SECONDAIRE, produits et charges */
      const tag2 = l => [lkName("des", l.des), lkName("lot", l.lot), lkName("prim", l.prim), lkName("sec", l.sec)].map(U_).join(" / ")
        + " — " + (l.prd || []).length + " PRODUIT(S), " + (l.chg || []).length + " CHARGE(S)";
      const rem = pl.remP.length || pl.remC.length;
      const names = [...pl.remP.map(id => lkName("prd", id)), ...pl.remC.map(id => lkName("chg", id))];
      const ids = new Set(pl.links.map(l => l.id));
      /* liaisons après l'opération (un produit retiré : la liaison sans produit disparaît) */
      const after = (INS.links || []).map(l => !ids.has(l.id) ? l : (!rem || (pl.whole && pl.whole.has(l.id))) ? null
        : { ...l, prd: (l.prd || []).filter(x => !pl.remP.includes(x.id)), chg: (l.chg || []).filter(x => !pl.remC.includes(x.id)) })
        .filter(l => l && (l.prd || []).length);
      const gone = pl.links.filter(l => !after.some(a => a.id === l.id));
      /* délais des tâches secondaires qui n'ont plus aucune liaison */
      /* délais : indépendants des liaisons (planning possible avant les liaisons) — gardés */
      const dK = [];
      const nD = dK.reduce((t, k) => t + INS.dlp[k].length, 0);
      /* FORMAT 123 : résumé chiffré, pas de longue liste */
      const nDes = new Set(pl.links.map(l => l.des)).size;
      const html = `<div class="svc-sub"><b>${pl.links.length} LIAISON(S) ${rem ? "TOUCHÉE(S)" : "SERONT DÉLIÉES"}</b> (${nDes} DÉSIGNATION(S) CLIENT${rem ? ", " + names.length + " PRODUIT(S) / CHARGE(S) RETIRÉ(S)" + (gone.length ? ", " + gone.length + " LIAISON(S) SANS PRODUIT DÉLIÉE(S)" : "") : ""}).</div>
        <div class="svc-sub">LES LIGNES DÉLIÉES RESTENT DANS LEURS TABLEAUX (LIGNES NON LIÉES).</div>
        ${rem ? `<div class="svc-sub">À RETIRER : ${esc(names.join(", "))}</div>` : ""}
        <div class="svc-sub">${rem ? "DANS" : "LIAISONS DÉLIÉES"} ${svCnt(pl.links.length)} :</div>
        <ul class="svc-list">${pl.links.map(l => `<li>${esc(tag2(l))}${rem && gone.includes(l) ? " <b>(PLUS AUCUN PRODUIT : DÉLIÉE)</b>" : ""}</li>`).join("")}</ul>
        ${nD ? `<div class="svc-sub svc-warn">LES DATES DE ${nD} TÂCHE${nD > 1 ? "S" : ""} ${nD > 1 ? "SERONT SUPPRIMÉES" : "SERONT SUPPRIMÉES"}.</div>` : ""}`;
      return svConfirm({ title: rem ? "RETIRER DES LIAISONS" : "DÉLIER", html, ok: "✕ DÉLIER" }).then(go => {
        if (!go) return false;
        INS.links = after;
        dK.forEach(k => { delete INS.dlp[k]; });
        histLog("LIAISONS", "DÉLIER", (rem ? names.join(", ") + " — " : "") + pl.links.map(tag).join(" ; "));
        LK.prd = {}; LK.chg = {}; LK.lot = LK.prim = LK.sec = null; LK.dlpDraft = null; LK.all = {}; LK.allm = {}; LK.allp = {};
        if (LK.des && !INS.des.some(x => x.id === LK.des)) LK.des = null;
        insSave();
        refreshAll();
        return true;
      });
    };
    const lkCommit = () => {
      const pl = lkPlan();
      if (pl.mode === "mix") { svToast("CHOISIR SOIT DES LIGNES À AJOUTER, SOIT DES LIGNES À DÉLIER (EN DEUX FOIS)."); return false; }
      if (pl.mode === "del") return lkDestroy(pl);
      const L = LK, hasNew = Object.keys(L.prd).length || Object.keys(L.chg).length;
      if (hasNew && L.des && L.lot && L.prim && L.sec) {
        const err = lkCheck();
        if (err) { svToast(err); return false; }
        INS.links = INS.links || [];
        /* FORMAT 117 : produit déjà lié à une autre tâche → nouvelle ligne pour cette tâche (mêmes quantités au départ) */
        { const tgt = INS.links.find(l => l.des === L.des && l.lot === L.lot && l.prim === L.prim && l.sec === L.sec);
          const re = {};
          Object.keys(L.prd).forEach(id => {
            if (!INS.links.some(l => l !== tgt && (l.prd || []).some(x => x.id === id))) { re[id] = L.prd[id]; return; }
            const p = INS.prd.find(x => x.id === id);
            if (!p) return;
            const c = { ...p, id: insId(), on: false };
            INS.prd.splice(INS.prd.indexOf(p) + 1, 0, c);
            re[c.id] = L.prd[id];
          });
          L.prd = re;
          /* v482 (remarque 21) : charge déjà liée à une autre tâche → nouvelle ligne pour cette tâche (même quantité au départ) */
          const rc = {};
          Object.keys(L.chg).forEach(id => {
            if (!INS.links.some(l => l !== tgt && (l.chg || []).some(x => x.id === id))) { rc[id] = L.chg[id]; return; }
            const c0 = INS.chg.find(x => x.id === id);
            if (!c0) return;
            const c = { ...c0, id: insId(), on: false };
            INS.chg.splice(INS.chg.indexOf(c0) + 1, 0, c);
            rc[c.id] = L.chg[id];
          });
          L.chg = rc; }
        const ent = o => Object.keys(o).map(id => ({ id, q: "" }));
        const same = INS.links.find(l => l.des === L.des && l.lot === L.lot && l.prim === L.prim && l.sec === L.sec);
        if (same) {
          ent(L.prd).forEach(x => { if (!(same.prd || []).some(y => y.id === x.id)) (same.prd = same.prd || []).push(x); });
          ent(L.chg).forEach(x => { if (!(same.chg || []).some(y => y.id === x.id)) (same.chg = same.chg || []).push(x); });
        } else {
          if (!Object.keys(L.prd).length) { svToast("UNE LIAISON DOIT AVOIR AU MOINS UN PRODUIT."); return false; }
          INS.links.push({ id: insId(), des: L.des, lot: L.lot, prim: L.prim, sec: L.sec, prd: ent(L.prd), chg: ent(L.chg) });
        }
        /* v473 : après ✓ VALIDER, ronds et cases restent comme ils sont (à l'utilisateur de les libérer) */
      }
      if (lkDlyDirty()) {
        INS.dlp = INS.dlp || {};
        Object.keys(L.dlpDraft).forEach(k => { INS.dlp[k] = L.dlpDraft[k].map(p => ({ id: p.id, deb: p.deb || "", fin: p.fin || "" })); });
      }
      if (L.linksBak) {
        (L.unlinked || []).forEach(t => histLog("LIAISONS", "DÉLIER", t));
        L.linksBak = null; L.unlinked = null;
      }
      L.dlpDraft = null; L.err = "";
      /* v473 : après validation, tous les choix (ronds) restent en place ; l'utilisateur les libère lui-même */
      insSave(); histLog("LIAISONS", "LIAISON VALIDÉE", lkName("des", L.des));
      refreshAll();
      return true;
    };
    /* modification non validée : avant de passer à autre chose, on propose de valider */
    /* ce qui sera abandonné (consigne 27) : produits / charges à ajouter, délais modifiés, liaisons déliées */
    const lkPendingHTML = () => {
      const add = [...Object.keys(LK.prd || {}).map(id => lkName("prd", id)), ...Object.keys(LK.chg || {}).map(id => lkName("chg", id))];
      const out = [];
      if (add.length) out.push(`<div class="svc-sub">À AJOUTER :</div><ul class="svc-list">${add.map(n => `<li>${esc(n)}</li>`).join("")}</ul>`);
      if (lkDlyDirty()) out.push(`<div class="svc-sub">DÉLAIS MODIFIÉS</div>`);
      if ((LK.unlinked || []).length) out.push(`<div class="svc-sub">DÉLIÉES :</div><ul class="svc-list">${LK.unlinked.map(n => `<li>${esc(n)}</li>`).join("")}</ul>`);
      return out.join("");
    };
    const lkGuard = () => !lkPending() ? Promise.resolve(true)
      : svChoose({ title: "LIAISON EN COURS NON VALIDÉE", html: lkPendingHTML(),
          buttons: [{ v: "drop", label: "ABANDONNER", tone: "danger" }, { v: "ok", label: "✓ VALIDER", tone: "neutral" }] })
        .then(v => {
          if (v === "ok") return lkCommit();
          if (v === "drop") {
            LK.prd = {}; LK.chg = {}; LK.dlpDraft = null; LK.all = {}; LK.allm = {}; LK.allp = {};
            LK.lot = LK.prim = LK.sec = null;
            if (LK.linksBak) { INS.links = LK.linksBak; LK.linksBak = null; LK.unlinked = null; insSave(); }
            return true;
          }
          return false;
        });
    shell.__lkGuard = INS && INS_EDIT ? lkGuard : null;
    /* rond d'en-tête : 1er toucher = choisir toutes les lignes déjà liées du bloc ; 2e = tout libérer */
    const lkAllToggle = k => {
      LK.all = LK.all || {}; LK.allm = LK.allm || {};
      if (k === "prd" || k === "chg") {
        if (LK.allm[k]) { LK[k] = {}; LK.allm[k] = false; }
        else { insShown(k).filter(r => !r.t && lkAllLinked(k, r.id)).forEach(r => { LK[k][r.id] = ""; }); LK.allm[k] = Object.keys(LK[k]).length > 0; }
      } else {
        /* rond d'en-tête : toutes les lignes ; il remplace un choix par titre (v525) */
        LK.allp = LK.allp || {};
        if (LK.allp[k]) { LK.allp[k] = null; LK.all[k] = true; }
        else LK.all[k] = !LK.all[k];
        if (LK.all[k]) LK[k] = null;
      }
      lkLight(k);
    };
    /* v525 (remarque 2) : rond d'un titre — toutes les lignes liées sous ce titre (même repliées) ; retoucher = libérer */
    const lkPartToggle = (k, key) => {
      LK.all = LK.all || {}; LK.allp = LK.allp || {};
      if (LK.all[k] && LK.allp[k] === key) { LK.all[k] = false; LK.allp[k] = null; }
      else { LK.all[k] = true; LK.allp[k] = key; LK[k] = null; }
      lkLight(k);
    };
    shell.__fuse = INS && INS_EDIT ? { INS, LK, insId, check: lkCheck, allToggle: k => lkAllToggle(k), chain: () => insRenderChain(), refresh: () => refreshAll(),
      partToggle: (k, key) => lkPartToggle(k, key),
      commit: () => { const r0 = lkCommit(); if (shell.__prdSyncU && shell.__prdSyncU()) refreshAll(); return r0; }, guard: () => lkGuard(), pending: () => lkPending(), ruleA: (k, id) => lkRuleA(k, id),
      light: k => lkLight(k), unlink: (k, id) => lkUnlink(k, id), name: (k, id) => lkName(k, id),
      unitErr: id => {
        const D = INS.des.find(x => x.id === LK.des), P = INS.prd.find(x => x.id === id);
        const du = String((D && D.u) || "").trim().toUpperCase(), pu = String((P && P.u) || "").trim().toUpperCase();
        void du; void pu; return "";
      },
      info: () => {
        /* fenêtre au format INF : titre, ✕, libellés à gauche, état de la liaison, produits et charges, FERMER */
        document.getElementById("docPop")?.remove();
        const n = (k, id) => esc(lkName(k, id) || "—");
        const same = LK.des && LK.lot && LK.prim && LK.sec
          && (INS.links || []).find(l => l.des === LK.des && l.lot === LK.lot && l.prim === LK.prim && l.sec === LK.sec);
        const st = same ? "LIAISON DÉJÀ ÉTABLIE" + (Object.keys(LK.prd).length || Object.keys(LK.chg).length || lkDlyDirty() || LK.linksBak ? " — MODIFICATIONS À VALIDER" : "")
          : LK.des && LK.lot && LK.prim && LK.sec ? "NOUVELLE LIAISON — À VALIDER" : "LIAISON INCOMPLÈTE";
        /* v476 (remarque 1) : bouton ✓ VALIDER grisé → la cause, ici */
        const why = (() => {
          const pl = lkPlan();
          if (pl.mode === "mix") return "CHOISIR SOIT DES LIGNES À AJOUTER, SOIT DES LIGNES À DÉLIER (EN DEUX FOIS).";
          if (pl.mode === "incomplete") return "LIAISON INCOMPLÈTE : CHOISIR " + [["des", "LA DÉSIGNATION"], ["lot", "LE LOT"], ["prim", "L'ACTIVITÉ PRIMAIRE"], ["sec", "L'ACTIVITÉ SECONDAIRE"]].filter(([k]) => !LK[k]).map(x => x[1]).join(", ") + ".";
          if (pl.mode === "add" && pl.full && (Object.keys(LK.prd).length || Object.keys(LK.chg).length)) { try { return lkCheck() || ""; } catch (e) { return ""; } }
          if (pl.mode === "add" && !pl.same && !Object.keys(LK.prd).length && !lkDlyDirty()) return "UNE LIAISON DOIT AVOIR AU MOINS UN PRODUIT.";
          if (pl.mode === "none" && LK.des && !(LK.lot && LK.prim && LK.sec)) return "LIAISON INCOMPLÈTE : CHOISIR " + [["lot", "LE LOT"], ["prim", "L'ACTIVITÉ PRIMAIRE"], ["sec", "L'ACTIVITÉ SECONDAIRE"]].filter(([k]) => !LK[k]).map(x => x[1]).join(", ") + ".";
          return "";
        })();
        /* tableaux de la fenêtre : tri / filtre sur chaque colonne (consigne 7) */
        const list = k => [...(same ? (same[k] || []).map(x => ({ id: x.id, st: "LIÉ" })) : []), ...Object.keys(LK[k]).map(id => ({ id, st: "À AJOUTER" }))]
          .map(o => { const r = INS[k].find(x => x.id === o.id) || {}; return { id: o.id, des: r.des || "", u: r.u || "", q: k === "prd" ? insPrdQ(r) : num(r.q || 0), st: o.st }; });
        const C = k => [["des", k === "prd" ? "DÉSIGNATION PRODUIT" : "DÉSIGNATION CHARGE", x => x.des, ""], ["u", k === "prd" ? "UPB" : "UCB", x => x.u, "center"],
          ["q", k === "prd" ? "QPB" : "QCB", x => x.q, "number"], ["st", "ÉTAT", x => x.st, "center"]];
        const tbl = (k, lab) => {
          const t = "lki_" + k, rows = cfApply(t, C(k), list(k));
          return `<div class="doc-lab" style="margin-top:12px">${lab} ${svCnt(rows.length)}</div>
            <table class="bdg-d-table" style="width:100%;margin-top:6px"><thead><tr>${C(k).map(c => cfHead(t, c[0], c[1], c[3])).join("")}</tr></thead>
            <tbody>${rows.map(x => `<tr class="lk-go-row" data-gk="${k}" data-gid="${esc(x.id)}">${C(k).map(c => `<td class="${c[3]}">${c[0] === "q" ? insFmt(x.q) : esc(c[2](x))}</td>`).join("")}</tr>`).join("")
              || `<tr><td colspan="4" class="empty">AUCUNE LIGNE</td></tr>`}</tbody></table>`;
        };
        /* v619 (remarque 90) : une rubrique par ligne — produits, charges, délais et qualité de la chaîne ; saisie possible
           (ligne ajoutée = choisie pour la liaison ; doublon refusé), bouton VALIDER / DÉLIER aussi en bas */
        const addRow = k => `<div class="lki-add" data-k="${k}"><input class="lki-d" placeholder="${k === "prd" ? "DÉSIGNATION PRODUIT" : "DÉSIGNATION CHARGE"}" autocomplete="off"><input class="lki-u" placeholder="${k === "prd" ? "UPB" : "UCB"}" autocomplete="off"><input class="lki-q" inputmode="decimal" placeholder="${k === "prd" ? "QPB" : "QCB"}" autocomplete="off">${k === "chg" ? '<input class="lki-p" inputmode="decimal" placeholder="PCB" autocomplete="off">' : ""}<button type="button" class="doc-btn lki-plus" data-k="${k}">+ AJOUTER</button></div>`;
        const tKey = () => LK.lot && LK.sec ? LK.lot + "|" + LK.sec : "";
        const dlyBlk = () => {
          const k = tKey();
          if (!k) return `<div class="doc-lab" style="margin-top:12px">DÉTAIL DÉLAIS</div><div class="lk-info-why">CHOISIR LE LOT ET L'ACTIVITÉ SECONDAIRE.</div>`;
          const P = ((INS.dlp || {})[k] || [])[0] || {}, cal = insCal(), dur = P.deb && P.fin ? sviWDur(cal, P.deb, P.fin) : "";
          return `<div class="doc-lab" style="margin-top:12px">DÉTAIL DÉLAIS</div><div class="lki-dly" data-task="${esc(k)}"><span class="doc-lab">DÉBUT</span><input type="date" class="lki-deb" value="${esc(P.deb || "")}"><span class="doc-lab">FIN</span><input type="date" class="lki-fin" value="${esc(P.fin || "")}"><span class="doc-lab">DURÉE (J)</span><b>${esc(String(dur))}</b></div>`;
        };
        const body2 = () => tbl("prd", "DÉTAIL PRODUITS") + addRow("prd") + tbl("chg", "DÉTAIL CHARGES") + addRow("chg") + dlyBlk()
          + `<div class="doc-lab" style="margin-top:12px">DÉTAIL QUALITÉ</div><div><button type="button" class="doc-btn lki-qlt">OUVRIR DÉTAIL QUALITÉ</button></div>`;
        const goBtn = () => { const b = $("insChain") && $("insChain").querySelector(".lk-go"); return b ? b.outerHTML.replace('class="lk-go', 'class="lk-go lki-gob') : ""; };
        const p = document.createElement("div");
        p.id = "docPop";
        p.innerHTML = `<div class="doc-card" role="dialog" aria-modal="true" style="max-width:760px">
            <div class="doc-head"><span class="doc-title">LIAISON EN COURS</span><button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button></div>
            <div class="doc-body">
              <div class="lk-info-st${same ? " ok" : ""}">${st}</div>${why ? `<div class="lk-info-why">VALIDATION IMPOSSIBLE : ${esc(why)}</div>` : ""}
              <div class="doc-grid doc-grid-2">
                <span class="doc-lab">DÉSIGNATION CLIENT</span><span class="lk-info-v lk-go-row" data-gk="des" data-gid="${esc(LK.des || "")}">${n("des", LK.des)}</span>
                <span class="doc-lab">LOT</span><span class="lk-info-v lk-go-row" data-gk="lot" data-gid="${esc(LK.lot || "")}">${n("lot", LK.lot)}</span>
                <span class="doc-lab">ACTIVITÉ PRIMAIRE</span><span class="lk-info-v lk-go-row" data-gk="prim" data-gid="${esc(LK.prim || "")}">${n("prim", LK.prim)}</span>
                <span class="doc-lab">ACTIVITÉ SECONDAIRE</span><span class="lk-info-v lk-go-row" data-gk="sec" data-gid="${esc(LK.sec || "")}">${n("sec", LK.sec)}</span>
              </div>
              <div class="lk-info-t">${body2()}</div>
            </div>
            <div class="doc-foot"><span class="lki-go">${goBtn()}</span><button type="button" class="doc-btn" data-cancel>FERMER</button></div>
          </div>`;
        document.body.appendChild(p);
        try { popEnhance(p, "lkinfo"); } catch (e) {}
        const redraw = () => { if (!p.isConnected) return; const b = p.querySelector(".lk-info-t"); if (b) b.innerHTML = body2(); const g = p.querySelector(".lki-go"); if (g) g.innerHTML = goBtn(); };
        p.addEventListener("change", e => {
          const di = e.target.closest(".lki-deb, .lki-fin"), X = shell.__insDly, box = di && di.closest(".lki-dly");
          if (!di || !box) return;
          const task = box.dataset.task, P = (((INS.dlp || {})[task] || [])[0]) || {}, q = { id: P.id || insId(), deb: P.deb || "", fin: P.fin || "" };
          q[di.classList.contains("lki-deb") ? "deb" : "fin"] = di.value;
          if (q.deb && !sviWork(insCal(), q.deb) || q.fin && !sviWork(insCal(), q.fin)) { svToast("JOUR NON TRAVAILLÉ DANS LE CALENDRIER DU BUDGET.", 3500, di); redraw(); return; }
          if (q.deb && q.fin && q.fin < q.deb) { svToast("LA FIN EST AVANT LE DÉBUT.", 3500, di); redraw(); return; }
          if (X && X.apply) X.apply(task, q, { anchor: di }); else { INS.dlp = INS.dlp || {}; INS.dlp[task] = [q]; insSave(); }
          refreshAll(); setTimeout(redraw, 300);
        });
        p.addEventListener("click", e => {
          const cfb = e.target.closest(".cf-btn");
          if (cfb) { e.stopPropagation(); cfOpenMenu(cfb); return; }
          if (e.target.closest(".lki-qlt")) { p.remove(); window.__sviInfoRefresh = null; shell.querySelector('#bdgTabs .bdg-d-tab[data-tab="qlt"]')?.click(); return; }
          const gb = e.target.closest(".lki-gob");
          if (gb) { e.stopPropagation(); const b = $("insChain") && $("insChain").querySelector(".lk-go"); if (b) b.click(); setTimeout(redraw, 400); return; }
          const pl = e.target.closest(".lki-plus");
          if (pl) {
            const k = pl.dataset.k, row = pl.closest(".lki-add"), v = c => String((row.querySelector(c) || {}).value || "").trim().toUpperCase();
            const des = v(".lki-d"), u = v(".lki-u"), qv = v(".lki-q"), pv = v(".lki-p");
            if (!des || !u) { svToast("DÉSIGNATION ET UNITÉ OBLIGATOIRES.", 3000, pl); return; }
            const dup = (INS[k] || []).find(r => !r.t && U_(r.des) === U_(des) && U_(r.u) === U_(u));
            if (dup) { svToast("DOUBLON : " + des + " (" + u + ") EXISTE DÉJÀ — LE CHOISIR DANS " + (k === "prd" ? "DÉTAIL PRODUITS" : "DÉTAIL CHARGES") + ".", 4000, pl); return; }
            const r = { id: insId(), des, u, q: qv === "" ? "" : num(qv), on: false };
            if (k === "chg") r.p = pv === "" ? "" : num(pv);
            INS[k].push(r); LK[k][r.id] = "";
            insSave(); histLog("LIAISONS", "LIGNE AJOUTÉE (LIAISON EN COURS)", (k === "prd" ? "PRODUIT " : "CHARGE ") + des);
            refreshAll(); insRenderChain(); setTimeout(redraw, 200);
            return;
          }
          if (e.target === p || e.target.closest("[data-cancel]")) { p.remove(); window.__sviInfoRefresh = null; return; }
          /* v476 (remarque 2) : toucher une ligne = aller à cette ligne dans son bloc */
          const g = e.target.closest(".lk-go-row");
          if (!g || !g.dataset.gid) return;
          p.remove(); window.__sviInfoRefresh = null;
          const k = g.dataset.gk, id = g.dataset.gid;
          const go = () => {
            const el = k === "des" ? shell.querySelector(`#bdgClientBody tr[data-iid="${CSS.escape(id)}"]`)
              : ["lot", "prim", "sec"].includes(k) ? shell.querySelector(`.ins-hcol[data-ik="${k}"] .ins-li[data-iid="${CSS.escape(id)}"]`)
              : shell.querySelector(`#bdgTabBody tr[data-iid="${CSS.escape(id)}"]`);
            if (!el) { svToast("LIGNE NON AFFICHÉE (FILTRE ?).", 3000); return; }
            el.scrollIntoView({ block: "center", behavior: "smooth" });
            el.classList.add("lk-flash"); setTimeout(() => el.classList.remove("lk-flash"), 1600);
          };
          if (k === "prd" || k === "chg") { const t = shell.querySelector(`#bdgTabs .bdg-d-tab[data-tab="${k}"]`); if (t && !t.classList.contains("active")) { t.click(); setTimeout(go, 250); return; } }
          go();
        });
        window.__sviInfoRefresh = redraw;
      },
      isLinked: (k, id) => { const S = lkLinked(); return !!(S[k] && S[k].has(id)); },
      save: what => { insSave(); histLog("LIAISONS", what, fullRef); } } : null;
    /* bascule SAISIE / LIAISONS */
    const insApplyMode = () => {
      if (!INS) return;
      shell.classList.remove("ins-mode-link");
      insRenderChain();
      insMarkUnlinked();
    };

    const renderClient = () => {
      if (INS) { insRenderClient(); return; }
      const groupsMap = new Map();


      clientLines().forEach(l => {
        const key = desigKey(l);

        if (!groupsMap.has(key)) {
          groupsMap.set(key, {
            key,
            article: l.article,
            designation: l.designation,
            unit: l.unit,
            qty: 0,
            ht: 0,
            price: 0,
            members: []
          });
        }

        groupsMap.get(key).members.push(l);
      });

      groupsMap.forEach(g => {
        /* clé primaire = ligne PRODUIT au prix non nul (cherchée sur toutes
           les lignes de la désignation, même hors filtre) : elle donne le
           prix et l'unité de la désignation client (col. Q, sinon col. J) */
        const k = lines.find(l =>
          desigKey(l) === g.key &&
          l.kind === "prd" &&
          l.cprice !== 0
        );

        if (k) {
          g.price = k.cprice / 1.2;   /* prix de la feuille TTC → HT */
          g.unit = k.dunit || k.unit || g.unit;
        }

        /* quantité = somme des CLÉS PRIMAIRES uniquement : lignes PRODUIT
           au prix non nul. Les clés secondaires (prix nul : coffrage,
           ferraillage…) ne sont pas comptées, même dans la même unité */
        g.members.forEach(l => {
          if (l.kind === "prd" && l.cprice !== 0) g.qty += l.qty;
        });
        g.ht = g.qty * g.price;
      });

      const base = [...groupsMap.values()].sort((x, y) =>
        String(x.article).localeCompare(
          String(y.article),
          undefined,
          { numeric: true }
        )
      );

      const ccols = [
        ["article", "ART", g => g.article, "center"],
        ["designation", "DÉSIGNATION", g => g.designation, ""],
        ["unit", "UPB", g => g.unit, "center"],
        ["qty", "QPB", g => g.qty, "number"],
        ["price", "PPB", g => g.price, "number"],
        ["ht", "MPB HT", g => g.ht, "number"],
        ["tva", "TVA", () => "20,00 %", "number"],
        ["ttc", "MPB TTC", g => g.ht * 1.2, "number"]
      ];

      const shownClient = roApply("client", cfApply("client", ccols, base), g => g.key);
      lastClientKeys = new Set(shownClient.map(g => g.key));
      lastShown.client = { cols: ccols, rows: shownClient };
      /* compteur du titre : lignes affichées (filtres compris) */
      { const t = document.querySelector("#bdgClientTitle .ttl");
        if (t) t.innerHTML = SVI_ICON.client + "DÉSIGNATIONS CLIENT " + svCnt(shownClient.length, base.length); }
      const list = shownClient.sort((x, y) =>
        selDesig.has(y.key) - selDesig.has(x.key)
      );

      $("bdgClientCols").innerHTML = cwCols("client", ccols);
      $("bdgClientHead").closest("table").style.width =
        cwTableW("client", ccols) + "px";
      setTimeout(clientFit, 0);

      $("bdgClientHead").innerHTML =
        "<tr>" + ccols.map(([k, lab, , cls]) => cfHead("client", k, lab, cls)).join("") + "</tr>";



      $("bdgClientBody").innerHTML =
        (list.length
          ? list.map(g => {
              const ht = g.ht;


              return `
                <tr data-desig="${esc(g.key)}"
                    class="${selDesig.has(g.key) ? "selected" : ""}">
                  <td class="center">${esc(g.article)}</td>
                  <td>${esc(g.designation)}</td>
                  <td class="center">${esc(g.unit)}</td>
                  <td class="number">${money(g.qty)}</td>
                  <td class="number">${money(g.price)}</td>
                  <td class="number">${money(ht)}</td>
                  <td class="number">20,00 %</td>
                  <td class="number">${money(ht * 1.2)}</td>
                </tr>
              `;
            }).join("")
          : `<tr><td colspan="8" class="empty">AUCUNE DÉSIGNATION</td></tr>` +
            "");

      const cHT = list.reduce((t, g) => t + g.ht, 0);
      const cUnits = new Set(list.map(g => String(g.unit ?? "").trim().toUpperCase()));
      const cQty = list.length && cUnits.size === 1
        ? money(list.reduce((t, g) => t + g.qty, 0))
        : "";
      $("bdgClientFoot").innerHTML = `
        <tr class="bdg-d-total-row">
          <td></td><td></td><td></td><td class="number">${cQty}</td>
          <td class="number">TOTAL</td>
          <td class="number">${money(cHT)}</td>
          <td class="number">${money(cHT * 0.2)}</td>
          <td class="number">${money(cHT * 1.2)}</td>
        </tr>`;
      coApply("client", $("bdgClientHead").closest("table"));
    };

    const uniq = arr =>
      [...new Set(arr.filter(v => String(v).trim() !== ""))]
        .sort((x, y) =>
          String(x).localeCompare(String(y), undefined, { numeric: true })
        );

    /* filtre dans tous les sens : chaque colonne affiche les valeurs
       des lignes qui respectent TOUS les AUTRES filtres (désignations,
       lots, primaires, secondaires) ; plusieurs choix = union */
    const passes = (l, skip) => {
      const d = new Set([...selDesig, ...rowSet(desigKey)]);
      return (
        inSet(d, desigKey(l)) &&
        inSet(rowSet(x => x.lot), l.lot) &&
        inSet(rowSet(x => x.prim), l.prim) &&
        inSet(rowSet(x => x.sec), l.sec) &&
        (skip === "lot"  || inSet(hSel.lot, l.lot)) &&
        (skip === "prim" || inSet(hSel.prim, l.prim)) &&
        (skip === "sec"  || inSet(hSel.sec, l.sec)) &&
        cons(l, skip)
      );
    };

    const hierLists = () => ({
      lots:  uniq(lines.filter(l => passes(l, "lot")).map(l => l.lot)),
      prims: uniq(lines.filter(l => passes(l, "prim")).map(l => l.prim)),
      secs:  uniq(lines.filter(l => passes(l, "sec")).map(l => l.sec))
    });

    /* retire des filtres les éléments devenus invisibles
       (répété jusqu'à stabilité) */
    const pruneHier = () => {
      for (let guard = 0; guard < 5; guard++) {
        const h = hierLists();
        let changed = false;
        const drop = (set, list) => [...set].forEach(v => {
          if (!list.includes(v)) { set.delete(v); changed = true; }
        });
        drop(hSel.lot, h.lots);
        drop(hSel.prim, h.prims);
        drop(hSel.sec, h.secs);
        if (!changed) break;
      }
    };

    const renderHier = () => {
      if (INS) { insRenderHier(); return; }
      const { lots, prims, secs } = hierLists();


      const col = (title, level, all) => {
        const hcols = [["v", title, v => stripLevelPrefix(v), ""]];
        /* ordre par défaut : champ ORDRE du BDS (inconnus à la fin) */
        const src = { lot: db.lots, prim: db.primaries, sec: db.secondaries }[level] || [];
        const ordOf = new Map();
        src.forEach(x => {
          const k = stripLevelPrefix(x.name).trim().toUpperCase();
          if (k && !ordOf.has(k)) ordOf.set(k, Number(x.order) || 0);
        });
        const ord = v => {
          const o = ordOf.get(String(v).trim().toUpperCase());
          return o === undefined ? Infinity : o;
        };
        const byOrder = [...all].sort((a, b) => ord(a) - ord(b));
        const items = roApply(level, cfApply(level, hcols, byOrder), v => v);
        lastShown.hier[level] = items.map(v => stripLevelPrefix(v));
        items.sort((x, y) =>
          hSel[level].has(y) - hSel[level].has(x)
        );
        const st = cfT(level);
        /* lots / activités : bleu seulement si filtre ou toucher, jamais pour un tri */
        const on = st.f.v || hSel[level].size;
        return `
        <div class="bdg-h-col">
          <div class="bdg-h-head ${on ? "cf-on" : ""}"><span class="cf-wrap"><span class="cf-lab">${title}${svCnt(items.length, all.length)}</span><span class="cf-btn"
            data-cf="${level}" data-col="v" role="button" aria-label="Trier / filtrer">${cfIcon}</span></span><span
            class="col-rs" data-rs="hier" data-col="${level}"></span></div>
          ${
            items.length
              ? items.map(v => `
                  <div class="bdg-h-item ${hSel[level].has(v) ? "selected" : ""}"
                       data-h="${level}"
                       data-v="${esc(v)}"
                       title="${esc(stripLevelPrefix(v))}">${esc(stripLevelPrefix(v))}</div>
                `).join("")
              : `<div class="bdg-h-item" style="opacity:.5;cursor:default">—</div>`
          }
        </div>
      `;
      };

      {
        const w = cwLoad();
        const ws = coKeys("hierCols", ["lot", "prim", "sec"]).map(k => w["hier." + k]);
        $("bdgHier").style.gridTemplateColumns =
          ws.every(Boolean) && window.innerWidth > 650
            ? ws.map(x => x + "px").join(" ")
            : "";
      }

      const hdef = {
        lot: ["LOT", lots], prim: ["ACTIVITÉ PRIMAIRE", prims], sec: ["ACTIVITÉ SECONDAIRE", secs]
      };
      $("bdgHier").innerHTML = coKeys("hierCols", ["lot", "prim", "sec"])
        .map(k => col(hdef[k][0], k, hdef[k][1])).join("");

      /* plus de texte « FILTRES : … » dans le titre du bloc */
    };

    /* garde la vue là où l'utilisateur a la main : page et cadres
       à défilement interne (désignations, lots/tâches, détail) */
    const keepScroll = fn => {
      const sel = ".bdg-d-client-scroll, .bdg-h-col, .bdg-d-tabbody .bdg-d-scroll, .bdg-d-tabbody .dlyg-l, .bdg-d-tabbody .dlyg-r";
      /* FORMAT : un tableau redessiné ne fait jamais bouger l'écran (vertical ET horizontal) */
      /* redessins enchaînés : on garde la position d'avant le premier (pas celle, provisoire, d'entre deux) */
      const P = keepScroll.pend && performance.now() < keepScroll.pend.until ? keepScroll.pend : null;
      const saved = P ? P.saved : [...shell.querySelectorAll(sel)].map(el => [el.scrollTop, el.scrollLeft]);
      const toTop = keepScroll.toTop || (P ? P.toTop : false); keepScroll.toTop = false;
      const x = P ? P.x : window.scrollX, y = P ? P.y : window.scrollY;
      keepScroll.pend = { saved, toTop, x, y, until: performance.now() + 200 };
      const active = document.activeElement;
      /* v512 (remarque 79) : la cellule active (ou celle qu'Entrée / Tab / les flèches viennent de viser) est retrouvée après le redessin */
      let fk = null;
      try {
        fk = window.sviCellKey ? window.sviCellKey(active) : null;
        const lg = window.__sviLastGo;
        if (!fk && lg && performance.now() - lg.t < 500) fk = lg.k;
      } catch (e) { fk = null; }
      if (active && active.blur &&
          !active.classList.contains("bdg-tva-input") &&
          !active.closest("#cfMenu")) {
        active.blur();
      }

      fn();

      const restore = () => {
        /* v531 : une ligne ancrée (dépôt dans la liste des lots) garde sa place : pas de remise en position par-dessus */
        if (keepScroll.hold && performance.now() < keepScroll.hold) return;
        shell.querySelectorAll(sel).forEach((el, i) => {
          if (saved[i] === undefined) return;
          /* après un filtre : si la partie regardée n'existe plus, premières lignes retenues */
          el.scrollTop = toTop && saved[i][0] > el.scrollHeight - el.clientHeight ? 0 : saved[i][0];
          el.scrollLeft = saved[i][1];
        });
        window.scrollTo(x, y);
      };
      restore();
      if (fk && window.sviCellFind && window.__sviGrid) {
        const back = () => { const a = document.activeElement; if (a && a !== document.body && window.sviCellOf && sviCellOf(a)) return; const el = window.sviCellFind(fk); if (el && el.isConnected) window.__sviGrid.go(el.tagName === "TD" ? el : (sviCellOf(el) || el), true); };
        back(); setTimeout(back, 0);
      }
      requestAnimationFrame(restore);
      /* un tableau qui s'élargit juste après (largeur des en-têtes) : position remise avant l'affichage */
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(restore);
        shell.querySelectorAll(sel).forEach(el => [...el.children].forEach(c => ro.observe(c)));
        setTimeout(() => ro.disconnect(), 200);
      }
      /* mises en page tardives (largeurs d'en-tête, onglets) : position remise encore une fois */
      setTimeout(() => { restore(); }, 120);
      setTimeout(() => { if (keepScroll.pend && performance.now() >= keepScroll.pend.until) keepScroll.pend = null; }, 220);
    };

    const markFiltered = () => {
      const rowsOf = kind =>
        [...selRows].some(g => g.startsWith(kind.toUpperCase() + "|"));
      shell.querySelectorAll("#bdgTabs .bdg-d-tab").forEach(b => {
        const t = b.dataset.tab;
        /* bleu de l'onglet : seulement un choix de lignes (budget validé), pas le filtre (loupe) */
        b.classList.toggle("cf-on", !INS && (t === "chg" || t === "prd") && rowsOf(t));
      });
      $("bdgClientTitle")?.classList.toggle("cf-on", !INS && selDesig.size > 0);
      sviMarkEmptyTabs(shell);
    };

    const refreshAll = () => {
      grpFlush();
      /* v523 (remarque 4) : après une suppression, plus de filtre sur des lignes disparues — la mémoire des cases cochées
         est vidée et un rond choisi sur une ligne supprimée est libéré (tous les tableaux et listes) */
      ICL = null;
      try {
        if (INS && LK) {
          ["des", "lot", "prim", "sec"].forEach(k => { if (LK[k] && !(INS[k] || []).some(r => r.id === LK[k])) LK[k] = null; });
          ["chg", "prd"].forEach(k => { if (LK[k] && typeof LK[k] === "object") Object.keys(LK[k]).forEach(id => { if (!(INS[k] || []).some(r => r.id === id)) delete LK[k][id]; }); });
        }
      } catch (e) {}
      keepScroll(() => {
        computeCons(false);
        pruneHier();

        renderClient();
        computeCons();
        renderHier();
        renderTab();
        markFiltered();
        REC_KINDS.forEach(renderRec);
        if (window.__sviHistRefresh) window.__sviHistRefresh();
        if (window.__sviImpRefresh) window.__sviImpRefresh();
        if (window.__sviDpkRefresh) window.__sviDpkRefresh();
        if (window.__sviInfoRefresh) window.__sviInfoRefresh();
        if (window.__sviSdRefresh) window.__sviSdRefresh();
        if (INS) insApplyMode();
      });
      if (typeof stateSave === "function") stateSave();
    };
    /* v524 (remarque 2) : un tableau ou une liste vidé(e) par les cases cochées / filtres des AUTRES blocs ne reste jamais muet :
       un bandeau dit pourquoi et TOUT RÉAFFICHER décoche tout et efface les filtres de tous les blocs (tous les tableaux et listes) */
    const insEmptyHints = () => {
      if (!INS || !INS_EDIT) return;
      const spots = [
        ["des", () => shell.querySelector('table.ins-table[data-ik="des"]')],
        ["chg", () => shell.querySelector('table.ins-table[data-ik="chg"]')],
        ["prd", () => shell.querySelector('table.ins-table[data-ik="prd"]')],
        ["lot", () => shell.querySelector('.ins-hcol[data-ik="lot"]')],
        ["prim", () => shell.querySelector('.ins-hcol[data-ik="prim"]')],
        ["sec", () => shell.querySelector('.ins-hcol[data-ik="sec"]')]];
      spots.forEach(([k, get]) => {
        const box = get(); if (!box || box.offsetParent === null) return;
        const total = (INS[k] || []).filter(r => !r.t).length;
        /* v607 (remarque 82) : seules les vraies lignes comptent — des titres (lots, groupes) restés seuls ne font pas un bloc « rempli » */
        const realId = id => { const r = (INS[k] || []).find(x => x.id === id); return !!r && !r.t; };
        const shown = box.tagName === "TABLE" ? [...box.querySelectorAll("tbody tr[data-iid], tbody tr[data-grp]")].filter(tr => tr.dataset.grp || realId(tr.dataset.iid)).length
          : [...box.querySelectorAll(".ins-li[data-iid]")].filter(li => realId(li.dataset.iid)).length;
        const want = total > 0 && shown === 0;
        const host = box.tagName === "TABLE" ? box.parentElement : box;
        let h = host.querySelector(":scope > .svi-empty");
        if (!want) { if (h) h.remove(); return; }
        /* v527 (remarque 5) : rien n'est décoché tout seul — le bandeau dit QUELLES cases cochées se contredisent,
           avec un bouton par bloc pour les décocher (et TOUT RÉAFFICHER) */
        const NM = { des: "DÉSIGNATION(S)", lot: "LOT(S)", prim: "ACTIVITÉ(S) PRIMAIRE(S)", sec: "ACTIVITÉ(S) SECONDAIRE(S)", chg: "CHARGE(S)", prd: "PRODUIT(S)", dly: "TÂCHE(S) DU PLANNING", lnk: "LIAISON(S) DE MARGE", iso: "BRANCHE ISOLÉE" };
        const nl = (INS.links || []).filter(l => l.on === true).length;
        const ck = ["des", "lot", "prim", "sec", "chg", "prd"].filter(x => x !== k).map(x => [x, (INS[x] || []).filter(r => !r.t && r.on === true).length]).filter(([, n]) => n)
          .concat(shell.__dlySel && shell.__dlySel.size ? [["dly", shell.__dlySel.size]] : [])
          .concat(nl ? [["lnk", nl]] : []).concat(shell.__dlyIso ? [["iso", 1]] : []);
        const sig = k + ":" + ck.map(([x, n]) => x + n).join(",") + ":" + total;
        if (h && h.dataset.sig === sig) return;
        if (!h) { h = document.createElement("div"); h.className = "svi-empty"; if (box.tagName === "TABLE") box.after(h); else box.appendChild(h); }
        h.dataset.sig = sig;
        const why = "AUCUNE LIGNE POUR LES FILTRES EN COURS" + (ck.length ? " : " + ck.map(([x, n]) => (x === "iso" ? "" : n + " ") + NM[x] + (x === "iso" ? "" : " COCHÉE(S)")).join(" + ") + "." : " (LOUPES DES BLOCS).");
        h.innerHTML = `<span>${esc(why)}</span>${ck.map(([x, n]) => `<button type="button" class="svi-empty-b svi-empty-k" data-clrk="${x}">${x === "iso" ? "RÉAFFICHER TOUTE L'ARBORESCENCE" : "DÉCOCHER " + esc(NM[x]) + " (" + n + ")"}</button>`).join("")}<button type="button" class="svi-empty-b" data-clrall>EFFACER TOUS LES FILTRES</button>`;
        /* message aussitôt, près du bloc vidé (une fois par situation) */
        if (ck.length && shell.__emptySig !== sig) { shell.__emptySig = sig; try { svToast(why, 4000, h); } catch (e) {} }
      });
    };
    shell.__insClrAll = () => {
      ["des", "lot", "prim", "sec", "chg", "prd"].forEach(k => { (INS[k] || []).forEach(r => { if (r.on === true) r.on = false; }); ONLYC[k] = false; });
      if (shell.__dlySel) shell.__dlySel.clear(); shell.__dlyIso = null;
      (INS.links || []).forEach(l => { if (l.on === true) l.on = false; }); (INS.inc || []).forEach(x => { if (x.on === true) x.on = false; });
      try { ["client", "hier", "detail"].forEach(b => insFiltPlan(b).T.forEach(t => { if (CF[t]) CF[t].f = {}; })); } catch (e) {}
      insSave(); refreshAll();
      svToast("TOUTES LES CASES DÉCOCHÉES ET TOUS LES FILTRES EFFACÉS.", 2200);
    };
    if (!shell.__emptyBound) {
      shell.__emptyBound = true;
      shell.addEventListener("click", e => {
        const k1 = e.target.closest && e.target.closest("[data-clrk]");
        if (k1) { e.preventDefault(); e.stopPropagation(); if (shell.__insClrK) shell.__insClrK(k1.dataset.clrk); return; }
        if (!e.target.closest || !e.target.closest("[data-clrall]")) return; e.preventDefault(); e.stopPropagation(); if (shell.__insClrAll) shell.__insClrAll(); }, true);
      let q = 0;
      new MutationObserver(() => { if (q) return; q = requestAnimationFrame(() => { q = 0; try { shell.__insEmptyHints && shell.__insEmptyHints(); } catch (e) {} }); }).observe(shell, { childList: true, subtree: true });
    }
    shell.__insEmptyHints = insEmptyHints;
    /* décocher un seul bloc */
    shell.__insClrK = k => { if (k === "iso") { shell.__dlyIso = null; refreshAll(); return; }
      if (k === "lnk") { (INS.links || []).forEach(l => { if (l.on === true) l.on = false; }); insSave(); refreshAll(); return; }
      if (k === "dly") { if (shell.__dlySel) shell.__dlySel.clear(); refreshAll(); return; } (INS[k] || []).forEach(r => { if (r.on === true) r.on = false; }); ONLYC[k] = false; insSave(); refreshAll(); };

    const tvaFor = l =>
      l.ttcAmount !== undefined ? l.ttcAmount - l.amount : l.amount * l.tva / 100;

    /* ligne TOTAL en pied des onglets Détail charge / produit */
    const tabFootHTML = (list, prd) => {
      /* produits : la quantité totale ne compte que les clés primaires
         (lignes au prix non nul), comme dans les désignations client */
      const qty = list.reduce((t, l) =>
        t + (prd && !l.priceTTC ? 0 : l.qty), 0);
      const ht = list.reduce((t, l) => t + l.amount, 0);
      const tva = list.reduce((t, l) => t + tvaFor(l), 0);
      const lead = prd ? 6 : 2;   /* colonnes avant « TOTAL » */
      /* quantité (et prix moyen) seulement si toutes les unités sont identiques */
      const units = new Set(list.map(l => String(l.dunit ?? "").trim().toUpperCase()));
      const sameUnit = list.length > 0 && units.size === 1;
      return `
        <tr class="bdg-d-total-row">
          ${
            sameUnit
              ? `${"<td></td>".repeat(lead)}
                 <td class="number">TOTAL</td>
                 <td class="number">${money(qty)}</td>
                 <td class="number">${money(qty ? ht / qty : 0)}</td>`
              /* unités différentes : « TOTAL » juste avant le montant HT */
              : `${"<td></td>".repeat(lead + 2)}
                 <td class="number">TOTAL</td>`
          }
          <td class="number">${money(ht)}</td>
          <td class="number" id="bdgFtTVA">${money(tva)}</td>
          <td class="number" id="bdgFtTTC">${money(ht + tva)}</td>
        </tr>`;
    };


    const tcolsFor = prd => [
      /* détail produits : pas de colonne ART (FORMAT 6) */
      ...(prd ? [] : [["article", "ART", l => l.article, "center"]]),
      ["detail", prd ? "DÉSIGNATION PRODUIT" : "DÉSIGNATION CHARGE", l => l.detail, ""],
      ["unit", prd ? "UPB" : "UCB", l => l.unit, "center"],
      ...(prd ? [
        ["nbr", "NBR", l => String(l.nbr ?? ""), "number"],
        ["d1", "DIM 1", l => String(l.dims[0] ?? ""), "number"],
        ["d2", "DIM 2", l => String(l.dims[1] ?? ""), "number"],
        ["d3", "DIM 3", l => String(l.dims[2] ?? ""), "number"]
      ] : []),
      ["qty", prd ? "QPB" : "QCB", l => l.qty, "number"],
      ["price", prd ? "PPB" : "PCB", l => l.price, "number"],
      ["amount", prd ? "MPB HT" : "MCB HT", l => l.amount, "number"],
      ["tva", "TVA %", l => String(l.tva ?? ""), "number"],
      ["ttc", prd ? "MPB TTC" : "MCB TTC", l => l.amount + l.tvaAmt, "number"]
    ];

    /* recalcule les contraintes propagées par les filtres de colonne */
    const computeCons = (withClient = true) => {
      const has = t => CF[t] && Object.keys(CF[t].f).length > 0;
      CONS.client = withClient && has("client") ? new Set(lastClientKeys) : null;

      let det = null;
      ["chg", "prd"].forEach(kind => {
        if (!has(kind)) return;
        const all = lines.filter(l => l.kind === kind);
        const shown = cfApply(kind, tcolsFor(kind === "prd"), groupLines(all), true);
        det = det || { d: new Set(), lot: new Set(), prim: new Set(), sec: new Set() };
        shown.forEach(g => g.members.forEach(l => {
          det.d.add(desigKey(l));
          if (String(l.lot).trim()) det.lot.add(l.lot);
          if (String(l.prim).trim()) det.prim.add(l.prim);
          if (String(l.sec).trim()) det.sec.add(l.sec);
        }));
      });
      CONS.det = det;

      CONS.h = {};
      ["lot", "prim", "sec"].forEach(lv => {
        if (CF[lv] && CF[lv].f.v) CONS.h[lv] = CF[lv].f.v;
      });
    };

