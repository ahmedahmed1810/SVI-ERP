    /* ===== PLANNING (FORMAT 94) : prédécesseurs (plusieurs, communs à toutes les périodes de la tâche) ;
       une tâche commence au plus tôt le jour de la fin de tous ses prédécesseurs ===== */
    const dlyName = key => { const [lo, se] = String(key).split("|"); return lkName("lot", lo) + " › " + lkName("sec", se); };
    /* liaisons typées : { k, t: FD | DD, o } (cahier, Planning budgétaire, Liaisons) */
    const dlyLinks = key => ((INS.dpred || {})[key] || []).map(x => typeof x === "string" ? { k: x, t: "FD", o: 1 } : x);
    const dlyPreds = key => dlyLinks(key).map(x => x.k);
    const dlySuccs = key => Object.keys(INS.dpred || {}).filter(k => dlyLinks(k).some(x => x.k === key));
    const dlyLinkTxt = x => (x.t === "DD" ? "DD" : "FD") + "+" + (x.o || 0);
    /* PRÉDÉCESSEURS affichés : « LOT › ACTIVITÉ SECONDAIRE », avec le type et le décalage s'ils ne sont pas FIN → DÉBUT + 0 */
    const dlyPredTxt = k => dlyLinks(k).map(x => dlyName(x.k) + (x.t === "DD" ? (x.o ? " (DÉBUT → DÉBUT + " + x.o + " J)" : " (DÉBUT → DÉBUT)") : (x.o || 0) === 1 ? "" : " (FIN → DÉBUT" + (!(x.o > 0) ? ", MÊME JOUR" : " + " + x.o + " J") + ")")).join(" ; ");
    /* v546 (R27) : SUCCESSEURS affichés (lecture seule), avec le type de la liaison */
    const dlySuccTxt = k => dlySuccs(k).map(s2 => { const x = dlyLinks(s2).find(y => y.k === k) || {}; return dlyName(s2) + " (" + (x.t === "DD" ? "DÉBUT → DÉBUT" : "FIN → DÉBUT") + ")"; }).join(" ; ");
    const dlyList = key => (LK.dlpDraft && LK.dlpDraft[key]) || (INS.dlp || {})[key] || [];
    const dlyFin = key => dlyList(key).map(p => p.fin).filter(Boolean).sort().pop() || "";
    const dlyDeb = key => dlyList(key).map(p => p.deb).filter(Boolean).sort()[0] || "";
    /* date de début la plus tôt permise par les liaisons (la plus tardive des exigences) :
       FIN → DÉBUT : jour travaillé suivant la fin du prédécesseur + décalage ; DÉBUT → DÉBUT : début du prédécesseur + décalage */
    const dlyNeedOf = (key, finOf, debOf) => {
      const cal = insCal();
      return dlyLinks(key).map(x => {
        if (x.t === "DD") { const d0 = debOf(x.k); return d0 ? sviWAdd(cal, sviWNear(cal, d0, 1), Math.max(0, x.o || 0)) : ""; }
        /* v544 : FIN → DÉBUT, décalage 0 = le jour même où finit le prédécesseur, 1 = le lendemain… (jamais négatif) */
        const f0 = finOf(x.k); return f0 ? sviWAdd(cal, f0, Math.max(0, x.o || 0)) : "";
      }).filter(Boolean).sort().pop() || "";
    };
    const dlyPredFin = key => dlyNeedOf(key, dlyFin, dlyDeb);
    /* la tâche k est-elle (de proche en proche) un prédécesseur de c ? (boucle interdite) */
    const dlyReach = (c, k, seen = new Set()) => { if (c === k) return true; if (seen.has(c)) return false; seen.add(c); return dlyPreds(c).some(x => dlyReach(x, k, seen)); };
    const dlyDraftKey = key => { LK.dlpDraft = LK.dlpDraft || {}; if (!LK.dlpDraft[key]) LK.dlpDraft[key] = ((INS.dlp || {})[key] || []).map(p => ({ ...p })); return LK.dlpDraft[key]; };
    /* placer une tâche à un nouveau début en gardant sa durée (jours travaillés) */
    const dlyMoveTo = (k, deb) => {
      const cal = insCal(), L = dlyDraftKey(k), p = L[0];
      if (!p || !p.deb) return;
      if (L.length > 1) { dlyShiftList(L, deb); return; }
      const dur = p.fin ? sviWDur(cal, p.deb, p.fin) || 1 : 0;
      p.deb = sviWNear(cal, deb, 1);
      if (dur) p.fin = sviWFin(cal, p.deb, dur);
    };
    /* v547 (R22) : décaler tous les morceaux d'une tâche (durées et creux gardés, jours travaillés) pour que le premier commence à deb */
    const dlyShiftList = (L, deb) => {
      const cal = insCal(); if (!L.length || !L[0].deb) return;
      const a0 = sviWNear(cal, L[0].deb, 1), nd = sviWNear(cal, deb, 1);
      const w = nd >= a0 ? (sviWDur(cal, a0, nd) || 1) - 1 : -((sviWDur(cal, nd, a0) || 1) - 1);
      if (!w) return;
      L.forEach(p => {
        if (!p.deb) return;
        const dur = p.fin ? sviWDur(cal, p.deb, p.fin) || 1 : 0, hs = p.dmd === p.deb, he = p.fin && p.fmd === p.fin;
        p.deb = sviWAdd(cal, sviWNear(cal, p.deb, 1), w); p.fin = dur ? sviWFin(cal, p.deb, dur) : "";
        if (hs) p.dmd = p.deb; else delete p.dmd;
        if (he) p.fmd = p.fin; else delete p.fmd;
      });
    };
    /* liaisons toujours respectées (cahier, Planning budgétaire) : toute tâche qui commence avant la date exigée
       par ses liaisons est décalée à cette date (durée gardée, jours travaillés), de proche en proche ;
       dates enregistrées aussitôt (brouillon compris) et inscrites dans l'historique. Renvoie le nombre de tâches décalées */
    const dlyRespect = (save) => {
      const cal = insCal(), moved = new Map();
      let pass = 0, ch = true;
      while (ch && pass++ < 60) {
        ch = false;
        dlyKeys().forEach(k => {
          const need = dlyPredFin(k), L = dlyList(k), p0 = L[0];
          if (!need || !p0 || !p0.deb || p0.deb >= need) return;
          const dur = p0.fin ? sviWDur(cal, p0.deb, p0.fin) || 1 : 0, deb = sviWNear(cal, need, 1), fin = dur ? sviWFin(cal, deb, dur) : p0.fin;
          if (!moved.has(k)) moved.set(k, p0.deb);
          INS.dlp = INS.dlp || {};
          if (L.length > 1) { const nl = L.map(p => ({ ...p })); dlyShiftList(nl, deb); INS.dlp[k] = nl; if (LK.dlpDraft && LK.dlpDraft[k]) LK.dlpDraft[k] = nl.map(p => ({ ...p })); ch = true; return; }
          const np = { id: p0.id || insId(), deb, fin: fin || "" };
          INS.dlp[k] = [np];
          if (LK.dlpDraft && LK.dlpDraft[k]) LK.dlpDraft[k] = [{ ...LK.dlpDraft[k][0], deb, fin: fin || "" }];
          ch = true;
        });
      }
      moved.forEach((d0, k) => histLog("DÉLAIS", "LIAISON RESPECTÉE", dlyName(k) + " : DÉBUT " + dFr(d0) + " → " + dFr(dlyDeb(k))));
      if (moved.size && save) insSave();
      return moved.size;
    };
    /* tâches « collées » : celles qui commencent exactement à la date exigée par leurs liaisons ;
       elles suivent leur prédécesseur dans les deux sens (le décalage est une relation) */
    const dlyGlued = from => {
      const out = new Set(), q = [from];
      let guard = 0;
      while (q.length && guard++ < 2000) {
        const k = q.shift();
        dlySuccs(k).forEach(S => { if (out.has(S)) return; const n = dlyPredFin(S), st = dlyDeb(S); if (n && st && st === n) { out.add(S); q.push(S); } });
      }
      return out;
    };
    /* décaler les tâches suivantes (durées gardées, en jours travaillés) : une tâche qui commence avant la date
       exigée par ses liaisons recule jusqu'à cette date ; une tâche collée suit dans les deux sens */
    const dlyShift = (from, glued = new Set()) => {
      const q = [from], moved = [];
      let guard = 0;
      while (q.length && guard++ < 2000) {
        const k = q.shift();
        dlySuccs(k).forEach(S => {
          const need = dlyPredFin(S), st = dlyDeb(S);
          if (need && st && (st < need || (glued.has(S) && st !== need))) {
            dlyMoveTo(S, need);
            if (!moved.includes(S)) moved.push(S);
            q.push(S);
          }
        });
      }
      return moved;
    };
    /* tâches à afficher dans le planning : liées, avec périodes ou avec prédécesseurs */
    const dlyKeys = () => {
      const S = new Set();
      (INS.links || []).forEach(l => S.add(l.lot + "|" + l.sec));
      Object.keys(INS.dlp || {}).forEach(k => { if ((INS.dlp[k] || []).length) S.add(k); });
      Object.keys(LK.dlpDraft || {}).forEach(k => { if ((LK.dlpDraft[k] || []).length) S.add(k); });
      Object.keys(INS.dpred || {}).forEach(k => { S.add(k); dlyPreds(k).forEach(x => S.add(x)); });
      { const ck = typeof insDlyKey === "function" ? insDlyKey() : null; if (ck) S.add(ck); }
      const ok = k => { const [lo, se] = k.split("|"); return INS.lot.some(x => x.id === lo) && INS.sec.some(x => x.id === se); };
      return [...S].filter(ok);
    };
    /* tâche supprimée (lot ou activité secondaire) : ses délais et ses liens de prédécesseurs disparaissent */
    const dlyClean = () => {
      if (!INS) return false;
      const L = new Set(INS.lot.map(x => x.id)), Sc = new Set(INS.sec.map(x => x.id));
      const ok = k => { const [lo, se] = String(k).split("|"); return L.has(lo) && Sc.has(se); };
      let ch = false;
      Object.keys(INS.dlp || {}).forEach(k => { if (!ok(k)) { delete INS.dlp[k]; ch = true; } });
      Object.keys(INS.dpred || {}).forEach(k => {
        if (!ok(k)) { delete INS.dpred[k]; ch = true; return; }
        const n = INS.dpred[k].filter(x => ok(typeof x === "string" ? x : x.k));
        if (n.length !== INS.dpred[k].length) { INS.dpred[k] = n; ch = true; }
      });
      return ch;
    };
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
    const dlySortByDeb = () => { INS.dord = dlyByDeb(dlyKeys()); dlyTasksFromPlan(); };
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
    const DLY_SC = { j: { min: 14, max: 100, def: 22, k: "svi_dlyg_dw_v1" }, s: { min: 4, max: 100, def: 9, k: "svi_dlyg_dw_s_v1", fit: 1 }, m: { min: 1, max: 100, def: 2, k: "svi_dlyg_dw_m_v1", fit: 1 } };
    const dlyScale = () => { let v = "j"; try { v = localStorage.getItem("svi_dlyg_sc_v1") || "j"; } catch (e) {} return DLY_SC[v] ? v : "j"; };
    /* v546 (R17) : choix JOUR / SEMAINE / MOIS dans la fenêtre CALENDRIER DU BUDGET ; SEMAINE et MOIS partent de la largeur qui remplit l'écran (R23) */
    window.__sviDlyScale = { get: () => dlyScale(), set: v => { const c = DLY_SC[v]; if (!c) return; try { if (c.fit) localStorage.setItem(c.k, "fit"); localStorage.setItem("svi_dlyg_sc_v1", v); } catch (e) {} keepScroll(() => renderTab()); } };
    let DLY_DW_MIN = DLY_SC[dlyScale()].min, DLY_DW_MAX = DLY_SC[dlyScale()].max;
    /* v546 (R23, R34) : maximum = 100 px par jour, ou plus si c'est la largeur qui remplit l'écran ; « fit » = remplir (départ en SEMAINE / MOIS) */
    let DLY_FILL = 0;
    const dlyDwGet = () => {
      const c = DLY_SC[dlyScale()]; DLY_DW_MIN = c.min; DLY_DW_MAX = Math.max(100, DLY_FILL);
      let s0 = null; try { s0 = localStorage.getItem(c.k); } catch (e) {}
      const v = s0 === null ? (c.fit && DLY_FILL ? DLY_FILL : c.def) : s0 === "fit" ? (DLY_FILL || c.def) : Number(s0) || c.def;
      return Math.max(c.min, Math.min(DLY_DW_MAX, Math.round(v)));
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
    const dlyGanttDraw = () => {
      const host = shell.querySelector("#dlyGantt");
      if (!host || host.__drawn) return;
      dlyRhApply(dlyRhGet());
      const tbl = host.parentElement.querySelector(".dlyg-l table");
      const R = shell.__dlyRows || [];
      if (!tbl) return;
      /* onglet pas encore visible (ouverture du budget, ‹ ›) : lignes de hauteur 0 → on attend qu'elles soient affichées,
         sinon toutes les barres tomberaient sur la première ligne */
      if (!tbl.getBoundingClientRect().height) {
        if (!host.__ro && window.ResizeObserver) {
          host.__ro = new ResizeObserver(() => {
            if (!host.isConnected) { host.__ro.disconnect(); host.__ro = null; return; }
            if (!tbl.getBoundingClientRect().height || host.__drawn) return;
            host.__ro.disconnect(); host.__ro = null;
            dlyGanttDraw();
          });
          host.__ro.observe(tbl);
        }
        return;
      }
      host.__drawn = true;
      /* à l'ouverture : le tableau montre LOT, ACTIVITÉ SECONDAIRE… jusqu'à DURÉE (J), puis la poignée et le Gantt
         (réajusté juste après, les colonnes pouvant encore s'élargir à leur intitulé) */
      {
        const fit = () => {
          const o = shell.__dlygW, L = host.isConnected && host.parentElement.querySelector(".dlyg-l");
          /* v444 : largeur calculée une seule fois à l'ouverture, puis gardée — la poignée ne bouge plus quand on glisse une barre */
          if (!L || (dlygMine(o) && (!o.auto || o.fixed))) return;
          const th = [...L.querySelectorAll("thead th")].find(t => /^DURÉE/.test((t.textContent || "").trim()));
          if (!th) return;
          let w = 0;
          for (let k = 0; k < 4; k++) {
            const d = Math.round(th.getBoundingClientRect().right - L.getBoundingClientRect().right);
            if (k && Math.abs(d) <= 1) break;
            w = Math.round(L.getBoundingClientRect().width + d + 1);
            L.style.width = w + "px"; L.style.maxWidth = "none";
          }
          if (w > 60) { shell.__dlygW = { ins: INS, ref: DLYG_REF, w, auto: true }; shell.__dlygPrevW = shell.__dlygPrevW || w; }
        };
        /* v451 : une seule mise à la largeur, avant le premier affichage du planning (pas de saut visible), puis plus jamais */
        fit(); { const o = shell.__dlygW; if (dlygMine(o)) o.fixed = true; }
      }
      /* hauteur du tableau changée ensuite (police, repli, largeur) : le Gantt se redessine */
      if (window.ResizeObserver && !host.__ro2) {
        /* hauteur du tableau ou du bloc (agrandi / réduit) changée : le Gantt se redessine */
        const scr0 = host.closest(".bdg-d-scroll");
        const hk = () => tbl.getBoundingClientRect().height + "|" + (scr0 ? scr0.clientHeight : 0) + "|" + Math.ceil(host.clientWidth / (DLY_DW || 1));
        let h0 = hk();
        host.__ro2 = new ResizeObserver(() => {
          if (!host.isConnected) { host.__ro2.disconnect(); return; }
          const h = hk();
          if (!tbl.getBoundingClientRect().height || h === h0) return;
          h0 = h;
          cancelAnimationFrame(host.__raf);
          host.__raf = requestAnimationFrame(() => { host.__drawn = false; dlyGanttDraw(); });
        });
        host.__ro2.observe(tbl); host.__ro2.observe(host); if (scr0) host.__ro2.observe(scr0);
      }
      const cal = insCal(), tr0 = tbl.getBoundingClientRect();
      let dlyHHpx = dlyHHGet() === "full" ? 300 : dlyHHGet();
      const hasH = !!host.parentElement.querySelector(".dlyg-hh");
      const HD = dlyHistData();
      const thH = tbl.querySelector("thead").getBoundingClientRect().height;
      const trs = [...tbl.querySelectorAll("tbody tr")];
      const geo = trs.map(tr => { const r = tr.getBoundingClientRect(); return { y: r.top - tr0.top - thH, h: r.height }; });
      const rowsH = Math.max(geo.length ? geo[geo.length - 1].y + geo[geo.length - 1].h : 0, 40);
      /* le PLANNING occupe toute la hauteur du bloc (deux lignes vides au moins à la fin) ; tableau et Gantt restent alignés */
      let bodyH = rowsH + 2 * (geo.length ? geo[geo.length - 1].h : 24);
      {
        const gg = host.closest(".dlyg"), scr = gg && gg.closest(".bdg-d-scroll");
        /* v545 (remarque 2) : le bloc du PLANNING prend la hauteur visible de l'écran sous le bandeau et les onglets */
        if (scr && scr.classList.contains("dly-scroll")) {
          let lim = 0; document.querySelectorAll(".topbar, .bdg-d-sticky").forEach(b => { const r = b.getBoundingClientRect(); if (r.height && /sticky|fixed/.test(getComputedStyle(b).position)) lim = Math.max(lim, r.bottom > 0 ? r.bottom : 0); });
          /* v546 : haut réel du bloc à l'écran (page non défilée, bloc agrandi) — jamais au-dessus du bandeau et des onglets */
          const tabs = document.getElementById("bdgTabs"), st = Math.max(scr.getBoundingClientRect().top, lim + (tabs ? tabs.offsetHeight : 0));
          const want = Math.max(240, Math.floor(dlyVpB() - st - 6));
          if (Math.abs((parseFloat(scr.style.height) || 0) - want) > 1) scr.style.setProperty("height", want + "px", "important");
        }
        if (scr && scr.clientHeight) {
          const sr = scr.getBoundingClientRect(), top = gg.getBoundingClientRect().top - sr.top + scr.scrollTop;
          const addH = gg.nextElementSibling ? gg.nextElementSibling.getBoundingClientRect().height : 0;
          /* v545 (remarque 2) : hauteur VISIBLE du bloc (jamais sous le bas de l'écran) — planning et histogramme y tiennent ensemble */
          const visH = Math.max(160, Math.min(scr.clientHeight, dlyVpB() - Math.max(0, sr.top)));
          /* R12 : histogramme plein écran (à la place du Gantt) ou à la hauteur tirée à la poignée « = » */
          const capH = Math.max(80, Math.floor(Math.min(sr.bottom, dlyVpB()) - tbl.querySelector("thead").getBoundingClientRect().bottom - 4));
          if (dlyHHGet() === "full") dlyHHpx = capH;
          else if (dlyHHpx) dlyHHpx = Math.max(28, Math.min(dlyHHpx, capH));
          const histH = hasH ? dlyHHpx : 0;
          /* les tâches en trop défilent dans le planning, sous l'histogramme gardé en bas de l'écran ; place gardée pour voir les dernières */
          const ovB = rowsH > visH ? Math.max(0, Math.ceil(sr.bottom - dlyVpB())) : 0;
          bodyH = Math.max(bodyH + ovB, Math.floor(visH - top - thH - histH - addH - 10));
        }
        const L = gg && gg.querySelector(".dlyg-l");
        if (L) {
          let f = L.querySelector(".dlyg-fill");
          if (!f) { f = document.createElement("div"); f.className = "dlyg-fill"; tbl.after(f); }
          /* v546 (R21) : le tableau descend jusqu'en bas du bloc (l'histogramme n'est que sous le Gantt) */
          f.style.height = (bodyH - rowsH + (hasH ? dlyHHpx : 0)) + "px";
        }
      }
      const dates = [];
      R.forEach(x => { if (x.deb) dates.push(x.deb); if (x.fin) dates.push(x.fin); });
      if (INS.dbut) dates.push(INS.dbut);
      if (HD && HD.cmd) dates.push(...Object.keys(HD.cmd.L));
      dates.sort();
      const today = sviIsoOf(new Date());
      const d0 = sviIsoAdd(dates[0] || today, -3);
      /* v546 (R23, R34) : largeur des jours qui fait remplir au projet toute la largeur visible du Gantt */
      { const pd = R.filter(x => !x.grp).flatMap(x => [x.deb, x.fin]).filter(Boolean).sort();
        DLY_FILL = pd.length ? Math.floor((host.clientWidth || 600) / (dDiff(pd[0], pd[pd.length - 1]) + 7)) : 0; }
      DLY_DW = dlyDwGet();
      const SC = dlyScale();
      host.style.setProperty("--dw", DLY_DW + "px");
      /* v458 : le calendrier va au moins jusqu'au bord droit du Gantt visible (tableau caché, poignée, échelle, rotation) */
      const nD = Math.max(dDiff(d0, sviIsoAdd(dates[dates.length - 1] || sviIsoAdd(today, 30), 10)) + 1, Math.ceil((host.clientWidth || 0) / DLY_DW) + 1), W = nD * DLY_DW;
      const d1 = sviIsoAdd(d0, nD - 1);
      const X = iso => dDiff(d0, iso) * DLY_DW;
      let head = "", bg = "";
      for (let i = 0; i < nD; i++) {
        const di = sviIsoAdd(d0, i), dd = Number(di.slice(8, 10));
        const mo = Number(di.slice(5, 7)) - 1;
        if (SC === "m") {
          /* MOIS : année en haut, mois en bas */
          if ((dd === 1 && mo === 0) || i === 0) head += `<span class="gh-m" style="left:${i * DLY_DW}px">${di.slice(0, 4)}</span>`;
          if (dd === 1 || i === 0) { const nd = new Date(Number(di.slice(0, 4)), mo + 1, 0).getDate() - dd + 1;
            head += `<span class="gh-d gh-w" style="left:${i * DLY_DW}px;width:${nd * DLY_DW}px">${["JANV.", "FÉVR.", "MARS", "AVR.", "MAI", "JUIN", "JUIL.", "AOÛT", "SEPT.", "OCT.", "NOV.", "DÉC."][mo]}</span>`; }
          continue;
        }
        if (dd === 1 || i === 0) head += `<span class="gh-m" style="left:${i * DLY_DW}px">${SVI_MOIS[mo]} ${di.slice(0, 4)}</span>`;
        if (SC === "s") {
          /* SEMAINE : numéro de semaine (ISO) et date du lundi */
          const dt = new Date(di + "T00:00:00");
          if (dt.getDay() === 1 || i === 0) {
            const t = new Date(dt); t.setDate(t.getDate() + 3 - (t.getDay() + 6) % 7);
            const w1 = new Date(t.getFullYear(), 0, 4), wn = 1 + Math.round(((t - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7);
            head += `<span class="gh-d gh-w" style="left:${i * DLY_DW}px;width:${7 * DLY_DW}px">S${wn}${7 * DLY_DW >= 56 ? " " + di.slice(8, 10) + "/" + di.slice(5, 7) : ""}</span>`;
          }
          continue;
        }
        const off = !sviWork(cal, di);
        head += `<span class="gh-d${off ? " off" : ""}" style="left:${i * DLY_DW}px">${dd}</span>`;
        if (off) bg += `<div class="gbg-off" style="left:${i * DLY_DW}px"></div>`;
      }
      const vline = (iso, cls, lab) => iso && iso >= d0 && iso <= d1 ? `<div class="gv ${cls}" style="left:${X(iso) + DLY_DW}px" title="${lab}"><span>${lab}</span></div>` : "";
      let bars = "";
      const pos = {};
      R.forEach((x, i) => {
        const g = geo[i];
        if (!g) return;
        const BH = dlyBh(dlyRhGet()), y = g.y + Math.max(2, (g.h - BH) / 2), ty = y + (BH - 15) / 2;
        if (x.grp) {
          const segs = [];
          x.all.filter(t => t.deb && t.fin).map(t => [t.deb, t.fin, t.lo]).sort((a, b) => a[0].localeCompare(b[0])).forEach(([a, b, lo]) => {
            const s = segs[segs.length - 1];
            if (s && a <= sviIsoAdd(s.b, 1)) { if (b > s.b) s.b = b; if (s.lo !== lo) s.lo = ""; }
            else segs.push({ a, b, lo });
          });
          /* FORMAT 93 : signe › / ⌄ devant le nom du lot (ou du niveau) ; un toucher = replier / déplier */
          /* signe à gauche de la barre du lot, nom à droite ; les deux se touchent pour replier / déplier */
          const gname = (l, r) => `<span class="gb-n gb-out gb-fold gb-fsg" data-path="${esc(x.path)}" style="left:${Math.max(0, l - 17)}px;top:${ty}px">${x.fold ? "›" : "⌄"}</span>`
            /* nom court (sans le parent) ; un lot rangé dans un autre est décalé et marqué ↳ selon son niveau (comme le bloc LOT) */
            + (() => {
              /* v443 : nom du lot dans sa barre quand il y tient en entier (comme les tâches), sinon juste à droite */
              const LB = x.lab || lotLab(dlyLotPath(x.path)), bw = r - 5 - l, need = dlyTxtW(LB.full) + (x.lvl ? 14 : 0) + 16, inb = l > 0 && bw >= need;
              return `<span class="gb-n gb-out gb-grp gb-ren${inb ? " gb-gin" : ""}${x.fold ? " gb-gfd" : ""}" data-path="${esc(x.path)}" style="left:${inb ? l + 4 : r + x.lvl * 14}px;top:${ty}px;--c:${gcolOf()}">${x.lvl ? '<span class="gb-lv">↳</span>' : ""}${lotNoHTML(LB)}${esc(LB.name)}</span>`;
            })();
          const gcolOf = () => dlyLotColor((x.all.find(t => t.lo) || {}).lo);
          if (!segs.length) { bars += gname(17, 20); return; }
          const a0 = segs[0].a, b0 = segs[segs.length - 1].b;
          /* couleur d'un lot (FORMAT 91, 93) : celle de son lot, ou de son premier lot pour un niveau qui en regroupe plusieurs */
          const gcol = dlyLotColor((x.all.find(t => t.lo) || {}).lo);
          if (x.fold) {
            /* lot replié (FORMAT 92) : parties travaillées dans la couleur du lot, creux en blanc, trait fin en pointillé */
            bars += `<div class="gdot" data-path="${esc(x.path)}" style="left:${X(a0)}px;width:${X(b0) - X(a0) + DLY_DW}px;top:${y + BH / 2 - 0.5}px"></div>`;
            segs.forEach(s => { bars += `<div class="gseg" data-path="${esc(x.path)}" style="left:${X(s.a)}px;width:${X(s.b) - X(s.a) + DLY_DW - 1}px;top:${y}px;background:${s.lo ? dlyLotColor(s.lo) : gcol}"></div>`; });
            bars += gname(X(a0), X(b0) + DLY_DW + 5);
          } else bars += `<div class="gsum" data-path="${esc(x.path)}" style="left:${X(a0)}px;width:${X(b0) - X(a0) + DLY_DW - 1}px;top:${y + (BH - 6) / 2 - 0.5}px;--c:${gcol}"></div>`
            + gname(X(a0), X(b0) + DLY_DW + 5);
          return;
        }
        /* v546 (R14) : tâche sans ouvriers ni délai (DÉBUT = FIN, ni main-d'œuvre, ni durée fixée) = 0 jour, comme une tâche sans dates */
        const z0 = x.deb && x.fin && x.deb === x.fin && !x.hs && !x.he && !dlyInc(x.key) && dlyNoLab(x.key);
        if (!x.deb || !x.fin || z0) {
          /* R15 : tâche sans dates complètes = 0 jour — repère fin et gris à sa date (seul DÉBUT, seule FIN, ou date exigée par ses liaisons) ;
             la glisser vers la droite lui donne une durée */
          const at = x.deb || x.fin || dlyPredFin(x.key);
          if (!at || x.ext) return;
          const left = X(at) + (!x.deb && x.fin ? DLY_DW : 0);
          pos[x.key] = { l: left, r: left, y: y + BH / 2 };
          bars += `<div class="gb gb0${x.off ? " gb-off" : ""}" data-key="${esc(x.key)}" data-at="${esc(at)}" style="left:${left - 1}px;top:${y}px"><span class="gb-e"></span></div>`
            + `<span class="gb-n gb-out gb-ren gb0n" data-key="${esc(x.key)}" style="left:${left + 6}px;top:${ty}px">${esc(x.sec)}</span>`;
          return;
        }
        /* v547 (R22) : tâche en plusieurs morceaux — une barre par morceau, reliées par un trait fin en pointillé ;
           glisser un morceau = déplacer toute la tâche ; le bout du dernier morceau = sa FIN */
        if (x.per && x.per.length > 1) {
          const col = dlyLotColor(x.lo), P = x.per, last = P[P.length - 1];
          const L0 = X(P[0].deb) + (P[0].hs ? DLY_DW / 2 : 0), R0 = X(last.fin) + DLY_DW - 1 - (last.he ? DLY_DW / 2 : 0);
          pos[x.key] = { l: L0, r: R0, y: y + BH / 2 };
          bars += `<div class="gpc" style="left:${L0}px;width:${Math.max(0, R0 - L0)}px;top:${y + BH / 2 - 0.5}px;--c:${col}"></div>`;
          P.forEach((q, j) => {
            const l = X(q.deb) + (q.hs ? DLY_DW / 2 : 0), w = Math.max(3, X(q.fin) - X(q.deb) + DLY_DW - 1 - (q.hs ? DLY_DW / 2 : 0) - (q.he ? DLY_DW / 2 : 0));
            bars += `<div class="gb gb-pc${x.off ? " gb-off" : ""}${x.marge === 0 ? " crit" : ""}${w < 30 ? " gb-nar" : ""}" data-key="${esc(x.key)}" data-pc="${j}" style="left:${l}px;width:${w}px;top:${y}px;--c:${col}">${j === 0 ? '<span class="gb-s"></span>' : ""}${j === P.length - 1 ? '<span class="gb-e"></span>' : ""}</div>`;
          });
          bars += `<span class="gb-n gb-out gb-ren${x.off ? " gb-offn" : ""}" data-key="${esc(x.key)}" style="left:${R0 + 5}px;top:${ty}px">${dlyIncHTML(x.key)}${esc(x.sec)} <span class="gpc-n">${P.length} MORCEAUX</span>${x.jal ? ' <span class="gjal">★</span>' : ""}${dlyLimHTML(x.key)}</span>`;
          return;
        }
        /* v530 : demi-journée de début ou de fin = demi-case */
        const left = X(x.deb) + (x.hs ? DLY_DW / 2 : 0), w = Math.max(3, X(x.fin) - X(x.deb) + DLY_DW - 1 - (x.hs ? DLY_DW / 2 : 0) - (x.he ? DLY_DW / 2 : 0)), col = dlyLotColor(x.lo);
        const crit = x.marge === 0;
        const nm = esc(x.sec);
        /* FORMAT 91 : barre fine et arrondie, nom juste à droite */
        pos[x.key] = { l: left, r: left + w, y: y + BH / 2 };
        /* FORMAT 91 : nom dans la barre quand il y tient en entier, sinon juste à droite */
        const inside = dlyTxtW(x.sec) + 12 <= w;
        bars += `<div class="gb${x.ext ? " gb-ext" : ""}${x.off ? " gb-off" : ""}${crit ? " crit" : ""}${inside ? " gb-tin" : ""}${w < 30 ? " gb-nar" : ""}" data-key="${esc(x.key)}" style="left:${left}px;width:${w}px;top:${y}px;--c:${col}">`
          + (inside ? `<span class="gb-ti">${dlyInc(x.key) ? '<span class="gb-inc">▣ </span>' : ""}${nm}</span>` : "")
          + `<span class="gb-s"></span><span class="gb-e"></span></div>`
          + (inside ? (x.jal || qqArret(x.key) || dlyLimHTML(x.key) ? `<span class="gb-n gb-out" style="left:${left + w + 5}px;top:${ty}px">${x.jal ? '<span class="gjal">★</span>' : ""}${qqArret(x.key) ? '<span class="garr">■</span>' : ""}${dlyLimHTML(x.key)}</span>` : "")
            : `<span class="gb-n gb-out${x.ext ? " gb-extn" : " gb-ren"}${x.off ? " gb-offn" : ""}" data-key="${esc(x.key)}" style="left:${left + w + 5}px;top:${ty}px">${x.ext ? esc(lotLab(dlyLotPath(x.lot)).full) + " › " : ""}${dlyInc(x.key) ? '<span class="gb-inc">▣ </span>' : ""}${nm}${x.jal ? ' <span class="gjal">★</span>' : ""}${qqArret(x.key) ? ' <span class="garr">■</span>' : ""}${dlyLimHTML(x.key)}</span>`);
      });
      /* liaisons : fils fléchés (FIN → DÉBUT depuis la fin, DÉBUT → DÉBUT depuis le début) ; toucher le fil = fenêtre LIAISON */
      let lk = "";
      R.forEach(x => {
        if (x.grp || !pos[x.key]) return;
        dlyLinks(x.key).forEach(l => {
          const a = pos[l.k], b = pos[x.key];
          if (!a) return;
          const x2 = b.l, y2 = b.y;
          let dpath;
          if (l.t === "DD") { const x1 = a.l, mx = Math.min(x1, x2) - 8; dpath = `M${x1} ${a.y} H${mx} V${y2} H${x2 - 1}`; }
          else {
            const x1 = a.r;
            dpath = x2 - 8 >= x1 + 6 ? `M${x1} ${a.y} H${x1 + 6} V${y2} H${x2 - 1}` : `M${x1} ${a.y} H${x1 + 6} V${(a.y + y2) / 2} H${x2 - 10} V${y2} H${x2 - 1}`;
          }
          lk += `<path class="gl${x.off || (R.find(r => !r.grp && r.key === l.k) || {}).off ? " gl-off" : ""}" d="${dpath}" marker-end="url(#gArr)"/><path class="gl-hit" data-p="${esc(l.k)}" data-s="${esc(x.key)}" d="${dpath}"/>`;
        });
      });
      /* histogramme des charges cochées (R9, R11, R14 ; v543 : R17 à R21) : une couleur par charge ; jour par jour (barres) ou cumulé (courbe) ;
         plage DÉBUT – FIN (R19), filtre MIN – MAX (R20), barre CAPACITÉ (R21 à R23), commandes prévisionnelles (R17) */
      let hist = "";
      {
        const HH = dlyHHpx;
        if (!HH) hist = "";
        else if (!HD) hist = `<div class="ghist ghist-empty" style="width:${W}px;height:${HH}px"><div class="ghist-msg">SÉLECTIONNER DES CHARGES</div></div>`;
        else {
          /* v546 : R20 valeur par morceau, R24 capacité en MONTANT, échelle abrégée, légende (70 %), R28 cumul = une courbe,
             R29 courbes CHARGES / PRODUITS / MARGE */
          const C = HD.cmd, ks = [...HD.ser.keys()], hs = dlyHSet(), cum = !C && hs.aff === "c", crb = HD.crb || ["c"];
          const sC = crb.includes("c") && !!HD.R, sP = crb.includes("p"), sG = crb.includes("g"), multi = !C && (sP || sG);
          const RG = dlyHRange(), VL = dlyHVal(), inR = di => (!RG.a || di >= RG.a) && (!RG.b || di <= RG.b);
          const cur = dlyCurGK(), canP = !C && !cum && !multi && !!cur && !!HD.R, IB = canP ? 14 : 0;
          const days = [...new Set(Object.keys(C ? C.L : HD.tot).concat(multi ? Object.keys(HD.prd || {}) : []))].sort();
          /* valeurs par jour (ou cumul : relatif = repart de 0 au trait DÉBUT) */
          const cumOf = get => { const o = {}; let t = 0, b = 0; days.forEach(di => { const v = get(di); if (hs.cum === "r" && RG.a && di < RG.a) b += v; t += v; o[di] = t - b; }); return o; };
          const gC = di => HD.tot[di] || 0, gP = di => (HD.prd || {})[di] || 0, gG = di => gP(di) - gC(di);
          const val = {}, sval = ks.map(() => ({}));
          if (C) days.forEach(di => { val[di] = C.L[di]; });
          else if (!cum) days.forEach(di => { val[di] = gC(di); ks.forEach((sk, j) => { sval[j][di] = HD.ser.get(sk).L[di] || 0; }); });
          else Object.assign(val, cumOf(gC));
          const vP = multi ? (cum ? cumOf(gP) : Object.fromEntries(days.map(di => [di, gP(di)]))) : {};
          const vG = multi ? (cum ? cumOf(gG) : Object.fromEntries(days.map(di => [di, gG(di)]))) : {};
          const vis = days.filter(di => di >= d0 && di <= d1);
          const shown = di => [...(multi ? [] : [val[di]]), ...(multi && sC ? [val[di]] : []), ...(sP ? [vP[di]] : []), ...(sG ? [vG[di]] : [])];
          const mx = Math.max(0, ...vis.flatMap(di => shown(di)).filter(v => v !== undefined));
          const mn = Math.min(0, ...vis.flatMap(di => shown(di)).filter(v => v !== undefined));
          const SG = canP ? dlyCapSegs() : [];
          /* v545 (remarque 5) : capacité jamais réglée = barre rouge posée juste au-dessus du jour le plus chargé, avec son nombre */
          const capDef = canP && SG.length === 1 && dlyCapDef(), mxAll = Math.max(0, ...days.map(di => val[di] || 0));
          if (capDef) SG[0] = { ...SG[0], n: Math.max(1, Math.ceil(mxAll - 1e-9)), def: true };
          const PM = Math.max(0, ...SG.map(x => x.n));
          const top = ((Math.max(mx, PM, VL.max || 0) - mn) || 1) * 1.08, sc = (HH - 36 - IB) / top, Y0 = HH - IB - (-mn) * sc;
          const pass = di => inR(di) && (multi || ((VL.min === null || val[di] >= VL.min - 1e-9) && (VL.max === null || val[di] <= VL.max + 1e-9)));
          const bw = Math.max(1, DLY_DW - (DLY_DW > 10 ? 6 : 0)), bo = DLY_DW > 10 ? 3 : 0;
          const capAt = di => { let n = -1; SG.forEach(x => { if (!x.def && (!x.d || x.d <= di)) n = x.n; }); return n; };
          /* nombres abrégés (R24) : 5 K, 1,5 M, 1 G */
          const fmtA = v => { const a = Math.abs(v), f = (x, u) => (Math.round(x * 10) / 10).toLocaleString("fr-FR") + " " + u; return a >= 1e9 ? f(v / 1e9, "G") : a >= 1e6 ? f(v / 1e6, "M") : a >= 1e4 ? f(v / 1e3, "K") : (Math.round(v * 100) / 100).toLocaleString("fr-FR"); };
          const fmtV = v => (Math.round(v * 100) / 100).toLocaleString("fr-FR");
          /* légende (R24) : par montant décroissant ; toutes les charges cochées = seulement celles qui font le % réglé, le reste en AUTRES */
          const totS = ks.map((sk, j) => [sk, days.reduce((t, di) => t + (HD.ser.get(sk).L[di] || 0), 0)]).sort((a, b) => b[1] - a[1]);
          const allOn = (INS.chg || []).filter(r => !r.t).every(r => r.on === true);
          const pct = Math.max(1, Math.min(100, Number(hs.pct) || 70)), grand = totS.reduce((t, x) => t + x[1], 0) || 1;
          const keep = new Set(); { let acc = 0; totS.forEach(([sk, v]) => { if (!allOn || acc < grand * pct / 100 - 1e-9) keep.add(sk); acc += v; }); }
          const col = {}; let ci = 0; totS.forEach(([sk]) => { col[sk] = keep.has(sk) ? DLY_SER[ci++ % DLY_SER.length] : "#98a2b3"; });
          const order = totS.map(x => ks.indexOf(x[0]));
          let hb = "", svg = "";
          const CC = "#2e90fa", CP = "#12b76a", CG = "#7a5af8";
          if (C) vis.forEach(di => { hb += `<div class="ghb ghc${pass(di) ? "" : " gh-off"}" data-d="${di}" style="left:${X(di) + bo}px;width:${bw}px;height:${Math.max(1, val[di] * sc)}px;bottom:${IB}px"></div>`; });
          else if (!cum && !multi) vis.forEach(di => {
            const v = val[di], n = capAt(di), over = n >= 0 && v > n + 1e-9, inc = over && (HD.det[di] || []).some(x => x.inc);
            const parts = ks.length > 1 ? order.map(j => { const w = sval[j][di]; return w ? `<i style="height:${w * sc}px;background:${col[ks[j]]}"></i>` : ""; }).join("") : "";
            hb += `<div class="ghb${over ? (inc ? " over-inc" : " over") : ""}${ks.length > 1 ? " ghb-st" : ""}${pass(di) ? "" : " gh-off"}" data-d="${di}" style="left:${X(di) + bo}px;width:${bw}px;height:${Math.max(1, v * sc)}px;bottom:${HH - Y0}px">${parts}</div>`;
          });
          else if (!cum) {
            /* R29 : barres côte à côte dans le jour — CHARGES, PRODUITS, MARGE (signée, sous le zéro si négative) */
            const S = [...(sC ? [[val, CC]] : []), ...(sP ? [[vP, CP]] : []), ...(sG ? [[vG, CG]] : [])], w1 = Math.max(1, bw / (S.length || 1));
            vis.forEach(di => {
              S.forEach(([M, c], j) => { const v = M[di] || 0; if (!v) return; hb += `<div class="ghb ghb-m${pass(di) ? "" : " gh-off"}" data-d="${di}" style="left:${X(di) + bo + j * w1}px;width:${w1}px;top:${Y0 - Math.max(v, 0) * sc}px;bottom:auto;height:${Math.max(1, Math.abs(v) * sc)}px;background:${c}"></div>`; });
            });
          } else {
            /* R28 : une seule courbe par grandeur (le total), plus une par charge */
            const pt = (di, v) => `${X(di) + DLY_DW / 2},${Y0 - v * sc}`;
            const line = (M, c) => `<polyline points="${vis.map(di => pt(di, M[di] || 0)).join(" ")}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>`;
            if (!multi || sC) svg += line(val, multi ? CC : "#344054");
            if (sP) svg += line(vP, CP);
            if (sG) svg += line(vG, CG);
            vis.forEach(di => { if (!pass(di)) svg += `<rect x="${X(di)}" y="0" width="${DLY_DW}" height="${HH}" fill="rgba(255,255,255,.65)"/>`; });
            vis.forEach(di => { hb += `<div class="ghb ghb-hit" data-d="${di}" style="left:${X(di)}px;width:${DLY_DW}px;height:${HH}px;bottom:0"></div>`; });
          }
          host.__HV = { cum, multi, val, vP, vG, unit: HD.unit };
          const late = INS.dbut && dlyEnd(dlyCurDates()) > INS.dbut;
          const legI = (c, t) => `<span><b style="background:${c}"></b>${esc(t)}</span>`;
          const leg = C ? "" : multi ? `<div class="ghist-leg">${(sC ? legI(CC, "CHARGES") : "") + (sP ? legI(CP, "PRODUITS") : "") + (sG ? legI(CG, "MARGE") : "")}</div>`
            : cum ? (ks.length > 1 ? `<div class="ghist-leg">${legI("#344054", "TOTAL DES " + ks.length + " CHARGES")}</div>` : "")
            : ks.length > 1 ? `<div class="ghist-leg">${totS.filter(x => keep.has(x[0])).map(([sk]) => legI(col[sk], sk.split("|")[0])).join("")}${totS.some(x => !keep.has(x[0])) ? legI("#98a2b3", "AUTRES (" + totS.filter(x => !keep.has(x[0])).length + ")") : ""}</div>` : "";
          /* R21 à R23 : CAPACITÉ ; v546 : « / » traversé par la barre, trait vertical en pointillés entre deux morceaux, valeur du morceau au-dessus (R19, R20) */
          const yOf = n => n < 0 ? HH - IB / 2 : Y0 - n * sc;
          const pl = SG.map((g2, j) => {
            const l = g2.d ? Math.max(0, X(g2.d)) : 0, r = SG[j + 1] ? Math.max(0, X(SG[j + 1].d)) : W;
            if (r <= l) return "";
            const n = g2.n, y = yOf(n), cls = (n < 0 ? " gcap-inf" : n === 0 ? " gcap-zero" : "") + (g2.def ? " gcap-def" : "");
            const lab = n < 0 ? "ILLIMITÉ" : n === 0 ? "CAPACITÉ 0 — PÉNURIE" : "CAPACITÉ " + fmtA(n);
            const sum = days.filter(di => di >= (g2.d || "") && (!SG[j + 1] || di < SG[j + 1].d)).reduce((t, di) => t + (val[di] || 0), 0);
            const prev = j ? SG[j - 1] : null, py = prev ? yOf(prev.n) : y;
            return `<div class="gplaf${cls}" data-seg="${g2.i}" style="top:${y}px;left:${l}px;right:auto;width:${r - l}px"><span class="gplaf-v">${g2.d && j ? dFr(g2.d) + " : " : ""}${lab}</span>${!j && late ? `<span class="gplaf-w">${DLY_BUT_MSG}</span>` : ""}</div>`
              + (sum ? `<div class="gseg-v" style="left:${(l + Math.min(r, W)) / 2}px;top:${Math.max(0, Math.min(y, Y0) - 34)}px">${fmtA(sum)} ${esc(HD.unit)}</div>` : "")
              + (j && g2.d && Math.abs(py - y) > 1 ? `<div class="gcut-v" style="left:${l}px;top:${Math.min(py, y)}px;height:${Math.abs(py - y)}px"></div>` : "")
              + (j && g2.d ? `<span class="gcut" data-i="${g2.i}" data-eq="${prev && prev.n === n ? 1 : 0}" style="left:${l - 7}px;top:${y - 10}px" role="button" title="SUPPRIMER LA COUPE (APPUI LONG : DÉPLACER)">/</span>` : "");
          }).join("");
          /* R19 : traits DÉBUT et FIN ; total de la plage seulement quand une plage est posée */
          const xa = RG.a ? X(RG.a) : 0, xb = RG.b ? X(RG.b) + DLY_DW : W;
          const sum = days.filter(di => inR(di) && pass(di)).reduce((t, di) => t + (C ? C.L[di] : gC(di)), 0);
          const rng = `<div class="grng${RG.a ? "" : " grng-off"}" data-r="a" style="left:${xa}px"><span>DÉBUT${RG.a ? " " + dFr(RG.a).slice(0, 5) : ""}</span></div>`
            + `<div class="grng${RG.b ? "" : " grng-off"}" data-r="b" style="left:${xb}px"><span>FIN${RG.b ? " " + dFr(RG.b).slice(0, 5) : ""}</span></div>`
            + (RG.a || RG.b || VL.min !== null || VL.max !== null ? `<div class="grng-tot" style="left:${(xa + xb) / 2}px">${fmtA(sum)} ${esc(HD.unit)}</div>` : "");
          /* R20 : lignes MIN et MAX (filtre par valeur, sur les charges) */
          const vl = (r, v, off) => `<div class="gval${off ? " gval-off" : ""}" data-v="${r}" style="top:${off ? (r === "max" ? 2 : Y0 - 1) : Y0 - v * sc}px"><span>${r.toUpperCase()}${off ? "" : " " + fmtA(v)}</span></div>`;
          const vals = multi ? "" : vl("max", VL.max, VL.max === null) + vl("min", VL.min, VL.min === null);
          /* échelle (R24) : unité en tête, nombres abrégés, toujours visible à gauche */
          const stp = (() => { const raw = top / 4, p = Math.pow(10, Math.floor(Math.log10(raw || 1))), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; })();
          let ax = "";
          if (HH >= 50) { for (let v = stp; Y0 - v * sc >= 18; v += stp) ax += `<span class="gax-t" style="top:${Y0 - v * sc}px">${fmtA(v)}</span>`; for (let v = -stp; Y0 - v * sc <= HH - 6; v -= stp) ax += `<span class="gax-t" style="top:${Y0 - v * sc}px">${fmtA(v)}</span>`; }
          ax = `<div class="ghist-ax" style="height:${HH}px"><span class="gax-u">${esc(dlyHistLab(HD))}</span>${ax}<span class="gax-t gax-0" style="top:${Y0}px">0</span></div>`;
          hist = `<div class="ghist${C ? " ghist-cmd" : ""}${cum ? " ghist-cum" : ""}" style="width:${W}px;height:${HH}px" data-sc="${sc}" data-y0="${Y0}" data-ib="${IB}" data-top="${top}">${ax}${bg}${leg}${C ? `<div class="ghist-leg"><span>${esc(C.lab)}</span></div>` : ""}${IB ? `<div class="ghist-inf" style="height:${IB}px"></div>` : ""}${hb}${svg ? `<svg class="ghist-svg" width="${W}" height="${HH}">${svg}</svg>` : ""}${pl}${rng}${vals}</div>`;
        }
      }
      host.innerHTML = `<div class="gh" style="width:${W}px;height:${thH}px">${head}</div>
        <div class="gbody" style="width:${W}px;height:${bodyH}px">${bg}${vline(today, "gv-today", "")}${vline(INS.dbut, "gv-but", "BUTOIR")}
          <svg class="glinks" width="${W}" height="${bodyH}"><defs><marker id="gArr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="#475467"/></marker></defs>${lk}</svg>
          ${bars}<svg class="gtmp" width="${W}" height="${bodyH}"></svg></div>${hist}`;
      host.__X = X; host.__d0 = d0; host.__HD = HD;
      /* R12 : poignée « = » entre le Gantt et l'histogramme, posée à la hauteur du haut de l'histogramme */
      { const hh = host.parentElement.querySelector(".dlyg-hh"); if (hh) hh.style.top = (host.offsetTop + thH + (dlyHHGet() === "full" ? 0 : bodyH) - 7) + "px"; shell.style.setProperty("--dly-hh", dlyHHpx + "px"); }
      try { dlyPickPaint(); } catch (e) {}
      host.parentElement.querySelectorAll("input.dlyp-cb[data-part]").forEach(c => { c.indeterminate = true; });
      /* défilement horizontal du Gantt gardé d'un dessin à l'autre */
      if (shell.__dlyGx !== undefined) host.scrollLeft = shell.__dlyGx;
      host.addEventListener("scroll", () => { shell.__dlyGx = host.scrollLeft; }, { passive: true });
      dlyStick(host.closest(".bdg-d-scroll, .lk-scroll"));
      dlyLift();
    };
    /* v545 (remarque 2) : bas de l'écran visible (clavier de l'iPad compris) */
    const dlyVpB = () => { const vv = window.visualViewport; return vv ? vv.offsetTop + vv.height : window.innerHeight; };
    /* histogramme (et son libellé, et la poignée « = ») gardé en bas de la zone visible du planning : les tâches défilent dessous */
    const dlyLift = () => {
      const g = shell.querySelector(".dlyg"); if (!g) return;
      const hist = g.querySelector("#dlyGantt .ghist"), lab = g.querySelector(".dlyh-lab"), hh = g.querySelector(".dlyg-hh"), gh = g.querySelector("#dlyGantt > .gh");
      if (!hist) return;
      const els = [hist, lab, hh].filter(Boolean);
      const cur = el => { const m = /translateY\((-?[\d.]+)px\)/.exec(el.style.transform || ""); return m ? +m[1] : 0; };
      const r = hist.getBoundingClientRect(), nb = r.bottom - cur(hist), nt = r.top - cur(hist);
      const scr = g.closest(".bdg-d-scroll, .lk-scroll"), visB = Math.min(scr ? scr.getBoundingClientRect().bottom : 1e9, dlyVpB());
      const minT = gh ? gh.getBoundingClientRect().bottom : nt;
      const lift = g.classList.contains("dly-hfull") ? 0 : Math.max(0, Math.min(nb - visB, nt - minT));
      const v = lift > 0.5 ? "translateY(" + (-lift).toFixed(1) + "px)" : "";
      els.forEach(el => { if (el.style.transform !== v) el.style.transform = v; el.classList.toggle("dly-lift", !!v); });
    };
    if (!shell.__dlyLiftBound) {
      shell.__dlyLiftBound = true;
      let raf = 0; const go = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; dlyLift(); }); };
      document.addEventListener("scroll", go, true); window.addEventListener("resize", go);
      if (window.visualViewport) window.visualViewport.addEventListener("resize", go);
    }
    /* en-têtes du tableau et du Gantt fixés en haut quand le bloc défile verticalement */
    const dlyStick = sc => {
      if (!sc) return;
      const run = () => {
        const g = sc.querySelector(".dlyg");
        if (!g) return;
        /* FORMAT 21 : en-têtes du PLANNING et du Gantt placés par le suivi général (défilement du bloc ET de la page) */
        document.dispatchEvent(new Event("scroll"));
      };
      if (!sc.__dlyStick) { sc.__dlyStick = true; sc.addEventListener("scroll", run, { passive: true }); }
      run();
    };
    /* ===== GÉNÉRER LE PLANNING, MAIN D'ŒUVRE, NIVELLEMENT (v403) ===== */
    /* une charge de main d'œuvre : unité en journées-homme (JH, J/H, JOUR…) ou en heures (H, comptées 8 par jour),
       ou désignation « MAIN D'ŒUVRE … » (sous-traitance comprise) */
    const dlyLabU = r => U_(r.u).replace(/[^A-Z]/g, "");
    const dlyIsLab = r => ["JH", "HJ", "J", "JR", "JOUR", "JOURS", "JOURHOMME", "JOURSHOMME", "H", "HR", "HEURE", "HEURES"].includes(dlyLabU(r)) || /MAIN\s*D.?\s*(Œ|OE)UVRE/.test(U_(r.des));
    const dlyJHof = r => { const q = num(r.q || 0) || 0; return ["H", "HR", "HEURE", "HEURES"].includes(dlyLabU(r)) ? q / 8 : q; };
    /* v547 (R22) : per = morceaux datés de la tâche (un seul le plus souvent) */
    const dlyCurDates = () => { const D = {}; dlyKeys().forEach(k => { const d = dlyDeb(k), f = dlyFin(k), L = dlyList(k); if (d && f) D[k] = { deb: d, fin: f, hs: L.length === 1 && dlyHalfS(L[0]), he: L.length === 1 && dlyHalfE(L[0]),
      per: L.filter(p => p.deb && p.fin).map(p => ({ deb: p.deb, fin: p.fin, hs: dlyHalfS(p), he: dlyHalfE(p) })) }; }); return D; };
    const dlyEnd = D => Object.values(D).map(x => x.fin).filter(Boolean).sort().pop() || "";
    /* périodes affichées : brouillon en cours (à valider) ou périodes validées */
    const insDlyList = key => (LK.dlpDraft && LK.dlpDraft[key]) || (INS.dlp || {})[key] || [];
    /* v454 : dates saisies dans le PLANNING (ou sur le Gantt) enregistrées aussitôt (annulables par ↶) */
    const dlyCommitDrafts = () => {
      if (!INS_EDIT || !LK.dlpDraft) return;
      let ch = false;
      Object.keys(LK.dlpDraft).forEach(k => {
        /* v530 : demi-journées gardées tant que la date n'a pas changé */
        INS.dlp[k] = (LK.dlpDraft[k] || []).filter(p => p.deb || p.fin).map(p => ({ id: p.id, deb: p.deb || "", fin: p.fin || "", ...(dlyHalfS(p) ? { dmd: p.deb } : {}), ...(dlyHalfE(p) ? { fmd: p.fin } : {}) }));
        if (!INS.dlp[k].length) delete INS.dlp[k];
        delete LK.dlpDraft[k]; ch = true;
      });
      if (ch) setTimeout(() => insSave(), 0);
    };
    /* tâche choisie par les ronds (lot + activité secondaire), ou tâches de l'activité primaire choisie : surlignées */
    /* v464 : ronds pleins (désignation, lot, activités, produits, charges) → tâches des liaisons correspondantes surlignées
       dans le PLANNING (ligne et barre), les autres grisées ; null = aucun rond plein */
    const dlyPickSet = () => {
      const ch = ["des", "lot", "prim", "sec"].filter(k => LK[k]);
      const cp = Object.keys(LK.prd || {}), cc = Object.keys(LK.chg || {});
      /* v538 : rond d'un titre de lots (ou rond d'en-tête) = ses tâches surlignées dans le PLANNING */
      if (!ch.length && !cp.length && !cc.length && LK.all && LK.all.lot) return new Set(dlyKeys().filter(k => lkOn("lot", k.split("|")[0])));
      if (!ch.length && !cp.length && !cc.length) return null;
      const S = new Set();
      (INS.links || []).filter(l => ch.every(k => l[k] === LK[k]) && cp.every(id => (l.prd || []).some(x => x.id === id)) && cc.every(id => (l.chg || []).some(x => x.id === id)))
        .forEach(l => S.add(l.lot + "|" + l.sec));
      if (LK.lot && LK.sec && !LK.des && !cp.length && !cc.length) S.add(LK.lot + "|" + LK.sec);
      return S;
    };
    const dlyPicked = k => { const S = shell.__dlyPS; return !!(S && S.has(k)); };
    const dlyPickPaint = () => {
      const S = shell.__dlyPS, box = shell.querySelector(".dlyg");
      if (!box) return;
      box.classList.toggle("dly-picking", !!S);
      const R = shell.__dlyRows || [];
      box.querySelectorAll("#dlyGantt .gb[data-key], #dlyGantt .gb-n[data-key]").forEach(b => { const on = !!(S && S.has(b.dataset.key)); b.classList.toggle("gb-pick", on); b.classList.toggle("gb-dim", !!S && !on); });
      box.querySelectorAll("#dlyGantt [data-path]").forEach(b => { const g = R.find(r => r.grp && r.path === b.dataset.path); const on = !!(S && g && g.all.some(t => S.has(t.key))); b.classList.toggle("gb-dim", !!S && !on); });
      box.querySelectorAll(".dlyg-l tr.dly-grp").forEach(tr => { const g = R.find(r => r.grp && r.path === tr.dataset.path); const on = !!(S && g && g.all.some(t => S.has(t.key))); tr.classList.toggle("dly-dim", !!S && !on); });
      box.querySelectorAll(".dlyg-l tr.dly-task").forEach(tr => { const on = !!(S && S.has(tr.dataset.key)); tr.classList.toggle("dly-dim", !!S && !on); });
    };
    shell.__dlyPickPaint = dlyPickPaint;
    /* tableau caché : ouvert jusqu'à la colonne DURÉE (J) (même règle que le toucher de la pastille) */
    const dlyOpenToDur = () => {
      const g = shell.querySelector(".dlyg"), L = g && g.querySelector(".dlyg-l");
      if (!L || L.getBoundingClientRect().width > 2) return;
      const gw = g.getBoundingClientRect();
      L.style.width = Math.round(gw.width - 3) + "px"; L.style.maxWidth = "none";
      const th = [...L.querySelectorAll("thead th")].find(t => /^DURÉE/.test((t.textContent || "").trim()));
      let w = th ? Math.round(th.getBoundingClientRect().right - L.getBoundingClientRect().left + L.scrollLeft + 1) : (shell.__dlygPrevW || Math.round(gw.width * 0.55));
      w = Math.max(60, Math.min(Math.round(gw.width - 3), w));
      L.scrollLeft = 0; L.style.width = w + "px";
      shell.__dlygPrevW = w; g.classList.remove("tbl-hid");
      shell.__dlygW = { ins: INS, ref: DLYG_REF, w, auto: false };
      if (window.__sviViewSave) window.__sviViewSave();
      const host = g.querySelector("#dlyGantt"); if (host) { host.__drawn = false; dlyGanttDraw(); }
    };
    shell.__dlyOpenToDur = dlyOpenToDur;
    const dlyCellIn = (x, f) => {
      if (!INS_EDIT) return esc(f === "dur" ? x.dur : dFr(x[f]));
      /* v547 (R22) : tâche en morceaux — DÉBUT du premier, FIN du dernier (pastille du nombre de morceaux), DURÉE = somme ; un toucher = fenêtre MORCEAUX */
      if (x.per && x.per.length > 1) return `<span class="dlp-multi" data-task="${esc(x.key)}" role="button">${esc(f === "dur" ? String(x.dur) : dFr(x[f]))}${f === "fin" ? `<b class="dlp-pcn">${x.per.length}</b>` : ""}</span>`;
      const p = (insDlyList(x.key) || [])[0] || {};
      const nw = !x.deb && !x.fin;
      return `<input class="ins-in dlp-in${f === "dur" ? " number" : " center"}" data-task="${esc(x.key)}" data-pid="${esc(p.id || "")}" data-f="${f}" type="text"
        ${f === "dur" ? "" : "readonly"} inputmode="${f === "dur" ? "numeric" : "none"}" placeholder="${nw && f !== "dur" ? "SAISIR ICI…" : ""}" value="${esc(f === "dur" ? (x.dur || (shell.__dlyPendDur || {})[x.key] || "") : dFr(x[f]))}">`;
    };
    const insDlyHTML = (edit, err) => {
      INS.dlp = INS.dlp || {};
      if (edit) {
        /* saisie : les périodes de la tâche primaire choisie (les ronds du haut disent laquelle) */
        /* v454 : plus d'écran de saisie d'une seule tâche ni de récapitulatif — toujours le PLANNING ;
           la tâche choisie (ou les tâches de l'activité primaire choisie) y est surlignée */
        {
          dlyCommitDrafts();
          /* R15 (23/10/2026) : une tâche sans dates n'est plus mise au début du projet pour 1 jour (v457 retiré) : 0 jour, à son rang */
          /* PLANNING (FORMAT 64, 90) : tableau à gauche (lots repliables, tâches), Gantt à droite, lignes alignées */
          /* liaisons non respectées (anciennes dates, import) : corrigées à l'ouverture du planning */
          if (INS_EDIT && dlyRespect(false)) setTimeout(() => insSave(), 0);
          /* un seul ordre : la première fois, le bloc TÂCHES prend l'ordre du PLANNING */
          if (INS_EDIT && !INS.ordSyncV1 && dlyKeys().length) { INS.ordSyncV1 = true; dlyTasksFromPlan(); setTimeout(() => { insSave(); refreshAll(); }, 0); }
          shell.__dlyPS = dlyPickSet();
          const PR = dlyPlanRows();
          shell.__dlyRows = PR.rows;
          lastShown.detail = { cols: DLY_COLS_P, rows: PR.flat, kind: "dly" };
          requestAnimationFrame(() => dlyGanttDraw());
          const ind = n => `style="padding-left:${6 + n * 20}px"`;
          /* v538 : lots du PLANNING = mêmes ronds que les lots du bloc TÂCHES — un lot : son rond (le choisir) ;
             un titre (ou un lot qui a des sous-lots) : pastille chiffrée = toutes ses lignes, sous-titres allumés, parent à moitié */
          const dlyGrpRd = path => {
            if (!INS_EDIT) return "";
            const P = dlyLotPath(path), r = INS.lot.find(l => !l.t && U_(l.v) === U_(P.join(" / ")));
            const kids = INS.lot.some(l => !l.t && l !== r && lotUnder(l, P));
            return r && !kids ? lkRd("lot", r).replace('<span class="lk-rd', `<span data-iid="${r.id}" class="dly-grd lk-rd`) : `<span class="dly-grd">${lkRdPart("lot", P.join(" / "))}</span>`;
          };
          /* cases à cocher (FORMAT 64) : la case d'un lot coche toutes ses tâches */
          const SEL = shell.__dlySel = shell.__dlySel || new Set();
          const allK = new Set(PR.flat.map(x => x.key));
          [...SEL].forEach(k => { if (!allK.has(k)) SEL.delete(k); });
          const nm = (kind, attr, v) => `<input class="dly-nm" data-kind="${kind}" ${attr} value="${esc(v)}" autocomplete="off" enterkeyhint="next">`;
          /* dernière ligne « SAISIR ICI… » : LOT et ACTIVITÉ SECONDAIRE tapés (existants proposés, ou nouveaux) = nouvelle tâche du planning,
             sans produit ni charge, non liée (rouge dans TÂCHES) ; ses dates se saisissent aussitôt (cahier, Planning budgétaire) */
          const dl = (id, list) => `<datalist id="${id}">${list.map(v => `<option value="${esc(v)}"></option>`).join("")}</datalist>`;
          const newIn = (f, lid) => `<input class="dly-newin" data-f="${f}" list="${lid}" placeholder="SAISIR ICI…" autocomplete="off" enterkeyhint="next">`;
          const tbl = dlyTable(PR.rows.concat(INS_EDIT ? [{ nw: true }] : []), x => x.nw
            ? { lot: newIn("lot", "dlyLotDl"), sec: newIn("sec", "dlySecDl"), pred: "", succ: "", deb: "", fin: "", dur: "", marge: "", jal: "", __cb: "", __td_marge: " dly-calc", __td_succ: " dly-calc" }
            : x.grp
            ? { lot: `<span class="dly-lotc" ${ind(x.lvl)}>${dlyGrpRd(x.path)}<span class="dly-fold" data-path="${esc(x.path)}"><b>${x.fold ? "›" : "⌄"}</b></span>${lotNoHTML(x.lab)}${nm("grp", `data-path="${esc(x.path)}"`, x.lab.name)}</span>`, sec: "", pred: "", succ: "", __td_succ: " dly-calc",
                deb: `<b>${esc(dFr(x.deb))}</b>`, fin: `<b>${esc(dFr(x.fin))}</b>`, dur: x.dur === "" ? "" : `<b>${x.dur}</b>`, marge: "", jal: "", __td_marge: " dly-calc",
                __cb: `<input type="checkbox" class="dlyp-cb" data-path="${esc(x.path)}"${x.all.length && x.all.every(t => SEL.has(t.key)) ? " checked" : ""}${x.all.some(t => SEL.has(t.key)) && !x.all.every(t => SEL.has(t.key)) ? " data-part=\"1\"" : ""}>` }
            : x.ext
            ? { lot: "", sec: `<span class="dly-lotc dly-extn" ${ind(0)}>${esc(lotLab(dlyLotPath(x.lot)).full)} › ${esc(x.sec)}</span>`, pred: esc(x.pred), succ: esc(x.succ), __td_succ: " dly-calc", deb: esc(dFr(x.deb)), fin: esc(dFr(x.fin)), dur: x.dur === "" ? "" : x.dur,
                marge: x.marge === "" ? "" : x.marge, jal: x.jal ? "★" : "", __cb: "", __td_marge: " dly-calc" }
            : { lot: "", sec: `<span class="dly-lotc" ${ind(x.lvl)}>${x.away ? `<span class="dly-ldot" style="--c:${dlyLotColor(x.lo)}" title="${esc(lotLab(dlyLotPath(x.lot)).full)}"></span>` : ""}${x.vno ? `<b class="lvl-no dly-vno">${esc(x.vno)}</b><span class="dly-vsep">›</span>` : ""}${dlyIncHTML(x.key)}${INS_EDIT ? `<span class="lk-rd dly-rd${LK.lot === x.key.split("|")[0] && LK.sec === x.key.split("|")[1] ? " on" : dlyPicked(x.key) ? " lnk" : ""}" data-dkey="${esc(x.key)}" role="button" aria-label="Voir ce qui est lié à la tâche"></span>` : ""}${nm("sec", `data-sid="${esc(x.key.split("|")[1])}"`, x.sec)}</span>`, pred: `<span class="dly-pred" data-key="${esc(x.key)}">${esc(x.pred) || "<i>CHOISIR…</i>"}</span>`, succ: x.succ ? `<span class="dly-succ" data-key="${esc(x.key)}">${esc(x.succ)}</span>` : "", __td_succ: " dly-calc",
                deb: dlyCellIn(x, "deb"), fin: dlyCellIn(x, "fin"), dur: dlyCellIn(x, "dur"), marge: x.marge === "" ? "" : x.marge,
                __td_deb: INS_EDIT ? " ins-td" : "", __td_fin: INS_EDIT ? " ins-td" : "", __td_dur: INS_EDIT ? " ins-td" : "",
                jal: `<span class="dly-jal${x.jal ? " on" : ""}" data-key="${esc(x.key)}">${x.jal ? "★" : "☆"}</span>`, __td_marge: " dly-calc",
                __cb: `<input type="checkbox" class="dlyp-cb" data-key="${esc(x.key)}"${SEL.has(x.key) ? " checked" : ""}>` },
            x => x.nw ? `class="dly-new ins-new"` : x.grp ? `class="dly-grp${x.det ? " dly-det" : ""}" data-path="${esc(x.path)}"` : `class="dly-task${x.ext ? " dly-ext" : ""}${x.off ? " dly-off" : ""}${!x.deb || !x.fin ? " dly-nod" : ""}${x.marge === 0 ? " dly-crit" : ""}${dlyPicked(x.key) ? " dly-pick" : ""}${LK.lot && LK.sec && x.key === LK.lot + "|" + LK.sec ? " dly-sel" : ""}${(INS.links || []).some(l => l.lot + "|" + l.sec === x.key) ? " dly-lnk" : ""}" data-key="${esc(x.key)}"`, true, DLY_COLS_P);
          /* FORMAT 64 / 33 : pas de ligne d'explication au-dessus du PLANNING */
          /* FORMAT 97 : commandes du planning dans le menu ⋯ du bloc détail (plus de rangée de boutons) */
          const dls = dl("dlyLotDl", [...new Set(INS.lot.filter(x => !x.t).map(x => x.v))].sort((a, b) => a.localeCompare(b, "fr")))
            + dl("dlySecDl", [...new Set(INS.sec.map(x => x.v))].sort((a, b) => a.localeCompare(b, "fr")));
          /* v546 (R26) : plus de bandeau VUE PAR DÉBUT (la vue se choisit dans le menu ⋯) */
          const viewB = "";
          const isoB = viewB + (PR.iso ? `<div class="dly-iso"><span>ISOLÉ : <b>${esc(lotLab(dlyLotPath(PR.iso)).full)}</b></span><small>LIAISONS, DÉCALAGES ET CALENDRIER RESTENT APPLIQUÉS · TÂCHES LIÉES HORS DE LA BRANCHE EN GRIS (LECTURE SEULE)</small><button type="button" class="dly-iso-x">TOUT AFFICHER</button></div>` : "");
          return dls + isoB + `<div class="dlyg${(() => { const o = shell.__dlygW; return dlygMine(o) && o.w < 3 ? " tbl-hid" : ""; })()}${dlyHHGet() === "full" ? " dly-hfull" : ""}${dlyHHGet() === 0 ? " dly-hnone" : ""}"><div class="dlyg-l"${(() => { const o = shell.__dlygW; return dlygMine(o) ? ` style="width:${o.w}px;max-width:none"` : ""; })()}>${tbl}</div><div class="dlyg-sp"><span class="dlyg-hd" title="Largeur du tableau et du Gantt"><i>=</i></span></div><div class="dlyg-r" id="dlyGantt"></div>${PR.flat.length ? `<div class="dlyg-hh"><span class="dlyhh-pill" title="Hauteur de l'histogramme">=</span>${dlyHHGet() !== 0 ? `<span class="dlyhh-cfg" role="button" title="RÉGLAGES DE L'HISTOGRAMME">⚙</span>` : ""}</div>` : ""}</div>`
            + `<div class="dly-add"><button type="button" class="dly-pred-new">+ AJOUTER UNE TÂCHE OU SES DÉLAIS</button></div>`;
        }
      }
      const all = [];
      insTasks().forEach(t => {
        const ps = [...(INS.dlp[t.key] || [])].sort((a, b) => String(a.deb || "9").localeCompare(String(b.deb || "9")));
        ps.slice(0, 1).forEach(p => all.push({ task: t.key, pid: p.id, on: p.on === true, lot: t.lot, sec: t.sec, deb: p.deb || "", fin: p.fin || "",
          dur: p.deb && p.fin ? dDur(p.deb, p.fin) : "" }));
        /* mode SAISIE : seulement les périodes saisies (en mode LIAISONS) */
        if (edit && !ps.length) all.push({ task: t.key, pid: "", lot: t.lot, sec: t.sec, deb: "", fin: "", dur: "", nw: true });
      });
      /* ordre par défaut : chronologique (début), puis alphabétique */
      all.sort((a, b) => String(a.deb || "9").localeCompare(String(b.deb || "9")) || a.lot.localeCompare(b.lot, "fr") || a.sec.localeCompare(b.sec, "fr") || (a.nw - b.nw));
      const rows = cfApply("dlys", DLY_COLS_S, all);
      lastShown.detail = { cols: DLY_COLS_S, rows: rows.filter(x => !x.nw), kind: "dly" };
      const inp = (x, f) => edit
        ? `<input class="ins-in dlp-in${f === "dur" ? " number" : " center"}" data-task="${x.task}" data-pid="${x.pid}" data-f="${f}" type="text"
            ${f === "dur" ? "" : "readonly"} inputmode="${f === "dur" ? "numeric" : "none"}" placeholder="${x.nw && f === "deb" ? "SAISIR ICI…" : f === "dur" ? "" : "JJ/MM/AAAA"}" value="${esc(f === "dur" ? (x.dur || (shell.__dlyPendDur || {})[x.task] || "") : dFr(x[f]))}">`
        : esc(f === "dur" ? x.dur : dFr(x[f]));
      const td = edit ? " ins-td" : "";
      return (err ? `<div class="lk-err dlp-err">${esc(err)}</div>` : "") + dlyTable(rows, x => ({ lot: esc(x.lot), sec: esc(x.sec),
        deb: inp(x, "deb"), fin: inp(x, "fin"), dur: inp(x, "dur"),
        __td_deb: td, __td_fin: td, __td_dur: td,
        __cb: edit && x.pid ? `<input type="checkbox" class="dlp-cb" data-task="${x.task}" data-pid="${x.pid}" ${x.on ? "checked" : ""}>` : "",
        __x: "" }),
        x => `class="${x.nw ? "ins-new" : ""}"`, edit, DLY_COLS_S);
    };
    /* saisie : début + durée → fin ; fin → durée ; refus d'un chevauchement dans la même tâche */
    if (!shell.__dlyBound) {
      shell.__dlyBound = true;
      shell.addEventListener("change", e => {
        const X = shell.__insDly;
        const cb = e.target.closest && e.target.closest("input.dlp-cb, input.dlp-cball");
        if (cb && X) {
          const D = X.draft();
          const boxes = cb.classList.contains("dlp-cball") ? [...cb.closest("table").querySelectorAll("input.dlp-cb")] : [cb];
          boxes.forEach(b => { const p = (D[b.dataset.task] || []).find(x => x.id === b.dataset.pid); if (p) { p.on = cb.checked; b.checked = cb.checked; } });
          const all = cb.closest("table").querySelector("input.dlp-cball");
          const list = [...cb.closest("table").querySelectorAll("input.dlp-cb")];
          if (all) all.checked = list.length > 0 && list.every(b => b.checked);
          X.insSave();
          return;
        }
        const i = e.target.closest && e.target.closest("input.dlp-in");
        if (!i || !X) return;
        const D = X.draft();
        const task = i.dataset.task;
        const list = D[task] = D[task] || ((X.INS.dlp || {})[task] || []).map(p => ({ ...p }));
        /* une seule période par tâche (fragmentation reportée) */
        let p = list.find(x => x.id === i.dataset.pid) || list[0];
        const q = p ? { ...p } : { id: X.insId(), deb: "", fin: "" };
        const cal = X.cal();
        const f = i.dataset.f, v = i.value.trim();
        const durOld = q.deb && q.fin ? sviWDur(cal, q.deb, q.fin) : 0;
        X.err = "";
        if (f === "dur") {
          if (v === "") q.fin = "";
          else if (!/^\d+$/.test(v) || Number(v) < 1) X.err = "DURÉE NON VALIDE : NOMBRE DE JOURS TRAVAILLÉS ATTENDU (1 = DÉBUT ET FIN LE MÊME JOUR).";
          else if (q.deb) q.fin = sviWFin(cal, q.deb, Number(v));
          else if (q.fin) q.deb = sviWDeb(cal, q.fin, Number(v));   /* FIN + DURÉE → DÉBUT */
          else { (shell.__dlyPendDur = shell.__dlyPendDur || {})[task] = Number(v); }   /* DURÉE d'abord : gardée, la première date calculera l'autre */
        } else {
          const iso = X.dParse(v);
          if (iso === null) X.err = "DATE NON VALIDE : FORMAT JJ/MM/AAAA.";
          else if (iso && !sviWork(cal, iso)) X.err = "JOUR NON TRAVAILLÉ DANS LE CALENDRIER DU BUDGET.";
          else {
            q[f] = iso;
            const pd = (shell.__dlyPendDur || {})[task];
            if (pd && iso && !(f === "deb" ? q.fin : q.deb)) { if (f === "deb") q.fin = sviWFin(cal, iso, pd); else q.deb = sviWDeb(cal, iso, pd); }
          }
        }
        if (q.deb && q.fin && shell.__dlyPendDur) delete shell.__dlyPendDur[task];
        if (X.err) { svToast(X.err, 4000, i); X.err = ""; X.render(); return; }
        /* mêmes contrôles et même fenêtre TÂCHES SUIVANTES que le Gantt */
        if (!X.apply(task, q, { anchor: i, fromDur: f === "dur" })) return;
        /* DÉBUT, FIN, DURÉE : dès que deux valeurs sont connues, la troisième est calculée ; sinon le curseur va à celle qui manque */
        const done = q.deb && q.fin;
        /* DURÉE saisie d'abord : on touche la date de son choix (DÉBUT ou FIN), le curseur ne bouge pas */
        const nx = done || (f === "dur" && !q.deb && !q.fin) ? "" : (q.deb ? "fin" : "deb");
        const el = !done && (i.closest("#dlyAddW") || shell).querySelector(`input.dlp-in[data-task="${task}"][data-f="${nx}"]`);
        if (el) { el.focus(); try { el.select(); } catch (err) {} }
      });
      /* SUPPRIMER LES LIGNES COCHÉES (menu ⋯) : périodes cochées */
      shell.__insDlyDel = () => {
        const X = shell.__insDly;
        if (!X) return;
        const D = X.draft();
        const n = Object.values(D).reduce((t, l) => t + l.filter(p => p.on === true).length, 0);
        if (!n) return;
        svConfirm({ title: "SUPPRIMER LES DATES COCHÉES", text: "LES DATES DE " + n + " TÂCHE(S) SERONT SUPPRIMÉES.", ok: "SUPPRIMER" }).then(go => {
          if (!go) return;
          Object.keys(D).forEach(k => { D[k] = D[k].filter(p => p.on !== true); });
          X.render();
        });
      };
      shell.addEventListener("click", e => {
        const X = shell.__insDly;
        const xa = e.target.closest && e.target.closest(".dlp-xall");
        if (xa && X) {
          e.stopPropagation();
          shell.__insDlyDel();
          return;
        }
        const b = e.target.closest && e.target.closest(".dlp-x");
        if (!b || !X) return;
        e.stopPropagation();
        svConfirm({ title: "SUPPRIMER LA PÉRIODE", text: "LA PÉRIODE SERA SUPPRIMÉE.", ok: "SUPPRIMER" }).then(go => {
          if (!go) return;
          const D = X.draft();
          D[b.dataset.task] = (D[b.dataset.task] || []).filter(x => x.id !== b.dataset.pid);
          X.render();
        });
      }, true);
    }
    /* brouillon des délais de la tâche choisie : copie des périodes validées, enregistrée par ✓ VALIDER LA LIAISON */
    /* calendrier des délais : dates refusées grisées (fin avant début, début après fin, chevauchement
       avec une autre période de la même tâche secondaire) */
    window.__sviDlyCal = el => {
      if (!INS_EDIT) return null;
      const D = dlyDraft(), list = D[el.dataset.task] || (INS.dlp || {})[el.dataset.task] || [];
      const q = list.find(x => x.id === el.dataset.pid) || list[0] || { deb: "", fin: "" };
      const f = el.dataset.f, pf = dlyPredFin(el.dataset.task), cal = insCal();
      /* FORMAT 10 : une date grisée = une date que la saisie refuserait (jour non travaillé, fin avant début,
         fin après la date butoir, début avant la date exigée par les liaisons) ; une FIN qui dépasse une tâche suivante reste choisissable */
      const dis = d => {
        if (!sviWork(cal, d)) return true;
        const z = { ...q, [f]: d };
        if (z.deb && z.fin && z.fin < z.deb) return true;
        if (z.fin && INS.dbut && z.fin > INS.dbut) return true;
        if (z.deb && pf && z.deb < pf) return true;
        return false;
      };
      return { iso: q[f] || (f === "fin" ? q.deb : "") || "", dis };
    };
    /* fenêtre PRÉDÉCESSEURS (ou AJOUTER UNE TÂCHE) : lot à gauche, activités secondaires à droite ;
       toutes les tâches, liées ou non ; la tâche elle-même et celles qui feraient une boucle sont grisées */
    const dlyPickPreds = key => {
      const add = !key;
      const sel = new Set(add ? [] : dlyPreds(key));
      /* type et décalage de chaque liaison (FIN → DÉBUT, 0 par défaut ; jamais négatif) */
      const meta = {};
      if (!add) dlyLinks(key).forEach(x => { meta[x.k] = { t: x.t === "DD" ? "DD" : "FD", o: Math.max(0, Number(x.o) || 0) }; });
      const mt = k => meta[k] || (meta[k] = { t: "FD", o: 1 });
      let lot = ([...sel][0] || "").split("|")[0] || (INS.lot.find(x => !x.t) || {}).id || "";
      const d = document.createElement("div");
      d.id = "svConf";
      const nSel = lo => [...sel].filter(k => k.startsWith(lo + "|")).length;
      const size = (() => { try { return JSON.parse(localStorage.getItem("svi_dpk_v1") || "null"); } catch (e) { return null; } })();
      const draw = () => {
        const sc = [...d.querySelectorAll(".dpk-col")].map(c => c.scrollTop);
        const LC = [["v", "LOT", r => r.v || "", ""]], SC = [["v", "ACTIVITÉ SECONDAIRE", r => r.v || "", ""]];
        const lotsAll = INS.lot.filter(x => !x.t), secsAll = INS.sec.filter(x => !x.t);
        const lots = cfApply("dpk_lot", LC, lotsAll), secs = cfApply("dpk_sec", SC, secsAll);
        /* AJOUTER : une tâche déjà dans le planning n'est pas proposée (grisée ; ses dates se saisissent en touchant sa ligne) */
        const inPlan = new Set(add ? dlyKeys() : []);
        const okSec = x => { const k = lot + "|" + x.id; return add ? !inPlan.has(k) : !(k === key || dlyReach(k, key)); };
        const allOn = secs.filter(okSec).length && secs.filter(okSec).every(x => sel.has(lot + "|" + x.id));
        const card = d.querySelector(".dpk-card");
        const w = card ? card.style.width : (size && size.w ? size.w + "px" : ""), h = card ? card.style.height : (size && size.h ? size.h + "px" : "");
        d.innerHTML = `<div class="svc-card dpk-card" role="dialog" aria-modal="true" style="${w ? "width:" + w + ";" : ""}${h ? "height:" + h + ";" : ""}">
          <button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
          <div class="svc-t">${add ? "AJOUTER UNE TÂCHE OU SES DÉLAIS" : "PRÉDÉCESSEURS — " + esc(dlyName(key))}</div>
          <div class="dpk-cols">
            <div class="dpk-col"><table class="dpk-t"><thead><tr>${cfHead("dpk_lot", "v", "LOT " + svCnt(lots.length, lotsAll.length))}</tr></thead>
              <tbody>${lots.map(x => `<tr class="dpk-lot${x.id === lot ? " cur" : ""}${nSel(x.id) ? " chosen" : ""}" data-lot="${x.id}"><td>${esc(x.v)}${nSel(x.id) ? " " + svCnt(nSel(x.id)) : ""}</td></tr>`).join("")}</tbody></table></div>
            <div class="dpk-col"><table class="dpk-t"><thead><tr>${cfHead("dpk_sec", "v", "ACTIVITÉ SECONDAIRE " + svCnt(secs.length, secsAll.length))}${add ? "" : '<th class="center dpk-ty">TYPE<span class="col-rs" data-rs="dpk_ty"></span></th><th class="center dpk-of">DÉCALAGE (J)<span class="col-rs" data-rs="dpk_of"></span></th>'}<th class="center dpk-cbh">${add ? "" : `<input type="checkbox" class="dpk-all"${allOn ? " checked" : ""}>`}</th></tr></thead>
              <tbody>${secs.map(x => { const k = lot + "|" + x.id, off = !okSec(x), on = sel.has(k);
                const lk = on ? mt(k) : null;
                const ty = add ? "" : `<td class="center dpk-ty">${on ? `<select class="dpk-t-in" data-k="${k}" data-f="t"><option value="FD"${lk.t === "FD" ? " selected" : ""}>FIN → DÉBUT</option><option value="DD"${lk.t === "DD" ? " selected" : ""}>DÉBUT → DÉBUT</option></select>` : ""}</td>
                  <td class="center dpk-of">${on ? `<input class="dpk-o-in number" data-k="${k}" data-f="o" inputmode="numeric" value="${lk.o}">` : ""}</td>`;
                return `<tr class="dpk-sec${off ? " off" : ""}${on ? " chosen" : ""}"><td>${esc(x.v)}</td>${ty}<td class="center"><input type="${add ? "radio" : "checkbox"}" name="dpk" data-k="${k}"${on ? " checked" : ""}${off ? " disabled" : ""}></td></tr>`; }).join("")}</tbody></table></div>
          </div>
          <div class="svc-f"><button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok${add && !sel.size ? " disabled" : ""}>${add ? "AJOUTER" : "VALIDER"}</button></div>
          <div class="dpk-rsz" title="Largeur et hauteur"></div></div>`;
        d.querySelectorAll(".dpk-col").forEach((c, n) => { c.scrollTop = sc[n] || 0; });
        sviDpkCols(d);
      };
      document.getElementById("svConf")?.remove();
      document.body.appendChild(d);
      draw();
      window.__sviDpkRefresh = () => { if (d.isConnected) draw(); else window.__sviDpkRefresh = null; };
      const close = () => { d.remove(); window.__sviDpkRefresh = null; };
      /* poignée d'angle : largeur et hauteur, mémorisées */
      d.addEventListener("pointerdown", e => {
        const hd = e.target.closest(".dpk-rsz");
        if (!hd) return;
        e.preventDefault();
        const card = d.querySelector(".dpk-card"), r0 = card.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
        const mv = ev => {
          const w = Math.max(420, Math.min(window.innerWidth - 16, r0.width + 2 * (ev.clientX - x0)));
          const h = Math.max(300, Math.min(window.innerHeight - 16, r0.height + 2 * (ev.clientY - y0)));
          card.style.width = w + "px"; card.style.height = h + "px";
          try { localStorage.setItem("svi_dpk_v1", JSON.stringify({ w: Math.round(w), h: Math.round(h) })); } catch (err) {}
        };
        const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
      });
      /* FORMAT 56 / 66 : appui long sur une ligne grisée = la raison */
      let lpT = null;
      d.addEventListener("pointerdown", e => {
        const r = e.target.closest("tr.dpk-sec.off");
        if (!r) return;
        clearTimeout(lpT);
        lpT = setTimeout(() => svToast(add ? "DÉJÀ DANS LE PLANNING : TOUCHER SA LIGNE POUR SAISIR SES DATES." : "IMPOSSIBLE : LA TÂCHE ELLE-MÊME OU UNE BOUCLE.", 3500, r), 550);
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach(t => d.addEventListener(t, () => clearTimeout(lpT)));
      d.addEventListener("change", e => {
        if (e.target.matches(".dpk-t-in")) { mt(e.target.dataset.k).t = e.target.value === "DD" ? "DD" : "FD"; return; }
        if (e.target.matches(".dpk-o-in")) {
          const v = String(e.target.value).trim();
          /* décalage : nombre entier de jours travaillés, jamais négatif */
          if (!/^\d*$/.test(v)) { svToast("DÉCALAGE NON VALIDE : NOMBRE DE JOURS ≥ 0.", 3500, e.target); e.target.value = mt(e.target.dataset.k).o; return; }
          mt(e.target.dataset.k).o = Number(v || 0); e.target.value = mt(e.target.dataset.k).o; return;
        }
        if (e.target.matches(".dpk-all")) {
          d.querySelectorAll("input[data-k]:not([disabled])").forEach(c => { if (e.target.checked) sel.add(c.dataset.k); else sel.delete(c.dataset.k); });
          draw(); return;
        }
        const c = e.target.closest("input[type=checkbox][data-k], input[type=radio][data-k]");
        if (!c) return;
        if (add) { sel.clear(); if (c.checked) sel.add(c.dataset.k); } else if (c.checked) sel.add(c.dataset.k); else sel.delete(c.dataset.k);
        draw();
      });
      d.addEventListener("click", e => {
        const cfb = e.target.closest(".cf-btn");
        if (cfb) { e.stopPropagation(); cfOpenMenu(cfb); return; }
        if (e.target === d || e.target.closest("[data-x]")) { close(); return; }
        const l = e.target.closest("[data-lot]");
        if (l) { lot = l.dataset.lot; draw(); return; }
        if (!e.target.closest("[data-ok]") || e.target.closest("[data-ok]").disabled) return;
        close();
        if (add) { const k = [...sel][0]; if (k && shell.__insDly) shell.__insDly.go(k); return; }
        INS.dpred = INS.dpred || {};
        if (sel.size) INS.dpred[key] = [...sel].map(k => ({ k, t: mt(k).t, o: mt(k).o })); else delete INS.dpred[key];
        insSave();
        histLog("DÉLAIS", "PRÉDÉCESSEURS", dlyName(key) + " : " + (dlyPredTxt(key) || "AUCUN"));
        /* liaisons toujours respectées (cahier, Planning budgétaire) : décalage automatique, sans fenêtre */
        const pf = dlyPredFin(key), st = dlyDeb(key);
        if (pf && st && st < pf) dlyRespect(true);
        refreshAll();
      });
    };
    /* fenêtre AJOUTER UNE TÂCHE AU PLANNING (FORMAT 66) : on ne crée pas de tâche, on donne ses dates à une tâche du budget.
       Lots à gauche, activités secondaires à droite (toutes) ; rouge = au moins une tâche sans ses deux dates, noir = tout daté,
       gris = aucune tâche (ou, une ligne étant choisie de l'autre côté, ne forme pas de tâche avec elle) — tout reste touchable ;
       un lot et une activité choisis : DÉBUT, FIN, DURÉE (J) se saisissent dans la fenêtre, une tâche à la fois */
    const dlyAddWin = (lot0, sec0) => {
      let lot = lot0 || "", sec = sec0 || "";
      const d = document.createElement("div");
      d.id = "dlyAddW";
      const size = (() => { try { return JSON.parse(localStorage.getItem("svi_dpk_v1") || "null"); } catch (e) { return null; } })();
      const dated = k => !!(dlyDeb(k) && dlyFin(k));
      const st = keys => !keys.length ? "none" : keys.some(k => !dated(k)) ? "red" : "black";
      const draw = () => {
        if (!d.isConnected) return;
        const sc = [...d.querySelectorAll(".dpk-col")].map(c => c.scrollTop);
        const T = dlyKeys();
        const LC = [["v", "LOT", r => r.v || "", ""]], SC = [["v", "ACTIVITÉ SECONDAIRE", r => r.v || "", ""]];
        const lotsAll = INS.lot.filter(x => !x.t), secsAll = INS.sec.filter(x => !x.t);
        const lots = cfApply("dpk_lot", LC, lotsAll), secs = cfApply("dpk_sec", SC, secsAll);
        const lotSt = x => st(T.filter(k => k.split("|")[0] === x.id && (!sec || k.split("|")[1] === sec)));
        const secSt = x => st(T.filter(k => k.split("|")[1] === x.id && (!lot || k.split("|")[0] === lot)));
        const card = d.querySelector(".dpk-card");
        const w = card ? card.style.width : (size && size.w ? size.w + "px" : ""), h = card ? card.style.height : (size && size.h ? size.h + "px" : "");
        const key = lot && sec ? lot + "|" + sec : "";
        /* FORMAT 66 : ligne SAISIR ICI… en bas de chaque liste = nouveau lot / nouvelle activité, choisi aussitôt */
        const newRow = k => `<tr class="dlw-newr"><td><input class="dlw-new" data-k="${k}" placeholder="SAISIR ICI…" autocomplete="off" enterkeyhint="done"></td></tr>`;
        let panel = "";
        if (key) {
          const p0 = ((LK.dlpDraft && LK.dlpDraft[key]) || (INS.dlp || {})[key] || [])[0] || {};
          const dur = p0.deb && p0.fin ? dDur(p0.deb, p0.fin) : ((shell.__dlyPendDur || {})[key] || "");
          const s0 = T.includes(key) ? (dated(key) ? "black" : "red") : "none";
          const inp = (f, v, ph) => `<input class="ins-in dlp-in dlw-in${f === "dur" ? " number" : " center"}" data-task="${esc(key)}" data-pid="${esc(p0.id || "")}" data-f="${f}" type="text" ${f === "dur" ? "" : "readonly"} inputmode="${f === "dur" ? "numeric" : "none"}" placeholder="${ph}" value="${esc(v)}">`;
          /* pas d'intitulé ni d'état au-dessus des dates : la tâche se lit déjà dans les deux listes */
          panel = `<div class="dlw-p"><div class="dlw-f"><label>DÉBUT${inp("deb", dFr(p0.deb || ""), "SAISIR ICI…")}</label><label>FIN${inp("fin", dFr(p0.fin || ""), "SAISIR ICI…")}</label><label>DURÉE (J)${inp("dur", dur, "")}</label></div></div>`;
        }
        d.innerHTML = `<div class="svc-card dpk-card" role="dialog" aria-modal="true" style="${w ? "width:" + w + ";" : ""}${h ? "height:" + h + ";" : ""}">
          <button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
          <div class="svc-t">AJOUTER UNE TÂCHE OU SES DÉLAIS</div>
          <div class="dpk-cols">
            <div class="dpk-col"><table class="dpk-t"><thead><tr>${cfHead("dpk_lot", "v", "LOT " + svCnt(lots.length, lotsAll.length))}</tr></thead>
              <tbody>${lots.map(x => `<tr class="dpk-lot dlw-r dlw-${lotSt(x)}${x.id === lot ? " cur" : ""}" data-lot="${x.id}"><td>${esc(x.v)}</td></tr>`).join("")}${newRow("lot")}</tbody></table></div>
            <div class="dpk-col"><table class="dpk-t"><thead><tr>${cfHead("dpk_sec", "v", "ACTIVITÉ SECONDAIRE " + svCnt(secs.length, secsAll.length))}</tr></thead>
              <tbody>${secs.map(x => `<tr class="dpk-sec dlw-r dlw-${secSt(x)}${x.id === sec ? " cur" : ""}" data-sec="${x.id}"><td>${esc(x.v)}</td></tr>`).join("")}${newRow("sec")}</tbody></table></div>
          </div>${panel}
          <div class="svc-f"><button type="button" class="svc-b" data-x>FERMER</button></div>
          <div class="dpk-rsz" title="Largeur et hauteur"></div></div>`;
        d.querySelectorAll(".dpk-col").forEach((c, n) => { c.scrollTop = sc[n] || 0; });
        sviDpkCols(d);
      };
      document.getElementById("dlyAddW")?.remove();
      shell.appendChild(d);
      draw();
      /* ouverte sur une tâche (nouvelle tâche tapée dans le PLANNING) : calendrier de DÉBUT ouvert */
      if (lot && sec) setTimeout(() => { const i = d.querySelector('input.dlw-in[data-f="deb"]'); if (i && !i.value) i.focus(); }, 0);
      window.__sviDpkRefresh = () => { if (d.isConnected) draw(); else window.__sviDpkRefresh = null; };
      const close = () => { d.remove(); window.__sviDpkRefresh = null; document.getElementById("svCal")?.remove(); };
      d.addEventListener("pointerdown", e => {
        const hd = e.target.closest(".dpk-rsz");
        if (!hd) return;
        e.preventDefault();
        const card = d.querySelector(".dpk-card"), r0 = card.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
        const mv = ev => {
          const w = Math.max(420, Math.min(window.innerWidth - 16, r0.width + 2 * (ev.clientX - x0)));
          const h = Math.max(300, Math.min(window.innerHeight - 16, r0.height + 2 * (ev.clientY - y0)));
          card.style.width = w + "px"; card.style.height = h + "px";
          try { localStorage.setItem("svi_dpk_v1", JSON.stringify({ w: Math.round(w), h: Math.round(h) })); } catch (err) {}
        };
        const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
      });
      /* une date saisie (gérée comme dans le PLANNING) : la fenêtre se redessine (couleurs, durée) */
      /* FORMAT 65 : une seule date connue = le calendrier de l'autre date s'ouvre tout seul */
      d.addEventListener("change", e => { const i = e.target.closest("input.dlw-in"); if (!i) return; const f = i.dataset.f; setTimeout(draw, 0);
        setTimeout(() => { draw(); if (!d.isConnected || (f !== "deb" && f !== "fin")) return;
          const g = q => d.querySelector('input.dlw-in[data-f="' + q + '"]'), o = g(f === "deb" ? "fin" : "deb");
          if (o && !o.value && g(f) && g(f).value) { o.focus(); sviCalOpen(o); } }, 400); });
      /* nouveau lot / nouvelle activité tapé dans la fenêtre : repris s'il existe déjà (même nom), sinon créé (non lié) */
      const addNew = i => {
        if (i.dataset.done) return;
        const k = i.dataset.k, raw = U_(sviClean(i.value));
        const v = k === "lot" ? dlyLotPath(raw).map(x => x.trim()).filter(Boolean).join(" / ") : raw;
        if (!v) return;
        i.dataset.done = "1";
        const list = k === "lot" ? INS.lot : INS.sec;
        let r = list.find(x => !x.t && U_(x.v) === v);
        if (!r) { r = { id: insId(), v, on: false }; list.push(r); insSave(); histLog("DÉLAIS", k === "lot" ? "LOT AJOUTÉ" : "ACTIVITÉ SECONDAIRE AJOUTÉE", v); refreshAll(); }
        if (k === "lot") lot = r.id; else sec = r.id;
        setTimeout(() => {
          if (!d.isConnected) return;
          draw();
          const c = d.querySelector(`[data-${k}="${r.id}"]`); if (c) c.scrollIntoView({ block: "nearest" });
          if (lot && sec) { const di = d.querySelector('input.dlw-in[data-f="deb"]'); if (di && !di.value) di.focus(); }
          else { const o = d.querySelector(`input.dlw-new[data-k="${k === "lot" ? "sec" : "lot"}"]`); if (o) o.focus(); }
        }, 0);
      };
      d.addEventListener("keydown", e => { const i = e.target.closest("input.dlw-new"); if (!i || (e.key !== "Enter" && e.key !== "Tab")) return; e.preventDefault(); e.stopPropagation(); addNew(i); }, true);
      d.addEventListener("change", e => { const i = e.target.closest("input.dlw-new"); if (i) addNew(i); });
      d.addEventListener("click", e => {
        const cfb = e.target.closest(".cf-btn");
        if (cfb) { e.stopPropagation(); cfOpenMenu(cfb); return; }
        if (e.target === d || e.target.closest("[data-x]")) { close(); return; }
        if (e.target.closest("input.dlw-new")) return;
        const l = e.target.closest("[data-lot]");
        if (l) { lot = lot === l.dataset.lot ? "" : l.dataset.lot; draw(); return; }
        const s2 = e.target.closest("[data-sec]");
        if (s2) { sec = sec === s2.dataset.sec ? "" : s2.dataset.sec; draw(); if (lot && sec) setTimeout(() => { const i = d.querySelector('input.dlw-in[data-f="deb"]'); if (i && !i.value) i.focus(); }, 0); return; }
      });
    };
    if (!shell.__dlyPlanBound) {
      shell.__dlyPlanBound = true;
      shell.addEventListener("click", e => {
        const X = shell.__insDly;
        if (!X) return;
        const pc = e.target.closest && e.target.closest(".dly-pred");
        if (pc) { e.stopPropagation(); X.pickPreds(pc.dataset.key); return; }
        if (e.target.closest && e.target.closest(".dly-pred-new")) { X.addWin(); return; }
        if (e.target.closest && e.target.closest(".dly-gen")) { X.gen(); return; }
        if (e.target.closest && e.target.closest(".dly-iso-x")) { X.isoOff(); return; }
        if (e.target.closest && e.target.closest(".dly-vd-x")) { X.viewSet("l"); return; }
        /* ‹ PLANNING : retour au PLANNING (lot et activités libérés, la désignation reste choisie ; brouillon gardé) */
        /* en-tête du Gantt : calendrier du budget, ouvert sur le mois touché */
        /* nom d'un lot ou d'une activité sur le Gantt : toucher = le modifier sur place */
        const gr = e.target.closest && e.target.closest("#dlyGantt .gb-ren");
        if (gr && Date.now() - (shell.__dlyGLong || 0) < 600) { e.stopPropagation(); return; }
        if (gr) { e.stopPropagation(); dlyGEdit(gr); return; }
        const gf = e.target.closest && e.target.closest("#dlyGantt .gb-fold");
        if (gf) { e.stopPropagation(); X.fold(gf.dataset.path); return; }
        const gh = e.target.closest && e.target.closest("#dlyGantt .gh");
        if (gh && shell.__dlyNoClick) { shell.__dlyNoClick = false; return; }
        /* v449 : deux doigts posés sur le Gantt (pincement pour élargir) : le calendrier ne s'ouvre pas */
        if (gh && Date.now() - (shell.__dlyMultiT || 0) < 800) return;
        if (gh) { const host = gh.closest("#dlyGantt"); const n = Math.floor((e.clientX - gh.getBoundingClientRect().left) / DLY_DW); sviBdgCalWin(sviIsoAdd(host.__d0, Math.max(0, n))); return; }
        const lv = e.target.closest && e.target.closest(".dly-lev");
        if (lv) { if (!lv.disabled) X.level(); return; }
        /* repli d'un lot (› / ⌄) */
        const fo = e.target.closest && e.target.closest(".dly-fold");
        if (fo) { e.stopPropagation(); X.fold(fo.dataset.path); return; }
        /* JALON : toucher l'étoile = poser / retirer le jalon */
        const ja = e.target.closest && e.target.closest(".dly-jal");
        if (ja) { e.stopPropagation(); X.jal(ja.dataset.key); return; }
        /* fil d'une liaison sur le Gantt : fenêtre LIAISON */
        const gl = e.target.closest && e.target.closest(".gl-hit");
        if (gl) { e.stopPropagation(); X.linkWin(gl.dataset.p, gl.dataset.s); return; }
        const tr = e.target.closest && e.target.closest("tr.dly-task");
        void tr;   /* v454 : les dates se saisissent dans la ligne ; toucher la ligne ne change plus les choix des ronds */
      });
      /* gestes sur le Gantt (FORMAT 96) : glisser une barre = la déplacer ; tirer son bout = changer la FIN ;
         appui long sur la fin (ou le début) puis glisser jusqu'à une autre barre = liaison FIN → DÉBUT (ou DÉBUT → DÉBUT) */
      /* PLANNING : cases à cocher (tâche, lot = toutes ses tâches, en-tête = toutes les tâches affichées) et noms modifiables */
      shell.addEventListener("change", e => {
        const X = shell.__insDly;
        if (!X) return;
        const c = e.target.closest && e.target.closest("input.dlyp-cb, input.dlyp-cball");
        if (c) {
          const S = shell.__dlySel = shell.__dlySel || new Set(), R = shell.__dlyRows || [];
          let keys = [];
          if (c.classList.contains("dlyp-cball")) keys = R.flatMap(x => x.grp ? x.all.map(t => t.key) : [x.key]);
          else if (c.dataset.path) { const g = R.find(x => x.grp && x.path === c.dataset.path); keys = g ? g.all.map(t => t.key) : []; }
          else keys = [c.dataset.key];
          keys.forEach(k => { if (c.checked) S.add(k); else S.delete(k); });
          /* v537 : les autres blocs suivent (filtre des cases cochées) */
          refreshAll();
          return;
        }
        const n = e.target.closest && e.target.closest("input.dly-nm:not(.dly-gin)");
        if (n && !n.__gnDone && n.value !== n.defaultValue) { n.__gnDone = true; shell.__gnPend = null; X.rename(n); return; }
        const ni = e.target.closest && e.target.closest("input.dly-newin");
        if (ni) {
          const tr = ni.closest("tr"), g = f => tr.querySelector(`input.dly-newin[data-f="${f}"]`);
          if (tr.dataset.done) return;
          if (g("lot").value.trim() && g("sec").value.trim()) { tr.dataset.done = "1"; X.newTask(g("lot").value, g("sec").value, ni); }
          else { const o = g(ni.dataset.f === "lot" ? "sec" : "lot"); if (o && !o.value.trim()) setTimeout(() => o.focus(), 0); }
          return;
        }
      });
      /* ligne SAISIR ICI… du PLANNING : Entrée / Tab sur l'activité (lot et activité remplis) = créer la tâche */
      shell.addEventListener("keydown", e => {
        const ni = e.target.closest && e.target.closest("input.dly-newin");
        if (!ni || (e.key !== "Enter" && e.key !== "Tab") || e.shiftKey) return;
        const tr = ni.closest("tr"), g = f => tr.querySelector(`input.dly-newin[data-f="${f}"]`);
        if (!g("lot").value.trim() || !g("sec").value.trim()) { if (ni.dataset.f === "lot") { e.preventDefault(); e.stopPropagation(); g("sec").focus(); } return; }
        e.preventDefault(); e.stopPropagation();
        if (tr.dataset.done) return; tr.dataset.done = "1";
        const X = shell.__insDly; if (X) X.newTask(g("lot").value, g("sec").value, ni);
      }, true);
      /* séparation tableau / Gantt (FORMAT 90) : poignée ‖ tirée au doigt ; largeur du tableau mémorisée */
      shell.addEventListener("pointerdown", e => {
        /* v455 : la poignée ne réagit que sur sa pastille ‖ (le reste du trait est insensible) */
        const sp = e.target.closest && e.target.closest(".dlyg-hd") && e.target.closest(".dlyg-sp");
        if (!sp) return;
        e.preventDefault(); e.stopPropagation();
        const g = sp.closest(".dlyg"), L = g.querySelector(".dlyg-l"), gw = g.getBoundingClientRect();
        const x0 = e.clientX, w0 = L.getBoundingClientRect().width;
        sp.classList.add("on");
        let w = w0;
        /* de 0 (tableau caché) à toute la largeur (Gantt caché) */
        /* la poignée suit le doigt jusqu'au lâcher : doigt capturé, défilement de la page bloqué pendant le geste */
        try { sp.setPointerCapture(e.pointerId); } catch (err) {}
        const tmv = ev => ev.preventDefault();
        document.addEventListener("touchmove", tmv, { passive: false });
        const mv = ev => { if (ev.pointerId !== e.pointerId) return; ev.preventDefault(); w = Math.round(Math.max(0, Math.min(gw.width - 3, w0 + ev.clientX - x0))); L.style.width = w + "px"; L.style.maxWidth = "none"; };
        const up = ev => {
          if (ev && ev.pointerId !== e.pointerId) return;
          document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
          document.removeEventListener("touchmove", tmv);
          sp.classList.remove("on");
          /* R13 : simple toucher du signe « = » = la poignée va d'un bord à l'autre (tableau caché ↔ Gantt caché) */
          if (Math.abs(w - w0) < 3) {
            w = w0 > (gw.width - 3) / 2 ? 0 : Math.round(gw.width - 3);
            L.scrollLeft = 0; L.style.width = w + "px"; L.style.maxWidth = "none";
          }
          if (w > 2) shell.__dlygPrevW = Math.round(w);
          g.classList.toggle("tbl-hid", w < 3);
          /* largeur gardée (et retrouvée à l'ouverture, FORMAT 114) ; seule la poignée la change */
          shell.__dlygW = { ins: shell.__insDly && shell.__insDly.INS, ref: DLYG_REF, w: Math.round(w), auto: false };
          if (window.__sviViewSave) window.__sviViewSave();
        };
        document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
      });
      /* modifier sur le Gantt le nom d'un lot (titre de barre) ou d'une activité secondaire (barre ou nom à droite) :
         même saisie que dans le tableau (Entrée / quitter = enregistrer ; nom vide ou en double refusé) */
      const dlyGEdit = el => {
        const host = el.closest("#dlyGantt"), body = host && host.querySelector(".gbody");
        if (!body) return;
        document.querySelector("input.dly-gin")?.remove();
        const key = el.dataset.key, path = el.dataset.path;
        const sid = key ? key.split("|")[1] : "", val = key ? lkName("sec", sid) : lotLab(dlyLotPath(path)).name || "";
        const r = el.getBoundingClientRect();
        /* v465 : case posée sur la page (pas dans le Gantt) : un redessin du Gantt (clavier de l'iPad qui s'ouvre…) ne l'efface plus ;
           enregistrée à la sortie de la case (ENTRÉE ou toucher ailleurs), après la fin de la saisie prédictive (mot sans espace) */
        const i = document.createElement("input");
        i.className = "dly-nm dly-gin"; i.autocomplete = "off"; i.setAttribute("enterkeyhint", "done"); i.setAttribute("autocapitalize", "characters");
        i.dataset.kind = key ? "sec" : "grp";
        if (key) i.dataset.sid = sid; else i.dataset.path = path;
        i.value = val;
        i.style.cssText = `position:fixed;left:${Math.max(4, r.left - 2)}px;top:${r.top + r.height / 2 - 12}px;width:${Math.max(160, dlyTxtW(val) + 40)}px;height:24px;z-index:10050`;
        document.body.appendChild(i);
        i.focus(); try { i.select(); } catch (err) {}
        let done = false, cancel = false;
        const commit = () => {
          if (done) return; done = true;
          setTimeout(() => {
            const v = i.value; i.remove();
            if (cancel || U_(sviClean(v)) === U_(val)) return;
            const X = shell.__insDly; if (X) X.rename(i);
          }, 40);
        };
        i.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === "Tab") { ev.preventDefault(); ev.stopPropagation(); i.blur(); } else if (ev.key === "Escape") { cancel = true; i.value = val; i.blur(); } });
        i.addEventListener("blur", commit);
      };
      /* PLANNING : appui long sur une tâche ou un lot puis glisser = la / le déplacer (un seul trait) */
      const dlyRowKeys = tr => { if (!tr) return []; if (tr.classList.contains("dly-task")) return [tr.dataset.key]; const g = (shell.__dlyRows || []).find(x => x.grp && x.path === tr.dataset.path); return g ? g.all.map(t => t.key) : []; };
      const dlyRowAt = (y, src) => {
        for (const r0 of shell.querySelectorAll(".dlyg-l tbody tr.dly-task, .dlyg-l tbody tr.dly-grp")) {
          const r = r0.getBoundingClientRect();
          if (y >= r.top && y <= r.bottom && r0 !== src) return { tr: r0, r, after: y > (r.top + r.bottom) / 2 };
        }
        return null;
      };
      const dlyRowLine = h => {
        let l = document.getElementById("roLine");
        if (!l) { l = document.createElement("div"); l.id = "roLine"; document.body.appendChild(l); }
        /* le trait n'apparaît que là où l'on agit (FORMAT 64) : glissement sur le tableau = trait sur le tableau,
           décalé de 20 px par niveau comme DÉSIGNATIONS CLIENT ; sur le Gantt = trait sur le Gantt, 40 px par niveau, petit trait vertical au départ */
        const box = h.tr.closest(".dlyg"), onG = !!shell.__dlySrcG;
        const pane = box.querySelector(onG ? ".dlyg-r" : ".dlyg-l") || box, g = pane.getBoundingClientRect();
        let ind = onG ? 8 + (h.lvl || 0) * 40 : (h.lvl ? 6 + h.lvl * 20 : 0);
        /* v445 (Ahmed) : le trait part du TITRE PARENT (lot d'arrivée) et file jusqu'au bord droit —
           tableau : aligné sur le titre du lot dans la colonne LOT ; Gantt : aligné sur la date de début du lot (bord gauche de sa barre).
           Racine (pas de lot parent) : titres / barres de premier niveau. Nom du lot d'arrivée surligné en jaune sur le Gantt. */
        box.querySelectorAll(".gb-grp.gb-grp-tgt").forEach(n => n.classList.remove("gb-grp-tgt"));
        if (h.parent !== undefined) {
          const E = v => (window.CSS && CSS.escape ? CSS.escape(v) : String(v).replace(/"/g, '\\"'));
          const vis = r => r && r.width && r.right > g.left && r.left < g.right;
          const lefts = els => els.map(e2 => e2.getBoundingClientRect()).filter(vis).map(r => r.left);
          let xs;
          if (onG) {
            xs = h.parent ? lefts([...box.querySelectorAll(`.dlyg-r :is(.gsum, .gseg, .gdot)[data-path="${E(h.parent)}"]`)])
              : lefts([...box.querySelectorAll(".dlyg-r :is(.gsum, .gseg, .gdot)")]);
            const nm = h.parent ? box.querySelector(`.dlyg-r .gb-grp[data-path="${E(h.parent)}"]`) : null;
            if (nm) nm.classList.add("gb-grp-tgt");
          } else {
            xs = h.parent ? lefts([...box.querySelectorAll(`.dlyg-l tr.dly-grp[data-path="${E(h.parent)}"] .dly-lotc .dly-fold`)])
              : lefts([...box.querySelectorAll(".dlyg-l tr.dly-grp .dly-lotc .dly-fold")]);
          }
          if (xs.length) ind = Math.min(...xs) - g.left;
          ind = Math.max(0, Math.min(g.width - 40, ind));
        }
        const y = (h.after ? h.r.bottom : h.r.top) - 1.5;
        l.style.cssText = `position:fixed;z-index:10060;pointer-events:none;height:3px;border-radius:2px;background:${h.keep === true ? "#2563eb" : h.keep === false ? "#111827" : "var(--inst,#12355b)"};left:${g.left + ind}px;width:${Math.max(40, g.width - ind)}px;top:${y}px`;
        l.innerHTML = "";
      };
      /* lot glissé en hauteur (tableau ou Gantt) : endroit et niveau d'arrivée (FORMAT 64 / 44) —
         le trait commence au niveau d'arrivée ; doigt vers la droite = plus profond, vers la gauche = moins ;
         au milieu d'un lot ou d'un titre = superposé (ligne encadrée) */
      const dlyGrpHit = (ev, path, lvl0, x0) => {
        const R = shell.__dlyRows || [], P = dlyLotPath(path);
        const inSrc = x => { const s2 = dlyLotPath(x.grp ? x.path : x.lot); return s2.length >= P.length && P.every((g, i) => U_(g) === U_(s2[i])); };
        const rows = [...shell.querySelectorAll(".dlyg-l tbody tr.dly-task, .dlyg-l tbody tr.dly-grp")].map(tr => {
          const x = tr.classList.contains("dly-grp") ? R.find(r => r.grp && r.path === tr.dataset.path) : R.find(r => !r.grp && r.key === tr.dataset.key);
          return x ? { tr, x, r: tr.getBoundingClientRect() } : null;
        }).filter(o => o && !inSrc(o.x));
        shell.querySelectorAll(".dlyg-l tr.ro-on").forEach(t => t.classList.remove("ro-on")); sviDlyRoSync();
        if (!rows.length) return null;
        let i = rows.findIndex(o => ev.clientY < o.r.bottom);
        if (i < 0) i = rows.length;
        const o = rows[i];
        if (o && o.x.grp && ev.clientY >= o.r.top + o.r.height / 3 && ev.clientY <= o.r.bottom - o.r.height / 3) {
          o.tr.classList.add("ro-on"); sviDlyRoSync();
          let j = i + 1; while (j < rows.length && rows[j].x.lvl > o.x.lvl) j++;
          const nx = rows.slice(j).find(q => !q.x.grp);
          return { on: o.x.path, before: nx ? nx.x.key : "", tr: o.tr, r: o.r, after: false, line: false };
        }
        if (o && ev.clientY > o.r.top + o.r.height / 2) i++;
        const prev = rows[i - 1], next = rows[i];
        const maxL = prev ? (prev.x.grp ? prev.x.lvl + 1 : prev.x.lvl) : 0, minL = next ? next.x.lvl : 0;
        let L = Math.round(lvl0 + (ev.clientX - x0) / 30);
        L = Math.max(Math.min(minL, maxL), Math.min(maxL, Math.max(minL, L)));
        let parent = "";
        if (L > 0) for (let k = i - 1; k >= 0; k--) if (rows[k].x.grp && rows[k].x.lvl === L - 1) { parent = rows[k].x.path; break; }
        const nx = rows.slice(i).find(q => !q.x.grp);
        const ref = next || prev;
        /* v463 : doigt resté au niveau de départ = trait BLEU : le lot garde son titre d'origine et son numéro, seule sa place change ;
           doigt décalé à gauche / à droite = trait NOIR aligné sur le titre visé : il y entre (nouveau numéro) ; plus à gauche = niveau supérieur */
        const keep = Math.round((ev.clientX - x0) / 30) === 0;
        if (keep) { const own = P.slice(0, -1).join(" / "); return { keep: true, parent: own, into: !!own, before: nx ? nx.x.key : "", tr: ref.tr, r: ref.r, after: !next, lvl: P.length - 1, line: true }; }
        return { keep: false, parent, into: !!parent, before: nx ? nx.x.key : "", tr: ref.tr, r: ref.r, after: !next, lvl: L, line: true };
      };
      /* tâche glissée : au milieu d'une autre tâche (ligne encadrée) = superposer ; sinon trait (rang / lot) */
      /* tâche glissée (tableau ou Gantt), même logique que DÉSIGNATIONS CLIENT (FORMAT 44 / 64) :
         au milieu d'une autre tâche (ligne en jaune) = superposer ; sinon un trait à l'endroit du dépôt, qui commence au niveau d'arrivée :
         doigt vers la droite = trait court = la tâche entre dans le lot du dessus (plus profond) ; vers la gauche = trait long = lot de niveau supérieur.
         Une tâche est toujours dans un lot (jamais à la racine, jamais dans un simple niveau sans lot). */
      const dlyTaskHit = (ev, srcTr, srcKey, x0) => {
        shell.querySelectorAll(".dlyg-l tr.ro-on").forEach(t => t.classList.remove("ro-on")); sviDlyRoSync();
        const R = shell.__dlyRows || [];
        const rows = [...shell.querySelectorAll(".dlyg-l tbody tr.dly-task, .dlyg-l tbody tr.dly-grp")].map(tr => {
          const x = tr.classList.contains("dly-grp") ? R.find(r => r.grp && r.path === tr.dataset.path) : R.find(r => !r.grp && r.key === tr.dataset.key);
          return x ? { tr, x, r: tr.getBoundingClientRect() } : null;
        }).filter(o => o && !(srcKey && !o.x.grp && o.x.key === srcKey));
        if (!rows.length) return null;
        let i = rows.findIndex(o => ev.clientY < o.r.bottom);
        if (i < 0) i = rows.length;
        const o = rows[i];
        if (o && !o.x.grp && ev.clientY >= o.r.top + o.r.height / 3 && ev.clientY <= o.r.bottom - o.r.height / 3) {
          o.tr.classList.add("ro-on"); sviDlyRoSync(); document.getElementById("roLine")?.remove();
          return { tr: o.tr, r: o.r, after: false, on: o.x.key };
        }
        if (o && ev.clientY > o.r.top + o.r.height / 2) i++;
        const prev = rows[i - 1], next = rows[i];
        if (!prev) { document.getElementById("roLine")?.remove(); return null; }   /* tout en haut : pas de lot au-dessus */
        const isLot = path => INS.lot.some(l => !l.t && dlyLotPath(l.v).join(" / ") === path);
        /* niveaux possibles (niveau d'une tâche = niveau de son lot + 1) */
        const maxL = prev.x.grp ? prev.x.lvl + 1 : prev.x.lvl, minL = Math.max(1, next ? (next.x.grp ? next.x.lvl : next.x.lvl) : 1);
        const parentAt = L => { for (let k = i - 1; k >= 0; k--) if (rows[k].x.grp && rows[k].x.lvl === L - 1) return rows[k]; return null; };
        const ok = [];
        for (let L = Math.min(minL, maxL); L <= maxL; L++) { const pa = parentAt(L); if (L >= 1 && pa && isLot(pa.x.path)) ok.push(L); }
        if (!ok.length) { document.getElementById("roLine")?.remove(); return null; }
        const src = srcKey ? R.find(r => !r.grp && r.key === srcKey) : null;
        const want = Math.round((src ? src.lvl : maxL) + (ev.clientX - (x0 === undefined ? ev.clientX : x0)) / 30);
        const L = ok.reduce((b, v) => Math.abs(v - want) < Math.abs(b - want) ? v : b, ok[0]);
        const pa = parentAt(L);
        const nextT = rows.slice(i).find(q => !q.x.grp), prevT = [...rows.slice(0, i)].reverse().find(q => !q.x.grp);
        const h = { tr: (next || prev).tr, r: (next || prev).r, after: !next, lvl: L, parent: pa.x.path,
          before: next && !next.x.grp ? next.x.key : "", afterKey: !(next && !next.x.grp) && prevT ? prevT.x.key : "", nextKey: nextT ? nextT.x.key : "" };
        dlyRowLine(h);
        return h;
      };
      const dlyGrpShow = h => { if (h && h.line) dlyRowLine(h); else document.getElementById("roLine")?.remove(); };
      /* v539 : lots et titres du PLANNING glissés avec les MÊMES règles que la liste des lots du bloc TÂCHES :
         milieu d'un titre / d'un lot = regroupement (titre sur titre ou lot sur lot = nouveau titre ; lot sur titre = dedans) ;
         juste sous un titre déplié ou entre deux lignes d'un groupe = dans ce groupe ; sous la dernière ligne d'un groupe
         ou sous un groupe replié : doigt à droite = trait court = dedans, à gauche = trait long = même rang */
      const dlyFakeT = tr => {
        const path = tr.dataset.path, rec = INS.lot.find(l => !l.t && U_(l.v) === U_(path));
        const base = { getBoundingClientRect: () => tr.getBoundingClientRect(), closest: () => null };
        return rec ? { ...base, classList: { contains: () => false }, dataset: { iid: rec.id } } : { ...base, classList: { contains: c => c === "lot-grp" }, dataset: { path } };
      };
      const dlyLotHit = (ev, srcP, x0) => {
        const tb = shell.querySelector(".dlyg-l table tbody");
        if (!tb) return null;
        const all = [...tb.querySelectorAll("tr.dly-grp, tr.dly-task")].filter(t => !t.classList.contains("dly-ext"));
        const inSrc = sg => sg.length >= srcP.length && srcP.every((g, i) => U_(g) === U_(sg[i]));
        const G = all.filter(t => t.classList.contains("dly-grp")).map(t => { const segs = dlyLotPath(t.dataset.path);
          return { el: t, segs, kids: INS.lot.some(l => !l.t && lotSegs(l).length > segs.length && lotUnder(l, segs)), folded: dlyIsFolded(t.dataset.path) }; }).filter(o => !inSrc(o.segs));
        const tr = all.find(t => { const r = t.getBoundingClientRect(); return ev.clientY >= r.top && ev.clientY <= r.bottom; });
        if (!tr) return null;
        const r = tr.getBoundingClientRect(), f = (ev.clientY - r.top) / (r.height || 1);
        let x, pos;
        if (tr.classList.contains("dly-grp")) { x = G.find(o => o.el === tr); pos = f > .25 && f < .75 ? "on" : f >= .75 ? "after" : "before"; }
        else { let g = tr.previousElementSibling; while (g && !g.classList.contains("dly-grp")) g = g.previousElementSibling; x = G.find(o => o.el === g); pos = "after"; }
        if (!x) return null;
        if (pos === "on") return { on: true, x };
        const ix = G.indexOf(x), pv = pos === "after" ? G[ix] : G[ix - 1], nx = pos === "after" ? G[ix + 1] : G[ix];
        let D, Dmin, Dmax, inStart = false;
        if (!pv) D = Dmin = Dmax = 0;
        else if (pv.kids && !pv.folded) { inStart = true; D = Dmin = Dmax = pv.segs.length; }
        else {
          Dmax = pv.kids ? pv.segs.length : pv.segs.length - 1;
          Dmin = nx ? Math.min(Dmax, nx.segs.length - 1) : 0;
          D = Math.max(Dmin, Math.min(Dmax, Dmax + Math.round((ev.clientX - x0) / 28)));
        }
        const cell = (x.el.querySelector(".dly-lotc") || x.el).getBoundingClientRect(), rowR = tr.getBoundingClientRect();
        const left = cell.left + 6 + D * 20, y = pos === "before" ? rowR.top : rowR.bottom;
        let l = document.getElementById("roLine");
        if (!l) { l = document.createElement("div"); l.id = "roLine"; document.body.appendChild(l); }
        const tbr = tb.getBoundingClientRect();
        l.style.cssText = `position:fixed;z-index:10060;pointer-events:none;height:3px;border-radius:2px;background:var(--inst,#12355b);left:${left}px;width:${Math.max(20, tbr.right - left)}px;top:${y - 1.5}px`;
        return { gap: { prev: pv ? pv.segs : null, D, inStart, el: pv ? pv.el : x.el } };
      };
      shell.__dlyRowDrag = (e, srcTr, onDrop) => {};
      /* + AJOUTER UNE TÂCHE grisé : appui long = la raison (FORMAT 56) */
      shell.addEventListener("pointerdown", e => {
        const b = e.target.closest && e.target.closest(".dly-pred-new.off");
        if (!b) return;
        const t = setTimeout(() => svToast("TOUTES LES TÂCHES SONT DÉJÀ DANS LE PLANNING.", 3000, b), 550);
        const off = () => { clearTimeout(t); document.removeEventListener("pointerup", off); document.removeEventListener("pointercancel", off); };
        document.addEventListener("pointerup", off); document.addEventListener("pointercancel", off);
      });
      shell.addEventListener("pointerdown", e => {
        const X = shell.__insDly;
        const tr = e.target.closest && e.target.closest(".dlyg-l tr.dly-task, .dlyg-l tr.dly-grp");
        if (!X || !tr || tr.classList.contains("dly-ext") || e.target.closest("input[type=checkbox], .dly-pred, .dly-jal, .dly-fold, .cf-btn")) return;
        const x0 = e.clientX, y0 = e.clientY;
        let on = false, hit = null, far = false;
        const tm = setTimeout(() => { if (X.view() === "d" && !tr.classList.contains("dly-grp")) { svToast("VUE PAR DÉBUT : PASSER EN VUE PAR LOT POUR DÉPLACER.", 3000, tr); end(false); return; } on = true; tr.classList.add("ro-src"); grpFlush(true); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); try { window.getSelection().removeAllRanges(); } catch (err) {} document.body.classList.add("svi-dragging"); }, 350);
        const tmv = ev => { if (on) ev.preventDefault(); };
        document.addEventListener("touchmove", tmv, { passive: false });
        const isG = tr.classList.contains("dly-grp"), gRow = isG ? (shell.__dlyRows || []).find(r => r.grp && r.path === tr.dataset.path) : null;
        const mv = ev => {
          if (!on) { if (Math.abs(ev.clientX - x0) > 8 || Math.abs(ev.clientY - y0) > 8) end(); return; }
          ev.preventDefault();
          if (!far && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 10) return;
          far = true;
          shell.__dlySrcG = window.__sviDlySrcG = false;
          if (gRow && X.view() === "d") { if (!tr.__vdMsg) { tr.__vdMsg = 1; svToast("VUE PAR DÉBUT : PASSER EN VUE PAR LOT POUR DÉPLACER.", 3000, tr); } hit = null; return; }
          if (gRow) {
            shell.querySelectorAll(".dlyg-l tr.ro-on").forEach(t => t.classList.remove("ro-on"));
            hit = dlyLotHit(ev, dlyLotPath(gRow.path), x0);
            if (!hit) document.getElementById("roLine")?.remove();
            else if (hit.on) { document.getElementById("roLine")?.remove(); hit.x.el.classList.add("ro-on"); }
            return;
          }
          if (tr.classList.contains("dly-task")) { hit = dlyTaskHit(ev, tr, tr.dataset.key, x0); if (!hit) document.getElementById("roLine")?.remove(); return; }
          hit = dlyRowAt(ev.clientY, tr);
          if (hit) dlyRowLine(hit); else document.getElementById("roLine")?.remove();
        };
        const end = drop => {
          clearTimeout(tm);
          if (shell.__gnRefresh) { shell.__gnRefresh = false; setTimeout(() => refreshAll(), 0); }
          document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", cc);
          setTimeout(() => document.removeEventListener("touchmove", tmv), 0);
          document.getElementById("roLine")?.remove(); tr.classList.remove("ro-src"); document.body.classList.remove("svi-dragging");
          shell.querySelectorAll(".dlyg-l tr.ro-on").forEach(t => t.classList.remove("ro-on")); sviDlyRoSync();
          if (on) { const stop = ev => { ev.stopPropagation(); ev.preventDefault(); }; shell.addEventListener("click", stop, { capture: true, once: true }); setTimeout(() => shell.removeEventListener("click", stop, { capture: true }), 350); }
          /* v461 : appui long sans glisser sur un lot ou un niveau = son menu (ISOLER) */
          if (drop && on && !far && gRow) { X.grpMenu(gRow.path, tr.querySelector(".dly-lotc") || tr); return; }
          if (drop && on && hit && far && gRow) {
            const rec = INS.lot.find(l => !l.t && U_(l.v) === U_(gRow.path)), sid = rec ? rec.id : "@" + gRow.path;
            if (hit.on) lotDrop(sid, dlyFakeT(hit.x.el), "on", null, { plan: true });
            else lotDrop(sid, dlyFakeT(hit.gap.el), "gap", hit.gap, { plan: true });
            return;
          }
          if (drop && on && hit && far) { if (gRow) X.moveGroup(gRow.path, hit, tr); else if (hit.on) X.superpose(tr.dataset.key, hit.on, tr); else if (tr.classList.contains("dly-task")) X.dropTaskTo(tr.dataset.key, hit, tr); else X.moveKeys(dlyRowKeys(tr), dlyRowKeys(hit.tr), hit.after); }
        };
        const up = () => end(true), cc = () => end(false);
        document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", cc);
      });
      /* barre CAPACITÉ (FORMAT 99, 167 ; R2, R21) : tirée au doigt, par paliers entiers ; 0 = pénurie ; sous le zéro = ILLIMITÉ ;
         au lâcher, le planning est recompressé. Appui long sans bouger = « / » et bulle COUPER ICI qui suivent le doigt jour par jour ;
         lâcher = couper à ce jour */
      shell.addEventListener("pointerdown", e => {
        const X = shell.__insDly;
        const pl = e.target.closest && e.target.closest("#dlyGantt .gplaf");
        if (!X || !pl) return;
        e.preventDefault(); e.stopPropagation();
        const h = pl.closest(".ghist"), sc = Number(h.dataset.sc) || 1, Y0 = Number(h.dataset.y0) || h.offsetHeight, IB = Number(h.dataset.ib) || 0, r0 = h.getBoundingClientRect();
        const v0 = pl.querySelector(".gplaf-v"), seg = Number(pl.dataset.seg) || 0, pre = (v0.textContent.match(/^\d\d\/\d\d\/\d{4} : /) || [""])[0];
        let P = null, cut = null;
        const x0 = e.clientX, y0 = e.clientY, host = pl.closest("#dlyGantt");
        const dayAt = cx => { const n = Math.floor((cx - h.getBoundingClientRect().left) / DLY_DW); return sviIsoAdd(host.__d0, Math.max(0, n)); };
        const showCut = cx => {
          const iso = sviWNear(X.cal(), dayAt(cx), 1);
          let m = document.getElementById("dlyCutTip");
          if (!m) { m = document.createElement("div"); m.id = "dlyCutTip"; document.body.appendChild(m); }
          const hr = h.getBoundingClientRect(), xi = hr.left + dDiff(host.__d0, iso) * DLY_DW;
          m.innerHTML = `<span class="ct-sl" style="left:${xi - 4}px;top:${pl.getBoundingClientRect().top - 9}px">/</span><span class="ct-b" style="left:${xi - 50}px;top:${pl.getBoundingClientRect().top - 40}px">COUPER ICI<br><b>${esc(dFr(iso))}</b></span>`;
          cut = iso;
        };
        const lt = setTimeout(() => { if (P === null) showCut(x0); }, 600);
        const tmv = ev => ev.preventDefault();
        document.addEventListener("touchmove", tmv, { passive: false });
        const mv = ev => {
          if (cut) { ev.preventDefault(); showCut(ev.clientX); return; }
          if (P === null && Math.abs(ev.clientY - y0) < 6 && Math.abs(ev.clientX - x0) < 6) return;
          clearTimeout(lt);
          const y = ev.clientY - r0.top;
          P = IB && y > Y0 + IB / 3 ? -1 : Math.max(0, Math.round((Y0 - y) / sc));
          pl.classList.toggle("gcap-inf", P < 0); pl.classList.toggle("gcap-zero", P === 0);
          pl.style.top = (P < 0 ? Y0 + IB / 2 : Y0 - P * sc) + "px";
          v0.textContent = pre + (P < 0 ? "ILLIMITÉ" : P === 0 ? "CAPACITÉ 0 — PÉNURIE" : "CAPACITÉ " + P);
        };
        const off = () => { clearTimeout(lt); document.getElementById("dlyCutTip")?.remove(); document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", off); setTimeout(() => document.removeEventListener("touchmove", tmv), 0); };
        const up = () => { const c = cut; off(); if (c) X.cutPlaf(c); else if (P !== null) X.plafSeg(seg, P, pl); };
        document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", off);
      });
      /* R28 : zone touchée en dernier (tableau, Gantt, histogramme) — liseré, et ses entrées en premier dans le menu ⋯ */
      shell.addEventListener("pointerdown", e => {
        const g = e.target.closest && e.target.closest(".dlyg");
        if (!g) return;
        const z = e.target.closest(".dlyg-l") ? "tab" : e.target.closest(".ghist, .dlyg-hh, .dlyh-lab") ? "hist" : e.target.closest("#dlyGantt") ? "gantt" : "";
        if (!z || z === shell.__dlyZone) return;
        shell.__dlyZone = z;   /* v546 (R35) : plus de liseré ni de rubriques par zone */
      }, true);
      /* R22 : toucher le « / » d'une coupe = SUPPRIMER LA COUPE (fenêtre) */
      shell.addEventListener("click", e => { const c = e.target.closest && e.target.closest("#dlyGantt .gcut[data-i]"); const X = shell.__insDly; if (!c || !X) return; e.stopPropagation(); if (Date.now() - (shell.__dlyCutLong || 0) < 600) return; X.delCut(Number(c.dataset.i)); }, true);
      /* v546 (R19) : appui long sur le « / » = le déplacer jour par jour (seulement si les deux morceaux ont la même capacité) */
      shell.addEventListener("pointerdown", e => {
        const X = shell.__insDly, c = e.target.closest && e.target.closest("#dlyGantt .gcut[data-i]");
        if (!X || !c) return;
        e.stopPropagation();
        const host = c.closest("#dlyGantt"), h = c.closest(".ghist"), x0 = e.clientX, y0 = e.clientY;
        let mov = false, iso = null;
        const tip = cx => {
          const n = Math.floor((cx - h.getBoundingClientRect().left) / DLY_DW); iso = sviWNear(X.cal(), sviIsoAdd(host.__d0, Math.max(0, n)), 1);
          let m = document.getElementById("dlyCutTip");
          if (!m) { m = document.createElement("div"); m.id = "dlyCutTip"; document.body.appendChild(m); }
          const xi = h.getBoundingClientRect().left + dDiff(host.__d0, iso) * DLY_DW, ty = c.getBoundingClientRect().top;
          m.innerHTML = `<span class="ct-sl" style="left:${xi - 4}px;top:${ty}px">/</span><span class="ct-b" style="left:${xi - 50}px;top:${ty - 34}px">DÉPLACER ICI<br><b>${esc(dFr(iso))}</b></span>`;
        };
        const lt = setTimeout(() => {
          shell.__dlyCutLong = Date.now();
          if (c.dataset.eq !== "1") { svToast("COUPE FIXE : LES DEUX MORCEAUX N'ONT PAS LA MÊME CAPACITÉ.", 3000, c); return; }
          mov = true; tip(x0);
        }, 500);
        const tmv = ev => { if (mov) ev.preventDefault(); };
        document.addEventListener("touchmove", tmv, { passive: false });
        const mv = ev => { if (mov) { ev.preventDefault(); tip(ev.clientX); } else if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) clearTimeout(lt); };
        const up = () => {
          clearTimeout(lt); document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
          setTimeout(() => document.removeEventListener("touchmove", tmv), 0);
          document.getElementById("dlyCutTip")?.remove();
          if (mov && iso) { shell.__dlyCutLong = Date.now(); X.moveCut(Number(c.dataset.i), iso); }
        };
        document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
      }, true);
      /* v547 (R22) : DÉBUT / FIN / DURÉE d'une tâche en morceaux = fenêtre MORCEAUX */
      shell.addEventListener("click", e => { const b = e.target.closest && e.target.closest(".dlp-multi[data-task]"); const X = shell.__insDly; if (!b || !X) return; e.stopPropagation(); X.piecesWin(b.dataset.task); }, true);
      /* v546 (R29) : ⚙ = RÉGLAGES DE L'HISTOGRAMME */
      shell.addEventListener("click", e => { const b = e.target.closest && e.target.closest(".dlyhh-cfg"); const X = shell.__insDly; if (!b || !X) return; e.stopPropagation(); X.hcfgWin(b); }, true);
      /* v546 (R27) : toucher la case SUCCESSEURS = leur liste */
      shell.addEventListener("click", e => { const b = e.target.closest && e.target.closest(".dly-succ[data-key]"); const X = shell.__insDly; if (!b || !X) return; e.stopPropagation(); const L = X.succs(b.dataset.key); svToast(L.length ? "SUCCESSEURS : " + L.join(" ; ") : "AUCUN SUCCESSEUR.", 5000, b); }, true);
      /* R24 : repère ⧖ d'une tâche freinée par une autre ressource */
      shell.addEventListener("click", e => { const c = e.target.closest && e.target.closest("#dlyGantt .gb-lim[data-key]"); const X = shell.__insDly; if (!c || !X) return; e.stopPropagation(); svToast(X.limTxt(c.dataset.key), 3500, c); }, true);
      /* R19 : traits DÉBUT et FIN de l'histogramme — tirés au doigt ; contre un bord = pas de limite ; croisés = noms échangés */
      shell.addEventListener("pointerdown", e => {
        const X = shell.__insDly;
        const ln = e.target.closest && e.target.closest("#dlyGantt .grng[data-r]");
        if (!X || !ln) return;
        e.preventDefault(); e.stopPropagation();
        const h = ln.closest(".ghist"), host = h.closest("#dlyGantt"), W = h.offsetWidth, sp = ln.querySelector("span");
        const R0 = X.hrange(), other = ln.dataset.r === "a" ? R0.b : R0.a;
        let iso = R0[ln.dataset.r] || "", edge = "";
        const tmv = ev => ev.preventDefault();
        document.addEventListener("touchmove", tmv, { passive: false });
        const mv = ev => {
          ev.preventDefault();
          const x = ev.clientX - h.getBoundingClientRect().left;
          edge = x <= DLY_DW / 2 ? "l" : x >= W - DLY_DW / 2 ? "r" : "";
          iso = edge ? "" : sviIsoAdd(host.__d0, Math.max(0, Math.floor(x / DLY_DW)));
          ln.style.left = Math.max(0, Math.min(W, x)) + "px"; ln.classList.toggle("grng-off", !!edge);
          const lab = other && iso && (ln.dataset.r === "a" ? iso > other : iso < other) ? (ln.dataset.r === "a" ? "FIN" : "DÉBUT") : (ln.dataset.r === "a" ? "DÉBUT" : "FIN");
          sp.textContent = lab + (iso ? " " + dFr(iso).slice(0, 5) : "");
        };
        const up = () => {
          document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
          setTimeout(() => document.removeEventListener("touchmove", tmv), 0);
          const R = { ...R0 };
          if (edge === "l") R.a = ""; else if (edge === "r") R.b = ""; else R[ln.dataset.r] = iso;
          if (R.a && R.b && R.a > R.b) { const t = R.a; R.a = R.b; R.b = t; }
          X.hrangeSet(R);
        };
        document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
      });
      /* R20 : lignes MIN et MAX — tirées au doigt ; tout en bas (MIN) / tout en haut (MAX) = pas de limite ; croisées = noms échangés ;
         égales = les deux clignotent ; au lâcher, les charges des jours retenus sont cochées */
      shell.addEventListener("pointerdown", e => {
        const X = shell.__insDly;
        const ln = e.target.closest && e.target.closest("#dlyGantt .gval[data-v]");
        if (!X || !ln) return;
        e.preventDefault(); e.stopPropagation();
        const h = ln.closest(".ghist"), sc = Number(h.dataset.sc) || 1, Y0 = Number(h.dataset.y0) || h.offsetHeight, top = Number(h.dataset.top) || 1, sp = ln.querySelector("span");
        const V0 = X.hval(), role = ln.dataset.v, oth = role === "min" ? V0.max : V0.min;
        let v = V0[role], pos = "";
        const fmtV = n => (Math.round(n * 100) / 100).toLocaleString("fr-FR");
        const tmv = ev => ev.preventDefault();
        document.addEventListener("touchmove", tmv, { passive: false });
        const mv = ev => {
          ev.preventDefault();
          const y = ev.clientY - h.getBoundingClientRect().top;
          const raw = (Y0 - y) / sc;
          pos = raw <= 0 ? "b" : raw >= top * .97 ? "t" : "";
          v = pos ? null : Math.round(raw * 100) / 100;
          ln.style.top = Math.max(0, Math.min(Y0, y)) + "px"; ln.classList.toggle("gval-off", !!pos);
          const isMax = v !== null ? (oth === null ? role === "max" : v > oth) : pos === "t";
          sp.textContent = (isMax ? "MAX" : "MIN") + (v !== null ? " " + fmtV(v) : "");
          const eq = v !== null && oth !== null && Math.abs(v - oth) < 1e-9;
          if (eq && !ln.__eq) { h.querySelectorAll(".gval").forEach(g => { g.classList.remove("gval-blink"); void g.offsetWidth; g.classList.add("gval-blink"); }); }
          ln.__eq = eq;
        };
        const up = () => {
          document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
          setTimeout(() => document.removeEventListener("touchmove", tmv), 0);
          /* les deux valeurs, rangées : la plus basse = MIN, la plus haute = MAX (tout en haut = pas de MAX, tout en bas = pas de MIN) */
          const a = { v, pos: v === null ? (pos || (role === "max" ? "t" : "b")) : "" }, b = { v: oth, pos: oth === null ? (role === "min" ? "t" : "b") : "" };
          const L = [a, b], mn = L.find(x => x.pos === "b"), mxx = L.find(x => x.pos === "t"), nums = L.filter(x => x.v !== null).map(x => x.v).sort((p, q) => p - q);
          let out;
          if (nums.length === 2) out = { min: nums[0], max: nums[1] };
          else if (nums.length === 1) out = mn && !mxx ? { min: null, max: nums[0] } : mxx && !mn ? { min: nums[0], max: null } : { min: nums[0], max: null };
          else out = { min: null, max: null };
          X.hvalSet(out);
        };
        document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
      });
      /* R8 : toucher une barre de l'histogramme = bulle des tâches de ce jour (répartition, fractions comprises) */
      shell.addEventListener("click", e => {
        const b = e.target.closest && e.target.closest("#dlyGantt .ghb[data-d]");
        document.getElementById("dlyHb")?.remove();
        if (!b) return;
        const host = b.closest("#dlyGantt"), H = host && host.__HD, di = b.dataset.d;
        if (!H) return;
        const fmt = v => (Math.round(v * 100) / 100).toLocaleString("fr-FR");
        let rows = "", tot = 0;
        const HV = host.__HV || {};
        if (HV.cum || HV.multi) {
          /* v546 (R15, R29) : en CUMULÉ, la date et le total à ce jour ; avec PRODUITS / MARGE, une ligne par grandeur */
          const m = document.createElement("div"); m.id = "dlyHb";
          const L = [["CHARGES", HV.val], ["PRODUITS", HV.vP], ["MARGE", HV.vG]].filter(x => x[1] && Object.keys(x[1]).length && (x[0] === "CHARGES" ? !HV.multi || (H.crb || []).includes("c") : (H.crb || []).includes(x[0] === "PRODUITS" ? "p" : "g")));
          m.innerHTML = `<button type="button" class="svt-x" aria-label="Fermer">✕</button><div class="hb-t">${esc(dFr(di))}${HV.cum ? " — CUMUL À CE JOUR" : ""}</div>` + L.map(([t, M]) => `<div><span>${t}</span><b>${fmt(M[di] || 0)} ${esc(HV.unit)}</b></div>`).join("");
          document.body.appendChild(m);
          const r = b.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
          m.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.left + r.width / 2 - mw / 2)) + "px"; m.style.top = Math.max(8, Math.min(r.top, e.clientY) - mh - 6) + "px";
          m.addEventListener("click", ev => { if (ev.target.closest(".svt-x")) m.remove(); ev.stopPropagation(); });
          return;
        }
        if (H.cmd) { tot = H.cmd.L[di] || 0; rows = `<div>${esc(H.cmd.lab)}</div>` + (H.cmd.det[di] || []).map(x => `<div><span>${esc(x.sk.split("|")[0])}</span><b>${fmt(x.v)}</b></div>`).join(""); }
        else (H.det[di] || []).forEach(x => { tot += x.v; rows += `<div><span>${esc(lotLab(dlyLotPath(lkName("lot", x.k.split("|")[0]))).full)} › ${esc(lkName("sec", x.k.split("|")[1]))}${x.inc ? " ▣" : ""}</span><b>${fmt(x.v)}</b></div>`; });
        const m = document.createElement("div");
        m.id = "dlyHb";
        m.innerHTML = `<button type="button" class="svt-x" aria-label="Fermer">✕</button><div class="hb-t">${esc(dFr(di))}</div>${rows}<div class="hb-tot"><span>TOTAL (${esc(H.cmd ? "COMMANDE" : H.unit)})</span><b>${fmt(tot)}</b></div>`;
        document.body.appendChild(m);
        const r = b.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
        m.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.left + r.width / 2 - mw / 2)) + "px";
        m.style.top = Math.max(8, r.top - mh - 6) + "px";
        m.addEventListener("click", ev => { if (ev.target.closest(".svt-x")) m.remove(); ev.stopPropagation(); });
      });
      document.addEventListener("pointerdown", e => { const m = document.getElementById("dlyHb"); if (m && !m.contains(e.target) && !(e.target.closest && e.target.closest(".ghb"))) m.remove(); }, true);
      /* R3 : signe ▣ d'une tâche incompressible = fenêtre RENDRE COMPRESSIBLE */
      shell.addEventListener("click", e => { const b = e.target.closest && e.target.closest(".dlyg-l .dly-inc[data-key]"); const X = shell.__insDly; if (!b || !X) return; e.stopPropagation(); X.incWin(b.dataset.key); }, true);
      /* R12, R13 : poignée « = » entre le Gantt et l'histogramme — toucher = d'un bord à l'autre (miniaturisé en bas ↔ plein écran) ;
         glisser = hauteur choisie (mémorisée) */
      shell.addEventListener("pointerdown", e => {
        const X = shell.__insDly;
        const pill = e.target.closest && e.target.closest(".dlyg-hh .dlyhh-pill");
        if (!X || !pill) return;
        e.preventDefault(); e.stopPropagation();
        const g = pill.closest(".dlyg"), hist = g.querySelector("#dlyGantt .ghist"), y0 = e.clientY, h0 = hist ? hist.offsetHeight : 110;
        /* v545 (remarque 4) : la poignée reste où on la lâche — hauteur la plus grande = du bas de l'écran visible jusque sous l'en-tête du Gantt */
        const scr = g.closest(".bdg-d-scroll"), ghd = g.querySelector("#dlyGantt > .gh"), hr0 = hist ? hist.getBoundingClientRect() : null;
        const visB = Math.min(scr ? scr.getBoundingClientRect().bottom : 1e9, dlyVpB());
        const maxH = hr0 && ghd ? Math.max(80, Math.floor(visB - ghd.getBoundingClientRect().bottom - 4)) : (scr ? Math.max(120, scr.clientHeight - 60) : 600);
        let h = h0, on = false;
        const bar = pill.closest(".dlyg-hh"), t0 = parseFloat(bar.style.top) || 0;
        try { pill.setPointerCapture(e.pointerId); } catch (err) {}
        const tmv = ev => ev.preventDefault();
        document.addEventListener("touchmove", tmv, { passive: false });
        /* tout mouvement compte comme un glissement ; seul un toucher net bascule d'un bord à l'autre */
        const mv = ev => { const dy = ev.clientY - y0; if (!on && !dy) return; on = true; ev.preventDefault(); h = Math.round(Math.max(0, Math.min(maxH, h0 - dy))); bar.style.top = (t0 + (h0 - h)) + "px"; };
        const up = () => {
          document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
          setTimeout(() => document.removeEventListener("touchmove", tmv), 0);
          /* v546 (R25) : en bas = histogramme entièrement caché (0) */
          if (!on) { X.hh(X.hhGet() === "full" ? 0 : "full"); return; }
          X.hh(h >= maxH ? "full" : h <= 30 ? 0 : h);
        };
        document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
      });
      /* FORMAT 91 : largeur des jours — glisser horizontalement sur l'en-tête, ou pincer le Gantt ;
         le jour sous le doigt reste en place ; largeur mémorisée ; un toucher simple ouvre toujours le calendrier */
      const dlyDwSet = (host, w, ax, p) => {
        w = Math.max(DLY_DW_MIN, Math.min(DLY_DW_MAX, Math.round(w)));
        if (w === DLY_DW) return;
        try { localStorage.setItem(DLY_SC[dlyScale()].k, String(w)); } catch (e) {}
        host.__drawn = false; dlyGanttDraw();
        const h2 = shell.querySelector("#dlyGantt");
        if (h2) h2.scrollLeft = Math.max(0, p * w - ax);
        let lab = document.getElementById("dlyDwLab");
        if (!lab) { lab = document.createElement("div"); lab.id = "dlyDwLab"; document.body.appendChild(lab); }
        const r = (h2 || host).getBoundingClientRect();
        lab.textContent = "1 JOUR = " + w + " PX";
        lab.style.left = (r.left + ax) + "px"; lab.style.top = (r.top + 4) + "px";
        clearTimeout(lab.__tm); lab.__tm = setTimeout(() => lab.remove(), 900);
      };
      shell.addEventListener("pointerdown", e => {
        const gh = e.target.closest && e.target.closest("#dlyGantt .gh");
        if (!gh || e.button > 0 || shell.__dlyPinch) return;
        const host = gh.closest("#dlyGantt"), hr = host.getBoundingClientRect();
        const x0 = e.clientX, y0 = e.clientY, w0 = DLY_DW, ax = x0 - hr.left, p = (ax + host.scrollLeft) / w0;
        let on = false, raf = 0;
        const mv = ev => {
          if (shell.__dlyPinch) return;   /* deuxième doigt posé : c'est le pincement qui agit */
          const dx = ev.clientX - x0;
          if (!on) { if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(ev.clientY - y0)) return; on = true; }
          ev.preventDefault();
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => dlyDwSet(host, w0 * Math.pow(2, dx / 160), ax, p));
        };
        const up = () => {
          document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
          if (on) { shell.__dlyNoClick = true; setTimeout(() => { shell.__dlyNoClick = false; }, 400); }
        };
        document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
      });
      if (!shell.__dlyPinchBound) {
        shell.__dlyPinchBound = true;
        /* plusieurs doigts sur le Gantt : noté, pour ne pas prendre la fin du geste pour un toucher (calendrier) */
        const multi = e => { if (e.touches && e.touches.length >= 2 && e.target.closest && e.target.closest("#dlyGantt")) shell.__dlyMultiT = Date.now(); };
        shell.addEventListener("touchstart", multi, { capture: true, passive: true });
        shell.addEventListener("touchmove", multi, { capture: true, passive: true });
        shell.addEventListener("touchend", e => { if (Date.now() - (shell.__dlyMultiT || 0) < 800) shell.__dlyMultiT = Date.now(); }, { capture: true, passive: true });
        let P0 = null;
        const dist = t => Math.abs(t[0].clientX - t[1].clientX), distY = t => Math.abs(t[0].clientY - t[1].clientY);
        shell.addEventListener("touchstart", e => {
          const host = e.target.closest && e.target.closest("#dlyGantt");
          if (!host || e.touches.length !== 2) return;
          const hr = host.getBoundingClientRect(), mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - hr.left;
          /* écarter à l'horizontale = largeur des jours ; à la verticale = hauteur des lignes et des barres (sens choisi au premier mouvement) */
          P0 = { t0: Date.now(), host, d: Math.max(20, dist(e.touches)), dy: Math.max(20, distY(e.touches)), rh0: dlyRhGet(), mode: "", rx: dist(e.touches), ry: distY(e.touches), w0: DLY_DW, ax: mx, p: (mx + host.scrollLeft) / DLY_DW };
          shell.__dlyPinch = true; shell.__dlyPinched = true;
          P0.tg = e.target; e.target.addEventListener("touchmove", pmv, { passive: false }); e.target.addEventListener("touchend", end); e.target.addEventListener("touchcancel", end);
          e.preventDefault();
        }, { passive: false });
        /* le Gantt se redessine pendant le geste : le doigt touche alors un élément retiré, qui garde ses événements ;
           on écoute donc aussi l'élément touché au départ */
        const pmv = e => {
          if (!P0 || e.touches.length !== 2 || e.__sviPinch) return;
          e.__sviPinch = true;
          e.preventDefault();
          if (!P0.mode) {
            const ex = Math.abs(dist(e.touches) - P0.rx), ey = Math.abs(distY(e.touches) - P0.ry);
            if (Math.max(ex, ey) < 12) return;
            P0.mode = ey > ex ? "v" : "h";
          }
          if (P0.mode === "v" && P0.tg && P0.tg.closest && P0.tg.closest(".ghist")) {
            /* v546 (R34) : sur l'histogramme, écarter à la verticale = sa hauteur (la poignée « = » suit) */
            if (P0.hh0 === undefined) { const hh = shell.querySelector("#dlyGantt .ghist"); P0.hh0 = hh ? hh.offsetHeight : 110; }
            const h = Math.round(Math.max(28, Math.min(2000, P0.hh0 * Math.max(20, distY(e.touches)) / P0.dy)));
            clearTimeout(P0.ht); P0.ht = setTimeout(() => { const X = shell.__insDly; if (X) X.hh(h); }, 60);
            return;
          }
          if (P0.mode === "v") {
            const rh = Math.round(Math.max(24, Math.min(64, P0.rh0 * Math.max(20, distY(e.touches)) / P0.dy)));
            if (rh !== dlyRhGet()) { try { localStorage.setItem(DLY_RH_KEY, String(rh)); } catch (err) {} dlyRhApply(rh); }
            return;
          }
          const w = P0.w0 * Math.max(20, dist(e.touches)) / P0.d;
          dlyDwSet(shell.querySelector("#dlyGantt") || P0.host, w, P0.ax, P0.p);
        };
        shell.addEventListener("touchmove", pmv, { passive: false });
        const end = e => { if (!P0 || (e.touches && e.touches.length >= 2)) return; const tg = P0.tg; if (tg) { tg.removeEventListener("touchmove", pmv); tg.removeEventListener("touchend", end); tg.removeEventListener("touchcancel", end); }
          /* v449 : toucher bref à deux doigts (sans écarter) n'importe où sur le Gantt = Gantt sur toute la largeur ↔ tableau de nouveau affiché */
          const tap = !P0.mode && Date.now() - P0.t0 < 450 && e.type === "touchend";
          P0 = null; setTimeout(() => { shell.__dlyPinch = false; }, 50);
          void tap;   /* v451 : les deux doigts ne servent qu'au pincement (le tableau ne revient que par la poignée) */
        };
        shell.addEventListener("touchend", end); shell.addEventListener("touchcancel", end);
      }
      /* v461 : appui long sur le NOM d'un lot ou d'un niveau sur le Gantt = son menu (ISOLER) */
      shell.addEventListener("pointerdown", e => {
        const X = shell.__insDly;
        const gn = e.target.closest && e.target.closest("#dlyGantt .gb-grp[data-path]");
        if (!X || !gn || e.button > 0) return;
        const x0 = e.clientX, y0 = e.clientY;
        const t = setTimeout(() => { shell.__dlyGLong = Date.now(); X.grpMenu(gn.dataset.path, gn); }, 500);
        const mv = ev => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) stop(); };
        const stop = () => { clearTimeout(t); document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", stop); document.removeEventListener("pointercancel", stop); };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", stop); document.addEventListener("pointercancel", stop);
      });
      /* barre d'un lot (ou d'un titre) sur le Gantt : glisser sans attendre = déplacer toutes ses tâches dans le temps ;
         appui long puis glisser vers le haut ou le bas = changer son rang ou son titre (FORMAT 96) */
      shell.addEventListener("pointerdown", e => {
        const X = shell.__insDly;
        const gb = e.target.closest && e.target.closest("#dlyGantt .gsum, #dlyGantt .gseg, #dlyGantt .gdot");
        if (!X || !gb || e.button > 0 || shell.__dlyPinch) return;
        e.preventDefault(); e.stopPropagation();
        const host = gb.closest("#dlyGantt"), path = gb.dataset.path;
        const els = [...host.querySelectorAll(".gsum, .gseg, .gdot")].filter(b => b.dataset.path === path);
        const g = (shell.__dlyRows || []).find(r => r.grp && r.path === path);
        const G = new Set(g ? g.all.map(t => t.key) : []);
        const bars = [...host.querySelectorAll(".gb")].filter(b => G.has(b.dataset.key));
        const moving = [...els, ...bars];
        const x0 = e.clientX, y0 = e.clientY;
        let mode = "", hit = null, days = 0, gfar = false;
        const t = setTimeout(() => { if (mode) return; mode = "vert"; els.forEach(b => b.classList.add("gb-lift")); document.body.classList.add("svi-dragging"); }, 500);
        const tmv = ev => { if (mode) ev.preventDefault(); };
        document.addEventListener("touchmove", tmv, { passive: false });
        const mv = ev => {
          if (shell.__dlyPinch) { clearTimeout(t); return; }
          const dx = ev.clientX - x0;
          if (mode === "vert") { ev.preventDefault(); if (!gfar && Math.hypot(dx, ev.clientY - y0) < 10) return; if (X.view() === "d") { if (!gfar) svToast("VUE PAR DÉBUT : PASSER EN VUE PAR LOT POUR DÉPLACER.", 3000, gb); gfar = true; hit = null; return; } gfar = true; shell.__dlySrcG = window.__sviDlySrcG = true; hit = g ? dlyGrpHit(ev, path, g.lvl, x0) : null; dlyGrpShow(hit); return; }
          if (!mode && Math.abs(dx) > 4) { mode = "time"; clearTimeout(t); moving.forEach(b => { b.__l0 = b.offsetLeft; b.classList.add("gb-drag"); }); }
          if (mode !== "time") return;
          ev.preventDefault();
          days = Math.round(dx / DLY_DW);
          moving.forEach(b => { b.style.left = (b.__l0 + days * DLY_DW) + "px"; });
        };
        const up = () => {
          clearTimeout(t);
          document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
          setTimeout(() => document.removeEventListener("touchmove", tmv), 0);
          document.getElementById("roLine")?.remove(); document.body.classList.remove("svi-dragging");
          shell.querySelectorAll(".dlyg-l tr.ro-on").forEach(r => r.classList.remove("ro-on")); sviDlyRoSync();
          moving.forEach(b => b.classList.remove("gb-drag", "gb-lift"));
          if (shell.__dlyPinched) { shell.__dlyPinched = false; X.render(); return; }
          if (mode === "vert") { if (!gfar) { X.grpMenu(path, gb); return; } if (hit) X.moveGroup(path, hit, gb); else X.render(); return; }
          if (mode === "time") { if (days) X.shiftGroup(path, days, gb); else X.render(); }
        };
        document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
      });
      shell.addEventListener("pointerdown", e => {
        const X = shell.__insDly;
        const bar = e.target.closest && e.target.closest("#dlyGantt .gb");
        if (!X || !bar || e.button > 0) return;
        if (bar.classList.contains("gb-ext")) { e.preventDefault(); svToast("TÂCHE HORS DE LA BRANCHE ISOLÉE : LECTURE SEULE (TOUT AFFICHER POUR LA MODIFIER).", 3000, bar); return; }
        const host = bar.closest("#dlyGantt"), body = host.querySelector(".gbody"), tmp = host.querySelector(".gtmp");
        const zero = bar.classList.contains("gb0");
        const key = bar.dataset.key, mode = zero || e.target.closest(".gb-e") ? "end" : e.target.closest(".gb-s") ? "start" : "body";
        e.preventDefault();
        const x0 = e.clientX, y0b = e.clientY, L0 = bar.offsetLeft, W0 = bar.offsetWidth;
        let moved = false, link = false, days = 0, vert = false, hitV = null;
        /* appui long : sur un bout = liaison ; sur le milieu = changer le rang (barre soulevée) */
        const t = setTimeout(() => { if (moved) return; if (mode !== "body") { link = true; bar.classList.add("gb-link"); } else if (X.view() === "d") { svToast("VUE PAR DÉBUT : PASSER EN VUE PAR LOT POUR DÉPLACER.", 3000, bar); } else { vert = true; bar.classList.add("gb-lift"); } }, 500);
        const br = () => body.getBoundingClientRect();
        /* liaison selon le bout de départ ET le bout d'arrivée (moitié gauche = début, moitié droite = fin) :
           fin → début = FD ; début → fin = FD dans l'autre sens ; début → début = DD ; fin → fin = rien */
        const linkPlan = ev => {
          /* les fils (flèches) peuvent couvrir le bout d'une barre : on prend la première barre sous le doigt */
          let tg = document.elementsFromPoint(ev.clientX, ev.clientY).map(e => e.closest && e.closest("#dlyGantt .gb")).find(Boolean);
          /* v517 : plus de sensibilité — sans barre exactement sous le doigt, la barre la plus proche (jusqu'à 26 px) est visée */
          if (!tg || tg.dataset.key === key) {
            let best = null, bd = 26;
            host.querySelectorAll(".gb:not(.gb-ext)").forEach(b => {
              if (b.dataset.key === key || !b.dataset.key) return;
              const q = b.getBoundingClientRect();
              const dx = Math.max(q.left - ev.clientX, 0, ev.clientX - q.right), dy = Math.max(q.top - ev.clientY, 0, ev.clientY - q.bottom);
              const d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = b; }
            });
            tg = best;
          }
          if (!tg || tg.dataset.key === key) return null;
          const r = tg.getBoundingClientRect(), side = ev.clientX > r.left + r.width / 2 ? "end" : "start", o = tg.dataset.key;
          let P = null;
          if (mode === "end" && side === "start") P = { pred: key, succ: o, t: "FD" };
          else if (mode === "start" && side === "end") P = { pred: o, succ: key, t: "FD" };
          else if (mode === "start" && side === "start") P = { pred: key, succ: o, t: "DD" };
          if (!P || X.reach(P.pred, P.succ)) return null;
          return { ...P, tg, side };
        };
        const ax = mode === "end" ? L0 + W0 : L0, ay = bar.offsetTop + bar.offsetHeight / 2;
        const mv = ev => {
          if (shell.__dlyPinch) { clearTimeout(t); return; }
          const dx = ev.clientX - x0;
          if (link) {
            const r = br();
            tmp.innerHTML = `<line x1="${ax}" y1="${ay}" x2="${ev.clientX - r.left}" y2="${ev.clientY - r.top}" stroke="#b42318" stroke-width="2" stroke-dasharray="4 3"/>`;
            /* FORMAT 96 : la barre survolée passe aussi en pointillés, bout visé marqué d'un point rouge
               (sauf liaison impossible : elle-même, une boucle, fin → fin) */
            const P = linkPlan(ev);
            host.querySelectorAll(".gb.gb-tgt").forEach(b => { if (!P || b !== P.tg) b.classList.remove("gb-tgt", "gb-ts", "gb-te"); });
            if (P) { P.tg.classList.add("gb-tgt"); P.tg.classList.toggle("gb-ts", P.side === "start"); P.tg.classList.toggle("gb-te", P.side === "end"); }
            return;
          }
          /* glisser la barre vers le haut ou le bas = changer le rang de la tâche (un seul trait) */
          const dy = ev.clientY - y0b;
          if (vert) { shell.__dlySrcG = window.__sviDlySrcG = true; hitV = dlyTaskHit(ev, null, key, x0); if (!hitV) document.getElementById("roLine")?.remove(); return; }
          if (!moved && Math.abs(dx) > 4) { moved = true; clearTimeout(t); bar.classList.add("gb-drag"); }
          if (!moved) return;
          days = Math.round(dx / DLY_DW);
          if (mode === "end") bar.style.width = Math.max(DLY_DW - 1, W0 + days * DLY_DW) + "px";
          else bar.style.left = (L0 + days * DLY_DW) + "px";
        };
        const up = ev => {
          clearTimeout(t);
          document.removeEventListener("pointermove", mv);
          document.removeEventListener("pointerup", up);
          document.removeEventListener("pointercancel", up);
          bar.classList.remove("gb-link", "gb-drag", "gb-lift");
          host.querySelectorAll(".gb.gb-tgt").forEach(b => b.classList.remove("gb-tgt", "gb-ts", "gb-te"));
          if (shell.__dlyPinch || shell.__dlyPinched) { shell.__dlyPinched = false; tmp.innerHTML = ""; document.getElementById("roLine")?.remove(); return; }
          if (vert) { document.getElementById("roLine")?.remove(); shell.querySelectorAll(".dlyg-l tr.ro-on").forEach(t => t.classList.remove("ro-on")); sviDlyRoSync(); if (hitV && hitV.on) X.superpose(key, hitV.on, bar); else if (hitV) X.dropTaskTo(key, hitV, bar); return; }
          if (link) {
            tmp.innerHTML = "";
            const P = linkPlan(ev);
            if (P) X.addLink(P.pred, P.succ, P.t, P.tg);
            return;
          }
          if (!moved && mode === "body" && bar.classList.contains("gb-tin")) { dlyGEdit(bar); return; }   /* nom dans la barre : toucher = le modifier */
          if (!moved || !days) { X.render(); return; }
          if (zero) { if (days > 0) X.giveDur(key, bar.dataset.at, days, bar); else X.render(); return; }
          X.dragTo(key, mode, days, bar);
        };
        document.addEventListener("pointermove", mv);
        document.addEventListener("pointerup", up);
        document.addEventListener("pointercancel", up);
      });
    }
    const dlyDraft = () => {
      const key = insDlyKey();
      LK.dlpDraft = LK.dlpDraft || {};
      if (key && !LK.dlpDraft[key]) LK.dlpDraft[key] = ((INS.dlp || {})[key] || []).map(p => ({ ...p }));
      return LK.dlpDraft;
    };
    /* FORMAT 22 : actions du planning (Gantt compris) — l'écran ne bouge jamais */
    const renderTabK = () => { grpFlush(); keepScroll(() => renderTab()); };
    shell.__insDly = INS && INS_EDIT ? { INS, dAdd, dDiff, dParse, dFr, insId, insSave, err: "", draft: dlyDraft,
      predFin: k => dlyPredFin(k), succs: k => dlySuccs(k), deb: k => dlyDeb(k), name: k => dlyName(k), shift: (k, g) => dlyShift(k, g),
      cal: () => insCal(), glued: k => dlyGlued(k), links: k => dlyLinks(k), apply: (k, q, o) => dlyApply(k, q, o),
      /* FORMAT 22 : replier / déplier sans faire bouger l'écran */
      fold: p => { dlyFoldToggle(p); keepScroll(() => renderTab()); },
      jal: k => { INS.jal = INS.jal || {}; if (INS.jal[k]) delete INS.jal[k]; else INS.jal[k] = true; insSave(); histLog("DÉLAIS", "JALON", dlyName(k) + (INS.jal[k] ? " — POSÉ" : " — RETIRÉ")); renderTabK(); },
      linkWin: (p, k) => dlyLinkWin(p, k), reach: (a, b) => dlyReach(a, b), addLink: (p, k, t, a) => dlyAddLink(p, k, t, a),
      gen: () => dlyGenComp(), comp: () => dlyCompressRun(), hasDates: () => dlyHasDates(), canComp: () => dlyCanCompress(),
      moveCut: (i, iso) => dlyMoveCut(i, iso), piecesWin: k => dlyPiecesWin(k), sortDeb: () => { dlySortByDeb(); insSave(); histLog("DÉLAIS", "CLASSER PAR DÉBUT", ""); keepScroll(() => renderTab()); }, hcfgWin: () => dlyHCfgWin(), succs: k => dlySuccs(k).map(dlyName), cutPlaf: iso => dlyCutPlaf(iso), plafSeg: (i, n, a) => dlySetPlaf(i, n, a), delCut: i => dlyDelCut(i), limTxt: k => dlyLimTxt(k),
      incWin: k => dlyIncWin(k), apprWin: () => dlyApproWin(), hh: v => { dlyHHSet(v); keepScroll(() => renderTab()); }, hhGet: () => dlyHHGet(),
      /* R18 : réglages de l'histogramme ; R19 / R20 : plage et filtre */
      hset: () => dlyHSet(), hsetPut: o => dlyHSetPut(o), sameU: () => dlySameU(dlyResSel()), hasSel: () => !!dlyResSel(),
      hrange: () => dlyHRange(), hrangeSet: R => { INS.hrange = R; insSave(); renderTabK(); },
      hval: () => dlyHVal(),
      hvalSet: V => {
        INS.hval = V; insSave();
        /* au lâcher : charges des jours retenus (plage et filtre) cochées dans DÉTAIL CHARGES, les autres charges cochées décochées */
        const H = dlyHistData();
        if (H && (V.min !== null || V.max !== null)) {
          const RG = dlyHRange(), C = H.cmd, hs = dlyHSet();
          const days = Object.keys(C ? C.L : H.tot).sort();
          let t = 0; const val = {};
          days.forEach(di => { t += C ? C.L[di] : H.tot[di]; val[di] = C || hs.aff !== "c" ? (C ? C.L[di] : H.tot[di]) : t; });
          if (!C && hs.aff === "c" && hs.cum === "r" && RG.a) { const b0 = days.filter(di => di < RG.a).reduce((x, di) => x + H.tot[di], 0); days.forEach(di => { val[di] -= b0; }); }
          const keep = days.filter(di => (!RG.a || di >= RG.a) && (!RG.b || di <= RG.b) && (V.min === null || val[di] >= V.min - 1e-9) && (V.max === null || val[di] <= V.max + 1e-9));
          if (keep.length) {
            /* charges des tâches de ces jours (commandes : par désignation | unité) */
            const sks = new Set(), ids = new Set(), tk = new Set();
            keep.forEach(di => { if (C) (C.det[di] || []).forEach(x => sks.add(x.sk)); else (H.det[di] || []).forEach(x => tk.add(x.k)); });
            (INS.links || []).forEach(l => { if (tk.has(l.lot + "|" + l.sec)) (l.chg || []).forEach(e => ids.add(e.id)); });
            let ch = 0, n = 0;
            H.R.forEach(r => { const on = C ? sks.has(dlyResK(r)) : ids.has(r.id); if (on) n++; if (r.on !== on) { r.on = on; ch++; } });
            if (ch) { insSave(); histLog("DÉLAIS", "FILTRE MIN / MAX", n + " CHARGE(S) COCHÉE(S)"); refreshAll(); return; }
          }
        }
        renderTabK();
      },
      /* R29 : affichage PAR LOT / PAR DÉBUT (vue, mémorisée par budget) ; R28 : zone touchée en dernier */
      view: () => dlyView(), viewSet: v => { dlyViewSet(v); keepScroll(() => renderTab()); }, zone: () => shell.__dlyZone || "gantt",
      /* R15 : repère d'une tâche à 0 jour glissé vers la droite = lui donner une durée (n jours travaillés) */
      giveDur: (k, at, n, a) => { const cal = insCal(), deb = sviWNear(cal, at, 1); dlyApply(k, { deb, fin: sviWFin(cal, deb, Math.max(1, n)) }, { anchor: a }); },
      /* v461 : menu d'un lot ou d'un niveau (appui long) : ISOLER / TOUT AFFICHER */
      grpMenu: (path, el) => {
        document.getElementById("blkMenu")?.remove();
        const m = document.createElement("div");
        m.id = "blkMenu"; m.dataset.for = "dlyGrp";
        const now = dlyIsoPath() === path;
        m.innerHTML = `<div class="blk-hint">${esc(lotLab(dlyLotPath(path)).full)}</div>`
          + `<button type="button" data-g="iso"><span>${now ? "TOUT AFFICHER" : "ISOLER"}</span></button>`
          + (dlyIsoPath() && !now ? `<button type="button" data-g="all"><span>TOUT AFFICHER</span></button>` : "");
        document.body.appendChild(m);
        sviPlaceMenu(m, el.getBoundingClientRect());
        const off = ev => { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener("pointerdown", off, true); } };
        setTimeout(() => document.addEventListener("pointerdown", off, true), 0);
        m.addEventListener("click", ev => {
          const b = ev.target.closest("[data-g]");
          if (!b) return;
          ev.stopPropagation();
          m.remove(); document.removeEventListener("pointerdown", off, true);
          shell.__dlyIso = b.dataset.g === "iso" && !now ? { ref: DLYG_REF, path } : null;
          refreshAll();
        });
      },
      isoOff: () => { shell.__dlyIso = null; refreshAll(); },
      moveRow: (k, t, after) => shell.__insDly.moveKeys([k], [t], after),
      /* déplacer un bloc de lignes (une tâche, ou toutes les tâches d'un lot) avant / après un autre */
      moveKeys: (ks, ts, after) => {
        const K = new Set(ks);
        if (!ks.length || !ts.length || ts.every(t => K.has(t))) return;
        dlyOrder(dlyKeys());
        const O = (INS.dord || []).filter(x => !K.has(x));
        const pos = ts.filter(t => !K.has(t)).map(t => O.indexOf(t)).filter(i => i >= 0);
        if (!pos.length) return;
        const j = after ? Math.max(...pos) + 1 : Math.min(...pos);
        O.splice(j, 0, ...(INS.dord || []).filter(x => K.has(x)));
        INS.dord = O; dlyTasksFromPlan(); insSave(); histLog("DÉLAIS", "ORDRE DES LIGNES", ks.map(dlyName).join(" ; ").slice(0, 120)); refreshAll();
      },
      /* changer une tâche de lot (cahier, Planning budgétaire) : seul le lot change ; désignation, activités,
         produits / charges, dates et liaisons du planning gardés. Renvoie la nouvelle clé, ou "" (refus, message) */
      changeLot: (key, nl, anchor) => {
        const [lo, se] = String(key).split("|"), nk = nl + "|" + se;
        if (!nl || lo === nl) return key;
        const L = INS.links || [];
        if (dlyKeys().includes(nk) || L.some(l => l.lot === nl && l.sec === se)) { svToast("CHANGEMENT REFUSÉ : " + lkName("sec", se) + " EXISTE DÉJÀ DANS LE LOT " + lkName("lot", nl) + ".", 4000, anchor); return ""; }
        const mine = L.filter(l => l.lot === lo && l.sec === se);
        for (const l of mine) {
          const t = L.find(m => m.lot === nl && m.prim === l.prim && m.des !== l.des);
          if (t) { svToast("RÈGLE A : LA TÂCHE PRIMAIRE " + lkName("lot", nl) + " › " + lkName("prim", l.prim) + " EST DÉJÀ LIÉE À " + lkName("des", t.des) + ".", 4500, anchor); return ""; }
        }
        mine.forEach(l => { l.lot = nl; });
        const mv = o => { if (o && Object.prototype.hasOwnProperty.call(o, key)) { o[nk] = o[key]; delete o[key]; } };
        mv(INS.dlp); mv(LK.dlpDraft); mv(INS.jal); mv(INS.dpred);
        Object.keys(INS.dpred || {}).forEach(s2 => { INS.dpred[s2] = dlyLinks(s2).map(x => x.k === key ? { ...x, k: nk } : x); });
        INS.dord = (INS.dord || []).map(x => x === key ? nk : x);
        if (shell.__dlySel && shell.__dlySel.has(key)) { shell.__dlySel.delete(key); shell.__dlySel.add(nk); }
        histLog("DÉLAIS", "CHANGEMENT DE LOT", lkName("sec", se) + " : " + lkName("lot", lo) + " → " + lkName("lot", nl));
        return nk;
      },
      /* même intitulé d'activité secondaire déjà dans le lot d'arrivée → clé de cette tâche, sinon "" */
      sameIn: (key, nl) => {
        const se = String(key).split("|")[1], nm = U_(lkName("sec", se));
        return dlyKeys().find(k => { const [lo, s2] = k.split("|"); return lo === nl && k !== key && U_(lkName("sec", s2)) === nm; }) || "";
      },
      /* fenêtre TÂCHE DÉJÀ DANS LE LOT : FUSIONNER / REMPLACER / ANNULER (cahier, Planning budgétaire) */
      mergeAsk: async (key, ek, anchor) => {
        const X = shell.__insDly, plan = X.mergePlan(key, ek);
        const line = k => esc(dlyName(k)) + " — " + (dlyDeb(k) ? esc(dFr(dlyDeb(k))) + " → " + esc(dFr(dlyFin(k))) : "SANS DATES") + " — " + (INS.links || []).filter(l => l.lot + "|" + l.sec === k).length + " LIAISON(S)";
        const v = await svChoose({ title: "TÂCHE DÉJÀ DANS LE LOT",
          html: `<div class="svc-sub">${esc(lkName("sec", ek.split("|")[1]))} EXISTE DÉJÀ DANS ${esc(lkName("lot", ek.split("|")[0]))}</div>
            <ul class="svc-list"><li>${line(ek)}</li><li>${line(key)} (TÂCHE LÂCHÉE)</li></ul>
            ${plan.err ? `<div class="svc-sub svc-warn">IMPOSSIBLE : ${esc(plan.err)}</div>` : ""}`,
          buttons: [{ v: "rep", label: "REMPLACER", tone: "neutral", disabled: !!plan.err }, { v: "fus", label: "FUSIONNER", tone: "neutral", disabled: !!plan.err }] });
        if (!v || plan.err) { renderTabK(); return ""; }
        return X.mergeDo(key, ek, plan, v === "fus" ? "fus" : "rep");
      },
      /* plan de la fusion : tâche gardée (la primaire s'il y en a une, sinon celle du lot) et liaisons du budget réunies */
      mergePlan: (key, ek) => {
        const [lo, se] = key.split("|"), [nl, es] = ek.split("|");
        const L = INS.links || [];
        const mine = L.filter(l => l.lot === lo && l.sec === se), theirs = L.filter(l => l.lot === nl && l.sec === es);
        const isP = A => A.some(l => insIsPrimLink(l.prim, l.sec));
        const keepMine = isP(mine) && !isP(theirs);
        const S = keepMine ? nl + "|" + se : ek;
        const tgt = keepMine ? mine : theirs, oth = keepMine ? theirs : mine;
        const tPrim = isP(tgt) ? (tgt.find(l => insIsPrimLink(l.prim, l.sec)) || {}).prim : null, tSec = S.split("|")[1];
        const out = L.filter(l => !mine.includes(l) && !theirs.includes(l)).map(l => ({ ...l }));
        const add = (l, prim) => {
          const n = { ...l, lot: nl, sec: tSec, prim: prim || l.prim, prd: (l.prd || []).map(x => ({ ...x })), chg: (l.chg || []).map(x => ({ ...x })) };
          const same = out.find(o => o.des === n.des && o.lot === n.lot && o.prim === n.prim && o.sec === n.sec);
          if (!same) { out.push(n); return; }
          ["prd", "chg"].forEach(f => n[f].forEach(x => { if (!(same[f] || []).some(y => y.id === x.id)) (same[f] = same[f] || []).push(x); }));
        };
        tgt.forEach(l => add(l, null)); oth.forEach(l => add(l, tPrim));
        let err = "";
        const P = new Map(), Sx = new Map();
        out.forEach(l => {
          const tp = l.lot + "|" + l.prim, ts = l.lot + "|" + l.sec;
          if (P.has(tp) && P.get(tp) !== l.des && !err && l.lot === nl) err = "RÈGLE A : LA TÂCHE PRIMAIRE " + lkName("lot", l.lot) + " › " + lkName("prim", l.prim) + " SERAIT LIÉE À DEUX DÉSIGNATIONS (" + lkName("des", P.get(tp)) + " ET " + lkName("des", l.des) + ").";
          P.set(tp, l.des);
          if (Sx.has(ts) && Sx.get(ts) !== l.des && !err && l.lot === nl) err = "RÈGLE A : LA TÂCHE " + lkName("lot", l.lot) + " › " + lkName("sec", l.sec) + " SERAIT LIÉE À DEUX DÉSIGNATIONS (" + lkName("des", Sx.get(ts)) + " ET " + lkName("des", l.des) + ").";
          Sx.set(ts, l.des);
        });
        return { S, links: out, err };
      },
      /* fusion / remplacement : une seule tâche S ; key = tâche lâchée, ek = tâche du lot */
      mergeDo: (key, ek, plan, mode) => {
        const S = plan.S, both = [key, ek];
        const db = mode === "fus" ? [dlyDeb(key), dlyDeb(ek)].filter(Boolean).sort()[0] || "" : dlyDeb(key);
        const fn = mode === "fus" ? [dlyFin(key), dlyFin(ek)].filter(Boolean).sort().pop() || "" : dlyFin(key);
        const pr = (mode === "fus" ? [...dlyLinks(ek), ...dlyLinks(key)] : dlyLinks(key)).filter(x => !both.includes(x.k));
        const jal = mode === "fus" ? !!((INS.jal || {})[key] || (INS.jal || {})[ek]) : !!(INS.jal || {})[key];
        INS.links = plan.links;
        both.forEach(k => { if (INS.dlp) delete INS.dlp[k]; if (LK.dlpDraft) delete LK.dlpDraft[k]; if (INS.dpred) delete INS.dpred[k]; if (INS.jal) delete INS.jal[k]; });
        if (db || fn) { INS.dlp = INS.dlp || {}; INS.dlp[S] = [{ id: insId(), deb: db, fin: fn }]; }
        INS.jal = INS.jal || {}; if (jal) INS.jal[S] = true;
        /* successeurs des deux tâches reportés sur S (sans doublon) */
        Object.keys(INS.dpred || {}).forEach(s2 => {
          const seen = new Set();
          INS.dpred[s2] = dlyLinks(s2).map(x => both.includes(x.k) ? { ...x, k: S } : x).filter(x => x.k !== s2 && !seen.has(x.k) && seen.add(x.k));
          if (!INS.dpred[s2].length) delete INS.dpred[s2];
        });
        /* prédécesseurs de S, sans boucle ni doublon */
        const kept = [];
        pr.forEach(x => { if (x.k === S || kept.some(y => y.k === x.k) || dlyReach(x.k, S)) return; kept.push({ ...x }); });
        if (kept.length) { INS.dpred = INS.dpred || {}; INS.dpred[S] = kept; }
        const pos = (INS.dord || []).indexOf(ek);
        INS.dord = (INS.dord || []).filter(x => !both.includes(x) && x !== S);
        INS.dord.splice(pos >= 0 ? Math.min(pos, INS.dord.length) : INS.dord.length, 0, S);
        if (shell.__dlySel) both.forEach(k => shell.__dlySel.delete(k));
        histLog("DÉLAIS", mode === "fus" ? "TÂCHES FUSIONNÉES" : "TÂCHE REMPLACÉE", dlyName(key) + " → " + dlyName(S));
        dlyTasksFromPlan(); insSave(); refreshAll();
        return S;
      },
      /* lot (ou titre) déplacé dans le temps (23/10/2026) : toutes ses tâches du même nombre de jours travaillés, durées gardées ;
         vers la droite, les tâches suivantes sont poussées ; vers la gauche, les prédécesseurs hors du lot sont poussés plus tôt,
         de proche en proche ; début du projet atteint : fenêtre DÉBUT DU PROJET ATTEINT ; date butoir jamais dépassée */
      shiftGroup: (path, nCal, anchor) => {
        const g = (shell.__dlyRows || []).find(x => x.grp && x.path === path);
        if (!g || !nCal) { renderTabK(); return; }
        const cal = insCal(), G = new Set(g.all.map(t => t.key));
        const ks = [...G].filter(k => dlyDeb(k) && dlyFin(k));
        if (!ks.length) { renderTabK(); return; }
        const d0 = ks.map(dlyDeb).sort()[0];
        const nd = sviWNear(cal, sviIsoAdd(d0, nCal), nCal > 0 ? 1 : -1);
        const w = nd >= d0 ? (sviWDur(cal, d0, nd) || 1) - 1 : -((sviWDur(cal, nd, d0) || 1) - 1);
        if (!w) { renderTabK(); return; }
        const N = {}, cur = k => N[k] || { deb: dlyDeb(k), fin: dlyFin(k) };
        ks.forEach(k => { const c = cur(k), dur = sviWDur(cal, c.deb, c.fin) || 1, deb = sviWAdd(cal, sviWNear(cal, c.deb, 1), w); N[k] = { deb, fin: sviWFin(cal, deb, dur) }; });
        if (w < 0) {
          const q = [...ks];
          for (let guard = 0; q.length && guard < 5000; guard++) {
            const k = q.shift(), c = cur(k);
            dlyLinks(k).forEach(x => {
              const pc = cur(x.k);
              if (!pc.deb) return;
              const pdur = pc.fin ? sviWDur(cal, pc.deb, pc.fin) || 1 : 0;
              let nf = null;
              if (x.t === "DD") { const lim = sviWAdd(cal, sviWNear(cal, c.deb, 1), -Math.max(0, x.o || 0)); if (pc.deb > lim) nf = { deb: lim }; }
              else { const lim = sviWAdd(cal, c.deb, -Math.max(0, x.o || 0)), f = pc.fin || pc.deb; if (f > lim) nf = { fin: sviWNear(cal, lim, -1) }; }
              if (!nf) return;
              if (nf.deb) N[x.k] = { deb: nf.deb, fin: pdur ? sviWFin(cal, nf.deb, pdur) : "" };
              else N[x.k] = pdur ? { deb: sviWDeb(cal, nf.fin, pdur), fin: nf.fin } : { deb: nf.fin, fin: "" };
              q.push(x.k);
            });
          }
        }
        const apply = () => {
          const back = JSON.stringify({ dlp: INS.dlp || {}, dr: LK.dlpDraft || {} });
          Object.keys(N).forEach(k => {
            const L = dlyDraftKey(k);
            if (L.length > 1 && N[k].deb) { dlyShiftList(L, N[k].deb); return; }
            if (!L[0]) L.push({ id: insId() });
            L.splice(1); L[0].deb = N[k].deb; L[0].fin = N[k].fin || ""; delete L[0].dmd; delete L[0].fmd;
          });
          dlyCommitDrafts(); dlyRespect(false);
          const f1 = dlyEnd(dlyCurDates());
          if (INS.dbut && f1 > INS.dbut) {
            const b = JSON.parse(back); INS.dlp = b.dlp; LK.dlpDraft = b.dr;
            svToast("DÉPLACEMENT REFUSÉ : LA DATE BUTOIR DU " + dFr(INS.dbut) + " SERAIT DÉPASSÉE (FIN LE " + dFr(f1) + ").", 4500, anchor);
            renderTabK(); return;
          }
          const pushed = Object.keys(N).filter(k => !G.has(k)).length;
          histLog("DÉLAIS", "LOT DÉPLACÉ", g.name + " : " + (w > 0 ? "+" : "") + w + " J" + (pushed ? " (" + pushed + " TÂCHE(S) POUSSÉE(S))" : ""));
          insSave(); renderTabK(); insRenderChain();
        };
        const p0 = INS.pdeb || INS.gdeb || "", minD = Object.values(N).map(v => v.deb).filter(Boolean).sort()[0] || "";
        if (w < 0 && p0 && minD && minD < p0) {
          const first = Object.keys(N).find(k => N[k].deb === minD);
          svChoose({ title: "DÉBUT DU PROJET ATTEINT",
            html: `<div class="svc-sub">LA TÂCHE ${esc(dlyName(first))} DEVRAIT COMMENCER LE ${esc(dFr(minD))}, AVANT LE DÉBUT DU PROJET (${esc(dFr(p0))}).</div>`,
            buttons: [{ v: "go", label: "AVANCER LE DÉBUT DU PROJET", tone: "neutral" }] }).then(r => {
            if (r !== "go") { renderTabK(); return; }
            INS.pdeb = minD; INS.gdeb = minD;
            histLog("DÉLAIS", "DÉBUT DU PROJET AVANCÉ", dFr(p0) + " → " + dFr(minD));
            apply();
          });
          return;
        }
        apply();
      },
      /* lot (ou titre) déplacé en hauteur : rang, et titre d'arrivée (son nom prend le chemin du titre, comme dans TÂCHES) ;
         plan = { parent: chemin du titre d'arrivée ("" = racine), before: clé de la tâche devant laquelle il se place, on: chemin superposé } */
      moveGroup: (path, plan, anchor) => {
        const L = INS.lot, src = dlyLotPath(path);
        /* v461 : glissé entre deux lignes = la PLACE change, jamais le parent (le numéro garde l'appartenance ; placé hors du
           bloc de son parent, il s'affiche seul à sa place) ; superposé sur un titre = rangé dans ce titre */
        let base = plan.on ? [] : plan.keep ? src.slice(0, -1) : plan.parent ? dlyLotPath(plan.parent) : [], extra = null, N = "";
        const under = (v, P) => { const s2 = dlyLotPath(v); return s2.length >= P.length && P.every((g, i) => U_(g) === U_(s2[i])); };
        if (plan.on) {
          const T = dlyLotPath(plan.on);
          const own = L.some(x => U_(x.v) === U_(T.join(" / "))), kids = L.some(x => dlyLotPath(x.v).length > T.length && under(x.v, T));
          if (own && !kids) {
            /* superposé sur un lot simple : nouveau niveau qui regroupe les deux (comme dans TÂCHES) */
            N = insNextLevel(T.slice(0, -1));
            base = T.slice(0, -1).concat(N); extra = { P: T, base };
          } else base = T;
        }
        if (base.length >= src.length && src.every((g, i) => U_(g) === U_(base[i]))) { renderTabK(); return; }   /* pas dans sa propre branche */
        /* déjà rangé là (même parent) : on le dit, au lieu de ne rien faire en silence */
        if (!extra && !plan.keep && U_(src.slice(0, -1).join(" / ")) === U_(base.join(" / ")) && (plan.on || !plan.before)) { svToast(src[src.length - 1] + (base.length ? " EST DÉJÀ DANS " + base[base.length - 1] : " N'EST DANS AUCUN GROUPE") + ".", 3500, anchor); }
        const ren = new Map();
        const add = (P0, b0) => L.filter(x => !x.t && under(x.v, P0)).forEach(x => ren.set(x.id, b0.concat(dlyLotPath(x.v).slice(P0.length - 1)).join(" / ")));
        add(src, base); if (extra) add(extra.P, extra.base);
        const ids = new Set(ren.keys()), vals = [...ren.values()].map(U_);
        const clash = [...ren.values()].find(v => L.some(y => !ids.has(y.id) && U_(y.v) === U_(v))) || vals.find((v, i) => vals.indexOf(v) !== i);
        if (clash) { svToast("LOT « " + clash + " » EXISTE DÉJÀ : DÉPLACEMENT REFUSÉ.", 4000, anchor); renderTabK(); return; }
        const moved = new Set([...ren.keys()].filter(id => !(extra && under((L.find(x => x.id === id) || {}).v, extra.P) && !under((L.find(x => x.id === id) || {}).v, src))));
        ren.forEach((v, id) => { L.find(x => x.id === id).v = v; });
        /* rang : les tâches du bloc se placent devant « before » (sinon à la fin) */
        const keys = [...dlyOrder(dlyKeys()).keys()];
        const mine = keys.filter(k => moved.has(k.split("|")[0])), rest = keys.filter(k => !moved.has(k.split("|")[0]));
        let j = plan.before ? rest.indexOf(plan.before) : -1;
        if (j < 0) j = rest.length;
        rest.splice(j, 0, ...mine);
        INS.dord = rest;
        dlyTasksFromPlan(); insSave();
        histLog("DÉLAIS", N ? "GROUPE DE LOTS CRÉÉ" : plan.keep ? "LOT DÉPLACÉ (PLACE, MÊME TITRE)" : "LOT DÉPLACÉ", dlyLotPath(path).pop() + (plan.keep ? "" : " → " + (base.length ? base.join(" / ") : "RACINE")));
        refreshAll();
        if (N) setTimeout(() => { const i = [...shell.querySelectorAll("input.dly-nm")].find(x => x.dataset.path === base.join(" / ")); if (i) { i.focus(); try { i.select(); } catch (e) {} } }, 80);
      },
      /* SUPERPOSER une tâche B (glissée) sur une tâche A (cahier, Planning budgétaire, 16/10/2026) :
         CRÉER UN NIVEAU (deux tâches sous un sous-lot « NIVEAU n » du lot de A) / FUSIONNER (une seule tâche) / ANNULER ;
         puis, s'il y a des produits en double (même désignation, même unité) : GARDER LES DOUBLONS (doublons de B → IMPORT NON CRÉÉ)
         / IGNORER (doublons de B supprimés) / ANNULER */
      superpose: (B, A, anchor) => {
        const X = shell.__insDly;
        if (!A || !B || A === B) { renderTabK(); return; }
        const linksOf = k => (INS.links || []).filter(l => l.lot + "|" + l.sec === k);
        const nm = (k, i) => lkName(i ? "sec" : "lot", k.split("|")[i ? 1 : 0]);
        const lvlErr = () => {
          /* règle A dans le nouveau niveau : une même activité primaire ne peut pas y avoir deux désignations */
          const P = new Map(); let e = "";
          [...linksOf(A), ...linksOf(B)].forEach(l => { if (P.has(l.prim) && P.get(l.prim) !== l.des && !e) e = "RÈGLE A : LA TÂCHE PRIMAIRE › " + lkName("prim", l.prim) + " SERAIT LIÉE À DEUX DÉSIGNATIONS (" + lkName("des", P.get(l.prim)) + " ET " + lkName("des", l.des) + ")."; P.set(l.prim, l.des); });
          return e;
        };
        const d = document.createElement("div");
        d.id = "svConf";
        const draw = () => {
          const same = U_(nm(A, 1)) === U_(nm(B, 1));
          const eL = same ? "" : lvlErr(), eF = X.mergePlan(B, A).err;
          const row = (k, lab) => { const [lo, se] = k.split("|"), segs = dlyLotPath(lkName("lot", lo));
            return `<div class="sup-r"><div class="sup-l">${lab}</div>
              <label>LOT<span class="sup-pre">${esc(segs.slice(0, -1).map(x => x + " / ").join(""))}</span><input class="sup-in" data-kind="lot" data-path="${esc(segs.join(" / "))}" value="${esc(segs[segs.length - 1] || "")}"></label>
              <label>ACTIVITÉ SECONDAIRE<span class="sup-pre"></span><input class="sup-in${same ? " sup-bad" : ""}" data-kind="sec" data-sid="${esc(se)}" value="${esc(lkName("sec", se))}"></label></div>`; };
          d.innerHTML = `<div class="svc-card sup-card" role="dialog" aria-modal="true">
            <button type="button" class="svc-close" data-v="" aria-label="Fermer">✕</button>
            <div class="svc-t">SUPERPOSER</div>
            <div class="svc-x svc-html">${row(A, "TÂCHE VISÉE")}${row(B, "TÂCHE GLISSÉE")}
              ${same ? `<div class="svc-sub svc-warn">MÊME ACTIVITÉ « ${esc(nm(A, 1))} » : CHANGER UN INTITULÉ POUR CRÉER UN GROUPE (OU FUSIONNER).</div>` : ""}
              ${eL ? `<div class="svc-sub svc-warn">CRÉER UN GROUPE IMPOSSIBLE : ${esc(eL)}</div>` : ""}
              ${eF ? `<div class="svc-sub svc-warn">FUSIONNER IMPOSSIBLE : ${esc(eF)}</div>` : ""}</div>
            <div class="svc-f"><button type="button" class="svc-b" data-v="">ANNULER</button>
              <button type="button" class="svc-b svc-ok svc-neutral" data-v="fus"${eF ? " disabled" : ""}>FUSIONNER</button>
              <button type="button" class="svc-b svc-ok svc-neutral" data-v="lvl"${same || eL ? " disabled" : ""}>CRÉER UN GROUPE</button></div></div>`;
        };
        document.getElementById("svConf")?.remove();
        document.body.appendChild(d);
        draw();
        /* lot et activité modifiables à tout moment (mêmes règles que le PLANNING : pas de doublon) */
        d.addEventListener("change", e => { const i = e.target.closest("input.sup-in"); if (!i) return; X.rename(i); setTimeout(() => { if (d.isConnected) draw(); }, 0); });
        d.addEventListener("click", e => {
          const b = e.target.closest("[data-v]");
          if (!b && e.target !== d) return;
          if (b && b.disabled) return;
          const v = b ? b.dataset.v : "";
          d.remove();
          if (!v) { renderTabK(); return; }
          X.supDups(B, A, () => v === "lvl" ? X.supLevel(B, A) : X.mergeDo(B, A, X.mergePlan(B, A), "fus"), anchor);
        });
      },
      /* produits en double entre A et B (même désignation + même unité) : fenêtre DOUBLONS DE PRODUITS, puis suite */
      supDups: (B, A, then, anchor) => {
        const linksOf = k => (INS.links || []).filter(l => l.lot + "|" + l.sec === k);
        const pk = id => { const r = INS.prd.find(x => x.id === id) || {}; return U_(r.des) + "|" + U_(r.u); };
        const inA = new Set(linksOf(A).flatMap(l => (l.prd || []).map(x => pk(x.id))));
        const dup = [...new Set(linksOf(B).flatMap(l => (l.prd || []).filter(x => inA.has(pk(x.id))).map(x => x.id)))];
        if (!dup.length) { then(); return; }
        const names = dup.map(id => { const r = INS.prd.find(x => x.id === id) || {}; return (r.des || "") + (r.u ? " (" + r.u + ")" : ""); });
        svChoose({ title: "DOUBLONS DE PRODUITS",
          html: `<div class="svc-sub">${dup.length} PRODUIT(S) DE ${esc(dlyName(B))} EXISTE(NT) DÉJÀ DANS ${esc(dlyName(A))} :</div><ul class="svc-list">${names.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`,
          buttons: [{ v: "ign", label: "IGNORER", tone: "neutral" }, { v: "keep", label: "GARDER LES DOUBLONS", tone: "neutral" }] }).then(v => {
          if (!v) { renderTabK(); return; }
          const ids = new Set(dup), V = (k, id) => (INS[k].find(x => x.id === id) || {});
          if (v === "keep") {
            /* doublons gardés dans l'onglet IMPORT NON CRÉÉ, avec leur chaîne, pour être revus */
            const items = [];
            linksOf(B).forEach(l => (l.prd || []).filter(x => ids.has(x.id)).forEach(x => {
              const r = V("prd", x.id), D = V("des", l.des);
              items.push({ id: insId(), on: false, bad: ["des"], why: "DOUBLON À LA SUPERPOSITION (" + dlyName(B) + " SUR " + dlyName(A) + ")", line: "",
                src: { art: String(D.art || ""), dc: D.des || "", upb: D.u || "", lot: V("lot", l.lot).v || "", prim: V("prim", l.prim).v || "", sec: V("sec", l.sec).v || "",
                  type: "PRD", article: "", des: r.des || "", u: r.u || "", nbr: String(r.nbr ?? ""), d1: String(r.d1 ?? ""), d2: String(r.d2 ?? ""), d3: String(r.d3 ?? ""), q: "" } });
            }));
            INS.inc = (INS.inc || []).concat(items);
          }
          INS.links = (INS.links || []).map(l => l.lot + "|" + l.sec === B ? { ...l, prd: (l.prd || []).filter(x => !ids.has(x.id)) } : l).filter(l => (l.prd || []).length);
          /* une ligne produit qui n'est plus liée nulle part est retirée du détail produits */
          INS.prd = INS.prd.filter(r => !ids.has(r.id) || (INS.links || []).some(l => (l.prd || []).some(x => x.id === r.id)));
          histLog("DÉLAIS", "SUPERPOSITION — DOUBLONS " + (v === "keep" ? "GARDÉS (IMPORT NON CRÉÉ)" : "IGNORÉS"), dup.length + " PRODUIT(S) DE " + dlyName(B));
          insSave();
          then();
        });
      },
      /* CRÉER UN NIVEAU : sous-lot « NIVEAU n » du lot de A ; A puis B y passent (seul le lot change) */
      supLevel: (B, A) => {
        const X = shell.__insDly, la = A.split("|")[0], N = insNextLevel(dlyLotPath(lkName("lot", la)));
        const nl = { id: insId(), v: dlyLotPath(lkName("lot", la)).concat(N).join(" / ") };
        const i = INS.lot.findIndex(x => x.id === la);
        INS.lot.splice(i < 0 ? INS.lot.length : i + 1, 0, nl);
        const kA = X.changeLot(A, nl.id), kB = kA ? X.changeLot(B, nl.id) : "";
        if (!kA || !kB) { if (!kA) INS.lot = INS.lot.filter(x => x !== nl); insSave(); refreshAll(); return; }
        INS.dord = (INS.dord || []).filter(x => x !== kB);
        INS.dord.splice(INS.dord.indexOf(kA) + 1, 0, kB);
        dlyTasksFromPlan(); insSave();
        histLog("DÉLAIS", "GROUPE DE LOTS CRÉÉ", dlyName(kA) + " + " + dlyName(kB));
        refreshAll();
        setTimeout(() => { const inp = [...shell.querySelectorAll("input.dly-nm")].find(x => x.dataset.path === nl.v); if (inp) { inp.focus(); try { inp.select(); } catch (e) {} } }, 80);
      },
      /* tâche lâchée sur une ligne (tableau ou Gantt) : autre lot → changement de lot, puis rang */
      /* dépôt d'une tâche au niveau choisi : lot d'arrivée (trait court / long), puis rang (devant la tâche suivante, sinon après la précédente) */
      dropTaskTo: (key, h, anchor) => {
        const X = shell.__insDly;
        const lt = INS.lot.find(l => !l.t && dlyLotPath(l.v).join(" / ") === h.parent);
        if (!lt) { renderTabK(); return; }
        let k = key;
        if (lt.id !== key.split("|")[0]) {
          const ek = X.sameIn(key, lt.id);
          if (ek) { X.mergeAsk(key, ek, anchor); return; }
          k = X.changeLot(key, lt.id, anchor); if (!k) { renderTabK(); return; } insSave(); insRenderChain();
        }
        /* v517 : tâche déplacée DANS SON LOT — seul son rang change dans le lot ; le lot reste à sa place
           (avant : ses tâches, dispersées dans l'ordre général, pouvaient faire descendre tout le lot en bas) */
        { const lo = k.split("|")[0];
          dlyOrder(dlyKeys());
          const D = INS.dord || [], S = D.filter(x => x.split("|")[0] === lo);
          const inS = x => !!x && x !== k && S.includes(x);
          if (S.length > 1 && (inS(h.before) || inS(h.afterKey) || (!h.before && !h.afterKey))) {
            const seq = S.filter(x => x !== k);
            if (inS(h.before)) seq.splice(seq.indexOf(h.before), 0, k);
            else if (inS(h.afterKey)) seq.splice(seq.indexOf(h.afterKey) + 1, 0, k);
            else seq.push(k);
            const at = D.findIndex(x => S.includes(x));
            const rest = D.filter(x => !S.includes(x)), nb = D.slice(0, at).filter(x => !S.includes(x)).length;
            rest.splice(nb, 0, ...seq);
            if (rest.join("\n") === D.join("\n")) { renderTabK(); return; }
            INS.dord = rest; dlyTasksFromPlan(); insSave();
            histLog("DÉLAIS", "ORDRE DES LIGNES", dlyName(k) + " (DANS SON LOT)");
            refreshAll(); return;
          }
          /* déposée à la limite du lot (devant la première tâche du lot suivant) : dernière de son lot */
          if (S.length > 1 && h.before && !S.includes(h.before)) {
            const seq = S.filter(x => x !== k).concat(k), at = D.findIndex(x => S.includes(x));
            const rest = D.filter(x => !S.includes(x)), nb = D.slice(0, at).filter(x => !S.includes(x)).length;
            rest.splice(nb, 0, ...seq);
            INS.dord = rest; dlyTasksFromPlan(); insSave(); histLog("DÉLAIS", "ORDRE DES LIGNES", dlyName(k) + " (DANS SON LOT)"); refreshAll(); return;
          }
        }
        if (h.before && h.before !== k) X.moveKeys([k], [h.before], false);
        else if (h.afterKey && h.afterKey !== k) X.moveKeys([k], [h.afterKey], true);
        else renderTabK();
      },
      dropTask: (key, tr, after) => {
        const X = shell.__insDly;
        let nl = null;
        if (tr.classList.contains("dly-task")) nl = String(tr.dataset.key).split("|")[0];
        else if (after) {
          const lt = INS.lot.find(x => dlyLotPath(x.v).join(" / ") === tr.dataset.path);
          if (!lt) { svToast("CHANGEMENT REFUSÉ : " + tr.dataset.path + " EST UN GROUPE, PAS UN LOT. LÂCHER LA TÂCHE PARMI LES TÂCHES D'UN LOT.", 4500, tr); return; }
          nl = lt.id;
        }
        let k = key;
        if (nl && nl !== key.split("|")[0]) {
          const ek = X.sameIn(key, nl);
          if (ek) { X.mergeAsk(key, ek, tr); return; }
          k = X.changeLot(key, nl, tr); if (!k) { renderTabK(); return; } insSave(); insRenderChain();
        }
        const g = tr.classList.contains("dly-task") ? null : (shell.__dlyRows || []).find(x => x.grp && x.path === tr.dataset.path);
        const ts = (g ? g.all.map(t => t.key) : [tr.dataset.key]).map(t => t === key ? k : t).filter(t => t && t !== k);
        if (ts.length) X.moveKeys([k], ts, after); else renderTabK();
      },
      linked: k => (INS.links || []).some(l => l.lot + "|" + l.sec === k),
      /* tâches retirées du planning (non liées seulement, règle G) : dates, liaisons de planning et jalon */
      removeTasks: keys => {
        keys.forEach(k => {
          if (INS.dlp) delete INS.dlp[k];
          if (LK.dlpDraft) delete LK.dlpDraft[k];
          if (INS.dpred) delete INS.dpred[k];
          if (INS.jal) delete INS.jal[k];
          Object.keys(INS.dpred || {}).forEach(s2 => { INS.dpred[s2] = dlyLinks(s2).filter(x => x.k !== k); if (!INS.dpred[s2].length) delete INS.dpred[s2]; });
          if (shell.__dlySel) shell.__dlySel.delete(k);
        });
        insSave();
      },
      /* nom modifié dans le PLANNING : même lot / même activité que dans TÂCHES (doublons refusés) */
      /* v533 : quiet = nom gardé sans redessiner (au début d'un glissement : la ligne sous le doigt ne doit pas disparaître) ;
         les chemins affichés sont mis à jour sur place, le tableau est redessiné à la fin du glissement */
      rename: (inp, opts = {}) => {
        const v = U_(sviClean(inp.value));
        const back = () => { if (opts.quiet) { inp.value = inp.defaultValue; return; } renderTabK(); };
        const done = () => { if (opts.quiet) { inp.defaultValue = inp.value = v; shell.__gnRefresh = true; } else refreshAll(); };
        if (inp.dataset.kind === "sec") {
          const id = inp.dataset.sid, r = INS.sec.find(x => x.id === id);
          if (!r || v === U_(r.v)) { back(); return; }
          if (!v) { svToast("NOM VIDE REFUSÉ.", 3000, inp); back(); return; }
          if (INS.sec.some(x => x.id !== id && U_(x.v) === v)) { svToast("ACTIVITÉ SECONDAIRE « " + v + " » EXISTE DÉJÀ.", 3500, inp); back(); return; }
          /* activité jumelle d'une activité primaire : renommées ensemble (si le nom est libre côté primaire) */
          const old = r.v, tw = INS.prim.find(p => p.tw === id && U_(p.v) === U_(old));
          if (tw && INS.prim.some(p => p !== tw && U_(p.v) === v)) { svToast("ACTIVITÉ PRIMAIRE « " + v + " » EXISTE DÉJÀ.", 3500, inp); back(); return; }
          r.v = v; if (tw) tw.v = v;
          insSave(); histLog("SAISIE", "ACTIVITÉ SECONDAIRE RENOMMÉE", old + " → " + v + (tw ? " (AVEC L'ACTIVITÉ PRIMAIRE)" : ""));
          done();
          return;
        }
        /* lot ou niveau de lot (« / ») : toutes les tâches dessous suivent */
        const segs = dlyLotPath(inp.dataset.path), lvl = segs.length;
        if (!v || v.includes("/")) { svToast(!v ? "NOM VIDE REFUSÉ." : "« / » SÉPARE LES GROUPES : NOM REFUSÉ.", 3500, inp); back(); return; }
        if (v === segs[lvl - 1] || (LVL_AUTO.test(segs[lvl - 1] || "") && v === U_(lotLab(segs).name))) { back(); return; }
        const hit = INS.lot.filter(x => !x.t && (() => { const p = dlyLotPath(x.v); return p.length >= lvl && segs.every((sg, i) => U_(p[i]) === U_(sg)); })());
        const nv = x => { const p = dlyLotPath(x.v); p[lvl - 1] = v; return p.join(" / "); };
        const ids = new Set(hit.map(x => x.id));
        const clash = hit.find(x => INS.lot.some(y => !ids.has(y.id) && U_(y.v) === U_(nv(x))));
        if (clash) { svToast("LOT « " + nv(clash) + " » EXISTE DÉJÀ.", 3500, inp); back(); return; }
        hit.forEach(x => { x.v = nv(x); });
        /* l'état replié suit le nouveau nom */
        { const f = dlyFoldAll(), o = dlyFoldK(inp.dataset.path); if (f[o]) { delete f[o]; f[dlyFoldK(segs.slice(0, lvl - 1).concat(v).join(" / "))] = 1; try { localStorage.setItem("svi_lotfold_v1", JSON.stringify(f)); } catch (e) {} } }
        insSave(); histLog("SAISIE", "LOT RENOMMÉ", inp.dataset.path + " → " + v + " (" + hit.length + " LOT(S))");
        if (opts.quiet) {
          const oldP = inp.dataset.path, newP = segs.slice(0, lvl - 1).concat(v).join(" / "), O = U_(oldP);
          shell.querySelectorAll("[data-path]").forEach(el => { const p = el.dataset.path, P = U_(p); if (P === O || P.startsWith(O + " / ")) el.dataset.path = newP + p.slice(oldP.length); });
        }
        done();
      },
      /* nouvelle tâche tapée dans le PLANNING : lot et activité secondaire repris s'ils existent, sinon créés (sans liaison) */
      newTask: (lv, sv, anchor) => {
        const Lv = dlyLotPath(U_(sviClean(lv))).map(x => x.trim()).filter(Boolean).join(" / "), Sv = U_(sviClean(sv));
        if (!Lv || !Sv) return;
        let lo = INS.lot.find(x => !x.t && U_(x.v) === Lv), se = INS.sec.find(x => U_(x.v) === Sv);
        const k0 = lo && se ? lo.id + "|" + se.id : "";
        if (k0 && dlyKeys().includes(k0)) { svToast("TÂCHE DÉJÀ DANS LE PLANNING : " + Lv + " › " + Sv + ".", 3500, anchor); setTimeout(() => dlyAddWin(lo.id, se.id), 60); return; }
        if (!lo) { lo = { id: insId(), v: Lv, on: false }; INS.lot.push(lo); }
        if (!se) { se = { id: insId(), v: Sv, on: false }; INS.sec.push(se); }
        const k = lo.id + "|" + se.id;
        INS.dlp = INS.dlp || {}; INS.dlp[k] = [{ id: insId(), deb: "", fin: "" }];
        INS.dord = (INS.dord || []).filter(x => x !== k).concat(k);
        dlyTasksFromPlan(); insSave();
        histLog("DÉLAIS", "TÂCHE AJOUTÉE AU PLANNING (SANS LIAISON)", Lv + " › " + Sv);
        refreshAll();
        setTimeout(() => dlyAddWin(lo.id, se.id), 60);
      },
      /* barre glissée de n jours : FIN seule (bout tiré) ou tâche entière, durée gardée (jours travaillés) */
      dragTo: (k, mode, n, a) => {
        const cal = insCal(), d0 = dlyDeb(k), f0 = dlyFin(k);
        if (!d0 || !f0) return;
        /* v547 (R22) : tâche en morceaux — glisser = tous les morceaux ; bout = FIN du dernier morceau */
        if (dlyList(k).length > 1) {
          const L = dlyDraftKey(k), last = L[L.length - 1];
          if (mode === "end") { let f = sviWNear(cal, sviIsoAdd(f0, n), n > 0 ? 1 : -1); if (f < last.deb) f = last.deb; if (INS.dbut && f > INS.dbut) { svToast("FIN REFUSÉE : APRÈS LA DATE BUTOIR DU " + dFr(INS.dbut) + ".", 3500, a); renderTabK(); return; } last.fin = f; delete last.fmd; }
          else { const pf = dlyPredFin(k); let d = sviWNear(cal, sviIsoAdd(d0, n), n > 0 ? 1 : -1); if (pf && d < pf) d = sviWNear(cal, pf, 1); dlyShiftList(L, d); }
          dlyCommitDrafts(); dlyRespect(false); insSave(); histLog("DÉLAIS", "TÂCHE EN MORCEAUX", dlyName(k) + " : " + dFr(dlyDeb(k)) + " → " + dFr(dlyFin(k))); renderTabK(); insRenderChain(); return;
        }
        if (mode === "end") { let f = sviWNear(cal, sviIsoAdd(f0, n), n > 0 ? 1 : -1); if (f < d0) f = d0; dlyApply(k, { deb: d0, fin: f }, { anchor: a, fromDur: true }); return; }
        const dur = sviWDur(cal, d0, f0) || 1, pf = dlyPredFin(k);
        let d = sviWNear(cal, sviIsoAdd(d0, n), n > 0 ? 1 : -1);
        /* glissée trop tôt : la barre revient à la première date permise par ses liaisons */
        if (pf && d < pf) d = sviWNear(cal, pf, 1);
        if (d === d0) { renderTabK(); insRenderChain(); return; }
        dlyApply(k, { deb: d, fin: sviWFin(cal, d, dur) }, { anchor: a });
      },
      pickPreds: k => dlyPickPreds(k), addWin: () => dlyAddWin(),
      scale: v => { try { localStorage.setItem("svi_dlyg_sc_v1", v); } catch (e) {} keepScroll(() => renderTab()); }, scaleOf: () => dlyScale(),
      go: k => { const [lo, se] = k.split("|"); LK.lot = lo; LK.sec = se; LK.prim = null; refreshAll(); },
      render: () => { renderTabK(); insRenderChain(); } } : null;
    /* budget ouvert, pour PARAMÉTRAGE › CALENDRIER et DATES DU BUDGET (15/10/2026) */
