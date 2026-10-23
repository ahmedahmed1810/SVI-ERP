    /* ===== v530 : CONDITIONNEMENT (premier essai) — bouton dans la case DÉSIGNATION d'une charge =====
       Une seule fenêtre pour toutes les charges : la charge (et ses lignes identiques : même désignation, même unité)
       s'achète par UNITÉ D'ACHAT (barre, palette, sac…) puis se transporte par CAMION.
       - PAR QUANTITÉ TOTALE : unités d'achat = ⌈ quantité ÷ contenu d'une unité ⌉ ; camions = ⌈ unités ÷ unités par camion ⌉
       - PAR MORCEAUX (DÉCOUPE) : barres de longueur L (12 m) ; morceaux = DIM 1 × NBR des produits liés à cette charge
         (modifiables) ; découpe cherchée pour acheter le moins de barres et laisser le moins de chutes
       Réglages gardés par désignation de charge (INS.cond). Même tableau de résultat pour les deux modes. */
    const COND_K = r => U_(r.des) + "|" + U_(r.u);
    /* remarque 4 (v542) : le conditionnement appartient à l'ARTICLE (CHS) — gardé pour tous les budgets (sur l'appareil, en attendant
       la colonne CHS côté Google Sheets) ; la copie du budget (INS.cond) reste lue pour les budgets déjà réglés */
    const condAll = () => { try { return JSON.parse(localStorage.getItem("svi_cond_chs_v1") || "{}") || {}; } catch (e) { return {}; } };
    const condGet = key => condAll()[key] || (INS.cond || {})[key] || null;
    const condRows = id => { const r = INS.chg.find(x => x.id === id); return r ? INS.chg.filter(x => !x.t && COND_K(x) === COND_K(r)) : []; };
    /* morceaux : produits des liaisons de ces charges — longueur = DIM 1, nombre = NBR (× quantité liée si plusieurs) */
    const condPieces = rows => {
      const ids = new Set(rows.map(r => r.id)), out = new Map();
      (INS.links || []).filter(l => (l.chg || []).some(x => ids.has(x.id))).forEach(l => (l.prd || []).forEach(x => {
        const p = INS.prd.find(q => q.id === x.id);
        if (!p) return;
        const L = num(p.d1), n = Math.max(1, Math.round(num(p.nbr) || 1));
        if (!(L > 0)) return;
        const k = String(Math.round(L * 1000) / 1000);
        out.set(k, (out.get(k) || 0) + n);
      }));
      return [...out].map(([L, n]) => ({ L: Number(L), n })).sort((a, b) => b.L - a.L);
    };
    /* découpe : premier emplacement possible, morceaux du plus long au plus court, puis essai d'améliorer
       (une barre vidée et ses morceaux remis ailleurs) — assez bon pour un chantier, rapide sur iPad */
    const condCut = (pieces, BL, kerf = 0) => {
      const all = [];
      pieces.forEach(p => { for (let i = 0; i < p.n; i++) all.push(p.L); });
      all.sort((a, b) => b - a);
      if (all.some(L => L > BL + 1e-9)) return { err: "UN MORCEAU EST PLUS LONG QUE LA BARRE (" + money(Math.max(...all)) + " M)." };
      const pack = list => {
        const bars = [];
        list.forEach(L => {
          let best = -1, rest = Infinity;
          bars.forEach((b, i) => { const r = BL - b.used - (b.cuts.length ? kerf : 0) - L; if (r >= -1e-9 && r < rest) { rest = r; best = i; } });
          if (best < 0) bars.push({ used: L, cuts: [L] });
          else { const b = bars[best]; b.used += L + (b.cuts.length ? kerf : 0); b.cuts.push(L); }
        });
        return bars;
      };
      let bars = pack(all);
      /* amélioration : vider la barre la moins remplie et replacer ses morceaux dans les autres */
      for (let g = 0; g < 30 && bars.length > 1; g++) {
        const sorted = bars.slice().sort((a, b) => a.used - b.used), low = sorted[0];
        const others = bars.filter(b => b !== low).map(b => ({ used: b.used, cuts: b.cuts.slice() }));
        let ok = true;
        low.cuts.slice().sort((a, b) => b - a).forEach(L => {
          let best = -1, rest = Infinity;
          others.forEach((b, i) => { const r = BL - b.used - kerf - L; if (r >= -1e-9 && r < rest) { rest = r; best = i; } });
          if (best < 0) ok = false; else { others[best].used += L + kerf; others[best].cuts.push(L); }
        });
        if (!ok) break;
        bars = others;
      }
      /* plan : barres identiques regroupées */
      const plan = new Map();
      bars.forEach(b => { const k = b.cuts.slice().sort((a, c) => c - a).map(x => money(x)).join(" + "); plan.set(k, { n: ((plan.get(k) || {}).n || 0) + 1, chute: BL - b.used }); });
      const need = all.reduce((a, b) => a + b, 0), chute = bars.length * BL - need;
      return { bars: bars.length, plan: [...plan].map(([k, v]) => ({ k, n: v.n, chute: v.chute })), need, chute, pct: bars.length ? chute / (bars.length * BL) * 100 : 0 };
    };
    const condWin = id => {
      const rows = condRows(id);
      if (!rows.length) return;
      const r0 = rows[0], key = COND_K(r0), Q = rows.reduce((a, r) => a + (num(r.q) || 0), 0);
      INS.cond = INS.cond || {};
      const st = { mode: "q", ua: "", per: "", perT: "", BL: 12, kerf: 0, kgm: "", ...(condGet(key) || {}) };
      let pcs = condPieces(rows);
      const d = document.createElement("div");
      d.id = "svConf";
      const f2 = v => v === "" || v === undefined || v === null ? "" : money(v);
      const res = () => {
        const per = num(st.per), perT = num(st.perT);
        if (st.mode === "q") {
          if (!(per > 0)) return `<div class="svc-sub">SAISIR LE CONTENU D'UNE UNITÉ D'ACHAT (EX. 1 PALETTE = 500 BRIQUES, 1 SAC = 50 KG).</div>`;
          const nu = Math.ceil(Q / per - 1e-9), fill = Q / (nu * per) * 100;
          const nt = perT > 0 ? Math.ceil(nu / perT - 1e-9) : 0, fillT = perT > 0 ? nu / (nt * perT) * 100 : 0;
          return `<table class="cond-t"><tr><th>QUANTITÉ</th><th>${esc(st.ua || "UNITÉS D'ACHAT")}</th><th>REMPLISSAGE</th>${perT > 0 ? "<th>CAMIONS</th><th>REMPLISSAGE CAMIONS</th>" : ""}</tr>
            <tr><td>${esc(money(Q))} ${esc(U_(r0.u))}</td><td><b>${nu}</b></td><td>${money(fill)} %</td>${perT > 0 ? `<td><b>${nt}</b></td><td>${money(fillT)} %</td>` : ""}</tr></table>
            ${nu * per > Q ? `<div class="svc-sub">EN TROP : ${esc(money(nu * per - Q))} ${esc(U_(r0.u))}.</div>` : ""}`;
        }
        const BL = num(st.BL);
        if (!(BL > 0)) return `<div class="svc-sub">SAISIR LA LONGUEUR D'UNE BARRE.</div>`;
        if (!pcs.length) return `<div class="svc-sub">AUCUN MORCEAU : AJOUTER LES LONGUEURS (DIM 1) ET LEUR NOMBRE.</div>`;
        const R = condCut(pcs, BL, num(st.kerf) || 0);
        if (R.err) return `<div class="svc-sub svc-warn">${esc(R.err)}</div>`;
        const kgm = num(st.kgm), nt = perT > 0 ? Math.ceil(R.bars / perT - 1e-9) : 0;
        return `<table class="cond-t"><tr><th>BARRES DE ${esc(money(BL))} M</th><th>LONGUEUR UTILE</th><th>CHUTES</th>${kgm > 0 ? "<th>POIDS ACHETÉ</th>" : ""}${perT > 0 ? "<th>PAQUETS / CAMIONS</th>" : ""}</tr>
          <tr><td><b>${R.bars}</b></td><td>${esc(money(R.need))} M</td><td>${esc(money(R.chute))} M (${money(R.pct)} %)</td>${kgm > 0 ? `<td>${esc(money(R.bars * BL * kgm))} KG</td>` : ""}${perT > 0 ? `<td><b>${nt}</b></td>` : ""}</tr></table>
          <div class="cond-h">PLAN DE COUPE</div><table class="cond-t"><tr><th>NOMBRE DE BARRES</th><th>MORCEAUX (M)</th><th>CHUTE PAR BARRE</th></tr>
          ${R.plan.map(p => `<tr><td><b>${p.n}</b></td><td class="l">${esc(p.k)}</td><td>${esc(money(p.chute))} M</td></tr>`).join("")}</table>`;
      };
      const draw = () => {
        d.innerHTML = `<div class="svc-card cond-card" role="dialog" aria-modal="true">
          <button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
          <div class="svc-t">CONDITIONNEMENT — ${esc(U_(r0.des))}</div>
          <div class="svc-sub">${rows.length} LIGNE(S) DE CHARGE — QUANTITÉ BUDGÉTÉE ${esc(money(Q))} ${esc(U_(r0.u))} — SANS EFFET SUR LE BUDGET</div>
          <div class="svc-sub cond-chs">RÉGLAGE DE L'ARTICLE : IL VAUT POUR TOUS LES BUDGETS.</div>
          <div class="cond-mode"><button type="button" data-m="q" class="${st.mode === "q" ? "on" : ""}">PAR QUANTITÉ TOTALE</button><button type="button" data-m="c" class="${st.mode === "c" ? "on" : ""}">PAR MORCEAUX (DÉCOUPE)</button></div>
          ${st.mode === "q" ? `
            <div class="bdt-row"><span>UNITÉ D'ACHAT</span><input data-k="ua" value="${esc(st.ua)}" placeholder="PALETTE, SAC, BARRE…" autocomplete="off"></div>
            <div class="bdt-row"><span>CONTENU D'UNE UNITÉ (${esc(U_(r0.u))})</span><input data-k="per" inputmode="decimal" value="${esc(f2(st.per))}" autocomplete="off"></div>
            <div class="bdt-row"><span>UNITÉS PAR CAMION</span><input data-k="perT" inputmode="decimal" value="${esc(f2(st.perT))}" placeholder="FACULTATIF" autocomplete="off"></div>`
          : `
            <div class="bdt-row"><span>LONGUEUR D'UNE BARRE (M)</span><input data-k="BL" inputmode="decimal" value="${esc(f2(st.BL))}" autocomplete="off"></div>
            <div class="bdt-row"><span>PERTE PAR COUPE (M)</span><input data-k="kerf" inputmode="decimal" value="${esc(f2(st.kerf))}" autocomplete="off"></div>
            <div class="bdt-row"><span>POIDS (KG / M)</span><input data-k="kgm" inputmode="decimal" value="${esc(f2(st.kgm))}" placeholder="FACULTATIF" autocomplete="off"></div>
            <div class="bdt-row"><span>BARRES PAR PAQUET / CAMION</span><input data-k="perT" inputmode="decimal" value="${esc(f2(st.perT))}" placeholder="FACULTATIF" autocomplete="off"></div>
            <div class="cond-h">MORCEAUX (PRODUITS LIÉS : DIM 1 × NBR)</div>
            <table class="cond-t cond-pcs"><tr><th>LONGUEUR (M)</th><th>NOMBRE</th><th></th></tr>
            ${pcs.map((p, i) => `<tr><td><input data-pi="${i}" data-pf="L" inputmode="decimal" value="${esc(money(p.L))}"></td><td><input data-pi="${i}" data-pf="n" inputmode="numeric" value="${p.n}"></td><td><button type="button" class="cond-del" data-pd="${i}" aria-label="Retirer">✕</button></td></tr>`).join("")}
            <tr><td colspan="3"><button type="button" class="cond-add">+ AJOUTER UN MORCEAU</button></td></tr></table>`}
          <div class="cond-h">RÉSULTAT</div><div class="cond-res">${res()}</div>
          <div class="svc-f"><button type="button" class="svc-b svc-ok" data-x>FERMER</button></div></div>`;
      };
      const save = () => { const v = { mode: st.mode, ua: st.ua, per: st.per, perT: st.perT, BL: st.BL, kerf: st.kerf, kgm: st.kgm }; INS.cond[key] = v; const A = condAll(); A[key] = v; try { localStorage.setItem("svi_cond_chs_v1", JSON.stringify(A)); } catch (e) {} insSave(); };
      draw();
      document.getElementById("svConf")?.remove();
      document.body.appendChild(d);
      d.addEventListener("click", e => {
        if (e.target === d || e.target.closest("[data-x]")) { save(); d.remove(); return; }
        const m = e.target.closest("[data-m]");
        if (m) { st.mode = m.dataset.m; save(); draw(); return; }
        if (e.target.closest(".cond-add")) { pcs.push({ L: 1, n: 1 }); draw(); return; }
        const dl = e.target.closest("[data-pd]");
        if (dl) { pcs.splice(Number(dl.dataset.pd), 1); draw(); }
      });
      /* résultat recalculé à la frappe (la case garde le focus) */
      d.addEventListener("input", e => {
        const i = e.target;
        if (i.dataset.k) st[i.dataset.k] = i.dataset.k === "ua" ? U_(i.value) : i.value === "" ? "" : num(i.value);
        else if (i.dataset.pi !== undefined) { const p = pcs[Number(i.dataset.pi)]; if (p) p[i.dataset.pf] = i.dataset.pf === "n" ? Math.max(0, Math.round(num(i.value) || 0)) : num(i.value) || 0; }
        else return;
        d.querySelector(".cond-res").innerHTML = res();
      });
      d.addEventListener("change", () => save());
    };
    shell.__condWin = condWin;
    if (!shell.__condBound) {
      shell.__condBound = true;
      /* pas de prise de focus (la case de la charge n'est pas sélectionnée et rien ne bouge sous le doigt) */
      shell.addEventListener("pointerdown", e => { if (e.target.closest(".chg-pk")) { e.stopPropagation(); e.preventDefault(); } }, true);
      shell.addEventListener("mousedown", e => { if (e.target.closest(".chg-pk")) { e.stopPropagation(); e.preventDefault(); } }, true);
      shell.addEventListener("touchstart", e => { if (e.target.closest(".chg-pk")) e.stopPropagation(); }, true);
      shell.addEventListener("click", e => {
        const b = e.target.closest(".chg-pk");
        if (!b) return;
        e.preventDefault(); e.stopPropagation();
        if (shell.__condWin) shell.__condWin(b.dataset.cid);
      }, true);
    }
