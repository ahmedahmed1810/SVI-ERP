/* =========================================================
   DONNÉES DU BUDGET (refonte, étape 1, v641) — un seul endroit pour :
   - la forme des données d'un budget en instance (sviBudgetData) ;
   - les conversions des anciens budgets, faites une fois à l'ouverture (SVI_MIGRATIONS, sviMigrate) ;
   - la mise en ordre faite à chaque enregistrement (sviDataTidy) ;
   - l'écriture du budget dans la liste des budgets de l'appareil (sviBudgetStore) ;
   - le contrôle des doublons d'un état enregistré (sviDataHasDup, pour ANNULER / RÉTABLIR).
   Aucune fonction ici ne touche à l'écran.
   ========================================================= */
/* forme d'un budget en instance : blocs toujours présents */
const sviBudgetData = inst => inst ? (inst.data = Object.assign(
  { des: [], lot: [], prim: [], sec: [], chg: [], prd: [], qlt: [], dly: {}, links: [] },
  inst.data || {})) : null;
/* délais par TÂCHE SECONDAIRE (lot + act. scd), 12/10/2026 : les périodes saisies par tâche primaire
   sont recopiées dans chacune de ses tâches secondaires (sans chevauchement) ; une seule fois par budget */
const sviDlpSec = d => {
  if (!d || d.dlpSec) return false;
  const out = {};
  Object.keys(d.dlp || {}).forEach(key => {
    const [lo, pr] = key.split("|");
    const secs = [...new Set((d.links || []).filter(l => l.lot === lo && l.prim === pr).map(l => l.sec))];
    secs.forEach(se => {
      const list = out[lo + "|" + se] = out[lo + "|" + se] || [];
      (d.dlp[key] || []).forEach(p => {
        if (list.some(x => x.deb && x.fin && p.deb && p.fin && p.deb < x.fin && x.deb < p.fin)) return;
        list.push({ id: p.id + (secs.length > 1 ? "s" + se : ""), deb: p.deb || "", fin: p.fin || "" });
      });
    });
  });
  d.dlp = out;
  d.dlpSec = true;
  return true;
};
/* ===== PLANNING (15/10/2026) : une seule période par tâche secondaire (fragmentation reportée) ;
   des périodes déjà saisies en plusieurs morceaux sont fusionnées : début de la première, fin de la dernière ===== */
/* v547 (R22, 23/10/2026) : une tâche peut avoir plusieurs morceaux — plus de fusion ; les morceaux sont seulement rangés par date
   (un morceau sans date n'est gardé que s'il est seul) */
const sviDlpOne = d => {
  if (!d || !d.dlp) return false;
  let ch = false;
  Object.keys(d.dlp).forEach(k => {
    const L = d.dlp[k] || [];
    if (L.length <= 1) return;
    const keep = L.filter(p => p.deb).sort((a, b) => a.deb.localeCompare(b.deb));
    const nx = keep.length ? keep : [L[0]];
    if (nx.length !== L.length || nx.some((p, i) => p !== L[i])) { d.dlp[k] = nx; ch = true; }
  });
  return ch;
};
/* prédécesseurs typés : { k: "lot|sec", t: "FD" (FIN → DÉBUT) | "DD" (DÉBUT → DÉBUT), o: décalage en jours travaillés (≥ 0) } ;
   les anciennes listes de clés deviennent FIN → DÉBUT, décalage 0 */
const sviDpredTyped = d => {
  if (!d || !d.dpred) return false;
  let ch = false;
  Object.keys(d.dpred).forEach(k => {
    const L = d.dpred[k] || [];
    if (L.some(x => typeof x === "string")) {
      d.dpred[k] = L.map(x => typeof x === "string" ? { k: x, t: "FD", o: d.fdV2 ? 1 : 0 } : x);
      ch = true;
    }
  });
  return ch;
};
/* v544 (23/10/2026) : décalage FIN → DÉBUT — 0 = le jour même où finit la précédente, 1 = le lendemain, jamais négatif.
   Avant : 0 = le lendemain, −1 = le même jour. Conversion unique (les dates ne bougent pas) : nouveau = ancien + 1 */
const sviDpredV2 = d => {
  if (!d || d.fdV2) return false;
  Object.keys(d.dpred || {}).forEach(k => { d.dpred[k] = (d.dpred[k] || []).map(x => x && typeof x === "object" && x.t !== "DD" ? { ...x, o: Math.max(0, (Number(x.o) || 0) + 1) } : x); });
  d.fdV2 = true;
  return true;
};
/* v625 (remarque 86) : décalage FIN → DÉBUT compté depuis la demi-journée qui suit la fin — conversion unique à l'ouverture
   (après V2) : ancien n ≥ 1 → n − 1 ; les dates ne bougent pas */
const sviDpredV3 = d => {
  if (!d || d.dmig86) return false;
  Object.keys(d.dpred || {}).forEach(k => { d.dpred[k] = (d.dpred[k] || []).map(x => x && typeof x === "object" && x.t !== "DD" && x.o > 0 ? { ...x, o: x.o - 1 } : x); });
  d.dmig86 = 1;
  return true;
};
/* conversions des anciens budgets, dans l'ordre ; chacune ne se fait qu'une fois (drapeau dans les données) */
const SVI_MIGRATIONS = [sviDlpSec, sviDlpOne, sviDpredTyped, sviDpredV2, sviDpredV3];
/* toutes les conversions : vrai si une a changé quelque chose (le budget est alors enregistré) */
const sviMigrate = d => !!d && SVI_MIGRATIONS.reduce((ch, f) => f(d) || ch, false);
/* mise en ordre à chaque enregistrement : morceaux rangés par date, prédécesseurs typés */
const sviDataTidy = d => { if (!d) return; sviDlpOne(d); sviDpredTyped(d); };
/* écriture du budget (ref) dans la liste de l'appareil, regroupée 250 ms après le dernier changement */
const SVI_STORE_T = {};
const sviBudgetStore = (ref, getData) => {
  clearTimeout(SVI_STORE_T[ref]);
  SVI_STORE_T[ref] = setTimeout(() => {
    const list = sviInstGet();
    const r = list.find(x => x.ref === ref);
    if (!r) return;
    r.data = getData();
    sviInstSet(list);
  }, 250);
};
/* un état enregistré contient-il un doublon (désignation + unité, intitulé de lot / activité, produit / charge par tâche) ? */
const sviDataHasDup = o => {
  const U = v => String(v ?? "").trim().toUpperCase();
  const tasks = (k, id) => [...new Set((o.links || []).filter(l => (l[k] || []).some(x => x.id === id)).map(l => l.lot + "|" + l.sec))].sort().join(",");
  const key = (k, r) => !r || r.t ? "" : ["lot", "prim", "sec"].includes(k) ? U(r.v) : !U(r.des) ? "" : U(r.des) + "|" + U(r.u) + (k === "prd" || k === "chg" ? "#" + tasks(k, r.id) : "");
  return ["des", "lot", "prim", "sec", "prd", "chg"].some(k => { const S = new Set(); return (o[k] || []).some(r => { const x = key(k, r); if (!x) return false; if (S.has(x)) return true; S.add(x); return false; }); });
};
