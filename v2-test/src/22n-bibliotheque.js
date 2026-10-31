    /* =========================================================
       v739 (prompt du 31/10, point 2) : BIBLIOTHÈQUE DE PRIX dans le budget
       - activité secondaire choisie par son rond : pastille RECETTES n dans le bandeau de liaison ;
       - fenêtre RECETTES — ACTIVITÉ (FORMAT 267) : d'abord celles déjà utilisées avec la même désignation ou le même lot ;
       - APPLIQUER : charges créées sur la tâche (lot › activité secondaire), quantité = quantité pour 1 unité × quantité de produit de la tâche ;
         ensuite modifiables comme toute charge ; l'usage (désignation, lot) est gardé dans la bibliothèque ;
       - FIGER : les recettes du budget sont gardées dans la bibliothèque (sans doublon).
       ========================================================= */
    shell.__libLearn = () => { if (!INS) return 0; const L = sviLibGet(), n0 = L.length; sviLibFromBudget(INS, budget.inst ? budget.inst.ref : "").forEach(R => sviLibAdd(L, R)); sviLibSet(L); return L.length - n0; };
    const libTaskQ = (lo, se) => { const ids = new Set(); (INS.links || []).filter(l => l.lot === lo && l.sec === se).forEach(l => (l.prd || []).forEach(x => ids.add(x.id))); return [...ids].reduce((t, id) => { const p = INS.prd.find(x => x.id === id); return t + (p ? insPrdQ(p) || 0 : 0); }, 0); };
    const libPickWin = () => {
      const s = LK.sec && INS.sec.find(x => x.id === LK.sec); if (!s) return;
      const desN = LK.des ? U_((INS.des.find(x => x.id === LK.des) || {}).des || "") : "", lotN = LK.lot ? U_((INS.lot.find(x => x.id === LK.lot) || {}).v || "") : "";
      const used = R => (desN && (R.des || []).includes(desN)) || (lotN && (R.lot || []).includes(lotN));
      const L = sviLibGet().filter(R => U_(R.act) === U_(s.v)).sort((a, b) => (used(b) ? 1 : 0) - (used(a) ? 1 : 0) || String(a.nom).localeCompare(String(b.nom), "fr"));
      const Q = LK.lot ? libTaskQ(LK.lot, LK.sec) : 0, cu = R => (R.chg || []).reduce((t, c) => t + num(c.k || 0) * num(c.p || 0), 0);
      const d = sviWinNew();
      d.innerHTML = sviWinCard({ cls: "pv-card lib-pick", close: "data-x", title: "RECETTES — " + esc(U_(s.v)),
        body: `<div class="pv-sub">${LK.lot ? "TÂCHE : " + esc(lotN) + " › " + esc(U_(s.v)) + " — QUANTITÉ DE PRODUIT : " + esc(money(Q)) + " " + esc(U_(s.u || "")) : "CHOISIR AUSSI LE LOT POUR APPLIQUER UNE RECETTE À UNE TÂCHE."}</div>
          <div class="pv-scroll">${L.map((R, i) => `<label class="lib-r${used(R) ? " lib-used" : ""}"><input type="radio" name="libr" value="${esc(R.id)}"${i ? "" : " checked"}>
            <span class="lib-h"><b>${esc(U_(R.act))} — ${esc(R.nom)}</b>${used(R) ? ' <span class="lib-tag">DÉJÀ UTILISÉE</span>' : ""}${R.chk ? ' <span class="lib-chk">À VÉRIFIER</span>' : ""} <small>${esc(money(cu(R)))} DH / ${esc(R.u || "U")}</small></span>
            <table class="pv-t lib-t"><thead><tr><th>CHARGE</th><th class="center">UNITÉ</th><th class="number">QTÉ POUR 1 ${esc(R.u || "U")}</th><th class="number">PCB</th></tr></thead><tbody>${(R.chg || []).map(c => `<tr><td>${esc(c.des)}</td><td class="center">${esc(c.u)}</td><td class="number">${esc(indNum(num(c.k || 0), 4))}</td><td class="number">${esc(money(num(c.p || 0)))}</td></tr>`).join("")}</tbody></table></label>`).join("") || `<div class="fz-none">AUCUNE RECETTE POUR CETTE ACTIVITÉ.</div>`}</div>`,
        foot: `<button type="button" class="svc-b" data-x>ANNULER</button>${INS_EDIT && L.length ? `<button type="button" class="svc-b svc-ok svc-neutral" data-libok>APPLIQUER</button>` : ""}` });
      sviWinShow(d);
      d.addEventListener("click", e => {
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
        if (!e.target.closest("[data-libok]")) return;
        const id = (d.querySelector("input[name=libr]:checked") || {}).value, R = L.find(x => x.id === id); if (!R) return;
        if (!LK.lot) { svToast("CHOISIR AUSSI LE LOT : LA RECETTE S'APPLIQUE À UNE TÂCHE (LOT › ACTIVITÉ SECONDAIRE).", 4000, e.target); return; }
        const links = (INS.links || []).filter(l => l.lot === LK.lot && l.sec === LK.sec);
        if (!links.length || !(Q > 0)) { svToast("LIER D'ABORD LA TÂCHE AVEC SES PRODUITS : LES QUANTITÉS SE CALCULENT SUR LA QUANTITÉ DE PRODUIT.", 4500, e.target); return; }
        const inTask = new Set(links.flatMap(l => (l.chg || []).map(x => x.id))), skip = [];
        let n = 0;
        (R.chg || []).forEach(c => {
          const same = INS.chg.find(r => inTask.has(r.id) && !r.t && U_(r.des) === U_(c.des) && U_(r.u) === U_(c.u));
          if (same) { skip.push(c.des + " (DÉJÀ DANS LA TÂCHE)"); return; }
          const other = INS.chg.find(r => !r.t && U_(r.des) === U_(c.des) && U_(r.u) !== U_(c.u));
          if (other) { skip.push(c.des + " (EXISTE DÉJÀ EN " + U_(other.u) + ")"); return; }
          const art = (INS.chg.find(r => !r.t && U_(r.des) === U_(c.des)) || {}).art || "";
          const row = { id: insId(), art, des: U_(c.des), u: U_(c.u), q: Math.round(num(c.k || 0) * Q * 1000) / 1000, p: num(c.p || 0) };
          INS.chg.push(row); links[0].chg = (links[0].chg || []).concat([{ id: row.id }]); n++;
        });
        const LL = sviLibGet(), X = LL.find(x => x.id === R.id); if (X) { X.des = [...new Set([...(X.des || []), desN].filter(Boolean))]; X.lot = [...new Set([...(X.lot || []), lotN].filter(Boolean))]; sviLibSet(LL); }
        d.remove();
        histLog("CHARGES", "RECETTE APPLIQUÉE", U_(R.act) + " — " + R.nom + " : " + n + " CHARGE(S) SUR " + lotN + " › " + U_(s.v));
        insSave(); refreshAll();
        svToast(n + " CHARGE(S) CRÉÉE(S)" + (skip.length ? " ; NON REPRISES : " + skip.join(", ") : "") + ".", skip.length ? 6000 : 3000);
      });
    };
    shell.__libPick = libPickWin;
    if (!shell.__libBound) { shell.__libBound = true; shell.addEventListener("click", e => { if (e.target.closest && e.target.closest("#insChain .lk-lib")) { e.stopPropagation(); if (shell.__libPick) shell.__libPick(); } }, true); }
