  function openBudgetDetail(ref) {
    sviStep("OUVERTURE " + ref);
    /* v634 : ouverture en cours — si l'application bloque, le budget ne sera pas rouvert au démarrage suivant */
    try { localStorage.setItem("svi_opening_v1", ref); setTimeout(() => { try { localStorage.removeItem("svi_opening_v1"); } catch (e) {} }, 4000); } catch (e) {}
    /* v649 : page quittée ou rechargée (NOUVELLE VERSION…) pendant l'ouverture = pas un blocage (une page bloquée ne passe pas ici) */
    if (!window.__sviOpenHide) { window.__sviOpenHide = 1; addEventListener("pagehide", () => { try { localStorage.removeItem("svi_opening_v1"); } catch (e) {} }); }
    const budget =
      groups.get(ref);

    if (!budget) return;
    /* dernier budget consulté : rouvert à la prochaine ouverture */
    try { localStorage.setItem("svi_lastbdg_v1", ref); } catch (e) {}
    /* dernière vue de ce budget (v448) : enregistrée en partant, retrouvée à l'ouverture */
    if (window.__sviViewSave && window.__sviCtx !== "bdg:" + ref) window.__sviViewSave();
    setTimeout(() => window.__sviViewRestore && window.__sviViewRestore("bdg:" + ref), 0);

    /* balayage gauche / droite : budget suivant / précédent (ordre des références) */
    {
      const liveOf = g => !!g.inst && g.inst.state !== "valide";
      const refs = [...groups.keys()].filter(k => liveOf(groups.get(k)) === liveOf(budget)).sort((x, y) => String(x).localeCompare(String(y), "fr", { numeric: true }));
      window.__sviBdgNav = { refs, cur: ref, open: openBudgetDetail };
      if (!window.__sviSwipe) {
        window.__sviSwipe = true;
        let st = null;
        document.addEventListener("touchstart", e => {
          const nav = window.__sviBdgNav;
          if (!nav || e.touches.length !== 1 || !document.querySelector(".bdg-d-page")) { st = null; return; }
          const t = e.target;
          /* bloc agrandi (16/10/2026) : le balayage y change de budget en restant sur le même bloc et le même onglet ;
             un tableau ou le Gantt qui défile garde le geste tant qu'il n'est pas arrivé au bout */
          const pg = document.querySelector(".bdg-d-page"), mx = pg && [...pg.classList].find(c => /^max-/.test(c));
          /* v455 (Ahmed) : le balayage change de budget SEULEMENT dans l'en-tête du budget (référence, DOC, TAF, OBS, INF) ;
             dans tous les blocs (tableaux, Gantt…), il fait seulement défiler */
          if (!t.closest(".bdg-d-sticky") || t.closest("#docPop, #blkPop, #blkMenu, #svConf, #svCal, input, textarea, select")) { st = null; return; }
          st = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), max: mx ? mx.slice(4) : "" };
        }, { passive: true });
        document.addEventListener("touchend", e => {
          const nav = window.__sviBdgNav;
          if (!st || !nav) return;
          const dx = e.changedTouches[0].clientX - st.x, dy = e.changedTouches[0].clientY - st.y;
          const quick = Date.now() - st.t < 700;
          const s0 = st;
          st = null;
          if (!quick || Math.abs(dx) < 90 || Math.abs(dy) > Math.abs(dx) * 0.5) return;
          if (s0.sc) {
            /* zone qui défile : elle a bougé pendant le geste, ou n'est pas au bout dans ce sens → c'était un défilement */
            const c = s0.sc;
            if (Math.abs(c.scrollLeft - s0.sl) > 2) return;
            if (dx < 0 && c.scrollLeft + c.clientWidth < c.scrollWidth - 2) return;
            if (dx > 0 && c.scrollLeft > 2) return;
          }
          const i = nav.refs.indexOf(nav.cur);
          const j = dx < 0 ? i + 1 : i - 1;
          if (i < 0 || j < 0 || j >= nav.refs.length) return;
          if (s0.max) window.__sviPendingMax = s0.max;
          nav.open(nav.refs[j]);
          if (!s0.max) window.scrollTo(0, 0);
        }, { passive: true });
      }
    }

    /* écran liste à restaurer au retour (même après un balayage entre budgets) */
    const listHTML = shell.querySelector(".bdg-d-page")
      ? (window.__sviListHTML || shell.innerHTML)
      : (window.__sviListHTML = shell.innerHTML);

    /* ---- lecture tolérante des colonnes (accents, espaces, / ignorés) ---- */





    const typeKey =
      Object.keys(budget.rows[0] || {})
        .find(k => {
          const n = nk(k);
          return n.includes("CHG") && n.includes("PRD");
        });

    const kindOf = row => {
      const t =
        nk(typeKey ? row[typeKey] : "");

      if (t.startsWith("PRD") || t.startsWith("PROD")) {
        return "prd";
      }

      if (t.startsWith("CHG") || t.startsWith("CHARGE")) {
        return "chg";
      }

      return "";
    };

    const toLine = (row, i) => {
      const kind = kindOf(row);

      const nbr = pick(row, ["NBR"]);

      const dims = [
        pick(row, ["DIM1"]),
        pick(row, ["DIM2"]),
        pick(row, ["DIM3"])
      ];

      const price =
        num(pick(row, ["PUB", "PRIX", "PU"]));

      let qty =
        num(pick(row, ["QTB", "QUANTITE"]));

      if (kind === "prd" && !qty) {
        const factors =
          [nbr, ...dims]
            .filter(v => normalise(v) !== "")
            .map(num);

        if (factors.length) {
          qty =
            factors.reduce(
              (a, b) => a * b,
              1
            );
        }
      }

      /* les prix / montants de la feuille sont TTC :
         le HT est déduit avec la TVA de la ligne (20 % par défaut) */
      const ttcAmount =
        price
          ? qty * price
          : num(pick(row, ["MNB", "MONTANT", "MPB"]));
      const tvaRate = 20;

      return {
        id: "l" + i,
        kind,
        article:
          byLetter(row, "H") || pick(row, ["ARTICLE", "N°"]),
        designation:
          byLetter(row, "I") || pick(row, ["DESIGNATION"]),
        unit:
          byLetter(row, "J") || pick(row, ["UTB", "UNITE"]),
        /* unité des onglets Détail charge / produit :
           colonne Q de la feuille BDG */
        dunit: byLetter(row, "Q"),
        detail:
          pick(row, ["DETAIL BUDGET"]) ||
          byLetter(row, "I") ||
          pick(row, ["DESIGNATION"]),
        /* préfixe « 01 - » retiré : les libellés identiques
           sont ainsi regroupés en une seule entrée */
        lot: stripLevelPrefix(
          byLetter(row, "K") || pick(row, ["LOT"])
        ).trim(),
        prim: stripLevelPrefix(
          byLetter(row, "N") || pick(row, ["ACTIVITE PRIMAIRE"])
        ).trim(),
        sec: stripLevelPrefix(
          byLetter(row, "L") || pick(row, ["ACTIVITE"])
        ).trim(),
        cqty: num(byLetter(row, "V")),
        deb: row.__deb || "", fin: row.__fin || "",
        cprice: num(byLetter(row, "W")),
        nbr,
        dims,
        qty,
        priceTTC: price,
        ttcAmount,
        price: price / (1 + tvaRate / 100),
        amount: ttcAmount / (1 + tvaRate / 100),
        tva: tvaRate
      };
    };

    const lines =
      budget.rows.map(toLine);

    /* lignes identiques (même type, article, désignation, unité)
       regroupées à l'affichage */
    /* Détail charges : regroupées par désignation + unité (article ignoré) ;
       Détail produits : PAS de regroupement, une ligne de la feuille = une ligne */

    const groupMembers = new Map();
    lines.forEach(l => {
      l.gid = gidOf(l);
      if (!groupMembers.has(l.gid)) groupMembers.set(l.gid, []);
      groupMembers.get(l.gid).push(l);
    });


    /* désignations choisies en haut (filtrent le bas) */
    const selDesig = new Set();
    /* lignes choisies dans Détail charge / produit (filtrent le haut) */
    const selRows = new Set();
    /* lots / tâches choisis dans les colonnes du bas */
    const hSel = {
      lot: new Set(),
      prim: new Set(),
      sec: new Set()
    };



    /* ce qu'apportent les lignes sélectionnées en bas */
    const rowSet = field => {
      const out = new Set();
      selRows.forEach(gid => {
        (groupMembers.get(gid) || []).forEach(l => {
          if (String(field(l)).trim() !== "") out.add(field(l));
        });
      });
      return out;
    };

    /* filtres de colonne propagés aux autres blocs :
       client = désignations visibles du tableau client filtré,
       det    = attributs des lignes visibles de Détail charges / produits filtrés,
       h      = valeurs gardées dans les colonnes lots / activités */
    let CONS = { client: null, det: null, h: {} };
    let lastClientKeys = new Set();

    const cons = (l, skip) => {
      const c = CONS;
      if (skip !== "client" && c.client && !c.client.has(desigKey(l))) return false;
      if (skip !== "detail" && c.det && !(
        c.det.d.has(desigKey(l)) &&
        inSet(c.det.lot, l.lot) &&
        inSet(c.det.prim, l.prim) &&
        inSet(c.det.sec, l.sec)
      )) return false;
      for (const lv of ["lot", "prim", "sec"]) {
        const set = c.h[lv];
        if (skip !== lv && set && !set.has(cfText(stripLevelPrefix(l[lv])))) return false;
      }
      return true;
    };

    const hierOK = l =>
      inSet(hSel.lot, l.lot) &&
      inSet(hSel.prim, l.prim) &&
      inSet(hSel.sec, l.sec);

    /* tableau du haut : reste entier quand on y clique ;
       filtré par la hiérarchie et par les lignes choisies en bas */
    const clientLines = () => {
      const rd = rowSet(desigKey);
      return lines.filter(l => hierOK(l) && inSet(rd, desigKey(l)) && cons(l, "client"));
    };

    /* onglets du bas : restent entiers quand on y clique ;
       filtrés par la hiérarchie et par les désignations choisies en haut */
    const visibleLines = () =>
      lines.filter(l => hierOK(l) && inSet(selDesig, desigKey(l)) && cons(l, "detail"));

    const byKindNow = () => {
      const v = visibleLines();
      return {
        chg: v.filter(l => l.kind === "chg"),
        prd: v.filter(l => l.kind === "prd")
      };
    };


    const tabs = [
      { key: "chg", title: "DÉTAIL CHARGES" },
      { key: "prd", title: "DÉTAIL PRODUITS" },
      { key: "qlt", title: "DÉTAIL QUALITÉ" },
      { key: "dly", title: "DÉTAIL DÉLAIS" },
      /* budget en instance : les liaisons validées sont un onglet du détail */
      ...(budget.inst ? [{ key: "unl", title: "LIGNES NON LIÉES" }, { key: "inc", title: "IMPORT NON CRÉÉ" }, { key: "lnk", title: "MARGE", ico: "xpl" }] : [])   /* v609 : onglet GRAPHIQUE retiré (le graphique sous le planning suffit) ; v498 (remarque 37) : MARGE remplace LIAISONS VALIDÉES et EXPLOITATION */
    ];

    /* dernier onglet du détail ouvert (charges, produits, qualité, délais) */
    let active = "chg";
    try {
      const t = localStorage.getItem("svi_dtab_v1");
      if (["chg", "prd", "qlt", "dly"].includes(t)) active = t;
    } catch (e) {}
    /* v675 : réouverture par le verrou par onglet — même onglet qu'avant */
    if (window.__sviForceTab) { active = window.__sviForceTab; window.__sviForceTab = null; }
    /* référence affichée du budget : « H88 BDG 26-1001/001 » */
    const fullRef = String(budget.project).trim().toUpperCase() + " " + ref;
    /* budget en instance : rouge (édition) ou vert (figé) */
    shell.classList.remove("bdg-inst-instance", "bdg-inst-fige", "list-inst");
    /* en instance (rouge) ou figé (vert) ; validé : présentation noire normale */
    const INST_LIVE = !!budget.inst && budget.inst.state !== "valide";
    if (INST_LIVE) shell.classList.add("bdg-inst-" + (budget.inst.state || "instance"));
    /* v684 : consolidé d'un budget à avenants (« réf.-GLOBAL ») ; étape ouverte depuis le consolidé (flèche = retour au consolidé) */
    const AV_ROOT = budget.inst && budget.inst.virtual && !budget.inst.vname && /-GLOBAL$/.test(String(ref)) ? budget.inst.parent : "";
    const AV_STG = AV_ROOT ? sviAvStages(AV_ROOT) : [];
    const AV_RET = !!window.__sviAvRet && window.__sviAvRet !== ref;
    sviWatchState(shell);

    /* ---- squelette de l'écran ---- */

    shell.innerHTML = `

      <div class="bdg-d-sticky">

      <div class="novapp-list-titlebar">

        <button
          type="button"
          class="novapp-menu open-menu"
          aria-label="Menu"
        >
          ☰
        </button>

        <button
          type="button"
          id="budgetBackBtn"
          class="novapp-menu"
          aria-label="Retour"
          ${INST_LIVE && !AV_RET ? 'style="display:none"' : ""}
        >
          ←
        </button>

        <h1 class="bdg-d-h1">
          ${esc(budget.project)}
        </h1>

        <div class="bdg-d-hright">
          ${INST_LIVE ? `
          <button type="button" class="inst-nav" id="instPrev" title="Budget précédent" aria-label="Précédent"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <button type="button" class="inst-nav" id="instNext" title="Budget suivant" aria-label="Suivant"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          ${budget.inst.state !== "fige" ? `<button type="button" class="inst-act" id="instUndo" title="Annuler" aria-label="Annuler" disabled><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7 4.5 11.5 9 16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 11.5h9.5a5 5 0 0 1 0 10H11" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></button>
          <button type="button" class="inst-act" id="instRedo" title="Rétablir" aria-label="Rétablir" disabled><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 7l4.5 4.5L15 16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 11.5H9.5a5 5 0 0 0 0 10H13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></button>` : ""}
          ${budget.inst.state !== "fige" ? `<button type="button" class="inst-act inst-todo" id="instTodo" title="À compléter" aria-label="À compléter"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 2.8 19.5h18.4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10v4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.1" fill="currentColor"/></svg><b></b></button>` : ""}
          <button type="button" class="inst-act" id="instLock"
            title="${budget.inst.state === "fige" ? "Revenir en édition" : "Figer (lecture seule)"}"
            aria-label="Figer">${budget.inst.state === "fige" ? `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V8a4 4 0 0 1 7.5-1.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>` : `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`}</button>
          ${budget.inst.state === "fige"
            ? `<button type="button" class="inst-act" id="instValid" title="Valider le budget" aria-label="Valider"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`
            : `<button type="button" class="inst-act" id="instDel" title="Supprimer ce budget" aria-label="Supprimer"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`}
          <button type="button" class="inst-act" id="instClose" title="Fermer" aria-label="Fermer"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>` : ""}
          <button type="button" class="inst-act" id="instDup" hidden title="Dupliquer ce budget" aria-label="Dupliquer"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></button>
          <button type="button" class="inst-act bdg-more-btn" id="bdgMore" title="Actions du budget" aria-label="Actions du budget">⋯</button>
          <button type="button" class="bdg-lay-btn" id="layResetBtn" disabled style="display:none"
            title="Disposition par défaut : remettre les blocs à leur place et taille d'origine"
            aria-label="Disposition par défaut"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M4 3.8v4.6h4.6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <button type="button" class="bdg-alert-btn" id="obsAlertBtn" hidden
            aria-label="Observations importantes" title="Observations importantes">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2 2.6 19.5h18.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9.5v4.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16.9" r="1.15" fill="currentColor"/></svg>
            <span class="bdg-alert-n" id="obsAlertN"></span>
          </button>
        </div>

      </div>

      <div class="bdg-d-head">

        <div class="bdg-d-ref">
          <span><span id="refBang">${obsBang(ref)}</span>${esc(fullRef)}</span>
          <span class="bdg-d-badge" id="histBtn" role="button" title="Historique">H</span>
        </div>

        <div class="bdg-d-pills">
          <span class="bdg-d-pill bdg-d-pill-btn" data-pill="doc" role="button">${SVI_ICON.doc}<span class="pl">DOC ${svCnt(0)}</span></span>
          <span class="bdg-d-pill bdg-d-pill-btn" data-pill="taf" role="button">${SVI_ICON.taf}<span class="pl">TAF ${svCnt(0)}</span></span>
          <span class="bdg-d-pill bdg-d-pill-btn" data-pill="obs" role="button">${SVI_ICON.obs}<span class="pl">OBS ${svCnt(0)}</span></span>
          <span class="bdg-d-pill bdg-d-pill-btn" data-pill="inf" role="button">${SVI_ICON.inf}<span class="pl">INF</span></span>
          ${budget.inst && !budget.inst.virtual ? `<span class="bdg-d-pill bdg-d-pill-btn" data-pill="scn" role="button" title="Nouveau scénario">${SVI_ICON.scn}<span class="pl">SCN ${svCnt((((budget.inst.data || {}).ver || {}).L || []).filter(x => x.kind === "sc").length)}</span></span>` : ""}
          ${INST_LIVE ? '<div class="lk-chain lk-chain-top" id="insChain" hidden></div>' : ""}
        </div>
        ${AV_ROOT ? `<div class="av-top" id="avTop">
          <span class="list-lab">AVENANTS :</span>
          <button type="button" class="av-ic" data-avt="add" ${AV_STG.length && AV_STG[AV_STG.length - 1].state === "valide" ? 'title="Nouvel avenant"' : 'disabled title="LE DERNIER AVENANT DOIT ÊTRE VALIDÉ"'} aria-label="Nouvel avenant">＋</button>
          ${AV_STG.some(x => x.state !== "valide") ? '<button type="button" class="av-ic" data-avt="inst" title="Étapes en instance" aria-label="Étapes en instance">⌛</button>' : ""}
          ${AV_STG.some(x => x.state === "valide") ? '<button type="button" class="av-ic" data-avt="valid" title="Étapes validées" aria-label="Étapes validées">≡</button>' : ""}
          <label class="av-inc"><input type="checkbox" id="avAll"${sviAvAllGet(AV_ROOT) ? " checked" : ""}> INCLURE LES NON VALIDÉS</label>
        </div>` : ""}

      </div>
      </div>

      <div class="bdg-d-page">
        <div id="insLinkView" class="ins-link-view"></div>

        <div class="bdg-d-block blk-client">
          <div class="bdg-d-block-title blk-head" id="bdgClientTitle">
            <span class="ttl">${SVI_ICON.client}DÉSIGNATIONS CLIENT</span>
            <span class="blk-tools">
              <button type="button" class="blk-btn" data-blk="client" data-act="import" title="Importer"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <button type="button" class="blk-btn" data-blk="client" data-act="export" title="Exporter"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10V2M4.5 5.5 8 2l3.5 3.5M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <button type="button" class="blk-btn" data-blk="client" data-act="pdf" title="Aperçu PDF"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5h5.5L12.5 4.5v10h-8.5z M9.5 1.5v3h3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6 8.5h4.5M6 11h4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>
              ${INST_LIVE && (budget.inst.state || "instance") === "instance" ? `<button type="button" class="blk-btn" data-blk="client" data-act="copy" title="Copier les lignes cochées">${SVI_COPY_ICON}</button><button type="button" class="blk-btn" data-blk="client" data-act="cut" title="Couper les lignes cochées">${SVI_CUT_ICON}</button><button type="button" class="blk-btn" data-blk="client" data-act="paste" title="Coller">${SVI_PASTE_ICON}</button>` : ""}
              ${INST_LIVE && (budget.inst.state || "instance") === "instance" ? `<button type="button" class="blk-btn" data-blk="client" data-act="del" title="Supprimer les lignes cochées">${SVI_DEL_ICON}</button>` : ""}
              <button type="button" class="blk-btn blk-max-btn" data-blk="client" data-act="max" title="Agrandir / réduire"><svg class="ic-max" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6.5v-4h4M2.5 2.5l4.5 4.5M13.5 9.5v4h-4M13.5 13.5 9 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><svg class="ic-min" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M7 3v4H3M7 7 2.5 2.5M9 13V9h4M9 9l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            </span>
          </div>
          <div class="bdg-d-scroll bdg-d-client-scroll">
            <table class="bdg-d-table">
              <colgroup id="bdgClientCols"></colgroup>
              <thead id="bdgClientHead"></thead>
              <tbody id="bdgClientBody"></tbody>
              <tfoot id="bdgClientFoot"></tfoot>
            </table>
          </div>
        </div>

        <div class="bdg-d-block blk-hier">
          <div class="bdg-d-block-title blk-head">
            <span class="ttl">${SVI_ICON.hier}TÂCHES</span>
            <span class="blk-tools">
              <button type="button" class="blk-btn" data-blk="hier" data-act="import" title="Importer"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <button type="button" class="blk-btn" data-blk="hier" data-act="export" title="Exporter"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10V2M4.5 5.5 8 2l3.5 3.5M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <button type="button" class="blk-btn" data-blk="hier" data-act="pdf" title="Aperçu PDF"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5h5.5L12.5 4.5v10h-8.5z M9.5 1.5v3h3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6 8.5h4.5M6 11h4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>
              ${INST_LIVE && (budget.inst.state || "instance") === "instance" ? `<button type="button" class="blk-btn" data-blk="hier" data-act="copy" title="Copier les lignes cochées">${SVI_COPY_ICON}</button><button type="button" class="blk-btn" data-blk="hier" data-act="cut" title="Couper les lignes cochées">${SVI_CUT_ICON}</button><button type="button" class="blk-btn" data-blk="hier" data-act="paste" title="Coller">${SVI_PASTE_ICON}</button>` : ""}
              ${INST_LIVE && (budget.inst.state || "instance") === "instance" ? `<button type="button" class="blk-btn" data-blk="hier" data-act="del" title="Supprimer les lignes cochées">${SVI_DEL_ICON}</button>` : ""}
              <button type="button" class="blk-btn blk-max-btn" data-blk="hier" data-act="max" title="Agrandir / réduire"><svg class="ic-max" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6.5v-4h4M2.5 2.5l4.5 4.5M13.5 9.5v4h-4M13.5 13.5 9 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><svg class="ic-min" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M7 3v4H3M7 7 2.5 2.5M9 13V9h4M9 9l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            </span>
          </div>
          <div class="bdg-h-grid" id="bdgHier"></div>
        </div>

        <div class="bdg-d-tabs" id="bdgTabs">
          ${
            tabs.map(t => `
              <button
                type="button"
                class="bdg-d-tab"
                data-tab="${t.key}"
              >
                ${SVI_ICON[t.ico || t.key] || ""}${t.title}
              </button>
            `).join("")
          }
          <span class="blk-tools">
              <button type="button" class="blk-btn" data-blk="detail" data-act="import" title="Importer"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <button type="button" class="blk-btn" data-blk="detail" data-act="export" title="Exporter"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10V2M4.5 5.5 8 2l3.5 3.5M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <button type="button" class="blk-btn" data-blk="detail" data-act="pdf" title="Aperçu PDF"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5h5.5L12.5 4.5v10h-8.5z M9.5 1.5v3h3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6 8.5h4.5M6 11h4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>
              ${INST_LIVE && (budget.inst.state || "instance") === "instance" ? `<button type="button" class="blk-btn" data-blk="detail" data-act="copy" title="Copier les lignes cochées">${SVI_COPY_ICON}</button><button type="button" class="blk-btn" data-blk="detail" data-act="cut" title="Couper les lignes cochées">${SVI_CUT_ICON}</button><button type="button" class="blk-btn" data-blk="detail" data-act="paste" title="Coller">${SVI_PASTE_ICON}</button>` : ""}
              ${INST_LIVE && (budget.inst.state || "instance") === "instance" ? `<button type="button" class="blk-btn" data-blk="detail" data-act="del" title="Supprimer les lignes cochées">${SVI_DEL_ICON}</button>` : ""}
              <button type="button" class="blk-btn blk-cfg-btn" data-blk="detail" data-act="cfg" title="RÉGLAGES DU GRAPHIQUE" aria-label="Réglages du graphique">⚙</button>
              <button type="button" class="blk-btn blk-adj-btn" data-blk="detail" data-act="adj" title="GÉNÉRER / COMPRESSER" aria-label="Générer ou compresser"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.5M13 2.5v3h-3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <button type="button" class="blk-btn blk-max-btn" data-blk="detail" data-act="max" title="Agrandir / réduire"><svg class="ic-max" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6.5v-4h4M2.5 2.5l4.5 4.5M13.5 9.5v4h-4M13.5 13.5 9 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><svg class="ic-min" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M7 3v4H3M7 7 2.5 2.5M9 13V9h4M9 9l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            </span>
        </div>

        <div class="bdg-d-block bdg-d-tabbody" id="bdgTabBody"></div>

        <div class="bdg-d-block blk-rec blk-scn" data-rec="scn" hidden>
          <div class="bdg-d-block-title blk-head">
            <span class="ttl" id="scnTitle">${SVI_ICON.scn}SCÉNARIOS</span>
            <span class="blk-tools">
              <button type="button" class="blk-btn" data-blk="scn" data-act="view" title="Comparer les scénarios"></button>
              <button type="button" class="blk-btn" data-blk="scn" data-act="export" title="Exporter"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10V2M4.5 5.5 8 2l3.5 3.5M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <button type="button" class="blk-btn" data-blk="scn" data-act="pdf" title="Aperçu PDF"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5h5.5L12.5 4.5v10h-8.5z M9.5 1.5v3h3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6 8.5h4.5M6 11h4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>
              <button type="button" class="blk-btn blk-max-btn" data-blk="scn" data-act="max" title="Agrandir / réduire"><svg class="ic-max" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6.5v-4h4M2.5 2.5l4.5 4.5M13.5 9.5v4h-4M13.5 13.5 9 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><svg class="ic-min" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M7 3v4H3M7 7 2.5 2.5M9 13V9h4M9 9l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            </span>
          </div>
          <div class="rec-scroll scn-scroll"><table class="bdg-d-table rec-table scn-table" id="scnTable"></table></div>
        </div>

        <div class="bdg-d-block blk-rec blk-suivi" data-rec="suivi">
          <div class="bdg-d-block-title blk-head">
            <span class="rec-tabs">
              <button type="button" class="rec-tab" data-rtab="doc" id="recTitle-doc">${SVI_ICON.doc}DOCUMENTS ${svCnt(0)}</button>
              <button type="button" class="rec-tab" data-rtab="taf" id="recTitle-taf">${SVI_ICON.taf}TAF ${svCnt(0)}</button>
              <button type="button" class="rec-tab" data-rtab="obs" id="recTitle-obs">${SVI_ICON.obs}OBSERVATIONS ${svCnt(0)}</button>
            </span>
            <span class="blk-tools">
              <button type="button" class="blk-btn" data-blk="suivi" data-act="export" title="Exporter"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10V2M4.5 5.5 8 2l3.5 3.5M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <button type="button" class="blk-btn" data-blk="suivi" data-act="pdf" title="Aperçu PDF"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5h5.5L12.5 4.5v10h-8.5z M9.5 1.5v3h3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6 8.5h4.5M6 11h4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>
              <button type="button" class="blk-btn blk-max-btn" data-blk="suivi" data-act="max" title="Agrandir / réduire"><svg class="ic-max" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6.5v-4h4M2.5 2.5l4.5 4.5M13.5 9.5v4h-4M13.5 13.5 9 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><svg class="ic-min" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M7 3v4H3M7 7 2.5 2.5M9 13V9h4M9 9l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            </span>
          </div>
          <div class="rec-scroll" data-pane="doc"><table class="bdg-d-table rec-table" id="recTable-doc"></table></div>
          <div class="rec-scroll" data-pane="taf" hidden><table class="bdg-d-table rec-table" id="recTable-taf"></table></div>
          <div class="rec-scroll" data-pane="obs" hidden><table class="bdg-d-table rec-table" id="recTable-obs"></table></div>
        </div>


      </div>
    `;

    const body = $("bdgTabBody");

