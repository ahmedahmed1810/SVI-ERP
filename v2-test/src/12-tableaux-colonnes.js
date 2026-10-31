    /* ===== tri et filtre par colonne (façon tableur) ===== */
    const CF = {};          /* CF[table] = { sort:{col,dir}|null, f:{col:Set} } */
    const cfSrc = {};       /* dernières lignes et colonnes de chaque tableau */
    const cfT = t => CF[t] || (CF[t] = { sort: null, f: {} });

    /* ===== ordre manuel des lignes (glisser une ligne après un appui long) :
       désignations client, lots, activités primaires et secondaires ===== */
    const RO_KEY = "svi_roworder_v1:" + String(ref);
    const roLoad = () => {
      try { return JSON.parse(localStorage.getItem(RO_KEY) || "{}") || {}; } catch (e) { return {}; }
    };
    const roSave = o => { try { localStorage.setItem(RO_KEY, JSON.stringify(o)); } catch (e) {} };
    /* appliqué quand aucun tri n'est choisi sur ce tableau */
    const roApply = (t, arr, keyOf) => {
      const st = CF[t];
      if (st && st.sort && !st.sort.def) return arr;
      const order = roLoad()[t];
      if (!order || !order.length) return arr;
      const pos = new Map(order.map((k, i) => [k, i]));
      return arr.map((x, i) => ({ x, i }))
        .sort((a, b) => {
          const pa = pos.has(keyOf(a.x)) ? pos.get(keyOf(a.x)) : Infinity;
          const pb = pos.has(keyOf(b.x)) ? pos.get(keyOf(b.x)) : Infinity;
          return pa - pb || a.i - b.i;
        }).map(o => o.x);
    };

    /* cols : [cle, libellé, accesseur, classe] */
    const cfApply = (t, cols, rows, keepSrc = false) => {
      if (!keepSrc) cfSrc[t] = { cols, rows };
      const st = cfT(t);
      let out = rows.filter(r =>
        cols.every(([k, , get]) =>
          !st.f[k] || st.f[k].has(cfText(get(r)))
        )
      );
      if (st.sort) {
        const c = cols.find(c => c[0] === st.sort.col);
        if (c) {
          const get = c[2];
          const dir = st.sort.dir === "desc" ? -1 : 1;
          out = [...out].sort((a, b) => {
            const x = get(a), y = get(b);
            const r = typeof x === "number" && typeof y === "number"
              ? x - y
              : String(x ?? "").localeCompare(String(y ?? ""), "fr", { numeric: true });
            return r * dir;
          });
        }
      }
      return out;
    };

    const cfHead = (t, key, label, cls = "") => {
      const st = cfT(t);
      /* en-tête de colonne bleu : filtre ou tri choisi sur cette colonne */
      const on = !!st.f[key] || !!(st.sort && st.sort.col === key && !st.sort.def) || !!(shell.__cfParOn && shell.__cfParOn(t, key));
      return `<th class="${cls} ${on ? "cf-on" : ""}">
        <span class="cf-wrap"><span class="cf-lab">${(() => { const k = shell.__faFor && shell.__faFor(t, key); return k && shell.__faHTML ? shell.__faHTML(k) : ""; })()}${label}</span><span class="cf-btn" data-cf="${t}" data-col="${key}"
          role="button" aria-label="Trier / filtrer">${cfIcon}</span></span><span
          class="col-rs" data-rs="${t}" data-col="${key}"></span></th>`;
    };

    /* =========================================================
       REFONTE, ÉTAPE 3 (v643) : CATALOGUE UNIQUE DES COLONNES — pour chaque clé de colonne, une fois :
       w = largeur par défaut à l'écran (px), pw = poids dans les aperçus PDF, f = format (« pct » : 12,50 %).
       SVI_COL_T = largeurs par tableau (FORMAT 113 : disposition réglée par Ahmed sur l'iPad, 13/10/2026).
       Une colonne ajoutée à un tableau (liste [clé, libellé, valeur, classe]) a donc d'office : tri, filtre, largeur réglable
       et mémorisée, ordre, copie, export, aperçu (largeur et format) — il suffit de lui donner une ligne ici.
       ========================================================= */


    const detailTable = () => body && body.querySelector("table.bdg-d-table, table.ins-table, table.lk-table");

    let cfOpen = null;   /* { t, key } du menu ouvert */
    let cfPlace = () => {};

    const cfClose = () => {
      window.visualViewport?.removeEventListener("resize", cfPlace);
      window.visualViewport?.removeEventListener("scroll", cfPlace);
      document.getElementById("cfMenu")?.remove();
      cfOpen = null;
    };

    /* v510 (remarque 70) : CONDITION sur une colonne de nombres ou de dates (égal, différent, supérieur, inférieur, entre ;
       le, avant le, après le, entre) — combinée aux cases de valeurs ; le filtre garde la forme d'un ensemble (has) */
    const cfDate = x => { const s = String(x || "").trim(); const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (m) return m[3] + "-" + m[2] + "-" + m[1]; return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ""; };
    const cfMakeF = (vals, cond) => ({ cond, vals, has: v => (!vals || vals.has(v)) && cfCondOk(cond, v), [Symbol.iterator]: function* () { if (vals) yield* vals; } });

    const cfValues = (t, key) => {
      const src = cfSrc[t];
      if (!src) return [];
      const c = src.cols.find(c => c[0] === key);
      const st = cfT(t);
      /* lignes encore possibles : filtres par sélection (déjà appliqués
         aux lignes source) + filtres des AUTRES colonnes du tableau */
      const rows = src.rows.filter(r =>
        src.cols.every(([k, , get]) =>
          k === key || !st.f[k] || st.f[k].has(cfText(get(r)))
        )
      );
      const raw = rows.map(r => c[2](r));
      const num = raw.every(v => typeof v === "number");
      const uniqVals = [...new Set(raw.map(cfText))];
      if (num) {
        const back = new Map(raw.map(v => [cfText(v), v]));
        return uniqVals.sort((a, b) => back.get(a) - back.get(b));
      }
      return uniqVals.sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
    };

    const cfRenderList = () => {
      const m = document.getElementById("cfMenu");
      if (!m || !cfOpen) return;
      const { t, key } = cfOpen;
      const st = cfT(t);
      const q = (m.querySelector(".cf-q").value || "").trim().toUpperCase();
      const vals = cfValues(t, key).filter(v => !q || v.toUpperCase().includes(q));
      /* comme Google Sheets : les cases suivent le brouillon du menu, appliqué seulement par OK */
      const isOn = v => cfOpen.draft.has(v);
      /* valeurs cochées (filtre actif) remontées en tête de liste */
      if (st.f[key]) vals.sort((x, y) => isOn(y) - isOn(x));
      const allOn = vals.length && vals.every(isOn);
      m.querySelector(".cf-list").innerHTML =
        `<label class="cf-item cf-all"><input type="checkbox" data-cfall ${allOn ? "checked" : ""}>
           (TOUT SÉLECTIONNER)<span class="cf-n">${vals.filter(isOn).length}/${vals.length}</span></label>` +
        (vals.length
          ? vals.map(v => `<label class="cf-item"><input type="checkbox" data-cfv="${esc(v)}"
               ${isOn(v) ? "checked" : ""}> ${esc(v || "(vide)")}</label>`).join("")
          : `<div class="cf-none">AUCUNE VALEUR</div>`);
      m.querySelectorAll(".cf-sort").forEach(b =>
        b.classList.toggle("on", !!st.sort && st.sort.col === key && st.sort.dir === b.dataset.dir)
      );
    };

    /* partie CONDITION du menu (colonne de nombres ou de dates) */
    const cfCondUI = m => {
      const box = m.querySelector(".cf-cond");
      if (!box || !cfOpen) return;
      const kind = cfKind(cfValues(cfOpen.t, cfOpen.key));
      cfOpen.kind = kind;
      if (!kind) { box.innerHTML = ""; return; }
      const c = cfOpen.cond && cfOpen.cond.kind === kind ? cfOpen.cond : null;
      const ops = kind === "num" ? [["", "AUCUNE"], ["eq", "ÉGAL À"], ["ne", "DIFFÉRENT DE"], ["gt", "SUPÉRIEUR À"], ["ge", "SUPÉRIEUR OU ÉGAL À"], ["lt", "INFÉRIEUR À"], ["le", "INFÉRIEUR OU ÉGAL À"], ["bt", "ENTRE … ET …"]]
        : kind === "date" ? [["", "AUCUNE"], ["eq", "LE"], ["lt", "AVANT LE"], ["gt", "APRÈS LE"], ["bt", "ENTRE LE … ET LE …"]]
        : [["", "AUCUNE"], ["ct", "CONTIENT"], ["nc", "NE CONTIENT PAS"], ["sw", "COMMENCE PAR"], ["ew", "SE TERMINE PAR"], ["eq", "ÉGAL À"]];
      const fmt = v => v === undefined || v === null || v === "" ? "" : kind === "num" ? money(v) : v;
      const inp = (n, v) => kind === "num" ? `<input class="cf-ca" data-n="${n}" inputmode="decimal" value="${esc(fmt(v))}" placeholder="VALEUR">` : kind === "txt" ? `<input class="cf-ca" data-n="${n}" value="${esc(v || "")}" placeholder="TEXTE" autocomplete="off">` : `<input type="date" class="cf-ca" data-n="${n}" value="${esc(v || "")}">`;
      /* v622 : liste CONDITION de l'application (plus la grande liste de l'iPad) — petites lignes, ✓ devant le choix en cours */
      const op0 = c ? c.op : "", lab0 = (ops.find(o => o[0] === op0) || ops[0])[1];
      box.innerHTML = `<div class="cf-ct">CONDITION (${kind === "num" ? "NOMBRES" : kind === "date" ? "DATES" : "TEXTE"})</div><div class="cf-opw"><button type="button" class="cf-opb"><span>${lab0}</span><i>▾</i></button><div class="cf-opl" hidden>${ops.map(([k, l]) => `<button type="button" class="cf-opi${k === op0 ? " on" : ""}" data-op="${k}"><b>${k === op0 ? "✓" : ""}</b>${l}</button>`).join("")}</div><input type="hidden" class="cf-op" value="${op0}"></div>
        <div class="cf-cv${c ? "" : " off"}">${inp("a", c && c.a)}<span class="cf-et${c && c.op === "bt" ? "" : " off"}"> ET </span>${`<span class="cf-bw${c && c.op === "bt" ? "" : " off"}">${inp("b", c && c.b)}</span>`}</div>`;
      box.addEventListener("click", ev => {
        if (ev.target.closest(".cf-opb")) { const L = box.querySelector(".cf-opl"); L.hidden = !L.hidden; cfPlace && cfPlace(); return; }
        const it = ev.target.closest(".cf-opi");
        if (!it) return;
        const op = it.dataset.op;
        box.querySelector(".cf-op").value = op;
        box.querySelector(".cf-opb span").textContent = (ops.find(o => o[0] === op) || ops[0])[1];
        box.querySelectorAll(".cf-opi").forEach(b => { b.classList.toggle("on", b === it); b.querySelector("b").textContent = b === it ? "✓" : ""; });
        box.querySelector(".cf-opl").hidden = true;
        box.querySelector(".cf-cv").classList.toggle("off", !op);
        box.querySelectorAll(".cf-et, .cf-bw").forEach(x => x.classList.toggle("off", op !== "bt"));
        if (op) setTimeout(() => box.querySelector('.cf-ca[data-n="a"]')?.focus(), 0);
      });
    };
    /* condition lue dans le menu : null (aucune), false (incomplète) ou { kind, op, a, b } */
    const cfReadCond = m => {
      const box = m.querySelector(".cf-cond"), kind = cfOpen && cfOpen.kind;
      if (!box || !kind) return null;
      const op = (box.querySelector(".cf-op") || {}).value || "";
      if (!op) return null;
      const rd = n => { const i = box.querySelector(`.cf-ca[data-n="${n}"]`); const v = i ? String(i.value || "").trim() : ""; if (!v) return null; return kind === "num" ? cfNum(v) : kind === "txt" ? v.toUpperCase() : cfDate(v) || v; };
      const a = rd("a"), b = op === "bt" ? rd("b") : null;
      if (a === null || (op === "bt" && b === null)) return false;
      return { kind, op, a, b };
    };

    const cfAfterChange = () => {
      refreshAll();
      cfRenderList();
      cfPlace();
    };

    const cfOpenMenu = (btn) => {
      const t = btn.dataset.cf, key = btn.dataset.col;
      if (cfOpen && cfOpen.t === t && cfOpen.key === key) { cfClose(); return; }
      cfClose();
      {
        const st0 = cfT(t), f0 = st0.f[key];
        cfOpen = { t, key, cond: f0 && f0.cond ? { ...f0.cond } : null, draft: new Set(f0 ? (f0.cond && !f0.vals ? cfValues(t, key) : [...f0]) : cfValues(t, key)) };
      }
      const m = document.createElement("div");
      m.id = "cfMenu";
      m.innerHTML = `
        <div class="cf-rsz" title="Largeur et hauteur"></div>
        <button type="button" class="cf-x" aria-label="Fermer">✕</button>
        <button type="button" class="cf-sort" data-dir="asc">↑ TRI CROISSANT</button>
        <button type="button" class="cf-sort" data-dir="desc">↓ TRI DÉCROISSANT</button>${shell.__cfPar ? shell.__cfPar(t, key) : ""}
        <div class="cf-search">🔍 <input type="search" class="cf-q" placeholder="RECHERCHER…"></div>
        <div class="cf-cond"></div>
        <div class="cf-list"></div>
        <div class="cf-foot">
          <button type="button" class="cf-clear">EFFACER</button>
          <button type="button" class="cf-ok">OK</button>
        </div>`;
      document.body.appendChild(m);

      cfPlace = () => {
        if (!document.body.contains(m)) return;
        /* l'en-tête est redessiné à chaque changement : on repart du
           bouton actuellement affiché pour garder le menu sous sa colonne */
        const live = document.querySelector(
          `.cf-btn[data-cf="${t}"][data-col="${key}"]`
        ) || btn;
        const r = live.getBoundingClientRect();
        if (!r.width && !r.height) return;
        const vv = window.visualViewport;
        const vTop = vv ? vv.offsetTop : 0;
        const vH = vv ? vv.height : window.innerHeight;
        /* largeur ajustable par la poignée du bord gauche, mémorisée (FORMAT 73) */
        let w = 240;
        try { w = Math.max(200, Math.min(window.innerWidth * 0.9, +localStorage.getItem("svi_cfw_v1") || 240)); } catch (e) {}
        m.style.width = w + "px";
        m.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + "px";
        const below = vTop + vH - r.bottom - 10;
        const above = r.top - vTop - 10;
        const useBelow = below >= 280 || below >= above;
        /* jamais plus haut que 60 % de l'écran visible, et toujours
           entièrement visible (boutons OK / Effacer accessibles) */
        let uh = 0;
        try { uh = +localStorage.getItem("svi_cfh_v1") || 0; } catch (e) {}
        const maxH = Math.max(180, Math.min(uh ? vH - 16 : vH * 0.6, useBelow ? below : above));
        m.style.maxHeight = maxH + "px";
        m.style.height = uh ? Math.min(uh, maxH) + "px" : "";
        const realH = Math.min(maxH, m.scrollHeight);
        let top = useBelow ? r.bottom + 4 : r.top - 4 - realH;
        const h = Math.min(maxH, m.offsetHeight);
        top = Math.min(top, vTop + vH - 8 - h);
        m.style.top = Math.max(vTop + 8, top) + "px";
      };
      cfPlace();
      m.querySelector(".cf-rsz").addEventListener("pointerdown", ev => {
        ev.preventDefault(); ev.stopPropagation();
        const x0 = ev.clientX, y0 = ev.clientY, r0 = m.getBoundingClientRect();
        m.style.maxHeight = (window.innerHeight - r0.top - 8) + "px";
        const mv = e2 => {
          /* poignée d'angle (bas gauche) : largeur ET hauteur, mémorisées */
          const w = Math.max(200, Math.min(window.innerWidth * 0.9, r0.width + (x0 - e2.clientX)));
          const h = Math.max(180, Math.min(window.innerHeight - r0.top - 8, r0.height + (e2.clientY - y0)));
          m.style.width = w + "px";
          m.style.left = Math.max(8, r0.right - w) + "px";
          m.style.height = h + "px";
          try { localStorage.setItem("svi_cfw_v1", Math.round(w)); localStorage.setItem("svi_cfh_v1", Math.round(h)); } catch (e) {}
        };
        window.__cfRsz = true;
        const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); setTimeout(() => { window.__cfRsz = false; }, 300); };
        document.addEventListener("pointermove", mv);
        document.addEventListener("pointerup", up);
      });
      window.visualViewport?.addEventListener("resize", cfPlace);
      window.visualViewport?.addEventListener("scroll", cfPlace);

      /* v621 : « CHARGES QUI FONT n % » (colonne % de DÉTAIL CHARGES) */
      m.addEventListener("change", e => { const pi = e.target.closest && e.target.closest(".cf-par-in"); if (pi && shell.__cfParSet) shell.__cfParSet(pi.value, pi); });
      m.addEventListener("click", e => {
        e.stopPropagation();
        const st = cfT(t);
        const sb = e.target.closest(".cf-sort");
        if (sb) {
          const same = st.sort && st.sort.col === key && st.sort.dir === sb.dataset.dir;
          st.sort = same ? null : { col: key, dir: sb.dataset.dir };
          cfAfterChange();
          return;
        }
        /* OK : le filtre coché s'applique ; ✕ (ou toucher ailleurs) : rien ne change */
        if (e.target.closest(".cf-ok")) {
          const all = cfValues(t, key);
          const keep = new Set(all.filter(v => cfOpen.draft.has(v)));
          const cond = cfReadCond(m);
          if (cond === false) { svToast("CONDITION INCOMPLÈTE : SAISIR LA OU LES VALEURS.", 2500); return; }
          if (keep.size === all.length && !cond) delete st.f[key];
          else st.f[key] = cond ? cfMakeF(keep.size === all.length ? null : keep, cond) : keep;
          cfClose();
          keepScroll.toTop = true;
          refreshAll();
          return;
        }
        if (e.target.closest(".cf-x")) {
          cfClose();
          return;
        }
        if (e.target.closest(".cf-clear")) {
          if (shell.__cfParClear) shell.__cfParClear(t, key);
          delete st.f[key];
          if (st.sort && st.sort.col === key) st.sort = null;
          m.querySelector(".cf-q").value = "";
          cfOpen.cond = null; cfCondUI(m);
          cfOpen.draft = new Set(cfValues(t, key));
          cfAfterChange();
        }
      });

      m.addEventListener("change", e => {
        const all = cfValues(t, key);
        const q = (m.querySelector(".cf-q").value || "").trim().toUpperCase();
        const shown = all.filter(v => !q || v.toUpperCase().includes(q));
        const keep = cfOpen.draft;
        if (e.target.matches("[data-cfall]")) {
          /* (TOUT SÉLECTIONNER) : seulement les valeurs affichées par la recherche */
          shown.forEach(v => e.target.checked ? keep.add(v) : keep.delete(v));
        } else if (e.target.matches("[data-cfv]")) {
          const v = e.target.dataset.cfv;
          e.target.checked ? keep.add(v) : keep.delete(v);
        } else {
          return;
        }
        /* rien ne s'applique au tableau avant OK */
        const sc = m.querySelector(".cf-list").scrollTop;
        cfRenderList();
        m.querySelector(".cf-list").scrollTop = sc;
      });

      /* recherche : réduit seulement la liste affichée, sans rien cocher ni décocher */
      m.querySelector(".cf-q").addEventListener("input", () => {
        cfRenderList();
        cfPlace();
      });

      cfCondUI(m);
      cfRenderList();
      /* placement APRÈS remplissage de la liste (hauteur réelle connue) */
      cfPlace();
      requestAnimationFrame(cfPlace);
    };

    /* fermeture du menu au toucher ailleurs (un seul écouteur actif) */
    if (window.__cfDocHandler) {
      document.removeEventListener("click", window.__cfDocHandler, true);
    }
    window.__cfDocHandler = e => {
      if (!cfOpen) return;
      if (e.target.closest("#cfMenu") || e.target.closest(".cf-btn") || e.target.closest("#svCal") || window.__cfRsz) return;
      cfClose();
    };
    document.addEventListener("click", window.__cfDocHandler, true);
    document.getElementById("cfMenu")?.remove();

