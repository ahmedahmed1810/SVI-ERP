/* =========================================================
   v874 : DÉCOUPE DU GRAND BLOC (programme, point 4) — DÉLAIS ET DISPOSITION sort de openBudgetDetail.
   Appelé depuis l'écran du budget (19-delais-disposition.js) avec ce dont il a besoin ; recTabApply, histLog, colSelToggle (déclaré plus loin dans l'écran du budget) est lu au moment de l'appel.
   ========================================================= */
function sviBdgDelaisDisposition(C) {
  const { CF, ECR, INS, INS_EDIT, body, byKindNow, cfApply, cfHead, dlyCfgPaint, insRenderTab, lines, refreshAll, roLoad, roSave, selRows, shell, table, tabs } = C;
  const recTabApply = (...a) => C.recTabApply()(...a);
  const histLog = (...a) => C.histLog()(...a);
  const colSelToggle = (...a) => C.colSelToggle()(...a);
  /* ===== DÉTAIL DÉLAIS : colonnes (tri / filtre, largeur et ordre réglables) ===== */
  /* une ligne par période d'une TÂCHE PRIMAIRE (lot + activité primaire) */
  const DLY_COLS = [
    ["lot", "LOT", x => x.lot || "", ""],
    ["prim", "ACTIVITÉ PRIMAIRE", x => x.prim || "", ""],
    ["deb", "DÉBUT", x => x.deb || "", "center"],
    ["fin", "FIN", x => x.fin || "", "center"],
    ["dur", "DURÉE (J)", x => x.dur === "" || x.dur === undefined ? "" : Number(x.dur), "number"]
  ];
  const DLY_W = { lot: 160, prim: 280, sec: 170, pred: 180, succ: 180, per: 120, deb: 90, fin: 90, dur: 80, marge: 70, jal: 62 };
  /* budget en instance / figé : une ligne par période d'une TÂCHE SECONDAIRE (lot + activité secondaire) */
  ECR.DLY_COLS_S = [DLY_COLS[0], ["sec", "ACTIVITÉ SECONDAIRE", x => x.sec || "", ""], ...DLY_COLS.slice(2)];
  /* planning : lot, activité secondaire, prédécesseurs, début, fin, durée */
  ECR.DLY_COLS_P = [DLY_COLS[0], ["sec", "ACTIVITÉ SECONDAIRE", x => x.sec || "", ""], ["pred", "PRÉDÉCESSEURS", x => x.pred || "", ""], ["succ", "SUCCESSEURS", x => x.succ || "", ""],
    ["deb", "DÉBUT", x => x.deb || "", "center"], ["fin", "FIN", x => x.fin || "", "center"], ["dur", "DURÉE (J)", x => x.dur === "" || x.dur === undefined ? "" : Number(x.dur), "center"],
    ["marge", "BATTEMENT", x => x.mshow === "" || x.mshow === undefined ? "" : Number(x.mshow), "center"], ["jal", "JALON", x => x.jal || "", "center"]];
  /* cells(x) → { cle: html } ; la ligne garde ses attributs (data-sec en saisie) */
  /* del : mode modifiable (case au début de chaque période, 🗑 à la fin, case et 🗑 en tête) */
  /* v748 : opt.cut = { first, max } — au-delà de max lignes, seules les first premières sont mises dans le tableau ; le HTML des autres est rendu dans opt.rest */
  const dlyTable = (rows, cells, trAttr = () => "", del = false, base = DLY_COLS, opt = null) => {
    const tk = base === DLY_COLS ? "dly" : base === ECR.DLY_COLS_S ? "dlys" : "dlyp";
    const cols = coOrder(tk, base);
    const w = k => cwLoad()["dly." + k] || DLY_W[k];
    /* FORMAT : case à droite de chaque ligne (cocher seulement) ; suppression par le menu ⋯ */
    return `<table class="bdg-d-table dly-table" style="width:${cols.reduce((t, c) => t + w(c[0]), 0) + (del ? 44 : 0)}px">
      <colgroup>${cols.map(c => `<col data-w="dly.${c[0]}" style="width:${w(c[0])}px">`).join("")}${del ? '<col style="width:44px">' : ""}</colgroup>
      <thead><tr>${cols.map(c => cfHead(tk, c[0], c[1], c[3])).join("")}${del ? `<th class="center"><input type="checkbox" class="${tk === "dlyp" ? "dlyp-cball" : "dlp-cball"}" title="Tout cocher"></th>` : ""}</tr></thead>
      <tbody>${(() => { const H = rows.map(x => { const h = cells(x); return `<tr ${trAttr(x)}>${cols.map(c => `<td class="${c[3]}${h["__td_" + c[0]] || ""}">${h[c[0]] ?? ""}</td>`).join("")}${del ? `<td class="center ins-cbc">${h.__cb || ""}</td>` : ""}</tr>`; });
        if (opt && opt.cut && H.length > opt.cut.max) { opt.rest = H.slice(opt.cut.first); return H.slice(0, opt.cut.first).join(""); }
        return H.join(""); })()
        || ""}</tbody></table>`;
  };
  /* v546 (R33) : bouton ↻ AJUSTER À LA CAPACITÉ, seulement sur DÉTAIL DÉLAIS ; grisé quand il n'y a rien à ajuster */
  const dlyAdjPaint = () => {
    /* v553 (partie 11, remarque 4) : ⚙ visible sur DÉTAIL DÉLAIS quand le planning a un graphique */
    dlyCfgPaint();
    const b = shell.querySelector(".blk-adj-btn"); if (!b) return;
    const on = ECR.active === "dly" && INS_EDIT && !!shell.__insDly;
    b.classList.toggle("dly-on", on);
    if (!on) return;
    /* v570 : ↻ = fenêtre GÉNÉRER / COMPRESSER, active dès qu'il y a des tâches */
    let c = { ok: false, why: "" }; try { c = shell.__insDly.keys().length ? { ok: true } : { ok: false, why: "AUCUNE TÂCHE AU PLANNING." }; } catch (e) {}
    b.classList.toggle("off", !c.ok); if (c.ok) delete b.dataset.why; else b.dataset.why = c.why;
  };
  const renderTab = () => { sviStep("ONGLET : " + ECR.active); renderTab0(); sviStep("ONGLET DESSINÉ : " + ECR.active); sviMarkEmptyTabs(shell); try { dlyAdjPaint(); } catch (e) {} try { requestAnimationFrame(() => { try { layDetFloor(); } catch (e) {} }); } catch (e) {} };
  const renderTab0 = () => {
    shell
      .querySelectorAll("#bdgTabs .bdg-d-tab")
      .forEach(b =>
        b.classList.toggle(
          "active",
          b.dataset.tab === ECR.active
        )
      );

    /* compteurs des onglets DÉTAIL CHARGES / PRODUITS (filtres compris) */
    ["chg", "prd"].forEach(k => {
      const b = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="${k}"]`);
      if (!b) return;
      const gl = groupLines(byKindNow()[k]);
      const n = cfApply(k, tcolsFor(k === "prd"), gl).length;
      const t = tabs.find(x => x.key === k);
      b.innerHTML = (SVI_ICON[k] || "") + t.title + " " + svCnt(n, gl.length);
    });

    if (INS) { insRenderTab(); return; }
    { const q = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="qlt"]`);
      if (q) q.innerHTML = (SVI_ICON.qlt || "") + "DÉTAIL QUALITÉ " + svCnt(0);
      const d = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="dly"]`);
      if (d) d.innerHTML = (SVI_ICON.dly || "") + "DÉTAIL DÉLAIS " + svCnt(new Set(lines.filter(l => String(l.lot || "").trim() || String(l.prim || "").trim()).map(l => String(l.lot || "").trim() + "|" + String(l.prim || "").trim())).size); }
    if (ECR.active === "chg" || ECR.active === "prd") {
      const prd = ECR.active === "prd";
      const tcols = tcolsFor(prd);
      const all = byKindNow()[ECR.active];
      const byDesig = groupLines(all).sort((x, y) =>
        String(x.detail).localeCompare(String(y.detail), "fr", { numeric: true })
      );
      const list = cfApply(ECR.active, tcols, byDesig).sort((x, y) =>
        selRows.has(y.gid) - selRows.has(x.gid)
      );
      ECR.lastShown.detail = { cols: tcols, rows: list, kind: ECR.active };
      const shownG = new Set(list.map(g => g.gid));
      const raw = all.filter(l => shownG.has(l.gid));
      const cols = prd ? 12 : 8;

      const rowsHTML =
        list.map(l => `
          <tr data-row="${esc(l.gid)}"
              class="${selRows.has(l.gid) ? "selected" : ""}">
            <td class="center">${esc(l.article)}</td>
            <td>${esc(l.detail)}</td>
            <td class="center">${esc(l.unit)}</td>
            ${
              prd
                ? `
                  <td class="number">${esc(l.nbr)}</td>
                  ${[0, 1, 2].map(i => `
                    <td class="number">${esc(l.dims[i])}</td>`).join("")}
                `
                : ""
            }
            <td class="number">${money(l.qty)}</td>
            <td class="number">${money(l.price)}</td>
            <td class="number">${money(l.amount)}</td>
            <td class="number">
              <input
                type="text"
                inputmode="decimal"
                class="bdg-tva-input"
                data-line="${esc(l.gid)}"
                value="${l.tva === "" ? "" : money(l.tva) + " %"}"
              >
            </td>
            <td class="number" data-ttc="${esc(l.gid)}">
              ${money(l.amount + l.tvaAmt)}
            </td>
          </tr>
        `).join("");

      body.innerHTML = `
        <div class="bdg-d-scroll">
          <table class="bdg-d-table" style="width:${cwTableW(ECR.active, tcols)}px">
            <colgroup>${cwCols(ECR.active, tcols)}</colgroup>
            <thead>
              <tr>${tcols.map(([k, lab, , cls]) => cfHead(ECR.active, k, lab, cls)).join("")}</tr>
            </thead>
            <tbody>
              ${
                rowsHTML ||
                `<tr><td colspan="${cols}" class="empty">
                  ${prd ? "AUCUN PRODUIT" : "AUCUNE CHARGE"}
                </td></tr>`
              }
              ${
                /* lignes vides : le cadre garde sa hauteur même filtré */
                `<tr class="bdg-d-filler">${"<td>&nbsp;</td>".repeat(cols)}</tr>`
                  .repeat(0)
              }
            </tbody>
            <tfoot>${tabFootHTML(raw, prd)}</tfoot>
          </table>
        </div>
      `;
      coApply(ECR.active, body.querySelector("table"));

      return;
    }

    if (ECR.active === "qlt") {
      /* DÉTAIL QUALITÉ : une seule colonne (contenu à venir) */
      body.innerHTML = `<div class="bdg-d-scroll"><table class="bdg-d-table"><thead><tr><th>QUALITÉ</th></tr></thead>
        <tbody><tr><td class="empty">AUCUNE LIGNE</td></tr></tbody></table></div>`;

      return;
    }

    /* DÉTAIL DÉLAIS : une ligne par activité secondaire (lots, début, durée, fin, arrêts) */
    {
      const fr = iso => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "";
      /* une ligne par TÂCHE PRIMAIRE (lot + activité primaire) : du premier début à la dernière fin */
      const m = new Map();
      lines.forEach(l => {
        const lot = String(l.lot || "").trim(), prim = String(l.prim || "").trim();
        if (!lot && !prim) return;
        const k = lot + "|" + prim;
        if (!m.has(k)) m.set(k, { lot, prim, per: 1, deb: "", fin: "" });
        const x = m.get(k);
        if (l.deb && (!x.deb || l.deb < x.deb)) x.deb = l.deb;
        if (l.fin && (!x.fin || l.fin > x.fin)) x.fin = l.fin;
      });
      const dur = x => x.deb && x.fin ? Math.round((new Date(x.fin) - new Date(x.deb)) / 86400000) + 1 : "";   /* FORMAT 139 */
      /* ordre par défaut : chronologique (début), puis alphabétique */
      const all = [...m.values()].map(x => ({ ...x, dur: dur(x) }))
        .sort((a, b) => String(a.deb || "9").localeCompare(String(b.deb || "9")) || a.lot.localeCompare(b.lot, "fr") || a.prim.localeCompare(b.prim, "fr"));
      const rows = cfApply("dly", DLY_COLS, all);
      { const b = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="dly"]`);
        if (b) b.innerHTML = (SVI_ICON.dly || "") + "DÉTAIL DÉLAIS " + svCnt(rows.length); }
      ECR.lastShown.detail = { cols: DLY_COLS, rows, kind: "dly" };
      body.innerHTML = `<div class="bdg-d-scroll">${dlyTable(rows, x => DLY_COLS.map(c => c[0])
        .reduce((o, k) => (o[k] = k === "deb" || k === "fin" ? fr(x[k]) : esc(x[k] ?? ""), o), {}))}</div>`;
      return;
    }
  };

  const LAY_UNITS = ["client", "hier", "detail", "etp", "suivi"];   /* v756 : SCÉNARIOS, VERSIONS, RECALAGES (et AVENANTS) = un seul bloc à onglets */   /* v685 : bloc SCÉNARIOS entre le détail et le suivi */
  const page$ = () => shell.querySelector(".bdg-d-page");
  const layEls = u => {
    const pg = page$();
    if (u === "detail") return [$("bdgDetailHead"), $("bdgTabs"), $("bdgTabBody"), $("bdgDetailRsz")].filter(Boolean);
    const sel = { client: ".blk-client", hier: ".blk-hier", etp: ".blk-etp", suivi: ".blk-suivi" }[u];
    return [pg.querySelector(":scope > " + sel)].filter(Boolean);
  };
  const layMeasure = u => {
    const sel = {
      client: ".bdg-d-client-scroll", hier: ".bdg-h-col",
      detail: "#bdgTabBody .bdg-d-scroll",
      suivi: ".blk-suivi .rec-scroll:not([hidden])", etp: ".blk-etp .etp-pane.on .rec-scroll"
    }[u];
    const el = page$().querySelector(sel);
    return el ? el.getBoundingClientRect().height : 150;
  };
  /* v683 : minimum du bloc détail, mesuré sur l'onglet ouvert — en-tête des colonnes + une ligne entière (+ ligne TOTAL),
     aucune ligne coupée (même format que TÂCHES) ; bandeaux posés au-dessus et barre de défilement compris */
  const layDetMin = () => {
    const scr = page$() && page$().querySelector("#bdgTabBody .bdg-d-scroll");
    if (!scr || !scr.offsetHeight) return 65;
    const tb = [...scr.querySelectorAll("table")].find(t => t.offsetHeight && t.tHead);
    if (!tb) return 65;
    const sr = scr.getBoundingClientRect();
    const top = tb.getBoundingClientRect().top - sr.top + scr.scrollTop;
    const head = tb.tHead.getBoundingClientRect().height;
    const rows = [...tb.tBodies].flatMap(b => [...b.rows]).filter(r => r.offsetHeight);
    const tot = rows.filter(r => r.classList.length && /tot/i.test(r.className) && /\bTOTAL\b/.test(r.textContent || ""));   /* v743 : classe d'abord (rapide), texte ensuite */
    /* v787 : la ligne « CRÉER … ICI » est fixée en bas — mode réduit = UNE ligne de données entière + la ligne CRÉER */
    /* v925 (remarque 5) : mode réduit = r lignes entières (réglage des blocs, 1 par défaut) + CRÉER (+ TOTAL) */
    const nrw = rows.find(r => !tot.includes(r) && r.matches("tr.ins-new")), dats = rows.filter(r => !tot.includes(r) && r !== nrw).slice(0, sviBlkRows().r);
    const row = { getBoundingClientRect: () => ({ height: dats.reduce((s, d) => s + d.getBoundingClientRect().height, 0) + (nrw ? nrw.getBoundingClientRect().height : 0) || 21 }) };
    const foot = (tb.tFoot && tb.tFoot.offsetHeight ? tb.tFoot.getBoundingClientRect().height : 0) + tot.reduce((t, r) => t + r.getBoundingClientRect().height, 0);
    let ban = 0; scr.parentElement && scr.parentElement.querySelectorAll(":scope > .dly-iso").forEach(b => { ban += b.offsetHeight; });
    const bar = Math.max(0, scr.offsetHeight - scr.clientHeight);
    return Math.max(40, Math.ceil(top + head + (row ? row.getBoundingClientRect().height : 21) + foot + ban + bar + 1));
  };
  /* v774 : MODE RÉDUIT — un seul calcul pour tous les blocs (celui du bloc détail / DÉSIGNATIONS CLIENT) :
     décalage du tableau + titres des colonnes + UNE ligne entière (la ligne de saisie, sinon la première) + pied (TOTAL) + bandeaux + barre.
     Rien n'est collé par-dessus : à la hauteur minimale, le tableau se place sur la ligne de saisie (layMinScroll). */
  const LAY_SC = { client: ".bdg-d-client-scroll", detail: "#bdgTabBody .bdg-d-scroll", suivi: ".blk-suivi .rec-scroll:not([hidden])", etp: ".blk-etp .etp-pane.on .rec-scroll" };
  const LAY_NEW = "tr.ins-new, tr.scn-new, tr.rec-new, tr[data-scnadd], tr[data-avadd], tr[data-rcladd]";
  const layMinOf = u => {
    if (u === "detail") return layDetMin();
    const pg = page$(); if (!pg) return 0;
    /* 09/11 (remarque) : TÂCHES suit aussi le nombre de lignes du mode réduit (réglage des blocs) — colonne la plus remplie, r lignes entières + CRÉER */
    if (u === "hier") { const CS = [...pg.querySelectorAll(".bdg-h-col")].filter(x => x.offsetHeight); if (!CS.length) return 44;
      const its = c => { const nw = c.querySelector(".ins-li.ins-new"); return [...c.querySelectorAll(".ins-li, .bdg-h-item")].filter(x => x !== nw && x.offsetHeight); };
      const c = CS.reduce((a, b) => its(b).length > its(a).length ? b : a, CS[0]), hd = c.querySelector(".bdg-h-head"), nw = c.querySelector(".ins-li.ins-new"), L = its(c).slice(0, sviBlkRows().r);
      return Math.ceil((hd ? hd.getBoundingClientRect().height : 0) + (L.reduce((t, x) => t + x.getBoundingClientRect().height, 0) + (nw ? nw.getBoundingClientRect().height : 0) || 21) + Math.max(0, c.offsetHeight - c.clientHeight)) + 1; }
    const scr = pg.querySelector(LAY_SC[u]); if (!scr || !scr.offsetHeight) return { client: 65 }[u] || 44;
    const tb = [...scr.querySelectorAll("table")].find(t => t.offsetHeight && t.tHead); if (!tb) return 44;
    const top = tb.getBoundingClientRect().top - scr.getBoundingClientRect().top + scr.scrollTop;
    const rows = [...tb.tBodies].flatMap(b => [...b.rows]).filter(r => r.offsetHeight);
    const nrw = rows.find(r => r.matches(LAY_NEW)), dats = rows.filter(r => r !== nrw && !(r.classList.length && /tot/i.test(r.className))).slice(0, sviBlkRows().r);
    const foot = tb.tFoot && tb.tFoot.offsetHeight ? tb.tFoot.getBoundingClientRect().height : 0;
    return Math.ceil(top + tb.tHead.getBoundingClientRect().height + (dats.reduce((s, d) => s + d.getBoundingClientRect().height, 0) + (nrw ? nrw.getBoundingClientRect().height : 0) || 21) + foot + Math.max(0, scr.offsetHeight - scr.clientHeight)) + 1;
  };
  /* à la hauteur minimale : la seule ligne visible est la ligne de saisie, entière */
  const layMinScroll = () => { const pg = page$(); if (!pg) return;
    Object.keys(LAY_SC).forEach(u => { if (pg.classList.contains("max-" + u)) return; const scr = pg.querySelector(LAY_SC[u]); if (!scr || !scr.offsetHeight) return;
      const nr = scr.querySelector("tbody " + LAY_NEW.split(", ").join(", tbody ")); if (!nr) return;
      const m = u === "detail" ? layDetMin() : layMinOf(u); if (scr.getBoundingClientRect().height > m + 3) return;
      /* v787 : haut du tableau (première ligne entière), la ligne CRÉER reste fixée en bas ;
         v789 : sauf si une case du bloc est en saisie ou sélectionnée (la ligne créée reste visible) */
      const a = document.activeElement; if (a && a !== document.body && scr.contains(a)) return;
      scr.scrollTop = 0; }); };
  shell.__layMinScroll = layMinScroll;
  /* v774 (point 9) : DISPOSITION PAR DÉFAUT — ordre d'origine et chaque bloc à exactement 5 lignes visibles
     (titres des colonnes + 5 lignes entières + pied), enregistré : l'écran se rouvre ainsi */
  const layRowH = u => { const pg = page$(); if (!pg) return 21;
    if (u === "hier") { const li = [...pg.querySelectorAll(".bdg-h-col .ins-li, .bdg-h-col .bdg-h-item")].find(x => x.offsetHeight); return li ? li.getBoundingClientRect().height : 21; }
    const scr = pg.querySelector(LAY_SC[u]), tb = scr && [...scr.querySelectorAll("table")].find(t => t.offsetHeight && t.tHead); if (!tb) return 21;
    const rs = [...tb.tBodies].flatMap(b => [...b.rows]).filter(r => r.offsetHeight && !(r.classList.length && /tot/i.test(r.className)));
    const r = rs.find(x => !x.matches(LAY_NEW)) || rs[0]; return r ? r.getBoundingClientRect().height : 21; };
  shell.__layFive = () => {
    laySave({}); layApply();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const pg = page$(); if (!pg) return; const lay = { h: {} };
      LAY_UNITS.forEach(u => { if (pg.classList.contains("max-" + u)) return; const m = layMinOf(u); if (!m) return; lay.h[u] = Math.ceil(m + Math.max(0, sviBlkRows().n - sviBlkRows().r) * layRowH(u)); });   /* v925 : n lignes (réglage des blocs) */
      lay.def = 1; laySave(lay); layApply(); setTimeout(layMinScroll, 30);   /* 11/11 : disposition par défaut (5 lignes) */
    }));
  };
  /* v727 (bloc 11.3) : hauteur des blocs en lignes entières — en-tête (et pied collant) + k lignes entières, jamais un morceau de la suivante ;
     TÂCHES : la plus longue des trois listes ; DÉSIGNATIONS CLIENT et onglets du détail : le tableau affiché */
  const layRows = u => {
    const pg = page$(); if (!pg) return null;
    let el, head = 0, foot = 0, rows;
    if (u === "hier") {
      const cols = [...pg.querySelectorAll(".bdg-h-col")].filter(c => c.offsetHeight);
      if (!cols.length) return null;
      const R = c => [...c.querySelectorAll(".ins-li, .bdg-h-item")].filter(x => x.offsetHeight);
      el = cols.reduce((a, c) => R(c).length > R(a).length ? c : a, cols[0]);
      const h = el.querySelector(".bdg-h-head"); head = h ? h.getBoundingClientRect().height : 0;
      rows = R(el).map(x => x.getBoundingClientRect().height);
    } else {
      el = pg.querySelector(u === "client" ? ".bdg-d-client-scroll" : u === "detail" ? "#bdgTabBody .bdg-d-scroll" : "");
      if (!el || !el.offsetHeight || el.querySelector("#dlyGantt, .dly-scroll, .dlyg-l, .i1-wrap, .apr-wrap") || el.closest(".apr-wrap, .i1-wrap")) return null;   /* PLANNING et onglets à mise en page propre : inchangés */
      const tb = [...el.querySelectorAll("table")].find(t => t.offsetHeight && t.tHead); if (!tb || tb.closest(".dlyg-l, .dlyg-r")) return null;
      head = tb.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop + tb.tHead.getBoundingClientRect().height;
      foot = tb.tFoot && tb.tFoot.offsetHeight ? tb.tFoot.getBoundingClientRect().height : 0;
      rows = [...tb.tBodies].flatMap(b => [...b.rows]).filter(r => r.offsetHeight).map(r => r.getBoundingClientRect().height);
    }
    if (!rows.length) return null;
    const cur = parseFloat(pg.style.getPropertyValue("--h-" + u)) || el.offsetHeight;
    /* écart entre la valeur réglée et l'intérieur visible (bords, barre de défilement, bandeaux) */
    const fixed = cur - el.clientHeight + head + foot;
    return { fixed, rows };
  };
  /* hauteur v ramenée à des lignes entières (au moins une) ;
     plus haut que toutes les lignes : laissé tel quel (sauf « fit ») — 06/11 (soir) : la poignée est libre, même s'il reste du vide */
  const laySnap = (u, v, fit) => {
    const I = layRows(u); if (!I) return v;
    let s = I.fixed, k = 0;
    for (const h of I.rows) { if (k >= 1 && (fit ? k >= fit : s + h > v + .5)) break; s += h; k++; }
    if (!fit && k === I.rows.length && v > s) return v;   /* 06/11 (soir) : la poignée reste libre — on peut agrandir au-delà des lignes */
    return Math.ceil(s);
  };
  /* hauteur enregistrée plus petite que le minimum de l'onglet ouvert : remontée à l'affichage (non enregistrée) */
  const layDetFloor = () => {
    const pg = page$(); if (!pg || pg.classList.contains("max-detail")) return;
    const cur = parseFloat(pg.style.getPropertyValue("--h-detail")) || 0, m = layDetMin();
    if (cur && cur < m) pg.style.setProperty("--h-detail", m + "px");
    /* v727 : affichage en lignes entières (non enregistré) ; TÂCHES et DÉSIGNATIONS CLIENT sans réglage : autant de lignes qu'il y en a, jusqu'à 5 */
    const lay = layLoad();
    ["hier", "client"].forEach(u => {   /* bloc détail : mis en lignes entières à la poignée (layResize) */
      if (pg.classList.contains("max-" + u) || (u === "detail" && !cur)) return;
      const SN = shell.__layDetSnap, c0 = parseFloat(pg.style.getPropertyValue("--h-detail")) || 0;
      const h = u === "detail" ? Math.max(SN && Math.abs(SN.to - c0) < .5 ? SN.from : c0, m) : (lay.h || {})[u];
      const v = h ? laySnap(u, h) : u === "detail" ? 0 : laySnap(u, 0, 5);
      if (v) pg.style.setProperty("--h-" + u, v + "px");
      if (u === "detail" && v) shell.__layDetSnap = { from: h, to: v };   /* v727 : base gardée, pas de dérive d'un onglet à l'autre */
    });
    /* v774 : aucun bloc sous son minimum (titres + une ligne entière) ; à ce minimum, la ligne de saisie est la ligne visible */
    ["client", "hier", "etp", "suivi"].forEach(u => { if (pg.classList.contains("max-" + u)) return; const c0 = parseFloat(pg.style.getPropertyValue("--h-" + u)) || 0, m0 = layMinOf(u);
      if (c0 && m0 && c0 < m0) pg.style.setProperty("--h-" + u, m0 + "px"); });
    /* v774 : MODE RÉDUIT — exactement le minimum de l'onglet affiché (titres + une ligne entière), ni plus ni moins */
    { const R = layLoad().red || {}; LAY_UNITS.forEach(u => { if (!R[u] || pg.classList.contains("max-" + u)) return; const m0 = layMinOf(u); if (m0) pg.style.setProperty("--h-" + u, m0 + "px"); }); }
    /* E2 (série E), revu le 06/11 au soir : à l'ouverture, sans hauteur réglée à la poignée, le bloc du détail suit ses lignes (pas de vide) ;
       une hauteur réglée à la poignée est gardée, même s'il reste du vide ; non enregistré */
    if (!(layLoad().h || {}).detail) { const a = document.activeElement, busy = a && a !== document.body && pg.contains(a);   /* pas pendant une saisie (la ligne écrite reste en place) */
      if (!busy && !pg.classList.contains("max-detail") && !document.querySelector("td.svi-cs, #sviSelFrame:not([hidden])")) { const I = layRows("detail"), c = parseFloat(pg.style.getPropertyValue("--h-detail")) || 0;
        if (I && c) { const s = Math.ceil(I.fixed + I.rows.reduce((x, y) => x + y, 0)); if (c > s + (I.rows[0] || 21)) pg.style.setProperty("--h-detail", Math.max(s, m) + "px"); } } }
    layMinScroll();
  };
  const layOrder = () => {
    const saved = (layLoad().order || []).filter(u => LAY_UNITS.includes(u));
    /* v685 : bloc nouveau absent de l'ordre enregistré : rangé à sa place d'origine (juste avant le suivi) */
    const out = [...saved];
    LAY_UNITS.filter(u => !saved.includes(u)).forEach(u => { const i = out.indexOf("suivi"); if (u !== "suivi" && i >= 0) out.splice(i, 0, u); else out.push(u); });
    return out;
  };
  /* v1155 (L3) : blocs libres de la page budget — largeur au coin (pas de 5 %, au moins 30 %), deux blocs côte à côte ;
     un bloc sur toute la largeur tiré de côté prend la moitié. DÉTAIL reste sur toute la largeur (document unique, partie 3). */
  const LAY_GAP = 14;
  const LAY_WMIN = { hier: 45 };   /* v1156 : TÂCHES (trois colonnes) jamais sous 45 % */
  const layWMin = u => LAY_WMIN[u] || 30;
  const layWOf = (lay, u) => u === "detail" ? 100 : Math.max(layWMin(u), Math.min(100, +((lay.w || {})[u]) || 100));
  const layWApply = (pg, lay) => {
    const free = LAY_UNITS.some(u => layWOf(lay, u) < 100);
    pg.classList.toggle("lay-free", free);
    LAY_UNITS.forEach(u => { if (u === "detail") return; const w = layWOf(lay, u);
      layEls(u).forEach(el => { if (free && w < 100) el.style.flex = "0 0 calc(" + w + "% - " + (LAY_GAP * (1 - w / 100)).toFixed(1) + "px)"; else el.style.removeProperty("flex"); }); });
  };
  const layWResize = (event, h) => {
    event.preventDefault(); event.stopPropagation();
    const u = h.dataset.wrz, pg = page$(), b = layEls(u)[0]; if (!pg || !b) return;
    const W = pg.clientWidth - (parseFloat(getComputedStyle(pg).paddingLeft) || 0) - (parseFloat(getComputedStyle(pg).paddingRight) || 0);
    const x0 = event.clientX, y0 = event.clientY, r0 = b.getBoundingClientRect(), hb = layMeasure(u), MINU = layMinOf(u) || 44;
    let w = layWOf(layLoad(), u), v = 0, on = false; h.classList.add("on");
    const move = e => { const dx = e.clientX - x0, dy = e.clientY - y0; if (!on) { if (Math.hypot(dx, dy) < 6) return; on = true; } e.preventDefault();
      w = Math.max(layWMin(u), Math.min(100, Math.round(((r0.width + dx + LAY_GAP) / (W + LAY_GAP) * 100) / 5) * 5));   /* v1156 : écart compris (pas de 5 % régulier) */
      const lay = layLoad(); lay.w = { ...(lay.w || {}), [u]: w }; layWApply(pg, lay);
      if (Math.abs(dy) > 4) { v = Math.max(MINU, Math.round(hb + dy)); if (["hier", "client"].includes(u)) v = Math.max(MINU, laySnap(u, v)); pg.style.setProperty("--h-" + u, v + "px"); } };
    const up = ev => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up); h.classList.remove("on");
      if (!on) return; if (ev && ev.type === "pointercancel") { layApply(); return; }   /* v1156 : geste interrompu = annulé */
      const lay = layLoad(); lay.w = lay.w || {}; if (w >= 100) delete lay.w[u]; else lay.w[u] = w;
      if (v) { lay.h = lay.h || {}; lay.h[u] = v; lay.red = lay.red || {}; if (v <= MINU + 2) lay.red[u] = 1; else delete lay.red[u]; }
      delete lay.def; laySave(lay); histLog("DISPOSITION", "MODIFICATION", "LARGEUR / HAUTEUR DES BLOCS"); layApply(); setTimeout(layMinScroll, 30); try { sviWinEat(); } catch (e) {} };
    document.addEventListener("pointermove", move, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
  };
  const layOpenH = {};   /* hauteurs réglées pendant cette ouverture seulement */
  const layApply = () => {
    const pg = page$();
    if (!pg) return;
    const lay = layLoad();
    /* v774 (point 9) : SUIVI aussi rouvert comme laissé */
    layOrder().forEach((u, i) => layEls(u).forEach(el => { el.style.order = i; }));
    layWApply(pg, lay);
    LAY_UNITS.forEach(u => {
      /* SUIVI (DOC / TAF / OBS) : toujours 5 lignes à l'ouverture,
         l'agrandissement ne vaut que pour la séance en cours */
      const h = (lay.h || {})[u] || (u === "detail" ? layDetDef() : 0);
      if (h) pg.style.setProperty("--h-" + u, h + "px");
      else pg.style.removeProperty("--h-" + u);
    });
    try { requestAnimationFrame(() => { try { layDetFloor(); } catch (e) {} }); } catch (e) {}
    /* v727 (bloc 11.3) : une case en saisie reste entière dans la hauteur du bloc (sous l'en-tête et au-dessus du pied collants) */
    if (!shell.__layFocus) { shell.__layFocus = true; shell.addEventListener("focusin", e => {
      const inp = e.target; if (!inp.matches || !inp.matches("input, textarea, .ins-dv")) return;
      const sc = inp.closest(".bdg-h-col, .bdg-d-client-scroll, #bdgTabBody .bdg-d-scroll"); if (!sc) return;
      const row = inp.closest(".ins-li, .bdg-h-item, tr"); if (!row || row.closest("thead, tfoot")) return;
      const fit = () => {
        const sr = sc.getBoundingClientRect(), rr = row.getBoundingClientRect();
        const hd = sc.querySelector(":scope > .bdg-h-head") || sc.querySelector("thead"), ft = sc.querySelector("tfoot");
        const top = sr.top + sc.clientTop + (hd ? hd.getBoundingClientRect().height + (sc.matches(".bdg-h-col") ? 0 : Math.max(0, hd.getBoundingClientRect().top - sr.top - sc.clientTop)) : 0);
        /* v785 : la ligne « CRÉER … ICI » est collée en bas du bloc : la case en saisie reste au-dessus d'elle */
        const nw = sc.querySelector("tbody tr.ins-new, tbody tr.rec-new, tbody tr.scn-new, .ins-li.ins-new"), nwH = nw && nw !== row && !nw.contains(row) ? nw.getBoundingClientRect().height : 0;
        const bot = sr.top + sc.clientTop + sc.clientHeight - (ft && ft.offsetHeight ? ft.getBoundingClientRect().height : 0) - nwH;
        if (rr.top < top) sc.scrollTop -= Math.ceil(top - rr.top);
        else if (rr.bottom > bot) sc.scrollTop += Math.ceil(rr.bottom - bot);
      };
      fit(); setTimeout(fit, 350);
    }); }
    /* v557 : hauteur par défaut du détail recalculée si l'écran change (rotation, barre de Safari) */
    if (!shell.__layDetRs) { shell.__layDetRs = true; let tm = 0; window.addEventListener("resize", () => { clearTimeout(tm); tm = setTimeout(() => { if (shell.isConnected && page$() && !(layLoad().h || {}).detail) layApply(); }, 300); }); }
    const custom = (lay.order && layOrder().join() !== LAY_UNITS.join()) ||
      Object.keys(lay.h || {}).length > 0 || Object.keys(lay.w || {}).length > 0;
    const rb = $("layResetBtn");
    /* ↻ toujours affiché ; grisé quand les blocs sont déjà à leur place d'origine */
    if (rb) { rb.disabled = !custom; }   /* ↻ : dans le menu ⋯ du haut, grisé quand il n'y a rien à remettre en place */
  };
  const layInit = () => {
    const pg = page$();
    if (!pg) return;
    shell.querySelectorAll(".blk-tools").forEach((t, i) => {
      if (t.querySelector(".blk-more")) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "blk-more";
      b.dataset.for = "m" + i;
      b.title = "Actions";
      b.setAttribute("aria-label", "Actions");
      b.textContent = "⋯";
      t.appendChild(b);
    });
    recTabApply();
    LAY_UNITS.forEach(u => {
      /* poignée de déplacement dans le titre */
      const title = u === "detail" ? $("bdgDetailHead")
        : layEls(u)[0]?.querySelector(".blk-head");
      if (title && !title.querySelector(".blk-grip")) {
        const g = document.createElement("span");
        g.className = "blk-grip";
        g.dataset.grip = u;
        g.title = "Glisser pour déplacer le bloc";
        g.textContent = "⠿";
        title.prepend(g);
      }
      /* poignée de hauteur en bas du bloc */
      if (u === "detail") {
        if (!$("bdgDetailRsz")) {
          const r = document.createElement("div");
          r.className = "blk-rsz";
          r.id = "bdgDetailRsz";
          r.dataset.rsz = u;
          r.title = "Glisser pour changer la hauteur";
          $("bdgTabBody").after(r);
        }
      } else {
        const b = layEls(u)[0];
        if (b && !b.querySelector(":scope > .lay-wrz")) { const c = document.createElement("div"); c.className = "lay-wrz"; c.dataset.wrz = u; c.title = "Glisser pour changer la largeur et la hauteur"; c.addEventListener("pointerdown", e => layWResize(e, c)); b.appendChild(c); }
        if (b && !b.querySelector(":scope > .blk-rsz")) {
          const r = document.createElement("div");
          r.className = "blk-rsz";
          r.dataset.rsz = u;
          r.title = "Glisser pour changer la hauteur";
          b.appendChild(r);
        }
      }
    });
    layApply();
  };

  const layResize = (event, h) => {
    event.preventDefault();
    const u = h.dataset.rsz;
    const pg = page$();
    const y0 = event.clientY;
    const base = layMeasure(u);
    let v = base;
    h.classList.add("on");
    const DMIN = u === "detail" ? layDetMin() : 0;
    const MINU = u === "detail" ? 0 : layMinOf(u);   /* v774 : même calcul pour tous les blocs */
    const move = e => {
      e.preventDefault();
      /* minimum : en-tête + une seule ligne (+ ligne TOTAL s'il y en a une) */
      const minH = u === "detail" ? DMIN : MINU || { client: 65 }[u] || 44;
      v = Math.max(minH, Math.round(base + e.clientY - y0));
      if (["hier", "client", "detail"].includes(u)) v = Math.max(minH, laySnap(u, v));   /* v727 : lignes entières */
      pg.style.setProperty("--h-" + u, v + "px");
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      h.classList.remove("on");
      const lay = layLoad();
      lay.h = lay.h || {};
      lay.h[u] = v;
      /* v774 (point 12) : bloc laissé à son minimum = MODE RÉDUIT, gardé d'un onglet à l'autre (chaque onglet à son propre minimum) */
      lay.red = lay.red || {}; if (v <= (u === "detail" ? DMIN : MINU) + 2) lay.red[u] = 1; else delete lay.red[u];
      delete lay.def; laySave(lay);
      histLog("DISPOSITION", "MODIFICATION", "ORDRE / HAUTEUR DES BLOCS");
      layApply(); setTimeout(layMinScroll, 30);
    };
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  };

  const layDrag = (event, grip) => {
    event.preventDefault();
    const src = grip.dataset.grip;
    let target = null, after = false, timer = null, lastY = event.clientY, lastX = event.clientX;
    const X0 = event.clientX;
    layEls(src).forEach(el => el.classList.add("lay-src"));
    const rectOf = u => {
      const rs = layEls(u).map(el => el.getBoundingClientRect());
      return { top: Math.min(...rs.map(r => r.top)), bottom: Math.max(...rs.map(r => r.bottom)), left: Math.min(...rs.map(r => r.left)), right: Math.max(...rs.map(r => r.right)) };
    };
    const clear = () => LAY_UNITS.forEach(u =>
      layEls(u).forEach(el => el.classList.remove("lay-before", "lay-after")));
    const pick = y => {
      clear();
      target = null;
      for (const u of layOrder()) {
        if (u === src) continue;
        const r = rectOf(u);
        if (y >= r.top && y <= r.bottom && lastX >= r.left - 8 && lastX <= r.right + 8) {
          target = u;
          /* v1155 : deux blocs côte à côte — avant / après selon le côté (gauche / droite) */
          after = r.right - r.left < (page$().clientWidth * .9) ? lastX > (r.left + r.right) / 2 : y > (r.top + r.bottom) / 2;
          const els = layEls(u);
          (after ? els[els.length - 1] : els[0]).classList.add(after ? "lay-after" : "lay-before");
          break;
        }
      }
    };
    /* défilement automatique près des bords de l'écran */
    timer = setInterval(() => {
      const vh = window.innerHeight;
      if (lastY < 90) window.scrollBy(0, -14);
      else if (lastY > vh - 60) window.scrollBy(0, 14);
      else return;
      pick(lastY);
    }, 30);
    const move = e => {
      e.preventDefault();
      lastY = e.clientY; lastX = e.clientX;
      pick(lastY);
    };
    const up = ev => {
      clearInterval(timer);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      clear();
      layEls(src).forEach(el => el.classList.remove("lay-src"));
      if (ev && ev.type === "pointercancel") return;   /* v1156 : geste interrompu = annulé (ni largeur ni ordre) */
      const lay = layLoad(), pgW = (page$() || {}).clientWidth || innerWidth;
      /* v1155 : un bloc sur toute la largeur tiré de côté (plus de 15 %) prend la moitié */
      const side = src !== "detail" && layWOf(lay, src) >= 100 && Math.abs(lastX - X0) > pgW * .15;
      if (side) { lay.w = { ...(lay.w || {}), [src]: 50 }; }
      if (!target && !side) return;
      if (target) { const order = layOrder().filter(u => u !== src);
        order.splice(order.indexOf(target) + (after ? 1 : 0), 0, src);
        lay.order = order; }
      delete lay.def; laySave(lay);
      histLog("DISPOSITION", "MODIFICATION", "ORDRE / HAUTEUR DES BLOCS");
      layApply();
    };
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  };

  /* glisser une ligne : appui long (0,35 s) puis glissement vertical */
  const roStart = (event, el) => {
    const isRow = el.tagName === "TR";
    const t = isRow ? "client" : el.dataset.h;
    /* tri choisi en cours : il garde la main, pas de glissement */
    if (CF[t] && CF[t].sort && !CF[t].sort.def) return;
    const keyOf = x => isRow ? x.dataset.desig : x.dataset.v;
    const sibs = () => isRow
      ? [...el.parentElement.querySelectorAll("tr[data-desig]")]
      : [...el.parentElement.querySelectorAll(".bdg-h-item[data-h]")];
    const x0 = event.clientX, y0 = event.clientY;
    let on = false, target = null, after = false, lastY = y0;
    const clear = () => sibs().forEach(x => x.classList.remove("ro-before", "ro-after"));
    const timer = setTimeout(() => {
      on = true;
      el.classList.add("ro-src");
      try { navigator.vibrate && navigator.vibrate(15); } catch (e) {}
    }, 350);
    const tm = e => { if (on) e.preventDefault(); };
    const move = e => {
      lastY = e.clientY;
      if (!on) {
        if (Math.abs(e.clientX - x0) > 8 || Math.abs(e.clientY - y0) > 8) end(false);
        return;
      }
      e.preventDefault();
      clear();
      target = null;
      for (const x of sibs()) {
        const r = x.getBoundingClientRect();
        if (lastY >= r.top && lastY <= r.bottom) {
          if (x !== el) {
            after = lastY > (r.top + r.bottom) / 2;
            x.classList.add(after ? "ro-after" : "ro-before");
            target = x;
          }
          break;
        }
      }
    };
    const end = drop => {
      clearTimeout(timer);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", cancel);
      setTimeout(() => document.removeEventListener("touchmove", tm), 0);
      clear();
      el.classList.remove("ro-src");
      if (!on) return;
      /* le toucher qui suit le glissement ne sélectionne pas la ligne */
      const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
      shell.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => shell.removeEventListener("click", stop, { capture: true }), 350);
      if (!drop || !target) return;
      const keys = sibs().map(keyOf).filter(k => k !== keyOf(el));
      let i = keys.indexOf(keyOf(target));
      keys.splice(after ? i + 1 : i, 0, keyOf(el));
      const all = roLoad();
      /* lignes masquées par un filtre : gardent leur rang après les visibles */
      all[t] = [...keys, ...(all[t] || []).filter(k => !keys.includes(k))];
      roSave(all);
      histLog(t === "client" ? "DÉSIGNATIONS CLIENT" : "TÂCHES", "ORDRE DES LIGNES", keyOf(el).split("||").pop());
      refreshAll();
    };
    const up = () => end(true);
    const cancel = () => end(false);
    document.addEventListener("touchmove", tm, { passive: false });
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", cancel);
  };

  /* glisser un en-tête de colonne pour la déplacer */
  const coDrag = (event, th) => {
    const isHier = th.classList.contains("bdg-h-head");
    const table = th.closest("table");
    const t = isHier ? "hierCols" : th.querySelector(".cf-btn")?.dataset.cf || table.querySelector("thead .cf-btn[data-cf]")?.dataset.cf;
    const ths = () => isHier
      ? [...$("bdgHier").querySelectorAll(".bdg-h-head")]
      : [...table.querySelectorAll("thead tr:first-child > th")];
    const keyOf = x => isHier
      ? x.querySelector(".cf-btn")?.dataset.cf
      : x.dataset.cokey || x.querySelector(".cf-btn")?.dataset.col;
    const x0 = event.clientX, y0 = event.clientY;
    let on = false, target = null, ghost = null, mv = 0; const arm = sviColArm(event, th);
    const clear = () => ths().forEach(x => x.classList.remove("co-before", "co-after"));
    const move = e => {
      const dx = e.clientX - x0, dy = e.clientY - y0;
      mv = Math.max(mv, Math.abs(dx), Math.abs(dy));
      if (!on) {
        if (Math.abs(dx) < 8) return;
        if (!arm(e)) return;
        on = true;
        th.classList.add("co-src");
        ghost = document.createElement("div");
        ghost.id = "coGhost";
        ghost.textContent = (th.querySelector(".cf-lab")?.firstChild?.textContent || "").trim();
        document.body.appendChild(ghost);
      }
      e.preventDefault();
      ghost.style.left = e.clientX + 8 + "px";
      ghost.style.top = e.clientY - 28 + "px";
      clear();
      target = null;
      const list = ths();
      for (const x of list) {
        const r = x.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX < r.right) {
          if (x !== th) {
            const after = list.indexOf(x) > list.indexOf(th);
            x.classList.add(after ? "co-after" : "co-before");
            target = x;
          }
          break;
        }
      }
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      clear();
      th.classList.remove("co-src");
      ghost?.remove();
      /* FORMAT 116 : simple toucher sur le titre = sélection de la colonne */
      /* v500 (remarque 48) : MARGE — toucher CHARGES, PRODUITS, MARGE ou % = croissant, décroissant, ordre normal */
      if (!on && mv < 8 && th.closest(".mg-table") && shell.__mg && shell.__mg.sortable(keyOf(th))) { shell.__mg.sort(keyOf(th)); return; }
      if (!on && mv < 8) { try { colSelToggle(th); } catch (e) {} return; }
      if (!on || !target) return;
      const keys = ths().map(keyOf);
      const from = keys.indexOf(keyOf(th));
      const to = keys.indexOf(keyOf(target));
      const [k] = keys.splice(from, 1);
      keys.splice(to, 0, k);
      const all = coLoad();
      all[t] = keys;
      coSave(all);
      histLog("COLONNES", "DÉPLACEMENT", t + " : " + keys.join(", "));
      /* évite le clic qui suit le glissement */
      const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
      shell.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => shell.removeEventListener("click", stop, { capture: true }), 300);
      refreshAll();
    };
    /* iPad : bloque le défilement pendant le glissement */
    const tm = e => { if (on) e.preventDefault(); };
    document.addEventListener("touchmove", tm, { passive: false });
    const end = () => setTimeout(() => document.removeEventListener("touchmove", tm), 0);
    document.addEventListener("pointerup", end, { once: true });
    document.addEventListener("pointercancel", end, { once: true });
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  };
  return { renderTab, dlyTable, coDrag, layDrag, layResize, roStart, DLY_COLS, layApply, layInit };
}
