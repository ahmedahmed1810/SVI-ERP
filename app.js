/* =========================================================

   SVI ERP — APP.JS

   VERSION 10

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

/* ---------- NOMBRE ---------- */

function toNumber(value) {

  if (typeof value === "number") {

    return Number.isFinite(value) ? value : 0;

  }

  let text = String(value ?? "")

    .trim()

    .replace(/\u00A0/g, "")

    .replace(/\s/g, "");

  if (!text) return 0;

  /*

    Gestion :

    1 234,56

    1234,56

    1234.56

  */

  if (text.includes(",") && text.includes(".")) {

    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {

      text = text.replace(/\./g, "").replace(",", ".");

    } else {

      text = text.replace(/,/g, "");

    }

  } else {

    text = text.replace(",", ".");

  }

  const n = Number(text);

  return Number.isFinite(n) ? n : 0;

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

  const n = toNumber(value);

  return new Intl.NumberFormat("fr-FR", {

    minimumFractionDigits: 2,

    maximumFractionDigits: 2

  }).format(n);

}

/* ---------- VALEURS UNIQUES ---------- */

function unique(values) {

  return [

    ...new Set(

      values

        .map(v => normalise(v))

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

    (total, row) => total + toNumber(row[field]),

    0

  );

}

/* =========================================================

   API GOOGLE SHEETS

   ========================================================= */

async function loadBDG() {

  console.log("DÉBUT CHARGEMENT BDG");

  try {

    if (!API_URL || API_URL.includes("COLLER_ICI")) {

      throw new Error("URL API NON CONFIGURÉE");

    }

    const separator =

      API_URL.includes("?") ? "&" : "?";

    const url =

      `${API_URL}${separator}key=${encodeURIComponent(API_KEY)}`;

    console.log("APPEL API BDG...");

    const response = await fetch(url);

    if (!response.ok) {

      throw new Error(

        `ERREUR HTTP ${response.status}`

      );

    }

    const data = await response.json();

    console.log("RÉPONSE API :", data);

    if (!data.ok) {

      throw new Error(

        data.error || "ERREUR API"

      );

    }

    const rows = data.rows || [];

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

    const headers = rows[0].map(header =>

      normalise(header)

    );

    console.log(

      "EN-TÊTES BDG :",

      headers

    );

    bdgRows = rows

      .slice(1)

      .map(row => {

        const obj = {};

        headers.forEach(

          (header, index) => {

            obj[header] =

              row[index] ?? "";

          }

        );

        return obj;

      });

    console.log(

      `${bdgRows.length} LIGNES BDG CHARGÉES`

    );

    console.log(

      "PREMIÈRE LIGNE BDG :",

      bdgRows[0]

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

    select.value = oldValue;

  }

}

/* ---------- INITIALISATION ---------- */

function initialiseSelectors() {

  console.log(

    "INITIALISATION SÉLECTEURS"

  );

  const projects = unique(

    bdgRows.map(

      row => row["PRJ"]

    )

  );

  console.log(

    "PROJETS :",

    projects

  );

  fillSelect(

    $("project"),

    projects

  );

  if (

    $("project") &&

    projects.includes("H88")

  ) {

    $("project").value = "H88";

  }

  updateLots();

}

/* ---------- LOTS ---------- */

function updateLots() {

  const project =

    normalise(

      $("project")?.value

    );

  console.log(

    "PROJET SÉLECTIONNÉ :",

    project

  );

  const lots = unique(

    bdgRows

      .filter(row =>

        normalise(row["PRJ"]) ===

        project

      )

      .map(row =>

        row["LOT"]

      )

  );

  console.log(

    "LOTS :",

    lots

  );

  fillSelect(

    $("lot"),

    lots

  );

  updatePrimaryActivities();

}

/* ---------- ACTIVITÉS PRIMAIRES ---------- */

function updatePrimaryActivities() {

  const project =

    normalise(

      $("project")?.value

    );

  const lot =

    normalise(

      $("lot")?.value

    );

  const values = unique(

    bdgRows

      .filter(row =>

        normalise(row["PRJ"]) ===

          project &&

        normalise(row["LOT"]) ===

          lot

      )

      .map(row =>

        row["ACTIVITE PRIMAIRE"]

      )

  );

  console.log(

    "ACTIVITÉS PRIMAIRES :",

    values

  );

  fillSelect(

    $("primary"),

    values

  );

  updateSecondaryActivities();

}

/* ---------- ACTIVITÉS SECONDAIRES ---------- */

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

  const values = unique(

    bdgRows

      .filter(row =>

        normalise(row["PRJ"]) ===

          project &&

        normalise(row["LOT"]) ===

          lot &&

        normalise(

          row["ACTIVITE PRIMAIRE"]

        ) === primary

      )

      .map(row =>

        row["ACTIVITE"]

      )

  );

  console.log(

    "ACTIVITÉS SECONDAIRES :",

    values

  );

  fillSelect(

    $("secondary"),

    values

  );

  refreshBudget();

}

/* =========================================================

   FILTRE DE LA TÂCHE

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

  console.log(

    "FILTRE ACTUEL :",

    {

      project,

      lot,

      primary,

      secondary

    }

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

  /*

    MESSAGE TEMPORAIRE DE DIAGNOSTIC.

    ON LE SUPPRIMERA UNE FOIS LE TEST TERMINÉ.

  */

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

   TABLE DÉTAIL PRODUIT

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

  console.log(

    "PRODUITS TROUVÉS :",

    products.length,

    products

  );

  const totalQuantity =

    sum(products, "QTB");

  const totalAmount =

    sum(products, "MNB");

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

        ? products.map(row => `

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

        `).join("")

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

          <strong>TOTAL</strong>

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

   TABLE DÉTAIL CHARGES

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

  console.log(

    "CHARGES TROUVÉES :",

    charges.length,

    charges

  );

  const totalAmount =

    sum(charges, "MNB");

  table.innerHTML = `

    <thead>

      <tr>

        <th data-field="N°">

          N° ▾

        </th>

        <th data-field="DESIGNATION">

          ARTICLE ▾

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

        ? charges.map(row => `

          <tr>

            <td>

              ${escapeHtml(

                row["N°"]

              )}

            </td>

            <td>

              ${escapeHtml(

                row["DESIGNATION"]

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

        `).join("")

        : `

          <tr>

            <td

              colspan="7"

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

        <td colspan="6">

          <strong>TOTAL</strong>

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

  const box =

    $("analysisCompact");

  if (!box) return;

  const products =

    rows.filter(row =>

      normalise(

        row["CHG/PRD"]

      ).toUpperCase() ===

      "PRD"

    );

  const charges =

    rows.filter(row =>

      normalise(

        row["CHG/PRD"]

      ).toUpperCase() ===

      "CHG"

    );

  const productAmount =

    sum(products, "MNB");

  const chargeAmount =

    sum(charges, "MNB");

  const margin =

    productAmount -

    chargeAmount;

  const rate =

    productAmount !== 0

      ? (

          margin /

          productAmount

        ) * 100

      : 0;

  /* ---------- RENDEMENT ---------- */

  if (

    currentAnalysis ===

    "yield"

  ) {

    box.innerHTML = `

      <table>

        <thead>

          <tr>

            <th>

              ACTIVITÉ

            </th>

            <th>

              PRODUIT

            </th>

            <th>

              CHARGE

            </th>

            <th>

              RENDEMENT

            </th>

          </tr>

        </thead>

        <tfoot>

          <tr>

            <td colspan="4">

              RENDEMENT SELON BUDGET

            </td>

          </tr>

        </tfoot>

      </table>

    `;

    return;

  }

  /* ---------- MARGES ---------- */

  box.innerHTML = `

    <table>

      <thead>

        <tr>

          <th>

            ${

              currentAnalysis ===

              "primaryMargin"

                ? "ACTIVITÉ PRIMAIRE"

                : "DÉSIGNATION"

            }

          </th>

          <th>

            PRODUITS

          </th>

          <th>

            CHARGES

          </th>

          <th>

            MARGE

          </th>

          <th>

            TAUX

          </th>

        </tr>

      </thead>

      <tfoot>

        <tr>

          <td>

            TOTAL

          </td>

          <td class="number">

            ${formatNumber(

              productAmount

            )}

          </td>

          <td class="number">

            ${formatNumber(

              chargeAmount

            )}

          </td>

          <td class="number">

            ${formatNumber(

              margin

            )}

          </td>

          <td class="number">

            ${formatNumber(

              rate

            )} %

          </td>

        </tr>

      </tfoot>

    </table>

  `;

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

    .querySelectorAll("thead th")

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

      const start = event => {

        clearTimeout(timer);

        timer = setTimeout(

          () => {

            showRowMenu(

              event,

              row

            );

          },

          550

        );

      };

      const cancel = () => {

        clearTimeout(timer);

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

    .querySelectorAll(".nav")

    .forEach(button => {

      button.addEventListener(

        "click",

        () => {

          document

            .querySelectorAll(".nav")

            .forEach(item =>

              item.classList.remove(

                "active"

              )

            );

          button.classList.add(

            "active"

          );

          document

            .querySelectorAll(".view")

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

              button.textContent.trim();

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

        button.textContent

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

      "SVI ERP VERSION 10 — DÉMARRAGE"

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
