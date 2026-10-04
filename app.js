alert("APP.JS VERSION 9 CHARGÉE");
/* =========================================================
   SVI ERP — APP.JS
   ========================================================= */

const API_URL = "https://script.google.com/macros/s/AKfycbzFgUloyiRJe-QmR7nRqJ4bfWqvfA_6LSgotJRrRt87yeRfWtdY7nxXMR9avafSJUPg4Q/exec";
const API_KEY = "SVI-H88-2026-ERP";

let bdgRows = [];
let currentAnalysis = "designation";

/* ---------- OUTILS ---------- */

const $ = (id) => document.getElementById(id);

function formatNumber(value) {
  const n = Number(
    String(value ?? "")
      .replace(/\s/g, "")
      .replace(",", ".")
  );

  if (!Number.isFinite(n)) return value ?? "";

  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

function unique(values) {
  return [...new Set(
    values
      .map(v => String(v ?? "").trim())
      .loadbdg(Boolean)
  )];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ---------- API GOOGLE SHEETS ---------- */

async function loadBDG() {
  try {
    if (API_URL.includes("COLLER_ICI")) {
      console.warn("URL API NON CONFIGURÉE");
      return;
    }

    const separator = API_URL.includes("?") ? "&" : "?";

    const response = await fetch(
      `${API_URL}${separator}key=${encodeURIComponent(API_KEY)}`
    );

    if (!response.ok) {
      throw new Error(`ERREUR HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || "ERREUR API");
    }

    const rows = data.rows || [];

    if (rows.length < 2) {
      throw new Error("BDG VIDE");
    }

    const headers = rows[0];

    bdgRows = rows.slice(1).map(row => {
      const obj = {};

      headers.forEach((header, index) => {
        obj[String(header).trim()] = row[index] ?? "";
      });

      return obj;
    });

    console.log(`${bdgRows.length} LIGNES BDG CHARGÉES`);

    initialiseSelectors();

  } catch (error) {
    console.error("ERREUR CHARGEMENT BDG :", error);
  }
}

/* ---------- SÉLECTEURS ---------- */

function fillSelect(select, values, selectedValue = "") {
  if (!select) return;

  select.innerHTML = "";

  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;

    if (value === selectedValue) {
      option.selected = true;
    }

    select.appendChild(option);
  });
}

function initialiseSelectors() {
  const projects = unique(bdgRows.map(r => r["PRJ"]));

  fillSelect($("project"), projects);

  if (projects.includes("H88")) {
    $("project").value = "H88";
  }

  updateLots();
}

function updateLots() {
  const project = $("project")?.value || "";

  const lots = unique(
    bdgRows
      .filter(r => r["PRJ"] === project)
      .map(r => r["LOT"])
  );

  fillSelect($("lot"), lots);
  updatePrimaryActivities();
}

function updatePrimaryActivities() {
  const project = $("project")?.value || "";
  const lot = $("lot")?.value || "";

  const values = unique(
    bdgRows
      .filter(r =>
        r["PRJ"] === project &&
        r["LOT"] === lot
      )
      .map(r => r["ACTIVITE PRIMAIRE"])
  );

  fillSelect($("primary"), values);
  refreshbudget();
}

function refreshbudget() {
  const project = $("project")?.value || "";
  const lot = $("lot")?.value || "";
  const primary = $("primary")?.value || "";

  const values = unique(
    bdgRows
      .filter(r =>
        r["PRJ"] === project &&
        r["LOT"] === lot &&
        r["ACTIVITE PRIMAIRE"] === primary
      )
      .map(r => r["ACTIVITE"])
  );

  fillSelect($("secondary"), values);
  refreshBudget();
}

/* ---------- FILTRE TÂCHE ---------- */

function selectedRows() {
  const project = $("project")?.value || "";
  const lot = $("lot")?.value || "";
  const primary = $("primary")?.value || "";
  const secondary = $("secondary")?.value || "";

  return bdgRows.filter(r =>
  String(r["PRJ"] ?? "").trim() === String(project).trim() &&
  String(r["LOT"] ?? "").trim() === String(lot).trim() &&
  String(r["ACTIVITE PRIMAIRE"] ?? "").trim() === String(primary).trim() &&
  String(r["ACTIVITE"] ?? "").trim() === String(secondary).trim()
);
}

/* ---------- RAFRAÎCHISSEMENT ---------- */

function refreshBudget() {
  const rows = selectedRows();
  console.log("LIGNES SELECTIONNEES :", rows.length, rows);
 function refreshBudget() {
  const rows = selectedRows();
  console.log("LIGNES SELECTIONNEES :", rows.length, rows);
  alert("LIGNES SELECTIONNEES : " + rows.length);

  updateDesignation(rows);
  renderProductTable(rows);
  renderChargeTable(rows);
  renderAnalysis(rows);
}
   updateDesignation(rows);
  renderProductTable(rows);
  renderChargeTable(rows);
  renderAnalysis(rows);
}

function updateDesignation(rows) {
  const field = $("brdDesignation");

  if (!field) return;

  const designations = unique(rows.map(r => r["DESIGNATION"]));

  field.value = designations.join(" / ");
}

/* ---------- TABLE PRODUITS ---------- */

function renderProductTable(rows) {
  const table = $("productTable");

  if (!table) return;

  const products = rows.filter(r =>
    String(r["CHG/PRD"]).trim().toUpperCase() === "PRD"
  );

  table.innerHTML = `
    <thead>
      <tr>
        <th>N° ▾</th>
        <th>DÉSIGNATION ▾</th>
        <th>UPB ▾</th>
        <th>NBR ▾</th>
        <th>DIM 1 ▾</th>
        <th>DIM 2 ▾</th>
        <th>DIM 3 ▾</th>
        <th>QPB PRT ▾</th>
        <th>PPB ▾</th>
        <th>MPB ▾</th>
      </tr>
    </thead>

    <tbody>
      ${products.map(r => `
        <tr>
          <td>${escapeHtml(r["N°"])}</td>
          <td>${escapeHtml(r["DETAIL BUDGET"])}</td>
          <td class="yellow">${escapeHtml(r["UTB"])}</td>
          <td class="number">${escapeHtml(r["NBR"])}</td>
          <td class="number">${escapeHtml(r["DIM1"])}</td>
          <td class="number">${escapeHtml(r["DIM2"])}</td>
          <td class="number">${escapeHtml(r["DIM3"])}</td>
          <td class="number yellow">${formatNumber(r["QTB"])}</td>
          <td class="number yellow">${formatNumber(r["PUB"])}</td>
          <td class="number yellow">${formatNumber(r["MNB"])}</td>
        </tr>
      `).join("")}
    </tbody>

    <tfoot>
      <tr>
        <td colspan="7"><strong>TOTAL</strong></td>
        <td class="number yellow">
          ${formatNumber(sum(products, "QTB"))}
        </td>
        <td></td>
        <td class="number yellow">
          ${formatNumber(sum(products, "MNB"))}
        </td>
      </tr>
    </tfoot>
  `;

  attachRowMenus(table);
}

/* ---------- TABLE CHARGES ---------- */

function renderChargeTable(rows) {
  const table = $("chargeTable");

  if (!table) return;

  const charges = rows.filter(r =>
    String(r["CHG/PRD"]).trim().toUpperCase() === "CHG"
  );

  table.innerHTML = `
    <thead>
      <tr>
        <th>N° ▾</th>
        <th>ARTICLE ▾</th>
        <th>DÉSIGNATION ▾</th>
        <th>UCB ▾</th>
        <th>QCB ▾</th>
        <th>PCS ▾</th>
        <th>MCB ▾</th>
      </tr>
    </thead>

    <tbody>
      ${charges.map(r => `
        <tr>
          <td>${escapeHtml(r["N°"])}</td>
          <td>${escapeHtml(r["DESIGNATION"])}</td>
          <td>${escapeHtml(r["DETAIL BUDGET"])}</td>
          <td>${escapeHtml(r["UTB"])}</td>
          <td class="number">${formatNumber(r["QTB"])}</td>
          <td class="number yellow">${formatNumber(r["PUB"])}</td>
          <td class="number yellow">${formatNumber(r["MNB"])}</td>
        </tr>
      `).join("")}
    </tbody>

    <tfoot>
      <tr>
        <td colspan="6"><strong>TOTAL</strong></td>
        <td class="number yellow">
          ${formatNumber(sum(charges, "MNB"))}
        </td>
      </tr>
    </tfoot>
  `;

  attachRowMenus(table);
}

function sum(rows, field) {
  return rows.reduce((total, row) => {
    const value = Number(
      String(row[field] ?? "")
        .replace(/\s/g, "")
        .replace(",", ".")
    );

    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
}

/* ---------- ANALYSE COMPACTE ---------- */

function renderAnalysis(rows) {
  const box = $("analysisCompact");

  if (!box) return;

  const products = rows.filter(r =>
    String(r["CHG/PRD"]).toUpperCase() === "PRD"
  );

  const charges = rows.filter(r =>
    String(r["CHG/PRD"]).toUpperCase() === "CHG"
  );

  const productAmount = sum(products, "MNB");
  const chargeAmount = sum(charges, "MNB");
  const margin = productAmount - chargeAmount;

  const rate = productAmount
    ? (margin / productAmount) * 100
    : 0;

  if (currentAnalysis === "yield") {
    box.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>ACTIVITÉ</th>
            <th>PRODUIT</th>
            <th>CHARGE</th>
            <th>RENDEMENT</th>
          </tr>
        </thead>
        <tfoot>
          <tr>
            <td colspan="4">RENDEMENT SELON BUDGET</td>
          </tr>
        </tfoot>
      </table>
    `;

    return;
  }

  box.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>${currentAnalysis === "primaryMargin"
            ? "ACTIVITÉ PRIMAIRE"
            : "DÉSIGNATION"}</th>
          <th>PRODUITS</th>
          <th>CHARGES</th>
          <th>MARGE</th>
          <th>TAUX</th>
        </tr>
      </thead>

      <tfoot>
        <tr>
          <td>TOTAL</td>
          <td class="number">${formatNumber(productAmount)}</td>
          <td class="number">${formatNumber(chargeAmount)}</td>
          <td class="number">${formatNumber(margin)}</td>
          <td class="number">${formatNumber(rate)} %</td>
        </tr>
      </tfoot>
    </table>
  `;
}

/* ---------- ONGLETS ANALYSE ---------- */

function initialiseAnalysisTabs() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab")
        .forEach(t => t.classList.remove("active"));

      tab.classList.add("active");

      currentAnalysis = tab.dataset.tab || "designation";

      renderAnalysis(selectedRows());
    });
  });
}

/* ---------- MENU LONG PRESS LIGNE ---------- */

function attachRowMenus(table) {
  table.querySelectorAll("tbody tr").forEach(row => {
    let timer;

    const start = event => {
      timer = setTimeout(() => {
        showRowMenu(event, row);
      }, 550);
    };

    const cancel = () => {
      clearTimeout(timer);
    };

    row.addEventListener("touchstart", start, { passive: true });
    row.addEventListener("touchend", cancel);
    row.addEventListener("touchmove", cancel);

    row.addEventListener("mousedown", start);
    row.addEventListener("mouseup", cancel);
    row.addEventListener("mouseleave", cancel);
  });
}

function showRowMenu(event, row) {
  const menu = $("rowMenu");

  if (!menu) return;

  menu.innerHTML = `
    <button>INFORMATION</button>
    <button>MODIFIER</button>
    <button>DUPLIQUER</button>
    <button>INSÉRER UNE LIGNE</button>
    <button>COPIER</button>
    <button>SUPPRIMER</button>
  `;

  const touch = event.touches?.[0];

  const x = touch?.clientX ?? event.clientX ?? 100;
  const y = touch?.clientY ?? event.clientY ?? 100;

  menu.style.left =
    `${Math.min(x, window.innerWidth - 230)}px`;

  menu.style.top =
    `${Math.min(y, window.innerHeight - 280)}px`;

  menu.classList.remove("hidden");
}

/* ---------- NAVIGATION ---------- */

function initialiseNavigation() {
  document.querySelectorAll(".nav").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav")
        .forEach(b => b.classList.remove("active"));

      button.classList.add("active");

      document.querySelectorAll(".view")
        .forEach(view => view.classList.remove("active-view"));

      const view = $(button.dataset.view);

      if (view) {
        view.classList.add("active-view");
      }

      const title = $("pageTitle");

      if (title) {
        title.textContent = button.textContent.trim();
      }
    });
  });
}

/* ---------- MENU MOBILE ---------- */

function initialiseMobileMenu() {
  $("menuBtn")?.addEventListener("click", () => {
    document.querySelector(".sidebar")
      ?.classList.toggle("open");
  });
}

/* ---------- PLEIN ÉCRAN ANALYSE ---------- */

function initialiseFullscreen() {
  document.querySelector(".expand-analysis")
    ?.addEventListener("click", () => {
      document.querySelector(".analysis")
        ?.classList.toggle("fullscreen");
    });
}

/* ---------- FERMETURE POPUPS ---------- */

function initialisePopupClosing() {
  document.addEventListener("click", event => {
    const rowMenu = $("rowMenu");
    const columnMenu = $("columnMenu");

    if (
      rowMenu &&
      !rowMenu.contains(event.target)
    ) {
      rowMenu.classList.add("hidden");
    }

    if (
      columnMenu &&
      !columnMenu.contains(event.target)
    ) {
      columnMenu.classList.add("hidden");
    }
  });
}

/* ---------- ÉVÉNEMENTS SÉLECTEURS ---------- */

function initialiseSelectorEvents() {
  $("project")?.addEventListener("change", updateLots);

  $("lot")?.addEventListener(
    "change",
    updatePrimaryActivities
  );

  $("primary")?.addEventListener(
    "change",
    updateSecondaryActivities
  );

  $("secondary")?.addEventListener(
    "change",
    refreshBudget
  );
}

/* ---------- DÉMARRAGE ---------- */

document.addEventListener("DOMContentLoaded", () => {
  initialiseNavigation();
  initialiseMobileMenu();
  initialiseAnalysisTabs();
  initialiseFullscreen();
  initialisePopupClosing();
  initialiseSelectorEvents();

  loadBDG();
});
