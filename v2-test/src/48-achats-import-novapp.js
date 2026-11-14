/* =========================================================
   v767 : (ancien) IMPORT DES ACHATS DE NOVAPP (ACHATS › PARAMÈTRES › IMPORTER LES DONNÉES DE NOVAPP)
   Fichier novapp-achats.json préparé depuis l'export NovApp (articles, fournisseurs, besoins, consultations, devis, commandes,
   réceptions, factures, paiements, historique). Décisions d'Ahmed (01/11/2026) :
   - références RENUMÉROTÉES au format du SVI ERP, DATES D'ORIGINE GARDÉES ; l'ancienne référence NovApp reste dans l'historique (H) ;
   - besoin : budget du PROJET, charge de même désignation, PREMIÈRE TÂCHE trouvée ; F26 = SIÈGE ; sinon rattaché au projet, à compléter.
   Les données des achats de l'appareil sont REMPLACÉES (copie de sécurité gardée sur l'appareil : svi_ach_backup_v1).
   ========================================================= */
const ACH_NOV_K = "svi_ach_nov_v1";
const achNovOf = code => { const M = achJ(ACH_NOV_K, {}) || {}; return M[code] || null; };
/* historique H : lignes NovApp (ancienne référence, actions d'origine) puis celles du SVI ERP */
const achHistNov = code => { const x = achNovOf(code); if (!x) return [];
  return [{ t: (x.h[0] || [])[0] || "", a: "ANCIENNE RÉFÉRENCE NOVAPP", d: x.o, u: "IMPORT" }].concat((x.h || []).map(([t, a]) => ({ t, a, d: "NOVAPP — " + x.o, u: "" }))); };
/* B15 (série B, 04/11/2026) : plus de bouton ni de procédure d'import NovApp (un import éventuel se fera autrement) ;
   seule la lecture de l'historique des pièces déjà importées est gardée (ancienne référence dans H). */
