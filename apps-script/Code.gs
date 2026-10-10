/* =========================================================
   SVI ERP V2 - BACKEND (Google Apps Script)
   Version corrigée

   AVANT DE DEPLOYER, créer deux propriétés du script :
   Paramètres du projet (roue dentée) > Propriétés du script
   - API_KEY          : la clé d'accès
   - SPREADSHEET_ID   : l'identifiant de la feuille Google Sheets
   ========================================================= */

/* =========================================================
   CONFIGURATION (PROPRIETES DU SCRIPT)
   ========================================================= */

function getProp_(name) {
  const v = PropertiesService
    .getScriptProperties()
    .getProperty(name);

  if (!v) {
    throw new Error("PROPRIETE MANQUANTE : " + name);
  }

  return v;
}

let SS_CACHE_ = null;

function getSVISpreadsheet_() {
  if (!SS_CACHE_) {
    SS_CACHE_ = SpreadsheetApp.openById(
      getProp_("SPREADSHEET_ID")
    );
  }

  return SS_CACHE_;
}

const SHEETS_V2 = {
  CHS: {
    name: "CHS",
    headers: ["ID", "ARTICLE", "DESIGNATION", "UNITE", "PCS"]
  },
  BDS: {
    name: "BDS_V2",
    headers: ["ID", "TYPE", "PARENT_ID", "CODE", "NOM", "ORDRE", "ACTIF"]
  },
  BRD: {
    name: "BRD_V2",
    headers: ["ID", "TACHE_SECONDAIRE_ID", "ARTICLE", "DESIGNATION", "UNITE", "QUANTITE", "PRIX", "ACTIF"]
  }
};

/* =========================================================
   VERROU : EVITE LES ECRITURES SIMULTANEES
   ========================================================= */

function withLock_(fn) {
  const lock = LockService.getScriptLock();

  lock.waitLock(30000);

  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================
   API GET
   - Sans action ou action=bdg : lecture de l'onglet BDG
   - action=bootstrap : CHS + BDS
   - action=brd : bordereau d'une tâche secondaire
   - action=ping : test API
   ========================================================= */

function doGet(e) {
  try {
    if (
      !e ||
      !e.parameter ||
      e.parameter.key !== getProp_("API_KEY")
    ) {
      return jsonResponse_({
        ok: false,
        error: "ACCES REFUSE"
      });
    }

    const action = String(
      e.parameter.action || ""
    ).toLowerCase();

    /* ---------- BDG (compatibilité + actions nommées) ---------- */

    if (
      !action ||
      action === "bdg" ||
      action === "getbdg" ||
      action === "bootstrapbdg"
    ) {
      return getBDG_();
    }

    /* ---------- TEST API ---------- */

    if (action === "ping") {
      return jsonResponse_({
        ok: true,
        version: "SVI-ERP-V2",
        time: new Date().toISOString()
      });
    }

    /* ---------- DEMARRAGE : CHS + STRUCTURE BDS ---------- */

    if (action === "bootstrap") {
      verifierStructureV2_();

      return jsonResponse_({
        ok: true,

        chs: lireObjets_(SHEETS_V2.CHS),

        bds: lireObjets_(SHEETS_V2.BDS).filter(x =>
          String(x.ACTIF || "OUI").trim().toUpperCase() !== "NON"
        )
      });
    }

    /* ---------- BORDEREAU D'UNE TACHE SECONDAIRE ---------- */

    if (action === "brd") {
      const secondaryId = nettoyer_(
        e.parameter.secondaryId
      );

      if (!secondaryId) {
        return jsonResponse_({
          ok: false,
          error: "TACHE SECONDAIRE MANQUANTE"
        });
      }

      const brd = lireObjets_(SHEETS_V2.BRD).filter(x =>
        String(x.TACHE_SECONDAIRE_ID || "") === secondaryId &&
        String(x.ACTIF || "OUI").trim().toUpperCase() !== "NON"
      );

      return jsonResponse_({
        ok: true,
        secondaryId: secondaryId,
        brd: brd
      });
    }

    return jsonResponse_({
      ok: false,
      error: "ACTION GET INCONNUE"
    });

  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: String(
        error && error.message
          ? error.message
          : error
      )
    });
  }
}

/* =========================================================
   API POST
   ========================================================= */

function doPost(e) {
  try {
    const payload = JSON.parse(
      (e && e.postData && e.postData.contents) || "{}"
    );

    if (payload.key !== getProp_("API_KEY")) {
      return jsonResponse_({
        ok: false,
        error: "ACCES REFUSE"
      });
    }

    /* enregistrement dans le Drive (fichiers et feuilles Google) */
    const drv = sviDriveRoute_(payload);
    if (drv) return drv;

    const action = String(payload.action || "").toLowerCase();

    return withLock_(function () {
      verifierStructureV2_();

      if (action === "savechs") {
        return jsonResponse_({
          ok: true,
          data: upsertObjet_(
            SHEETS_V2.CHS,
            normaliserCHS_(payload.data || {})
          )
        });
      }

      if (action === "deletechs") {
        supprimerParId_(SHEETS_V2.CHS, payload.id);
        return jsonResponse_({ ok: true });
      }

      if (action === "savebds") {
        return jsonResponse_({
          ok: true,
          data: upsertObjet_(
            SHEETS_V2.BDS,
            normaliserBDS_(payload.data || {})
          )
        });
      }

      if (action === "deletebds") {
        supprimerBDSProtege_(payload.id);
        return jsonResponse_({ ok: true });
      }

      if (action === "savebrd") {
        const brd = normaliserBRD_(payload.data || {});
        const tacheOk = lireObjets_(SHEETS_V2.BDS).some(x =>
          x.ID === brd.TACHE_SECONDAIRE_ID && x.TYPE === "SECONDARY"
        );
        if (!tacheOk) {
          throw new Error("TACHE SECONDAIRE INTROUVABLE");
        }
        return jsonResponse_({
          ok: true,
          data: upsertObjet_(SHEETS_V2.BRD, brd)
        });
      }

      if (action === "deletebrd") {
        supprimerParId_(SHEETS_V2.BRD, payload.id);
        return jsonResponse_({ ok: true });
      }

      return jsonResponse_({ ok: false, error: "ACTION POST INCONNUE" });
    });

  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: String(error && error.message ? error.message : error)
    });
  }
}

/* =========================================================
   BDG EXISTANT
   ========================================================= */

function getBDG_() {
  const sheet = getSVISpreadsheet_().getSheetByName("BDG");

  if (!sheet) {
    return jsonResponse_({
      ok: false,
      error: "ONGLET BDG INTROUVABLE"
    });
  }

  const values = sheet.getDataRange().getDisplayValues();

  return jsonResponse_({
    ok: true,
    sheet: "BDG",
    count: values.length,
    rows: values
  });
}

/* =========================================================
   INITIALISATION V2
   À exécuter une seule fois. Crée uniquement CHS, BDS_V2
   et BRD_V2. Aucun autre onglet n'est modifié.
   ========================================================= */

function initialiserV2() {
  verifierStructureV2_();
  return "V2 INITIALISEE";
}


/* =========================================================
   IMPORT BDS DEPUIS BRD bis
   - PRJ vide = dernier projet connu
   - LOT vide = dernier lot connu
   - Ne modifie pas BRD bis
   ========================================================= */

function importerStructureDepuisBRDBis() {
  return withLock_(importerStructure_);
}

function importerStructure_() {
  verifierStructureV2_();

  const ss = getSVISpreadsheet_();
  const source = ss.getSheetByName("BRD bis");

  if (!source) {
    throw new Error("ONGLET BRD bis INTROUVABLE");
  }

  const values = source.getDataRange().getDisplayValues();

  if (values.length < 3) {
    throw new Error("BRD bis NE CONTIENT PAS ASSEZ DE DONNEES");
  }

  const headerRowIndex = 1;

  const headers = values[headerRowIndex].map(v =>
    String(v || "").trim().toUpperCase()
  );

  const col = nom =>
    headers.indexOf(String(nom).trim().toUpperCase());

  const cPrj = col("PRJ");
  const cLot = col("LOT");
  const cAct = col("ACTIVITE");
  const cActP = col("ACTIVITE PRIMAIRE");

  if ([cPrj, cLot, cAct, cActP].some(i => i < 0)) {
    throw new Error(
      "COLONNES PRJ / LOT / ACTIVITE / ACTIVITE PRIMAIRE INTROUVABLES"
    );
  }

  const cfg = SHEETS_V2.BDS;
  const sheetBDS = ss.getSheetByName(cfg.name);

  const existants = lireObjets_(cfg);
  const index = new Map();

  existants.forEach(x => {
    index.set(
      cleBDS_(x.TYPE, x.PARENT_ID, x.CODE, x.NOM),
      x
    );
  });

  const nouveaux = [];

  let ordreProjet = 0;
  let ordreLot = 0;
  let ordrePrimary = 0;
  let ordreSecondary = 0;

  let dernierProjet = "";
  let dernierLot = "";

  for (let r = 2; r < values.length; r++) {
    const row = values[r];

    const projetCellule = nettoyer_(row[cPrj]);
    const lotCellule = nettoyer_(row[cLot]);

    if (projetCellule) {
      dernierProjet = projetCellule;
      dernierLot = "";
    }

    if (lotCellule) {
      dernierLot = lotCellule;
    }

    const prj = dernierProjet;
    const lot = dernierLot;
    const secondaire = nettoyer_(row[cAct]);
    const primaire = nettoyer_(row[cActP]);

    if (!prj) {
      continue;
    }

    const p = ensureBDSMemo_(
      "PROJECT",
      "",
      prj,
      prj,
      ++ordreProjet,
      index,
      nouveaux
    );

    let l = null;

    if (lot) {
      const xLot = codeNom_(lot);

      l = ensureBDSMemo_(
        "LOT",
        p.ID,
        xLot.code,
        xLot.nom,
        ++ordreLot,
        index,
        nouveaux
      );
    }

    let pri = null;

    if (l && primaire) {
      const xPri = codeNom_(primaire);

      pri = ensureBDSMemo_(
        "PRIMARY",
        l.ID,
        xPri.code,
        xPri.nom,
        ++ordrePrimary,
        index,
        nouveaux
      );
    }

    if (pri && secondaire) {
      const xSec = codeNom_(secondaire);

      ensureBDSMemo_(
        "SECONDARY",
        pri.ID,
        xSec.code,
        xSec.nom,
        ++ordreSecondary,
        index,
        nouveaux
      );
    }
  }

  if (nouveaux.length > 0) {
    const startRow = Math.max(2, sheetBDS.getLastRow() + 1);

    const rows = nouveaux.map(obj => ligneDepuisObjet_(cfg, obj));

    sheetBDS
      .getRange(startRow, 1, rows.length, cfg.headers.length)
      .setValues(rows);
  }

  return "IMPORT BDS TERMINE - " +
    nouveaux.length +
    " NOUVEAUX ELEMENTS";
}


/* =========================================================
   IMPORT BORDEREAU DES PRIX V2
   Sources :
   - BRD : article, désignation, unité, prix
   - BRD bis : rattachement Projet / Lot / Primaire /
               Secondaire et montant budgété

   ATTENTION : BRD_V2 est réécrit entièrement.
   Une copie de sauvegarde est créée automatiquement
   avant l'écrasement (onglet BRD_V2_SAUV_...).
   ========================================================= */

function importerBRDDepuisBRDBis() {
  return withLock_(importerBRD_);
}

function importerBRD_() {
  verifierStructureV2_();

  const ss = getSVISpreadsheet_();
  const shBRD = ss.getSheetByName("BRD");
  const shBis = ss.getSheetByName("BRD bis");
  const shOut = ss.getSheetByName(SHEETS_V2.BRD.name);

  if (!shBRD) {
    throw new Error("ONGLET BRD INTROUVABLE");
  }

  if (!shBis) {
    throw new Error("ONGLET BRD bis INTROUVABLE");
  }

  if (!shOut) {
    throw new Error("ONGLET BRD_V2 INTROUVABLE");
  }

  const brdValues = shBRD.getDataRange().getDisplayValues();
  const bisValues = shBis.getDataRange().getDisplayValues();

  if (brdValues.length < 3 || bisValues.length < 3) {
    throw new Error("DONNEES BRD / BRD bis INSUFFISANTES");
  }

  /* ---------- 1. INDEX DU BORDEREAU BRD ---------- */

  const hBRD = brdValues[1].map(v =>
    nettoyer_(v).toUpperCase()
  );

  const colBRD = nom =>
    hBRD.indexOf(nettoyer_(nom).toUpperCase());

  const bPrj = colBRD("PRJ");
  const bArt = colBRD("N°");
  const bDes = colBRD("DESIGNATION");
  const bUdb = colBRD("UDB");
  const bQte = colBRD("QTE DVS");
  const bPrix = colBRD("PUN DVS");

  if ([bPrj, bArt, bDes, bUdb, bQte, bPrix].some(i => i < 0)) {
    throw new Error("COLONNES REQUISES INTROUVABLES DANS BRD");
  }

  const articleMap = new Map();

  for (let r = 2; r < brdValues.length; r++) {
    const row = brdValues[r];

    const prj = nettoyer_(row[bPrj]);
    const article = nettoyer_(row[bArt]);

    if (!prj || !article) {
      continue;
    }

    articleMap.set(
      cleArticle_(prj, article),
      {
        designation: nettoyer_(row[bDes]),
        unite: nettoyer_(row[bUdb]),
        quantiteContrat: nombre_(row[bQte]),
        prix: nombre_(row[bPrix])
      }
    );
  }

  /* ---------- 2. COLONNES DE LA PARTIE DROITE DE BRD bis ---------- */

  const hBis = bisValues[1].map(v =>
    nettoyer_(v).toUpperCase()
  );

  const cPrj = hBis.indexOf("PRJ");

  if (cPrj < 0) {
    throw new Error("COLONNE PRJ INTROUVABLE DANS BRD bis");
  }

  // BRD bis contient deux colonnes N° et deux DESIGNATION.
  // On prend explicitement celles qui se trouvent APRES PRJ.
  const cArticle = hBis.indexOf("N°", cPrj + 1);
  const cDesignation = hBis.indexOf("DESIGNATION", cPrj + 1);
  const cLot = hBis.indexOf("LOT", cPrj + 1);
  const cSecondaire = hBis.indexOf("ACTIVITE", cPrj + 1);
  const cPrimaire = hBis.indexOf("ACTIVITE PRIMAIRE", cPrj + 1);
  const cUnite = hBis.indexOf("UDB", cPrj + 1);
  const cMontant = hBis.indexOf("SUM DE MNB", cPrj + 1);

  if (
    [
      cArticle,
      cDesignation,
      cLot,
      cSecondaire,
      cPrimaire,
      cUnite,
      cMontant
    ].some(i => i < 0)
  ) {
    throw new Error(
      "COLONNES DE LA PARTIE DROITE DE BRD bis INTROUVABLES"
    );
  }

  /* ---------- 3. INDEX DE LA HIERARCHIE BDS_V2 (Maps) ---------- */

  const bds = lireObjets_(SHEETS_V2.BDS);

  const projetMap = new Map();
  const lotMap = new Map();
  const primaireMap = new Map();
  const secondaireMap = new Map();

  bds.forEach(x => {
    if (x.TYPE === "PROJECT") {
      projetMap.set(
        nettoyer_(x.CODE).toUpperCase(),
        x
      );
    } else if (x.TYPE === "LOT") {
      lotMap.set(cleHier_(x.PARENT_ID, x.CODE, x.NOM), x);
    } else if (x.TYPE === "PRIMARY") {
      primaireMap.set(cleHier_(x.PARENT_ID, x.CODE, x.NOM), x);
    } else if (x.TYPE === "SECONDARY") {
      secondaireMap.set(cleHier_(x.PARENT_ID, x.CODE, x.NOM), x);
    }
  });

  /* ---------- 4. LECTURE DE BRD bis AVEC HERITAGE ---------- */

  let dernierProjet = "";
  let dernierLot = "";
  let dernierArticle = "";
  let derniereDesignation = "";
  let derniereUnite = "";

  const resultats = new Map();

  for (let r = 2; r < bisValues.length; r++) {
    const row = bisValues[r];

    const prjCell = nettoyer_(row[cPrj]);
    const lotCell = nettoyer_(row[cLot]);
    const articleCell = nettoyer_(row[cArticle]);
    const designationCell = nettoyer_(row[cDesignation]);
    const uniteCell = nettoyer_(row[cUnite]);

    if (prjCell) {
      dernierProjet = prjCell;
      dernierLot = "";
      dernierArticle = "";
      derniereDesignation = "";
      derniereUnite = "";
    }

    if (lotCell) {
      dernierLot = lotCell;
    }

    if (articleCell) {
      dernierArticle = articleCell;
    }

    if (designationCell) {
      derniereDesignation = designationCell;
    }

    if (uniteCell) {
      derniereUnite = uniteCell;
    }

    const prj = dernierProjet;
    const lotTexte = dernierLot;
    const article = dernierArticle;

    const primaireTexte = nettoyer_(row[cPrimaire]);
    const secondaireTexte = nettoyer_(row[cSecondaire]);

    if (
      !prj ||
      !lotTexte ||
      !article ||
      !primaireTexte ||
      !secondaireTexte
    ) {
      continue;
    }

    const projet = projetMap.get(prj.toUpperCase());

    if (!projet) {
      continue;
    }

    const lotCN = codeNom_(lotTexte);
    const lot = lotMap.get(
      cleHier_(projet.ID, lotCN.code, lotCN.nom)
    );

    if (!lot) {
      continue;
    }

    const primaireCN = codeNom_(primaireTexte);
    const primaire = primaireMap.get(
      cleHier_(lot.ID, primaireCN.code, primaireCN.nom)
    );

    if (!primaire) {
      continue;
    }

    const secondaireCN = codeNom_(secondaireTexte);
    const secondaire = secondaireMap.get(
      cleHier_(primaire.ID, secondaireCN.code, secondaireCN.nom)
    );

    if (!secondaire) {
      continue;
    }

    const info =
      articleMap.get(cleArticle_(prj, article)) || {};

    const prix = nombre_(info.prix);
    const montant = nombre_(row[cMontant]);

    // Quantité de l'article affectée à cette tâche secondaire.
    // Si le prix n'est pas disponible, la quantité reste à 0.
    const quantite =
      prix > 0
        ? montant / prix
        : 0;

    const cle =
      secondaire.ID + "|" +
      nettoyer_(article).toUpperCase();

    if (!resultats.has(cle)) {
      resultats.set(cle, {
        ID: nouvelId_("BRD"),
        TACHE_SECONDAIRE_ID: secondaire.ID,
        ARTICLE: article,
        DESIGNATION:
          derniereDesignation ||
          info.designation ||
          "",
        UNITE:
          derniereUnite ||
          info.unite ||
          "",
        QUANTITE: quantite,
        PRIX: prix,
        ACTIF: "OUI"
      });
    } else {
      // Même association présente plusieurs fois : on cumule.
      const existant = resultats.get(cle);

      existant.QUANTITE =
        nombre_(existant.QUANTITE) + quantite;
    }
  }

  /* ---------- 5. SAUVEGARDE PUIS REECRITURE DE BRD_V2 ---------- */

  if (shOut.getLastRow() > 1) {
    const horodatage = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyyMMdd_HHmmss"
    );

    shOut
      .copyTo(ss)
      .setName("BRD_V2_SAUV_" + horodatage);

    shOut
      .getRange(
        2,
        1,
        shOut.getLastRow() - 1,
        SHEETS_V2.BRD.headers.length
      )
      .clearContent();
  }

  const objets = Array.from(resultats.values());

  if (objets.length > 0) {
    const rowsOut = objets.map(obj =>
      ligneDepuisObjet_(SHEETS_V2.BRD, obj)
    );

    shOut
      .getRange(
        2,
        1,
        rowsOut.length,
        SHEETS_V2.BRD.headers.length
      )
      .setValues(rowsOut);
  }

  return (
    "IMPORT BRD TERMINE - " +
    objets.length +
    " LIGNES"
  );
}

function cleArticle_(prj, article) {
  return [
    nettoyer_(prj).toUpperCase(),
    nettoyer_(article).toUpperCase()
  ].join("|");
}

function cleHier_(parentId, code, nom) {
  return [
    parentId,
    codeCle_(code),
    nettoyer_(nom).toUpperCase()
  ].join("|");
}


/* =========================================================
   STRUCTURE DES ONGLETS V2
   ========================================================= */

function verifierStructureV2_() {
  const ss = getSVISpreadsheet_();

  Object.keys(SHEETS_V2).forEach(k => {
    const cfg = SHEETS_V2[k];

    let sh = ss.getSheetByName(cfg.name);

    if (!sh) {
      sh = ss.insertSheet(cfg.name);
    }

    const current = sh
      .getRange(1, 1, 1, cfg.headers.length)
      .getDisplayValues()[0];

    const same = cfg.headers.every(
      (h, i) => String(current[i] || "").trim() === h
    );

    if (!same) {
      sh
        .getRange(1, 1, 1, cfg.headers.length)
        .setValues([cfg.headers]);

      sh.setFrozenRows(1);

      sh
        .getRange(1, 1, 1, cfg.headers.length)
        .setFontWeight("bold");
    }
  });
}

/* =========================================================
   LECTURE GENERIQUE
   ========================================================= */

function lireObjets_(cfg) {
  const sh = getSVISpreadsheet_().getSheetByName(cfg.name);

  if (!sh || sh.getLastRow() < 2) {
    return [];
  }

  const nCols = cfg.headers.length;

  const values = sh
    .getRange(2, 1, sh.getLastRow() - 1, nCols)
    .getDisplayValues();

  return values
    .filter(row => nettoyer_(row[0]) !== "")
    .map(row => {
      const o = {};

      cfg.headers.forEach((h, i) => {
        o[h] = row[i] == null ? "" : row[i];
      });

      return o;
    });
}

/* =========================================================
   ENREGISTREMENT / MODIFICATION GENERIQUE
   ========================================================= */

function upsertObjet_(cfg, obj) {
  const sh = getSVISpreadsheet_().getSheetByName(cfg.name);

  if (!sh) {
    throw new Error("ONGLET " + cfg.name + " INTROUVABLE");
  }

  if (!obj.ID) {
    obj.ID = nouvelId_("ID");
  }

  const lastRow = sh.getLastRow();
  let targetRow = -1;

  if (lastRow >= 2) {
    const ids = sh
      .getRange(2, 1, lastRow - 1, 1)
      .getDisplayValues()
      .flat();

    const idx = ids.findIndex(
      x => String(x) === String(obj.ID)
    );

    if (idx >= 0) {
      targetRow = idx + 2;
    }
  }

  if (targetRow < 0) {
    targetRow = Math.max(2, lastRow + 1);
  }

  const row = ligneDepuisObjet_(cfg, obj);

  sh
    .getRange(targetRow, 1, 1, row.length)
    .setValues([row]);

  return obj;
}

/* =========================================================
   SUPPRESSION GENERIQUE
   ========================================================= */

function supprimerParId_(cfg, id) {
  id = nettoyer_(id);

  if (!id) {
    throw new Error("ID MANQUANT");
  }

  const sh = getSVISpreadsheet_().getSheetByName(cfg.name);

  if (!sh) {
    return;
  }

  const lastRow = sh.getLastRow();

  if (lastRow < 2) {
    return;
  }

  const ids = sh
    .getRange(2, 1, lastRow - 1, 1)
    .getDisplayValues()
    .flat();

  const idx = ids.findIndex(x => String(x) === id);

  if (idx >= 0) {
    sh.deleteRow(idx + 2);
  }
}

/* =========================================================
   SUPPRESSION BDS PROTEGEE
   ========================================================= */

function supprimerBDSProtege_(id) {
  id = nettoyer_(id);

  const all = lireObjets_(SHEETS_V2.BDS);

  const obj = all.find(x => String(x.ID) === id);

  if (!obj) {
    return;
  }

  if (all.some(x => String(x.PARENT_ID) === id)) {
    throw new Error(
      "SUPPRESSION IMPOSSIBLE : CET ELEMENT CONTIENT DES SOUS-ELEMENTS"
    );
  }

  if (obj.TYPE === "SECONDARY") {
    const brd = lireObjets_(SHEETS_V2.BRD);

    if (brd.some(x => String(x.TACHE_SECONDAIRE_ID) === id)) {
      throw new Error(
        "SUPPRESSION IMPOSSIBLE : CETTE TACHE CONTIENT DES ARTICLES"
      );
    }
  }

  supprimerParId_(SHEETS_V2.BDS, id);
}

/* =========================================================
   VALIDATION
   ========================================================= */

function requis_(valeur, libelle) {
  if (!nettoyer_(valeur)) {
    throw new Error("CHAMP OBLIGATOIRE : " + libelle);
  }

  return valeur;
}

/* =========================================================
   NORMALISATION CHS
   ========================================================= */

function normaliserCHS_(x) {
  return {
    ID:
      nettoyer_(x.ID) ||
      nouvelId_("CHS"),

    ARTICLE:
      requis_(texte_(x.ARTICLE), "ARTICLE"),

    DESIGNATION:
      requis_(texte_(x.DESIGNATION), "DESIGNATION")
        .toUpperCase(),

    UNITE:
      texte_(x.UNITE).toUpperCase(),

    PCS:
      nombre_(x.PCS)
  };
}

/* =========================================================
   NORMALISATION BDS
   ========================================================= */

function normaliserBDS_(x) {
  const type = nettoyer_(x.TYPE).toUpperCase();

  if (
    ![
      "PROJECT",
      "LOT",
      "PRIMARY",
      "SECONDARY"
    ].includes(type)
  ) {
    throw new Error("TYPE BDS INVALIDE");
  }

  const parentId = nettoyer_(x.PARENT_ID);

  if (type !== "PROJECT" && !parentId) {
    throw new Error("ELEMENT PARENT MANQUANT");
  }

  return {
    ID:
      nettoyer_(x.ID) ||
      nouvelId_(type),

    TYPE:
      type,

    PARENT_ID:
      parentId,

    CODE:
      requis_(texte_(x.CODE), "CODE").toUpperCase(),

    NOM:
      requis_(texte_(x.NOM), "NOM").toUpperCase(),

    ORDRE:
      nombre_(x.ORDRE),

    ACTIF:
      nettoyer_(x.ACTIF || "OUI").toUpperCase()
  };
}

/* =========================================================
   NORMALISATION BRD
   ========================================================= */

function normaliserBRD_(x) {
  return {
    ID:
      nettoyer_(x.ID) ||
      nouvelId_("BRD"),

    TACHE_SECONDAIRE_ID:
      requis_(
        nettoyer_(x.TACHE_SECONDAIRE_ID),
        "TACHE SECONDAIRE"
      ),

    ARTICLE:
      requis_(texte_(x.ARTICLE), "ARTICLE"),

    DESIGNATION:
      texte_(x.DESIGNATION).toUpperCase(),

    UNITE:
      texte_(x.UNITE).toUpperCase(),

    QUANTITE:
      nombre_(x.QUANTITE),

    PRIX:
      nombre_(x.PRIX),

    ACTIF:
      nettoyer_(x.ACTIF || "OUI").toUpperCase()
  };
}

/* =========================================================
   CREATION MEMOIRE BDS POUR IMPORT RAPIDE
   ========================================================= */

function ensureBDSMemo_(
  type,
  parentId,
  code,
  nom,
  ordre,
  index,
  nouveaux
) {
  const key = cleBDS_(type, parentId, code, nom);

  if (index.has(key)) {
    return index.get(key);
  }

  const obj = {
    ID: nouvelId_(type),
    TYPE: type,
    PARENT_ID: parentId || "",
    CODE: code || "",
    NOM: nom || "",
    ORDRE: ordre || 0,
    ACTIF: "OUI"
  };

  index.set(key, obj);
  nouveaux.push(obj);

  return obj;
}

/* =========================================================
   CLE UNIQUE BDS
   ========================================================= */

function cleBDS_(type, parentId, code, nom) {
  return [
    type,
    parentId,
    codeCle_(code),
    nettoyer_(nom).toUpperCase()
  ].join("|");
}

function codeCle_(code) {
  const s = nettoyer_(code).toUpperCase();

  // Codes purement numériques : "00" = "0", "01" = "1".
  if (/^\d+$/.test(s)) {
    return String(Number(s));
  }

  return s;
}

/* =========================================================
   EXTRACTION CODE / NOM
   "01 - FONDATION" => code "01", nom "FONDATION"
   ========================================================= */

function codeNom_(texte) {
  const s = nettoyer_(texte);

  const m = s.match(
    /^([0-9A-ZÀ-Ü._-]+)\s*-\s*(.+)$/i
  );

  if (m) {
    return {
      code: m[1].trim(),
      nom: m[2].trim()
    };
  }

  return {
    code: s,
    nom: s
  };
}

/* =========================================================
   ECRITURE SECURISEE
   Neutralise les textes qui seraient interprétés comme
   des formules par Google Sheets (=, +, -, @).
   ========================================================= */

function celluleSure_(v) {
  if (typeof v !== "string") {
    return v;
  }

  if (/^[=@]/.test(v)) {
    return "'" + v;
  }

  if (
    /^[+\-]/.test(v) &&
    isNaN(Number(v.replace(",", ".")))
  ) {
    return "'" + v;
  }

  return v;
}

function ligneDepuisObjet_(cfg, obj) {
  return cfg.headers.map(h =>
    celluleSure_(obj[h] == null ? "" : obj[h])
  );
}

/* =========================================================
   CONVERSION EN NOMBRE
   ========================================================= */

function nombre_(v) {
  if (typeof v === "number") {
    return v;
  }

  let s = String(v == null ? "" : v).trim();

  if (!s) {
    return 0;
  }

  s = s
    .replace(/\u00A0/g, " ")
    .replace(/\s/g, "")
    .replace(",", ".");

  const n = Number(s);

  return isFinite(n) ? n : 0;
}

/* =========================================================
   NETTOYAGE TEXTE
   ========================================================= */

function nettoyer_(v) {
  return String(v == null ? "" : v).trim();
}

// Texte libre saisi par un utilisateur : limité à 500 caractères.
function texte_(v) {
  return nettoyer_(v).slice(0, 500);
}

/* =========================================================
   GENERATION ID
   ========================================================= */

function nouvelId_(prefix) {
  return (
    String(prefix || "ID").toUpperCase() +
    "_" +
    Utilities
      .getUuid()
      .replace(/-/g, "")
      .slice(0, 16)
      .toUpperCase()
  );
}

/* =========================================================
   REPONSE JSON
   ========================================================= */

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/* =========================================================
   AUTORISATION (à exécuter une fois depuis l'éditeur)
   ========================================================= */

function autoriserSVI() {
  const ss = getSVISpreadsheet_();
  Logger.log(ss.getName());
  /* accès au Drive (enregistrement des fichiers) */
  Logger.log(DriveApp.getRootFolder().getName());
}
