    /* =========================================================
       v680 : TABLEAU DE BORD (décisions du 29/10/2026)
       - Indicateurs PROPRES AU BUDGET (INS.rat.L), même fenêtre de conception que la liste commune ; seuil par indicateur ;
         import depuis le tableau de bord d'un autre budget ou depuis la liste commune (fenêtre d'import, onglet INDICATEURS).
       - Plusieurs GRAPHIQUES (INS.rat.G), chacun avec sa fenêtre de PARAMÉTRAGE : type (histogramme, barres, courbe, disque),
         ordonnées = un ou plusieurs indicateurs, abscisse au choix (12) : indicateurs, lots, période (semaine / mois),
         versions et scénarios, désignations client, activités (primaires / secondaires), métiers, charges (de la plus grosse
         à la plus petite), origine (marché initial, avenants), budgets / projets, période en cumulé, titres (bloc et niveau).
       - Chaque point de l'abscisse = l'indicateur calculé sur la part du budget qui lui revient (liaisons, charges, produits,
         délais) ; période : quantités au prorata des jours de chaque tâche dans la période.
       ========================================================= */
    const RAT_X = [["ind", "INDICATEURS"], ["lot", "LOTS"], ["per", "PÉRIODE"], ["ver", "VERSIONS ET SCÉNARIOS"], ["des", "DÉSIGNATIONS CLIENT"],
      ["act", "ACTIVITÉS"], ["met", "MÉTIERS (TYPES D'OUVRIERS)"], ["chg", "CHARGES (DE LA PLUS GROSSE À LA PLUS PETITE)"], ["orig", "ORIGINE (BUDGET INITIAL, AVENANTS)"],
      ["bdg", "BUDGETS / PROJETS"], ["cum", "PÉRIODE EN CUMULÉ"], ["tit", "TITRES"]];
    const RAT_T = [["h", "HISTOGRAMME"], ["b", "BARRES"], ["l", "COURBE"], ["p", "DISQUE"]];
    /* anciens ratios (numérateur ÷ dénominateur) → formule ; ancien graphique unique → premier graphique */
    const ratMigrate = R => {
      const K = { tc: "b:chg", tp: "b:prd", sc: "b:sc", sl: "b:sl" }, key = k => K[k] || k;
      const grp = ks => { const T = []; (ks || []).forEach((k, i) => { if (i) T.push({ t: "o", v: "+" }); T.push({ t: "e", k: key(k) }); }); return T; };
      R.L = (R.L || []).map(r => r.f ? r : { id: r.id || insId(), nom: U_(r.nom || "INDICATEUR"), mode: r.mode || "q", fmt: "n", dec: 2, u: "", seuil: r.seuil === undefined ? "" : r.seuil,
        f: (r.den || []).length ? [...((r.num || []).length > 1 ? [{ t: "(" }, ...grp(r.num), { t: ")" }] : grp(r.num)), { t: "o", v: "÷" }, ...((r.den || []).length > 1 ? [{ t: "(" }, ...grp(r.den), { t: ")" }] : grp(r.den))] : grp(r.num) });
      if (!Array.isArray(R.G)) { R.G = R.L.length && R.g ? [{ id: insId(), nom: "GRAPHIQUE 1", type: R.g.t === "p" ? "p" : R.g.t === "l" ? "l" : R.g.t === "h" ? "h" : "b", x: "ind", y: R.L.map(r => r.id), h: R.g.h || 240 }] : []; }
      delete R.g;
      return R;
    };
    /* part du budget retenue par un filtre de liaisons */
    const ratSub = (D, keep) => {
      const L = (D.links || []).filter(keep), ids = k => new Set(L.flatMap(l => (l[k] || []).map(x => x.id)));
      const ch = ids("chg"), pr = ids("prd"), ds = new Set(L.map(l => l.des)), lo = new Set(L.map(l => l.lot)), ks = new Set(L.map(l => l.lot + "|" + l.sec));
      return { ...D, links: L, chg: (D.chg || []).filter(r => r.t || ch.has(r.id)), prd: (D.prd || []).filter(r => r.t || pr.has(r.id)),
        des: (D.des || []).filter(r => r.t || ds.has(r.id)), lot: (D.lot || []).filter(r => r.t || lo.has(r.id)),
        dlp: Object.fromEntries(Object.entries(D.dlp || {}).filter(([k]) => ks.has(k))) };
    };
    /* période [a, b] : délais coupés à la période, charges et produits au prorata des jours de leurs tâches dans la période */
    const ratDays = (x, y) => Math.max(0, Math.round((new Date(y + "T12:00:00") - new Date(x + "T12:00:00")) / 864e5) + 1);
    const ratPerSub = (D, a, b) => {
      const f = {};
      Object.keys(D.dlp || {}).forEach(k => { let tot = 0, inn = 0; (D.dlp[k] || []).forEach(p => { if (!p.deb) return; const x = p.deb, y = p.fin || p.deb; tot += ratDays(x, y); const lo = x > a ? x : a, hi = y < b ? y : b; if (lo <= hi) inn += ratDays(lo, hi); }); f[k] = tot ? inn / tot : 0; });
      const share = (kind, id) => { const ks = (D.links || []).filter(l => (l[kind] || []).some(x => x.id === id)).map(l => l.lot + "|" + l.sec); return ks.length ? ks.reduce((t, k) => t + (f[k] || 0), 0) / ks.length : 0; };
      const dlp = {}; Object.keys(D.dlp || {}).forEach(k => { const L = (D.dlp[k] || []).filter(p => p.deb && p.deb <= b && (p.fin || p.deb) >= a).map(p => ({ ...p, deb: p.deb < a ? a : p.deb, fin: (p.fin || p.deb) > b ? b : (p.fin || p.deb) })); if (L.length) dlp[k] = L; });
      return { ...D, __a: a, __b: b, dlp, chg: (D.chg || []).map(r => r.t ? r : { ...r, q: num(r.q || 0) * share("chg", r.id) }),
        prd: (D.prd || []).map(r => r.t ? r : { ...r, nbr: "", d1: "", d2: "", d3: "", q: insPrdQ(r) * share("prd", r.id) }) };
    };
    const ratPeriods = (D, unit) => {
      const all = []; Object.values(D.dlp || {}).forEach(L => (L || []).forEach(p => { if (p.deb) all.push(p.deb, p.fin || p.deb); }));
      if (!all.length) return [];
      all.sort(); const a = all[0], b = all[all.length - 1], out = [];
      const mois = ["JANV", "FÉVR", "MARS", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC"];
      if (unit === "m") {
        for (let d = new Date(a.slice(0, 8) + "01T12:00:00"); sviIsoOf(d) <= b && out.length < 120; d.setMonth(d.getMonth() + 1)) {
          const s0 = sviIsoOf(d), e = new Date(d); e.setMonth(e.getMonth() + 1); e.setDate(0);
          out.push({ a: s0, b: sviIsoOf(e), lab: mois[d.getMonth()] + " " + String(d.getFullYear()).slice(2) });
        }
      } else {
        const d = new Date(a + "T12:00:00"); d.setDate(d.getDate() - (d.getDay() + 6) % 7);
        for (; sviIsoOf(d) <= b && out.length < 260; d.setDate(d.getDate() + 7)) { const e = new Date(d); e.setDate(e.getDate() + 6); out.push({ a: sviIsoOf(d), b: sviIsoOf(e), lab: dFr(sviIsoOf(d)).slice(0, 5) }); }
      }
      return out;
    };
    /* points de l'abscisse : [{ lab, d }] (d = part du budget sur laquelle l'indicateur est calculé) */
    const ratCats = (G, D) => {
      const nm = (k, id) => { const r = (D[k] || []).find(x => x.id === id); return r ? (k === "des" ? ((r.art || "") + " " + (r.des || "")).trim() : (r.v || r.des || "")) : ""; };
      const byKey = (keyOf, labOf) => { const M = new Map(); (D.links || []).forEach(l => { const k = keyOf(l); if (k === null || k === undefined || k === "") return; if (!M.has(k)) M.set(k, labOf ? labOf(l, k) : k); }); return [...M.entries()].map(([k, lab]) => ({ lab, d: ratSub(D, l => keyOf(l) === k) })); };
      switch (G.x) {
        case "lot": return byKey(l => l.lot, l => nm("lot", l.lot));
        case "des": return byKey(l => l.des, l => nm("des", l.des));
        case "act": { const k = G.act === "prim" ? "prim" : "sec"; return byKey(l => l[k], l => nm(k, l[k])); }
        case "per": case "cum": { const P = ratPeriods(D, G.per === "m" ? "m" : "w"); const a0 = P.length ? P[0].a : ""; return P.map(p => ({ lab: p.lab, d: ratPerSub(D, G.x === "cum" ? a0 : p.a, p.b) })); }
        case "met": { const M = new Map(); (D.chg || []).filter(r => !r.t && dlyIsLab(r)).forEach(r => { const k = U_(r.des); if (!M.has(k)) M.set(k, new Set()); M.get(k).add(r.id); }); return [...M.entries()].map(([k, S]) => ({ lab: k, d: { ...D, chg: (D.chg || []).filter(r => r.t || S.has(r.id)) } })); }
        case "chg": return (D.chg || []).filter(r => !r.t).map(r => ({ lab: r.des || "", d: { ...D, chg: [r] }, sort: true }));
        case "orig": { const O = verOrig().des; return byKey(l => O[l.des] || "BUDGET INITIAL"); }
        case "ver": { const V = INS.ver || { L: [] }; const SC = (V.L || []).filter(x => x.kind === "sc"); if (!SC.length) return [{ lab: "BUDGET ACTUEL", d: D }]; return SC.map(x => ({ lab: x.nom, d: x.id === V.act ? D : x.d })).filter(x => x.d); }
        case "bdg": return sviInstGet().filter(x => x.data).map(x => ({ lab: ((x.project || "") + " " + x.ref).trim(), d: x.ref === (budget.inst && budget.inst.ref) ? D : x.data }));
        case "tit": {
          const niv = Math.max(1, Number(G.niv) || 1), blk = G.blk || "lot";
          if (blk === "lot") return byKey(l => dlyLotPath(nm("lot", l.lot)).slice(0, niv).join(" / ") || "(SANS LOT)");
          if (blk === "des") {
            const T = {}, stack = []; (D.des || []).forEach(r => { if (r.t) { const lv = Math.max(1, String(artOf(r) || "").split(".").filter(Boolean).length); stack.length = lv - 1; stack[lv - 1] = (artOf(r) + " " + (r.des || "")).trim(); } else T[r.id] = stack[niv - 1] || stack[stack.length - 1] || "(SANS TITRE)"; });
            return byKey(l => T[l.des] || "(SANS TITRE)");
          }
          return byKey(l => { const r = (D[blk] || []).find(x => x.id === l[blk]); return (r && String(r.g || "").trim()) || "(SANS TITRE)"; });
        }
        default: return [];
      }
    };
    /* séries du graphique : { X: [libellés], S: [{ I, v: [valeurs] }] } */
    const ratSeries = (G, R, D) => {
      const Y = (G.y || []).map(id => R.L.find(r => r.id === id)).filter(Boolean);
      if (G.x === "ind") { const E = indEls(D); return { X: Y.map(I => I.nom), S: [{ I: { nom: "VALEUR" }, v: Y.map(I => indCalc(I, D, E).val ?? null), seuils: Y.map(I => I.seuil) }] }; }
      let C = ratCats(G, D);
      const S = Y.map(I => ({ I, v: C.map(c => { const r = indCalc(I, c.d); return r.val ?? null; }) }));
      if (C.some(c => c.sort) && S.length) { const ord = C.map((c, i) => i).sort((i, j) => (S[0].v[j] ?? -Infinity) - (S[0].v[i] ?? -Infinity)); C = ord.map(i => C[i]); S.forEach(s => { s.v = ord.map(i => s.v[i]); }); }
      return { X: C.map(c => c.lab), S };
    };
    /* dessin SVG */
    const RAT_C = ["#2e90fa", "#f79009", "#12b76a", "#7a5af8", "#ee46bc", "#06aed4", "#84cc16", "#667085"];
    const ratDraw = (G, R, D) => {
      const { X, S } = ratSeries(G, R, D);
      if (!X.length || !S.length || S.every(s => s.v.every(v => v === null))) return `<div class="fz-none">AUCUNE VALEUR À REPRÉSENTER (CHOISIR LES INDICATEURS ET L'ABSCISSE DANS ⚙)</div>`;
      const H = Math.max(140, Number(G.h) || 240), lab = s => esc(String(s).slice(0, 16)), fx = v => v === null ? "" : indNum(v, Math.abs(v) >= 100 ? 0 : 2);
      const leg = S.length > 1 || G.type === "p" ? `<div class="rat-leg">${(G.type === "p" ? X.map((x, i) => [x, RAT_C[i % RAT_C.length]]) : S.map((s, i) => [s.I.nom, RAT_C[i % RAT_C.length]])).map(([t, c]) => `<span><i style="background:${c}"></i>${esc(t)}</span>`).join("")}</div>` : "";
      if (G.type === "p") {
        const v = S[0].v.map(x => Math.abs(x || 0)), tot = v.reduce((a, b) => a + b, 0) || 1, r = Math.min(H / 2 - 10, 130), cx = r + 20, cy = H / 2; let a0 = -Math.PI / 2;
        const sl = v.map((x, i) => { if (!x) return ""; const a1 = a0 + x / tot * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0;
          const p = x >= tot - 1e-9 ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${RAT_C[i % RAT_C.length]}"/>` : `<path d="M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${big} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} Z" fill="${RAT_C[i % RAT_C.length]}" stroke="#fff" stroke-width="1.5"/>`; a0 = a1; return p; }).join("");
        const txt = v.map((x, i) => `<text x="${2 * r + 60}" y="${20 + i * 18}">${lab(X[i])} — ${esc(fx(S[0].v[i]))} (${indNum(x / tot * 100, 1)} %)</text>`).join("");
        return leg + `<svg viewBox="0 0 760 ${H}" class="rat-svg">${sl}${txt}</svg>`;
      }
      const all = S.flatMap(s => s.v).filter(v => v !== null), mx = Math.max(0, ...all), mn = Math.min(0, ...all), span = (mx - mn) || 1;
      const n = X.length, W = Math.max(760, 50 + n * Math.max(24, S.length * 14 + 10)), pl = 46, pb = 34, ph = H - pb - 14, cw = (W - pl - 10) / n;
      const y = v => 14 + (mx - v) / span * ph, y0 = y(0);
      const grid = [0, .25, .5, .75, 1].map(t => { const v = mn + span * t; return `<line x1="${pl}" x2="${W - 6}" y1="${y(v)}" y2="${y(v)}" stroke="#eaecf0"/><text x="${pl - 4}" y="${y(v) + 4}" text-anchor="end" class="rat-ax">${esc(fx(v))}</text>`; }).join("");
      const xl = X.map((x, i) => `<text x="${pl + cw * i + cw / 2}" y="${H - 14}" text-anchor="middle" class="rat-ax">${lab(x)}</text>`).join("");
      let marks = "";
      if (G.type === "l") marks = S.map((s, j) => { const pts = s.v.map((v, i) => v === null ? null : [pl + cw * i + cw / 2, y(v)]).filter(Boolean); return `<polyline points="${pts.map(p => p.join(",")).join(" ")}" fill="none" stroke="${RAT_C[j % RAT_C.length]}" stroke-width="2.5"/>` + pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${RAT_C[j % RAT_C.length]}"/>`).join(""); }).join("");
      else {
        const gap = G.type === "h" ? 0 : cw * .22, bw = (cw - gap) / S.length;
        marks = S.map((s, j) => s.v.map((v, i) => { if (v === null) return ""; const sr = s.seuils ? s.seuils[i] : s.I.seuil, sv = sr === undefined || sr === null || sr === "" ? NaN : Number(String(sr).replace(",", "."));
          const over = Number.isFinite(sv) && v > sv, x = pl + cw * i + gap / 2 + bw * j, top = Math.min(y(v), y0), h = Math.abs(y(v) - y0);
          return `<rect x="${x + (G.type === "h" ? 0 : 1)}" y="${top}" width="${Math.max(1, bw - (G.type === "h" ? 0 : 2))}" height="${Math.max(1, h)}" fill="${over ? "#f04438" : RAT_C[j % RAT_C.length]}" rx="${G.type === "h" ? 0 : 3}"/>${S.length === 1 && n <= 24 ? `<text x="${x + bw / 2}" y="${top - 4}" text-anchor="middle" class="rat-ax">${esc(fx(v))}</text>` : ""}`; }).join("")).join("");
      }
      return leg + `<div class="rat-gx"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="rat-svg">${grid}<line x1="${pl}" x2="${W - 6}" y1="${y0}" y2="${y0}" stroke="#98a2b3"/>${marks}${xl}</svg></div>`;
    };
    /* fenêtre PARAMÉTRAGE d'un graphique — done(graphique | null) */
    const ratGraphWin = (G0, R, done) => {
      const G = JSON.parse(JSON.stringify(G0 || { id: insId(), nom: "GRAPHIQUE " + ((R.G || []).length + 1), type: "h", x: "ind", y: [], h: 240, per: "m", act: "sec", blk: "lot", niv: 1 }));
      const d = sviWinNew();
      const draw = () => {
        d.innerHTML = sviWinCard({ cls: "cmp-card ind-card", close: "data-x", title: "PARAMÉTRAGE DU GRAPHIQUE",
          body: `<label class="ind-lab">NOM DU GRAPHIQUE</label><input class="pv-in ind-nom rg-nom" value="${esc(G.nom)}">
            <div class="fz-blk">TYPE</div><div class="rg-row">${RAT_T.map(([v, l]) => `<label><input type="radio" name="rgT" value="${v}"${G.type === v ? " checked" : ""}> ${l}</label>`).join("")}</div>
            <div class="fz-blk">ABSCISSE</div><div class="rg-row"><select class="pv-in rg-x">${RAT_X.map(([v, l]) => `<option value="${v}"${G.x === v ? " selected" : ""}>${l}</option>`).join("")}</select>
              ${G.x === "per" || G.x === "cum" ? `<select class="pv-in rg-per"><option value="w"${G.per === "w" ? " selected" : ""}>PAR SEMAINE</option><option value="m"${G.per !== "w" ? " selected" : ""}>PAR MOIS</option></select>` : ""}
              ${G.x === "act" ? `<select class="pv-in rg-act"><option value="prim"${G.act === "prim" ? " selected" : ""}>ACTIVITÉS PRIMAIRES</option><option value="sec"${G.act !== "prim" ? " selected" : ""}>ACTIVITÉS SECONDAIRES</option></select>` : ""}
              ${G.x === "tit" ? `<select class="pv-in rg-blk">${[["des", "DÉSIGNATIONS CLIENT"], ["lot", "LOTS"], ["prim", "ACTIVITÉS PRIMAIRES"], ["sec", "ACTIVITÉS SECONDAIRES"]].map(([v, l]) => `<option value="${v}"${G.blk === v ? " selected" : ""}>${l}</option>`).join("")}</select>${G.blk === "lot" || G.blk === "des" ? `<select class="pv-in rg-niv">${[1, 2, 3].map(n => `<option value="${n}"${Number(G.niv || 1) === n ? " selected" : ""}>NIVEAU ${n}</option>`).join("")}</select>` : ""}` : ""}</div>
            <div class="fz-blk">ORDONNÉES (INDICATEURS DU TABLEAU DE BORD)</div>
            <div class="rg-y">${R.L.map(I => `<label><input type="checkbox" class="rg-yc" value="${esc(I.id)}"${G.y.includes(I.id) ? " checked" : ""}> ${esc(I.nom)}</label>`).join("") || `<div class="fz-none">AUCUN INDICATEUR : EN CRÉER DANS LE TABLEAU DE BORD</div>`}</div>
            <label class="pv-r"><span>HAUTEUR</span><input type="range" class="rg-h" min="140" max="560" step="20" value="${G.h || 240}"></label>
            <div class="rat-g rg-prev">${ratDraw(G, R, { ...INS, rat: R })}</div>
            <div class="doc-err ind-msg"></div>`,
          foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button>` });
      };
      draw(); sviWinShow(d);
      d.addEventListener("input", e => { if (e.target.classList.contains("rg-nom")) G.nom = e.target.value; });
      d.addEventListener("change", e => {
        const t = e.target;
        if (t.name === "rgT") G.type = t.value; else if (t.classList.contains("rg-x")) G.x = t.value; else if (t.classList.contains("rg-per")) G.per = t.value;
        else if (t.classList.contains("rg-act")) G.act = t.value; else if (t.classList.contains("rg-blk")) G.blk = t.value; else if (t.classList.contains("rg-niv")) G.niv = Number(t.value);
        else if (t.classList.contains("rg-yc")) G.y = [...d.querySelectorAll(".rg-yc:checked")].map(x => x.value);
        else if (t.classList.contains("rg-h")) G.h = Number(t.value);
        else return;
        G.nom = d.querySelector(".rg-nom").value; draw();
      });
      d.addEventListener("click", e => {
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); done(null); return; }
        if (e.target.closest("[data-save]")) {
          G.nom = U_(d.querySelector(".rg-nom").value) || "GRAPHIQUE";
          if (!G.y.length) { d.querySelector(".ind-msg").textContent = "COCHER AU MOINS UN INDICATEUR EN ORDONNÉE."; return; }
          d.remove(); done(G);
        }
      });
    };
    /* fenêtre TABLEAU DE BORD */
    const ratWin = () => {
      const R = ratMigrate(JSON.parse(JSON.stringify(INS.rat || {})));
      R.lsurf = R.lsurf || {};
      const ed = INS_EDIT;
      const put = (what, det) => { INS.rat = JSON.parse(JSON.stringify(R)); insSave(); if (what) histLog("TABLEAU DE BORD", what, det || ""); };
      if (JSON.stringify(INS.rat || {}) !== JSON.stringify(R) && ed && INS.rat) put("");   /* migration enregistrée */
      const STORE = { list: () => R.L, save: L => { R.L = L; R.G.forEach(G => { G.y = G.y.filter(id => L.some(I => I.id === id)); }); put(); }, br: "TABLEAU DE BORD" };
      let showLots = false;
      const leaves = (INS.lot || []).filter(r => !r.t && !(INS.lot || []).some(o => o !== r && !o.t && U_(o.v).startsWith(U_(r.v) + " / ")));
      const d = sviWinNew();
      const close = () => { window.__sviRatRefresh = null; document.getElementById("blkMenu")?.remove(); d.remove(); };
      const reopen = () => ratWin();
      const ctl = indTableCtl({ t: "rat", list: () => R.L, save: L => STORE.save(L), store: STORE, close, reopen, ro: !ed, data: () => ({ ...INS, rat: R }),
        extra: [["iseuil", "SEUIL", r => r.seuil === undefined || r.seuil === "" ? "" : r.seuil, "center"]], after: () => drawG(),
        onNew: () => { close(); indDesignWin(null, () => reopen(), STORE); },
        onEdit: I => { close(); indDesignWin(I, () => reopen(), STORE); },
        onImport: () => openImportBudget("rat", () => reopen()) });
      const drawG = () => {
        const box = d.querySelector(".rat-graphs"); if (!box) return;
        const D = { ...INS, rat: R };
        box.innerHTML = (R.G || []).map(G => `<div class="rat-card" data-g="${esc(G.id)}"><div class="rat-ch"><b>${esc(G.nom)}</b><small>${esc((RAT_T.find(t => t[0] === G.type) || ["", ""])[1])} · ${esc((RAT_X.find(x => x[0] === G.x) || ["", ""])[1])}</small>
            ${ed ? `<button type="button" class="svc-b" data-gset="${esc(G.id)}">⚙ PARAMÉTRAGE</button><button type="button" class="cmp-del" data-gdel="${esc(G.id)}">✕</button>` : ""}</div>
            <div class="rat-g">${ratDraw(G, R, D)}</div></div>`).join("") || `<div class="fz-none">AUCUN GRAPHIQUE</div>`;
      };
      d.innerHTML = sviWinCard({ cls: "cmp-card svc-full rat-card", close: "data-x", title: "TABLEAU DE BORD",
        body: `<div class="rat-top"><label>SURFACE COUVERTE <input class="pv-in rat-surf" inputmode="decimal" value="${esc(R.surf === undefined ? "" : String(R.surf).replace(".", ","))}"${ed ? "" : " disabled"}> M²</label>
            <button type="button" class="svc-b" data-lots>SURFACES DES LOTS ${svCnt(Object.keys(R.lsurf).length)}</button></div>
          <div class="rat-lots" hidden>${leaves.map(l => `<label class="pv-r"><span>${esc(lotLab(lotSegs(l)).full)}</span><input class="pv-in rat-ls" data-lot="${l.id}" inputmode="decimal" value="${esc(R.lsurf[l.id] === undefined ? "" : String(R.lsurf[l.id]).replace(".", ","))}"${ed ? "" : " disabled"}><i>M²</i></label>`).join("") || `<div class="fz-none">AUCUN LOT</div>`}</div>
          <div class="fz-blk">INDICATEURS DU BUDGET ${svCnt(R.L.length)}</div>
          ${indBar("rat", "PROPRES À CE BUDGET ; TOUCHER UNE LIGNE POUR LA MODIFIER. SEUIL DÉPASSÉ = ROUGE.")}
          <div class="cmp-scroll ind-scroll rat-iscroll"><table class="bdg-d-table ind-table" data-it="rat"></table></div>
          <div class="fz-blk">GRAPHIQUES ${svCnt((R.G || []).length)} ${ed ? `<button type="button" class="svc-b" data-gnew>+ GRAPHIQUE</button>` : ""}</div>
          <div class="rat-graphs"></div>`,
        foot: `<button type="button" class="svc-b svc-ok svc-neutral" data-x>FERMER</button>` });
      sviWinShow(d);
      ctl.render(d); ctl.wire(d); drawG();
      window.__sviRatRefresh = () => { if (document.body.contains(d)) { ctl.render(d); drawG(); } else window.__sviRatRefresh = null; };
      d.addEventListener("change", e => {
        const t = e.target;
        if (t.classList.contains("rat-surf")) { R.surf = t.value.trim() === "" ? "" : ratNum(t.value); put("SURFACE COUVERTE", t.value); ctl.render(d); drawG(); return; }
        if (t.classList.contains("rat-ls")) { if (t.value.trim() === "") delete R.lsurf[t.dataset.lot]; else R.lsurf[t.dataset.lot] = ratNum(t.value); put("SURFACE DE LOT", t.value); ctl.render(d); drawG(); }
      });
      d.addEventListener("click", async e => {
        if (e.target === d || e.target.closest("[data-x]")) { close(); refreshAll(); return; }
        if (e.target.closest("[data-lots]")) { showLots = !showLots; const b = d.querySelector(".rat-lots"); b.hidden = !showLots; return; }
        if (e.target.closest("[data-gnew]")) { close(); ratGraphWin(null, R, G => { if (G) { R.G = (R.G || []).concat(G); put("GRAPHIQUE AJOUTÉ", G.nom); } reopen(); }); return; }
        const gs = e.target.closest("[data-gset]");
        if (gs) { const G0 = R.G.find(g => g.id === gs.dataset.gset); close(); ratGraphWin(G0, R, G => { if (G) { R.G = R.G.map(g => g.id === G.id ? G : g); put("GRAPHIQUE MODIFIÉ", G.nom); } reopen(); }); return; }
        const gd = e.target.closest("[data-gdel]");
        if (gd) { const G0 = R.G.find(g => g.id === gd.dataset.gdel); d.remove(); if (await svConfirm({ title: "SUPPRIMER LE GRAPHIQUE", text: G0.nom, ok: "SUPPRIMER" })) { R.G = R.G.filter(g => g !== G0); put("GRAPHIQUE SUPPRIMÉ", G0.nom); } reopen(); }
      });
    };
    shell.__ratWin = () => ratWin();
    shell.__rat = { imp: (b, cb) => openImportBudget(b, cb), cats: (G, D) => ratCats(G, D || INS), series: G => ratSeries(G, ratMigrate(JSON.parse(JSON.stringify(INS.rat || {}))), INS), migrate: R => ratMigrate(R), periods: (D, u) => ratPeriods(D || INS, u), per: (D, a, b) => ratPerSub(D || INS, a, b) };
