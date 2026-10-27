    /* ===== PLANNING (FORMAT 94) : prédécesseurs (plusieurs, communs à toutes les périodes de la tâche) ;
       une tâche commence au plus tôt le jour de la fin de tous ses prédécesseurs ===== */
    const dlyName = key => { const [lo, se] = String(key).split("|"); return lkName("lot", lo) + " › " + lkName("sec", se); };
    /* liaisons typées : { k, t: FD | DD, o } (cahier, Planning budgétaire, Liaisons) */
    /* v617 (remarque 86) : FIN → DÉBUT, le décalage compte depuis la demi-journée qui suit la fin — les anciens décalages n ≥ 1
       (comptés depuis le jour de fin) deviennent n − 1, une seule fois par budget */
    const dlyLinks = key => { return ((INS.dpred || {})[key] || []).map(x => typeof x === "string" ? { k: x, t: "FD", o: 0 } : x); };
    const dlyPreds = key => dlyLinks(key).map(x => x.k);
    const dlySuccs = key => Object.keys(INS.dpred || {}).filter(k => dlyLinks(k).some(x => x.k === key));
    const dlyLinkTxt = x => (x.t === "DD" ? "DD" : "FD") + "+" + (x.o || 0);
    /* PRÉDÉCESSEURS affichés : « LOT › ACTIVITÉ SECONDAIRE », avec le type et le décalage s'ils ne sont pas FIN → DÉBUT + 0 */
    const dlyPredTxt = k => dlyLinks(k).map(x => dlyName(x.k) + (x.t === "DD" ? (x.o ? " (DÉBUT → DÉBUT + " + x.o + " J)" : " (DÉBUT → DÉBUT)") : !(x.o > 0) ? "" : " (FIN → DÉBUT + " + x.o + " J)")).join(" ; ");
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
        /* v617 (remarque 86) : FIN → DÉBUT, décalage 0 = la demi-journée qui suit la fin du prédécesseur (le jour même s'il finit à midi,
           sinon le lendemain) ; n = n jours travaillés de plus ; jamais négatif */
        const f0 = finOf(x.k); if (!f0) return "";
        const lp = dlyList(x.k).find(p => p.fin === f0), base = lp && lp.fmd === lp.fin ? f0 : sviWAdd(cal, f0, 1);
        return sviWAdd(cal, base, Math.max(0, x.o || 0));
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
