@verbatim/* =========================================================
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
          /* dernier module ouvert, retrouvé à la prochaine ouverture */
          try { localStorage.setItem("svi_view_v1", btn.dataset.view || ""); } catch (e) {}

          const view =
            $(btn.dataset.view);

          if (view) {
            view.classList.add(
              "active-view"
            );
          }

          $("pageSubtitle").textContent =
            btn.dataset.view === "chs"
              ? "VERSION 2 — PARAMÉTRAGE"
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

  /* FORMAT 83 : recherche active → « retenues/total » */
  $("chsCount").innerHTML = svCnt(rows.length, db.chs.length);

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
    title: "ACTIVITÉ PRIMAIRE",
    type: "PRIMARY"
  },

  secondary: {
    arr: "secondaries",
    list: "secondaryList",
    parent: "primary",
    fk: "primaryId",
    title: "ACTIVITÉ SECONDAIRE",
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

      sviAlert(
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
    return sviAlert(
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
      `ACTIVITÉ PRIMAIRE : ${
        getBy(
          "primary",
          selection.primary
        )?.name || ""
      }`
    );
  }

  if (selection.secondary) {
    parts.push(
      `ACTIVITÉ SECONDAIRE : ${
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
      : "SÉLECTIONNEZ UNE ACTIVITÉ SECONDAIRE";
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
                  : "SÉLECTIONNEZ UNE ACTIVITÉ SECONDAIRE"
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
    return sviAlert(
      "SÉLECTIONNEZ D'ABORD UNE ACTIVITÉ SECONDAIRE"
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

@endverbatim