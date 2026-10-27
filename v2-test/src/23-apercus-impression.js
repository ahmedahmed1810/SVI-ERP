    /* ===== APERÇU DÉSIGNATIONS CLIENT (façon NovApp) :
       volet « OPTIONS PDF » à gauche, aperçu des pages à droite,
       bouton GÉNÉRER PDF ; aucune impression lancée ===== */
    /* aperçu au modèle de la société (désignations client, tâches…) */
    /* FORMAT 106 : essai à blanc d'un aperçu (PM_DRY) — sert à griser APERÇU PDF si ce contenu est déjà classé */
    let PM_DRY = null;
    const printModel = cfg => {
      /* empreinte du contenu : même bloc, mêmes données → même document */
      const fp = (() => {
        const str = cfg.docTitle + "|" + cfg.table + "|" + cfg.end +
          (budget && budget.inst ? "|" + (budget.inst.state || "instance") : "");
        let h1 = 0x811c9dc5, h2 = 0;
        for (let i = 0; i < str.length; i++) {
          const c = str.charCodeAt(i);
          h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
          h2 = (h2 * 31 + c) >>> 0;
        }
        return h1.toString(36) + h2.toString(36);
      })();
      /* bloc déjà enregistré (et non expiré) : on ouvre directement son document */
      const docs = docsLoad();
      let exDoc = null;
      for (let i = docs.length - 1; i >= 0 && !exDoc; i--) {
        const d = docs[i];
        /* contenu identique à un document déjà classé (même empreinte ; anciens documents sans empreinte : même intitulé) */
        const same = d.fp ? d.fp === fp
          : String(d.title || "").toUpperCase() === String(cfg.docTitle).toUpperCase();
        if (!d.expired && (d.idb || d.data) && same) exDoc = d;
      }
      if (PM_DRY) { PM_DRY.doc = exDoc ? exDoc.ref : ""; return; }
      if (exDoc) { sviAlert("DÉJÀ ÉDITÉ ET CLASSÉ DANS DOCUMENTS : " + exDoc.ref + ". LE CONSULTER DEPUIS DOCUMENTS.", "APERÇU PDF"); return; }
      histLog(cfg.branch, "APERÇU PDF");
      const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
        "août", "septembre", "octobre", "novembre", "décembre"];
      const now = new Date();
      const dateTxt = `Agadir, le ${String(now.getDate()).padStart(2, "0")} ${mois[now.getMonth()]} ${now.getFullYear()}`;
      const projet = (() => { const it = sviIntitule(ref, budget.project, budget.inst); return it !== "À COMPLÉTER" ? it : budget.project; })();
      const fileName = (fullRef + " " + cfg.fileTag).replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "_") + ".pdf";

      const w = window.open("", "_blank");
      if (!w) { sviAlert("Autorisez les fenêtres pop-up pour l'aperçu."); return; }
      w.document.write(`<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<title>${esc(fullRef)} - ${esc(cfg.fileTag)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { background: #eef1f6; font-family: Arial, Helvetica, sans-serif; }
  /* ---- volet options ---- */
  #side { position: fixed; left: 0; top: 0; bottom: 0; width: 300px; background: #fff; border-right: 1px solid #e1e5eb;
          padding: 18px 16px; overflow-y: auto; z-index: 3; transition: transform .2s; color: #172033; }
  body.closed #side { transform: translateX(-300px); }
  #side h2 { margin: 0 0 6px; font-size: 15px; font-weight: 900; }
  #side .sub { font-size: 11px; color: #4b5563; margin-bottom: 16px; line-height: 1.35; }
  #side label.ck { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 700; margin: 12px 0 6px; }
  #side label.ck input { width: 18px; height: 18px; accent-color: var(--svst); }
  #side .opt { margin: 4px 0 4px 28px; }
  #side .opt span { display: block; font-size: 11px; font-weight: 800; color: #4b5563; margin: 8px 0 5px; }
  #side select { width: 100%; height: 36px; border: 1px solid #d6dbe3; border-radius: 8px; padding: 0 10px;
                 font-size: 12px; background: #fff; color: #172033; }
  #side .dis { opacity: .45; pointer-events: none; }
  #gen { width: 100%; margin-top: 22px; height: 42px; border: 0; border-radius: 8px; background: #2a4fd1; color: #fff;
         font-weight: 800; font-size: 13px; cursor: pointer; }
  #gen:disabled, #prt:disabled { opacity: .6; }
  #prt { width: 100%; margin-top: 10px; height: 40px; border: 1px solid #2a4fd1; border-radius: 8px; background: #fff;
         color: #2a4fd1; font-weight: 800; font-size: 12px; cursor: pointer; }
  @media print {
    #side, #tog, #savedBar, #close, #saveOpts { display: none !important; }
    html, body { background: #fff !important; }
    #view, body.closed #view, body.locked #view { margin: 0 !important; padding: 0 !important; overflow: visible !important; }
    #pages .page { margin: 0 !important; box-shadow: none !important; break-after: page; page-break-after: always; }
    #pages .page:last-child { break-after: auto; page-break-after: auto; }
  }
  #share { width: 100%; margin-top: 10px; height: 40px; border: 1px solid #2a4fd1; border-radius: 8px; background: #fff;
           color: #2a4fd1; font-weight: 800; font-size: 12px; cursor: pointer; }
  #share[hidden], #saveDoc[hidden], #saveOpts[hidden] { display: none; }
  #saveOpts { position: fixed; inset: 0; z-index: 20; background: rgba(15,23,42,.45); display: flex;
    align-items: center; justify-content: center; padding: 16px; }
  #saveOpts .sv-card { width: 100%; max-width: 640px; background: #fff; border-radius: 10px; overflow: hidden;
    box-shadow: 0 18px 40px rgba(0,0,0,.25); color: #172033; font-size: 12px; font-family: Arial, sans-serif; }
  #saveOpts .sv-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px;
    border-bottom: 1px solid #e5e9ef; font-size: 13px; font-weight: 800; }
  #saveOpts .sv-x { border: 0; background: none; font-size: 16px; cursor: pointer; color: #374151; }
  #saveOpts .sv-body { padding: 16px 18px 12px; display: grid; grid-template-columns: max-content 1fr; gap: 12px; align-items: center; }
  #saveOpts .sv-lab { font-size: 11px; font-weight: 800; color: #4b5563; white-space: nowrap; }
  #saveOpts input[data-keepcase] { text-transform: none; }
  #saveOpts input.sv-ro { background: #f3f5f8; color: #374151; }
  #saveOpts .sv-drv { display: flex; align-items: center; gap: 10px; min-height: 34px; }
  #saveOpts .sv-drv input { flex: 1; }
  #saveOpts .sv-link { flex: 1; color: #1d4ed8; text-decoration: underline; font-size: 12px; font-weight: 700; word-break: break-all; }
  #saveOpts .sv-link[hidden], #saveOpts .sv-edit[hidden], #saveOpts .sv-drv input[hidden] { display: none; }
  #saveOpts .sv-edit { width: 34px; height: 34px; border: 1px solid #d6dbe3; border-radius: 6px; background: #fff;
    font-size: 16px; cursor: pointer; flex: none; }
  #saveOpts input[type=text] { height: 34px; border: 1px solid #d6dbe3; border-radius: 6px; padding: 0 10px;
    font-size: 12px; text-transform: uppercase; min-width: 0; }
  #saveOpts .sv-ck { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; }
  #saveOpts .sv-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 18px;
    border-top: 1px solid #e5e9ef; background: #fafbfc; }
  #saveOpts .sv-btn { height: 34px; padding: 0 16px; border: 1px solid #d6dbe3; border-radius: 6px; background: #fff;
    font-size: 12px; font-weight: 800; cursor: pointer; color: #172033; }
  #saveOpts .sv-ok { background: #eef3fb; border-color: #9fb6d9; }
  @media (max-width: 650px) { #saveOpts .sv-body { grid-template-columns: 1fr; } }
  #savedBar a { color: #fff; font-weight: 800; }
  #saveDoc { width: 100%; margin-top: 10px; height: 42px; border: 0; border-radius: 8px; background: #15803d; color: #fff;
             font-weight: 800; font-size: 13px; cursor: pointer; }
  body.locked #side, body.locked #tog { display: none !important; }
  body.locked .mk { pointer-events: none; cursor: default; }
  #savedBar { position: fixed; top: 0; left: 0; right: 0; z-index: 4; height: 62px; display: flex; align-items: center; gap: 12px;
              padding: 0 150px 0 16px; background: #12355b; color: #fff; font: 800 13px Arial, Helvetica, sans-serif; }
  #savedBar[hidden] { display: none; }
  #savedBar span { flex: 1; }
  #savedBar button { height: 34px; padding: 0 14px; border: 0; border-radius: 8px; background: #fff; color: #12355b;
                     font-weight: 800; font-size: 12px; cursor: pointer; }
  body.locked #view { padding-top: 80px; }
  #msg { font-size: 11px; color: #4b5563; margin-top: 10px; min-height: 14px; }
  #tog { position: fixed; top: 14px; left: 254px; z-index: 4; width: 34px; height: 34px; border: 1px solid #d6dbe3;
         border-radius: 8px; background: #fff; font-size: 16px; cursor: pointer; transition: left .2s; }
  body.closed #tog { left: 10px; }
  #close { position: fixed; top: 14px; right: 14px; z-index: 4; height: 34px; padding: 0 14px; border: 1px solid #d6dbe3;
           border-radius: 8px; background: #fff; font-weight: 800; font-size: 12px; cursor: pointer; }
  #view { margin-left: 300px; padding: 20px; transition: margin .2s; overflow: hidden; }
  #pages .page { margin: 0 0 18px; }
  body.closed #view { margin-left: 0; padding-top: 56px; }
  /* ---- pages (A4 paysage, modèle de la société) ---- */
  .page { width: 297mm; height: 209mm; padding: 8mm 12mm 6mm; display: flex; flex-direction: column;
          overflow: hidden; background: #fff; margin: 0 auto 18px; position: relative;
          font-family: "Times New Roman", Times, serif; color: #000; font-size: 11pt; box-shadow: 0 2px 10px rgba(0,0,0,.12); }
  .head { position: relative; min-height: 40mm; flex: none; text-align: center; font-weight: bold; padding-bottom: 4mm; }
  .head img { position: absolute; left: 3mm; top: 0; width: 30mm; height: 30mm; object-fit: cover; }
  .head .date { position: absolute; right: 30mm; top: 15mm; }
  .head .t { padding: 22mm 40mm 0; line-height: 1.55; }
  .content { flex: 1; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  /* lignes compactes, largeurs de colonnes fixes (identiques pour tous les budgets) */
  th, td { border: 1px solid #000; padding: 0.6mm 1.4mm; font-size: 10pt; line-height: 1.15; vertical-align: middle;
           overflow: hidden; overflow-wrap: anywhere; }
  /* en-têtes de tableau : plus hauts, fond gris légèrement foncé */
  th { font-weight: bold; text-align: center; background: #d9dee6; padding-top: 2mm; padding-bottom: 2mm; }
  th.sub { font-size: 10pt; padding: 1mm 0.4mm; }
  td.c { text-align: center; } td.r { text-align: right; }
  /* PAQ (FORMAT 112) : parties en bandeau gris, sous-titres de colonnes, intitulés de tâche */
  table.paq tr.paq-s td { background: #d9dee6; font-size: 11pt !important; padding-top: 2mm; padding-bottom: 2mm; }
  table.paq tr.paq-h td { background: #eef1f6; }
  table.paq tr.paq-t td { background: #f4f6f9; }
  td.rep { color: #555; font-style: italic; }
  tr.gfirst td { border-top: 1.6px solid #000; }
  td.gc, td.lc, td.pc, td.sc { vertical-align: top; }
  /* FORMAT 133 : caractère du modèle DEVIS (10 pt, lignes aérées) pour tous les aperçus */
  table th, table td { font-size: 10pt !important; padding: 1mm 1.4mm; line-height: 1.25; }
  /* clé primaire (quantité comptée) et sous-total par désignation */
  td.pk { font-weight: bold; }
  td.gt { border-left: 1px dotted #999; border-right: 1px dotted #999; }
  /* avant métré : ligne de désignation et sous-titre (lot / activité) */
  tr.mdes td { font-weight: bold; border-top: 1.6px solid #000; }
  tr.msub td:nth-child(2) { font-style: italic; text-decoration: underline; }
  tr.stot td { background: #eef1f6; font-weight: bold; }
  table th { padding-top: 2mm; padding-bottom: 2mm; } table th.sub { padding: 1.2mm 0.4mm; }
  .tot { margin-top: 2mm; display: flex; flex-direction: column; align-items: flex-end; }
  .tot div { display: flex; }
  .tot span { padding: 1mm 2mm; text-align: right; }
  .tot b { width: 30mm; border: 1px solid #000; border-top: 0; padding: 1mm 1.5mm; text-align: right; font-weight: normal; }
  .tot div:first-child b { border-top: 1px solid #000; }
  .arr { margin-top: 6mm; font-weight: bold; line-height: 1.9; }
  .foot { flex: none; text-align: center; font-weight: bold; font-size: 10pt; }
  /* numéro de page en bas à droite : la place libérée sert aux lignes */
  .foot { position: static; padding-top: 1.5mm; }
  /* FORMAT 138 : numéro de page en bas à droite, dans la marge du pied : la place libérée sert aux lignes */
  .foot .pg { position: absolute; right: 12mm; bottom: 4mm; font-size: 9.5pt; font-weight: bold; }
  .foot hr { width: 65%; border: 0; border-top: 2.5px solid #5677a7; margin: 0 auto 1.5mm; }
  .foot .ad { line-height: 1.3; }
  /* signature et cachet : transparents, déplaçables au doigt dans l'aperçu */
  .mk { position: absolute; z-index: 2; cursor: grab; touch-action: none; -webkit-user-select: none; user-select: none;
        -webkit-user-drag: none; }
  .mk.stamp { width: 48mm; transform: rotate(-6deg); }
  .mk.sign { width: 45mm; }
  .mk.drag { outline: 1.5px dashed #2a4fd1; cursor: grabbing; }
  body.nohead .head img { visibility: hidden; }
  body.nofoot .foot .ad, body.nofoot .foot hr { visibility: hidden; }
  /* format portrait (A4 vertical) */
  body.portrait .page { width: 210mm; height: 296mm; }
  /* filigrane PROVISOIRE : budget en instance (rouge) ou figé (vert) */
  .page .wm { position: absolute; inset: 0; z-index: 0; pointer-events: none; display: flex;
              align-items: center; justify-content: center; overflow: hidden; }
  .page .wm span { transform: rotate(-30deg); font-family: Arial, Helvetica, sans-serif; font-weight: 900;
                   font-size: 96pt; letter-spacing: 4mm; white-space: nowrap; color: var(--wm); opacity: .13; }
  body.portrait .page .wm span { font-size: 66pt; transform: rotate(-52deg); }
  .page > .head, .page > .content, .page > .foot { position: relative; z-index: 1; }
  body.portrait .head .date { right: 12mm; }
  body.portrait .head .t { padding-left: 30mm; padding-right: 30mm; }
</style></head><body class="${cfg.portrait ? "portrait" : ""}">
<aside id="side">
  <h2>OPTIONS PDF</h2>
  <div class="sub">CHOISISSEZ LES PARTIES À INCLURE AVANT LA GÉNÉRATION.</div>
  <label class="ck"><input type="checkbox" id="oHead"> ENTÊTE</label>
  <label class="ck"><input type="checkbox" id="oFoot"> PIED DE PAGE</label>
  <label class="ck"><input type="checkbox" id="oSign"> SIGNATURE</label>
  <div class="opt" id="signOpts">
    <span>CHOIX SIGNATURE</span>
    <select id="oSignSrc">
      <option value="saved">SIGNATURE ENREGISTRÉE</option>
      <option value="new">IMPORTER UNE IMAGE…</option>
    </select>
    <span>PAGES SIGNATURE</span>
    <select id="oSignPg"><option value="first">PREMIÈRE PAGE</option><option value="last">DERNIÈRE PAGE</option><option value="all">TOUTES LES PAGES</option></select>
  </div>
  <label class="ck"><input type="checkbox" id="oStamp"> CACHET</label>
  <div class="opt" id="stampOpts">
    <span>PAGES CACHET</span>
    <select id="oStampPg"><option value="first">PREMIÈRE PAGE</option><option value="last">DERNIÈRE PAGE</option><option value="all">TOUTES LES PAGES</option></select>
  </div>
  <div class="sub" style="margin-top:14px">ASTUCE : FAITES GLISSER LA SIGNATURE OU LE CACHET SUR LA PAGE POUR LES PLACER.</div>
  <button type="button" id="gen">GÉNÉRER PDF</button>
  <button type="button" id="prt">IMPRIMER (SANS CLASSER)</button>
  <div class="sub" style="margin-top:8px">GÉNÉRER PDF CLASSE LE DOCUMENT DANS DOCUMENTS. IMPRIMER NE LE CLASSE PAS.</div>
  <div id="msg"></div>
  <div id="saveOpts" hidden><div class="sv-card" role="dialog" aria-modal="true">
    <div class="sv-head"><span>GÉNÉRER ET CLASSER DANS DOCUMENTS</span><button type="button" class="sv-x" id="svX">✕</button></div>
    <div class="sv-body">
      <label class="sv-lab" for="svName">NOM DU FICHIER</label>
      <input type="text" id="svName" readonly class="sv-ro" value="${esc(fileName.replace(/\.pdf$/i, "").replace(/_/g, " "))}">
      <span class="sv-lab">DRIVE</span>
      <label class="sv-ck"><input type="checkbox" id="svDriveOn" checked> COPIE DANS LE DRIVE</label>
      <label class="sv-lab" for="svPath">DOSSIER DRIVE</label>
      <div class="sv-drv" id="svPathRow">
        <a href="#" class="sv-link" id="svLink">${esc(driveLastPath(budget.project, fullRef))}</a>
        <input type="text" id="svPath" data-keepcase value="${esc(driveLastPath(budget.project, fullRef))}" hidden>
        <button type="button" class="sv-edit" id="svEdit" title="Changer de dossier">✎</button>
      </div>
    </div>
    <div class="sv-foot"><button type="button" class="sv-btn" id="svCancel">ANNULER</button>
      <button type="button" class="sv-btn sv-ok" id="svGo">GÉNÉRER ET CLASSER</button></div>
  </div></div>
  <button type="button" id="saveDoc" hidden>ENREGISTRER DANS DOCUMENTS</button>
  <button type="button" id="share" hidden>PARTAGER LE PDF</button>
  <input type="file" id="signFile" accept="image/*" hidden>
</aside>
<button type="button" id="tog" title="Masquer / afficher les options">‹</button>
<div id="savedBar" hidden><span id="savedRef"></span>
  <button type="button" id="share2">PARTAGER</button></div>
<button type="button" id="close">✕ FERMER</button>
<main id="view"><div id="pages"></div></main>

<div id="src" style="display:none">
  <div class="head">
    <img src="${SVI_LOGO}" alt="">
    <div class="date">${dateTxt}</div>
    <div class="t">DEVIS N° : ${esc(fullRef.replace(/\bBDG\b/, "DVC"))}<br>CLIENT : ${esc(sviClient(budget.inst))}<br>PROJET : ${esc(projet)}${cfg.headLine ? "<br>" + esc(cfg.headLine) : ""}</div>
  </div>
  ${/* FORMAT 133 : unités M² / M³ (cellule d'unité seule) */ cfg.table.replace(/(<td[^>]*>)\s*M([23])\s*(<\/td>)/g, (m, a, d, b) => a + "M" + (d === "2" ? "²" : "³") + b)}
  <div id="end">${cfg.end}</div>
  <div class="foot"><div class="pg">Page 1 / 1</div><hr>
    <div class="ad">N°35, Bloc G3 Cité DAKHLA Agadir, BP : 8837 Dakhla Agadir - Tél : 05 28 23 34 31<br>
    Sarl. Au capital de 500 000,00 Dhs - Patente 67505605 - I.F. 60201815 - R.C. 57784 I.C.E. : 003434605000090</div></div>
</div>
<script>
  const WM = ${JSON.stringify(budget && budget.inst && budget.inst.state !== "valide" ? (budget.inst.state === "fige" ? "#15803d" : "#b91c1c") : "")};
  const WMT = ${JSON.stringify(budget && budget.inst && budget.inst.state === "fige" ? "PROVISOIRE" : "EN INSTANCE")};
(function () {
  const STAMP = "${SVI_STAMP}";
  const $ = id => document.getElementById(id);
  const KEY = "svi_printopt_v2", SKEY = "svi_sign_v1";
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
               set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } } };
  let o = { head: true, foot: true, sign: false, signPg: "last", stamp: false, stampPg: "last" };
  try { Object.assign(o, JSON.parse(ls.get(KEY) || "{}")); } catch (e) {}
  /* signature importée sur cet appareil, sinon signature provisoire */
  let signImg = ls.get(SKEY) || "${SVI_SIGN}";

  const src = $("src"), out = $("pages"), tpl = $("tpl");
  /* code aléatoire de l'aperçu, imprimé sur chaque page */
  const newCode = () => {
    const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const r = new Uint32Array(8);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(r) : r.forEach((_, i) => r[i] = Math.random() * 1e9);
    const c = [...r].map(x => A[x % A.length]).join("");
    return c.slice(0, 4) + "-" + c.slice(4);
  };
  let code = newCode();
  const allRows = [...tpl.tBodies[0].rows].map(r => r.outerHTML);

  const build = () => {
    unfit();
    out.innerHTML = "";
    const pages = [];
    const newPage = withTable => {
      const pg = document.createElement("div"); pg.className = "page";
      if (WM) {
        const wm = document.createElement("div"); wm.className = "wm";
        wm.style.setProperty("--wm", WM); wm.innerHTML = "<span>" + WMT + "</span>";
        pg.appendChild(wm);
      }
      pg.appendChild(src.querySelector(".head").cloneNode(true));
      const c = document.createElement("div"); c.className = "content"; pg.appendChild(c);
      let tb = null;
      if (withTable) {
        const t = tpl.cloneNode(true); t.removeAttribute("id"); t.tBodies[0].innerHTML = "";
        c.appendChild(t); tb = t.tBodies[0];
      }
      pg.appendChild(src.querySelector(".foot").cloneNode(true));
      out.appendChild(pg); pages.push(pg);
      return { c, tb };
    };
    /* marge de 3 px : la bordure du bas de la dernière ligne reste visible */
    /* FORMAT 137 : mesure à l'écran (le contenu est son propre repère depuis le filigrane) — aucune ligne coupée en bas */
    const full = c => {
      const cb = c.getBoundingClientRect().top + c.clientHeight;
      const bottom = [...c.children].reduce((m, x) => Math.max(m, x.getBoundingClientRect().bottom), 0);
      return bottom > cb - 3;
    };
    /* cellules fusionnées (rowspan) : désignation, lot, activités répétés
       s'étalent sur les lignes suivantes, sans agrandir la première ligne */
    const MERGE = [["gnext", "gc"], ["lnext", "lc"], ["pnext", "pc"], ["snext", "sc"]];
    const mk = html => {
      const t = document.createElement("tbody"); t.innerHTML = html;
      const r = t.rows[0];
      [...r.cells].forEach((c, i) => { c.dataset.ci = i; });
      return r;
    };
    const place = (tb, r) => {
      tb.appendChild(r);
      const an = tb.__an || (tb.__an = {});
      const used = [];
      [...r.cells].forEach(c => {
        const k = c.dataset.ci;
        const rule = MERGE.find(([rc, cc]) => c.classList.contains(cc) && r.classList.contains(rc));
        if (rule && an[k] && tb.contains(an[k])) {
          an[k].rowSpan += 1; c.remove(); used.push(an[k]);
        } else an[k] = c;
      });
      r.__used = used;
    };
    const unplace = r => { (r.__used || []).forEach(a => { a.rowSpan -= 1; }); r.remove(); };
    /* première ligne d'une page : groupe rappelé, trait du haut visible */
    const first = r => {
      r.classList.remove("gnext", "lnext", "pnext", "snext");
      if (r.dataset.rep) JSON.parse(r.dataset.rep).forEach((v, k) => {
        const c = r.cells[k];
        if (c && !c.textContent.trim() && v) { c.textContent = v; c.classList.add("rep"); }
      });
    };
    let cur = newPage(true);
    allRows.forEach(html => {
      let r = mk(html); r.__h = html;
      place(cur.tb, r);
      if (full(cur.c) && cur.tb.rows.length > 1) {
        unplace(r);
        cur = newPage(true);
        r = mk(html); r.__h = html; first(r); place(cur.tb, r);
      }
    });
    const end = src.querySelector("#end").cloneNode(true);
    cur.c.appendChild(end);
    if (full(cur.c)) {
      cur.c.removeChild(end);
      const prev = cur.tb;
      const n = prev ? Math.min(2, prev.rows.length - 1) : 0;
      const moved = n > 0 ? [...prev.rows].slice(-n) : [];
      moved.slice().reverse().forEach(unplace);
      cur = newPage(moved.length > 0);
      moved.forEach((m, i) => { const r = mk(m.__h); r.__h = m.__h; if (!i) first(r); place(cur.tb, r); });
      cur.c.appendChild(end);
    }
    const on = (pg, i) => pg === "all" || (pg === "first" && i === 0) || (pg === "last" && i === pages.length - 1);
    const mark = (pg, k, src) => {
      const p = posGet(k);
      const im = document.createElement("img");
      im.className = "mk " + k; im.dataset.k = k; im.src = src; im.draggable = false;
      im.style.left = p.x + "mm"; im.style.top = p.y + "mm";
      pg.appendChild(im);
    };
    pages.forEach((pg, i) => {
      pg.querySelector(".pg").textContent = "Page " + (i + 1) + " / " + pages.length;
      if (o.sign && signClear && on(o.signPg, i)) mark(pg, "sign", signClear);
      if (o.stamp && stampClear && on(o.stampPg, i)) mark(pg, "stamp", stampClear);
    });
    document.body.classList.toggle("nohead", !o.head);
    document.body.classList.toggle("nofoot", !o.foot);
    /* FORMAT 111 : cases des totaux exactement sous la dernière colonne du tableau (MONTANT) */
    out.querySelectorAll(".tot").forEach(t => {
      const tbs = [...out.querySelectorAll("table")].filter(x => x.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING);
      const tb = tbs[tbs.length - 1];
      if (!tb || !tb.rows.length) return;
      const row = tb.rows[tb.rows.length - 1], cell = row.cells[row.cells.length - 1];
      if (!cell) return;
      const cr = cell.getBoundingClientRect(), tr = t.getBoundingClientRect();
      t.querySelectorAll("b").forEach(b => { b.style.width = cr.width + "px"; });
      t.style.marginRight = Math.max(0, tr.right - cr.right) + "px";
    });
    fit();
  };
  /* positions par défaut (mm depuis le coin haut-gauche de la page) */
  const PORT = ${cfg.portrait ? "true" : "false"}, PW = PORT ? 210 : 297, PH = PORT ? 297 : 210;
  const DEF_POS = PORT ? { sign: { x: 100, y: 235 }, stamp: { x: 145, y: 225 } }
    : { sign: { x: 185, y: 150 }, stamp: { x: 230, y: 140 } };
  /* position mémorisée par type d'aperçu, reprise pour tous les budgets */
  const PKEY = "svi_markpos_v1", PTYPE = ${JSON.stringify(cfg.fileTag)};
  const posAll = () => { try { return JSON.parse(ls.get(PKEY) || "{}") || {}; } catch (e) { return {}; } };
  const posGet = k => ((posAll()[PTYPE] || {})[k]) || o[k + "Pos"] || DEF_POS[k];
  const posSet = (k, p) => { const a = posAll(); a[PTYPE] = a[PTYPE] || {}; a[PTYPE][k] = p; ls.set(PKEY, JSON.stringify(a)); };
  /* fond blanc rendu transparent : la signature / le cachet se superposent au texte */
  let signClear = null, stampClear = null;
  const clearWhite = src => new Promise(ok => {
    if (!src) return ok(null);
    const im = new Image();
    im.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = im.naturalWidth; cv.height = im.naturalHeight;
      const g = cv.getContext("2d");
      g.drawImage(im, 0, 0);
      try {
        const d = g.getImageData(0, 0, cv.width, cv.height), a = d.data;
        for (let i = 0; i < a.length; i += 4) {
          const m = Math.min(a[i], a[i + 1], a[i + 2]);
          /* blanc → transparent, gris clair → semi-transparent */
          if (m > 235) a[i + 3] = 0;
          else if (m > 190) a[i + 3] = Math.round(a[i + 3] * (235 - m) / 45);
        }
        g.putImageData(d, 0, 0);
        ok(cv.toDataURL("image/png"));
      } catch (e) { ok(src); }
    };
    im.onerror = () => ok(src);
    im.src = src;
  });
  const prepMarks = async () => {
    [signClear, stampClear] = await Promise.all([clearWhite(signImg), clearWhite(STAMP)]);
  };

  /* glisser la signature ou le cachet : nouvelle position pour toutes les pages */
  let scale = 1;
  out.addEventListener("pointerdown", e => {
    const im = e.target.closest(".mk");
    if (!im || document.body.classList.contains("locked")) return;
    e.preventDefault();
    const k = im.dataset.k;
    const pxmm = 96 / 25.4;
    const start = { x: e.clientX, y: e.clientY };
    const p0 = Object.assign({}, posGet(k));
    let p = p0;
    im.classList.add("drag");
    const mv = ev => {
      ev.preventDefault();
      p = { x: Math.round((p0.x + (ev.clientX - start.x) / scale / pxmm) * 10) / 10,
            y: Math.round((p0.y + (ev.clientY - start.y) / scale / pxmm) * 10) / 10 };
      p.x = Math.max(0, Math.min(PW - 15, p.x)); p.y = Math.max(0, Math.min(PH - 10, p.y));
      im.style.left = p.x + "mm"; im.style.top = p.y + "mm";
    };
    const tm = ev => ev.preventDefault();
    const up = () => {
      document.removeEventListener("pointermove", mv);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      document.removeEventListener("touchmove", tm);
      im.classList.remove("drag");
      posSet(k, p);
      save();
    };
    document.addEventListener("pointermove", mv, { passive: false });
    document.addEventListener("touchmove", tm, { passive: false });
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  });

  /* réduction à l'écran par « transform » (ne change pas la mise en page) */
  const fit = () => {
    const pg = out.querySelector(".page");
    if (!pg) return;
    const avail = $("view").clientWidth - 40;
    const z = Math.min(1, avail / pg.offsetWidth);
    scale = z;
    out.style.transformOrigin = "top left";
    out.style.transform = "scale(" + z + ")";
    out.style.width = pg.offsetWidth + "px";
    out.style.marginLeft = Math.max(0, (avail - pg.offsetWidth * z) / 2) + "px";
    $("view").style.height = (out.offsetHeight * z + 60) + "px";
  };
  const unfit = () => { out.style.transform = "none"; out.style.marginLeft = "0"; };

  /* options ↔ formulaire */
  const sync = () => {
    $("oHead").checked = o.head; $("oFoot").checked = o.foot;
    $("oSign").checked = o.sign; $("oStamp").checked = o.stamp;
    $("oSignPg").value = o.signPg; $("oStampPg").value = o.stampPg;
    $("oSignSrc").value = "saved";
    $("signOpts").classList.toggle("dis", !o.sign);
    $("stampOpts").classList.toggle("dis", !o.stamp);
    $("msg").textContent = o.sign && !signImg ? "AUCUNE SIGNATURE ENREGISTRÉE : CHOISISSEZ « IMPORTER UNE IMAGE… »" : "";
  };
  const save = () => {
    ls.set(KEY, JSON.stringify(o));
    /* contenu modifié après enregistrement : c'est un autre document, nouveau code */
    if (savedCodes[code]) code = newCode();
    lastPdf = null; $("share").hidden = true; $("saveDoc").hidden = true;
    sync(); build();
  };
  $("oHead").onchange = e => { o.head = e.target.checked; save(); };
  $("oFoot").onchange = e => { o.foot = e.target.checked; save(); };
  $("oSign").onchange = e => { o.sign = e.target.checked; save(); };
  $("oStamp").onchange = e => { o.stamp = e.target.checked; save(); };
  $("oSignPg").onchange = e => { o.signPg = e.target.value; save(); };
  $("oStampPg").onchange = e => { o.stampPg = e.target.value; save(); };
  $("oSignSrc").onchange = e => { if (e.target.value === "new") $("signFile").click(); e.target.value = "saved"; };
  $("signFile").onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        /* signature réduite (≤ 600 px) pour rester légère */
        const k = Math.min(1, 600 / Math.max(im.width, im.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
        cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
        signImg = cv.toDataURL("image/png");
        ls.set(SKEY, signImg);
        o.sign = true;
        prepMarks().then(save);
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(f);
  };
  $("tog").onclick = () => {
    document.body.classList.toggle("closed");
    $("tog").textContent = document.body.classList.contains("closed") ? "›" : "‹";
    setTimeout(fit, 220);
  };
  $("close").onclick = () => window.close();
  window.addEventListener("resize", fit);

  /* GÉNÉRER PDF : vrai fichier PDF A4 paysage */
  const load = u => new Promise((ok, ko) => {
    if ((u.includes("html2canvas") && window.html2canvas) || (u.includes("jspdf") && window.jspdf)) return ok();
    const sc = document.createElement("script"); sc.src = u; sc.onload = ok; sc.onerror = ko;
    setTimeout(() => ko(new Error("délai dépassé")), 15000);
    document.head.appendChild(sc);
  });
  let lastPdf = null;
  /* enregistrement direct (si la page du budget n'est plus joignable) */
  const saveHere = (blob, title, name, code, fp) => new Promise((ok, ko) => {
    const KEYD = "svi_docs_v1:" + ${JSON.stringify(String(ref))};
    let list = [];
    try { list = JSON.parse(localStorage.getItem(KEYD) || "[]") || []; } catch (e) {}
    const d = new Date(), p2 = n => String(n).padStart(2, "0");
    const day = p2(d.getFullYear() % 100) + "-" + p2(d.getMonth() + 1) + p2(d.getDate());
    const PFX = ${JSON.stringify(String(budget.project).trim().toUpperCase() + " BDG ")};
    const n = list.filter(x => String(x.ref).startsWith(PFX + "DOC " + day)).length + 1;
    const docRef = PFX + "DOC " + day + "/" + String(n).padStart(3, "0");
    const idb = "doc:" + ${JSON.stringify(String(ref))} + ":" + docRef;
    const r = indexedDB.open("svi_files", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("f");
    r.onerror = () => ko(r.error);
    r.onsuccess = () => {
      const t = r.result.transaction("f", "readwrite");
      t.objectStore("f").put(blob, idb);
      t.oncomplete = () => {
        list.push({ ref: docRef, date: d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + "T" + p2(d.getHours()) + ":" + p2(d.getMinutes()),
          title: title.toUpperCase(), name, size: blob.size, type: "application/pdf", data: null, idb, code, fp });
        localStorage.setItem(KEYD, JSON.stringify(list));
        ok(docRef);
      };
      t.onerror = () => ko(t.error);
    };
  });
  /* enregistrement dans DOCUMENTS : une seule fois par code d'aperçu,
     après un partage / enregistrement réussi */
  const savedCodes = {};
  /* document enregistré : configuration masquée, document figé
     (on le rouvrira ensuite depuis la liste DOCUMENTS) */
  const lockSaved = ref => {
    document.body.classList.add("locked", "closed");
    $("savedRef").textContent = "ENREGISTRÉ DANS DOCUMENTS : " + ref;
    $("savedBar").hidden = false;
    setTimeout(fit, 220);
  };
  const saveOnce = async (blob, name) => {
    const msg = $("msg");
    if (savedCodes[code]) { msg.textContent = "DÉJÀ ENREGISTRÉ DANS DOCUMENTS : " + savedCodes[code]; return; }
    const title = ${JSON.stringify(cfg.docTitle)};
    let saved = null, err = "";
    try {
      if (window.opener && !window.opener.closed && window.opener.__sviSavePdfDoc)
        saved = await window.opener.__sviSavePdfDoc(blob, title, name, code, ${JSON.stringify(fp)});
    } catch (e) { err = e && e.message ? e.message : String(e); }
    if (!saved) {
      try { saved = await saveHere(blob, title, name, code, ${JSON.stringify(fp)}); }
      catch (e) { err = err || (e && e.message ? e.message : String(e)); }
    }
    if (saved) { savedCodes[code] = saved; lockSaved(saved); }
    msg.textContent = saved
      ? "ENREGISTRÉ DANS DOCUMENTS : " + saved
      : "NON ENREGISTRÉ DANS DOCUMENTS" + (err ? " (" + err + ")" : "");
    /* copie dans le Drive, dans le dossier choisi */
    if (saved && $("svDriveOn").checked && window.opener && !window.opener.closed && window.opener.__sviDriveSave) {
      const path = ($("svPath").hidden ? $("svLink").textContent : $("svPath").value).trim();
      const bar = $("savedRef");
      bar.textContent = "ENREGISTRÉ DANS DOCUMENTS : " + saved + " — ENVOI DANS LE DRIVE…";
      try {
        const r = await window.opener.__sviDriveSave(blob, name, path);
        bar.innerHTML = "ENREGISTRÉ DANS DOCUMENTS : " + saved + " — DRIVE : " +
          (r.path || "MON DRIVE").replace(/[<>&]/g, "") + (r.url ? ' <a href="' + r.url + '" target="_blank" rel="noopener">OUVRIR</a>' : "");
        try { window.opener.__sviDocSetDrive && window.opener.__sviDocSetDrive(saved, r.url, r.path); } catch (e) {}
      } catch (e) {
        bar.textContent = "ENREGISTRÉ DANS DOCUMENTS : " + saved + " — PAS DANS LE DRIVE (" + (e && e.message ? e.message : e) + ")";
      }
    }
  };
  $("share2").onclick = () => $("share").onclick();
  $("share").onclick = async () => {
    if (!lastPdf || !savedCodes[code]) return;
    const { blob, file } = lastPdf;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: file.name }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = file.name; a.target = "_blank";
    document.body.appendChild(a); a.click(); a.remove();
  };
  /* seul ENREGISTRER ajoute le document à la liste DOCUMENTS (une fois) */
  $("saveDoc").onclick = () => {
    if (!lastPdf || savedCodes[code]) return;
    $("saveOpts").hidden = false;
  };
  $("svX").onclick = $("svCancel").onclick = () => { $("saveOpts").hidden = true; };
  /* dossier Drive affiché seulement si la copie Drive est cochée */
  const svRow = () => {
    const on = $("svDriveOn").checked;
    $("svPathRow").style.display = on ? "" : "none";
    document.querySelector('label[for="svPath"]').style.display = on ? "" : "none";
  };
  $("svDriveOn").onchange = svRow;
  /* adresse du dossier en lien bleu : ouvre le Drive ; ✎ : la changer (copier-coller) */
  const svShowLink = () => {
    const v = $("svPath").value.trim();
    if (v) $("svLink").textContent = v;
    $("svPath").hidden = true; $("svLink").hidden = false; $("svEdit").hidden = false;
  };
  $("svEdit").onclick = () => {
    $("svPath").value = $("svLink").textContent;
    $("svLink").hidden = true; $("svEdit").hidden = true; $("svPath").hidden = false;
    $("svPath").focus(); $("svPath").select();
  };
  $("svPath").onblur = svShowLink;
  $("svPath").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); svShowLink(); } };
  $("svLink").onclick = async e => {
    e.preventDefault();
    const op = window.opener;
    if (!op || op.closed || !op.__sviDriveFolderUrl) return;
    const w = window.open("", "_blank");
    try {
      const url = await op.__sviDriveFolderUrl($("svLink").textContent.trim());
      if (op.__sviOpenGoogle) op.__sviOpenGoogle(url, w); else if (w) w.location.href = url; else window.open(url, "_blank");
    } catch (err) {
      if (w) w.close();
      (function (m) { var d = document.createElement("div"); d.textContent = m; d.style.cssText = "position:fixed;left:50%;top:40%;transform:translateX(-50%);max-width:90vw;background:#fff;border:1.5px solid #b91c1c;color:#b91c1c;padding:12px 16px;border-radius:10px;font:800 12px Arial,sans-serif;z-index:99999;box-shadow:0 10px 30px rgba(15,23,42,.2)"; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 6000); })("OUVERTURE DU DOSSIER IMPOSSIBLE : " + String(op.__sviDriveErr ? op.__sviDriveErr(err) : err).toUpperCase());
    }
  };
  svRow();
  /* FORMAT 106 : GÉNÉRER PDF = générer puis classer dans DOCUMENTS (options Drive d'abord) */
  $("svGo").onclick = async () => {
    $("saveOpts").hidden = true;
    if (!(await genPdf())) return;
    const nm = ($("svName").value.trim().toUpperCase() || lastPdf.file.name.replace(/\\.pdf$/i, ""))
      .replace(/[\\/:*?"<>|]+/g, "-") + ".pdf";
    lastPdf.file = new File([lastPdf.blob], nm, { type: "application/pdf" });
    await saveOnce(lastPdf.blob, nm);
  };
  $("gen").onclick = () => { if (savedCodes[code]) return; $("saveOpts").hidden = false; };
  /* IMPRIMER : l'aperçu (filigrane compris) sans classement */
  $("prt").onclick = () => {
    let st = document.getElementById("prtPage");
    if (!st) { st = document.createElement("style"); st.id = "prtPage"; document.head.appendChild(st); }
    st.textContent = "@page { size: A4 " + (PORT ? "portrait" : "landscape") + "; margin: 0; }";
    unfit();
    const back = () => { fit(); window.removeEventListener("afterprint", back); };
    window.addEventListener("afterprint", back);
    window.print();
    setTimeout(back, 1500);
  };
  const genPdf = async () => {
    const btn = $("gen"), msg = $("msg");
    let ok = false;
    btn.disabled = true;
    try {
      msg.textContent = "PRÉPARATION DU PDF…";
      await load("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
      await load("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
      unfit();
      const pdf = new window.jspdf.jsPDF({ orientation: PORT ? "portrait" : "landscape", unit: "mm", format: "a4" });
      const pgs = [...out.querySelectorAll(".page")];
      for (let i = 0; i < pgs.length; i++) {
        msg.textContent = "PRÉPARATION DU PDF… PAGE " + (i + 1) + " / " + pgs.length;
        const cv = await html2canvas(pgs[i], { scale: 2, backgroundColor: "#ffffff" });
        if (i) pdf.addPage("a4", PORT ? "portrait" : "landscape");
        pdf.addImage(cv.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, PW, PH);
      }
      fit();
      const blob = pdf.output("blob");
      const file = new File([blob], "${fileName}", { type: "application/pdf" });
      msg.textContent = "PDF PRÊT — CLASSEMENT DANS DOCUMENTS…";
      lastPdf = { blob, file };
      ok = true;
    } catch (e) {
      msg.textContent = "PDF IMPOSSIBLE : " + (e && e.message ? e.message : e);
      fit();
    }
    btn.disabled = false;
    return ok;
  };

  sync();
  build();
  prepMarks().then(build);
  /* mise en page refaite une fois les polices chargées (hauteurs exactes) */
  try { document.fonts && document.fonts.ready.then(() => build()); } catch (e) {}
  window.addEventListener("load", () => build());
})();
<\/script></body></html>`);
      w.document.close();
    };


    const printClient = () => {
      const src = lastShown.client;
      if (!src || !src.rows.length) { sviAlert("Aucune désignation à afficher."); return; }
      if (src.ins) return printClientIns(src.rows);
      const rows = [...src.rows].sort((a, b) =>
        String(a.article).localeCompare(String(b.article), "fr", { numeric: true }));
      const td = (v, cls = "") => `<td class="${cls}">${v}</td>`;
      const body = rows.map(g => {
        const pu = Math.round(g.price * 100) / 100;
        return `<tr>${td(esc(g.article), "c")}${td(esc(g.designation))}${td(esc(g.unit), "c")}` +
          `${td(money(g.qty), "r")}${td(money(pu), "r")}${td(esc(frMoney(pu)), "c")}${td(money(g.ht), "r")}</tr>`;
      }).join("");
      const ht = rows.reduce((t, g) => t + g.ht, 0);
      const tva = ht * 0.2, ttc = ht + tva;
      printModel({
        branch: "DÉSIGNATIONS CLIENT", docTitle: "DÉSIGNATIONS CLIENT", fileTag: "DESIGNATIONS CLIENT", headLine: "",
        table: `<table id="tpl"><colgroup><col style="width:6%"><col style="width:37%"><col style="width:4%"><col style="width:9%">
          <col style="width:9%"><col style="width:25%"><col style="width:10%"></colgroup>
          <thead><tr><th rowspan="2">ART.</th><th rowspan="2">DESIGNATION</th><th rowspan="2">U</th><th rowspan="2">QUANTITE</th>
            <th colspan="2">PRIX UNITAIRES HORS TVA</th><th rowspan="2">MONTANT HT</th></tr>
            <tr><th class="sub">EN CHIFFRES</th><th class="sub">EN LETTRES</th></tr></thead>
          <tbody>${body}</tbody></table>`,
        end: `<div class="tot">
            <div><span>TOTAL H.T. :</span><b>${money(ht)}</b></div>
            <div><span>TOTAL T.V.A. :</span><b>${money(tva)}</b></div>
            <div><span>TOTAL T.T.C. :</span><b>${money(ttc)}</b></div>
          </div>
          <div class="arr">ARRÊTER LE PRÉSENT DEVIS À LA SOMME DE :<br>${esc(frMoney(ttc))} TOUTES TAXES COMPRISES</div>`
      });
    };

    /* budget en instance : même modèle, avec lignes titres et sous-totaux */
    const printClientIns = rows => {
      const td = (v, cls = "") => `<td class="${cls}">${v}</td>`;
      const hid = insHiddenFn();
      const body = insOrder(rows).filter(x => !x.sub && !hid(x.r)).map(x => {
        if (x.sub) {
          const { ht } = insSubOf(x.sub);
          return `<tr>${td("")}${td("<b>TOTAL " + esc(x.sub.des || x.sub.art || "") + "</b>", "r")}${td("")}${td("")}${td("")}${td("")}${td("<b>" + money(ht) + "</b>", "r")}</tr>`;
        }
        const r = x.r;
        if (r.t) return `<tr>${td("<b>" + esc(artOf(r)) + "</b>", "c")}${td("<b>" + esc(r.des || "") + "</b>")}${td("")}${td("")}${td("")}${td("")}${td("")}</tr>`;
        const pu = Math.round(num(r.p || 0) * 100) / 100;
        return `<tr>${td(esc(artOf(r)), "c")}${td(esc(r.des || ""))}${td(esc(r.u || ""), "c")}` +
          `${td(money(insQty("des", r)), "r")}${td(money(pu), "r")}${td(esc(frMoney(pu)), "c")}${td(money(insHT("des", r)), "r")}</tr>`;
      }).join("");
      const ls = rows.filter(r => !r.t);
      const ht = ls.reduce((t, r) => t + insHT("des", r), 0);
      const ttc = ls.reduce((t, r) => t + insTTC("des", r), 0);
      const tva = ttc - ht;
      printModel({
        branch: "DÉSIGNATIONS CLIENT", docTitle: "DÉSIGNATIONS CLIENT", fileTag: "DESIGNATIONS CLIENT", headLine: "",
        table: `<table id="tpl"><colgroup><col style="width:6%"><col style="width:37%"><col style="width:4%"><col style="width:9%">
          <col style="width:9%"><col style="width:25%"><col style="width:10%"></colgroup>
          <thead><tr><th rowspan="2">ART.</th><th rowspan="2">DESIGNATION</th><th rowspan="2">U</th><th rowspan="2">QUANTITE</th>
            <th colspan="2">PRIX UNITAIRES HORS TVA</th><th rowspan="2">MONTANT HT</th></tr>
            <tr><th class="sub">EN CHIFFRES</th><th class="sub">EN LETTRES</th></tr></thead>
          <tbody>${body}</tbody></table>`,
        end: `<div class="tot">
            <div><span>TOTAL H.T. :</span><b>${money(ht)}</b></div>
            <div><span>TOTAL T.V.A. :</span><b>${money(tva)}</b></div>
            <div><span>TOTAL T.T.C. :</span><b>${money(ttc)}</b></div>
          </div>
          <div class="arr">ARRÊTER LE PRÉSENT DEVIS À LA SOMME DE :<br>${esc(frMoney(ttc))} TOUTES TAXES COMPRISES</div>`
      });
    };

    /* TÂCHES : pour chaque désignation client, ses lots et ses activités
       primaires / secondaires avec leurs unités */
    /* export FORMAT INTERNE : une ligne par produit, valeurs complètes */
    const interneData = () => {
      const src = lastShown.client;
      const head = ["ART.", "DESIGNATION", "UPB", "LOT", "ACTIVITÉ PRIMAIRE", "ACTIVITÉ SECONDAIRE",
        "DÉSIGNATION PRODUIT", "UPB", "NBR", "DIM 1", "DIM 2", "DIM 3", "QPB", "CLÉ PRIMAIRE"];
      if (!src) return { head, rows: [] };
      const rows = [], bold = [];
      [...src.rows].sort((a, b) => String(a.article).localeCompare(String(b.article), "fr", { numeric: true }))
        .forEach(g => {
          let q = 0;
          (g.members || []).filter(l => l.kind === "prd").forEach(l => {
            if (l.cprice !== 0) q += Number(l.qty) || 0;
            rows.push([g.article, g.designation, g.unit, l.lot, l.prim, l.sec, l.detail, l.dunit || l.unit,
              l.nbr, l.dims[0], l.dims[1], l.dims[2], l.qty, l.cprice !== 0 ? "OUI" : "NON"]);
          });
          bold.push(rows.length);
          rows.push(["", "SOUS-TOTAL ART. " + g.article + " — " + g.designation, g.unit, "", "", "", "", "", "", "", "", "", q, ""]);
        });
      return { head, rows, bold };
    };


    /* FORMAT MÉTRÉ (modèle « Détail métré ») : pour chaque désignation client,
       la quantité (clés primaires), puis par lot / activité les lignes de calcul
       NB × longueur × largeur × hauteur = quantité partielle */
    const metreGroups = () => {
      const src = lastShown.client;
      if (!src) return [];
      const U = v => String(v ?? "").trim().toUpperCase();
      return [...src.rows].sort((a, b) => String(a.article).localeCompare(String(b.article), "fr", { numeric: true }))
        .map(g => {
          const pk = (g.members || []).filter(l => l.kind === "prd" && l.cprice !== 0);
          const subs = new Map();
          pk.forEach(l => {
            /* regroupement par activité primaire (sans intitulé), activités secondaires ignorées */
            const k = U(l.prim);
            if (!subs.has(k)) subs.set(k, { title: "", lines: [] });
            subs.get(k).lines.push(l);
          });
          return { g, qty: pk.reduce((t, l) => t + (Number(l.qty) || 0), 0), subs: [...subs.values()] };
        });
    };
    const metreData = () => {
      const head = ["N°", "DÉSIGNATIONS", "U", "QUANTITÉ", "NB", "LONG", "LARG", "H OU EP", "QUANTITÉ PARTIELLE"];
      const rows = [], bold = [];
      metreGroups().forEach(({ g, qty, subs }) => {
        bold.push(rows.length);
        rows.push([g.article, g.designation, g.unit, qty, "", "", "", "", ""]);
        subs.forEach(sb => {
          if (sb.title) rows.push(["", sb.title, "", "", "", "", "", "", ""]);
          sb.lines.forEach(l => rows.push(["", l.detail, "", "", l.nbr, l.dims[0], l.dims[1], l.dims[2], l.qty]));
        });
      });
      return { head, rows, bold };
    };
    const printMetre = () => {
      const groups = metreGroups();
      if (!groups.length) { sviAlert("Aucune désignation à afficher."); return; }
      const td = (v, cls = "") => `<td class="${cls}">${v}</td>`;
      const dim = v => esc(String(v ?? ""));
      let body = "";
      groups.forEach(({ g, qty, subs }) => {
        body += `<tr class="mdes">${td(esc(g.article), "c")}${td(esc(g.designation))}${td(esc(g.unit), "c")}` +
          `${td(esc(money(qty)), "r")}${td("")}${td("")}${td("")}${td("")}${td("")}</tr>`;
        subs.forEach(sb => {
          if (sb.title) body += `<tr class="msub">${td("")}${td(esc(sb.title))}${td("").repeat(7)}</tr>`;
          sb.lines.forEach(l => {
            body += `<tr>${td("")}${td(esc(l.detail))}${td("")}${td("")}${td(dim(l.nbr), "c")}` +
              `${td(dim(l.dims[0]), "r")}${td(dim(l.dims[1]), "r")}${td(dim(l.dims[2]), "r")}${td(esc(money(l.qty)), "r")}</tr>`;
          });
        });
      });
      printModel({
        branch: "DÉTAIL PRODUITS", docTitle: "AVANT MÉTRÉ", fileTag: "AVANT METRE", headLine: "AVANT MÉTRÉ", portrait: true,
        table: `<table id="tpl"><colgroup><col style="width:6%"><col style="width:38%"><col style="width:5%"><col style="width:10%">
            <col style="width:5%"><col style="width:8%"><col style="width:8%"><col style="width:8%"><col style="width:12%"></colgroup>
          <thead><tr><th rowspan="2">N°</th><th rowspan="2">DÉSIGNATIONS</th><th rowspan="2">U</th><th rowspan="2">QUANTITÉ</th>
            <th rowspan="2">NB</th><th colspan="3">DIMENSIONS</th><th rowspan="2">QUANTITÉ PARTIELLE</th></tr>
            <tr><th class="sub">LONG</th><th class="sub">LARG</th><th class="sub">H OU EP</th></tr></thead>
          <tbody>${body}</tbody></table>`,
        end: ""
      });
    };

    /* mode "prd" : décomposition + détail produits (aperçu TÂCHES)
       mode "chg" : décomposition (avec U) + détail charges (aperçu DÉTAIL CHARGES) */
    const printTasks = (mode = "prd") => {
      const CHG = mode === "chg", PLAIN = mode === "plain";
      const src = lastShown.client;
      if (!src || !src.rows.length) { sviAlert("Aucune désignation à afficher."); return; }
      const U = v => String(v ?? "").trim().toUpperCase();
      const groups = [...src.rows].sort((a, b) =>
        String(a.article).localeCompare(String(b.article), "fr", { numeric: true }));
      const lotOrd = new Map((db.lots || []).map(x => [U(stripLevelPrefix(x.name)), Number(x.order) || 0]));
      const primOrd = new Map((db.primaries || []).map(x => [U(stripLevelPrefix(x.name)), Number(x.order) || 0]));
      const secOrd = new Map((db.secondaries || []).map(x => [U(stripLevelPrefix(x.name)), Number(x.order) || 0]));
      const o = (m, v) => m.has(U(v)) ? m.get(U(v)) : 1e9;
      /* unité d'une activité : unités des lignes de la désignation dans cette activité
         (clés primaires d'abord, sinon toutes les lignes produit, sinon toutes) */
      const unitOf = (members, pick, v) => {
        const ls = members.filter(l => U(pick(l)) === U(v));
        const pref = ls.filter(l => l.kind === "prd" && l.cprice !== 0);
        const use = pref.length ? pref : ls.filter(l => l.kind === "prd").length ? ls.filter(l => l.kind === "prd") : ls;
        return [...new Set(use.map(l => U(l.dunit || l.unit)).filter(Boolean))].join(" / ");
      };
      const td = (v, cls = "") => `<td class="${cls}">${v}</td>`;
      let body = "", totHT = 0, totTVA = 0;
      groups.forEach(g => {
        const members = g.members || [];
        const combos = new Map();
        members.forEach(l => {
          const k = [l.lot, l.prim, l.sec].map(U).join("||");
          if (!combos.has(k)) combos.set(k, { lot: l.lot, prim: l.prim, sec: l.sec });
        });
        const list = [...combos.values()].sort((a, b) =>
          o(lotOrd, a.lot) - o(lotOrd, b.lot) || o(primOrd, a.prim) - o(primOrd, b.prim) || o(secOrd, a.sec) - o(secOrd, b.sec));
        if (!list.length) list.push({ lot: "", prim: "", sec: "" });
        /* une ligne par produit de l'activité secondaire (colonnes du détail produits) ;
           valeurs répétées laissées vides (désignation, lot, activités) */
        const rowsG = [];
        let subQ = 0, subN = 0;
        list.forEach(c => {
          const prods = PLAIN ? [] : members.filter(l => l.kind === (CHG ? "chg" : "prd") &&
            U(l.lot) === U(c.lot) && U(l.prim) === U(c.prim) && U(l.sec) === U(c.sec));
          if (prods.length) prods.forEach(l => rowsG.push({ c, l }));
          else rowsG.push({ c, l: null });
        });
        let prev = null;
        rowsG.forEach(({ c, l }, i) => {
          const sameLot = prev && U(prev.lot) === U(c.lot);
          const samePrim = sameLot && U(prev.prim) === U(c.prim);
          const sameSec = samePrim && U(prev.sec) === U(c.sec);
          const full = [String(g.article ?? ""), String(g.designation ?? ""), String(g.unit ?? ""),
            String(c.lot ?? ""), String(c.prim ?? ""), String(c.sec ?? "")];
          const num = v => (v === null || v === undefined || v === "") ? "" : esc(money(v));
          const dim = v => esc(String(v ?? ""));
          /* sans prix, montants ni TVA ; produits : les clés primaires
             (prix non nul) sont en gras, seules leurs quantités sont totalisées */
          const pk = l && !CHG && l.cprice !== 0 ? " pk" : "";
          if (pk) subQ += Number(l.qty) || 0, subN++;
          const pr = PLAIN ? "" : CHG
            ? (l ? [td(esc(l.detail)), td(esc(l.dunit || l.unit), "c"), td(num(l.qty), "r")].join("") : td("").repeat(3))
            : (l ? [
                td(esc(l.detail), pk), td(esc(l.dunit || l.unit), "c" + pk), td(dim(l.nbr), "r" + pk),
                td(dim(l.dims[0]), "r" + pk), td(dim(l.dims[1]), "r" + pk), td(dim(l.dims[2]), "r" + pk),
                td(num(l.qty), "r" + pk)
              ].join("") : td("").repeat(7));
          const uSec = (CHG || PLAIN) ? td(sameSec ? "" : esc(unitOf(members, x => x.sec, c.sec)), "c sc") : "";

          body += `<tr class="${i ? "gnext" : "gfirst"}${sameLot ? " lnext" : ""}${samePrim ? " pnext" : ""}${sameSec ? " snext" : ""}"${i ? ` data-rep="${esc(JSON.stringify(full))}"` : ""}>` +
            td(i ? "" : esc(g.article), "c gc") + td(i ? "" : esc(g.designation), "gc") + td(i ? "" : esc(g.unit), "c gc") +
            td(sameLot ? "" : esc(c.lot), "lc") + td(samePrim ? "" : esc(c.prim), "pc") +
            td(sameSec ? "" : esc(c.sec), "sc") + uSec + pr + "</tr>";
          prev = c;
        });
        if (!CHG && !PLAIN) {
          body += `<tr class="stot"><td colspan="12" class="r">SOUS-TOTAL ART. ${esc(g.article)} — ${esc(g.designation)}` +
            ` (${esc(g.unit)})</td><td class="r">${esc(money(subQ))}</td></tr>`;
        }
      });
      if (PLAIN) {
        printModel({
          branch: "TÂCHES", docTitle: "DÉCOMPOSITION DU PROJET", fileTag: "DECOMPOSITION DU PROJET", headLine: "DÉCOMPOSITION DU PROJET",
          table: `<table id="tpl"><colgroup><col style="width:5%"><col style="width:30%"><col style="width:5%"><col style="width:15%">
              <col style="width:20%"><col style="width:20%"><col style="width:5%"></colgroup>
            <thead><tr><th>ART.</th><th>DESIGNATION</th><th>UPB</th><th>LOT</th>
              <th>ACTIVITÉ PRIMAIRE</th><th>ACTIVITÉ SECONDAIRE</th><th>U</th></tr></thead>
            <tbody>${body}</tbody></table>`,
          end: ""
        });
        return;
      }
      if (CHG) {
        printModel({
          branch: "DÉTAIL CHARGES", docTitle: "DÉTAIL CHARGES", fileTag: "DETAIL CHARGES", headLine: "DÉTAIL CHARGES",
          table: `<table id="tpl" class="dense"><colgroup>
              <col style="width:3%"><col style="width:17%"><col style="width:4%"><col style="width:10%">
              <col style="width:13%"><col style="width:13%"><col style="width:4%"><col style="width:24%">
              <col style="width:4%"><col style="width:8%"></colgroup>
            <thead><tr><th colspan="7">DÉSIGNATION CLIENT ET TÂCHES</th><th colspan="3">DÉTAIL CHARGES</th></tr>
              <tr><th class="sub">ART.</th><th class="sub">DESIGNATION</th><th class="sub">UPB</th><th class="sub">LOT</th>
              <th class="sub">ACTIVITÉ PRIMAIRE</th><th class="sub">ACTIVITÉ SECONDAIRE</th><th class="sub">U</th>
              <th class="sub">DÉSIGNATION CHARGE</th><th class="sub">UCB</th><th class="sub">QCB</th></tr></thead>
            <tbody>${body}</tbody></table>`,
          end: ""
        });
        return;
      }
      printModel({
        branch: "DÉTAIL PRODUITS", docTitle: "DÉTAIL PRODUITS", fileTag: "DETAIL PRODUITS", headLine: "DÉTAIL PRODUITS",
        table: `<table id="tpl" class="dense"><colgroup>
            <col style="width:3%"><col style="width:15%"><col style="width:4%"><col style="width:9%">
            <col style="width:11%"><col style="width:11%"><col style="width:17%"><col style="width:4%">
            <col style="width:4%"><col style="width:5%"><col style="width:5%"><col style="width:5%"><col style="width:7%"></colgroup>
          <thead><tr><th colspan="6">DÉSIGNATION CLIENT ET TÂCHES</th><th colspan="7">DÉTAIL PRODUITS</th></tr>
            <tr><th class="sub">ART.</th><th class="sub">DESIGNATION</th><th class="sub">UPB</th><th class="sub">LOT</th>
            <th class="sub">ACTIVITÉ PRIMAIRE</th><th class="sub">ACTIVITÉ SECONDAIRE</th>
            <th class="sub">DÉSIGNATION PRODUIT</th><th class="sub">UPB</th><th class="sub">NBR</th><th class="sub">DIM 1</th>
            <th class="sub">DIM 2</th><th class="sub">DIM 3</th><th class="sub">QPB</th></tr></thead>
          <tbody>${body}</tbody></table>`,
        end: ""
      });
    };

    /* autres aperçus (détails, documents, TAF, observations) : même modèle,
       mêmes options, colonnes à largeur fixe */
    /* largeurs et format des colonnes : catalogue unique (12, SVI_COL, colPw, colFmt) */
    const printGeneric = blk => {
      const label = String(blkLabel(blk)).toUpperCase();
      let cols, rows, end = "";
      if ((blk === "detail" && (active === "dly" || (active === "qlt" && INS))) || blk === "hist") {
        const d = blkData(blk);
        if (!d.rows.length) { sviAlert("Aucune donnée dans " + label + "."); return; }
        /* historique : date, branche et action étroites, détail large */
        cols = d.head.map((h, i) => [blk === "hist" ? ["hdt", "hbr", "hac", "hde"][i] : "c" + i, h, r => r[i], (blk === "hist" && i) || (active === "qlt" && !i) ? "" : "center"]);
        rows = d.rows;
      } else if (REC_KINDS.includes(blk)) {
        if (!recLoad(blk).length) { sviAlert("Aucune donnée dans " + label + "."); return; }
        cols = coOrder(blk, recCols[blk]);
        rows = recShown[blk] || recSorted(blk);
      } else {
        const src = lastShown.detail;
        if (!src || !src.rows.length) { sviAlert("Aucune donnée dans " + label + "."); return; }
        cols = screenCols(detailTable(), src.cols);
        rows = src.rows;
        /* budget en instance : montants calculés des lignes saisies (avant : 0,00) */
        const ht = src.ins ? rows.reduce((t, r) => t + (Number(insCalc(active, r, "ht")) || 0), 0) : rows.reduce((t, l) => t + (l.amount || 0), 0);
        const tv = src.ins ? rows.reduce((t, r) => t + (Number(insCalc(active, r, "ttc")) || 0), 0) - ht : rows.reduce((t, l) => t + (l.tvaAmt || 0), 0);
        if (active === "chg" || active === "prd") end = `<div class="tot">
            <div><span>TOTAL H.T. :</span><b>${money(ht)}</b></div>
            <div><span>TOTAL T.V.A. :</span><b>${money(tv)}</b></div>
            <div><span>TOTAL T.T.C. :</span><b>${money(ht + tv)}</b></div>
          </div>`;
      }
      const wsum = cols.reduce((t, c) => t + colPw(c[0]), 0);
      const fmt = (v, k) => colFmt(k, v);   /* v625 : colonne % (DÉTAIL CHARGES, MARGE) */
      const al = c => /number/.test(c[3] || "") ? "r" : /center/.test(c[3] || "") ? "c" : "";
      const body = rows.map(r => "<tr>" + cols.map(c => `<td class="${al(c)}">${esc(fmt(c[2](r), c[0]))}</td>`).join("") + "</tr>").join("");
      printModel({
        branch: label, docTitle: label, fileTag: label, headLine: label,
        portrait: blk === "hist",
        table: `<table id="tpl"><colgroup>${cols.map(c => `<col style="width:${(colPw(c[0]) / wsum * 100).toFixed(2)}%">`).join("")}</colgroup>
          <thead><tr>${cols.map(c => `<th>${esc(c[1])}</th>`).join("")}</tr></thead>
          <tbody>${body}</tbody></table>`,
        end
      });
    };

    /* bouton d'impression de la liste des budgets : même aperçu */
    window.__sviPrintClient = printClient;

    /* FORMAT 112 : aperçu TÂCHES = les trois tableaux côte à côte, comme à l'écran (ordre des colonnes, filtres, lignes cochées) */
    const printHier = () => {
      const h = lastShown.hier || {};
      const ks = coKeys("hierCols", ["lot", "prim", "sec"]);
      const lab = { lot: "LOT", prim: "ACTIVITÉ PRIMAIRE", sec: "ACTIVITÉ SECONDAIRE" };
      const L = ks.map(k => h[k] || []);
      const n = Math.max(0, ...L.map(x => x.length));
      if (!n) { sviAlert("Aucune donnée dans TÂCHES."); return; }
      const NB = ' style="border:0 !important;background:none !important"';
      const head = ks.map((k, i) => (i ? `<th${NB}></th>` : "") + `<th>${esc(lab[k])} (${L[i].length})</th>`).join("");
      const body = Array.from({ length: n }, (_, j) => "<tr>" + L.map((x, i) => (i ? `<td${NB}></td>` : "") +
        (j < x.length ? `<td>${esc(x[j])}</td>` : `<td${NB}></td>`)).join("") + "</tr>").join("");
      const cg = ks.map((k, i) => (i ? '<col style="width:2%">' : "") + '<col style="width:32%">').join("");
      printModel({
        branch: "TÂCHES", docTitle: "TÂCHES", fileTag: "TACHES", headLine: "TÂCHES",
        table: `<table id="tpl"><colgroup>${cg}</colgroup><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`,
        end: ""
      });
    };
    const doPdf = blk => {
      if (blk === "client") return printClient();
      if (blk === "hier") return printHier();
      /* budget en instance : aperçu standard des lignes saisies */
      if (INS && (blk === "hier" || blk === "detail")) return printGeneric(blk);
      if (blk === "hier") return printTasks("plain");
      if (blk === "detail" && active === "chg") return printTasks("chg");
      if (blk === "detail" && active === "prd") return printTasks("prd");
      if (blk === "detail" && active === "dly") return printGeneric(blk);
      if (!(blk === "detail" && active === "qlt")) return printGeneric(blk);
      histLog(blkLabel(blk), "APERÇU PDF");
      let tableHTML;
      if (blk === "detail" && active === "qlt") {
        sviAlert("Aucune donnée dans " + blkLabel(blk) + ".");
        return;
      }
      if (REC_KINDS.includes(blk) && !recLoad(blk).length) {
        sviAlert("Aucune donnée dans " + blkLabel(blk) + ".");
        return;
      }
      if (blk === "hier" || REC_KINDS.includes(blk) || (blk === "detail" && active === "dly")) {
        const { head, rows } = blkData(blk);
        tableHTML = `<table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead>
          <tbody>${rows.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
      } else {
        const src = blk === "client"
          ? $("bdgClientBody")?.closest("table")
          : $("bdgTabBody")?.querySelector("table");
        if (!src) return;
        const t = src.cloneNode(true);
        t.removeAttribute("style");
        t.querySelectorAll("colgroup, .cf-btn, .col-rs, tr.bdg-d-filler").forEach(x => x.remove());
        t.querySelectorAll("input").forEach(i => i.replaceWith(document.createTextNode(i.value)));
        tableHTML = t.outerHTML;
      }
      const w = window.open("", "_blank");
      if (!w) { sviAlert("Autorisez les fenêtres pop-up pour l'aperçu PDF."); return; }
      w.document.write(`<!doctype html><html><head><meta charset="utf-8">
        <title>${esc(fileBase(blk))}</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: Arial, Helvetica, sans-serif; color: #172033; font-size: 10px; }
          h1 { font-size: 16px; margin: 0 0 2px; } h2 { font-size: 12px; margin: 0 0 10px; color: #4b5563; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border-bottom: 1px solid #dfe4eb; padding: 3px 6px; text-align: left; white-space: nowrap; }
          th { background: #eef1f6; font-weight: 800; }
          .number { text-align: right; } .center { text-align: center; }
          tfoot td, .bdg-d-total-row td { background: #dcecff; font-weight: 800; }
          tr.selected td { background: #dbeafe; font-weight: 700; }
          .pv-bar { position: sticky; top: 0; display: flex; align-items: center; gap: 10px; margin: -8px -8px 10px;
                    padding: 10px 16px; background: #12355b; color: #fff; font-weight: 700; font-size: 14px; }
          .pv-bar span { flex: 1; }
          .pv-bar button { border: 1px solid rgba(255,255,255,.4); background: #fff; color: #12355b; border-radius: 8px;
                    padding: 8px 16px; font-weight: 800; font-size: 13px; cursor: pointer; }
          .pv-bar button.x { background: transparent; color: #fff; }
          @media print { .pv-bar { display: none !important; } }
        </style></head><body>
        <div class="pv-bar"><span>APERÇU — ${esc(blkDisp(blk))}</span>
          <button type="button" onclick="window.print()">🖨 IMPRIMER</button>
          <button type="button" class="x" onclick="window.close()">✕ FERMER</button></div>
        <h1>${esc(budget.project)} — ${esc(ref)}</h1>
        <h2>${esc(blkDisp(blk))} — ${new Date().toLocaleDateString("fr-FR")}</h2>
        ${tableHTML}
        </body></html>`);
      w.document.close();
    };


