    /* ===== ⚠ À COMPLÉTER (v457) : tout ce qui manque, bloquant ou non ; toucher une ligne y mène ===== */
    const insTodo = () => {
      const out = [];
      const fb = insFigeBlocks();
      const inf = infMissing();
      /* v581 (remarque 8) : INF regroupée en une seule ligne (nombre + noms) */
      if (inf.length) out.push({ lab: "INF", n: inf.length, go: "inf", names: inf.map(x => String(x.lab).replace(/^INF\s*:\s*/, "")), req: inf.some(x => x.req) });
      fb.filter(b => b.go !== "inf").forEach(b => {
        const o = { ...b, req: true };
        /* ligne en erreur : renvoi vers la première ligne en erreur du bloc */
        if (b.go === "prd" || b.go === "chg") { const r = INS[b.go].find(x => !x.t && insRowErr(b.go, x)); if (r) o.first = r.id; }
        out.push(o);
      });
      /* v568 (remarque 11) : tâches qui ont des produits mais aucune charge (non bloquant) — mène au DÉTAIL PRODUITS filtré sur elles */
      { const KP = new Set(), KC = new Set(), P = new Set();
        (INS.links || []).forEach(l => { const k = l.lot + "|" + l.sec; if ((l.prd || []).length) KP.add(k); if ((l.chg || []).length) KC.add(k); });
        const K = [...KP].filter(k => !KC.has(k));
        (INS.links || []).forEach(l => { if (K.includes(l.lot + "|" + l.sec)) (l.prd || []).forEach(x => P.add(x.id)); });
        if (K.length) out.push({ lab: "TÂCHES SANS CHARGE", n: K.length, go: "prdnc", list: K, prd: P, req: false }); }
      return out;
    };
    /* v581 (remarque 8) : FILTRES ACTIFS par bloc — comprendre pourquoi les données affichées sont partielles */
    const insFiltActs = () => {
      const G = [];
      if (!INS) return G;
      const ck = k => (INS[k] || []).filter(r => !r.t && r.on === true).length;
      const rd = k => (k === "prd" || k === "chg") ? Object.keys(LK[k] || {}).length : (LK.all && LK.all[k] ? 1 : LK[k] ? 1 : 0);
      const add = (blk, go, it) => { it = it.filter(Boolean); if (it.length) G.push({ blk, go, it }); };
      const std = k => [ck(k) && { lab: "CASES COCHÉES", n: ck(k) }, rd(k) && { lab: "RONDS ALLUMÉS", n: rd(k) },
        cfHasF(insCfT(k)) && { lab: "LOUPE", n: Object.keys(CF[insCfT(k)].f).length }, ONLYC[k] && { lab: "COCHÉES SEULEMENT" }];
      add("DÉSIGNATIONS CLIENT", "des", std("des"));
      add("LOT", "hier:lot", std("lot"));
      add("ACTIVITÉ PRIMAIRE", "hier:prim", std("prim"));
      add("ACTIVITÉ SECONDAIRE", "hier:sec", std("sec"));
      const rg = insRg(), dF = v => v ? String(v).slice(0, 10).split("-").reverse().join("/") : "…";
      const rgI = rg && { lab: "DÉBUT / FIN : " + dF(rg.a) + " → " + dF(rg.b) };
      add("DÉTAIL PRODUITS", "prd", [...std("prd"), shell.__prdNc && { lab: "TÂCHES SANS CHARGE", n: shell.__prdNc.size }, rgI]);
      add("DÉTAIL CHARGES", "chg", [...std("chg"), rgI]);
      const nl = ["dly", "dlyp", "dlys", "dlyr", "dlyi"].filter(cfHasF).reduce((t, x) => t + Object.keys(CF[x].f).length, 0);
      let vd = false; try { vd = dlyView() === "d"; } catch (e) {}
      add("DÉTAIL DÉLAIS", "dly", [shell.__dlySel && shell.__dlySel.size && { lab: "TÂCHES COCHÉES", n: shell.__dlySel.size },
        nl && { lab: "LOUPE", n: nl }, shell.__dlyIso && { lab: "BRANCHE ISOLÉE" }, vd && { lab: "VUE PAR DÉBUT" }, rgI]);
      const nm = (INS.links || []).filter(l => l.on === true).length;
      add("MARGE", "lnk", [nm && { lab: "LIAISONS COCHÉES", n: nm }, cfHasF("lk_marge") && { lab: "LOUPE", n: Object.keys(CF.lk_marge.f).length }, rgI]);
      return G;
    };
    shell.__filtActs = () => insFiltActs();
    const insTodoWhy = () => {
      const B = insTodo(), F = insFiltActs();
      document.getElementById("svConf")?.remove();
      const d = document.createElement("div");
      d.id = "svConf";
      const lab = b => esc(b.lab) + (b.names ? " : " + esc(b.names.join(" ; ")) : b.list ? " : " + esc(b.list.slice(0, 3).map(dlyName).join(" ; ")) + (b.list.length > 3 ? "…" : "") : "") + (b.req ? "" : " <small>(NON BLOQUANT)</small>");
      d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true"><button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
        <div class="svc-t">À COMPLÉTER</div>
        <div class="svc-x">${B.length ? B.map((b, i) => `<button type="button" class="fz-why${b.req ? "" : " fz-opt"}" data-i="${i}"><span>${lab(b)}</span>${svCnt(b.n)}</button>`).join("")
          : `<div class="fz-none">TOUT EST COMPLET : LE BUDGET PEUT ÊTRE FIGÉ.</div>`}</div>
        <div class="svc-t fz-ft">FILTRES ACTIFS</div>
        <div class="svc-x">${F.length ? F.map((g, i) => `<div class="fz-blk">${esc(g.blk)}</div>` + g.it.map(x => `<button type="button" class="fz-why fz-flt" data-g="${i}"><span>${esc(x.lab)}</span>${x.n ? svCnt(x.n) : ""}</button>`).join("")).join("")
          : `<div class="fz-none">AUCUN FILTRE : TOUTES LES DONNÉES SONT AFFICHÉES.</div>`}</div>
        <div class="svc-f"><button type="button" class="svc-b svc-ok svc-neutral" data-x>FERMER</button></div></div>`;
      document.body.appendChild(d);
      d.addEventListener("click", e => {
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
        const it = e.target.closest(".fz-why");
        if (!it) return;
        d.remove();
        if (it.dataset.g !== undefined) figeGo({ go: F[+it.dataset.g].go });
        else figeGo(B[+it.dataset.i]);
      });
    };
    shell.__todoWhy = () => insTodoWhy();
    shell.__figeWhy = () => insFigeWhy();
    shell.__figeBlocks = () => insFigeBlocks();
    const insUnlCount = () => { const n = insUnlinked(); return INS_LINKED_KINDS.reduce((t, k) => t + n[k].length, 0); };
    /* liaisons dont une ligne a disparu : nettoyées */
    const insCleanLinks = () => {
      const has = k => new Set(INS[k].map(r => r.id));
      const H = Object.fromEntries(INS_LINKED_KINDS.map(k => [k, has(k)]));
      INS.links = (INS.links || []).filter(l => H.des.has(l.des) && H.lot.has(l.lot) && H.prim.has(l.prim) && H.sec.has(l.sec))
        .map(l => ({ ...l, prd: (l.prd || []).filter(x => H.prd.has(x.id)), chg: (l.chg || []).filter(x => H.chg.has(x.id)) }));
    };
    /* hachures « NON LIÉE » (mode SAISIE) et bouton 🗑 NON LIÉES de l'en-tête */
    const insMarkUnlinked = () => {
      if (!INS) return;
      const u = insUsed();
      shell.querySelectorAll(".ins-table[data-ik] tr[data-iid], .ins-hcol .ins-li[data-iid]").forEach(el => {
        const k = el.dataset.ik || el.closest("[data-ik]")?.dataset.ik;
        if (!u[k]) return;
        el.classList.toggle("ins-unl", !u[k].has(el.dataset.iid));
      });
      /* FIGER grisé tant que l'onglet LIGNES NON LIÉES n'est pas à 0 */
      const lk = $("instLock");
      const td = $("instTodo");
      if (td) { const n = insTodo().reduce((t, b) => t + (+b.n || 1), 0); td.querySelector("b").textContent = n || ""; td.classList.toggle("ok", !n); let nf = 0; try { nf = insFiltActs().length; } catch (e) {} td.classList.toggle("flt", !!nf); td.title = n ? n + " ÉLÉMENT(S) À COMPLÉTER" : "TOUT EST COMPLET"; }
      if (lk && INS_EDIT) { const B = insFigeBlocks(); lk.disabled = false; lk.classList.toggle("off", B.length > 0); lk.title = B.length ? "FIGER IMPOSSIBLE : TOUCHER POUR VOIR POURQUOI" : "Figer (lecture seule)"; }
      const tb = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="unl"]`);
      /* LIGNES NON LIÉES : visible seulement s'il reste des lignes */
      if (tb) {
        const nU = insUnlCount();
        tb.innerHTML = (SVI_ICON.hier || "") + "LIGNES NON LIÉES " + svCnt(nU);
        tb.hidden = !nU; tb.style.display = nU ? "" : "none";
        if (!nU && active === "unl") {
          active = "prd";
          try { localStorage.setItem("svi_dtab_v1", "prd"); } catch (e) {}
          setTimeout(() => refreshAll(), 0);
        }
      }
      if (shell.__markCut) shell.__markCut();
    };

    /* ---------- DÉTAIL DÉLAIS (instance) : une ligne par activité secondaire ---------- */
    const dIso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const dAdd = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return dIso(d); };
    const dDiff = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
    /* FORMAT 139 : durée en jours, jour de début et jour de fin compris (même jour = 1 J) */
    /* 15/10/2026 : DURÉE = jours TRAVAILLÉS du calendrier du budget, début et fin compris */
    const dDur = (a, b) => sviWDur(insCal(), a, b);
    const dFr = iso => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "";
    /* ---------- DÉTAIL DÉLAIS (instance) : une ou plusieurs périodes par TÂCHE PRIMAIRE
       (tâche primaire = un lot associé à une activité primaire, d'après les liaisons validées).
       Saisie en mode LIAISONS seulement ; périodes sans chevauchement dans une même tâche. ---------- */
    const dParse = v => {
      const t = String(v || "").trim();
      if (!t) return "";
      let m = t.match(/^(\d{1,2})[\/.\- ](\d{1,2})[\/.\- ](\d{2,4})$/) || t.match(/^(\d{2})(\d{2})(\d{4})$/);
      if (!m) return null;
      let y = Number(m[3]); if (y < 100) y += 2000;
      const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
      if (isNaN(d) || d.getDate() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1) return null;
      return dIso(d);
    };
    const insTasks = () => {
      const m = new Map();
      (INS.links || []).forEach(l => {
        const k = l.lot + "|" + l.sec;
        if (!m.has(k)) m.set(k, { key: k, lot: (INS.lot.find(x => x.id === l.lot) || {}).v || "", sec: (INS.sec.find(x => x.id === l.sec) || {}).v || "" });
      });
      return [...m.values()];
    };
    /* tâche SECONDAIRE choisie (désignation + lot + activité secondaire), seulement si elle est déjà liée */
    /* tâche secondaire choisie par les ronds (lot + activité secondaire), liée ou non : le planning peut précéder les liaisons */
    const insDlyKey = () => LK.lot && LK.sec ? LK.lot + "|" + LK.sec : null;
