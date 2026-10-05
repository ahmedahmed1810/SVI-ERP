/* =========================================================
   SVI ERP — APP.JS
   VERSION 12
   ========================================================= */

const API_URL =
  "https://script.google.com/macros/s/AKfycbzFgUloyiRJe-QmR7nRqJ4bfWqvfA_6LSgotJRrRt87yeRfWtdY7nxXMR9avafSJUPg4Q/exec";

const API_KEY = "SVI-H88-2026-ERP";

let bdgRows = [];
let currentAnalysis = "designation";


/* =========================================================
   OUTILS
   ========================================================= */

const $ = id => document.getElementById(id);


/* ---------- TEXTE NORMALISÉ ---------- */

function normalise(value) {
  return String(value ?? "").trim();
}


/* ---------- CONVERSION NOMBRE ---------- */

function toNumber(value) {

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  let text = String(value ?? "")
    .trim()
    .replace(/\u00A0/g, "")
    .replace(/\s/g, "");

  if (!text) return 0;

  if (text.includes(",") && text.includes(".")) {

    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {

      text = text
        .replace(/\./g, "")
        .replace(",", ".");

    } else {

      text = text.replace(/,/g, "");

    }

  } else {

    text = text.replace(",", ".");

  }

  const number = Number(text);

  return Number.isFinite(number)
    ? number
    : 0;
}


/* ---------- FORMAT NOMBRE ---------- */

function formatNumber(value) {

  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const number = toNumber(value);

  return new Intl.NumberFormat(
    "fr-FR",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  ).format(number);
}


/* ---------- VALEURS UNIQUES ---------- */

function unique(values) {

  return [
    ...new Set(
      values
        .map(value => normalise(value))
        .filter(Boolean)
    )
  ];
}


/* ---------- PROTECTION HTML ---------- */

function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* ---------- SOMME ---------- */

function sum(rows, field) {

  return rows.reduce(
    (total, row) =>
      total + toNumber(row[field]),
    0
  );
}


/* =========================================================
   API GOOGLE SHEETS
   ========================================================= */

async function loadBDG() {

  console.log("DÉBUT CHARGEMENT BDG");

  try {

    if (
      !API_URL ||
      API_URL.includes("COLLER_ICI")
    ) {
      throw new Error(
        "URL API NON CONFIGURÉE"
      );
    }

    const separator =
      API_URL.includes("?")
        ? "&"
        : "?";

    const url =
      `${API_URL}${separator}key=${encodeURIComponent(API_KEY)}`;

    const response =
      await fetch(url);

    if (!response.ok) {

      throw new Error(
        `ERREUR HTTP ${response.status}`
      );

    }

    const data =
      await response.json();

    if (!data.ok) {

      throw new Error(
        data.error ||
        "ERREUR API"
      );

    }

    const rows =
      data.rows || [];

    if (!Array.isArray(rows)) {

      throw new Error(
        "FORMAT BDG INCORRECT"
      );

    }

    if (rows.length < 2) {

      throw new Error(
        "BDG VIDE"
      );

    }

    const headers =
      rows[0].map(header =>
        normalise(header)
      );

    bdgRows =
      rows
        .slice(1)
        .map(row => {

          const object = {};

          headers.forEach(
            (header, index) => {

              object[header] =
                row[index] ?? "";

            }
          );

          return object;

        });

    console.log(
      `${bdgRows.length} LIGNES BDG CHARGÉES`
    );

    initialiseSelectors();

  } catch (error) {

    console.error(
      "ERREUR CHARGEMENT BDG :",
      error
    );

    alert(
      "ERREUR CHARGEMENT BDG : " +
      error.message
    );

  }
}


/* =========================================================
   SÉLECTEURS
   ========================================================= */

function fillSelect(
  select,
  values,
  selectedValue = ""
) {

  if (!select) return;

  const oldValue =
    selectedValue ||
    select.value ||
    "";

  select.innerHTML = "";

  values.forEach(value => {

    const option =
      document.createElement("option");

    option.value = value;
    option.textContent = value;

    select.appendChild(option);

  });

  if (values.includes(oldValue)) {

    select.value =
      oldValue;

  }
}


/* =========================================================
   INITIALISATION SÉLECTEURS
   ========================================================= */

function initialiseSelectors() {

  const projects =
    unique(
      bdgRows.map(
        row => row["PRJ"]
      )
    );

  fillSelect(
    $("project"),
    projects
  );

  if (
    $("project") &&
    projects.includes("H88")
  ) {

    $("project").value =
      "H88";

  }

  updateLots();
}


/* =========================================================
   LOTS
   ========================================================= */

function updateLots() {

  const project =
    normalise(
      $("project")?.value
    );

  const lots =
    unique(

      bdgRows

        .filter(row =>
          normalise(
            row["PRJ"]
          ) === project
        )

        .map(row =>
          row["LOT"]
        )

    );

  fillSelect(
    $("lot"),
    lots
  );

  updatePrimaryActivities();
}


/* =========================================================
   ACTIVITÉS PRIMAIRES
   ========================================================= */

function updatePrimaryActivities() {

  const project =
    normalise(
      $("project")?.value
    );

  const lot =
    normalise(
      $("lot")?.value
    );

  const values =
    unique(

      bdgRows

        .filter(row =>

          normalise(
            row["PRJ"]
          ) === project &&

          normalise(
            row["LOT"]
          ) === lot

        )

        .map(row =>
          row["ACTIVITE PRIMAIRE"]
        )

    );

  fillSelect(
    $("primary"),
    values
  );

  updateSecondaryActivities();
}


/* =========================================================
   ACTIVITÉS SECONDAIRES
   ========================================================= */

function updateSecondaryActivities() {

  const project =
    normalise(
      $("project")?.value
    );

  const lot =
    normalise(
      $("lot")?.value
    );

  const primary =
    normalise(
      $("primary")?.value
    );

  const values =
    unique(

      bdgRows

        .filter(row =>

          normalise(
            row["PRJ"]
          ) === project &&

          normalise(
            row["LOT"]
          ) === lot &&

          normalise(
            row["ACTIVITE PRIMAIRE"]
          ) === primary

        )

        .map(row =>
          row["ACTIVITE"]
        )

    );

  fillSelect(
    $("secondary"),
    values
  );

  refreshBudget();
}


/* =========================================================
   FILTRE TÂCHE
   ========================================================= */

function selectedRows() {

  const project =
    normalise(
      $("project")?.value
    );

  const lot =
    normalise(
      $("lot")?.value
    );

  const primary =
    normalise(
      $("primary")?.value
    );

  const secondary =
    normalise(
      $("secondary")?.value
    );

  return bdgRows.filter(row =>

    normalise(
      row["PRJ"]
    ) === project &&

    normalise(
      row["LOT"]
    ) === lot &&

    normalise(
      row["ACTIVITE PRIMAIRE"]
    ) === primary &&

    normalise(
      row["ACTIVITE"]
    ) === secondary

  );
}


/* =========================================================
   RAFRAÎCHISSEMENT BUDGET
   ========================================================= */

function refreshBudget() {

  const rows =
    selectedRows();

  console.log(
    "LIGNES SÉLECTIONNÉES :",
    rows.length,
    rows
  );

  updateDesignation(rows);

  renderProductTable(rows);

  renderChargeTable(rows);

  renderAnalysis(rows);
}


/* =========================================================
   DÉSIGNATION BRD
   ========================================================= */

function updateDesignation(rows) {

  const field =
    $("brdDesignation");

  if (!field) return;

  const designations =
    unique(
      rows.map(
        row =>
          row["DESIGNATION"]
      )
    );

  field.value =
    designations.join(" / ");
}


/* =========================================================
   DÉTAIL PRODUIT
   ========================================================= */

function renderProductTable(rows) {

  const table =
    $("productTable");

  if (!table) {

    console.error(
      "TABLE productTable INTROUVABLE"
    );

    return;
  }

  const products =
    rows.filter(row =>

      normalise(
        row["CHG/PRD"]
      ).toUpperCase() ===
      "PRD"

    );

  const totalQuantity =
    sum(
      products,
      "QTB"
    );

  const totalAmount =
    sum(
      products,
      "MNB"
    );

  table.innerHTML = `

    <thead>

      <tr>

        <th data-field="N°">
          N° ▾
        </th>

        <th data-field="DETAIL BUDGET">
          DÉSIGNATION ▾
        </th>

        <th data-field="UTB">
          UPB ▾
        </th>

        <th data-field="NBR">
          NBR ▾
        </th>

        <th data-field="DIM1">
          DIM 1 ▾
        </th>

        <th data-field="DIM2">
          DIM 2 ▾
        </th>

        <th data-field="DIM3">
          DIM 3 ▾
        </th>

        <th data-field="QTB">
          QPB PRT ▾
        </th>

        <th data-field="PUB">
          PPB ▾
        </th>

        <th data-field="MNB">
          MPB ▾
        </th>

      </tr>

    </thead>

    <tbody>

      ${
        products.length

          ? products
              .map(row => `

                <tr>

                  <td>
                    ${escapeHtml(
                      row["N°"]
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      row["DETAIL BUDGET"]
                    )}
                  </td>

                  <td class="yellow">
                    ${escapeHtml(
                      row["UTB"]
                    )}
                  </td>

                  <td class="number">
                    ${escapeHtml(
                      row["NBR"]
                    )}
                  </td>

                  <td class="number">
                    ${escapeHtml(
                      row["DIM1"]
                    )}
                  </td>

                  <td class="number">
                    ${escapeHtml(
                      row["DIM2"]
                    )}
                  </td>

                  <td class="number">
                    ${escapeHtml(
                      row["DIM3"]
                    )}
                  </td>

                  <td class="number yellow">
                    ${formatNumber(
                      row["QTB"]
                    )}
                  </td>

                  <td class="number yellow">
                    ${formatNumber(
                      row["PUB"]
                    )}
                  </td>

                  <td class="number yellow">
                    ${formatNumber(
                      row["MNB"]
                    )}
                  </td>

                </tr>

              `)
              .join("")

          : `

              <tr>

                <td
                  colspan="10"
                  class="empty-row"
                >
                  AUCUN PRODUIT POUR CETTE TÂCHE
                </td>

              </tr>

            `
      }

    </tbody>

    <tfoot>

      <tr>

        <td colspan="7">
          <strong>
            TOTAL
          </strong>
        </td>

        <td class="number yellow">
          ${formatNumber(
            totalQuantity
          )}
        </td>

        <td></td>

        <td class="number yellow">
          ${formatNumber(
            totalAmount
          )}
        </td>

      </tr>

    </tfoot>

  `;

  attachRowMenus(table);

  initialiseColumnMenus(table);
}


/* =========================================================
   DÉTAIL CHARGES
   ========================================================= */

function renderChargeTable(rows) {

  const table =
    $("chargeTable");

  if (!table) {

    console.error(
      "TABLE chargeTable INTROUVABLE"
    );

    return;
  }

  const charges =
    rows.filter(row =>

      normalise(
        row["CHG/PRD"]
      ).toUpperCase() ===
      "CHG"

    );

  const totalAmount =
    sum(
      charges,
      "MNB"
    );

  table.innerHTML = `

    <thead>

      <tr>

        <th data-field="N°">
          N° ▾
        </th>

        <th data-field="DETAIL BUDGET">
          DÉSIGNATION ▾
        </th>

        <th data-field="UTB">
          UCB ▾
        </th>

        <th data-field="QTB">
          QCB ▾
        </th>

        <th data-field="PUB">
          PCS ▾
        </th>

        <th data-field="MNB">
          MCB ▾
        </th>

      </tr>

    </thead>

    <tbody>

      ${
        charges.length

          ? charges
              .map(row => `

                <tr>

                  <td>
                    ${escapeHtml(
                      row["N°"]
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      row["DETAIL BUDGET"]
                    )}
                  </td>

                  <td class="yellow">
                    ${escapeHtml(
                      row["UTB"]
                    )}
                  </td>

                  <td class="number yellow">
                    ${formatNumber(
                      row["QTB"]
                    )}
                  </td>

                  <td class="number yellow">
                    ${formatNumber(
                      row["PUB"]
                    )}
                  </td>

                  <td class="number yellow">
                    ${formatNumber(
                      row["MNB"]
                    )}
                  </td>

                </tr>

              `)
              .join("")

          : `

              <tr>

                <td
                  colspan="6"
                  class="empty-row"
                >
                  AUCUNE CHARGE POUR CETTE TÂCHE
                </td>

              </tr>

            `
      }

    </tbody>

    <tfoot>

      <tr>

        <td colspan="5">
          <strong>
            TOTAL
          </strong>
        </td>

        <td class="number yellow">
          ${formatNumber(
            totalAmount
          )}
        </td>

      </tr>

    </tfoot>

  `;

  attachRowMenus(table);

  initialiseColumnMenus(table);
}


/* =========================================================
   ANALYSE COMPACTE
   ========================================================= */

function renderAnalysis(rows) {
  const container = $("analysisCompact");
  if (!container) return;

  // ============================================================
  // OUTILS
  // ============================================================

  const isProduct = row =>
    normalise(row["CHG/PRD"]).toUpperCase() === "PRD";

  const isCharge = row =>
    normalise(row["CHG/PRD"]).toUpperCase() === "CHG";

  const amount = row => toNumber(row["MNB"]);
  const quantity = row => toNumber(row["QTB"]);

  const percentage = (value, base) => {
    if (!base) return null;
    return (value / base) * 100;
  };

  const formatPercent = value => {
    if (value === null || !Number.isFinite(value)) return "—";
    return `${formatNumber(value)} %`;
  };

  // ============================================================
  // 1. MARGE PAR DÉSIGNATION
  // ============================================================

  const designationMap = new Map();

  rows.forEach(row => {
    const designation = normalise(row["DESIGNATION"]);
    if (!designation) return;

    if (!designationMap.has(designation)) {
      designationMap.set(designation, {
        designation,
        MPB: 0,
        MCB: 0
      });
    }

    const item = designationMap.get(designation);

    if (isProduct(row)) {
      item.MPB += amount(row);
    }

    if (isCharge(row)) {
      item.MCB += amount(row);
    }
  });

  const designationRows = [...designationMap.values()]
    .map(item => {
      const MGB = item.MPB - item.MCB;
      const TGB = percentage(MGB, item.MPB);

      return {
        ...item,
        MGB,
        TGB
      };
    })
    .sort((a, b) =>
      a.designation.localeCompare(b.designation, "fr")
    );

  // ============================================================
  // 2. MARGE PAR TÂCHE PRIMAIRE
  //
  // BDG :
  // colonne D = PRJ / TACHE PRIMAIRE
  //
  // On utilise donc "PRJ / TACHE PRIMAIRE".
  // ============================================================

  const primaryTaskMap = new Map();

  rows.forEach(row => {
    const task =
      normalise(row["PRJ / TACHE PRIMAIRE"]) ||
      normalise(row["TACHE PRIMAIRE"]);

    if (!task) return;

    if (!primaryTaskMap.has(task)) {
      primaryTaskMap.set(task, {
        task,
        MPB: 0,
        MCB: 0
      });
    }

    const item = primaryTaskMap.get(task);

    if (isProduct(row)) {
      item.MPB += amount(row);
    }

    if (isCharge(row)) {
      item.MCB += amount(row);
    }
  });

  const primaryTaskRows = [...primaryTaskMap.values()]
    .map(item => {
      const MGB = item.MPB - item.MCB;
      const TGB = percentage(MGB, item.MPB);

      return {
        ...item,
        MGB,
        TGB
      };
    })
    .sort((a, b) =>
      a.task.localeCompare(b.task, "fr")
    );

  // ============================================================
  // 3. RENDEMENT SELON BUDGET
  //
  // Les charges sont regroupées par TÂCHE SECONDAIRE.
  //
  // Pour chaque charge :
  // RNB = QPB / QCB
  //
  // La quantité produit de la tâche est utilisée comme QPB.
  // ============================================================

  const secondaryTaskMap = new Map();

  rows.forEach(row => {
    const task =
      normalise(row["PRJ / TACHE"]) ||
      normalise(row["TACHE"]);

    if (!task) return;

    if (!secondaryTaskMap.has(task)) {
      secondaryTaskMap.set(task, {
        task,
        QPB: 0,
        charges: new Map()
      });
    }

    const taskItem = secondaryTaskMap.get(task);

    // Quantité produit budgétée
    if (isProduct(row)) {
      taskItem.QPB += quantity(row);
    }

    // Charges budgétées
    if (isCharge(row)) {
      const designation =
        normalise(row["DETAIL BUDGET"]) ||
        normalise(row["DESIGNATION"]) ||
        "SANS DÉSIGNATION";

      const UCB = normalise(row["UTB"]);

      // On sépare également par unité pour éviter
      // d'additionner des KG, M3, H, etc.
      const chargeKey = `${designation}|||${UCB}`;

      if (!taskItem.charges.has(chargeKey)) {
        taskItem.charges.set(chargeKey, {
          designation,
          UCB,
          QCB: 0
        });
      }

      taskItem.charges.get(chargeKey).QCB += quantity(row);
    }
  });

  const yieldRows = [];

  secondaryTaskMap.forEach(taskItem => {
    taskItem.charges.forEach(charge => {
      const RNB =
        charge.QCB !== 0
          ? taskItem.QPB / charge.QCB
          : null;

      yieldRows.push({
        task: taskItem.task,
        designation: charge.designation,
        UCB: charge.UCB,
        QPB: taskItem.QPB,
        QCB: charge.QCB,
        RNB
      });
    });
  });

  yieldRows.sort((a, b) => {
    const taskCompare =
      a.task.localeCompare(b.task, "fr");

    if (taskCompare !== 0) return taskCompare;

    return a.designation.localeCompare(
      b.designation,
      "fr"
    );
  });

  // ============================================================
  // TOTAUX MARGE PAR DÉSIGNATION
  // ============================================================

  const designationMPB = designationRows.reduce(
    (total, row) => total + row.MPB,
    0
  );

  const designationMCB = designationRows.reduce(
    (total, row) => total + row.MCB,
    0
  );

  const designationMGB =
    designationMPB - designationMCB;

  const designationTGB =
    percentage(designationMGB, designationMPB);

  // ============================================================
  // TOTAUX MARGE PAR TÂCHE PRIMAIRE
  // ============================================================

  const taskMPB = primaryTaskRows.reduce(
    (total, row) => total + row.MPB,
    0
  );

  const taskMCB = primaryTaskRows.reduce(
    (total, row) => total + row.MCB,
    0
  );

  const taskMGB = taskMPB - taskMCB;

  const taskTGB =
    percentage(taskMGB, taskMPB);

  // ============================================================
  // MÉMORISATION DES ANALYSES
  // ============================================================

  currentAnalysis = {
    designationRows,
    primaryTaskRows,
    yieldRows
  };

  // ============================================================
  // AFFICHAGE
  // ============================================================

  container.innerHTML = `

    <!-- ===================================================== -->
    <!-- MARGE PAR DÉSIGNATION -->
    <!-- ===================================================== -->

    <div class="analysis-table active" data-analysis="designation">

      <table>
        <thead>
          <tr>
            <th>DÉSIGNATION ▾</th>
            <th>MPB ▾</th>
            <th>MCB ▾</th>
            <th>MGB ▾</th>
            <th>TGB ▾</th>
          </tr>
        </thead>

        <tbody>
          ${
            designationRows.length
              ? designationRows.map(row => `
                <tr>
                  <td>${escapeHtml(row.designation)}</td>

                  <td class="number">
                    ${formatNumber(row.MPB)}
                  </td>

                  <td class="number">
                    ${formatNumber(row.MCB)}
                  </td>

                  <td class="number">
                    ${formatNumber(row.MGB)}
                  </td>

                  <td class="number">
                    ${formatPercent(row.TGB)}
                  </td>
                </tr>
              `).join("")
              : `
                <tr>
                  <td colspan="5" class="empty-row">
                    AUCUNE DONNÉE
                  </td>
                </tr>
              `
          }
        </tbody>

        <tfoot>
          <tr>
            <td><strong>TOTAL</strong></td>

            <td class="number">
              <strong>${formatNumber(designationMPB)}</strong>
            </td>

            <td class="number">
              <strong>${formatNumber(designationMCB)}</strong>
            </td>

            <td class="number">
              <strong>${formatNumber(designationMGB)}</strong>
            </td>

            <td class="number">
              <strong>${formatPercent(designationTGB)}</strong>
            </td>
          </tr>
        </tfoot>
      </table>

    </div>


    <!-- ===================================================== -->
    <!-- MARGE PAR TÂCHE PRIMAIRE -->
    <!-- ===================================================== -->

    <div class="analysis-table" data-analysis="primaryMargin">

      <table>
        <thead>
          <tr>
            <th>TÂCHE PRIMAIRE ▾</th>
            <th>MPB ▾</th>
            <th>MCB ▾</th>
            <th>MGB ▾</th>
            <th>TGB ▾</th>
          </tr>
        </thead>

        <tbody>
          ${
            primaryTaskRows.length
              ? primaryTaskRows.map(row => `
                <tr>
                  <td>${escapeHtml(row.task)}</td>

                  <td class="number">
                    ${formatNumber(row.MPB)}
                  </td>

                  <td class="number">
                    ${formatNumber(row.MCB)}
                  </td>

                  <td class="number">
                    ${formatNumber(row.MGB)}
                  </td>

                  <td class="number">
                    ${formatPercent(row.TGB)}
                  </td>
                </tr>
              `).join("")
              : `
                <tr>
                  <td colspan="5" class="empty-row">
                    AUCUNE DONNÉE
                  </td>
                </tr>
              `
          }
        </tbody>

        <tfoot>
          <tr>
            <td><strong>TOTAL</strong></td>

            <td class="number">
              <strong>${formatNumber(taskMPB)}</strong>
            </td>

            <td class="number">
              <strong>${formatNumber(taskMCB)}</strong>
            </td>

            <td class="number">
              <strong>${formatNumber(taskMGB)}</strong>
            </td>

            <td class="number">
              <strong>${formatPercent(taskTGB)}</strong>
            </td>
          </tr>
        </tfoot>
      </table>

    </div>


    <!-- ===================================================== -->
    <!-- RENDEMENT SELON BUDGET -->
    <!-- ===================================================== -->

    <div class="analysis-table" data-analysis="yield">

      <table>
        <thead>
          <tr>
            <th>TÂCHE SECONDAIRE ▾</th>
            <th>DÉSIGNATION CHARGE ▾</th>
            <th>UCB ▾</th>
            <th>QPB ▾</th>
            <th>QCB ▾</th>
            <th>RNB ▾</th>
          </tr>
        </thead>

        <tbody>
          ${
            yieldRows.length
              ? yieldRows.map(row => `
                <tr>

                  <td>
                    ${escapeHtml(row.task)}
                  </td>

                  <td>
                    ${escapeHtml(row.designation)}
                  </td>

                  <td class="yellow">
                    ${escapeHtml(row.UCB)}
                  </td>

                  <td class="number yellow">
                    ${formatNumber(row.QPB)}
                  </td>

                  <td class="number yellow">
                    ${formatNumber(row.QCB)}
                  </td>

                  <td class="number">
                    ${
                      row.RNB === null
                        ? "—"
                        : formatNumber(row.RNB)
                    }
                  </td>

                </tr>
              `).join("")
              : `
                <tr>
                  <td colspan="6" class="empty-row">
                    AUCUNE DONNÉE
                  </td>
                </tr>
              `
          }
        </tbody>

      </table>

    </div>
  `;

  // Réactive les onglets après reconstruction du HTML
  initialiseAnalysisTabs();
}

/* =========================================================
   ONGLETS ANALYSE
   ========================================================= */

function initialiseAnalysisTabs() {

  document
    .querySelectorAll(".tab")
    .forEach(tab => {

      tab.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(".tab")
            .forEach(item =>

              item.classList.remove(
                "active"
              )

            );

          tab.classList.add(
            "active"
          );

          currentAnalysis =
            tab.dataset.tab ||
            "designation";

          renderAnalysis(
            selectedRows()
          );

        }
      );

    });
}


/* =========================================================
   MENU COLONNES
   ========================================================= */

function initialiseColumnMenus(table) {

  table
    .querySelectorAll(
      "thead th"
    )
    .forEach(header => {

      header.style.cursor =
        "pointer";

      header.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          showColumnMenu(
            event,
            header
          );

        }
      );

    });
}


function showColumnMenu(
  event,
  header
) {

  const menu =
    $("columnMenu");

  if (!menu) return;

  const field =
    header.dataset.field ||
    header.textContent.trim();

  menu.innerHTML = `

    <div class="popup-title">
      ${escapeHtml(field)}
    </div>

    <button data-action="asc">
      TRIER CROISSANT
    </button>

    <button data-action="desc">
      TRIER DÉCROISSANT
    </button>

    <button data-action="search">
      RECHERCHER / FILTRER
    </button>

    <button data-action="clear">
      EFFACER LE FILTRE
    </button>

  `;

  const rect =
    header.getBoundingClientRect();

  const left =
    Math.min(
      rect.left,
      window.innerWidth - 240
    );

  const top =
    Math.min(
      rect.bottom + 5,
      window.innerHeight - 230
    );

  menu.style.left =
    `${Math.max(5, left)}px`;

  menu.style.top =
    `${Math.max(5, top)}px`;

  menu.classList.remove(
    "hidden"
  );
}


/* =========================================================
   MENU LONG PRESS LIGNE
   ========================================================= */

function attachRowMenus(table) {

  table
    .querySelectorAll(
      "tbody tr"
    )
    .forEach(row => {

      if (
        row.querySelector(
          ".empty-row"
        )
      ) {
        return;
      }

      let timer = null;

      const start =
        event => {

          clearTimeout(
            timer
          );

          timer =
            setTimeout(
              () => {

                showRowMenu(
                  event,
                  row
                );

              },
              550
            );

        };

      const cancel =
        () => {

          clearTimeout(
            timer
          );

          timer = null;

        };

      row.addEventListener(
        "touchstart",
        start,
        {
          passive: true
        }
      );

      row.addEventListener(
        "touchend",
        cancel
      );

      row.addEventListener(
        "touchmove",
        cancel
      );

      row.addEventListener(
        "touchcancel",
        cancel
      );

      row.addEventListener(
        "mousedown",
        start
      );

      row.addEventListener(
        "mouseup",
        cancel
      );

      row.addEventListener(
        "mouseleave",
        cancel
      );

    });
}


function showRowMenu(
  event,
  row
) {

  const menu =
    $("rowMenu");

  if (!menu) return;

  menu.innerHTML = `

    <button>
      INFORMATION
    </button>

    <button>
      MODIFIER
    </button>

    <button>
      DUPLIQUER
    </button>

    <button>
      INSÉRER UNE LIGNE
    </button>

    <button>
      COPIER
    </button>

    <button>
      SUPPRIMER
    </button>

  `;

  const touch =
    event.touches?.[0];

  const x =
    touch?.clientX ??
    event.clientX ??
    100;

  const y =
    touch?.clientY ??
    event.clientY ??
    100;

  menu.style.left =
    `${
      Math.max(
        5,
        Math.min(
          x,
          window.innerWidth - 230
        )
      )
    }px`;

  menu.style.top =
    `${
      Math.max(
        5,
        Math.min(
          y,
          window.innerHeight - 300
        )
      )
    }px`;

  menu.classList.remove(
    "hidden"
  );
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function initialiseNavigation() {

  document
    .querySelectorAll(
      ".nav"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(
              ".nav"
            )
            .forEach(item =>

              item.classList.remove(
                "active"
              )

            );

          button.classList.add(
            "active"
          );

          document
            .querySelectorAll(
              ".view"
            )
            .forEach(view =>

              view.classList.remove(
                "active-view"
              )

            );

          const view =
            $(
              button.dataset.view
            );

          if (view) {

            view.classList.add(
              "active-view"
            );

          }

          const title =
            $("pageTitle");

          if (title) {

            title.textContent =
              button
                .textContent
                .trim();

          }

        }
      );

    });
}


/* =========================================================
   MENU MOBILE
   ========================================================= */

function initialiseMobileMenu() {

  $("menuBtn")
    ?.addEventListener(
      "click",
      () => {

        document
          .querySelector(
            ".sidebar"
          )
          ?.classList.toggle(
            "open"
          );

      }
    );
}


/* =========================================================
   PLEIN ÉCRAN ANALYSE
   ========================================================= */

function initialiseFullscreen() {

  document
    .querySelector(
      ".expand-analysis"
    )
    ?.addEventListener(
      "click",
      () => {

        document
          .querySelector(
            ".analysis"
          )
          ?.classList.toggle(
            "fullscreen"
          );

      }
    );
}


/* =========================================================
   FERMETURE POPUPS
   ========================================================= */

function initialisePopupClosing() {

  document.addEventListener(
    "click",
    event => {

      const rowMenu =
        $("rowMenu");

      const columnMenu =
        $("columnMenu");

      if (
        rowMenu &&
        !rowMenu.contains(
          event.target
        )
      ) {

        rowMenu.classList.add(
          "hidden"
        );

      }

      if (
        columnMenu &&
        !columnMenu.contains(
          event.target
        )
      ) {

        columnMenu.classList.add(
          "hidden"
        );

      }

    }
  );
}


/* =========================================================
   ÉVÉNEMENTS SÉLECTEURS
   ========================================================= */

function initialiseSelectorEvents() {

  $("project")
    ?.addEventListener(
      "change",
      updateLots
    );

  $("lot")
    ?.addEventListener(
      "change",
      updatePrimaryActivities
    );

  $("primary")
    ?.addEventListener(
      "change",
      updateSecondaryActivities
    );

  $("secondary")
    ?.addEventListener(
      "change",
      refreshBudget
    );
}


/* =========================================================
   BOUTONS +
   ========================================================= */

function initialiseAddButtons() {

  document
    .querySelectorAll(
      ".panel-title .icon"
    )
    .forEach(button => {

      if (
        button
          .textContent
          .trim() === "+"
      ) {

        button.addEventListener(
          "click",
          () => {

            console.log(
              "AJOUT DE LIGNE DEMANDÉ"
            );

          }
        );

      }

    });
}


/* =========================================================
   DÉMARRAGE APPLICATION
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    console.log(
      "SVI ERP VERSION 12 — DÉMARRAGE"
    );

    initialiseNavigation();

    initialiseMobileMenu();

    initialiseAnalysisTabs();

    initialiseFullscreen();

    initialisePopupClosing();

    initialiseSelectorEvents();

    initialiseAddButtons();

    loadBDG();

  }
);
