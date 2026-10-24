    /* ===== PLANNING (v401) : MARGE, JALON, LOTS EN ARBORESCENCE (« / »), GANTT ===== */
    const dlyLotPath = name => String(name || "").split("/").map(x => x.trim()).filter(Boolean);
    /* une couleur par lot (FORMAT 91), partagée par toutes ses tâches */
    /* pas de rouge : le rouge est réservé aux tâches critiques */
    const DLY_PAL = ["#6fa8dc", "#93c47d", "#f6b26b", "#8e9fd6", "#76c5c0", "#c9a0dc", "#e8c468", "#9fb7c9", "#a8d5a2", "#8db3e2", "#d7b98e", "#7fc3e0"];
    /* v518 : couleur FIXE par lot — donnée une fois (celle de son rang à ce moment-là, donc les couleurs actuelles ne changent pas),
       puis gardée dans le budget (INS.lcol) : déplacer un lot ne change plus sa couleur */
    const dlyLotColor = lotId => {
      INS.lcol = INS.lcol || {};
      let c = INS.lcol[lotId];
      if (c === undefined) {
        const i = INS.lot.filter(x => !x.t).findIndex(x => x.id === lotId);
        c = INS.lcol[lotId] = Math.max(0, i) % DLY_PAL.length;
        /* enregistrée avec la prochaine modification du budget (pas d'étape d'annulation pour une simple couleur) */
      }
      return DLY_PAL[c % DLY_PAL.length];
    };
    /* MARGE = jours travaillés dont la tâche peut glisser sans repousser la fin du chantier (calcul au plus tard) */
    const dlyMarges = keys => {
      const cal = insCal();
      const dated = keys.filter(k => dlyDeb(k) && dlyFin(k));
      const end = dated.map(dlyFin).sort().pop() || "";
      const dur = k => sviWDur(cal, dlyDeb(k), dlyFin(k)) || 1;
      const succ = {};
      keys.forEach(k => dlyLinks(k).forEach(l => { (succ[l.k] = succ[l.k] || []).push({ s: k, t: l.t, o: Math.max(0, Number(l.o) || 0) }); }));
      const LS = {};
      dated.forEach(k => { LS[k] = sviWDeb(cal, end, dur(k)); });
      for (let it = 0; it < dated.length + 2; it++) {
        let ch = false;
        dated.forEach(k => {
          let ls = sviWDeb(cal, end, dur(k));
          (succ[k] || []).forEach(x => {
            if (!LS[x.s]) return;
            const c = x.t === "DD" ? sviWAdd(cal, LS[x.s], -x.o) : sviWDeb(cal, sviWAdd(cal, LS[x.s], -(1 + x.o)), dur(k));
            if (c < ls) ls = c;
          });
          if (ls !== LS[k]) { LS[k] = ls; ch = true; }
        });
        if (!ch) break;
      }
      const M = {};
      dated.forEach(k => { const d0 = dlyDeb(k); M[k] = LS[k] <= d0 ? 0 : sviWDur(cal, d0, LS[k]) - 1; });
      return M;
    };
    /* repli des lots (› replié / ⌄ déplié), mémorisé par projet */
    const dlyFoldAll = () => { try { return JSON.parse(localStorage.getItem("svi_lotfold_v1") || "{}") || {}; } catch (e) { return {}; } };
    const dlyFoldK = p => (budget.project || "") + "|" + p;
    const dlyIsFolded = p => !!dlyFoldAll()[dlyFoldK(p)];
    /* v512 (remarque 76) : première ouverture d'un budget — niveaux de LOT pliés (état mémorisé ensuite) */
    if (INS && INS.lot) {
      const f0 = dlyFoldAll(), mk = (budget.project || "") + "|__init__";
      if (!f0[mk]) {
        const paths = new Set();
        INS.lot.forEach(r => { const sg = String(r.v || "").split("/").map(x => x.trim()).filter(Boolean); for (let i = 1; i < sg.length; i++) paths.add(sg.slice(0, i).join(" / ")); });
        paths.forEach(p => { f0[dlyFoldK(p)] = 1; });
        f0[mk] = 1;
        try { localStorage.setItem("svi_lotfold_v1", JSON.stringify(f0)); } catch (e) {}
      }
    }
    /* v461 : branche ISOLÉE (lot ou niveau) — pour ce budget, jusqu'à TOUT AFFICHER */
    const dlyIsoPath = () => { const o = shell.__dlyIso; if (!o || o.ref !== DLYG_REF) return ""; const P = U_(o.path); return INS.lot.some(x => !x.t && (U_(x.v) === P || U_(x.v).startsWith(P + " / "))) ? o.path : ""; };
    const dlyFoldToggle = p => { const f = dlyFoldAll(), k = dlyFoldK(p); if (f[k]) delete f[k]; else f[k] = 1; try { localStorage.setItem("svi_lotfold_v1", JSON.stringify(f)); } catch (e) {} };
    /* ordre des lignes du PLANNING : gardé tel quel (glissement d'une barre compris) ; classé par DÉBUT à l'import,
       après GÉNÉRER LE PLANNING et par le bouton CLASSER PAR DÉBUT */
    const dlyByDeb = keys => [...keys].sort((a, b) => String(dlyDeb(a) || "9").localeCompare(String(dlyDeb(b) || "9")) || natCmp(dlyName(a), dlyName(b)));
    const dlyOrder = keys => {
      const K = new Set(keys);
      const cur = (INS.dord || []).filter(k => K.has(k));
      /* tâche nouvelle : juste après la dernière tâche de son lot (sinon à la fin) */
      dlyByDeb(keys.filter(k => !cur.includes(k))).forEach(k => { const lo = k.split("|")[0]; let i = -1; cur.forEach((c, j) => { if (c.split("|")[0] === lo) i = j; }); if (i < 0) cur.push(k); else cur.splice(i + 1, 0, k); });
      INS.dord = cur;
      return new Map(INS.dord.map((k, i) => [k, i]));
    };
    /* R29 : affichage PAR LOT (ordre enregistré) ou PAR DÉBUT (vue en escalier, rien n'est enregistré), mémorisé par budget */
    const dlyViewAll = () => { try { return JSON.parse(localStorage.getItem("svi_dlyview_v1") || "{}") || {}; } catch (e) { return {}; } };
    const dlyView = () => dlyViewAll()[DLYG_REF] === "d" ? "d" : "l";
    const dlyViewSet = v => { const A = dlyViewAll(); if (v === "d") A[DLYG_REF] = "d"; else delete A[DLYG_REF]; try { localStorage.setItem("svi_dlyview_v1", JSON.stringify(A)); } catch (e) {} };
    /* un seul ordre (cahier, Planning budgétaire) : PLANNING → bloc TÂCHES — lots dans l'ordre de leur première tâche,
       activités secondaires dans l'ordre de leur première tâche, activités primaires dans l'ordre de leur première
       activité secondaire ; lignes hors planning à la suite, dans leur ordre */
    const dlyTasksFromPlan = () => {
      if (!INS || !INS_EDIT) return;
      const keys = [...dlyOrder(dlyKeys()).keys()];
      const uniq = a => [...new Set(a.filter(Boolean))];
      const lots = uniq(keys.map(k => k.split("|")[0])), secs = uniq(keys.map(k => k.split("|")[1]));
      const prims = uniq(keys.flatMap(k => (INS.links || []).filter(l => l.lot + "|" + l.sec === k).map(l => l.prim)));
      const rank = (arr, ids) => {
        if (!arr) return;
        const pos = new Map(ids.map((id, i) => [id, i]));
        const inP = arr.filter(r => pos.has(r.id)).sort((a, b) => pos.get(a.id) - pos.get(b.id)), rest = arr.filter(r => !pos.has(r.id));
        arr.splice(0, arr.length, ...inP, ...rest);
      };
      rank(INS.lot, lots); rank(INS.sec, secs); rank(INS.prim, prims);
    };
    /* bloc TÂCHES → PLANNING : lots (et activités secondaires) glissés dans TÂCHES rangent aussi le planning */
    const dlyPlanFromTasks = k => {
      if (!INS || !INS_EDIT || (k !== "lot" && k !== "sec")) return;
      const keys = [...dlyOrder(dlyKeys()).keys()];
      const li = new Map(INS.lot.map((r, i) => [r.id, i])), si = new Map(INS.sec.map((r, i) => [r.id, i])), o = new Map(keys.map((x, i) => [x, i]));
      INS.dord = keys.slice().sort((a, b) => {
        const [la, sa] = a.split("|"), [lb, sb] = b.split("|");
        return (li.get(la) ?? 1e9) - (li.get(lb) ?? 1e9) || (k === "sec" ? (si.get(sa) ?? 1e9) - (si.get(sb) ?? 1e9) : 0) || o.get(a) - o.get(b);
      });
    };
    /* lignes du PLANNING : lots (et sous-lots « / ») puis leurs tâches, dans l'ordre des lignes */
    const dlyPlanRows = () => {
      const keys = dlyKeys(), M = dlyMarges(keys), J = INS.jal || {};
      const P = keys.map(k => { const d0 = dlyDeb(k), f0 = dlyFin(k); const [lo, se] = k.split("|");
        const p1 = dlyList(k).length === 1 ? dlyList(k)[0] : null;
        /* v547 (R22) : morceaux d'une tâche coupée */
        const per = dlyList(k).length > 1 ? dlyList(k).filter(p => p.deb && p.fin).map(p => ({ deb: p.deb, fin: p.fin, hs: dlyHalfS(p), he: dlyHalfE(p) })) : null;
        return { key: k, lo, lot: lkName("lot", lo), sec: lkName("sec", se), pred: dlyPredTxt(k), succ: dlySuccTxt(k), per, deb: d0, fin: f0, dur: dlyDurK(k), hs: dlyHalfS(p1), he: dlyHalfE(p1),
          marge: M[k] === undefined ? "" : M[k], jal: J[k] ? "★" : "" }; });
      /* ordre libre des lignes (INS.dord) ; une tâche nouvelle se place à la fin */
      const O = dlyOrder(keys), VD = dlyView() === "d";
      /* R29 : vue PAR DÉBUT — toutes les tâches par date de début (sans dates : à la fin, dans l'ordre enregistré) ; rien n'est enregistré */
      if (VD) { const B = new Map(dlyByDeb(keys).map((k, i) => [k, i])); P.sort((a, b) => (a.deb ? 0 : 1) - (b.deb ? 0 : 1) || (a.deb ? B.get(a.key) - B.get(b.key) : O.get(a.key) - O.get(b.key))); }
      else P.sort((a, b) => O.get(a.key) - O.get(b.key));
      /* R15 (23/10/2026) : cases cochées des autres blocs → les tâches non liées restent à leur place, en gris pâle (remplace v496) */
      const CLd = insCheckLinks("dly"), KD = CLd ? new Set(CLd.map(l => l.lot + "|" + l.sec)) : null;
      const flat = cfApply("dlyp", DLY_COLS_P, P).map(t => KD && !KD.has(t.key) ? { ...t, off: true } : t);
      /* R16 (23/10/2026) : lignes dans l'ordre du PLANNING, tâche par tâche (CLASSER PAR DÉBUT ne regroupe plus par lot) ;
         le titre d'un lot (et de chacun de ses niveaux) se place à la ligne de sa première tâche ; un lot replié ne cache que ses tâches */
      const G = new Map();
      flat.forEach(t => { const sg = dlyLotPath(t.lot); for (let j = 1; j <= sg.length; j++) { const p = sg.slice(0, j).join(" / "); if (!G.has(p)) G.set(p, { name: sg[j - 1], path: p, all: [] }); G.get(p).all.push(t); } });
      const out = [], seen = new Set();
      const anc = sg => { for (let i = 1; i < sg.length; i++) if (dlyIsFolded(sg.slice(0, i).join(" / "))) return true; return false; };
      const within = (x, p) => !!x && (x === p || x.startsWith(p + " / "));
      let ctx = null;
      flat.forEach(t => {
        const sg = dlyLotPath(t.lot), own = sg.join(" / ");
        for (let j = 1; j <= sg.length; j++) {
          const p = sg.slice(0, j).join(" / ");
          if (seen.has(p)) continue;
          seen.add(p);
          if (anc(sg.slice(0, j))) continue;
          const g = G.get(p), ds = g.all.map(x => x.deb).filter(Boolean).sort(), fs = g.all.map(x => x.fin).filter(Boolean).sort();
          const d0 = ds[0] || "", f0 = fs[fs.length - 1] || "";
          /* niveau placé hors du bloc de son parent : affiché seul à sa place (v461) */
          const det = j > 1 && !within(ctx, sg.slice(0, j - 1).join(" / "));
          out.push({ grp: true, lvl: j - 1, name: g.name, path: p, fold: dlyIsFolded(p), det, lab: lotLab(sg.slice(0, j)), deb: d0, fin: f0, dur: d0 && f0 ? dDur(d0, f0) : "", all: g.all });
          ctx = p;
        }
        if (anc(sg.concat("·"))) return;
        /* tâche placée plus bas que des tâches d'un autre lot (après CLASSER PAR DÉBUT) : pastille de la couleur de son lot (FORMAT 119) */
        out.push({ ...t, lvl: sg.length, away: !!ctx && !within(ctx, own), vno: VD ? lotLab(sg).no : "" });
        ctx = own;
      });
      /* v461 : ISOLER une branche — seules ses lignes restent, plus les tâches liées hors de la branche (gris, lecture seule) */
      const iso = dlyIsoPath();
      if (iso) {
        const IP = dlyLotPath(iso).map(U_);
        const inB = p => { const sg = dlyLotPath(p).map(U_); return sg.length >= IP.length && IP.every((g, i) => g === sg[i]); };
        const kept = out.filter(x => inB(x.grp ? x.path : x.lot));
        if (kept.length) {
          const K = new Set(kept.filter(x => !x.grp).map(x => x.key));
          const ext = new Set();
          K.forEach(k => dlyLinks(k).forEach(l => { if (!K.has(l.k)) ext.add(l.k); }));
          keys.forEach(k => { if (!K.has(k) && dlyLinks(k).some(l => K.has(l.k))) ext.add(k); });
          const minL = Math.min(...kept.map(x => x.lvl));
          const rows = kept.map(x => ({ ...x, lvl: x.lvl - minL }));
          flat.filter(t => ext.has(t.key)).forEach(t => rows.push({ ...t, lvl: 0, ext: true }));
          return { rows, flat, iso };
        }
      }
      return { rows: out, flat };
    };
    /* ajout d'une liaison (geste sur le Gantt) : pred → succ, FIN → DÉBUT ou DÉBUT → DÉBUT, décalage 0 */
    const dlyAddLink = (pred, succ, t, anchor) => {
      if (!pred || !succ || pred === succ) return;
      if (dlyReach(pred, succ)) { svToast("LIAISON IMPOSSIBLE : ELLE FERAIT UNE BOUCLE.", 3500, anchor); return; }
      INS.dpred = INS.dpred || {};
      const L = INS.dpred[succ] = (INS.dpred[succ] || []).map(x => typeof x === "string" ? { k: x, t: "FD", o: 0 } : x);
      if (L.some(x => x.k === pred)) { dlyLinkWin(pred, succ); return; }
      L.push({ k: pred, t, o: t === "FD" ? 1 : 0 });   /* v544 : FIN → DÉBUT créée au doigt = le lendemain */
      insSave();
      histLog("DÉLAIS", "LIAISON", dlyName(pred) + " → " + dlyName(succ) + " (" + (t === "DD" ? "DÉBUT → DÉBUT" : "FIN → DÉBUT") + ")");
      dlyAfterLink(succ);
    };
    /* après une liaison créée ou changée : la tâche suivante commence trop tôt → proposer de la décaler */
    const dlyAfterLink = (succ, glued) => {
      const pf = dlyPredFin(succ), st = dlyDeb(succ);
      const go = () => { renderTab(); insRenderChain(); };
      if (pf && st && glued && st !== pf) { dlyMoveTo(succ, pf); dlyShift(succ, dlyGlued(succ)); go(); return; }
      /* liaison toujours respectée : la tâche suivante (et ses suivantes) est décalée aussitôt, sans fenêtre */
      if (pf && st && st < pf) dlyRespect(true);
      go();
    };
    /* fenêtre LIAISON (FORMAT 96) : TYPE, DÉCALAGE (J) ≥ 0, ✕ DÉLIER */
    const dlyLinkWin = (pred, succ) => {
      const L = dlyLinks(succ), l = L.find(x => x.k === pred);
      if (!l) return;
      const d = document.createElement("div");
      d.id = "svConf";
      d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true">
        <button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
        <div class="svc-t">LIAISON</div>
        <div class="svc-sub">${esc(dlyName(pred))} → ${esc(dlyName(succ))}</div>
        <div class="bdt-row"><span>TYPE</span><select class="lkw-t"><option value="FD"${l.t !== "DD" ? " selected" : ""}>FIN → DÉBUT</option><option value="DD"${l.t === "DD" ? " selected" : ""}>DÉBUT → DÉBUT</option></select></div>
        <div class="bdt-row"><span>DÉCALAGE (J)</span><input class="lkw-o" inputmode="numeric" value="${Math.max(0, Number(l.o) || 0)}"></div>
        <div class="svc-sub lkw-hint">FIN → DÉBUT : 0 = LE JOUR MÊME OÙ FINIT LA PRÉCÉDENTE, 1 = LE LENDEMAIN, 2 = UN JOUR LIBRE ENTRE LES DEUX.</div>
        <div class="svc-f"><button type="button" class="svc-b svc-ok lkw-del">✕ DÉLIER</button><span style="flex:1"></span><button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button></div></div>`;
      document.getElementById("svConf")?.remove();
      document.body.appendChild(d);
      d.addEventListener("click", e => {
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
        if (e.target.closest(".lkw-del")) {
          /* FORMAT 96 : liaison du planning déliée sans confirmation : le fil disparaît (pas de message de fin, FORMAT 32) */
          d.remove();
          INS.dpred[succ] = dlyLinks(succ).filter(x => x.k !== pred);
          if (!INS.dpred[succ].length) delete INS.dpred[succ];
          insSave(); histLog("DÉLAIS", "LIAISON DÉLIÉE", dlyName(pred) + " → " + dlyName(succ));
          renderTab(); insRenderChain();
          return;
        }
        if (!e.target.closest("[data-ok]")) return;
        const ov = String(d.querySelector(".lkw-o").value).trim();
        if (!/^\d*$/.test(ov)) { svToast("DÉCALAGE NON VALIDE : NOMBRE DE JOURS ≥ 0.", 3500, d.querySelector(".lkw-o")); return; }
        const glued = dlyPredFin(succ) && dlyDeb(succ) === dlyPredFin(succ);
        const n = dlyLinks(succ).map(x => x.k === pred ? { k: pred, t: d.querySelector(".lkw-t").value === "DD" ? "DD" : "FD", o: Number(ov || 0) } : x);
        INS.dpred[succ] = n;
        d.remove();
        insSave(); histLog("DÉLAIS", "LIAISON", dlyName(pred) + " → " + dlyName(succ) + " : " + dlyLinkTxt(n.find(x => x.k === pred)));
        dlyAfterLink(succ, glued);
      });
    };
    /* mise à jour des dates d'une tâche (saisie, Gantt) : mêmes contrôles partout ; débordement → TÂCHES SUIVANTES */
    const dlyApply = (task, q0, opts = {}) => {
      const cal = insCal(), anchor = opts.anchor;
      const L = dlyDraftKey(task);
      let p = L[0];
      const q = { ...(p || { id: insId() }), deb: q0.deb || "", fin: q0.fin || "" };
      let err = "";
      if (q.deb && !sviWork(cal, q.deb)) err = "DÉBUT SUR UN JOUR NON TRAVAILLÉ DU CALENDRIER DU BUDGET.";
      else if (q.fin && !sviWork(cal, q.fin)) err = "FIN SUR UN JOUR NON TRAVAILLÉ DU CALENDRIER DU BUDGET.";
      else if (q.deb && q.fin && q.fin < q.deb) err = "LA FIN EST AVANT LE DÉBUT.";
      else if (q.fin && INS.dbut && q.fin > INS.dbut) err = "FIN REFUSÉE : APRÈS LA DATE BUTOIR DU " + dFr(INS.dbut) + ".";
      else if (q.deb) { const pf = dlyPredFin(task); if (pf && q.deb < pf) err = "DÉBUT REFUSÉ : LES LIAISONS IMPOSENT LE " + dFr(pf) + " AU PLUS TÔT."; }
      const draw = () => { renderTab(); insRenderChain(); };
      if (err) { svToast(err, 4000, anchor); draw(); return false; }
      const durOld = p && p.deb && p.fin ? sviWDur(cal, p.deb, p.fin) : 0;
      const glued = dlyGlued(task), back = p ? { ...p } : null, inc0 = dlyInc(task);
      if (p) Object.assign(p, q); else if (q.deb || q.fin) { L.splice(0, L.length, q); p = q; }
      /* R3 : date ou durée changée à la main = tâche INCOMPRESSIBLE */
      if (q.deb && q.fin) dlyIncSet(task, true);
      const undo = () => { if (back) Object.assign(p, back); else L.splice(0, L.length); if (!inc0) dlyIncSet(task, false); };
      /* v517 : une tâche suivante « collée » (elle commençait pile à la date exigée) suit toute seule (dlyShift plus bas) :
         ce n'est pas un conflit, pas de fenêtre. Seules les autres, qui commencent trop tôt, sont signalées. */
      const late = dlySuccs(task).filter(S => { if (glued.has(S)) return false; const n = dlyPredFin(S), d0 = dlyDeb(S); return n && d0 && d0 < n; });
      /* v517 : tâche suivante absente du planning affiché (filtre, branche isolée, lot replié) — dit dans la fenêtre */
      const shown = new Set((shell.__dlyRows || []).filter(x => !x.grp).map(x => x.key));
      const hidTxt = k => shown.size && !shown.has(k) ? " (MASQUÉE À L'ÉCRAN : FILTRE OU LOT REPLIÉ)" : "";
      if (late.length) {
        const fromDur = opts.fromDur || (durOld && q.deb && q.fin && sviWDur(cal, q.deb, q.fin) !== durOld);
        const maxFin = dlySuccs(task).map(S => { const l = dlyLinks(S).find(x => x.k === task), d0 = dlyDeb(S);
          return l && l.t !== "DD" && d0 ? sviWAdd(cal, d0, -Math.max(0, l.o || 0)) : ""; }).filter(Boolean).sort()[0] || "";
        const canCut = fromDur && maxFin && q.deb && maxFin >= q.deb;
        svChoose({ title: "TÂCHES SUIVANTES", html: `<div class="svc-sub">LA FIN DU ${esc(dFr(q.fin))} NE RESPECTE PLUS LA LIAISON AVEC :</div><ul class="svc-list">${late.map(k => `<li>${esc(dlyName(k))} — DÉBUT ${esc(dFr(dlyDeb(k)))}, AU PLUS TÔT ${esc(dFr(dlyPredFin(k)))}${esc(hidTxt(k))}</li>`).join("")}</ul>`,
          buttons: [...(canCut ? [{ v: "cut", label: "RÉDUIRE LA DURÉE", tone: "neutral" }] : []), { v: "shift", label: "DÉCALER LES TÂCHES SUIVANTES", tone: "neutral" }] }).then(r => {
          if (r === "shift") { const mv = dlyShift(task, glued); if (mv.length) svToast(mv.length + " TÂCHE(S) DÉCALÉE(S) — À VALIDER.", 3000); }
          else if (r === "cut") { p.fin = maxFin; if (glued.size) dlyShift(task, glued); }
          else undo();
          draw();
        });
        draw();
        return false;
      }
      if (glued.size) dlyShift(task, glued);
      draw();
      return true;
    };
    /* GANTT (FORMAT 90 à 96) : à droite du tableau du PLANNING, lignes alignées ; jours en abscisse */
    /* largeur d'un jour du Gantt (FORMAT 91) : réglable en glissant sur l'en-tête ou en pinçant, 14 à 60 px, mémorisée */
    /* affichage du Gantt (FORMAT 91, 97) : JOUR / SEMAINE / MOIS — largeur d'un jour propre à chaque affichage, mémorisée */
    const DLY_SC = { j: { min: 14, max: 100, def: 22, k: "svi_dlyg_dw_v1", fit: 1 }, s: { min: 4, max: 100, def: 9, k: "svi_dlyg_dw_s_v1", fit: 1 }, m: { min: 1, max: 100, def: 2, k: "svi_dlyg_dw_m_v1", fit: 1 } };
    const dlyScale = () => { let v = "j"; try { v = localStorage.getItem("svi_dlyg_sc_v1") || "j"; } catch (e) {} return DLY_SC[v] ? v : "j"; };
    /* v546 (R17) : choix JOUR / SEMAINE / MOIS dans la fenêtre CALENDRIER DU BUDGET ; SEMAINE et MOIS partent de la largeur qui remplit l'écran (R23) */
    window.__sviDlyScale = { get: () => dlyScale(), set: v => { const c = DLY_SC[v]; if (!c) return; try { localStorage.setItem(c.k, "fit"); localStorage.setItem("svi_dlyg_sc_v1", v); } catch (e) {} keepScroll(() => renderTab()); } };
    let DLY_DW_MIN = DLY_SC[dlyScale()].min, DLY_DW_MAX = DLY_SC[dlyScale()].max;
    /* v546 (R23, R34) : maximum = 100 px par jour, ou plus si c'est la largeur qui remplit l'écran ; « fit » = remplir (départ en SEMAINE / MOIS) */
    let DLY_FILL = 0;
    const dlyDwGet = () => {
      const c = DLY_SC[dlyScale()]; DLY_DW_MIN = c.min; DLY_DW_MAX = Math.max(100, DLY_FILL);
      let s0 = null; try { s0 = localStorage.getItem(c.k); } catch (e) {}
      /* v559 : changer d'échelle (JOUR / SEMAINE / MOIS) = « fit » : tout le projet dans la largeur visible, trait FIN au bord droit
         (largeur d'un jour non arrondie) ; à l'ouverture, le dernier zoom réglé au doigt est repris */
      DLY_DW_MIN = Math.max(c.min, DLY_FILL || 0);   /* v553 (P11 R2) : jamais plus étroit que la largeur qui remplit le Gantt */
      if ((s0 === null || s0 === "fit") && DLY_FILL) return Math.min(DLY_DW_MAX, DLY_FILL);
      const v = Number(s0) || c.def;
      return Math.max(DLY_DW_MIN, Math.min(DLY_DW_MAX, Math.round(v)));
    };
    let DLY_DW = dlyDwGet();
    /* hauteur des lignes du PLANNING (tableau et Gantt) : pincement vertical à deux doigts ; 24 px au moins (taille d'origine), 64 au plus */
    const DLY_RH_KEY = "svi_dly_rh_v1";
    const dlyRhGet = () => { const v = Number(localStorage.getItem(DLY_RH_KEY)); return v >= 24 && v <= 64 ? v : 24; };
    const dlyBh = rh => Math.round(11 + (rh - 24) * 0.5);   /* épaisseur des barres : 11 px à 24, 31 px à 64 */
    const dlyRhApply = rh => { shell.style.setProperty("--dly-rh", rh + "px"); shell.style.setProperty("--gbh", dlyBh(rh) + "px"); };
    /* largeur d'un intitulé dans la barre (police des barres : 9 px, gras) */
    const dlyTxtW = t => {
      const c = dlyTxtW.c || (dlyTxtW.c = document.createElement("canvas").getContext("2d"));
      if (!dlyTxtW.f) dlyTxtW.f = "700 9px " + (getComputedStyle(document.body).fontFamily || "sans-serif");
      c.font = dlyTxtW.f;
      return c.measureText(String(t || "").toUpperCase()).width;
    };
