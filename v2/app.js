const API_URL = "https://script.google.com/macros/s/AKfycbzFgUloyiRJe-QmR7nRqJ4bfWqvfA_6LSgotJRrRt87yeRfWtdY7nxXMR9avafSJUPg4Q/exec";
const API_KEY = "SVI-H88-2026-ERP";

const $ = id => document.getElementById(id);

/* =========================================================
   DONNEES CHS / BDS
   ========================================================= */

let db = {
  chs: [],
  projects: [],
  lots: [],
  primaries: [],
  secondaries: [],
  brd: []
};

let selection = {
  project: null,
  lot: null,
  primary: null,
  secondary: null
};

let rowContext = null;
let longPressTimer = null;

let brdCache = new Map();
let brdRequestId = 0;

/* =========================================================
   DONNEES BDG
   ========================================================= */

let bdgRows = [];
let bdgLoaded = false;
let bdgLoading = false;
let currentAnalysis = "designation";

/* =========================================================
   OUTILS
   ========================================================= */

function normalise(v) {
  return String(v ?? "").trim();
}

function num(v) {
  const n = Number(
    String(v ?? 0)
      .replace(/\s/g, "")
      .replace(",", ".")
  );

  return Number.isFinite(n) ? n : 0;
}

function money(v) {
  return num(v).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function esc(v) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m])
  );
}

function unique(values) {
  return [
    ...new Set(
      values
        .map(v => String(v ?? "").trim())
        .filter(Boolean)
    )
  ];
}

function sum(rows, field) {
  return rows.reduce(
    (total, row) =>
      total + num(row[field]),
    0
  );
}

/* =========================================================
   API GET CHS / BDS
   ========================================================= */

async function apiGet(action = "bootstrap", params = {}) {
  const query = {
    key: API_KEY,
    action,
    ...params,
    _: Date.now()
  };

  const url =
    API_URL +
    "?" +
    Object.entries(query)
      .map(
        ([k, v]) =>
          encodeURIComponent(k) +
          "=" +
          encodeURIComponent(v)
      )
      .join("&");

  const r = await fetch(url, {
    method: "GET",
    cache: "no-store"
  });

  const data = await r.json();

  if (!data.ok) {
    throw new Error(
      data.error || "ERREUR API"
    );
  }

  return data;
}

/* =========================================================
   API GET BDG
   L'API HISTORIQUE UTILISE L'ABSENCE D'ACTION
   ========================================================= */

async function apiGetBDG() {
  const attempts = [
    { action: "getBDG" },
    { action: "bdg" },
    { action: "bootstrapBDG" },
    {}
  ];

  let lastError = null;

  for (const params of attempts) {
    try {
      const query = {
        key: API_KEY,
        ...params,
        _: Date.now()
      };

      const url =
        API_URL +
        "?" +
        Object.entries(query)
          .map(([k, v]) =>
            encodeURIComponent(k) +
            "=" +
            encodeURIComponent(v)
          )
          .join("&");

      const r = await fetch(url, {
        method: "GET",
        cache: "no-store",
        redirect: "follow"
      });

      if (!r.ok) {
        lastError = new Error(
          "ERREUR HTTP " + r.status
        );
        continue;
      }

      const text = await r.text();

      let data;

      try {
        data = JSON.parse(text);
      } catch (e) {
        lastError = new Error(
          "RÉPONSE BDG NON JSON"
        );
        continue;
      }

      if (data && data.ok === false) {
        lastError = new Error(
          data.error || "ERREUR API BDG"
        );
        continue;
      }

      if (
        data &&
        Array.isArray(data.rows)
      ) {
        return data;
      }

      if (
        data &&
        data.data &&
        Array.isArray(data.data.rows)
      ) {
        return {
          ok: true,
          rows: data.data.rows
        };
      }

      lastError = new Error(
        "FORMAT BDG NON RECONNU"
      );

    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ||
    new Error("IMPOSSIBLE DE CHARGER BDG");
}
/* =========================================================
   API POST
   ========================================================= */

async function apiPost(action, data = {}) {
  const r = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      key: API_KEY,
      action,
      ...data
    })
  });

  const out = await r.json();

  if (!out.ok) {
    throw new Error(
      out.error || "ERREUR API"
    );
  }

  return out;
}

/* =========================================================
   BOOTSTRAP CHS / BDS
   ========================================================= */

function mapBootstrap(data) {
  db.chs = (data.chs || []).map(x => ({
    id: x.ID,
    article: x.ARTICLE,
    designation: x.DESIGNATION,
    unit: x.UNITE,
    pcs: num(x.PCS)
  }));

  const all = data.bds || [];

  db.projects = all
    .filter(
      x =>
        String(x.TYPE || "")
          .trim()
          .toUpperCase() === "PROJECT"
    )
    .map(x => ({
      id: x.ID,
      code: x.CODE,
      name: x.NOM,
      order: num(x.ORDRE)
    }));

  db.lots = all
    .filter(
      x =>
        String(x.TYPE || "")
          .trim()
          .toUpperCase() === "LOT"
    )
    .map(x => ({
      id: x.ID,
      projectId: x.PARENT_ID,
      code: x.CODE,
      name: x.NOM,
      order: num(x.ORDRE)
    }));

  db.primaries = all
    .filter(
      x =>
        String(x.TYPE || "")
          .trim()
          .toUpperCase() === "PRIMARY"
    )
    .map(x => ({
      id: x.ID,
      lotId: x.PARENT_ID,
      code: x.CODE,
      name: x.NOM,
      order: num(x.ORDRE)
    }));

  db.secondaries = all
    .filter(
      x =>
        String(x.TYPE || "")
          .trim()
          .toUpperCase() === "SECONDARY"
    )
    .map(x => ({
      id: x.ID,
      primaryId: x.PARENT_ID,
      code: x.CODE,
      name: x.NOM,
      order: num(x.ORDRE)
    }));

  db.brd = [];
  brdCache.clear();
}

async function reloadAll() {
  try {
    const data =
      await apiGet("bootstrap");

    mapBootstrap(data);

    renderChs();
    renderHierarchy();

  } catch (e) {
    alert(
      "CONNEXION GOOGLE SHEETS IMPOSSIBLE : " +
      e.message
    );
  }
}

/* =========================================================
   BRD A LA DEMANDE
   ========================================================= */

async function loadBrdForSecondary(secondaryId) {
  if (!secondaryId) {
    db.brd = [];
    renderBrd();
    return;
  }

  if (brdCache.has(secondaryId)) {
    db.brd =
      brdCache.get(secondaryId);

    renderBrd();
    return;
  }

  const requestId =
    ++brdRequestId;

  db.brd = [];

  $("brdCount").textContent =
    "CHARGEMENT...";

  $("brdTable")
    .querySelector("tbody")
    .innerHTML = `
      <tr>
        <td colspan="6" class="empty">
          CHARGEMENT DU BORDEREAU...
        </td>
      </tr>
    `;

  $("brdTotal").textContent =
    "0,00";

  const data =
    await apiGet(
      "brd",
      { secondaryId }
    );

  if (
    requestId !== brdRequestId ||
    selection.secondary !== secondaryId
  ) {
    return;
  }

  const rows =
    (data.brd || []).map(x => ({
      id: x.ID,
      secondaryId:
        x.TACHE_SECONDAIRE_ID,
      article:
        x.ARTICLE,
      designation:
        x.DESIGNATION,
      unit:
        x.UNITE,
      qty:
        num(x.QUANTITE),
      price:
        num(x.PRIX)
    }));

  brdCache.set(
    secondaryId,
    rows
  );

  db.brd = rows;

  renderBrd();
}

/* =========================================================
   MISES A JOUR LOCALES
   ========================================================= */

function upsertLocalCHS(x) {
  const item = {
    id: x.ID,
    article: x.ARTICLE,
    designation: x.DESIGNATION,
    unit: x.UNITE,
    pcs: num(x.PCS)
  };

  const i =
    db.chs.findIndex(
      r => r.id === item.id
    );

  if (i >= 0) {
    db.chs[i] = item;
  } else {
    db.chs.push(item);
  }
}

function upsertLocalBDS(x) {
  const type =
    String(x.TYPE || "")
      .trim()
      .toUpperCase();

  let arrName = "";
  let item = null;

  if (type === "PROJECT") {
    arrName = "projects";

    item = {
      id: x.ID,
      code: x.CODE,
      name: x.NOM,
      order: num(x.ORDRE)
    };

  } else if (type === "LOT") {
    arrName = "lots";

    item = {
      id: x.ID,
      projectId: x.PARENT_ID,
      code: x.CODE,
      name: x.NOM,
      order: num(x.ORDRE)
    };

  } else if (type === "PRIMARY") {
    arrName = "primaries";

    item = {
      id: x.ID,
      lotId: x.PARENT_ID,
      code: x.CODE,
      name: x.NOM,
      order: num(x.ORDRE)
    };

  } else if (type === "SECONDARY") {
    arrName = "secondaries";

    item = {
      id: x.ID,
      primaryId: x.PARENT_ID,
      code: x.CODE,
      name: x.NOM,
      order: num(x.ORDRE)
    };
  }

  if (!arrName || !item) {
    return;
  }

  const arr = db[arrName];

  const i =
    arr.findIndex(
      r => r.id === item.id
    );

  if (i >= 0) {
    arr[i] = item;
  } else {
    arr.push(item);
  }
}

function upsertLocalBRD(x) {
  const item = {
    id: x.ID,
    secondaryId:
      x.TACHE_SECONDAIRE_ID,
    article:
      x.ARTICLE,
    designation:
      x.DESIGNATION,
    unit:
      x.UNITE,
    qty:
      num(x.QUANTITE),
    price:
      num(x.PRIX)
  };

  const i =
    db.brd.findIndex(
      r => r.id === item.id
    );

  if (i >= 0) {
    db.brd[i] = item;
  } else {
    db.brd.push(item);
  }

  if (item.secondaryId) {
    brdCache.set(
      item.secondaryId,
      [...db.brd]
    );
  }
}

/* =========================================================
   SUPPRESSION LOCALE BDS
   ========================================================= */

function removeLocalBDS(type, id) {
  if (type === "project") {
    const lotIds =
      db.lots
        .filter(
          x => x.projectId === id
        )
        .map(x => x.id);

    const primaryIds =
      db.primaries
        .filter(
          x =>
            lotIds.includes(
              x.lotId
            )
        )
        .map(x => x.id);

    const secondaryIds =
      db.secondaries
        .filter(
          x =>
            primaryIds.includes(
              x.primaryId
            )
        )
        .map(x => x.id);

    secondaryIds.forEach(
      sid =>
        brdCache.delete(sid)
    );

    db.brd =
      db.brd.filter(
        x =>
          !secondaryIds.includes(
            x.secondaryId
          )
      );

    db.secondaries =
      db.secondaries.filter(
        x =>
          !secondaryIds.includes(
            x.id
          )
      );

    db.primaries =
      db.primaries.filter(
        x =>
          !primaryIds.includes(
            x.id
          )
      );

    db.lots =
      db.lots.filter(
        x =>
          !lotIds.includes(
            x.id
          )
      );

    db.projects =
      db.projects.filter(
        x => x.id !== id
      );

    selection = {
      project: null,
      lot: null,
      primary: null,
      secondary: null
    };

    return;
  }

  if (type === "lot") {
    const primaryIds =
      db.primaries
        .filter(
          x => x.lotId === id
        )
        .map(x => x.id);

    const secondaryIds =
      db.secondaries
        .filter(
          x =>
            primaryIds.includes(
              x.primaryId
            )
        )
        .map(x => x.id);

    secondaryIds.forEach(
      sid =>
        brdCache.delete(sid)
    );

    db.brd =
      db.brd.filter(
        x =>
          !secondaryIds.includes(
            x.secondaryId
          )
      );

    db.secondaries =
      db.secondaries.filter(
        x =>
          !secondaryIds.includes(
            x.id
          )
      );

    db.primaries =
      db.primaries.filter(
        x =>
          !primaryIds.includes(
            x.id
          )
      );

    db.lots =
      db.lots.filter(
        x => x.id !== id
      );

    if (selection.lot === id) {
      selection.lot = null;
      selection.primary = null;
      selection.secondary = null;
    }

    return;
  }

  if (type === "primary") {
    const secondaryIds =
      db.secondaries
        .filter(
          x => x.primaryId === id
        )
        .map(x => x.id);

    secondaryIds.forEach(
      sid =>
        brdCache.delete(sid)
    );

    db.brd =
      db.brd.filter(
        x =>
          !secondaryIds.includes(
            x.secondaryId
          )
      );

    db.secondaries =
      db.secondaries.filter(
        x =>
          !secondaryIds.includes(
            x.id
          )
      );

    db.primaries =
      db.primaries.filter(
        x => x.id !== id
      );

    if (
      selection.primary === id
    ) {
      selection.primary = null;
      selection.secondary = null;
    }

    return;
  }

  if (type === "secondary") {
    brdCache.delete(id);

    db.brd =
      db.brd.filter(
        x =>
          x.secondaryId !== id
      );

    db.secondaries =
      db.secondaries.filter(
        x => x.id !== id
      );

    if (
      selection.secondary === id
    ) {
      selection.secondary = null;
    }
  }
}

/* =========================================================
   NAVIGATION
   ========================================================= */

function initNav() {
  document
    .querySelectorAll(".nav-btn")
    .forEach(btn => {

      btn.addEventListener(
        "click",
        async () => {

          document
            .querySelectorAll(".nav-btn")
            .forEach(
              x =>
                x.classList.remove(
                  "active"
                )
            );

          document
            .querySelectorAll(".view")
            .forEach(
              x =>
                x.classList.remove(
                  "active-view"
                )
            );

          btn.classList.add(
            "active"
          );

          const view =
            $(btn.dataset.view);

          if (view) {
            view.classList.add(
              "active-view"
            );
          }

          $("pageSubtitle").textContent =
            btn.dataset.view === "chs"
              ? "VERSION 2 — CHARGES STANDARDS"
              : btn.dataset.view === "bds"
                ? "VERSION 2 — DÉCOMPOSITION"
                : "VERSION 2 — BUDGET";

          if (
            btn.dataset.view === "bdg"
          ) {
            await ensureBDGLoaded();
          }
        }
      );
    });
}

/* =========================================================
   CHS
   ========================================================= */

function renderChs() {
  const q =
    normalise(
      $("chsSearch").value
    ).toUpperCase();

  const rows =
    db.chs.filter(
      r =>
        [
          r.article,
          r.designation,
          r.unit
        ]
          .join(" ")
          .toUpperCase()
          .includes(q)
    );

  $("chsCount").textContent =
    `${rows.length} CHARGE${
      rows.length > 1
        ? "S"
        : ""
    }`;

  $("chsTable")
    .querySelector("tbody")
    .innerHTML =
      rows.length
        ? rows.map(
            r => `
              <tr
                class="data-row"
                data-type="chs"
                data-id="${esc(r.id)}"
              >
                <td>
                  ${esc(r.article)}
                </td>

                <td>
                  ${esc(r.designation)}
                </td>

                <td>
                  ${esc(r.unit)}
                </td>

                <td class="number yellow">
                  ${money(r.pcs)}
                </td>
              </tr>
            `
          ).join("")
        : `
          <tr>
            <td
              colspan="4"
              class="empty"
            >
              AUCUNE CHARGE STANDARD
            </td>
          </tr>
        `;

  bindRows();
}

function chsForm(
  item = null,
  duplicate = false
) {
  openForm(
    item && !duplicate
      ? "MODIFIER CHARGE STANDARD"
      : "AJOUTER CHARGE STANDARD",

    [
      f(
        "article",
        "ARTICLE",
        duplicate
          ? `${item.article}-COPIE`
          : item?.article || ""
      ),

      f(
        "designation",
        "DÉSIGNATION",
        item?.designation || "",
        "text",
        true
      ),

      f(
        "unit",
        "UNITÉ",
        item?.unit || ""
      ),

      f(
        "pcs",
        "PCS",
        item?.pcs ?? "",
        "number"
      )
    ],

    async values => {
      const out =
        await apiPost(
          "saveCHS",
          {
            data: {
              ID:
                item && !duplicate
                  ? item.id
                  : "",

              ARTICLE:
                values.article,

              DESIGNATION:
                values.designation,

              UNITE:
                values.unit,

              PCS:
                values.pcs
            }
          }
        );

      upsertLocalCHS(
        out.data
      );

      renderChs();
    }
  );
}

/* =========================================================
   CONFIGURATION BDS
   ========================================================= */

const cfg = {
  project: {
    arr: "projects",
    list: "projectList",
    parent: null,
    title: "PROJET",
    type: "PROJECT"
  },

  lot: {
    arr: "lots",
    list: "lotList",
    parent: "project",
    fk: "projectId",
    title: "LOT",
    type: "LOT"
  },

  primary: {
    arr: "primaries",
    list: "primaryList",
    parent: "lot",
    fk: "lotId",
    title: "TÂCHE PRIMAIRE",
    type: "PRIMARY"
  },

  secondary: {
    arr: "secondaries",
    list: "secondaryList",
    parent: "primary",
    fk: "primaryId",
    title: "TÂCHE SECONDAIRE",
    type: "SECONDARY"
  }
};

function rowsFor(type) {
  const c =
    cfg[type];

  let rows =
    db[c.arr];

  if (c.parent) {
    rows =
      rows.filter(
        r =>
          r[c.fk] ===
          selection[c.parent]
      );
  }

  const search =
    document.querySelector(
      `[data-search="${type}"]`
    );

  const q =
    normalise(
      search?.value
    ).toUpperCase();

  if (q) {
    rows =
      rows.filter(
        r =>
          `${r.code} ${r.name}`
            .toUpperCase()
            .includes(q)
      );
  }

  return [...rows].sort(
    (a, b) =>
      (a.order || 0) -
        (b.order || 0) ||
      String(a.name || "")
        .localeCompare(
          String(b.name || ""),
          "fr"
        )
  );
}

function renderHierarchyColumn(type) {
  const rows =
    rowsFor(type);

  const el =
    $(cfg[type].list);

  el.innerHTML =
    rows.length
      ? rows.map(
          r => `
            <div
              class="list-item ${
                selection[type] === r.id
                  ? "selected"
                  : ""
              }"
              data-select="${type}"
              data-id="${esc(r.id)}"
            >
              <span class="code">
                ${esc(r.code)}
              </span>

              <span class="name">
                ${esc(r.name)}
              </span>
            </div>
          `
        ).join("")
      : `
        <div class="empty">
          AUCUN ÉLÉMENT
        </div>
      `;

  el
    .querySelectorAll(
      "[data-select]"
    )
    .forEach(item => {

      item.onclick =
        () =>
          selectHierarchy(
            item.dataset.select,
            item.dataset.id
          );

      bindLongPress(
        item,
        {
          type:
            item.dataset.select,
          id:
            item.dataset.id
        }
      );
    });
}

function renderHierarchy() {
  renderHierarchyColumn("project");
  renderHierarchyColumn("lot");
  renderHierarchyColumn("primary");
  renderHierarchyColumn("secondary");

  renderContext();
  renderBrd();
}

function updateSelectedItem(type, id) {
  const list =
    $(cfg[type].list);

  list
    .querySelectorAll(
      ".list-item"
    )
    .forEach(el => {

      el.classList.toggle(
        "selected",
        el.dataset.id === id
      );
    });
}

async function selectHierarchy(
  type,
  id
) {
  selection[type] = id;

  if (type === "project") {
    selection.lot = null;
    selection.primary = null;
    selection.secondary = null;

    db.brd = [];
    brdRequestId++;

    updateSelectedItem(
      "project",
      id
    );

    renderHierarchyColumn("lot");
    renderHierarchyColumn("primary");
    renderHierarchyColumn("secondary");

    renderContext();
    renderBrd();

    return;
  }

  if (type === "lot") {
    selection.primary = null;
    selection.secondary = null;

    db.brd = [];
    brdRequestId++;

    updateSelectedItem(
      "lot",
      id
    );

    renderHierarchyColumn("primary");
    renderHierarchyColumn("secondary");

    renderContext();
    renderBrd();

    return;
  }

  if (type === "primary") {
    selection.secondary = null;

    db.brd = [];
    brdRequestId++;

    updateSelectedItem(
      "primary",
      id
    );

    renderHierarchyColumn(
      "secondary"
    );

    renderContext();
    renderBrd();

    return;
  }

  if (type === "secondary") {
    db.brd = [];

    updateSelectedItem(
      "secondary",
      id
    );

    renderContext();
    renderBrd();

    try {
      await loadBrdForSecondary(
        id
      );

    } catch (e) {
      $("brdCount").textContent =
        "ERREUR";

      $("brdTable")
        .querySelector("tbody")
        .innerHTML = `
          <tr>
            <td
              colspan="6"
              class="empty"
            >
              IMPOSSIBLE DE CHARGER LE BORDEREAU
            </td>
          </tr>
        `;

      alert(
        "CHARGEMENT DU BORDEREAU IMPOSSIBLE : " +
        e.message
      );
    }
  }
}

function getBy(type, id) {
  return db[
    cfg[type].arr
  ].find(
    x => x.id === id
  );
}

function addHierarchy(
  type,
  item = null,
  duplicate = false
) {
  const c =
    cfg[type];

  if (
    c.parent &&
    !selection[c.parent]
  ) {
    return alert(
      `SÉLECTIONNEZ D'ABORD : ${
        cfg[c.parent].title
      }`
    );
  }

  openForm(
    item && !duplicate
      ? "MODIFIER " + c.title
      : "AJOUTER " + c.title,

    [
      f(
        "code",
        "CODE / ABRÉVIATION",
        duplicate
          ? `${item.code}-C`
          : item?.code || ""
      ),

      f(
        "name",
        "NOM",
        item?.name || "",
        "text",
        true
      ),

      f(
        "order",
        "ORDRE",
        item?.order ?? "",
        "number"
      )
    ],

    async values => {
      const out =
        await apiPost(
          "saveBDS",
          {
            data: {
              ID:
                item && !duplicate
                  ? item.id
                  : "",

              TYPE:
                c.type,

              PARENT_ID:
                c.parent
                  ? selection[
                      c.parent
                    ]
                  : "",

              CODE:
                values.code,

              NOM:
                values.name,

              ORDRE:
                values.order,

              ACTIF:
                "OUI"
            }
          }
        );

      upsertLocalBDS(
        out.data
      );

      renderHierarchy();
    }
  );
}

function renderContext() {
  const parts = [];

  if (selection.project) {
    parts.push(
      `PROJET : ${
        getBy(
          "project",
          selection.project
        )?.code || ""
      }`
    );
  }

  if (selection.lot) {
    parts.push(
      `LOT : ${
        getBy(
          "lot",
          selection.lot
        )?.name || ""
      }`
    );
  }

  if (selection.primary) {
    parts.push(
      `TÂCHE PRIMAIRE : ${
        getBy(
          "primary",
          selection.primary
        )?.name || ""
      }`
    );
  }

  if (selection.secondary) {
    parts.push(
      `TÂCHE SECONDAIRE : ${
        getBy(
          "secondary",
          selection.secondary
        )?.name || ""
      }`
    );
  }

  $("bdsContext").textContent =
    parts.length
      ? parts.join(" | ")
      : "SÉLECTIONNEZ UNE TÂCHE SECONDAIRE";
}

function renderBrd() {
  const q =
    normalise(
      $("brdSearch").value
    ).toUpperCase();

  let rows =
    db.brd.filter(
      r =>
        r.secondaryId ===
        selection.secondary
    );

  if (q) {
    rows =
      rows.filter(
        r =>
          `${r.article} ${r.designation} ${r.unit}`
            .toUpperCase()
            .includes(q)
      );
  }

  $("brdCount").textContent =
    `${rows.length} ARTICLE${
      rows.length > 1
        ? "S"
        : ""
    }`;

  let total = 0;

  $("brdTable")
    .querySelector("tbody")
    .innerHTML =
      rows.length
        ? rows.map(r => {

            const amount =
              num(r.qty) *
              num(r.price);

            total += amount;

            return `
              <tr
                class="data-row"
                data-type="brd"
                data-id="${esc(r.id)}"
              >
                <td>
                  ${esc(r.article)}
                </td>

                <td>
                  ${esc(r.designation)}
                </td>

                <td>
                  ${esc(r.unit)}
                </td>

                <td class="number">
                  ${money(r.qty)}
                </td>

                <td class="number">
                  ${money(r.price)}
                </td>

                <td class="number">
                  ${money(amount)}
                </td>
              </tr>
            `;
          }).join("")
        : `
          <tr>
            <td
              colspan="6"
              class="empty"
            >
              ${
                selection.secondary
                  ? "AUCUN ARTICLE"
                  : "SÉLECTIONNEZ UNE TÂCHE SECONDAIRE"
              }
            </td>
          </tr>
        `;

  $("brdTotal").textContent =
    money(total);

  bindRows();
}

function brdForm(
  item = null,
  duplicate = false
) {
  if (
    !selection.secondary &&
    !item
  ) {
    return alert(
      "SÉLECTIONNEZ D'ABORD UNE TÂCHE SECONDAIRE"
    );
  }

  openForm(
    item && !duplicate
      ? "MODIFIER ARTICLE BORDEREAU"
      : "AJOUTER ARTICLE BORDEREAU",

    [
      f(
        "article",
        "ARTICLE",
        duplicate
          ? `${item.article}-C`
          : item?.article || ""
      ),

      f(
        "designation",
        "DÉSIGNATION",
        item?.designation || "",
        "text",
        true
      ),

      f(
        "unit",
        "UNITÉ",
        item?.unit || ""
      ),

      f(
        "qty",
        "QUANTITÉ",
        item?.qty ?? 0,
        "number"
      ),

      f(
        "price",
        "PRIX",
        item?.price ?? 0,
        "number"
      )
    ],

    async values => {
      const out =
        await apiPost(
          "saveBRD",
          {
            data: {
              ID:
                item && !duplicate
                  ? item.id
                  : "",

              TACHE_SECONDAIRE_ID:
                selection.secondary,

              ARTICLE:
                values.article,

              DESIGNATION:
                values.designation,

              UNITE:
                values.unit,

              QUANTITE:
                values.qty,

              PRIX:
                values.price,

              ACTIF:
                "OUI"
            }
          }
        );

      upsertLocalBRD(
        out.data
      );

      renderBrd();
    }
  );
}

/* =========================================================
   BDG — CHARGEMENT
   ========================================================= */

async function ensureBDGLoaded() {
  if (
    bdgLoaded ||
    bdgLoading
  ) {
    return;
  }

  bdgLoading = true;

  try {
    setBDGLoadingState();

    const data =
      await apiGetBDG();

    const rows =
      data.rows || [];

    if (rows.length < 2) {
      throw new Error(
        "BDG VIDE"
      );
    }

    const headers =
      rows[0];

    bdgRows =
      rows.slice(1).map(row => {

        const obj = {};

        headers.forEach(
          (header, index) => {

            obj[
              String(header).trim()
            ] =
              row[index] ?? "";
          }
        );

        return obj;
      });

    bdgLoaded = true;

    renderBudgetList();

  } catch (error) {
    renderBDGError(
      error.message ||
      String(error)
    );

  } finally {
    bdgLoading = false;
  }
}

function setBDGLoadingState() {
  const body = $("budgetListTable")?.querySelector("tbody");
  if (body) body.innerHTML = '<tr><td colspan="8" class="empty">CHARGEMENT DES BUDGETS...</td></tr>';
}

function renderBDGError(message) {
  const body = $("budgetListTable")?.querySelector("tbody");
  if (body) body.innerHTML = '<tr><td colspan="8" class="empty">ERREUR BDG : ' + esc(message) + '</td></tr>';
}

function firstValue(row, names) {
  for (const name of names) {
    const v = row[name];
    if (normalise(v) !== "") return v;
  }
  return "";
}

function budgetReference(row, index) {
  return firstValue(row, ["BDG","REFERENCE BDG","REFERENCE","RÉFÉRENCE"]) || ("BDG-" + String(index + 1).padStart(4,"0"));
}

function renderBudgetList() {
  const table = $("budgetListTable");
  if (!table) return;
  const groups = new Map();
  bdgRows.forEach((r,i) => {
    const ref = budgetReference(r,i);
    if (!groups.has(ref)) groups.set(ref, { ref, rows: [], first:r });
    groups.get(ref).rows.push(r);
  });
  const budgets = [...groups.values()];
  const body = table.querySelector("tbody");
  if (!budgets.length) {
    body.innerHTML = '<tr><td colspan="8" class="empty">AUCUN BUDGET</td></tr>';
    return;
  }
  body.innerHTML = budgets.map((b,i) => {
    const r=b.first;
    const project=firstValue(r,["PROJET","PRJ","NOM PROJET"]);
    const designation=firstValue(r,["DESIGNATION","DÉSIGNATION","DETAIL BUDGET"]);
    const ht=b.rows.reduce((t,x)=>t+num(firstValue(x,["MNB","MONTANT HT","MPB HT","MPB"])),0);
    const tva=num(firstValue(r,["TVA","TAUX TVA"]));
    const tvaAmount=tva ? ht*tva/(tva>1?100:1) : 0;
    const ttc=ht+tvaAmount;
    const validated=firstValue(r,["VALIDE LE","VALIDÉ LE","DATE VALIDATION","DATE"]);
    return '<tr data-budget-ref="'+esc(b.ref)+'">'+
      '<td><span class="budget-link">'+esc(b.ref)+'</span></td>'+
      '<td>'+esc(project)+'</td>'+
      '<td>'+esc(designation)+'</td>'+
      '<td class="number">'+money(ht)+'</td>'+
      '<td class="number">'+(tva?money(tva>1?tva:tva*100)+" %":"")+'</td>'+
      '<td class="number">'+money(ttc)+'</td>'+
      '<td>'+esc(validated)+'</td>'+
      '<td class="preview-cell"><button class="paper-preview" type="button" aria-label="Aperçu">▤</button></td>'+
      '</tr>';
  }).join("");
}

/* =========================================================
   BDG — SELECTEURS
   ========================================================= */

function fillSelect(
  select,
  values,
  selectedValue = ""
) {
  if (!select) {
    return;
  }

  select.innerHTML = "";

  if (!values.length) {
    const option =
      document.createElement(
        "option"
      );

    option.value = "";
    option.textContent =
      "AUCUN ÉLÉMENT";

    select.appendChild(
      option
    );

    return;
  }

  values.forEach(value => {
    const option =
      document.createElement(
        "option"
      );

    option.value = value;
    option.textContent = value;

    if (
      value === selectedValue
    ) {
      option.selected = true;
    }

    select.appendChild(
      option
    );
  });
}

function initialiseBDGSelectors() {
  const projects =
    unique(
      bdgRows.map(
        r => r["PRJ"]
      )
    );

  fillSelect(
    $("project"),
    projects
  );

  if (
    projects.includes("H88")
  ) {
    $("project").value =
      "H88";
  }

  updateBDGLots();
}

function updateBDGLots() {
  const project =
    $("project")?.value || "";

  const lots =
    unique(
      bdgRows
        .filter(
          r =>
            normalise(
              r["PRJ"]
            ) ===
            normalise(
              project
            )
        )
        .map(
          r => r["LOT"]
        )
    );

  fillSelect(
    $("lot"),
    lots
  );

  updateBDGPrimaryActivities();
}

function updateBDGPrimaryActivities() {
  const project =
    $("project")?.value || "";

  const lot =
    $("lot")?.value || "";

  const values =
    unique(
      bdgRows
        .filter(
          r =>
            normalise(
              r["PRJ"]
            ) ===
              normalise(
                project
              ) &&
            normalise(
              r["LOT"]
            ) ===
              normalise(
                lot
              )
        )
        .map(
          r =>
            r[
              "ACTIVITE PRIMAIRE"
            ]
        )
    );

  fillSelect(
    $("primary"),
    values
  );

  updateBDGSecondaryActivities();
}

function updateBDGSecondaryActivities() {
  const project =
    $("project")?.value || "";

  const lot =
    $("lot")?.value || "";

  const primary =
    $("primary")?.value || "";

  const values =
    unique(
      bdgRows
        .filter(
          r =>
            normalise(
              r["PRJ"]
            ) ===
              normalise(
                project
              ) &&
            normalise(
              r["LOT"]
            ) ===
              normalise(
                lot
              ) &&
            normalise(
              r[
                "ACTIVITE PRIMAIRE"
              ]
            ) ===
              normalise(
                primary
              )
        )
        .map(
          r =>
            r["ACTIVITE"]
        )
    );

  fillSelect(
    $("secondary"),
    values
  );

  refreshBudget();
}

/* =========================================================
   BDG — FILTRE TACHE
   ========================================================= */

function selectedBDGRows() {
  const project =
    $("project")?.value || "";

  const lot =
    $("lot")?.value || "";

  const primary =
    $("primary")?.value || "";

  const secondary =
    $("secondary")?.value || "";

  return bdgRows.filter(
    r =>
      normalise(
        r["PRJ"]
      ) === normalise(project) &&

      normalise(
        r["LOT"]
      ) === normalise(lot) &&

      normalise(
        r["ACTIVITE PRIMAIRE"]
      ) === normalise(primary) &&

      normalise(
        r["ACTIVITE"]
      ) === normalise(secondary)
  );
}

/* =========================================================
   BDG — RAFRAICHISSEMENT
   ========================================================= */

function refreshBudget() {
  const rows =
    selectedBDGRows();

  updateBDGDesignation(rows);
  renderProductTable(rows);
  renderChargeTable(rows);
  renderAnalysis(rows);
}

function updateBDGDesignation(rows) {
  const field =
    $("brdDesignation");

  if (!field) {
    return;
  }

  const designations =
    unique(
      rows.map(
        r => r["DESIGNATION"]
      )
    );

  field.value =
    designations.join(" / ");
}

/* =========================================================
   BDG — PRODUITS
   ========================================================= */

function renderProductTable(rows) {
  const table =
    $("productTable");

  if (!table) {
    return;
  }

  const products =
    rows.filter(
      r =>
        normalise(
          r["CHG/PRD"]
        ).toUpperCase() === "PRD"
    );

  table.innerHTML = `
    <thead>
      <tr>
        <th>N°</th>
        <th>DÉSIGNATION</th>
        <th>UPB</th>
        <th>NBR</th>
        <th>DIM 1</th>
        <th>DIM 2</th>
        <th>DIM 3</th>
        <th class="number">QPB PRT</th>
        <th class="number">PPB</th>
        <th class="number">MPB</th>
      </tr>
    </thead>

    <tbody>
      ${
        products.length
          ? products.map(
              r => `
                <tr>
                  <td>
                    ${esc(r["N°"])}
                  </td>

                  <td>
                    ${esc(
                      r["DETAIL BUDGET"]
                    )}
                  </td>

                  <td class="yellow">
                    ${esc(r["UTB"])}
                  </td>

                  <td class="number">
                    ${esc(r["NBR"])}
                  </td>

                  <td class="number">
                    ${esc(r["DIM1"])}
                  </td>

                  <td class="number">
                    ${esc(r["DIM2"])}
                  </td>

                  <td class="number">
                    ${esc(r["DIM3"])}
                  </td>

                  <td class="number yellow">
                    ${money(r["QTB"])}
                  </td>

                  <td class="number yellow">
                    ${money(r["PUB"])}
                  </td>

                  <td class="number yellow">
                    ${money(r["MNB"])}
                  </td>
                </tr>
              `
            ).join("")
          : `
            <tr>
              <td
                colspan="10"
                class="empty"
              >
                AUCUN PRODUIT
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
          ${money(
            sum(products, "QTB")
          )}
        </td>

        <td></td>

        <td class="number yellow">
          ${money(
            sum(products, "MNB")
          )}
        </td>
      </tr>
    </tfoot>
  `;
}

/* =========================================================
   BDG — CHARGES
   ========================================================= */

function renderChargeTable(rows) {
  const table =
    $("chargeTable");

  if (!table) {
    return;
  }

  const charges =
    rows.filter(
      r =>
        normalise(
          r["CHG/PRD"]
        ).toUpperCase() === "CHG"
    );

  table.innerHTML = `
    <thead>
      <tr>
        <th>N°</th>
        <th>ARTICLE</th>
        <th>DÉSIGNATION</th>
        <th>UCB</th>
        <th class="number">QCB</th>
        <th class="number">PCS</th>
        <th class="number">MCB</th>
      </tr>
    </thead>

    <tbody>
      ${
        charges.length
          ? charges.map(
              r => `
                <tr>
                  <td>
                    ${esc(r["N°"])}
                  </td>

                  <td>
                    ${esc(
                      r["DESIGNATION"]
                    )}
                  </td>

                  <td>
                    ${esc(
                      r["DETAIL BUDGET"]
                    )}
                  </td>

                  <td>
                    ${esc(r["UTB"])}
                  </td>

                  <td class="number">
                    ${money(r["QTB"])}
                  </td>

                  <td class="number yellow">
                    ${money(r["PUB"])}
                  </td>

                  <td class="number yellow">
                    ${money(r["MNB"])}
                  </td>
                </tr>
              `
            ).join("")
          : `
            <tr>
              <td
                colspan="7"
                class="empty"
              >
                AUCUNE CHARGE
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
          ${money(
            sum(charges, "MNB")
          )}
        </td>
      </tr>
    </tfoot>
  `;
}

/* =========================================================
   BDG — ANALYSE
   ========================================================= */

function renderAnalysis(rows) {
  const box =
    $("analysisCompact");

  if (!box) {
    return;
  }

  const products =
    rows.filter(
      r =>
        normalise(
          r["CHG/PRD"]
        ).toUpperCase() === "PRD"
    );

  const charges =
    rows.filter(
      r =>
        normalise(
          r["CHG/PRD"]
        ).toUpperCase() === "CHG"
    );

  const productAmount =
    sum(products, "MNB");

  const chargeAmount =
    sum(charges, "MNB");

  const margin =
    productAmount -
    chargeAmount;

  const rate =
    productAmount
      ? (
          margin /
          productAmount
        ) * 100
      : 0;

  if (
    currentAnalysis === "yield"
  ) {
    box.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>ACTIVITÉ</th>
            <th class="number">PRODUIT</th>
            <th class="number">CHARGE</th>
            <th class="number">RENDEMENT</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>
              ${
                esc(
                  $("secondary")
                    ?.value || ""
                )
              }
            </td>

            <td class="number">
              ${money(productAmount)}
            </td>

            <td class="number">
              ${money(chargeAmount)}
            </td>

            <td class="number">
              ${money(rate)} %
            </td>
          </tr>
        </tbody>
      </table>
    `;

    return;
  }

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

          <th class="number">
            PRODUITS
          </th>

          <th class="number">
            CHARGES
          </th>

          <th class="number">
            MARGE
          </th>

          <th class="number">
            TAUX
          </th>
        </tr>
      </thead>

      <tbody>
        <tr>
          <td>
            ${
              currentAnalysis ===
              "primaryMargin"
                ? esc(
                    $("primary")
                      ?.value || ""
                  )
                : esc(
                    $("brdDesignation")
                      ?.value || ""
                  )
            }
          </td>

          <td class="number">
            ${money(productAmount)}
          </td>

          <td class="number">
            ${money(chargeAmount)}
          </td>

          <td class="number">
            ${money(margin)}
          </td>

          <td class="number">
            ${money(rate)} %
          </td>
        </tr>
      </tbody>

      <tfoot>
        <tr>
          <td>
            <strong>TOTAL</strong>
          </td>

          <td class="number">
            ${money(productAmount)}
          </td>

          <td class="number">
            ${money(chargeAmount)}
          </td>

          <td class="number">
            ${money(margin)}
          </td>

          <td class="number">
            ${money(rate)} %
          </td>
        </tr>
      </tfoot>
    </table>
  `;
}

/* =========================================================
   FORMULAIRES CHS / BDS
   ========================================================= */

function f(
  name,
  label,
  value = "",
  type = "text",
  full = false
) {
  return {
    name,
    label,
    value,
    type,
    full
  };
}

function openForm(
  title,
  fields,
  onSave
) {
  $("modalTitle").textContent =
    title;

  $("modalForm").innerHTML =
    fields.map(
      x => `
        <div
          class="field ${
            x.full ? "full" : ""
          }"
        >
          <label>
            ${esc(x.label)}
          </label>

          <input
            name="${esc(x.name)}"
            type="${esc(x.type)}"
            value="${esc(x.value)}"
            ${
              x.type === "number"
                ? 'step="any" inputmode="decimal"'
                : ""
            }
            required
          >
        </div>
      `
    ).join("") +
    `
      <div class="form-actions">

        <button
          type="button"
          class="secondary"
          id="cancelForm"
        >
          ANNULER
        </button>

        <button
          class="primary"
          type="submit"
        >
          ENREGISTRER
        </button>

      </div>
    `;

  $("modal")
    .classList.remove(
      "hidden"
    );

  $("cancelForm").onclick =
    closeModal;

  $("modalForm").onsubmit =
    async e => {

      e.preventDefault();

      const btn =
        e.currentTarget
          .querySelector(
            'button[type="submit"]'
          );

      btn.disabled = true;
      btn.textContent =
        "ENREGISTREMENT...";

      try {
        await onSave(
          Object.fromEntries(
            new FormData(
              e.currentTarget
            ).entries()
          )
        );

        closeModal();

      } catch (err) {
        alert(
          err.message ||
          String(err)
        );

        btn.disabled = false;
        btn.textContent =
          "ENREGISTRER";
      }
    };
}

function closeModal() {
  $("modal")
    .classList.add(
      "hidden"
    );
}

/* =========================================================
   APPUI LONG CHS / BDS
   ========================================================= */

function bindLongPress(
  el,
  ctx
) {
  const start = e => {
    clearTimeout(
      longPressTimer
    );

    longPressTimer =
      setTimeout(
        () =>
          showRowMenu(
            e,
            ctx
          ),
        550
      );
  };

  const stop =
    () =>
      clearTimeout(
        longPressTimer
      );

  el.addEventListener(
    "pointerdown",
    start
  );

  el.addEventListener(
    "pointerup",
    stop
  );

  el.addEventListener(
    "pointerleave",
    stop
  );

  el.addEventListener(
    "pointercancel",
    stop
  );

  el.addEventListener(
    "contextmenu",
    e => {
      e.preventDefault();

      showRowMenu(
        e,
        ctx
      );
    }
  );
}

function bindRows() {
  document
    .querySelectorAll(
      "tr.data-row"
    )
    .forEach(el => {

      bindLongPress(
        el,
        {
          type:
            el.dataset.type,
          id:
            el.dataset.id
        }
      );
    });
}

function showRowMenu(
  e,
  ctx
) {
  rowContext = ctx;

  const menu =
    $("rowMenu");

  menu.style.left =
    Math.min(
      e.clientX || 20,
      window.innerWidth - 200
    ) + "px";

  menu.style.top =
    Math.min(
      e.clientY || 20,
      window.innerHeight - 190
    ) + "px";

  menu.classList.remove(
    "hidden"
  );
}

function rowItem(ctx) {
  if (
    ctx.type === "chs"
  ) {
    return db.chs.find(
      x => x.id === ctx.id
    );
  }

  if (
    ctx.type === "brd"
  ) {
    return db.brd.find(
      x => x.id === ctx.id
    );
  }

  return getBy(
    ctx.type,
    ctx.id
  );
}

async function deleteRow(ctx) {
  if (
    ctx.type === "chs"
  ) {
    await apiPost(
      "deleteCHS",
      { id: ctx.id }
    );

    db.chs =
      db.chs.filter(
        x =>
          x.id !== ctx.id
      );

    renderChs();

    return;
  }

  if (
    ctx.type === "brd"
  ) {
    await apiPost(
      "deleteBRD",
      { id: ctx.id }
    );

    db.brd =
      db.brd.filter(
        x =>
          x.id !== ctx.id
      );

    if (
      selection.secondary
    ) {
      brdCache.set(
        selection.secondary,
        [...db.brd]
      );
    }

    renderBrd();

    return;
  }

  await apiPost(
    "deleteBDS",
    { id: ctx.id }
  );

  removeLocalBDS(
    ctx.type,
    ctx.id
  );

  renderHierarchy();
}

function infoRow(ctx) {
  const x =
    rowItem(ctx);

  if (!x) {
    return;
  }

  const lines =
    Object.entries(x)
      .filter(
        ([k]) =>
          k !== "id" &&
          !k.endsWith("Id")
      )
      .map(
        ([k, v]) =>
          `${k.toUpperCase()} : ${v}`
      )
      .join("\n");

  alert(lines);
}

/* =========================================================
   DEMARRAGE
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    initNav();

    $("chsSearch")
      ?.addEventListener(
        "input",
        renderChs
      );

    $("brdSearch")
      ?.addEventListener(
        "input",
        renderBrd
      );

    if ($("addChsBtn")) {
      $("addChsBtn").onclick =
        () => chsForm();
    }

    if ($("addBrdBtn")) {
      $("addBrdBtn").onclick =
        () => brdForm();
    }

    if ($("modalClose")) {
      $("modalClose").onclick =
        closeModal;
    }

    $("modal")
      ?.addEventListener(
        "click",
        e => {
          if (
            e.target ===
            $("modal")
          ) {
            closeModal();
          }
        }
      );

    document.addEventListener(
      "click",
      e => {
        if (
          !e.target.closest(
            "#rowMenu"
          )
        ) {
          $("rowMenu")
            ?.classList.add(
              "hidden"
            );
        }
      }
    );

    document
      .querySelectorAll(
        "[data-add]"
      )
      .forEach(
        b => {
          b.onclick =
            () =>
              addHierarchy(
                b.dataset.add
              );
        }
      );

    document
      .querySelectorAll(
        "[data-search]"
      )
      .forEach(
        i => {
          i.addEventListener(
            "input",
            renderHierarchy
          );
        }
      );

    /* ---------------- BDG SELECTEURS ---------------- */

    $("project")
      ?.addEventListener(
        "change",
        updateBDGLots
      );

    $("lot")
      ?.addEventListener(
        "change",
        updateBDGPrimaryActivities
      );

    $("primary")
      ?.addEventListener(
        "change",
        updateBDGSecondaryActivities
      );

    $("secondary")
      ?.addEventListener(
        "change",
        refreshBudget
      );

    /* ---------------- BDG ONGLETS ---------------- */

    document
      .querySelectorAll(
        ".bdg-tabs .tab"
      )
      .forEach(tab => {

        tab.addEventListener(
          "click",
          () => {

            document
              .querySelectorAll(
                ".bdg-tabs .tab"
              )
              .forEach(
                t =>
                  t.classList.remove(
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
              selectedBDGRows()
            );
          }
        );
      });

    /* ---------------- MENU CONTEXTUEL ---------------- */

    $("rowMenu")
      ?.addEventListener(
        "click",
        async e => {

          const action =
            e.target.dataset.action;

          if (
            !action ||
            !rowContext
          ) {
            return;
          }

          const item =
            rowItem(
              rowContext
            );

          $("rowMenu")
            .classList.add(
              "hidden"
            );

          try {
            if (
              action === "info"
            ) {
              infoRow(
                rowContext
              );
            }

            if (
              action === "delete" &&
              confirm(
                "CONFIRMER LA SUPPRESSION ?"
              )
            ) {
              await deleteRow(
                rowContext
              );
            }

            if (
              action === "edit"
            ) {
              if (
                rowContext.type === "chs"
              ) {
                chsForm(item);

              } else if (
                rowContext.type === "brd"
              ) {
                brdForm(item);

              } else {
                addHierarchy(
                  rowContext.type,
                  item
                );
              }
            }

            if (
              action === "duplicate"
            ) {
              if (
                rowContext.type === "chs"
              ) {
                chsForm(
                  item,
                  true
                );

              } else if (
                rowContext.type === "brd"
              ) {
                brdForm(
                  item,
                  true
                );

              } else {
                addHierarchy(
                  rowContext.type,
                  item,
                  true
                );
              }
            }

          } catch (err) {
            alert(
              err.message ||
              String(err)
            );
          }
        }
      );

    await reloadAll();
  }
);
