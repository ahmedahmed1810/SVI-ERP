/* =========================================================
   SVI ERP — MIGRATION DE L'ONGLET BDG VERS LA BASE V3
   Fichier cible : « SVI ERP — BASE BUDGETS V3 »
   Exécuter une fois : migrerVersV3 (menu Exécuter).
   L'ancien onglet BDG n'est pas modifié. Les onglets V3 sont
   vidés (sauf l'en-tête) puis remplis à chaque exécution.
   ========================================================= */

const V3_ID = "131RdvI2_kqjRq7HbcPxXetWHmBcYJ3DNmGPiuogAoas";

function migrerVersV3() {
  const src = getSVISpreadsheet_().getSheetByName("BDG");
  if (!src) throw new Error("ONGLET BDG INTROUVABLE");
  const values = src.getDataRange().getValues();
  const dst = SpreadsheetApp.openById(V3_ID);

  /* colonnes de l'ancien onglet BDG (A = 0) */
  const C = { PRJ: 6, ART: 7, DES: 8, UDB: 9, LOT: 10, SEC: 11, CLE: 12, PRIM: 13,
              TYPE: 14, DET: 15, UTB: 16, NBR: 17, D1: 18, D2: 19, D3: 20, QTB: 21, PUB: 22 };
  const t = v => String(v == null ? "" : v).trim();
  const id = (p, n) => p + String(n).padStart(5, "0");

  const budgets = [], desig = [], taches = [], details = [];
  const bByPrj = new Map(), dByKey = new Map(), tByKey = new Map();

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const prj = t(row[C.PRJ]).toUpperCase();
    if (!prj) continue;

    /* un budget par projet (même numérotation que l'application) */
    if (!bByPrj.has(prj)) {
      const ref = "BDG 26-1001/" + String(bByPrj.size + 1).padStart(3, "0");
      bByPrj.set(prj, ref);
      budgets.push([ref, prj, "", "VALIDE", "01/10/2026", "", "01/10/2026", 1]);
    }
    const bdg = bByPrj.get(prj);

    /* désignation client : écrite une seule fois */
    const dKey = bdg + "|" + t(row[C.ART]) + "|" + t(row[C.DES]);
    if (!dByKey.has(dKey)) {
      const did = id("D", desig.length + 1);
      dByKey.set(dKey, did);
      desig.push([did, bdg, t(row[C.ART]), t(row[C.DES]), t(row[C.UDB]), "NON", "", desig.length + 1]);
    }
    const did = dByKey.get(dKey);

    /* tâche = désignation + lot + activité primaire + activité secondaire */
    const tKey = did + "|" + t(row[C.LOT]) + "|" + t(row[C.PRIM]) + "|" + t(row[C.SEC]);
    if (!tByKey.has(tKey)) {
      const tid = id("T", taches.length + 1);
      tByKey.set(tKey, tid);
      taches.push([tid, bdg, did, t(row[C.LOT]), t(row[C.PRIM]), t(row[C.SEC]), "", "", taches.length + 1]);
    }

    /* détail produit / charge */
    const type = /PRD/i.test(t(row[C.TYPE])) ? "PRD" : "CHG";
    const cle = /VRAI|TRUE|OUI/i.test(t(row[C.CLE])) ? "VRAI" : "FAUX";
    details.push([id("E", details.length + 1), tByKey.get(tKey), type, "", t(row[C.DET]),
      t(row[C.UTB]), row[C.NBR], row[C.D1], row[C.D2], row[C.D3], row[C.QTB], row[C.PUB], cle, details.length + 1]);
  }

  const write = (name, rows) => {
    const sh = dst.getSheetByName(name);
    if (!sh) throw new Error("ONGLET " + name + " INTROUVABLE DANS LA BASE V3");
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
    if (rows.length) {
      if (sh.getMaxRows() < rows.length + 1) sh.insertRowsAfter(sh.getMaxRows(), rows.length + 1 - sh.getMaxRows());
      sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
  };
  write("BUDGETS", budgets);
  write("DESIGNATIONS", desig);
  write("TACHES", taches);
  write("DETAILS", details);

  const msg = "MIGRATION V3 TERMINÉE : " + budgets.length + " BUDGETS, " + desig.length +
    " DÉSIGNATIONS, " + taches.length + " TÂCHES, " + details.length + " DÉTAILS";
  Logger.log(msg);
  return msg;
}
