@verbatim/* ===== IMPORTER depuis un autre budget de l'application =====
       budget source au choix, lignes cochées par onglet ;
       options : SANS / AVEC LIAISONS, TOUT LE BUDGET */
    const IMP_TABS = [
      ["des", "DÉSIGNATIONS CLIENT"], ["hier", "TÂCHES"],
      ["chg", "DÉTAIL CHARGES"], ["prd", "DÉTAIL PRODUITS"],
      ["qlt", "DÉTAIL QUALITÉ"], ["dly", "DÉTAIL DÉLAIS"]
    ];
    const impFr = iso => iso ? String(iso).slice(8, 10) + "/" + String(iso).slice(5, 7) + "/" + String(iso).slice(0, 4) : "";
    /* U_ : défini plus haut (utilisé dès l'ouverture du budget) */
    /* identité d'une ligne : deux lignes identiques = doublon (jamais importé deux fois)
       désignations / charges : ART + DÉSIGNATION + UNITÉ (+ titre) ;
       produits : idem (ART + DÉSIGNATION + UNITÉ) */
    const impId = (k, r) => {
      const n = v => v === "" || v === undefined || v === null ? "" : (Math.round(num(v) * 1000) / 1000).toString();
      /* produits : sans article — DÉSIGNATION + UNITÉ */
      /* FORMAT 89 : une désignation (et une charge) se reconnaît par sa DÉSIGNATION + UNITÉ, sans l'ART ;
         seuls les titres gardent leur ART */
      const base = [r.t ? U_(r.art) : "", U_(r.des), U_(r.u), r.t ? "T" : ""];
      return base.join("|");
    };
    /* charges, lots et activités : ordre alphabétique */
    const impSort = m => {
      const az = (a, b) => String(a).localeCompare(String(b), "fr", { numeric: true });
      m.chg.sort((a, b) => az(a.row.des, b.row.des) || az(a.row.u, b.row.u));
      m.hier.sort((a, b) => az(a.row.v, b.row.v));
    };
    /* modèle d'un budget source : lignes de chaque onglet + liens (lignes de détail) */
    const impModel = ref => {
      const g = groups.get(ref);
      const m = { des: [], hier: [], chg: [], prd: [], qlt: [], dly: [], links: [] };
      if (!g) return m;
      if (g.inst) {
        const d = g.inst.data || {};
        const seen = new Set();
        /* FORMAT 117 : produit lié = une ligne par chaîne (avec ses quantités) ; non lié : sans quantités */
        const srcCh = l => { const f = (k, i, fl) => U_(((d[k] || []).find(x => x.id === i) || {})[fl] || ""); return [f("des", l.des, "des"), f("lot", l.lot, "v"), f("prim", l.prim, "v"), f("sec", l.sec, "v")].join("|"); };
        ["des", "chg", "prd"].forEach(k => (d[k] || []).forEach(r => {
          const ls = k === "prd" ? (d.links || []).filter(l => (l.prd || []).some(x => x.id === r.id)) : [];
          if (ls.length) {
            ls.forEach(l => {
              const ch = srcCh(l), id = k + "|" + impId(k, r) + "#" + ch;
              if (seen.has(id)) return;
              seen.add(id);
              const row = { ...r, __ch: ch };
              ["art", "q", "p"].forEach(f => delete row[f]);
              m[k].push({ key: id, row });
            });
            return;
          }
          const id = k + "|" + impId(k, r);
          if (seen.has(id)) return;
          seen.add(id);
          const row = { ...r };
          if (k === "prd") ["art", "nbr", "d1", "d2", "d3", "q", "p"].forEach(f => delete row[f]);
          m[k].push({ key: id, row });
        }));
        ["lot", "prim", "sec"].forEach(k => (d[k] || []).forEach(r => {
          const id = k + "|" + U_(r.v);
          if (!U_(r.v) || seen.has(id)) return;
          seen.add(id);
          m.hier.push({ key: id, lvl: k, row: { v: U_(r.v) } });
        }));
        /* qualité (une colonne) et délais (périodes par tâche primaire) */
        (d.qlt || []).forEach(r => { const id = "qlt|" + U_(r.v); if (U_(r.v) && !seen.has(id)) { seen.add(id); m.qlt.push({ key: id, row: { v: U_(r.v) } }); } });
        const dD = d.dlpSec ? d : (() => { const c = { links: d.links, dlp: d.dlp }; sviDlpSec(c); return c; })();
        Object.keys(dD.dlp || {}).forEach(tk => {
          const [lo, se] = tk.split("|");
          const ln = U_(((d.lot || []).find(x => x.id === lo) || {}).v), sn = U_(((d.sec || []).find(x => x.id === se) || {}).v);
          if (!ln || !sn) return;
          (dD.dlp[tk] || []).forEach(pp => m.dly.push({ key: "dly|" + ln + "|" + sn + "|" + (pp.deb || "") + "|" + (pp.fin || ""),
            row: { lot: ln, sec: sn, deb: impFr(pp.deb), fin: impFr(pp.fin), _deb: pp.deb || "", _fin: pp.fin || "" } }));
        });
        /* liaisons validées du budget source : un chemin par produit / charge */
        const byId = (k, id) => (d[k] || []).find(x => x.id === id);
        (d.links || []).forEach(l => {
          const D = byId("des", l.des), L = byId("lot", l.lot), P = byId("prim", l.prim), S = byId("sec", l.sec);
          if (!D || !L || !P || !S) return;
          const base = { dk: "des|" + impId("des", D), lot: "lot|" + U_(L.v), prim: "prim|" + U_(P.v), sec: "sec|" + U_(S.v) };
          (l.prd || []).forEach(x => { const r = byId("prd", x.id); if (r) m.links.push({ ...base, pk: "prd|" + impId("prd", r) + "#" + srcCh(l), q: x.q }); });
          (l.chg || []).forEach(x => { const r = byId("chg", x.id); if (r) m.links.push({ ...base, ck: "chg|" + impId("chg", r), q: x.q }); });
        });
        impSort(m);
        return m;
      }
      /* type CHG / PRD lu dans le budget source (l'écran courant, vide, ne le connaît pas) */
      const tk = Object.keys(g.rows[0] || {}).find(k => { const n = nk(k); return n.includes("CHG") && n.includes("PRD"); });
      const ls = g.rows.map((row, i) => {
        const l = toLine(row, i);
        const t = nk(tk ? row[tk] : "");
        l.kind = t.startsWith("PRD") || t.startsWith("PROD") ? "prd" : t.startsWith("CHG") || t.startsWith("CHARGE") ? "chg" : "";
        if (l.kind === "prd" && !l.qty) {
          const f = [l.nbr, ...l.dims].filter(v => normalise(v) !== "").map(num);
          if (f.length) l.qty = f.reduce((a, b) => a * b, 1);
        }
        return l;
      });
      const dmap = new Map(), cmap = new Map(), hset = new Map(), pset = new Set();
      ls.forEach(l => {
        const dk = "d" + U_(l.article) + "||" + U_(l.designation);
        if (!dmap.has(dk)) dmap.set(dk, { key: dk, ms: [] });
        dmap.get(dk).ms.push(l);
        const ks = { dk, q: Number(l.qty) || "" };
        [["lot", l.lot], ["prim", l.prim], ["sec", l.sec]].forEach(([k, v]) => {
          if (!U_(v)) return;
          const hk = k + "|" + U_(v);
          if (!hset.has(hk)) hset.set(hk, { key: hk, lvl: k, row: { v: U_(v) } });
          ks[k] = hk;
        });
        if (l.kind === "chg") {
          const ck = "c" + U_(l.detail) + "||" + U_(l.dunit);
          if (!cmap.has(ck)) cmap.set(ck, { key: ck, ms: [] });
          cmap.get(ck).ms.push(l);
          ks.ck = ck;
        } else if (l.kind === "prd") {
          /* produit : ART, DÉSIGNATION, UNITÉ ; quantité et prix propres à chaque tâche, non repris */
          const row = { des: U_(l.detail), u: U_(l.dunit || l.unit), tva: 20 };
          /* produit identique déjà listé : une seule ligne (ses liens sont gardés) */
          const pk = "p" + impId("prd", row);
          if (!pset.has(pk)) { pset.add(pk); m.prd.push({ key: pk, row }); }
          ks.pk = pk;
        }
        m.links.push(ks);
      });
      dmap.forEach(x => {
        /* même calcul que l'écran : clés primaires (produit au prix non nul) */
        const prim = l => l.kind !== "chg" && (l.cprice || l.priceTTC);
        const k = x.ms.find(prim) || x.ms[0];
        const q = x.ms.filter(prim).reduce((t, l) => t + (Number(l.qty) || 0), 0);
        m.des.push({ key: x.key, row: { art: k.article, des: U_(k.designation), u: U_(k.dunit || k.unit), q, p: k.price, tva: 20 } });
      });
      cmap.forEach(x => {
        const f = x.ms[0];
        const q = x.ms.reduce((t, l) => t + (Number(l.qty) || 0), 0);
        const a = x.ms.reduce((t, l) => t + (Number(l.amount) || 0), 0);
        m.chg.push({ key: x.key, row: { art: "", des: U_(f.detail), u: U_(f.dunit), q, p: q ? a / q : 0, tva: 20 } });
      });
      m.hier = [...hset.values()];
      /* délais du budget validé : une période par tâche secondaire (du premier début à la dernière fin) */
      { const dm = new Map();
        ls.forEach(l => {
          const ln = U_(l.lot), pn = U_(l.sec);
          if (!ln || !pn || (!l.deb && !l.fin)) return;
          const k = ln + "|" + pn;
          if (!dm.has(k)) dm.set(k, { lot: ln, sec: pn, _deb: "", _fin: "" });
          const x = dm.get(k);
          if (l.deb && (!x._deb || l.deb < x._deb)) x._deb = l.deb;
          if (l.fin && (!x._fin || l.fin > x._fin)) x._fin = l.fin;
        });
        dm.forEach(x => m.dly.push({ key: "dly|" + x.lot + "|" + x.sec + "|" + x._deb + "|" + x._fin, row: { ...x, deb: impFr(x._deb), fin: impFr(x._fin) } })); }
      m.des.sort((a, b) => String(a.row.art).localeCompare(String(b.row.art), "fr", { numeric: true }));
      impSort(m);
      return m;
    };
    /* DUPLIQUER : copie complète (désignations, tâches, détails, qualité, liaisons, délais) dans un nouveau budget en instance ;
       DOCUMENTS / TAF / OBSERVATIONS et historique ne sont pas copiés ; le nouveau budget s'ouvre directement */
    const dupData = () => {
      if (budget.inst) return JSON.parse(JSON.stringify(budget.inst.data || {}));
      const m = impModel(ref), kid = new Map();
      const d = { des: [], lot: [], prim: [], sec: [], chg: [], prd: [], qlt: [], dly: {}, dlp: {}, dlpSec: true, links: [] };
      ["des", "chg", "prd", "qlt"].forEach(k => m[k].forEach(x => { const r = { ...x.row, id: insId(), on: false }; delete r.__ch; if (k === "des") r.t = !!r.t; d[k].push(r); kid.set(x.key, r.id); }));
      m.hier.forEach(x => { const r = { id: insId(), v: x.row.v }; d[x.lvl].push(r); kid.set(x.key, r.id); });
      m.links.forEach(l => {
        const des = kid.get(l.dk), lot = kid.get(l.lot), prim = kid.get(l.prim), sec = kid.get(l.sec);
        const pid = l.pk && kid.get(l.pk), cid = l.ck && kid.get(l.ck);
        if (!des || !lot || !prim || !sec) return;
        let L = d.links.find(x => x.des === des && x.lot === lot && x.prim === prim && x.sec === sec);
        if (!L) { L = { id: insId(), des, lot, prim, sec, prd: [], chg: [] }; d.links.push(L); }
        if (pid && !L.prd.some(y => y.id === pid)) L.prd.push({ id: pid, q: "" });
        if (cid && !L.chg.some(y => y.id === cid)) L.chg.push({ id: cid, q: "" });
      });
      d.links = d.links.filter(x => x.prd.length);
      m.dly.forEach(x => { const lo = kid.get("lot|" + x.row.lot), pr = kid.get("sec|" + x.row.sec); if (lo && pr) (d.dlp[lo + "|" + pr] = d.dlp[lo + "|" + pr] || []).push({ id: insId(), deb: x.row._deb, fin: x.row._fin }); });
      return d;
    };
    $("instDup")?.addEventListener("click", () => {
      const go = () => {
        const now = new Date(), p2 = n => String(n).padStart(2, "0");
        const nr = nextBudgetRef(now);
        const list = instLoad();
        list.push({ ref: nr, project: budget.project, intitule: (budget.inst && budget.inst.intitule) || "À COMPLÉTER", client: (budget.inst && budget.inst.client) || "",
          created: now.getFullYear() + "-" + p2(now.getMonth() + 1) + "-" + p2(now.getDate()) + "T" + p2(now.getHours()) + ":" + p2(now.getMinutes()),
          state: "instance", data: dupData() });
        instSave(list);
        histLog("BUDGET", "DUPLIQUÉ", fullRef + " → " + budget.project + " " + nr);
        try { localStorage.setItem("svi_listmode_v1", "inst"); } catch (e) {}
        $("budgetBackBtn")?.click();
        setTimeout(() => {
          renderBudgetList();
          setTimeout(() => { const tr = [...document.querySelectorAll("tr[data-budget-ref]")].find(x => x.dataset.budgetRef === nr); if (tr) tr.click(); }, 40);
        }, 40);
      };
      (shell.__lkGuard ? shell.__lkGuard() : Promise.resolve(true)).then(ok => { if (ok) go(); });
    });
    const openImportBudget = blk => {
      if (!INS) return;
      const startTab = blk === "client" ? "des" : blk === "hier" ? "hier" : (active === "prd" ? "prd" : "chg");
      const refs = [...groups.keys()].filter(r => r !== ref)
        .sort((a, b) => String(a).localeCompare(String(b), "fr", { numeric: true }));
      /* couleur de l'état, comme dans la liste des budgets */
      const stCls = g => !g.inst || g.inst.state === "valide" ? "" : g.inst.state === "fige" ? "imp-fige" : "imp-inst";
      const refLab = r => { const g = groups.get(r); return U_(g.project) + " " + r; };
      let src = refs[0] || "", model = impModel(src), tab = startTab, withLinks = false, all = false;
      const sel = { des: new Set(), hier: new Set(), chg: new Set(), prd: new Set(), qlt: new Set(), dly: new Set() };
      /* lignes liées décochées à la main : la liaison est coupée à cet endroit */
      const cut = new Set();
      document.getElementById("docPop")?.remove();
      const p = document.createElement("div");
      p.id = "docPop";
      p.className = "pop-new-bdg";
      p.innerHTML = `
        <div class="doc-card imp-card" role="dialog" aria-modal="true">
          <div class="doc-head">
            <span class="doc-title">IMPORTER — ${esc(blkDisp(blk))}</span>
            <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
          </div>
          <div class="doc-body">
            <div class="imp-row"><span class="doc-lab">BUDGET SOURCE <b>*</b></span>
              <div class="imp-src">
                <button type="button" class="imp-src-btn" id="impSrc"></button>
                <div class="imp-src-list" hidden>${refs.map(r =>
                  `<button type="button" class="imp-src-it ${stCls(groups.get(r))}" data-ref="${esc(r)}">${esc(refLab(r))}</button>`).join("")}</div>
              </div></div>
            <div class="imp-opts">
              <label><input type="radio" name="impLk" value="0" checked> SANS LIAISONS <small>(LIGNES COCHÉES SEULEMENT)</small></label>
              <label><input type="radio" name="impLk" value="1"> AVEC LIAISONS <small>(+ TÂCHES ET DÉTAILS LIÉS)</small></label>
            </div>
            <div class="imp-tabs"></div>
            <div class="imp-scroll"><table class="bdg-d-table imp-table"></table></div>
          </div>
          <div class="doc-foot imp-foot">
            <span class="imp-n"></span>
            <span><button type="button" class="doc-btn" data-cancel>ANNULER</button>
            <button type="button" class="doc-btn nb-save" id="impGo">IMPORTER</button></span>
          </div>
        </div>`;
      document.body.appendChild(p);
      try { popEnhance(p, "impbdg"); } catch (e) {}
      const cols = {
        des: [["art", "ART"], ["des", "DÉSIGNATION"], ["u", "UPB"], ["q", "QPB", 1], ["p", "PPB", 1]],
        hier: [["lvl", "NIVEAU"], ["v", "LIBELLÉ"]],
        chg: [["des", "DÉSIGNATION CHARGE"], ["u", "UCB"], ["q", "QCB", 1], ["p", "PCB", 1]],
        prd: [["des", "DÉSIGNATION PRODUIT"], ["u", "UPB"]],
        qlt: [["v", "QUALITÉ"]],
        dly: [["lot", "LOT"], ["sec", "ACTIVITÉ SECONDAIRE"], ["deb", "DÉBUT"], ["fin", "FIN"]]
      };
      const LV = { lot: "LOT", prim: "ACTIVITÉ PRIMAIRE", sec: "ACTIVITÉ SECONDAIRE" };
      const val = (x, f, isNum) => f === "lvl" ? LV[x.lvl] : x.row.t && isNum ? "" : isNum ? money(f === "q" ? insQty(tab === "prd" ? "prd" : "des", x.row) : x.row[f]) : (x.row[f] ?? "");
      /* tri et filtre par colonne (mêmes menus que les autres tableaux) */
      const cfCols = () => cols[tab].map(c => [c[0], c[1],
        x => c[0] === "lvl" ? LV[x.lvl] : c[2] ? (x.row.t ? "" : c[0] === "q" ? insQty(tab === "prd" ? "prd" : "des", x.row) : num(x.row[c[0]] || 0)) : (x.row[c[0]] ?? ""),
        c[2] ? "number" : ""]);
      /* ART et unité centrés, nombres à droite */
      const impCls = c => c[2] ? "number" : (c[0] === "art" || c[0] === "u") ? "center" : "";
      const shownRows = () => cfApply("imp_" + tab, cfCols(), model[tab]);
      /* lignes retenues : cochées, + liées (AVEC LIAISONS), ou tout le budget */
      const picked = (noCut = false) => {
        const out = { des: new Set(), hier: new Set(), chg: new Set(), prd: new Set(), qlt: new Set(), dly: new Set() };
        if (all) { IMP_TABS.forEach(([k]) => model[k].forEach(x => out[k].add(x.key))); return out; }
        IMP_TABS.forEach(([k]) => sel[k].forEach(x => out[k].add(x)));
        if (withLinks) {
          /* chaque ligne de détail = un chemin DÉSIGNATION › LOT › PRIMAIRE › SECONDAIRE › DÉTAIL.
             Depuis une ligne cochée, on descend et on remonte le chemin ;
             une ligne décochée à la main coupe le chemin : elle et tout ce qui est
             au-delà (en dessous quand on descend, au-dessus quand on remonte) ne suivent plus. */
          model.links.forEach(l => {
            const path = [["des", l.dk], ["hier", l.lot], ["hier", l.prim], ["hier", l.sec],
              ["chg", l.ck], ["prd", l.pk]].filter(x => x[1]);
            path.forEach(([t, k], i) => {
              if (!sel[t].has(k)) return;
              const ok = k2 => noCut || !cut.has(k2);
              for (let j = i + 1; j < path.length && ok(path[j][1]); j++) out[path[j][0]].add(path[j][1]);
              for (let j = i - 1; j >= 0 && ok(path[j][1]); j--) out[path[j][0]].add(path[j][1]);
            });
          });
          /* délais : ils suivent leur tâche primaire (lot et activité primaire retenus) */
          model.dly.forEach(x => { if (out.hier.has("lot|" + x.row.lot) && out.hier.has("sec|" + x.row.sec)) out.dly.add(x.key); });
        }
        return out;
      };
      /* lignes retenues (cochées ou liées) en haut du tableau, comme les lignes bleues de l'écran */
      const upTop = (rows, set) => rows.map((x, i) => ({ x, i }))
        .sort((a, b) => (set.has(b.x.key) - set.has(a.x.key)) || a.i - b.i).map(o => o.x);
      const render = () => {
        /* coupures sans objet (plus aucune liaison n'y passe) : oubliées */
        const pAll = withLinks ? picked(true) : null;
        if (pAll) [...cut].forEach(k => { if (!IMP_TABS.some(([t]) => pAll[t].has(k))) cut.delete(k); });
        const pk = picked();
        const n = IMP_TABS.reduce((t, [k]) => t + pk[k].size, 0);
        p.querySelector(".imp-tabs").innerHTML = IMP_TABS.map(([k, lab]) =>
          /* pastille grise : lignes disponibles ; pastille rouge : lignes retenues */
          `<button type="button" class="imp-tab${k === tab ? " on" : ""}" data-tab="${k}">${lab} ${svCnt(model[k].length)}${pk[k].size ? `<span class="imp-selcnt">${pk[k].size}</span>` : ""}</button>`).join("");
        sviMarkEmptyTabs(p.querySelector(".imp-tabs"));
        const box = p.querySelector(".imp-scroll");
        /* TÂCHES : trois blocs côte à côte (lots, activités primaires, secondaires) */
        if (tab === "hier") {
          box.classList.add("imp-hier");
          /* largeur de chaque bloc : réglable par la poignée de son en-tête, mémorisée */
          const ws = ["lot", "prim", "sec"].map(lv => cwLoad()["imp_hier." + lv]);
          box.style.gridTemplateColumns = ws.every(Boolean) && window.innerWidth > 700 ? ws.map(w => w + "px").join(" ") : "";
          box.innerHTML = ["lot", "prim", "sec"].map(lv => {
            const rows = upTop(cfApply("imp_" + lv, [["v", LV[lv], x => x.row.v || "", ""]], model.hier.filter(x => x.lvl === lv)), pk.hier);
            const allOn = rows.length && rows.every(x => pk.hier.has(x.key));
            return `<div class="imp-hcol"><table class="bdg-d-table imp-table">
              <thead><tr><th class="center" style="width:34px"><input type="checkbox" class="imp-cball" data-lvl="${lv}" ${allOn ? "checked" : ""}></th>
                ${cfHead("imp_" + lv, "v", LV[lv] + " " + svCnt(rows.length), "")}</tr></thead>
              <tbody>${rows.map(x => {
                const on = pk.hier.has(x.key), linked = on && !sel.hier.has(x.key);
                const isCut = withLinks && cut.has(x.key) && !on && pAll && pAll.hier.has(x.key);
                return `<tr class="${linked ? "imp-linked" : ""}${isCut ? " imp-cut" : ""}" data-k="${esc(x.key)}">
                  <td class="center"><input type="checkbox" class="imp-cb" ${on ? "checked" : ""}></td>
                  <td>${esc(x.row.v)}</td></tr>`;
              }).join("") || `<tr><td colspan="2" class="empty">—</td></tr>`}</tbody></table></div>`;
          }).join("");
        } else {
        if (box.classList.contains("imp-hier") || !box.querySelector(".imp-table")) {
          box.classList.remove("imp-hier");
          box.style.gridTemplateColumns = "";
          box.innerHTML = `<table class="bdg-d-table imp-table"></table>`;
        }
        /* colonnes : ordre et largeurs réglables (glisser l'en-tête / la poignée), mémorisés */
        const cs = coOrder("imp_" + tab, cols[tab]), rows = upTop(shownRows(), pk[tab]);
        const allOn = rows.length && rows.every(x => pk[tab].has(x.key));
        const IMPW = { art: 70, des: 340, u: 70, q: 110, p: 110 };
        const wOf = k => cwLoad()["imp_" + tab + "." + k] || IMPW[k] || 110;
        const tbl = p.querySelector(".imp-table");
        tbl.style.width = (40 + cs.reduce((t, c) => t + wOf(c[0]), 0)) + "px";
        tbl.style.tableLayout = "fixed";
        tbl.innerHTML =
          `<colgroup><col style="width:40px">${cs.map(c => `<col data-w="imp_${tab}.${c[0]}" style="width:${wOf(c[0])}px">`).join("")}</colgroup><thead><tr><th class="center" style="width:34px"><input type="checkbox" class="imp-cball" ${allOn ? "checked" : ""} ${all ? "disabled" : ""}></th>${cs.map(c => cfHead("imp_" + tab, c[0], c[1], impCls(c))).join("")}</tr></thead>
           <tbody>${rows.map(x => {
             const on = pk[tab].has(x.key), linked = on && !sel[tab].has(x.key) && !all;
             const isCut = withLinks && cut.has(x.key) && !on && pAll && pAll[tab].has(x.key);
             return `<tr class="${x.row.t ? "imp-tt" : ""}${linked ? " imp-linked" : ""}${isCut ? " imp-cut" : ""}" data-k="${esc(x.key)}">
               <td class="center"><input type="checkbox" class="imp-cb" ${on ? "checked" : ""} ${all || (tab === "dly" && !withLinks) ? "disabled" : ""}></td>
               ${cs.map(c => `<td class="${impCls(c)}">${esc(val(x, c[0], c[2]))}</td>`).join("")}</tr>`;
           }).join("") || `<tr><td colspan="${cs.length + 1}" class="empty">AUCUNE LIGNE</td></tr>`}</tbody>`;
        }
        p.querySelector(".imp-n").textContent = n + " LIGNE(S) À IMPORTER" + (withLinks && !all ? " (LIAISONS COMPRISES)" : "");
        p.querySelector("#impGo").textContent = "IMPORTER (" + n + ")";
        p.querySelector("#impGo").disabled = !n;
      };
      /* poignées de largeur et glisser des en-têtes : même mécanisme que l'écran */
      p.addEventListener("pointerdown", e => {
        /* TÂCHES : la poignée d'en-tête règle la largeur du bloc */
        const hrs = e.target.closest(".imp-hcol .col-rs");
        if (hrs) {
          e.preventDefault(); e.stopPropagation();
          const grid = p.querySelector(".imp-scroll.imp-hier");
          const colsEl = [...grid.querySelectorAll(".imp-hcol")];
          const i = colsEl.indexOf(hrs.closest(".imp-hcol"));
          const ws = colsEl.map(c => c.getBoundingClientRect().width);
          const x0 = e.clientX, w0 = ws[i];
          hrs.classList.add("on");
          const mv = ev => {
            ws[i] = Math.max(120, Math.round(w0 + ev.clientX - x0));
            grid.style.gridTemplateColumns = ws.map(v => v + "px").join(" ");
          };
          const up = () => {
            document.removeEventListener("pointermove", mv);
            document.removeEventListener("pointerup", up);
            document.removeEventListener("pointercancel", up);
            hrs.classList.remove("on");
            const all = cwLoad();
            ["lot", "prim", "sec"].forEach((lv, j) => { all["imp_hier." + lv] = Math.round(ws[j]); });
            cwSave(all);
          };
          document.addEventListener("pointermove", mv);
          document.addEventListener("pointerup", up);
          document.addEventListener("pointercancel", up);
          return;
        }
        if (e.target.closest(".col-rs") || (e.target.closest(".imp-table th") && !e.target.closest(".cf-btn, input"))) {
          if (typeof shell.onpointerdown === "function") shell.onpointerdown(e);
        }
      });
      const showSrc = () => {
        const b = p.querySelector("#impSrc");
        b.className = "imp-src-btn " + (src ? stCls(groups.get(src)) : "");
        b.textContent = src ? refLab(src) : "AUCUN AUTRE BUDGET";
        p.querySelectorAll(".imp-src-it").forEach(x => x.classList.toggle("on", x.dataset.ref === src));
      };
      showSrc();
      render();
      /* un tri / filtre choisi redessine la fenêtre */
      window.__sviImpRefresh = () => { if (document.body.contains(p)) render(); else window.__sviImpRefresh = null; };
      /* liste des budgets : même présentation et mêmes couleurs que l'application */
      p.querySelector(".imp-src").addEventListener("click", e => {
        e.stopPropagation();
        const list = p.querySelector(".imp-src-list");
        const it = e.target.closest(".imp-src-it");
        if (it) {
          list.hidden = true;
          if (it.dataset.ref !== src) {
            src = it.dataset.ref; model = impModel(src);
            IMP_TABS.forEach(([k]) => sel[k].clear());
            cut.clear();
            showSrc(); render();
          }
          return;
        }
        if (e.target.closest("#impSrc")) list.hidden = !list.hidden;
      });
      p.addEventListener("change", e => {
        if (e.target.name === "impLk") { withLinks = e.target.value === "1"; render(); return; }
        if (e.target.classList.contains("imp-cball")) {
          const lv = e.target.dataset.lvl;
          const rows = lv
            ? cfApply("imp_" + lv, [["v", LV[lv], x => x.row.v || "", ""]], model.hier.filter(x => x.lvl === lv))
            : shownRows();
          rows.forEach(x => {
            if (e.target.checked) { sel[tab].add(x.key); cut.delete(x.key); }
            else sel[tab].delete(x.key);
          });
          render(); return;
        }
        const tr = e.target.closest("tr[data-k]");
        if (tr && e.target.classList.contains("imp-cb")) {
          const k = tr.dataset.k;
          if (e.target.checked) { sel[tab].add(k); cut.delete(k); }
          else {
            sel[tab].delete(k);
            /* encore retenue par une liaison : la liaison est coupée ici */
            if (withLinks && picked()[tab].has(k)) cut.add(k);
          }
          render();
        }
      });
      p.addEventListener("click", e => {
        const cfb = e.target.closest(".cf-btn");
        if (cfb) { e.stopPropagation(); cfOpenMenu(cfb); return; }
        const t = e.target.closest("[data-tab]");
        if (t) { tab = t.dataset.tab; render(); return; }
        if (!e.target.closest(".imp-src")) { const l = p.querySelector(".imp-src-list"); if (l) l.hidden = true; }
        if (e.target === p || e.target.closest("[data-cancel]")) { p.remove(); return; }
        if (!e.target.closest("#impGo")) return;
        const pk = picked();
        const lk = withLinks || all;
        /* lignes à importer, rangées par bloc du budget */
        const inc = { des: [], chg: [], prd: [], qlt: [], lot: [], prim: [], sec: [] };
        ["des", "chg", "prd", "qlt"].forEach(k => model[k].filter(x => pk[k].has(x.key)).forEach(x => inc[k].push(x)));
        model.hier.filter(x => pk.hier.has(x.key)).forEach(x => inc[x.lvl].push(x));
        const LAB = { des: "DÉSIGNATIONS CLIENT", lot: "LOTS", prim: "ACTIVITÉS PRIMAIRES", sec: "ACTIVITÉS SECONDAIRES",
          chg: "DÉTAIL CHARGES", prd: "DÉTAIL PRODUITS", qlt: "DÉTAIL QUALITÉ" };
        const busy = Object.keys(inc).filter(k => inc[k].length && INS[k].length);
        const run = mode => {
          let added = 0, upd = 0, skip = 0;
          const kid = new Map();   /* clé du budget source → id de la ligne dans ce budget */
          const same = (k, a, b) => k === "lot" || k === "prim" || k === "sec" || k === "qlt"
            ? U_(a.v) === U_(b.v)
            : impId(k, a) === impId(k, b);
          Object.keys(inc).forEach(k => {
            if (!inc[k].length) return;
            if (mode === "replace") INS[k] = [];
            inc[k].forEach(x => {
              const hierK = k === "lot" || k === "prim" || k === "sec" || k === "qlt";
              const r = hierK ? { v: x.row.v } : { ...x.row };
              const ch = k === "prd" ? (r.__ch || "") : null;
              delete r.__ch;
              const old = INS[k].find(o => same(k, o, r) && (k !== "prd" || prdChainKey(o.id) === ch));
              if (old) kid.set(x.key, old.id);
              if (old) {
                if (mode !== "update" || hierK) { skip++; return; }
                let ch = false;
                ["q", "p", "tva", "nbr", "d1", "d2", "d3"].forEach(f => {
                  if (r[f] !== undefined && String(r[f]) !== String(old[f] ?? "")) { old[f] = r[f]; ch = true; }
                });
                ch ? upd++ : skip++;
                return;
              }
              r.id = insId(); r.on = false;
              if (k === "des") r.t = !!r.t;
              if (lk) r.lk = { src, key: x.key, links: hierK ? undefined
                : model.links.filter(l => l.dk === x.key || l.ck === x.key || l.pk === x.key) };
              INS[k].push(r); added++;
              kid.set(x.key, r.id);
            });
          });
          /* AVEC LIAISONS : les chemins du budget source deviennent des liaisons validées */
          let nl = 0;
          if (lk) {
            if (mode === "replace") INS.links = [];
            INS.links = INS.links || [];
            const ok = { des: new Set(INS.des.map(x => x.id)), lot: new Set(INS.lot.map(x => x.id)), prim: new Set(INS.prim.map(x => x.id)),
              sec: new Set(INS.sec.map(x => x.id)), prd: new Set(INS.prd.map(x => x.id)), chg: new Set(INS.chg.map(x => x.id)) };
            const fresh = new Set();
            model.links.forEach(l => {
              const des = kid.get(l.dk), lot = kid.get(l.lot), prim = kid.get(l.prim), sec = kid.get(l.sec);
              const pid = l.pk && kid.get(l.pk), cid = l.ck && kid.get(l.ck);
              if (!ok.des.has(des) || !ok.lot.has(lot) || !ok.prim.has(prim) || !ok.sec.has(sec)) return;
              if (!(pid && ok.prd.has(pid)) && !(cid && ok.chg.has(cid))) return;
              let L = INS.links.find(x => x.des === des && x.lot === lot && x.prim === prim && x.sec === sec);
              if (!L) { L = { id: insId(), des, lot, prim, sec, prd: [], chg: [] }; INS.links.push(L); nl++; }
              const add = (arr, id) => {
                const e = arr.find(x => x.id === id);
                /* même produit plusieurs fois sur la même tâche : quantités additionnées (une seule fois par import) */
                if (e) { if (fresh.has(e) && l.q !== "" && l.q !== undefined) e.q = (Number(e.q) || 0) + Number(l.q); }
                else { const n = { id, q: l.q === undefined ? "" : l.q }; arr.push(n); fresh.add(n); }
              };
              if (pid && ok.prd.has(pid)) add(L.prd = L.prd || [], pid);
              if (cid && ok.chg.has(cid)) add(L.chg = L.chg || [], cid);
            });
            /* une liaison doit avoir au moins un produit */
            INS.links = INS.links.filter(x => (x.prd || []).length);
            /* délais : rattachés à la tâche secondaire importée (lot + activité secondaire), seulement avec les liaisons */
            INS.dlp = INS.dlp || {};
            if (mode === "replace") INS.dlp = {};
            model.dly.filter(x => pk.dly.has(x.key)).forEach(x => {
              const lo = kid.get("lot|" + x.row.lot), pr = kid.get("sec|" + x.row.sec);
              if (!lo || !pr) return;
              const key = lo + "|" + pr, list = INS.dlp[key] = INS.dlp[key] || [];
              if (!list.some(p => p.deb === x.row._deb && p.fin === x.row._fin)) list.push({ id: insId(), deb: x.row._deb, fin: x.row._fin });
            });
          }
          insSave();
          const M = { add: "AJOUT", replace: "REMPLACEMENT", update: "MISE À JOUR" }[mode];
          insSortAll(); insSave();
          histLog("IMPORT", "DEPUIS UN AUTRE BUDGET — " + M, src + " — " + added + " AJOUTÉE(S), " + upd + " MISE(S) À JOUR, " + skip + " IGNORÉE(S)" + (lk ? " — " + nl + " LIAISON(S)" : ""));
          p.remove();
          refreshAll();
        };
        if (!busy.length) { run("add"); return; }
        /* des lignes existent déjà : l'utilisateur choisit */
        p.querySelector(".imp-ask")?.remove();
        const ask = document.createElement("div");
        ask.className = "imp-ask";
        ask.innerHTML = `<div class="imp-ask-card" role="dialog" aria-modal="true">
            <div class="imp-ask-t">DONNÉES DÉJÀ PRÉSENTES</div>
            <button type="button" class="imp-ask-b" data-mode="add"><b>AJOUTER</b><span>LES LIGNES EXISTANTES SONT GARDÉES ; LES LIGNES IDENTIQUES NE SONT PAS AJOUTÉES</span></button>
            <button type="button" class="imp-ask-b" data-mode="update"><b>METTRE À JOUR</b><span>LES LIGNES IDENTIQUES PRENNENT LA QUANTITÉ ET LE PRIX IMPORTÉS ; LES NOUVELLES S'AJOUTENT</span></button>
            <button type="button" class="imp-ask-b imp-ask-r" data-mode="replace"><b>REMPLACER</b><span>LES BLOCS CI-DESSUS SONT VIDÉS PUIS REMPLIS AVEC LES LIGNES IMPORTÉES</span></button>
            <div class="imp-ask-f"><button type="button" class="doc-btn" data-ask-cancel>ANNULER</button></div>
          </div>`;
        p.appendChild(ask);
        ask.addEventListener("click", ev => {
          ev.stopPropagation();
          if (ev.target === ask || ev.target.closest("[data-ask-cancel]")) { ask.remove(); return; }
          const b = ev.target.closest("[data-mode]");
          if (!b) return;
          /* REMPLACER : confirmation dans la fenêtre (pas de message Safari) */
          if (b.dataset.mode === "replace" && !ask.classList.contains("imp-ask-confirm")) {
            ask.classList.add("imp-ask-confirm");
            ask.querySelector(".imp-ask-card").innerHTML = `
              <div class="imp-ask-t">REMPLACER</div>
              <div class="imp-ask-w">LES LIGNES EXISTANTES DE ${busy.map(k => LAB[k]).join(", ")} SERONT SUPPRIMÉES.</div>
              <div class="imp-ask-f">
                <button type="button" class="doc-btn" data-ask-cancel>ANNULER</button>
                <button type="button" class="doc-btn imp-ask-ok" data-mode="replace">REMPLACER</button>
              </div>`;
            return;
          }
          run(b.dataset.mode);
        });
      });
    };

    /* ===== BUDGET ENTIER SUR UN SEUL ONGLET (export / import)
       une ligne par produit ou charge, avec toute sa chaîne ; les lignes non liées figurent seules.
       Ni prix, ni montant, ni TVA, ni délais ; QTE seulement pour les charges. ===== */
    const BF_HEAD = ["ART", "DÉSIGNATION CLIENT", "UPB", "LOT", "ACTIVITÉ PRIMAIRE", "ACTIVITÉ SECONDAIRE",
      "TYPE (PRD / CHG)", "ARTICLE", "DÉSIGNATION PRODUIT", "DÉSIGNATION CHARGE", "UNITÉ", "NBR", "DIM 1", "DIM 2", "DIM 3", "QTE"];
    /* lignes refaites en interne (IMPORT NON CRÉÉ) : une seule colonne de désignation du détail */
    const BF_HEAD_IN = ["ART", "DÉSIGNATION CLIENT", "UPB", "LOT", "ACTIVITÉ PRIMAIRE", "ACTIVITÉ SECONDAIRE",
      "TYPE (PRD / CHG)", "ARTICLE", "DÉSIGNATION PRODUIT / CHARGE", "UNITÉ", "NBR", "DIM 1", "DIM 2", "DIM 3", "QTE"];
    const budgetFlat = () => {
      const d = dupData();
      const by = (k, id) => (d[k] || []).find(x => x.id === id) || {};
      const n = v => v === "" || v === undefined || v === null ? "" : num(v);
      const AA = artAutoOf(d.des || []);   /* FORMAT 124 : ART calculé exporté */
      const desC = D => [D.art || AA.get(D.id) || "", U_(D.des), D.t ? "" : U_(D.u)];
      /* produits : pas d'article (FORMAT 6) — colonne ARTICLE vide sur les lignes PRD */
      const prdC = P => ["PRD", "", U_(P.des), "", U_(P.u), n(P.nbr), n(P.d1), n(P.d2), n(P.d3), ""];
      const chgC = (C, q) => ["CHG", C.art || "", "", U_(C.des), U_(C.u), "", "", "", "", n(q !== "" && q !== undefined ? q : C.q)];
      const rows = [], used = { lot: new Set(), prim: new Set(), sec: new Set(), prd: new Set(), chg: new Set() };
      (d.des || []).forEach(D => {
        const L = (d.links || []).filter(l => l.des === D.id);
        if (!L.length) { rows.push([...desC(D), ...Array(BF_HEAD.length - 3).fill("")]); return; }
        L.forEach(l => {
          const ch = [U_(by("lot", l.lot).v), U_(by("prim", l.prim).v), U_(by("sec", l.sec).v)];
          ["lot", "prim", "sec"].forEach(k => used[k].add(l[k]));
          (l.prd || []).forEach(x => { used.prd.add(x.id); rows.push([...desC(D), ...ch, ...prdC(by("prd", x.id))]); });
          (l.chg || []).forEach(x => { used.chg.add(x.id); rows.push([...desC(D), ...ch, ...chgC(by("chg", x.id), x.q)]); });
        });
      });
      [["lot", 3], ["prim", 4], ["sec", 5]].forEach(([k, c]) => (d[k] || []).filter(r => !used[k].has(r.id)).forEach(r => {
        const row = Array(BF_HEAD.length).fill(""); row[c] = U_(r.v); rows.push(row);
      }));
      (d.prd || []).filter(r => !used.prd.has(r.id)).forEach(P => rows.push(["", "", "", "", "", "", ...prdC(P)]));
      (d.chg || []).filter(r => !used.chg.has(r.id)).forEach(C => rows.push(["", "", "", "", "", "", ...chgC(C)]));
      /* FORMAT 105 : colonne PROJET en tête (projet du budget) */
      const pj = U_(budget.project || "");
      return { head: ["PROJET", ...BF_HEAD], rows: rows.map(r => [pj, ...r]) };
    };
    /* lecture d'un onglet : ligne d'en-tête trouvée (DÉSIGNATION CLIENT), colonnes par leur nom */
    const bfNorm = v => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
    const bfModel = aoa => {
      /* FORMAT 105 : en-tête = ligne portant DÉSIGNATION CLIENT, sinon la première ligne remplie */
      let hi = aoa.findIndex(r => (r || []).some(c => bfNorm(c) === "DESIGNATION CLIENT"));
      if (hi < 0) hi = aoa.findIndex(r => (r || []).some(c => String(c ?? "").trim() !== ""));
      if (hi < 0) throw new Error("TABLEAU VIDE");
      const H = aoa[hi].map(bfNorm);
      const col = (...names) => H.findIndex(h => names.some(x => h === x || (x.endsWith("*") && h.startsWith(x.slice(0, -1)))));
      const C = { art: col("ART"), dc: col("DESIGNATION CLIENT"), upb: col("UPB"), lot: col("LOT"), prim: col("ACTIVITE PRIMAIRE"),
        sec: col("ACTIVITE SECONDAIRE"), type: col("TYPE*"), article: col("ARTICLE"), des: col("DESIGNATION PRODUIT / CHARGE", "DESIGNATION"), desP: col("DESIGNATION PRODUIT"), desC: col("DESIGNATION CHARGE"), u: col("UNITE"),
        nbr: col("NBR"), d1: col("DIM 1", "DIM1"), d2: col("DIM 2", "DIM2"), d3: col("DIM 3", "DIM3"), q: col("QTE", "QUANTITE"), prj: col("PROJET", "PRJ") };
      /* colonnes recherchées absentes (ART et ARTICLE facultatifs) ; colonnes en trop ignorées */
      const NEED = [["prj", "PROJET"], ["dc", "DÉSIGNATION CLIENT"], ["upb", "UPB"], ["lot", "LOT"], ["prim", "ACTIVITÉ PRIMAIRE"], ["sec", "ACTIVITÉ SECONDAIRE"],
        ["type", "TYPE (PRD / CHG)"], ["des", "DÉSIGNATION PRODUIT / CHARGE"], ["u", "UNITÉ"], ["nbr", "NBR"], ["d1", "DIM 1"], ["d2", "DIM 2"], ["d3", "DIM 3"], ["q", "QTE"]];
      const miss = NEED.filter(([k]) => C[k] < 0 && !(k === "des" && (C.desP >= 0 || C.desC >= 0))).map(([, n]) => n);
      /* lignes d'un autre projet que celui du budget : ignorées */
      const PJ = U_((typeof budget !== "undefined" && budget && budget.project) || "");
      const other = r => C.prj >= 0 && !!PJ && U_(sviClean(r[C.prj] ?? "")) !== PJ;
      let prjIn = 0, prjOut = 0;
      const g = (r, k) => {
        /* désignation du détail : colonne commune, sinon DÉSIGNATION PRODUIT / DÉSIGNATION CHARGE (FORMAT 110) */
        if (k === "des" && C.des < 0) return sviClean((C.desP >= 0 ? r[C.desP] : "") ?? "") || sviClean((C.desC >= 0 ? r[C.desC] : "") ?? "");
        if (C[k] < 0) return "";
        const v = sviClean(r[C[k]] ?? "");
        /* FORMAT 108 : DIM à 0 = DIM vide */
        return /^d[123]$/.test(k) && String(v).trim() !== "" && sviNumOk(v) && num(v) === 0 ? "" : v;
      };
      const nn = v => String(v ?? "").trim() === "" ? "" : num(v);
      const m = { des: [], hier: [], chg: [], prd: [], qlt: [], dly: [], links: [], rej: [], miss, prjCol: C.prj >= 0, prj: PJ };
      const seen = new Map();
      const RAW = ["art", "dc", "upb", "lot", "prim", "sec", "type", "article", "des", "u", "nbr", "d1", "d2", "d3", "q"];
      const put = (k, key, row, hier) => { if (!seen.has(key)) { seen.set(key, true); hier ? m.hier.push({ key, lvl: k, row }) : m[k].push({ key, row }); } return key; };
      const seenLine = new Map();   /* doublons dans le fichier : tout identique sauf NBR / DIM / QTE */
      /* FORMAT 88 : une même désignation (ART + DÉSIGNATION) / un même produit (DÉSIGNATION) n'a qu'une unité ;
         la plus fréquente l'emporte (budget compris ; égalité : le budget, puis l'ordre du fichier) */
      const UW = { d: new Map(), p: new Map() };
      let uo = 0;
      const uAdd = (g, key, u, n) => { if (!key || !u) return; const M = UW[g].get(key) || UW[g].set(key, new Map()).get(key); const e = M.get(u) || M.set(u, { n: 0, o: uo++ }).get(u); e.n += n; };
      if (INS) {
        const nL = (k, id) => (INS.links || []).reduce((t, l) => t + (k === "des" ? (l.des === id ? (l.prd || []).length + (l.chg || []).length : 0) : (l.prd || []).some(x => x.id === id) ? 1 : 0), 0);
        INS.des.forEach(x => { if (!x.t) uAdd("d", U_(x.des), U_(x.u), Math.max(1, nL("des", x.id))); });
        INS.prd.forEach(x => uAdd("p", U_(x.des), U_(x.u), Math.max(1, nL("prd", x.id))));
      }
      aoa.slice(hi + 1).forEach(r => {
        if (!r || other(r)) return;
        const dc = U_(g(r, "dc")), t = bfNorm(g(r, "type")), dn = U_(g(r, "des"));
        if (dc && U_(g(r, "upb"))) uAdd("d", dc, U_(g(r, "upb")), 1);
        if (dn && t.startsWith("PRD") && U_(g(r, "u"))) uAdd("p", dn, U_(g(r, "u")), 1);
      });
      const uWin = (g, key) => { const M = UW[g].get(key); if (!M || M.size < 2) return null; const b = [...M].sort((a, c) => c[1].n - a[1].n || a[1].o - c[1].o)[0]; return { u: b[0], n: b[1].n }; };
      aoa.slice(hi + 1).forEach((r, ri) => {
        if (!r || !r.some(c => String(c ?? "").trim() !== "")) return;
        if (other(r)) { prjOut++; return; }
        prjIn++;
        const lineNo = (aoa.__line0 || 0) + hi + 2 + ri;   /* numéro de ligne dans le tableau source */
        const dc = U_(g(r, "dc")), lot = U_(g(r, "lot")), prim = U_(g(r, "prim")), sec = U_(g(r, "sec"));
        const t = bfNorm(g(r, "type")), dn = U_(g(r, "des"));
        let dk = "", pk = "", ck = "";
        /* ligne de liaison complète : mêmes règles que la saisie (FORMAT 74) ; non conforme → IMPORT NON CRÉÉ,
           et ni sa désignation sans UPB, ni son produit / sa charge ne sont créés */
        const isP = !!dn && t.startsWith("PRD"), isC = !!dn && t.startsWith("CHG");
        let lineBad = null;
        if (dc && lot && prim && sec && (isP || isC)) {
            /* mêmes règles que la saisie (FORMAT 74) : la ligne non conforme va dans IMPORT NON CRÉÉ */
            const bad = [], why = [];
            const z = v => String(v ?? "").trim() === "" || num(v) === 0;
            if (!U_(g(r, "upb"))) { bad.push("upb"); why.push("UPB MANQUANTE : LA DÉSIGNATION CLIENT NE PEUT PAS ÊTRE LIÉE"); }
            else {
              const w = uWin("d", dc);
              if (w && w.u !== U_(g(r, "upb"))) { bad.push("upb"); why.push("UPB " + U_(g(r, "upb")) + " ≠ UPB DE LA DÉSIGNATION " + dc + " (" + w.u + ", " + w.n + " LIGNE" + (w.n > 1 ? "S" : "") + ")"); }
            }
            /* produits : plusieurs unités permises (même repère en M3 et en M2) ; seule la liaison primaire
               impose l'unité de la désignation (règle B) */
            ["nbr", "d1", "d2", "d3", "q"].forEach(f => { if (!sviNumOk(g(r, f))) { bad.push(f); why.push("NOMBRE NON VALIDE : " + f.toUpperCase().replace(/^D(\d)$/, "DIM $1")); } });
            if (isP) {
              const u = U_(g(r, "u")), nd = sviUnitDims(u), known = ["U", "F", "M", "ML", "M2", "M3"].includes(u);
              if (z(g(r, "nbr"))) { bad.push("nbr"); why.push("NBR VIDE OU 0"); }
              [1, 2, 3].forEach(i => {
                const v = g(r, "d" + i);
                if (i > nd && String(v ?? "").trim() !== "") { bad.push("d" + i); why.push("UNITÉ " + u + " : " + (nd ? "NBR ET " + nd + " DIM" : "NBR SEUL") + " (DIM " + i + " EN TROP)"); }
                else if (known && i <= nd && z(v)) { bad.push("d" + i); why.push("UNITÉ " + u + " : DIM " + i + " À SAISIR"); }
              });
            }
            if (isC) {
              if (z(g(r, "q"))) { bad.push("q"); why.push("QTE VIDE OU 0"); }
              const c = chsFind(String(g(r, "article") ?? "").trim(), dn);
              if (c && U_(g(r, "u")) && U_(c.unit) && U_(g(r, "u")) !== U_(c.unit)) { bad.push("u"); why.push("UNITÉ " + U_(g(r, "u")) + " ≠ UNITÉ DE CHS (" + U_(c.unit) + ")"); }
            }
            if (bad.length) lineBad = { bad, why: why.join(" ; ") };
        }
        /* FORMAT 108 : produit sans NBR (même hors liaison complète) → IMPORT NON CRÉÉ */
        else if (isP && (String(g(r, "nbr") ?? "").trim() === "" || num(g(r, "nbr")) === 0)) lineBad = { bad: ["nbr"], why: "NBR VIDE OU 0" };
        if (dc && !(lineBad && lineBad.bad.includes("upb"))) {
          const row = { art: String(g(r, "art") ?? "").trim(), des: dc, u: U_(g(r, "upb")), tva: 20 };
          /* titre : ni unité, ni tâche, ni détail */
          if (!row.u && !lot && !t && !dn) row.t = true;
          dk = put("des", "des|" + impId("des", row), row);
        }
        const hk = [["lot", lot], ["prim", prim], ["sec", sec]].map(([k, v]) => v ? put(k, k + "|" + v, { v }, true) : "");
        if (lineBad) { /* rien de plus n'est créé */ }
        else if (dn && t.startsWith("PRD")) {
          const row = { des: dn, u: U_(g(r, "u")), nbr: nn(g(r, "nbr")), d1: nn(g(r, "d1")), d2: nn(g(r, "d2")), d3: nn(g(r, "d3")) };
          /* FORMAT 117 : quantités par tâche — une ligne produit par chaîne (désignation › lot › activités) */
          const ch = dc && lot && prim && sec ? [dc, lot, prim, sec].join("|") : "";
          row.__ch = ch;
          pk = put("prd", "prd|" + impId("prd", row) + (ch ? "#" + ch : ""), row);
        } else if (dn && t.startsWith("CHG")) {
          const row = { art: String(g(r, "article") ?? "").trim(), des: dn, u: U_(g(r, "u")), q: nn(g(r, "q")), tva: 20 };
          /* prix et TVA : depuis CHS */
          const c = chsFind(row.art, row.des);
          if (c) { row.chs = c.id; row.p = c.pcs; row.tva = c.tva; row.u = row.u || U_(c.unit); }
          ck = put("chg", "chg|" + impId("chg", row), row);
        }
        const src = Object.fromEntries(RAW.map(k => [k, String(g(r, k) ?? "").trim()]));
        src.__line = aoa.__lineFix || lineNo;
        if (lineBad) { m.rej.push({ src, bad: lineBad.bad, why: lineBad.why }); return; }
        if (dk && hk[0] && hk[1] && hk[2] && (pk || ck)) {
          const lk = ["dc", "upb", "lot", "prim", "sec", "type", "des", "u"].map(f => U_(src[f])).join("|");
          if (seenLine.has(lk)) { m.rej.push({ src, bad: ["des"], why: "DOUBLON DANS LE FICHIER : IDENTIQUE À LA LIGNE " + seenLine.get(lk) + " (SEULS NBR / DIM / QTE PEUVENT DIFFÉRER)" }); return; }
          seenLine.set(lk, src.__line);
          m.links.push({ dk, lot: hk[0], prim: hk[1], sec: hk[2], pk: pk || undefined, ck: ck || undefined, q: "", src }); return;
        }
        /* ligne qui voulait une liaison mais incomplète → onglet IMPORT NON CRÉÉ (raison + cases fautives) */
        const chain = !!(lot || prim || sec), det = !!(t || dn);
        if (!((dc && (chain || det)) || (chain && det))) return;
        const bad = [], why = [];
        if (!dc) { bad.push("dc"); why.push("DÉSIGNATION CLIENT MANQUANTE"); }
        if (!lot) { bad.push("lot"); why.push("LOT MANQUANT"); }
        if (!prim) { bad.push("prim"); why.push("ACTIVITÉ PRIMAIRE MANQUANTE"); }
        if (!sec) { bad.push("sec"); why.push("ACTIVITÉ SECONDAIRE MANQUANTE"); }
        if (!t.startsWith("PRD") && !t.startsWith("CHG")) { bad.push("type"); why.push(t ? "TYPE NON RECONNU (PRD OU CHG)" : "TYPE MANQUANT (PRD OU CHG)"); }
        if (!dn) { bad.push("des"); why.push("DÉSIGNATION DU DÉTAIL MANQUANTE"); }
        m.rej.push({ src, bad, why: why.join(" ; ") });
      });
      m.prjIn = prjIn; m.prjOut = prjOut;
      return m;
    };
    /* RÈGLE A à l'import (FORMAT) : une activité primaire, et une tâche secondaire (lot + activité secondaire),
       n'ont qu'une désignation client. On compte toutes les lignes (fichier, refusées comprises, et budget :
       une ligne par produit / charge de ses liaisons) ; le plus grand nombre l'emporte ; égalité : le budget,
       puis l'ordre du fichier. Les liaisons du budget qui perdent sont déliées (après confirmation) et vont
       dans IMPORT NON CRÉÉ. */
    const bfRuleA = (m, mode) => {
      const dKey = row => "des|" + impId("des", row);
      const G = { p: new Map(), s: new Map() };
      const names = new Map();
      let ord = 0;
      const add = (g, gk, dk, n, name) => {
        if (!gk || !dk) return;
        const M = G[g].get(gk) || G[g].set(gk, new Map()).get(gk);
        const e = M.get(dk) || M.set(dk, { n: 0, o: ord++ }).get(dk);
        e.n += n;
        if (name && !names.has(dk)) names.set(dk, name);
      };
      const byIdK = (k, id) => INS[k].find(x => x.id === id) || {};
      /* budget d'abord (prioritaire à égalité) — sauf REMPLACER */
      const exist = mode === "replace" ? [] : (INS.links || []).map(l => {
        const d = byIdK("des", l.des), lo = byIdK("lot", l.lot), pr = byIdK("prim", l.prim), se = byIdK("sec", l.sec);
        const dk = dKey(d), pk = "lot|" + U_(lo.v) + "#prim|" + U_(pr.v), sk = "lot|" + U_(lo.v) + "#sec|" + U_(se.v);
        const n = (l.prd || []).length + (l.chg || []).length;
        return { l, dk, pk, sk, n, name: d.des || "" };
      });
      exist.forEach(x => { add("p", x.pk, x.dk, x.n, x.name); add("s", x.sk, x.dk, x.n, x.name); });
      /* fichier : toutes les lignes, refusées comprises */
      /* une ligne refusée pour son unité ne compte pas pour la règle A (sa désignation est la même, mal écrite) */
      [...m.links.map(l => l.src), ...(m.rej || []).filter(r => !(r.bad || []).includes("upb")).map(r => r.src)].forEach(src => {
        if (!src) return;
        const dc = U_(src.dc);
        if (!dc) return;
        const dk = dKey({ art: String(src.art ?? "").trim(), des: dc, u: U_(src.upb) });
        if (U_(src.lot) && U_(src.prim)) add("p", "lot|" + U_(src.lot) + "#prim|" + U_(src.prim), dk, 1, dc);
        if (U_(src.lot) && U_(src.sec)) add("s", "lot|" + U_(src.lot) + "#sec|" + U_(src.sec), dk, 1, dc);
      });
      const win = g => new Map([...G[g]].map(([gk, M]) => {
        const best = [...M].sort((a, b) => b[1].n - a[1].n || a[1].o - b[1].o)[0];
        return [gk, { dk: best[0], n: best[1].n, name: names.get(best[0]) || "" }];
      }));
      const W = { p: win("p"), s: win("s") };
      /* liaisons du budget qui perdent */
      const lose = exist.filter(x => (W.p.get(x.pk) && W.p.get(x.pk).dk !== x.dk) || (W.s.get(x.sk) && W.s.get(x.sk).dk !== x.dk))
        .map(x => ({ ...x, by: W.p.get(x.pk).dk !== x.dk ? { g: "p", w: W.p.get(x.pk) } : { g: "s", w: W.s.get(x.sk) } }));
      return { W, lose, names };
    };
    const bfRuleAWhy = (g, w) => "RÈGLE A : " + (g === "p" ? "TÂCHE PRIMAIRE" : "TÂCHE SECONDAIRE") + " LIÉE À " + w.name + " (" + w.n + " LIGNE" + (w.n > 1 ? "S" : "") + ")";
    /* fenêtre de confirmation : liaisons du budget à délier */
    const bfRuleAAsk = plan => {
      if (!plan.lose.length) return Promise.resolve(true);
      const byIdK = (k, id) => INS[k].find(x => x.id === id) || {};
      const nDl = new Set(plan.lose.map(x => x.l.lot + "|" + x.l.sec).filter(k => (INS.dlp || {})[k] && INS.dlp[k].length
        && !(INS.links || []).some(l => !plan.lose.some(y => y.l === l) && l.lot + "|" + l.sec === k))).size;
      const html = `<div class="svc-sub">LIAISONS DU BUDGET À DÉLIER ${svCnt(plan.lose.length)} :</div>
        <ul class="svc-list">${plan.lose.map(x => `<li>${esc([x.name, byIdK("lot", x.l.lot).v, byIdK("prim", x.l.prim).v, byIdK("sec", x.l.sec).v].join(" › "))} — ${x.n} LIGNE${x.n > 1 ? "S" : ""}<br><b>GARDÉE : ${esc(x.by.w.name)} — ${x.by.w.n} LIGNE${x.by.w.n > 1 ? "S" : ""}</b></li>`).join("")}</ul>
        <div class="svc-sub">LES LIGNES DÉLIÉES VONT DANS L'ONGLET IMPORT NON CRÉÉ.</div>
`;
      return svConfirm({ title: "RÈGLE A — LIAISONS À DÉLIER", html, ok: "IMPORTER" });
    };
    /* ajoute le modèle au budget : AJOUTER / METTRE À JOUR / REMPLACER */
    const bfApply = (m, mode, srcName, quiet, plan, only) => {
      let added = 0, upd = 0, skip = 0, nl = 0;
      const kid = new Map();
      const K = ["des", "lot", "prim", "sec", "chg", "prd"];
      const inc = { des: m.des, chg: m.chg, prd: m.prd, lot: [], prim: [], sec: [] };
      m.hier.forEach(x => inc[x.lvl].push(x));
      K.forEach(k => {
        if (!inc[k].length) return;
        if (mode === "replace") INS[k] = [];
        const hierK = k === "lot" || k === "prim" || k === "sec";
        inc[k].forEach(x => {
          const r = hierK ? { v: x.row.v } : { ...x.row };
          const ch = k === "prd" ? (r.__ch || "") : null;
          delete r.__ch;
          const old = INS[k].find(o => hierK ? U_(o.v) === U_(r.v) : impId(k, o) === impId(k, r) && (k !== "prd" || prdChainKey(o.id) === ch));
          if (old) {
            kid.set(x.key, old.id);
            if (mode !== "update" || hierK) { skip++; return; }
            let ch = false;
            ["q", "nbr", "d1", "d2", "d3", "p", "tva", "chs"].forEach(f => { if (r[f] !== undefined && String(r[f]) !== String(old[f] ?? "")) { old[f] = r[f]; ch = true; } });
            ch ? upd++ : skip++;
            return;
          }
          r.id = insId(); r.on = false;
          if (k === "des") r.t = !!r.t;
          /* FORMAT 128 : actualisation partielle — un bloc non coché n'est jamais créé */
          if (only && !only.has(hierK ? "hier" : k)) return;
          INS[k].push(r); added++;
          kid.set(x.key, r.id);
        });
      });
      if (mode === "replace") { INS.links = []; INS.dlp = {}; }
      INS.links = INS.links || [];
      const rej = (m.rej || []).slice();
      /* règle A : sans confirmation (correction dans l'onglet), le budget n'est jamais délié */
      plan = plan || bfRuleA(m, mode);
      if (plan.lose.length && !plan.ok) plan.lose.forEach(x => { plan.W[x.by.g].set(x.by.g === "p" ? x.pk : x.sk, { dk: x.dk, n: x.n, name: x.name }); });
      if (plan.lose.length && plan.ok) {
        const by = (k, id) => INS[k].find(x => x.id === id) || {};
        const gone = new Set(plan.lose.map(x => x.l));
        plan.lose.forEach(x => {
          const d = by("des", x.l.des), base = { art: d.art || "", dc: d.des || "", upb: d.u || "", lot: by("lot", x.l.lot).v || "", prim: by("prim", x.l.prim).v || "", sec: by("sec", x.l.sec).v || "" };
          const why = "LIAISON DU BUDGET DÉLIÉE — " + bfRuleAWhy(x.by.g, x.by.w), bad = x.by.g === "p" ? ["lot", "prim"] : ["lot", "sec"];
          (x.l.prd || []).forEach(y => { const r = by("prd", y.id); rej.push({ src: { ...base, type: "PRD", article: "", des: r.des || "", u: r.u || "", nbr: r.nbr ?? "", d1: r.d1 ?? "", d2: r.d2 ?? "", d3: r.d3 ?? "", q: "" }, bad, why }); });
          (x.l.chg || []).forEach(y => { const r = by("chg", y.id); rej.push({ src: { ...base, type: "CHG", article: r.art || "", des: r.des || "", u: r.u || "", nbr: "", d1: "", d2: "", d3: "", q: y.q !== "" && y.q !== undefined ? y.q : (r.q ?? "") }, bad, why }); });
        });
        INS.links = INS.links.filter(l => !gone.has(l));
        /* délais : indépendants des liaisons — gardés */
        histLog("IMPORT", "RÈGLE A — LIAISONS DÉLIÉES", plan.lose.length + " LIAISON(S) DU BUDGET");
      }
      const byId = (k, id) => INS[k].find(x => x.id === id) || {};
      /* liaisons déjà dans le budget avant l'import : une ligne identique va dans IMPORT NON CRÉÉ */
      const had = new Set();
      (INS.links || []).forEach(l => { const c = [l.des, l.lot, l.prim, l.sec].join("|"); (l.prd || []).forEach(x => had.add(c + "|p|" + x.id)); (l.chg || []).forEach(x => had.add(c + "|c|" + x.id)); });
      const chgOnly = new Map();   /* liaison sans produit : ses charges iront dans IMPORT NON CRÉÉ */
      m.links.forEach(l => {
        const des = kid.get(l.dk), lot = kid.get(l.lot), prim = kid.get(l.prim), sec = kid.get(l.sec);
        const pid = l.pk && kid.get(l.pk), cid = l.ck && kid.get(l.ck);
        if (only && (!des || !lot || !prim || !sec) && (pid || cid)) {
          const miss = [!des && "DÉSIGNATION CLIENT", !lot && "LOT", !prim && "ACTIVITÉ PRIMAIRE", !sec && "ACTIVITÉ SECONDAIRE"].filter(Boolean);
          rej.push({ src: l.src, bad: [!des ? "dc" : !lot ? "lot" : !prim ? "prim" : "sec"], why: miss.join(", ") + " ABSENTE(S) DU BUDGET (BLOC NON ACTUALISÉ)" });
          return;
        }
        if (!des || !lot || !prim || !sec || (!pid && !cid)) return;
        const ch0 = [des, lot, prim, sec].join("|");
        if ((pid && had.has(ch0 + "|p|" + pid)) || (cid && had.has(ch0 + "|c|" + cid))) { rej.push({ src: l.src, bad: ["des"], why: "DOUBLON : EXISTE DÉJÀ DANS LE BUDGET (SEULS NBR / DIM / QTE PEUVENT DIFFÉRER)" }); return; }
        /* règle A : la désignation qui a le plus de lignes l'emporte (activité primaire, puis tâche secondaire) */
        const wp = plan.W.p.get(l.lot + "#" + l.prim), ws = plan.W.s.get(l.lot + "#" + l.sec);
        if (wp && wp.dk !== l.dk) { rej.push({ src: l.src, bad: ["lot", "prim"], why: bfRuleAWhy("p", wp) }); return; }
        if (ws && ws.dk !== l.dk) { rej.push({ src: l.src, bad: ["lot", "sec"], why: bfRuleAWhy("s", ws) }); return; }
        const other = INS.links.find(x => x.lot === lot && x.prim === prim && x.des !== des);
        if (other) { rej.push({ src: l.src, bad: ["lot", "prim"], why: "RÈGLE A : TÂCHE PRIMAIRE DÉJÀ LIÉE À " + (byId("des", other.des).des || "") }); return; }
        /* règle D : un produit / une charge une seule fois dans une tâche secondaire (lot + act. scd) */
        const dD = INS.links.find(x => x.lot === lot && x.sec === sec && !(x.des === des && x.prim === prim)
          && ((pid && (x.prd || []).some(y => y.id === pid)) || (cid && (x.chg || []).some(y => y.id === cid))));
        if (dD) { rej.push({ src: l.src, bad: ["des"], why: "RÈGLE D : DÉJÀ DANS LA TÂCHE SECONDAIRE " + (byId("lot", lot).v || "") + " › " + (byId("sec", sec).v || "") }); return; }
        /* règle B : liaison primaire (act. scd = act. prm) → produit de l'unité de la désignation */
        if (pid && U_(byId("prim", prim).v) === U_(byId("sec", sec).v)) {
          const du = U_(byId("des", des).u), pu = U_(byId("prd", pid).u);
          if (du && pu && du !== pu) { rej.push({ src: l.src, bad: ["u", "upb"], why: "RÈGLE B : LIAISON PRIMAIRE — UNITÉ " + pu + " ≠ UNITÉ DE LA DÉSIGNATION (" + du + ")" }); return; }
        }
        let L = INS.links.find(x => x.des === des && x.lot === lot && x.prim === prim && x.sec === sec);
        if (!pid && !(L && (L.prd || []).length)) { const key = [des, lot, prim, sec].join("|"); (chgOnly.get(key) || chgOnly.set(key, []).get(key)).push(l.src); }
        if (!L) { L = { id: insId(), des, lot, prim, sec, prd: [], chg: [] }; INS.links.push(L); nl++; }
        if (pid && !(L.prd = L.prd || []).some(y => y.id === pid)) L.prd.push({ id: pid, q: "" });
        if (cid && !(L.chg = L.chg || []).some(y => y.id === cid)) L.chg.push({ id: cid, q: "" });
      });
      /* charges d'une tâche restée sans produit */
      INS.links.filter(x => !(x.prd || []).length).forEach(x => {
        (chgOnly.get([x.des, x.lot, x.prim, x.sec].join("|")) || []).forEach(src => rej.push({ src, bad: ["type"], why: "AUCUN PRODUIT DANS CETTE TÂCHE (UNE LIAISON DOIT AVOIR AU MOINS UN PRODUIT)" }));
      });
      INS.links = INS.links.filter(x => (x.prd || []).length);
      insCleanLinks();
      if (mode === "replace") INS.inc = [];
      /* une même ligne refusée deux fois (import refait) n'apparaît qu'une fois */
      const incKey = x => JSON.stringify(["art", "dc", "upb", "lot", "prim", "sec", "type", "article", "des", "u", "nbr", "d1", "d2", "d3", "q"].map(f => U_((x.src || {})[f])));
      const inK = new Set((INS.inc || []).map(incKey));
      INS.inc = (INS.inc || []).concat(rej.filter(x => { const kk = incKey(x); if (inK.has(kk)) return false; inK.add(kk); return true; })
        .map(x => ({ id: insId(), on: false, src: x.src, bad: x.bad, why: x.why, line: (x.src || {}).__line || "" })));
      insSave();
      if (quiet) { refreshAll(); return rej; }
      insSortAll();
      const M = { add: "AJOUT", replace: "REMPLACEMENT", update: "MISE À JOUR" }[mode];
      histLog("IMPORT", "BUDGET COMPLET — " + M, srcName + " — " + added + " AJOUTÉE(S), " + upd + " MISE(S) À JOUR, " + skip + " IGNORÉE(S) — " + nl + " LIAISON(S)" + (rej.length ? " — " + rej.length + " NON CRÉÉE(S)" : ""));
      /* des liaisons n'ont pas pu être créées : l'onglet IMPORT NON CRÉÉ s'ouvre */
      if (rej.length) { active = "inc"; try { localStorage.setItem("svi_dtab_v1", "inc"); } catch (e) {} }
      refreshAll();
      return rej;
    };
    /* correction dans l'onglet : la ligne est réessayée ; complète et conforme, elle crée sa liaison et sort de l'onglet */
    const incTry = item => {
      INS.inc = (INS.inc || []).filter(x => x.id !== item.id);
      const s0 = item.src;
      /* ligne de délai : réessayée avec les règles des délais */
      if (U_(s0.type) === "DÉLAI") {
        const aoa = [DLY_HEAD, [s0.lot || "", s0.sec || "", s0.deb || "", s0.fin || "", "", s0.pred || "", s0.ltype || "", s0.loff || ""]];
        aoa.__lineFix = s0.__line || item.line || "";
        const before = (INS.inc || []).length;
        dlyImportAoa(aoa, "CORRECTION", true);
        const again = (INS.inc || []).slice(before);
        if (again.length) { again[0].id = item.id; again[0].on = item.on; }
        else histLog("IMPORT", "DÉLAI CRÉÉ (CORRECTION)", [s0.lot, s0.sec, s0.deb, s0.fin].filter(Boolean).join(" › "));
        insSave(); refreshAll();
        return;
      }
      const aoa = [BF_HEAD_IN, ["art", "dc", "upb", "lot", "prim", "sec", "type", "article", "des", "u", "nbr", "d1", "d2", "d3", "q"].map(k => s0[k] ?? "")];
      aoa.__lineFix = s0.__line || item.line || "";
      const before = (INS.inc || []).length;
      bfApply(bfModel(aoa), "add", "CORRECTION", true);
      const again = (INS.inc || []).slice(before);
      /* toujours refusée : elle garde sa place dans la liste */
      if (again.length) { again[0].id = item.id; again[0].on = item.on; }
      else histLog("IMPORT", "LIAISON CRÉÉE (CORRECTION)", [s0.dc, s0.lot, s0.prim, s0.sec, s0.des].filter(Boolean).join(" › "));
      insSave(); refreshAll();
    };
    /* ===== DÉLAIS dans l'export / l'import du budget (onglet DÉLAIS) ===== */
    /* 15/10/2026 : une seule période par tâche (plus de colonne PÉRIODE) ; liaisons en trois colonnes :
       PRÉDÉCESSEURS, TYPE (FIN → DÉBUT / DÉBUT → DÉBUT), DÉCALAGE (J), valeurs dans le même ordre, séparées par « ; » */
    const DLY_HEAD = ["LOT", "ACTIVITÉ SECONDAIRE", "DÉBUT", "FIN", "DURÉE (J)", "PRÉDÉCESSEURS", "TYPE", "DÉCALAGE (J)"];
    const DLY_TY = { FD: "FIN → DÉBUT", DD: "DÉBUT → DÉBUT" };
    const dlyExportRows = () => {
      const out = [];
      const keys = Object.keys(INS.dlp || {}).filter(k => (INS.dlp[k] || []).length);
      Object.keys(INS.dpred || {}).forEach(k => { if (!keys.includes(k)) keys.push(k); });
      keys.map(k => ({ k, n: dlyName(k) })).sort((a, b) => String(((INS.dlp[a.k] || [])[0] || {}).deb || "9").localeCompare(String(((INS.dlp[b.k] || [])[0] || {}).deb || "9")) || natCmp(a.n, b.n)).forEach(({ k }) => {
        const [lo, se] = k.split("|");
        const L = dlyLinks(k);
        const p = ((INS.dlp || {})[k] || [])[0] || {};
        out.push([lkName("lot", lo), lkName("sec", se), dFr(p.deb || ""), dFr(p.fin || ""), p.deb && p.fin ? dDur(p.deb, p.fin) : "",
          L.map(x => dlyName(x.k)).join(" ; "), L.map(x => DLY_TY[x.t === "DD" ? "DD" : "FD"]).join(" ; "), L.map(x => x.o || 0).join(" ; ")]);
      });
      return out;
    };
    /* nature d'un onglet : budget (DÉSIGNATION CLIENT) ou délais (ACTIVITÉ SECONDAIRE + DÉBUT / FIN, sans DÉSIGNATION CLIENT) */
    const sheetKind = aoa => {
      const rows = (aoa || []).slice(0, 15).map(r => (r || []).map(bfNorm));
      if (rows.some(r => r.includes("DESIGNATION CLIENT"))) return "budget";
      if (rows.some(r => r.includes("ACTIVITE SECONDAIRE") && (r.includes("DEBUT") || r.includes("FIN") || r.includes("PREDECESSEURS")))) return "dly";
      if (rows.some(r => r.includes("QUALITE"))) return "qlt";
      return "";
    };
    /* import de l'onglet QUALITÉ (FORMAT 132) : une ligne par libellé, TITRE = OUI pour un titre ; doublons ignorés */
    const qltImportAoa = (aoa, srcName, quiet) => {
      const hi = (aoa || []).findIndex(r => (r || []).map(bfNorm).includes("QUALITE"));
      if (hi < 0) return 0;
      const H = aoa[hi].map(bfNorm), cv = H.indexOf("QUALITE"), ct = H.indexOf("TITRE"), cp = H.findIndex(h => h === "PROJET" || h === "PRJ");
      const PJ = U_(budget.project || "");
      INS.qlt = INS.qlt || [];
      const have = new Set(INS.qlt.map(r => U_(r.v)));
      let n = 0;
      aoa.slice(hi + 1).forEach(r => {
        if (!r) return;
        if (cp >= 0 && PJ && U_(sviClean(r[cp] ?? "")) !== PJ) return;
        const v = U_(sviClean(r[cv] ?? ""));
        if (!v || have.has(v)) return;
        have.add(v);
        const row = { id: insId(), v, on: false };
        if (ct >= 0 && /^(OUI|X|1|TITRE)$/.test(bfNorm(r[ct]))) row.t = true;
        INS.qlt.push(row); n++;
      });
      if (!quiet) histLog("IMPORT", "QUALITÉ", (srcName || "") + " — " + n + " LIGNE(S)");
      insSave(); refreshAll();
      return n;
    };
    const dlyDate = v => {
      if (v === "" || v === null || v === undefined) return "";
      if (typeof v === "number" && v > 20000) { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000); return d.toISOString().slice(0, 10); }
      if (v instanceof Date && !isNaN(v)) return v.getFullYear() + "-" + String(v.getMonth() + 1).padStart(2, "0") + "-" + String(v.getDate()).padStart(2, "0");
      const t = String(v).trim();
      /* date complète renvoyée par le script (2026-10-13T23:00:00.000Z) : jour local */
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:/.test(t)) { const d = new Date(t); if (!isNaN(d)) return dlyDate(d); }
      if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
      const iso = dParse(t);
      return iso === null ? null : iso;
    };
    /* import de l'onglet DÉLAIS : mêmes règles que la saisie ; ligne refusée → IMPORT NON CRÉÉ (TYPE DÉLAI).
       Une seule période par tâche : plusieurs lignes d'une même tâche sont fusionnées (début de la première, fin de la dernière). */
    const dlyTyOf = t => { const n = bfNorm(t).replace(/[^A-Z]/g, ""); if (!n || n === "FD" || n === "FINDEBUT") return "FD"; if (n === "DD" || n === "DEBUTDEBUT") return "DD"; return null; };
    const dlyImportAoa = (aoa, srcName, quiet) => {
      const hi = (aoa || []).findIndex(r => (r || []).map(bfNorm).includes("ACTIVITE SECONDAIRE"));
      if (hi < 0) return 0;
      const H = aoa[hi].map(bfNorm), col = n => H.indexOf(n);
      const C = { lot: col("LOT"), sec: col("ACTIVITE SECONDAIRE"), deb: col("DEBUT"), fin: col("FIN"), dur: H.findIndex(h => h.startsWith("DUREE")), pred: col("PREDECESSEURS"),
        typ: col("TYPE"), off: H.findIndex(h => h.startsWith("DECALAGE")), prj: H.findIndex(h => h === "PROJET" || h === "PRJ") };
      const PJ = U_(budget.project || "");
      const cal = insCal();
      const g = (r, k) => C[k] < 0 ? "" : r[C[k]];
      const idOf = (k, name) => { const v = sviClean(name); if (!v) return ""; let r = INS[k].find(x => U_(x.v) === U_(v)); if (!r) { r = { id: insId(), v: U_(v), on: false }; INS[k].push(r); } return r.id; };
      const keyOf = txt => { const [a, b] = String(txt || "").split("›").map(x => x.trim()); return a && b ? idOf("lot", a) + "|" + idOf("sec", b) : ""; };
      INS.dlp = INS.dlp || {}; INS.dpred = INS.dpred || {};
      sviDpredTyped(INS);
      const rej = [], added = [];
      const srcOf = (r, ln) => ({ lot: sviClean(g(r, "lot")), sec: sviClean(g(r, "sec")), type: "DÉLAI", deb: String(g(r, "deb") ?? "").trim(), fin: String(g(r, "fin") ?? "").trim(),
        pred: sviClean(g(r, "pred")), ltype: sviClean(g(r, "typ")), loff: String(g(r, "off") ?? "").trim(), __line: aoa.__lineFix || ln });
      aoa.slice(hi + 1).forEach((r, ri) => {
        if (!r || !r.some(c => String(c ?? "").trim() !== "")) return;
        if (C.prj >= 0 && PJ && U_(sviClean(r[C.prj] ?? "")) !== PJ) return;   /* autre projet : ignorée */
        const ln = hi + 2 + ri, src = srcOf(r, ln);
        if (!src.lot || !src.sec) { rej.push({ src, bad: [!src.lot ? "lot" : "sec"], why: !src.lot ? "LOT MANQUANT" : "ACTIVITÉ SECONDAIRE MANQUANTE" }); return; }
        const key = idOf("lot", src.lot) + "|" + idOf("sec", src.sec);
        /* prédécesseurs « LOT › ACTIVITÉ SECONDAIRE ; … », avec TYPE et DÉCALAGE dans le même ordre ; la tâche elle-même et les boucles refusées */
        if (src.pred) {
          const bad = [];
          const tys = String(src.ltype || "").split(";").map(x => x.trim()), ofs = String(src.loff || "").split(";").map(x => x.trim());
          src.pred.split(";").map(x => x.trim()).filter(Boolean).forEach((t, n) => {
            const pk = keyOf(t);
            if (!pk) { bad.push("« " + t + " » : ÉCRIRE LOT › ACTIVITÉ SECONDAIRE"); return; }
            if (pk === key || dlyReach(pk, key)) { bad.push(t + " : BOUCLE"); return; }
            const ty = dlyTyOf(tys[n] || "");
            if (!ty) { bad.push(t + " : TYPE « " + tys[n] + " » NON RECONNU (FIN → DÉBUT OU DÉBUT → DÉBUT)"); return; }
            const o = ofs[n] || "";
            if (o !== "" && !/^\d+$/.test(o)) { bad.push(t + " : DÉCALAGE « " + o + " » NON VALIDE (NOMBRE DE JOURS ≥ 0)"); return; }
            const L = INS.dpred[key] = INS.dpred[key] || [];
            const ex = L.find(x => x.k === pk);
            if (ex) { ex.t = ty; ex.o = Number(o || 0); } else L.push({ k: pk, t: ty, o: Number(o || 0) });
          });
          if (bad.length) rej.push({ src: { ...src, deb: "", fin: "" }, bad: ["pred"], why: "PRÉDÉCESSEURS REFUSÉS : " + bad.join(" ; ") });
        }
        let deb = dlyDate(g(r, "deb")), fin = dlyDate(g(r, "fin"));
        if (!deb && !fin) return;
        if (deb === null || fin === null) { rej.push({ src, bad: [deb === null ? "deb" : "fin"], why: "DATE NON VALIDE : FORMAT JJ/MM/AAAA" }); return; }
        if (deb && !sviWork(cal, deb)) { rej.push({ src, bad: ["deb"], why: "DÉBUT SUR UN JOUR NON TRAVAILLÉ" }); return; }
        if (deb && !fin && String(g(r, "dur") ?? "").trim() !== "" && /^\d+$/.test(String(g(r, "dur")).trim()) && Number(g(r, "dur")) >= 1) fin = sviWFin(cal, deb, Number(g(r, "dur")));
        if (!deb || !fin) { rej.push({ src, bad: [!deb ? "deb" : "fin"], why: !deb ? "DÉBUT MANQUANT" : "FIN MANQUANTE" }); return; }
        if (!sviWork(cal, fin)) { rej.push({ src, bad: ["fin"], why: "FIN SUR UN JOUR NON TRAVAILLÉ" }); return; }
        if (fin < deb) { rej.push({ src, bad: ["fin"], why: "LA FIN EST AVANT LE DÉBUT" }); return; }
        if (INS.dbut && fin > INS.dbut) { rej.push({ src, bad: ["fin"], why: "FIN APRÈS LA DATE BUTOIR (" + dFr(INS.dbut) + ")" }); return; }
        added.push({ key, deb, fin, src });
      });
      /* une seule période par tâche : lignes d'une même tâche fusionnées (début le plus tôt, fin la plus tardive) */
      const one = new Map();
      added.forEach(c => { const x = one.get(c.key); if (!x) one.set(c.key, { ...c }); else { if (c.deb < x.deb) x.deb = c.deb; if (c.fin > x.fin) x.fin = c.fin; } });
      const cand = [...one.values()];
      /* la tâche commence au plus tôt à la date exigée par ses liaisons (dates connues : fichier, sinon budget) */
      const finOf = k => { const c = one.get(k); return c ? c.fin : (((INS.dlp || {})[k] || [])[0] || {}).fin || ""; };
      const debOf = k => { const c = one.get(k); return c ? c.deb : (((INS.dlp || {})[k] || [])[0] || {}).deb || ""; };
      let nAdd = 0;
      cand.forEach(c => {
        const pf = dlyNeedOf(c.key, finOf, debOf);
        if (pf && c.deb < pf) { rej.push({ src: c.src, bad: ["deb"], why: "DÉBUT AVANT LA DATE IMPOSÉE PAR LES LIAISONS (" + dFr(pf) + ")" }); return; }
        const list = INS.dlp[c.key] = INS.dlp[c.key] || [];
        if (list.length) { list.splice(1); list[0].deb = c.deb; list[0].fin = c.fin; } else list.push({ id: insId(), deb: c.deb, fin: c.fin });
        nAdd++;
      });
      const kk = x => JSON.stringify(["lot", "sec", "type", "deb", "fin", "pred"].map(f => U_((x.src || {})[f])));
      const inK = new Set((INS.inc || []).map(kk));
      INS.inc = (INS.inc || []).concat(rej.filter(x => { const k = kk(x); if (inK.has(k)) return false; inK.add(k); return true; })
        .map(x => ({ id: insId(), on: false, src: x.src, bad: x.bad, why: x.why, line: x.src.__line || "" })));
      dlySortByDeb();
      if (!quiet) {
        histLog("IMPORT", "DÉLAIS", (srcName || "") + " — " + nAdd + " TÂCHE(S) DATÉE(S)" + (rej.length ? " — " + rej.length + " NON CRÉÉE(S)" : ""));
        if (rej.length) { active = "inc"; try { localStorage.setItem("svi_dtab_v1", "inc"); } catch (e) {} }
      }
      insSave(); refreshAll();
      return rej.length;
    };
    const bfImportAoa = async (aoa, srcName) => {
      /* onglet DÉLAIS seul : seuls les délais sont importés */
      if (sheetKind(aoa) === "dly") { dlyImportAoa(aoa, srcName); return true; }
      if (sheetKind(aoa) === "qlt") { qltImportAoa(aoa, srcName); return true; }
      let m;
      try { m = bfModel(aoa); } catch (e) {
        svImportFail({ source: srcName, tries: [{ err: e }], found: (aoa || []).find(r => (r || []).some(c => String(c ?? "").trim())) || [],
          hint: "LA PREMIÈRE LIGNE DU TABLEAU DOIT PORTER LES COLONNES : ART, DÉSIGNATION CLIENT, UPB, LOT, ACTIVITÉ PRIMAIRE, ACTIVITÉ SECONDAIRE, TYPE (PRD / CHG), ARTICLE, DÉSIGNATION, UNITÉ, NBR, DIM 1 À 3, QTE. EXPORTER UN BUDGET DONNE LE BON MODÈLE." });
        return;
      }
      /* FORMAT 105 : colonnes manquantes → IMPORTER QUAND MÊME / ANNULER */
      if (m.miss.length) {
        const v = await svChoose({ title: "COLONNE(S) MANQUANTE(S)", html: `<div class="svc-sub">${esc(srcName || "")}</div><div class="svc-sub">CES COLONNES N'EXISTENT PAS DANS LA PREMIÈRE LIGNE DU TABLEAU :</div><ul class="svc-list">${m.miss.map(n => `<li>${esc(n)}</li>`).join("")}</ul><div class="svc-sub">IMPORTER QUAND MÊME (CES COLONNES SERONT LUES VIDES) ?</div>`,
          buttons: [{ v: "go", label: "IMPORTER QUAND MÊME", tone: "neutral" }] });
        if (v !== "go") return false;
      }
      if (m.prjCol && m.prj && !m.prjIn) {
        svImportFail({ source: srcName, tries: [{ err: "AUCUNE LIGNE POUR LE PROJET " + m.prj }], found: [],
          hint: "LA COLONNE PROJET DOIT PORTER " + m.prj + " (PROJET DU BUDGET OUVERT)." });
        return false;
      }
      if (!m.des.length && !m.hier.length && !m.prd.length && !m.chg.length) {
        svImportFail({ source: srcName, tries: [{ err: "AUCUNE LIGNE À IMPORTER SOUS L'EN-TÊTE" }], found: (aoa || []).find(r => (r || []).some(c => String(c ?? "").trim())) || [],
          hint: "VÉRIFIER QUE LES LIGNES SONT REMPLIES SOUS LA LIGNE D'EN-TÊTE, DANS LE BON ONGLET." });
        return;
      }
      const busy = ["des", "lot", "prim", "sec", "chg", "prd"].some(k => INS[k].length);
      if (!busy) { bfApply(m, "add", srcName); return true; }
      let done = false;
      const goA = async mode => { const plan = bfRuleA(m, mode); if (!(await bfRuleAAsk(plan))) return; plan.ok = true; bfApply(m, mode, srcName, false, plan); done = true; };
      const v = await svChoose({ title: "DONNÉES DÉJÀ PRÉSENTES", buttons: [
        { v: "add", label: "AJOUTER", tone: "neutral" }, { v: "update", label: "METTRE À JOUR", tone: "neutral" }, { v: "replace", label: "REMPLACER", tone: "danger" }] });
      if (!v) return;
      if (v === "replace" && !(await svConfirm({ title: "REMPLACER", text: "TOUTES LES LIGNES ET LIAISONS DU BUDGET SERONT SUPPRIMÉES PUIS REMPLACÉES PAR CELLES DU FICHIER.", ok: "REMPLACER" }))) return;
      await goA(v);
      return done;
    };
    /* ===== FORMAT 128 : ACTUALISER DEPUIS LA SOURCE ===== */
    const srcRemember = o => { if (!INS) return; const d = new Date(), p2 = n => String(n).padStart(2, "0");
      INS.src = { ...o, date: p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + d.getFullYear() + " À " + p2(d.getHours()) + ":" + p2(d.getMinutes()) }; insSave(); };
    /* relit la source : { aoa, daoa, name } (fichier : choisi de nouveau, Safari ne relit pas un fichier seul) */
    /* Google Sheets : un onglet du même classeur lu par son nom (script, sinon feuille partagée) ;
       gardé seulement s'il est bien de la nature attendue (un ancien script renvoie l'onglet du lien) */
    const gsTab = async (url, names, kind) => {
      for (const nm of names) {
        for (const call of [() => apiGet("sheetRead", { link: url, sheet: nm }), () => apiPost("sheetRead", { link: url, sheet: nm })]) {
          try { const d = await call(); if (d && d.ok && Array.isArray(d.values) && sheetKind(d.values) === kind) return { aoa: d.values, sheet: d.sheet || nm }; } catch (e) {}
        }
      }
      const id = (url.match(/\/d\/([a-zA-Z0-9_-]+)/) || [])[1];
      if (!id) return null;
      for (const nm of names) {
        try {
          const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(nm)}`);
          if (!r.ok) continue;
          const X = await loadXLSX(), wb = X.read(await r.text(), { type: "string", raw: true });
          const aoa = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false });
          if (sheetKind(aoa) === kind) return { aoa, sheet: nm };
        } catch (e) {}
      }
      return null;
    };
    const srcRead = (src, need) => new Promise(async (ok, ko) => {
      try {
        if (src.kind === "gsheet") {
          need = need || new Set(["budget", "dly", "qlt"]);
          let aoa = null, name = src.name;
          if (need.has("budget")) {
            let d = null;
            for (const call of [() => apiGet("sheetRead", { link: src.url }), () => apiPost("sheetRead", { link: src.url })]) { try { d = await call(); if (d && d.ok && Array.isArray(d.values)) break; } catch (e) {} d = null; }
            if (d) { aoa = d.values; name = d.name || src.name; }
            else {
              const id = src.url.match(/\/d\/([a-zA-Z0-9_-]+)/)[1], gid = (src.url.match(/[#&?]gid=(\d+)/) || [])[1] || "0";
              const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`);
              if (!r.ok) throw new Error("HTTP " + r.status + " — ACCÈS REFUSÉ");
              const X = await loadXLSX(), wb = X.read(await r.text(), { type: "string" });
              aoa = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
            }
          }
          const D = need.has("dly") ? await gsTab(src.url, [src.dsheet, "DÉLAIS", "DELAIS"].filter(Boolean), "dly") : null;
          const Q = need.has("qlt") ? await gsTab(src.url, [src.qsheet, "QUALITÉ", "QUALITE"].filter(Boolean), "qlt") : null;
          return ok({ aoa, daoa: D && D.aoa, qaoa: Q && Q.aoa, dsheet: D && D.sheet, qsheet: Q && Q.sheet, name });
        }
        const inp = document.createElement("input");
        inp.type = "file"; inp.accept = ".xlsx,.xls,.csv";
        inp.onchange = async () => {
          try {
            const f = inp.files[0];
            if (!f) return ok(null);
            if (f.name !== src.name) svToast("FICHIER « " + f.name + " » — LA SOURCE ÉTAIT « " + src.name + " ».", 5000);
            const X = await loadXLSX(), wb = X.read(await f.arrayBuffer(), { type: "array" });
            const J = n => X.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: "" });
            const kinds = wb.SheetNames.map(n => ({ n, k: sheetKind(J(n)) }));
            const bn = wb.SheetNames.includes(src.sheet) ? src.sheet : (kinds.find(x => x.k === "budget") || {}).n || wb.SheetNames[0];
            const dn = (src.dsheet && wb.SheetNames.includes(src.dsheet)) ? src.dsheet : (kinds.find(x => x.k === "dly") || {}).n;
            const qn = (src.qsheet && wb.SheetNames.includes(src.qsheet)) ? src.qsheet : (kinds.find(x => x.k === "qlt") || {}).n;
            ok({ aoa: J(bn), daoa: dn ? J(dn) : null, qaoa: qn ? J(qn) : null, dsheet: dn, qsheet: qn, name: f.name + " › " + bn });
          } catch (e) { ko(e); }
        };
        inp.click();
      } catch (e) { ko(e); }
    });
    const srcRefresh = async () => {
      if (!INS || !INS_EDIT || !INS.src) return;
      const S = INS.src;
      const opts = [["prd", "DÉTAIL PRODUITS (produits, NBR / DIM et leurs liaisons)"], ["chg", "DÉTAIL CHARGES (charges, QTE et leurs liaisons)"],
        ["des", "DÉSIGNATIONS CLIENT (ART, désignations, UPB, titres)"], ["hier", "TÂCHES (lots, activités primaires et secondaires)"], ["dly", "DÉLAIS (onglet DÉLAIS)"], ["qlt", "QUALITÉ (onglet QUALITÉ)"]];
      const sel = new Set();
      const html = `<div class="svc-sub">SOURCE : ${esc(S.kind === "gsheet" ? "GOOGLE SHEETS — " : "FICHIER — ")}${esc(S.name || "")}${S.sheet ? " › " + esc(S.sheet) : ""}</div>
        <div class="svc-sub">DERNIER IMPORT : ${esc(S.date || "")}</div>
        <div class="svc-sub"><b>CE QUI EST EFFACÉ PUIS RÉIMPORTÉ :</b></div>
        <label class="src-opt src-all"><input type="checkbox" data-src-all> TOUT SÉLECTIONNER</label>
        ${opts.map(([k, l]) => `<label class="src-opt"><input type="checkbox" data-src-k="${k}"> ${esc(l.toUpperCase())}</label>`).join("")}
        <div class="svc-sub">LES BLOCS NON COCHÉS NE SONT PAS TOUCHÉS. DOCUMENTS / TAF / OBSERVATIONS SONT TOUJOURS GARDÉS.</div>`;
      const pr = svChoose({ title: "ACTUALISER DEPUIS LA SOURCE", html, buttons: [{ v: "go", label: "ACTUALISER", tone: "danger", disabled: true }] });
      const dlg = document.getElementById("svConf");
      dlg && dlg.addEventListener("change", e => {
        const all = e.target.closest("input[data-src-all]"), c = e.target.closest("input[data-src-k]");
        if (!all && !c) return;
        const L = [...dlg.querySelectorAll("input[data-src-k]")];
        if (all) L.forEach(x => { x.checked = all.checked; });
        sel.clear(); L.forEach(x => { if (x.checked) sel.add(x.dataset.srcK); });
        const A = dlg.querySelector("input[data-src-all]");
        if (A) { A.checked = sel.size === L.length; A.indeterminate = sel.size > 0 && sel.size < L.length; }
        const b = dlg.querySelector('[data-v="go"]'); if (b) b.disabled = !sel.size;
      });
      if ((await pr) !== "go" || !sel.size) return;
      let got;
      const need = new Set([...(["prd", "chg", "des", "hier"].some(k => sel.has(k)) ? ["budget"] : []), ...["dly", "qlt"].filter(k => sel.has(k))]);
      try { got = await srcRead(S, need); } catch (err) { svImportFail({ source: S.name, tries: [{ err }], hint: "SOURCE ILLISIBLE : RÉIMPORTER LE BUDGET PAR ⋯ › IMPORTER." }); return; }
      if (!got) return;
      const kinds = new Set(sel);
      if (kinds.has("prd") || kinds.has("chg") || kinds.has("des") || kinds.has("hier")) {
        let m;
        try { m = bfModel(got.aoa); } catch (err) { svImportFail({ source: got.name, tries: [{ err }], found: [] }); return; }
        if (m.miss.length) {
          const v = await svChoose({ title: "COLONNE(S) MANQUANTE(S)", html: `<div class="svc-sub">${esc(m.miss.join(", "))}</div><div class="svc-sub">ACTUALISER QUAND MÊME ?</div>`, buttons: [{ v: "go", label: "ACTUALISER QUAND MÊME", tone: "neutral" }] });
          if (v !== "go") return;
        }
        /* effacement des blocs cochés (et des liaisons qui en dépendent) */
        const T = { prd: "PRD", chg: "CHG" };
        if (kinds.has("des") || kinds.has("hier")) INS.links = [];
        if (kinds.has("prd")) { INS.prd = []; (INS.links || []).forEach(l => { l.prd = []; }); }
        if (kinds.has("chg")) { INS.chg = []; (INS.links || []).forEach(l => { l.chg = []; }); }
        if (kinds.has("des")) INS.des = [];
        if (kinds.has("hier")) { INS.lot = []; INS.prim = []; INS.sec = []; }
        INS.links = (INS.links || []).filter(l => (l.prd || []).length);
        INS.inc = (INS.inc || []).filter(x => { const t = U_((x.src || {}).type || ""); if (t === "DÉLAI") return true; if (kinds.has("des") || kinds.has("hier")) return false; return !Object.keys(T).some(k => kinds.has(k) && t.startsWith(T[k])); });
        const only = new Set(kinds);
        const plan = bfRuleA(m, "add");
        if (!(await bfRuleAAsk(plan))) { insSave(); refreshAll(); return; }
        plan.ok = true;
        const bef = { prd: new Set(INS.prd.map(r => r.id)), chg: new Set(INS.chg.map(r => r.id)) };
        bfApply(m, "add", "ACTUALISATION — " + got.name, false, plan, only);
        /* produit / charge d'une ligne refusée (désignation ou tâche absente) : pas créé seul */
        const rk = new Set((INS.inc || []).filter(x => /ABSENTE\(S\) DU BUDGET/.test(x.why || "")).map(x => U_((x.src || {}).type || "").slice(0, 3) + "|" + U_((x.src || {}).des) + "|" + U_((x.src || {}).u)));
        ["prd", "chg"].forEach(k => { INS[k] = INS[k].filter(r => bef[k].has(r.id) || (INS.links || []).some(l => (l[k] || []).some(x => x.id === r.id)) || !rk.has((k === "prd" ? "PRD" : "CHG") + "|" + U_(r.des) + "|" + U_(r.u))); });
      }
      /* onglet absent : ce bloc n'est pas touché, dit en une ligne */
      const absent = [];
      if (kinds.has("dly")) { if (got.daoa) { INS.dlp = {}; INS.dpred = {}; INS.inc = (INS.inc || []).filter(x => U_((x.src || {}).type || "") !== "DÉLAI"); dlyImportAoa(got.daoa, got.name); } else { absent.push("DÉLAIS"); kinds.delete("dly"); } }
      if (kinds.has("qlt")) { if (got.qaoa) { INS.qlt = []; qltImportAoa(got.qaoa, got.name, true); } else { absent.push("QUALITÉ"); kinds.delete("qlt"); } }
      if (absent.length) svToast("ONGLET " + absent.join(" ET ") + " INTROUVABLE DANS LA SOURCE : NON ACTUALISÉ.", 6000);
      srcRemember({ ...S, name: S.kind === "file" ? (got.name.split(" › ")[0] || S.name) : S.name, ...(got.dsheet ? { dsheet: got.dsheet } : {}), ...(got.qsheet ? { qsheet: got.qsheet } : {}) });
      if (kinds.size) histLog("IMPORT", "ACTUALISATION DEPUIS LA SOURCE", got.name + " — " + [...kinds].map(k => ({ prd: "PRODUITS", chg: "CHARGES", des: "DÉSIGNATIONS", hier: "TÂCHES", dly: "DÉLAIS", qlt: "QUALITÉ" })[k]).join(", "));
      insSave(); refreshAll();
    };
    /* IMPORTER UN BUDGET : fichier Excel (iPad) ou Google Sheets (Drive) ; un seul onglet */
    const openBudgetImport = () => {
      const p = popup(`
        <div class="blk-card">
          <button type="button" class="blk-x" data-close>✕</button>
          <div class="blk-title">IMPORTER UN BUDGET</div>
          <button type="button" class="blk-choice" data-src="file">FICHIER EXCEL (SUR L'IPAD)</button>
          <button type="button" class="blk-choice" data-src="gsheet">GOOGLE SHEETS (DRIVE)</button>
        </div>`);
      p.addEventListener("click", async e => {
        const b = e.target.closest("[data-src]");
        if (!b) return;
        p.remove();
        if (b.dataset.src === "file") {
          const inp = document.createElement("input");
          inp.type = "file";
          inp.accept = ".xlsx,.xls,.csv";
          inp.onchange = async () => {
            const f = inp.files[0];
            if (!f) return;
            try {
              const X = await loadXLSX();
              const wb = X.read(await f.arrayBuffer(), { type: "array" });
              let sh = wb.SheetNames[0];
              /* onglets BUDGET et DÉLAIS (export de l'application) : les deux sont importés */
              const kinds = wb.SheetNames.map(n => ({ n, k: sheetKind(X.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: "" })) }));
              const bS = kinds.filter(x => x.k === "budget"), dS = kinds.filter(x => x.k === "dly"), qS = kinds.filter(x => x.k === "qlt");
              if (bS.length === 1 && (dS.length === 1 || qS.length === 1) && dS.length < 2 && qS.length < 2) {
                const J = n => X.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: "" });
                const ok = await bfImportAoa(J(bS[0].n), f.name + " › " + bS[0].n);
                if (ok) {
                  if (dS[0]) dlyImportAoa(J(dS[0].n), f.name + " › " + dS[0].n);
                  if (qS[0]) qltImportAoa(J(qS[0].n), f.name + " › " + qS[0].n);
                  srcRemember({ kind: "file", name: f.name, sheet: bS[0].n, dsheet: (dS[0] || {}).n, qsheet: (qS[0] || {}).n });
                }
                return;
              }
              /* plusieurs onglets : lequel ? */
              if (wb.SheetNames.length > 1) {
                sh = await svChoose({ title: "QUEL ONGLET ?", buttons: wb.SheetNames.map(n => ({ v: n, label: n, tone: "neutral" })) });
                if (!sh) return;
              }
              const aoa = X.utils.sheet_to_json(wb.Sheets[sh], { header: 1, defval: "" });
              if (await bfImportAoa(aoa, f.name + " › " + sh)) srcRemember({ kind: "file", name: f.name, sheet: sh });
            } catch (err) { svImportFail({ source: f.name, tries: [{ err }], hint: "VÉRIFIER QUE LE FICHIER EST UN EXCEL (.XLSX) OU UN CSV, NON PROTÉGÉ PAR MOT DE PASSE." }); }
          };
          inp.click();
          return;
        }
        /* Google Sheets : lien de la feuille (l'onglet ouvert dans le lien est celui lu) */
        const url = await askSheetLink();
        if (!url) return;
        if (!/\/d\/[a-zA-Z0-9_-]+/.test(url)) { svImportFail({ source: url, tries: [{ err: "LIEN GOOGLE SHEETS NON RECONNU" }], hint: "COPIER LE LIEN COMPLET DE LA FEUILLE (IL CONTIENT /spreadsheets/d/…)." }); return; }
        let first = "";
        for (const call of [() => apiGet("sheetRead", { link: url }), () => apiPost("sheetRead", { link: url })]) {
          try {
            const d = await call();
            if (d && d.ok && Array.isArray(d.values)) { if (await bfImportAoa(d.values, d.name || "GOOGLE SHEETS")) srcRemember({ kind: "gsheet", url, name: d.name || "GOOGLE SHEETS" }); return; }
            first = first || "LE SCRIPT NE CONNAÎT PAS ENCORE LA LECTURE DE FEUILLE (NOUVELLE VERSION À DÉPLOYER)";
          } catch (err) { first = first || (err && err.message) || String(err); }
        }
        /* repli : feuille partagée « Toute personne disposant du lien » */
        try {
          const id = url.match(/\/d\/([a-zA-Z0-9_-]+)/)[1], gid = (url.match(/[#&?]gid=(\d+)/) || [])[1] || "0";
          const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`);
          if (!r.ok) throw new Error("HTTP " + r.status + " — ACCÈS REFUSÉ (FEUILLE NON PARTAGÉE)");
          const X = await loadXLSX();
          const wb = X.read(await r.text(), { type: "string" });
          if (await bfImportAoa(X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" }), "GOOGLE SHEETS")) srcRemember({ kind: "gsheet", url, name: "GOOGLE SHEETS" });
          return;
        } catch (err2) { var pub = err2; }
        svImportFail({ source: "GOOGLE SHEETS — " + url, tries: [{ via: "PAR LE SCRIPT", err: first }, { via: "PAR LE LIEN PUBLIC", err: pub }], hint: "VÉRIFIER LE LIEN, QUE VOTRE COMPTE GOOGLE A ACCÈS À LA FEUILLE, OU LA PARTAGER « TOUTE PERSONNE DISPOSANT DU LIEN » ; SINON EXPORTER LA FEUILLE EN EXCEL ET IMPORTER LE FICHIER." });
      });
    };
    /* menu ⋯ du haut : DUPLIQUER, DISPOSITION PAR DÉFAUT, EXPORTER / IMPORTER LE BUDGET */
    const openBdgMore = btn => {
      const old = document.getElementById("blkMenu");
      if (old && old.dataset.for === "bdgMore") { old.remove(); return; }
      old?.remove();
      const rb = $("layResetBtn");
      const items = [
        { a: "dup", lab: "DUPLIQUER", ic: '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>' },
        { a: "lay", lab: "DISPOSITION PAR DÉFAUT", off: !rb || rb.disabled, ic: '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M4 3.8v4.6h4.6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
        { a: "exp", lab: "EXPORTER LE BUDGET", ic: '<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10V2M4.5 5.5 8 2l3.5 3.5M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
        ...(INS_EDIT ? [{ a: "imp", lab: "IMPORTER UN BUDGET", ic: '<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' }] : []),
        ...(INS_EDIT && INS && INS.src ? [{ a: "src", lab: "ACTUALISER DEPUIS LA SOURCE", ic: '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.7-4.4M4 4v4h4M4 13a8 8 0 0 0 14.7 4.4M20 20v-4h-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' }] : []),
      ];
      const m = document.createElement("div");
      m.id = "blkMenu";
      m.dataset.for = "bdgMore";
      m.innerHTML = items.map(x => `<button type="button" data-a="${x.a}" class="${x.off ? "blk-del off" : ""}" ${x.off ? "disabled" : ""}>${x.ic}<span>${x.lab}</span></button>`).join("");
      document.body.appendChild(m);
      const r = btn.getBoundingClientRect();
      sviPlaceMenu(m, r);
      m.addEventListener("click", e => {
        const it = e.target.closest("[data-a]");
        if (!it || it.classList.contains("off")) return;
        m.remove();
        if (it.dataset.a === "dup") $("instDup")?.click();
        else if (it.dataset.a === "lay") $("layResetBtn")?.click();
        else if (it.dataset.a === "exp") openExportMenu("budget");
        else if (it.dataset.a === "imp") openBudgetImport();
        else if (it.dataset.a === "src") srcRefresh();
      });
      setTimeout(() => document.addEventListener("click", function off(e) {
        if (!e.target.closest("#blkMenu")) { m.remove(); document.removeEventListener("click", off, true); }
      }, true), 0);
    };
    const openImportMenu = blk => {
      const p = popup(`
        <div class="blk-card">
          <button type="button" class="blk-x" data-close>✕</button>
          <div class="blk-title">IMPORTER — ${esc(blkDisp(blk))}</div>
          <button type="button" class="blk-choice" data-src="file">Fichier (Excel, CSV, JSON)</button>
          <button type="button" class="blk-choice" data-src="gsheet">Google Sheets (lien)</button>
          ${INS ? `<button type="button" class="blk-choice" data-src="bdg">Autre budget de l'application</button>` : ""}
        </div>`);
      p.addEventListener("click", e => {
        const b = e.target.closest("[data-src]");
        if (!b) return;
        p.remove();
        if (b.dataset.src === "gsheet") importGSheet();
        else if (b.dataset.src === "bdg") openImportBudget(blk);
        else doImport(blk);
      });
    };

    const doImport = blk => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = ".xlsx,.xls,.csv,.json,.txt";
      inp.onchange = async () => {
        const f = inp.files[0];
        if (!f) return;
        try {
          if (/\.json$/i.test(f.name)) {
            const data = JSON.parse(await f.text());
            const arr = Array.isArray(data) ? data : [data];
            const head = [...new Set(arr.flatMap(o => Object.keys(o || {})))];
            showImport(f.name, head, arr.map(o => head.map(h => o?.[h])));
          } else {
            const X = await loadXLSX();
            const wb = X.read(await f.arrayBuffer(), { type: "array" });
            const aoa = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
            showImport(f.name, aoa[0] || [], aoa.slice(1));
          }
        } catch (e) {
          svImportFail({ source: f.name, tries: [{ err: e }], hint: "VÉRIFIER QUE LE FICHIER EST UN EXCEL (.XLSX), UN CSV OU UN JSON, NON PROTÉGÉ PAR MOT DE PASSE." });
        }
      };
      inp.click();
    };

    /* ===== impression DÉSIGNATIONS CLIENT : modèle de la société
       (logo, date d'édition, en-tête, tableau, totaux, pied de page) ===== */
    /* options d'impression, mémorisées */
    const PO_KEY = "svi_printopt_v1";
    const poLoad = () => {
      try { return Object.assign({ head: true, stamp: false }, JSON.parse(localStorage.getItem(PO_KEY) || "{}")); }
      catch (e) { return { head: true, stamp: false }; }
    };
    const openPrintOptions = () => {
      const o = poLoad();
      document.getElementById("docPop")?.remove();
      const p = document.createElement("div");
      p.id = "docPop";
      const yn = (name, on) => `
        <span class="po-yn" data-name="${name}">
          <button type="button" data-v="1" class="${on ? "on" : ""}">OUI</button>
          <button type="button" data-v="0" class="${on ? "" : "on"}">NON</button>
        </span>`;
      p.innerHTML = `
        <div class="doc-card po-card" role="dialog" aria-modal="true">
          <div class="doc-head">
            <span class="doc-title">${esc(budget.project)} : IMPRESSION DÉSIGNATIONS CLIENT</span>
            <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
          </div>
          <div class="doc-body">
            <div class="doc-grid doc-grid-2">
              <span class="doc-lab">EN-TÊTE ET PIED DE PAGE</span>${yn("head", o.head)}
              <span class="doc-lab">CACHET ET SIGNATURE</span>${yn("stamp", o.stamp)}
            </div>
          </div>
          <div class="doc-foot">
            <button type="button" class="doc-btn" data-cancel>ANNULER</button>
            <button type="button" class="doc-btn doc-save" id="poGo">IMPRIMER</button>
          </div>
        </div>`;
      document.body.appendChild(p);
      p.addEventListener("click", e => {
        const b = e.target.closest(".po-yn button");
        if (b) {
          b.parentElement.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
          return;
        }
        if (e.target === p || e.target.closest("[data-cancel]")) { p.remove(); return; }
        if (e.target.closest("#poGo")) {
          const val = n => p.querySelector(`.po-yn[data-name="${n}"] .on`)?.dataset.v === "1";
          const opt = { head: val("head"), stamp: val("stamp") };
          try { localStorage.setItem(PO_KEY, JSON.stringify(opt)); } catch (err) {}
          p.remove();
          printClient(opt);
        }
      });
    };

    /* texte principal sans doublon (intitulé DOC / OBS, descriptif TAF) */
    const dupKey = v => String(v ?? "").trim().toUpperCase().replace(/\s+/g, " ");
    const findDup = (list, get, v) => list.find(r => dupKey(get(r)) === dupKey(v));

    /* PDF validé dans l'aperçu → nouvelle ligne DOCUMENTS avec lien vers le fichier */
    /* retour sur la page du budget : liste DOCUMENTS relue (PDF enregistré ailleurs) */
    if (window.__sviDocRefresh) {
      window.removeEventListener("focus", window.__sviDocRefresh);
      document.removeEventListener("visibilitychange", window.__sviDocRefresh);
    }
    window.__sviDocRefresh = () => { if (document.visibilityState !== "hidden") updPill("doc"); };
    window.addEventListener("focus", window.__sviDocRefresh);
    document.addEventListener("visibilitychange", window.__sviDocRefresh);

    window.__sviSavePdfDoc = async (blob, title, name, code, fp) => {
      const now = new Date();
      const docRef = nextDocRef(now);
      const idb = "doc:" + ref + ":" + docRef;
      await sviFiles.put(idb, blob);
      const list = docsLoad();
      /* PDF généré : même intitulé à chaque édition, c'est la référence
         (…/001, …/002) qui distingue les versions */
      list.push({ ref: docRef, date: localDT(now), title: String(title).toUpperCase(),
        name, size: blob.size, type: "application/pdf", data: null, idb, code: code || "", fp: fp || "" });
      docsSave(list);
      histLog("DOC", "CRÉATION", docRef + " — " + title + " (PDF GÉNÉRÉ)");
      updPill("doc");
      return docRef;
    };
    /* export (Excel, CSV, JSON, Google Sheets) : une copie est ajoutée à DOCUMENTS
       (fichier gardé sur l'appareil, lien Drive s'il a été enregistré dans le Drive) */
    const saveExportDoc = async (blob, title, name, type, drive, drivePath) => {
      try {
        const now = new Date();
        const docRef = nextDocRef(now);
        let idb = null;
        if (blob) { idb = "doc:" + ref + ":" + docRef; await sviFiles.put(idb, blob); }
        const list = docsLoad();
        list.push({ ref: docRef, date: localDT(now), title: String(title).toUpperCase(), name,
          size: blob ? blob.size : 0, type: type || (blob && blob.type) || "", data: null, idb,
          drive: drive || "", drivePath: drivePath || "" });
        docsSave(list);
        histLog("DOC", "CRÉATION", docRef + " — " + title + " (EXPORT)");
        updPill("doc");
        return docRef;
      } catch (e) { return null; }
    };

    /* lien Drive ajouté à une ligne DOC déjà enregistrée */
    window.__sviDocSetDrive = (docRef, url, path) => {
      const l2 = docsLoad();
      const it = l2.find(x => x.ref === docRef);
      if (it) { it.drive = url || ""; it.drivePath = path || ""; docsSave(l2); }
      histLog("DOC", "DRIVE", docRef + " → " + (path || "MON DRIVE"));
    };
    window.__sviDrivePathDefault = () => driveLastPath(budget.project, fullRef);

    @endverbatim