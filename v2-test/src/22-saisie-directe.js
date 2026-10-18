    /* ===== v476 (remarque 4) : SAISIE DIRECTE — le tableau d'import, dans l'application =====
       toutes les lignes déjà saisies (une par produit / charge avec sa chaîne), modifiables et filtrables ; lignes nouvelles en bas ;
       ENTRÉE = case suivante, sur la dernière case la ligne est recopiée (curseur sur la désignation produit / charge) ;
       VALIDER : lignes existantes mises à jour (chaîne d'une ligne liée : délier d'abord), lignes nouvelles importées avec les règles
       de l'import (erreurs dans IMPORT NON CRÉÉ, doublons signalés) */
    const openDirectEntry = kind => {
      if (!INS || !INS_EDIT) return;
      const P = kind === "prd";
      const nm = (k, id) => { const r = (INS[k] || []).find(x => x.id === id); return r ? (k === "des" ? r.des || "" : r.v || "") : ""; };
      /* v481 (remarque 17) : U = unité de l'activité secondaire (obligatoire ; tâche primaire : UPB de la désignation, grisée) */
      const COLS = [["dc", "DÉSIGNATION CLIENT", 220], ["upb", "UPB", 54], ["lot", "LOT", 140], ["prim", "ACTIVITÉ PRIMAIRE", 150], ["sec", "ACTIVITÉ SECONDAIRE", 150], ["su", "U", 46]]
        .concat(P ? [["des", "DÉSIGNATION PRODUIT", 170], ["u", "UNITÉ", 54], ["nbr", "NBR", 60], ["d1", "DIM 1", 60], ["d2", "DIM 2", 60], ["d3", "DIM 3", 60]]
          : [["art", "ARTICLE", 80], ["des", "DÉSIGNATION CHARGE", 200], ["u", "UNITÉ", 54], ["q", "QTE", 70]]);
      const NUMF = new Set(["nbr", "d1", "d2", "d3", "q"]);
      const fmtN = v => v === "" || v === undefined || v === null ? "" : String(v).replace(".", ",");
      let rows = [];
      let recs = INS[kind] || [];
      const blank = () => ({ dc: "", upb: "", lot: "", prim: "", sec: "", su: "", art: "", des: "", u: "", nbr: "", d1: "", d2: "", d3: "", q: "" });
      /* v480 (remarques 14 et 16) : lignes relues depuis le budget (à l'ouverture et après chaque VALIDER) */
      let dirty = false;
      const loadRows = () => {
      rows = []; recs = INS[kind] || [];
      const seen = new Set();
      (INS.links || []).forEach(l => (l[kind] || []).forEach(x => {
        const r = recs.find(q => q.id === x.id); if (!r) return; seen.add(r.id);
        const d = INS.des.find(q => q.id === l.des) || {};
        rows.push({ _id: r.id, _lid: l.id || "L" + (INS.links || []).indexOf(l), dc: d.des || "", upb: d.u || "", lot: nm("lot", l.lot), prim: nm("prim", l.prim), sec: nm("sec", l.sec), su: U_(((INS.sec || []).find(q => q.id === l.sec) || {}).u),
          art: r.art || "", des: r.des || "", u: r.u || "", nbr: fmtN(r.nbr), d1: fmtN(r.d1), d2: fmtN(r.d2), d3: fmtN(r.d3), q: fmtN(r.q) });
      }));
      recs.filter(r => !r.t && !seen.has(r.id)).forEach(r => rows.push({ _id: r.id, dc: "", upb: "", lot: "", prim: "", sec: "", su: "", art: r.art || "", des: r.des || "", u: r.u || "", nbr: fmtN(r.nbr), d1: fmtN(r.d1), d2: fmtN(r.d2), d3: fmtN(r.d3), q: fmtN(r.q) }));
      rows.forEach(r => { r._o = JSON.stringify(COLS.map(c => r[c[0]])); r._l = l0(r); });
      rows.push(blank());
      dirty = false;
      };
      /* ancienne chaîne d'une ligne liée (pour la délier si elle change) */
      const l0 = r => { if (!r._lid) return null; return (INS.links || []).find((l, n) => (l.id || "L" + n) === r._lid) || null; };
      loadRows();
      const TK = "sd_" + kind;
      const lists = {
        dc: [...new Set(INS.des.filter(x => !x.t).map(x => x.des))], upb: [...new Set(INS.des.map(x => U_(x.u)).filter(Boolean))],
        lot: [...new Set(INS.lot.filter(x => !x.t).map(x => x.v))], prim: [...new Set(INS.prim.map(x => x.v))], sec: [...new Set(INS.sec.map(x => x.v))],
        des: [...new Set(recs.map(x => x.des).concat(P ? [] : ((typeof db !== "undefined" && db.chs) || []).map(c => c.designation)).filter(Boolean))],
        art: P ? [] : [...new Set(((typeof db !== "undefined" && db.chs) || []).map(c => c.article).filter(Boolean))],
        u: [...new Set(INS.sec.map(x => U_(x.u)).concat(recs.map(x => U_(x.u))).filter(Boolean))]
      };
      lists.su = lists.u;
      const secU0 = v => { const se = INS.sec.find(x => U_(x.v) === U_(v)); return U_(se && se.u); };
      /* v479 (remarque 13) : ligne de tâche primaire (activité primaire = activité secondaire) : unité = UPB de la désignation, grisée */
      let curRow = null;
      const secU = (v, r) => { const rr = r || curRow; if (rr && U_(rr.prim) && U_(rr.prim) === U_(rr.sec) && U_(rr.upb)) return U_(rr.upb); return secU0(v) || (rr ? U_(rr.su) : ""); };
      /* U de l'activité : imposée (tâche primaire ou activité qui a déjà son unité) → grisée */
      const suFixed = r => (U_(r.prim) && U_(r.prim) === U_(r.sec) && U_(r.upb)) ? U_(r.upb) : secU0(r.sec);
      const linkedChanged = r => r._lid && ["dc", "lot", "prim", "sec"].some(f => U_(r[f]) !== U_((JSON.parse(r._o))[COLS.findIndex(c => c[0] === f)]));
      const d = document.createElement("div");
      d.id = "sdW";
      /* taille de la fenêtre et largeurs de colonnes mémorisées (FORMAT : fenêtres et colonnes réglables) */
      const SZK = "svi_sdw_v1";
      const sz = (() => { try { return JSON.parse(localStorage.getItem(SZK) || "{}") || {}; } catch (e) { return {}; } })();
      const szSave = () => { try { localStorage.setItem(SZK, JSON.stringify(sz)); } catch (e) {} };
      let big = sz.big !== false;
      let selCol = "";
      const CFC = COLS.map(c => [c[0], c[1], r => r[c[0]] || "", NUMF.has(c[0]) ? "number" : ""]);
      /* lignes existantes : filtres / tri de l'en-tête (loupe) ; lignes nouvelles toujours en bas */
      const vis = () => {
        const old = rows.map((r, i) => ({ ...r, __i: i })).filter(r => r._id);
        const shown = cfApply(TK, CFC, old);
        return shown.map(r => ({ r: rows[r.__i], i: r.__i })).concat(rows.map((r, i) => ({ r, i })).filter(x => !x.r._id));
      };
      const cell = (r, i, c) => {
        const f = c[0];
        curRow = r;
        if (f === "su") {
          const fx = suFixed(r), need = !fx && !!U_(r.sec) && !U_(r.su);
          return `<td class="center${fx ? " sd-ro" : ""}${need ? " sd-need" : ""}"${need ? ' data-why="UNITÉ DE L\'ACTIVITÉ OBLIGATOIRE"' : ""}><input class="sd-in" data-i="${i}" data-f="su" value="${esc(fx || r.su || "")}"${fx ? " readonly tabindex=\"-1\"" : ""} autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="next"></td>`;
        }
        const lockU = P && f === "u" && (!!secU(r.sec, r) || (r._lid && !!r.u));
        const lockChain = false;   /* v480 (remarque 15) : en instance, la chaîne d'une ligne liée se change ici aussi */
        const ro = lockU || lockChain;
        return `<td class="${NUMF.has(f) ? "number" : ""}${ro ? " sd-ro" : ""}${selCol === f ? " sd-sel" : ""}"><input class="sd-in" data-i="${i}" data-f="${f}" value="${esc(lockU && secU(r.sec, r) ? secU(r.sec, r) : r[f] || "")}"${ro ? " readonly tabindex=\"-1\"" : ""}${NUMF.has(f) ? ' inputmode="decimal"' : ""} autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="next"></td>`;
      };
      const draw = () => {
        if (!d.isConnected) { window.__sviSdRefresh = null; return; }
        const sc = d.querySelector(".sd-scroll"), st = sc ? sc.scrollTop : 0, sl = sc ? sc.scrollLeft : 0;
        const V = vis();
        /* FORMAT 6 : un intitulé de colonne n'est jamais coupé — largeur au moins celle de l'intitulé */
        const W = {}; COLS.forEach(c => { W[c[0]] = Math.max((sz.cols || {})[c[0]] || c[2], Math.ceil(c[1].length * 7.6) + 46); });
        d.innerHTML = `<div class="sd-card${big ? " big" : ""}" role="dialog" aria-modal="true" style="${!big && sz.w ? "width:" + sz.w + "px;height:" + sz.h + "px" : ""}">
          <div class="sd-head"><span class="sd-title">SAISIE DIRECTE — ${P ? "DÉTAIL PRODUITS" : "DÉTAIL CHARGES"}</span>
            <span class="sd-n">${svCnt(V.filter(x => x.r._id).length, rows.filter(x => x._id).length)}</span>
            ${selCol ? `<span class="sd-colbar">COLONNE « ${esc((COLS.find(c => c[0] === selCol) || [])[1] || "")} » SÉLECTIONNÉE : ⋯</span>` : ""}
            <button type="button" class="sd-more blk-more" aria-label="Menu">⋯</button><button type="button" class="svc-close sd-x" data-x aria-label="Fermer">✕</button></div>
          <div class="sd-scroll"><table class="sd-t"><colgroup>${COLS.map(c => `<col data-c="${c[0]}" style="width:${W[c[0]] || c[2]}px">`).join("")}<col style="width:40px"></colgroup>
            <thead><tr>${COLS.map(c => cfHead(TK, c[0], c[1], (NUMF.has(c[0]) ? "number" : "") + (selCol === c[0] ? " sd-sel" : "")).replace("<th ", `<th data-c="${c[0]}" `)).join("")}<th class="sd-cbc"><input type="checkbox" class="sd-cball"${V.some(x => x.r._on) && V.filter(x => x.r._id || COLS.some(c => x.r[c[0]])).every(x => x.r._on) ? " checked" : ""}></th></tr></thead>
            <tbody>${V.map(({ r, i }) => `<tr class="${r._id ? (r._lid ? "sd-old sd-lk" : "sd-old") : "sd-new"}${r._del ? " sd-del" : ""}">${COLS.map(c => cell(r, i, c)).join("")}<td class="sd-cbc">${r._id || COLS.some(c => r[c[0]]) ? `<input type="checkbox" class="sd-cb" data-i="${i}"${r._on ? " checked" : ""}>` : ""}</td></tr>`).join("")}</tbody></table></div>
          <div class="sd-foot"><small>CHAÎNE CHANGÉE SUR UNE LIGNE LIÉE : DÉLIÉE PUIS LIÉE À LA NOUVELLE CHAÎNE À LA VALIDATION. ENTRÉE SUR LA DERNIÈRE CASE = LIGNE RECOPIÉE.</small><span style="flex:1"></span>
            <button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral sd-ok"${dirty ? "" : " disabled"}>VALIDER</button></div>
          ${big ? "" : '<div class="sd-rsz" title="Largeur et hauteur"></div>'}</div>
          <button type="button" class="sd-tag">SAISIE DIRECTE — ${P ? "DÉTAIL PRODUITS" : "DÉTAIL CHARGES"} ▲</button>`;
        const tb = d.querySelector(".sd-t");
        if (tb) tb.style.width = COLS.reduce((t, c) => t + (W[c[0]] || c[2]), 0) + 40 + "px";
        const s2 = d.querySelector(".sd-scroll"); if (s2) { s2.scrollTop = st; s2.scrollLeft = sl; }
      };
      document.getElementById("sdW")?.remove();
      document.body.appendChild(d);
      window.__sviSdRefresh = draw;
      draw();
      const focusAt = (i, f) => { const el = d.querySelector(`.sd-in[data-i="${i}"][data-f="${f}"]`); if (el) { el.focus(); try { el.select(); } catch (e) {} } };
      /* liste de choix au format de l'application (jamais la bulle de Safari, FORMAT 50) : sous la case, après la 1re lettre, 8 au plus */
      const sugHide = () => d.querySelector(".sd-sug")?.remove();
      const sugShow = inp => {
        sugHide();
        const f = inp.dataset.f, q = U_(inp.value);
        if (!q || NUMF.has(f) || inp.readOnly) return;
        const L = (lists[f] || []).filter(v => U_(v) !== q && U_(v).includes(q)).sort((a, b) => (U_(a).startsWith(q) ? 0 : 1) - (U_(b).startsWith(q) ? 0 : 1)).slice(0, 8);
        if (!L.length) return;
        const b = document.createElement("div");
        b.className = "sd-sug";
        b.innerHTML = L.map(v => `<button type="button" data-v="${esc(v)}">${esc(v)}</button>`).join("");
        d.appendChild(b);
        const r = inp.getBoundingClientRect();
        b.style.left = Math.max(8, Math.min(r.left, window.innerWidth - b.offsetWidth - 8)) + "px";
        b.style.top = (r.bottom + 2 + b.offsetHeight <= sviViewH() - 8 ? r.bottom + 2 : Math.max(8, r.top - b.offsetHeight - 2)) + "px";
        b.__for = inp;
      };
      d.addEventListener("pointerdown", e => {
        const sb = e.target.closest(".sd-sug button");
        if (sb) { e.preventDefault(); const inp = d.querySelector(".sd-sug").__for; sugHide(); if (inp && inp.isConnected) { inp.value = sb.dataset.v; inp.dispatchEvent(new Event("input", { bubbles: true })); sugHide(); inp.focus(); } return; }
        if (!e.target.closest(".sd-sug")) sugHide();
        /* largeur d'une colonne : bord droit de l'en-tête */
        const h = e.target.closest(".col-rs");
        if (h) {
          e.preventDefault(); e.stopPropagation();
          const key = h.dataset.col, col = d.querySelector(`col[data-c="${key}"]`), tb = d.querySelector(".sd-t");
          const x0 = e.clientX, w0 = col.getBoundingClientRect().width || parseFloat(col.style.width) || 80;
          const lab = (COLS.find(c => c[0] === key) || ["", ""])[1], wMin = Math.ceil(lab.length * 7.6) + 46;
          const mv = ev => { const w = Math.max(wMin, Math.round(w0 + ev.clientX - x0)); col.style.width = w + "px"; sz.cols = sz.cols || {}; sz.cols[key] = w; tb.style.width = [...d.querySelectorAll(".sd-t col")].reduce((t, x) => t + (parseFloat(x.style.width) || 0), 0) + "px"; };
          const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); szSave(); };
          document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
          return;
        }
        /* taille de la fenêtre : coin bas droit */
        if (e.target.closest(".sd-rsz")) {
          e.preventDefault();
          const card = d.querySelector(".sd-card"), r0 = card.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
          const mv = ev => { sz.w = Math.max(420, Math.min(window.innerWidth - 8, Math.round(r0.width + 2 * (ev.clientX - x0)))); sz.h = Math.max(300, Math.min(window.innerHeight - 8, Math.round(r0.height + 2 * (ev.clientY - y0)))); card.style.width = sz.w + "px"; card.style.height = sz.h + "px"; };
          const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); szSave(); };
          document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
        }
      }, true);
      d.addEventListener("input", e => {
        const inp = e.target.closest(".sd-in"); if (!inp) return;
        const r = rows[+inp.dataset.i], f = inp.dataset.f;
        if (!dirty) { dirty = true; const ok = d.querySelector(".sd-ok"); if (ok) ok.disabled = false; }
        r[f] = NUMF.has(f) ? inp.value : inp.value.toUpperCase();
        if (!NUMF.has(f)) { const p0 = inp.selectionStart; inp.value = r[f]; try { inp.setSelectionRange(p0, p0); } catch (err) {} }
        if (["sec", "prim", "upb", "su"].includes(f)) {
          const tr = inp.closest("tr"), si = tr.querySelector('.sd-in[data-f="su"]');
          if (si && f !== "su") { const fx = suFixed(r); si.readOnly = !!fx; si.closest("td").classList.toggle("sd-ro", !!fx); if (fx) si.value = fx; }
          if (si) { const need = !suFixed(r) && !!U_(r.sec) && !U_(r.su); si.closest("td").classList.toggle("sd-need", need); }
        }
        if (["sec", "prim", "upb", "su"].includes(f) && P) { const u = secU(r.sec, r), ui = inp.closest("tr").querySelector('.sd-in[data-f="u"]'); if (ui) { if (u) { r.u = u; ui.value = u; ui.readOnly = true; ui.closest("td").classList.add("sd-ro"); } else { ui.readOnly = false; ui.closest("td").classList.remove("sd-ro"); } } }
        if (!r._id && rows[rows.length - 1] === r && COLS.some(c => r[c[0]])) { rows.push(blank()); const tb = d.querySelector(".sd-t tbody"); const tmp = document.createElement("tbody"); tmp.innerHTML = `<tr class="sd-new">${COLS.map(c => cell(rows[rows.length - 1], rows.length - 1, c)).join("")}</tr>`; tb.appendChild(tmp.firstElementChild); }
        sugShow(inp);
      });
      d.addEventListener("focusout", () => setTimeout(() => { const b = d.querySelector(".sd-sug"); if (b && document.activeElement !== b.__for) sugHide(); }, 200));
      d.addEventListener("keydown", e => {
        const inp = e.target.closest(".sd-in");
        if (!inp || e.key !== "Enter") return;
        e.preventDefault(); e.stopPropagation(); sugHide();
        const i = +inp.dataset.i, tr = inp.closest("tr");
        const ins = [...tr.querySelectorAll(".sd-in")].filter(x => !x.readOnly);
        const k = ins.indexOf(inp);
        if (k >= 0 && k < ins.length - 1) { ins[k + 1].focus(); try { ins[k + 1].select(); } catch (err) {} return; }
        /* dernière case : ligne recopiée (chaîne et valeurs), curseur sur la désignation produit / charge */
        const src = rows[i], c = { ...blank() };
        COLS.forEach(cc => { c[cc[0]] = src[cc[0]] || ""; });
        let j = rows.findIndex((r, n) => n > i && !r._id && COLS.every(cc => !r[cc[0]]));
        if (j < 0) { rows.push(c); j = rows.length - 1; } else rows.splice(j, 0, c);
        if (rows[rows.length - 1] === c) rows.push(blank());
        draw(); focusAt(j, "des");
      }, true);
      /* v479 (remarques 11 et 12) : case à cocher par ligne et menu ⋯ (SUPPRIMER LES LIGNES COCHÉES…) */
      d.addEventListener("change", e => {
        const cb = e.target.closest(".sd-cb, .sd-cball");
        if (!cb) return;
        if (cb.classList.contains("sd-cball")) vis().forEach(x => { if (x.r._id || COLS.some(c => x.r[c[0]])) x.r._on = cb.checked; });
        else rows[+cb.dataset.i]._on = cb.checked;
        draw();
      });
      const sdMenu = btn => {
        document.getElementById("blkMenu")?.remove();
        const n = rows.filter(r => r._on).length;
        const m = document.createElement("div");
        m.id = "blkMenu"; m.dataset.for = "sd";
        /* v485 (remarque 25) : un seul ⋯ — colonne, lignes, cases, taille de la fenêtre */
        const cl = selCol ? esc((COLS.find(c => c[0] === selCol) || [])[1] || "") : "";
        const dis = on => on ? "" : ` class="off" disabled`;
        m.innerHTML = (selCol ? `<button type="button" data-sm="ccopy"><span>COPIER LA COLONNE « ${cl} »</span></button>
          <button type="button" data-sm="cpaste"><span>COLLER DANS LA COLONNE « ${cl} »</span><small class="del-split">À PARTIR DE LA 1RE LIGNE AFFICHÉE ; LIGNES CRÉÉES EN BAS S'IL EN MANQUE</small></button>
          <button type="button" data-sm="cclear"><span>EFFACER LA COLONNE « ${cl} »</span></button><div class="blk-sep"></div>` : "")
          + `<button type="button" data-sm="rcopy"${dis(n)}><span>COPIER LES LIGNES COCHÉES</span>${svCnt(n)}</button>
          <button type="button" data-sm="rcut"${dis(n)}><span>COUPER LES LIGNES COCHÉES</span>${svCnt(n)}</button>
          <button type="button" data-sm="rpaste"><span>COLLER LES LIGNES</span><small class="del-split">AJOUTÉES EN BAS, COLONNE PAR COLONNE DANS L'ORDRE DU TABLEAU (EXCEL, GOOGLE SHEETS OU CETTE FENÊTRE)</small></button>
          <div class="blk-sep"></div><button type="button" data-sm="del" class="blk-del${n ? "" : " off"}" ${n ? "" : "disabled"}><span>SUPPRIMER LES LIGNES COCHÉES</span>${svCnt(n)}</button>
          <button type="button" data-sm="all"><span>TOUT COCHER (LIGNES AFFICHÉES)</span></button>
          <button type="button" data-sm="none" class="${n ? "" : "off"}" ${n ? "" : "disabled"}><span>TOUT DÉCOCHER</span></button>
          <div class="blk-sep"></div><button type="button" data-sm="mini"><span>RÉDUIRE (ÉTIQUETTE EN BAS À DROITE)</span></button><button type="button" data-sm="size"><span>${big ? "FENÊTRE" : "PLEIN ÉCRAN"}</span></button>`;
        document.body.appendChild(m);
        sviPlaceMenu(m, btn.getBoundingClientRect());
        const off = ev => { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener("pointerdown", off, true); } };
        setTimeout(() => document.addEventListener("pointerdown", off, true), 0);
        m.addEventListener("click", async ev => {
          const b = ev.target.closest("[data-sm]"); if (!b || b.disabled) return;
          m.remove(); document.removeEventListener("pointerdown", off, true);
          const v = b.dataset.sm;
          if (v === "all") { vis().forEach(x => { if (x.r._id || COLS.some(c => x.r[c[0]])) x.r._on = true; }); draw(); return; }
          if (v === "none") { rows.forEach(r => { r._on = false; }); draw(); return; }
          if (v === "size") { big = !big; sz.big = big; szSave(); draw(); return; }
          if (v === "mini") { sugHide(); d.classList.add("sd-min"); return; }
          if (v === "ccopy" || v === "cpaste" || v === "cclear") return colAct(v.slice(1));
          if (v === "rcopy" || v === "rcut") return rowCopy(v === "rcut");
          if (v === "rpaste") return rowPaste();
          if (v === "del") {
            const L = rows.filter(r => r._on), lk = L.filter(r => r._lid);
            if (!(await svConfirm({ title: "SUPPRIMER", text: (L.length - lk.length) + " LIGNE(S) SERONT SUPPRIMÉES À LA VALIDATION" + (lk.length ? " ; " + lk.length + " LIGNE(S) LIÉE(S) GARDÉE(S) (✕ DÉLIER D'ABORD)" : "") + ".", ok: "SUPPRIMER" }))) return;
            for (let n = rows.length - 1; n >= 0; n--) { const r = rows[n]; if (!r._on || r._lid) continue; if (r._id) { r._del = true; r._on = false; dirty = true; } else rows.splice(n, 1); }
            if (!rows.length || rows[rows.length - 1]._id || COLS.some(c => rows[rows.length - 1][c[0]])) rows.push(blank());
            draw();
          }
        });
      };
      d.addEventListener("click", e => { const b = e.target.closest(".sd-more"); if (b) { e.stopPropagation(); sdMenu(b); } }, true);
      /* sélection d'une colonne (FORMAT 61) : un toucher sur l'intitulé ; COPIER / COLLER / EFFACER sur les lignes affichées */
      let clip = null, clipTxt = "";
      const readClip = async () => { try { return navigator.clipboard && navigator.clipboard.readText ? (await navigator.clipboard.readText()) || "" : ""; } catch (e) { return ""; } };
      const nonEmpty = r => r._id || COLS.some(c => r[c[0]]);
      const tailBlank = () => { if (!rows.length || nonEmpty(rows[rows.length - 1])) rows.push(blank()); };
      /* v485 (remarque 24) : colonne — COPIER / COLLER (presse-papiers de l'iPad d'abord : Excel, Google Sheets) / EFFACER */
      const colAct = async act => {
        if (!selCol) return;
        const editable = r => !(P && selCol === "u" && secU(r.sec, r)) && !(selCol === "su" && suFixed(r));
        const V = vis().filter(x => !x.r._del && nonEmpty(x.r));
        if (act === "copy") { clip = V.map(x => x.r[selCol] || ""); clipTxt = clip.join("\n"); try { navigator.clipboard && navigator.clipboard.writeText(clipTxt); } catch (err) {} svToast(clip.length + " VALEUR(S) COPIÉE(S).", 2000); return; }
        if (act === "clear") { let n = 0; V.forEach(x => { if (!editable(x.r)) return; x.r[selCol] = ""; n++; }); dirty = dirty || n > 0; draw(); svToast(n + " CASE(S) EFFACÉE(S).", 2000); return; }
        const t = await readClip();
        let vals = t.trim() && t.trim() !== clipTxt.trim() ? t.replace(/\r/g, "").replace(/\n+$/, "").split("\n").map(l => l.split("\t")[0].trim()) : clip;
        if (!vals || !vals.length) { svToast("RIEN À COLLER : COPIER D'ABORD UNE COLONNE.", 2500); return; }
        let n = 0;
        if (vals.length === 1) V.forEach(x => { if (!editable(x.r)) return; x.r[selCol] = vals[0]; n++; });
        else {
          vals.forEach((v, j) => {
            let r = V[j] ? V[j].r : null;
            if (!r) { rows = rows.filter(q => nonEmpty(q)); r = blank(); rows.push(r); }
            if (!editable(r)) return;
            r[selCol] = v; n++;
          });
          tailBlank();
        }
        dirty = dirty || n > 0; draw(); svToast(n + " CASE(S) COLLÉE(S).", 2000);
      };
      /* v485 (remarques 24 et 25) : lignes cochées — COPIER / COUPER ; COLLER LES LIGNES = ajoutées en bas, colonne par colonne */
      const rowCopy = async cut => {
        const L = rows.filter(r => r._on && !r._del);
        if (!L.length) return;
        clipTxt = L.map(r => COLS.map(c => String(r[c[0]] ?? "").replace(/[\t\n]/g, " ")).join("\t")).join("\n");
        clip = null;
        try { navigator.clipboard && navigator.clipboard.writeText(clipTxt); } catch (err) {}
        if (!cut) { svToast(L.length + " LIGNE(S) COPIÉE(S).", 2000); return; }
        const lk = L.filter(r => r._lid);
        for (let n = rows.length - 1; n >= 0; n--) { const r = rows[n]; if (!r._on || r._lid) continue; if (r._id) { r._del = true; r._on = false; dirty = true; } else rows.splice(n, 1); }
        tailBlank(); draw();
        svToast((L.length - lk.length) + " LIGNE(S) COUPÉE(S) (SUPPRIMÉES À LA VALIDATION)" + (lk.length ? " ; " + lk.length + " LIGNE(S) LIÉE(S) COPIÉE(S) SEULEMENT (✕ DÉLIER D'ABORD)" : "") + ".", 4000);
      };
      const rowPaste = async () => {
        let t = await readClip();
        if (!t.trim()) t = clipTxt;
        const lines = String(t || "").replace(/\r/g, "").split("\n").filter(l => l.trim() !== "").map(l => l.split("\t"));
        if (!lines.length) { svToast("RIEN À COLLER : COPIER D'ABORD DES LIGNES.", 2500); return; }
        const labs = COLS.map(c => U_(c[1]));
        if (lines[0].filter(v => U_(v) && labs.includes(U_(v))).length >= 2) lines.shift();
        rows = rows.filter(q => nonEmpty(q));
        let n = 0, extra = 0;
        lines.forEach(cells => {
          const r = blank();
          COLS.forEach((c, i) => { const v = String(cells[i] ?? "").trim(); if (v !== "") r[c[0]] = v; });
          if (cells.length > COLS.length) extra++;
          if (COLS.some(c => r[c[0]])) { rows.push(r); n++; }
        });
        tailBlank(); dirty = dirty || n > 0; draw();
        svToast(n + " LIGNE(S) AJOUTÉE(S) EN BAS" + (extra ? " ; COLONNES EN TROP IGNORÉES" : "") + ". VALIDER POUR LES ENREGISTRER.", 3500);
      };
      d.addEventListener("click", e => {
        const cfb = e.target.closest(".cf-btn");
        if (cfb) { e.stopPropagation(); cfOpenMenu(cfb); return; }
        const th = e.target.closest(".sd-t thead th");
        if (th && !e.target.closest(".col-rs")) { const c = th.dataset.c; selCol = selCol === c ? "" : c; draw(); return; }
      }, true);
      d.addEventListener("click", async e => {
        if (e.target.closest(".sd-size")) { big = !big; sz.big = big; szSave(); draw(); return; }
        /* v481 (remarque 19) : RÉDUIRE = petite étiquette en bas à droite ; on travaille sur le budget ; un toucher la rouvre telle quelle */
        if (e.target.closest(".sd-mini")) { sugHide(); d.classList.add("sd-min"); return; }
        if (e.target.closest(".sd-tag")) { d.classList.remove("sd-min"); draw(); return; }
        if (e.target.closest("[data-x]")) { d.remove(); window.__sviSdRefresh = null; return; }
        if (!e.target.closest(".sd-ok")) return;
        /* 0. lignes supprimées (non liées) */
        const delIds = new Set(rows.filter(r => r._del && r._id && !r._lid).map(r => r._id));
        if (delIds.size) { INS[kind] = INS[kind].filter(x => !delIds.has(x.id)); histLog(P ? "DÉTAIL PRODUITS" : "DÉTAIL CHARGES", "SAISIE DIRECTE — SUPPRESSION", delIds.size + " LIGNE(S)"); insSave(); }
        /* 1. lignes existantes modifiées */
        let upd = 0; const refused = [];
        if (!dirty || e.target.closest(".sd-ok").disabled) return;
        const moved = [];
        rows.filter(r => r._id && !r._del && JSON.stringify(COLS.map(c => r[c[0]])) !== r._o).forEach(r => {
          /* v480 (remarque 15) : chaîne changée sur une ligne liée → déliée de l'ancienne, réimportée sur la nouvelle */
          if (linkedChanged(r)) { moved.push(r); return; }
          const x = recs.find(q => q.id === r._id); if (!x) return;
          x.des = U_(sviClean(r.des)); if (!r._lid) x.u = U_(r.u);
          if (P) ["nbr", "d1", "d2", "d3"].forEach(f => { x[f] = r[f] === "" ? "" : insNum(r[f]); });
          else { x.art = U_(r.art); x.q = r.q === "" ? "" : insNum(r.q); }
          upd++;
        });
        /* 2. lignes nouvelles (et lignes non liées dont la chaîne est remplie) : importées avec les règles de l'import */
        const H = ["PROJET", "DÉSIGNATION CLIENT", "UPB", "LOT", "ACTIVITÉ PRIMAIRE", "ACTIVITÉ SECONDAIRE", "TYPE (PRD / CHG)", "ARTICLE", "DÉSIGNATION PRODUIT / CHARGE", "UNITÉ", "NBR", "DIM 1", "DIM 2", "DIM 3", "QTE"];
        /* v482 (remarque 22) : déplacement ligne par ligne ;
           — une charge qui arrive sur une combinaison sans produit y emmène une copie des produits de son ancienne tâche (mêmes quantités) ;
           — une tâche qui perd son dernier produit : ses charges partent avec lui sur la nouvelle combinaison */
        const extra = [];
        const fN = v => v === "" || v === undefined || v === null ? "" : String(v).replace(".", ",");
        const chainOf = r => [r.dc, r.lot, r.prim, r.sec].map(U_).join("|");
        const hasPrd = r => (INS.links || []).some(l => (l.prd || []).length && [nm("des", l.des), nm("lot", l.lot), nm("prim", l.prim), nm("sec", l.sec)].map(U_).join("|") === chainOf(r));
        const cpDone = new Set(), goneChg = new Set();
        const rowOf = (r, typ, x) => [budget.project || "", r.dc, r.upb, r.lot, r.prim, r.sec, typ, x.art || "", x.des || "", x.u || "", fN(x.nbr), fN(x.d1), fN(x.d2), fN(x.d3), fN(x.q)];
        if (!P) moved.forEach(r => {
          const l = r._l; if (!l || hasPrd(r)) return;
          const key = (l.id || INS.links.indexOf(l)) + ">" + chainOf(r);
          if (cpDone.has(key)) return; cpDone.add(key);
          (l.prd || []).forEach(x => { const pr = (INS.prd || []).find(q => q.id === x.id); if (pr) extra.push(rowOf(r, "PRD", { ...pr, u: secU(r.sec, r) || pr.u })); });
        });
        moved.forEach(r => {
          const l = r._l;
          if (l) {
            l[kind] = (l[kind] || []).filter(x => x.id !== r._id);
            if (!(l.prd || []).length) {
              if (P) (l.chg || []).forEach(x => { const c = (INS.chg || []).find(q => q.id === x.id); if (!c) return; extra.push(rowOf(r, "CHG", c)); goneChg.add(c.id); });
              INS.links = (INS.links || []).filter(q => q !== l);
            }
          }
          histLog(P ? "DÉTAIL PRODUITS" : "DÉTAIL CHARGES", "SAISIE DIRECTE — CHAÎNE CHANGÉE", r.des + " → " + [r.dc, r.lot, r.prim, r.sec].join(" › "));
        });
        if (goneChg.size) INS.chg = INS.chg.filter(x => !goneChg.has(x.id));
        if (extra.length) histLog(P ? "DÉTAIL PRODUITS" : "DÉTAIL CHARGES", "SAISIE DIRECTE — " + (P ? "CHARGES DÉPLACÉES AVEC LE DERNIER PRODUIT" : "PRODUITS RECOPIÉS"), extra.length + " LIGNE(S)");
        const neu = rows.filter(r => !r._del && ((!r._id && COLS.some(c => r[c[0]])) || (r._id && !r._lid && r.dc && r.lot && r.prim && r.sec) || moved.includes(r)));
        const aoa = [H].concat(neu.map(r => [budget.project || "", r.dc, r.upb, r.lot, r.prim, r.sec, P ? "PRD" : "CHG", r.art || "", r.des, P ? (secU(r.sec, r) || r.u) : r.u, r.nbr, r.d1, r.d2, r.d3, r.q]), extra);
        if (upd) { insSave(); histLog(P ? "DÉTAIL PRODUITS" : "DÉTAIL CHARGES", "SAISIE DIRECTE", upd + " LIGNE(S) MODIFIÉE(S)"); }
        if (neu.length || extra.length) {
          let m; try { m = bfModel(aoa); } catch (err) { svToast("SAISIE DIRECTE : " + (err.message || err), 4000); return; }
          const plan = bfRuleA(m, "add"); if (!(await bfRuleAAsk(plan))) return; plan.ok = true;
          /* lignes non liées devenues complètes : l'ancienne ligne seule est remplacée par la ligne importée */
          const inc0 = (INS.inc || []).length;
          const gone = new Set(neu.filter(r => r._id).map(r => r._id));
          if (gone.size) INS[kind] = INS[kind].filter(x => !gone.has(x.id));
          bfApply(m, "add", "SAISIE DIRECTE", false, plan);
          const nInc = (INS.inc || []).length - inc0;
          if (nInc > 0) setTimeout(() => svToast(nInc + " LIGNE(S) EN ERREUR : VOIR L'ONGLET IMPORT NON CRÉÉ.", 5000), 300);
        }
        void refused;
        /* unité saisie pour une activité secondaire qui n'en avait pas */
        rows.forEach(r => { if (!U_(r.sec) || !U_(r.su)) return; const se = INS.sec.find(x => U_(x.v) === U_(r.sec)); if (se && !U_(se.u)) se.u = U_(r.su); });
        if (actUnitSync()) insSave();
        insSave();
        refreshAll();
        /* v480 (remarque 14) : la saisie directe reste ouverte, relue depuis le budget ; VALIDER grisé jusqu'à la prochaine modification */
        if (!d.isConnected) document.body.appendChild(d);
        loadRows(); draw(); svToast("VALIDÉ.", 1500);
      });
      setTimeout(() => { const last = rows.length - 1; focusAt(last, "dc"); }, 60);
    };
    shell.__sd = k => openDirectEntry(k);
    const openImportMenu = blk => {
      const p = popup(`
        <div class="blk-card">
          <button type="button" class="blk-x" data-close>✕</button>
          <div class="blk-title">IMPORTER — ${esc(blkDisp(blk))}</div>
          <button type="button" class="blk-choice" data-src="file">Fichier (Excel, CSV, JSON)</button>
          <button type="button" class="blk-choice" data-src="gsheet">Google Sheets (lien)</button>
          ${INS ? `<button type="button" class="blk-choice" data-src="bdg">Autre budget de l'application</button>` : ""}
          ${INS && INS_EDIT && blk === "detail" && (active === "prd" || active === "chg") ? `<button type="button" class="blk-choice" data-src="direct">SAISIE DIRECTE (${active === "prd" ? "PRODUITS" : "CHARGES"})</button>` : ""}
        </div>`);
      p.addEventListener("click", e => {
        const b = e.target.closest("[data-src]");
        if (!b) return;
        p.remove();
        if (b.dataset.src === "direct") { openDirectEntry(active); return; }
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

