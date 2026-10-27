/* =========================================================
   RÈGLES DE CALCUL DU PLANNING (refonte, étape 5, v644) — calcul pur, sans écran ni budget ouvert :
   chaque fonction reçoit le calendrier du budget (sviCalOf) et des dates ISO (AAAA-MM-JJ) ; testées une par une
   (tests/test_app.py, « règle planning »). Cahier 04 PLANNING, sections Liaisons et DÉBUT, FIN, DURÉE.
   ========================================================= */
/* date de début exigée par UNE liaison
   - DÉBUT → DÉBUT : début du prédécesseur (jour travaillé) + décalage ;
   - FIN → DÉBUT (v617, remarque 86) : décalage 0 = la demi-journée qui suit la fin (le jour même si le prédécesseur finit à midi,
     sinon le jour travaillé suivant) ; n = n jours travaillés de plus ; jamais négatif.
   pred = { deb, fin, finMidi } */
const sviPlanLinkNeed = (cal, link, pred) => {
  const o = Math.max(0, Number(link && link.o) || 0);
  if (!pred) return "";
  if (link.t === "DD") return pred.deb ? sviWAdd(cal, sviWNear(cal, pred.deb, 1), o) : "";
  if (!pred.fin) return "";
  return sviWAdd(cal, pred.finMidi ? pred.fin : sviWAdd(cal, pred.fin, 1), o);
};
/* plusieurs prédécesseurs : la date la plus tardive exigée ; predOf(k) → { deb, fin, finMidi } */
const sviPlanNeed = (cal, links, predOf) => (links || []).map(x => sviPlanLinkNeed(cal, x, predOf(x.k))).filter(Boolean).sort().pop() || "";
/* décalage FIN → DÉBUT d'une liaison créée entre a (fin, fin à midi ?) et b (début) : nombre de jours travaillés libres
   après la demi-journée qui suit la fin de a (0 si b commence aussitôt) */
const sviPlanChainO = (cal, finA, finMidiA, debB) => {
  if (!finA || !debB) return 0;
  const base = finMidiA ? finA : sviWAdd(cal, finA, 1);
  return debB > base ? Math.max(0, (Number(sviWDur(cal, base, debB)) || 1) - 1) : 0;
};
/* tâche déplacée à un nouveau début, même durée en jours travaillés (v639 : DÉBUT posé après la FIN) */
const sviPlanMove = (cal, deb, fin, newDeb) => {
  const dur = deb && fin ? sviWDur(cal, deb, fin) || 1 : 1;
  return { deb: newDeb, fin: sviWAdd(cal, newDeb, dur - 1) };
};
