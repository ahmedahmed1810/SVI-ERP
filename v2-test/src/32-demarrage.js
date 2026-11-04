/* =========================================================
   DEMARRAGE
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    initNav();

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

    /* v914 : BDS et CHS supprimés — plus de lecture de leurs données au démarrage */

    /* retour au dernier module ouvert (CHS, BDS, BDG…) */
    try {
      const v = localStorage.getItem("svi_view_v1");
      const b = v && document.querySelector(`.nav-btn[data-view="${v}"]`);
      if (b && !b.classList.contains("active")) b.click();
    } catch (e) {}
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
    try { sessionStorage.setItem("svi_navgrp_" + grp.dataset.grp + "_v1", open ? "1" : ""); } catch (err) {}   /* v785 : gardé pendant la séance seulement */
    return;
  }
  const off = e.target.closest("#navMenu .nav-off");
  if (off) { svToast(off.dataset.why || "", 3000, off); return; }
  const opener = e.target.closest(".open-menu");
  if (opener) {
    const r = opener.getBoundingClientRect();
    menu.style.left = r.left + "px";
    menu.style.top = (r.bottom + 6) + "px";
    /* v752 : menu assez large pour cacher le premier tableau derrière lui (panneau des dates de la liste des budgets) */
    { const pn = document.getElementById("bdgDatePanel"), pr = pn && pn.offsetParent ? pn.getBoundingClientRect() : null;
      menu.style.width = Math.max(210, pr && pr.width ? Math.round(pr.right - r.left) + 2 : 0) + "px"; }
    menu.classList.toggle("hidden");
    /* groupe déplié la dernière fois (ou contenant le module ouvert) : déplié à l'ouverture du menu */
    menu.querySelectorAll(".nav-grp").forEach(g => { const sub = menu.querySelector(`.nav-sub[data-grp="${g.dataset.grp}"]`); if (!sub) return;
      /* v785 : au lancement de l'application, tout est plié (achats compris) ; pendant la séance, ce qui a été ouvert reste ouvert */
      let o = false; try { o = !!sessionStorage.getItem("svi_navgrp_" + g.dataset.grp + "_v1"); } catch (err) {}
      sub.hidden = !o; g.setAttribute("aria-expanded", o ? "true" : "false"); });
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



/* v916 (mission ALLÈGEMENT, étape 2) : le module ACHATS (app-achats.js) n'est plus chargé au démarrage —
   il se charge tout seul dès que l'écran est prêt (temps libre), et au plus tard au premier toucher d'une entrée ACHATS
   (le toucher est rejoué une fois le module chargé). Même numéro de version que app.js. */
let SVI_ACH_P = null;
const sviAchLoad = () => {
  if (typeof sviAchInit === "function") return Promise.resolve();
  if (SVI_ACH_P) return SVI_ACH_P;
  const me = [...document.scripts].find(s => /\/app\.js(\?|$)/.test(s.src));
  const q = me && me.src.includes("?") ? me.src.slice(me.src.indexOf("?")) : "";
  SVI_ACH_P = new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = "app-achats.js" + q; s.async = false;
    s.onload = () => setTimeout(ok, 0);   /* après le démarrage du module (41 : setTimeout) */ s.onerror = () => { SVI_ACH_P = null; s.remove(); ko(new Error("ACHATS")); };
    document.head.appendChild(s);
  });
  return SVI_ACH_P;
};
window.sviAchLoad = sviAchLoad;
document.addEventListener("click", e => {
  if (typeof sviAchInit === "function") return;
  const b = e.target && e.target.closest && e.target.closest('[data-ach], .nav-btn[data-view="ach"]');
  if (!b) return;
  e.preventDefault(); e.stopImmediatePropagation();
  sviAchLoad().then(() => b.click()).catch(() => { try { svToast("ACHATS : CHARGEMENT IMPOSSIBLE — VÉRIFIER LA CONNEXION ET RÉESSAYER.", 4000); } catch (er) {} });
}, true);
{ const go = () => { try { sviAchLoad().catch(() => {}); } catch (e) {} };
  const idle = () => (window.requestIdleCallback ? requestIdleCallback(go, { timeout: 1500 }) : setTimeout(go, 300));
  if (document.readyState === "complete") idle(); else window.addEventListener("load", idle); }

/* v927 (remarque 13 du 04/11/2026) : ÉCRAN D'ACCUEIL — nom de l'utilisateur, menu ☰, ⋯ = RÉGLAGES COMMUNS (tout le programme) */
const sviHomeDraw = () => { const u = document.getElementById("homeUser"); if (u) { let n = ""; try { n = sviUser(); } catch (e) {} u.textContent = n ? "UTILISATEUR : " + n : ""; }
  const b = document.getElementById("homeBody"); if (b && !b.childElementCount) b.innerHTML = `<div class="home-note">MENU ☰ : BUDGET, ACHATS, PARAMÉTRAGE, DONNÉES SOURCES. ⋯ : RÉGLAGES COMMUNS DU FORMAT (TOUT LE PROGRAMME).</div>`; };
document.addEventListener("click", e => {
  const m = e.target.closest && e.target.closest("#homeMore"); if (!m) return; e.stopPropagation();
  sviHdrMenu(m, [[{ k: "__fmtall", lab: "RÉGLAGES COMMUNS (FORMAT DE TOUT LE PROGRAMME)", ic: SVI_MI.__fmt }]], a => { if (a === "__fmtall") sviFmtWin(null); });
}, true);
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(sviHomeDraw, 50)); else setTimeout(sviHomeDraw, 50);
document.addEventListener("click", e => { if (e.target.closest && e.target.closest('.nav-btn[data-view="home"]')) setTimeout(sviHomeDraw, 0); });
