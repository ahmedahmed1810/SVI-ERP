    /* ===== état mémorisé sur l'appareil, par budget ===== */
    const ST_KEY = "svi_bdgstate_v1:" + String(ref);

    const stateSave = () => {
      try {
        const cf = {};
        Object.entries(CF).forEach(([t, st]) => {
          const f = {};
          Object.entries(st.f).forEach(([k, set]) => { f[k] = set && set.cond ? { vals: set.vals ? [...set.vals] : null, cond: set.cond } : [...set]; });   /* v510 : condition gardée */
          cf[t] = { sort: st.sort, f };
        });
        localStorage.setItem(ST_KEY, JSON.stringify({
          cf,
          desig: [...selDesig],
          rows: [...selRows],
          h: { lot: [...hSel.lot], prim: [...hSel.prim], sec: [...hSel.sec] }
        }));
      } catch (e) {}
    };

    const stateLoad = () => {
      let st = null;
      try { st = JSON.parse(localStorage.getItem(ST_KEY) || "null"); }
      catch (e) { st = null; }

      if (!st) {
        /* première ouverture : Détail charge / produit par désignation
           (désignations client par article, lots / tâches par ordre BDS) */
        cfT("chg").sort = { col: "detail", dir: "asc", def: true };
        cfT("prd").sort = { col: "detail", dir: "asc", def: true };
        return;
      }

      Object.entries(st.cf || {}).forEach(([t, v]) => {
        const x = cfT(t);
        x.sort = v.sort || null;
        x.f = {};
        Object.entries(v.f || {}).forEach(([k, arr]) => { x.f[k] = Array.isArray(arr) ? new Set(arr) : arr && arr.cond ? cfMakeF(arr.vals ? new Set(arr.vals) : null, arr.cond) : new Set(); });
      });
      (st.desig || []).forEach(v => selDesig.add(v));
      (st.rows || []).forEach(v => selRows.add(v));
      ["lot", "prim", "sec"].forEach(k =>
        ((st.h || {})[k] || []).forEach(v => hSel[k].add(v))
      );
    };

    sviStep("RÉGLAGES DU BUDGET"); stateLoad();
    sviStep("DISPOSITION"); layInit();
    sviStep("CALCULS ET DESSIN"); refreshAll();
    sviStep("OUVERT");
    {
      const n = docsLoad().length;
      updPill("doc");
      updPill("obs");
      updPill("taf");
    }

    $("budgetBackBtn")
      ?.addEventListener(
        "click",
        () => {
          if (typeof sviLockClose === "function") sviLockClose();   /* v672 (bloc 2) */
          window.__sviSyncReopen = null;
          shell.onclick = null;
          shell.oninput = null;
          /* retour volontaire à la liste : elle sera l'écran d'ouverture */
          try { localStorage.removeItem("svi_lastbdg_v1"); } catch (e) {}
          if (window.__sviViewSave) window.__sviViewSave();
          window.__sviBdgLive = null;
          setTimeout(() => window.__sviViewRestore && window.__sviViewRestore("list:bdg"), 0);
          shell.innerHTML = listHTML;
          renderBudgetList();
        }
      );

    /* budget en instance : ‹ › navigation, 🔒 figer / revenir en édition, 🗑 supprimer, ✕ fermer */
    if (budget.inst && budget.inst.state !== "valide") {
      const toList = () => $("budgetBackBtn")?.click();
      const instUpd = fn => {
        try {
          const l = sviInstGet();
          const out = fn(l);
          sviInstSet(out);
        } catch (e) {}
      };
      const go = d => {
        const nav = window.__sviBdgNav;
        if (!nav) return;
        const j = nav.refs.indexOf(nav.cur) + d;
        if (j >= 0 && j < nav.refs.length) nav.open(nav.refs[j]);
      };
      /* sortie avec une liaison modifiée non validée : on propose de valider d'abord */
      const guarded = fn => () => (shell.__lkGuard ? shell.__lkGuard() : Promise.resolve(true)).then(ok => { if (ok) fn(); });
      $("instPrev")?.addEventListener("click", guarded(() => go(-1)));
      $("instNext")?.addEventListener("click", guarded(() => go(1)));
      $("instClose")?.addEventListener("click", guarded(toList));
      $("instDel")?.addEventListener("click", () => {
        svConfirm({ title: "SUPPRIMER LE BUDGET", text: "LE BUDGET EN INSTANCE " + fullRef + " SERA SUPPRIMÉ.", ok: "SUPPRIMER" }).then(go => {
          if (!go) return;
          instUpd(l => l.filter(x => x.ref !== ref));
          groups.delete(ref);
          toList();
        });
      });
      /* ✓ : le budget figé passe dans BUDGETS (VALIDÉS), en noir, lecture seule */
      $("instValid")?.addEventListener("click", () => {
        svConfirm({ title: "VALIDER LE BUDGET", text: fullRef + " PASSERA DANS BUDGETS (VALIDÉS), EN LECTURE SEULE.", ok: "✓ VALIDER", tone: "neutral" }).then(go => {
        if (!go) return;
        /* validation : les données gardées sous les lignes titre sont effacées */
        ((budget.inst.data || {}).des || []).forEach(r => { if (r.t) ["u", "q", "p", "tva"].forEach(f => { delete r[f]; }); });
        budget.inst.state = "valide";
        const d = new Date(), p2 = n => String(n).padStart(2, "0");
        budget.inst.validated = d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + "T" + p2(d.getHours()) + ":" + p2(d.getMinutes());
        instUpd(l => l.map(x => x.ref === ref ? { ...x, data: budget.inst.data || x.data, state: "valide", validated: budget.inst.validated } : x));
        histLog("BUDGET", "VALIDÉ", fullRef);
        try { localStorage.setItem("svi_listmode_v1", "valid"); } catch (e) {}
        toList();
        });
      });
      /* bascule SAISIE / LIAISONS (mémorisée pour ce budget) */
      $("insModeSw")?.addEventListener("click", e => {
        const b = e.target.closest("[data-mode]");
        if (!b) return;
        budget.inst.mode = b.dataset.mode;
        instUpd(l => l.map(x => x.ref === ref ? { ...x, mode: budget.inst.mode } : x));
        insApplyMode();
        window.scrollTo(0, 0);
      });
      /* 🗑 NON LIÉES : supprime toutes les lignes qu'aucune liaison n'utilise */
      $("insUnlBtn")?.addEventListener("click", async () => {
        /* liaisons déliées pas encore validées : valider ou abandonner d'abord */
        if (shell.__lkGuard && !(await shell.__lkGuard())) return;
        const n = insUnlCount();
        if (!n || !(await svConfirm({ title: "SUPPRIMER LES LIGNES NON LIÉES", text: n + " LIGNE(S) NON LIÉE(S) SERONT SUPPRIMÉES.", ok: "SUPPRIMER" }))) return;
        const u = insUsed();
        INS_LINKED_KINDS.forEach(k => { INS[k] = INS[k].filter(r => u[k].has(r.id)); });
        insCleanLinks(); insSave();
        histLog("SAISIE", "LIGNES NON LIÉES SUPPRIMÉES", n + " LIGNE(S)");
        refreshAll();
      });
      $("instTodo")?.addEventListener("click", async () => {
        if (shell.__lkGuard && !(await shell.__lkGuard())) return;
        shell.__todoWhy && shell.__todoWhy();
      });
      $("instLock")?.addEventListener("click", async () => {
        /* liaison modifiée non validée : valider ou abandonner d'abord */
        if (shell.__lkGuard && !(await shell.__lkGuard())) return;
        const fige = budget.inst.state === "fige";
        /* FIGER : impossible tant qu'il reste une cause (FORMAT 96) : la fenêtre dit pourquoi */
        if (!fige && INS && shell.__figeBlocks && shell.__figeBlocks().length) { shell.__figeWhy(); return; }
        if (!(await svConfirm(fige
          ? { title: "REVENIR EN ÉDITION", text: fullRef, ok: "REVENIR EN ÉDITION" }
          : { title: "FIGER", text: fullRef + " PASSE EN LECTURE SEULE (RETOUR EN ÉDITION POSSIBLE).", ok: "FIGER" }))) return;
        budget.inst.state = fige ? "instance" : "fige";
        instUpd(l => l.map(x => x.ref === ref ? { ...x, state: budget.inst.state } : x));
        histLog("BUDGET", fige ? "RETOUR EN ÉDITION" : "FIGÉ", fullRef);
        openBudgetDetail(ref);
      });
    }
  }

  /* -------------------------------------------------------
     APERÇU / IMPRESSION
     ------------------------------------------------------- */

  table.onclick = event => {

    /* « ! » : lire l'alerte sans ouvrir le détail du budget */
    const bang = event.target.closest(".obs-bang");
    if (bang) {
      event.preventDefault();
      event.stopPropagation();
      const r = bang.closest("tr[data-budget-ref]")?.dataset.budgetRef;
      openObsAlertFor(r, bdgGroups.get(r)?.project);
      return;
    }

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

    /* budget en instance : suppression (après confirmation) */
    const delButton = event.target.closest("[data-del-budget]");
    if (delButton) {
      event.preventDefault();
      event.stopPropagation();
      const r = delButton.dataset.delBudget;
      const g = bdgGroups.get(r);
      if (!g || !g.inst) return;
      svConfirm({ title: "SUPPRIMER LE BUDGET", text: "LE BUDGET EN INSTANCE " + g.project + " " + r + " SERA SUPPRIMÉ.", ok: "SUPPRIMER" }).then(go => {
        if (!go) return;
        try {
          const l = sviInstGet().filter(x => x.ref !== r);
          sviInstSet(l);
        } catch (e) {}
        renderBudgetList();
      });
      return;
    }

    const printButton =
      event.target.closest(
        "[data-print-budget]"
      );

    if (printButton) {
      event.preventDefault();
      /* même aperçu que DÉSIGNATIONS CLIENT (options, code, enregistrement) :
         le budget est ouvert puis son aperçu lancé dans le même geste */
      window.__sviPrintClient = null;
      openBudgetDetail(printButton.dataset.printBudget);
      if (window.__sviPrintClient) window.__sviPrintClient();
      else printBudgetPDF(printButton.dataset.printBudget);
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

  /* réouverture du dernier budget consulté */
  /* v633 : si la dernière ouverture n'est pas allée au bout (application bloquée), le budget n'est PAS rouvert
     (marque posée avant l'ouverture, enlevée 4 s après) ; « ?liste » dans l'adresse = jamais de réouverture */
  try {
    const last = localStorage.getItem("svi_lastbdg_v1"), stuck = localStorage.getItem("svi_opening_v1");
    if (stuck || /[?&#]liste\b/i.test(location.href)) {
      localStorage.removeItem("svi_opening_v1");
      /* v634 : dernière étape atteinte + TÉLÉCHARGER LE BUDGET (fichier à envoyer pour trouver la cause) */
      const ref0 = stuck || last, step = localStorage.getItem("svi_step_v1") || "";
      if (ref0) setTimeout(async () => { try {
        const v = await svChoose({ title: stuck ? "OUVERTURE BLOQUÉE" : "LISTE SEULE",
          html: `<div class="svc-sub">${stuck ? "LE BUDGET " + esc(stuck) + " N'A PAS PU S'OUVRIR LA DERNIÈRE FOIS : IL N'A PAS ÉTÉ ROUVERT." : "DERNIER BUDGET : " + esc(ref0) + " (NON ROUVERT)."}</div><div class="svc-sub">DERNIÈRE ÉTAPE : ${esc(step || "—")}</div>`,
          noCancel: true, buttons: [{ v: "dl", label: "TÉLÉCHARGER", tone: "neutral" }, { v: "raz", label: "OUVRIR SANS RÉGLAGES", tone: "neutral" }, { v: "ok", label: "FERMER", tone: "neutral" }] });
        /* v635 : essai — filtres, tris et vue mémorisés de CE budget mis de côté (gardés pour le fichier), puis ouverture */
        if (v === "raz") {
          const keep = {};
          try { const k1 = "svi_bdgstate_v1:" + ref0; keep[k1] = localStorage.getItem(k1); localStorage.removeItem(k1);
            const V = JSON.parse(localStorage.getItem("svi_vstate_v1") || "{}") || {}; keep.vstate = V["bdg:" + ref0] || null; delete V["bdg:" + ref0]; localStorage.setItem("svi_vstate_v1", JSON.stringify(V));
            localStorage.setItem("svi_diag_old_v1", JSON.stringify(keep)); } catch (e) {}
          if (groups.has(ref0)) openBudgetDetail(ref0);
          return;
        }
        if (v !== "dl") return;
        const b = (sviInstGet() || []).find(x => x.ref === ref0);
        if (!b) { sviAlert("BUDGET " + ref0 + " INTROUVABLE SUR L'APPAREIL.", "TÉLÉCHARGER"); return; }
        /* v635 : avec les étapes, l'appareil et tous les réglages gardés sur l'appareil (sauf la liste des budgets, déjà dans « budget ») */
        const ls = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k === SVI_INST_KEY) continue; const v = localStorage.getItem(k); if (v && v.length < 300000) ls[k] = v; } } catch (e) {}
        const blob = new Blob([JSON.stringify({ step, steps: localStorage.getItem("svi_steps_v1") || "", ua: navigator.userAgent, vw: innerWidth + "x" + innerHeight, ls, budget: b })], { type: "application/json" }), a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = String(ref0).replace(/[^A-Z0-9-]+/gi, "_") + ".json"; document.body.appendChild(a); a.click(); setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 2000);
      } catch (e) {} }, 400);
    } else if (last && groups.has(last)) {
      openBudgetDetail(last);
    }
  } catch (e) {}
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
    sviAlert("Budget introuvable.");
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
    sviAlert("Impossible d'ouvrir le document. Autorisez les fenêtres pop-up.");
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

  const intitule = sviIntitule(ref, group.project, group.inst);

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
          <div>${esc(sviClient(group.inst))}</div>
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

