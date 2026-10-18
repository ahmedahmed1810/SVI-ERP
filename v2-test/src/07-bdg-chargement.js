/* =========================================================
   BASE V3 → lignes au format de l'ancien onglet BDG (colonnes A:Z),
   pour que tout l'écran du budget fonctionne sans changement
   ========================================================= */
/* intitulé d'un budget : saisi dans INF (budget en instance), sinon base V3 ; à défaut « À COMPLÉTER » */
function sviIntitule(ref, project, inst) {
  if (inst) return String(inst.intitule || "").trim().toUpperCase() || "À COMPLÉTER";
  const I = window.SVI_V3_INT || { byRef: {}, byPrj: {} };
  const R = String(ref || "").trim().toUpperCase(), P = String(project || "").trim().toUpperCase();
  return I.byRef[R] || I.byRef[(P + " " + R).trim()] || I.byPrj[P] || "À COMPLÉTER";
}
/* client d'un budget : saisi dans INF (budgets créés dans l'application) ; sinon « À COMPLÉTER » */
function sviClient(inst) {
  return (inst && String(inst.client || "").trim().toUpperCase()) || "À COMPLÉTER";
}
function v3ToRows(v3) {
  const tab = name => {
    const t = v3[name] || [];
    if (t.length < 2) return [];
    const h = t[0].map(x => String(x).trim());
    return t.slice(1).map(r => Object.fromEntries(h.map((k, i) => [k, r[i]])));
  };
  const fr = v => typeof v === "number" ? String(v).replace(".", ",") : String(v ?? "");
  const budgets = tab("budgets"), desig = tab("designations"), taches = tab("taches"), details = tab("details");
  const bud = new Map(budgets.map(b => [String(b.REF), b]));
  /* intitulé des budgets validés : base V3 (onglet BUDGETS, colonne INTITULE) ; BDS n'est plus lu */
  window.SVI_V3_INT = { byRef: {}, byPrj: {} };
  budgets.forEach(b => {
    const it = String(b.INTITULE ?? "").trim().toUpperCase();
    if (!it) return;
    window.SVI_V3_INT.byRef[String(b.REF).trim().toUpperCase()] = it;
    const pj = String(b.PROJET ?? "").trim().toUpperCase();
    if (pj && !window.SVI_V3_INT.byPrj[pj]) window.SVI_V3_INT.byPrj[pj] = it;
  });
  const des = new Map(desig.map(d => [String(d.ID), d]));
  const tch = new Map(taches.map(t => [String(t.ID), t]));
  const HEAD = ["", "", "", "", "", "", "PRJ", "N°", "DESIGNATION", "UDB", "LOT", "ACTIVITE", "CLE",
    "ACTIVITE PRIMAIRE", "CHG/PRD", "DETAIL BUDGET", "UTB", "NBR", "DIM1", "DIM2", "DIM3", "QTB", "PUB", "MNB", "", ""];
  return details
    .sort((a, b) => (Number(a.ORDRE) || 0) - (Number(b.ORDRE) || 0))
    .map(e => {
      const t = tch.get(String(e.TACHE_ID)) || {};
      const d = des.get(String(t.DESIGNATION_ID)) || {};
      const b = bud.get(String(t.BDG)) || {};
      const q = Number(e.QTE) || 0, pu = Number(e.PRIX) || 0;
      const cols = new Array(26).fill("");
      cols[6] = b.PROJET || ""; cols[7] = fr(d.ART); cols[8] = d.DESIGNATION || ""; cols[9] = d.UNITE || "";
      cols[10] = t.LOT || ""; cols[11] = t.ACT_SECONDAIRE || ""; cols[12] = e.CLE || "";
      cols[13] = t.ACT_PRIMAIRE || ""; cols[14] = e.TYPE || ""; cols[15] = e.DESIGNATION || "";
      cols[16] = e.UNITE || ""; cols[17] = fr(e.NBR); cols[18] = fr(e.DIM1); cols[19] = fr(e.DIM2);
      cols[20] = fr(e.DIM3); cols[21] = fr(e.QTE); cols[22] = fr(e.PRIX); cols[23] = q && pu ? fr(q * pu) : "";
      const obj = {};
      HEAD.forEach((h, i) => { if (h) obj[h] = cols[i]; });
      Object.defineProperty(obj, "__cols", { value: cols, enumerable: false });
      /* délais de la tâche (onglet TACHES : DEBUT / FIN) */
      const iso = v => { if (!v) return ""; const d = new Date(v); return isNaN(d) ? "" :
        d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
      Object.defineProperty(obj, "__deb", { value: iso(t.DEBUT), enumerable: false });
      Object.defineProperty(obj, "__fin", { value: iso(t.FIN), enumerable: false });
      return obj;
    });
}

/* =========================================================
   BDG — CHARGEMENT
   ========================================================= */

async function ensureBDGLoaded() {
  if (bdgLoaded || bdgLoading) return;

  bdgLoading = true;

  try {
    setBDGLoadingState();
    /* budgets en instance lus sur l'appareil (IndexedDB) avant d'afficher la liste */
    await SVI_INST_READY;

    /* VERSION TEST : lecture de la base V3 (repli sur l'ancien onglet BDG) */
    try {
      const v3 = await apiSrc("v3Read");
      bdgRows = v3ToRows(v3);
      if (!bdgRows.length) throw new Error("BASE V3 VIDE");
      window.SVI_SRC = "V3";
      const tag = document.getElementById("sviTestTag");
      if (tag) tag.textContent = "VERSION TEST — BASE V3";
      bdgLoaded = true;
      renderBudgetList();
      return;
    } catch (e) {
      window.SVI_SRC = "BDG";
      const tag = document.getElementById("sviTestTag");
      if (tag) tag.textContent = "VERSION TEST — ANCIEN BDG (V3 : " + (e && e.message || e) + ")";
    }

    const data = await apiGetBDG();
    const rows = data.rows || [];

    if (rows.length < 2) {
      throw new Error("BDG VIDE");
    }

    const headers = rows[0];

    bdgRows = rows.slice(1).map(row => {
      const obj = {};

      headers.forEach((header, index) => {
        obj[String(header).trim()] =
          row[index] ?? "";
      });

      /* cellules brutes par position (colonne A = 0, B = 1 ...) */
      Object.defineProperty(
        obj,
        "__cols",
        { value: row, enumerable: false }
      );

      return obj;
    });

    bdgLoaded = true;
    renderBudgetList();

  } catch (error) {
    renderBDGError(
      error.message || String(error)
    );

  } finally {
    bdgLoading = false;
  }
}

function setBDGLoadingState() {
  const body =
    $("budgetListTable")
      ?.querySelector("tbody");

  if (body) {
    body.innerHTML = `
      <tr>
        <td colspan="7" class="empty">
          CHARGEMENT DES BUDGETS...
        </td>
      </tr>
    `;
  }
}

function renderBDGError(message) {
  const body =
    $("budgetListTable")
      ?.querySelector("tbody");

  if (body) {
    body.innerHTML = `
      <tr>
        <td colspan="7" class="empty">
          ERREUR BDG : ${esc(message)}
        </td>
      </tr>
    `;
  }
}

function firstValue(row, names) {
  for (const name of names) {
    const v = row[name];

    if (normalise(v) !== "") {
      return v;
    }
  }

  return "";
}

function budgetReference(row, index) {
  return (
    firstValue(
      row,
      [
        "BDG",
        "REFERENCE BDG",
        "RÉFÉRENCE BDG",
        "REFERENCE",
        "RÉFÉRENCE"
      ]
    ) ||
    (
      "BDG-" +
      String(index + 1)
        .padStart(4, "0")
    )
  );
}

