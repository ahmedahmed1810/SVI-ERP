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
   v3AchTabs → (v768) refait les onglets lisibles des ACHATS ; ils sont aussi refaits à chaque envoi d'une liste des achats :
             ACH ARTICLES, ACH FOURNISSEURS, ACH BESOINS, ACH CONSULTATIONS, ACH DEVIS, ACH COMMANDES, ACH RECEPTIONS,
             ACH RETOURS, ACH FACTURES, ACH AVOIRS, ACH PAIEMENTS, ACH LIGNES (lecture seule : la saisie se fait dans l'application ;
             la donnée de référence reste la ligne « _K:svi_ach_… » de SYNC). Fonction à lancer à la main : refaireOngletsAchats.
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
  var A = ["v3List", "v3Pull", "v3Push", "v3Del", "v3Lock", "v3Unlock", "v3Photo", "v3Stats", "v3AchTabs"];
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
      /* v768 : une liste des ACHATS reçue → onglets lisibles « ACH … » refaits */
      if (/^_K:svi_ach_/.test(String(b.ref))) { try { sviAchTabs_(ss, sh); ctl.tabs = "OK"; } catch (e) { ctl.tabs = String(e); } }
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
    if (b.action === "v3AchTabs") return sviAchTabs_(ss, sh);
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

/* =========================================================
   v768 : ONGLETS LISIBLES DES ACHATS (même Google Sheet que les budgets)
   Refaits entièrement à partir des lignes « _K:svi_ach_…_v1 » de SYNC ; noms et références au lieu des identifiants.
   ========================================================= */
function refaireOngletsAchats() { var ss = sviSyncSS_(); return sviAchTabs_(ss, ss.getSheetByName("SYNC")); }
function sviAchTabs_(ss, sh) {
  var L = {};
  sviSyncRows_(sh).forEach(function (r) {
    var m = String(r[0]).match(/^_K:svi_ach_([a-z]+)_v1$/); if (!m) return;
    try { var o = JSON.parse(sviSyncData_(r)), v = o.data ? o.data.v : o.v; L[m[1]] = JSON.parse(SVI_LZ.dec(v)); } catch (e) {}
  });
  var A = function (k) { return Array.isArray(L[k]) ? L[k] : []; };
  var by = function (k) { var M = {}; A(k).forEach(function (x) { M[x.id] = x; }); return M; };
  var FRS = by("frs"), CMF = by("cmf"), RCP = by("rcp"), FAF = by("faf"), DVF = by("dvf"), CAF = by("caf"), BSN = by("bsn"), NOV = L.nov || {};
  var n = function (v) { var x = Number(String(v === undefined || v === null ? "" : v).replace(",", ".")); return isFinite(x) ? x : 0; };
  var r2 = function (v) { return Math.round(n(v) * 100) / 100; };
  var dt = function (v) { var m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/); return m ? m[3] + "/" + m[2] + "/" + m[1] + (m[4] ? " " + m[4] + ":" + m[5] : "") : ""; };
  var nom = function (id) { return FRS[id] ? FRS[id].nom : ""; };
  var ref = function (M, id) { return M[id] ? (M[id].ref || M[id].code || "") : ""; };
  var old = function (x) { return x.nov || (NOV[x.ref || x.code] || {}).o || ""; };
  var tva0 = 20; try { var P = JSON.parse(JSON.stringify(L.prm || {})); if (P.tva !== undefined) tva0 = n(P.tva); } catch (e) {}
  var tv = function (l) { return l.tva === "" || l.tva === undefined ? tva0 : n(l.tva); };
  var tot = function (c) { var ht = 0, tva = 0, rm = 1 - n(c.rem) / 100; (c.lignes || []).forEach(function (l) { var m = n(l.q) * n(l.pu) * rm; ht += m; tva += m * tv(l) / 100; }); var fr = n(c.frais); ht += fr; tva += fr * tva0 / 100; return { ht: ht, ttc: ht + tva }; };
  var live = function (p) { return p.state !== "annule" && p.state !== "rejete" && p.state !== "instance"; };
  var paid = {}; A("paf").forEach(function (p) { if (!live(p)) return; (p.aff || []).forEach(function (a) { paid[a.fa] = (paid[a.fa] || 0) + n(a.m); }); });
  var ST = { instance: "EN INSTANCE", valide: "VALIDÉ", annule: "ANNULÉ", ouverte: "OUVERTE", close: "CLOSE", recu: "REÇU", retenu: "RETENU", rejete: "REJETÉ", solde: "SOLDÉE", reclame: "RÉCLAMÉE", bap: "BON À PAYER", emis: "ÉMIS", encaisse: "ENCAISSÉ" };
  var st = function (x) { return x.del ? "CORBEILLE" : ST[x.st || x.state] || (x.st || x.state || "VALIDÉ"); };
  var lines = [];
  var addL = function (doc, x) { (x.lignes || []).forEach(function (l, i) { lines.push([doc, x.ref || "", i + 1, l.des || "", l.u || "", n(l.q), r2(l.pu), l.pu === undefined ? "" : tv(l), l.pu === undefined ? "" : r2(n(l.q) * n(l.pu)), ref(BSN, l.bsn), ref(DVF, l.dvf), l.st ? ({ ok: "ACCEPTÉE", res: "AVEC RÉSERVES", ref: "REFUSÉE" })[l.st] || l.st : ""]); }); };
  var T = [
    ["ACH ARTICLES", ["CODE", "DESIGNATION", "UNITE", "CATEGORIE", "STOCKE", "TVA %", "PRIX REF HT", "PLAFOND HT", "ACTIF", "ETAT", "SAISI LE", "VALIDE LE", "ANCIENNE REF"],
      A("art").map(function (a) { return [a.code, a.des, a.u, a.cat || "", a.stk ? "OUI" : "NON", n(a.tva), r2(a.pref), r2(a.pmax), a.actif === false ? "NON" : "OUI", st(a), dt(a.cree), dt(a.val), old(a)]; })],
    ["ACH FOURNISSEURS", ["CODE", "NOM", "FORME", "VILLE", "ICE", "IF", "RC", "PAIEMENT", "RIB PRINCIPAL", "OCCASIONNEL", "ACTIF", "ETAT", "SAISI LE", "VALIDE LE", "ANCIENNE REF"],
      A("frs").map(function (f) { var rb = (f.ribs || []).filter(function (r) { return r.p; })[0] || (f.ribs || [])[0] || {}; return [f.code, f.nom, f.forme || "", f.ville || "", f.ice || "", f.ifisc || "", f.rc || "", f.cond || "", rb.rib || "", f.occ ? "OUI" : "NON", f.actif === false ? "NON" : "OUI", st(f), dt(f.cree), dt(f.val), old(f)]; })],
    ["ACH BESOINS", ["REFERENCE", "ETAT", "CENTRE", "BUDGET", "DESIGNATION", "UNITE", "QTE", "PRIX ESTIME", "MONTANT", "TACHE", "PREVU LE", "PRIORITE", "DEMANDEUR", "SAISI LE", "VALIDE LE", "ANCIENNE REF"],
      A("bsn").map(function (b) { return [b.ref, st(b), b.centre || "", b.centre === "SIÈGE" ? "SIÈGE" : (b.bdgLab || b.bdg || ""), b.des || "", b.u || "", n(b.q), r2(b.pu), r2(n(b.q) * n(b.pu)), b.tache || "", dt(b.datePrevue), b.prio || "", b.dem || "", dt(b.cree), dt(b.valide), old(b)]; })],
    ["ACH CONSULTATIONS", ["REFERENCE", "ETAT", "OBJET", "FOURNISSEURS", "RETENU", "DATE LIMITE", "LIGNES", "SAISI LE", "CLOSE LE", "ANCIENNE REF"],
      A("caf").map(function (c) { addL("CAF", c); return [c.ref, st(c), c.objet || "", (c.frs || []).map(nom).join(" · "), nom(c.retenu), dt(c.dlim), (c.lignes || []).length, dt(c.cree), dt(c.valide), old(c)]; })],
    ["ACH DEVIS", ["REFERENCE", "ETAT", "FOURNISSEUR", "N° FOURNISSEUR", "CONSULTATION", "DATE", "VALIDITE", "MONTANT HT", "MONTANT TTC", "SAISI LE", "ANCIENNE REF"],
      A("dvf").map(function (v) { addL("DVF", v); var t = tot(v); return [v.ref, st(v), nom(v.frs), v.refFrs || "", ref(CAF, v.caf), dt(v.date), dt(v.validite), r2(t.ht), r2(t.ttc), dt(v.cree), old(v)]; })],
    ["ACH COMMANDES", ["REFERENCE", "ETAT", "NATURE", "FOURNISSEUR", "LIVRAISON", "DATE PROMISE", "DEVIS", "MONTANT HT", "MONTANT TTC", "SAISI LE", "VALIDE LE", "ANCIENNE REF"],
      A("cmf").map(function (c) { addL("CMF", c); var t = tot(c); return [c.ref + (c.av ? " AV" + c.av : ""), st(c), c.nat || "", nom(c.frs), c.lieu || "", dt(c.dConf || c.dProm), ref(DVF, c.dvf), r2(t.ht), r2(t.ttc), dt(c.cree), dt(c.valide), old(c)]; })],
    ["ACH RECEPTIONS", ["REFERENCE", "ETAT", "COMMANDE", "FOURNISSEUR", "N° BL", "RECU LE", "LIGNES", "ANCIENNE REF"],
      A("rcp").map(function (r) { addL("RCP", r); return [r.ref, st(r), ref(CMF, r.cmf) || "SANS COMMANDE", nom(r.frs), r.pv ? "PV DE SERVICE FAIT" : r.nbl || "", dt(r.date), (r.lignes || []).length, old(r)]; })],
    ["ACH RETOURS", ["REFERENCE", "TYPE", "COMMANDE", "RECEPTION", "FOURNISSEUR", "DATE", "MOTIF", "CHAUFFEUR"],
      A("rtr").map(function (x) { addL(x.kind === "cmd" ? "RTC" : "RTR", x); return [x.ref, x.kind === "cmd" ? "RETOUR DE COMMANDE" : "RETOUR DE RÉCEPTION", ref(CMF, x.cmf), ref(RCP, x.rcp), nom(x.frs), dt(x.date), x.motif || "", x.chauffeur || ""]; })],
    ["ACH FACTURES", ["REFERENCE", "ETAT", "FOURNISSEUR", "N° FACTURE", "COMMANDE", "DATE", "ECHEANCE", "MONTANT TTC", "PAYE", "RESTE", "SAISI LE", "ANCIENNE REF"],
      A("faf").map(function (f) { addL("FAF", f); var ttc = f.sTtc !== "" && f.sTtc !== undefined ? n(f.sTtc) : tot(f).ttc, net = ttc - n(f.avImp); return [f.ref, st(f), nom(f.frs), f.num || "", ref(CMF, f.cmf), dt(f.dFac), dt(f.ech), r2(ttc), r2(paid[f.id] || 0), f.state === "annule" ? "" : r2(net - (paid[f.id] || 0)), dt(f.cree), old(f)]; })],
    ["ACH AVOIRS", ["REFERENCE", "ETAT", "FOURNISSEUR", "N° AVOIR", "FACTURE", "DATE", "MONTANT TTC", "MOTIF"],
      A("avf").map(function (a) { return [a.ref, st(a), nom(a.frs), a.num || "", ref(FAF, a.fa), dt(a.date), r2(a.ttc), a.motif || ""]; })],
    ["ACH PAIEMENTS", ["REFERENCE", "ETAT", "TYPE", "FOURNISSEUR", "MODE", "N°", "DATE", "MONTANT", "FACTURES", "COMMANDE", "COMPTE", "ANCIENNE REF"],
      A("paf").map(function (p) { return [p.ref, st(p), p.type === "avance" ? "AVANCE" : "RÈGLEMENT", nom(p.frs), p.mode || "", p.num || "", dt(p.date), r2(p.mt), (p.aff || []).map(function (a) { return ref(FAF, a.fa); }).join(" · "), ref(CMF, p.cmf), p.compte || "", old(p)]; })]
  ];
  T.push(["ACH LIGNES", ["DOC", "REFERENCE", "N", "DESIGNATION", "UNITE", "QTE", "PRIX HT", "TVA %", "MONTANT HT", "BESOIN", "DEVIS", "RESULTAT"], lines]);
  var out = {};
  T.forEach(function (t) {
    var name = t[0], head = t[1], rows = t[2];
    var s = ss.getSheetByName(name) || ss.insertSheet(name);
    s.clearContents();
    var all = [head].concat(rows);
    if (s.getMaxColumns() < head.length) s.insertColumnsAfter(s.getMaxColumns(), head.length - s.getMaxColumns());
    if (s.getMaxRows() < all.length) s.insertRowsAfter(s.getMaxRows(), all.length - s.getMaxRows());
    /* nombres gardés en nombres (sommes possibles) ; le reste en texte (ICE, RIB, dates : pas de conversion par Google) */
    head.forEach(function (h, c) { var num = rows.length && rows.every(function (r) { return typeof r[c] === "number" || r[c] === ""; }); s.getRange(1, c + 1, all.length, 1).setNumberFormat(num ? "#,##0.00" : "@"); });
    s.getRange(1, 1, all.length, head.length).setValues(all.map(function (r) { return r.map(function (v) { return v === null || v === undefined ? "" : typeof v === "number" ? v : String(v); }); }));
    s.setFrozenRows(1); s.getRange(1, 1, 1, head.length).setFontWeight("bold");
    out[name] = rows.length;
  });
  return { ok: true, tabs: out };
}

/* v769 (même code que l'application, 02e) : COMPRESSION des grandes listes (achats) dans la mémoire de l'appareil — algorithme lz-string (Pieroxy, licence MIT),
   variante UTF-16 (15 bits par caractère) faite pour localStorage. Valeur compressée = « \u0001LZ » + texte compressé. */
const SVI_LZ = (() => {
  const f = String.fromCharCode;
  function compress(u, bits, gc) {
    if (u == null) return "";
    let i, v, dict = {}, toCreate = {}, c = "", wc = "", w = "", enlarge = 2, dictSize = 3, numBits = 2, data = [], val = 0, pos = 0, ii;
    const out = (n, b) => { for (let k = 0; k < b; k++) { val = (val << 1) | (n & 1); if (pos === bits - 1) { pos = 0; data.push(gc(val)); val = 0; } else pos++; n >>= 1; } };
    const outZero = b => { for (let k = 0; k < b; k++) { val = val << 1; if (pos === bits - 1) { pos = 0; data.push(gc(val)); val = 0; } else pos++; } };
    const emitW = () => {
      if (Object.prototype.hasOwnProperty.call(toCreate, w)) {
        if (w.charCodeAt(0) < 256) { outZero(numBits); out(w.charCodeAt(0), 8); }
        else { out(1, numBits); out(w.charCodeAt(0), 16); }
        if (--enlarge === 0) { enlarge = Math.pow(2, numBits); numBits++; }
        delete toCreate[w];
      } else out(dict[w], numBits);
      if (--enlarge === 0) { enlarge = Math.pow(2, numBits); numBits++; }
    };
    for (ii = 0; ii < u.length; ii++) {
      c = u.charAt(ii);
      if (!Object.prototype.hasOwnProperty.call(dict, c)) { dict[c] = dictSize++; toCreate[c] = true; }
      wc = w + c;
      if (Object.prototype.hasOwnProperty.call(dict, wc)) w = wc;
      else { emitW(); dict[wc] = dictSize++; w = String(c); }
    }
    if (w !== "") emitW();
    out(2, numBits);
    while (true) { val = val << 1; if (pos === bits - 1) { data.push(gc(val)); break; } else pos++; }
    return data.join("");
  }
  function decompress(length, resetValue, getNext) {
    let dict = [], enlarge = 4, dictSize = 4, numBits = 3, entry = "", result = [], i, w, c, bits, resb, maxpower, power;
    const data = { val: getNext(0), position: resetValue, index: 1 };
    const read = n => { let b = 0; maxpower = Math.pow(2, n); power = 1;
      while (power !== maxpower) { resb = data.val & data.position; data.position >>= 1; if (data.position === 0) { data.position = resetValue; data.val = getNext(data.index++); } b |= (resb > 0 ? 1 : 0) * power; power <<= 1; }
      return b; };
    for (i = 0; i < 3; i++) dict[i] = i;
    switch (read(2)) { case 0: c = f(read(8)); break; case 1: c = f(read(16)); break; case 2: return ""; }
    dict[3] = c; w = c; result.push(c);
    while (true) {
      if (data.index > length) return "";
      switch (c = read(numBits)) {
        case 0: dict[dictSize++] = f(read(8)); c = dictSize - 1; enlarge--; break;
        case 1: dict[dictSize++] = f(read(16)); c = dictSize - 1; enlarge--; break;
        case 2: return result.join("");
      }
      if (enlarge === 0) { enlarge = Math.pow(2, numBits); numBits++; }
      if (dict[c]) entry = dict[c]; else if (c === dictSize) entry = w + w.charAt(0); else return null;
      result.push(entry);
      dict[dictSize++] = w + entry.charAt(0); enlarge--;
      w = entry;
      if (enlarge === 0) { enlarge = Math.pow(2, numBits); numBits++; }
    }
  }
  const toUTF16 = s => s == null ? "" : compress(s, 15, a => f(a + 32)) + " ";
  const fromUTF16 = s => s == null ? "" : s === "" ? null : decompress(s.length, 16384, i => s.charCodeAt(i) - 32);
  const MK = "\u0001LZ";
  return { MK, enc: s => MK + toUTF16(s), dec: v => typeof v === "string" && v.startsWith(MK) ? fromUTF16(v.slice(MK.length)) : v, is: v => typeof v === "string" && v.startsWith(MK) };
})();
