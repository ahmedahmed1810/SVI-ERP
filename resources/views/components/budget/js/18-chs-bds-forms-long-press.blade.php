@verbatim/* =========================================================
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
        sviAlert(
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

  sviAlert(lines);
}

@endverbatim