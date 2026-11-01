/* =========================================================
   v767 : IMPORT DES ACHATS DE NOVAPP (ACHATS › PARAMÈTRES › IMPORTER LES DONNÉES DE NOVAPP)
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
/* rattachement d'un besoin importé : budget du projet (validé de préférence), charge de même désignation, première tâche */
function achNovBsnLink(B) {
  let I = []; try { I = sviInstGet().filter(b => b && !b.parent && !b.rclOf && !b.virtual && !b.arch); } catch (e) {}
  const BL = achBdgList(), CH = new Map(), st = { siege: 0, ok: 0, bdg: 0, none: 0 };
  const bdgOf = prj => { const L = I.filter(b => achU(b.project) === prj); return (L.find(b => b.state === "valide") || L[0] || null); };
  B.forEach(b => {
    if (b.prj === "F26") { b.centre = "SIÈGE"; b.bdg = ""; b.chg = achKey(b.des, b.u); b.tache = ""; st.siege++; return; }
    b.centre = "CHANTIER"; const g = bdgOf(b.prj);
    if (!g) { b.bdg = ""; b.chg = ""; b.tache = ""; b.bdgLab = b.prj; st.none++; return; }
    if (!CH.has(g.ref)) { let C = []; try { C = achBdgCharges(g.ref); } catch (e) {} CH.set(g.ref, C); }
    const C = CH.get(g.ref), c = C.find(x => x.key === achKey(b.des, b.u)) || C.find(x => x.des === achU(b.des));
    b.bdg = g.ref; b.bdgLab = (BL.find(x => x.ref === g.ref) || {}).lab || (b.prj + " " + g.ref);
    if (c) { b.chg = c.key; b.u = b.u || c.u; b.tache = c.tasks[0] || ""; if (!b.pu) b.pu = Math.round(c.p * 100) / 100; st.ok++; } else { b.chg = ""; b.tache = ""; st.bdg++; }
  });
  return st;
}
async function achNovImport(file, done) {
  let D = null; try { D = JSON.parse(await file.text()); } catch (e) {}
  if (!D || D.src !== "NOVAPP" || !Array.isArray(D.art)) { svToast("FICHIER NON RECONNU : CHOISIR novapp-achats.json.", 4000); return; }
  const n = k => (D[k] || []).length;
  if (!(await svConfirm({ title: "IMPORTER LES DONNÉES DE NOVAPP", html: `<div class="svc-sub">${n("art")} ARTICLES · ${n("frs")} FOURNISSEURS · ${n("bsn")} BESOINS · ${n("caf")} CONSULTATIONS · ${n("dvf")} DEVIS · ${n("cmf")} COMMANDES · ${n("rcp")} RÉCEPTIONS · ${n("faf")} FACTURES · ${n("paf")} PAIEMENTS</div>
      <div class="svc-sub">LES DONNÉES DES ACHATS ACTUELLES SONT REMPLACÉES (COPIE DE SÉCURITÉ GARDÉE SUR CET APPAREIL). RÉFÉRENCES RENUMÉROTÉES, DATES D'ORIGINE GARDÉES, ANCIENNE RÉFÉRENCE DANS H.</div>`, ok: "IMPORTER", tone: "neutral" }))) return;
  const K = ["art", "frs", "bsn", "caf", "dvf", "cmf", "rcp", "rtr", "faf", "avf", "paf"];
  try { const bk = {}; K.forEach(k => { bk[k] = localStorage.getItem(ACH_K[k]); }); bk[ACH_NOV_K] = localStorage.getItem(ACH_NOV_K); localStorage.setItem("svi_ach_backup_v1", JSON.stringify({ t: achNow(), bk })); } catch (e) {}
  const st = achNovBsnLink(D.bsn || []);
  D.bsn.forEach(b => { delete b.prj; });
  achArtsSave(D.art); achFrsSave(D.frs); achBsnSave(D.bsn); achCafSave(D.caf); achDvfSave(D.dvf); achCmfSave(D.cmf); achRcpSave(D.rcp); achRtrSave([]); achFafSave(D.faf); achAvfSave([]); achPafSave(D.paf);
  achW(ACH_NOV_K, D.nov || {});
  const P = achPrm(); (D.prm && D.prm.cat || []).forEach(c => { if (c && !P.cat.includes(c)) P.cat.push(c); }); achPrmSave(P);
  const ok = ["art", "frs", "bsn", "caf", "dvf", "cmf", "rcp", "faf", "paf"].every(k => (localStorage.getItem(ACH_K[k]) || "").length === JSON.stringify(D[k]).length);
  svToast(ok ? `IMPORT TERMINÉ — BESOINS : ${st.ok} RATTACHÉS À UNE CHARGE ET UNE TÂCHE, ${st.siege} SIÈGE (F26), ${st.bdg} AU BUDGET SANS CHARGE TROUVÉE, ${st.none} SANS BUDGET SUR CET APPAREIL (À COMPLÉTER).`
    : "IMPORT INCOMPLET : MÉMOIRE DE L'APPAREIL PLEINE ?", 9000);
  if (done) done();
}
