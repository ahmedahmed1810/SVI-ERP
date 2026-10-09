const API_URL = "https://script.google.com/macros/s/AKfycbzFgUloyiRJe-QmR7nRqJ4bfWqvfA_6LSgotJRrRt87yeRfWtdY7nxXMR9avafSJUPg4Q/exec";
const API_KEY = "nZYYROPFeFXBims8v4NCPcbXG8Nl";

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
let bdgGroups = new Map();
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

/* retire le préfixe d'ordre "00 - " (5 caractères) des libellés
   de lots / tâches ; libellé inchangé s'il n'a pas ce préfixe */
function stripLevelPrefix(v) {
  const s = String(v ?? "");
  return s.replace(/^\s*\d{1,3}\s*[-–]\s*/, "");
}

/* fiche en lecture seule au double-clic : code, nom, ordre */
const levelTap = { type: "", id: "", at: 0 };

function showLevelInfo(type, id) {
  const item = getBy(type, id);
  if (!item) return;

  document.getElementById("levelInfoPop")?.remove();

  const pop = document.createElement("div");
  pop.id = "levelInfoPop";
  pop.style.cssText =
    "position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.35);" +
    "display:flex;align-items:center;justify-content:center;padding:16px";

  const row = (label, value) => `
    <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid #edf0f4">
      <span style="width:80px;flex:none;font-size:11px;font-weight:800;color:#7b8597">${label}</span>
      <span style="font-size:13px;font-weight:600;color:#172033;word-break:break-word">${esc(value)}</span>
    </div>`;

  pop.innerHTML = `
    <div style="background:#fff;border-radius:12px;width:100%;max-width:380px;
                padding:16px 18px;box-shadow:0 12px 32px rgba(0,0,0,.18)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <strong style="font-size:13px;color:#0f4f96">${esc(cfg[type]?.title || "")}</strong>
        <button type="button" data-close
                style="border:0;background:#f1f3f6;border-radius:6px;padding:4px 10px;font-weight:800;cursor:pointer">✕</button>
      </div>
      ${row("CODE", item.code ?? "")}
      ${row("NOM", stripLevelPrefix(item.name))}
      ${row("ORDRE", item.order ?? "")}
    </div>`;

  pop.addEventListener("click", e => {
    if (e.target === pop || e.target.closest("[data-close]")) {
      pop.remove();
    }
  });

  document.body.appendChild(pop);
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
                ${esc(stripLevelPrefix(r.name))}
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
        () => {
          const t = item.dataset.select;
          const id = item.dataset.id;
          const now = Date.now();

          /* double-clic / double-tap (fiable aussi sur iPad) */
          if (
            levelTap.id === id &&
            levelTap.type === t &&
            now - levelTap.at < 400
          ) {
            levelTap.at = 0;
            showLevelInfo(t, id);
            return;
          }

          levelTap.type = t;
          levelTap.id = id;
          levelTap.at = now;

          selectHierarchy(t, id);
        };

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
  if (bdgLoaded || bdgLoading) return;

  bdgLoading = true;

  try {
    setBDGLoadingState();

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

/* =========================================================
   BDG — LISTE
   ========================================================= */

function renderBudgetList() {
  const table =
    $("budgetListTable");

  if (!table) return;

  const shell =
    table.closest(
      ".novapp-list-shell"
    );

  if (!shell) return;

  /* -------------------------------------------------------
     STYLE SPÉCIFIQUE À LA LISTE
     ------------------------------------------------------- */

  if (!$("bdgListRuntimeStyle")) {
    const style =
      document.createElement("style");

    style.id =
      "bdgListRuntimeStyle";

    style.textContent = `

      .novapp-budget-table-wrap {
        position: relative;
        max-height: calc(100vh - 150px);
        overflow: auto !important;
        -webkit-overflow-scrolling: touch;
      }

      #budgetListTable {
        table-layout: fixed;
        width: 100%;
        min-width: 1050px;
      }

      #budgetListTable thead th {
        position: sticky;
        top: 0;
        z-index: 20;
        background: #f3f4f6;
        overflow: visible;
        user-select: none;
      }

      #budgetListTable td {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .bdg-list-head {
        position: relative;
      }

      .bdg-head-content {
        display: flex;
        align-items: center;
        width: 100%;
        gap: 3px;
        min-width: 0;
      }

      .bdg-head-label {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .bdg-head-action {
        width: 22px;
        min-width: 22px;
        height: 24px;
        padding: 0;
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: #687281;
        cursor: pointer;
        font-size: 12px;
        line-height: 24px;
        text-align: center;
        text-transform: none;
      }

      .bdg-head-action:hover {
        background: #e3e7ec;
        color: #222b38;
      }

      .bdg-column-search {
        width: 100%;
        min-width: 50px;
        height: 26px;
        padding: 2px 7px;
        border: 1px solid #9ca7b6;
        border-radius: 5px;
        outline: none;
        background: #fff;
        color: #303947;
        font-size: 10px;
        font-weight: 700;
        text-transform: none;
      }

      .bdg-column-search:focus {
        border-color: #1769c2;
      }

      .bdg-column-resizer {
        position: absolute;
        top: 0;
        right: -4px;
        z-index: 40;
        width: 8px;
        height: 100%;
        cursor: col-resize;
        touch-action: none;
      }

      .bdg-column-resizer:hover,
      .bdg-column-resizer.active {
        background:
          rgba(23,105,194,.18);
      }

      #budgetListTable .number {
        text-align: right;
      }

      #budgetListTable
      .bdg-action-cell {
        text-align: center;
        padding-left: 3px;
        padding-right: 3px;
        overflow: visible;
      }

      .bdg-row-action {
        width: 27px;
        height: 27px;
        padding: 0;
        margin: 0 1px;
        border: 0;
        border-radius: 5px;
        background: transparent;
        color: #5f6875;
        cursor: pointer;
        font-size: 16px;
        text-transform: none;
      }

      .bdg-row-action:hover {
        background: #edf1f5;
      }

      #budgetListTable tbody tr[data-budget-ref] {
        cursor: pointer;
      }

      #budgetListTable tbody tr[data-budget-ref]:hover {
        background: #f8fafc;
      }

      .bdg-popup-back {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(15,23,42,.45);
      }

      .bdg-popup {
        width: 100%;
        max-width: 460px;
        border-radius: 14px;
        background: #fff;
        box-shadow: 0 20px 50px rgba(0,0,0,.3);
        overflow: hidden;
      }

      .bdg-popup-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: #f3f4f6;
        border-bottom: 1px solid #e1e5eb;
        font-size: 12px;
        font-weight: 800;
      }

      .bdg-popup-close {
        width: 30px;
        height: 30px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        font-size: 16px;
        cursor: pointer;
      }

      .bdg-popup-body {
        padding: 16px;
      }

      .bdg-popup-field {
        margin-bottom: 12px;
      }

      .bdg-popup-field label {
        display: block;
        margin-bottom: 4px;
        color: #6b7480;
        font-size: 10px;
        font-weight: 800;
      }

      .bdg-popup-field div {
        min-height: 32px;
        padding: 7px 10px;
        border: 1px solid #dfe4eb;
        border-radius: 8px;
        background: #fafbfc;
        font-size: 12px;
        font-weight: 700;
      }

      .bdg-popup-note {
        color: #8a93a0;
        font-size: 10px;
      }


      .bdg-d-page { padding: 18px 28px 40px; }

      /* haut de l'écran figé : titre ☰ → pastilles DOC/TAF/OBS/INF */
      .bdg-d-sticky {
        position: sticky;
        top: 0;
        z-index: 50;
        background: #fff;
        box-shadow: 0 2px 6px rgba(15, 23, 42, .06);
      }
      .bdg-d-head { padding: 14px 28px 4px; }
      .bdg-d-head .bdg-d-pills { margin-bottom: 10px; }

      .bdg-d-title {
        margin: 0 0 6px;
        font-size: 30px;
        font-weight: 900;
        text-decoration: underline;
        text-underline-offset: 6px;
        text-transform: none;
      }

      .bdg-d-ref {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
        color: #3f4856;
        font-size: 13px;
        font-weight: 800;
      }

      .bdg-d-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: #e8edf3;
        color: #5f6875;
        font-size: 11px;
        font-weight: 900;
      }

      .bdg-d-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 20px;
      }

      .bdg-d-pill {
        padding: 6px 14px;
        border: 1px solid #dfe4eb;
        border-radius: 999px;
        background: #fff;
        color: #4b5563;
        font-size: 10px;
        font-weight: 800;
      }

      .bdg-d-block {
        margin-bottom: 18px;
        border: 1px solid #e1e5eb;
        border-radius: 12px;
        background: #fff;
        overflow: hidden;
      }

      .bdg-d-block-title {
        padding: 9px 14px;
        background: #f3f4f6;
        border-bottom: 1px solid #e1e5eb;
        font-size: 11px;
        font-weight: 900;
      }

      .bdg-d-scroll {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      .bdg-d-table {
        width: 100%;
        min-width: 700px;
        border-collapse: collapse;
        font-size: 11px;
      }

      .bdg-d-table th,
      .bdg-d-table td {
        padding: 3px 10px;
        line-height: 1.25;
        border-bottom: 1px solid #edf0f4;
        text-align: left;
        white-space: nowrap;
      }

      .bdg-d-table th {
        position: sticky;
        top: 0;
        z-index: 2;
        background: #fafbfc;
        color: #6b7480;
        font-size: 10px;
      }

      .bdg-d-table .number { text-align: right; }
      .bdg-d-table .center { text-align: center; }

      .bdg-d-table .empty {
        text-align: center;
        color: #9aa3af;
      }

      .bdg-tva-input {
        width: 58px;
        padding: 3px 5px;
        border: 1px solid #cfd6df;
        border-radius: 6px;
        text-align: right;
        font-size: 11px;
      }

      .bdg-d-reserved {
        padding: 22px 14px;
        color: #9aa3af;
        font-size: 11px;
      }

      .bdg-d-delay {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        padding: 14px;
      }

      .bdg-d-delay label {
        display: block;
        color: #6b7480;
        font-size: 10px;
        font-weight: 800;
      }

      .bdg-d-delay input,
      .bdg-d-delay div {
        display: block;
        min-width: 150px;
        min-height: 30px;
        margin-top: 4px;
        padding: 6px 9px;
        border: 1px solid #dfe4eb;
        border-radius: 8px;
        background: #fff;
        color: #303947;
        font-size: 12px;
      }

      .bdg-d-totals {
        margin-left: auto;
        max-width: 340px;
        border: 1px solid #e1e5eb;
        border-radius: 12px;
        background: #fff;
        overflow: hidden;
      }

      .bdg-d-totals div {
        display: flex;
        justify-content: space-between;
        padding: 9px 14px;
        border-bottom: 1px solid #edf0f4;
        font-size: 11px;
        font-weight: 800;
      }

      .bdg-d-total-ttc {
        background: #dcecff;
        border-bottom: 0 !important;
      }

      @media (max-width:650px) {
        .bdg-d-page { padding: 14px 10px 30px; }
        .bdg-d-head { padding: 10px 10px 2px; }
        .bdg-d-title { font-size: 24px; }
      }


      .bdg-d-h1 {
        margin: 0;
        font-size: 22px;
        font-weight: 900;
        text-transform: none;
      }

      #bdgClientBody { }

      /* tableau désignations client : cadre de hauteur fixe,
         en-tête figé, lignes vides de remplissage */
      .bdg-d-block > .bdg-d-scroll.bdg-d-client-scroll {
        height: 245px;
        max-height: none;
      }
      .bdg-d-table tbody tr.bdg-d-filler td {
        height: 20px;
        background: transparent;
      }

      .bdg-d-block > .bdg-d-scroll {
        max-height: 245px;
        overflow-y: auto;
      }

      .bdg-d-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: -1px;
      }

      .bdg-d-tab {
        padding: 9px 16px;
        border: 1px solid #e1e5eb;
        border-bottom: 0;
        border-radius: 10px 10px 0 0;
        background: #f3f4f6;
        color: #5f6875;
        font-size: 10px;
        font-weight: 800;
        cursor: pointer;
        text-transform: none;
      }

      .bdg-d-tab.active {
        background: #fff;
        color: #0f4f96;
      }

      .bdg-d-tabbody {
        border-top-left-radius: 0;
      }

      .bdg-d-debug {
        margin-top: 14px;
        color: #8a93a0;
        font-size: 10px;
      }

.bdg-d-table tbody tr[data-desig]{cursor:pointer}
.bdg-d-table tbody tr[data-row]{cursor:pointer}
.bdg-d-table tbody tr.selected td{background:#dbeafe !important;font-weight:700}
.bdg-d-fi{float:right;font-size:11px;font-weight:600;opacity:.8}
.bdg-h-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px}
.bdg-h-col{border:1px solid #d6dbe3;border-radius:8px;overflow:hidden;height:143px;overflow-y:auto;background:#fff}
.bdg-h-head{position:sticky;top:0;z-index:1;background:#eef1f6;font-size:11px;line-height:15px;font-weight:700;padding:6px 8px}
.bdg-h-item{padding:3px 8px;font-size:12px;line-height:16px;cursor:pointer;border-top:1px solid #eef1f6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bdg-h-fill{height:16px;padding:3px 8px;border-top:1px solid #eef1f6}
.bdg-h-item.selected{background:#dbeafe;font-weight:700}
.bdg-h-empty{padding:8px;font-size:12px;opacity:.5}
@media (max-width:650px){.bdg-h-grid{grid-template-columns:1fr}}

      @media (max-width:650px) {
        .novapp-budget-table-wrap {
          max-height:
            calc(100vh - 130px);
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  /* -------------------------------------------------------
     REGROUPEMENT PAR BUDGET
     ------------------------------------------------------- */

  const groups = new Map();
  const byProject = new Map();

  /* Date provisoire intégrée à la référence : 01/10/2026 */
  const REF_PREFIX = "BDG 26-1001/";

  bdgRows.forEach(row => {
    const prj =
      normalise(
        firstValue(
          row,
          ["PRJ", "PROJET", "NOM PROJET"]
        )
      ) || "SANS PROJET";

    if (!byProject.has(prj)) {
      const ref =
        REF_PREFIX +
        String(byProject.size + 1)
          .padStart(3, "0");

      const group = {
        ref,
        project: prj,
        rows: [],
        first: row
      };

      byProject.set(prj, group);
      groups.set(ref, group);
    }

    byProject.get(prj).rows.push(row);
  });

  bdgGroups = groups;

  const budgets =
    [...groups.values()];

  /* -------------------------------------------------------
     CALCUL D'UNE LIGNE BUDGET
     ------------------------------------------------------- */

  function budgetData(budget) {
    const first =
      budget.first;

    /*
      BUDGET :
      on privilégie le champ BUDGET.
      PROJET reste en secours tant que
      la source historique ne contient
      pas encore une colonne BUDGET.
    */

    const budgetName =
      budget.project;

    const ht =
      budget.rows.reduce(
        (total, row) =>
          total +
          num(
            firstValue(
              row,
              [
                "MNB",
                "MONTANT HT",
                "MPB HT",
                "MPB"
              ]
            )
          ),
        0
      );

    const tva =
      num(
        firstValue(
          first,
          [
            "TVA",
            "TAUX TVA"
          ]
        )
      );

    const tvaAmount =
      tva
        ? ht *
          tva /
          (
            tva > 1
              ? 100
              : 1
          )
        : 0;

    const ttc =
      ht + tvaAmount;

    const refDate =
      budgetDate(budget.ref);

    const validated =
      refDate ? refDate.label : "";

    const entered = validated;

    /* Intitulé provisoire : nom du projet dans BDS s'il existe */
    const known =
      db.projects.find(
        p =>
          normalise(p.code) ===
          normalise(budgetName)
      );

    const intitule =
      normalise(known?.name) ||
      "À COMPLÉTER";

    return {
      ref:
        budget.ref,

      budget:
        budgetName,

      ht,
      intitule,
      ttc,
      validated,
      entered,

      source:
        budget
    };
  }

  /* -------------------------------------------------------
     COLONNES
     ------------------------------------------------------- */

  const columns = [
    {
      key: "ref",
      title: "RÉFÉRENCE",
      width: 210
    },

    {
      key: "budget",
      title: "PROJET",
      width: 260
    },

    {
      key: "intitule",
      title: "INTITULÉ",
      width: 260
    },

    {
      key: "ttc",
      title: "MONTANT TTC",
      width: 150,
      number: true
    },

    {
      key: "validated",
      title: "VALIDÉ LE",
      width: 140
    },

    {
      key: "entered",
      title: "SAISI LE",
      width: 140
    }
  ];

  /* -------------------------------------------------------
     ÉTAT RECHERCHE / TRI
     ------------------------------------------------------- */

  const state = {
    sortKey: "",
    sortDirection: 1,

    search: {
      ref: "",
      budget: "",
      intitule: "",
      ttc: "",
      validated: "",
      entered: ""
    }
  };

  const thead =
    table.querySelector(
      "thead"
    );

  const tbody =
    table.querySelector(
      "tbody"
    );

  /* -------------------------------------------------------
     ENTÊTES
     ------------------------------------------------------- */

  thead.innerHTML = `
    <tr>

      ${
        columns.map(
          column => `
            <th
              class="
                bdg-list-head
                ${
                  column.number
                    ? "number"
                    : ""
                }
              "
              data-bdg-column="${column.key}"
              style="
                width:${column.width}px;
                min-width:${column.width}px;
              "
            >

              <div
                class="bdg-head-content"
              >

                <span
                  class="bdg-head-label"
                >
                  ${column.title}
                </span>

                <button
                  type="button"
                  class="bdg-head-action"
                  data-bdg-search="${column.key}"
                  title="Rechercher"
                >
                  ⌕
                </button>

                <button
                  type="button"
                  class="bdg-head-action"
                  data-bdg-sort="${column.key}"
                  title="Trier"
                >
                  ↕
                </button>

              </div>

              <span
                class="bdg-column-resizer"
                data-bdg-resize="${column.key}"
              ></span>

            </th>
          `
        ).join("")
      }

      <th
        style="
          width:75px;
          min-width:75px;
        "
      ></th>

    </tr>
  `;

  /* -------------------------------------------------------
     RENDU DES LIGNES
     ------------------------------------------------------- */
  /* ---- PANNEAU DES DATES (à gauche) ---- */

  let dateFilter = "";

  let panel = $("bdgDatePanel");

  if (!panel) {
    const wrap = table.closest(".novapp-budget-table-wrap");
    const layout = document.createElement("div");

    layout.className = "novapp-budget-layout";
    wrap.parentNode.insertBefore(layout, wrap);

    panel = document.createElement("aside");
    panel.id = "bdgDatePanel";
    panel.className = "novapp-date-panel";

    layout.appendChild(panel);
    layout.appendChild(wrap);
  }

  function renderDatePanel() {
    const counts = new Map();

    budgets.forEach(b => {
      const d = budgetDate(b.ref);
      if (!d) return;

      const c = counts.get(d.key) || { label: d.label, n: 0 };
      c.n++;
      counts.set(d.key, c);
    });

    const keys = [...counts.keys()].sort().reverse();

    panel.innerHTML = `
      <div class="novapp-date-head">
        <button type="button" class="novapp-date-filter">TOUT ▾</button>
      </div>
      <div class="novapp-date-list">
        ${keys.map(k => `
          <button type="button" data-date="${k}"
            class="novapp-date-item ${dateFilter === k ? "selected" : ""}">
            <span>${counts.get(k).label}</span>
            <span class="novapp-date-count">${counts.get(k).n}</span>
          </button>
        `).join("")}
      </div>
    `;
  }

  panel.onclick = event => {
    const item = event.target.closest("[data-date]");

    if (item) {
      dateFilter = dateFilter === item.dataset.date ? "" : item.dataset.date;
    } else if (event.target.closest(".novapp-date-filter")) {
      dateFilter = "";
    } else {
      return;
    }

    renderDatePanel();
    renderRows();
  };

  renderDatePanel();


  function renderRows() {
    let data =
      budgets.map(
        budget =>
          budgetData(budget)
      );

    if (dateFilter) {
      data = data.filter(item => {
        const d = budgetDate(item.ref);
        return d && d.key === dateFilter;
      });
    }


     
    /* FILTRES */

    Object.entries(
      state.search
    ).forEach(
      ([key, search]) => {

        const query =
          normalise(search)
            .toLowerCase();

        if (!query) return;

        data =
          data.filter(item => {

            let value =
              item[key];

            if (
              key === "ht" ||
              key === "ttc"
            ) {
              value =
                money(value);
            }

            return normalise(value)
              .toLowerCase()
              .includes(query);
          });
      }
    );

    /* TRI */

    if (state.sortKey) {
      const key =
        state.sortKey;

      data.sort((a, b) => {

        if (
          key === "ht" ||
          key === "ttc"
        ) {
          return (
            (
              num(a[key]) -
              num(b[key])
            ) *
            state.sortDirection
          );
        }

        return (
          normalise(a[key])
            .localeCompare(
              normalise(b[key]),
              "fr",
              {
                numeric: true,
                sensitivity: "base"
              }
            ) *
          state.sortDirection
        );
      });
    }

    if (!data.length) {
      tbody.innerHTML = `
        <tr>
          <td
            colspan="7"
            class="empty"
          >
            AUCUN BUDGET
          </td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML =
      data.map(item => `
        <tr
          data-budget-ref="${esc(item.ref)}"
        >

          <td>
            ${esc(item.ref)}
          </td>

          <td title="${esc(item.budget)}">
            <button
              type="button"
              class="budget-link"
              data-open-project="${esc(item.ref)}"
            >
              ${esc(item.budget)}
            </button>
          </td>

          <td title="${esc(item.intitule)}">
            ${esc(item.intitule)}
          </td>

          <td class="number">
            ${money(item.ttc)}
          </td>

          <td>
            ${esc(item.validated)}
          </td>

          <td>
            ${esc(item.entered)}
          </td>

          <td class="bdg-action-cell">

            <button
              type="button"
              class="bdg-row-action"
              data-print-budget="${esc(item.ref)}"
              title="Imprimer"
              aria-label="Imprimer"
            >
              🖨
            </button>

          </td>

        </tr>
      `).join("");
  }

  /* -------------------------------------------------------
     RESTAURATION D'UN ENTÊTE
     ------------------------------------------------------- */

  function restoreHeader(key) {
    const column =
      columns.find(
        item =>
          item.key === key
      );

    const th =
      thead.querySelector(
        `[data-bdg-column="${key}"]`
      );

    if (!column || !th) return;

    const content =
      th.querySelector(
        ".bdg-head-content"
      );

    if (!content) return;

    let sortIcon = "↕";

    if (
      state.sortKey === key
    ) {
      sortIcon =
        state.sortDirection === 1
          ? "↑"
          : "↓";
    }

    content.innerHTML = `

      <span
        class="bdg-head-label"
      >
        ${column.title}
      </span>

      <button
        type="button"
        class="bdg-head-action"
        data-bdg-search="${key}"
        title="Rechercher"
      >
        ⌕
      </button>

      <button
        type="button"
        class="bdg-head-action"
        data-bdg-sort="${key}"
        title="Trier"
      >
        ${sortIcon}
      </button>
    `;
  }

  /* -------------------------------------------------------
     RECHERCHE DANS L'ENTÊTE
     ------------------------------------------------------- */

  function activateSearch(key) {
    const column =
      columns.find(
        item =>
          item.key === key
      );

    const th =
      thead.querySelector(
        `[data-bdg-column="${key}"]`
      );

    if (!column || !th) return;

    const content =
      th.querySelector(
        ".bdg-head-content"
      );

    if (!content) return;

    content.innerHTML = `
      <input
        type="search"
        class="bdg-column-search"
        data-bdg-search-input="${key}"
        value="${esc(state.search[key])}"
        placeholder="${column.title}"
        autocomplete="off"
      >
    `;

    const input =
      content.querySelector(
        "input"
      );

    if (!input) return;

    input.focus();

    try {
      input.setSelectionRange(
        input.value.length,
        input.value.length
      );
    } catch (_) {}

    input.addEventListener(
      "input",
      () => {

        state.search[key] =
          input.value;

        renderRows();

        /*
          Dès que la zone devient vide,
          on revient à l'intitulé.
        */

        if (
          input.value === ""
        ) {
          restoreHeader(key);
        }
      }
    );

    input.addEventListener(
      "search",
      () => {

        state.search[key] =
          input.value;

        renderRows();

        if (
          input.value === ""
        ) {
          restoreHeader(key);
        }
      }
    );

    input.addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Escape"
        ) {
          state.search[key] = "";
          renderRows();
          restoreHeader(key);
        }
      }
    );
  }

  /* -------------------------------------------------------
     CLICS SUR ENTÊTES
     ------------------------------------------------------- */

  thead.onclick = event => {

    const searchButton =
      event.target.closest(
        "[data-bdg-search]"
      );

    if (searchButton) {
      event.preventDefault();
      event.stopPropagation();

      activateSearch(
        searchButton.dataset
          .bdgSearch
      );

      return;
    }

    const sortButton =
      event.target.closest(
        "[data-bdg-sort]"
      );

    if (sortButton) {
      event.preventDefault();
      event.stopPropagation();

      const key =
        sortButton.dataset
          .bdgSort;

      if (
        state.sortKey === key
      ) {
        state.sortDirection *= -1;

      } else {
        state.sortKey = key;
        state.sortDirection = 1;
      }

      columns.forEach(
        column => {
          if (
            !state.search[
              column.key
            ]
          ) {
            restoreHeader(
              column.key
            );
          }
        }
      );

      renderRows();
    }
  };

  /* -------------------------------------------------------
     LARGEUR DES COLONNES AJUSTABLE
     ------------------------------------------------------- */

  thead
    .querySelectorAll(
      ".bdg-column-resizer"
    )
    .forEach(resizer => {

      resizer.addEventListener(
        "pointerdown",
        event => {

          event.preventDefault();
          event.stopPropagation();

          const th =
            resizer.closest("th");

          if (!th) return;

          const startX =
            event.clientX;

          const startWidth =
            th.getBoundingClientRect()
              .width;

          resizer.classList.add(
            "active"
          );

          try {
            resizer.setPointerCapture(
              event.pointerId
            );
          } catch (_) {}

          const move =
            moveEvent => {

              const newWidth =
                Math.max(
                  80,
                  startWidth +
                  (
                    moveEvent.clientX -
                    startX
                  )
                );

              th.style.width =
                newWidth + "px";

              th.style.minWidth =
                newWidth + "px";
            };

          const stop =
            stopEvent => {

              resizer.classList.remove(
                "active"
              );

              resizer.removeEventListener(
                "pointermove",
                move
              );

              resizer.removeEventListener(
                "pointerup",
                stop
              );

              resizer.removeEventListener(
                "pointercancel",
                stop
              );

              try {
                resizer
                  .releasePointerCapture(
                    stopEvent.pointerId
                  );
              } catch (_) {}
            };

          resizer.addEventListener(
            "pointermove",
            move
          );

          resizer.addEventListener(
            "pointerup",
            stop
          );

          resizer.addEventListener(
            "pointercancel",
            stop
          );
        }
      );
    });

  /* -------------------------------------------------------
     DÉTAIL D'UN BUDGET
     ------------------------------------------------------- */

  function openBudgetDetail(ref) {
    const budget =
      groups.get(ref);

    if (!budget) return;

    const listHTML =
      shell.innerHTML;

    /* ---- lecture tolérante des colonnes (accents, espaces, / ignorés) ---- */

    const nk = s =>
      String(s ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");

    const pick = (row, names) => {
      const keys = Object.keys(row);

      for (const name of names) {
        const target = nk(name);

        const key =
          keys.find(k => nk(k) === target);

        if (
          key !== undefined &&
          normalise(row[key]) !== ""
        ) {
          return row[key];
        }
      }

      return "";
    };

    const colIndex = letter =>
      letter
        .toUpperCase()
        .split("")
        .reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

    const byLetter = (row, letter) =>
      row.__cols
        ? normalise(row.__cols[colIndex(letter)])
        : "";

    const typeKey =
      Object.keys(budget.rows[0] || {})
        .find(k => {
          const n = nk(k);
          return n.includes("CHG") && n.includes("PRD");
        });

    const kindOf = row => {
      const t =
        nk(typeKey ? row[typeKey] : "");

      if (t.startsWith("PRD") || t.startsWith("PROD")) {
        return "prd";
      }

      if (t.startsWith("CHG") || t.startsWith("CHARGE")) {
        return "chg";
      }

      return "";
    };

    const toLine = (row, i) => {
      const kind = kindOf(row);

      const nbr = pick(row, ["NBR"]);

      const dims = [
        pick(row, ["DIM1"]),
        pick(row, ["DIM2"]),
        pick(row, ["DIM3"])
      ];

      const price =
        num(pick(row, ["PUB", "PRIX", "PU"]));

      let qty =
        num(pick(row, ["QTB", "QUANTITE"]));

      if (kind === "prd") {
        const factors =
          [nbr, ...dims]
            .filter(v => normalise(v) !== "")
            .map(num);

        if (factors.length) {
          qty =
            factors.reduce(
              (a, b) => a * b,
              1
            );
        }
      }

      const amount =
        price
          ? qty * price
          : num(pick(row, ["MNB", "MONTANT", "MPB"]));

      return {
        id: "l" + i,
        kind,
        article:
          byLetter(row, "H") || pick(row, ["ARTICLE", "N°"]),
        designation:
          byLetter(row, "I") || pick(row, ["DESIGNATION"]),
        unit:
          byLetter(row, "J") || pick(row, ["UTB", "UNITE"]),
        detail:
          pick(row, ["DETAIL BUDGET"]) ||
          byLetter(row, "I") ||
          pick(row, ["DESIGNATION"]),
        lot: byLetter(row, "K") || pick(row, ["LOT"]),
        prim:
          byLetter(row, "N") ||
          pick(row, ["ACTIVITE PRIMAIRE"]),
        sec:
          byLetter(row, "L") || pick(row, ["ACTIVITE"]),
        cqty: num(byLetter(row, "V")),
        cprice: num(byLetter(row, "W")),
        nbr,
        dims,
        qty,
        price,
        amount,
        tva: 20
      };
    };

    const lines =
      budget.rows.map(toLine);

    const selDesig = new Set();
    /* lignes touchées dans Détail charge / Détail produit */
    const selRows = new Set();

    /* choix faits directement (désignation du haut, lot, tâche) */
    const dDesig = new Set();
    const dH = { lot: new Set(), prim: new Set(), sec: new Set() };
    const hSel = {
      lot: new Set(),
      prim: new Set(),
      sec: new Set()
    };

    const desigKey = l => l.article + "||" + l.designation;

    const inSet = (set, v) => !set.size || set.has(v);

    /* filtres effectifs = choix directs ∪ ce qu'apportent les lignes
       sélectionnées ; un élément n'est retiré que lorsque plus aucune
       sélection active ne s'y rattache */
    const syncSel = () => {
      const fill = (eff, direct) => {
        eff.clear();
        direct.forEach(v => eff.add(v));
      };
      fill(selDesig, dDesig);
      fill(hSel.lot, dH.lot);
      fill(hSel.prim, dH.prim);
      fill(hSel.sec, dH.sec);

      selRows.forEach(id => {
        const l = lines.find(x => x.id === id);
        if (!l) return;
        const add = (set, v) => {
          if (String(v).trim() !== "") set.add(v);
        };
        add(selDesig, desigKey(l));
        add(hSel.lot, l.lot);
        add(hSel.prim, l.prim);
        add(hSel.sec, l.sec);
      });
    };

    /* retire un élément précis : son choix direct et les lignes
       sélectionnées qui l'apportaient */
    const dropValue = (field, direct, v) => {
      direct.delete(v);
      [...selRows].forEach(id => {
        const l = lines.find(x => x.id === id);
        if (l && field(l) === v) selRows.delete(id);
      });
    };

    /* tableau du haut : filtré seulement par la hiérarchie */
    const clientLines = () =>
      lines.filter(l =>
        inSet(hSel.lot, l.lot) &&
        inSet(hSel.prim, l.prim) &&
        inSet(hSel.sec, l.sec)
      );

    /* onglets du bas : désignations ET hiérarchie */
    const visibleLines = () =>
      clientLines().filter(l =>
        inSet(selDesig, desigKey(l))
      );

    const byKindNow = () => {
      const v = visibleLines();
      return {
        chg: v.filter(l => l.kind === "chg"),
        prd: v.filter(l => l.kind === "prd")
      };
    };

    const unclassified =
      lines.filter(l => !l.kind).length;

    const tabs = [
      { key: "chg", title: "DÉTAIL CHARGE" },
      { key: "prd", title: "DÉTAIL PRODUIT" },
      { key: "qlt", title: "DÉTAIL QUALITÉ" },
      { key: "dly", title: "DÉTAIL DÉLAI" }
    ];

    let active = "chg";

    /* ---- squelette de l'écran ---- */

    shell.innerHTML = `

      <div class="bdg-d-sticky">

      <div class="novapp-list-titlebar">

        <button
          type="button"
          class="novapp-menu open-menu"
          aria-label="Menu"
        >
          ☰
        </button>

        <button
          type="button"
          id="budgetBackBtn"
          class="novapp-menu"
          aria-label="Retour"
        >
          ←
        </button>

        <h1 class="bdg-d-h1">
          ${esc(budget.project)}
        </h1>

        <div></div>

      </div>

      <div class="bdg-d-head">

        <div class="bdg-d-ref">
          <span>${esc(ref)}</span>
          <span class="bdg-d-badge" title="Historique">H</span>
        </div>

        <div class="bdg-d-pills">
          <span class="bdg-d-pill">DOC</span>
          <span class="bdg-d-pill">TAF</span>
          <span class="bdg-d-pill">OBS</span>
          <span class="bdg-d-pill">INF</span>
        </div>

      </div>
      </div>

      <div class="bdg-d-page">

        <div class="bdg-d-block">
          <div class="bdg-d-block-title">
            DÉSIGNATIONS CLIENT
          </div>
          <div class="bdg-d-scroll bdg-d-client-scroll">
            <table class="bdg-d-table">
              <thead>
                <tr>
                  <th class="center">ARTICLE</th>
                  <th>DÉSIGNATION</th>
                  <th>UNITÉ</th>
                  <th class="number">QUANTITÉ</th>
                  <th class="number">PRIX</th>
                  <th class="number">MONTANT HT</th>
                  <th class="number">TVA</th>
                  <th class="number">MONTANT TTC</th>
                </tr>
              </thead>
              <tbody id="bdgClientBody"></tbody>
            </table>
          </div>
        </div>

        <div class="bdg-d-block">
          <div class="bdg-d-block-title">
            LOTS / TÂCHES
            <span id="bdgFilterInfo" class="bdg-d-fi"></span>
          </div>
          <div class="bdg-h-grid" id="bdgHier"></div>
        </div>

        <div class="bdg-d-tabs" id="bdgTabs">
          ${
            tabs.map(t => `
              <button
                type="button"
                class="bdg-d-tab"
                data-tab="${t.key}"
              >
                ${t.title}
              </button>
            `).join("")
          }
        </div>

        <div class="bdg-d-block bdg-d-tabbody" id="bdgTabBody"></div>

        <details class="bdg-d-debug">
          <summary>Colonnes détectées dans l'onglet BDG</summary>
          <div>
            ${esc(Object.keys(budget.rows[0] || {}).join(" | "))}
            <br>
            Colonne charge/produit :
            ${esc(typeKey || "INTROUVABLE")}
            — lignes non classées : ${unclassified}
          </div>
        </details>

      </div>
    `;

    const body = $("bdgTabBody");

    const renderClient = () => {
      const groupsMap = new Map();

      clientLines().forEach(l => {
        const key = desigKey(l);

        if (!groupsMap.has(key)) {
          groupsMap.set(key, {
            key,
            article: l.article,
            designation: l.designation,
            unit: l.unit,
            qty: 0,
            price: 0,
            hasKey: false
          });
        }

        const g = groupsMap.get(key);

        /* quantité = somme des lignes PRODUIT ayant une tâche primaire */
        if (l.kind === "prd" && String(l.prim).trim() !== "") {
          g.qty += l.cqty;
        }

      });

      /* clé primaire = ligne au prix non nul (cherchée sur toutes
         les lignes de la désignation, même hors filtre) */
      groupsMap.forEach(g => {
        /* prix client = prix (col. W) d'une ligne PRODUIT uniquement ;
           les lignes CHARGE (coûts internes) sont ignorées */
        const k = lines.find(l =>
          desigKey(l) === g.key &&
          l.kind === "prd" &&
          l.cprice !== 0
        );

        if (k) {
          g.price = k.cprice;
          g.unit = k.unit || g.unit;
        }
      });

      const list = [...groupsMap.values()].sort((x, y) =>
        String(x.article).localeCompare(
          String(y.article),
          undefined,
          { numeric: true }
        )
      );

      const MIN_ROWS = 10;

      const filler = n =>
        Array.from({ length: Math.max(0, n) }, () =>
          `<tr class="bdg-d-filler">${"<td>&nbsp;</td>".repeat(8)}</tr>`
        ).join("");

      $("bdgClientBody").innerHTML =
        (list.length
          ? list.map(g => {
              const ht = g.qty * g.price;


              return `
                <tr data-desig="${esc(g.key)}"
                    class="${selDesig.has(g.key) ? "selected" : ""}">
                  <td class="center">${esc(g.article)}</td>
                  <td>${esc(g.designation)}</td>
                  <td>${esc(g.unit)}</td>
                  <td class="number">${money(g.qty)}</td>
                  <td class="number">${money(g.price)}</td>
                  <td class="number">${money(ht)}</td>
                  <td class="number">20,00 %</td>
                  <td class="number">${money(ht * 1.2)}</td>
                </tr>
              `;
            }).join("") + filler(MIN_ROWS - list.length)
          : `<tr><td colspan="8" class="empty">AUCUNE DÉSIGNATION</td></tr>` +
            filler(MIN_ROWS - 1));
    };

    const uniq = arr =>
      [...new Set(arr.filter(v => String(v).trim() !== ""))]
        .sort((x, y) =>
          String(x).localeCompare(String(y), undefined, { numeric: true })
        );

    /* filtre dans tous les sens : chaque colonne affiche les valeurs
       des lignes qui respectent TOUS les AUTRES filtres (désignations,
       lots, primaires, secondaires) ; plusieurs choix = union */
    const passes = (l, skip) =>
      (skip === "desig" || inSet(selDesig, desigKey(l))) &&
      (skip === "lot"   || inSet(hSel.lot, l.lot)) &&
      (skip === "prim"  || inSet(hSel.prim, l.prim)) &&
      (skip === "sec"   || inSet(hSel.sec, l.sec));

    const hierLists = () => ({
      lots:  uniq(lines.filter(l => passes(l, "lot")).map(l => l.lot)),
      prims: uniq(lines.filter(l => passes(l, "prim")).map(l => l.prim)),
      secs:  uniq(lines.filter(l => passes(l, "sec")).map(l => l.sec))
    });

    /* retire des filtres les éléments devenus invisibles
       (répété jusqu'à stabilité) */
    const pruneHier = () => {
      for (let guard = 0; guard < 5; guard++) {
        syncSel();
        const h = hierLists();
        let changed = false;
        const drop = (set, list) => [...set].forEach(v => {
          if (!list.includes(v)) { set.delete(v); changed = true; }
        });
        drop(dH.lot, h.lots);
        drop(dH.prim, h.prims);
        drop(dH.sec, h.secs);
        if (!changed) break;
      }
      syncSel();
    };

    const renderHier = () => {
      const { lots, prims, secs } = hierLists();

      const hFill = n =>
        `<div class="bdg-h-fill"></div>`.repeat(Math.max(0, n));

      const col = (title, level, items) => `
        <div class="bdg-h-col">
          <div class="bdg-h-head">${title}</div>
          ${
            items.length
              ? items.map(v => `
                  <div class="bdg-h-item ${hSel[level].has(v) ? "selected" : ""}"
                       data-h="${level}"
                       data-v="${esc(v)}"
                       title="${esc(stripLevelPrefix(v))}">${esc(stripLevelPrefix(v))}</div>
                `).join("") + hFill(5 - items.length)
              : `<div class="bdg-h-item" style="opacity:.5;cursor:default">—</div>` + hFill(4)
          }
        </div>
      `;

      $("bdgHier").innerHTML =
        col("LOT", "lot", lots) +
        col("TÂCHE PRIMAIRE", "prim", prims) +
        col("TÂCHE SECONDAIRE", "sec", secs);

      const info = [];
      if (hSel.lot.size) info.push(hSel.lot.size + " LOT(S)");
      if (hSel.prim.size) info.push(hSel.prim.size + " T. PRIMAIRE(S)");
      if (hSel.sec.size) info.push(hSel.sec.size + " T. SECONDAIRE(S)");

      $("bdgFilterInfo").textContent =
        info.length ? "FILTRES : " + info.join(" › ") : "";
    };

    const refreshAll = () => {
      pruneHier();

      renderClient();
      renderHier();
      renderTab();
    };

    const tvaFor = l => l.amount * l.tva / 100;

    const totalsHTML = list => {
      const ht =
        list.reduce((t, l) => t + l.amount, 0);

      const tva =
        list.reduce((t, l) => t + tvaFor(l), 0);

      return `
        <div class="bdg-d-totals">
          <div>
            <span>MONTANT HORS TAXE</span>
            <strong id="bdgTotHT">${money(ht)}</strong>
          </div>
          <div>
            <span>MONTANT TVA</span>
            <strong id="bdgTotTVA">${money(tva)}</strong>
          </div>
          <div class="bdg-d-total-ttc">
            <span>MONTANT TTC</span>
            <strong id="bdgTotTTC">${money(ht + tva)}</strong>
          </div>
        </div>
      `;
    };

    const renderTab = () => {
      shell
        .querySelectorAll(".bdg-d-tab")
        .forEach(b =>
          b.classList.toggle(
            "active",
            b.dataset.tab === active
          )
        );

      if (active === "chg" || active === "prd") {
        const list = byKindNow()[active];
        const prd = active === "prd";
        const cols = prd ? 12 : 8;

        const rowsHTML =
          list.map(l => `
            <tr data-row="${l.id}"
                class="${selRows.has(l.id) ? "selected" : ""}">
              <td class="center">${esc(l.article)}</td>
              <td>${esc(l.detail)}</td>
              <td>${esc(l.unit)}</td>
              ${
                prd
                  ? `
                    <td class="number">${esc(l.nbr)}</td>
                    <td class="number">${esc(l.dims[0])}</td>
                    <td class="number">${esc(l.dims[1])}</td>
                    <td class="number">${esc(l.dims[2])}</td>
                  `
                  : ""
              }
              <td class="number">${money(l.qty)}</td>
              <td class="number">${money(l.price)}</td>
              <td class="number">${money(l.amount)}</td>
              <td class="number">
                <input
                  type="number"
                  class="bdg-tva-input"
                  data-line="${l.id}"
                  value="${l.tva}"
                  min="0"
                  step="0.01"
                >
              </td>
              <td class="number" data-ttc="${l.id}">
                ${money(l.amount + tvaFor(l))}
              </td>
            </tr>
          `).join("");

        body.innerHTML = `
          <div class="bdg-d-scroll">
            <table class="bdg-d-table">
              <thead>
                <tr>
                  <th class="center">ARTICLE</th>
                  <th>DÉSIGNATION</th>
                  <th>UNITÉ</th>
                  ${
                    prd
                      ? `
                        <th class="number">NBR</th>
                        <th class="number">DIM 1</th>
                        <th class="number">DIM 2</th>
                        <th class="number">DIM 3</th>
                      `
                      : ""
                  }
                  <th class="number">QUANTITÉ</th>
                  <th class="number">PRIX</th>
                  <th class="number">MONTANT HT</th>
                  <th class="number">TVA %</th>
                  <th class="number">MONTANT TTC</th>
                </tr>
              </thead>
              <tbody>
                ${
                  rowsHTML ||
                  `<tr><td colspan="${cols}" class="empty">
                    ${prd ? "AUCUN PRODUIT" : "AUCUNE CHARGE"}
                  </td></tr>`
                }
              </tbody>
            </table>
          </div>
          ${totalsHTML(list)}
        `;

        return;
      }

      if (active === "qlt") {
        body.innerHTML = `
          <div class="bdg-d-reserved">
            Espace réservé — contenu à définir.
          </div>
        `;

        return;
      }

      body.innerHTML = `
        <div class="bdg-d-delay">
          <label>
            DATE DÉBUT
            <input type="date" id="bdgDelayStart">
          </label>
          <label>
            DATE FIN
            <input type="date" id="bdgDelayEnd">
          </label>
          <label>
            DÉLAI
            <div id="bdgDelayDays">—</div>
          </label>
        </div>
      `;
    };

    shell.onclick = event => {
      const tab =
        event.target.closest("[data-tab]");

      if (tab) {
        active = tab.dataset.tab;
        renderTab();
        return;
      }

      /* ligne de Détail charge / Détail produit : filtre tout l'écran
         sur sa désignation, son lot, sa primaire et sa secondaire
         (re-toucher la ligne retire ces filtres) */
      const lineRow = event.target.closest("tr[data-row]");

      if (lineRow && !event.target.closest("input")) {
        const id = lineRow.dataset.row;

        if (selRows.has(id)) {
          selRows.delete(id);
        } else {
          selRows.add(id);
        }

        refreshAll();
        return;
      }

      const h = event.target.closest("[data-h]");

      if (h) {
        const level = h.dataset.h;
        const v = h.dataset.v;

        if (hSel[level].has(v)) {
          dropValue(l => l[level], dH[level], v);
        } else {
          dH[level].add(v);
        }

        refreshAll();
        return;
      }

      const dRow = event.target.closest("[data-desig]");

      if (dRow) {
        const k = dRow.dataset.desig;

        if (selDesig.has(k)) {
          dropValue(l => desigKey(l), dDesig, k);
        } else {
          dDesig.add(k);
        }

        refreshAll();
      }
    };

    shell.oninput = event => {
      const input =
        event.target.closest(".bdg-tva-input");

      if (input) {
        const line =
          lines.find(l => l.id === input.dataset.line);

        if (line) {
          line.tva = num(input.value);

          const cell =
            shell.querySelector(
              `[data-ttc="${line.id}"]`
            );

          if (cell) {
            cell.textContent =
              money(line.amount + tvaFor(line));
          }

          const list = byKindNow()[active] || [];

          const ht =
            list.reduce((t, l) => t + l.amount, 0);

          const tva =
            list.reduce((t, l) => t + tvaFor(l), 0);

          $("bdgTotHT").textContent = money(ht);
          $("bdgTotTVA").textContent = money(tva);
          $("bdgTotTTC").textContent = money(ht + tva);

          renderClient();
        }

        return;
      }

      if (
        event.target.id === "bdgDelayStart" ||
        event.target.id === "bdgDelayEnd"
      ) {
        const a = $("bdgDelayStart").value;
        const b = $("bdgDelayEnd").value;

        if (a && b) {
          const days =
            Math.round(
              (new Date(b) - new Date(a)) /
              86400000
            );

          $("bdgDelayDays").textContent =
            days + " JOUR" + (Math.abs(days) > 1 ? "S" : "");
        } else {
          $("bdgDelayDays").textContent = "—";
        }
      }
    };

    refreshAll();

    $("budgetBackBtn")
      ?.addEventListener(
        "click",
        () => {
          shell.onclick = null;
          shell.oninput = null;
          shell.innerHTML = listHTML;
          renderBudgetList();
        }
      );
  }

  /* -------------------------------------------------------
     APERÇU / IMPRESSION
     ------------------------------------------------------- */

  table.onclick = event => {

    const projectLink =
      event.target.closest(
        "[data-open-project]"
      );

    if (projectLink) {
      event.preventDefault();

      openProjectPopup(
        projectLink.dataset
          .openProject
      );

      return;
    }

    const printButton =
      event.target.closest(
        "[data-print-budget]"
      );

    if (printButton) {
      event.preventDefault();

      printBudgetPDF(
        printButton.dataset
          .printBudget
      );

      return;
    }

    const row =
      event.target.closest(
        "tr[data-budget-ref]"
      );

    if (row) {
      openBudgetDetail(
        row.dataset.budgetRef
      );
    }
  };

  /* -------------------------------------------------------
     PREMIER AFFICHAGE
     ------------------------------------------------------- */

  renderRows();
}

function budgetTotals(group) {
  const ht =
    group.rows.reduce(
      (total, row) =>
        total +
        num(
          firstValue(
            row,
            ["MNB", "MONTANT HT", "MPB HT", "MPB"]
          )
        ),
      0
    );

  const tva =
    num(
      firstValue(
        group.first,
        ["TVA", "TAUX TVA"]
      )
    );

  const tvaAmount =
    tva
      ? ht * tva / (tva > 1 ? 100 : 1)
      : 0;

  return { ht, tvaAmount, ttc: ht + tvaAmount };
}

function printBudgetPDF(ref) {
  const group = bdgGroups.get(ref);

  if (!group || !group.rows.length) {
    alert("Budget introuvable.");
    return;
  }

  const totals = budgetTotals(group);

  const lines = group.rows.map((row, index) => {
    const type =
      firstValue(row, ["CHG/PRD", "TYPE"]);

    const detail =
      firstValue(
        row,
        ["DETAIL BUDGET", "DESIGNATION", "DÉSIGNATION"]
      );

    const unit =
      firstValue(row, ["UTB", "UNITE", "UNITÉ"]);

    const qty =
      firstValue(
        row,
        ["QTB", "QUANTITE", "QUANTITÉ", "NBR"]
      );

    const price =
      firstValue(row, ["PUB", "PRIX", "PU"]);

    const amount =
      firstValue(row, ["MNB", "MONTANT", "MPB"]);

    return `
      <tr>
        <td>${index + 1}</td>
        <td>${esc(type)}</td>
        <td>${esc(detail)}</td>
        <td>${esc(unit)}</td>
        <td class="n">${esc(qty)}</td>
        <td class="n">${money(price)}</td>
        <td class="n">${money(amount)}</td>
      </tr>
    `;
  }).join("");

  const printWindow =
    window.open("", "_blank");

  if (!printWindow) {
    alert("Impossible d'ouvrir le document. Autorisez les fenêtres pop-up.");
    return;
  }

  printWindow.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${esc(ref)} - ${esc(group.project)}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #555; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #bbb; padding: 5px 6px; text-align: left; }
  th { background: #eee; }
  .n { text-align: right; white-space: nowrap; }
  tfoot td { font-weight: bold; background: #f6f6f6; }
  @media print { body { margin: 10mm; } }
</style>
</head>
<body>
  <h1>${esc(ref)}</h1>
  <div class="sub">Projet : ${esc(group.project)}</div>
  <table>
    <thead>
      <tr>
        <th>N°</th><th>TYPE</th><th>DÉTAIL BUDGET</th>
        <th>UNITÉ</th><th class="n">QUANTITÉ</th>
        <th class="n">PRIX</th><th class="n">MONTANT</th>
      </tr>
    </thead>
    <tbody>${lines}</tbody>
    <tfoot>
      <tr><td colspan="6">TOTAL HT</td><td class="n">${money(totals.ht)}</td></tr>
      <tr><td colspan="6">TVA</td><td class="n">${money(totals.tvaAmount)}</td></tr>
      <tr><td colspan="6">TOTAL TTC</td><td class="n">${money(totals.ttc)}</td></tr>
    </tfoot>
  </table>
</body>
</html>`);

  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    try { printWindow.print(); } catch (_) {}
  }, 400);
}

function openProjectPopup(ref) {
  const group = bdgGroups.get(ref);

  if (!group) return;

  const known =
    db.projects.find(
      p =>
        normalise(p.code) ===
        normalise(group.project)
    );

  const intitule =
    normalise(known?.name) ||
    "À COMPLÉTER";

  const old = $("bdgProjectPopup");
  if (old) old.remove();

  const back = document.createElement("div");
  back.id = "bdgProjectPopup";
  back.className = "bdg-popup-back";

  back.innerHTML = `
    <div class="bdg-popup">
      <div class="bdg-popup-head">
        <span>FICHE PROJET</span>
        <button type="button" class="bdg-popup-close" aria-label="Fermer">✕</button>
      </div>
      <div class="bdg-popup-body">
        <div class="bdg-popup-field">
          <label>RÉFÉRENCE</label>
          <div>${esc(ref)}</div>
        </div>
        <div class="bdg-popup-field">
          <label>PROJET (ABRÉVIATION)</label>
          <div>${esc(group.project)}</div>
        </div>
        <div class="bdg-popup-field">
          <label>INTITULÉ</label>
          <div>${esc(intitule)}</div>
        </div>
        <div class="bdg-popup-field">
          <label>CLIENT</label>
          <div>À COMPLÉTER</div>
        </div>
        <div class="bdg-popup-note">
          Fiche provisoire : les champs seront modifiables dans le futur module Projets.
        </div>
      </div>
    </div>
  `;

  back.addEventListener("click", e => {
    if (
      e.target === back ||
      e.target.closest(".bdg-popup-close")
    ) {
      back.remove();
    }
  });

  document.body.appendChild(back);
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



document.addEventListener("click", e => {
  const menu = $("navMenu");
  if (!menu) return;
  const opener = e.target.closest(".open-menu");
  if (opener) {
    const r = opener.getBoundingClientRect();
    menu.style.left = r.left + "px";
    menu.style.top = (r.bottom + 6) + "px";
    menu.classList.toggle("hidden");
    return;
  }
  menu.classList.add("hidden");
});




function budgetDate(ref) {
  const m = String(ref).match(/(\d{2})-(\d{2})(\d{2})\s*\/\s*\d+/);

  if (!m) return null;

  return {
    key: "20" + m[1] + "-" + m[2] + "-" + m[3],
    label: m[3] + "/" + m[2] + "/20" + m[1]
  };
}
