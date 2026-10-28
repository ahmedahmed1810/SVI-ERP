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
    const ratItems = () => {
      const R = INS.rat || {}, out = [], G = new Map();
      const add = (pre, r, q, m) => { const k = pre + "|" + U_(r.des) + "|" + U_(r.u); if (!G.has(k)) G.set(k, { k, lab: (pre === "c" ? "CHG " : "PRD ") + (r.des || ""), u: U_(r.u), q: 0, m: 0 }); const x = G.get(k); x.q += q; x.m += m; };
      (INS.chg || []).filter(r => !r.t).forEach(r => add("c", r, ratNum(r.q), ratNum(r.q) * ratNum(r.p)));
      const pp = new Map(); (INS.links || []).forEach(l => { if (!insLinkPrim(INS, l)) return; const d = INS.des.find(x => x.id === l.des); (l.prd || []).forEach(x => { if (!pp.has(x.id)) pp.set(x.id, d ? ratNum(d.p) : 0); }); });
      (INS.prd || []).filter(r => !r.t).forEach(r => { const q = insPrdQ(r); add("p", r, q, q * (pp.get(r.id) || 0)); });
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
    const ratWin = () => {
      const R = JSON.parse(JSON.stringify(INS.rat || {}));
      R.L = R.L || []; R.lsurf = R.lsurf || {}; R.g = { t: "b", h: 220, ...(R.g || {}) };
      const ed = INS_EDIT;
      let showLots = false;
      const leaves = (INS.lot || []).filter(r => !r.t && !(INS.lot || []).some(o => o !== r && !o.t && U_(o.v).startsWith(U_(r.v) + " / ")));
      const d = sviWinNew();
      const pick = (r, side, I) => `<div class="rat-pk" data-id="${r.id}" data-side="${side}">${(r[side] || []).map(k => { const x = I.find(y => y.k === k); return x ? `<span class="rat-chip">${esc(x.lab)} <i>${esc(x.u)}</i>${ed ? `<b data-rm="${esc(k)}">✕</b>` : ""}</span>` : ""; }).join("")}${ed ? `<select class="rat-add"><option value="">+ AJOUTER…</option>${I.map(x => `<option value="${esc(x.k)}">${esc(x.lab)} (${esc(x.u)})</option>`).join("")}</select>` : ""}</div>`;
      const draw = () => {
        INS.rat = INS.rat || {};
        const prev = INS.rat; INS.rat = R; const I = ratItems(); INS.rat = prev;
        const rows = R.L.map(r => { const c = ratCalc(I, r), sv = ratNum(r.seuil), over = r.seuil !== "" && r.seuil !== undefined && c.val !== undefined && c.val !== null && c.val > sv;
          return `<tr data-id="${r.id}"><td>${ed ? `<input class="rat-nm" value="${esc(r.nom || "")}">` : esc(r.nom || "")}</td><td>${pick(r, "num", I)}</td><td>${pick(r, "den", I)}</td>
            <td class="c"><select class="rat-md"${ed ? "" : " disabled"}><option value="q"${r.mode !== "m" ? " selected" : ""}>QUANTITÉ</option><option value="m"${r.mode === "m" ? " selected" : ""}>MONTANT</option></select></td>
            <td class="r${c.err ? " rat-err" : over ? " rat-over" : ""}"><b>${esc(c.txt)}</b>${c.n && c.d ? `<small>${ratFx(c.n.v)} ${esc(c.n.u)} · ${ratFx(c.d.v)} ${esc(c.d.u)} · ÉCART ${ratFx(c.diff)}</small>` : ""}</td>
            <td class="c"><input class="rat-sv" inputmode="decimal" value="${esc(r.seuil === undefined ? "" : String(r.seuil).replace(".", ","))}"${ed ? "" : " disabled"}></td>
            <td class="c">${ed ? `<button type="button" class="cmp-del" data-del="${r.id}">✕</button>` : ""}</td></tr>`; }).join("");
        const vals = R.L.map(r => ({ r, c: ratCalc(I, r) })).filter(x => x.c.val !== undefined && x.c.val !== null && Number.isFinite(x.c.val));
        d.innerHTML = sviWinCard({ cls: "cmp-card svc-full rat-card", close: "data-x", title: "TABLEAU DE BORD DES RATIOS",
          body: `<div class="rat-top"><label>SURFACE COUVERTE <input class="pv-in rat-surf" inputmode="decimal" value="${esc(R.surf === undefined ? "" : String(R.surf).replace(".", ","))}"${ed ? "" : " disabled"}> M²</label>
              <button type="button" class="svc-b" data-lots>SURFACES DES LOTS ${svCnt(Object.keys(R.lsurf).length)}</button>
              ${ed ? `<button type="button" class="svc-b" data-add>+ AJOUTER UN RATIO</button><button type="button" class="svc-b" data-prop>PROPOSER</button>` : ""}</div>
            <div class="rat-lots"${showLots ? "" : " hidden"}>${leaves.map(l => `<label class="pv-r"><span>${esc(lotLab(lotSegs(l)).full)}</span><input class="pv-in rat-ls" data-lot="${l.id}" inputmode="decimal" value="${esc(R.lsurf[l.id] === undefined ? "" : String(R.lsurf[l.id]).replace(".", ","))}"${ed ? "" : " disabled"}><i>M²</i></label>`).join("") || `<div class="fz-none">AUCUN LOT</div>`}</div>
            <div class="cmp-scroll rat-scroll"><table class="cmp-t rat-t"><thead><tr><th>RATIO</th><th>NUMÉRATEUR</th><th>DÉNOMINATEUR</th><th>EN</th><th>RÉSULTAT</th><th>SEUIL</th><th></th></tr></thead>
              <tbody>${rows || `<tr><td colspan="7" class="empty">AUCUN RATIO : + AJOUTER UN RATIO OU PROPOSER</td></tr>`}</tbody></table></div>
            <div class="rat-gbar"><span>GRAPHIQUE</span>${[["b", "BARRES"], ["p", "CAMEMBERT"], ["l", "COURBE"], ["h", "HISTOGRAMME"]].map(([v, l]) => `<label><input type="radio" name="ratG" value="${v}"${R.g.t === v ? " checked" : ""}> ${l}</label>`).join("")}
              <label>HAUTEUR <input type="range" class="rat-gh" min="120" max="520" step="20" value="${R.g.h}"></label></div>
            <div class="rat-g" style="height:${R.g.h}px">${ratChart(vals, R.g.t, R.g.h)}</div>`,
          foot: `<button type="button" class="svc-b" data-x>${ed ? "ANNULER" : "FERMER"}</button>${ed ? `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button>` : ""}` });
      };
      draw();
      sviWinShow(d);
      const rOf = el => R.L.find(r => r.id === el.closest("tr[data-id]")?.dataset.id);
      d.addEventListener("change", e => {
        const t = e.target;
        if (t.classList.contains("rat-add") && t.value) { const r = R.L.find(x => x.id === t.closest(".rat-pk").dataset.id), s = t.closest(".rat-pk").dataset.side; r[s] = (r[s] || []).filter(k => k !== t.value).concat(t.value); draw(); return; }
        if (t.classList.contains("rat-md")) { rOf(t).mode = t.value; draw(); return; }
        if (t.name === "ratG") { R.g.t = t.value; draw(); return; }
        if (t.classList.contains("rat-gh")) { R.g.h = Number(t.value); draw(); return; }
        if (t.classList.contains("rat-nm")) { rOf(t).nom = t.value.toUpperCase(); return; }
        if (t.classList.contains("rat-sv")) { rOf(t).seuil = t.value.trim() === "" ? "" : ratNum(t.value); draw(); return; }
        if (t.classList.contains("rat-surf")) { R.surf = t.value.trim() === "" ? "" : ratNum(t.value); draw(); return; }
        if (t.classList.contains("rat-ls")) { if (t.value.trim() === "") delete R.lsurf[t.dataset.lot]; else R.lsurf[t.dataset.lot] = ratNum(t.value); return; }
      });
      d.addEventListener("click", e => {
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
        const rm = e.target.closest("[data-rm]");
        if (rm) { const pk = rm.closest(".rat-pk"), r = R.L.find(x => x.id === pk.dataset.id); r[pk.dataset.side] = (r[pk.dataset.side] || []).filter(k => k !== rm.dataset.rm); draw(); return; }
        const del = e.target.closest("[data-del]");
        if (del) { R.L = R.L.filter(r => r.id !== del.dataset.del); draw(); return; }
        if (e.target.closest("[data-add]")) { R.L.push({ id: insId(), nom: "RATIO " + (R.L.length + 1), num: [], den: [], mode: "q", seuil: "" }); draw(); return; }
        if (e.target.closest("[data-prop]")) {
          const prev = INS.rat; INS.rat = R; const I = ratItems(); INS.rat = prev;
          const P = ratPropose(I).filter(p => !R.L.some(r => U_(r.nom) === U_(p.nom)));
          if (!P.length) svToast("AUCUN RATIO À PROPOSER : DONNÉES INSUFFISANTES (SURFACE, ACIERS, BÉTON, MAIN-D'ŒUVRE…).", 4000, e.target);
          R.L = R.L.concat(P); draw(); return;
        }
        if (e.target.closest("[data-lots]")) { showLots = !showLots; draw(); return; }
        if (e.target.closest("[data-save]")) { INS.rat = R; insSave(); histLog("RATIOS", "TABLEAU DE BORD", R.L.length + " RATIO(S)"); d.remove(); refreshAll(); }
      });
    };
    /* graphique en SVG (valeurs des ratios) */
    const ratChart = (vals, t, h) => {
      if (!vals.length) return `<div class="fz-none">AUCUNE VALEUR À REPRÉSENTER</div>`;
      const W = 760, H = Math.max(100, h - 10), C = ["#2e90fa", "#12b76a", "#f79009", "#7a5af8", "#ee46bc", "#06aed4", "#f04438", "#667085"];
      const mx = Math.max(...vals.map(x => Math.abs(x.c.val)), 1e-9);
      const lab = s => esc(String(s).slice(0, 18));
      if (t === "p") {
        const tot = vals.reduce((a, x) => a + Math.abs(x.c.val), 0) || 1; let a0 = -Math.PI / 2; const r = Math.min(H / 2 - 10, 120), cx = r + 20, cy = H / 2;
        const sl = vals.map((x, i) => { const a1 = a0 + Math.abs(x.c.val) / tot * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0;
          const p = `<path d="M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${big} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} Z" fill="${C[i % C.length]}"/>`; a0 = a1; return p; }).join("");
        const lg = vals.map((x, i) => `<rect x="${2 * r + 50}" y="${14 + i * 20}" width="12" height="12" fill="${C[i % C.length]}"/><text x="${2 * r + 68}" y="${24 + i * 20}">${lab(x.r.nom)} — ${esc(ratFx(x.c.val, 3))}</text>`).join("");
        return `<svg viewBox="0 0 ${W} ${H}" class="rat-svg">${sl}${lg}</svg>`;
      }
      const bw = (W - 40) / vals.length, y = v => H - 24 - Math.abs(v) / mx * (H - 44);
      if (t === "l") {
        const pts = vals.map((x, i) => `${30 + bw * i + bw / 2},${y(x.c.val)}`).join(" ");
        return `<svg viewBox="0 0 ${W} ${H}" class="rat-svg"><polyline points="${pts}" fill="none" stroke="#2e90fa" stroke-width="2.5"/>${vals.map((x, i) => `<circle cx="${30 + bw * i + bw / 2}" cy="${y(x.c.val)}" r="4" fill="#2e90fa"/><text x="${30 + bw * i + bw / 2}" y="${H - 6}" text-anchor="middle">${lab(x.r.nom)}</text><text x="${30 + bw * i + bw / 2}" y="${y(x.c.val) - 8}" text-anchor="middle">${esc(ratFx(x.c.val, 2))}</text>`).join("")}</svg>`;
      }
      const gap = t === "h" ? 2 : bw * .25;
      return `<svg viewBox="0 0 ${W} ${H}" class="rat-svg">${vals.map((x, i) => { const sv = ratNum(x.r.seuil), over = x.r.seuil !== "" && x.r.seuil !== undefined && x.c.val > sv;
        return `<rect x="${30 + bw * i + gap / 2}" y="${y(x.c.val)}" width="${bw - gap}" height="${H - 24 - y(x.c.val)}" fill="${over ? "#f04438" : C[i % C.length]}" rx="${t === "h" ? 0 : 3}"/>${x.r.seuil !== "" && x.r.seuil !== undefined ? `<line x1="${30 + bw * i}" x2="${30 + bw * (i + 1)}" y1="${y(sv)}" y2="${y(sv)}" stroke="#b91c1c" stroke-dasharray="4 3"/>` : ""}<text x="${30 + bw * i + bw / 2}" y="${H - 6}" text-anchor="middle">${lab(x.r.nom)}</text><text x="${30 + bw * i + bw / 2}" y="${y(x.c.val) - 6}" text-anchor="middle">${esc(ratFx(x.c.val, 2))}</text>`; }).join("")}</svg>`;
    };

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
    shell.__ratWin = () => ratWin();
    shell.__multiWin = () => multiWin();
    shell.__signWin = () => signWin();
