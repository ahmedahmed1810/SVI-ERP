    /* =========================================================
       DÉTAIL QUALITÉ (cahier, section Qualité ; FORMAT, section U, points 102 à 112) — v438
       INS.qq = { M: [nœuds du MODÈLE COMMUN], T: { "lot|sec": [nœuds de la tâche] }, ext: [essais externes], per: { clé: personnel } }
       nœud = { id, k: "t" (titre) | "p" (point de contrôle) | "c" (critère), d: niveau, v: intitulé, f: replié, on: coché, …champs du critère }
       ========================================================= */
    const QQ_M = ["MATIÈRE", "MAIN D'ŒUVRE", "MATÉRIEL", "MÉTHODE", "MILIEU", "MESURE"];
    const QQ_LISTS = {
      how: ["VISUEL", "MESURE", "ESSAI", "ÉPREUVE"],
      who: ["INTÉRIEUR", "INTERNE", "EXTERNE", "EXTÉRIEUR"],
      proof: ["VERBAL", "PHOTO", "PV", "RAPPORT DE LABORATOIRE"],
      nc: ["ARRÊT", "TAF", "RIEN"],
      niv: ["OUVRIER", "APPRENTI", "STAGIAIRE", "QUALIFIÉ"],
      sec: ["ACCUEIL SÉCURITÉ", "PORT DES EPI", "ACCUEIL SÉCURITÉ + PORT DES EPI"]
    };
    /* actions prévues : branchées plus tard sur les vrais boutons (cahier, Qualité, Déclenchement) */
    const QQ_BTNS = ["RÉCEPTION › ENREGISTRER", "LIVRAISON › ENREGISTRER", "COMMANDE › VALIDER", "TRANSFORMATION › ENREGISTRER",
      "CHANTIER › DÉBUT DE TÂCHE", "CHANTIER › FIN DE TÂCHE", "CHANTIER › COULAGE", "ATTACHEMENT › VALIDER", "FACTURATION › VALIDER"];
    const QQ_WARN = ["MAÎTRE D'OUVRAGE", "LABORATOIRE EXTÉRIEUR", "BUREAU DE CONTRÔLE", "ARCHITECTE", "BUREAU D'ÉTUDES"];
    /* FORMAT 104 : colonnes d'un critère (la 1re colonne, en arborescence, porte le titre, le point ou le CRITÈRE) */
    const QQ_COLS = [
      ["ev", "ÉLÉMENT VISÉ", 170, "pick"], ["pr", "PRESCRIPTION", 200, "txt"], ["ref", "RÉFÉRENCE", 130, "txt"],
      ["how", "COMMENT", 100, "pick"], ["who", "PAR QUI", 110, "pick"], ["proof", "PAR QUOI", 150, "pick"],
      ["dec", "DÉCLENCHEMENT", 210, "win"], ["app", "APPEL", 180, "win"], ["nc", "SI NON CONFORME", 130, "pick"],
      ["tol", "TOLÉRANCE", 100, "txt"], ["lrm", "LIMITE REMARQUE", 110, "txt"], ["nra", "REMARQUES AVANT AUDIT", 120, "num"],
      /* FORMAT 131 (v489) : contrôles de suite sans remarque, après un audit soldé, pour remettre le compteur à zéro */
      ["nrz", "CONTRÔLES SANS REMARQUE", 130, "num"]
    ];
    const QQ_TREE_W = 300;
    const qqData = () => {
      INS.qq = INS.qq || {};
      const Q = INS.qq;
      Q.T = Q.T || {}; Q.ext = Q.ext || []; Q.per = Q.per || {};
      return Q;
    };
    /* FORMAT 102 : titres par défaut — les interfaces, et les 6 M sous CHANTIER */
    const qqDefault = () => {
      const n = [], t = (v, d) => n.push({ id: insId(), k: "t", d, v, def: 1 });
      t("CHANTIER", 0); QQ_M.forEach(m => t(m, 1)); t("FACTURATION", 0);
      return n;
    };
    const qqKey = () => insDlyKey() || "";   /* "" = MODÈLE COMMUN */
    const qqList = key => {
      const Q = qqData();
      if (!key) { if (!Q.M) { if (!INS_EDIT) return qqDefault(); Q.M = qqDefault(); } return Q.M; }
      if (!Q.T[key]) { if (!INS_EDIT) return qqDefault(); Q.T[key] = qqDefault(); }
      return Q.T[key];
    };
    const qqEnd = (L, i) => { let j = i + 1; while (j < L.length && L[j].d > L[i].d) j++; return j; };
    const qqHasPts = (L, i) => L.slice(i + 1, qqEnd(L, i)).some(x => x.k !== "t");
    const qqHasSubT = (L, i) => L.slice(i + 1, qqEnd(L, i)).some(x => x.k === "t");
    const qqCrit = L => (L || []).filter(x => x.k === "c");
    const qqCount = key => qqCrit(key === undefined ? qqList(qqKey()) : qqList(key)).length;
    /* tâche (clé « lot|sec ») : ses produits et charges, pour ÉLÉMENT VISÉ et la fréquence par quantité */
    const qqElems = key => {
      if (!key) return [];
      const [lo, se] = key.split("|"), out = [], seen = new Set();
      (INS.links || []).filter(l => l.lot === lo && l.sec === se).forEach(l => ["prd", "chg"].forEach(k => (l[k] || []).forEach(x => {
        const r = INS[k].find(y => y.id === x.id);
        if (!r || seen.has(k + ":" + r.id)) return;
        seen.add(k + ":" + r.id);
        out.push({ v: k + ":" + r.id, k, r, lab: (k === "prd" ? "PRODUIT · " : "CHARGE · ") + U_(r.des) + (r.u ? " (" + U_(r.u) + ")" : "") });
      })));
      return out;
    };
    const qqEvLab = (key, v) => {
      if (!v) return "";
      if (v === "T") return "TÂCHE (GÉNÉRAL)";
      if (v === "P*") return "TOUS LES PRODUITS";
      if (v === "C*") return "TOUTES LES CHARGES";
      const [k, id] = String(v).split(":"), r = (INS[k] || []).find(x => x.id === id);
      return r ? (k === "prd" ? "PRODUIT · " : "CHARGE · ") + U_(r.des) + (r.u ? " (" + U_(r.u) + ")" : "") : "";
    };
    const qqEvQty = v => {
      const [k, id] = String(v || "").split(":"), r = (INS[k] || []).find(x => x.id === id);
      if (!r || (k !== "prd" && k !== "chg")) return null;
      const q = Number(insCalc(k, r, "q")) || 0;
      return { q, u: U_(r.u) };
    };
    const qqDur = key => { if (!key) return 0; const a = dlyDeb(key), b = dlyFin(key); return a && b ? Number(dDur(a, b)) || 0 : 0; };
    const qqSeuil = (key, pv) => {
      const d = qqDur(key), p = Number(String(pv ?? "").replace(",", ".")) || 0;
      if (!p) return "";
      if (!key) return "SEUIL CALCULÉ SUR LA DURÉE DE CHAQUE TÂCHE";
      if (!d) return "SEUIL CALCULÉ QUAND LA TÂCHE AURA SES DATES";
      const s = Math.max(0, Math.round((1 - p / d) * 100));
      return s <= 0 ? "APPEL DÈS LE DÉBUT DE LA TÂCHE" : "APPEL À " + s + " % DE LA QUANTITÉ RÉALISÉE";
    };
    const qqDecLab = (key, n) => {
      const b = (n.btn || []).join(" · "), fq = Number(n.fq) || 0;
      let f = "";
      if (fq) { const e = qqEvQty(n.ev); f = "1/" + insFmt(fq).replace(/,00$/, "") + (e && e.u ? " " + e.u : ""); }
      return [b, f].filter(Boolean).join(" · ");
    };
    const qqAppLab = n => n.pv ? insFmt(n.pv).replace(/,00$/, "") + " J" + (n.pw ? " · " + n.pw : "") : "";
    /* tâches qui portent un point d'arrêt (FORMAT 107 : ■ sur le Gantt) — modèle commun compris */
    const qqArret = key => {
      const Q = INS.qq;
      if (!Q) return false;
      const has = L => (L || []).some(x => x.k === "c" && x.nc === "ARRÊT");
      return has(Q.T && Q.T[key]) || has(Q.M);
    };
    /* FORMAT 111 (v488) : contrôles ajoutés d'office — charge avec AGRÉMENT EXIGÉ → « AGRÉMENT FOURNI » sous MATIÈRE ;
       charge avec QUALIFICATION EXIGÉE → « HABILITATION VÉRIFIÉE » sous MAIN D'ŒUVRE, dans chaque tâche où la charge est liée.
       Fond gris, non supprimables à la main tant que la case reste remplie ; retirés d'office quand elle est vidée ou la charge déliée. */
    const QQ_AUTO = {
      agr: { t: "MATIÈRE", p: c => "AGRÉMENT FOURNI — " + U_(c.des), c: () => "AGRÉMENT FOURNI ET EN COURS DE VALIDITÉ", btn: "RÉCEPTION › ENREGISTRER", why: c => "AJOUTÉ D'OFFICE : AGRÉMENT EXIGÉ SUR LA CHARGE " + U_(c.des) + " (DÉTAIL CHARGES). DÉCOCHER LA CASE POUR LE RETIRER." },
      qex: { t: "MAIN D'ŒUVRE", p: c => "HABILITATION VÉRIFIÉE — " + U_(c.des), c: c => "QUALIFICATION : " + U_(c.qex), btn: "CHANTIER › DÉBUT DE TÂCHE", why: c => "AJOUTÉ D'OFFICE : QUALIFICATION EXIGÉE (" + U_(c.qex) + ") SUR LA CHARGE " + U_(c.des) + " (DÉTAIL CHARGES). VIDER LA CASE POUR LE RETIRER." }
    };
    const qqAutoWhy = n => { const c = n && n.auto && INS.chg.find(x => x.id === n.cid); return c && QQ_AUTO[n.auto] ? QQ_AUTO[n.auto].why(c) : ""; };
    const qqAutoSync = () => {
      if (!INS || !INS_EDIT) return false;
      const Q = qqData(); let ch = false;
      const want = {};   /* clé tâche → [{ a: "agr" | "qex", c }] */
      (INS.links || []).forEach(l => (l.chg || []).forEach(x => {
        const c = INS.chg.find(y => y.id === x.id); if (!c || c.t) return;
        const key = l.lot + "|" + l.sec;
        ["agr", "qex"].forEach(a => { if (a === "agr" ? !!c.agr : !!U_(c.qex)) { const w = want[key] = want[key] || []; if (!w.some(z => z.a === a && z.c === c)) w.push({ a, c }); } });
      }));
      const keys = new Set([...Object.keys(want), ...Object.keys(Q.T).filter(k => (Q.T[k] || []).some(n => n.auto))]);
      keys.forEach(key => {
        const W = want[key] || [];
        if (!Q.T[key]) { if (!W.length) return; Q.T[key] = qqDefault(); ch = true; }
        const L = Q.T[key];
        /* contrôles d'office devenus sans objet : retirés (point et ses critères) */
        for (let i = L.length - 1; i >= 0; i--) {
          const n = L[i];
          if (n.k !== "p" || !n.auto) continue;
          const c = W.find(z => z.a === n.auto && z.c.id === n.cid);
          if (!c) { L.splice(i, qqEnd(L, i) - i); ch = true; continue; }
          const A = QQ_AUTO[n.auto], v = A.p(c.c), cv = A.c(c.c);
          if (n.v !== v) { n.v = v; ch = true; }
          L.slice(i + 1, qqEnd(L, i)).forEach(x => { if (x.auto && x.v !== cv) { x.v = cv; ch = true; } });
        }
        /* contrôles d'office manquants : ajoutés sous MATIÈRE / MAIN D'ŒUVRE */
        W.forEach(({ a, c }) => {
          if (L.some(n => n.k === "p" && n.auto === a && n.cid === c.id)) return;
          const A = QQ_AUTO[a];
          let ti = L.findIndex(n => n.k === "t" && U_(n.v) === A.t);
          if (ti < 0) { const ci = L.findIndex(n => n.k === "t" && U_(n.v) === "CHANTIER"); const d = ci >= 0 ? L[ci].d + 1 : 0; const at = ci >= 0 ? qqEnd(L, ci) : L.length; L.splice(at, 0, { id: insId(), k: "t", d, v: A.t, def: 1 }); ti = at; }
          const t = L[ti]; t.f = false;
          L.splice(qqEnd(L, ti), 0,
            { id: insId(), k: "p", d: t.d + 1, v: A.p(c), auto: a, cid: c.id },
            { id: insId(), k: "c", d: t.d + 2, v: A.c(c), auto: a, cid: c.id, ev: "chg:" + c.id, how: "VISUEL", who: "INTÉRIEUR", proof: "PV", btn: [A.btn], nc: "ARRÊT" });
          ch = true;
        });
      });
      return ch;
    };
    /* FORMAT 112 (v488) : PAQ — PLAN D'ASSURANCE QUALITÉ du budget, aperçu au format DEVIS ; jamais un prix ni un montant.
       Parties : DÉMARCHE QUALITÉ (texte du budget, INS.qq.dem), DÉCOMPOSITION DU PROJET (quantités), PLANNING,
       POINTS DE CONTRÔLE (modèle commun puis chaque tâche), MATÉRIAUX ET AGRÉMENTS */
    const qqDemDefault = () => {
      const Q = qqData(), keys = qqTaskKeys();
      const nc = qqCrit(Q.M).length + keys.reduce((t, k) => t + qqCrit(Q.T[k]).length, 0);
      const na = [Q.M, ...keys.map(k => Q.T[k])].reduce((t, L) => t + qqCrit(L).filter(x => x.nc === "ARRÊT").length, 0);
      return "LA QUALITÉ DU PROJET EST TENUE PAR DES POINTS DE CONTRÔLE PRÉPARÉS AU BUDGET, TÂCHE PAR TÂCHE, CLASSÉS PAR INTERFACE ET SELON LES 6 M (MATIÈRE, MAIN D'ŒUVRE, MATÉRIEL, MÉTHODE, MILIEU, MESURE). "
        + "CHAQUE CRITÈRE DIT CE QUI DOIT ÊTRE VRAI, COMMENT IL EST CONTRÔLÉ, PAR QUI ET AVEC QUELLE PREUVE ; UN RÉSULTAT NON CONFORME OUVRE UN TRAVAIL À FAIRE ET PEUT ARRÊTER LA SUITE DES TRAVAUX. "
        + "CE PLAN COMPTE " + nc + " CRITÈRE(S) DE CONTRÔLE, DONT " + na + " POINT(S) D'ARRÊT" + (Q.ext.length ? ", ET " + Q.ext.length + " ESSAI(S) EXTERNE(S)" : "") + ".";
    };
    const qqPaqPrint = () => {
      const Q = qqData(), keys = qqTaskKeys();
      const E = v => esc(String(v ?? ""));
      const sec = t => `<tr class="paq-s"><td colspan="4"><b>${E(t)}</b></td></tr>`;
      const sub = (a, b, c, d) => `<tr class="paq-h"><td><b>${E(a)}</b></td><td><b>${E(b)}</b></td><td class="r"><b>${E(c)}</b></td><td><b>${E(d)}</b></td></tr>`;
      const row = (a, b, c, d, ind = 0) => `<tr><td style="padding-left:${6 + 14 * ind}px">${E(a)}</td><td>${E(b)}</td><td class="r">${E(c)}</td><td>${E(d)}</td></tr>`;
      const fq = v => insFmt(v).replace(/,00$/, "");
      let b = "";
      /* 1. démarche */
      b += sec("1. DÉMARCHE QUALITÉ") + `<tr><td colspan="4" style="white-space:normal;line-height:1.45">${E(Q.dem || qqDemDefault()).replace(/\n/g, "<br>")}</td></tr>`;
      /* 2. décomposition du projet : désignations (quantités) et leurs tâches, produits avec quantités */
      b += sec("2. DÉCOMPOSITION DU PROJET") + sub("DÉSIGNATION / TÂCHE / PRODUIT", "UNITÉ", "QUANTITÉ", "ART");
      INS.des.forEach(r => {
        if (r.t) { b += `<tr><td colspan="4" style="padding-left:${6 + 14 * (Number(r.d) || 0)}px"><b>${E((artOf(r) ? artOf(r) + " " : "") + (r.des || ""))}</b></td></tr>`; return; }
        b += row(r.des || "", r.u || "", fq(insCalc("des", r, "q")), artOf(r), Number(r.d) || 0);
        (INS.links || []).filter(l => l.des === r.id).forEach(l => {
          b += row(lkName("lot", l.lot) + " › " + lkName("prim", l.prim) + " › " + lkName("sec", l.sec), "", "", "", (Number(r.d) || 0) + 1);
          (l.prd || []).forEach(x => { const pr = INS.prd.find(q => q.id === x.id); if (pr) b += row(pr.des || "", pr.u || "", fq(insCalc("prd", pr, "q")), "", (Number(r.d) || 0) + 2); });
        });
      });
      /* 3. planning */
      const dfr = iso => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "";
      const dk = keys.filter(k => dlyDeb(k) || dlyFin(k)).sort((x, y) => String(dlyDeb(x) || "9").localeCompare(String(dlyDeb(y) || "9")));
      b += sec("3. PLANNING") + sub("TÂCHE (LOT › ACTIVITÉ SECONDAIRE)", "DÉBUT", "DURÉE (J)", "FIN");
      if (!dk.length) b += row("AUCUNE TÂCHE DATÉE", "", "", "");
      dk.forEach(k => b += row(qqTaskName(k), dfr(dlyDeb(k)), dlyDeb(k) && dlyFin(k) ? String(dDur(dlyDeb(k), dlyFin(k))) : "", dfr(dlyFin(k))));
      /* 4. points de contrôle */
      b += sec("4. POINTS DE CONTRÔLE") + sub("POINT DE CONTRÔLE / CRITÈRE", "COMMENT · PAR QUI · PAR QUOI", "", "DÉCLENCHEMENT · APPEL · SI NON CONFORME");
      const ctl = (title, key, L) => {
        if (!qqCrit(L).length) return;
        b += `<tr class="paq-t"><td colspan="4"><b>${E(title)}</b></td></tr>`;
        L.forEach((n, i) => {
          if (n.k === "t" && !L.slice(i + 1, qqEnd(L, i)).some(x => x.k === "c")) return;
          if (n.k !== "c") { b += `<tr><td colspan="4" style="padding-left:${6 + 14 * (n.d + 1)}px"><b>${E(n.v)}</b></td></tr>`; return; }
          b += row([n.v, n.pr].filter(Boolean).join(" — ") + (n.ref ? " (" + n.ref + ")" : "") + (n.ev ? " · " + qqEvLab(key, n.ev) : ""),
            [n.how, n.who, n.proof].filter(Boolean).join(" · "), "", [qqDecLab(key, n), qqAppLab(n), n.nc === "ARRÊT" ? "■ ARRÊT" : n.nc].filter(Boolean).join(" · "), n.d + 1);
        });
      };
      ctl("MODÈLE COMMUN — S'APPLIQUE À TOUTES LES TÂCHES", "", Q.M || []);
      keys.forEach(k => ctl(qqTaskName(k), k, Q.T[k] || []));
      if (Q.ext.length) {
        b += `<tr class="paq-t"><td colspan="4"><b>ESSAIS EXTERNES</b></td></tr>`;
        Q.ext.forEach(e => b += row(e.v || "", e.cad ? "1 TOUS LES " + e.cad + (e.u2 ? " " + e.u2 : "") : "PAR TÂCHE", String((e.tasks || []).reduce((t, k) => t + qqExtQty(e, k), 0)), (e.tasks || []).map(qqTaskName).join(" · "), 1));
      }
      /* 5. matériaux et agréments */
      b += sec("5. MATÉRIAUX ET AGRÉMENTS") + sub("CHARGE", "UNITÉ", "QUANTITÉ", "AGRÉMENT / QUALIFICATION");
      const ch = INS.chg.filter(c => !c.t && !c.qq);
      if (!ch.length) b += row("AUCUNE CHARGE", "", "", "");
      ch.forEach(c => b += row(c.des || "", c.u || "", fq(insCalc("chg", c, "q")), [c.agr ? "AGRÉMENT EXIGÉ" : "", U_(c.qex) ? "QUALIFICATION : " + U_(c.qex) : ""].filter(Boolean).join(" · ") || "—"));
      histLog("QUALITÉ", "PAQ — APERÇU");
      printModel({ branch: "PLAN D'ASSURANCE QUALITÉ", docTitle: "PLAN D'ASSURANCE QUALITÉ", fileTag: "PAQ", headLine: "PLAN D'ASSURANCE QUALITÉ", portrait: true,
        table: `<table id="tpl" class="paq"><colgroup><col style="width:46%"><col style="width:14%"><col style="width:14%"><col style="width:26%"></colgroup>
          <thead><tr><th colspan="4">PLAN D'ASSURANCE QUALITÉ — ${E(budget.project || "")}</th></tr></thead><tbody>${b}</tbody></table>`, end: "" });
    };
    /* PAQ : la démarche qualité se relit (et se corrige en instance) avant l'aperçu */
    const qqPaqOpen = () => {
      const Q = qqData();
      if (!INS_EDIT) return qqPaqPrint();
      qqWin("PLAN D'ASSURANCE QUALITÉ — DÉMARCHE QUALITÉ", `<label class="doc-lab">DÉMARCHE QUALITÉ (COMMENT LA QUALITÉ EST ATTAQUÉE SUR CE PROJET)</label>
          <textarea class="doc-in doc-ta paq-dem" rows="9">${esc(Q.dem || qqDemDefault())}</textarea>
          <div class="svc-sub">L'APERÇU REPREND AUSSI LA DÉCOMPOSITION DU PROJET (QUANTITÉS), LE PLANNING, LES POINTS DE CONTRÔLE ET LES MATÉRIAUX ; JAMAIS UN PRIX.</div>`,
        d => { const v = String(d.querySelector(".paq-dem").value || "").replace(/[ \t]+/g, " ").trim().toUpperCase(); Q.dem = v === qqDemDefault() ? "" : v; qqSave(); setTimeout(qqPaqPrint, 0); });
      const ok = document.querySelector("#svConf .svc-ok"); if (ok) ok.textContent = "ENREGISTRER ET VOIR L'APERÇU";
    };
    shell.__paq = () => qqPaqOpen();
    /* FORMAT 132 (v489) : RÉGLAGES QUALITÉ du budget — valeurs par défaut reçues par tout nouveau critère */
    const qqCfg = () => { const Q = qqData(); Q.cfg = Q.cfg || { nra: 3, nrz: 3 }; return Q.cfg; };
    const qqCfgDef = () => { const c = qqCfg(), o = {}; if (c.nra !== "" && c.nra !== undefined) o.nra = c.nra; if (c.nrz !== "" && c.nrz !== undefined) o.nrz = c.nrz; return o; };
    const qqCfgWin = () => {
      const c = qqCfg(), ro = !INS_EDIT;
      qqWin("RÉGLAGES QUALITÉ DU BUDGET", `<div class="svc-sub">VALEURS PAR DÉFAUT REÇUES PAR TOUT NOUVEAU CRITÈRE ; UN CRITÈRE SENSIBLE SE CHANGE À LA MAIN DANS LE TABLEAU.</div>
          <div class="doc-grid doc-grid-2">
            <label class="doc-lab">REMARQUES AVANT AUDIT</label><input class="doc-in qq-cnra number" inputmode="numeric" value="${esc(c.nra ?? "")}" ${ro ? "disabled" : ""}>
            <label class="doc-lab">CONTRÔLES SANS REMARQUE (REMISE À ZÉRO APRÈS UN AUDIT SOLDÉ)</label><input class="doc-in qq-cnrz number" inputmode="numeric" value="${esc(c.nrz ?? "")}" ${ro ? "disabled" : ""}>
          </div>`, d => {
        if (ro) return;
        const g = s => { const v = String(d.querySelector(s).value || "").trim(); return v === "" ? "" : Math.max(0, Math.round(insNum(v)) || 0); };
        c.nra = g(".qq-cnra"); c.nrz = g(".qq-cnrz");
        histLog("QUALITÉ", "RÉGLAGES DU BUDGET", "REMARQUES AVANT AUDIT " + (c.nra === "" ? "—" : c.nra) + " · CONTRÔLES SANS REMARQUE " + (c.nrz === "" ? "—" : c.nrz));
        qqSave();
      });
    };
    /* import / export de l'onglet QUALITÉ (décision du 19/10/2026) : une ligne par critère */
    const QQ_IO = ["PROJET", "LOT", "ACTIVITÉ SECONDAIRE", "TITRE", "POINT DE CONTRÔLE", "CRITÈRE", "ÉLÉMENT VISÉ", "PRESCRIPTION", "RÉFÉRENCE", "COMMENT", "PAR QUI", "PAR QUOI",
      "DÉCLENCHEMENT", "FRÉQUENCE", "PRÉAVIS (J)", "PRÉVENIR", "SI NON CONFORME", "TOLÉRANCE", "LIMITE REMARQUE", "REMARQUES AVANT AUDIT", "CONTRÔLES SANS REMARQUE"];
    const qqExportRows = () => {
      const Q = qqData(), out = [], PJ = U_(budget.project || "");
      const fN = v => v === "" || v === undefined || v === null ? "" : String(v).replace(".", ",");
      const one = (key, L) => {
        const [lo, se] = key ? key.split("|") : ["", ""];
        const LOT = key ? lkName("lot", lo) : "", SEC = key ? lkName("sec", se) : "";
        const path = [];
        let pt = null, ptUsed = false;
        const flushPt = () => { if (pt && !ptUsed) out.push([PJ, LOT, SEC, path.map(t => t.v).join(" / "), pt.v || "", "", ...Array(15).fill("")]); };
        L.forEach(n => {
          if (n.k === "t") { flushPt(); pt = null; while (path.length && path[path.length - 1].d >= n.d) path.pop(); path.push(n); return; }
          if (n.k === "p") { flushPt(); pt = n; ptUsed = false; return; }
          ptUsed = true;
          out.push([PJ, LOT, SEC, path.filter(t => t.d < n.d).map(t => t.v).join(" / "), pt ? pt.v || "" : "", n.v || "", qqEvLab(key, n.ev), n.pr || "", n.ref || "", n.how || "", n.who || "", n.proof || "",
            (n.btn || []).join(" ; "), fN(n.fq), fN(n.pv), n.pw || "", n.nc || "", n.tol || "", n.lrm || "", fN(n.nra), fN(n.nrz)]);
        });
        flushPt();
      };
      if (Q.M) one("", Q.M);
      qqTaskKeys().forEach(k => { if (Q.T[k]) one(k, Q.T[k]); });
      return out;
    };
    /* import : ligne d'en-tête avec CRITÈRE (sinon l'ancien format PROJET, QUALITÉ, TITRE) ; replace = la source remplace les contrôles */
    const qqImportAoa = (aoa, srcName, quiet, replace) => {
      const hi = (aoa || []).findIndex(r => (r || []).map(bfNorm).includes("CRITERE"));
      if (hi < 0) return -1;
      const H = aoa[hi].map(bfNorm), col = n => H.indexOf(bfNorm(n));
      const C = {}; QQ_IO.forEach(h => { C[h] = col(h); });
      const get = (r, h) => C[h] >= 0 ? sviClean(r[C[h]] ?? "") : "";
      const PJ = U_(budget.project || ""), Q = qqData();
      if (replace) { Q.M = qqDefault(); Object.keys(Q.T).forEach(k => { Q.T[k] = qqDefault(); }); }
      let n = 0; const bad = [];
      const evOf = (key, v) => {
        const V = U_(v); if (!V) return "";
        if (V === "TÂCHE (GÉNÉRAL)" || V === "TACHE (GENERAL)") return "T";
        if (V === "TOUS LES PRODUITS") return "P*"; if (V === "TOUTES LES CHARGES") return "C*";
        const E = qqElems(key);
        const hit = E.find(e => U_(e.lab) === V) || E.find(e => U_(e.r.des) === V.replace(/^(PRODUIT|CHARGE) · /, "").replace(/ \([^)]*\)$/, ""));
        return hit ? hit.v : "";
      };
      aoa.slice(hi + 1).forEach((r, i) => {
        if (!r || !r.some(x => String(x ?? "").trim())) return;
        if (C.PROJET >= 0 && PJ && get(r, "PROJET") && U_(get(r, "PROJET")) !== PJ) return;
        const ln = hi + i + 2, lot = U_(get(r, "LOT")), sec = U_(get(r, "ACTIVITÉ SECONDAIRE"));
        let key = "";
        if (lot || sec) {
          const lo = INS.lot.find(x => !x.t && U_(x.v) === lot), se = INS.sec.find(x => !x.t && U_(x.v) === sec);
          if (!lo || !se) { bad.push("LIGNE " + ln + " : TÂCHE " + lot + " › " + sec + " INCONNUE DANS LE BUDGET"); return; }
          key = lo.id + "|" + se.id;
        }
        const L = qqList(key);
        /* chemin des titres : créé s'il manque */
        let pi = -1, d = 0;
        U_(get(r, "TITRE")).split("/").map(s => s.trim()).filter(Boolean).forEach(t => {
          const a = pi + 1, b = pi < 0 ? L.length : qqEnd(L, pi);
          let j = -1; for (let x = a; x < b; x++) if (L[x].k === "t" && L[x].d === d && U_(L[x].v) === t) { j = x; break; }
          if (j < 0) { j = b; L.splice(j, 0, { id: insId(), k: "t", d, v: t }); }
          pi = j; d++;
        });
        const P = U_(get(r, "POINT DE CONTRÔLE")), CR = U_(get(r, "CRITÈRE"));
        if (!P) { if (CR) bad.push("LIGNE " + ln + " : CRITÈRE SANS POINT DE CONTRÔLE"); return; }
        /* contrôle ajouté d'office : il redonne la case de la charge (AGRÉMENT EXIGÉ / QUALIFICATION EXIGÉE) */
        const am = P.match(/^(AGRÉMENT FOURNI|HABILITATION VÉRIFIÉE) — (.+)$/);
        if (am && key) {
          const c = qqElems(key).find(e => e.k === "chg" && U_(e.r.des) === am[2]);
          if (c) { if (am[1] === "AGRÉMENT FOURNI") c.r.agr = true; else { const q = CR.replace(/^QUALIFICATION : /, ""); if (q) c.r.qex = q; } n++; return; }
        }
        const a = pi + 1, b = pi < 0 ? L.length : qqEnd(L, pi);
        let p = -1; for (let x = a; x < b; x++) if (L[x].k === "p" && U_(L[x].v) === P) { p = x; break; }
        if (p < 0) { p = b; L.splice(p, 0, { id: insId(), k: "p", d, v: P }); }
        if (!CR) return;
        const e = qqEnd(L, p);
        let c = null; for (let x = p + 1; x < e; x++) if (L[x].k === "c" && U_(L[x].v) === CR) { c = L[x]; break; }
        if (!c) { c = { id: insId(), k: "c", d: L[p].d + 1, v: CR, nc: "RIEN" }; L.splice(e, 0, c); }
        const pick = (h, list) => { const v = U_(get(r, h)); return list.includes(v) ? v : (v ? (bad.push("LIGNE " + ln + " : " + h + " « " + v + " » INCONNU"), "") : ""); };
        const numv = h => { const v = get(r, h); return v === "" ? "" : sviNumOk(v) ? insNum(v) : (bad.push("LIGNE " + ln + " : " + h + " « " + v + " » N'EST PAS UN NOMBRE"), ""); };
        Object.assign(c, {
          ev: evOf(key, get(r, "ÉLÉMENT VISÉ")) || c.ev || (key ? "T" : ""), pr: U_(get(r, "PRESCRIPTION")), ref: U_(get(r, "RÉFÉRENCE")),
          how: pick("COMMENT", QQ_LISTS.how), who: pick("PAR QUI", QQ_LISTS.who), proof: pick("PAR QUOI", QQ_LISTS.proof),
          btn: U_(get(r, "DÉCLENCHEMENT")).split(/\s*[;·]\s*/).filter(Boolean), fq: numv("FRÉQUENCE"), pv: numv("PRÉAVIS (J)"), pw: U_(get(r, "PRÉVENIR")),
          nc: pick("SI NON CONFORME", QQ_LISTS.nc) || "RIEN", tol: U_(get(r, "TOLÉRANCE")), lrm: U_(get(r, "LIMITE REMARQUE")), nra: numv("REMARQUES AVANT AUDIT"), nrz: numv("CONTRÔLES SANS REMARQUE")
        });
        n++;
      });
      if (!quiet) histLog("IMPORT", "QUALITÉ", (srcName || "") + " — " + n + " LIGNE(S)" + (bad.length ? " — " + bad.length + " REFUSÉE(S)" : ""));
      insSave(); refreshAll();
      if (bad.length) setTimeout(() => sviAlert(["ONGLET QUALITÉ : " + n + " LIGNE(S) IMPORTÉE(S).", "REFUSÉES OU INCOMPLÈTES :", ...bad.slice(0, 40).map(x => "— " + x), bad.length > 40 ? "… ET " + (bad.length - 40) + " AUTRE(S)" : ""].filter(Boolean).join("\n"), "IMPORT QUALITÉ"), 300);
      return n;
    };
    let qqSub = "ctl";   /* sous-onglet : CONTRÔLES / ESSAIS EXTERNES / PERSONNEL (FORMAT 110) */
    const qqCell = (key, n, c) => {
      const [f, , , type] = c, ro = !INS_EDIT;
      if (type === "txt" || type === "num")
        return `<td class="qq-td${type === "num" ? " number" : ""}"><input class="qq-in${type === "num" ? " number" : ""}" data-f="${f}" ${type === "num" ? 'inputmode="decimal"' : ""} value="${esc(n[f] ?? "")}" ${ro ? "disabled" : ""} autocomplete="off" spellcheck="false" enterkeyhint="next"></td>`;
      let v = "";
      if (f === "ev") v = qqEvLab(key, n.ev);
      else if (f === "dec") v = qqDecLab(key, n);
      else if (f === "app") v = qqAppLab(n);
      else v = n[f] || "";
      const arr = f === "nc" && v === "ARRÊT";
      return `<td class="qq-td qq-${type}${ro ? " qq-ro" : ""}" data-f="${f}"><span class="qq-v${arr ? " qq-arr" : ""}">${esc(arr ? "■ ARRÊT" : v)}</span></td>`;
    };
    const qqCtlHTML = key => {
      const L = qqList(key), ro = !INS_EDIT, nc = QQ_COLS.length;
      const w = 36 + QQ_TREE_W + QQ_COLS.reduce((t, c) => t + c[2], 0) + (ro ? 0 : 40);
      const ind = d => `padding-left:${6 + 20 * d}px`;
      const cb = n => ro ? "" : `<td class="center qq-cbtd"><input type="checkbox" class="qq-cb" ${n.on ? "checked" : ""}></td>`;
      const newRow = (pid, d, kind) => ro ? "" : `<tr class="qq-new" data-pid="${pid}" data-kind="${kind}"><td></td><td class="qq-tree" style="${ind(d)}"><input class="qq-in qq-nin" data-f="v" placeholder="SAISIR ICI… (${kind === "p" ? "POINT DE CONTRÔLE" : "CRITÈRE"})" autocomplete="off" spellcheck="false" enterkeyhint="next"></td><td colspan="${nc}"></td>${ro ? "" : "<td></td>"}</tr>`;
      let rows = "";
      /* lignes SAISIR ICI… à placer à la fin des branches (index de fin → lignes) */
      const tail = {}, vis = [];
      { let h = -1; L.forEach((n, i) => { vis[i] = i >= h; if (vis[i] && n.f && n.k !== "c") h = qqEnd(L, i); }); }
      L.forEach((n, i) => {
        if (!vis[i] || n.f || (n.k === "t" && qqHasSubT(L, i))) return;
        if (n.k === "t") (tail[qqEnd(L, i)] = tail[qqEnd(L, i)] || []).unshift(newRow(n.id, n.d + 1, "p"));
        else if (n.k === "p") (tail[qqEnd(L, i)] = tail[qqEnd(L, i)] || []).unshift(newRow(n.id, n.d + 1, "c"));
      });
      L.forEach((n, i) => {
        if (tail[i]) rows += tail[i].join("");
        if (!vis[i]) return;
        const fold = n.k !== "c" ? `<span class="qq-fold" data-id="${n.id}">${n.f ? "›" : "⌄"}</span>` : "";
        if (n.k === "t" || n.k === "p") {
          const empty = n.k === "t" && !qqHasPts(L, i);
          const aw = qqAutoWhy(n);
          rows += `<tr class="qq-${n.k}${empty ? " qq-empty" : ""}${aw ? " qq-auto" : ""}" data-id="${n.id}"><td class="center">${fold}</td>
            <td class="qq-tree" style="${ind(n.d)}"${aw ? ` data-why="${esc(aw)}"` : ""}><input class="qq-in qq-lab" data-f="v" value="${esc(n.v || "")}" ${ro || aw ? "disabled" : ""} autocomplete="off" spellcheck="false" enterkeyhint="next"></td>
            <td colspan="${nc}" class="qq-span"></td>${cb(n)}</tr>`;
          return;
        }
        const awc = qqAutoWhy(n);
        rows += `<tr class="qq-c${awc ? " qq-auto" : ""}" data-id="${n.id}"><td></td>
          <td class="qq-tree" style="${ind(n.d)}"${awc ? ` data-why="${esc(awc)}"` : ""}><input class="qq-in" data-f="v" value="${esc(n.v || "")}" ${ro || awc ? "disabled" : ""} placeholder="CRITÈRE" autocomplete="off" spellcheck="false" enterkeyhint="next"></td>
          ${QQ_COLS.map(c => qqCell(key, n, c)).join("")}${cb(n)}</tr>`;
      });
      if (tail[L.length]) rows += tail[L.length].join("");
      const head = `<tr><th></th><th>POINT DE CONTRÔLE / CRITÈRE</th>${QQ_COLS.map(c => `<th>${esc(c[1])}</th>`).join("")}${ro ? "" : `<th class="center"><input type="checkbox" class="qq-cball" ${L.length && L.every(x => x.on) ? "checked" : ""}></th>`}</tr>`;
      return `<table class="bdg-d-table qq-table" style="width:${w}px"><colgroup><col style="width:36px"><col style="width:${QQ_TREE_W}px">${QQ_COLS.map(c => `<col style="width:${c[2]}px">`).join("")}${ro ? "" : '<col style="width:40px">'}</colgroup>
        <thead>${head}</thead><tbody>${rows}</tbody></table>`;
    };
    /* ESSAIS EXTERNES (FORMAT 110) : un essai par ligne, tâches cochées dans une fenêtre lots / activités */
    const qqTaskKeys = () => {
      const s = new Set();
      (INS.links || []).forEach(l => l.lot && l.sec && s.add(l.lot + "|" + l.sec));
      try { dlyKeys().forEach(k => s.add(k)); } catch (e) {}
      return [...s].filter(k => { const [lo, se] = k.split("|"); return INS.lot.some(x => x.id === lo) && INS.sec.some(x => x.id === se); });
    };
    const qqExtQty = (e, key) => {
      if (!e.cad || !(Number(e.cad) > 0)) return 1;
      const [lo, se] = key.split("|");
      let q = 0;
      (INS.links || []).filter(l => l.lot === lo && l.sec === se).forEach(l => (l.prd || []).forEach(x => {
        const r = INS.prd.find(y => y.id === x.id);
        if (r && (!e.u2 || U_(r.u) === U_(e.u2))) q += Number(insCalc("prd", r, "q")) || 0;
      }));
      return Math.ceil(q / Number(e.cad)) || 0;
    };
    /* essai EXTERNE → une seule charge dans le budget (quantité = somme des tâches cochées, prix de l'essai),
       liée à chaque tâche cochée ; le détail par tâche reste dans ESSAIS EXTERNES (décision du 17/10/2026) */
    const qqExtSync = () => {
      const Q = qqData();
      const drop = e => {
        const c = e.cid && INS.chg.find(x => x.id === e.cid);
        (INS.links || []).forEach(l => { if (l.chg) l.chg = l.chg.filter(y => y.id !== e.cid); });
        if (c && c.qq) INS.chg = INS.chg.filter(x => x.id !== c.id);
        e.cid = "";
      };
      (Q.extGone || []).forEach(drop); Q.extGone = [];
      Q.ext.forEach(e => {
        const keys = (e.tasks || []).filter(k => (INS.links || []).some(l => l.lot + "|" + l.sec === k));
        if (!U_(e.v) || !keys.length) { drop(e); return; }
        const tot = keys.reduce((t, k) => t + qqExtQty(e, k), 0);
        let c = e.cid && INS.chg.find(x => x.id === e.cid);
        if (!c) {
          c = INS.chg.find(x => !x.t && U_(x.des) === U_(e.v) && U_(x.u) === U_(e.u || "ESSAI"));
          if (!c) { c = { id: insId(), art: "", des: U_(e.v), u: U_(e.u || "ESSAI"), q: tot, p: e.p, qq: 1, on: false }; INS.chg.push(c); }
          e.cid = c.id;
        }
        if (c.qq) { c.des = U_(e.v); c.u = U_(e.u || "ESSAI"); c.p = e.p; }
        c.q = tot || "";
        (INS.links || []).forEach(l => {
          const k = l.lot + "|" + l.sec, has = (l.chg || []).some(y => y.id === c.id);
          if (keys.includes(k)) { if (!has && !(INS.links || []).some(o => o !== l && o.lot === l.lot && o.sec === l.sec && (o.chg || []).some(y => y.id === c.id))) (l.chg = l.chg || []).push({ id: c.id, q: "" }); }
          else if (has && c.qq) l.chg = l.chg.filter(y => y.id !== c.id);
        });
      });
    };
    const qqExtHTML = () => {
      const Q = qqData(), ro = !INS_EDIT;
      const inp = (e, f, num) => `<input class="qq-xin${num ? " number" : ""}" data-f="${f}" value="${esc(e[f] ?? "")}" ${num ? 'inputmode="decimal"' : ""} ${ro ? "disabled" : ""} autocomplete="off" spellcheck="false">`;
      const rows = Q.ext.map(e => {
        const n = (e.tasks || []).length, tot = (e.tasks || []).reduce((t, k) => t + qqExtQty(e, k), 0);
        return `<tr data-xid="${e.id}"><td>${inp(e, "v")}</td><td class="center">${inp(e, "u")}</td><td class="number">${inp(e, "p", 1)}</td>
          <td class="number">${inp(e, "cad", 1)}</td><td class="center">${inp(e, "u2")}</td>
          <td class="center qq-xt${ro ? " qq-ro" : ""}">${svCnt(n)}</td><td class="number">${n ? tot : ""}</td>${ro ? "" : `<td class="center"><input type="checkbox" class="qq-xcb" ${e.on ? "checked" : ""}></td>`}</tr>`;
      }).join("");
      const nw = ro ? "" : `<tr class="qq-xnew"><td><input class="qq-xin" data-f="v" placeholder="SAISIR ICI… (ESSAI)" autocomplete="off" spellcheck="false"></td><td colspan="${ro ? 6 : 7}"></td></tr>`;
      return `<table class="bdg-d-table qq-table" style="width:${ro ? 830 : 870}px"><colgroup><col style="width:300px"><col style="width:70px"><col style="width:100px"><col style="width:130px"><col style="width:80px"><col style="width:80px"><col style="width:70px">${ro ? "" : '<col style="width:40px">'}</colgroup>
        <thead><tr><th>ESSAI</th><th>UNITÉ</th><th>PRIX</th><th>1 TOUS LES (VIDE = PAR TÂCHE)</th><th>UNITÉ DU PRODUIT</th><th>TÂCHES</th><th>NB ESSAIS</th>${ro ? "" : "<th></th>"}</tr></thead>
        <tbody>${rows}${nw}</tbody></table>`;
    };
    /* PERSONNEL (FORMAT 110) : exigences facultatives de la tâche choisie (ou du modèle commun) */
    const QQ_PER = [["bag", "BAGAGE EXIGÉ (DIPLÔME, FORMATION)", "txt"], ["vid", "FORMATION INTERNE (VIDÉOS)", "txt"], ["tps", "TEMPS DE VISIONNAGE EXIGÉ (MIN)", "num"],
      ["qst", "QUESTIONS PAR ARRÊT DE LA VIDÉO", "num"], ["note", "NOTE MINIMALE (/20)", "num"], ["exp", "EXPÉRIENCE EXIGÉE (TÂCHES OU QUANTITÉ)", "txt"],
      ["niv", "NIVEAU MINIMAL", "pick"], ["val", "VALIDITÉ DE L'AGRÉMENT (MOIS)", "num"], ["sec", "SÉCURITÉ", "pick"]];
    const qqPerHTML = key => {
      const P = qqData().per[key] || {}, ro = !INS_EDIT;
      return `<table class="bdg-d-table qq-table" style="width:640px"><colgroup><col style="width:330px"><col style="width:310px"></colgroup>
        <thead><tr><th>EXIGENCE (TOUT EST FACULTATIF)</th><th>VALEUR</th></tr></thead><tbody>${QQ_PER.map(([f, lab, t]) => `<tr data-pf="${f}"><td>${esc(lab)}</td>${
          t === "pick" ? `<td class="qq-td qq-pick${ro ? " qq-ro" : ""}" data-f="${f}"><span class="qq-v">${esc(P[f] || "")}</span></td>`
            : `<td><input class="qq-pin${t === "num" ? " number" : ""}" data-f="${f}" value="${esc(P[f] ?? "")}" ${t === "num" ? 'inputmode="decimal"' : ""} ${ro ? "disabled" : ""} autocomplete="off" spellcheck="false"></td>`}</tr>`).join("")}</tbody></table>`;
    };
    const qqTaskName = key => { if (!key) return ""; const [lo, se] = key.split("|"); return lkName("lot", lo) + " › " + lkName("sec", se); };
    const qqHTML = () => {
      const key = qqKey();
      const scope = key ? "TÂCHE : " + esc(qqTaskName(key)) : "MODÈLE COMMUN — S'APPLIQUE À TOUTES LES TÂCHES";
      const sub = (v, lab) => `<button type="button" class="qq-sub${qqSub === v ? " on" : ""}" data-sub="${v}">${lab}</button>`;
      const inner = qqSub === "ext" ? qqExtHTML() : qqSub === "per" ? qqPerHTML(key) : qqCtlHTML(key);
      return `<div class="qq-bar">${sub("ctl", "CONTRÔLES")}${sub("ext", "ESSAIS EXTERNES")}${sub("per", "PERSONNEL")}<span class="qq-scope">${qqSub === "ext" ? "TOUT LE BUDGET" : scope}</span></div>
        <div class="bdg-d-scroll qq-scroll">${inner}</div>`;
    };
    const qqRender = keepFocus => {
      const sc = body.querySelector(".qq-scroll"), top = sc ? sc.scrollTop : 0, left = sc ? sc.scrollLeft : 0;
      body.innerHTML = qqHTML();
      const ns = body.querySelector(".qq-scroll");
      if (ns) { ns.scrollTop = top; ns.scrollLeft = left; }
      const b = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="qlt"]`);
      if (b) b.innerHTML = (SVI_ICON.qlt || "") + "DÉTAIL QUALITÉ " + svCnt(qqCount());
      if (keepFocus) { const t = body.querySelector(keepFocus); if (t) t.focus(); }
    };
    const qqSave = () => insSave();
    /* petite liste au format de l'application sous la case (comme les unités, FORMAT 50) */
    const qqPick = (td, items, cur, done) => {
      document.getElementById("qqPick")?.remove();
      const m = document.createElement("div");
      m.id = "qqPick";
      m.innerHTML = items.map(it => `<button type="button" data-v="${esc(it.v)}" class="${it.v === cur ? "on" : ""}">${esc(it.lab)}</button>`).join("")
        + (cur ? '<button type="button" data-v="" class="qq-clr">EFFACER</button>' : "");
      document.body.appendChild(m);
      const r = td.getBoundingClientRect();
      sviPlaceMenu(m, { top: r.top, bottom: r.bottom, right: r.left + Math.max(r.width, m.offsetWidth), left: r.left });
      const close = ev => { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener("pointerdown", close, true); } };
      setTimeout(() => document.addEventListener("pointerdown", close, true), 0);
      m.addEventListener("click", ev => {
        const b = ev.target.closest("[data-v]");
        if (!b) return;
        m.remove(); document.removeEventListener("pointerdown", close, true);
        done(b.dataset.v);
      });
    };
    const qqNode = (key, id) => qqList(key).find(x => x.id === id);
    /* fenêtres DÉCLENCHEMENT et APPEL (FORMAT 105 et 106), au format INF */
    const qqWin = (title, html, onOk, onLive) => {
      document.getElementById("svConf")?.remove();
      const d = document.createElement("div");
      d.id = "svConf";
      d.innerHTML = `<div class="svc-card qq-win" role="dialog" aria-modal="true">
          <button type="button" class="svc-close" data-r="0" aria-label="Fermer">✕</button>
          <div class="svc-t">${esc(title)}</div><div class="svc-x svc-html">${html}</div>
          <div class="svc-f"><button type="button" class="svc-b" data-r="0">ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-r="1">ENREGISTRER</button></div></div>`;
      document.body.appendChild(d);
      if (onLive) { d.addEventListener("input", () => onLive(d)); d.addEventListener("change", () => onLive(d)); onLive(d); }
      let lp = null;
      d.addEventListener("pointerdown", e => { const g = e.target.closest(".qq-dis"); if (g) lp = setTimeout(() => svToast(g.dataset.why || "", 3500, g), 500); });
      ["pointerup", "pointercancel"].forEach(t => d.addEventListener(t, () => clearTimeout(lp)));
      d.addEventListener("click", e => {
        const b = e.target.closest("[data-r]");
        if (!b && e.target !== d) return;
        if (b && b.dataset.r === "1") onOk(d);
        d.remove();
      });
    };
    const qqDecWin = (key, n) => {
      const e = qqEvQty(n.ev), sel = new Set(n.btn || []);
      const html = `<div class="svc-sub">BOUTONS ${svCnt(sel.size)}</div><div class="qq-wl">${QQ_BTNS.map(b => `<label><input type="checkbox" value="${esc(b)}" ${sel.has(b) ? "checked" : ""}> ${esc(b)}</label>`).join("")}</div>
        <div class="svc-sub">FRÉQUENCE</div><div class="qq-wr">1 TOUS LES <input class="qq-wi" data-w="fq" inputmode="decimal" value="${esc(n.fq ?? "")}"> ${esc(e && e.u ? e.u : "")} <span class="qq-wcalc"></span></div>
        <div class="svc-sub">PONCTUEL</div><div class="qq-wr"><label class="qq-dis" data-why="LE CONTRÔLE PONCTUEL SE DÉCLENCHE À LA MAIN, EN RÉALISATION"><input type="checkbox" disabled ${n.pon ? "checked" : ""}> DÉCLENCHÉ À LA MAIN (RÉALISATION)</label></div>`;
      qqWin("DÉCLENCHEMENT", html, d => {
        n.btn = [...d.querySelectorAll(".qq-wl input:checked")].map(x => x.value);
        n.fq = insNum(d.querySelector('[data-w="fq"]').value);
        qqSave(); qqRender();
      }, d => {
        const c = d.querySelectorAll(".qq-wl input:checked").length, s = d.querySelector(".svc-sub .svi-cnt");
        if (s) s.outerHTML = svCnt(c);
        const fq = Number(insNum(d.querySelector('[data-w="fq"]').value)) || 0, out = d.querySelector(".qq-wcalc");
        out.textContent = fq && e ? "→ " + Math.max(1, Math.ceil(e.q / fq)) + " CONTRÔLE(S) POUR " + insFmt(e.q) + " " + e.u : fq ? "→ ÉLÉMENT VISÉ SANS QUANTITÉ" : "VIDE = UN CONTRÔLE À CHAQUE FOIS";
      });
    };
    const qqAppWin = (key, n) => {
      const html = `<div class="svc-sub">PRÉAVIS (J)</div><div class="qq-wr"><input class="qq-wi" data-w="pv" inputmode="decimal" value="${esc(n.pv ?? "")}"></div>
        <div class="svc-sub">PRÉVENIR</div><div class="qq-wl">${QQ_WARN.map(w => `<label><input type="radio" name="qqpw" value="${esc(w)}" ${n.pw === w ? "checked" : ""}> ${esc(w)}</label>`).join("")}</div>
        <div class="qq-wcalc qq-seuil"></div>`;
      qqWin("APPEL", html, d => {
        n.pv = insNum(d.querySelector('[data-w="pv"]').value);
        n.pw = (d.querySelector('input[name="qqpw"]:checked') || {}).value || "";
        qqSave(); qqRender();
      }, d => { d.querySelector(".qq-seuil").textContent = qqSeuil(key, d.querySelector('[data-w="pv"]').value); });
    };
    /* DESCRIPTIF d'une désignation client (FORMAT 109) */
    const qqDescWin = id => {
      const r = INS.des.find(x => x.id === id);
      if (!r) return;
      const ro = !INS_EDIT;
      document.getElementById("svConf")?.remove();
      const d = document.createElement("div");
      d.id = "svConf";
      d.innerHTML = `<div class="svc-card qq-win qq-desc" role="dialog" aria-modal="true">
          <button type="button" class="svc-close" data-r="0" aria-label="Fermer">✕</button>
          <div class="svc-t">DESCRIPTIF</div>
          <div class="svc-sub">${esc(((r.art || ART_AUTO.get(r.id) || "") + " " + (r.des || "")).trim().toUpperCase())}</div>
          <div class="svc-x svc-html"><textarea class="qq-dta" ${ro ? "disabled" : ""} placeholder="EXTRAIT DU CONTRAT QUI DÉFINIT L'ARTICLE…">${esc(r.dsc || "")}</textarea></div>
          <div class="svc-f">${ro ? '<button type="button" class="svc-b svc-ok svc-neutral" data-r="0">FERMER</button>'
            : '<button type="button" class="svc-b" data-r="0">ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-r="1">ENREGISTRER</button>'}</div></div>`;
      document.body.appendChild(d);
      d.addEventListener("click", e => {
        const b = e.target.closest("[data-r]");
        if (!b && e.target !== d) return;
        if (b && b.dataset.r === "1") {
          r.dsc = U_(d.querySelector(".qq-dta").value);
          insSave();
          document.querySelectorAll(`.des-i[data-did="${id}"]`).forEach(x => x.classList.toggle("on", !!r.dsc));
          histLog("QUALITÉ", "DESCRIPTIF", (r.des || "").toUpperCase());
        }
        d.remove();
      });
    };
    shell.__qqDesc = qqDescWin;
    if (!shell.__qqDescBound) {
      shell.__qqDescBound = true;
      /* icône i de la désignation : ouvre le DESCRIPTIF sans lancer la saisie ni le glissement */
      shell.addEventListener("pointerdown", e => { if (e.target.closest(".des-i")) e.stopPropagation(); }, true);
      shell.addEventListener("touchstart", e => { if (e.target.closest(".des-i")) e.stopPropagation(); }, true);
      shell.addEventListener("click", e => {
        const b = e.target.closest(".des-i");
        if (!b) return;
        e.preventDefault(); e.stopPropagation();
        if (shell.__qqDesc) shell.__qqDesc(b.dataset.did);
      }, true);
    }
    /* fenêtre TÂCHES d'un essai externe : lots à gauche, activités secondaires à droite (comme FORMAT 66) */
    const qqExtTasks = e => {
      const keys = qqTaskKeys(), byLot = new Map();
      keys.forEach(k => { const [lo] = k.split("|"); if (!byLot.has(lo)) byLot.set(lo, []); byLot.get(lo).push(k); });
      const sel = new Set(e.tasks || []);
      let cur = [...byLot.keys()][0] || null;
      const html = () => `<div class="qq-x2"><div class="qq-x2l">${[...byLot.keys()].map(lo => { const n = byLot.get(lo).filter(k => sel.has(k)).length;
          return `<button type="button" class="qq-x2lot${lo === cur ? " cur" : ""}${n ? " on" : ""}" data-lo="${lo}">${esc(lkName("lot", lo))} ${n ? svCnt(n) : ""}</button>`; }).join("") || '<div class="empty">AUCUNE TÂCHE</div>'}</div>
        <div class="qq-x2r">${cur ? byLot.get(cur).map(k => `<label><input type="checkbox" data-k="${esc(k)}" ${sel.has(k) ? "checked" : ""}> ${esc(lkName("sec", k.split("|")[1]))}</label>`).join("") : ""}</div></div>`;
      qqWin("TÂCHES SOUMISES À L'ESSAI : " + U_(e.v), `<div class="qq-x2w">${html()}</div>`, () => { e.tasks = [...sel]; qqExtSync(); histLog("QUALITÉ", "ESSAI EXTERNE", U_(e.v) + " — " + sel.size + " TÂCHE(S)"); qqSave(); qqRender(); });
      const d = document.getElementById("svConf"), w = d.querySelector(".qq-x2w");
      w.addEventListener("click", ev => { const b = ev.target.closest(".qq-x2lot"); if (!b) return; ev.stopPropagation(); cur = b.dataset.lo; w.innerHTML = html(); });
      w.addEventListener("change", ev => { const c = ev.target.closest("input[data-k]"); if (!c) return; if (c.checked) sel.add(c.dataset.k); else sel.delete(c.dataset.k); w.innerHTML = html(); });
    };
    /* événements (une seule fois, sur le corps des onglets) */
    if (!body.__qqBound) {
      body.__qqBound = true;
      body.addEventListener("click", e => {
        if (active !== "qlt" || !INS) return;
        const sb = e.target.closest(".qq-sub");
        if (sb) { qqSub = sb.dataset.sub; qqRender(); return; }
        const key = qqKey();
        const fo = e.target.closest(".qq-fold");
        if (fo) { const n = qqNode(key, fo.dataset.id); if (n) { n.f = !n.f; qqSave(); qqRender(); } return; }
        if (!INS_EDIT) return;
        const xt = e.target.closest(".qq-xt");
        if (xt) { const ex = qqData().ext.find(x => x.id === xt.closest("tr").dataset.xid); if (ex) qqExtTasks(ex); return; }
        const td = e.target.closest("td.qq-pick, td.qq-win");
        if (!td || td.classList.contains("qq-ro")) return;
        const f = td.dataset.f;
        const pf = td.closest("tr[data-pf]");
        if (pf) {
          const P = (qqData().per[key] = qqData().per[key] || {});
          qqPick(td, QQ_LISTS[f].map(v => ({ v, lab: v })), P[f] || "", v => { P[f] = v; qqSave(); qqRender(); });
          return;
        }
        const n = qqNode(key, td.closest("tr").dataset.id);
        if (!n) return;
        if (f === "dec") return qqDecWin(key, n);
        if (f === "app") return qqAppWin(key, n);
        const items = f === "ev" ? [{ v: "T", lab: "TÂCHE (GÉNÉRAL)" }, ...(key ? qqElems(key).map(x => ({ v: x.v, lab: x.lab })) : [{ v: "P*", lab: "TOUS LES PRODUITS" }, { v: "C*", lab: "TOUTES LES CHARGES" }])]
          : QQ_LISTS[f].map(v => ({ v, lab: v }));
        qqPick(td, items, n[f] || "", v => { n[f] = v; qqSave(); qqRender(); });
      });
      body.addEventListener("change", e => {
        if (active !== "qlt" || !INS || !INS_EDIT) return;
        const key = qqKey();
        const pin = e.target.closest(".qq-pin");
        if (pin) { const P = (qqData().per[key] = qqData().per[key] || {}); P[pin.dataset.f] = pin.classList.contains("number") ? insNum(pin.value) : U_(pin.value); qqSave(); return; }
        const xin = e.target.closest(".qq-xin");
        if (xin) {
          const Q = qqData(), tr = xin.closest("tr"), f = xin.dataset.f, val = ["p", "cad"].includes(f) ? insNum(xin.value) : U_(xin.value);
          if (tr.classList.contains("qq-xnew")) { if (val) { Q.ext.push({ id: insId(), v: val, u: "ESSAI", p: "", cad: "", u2: "", tasks: [] }); qqSave(); qqRender(".qq-xnew .qq-xin"); } return; }
          const ex = Q.ext.find(x => x.id === tr.dataset.xid);
          if (ex) { ex[f] = val; qqExtSync(); qqSave(); qqRender(); }
          return;
        }
        const cb = e.target.closest(".qq-cb, .qq-cball, .qq-xcb");
        if (cb) {
          if (cb.classList.contains("qq-xcb")) { const ex = qqData().ext.find(x => x.id === cb.closest("tr").dataset.xid); if (ex) ex.on = cb.checked; qqSave(); return; }
          const L = qqList(key);
          if (cb.classList.contains("qq-cball")) L.forEach(x => x.on = cb.checked);
          else { const i = L.findIndex(x => x.id === cb.closest("tr").dataset.id); if (i >= 0) L.slice(i, qqEnd(L, i)).forEach(x => x.on = cb.checked); }
          qqSave(); qqRender();
          return;
        }
        const inp = e.target.closest(".qq-in");
        if (!inp) return;
        const L = qqList(key), tr = inp.closest("tr"), f = inp.dataset.f;
        const val = f === "nra" || f === "nrz" ? insNum(inp.value) : U_(inp.value);
        if (tr.classList.contains("qq-new")) {
          if (!val) return;
          const pi = L.findIndex(x => x.id === tr.dataset.pid);
          if (pi < 0) return;
          const p = L[pi], node = { id: insId(), k: tr.dataset.kind, d: p.d + 1, v: val };
          if (node.k === "c") Object.assign(node, { ev: key ? "T" : "", nc: "RIEN" }, qqCfgDef());
          L.splice(qqEnd(L, pi), 0, node);
          histLog("QUALITÉ", node.k === "p" ? "POINT DE CONTRÔLE AJOUTÉ" : "CRITÈRE AJOUTÉ", val);
          qqSave();
          qqRender(`tr.qq-new[data-pid="${tr.dataset.pid}"] .qq-nin`);
          return;
        }
        const i = L.findIndex(x => x.id === tr.dataset.id);
        if (i < 0) return;
        const n = L[i];
        n[f] = val;
        /* point ou critère entièrement effacé (sans critère dessous) : retiré */
        if (f === "v" && !val && n.k !== "t" && !(n.k === "p" && qqEnd(L, i) > i + 1)
          && (n.k === "p" || QQ_COLS.every(c => !n[c[0]] || (c[0] === "ev" && n.ev === "T") || (c[0] === "nc" && n.nc === "RIEN")))) L.splice(i, 1);
        qqSave(); qqRender();
      });
      /* Entrée = case suivante (FORMAT 48) */
      body.addEventListener("keydown", e => {
        if (active !== "qlt" || e.key !== "Enter") return;
        const inp = e.target.closest(".qq-in, .qq-xin, .qq-pin");
        if (!inp) return;
        e.preventDefault();
        inp.blur();
      }, true);
    }
    /* menu ⋯ du bloc détail quand DÉTAIL QUALITÉ est ouvert : ajouter un titre, supprimer les lignes cochées */
    shell.__qq = {
      on: () => active === "qlt" && !!INS,
      cfg: () => qqCfgWin(),
      io: { head: QQ_IO, exp: () => qqExportRows(), imp: (aoa, rep) => qqImportAoa(aoa, "TEST", true, rep) },
      edit: () => INS_EDIT,
      nChecked: () => qqSub === "ext" ? qqData().ext.filter(x => x.on).length : qqSub === "ctl" ? qqList(qqKey()).filter(x => x.on).length : 0,
      addTitle: () => {
        if (qqSub !== "ctl") { qqSub = "ctl"; }
        const L = qqList(qqKey());
        L.push({ id: insId(), k: "t", d: 0, v: "NOUVEAU TITRE" });
        qqSave(); qqRender();
        const t = body.querySelector(`tr[data-id="${L[L.length - 1].id}"] .qq-lab`);
        if (t) { t.focus(); t.select(); }
      },
      addSub: () => {
        /* sous-titre sous le titre coché (le premier) */
        const L = qqList(qqKey()), i = L.findIndex(x => x.on && x.k === "t");
        if (i < 0) return svToast("COCHER D'ABORD LE TITRE QUI RECEVRA LE SOUS-TITRE");
        const n = { id: insId(), k: "t", d: L[i].d + 1, v: "NOUVEAU SOUS-TITRE" };
        L.splice(qqEnd(L, i), 0, n); L.forEach(x => x.on = false);
        qqSave(); qqRender();
        const t = body.querySelector(`tr[data-id="${n.id}"] .qq-lab`);
        if (t) { t.focus(); t.select(); }
      },
      del: async () => {
        if (qqSub === "ext") {
          const Q = qqData(), n = Q.ext.filter(x => x.on).length;
          if (!n || !(await svConfirm({ title: "SUPPRIMER LES LIGNES COCHÉES", text: n + " ESSAI(S) EXTERNE(S) SERONT SUPPRIMÉS.", ok: "SUPPRIMER" }))) return;
          Q.extGone = Q.ext.filter(x => x.on); Q.ext = Q.ext.filter(x => !x.on); qqExtSync(); qqSave(); qqRender(); return;
        }
        const key = qqKey(), L = qqList(key);
        /* FORMAT 111 : un contrôle ajouté d'office ne se supprime pas à la main */
        const au = L.filter(x => x.on && qqAutoWhy(x));
        if (au.length) { au.forEach(x => { x.on = false; }); svToast(au.length + " LIGNE(S) AJOUTÉE(S) D'OFFICE GARDÉE(S) : " + qqAutoWhy(au[0]), 6000); }
        const n = L.filter(x => x.on).length;
        if (!n) { if (au.length) qqRender(); return; }
        const c = { t: 0, p: 0, c: 0 }; L.filter(x => x.on).forEach(x => c[x.k]++);
        const txt = [c.t && c.t + " TITRE(S)", c.p && c.p + " POINT(S) DE CONTRÔLE", c.c && c.c + " CRITÈRE(S)"].filter(Boolean).join(", ") + " SERONT SUPPRIMÉS.";
        if (!(await svConfirm({ title: "SUPPRIMER LES LIGNES COCHÉES", text: txt, ok: "SUPPRIMER" }))) return;
        const keep = L.filter(x => !x.on);
        L.length = 0; keep.forEach(x => L.push(x));
        histLog("QUALITÉ", "LIGNES SUPPRIMÉES", txt);
        qqSave(); qqRender();
      },
      render: () => qqRender(),
      /* FORMAT 112 : aperçu du bloc = tableau affiché (tâche choisie ou modèle commun), jamais de prix */
      data: () => {
        const key = qqKey();
        if (qqSub === "ext") return { head: ["ESSAI", "UNITÉ", "RYTHME", "TÂCHES", "NB ESSAIS"],
          rows: qqData().ext.map(e => [e.v, e.u, e.cad ? "1 TOUS LES " + e.cad + (e.u2 ? " " + e.u2 : "") : "PAR TÂCHE", String((e.tasks || []).length), String((e.tasks || []).reduce((t, k) => t + qqExtQty(e, k), 0))]) };
        if (qqSub === "per") { const P = qqData().per[key] || {}; return { head: ["EXIGENCE", "VALEUR"], rows: QQ_PER.filter(([f]) => P[f] !== undefined && P[f] !== "").map(([f, lab]) => [lab, String(P[f])]) }; }
        const C = QQ_COLS.filter(c => !["tol", "lrm", "nra"].includes(c[0]));
        const L = qqList(key), rows = [];
        L.forEach(n => {
          const lab = "\u00a0".repeat(3 * n.d) + (n.v || "");
          if (n.k !== "c") { if (n.k === "t" && !L.slice(L.indexOf(n) + 1, qqEnd(L, L.indexOf(n))).some(x => x.k !== "t")) return; rows.push([lab, ...C.map(() => "")]); return; }
          rows.push([lab, ...C.map(([f]) => f === "ev" ? qqEvLab(key, n.ev) : f === "dec" ? qqDecLab(key, n) : f === "app" ? qqAppLab(n) : String(n[f] ?? ""))]);
        });
        return { head: ["POINT DE CONTRÔLE / CRITÈRE", ...C.map(c => c[1])], rows };
      }
    };
    /* v491 (remarque 3) : DÉTAIL CHARGES tient dans la largeur du bloc (cases à cocher visibles) — DÉSIGNATION CHARGE et TÂCHE
       se partagent la place restante, sauf largeur réglée à la main */
    const chgFit = () => {
      const sc = body.querySelector(".bdg-d-scroll"), tbl = sc && sc.querySelector('table.ins-table[data-ik="chg"]');
      if (!tbl || sc.clientWidth < 300) return;
      const W = cwLoad(), cd = tbl.querySelector('col[data-w="chg.detail"]'), ct = tbl.querySelector('col[data-w="chg.tache"]');
      if (!cd || !ct || W["chg.detail"] || W["chg.tache"]) return;
      const cols = [...tbl.querySelectorAll("colgroup col")];
      const others = cols.filter(c => c !== cd && c !== ct).reduce((t, c) => t + (parseFloat(c.style.width) || 0), 0);
      const pr = parseFloat(getComputedStyle(sc).paddingRight) || 0;
      /* v507 (remarque 62) : largeurs calculées une fois pour une largeur de bloc donnée, puis gardées (le tableau ne bouge plus) */
      const M0 = shell.__chgFitM;
      if (M0 && M0.w === sc.offsetWidth && M0.o === others) { cd.style.width = M0.d + "px"; ct.style.width = M0.t + "px"; tbl.style.width = others + M0.d + M0.t + "px"; return; }
      const free = Math.floor(sc.clientWidth - pr - others - 22);   /* marge : en-têtes jamais tronqués (quelques px de plus) */
      const d = Math.max(180, Math.round(free * 0.55)), t = Math.max(95, free - d);
      cd.style.width = d + "px"; ct.style.width = t + "px"; tbl.style.width = others + d + t + "px";
      shell.__chgFitM = { w: sc.offsetWidth, o: others, d, t };
    };
    const cfHasF = t => !!(CF[t] && Object.keys(CF[t].f || {}).length);
    /* v502 (remarque 53) : seul l'onglet source d'un filtre est en bleu — loupe d'une de ses colonnes, « cochées seulement »
       ou cases cochées dans son propre tableau (pas le filtrage venu des cases d'un autre bloc) */
    const insTabFilt = () => {
      if (!INS) return {};
      const own = k => (INS[k] || []).some(r => !r.t && r.on === true);
      /* v539 : onglet en bleu quand SON tableau a une loupe ou une case cochée (remarque 53 : seul l'onglet source) —
         les tâches cochées du DÉTAIL DÉLAIS comptent maintenant aussi */
      return {
        chg: cfHasF(insCfT("chg")) || !!ONLYC.chg || own("chg") || !!insRg(),
        prd: cfHasF(insCfT("prd")) || !!ONLYC.prd || own("prd") || !!insRg(),
        dly: ["dly", "dlyp", "dlys"].some(cfHasF) || !!(shell.__dlySel && shell.__dlySel.size),
        lnk: cfHasF("lk_marge") || (INS.links || []).some(l => l.on === true) || !!insRg(),
        unl: cfHasF("lk_unl"),
        inc: cfHasF("lk_inc") || (INS.inc || []).some(x => x.on === true)
      };
    };
    /* v499 (remarque 42) : EFFACER TOUS LES FILTRES d'un bloc (menu ⋯) — filtres de loupe et cases cochées */
    const insFiltPlan = blk => {
      const T = blk === "client" ? ["client"] : blk === "hier" ? ["lot", "prim", "sec"] : blk === "detail" ? [insCfT("chg"), insCfT("prd"), "dly", "dlyp", "dlyr", "dlyi", "dlys", "lk_marge", "lk_unl", "lk_inc"] : [];
      const K = !INS || !INS_EDIT ? [] : blk === "client" ? ["des"] : blk === "hier" ? ["lot", "prim", "sec"] : blk === "detail" ? ["chg", "prd"] : [];
      const nf = T.filter(cfHasF).length;
      const nc = K.reduce((t, k) => t + (INS[k] || []).filter(r => !r.t && r.on === true).length, 0)
        + (blk === "detail" && INS && INS_EDIT ? (INS.links || []).filter(l => l.on === true).length + (INS.inc || []).filter(x => x.on === true).length : 0);
      return { T, K, n: nf + nc + (blk === "detail" && INS && insRg() ? 1 : 0) };
    };
    const insFiltClear = blk => {
      const P = insFiltPlan(blk);
      P.T.forEach(t => { if (CF[t]) CF[t].f = {}; });
      P.K.forEach(k => { (INS[k] || []).forEach(r => { if (r.on === true) r.on = false; }); ONLYC[k] = false; });
      if (blk === "detail" && INS && INS_EDIT) { (INS.links || []).forEach(l => { if (l.on === true) l.on = false; }); (INS.inc || []).forEach(x => { if (x.on === true) x.on = false; }); }
      if (blk === "detail" && INS && insRg()) INS.hrange = { ...INS.hrange, a: "", b: "" };   /* v560 : traits DÉBUT et FIN remis aux bords */
      if (INS && INS_EDIT) insSave();
      ICL = null; refreshAll();
      svToast("FILTRES ET CASES COCHÉES DU BLOC EFFACÉS.", 2000);
    };
    const insRenderTab = () => {
      { const tl = document.querySelector("#bdgTabs > .blk-tools");
        if (tl) { tl.querySelector(".only-c")?.remove(); if (INS_EDIT && (active === "chg" || active === "prd")) tl.insertAdjacentHTML("afterbegin", onlyBtn(active)); } }
      ["chg", "prd"].forEach(k => {
        const b = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="${k}"]`);
        if (b) b.innerHTML = (SVI_ICON[k] || "") + tabs.find(x => x.key === k).title + (k === "prd" ? ' <b class="req-star">*</b>' : "") + " " + svCnt(insShown(k).length, INS[k].filter(r => !r.t).length);
      });
      { const b = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="qlt"]`);
        if (b) b.innerHTML = (SVI_ICON.qlt || "") + "DÉTAIL QUALITÉ " + svCnt(qqCount()); }
      { const b = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="dly"]`);
        if (b) b.innerHTML = (SVI_ICON.dly || "") + "DÉTAIL DÉLAIS " + svCnt(INS_EDIT ? dlyKeys().length : insTasks().length); }
      /* IMPORT NON CRÉÉ : visible seulement s'il reste des lignes */
      { const b = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="inc"]`), n = (INS.inc || []).length;
        if (b) { b.innerHTML = (SVI_ICON.hier || "") + "IMPORT NON CRÉÉ " + svCnt(n); b.hidden = !n; b.style.display = n ? "" : "none"; }
        if (!n && active === "inc") { active = "prd"; try { localStorage.setItem("svi_dtab_v1", "prd"); } catch (e) {} document.querySelectorAll("#bdgTabs .bdg-d-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === active)); } }
      { const b = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="lnk"]`);
        if (b) b.innerHTML = (SVI_ICON.xpl || "") + "MARGE " + svCnt((INS.links || []).length); }
      sviMarkEmptyTabs(shell);
      /* v499 (remarque 40) : onglet en bleu quand son tableau est filtré (loupe d'une colonne, cases cochées de ce tableau
         ou d'un autre bloc) — on voit où enlever un filtre sans ouvrir les onglets un par un */
      try {
        const TF = insTabFilt();
        document.querySelectorAll("#bdgTabs .bdg-d-tab").forEach(b => { const on = !!TF[b.dataset.tab]; b.classList.toggle("tab-filt", on); if (on) b.title = "FILTRE APPLIQUÉ"; else if (b.title === "FILTRE APPLIQUÉ") b.removeAttribute("title"); });
      } catch (e) {}
      /* onglet actif (liaisons validées, lignes non liées, import non créé) : « retenues/total » une fois dessiné */
      setTimeout(() => {
        const ls = lastShown.detail;
        if (!ls || !["lnk", "unl", "inc"].includes(ls.kind) || ls.kind !== active) return;
        const b = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="${active}"] .svi-cnt`);
        const tot = active === "lnk" ? (INS.links || []).length : active === "inc" ? (INS.inc || []).length : insUnlCount();
        if (b) b.outerHTML = svCnt(ls.rows.length, tot);
      }, 0);
      if (active === "dly") {
        /* délais : saisis ici (périodes par tâche secondaire ; tâche primaire choisie = récapitulatif) */
        body.innerHTML = `<div class="bdg-d-scroll dly-scroll">${insDlyHTML(INS_EDIT, shell.__insDly && shell.__insDly.err)}</div>`;
        /* v454 : nouvelle tâche choisie par les ronds → le PLANNING défile jusqu'à sa ligne (surlignée) */
        /* v464 : ronds changés → tableau ouvert s'il était caché, première tâche surlignée en haut du tableau et du Gantt */
        { const pk = [LK.des, LK.lot, LK.prim, LK.sec, Object.keys(LK.prd || {}).join(","), Object.keys(LK.chg || {}).join(",")].join("|");
          if (pk !== shell.__dlyPickK) { shell.__dlyPickK = pk; if (shell.__dlyPS && shell.__dlyPS.size) setTimeout(() => {
            if (shell.__dlyOpenToDur) shell.__dlyOpenToDur();
            setTimeout(() => {
              const tr = body.querySelector(".dlyg-l tr.dly-pick"), sc = body.querySelector(".bdg-d-scroll");
              if (!tr || !sc) return;
              const th = tr.closest("table").querySelector("thead"), hh = th ? th.getBoundingClientRect().height : 0;
              sc.scrollTop += tr.getBoundingClientRect().top - sc.getBoundingClientRect().top - hh;
              const host = body.querySelector("#dlyGantt"), bar = host && host.querySelector(`.gb[data-key="${CSS.escape(tr.dataset.key)}"]`);
              if (bar) host.scrollLeft = Math.max(0, bar.offsetLeft - 3 * (DLY_DW || 20));
            }, 80);
          }, 60); } }
        return;
      }
      if (active === "qlt") { qqRender(); lastShown.detail = { cols: [], rows: [], kind: "qlt" }; return; }
      if (active === "lnk") { body.innerHTML = `<div class="bdg-d-scroll">${insRgView(xplHTML)}</div>`; return; }
      if (active === "unl") { body.innerHTML = `<div class="bdg-d-scroll">${insUnlHTML()}</div>`; insMarkUnlinked(); return; }
      if (active === "inc") { body.innerHTML = `<div class="bdg-d-scroll">${insIncHTML()}</div>`; return; }
      if (active === "prd" && shell.__prdSyncU) shell.__prdSyncU();
      body.innerHTML = `<div class="bdg-d-scroll">${insTableHTML(active)}</div>`;
      if (active === "chg") chgFit();
      shell.__insMore = () => insMoreRows(active);
      lastShown.detail = { cols: insCfCols(active), rows: insShown(active), kind: active, ins: true };
      insMarkUnlinked();
    };
    /* met à jour les montants calculés, sous-totaux et totaux sans redessiner
       (la saisie en cours garde le clavier) */
    const insLive = (k, tr, r) => {
      const tbl = tr.closest("table");
      /* case fautive de la ligne encadrée en rouge (FORMAT 75) */
      if (k === "prd" || k === "chg") {
        const er = insRowErr(k, r);
        tr.querySelectorAll("td.ins-td").forEach(td => {
          const on = !!er && td.querySelector("input")?.dataset.f === er.f;
          td.classList.toggle("ins-bad", on);
          if (on) td.dataset.why = er.m; else delete td.dataset.why;
        });
      }
      /* FORMAT 124 : ART calculés et doublons d'ART mis à jour à la frappe */
      if (k === "des") {
        artRefresh(); insRowErr.__t = Date.now();
        tbl.querySelectorAll("tr[data-iid]").forEach(row => {
          const rr = INS.des.find(x => x.id === row.dataset.iid);
          const ai = row.querySelector('.ins-in[data-f="art"]');
          if (!rr || !ai) return;
          ai.placeholder = String(rr.art ?? "").trim() ? "" : (ART_AUTO.get(rr.id) || "");
          const er = insRowErr("des", rr), td = ai.closest("td"), on = !!er && er.f === "art";
          td.classList.toggle("ins-bad", on);
          if (on) td.dataset.why = er.m; else if (td.dataset.why && /^ART /.test(td.dataset.why)) delete td.dataset.why;
        });
      }
      tr.querySelectorAll(".ins-in").forEach(inp => {
        const f = inp.dataset.f;
        const c = INS_COLS[k].find(x => x[0] === f);
        if (!c || inp === document.activeElement) return;
        const qAuto = (f === "q" && (k === "prd" || k === "des")) || (f === "p" && k === "prd") || (f === "tva" && k === "prd");
        if (c[3] === "calc" || qAuto) inp.value = r.t ? "" : insFmt(insCalc(k, r, f));
      });
      if (k === "des") {
        tbl.querySelectorAll("tr.ins-sub").forEach(s => {
          const t = INS.des.find(x => x.id === s.dataset.sub);
          if (!t) return;
          const i0 = INS.des.indexOf(t);
          let ht = 0, ttc = 0;
          for (let i = i0 + 1; i < INS.des.length; i++) {
            const x = INS.des[i];
            if (dOf(x) <= dOf(t)) break;
            if (!x.t) { ht += insHT(k, x); ttc += insTTC(k, x); }
          }
          s.querySelector(".ins-sht").textContent = money(ht);
          s.querySelector(".ins-sttc").textContent = money(ttc);
        });
      }
      const ft = tbl.querySelector("tfoot");
      if (ft) ft.innerHTML = insFootHTML(k);
    };
    /* redessine le bloc (structure changée) si le doigt n'est plus dedans */
    const insRedraw = k => {
      /* seul ce bloc est redessiné : la saisie ailleurs garde le clavier */
      const box = k === "des" ? shell.querySelector(".bdg-d-client-scroll")
        : (k === "chg" || k === "prd" || k === "qlt") ? body.querySelector(".bdg-d-scroll")
        : $("bdgHier")?.querySelector(`.ins-hcol[data-ik="${k}"]`);
      const top = box ? box.scrollTop : 0;
      const x = window.scrollX, y = window.scrollY;
      if (k === "des") insRenderClient();
      else if (k === "chg" || k === "prd" || k === "qlt") insRenderTab();
      else insRenderHier(k);
      if (k === "prim" && insTwins()) { insSave(); insRenderHier("sec"); }
      insMarkUnlinked();
      const nb = k === "des" ? shell.querySelector(".bdg-d-client-scroll")
        : (k === "chg" || k === "prd" || k === "qlt") ? body.querySelector(".bdg-d-scroll")
        : $("bdgHier")?.querySelector(`.ins-hcol[data-ik="${k}"]`);
      if (nb) nb.scrollTop = top;
      window.scrollTo(x, y);
    };
    /* ligne vide (FORMAT 90) : toutes ses cases saisissables effacées (TVA par défaut, PCB / TVA de CHS ne comptent pas) */
    const INS_ENTRY = { des: ["art", "des", "u"], chg: ["art", "des", "u", "q"], prd: ["des", "u", "nbr", "d1", "d2", "d3"], lot: ["v"], prim: ["v"], sec: ["v"], qlt: ["v"] };
    const insRowEmpty = (k, r) => r.t ? !String(r.art || "").trim() && !String(r.des || "").trim()
      : (INS_ENTRY[k] || Object.keys(r).filter(f => !["id", "on", "t", "tw", "d"].includes(f))).concat(k === "chg" && !r.chs ? ["p"] : [])
        .every(f => String(r[f] ?? "").trim() === "");
    const insClean = k => {
      const used = ["des", "lot", "prim", "sec", "prd", "chg"].includes(k) ? insUsed()[k] : new Set();
      const empty = r => insRowEmpty(k, r) && !used.has(r.id);
      const before = INS[k].length;
      INS[k] = INS[k].filter(r => !empty(r));
      return INS[k].length !== before;
    };
    /* v482 (remarque 20) : une ligne dont on tape l'ART prend sa place selon cet ART (même s'il est en erreur, rouge) :
       sous le titre dont l'ART est le préfixe (sinon au premier niveau), avant le premier voisin d'ART plus grand */
    const desPlaceByArt = id => {
      const L = INS.des, r = L.find(x => x.id === id);
      if (!r || r.t) return false;
      const a = String(r.art ?? "").trim();
      if (!a) return false;
      try { artRefresh(); } catch (e) {}
      const segs = a.split(".").filter(Boolean), pre = segs.slice(0, -1).join(".");
      const D = x => Number(x.d) || 0;
      const rest = L.filter(x => x !== r);
      let pi = -1, pd = -1;
      if (pre) { pi = rest.findIndex(x => x.t && artOf(x) === pre); if (pi >= 0) pd = D(rest[pi]); }
      if (pre && pi < 0) return false;   /* titre parent introuvable : la ligne reste où elle est */
      const start = pi + 1;
      let end = start; while (end < rest.length && (pi < 0 || D(rest[end]) > pd)) end++;
      let at = end;
      for (let j = start; j < end; j++) { const x = rest[j]; if (D(x) !== pd + 1) continue; if (natCmp(artOf(x), a) > 0) { at = j; break; } }
      const old = L.indexOf(r);
      rest.splice(at, 0, r);
      r.d = pd + 1;
      if (rest.indexOf(r) === old && L.every((x, n) => x === rest[n])) return false;
      L.splice(0, L.length, ...rest);
      insNorm(); insSave();
      return true;
    };
    shell.__ins = INS_EDIT ? { INS, insFoots, refreshAll: () => { ICL = null; refreshAll(); }, artPlace: id => { if (desPlaceByArt(id)) { const c = shell.querySelector(".bdg-d-client-scroll"); if (c && !c.contains(document.activeElement)) insRedraw("des"); } },
      /* v468 : mise à jour JUSTE APRÈS une saisie (ENTRÉE ou case quittée), sans attendre de toucher hors du tableau :
         la liste où l'on saisit garde le clavier (seul son compteur change) ; tout le reste est redessiné aussitôt */
      afterEntry: (k, box) => {
        if (actUnitSync()) insSave();
        if (k === "prim" && insTwins()) insSave();
        ["lot", "prim", "sec"].filter(x => x !== k).forEach(x => { const c = $("bdgHier")?.querySelector(`.ins-hcol[data-ik="${x}"]`); if (c && !c.contains(document.activeElement)) insRenderHier(x); });
        if (k !== "des") { const c = shell.querySelector(".bdg-d-client-scroll"); if (c && !c.contains(document.activeElement)) insRenderClient(); }
        const lab = box && box.querySelector(".svi-cnt"); if (lab && ["lot", "prim", "sec"].includes(k)) lab.outerHTML = svCnt(box.querySelectorAll(":scope > .ins-li[data-iid]").length, INS[k].length);
        shell.__ins.tabNoBlur();
        insMarkUnlinked();
      },
      /* onglet de détail redessiné sans quitter la case en cours (keepScroll la ferait perdre) : défilements gardés à la main */
      tabNoBlur: () => {
        const bd = $("bdgTabBody");
        if (!bd || bd.contains(document.activeElement)) return;
        const sel = ".bdg-d-tabbody .bdg-d-scroll, .bdg-d-tabbody .dlyg-l, .bdg-d-tabbody .dlyg-r";
        const sv = [...shell.querySelectorAll(sel)].map(el => [el.scrollTop, el.scrollLeft]), wx = window.scrollX, wy = window.scrollY;
        renderTab();
        [...shell.querySelectorAll(sel)].forEach((el, i) => { if (sv[i]) { el.scrollTop = sv[i][0]; el.scrollLeft = sv[i][1]; } });
        window.scrollTo(wx, wy);
      },
      rowErr: (k, r) => insRowErr(k, r), cleanLinks: () => insCleanLinks(), rdbApply: (ids, R, a) => chgRdbApply(ids, R, a), lkRd: (k, r) => lkRd(k, r), insDelCell: r => insDelCell(r), insDim, insShown, insId, insSave, insNum, insLive, insRedraw, insClean, insRowHTML, insLevel, insBranch, insSyncTitles,
      /* ligne utilisée par une liaison (validée, ou déliée mais pas encore validée) : suppression interdite */
      isUsed: (k, id) => {
        if (!["des", "lot", "prim", "sec", "prd", "chg"].includes(k)) return false;
        let bak = null;
        try { bak = LK.linksBak; } catch (e) {}
        return [INS.links || [], bak || []].some(L => L.some(l => k === "prd" || k === "chg" ? (l[k] || []).some(x => x.id === id) : l[k] === id));
      } } : null;
    /* v495 (remarque 24) : case d'une ligne regroupée = coche / décoche toutes les charges qu'elle réunit */
    if (!shell.__gcbBound) {
      shell.__gcbBound = true;
      /* v505 (remarque 56) : case du titre de charges regroupées modifiée = toutes ses lignes */
      shell.addEventListener("change", e => {
        const i = e.target.closest && e.target.closest("input.ins-gin"), X = shell.__ins;
        if (!i || !X) return;
        e.stopPropagation();
        const ids = new Set((i.closest("tr[data-grp]")?.dataset.grp || "").split(",").filter(Boolean));
        /* v524 : rendement tapé sur le titre */
        if (i.dataset.f === "rdb") { i.__rdbDone = true; X.rdbApply(ids, X.insNum(i.value), i); return; }
        const G = X.INS.chg.filter(r => ids.has(r.id));
        const f = i.dataset.f, num1 = f === "p" || f === "tva";
        const val = num1 ? X.insNum(i.value) : sviClean(String(i.value || "")).toUpperCase();
        if (!G.length) return;
        if (f === "des" && !val) { svToast("DÉSIGNATION OBLIGATOIRE.", 2500, i); X.refreshAll(); return; }
        /* une désignation de charge n'a qu'une unité et qu'un article dans tout le budget (remarque 10) */
        const nx = { des: f === "des" ? val : G[0].des, u: f === "u" ? val : G[0].u, art: f === "art" ? val : G[0].art };
        const o = X.INS.chg.find(x => !ids.has(x.id) && !x.t && U_(x.des) === U_(nx.des) && ((U_(x.u) && U_(nx.u) && U_(x.u) !== U_(nx.u)) || (U_(x.art) && U_(nx.art) && U_(x.art) !== U_(nx.art))));
        if (o) { svToast(U_(nx.des) + " EXISTE DÉJÀ" + (U_(o.art) ? " (ARTICLE " + U_(o.art) + ")" : "") + " EN " + U_(o.u) + " : UNE DÉSIGNATION N'A QU'UNE UNITÉ ET UN ARTICLE.", 5000, i); X.refreshAll(); return; }
        G.forEach(r => { r[f] = val; });
        X.insSave();
        if (typeof histLog === "function") histLog("SAISIE", "CHARGES REGROUPÉES", G.length + " LIGNE(S) — " + f.toUpperCase() + " = " + (num1 ? money(val || 0) : val));
        X.refreshAll();
      }, true);
      /* v524 (remarque 5) : Entrée sur le rendement du titre SANS l'avoir changé = l'appliquer quand même à toutes ses lignes */
      shell.addEventListener("keydown", e => {
        if (e.key !== "Enter") return;
        const i = e.target.closest && e.target.closest("input.ins-rdbin"), X = shell.__ins;
        if (!i || !X || String(i.value).trim() !== String(i.defaultValue).trim()) return;
        const ids = new Set((i.closest("tr[data-grp]")?.dataset.grp || "").split(",").filter(Boolean));
        X.rdbApply(ids, X.insNum(i.value), i);
      }, true);
      /* v499 (remarque 45) : plier / déplier un titre de charges regroupées */
      shell.addEventListener("click", e => {
        const b = e.target.closest && e.target.closest(".ins-gfold, .ins-gfz"), X = shell.__ins;
        if (!b || !X) return;
        e.stopPropagation(); e.preventDefault();
        const O = shell.__chgGOpen; if (O.has(b.dataset.gk)) O.delete(b.dataset.gk); else O.add(b.dataset.gk); shell.__chgGSave();
        X.refreshAll();
      }, true);
      shell.addEventListener("change", e => {
        const cb = e.target.closest && e.target.closest("input.ins-gcb"), X = shell.__ins;
        if (!cb || !X) return;
        const ids = new Set((cb.closest("tr[data-grp]")?.dataset.grp || "").split(",").filter(Boolean));
        const gk = cb.closest("table[data-ik]")?.dataset.ik === "prd" ? "prd" : "chg";   /* v516 : produits regroupés aussi */
        X.INS[gk].forEach(r => { if (ids.has(r.id)) r.on = cb.checked; });
        X.insSave(); X.refreshAll();
      }, true);
    }
    /* FORMAT 111 : case AGRÉMENT EXIGÉ d'une charge */
    if (!shell.__chkBound) {
      shell.__chkBound = true;
      shell.addEventListener("change", e => {
        const cb = e.target.closest && e.target.closest("input.ins-chk");
        const X = shell.__ins;
        if (!cb || !X) return;
        const h = cb.closest("[data-iid]"), k = cb.closest("[data-ik]")?.dataset.ik;
        const r = h && k && X.INS[k] ? X.INS[k].find(x => x.id === h.dataset.iid) : null;
        if (!r) return;
        r[cb.dataset.f] = cb.checked;
        X.insSave();
        svToast(cb.checked ? "AGRÉMENT EXIGÉ : CONTRÔLE « AGRÉMENT FOURNI » AJOUTÉ SOUS MATIÈRE DANS LE DÉTAIL QUALITÉ DE SES TÂCHES." : "AGRÉMENT N'EST PLUS EXIGÉ : CONTRÔLE « AGRÉMENT FOURNI » RETIRÉ.", 3500, cb);
      }, true);
    }
    if (!shell.__insBound) {
      shell.__insBound = true;
      shell.addEventListener("input", e => {
        const X = shell.__ins;
        const inp = e.target.closest(".ins-in");
        if (!X || !inp) return;
        const holder = inp.closest("[data-ik]");
        if (!holder) return;   /* délais : gérés à part */
        const k = holder.dataset.ik;
        const f = inp.dataset.f;
        const c = (X.insRowHTML && ["des", "chg", "prd"].includes(k)) ? true : false;
        let r = holder.dataset.iid ? X.INS[k].find(x => x.id === holder.dataset.iid) : null;
        let created = false;
        if (!r) {
          created = true;
          /* première frappe dans la ligne vide : la ligne est créée */
          r = { id: X.insId(), on: false };   /* nouvelle ligne : décochée par défaut */
          if (k === "des") {
            r.t = false; r.tva = 20;   /* TVA 20 % par défaut */
            /* niveau : celui de la dernière ligne (ou dans le dernier titre) */
            const last = X.INS.des[X.INS.des.length - 1];
            r.d = !last ? 0 : last.t ? (Number(last.d) || 0) + 1 : (Number(last.d) || 0);
          }
          if (k === "prd" && shell.__lkSecU && shell.__lkSecU()) r.u = shell.__lkSecU();
          X.INS[k].push(r);
          holder.dataset.iid = r.id;
          holder.classList.remove("ins-new");
          inp.removeAttribute("placeholder");
          const cbc = holder.querySelector(".ins-cbc");
          if (cbc) cbc.innerHTML = `<input type="checkbox" class="ins-cb">`;
          const tc = holder.querySelector(".ins-tc");
          if (tc) tc.innerHTML = `<span class="ins-t" role="button" title="Ligne titre">T</span>`;
          if (k === "des") X.insDim();
          /* nouvelle ligne vide dessous */
          if (c) {
            const tmp = document.createElement("tbody");
            tmp.innerHTML = X.insRowHTML(k, null, 0);
            holder.after(tmp.firstElementChild);
          } else {
            const d = document.createElement("div");
            d.className = "ins-li ins-new";
            d.dataset.ik = k;
            d.innerHTML = `<span class="ins-rdc"></span><input class="ins-in" data-f="v" enterkeyhint="next" placeholder="SAISIR ICI…" autocomplete="off">${k === "sec" ? `<span class="act-u"><input class="ins-in act-uin" data-f="u" enterkeyhint="next" placeholder="U" autocomplete="off"></span>` : k === "prim" ? `<span class="act-u act-uro"></span>` : ""}<span class="ins-delc"></span>`;
            /* v467 : une seule ligne SAISIR ICI… par liste — l'ancienne (restée vide) disparaît, la nouvelle va en bas */
            const col = holder.closest(".ins-hcol");
            if (col) col.querySelectorAll(".ins-new").forEach(o => { if (o !== d && !o.dataset.iid) o.remove(); });
            (col || holder.parentElement).appendChild(d);
            const lab = holder.closest(".ins-hcol")?.querySelector(".svi-cnt");
            if (lab) lab.textContent = X.INS[k].length;
            /* v523 (remarque 3) : ligne de liste créée dès la 1re lettre avec son rond et sa case à cocher (la case en saisie n'est pas touchée) */
            try {
              const rd = holder.querySelector(":scope > .ins-rdc"), dc = holder.querySelector(":scope > .ins-delc");
              if (rd && X.lkRd && !rd.querySelector(".lk-rd")) rd.innerHTML = X.lkRd(k, r);
              if (dc && X.insDelCell && !dc.querySelector("input")) dc.innerHTML = X.insDelCell(r);
            } catch (err) {}
          }
        }
        const isNum = sviIm(inp) === "decimal";
        /* LOTS en arborescence : la case montre le dernier niveau, le chemin du dessus est gardé (data-pre) */
        r[f] = isNum ? inp.value.trim() : (inp.dataset.pre || "") + inp.value.toUpperCase();
        if (isNum) r[f] = r[f] === "" ? "" : X.insNum(r[f]);
        if (c) X.insLive(k, holder, r);
        /* v478 (remarque 8) : ligne créée dès la 1re lettre avec tout son équipement (rond, case à cocher, cases grises) ;
           la case en cours de saisie n'est pas touchée (le clavier reste) */
        if (created && c && X.insRowHTML && holder.tagName === "TR") {
          try {
            const tmp = document.createElement("tbody");
            tmp.innerHTML = X.insRowHTML(k, r, Number(r.d) || 0);
            const nt = tmp.firstElementChild;
            if (nt && nt.children.length === holder.children.length) {
              [...nt.children].forEach((td, j) => { const old = holder.children[j]; if (!old.contains(document.activeElement)) old.replaceWith(td); });
              holder.className = nt.className; [...nt.attributes].forEach(a => { if (a.name.startsWith("data-")) holder.setAttribute(a.name, a.value); });
            }
          } catch (err) {}
        }
        X.insSave();
        /* v470 : UPB / PPB / TVA d'une désignation tapés → produits de ses liaisons primaires (DÉTAIL PRODUITS) à jour à la frappe */
        /* v472 : activité secondaire — unité obligatoire dès l'intitulé (cadre à jour à la frappe) ; unité changée → produits liés à jour */
        if (k === "sec") { const uc = holder.querySelector(".act-u"); if (uc) { const miss = !!U_(r.v) && !U_(r.u); uc.classList.toggle("act-umiss", miss); if (miss) uc.dataset.why = "UNITÉ OBLIGATOIRE"; else delete uc.dataset.why; } }
        if (k === "sec" && f === "u" && X.tabNoBlur) { clearTimeout(shell.__prdLiveT); shell.__prdLiveT = setTimeout(() => { if (shell.__prdSyncU) shell.__prdSyncU(); X.tabNoBlur(); }, 120); }
        if (k === "des" && ["u", "p", "tva"].includes(f) && X.tabNoBlur) { clearTimeout(shell.__prdLiveT); shell.__prdLiveT = setTimeout(() => { if (f === "u" && shell.__prdSyncU) shell.__prdSyncU(); X.tabNoBlur(); }, 120); }
      });
      /* v467 : garde-fou — jamais deux lignes SAISIR ICI… dans une même liste (on garde la dernière) */
      shell.addEventListener("focusout", () => setTimeout(() => {
        shell.querySelectorAll(".ins-hcol").forEach(c => { const n = [...c.querySelectorAll(":scope > .ins-new")]; n.slice(0, -1).forEach(o => { const i = o.querySelector("input"); if (!o.dataset.iid && i && !i.value && i !== document.activeElement) o.remove(); }); });
      }, 0));
      shell.addEventListener("click", e => {
        const X = shell.__ins;
        if (!X) return;
        /* 🗑 d'une ligne */
        const xb = e.target.closest(".ins-x");
        if (xb) {
          e.stopPropagation();
          const h = xb.closest("[data-iid]");
          const k = h?.dataset.ik;
          const r = k && X.INS[k].find(x => x.id === h.dataset.iid);
          if (!r) return;
          const br = r.t ? X.insBranch(r).filter(x => x.on === true) : [];
          /* une donnée ne se supprime que si elle est déliée de partout */
          const used = [r, ...br].filter(x => !x.t && X.isUsed(k, x.id));
          if (used.length) { svToast("SUPPRESSION REFUSÉE : " + (used[0].des || used[0].v || used[0].art || "") + (used.length > 1 ? " ET " + (used.length - 1) + " AUTRE(S)" : "") + " EST LIÉ(E). DÉLIEZ D'ABORD."); return; }
          svConfirm({ title: r.t ? "SUPPRIMER LE TITRE" : "SUPPRIMER LA LIGNE", text: (r.des || r.v || r.art || "") + (br.length ? " ET " + br.length + " LIGNE(S) COCHÉE(S)" : ""), ok: "SUPPRIMER" }).then(go => {
            /* ANNULER : la ligne est décochée (la case revient à la place du 🗑) */
            if (!go) { if (r.t) X.insBranch(r).forEach(x => { x.on = false; }); r.on = false; X.insSave(); (X.refreshAll ? X.refreshAll() : (X.insRedraw(k), X.insFoots && X.insFoots())); return; }
            const gone = new Set([r.id, ...br.map(x => x.id)]);
            X.INS[k] = X.INS[k].filter(x => !gone.has(x.id));
            /* v523 (remarque 4) : tous les blocs redessinés (plus de filtre sur une ligne supprimée) */
            X.cleanLinks(); X.insSave(); (X.refreshAll ? X.refreshAll() : (X.insRedraw(k), X.insFoots && X.insFoots()));
          });
          return;
        }
        /* case d'en-tête et 🗑 d'en-tête (lignes cochées) */
        const ca = e.target.closest("input.ins-cball");
        const xa = e.target.closest(".ins-xall");
        if (ca || xa) {
          e.stopPropagation();
          const box = e.target.closest("table.ins-table, .ins-hcol");
          const k = box?.dataset.ik;
          if (!k) return;
          /* v528 (remarque 2) : case carrée d'en-tête = TOUTES les lignes de la liste, y compris celles des groupes repliés */
          const HL = shell.__hierList && shell.__hierList[k];
          const vis = k === "lot" || k === "prim" || k === "sec"
            ? (HL ? HL.map(id => X.INS[k].find(x => x.id === id)) : [...box.querySelectorAll(".ins-li[data-iid]")].map(li => X.INS[k].find(x => x.id === li.dataset.iid))).filter(Boolean)
            : X.insShown(k).filter(x => !x.t);
          if (ca) {
            /* FORMAT 125 : tout cocher coche aussi les titres (désignations) */
            (k === "des" ? X.insShown(k) : vis).forEach(r => { r.on = ca.checked; });
            X.insSave(); (X.refreshAll ? X.refreshAll() : (X.insRedraw(k), X.insFoots && X.insFoots()));
            return;
          }
          const del = vis.filter(r => r.on === true);
          if (!del.length) return;
          const used = del.filter(r => X.isUsed(k, r.id));
          if (used.length) { svToast("SUPPRESSION REFUSÉE : " + used.length + " LIGNE(S) COCHÉE(S) SONT LIÉES. DÉLIEZ-LES D'ABORD."); return; }
          svConfirm({ title: "SUPPRIMER LES LIGNES COCHÉES", text: del.length + " LIGNE(S) SERONT SUPPRIMÉES.", ok: "SUPPRIMER" }).then(go => {
            /* ANNULER : toutes les lignes sont décochées */
            if (!go) { vis.forEach(r => { r.on = false; }); X.insSave(); (X.refreshAll ? X.refreshAll() : (X.insRedraw(k), X.insFoots && X.insFoots())); return; }
            const ids = new Set(del.map(r => r.id));
            X.INS[k] = X.INS[k].filter(x => !ids.has(x.id));
            X.cleanLinks(); X.insSave(); (X.refreshAll ? X.refreshAll() : (X.insRedraw(k), X.insFoots && X.insFoots()));
          });
          return;
        }
        const t = e.target.closest(".ins-t");
        const cb = e.target.closest("input.ins-cb");
        if (!t && !cb) return;
        e.stopPropagation();
        const holder = e.target.closest("[data-ik]");
        const k = holder.dataset.ik;
        const r = X.INS[k].find(x => x.id === holder.dataset.iid);
        if (!r) return;
        if (cb && r.t) {
          /* case d'un titre : coche / décoche toute sa branche ; titre vide : le titre lui-même */
          const br = X.insBranch(r);
          r.on = cb.checked;   /* le titre lui-même est coché (copier / couper / déplacer l'emportent) */
          br.forEach(x => { x.on = cb.checked; });
          X.insSave(); (X.refreshAll ? X.refreshAll() : (X.insRedraw(k), X.insFoots && X.insFoots()));
          return;
        }
        if (cb) {
          r.on = cb.checked; X.insSave(); if (k === "des") { X.insDim(); X.insSyncTitles(); }
          /* ligne cochée : elle remonte (après les lignes au rond coché) */
          (X.refreshAll ? X.refreshAll() : (X.insRedraw(k), X.insFoots && X.insFoots()));
          return;
        }
        /* ligne titre : unité, quantité, prix, TVA masqués et verrouillés, mais gardés
           (retour possible) ; seule la validation du budget les efface */
        r.t = !r.t;
        X.insSave();
        X.insRedraw(k);
      }, true);
      /* touche Entrée : case suivante (fin de ligne : 1re case de la ligne suivante) */
      /* (Entrée / Tab : voir la règle générale FORMAT 93, plus bas) */
      shell.addEventListener("change", e => {
        const X = shell.__ins;
        const inp = e.target.closest && e.target.closest(".ins-in");
        if (!X || !X.afterEntry || !inp || !inp.closest("[data-ik]")) return;
        const box = inp.closest("table.ins-table, .ins-hcol");
        const k = box?.dataset.ik;
        if (!k) return;
        setTimeout(() => {
          if (k === "des" && inp.dataset.f === "art" && X.artPlace) { const h = inp.closest("[data-iid]"); if (h) X.artPlace(h.dataset.iid); }
          if (!shell.__insDragging && box.isConnected) X.afterEntry(k, box);
        }, 0);
      });
      /* le doigt quitte un bloc : lignes vidées retirées, titres et sous-totaux remis en place */
      shell.addEventListener("focusout", e => {
        const X = shell.__ins;
        const inp = e.target.closest && e.target.closest(".ins-in");
        if (!X || !inp) return;
        const box = inp.closest("table.ins-table, .ins-hcol");
        const k = box?.dataset.ik;
        if (!k) return;
        setTimeout(() => {
          if (box.contains(document.activeElement) || shell.__insDragging) return;
          X.insClean(k);
          X.insSave();
          X.insRedraw(k);
        }, 0);
      });
    }

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
      try { infMissing().filter(x => x.req).forEach(x => out.push(x)); } catch (e) {}
      { const nu = INS.sec.filter(x => U_(x.v) && !U_(x.u)); if (nu.length) out.push({ lab: "ACTIVITÉS SECONDAIRES SANS UNITÉ", n: nu.length, go: "hier" }); }
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
        figeGo(b);
      });
    };
    const figeGo = b => {
        if (!b || !b.go) return;
        if (b.go === "inf") { openInfo(); return; }
        if (b.go === "hier") { const c = shell.querySelector('.ins-hcol[data-ik="sec"]'); if (c) { c.scrollIntoView({ block: "center", behavior: "smooth" }); const m = c.querySelector(".act-umiss input"); if (m) setTimeout(() => m.focus(), 350); } return; }
        if (b.go === "des") { shell.querySelector(".bdg-d-client-scroll")?.scrollIntoView({ block: "start", behavior: "smooth" }); return; }
        if (b.go === "dly") { LK.lot = LK.sec = LK.prim = null; }
        const t = shell.querySelector(`#bdgTabs .bdg-d-tab[data-tab="${b.go}"]`);
        if (t) { t.click(); t.scrollIntoView({ block: "start", behavior: "smooth" }); }
    };
