/* =========================================================
   DEMARRAGE
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    initNav();

    $("brdSearch")
      ?.addEventListener(
        "input",
        renderBrd
      );

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
              await svConfirm({ title: "SUPPRIMER", text: "LA LIGNE SERA SUPPRIMÉE.", ok: "SUPPRIMER" })
            ) {
              await deleteRow(
                rowContext
              );
            }

            if (
              action === "edit"
            ) {
              if (
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
            sviAlert(
              err.message ||
              String(err)
            );
          }
        }
      );

    /* v746 (rapidité) : données BDS lues en parallèle — le dernier module (BDG…) s'ouvre sans attendre Google */
    const boot = reloadAll();

    /* retour au dernier module ouvert (CHS, BDS, BDG…) */
    try {
      const v = localStorage.getItem("svi_view_v1");
      const b = v && document.querySelector(`.nav-btn[data-view="${v}"]`);
      if (b && !b.classList.contains("active")) b.click();
    } catch (e) {}
    await boot;
  }
);



document.addEventListener("click", e => {
  const menu = $("navMenu");
  if (!menu) return;
  /* v750 : ACHAT se déplie / se replie sans fermer le menu ; une entrée pas encore faite (grisée) dit pourquoi */
  const grp = e.target.closest("#navMenu .nav-grp");
  if (grp) {
    const sub = menu.querySelector(`.nav-sub[data-grp="${grp.dataset.grp}"]`), open = !!sub && sub.hidden;
    if (sub) sub.hidden = !open;
    grp.setAttribute("aria-expanded", open ? "true" : "false");
    try { localStorage.setItem("svi_navgrp_" + grp.dataset.grp + "_v1", open ? "1" : ""); } catch (err) {}
    return;
  }
  const off = e.target.closest("#navMenu .nav-off");
  if (off) { svToast(off.dataset.why || "", 3000, off); return; }
  const opener = e.target.closest(".open-menu");
  if (opener) {
    const r = opener.getBoundingClientRect();
    menu.style.left = r.left + "px";
    menu.style.top = (r.bottom + 6) + "px";
    menu.classList.toggle("hidden");
    /* groupe déplié la dernière fois (ou contenant le module ouvert) : déplié à l'ouverture du menu */
    menu.querySelectorAll(".nav-grp").forEach(g => { const sub = menu.querySelector(`.nav-sub[data-grp="${g.dataset.grp}"]`); if (!sub) return;
      let o = false; try { o = !!localStorage.getItem("svi_navgrp_" + g.dataset.grp + "_v1"); } catch (err) {}
      o = o || !!sub.querySelector(".nav-btn.active"); sub.hidden = !o; g.setAttribute("aria-expanded", o ? "true" : "false"); });
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


