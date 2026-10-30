    /* =========================================================
       v668 (AXE 7) : TABLEAU DE BORD DES RATIOS (menu ⋯ du haut).
       Éléments : charges et produits regroupés par désignation + unité (quantité, montant), CHARGES TOTALES, PRODUITS TOTAUX,
       SURFACE COUVERTE (INF) et surfaces des lots (dernier niveau, sommées vers le haut). Un ratio = NUMÉRATEUR (somme d'éléments)
       ÷ DÉNOMINATEUR (somme d'éléments), en QUANTITÉ (mêmes unités seulement) ou en MONTANT ; une seule valeur = sa quantité ;
       seuil propre au projet (dépassé = rouge). Graphique : BARRES, CAMEMBERT, COURBE ou HISTOGRAMME, taille réglable.
       PROPOSER = ratios créés seulement si les données existent. Données : INS.rat = { surf, lsurf: { lot: m² }, L: [...], g: { t, h } }.
       ========================================================= */
    const ratNum = v => { const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
    const ratFx = (v, d = 2) => v === null || v === undefined || !Number.isFinite(v) ? "—" : money(Math.round(v * 10 ** d) / 10 ** d);
    /* éléments disponibles : { k, lab, u, q, m } */
    const ratItems = (D = INS) => {   /* v679 : sur un état du budget (scénarios) */
      const R = D.rat || {}, out = [], G = new Map();
      const add = (pre, r, q, m) => { const k = pre + "|" + U_(r.des) + "|" + U_(r.u); if (!G.has(k)) G.set(k, { k, lab: (pre === "c" ? "CHG " : "PRD ") + (r.des || ""), u: U_(r.u), q: 0, m: 0 }); const x = G.get(k); x.q += q; x.m += m; };
      (D.chg || []).filter(r => !r.t).forEach(r => add("c", r, ratNum(r.q), ratNum(r.q) * ratNum(r.p)));
      /* v723 (bloc 2, point 1) : GROUPES DE CHARGES = titres de DÉTAIL CHARGES (toutes les charges sous le titre) ; quantité seulement si même unité */
      { let cur = null; (D.chg || []).forEach(r => { if (r.t) { cur = { k: "g|" + U_(r.des || r.art || r.id), lab: "GROUPE " + U_(r.des || ""), us: new Set(), q: 0, m: 0 }; if (!G.has(cur.k)) G.set(cur.k, cur); else cur = G.get(cur.k); return; }
        if (!cur) return; cur.us.add(U_(r.u)); cur.q += ratNum(r.q); cur.m += ratNum(r.q) * ratNum(r.p); });
        [...G.values()].filter(x => x.k[0] === "g").forEach(x => { x.u = x.us.size === 1 ? [...x.us][0] : ""; if (x.us.size !== 1) x.q = x.m; delete x.us; }); }
      const pp = new Map(); (D.links || []).forEach(l => { if (!insLinkPrim(D, l)) return; const d = (D.des || []).find(x => x.id === l.des); (l.prd || []).forEach(x => { if (!pp.has(x.id)) pp.set(x.id, d ? ratNum(d.p) : 0); }); });
      (D.prd || []).filter(r => !r.t).forEach(r => { const q = insPrdQ(r); add("p", r, q, q * (pp.get(r.id) || 0)); });
      out.push({ k: "tc", lab: "CHARGES TOTALES", u: "DH", q: [...G.values()].filter(x => x.k[0] === "c").reduce((t, x) => t + x.m, 0), m: null });
      out.push({ k: "tp", lab: "PRODUITS TOTAUX", u: "DH", q: [...G.values()].filter(x => x.k[0] === "p").reduce((t, x) => t + x.m, 0), m: null });
      const ls = Object.values(R.lsurf || {}).reduce((t, v) => t + ratNum(v), 0);
      if (ratNum(R.surf)) out.push({ k: "sc", lab: "SURFACE COUVERTE", u: "M2", q: ratNum(R.surf), m: null });
      if (ls) out.push({ k: "sl", lab: "SURFACE DES LOTS", u: "M2", q: ls, m: null });
      return out.concat([...G.values()].sort((a, b) => a.lab.localeCompare(b.lab, "fr")));
    };
    /* valeur d'un côté : { v, u } ; quantité seulement si toutes les unités sont les mêmes */
    const ratSide = (I, ks, mode) => {
      const L = (ks || []).map(k => I.find(x => x.k === k)).filter(Boolean);
      if (!L.length) return null;
      if (mode === "m" && L.every(x => x.m !== null)) return { v: L.reduce((t, x) => t + x.m, 0), u: "DH" };
      const us = [...new Set(L.map(x => x.u))];
      if (us.length > 1) return { v: null, u: "", err: "UNITÉS DIFFÉRENTES" };
      return { v: L.reduce((t, x) => t + x.q, 0), u: us[0] };
    };
    const ratCalc = (I, r) => {
      const n = ratSide(I, r.num, r.mode), d = ratSide(I, r.den, r.mode);
      if (!n) return { txt: "—" };
      if (n.err) return { txt: n.err, err: true };
      if (!d) return { val: n.v, txt: ratFx(n.v) + " " + n.u };
      if (d.err) return { txt: d.err, err: true };
      const val = d.v ? n.v / d.v : null;
      return { val, n, d, diff: n.v - d.v, txt: val === null ? "—" : ratFx(val, 3) + " " + n.u + " / " + d.u };
    };
    /* ratios proposés : seulement ceux dont les données existent */
    const ratPropose = I => {
      const has = k => I.some(x => x.k === k), sur = has("sc") ? "sc" : has("sl") ? "sl" : null, L = [];
      const find = (pre, re, u) => I.filter(x => x.k.startsWith(pre + "|") && re.test(x.lab) && (!u || x.u === u)).map(x => x.k);
      if (sur && has("tc")) L.push({ nom: "COÛT AU M²", num: ["tc"], den: [sur], mode: "q" });
      if (sur && has("tp")) L.push({ nom: "PRIX DE VENTE AU M²", num: ["tp"], den: [sur], mode: "q" });
      const ac = find("c", /ACIER|FER|HA\s?\d/, "KG"), be = find("p", /B[EÉ]TON/, "M3").concat(find("c", /B[EÉ]TON/, "M3"));
      if (ac.length && be.length) L.push({ nom: "ACIER / BÉTON", num: ac, den: [be[0]], mode: "q", seuil: "" });
      const mo = I.filter(x => x.k.startsWith("c|") && /^(JH|HJ|J|JOUR|JOURS)$/.test(x.u)).map(x => x.k);
      if (mo.length && sur) L.push({ nom: "MAIN-D'ŒUVRE AU M²", num: mo, den: [sur], mode: "q" });
      return L.map(r => ({ id: insId(), seuil: "", ...r }));
    };
    /* v680 : TABLEAU DE BORD (ratWin) et graphiques : voir 22h-tableau-de-bord.js */

    /* =========================================================
       v668 (AXE 8) : VUE MULTI-PROJETS — main-d'œuvre (jours-homme) de tous les budgets en instance ou figés, par semaine,
       sur un même graphique (une couleur par budget). Chaque charge de main-d'œuvre est répartie sur les jours de sa tâche
       (lot › activité secondaire) dans le DÉTAIL DÉLAIS ; charge liée à plusieurs tâches : comptée une fois (première tâche).
       ========================================================= */
    const multiLoad = () => {
      const L = sviInstGet().filter(x => x.data && x.state !== "valide").map(x => x.ref === ref ? { ...x, data: INS } : x);
      const wk = iso => { const d = new Date(iso + "T12:00:00"); const g = (d.getDay() + 6) % 7; d.setDate(d.getDate() - g); return sviIsoOf(d); };
      const B = [], W = new Set();
      L.forEach(x => {
        const d = x.data, seen = new Set(), per = {};
        Object.keys(d.dlp || {}).forEach(k => { (d.dlp[k] || []).forEach(p => { if (p.deb && (p.fin || p.deb)) (per[k] = per[k] || []).push([p.deb, p.fin || p.deb]); }); });
        const M = {};
        (d.links || []).forEach(l => { const k = l.lot + "|" + l.sec; (l.chg || []).forEach(c => {
          if (seen.has(c.id)) return; const r = (d.chg || []).find(y => y.id === c.id); if (!r || r.t || !dlyIsLab(r)) return; seen.add(c.id);
          const P = per[k]; if (!P) return;
          const days = []; P.forEach(([a, b]) => { for (let t = new Date(a + "T12:00:00"); sviIsoOf(t) <= b && days.length < 3000; t.setDate(t.getDate() + 1)) days.push(sviIsoOf(t)); });
          if (!days.length) return;
          const q = ratNum(r.q) * (/^(H|HR|HEURE|HEURES)$/.test(U_(r.u)) ? 1 / 8 : 1);
          days.forEach(dd => { const w = wk(dd); M[w] = (M[w] || 0) + q / days.length; W.add(w); });
        }); });
        if (Object.keys(M).length) B.push({ ref: x.ref, lab: (x.project || "") + " " + x.ref, M });
      });
      return { B, W: [...W].sort() };
    };
    const multiWin = () => {
      const { B, W } = multiLoad();
      const C = ["#2e90fa", "#12b76a", "#f79009", "#7a5af8", "#ee46bc", "#06aed4", "#f04438", "#667085", "#84cc16", "#a16207"];
      const H = 300, bw = Math.max(14, Math.min(48, 900 / Math.max(1, W.length))), Wd = 50 + bw * W.length;
      const tot = W.map(w => B.reduce((t, b) => t + (b.M[w] || 0), 0)), mx = Math.max(1, ...tot);
      const y = v => v / mx * (H - 40);
      const bars = W.map((w, i) => { let acc = 0; return B.map((b, j) => { const v = b.M[w] || 0; if (!v) return ""; const h = y(v), yy = H - 24 - y(acc) - h; acc += v; return `<rect x="${40 + i * bw + 2}" y="${yy}" width="${bw - 4}" height="${h}" fill="${C[j % C.length]}"><title>${esc(b.lab)} — ${ratFx(v, 1)} J-H</title></rect>`; }).join("") + `<text x="${40 + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${w.slice(8, 10)}/${w.slice(5, 7)}</text><text x="${40 + i * bw + bw / 2}" y="${H - 28 - y(tot[i])}" text-anchor="middle">${Math.round(tot[i])}</text>`; }).join("");
      const d = sviWinNew();
      d.innerHTML = sviWinCard({ cls: "cmp-card svc-full", close: "data-x", title: "MAIN-D'ŒUVRE DE TOUS LES BUDGETS",
        body: `<div class="pv-sub">JOURS-HOMME PAR SEMAINE (SEMAINE DU LUNDI), BUDGETS EN INSTANCE ET FIGÉS ; CHAQUE CHARGE DE MAIN-D'ŒUVRE EST RÉPARTIE SUR LES JOURS DE SA TÂCHE.</div>
          <div class="rat-leg">${B.map((b, j) => `<span><i style="background:${C[j % C.length]}"></i>${esc(b.lab)}</span>`).join("") || ""}</div>
          <div class="cmp-scroll">${W.length ? `<svg viewBox="0 0 ${Wd} ${H}" width="${Wd}" height="${H}" class="rat-svg">${bars}</svg>` : `<div class="fz-none">AUCUNE MAIN-D'ŒUVRE PLANIFIÉE DANS LES BUDGETS.</div>`}</div>`,
        foot: `<button type="button" class="svc-b svc-ok svc-neutral" data-x>FERMER</button>` });
      sviWinShow(d);
      d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) d.remove(); });
    };

    /* =========================================================
       v668 : SIGNATURES À PRÉVOIR — au budget, on désigne seulement quels documents exigent une signature et de qui
       (devis / bordereau, PAQ ; en réalisation : PV de levée de réserve, PV de réception, attachements). INS.sign = { type: { on, qui } }.
       ========================================================= */
    const SIGN_DOCS = [["bpu", "BORDEREAU DES PRIX / DEVIS"], ["paq", "PLAN D'ASSURANCE QUALITÉ (PAQ)"], ["pvl", "PV DE LEVÉE DE RÉSERVE"], ["pvr", "PV DE RÉCEPTION"], ["att", "ATTACHEMENTS"]];
    const signWin = () => {
      const S = JSON.parse(JSON.stringify(INS.sign || {})), ed = INS_EDIT;
      const d = sviWinNew();
      d.innerHTML = sviWinCard({ cls: "pv-card", close: "data-x", title: "SIGNATURES À PRÉVOIR",
        body: `<div class="pv-sub">DOCUMENTS QUI EXIGERONT UNE SIGNATURE, ET DE QUI ; LA SIGNATURE ELLE-MÊME SE FERA EN RÉALISATION.</div>
          ${SIGN_DOCS.map(([k, l]) => `<div class="sg-r"><label><input type="checkbox" class="sg-on" data-k="${k}"${(S[k] || {}).on ? " checked" : ""}${ed ? "" : " disabled"}> ${l}</label>
            <input class="pv-in sg-qui" data-k="${k}" placeholder="SIGNATAIRE(S) : MAÎTRE D'OUVRAGE, BUREAU DE CONTRÔLE…" value="${esc((S[k] || {}).qui || "")}"${ed ? "" : " disabled"}></div>`).join("")}`,
        foot: `<button type="button" class="svc-b" data-x>${ed ? "ANNULER" : "FERMER"}</button>${ed ? `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button>` : ""}` });
      sviWinShow(d);
      d.addEventListener("click", e => {
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
        if (!e.target.closest("[data-save]")) return;
        const o = {};
        SIGN_DOCS.forEach(([k]) => { const on = d.querySelector(`.sg-on[data-k="${k}"]`).checked, qui = d.querySelector(`.sg-qui[data-k="${k}"]`).value.trim().toUpperCase(); if (on || qui) o[k] = { on, qui }; });
        INS.sign = o; insSave();
        histLog("SIGNATURES", "À PRÉVOIR", SIGN_DOCS.filter(([k]) => (o[k] || {}).on).map(x => x[1]).join(", ") || "AUCUNE");
        d.remove();
      });
    };
    shell.__multiWin = () => multiWin();
    shell.__signWin = () => signWin();
