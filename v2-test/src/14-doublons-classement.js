    /* ===== AUCUN DOUBLON (FORMAT) : lots / activités / qualité = même intitulé ;
       désignations et charges = ART + DÉSIGNATION + UNITÉ ; produits = DÉSIGNATION + UNITÉ.
       Une saisie qui crée un doublon ouvre la fenêtre DOUBLON : RÉTABLIR ou FUSIONNER (liaisons reportées) ===== */
    const DUP_LAB = { des: "DÉSIGNATIONS CLIENT", lot: "LOTS", prim: "ACTIVITÉS PRIMAIRES", sec: "ACTIVITÉS SECONDAIRES", chg: "DÉTAIL CHARGES", prd: "DÉTAIL PRODUITS", qlt: "DÉTAIL QUALITÉ" };
    const dupKeyOf = (k, r) => {
      if (!r || r.t) return "";
      if (k === "lot" || k === "prim" || k === "sec" || k === "qlt") return U_(r.v);
      if (!U_(r.des)) return "";
      /* FORMAT 117 : un même produit dans des tâches différentes n'est pas un doublon */
      /* v478 (remarque 7) : une charge est propre à sa tâche secondaire — même charge dans deux tâches différentes ≠ doublon */
      if (k === "chg") { const T = [...new Set((INS.links || []).filter(l => (l.chg || []).some(x => x.id === r.id)).map(l => l.lot + "|" + l.sec))].sort().join(","); return impId(k, r) + "#" + T; }
      return k === "prd" ? impId(k, r) + "#" + prdChainKey(r.id) : impId(k, r);
    };
    const dupName = (k, r) => (k === "lot" || k === "prim" || k === "sec" || k === "qlt") ? U_(r.v) : [r.art, r.des].filter(Boolean).join(" — ") + (r.u ? " (" + U_(r.u) + ")" : "");
    /* v490 (remarque 1) : chaque ligne de la fenêtre DOUBLON montre ses combinaisons complètes, sur une ligne :
       DÉSIGNATION CLIENT / LOT / ACTIVITÉ PRIMAIRE / ACTIVITÉ SECONDAIRE ; produit : + UNITÉ · NBR · QPB ; « NON LIÉ » sans liaison */
    const dupChains = (k, r) => {
      const L = (INS.links || []).filter(l => k === "prd" || k === "chg" ? (l[k] || []).some(x => x.id === r.id) : l[k] === r.id);
      const nm = (kk, id) => kk === "des" ? (((INS.des || []).find(x => x.id === id) || {}).des || "") : lkName(kk, id);
      return L.map(l => ["des", "lot", "prim", "sec"].map(kk => U_(nm(kk, l[kk]))).join(" / "));
    };
    const dupLi = (k, r, tag) => {
      const ch = dupChains(k, r);
      const pq = k === "prd" ? " — NBR " + insFmt(r.nbr) + " · QPB " + insFmt(insCalc("prd", r, "q")) : k === "chg" ? " — QCB " + insFmt(r.q) : "";
      return `<li><b>${esc(dupName(k, r))}</b>${esc(pq)}${tag ? " " + esc(tag) : ""}<div class="dup-ch">${ch.length ? ch.map(c => `<div>${esc(c)}</div>`).join("") : "<div>NON LIÉ</div>"}</div></li>`;
    };
    /* liaisons après fusion (drop → keep), avec contrôle de la règle A */
    const dupMerged = (k, keep, drop) => {
      const L = JSON.parse(JSON.stringify(INS.links || []));
      L.forEach(l => {
        if (k === "prd" || k === "chg") (l[k] || []).forEach(x => { if (x.id === drop) x.id = keep; });
        else if (l[k] === drop) l[k] = keep;
      });
      const out = [];
      L.forEach(l => {
        if (k === "prd" || k === "chg") { const seen = new Set(); l[k] = (l[k] || []).filter(x => !seen.has(x.id) && seen.add(x.id)); }
        const same = out.find(o => o.des === l.des && o.lot === l.lot && o.prim === l.prim && o.sec === l.sec);
        if (!same) { out.push(l); return; }
        ["prd", "chg"].forEach(f => (l[f] || []).forEach(x => { if (!(same[f] || []).some(y => y.id === x.id)) (same[f] = same[f] || []).push(x); }));
      });
      const P = new Map(), S = new Map();
      let err = "";
      out.forEach(l => {
        const tp = l.lot + "|" + l.prim;
        if (P.has(tp) && P.get(tp) !== l.des) err = "RÈGLE A : LA TÂCHE PRIMAIRE " + lkName("lot", l.lot) + " › " + lkName("prim", l.prim) + " SERAIT LIÉE À DEUX DÉSIGNATIONS.";
        P.set(tp, l.des);
        const ts = l.lot + "|" + l.sec;
        if (S.has(ts) && S.get(ts) !== l.des) err = err || "RÈGLE A : LA TÂCHE SECONDAIRE " + lkName("lot", l.lot) + " › " + lkName("sec", l.sec) + " SERAIT LIÉE À DEUX DÉSIGNATIONS.";
        S.set(ts, l.des);
      });
      return { links: out, err };
    };
    const dupMerge = (k, keep, drop, links) => {
      INS.links = links;
      /* délais : clés « lot|act. scd » reportées */
      if ((k === "lot" || k === "sec") && INS.dlp) {
        Object.keys(INS.dlp).forEach(key => {
          const [lo, pr] = key.split("|");
          const nk = (k === "lot" && lo === drop ? keep : lo) + "|" + (k === "sec" && pr === drop ? keep : pr);
          if (nk !== key) { INS.dlp[nk] = (INS.dlp[nk] || []).concat(INS.dlp[key]); delete INS.dlp[key]; }
        });
      }
      INS[k] = INS[k].filter(r => r.id !== drop);
      histLog("SAISIE", "DOUBLON FUSIONNÉ", DUP_LAB[k] + " — " + dupName(k, INS[k].find(r => r.id === keep) || {}));
    };
    /* fenêtre DOUBLON ; renvoie "merge" ou "back" */
    const dupAsk = async (k, keepR, dropR, opts = {}) => {
      const m = dupMerged(k, keepR.id, dropR.id);
      const v = await svChoose({ title: opts.title || "DOUBLON",
        html: `<div class="svc-sub">${esc(DUP_LAB[k])} : CE LIBELLÉ EXISTE DÉJÀ</div>
          <ul class="svc-list dup-ul">${dupLi(k, keepR)}${dupLi(k, dropR, opts.typed ? "(SAISIE)" : "")}</ul>
          ${m.err ? `<div class="svc-sub svc-warn">FUSION IMPOSSIBLE : ${esc(m.err)}</div>` : `<div class="svc-sub">FUSIONNER : UNE SEULE LIGNE, TOUTES LES LIAISONS REPORTÉES.</div>`}`,
        noCancel: true,
        buttons: [{ v: "back", label: opts.backLabel || "RÉTABLIR", tone: "neutral" }, { v: "merge", label: "FUSIONNER", tone: "danger", disabled: !!m.err }] });
      if (v === "merge" && !m.err) { dupMerge(k, keepR.id, dropR.id, m.links); return "merge"; }
      return "back";
    };
    if (!shell.__dupBound) {
      shell.__dupBound = true;
      /* valeur avant saisie */
      shell.addEventListener("focusin", e => {
        const X = shell.__dupX, inp = e.target.closest && e.target.closest(".ins-in");
        if (!X || !inp) return;
        const h = inp.closest("[data-iid]"), k = h && (h.dataset.ik || h.closest("[data-ik]")?.dataset.ik);
        const r = k && X.INS[k] && X.INS[k].find(x => x.id === h.dataset.iid);
        shell.__dupOld = r ? { k, id: r.id, row: { ...r } } : null;
      });
      shell.addEventListener("change", async e => {
        const X = shell.__dupX, inp = e.target.closest && e.target.closest(".ins-in");
        if (!X || !inp || !["v", "des", "art", "u"].includes(inp.dataset.f)) return;
        const h = inp.closest("[data-ik]"), k = h && h.dataset.ik;
        if (!k || !DUP_LAB[k]) return;
        const id = inp.closest("[data-iid]")?.dataset.iid || (X.INS[k][X.INS[k].length - 1] || {}).id;
        const r = X.INS[k].find(x => x.id === id);
        /* FORMAT 88 : même désignation (ART + DÉSIGNATION ; produit : DÉSIGNATION) avec une autre unité → refusée */
        if (k === "des" && r && !r.t && U_(r.des) && U_(r.u)) {
          const o = X.INS[k].find(x => x.id !== r.id && !x.t && U_(x.des) === U_(r.des) && U_(x.u) && U_(x.u) !== U_(r.u));
          if (o) {
            const f = inp.dataset.f, old = shell.__dupOld && shell.__dupOld.id === r.id ? shell.__dupOld.row : null;
            svToast(U_(r.des) + " EXISTE DÉJÀ EN " + U_(o.u) + " : UNITÉ " + U_(r.u) + " REFUSÉE.", 4500, inp);
            r[f] = old ? (old[f] ?? "") : "";
            X.save(); X.refresh();
            return;
          }
        }
        /* v490 (remarque 2) : intitulé presque identique à un existant → VOULEZ-VOUS DIRE … ? */
        if (r && X.near && ["v", "des"].includes(inp.dataset.f) && !X.INS[k].some(x => x.id !== r.id && dupKeyOf(k, x) === dupKeyOf(k, r))) {
          const ex = X.near(k, r);
          if (ex && !X.nearSkipped(k, X.nearName(k, ex), X.nearName(k, r))) {
            const a = await X.nearAsk(k, ex, r);
            if (a === "take") { r[inp.dataset.f] = X.nearName(k, ex); if (k !== "lot" && k !== "prim" && k !== "sec" && k !== "qlt" && ex.art && !r.art) r.art = ex.art; }
            else { X.save(); X.refresh(); return; }
          }
        }
        /* v492 (remarque 10) : une désignation de charge n'a qu'une unité et qu'un article dans tout le budget
           (deux façons d'acheter : le préciser dans la désignation, ex. CIMENT (EN SAC) / CIMENT (EN VRAC)) */
        if (k === "chg" && r && !r.t && U_(r.des)) {
          const o = X.INS.chg.find(x => x.id !== r.id && !x.t && U_(x.des) === U_(r.des) && ((U_(x.u) && U_(r.u) && U_(x.u) !== U_(r.u)) || (U_(x.art) && U_(r.art) && U_(x.art) !== U_(r.art))));
          if (o) {
            const f = inp.dataset.f, old = shell.__dupOld && shell.__dupOld.id === r.id ? shell.__dupOld.row : null;
            svToast(U_(r.des) + " EXISTE DÉJÀ" + (U_(o.art) ? " (ARTICLE " + U_(o.art) + ")" : "") + " EN " + U_(o.u) + " : UNE DÉSIGNATION N'A QU'UNE UNITÉ ET UN ARTICLE. POUR UNE AUTRE FAÇON D'ACHETER, LE PRÉCISER ENTRE PARENTHÈSES (EX. « " + U_(r.des) + " (EN SAC) »).", 6000, inp);
            r[f] = old ? (old[f] ?? "") : "";
            X.save(); X.refresh();
            return;
          }
        }
        const key = dupKeyOf(k, r);
        if (!key) return;
        const other = X.INS[k].find(x => x.id !== r.id && dupKeyOf(k, x) === key);
        if (!other) return;
        const old = shell.__dupOld && shell.__dupOld.id === r.id ? shell.__dupOld.row : null;
        const v = await X.ask(k, other, r, { typed: true, backLabel: old ? "RÉTABLIR" : "EFFACER LA SAISIE" });
        if (v === "back") {
          if (old) Object.assign(r, old); else X.INS[k] = X.INS[k].filter(x => x.id !== r.id);
        }
        X.save(); X.refresh();
      }, true);
    }
    /* ===== CLASSEMENT PAR DÉFAUT (FORMAT) : désignations client par ART croissant (ordre naturel ; ART vide en tête ;
       même ART → par désignation), en gardant les titres (classement à l'intérieur de chaque titre) ;
       autres tableaux par désignation / intitulé croissant. Appliqué à l'ouverture (une fois), après un import
       ou un collage ; le glisser reste libre ensuite. ===== */
    const natCmp = (a, b) => String(a ?? "").localeCompare(String(b ?? ""), "fr", { numeric: true, sensitivity: "base" });
    const desCmp = (a, b) => {
      const A = String(a.art ?? "").trim(), B = String(b.art ?? "").trim();
      if (!A !== !B) return A ? 1 : -1;   /* ART vide en tête */
      return natCmp(A, B) || natCmp(a.des, b.des);
    };
    const insSortKind = k => {
      if (!INS || !INS[k] || INS[k].length < 2) return;
      if (k !== "des") { INS[k].sort((a, b) => natCmp(k === "lot" || k === "prim" || k === "sec" || k === "qlt" ? a.v : a.des, k === "lot" || k === "prim" || k === "sec" || k === "qlt" ? b.v : b.des) || natCmp(a.u, b.u)); return; }
      insNorm();
      /* arbre (niveau r.d) → frères classés → remis à plat */
      const root = { kids: [] }, stack = [root];
      INS.des.forEach(r => {
        const d = Number(r.d) || 0;
        while (stack.length - 1 > d) stack.pop();
        const node = { r, kids: [] };
        stack[stack.length - 1].kids.push(node);
        if (r.t) stack.push(node);
      });
      const flat = [];
      const walk = n => { n.kids.sort((x, y) => desCmp(x.r, y.r)); n.kids.forEach(c => { flat.push(c.r); walk(c); }); };
      walk(root);
      INS.des.splice(0, INS.des.length, ...flat);
    };
    const insSortAll = () => ["des", "lot", "prim", "sec", "chg", "prd", "qlt"].forEach(insSortKind);
    /* espaces nettoyés une fois dans les données déjà enregistrées (FORMAT) */
    if (INS && INS_EDIT && !INS.cleanV1) {
      ["des", "lot", "prim", "sec", "chg", "prd", "qlt"].forEach(k => (INS[k] || []).forEach(r => ["art", "des", "u", "v"].forEach(f => { if (typeof r[f] === "string") r[f] = sviClean(r[f]); })));
      INS.cleanV1 = true; insSave();
    }
    if (INS && INS_EDIT && !INS.sortedV1) { insSortAll(); INS.sortedV1 = true; insSave(); }
    /* v490 (remarque 2) : INTITULÉS PRESQUE IDENTIQUES — même texte aux accents, tirets, espaces ou ponctuation près,
       ou une lettre en plus / en moins / changée, ou deux lettres inversées (ENDUI 20 / ENDUIT 20, ÉTANCHÉITÉ / ÉTANCHIÉTÉ).
       Les nombres doivent être les mêmes (ENDUIT 10 et ENDUIT 20 restent distincts). Ce n'est pas un doublon :
       on choisit PRENDRE L'EXISTANT ou GARDER LA NOUVELLE (ouverture du budget : FUSIONNER ou IGNORER) */
    const nearNorm = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/Œ/g, "OE").replace(/[^A-Z0-9]+/g, "");
    const nearDigits = s => (String(s ?? "").match(/\d+/g) || []).map(x => String(+x)).join(",");
    const nearDist1 = (a, b) => {   /* vrai si une seule faute : insertion, suppression, remplacement ou inversion de deux lettres voisines */
      if (a === b) return false;
      const la = a.length, lb = b.length;
      if (Math.abs(la - lb) > 1) return false;
      if (la === lb) {
        const diff = []; for (let i = 0; i < la; i++) if (a[i] !== b[i]) { diff.push(i); if (diff.length > 2) return false; }
        if (diff.length === 1) return true;
        return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
      }
      const [s, l] = la < lb ? [a, b] : [b, a];
      let i = 0; while (i < s.length && s[i] === l[i]) i++;
      return s.slice(i) === l.slice(i + 1);
    };
    const nearName = (k, r) => (k === "lot" || k === "prim" || k === "sec" || k === "qlt") ? r.v : r.des;
    const nearCtx = (k, r) => {
      if (k === "lot" || k === "prim" || k === "sec" || k === "qlt") return "";
      if (k === "des") return U_(r.u);
      const key = dupKeyOf(k, r); return U_(r.u) + "#" + String(key).split("#").slice(1).join("#");
    };
    const isNear = (a, b) => {
      if (!a || !b || U_(a) === U_(b)) return false;
      if (nearDigits(a) !== nearDigits(b)) return false;
      const na = nearNorm(a), nb = nearNorm(b);
      if (!na || !nb) return false;
      if (na === nb) return true;
      return Math.min(na.length, nb.length) >= 5 && nearDist1(na, nb);
    };
    const NEAR_K = ["des", "lot", "prim", "sec", "chg", "prd"];
    /* la ligne existante la plus proche d'une saisie (celle qui a le plus de liaisons) */
    const nearOf = (k, r) => {
      if (!NEAR_K.includes(k) || !r || r.t) return null;
      const n = nearName(k, r), c = nearCtx(k, r);
      const cand = (INS[k] || []).filter(x => x !== r && !x.t && nearCtx(k, x) === c && isNear(nearName(k, x), n));
      if (!cand.length) return null;
      const nl = x => (INS.links || []).filter(l => k === "prd" || k === "chg" ? (l[k] || []).some(y => y.id === x.id) : l[k] === x.id).length;
      return cand.sort((x, y) => nl(y) - nl(x))[0];
    };
    const nearSkipKey = (k, a, b) => ref + "|near|" + k + "|" + [nearNorm(a), nearNorm(b)].sort().join("|");
    const nearSkipped = (k, a, b) => { try { return !!JSON.parse(localStorage.getItem("svi_nearskip_v1") || "{}")[nearSkipKey(k, a, b)]; } catch (e) { return false; } };
    const nearSkip = (k, a, b) => { try { const o = JSON.parse(localStorage.getItem("svi_nearskip_v1") || "{}"); o[nearSkipKey(k, a, b)] = 1; localStorage.setItem("svi_nearskip_v1", JSON.stringify(o)); } catch (e) {} };
    /* saisie : « VOULEZ-VOUS DIRE … ? » */
    const nearAsk = async (k, ex, r) => {
      const v = await svChoose({ title: "VOULEZ-VOUS DIRE « " + U_(nearName(k, ex)) + " » ?",
        html: `<div class="svc-sub">${esc(DUP_LAB[k])} : « ${esc(U_(nearName(k, r)))} » RESSEMBLE À UN INTITULÉ EXISTANT (ACCENTS, TIRETS, ESPACES OU UNE LETTRE PRÈS).</div>
          <ul class="svc-list dup-ul">${dupLi(k, ex, "(EXISTANT)")}${dupLi(k, r, "(SAISIE)")}</ul>`,
        noCancel: true,
        buttons: [{ v: "keep", label: "GARDER LA NOUVELLE", tone: "neutral" }, { v: "take", label: "PRENDRE L'EXISTANT", tone: "danger" }] });
      if (v === "take") return "take";
      nearSkip(k, nearName(k, ex), nearName(k, r));
      histLog("SAISIE", "INTITULÉ PROCHE GARDÉ", DUP_LAB[k] + " — " + U_(nearName(k, r)) + " (EXISTANT : " + U_(nearName(k, ex)) + ")");
      return "keep";
    };
    /* ouverture du budget (et après un import) : paires proches déjà présentes, dans la fenêtre DOUBLON EXISTANT */
    const nearPairs = () => {
      const out = [];
      NEAR_K.forEach(k => {
        const by = new Map();
        (INS[k] || []).forEach(r => { if (r.t || !U_(nearName(k, r))) return; const c = nearCtx(k, r); if (!by.has(c)) by.set(c, []); by.get(c).push(r); });
        by.forEach(L => {
          const names = new Map();
          L.forEach(r => { const n = U_(nearName(k, r)); if (!names.has(n)) names.set(n, r); });
          const U = [...names.values()];
          for (let i = 0; i < U.length; i++) for (let j = i + 1; j < U.length; j++) {
            const a = nearName(k, U[i]), b = nearName(k, U[j]);
            if (Math.abs(nearNorm(a).length - nearNorm(b).length) > 1 && nearNorm(a) !== nearNorm(b)) continue;
            if (!isNear(a, b) || nearSkipped(k, a, b)) continue;
            const nl = x => (INS.links || []).filter(l => k === "prd" || k === "chg" ? (l[k] || []).some(y => y.id === x.id) : l[k] === x.id).length;
            const [keep, drop] = nl(U[j]) > nl(U[i]) ? [U[j], U[i]] : [U[i], U[j]];
            out.push({ k, keep, drop, near: true });
          }
        });
      });
      return out;
    };
    shell.__dupX = INS && INS_EDIT ? { INS, ask: (k, a, b, o) => dupAsk(k, a, b, o), near: (k, r) => nearOf(k, r), nearAsk: (k, ex, r) => nearAsk(k, ex, r), nearSkipped: (k, a, b) => nearSkipped(k, a, b), nearName: (k, r) => nearName(k, r), isNear: (a, b) => isNear(a, b), save: () => insSave(), refresh: () => refreshAll() } : null;
    /* doublons déjà présents (anciens budgets, imports) : proposés à l'ouverture, un par un ; IGNORER = plus redemandé pendant la séance */
    /* DOUBLON EXISTANT (FORMAT 103) : une seule fenêtre pour tous les doublons du budget ;
       sélecteur ‹ i/N › (liste au toucher du numéro), IGNORER / FUSIONNER / IGNORER TOUS / FUSIONNER TOUS */
    const dupExisting = async () => {
      if (!INS || !INS_EDIT || shell.__dupBusy) return;
      let skip = {};
      try { skip = JSON.parse(sessionStorage.getItem("svi_dupskip") || "{}"); } catch (e) {}
      const items = [];
      Object.keys(DUP_LAB).forEach(k => {
        const seen = new Map();
        INS[k].forEach(r => {
          const key = dupKeyOf(k, r);
          if (!key) return;
          const first = seen.get(key);
          if (!first) { seen.set(key, r); return; }
          const sk = ref + "|" + k + "|" + key + "|" + r.id;
          if (!skip[sk]) items.push({ k, keep: first, drop: r, sk });
        });
      });
      /* v490 (remarque 2) : intitulés presque identiques, proposés dans la même fenêtre */
      try { nearPairs().forEach(x => { x.sk = ref + "|near|" + x.k + "|" + x.keep.id + "|" + x.drop.id; if (!skip[x.sk]) items.push(x); }); } catch (e) {}
      if (!items.length) return;
      shell.__dupBusy = true;
      let cur = 0, showList = false, changed = false;
      const alive = it => INS[it.k].includes(it.keep) && INS[it.k].includes(it.drop);
      const ignore = it => { skip[it.sk] = 1; try { sessionStorage.setItem("svi_dupskip", JSON.stringify(skip)); } catch (e) {} if (it.near) nearSkip(it.k, nearName(it.k, it.keep), nearName(it.k, it.drop)); };
      const d = document.createElement("div");
      d.id = "svConf";
      const finish = () => { d.remove(); shell.__dupBusy = false; if (changed) { insSave(); refreshAll(); } };
      const left = () => { for (let n = items.length - 1; n >= 0; n--) if (!alive(items[n])) items.splice(n, 1); if (cur >= items.length) cur = Math.max(0, items.length - 1); return items.length; };
      const draw = () => {
        if (!left()) { finish(); return; }
        const it = items[cur], m = dupMerged(it.k, it.keep.id, it.drop.id);
        d.innerHTML = `<div class="svc-card dupx-card" role="dialog" aria-modal="true">
          <button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
          <div class="svc-t dupx-head">DOUBLON EXISTANT
            <span class="dupx-nav"><button type="button" data-nav="-1"${cur ? "" : " disabled"}>‹</button><button type="button" class="dupx-num" data-list>${cur + 1}/${items.length}</button><button type="button" data-nav="1"${cur < items.length - 1 ? "" : " disabled"}>›</button></span></div>
          ${showList ? `<div class="dupx-list">${items.map((x, n) => `<button type="button" class="dupx-li${n === cur ? " on" : ""}" data-go="${n}"><b>${n + 1}</b> ${esc(DUP_LAB[x.k])} — ${esc(dupName(x.k, x.drop))}</button>`).join("")}</div>` : ""}
          <div class="svc-x"><div class="svc-sub">${it.near ? `${esc(DUP_LAB[it.k])} : INTITULÉS PRESQUE IDENTIQUES — VOULEZ-VOUS DIRE « ${esc(U_(nearName(it.k, it.keep)))} » ? (FUSIONNER = PRENDRE L'EXISTANT ; IGNORER = GARDER LES DEUX)` : `${esc(DUP_LAB[it.k])} : CE LIBELLÉ EXISTE DÉJÀ`}</div>
            <ul class="svc-list dup-ul svc-scroll">${dupLi(it.k, it.keep)}${dupLi(it.k, it.drop)}</ul>
            ${m.err ? `<div class="svc-sub svc-warn">FUSION IMPOSSIBLE : ${esc(m.err)}</div>` : `<div class="svc-sub">FUSIONNER : UNE SEULE LIGNE, TOUTES LES LIAISONS REPORTÉES.</div>`}</div>
          <div class="svc-f dupx-f">
            <button type="button" class="svc-b" data-a="ignall">IGNORER TOUS</button>
            <button type="button" class="svc-b svc-ok" data-a="mergeall">FUSIONNER TOUS</button>
            <button type="button" class="svc-b" data-a="ign">IGNORER</button>
            <button type="button" class="svc-b svc-ok" data-a="merge"${m.err ? " disabled" : ""}>FUSIONNER</button>
          </div></div>`;
      };
      document.getElementById("svConf")?.remove();
      document.body.appendChild(d);
      draw();
      d.addEventListener("click", async e => {
        if (e.target.closest("[data-x]")) { finish(); return; }
        const nv = e.target.closest("[data-nav]");
        if (nv && !nv.disabled) { cur += +nv.dataset.nav; draw(); return; }
        if (e.target.closest("[data-list]")) { showList = !showList; draw(); return; }
        const go = e.target.closest("[data-go]");
        if (go) { cur = +go.dataset.go; showList = false; draw(); return; }
        const a = e.target.closest("[data-a]");
        if (!a || a.disabled) return;
        const it = items[cur];
        if (a.dataset.a === "ign") { ignore(it); items.splice(cur, 1); draw(); return; }
        if (a.dataset.a === "merge") { const m = dupMerged(it.k, it.keep.id, it.drop.id); if (!m.err) { dupMerge(it.k, it.keep.id, it.drop.id, m.links); changed = true; } items.splice(cur, 1); draw(); return; }
        if (a.dataset.a === "ignall") { items.forEach(ignore); items.length = 0; finish(); return; }
        if (a.dataset.a === "mergeall") {
          /* v492 (remarque 11) : FUSIONNER TOUS sans seconde confirmation (↶ ANNULER permet de revenir en arrière) */
          const n = items.length;
          const blocked = [];
          items.slice().forEach(x => {
            if (!alive(x)) return;
            const m = dupMerged(x.k, x.keep.id, x.drop.id);
            if (m.err) { blocked.push(x.k + "|" + dupName(x.k, x.drop) + " : " + m.err); return; }
            dupMerge(x.k, x.keep.id, x.drop.id, m.links); changed = true;
          });
          items.length = 0;
          finish();
          histLog("SAISIE", "DOUBLONS FUSIONNÉS", (n - blocked.length) + " / " + n);
          if (blocked.length) sviAlert(blocked.map(b => "— " + b.replace(/^[a-z]+\|/, "")).join("\n"), "NON FUSIONNÉS (RÈGLE A) : " + blocked.length);
        }
      });
    };
    /* FORMAT 108 : produits du budget avec NBR vide ou 0 → déliés, retirés, mis dans IMPORT NON CRÉÉ (après confirmation) */
    const insNbrFix = async () => {
      if (!INS || !INS_EDIT || shell.__nbrBusy) return;
      const z = v => String(v ?? "").trim() === "" || num(v) === 0;
      const bad = (INS.prd || []).filter(r => z(r.nbr));
      if (!bad.length) return;
      const skipK = "svi_nbrskip:" + ref;
      try { if (sessionStorage.getItem(skipK) === bad.map(r => r.id).join(",")) return; } catch (e) {}
      const ids = new Set(bad.map(r => r.id));
      const touched = (INS.links || []).filter(l => (l.prd || []).some(x => ids.has(x.id)));
      const tag = l => [lkName("des", l.des), lkName("lot", l.lot), lkName("prim", l.prim), lkName("sec", l.sec)].join(" › ");
      shell.__nbrBusy = true;
      const go = await svConfirm({ title: "PRODUITS SANS NBR", ok: "RETIRER",
        html: `<div class="svc-sub">${bad.length} PRODUIT(S) AVEC NBR VIDE OU 0 SERONT RETIRÉS ET MIS DANS IMPORT NON CRÉÉ :</div>
          <ul class="svc-list">${bad.map(r => `<li>${esc(r.des || "")} — ${esc(r.u || "")}</li>`).join("")}</ul>
          ${touched.length ? `<div class="svc-sub">LIAISONS TOUCHÉES ${svCnt(touched.length)} (PRODUIT RETIRÉ ; SANS AUTRE PRODUIT, LA LIAISON EST DÉLIÉE) :</div><ul class="svc-list">${touched.map(l => `<li>${esc(tag(l))}</li>`).join("")}</ul>` : ""}` });
      shell.__nbrBusy = false;
      if (!go) { try { sessionStorage.setItem(skipK, bad.map(r => r.id).join(",")); } catch (e) {} return; }
      const V = (k, id) => (INS[k].find(x => x.id === id) || {});
      const items = [];
      bad.forEach(r => {
        const base = { type: "PRD", article: "", des: r.des || "", u: r.u || "", nbr: String(r.nbr ?? ""), d1: String(r.d1 ?? ""), d2: String(r.d2 ?? ""), d3: String(r.d3 ?? ""), q: "" };
        const ls = touched.filter(l => (l.prd || []).some(x => x.id === r.id));
        (ls.length ? ls : [null]).forEach(l => {
          const D = l ? V("des", l.des) : {};
          items.push({ id: insId(), on: false, bad: ["nbr"], why: "NBR VIDE OU 0", line: "",
            src: { art: l ? String(D.art || "") : "", dc: l ? D.des || "" : "", upb: l ? D.u || "" : "", lot: l ? V("lot", l.lot).v || "" : "", prim: l ? V("prim", l.prim).v || "" : "", sec: l ? V("sec", l.sec).v || "" : "", ...base } });
        });
      });
      INS.links = (INS.links || []).map(l => ({ ...l, prd: (l.prd || []).filter(x => !ids.has(x.id)) })).filter(l => (l.prd || []).length);
      INS.prd = INS.prd.filter(r => !ids.has(r.id));
      INS.inc = (INS.inc || []).concat(items);
      histLog("SAISIE", "PRODUITS SANS NBR", bad.length + " PRODUIT(S) → IMPORT NON CRÉÉ" + (touched.length ? " — " + touched.length + " LIAISON(S) TOUCHÉE(S)" : ""));
      insSave(); refreshAll();
    };
    if (INS && INS_EDIT) setTimeout(async () => { try { await dupExisting(); } catch (e) {} insNbrFix(); }, 600);
    /* LIGNES NON LIÉES (onglet du détail) : BLOC, LIBELLÉ ; cases à cocher, suppression par le menu ⋯ */
    const UNL_BLOC = { des: "DÉSIGNATION CLIENT", lot: "LOT", prim: "ACTIVITÉ PRIMAIRE", sec: "ACTIVITÉ SECONDAIRE", prd: "PRODUIT", chg: "CHARGE" };
    const insUnlRows = () => {
      const u = insUnlinked(), out = [];
      /* RÉF. : ART (désignations, charges) sinon numéro de la ligne dans son bloc */
      const pos = {};
      INS_LINKED_KINDS.forEach(k => { pos[k] = new Map(INS[k].filter(r => !r.t).map((r, i) => [r.id, i + 1])); });
      INS_LINKED_KINDS.forEach(k => u[k].forEach(r => out.push({ k, r, id: r.id,
        ref: ((k === "des" || k === "chg") && String(r.art || "").trim()) ? String(r.art).trim() : "N° " + (pos[k].get(r.id) || ""),
        bloc: UNL_BLOC[k], lib: (k === "lot" || k === "prim" || k === "sec") ? (r.v || "") : [r.art, r.des].filter(Boolean).join(" — ") + (r.u ? " (" + r.u + ")" : "") })));
      return out;
    };
    const insUnlHTML = () => {
      const UC = [["ref", "RÉF.", x => x.ref, "center"], ["bloc", "BLOC", x => x.bloc, ""], ["lib", "LIBELLÉ", x => x.lib, ""]];
      const W = { ref: 89, bloc: 469, lib: 709 };   /* FORMAT 113 */
      const oc = coOrder("lk_unl", UC);
      const w = k => cwLoad()["lk_unl." + k] || W[k] || 160;
      const rows = cfApply("lk_unl", UC, insUnlRows().sort((a, b) => natCmp(a.bloc, b.bloc) || natCmp(a.lib, b.lib)));
      lastShown.detail = { cols: UC, rows, kind: "unl" };
      const dw = INS_EDIT ? 40 : 0;
      /* FORMAT 119 : case propre à LIGNES NON LIÉES (r.uon), indépendante des cases des tableaux d'origine */
      const all = rows.length && rows.every(x => x.r.uon === true);
      return `<table class="bdg-d-table lk-table unl-table" style="width:${oc.reduce((t, c) => t + w(c[0]), 0) + dw}px">
        <colgroup>${oc.map(c => `<col data-w="lk_unl.${c[0]}" style="width:${w(c[0])}px">`).join("")}${dw ? `<col style="width:${dw}px">` : ""}</colgroup>
        <thead><tr>${oc.map(c => cfHead("lk_unl", c[0], c[1], c[3])).join("")}${dw ? `<th class="center"><input type="checkbox" class="unl-cball"${all ? " checked" : ""}></th>` : ""}</tr></thead>
        <tbody>${rows.map(x => `<tr data-uk="${x.k}" data-uid="${x.id}" class="unl-go" title="Aller à la ligne">${oc.map(c => `<td class="${c[3]}">${esc(c[2](x))}</td>`).join("")}${dw
          ? `<td class="center"><input type="checkbox" class="unl-cb"${x.r.uon === true ? " checked" : ""}></td>` : ""}</tr>`).join("")
          || `<tr><td colspan="${oc.length + (dw ? 1 : 0)}" class="empty">AUCUNE LIGNE</td></tr>`}</tbody></table>`;
    };
    if (!shell.__onlyBound) {
      shell.__onlyBound = true;
      shell.addEventListener("click", e => {
        const b = e.target.closest("[data-onlyc]");
        if (!b) return;
        e.stopPropagation(); e.preventDefault();
        const k = b.dataset.onlyc, O = shell.__onlyc;
        O[k] = !O[k];
        shell.__onlyRefresh && shell.__onlyRefresh();
      }, true);
    }
    shell.__onlyRefresh = () => refreshAll();
    if (!shell.__unlBound) {
      shell.__unlBound = true;
      shell.addEventListener("change", e => {
        const X = shell.__unl;
        if (!X) return;
        const cb = e.target.closest && e.target.closest("input.unl-cb, input.unl-cball");
        if (!cb) return;
        if (cb.classList.contains("unl-cball")) {
          cb.closest("table").querySelectorAll("tbody tr[data-uk]").forEach(tr => { const r = X.INS[tr.dataset.uk].find(x => x.id === tr.dataset.uid); if (r) r.uon = cb.checked; });
        } else {
          const tr = cb.closest("tr[data-uk]");
          const r = tr && X.INS[tr.dataset.uk].find(x => x.id === tr.dataset.uid);
          if (r) r.uon = cb.checked;
        }
        X.save(); X.refresh();
      });
    }
    shell.__unl = INS ? { INS, save: () => insSave(), refresh: () => refreshAll(),
      /* toucher une ligne : l'écran va à la ligne dans son bloc, encadrée un instant */
      go: (k, id) => {
        const find = () => shell.querySelector(`[data-ik="${k}"][data-iid="${id}"]`);
        const show = () => {
          const el = find();
          if (!el) { svToast("LIGNE CACHÉE (TITRE REPLIÉ OU FILTRE) : DÉPLIER OU EFFACER LE FILTRE."); return; }
          el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
          el.classList.remove("unl-flash"); void el.offsetWidth; el.classList.add("unl-flash");
          setTimeout(() => el.classList.remove("unl-flash"), 2200);
        };
        if (k === "prd" || k === "chg") {
          const b = shell.querySelector(`#bdgTabs .bdg-d-tab[data-tab="${k}"]`);
          if (b) b.click();
          setTimeout(show, 120);
        } else show();
      } } : null;
    if (!shell.__lnkCbBound) {
      shell.__lnkCbBound = true;
      shell.addEventListener("change", e => {
        const cb = e.target.closest && e.target.closest("input.lnk-cb");   /* v498 : tout cocher et lignes regroupées de MARGE : 22b */
        if (!cb || !shell.__unl) return;
        const L = shell.__unl.INS.links || [];
        const trs = cb.classList.contains("lnk-cball") ? [...cb.closest("table").querySelectorAll("tbody tr[data-lid]")] : [cb.closest("tr[data-lid]")];
        trs.forEach(tr => { const l = L.find(x => x.id === tr.dataset.lid); if (l) l.on = cb.checked; });
        shell.__unl.save(); shell.__unl.refresh();
      });
    }
    if (!shell.__unlGoBound) {
      shell.__unlGoBound = true;
      shell.addEventListener("click", e => {
        const tr = e.target.closest && e.target.closest("tr.unl-go");
        if (!tr || e.target.closest("input, .cf-btn") || !shell.__unl) return;
        shell.__unl.go(tr.dataset.uk, tr.dataset.uid);
      });
    }
    /* modification en attente : produits / charges choisis, ou délais changés et pas encore validés */
    const lkDlyDirty = () => {
      const D = LK.dlpDraft || {};
      const clean = l => JSON.stringify((l || []).map(p => [p.deb || "", p.fin || ""]).sort());
      return Object.keys(D).some(k => clean(D[k]) !== clean((INS.dlp || {})[k]));
    };
    /* que fait le bouton ? (consigne 37 : construire ET détruire passent par le bouton)
       - chaîne complète + produits / charges nouveaux, ou délais modifiés : ✓ VALIDER
       - sinon, les éléments choisis désignent des liaisons existantes : ✕ DÉLIER
         · produits / charges choisis : ils sont retirés des liaisons qui contiennent tous les éléments choisis
         · aucun produit / charge : ces liaisons sont détruites */
    const lkPlan = () => {
      const L = INS.links || [], keys = ["des", "lot", "prim", "sec"].filter(k => LK[k]);
      const P = Object.keys(LK.prd), C = Object.keys(LK.chg);
      const full = keys.length === 4;
      const anyAll = Object.values(LK.all || {}).some(Boolean);
      if (!keys.length && !P.length && !C.length && !anyAll) return { mode: "none" };
      const M = L.filter(l => keys.every(k => l[k] === LK[k]));
      const inM = (k, id) => M.some(l => (l[k] || []).some(x => x.id === id));
      const addP = P.filter(id => !inM("prd", id)), addC = C.filter(id => !inM("chg", id));
      const remP = P.filter(id => inM("prd", id)), remC = C.filter(id => inM("chg", id));
      const nAdd = addP.length + addC.length, nRem = remP.length + remC.length;
      if (nAdd && nRem) return { mode: "mix" };
      if (lkDlyDirty() && !nRem && (!nAdd || full)) return { mode: "add", full, same: full && M.length > 0 };
      if (nAdd) return full ? { mode: "add", full, same: M.length > 0 } : { mode: "incomplete" };
      if (nRem) {
        const hit = M.filter(l => (l.prd || []).some(x => remP.includes(x.id)) || (l.chg || []).some(x => remC.includes(x.id)));
        return { mode: "del", links: hit, remP, remC, n: hit.length };
      }
      if ((!keys.length && !anyAll) || !M.length) return { mode: "none" };
      return { mode: "del", links: M, remP: [], remC: [], n: M.length };
    };
    const lkPending = () => { const m = lkPlan().mode; return m === "add" || lkDlyDirty(); };
    /* bandeau CHAÎNE … ✓ VALIDER LA LIAISON (visible quand une désignation est choisie) */
    const insRenderChain = () => {
      const el = $("insChain");
      if (!el) return;
      el.hidden = false;
      /* la place est toujours réservée : rien ne bouge quand le bandeau apparaît */
      const any = INS_EDIT && (LK.des || LK.lot || LK.prim || LK.sec || Object.keys(LK.prd).length || Object.keys(LK.chg).length || Object.values(LK.all || {}).some(Boolean));
      el.classList.toggle("off", !any);
      if (!any) { el.innerHTML = '<button type="button" class="lk-go" disabled>✓ VALIDER LA LIAISON</button>'; return; }
      const pl = lkPlan();
      const nPrd = Object.keys(LK.prd).length;
      let btn;
      if (pl.mode === "del") btn = `<button type="button" class="lk-go lk-del-go">✕ DÉLIER (${pl.n})</button>`;
      else if (pl.mode === "add") {
        const ok = lkDlyDirty() || (pl.same || nPrd > 0);
        /* v474 : validation qui serait refusée (produit déjà dans la tâche, règle A / D…) → bouton grisé d'avance ; un toucher dit pourquoi */
        let why = "";
        if (ok && pl.full && (nPrd > 0 || Object.keys(LK.chg).length)) { try { why = lkCheck() || ""; } catch (e) { why = ""; } }
        if (why) btn = `<button type="button" class="lk-go lk-off" data-why="${esc(why)}">${pl.same || (!pl.full && lkDlyDirty()) ? "✓ VALIDER LES MODIFICATIONS" : "✓ VALIDER LA LIAISON"}</button>`;
        else btn = `<button type="button" class="lk-go" ${ok ? "" : "disabled"}>${pl.same || (!pl.full && lkDlyDirty()) ? "✓ VALIDER LES MODIFICATIONS" : "✓ VALIDER LA LIAISON"}</button>`;
      } else if (pl.mode === "mix") btn = `<button type="button" class="lk-go lk-mix">✓ VALIDER LA LIAISON</button>`;
      else btn = `<button type="button" class="lk-go" disabled>✓ VALIDER LA LIAISON</button>`;
      el.innerHTML = `${LK.des ? '<button type="button" class="lk-info" title="Voir la liaison" aria-label="Voir la liaison">i</button>' : ""}${btn}`;
    };
