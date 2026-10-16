@verbatim/* =========================================================
   BOOTSTRAP CHS / BDS
   ========================================================= */

function mapBootstrap(data) {
  db.chs = (data.chs || []).map(x => ({
    id: x.ID,
    article: x.ARTICLE,
    designation: x.DESIGNATION,
    unit: x.UNITE,
    pcs: num(x.PCS),
    /* colonne TVA (à créer dans la feuille CHS) : vide = 20 % */
    tva: x.TVA === undefined || x.TVA === "" ? 20 : num(x.TVA)
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
    sviAlert(
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

@endverbatim