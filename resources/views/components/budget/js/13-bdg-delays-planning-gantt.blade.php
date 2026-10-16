@verbatim/* ===== DÉTAIL DÉLAIS : colonnes (tri / filtre, largeur et ordre réglables) ===== */
    /* une ligne par période d'une TÂCHE PRIMAIRE (lot + activité primaire) */
    const DLY_COLS = [
      ["lot", "LOT", x => x.lot || "", ""],
      ["prim", "ACTIVITÉ PRIMAIRE", x => x.prim || "", ""],
      ["deb", "DÉBUT", x => x.deb || "", "center"],
      ["fin", "FIN", x => x.fin || "", "center"],
      ["dur", "DURÉE (J)", x => x.dur === "" || x.dur === undefined ? "" : Number(x.dur), "number"]
    ];
    const DLY_W = { lot: 160, prim: 280, sec: 170, pred: 180, per: 120, deb: 90, fin: 90, dur: 80, marge: 70, jal: 62 };
    /* budget en instance / figé : une ligne par période d'une TÂCHE SECONDAIRE (lot + activité secondaire) */
    const DLY_COLS_S = [DLY_COLS[0], ["sec", "ACTIVITÉ SECONDAIRE", x => x.sec || "", ""], ...DLY_COLS.slice(2)];
    /* récapitulatif d'une tâche primaire : ses tâches secondaires */
    const DLY_COLS_R = DLY_COLS_S.slice(1);
    /* planning : lot, activité secondaire, prédécesseurs, début, fin, durée */
    const DLY_COLS_P = [DLY_COLS[0], ["sec", "ACTIVITÉ SECONDAIRE", x => x.sec || "", ""], ["pred", "PRÉDÉCESSEURS", x => x.pred || "", ""],
      ["deb", "DÉBUT", x => x.deb || "", "center"], ["fin", "FIN", x => x.fin || "", "center"], ["dur", "DURÉE (J)", x => x.dur === "" || x.dur === undefined ? "" : Number(x.dur), "center"],
      ["marge", "MARGE", x => x.marge === "" || x.marge === undefined ? "" : Number(x.marge), "center"], ["jal", "JALON", x => x.jal || "", "center"]];
    /* budget en instance : la tâche est donnée par les ronds du haut (pas de colonnes LOT / ACT. PRIMAIRE) */
    const DLY_COLS_I = DLY_COLS.filter(c => c[0] !== "lot" && c[0] !== "prim");
    /* cells(x) → { cle: html } ; la ligne garde ses attributs (data-sec en saisie) */
    /* del : mode modifiable (case au début de chaque période, 🗑 à la fin, case et 🗑 en tête) */
    const dlyTable = (rows, cells, trAttr = () => "", del = false, base = DLY_COLS) => {
      const tk = base === DLY_COLS ? "dly" : base === DLY_COLS_S ? "dlys" : base === DLY_COLS_R ? "dlyr" : base === DLY_COLS_P ? "dlyp" : "dlyi";
      const cols = coOrder(tk, base);
      const w = k => cwLoad()["dly." + k] || DLY_W[k];
      /* FORMAT : case à droite de chaque ligne (cocher seulement) ; suppression par le menu ⋯ */
      return `<table class="bdg-d-table dly-table" style="width:${cols.reduce((t, c) => t + w(c[0]), 0) + (del ? 44 : 0)}px">
        <colgroup>${cols.map(c => `<col data-w="dly.${c[0]}" style="width:${w(c[0])}px">`).join("")}${del ? '<col style="width:44px">' : ""}</colgroup>
        <thead><tr>${cols.map(c => cfHead(tk, c[0], c[1], c[3])).join("")}${del ? `<th class="center"><input type="checkbox" class="${tk === "dlyp" ? "dlyp-cball" : "dlp-cball"}" title="Tout cocher"></th>` : ""}</tr></thead>
        <tbody>${rows.map(x => { const h = cells(x); return `<tr ${trAttr(x)}>${cols.map(c => `<td class="${c[3]}${h["__td_" + c[0]] || ""}">${h[c[0]] ?? ""}</td>`).join("")}${del ? `<td class="center ins-cbc">${h.__cb || ""}</td>` : ""}</tr>`; }).join("")
          || ""}</tbody></table>`;
    };
    const renderTab = () => { renderTab0(); sviMarkEmptyTabs(shell); };
    const renderTab0 = () => {
      shell
        .querySelectorAll("#bdgTabs .bdg-d-tab")
        .forEach(b =>
          b.classList.toggle(
            "active",
            b.dataset.tab === active
          )
        );

      /* compteurs des onglets DÉTAIL CHARGES / PRODUITS (filtres compris) */
      ["chg", "prd"].forEach(k => {
        const b = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="${k}"]`);
        if (!b) return;
        const gl = groupLines(byKindNow()[k]);
        const n = cfApply(k, tcolsFor(k === "prd"), gl).length;
        const t = tabs.find(x => x.key === k);
        b.innerHTML = (SVI_ICON[k] || "") + t.title + " " + svCnt(n, gl.length);
      });

      if (INS) { insRenderTab(); return; }
      { const q = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="qlt"]`);
        if (q) q.innerHTML = (SVI_ICON.qlt || "") + "DÉTAIL QUALITÉ " + svCnt(0);
        const d = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="dly"]`);
        if (d) d.innerHTML = (SVI_ICON.dly || "") + "DÉTAIL DÉLAIS " + svCnt(new Set(lines.filter(l => String(l.lot || "").trim() || String(l.prim || "").trim()).map(l => String(l.lot || "").trim() + "|" + String(l.prim || "").trim())).size); }
      if (active === "chg" || active === "prd") {
        const prd = active === "prd";
        const tcols = tcolsFor(prd);
        const all = byKindNow()[active];
        const byDesig = groupLines(all).sort((x, y) =>
          String(x.detail).localeCompare(String(y.detail), "fr", { numeric: true })
        );
        const list = cfApply(active, tcols, byDesig).sort((x, y) =>
          selRows.has(y.gid) - selRows.has(x.gid)
        );
        lastShown.detail = { cols: tcols, rows: list, kind: active };
        const shownG = new Set(list.map(g => g.gid));
        const raw = all.filter(l => shownG.has(l.gid));
        const cols = prd ? 12 : 8;

        const rowsHTML =
          list.map(l => `
            <tr data-row="${esc(l.gid)}"
                class="${selRows.has(l.gid) ? "selected" : ""}">
              <td class="center">${esc(l.article)}</td>
              <td>${esc(l.detail)}</td>
              <td class="center">${esc(l.unit)}</td>
              ${
                prd
                  ? `
                    <td class="number">${esc(l.nbr)}</td>
                    ${[0, 1, 2].map(i => `
                      <td class="number">${esc(l.dims[i])}</td>`).join("")}
                  `
                  : ""
              }
              <td class="number">${money(l.qty)}</td>
              <td class="number">${money(l.price)}</td>
              <td class="number">${money(l.amount)}</td>
              <td class="number">
                <input
                  type="text"
                  inputmode="decimal"
                  class="bdg-tva-input"
                  data-line="${esc(l.gid)}"
                  value="${l.tva === "" ? "" : money(l.tva) + " %"}"
                >
              </td>
              <td class="number" data-ttc="${esc(l.gid)}">
                ${money(l.amount + l.tvaAmt)}
              </td>
            </tr>
          `).join("");

        body.innerHTML = `
          <div class="bdg-d-scroll">
            <table class="bdg-d-table" style="width:${cwTableW(active, tcols)}px">
              <colgroup>${cwCols(active, tcols)}</colgroup>
              <thead>
                <tr>${tcols.map(([k, lab, , cls]) => cfHead(active, k, lab, cls)).join("")}</tr>
              </thead>
              <tbody>
                ${
                  rowsHTML ||
                  `<tr><td colspan="${cols}" class="empty">
                    ${prd ? "AUCUN PRODUIT" : "AUCUNE CHARGE"}
                  </td></tr>`
                }
                ${
                  /* lignes vides : le cadre garde sa hauteur même filtré */
                  `<tr class="bdg-d-filler">${"<td>&nbsp;</td>".repeat(cols)}</tr>`
                    .repeat(0)
                }
              </tbody>
              <tfoot>${tabFootHTML(raw, prd)}</tfoot>
            </table>
          </div>
        `;
        coApply(active, body.querySelector("table"));

        return;
      }

      if (active === "qlt") {
        /* DÉTAIL QUALITÉ : une seule colonne (contenu à venir) */
        body.innerHTML = `<div class="bdg-d-scroll"><table class="bdg-d-table"><thead><tr><th>QUALITÉ</th></tr></thead>
          <tbody><tr><td class="empty">AUCUNE LIGNE</td></tr></tbody></table></div>`;

        return;
      }

      /* DÉTAIL DÉLAIS : une ligne par activité secondaire (lots, début, durée, fin, arrêts) */
      {
        const fr = iso => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "";
        /* une ligne par TÂCHE PRIMAIRE (lot + activité primaire) : du premier début à la dernière fin */
        const m = new Map();
        lines.forEach(l => {
          const lot = String(l.lot || "").trim(), prim = String(l.prim || "").trim();
          if (!lot && !prim) return;
          const k = lot + "|" + prim;
          if (!m.has(k)) m.set(k, { lot, prim, per: 1, deb: "", fin: "" });
          const x = m.get(k);
          if (l.deb && (!x.deb || l.deb < x.deb)) x.deb = l.deb;
          if (l.fin && (!x.fin || l.fin > x.fin)) x.fin = l.fin;
        });
        const dur = x => x.deb && x.fin ? Math.round((new Date(x.fin) - new Date(x.deb)) / 86400000) + 1 : "";   /* FORMAT 139 */
        /* ordre par défaut : chronologique (début), puis alphabétique */
        const all = [...m.values()].map(x => ({ ...x, dur: dur(x) }))
          .sort((a, b) => String(a.deb || "9").localeCompare(String(b.deb || "9")) || a.lot.localeCompare(b.lot, "fr") || a.prim.localeCompare(b.prim, "fr"));
        const rows = cfApply("dly", DLY_COLS, all);
        { const b = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="dly"]`);
          if (b) b.innerHTML = (SVI_ICON.dly || "") + "DÉTAIL DÉLAIS " + svCnt(rows.length); }
        lastShown.detail = { cols: DLY_COLS, rows, kind: "dly" };
        body.innerHTML = `<div class="bdg-d-scroll">${dlyTable(rows, x => DLY_COLS.map(c => c[0])
          .reduce((o, k) => (o[k] = k === "deb" || k === "fin" ? fr(x[k]) : esc(x[k] ?? ""), o), {}))}</div>`;
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

    /* ===== disposition des blocs : ordre et hauteur, mémorisés ===== */
    const LAY_KEY = "svi_layout_v1";
    const LAY_UNITS = ["client", "hier", "detail", "suivi"];
    const layLoad = () => {
      try { return JSON.parse(localStorage.getItem(LAY_KEY) || "{}") || {}; }
      catch (e) { return {}; }
    };
    const laySave = v => {
      try { localStorage.setItem(LAY_KEY, JSON.stringify(v)); } catch (e) {}
    };
    const page$ = () => shell.querySelector(".bdg-d-page");
    const layEls = u => {
      const pg = page$();
      if (u === "detail") return [$("bdgTabs"), $("bdgTabBody"), $("bdgDetailRsz")].filter(Boolean);
      const sel = { client: ".blk-client", hier: ".blk-hier", suivi: ".blk-suivi" }[u];
      return [pg.querySelector(":scope > " + sel)].filter(Boolean);
    };
    const layMeasure = u => {
      const sel = {
        client: ".bdg-d-client-scroll", hier: ".bdg-h-col",
        detail: "#bdgTabBody .bdg-d-scroll",
        suivi: ".blk-suivi .rec-scroll:not([hidden])"
      }[u];
      const el = page$().querySelector(sel);
      return el ? el.getBoundingClientRect().height : 150;
    };
    const layOrder = () => {
      const saved = (layLoad().order || []).filter(u => LAY_UNITS.includes(u));
      return [...saved, ...LAY_UNITS.filter(u => !saved.includes(u))];
    };
    const layOpenH = {};   /* hauteurs réglées pendant cette ouverture seulement */
    const layApply = () => {
      const pg = page$();
      if (!pg) return;
      const lay = layLoad();
      if (lay.h && lay.h.suivi) { delete lay.h.suivi; laySave(lay); }
      layOrder().forEach((u, i) => layEls(u).forEach(el => { el.style.order = i; }));
      LAY_UNITS.forEach(u => {
        /* SUIVI (DOC / TAF / OBS) : toujours 5 lignes à l'ouverture,
           l'agrandissement ne vaut que pour la séance en cours */
        const h = u === "suivi" ? layOpenH.suivi : (lay.h || {})[u];
        if (h) pg.style.setProperty("--h-" + u, h + "px");
        else pg.style.removeProperty("--h-" + u);
      });
      const custom = (lay.order && lay.order.join() !== LAY_UNITS.join()) ||
        Object.keys(lay.h || {}).length > 0;
      const rb = $("layResetBtn");
      /* ↻ toujours affiché ; grisé quand les blocs sont déjà à leur place d'origine */
      if (rb) { rb.disabled = !custom; }   /* ↻ : dans le menu ⋯ du haut, grisé quand il n'y a rien à remettre en place */
    };
    const layInit = () => {
      const pg = page$();
      if (!pg) return;
      shell.querySelectorAll(".blk-tools").forEach((t, i) => {
        if (t.querySelector(".blk-more")) return;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "blk-more";
        b.dataset.for = "m" + i;
        b.title = "Actions";
        b.setAttribute("aria-label", "Actions");
        b.textContent = "⋯";
        t.appendChild(b);
      });
      recTabApply();
      LAY_UNITS.forEach(u => {
        /* poignée de déplacement dans le titre */
        const title = u === "detail" ? $("bdgTabs")
          : layEls(u)[0]?.querySelector(".blk-head");
        if (title && !title.querySelector(".blk-grip")) {
          const g = document.createElement("span");
          g.className = "blk-grip";
          g.dataset.grip = u;
          g.title = "Glisser pour déplacer le bloc";
          g.textContent = "⠿";
          title.prepend(g);
        }
        /* poignée de hauteur en bas du bloc */
        if (u === "detail") {
          if (!$("bdgDetailRsz")) {
            const r = document.createElement("div");
            r.className = "blk-rsz";
            r.id = "bdgDetailRsz";
            r.dataset.rsz = u;
            r.title = "Glisser pour changer la hauteur";
            $("bdgTabBody").after(r);
          }
        } else {
          const b = layEls(u)[0];
          if (b && !b.querySelector(":scope > .blk-rsz")) {
            const r = document.createElement("div");
            r.className = "blk-rsz";
            r.dataset.rsz = u;
            r.title = "Glisser pour changer la hauteur";
            b.appendChild(r);
          }
        }
      });
      layApply();
    };

    const layResize = (event, h) => {
      event.preventDefault();
      const u = h.dataset.rsz;
      const pg = page$();
      const y0 = event.clientY;
      const base = layMeasure(u);
      let v = base;
      h.classList.add("on");
      const move = e => {
        e.preventDefault();
        /* minimum : en-tête + une seule ligne (+ ligne TOTAL s'il y en a une) */
        const minH = { client: 65, detail: 65 }[u] || 44;
        v = Math.max(minH, Math.round(base + e.clientY - y0));
        pg.style.setProperty("--h-" + u, v + "px");
      };
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        h.classList.remove("on");
        if (u === "suivi") { layOpenH.suivi = v; layApply(); return; }
        const lay = layLoad();
        lay.h = lay.h || {};
        lay.h[u] = v;
        laySave(lay);
        histLog("DISPOSITION", "MODIFICATION", "ORDRE / HAUTEUR DES BLOCS");
        layApply();
      };
      document.addEventListener("pointermove", move, { passive: false });
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    };

    const layDrag = (event, grip) => {
      event.preventDefault();
      const src = grip.dataset.grip;
      let target = null, after = false, timer = null, lastY = event.clientY;
      layEls(src).forEach(el => el.classList.add("lay-src"));
      const rectOf = u => {
        const rs = layEls(u).map(el => el.getBoundingClientRect());
        return { top: Math.min(...rs.map(r => r.top)), bottom: Math.max(...rs.map(r => r.bottom)) };
      };
      const clear = () => LAY_UNITS.forEach(u =>
        layEls(u).forEach(el => el.classList.remove("lay-before", "lay-after")));
      const pick = y => {
        clear();
        target = null;
        for (const u of layOrder()) {
          if (u === src) continue;
          const r = rectOf(u);
          if (y >= r.top && y <= r.bottom) {
            target = u;
            after = y > (r.top + r.bottom) / 2;
            const els = layEls(u);
            (after ? els[els.length - 1] : els[0]).classList.add(after ? "lay-after" : "lay-before");
            break;
          }
        }
      };
      /* défilement automatique près des bords de l'écran */
      timer = setInterval(() => {
        const vh = window.innerHeight;
        if (lastY < 90) window.scrollBy(0, -14);
        else if (lastY > vh - 60) window.scrollBy(0, 14);
        else return;
        pick(lastY);
      }, 30);
      const move = e => {
        e.preventDefault();
        lastY = e.clientY;
        pick(lastY);
      };
      const up = () => {
        clearInterval(timer);
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        clear();
        layEls(src).forEach(el => el.classList.remove("lay-src"));
        if (!target) return;
        const order = layOrder().filter(u => u !== src);
        order.splice(order.indexOf(target) + (after ? 1 : 0), 0, src);
        const lay = layLoad();
        lay.order = order;
        laySave(lay);
        histLog("DISPOSITION", "MODIFICATION", "ORDRE / HAUTEUR DES BLOCS");
        layApply();
      };
      document.addEventListener("pointermove", move, { passive: false });
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    };

    /* glisser une ligne : appui long (0,35 s) puis glissement vertical */
    const roStart = (event, el) => {
      const isRow = el.tagName === "TR";
      const t = isRow ? "client" : el.dataset.h;
      /* tri choisi en cours : il garde la main, pas de glissement */
      if (CF[t] && CF[t].sort && !CF[t].sort.def) return;
      const keyOf = x => isRow ? x.dataset.desig : x.dataset.v;
      const sibs = () => isRow
        ? [...el.parentElement.querySelectorAll("tr[data-desig]")]
        : [...el.parentElement.querySelectorAll(".bdg-h-item[data-h]")];
      const x0 = event.clientX, y0 = event.clientY;
      let on = false, target = null, after = false, lastY = y0;
      const clear = () => sibs().forEach(x => x.classList.remove("ro-before", "ro-after"));
      const timer = setTimeout(() => {
        on = true;
        el.classList.add("ro-src");
        try { navigator.vibrate && navigator.vibrate(15); } catch (e) {}
      }, 350);
      const tm = e => { if (on) e.preventDefault(); };
      const move = e => {
        lastY = e.clientY;
        if (!on) {
          if (Math.abs(e.clientX - x0) > 8 || Math.abs(e.clientY - y0) > 8) end(false);
          return;
        }
        e.preventDefault();
        clear();
        target = null;
        for (const x of sibs()) {
          const r = x.getBoundingClientRect();
          if (lastY >= r.top && lastY <= r.bottom) {
            if (x !== el) {
              after = lastY > (r.top + r.bottom) / 2;
              x.classList.add(after ? "ro-after" : "ro-before");
              target = x;
            }
            break;
          }
        }
      };
      const end = drop => {
        clearTimeout(timer);
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", cancel);
        setTimeout(() => document.removeEventListener("touchmove", tm), 0);
        clear();
        el.classList.remove("ro-src");
        if (!on) return;
        /* le toucher qui suit le glissement ne sélectionne pas la ligne */
        const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
        shell.addEventListener("click", stop, { capture: true, once: true });
        setTimeout(() => shell.removeEventListener("click", stop, { capture: true }), 350);
        if (!drop || !target) return;
        const keys = sibs().map(keyOf).filter(k => k !== keyOf(el));
        let i = keys.indexOf(keyOf(target));
        keys.splice(after ? i + 1 : i, 0, keyOf(el));
        const all = roLoad();
        /* lignes masquées par un filtre : gardent leur rang après les visibles */
        all[t] = [...keys, ...(all[t] || []).filter(k => !keys.includes(k))];
        roSave(all);
        histLog(t === "client" ? "DÉSIGNATIONS CLIENT" : "TÂCHES", "ORDRE DES LIGNES", keyOf(el).split("||").pop());
        refreshAll();
      };
      const up = () => end(true);
      const cancel = () => end(false);
      document.addEventListener("touchmove", tm, { passive: false });
      document.addEventListener("pointermove", move, { passive: false });
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", cancel);
    };

    /* glisser un en-tête de colonne pour la déplacer */
    const coDrag = (event, th) => {
      const isHier = th.classList.contains("bdg-h-head");
      const table = th.closest("table");
      const t = isHier ? "hierCols" : th.querySelector(".cf-btn").dataset.cf;
      const ths = () => isHier
        ? [...$("bdgHier").querySelectorAll(".bdg-h-head")]
        : [...table.querySelectorAll("thead tr:first-child > th")];
      const keyOf = x => isHier
        ? x.querySelector(".cf-btn")?.dataset.cf
        : x.querySelector(".cf-btn")?.dataset.col;
      const x0 = event.clientX, y0 = event.clientY;
      let on = false, target = null, ghost = null, mv = 0;
      const clear = () => ths().forEach(x => x.classList.remove("co-before", "co-after"));
      const move = e => {
        const dx = e.clientX - x0, dy = e.clientY - y0;
        mv = Math.max(mv, Math.abs(dx), Math.abs(dy));
        if (!on) {
          if (Math.abs(dx) < 8) return;
          on = true;
          th.classList.add("co-src");
          ghost = document.createElement("div");
          ghost.id = "coGhost";
          ghost.textContent = (th.querySelector(".cf-lab")?.firstChild?.textContent || "").trim();
          document.body.appendChild(ghost);
        }
        e.preventDefault();
        ghost.style.left = e.clientX + 8 + "px";
        ghost.style.top = e.clientY - 28 + "px";
        clear();
        target = null;
        const list = ths();
        for (const x of list) {
          const r = x.getBoundingClientRect();
          if (e.clientX >= r.left && e.clientX < r.right) {
            if (x !== th) {
              const after = list.indexOf(x) > list.indexOf(th);
              x.classList.add(after ? "co-after" : "co-before");
              target = x;
            }
            break;
          }
        }
      };
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        clear();
        th.classList.remove("co-src");
        ghost?.remove();
        /* FORMAT 116 : simple toucher sur le titre = sélection de la colonne */
        if (!on && mv < 8) { try { colSelToggle(th); } catch (e) {} return; }
        if (!on || !target) return;
        const keys = ths().map(keyOf);
        const from = keys.indexOf(keyOf(th));
        const to = keys.indexOf(keyOf(target));
        const [k] = keys.splice(from, 1);
        keys.splice(to, 0, k);
        const all = coLoad();
        all[t] = keys;
        coSave(all);
        histLog("COLONNES", "DÉPLACEMENT", t + " : " + keys.join(", "));
        /* évite le clic qui suit le glissement */
        const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
        shell.addEventListener("click", stop, { capture: true, once: true });
        setTimeout(() => shell.removeEventListener("click", stop, { capture: true }), 300);
        refreshAll();
      };
      /* iPad : bloque le défilement pendant le glissement */
      const tm = e => { if (on) e.preventDefault(); };
      document.addEventListener("touchmove", tm, { passive: false });
      const end = () => setTimeout(() => document.removeEventListener("touchmove", tm), 0);
      document.addEventListener("pointerup", end, { once: true });
      document.addEventListener("pointercancel", end, { once: true });
      document.addEventListener("pointermove", move, { passive: false });
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    };

    /* ===== budget en instance : appui long sur une ligne saisie = glisser la ligne
       (un titre emmène ses lignes et sous-titres) ===== */
    /* désignations : dépôt d'une ligne ou d'un titre (avec sa branche) — FORMAT 61
       - avant une ligne / un titre : même niveau que lui ;
       - après une ligne : même niveau (entre dans son titre) ;
       - après un titre déplié : entre dans ce titre ; après un titre replié : à côté de lui (après sa branche) ;
       - superposé : nouveau titre « NOUVEAU TITRE n » qui regroupe la ligne visée puis la ligne glissée ;
       - titres devenus vides : supprimés après confirmation (ANNULER = glissement annulé) */
    /* lignes sélectionnées d'un bloc (cases cochées) ; désignations : un titre coché (branche entière ou titre vide) emporte sa branche */
    /* lignes affichées (filtres compris) : les actions ne portent que sur elles (FORMAT 84) */
    const insVis = k => new Set((["lot", "prim", "sec"].includes(k) ? cfApply(k, [["v", "", r => r.v || "", ""]], INS[k]) : insShown(k)).map(r => r.id));
    const insSelIds = k => {
      const L = INS[k] || [], out = new Set(), vis = insVis(k);
      if (k !== "des") { L.forEach(r => { if (r.on === true && vis.has(r.id)) out.add(r.id); }); return out; }
      insNorm();
      const D = r => Number(r.d) || 0;
      L.forEach((r, i) => {
        if (!r.t) { if (r.on === true && vis.has(r.id)) out.add(r.id); return; }
        if (!vis.has(r.id)) return;
        let e = i + 1; while (e < L.length && D(L[e]) > D(r)) e++;
        const br = L.slice(i + 1, e).filter(x => x.t ? vis.has(x.id) : vis.has(x.id)), lines = br.filter(x => !x.t);
        /* titre retenu seulement si sa propre case est cochée (et toute sa branche, s'il en a une) */
        if (r.on === true && (!lines.length || lines.every(x => x.on === true))) { out.add(r.id); br.forEach(x => out.add(x.id)); }
      });
      return out;
    };
    const desDrop = async (arr, ids, tid, mode) => {
      insNorm();
      const snap = arr.map(r => ({ ...r }));
      const D = r => Number(r.d) || 0;
      const bset = new Set(ids);
      const i0 = arr.findIndex(r => bset.has(r.id));
      const block = arr.filter(r => bset.has(r.id));
      arr.splice(0, arr.length, ...arr.filter(r => !bset.has(r.id)));
      const shift = (rows, base) => { const d0 = D(rows[0]); rows.forEach(r => { r.d = base + D(r) - d0; }); };
      let j = arr.findIndex(r => r.id === tid);
      if (j < 0) { arr.splice(0, arr.length, ...snap); return; }
      const T = arr[j];
      const branchEnd = i => { let e = i + 1; while (e < arr.length && D(arr[e]) > D(arr[i])) e++; return e; };
      let created = null;
      if (mode === "on") {
        const e = branchEnd(j);
        const tb = arr.splice(j, e - j);
        const used = INS.des.concat(snap).map(r => (String(r.des || "").match(/^NOUVEAU TITRE (\d+)$/) || [])[1]).filter(Boolean).map(Number);
        created = { id: insId(), t: true, art: "", des: "NOUVEAU TITRE " + ((used.length ? Math.max(...used) : 0) + 1), d: D(T), on: false };
        shift(tb, D(T) + 1); shift(block, D(T) + 1);
        arr.splice(j, 0, created, ...tb, ...block);
      } else if (mode === "before") {
        shift(block, D(T)); arr.splice(j, 0, ...block);
      } else if (T.t && !foldGet()[T.id]) {
        shift(block, D(T) + 1); arr.splice(j + 1, 0, ...block);
      } else if (T.t && mode === "afterIn") {
        /* titre replié, doigt à droite : ajouté à la fin de ses lignes ; le titre reste replié */
        shift(block, D(T) + 1); arr.splice(branchEnd(j), 0, ...block);
      } else if (T.t) {
        shift(block, D(T)); arr.splice(branchEnd(j), 0, ...block);
      } else {
        shift(block, D(T)); arr.splice(j + 1, 0, ...block);
      }
      insNorm();
      /* titres vides (sans aucune ligne, sous-titres vides compris) */
      /* titres devenus vides PAR CE GLISSEMENT (un titre déjà vide et gardé n'est plus redemandé) */
      const emptyIn = L => new Set(L.filter((r, i) => {
        if (!r.t) return false;
        for (let x = i + 1; x < L.length && D(L[x]) > D(r); x++) if (!L[x].t) return false;
        return true;
      }).map(r => r.id));
      const was = emptyIn(snap), now = emptyIn(arr);
      const empty = arr.filter(r => now.has(r.id) && !was.has(r.id) && !(created && r.id === created.id));
      let choice = "";
      if (empty.length) {
        /* ANNULER = glissement annulé ; GARDER = glissement fait, titres vides gardés ; SUPPRIMER = titres vides supprimés */
        const v = await svChoose({ title: "TITRES VIDES",
          html: `<div class="svc-sub">CES TITRES N'ONT PLUS AUCUNE LIGNE :</div><ul class="svc-list">${empty.map(r => `<li>${esc([r.art, r.des].filter(Boolean).join(" "))}</li>`).join("")}</ul>`,
          buttons: [{ v: "keep", label: "GARDER", tone: "neutral" }, { v: "del", label: "SUPPRIMER", tone: "danger" }] });
        if (!v) { arr.splice(0, arr.length, ...snap); insSave(); insRedraw("des"); return; }
        choice = v;
      }
      if (choice === "del") {
        const gone = new Set(empty.map(r => r.id));
        const keep = arr.filter(r => !gone.has(r.id));
        arr.splice(0, arr.length, ...keep);
        insNorm();
        histLog("DÉSIGNATIONS CLIENT", "TITRES VIDES SUPPRIMÉS", empty.map(r => r.des || r.art || "").join(", "));
      }
      insSave();
      histLog("DÉSIGNATIONS CLIENT", created ? "NOUVEAU TITRE" : "ORDRE DES LIGNES", String(created ? created.des : (block[0].des || block[0].art || "")));
      insRedraw("des");
      /* nouveau titre : l'intitulé est prêt à être saisi */
      if (created) setTimeout(() => {
        const i = shell.querySelector(`#bdgClientBody tr[data-iid="${created.id}"] [data-f="des"]`);
        if (i) { i.focus(); try { i.select(); } catch (e) {} i.scrollIntoView({ block: "nearest" }); }
      }, 30);
    };
    const insDrag = (event, el) => {
      const X = shell.__ins;
      if (!X) return;
      const holder = el.closest("[data-ik]");
      const k = el.dataset.ik || holder?.dataset.ik;
      const isRow = el.tagName === "TR";
      { const st = CF[k === "des" ? "client" : k];
        if (st && st.sort && !st.sort.def) {
          /* FORMAT 118 : appui long pendant un tri → message (le glissement reste impossible) */
          const c = (INS_COLS[k] || []).find(x => x[4] === st.sort.col || x[0] === st.sort.col);
          const lab = c ? c[1] : ({ lot: "LOT", prim: "ACTIVITÉ PRIMAIRE", sec: "ACTIVITÉ SECONDAIRE", v: k === "lot" ? "LOT" : k === "prim" ? "ACTIVITÉ PRIMAIRE" : "ACTIVITÉ SECONDAIRE" }[st.sort.col] || String(st.sort.col).toUpperCase());
          const sx = event.clientX, sy = event.clientY;
          const tm = setTimeout(() => { off(); svToast("GLISSEMENT IMPOSSIBLE : TRI ACTIF SUR LA COLONNE " + lab + " — ANNULER LE TRI POUR DÉPLACER OU SUPERPOSER", 4500, el); }, 400);
          const mvv = e => { if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) off(); };
          const off = () => { clearTimeout(tm); document.removeEventListener("pointermove", mvv); document.removeEventListener("pointerup", off); document.removeEventListener("pointercancel", off); };
          document.addEventListener("pointermove", mvv); document.addEventListener("pointerup", off); document.addEventListener("pointercancel", off);
          return;
        } }
      const dv = event.target.closest(".ins-dv");
      const inp = event.target.closest(".ins-in") || (dv && dv.parentElement.querySelector(".ins-in"));
      const tapFocus = inp && inp !== document.activeElement ? inp : null;
      const sibs = () => isRow
        ? [...el.parentElement.querySelectorAll("tr[data-iid]")]
        : [...el.parentElement.querySelectorAll(k === "lot" ? ".ins-li[data-iid], .ins-li.lot-grp" : ".ins-li[data-iid]")];
      const x0 = event.clientX, y0 = event.clientY;
      let on = false, moved = false, target = null, after = false, over = false, inside = false;
      /* repères de glissement effacés partout (même si le tableau a été redessiné entre-temps) */
      const clear = () => {
        shell.querySelectorAll(".ro-before, .ro-after, .ro-in, .ro-on").forEach(x => x.classList.remove("ro-before", "ro-after", "ro-in", "ro-on"));
        document.getElementById("roLine")?.remove();
      };
      /* désignations : un seul trait à l'endroit du dépôt, décalé selon le niveau d'arrivée
         (même trait entre deux lignes d'un même titre ; en bas d'un titre : décalé = reste dedans, plus à gauche = sort) */
      const roLine = (row, y, depth) => {
        let l = document.getElementById("roLine");
        if (!l) { l = document.createElement("div"); l.id = "roLine"; document.body.appendChild(l); }
        const cell = row.querySelector('[data-f="des"]')?.closest("td") || row;
        const c = cell.getBoundingClientRect(), t = row.closest("table").getBoundingClientRect(), box = row.closest(".bdg-d-scroll") || row.closest("table");
        const b = box.getBoundingClientRect();
        const x0 = Math.max(b.left, c.left + 4 + depth * 20), x1 = Math.min(b.right, t.right);
        l.style.cssText = `position:fixed;z-index:10060;pointer-events:none;height:3px;border-radius:2px;background:var(--inst,#12355b);left:${x0}px;width:${Math.max(20, x1 - x0)}px;top:${y - 1.5}px`;
      };
      /* FORMAT 26 : glisser pour déplacer partout ; regrouper (superposer) seulement désignations et lots */
      const canDrag = true;
      const timer = setTimeout(() => {
        if (!canDrag) return;
        on = true;
        /* le doigt est bloqué seulement pendant le glissement (le défilement normal reste libre) */
        document.addEventListener("touchmove", tm, { passive: false });
        shell.__insDragging = true;
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        /* pas de sélection de texte (poignées bleues) pendant le glissement */
        try { window.getSelection && window.getSelection().removeAllRanges(); } catch (e) {}
        document.body.classList.add("svi-dragging");
        el.classList.add("ro-src");
        try { navigator.vibrate && navigator.vibrate(15); } catch (e) {}
      }, 350);
      const tm = e => { if (on) e.preventDefault(); };
      const move = e => {
        if (!on) {
          if (Math.abs(e.clientX - x0) > 8 || Math.abs(e.clientY - y0) > 8) { moved = true; end(false); }
          return;
        }
        e.preventDefault();
        clear();
        target = null;
        for (const x of sibs()) {
          const r = x.getBoundingClientRect();
          if (e.clientY >= r.top && e.clientY <= r.bottom) {
            if (x !== el) {
              target = x;
              over = false;
              if (k === "des") {
                /* désignations : haut = avant, milieu = superposer (nouveau titre), bas = après */
                const f = (e.clientY - r.top) / (r.height || 1);
                over = f > .25 && f < .75;
                after = f >= .75;
                const tr0 = X.INS.des.find(q => q.id === x.dataset.iid);
                const d0 = Number(tr0 && tr0.d) || 0;
                /* sous un titre replié : doigt vers la droite = entre dans le titre, vers la gauche = à l'extérieur */
                inside = false;
                if (after && tr0 && tr0.t && foldGet()[tr0.id]) {
                  const c = (x.querySelector('[data-f="des"]')?.closest("td") || x).getBoundingClientRect();
                  inside = e.clientX > c.left + 8 + d0 * 20 + 24;
                }
                if (over) x.classList.add("ro-on");
                else roLine(x, after ? r.bottom : r.top, !after ? d0 : (tr0 && tr0.t && (!foldGet()[tr0.id] || inside)) ? d0 + 1 : d0);
              } else if (k === "lot") {
                /* lots : haut = avant, milieu = dans le niveau (ou nouveau niveau), bas = après — un seul trait */
                const f = (e.clientY - r.top) / (r.height || 1);
                over = f > .25 && f < .75;
                after = f >= .75;
                if (over) x.classList.add("ro-on");
                else {
                  let l = document.getElementById("roLine");
                  if (!l) { l = document.createElement("div"); l.id = "roLine"; document.body.appendChild(l); }
                  const ip = (x.querySelector(".lot-in") || x).getBoundingClientRect(), cr = x.getBoundingClientRect();
                  l.style.cssText = `position:fixed;z-index:10060;pointer-events:none;height:3px;border-radius:2px;background:var(--inst,#12355b);left:${ip.left}px;width:${Math.max(20, cr.right - ip.left)}px;top:${(after ? r.bottom : r.top) - 1.5}px`;
                }
              } else {
                /* déplacement simple : un seul trait à l'endroit du dépôt */
                after = e.clientY > (r.top + r.bottom) / 2;
                let l = document.getElementById("roLine");
                if (!l) { l = document.createElement("div"); l.id = "roLine"; document.body.appendChild(l); }
                l.style.cssText = `position:fixed;z-index:10060;pointer-events:none;height:3px;border-radius:2px;background:var(--inst,#12355b);left:${r.left}px;width:${r.width}px;top:${(after ? r.bottom : r.top) - 1.5}px`;
              }
            }
            break;
          }
        }
      };
      const end = drop => {
        clearTimeout(timer);
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", cancel);
        setTimeout(() => document.removeEventListener("touchmove", tm), 0);
        clear();
        el.classList.remove("ro-src");
        shell.querySelectorAll(".ro-src").forEach(x => x.classList.remove("ro-src"));
        document.body.classList.remove("svi-dragging");
        try { window.getSelection && window.getSelection().removeAllRanges(); } catch (e) {}
        shell.__insDragging = false;
        if (!on) {
          /* simple toucher sur une case : saisie normale */
          if (drop && !moved && tapFocus) {
            tapFocus.closest("td.ins-tdv")?.classList.add("ins-ed");
            tapFocus.focus();
            try { const n = tapFocus.value.length; tapFocus.setSelectionRange(n, n); } catch (e) {}
          }
          return;
        }
        const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
        shell.addEventListener("click", stop, { capture: true, once: true });
        setTimeout(() => shell.removeEventListener("click", stop, { capture: true }), 350);
        if (!drop || !target) return;
        const arr = X.INS[k];
        const i0 = arr.findIndex(r => r.id === el.dataset.iid);
        if (i0 < 0) return;
        /* bloc déplacé : la ligne, ou le titre avec ses lignes */
        let n = 1;
        if (k === "des" && arr[i0].t) {
          while (i0 + n < arr.length && (Number(arr[i0 + n].d) || 0) > (Number(arr[i0].d) || 0)) n++;
        }
        let blockIds = arr.slice(i0, i0 + n).map(r => r.id);
        /* ligne cochée : toutes les lignes cochées du bloc se déplacent ensemble (dans leur ordre) */
        const sel = insSelIds(k);
        if (sel.has(arr[i0].id) && sel.size > 1) blockIds = arr.filter(r => sel.has(r.id)).map(r => r.id);
        if (blockIds.includes(target.dataset.iid)) return;
        if (k === "des") { desDrop(arr, blockIds, target.dataset.iid, over ? "on" : after ? (inside ? "afterIn" : "after") : "before"); return; }
        if (k === "lot") { lotDrop(el.dataset.iid, target, over ? "on" : after ? "after" : "before"); return; }
        const bset = new Set(blockIds);
        const block = arr.filter(r => bset.has(r.id));
        arr.splice(0, arr.length, ...arr.filter(r => !bset.has(r.id)));
        let j = arr.findIndex(r => r.id === target.dataset.iid);
        if (after) j++;
        arr.splice(j, 0, ...block);
        if (k === "sec") { dlyPlanFromTasks("sec"); renderTab(); }
        X.insSave();
        histLog(k === "des" ? "DÉSIGNATIONS CLIENT" : k === "chg" ? "DÉTAIL CHARGES" : k === "prd" ? "DÉTAIL PRODUITS" : "TÂCHES",
          "ORDRE DES LIGNES", String(block[0].des || block[0].v || block[0].art || ""));
        X.insRedraw(k);
      };
      const up = () => end(true);
      const cancel = () => end(false);
      document.addEventListener("pointermove", move, { passive: false });
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", cancel);
    };
    /* iPad : l'appui sur une case non active ne lance ni la loupe ni le clavier ;
       le simple toucher la rend active (ci-dessus), l'appui long glisse la ligne */
    if (!shell.__insTouch) {
      shell.__insTouch = true;
      /* plus de blocage du toucher : il empêchait de faire défiler la page en partant d'une case.
         La loupe est évitée par le style (pas de sélection sur une case non active). */
    }

    shell.onpointerdown = event => {
      /* mode LIAISONS : la poignée d'en-tête règle la largeur des blocs TÂCHES */
      /* mode LIAISONS : poignée du bas = hauteur du bloc (mémorisée) */
      const lkH = event.target.closest(".lk-hrsz");
      if (lkH) {
        event.preventDefault(); event.stopPropagation();
        const k = lkH.dataset.lkh, box = $("insLinkView");
        const ref = lkH.parentElement.querySelector(k === "hier" ? ".lk-col" : ".lk-scroll");
        const y0 = event.clientY, h0 = ref ? ref.getBoundingClientRect().height : 170;
        let h = h0;
        lkH.classList.add("on");
        const mv = ev => { h = Math.max(80, Math.round(h0 + ev.clientY - y0)); box.style.setProperty("--lkh-" + k, h + "px"); };
        const up = () => {
          lkH.classList.remove("on");
          document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
          try { const H = JSON.parse(localStorage.getItem("svi_lkh_v1") || "{}"); H[k] = h; localStorage.setItem("svi_lkh_v1", JSON.stringify(H)); } catch (e) {}
        };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
        return;
      }
      const lkRs = event.target.closest(".lk-col .lk-rs");
      if (lkRs) {
        event.preventDefault(); event.stopPropagation();
        const grid = lkRs.closest(".lk-grid");
        const colsEl = [...grid.querySelectorAll(".lk-col")];
        const i = colsEl.indexOf(lkRs.closest(".lk-col"));
        const ws = colsEl.map(c => c.getBoundingClientRect().width);
        const x0 = event.clientX, w0 = ws[i];
        const mv = ev => { ws[i] = Math.max(120, Math.round(w0 + ev.clientX - x0)); grid.style.gridTemplateColumns = ws.map(v => v + "px").join(" "); };
        const up = () => {
          document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
          const all = cwLoad();
          ["lot", "prim", "sec"].forEach((k, j) => { all["lk_hier." + k] = Math.round(ws[j]); });
          cwSave(all);
        };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
        return;
      }
      const insEl = INS_EDIT && event.target.closest(".ins-table tr[data-iid], .ins-hcol .ins-li[data-iid]");
      if (insEl && insEl.classList.contains("lk-ban") && !event.target.closest("input.ins-cb, .ins-t")) {
        const x0 = event.clientX, y0 = event.clientY;
        const tmr = setTimeout(() => { svToast(insEl.dataset.ban || "", 3500, insEl); off(); }, 450);
        const mv = e => { if (Math.abs(e.clientX - x0) > 10 || Math.abs(e.clientY - y0) > 10) off(); };
        const off = () => { clearTimeout(tmr); document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", off); document.removeEventListener("pointercancel", off); };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", off); document.addEventListener("pointercancel", off);
        return;
      }
      if (insEl && !event.target.closest(".ins-t, .ins-cb, .ins-x, .lk-rd, .lk-q, .ins-fold") &&
          event.target.closest(".ins-in") !== document.activeElement) { insDrag(event, insEl); return; }
      const rz = event.target.closest(".blk-rsz");
      if (rz) { layResize(event, rz); return; }
      const gp = event.target.closest(".blk-grip");
      if (gp) { layDrag(event, gp); return; }
      const roEl = event.target.closest("#bdgClientBody tr[data-desig], .bdg-h-item[data-h]");
      if (roEl) { roStart(event, roEl); return; }
      const h = event.target.closest(".col-rs");
      if (!h) {
        const th = event.target.closest("th, .bdg-h-head");
        if (th && !event.target.closest(".cf-btn") && th.querySelector(".cf-btn")) coDrag(event, th);
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      const t = h.dataset.rs, key = h.dataset.col;
      const x0 = event.clientX;
      let apply, save;

      if (t === "hier") {
        const grid = $("bdgHier");
        const cols = [...grid.querySelectorAll(".bdg-h-col")];
        const keys = coKeys("hierCols", ["lot", "prim", "sec"]);
        const ws = cols.map(c => c.getBoundingClientRect().width);
        const i = keys.indexOf(key);
        const w0 = ws[i];
        apply = x => {
          ws[i] = Math.max(80, Math.round(w0 + x - x0));
          grid.style.gridTemplateColumns = ws.map(v => v + "px").join(" ");
        };
        save = () => {
          const all = cwLoad();
          keys.forEach((k, j) => { all["hier." + k] = Math.round(ws[j]); });
          cwSave(all);
          histLog("COLONNES", "LARGEUR", t);
        };
      } else {
        const table = h.closest("table");
        /* DÉTAIL DÉLAIS : en-têtes « dlys / dlyp… », colonnes « dly.… » — la colonne est retrouvée par sa clé */
        const col = table.querySelector(`col[data-w="${t}.${key}"]`) || table.querySelector(`col[data-w$=".${key}"]`);
        if (!col) return;
        const wKey = col.dataset.w;
        const w0 = parseFloat(col.style.width) || col.getBoundingClientRect().width;
        let w = w0;
        apply = x => {
          w = Math.max(40, Math.round(w0 + x - x0));
          col.style.width = w + "px";
          const total = [...table.querySelectorAll("col")]
            .reduce((sum, c) => sum + (parseFloat(c.style.width) || 0), 0);
          table.style.width = total + "px";
        };
        save = () => {
          const all = cwLoad();
          all[wKey] = w;
          cwSave(all);
          histLog("COLONNES", "LARGEUR", t);
        };
      }

      h.classList.add("on");
      const move = e => apply(e.clientX);
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        h.classList.remove("on");
        save();
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    };

    /* ===== export / import / aperçu PDF par bloc ===== */
    const lastShown = { client: null, detail: null, hier: {} };
    const blkName = { client: "DESIGNATIONS CLIENT", hier: "TACHES", detail: "DETAIL",
                      doc: "DOCUMENTS", taf: "TAF", obs: "OBSERVATIONS", suivi: "SUIVI", hist: "HISTORIQUE", budget: "BUDGET COMPLET" };
    const REC_KINDS = ["doc", "taf", "obs"];

    const tabTitle = () => (tabs.find(t => t.key === active) || {}).title || "DÉTAIL";
    /* libellé affiché (avec accents) ; blkLabel reste pour les noms de fichiers */
    const blkDisp = blk => ({ client: "DÉSIGNATIONS CLIENT", hier: "TÂCHES", metre: "AVANT MÉTRÉ" }[blk] || blkLabel(blk));
    const blkLabel = blk => blk === "detail" ? tabTitle()
      : blk === "metre" ? "AVANT METRE" : blk === "interne" ? "DÉTAIL PRODUITS FORMAT INTERNE" : blkName[blk];

    const blkEmpty = blk => {
      try {
        if (blk === "detail" && active === "qlt" && !INS) return true;
        const b = blk === "suivi" ? recActive : blk;
        const d = blkData(b);
        return !d || !d.rows || !d.rows.length;
      } catch (e) { return false; }
    };
    const blkData = blk => {
      if (blk === "budget") return budgetFlat();
      if (blk === "detail" && active === "qlt" && !INS) return { head: [], rows: [] };
      if (blk === "detail" && active === "dly") {
        /* délais : tableau affiché (filtres compris), dates JJ/MM/AAAA */
        const src = lastShown.detail && lastShown.detail.kind === "dly" ? lastShown.detail : { cols: DLY_COLS, rows: [] };
        const fr = v => /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(8, 10) + "/" + String(v).slice(5, 7) + "/" + String(v).slice(0, 4) : v;
        const oc = coOrder("dly", src.cols);
        return { head: oc.map(c => c[1]), rows: src.rows.map(r => oc.map(c => fr(c[2](r)))) };
      }
      if (REC_KINDS.includes(blk)) return recTableData(blk);
      if (blk === "hist") return histData();
      if (blk === "metre") return metreData();
      if (blk === "interne") return interneData();
      if (blk === "hier") {
        const h = lastShown.hier;
        const n = Math.max((h.lot || []).length, (h.prim || []).length, (h.sec || []).length);
        const ks = coKeys("hierCols", ["lot", "prim", "sec"]);
        const lab = { lot: "LOT", prim: "ACTIVITÉ PRIMAIRE", sec: "ACTIVITÉ SECONDAIRE" };
        return {
          head: ks.map(k => lab[k]),
          rows: Array.from({ length: n }, (_, i) => ks.map(k => (h[k] || [])[i] ?? ""))
        };
      }
      const src = lastShown[blk];
      if (!src) return { head: [], rows: [] };
      const oc = blk === "detail" ? screenCols(detailTable(), src.cols)
        : blk === "client" ? screenCols(shell.querySelector(".bdg-d-client-scroll table"), src.cols)
        : coOrder(blk, src.cols);
      /* désignations (budget en instance) : titres repliés = titre et son total seulement */
      if (blk === "client" && src.ins) {
        const hid = insHiddenFn(), F = foldGet();
        return {
          head: oc.map(c => c[1]),
          rows: src.rows.filter(r => !hid(r)).map(r => oc.map(c => c[2](r)))
        };
      }
      return {
        head: oc.map(c => c[1]),
        rows: src.rows.map(r => oc.map(c => c[2](r)))
      };
    };

    const fileBase = blk => {
      return (budget.project + " " + ref + " " + blkLabel(blk))
        .replace(/[\\/:*?"<>|;]+/g, "-").replace(/\s+/g, "_");
    };

    const download = (name, blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    };

    /* enregistrement : sur iPad / iPhone, la feuille de partage permet
       « Enregistrer dans Fichiers » › Google Drive, avec choix ou création
       du dossier ; sinon, téléchargement classique */
    /* fenêtre « enregistrer » au format des fenêtres INF / DOC :
       nom du fichier et dossier du Drive proposés, modifiables */
    const fileDialog = ({ title, name, path, buttons, onAct }) => {
      document.getElementById("docPop")?.remove();
      const p = document.createElement("div");
      p.id = "docPop";
      p.innerHTML = `
        <div class="doc-card" role="dialog" aria-modal="true" style="max-width:640px">
          <div class="doc-head">
            <span class="doc-title">${esc(title)}</span>
            <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
          </div>
          <div class="doc-body">
            <div class="doc-grid doc-grid-2">
              <label class="doc-lab" for="fdName">NOM DU FICHIER</label>
              <input id="fdName" class="doc-in" type="text" autocomplete="off" value="${esc(name)}">
              <label class="doc-lab" for="fdPath">DOSSIER DRIVE</label>
              <input id="fdPath" class="doc-in" type="text" autocomplete="off" data-keepcase value="${esc(path)}">
            </div>
            <div class="doc-err fd-msg" id="fdMsg"></div>
          </div>
          <div class="doc-foot">
            <button type="button" class="doc-btn" data-cancel>ANNULER</button>
            ${buttons.map(b => `<button type="button" class="doc-btn${b.primary ? " doc-save" : ""}" data-act="${b.key}"${b.drive ? " data-drive" : ""}>${esc(b.label)}</button>`).join("")}
          </div>
        </div>`;
      document.body.appendChild(p);
      popEnhance(p, "save");
      drivePathRow(p, "#fdPath", false);
      const msg = p.querySelector("#fdMsg");
      const ui = {
        msg: (t, kind) => { msg.innerHTML = t; msg.className = "doc-err fd-msg" + (kind ? " " + kind : ""); },
        close: () => p.remove(),
        busy: (k, on) => { const b = p.querySelector(`[data-act="${k}"]`); if (b) b.disabled = on; },
        setPath: v => { if (v) p.querySelector("#fdPath").value = v; }
      };
      let pathShown = false;
      p.addEventListener("click", e => {
        if (e.target === p || e.target.closest("[data-cancel]")) { p.remove(); return; }
        const b = e.target.closest("[data-act]");
        if (!b || b.disabled) return;
        /* 1er toucher sur le Drive : le dossier s'affiche ; 2e : enregistrement */
        if (b.dataset.drive !== undefined && !pathShown) {
          pathShown = true;
          drivePathRow(p, "#fdPath", true);
          b.textContent = "ENREGISTRER";
          return;
        }
        onAct(b.dataset.act, {
          name: p.querySelector("#fdName").value.trim(),
          path: driveCleanPath(p.querySelector("#fdPath").value)
        }, ui);
      });
    };

    /* enregistrement sur l'iPad (partage / téléchargement) */
    const saveDevice = (name, blob) => {
      try {
        const file = new File([blob], name, { type: blob.type });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: name }).catch(err => {
            if (err && err.name !== "AbortError") download(name, blob);
          });
          return;
        }
      } catch (e) {}
      download(name, blob);
    };

    /* chaque fichier enregistré : nom et dossier du Drive proposés (modifiables),
       puis enregistrement dans le Drive ou sur l'iPad */
    const saveFile = (name, blob) => {
      const ext = (String(name).match(/\.[a-z0-9]+$/i) || [""])[0];
      const stem = ext ? String(name).slice(0, -ext.length) : String(name);
      fileDialog({
        title: "ENREGISTRER LE FICHIER " + ext.toUpperCase().replace(".", ""),
        name: stem, path: driveLastPath(budget.project, fullRef),
        buttons: [{ key: "device", label: "SUR L'IPAD" }, { key: "drive", label: "DANS LE DRIVE", primary: true, drive: true }],
        onAct: async (k, v, ui) => {
          const nm = (v.name || stem).replace(/[\\/:*?"<>|]+/g, "-") + ext;
          if (k === "device") { saveDevice(nm, blob); ui.close(); return; }
          ui.busy("drive", true);
          ui.msg("");
          try {
            const out = await driveSave(blob, nm, v.path);
            histLog("FICHIER", "DRIVE", (out.path ? out.path + "/" : "") + nm);
            ui.setPath(out.path);
            ui.msg("");
            driveDoneFlash();
            ui.busy("drive", false);
          } catch (err) {
            ui.msg("ÉCHEC : " + esc(driveErrText(err)));
            ui.busy("drive", false);
          }
        }
      });
    };

    const loadXLSX = () => window.XLSX
      ? Promise.resolve(window.XLSX)
      : new Promise((ok, ko) => {
          const sc = document.createElement("script");
          /* version de SheetJS qui sait écrire les styles (police, bordures, alignement) */
          sc.src = "https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js";
          sc.onload = () => ok(window.XLSX);
          sc.onerror = () => ko(new Error("Bibliothèque Excel indisponible"));
          document.head.appendChild(sc);
        });

    /* entrée commune aux exports (comme sur les PDF) */
    const exportTop = blk => {
      const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
        "septembre", "octobre", "novembre", "décembre"];
      const d0 = new Date();
      const N = v => String(v ?? "").trim().toUpperCase();
      const projet = (() => { const it = sviIntitule(ref, budget.project, budget.inst); return it !== "À COMPLÉTER" ? it : budget.project; })();
      return {
        date: "Agadir, le " + String(d0.getDate()).padStart(2, "0") + " " + mois[d0.getMonth()] + " " + d0.getFullYear(),
        budget: "BUDGET N° : " + fullRef, client: "CLIENT : " + sviClient(budget.inst), projet: "PROJET : " + projet,
        titre: String(blkLabel(blk)).toUpperCase()
      };
    };

    /* largeurs des colonnes et hauteur de l'entête du tableau pour les exports
       (Excel et Google Sheets) : colonnes numériques (quantités…) ajustées aux
       nombres, titres longs repliés sur plusieurs lignes, entête à la bonne hauteur */
    const exportSizing = (head, rows) => {
      const txt = v => typeof v === "number" ? money(v) : String(v ?? "");
      const isNum = c => {
        const vals = rows.map(r => r[c]).filter(v => v !== "" && v != null);
        return vals.length > 0 && vals.filter(v => typeof v === "number").length >= vals.length / 2;
      };
      const wch = head.map((h, c) => {
        const dataLen = Math.max(0, ...rows.map(r => txt(r[c]).length));
        const longWord = Math.max(...String(h ?? "").split(/\s+/).map(w => w.length));
        if (c === 1) return Math.min(80, Math.max(dataLen, String(h ?? "").length) + 2);
        if (isNum(c)) return Math.max(9, dataLen + 3, longWord + 2);
        return Math.max(6, Math.min(30, Math.max(dataLen, longWord) + 2));
      });
      /* nombre de lignes du titre une fois replié dans sa largeur */
      const lines = head.map((h, c) => {
        let n = 1, cur = 0;
        String(h ?? "").split(/\s+/).forEach(w => {
          if (cur && cur + 1 + w.length > wch[c] - 1) { n++; cur = w.length; }
          else cur += (cur ? 1 : 0) + w.length;
        });
        return n;
      });
      const hpt = 15 * Math.max(1, ...lines) + 6;
      return { wch, hpt };
    };

    /* Google Sheets : la feuille est créée par le script Google (Code.gs) dans
       le Drive, nommée et rangée dans le dossier choisi, déjà mise en forme */
    const sendToDrive = async (blk, docName, path) => {
      const { head, rows, bold: boldIdx } = blkData(blk);
      if (!head.length) { sviAlert("Aucune donnée à exporter dans " + blkLabel(blk) + "."); return; }
      const T = exportTop(blk);
      const Uc = h => /^(ART\.?|N°)$/i.test(h) || /^(U|UPB|UCB|UNITÉ|UNITE)$/i.test(h);
      const al = (c, h) => blk === "metre" && h === "NB" ? "center"
        : blk === "metre" && h === "QUANTITÉ" ? "right"
        : c >= head.length - 5 ? "right" : Uc(h) ? "center" : "left";
      const SZ = exportSizing(head, rows);
      const name = (docName || fileBase(blk)).replace(/[\\/:*?"<>|]+/g, "-").trim();
      /* onglet ouvert dans le geste (Safari), redirigé vers la feuille une fois créée */
      const w = window.open("", "_blank");
      const say = (t, err) => {
        if (!w) { sviAlert(t); return; }
        w.document.open();
        w.document.write(`<!doctype html><html><head><meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1"><title>Google Sheets</title>
          <style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
          background:#f4f7fb;font-family:-apple-system,Arial,sans-serif;color:#172033}
          .c{background:#fff;border-radius:14px;padding:24px;max-width:440px;margin:16px;
          box-shadow:0 10px 30px rgba(0,0,0,.12);text-align:center}
          h1{font-size:17px;margin:0 0 10px;color:${err ? "#b91c1c" : "#0f4f96"}}
          p{font-size:14px;line-height:1.45;margin:0}</style></head><body><div class="c">
          <h1>${esc(name)}</h1><p>${esc(t)}</p></div></body></html>`);
        w.document.close();
      };
      say("Création de la feuille dans le Drive (" + (path || "Mon Drive") + ")…");
      try {
        const out = await apiPost("exportSheet", {
          name, path,
          top: [T.date, T.budget, T.client, T.projet, T.titre],
          head, rows, bold: boldIdx || [],
          align: head.map((h, c) => al(c, h)),
          widths: SZ.wch.map(x => Math.round(x * 7.5 + 5)),
          headHeight: Math.round(SZ.hpt * 4 / 3)
        });
        histLog(blkLabel(blk), "EXPORT", "GOOGLE SHEETS — " + rows.length + " LIGNE(S) — " + (out.path ? out.path + "/" : "") + name);
        drivePathAdd(out.path || path);
        driveUrlSet(out.path, out.folderUrl);
        saveExportDoc(null, name, name, "GOOGLE SHEETS", out.url, out.path);
        openGoogleLink(out.url, w);
        return out;
      } catch (e) {
        const m = String(e && e.message || e);
        say("Échec de la création : " + driveErrText(e), true);
      }
    };

    const openDriveExport = (blk, docName) => {
      fileDialog({
        title: "GOOGLE SHEETS — " + String(blkLabel(blk)).toUpperCase(),
        name: docName, path: driveLastPath(budget.project, fullRef),
        buttons: [{ key: "paste", label: "COPIER (FEUILLE SANS NOM)" }, { key: "go", label: "CRÉER DANS LE DRIVE", primary: true, drive: true }],
        onAct: (k, v, ui) => {
          ui.close();
          if (k === "go") sendToDrive(blk, v.name, v.path);
          else doExport(blk, "gsheet", v.name);
        }
      });
    };

    /* fichier prêt : sur l'iPad ou dans le Drive (fenêtre d'export fusionnée),
       sinon fenêtre d'enregistrement */
    /* enregistré dans le Drive : pas de message, le bouton l'indique un instant
       (le dossier utilisé reste affiché dans le champ DOSSIER DRIVE) */
    const driveDoneFlash = () => {
      const b = document.querySelector('#docPop [data-act="save"]') || document.querySelector('#docPop [data-act="drive"]');
      if (!b) return;
      const t = b.textContent;
      b.textContent = "✓ ENREGISTRÉ";
      setTimeout(() => { if (b.isConnected) b.textContent = t; }, 2500);
    };

    const deliver = async (name, blob, dest) => {
      if (!dest) return saveFile(name, blob);
      const title = name.replace(/\.[a-z0-9]+$/i, "");
      if (dest.target === "device") { saveDevice(name, blob); saveExportDoc(blob, title, name); return; }
      const ui = dest.ui;
      ui && ui.msg("");
      try {
        const out = await driveSave(blob, name, dest.path);
        histLog("FICHIER", "DRIVE", (out.path ? out.path + "/" : "") + name);
        ui && ui.setPath && ui.setPath(out.path);
        ui && ui.msg("");
        driveDoneFlash();
        saveExportDoc(blob, title, name, blob.type, out.url, out.path);
      } catch (err) {
        ui && ui.msg("ÉCHEC : " + esc(driveErrText(err)));
      }
    };

    const doExport = async (blk, fmt, docName, dest) => {
      const { head, rows, bold: boldIdx } = blkData(blk);
      if (!head.length) { sviAlert("Aucune donnée à exporter dans " + blkLabel(blk) + "."); return; }
      const T = exportTop(blk);
      const topLines = [T.date, T.budget, T.client, T.projet, T.titre];
      histLog(blkLabel(blk), "EXPORT", ({ xlsx: "EXCEL", csv: "CSV", json: "JSON", gsheet: "GOOGLE SHEETS" }[fmt] || fmt) + " — " + rows.length + " LIGNE(S)");
      /* nom du fichier : celui proposé (modifiable) dans la fenêtre d'export */
      const base = docName ? docName.replace(/[\\/:*?"<>|;]+/g, "-").trim() : fileBase(blk);
      if (fmt === "gsheet") {
        /* copie des données (tabulations) puis ouverture d'une nouvelle
           feuille Google : il suffit de coller en A1 */
        const cell = v => typeof v === "number"
          ? money(v).replace(/\s/g, "")
          : String(v ?? "").replace(/[\t\n]/g, " ");
        const tsv = [...topLines.map(t => [t]), [], head, ...rows].map(r => r.map(cell).join("\t")).join("\n");
        /* version mise en forme (police, gras, bordures, alignements) collée dans Google Sheets */
        const bs = new Set(boldIdx || []);
        const Uc = h => /^(ART\.?|N°)$/i.test(h) || /^(U|UPB|UCB|UNITÉ|UNITE)$/i.test(h);
        const al = (c, h) => blk === "metre" && h === "NB" ? "center"
          : blk === "metre" && h === "QUANTITÉ" ? "right"
          : c >= head.length - 5 ? "right" : Uc(h) ? "center" : "left";
        const st = "font-family:Arial;font-size:11pt;";
        const bd = "border:1px solid #000;";
        const SZ = exportSizing(head, rows);
        const html = `<meta charset="utf-8"><table style="border-collapse:collapse;${st}">` +
          `<colgroup>${SZ.wch.map(w => `<col width="${Math.round(w * 7.5 + 5)}" style="width:${Math.round(w * 7.5 + 5)}px">`).join("")}</colgroup>` +
          topLines.map((t, i) => `<tr><td colspan="${head.length}" style="${st}font-weight:bold;text-align:${i ? "center" : "right"}">${esc(t)}</td></tr>`).join("") +
          `<tr><td colspan="${head.length}"></td></tr>` +
          `<tr style="height:${Math.round(SZ.hpt * 4 / 3)}px">${head.map(h => `<th style="${st}${bd}font-weight:bold;background:#D9DEE6;text-align:center;vertical-align:middle;white-space:normal;height:${Math.round(SZ.hpt * 4 / 3)}px">${esc(h)}</th>`).join("")}</tr>` +
          rows.map((r, i) => `<tr>${r.map((v, c) => `<td style="${st}${bd}text-align:${al(c, head[c])};${bs.has(i) ? "font-weight:bold;" : ""}">${esc(cell(v))}</td>`).join("")}</tr>`).join("") +
          `</table>`;
        /* copie lancée et onglet ouvert dans le même geste (Safari) ;
           le message s'affiche DANS le nouvel onglet, avec un bouton
           qui ouvre ensuite la feuille Google vierge */
        const copying = !navigator.clipboard ? Promise.resolve(false)
          : (window.ClipboardItem && navigator.clipboard.write
              ? navigator.clipboard.write([new ClipboardItem({
                  "text/html": new Blob([html], { type: "text/html" }),
                  "text/plain": new Blob([tsv], { type: "text/plain" })
                })]).then(() => true, () => navigator.clipboard.writeText(tsv).then(() => true, () => false))
              : navigator.clipboard.writeText(tsv).then(() => true, () => false));
        const w = window.open("", "_blank");
        const copied = await copying;
        const msg = copied
          ? "Données copiées. Touche le bouton ci-dessous : dans la nouvelle feuille Google, touche la cellule A1 puis « Coller »."
          : "Copie impossible sur cet appareil : utilise plutôt l'export Excel, puis Fichier › Importer dans Google Sheets.";
        if (!w) { sviAlert(msg); return; }
        w.document.write(`<!doctype html><html><head><meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
          <title>Export vers Google Sheets</title>
          <style>
            body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
                   background: #f4f7fb; font-family: -apple-system, Arial, sans-serif; color: #172033; }
            .card { position: relative; background: #fff; border-radius: 14px; padding: 24px; max-width: 420px;
                    margin: 16px; box-shadow: 0 10px 30px rgba(0,0,0,.12); text-align: center; }
            h1 { font-size: 18px; margin: 0 0 10px; color: #0f4f96; padding: 0 28px; }
            h1 a { color: inherit !important; text-decoration: none !important; background: none !important;
                   padding: 0 !important; font: inherit !important; pointer-events: none; }
            p { font-size: 15px; line-height: 1.45; margin: 0 0 18px; }
            .btns { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
            .go, .cancel { display: inline-block; text-decoration: none; padding: 12px 20px; border-radius: 10px;
                           font-weight: 700; font-size: 15px; border: 0; cursor: pointer; font-family: inherit; }
            .go { background: #1d4ed8; color: #fff; }
            .cancel { background: #eef1f6; color: #374151; }
            .x { position: absolute; top: 10px; right: 10px; width: 30px; height: 30px; border: 0;
                 border-radius: 50%; background: #eef1f6; color: #374151; font-size: 15px; font-weight: 800;
                 cursor: pointer; }
          </style></head><body>
          <div class="card">
            <button class="x" onclick="window.close()" aria-label="Fermer">✕</button>
            <h1>${esc(base)}</h1>
            <p>${esc(msg)}</p>
            <div class="btns">
              ${copied ? `<a class="go" href="https://sheets.new">Ouvrir une nouvelle feuille Google</a>` : ""}
              <button class="cancel" onclick="window.close()">Annuler</button>
            </div>
          </div></body></html>`);
        w.document.close();
        return;
      }
      if (fmt === "csv") {
        const cell = v => {
          const t = typeof v === "number" ? money(v).replace(/\s/g, "") : String(v ?? "");
          return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
        };
        const txt = [...topLines.map(t => [t]), [], head, ...rows].map(r => r.map(cell).join(";")).join("\r\n");
        await deliver(base + ".csv", new Blob(["\ufeff" + txt], { type: "text/csv" }), dest);
      } else if (fmt === "json") {
        const objs = rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
        const doc = { entete: T, lignes: objs };
        await deliver(base + ".json", new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }), dest);
      } else {
        try {
          const X = await loadXLSX();
          const bold = new Set((blkData(blk).bold || []));
          const nc = head.length;
          /* entrée comme sur les PDF : date, budget, client, projet, titre */
          const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
            "septembre", "octobre", "novembre", "décembre"];
          const d0 = new Date();
          const N = v => String(v ?? "").trim().toUpperCase();
          const projet = (() => { const it = sviIntitule(ref, budget.project, budget.inst); return it !== "À COMPLÉTER" ? it : budget.project; })();
          const top = [
            ["Agadir, le " + String(d0.getDate()).padStart(2, "0") + " " + mois[d0.getMonth()] + " " + d0.getFullYear()],
            ["BUDGET N° : " + fullRef], ["CLIENT : " + sviClient(budget.inst)], ["PROJET : " + projet],
            [String(blkLabel(blk)).toUpperCase()], []
          ];
          const H0 = top.length;
          const ws = X.utils.aoa_to_sheet([...top, head, ...rows]);
          const pad = r => Array.from({ length: nc }, (_, i) => X.utils.encode_cell({ r, c: i }));
          ws["!merges"] = top.slice(0, 5).map((_, r) => ({ s: { r, c: 0 }, e: { r, c: nc - 1 } }));
          const font = (b, sz = 11) => ({ name: "Arial", sz, bold: !!b });
          const border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
          const U = h => /^(ART\.?|N°)$/i.test(h) || /^(U|UPB|UCB|UNITÉ|UNITE)$/i.test(h);
          top.slice(0, 5).forEach((_, r) => {
            const a = X.utils.encode_cell({ r, c: 0 });
            ws[a] = ws[a] || { t: "s", v: "" };
            ws[a].s = { font: font(true), alignment: { horizontal: r ? "center" : "right" } };
          });
          pad(H0).forEach(a => {
            ws[a] = ws[a] || { t: "s", v: "" };
            ws[a].s = { font: font(true), border, fill: { fgColor: { rgb: "D9DEE6" } },
              alignment: { horizontal: "center", vertical: "center", wrapText: true } };
          });
          rows.forEach((row, i) => {
            const r = H0 + 1 + i;
            pad(r).forEach((a, c) => {
              ws[a] = ws[a] || { t: "s", v: "" };
              let h = c >= nc - 5 ? "right" : U(head[c]) ? "center" : "left";
              /* format métré : NB centré, quantité à droite */
              if (blk === "metre" && head[c] === "NB") h = "center";
              if (blk === "metre" && head[c] === "QUANTITÉ") h = "right";
              ws[a].s = { font: font(bold.has(i)), border, alignment: { horizontal: h, vertical: "top", wrapText: c !== 1 || (blk === "detail" && active === "dly") } };
              if (ws[a].t === "n") ws[a].z = "#,##0.00";
            });
          });
          /* largeurs ajustées (quantités selon les nombres) et entête du tableau
             assez haute pour ses titres repliés — pour tous les exports */
          const SZ = exportSizing(head, rows);
          ws["!cols"] = SZ.wch.map(w => ({ wch: w }));
          ws["!rows"] = ws["!rows"] || [];
          ws["!rows"][H0] = { hpt: SZ.hpt };
          const wb = X.utils.book_new();
          X.utils.book_append_sheet(wb, ws, blk === "budget" ? "BUDGET" : blkLabel(blk).slice(0, 31));
          /* EXPORTER LE BUDGET : 2e onglet DÉLAIS (une ligne par période, prédécesseurs) — FORMAT 57 */
          if (blk === "budget" && INS) {
            /* FORMAT 135 : onglets DÉLAIS et QUALITÉ avec la même entrée que l'export du bloc (date, budget, client, projet, titre),
               tableau en dessous ; l'import retrouve la ligne d'en-tête */
            const tab = (title, HH, RR, al, wch, isBold) => {
              const tp = [top[0], top[1], top[2], top[3], [title], []], h0 = tp.length, n = HH.length;
              const w = X.utils.aoa_to_sheet([...tp, HH, ...RR]);
              w["!merges"] = tp.slice(0, 5).map((_, r) => ({ s: { r, c: 0 }, e: { r, c: n - 1 } }));
              tp.slice(0, 5).forEach((_, r) => { const a = X.utils.encode_cell({ r, c: 0 }); w[a] = w[a] || { t: "s", v: "" }; w[a].s = { font: font(true), alignment: { horizontal: r ? "center" : "right" } }; });
              HH.forEach((_, c) => { const a = X.utils.encode_cell({ r: h0, c }); w[a].s = { font: font(true), border, fill: { fgColor: { rgb: "D9DEE6" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true } }; });
              RR.forEach((row, i) => HH.forEach((_, c) => { const a = X.utils.encode_cell({ r: h0 + 1 + i, c }); w[a] = w[a] || { t: "s", v: "" }; w[a].s = { font: font(isBold(row)), border, alignment: { horizontal: al(c), vertical: "top", wrapText: true } }; }));
              w["!cols"] = wch.map(x => ({ wch: x }));
              w["!rows"] = []; w["!rows"][h0] = { hpt: 30 };
              return w;
            };
            const DH = ["PROJET", ...DLY_HEAD], DR = dlyExportRows().map(r => [U_(budget.project || ""), ...r]);
            X.utils.book_append_sheet(wb, tab("DÉTAIL DÉLAIS", DH, DR, c => c >= 3 && c <= 6 ? "center" : "left", [10, 24, 40, 9, 12, 12, 10, 48], () => false), "DÉLAIS");
            /* 3e onglet QUALITÉ (FORMAT 132) */
            const QH = ["PROJET", "QUALITÉ", "TITRE"], QR = (INS.qlt || []).filter(r => U_(r.v)).map(r => [U_(budget.project || ""), U_(r.v), r.t ? "OUI" : ""]);
            X.utils.book_append_sheet(wb, tab("DÉTAIL QUALITÉ", QH, QR, c => c === 2 ? "center" : "left", [10, 70, 8], row => !!row[2]), "QUALITÉ");
          }
          const out = X.write(wb, { bookType: "xlsx", type: "array" });
          await deliver(base + ".xlsx", new Blob([out], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          }), dest);
        } catch (e) {
          sviAlert(e.message);
        }
      }
    };

    const popup = (html, cls = "") => {
      document.getElementById("blkPop")?.remove();
      const p = document.createElement("div");
      p.id = "blkPop";
      p.className = cls;
      p.innerHTML = html;
      p.addEventListener("click", e => {
        if (e.target === p || e.target.closest("[data-close]")) p.remove();
      });
      document.body.appendChild(p);
      return p;
    };

    /* EXPORTER
       - départ : nom du fichier, 4 formats, ANNULER / SUR L'IPAD / DANS LE DRIVE
       - DANS LE DRIVE : la ligne DOSSIER DRIVE (lien bleu, ✎ pour la changer)
         apparaît sous le nom ; en bas il ne reste qu'ANNULER / ENREGISTRER
       - ENREGISTRER : enregistre, la fenêtre reste ouverte (accès au dossier)
       - ANNULER en mode Drive : retour à la fenêtre de départ */
    const openExportMenu = blk => {
      loadXLSX().catch(() => {});
      const label = String(blkLabel(blk)).toUpperCase();
      let fmt = "xlsx", driveMode = false;
      document.getElementById("docPop")?.remove();
      const p = document.createElement("div");
      p.id = "docPop";
      const path0 = driveLastPath(budget.project, fullRef);
      p.innerHTML = `
        <div class="doc-card" role="dialog" aria-modal="true" style="max-width:640px">
          <div class="doc-head">
            <span class="doc-title">EXPORTER — ${esc(label)}</span>
            <button type="button" class="doc-x" data-close aria-label="Fermer">✕</button>
          </div>
          <div class="doc-body">
            <div class="doc-grid doc-grid-2">
              <label class="doc-lab" for="fdName">NOM DU FICHIER</label>
              <input id="fdName" class="doc-in doc-ro" type="text" autocomplete="off" readonly value="${esc((fullRef + " " + label).replace(/[\\/:*?"<>|]+/g, "-"))}">
              <span class="doc-lab exp-drv" hidden>DOSSIER DRIVE</span>
              <div class="exp-drv exp-drv-row" hidden>
                <input type="text" class="doc-in exp-path" id="expPath" data-keepcase autocomplete="off" readonly
                  title="Toucher : ouvrir le dossier — appui long : modifier" value="${esc(path0)}">
              </div>
            </div>
            <div class="fmt-choice fmt-grid">
              <button type="button" class="doc-btn fmt-btn on" data-fmt="xlsx">EXCEL</button>
              <button type="button" class="doc-btn fmt-btn" data-fmt="csv">CSV</button>
              <button type="button" class="doc-btn fmt-btn" data-fmt="json">JSON</button>
              <button type="button" class="doc-btn fmt-btn" data-fmt="gsheet">GOOGLE SHEETS</button>
            </div>
            <div class="doc-err fd-msg" id="fdMsg"></div>
          </div>
          <div class="doc-foot">
            <button type="button" class="doc-btn" data-cancel>ANNULER</button>
            <button type="button" class="doc-btn" data-act="device">SUR L'IPAD</button>
            <button type="button" class="doc-btn doc-save" data-act="drive">DANS LE DRIVE</button>
            <button type="button" class="doc-btn doc-save" data-act="save" hidden>ENREGISTRER</button>
          </div>
        </div>`;
      document.body.appendChild(p);
      popEnhance(p, "export");
      const $q = sel => p.querySelector(sel);
      const msg = $q("#fdMsg");
      const ui = {
        msg: (t, kind) => { msg.innerHTML = t; msg.className = "doc-err fd-msg" + (kind ? " " + kind : ""); },
        close: () => p.remove(),
        setPath: v => { if (v) $q("#expPath").value = v; }
      };
      const devBtn = $q('[data-act="device"]'), drvBtn = $q('[data-act="drive"]'), saveBtn = $q('[data-act="save"]');
      const show = (el, on) => { el.hidden = !on; el.style.display = on ? "" : "none"; };
      /* boutons activés selon le cas */
      const refresh = () => {
        p.querySelectorAll(".exp-drv").forEach(el => show(el, driveMode));
        show(devBtn, !driveMode);
        show(drvBtn, !driveMode);
        show(saveBtn, driveMode);
        devBtn.disabled = fmt === "gsheet";       /* Google Sheets : Drive seulement */
      };
      const curPath = () => $q("#expPath").value.trim();
      refresh();
      /* adresse du dossier : toucher = ouvrir dans le Drive ;
         appui long (ou double toucher) = modifier, comme un champ normal */
      {
        const f = $q("#expPath");
        let timer = null, longDone = false;
        const edit = () => {
          f.readOnly = false; f.classList.add("editing");
          f.focus(); f.select();
        };
        f.addEventListener("pointerdown", () => {
          if (!f.readOnly) return;
          longDone = false;
          timer = setTimeout(() => { longDone = true; edit(); }, 550);
        });
        ["pointerup", "pointerleave", "pointercancel"].forEach(ev =>
          f.addEventListener(ev, () => clearTimeout(timer)));
        f.addEventListener("click", e => {
          if (!f.readOnly || longDone) { longDone = false; return; }
          e.preventDefault();
          driveOpenFolder(curPath());
        });
        f.addEventListener("dblclick", () => { if (f.readOnly) edit(); });
        f.addEventListener("contextmenu", e => { if (f.readOnly) e.preventDefault(); });
        const done = () => { f.readOnly = true; f.classList.remove("editing"); };
        f.addEventListener("blur", done);
        f.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); f.blur(); } });
      }

      p.addEventListener("click", async e => {
        if (e.target === p || e.target.closest("[data-close]")) { p.remove(); return; }
        if (e.target.closest("[data-cancel]")) {
          if (driveMode) { driveMode = false; ui.msg(""); refresh(); } else p.remove();
          return;
        }
        const f = e.target.closest("[data-fmt]");
        if (f) {
          fmt = f.dataset.fmt;
          p.querySelectorAll("[data-fmt]").forEach(x => x.classList.toggle("on", x === f));
          ui.msg("");
          refresh();
          return;
        }
        const b = e.target.closest("[data-act]");
        if (!b || b.disabled) return;
        const name = ($q("#fdName").value.trim() || fullRef + " " + label).replace(/[\\/:*?"<>|]+/g, "-");
        if (b.dataset.act === "drive") { driveMode = true; ui.msg(""); refresh(); return; }
        if (b.dataset.act === "device") {
          await doExport(blk, fmt, name, { target: "device", path: "", ui });
          return;
        }
        /* ENREGISTRER dans le Drive */
        const path = driveCleanPath(curPath());
        if (fmt === "gsheet") {
          const out = await sendToDrive(blk, name, path);
          if (out && out.path) ui.setPath(out.path);
          driveDoneFlash();
          return;
        }
        saveBtn.disabled = true;
        await doExport(blk, fmt, name, { target: "drive", path, ui });
        saveBtn.disabled = false;
      });
    };

    const showImport = (name, head, rows) => {
      histLog("IMPORT", "APERÇU IMPORT", name + " — " + rows.length + " LIGNE(S)");
      const body = rows.slice(0, 300).map(r =>
        "<tr>" + head.map((_, i) => `<td>${esc(r[i] ?? "")}</td>`).join("") + "</tr>").join("");
      popup(`
        <div class="blk-card blk-wide">
          <button type="button" class="blk-x" data-close>✕</button>
          <div class="blk-title">IMPORT — ${esc(name)}</div>
          <div class="blk-sub">${rows.length} ligne(s) lue(s)${rows.length > 300 ? " — 300 premières affichées" : ""}.
            Aperçu seulement : l'enregistrement dans la feuille Google nécessite
            une fonction d'import côté Apps Script (Code.gs).</div>
          <div class="blk-scroll">
            <table class="bdg-d-table blk-imp">
              <thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead>
              <tbody>${body}</tbody>
            </table>
          </div>
        </div>`);
    };

    /* fenêtre au format INF : lien de la feuille Google à importer */
    const askSheetLink = () => new Promise(res => {
      document.getElementById("docPop")?.remove();
      const p = document.createElement("div");
      p.id = "docPop";
      p.className = "pop-new-bdg";
      p.innerHTML = `
        <div class="doc-card" role="dialog" aria-modal="true" style="max-width:760px">
          <div class="doc-head">
            <span class="doc-title">IMPORTER — GOOGLE SHEETS</span>
            <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
          </div>
          <div class="doc-body">
            <div class="doc-grid">
              <label class="doc-lab" for="gsLink">LIEN DE LA FEUILLE <b>*</b></label>
              <input id="gsLink" class="doc-in" style="grid-column:2 / -1;width:100%" type="url" data-keepcase autocomplete="off"
                inputmode="url" placeholder="https://docs.google.com/spreadsheets/d/…">
            </div>
            <div id="gsErr" class="doc-err"></div>
          </div>
          <div class="doc-foot">
            <button type="button" class="doc-btn" data-cancel>ANNULER</button>
            <button type="button" class="doc-btn nb-save" id="gsGo">IMPORTER</button>
          </div>
        </div>`;
      document.body.appendChild(p);
      try { popEnhance(p, "gslink"); } catch (e) {}
      const inp = p.querySelector("#gsLink");
      /* champ sur toute la largeur de la fenêtre */
      const cell = inp.parentElement.classList.contains("doc-grid") ? inp : inp.parentElement;
      cell.style.gridColumn = "2 / -1";
      cell.style.width = "100%";
      const close = v => { p.remove(); res(v); };
      const go = () => {
        const v = inp.value.trim();
        if (!/\/d\/[a-zA-Z0-9_-]+/.test(v)) {
          p.querySelector("#gsErr").textContent = "LIEN GOOGLE SHEETS NON RECONNU.";
          inp.focus();
          return;
        }
        close(v);
      };
      p.addEventListener("click", e => {
        if (e.target === p || e.target.closest("[data-cancel]")) close("");
        else if (e.target.closest("#gsGo")) go();
      });
      inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); go(); } });
      setTimeout(() => inp.focus(), 50);
    });

    const importGSheet = async () => {
      const url = await askSheetLink();
      if (!url) return;
      const id = (url.match(/\/d\/([a-zA-Z0-9_-]+)/) || [])[1];
      const gid = (url.match(/[#&?]gid=(\d+)/) || [])[1] || "0";
      if (!id) { svImportFail({ source: url, tries: [{ err: "LIEN GOOGLE SHEETS NON RECONNU" }], hint: "COPIER LE LIEN COMPLET DE LA FEUILLE (IL CONTIENT /spreadsheets/d/…)." }); return; }
      /* lecture par le script (avec votre compte : pas besoin de partager la feuille) */
      let first = "";
      for (const call of [() => apiGet("sheetRead", { link: url }), () => apiPost("sheetRead", { link: url })]) {
        try {
          const d = await call();
          if (d && d.ok && Array.isArray(d.values)) {
            showImport(d.name || "Google Sheets", d.values[0] || [], d.values.slice(1));
            return;
          }
          first = first || "LE SCRIPT NE CONNAÎT PAS ENCORE LA LECTURE DE FEUILLE (NOUVELLE VERSION À DÉPLOYER)";
        } catch (e) { first = first || (e && e.message) || String(e); }
      }
      /* repli : feuille partagée « Toute personne disposant du lien » */
      try {
        const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`);
        if (!r.ok) throw new Error("HTTP " + r.status + " — ACCÈS REFUSÉ (FEUILLE NON PARTAGÉE)");
        const X = await loadXLSX();
        const wb = X.read(await r.text(), { type: "string" });
        const aoa = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
        showImport("Google Sheets", aoa[0] || [], aoa.slice(1));
      } catch (e) {
        svImportFail({ source: "GOOGLE SHEETS — " + url, tries: [{ via: "PAR LE SCRIPT", err: first }, { via: "PAR LE LIEN PUBLIC", err: e }], hint: "VÉRIFIER LE LIEN, QUE VOTRE COMPTE GOOGLE A ACCÈS À LA FEUILLE, OU LA PARTAGER « TOUTE PERSONNE DISPOSANT DU LIEN » ; SINON EXPORTER LA FEUILLE EN EXCEL ET IMPORTER LE FICHIER." });
      }
    };

    @endverbatim