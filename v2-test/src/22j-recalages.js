    /* =========================================================
       v693 : RECALAGE (décisions du 29/10/2026, soir) — remise en phase d'une étape VALIDÉE (budget initial ou avenant)
       avec la réalité du chantier, après chaque réunion de chantier ; reste dans le module budget.
       - Un recalage = un budget de la liste de l'appareil { ref: « étape-Rn », rclOf: étape, rcn: n, state: instance (EN COURS)
         | valide (ENREGISTRÉ) } ; caché de la liste mère, rangé dans le bloc RECALAGES de son étape.
       - NOUVEAU RECALAGE (menu ⋯ d'une étape validée ou d'un recalage) : le premier part de l'étape validée, chaque suivant du
         dernier recalage enregistré ; un seul EN COURS à la fois.
       - Tout se modifie, sauf DÉSIGNATIONS CLIENT et leurs prix (lecture seule : ils ne changent que par avenant).
         Point d'accroche pour la réalisation : sviRclUsed(ligne) = ligne déjà utilisée en réalisation (toujours faux pour l'instant).
       - 🔒 = ENREGISTRER LE RECALAGE : il devient le budget de travail de l'étape (consolidé, recalage suivant) et une version Ⓐ
         « RECALAGE Rn » est prise dans le bloc VERSIONS de l'étape. L'étape validée d'origine ne change jamais.
       ========================================================= */
    const RCL_OF = budget.inst && budget.inst.rclOf ? budget.inst.rclOf : "";
    const RCL_STAGE = budget.inst && !budget.inst.virtual && !RCL_OF && budget.inst.state === "valide" ? budget.inst.ref : "";
    const rclHist = (r, a, d) => { try { const k = "svi_hist_v1:" + r, l = JSON.parse(localStorage.getItem(k) || "[]") || []; l.push({ t: new Date().toISOString(), b: "RECALAGE", a, d: String(d || "").toUpperCase(), u: typeof sviUser === "function" ? sviUser() : "" }); localStorage.setItem(k, JSON.stringify(l.slice(-1000))); } catch (e) {} };
    /* nouveau recalage d'une étape : depuis le dernier enregistré, sinon l'étape validée */
    const rclNew = stageRef => {
      const L = sviInstGet(), st = L.find(x => x.ref === stageRef);
      if (!st || st.state !== "valide") { sviAlert("UN RECALAGE SE FAIT SUR UNE ÉTAPE VALIDÉE.", "NOUVEAU RECALAGE"); return; }
      const R = sviRclOf(stageRef);
      const cur = R.find(x => x.state !== "valide");
      if (cur) { svToast("UN RECALAGE EST DÉJÀ EN COURS : R" + cur.rcn + ". L'ENREGISTRER OU LE SUPPRIMER D'ABORD.", 4500); window.__sviAvOpen(cur.ref, stageRef); return; }
      const last = R.filter(x => x.state === "valide").pop();
      const src = JSON.parse(JSON.stringify((last || st).data || {}));
      delete src.ver; delete src.vfz;
      const n = R.reduce((m, x) => Math.max(m, x.rcn || 0), 0) + 1;
      const now = new Date(), p2 = v => String(v).padStart(2, "0");
      const it = { ref: stageRef + "-R" + n, rclOf: stageRef, rcn: n, project: st.project, intitule: st.intitule, client: st.client, state: "instance",
        created: now.getFullYear() + "-" + p2(now.getMonth() + 1) + "-" + p2(now.getDate()) + "T" + p2(now.getHours()) + ":" + p2(now.getMinutes()),
        u: typeof sviUser === "function" ? sviUser() : "", from: last ? last.ref : stageRef, data: src };
      sviInstSet(L.concat(it));
      rclHist(stageRef, "NOUVEAU RECALAGE", "R" + n + " — DEPUIS " + (last ? "R" + last.rcn : "L'ÉTAPE VALIDÉE"));
      window.__sviAvOpen(it.ref, stageRef);
    };
    shell.__rclNew = () => rclNew(RCL_OF || (budget.inst && budget.inst.ref));
    /* 🔒 ENREGISTRER LE RECALAGE */
    shell.__rclSave = async () => {
      if (!RCL_OF || budget.inst.state === "valide") return;
      if (!(await svConfirm({ title: "ENREGISTRER LE RECALAGE R" + budget.inst.rcn, text: "R" + budget.inst.rcn + " DEVIENT LE BUDGET DE TRAVAIL DE L'ÉTAPE " + RCL_OF + " (CONSOLIDÉ, RECALAGE SUIVANT). UNE VERSION AUTOMATIQUE « RECALAGE R" + budget.inst.rcn + " » EST PRISE. L'ÉTAPE VALIDÉE D'ORIGINE NE CHANGE PAS.", ok: "ENREGISTRER", tone: "neutral" }))) return;
      const L = sviInstGet(), me = L.find(x => x.ref === ref), st = L.find(x => x.ref === RCL_OF);
      if (!me || !st) return;
      const now = new Date(), p2 = v => String(v).padStart(2, "0"), at = now.getFullYear() + "-" + p2(now.getMonth() + 1) + "-" + p2(now.getDate()) + "T" + p2(now.getHours()) + ":" + p2(now.getMinutes());
      me.data = JSON.parse(JSON.stringify(INS)); me.state = "valide"; me.validated = at;
      const D = st.data = st.data || {}; D.vfz = D.vfz || [];
      const snap = JSON.parse(JSON.stringify(INS)); delete snap.ver; delete snap.vfz;
      const n = D.vfz.reduce((m, x) => Math.max(m, x.n || 0), 0) + 1;
      D.vfz.push({ id: insId(), n, kind: "RECALAGE R" + me.rcn, auto: true, u: typeof sviUser === "function" ? sviUser() : "", date: at, d: snap });
      sviInstSet(L.map(x => x.ref === me.ref ? me : x.ref === st.ref ? st : x)); await sviInstFlush();
      histLog("RECALAGE", "ENREGISTRÉ", "R" + me.rcn); rclHist(RCL_OF, "RECALAGE ENREGISTRÉ", "R" + me.rcn + " — VERSION " + n);
      svToast("RECALAGE R" + me.rcn + " ENREGISTRÉ — VERSION " + n + " PRISE.", 3500);
      window.__sviAvOpen(ref, RCL_OF);
    };
    /* ‹ › : recalage précédent / suivant */
    shell.__rclGo = d => {
      const R = sviRclOf(RCL_OF), i = R.findIndex(x => x.ref === ref), j = i + d;
      if (i < 0 || j < 0 || j >= R.length) { svToast(d < 0 ? "PAS DE RECALAGE AVANT." : "PAS DE RECALAGE APRÈS.", 2000); return; }
      window.__sviAvOpen(R[j].ref, RCL_OF);
    };
    /* bloc RECALAGES (sous VERSIONS) : une ligne par recalage ; toucher = l'ouvrir */
    const RCL_COLS = [["rno", "RECALAGE", x => "R" + x.rcn, ""], ["rcdate", "DATE", x => svDT(x.created || ""), ""], ["ruser", "PAR", x => x.u || "", ""],
      ["rstate", "ÉTAT", x => x.state === "valide" ? "ENREGISTRÉ" : "EN COURS", ""], ["rsav", "ENREGISTRÉ LE", x => x.state === "valide" ? svDT(x.validated || "") : "", ""]];
    let rclShown = [];
    shell.__rclData = () => { const oc = coOrder("vrcl", RCL_COLS); return { head: oc.map(c => c[1]), rows: rclShown.map(x => oc.map(c => c[2](x))) }; };
    const rclRender = () => {
      const blk = shell.querySelector(".blk-rcl"), t = $("rclTable");
      if (!blk || !t) return;
      const stg = RCL_OF || (budget.inst && !budget.inst.virtual ? budget.inst.ref : "");
      const all = stg ? sviRclOf(stg) : [];
      blk.hidden = !all.length;
      if (blk.hidden) return;
      const rows = cfApply("vrcl", RCL_COLS, [...all].reverse());
      rclShown = rows;
      const ttl = $("rclTitle"); if (ttl) ttl.innerHTML = SVI_ICON.rcl + "RECALAGES " + svCnt(rows.length, all.length);
      const oc = coOrder("vrcl", RCL_COLS);
      t.style.width = cwTableW("vrcl", RCL_COLS) + "px";
      t.innerHTML = `<colgroup>${cwCols("vrcl", oc)}</colgroup><thead><tr>${oc.map(c => cfHead("vrcl", c[0], c[1], c[3])).join("")}</tr></thead>
        <tbody>${rows.map(x => `<tr class="rcl-row${x.ref === ref ? " ver-act" : ""}${x.state !== "valide" ? " rcl-cours" : ""}" data-rcl="${esc(x.ref)}">${oc.map(c => `<td>${esc(c[2](x))}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${oc.length}" class="empty">AUCUNE LIGNE (FILTRE)</td></tr>`}</tbody>`;
    };
    shell.__rclRender = rclRender;
    shell.querySelector(".blk-rcl")?.addEventListener("click", e => {
      if (e.target.closest(".cf-btn, .col-rs, .blk-tools, .blk-grip, .blk-rsz")) return;
      const tr = e.target.closest("tr[data-rcl]"); if (!tr) return;
      e.stopPropagation();
      if (tr.dataset.rcl === ref) return;
      window.__sviAvOpen(tr.dataset.rcl, RCL_OF || budget.inst.ref);
    });
