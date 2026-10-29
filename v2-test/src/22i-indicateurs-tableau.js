    /* =========================================================
       v692 : ONGLET INDICATEURS (l'onglet MARGE devient INDICATEURS — décisions du 29/10/2026, soir)
       - Indicateurs PROPRES AU BUDGET (INS.rat.L), formule libre (briques : charges / produits en quantité ou montant,
         mesures du programme dont la durée, autres indicateurs ; nombres ; + − × ÷ ; parenthèses). Formule toujours acceptée :
         donnée manquante ou division par zéro = case vide avec message gris.
       - Indicateurs d'office (Ⓐ) : MARGE, CHARGES, PRODUITS, MAIN D'ŒUVRE.
       - Tableau de bord en CARREAUX (INS.rat.T) au-dessus du tableau par liaison (une valeur par ligne et un total) ;
         + ajoute un carreau ; défilement horizontal ; chaque carreau s'agrandit : indicateurs choisis ou créés,
         TABLEAU (du premier au dernier jour, copiable) ↔ GRAPHIQUE (dates en abscisse, deux unités au plus : axe gauche,
         axe droit ; une 3e unité grisée), pas JOUR / SEMAINE / MOIS, UNITAIRE / CUMULÉ, seuils horizontaux (valeurs)
         et verticaux (AUJOURD'HUI, une date).
       ========================================================= */
    const IBD_AUTO = [["mg", "MARGE", "b:mg"], ["chg", "CHARGES", "b:chg"], ["prd", "PRODUITS", "b:prd"], ["mo", "MAIN D'ŒUVRE", "b:mo"]];
    /* indicateurs du budget + indicateurs d'office (enregistrés seulement si le budget est modifiable) */
    const ibdR = () => {
      const R = ratMigrate(JSON.parse(JSON.stringify(INS.rat || {})));
      R.L = R.L || []; R.T = Array.isArray(R.T) ? R.T : [];
      let add = false;
      IBD_AUTO.forEach(([code, nom, k]) => { if (!R.L.some(I => I.auto === code)) { R.L.unshift({ id: "auto_" + code, auto: code, nom, f: [{ t: "e", k }], mode: "q", fmt: "n", dec: 2, u: k === "b:mo" || k === "b:mg" || k === "b:chg" || k === "b:prd" ? "DH" : "", seuil: "" }); add = true; } });
      if (!R.T.length) { R.T.push({ id: "t_" + insId(), nom: "MARGE", y: ["auto_mg", "auto_chg", "auto_prd"], step: "s", cum: true, view: "g", hs: [], vs: ["today"] }); add = true; }
      if (add && INS_EDIT) { INS.rat = JSON.parse(JSON.stringify(R)); insSave(); }
      return R;
    };
    const ibdSave = (R, what, det) => { if (!INS_EDIT) return; INS.rat = JSON.parse(JSON.stringify(R)); insSave(); if (what) histLog("INDICATEURS", what, det || ""); };
    const ibdA = I => I.auto ? ' <span class="auto-a" title="Créé automatiquement">Ⓐ</span>' : "";
    /* unité d'un indicateur (pour les axes) */
    const ibdUnit = (I, E) => {
      if (I.fmt === "p") return "%";
      if (I.u) return U_(I.u);
      const t = (I.f || []).find(x => x.t === "e"), x = t && (E || []).find(y => y.k === t.k);
      return x ? (I.mode === "m" && x.m !== null && x.m !== undefined ? "DH" : U_(x.u || "")) : "";
    };
    /* pas des abscisses : du premier au dernier jour du planning */
    const ibdSteps = (D, step) => {
      const all = []; Object.values(D.dlp || {}).forEach(L => (L || []).forEach(p => { if (p.deb) all.push(p.deb, p.fin || p.deb); }));
      if (!all.length) return [];
      all.sort();
      if (step === "j") { const out = [], a = all[0], b = all[all.length - 1]; for (let d = new Date(a + "T12:00:00"); sviIsoOf(d) <= b && out.length < 1500; d.setDate(d.getDate() + 1)) { const s = sviIsoOf(d); out.push({ a: s, b: s, lab: dFr(s) }); } return out; }
      return ratPeriods(D, step === "m" ? "m" : "w").map(p => ({ ...p, lab: step === "m" ? p.lab : dFr(p.a) }));
    };
    /* valeurs d'un indicateur par pas : unitaire (part de chaque pas) ou cumulé (du premier jour à la fin du pas) */
    const ibdSeries = (I, D, P, cum) => P.map(p => { const r = indCalc(I, ratPerSub(D, cum ? P[0].a : p.a, p.b)); return r.val === undefined || r.val === null ? null : (I.fmt === "p" ? r.val * 100 : r.val); });
    const ibdFx = (v, dec) => v === null || v === undefined ? "" : indNum(v, dec === undefined ? 2 : dec);

    /* ---------- bandeau des carreaux (dans l'onglet INDICATEURS) ---------- */
    const ibdBoardHTML = () => {
      if (!INS) return "";
      const R = ibdR(), E = indEls(INS), ed = INS_EDIT;
      const tile = T => {
        const Y = T.y.map(id => R.L.find(I => I.id === id)).filter(Boolean);
        return `<div class="ibd-tile" data-tile="${esc(T.id)}">
          <div class="ibd-th"><b>${esc(T.nom)}</b><span class="ibd-tools"><button type="button" class="ibd-b" data-tmax="${esc(T.id)}" title="Agrandir">⤢</button>${ed ? `<button type="button" class="ibd-b" data-tdel="${esc(T.id)}" title="Supprimer le carreau">✕</button>` : ""}</span></div>
          <div class="ibd-list">${Y.map(I => { const c = indCalc(I, INS, E); return `<div class="ibd-it" data-tind="${esc(T.id)}|${esc(I.id)}"><span>${esc(I.nom)}${ibdA(I)}</span><b class="${c.soft || c.err ? "ibd-soft" : ""}">${esc(c.txt)}</b></div>`; }).join("") || `<div class="ibd-empty">AUCUN INDICATEUR — AGRANDIR POUR EN CHOISIR</div>`}</div>
        </div>`;
      };
      return `<div class="ibd-board">${R.T.map(tile).join("")}${ed ? `<button type="button" class="ibd-add" data-tadd title="Ajouter un carreau">+</button>` : ""}</div>`;
    };

    /* ---------- carreau agrandi ---------- */
    const ibdTileWin = (tid, focusId) => {
      const R = ibdR(), T = R.T.find(x => x.id === tid); if (!T) return;
      const ed = INS_EDIT, D = INS, E = indEls(D);
      let view = T.view === "t" ? "t" : "g";
      const d = sviWinNew();
      const reopen = () => ibdTileWin(tid);
      const STORE = { list: () => R.L, save: L => { R.L = L; R.T.forEach(t => { t.y = t.y.filter(id => L.some(I => I.id === id)); }); ibdSave(R); }, br: "INDICATEURS" };
      const draw = () => {
        const Y = T.y.map(id => R.L.find(I => I.id === id)).filter(Boolean);
        const P = ibdSteps(D, T.step || "s");
        /* deux unités au plus : la 1re (axe gauche), la 2e (axe droit) ; les autres grisées */
        const units = []; Y.forEach(I => { const u = ibdUnit(I, E); if (!units.includes(u)) units.push(u); });
        const okU = units.slice(0, 2), shownY = Y.filter(I => okU.includes(ibdUnit(I, E)));
        const SER = shownY.map(I => ({ I, u: ibdUnit(I, E), v: ibdSeries(I, D, P, !!T.cum) }));
        const chips = R.L.map(I => { const on = T.y.includes(I.id), u = ibdUnit(I, E), off = !on && units.length >= 2 && !units.includes(u);
          return `<button type="button" class="ibd-chip${on ? " on" : ""}${off ? " off" : ""}" data-ytog="${esc(I.id)}"${off ? ` data-why="3E UNITÉ (${esc(u || "SANS UNITÉ")}) : DEUX UNITÉS AU PLUS SUR UN GRAPHIQUE (${esc(units.join(" / "))})."` : ""}>${esc(I.nom)}${ibdA(I)} <small>${esc(u || "—")}</small></button>`; }).join("");
        const table = () => `<div class="ibd-tscroll"><table class="bdg-d-table ibd-table"><thead><tr><th>${T.step === "j" ? "JOUR" : T.step === "m" ? "MOIS" : "SEMAINE"}</th>${SER.map(s => `<th class="number">${esc(s.I.nom)}${s.u ? " (" + esc(s.u) + ")" : ""}</th>`).join("")}</tr></thead>
          <tbody>${P.map((p, i) => `<tr><td>${esc(p.lab)}</td>${SER.map(s => `<td class="number">${ibdFx(s.v[i], s.I.dec)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${SER.length + 1}" class="empty">AUCUNE DATE AU PLANNING</td></tr>`}</tbody></table></div>`;
        d.innerHTML = sviWinCard({ cls: "cmp-card svc-full ibd-card", close: "data-x", title: "INDICATEURS — " + esc(T.nom),
          body: `<div class="ibd-bar">
              ${ed ? `<input class="pv-in ibd-nom" value="${esc(T.nom)}" title="Nom du carreau">` : ""}
              <span class="ibd-seg">${[["j", "JOUR"], ["s", "SEMAINE"], ["m", "MOIS"]].map(([v, l]) => `<button type="button" class="svc-b${(T.step || "s") === v ? " on" : ""}" data-step="${v}">${l}</button>`).join("")}</span>
              <span class="ibd-seg">${[[false, "UNITAIRE"], [true, "CUMULÉ"]].map(([v, l]) => `<button type="button" class="svc-b${!!T.cum === v ? " on" : ""}" data-cum="${v ? 1 : 0}">${l}</button>`).join("")}</span>
              <button type="button" class="svc-b ibd-view" data-view title="${view === "g" ? "Voir le tableau" : "Voir le graphique"}">${view === "g" ? "▦ TABLEAU" : "📈 GRAPHIQUE"}</button>
              ${view === "t" ? `<button type="button" class="svc-b" data-copy>COPIER</button>` : ""}
            </div>
            <div class="ibd-chips">${chips}${ed ? `<button type="button" class="ibd-chip ibd-new" data-ynew>+ NOUVEL INDICATEUR</button>` : ""}</div>
            ${view === "g" ? `<div class="ibd-seuils">
              <span>SEUILS :</span>${(T.hs || []).map((h, i) => `<span class="ibd-s">─ ${esc(ibdFx(h.v))} ${esc(h.u || okU[0] || "")}${ed ? ` <button type="button" class="cmp-del" data-hsdel="${i}">✕</button>` : ""}</span>`).join("")}
              ${(T.vs || []).map((v, i) => `<span class="ibd-s">│ ${v === "today" ? "AUJOURD'HUI" : esc(dFr(v))}${ed ? ` <button type="button" class="cmp-del" data-vsdel="${i}">✕</button>` : ""}</span>`).join("")}
              ${ed ? `<input class="pv-in ibd-hv" inputmode="decimal" placeholder="VALEUR (MAXIMUM…)" style="width:150px"><button type="button" class="svc-b" data-hsadd>+ HORIZONTAL</button>
                <input class="pv-in ibd-vd" type="date" style="width:150px"><button type="button" class="svc-b" data-vsadd>+ VERTICAL</button>${(T.vs || []).includes("today") ? "" : `<button type="button" class="svc-b" data-vstoday>+ AUJOURD'HUI</button>`}` : ""}
            </div>` : ""}
            <div class="ibd-main">${!SER.length ? `<div class="fz-none">CHOISIR DES INDICATEURS CI-DESSUS</div>` : view === "t" ? table() : ibdChart(SER, P, T, okU)}</div>`,
          foot: `<button type="button" class="svc-b svc-ok svc-neutral" data-x>FERMER</button>` });
        d.__tsv = () => [[T.step === "j" ? "JOUR" : T.step === "m" ? "MOIS" : "SEMAINE", ...SER.map(s => s.I.nom + (s.u ? " (" + s.u + ")" : ""))].join("\t"), ...P.map((p, i) => [p.lab, ...SER.map(s => ibdFx(s.v[i], s.I.dec))].join("\t"))].join("\n");
        if (focusId) { const c = d.querySelector(`[data-ytog="${CSS.escape(focusId)}"]`); if (c) c.classList.add("focus"); focusId = ""; }
      };
      const put = (what, det) => { ibdSave(R, what, det); };
      draw(); sviWinShow(d);
      d.addEventListener("change", e => { if (e.target.classList.contains("ibd-nom")) { T.nom = U_(e.target.value) || T.nom; put("CARREAU RENOMMÉ", T.nom); draw(); } });
      d.addEventListener("click", async e => {
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); refreshAll(); return; }
        const st = e.target.closest("[data-step]"); if (st) { T.step = st.dataset.step; put(); draw(); return; }
        const cu = e.target.closest("[data-cum]"); if (cu) { T.cum = cu.dataset.cum === "1"; put(); draw(); return; }
        if (e.target.closest("[data-view]")) { view = view === "g" ? "t" : "g"; T.view = view; put(); draw(); return; }
        if (e.target.closest("[data-copy]")) { try { await navigator.clipboard.writeText(d.__tsv()); svToast("TABLEAU COPIÉ.", 2000); } catch (er) { svToast("COPIE IMPOSSIBLE SUR CET APPAREIL.", 3000); } return; }
        const yt = e.target.closest("[data-ytog]");
        if (yt) {
          if (yt.classList.contains("off")) { svToast(yt.dataset.why || "TROISIÈME UNITÉ.", 4000, yt); return; }
          if (!ed) return;
          const id = yt.dataset.ytog; T.y = T.y.includes(id) ? T.y.filter(x => x !== id) : T.y.concat(id); put(); draw(); return;
        }
        if (e.target.closest("[data-ynew]")) { d.remove(); indDesignWin(null, I => { if (I) { const R2 = ibdR(), T2 = R2.T.find(x => x.id === tid); if (T2 && !T2.y.includes(I.id)) { T2.y.push(I.id); ibdSave(R2, "INDICATEUR AJOUTÉ", I.nom); } } reopen(); }, STORE); return; }
        if (e.target.closest("[data-hsadd]")) { const v = Number(String(d.querySelector(".ibd-hv").value || "").replace(/\s/g, "").replace(",", ".")); if (!Number.isFinite(v) || d.querySelector(".ibd-hv").value.trim() === "") { svToast("VALEUR DU SEUIL À SAISIR.", 2500); return; } T.hs = (T.hs || []).concat({ v }); put("SEUIL AJOUTÉ", String(v)); draw(); return; }
        if (e.target.closest("[data-vsadd]")) { const v = d.querySelector(".ibd-vd").value; if (!v) { svToast("DATE DU SEUIL À CHOISIR.", 2500); return; } T.vs = (T.vs || []).concat(v); put("SEUIL AJOUTÉ", v); draw(); return; }
        if (e.target.closest("[data-vstoday]")) { T.vs = (T.vs || []).concat("today"); put(); draw(); return; }
        const hd = e.target.closest("[data-hsdel]"); if (hd) { T.hs.splice(+hd.dataset.hsdel, 1); put(); draw(); return; }
        const vd = e.target.closest("[data-vsdel]"); if (vd) { T.vs.splice(+vd.dataset.vsdel, 1); put(); draw(); return; }
      });
      /* appui long sur un indicateur grisé : la raison */
      let lt = 0;
      d.addEventListener("pointerdown", e => { const c = e.target.closest(".ibd-chip.off"); clearTimeout(lt); if (c) lt = setTimeout(() => svToast(c.dataset.why || "", 4000, c), 500); });
      ["pointerup", "pointercancel"].forEach(ev => d.addEventListener(ev, () => clearTimeout(lt)));
    };

    /* ---------- graphique : dates en abscisse, deux axes, légende, seuils ---------- */
    const ibdChart = (SER, P, T, U) => {
      if (!P.length) return `<div class="fz-none">AUCUNE DATE AU PLANNING : PAS DE GRAPHIQUE DANS LE TEMPS</div>`;
      const H = 300, pl = 64, pr = U.length > 1 ? 64 : 16, pb = 40, pt = 14, n = P.length, W = Math.max(760, pl + pr + n * (n > 120 ? 6 : 18));
      const ax = U.map(u => { const v = SER.filter(s => s.u === u).flatMap(s => s.v).filter(x => x !== null).concat(u === U[0] ? (T.hs || []).map(h => h.v) : []); const mx = Math.max(0, ...v), mn = Math.min(0, ...v); return { u, mx, mn, span: (mx - mn) || 1 }; });
      const y = (a, v) => pt + (a.mx - v) / a.span * (H - pb - pt);
      const cw = (W - pl - pr) / n, x = i => pl + cw * i + cw / 2;
      const A0 = ax[0], A1 = ax[1];
      const grid = [0, .25, .5, .75, 1].map(t => { const v = A0.mn + A0.span * t; return `<line x1="${pl}" x2="${W - pr}" y1="${y(A0, v)}" y2="${y(A0, v)}" stroke="#eaecf0"/><text x="${pl - 4}" y="${y(A0, v) + 4}" text-anchor="end" class="rat-ax">${esc(ibdFx(v, 0))}</text>` + (A1 ? `<text x="${W - pr + 4}" y="${y(A1, A1.mn + A1.span * t) + 4}" class="rat-ax">${esc(ibdFx(A1.mn + A1.span * t, 0))}</text>` : ""); }).join("");
      const every = Math.max(1, Math.ceil(n / 24));
      const xl = P.map((p, i) => i % every ? "" : `<text x="${x(i)}" y="${H - 16}" text-anchor="middle" class="rat-ax">${esc(String(p.lab).slice(0, 10))}</text>`).join("");
      const lines = SER.map((s, j) => { const a = ax[U.indexOf(s.u)], c = RAT_C[j % RAT_C.length]; const pts = s.v.map((v, i) => v === null ? null : [x(i), y(a, v)]).filter(Boolean);
        return `<polyline points="${pts.map(p => p.join(",")).join(" ")}" fill="none" stroke="${c}" stroke-width="2.4"${U.indexOf(s.u) === 1 ? ' stroke-dasharray="6 3"' : ""}/>` + (n <= 60 ? pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="2.6" fill="${c}"/>`).join("") : ""); }).join("");
      const hs = (T.hs || []).map(h => `<line x1="${pl}" x2="${W - pr}" y1="${y(A0, h.v)}" y2="${y(A0, h.v)}" stroke="#f04438" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${W - pr - 4}" y="${y(A0, h.v) - 4}" text-anchor="end" class="rat-ax" fill="#f04438">${esc(ibdFx(h.v, 0))}</text>`).join("");
      const today = sviIsoOf(new Date());
      const vs = (T.vs || []).map(v => { const dd = v === "today" ? today : v; const i = P.findIndex(p => p.a <= dd && dd <= p.b); if (i < 0) return ""; return `<line x1="${x(i)}" x2="${x(i)}" y1="${pt}" y2="${H - pb}" stroke="#7a5af8" stroke-width="1.5" stroke-dasharray="4 3"/><text x="${x(i) + 3}" y="${pt + 10}" class="rat-ax" fill="#7a5af8">${v === "today" ? "AUJOURD'HUI" : esc(dFr(v))}</text>`; }).join("");
      const zero = A0.mn < 0 ? `<line x1="${pl}" x2="${W - pr}" y1="${y(A0, 0)}" y2="${y(A0, 0)}" stroke="#98a2b3"/>` : "";
      const leg = `<div class="rat-leg">${SER.map((s, j) => `<span><i style="background:${RAT_C[j % RAT_C.length]}"></i>${esc(s.I.nom)} <small>(${esc(s.u || "—")}${U.length > 1 ? (U.indexOf(s.u) ? ", AXE DROIT" : ", AXE GAUCHE") : ""})</small></span>`).join("")}</div>`;
      return leg + `<div class="rat-gx"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="rat-svg">
        <text x="${pl}" y="10" class="rat-ax">${esc(A0.u || "")}</text>${A1 ? `<text x="${W - pr}" y="10" text-anchor="end" class="rat-ax">${esc(A1.u || "")}</text>` : ""}
        ${grid}${zero}${hs}${vs}${lines}${xl}</svg></div>`;
    };

    /* ---------- gestes du bandeau ---------- */
    shell.__ibdHTML = () => { try { return ibdBoardHTML(); } catch (e) { return ""; } };
    if (!shell.__ibdOn) { shell.__ibdOn = true; shell.addEventListener("click", e => { if (shell.__ibdClick) shell.__ibdClick(e); }, true); }
    shell.__ibdClick = async e => {
      const bd = e.target.closest(".ibd-board"); if (!bd) return;
      const mx = e.target.closest("[data-tmax]"); if (mx) { e.stopPropagation(); ibdTileWin(mx.dataset.tmax); return; }
      const it = e.target.closest("[data-tind]"); if (it) { e.stopPropagation(); const [t, i] = it.dataset.tind.split("|"); ibdTileWin(t, i); return; }
      const tile = e.target.closest("[data-tile]");
      const dl = e.target.closest("[data-tdel]");
      if (dl) { e.stopPropagation(); const R = ibdR(), T = R.T.find(x => x.id === dl.dataset.tdel); if (!T) return; if (!(await svConfirm({ title: "SUPPRIMER LE CARREAU", text: T.nom, ok: "SUPPRIMER" }))) return; R.T = R.T.filter(x => x !== T); ibdSave(R, "CARREAU SUPPRIMÉ", T.nom); refreshAll(); return; }
      if (e.target.closest("[data-tadd]")) { e.stopPropagation(); const R = ibdR(), T = { id: "t_" + insId(), nom: "CARREAU " + (R.T.length + 1), y: [], step: "s", cum: false, view: "g", hs: [], vs: [] }; R.T.push(T); ibdSave(R, "CARREAU AJOUTÉ", T.nom); ibdTileWin(T.id); return; }
      if (tile) { e.stopPropagation(); ibdTileWin(tile.dataset.tile); }
    };
