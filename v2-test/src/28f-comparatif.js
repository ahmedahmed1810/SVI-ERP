/* =========================================================
   v837 : DÉCOUPE DU GRAND BLOC (programme, point 4) — le COMPARATIF des budgets sort de openBudgetDetail.
   Appelé depuis l'écran du budget (22m-comparatif.js) avec ce dont il a besoin ; histLog (déclaré plus loin dans l'écran du budget) est lu au moment de l'appel.
   ========================================================= */
function sviBdgComparatif(C) {
  const { AV_ROOT, INS, budget, groups, i1List, ibdFx, ibdSteps, ibdUnit, indCalc, indEls, indNum, insSave, ratPerSub, ratSub, ref, shell, verInd } = C;
  const histLog = (...a) => C.histLog()(...a);
  /* =========================================================
     v729 (bloc 10) : COMPARATIF — menu ⋯ du haut, pour tout le budget, en lecture seule.
     Fenêtre de choix (FORMAT 261) : deux états quelconques (état actuel, versions, scénarios, budget initial, avenants,
     recalages, consolidé et ses photos) ; COMPARER grisé tant que les deux sont identiques.
     Écran en quatre parties (comme INDICATEURS, poignées) : PLANNING des deux états avec l'écart (J) ; Gantt, barres de
     l'état 2 en couleur sur celles de l'état 1 en gris (FORMAT 262) ; graphique d'un ou deux indicateurs (⚙), deux courbes
     par indicateur (FORMAT 263) ; tableau des valeurs, une ligne par abscisse, ÉTAT 1 / ÉTAT 2 / ÉCART (FORMAT 264), copiable.
     Rien n'est modifié : chaque état est une copie.
     ========================================================= */
  const CMP_KEY = "svi_cmp_v1";
  const cmpPref = () => { try { return { cw: 45, rh: 240, step: "s", cum: false, y1: "", y2: "", ...(JSON.parse(localStorage.getItem(CMP_KEY) || "{}") || {}) }; } catch (e) { return { cw: 45, rh: 240, step: "s", cum: false, y1: "", y2: "" }; } };
  const cmpPrefSet = o => { try { localStorage.setItem(CMP_KEY, JSON.stringify({ ...cmpPref(), ...o })); } catch (e) {} };
  /* états proposés : [{ v, lab, d() }] */
  const cmpStates = () => {
    const out = [], cp = d => JSON.parse(JSON.stringify(d || {}));
    out.push({ v: "cur", lab: "ÉTAT ACTUEL" + (budget.inst ? " — " + sviAvName(budget.inst) : ""), d: () => cp(INS) });
    (INS.vfz || []).forEach(x => { if (x.d) out.push({ v: "v:" + x.id, lab: "VERSION " + (x.n || "") + (x.kind ? " (" + x.kind + ")" : "") + (x.date ? " — " + x.date : ""), d: () => cp(x.d) }); });
    const V = INS.ver || {}; (V.L || []).filter(x => x.kind === "sc" && x.d && x.id !== V.act).forEach(x => out.push({ v: "s:" + x.id, lab: "SCÉNARIO — " + (x.nom || ""), d: () => cp(x.d) }));
    const ref = budget.inst && !budget.inst.virtual ? (budget.inst.rclOf || budget.inst.ref) : budget.inst ? String(budget.inst.ref).replace(/-GLOBAL$/, "") : "";
    const S = ref ? sviAvStages(ref) : [];
    S.forEach(st => {
      out.push({ v: "b:" + st.ref, lab: sviAvName(st) + (st.state === "valide" ? " (VALIDÉ)" : st.state === "fige" ? " (FIGÉ)" : " (EN INSTANCE)"), d: () => cp(st.data) });
      sviRclOf(st.ref).forEach(r => out.push({ v: "b:" + r.ref, lab: "RECALAGE R" + (r.rcn || "") + " — " + sviAvName(st), d: () => cp(r.data) }));
    });
    if (S.length > 1) {
      out.push({ v: "g", lab: "BUDGET CONSOLIDÉ", d: () => cp(sviAvMerge(S[0].ref)) });
      ((S[0].data || {}).cfz || []).forEach(x => { if (x.d) out.push({ v: "c:" + x.id, lab: "PHOTO DU CONSOLIDÉ " + (x.n || "") + (x.date ? " — " + x.date : ""), d: () => cp(x.d) }); });
    }
    /* v771 : AUTRES BUDGETS de l'appareil (budget initial, avenants, consolidé) — sélection libre */
    const root0 = S[0] ? S[0].ref : ref;
    let AL = []; try { AL = sviInstGet().filter(b => b && b.data && !b.virtual && !b.rclOf && !b.arch && (b.parent || b.ref) !== root0); } catch (e) {}
    AL.sort((a, b) => String(a.parent || a.ref).localeCompare(String(b.parent || b.ref), "fr", { numeric: true }) || (a.avn || 0) - (b.avn || 0)).forEach(b => {
      const st = b.state === "valide" ? " (VALIDÉ)" : b.state === "fige" ? " (FIGÉ)" : " (EN INSTANCE)";
      out.push({ v: "o:" + b.ref, lab: U_(b.project || "") + " " + b.ref + " — " + sviAvName(b) + st, d: () => cp(b.data) });
      if (!b.parent && AL.some(x => x.parent === b.ref)) out.push({ v: "og:" + b.ref, lab: U_(b.project || "") + " " + b.ref + " — CONSOLIDÉ", d: () => cp(sviAvMerge(b.ref)) });
    });
    return out;
  };
  /* tâches d'un état : nom « LOT › ACTIVITÉ SECONDAIRE » → { deb, fin } (plusieurs morceaux : du premier début à la dernière fin) */
  const cmpPrep = d => { try { if (!d.dlpSec) sviDlpSec(d); } catch (e) {} return d; };
  const cmpName = (d, k) => { const [lo, se] = String(k).split("|"); const L = (d.lot || []).find(x => x.id === lo), Sx = (d.sec || []).find(x => x.id === se); return U_(L ? L.v : lo) + " › " + U_(Sx ? Sx.v : se); };
  const cmpTasks = d => { const M = new Map(); Object.keys(d.dlp || {}).forEach(k => { const P = (d.dlp[k] || []).filter(p => p.deb); if (!P.length) return; const n = cmpName(d, k), x = M.get(n) || { deb: "", fin: "", k };
    P.forEach(p => { if (!x.deb || p.deb < x.deb) x.deb = p.deb; const f = p.fin || p.deb; if (!x.fin || f > x.fin) x.fin = f; }); M.set(n, x); }); return M; };
  const cmpDays = (a, b) => a && b ? Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5) : null;
  const cmpSign = (v, dec = 0) => v === null || v === undefined || !isFinite(v) ? "—" : (v > 0 ? "+" : "") + indNum(v, dec);
  const cmpCol = v => v === null || v === undefined || !isFinite(v) || Math.abs(v) < 1e-9 ? "" : v < 0 ? " cmp-neg" : " cmp-pos";
  /* fenêtre de choix des deux états (FORMAT 261) */
  const cmpPick = () => {
    if (!INS) { svToast("COMPARATIF : BUDGET EN INSTANCE, FIGÉ OU VALIDÉ SEULEMENT.", 3000); return; }
    const L = cmpStates(), P = cmpPref(), d = sviWinNew();
    const a0 = L.some(x => x.v === P.a) ? P.a : (L[1] || L[0]).v, b0 = L.some(x => x.v === P.b) && P.b !== a0 ? P.b : "cur";
    const sel = (nm, v) => `<select class="pv-in cmp-sel" data-cs="${nm}" style="width:100%">${L.map(x => `<option value="${esc(x.v)}"${x.v === v ? " selected" : ""}>${esc(x.lab)}</option>`).join("")}</select>`;
    d.innerHTML = sviWinCard({ cls: "hcf-card cmp-pick", close: "data-x", title: "COMPARATIF",
      body: `<div class="hcf-g"><span class="hcf-k">ÉTAT 1</span><span>${sel("a", a0)}</span><span class="hcf-k">ÉTAT 2</span><span>${sel("b", b0)}</span></div>
        <div class="hcf-note">LECTURE SEULE : LE COMPARATIF NE MODIFIE RIEN.</div>`,
      foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-cmpgo>COMPARER</button>` });
    sviWinShow(d);
    const go = d.querySelector("[data-cmpgo]"), paint = () => { const same = d.querySelector('[data-cs="a"]').value === d.querySelector('[data-cs="b"]').value; go.disabled = same; go.classList.toggle("off", same); go.title = same ? "LES DEUX ÉTATS SONT IDENTIQUES" : ""; };
    paint(); d.addEventListener("change", paint);
    d.addEventListener("click", e => {
      if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
      if (e.target.closest("[data-cmpgo]")) { if (go.disabled) { svToast("CHOISIR DEUX ÉTATS DIFFÉRENTS.", 2500, go); return; }
        const a = d.querySelector('[data-cs="a"]').value, b = d.querySelector('[data-cs="b"]').value; cmpPrefSet({ a, b }); d.remove(); cmpOpen(a, b); }
    });
  };
  /* écran du comparatif */
  const cmpOpen = (av, bv) => {
    const L = cmpStates(), A = L.find(x => x.v === av), B = L.find(x => x.v === bv); if (!A || !B) return;
    const D1 = cmpPrep(A.d()), D2 = cmpPrep(B.d());
    const d = sviWinNew();
    const draw = () => {
      const P = cmpPref(), T1 = cmpTasks(D1), T2 = cmpTasks(D2);
      const names = [...new Set([...T1.keys(), ...T2.keys()])].sort((x, y) => String((T2.get(x) || T1.get(x)).deb).localeCompare(String((T2.get(y) || T1.get(y)).deb)) || x.localeCompare(y, "fr"));
      /* PLANNING : dates des deux états, écart de la fin (J) */
      const plan = `<table class="bdg-d-table i1-plan cmp-plan"><thead><tr><th>TÂCHE</th><th>DÉBUT 1</th><th>FIN 1</th><th>DÉBUT 2</th><th>FIN 2</th><th class="number">ÉCART (J)</th></tr></thead><tbody>${names.map(n => { const a = T1.get(n), b = T2.get(n), e = a && b ? cmpDays(a.fin, b.fin) : null;
        return `<tr><td>${esc(n)}</td><td>${a ? esc(dFr(a.deb)) : "—"}</td><td>${a ? esc(dFr(a.fin)) : "—"}</td><td>${b ? esc(dFr(b.deb)) : "—"}</td><td>${b ? esc(dFr(b.fin)) : "—"}</td><td class="number${cmpCol(e === null ? null : -e)}">${a && b ? cmpSign(e) : a ? "RETIRÉE" : "NOUVELLE"}</td></tr>`; }).join("") || `<tr><td colspan="6" class="empty">AUCUNE TÂCHE DATÉE</td></tr>`}</tbody></table>`;
      /* Gantt : état 1 gris dessous, état 2 en couleur dessus (FORMAT 262) */
      const all = names.flatMap(n => [T1.get(n), T2.get(n)].filter(Boolean)), d0 = all.map(x => x.deb).sort()[0] || "", d1 = all.map(x => x.fin).sort().pop() || "", span = d0 ? Math.max(1, cmpDays(d0, d1) + 1) : 1;
      const bar = (x, cls) => x ? `<span class="${cls}" style="left:${cmpDays(d0, x.deb) / span * 100}%;width:${Math.max(.6, (cmpDays(x.deb, x.fin) + 1) / span * 100)}%"></span>` : "";
      const gantt = names.length ? `<div class="i1-gantt cmp-gantt">${names.map(n => `<div class="i1-gr cmp-gr" title="${esc(n)}">${bar(T1.get(n), "cmp-g1")}${bar(T2.get(n), "i1-gb cmp-g2")}</div>`).join("")}<div class="i1-gx"><span>${esc(dFr(d0))}</span><span>${esc(dFr(d1))}</span></div></div>` : `<div class="empty">AUCUNE TÂCHE DATÉE</div>`;
      /* indicateurs : une ou deux ordonnées */
      const IL = i1List(), Y = [P.y1, P.y2].map(id => IL.find(I => I.id === id)).filter(Boolean);
      if (!Y.length && IL[0]) Y.push(IL[0]);
      let pts = [], labX = "";
      if (P.step === "t") { labX = "TÂCHE"; pts = names.map(n => ({ lab: n, f: D => { const k = (cmpTasks(D).get(n) || {}).k; return k ? ratSub(D, l => l.lot + "|" + l.sec === k) : null; } })); }
      else { labX = P.step === "j" ? "JOUR" : P.step === "m" ? "MOIS" : "SEMAINE"; const Pp = ibdSteps({ dlp: { ...Object.fromEntries(Object.entries(D1.dlp || {}).map(([k, v]) => ["a" + k, v])), ...Object.fromEntries(Object.entries(D2.dlp || {}).map(([k, v]) => ["b" + k, v])) } }, P.step);
        pts = Pp.map(p => ({ lab: p.lab, f: D => ratPerSub(D, P.cum ? Pp[0].a : p.a, p.b) })); }
      const val = (I, D, p) => { const s = p.f(D); if (!s) return null; const r = indCalc(I, s); return r.val === undefined || r.val === null || typeof r.val !== "number" ? null : (I.fmt === "p" ? r.val * 100 : r.val); };
      const SER = Y.map(I => ({ I, u: ibdUnit(I, indEls(D2)), a: pts.map(p => val(I, D1, p)), b: pts.map(p => val(I, D2, p)) }));
      /* tableau des valeurs (FORMAT 264) */
      const head = [labX, ...SER.flatMap(s => [s.I.nom + " — ÉTAT 1", s.I.nom + " — ÉTAT 2", s.I.nom + " — ÉCART"])];
      const rows = pts.map((p, i) => [p.lab, ...SER.flatMap(s => { const x = s.a[i], y = s.b[i]; return [x, y, x !== null && y !== null ? y - x : null]; })]);
      shell.__cmpTsv = [head.join("\t"), ...rows.map(r => r.map((v, j) => j === 0 ? v : v === null ? "" : (j % 3 === 0 ? cmpSign(v, 2) : indNum(v, 2))).join("\t"))].join("\n");
      const vals = `<table class="bdg-d-table i1-vals cmp-vals"><thead><tr><th>${esc(labX)}</th>${SER.map(s => `<th class="number">ÉTAT 1</th><th class="number">ÉTAT 2</th><th class="number">ÉCART</th>`).join("")}</tr>
        ${SER.length > 1 ? `<tr><th></th>${SER.map((s, j) => `<th colspan="3" class="center">${esc(s.I.nom)} (${j ? "DROITE" : "GAUCHE"})</th>`).join("")}</tr>` : ""}</thead>
        <tbody>${rows.map(r => `<tr><td>${esc(r[0])}</td>${r.slice(1).map((v, j) => `<td class="number${j % 3 === 2 ? cmpCol(v) : ""}">${v === null ? "" : j % 3 === 2 ? cmpSign(v, 2) : indNum(v, 2)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${1 + SER.length * 3}" class="empty">AUCUNE VALEUR</td></tr>`}</tbody></table>`;
      /* graphique : état 1 gris foncé pointillé, état 2 bleu foncé plein (FORMAT 263) ; 2e indicateur sur l'axe droit, tons plus clairs */
      const chart = (() => {
        if (!pts.length || !SER.length) return `<div class="fz-none">${SER.length ? "AUCUNE DATE AU PLANNING" : "CHOISIR UN INDICATEUR (⚙)"}</div>`;
        const H = 300, pl = 64, pr = SER.length > 1 ? 64 : 16, pb = 40, pt = 14, n = pts.length, W = Math.max(640, pl + pr + n * (n > 120 ? 6 : 18));
        const ax = SER.map(s => { const v = s.a.concat(s.b).filter(x => x !== null); const mx = Math.max(0, ...v), mn = Math.min(0, ...v); return { mx, mn, span: (mx - mn) || 1, u: s.u }; });
        const y = (a, v) => pt + (a.mx - v) / a.span * (H - pb - pt), cw = (W - pl - pr) / n, x = i => pl + cw * i + cw / 2;
        const C = [["#475467", "#1d3a8a"], ["#98a2b3", "#2e90fa"]];
        const line = (s, j, k) => { const a = ax[j], vv = k ? s.b : s.a, P2 = vv.map((v, i) => v === null ? null : [x(i), y(a, v)]).filter(Boolean);
          return `<polyline points="${P2.map(q => q.join(",")).join(" ")}" fill="none" stroke="${C[j][k]}" stroke-width="${k ? 2.6 : 2}"${k ? "" : ' stroke-dasharray="6 4"'}/>`; };
        const grid = [0, .25, .5, .75, 1].map(t => { const v = ax[0].mn + ax[0].span * t; return `<line x1="${pl}" x2="${W - pr}" y1="${y(ax[0], v)}" y2="${y(ax[0], v)}" stroke="#eaecf0"/><text x="${pl - 4}" y="${y(ax[0], v) + 4}" text-anchor="end" class="rat-ax">${esc(ibdFx(v, 0))}</text>` + (ax[1] ? `<text x="${W - pr + 4}" y="${y(ax[0], v) + 4}" class="rat-ax">${esc(ibdFx(ax[1].mn + ax[1].span * t, 0))}</text>` : ""); }).join("");
        const every = Math.max(1, Math.ceil(n / 24)), xl = pts.map((p, i) => i % every ? "" : `<text x="${x(i)}" y="${H - 16}" text-anchor="middle" class="rat-ax">${esc(String(p.lab).slice(0, 10))}</text>`).join("");
        const leg = `<div class="rat-leg cmp-leg">${SER.map((s, j) => [0, 1].map(k => `<span><i class="${k ? "" : "cmp-dash"}" style="background:${C[j][k]}"></i>${esc(s.I.nom)} — ÉTAT ${k + 1} <small>(${esc(s.u || "—")}${SER.length > 1 ? (j ? ", AXE DROIT" : ", AXE GAUCHE") : ""})</small></span>`).join("")).join("")}</div>`;
        return leg + `<div class="rat-gx"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="rat-svg">${grid}${SER.map((s, j) => line(s, j, 0) + line(s, j, 1)).join("")}${xl}</svg></div>`;
      })();
      d.innerHTML = sviWinCard({ cls: "cmp-card svc-full", close: "data-x", title: "COMPARATIF — 1 : " + esc(A.lab) + " / 2 : " + esc(B.lab),
        body: `<div class="cmp-sub">LECTURE SEULE. ÉCART = ÉTAT 2 − ÉTAT 1.</div>
        <div class="i1-wrap cmp-wrap" style="--i1-cw:${P.cw}%;--i1-rh:${P.rh}px">
          <div class="i1-p i1-tl">${plan}</div><div class="i1-vh" data-cmph="c" title="Largeur">‖</div><div class="i1-p i1-tr">${gantt}</div>
          <div class="i1-hh" data-cmph="r" title="Hauteur">=</div>
          <div class="i1-p i1-bl"><div class="i1-bar"><b>VALEURS</b><button type="button" class="svc-b" data-cmpcopy>COPIER</button></div>${vals}</div>
          <div class="i1-vh i1-vh2" data-cmph="c">‖</div>
          <div class="i1-p i1-br"><div class="i1-bar"><b>${esc(SER.map(s => s.I.nom).join(" / ") || "INDICATEUR")}</b><button type="button" class="blk-btn i1-cfg" data-cmpcfg title="Choisir les indicateurs">⚙</button></div><div class="i1-chart">${chart}</div></div>
        </div>`,
        foot: `<button type="button" class="svc-b" data-cmpch>CHANGER LES ÉTATS</button><button type="button" class="svc-b svc-ok svc-neutral" data-x>FERMER</button>` });
    };
    draw();
    sviWinShow(d);
    d.addEventListener("click", e => {
      if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
      if (e.target.closest("[data-cmpch]")) { d.remove(); cmpPick(); return; }
      if (e.target.closest("[data-cmpcopy]")) { try { navigator.clipboard.writeText(shell.__cmpTsv || ""); } catch (er) {} svToast("TABLEAU COPIÉ.", 1800, e.target); return; }
      if (e.target.closest("[data-cmpcfg]")) { cmpCfgWin(draw); return; }
    });
    d.addEventListener("pointerdown", e => {
      const h = e.target.closest("[data-cmph]"); if (!h) return; e.preventDefault();
      const w = h.closest(".i1-wrap"), r = w.getBoundingClientRect(), kind = h.dataset.cmph; let v = null;
      const mv = ev => { if (kind === "c") { const cw = Math.max(15, Math.min(85, (ev.clientX - r.left) / r.width * 100)); w.style.setProperty("--i1-cw", cw + "%"); v = { cw }; }
        else { const rh = Math.max(80, Math.min(r.height - 80, ev.clientY - r.top)); w.style.setProperty("--i1-rh", rh + "px"); v = { rh }; } };
      const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); if (v) cmpPrefSet(v); };
      document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
    });
  };
  /* ⚙ : un ou deux indicateurs (axe gauche / droit), abscisse, unitaire / cumulé */
  const cmpCfgWin = redraw => {
    const P = cmpPref(), IL = i1List(), w = document.createElement("div");
    const opt = (sel, none) => (none ? `<option value="">— AUCUN —</option>` : "") + IL.map(I => `<option value="${esc(I.id)}"${I.id === sel ? " selected" : ""}>${esc(I.nom)}</option>`).join("");
    w.id = "cmpCfg"; w.className = "sv-conf";
    w.innerHTML = sviWinCard({ cls: "hcf-card", close: "data-x", title: "RÉGLAGES DU COMPARATIF",
      body: `<div class="hcf-g"><span class="hcf-k">AXE GAUCHE</span><span><select class="pv-in" data-cc="y1" style="width:100%">${opt(P.y1 || (IL[0] || {}).id)}</select></span>
        <span class="hcf-k">AXE DROIT</span><span><select class="pv-in" data-cc="y2" style="width:100%">${opt(P.y2, true)}</select></span>
        <span class="hcf-k">ABSCISSE</span><span class="hcf-sw hcf-sw3">${[["j", "JOUR"], ["s", "SEMAINE"], ["m", "MOIS"], ["t", "TÂCHES"]].map(([v, l]) => `<label class="hcf-seg${P.step === v ? " on" : ""}"><input type="radio" name="cms" value="${v}"${P.step === v ? " checked" : ""}><span>${l}</span></label>`).join("")}</span>
        <span class="hcf-k">PRÉSENTATION</span><span class="hcf-sw">${[["0", "UNITAIRE"], ["1", "CUMULÉ"]].map(([v, l]) => `<label class="hcf-seg${(P.cum ? "1" : "0") === v ? " on" : ""}"><input type="radio" name="cmc" value="${v}"${(P.cum ? "1" : "0") === v ? " checked" : ""}><span>${l}</span></label>`).join("")}</span></div>`,
      foot: `<button type="button" class="svc-b svc-ok svc-neutral" data-x>FERMER</button>` });
    w.style.cssText = "position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;background:rgba(16,24,40,.25)";
    document.body.appendChild(w);
    w.addEventListener("change", e => { const t = e.target;
      if (t.dataset.cc) cmpPrefSet({ [t.dataset.cc]: t.value }); else if (t.name === "cms") cmpPrefSet({ step: t.value }); else if (t.name === "cmc") cmpPrefSet({ cum: t.value === "1" });
      if (t.closest(".hcf-seg")) t.closest(".hcf-sw").querySelectorAll(".hcf-seg").forEach(s => s.classList.toggle("on", s.querySelector("input").checked));
      redraw(); });
    w.addEventListener("click", e => { if (e.target === w || e.target.closest("[data-x]")) w.remove(); });
  };
  /* =========================================================
     v757 : COMPARER — UN SEUL, pour tout le budget (bloc AVENANTS / SCÉNARIOS / VERSIONS / RECALAGES et menu ⋯ du haut).
     On coche librement autant d'éléments qu'on veut, de n'importe quel type (état actuel, budget initial, avenants, consolidé,
     scénarios, versions, recalages, photos du consolidé) ; ils s'affichent côte à côte (une colonne par élément, les indicateurs
     en lignes, écart avec le premier). Deux éléments cochés : COMPARER EN DÉTAIL ouvre aussi l'écran en quatre parties (planning).
     ========================================================= */
  const CMPM_TYPES = [["cur", "ÉTAT ACTUEL"], ["b", "BUDGET INITIAL ET AVENANTS"], ["g", "CONSOLIDÉ"], ["s", "SCÉNARIOS"], ["v", "VERSIONS"], ["r", "RECALAGES"], ["c", "PHOTOS DU CONSOLIDÉ"], ["o", "AUTRES BUDGETS"]];
  const cmpmType = x => x.v === "cur" ? "cur" : x.v === "g" ? "g" : /^o/.test(x.v.split(":")[0]) ? "o" : /^RECALAGE/.test(x.lab) ? "r" : x.v.split(":")[0];
  const cmpmTtc = d => { try { return (d.des || []).filter(r => !r.t).reduce((t, r) => { const lq = insLinkedQ(d, r.id); const q = lq !== null ? lq : num(r.q || 0);
    return t + q * num(r.p || 0) * (1 + (sviTvaOf(r.tva) ?? 0) / 100); }, 0); } catch (e) { return 0; } };
  const CMPM_IND = [["ttc", "MONTANT TTC", d => cmpmTtc(d), 2], ["prd", "PRODUITS HT (DH)", d => verInd(d).prd, 2], ["chg", "CHARGES (DH)", d => verInd(d).chg, 2], ["mo", "MAIN-D'ŒUVRE (DH)", d => verInd(d).mo, 2],
    ["mg", "MARGE (DH)", d => verInd(d).mg, 2], ["mgp", "MARGE (%)", d => verInd(d).mgp, 2], ["fin", "DATE DE FIN", d => verInd(d).fin, "d"], ["dur", "DURÉE (J CALENDAIRES)", d => verInd(d).dur, 0],
    ["but", "MARGE SUR LA DATE BUTOIR (J)", d => verInd(d).but, 0], ["eff", "EFFECTIF MAXIMUM (J-H / JOUR)", d => verInd(d).eff, 1], ["lots", "LOTS", d => verInd(d).lots, 0],
    ["ndes", "DÉSIGNATIONS CLIENT", d => (d.des || []).filter(r => !r.t).length, 0], ["nchg", "CHARGES (LIGNES)", d => (d.chg || []).filter(r => !r.t).length, 0]];
  const cmpmFmt = (v, f) => v === null || v === undefined || v === "" || (typeof v === "number" && !isFinite(v)) ? "—" : f === "d" ? (/^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(8, 10) + "/" + String(v).slice(5, 7) + "/" + String(v).slice(0, 4) : String(v)) : indNum(v, f);
  const cmpMulti = k => {
    if (!INS) { svToast("COMPARER : BUDGET EN INSTANCE, FIGÉ OU VALIDÉ SEULEMENT.", 3000); return; }
    const L = cmpStates(), d = sviWinNew();
    const pre = new Set(["cur"]);
    if (k === "av") L.filter(x => x.v.startsWith("b:") && !/^RECALAGE/.test(x.lab)).forEach(x => pre.add(x.v));
    if (k === "scn") L.filter(x => x.v.startsWith("s:")).forEach(x => pre.add(x.v));
    if (k === "ver") { const v = L.find(x => x.v.startsWith("v:")); if (v) pre.add(v.v); }
    if (k === "rcl") L.filter(x => /^RECALAGE/.test(x.lab)).forEach(x => pre.add(x.v));
    const S = new Set([...pre].filter(v => L.some(x => x.v === v)));
    const groups = CMPM_TYPES.map(([t, lab]) => [lab, L.filter(x => cmpmType(x) === t)]).filter(g => g[1].length);
    const foot = () => `<button type="button" class="svc-b cmpm-close" data-x>✕ FERMER</button>${S.size === 2 ? `<button type="button" class="svc-b" data-cmpdet>COMPARER EN DÉTAIL (PLANNING)</button>` : ""}<button type="button" class="svc-b svc-ok svc-neutral" data-cmpgo${S.size < 2 ? " disabled" : ""}>COMPARER ${svCnt(S.size)}</button><button type="button" class="svc-b svc-ok" data-cumgo${S.size < 2 ? " disabled" : ""}>CUMULER ${svCnt(S.size)}</button>`;
    d.innerHTML = sviWinCard({ cls: "hcf-card cmpm-pick", close: "data-x", title: "SÉLECTION — ÉLÉMENTS À METTRE CÔTE À CÔTE",
      body: `<div class="svc-sub">COCHER AU MOINS DEUX ÉLÉMENTS, DE N'IMPORTE QUEL TYPE (AUTRES BUDGETS COMPRIS). COMPARER = ÉCARTS, CONSULTATION SEULE ; CUMULER = SOMME, À ENREGISTRER COMME SCÉNARIO, AVENANT OU RECALAGE.</div><div class="cmpm-list">${groups.map(([lab, G]) => `<div class="cmpm-g">${esc(lab)}</div>${G.map(x => `<label class="cmpm-it"><input type="checkbox" data-cv="${esc(x.v)}"${S.has(x.v) ? " checked" : ""}> ${esc(x.lab)}</label>`).join("")}`).join("")}</div>`,
      foot: foot() });
    sviWinShow(d);
    d.addEventListener("change", e => { const c = e.target.closest("[data-cv]"); if (!c) return; if (c.checked) S.add(c.dataset.cv); else S.delete(c.dataset.cv); d.querySelector(".svc-f").innerHTML = foot(); });
    d.addEventListener("click", e => {
      if (e.target === d || e.target.closest("[data-x]")) { d.remove(); cmpBack(k); return; }
      const ord = L.map(x => x.v).filter(v => S.has(v));
      if (e.target.closest("[data-cmpdet]") && ord.length === 2) { d.remove(); cmpOpen(ord[0], ord[1]); return; }
      if (e.target.closest("[data-cmpgo]") && ord.length >= 2) { d.remove(); cmpMultiShow(ord, k); return; }
      if (e.target.closest("[data-cumgo]") && ord.length >= 2) { d.remove(); cumShow(ord, k); }
    });
  };
  /* FERMER : retour à l'onglet d'où l'on vient (AVENANTS, SCÉNARIOS, VERSIONS, RECALAGES) */
  const cmpBack = k => { if (k && shell.__etpTabSet) shell.__etpTabSet(k); };
  const cmpMultiShow = (vs, k) => {
    const L = cmpStates(), E = vs.map(v => L.find(x => x.v === v)).filter(Boolean).map(x => { let dd = {}; try { dd = cmpPrep(x.d()); } catch (e) {} return { lab: x.lab, d: dd }; });
    const val = (f, x) => { try { return f(x.d); } catch (e) { return null; } };
    const rows = CMPM_IND.map(([id, lab, f, fm]) => {
      const v = E.map(x => val(f, x)), v0 = v[0];
      return `<tr><td class="cmpm-ind">${esc(lab)}</td>${v.map((x, i) => { const ecart = i && typeof x === "number" && typeof v0 === "number" && isFinite(x) && isFinite(v0) ? x - v0 : null;
        return `<td class="number">${esc(cmpmFmt(x, fm))}${ecart !== null && Math.abs(ecart) > 1e-9 ? `<small class="cmpm-ec${cmpCol(ecart)}">${esc(cmpSign(ecart, fm === "d" ? 0 : fm))}</small>` : ""}</td>`; }).join("")}</tr>`;
    }).join("");
    const w = sviWinNew();
    w.innerHTML = sviWinCard({ cls: "cmp-card cmpm-card", close: "data-x", title: "COMPARER — " + E.length + " ÉLÉMENTS CÔTE À CÔTE",
      body: `<div class="svc-sub">ÉCART AFFICHÉ SOUS CHAQUE VALEUR, PAR RAPPORT À LA PREMIÈRE COLONNE. LECTURE SEULE.</div><div class="cmpm-scroll"><table class="pv-t cmpm-t"><thead><tr><th>INDICATEUR</th>${E.map(x => `<th class="number">${esc(x.lab)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`,
      foot: `<button type="button" class="svc-b" data-cmpsel>‹ SÉLECTION</button><button type="button" class="svc-b" data-cmpcp>COPIER</button><button type="button" class="svc-b svc-ok svc-neutral cmpm-close" data-x>✕ FERMER</button>` });
    sviWinShow(w);
    w.addEventListener("click", e => {
      if (e.target === w || e.target.closest("[data-x]")) { w.remove(); cmpBack(k); return; }
      if (e.target.closest("[data-cmpsel]")) { w.remove(); cmpMulti(k); return; }
      if (e.target.closest("[data-cmpcp]")) {
        const txt = [["INDICATEUR", ...E.map(x => x.lab)], ...CMPM_IND.map(([id, lab, f, fm]) => [lab, ...E.map(x => cmpmFmt(val(f, x), fm))])].map(r => r.join("\t")).join("\n");
        try { (window.sviClipWrite ? window.sviClipWrite(txt) : navigator.clipboard.writeText(txt)); svToast("TABLEAU COPIÉ.", 2000); } catch (err) {}
      }
    });
  };
  /* =========================================================
     v771 : CUMULER — somme des éléments choisis (sviCumMerge : chaque élément garde ses lots, ses charges s'ajoutent) ;
     charges présentes dans plusieurs éléments SIGNALÉES avant d'enregistrer (risque de les compter deux fois) ;
     ENREGISTRER COMME : SCÉNARIO (de ce budget), AVENANT (nouvel avenant de la famille), RECALAGE (de l'étape validée :
     seule la partie à venir change — désignations client et lignes déjà réalisées gardées).
     ========================================================= */
  const cumDups = E => { const M = new Map(); E.forEach((x, i) => (x.d.chg || []).forEach(r => { if (r.t || !U_(r.des)) return; const kk = U_(r.des) + " (" + U_(r.u || "") + ")"; const s0 = M.get(kk) || new Set(); s0.add(i); M.set(kk, s0); }));
    return [...M].filter(([, s0]) => s0.size > 1).map(([kk, s0]) => ({ k: kk, n: s0.size, w: [...s0].map(i => E[i].lab) })); };
  const cumShow = (vs, k) => {
    const L = cmpStates(), E = vs.map(v => L.find(x => x.v === v)).filter(Boolean).map(x => { let dd = {}; try { dd = x.d(); } catch (e) {} return { lab: x.lab, d: dd }; });
    let cum = {}; try { cum = sviCumMerge(E.map(x => ({ ref: x.lab, lab: x.lab, state: "valide", d: x.d }))); } catch (e) {}
    const dups = cumDups(E), C = [...E.map(x => ({ lab: x.lab, d: cmpPrep(JSON.parse(JSON.stringify(x.d))) })), { lab: "CUMUL", d: cmpPrep(JSON.parse(JSON.stringify(cum))) }];
    const val = (f, x) => { try { return f(x.d); } catch (e) { return null; } };
    const rows = CMPM_IND.filter(r => ["ttc", "prd", "chg", "mo", "mg", "mgp", "ndes", "nchg"].includes(r[0])).map(([id, lab, f, fm]) => `<tr><td class="cmpm-ind">${esc(lab)}</td>${C.map((x, i) => `<td class="number${i === C.length - 1 ? " cum-col" : ""}">${esc(cmpmFmt(val(f, x), fm))}</td>`).join("")}</tr>`).join("");
    const w = sviWinNew();
    w.innerHTML = sviWinCard({ cls: "cmp-card cmpm-card", close: "data-x", title: "CUMULER — " + E.length + " ÉLÉMENTS",
      body: `${dups.length ? `<div class="frs-why">⚠ ${dups.length} CHARGE(S) PRÉSENTE(S) DANS PLUSIEURS ÉLÉMENTS — RISQUE DE LES COMPTER DEUX FOIS :<br>${dups.slice(0, 30).map(x => esc(x.k) + " : " + x.n + " FOIS").join(" · ")}${dups.length > 30 ? " …" : ""}</div>` : `<div class="svc-sub">AUCUNE CHARGE EN DOUBLE ENTRE LES ÉLÉMENTS CHOISIS.</div>`}
        <div class="cmpm-scroll"><table class="pv-t cmpm-t"><thead><tr><th>INDICATEUR</th>${C.map((x, i) => `<th class="number${i === C.length - 1 ? " cum-col" : ""}">${esc(x.lab)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`,
      foot: `<button type="button" class="svc-b" data-cmpsel>‹ SÉLECTION</button><button type="button" class="svc-b svc-ok svc-neutral cmpm-close" data-x>✕ FERMER</button>
        <button type="button" class="svc-b svc-ok" data-cumsv="scn">ENREGISTRER COMME SCÉNARIO</button><button type="button" class="svc-b svc-ok" data-cumsv="av">… COMME AVENANT</button><button type="button" class="svc-b svc-ok" data-cumsv="rcl">… COMME RECALAGE</button>` });
    sviWinShow(w);
    w.addEventListener("click", async e => {
      if (e.target === w || e.target.closest("[data-x]")) { w.remove(); cmpBack(k); return; }
      if (e.target.closest("[data-cmpsel]")) { w.remove(); cmpMulti(k); return; }
      const sv = e.target.closest("[data-cumsv]"); if (!sv) return;
      const kind = sv.dataset.cumsv, LAB = { scn: "UN NOUVEAU SCÉNARIO DE CE BUDGET", av: "UN NOUVEL AVENANT", rcl: "UN NOUVEAU RECALAGE (PARTIE À VENIR SEULEMENT ; LE RÉALISÉ N'EST PAS TOUCHÉ)" };
      if (!(await svConfirm({ title: "ENREGISTRER LE CUMUL", html: `<div class="svc-sub">LE CUMUL DE ${E.length} ÉLÉMENTS DEVIENT ${LAB[kind]}.</div>${dups.length ? `<div class="svc-sub"><b>⚠ ${dups.length} CHARGE(S) EN DOUBLE</b> (${esc(dups.slice(0, 8).map(x => x.k).join(", "))}${dups.length > 8 ? "…" : ""}) : VÉRIFIER QU'ELLES NE SONT PAS COMPTÉES DEUX FOIS.</div>` : ""}`, ok: "ENREGISTRER", tone: "neutral" }))) return;
      w.remove(); cumSave(kind, cum, E.map(x => x.lab).join(" + "));
    });
  };
  /* le cumul remplace le contenu d'un budget (dest) ; recalage : désignations client et lignes réalisées gardées, liaisons rattachées par désignation */
  const CUM_KEYS = ["des", "lot", "prim", "sec", "prd", "chg", "qlt", "links", "dlp", "dpred", "dlpSec", "calK", "chgCal", "cond"];
  const sviCumApply = (dest, cum, rcl) => {
    const c = JSON.parse(JSON.stringify(cum));
    if (rcl) {
      const kd = r => [U_(r.art || ""), U_(r.des), U_(r.u || ""), Math.round(num(r.p || 0) * 1e6)].join("|"), M = new Map((dest.des || []).filter(r => !r.t).map(r => [kd(r), r.id]));
      const cd = new Map((c.des || []).filter(r => !r.t).map(r => [r.id, M.get(kd({ ...r, art: String(r.art || "").replace(/^\d+\./, "") })) || M.get(kd({ ...r, art: r.art }))]));
      c.links = (c.links || []).map(l => ({ ...l, des: cd.get(l.des) || "" })).filter(l => l.des);
      const used = (dest.chg || []).filter(r => typeof sviRclUsed === "function" && sviRclUsed(r));
      c.chg = used.concat((c.chg || []).filter(r => !used.some(u => u.id === r.id)));
    }
    CUM_KEYS.forEach(kk => { if (rcl && kk === "des") return; if (c[kk] !== undefined) dest[kk] = c[kk]; });
    delete dest.cum;
    return dest;
  };
  window.__sviCumApply = sviCumApply;
  const cumSave = (kind, cum, why) => {
    if (kind === "scn") {
      const r = $("scnTable") && $("scnTable").querySelector("tr[data-scnadd]");
      if (!r) { svToast(window.__sviRO || "ENREGISTRER : BUDGET EN LECTURE SEULE.", 3500); return; }
      if (r.classList.contains("off")) { svToast(r.textContent.trim(), 3500); return; }
      const before = new Set(((INS.ver || {}).L || []).map(x => x.id)); r.click();
      const nw = ((INS.ver || {}).L || []).filter(x => x.kind === "sc" && !before.has(x.id)).pop();
      if (!nw) return;
      sviCumApply(nw.d = nw.d || {}, cum, false); nw.nom = (nw.nom || "SCÉNARIO") + " — CUMUL"; insSave(); histLog("SCÉNARIO", "CUMUL", why);
      if (shell.__scnSwap) shell.__scnSwap(nw.id);
      if (shell.__etpTabSet) shell.__etpTabSet("scn");
      svToast("CUMUL ENREGISTRÉ COMME SCÉNARIO « " + nw.nom + " ».", 3500); return;
    }
    const bi0 = budget.inst || {}, st0 = bi0.rclOf ? sviInstGet().find(x => x.ref === bi0.rclOf) : bi0, root = AV_ROOT || (st0 && (st0.parent || st0.ref)) || "";
    if (kind === "av") { const S = sviAvStages(root), last = S[S.length - 1];
      if (!last || last.state !== "valide") { svToast("LE DERNIER AVENANT (OU LE BUDGET INITIAL) DOIT ÊTRE VALIDÉ AVANT D'AJOUTER UN AVENANT.", 4000); return; }
      window.__sviCumNext = { k: "av", d: cum, why, t: Date.now() }; window.__sviAvNew && window.__sviAvNew(root, ref); return; }
    if (kind === "rcl") { if (!st0 || st0.virtual || st0.state !== "valide") { svToast("UN RECALAGE SE FAIT SUR UNE ÉTAPE VALIDÉE : OUVRIR L'ÉTAPE (OU SON RECALAGE).", 4000); return; }
      window.__sviCumNext = { k: "rcl", d: cum, why, t: Date.now() }; if (shell.__rclNew) shell.__rclNew(); }
  };
  shell.__cmpMulti = cmpMulti;
  shell.__cmpPick = () => cmpMulti("");
  shell.__cumPick = () => cmpMulti("");   /* v771 : CUMUL du menu ⋯ = la même fenêtre de SÉLECTION */   /* v757 : le COMPARATIF à deux passe par COMPARER (COMPARER EN DÉTAIL quand deux éléments sont cochés) */
  shell.__cmpOpen = cmpOpen;
}
