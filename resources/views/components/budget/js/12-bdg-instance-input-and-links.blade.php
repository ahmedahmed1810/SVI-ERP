@verbatim
    /* =========================================================
       BUDGET EN INSTANCE : MODE SAISIE / MODE LIAISONS
       - SAISIE : les 8 tableaux (désignations, lots, activités primaires,
         secondaires, charges, produits, qualité, délais) ; lignes non liées
         hachurées, à supprimer avant FIGER ;
       - LIAISONS : chaîne désignation › lot › primaire › secondaire › produits
         (+ charges facultatives), validée par ✓ ; liste des liaisons, délier.
       ========================================================= */
    /* page unique : la saisie et les liaisons se font sur la même page */
    const INS_MODE = () => "saisie";
    /* lignes utilisées par au moins une liaison validée */
    const insUsed = () => {
      const u = { des: new Set(), lot: new Set(), prim: new Set(), sec: new Set(), chg: new Set(), prd: new Set() };
      (INS.links || []).forEach(l => {
        u.des.add(l.des); u.lot.add(l.lot); u.prim.add(l.prim); u.sec.add(l.sec);
        (l.prd || []).forEach(x => u.prd.add(x.id));
        (l.chg || []).forEach(x => u.chg.add(x.id));
      });
      /* un titre est « utilisé » si une de ses lignes l'est */
      insNorm();
      const stack = [];
      INS.des.forEach(r => {
        while (stack.length && dOf(stack[stack.length - 1]) >= dOf(r)) stack.pop();
        if (r.t) stack.push(r);
        else if (u.des.has(r.id)) stack.forEach(t => u.des.add(t.id));
      });
      return u;
    };
    const INS_LINKED_KINDS = ["des", "lot", "prim", "sec", "chg", "prd"];
    const insUnlinked = () => {
      const u = insUsed(), out = {};
      /* activité secondaire jumelle créée automatiquement : pas comptée « non liée » (elle suit son activité primaire) */
      INS_LINKED_KINDS.forEach(k => { out[k] = INS[k].filter(r => !u[k].has(r.id) && !(k === "sec" && r.tw)); });
      return out;
    };
    /* FIGER (FORMAT 96) : impossible tant qu'il reste une cause ; chaque cause = libellé, nombre, onglet où aller */
    const insFigeBlocks = () => {
      const out = [];
      if (!INS || !INS_EDIT) return out;
      const nU = insUnlCount();
      if (nU) out.push({ lab: "LIGNES NON LIÉES", n: nU, go: "unl" });
      const nI = (INS.inc || []).length;
      if (nI) out.push({ lab: "LIGNES DANS IMPORT NON CRÉÉ", n: nI, go: "inc" });
      const linked = new Set((INS.links || []).map(l => l.lot + "|" + l.sec));
      const keys = Object.keys(INS.dlp || {}).filter(k => (INS.dlp[k] || []).length);
      const nl = keys.filter(k => !linked.has(k));
      if (nl.length) out.push({ lab: "TÂCHES AVEC DÉLAIS NON LIÉES", n: nl.length, go: "dly", list: nl });
      const np = keys.reduce((t, k) => t + INS.dlp[k].filter(p => !p.deb || !p.fin).length, 0);
      if (np) out.push({ lab: "TÂCHES SANS DÉBUT OU SANS FIN", n: np, go: "dly" });
      const nD = INS.des.filter(r => !r.t && !String(r.u || "").trim()).length;
      if (nD) out.push({ lab: "DÉSIGNATIONS CLIENT SANS UPB", n: nD, go: "des" });
      ["prd", "chg"].forEach(k => { const n = INS[k].filter(r => !r.t && insRowErr(k, r)).length; if (n) out.push({ lab: "LIGNES EN ERREUR — " + (k === "prd" ? "DÉTAIL PRODUITS" : "DÉTAIL CHARGES"), n, go: k }); });
      try { if (lkPending()) out.push({ lab: "MODIFICATION EN ATTENTE DE ✓ VALIDER", n: 1, go: "" }); } catch (e) {}
      return out;
    };
    const insFigeWhy = () => {
      const B = insFigeBlocks();
      document.getElementById("svConf")?.remove();
      const d = document.createElement("div");
      d.id = "svConf";
      d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true"><button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
        <div class="svc-t">FIGER IMPOSSIBLE</div>
        <div class="svc-x">${B.map((b, i) => `<button type="button" class="fz-why" data-i="${i}"><span>${esc(b.lab)}${b.list ? " : " + esc(b.list.slice(0, 3).map(dlyName).join(" ; ")) + (b.list.length > 3 ? "…" : "") : ""}</span>${svCnt(b.n)}</button>`).join("")}</div>
        <div class="svc-f"><button type="button" class="svc-b svc-ok svc-neutral" data-x>FERMER</button></div></div>`;
      document.body.appendChild(d);
      d.addEventListener("click", e => {
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
        const it = e.target.closest(".fz-why");
        if (!it) return;
        const b = B[+it.dataset.i];
        d.remove();
        if (!b.go) return;
        if (b.go === "des") { shell.querySelector(".bdg-d-client-scroll")?.scrollIntoView({ block: "start", behavior: "smooth" }); return; }
        if (b.go === "dly") { LK.lot = LK.sec = LK.prim = null; }
        const t = shell.querySelector(`#bdgTabs .bdg-d-tab[data-tab="${b.go}"]`);
        if (t) { t.click(); t.scrollIntoView({ block: "start", behavior: "smooth" }); }
      });
    };
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
    /* ===== PLANNING (FORMAT 94) : prédécesseurs (plusieurs, communs à toutes les périodes de la tâche) ;
       une tâche commence au plus tôt le jour de la fin de tous ses prédécesseurs ===== */
    const dlyName = key => { const [lo, se] = String(key).split("|"); return lkName("lot", lo) + " › " + lkName("sec", se); };
    /* liaisons typées : { k, t: FD | DD, o } (cahier, Planning budgétaire, Liaisons) */
    const dlyLinks = key => ((INS.dpred || {})[key] || []).map(x => typeof x === "string" ? { k: x, t: "FD", o: 0 } : x);
    const dlyPreds = key => dlyLinks(key).map(x => x.k);
    const dlySuccs = key => Object.keys(INS.dpred || {}).filter(k => dlyLinks(k).some(x => x.k === key));
    const dlyLinkTxt = x => (x.t === "DD" ? "DD" : "FD") + "+" + (x.o || 0);
    /* PRÉDÉCESSEURS affichés : « LOT › ACTIVITÉ SECONDAIRE », avec le type et le décalage s'ils ne sont pas FIN → DÉBUT + 0 */
    const dlyPredTxt = k => dlyLinks(k).map(x => dlyName(x.k) + (x.t === "DD" || x.o ? " (" + (x.t === "DD" ? "DÉBUT → DÉBUT" : "FIN → DÉBUT") + (x.o ? " + " + x.o + " J" : "") + ")" : "")).join(" ; ");
    const dlyList = key => (LK.dlpDraft && LK.dlpDraft[key]) || (INS.dlp || {})[key] || [];
    const dlyFin = key => dlyList(key).map(p => p.fin).filter(Boolean).sort().pop() || "";
    const dlyDeb = key => dlyList(key).map(p => p.deb).filter(Boolean).sort()[0] || "";
    /* date de début la plus tôt permise par les liaisons (la plus tardive des exigences) :
       FIN → DÉBUT : jour travaillé suivant la fin du prédécesseur + décalage ; DÉBUT → DÉBUT : début du prédécesseur + décalage */
    const dlyNeedOf = (key, finOf, debOf) => {
      const cal = insCal();
      return dlyLinks(key).map(x => {
        if (x.t === "DD") { const d0 = debOf(x.k); return d0 ? sviWAdd(cal, sviWNear(cal, d0, 1), Math.max(0, x.o || 0)) : ""; }
        const f0 = finOf(x.k); return f0 ? sviWAdd(cal, f0, 1 + Math.max(0, x.o || 0)) : "";
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
      const dur = p.fin ? sviWDur(cal, p.deb, p.fin) || 1 : 0;
      p.deb = sviWNear(cal, deb, 1);
      if (dur) p.fin = sviWFin(cal, p.deb, dur);
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
          const np = { id: p0.id || insId(), deb, fin: fin || "" };
          INS.dlp = INS.dlp || {}; INS.dlp[k] = [np];
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
    /* tâche primaire choisie (sans activité secondaire) : récapitulatif des dates de ses tâches secondaires */
    const insDlyRecap = () => {
      if (!(LK.des && LK.lot && LK.prim && !LK.sec)) return null;
      const secs = [...new Set((INS.links || []).filter(l => l.des === LK.des && l.lot === LK.lot && l.prim === LK.prim).map(l => l.sec))];
      if (!secs.length) return null;
      const rows = [];
      secs.forEach(se => {
        const ps = [...insDlyList(LK.lot + "|" + se)].sort((a, b) => String(a.deb || "9").localeCompare(String(b.deb || "9")));
        const sv = (INS.sec.find(x => x.id === se) || {}).v || "";
        if (!ps.length) rows.push({ sec: sv, deb: "", fin: "", dur: "" });
        ps.forEach(p => rows.push({ sec: sv, deb: p.deb || "", fin: p.fin || "", dur: p.deb && p.fin ? dDur(p.deb, p.fin) : "" }));
      });
      return rows;
    };
    /* ===== PLANNING (v401) : MARGE, JALON, LOTS EN ARBORESCENCE (« / »), GANTT ===== */
    const dlyLotPath = name => String(name || "").split("/").map(x => x.trim()).filter(Boolean);
    /* une couleur par lot (FORMAT 91), partagée par toutes ses tâches */
    /* pas de rouge : le rouge est réservé aux tâches critiques */
    const DLY_PAL = ["#6fa8dc", "#93c47d", "#f6b26b", "#8e9fd6", "#76c5c0", "#c9a0dc", "#e8c468", "#9fb7c9", "#a8d5a2", "#8db3e2", "#d7b98e", "#7fc3e0"];
    const dlyLotColor = lotId => { const i = INS.lot.filter(x => !x.t).findIndex(x => x.id === lotId); return DLY_PAL[Math.max(0, i) % DLY_PAL.length]; };
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
    const dlyFoldToggle = p => { const f = dlyFoldAll(), k = dlyFoldK(p); if (f[k]) delete f[k]; else f[k] = 1; try { localStorage.setItem("svi_lotfold_v1", JSON.stringify(f)); } catch (e) {} };
    /* ordre des lignes du PLANNING : gardé tel quel (glissement d'une barre compris) ; classé par DÉBUT à l'import,
       après GÉNÉRER LE PLANNING et par le bouton CLASSER PAR DÉBUT */
    const dlyByDeb = keys => [...keys].sort((a, b) => String(dlyDeb(a) || "9").localeCompare(String(dlyDeb(b) || "9")) || natCmp(dlyName(a), dlyName(b)));
    const dlyOrder = keys => {
      const K = new Set(keys);
      const cur = (INS.dord || []).filter(k => K.has(k));
      const miss = dlyByDeb(keys.filter(k => !cur.includes(k)));
      INS.dord = cur.concat(miss);
      return new Map(INS.dord.map((k, i) => [k, i]));
    };
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
        return { key: k, lo, lot: lkName("lot", lo), sec: lkName("sec", se), pred: dlyPredTxt(k), deb: d0, fin: f0, dur: d0 && f0 ? dDur(d0, f0) : "",
          marge: M[k] === undefined ? "" : M[k], jal: J[k] ? "★" : "" }; });
      /* ordre libre des lignes (INS.dord) ; une tâche nouvelle se place à la fin */
      const O = dlyOrder(keys);
      P.sort((a, b) => O.get(a.key) - O.get(b.key));
      const flat = cfApply("dlyp", DLY_COLS_P, P);
      const root = { kids: new Map(), tasks: [] };
      flat.forEach(t => {
        let n = root, path = "";
        dlyLotPath(t.lot).forEach(seg => { path = path ? path + " / " + seg : seg; if (!n.kids.has(seg)) n.kids.set(seg, { name: seg, path, kids: new Map(), tasks: [] }); n = n.kids.get(seg); });
        n.tasks.push(t);
      });
      const gather = n => (n.all = [...n.tasks, ...[...n.kids.values()].flatMap(gather)]);
      gather(root);
      const out = root.tasks.map(t => ({ ...t, lvl: 0 }));
      const walk = (n, lvl) => [...n.kids.values()].forEach(g => {
        const ds = g.all.map(x => x.deb).filter(Boolean).sort(), fs = g.all.map(x => x.fin).filter(Boolean).sort();
        const d0 = ds[0] || "", f0 = fs[fs.length - 1] || "", fold = dlyIsFolded(g.path);
        out.push({ grp: true, lvl, name: g.name, path: g.path, fold, deb: d0, fin: f0, dur: d0 && f0 ? dDur(d0, f0) : "", all: g.all });
        if (fold) return;
        g.tasks.forEach(t => out.push({ ...t, lvl: lvl + 1 }));
        walk(g, lvl + 1);
      });
      walk(root, 0);
      return { rows: out, flat };
    };
    /* ajout d'une liaison (geste sur le Gantt) : pred → succ, FIN → DÉBUT ou DÉBUT → DÉBUT, décalage 0 */
    const dlyAddLink = (pred, succ, t, anchor) => {
      if (!pred || !succ || pred === succ) return;
      if (dlyReach(pred, succ)) { svToast("LIAISON IMPOSSIBLE : ELLE FERAIT UNE BOUCLE.", 3500, anchor); return; }
      INS.dpred = INS.dpred || {};
      const L = INS.dpred[succ] = (INS.dpred[succ] || []).map(x => typeof x === "string" ? { k: x, t: "FD", o: 0 } : x);
      if (L.some(x => x.k === pred)) { dlyLinkWin(pred, succ); return; }
      L.push({ k: pred, t, o: 0 });
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
      const glued = dlyGlued(task), back = p ? { ...p } : null;
      if (p) Object.assign(p, q); else if (q.deb || q.fin) { L.splice(0, L.length, q); p = q; }
      const undo = () => { if (back) Object.assign(p, back); else L.splice(0, L.length); };
      const late = dlySuccs(task).filter(S => { const n = dlyPredFin(S), d0 = dlyDeb(S); return n && d0 && d0 < n; });
      if (late.length) {
        const fromDur = opts.fromDur || (durOld && q.deb && q.fin && sviWDur(cal, q.deb, q.fin) !== durOld);
        const maxFin = dlySuccs(task).map(S => { const l = dlyLinks(S).find(x => x.k === task), d0 = dlyDeb(S);
          return l && l.t !== "DD" && d0 ? sviWAdd(cal, d0, -(1 + Math.max(0, l.o || 0))) : ""; }).filter(Boolean).sort()[0] || "";
        const canCut = fromDur && maxFin && q.deb && maxFin >= q.deb;
        svChoose({ title: "TÂCHES SUIVANTES", html: `<div class="svc-sub">LA FIN DU ${esc(dFr(q.fin))} NE RESPECTE PLUS LA LIAISON AVEC :</div><ul class="svc-list">${late.map(k => `<li>${esc(dlyName(k))} — ${esc(dFr(dlyDeb(k)))}</li>`).join("")}</ul>`,
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
    const DLY_DW = 22, DLY_HH = 110;
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
      /* hauteur du tableau changée ensuite (police, repli, largeur) : le Gantt se redessine */
      if (window.ResizeObserver && !host.__ro2) {
        let h0 = tbl.getBoundingClientRect().height;
        host.__ro2 = new ResizeObserver(() => {
          if (!host.isConnected) { host.__ro2.disconnect(); return; }
          const h = tbl.getBoundingClientRect().height;
          if (!h || Math.abs(h - h0) < 1) return;
          h0 = h;
          cancelAnimationFrame(host.__raf);
          host.__raf = requestAnimationFrame(() => { host.__drawn = false; dlyGanttDraw(); });
        });
        host.__ro2.observe(tbl);
      }
      const cal = insCal(), tr0 = tbl.getBoundingClientRect();
      const thH = tbl.querySelector("thead").getBoundingClientRect().height;
      const trs = [...tbl.querySelectorAll("tbody tr")];
      const geo = trs.map(tr => { const r = tr.getBoundingClientRect(); return { y: r.top - tr0.top - thH, h: r.height }; });
      const bodyH = Math.max(geo.length ? geo[geo.length - 1].y + geo[geo.length - 1].h : 0, 40);
      const dates = [];
      R.forEach(x => { if (x.deb) dates.push(x.deb); if (x.fin) dates.push(x.fin); });
      if (INS.dbut) dates.push(INS.dbut); if (INS.dobj) dates.push(INS.dobj);
      dates.sort();
      const today = sviIsoOf(new Date());
      const d0 = sviIsoAdd(dates[0] || today, -3), d1 = sviIsoAdd(dates[dates.length - 1] || sviIsoAdd(today, 30), 10);
      const nD = dDiff(d0, d1) + 1, W = nD * DLY_DW;
      const X = iso => dDiff(d0, iso) * DLY_DW;
      let head = "", bg = "";
      for (let i = 0; i < nD; i++) {
        const di = sviIsoAdd(d0, i), dd = Number(di.slice(8, 10));
        if (dd === 1 || i === 0) head += `<span class="gh-m" style="left:${i * DLY_DW}px">${SVI_MOIS[Number(di.slice(5, 7)) - 1]} ${di.slice(0, 4)}</span>`;
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
        const y = g.y + Math.max(2, (g.h - 11) / 2);
        if (x.grp) {
          const segs = [];
          x.all.filter(t => t.deb && t.fin).map(t => [t.deb, t.fin, t.lo]).sort((a, b) => a[0].localeCompare(b[0])).forEach(([a, b, lo]) => {
            const s = segs[segs.length - 1];
            if (s && a <= sviIsoAdd(s.b, 1)) { if (b > s.b) s.b = b; if (s.lo !== lo) s.lo = ""; }
            else segs.push({ a, b, lo });
          });
          /* FORMAT 93 : signe › / ⌄ devant le nom du lot (ou du niveau) ; un toucher = replier / déplier */
          /* signe à gauche de la barre du lot, nom à droite ; les deux se touchent pour replier / déplier */
          const gname = (l, r) => `<span class="gb-n gb-out gb-fold gb-fsg" data-path="${esc(x.path)}" style="left:${Math.max(0, l - 17)}px;top:${y - 2}px">${x.fold ? "›" : "⌄"}</span>`
            + `<span class="gb-n gb-out gb-grp gb-fold" data-path="${esc(x.path)}" style="left:${r}px;top:${y - 2}px">${esc(x.name)}</span>`;
          if (!segs.length) { bars += gname(17, 20); return; }
          const a0 = segs[0].a, b0 = segs[segs.length - 1].b;
          /* couleur d'un lot (FORMAT 91, 93) : celle de son lot, ou de son premier lot pour un niveau qui en regroupe plusieurs */
          const gcol = dlyLotColor((x.all.find(t => t.lo) || {}).lo);
          if (x.fold) {
            /* lot replié (FORMAT 92) : parties travaillées dans la couleur du lot, creux en blanc, trait fin en pointillé */
            bars += `<div class="gdot" style="left:${X(a0)}px;width:${X(b0) - X(a0) + DLY_DW}px;top:${y + 5}px"></div>`;
            segs.forEach(s => { bars += `<div class="gseg" style="left:${X(s.a)}px;width:${X(s.b) - X(s.a) + DLY_DW - 1}px;top:${y}px;background:${s.lo ? dlyLotColor(s.lo) : gcol}"></div>`; });
            bars += gname(X(a0), X(b0) + DLY_DW + 5);
          } else bars += `<div class="gsum" style="left:${X(a0)}px;width:${X(b0) - X(a0) + DLY_DW - 1}px;top:${y + 2}px;--c:${gcol}"></div>`
            + gname(X(a0), X(b0) + DLY_DW + 5);
          return;
        }
        if (!x.deb || !x.fin) return;
        const left = X(x.deb), w = X(x.fin) - left + DLY_DW - 1, col = dlyLotColor(x.lo);
        const crit = x.marge === 0;
        const nm = esc(x.sec);
        /* FORMAT 91 : barre fine et arrondie, nom juste à droite */
        pos[x.key] = { l: left, r: left + w, y: y + 5.5 };
        /* FORMAT 91 : nom dans la barre quand il y tient en entier, sinon juste à droite */
        const inside = dlyTxtW(x.sec) + 12 <= w;
        bars += `<div class="gb${crit ? " crit" : ""}${inside ? " gb-tin" : ""}" data-key="${esc(x.key)}" style="left:${left}px;width:${w}px;top:${y}px;--c:${col}">`
          + (inside ? `<span class="gb-ti">${nm}</span>` : "")
          + `<span class="gb-s"></span><span class="gb-e"></span></div>`
          + (inside ? (x.jal ? `<span class="gb-n gb-out" style="left:${left + w + 5}px;top:${y - 2}px"><span class="gjal">★</span></span>` : "")
            : `<span class="gb-n gb-out" style="left:${left + w + 5}px;top:${y - 2}px">${nm}${x.jal ? ' <span class="gjal">★</span>' : ""}</span>`);
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
          lk += `<path class="gl" d="${dpath}" marker-end="url(#gArr)"/><path class="gl-hit" data-p="${esc(l.k)}" data-s="${esc(x.key)}" d="${dpath}"/>`;
        });
      });
      /* histogramme MAIN D'ŒUVRE (J-H / jour), même échelle de jours ; barre de plafond tirée au doigt, par paliers entiers */
      let hist = "";
      const LD = dlyLoad(dlyCurDates()), vals = Object.values(LD), mx = vals.length ? Math.max(...vals) : 0;
      if (mx > 0) {
        const P = Number(INS.plaf) || Math.ceil(mx), top = Math.max(mx, P) + 1, sc = (DLY_HH - 16) / top;
        let hb = "";
        Object.keys(LD).forEach(di => { if (di < d0 || di > d1) return; const v = LD[di];
          hb += `<div class="ghb${v > P + 1e-9 ? " over" : ""}" style="left:${X(di) + 3}px;width:${DLY_DW - 6}px;height:${Math.max(1, v * sc)}px" title="${Math.round(v * 100) / 100} J-H"></div>`; });
        const late = INS.plaf && INS.dbut && dlyEnd(dlyLevel(P)) > INS.dbut;
        hist = `<div class="ghist" style="width:${W}px;height:${DLY_HH}px" data-sc="${sc}">${bg}${hb}
          <div class="gplaf" style="top:${DLY_HH - P * sc}px"><span class="gplaf-v">PLAFOND ${P}</span>${late ? `<span class="gplaf-w">${DLY_BUT_MSG}</span>` : ""}</div></div>`;
      }
      host.innerHTML = `<div class="gh" style="width:${W}px;height:${thH}px">${head}</div>
        <div class="gbody" style="width:${W}px;height:${bodyH}px">${bg}${vline(today, "gv-today", "")}${vline(INS.dobj, "gv-obj", "OBJECTIF")}${vline(INS.dbut, "gv-but", "BUTOIR")}
          <svg class="glinks" width="${W}" height="${bodyH}"><defs><marker id="gArr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="#475467"/></marker></defs>${lk}</svg>
          ${bars}<svg class="gtmp" width="${W}" height="${bodyH}"></svg></div>${hist}`;
      host.__X = X; host.__d0 = d0;
      host.parentElement.querySelectorAll("input.dlyp-cb[data-part]").forEach(c => { c.indeterminate = true; });
      /* défilement horizontal du Gantt gardé d'un dessin à l'autre */
      if (shell.__dlyGx !== undefined) host.scrollLeft = shell.__dlyGx;
      host.addEventListener("scroll", () => { shell.__dlyGx = host.scrollLeft; }, { passive: true });
      dlyStick(host.closest(".bdg-d-scroll, .lk-scroll"));
    };
    /* en-têtes du tableau et du Gantt fixés en haut quand le bloc défile verticalement */
    const dlyStick = sc => {
      if (!sc) return;
      const run = () => {
        const g = sc.querySelector(".dlyg");
        if (!g) return;
        const off = Math.max(0, sc.scrollTop - g.offsetTop);
        const v = off ? "translateY(" + off + "px)" : "";
        g.querySelectorAll(".dlyg-l thead th, .dlyg-r > .gh").forEach(h => { if (h.style.transform !== v) h.style.transform = v; });
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
    /* journées-homme d'une tâche secondaire : charges de main d'œuvre de ses liaisons */
    const dlyJH = k => {
      let t = 0;
      const seen = new Set();
      (INS.links || []).forEach(l => {
        if (l.lot + "|" + l.sec !== k) return;
        (l.chg || []).forEach(e => { if (seen.has(e.id)) return; seen.add(e.id); const r = INS.chg.find(x => x.id === e.id); if (r && dlyIsLab(r)) t += dlyJHof(r); });
      });
      return Math.round(t * 100) / 100;
    };
    /* ordre des tâches qui respecte les liaisons (prédécesseurs d'abord), puis le DÉBUT, puis l'intitulé */
    const dlyTopo = (keys, debOf) => {
      const S = new Set(keys), done = new Set(), out = [];
      const rest = [...keys].sort((a, b) => String(debOf(a) || "9").localeCompare(String(debOf(b) || "9")) || natCmp(dlyName(a), dlyName(b)));
      for (let guard = 0; rest.length && guard < 100000; guard++) {
        const i = rest.findIndex(k => dlyPreds(k).every(p => !S.has(p) || done.has(p)));
        const k = rest.splice(i < 0 ? 0 : i, 1)[0];
        done.add(k); out.push(k);
      }
      return out;
    };
    /* date exigée par les liaisons, d'après des dates calculées (D[k] = { deb, fin }) */
    const dlyNeedIn = (k, D) => dlyNeedOf(k, x => (D[x] || {}).fin || "", x => (D[x] || {}).deb || "");
    /* GÉNÉRER : durée = ⌈ J-H ÷ ouvriers ⌉ ; une tâche de main d'œuvre prend toute l'équipe (pas deux à la fois) ;
       tâche sans main d'œuvre : sa durée actuelle (1 J si elle n'a pas de dates) ; liaisons et calendrier respectés */
    const dlyGenerate = (start, N) => {
      const cal = insCal(), keys = dlyKeys(), D = {}, busy = new Set();
      dlyTopo(keys, dlyDeb).forEach(k => {
        const jh = dlyJH(k), d0 = dlyDeb(k), f0 = dlyFin(k);
        const dur = jh > 0 ? Math.max(1, Math.ceil(jh / N)) : (d0 && f0 ? sviWDur(cal, d0, f0) || 1 : 1);
        let d = sviWNear(cal, start, 1);
        const need = dlyNeedIn(k, D);
        if (need && need > d) d = sviWNear(cal, need, 1);
        if (jh > 0) {
          for (let g = 0; g < 3000; g++) {
            let ok = true;
            for (let i = 0, x = d; i < dur; i++, x = sviWAdd(cal, x, 1)) if (busy.has(x)) { ok = false; break; }
            if (ok) break;
            d = sviWAdd(cal, d, 1);
          }
          for (let i = 0, x = d; i < dur; i++, x = sviWAdd(cal, x, 1)) busy.add(x);
        }
        D[k] = { deb: d, fin: sviWFin(cal, d, dur) };
      });
      return D;
    };
    /* charge de main d'œuvre par jour (J-H / jour) : J-H de chaque tâche répartis sur ses jours travaillés */
    const dlyLoad = (D) => {
      const cal = insCal(), L = {};
      Object.keys(D).forEach(k => {
        const jh = dlyJH(k), p = D[k];
        if (!(jh > 0) || !p.deb || !p.fin) return;
        const n = sviWDur(cal, p.deb, p.fin) || 1, r = jh / n;
        for (let i = 0, x = p.deb; i < n; i++, x = sviWAdd(cal, x, 1)) L[x] = (L[x] || 0) + r;
      });
      return L;
    };
    const dlyCurDates = () => { const D = {}; dlyKeys().forEach(k => { const d = dlyDeb(k), f = dlyFin(k); if (d && f) D[k] = { deb: d, fin: f }; }); return D; };
    /* NIVELLEMENT sous un plafond entier P : il ne réduit jamais le travail ; une tâche n'est jamais avancée ;
       elle recule tant que la charge du jour dépasserait P ; une tâche qui demande plus que P ouvriers s'allonge (⌈ J-H ÷ P ⌉) ;
       liaisons, décalages et calendrier respectés ; les jours vides sont gardés */
    const dlyLevel = P => {
      const cal = insCal(), cur = dlyCurDates(), D = {}, L = {};
      dlyTopo(Object.keys(cur), k => cur[k].deb).forEach(k => {
        const jh = dlyJH(k);
        let dur = sviWDur(cal, cur[k].deb, cur[k].fin) || 1;
        let d = cur[k].deb;
        const need = dlyNeedIn(k, D);
        if (need && need > d) d = sviWNear(cal, need, 1);
        if (jh > 0) {
          if (jh / dur > P) dur = Math.max(1, Math.ceil(jh / P));
          const r = jh / dur;
          for (let g = 0; g < 3000; g++) {
            let ok = true;
            for (let i = 0, x = d; i < dur; i++, x = sviWAdd(cal, x, 1)) if ((L[x] || 0) + r > P + 1e-9) { ok = false; break; }
            if (ok) break;
            d = sviWAdd(cal, d, 1);
          }
          for (let i = 0, x = d; i < dur; i++, x = sviWAdd(cal, x, 1)) L[x] = (L[x] || 0) + r;
        }
        D[k] = { deb: d, fin: sviWFin(cal, d, dur) };
      });
      return D;
    };
    const dlyEnd = D => Object.values(D).map(x => x.fin).filter(Boolean).sort().pop() || "";
    /* écrit des dates calculées dans le brouillon (à valider) */
    const dlyWrite = (D, all) => {
      if (all) dlyKeys().forEach(k => { if (!D[k]) dlyDraftKey(k).splice(0); });
      Object.keys(D).forEach(k => { const L = dlyDraftKey(k); if (L[0]) { L.splice(1); L[0].deb = D[k].deb; L[0].fin = D[k].fin; } else L.push({ id: insId(), deb: D[k].deb, fin: D[k].fin }); });
    };
    const DLY_BUT_MSG = "AVEC CE NOMBRE VOUS RISQUEZ DE DÉPASSER LA DATE BUTOIR";
    /* fenêtre GÉNÉRER LE PLANNING (FORMAT 97) : date de début, nombre d'ouvriers ; le planning existant est remplacé */
    const dlyGenWin = () => {
      const keys = dlyKeys();
      if (!keys.length) { svToast("AUCUNE TÂCHE AU PLANNING.", 3000); return; }
      const d0 = INS.gdeb || keys.map(dlyDeb).filter(Boolean).sort()[0] || sviIsoOf(new Date());
      const d = document.createElement("div");
      d.id = "svConf";
      d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true">
        <button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
        <div class="svc-t">GÉNÉRER LE PLANNING</div>
        <div class="bdt-row"><span>DATE DE DÉBUT DU PROJET</span><input type="date" class="gen-d" value="${esc(d0)}"></div>
        <div class="bdt-row"><span>NOMBRE D'OUVRIERS</span><input class="gen-n" inputmode="numeric" value="${esc(String(INS.ouv || 5))}"></div>
        <div class="svc-sub svc-warn">LE PLANNING EXISTANT SERA REMPLACÉ.</div>
        <div class="svc-f"><button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok" data-ok>GÉNÉRER</button></div></div>`;
      document.getElementById("svConf")?.remove();
      document.body.appendChild(d);
      d.querySelectorAll('input[type="date"]').forEach(sviDateField);
      d.addEventListener("click", e => {
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
        if (!e.target.closest("[data-ok]")) return;
        const st = d.querySelector(".gen-d").value, nv = String(d.querySelector(".gen-n").value).trim();
        if (!st) { svToast("CHOISIR LA DATE DE DÉBUT.", 3000, d.querySelector(".gen-d")); return; }
        if (!/^\d+$/.test(nv) || Number(nv) < 1) { svToast("NOMBRE D'OUVRIERS : ENTIER ≥ 1.", 3000, d.querySelector(".gen-n")); return; }
        d.remove();
        INS.gdeb = st; INS.ouv = Number(nv);
        const D = dlyGenerate(st, Number(nv));
        dlyWrite(D, true);
        dlySortByDeb();
        insSave();
        histLog("DÉLAIS", "GÉNÉRER LE PLANNING", "DÉBUT " + dFr(st) + " — " + nv + " OUVRIER(S) — FIN " + dFr(dlyEnd(D)));
        renderTab(); insRenderChain();
        if (INS.dbut && dlyEnd(D) > INS.dbut) sviAlert(DLY_BUT_MSG + " (FIN CALCULÉE LE " + dFr(dlyEnd(D)) + ", BUTOIR LE " + dFr(INS.dbut) + ").");
      });
    };
    /* APPLIQUER LE NIVELLEMENT (FORMAT 97) : plafond de la barre (FORMAT 99) */
    const dlyApplyLevel = () => {
      const P = Number(INS.plaf) || 0;
      if (!P) return;
      const D = dlyLevel(P);
      dlyWrite(D, false);
      histLog("DÉLAIS", "NIVELLEMENT", "PLAFOND " + P + " — FIN " + dFr(dlyEnd(D)));
      renderTab(); insRenderChain();
    };
    /* périodes affichées : brouillon en cours (à valider) ou périodes validées */
    const insDlyList = key => (LK.dlpDraft && LK.dlpDraft[key]) || (INS.dlp || {})[key] || [];
    const insDlyHTML = (edit, err) => {
      INS.dlp = INS.dlp || {};
      if (edit) {
        /* saisie : les périodes de la tâche primaire choisie (les ronds du haut disent laquelle) */
        const key = insDlyKey();
        const rc = !key && insDlyRecap();
        if (rc) {
          const rows = cfApply("dlyr", DLY_COLS_R, rc);
          lastShown.detail = { cols: DLY_COLS_R, rows, kind: "dly" };
          const ds = rc.map(x => x.deb).filter(Boolean).sort(), fs = rc.map(x => x.fin).filter(Boolean).sort();
          const d0 = ds[0] || "", f0 = fs[fs.length - 1] || "";
          return `<div class="dly-recap-t"><button type="button" class="dly-back">‹ PLANNING</button>RÉCAPITULATIF — ${esc(lkName("lot", LK.lot))} › ${esc(lkName("prim", LK.prim))}</div>` + dlyTable(rows, x => ({ sec: esc(x.sec), deb: esc(dFr(x.deb)), fin: esc(dFr(x.fin)), dur: x.dur }), () => "", false, DLY_COLS_R)
            + `<div class="dly-recap-f"><span>DÉBUT : <b>${esc(dFr(d0)) || "—"}</b></span><span>FIN : <b>${esc(dFr(f0)) || "—"}</b></span><span>DURÉE : <b>${d0 && f0 ? dDur(d0, f0) + " J" : "—"}</b></span></div>`;
        }
        if (!key) {
          /* PLANNING (FORMAT 64, 90) : tableau à gauche (lots repliables, tâches), Gantt à droite, lignes alignées */
          /* liaisons non respectées (anciennes dates, import) : corrigées à l'ouverture du planning */
          if (INS_EDIT && dlyRespect(false)) setTimeout(() => insSave(), 0);
          /* un seul ordre : la première fois, le bloc TÂCHES prend l'ordre du PLANNING */
          if (INS_EDIT && !INS.ordSyncV1 && dlyKeys().length) { INS.ordSyncV1 = true; dlyTasksFromPlan(); setTimeout(() => { insSave(); refreshAll(); }, 0); }
          const PR = dlyPlanRows();
          shell.__dlyRows = PR.rows;
          lastShown.detail = { cols: DLY_COLS_P, rows: PR.flat, kind: "dly" };
          requestAnimationFrame(() => dlyGanttDraw());
          const ind = n => `style="padding-left:${6 + n * 20}px"`;
          /* cases à cocher (FORMAT 64) : la case d'un lot coche toutes ses tâches */
          const SEL = shell.__dlySel = shell.__dlySel || new Set();
          const allK = new Set(PR.flat.map(x => x.key));
          [...SEL].forEach(k => { if (!allK.has(k)) SEL.delete(k); });
          const nm = (kind, attr, v) => `<input class="dly-nm" data-kind="${kind}" ${attr} value="${esc(v)}" autocomplete="off" enterkeyhint="next">`;
          const tbl = dlyTable(PR.rows, x => x.grp
            ? { lot: `<span class="dly-lotc" ${ind(x.lvl)}><span class="dly-fold" data-path="${esc(x.path)}"><b>${x.fold ? "›" : "⌄"}</b></span>${nm("grp", `data-path="${esc(x.path)}"`, x.name)}</span>`, sec: "", pred: "",
                deb: `<b>${esc(dFr(x.deb))}</b>`, fin: `<b>${esc(dFr(x.fin))}</b>`, dur: x.dur === "" ? "" : `<b>${x.dur}</b>`, marge: "", jal: "", __td_marge: " dly-calc",
                __cb: `<input type="checkbox" class="dlyp-cb" data-path="${esc(x.path)}"${x.all.length && x.all.every(t => SEL.has(t.key)) ? " checked" : ""}${x.all.some(t => SEL.has(t.key)) && !x.all.every(t => SEL.has(t.key)) ? " data-part=\"1\"" : ""}>` }
            : { lot: "", sec: `<span class="dly-lotc" ${ind(x.lvl)}>${nm("sec", `data-sid="${esc(x.key.split("|")[1])}"`, x.sec)}</span>`, pred: `<span class="dly-pred" data-key="${esc(x.key)}">${esc(x.pred) || "<i>CHOISIR…</i>"}</span>`,
                deb: esc(dFr(x.deb)), fin: esc(dFr(x.fin)), dur: x.dur, marge: x.marge === "" ? "" : x.marge,
                jal: `<span class="dly-jal${x.jal ? " on" : ""}" data-key="${esc(x.key)}">${x.jal ? "★" : "☆"}</span>`, __td_marge: " dly-calc",
                __cb: `<input type="checkbox" class="dlyp-cb" data-key="${esc(x.key)}"${SEL.has(x.key) ? " checked" : ""}>` },
            x => x.grp ? `class="dly-grp" data-path="${esc(x.path)}"` : `class="dly-task${x.marge === 0 ? " dly-crit" : ""}" data-key="${esc(x.key)}"`, true, DLY_COLS_P);
          /* histogramme MAIN D'ŒUVRE sous le Gantt (FORMAT 98, 99) : libellé à gauche, sous le tableau */
          const LD = dlyLoad(dlyCurDates()), mx = Math.max(0, ...Object.values(LD));
          const P = Number(INS.plaf) || 0;
          const canLev = mx > 0 && P > 0 && mx > P + 1e-9;
          /* FORMAT 64 / 33 : pas de ligne d'explication au-dessus du PLANNING */
          return `<div class="dly-tools"><button type="button" class="dly-gen">GÉNÉRER LE PLANNING</button><button type="button" class="dly-sortd">CLASSER PAR DÉBUT</button><button type="button" class="dly-lev"${canLev ? "" : " disabled"}>APPLIQUER LE NIVELLEMENT</button></div>`
            + `<div class="dlyg"><div class="dlyg-l"${(() => { const w = Number(localStorage.getItem("svi_dlyg_w_v1")) || 0; return localStorage.getItem("svi_dlyg_w_v1") !== null ? ` style="width:${w}px;max-width:none"` : ""; })()}>${tbl}${mx > 0 ? `<div class="dlyh-lab" style="height:${DLY_HH}px">MAIN D'ŒUVRE<br>(J-H / JOUR)</div>` : ""}</div><div class="dlyg-sp"><span class="dlyg-hd" title="Largeur du tableau et du Gantt">‖</span></div><div class="dlyg-r" id="dlyGantt"></div></div>`
            + `<div class="dly-add"><button type="button" class="dly-pred-new">+ AJOUTER UNE TÂCHE AU PLANNING</button></div>`;
        }
        const ps = key ? [...insDlyList(key)].sort((a, b) => String(a.deb || "9").localeCompare(String(b.deb || "9"))) : [];
        /* une seule période par tâche : sa ligne, ou une ligne vide SAISIR ICI… */
        const all = ps.slice(0, 1).map(p => ({ task: key, pid: p.id, on: p.on === true, deb: p.deb || "", fin: p.fin || "", dur: p.deb && p.fin ? dDur(p.deb, p.fin) : "" }));
        if (key && !all.length) all.push({ task: key, pid: "", deb: "", fin: "", dur: "", nw: true });
        const rows = cfApply("dlyi", DLY_COLS_I, all);
        lastShown.detail = { cols: DLY_COLS_I, rows: rows.filter(x => !x.nw), kind: "dly" };
        const inp = (x, f) => `<input class="ins-in dlp-in${f === "dur" ? " number" : " center"}" data-task="${x.task}" data-pid="${x.pid}" data-f="${f}" type="text"
            ${f === "dur" ? "" : "readonly"} inputmode="${f === "dur" ? "numeric" : "none"}" placeholder="${x.nw && (f === "deb" || f === "fin") ? "SAISIR ICI…" : f === "dur" ? "" : "JJ/MM/AAAA"}" value="${esc(f === "dur" ? x.dur : dFr(x[f]))}">`;
        const pf = dlyPredFin(key);
        return `<div class="dly-recap-t"><button type="button" class="dly-back">‹ PLANNING</button>${esc(dlyName(key))} — PRÉDÉCESSEURS : <span class="dly-pred" data-key="${esc(key)}">${esc(dlyPredTxt(key)) || "<i>CHOISIR…</i>"}</span>${pf ? " — DÉBUT AU PLUS TÔT LE " + esc(dFr(pf)) : ""}</div>`
          + dlyTable(rows, x => ({ deb: inp(x, "deb"), fin: inp(x, "fin"), dur: inp(x, "dur"),
          __td_deb: " ins-td", __td_fin: " ins-td", __td_dur: " ins-td",
          __cb: x.pid ? `<input type="checkbox" class="dlp-cb" data-task="${x.task}" data-pid="${x.pid}" ${x.on ? "checked" : ""}>` : "",
          __x: "" }),
          x => `class="${x.nw ? "ins-new" : ""}"`, true, DLY_COLS_I);
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
            ${f === "dur" ? "" : "readonly"} inputmode="${f === "dur" ? "numeric" : "none"}" placeholder="${x.nw && f === "deb" ? "SAISIR ICI…" : f === "dur" ? "" : "JJ/MM/AAAA"}" value="${esc(f === "dur" ? x.dur : dFr(x[f]))}">`
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
        const list = D[task] = D[task] || [];
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
          else X.err = "SAISISSEZ D'ABORD LA DATE DE DÉBUT OU DE FIN.";
        } else {
          const iso = X.dParse(v);
          if (iso === null) X.err = "DATE NON VALIDE : FORMAT JJ/MM/AAAA.";
          else if (iso && !sviWork(cal, iso)) X.err = "JOUR NON TRAVAILLÉ DANS LE CALENDRIER DU BUDGET.";
          else q[f] = iso;
        }
        if (X.err) { svToast(X.err, 4000, i); X.err = ""; X.render(); return; }
        /* mêmes contrôles et même fenêtre TÂCHES SUIVANTES que le Gantt */
        if (!X.apply(task, q, { anchor: i, fromDur: f === "dur" })) return;
        /* DÉBUT, FIN, DURÉE : dès que deux valeurs sont connues, la troisième est calculée ; sinon le curseur va à celle qui manque */
        const done = q.deb && q.fin;
        const nx = done ? "" : (q.deb ? "fin" : "deb");
        const el = !done && shell.querySelector(`input.dlp-in[data-task="${task}"][data-f="${nx}"]`);
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
        if (false) {
          const D = X.draft();
          const n = Object.values(D).reduce((t, l) => t + l.filter(p => p.on === true).length, 0);
          if (!n) return;
          svConfirm({ title: "SUPPRIMER LES PÉRIODES COCHÉES", text: n + " PÉRIODE(S) SERONT SUPPRIMÉES.", ok: "SUPPRIMER" }).then(go => {
            if (!go) return;
            Object.keys(D).forEach(k => { D[k] = D[k].filter(p => p.on !== true); });
            X.render();
          });
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
      const mt = k => meta[k] || (meta[k] = { t: "FD", o: 0 });
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
        const okSec = x => { const k = lot + "|" + x.id; return add || !(k === key || dlyReach(k, key)); };
        const allOn = secs.filter(okSec).length && secs.filter(okSec).every(x => sel.has(lot + "|" + x.id));
        const card = d.querySelector(".dpk-card");
        const w = card ? card.style.width : (size && size.w ? size.w + "px" : ""), h = card ? card.style.height : (size && size.h ? size.h + "px" : "");
        d.innerHTML = `<div class="svc-card dpk-card" role="dialog" aria-modal="true" style="${w ? "width:" + w + ";" : ""}${h ? "height:" + h + ";" : ""}">
          <button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
          <div class="svc-t">${add ? "AJOUTER UNE TÂCHE AU PLANNING" : "PRÉDÉCESSEURS — " + esc(dlyName(key))}</div>
          <div class="dpk-cols">
            <div class="dpk-col"><table class="dpk-t"><thead><tr>${cfHead("dpk_lot", "v", "LOT " + svCnt(lots.length, lotsAll.length))}</tr></thead>
              <tbody>${lots.map(x => `<tr class="dpk-lot${x.id === lot ? " cur" : ""}${nSel(x.id) ? " chosen" : ""}" data-lot="${x.id}"><td>${esc(x.v)}${nSel(x.id) ? " " + svCnt(nSel(x.id)) : ""}</td></tr>`).join("")}</tbody></table></div>
            <div class="dpk-col"><table class="dpk-t"><thead><tr>${cfHead("dpk_sec", "v", "ACTIVITÉ SECONDAIRE " + svCnt(secs.length, secsAll.length))}${add ? "" : '<th class="center dpk-ty">TYPE</th><th class="center dpk-of">DÉCALAGE (J)</th>'}<th class="center dpk-cbh">${add ? "" : `<input type="checkbox" class="dpk-all"${allOn ? " checked" : ""}>`}</th></tr></thead>
              <tbody>${secs.map(x => { const k = lot + "|" + x.id, off = !okSec(x), on = sel.has(k);
                const lk = on ? mt(k) : null;
                const ty = add ? "" : `<td class="center dpk-ty">${on ? `<select class="dpk-t-in" data-k="${k}" data-f="t"><option value="FD"${lk.t === "FD" ? " selected" : ""}>FIN → DÉBUT</option><option value="DD"${lk.t === "DD" ? " selected" : ""}>DÉBUT → DÉBUT</option></select>` : ""}</td>
                  <td class="center dpk-of">${on ? `<input class="dpk-o-in number" data-k="${k}" data-f="o" inputmode="numeric" value="${lk.o}">` : ""}</td>`;
                return `<tr class="dpk-sec${off ? " off" : ""}${on ? " chosen" : ""}"><td>${esc(x.v)}</td>${ty}<td class="center"><input type="${add ? "radio" : "checkbox"}" name="dpk" data-k="${k}"${on ? " checked" : ""}${off ? " disabled" : ""}></td></tr>`; }).join("")}</tbody></table></div>
          </div>
          <div class="svc-f"><button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok${add && !sel.size ? " disabled" : ""}>${add ? "SAISIR SES DATES" : "VALIDER"}</button></div>
          <div class="dpk-rsz" title="Largeur et hauteur"></div></div>`;
        d.querySelectorAll(".dpk-col").forEach((c, n) => { c.scrollTop = sc[n] || 0; });
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
        /* la tâche commence avant la fin d'un prédécesseur : proposer de la décaler (durée gardée) */
        const pf = dlyPredFin(key), st = dlyDeb(key);
        if (pf && st && st < pf) {
          svChoose({ title: "TÂCHE À DÉCALER", html: `<div class="svc-sub">${esc(dlyName(key))} COMMENCE LE ${esc(dFr(st))}, AVANT LA DATE IMPOSÉE PAR SES LIAISONS (${esc(dFr(pf))}).</div><div class="svc-sub">RESPECTER LA DURÉE ET DÉCALER CETTE TÂCHE ET TOUTES CELLES QUI VIENNENT APRÈS ?</div>`,
            buttons: [{ v: "shift", label: "DÉCALER", tone: "neutral" }] }).then(v => {
            if (v === "shift") { dlyMoveTo(key, pf); dlyShift(key); svToast("TÂCHES DÉCALÉES — À VALIDER.", 3000); }
            refreshAll();
          });
        }
        refreshAll();
      });
    };
    if (!shell.__dlyPlanBound) {
      shell.__dlyPlanBound = true;
      shell.addEventListener("click", e => {
        const X = shell.__insDly;
        if (!X) return;
        const pc = e.target.closest && e.target.closest(".dly-pred");
        if (pc) { e.stopPropagation(); X.pickPreds(pc.dataset.key); return; }
        if (e.target.closest && e.target.closest(".dly-pred-new")) { X.pickPreds(null); return; }
        if (e.target.closest && e.target.closest(".dly-gen")) { X.gen(); return; }
        if (e.target.closest && e.target.closest(".dly-sortd")) { X.sortDeb(); return; }
        /* ‹ PLANNING : retour au PLANNING (lot et activités libérés, la désignation reste choisie ; brouillon gardé) */
        if (e.target.closest && e.target.closest(".dly-back")) { e.stopPropagation(); X.back(); return; }
        /* en-tête du Gantt : calendrier du budget, ouvert sur le mois touché */
        const gf = e.target.closest && e.target.closest("#dlyGantt .gb-fold");
        if (gf) { e.stopPropagation(); X.fold(gf.dataset.path); return; }
        const gh = e.target.closest && e.target.closest("#dlyGantt .gh");
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
        if (tr && !e.target.closest(".cf-btn, input")) X.go(tr.dataset.key);
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
          X.render();
          return;
        }
        const n = e.target.closest && e.target.closest("input.dly-nm");
        if (n) { X.rename(n); return; }
      });
      /* séparation tableau / Gantt (FORMAT 90) : poignée ‖ tirée au doigt ; largeur du tableau mémorisée */
      shell.addEventListener("pointerdown", e => {
        const sp = e.target.closest && e.target.closest(".dlyg-sp");
        if (!sp) return;
        e.preventDefault(); e.stopPropagation();
        const g = sp.closest(".dlyg"), L = g.querySelector(".dlyg-l"), gw = g.getBoundingClientRect();
        const x0 = e.clientX, w0 = L.getBoundingClientRect().width;
        sp.classList.add("on");
        let w = w0;
        /* de 0 (tableau caché) à toute la largeur (Gantt caché) */
        const mv = ev => { w = Math.max(0, Math.min(gw.width - 3, w0 + ev.clientX - x0)); L.style.width = w + "px"; L.style.maxWidth = "none"; };
        const up = () => {
          document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
          sp.classList.remove("on");
          try { localStorage.setItem("svi_dlyg_w_v1", String(Math.round(w))); } catch (err) {}
        };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
      });
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
        const g = h.tr.closest(".dlyg").getBoundingClientRect();
        l.style.cssText = `position:fixed;z-index:10060;pointer-events:none;height:3px;border-radius:2px;background:var(--inst,#12355b);left:${g.left}px;width:${g.width}px;top:${(h.after ? h.r.bottom : h.r.top) - 1.5}px`;
      };
      shell.__dlyRowDrag = (e, srcTr, onDrop) => {};
      shell.addEventListener("pointerdown", e => {
        const X = shell.__insDly;
        const tr = e.target.closest && e.target.closest(".dlyg-l tr.dly-task, .dlyg-l tr.dly-grp");
        if (!X || !tr || e.target.closest("input[type=checkbox], .dly-pred, .dly-jal, .dly-fold, .cf-btn")) return;
        const x0 = e.clientX, y0 = e.clientY;
        let on = false, hit = null;
        const tm = setTimeout(() => { on = true; tr.classList.add("ro-src"); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); try { window.getSelection().removeAllRanges(); } catch (err) {} document.body.classList.add("svi-dragging"); }, 350);
        const tmv = ev => { if (on) ev.preventDefault(); };
        document.addEventListener("touchmove", tmv, { passive: false });
        const mv = ev => {
          if (!on) { if (Math.abs(ev.clientX - x0) > 8 || Math.abs(ev.clientY - y0) > 8) end(); return; }
          ev.preventDefault();
          hit = dlyRowAt(ev.clientY, tr);
          if (hit) dlyRowLine(hit); else document.getElementById("roLine")?.remove();
        };
        const end = drop => {
          clearTimeout(tm);
          document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", cc);
          setTimeout(() => document.removeEventListener("touchmove", tmv), 0);
          document.getElementById("roLine")?.remove(); tr.classList.remove("ro-src"); document.body.classList.remove("svi-dragging");
          if (on) { const stop = ev => { ev.stopPropagation(); ev.preventDefault(); }; shell.addEventListener("click", stop, { capture: true, once: true }); setTimeout(() => shell.removeEventListener("click", stop, { capture: true }), 350); }
          if (drop && on && hit) { if (tr.classList.contains("dly-task")) X.dropTask(tr.dataset.key, hit.tr, hit.after); else X.moveKeys(dlyRowKeys(tr), dlyRowKeys(hit.tr), hit.after); }
        };
        const up = () => end(true), cc = () => end(false);
        document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", cc);
      });
      /* barre de plafond (FORMAT 99) : tirée au doigt, par paliers entiers (1 au moins) */
      shell.addEventListener("pointerdown", e => {
        const X = shell.__insDly;
        const pl = e.target.closest && e.target.closest("#dlyGantt .gplaf");
        if (!X || !pl) return;
        e.preventDefault(); e.stopPropagation();
        const h = pl.closest(".ghist"), sc = Number(h.dataset.sc) || 1, HH = h.offsetHeight, r0 = h.getBoundingClientRect();
        const v0 = pl.querySelector(".gplaf-v");
        let P = 0;
        const mv = ev => { P = Math.max(1, Math.round((HH - (ev.clientY - r0.top)) / sc)); pl.style.top = (HH - P * sc) + "px"; v0.textContent = "PLAFOND " + P; };
        const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); if (P) X.plaf(P); };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
      });
      shell.addEventListener("pointerdown", e => {
        const X = shell.__insDly;
        const bar = e.target.closest && e.target.closest("#dlyGantt .gb");
        if (!X || !bar || e.button > 0) return;
        const host = bar.closest("#dlyGantt"), body = host.querySelector(".gbody"), tmp = host.querySelector(".gtmp");
        const key = bar.dataset.key, mode = e.target.closest(".gb-e") ? "end" : e.target.closest(".gb-s") ? "start" : "body";
        e.preventDefault();
        const x0 = e.clientX, y0b = e.clientY, L0 = bar.offsetLeft, W0 = bar.offsetWidth;
        let moved = false, link = false, days = 0, vert = false, hitV = null;
        /* appui long : sur un bout = liaison ; sur le milieu = changer le rang (barre soulevée) */
        const t = setTimeout(() => { if (moved) return; if (mode !== "body") { link = true; bar.classList.add("gb-link"); } else { vert = true; bar.classList.add("gb-lift"); } }, 500);
        const br = () => body.getBoundingClientRect();
        /* liaison selon le bout de départ ET le bout d'arrivée (moitié gauche = début, moitié droite = fin) :
           fin → début = FD ; début → fin = FD dans l'autre sens ; début → début = DD ; fin → fin = rien */
        const linkPlan = ev => {
          /* les fils (flèches) peuvent couvrir le bout d'une barre : on prend la première barre sous le doigt */
          const tg = document.elementsFromPoint(ev.clientX, ev.clientY).map(e => e.closest && e.closest("#dlyGantt .gb")).find(Boolean);
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
          if (vert) { hitV = dlyRowAt(ev.clientY, null); if (hitV && hitV.tr.dataset.key === key) hitV = null; if (hitV) dlyRowLine(hitV); else document.getElementById("roLine")?.remove(); return; }
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
          if (vert) { document.getElementById("roLine")?.remove(); if (hitV) X.dropTask(key, hitV.tr, hitV.after); return; }
          if (link) {
            tmp.innerHTML = "";
            const P = linkPlan(ev);
            if (P) X.addLink(P.pred, P.succ, P.t, P.tg);
            return;
          }
          if (!moved || !days) { X.render(); return; }
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
    shell.__insDly = INS && INS_EDIT ? { INS, dAdd, dDiff, dParse, dFr, insId, insSave, err: "", draft: dlyDraft,
      predFin: k => dlyPredFin(k), succs: k => dlySuccs(k), deb: k => dlyDeb(k), name: k => dlyName(k), shift: (k, g) => dlyShift(k, g),
      cal: () => insCal(), glued: k => dlyGlued(k), links: k => dlyLinks(k), apply: (k, q, o) => dlyApply(k, q, o),
      /* FORMAT 22 : replier / déplier sans faire bouger l'écran */
      fold: p => { dlyFoldToggle(p); keepScroll(() => renderTab()); },
      jal: k => { INS.jal = INS.jal || {}; if (INS.jal[k]) delete INS.jal[k]; else INS.jal[k] = true; insSave(); histLog("DÉLAIS", "JALON", dlyName(k) + (INS.jal[k] ? " — POSÉ" : " — RETIRÉ")); renderTab(); },
      linkWin: (p, k) => dlyLinkWin(p, k), reach: (a, b) => dlyReach(a, b), addLink: (p, k, t, a) => dlyAddLink(p, k, t, a),
      gen: () => dlyGenWin(), level: () => dlyApplyLevel(),
      back: () => { LK.lot = LK.prim = LK.sec = null; refreshAll(); },
      sortDeb: () => { dlySortByDeb(); insSave(); histLog("DÉLAIS", "CLASSER PAR DÉBUT", ""); refreshAll(); },
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
        if (!v || plan.err) { renderTab(); return ""; }
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
      /* tâche lâchée sur une ligne (tableau ou Gantt) : autre lot → changement de lot, puis rang */
      dropTask: (key, tr, after) => {
        const X = shell.__insDly;
        let nl = null;
        if (tr.classList.contains("dly-task")) nl = String(tr.dataset.key).split("|")[0];
        else if (after) {
          const lt = INS.lot.find(x => dlyLotPath(x.v).join(" / ") === tr.dataset.path);
          if (!lt) { svToast("CHANGEMENT REFUSÉ : " + tr.dataset.path + " EST UN NIVEAU, PAS UN LOT. LÂCHER LA TÂCHE PARMI LES TÂCHES D'UN LOT.", 4500, tr); return; }
          nl = lt.id;
        }
        let k = key;
        if (nl && nl !== key.split("|")[0]) {
          const ek = X.sameIn(key, nl);
          if (ek) { X.mergeAsk(key, ek, tr); return; }
          k = X.changeLot(key, nl, tr); if (!k) { renderTab(); return; } insSave(); insRenderChain();
        }
        const g = tr.classList.contains("dly-task") ? null : (shell.__dlyRows || []).find(x => x.grp && x.path === tr.dataset.path);
        const ts = (g ? g.all.map(t => t.key) : [tr.dataset.key]).map(t => t === key ? k : t).filter(t => t && t !== k);
        if (ts.length) X.moveKeys([k], ts, after); else renderTab();
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
      rename: inp => {
        const v = U_(sviClean(inp.value));
        const back = () => { renderTab(); };
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
          refreshAll();
          return;
        }
        /* lot ou niveau de lot (« / ») : toutes les tâches dessous suivent */
        const segs = dlyLotPath(inp.dataset.path), lvl = segs.length;
        if (!v || v.includes("/")) { svToast(!v ? "NOM VIDE REFUSÉ." : "« / » SÉPARE LES NIVEAUX : NOM REFUSÉ.", 3500, inp); back(); return; }
        if (v === segs[lvl - 1]) { back(); return; }
        const hit = INS.lot.filter(x => !x.t && (() => { const p = dlyLotPath(x.v); return p.length >= lvl && segs.every((sg, i) => U_(p[i]) === U_(sg)); })());
        const nv = x => { const p = dlyLotPath(x.v); p[lvl - 1] = v; return p.join(" / "); };
        const ids = new Set(hit.map(x => x.id));
        const clash = hit.find(x => INS.lot.some(y => !ids.has(y.id) && U_(y.v) === U_(nv(x))));
        if (clash) { svToast("LOT « " + nv(clash) + " » EXISTE DÉJÀ.", 3500, inp); back(); return; }
        hit.forEach(x => { x.v = nv(x); });
        /* l'état replié suit le nouveau nom */
        { const f = dlyFoldAll(), o = dlyFoldK(inp.dataset.path); if (f[o]) { delete f[o]; f[dlyFoldK(segs.slice(0, lvl - 1).concat(v).join(" / "))] = 1; try { localStorage.setItem("svi_lotfold_v1", JSON.stringify(f)); } catch (e) {} } }
        insSave(); histLog("SAISIE", "LOT RENOMMÉ", inp.dataset.path + " → " + v + " (" + hit.length + " LOT(S))");
        refreshAll();
      },
      plaf: P => { INS.plaf = P; insSave(); histLog("DÉLAIS", "PLAFOND MAIN D'ŒUVRE", String(P)); renderTab(); },
      /* barre glissée de n jours : FIN seule (bout tiré) ou tâche entière, durée gardée (jours travaillés) */
      dragTo: (k, mode, n, a) => {
        const cal = insCal(), d0 = dlyDeb(k), f0 = dlyFin(k);
        if (!d0 || !f0) return;
        if (mode === "end") { let f = sviWNear(cal, sviIsoAdd(f0, n), n > 0 ? 1 : -1); if (f < d0) f = d0; dlyApply(k, { deb: d0, fin: f }, { anchor: a, fromDur: true }); return; }
        const dur = sviWDur(cal, d0, f0) || 1, pf = dlyPredFin(k);
        let d = sviWNear(cal, sviIsoAdd(d0, n), n > 0 ? 1 : -1);
        /* glissée trop tôt : la barre revient à la première date permise par ses liaisons */
        if (pf && d < pf) d = sviWNear(cal, pf, 1);
        if (d === d0) { renderTab(); insRenderChain(); return; }
        dlyApply(k, { deb: d, fin: sviWFin(cal, d, dur) }, { anchor: a });
      },
      pickPreds: k => dlyPickPreds(k), go: k => { const [lo, se] = k.split("|"); LK.lot = lo; LK.sec = se; LK.prim = null; refreshAll(); },
      render: () => { renderTab(); insRenderChain(); } } : null;
    /* budget ouvert, pour PARAMÉTRAGE › CALENDRIER et DATES DU BUDGET (15/10/2026) */
    window.__sviBdgLive = INS ? {
      ref: budget.inst.ref, project: budget.project || "", edit: INS_EDIT,
      cal: () => insCal(), dates: () => ({ but: INS.dbut || "", obj: INS.dobj || "" }),
      /* changer un jour (travaillé ↔ non travaillé) recale seulement les tâches qui le traversent, avec leur chaîne ;
         liaisons, durées et décalages restent */
      setCal: nc => {
        const oc = insCal();
        /* dates affichées : brouillon en attente de ✓ VALIDER s'il y en a un, sinon dates validées */
        const cur = k => dlyList(k)[0];
        const keys = [...new Set([...Object.keys(INS.dlp || {}), ...Object.keys(LK.dlpDraft || {})])].filter(k => { const p = cur(k); return p && p.deb && p.fin; });
        const glue = {};
        keys.forEach(k => { glue[k] = dlyGlued(k); });
        const durs = {};
        keys.forEach(k => { const p = cur(k); durs[k] = sviWDur(oc, p.deb, p.fin) || 1; });
        INS.cal = { we: [...new Set(nc.we || [])].sort(), off: [...new Set(nc.off || [])].sort(), on: [...new Set(nc.on || [])].sort() };
        const ncal = insCal(), moved = new Set();
        keys.forEach(k => {
          const p = cur(k);
          let hit = !sviWork(ncal, p.deb) || !sviWork(ncal, p.fin);
          for (let d = p.deb, i = 0; !hit && d <= p.fin && i < 20000; d = sviIsoAdd(d, 1), i++) if (sviWork(oc, d) !== sviWork(ncal, d)) hit = true;
          if (!hit) return;
          const q = dlyDraftKey(k)[0];
          q.deb = sviWNear(ncal, q.deb, 1); q.fin = sviWFin(ncal, q.deb, durs[k]);
          moved.add(k);
        });
        [...moved].forEach(k => dlyShift(k, glue[k] || new Set()).forEach(x => moved.add(x)));
        moved.forEach(k => { if (LK.dlpDraft && LK.dlpDraft[k]) { INS.dlp[k] = LK.dlpDraft[k].map(p => ({ id: p.id, deb: p.deb || "", fin: p.fin || "" })); delete LK.dlpDraft[k]; } });
        insSave();
        histLog("PARAMÉTRAGE", "CALENDRIER DU BUDGET", moved.size + " TÂCHE(S) RECALÉE(S)");
        refreshAll();
        return moved.size;
      },
      setDates: (but, obj) => {
        INS.dbut = but || ""; INS.dobj = obj || "";
        insSave();
        histLog("PARAMÉTRAGE", "DATES DU BUDGET", "BUTOIR " + (dFr(INS.dbut) || "—") + " — OBJECTIF " + (dFr(INS.dobj) || "—"));
        refreshAll();
      }
    } : null;

    /* ---------- MODE LIAISONS ---------- */
    const LK = { des: null, lot: null, prim: null, sec: null, prd: {}, chg: {}, err: "" };
    const lkName = (k, id) => { const r = INS[k].find(x => x.id === id); return r ? (k === "des" ? ((r.art ? r.art + " " : "") + (r.des || "")) : (r.v || r.des || "")) : ""; };
    const insRenderLinks = () => {
      const box = $("insLinkView");
      if (!box) return;
      const RO = !INS_EDIT;
      const U = insUsed();
      const az = (a, b) => String(a).localeCompare(String(b), "fr", { numeric: true });
      /* lignes choisies en haut (consigne 14), filtres / tri de colonne (7), colonnes réglables (9) */
      const top = (rows, isSel) => rows.map((r, i) => ({ r, i })).sort((a, b) => (isSel(b.r) - isSel(a.r)) || a.i - b.i).map(o => o.r);
      const W = { art: 70, des: 340, u: 70, q: 110, lnk: 120, v: 220, lot: 160, prim: 180, sec: 200, np: 110, nc: 110, act: 110, qt: 200, lq: 120, lp: 110, lm: 140 };
      const tbl = (t, cols, rows, lead, rowHTML) => {
        const oc = coOrder(t, cols);
        const w = k => cwLoad()[t + "." + k] || W[k] || 120;
        return `<table class="bdg-d-table lk-table" style="width:${(lead ? 40 : 0) + oc.reduce((s, c) => s + w(c[0]), 0)}px">
          <colgroup>${lead ? '<col style="width:40px">' : ""}${oc.map(c => `<col data-w="${t}.${c[0]}" style="width:${w(c[0])}px">`).join("")}</colgroup>
          <thead><tr>${lead ? '<th class="center"></th>' : ""}${oc.map(c => cfHead(t, c[0], c[1], c[3])).join("")}</tr></thead>
          <tbody>${rows.map(r => rowHTML(r, oc)).join("") || `<tr><td colspan="${oc.length + (lead ? 1 : 0)}" class="empty">AUCUNE LIGNE</td></tr>`}</tbody></table>`;
      };
      const radio = (k, id) => `<input type="radio" name="lk_${k}" data-lk="${k}" value="${id}" ${LK[k] === id ? "checked" : ""} ${RO ? "disabled" : ""}>`;
      const nLinks = id => (INS.links || []).filter(l => l.des === id).length;
      const unl = (k, id) => U[k] && !U[k].has(id) ? " ins-unl" : "";
      /* DÉSIGNATIONS */
      const DC = [["art", "ART", r => r.art || "", "center"], ["des", "DÉSIGNATION", r => r.des || "", ""], ["u", "UPB", r => r.u || "", "center"],
        ["q", "QPB", r => r.q === "" || r.q === undefined ? "" : num(r.q), "number"], ["lnk", "LIAISONS", r => nLinks(r.id) ? nLinks(r.id) + " VALIDÉE(S)" : "", ""]];
      const desList = top(cfApply("lk_des", DC, INS.des.filter(r => !r.t)), r => r.id === LK.des);
      const desHTML = tbl("lk_des", DC, desList, true, (r, oc) => `<tr class="${LK.des === r.id ? "lk-sel" : LK.des ? "lk-dim" : ""}${unl("des", r.id)}" data-pick="des" data-id="${r.id}">
          <td class="center">${radio("des", r.id)}</td>${oc.map(c => `<td class="${c[3]}">${c[0] === "lnk" ? (nLinks(r.id) ? `<span class="lk-ok">${nLinks(r.id)} VALIDÉE(S)</span>` : "")
            : c[0] === "q" ? insFmt(insQty("des", r)) : esc(c[2](r))}</td>`).join("")}</tr>`);
      /* TÂCHES : trois blocs (ordre alphabétique, largeur réglable) */
      const ws = ["lot", "prim", "sec"].map(k => cwLoad()["lk_hier." + k]);
      const gridCols = ws.every(Boolean) && window.innerWidth > 700 ? ws.map(x => x + "px").join(" ") : "";
      const col = (k, title) => {
        const C = [["v", title, r => r.v || "", ""]];
        const list = top(cfApply("lk_" + k, C, [...INS[k]].sort((a, b) => az(a.v || "", b.v || ""))), r => r.id === LK[k]);
        return `<div class="lk-col" data-lk-col="${k}"><div class="lk-ch bdg-h-head ${cfT("lk_" + k).f.v ? "cf-on" : ""}"><span class="cf-wrap"><span class="cf-lab">${title}${svCnt(list.length)}</span><span class="cf-btn"
            data-cf="lk_${k}" data-col="v" role="button" aria-label="Trier / filtrer">${cfIcon}</span></span><span class="col-rs lk-rs"></span></div>
          ${list.map(r => `<label class="lk-li ${LK[k] === r.id ? "lk-sel" : ""}${unl(k, r.id)}" data-pick="${k}" data-id="${r.id}">${radio(k, r.id)}<span>${esc(r.v || "")}</span></label>`).join("")
            || `<div class="lk-li empty">AUCUNE LIGNE</div>`}</div>`;
      };
      /* DÉTAILS : produits (obligatoire = étoile), charges (ordre alphabétique) */
      const det = k => {
        const C = [["des", k === "prd" ? "DÉSIGNATION PRODUIT" : "DÉSIGNATION CHARGE", r => r.des || "", ""], ["u", k === "prd" ? "UPB" : "UCB", r => r.u || "", "center"],
          ["qt", "QUANTITÉ DE LA TÂCHE", r => LK[k][r.id] ?? "", "number"]];
        let rows = [...INS[k]];
        if (k === "chg") rows.sort((a, b) => az(a.des || "", b.des || ""));
        rows = top(cfApply("lk_" + k, C, rows), r => LK[k][r.id] !== undefined);
        detN[k] = rows.length;
        return `<div class="lk-scroll">${tbl("lk_" + k, C, rows, true, (r, oc) => {
            const on = LK[k][r.id] !== undefined;
            return `<tr class="${on ? "lk-sel" : ""}${unl(k, r.id)}" data-det="${k}" data-id="${r.id}"><td class="center"><input type="checkbox" class="lk-cb" ${on ? "checked" : ""} ${RO ? "disabled" : ""}></td>
              ${oc.map(c => `<td class="${c[3]}">${c[0] === "qt" ? `<input class="lk-q" inputmode="decimal" value="${on ? esc(LK[k][r.id]) : ""}" ${RO ? "disabled" : ""}>` : esc(c[2](r))}</td>`).join("")}</tr>`;
          })}</div>`;
      };
      /* DÉTAILS sous onglets, même format que SAISIE / validé */
      const detN = {};
      const lkTab = ["prd", "qlt", "dly"].includes(LK.tab) ? LK.tab : "chg";
      /* QUALITÉ : lecture (saisie en mode SAISIE) ; DÉLAIS : saisis ici seulement */
      const qltHTML = () => `<table class="bdg-d-table" style="width:600px"><thead><tr><th>QUALITÉ</th></tr></thead><tbody>${
        (INS.qlt || []).map(r => `<tr><td>${esc(r.v || "")}</td></tr>`).join("") || '<tr><td class="empty">AUCUNE LIGNE</td></tr>'}</tbody></table>`;
      const detBody = lkTab === "qlt" ? `<div class="lk-scroll">${qltHTML()}</div>`
        : lkTab === "dly" ? `<div class="lk-scroll">${insDlyHTML(!RO, shell.__insDly && shell.__insDly.err)}</div>` : det(lkTab);
      detN.qlt = (INS.qlt || []).length;
      detN.dly = insTasks().length;
      if (detN.prd === undefined) detN.prd = cfApply("lk_prd", [["des", "", r => r.des || ""], ["u", "", r => r.u || ""], ["qt", "", r => LK.prd[r.id] ?? ""]], [...INS.prd]).length;
      if (detN.chg === undefined) detN.chg = cfApply("lk_chg", [["des", "", r => r.des || ""], ["u", "", r => r.u || ""], ["qt", "", r => LK.chg[r.id] ?? ""]], [...INS.chg]).length;
      const tabBtn = (k, title, extra) => `<button type="button" class="bdg-d-tab${lkTab === k ? " active" : ""}${Object.keys(cfT("lk_" + k).f).length ? " cf-on" : ""}" data-lktab="${k}">${SVI_ICON[k] || ""}${title} ${svCnt(detN[k])}${extra || ""}</button>`;
      const detHTML = `<div class="lk-dettabs"><div class="bdg-d-tabs lk-tabs">${tabBtn("chg", "DÉTAIL CHARGES")}${tabBtn("prd", 'DÉTAIL PRODUITS <b class="req-star">*</b>')}${tabBtn("qlt", "DÉTAIL QUALITÉ")}${tabBtn("dly", "DÉTAIL DÉLAIS")}</div>
        <div class="bdg-d-block bdg-d-tabbody lk-blk lk-det">${detBody}<div class="blk-rsz lk-hrsz" data-lkh="det"></div></div></div>`;
      const nPrd = Object.keys(LK.prd).length;
      const complete = LK.des && LK.lot && LK.prim && LK.sec && nPrd > 0;
      const chain = [lkName("des", LK.des), lkName("lot", LK.lot), lkName("prim", LK.prim), lkName("sec", LK.sec)]
        .map(x => x || "…").join(" › ") + " › " + nPrd + " PRODUIT(S)" + (Object.keys(LK.chg).length ? " + " + Object.keys(LK.chg).length + " CHARGE(S)" : "");
      /* LIAISONS VALIDÉES */
      const LC = [["art", "ART", l => (INS.des.find(x => x.id === l.des) || {}).art || "", "center"],
        ["des", "DÉSIGNATION", l => (INS.des.find(x => x.id === l.des) || {}).des || "", ""],
        ["lot", "LOT", l => lkName("lot", l.lot), ""], ["prim", "ACTIVITÉ PRIMAIRE", l => lkName("prim", l.prim), ""],
        ["sec", "ACTIVITÉ SECONDAIRE", l => lkName("sec", l.sec), ""], ["np", "PRODUITS", l => (l.prd || []).length, "center"],
        ["nc", "CHARGES", l => (l.chg || []).length, "center"],
        /* prix de la tâche primaire = PPB de la désignation client */
        ["lq", "QUANTITÉ", l => insFmt((l.prd || []).reduce((t, x) => t + num(x.q || 0), 0)), "number"],
        ["lp", "PPB", l => insFmt(num((INS.des.find(x => x.id === l.des) || {}).p || 0)), "number"],
        ["lm", "MPB HT", l => insFmt((l.prd || []).reduce((t, x) => t + num(x.q || 0), 0) * num((INS.des.find(x => x.id === l.des) || {}).p || 0)), "number"]];
      const lrows = cfApply("lk_links", LC, INS.links || []);
      const linksHTML = tbl("lk_links", LC, lrows, false, (l, oc) => `<tr>${oc.map(c => `<td class="${c[3]}">${esc(c[2](l))}</td>`).join("")}</tr>`)
        .replace(/<\/tr><\/thead>/, RO ? "</tr></thead>" : `<th class="center" style="width:110px"></th></tr></thead>`);
      box.innerHTML = `
        <div class="bdg-d-block lk-blk"><div class="bdg-d-block-title"><span class="ttl">${SVI_ICON.client}DÉSIGNATIONS CLIENT ${svCnt(desList.length)}</span></div>
          <div class="lk-scroll" style="height:var(--lkh-des,170px)">${desHTML}</div><div class="blk-rsz lk-hrsz" data-lkh="des"></div></div>
        <div class="bdg-d-block lk-blk"><div class="bdg-d-block-title"><span class="ttl">${SVI_ICON.hier}TÂCHES</span></div>
          <div class="lk-grid" style="${gridCols ? "grid-template-columns:" + gridCols : ""}">${col("lot", "LOT")}${col("prim", "ACTIVITÉ PRIMAIRE")}${col("sec", "ACTIVITÉ SECONDAIRE")}</div><div class="blk-rsz lk-hrsz" data-lkh="hier"></div></div>
        ${detHTML}
        ${RO ? "" : `<div class="lk-chain"><span class="lk-path">CHAÎNE : ${esc(chain)}</span>
          ${LK.err ? `<span class="lk-err">${esc(LK.err)}</span>` : ""}
          <button type="button" class="lk-go" ${complete ? "" : "disabled"}>✓ VALIDER LA LIAISON</button></div>`}
        <div class="bdg-d-block lk-blk"><div class="bdg-d-block-title"><span class="ttl">LIAISONS VALIDÉES ${svCnt(lrows.length)}</span></div>
          <div class="lk-scroll lk-links" style="height:var(--lkh-links,170px)">${linksHTML}</div><div class="blk-rsz lk-hrsz" data-lkh="links"></div></div>`;
      /* hauteurs des blocs réglées par la poignée (mémorisées) */
      try { const H = JSON.parse(localStorage.getItem("svi_lkh_v1") || "{}"); Object.keys(H).forEach(k => box.style.setProperty("--lkh-" + k, H[k] + "px")); } catch (e) {}
      sviMarkEmptyTabs(box);
      /* bouton DÉLIER au bout de chaque liaison */
      if (!RO) box.querySelectorAll(".lk-links tbody tr").forEach((tr, i) => {
        const l = lrows[i];
        if (!l) return;
        const td = document.createElement("td");
        td.className = "center";
        td.innerHTML = `<button type="button" class="lk-del" data-lid="${l.id}">${INS_TRASH} DÉLIER</button>`;
        tr.appendChild(td);
      });
    };
    /* contrôle des règles avant validation (cahier des charges A et D) */
    /* règle A au moment du choix : message passager et choix refusé */
    const lkRuleA = (k, id) => {
      const L = INS.links || [];
      if (!LK.des || !id) return "";
      if (k === "prim") {
        const t = LK.lot && L.find(l => l.lot === LK.lot && l.prim === id && l.des !== LK.des);
        if (t) return "RÈGLE A : LA TÂCHE PRIMAIRE " + lkName("lot", LK.lot) + " › " + lkName("prim", id) + " EST DÉJÀ LIÉE À " + lkName("des", t.des) + ".";
      }
      if (k === "sec" && LK.lot) {
        const t = L.find(l => l.lot === LK.lot && l.sec === id && l.des !== LK.des);
        if (t) return "RÈGLE A : LA TÂCHE SECONDAIRE " + lkName("lot", LK.lot) + " › " + lkName("sec", id) + " EST DÉJÀ LIÉE À " + lkName("des", t.des) + ".";
      }
      return "";
    };
    const lkCheck = () => {
      const L = INS.links || [];
      /* liaison déjà validée : on y ajoute les nouveaux détails (pas d'erreur) */
      /* règle A (11/10/2026) : lot, désignation et activité secondaire se lient librement ;
         une activité primaire n'a qu'une désignation ; une tâche primaire (lot + act. prm)
         et une tâche secondaire (lot + act. scd) n'ont qu'une désignation */
      const ra = lkRuleA("prim", LK.prim) || lkRuleA("sec", LK.sec);
      if (ra) return ra;
      const D = INS.des.find(x => x.id === LK.des);
      const du = U_(D && D.u);
      const bad = du && insIsPrimLink(LK.prim, LK.sec) && Object.keys(LK.prd).find(id => { const p = INS.prd.find(x => x.id === id); return p && U_(p.u) && U_(p.u) !== du; });
      if (bad) return "UNITÉ : " + lkName("prd", bad) + " (" + U_(INS.prd.find(x => x.id === bad).u) + ") N'A PAS L'UNITÉ DE LA DÉSIGNATION (" + du + ").";
      const pk = id => impId("prd", INS.prd.find(x => x.id === id) || {});
      const dup = Object.keys(LK.prd).find(id => L.some(l => l.lot === LK.lot && l.sec === LK.sec && (l.prd || []).some(x => x.id === id || pk(x.id) === pk(id))));
      if (dup) return "RÈGLE D : " + lkName("prd", dup) + " EST DÉJÀ DANS LA TÂCHE SECONDAIRE " + lkName("lot", LK.lot) + " › " + lkName("sec", LK.sec) + ".";
      return "";
    };
    if (!shell.__lkBound) {
      shell.__lkBound = true;
      shell.addEventListener("change", e => {
        const X = shell.__lk;
        if (!X || !e.target.closest("#insLinkView")) return;
        const r = e.target.closest("input[data-lk]");
        if (r) { X.LK[r.dataset.lk] = r.value; X.LK.err = ""; X.render(); return; }
        const cb = e.target.closest("input.lk-cb");
        if (cb) {
          const tr = cb.closest("tr[data-det]");
          const k = tr.dataset.det, id = tr.dataset.id;
          if (cb.checked) X.LK[k][id] = tr.querySelector(".lk-q").value || ""; else delete X.LK[k][id];
          X.LK.err = ""; X.render(); return;
        }
        const q = e.target.closest("input.lk-q");
        if (q) {
          const tr = q.closest("tr[data-det]");
          X.LK[tr.dataset.det][tr.dataset.id] = q.value.trim();
          X.render();
        }
      });
      shell.addEventListener("click", e => {
        const X = shell.__lk;
        if (!X || !e.target.closest("#insLinkView")) return;
        /* toucher la ligne = toucher le rond (ou la case) */
        if (!e.target.closest("input, button, .cf-btn, label")) {
          const tr = e.target.closest("tr[data-pick]");
          if (tr && !X.RO()) { X.LK[tr.dataset.pick] = tr.dataset.id; X.LK.err = ""; X.render(); return; }
          const td = e.target.closest("tr[data-det]");
          if (td && !X.RO()) { td.querySelector(".lk-cb")?.click(); return; }
        }
        const lt = e.target.closest(".bdg-d-tab[data-lktab]");
        if (lt && !e.target.closest(".cf-btn")) { X.LK.tab = lt.dataset.lktab; X.render(); return; }
        const del = e.target.closest(".lk-del");
        if (del) {
          svConfirm({ title: "DÉLIER", text: "LA LIAISON SERA DÉFAITE ; LES LIGNES RESTENT DANS LE BUDGET.", ok: "DÉLIER" }).then(go => {
            if (!go) return;
            X.INS.links = (X.INS.links || []).filter(l => l.id !== del.dataset.lid);
            X.save("DÉLIER"); X.render();
          });
          return;
        }
        if (e.target.closest(".lk-go")) {
          const err = X.check();
          if (err) { X.LK.err = err; X.render(); return; }
          const L = X.LK;
          X.INS.links = X.INS.links || [];
          X.INS.links.push({ id: X.insId(), des: L.des, lot: L.lot, prim: L.prim, sec: L.sec,
            prd: Object.entries(L.prd).map(([id, q]) => ({ id, q: q === "" ? "" : num(q) })),
            chg: Object.entries(L.chg).map(([id, q]) => ({ id, q: q === "" ? "" : num(q) })) });
          /* on garde la désignation et le lot pour enchaîner la tâche suivante */
          L.prim = null; L.sec = null; L.prd = {}; L.chg = {}; L.err = "";
          X.save("LIAISON VALIDÉE"); X.render();
        }
      });
    }
    shell.__lk = INS ? { INS, LK, insId, check: lkCheck, render: () => insRenderLinks(), RO: () => !INS_EDIT,
      save: what => { insSave(); histLog("LIAISONS", what, fullRef); } } : null;
    /* détail produits : alerte (non bloquante) si les dimensions ne correspondent pas à l'unité
       U / F : NBR seul ; M / ML : NBR + 1 DIM ; M2 : NBR + 2 DIM ; M3 : NBR + 3 DIM */
    if (!shell.__dimBound) {
      shell.__dimBound = true;
      shell.addEventListener("change", e => {
        const inp = e.target.closest && e.target.closest(".ins-in");
        const X = shell.__ins;
        if (!inp || !X || !["u", "nbr", "d1", "d2", "d3"].includes(inp.dataset.f)) return;
        const tr = inp.closest('tr[data-ik="prd"][data-iid]');
        if (!tr) return;
        const r = X.INS.prd.find(x => x.id === tr.dataset.iid);
        if (!r) return;
        const u = String(r.u || "").trim().toUpperCase();
        const max = { U: 0, F: 0, M: 1, ML: 1, M2: 2, M3: 3 }[u];
        if (max === undefined) return;
        const nd = ["d1", "d2", "d3"].filter(f => r[f] !== "" && r[f] !== undefined && r[f] !== null).length;
        if (nd > max) svToast("ATTENTION : UNITÉ " + u + " → " + (max === 0 ? "NBR SEUL" : "NBR ET " + max + " DIM") + " (" + nd + " DIM RENSEIGNÉE" + (nd > 1 ? "S" : "") + ").", 3500, inp);
      });
    }
    /* détail charges : ART ou désignation saisi → désignation, unité, PCB et TVA viennent de CHS ;
       charge absente de CHS : acceptée, son PCB reste saisissable */
    if (!shell.__chsBound) {
      shell.__chsBound = true;
      shell.addEventListener("change", e => {
        const inp = e.target.closest && e.target.closest(".ins-in");
        const X = shell.__ins;
        if (!inp || !X || !["art", "des"].includes(inp.dataset.f)) return;
        const tr = inp.closest('tr[data-ik="chg"][data-iid]');
        if (!tr) return;
        const r = X.INS.chg.find(x => x.id === tr.dataset.iid);
        if (!r) return;
        const c = chsFind(inp.dataset.f === "art" ? r.art : "", inp.dataset.f === "des" ? r.des : "");
        if (c) { r.chs = c.id; r.art = String(c.article ?? r.art ?? "").toUpperCase(); r.des = String(c.designation ?? r.des ?? "").toUpperCase();
          r.u = String(c.unit ?? r.u ?? "").toUpperCase(); r.p = c.pcs; r.tva = c.tva; }
        else if (r.chs) { delete r.chs; }
        else return;
        X.insSave();
        /* la ligne seule est redessinée (le PCB passe en gris ou redevient saisissable) */
        const tmp = document.createElement("tbody");
        tmp.innerHTML = X.insRowHTML("chg", r, 0);
        const nr = tmp.firstElementChild;
        const foc = document.activeElement && tr.contains(document.activeElement) ? document.activeElement.dataset.f : null;
        tr.replaceWith(nr);
        X.insLive("chg", nr, r);
        if (foc) nr.querySelector(`input[data-f="${foc}"]`)?.focus();
      });
    }
    /* FORMAT 74-75 : nombre non valide refusé ; unité d'un produit → DIM non autorisées effacées et grisées ;
       on ne passe pas à une autre ligne tant que la ligne quittée a une erreur */
    if (!shell.__ruleBound) {
      shell.__ruleBound = true;
      shell.addEventListener("change", e => {
        const inp = e.target.closest && e.target.closest(".ins-in");
        const X = shell.__ins;
        if (!inp || !X) return;
        const tr = inp.closest("[data-ik][data-iid]");
        if (!tr) return;
        const k = tr.dataset.ik, r = X.INS[k] && X.INS[k].find(x => x.id === tr.dataset.iid);
        if (!r) return;
        /* ligne liée entièrement vidée : refusée, la valeur revient (FORMAT 90) */
        if (insRowEmpty(k, r) && X.isUsed(k, r.id)) {
          const old = shell.__dupOld && shell.__dupOld.id === r.id ? shell.__dupOld.row : null;
          if (old) { r[inp.dataset.f] = old[inp.dataset.f] ?? ""; inp.value = inp.getAttribute("inputmode") === "decimal" ? insFmt(r[inp.dataset.f]) : String(r[inp.dataset.f] ?? ""); }
          svToast("LIGNE LIÉE : DÉLIER D'ABORD.", 3500, inp);
          X.insSave();
          return;
        }
        if (inp.getAttribute("inputmode") === "decimal" && !sviNumOk(inp.value)) {
          svToast("NOMBRE NON VALIDE : CHIFFRES SEULEMENT (EX. 1 234,56).", 3500, inp);
          inp.value = ""; r[inp.dataset.f] = ""; X.insSave();
          setTimeout(() => inp.focus(), 0);
          return;
        }
        if (k === "prd" && inp.dataset.f === "u") {
          const nd = sviUnitDims(r.u);
          const gone = [1, 2, 3].filter(i => i > nd && String(r["d" + i] ?? "") !== "");
          gone.forEach(i => { r["d" + i] = ""; });
          if (gone.length) svToast("UNITÉ " + U_(r.u) + " : " + (nd ? "NBR ET " + nd + " DIM" : "NBR SEUL") + " — DIM " + gone.join(", ") + " EFFACÉE(S).", 3500, inp);
          X.insSave();
          const tmp = document.createElement("tbody");
          tmp.innerHTML = X.insRowHTML("prd", r, 0);
          const nr = tmp.firstElementChild;
          if (tr.contains(document.activeElement)) document.activeElement.blur();
          const cur = tr.isConnected ? tr : shell.querySelector(`tr[data-ik="prd"][data-iid="${r.id}"]`);
          if (!cur || !cur.parentNode) return;
          try { cur.replaceWith(nr); } catch (err) { return; }
          X.insLive("prd", nr, r);
          setTimeout(() => { const nx = nr.querySelector('input[data-f="nbr"]'); if (nx && !document.activeElement?.closest("tr")) nx.focus(); }, 0);
        }
      });
      let lastRow = null;
      shell.addEventListener("focusin", e => {
        const inp = e.target.closest && e.target.closest(".ins-in");
        const X = shell.__ins;
        if (!inp || !X) return;
        const tr = inp.closest("tr[data-ik]");
        const prev = lastRow;
        lastRow = tr && tr.dataset.iid ? { k: tr.dataset.ik, id: tr.dataset.iid } : null;
        if (!prev || (tr && tr.dataset.ik === prev.k && tr.dataset.iid === prev.id)) return;
        const r = (X.INS[prev.k] || []).find(x => x.id === prev.id);
        const er = r && X.rowErr(prev.k, r);
        if (!er) return;
        const back = shell.querySelector(`tr[data-ik="${prev.k}"][data-iid="${prev.id}"] input[data-f="${er.f}"]`);
        if (!back || back.disabled) return;
        lastRow = prev;
        e.preventDefault();
        setTimeout(() => { back.focus(); svToast(er.m, 3500, back); }, 0);
      });
    }
    /* page unique : rond (choix de la chaîne), quantité de la tâche, ✓ VALIDER, DÉLIER */
    if (!shell.__fuseBound) {
      shell.__fuseBound = true;
      shell.addEventListener("click", e => {
        const X = shell.__fuse;
        if (!X) return;
        const ra = e.target.closest(".lk-rdall");
        if (ra) {
          e.stopPropagation(); e.preventDefault();
          if (ra.classList.contains("off")) return;
          X.allToggle(ra.dataset.rdall);
          return;
        }
        const rd = e.target.closest(".lk-rd");
        if (rd) {
          e.stopPropagation(); e.preventDefault();
          const k = rd.dataset.rd, id = rd.closest("[data-iid]")?.dataset.iid;
          if (!id) return;
          if (rd.closest(".lk-ban")) return;   /* ligne grisée : on ne peut pas la choisir (appui long = raison) */
          const L = X.LK, multi = k === "prd" || k === "chg";
          const chosen = multi ? L[k][id] !== undefined : L[k] === id;
          if (!multi && L[k] && !chosen) return;   /* une ligne déjà choisie : les autres attendent qu'on la libère */
          /* libérer la désignation avec une modification non validée : proposer de valider d'abord */
          if (k === "des" && chosen && X.pending()) { X.guard().then(ok => { if (ok) { L.des = null; L.lot = L.prim = L.sec = null; L.prd = {}; L.chg = {}; L.dlpDraft = null; X.light("des"); } }); return; }
          const pick = () => {
            if ((k === "prim" || k === "sec") && L[k] !== id) {
              const ra = X.ruleA(k, id);
              if (ra) { svToast(ra); return; }   /* refusé tout de suite */
            }
            if (k === "prd" && L[k][id] === undefined) {
              const bad = X.unitErr(id);
              if (bad) { svToast(bad); return; }   /* unité différente : refusé tout de suite */
            }
            if (multi) { if (L[k][id] !== undefined) delete L[k][id]; else L[k][id] = ""; }
            else {
              L[k] = L[k] === id ? null : id;      /* 2e toucher : le choix est libéré */
              if (k === "des" && !L.des) { L.lot = L.prim = L.sec = null; L.prd = {}; L.chg = {}; }
              if (k === "lot" && !L.lot) { L.prim = L.sec = null; }
              if (k === "prim" && !L.prim) { L.sec = null; }
            }
            L.err = "";
            X.light(k);
          };
          /* le rond ne fait que choisir / libérer ; délier passe par le bouton ✕ DÉLIER */
          pick();
          return;
        }
        if (e.target.closest("#insChain .lk-info")) { X.info(); return; }
        if (e.target.closest("#insChain .lk-go")) {
          X.commit();
          return;
        }
        const del = e.target.closest(".lk-del");
        if (del && !e.target.closest("#insLinkView")) {
          svConfirm({ title: "DÉLIER", text: "LA LIAISON SERA DÉFAITE ; LES LIGNES RESTENT DANS LE BUDGET.", ok: "DÉLIER" }).then(go => {
            if (!go) return;
            X.INS.links = (X.INS.links || []).filter(l => l.id !== del.dataset.lid);
            X.save("DÉLIER"); X.refresh();
          });
        }
      }, true);
      shell.addEventListener("change", e => {
        const X = shell.__fuse;
        const q = e.target.closest && e.target.closest("input.lk-q");
        if (!X || !q || e.target.closest("#insLinkView")) return;
        const id = q.closest("[data-iid]")?.dataset.iid;
        if (id && X.LK[q.dataset.qk][id] !== undefined) { X.LK[q.dataset.qk][id] = q.value.trim(); X.chain(); }
      });
    }
    /* briser la liaison d'une ligne, dans le contexte choisi (désignation, et lot / activités s'ils sont choisis) */
    const lkUnlink = (k, id) => {
      /* délier = modification de la liaison : à valider (✓ VALIDER), annulable (ABANDONNER) */
      if (!LK.linksBak) LK.linksBak = JSON.parse(JSON.stringify(INS.links || []));
      const lvl = { lot: 0, prim: 1, sec: 2, prd: 3, chg: 3 }[k];
      const hit = new Set(lkLinks(lvl).map(l => l.id));
      if (k === "prd" || k === "chg") {
        INS.links.forEach(l => { if (hit.has(l.id)) l[k] = (l[k] || []).filter(x => x.id !== id); });
        INS.links = INS.links.filter(l => (l.prd || []).length);
      } else INS.links = INS.links.filter(l => !(hit.has(l.id) && l[k] === id));
      LK.unlinked = (LK.unlinked || []).concat(lkName("des", LK.des) + " — " + lkName(k, id));
      refreshAll();
    };
    /* toucher un rond : on ne redessine que ce qui change (rapidité) */
    const lkLight = k => {
      keepScroll(() => {
        if ((k === "prd" || k === "chg") && !(INS.links || []).length) {
          /* produit / charge sans aucune liaison : le tableau seul est redessiné (la ligne choisie monte) */
          renderTab();
          insMarkUnlinked();
        } else {
          /* tout choix fait remonter, dans les autres blocs, les lignes qui lui sont liées */
          insRenderClient();
          insRenderHier();
          renderTab();   /* compteurs des onglets et tableau du détail (produits, charges, délais de la tâche choisie) */
          insMarkUnlinked();
        }
        insRenderChain();
      });
    };
    /* ✓ VALIDER LA LIAISON : nouvelle liaison, ajout de détails à une liaison existante, délais de la tâche */
    /* ✕ DÉLIER : fenêtre de confirmation (liaisons concernées, délais supprimés), puis destruction */
    const lkDestroy = pl => {
      const tag = l => [lkName("des", l.des), lkName("lot", l.lot), lkName("prim", l.prim), lkName("sec", l.sec)].join(" › ");
      const rem = pl.remP.length || pl.remC.length;
      const names = [...pl.remP.map(id => lkName("prd", id)), ...pl.remC.map(id => lkName("chg", id))];
      const ids = new Set(pl.links.map(l => l.id));
      /* liaisons après l'opération (un produit retiré : la liaison sans produit disparaît) */
      const after = (INS.links || []).map(l => !ids.has(l.id) ? l : (!rem || (pl.whole && pl.whole.has(l.id))) ? null
        : { ...l, prd: (l.prd || []).filter(x => !pl.remP.includes(x.id)), chg: (l.chg || []).filter(x => !pl.remC.includes(x.id)) })
        .filter(l => l && (l.prd || []).length);
      const gone = pl.links.filter(l => !after.some(a => a.id === l.id));
      /* délais des tâches secondaires qui n'ont plus aucune liaison */
      /* délais : indépendants des liaisons (planning possible avant les liaisons) — gardés */
      const dK = [];
      const nD = dK.reduce((t, k) => t + INS.dlp[k].length, 0);
      /* FORMAT 123 : résumé chiffré, pas de longue liste */
      const nDes = new Set(pl.links.map(l => l.des)).size;
      const html = `<div class="svc-sub"><b>${pl.links.length} LIAISON(S) ${rem ? "TOUCHÉE(S)" : "SERONT DÉLIÉES"}</b> (${nDes} DÉSIGNATION(S) CLIENT${rem ? ", " + names.length + " PRODUIT(S) / CHARGE(S) RETIRÉ(S)" + (gone.length ? ", " + gone.length + " LIAISON(S) SANS PRODUIT DÉLIÉE(S)" : "") : ""}).</div>
        <div class="svc-sub">LES LIGNES DÉLIÉES RESTENT DANS LEURS TABLEAUX (LIGNES NON LIÉES).</div>
        ${rem && names.length <= 5 ? `<div class="svc-sub">À RETIRER : ${esc(names.join(", "))}</div>` : ""}
${pl.links.length <= 5 ? `        <div class="svc-sub">${rem ? "DANS" : "LIAISONS DÉLIÉES"} ${svCnt(pl.links.length)} :</div>
        <ul class="svc-list">${pl.links.map(l => `<li>${esc(tag(l))}${rem && gone.includes(l) ? " <b>(PLUS AUCUN PRODUIT : DÉLIÉE)</b>" : ""}</li>`).join("")}</ul>` : ""}
        ${nD ? `<div class="svc-sub svc-warn">LES DATES DE ${nD} TÂCHE${nD > 1 ? "S" : ""} ${nD > 1 ? "SERONT SUPPRIMÉES" : "SERONT SUPPRIMÉES"}.</div>` : ""}`;
      return svConfirm({ title: rem ? "RETIRER DES LIAISONS" : "DÉLIER", html, ok: "✕ DÉLIER" }).then(go => {
        if (!go) return false;
        INS.links = after;
        dK.forEach(k => { delete INS.dlp[k]; });
        histLog("LIAISONS", "DÉLIER", (rem ? names.join(", ") + " — " : "") + pl.links.map(tag).join(" ; "));
        LK.prd = {}; LK.chg = {}; LK.lot = LK.prim = LK.sec = null; LK.dlpDraft = null; LK.all = {}; LK.allm = {};
        if (LK.des && !INS.des.some(x => x.id === LK.des)) LK.des = null;
        insSave();
        refreshAll();
        return true;
      });
    };
    const lkCommit = () => {
      const pl = lkPlan();
      if (pl.mode === "mix") { svToast("CHOISIR SOIT DES LIGNES À AJOUTER, SOIT DES LIGNES À DÉLIER (EN DEUX FOIS)."); return false; }
      if (pl.mode === "del") return lkDestroy(pl);
      const L = LK, hasNew = Object.keys(L.prd).length || Object.keys(L.chg).length;
      if (hasNew && L.des && L.lot && L.prim && L.sec) {
        const err = lkCheck();
        if (err) { svToast(err); return false; }
        INS.links = INS.links || [];
        /* FORMAT 117 : produit déjà lié à une autre tâche → nouvelle ligne pour cette tâche (mêmes quantités au départ) */
        { const tgt = INS.links.find(l => l.des === L.des && l.lot === L.lot && l.prim === L.prim && l.sec === L.sec);
          const re = {};
          Object.keys(L.prd).forEach(id => {
            if (!INS.links.some(l => l !== tgt && (l.prd || []).some(x => x.id === id))) { re[id] = L.prd[id]; return; }
            const p = INS.prd.find(x => x.id === id);
            if (!p) return;
            const c = { ...p, id: insId(), on: false };
            INS.prd.splice(INS.prd.indexOf(p) + 1, 0, c);
            re[c.id] = L.prd[id];
          });
          L.prd = re; }
        const ent = o => Object.keys(o).map(id => ({ id, q: "" }));
        const same = INS.links.find(l => l.des === L.des && l.lot === L.lot && l.prim === L.prim && l.sec === L.sec);
        if (same) {
          ent(L.prd).forEach(x => { if (!(same.prd || []).some(y => y.id === x.id)) (same.prd = same.prd || []).push(x); });
          ent(L.chg).forEach(x => { if (!(same.chg || []).some(y => y.id === x.id)) (same.chg = same.chg || []).push(x); });
        } else {
          if (!Object.keys(L.prd).length) { svToast("UNE LIAISON DOIT AVOIR AU MOINS UN PRODUIT."); return false; }
          INS.links.push({ id: insId(), des: L.des, lot: L.lot, prim: L.prim, sec: L.sec, prd: ent(L.prd), chg: ent(L.chg) });
        }
        L.prd = {}; L.chg = {};
      }
      if (lkDlyDirty()) {
        INS.dlp = INS.dlp || {};
        Object.keys(L.dlpDraft).forEach(k => { INS.dlp[k] = L.dlpDraft[k].map(p => ({ id: p.id, deb: p.deb || "", fin: p.fin || "" })); });
      }
      if (L.linksBak) {
        (L.unlinked || []).forEach(t => histLog("LIAISONS", "DÉLIER", t));
        L.linksBak = null; L.unlinked = null;
      }
      L.dlpDraft = null; L.err = "";
      /* après validation : seule la désignation reste choisie ; lot et activités repassent en « liés » (bleu) */
      L.lot = L.prim = L.sec = null;
      insSave(); histLog("LIAISONS", "LIAISON VALIDÉE", lkName("des", L.des));
      refreshAll();
      return true;
    };
    /* modification non validée : avant de passer à autre chose, on propose de valider */
    /* ce qui sera abandonné (consigne 27) : produits / charges à ajouter, délais modifiés, liaisons déliées */
    const lkPendingHTML = () => {
      const add = [...Object.keys(LK.prd || {}).map(id => lkName("prd", id)), ...Object.keys(LK.chg || {}).map(id => lkName("chg", id))];
      const out = [];
      if (add.length) out.push(`<div class="svc-sub">À AJOUTER :</div><ul class="svc-list">${add.map(n => `<li>${esc(n)}</li>`).join("")}</ul>`);
      if (lkDlyDirty()) out.push(`<div class="svc-sub">DÉLAIS MODIFIÉS</div>`);
      if ((LK.unlinked || []).length) out.push(`<div class="svc-sub">DÉLIÉES :</div><ul class="svc-list">${LK.unlinked.map(n => `<li>${esc(n)}</li>`).join("")}</ul>`);
      return out.join("");
    };
    const lkGuard = () => !lkPending() ? Promise.resolve(true)
      : svChoose({ title: "LIAISON EN COURS NON VALIDÉE", html: lkPendingHTML(),
          buttons: [{ v: "drop", label: "ABANDONNER", tone: "danger" }, { v: "ok", label: "✓ VALIDER", tone: "neutral" }] })
        .then(v => {
          if (v === "ok") return lkCommit();
          if (v === "drop") {
            LK.prd = {}; LK.chg = {}; LK.dlpDraft = null; LK.all = {}; LK.allm = {};
            LK.lot = LK.prim = LK.sec = null;
            if (LK.linksBak) { INS.links = LK.linksBak; LK.linksBak = null; LK.unlinked = null; insSave(); }
            return true;
          }
          return false;
        });
    shell.__lkGuard = INS && INS_EDIT ? lkGuard : null;
    /* rond d'en-tête : 1er toucher = choisir toutes les lignes déjà liées du bloc ; 2e = tout libérer */
    const lkAllToggle = k => {
      LK.all = LK.all || {}; LK.allm = LK.allm || {};
      if (k === "prd" || k === "chg") {
        if (LK.allm[k]) { LK[k] = {}; LK.allm[k] = false; }
        else { insShown(k).filter(r => !r.t && lkAllLinked(k, r.id)).forEach(r => { LK[k][r.id] = ""; }); LK.allm[k] = Object.keys(LK[k]).length > 0; }
      } else {
        LK.all[k] = !LK.all[k];
        if (LK.all[k]) LK[k] = null;
      }
      lkLight(k);
    };
    shell.__fuse = INS && INS_EDIT ? { INS, LK, insId, check: lkCheck, allToggle: k => lkAllToggle(k), chain: () => insRenderChain(), refresh: () => refreshAll(),
      commit: () => lkCommit(), guard: () => lkGuard(), pending: () => lkPending(), ruleA: (k, id) => lkRuleA(k, id),
      light: k => lkLight(k), unlink: (k, id) => lkUnlink(k, id), name: (k, id) => lkName(k, id),
      unitErr: id => {
        const D = INS.des.find(x => x.id === LK.des), P = INS.prd.find(x => x.id === id);
        const du = String((D && D.u) || "").trim().toUpperCase(), pu = String((P && P.u) || "").trim().toUpperCase();
        return du && pu && du !== pu && LK.prim && LK.sec && insIsPrimLink(LK.prim, LK.sec) ? "UNITÉ REFUSÉE : " + (P.des || "") + " (" + pu + ") N'A PAS L'UNITÉ DE LA DÉSIGNATION (" + du + ")." : "";
      },
      info: () => {
        /* fenêtre au format INF : titre, ✕, libellés à gauche, état de la liaison, produits et charges, FERMER */
        document.getElementById("docPop")?.remove();
        const n = (k, id) => esc(lkName(k, id) || "—");
        const same = LK.des && LK.lot && LK.prim && LK.sec
          && (INS.links || []).find(l => l.des === LK.des && l.lot === LK.lot && l.prim === LK.prim && l.sec === LK.sec);
        const st = same ? "LIAISON DÉJÀ ÉTABLIE" + (Object.keys(LK.prd).length || Object.keys(LK.chg).length || lkDlyDirty() || LK.linksBak ? " — MODIFICATIONS À VALIDER" : "")
          : LK.des && LK.lot && LK.prim && LK.sec ? "NOUVELLE LIAISON — À VALIDER" : "LIAISON INCOMPLÈTE";
        /* tableaux de la fenêtre : tri / filtre sur chaque colonne (consigne 7) */
        const list = k => [...(same ? (same[k] || []).map(x => ({ id: x.id, st: "LIÉ" })) : []), ...Object.keys(LK[k]).map(id => ({ id, st: "À AJOUTER" }))]
          .map(o => { const r = INS[k].find(x => x.id === o.id) || {}; return { des: r.des || "", u: r.u || "", q: k === "prd" ? insPrdQ(r) : num(r.q || 0), st: o.st }; });
        const C = k => [["des", k === "prd" ? "DÉSIGNATION PRODUIT" : "DÉSIGNATION CHARGE", x => x.des, ""], ["u", k === "prd" ? "UPB" : "UCB", x => x.u, "center"],
          ["q", k === "prd" ? "QPB" : "QCB", x => x.q, "number"], ["st", "ÉTAT", x => x.st, "center"]];
        const tbl = (k, lab) => {
          const t = "lki_" + k, rows = cfApply(t, C(k), list(k));
          return `<div class="doc-lab" style="margin-top:12px">${lab} ${svCnt(rows.length)}</div>
            <table class="bdg-d-table" style="width:100%;margin-top:6px"><thead><tr>${C(k).map(c => cfHead(t, c[0], c[1], c[3])).join("")}</tr></thead>
            <tbody>${rows.map(x => `<tr>${C(k).map(c => `<td class="${c[3]}">${c[0] === "q" ? insFmt(x.q) : esc(c[2](x))}</td>`).join("")}</tr>`).join("")
              || `<tr><td colspan="4" class="empty">AUCUNE LIGNE</td></tr>`}</tbody></table>`;
        };
        const p = document.createElement("div");
        p.id = "docPop";
        p.innerHTML = `<div class="doc-card" role="dialog" aria-modal="true" style="max-width:760px">
            <div class="doc-head"><span class="doc-title">LIAISON EN COURS</span><button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button></div>
            <div class="doc-body">
              <div class="lk-info-st${same ? " ok" : ""}">${st}</div>
              <div class="doc-grid">
                <span class="doc-lab">DÉSIGNATION</span><span class="lk-info-v">${n("des", LK.des)}</span>
                <span class="doc-lab">LOT</span><span class="lk-info-v">${n("lot", LK.lot)}</span>
                <span class="doc-lab">ACTIVITÉ PRIMAIRE</span><span class="lk-info-v">${n("prim", LK.prim)}</span>
                <span class="doc-lab">ACTIVITÉ SECONDAIRE</span><span class="lk-info-v">${n("sec", LK.sec)}</span>
              </div>
              <div class="lk-info-t">${tbl("prd", "DÉTAIL PRODUITS")}${tbl("chg", "DÉTAIL CHARGES")}</div>
            </div>
            <div class="doc-foot"><span></span><button type="button" class="doc-btn" data-cancel>FERMER</button></div>
          </div>`;
        document.body.appendChild(p);
        try { popEnhance(p, "lkinfo"); } catch (e) {}
        p.addEventListener("click", e => {
          const cfb = e.target.closest(".cf-btn");
          if (cfb) { e.stopPropagation(); cfOpenMenu(cfb); return; }
          if (e.target === p || e.target.closest("[data-cancel]")) { p.remove(); window.__sviInfoRefresh = null; }
        });
        window.__sviInfoRefresh = () => { const b = p.isConnected && p.querySelector(".lk-info-t"); if (b) b.innerHTML = tbl("prd", "DÉTAIL PRODUITS") + tbl("chg", "DÉTAIL CHARGES"); };
      },
      isLinked: (k, id) => { const S = lkLinked(); return !!(S[k] && S[k].has(id)); },
      save: what => { insSave(); histLog("LIAISONS", what, fullRef); } } : null;
    /* bascule SAISIE / LIAISONS */
    const insApplyMode = () => {
      if (!INS) return;
      shell.classList.remove("ins-mode-link");
      insRenderChain();
      insMarkUnlinked();
    };

    const renderClient = () => {
      if (INS) { insRenderClient(); return; }
      const groupsMap = new Map();

      const U = v => String(v ?? "").trim().toUpperCase();
      const lineUnit = l => U(l.dunit) || U(l.unit);

      clientLines().forEach(l => {
        const key = desigKey(l);

        if (!groupsMap.has(key)) {
          groupsMap.set(key, {
            key,
            article: l.article,
            designation: l.designation,
            unit: l.unit,
            qty: 0,
            ht: 0,
            price: 0,
            members: []
          });
        }

        groupsMap.get(key).members.push(l);
      });

      groupsMap.forEach(g => {
        /* clé primaire = ligne PRODUIT au prix non nul (cherchée sur toutes
           les lignes de la désignation, même hors filtre) : elle donne le
           prix et l'unité de la désignation client (col. Q, sinon col. J) */
        const k = lines.find(l =>
          desigKey(l) === g.key &&
          l.kind === "prd" &&
          l.cprice !== 0
        );

        if (k) {
          g.price = k.cprice / 1.2;   /* prix de la feuille TTC → HT */
          g.unit = k.dunit || k.unit || g.unit;
        }

        /* quantité = somme des CLÉS PRIMAIRES uniquement : lignes PRODUIT
           au prix non nul. Les clés secondaires (prix nul : coffrage,
           ferraillage…) ne sont pas comptées, même dans la même unité */
        g.members.forEach(l => {
          if (l.kind === "prd" && l.cprice !== 0) g.qty += l.qty;
        });
        g.ht = g.qty * g.price;
      });

      const base = [...groupsMap.values()].sort((x, y) =>
        String(x.article).localeCompare(
          String(y.article),
          undefined,
          { numeric: true }
        )
      );

      const ccols = [
        ["article", "ART", g => g.article, "center"],
        ["designation", "DÉSIGNATION", g => g.designation, ""],
        ["unit", "UPB", g => g.unit, "center"],
        ["qty", "QPB", g => g.qty, "number"],
        ["price", "PPB", g => g.price, "number"],
        ["ht", "MPB HT", g => g.ht, "number"],
        ["tva", "TVA", () => "20,00 %", "number"],
        ["ttc", "MPB TTC", g => g.ht * 1.2, "number"]
      ];

      const shownClient = roApply("client", cfApply("client", ccols, base), g => g.key);
      lastClientKeys = new Set(shownClient.map(g => g.key));
      lastShown.client = { cols: ccols, rows: shownClient };
      /* compteur du titre : lignes affichées (filtres compris) */
      { const t = document.querySelector("#bdgClientTitle .ttl");
        if (t) t.innerHTML = SVI_ICON.client + "DÉSIGNATIONS CLIENT " + svCnt(shownClient.length, base.length); }
      const list = shownClient.sort((x, y) =>
        selDesig.has(y.key) - selDesig.has(x.key)
      );

      $("bdgClientCols").innerHTML = cwCols("client", ccols);
      $("bdgClientHead").closest("table").style.width =
        cwTableW("client", ccols) + "px";
      setTimeout(clientFit, 0);

      $("bdgClientHead").innerHTML =
        "<tr>" + ccols.map(([k, lab, , cls]) => cfHead("client", k, lab, cls)).join("") + "</tr>";

      const MIN_ROWS = 10;

      const filler = n =>
        Array.from({ length: Math.max(0, n) }, () =>
          `<tr class="bdg-d-filler">${"<td>&nbsp;</td>".repeat(8)}</tr>`
        ).join("");

      $("bdgClientBody").innerHTML =
        (list.length
          ? list.map(g => {
              const ht = g.ht;


              return `
                <tr data-desig="${esc(g.key)}"
                    class="${selDesig.has(g.key) ? "selected" : ""}">
                  <td class="center">${esc(g.article)}</td>
                  <td>${esc(g.designation)}</td>
                  <td class="center">${esc(g.unit)}</td>
                  <td class="number">${money(g.qty)}</td>
                  <td class="number">${money(g.price)}</td>
                  <td class="number">${money(ht)}</td>
                  <td class="number">20,00 %</td>
                  <td class="number">${money(ht * 1.2)}</td>
                </tr>
              `;
            }).join("")
          : `<tr><td colspan="8" class="empty">AUCUNE DÉSIGNATION</td></tr>` +
            "");

      const cHT = list.reduce((t, g) => t + g.ht, 0);
      const cUnits = new Set(list.map(g => String(g.unit ?? "").trim().toUpperCase()));
      const cQty = list.length && cUnits.size === 1
        ? money(list.reduce((t, g) => t + g.qty, 0))
        : "";
      $("bdgClientFoot").innerHTML = `
        <tr class="bdg-d-total-row">
          <td></td><td></td><td></td><td class="number">${cQty}</td>
          <td class="number">TOTAL</td>
          <td class="number">${money(cHT)}</td>
          <td class="number">${money(cHT * 0.2)}</td>
          <td class="number">${money(cHT * 1.2)}</td>
        </tr>`;
      coApply("client", $("bdgClientHead").closest("table"));
    };

    const uniq = arr =>
      [...new Set(arr.filter(v => String(v).trim() !== ""))]
        .sort((x, y) =>
          String(x).localeCompare(String(y), undefined, { numeric: true })
        );

    /* filtre dans tous les sens : chaque colonne affiche les valeurs
       des lignes qui respectent TOUS les AUTRES filtres (désignations,
       lots, primaires, secondaires) ; plusieurs choix = union */
    const passes = (l, skip) => {
      const d = new Set([...selDesig, ...rowSet(desigKey)]);
      return (
        inSet(d, desigKey(l)) &&
        inSet(rowSet(x => x.lot), l.lot) &&
        inSet(rowSet(x => x.prim), l.prim) &&
        inSet(rowSet(x => x.sec), l.sec) &&
        (skip === "lot"  || inSet(hSel.lot, l.lot)) &&
        (skip === "prim" || inSet(hSel.prim, l.prim)) &&
        (skip === "sec"  || inSet(hSel.sec, l.sec)) &&
        cons(l, skip)
      );
    };

    const hierLists = () => ({
      lots:  uniq(lines.filter(l => passes(l, "lot")).map(l => l.lot)),
      prims: uniq(lines.filter(l => passes(l, "prim")).map(l => l.prim)),
      secs:  uniq(lines.filter(l => passes(l, "sec")).map(l => l.sec))
    });

    /* retire des filtres les éléments devenus invisibles
       (répété jusqu'à stabilité) */
    const pruneHier = () => {
      for (let guard = 0; guard < 5; guard++) {
        const h = hierLists();
        let changed = false;
        const drop = (set, list) => [...set].forEach(v => {
          if (!list.includes(v)) { set.delete(v); changed = true; }
        });
        drop(hSel.lot, h.lots);
        drop(hSel.prim, h.prims);
        drop(hSel.sec, h.secs);
        if (!changed) break;
      }
    };

    const renderHier = () => {
      if (INS) { insRenderHier(); return; }
      const { lots, prims, secs } = hierLists();

      const hFill = n =>
        `<div class="bdg-h-fill"></div>`.repeat(Math.max(0, n));

      const col = (title, level, all) => {
        const hcols = [["v", title, v => stripLevelPrefix(v), ""]];
        /* ordre par défaut : champ ORDRE du BDS (inconnus à la fin) */
        const src = { lot: db.lots, prim: db.primaries, sec: db.secondaries }[level] || [];
        const ordOf = new Map();
        src.forEach(x => {
          const k = stripLevelPrefix(x.name).trim().toUpperCase();
          if (k && !ordOf.has(k)) ordOf.set(k, Number(x.order) || 0);
        });
        const ord = v => {
          const o = ordOf.get(String(v).trim().toUpperCase());
          return o === undefined ? Infinity : o;
        };
        const byOrder = [...all].sort((a, b) => ord(a) - ord(b));
        const items = roApply(level, cfApply(level, hcols, byOrder), v => v);
        lastShown.hier[level] = items.map(v => stripLevelPrefix(v));
        items.sort((x, y) =>
          hSel[level].has(y) - hSel[level].has(x)
        );
        const st = cfT(level);
        /* lots / activités : bleu seulement si filtre ou toucher, jamais pour un tri */
        const on = st.f.v || hSel[level].size;
        return `
        <div class="bdg-h-col">
          <div class="bdg-h-head ${on ? "cf-on" : ""}"><span class="cf-wrap"><span class="cf-lab">${title}${svCnt(items.length, all.length)}</span><span class="cf-btn"
            data-cf="${level}" data-col="v" role="button" aria-label="Trier / filtrer">${cfIcon}</span></span><span
            class="col-rs" data-rs="hier" data-col="${level}"></span></div>
          ${
            items.length
              ? items.map(v => `
                  <div class="bdg-h-item ${hSel[level].has(v) ? "selected" : ""}"
                       data-h="${level}"
                       data-v="${esc(v)}"
                       title="${esc(stripLevelPrefix(v))}">${esc(stripLevelPrefix(v))}</div>
                `).join("")
              : `<div class="bdg-h-item" style="opacity:.5;cursor:default">—</div>`
          }
        </div>
      `;
      };

      {
        const w = cwLoad();
        const ws = coKeys("hierCols", ["lot", "prim", "sec"]).map(k => w["hier." + k]);
        $("bdgHier").style.gridTemplateColumns =
          ws.every(Boolean) && window.innerWidth > 650
            ? ws.map(x => x + "px").join(" ")
            : "";
      }

      const hdef = {
        lot: ["LOT", lots], prim: ["ACTIVITÉ PRIMAIRE", prims], sec: ["ACTIVITÉ SECONDAIRE", secs]
      };
      $("bdgHier").innerHTML = coKeys("hierCols", ["lot", "prim", "sec"])
        .map(k => col(hdef[k][0], k, hdef[k][1])).join("");

      /* plus de texte « FILTRES : … » dans le titre du bloc */
    };

    /* garde la vue là où l'utilisateur a la main : page et cadres
       à défilement interne (désignations, lots/tâches, détail) */
    const keepScroll = fn => {
      const sel = ".bdg-d-client-scroll, .bdg-h-col, .bdg-d-tabbody .bdg-d-scroll, .bdg-d-tabbody .dlyg-l, .bdg-d-tabbody .dlyg-r";
      /* FORMAT : un tableau redessiné ne fait jamais bouger l'écran (vertical ET horizontal) */
      /* redessins enchaînés : on garde la position d'avant le premier (pas celle, provisoire, d'entre deux) */
      const P = keepScroll.pend && performance.now() < keepScroll.pend.until ? keepScroll.pend : null;
      const saved = P ? P.saved : [...shell.querySelectorAll(sel)].map(el => [el.scrollTop, el.scrollLeft]);
      const toTop = keepScroll.toTop || (P ? P.toTop : false); keepScroll.toTop = false;
      const x = P ? P.x : window.scrollX, y = P ? P.y : window.scrollY;
      keepScroll.pend = { saved, toTop, x, y, until: performance.now() + 200 };
      const active = document.activeElement;
      if (active && active.blur &&
          !active.classList.contains("bdg-tva-input") &&
          !active.closest("#cfMenu")) {
        active.blur();
      }

      fn();

      const restore = () => {
        shell.querySelectorAll(sel).forEach((el, i) => {
          if (saved[i] === undefined) return;
          /* après un filtre : si la partie regardée n'existe plus, premières lignes retenues */
          el.scrollTop = toTop && saved[i][0] > el.scrollHeight - el.clientHeight ? 0 : saved[i][0];
          el.scrollLeft = saved[i][1];
        });
        window.scrollTo(x, y);
      };
      restore();
      requestAnimationFrame(restore);
      /* un tableau qui s'élargit juste après (largeur des en-têtes) : position remise avant l'affichage */
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(restore);
        shell.querySelectorAll(sel).forEach(el => [...el.children].forEach(c => ro.observe(c)));
        setTimeout(() => ro.disconnect(), 200);
      }
      /* mises en page tardives (largeurs d'en-tête, onglets) : position remise encore une fois */
      setTimeout(() => { restore(); }, 120);
      setTimeout(() => { if (keepScroll.pend && performance.now() >= keepScroll.pend.until) keepScroll.pend = null; }, 220);
    };

    /* titre en bleu quand le bloc est filtré (toucher de ligne
       ou filtre / tri de colonne) */
    const cfActive = t => {
      const st = CF[t];
      return !!st && Object.keys(st.f).length > 0;
    };
    const markFiltered = () => {
      const rowsOf = kind =>
        [...selRows].some(g => g.startsWith(kind.toUpperCase() + "|"));
      shell.querySelectorAll("#bdgTabs .bdg-d-tab").forEach(b => {
        const t = b.dataset.tab;
        /* bleu de l'onglet : seulement un choix de lignes (budget validé), pas le filtre (loupe) */
        b.classList.toggle("cf-on", !INS && (t === "chg" || t === "prd") && rowsOf(t));
      });
      $("bdgClientTitle")?.classList.toggle("cf-on", !INS && selDesig.size > 0);
      sviMarkEmptyTabs(shell);
    };

    const refreshAll = () => {
      keepScroll(() => {
        computeCons(false);
        pruneHier();

        renderClient();
        computeCons();
        renderHier();
        renderTab();
        markFiltered();
        REC_KINDS.forEach(renderRec);
        if (window.__sviHistRefresh) window.__sviHistRefresh();
        if (window.__sviImpRefresh) window.__sviImpRefresh();
        if (window.__sviDpkRefresh) window.__sviDpkRefresh();
        if (window.__sviInfoRefresh) window.__sviInfoRefresh();
        if (INS) insApplyMode();
      });
      if (typeof stateSave === "function") stateSave();
    };

    const tvaFor = l =>
      l.ttcAmount !== undefined ? l.ttcAmount - l.amount : l.amount * l.tva / 100;

    /* ligne TOTAL en pied des onglets Détail charge / produit */
    const tabFootHTML = (list, prd) => {
      /* produits : la quantité totale ne compte que les clés primaires
         (lignes au prix non nul), comme dans les désignations client */
      const qty = list.reduce((t, l) =>
        t + (prd && !l.priceTTC ? 0 : l.qty), 0);
      const ht = list.reduce((t, l) => t + l.amount, 0);
      const tva = list.reduce((t, l) => t + tvaFor(l), 0);
      const lead = prd ? 6 : 2;   /* colonnes avant « TOTAL » */
      /* quantité (et prix moyen) seulement si toutes les unités sont identiques */
      const units = new Set(list.map(l => String(l.dunit ?? "").trim().toUpperCase()));
      const sameUnit = list.length > 0 && units.size === 1;
      return `
        <tr class="bdg-d-total-row">
          ${
            sameUnit
              ? `${"<td></td>".repeat(lead)}
                 <td class="number">TOTAL</td>
                 <td class="number">${money(qty)}</td>
                 <td class="number">${money(qty ? ht / qty : 0)}</td>`
              /* unités différentes : « TOTAL » juste avant le montant HT */
              : `${"<td></td>".repeat(lead + 2)}
                 <td class="number">TOTAL</td>`
          }
          <td class="number">${money(ht)}</td>
          <td class="number" id="bdgFtTVA">${money(tva)}</td>
          <td class="number" id="bdgFtTTC">${money(ht + tva)}</td>
        </tr>`;
    };

    const totalsHTML = list => {
      const ht =
        list.reduce((t, l) => t + l.amount, 0);

      const tva =
        list.reduce((t, l) => t + tvaFor(l), 0);

      return `
        <div class="bdg-d-totals">
          <div class="bdg-d-total-ttc">
            <span>MONTANT TTC</span>
            <strong id="bdgTotTTC">${money(ht + tva)}</strong>
          </div>
        </div>
      `;
    };

    const tcolsFor = prd => [
      /* détail produits : pas de colonne ART (FORMAT 6) */
      ...(prd ? [] : [["article", "ART", l => l.article, "center"]]),
      ["detail", prd ? "DÉSIGNATION PRODUIT" : "DÉSIGNATION CHARGE", l => l.detail, ""],
      ["unit", prd ? "UPB" : "UCB", l => l.unit, "center"],
      ...(prd ? [
        ["nbr", "NBR", l => String(l.nbr ?? ""), "number"],
        ["d1", "DIM 1", l => String(l.dims[0] ?? ""), "number"],
        ["d2", "DIM 2", l => String(l.dims[1] ?? ""), "number"],
        ["d3", "DIM 3", l => String(l.dims[2] ?? ""), "number"]
      ] : []),
      ["qty", prd ? "QPB" : "QCB", l => l.qty, "number"],
      ["price", prd ? "PPB" : "PCB", l => l.price, "number"],
      ["amount", prd ? "MPB HT" : "MCB HT", l => l.amount, "number"],
      ["tva", "TVA %", l => String(l.tva ?? ""), "number"],
      ["ttc", prd ? "MPB TTC" : "MCB TTC", l => l.amount + l.tvaAmt, "number"]
    ];

    /* recalcule les contraintes propagées par les filtres de colonne */
    const computeCons = (withClient = true) => {
      const has = t => CF[t] && Object.keys(CF[t].f).length > 0;
      CONS.client = withClient && has("client") ? new Set(lastClientKeys) : null;

      let det = null;
      ["chg", "prd"].forEach(kind => {
        if (!has(kind)) return;
        const all = lines.filter(l => l.kind === kind);
        const shown = cfApply(kind, tcolsFor(kind === "prd"), groupLines(all), true);
        det = det || { d: new Set(), lot: new Set(), prim: new Set(), sec: new Set() };
        shown.forEach(g => g.members.forEach(l => {
          det.d.add(desigKey(l));
          if (String(l.lot).trim()) det.lot.add(l.lot);
          if (String(l.prim).trim()) det.prim.add(l.prim);
          if (String(l.sec).trim()) det.sec.add(l.sec);
        }));
      });
      CONS.det = det;

      CONS.h = {};
      ["lot", "prim", "sec"].forEach(lv => {
        if (CF[lv] && CF[lv].f.v) CONS.h[lv] = CF[lv].f.v;
      });
    };

@endverbatim
