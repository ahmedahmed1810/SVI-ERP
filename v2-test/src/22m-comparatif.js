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
    shell.__cmpPick = cmpPick;
    shell.__cmpOpen = cmpOpen;
