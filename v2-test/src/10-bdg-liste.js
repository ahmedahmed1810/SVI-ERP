/* =========================================================
   BDG — LISTE
   ========================================================= */

function renderBudgetList() {
  const table =
    $("budgetListTable");

  if (!table) return;

  const shell =
    table.closest(
      ".novapp-list-shell"
    );

  if (!shell) return;

  /* -------------------------------------------------------
     STYLE SPÉCIFIQUE À LA LISTE
     ------------------------------------------------------- */

  if (!$("bdgListRuntimeStyle")) {
    const style =
      document.createElement("style");

    style.id =
      "bdgListRuntimeStyle";

    style.textContent = `

      .novapp-budget-table-wrap {
        position: relative;
        max-height: calc(100vh - 150px);
        overflow: auto !important;
        -webkit-overflow-scrolling: touch;
      }

      #budgetListTable {
        table-layout: fixed;
        width: 100%;
        min-width: 1050px;
      }

      #budgetListTable thead th {
        position: sticky;
        top: 0;
        z-index: 20;
        background: #f3f4f6;
        overflow: visible;
        user-select: none;
      }

      #budgetListTable td {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .bdg-list-head {
        position: relative;
      }

      .bdg-head-content {
        display: flex;
        align-items: center;
        width: 100%;
        gap: 3px;
        min-width: 0;
      }

      .bdg-head-label {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .bdg-head-action {
        width: 22px;
        min-width: 22px;
        height: 24px;
        padding: 0;
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: #687281;
        cursor: pointer;
        font-size: 12px;
        line-height: 24px;
        text-align: center;
        text-transform: none;
      }

      .bdg-head-action:hover {
        background: #e3e7ec;
        color: #222b38;
      }

      .bdg-column-search {
        width: 100%;
        min-width: 50px;
        height: 26px;
        padding: 2px 7px;
        border: 1px solid #9ca7b6;
        border-radius: 5px;
        outline: none;
        background: #fff;
        color: #303947;
        font-size: 10px;
        font-weight: 700;
        text-transform: none;
      }

      .bdg-column-search:focus {
        border-color: #1769c2;
      }

      .bdg-column-resizer {
        position: absolute;
        top: 0;
        right: -4px;
        z-index: 40;
        width: 8px;
        height: 100%;
        cursor: col-resize;
        touch-action: none;
      }

      .bdg-column-resizer:hover,
      .bdg-column-resizer.active {
        background:
          rgba(23,105,194,.18);
      }

      #budgetListTable .number {
        text-align: right;
      }

      #budgetListTable
      .bdg-action-cell {
        text-align: center;
        padding-left: 3px;
        padding-right: 3px;
        overflow: visible;
      }

      .bdg-row-action {
        width: 27px;
        height: 27px;
        padding: 0;
        margin: 0 1px;
        border: 0;
        border-radius: 5px;
        background: transparent;
        color: #5f6875;
        cursor: pointer;
        font-size: 16px;
        text-transform: none;
      }

      .bdg-row-action:hover {
        background: #edf1f5;
      }

      #budgetListTable tbody tr[data-budget-ref] {
        cursor: pointer;
      }

      #budgetListTable tbody tr[data-budget-ref]:hover {
        background: #f8fafc;
      }

      .bdg-popup-back {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(15,23,42,.45);
      }

      .bdg-popup {
        width: 100%;
        max-width: 460px;
        border-radius: 14px;
        background: #fff;
        box-shadow: 0 20px 50px rgba(0,0,0,.3);
        overflow: hidden;
      }

      .bdg-popup-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: #f3f4f6;
        border-bottom: 1px solid #e1e5eb;
        font-size: 12px;
        font-weight: 800;
      }

      .bdg-popup-close {
        width: 30px;
        height: 30px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        font-size: 16px;
        cursor: pointer;
      }

      .bdg-popup-body {
        padding: 16px;
      }

      .bdg-popup-field {
        margin-bottom: 12px;
      }

      .bdg-popup-field label {
        display: block;
        margin-bottom: 4px;
        color: #6b7480;
        font-size: 10px;
        font-weight: 800;
      }

      .bdg-popup-field div {
        min-height: 32px;
        padding: 7px 10px;
        border: 1px solid #dfe4eb;
        border-radius: 8px;
        background: #fafbfc;
        font-size: 12px;
        font-weight: 700;
      }

      .bdg-popup-note {
        color: #8a93a0;
        font-size: 10px;
      }


      .bdg-d-page { padding: 18px 28px 40px; }

      /* haut de l'écran figé : titre ☰ → pastilles DOC/TAF/OBS/INF */
      .bdg-d-sticky {
        position: sticky;
        top: 0;
        z-index: 50;
        background: #fff;
        box-shadow: 0 2px 6px rgba(15, 23, 42, .06);
      }
      .bdg-d-head { padding: 14px 28px 4px; }
      .bdg-d-head .bdg-d-pills { margin-bottom: 10px; }

      .bdg-d-title {
        margin: 0 0 6px;
        font-size: 30px;
        font-weight: 900;
        text-decoration: underline;
        text-underline-offset: 6px;
        text-transform: none;
      }

      .bdg-d-ref {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
        color: #3f4856;
        font-size: 24px;
        font-weight: 800;
      }

      .bdg-d-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #e8edf3;
        color: #5f6875;
        font-size: 11px;
        font-weight: 900;
      }

      .bdg-d-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 20px;
      }

      .bdg-d-pill {
        padding: 6px 14px;
        border: 1px solid #dfe4eb;
        border-radius: 999px;
        background: #fff;
        color: #4b5563;
        font-size: 12px;
        font-weight: 800;
      }

      .bdg-d-block {
        margin-bottom: 18px;
        border: 1px solid #e1e5eb;
        border-radius: 12px;
        background: #fff;
        overflow: hidden;
      }

      .bdg-d-block-title {
        padding: 9px 14px;
        background: #f3f4f6;
        border-bottom: 1px solid #e1e5eb;
        font-size: 11px;
        font-weight: 900;
      }

      .bdg-d-scroll {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      .bdg-d-table {
        min-width: 0;
        table-layout: fixed;
        border-collapse: collapse;
        font-size: 11px;
      }
      .bdg-d-table th, .bdg-d-table td {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      /* FORMAT 113 : zone de réglage large au toucher (trait fin à l'œil) */
      .col-rs {
        position: absolute; top: 0; right: 0; width: 16px; height: 100%;   /* v494 (remarque 22) : partagé avec la loupe (qui passe devant) */
        cursor: col-resize; z-index: 4; touch-action: none;
      }
      .col-rs::after {
        content: ""; position: absolute; top: 3px; bottom: 3px; right: 0;
        width: 1px; background: #cfd6df;
      }
      .col-rs.on::after { background: #1d4ed8; width: 3px; }
      .col-rs.on { background: rgba(29, 78, 216, .08); }

      .bdg-d-table th,
      .bdg-d-table td {
        padding: 3px 10px;
        line-height: 1.25;
        border-bottom: 1px solid #edf0f4;
        text-align: left;
        white-space: nowrap;
      }

      .bdg-d-table th {
        position: sticky;
        top: 0;
        z-index: 2;
        background: #fafbfc;
        color: #6b7480;
        font-size: 10px;
      }

      .bdg-d-table .number { text-align: right; }
      .bdg-d-table .center { text-align: center; }

      .bdg-d-table .empty {
        text-align: center;
        color: #9aa3af;
      }

      .bdg-tva-input {
        width: 52px;
        height: 18px;
        box-sizing: border-box;
        padding: 0 4px;
        border: 1px solid #cfd6df;
        border-radius: 6px;
        text-align: right;
        font-size: 11px;
      }

      .bdg-d-reserved {
        padding: 22px 14px;
        color: #9aa3af;
        font-size: 11px;
      }

      .bdg-d-totals {
        margin-left: auto;
        max-width: 340px;
        border: 1px solid #e1e5eb;
        border-radius: 12px;
        background: #fff;
        overflow: hidden;
      }

      .bdg-d-totals div {
        display: flex;
        justify-content: space-between;
        padding: 9px 14px;
        border-bottom: 1px solid #edf0f4;
        font-size: 11px;
        font-weight: 800;
      }

      .bdg-d-total-ttc {
        background: #dcecff;
        border-bottom: 0 !important;
      }

      /* même hauteur de ligne (21 px) pour tous les tableaux de l'écran :
         désignations client, détail charge / produit, lots / tâches */
      .bdg-d-table th,
      .bdg-d-table td {
        padding: 2px 8px !important;
        line-height: 16px !important;
        font-size: 12px !important;
        height: 21px;
        box-sizing: border-box;
        white-space: nowrap;
      }
      .bdg-d-table tbody tr.bdg-d-filler td { height: 21px; }
      .bdg-d-table th { font-size: 11px !important; }
      .bdg-tva-input {
        width: 100% !important;
        height: 16px !important;
        line-height: 16px;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        color: inherit;
        font: inherit;
        text-align: right;
      }
      .bdg-tva-input:focus {
        outline: 1px solid #93b4e8;
        background: #fff !important;
      }

      #whyTip {
        position: fixed; z-index: 10002; padding: 8px 10px; border-radius: 8px;
        background: #1f2937; color: #fff; font-size: 12px; line-height: 1.35;
        box-shadow: 0 6px 18px rgba(0,0,0,.2);
      }
      .bdg-d-table td[data-why] { cursor: help; }

      .bdg-d-pill-btn { cursor: pointer; }
      .bdg-d-pill-btn:hover { background: #eef1f6; }
      #docPop {
        position: fixed; inset: 0; z-index: 10003; background: rgba(15,23,42,.45);
        display: flex; align-items: center; justify-content: center; padding: 16px;
      }
      #docPop .doc-card {
        width: 100%; max-width: 760px; background: #fff; border-radius: 10px;
        box-shadow: 0 18px 40px rgba(0,0,0,.25); overflow: hidden; color: #172033;
        font-size: 12px;
      }
      #docPop .doc-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 18px; border-bottom: 1px solid #e5e9ef;
      }
      #docPop .doc-title { font-size: 13px; font-weight: 800; }
      #docPop .doc-x { border: 0; background: none; font-size: 16px; cursor: pointer; color: #374151; }
      #docPop .doc-body { padding: 16px 18px 12px; }
      #docPop .doc-grid {
        display: grid; grid-template-columns: max-content 1fr max-content 1fr; gap: 12px 12px; align-items: center;
      }
      #docPop .doc-lab { font-size: 11px; font-weight: 800; color: #4b5563; }
      #docPop .doc-lab b { color: #dc2626; }
      #docPop .doc-in {
        height: 34px; border: 1px solid #d6dbe3; border-radius: 6px; padding: 0 10px;
        font-size: 12px; font-family: inherit; color: #172033; background: #fff; min-width: 0;
      }
      #docPop .doc-in:focus { outline: none; border-color: #60a5fa; box-shadow: 0 0 0 3px #dbeafe; }
      #docPop .doc-in.bad, #docPop .doc-file.bad .doc-btn { border-color: #f87171; background: #fef2f2; }
      #docPop .doc-file { grid-column: 2 / 5; display: flex; align-items: center; gap: 12px; }
      #docPop .doc-fname { font-size: 11px; color: #6b7280; }
      #docPop .doc-fname.ok { color: #172033; font-weight: 700; }
      #docPop .doc-btn {
        height: 34px; padding: 0 16px; border: 1px solid #d6dbe3; border-radius: 6px;
        background: #fff; font-size: 12px; font-weight: 800; cursor: pointer; color: #172033;
      }
      #docPop .doc-save { background: #eef3fb; border-color: #9fb6d9; }
      #docPop .doc-grid-2 { grid-template-columns: max-content 1fr; }
      #docPop .doc-grid-2 > .doc-lab { margin-left: 0 !important; }
      #docPop .doc-grid > .doc-lab:nth-child(4n+3) { margin-left: 12px; }
      #docPop .doc-lab { white-space: nowrap; }
      /* libellé aligné sur la 1re ligne du champ, même si le champ est agrandi */
      #docPop .doc-grid { align-items: start; }
      #docPop .doc-grid > .doc-lab { padding-top: 10px; }
      #docPop .doc-row { display: flex; align-items: center; gap: 10px; }
      #docPop .doc-row .doc-in { flex: 1; }
      #docPop .doc-ta { height: 90px; padding: 8px 10px; resize: vertical; line-height: 1.4; }
      #docPop .doc-ta-s { height: 34px; padding: 7px 10px; }
      #docPop .doc-ro { background: #f3f5f8; color: #374151; }
      #docPop .doc-flag {
        width: 34px; height: 34px; border: 1px solid #d6dbe3; border-radius: 6px; background: #fff;
        font-size: 16px; font-weight: 900; cursor: pointer; color: #374151;
      }
      #docPop .doc-flag.on { background: #fee2e2; border-color: #f87171; color: #b91c1c; }
      /* fenêtre et champs réglables */
      #docPop .doc-card { position: relative; display: flex; flex-direction: column; max-height: calc(100vh - 32px); }
      #docPop .doc-card .doc-body { flex: 1 1 auto; overflow: auto; }
      #docPop .pop-rsz {
        position: absolute; right: 2px; bottom: 2px; width: 18px; height: 18px; cursor: nwse-resize;
        touch-action: none; z-index: 2;
        background: linear-gradient(135deg, transparent 50%, #9aa3af 50%, #9aa3af 58%, transparent 58%,
          transparent 70%, #9aa3af 70%, #9aa3af 78%, transparent 78%);
      }
      #docPop .fld-wrap { position: relative; display: block; min-width: 0; }
      #docPop .fld-wrap.sized { justify-self: start; max-width: none; }
      #docPop .fld-wrap.in-row { flex: 1; }
      #docPop .fld-wrap.in-row.sized { flex: none; }
      /* le champ remplit exactement son cadre : la poignée tombe sur son coin */
      #docPop .fld-wrap { display: flex; flex-direction: column; align-items: stretch; line-height: normal; }
      #docPop .fld-wrap > .doc-in { width: 100%; min-width: 0; max-width: 100%; box-sizing: border-box; margin: 0; }
      #docPop .fld-wrap > input.doc-in { display: block; }
      /* iPad : les champs date / heure gardent sinon leur propre largeur */
      #docPop .fld-wrap > input[type="date"],
      #docPop .fld-wrap > input[type="time"],
      #docPop .fld-wrap > input[type="datetime-local"] {
        -webkit-appearance: none; appearance: none; text-align: left; line-height: 32px;
      }
      #docPop .fld-wrap > input::-webkit-date-and-time-value { text-align: left; margin: 0; }
      /* date affichée JJ/MM/AAAA À HH:MM ; le vrai champ, transparent, est dessus */
      #docPop .fld-wrap { position: relative; }
      #docPop .dt-show { display: block; line-height: 32px; white-space: nowrap; overflow: hidden; cursor: pointer; }
      #docPop .dt-native {
        position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; z-index: 1;
        margin: 0; border: 0; padding: 0; cursor: pointer; font-size: 16px;
      }
      #docPop .fld-wrap:has(.dt-native:focus) .dt-show { border-color: #60a5fa; box-shadow: 0 0 0 3px #dbeafe; }
      #docPop .fld-wrap:has(.dt-native.bad) .dt-show { border-color: #f87171; background: #fef2f2; }
      #docPop .fld-rsz { z-index: 2; }
      #docPop .fld-wrap > textarea.doc-in { display: block; resize: none; }
      #docPop .fld-rsz {
        position: absolute; right: 1px; bottom: 1px; width: 12px; height: 12px; cursor: nwse-resize;
        touch-action: none; opacity: .55;
        background: linear-gradient(135deg, transparent 55%, #6b7280 55%, #6b7280 65%, transparent 65%,
          transparent 78%, #6b7280 78%, #6b7280 88%, transparent 88%);
      }
      #docPop .fld-rsz:hover { opacity: 1; }
      #docPop .doc-err { color: #b42318; font-size: 11px; min-height: 14px; margin-top: 10px; }
      #docPop .fd-msg { color: #6b7280; }
      #docPop .exp-drv-row { display: flex; align-items: center; gap: 10px; min-height: 34px; }
      #docPop .exp-drv-row > .doc-in { flex: 1; }
      #docPop .exp-drv-row > .fld-wrap { flex: 1; min-width: 0; }
      #docPop .exp-path { color: #1d4ed8; text-decoration: underline; font-weight: 700; text-transform: none; cursor: pointer; }
      #docPop .exp-path[readonly] { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
      #docPop .exp-path.editing { cursor: text; text-decoration: none; color: #172033; }
      #docPop .drv-link { flex: 1; color: #1d4ed8; text-decoration: underline; font-size: 12px; font-weight: 700;
        word-break: break-all; text-transform: none; }
      #drvPop {
        position: fixed; inset: 0; z-index: 10010; background: rgba(15,23,42,.35);
        display: flex; align-items: center; justify-content: center; padding: 16px;
      }
      #drvPop .dp-card { width: 100%; max-width: 560px; background: #fff; border-radius: 10px; overflow: hidden;
        box-shadow: 0 18px 40px rgba(0,0,0,.3); color: #172033; font-size: 12px; }
      #drvPop .dp-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px;
        border-bottom: 1px solid #e5e9ef; font-size: 13px; font-weight: 800; }
      #drvPop .dp-x { border: 0; background: none; font-size: 16px; cursor: pointer; color: #374151; }
      #drvPop .dp-body { padding: 18px; }
      #drvPop .dp-row { display: flex; align-items: center; gap: 10px; min-height: 34px; }
      #drvPop .dp-row[hidden] { display: none; }
      #drvPop .dp-link { flex: 1; color: #1d4ed8; text-decoration: underline; font-size: 13px; font-weight: 700;
        word-break: break-all; cursor: pointer; }
      #drvPop .dp-edit { width: 34px; height: 34px; border: 1px solid #d6dbe3; border-radius: 6px; background: #fff;
        font-size: 16px; cursor: pointer; color: #374151; flex: none; }
      #drvPop .dp-in { width: 100%; box-sizing: border-box; height: 34px; border: 1px solid #60a5fa; border-radius: 6px;
        padding: 0 10px; font-size: 12px; box-shadow: 0 0 0 3px #dbeafe; outline: none; }
      #drvPop .dp-in[hidden] { display: none; }
      #drvPop .dp-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 18px;
        border-top: 1px solid #e5e9ef; background: #fafbfc; }
      #drvPop .dp-btn { height: 34px; padding: 0 16px; border: 1px solid #d6dbe3; border-radius: 6px; background: #fff;
        font-size: 12px; font-weight: 800; cursor: pointer; color: #172033; }
      #drvPop .dp-ok { background: #eef3fb; border-color: #9fb6d9; }
      #docPop .fd-msg.ok { color: #15803d; font-weight: 700; }
      #docPop .fd-msg a { color: #1d4ed8; font-weight: 800; }
      #docPop .doc-btn:disabled { opacity: .5; cursor: default; }
      #docPop .doc-foot {
        display: flex; justify-content: flex-end; gap: 10px; padding: 12px 18px;
        border-top: 1px solid #e5e9ef; background: #fafbfc;
      }
      @media (max-width: 650px) {
        #docPop .doc-grid { grid-template-columns: 1fr; }
        #docPop .doc-file { grid-column: auto; }
      }

      /* agrandissement d'un bloc */
      .blk-max-btn .ic-min { display: none; }
      .blk-max-btn.on .ic-max { display: none; }
      .blk-max-btn.on .ic-min { display: inline; }
      .blk-max-btn.on { background: #dbeafe; color: #1d4ed8; }
      .bdg-d-page.max-client > .blk-hier,
      .bdg-d-page.max-client > #bdgTabs,
      .bdg-d-page.max-client > #bdgTabBody,
      .bdg-d-page.max-hier > .blk-client,
      .bdg-d-page.max-hier > #bdgTabs,
      .bdg-d-page.max-hier > #bdgTabBody,
      .bdg-d-page.max-detail > .blk-client,
      .bdg-d-page.max-detail > .blk-hier { display: none !important; }
      .bdg-d-page.max-client .bdg-d-block > .bdg-d-scroll.bdg-d-client-scroll {
        height: calc(var(--avail) - 50px) !important;
        max-height: none !important;
      }
      .bdg-d-page.max-hier .bdg-h-col { height: calc(var(--avail) - 70px) !important; max-height: none !important; }
      .bdg-d-page.max-detail .bdg-d-tabbody .bdg-d-scroll {
        height: calc(var(--avail) - 60px) !important;
        max-height: none !important;
      }

      /* déplacement des colonnes par glissement de l'en-tête */
      /* iPad : pas de défilement depuis un en-tête, sinon le glissement est interrompu */
      .bdg-d-table thead th, .bdg-h-head {
        touch-action: none; cursor: grab;
        user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
      }
      .bdg-d-table thead th.co-src, .bdg-h-head.co-src { opacity: .45; }
      .bdg-d-table thead th.co-before, .bdg-h-head.co-before { box-shadow: inset 3px 0 0 #1d4ed8; }
      .bdg-d-table thead th.co-after, .bdg-h-head.co-after { box-shadow: inset -3px 0 0 #1d4ed8; }
      #coGhost {
        position: fixed; z-index: 10010; pointer-events: none; padding: 5px 10px;
        background: #1d4ed8; color: #fff; border-radius: 6px; font-size: 11px; font-weight: 800;
        box-shadow: 0 6px 16px rgba(0,0,0,.2);
      }

      /* disposition des blocs : ordre par glissement, hauteur réglable */
      .bdg-d-page { display: flex; flex-direction: column; }
      .bdg-d-page > * { min-width: 0; }
      #bdgTabBody { margin-bottom: 0; }
      .blk-rsz {
        height: 14px; cursor: ns-resize; touch-action: none; position: relative;
        background: #fafbfc; border-top: 1px solid #edf0f4;
      }
      .blk-rsz::after {
        content: ""; position: absolute; left: 50%; top: 5px; width: 36px; height: 4px;
        margin-left: -18px; border-radius: 2px; background: #c3cad5;
      }
      .blk-rsz.on::after, .blk-rsz:hover::after { background: #1d4ed8; }
      #bdgDetailRsz {
        margin-bottom: 18px; border: 1px solid #e1e5eb; border-top: 0;
        border-radius: 0 0 12px 12px;
      }
      #bdgTabBody { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
      .bdg-d-page[class*="max-"] .blk-rsz { display: none !important; }
      .blk-grip {
        display: inline-flex; align-items: center; justify-content: center;
        width: 22px; height: 22px; margin-right: 6px; border-radius: 5px;
        color: #8a93a0; cursor: grab; touch-action: none; font-size: 14px; line-height: 1;
        flex: none; user-select: none; -webkit-user-select: none;
      }
      .blk-grip:hover { background: #e5e9ef; color: #1d4ed8; }
      .bdg-d-page .blk-head { justify-content: flex-start; }
      #bdgTabs .blk-grip { align-self: center; }
      .lay-src { opacity: .5; }
      .lay-before { box-shadow: 0 -4px 0 #1d4ed8; }
      .lay-after { box-shadow: 0 4px 0 #1d4ed8; }
      .bdg-lay-btn {
        width: 40px; height: 40px; padding: 0; justify-content: center; border: 1px solid #d6dbe3; border-radius: 10px;
        background: #fff; color: #4b5563; font-size: 11px; font-weight: 800; cursor: pointer;
        display: inline-flex; align-items: center; gap: 6px;
      }
      .bdg-lay-btn[hidden] { display: none; }

      /* titres de blocs plus bas */
      .bdg-d-page .bdg-d-block-title { padding: 3px 10px 3px 8px; min-height: 28px; box-sizing: border-box; }
      .bdg-d-page .blk-btn { width: 24px; height: 22px; }
      .bdg-d-page .blk-grip { width: 18px; height: 18px; margin-right: 4px; }
      .bdg-d-page .bdg-d-tab { padding: 6px 14px; }

      /* thème sobre : une seule couleur d'accent (bleu marine) */
      .bdg-d-sticky .bdg-d-ref { color: #12355b; }
      .bdg-d-sticky .bdg-d-badge { background: #12355b; color: #fff; }
      .bdg-d-pill .ico, .rec-tab .ico, .bdg-d-tab .ico, .blk-head .ttl .ico { color: #12355b; opacity: 1; }
      .bdg-d-page .bdg-d-block-title { border-left: 4px solid #12355b; }
      .bdg-d-page .bdg-d-tab.active { color: #12355b; box-shadow: inset 0 -3px 0 #12355b; }
      .bdg-d-page .rec-tab.active { color: #12355b; }
      .bdg-d-page .bdg-d-table tfoot td,
      .bdg-d-page .bdg-d-total-row td { background: #e7edf5 !important; color: #12355b; }
      #bdgClientBody td:last-child, #bdgTabBody tbody td:last-child { color: #12355b; font-weight: 800; }
      .bdg-d-page .bdg-d-table tbody tr:nth-child(even) td:not(.cell-warn) { background: #fbfcfe; }

      /* glisser une ligne pour changer son ordre */
      #bdgClientBody tr[data-desig], .bdg-h-item[data-h] {
        -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
      }
      #bdgClientBody tr.ro-src td, .bdg-h-item.ro-src { background: #e7edf5 !important; opacity: .7; }
      #bdgClientBody tr.ro-before td { box-shadow: inset 0 3px 0 #12355b; }
      #bdgClientBody tr.ro-after td { box-shadow: inset 0 -3px 0 #12355b; }
      .bdg-h-item.ro-before { box-shadow: inset 0 3px 0 #12355b; }
      .bdg-h-item.ro-after { box-shadow: inset 0 -3px 0 #12355b; }

      /* « ! » d'une observation (activer / désactiver) et case EXPIRÉ des documents */
      .rec-flag { width: 22px; height: 15px; border: 1px solid #d6dbe3; border-radius: 4px; background: #fff;
        color: #c3c9d2; font-weight: 900; cursor: pointer; padding: 0; line-height: 13px; font-size: 11px; vertical-align: middle; }
      .rec-table td { height: 21px; box-sizing: border-box; }
      .rec-exp { margin: 0; vertical-align: middle; }
      .rec-flag.on { color: #b91c1c; border-color: #f3a5a5; background: #fff5f5; }
      .rec-exp { width: 16px; height: 16px; accent-color: var(--svst); cursor: pointer; }
      .rec-exp:disabled { cursor: not-allowed; opacity: 1; }
      /* alertes : 5 lignes à l'ouverture, plus si la fenêtre est agrandie */
      #docPop .obs-alert-list { max-height: calc(5 * 40px + 4 * 6px); }
      #docPop .doc-card[style*="height"] .obs-alert-list { max-height: none; }
      #docPop .doc-card[style*="height"] .doc-body { display: flex; flex-direction: column; }
      #docPop .doc-card[style*="height"] .obs-alert-list { flex: 1; min-height: 0; }

      /* choix du format (détail produits) */
      #docPop .fmt-choice { display: flex; flex-direction: column; gap: 10px; }
      #docPop .fmt-btn { height: auto; padding: 14px 16px; text-align: left; display: flex; flex-direction: column; gap: 4px; }
      #docPop .fmt-btn small { font-size: 10px; font-weight: 600; color: #6b7280; }
      #docPop .fmt-btn:hover { background: #eef3fb; border-color: #9fb6d9; }
      #docPop .fmt-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 16px; }
      #docPop .fmt-grid .fmt-btn { align-items: center; text-align: center; padding: 12px 8px; }
      #docPop .fmt-btn.on { background: #1d4ed8; border-color: #1d4ed8; color: #fff; }
      @media (max-width: 650px) { #docPop .fmt-grid { grid-template-columns: 1fr 1fr; } }

      /* historique */
      #docPop .hist-card { max-width: 980px; }
      #docPop .hist-card.hist-max { max-width: none; width: calc(100vw - 32px); height: calc(100vh - 32px); }
      #docPop .hist-card.hist-max .hist-scroll { max-height: none; flex: 1; }
      #docPop .hist-card.hist-max .doc-body { display: flex; flex-direction: column; }
      #docPop .hist-tools { display: flex; align-items: center; gap: 6px; }
      #docPop .hist-table { table-layout: auto; width: 100%; }
      #docPop .hist-table td { white-space: normal; vertical-align: top; }
      #docPop .hist-table td.center { text-align: center; white-space: nowrap; }
      #docPop .hist-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
      #docPop .hist-f { border: 1px solid #d6dbe3; background: #fff; border-radius: 999px; padding: 5px 12px;
        font-size: 11px; font-weight: 800; color: #4b5563; cursor: pointer; }
      #docPop .hist-f.on { background: #12355b; color: #fff; border-color: #12355b; }
      #docPop .hist-scroll { max-height: 55vh; overflow: auto; border: 1px solid #e5e9ef; border-radius: 8px; }
      #docPop .hist-table { width: 100%; border-collapse: collapse; font-size: 12px; }
      #docPop .hist-table th { position: sticky; top: 0; background: #f6f8fb; color: #3d4a5c; text-align: left;
        font-size: 11px; padding: 6px 10px; border-bottom: 1px solid #e5e9ef; }
      #docPop .hist-table td { padding: 5px 10px; border-bottom: 1px solid #f0f2f5; vertical-align: top; }
      #docPop .hist-table td:first-child { white-space: nowrap; }
      #docPop .hist-table td.empty { text-align: center; color: #9aa3af; padding: 14px; }
      #histBtn { cursor: pointer; }

      /* options d'impression : choix OUI / NON */
      #docPop .po-card { max-width: 460px; }
      #docPop .po-yn { display: inline-flex; border: 1px solid #d6dbe3; border-radius: 8px; overflow: hidden; width: max-content; }
      #docPop .po-yn button {
        border: 0; background: #fff; padding: 8px 18px; font-size: 12px; font-weight: 800; color: #4b5563; cursor: pointer;
      }
      #docPop .po-yn button + button { border-left: 1px solid #d6dbe3; }
      #docPop .po-yn button.on { background: #12355b; color: #fff; }

      /* icônes de contenu */
      .bdg-d-pill, .rec-tab, .bdg-d-tab, .blk-head .ttl { display: inline-flex; align-items: center; gap: 6px; }
      .ico { flex: none; opacity: .85; }
      .bdg-d-pill .ico { width: 15px; height: 15px; }

      /* un seul bouton d'actions par bloc */
      .blk-tools .blk-btn { display: none !important; }
      /* v545 (remarque 1) : bouton AGRANDIR / RÉDUIRE toujours visible, juste à gauche du ⋯ ; foncé quand le bloc est agrandi */
      .blk-tools .blk-btn.blk-max-btn {
        display: inline-flex !important; width: 30px; height: 26px; padding: 0;
        background: #fff; color: #374151; border: 1px solid #d6dbe3; margin-right: 6px;
      }
      .blk-tools .blk-btn.blk-max-btn.on { background: #12355b; color: #fff; border-color: #12355b; }
      .blk-more {
        width: 28px; height: 22px; border: 1px solid #d6dbe3; border-radius: 6px; background: #fff;
        color: #374151; font-size: 16px; line-height: 18px; font-weight: 900; cursor: pointer; padding: 0;
      }
      .blk-more:hover { background: #eef1f6; color: #1d4ed8; }
      #blkMenu {
        position: fixed; z-index: 10005; background: #fff; border: 1px solid #d6dbe3; border-radius: 10px;
        box-shadow: 0 10px 28px rgba(15,23,42,.18); padding: 4px; display: flex; flex-direction: column; min-width: 170px;
        overflow-y: auto; -webkit-overflow-scrolling: touch;
      }
      #blkMenu button { flex: none; }
      #blkMenu .blk-hint { flex: none; padding: 6px 10px 8px; font-size: 10px; font-weight: 800; color: #6b7280; border-bottom: 1px solid #e5e9ef; margin-bottom: 2px; width: 0; min-width: 100%; box-sizing: border-box; line-height: 1.35; }
      #blkMenu button {
        display: flex; align-items: center; gap: 10px; border: 0; background: none; border-radius: 6px;
        padding: 8px 10px; font-size: 12px; font-weight: 700; color: #172033; cursor: pointer; text-align: left;
      }
      #blkMenu button:hover { background: #eef3fb; color: #1d4ed8; }
      #blkMenu .ic-min { display: none; }

      /* triangle « observations importantes » en haut à droite */
      .bdg-d-hright { margin-left: auto; display: flex; align-items: center; gap: 8px; }
      .bdg-alert-btn {
        position: relative; width: 40px; height: 40px; border: 1px solid #f3c2c2; border-radius: 10px;
        background: #fff5f5; color: #c81e1e; display: inline-flex; align-items: center;
        justify-content: center; cursor: pointer; padding: 0;
      }
      .bdg-alert-btn[hidden] { display: none; }
      .bdg-alert-n {
        position: absolute; top: -6px; right: -6px; min-width: 17px; height: 17px; padding: 0 4px;
        border-radius: 9px; background: #c81e1e; color: #fff; font-size: 10px; font-weight: 800;
        line-height: 17px; text-align: center; box-sizing: border-box;
      }
      #docPop .obs-alert-list { display: flex; flex-direction: column; gap: 10px; max-height: 60vh; overflow-y: auto; }
      #docPop .obs-alert-list { gap: 6px; }
      /* une alerte = une ligne ; toucher pour lire un texte long en entier */
      #docPop .obs-alert-item {
        border: 1px solid #f3c2c2; background: #fff5f5; border-radius: 8px; padding: 7px 12px;
        display: flex; align-items: baseline; gap: 10px; min-width: 0;
      }
      #docPop .obs-alert-meta { font-size: 11px; font-weight: 800; color: #b91c1c; white-space: nowrap; flex: none; }
      #docPop .obs-alert-text {
        font-size: 13px; color: #172033; line-height: 1.4; flex: 1; min-width: 0;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      #docPop .obs-alert-more { flex: none; color: #b91c1c; font-weight: 900; display: none; }
      #docPop .obs-alert-item.can-exp { cursor: pointer; }
      #docPop .obs-alert-item.can-exp .obs-alert-more { display: inline; }
      #docPop .obs-alert-item.open .obs-alert-text { white-space: pre-wrap; }
      #docPop .obs-alert-item.open .obs-alert-more { transform: rotate(180deg); }

      #docPop .inf-grid { row-gap: 10px; }
      #docPop .inf-val {
        display: block; min-height: 34px; box-sizing: border-box; padding: 8px 10px; height: auto;
        font-weight: 700; overflow: hidden; white-space: normal; word-break: break-word; line-height: 1.35;
      }
      #docPop .inf-neg { color: #b91c1c; }
      #docPop .doc-card .doc-body { max-height: 75vh; overflow-y: auto; }
      @media (max-width: 650px) { #docPop .inf-grid { grid-template-columns: 1fr; } }

      /* listes DOC / TAF / OBS : 5 lignes visibles, défilement au-delà */
      .rec-scroll { overflow: auto; -webkit-overflow-scrolling: touch; }
      .blk-suivi .rec-scroll { height: auto; max-height: var(--h-suivi, 129px); }
      .rec-scroll[hidden] { display: none !important; }
      .rec-tabs { display: inline-flex; gap: 4px; flex-wrap: wrap; }
      .rec-tab {
        border: 1px solid transparent; background: none; border-radius: 6px; padding: 3px 10px;
        font: inherit; font-weight: 900; color: #6b7480; cursor: pointer;
      }
      .rec-tab.active { background: #fff; border-color: #d6dbe3; color: #0f4f96; }
      .rec-tab.cf-on { color: #1d4ed8; }
      .rec-table td.center { text-align: center; }
      .rec-table td.number { text-align: right; }
      .rec-table .rec-imp { color: #b91c1c; font-weight: 900; }
      .rec-table .rec-late { color: #b91c1c; font-weight: 700; }
      .rec-table .rec-open {
        color: #1d4ed8; text-decoration: underline; cursor: pointer; background: none;
        border: 0; padding: 0; font: inherit;
      }
      .bdg-d-page[class*="max-"] > .blk-rec:not(.blk-rec-on) { display: none !important; }
      .bdg-d-page.max-rec > .blk-client,
      .bdg-d-page.max-rec > .blk-hier,
      .bdg-d-page.max-rec > #bdgTabs,
      .bdg-d-page.max-rec > #bdgTabBody { display: none !important; }
      .bdg-d-page.max-rec .blk-rec-on .rec-scroll { height: calc(var(--avail) - 50px); max-height: none; }

      /* outils export / import / aperçu */
      .blk-head { display: flex; align-items: center; justify-content: space-between; }
      .blk-tools { display: inline-flex; gap: 4px; margin-left: auto; }
      .bdg-d-tabs { align-items: flex-end; }
      .bdg-d-tabs .blk-tools { align-self: center; padding-right: 6px; }
      .blk-btn {
        display: inline-flex; align-items: center; justify-content: center;
        width: 26px; height: 24px; border: 1px solid #d6dbe3; border-radius: 6px;
        background: #fff; color: #4b5563; cursor: pointer; padding: 0;
      }
      .blk-btn:hover { background: #eef1f6; color: #1d4ed8; }
      #blkPop {
        position: fixed; inset: 0; z-index: 10001; background: rgba(15,23,42,.35);
        display: flex; align-items: center; justify-content: center; padding: 16px;
      }
      #blkPop .blk-card {
        position: relative; background: #fff; border-radius: 12px; width: 100%; max-width: 300px;
        padding: 16px; display: flex; flex-direction: column; gap: 8px;
        box-shadow: 0 12px 32px rgba(0,0,0,.18); font-size: 12px; max-height: 90vh;
      }
      #blkPop .blk-wide { max-width: 900px; }
      #blkPop .blk-title { font-weight: 800; color: #172033; padding-right: 30px; }
      #blkPop .blk-sub { color: #6b7280; font-size: 11px; }
      #blkPop .blk-choice {
        border: 1px solid #d6dbe3; background: #f8fafc; border-radius: 8px; padding: 9px;
        font-weight: 700; font-size: 12px; cursor: pointer; text-align: left;
      }
      #blkPop .blk-choice:hover { background: #dbeafe; }
      #blkPop .exp-name { height: 34px; border: 1px solid #d6dbe3; border-radius: 6px; padding: 0 8px;
        font-size: 12px; font-weight: 700; color: #172033; margin-bottom: 4px; }
      #blkPop .drv-go { background: #1d4ed8; color: #fff; border-color: #1d4ed8; text-align: center; }
      #blkPop .drv-go:hover { background: #1e40af; }
      #blkPop .drv-rec { font-weight: 600; padding: 6px 9px; }
      #blkPop .blk-x {
        position: absolute; top: 10px; right: 10px; width: 26px; height: 26px; border: 0;
        border-radius: 50%; background: #eef1f6; font-weight: 800; cursor: pointer;
      }
      #blkPop .blk-scroll { overflow: auto; border: 1px solid #edf0f4; border-radius: 6px; }
      #blkPop .blk-imp { table-layout: auto; width: auto; }

      /* contrôle unité / dimensions (Détail produits) */
      .bdg-d-table tbody tr td.cell-warn,
      .bdg-d-table tbody tr.selected td.cell-warn { background: #fbd5d5 !important; }

      /* tri / filtre par colonne */
      .cf-wrap { display: flex; align-items: center; gap: 4px; width: 100%; }
      .cf-lab { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; text-align: left; }
      .cf-wrap .cf-btn { margin-left: auto; margin-right: 10px; }
      .cf-btn {
        display: inline-flex; align-items: center; justify-content: center;
        width: 18px; height: 16px; border-radius: 4px; cursor: pointer;
        color: #8a94a5; flex: none;
      }
      .cf-btn:hover { background: #e5e9f0; color: #374151; }
      th.cf-on, .bdg-h-head.cf-on,
      .bdg-d-tab.cf-on, .bdg-d-block-title.cf-on {
        color: #1d4ed8 !important; background: #dbeafe !important;
      }
      th.cf-on .cf-btn, .bdg-h-head.cf-on .cf-btn { color: #1d4ed8; }
      #cfMenu {
        position: fixed; z-index: 10020; width: 240px; max-height: 60vh; overflow: hidden;
        display: flex; flex-direction: column; gap: 4px; padding: 8px;
        background: #fff; border: 1px solid #d6dbe3; border-radius: 10px;
        box-shadow: 0 10px 28px rgba(15, 23, 42, .18); font-size: 12px;
      }
      #cfMenu .cf-sort, #cfMenu .cf-clear {
        text-align: left; border: 0; background: #f3f5f8; border-radius: 6px;
        padding: 6px 8px; font-size: 12px; font-weight: 700; cursor: pointer; color: #172033;
      }
      #cfMenu { padding-left: 8px !important; }
      #cfMenu .cf-sort.on { background: #dbeafe; color: #1d4ed8; }
      #cfMenu .cf-clear { background: transparent; color: #b42318; }
      #cfMenu .cf-foot { display: flex; gap: 6px; flex: none; }
      #cfMenu .cf-x {
        position: absolute; top: 6px; right: 6px; width: 26px; height: 26px;
        border: 0; border-radius: 50%; background: #eef1f6; color: #374151;
        font-size: 13px; font-weight: 800; cursor: pointer; line-height: 26px; padding: 0;
      }
      #cfMenu .cf-x:hover { background: #dbe2ec; }
      #cfMenu .cf-sort { margin-right: 34px; }
      #cfMenu .cf-foot button { flex: 1; text-align: center; }
      #cfMenu .cf-ok {
        border: 0; border-radius: 6px; padding: 6px 8px; font-size: 12px;
        font-weight: 800; cursor: pointer; background: var(--svst, #172033); color: #fff;
      }
      #cfMenu .cf-sort, #cfMenu .cf-search { flex: none; }
      #cfMenu .cf-search { display: flex; align-items: center; gap: 4px; }
      #cfMenu .cf-q {
        flex: 1; min-width: 0; padding: 5px 7px; border: 1px solid #cfd6df;
        border-radius: 6px; font-size: 12px;
      }
      #cfMenu .cf-list {
        overflow-y: auto; min-height: 0; flex: 1 1 auto;
        -webkit-overflow-scrolling: touch;
        border: 1px solid #edf0f4; border-radius: 6px; padding: 2px 0;
      }
      #cfMenu .cf-item {
        display: flex; align-items: flex-start; gap: 6px; padding: 3px 8px;
        white-space: normal; overflow-wrap: anywhere; cursor: pointer;
      }
      #cfMenu .cf-rsz { position: absolute; left: 0; bottom: 0; width: 30px; height: 30px; cursor: nesw-resize; touch-action: none; z-index: 3; }
      #cfMenu .cf-rsz::after { content: ""; position: absolute; left: 5px; bottom: 5px; width: 14px; height: 14px; border-left: 3px solid #9aa3af; border-bottom: 3px solid #9aa3af; border-radius: 0 0 0 4px; }
      #cfMenu .cf-foot { padding-left: 22px; }
      #cfMenu .cf-all .cf-n { margin-left: auto; flex: none; background: #eef1f6; color: #374151; border-radius: 10px; padding: 1px 8px; font-size: 11px; font-weight: 800; }
      #cfMenu .cf-item input { margin-top: 2px; flex: none; }
      #cfMenu .cf-all { font-weight: 700; border-bottom: 1px solid #edf0f4; }
      #cfMenu .cf-none { padding: 6px 8px; color: #9aa3af; }

      /* désignations client : en-tête + 10 lignes + total */
      .bdg-d-block > .bdg-d-scroll.bdg-d-client-scroll {
        height: auto !important;
        max-height: var(--h-client, 148px) !important;
      }
      .bdg-d-table tfoot td {
        position: sticky;
        bottom: 0;
        z-index: 2;
        background: #dcecff;
        font-weight: 800;
        border-top: 1px solid #c7d7ee;
      }
      /* détail charge / produit : au plus 8 lignes visibles,
         pour laisser apparaître les totaux */
      /* v557 (FORMAT 202) : une seule hauteur pour tous les onglets du bloc détail (réglée à la poignée du bas, mémorisée ;
         au départ : hauteur de l'écran sous le bandeau et les onglets) — le cadre ne saute plus en changeant d'onglet */
      .bdg-d-tabbody > .bdg-d-scroll,
      .bdg-d-tabbody .bdg-d-scroll {
        height: var(--h-detail, 60vh) !important;
        max-height: none !important;
        overflow-y: auto;
      }

      /* même taille de caractères (12 px) dans tout le corps de l'écran */
      .bdg-d-page,
      .bdg-d-page .bdg-d-block-title,
      .bdg-d-page .bdg-d-tab,
      .bdg-d-page .bdg-d-fi,
      .bdg-d-page .bdg-d-totals div,
      .bdg-d-page .bdg-d-totals span,
      .bdg-d-page .bdg-d-totals strong,
      .bdg-d-page .bdg-h-item,
      .bdg-d-page .bdg-tva-input,
      .bdg-d-page .bdg-d-reserved {
        font-size: 12px !important;
      }

      .bdg-d-tabbody .bdg-d-totals {
        max-width: none;
        margin-top: 6px;
        display: flex;
        flex-wrap: wrap;
      }
      .bdg-d-tabbody .bdg-d-totals div {
        flex: 1 1 0;
        min-width: 150px;
        padding: 6px 12px;
        border-bottom: 0;
        border-right: 1px solid #edf0f4;
      }

      @media (max-width:650px) {
        .bdg-d-page { padding: 14px 10px 30px; }
        .bdg-d-head { padding: 10px 10px 2px; }
        .bdg-d-title { font-size: 24px; }
      }


      .novapp-list-titlebar .bdg-d-h1 { font-size: 24px; }
      .bdg-d-h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 900;
        text-transform: none;
      }

      #bdgClientBody { }

      /* tableau désignations client : cadre de hauteur fixe,
         en-tête figé, lignes vides de remplissage */
      .bdg-d-block > .bdg-d-scroll.bdg-d-client-scroll {
        height: 245px;
        max-height: none;
      }
      .bdg-d-table tbody tr.bdg-d-filler td {
        height: 20px;
        background: transparent;
      }

      .bdg-d-block > .bdg-d-scroll {
        max-height: 245px;
        overflow-y: auto;
      }

      .bdg-d-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: -1px;
      }

      .bdg-d-tab {
        padding: 9px 16px;
        border: 1px solid #e1e5eb;
        border-bottom: 0;
        border-radius: 10px 10px 0 0;
        background: #f3f4f6;
        color: #5f6875;
        font-size: 10px;
        font-weight: 800;
        cursor: pointer;
        text-transform: none;
      }

      .bdg-d-tab.active {
        background: #fff;
        color: #0f4f96;
      }

      .bdg-d-tabbody {
        border-top-left-radius: 0;
      }

      .bdg-d-debug {
        margin-top: 14px;
        color: #8a93a0;
        font-size: 10px;
      }

.bdg-d-table tbody tr[data-desig]{cursor:pointer}
.bdg-d-table tbody tr[data-row]{cursor:pointer}
.bdg-d-table tbody tr.selected td{background:#dbeafe !important;font-weight:700}
.bdg-d-fi{float:right;font-size:11px;font-weight:600;opacity:.8}
.bdg-h-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px}
.bdg-h-col{border:1px solid #d6dbe3;border-radius:8px;overflow:hidden;height:auto;max-height:var(--h-hier,128px);overflow-y:auto;background:#fff}
.bdg-h-head{position:sticky;top:0;z-index:1;background:#eef1f6;font-size:11px;line-height:16px;font-weight:700;padding:2px 8px;height:21px;box-sizing:border-box}
.bdg-h-item{padding:2px 8px;font-size:12px;line-height:16px;height:21px;box-sizing:border-box;cursor:pointer;border-top:1px solid #eef1f6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bdg-h-fill{height:21px;box-sizing:border-box;border-top:1px solid #eef1f6}
.bdg-h-item.selected{background:#dbeafe;font-weight:700}
.bdg-h-empty{padding:8px;font-size:12px;opacity:.5}
@media (max-width:650px){.bdg-h-grid{grid-template-columns:1fr}}

      @media (max-width:650px) {
        .novapp-budget-table-wrap {
          max-height:
            calc(100vh - 130px);
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  /* -------------------------------------------------------
     REGROUPEMENT PAR BUDGET
     ------------------------------------------------------- */

  const groups = new Map();
  const byProject = new Map();

  /* Date provisoire intégrée à la référence : 01/10/2026 */
  const REF_PREFIX = "BDG 26-1001/";

  bdgRows.forEach(row => {
    const prj =
      normalise(
        firstValue(
          row,
          ["PRJ", "PROJET", "NOM PROJET"]
        )
      ) || "SANS PROJET";

    if (!byProject.has(prj)) {
      const ref =
        REF_PREFIX +
        String(byProject.size + 1)
          .padStart(3, "0");

      const group = {
        ref,
        project: prj,
        rows: [],
        first: row
      };

      byProject.set(prj, group);
      groups.set(ref, group);
    }

    byProject.get(prj).rows.push(row);
  });

  /* ===== BUDGETS EN INSTANCE (création) — gardés sur l'appareil pendant les essais ===== */
  const instLoad = () => sviInstGet();
  const instSave = l => sviInstSet(l);
  instLoad().forEach(b => groups.set(b.ref, { ref: b.ref, project: b.project, rows: [], first: {}, inst: b }));
  /* v681 : budget à avenants — vue GLOBAL (marché initial + avenants consolidés, en lecture seule, jamais enregistrée) */
  /* v691 : composition par défaut du consolidé selon la liste affichée (EN INSTANCE : validé + en instance ; VALIDÉ : validé seul) */
  { let lm = "valid"; try { if (localStorage.getItem("svi_listmode_v1") === "inst") lm = "inst"; } catch (e) {} window.__sviAvMode = window.__sviAvMode || {}; instLoad().filter(b => !b.parent && !b.rclOf).forEach(b => { window.__sviAvMode[b.ref] = lm; }); }
  instLoad().filter(b => !b.parent && instLoad().some(x => x.parent === b.ref)).forEach(b => {
    try { const gref = b.ref + "-GLOBAL"; groups.set(gref, { ref: gref, project: b.project, rows: [], first: {}, inst: { ref: gref, project: b.project, intitule: b.intitule, client: b.client, state: "valide", virtual: true, parent: b.ref, vsel: sviAvSelLab(b.ref, sviAvSelGet(b.ref)), data: sviAvMerge(b.ref, sviAvSelGet(b.ref)) } }); } catch (e) {}
  });

  /* v682 : VERSION n d'une étape — photo en lecture seule, jamais enregistrée */
  instLoad().forEach(b => ((b.data || {}).vfz || []).forEach(v => {
    try { const vref = b.ref + "-V" + v.n; groups.set(vref, { ref: vref, project: b.project, rows: [], first: {}, inst: { ref: vref, project: b.project, intitule: b.intitule, client: b.client, state: "valide", virtual: true, parent: b.ref, vname: sviAvName(b) + " — VERSION " + v.n, data: JSON.parse(JSON.stringify(v.d || {})) } }); } catch (e) {}
  }));

  /* liste affichée : VALIDÉS (noir) ou EN INSTANCE (rouge / vert si figé) */
  let listMode = "valid";
  try { if (localStorage.getItem("svi_listmode_v1") === "inst") listMode = "inst"; } catch (e) {}

  bdgGroups = groups;

  /* v679 : pas d'icône EN INSTANCE s'il n'y a que des budgets validés, et inversement ; la liste affichée suit */
  /* v681 : un budget à avenants est une famille (marché initial + avenants) : elle figure dans chaque liste où l'un d'eux figure */
  const famLive = g => { const L = [g.inst, ...instLoad().filter(x => g.inst && x.parent === g.ref && !x.rclOf)].filter(Boolean); return { live: L.some(x => x.state !== "valide"), done: !g.inst || L.some(x => x.state === "valide") }; };
  const LIST_N = { inst: 0, valid: 0 };
  groups.forEach(g => { if (g.inst && (g.inst.parent || g.inst.rclOf)) return; const f = famLive(g); if (f.live) LIST_N.inst++; if (f.done) LIST_N.valid++; });
  if (listMode === "inst" && !LIST_N.inst && LIST_N.valid) listMode = "valid";
  if (listMode === "valid" && !LIST_N.valid && LIST_N.inst) listMode = "inst";

  const budgets =
    [...groups.values()].filter(g => {
      if (g.inst && (g.inst.parent || g.inst.rclOf)) return false;   /* avenants, GLOBAL et recalages (v693) : sous leur budget / étape */
      const f = famLive(g);
      return listMode === "inst" ? f.live : f.done;
    });

  /* titre, couleur et boutons de la barre de la liste */
  shell.classList.remove("bdg-inst-instance", "bdg-inst-fige", "bdg-av");
  shell.classList.toggle("list-inst", listMode === "inst");
  sviWatchState(shell);
  {
    const h1 = shell.querySelector(".novapp-list-titlebar h1");
    if (h1) h1.innerHTML = (listMode === "inst" ? "BUDGETS (EN INSTANCE)" : "BUDGETS (VALIDÉS)") + ' <span id="bdgListCount"></span>';
    const acts = shell.querySelector(".novapp-list-actions");
    if (acts) {
      /* ⌛ : budgets en instance — ≡ : budgets validés (bouton de la liste affichée surligné) */
      const hg = acts.querySelector('[aria-label="Historique"]');
      const ls = acts.querySelector('[aria-label="Liste"]');
      if (hg) { hg.title = "Budgets en instance"; hg.classList.toggle("on", listMode === "inst"); hg.hidden = !LIST_N.inst; hg.style.display = LIST_N.inst ? "" : "none"; }
      if (ls) { ls.title = "Budgets validés"; ls.classList.toggle("on", listMode !== "inst"); ls.hidden = !LIST_N.valid; ls.style.display = LIST_N.valid ? "" : "none"; }
      const setMode = m => {
        try { localStorage.setItem("svi_listmode_v1", m); } catch (err) {}
        renderBudgetList();
      };
      acts.onclick = e => {
        const b = e.target.closest("button");
        if (!b) return;
        if (b.getAttribute("aria-label") === "Historique") setMode("inst");
        else if (b.getAttribute("aria-label") === "Liste") setMode("valid");
        else if (b.getAttribute("aria-label") === "Ajouter") {
          openNewBudget();
        }
      };
    }
  }

  /* prochaine référence : la suite continue pour toujours (tous budgets confondus) */
  const nextBudgetRef = d => {
    const n = Math.max(0, ...[...groups.keys()].map(r => Number((String(r).match(/\/(\d+)\s*$/) || [])[1]) || 0)) + 1;
    const p2 = x => String(x).padStart(2, "0");
    return "BDG " + p2(d.getFullYear() % 100) + "-" + p2(d.getMonth() + 1) + p2(d.getDate()) + "/" + String(n).padStart(3, "0");
  };

  /* bouton + : fenêtre rouge NOUVEAU BUDGET (date de création, nouveau projet) */
  function openNewBudget() {
    document.getElementById("docPop")?.remove();
    const now = new Date();
    const p2 = x => String(x).padStart(2, "0");
    const local = now.getFullYear() + "-" + p2(now.getMonth() + 1) + "-" + p2(now.getDate()) + "T" + p2(now.getHours()) + ":" + p2(now.getMinutes());
    const p = sviPopNew();
    p.className = "pop-new-bdg";
    p.innerHTML = `
      <div class="doc-card" role="dialog" aria-modal="true" style="max-width:760px">
        <div class="doc-head">
          <span class="doc-title">AJOUT <span id="nbRefT"></span></span>
          <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
        </div>
        <div class="doc-body">
          <div class="doc-grid">
            <label class="doc-lab" for="nbDate">DATE CRÉATION <b>*</b></label>
            <input id="nbDate" class="doc-in" type="datetime-local" value="${local}">
            <label class="doc-lab" for="nbPrj">PROJET <b>*</b></label>
            <input id="nbPrj" class="doc-in" type="text" autocomplete="off" placeholder="CODE PROJET">
            <label class="doc-lab" for="nbName">INTITULÉ</label>
            <input id="nbName" class="doc-in nb-wide" type="text" autocomplete="off" placeholder="INTITULÉ DU PROJET">
          </div>
          <div id="nbErr" class="doc-err"></div>
        </div>
        <div class="doc-foot">
          <button type="button" class="doc-btn" id="nbFile" style="margin-right:auto">CHARGER UN FICHIER BUDGET</button>
          <input type="file" id="nbFileIn" accept=".json,application/json" hidden>
          <button type="button" class="doc-btn" data-cancel>ANNULER</button>
          <button type="button" class="doc-btn nb-save" id="nbGo">ENREGISTRER</button>
        </div>
      </div>`;
    sviPopShow(p);
    try { popEnhance(p, "newbdg"); } catch (e) {}
    const val = id => (p.querySelector(id)?.value || "").trim();
    const refNow = () => {
      const d = new Date(val("#nbDate"));
      const r = isNaN(d) ? "" : nextBudgetRef(d);
      p.querySelector("#nbRefT").textContent = r ? ((val("#nbPrj").toUpperCase() ? val("#nbPrj").toUpperCase() + " " : "") + r) : "";
      return isNaN(d) ? "" : r;
    };
    refNow();
    p.addEventListener("input", refNow);
    p.addEventListener("change", refNow);
    p.addEventListener("click", e => {
      if (e.target === p || e.target.closest("[data-cancel]")) p.remove();
    });
    setTimeout(() => p.querySelector("#nbPrj")?.focus(), 50);
    /* v636 : budget rechargé depuis un fichier .json (TÉLÉCHARGER LE BUDGET) — ajouté à la liste, sans l'ouvrir */
    p.querySelector("#nbFile").addEventListener("click", () => p.querySelector("#nbFileIn").click());
    p.querySelector("#nbFileIn").addEventListener("change", async e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      let b = null;
      try { const o = JSON.parse(await f.text()); b = o && o.budget && o.budget.ref ? o.budget : o; } catch (err) { b = null; }
      if (!b || !b.ref) { p.querySelector("#nbErr").textContent = "FICHIER ILLISIBLE : CE N'EST PAS UN BUDGET."; return; }
      const list = instLoad(), i = list.findIndex(x => x.ref === b.ref);
      if (i >= 0 && !(await svConfirm({ title: "CHARGER UN FICHIER BUDGET", text: b.ref + " EXISTE DÉJÀ : IL SERA REMPLACÉ PAR LE FICHIER.", ok: "REMPLACER" }))) return;
      if (i >= 0) list[i] = b; else list.push(b);
      instSave(list); await sviInstFlush();
      try { const k1 = "svi_bdgstate_v1:" + b.ref, v1 = localStorage.getItem(k1); if (v1) { localStorage.setItem("svi_diag_old_v1", JSON.stringify({ [k1]: v1 })); localStorage.removeItem(k1); } localStorage.setItem("svi_listmode_v1", "inst"); } catch (err) {}
      p.remove();
      renderBudgetList();
      svToast(b.ref + " CHARGÉ DANS LA LISTE.", 3000);
    });
    p.querySelector("#nbGo").addEventListener("click", () => {
      const prj = val("#nbPrj").toUpperCase().replace(/\s+/g, " ");
      const r = refNow();
      const miss = [];
      if (!r) miss.push("date");
      if (!prj) miss.push("projet");
      if (miss.length) { p.querySelector("#nbErr").textContent = "À COMPLÉTER (*) : " + miss.join(", ").toUpperCase() + "."; return; }
      const list = instLoad();
      list.push({ ref: r, project: prj, intitule: val("#nbName").toUpperCase() || "À COMPLÉTER",
        created: val("#nbDate"), state: "instance" });
      instSave(list);
      p.remove();
      try { localStorage.setItem("svi_listmode_v1", "inst"); } catch (e) {}
      renderBudgetList();
      /* consigne : l'élément créé s'ouvre directement (budget en rouge, mode SAISIE) */
      setTimeout(() => {
        const tr = [...document.querySelectorAll("tr[data-budget-ref]")].find(x => x.dataset.budgetRef === r);
        if (tr) tr.click();
      }, 30);
    });
  }

  /* -------------------------------------------------------
     CALCUL D'UNE LIGNE BUDGET
     ------------------------------------------------------- */

  function budgetData(budget) {

    /*
      BUDGET :
      on privilégie le champ BUDGET.
      PROJET reste en secours tant que
      la source historique ne contient
      pas encore une colonne BUDGET.
    */

    const budgetName =
      budget.project;

    /* montant TTC = celui du tableau DÉSIGNATIONS CLIENT de l'écran du budget :
       par désignation, quantité des lignes PRODUIT au prix non nul
       (clés primaires) × prix de la première d'entre elles (prix TTC de la feuille) */
    const dg = new Map();
    budget.rows.forEach(r => {
      const c = r.__cols || [];
      if (!/PRD/i.test(String(c[14] ?? ""))) return;
      const price = num(c[22]);
      if (!price) return;
      let q = num(c[21]);
      if (!q) {
        const f = [c[17], c[18], c[19], c[20]].filter(v => normalise(v) !== "").map(num);
        if (f.length) q = f.reduce((x, y) => x * y, 1);
      }
      const k = normalise(c[7]) + "||" + normalise(c[8]);
      const g = dg.get(k) || { price, qty: 0 };
      g.qty += q;
      dg.set(k, g);
    });
    const ttc = [...dg.values()].reduce((t, g) => t + g.qty * g.price, 0);
    const ht = ttc / 1.2;

    const refDate =
      budgetDate(budget.ref);

    const validated =
      refDate ? refDate.label : "";

    const entered = validated;

    /* intitulé : saisi dans INF, sinon base V3 (BDS n'est plus lu) */
    const intitule = sviIntitule(budget.ref, budgetName, budget.inst);

    /* v695 : ligne mère d'un budget à avenants = valeurs du BUDGET CONSOLIDÉ (montant, saisi le, validé le) */
    if (!budget.__noFam && budget.inst && !budget.inst.parent && !budget.inst.rclOf && !budget.inst.virtual && groups.has(budget.ref + "-GLOBAL") && sviAvStages(budget.ref).length > 1) {
      const base = budgetData({ ...budget, __noFam: true }), g = groups.get(budget.ref + "-GLOBAL"), cg = budgetData(g), dts = sviAvDates(budget.ref);
      return { ...base, ht: cg.ht, ttc: cg.ttc, validated: svDT(dts.validated || ""), entered: svDT(dts.created || ""), source: budget };
    }
    if (budget.inst) {
      const c = String(budget.inst.created || "");
      const m = c.match(/^(\d{4})-(\d{2})-(\d{2})/);
      return {
        ref: budget.ref, budget: budgetName, intitule: budget.inst.intitule || "À COMPLÉTER",
        /* total TTC des désignations saisies (titres exclus) */
        ...(() => {
          const ds = ((budget.inst.data || {}).des || []).filter(r => !r.t);
          const D = budget.inst.data || {};
          const qq = r => { const lq = insLinkedQ(D, r.id); return lq !== null ? lq : 0; };
          const ht = ds.reduce((t, r) => t + qq(r) * num(r.p || 0), 0);
          const ttc = ds.reduce((t, r) => t + qq(r) * num(r.p || 0) *
            (1 + (r.tva === "" || r.tva === undefined ? 20 : num(r.tva)) / 100), 0);
          return { ht, ttc };
        })(),
        validated: svDT(budget.inst.validated || ""),
        entered: m ? svDT(c) : "",
        state: budget.inst.state || "instance", source: budget
      };
    }

    return {
      ref:
        budget.ref,

      budget:
        budgetName,

      ht,
      intitule,
      ttc,
      validated,
      entered,

      source:
        budget
    };
  }

  /* -------------------------------------------------------
     COLONNES
     ------------------------------------------------------- */

  const columns = [
    {
      key: "ref",
      title: "RÉFÉRENCE",
      width: 210
    },

    {
      key: "budget",
      title: "PROJET",
      width: 260
    },

    {
      key: "intitule",
      title: "INTITULÉ",
      width: 260
    },

    {
      key: "ttc",
      title: "MONTANT TTC",
      width: 150,
      number: true
    },

    {
      key: "validated",
      title: "VALIDÉ LE",
      width: 140
    },

    {
      key: "entered",
      title: "SAISI LE",
      width: 140
    }
  ];

  /* -------------------------------------------------------
     ÉTAT RECHERCHE / TRI
     ------------------------------------------------------- */

  const state = {
    sortKey: "",
    sortDirection: 1,

    search: {
      ref: "",
      budget: "",
      intitule: "",
      ttc: "",
      validated: "",
      entered: ""
    }
  };

  const thead =
    table.querySelector(
      "thead"
    );

  const tbody =
    table.querySelector(
      "tbody"
    );

  /* -------------------------------------------------------
     ENTÊTES
     ------------------------------------------------------- */

  thead.innerHTML = `
    <tr>

      ${
        columns.map(
          column => `
            <th
              class="
                bdg-list-head
                ${
                  column.number
                    ? "number"
                    : ""
                }
              "
              data-bdg-column="${column.key}"
              style="
                width:${column.width}px;
                min-width:${column.width}px;
              "
            >

              <div
                class="bdg-head-content"
              >

                <span class="bdg-head-label">${column.title}</span>
                <button type="button" class="bdg-head-action" data-bdg-menu="${column.key}"
                  title="Trier / rechercher"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M1 2h11M3 5h7M5 8h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M4.5 10l2 2.2 2-2.2z" fill="currentColor"/></svg></button>

              </div>

              <span
                class="bdg-column-resizer"
                data-bdg-resize="${column.key}"
              ></span>

            </th>
          `
        ).join("")
      }

      <th
        style="
          width:75px;
          min-width:75px;
        "
      ></th>

    </tr>
  `;

  /* -------------------------------------------------------
     RENDU DES LIGNES
     ------------------------------------------------------- */
  /* ---- PANNEAU DES DATES (à gauche) ---- */

  let dateFilter = "";

  let panel = $("bdgDatePanel");

  if (!panel) {
    const wrap = table.closest(".novapp-budget-table-wrap");
    const layout = document.createElement("div");

    layout.className = "novapp-budget-layout";
    wrap.parentNode.insertBefore(layout, wrap);

    panel = document.createElement("aside");
    panel.id = "bdgDatePanel";
    panel.className = "novapp-date-panel";

    layout.appendChild(panel);
    layout.appendChild(wrap);
  }

  function renderDatePanel() {
    const counts = new Map();

    budgets.forEach(b => {
      const d = sviRowDate(b.ref);   /* v695 */
      if (!d) return;

      const c = counts.get(d.key) || { label: d.label, n: 0 };
      c.n++;
      counts.set(d.key, c);
    });

    const keys = [...counts.keys()].sort().reverse();

    panel.innerHTML = `
      <div class="novapp-date-head">
        <button type="button" class="novapp-date-filter">TOUT ▾</button>
      </div>
      <div class="novapp-date-list">
        ${keys.map(k => `
          <button type="button" data-date="${k}"
            class="novapp-date-item ${dateFilter === k ? "selected" : ""}">
            <span>${counts.get(k).label}</span>
            ${svCnt(counts.get(k).n)}
          </button>
        `).join("")}
      </div>
    `;
  }

  panel.onclick = event => {
    const item = event.target.closest("[data-date]");

    if (item) {
      dateFilter = dateFilter === item.dataset.date ? "" : item.dataset.date;
    } else if (event.target.closest(".novapp-date-filter")) {
      dateFilter = "";
    } else {
      return;
    }

    renderDatePanel();
    renderRows();
  };

  renderDatePanel();


  function renderRows() {
    let data =
      budgets.map(
        budget =>
          budgetData(budget)
      );

    if (dateFilter) {
      data = data.filter(item => {
        const d = sviRowDate(item.ref);   /* v695 */
        return d && d.key === dateFilter;
      });
    }


     
    /* FILTRES */

    Object.entries(
      state.search
    ).forEach(
      ([key, search]) => {

        const query =
          normalise(search)
            .toLowerCase();

        if (!query) return;

        data =
          data.filter(item => {

            let value =
              key === "ref" ? item.budget + " " + item.ref : item[key];

            if (
              key === "ht" ||
              key === "ttc"
            ) {
              value =
                money(value);
            }

            return normalise(value)
              .toLowerCase()
              .includes(query);
          });
      }
    );

    /* TRI */

    if (state.sortKey) {
      const key =
        state.sortKey;

      data.sort((a, b) => {

        if (
          key === "ht" ||
          key === "ttc"
        ) {
          return (
            (
              num(a[key]) -
              num(b[key])
            ) *
            state.sortDirection
          );
        }

        return (
          normalise(a[key])
            .localeCompare(
              normalise(b[key]),
              "fr",
              {
                numeric: true,
                sensitivity: "base"
              }
            ) *
          state.sortDirection
        );
      });
    }

    /* compteur du titre : budgets affichés (filtres compris) */
    { const c = $("bdgListCount"); if (c) c.innerHTML = svCnt(data.length, budgets.length); }

    if (!data.length) {
      tbody.innerHTML = `
        <tr>
          <td
            colspan="7"
            class="empty"
          >
            AUCUN BUDGET
          </td>
        </tr>
      `;

      return;
    }

    /* v691 : LISTE MÈRE EN ARBORESCENCE — un budget à avenants a un signe › / ⌄ ; déplié : BUDGET CONSOLIDÉ, BUDGET INITIAL,
       AVENANT n DU BUDGET (mêmes colonnes). EN INSTANCE : étapes en instance, consolidé = validé + en instance ;
       VALIDÉ : étapes validées, consolidé = validé seul. Toucher une étape l'ouvre ; ← ramène à la liste mère. */
    const FOLD_KEY = "svi_bdgfold_v1";
    const foldGet0 = () => { try { return JSON.parse(localStorage.getItem(FOLD_KEY) || "[]") || []; } catch (e) { return []; } };
    const isFam = r => { try { return sviAvStages(r).length > 1; } catch (e) { return false; } };
    const kidsOf = item => {
      if (!isFam(item.ref)) return [];
      const S = sviAvStages(item.ref), out = [];
      const pick = S.filter(st => listMode === "inst" ? st.state !== "valide" : st.state === "valide");
      const g = groups.get(item.ref + "-GLOBAL");
      if (g) { let bd = {}; try { bd = budgetData(g); } catch (e) {} const dts = sviAvDates(item.ref); out.push({ ref: g.ref, lab: "BUDGET CONSOLIDÉ", budget: item.budget, intitule: item.intitule, ttc: bd.ttc || 0, validated: svDT(dts.validated || ""), entered: svDT(dts.created || ""), state: "", kind: "glob" }); }
      pick.forEach(st => { let bd = {}; try { bd = budgetData({ ref: st.ref, project: st.project, rows: [], first: {}, inst: st, __noFam: true }); } catch (e) {}
        out.push({ ref: st.ref, lab: st.parent ? "AVENANT " + (st.avn || 1) + " DU BUDGET" : "BUDGET INITIAL", budget: U_(st.project), intitule: st.intitule || "", ttc: bd.ttc || 0,
          validated: st.state === "valide" ? svDT(st.validated || "") : "", entered: svDT(st.created || ""), state: st.state || "instance", kind: st.parent ? "av" : "bdg" }); });
      return out;
    };
    const FO = new Set(foldGet0());
    tbody.innerHTML =
      data.map(item => { const fam = isFam(item.ref), open = fam && FO.has(item.ref), kids = open ? kidsOf(item) : [];
        return `
        <tr
          data-budget-ref="${esc(item.ref)}"
          class="${item.state ? "inst-" + item.state : ""}${fam ? " bdg-fam" : ""}"${fam ? ' data-fam="1"' : ""}
        >

          <td>
            ${fam ? `<span class="bdg-fold" aria-hidden="true">${open ? "⌄" : "›"}</span>` : ""}<span class="bang-slot">${obsBang(item.ref)}</span>${esc(item.budget + " " + item.ref)}
          </td>

          <td title="${esc(item.budget)}">
            <button
              type="button"
              class="budget-link"
              data-open-project="${esc(item.ref)}"
            >
              ${esc(item.budget)}
            </button>
          </td>

          <td title="${esc(item.intitule)}">
            ${esc(item.intitule)}
          </td>

          <td class="number">
            ${money(item.ttc)}
          </td>

          <td>
            ${esc(item.validated)}
          </td>

          <td>
            ${esc(item.entered)}
          </td>

          <td class="bdg-action-cell">

            <button
              type="button"
              class="bdg-row-action"
              data-print-budget="${esc(item.ref)}"
              title="Imprimer"
              aria-label="Imprimer"
            >
              🖨
            </button>
            ${item.state === "instance" ? `<button type="button" class="bdg-row-action bdg-row-del" data-del-budget="${esc(item.ref)}"
              title="Supprimer" aria-label="Supprimer">🗑</button>` : ""}

          </td>

        </tr>
        ${kids.map(k => `<tr data-budget-ref="${esc(k.ref)}" data-kid="${k.kind}" class="bdg-kid${k.state ? " inst-" + k.state : ""}${k.kind === "av" ? " row-av" : " row-bdg"}">
          <td><span class="bdg-kid-lab">${esc(k.lab)}</span> <small>${esc(k.ref)}</small></td><td>${esc(k.budget)}</td><td title="${esc(k.intitule)}">${esc(k.intitule)}</td>
          <td class="number">${money(k.ttc)}</td><td>${esc(k.validated)}</td><td>${esc(k.entered)}</td><td></td></tr>`).join("")}
      `; }).join("");
  }

  /* -------------------------------------------------------
     RESTAURATION D'UN ENTÊTE
     ------------------------------------------------------- */

  function restoreHeader(key) {
    const column =
      columns.find(
        item =>
          item.key === key
      );

    const th =
      thead.querySelector(
        `[data-bdg-column="${key}"]`
      );

    if (!column || !th) return;

    const content =
      th.querySelector(
        ".bdg-head-content"
      );

    if (!content) return;

    content.innerHTML = `
      <span class="bdg-head-label">${column.title}</span>
      <button type="button" class="bdg-head-action" data-bdg-menu="${key}"
        title="Trier / rechercher"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M1 2h11M3 5h7M5 8h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M4.5 10l2 2.2 2-2.2z" fill="currentColor"/></svg></button>`;
    /* en-tête bleu quand un tri ou une recherche est choisi (comme le budget) */
    th.classList.toggle("cf-on", !!state.search[key] || state.sortKey === key);
  }


  /* -------------------------------------------------------
     CLICS SUR ENTÊTES
     ------------------------------------------------------- */

  /* menu de colonne (comme dans le budget) : tri croissant / décroissant,
     recherche, effacer */
  const closeListMenu = () => document.getElementById("bdgListMenu")?.remove();
  const openListMenu = (key, btn) => {
    closeListMenu();
    const column = columns.find(c => c.key === key);
    if (!column) return;
    const m = document.createElement("div");
    m.id = "bdgListMenu";
    m.className = "bdg-list-menu";
    m.innerHTML = `
      <div class="blm-title">${esc(column.title)}</div>
      <button type="button" data-lm="asc" class="${state.sortKey === key && state.sortDirection === 1 ? "on" : ""}">↑ TRI CROISSANT</button>
      <button type="button" data-lm="desc" class="${state.sortKey === key && state.sortDirection === -1 ? "on" : ""}">↓ TRI DÉCROISSANT</button>
      <input type="search" class="blm-q" placeholder="RECHERCHER…" autocomplete="off" value="${esc(state.search[key] || "")}">
      <button type="button" data-lm="clear">EFFACER</button>`;
    document.body.appendChild(m);
    const r = btn.getBoundingClientRect();
    m.style.overflowY = "auto";
    sviPlaceMenu(m, r);
    const q = m.querySelector(".blm-q");
    const apply = () => { columns.forEach(c => restoreHeader(c.key)); renderRows(); };
    q.addEventListener("input", () => { state.search[key] = q.value; apply(); });
    m.addEventListener("click", e => {
      const b = e.target.closest("[data-lm]");
      if (!b) return;
      const a = b.dataset.lm;
      if (a === "asc" || a === "desc") {
        const d = a === "asc" ? 1 : -1;
        if (state.sortKey === key && state.sortDirection === d) state.sortKey = "";
        else { state.sortKey = key; state.sortDirection = d; }
      } else {
        state.search[key] = "";
        if (state.sortKey === key) state.sortKey = "";
      }
      apply();
      closeListMenu();
    });
    setTimeout(() => document.addEventListener("pointerdown", function off(e) {
      if (!e.target.closest("#bdgListMenu")) { closeListMenu(); document.removeEventListener("pointerdown", off, true); }
    }, true), 0);
  };

  thead.onclick = event => {
    const b = event.target.closest("[data-bdg-menu]");
    if (!b) return;
    event.preventDefault();
    event.stopPropagation();
    openListMenu(b.dataset.bdgMenu, b);
  };

  /* -------------------------------------------------------
     LARGEUR DES COLONNES AJUSTABLE
     ------------------------------------------------------- */

  thead
    .querySelectorAll(
      ".bdg-column-resizer"
    )
    .forEach(resizer => {

      resizer.addEventListener(
        "pointerdown",
        event => {

          event.preventDefault();
          event.stopPropagation();

          const th =
            resizer.closest("th");

          if (!th) return;

          const startX =
            event.clientX;

          const startWidth =
            th.getBoundingClientRect()
              .width;

          resizer.classList.add(
            "active"
          );

          try {
            resizer.setPointerCapture(
              event.pointerId
            );
          } catch (_) {}

          const move =
            moveEvent => {

              const newWidth =
                Math.max(
                  80,
                  startWidth +
                  (
                    moveEvent.clientX -
                    startX
                  )
                );

              th.style.width =
                newWidth + "px";

              th.style.minWidth =
                newWidth + "px";
            };

          const stop =
            stopEvent => {

              resizer.classList.remove(
                "active"
              );

              resizer.removeEventListener(
                "pointermove",
                move
              );

              resizer.removeEventListener(
                "pointerup",
                stop
              );

              resizer.removeEventListener(
                "pointercancel",
                stop
              );

              try {
                resizer
                  .releasePointerCapture(
                    stopEvent.pointerId
                  );
              } catch (_) {}
            };

          resizer.addEventListener(
            "pointermove",
            move
          );

          resizer.addEventListener(
            "pointerup",
            stop
          );

          resizer.addEventListener(
            "pointercancel",
            stop
          );
        }
      );
    });

  /* -------------------------------------------------------
     DÉTAIL D'UN BUDGET
     ------------------------------------------------------- */

