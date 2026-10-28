/* =========================================================
   SVI ERP — ENREGISTREMENT DANS LE DRIVE (à ajouter dans le projet Apps Script)

   1) Coller tout ce fichier dans un nouveau fichier du projet
      (Fichier + › Script, nom : exportSheet).
   2) Dans la fonction doPost(e) existante, juste après la lecture
      du corps et le contrôle de la clé, ajouter la ligne :

        const drv = sviDriveRoute_(payload); if (drv) return drv;
   3) Déployer › Gérer les déploiements › ✏️ › Version : Nouvelle
      version › Déployer (garder la même URL).
      À la première exécution, Google demande d'autoriser l'accès
      au Drive : accepter.
   ========================================================= */

/* actions Drive : exportSheet (feuille Google mise en forme)
   et saveFile (PDF, Excel, CSV, JSON, documents joints) */
function sviDriveRoute_(body) {
  /* v672 (bloc 2) : enregistrement des budgets dans la base V3 (fichier baseV3sync) */
  if (body && typeof sviSyncRoute_ === "function" && /^v3(List|Pull|Push|Del|Lock|Unlock|Photo|Stats)$/.test(String(body.action || ""))) {
    var so;
    try { so = sviSyncRoute_(body); } catch (err) { so = { ok: false, error: String(err && err.message || err) }; }
    return ContentService.createTextOutput(JSON.stringify(so)).setMimeType(ContentService.MimeType.JSON);
  }
  if (!body || ["exportSheet", "saveFile", "drivePath", "v3Read", "srcGet", "srcSet", "sheetRead"].indexOf(body.action) < 0) return null;
  var out;
  try {
    out = body.action === "exportSheet" ? exportSheet_(body)
      : body.action === "saveFile" ? saveFile_(body)
      : body.action === "v3Read" ? v3Read_()
      : body.action === "srcGet" ? srcGet_()
      : body.action === "srcSet" ? srcSet_(body)
      : body.action === "sheetRead" ? sheetRead_(body)
      : sviFolderInfo_(sviFolder_(body.path));
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/* mêmes actions en lecture par GET (doGet) : à appeler dans doGet juste
   après le contrôle de la clé :
     const drvG = sviGetRoute_(e.parameter); if (drvG) return drvG;
   (un appel GET garde ses paramètres même quand Google redirige la requête) */
function sviGetRoute_(p) {
  var a = String((p && p.action) || "");
  if (["v3Read", "srcGet", "srcSet", "sheetRead"].indexOf(a) < 0) return null;
  return sviDriveRoute_({ action: a, which: p.which, link: p.link });
}

/* dossier de destination :
   - lien Google Drive d'un dossier (…/folders/ID) : ce dossier
   - lien d'un fichier (…/d/ID/… ou ?id=ID) : le dossier qui le contient
   - chemin « A/B/C » depuis Mon Drive : dossiers créés si besoin */
function sviFolder_(path) {
  var s = String(path || "").trim();
  var m = s.match(/\/folders\/([A-Za-z0-9_-]{10,})/);
  if (m) return DriveApp.getFolderById(m[1]);
  m = s.match(/\/d\/([A-Za-z0-9_-]{10,})/) || s.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (m) {
    try { return DriveApp.getFolderById(m[1]); } catch (e) {}
    var parents = DriveApp.getFileById(m[1]).getParents();
    return parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  }
  if (/^https?:/i.test(s)) throw new Error("LIEN DRIVE NON RECONNU");
  var folder = DriveApp.getRootFolder();
  s.split("/").forEach(function (part) {
    part = part.trim();
    if (!part) return;
    var it = folder.getFoldersByName(part);
    folder = it.hasNext() ? it.next() : folder.createFolder(part);
  });
  return folder;
}

/* dossier : chemin court et lien pour l'ouvrir dans le Drive */
function sviFolderInfo_(folder) {
  return { ok: true, path: sviPathOf_(folder), folderUrl: folder.getUrl() };
}

/* chemin lisible « A/B/C » d'un dossier, depuis Mon Drive */
function sviPathOf_(folder) {
  var rootId = DriveApp.getRootFolder().getId();
  var names = [];
  var f = folder;
  for (var i = 0; i < 30 && f && f.getId() !== rootId; i++) {
    names.unshift(f.getName());
    var it = f.getParents();
    f = it.hasNext() ? it.next() : null;
  }
  return names.join("/");
}

/* fichier reçu en base64, rangé dans le dossier choisi */
function saveFile_(b) {
  var name = String(b.name || "FICHIER").trim();
  var bytes = Utilities.base64Decode(String(b.data || ""));
  var blob = Utilities.newBlob(bytes, b.mime || "application/octet-stream", name);
  var folder = sviFolder_(b.path);
  var file = folder.createFile(blob);
  return { ok: true, url: file.getUrl(), id: file.getId(), path: sviPathOf_(folder), folderUrl: folder.getUrl() };
}

function exportSheet_(b) {
  var head = b.head || [];
  var rows = b.rows || [];
  var top = b.top || [];
  var nc = Math.max(head.length, 1);
  var name = String(b.name || "EXPORT SVI").trim();

  var folder = sviFolder_(b.path);

  var ss = SpreadsheetApp.create(name);
  var file = DriveApp.getFileById(ss.getId());
  file.moveTo(folder);

  var sh = ss.getSheets()[0];
  sh.setName(String(top[4] || "EXPORT").slice(0, 90));

  /* grille : 5 lignes d'entrée + 1 vide + entête + données */
  var H0 = top.length + 1;
  var grid = [];
  top.forEach(function (t) {
    var r = new Array(nc).fill("");
    r[0] = t;
    grid.push(r);
  });
  grid.push(new Array(nc).fill(""));
  grid.push(head.slice());
  rows.forEach(function (r) {
    var x = new Array(nc).fill("");
    for (var c = 0; c < nc; c++) x[c] = r[c] == null ? "" : r[c];
    grid.push(x);
  });

  var nr = grid.length;
  if (sh.getMaxColumns() < nc) sh.insertColumnsAfter(sh.getMaxColumns(), nc - sh.getMaxColumns());
  if (sh.getMaxRows() < nr) sh.insertRowsAfter(sh.getMaxRows(), nr - sh.getMaxRows());

  var all = sh.getRange(1, 1, nr, nc);
  all.setNumberFormat("@");                     /* textes gardés tels quels */
  all.setValues(grid);
  all.setFontFamily("Arial").setFontSize(11).setVerticalAlignment("top");

  /* entrée : fusion sur toute la largeur, gras, date à droite, le reste centré */
  for (var i = 0; i < top.length; i++) {
    var rg = sh.getRange(i + 1, 1, 1, nc);
    if (nc > 1) rg.merge();
    rg.setFontWeight("bold").setHorizontalAlignment(i ? "center" : "right");
  }

  /* entête du tableau */
  var hr = sh.getRange(H0 + 1, 1, 1, nc);
  hr.setFontWeight("bold").setBackground("#D9DEE6")
    .setHorizontalAlignment("center").setVerticalAlignment("middle").setWrap(true);
  if (b.headHeight) sh.setRowHeight(H0 + 1, Number(b.headHeight));

  if (rows.length) {
    var body = sh.getRange(H0 + 2, 1, rows.length, nc);
    /* nombres : vraies valeurs numériques au format 1 234,56 */
    for (var c = 0; c < nc; c++) {
      var isNum = rows.some(function (r) { return typeof r[c] === "number"; });
      if (isNum) {
        var col = sh.getRange(H0 + 2, c + 1, rows.length, 1);
        col.setNumberFormat("#,##0.00");
        col.setValues(rows.map(function (r) { return [r[c] == null ? "" : r[c]]; }));
      }
    }
    var al = b.align || [];
    for (var c2 = 0; c2 < nc; c2++) {
      sh.getRange(H0 + 2, c2 + 1, rows.length, 1).setHorizontalAlignment(al[c2] || "left");
    }
    (b.bold || []).forEach(function (k) {
      if (k >= 0 && k < rows.length) sh.getRange(H0 + 2 + k, 1, 1, nc).setFontWeight("bold");
    });
  }

  /* bordures du tableau (entête + données) */
  sh.getRange(H0 + 1, 1, rows.length + 1, nc)
    .setBorder(true, true, true, true, true, true, "#000000", SpreadsheetApp.BorderStyle.SOLID);

  /* largeurs des colonnes */
  (b.widths || []).forEach(function (w, c) {
    if (c < nc && w) sh.setColumnWidth(c + 1, Number(w));
  });

  /* figer jusqu'à l'entête du tableau */
  sh.setFrozenRows(H0 + 1);

  /* lignes et colonnes en trop retirées */
  if (sh.getMaxRows() > nr + 1) sh.deleteRows(nr + 2, sh.getMaxRows() - nr - 1);
  if (sh.getMaxColumns() > nc) sh.deleteColumns(nc + 1, sh.getMaxColumns() - nc);

  SpreadsheetApp.flush();
  return { ok: true, url: ss.getUrl(), id: ss.getId(), path: sviPathOf_(folder), folderUrl: folder.getUrl() };
}

/* =========================================================
   BASE BUDGETS V3 : lecture de tous les onglets
   ========================================================= */
var SVI_V3_ID = "131RdvI2_kqjRq7HbcPxXetWHmBcYJ3DNmGPiuogAoas";

/* fichier de la base V3 : propriété V3_ID si elle existe (changée depuis
   l'application, fenêtre DONNÉES SOURCE), sinon le fichier d'origine */
function sviV3Id_() {
  return PropertiesService.getScriptProperties().getProperty("V3_ID") || SVI_V3_ID;
}

function v3Read_() {
  var ss = SpreadsheetApp.openById(sviV3Id_());
  var out = { ok: true };
  ["BUDGETS", "DESIGNATIONS", "TACHES", "DETAILS", "ARRETS"].forEach(function (name) {
    var sh = ss.getSheetByName(name);
    out[name.toLowerCase()] = sh ? sh.getDataRange().getValues() : [];
  });
  return out;
}

/* =========================================================
   DONNÉES SOURCE : fichiers Google Sheets lus par l'application
   srcGet : fichier principal (SPREADSHEET_ID) et base V3 (V3_ID)
   srcSet : change l'un des deux (which = "main" ou "v3", link = lien
            ou identifiant de la feuille) ; le fichier doit s'ouvrir.
   ========================================================= */
function sviSrcInfo_(id) {
  try {
    var f = DriveApp.getFileById(id);
    var parents = f.getParents();
    return { id: id, name: f.getName(), url: "https://docs.google.com/spreadsheets/d/" + id + "/edit",
      folder: parents.hasNext() ? sviPathOf_(parents.next()) : "" };
  } catch (e) {
    return { id: id, name: "", url: "https://docs.google.com/spreadsheets/d/" + id + "/edit", error: String(e && e.message || e) };
  }
}

function srcGet_() {
  var props = PropertiesService.getScriptProperties();
  return { ok: true, main: sviSrcInfo_(props.getProperty("SPREADSHEET_ID")), v3: sviSrcInfo_(sviV3Id_()) };
}

function srcSet_(b) {
  var which = String(b.which || "");
  if (which !== "main" && which !== "v3") throw new Error("FICHIER À CHANGER INCONNU");
  var s = String(b.link || "").trim();
  var m = s.match(/\/d\/([A-Za-z0-9_-]{20,})/) || s.match(/^([A-Za-z0-9_-]{20,})$/);
  if (!m) throw new Error("LIEN GOOGLE SHEETS NON RECONNU");
  var id = m[1];
  var ss = SpreadsheetApp.openById(id);   /* erreur si le fichier ne s'ouvre pas */
  if (which === "main" && !ss.getSheetByName("BDG")) throw new Error("ONGLET BDG ABSENT DE CE FICHIER");
  if (which === "v3" && !ss.getSheetByName("BUDGETS")) throw new Error("ONGLET BUDGETS ABSENT DE CE FICHIER");
  PropertiesService.getScriptProperties().setProperty(which === "main" ? "SPREADSHEET_ID" : "V3_ID", id);
  return srcGet_();
}

/* =========================================================
   IMPORT : lecture d'une feuille Google (lien collé dans l'application).
   Le script l'ouvre avec votre compte : pas besoin de la partager.
   L'onglet est celui du lien (#gid=…), sinon le premier.
   ========================================================= */
function sheetRead_(b) {
  var s = String(b.link || "").trim();
  var m = s.match(/\/d\/([A-Za-z0-9_-]{20,})/) || s.match(/^([A-Za-z0-9_-]{20,})$/);
  if (!m) throw new Error("LIEN GOOGLE SHEETS NON RECONNU");
  var ss = SpreadsheetApp.openById(m[1]);
  var g = s.match(/[#&?]gid=(\d+)/);
  var sheets = ss.getSheets(), sh = sheets[0];
  if (g) sheets.forEach(function (x) { if (String(x.getSheetId()) === g[1]) sh = x; });
  return { ok: true, name: ss.getName() + " › " + sh.getName(), values: sh.getDataRange().getDisplayValues() };
}
