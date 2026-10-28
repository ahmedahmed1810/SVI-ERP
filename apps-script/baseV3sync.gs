/* =========================================================
   SVI ERP — BLOC 2 : ENREGISTREMENT DES BUDGETS DANS LA BASE V3 (v672, verrou par zone v676)

   INSTALLATION (une seule fois) :
   1) Apps Script › Fichier + › Script, nom : baseV3sync — coller tout ce fichier.
   2) Remplacer aussi le fichier exportSheet par la nouvelle version (il appelle sviSyncRoute_).
   3) Déployer › Gérer les déploiements › ✏️ › Version : Nouvelle version › Déployer (même URL).
   4) Pour la sauvegarde de chaque nuit : exécuter UNE FOIS la fonction installerSauvegardeNuit
      (menu Exécuter), accepter les autorisations.

   ONGLETS créés d'office dans la base V3 :
   - SYNC : un budget par ligne — REF, PROJET, ETAT, REV, TS, USER, LONGUEUR, puis le budget complet
     (texte JSON) découpé dans les colonnes H, I, J… (45 000 caractères par case).
   - VERROUS : REF, USER, ONGLET, TS — qui modifie quel onglet de quel budget (un verrou vieux de plus de 3 minutes ne compte plus).
     v676 : VERROU PAR ZONE — ONGLET = DÉSIGNATIONS CLIENT, LOTS, ACTIVITÉS PRIMAIRES, ACTIVITÉS SECONDAIRES ou l'onglet du détail ;
     un autre utilisateur ne bloque que la même zone du même budget (ONGLET vide = ancienne version : tout le budget).
   Les onglets BUDGETS, DESIGNATIONS, TACHES, DETAILS reçoivent la « photo » du budget à FIGER et à VALIDER.

   ACTIONS (POST, avec la clé) :
   v3List  → liste des budgets de la base (sans leurs données) et des verrous en cours
   v3Pull  → un budget complet { ref }
   v3Push  → enregistre { ref, projet, etat, baseRev, user, ts, data } ; si la base a une version plus récente
             que baseRev : { conflict: true, rev, ts, user, data } (l'application fusionne et renvoie)
   v3Del   → supprime un budget de SYNC { ref }
   v3Lock  → prend / garde le verrou { ref, user, onglet } ; v3Unlock → le rend
   v3Photo → photo du budget dans BUDGETS, DESIGNATIONS, TACHES, DETAILS { ref, budget, des, taches, details }
   v3Stats → nombre de cellules du fichier (limite de Google Sheets : 10 millions)
   ========================================================= */

var SVI_SYNC_CHUNK = 45000;
var SVI_LOCK_MS = 3 * 60 * 1000;

function sviSyncSheet_(ss, name, head) {
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, head.length).setValues([head]); sh.setFrozenRows(1); }
  return sh;
}
function sviSyncSS_() { return SpreadsheetApp.openById(sviV3Id_()); }
function sviSyncRows_(sh) { var n = sh.getLastRow(); return n < 2 ? [] : sh.getRange(2, 1, n - 1, sh.getLastColumn()).getValues(); }
function sviSyncFind_(sh, ref) {
  var n = sh.getLastRow(); if (n < 2) return -1;
  var refs = sh.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < refs.length; i++) if (String(refs[i][0]) === String(ref)) return i + 2;
  return -1;
}
function sviSyncData_(row) { return row.slice(7).join(""); }

function sviSyncRoute_(b) {
  var A = ["v3List", "v3Pull", "v3Push", "v3Del", "v3Lock", "v3Unlock", "v3Photo", "v3Stats"];
  if (!b || A.indexOf(b.action) < 0) return null;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = sviSyncSS_();
    var sh = sviSyncSheet_(ss, "SYNC", ["REF", "PROJET", "ETAT", "REV", "TS", "USER", "LONGUEUR", "DATA"]);
    var lk = sviSyncSheet_(ss, "VERROUS", ["REF", "USER", "ONGLET", "TS"]);
    if (b.action === "v3List") {
      var now = Date.now();
      return { ok: true, list: sviSyncRows_(sh).map(function (r) { return { ref: String(r[0]), projet: String(r[1]), etat: String(r[2]), rev: Number(r[3]) || 0, ts: Number(r[4]) || 0, user: String(r[5]) }; }),
        locks: sviSyncRows_(lk).filter(function (r) { return now - Number(r[3]) < SVI_LOCK_MS; }).map(function (r) { return { ref: String(r[0]), user: String(r[1]), onglet: String(r[2]), ts: Number(r[3]) }; }) };
    }
    if (b.action === "v3Pull") {
      var i = sviSyncFind_(sh, b.ref); if (i < 0) return { ok: true, missing: true };
      var r = sh.getRange(i, 1, 1, sh.getLastColumn()).getValues()[0];
      return { ok: true, ref: String(r[0]), projet: String(r[1]), etat: String(r[2]), rev: Number(r[3]) || 0, ts: Number(r[4]) || 0, user: String(r[5]), data: sviSyncData_(r) };
    }
    if (b.action === "v3Push") {
      var j = sviSyncFind_(sh, b.ref), cur = j > 0 ? sh.getRange(j, 1, 1, sh.getLastColumn()).getValues()[0] : null;
      var rev = cur ? Number(cur[3]) || 0 : 0;
      if (cur && Number(b.baseRev || 0) !== rev) return { ok: true, conflict: true, rev: rev, ts: Number(cur[4]) || 0, user: String(cur[5]), data: sviSyncData_(cur) };
      var txt = String(b.data || ""), parts = [];
      for (var k = 0; k < txt.length; k += SVI_SYNC_CHUNK) parts.push(txt.slice(k, k + SVI_SYNC_CHUNK));
      var row = [String(b.ref), String(b.projet || ""), String(b.etat || ""), rev + 1, Number(b.ts) || Date.now(), String(b.user || ""), txt.length].concat(parts);
      if (j < 0) j = sh.getLastRow() + 1;
      var w = Math.max(row.length, cur ? cur.length : 0);
      while (row.length < w) row.push("");
      sh.getRange(j, 1, 1, w).setNumberFormat("@").setValues([row]);
      /* contrôle : le budget relu compte les mêmes lignes */
      var back = sviSyncData_(sh.getRange(j, 1, 1, w).getValues()[0]), ctl = {};
      try { var o0 = JSON.parse(back), o = o0.data || o0; ["des", "lot", "prim", "sec", "chg", "prd", "links"].forEach(function (x) { ctl[x] = (o[x] || []).length; }); } catch (e) { ctl.err = "RELECTURE IMPOSSIBLE"; }
      return { ok: true, rev: rev + 1, len: back.length, ctl: ctl };
    }
    if (b.action === "v3Del") { var d = sviSyncFind_(sh, b.ref); if (d > 0) sh.deleteRow(d); return { ok: true }; }
    if (b.action === "v3Lock" || b.action === "v3Unlock") {
      var now2 = Date.now(), rows = sviSyncRows_(lk), mine = -1, other = null;
      rows.forEach(function (r, x) { if (String(r[0]) !== String(b.ref)) return; if (String(r[1]) === String(b.user)) mine = x + 2; else if (now2 - Number(r[3]) < SVI_LOCK_MS && (!String(r[2]) || !String(b.onglet || "") || String(r[2]) === String(b.onglet))) other = { user: String(r[1]), onglet: String(r[2]), ts: Number(r[3]) }; });
      if (b.action === "v3Unlock") { if (mine > 0) lk.deleteRow(mine); return { ok: true }; }
      if (other) return { ok: true, held: other };
      var v = [[String(b.ref), String(b.user || ""), String(b.onglet || ""), now2]];
      if (mine > 0) lk.getRange(mine, 1, 1, 4).setValues(v); else lk.getRange(lk.getLastRow() + 1, 1, 1, 4).setValues(v);
      return { ok: true, mine: true };
    }
    if (b.action === "v3Photo") return sviSyncPhoto_(ss, b);
    if (b.action === "v3Stats") {
      var cells = 0; ss.getSheets().forEach(function (s) { cells += s.getMaxRows() * s.getMaxColumns(); });
      return { ok: true, cells: cells, limit: 10000000 };
    }
  } finally { lock.releaseLock(); }
}

/* photo : lignes du budget remplacées dans BUDGETS, DESIGNATIONS, TACHES, DETAILS (identifiants donnés ici) */
function sviSyncPhoto_(ss, b) {
  var ref = String(b.ref);
  var del = function (name, col) {
    var sh = ss.getSheetByName(name); if (!sh || sh.getLastRow() < 2) return sh;
    var v = sh.getRange(2, col, sh.getLastRow() - 1, 1).getValues();
    for (var i = v.length - 1; i >= 0; i--) if (String(v[i][0]) === ref) sh.deleteRow(i + 2);
    return sh;
  };
  var head = function (sh) { return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String); };
  var nextId = function (sh, p) { var n = 0; if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) { var m = String(r[0]).match(/(\d+)$/); if (m) n = Math.max(n, Number(m[1])); }); return function () { n++; return p + ("00000" + n).slice(-5); }; };
  var put = function (sh, objs) {
    if (!objs.length) return;
    var h = head(sh);
    var rows = objs.map(function (o) { return h.map(function (c) { return o[c] === undefined ? "" : o[c]; }); });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, h.length).setValues(rows);
  };
  var B = del("BUDGETS", 1), D = del("DESIGNATIONS", 2), T = ss.getSheetByName("TACHES"), Dt = ss.getSheetByName("DETAILS");
  /* détails rattachés aux tâches du budget (TACHE_ID) : supprimés avant les tâches */
  if (Dt && Dt.getLastRow() > 1 && T) {
    var tids = {}; sviSyncRows_(T).forEach(function (r) { if (String(r[1]) === ref) tids[String(r[0])] = 1; });
    var v = Dt.getRange(2, 2, Dt.getLastRow() - 1, 1).getValues();
    for (var i = v.length - 1; i >= 0; i--) if (tids[String(v[i][0])]) Dt.deleteRow(i + 2);
  }
  T = del("TACHES", 2);
  if (B) put(B, [b.budget || {}]);
  var idD = nextId(D, "D"), idT = nextId(T, "T"), idE = nextId(Dt, "E"), mapD = {}, mapT = {};
  put(D, (b.des || []).map(function (o) { var id = idD(); mapD[o._k] = id; var x = JSON.parse(JSON.stringify(o)); x.ID = id; x.BDG = ref; return x; }));
  put(T, (b.taches || []).map(function (o) { var id = idT(); mapT[o._k] = id; var x = JSON.parse(JSON.stringify(o)); x.ID = id; x.BDG = ref; x.DESIGNATION_ID = mapD[o._d] || ""; return x; }));
  put(Dt, (b.details || []).map(function (o) { var x = JSON.parse(JSON.stringify(o)); x.ID = idE(); x.TACHE_ID = mapT[o._t] || ""; return x; }));
  return { ok: true, des: (b.des || []).length, taches: (b.taches || []).length, details: (b.details || []).length };
}

/* =========================================================
   SAUVEGARDE DE CHAQUE NUIT : copie de la base V3 dans le dossier « SVI ERP — SAUVEGARDES » (30 dernières gardées)
   ========================================================= */
function sauvegardeNuit() {
  var f = DriveApp.getFileById(sviV3Id_());
  var it = DriveApp.getFoldersByName("SVI ERP — SAUVEGARDES");
  var dir = it.hasNext() ? it.next() : DriveApp.createFolder("SVI ERP — SAUVEGARDES");
  var d = new Date(), p = function (n) { return ("0" + n).slice(-2); };
  f.makeCopy(f.getName() + " — " + d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()), dir);
  var all = [], fs = dir.getFiles(); while (fs.hasNext()) all.push(fs.next());
  all.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  all.slice(30).forEach(function (x) { x.setTrashed(true); });
}
function installerSauvegardeNuit() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "sauvegardeNuit") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("sauvegardeNuit").timeBased().atHour(2).everyDays(1).create();
}
