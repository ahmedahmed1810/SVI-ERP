    /* ===== COPIER / COUPER / COLLER (FORMAT) : lignes cochées d'un bloc ;
       collées à la fin du même bloc, dans ce budget ou un autre, sans liaison ;
       « COPIE DE » seulement en cas de doublon ; COUPER = lignes non liées, retirées au COLLER ;
       copie aussi dans le presse-papiers de l'iPad (tableau) ===== */
    const CLIP_KEY = "svi_clip_v1";
    const clipGet = () => { try { return JSON.parse(localStorage.getItem(CLIP_KEY) || "null"); } catch (e) { return null; } };
    const clipSet = c => { try { c ? localStorage.setItem(CLIP_KEY, JSON.stringify(c)) : localStorage.removeItem(CLIP_KEY); } catch (e) {} };
    const clipKinds = blk => blk === "detail" && !["chg", "prd", "qlt"].includes(active) ? [] : insBlkKinds(blk);
    /* ===== onglets de contrôle (FORMAT 99) : IMPORT NON CRÉÉ (COPIER / COUPER / COLLER = réimport),
       LIGNES NON LIÉES et LIAISONS VALIDÉES (COPIER) — lignes cochées ET affichées ===== */
    const ctlTab = blk => blk === "detail" && ["inc", "unl", "lnk"].includes(active) ? active : "";
    const ctlRows = () => {
      const ls = lastShown.detail;
      if (!ls || ls.kind !== active) return [];
      return ls.rows.filter(x => active === "unl" ? x.r && x.r.uon === true : x.on === true);
    };
    const ctlCount = (blk, act) => {
      const t = ctlTab(blk);
      if (!t || !INS_EDIT && act !== "copy") return 0;
      if (act === "copy") return ctlRows().length;
      if (t !== "inc") return 0;
      if (act === "cut") return ctlRows().length;
      return -1;   /* COLLER : toujours proposé (le presse-papiers est lu au toucher) */
    };
    const ctlCopy = async (cut) => {
      const ls = lastShown.detail, rows = ctlRows();
      if (!rows.length) return;
      const cols = screenCols(detailTable(), ls.cols);
      const cell = v => String(v ?? "").replace(/[\t\n]/g, " ");
      const tsv = [cols.map(c => c[1]).join("\t"), ...rows.map(r => cols.map(c => cell(c[2](r))).join("\t"))].join("\n");
      try { navigator.clipboard && await navigator.clipboard.writeText(tsv); } catch (e) {}
      if (!cut) { svToast(rows.length + " LIGNE(S) COPIÉE(S) DANS LE PRESSE-PAPIERS.", 2500); histLog("SAISIE", "COPIER", rows.length + " LIGNE(S) — " + ls.kind.toUpperCase()); return; }
      if (!(await svConfirm({ title: "COUPER LES LIGNES COCHÉES", text: rows.length + " LIGNE(S) COPIÉE(S) PUIS RETIRÉE(S) DE L'ONGLET IMPORT NON CRÉÉ.", ok: "COUPER" }))) return;
      const ids = new Set(rows.map(x => x.id));
      INS.inc = (INS.inc || []).filter(x => !ids.has(x.id));
      histLog("IMPORT", "COUPER", rows.length + " LIGNE(S) — IMPORT NON CRÉÉ");
      insSave(); refreshAll();
    };
    /* COLLER dans IMPORT NON CRÉÉ : lignes corrigées (Excel / Google Sheets, avec en-têtes) réimportées */
    const ctlPaste = async () => {
      let txt = "";
      try { txt = await navigator.clipboard.readText(); } catch (e) { svToast("COLLAGE IMPOSSIBLE : AUTORISER L'ACCÈS AU PRESSE-PAPIERS.", 4000); return; }
      const aoa = String(txt || "").replace(/\r/g, "").split("\n").filter(l => l.trim()).map(l => l.split("\t"));
      if (!aoa.length) { svToast("PRESSE-PAPIERS VIDE.", 3000); return; }
      const H = (aoa.find(r => r.map(bfNorm).includes("DESIGNATION CLIENT") || r.map(bfNorm).includes("ACTIVITE SECONDAIRE")) || []).map(bfNorm);
      if (!H.length) { svToast("EN-TÊTES ATTENDUS (ART, DÉSIGNATION CLIENT… ou LOT, ACTIVITÉ SECONDAIRE, DÉBUT, FIN).", 4500); return; }
      const hi = aoa.findIndex(r => r.map(bfNorm).join("|") === H.join("|"));
      const body = aoa.slice(hi + 1), ti = H.indexOf("TYPE");
      const isD = r => ti >= 0 && bfNorm(r[ti]) === "DELAI";
      const bRows = body.filter(r => !isD(r)), dRows = body.filter(isD);
      /* la colonne LIGNE n de la raison garde le numéro d'origine */
      const before = (INS.inc || []).length;
      if (bRows.length && H.includes("DESIGNATION CLIENT")) bfApply(bfModel([aoa[hi], ...bRows]), "add", "COLLER", true);
      if (dRows.length || (!H.includes("DESIGNATION CLIENT") && body.length)) {
        const pick = n => H.indexOf(n);
        const po = H.findIndex(h => h.startsWith("DECALAGE")), pl = H.indexOf("TYPE LIAISON");
        const D = (dRows.length ? dRows : body).map(r => [r[pick("LOT")] ?? "", r[pick("ACTIVITE SECONDAIRE")] ?? "", r[pick("DEBUT")] ?? "", r[pick("FIN")] ?? "", "", r[pick("PREDECESSEURS")] ?? "",
          pl >= 0 ? r[pl] ?? "" : (dRows.length ? "" : r[pick("TYPE")] ?? ""), po >= 0 ? r[po] ?? "" : ""]);
        dlyImportAoa([DLY_HEAD, ...D], "COLLER", true);
      }
      const n = body.length, left = (INS.inc || []).length - before;
      histLog("IMPORT", "COLLER (RÉIMPORT)", n + " LIGNE(S)" + (left > 0 ? " — " + left + " NON CRÉÉE(S)" : ""));
      insSave(); refreshAll();
    };
    const clipPick = (blk, cut) => {
      const X = shell.__ins, out = {};
      if (!X) return out;
      clipKinds(blk).forEach(k => {
        const sel = insSelIds(k);
        let rows = X.INS[k].filter(r => sel.has(r.id));
        if (cut) {
          /* couper : seulement les lignes non liées (un titre dont une ligne est liée reste) */
          const used = new Set(rows.filter(r => !r.t && X.isUsed(k, r.id)).map(r => r.id));
          rows = rows.filter(r => !used.has(r.id) && !(r.t && X.insBranch(r).some(x => used.has(x.id))));
        } else if (k === "des") {
          /* FORMAT 125 : copier — chaque ligne emporte ses titres (même structure que le tableau) */
          const ids = new Set(rows.map(r => r.id));
          X.INS.des.forEach(t => { if (t.t && !ids.has(t.id) && X.insBranch(t).some(x => ids.has(x.id))) ids.add(t.id); });
          rows = X.INS.des.filter(r => ids.has(r.id));
        }
        if (rows.length) out[k] = rows;
      });
      return out;
    };
    const clipCount = (blk, act) => {
      if (act === "paste") { const c = clipGet(); const n = c ? clipKinds(blk).reduce((t, k) => t + ((c.items || {})[k] || []).length, 0) : 0;
        /* v485 (remarque 24) : lignes copiées dans Excel / Google Sheets → COLLER toujours proposé (presse-papiers lu au toucher) */
        return n || (clipKinds(blk).length && navigator.clipboard && navigator.clipboard.readText ? -1 : 0); }
      const p = clipPick(blk, act === "cut");
      return Object.values(p).reduce((t, a) => t + a.length, 0);
    };
    const clipTake = (blk, cut) => {
      const p = clipPick(blk, cut);
      if (!Object.keys(p).length) return;
      const items = {}, tsv = [];
      Object.keys(p).forEach(k => {
        const minD = Math.min(...p[k].map(r => Number(r.d) || 0));
        items[k] = p[k].map(r => { const c = JSON.parse(JSON.stringify(r)); delete c.on; delete c.lk; if (k === "des") c.d = (Number(r.d) || 0) - minD; return c; });
        /* presse-papiers : en-tête + lignes, séparées par des tabulations */
        if (INS_COLS[k]) {
          /* colonnes dans l'ordre de l'écran (glissement) */
          const tbl = shell.querySelector(`.ins-table[data-ik="${k}"]`);
          const keys = tbl ? [...tbl.querySelectorAll("thead tr:first-child > th .cf-btn[data-col]")].map(b => b.dataset.col) : [];
          const CO = keys.length ? keys.map(x => INS_COLS[k].find(c => c[4] === x)).filter(Boolean) : INS_COLS[k];
          tsv.push(CO.map(c => c[1]).join("\t"));
          p[k].forEach(r => tsv.push(CO.map(c => { const v = r.t && !["art", "des"].includes(c[0]) ? "" : (k === "des" && c[0] === "art" ? artOf(r) : c[3] === "txt" ? (r[c[0]] || "") : insFmt(insCalc(k, r, c[0]))); return String(v ?? "").replace(/[\t\n]/g, " "); }).join("\t")));
        } else { tsv.push({ lot: "LOT", prim: "ACTIVITÉ PRIMAIRE", sec: "ACTIVITÉ SECONDAIRE" }[k] || k.toUpperCase()); p[k].forEach(r => tsv.push(r.v || "")); }
        tsv.push("");
      });
      clipSet({ items, tsv: tsv.join("\n").trim(), cut: cut ? { ref, ids: Object.fromEntries(Object.keys(p).map(k => [k, p[k].map(r => r.id)])) } : null, from: fullRef });
      try { navigator.clipboard && navigator.clipboard.writeText(tsv.join("\n").trim()).catch(() => {}); } catch (e) {}
      histLog("SAISIE", cut ? "COUPER" : "COPIER", Object.values(p).reduce((t, a) => t + a.length, 0) + " LIGNE(S)");
      insMarkCut();
    };
    /* lignes coupées : en pointillés jusqu'au COLLER */
    const insMarkCut = () => {
      const c = clipGet(), ids = new Set(c && c.cut && c.cut.ref === ref ? Object.values(c.cut.ids).flat() : []);
      shell.querySelectorAll(".ins-table tr[data-iid], .ins-hcol .ins-li[data-iid]").forEach(el => el.classList.toggle("ins-cut", ids.has(el.dataset.iid)));
    };
    shell.__markCut = insMarkCut;
    /* v485 (remarque 24) : COLLER des lignes venues d'Excel / Google Sheets : ajoutées en bas, colonne par colonne
       dans l'ordre de l'écran ; colonnes en trop ignorées (jamais de colonne créée) ; ligne d'en-tête sautée */
    const clipPasteText = (blk, txt) => {
      const X = shell.__ins; if (!X) return false;
      const ks = clipKinds(blk);
      const k = blk === "detail" ? active : ks.find(x => x === "des") || ks.find(x => shell.querySelector(`.ins-hcol[data-ik="${x}"] .ins-li.on, .ins-hcol[data-ik="${x}"]:focus-within`)) || ks[0];
      if (!k || !X.INS[k]) return false;
      const lines = String(txt).replace(/\r/g, "").split("\n").filter(l => l.trim() !== "").map(l => l.split("\t"));
      if (!lines.length) return false;
      let CO;
      if (INS_COLS[k]) {
        const tbl = shell.querySelector(`.ins-table[data-ik="${k}"]`);
        const keys = tbl ? [...tbl.querySelectorAll("thead tr:first-child > th .cf-btn[data-col]")].map(b => b.dataset.col) : [];
        CO = keys.length ? keys.map(x => INS_COLS[k].find(c => c[4] === x)).filter(Boolean) : INS_COLS[k];
      } else CO = [["v", "INTITULÉ", "", "txt"]];
      const labs = CO.map(c => U_(c[1]));
      if (lines[0].some((v, i) => U_(v) && U_(v) === labs[i])) lines.shift();
      const ent = INS_ENTRY[k] || ["v"];
      const bad = [];
      const fresh = [];
      lines.forEach((cells, n) => {
        const x = { id: insId(), on: false };
        if (k === "des") x.d = 0;
        CO.forEach((c, i) => {
          if (!ent.includes(c[0])) return;
          const v = String(cells[i] ?? "").trim();
          if (v === "") return;
          if (c[3] === "txt") x[c[0]] = sviClean(v).toUpperCase();
          else if (sviNumOk(v)) x[c[0]] = insNum(v);
          else bad.push("LIGNE " + (n + 1) + " : « " + v + " » N'EST PAS UN NOMBRE (" + c[1] + ")");
        });
        if (ent.some(f => String(x[f] ?? "") !== "")) fresh.push(x);
      });
      if (!fresh.length) { svToast("RIEN À COLLER.", 2500); return true; }
      X.INS[k].push(...fresh);
      insNorm(); X.cleanLinks(); X.insSave();
      histLog("SAISIE", "COLLER LES LIGNES", fresh.length + " LIGNE(S) — PRESSE-PAPIERS");
      refreshAll();
      if (bad.length) sviAlert([fresh.length + " LIGNE(S) AJOUTÉE(S) EN BAS.", "CASES REFUSÉES :", ...bad.map(b => "— " + b)].join("\n"), "COLLER LES LIGNES");
      else svToast(fresh.length + " LIGNE(S) AJOUTÉE(S) EN BAS.", 2500);
      return true;
    };
    const clipPaste = async blk => {
      const X = shell.__ins; let c = clipGet();
      if (!X) return;
      let txt = "";
      try { if (navigator.clipboard && navigator.clipboard.readText) txt = await navigator.clipboard.readText(); } catch (e) { txt = ""; }
      if (txt && txt.trim() && (!c || !c.tsv || c.tsv !== txt.trim())) { if (clipPasteText(blk, txt)) return; }
      if (!c) { svToast("RIEN À COLLER : COPIER D'ABORD DES LIGNES.", 3000); return; }
      let n = 0;
      clipKinds(blk).forEach(k => {
        const rows = (c.items || {})[k] || [];
        if (!rows.length) return;
        const fresh = rows.map(r => {
          const x = JSON.parse(JSON.stringify(r));
          x.id = insId(); x.on = false;
          const lab = (k === "lot" || k === "prim" || k === "sec" || k === "qlt") ? "v" : "des";
          /* doublon dans ce bloc (copie, pas coupe dans ce même budget) : « COPIE DE » */
          const cutHere = c.cut && c.cut.ref === ref;
          const dup = lab === "v" ? X.INS[k].some(o => U_(o.v) === U_(x.v)) : k === "prd" ? X.INS[k].some(o => impId(k, o) === impId(k, x) && !prdLinks(o.id).length) : X.INS[k].some(o => impId(k, o) === impId(k, x));
          if (dup && !cutHere) x[lab] = "COPIE DE " + (x[lab] || "");
          return x;
        });
        X.INS[k].push(...fresh);
        n += fresh.length;
      });
      if (!n) return;
      /* coupe : les lignes d'origine sont retirées (dans ce budget ou dans l'autre) */
      if (c.cut) {
        const gone = c.cut.ids || {};
        if (c.cut.ref === ref) Object.keys(gone).forEach(k => { const s0 = new Set(gone[k]); X.INS[k] = X.INS[k].filter(r => !s0.has(r.id)); });
        else sviInstSet(sviInstGet().map(b => b.ref !== c.cut.ref ? b : { ...b, data: Object.fromEntries(Object.entries(b.data || {}).map(([k, v]) => [k, gone[k] ? v.filter(r => !gone[k].includes(r.id)) : v])) }));
        c.cut = null; clipSet(c);
      }
      insSortAll(); insNorm(); X.cleanLinks(); X.insSave();
      histLog("SAISIE", "COLLER", n + " LIGNE(S) — DEPUIS " + (c.from || ""));
      refreshAll();
    };
    /* ===== FORMAT 116 : sélection d'une colonne (toucher sur son titre) → COPIER / COUPER / COLLER LA COLONNE ===== */
    let COLSEL = null;
    const colThOf = cs => {
      if (!cs) return null;
      const b = cs.hier ? shell.querySelector(`.bdg-h-head .cf-btn[data-cf="${cs.key}"]`) : shell.querySelector(`th .cf-btn[data-cf="${cs.t}"][data-col="${cs.key}"]`);
      return b ? b.closest("th, .bdg-h-head") : null;
    };
    const colSelPaint = () => {
      shell.querySelectorAll(".col-sel").forEach(x => x.classList.remove("col-sel"));
      if (!COLSEL) return;
      const th = colThOf(COLSEL);
      if (!th) { COLSEL = null; return; }
      th.classList.add("col-sel");
      if (COLSEL.hier) { th.closest(".ins-hcol, .bdg-h-col")?.classList.add("col-sel"); return; }
      const tb = th.closest("table"), idx = [...th.parentElement.children].indexOf(th), n = th.parentElement.children.length;
      tb.querySelectorAll("tbody tr").forEach(tr => { if (tr.children.length === n && tr.children[idx]) tr.children[idx].classList.add("col-sel"); });
    };
    { let raf = 0; new MutationObserver(() => { if (!COLSEL) return; cancelAnimationFrame(raf); raf = requestAnimationFrame(colSelPaint); }).observe(shell, { childList: true, subtree: true }); }
    const colSelToggle = th => {
      const isHier = th.classList.contains("bdg-h-head");
      const b = th.querySelector(".cf-btn");
      if (!b) return;
      const cs = isHier ? { hier: true, key: b.dataset.cf, t: "hierCols" } : { t: b.dataset.cf, key: b.dataset.col };
      cs.blk = th.closest(".bdg-d-block")?.querySelector(".blk-btn[data-blk]")?.dataset.blk || "";
      COLSEL = COLSEL && COLSEL.t === cs.t && COLSEL.key === cs.key ? null : cs;
      colSelPaint();
    };
    /* colonne choisie dans ce bloc : cellules, champ, lignes visées (cochées s'il y en a) */
    const colSelFor = blk => {
      if (!COLSEL || COLSEL.blk !== blk) return null;
      const th = colThOf(COLSEL);
      if (!th) return null;
      const label = (th.querySelector(".cf-lab")?.textContent || "").replace(/\s*\d+\s*$/, "").trim();
      if (COLSEL.hier) {
        const box = th.closest(".ins-hcol, .bdg-h-col");
        let items = [...(box ? box.querySelectorAll(".ins-li[data-iid], .bdg-h-item") : [])];
        const on = items.filter(x => x.querySelector('input[type="checkbox"]:checked'));
        if (on.length) items = on;
        return { label, vals: items.map(x => (x.querySelector(".ins-in")?.value ?? x.textContent ?? "").trim()), edit: false };
      }
      const tb = th.closest("table"), idx = [...th.parentElement.children].indexOf(th), n = th.parentElement.children.length;
      let trs = [...tb.querySelectorAll("tbody tr")].filter(tr => tr.children.length === n && !tr.classList.contains("ins-new") && !tr.classList.contains("bdg-d-filler"));
      /* COLLER : toutes les lignes affichées, titres compris, dans l'ordre de l'écran (une ligne = une cellule) */
      const seenI = new Set();
      const all = trs.filter(tr => { const id = tr.dataset.iid; if (!id) return true; if (seenI.has(id)) return false; seenI.add(id); return true; });
      /* ordre du tableau (filtre / tri), sans la remontée des lignes choisies ou cochées */
      { const kk = tb.dataset.ik; if (INS && ["des", "chg", "prd"].includes(kk)) { const ix = new Map(insShown(kk).map((r, i) => [r.id, i])); all.sort((a, b) => (ix.get(a.dataset.iid) ?? 1e9) - (ix.get(b.dataset.iid) ?? 1e9)); } }
      const on = trs.filter(tr => tr.querySelector('td:last-child input[type="checkbox"]:checked'));
      if (on.length) trs = on;
      const k = tb.dataset.ik, edit = !!(INS_EDIT && tb.classList.contains("ins-table") && ["des", "chg", "prd"].includes(k));
      const col = edit ? (INS_COLS[k] || []).find(c => c[4] === COLSEL.key) : null;
      const cell = tr => { const td = tr.children[idx]; const i = td && td.querySelector(".ins-in, input:not([type=checkbox]), textarea"); return (i ? (i.value || (i.dataset.f === "art" ? i.placeholder : "")) : (td ? td.textContent : "")).trim(); };
      return { label, k, col, edit: edit && !!col, trs, all, vals: trs.map(cell) };
    };
    const colOp = async (act, cs) => {
      if (act === "copy" || act === "cut") {
        const txt = cs.vals.join("\n");
        window.__sviColClip = cs.vals.slice();
        try { navigator.clipboard && await navigator.clipboard.writeText(txt); } catch (e) {}
        if (act === "copy") { svToast(cs.vals.length + " VALEUR(S) COPIÉE(S) — COLONNE " + cs.label, 2500); histLog("SAISIE", "COPIER LA COLONNE", cs.label + " — " + cs.vals.length); return; }
      }
      if (!cs.edit) return;
      const [f, , , type] = cs.col, k = cs.k;
      const locked = type === "calc" || (INS_LOCK[k] || []).includes(f);
      if (locked) { sviAlert("COLONNE " + cs.label + " : CALCULÉE OU NON SAISISSABLE.", act === "cut" ? "COUPER LA COLONNE" : "COLLER DANS LA COLONNE"); return; }
      let vals;
      if (act === "cut") vals = cs.trs.map(() => "");
      else {
        let txt = null;
        try { txt = await navigator.clipboard.readText(); } catch (e) {}
        vals = txt !== null && txt !== undefined && txt !== "" ? String(txt).replace(/\r/g, "").replace(/\n+$/, "").split("\n").map(l => l.split("\t")[0]) : (window.__sviColClip || []);
        if (!vals.length) { svToast("PRESSE-PAPIERS VIDE.", 2500); return; }
      }
      const isNum = type === "num", bad = [];
      let done = 0;
      /* FORMAT 116 (14/10/2026) : COLLER est positionnel — à partir de la 1re ligne affichée, titres compris, cases cochées ignorées */
      const rowsT = act === "paste" ? (cs.all || cs.trs) : cs.trs;
      const n = Math.min(vals.length, rowsT.length);
      for (let i = 0; i < n; i++) {
        const r = INS[k].find(x => x.id === rowsT[i].dataset.iid);
        if (!r) continue;
        const name = (r.des || r.v || "").trim() || ("LIGNE " + (i + 1));
        if (r.t && f !== "art" && f !== "des") { if (String(vals[i] ?? "").trim() !== "") bad.push(name + " : TITRE — PAS DE " + cs.label); continue; }
        let v = String(vals[i] ?? "").trim();
        if (isNum && v !== "" && !sviNumOk(v)) { bad.push(name + " : « " + v + " » N'EST PAS UN NOMBRE"); continue; }
        if (k === "chg" && (f === "p" || f === "u") && r.chs) { bad.push(name + " : VALEUR VENUE DE CHS"); continue; }
        if (k === "prd" && /^d[123]$/.test(f) && v !== "" && +f[1] > sviUnitDims(r.u)) { bad.push(name + " : UNITÉ " + (r.u || "") + " — " + f.toUpperCase().replace(/^D/, "DIM ") + " EN TROP"); continue; }
        const linked = lkAnyLinked(k, r.id);
        if (linked && (f === "u" || (f === "des" && v === ""))) { bad.push(name + " : LIGNE LIÉE — DÉLIER D'ABORD"); continue; }
        const old = r[f];
        r[f] = isNum ? (v === "" ? "" : insNum(v)) : sviClean(v).toUpperCase();
        if (["des", "u", "art"].includes(f) && v !== "") {
          const key = dupKeyOf(k, r);
          if (key && INS[k].some(x => x !== r && !x.t && dupKeyOf(k, x) === key)) { r[f] = old; bad.push(name + " : DOUBLON"); continue; }
        }
        done++;
      }
      const extra = Math.max(0, vals.length - rowsT.length);
      insNorm(); insSave();
      histLog("SAISIE", act === "cut" ? "COUPER LA COLONNE" : "COLLER DANS LA COLONNE", cs.label + " — " + done + " CASE(S)" + (bad.length ? " — " + bad.length + " REFUSÉE(S)" : ""));
      refreshAll();
      const msg = [done + " CASE(S) " + (act === "cut" ? "VIDÉE(S)" : "COLLÉE(S)") + " — COLONNE " + cs.label];
      if (extra) msg.push(extra + " VALEUR(S) EN TROP IGNORÉE(S) (PLUS DE VALEURS QUE DE LIGNES)");
      if (bad.length) msg.push("REFUSÉES :", ...bad.map(x => "— " + x));
      if (bad.length || extra) sviAlert(msg.join("\n"), act === "cut" ? "COUPER LA COLONNE" : "COLLER DANS LA COLONNE");
      else svToast(msg[0], 2500);
    };
    /* FORMAT 106 : document déjà classé pour le contenu que donnerait APERÇU PDF (essai à blanc, sans fenêtre) */
    const pdfDoneRef = blk => {
      if (!INS && blk === "detail" && (active === "prd" || active === "qlt")) return "";
      const b = blk === "suivi" ? recActive : blk;
      const ls = { ...lastShown, hier: { ...(lastShown.hier || {}) } };
      PM_DRY = {}; window.__sviQuiet = true;
      let r = "";
      try { insOnlyChecked(blk); doPdf(b); r = PM_DRY.doc || ""; } catch (e) { r = ""; }
      PM_DRY = null; window.__sviQuiet = false;
      Object.keys(ls).forEach(k => { lastShown[k] = ls[k]; });
      return r;
    };
    const runBlkAct = (blk, act) => {
      if (act === "max") return toggleMax(blk);
      if (act === "del") return insDelRun(blk);
      { const cs = ["copy", "cut", "paste"].includes(act) && colSelFor(blk); if (cs) return colOp(act, cs); }
      if (ctlTab(blk) && (act === "copy" || act === "cut")) return ctlCopy(act === "cut");
      if (ctlTab(blk) === "inc" && act === "paste") return ctlPaste();
      if (act === "copy" || act === "cut") return clipTake(blk, act === "cut");
      if (act === "paste") return clipPaste(blk);
      if (act === "export" || act === "pdf") insOnlyChecked(blk);
      if (!INS && blk === "detail" && active === "prd" && (act === "export" || act === "pdf")) return chooseFormat(act);
      const b = blk === "suivi" ? recActive : blk;
      if (act === "export") openExportMenu(b);
      else if (act === "import") { if (budget.inst && (budget.inst.state || "instance") === "instance") openImportMenu(b); }
      else doPdf(b);
    };
    /* un seul bouton « ⋯ » par bloc : menu des actions */
    const openBlkMenu = btn => {
      const old = document.getElementById("blkMenu");
      const same = old && old.dataset.for === btn.dataset.for;
      old?.remove();
      if (same) return;
      const tools = btn.closest(".blk-tools");
      /* budget validé (ou figé) : lecture seule, pas d'import */
      const readOnly = !budget.inst || (budget.inst.state || "instance") !== "instance";
      /* DÉTAIL QUALITÉ (FORMAT, section U) : ses propres commandes, pas d'import ni de copier / coller de lignes */
      const QQm = shell.__qq && shell.__qq.on() && tools.querySelector('.blk-btn[data-blk="detail"]') ? shell.__qq : null;
      const acts = [...tools.querySelectorAll(".blk-btn")].filter(a => !(readOnly && a.dataset.act === "import"))
        .filter(a => !(QQm && ["import", "del", "copy", "cut", "paste", "export"].includes(a.dataset.act)));
      const m = document.createElement("div");
      m.id = "blkMenu";
      m.dataset.for = btn.dataset.for;
      m.innerHTML = acts.map((a, i) => {
        let lab = a.title;
        if (a.dataset.act === "max") lab = a.classList.contains("on") ? "Réduire" : "Agrandir";
        /* supprimer : grisé s'il n'y a aucune ligne cochée et déliée (l'erreur n'est pas proposée) */
        if (a.dataset.blk === "detail" && ["copy", "cut", "export", "pdf"].includes(a.dataset.act) && INS_EDIT) {
          /* ces actions ne prennent que l'onglet ouvert : signaler les cochées des autres onglets */
          const all = insDelPlan("detail"), here = active === "lnk" ? 0 : (all.del[active] || new Set()).size;
          const other = active === "unl" ? 0 : Math.max(0, all.n - here);
          a.__hint = "";
          if (other) m.__hint = "+ " + other + " COCHÉE(S) DANS D'AUTRES ONGLETS — COPIER, COUPER, EXPORTER ET APERÇU NE PRENNENT QUE L'ONGLET OUVERT";
        }
        /* FORMAT 116 : colonne sélectionnée dans ce bloc → actions sur la colonne */
        if (["copy", "cut", "paste"].includes(a.dataset.act) && colSelFor(a.dataset.blk)) {
          const cs = colSelFor(a.dataset.blk);
          const ok = a.dataset.act === "copy" || cs.edit;
          const lb = (a.dataset.act === "copy" ? "COPIER LA COLONNE" : a.dataset.act === "cut" ? "COUPER LA COLONNE" : "COLLER DANS LA COLONNE") + " « " + cs.label + " »";
          const n = a.dataset.act === "paste" ? "" : cs.vals.length;
          return `<button type="button" data-i="${i}" class="blk-del blk-clip${ok ? "" : " off"}" ${ok ? "" : "disabled"}>${a.innerHTML}<span>${esc(lb)}</span>${n === "" ? "" : svCnt(n)}</button>`;
        }
        if (["copy", "cut", "paste"].includes(a.dataset.act) && ctlTab(a.dataset.blk)) {
          const n = ctlCount(a.dataset.blk, a.dataset.act);
          const lb = a.dataset.act === "paste" && ctlTab(a.dataset.blk) === "inc" ? "COLLER (RÉIMPORTER)" : lab;
          return `<button type="button" data-i="${i}" class="blk-del blk-clip${n ? "" : " off"}" ${n ? "" : "disabled"}>${a.innerHTML}<span>${esc(lb)}${a.__hint ? `<small class="del-split">${esc(a.__hint)}</small>` : ""}</span>${n > 0 || n === 0 ? svCnt(n) : ""}</button>`;
        }
        if (["copy", "cut", "paste"].includes(a.dataset.act)) {
          const n = clipCount(a.dataset.blk, a.dataset.act);
          return `<button type="button" data-i="${i}" class="blk-del blk-clip${n ? "" : " off"}" ${n ? "" : "disabled"}>${a.innerHTML}<span>${esc(lab)}${a.__hint ? `<small class="del-split">${esc(a.__hint)}</small>` : ""}</span>${svCnt(n)}</button>`;
        }
        /* exporter / aperçu : grisés si le bloc est vide (l'erreur n'est pas proposée) */
        if ((a.dataset.act === "export" || a.dataset.act === "pdf") && blkEmpty(a.dataset.blk)) {
          return `<button type="button" data-i="${i}" class="off" disabled>${a.innerHTML}<span>${esc(lab)}</span></button>`;
        }
        if (a.dataset.act === "pdf") {
          const dref = pdfDoneRef(a.dataset.blk);
          if (dref) return `<button type="button" data-i="${i}" class="off" disabled>${a.innerHTML}<span>${esc(lab)}<small class="del-split">DÉJÀ ÉDITÉ ET CLASSÉ DANS DOCUMENTS : ${esc(dref)}</small></span></button>`;
        }
        if (a.dataset.act === "del") {
          const up = insUnlPlan(a.dataset.blk);
          const un = up ? up.n : 0;
          const dl = up ? `<button type="button" data-unl="${esc(a.dataset.blk)}" class="blk-del blk-unl${un ? "" : " off"}" ${un ? "" : "disabled"}><span>✕ DÉLIER LES LIGNES COCHÉES</span>${svCnt(un)}</button>` : "";
          const dp = insDelPlan(a.dataset.blk), n = dp.n, sp = Object.keys(dp.del).length > 1 ? insDelSplit(dp) : "";
          return dl + `<button type="button" data-i="${i}" class="blk-del${n ? "" : " off"}" ${n ? "" : "disabled"}>${a.innerHTML}<span>${esc(lab)}${sp ? `<small class="del-split">${esc(sp)}</small>` : ""}</span>${svCnt(n)}</button>`;
        }
        if (false) {
          const n = 0;
          return `<button type="button" data-i="${i}" class="blk-del${n ? "" : " off"}" ${n ? "" : "disabled"}>${a.innerHTML}<span>${esc(lab)}</span>${svCnt(n)}</button>`;
        }
        return `<button type="button" data-i="${i}">${a.innerHTML}<span>${esc(lab)}${a.__hint ? `<small class="del-split">${esc(a.__hint)}</small>` : ""}</span></button>`;
      }).join("");
      if (m.__hint) m.insertAdjacentHTML("afterbegin", `<div class="blk-hint">${esc(m.__hint)}</div>`);
      /* FORMAT 97 : DÉTAIL DÉLAIS ouvert (PLANNING) — commandes du planning et affichage JOUR / SEMAINE / MOIS en tête du menu */
      const DX = shell.__insDly;
      if (DX && active === "dly" && acts.some(a => a.dataset.blk === "detail") && shell.querySelector("#dlyGantt")) {
        const sc = DX.scaleOf(), lev = DX.canLev();
        const opt = (v, lab) => `<button type="button" data-dly="sc-${v}" class="dly-sc${sc === v ? " on" : ""}"><span>${sc === v ? "✓ " : ""}${lab}</span></button>`;
        m.insertAdjacentHTML("afterbegin", `<button type="button" data-dly="gen"><span>GÉNÉRER LE PLANNING</span></button>
          <button type="button" data-dly="sort" class="${DX.sorted() ? "off" : ""}"><span>CLASSER PAR DÉBUT</span></button>
          <button type="button" data-dly="lev" class="${lev ? "" : "off"}" ${lev ? "" : 'aria-disabled="true"'}><span>APPLIQUER LE NIVELLEMENT</span></button>
          <div class="blk-sep"></div><div class="blk-hint">AFFICHAGE DU GANTT</div>${opt("j", "JOUR")}${opt("s", "SEMAINE")}${opt("m", "MOIS")}<div class="blk-sep"></div>`);
        let lp = null;
        m.addEventListener("pointerdown", e => { const so = e.target.closest('[data-dly="sort"].off'); if (so) { lp = setTimeout(() => svToast("DÉJÀ CLASSÉ PAR DÉBUT : LE BOUTON REDEVIENT ACTIF DÈS QU'UNE LIGNE DÉPLACÉE NE RESPECTE PLUS CET ORDRE.", 4000, so), 550); return; } const b = e.target.closest('[data-dly="lev"].off'); if (!b) return; lp = setTimeout(() => svToast("RIEN À NIVELER : AUCUN JOUR NE DÉPASSE LE PLAFOND DE MAIN D'ŒUVRE (OU PAS DE PLAFOND / PAS DE MAIN D'ŒUVRE).", 4000, b), 550); });
        ["pointerup", "pointercancel"].forEach(t => m.addEventListener(t, () => clearTimeout(lp)));
        m.addEventListener("click", e => {
          const b = e.target.closest("[data-dly]");
          if (!b) return;
          e.stopPropagation();
          if (b.classList.contains("off")) return;
          m.remove();
          const v = b.dataset.dly;
          if (v === "gen") DX.gen(); else if (v === "sort") DX.sortDeb(); else if (v === "lev") DX.level(); else DX.scale(v.slice(3));
        }, true);
      }
      /* v461 : bloc TÂCHES — CLASSER PAR DÉBUT (même ordre que le PLANNING : lots, activités, puis le planning) */
      if (DX && INS_EDIT && acts.some(a => a.dataset.blk === "hier")) {
        const srt = DX.sorted();
        m.insertAdjacentHTML("afterbegin", `<button type="button" data-hs="sort" class="${srt ? "off" : ""}"><span>CLASSER PAR DÉBUT</span></button><div class="blk-sep"></div>`);
        let lph = null;
        m.addEventListener("pointerdown", e => { const so = e.target.closest('[data-hs].off'); if (!so) return; lph = setTimeout(() => svToast("DÉJÀ CLASSÉ PAR DÉBUT : LE BOUTON REDEVIENT ACTIF DÈS QU'UNE LIGNE DÉPLACÉE NE RESPECTE PLUS CET ORDRE.", 4000, so), 550); });
        ["pointerup", "pointercancel"].forEach(t => m.addEventListener(t, () => clearTimeout(lph)));
        m.addEventListener("click", e => { const b = e.target.closest("[data-hs]"); if (!b) return; e.stopPropagation(); if (b.classList.contains("off")) return; m.remove(); DX.sortDeb(); }, true);
      }
      if (QQm && QQm.edit()) {
        const n = QQm.nChecked();
        m.insertAdjacentHTML("afterbegin", `<button type="button" data-qq="title"><span>+ AJOUTER UN TITRE</span></button>
          <button type="button" data-qq="sub"><span>+ AJOUTER UN SOUS-TITRE (SOUS LE TITRE COCHÉ)</span></button>
          <button type="button" data-qq="del" class="blk-del${n ? "" : " off"}" ${n ? "" : "disabled"}><span>SUPPRIMER LES LIGNES COCHÉES</span>${svCnt(n)}</button><div class="blk-sep"></div>`);
        m.addEventListener("click", e => {
          const b = e.target.closest("[data-qq]");
          if (!b) return;
          e.stopPropagation();
          if (b.disabled) return;
          m.remove();
          const v = b.dataset.qq;
          if (v === "title") QQm.addTitle(); else if (v === "sub") QQm.addSub(); else QQm.del();
        }, true);
      }
      document.body.appendChild(m);
      const r = btn.getBoundingClientRect();
      sviPlaceMenu(m, r);
      m.addEventListener("click", e => {
        const ub = e.target.closest("[data-unl]");
        if (ub) {
          if (ub.disabled) return;
          m.remove();
          const pl = insUnlPlan(ub.dataset.unl);
          if (pl && pl.n) lkDestroy(pl);
          return;
        }
        const it = e.target.closest("[data-i]");
        if (!it || it.classList.contains("off")) return;
        const a = acts[+it.dataset.i];
        m.remove();
        runBlkAct(a.dataset.blk, a.dataset.act);
      });
      setTimeout(() => document.addEventListener("click", function off(e) {
        if (!e.target.closest("#blkMenu")) { m.remove(); document.removeEventListener("click", off, true); }
      }, true), 0);
    };

    shell.onclick = event => {
      if (event.target.closest('[data-pill="doc"]')) {
        openDocForm();
        return;
      }
      if (event.target.closest("#obsAlertBtn, #refBang .obs-bang")) { openObsAlert(); return; }
      if (event.target.closest("#histBtn")) { openHistory(); return; }
      const ofl = event.target.closest("[data-obsflag]");
      if (ofl) {
        const list = recLoad("obs");
        const r = list[+ofl.dataset.obsflag];
        if (r) {
          r.important = !r.important;
          recSave("obs", list);
          histLog("OBS", r.important ? "ALERTE ACTIVÉE" : "ALERTE DÉSACTIVÉE", r.ref);
          updPill("obs");
        }
        return;
      }
      const dx = event.target.closest("[data-docexp]");
      if (dx) {
        event.preventDefault();
        const list = docsLoad();
        const r = list[+dx.dataset.docexp];
        if (r && !r.expired) svConfirm({ title: "MARQUER EXPIRÉ", text: r.ref + " SERA MARQUÉ EXPIRÉ (CHOIX DÉFINITIF).", ok: "EXPIRÉ" }).then(go => {
          if (!go) { renderRec("doc"); return; }
          r.expired = true;
          r.expiredAt = localDT(new Date());
          docsSave(list);
          histLog("DOC", "EXPIRÉ", r.ref + " — " + (r.title || ""));
          updPill("doc");
        });
        else renderRec("doc");
        return;
      }
      if (event.target.closest(".blk-grip, .blk-rsz")) return;
      const bm = event.target.closest("#bdgMore");
      if (bm) { event.stopPropagation(); openBdgMore(bm); return; }
      if (event.target.closest("#layResetBtn")) {
        if ($("layResetBtn").disabled) return;
        svConfirm({ title: "DISPOSITION PAR DÉFAUT", text: "TOUS LES BLOCS REVIENNENT À LEUR PLACE ET À LEUR TAILLE D'ORIGINE.", ok: "RÉTABLIR", tone: "neutral" }).then(go => {
          if (!go) return;
          laySave({});
          histLog("DISPOSITION", "PAR DÉFAUT", "BLOCS REMIS À L'ORIGINE");
          layApply();
        });
        return;
      }
      if (event.target.closest('[data-pill="inf"]')) { openInfo(); return; }
      const ro = event.target.closest("[data-recopen]");
      if (ro) { openDoc(+ro.dataset.recopen); return; }
      const recPill = event.target.closest('[data-pill="obs"], [data-pill="taf"]');
      if (recPill) {
        openRecForm(recPill.dataset.pill);
        return;
      }

      const rt = event.target.closest("[data-rtab]");
      if (rt) {
        recActive = rt.dataset.rtab;
        try { localStorage.setItem("svi_rectab_v1", recActive); } catch (e) {}
        recTabApply();
        return;
      }
      const more = event.target.closest(".blk-more");
      if (more) {
        event.stopPropagation();
        openBlkMenu(more);
        return;
      }
      const bb = event.target.closest(".blk-btn");
      if (bb) {
        event.stopPropagation();
        runBlkAct(bb.dataset.blk, bb.dataset.act);
        return;
      }

      if (event.target.closest(".col-rs")) return;
      const cfb = event.target.closest(".cf-btn");
      if (cfb) {
        event.stopPropagation();
        cfOpenMenu(cfb);
        return;
      }

      const tab =
        event.target.closest("[data-tab]");

      if (tab) {
        active = tab.dataset.tab;
        try { localStorage.setItem("svi_dtab_v1", active); } catch (e) {}
        renderTab();
        return;
      }

      /* ligne de Détail charge / Détail produit : filtre tout l'écran
         sur sa désignation, son lot, sa primaire et sa secondaire
         (re-toucher la ligne retire ces filtres) */
      const why = event.target.closest("td[data-why]");
      if (why) {
        showWhy(why);
        return;
      }

      const toggle = (set, v) =>
        set.has(v) ? set.delete(v) : set.add(v);

      const lineRow = event.target.closest("tr[data-row]");

      if (lineRow && !event.target.closest("input")) {
        toggle(selRows, lineRow.dataset.row);
        refreshAll();
        return;
      }

      const h = event.target.closest("[data-h]");

      if (h) {
        toggle(hSel[h.dataset.h], h.dataset.v);
        refreshAll();
        return;
      }

      const dRow = event.target.closest("[data-desig]");

      if (dRow) {
        toggle(selDesig, dRow.dataset.desig);
        refreshAll();
      }
    };

    shell.onchange = event => {
      const ti = event.target.closest(".bdg-tva-input");
      if (ti) histLog(tabTitle(), "TVA MODIFIÉE", ti.dataset.line + " → " + ti.value);
    };

    shell.oninput = event => {
      const input =
        event.target.closest(".bdg-tva-input");

      if (input) {
        const gid = input.dataset.line;
        const members =
          (byKindNow()[active] || []).filter(l => l.gid === gid);

        if (members.length) {
          const v = num(String(input.value).replace("%", ""));
          members.forEach(l => {
            l.tva = v;
            l.price = l.priceTTC / (1 + v / 100);
            l.amount = l.ttcAmount / (1 + v / 100);
          });

          const cell = [...shell.querySelectorAll("[data-ttc]")]
            .find(c => c.dataset.ttc === gid);

          if (cell) {
            const a = members.reduce((t, l) => t + l.amount, 0);
            const v = members.reduce((t, l) => t + tvaFor(l), 0);
            cell.textContent = money(a + v);
          }

          const shownG = new Set(
            [...shell.querySelectorAll("tr[data-row]")].map(r => r.dataset.row)
          );
          const list = (byKindNow()[active] || []).filter(l => shownG.has(l.gid));

          const ht =
            list.reduce((t, l) => t + l.amount, 0);

          const tva =
            list.reduce((t, l) => t + tvaFor(l), 0);

          if ($("bdgFtTVA")) $("bdgFtTVA").textContent = money(tva);
          if ($("bdgFtTTC")) $("bdgFtTTC").textContent = money(ht + tva);

          renderClient();
        }

        return;
      }
    };

