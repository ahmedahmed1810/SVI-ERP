    /* =========================================================
       BUDGET EN INSTANCE : SAISIE DIRECTE
       - dernière ligne de chaque bloc vide : on la touche et on écrit,
         la ligne est créée (case à cocher au début) et une nouvelle
         ligne vide apparaît dessous ;
       - désignations : case T = ligne titre (seuls ART et DÉSIGNATION
         sont saisissables), niveaux I / I.1 / I.1.1, sous-total par titre ;
       - budget figé : lecture seule.
       ========================================================= */
    const INS = budget.inst
      ? (budget.inst.data = Object.assign(
          { des: [], lot: [], prim: [], sec: [], chg: [], prd: [], qlt: [], dly: {}, links: [] },
          budget.inst.data || {}))
      : null;
    const INS_EDIT = !!INS && (budget.inst.state || "instance") === "instance";
    /* v448 : largeur tableau / Gantt tirée à la main, retrouvée à l'ouverture de ce budget */
    const DLYG_REF = (budget.inst && budget.inst.ref) || budget.ref || "";
    const dlygMine = o => !!o && (o.ins === INS || (DLYG_REF && o.ref === DLYG_REF));
    if (INS) { const vs = window.__sviViewGet && window.__sviViewGet("bdg:" + budget.inst.ref); if (vs && typeof vs.w === "number" && vs.w >= 0) { shell.__dlygW = { ins: INS, ref: DLYG_REF, w: vs.w, auto: false }; if (vs.pw) shell.__dlygPrevW = vs.pw; } if (vs && vs.gx !== undefined) shell.__dlyGx = vs.gx; }
    const INS_DLP_MIG = !!INS && (sviDlpSec(INS) | sviDlpOne(INS) | sviDpredTyped(INS)) > 0;
    /* calendrier du budget (jours travaillés) : durées et décalages en jours travaillés */
    const insCal = () => sviCalOf(INS);
    /* budget en instance (rouge) : les charges venues de CHS suivent CHS (prix, TVA, unité…) ;
       figé (vert) ou validé (noir) : on garde les valeurs du moment */
    if (INS_EDIT) (INS.chg || []).forEach(r => {
      const c = r.chs && chsById(r.chs);
      if (!c) return;
      r.art = c.article ?? r.art; r.des = c.designation ?? r.des; r.u = c.unit ?? r.u; r.p = c.pcs; r.tva = c.tva;
    });
    let insSeq = Date.now();
    const insId = () => "i" + (insSeq++).toString(36);
    const U_ = v => String(v ?? "").trim().toUpperCase();
    let insTimer = null;
    /* FORMAT 91 : LIGNES NON LIÉES (compteur, liste ouverte, hachures, FIGER) et LIAISONS VALIDÉES
       recalculés aussitôt après chaque changement du budget */
    let insLiveT = null;
    const insLiveSync = () => {
      clearTimeout(insLiveT);
      insLiveT = setTimeout(() => {
        try {
          insMarkUnlinked();
          const lb = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="lnk"] .svi-cnt`);
          if (lb && active !== "lnk") lb.outerHTML = svCnt((INS.links || []).length);
          if (active === "unl" && body && !body.contains(document.activeElement)) {
            const sc = body.querySelector(".bdg-d-scroll"), top = sc ? sc.scrollTop : 0, left = sc ? sc.scrollLeft : 0;
            body.innerHTML = `<div class="bdg-d-scroll">${insUnlHTML()}</div>`;
            const ns = body.querySelector(".bdg-d-scroll");
            if (ns) { ns.scrollTop = top; ns.scrollLeft = left; }
          }
        } catch (e) {}
      }, 60);
    };
    const insSave = () => {
      if (INS_EDIT) { sviDlpOne(INS); sviDpredTyped(INS); insLiveSync(); try { qqAutoSync(); } catch (e) {} if (shell.__undoTick) shell.__undoTick(); }
      clearTimeout(insTimer);
      insTimer = setTimeout(() => {
        const list = instLoad();
        const r = list.find(x => x.ref === budget.inst.ref);
        if (!r) return;
        /* délier en attente de ✓ VALIDER : l'état enregistré garde les liaisons d'avant */
        let lb = null;
        try { lb = LK.linksBak; } catch (e) {}
        r.data = lb ? { ...INS, links: lb } : INS;
        instSave(list);
      }, 250);
    };
    if (INS_DLP_MIG) insSave();

    const insNum = v => {
      const s = String(v ?? "").trim();
      return s === "" ? "" : num(s);
    };
    const insFmt = v => (v === "" || v === null || v === undefined) ? "" : (typeof v === "string" && /[A-Z]/i.test(v) && !/^[\d\s.,+-]+$/.test(v)) ? v : money(v);
    /* niveau d'un titre d'après sa numérotation : I = 1, I.1 = 2, I.1.1 = 3 */
    const insLevel = art => Math.min(3, String(art || "").split(".").filter(x => x.trim() !== "").length || 1);
    /* niveau enregistré à part (FORMAT 61) : r.d = nombre de titres au-dessus de la ligne.
       Calculé une fois depuis l'ART (lignes anciennes / importées), puis changé seulement par le glissement ;
       l'ART reste tel que saisi. Pas de limite de niveaux. */
    const dOf = r => Number(r && r.d) || 0;
    /* FORMAT 124 : ART calculé quand il est vide — suivant de la ligne précédente de même niveau (dernier nombre + 1),
       sinon numéro du titre + « .1 » (1re ligne du tableau : 1) ; un ART saisi n'est jamais changé */
    const artIncr = a => { const m = /^(.*?)(\d+)(\D*)$/.exec(String(a)); return m ? m[1] + (Number(m[2]) + 1) + m[3] : String(a) + ".1"; };
    const artAutoOf = list => {
      const out = new Map(), last = [], tnum = [];
      (list || []).forEach(r => {
        const d = Number(r && r.d) || 0;
        last.length = d + 1; tnum.length = d + 1;
        const own = String(r.art ?? "").trim();
        const n = own || (last[d] !== undefined ? artIncr(last[d]) : d === 0 ? "1" : (tnum[d - 1] || "1") + ".1");
        last[d] = n;
        if (!own) out.set(r.id, n);
        if (r.t) { tnum[d] = n; last[d + 1] = undefined; }
      });
      return out;
    };
    let ART_AUTO = new Map(), ART_DUP = new Map();
    const artOf = r => r ? (String(r.art ?? "").trim() || ART_AUTO.get(r.id) || "") : "";
    const artRefresh = () => {
      if (!INS) return;
      ART_AUTO = artAutoOf(INS.des);
      ART_DUP = new Map();
      INS.des.forEach(r => { const a = artOf(r); if (a) (ART_DUP.get(a) || ART_DUP.set(a, []).get(a)).push(r); });
    };
    /* liaison primaire : l'activité secondaire porte le même intitulé que l'activité primaire */
    const insIsPrimLink = (pid, sid) => {
      const P = INS && INS.prim.find(x => x.id === pid), S = INS && INS.sec.find(x => x.id === sid);
      return !!(P && S && U_(P.v) && U_(P.v) === U_(S.v));
    };
    /* activité primaire = aussi une activité secondaire (sa jumelle, même intitulé) : créée avec elle,
       renommée et supprimée avec elle tant qu'elle n'est liée à rien d'autre */
    /* v472 : UNITÉ DES ACTIVITÉS (cahier, Unité des activités) — saisie sur l'activité secondaire (obligatoire),
       activité primaire = unité de sa jumelle ; tâche primaire : unité de l'activité = UPB de la désignation ;
       produits liés : UPB = unité de l'activité secondaire de leur tâche */
    const actU = (k, r) => !r ? "" : k === "sec" ? U_(r.u) : k === "prim" ? U_((INS.sec.find(x => x.id === r.tw) || INS.sec.find(x => U_(x.v) === U_(r.v)) || {}).u) : "";
    const actUCell = (k, r) => k === "sec" ? (INS_EDIT
        ? `<span class="act-u${U_(r.v) && !U_(r.u) ? " act-umiss" : ""}"${U_(r.v) && !U_(r.u) ? ' data-why="UNITÉ OBLIGATOIRE"' : ""}><input class="ins-in act-uin" data-f="u" enterkeyhint="next" placeholder="U" value="${esc(r.u || "")}" autocomplete="off"></span>`
        : `<span class="act-u act-uro">${esc(r.u || "")}</span>`)
      : k === "prim" ? `<span class="act-u act-uro">${esc(actU(k, r))}</span>` : "";
    /* LK est déclaré plus bas : à l'ouverture d'un budget (tri des lignes avant sa déclaration), pas encore de liaison choisie */
    const lkSecU = () => { let L = null; try { L = LK; } catch (e) { return ""; } if (!INS_EDIT || !L || !L.sec) return ""; const se = INS.sec.find(x => x.id === L.sec); return U_(se && se.u); };
    shell.__lkSecU = () => lkSecU();
    const prdLinkU = id => { const l = (INS.links || []).find(l => (l.prd || []).some(x => x.id === id)); if (!l) return ""; const se = INS.sec.find(x => x.id === l.sec); return U_(se && se.u); };
    const actUnitSync = () => {
      let ch = false;
      /* budgets existants : unité d'une activité vide reprise une fois (désignation de sa liaison primaire, sinon unité la plus fréquente de ses produits) */
      if (!INS.secUV1) {
        INS.secUV1 = true; ch = true;
        INS.sec.forEach(se => {
          if (U_(se.u) || !U_(se.v)) return;
          const L = (INS.links || []).filter(l => l.sec === se.id);
          const pl = L.find(l => insLinkPrim(INS, l)), d = pl && INS.des.find(x => x.id === pl.des);
          let u = U_(d && d.u);
          if (!u) { const n = {}; L.forEach(l => (l.prd || []).forEach(x => { const p = INS.prd.find(q => q.id === x.id), pu = U_(p && p.u); if (pu) n[pu] = (n[pu] || 0) + 1; })); u = Object.keys(n).sort((a, b) => n[b] - n[a])[0] || ""; }
          if (u) se.u = u;
        });
      }
      { const su = lkSecU(); if (su) Object.keys(LK.prd || {}).forEach(id => { if (prdLinkU(id)) return; const p = INS.prd.find(q => q.id === id); if (p && U_(p.u) !== su) { p.u = su; ch = true; } }); }
      (INS.links || []).forEach(l => {
        const se = INS.sec.find(x => x.id === l.sec);
        if (!se) return;
        if (insLinkPrim(INS, l)) { const d = INS.des.find(x => x.id === l.des), du = U_(d && d.u); if (du && U_(se.u) !== du) { se.u = du; ch = true; } }
        const su = U_(se.u);
        if (su) (l.prd || []).forEach(x => { const p = INS.prd.find(q => q.id === x.id); if (p && U_(p.u) !== su) { p.u = su; ch = true; } });
      });
      return ch;
    };
    const insTwins = () => {
      if (!INS || !INS.prim || !INS.sec) return false;
      let ch = false;
      const usedElse = (sid, pid) => (INS.links || []).some(l => l.sec === sid && l.prim !== pid);
      const keep = new Set();
      INS.prim.forEach(p => {
        const v = U_(p.v);
        if (!v || p.t) return;
        let t = p.tw && INS.sec.find(x => x.id === p.tw);
        if (t && U_(t.v) !== v) {
          const other = INS.sec.find(x => x !== t && U_(x.v) === v);
          if (!other && !usedElse(t.id, p.id)) { t.v = p.v; ch = true; }
          else t = other || null;
        }
        if (!t) t = INS.sec.find(x => U_(x.v) === v);
        if (!t) { t = { id: insId(), v: p.v, on: false, tw: 1 }; INS.sec.push(t); ch = true; }
        if (p.tw !== t.id) { p.tw = t.id; ch = true; }
        keep.add(t.id);
      });
      const n0 = INS.sec.length;
      INS.sec = INS.sec.filter(x => !x.tw || keep.has(x.id) || (INS.links || []).some(l => l.sec === x.id));
      if (INS.sec.length !== n0) ch = true;
      return ch;
    };
    /* FORMAT 117 : quantités par tâche — une ligne de DÉTAIL PRODUITS = un produit dans UNE tâche (une seule liaison) */
    const prdLinks = id => (INS.links || []).filter(l => (l.prd || []).some(x => x.id === id));
    const prdLinkName = l => {
      const v = (k, id) => { const r = (INS[k] || []).find(x => x.id === id); return r ? (r.v || "") : ""; };
      return [v("lot", l.lot), v("sec", l.sec)].filter(Boolean).join(" › ");
    };
    const prdTaskName = id => { const l = prdLinks(id)[0]; return l ? prdLinkName(l) : ""; };
    /* v491 (remarque 3) : tâche(s) d'une charge (LOT › ACTIVITÉ SECONDAIRE) */
    const chgRdb = r => {
      const qc = num(r && r.q), out = [], seen = new Set();
      if (!r || !qc) return "";
      (INS.links || []).filter(l => (l.chg || []).some(x => x.id === r.id)).forEach(l => {
        const tk = l.lot + "|" + l.sec; if (seen.has(tk)) return; seen.add(tk);
        let q = 0; const sp = new Set();
        (INS.links || []).filter(m => m.lot === l.lot && m.sec === l.sec).forEach(m => (m.prd || []).forEach(y => { if (sp.has(y.id)) return; sp.add(y.id); const p = INS.prd.find(x => x.id === y.id); if (p) q += insPrdQ(p); }));
        const se = (INS.sec || []).find(x => x.id === l.sec) || {};
        out.push(money(q / qc) + " " + U_(se.u) + " / " + U_(r.u));
      });
      return out.join(" · ");
    };
    /* v524 : quantité de produit de la (ou des) tâche(s) d'une ligne de charge, unités d'activité et désignations client touchées */
    const chgTaskQ = r => {
      const o = { q: 0, u: new Set(), des: new Set() }, seen = new Set();
      if (!r) return o;
      (INS.links || []).filter(l => (l.chg || []).some(x => x.id === r.id)).forEach(l => {
        o.des.add(l.des);
        const tk = l.lot + "|" + l.sec; if (seen.has(tk)) return; seen.add(tk);
        const sp = new Set();
        (INS.links || []).filter(m => m.lot === l.lot && m.sec === l.sec).forEach(m => (m.prd || []).forEach(y => { if (sp.has(y.id)) return; sp.add(y.id); const p = INS.prd.find(x => x.id === y.id); if (p) o.q += insPrdQ(p); }));
        const se = (INS.sec || []).find(x => x.id === l.sec) || {}; o.u.add(U_(se.u));
      });
      return o;
    };
    /* v524 (remarques 3 à 5) : RENDEMENT d'un titre de charges regroupées — seulement si ses lignes (celles affichées : le filtre compte)
       touchent UNE seule désignation client et une seule unité d'activité : Σ quantités de produit ÷ Σ quantités de charge */
    const chgGrpRdb = g => {
      const T = g.map(chgTaskQ), D = new Set(), U = new Set();
      T.forEach(t => { t.des.forEach(x => D.add(x)); t.u.forEach(x => U.add(x)); });
      const qp = T.reduce((a, t) => a + t.q, 0), qc = g.reduce((a, r) => a + (num(r.q) || 0), 0);
      if (D.size !== 1 || U.size !== 1 || !qp || !qc) return null;
      return { v: qp / qc, u: [...U][0] + " / " + U_(g[0].u) };
    };
    /* rendement tapé (ou revalidé) sur le titre : chaque ligne = quantité de produit de SA tâche ÷ rendement, arrondie à 0,5 près ;
       les quantités de produit ne bougent pas */
    const chgRdbApply = (ids, R, anchor) => {
      const G = INS.chg.filter(r => ids.has(r.id));
      if (!(R > 0)) { svToast("RENDEMENT NON VALIDE : NOMBRE > 0.", 3000, anchor); refreshAll(); return; }
      const todo = G.map(r => ({ r, qp: chgTaskQ(r).q })).filter(x => x.qp > 0);
      if (!todo.length) { svToast("AUCUNE LIGNE À RECALCULER : PAS DE QUANTITÉ DE PRODUIT DANS LEURS TÂCHES.", 3500, anchor); refreshAll(); return; }
      svConfirm({ title: "RENDEMENT", text: "APPLIQUER CE RENDEMENT (" + money(R) + ") AUX " + todo.length + " LIGNE(S) ? LEURS QUANTITÉS DE CHARGE SERONT RECALCULÉES (ARRONDIES À 0,5 PRÈS).", ok: "APPLIQUER", tone: "neutral" }).then(go => {
        if (go) {
          todo.forEach(x => { x.r.q = Math.max(0.5, Math.round(x.qp / R * 2) / 2); });
          insSave();
          histLog("SAISIE", "RENDEMENT APPLIQUÉ", (G[0] && G[0].des || "") + " : " + money(R) + " — " + todo.length + " LIGNE(S)");
        }
        refreshAll();
      });
    };
    /* v525 (remarque 1) : rendement tapé sur une ligne */
    const chgRdbLine = (id, R, anchor) => {
      const r = INS.chg.find(x => x.id === id); if (!r) return;
      if (!(R > 0)) { svToast("RENDEMENT NON VALIDE : NOMBRE > 0.", 3000, anchor); refreshAll(); return; }
      const qp = chgTaskQ(r).q; if (!(qp > 0)) { refreshAll(); return; }
      const q = Math.max(0.5, Math.round(qp / R * 2) / 2);
      if (num(r.q) !== q) { r.q = q; insSave(); histLog("SAISIE", "RENDEMENT D'UNE CHARGE", (r.des || "") + " : " + money(R) + " → QCB " + money(q)); }
      refreshAll();
    };
    shell.__chgRdbLine = (id, R, a) => chgRdbLine(id, R, a);
    if (!shell.__rdblBound) {
      shell.__rdblBound = true;
      /* la frappe dans le rendement d'une ligne ne touche rien ; la valeur est appliquée en quittant la case (ou Entrée) */
      document.addEventListener("input", e => { if (e.target && e.target.matches && e.target.matches("input.ins-rdbl")) e.stopPropagation(); }, true);
      document.addEventListener("change", e => {
        const i = e.target; if (!i || !i.matches || !i.matches("input.ins-rdbl")) return;
        e.stopPropagation();
        const id = i.closest("tr[data-iid]")?.dataset.iid; if (!id || !shell.__chgRdbLine) return;
        shell.__chgRdbLine(id, num(i.value), i);
      }, true);
    }
    const chgTaskName = id => [...new Set((INS.links || []).filter(l => (l.chg || []).some(x => x.id === id)).map(prdLinkName).filter(Boolean))].join(" · ");
    const prdChainKey = id => {
      const l = prdLinks(id)[0];
      if (!l) return "";
      const f = (k, i, fl) => U_(((INS[k] || []).find(x => x.id === i) || {})[fl] || "");
      return [f("des", l.des, "des"), f("lot", l.lot, "v"), f("prim", l.prim, "v"), f("sec", l.sec, "v")].join("|");
    };
    /* un produit lié à plusieurs liaisons : une copie (mêmes quantités) par liaison supplémentaire */
    const insPrdSplit = () => {
      let ch = false;
      const seen = new Set();
      (INS.links || []).forEach(l => (l.prd || []).forEach(x => {
        if (!seen.has(x.id)) { seen.add(x.id); return; }
        const p = INS.prd.find(r => r.id === x.id);
        if (!p) return;
        const c = { ...p, id: insId(), on: false };
        INS.prd.splice(INS.prd.indexOf(p) + 1, 0, c);
        x.id = c.id; ch = true;
      }));
      return ch;
    };
    const insNorm = () => {
      if (!INS) return;
      if (insTwins()) insSave();
      if (INS_EDIT && actUnitSync()) insSave();
      if (insPrdSplit() && INS_EDIT) insSave();
      /* v482 : une charge liée à plusieurs liaisons de tâches différentes → une copie (même quantité) par tâche supplémentaire */
      if (INS_EDIT) { let ch = false; const seen = new Map();
        (INS.links || []).forEach(l => (l.chg || []).forEach(x => {
          const t = l.lot + "|" + l.sec;
          if (!seen.has(x.id)) { seen.set(x.id, t); return; }
          if (seen.get(x.id) === t) return;
          const c0 = INS.chg.find(q => q.id === x.id); if (!c0) return;
          const c = { ...c0, id: insId(), on: false }; INS.chg.splice(INS.chg.indexOf(c0) + 1, 0, c); x.id = c.id; ch = true;
        }));
        if (ch) insSave(); }
      try { artRefresh(); } catch (e) {}
      /* FORMAT 108 : DIM à 0 = DIM vide */
      { let ch = false;
        (INS.prd || []).forEach(r => ["d1", "d2", "d3"].forEach(f => { const v = r[f]; if (v !== "" && v !== undefined && v !== null && String(v).trim() !== "" && num(v) === 0) { r[f] = ""; ch = true; } }));
        if (ch && INS_EDIT) insSave(); }
      try { if (dlyClean()) insSave(); } catch (e) {}
      const stack = [];
      INS.des.forEach(r => {
        if (r.d === undefined || r.d === null || r.d === "") {
          if (r.t) {
            const L = insLevel(r.art);
            while (stack.length && insLevel(stack[stack.length - 1].art) >= L) stack.pop();
            r.d = stack.length;
          } else r.d = stack.length;
        }
        r.d = Math.max(0, Math.min(Number(r.d) || 0, stack.length));
        while (stack.length > r.d) stack.pop();
        if (r.t) stack.push(r);
      });
    };
    /* quantité d'un détail produit : NBR × DIM si renseignés, sinon la saisie */
    const insQty = (k, r) => {
      if (k === "prd") return insPrdQ(r);
      /* QPB désignation : toujours calculée = somme des produits de ses tâches primaires (0 sans liaison) */
      if (k === "des") {
        /* v494 (remarque 23) : cases cochées dans d'autres blocs → QPB limitée aux tâches concernées
           (produits des liaisons primaires des mêmes désignation / lot / activité primaire que les liaisons retenues) */
        let CL = null; try { CL = r.id ? insCheckLinks("des") : null; } catch (e) { CL = null; }   /* déclarée plus bas (ouverture) */
        if (CL) {
          const keep = new Set(CL.filter(l => l.des === r.id).map(l => l.lot + "|" + l.prim));
          return (INS.links || []).filter(l => l.des === r.id && keep.has(l.lot + "|" + l.prim) && insLinkPrim(INS, l))
            .reduce((t, l) => t + (l.prd || []).reduce((a, x) => { const p = INS.prd.find(q => q.id === x.id); return a + (p ? insPrdQ(p) : 0); }, 0), 0);
        }
        const lq = r.id ? insLinkedQ(INS, r.id) : null; return lq !== null ? lq : 0;
      }
      return r.q === "" || r.q === undefined ? 0 : num(r.q);
    };
    /* v476 (remarque 3) : produit pas encore lié — tâche primaire choisie (ronds) : PPB de la désignation, sinon vide */
    const lkPrimPrice = r => {
      if (!INS_EDIT || !LK || !LK.des || !LK.prim || !LK.sec || !insIsPrimLink(LK.prim, LK.sec)) return "";
      if (r && r.id && !(LK.prd && r.id in LK.prd)) return "";
      const d = INS.des.find(x => x.id === LK.des);
      return d && d.p !== "" && d.p !== undefined ? num(d.p) : "";
    };
    const insPrice = (k, r) => { if (k !== "prd") return r.p; const v = insPrdPrice(INS, r.id); return v !== "" ? v : (INS.links || []).some(l => (l.prd || []).some(x => x.id === r.id)) ? "" : lkPrimPrice(r); };
    const insHT = (k, r) => r.t ? 0 : insQty(k, r) * num(insPrice(k, r) || 0);
    const insTVA = r => (r.tva === "" || r.tva === undefined) ? 20 : num(r.tva);
    /* TVA de la ligne : produits = celle de la désignation liée (vide sans liaison) */
    const insTVAk = (k, r) => k === "prd" ? insPrdTVA(INS, r.id) : insTVA(r);
    const insTTC = (k, r) => insHT(k, r) * (1 + num(insTVAk(k, r) || 0) / 100);

    /* colonnes : [champ, libellé, classe, type, largeur] ; type : txt / num / calc */
    const INS_COLS = {
      qlt: [["v", "QUALITÉ", "", "txt", "qlt"]],   /* une seule colonne : toute la largeur du bloc (voir insTableHTML) */
      des: [
        ["art", "ART", "center", "txt", "article"],
        ["des", "DÉSIGNATION", "", "txt", "designation"],
        ["u", "UPB", "center", "txt", "unit"],
        ["q", "QPB", "number", "num", "qty"],
        ["p", "PPB", "number", "num", "price"],
        ["ht", "MPB HT", "number", "calc", "ht"],
        ["tva", "TVA %", "number", "num", "tva"],
        ["ttc", "MPB TTC", "number", "calc", "ttc"]
      ],
      chg: [
        ["art", "ART", "center", "txt", "article"],
        ["des", "DÉSIGNATION CHARGE", "", "txt", "detail"],
        ["u", "UCB", "center", "txt", "unit"],
        ["q", "QCB", "number", "num", "qty"],
        ["p", "PCB", "number", "num", "price"],
        ["ht", "MCB HT", "number", "calc", "amount"],
        ["tva", "TVA %", "number", "num", "tva"],
        ["ttc", "MCB TTC", "number", "calc", "ttc"],
        /* v491 (remarque 3) : colonne TÂCHE ; v492 (remarque 8) : à la fin */
        /* v498 (remarque 38) : RENDEMENT budgété de la charge dans sa tâche secondaire — quantité produite par la tâche ÷ QCB,
           unité de l'activité secondaire / unité de la charge (ex. 0,50 M2 / L) */
        ["rdb", "RENDEMENT", "number", "calc", "rdb"],
        ["tache", "TÂCHE", "", "calc", "tache"],
        /* FORMAT 111 (v488) : AGRÉMENT EXIGÉ / QUALIFICATION EXIGÉE — colonnes masquées pour l'instant (v491, remarque 3),
           à remettre plus tard : ["agr", "AGRÉMENT EXIGÉ", "center", "chk", "agr"], ["qex", "QUALIFICATION EXIGÉE", "", "txt", "qex"] */
      ],
      prd: [   /* pas de colonne ART : un produit n'a pas d'article */
        ["des", "DÉSIGNATION PRODUIT", "", "txt", "detail"],
        ["tache", "TÂCHE", "", "calc", "tache"],
        ["u", "UPB", "center", "txt", "unit"],
        ["nbr", "NBR", "number", "num", "nbr"],
        ["d1", "DIM 1", "number", "num", "d1"],
        ["d2", "DIM 2", "number", "num", "d2"],
        ["d3", "DIM 3", "number", "num", "d3"],
        ["q", "QPB", "number", "num", "qty"],
        ["p", "PPB", "number", "num", "price"],
        ["ht", "MPB HT", "number", "calc", "amount"],
        ["tva", "TVA %", "number", "num", "tva"],
        ["ttc", "MPB TTC", "number", "calc", "ttc"]
      ]
    };
    /* champs non saisissables (calculés ou venus d'ailleurs) : fond gris ; les autres gardent le fond normal
       désignations : QPB, montants (TVA saisissable, 20 % par défaut) ;
       charges : PCB (s'il vient de CHS), montants, TVA (de CHS) — une charge absente de CHS garde son PCB saisissable ;
       produits : QPB, PPB, montants, TVA (celle de la désignation liée) ; unité, NBR et DIM se saisissent */
    const INS_LOCK = { des: ["q", "ht", "ttc"], chg: ["ht", "tva", "ttc"], prd: ["q", "p", "ht", "tva", "ttc"] };
    const insCalc = (k, r, f) =>
      f === "ht" ? insHT(k, r) : f === "ttc" ? insTTC(k, r)
        : f === "q" ? insQty(k, r) : f === "tva" ? insTVAk(k, r) : (f === "p" && k === "prd") ? insPrice(k, r) : f === "tache" ? (k === "chg" ? chgTaskName(r.id) : prdTaskName(r.id)) : f === "rdb" ? (k === "chg" ? chgRdb(r) : "") : f === "agr" ? (r.agr ? "OUI" : "") : r[f];
    /* erreur d'une ligne (FORMAT 75) : on ne passe pas à la ligne suivante tant qu'elle reste */
    const insRowErr = (k, r) => {
      /* FORMAT 124 : ART en double (saisi ou calculé) — titres compris */
      if (k === "des" && r && INS && (INS.des || []).includes(r)) {
        if (!insRowErr.__t || Date.now() - insRowErr.__t > 50) { artRefresh(); insRowErr.__t = Date.now(); }
        const a = artOf(r), same = a ? (ART_DUP.get(a) || []).filter(x => x !== r) : [];
        if (same.length) return { f: "art", m: "ART " + a + " DÉJÀ UTILISÉ PAR " + (same[0].des || "UNE AUTRE LIGNE") + " : CHANGER L'ART." };
      }
      if (!r || r.t || !INS || !(INS[k] || []).includes(r)) return null;
      const z = v => v === "" || v === undefined || v === null || num(v) === 0;
      if (k === "prd") {
        if (z(r.nbr)) return { f: "nbr", m: "NBR VIDE OU 0 : SAISIR LE NOMBRE." };
        const nd = sviUnitDims(r.u);
        const known = ["U", "F", "M", "ML", "M2", "M3"].includes(U_(r.u));
        if (known) for (let i = 1; i <= nd; i++) if (z(r["d" + i])) return { f: "d" + i, m: "UNITÉ " + (U_(r.u) || "") + " : DIM " + i + " À SAISIR." };
      }
      if (k === "chg") {
        if (z(r.q)) return { f: "q", m: "QTE VIDE OU 0 : SAISIR LA QUANTITÉ." };
        if (!r.chs && z(r.p)) return { f: "p", m: "CHARGE ABSENTE DE CHS : SAISIR LE PCB." };
      }
      return null;
    };
    shell.__prdSyncU = () => { if (INS && INS_EDIT && actUnitSync()) { insSave(); return true; } return false; };
    /* une cellule : champ saisissable, ou verrouillé (titre, calculé) */
    const insCell = (k, r, c) => {
      const [f, , cls, type] = c;
      const isNew = !r;
      r = r || {};
      /* QPB produits = NBR × DIM 1 × DIM 2 × DIM 3 ; QPB désignation liée = somme des produits de ses tâches */
      const qAuto = (f === "q" && (k === "prd" || k === "des")) || (f === "p" && k === "prd");
      const locked = !INS_EDIT || type === "calc" || qAuto || (INS_LOCK[k] || []).includes(f) || (k === "chg" && (f === "p" || f === "u") && !!r.chs) || (r.t && f !== "art" && f !== "des")
        /* DIM que l'unité n'autorise pas : grisées (FORMAT 74, R10) */
        || (k === "prd" && /^d[123]$/.test(f) && !isNew && +f[1] > sviUnitDims(r.u))
        /* v470 : produit d'une liaison primaire — UPB = celle de la désignation client (comme le PPB) : grisée */
        || (k === "prd" && f === "u" && !isNew && !!prdLinkU(r.id))
        /* v475 : activité secondaire choisie (rond) avec une unité : nouvelle ligne et produits choisis non liés prennent cette unité, grisée */
        || (k === "prd" && f === "u" && !!lkSecU() && (isNew || (LK.prd && r.id in LK.prd && !prdLinkU(r.id))));
      /* FORMAT 111 : case AGRÉMENT EXIGÉ (charge) */
      if (type === "chk") return INS_EDIT && !isNew && !r.t
        ? `<td class="${cls} ins-td"><input type="checkbox" class="ins-chk" data-f="${f}"${r[f] ? " checked" : ""}></td>`
        : `<td class="${cls}">${!isNew && r[f] ? "OUI" : ""}</td>`;
      const er = !isNew && INS_EDIT ? insRowErr(k, r) : null;
      let val = "";
      /* ligne vide « SAISIR ICI » des désignations : TVA 20 % affichée par défaut */
      if (isNew && f === "tva" && k !== "prd") val = "20,00";
      if (isNew && k === "prd" && f === "u" && lkSecU()) val = lkSecU();
      if (isNew && k === "prd" && f === "p") { const pp = lkPrimPrice(null); val = pp === "" ? "" : insFmt(pp); }
      if (!isNew) {
        if (r.t && f !== "art" && f !== "des") val = "";
        else if (f === "tache") val = insCalc(k, r, f) || "";
        else if (type === "calc" || qAuto) val = insFmt(insCalc(k, r, f));
        else if (k === "prd" && f === "tva") val = insFmt(insPrdTVA(INS, r.id));
        else if (type === "num") val = f === "tva" ? (r.tva === "" || r.tva === undefined ? "20,00" : insFmt(r.tva)) : insFmt(r[f]);
        else val = r[f] || "";
      }
      const artA = k === "des" && f === "art" && !isNew && !String(r.art ?? "").trim() ? (ART_AUTO.get(r.id) || "") : "";
      if (!INS_EDIT) return `<td class="${cls}${k === "des" && f === "des" ? " c-wrap ins-tdv" : ""}${k === "chg" && f === "des" && !isNew && !r.t ? " ins-pkc" : ""}${artA ? " art-auto" : ""}">${esc(artA || val)}${k === "chg" && f === "des" && !isNew && !r.t ? condBtn(r) : ""}${f === "tva" && val ? " %" : ""}${k === "des" && f === "des" && !isNew && !r.t ? `<button type="button" class="des-i${r.dsc ? " on" : ""}" data-did="${r.id}" aria-label="Descriptif">i</button>` : ""}</td>`;
      /* v525 (remarque 1) : RENDEMENT d'une ligne de charge modifiable (une seule tâche avec des produits) —
         taper un rendement = QCB de la ligne recalculée (produit de sa tâche ÷ rendement, arrondie à 0,5) */
      if (k === "chg" && f === "rdb" && !isNew && !r.t) {
        const T = chgTaskQ(r), qc = num(r.q);
        if (T.u.size === 1 && T.q > 0) {
          const u = [...T.u][0] + " / " + U_(r.u);
          return `<td class="${cls} ins-td ins-rdbc"><input class="ins-in ins-rdbl" data-f="rdb" enterkeyhint="next" inputmode="decimal" value="${qc ? esc(money(T.q / qc)) : ""}" autocomplete="off"><span class="ins-rdbu">${esc(u)}</span></td>`;
        }
      }
      /* FORMAT 109 : DÉSIGNATION client sur plusieurs lignes si elle est trop longue (la ligne devient plus haute) */
      /* FORMAT 122 : ligne existante — texte affiché (appui long = glisser), un toucher ouvre la saisie */
      if (k === "des" && f === "des" && !isNew) return `<td class="${cls} ins-td ins-tdv${locked ? " ins-lock" : ""}${er && er.f === f ? " ins-bad" : ""}"${er && er.f === f ? ` data-why="${esc(er.m)}"` : ""}>${r.t ? `<span class="ins-tfz">${foldBtn(r)}</span>` : ""}<div class="ins-dv" data-f="des">${esc(val)}</div><textarea class="ins-in ins-ta ${cls}" data-f="${f}" rows="1" enterkeyhint="next" ${locked ? "disabled" : ""} autocomplete="off" spellcheck="false">${esc(val)}</textarea>${r.t ? "" : `<button type="button" class="des-i${r.dsc ? " on" : ""}" data-did="${r.id}" aria-label="Descriptif">i</button>`}</td>`;
      if (k === "des" && f === "des") return `<td class="${cls} ins-td${locked ? " ins-lock" : ""}${er && er.f === f ? " ins-bad" : ""}"${er && er.f === f ? ` data-why="${esc(er.m)}"` : ""}><textarea class="ins-in ins-ta ${cls}" data-f="${f}" rows="1" enterkeyhint="next" ${locked ? "disabled" : ""} ${isNew ? 'placeholder="SAISIR ICI…"' : ""} autocomplete="off" spellcheck="false">${esc(val)}</textarea></td>`;
      /* v530 : bouton CONDITIONNEMENT dans la case DÉSIGNATION d'une charge */
      const pk = k === "chg" && f === "des" && !isNew && !r.t;
      return `<td class="${cls} ins-td${pk ? " ins-pkc" : ""}${locked ? " ins-lock" : ""}${er && er.f === f ? " ins-bad" : ""}"${er && er.f === f ? ` data-why="${esc(er.m)}"` : ""}><input class="ins-in ${cls}" data-f="${f}" enterkeyhint="next"
        ${type === "num" ? 'inputmode="decimal"' : ""} ${locked ? "disabled" : ""}
        value="${esc(val)}" ${isNew && f === "des" ? 'placeholder="SAISIR ICI…"' : artA ? `placeholder="${esc(artA)}"` : ""} autocomplete="off">${pk ? condBtn(r) : ""}</td>`;
    };
    const condBtn = r => `<button type="button" class="chg-pk${(INS.cond || {})[U_(r.des) + "|" + U_(r.u)] ? " on" : ""}" tabindex="-1" data-cid="${r.id}" aria-label="Conditionnement"><svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg></button>`;
    const INS_TRASH = `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    /* page unique : rond à gauche = choix pour la liaison (2e toucher = libère le choix) ;
       case à droite = suppression (cochée, elle devient 🗑 ; ANNULER la décoche) */
    /* rond d'en-tête (FORMAT) : « toutes les lignes déjà liées » du bloc sont choisies, pour les délier d'un coup */
    const lkAllLinked = (k, id) => LK.des && k !== "des" ? lkIsLinked(k, id) : lkAnyLinked(k, id);
    /* v525 (remarque 2) : rond d'un TITRE (niveau de lot, titre de désignations) = toutes les lignes liées SOUS ce titre, même repliées */
    const lkInPart = (k, id) => {
      const p = LK.allp && LK.allp[k]; if (!p) return true;
      if (k === "lot") { const r = INS.lot.find(x => x.id === id); return !!r && lotUnder(r, dlyLotPath(p)); }
      if (k === "des") { const t = INS.des.find(x => x.id === p); return !!t && insBranch(t).some(x => x.id === id); }
      return true;
    };
    const lkOn = (k, id) => (k === "prd" || k === "chg") ? LK[k][id] !== undefined : (LK.all && LK.all[k] ? lkAllLinked(k, id) && lkInPart(k, id) : LK[k] === id);
    /* v530 : chiffre d'une pastille (à moitié remplie : blanc sur la partie colorée, couleur sur la partie blanche) */
    const pstNum = n => `<b class="pst-n">${n}</b>`;
    const lkRdPart = (k, key) => {
      if (!INS_EDIT) return "";
      /* v528 (remarque 1) : rond d'en-tête actif = tous les titres aussi ; rond d'un titre parent d'un titre choisi = choisi aussi */
      const pk = LK.allp && LK.allp[k];
      /* v529 (remarque 1) : titre choisi = ses sous-titres (sous-groupes) choisis aussi ; ses titres parents = « en partie » */
      const desIn = (top, id) => { const t = INS.des.find(x => x.id === top); return !!t && insBranch(t).some(x => x.id === id); };
      const inPk = !!pk && (k === "lot" ? (U_(pk) === U_(key) || U_(pk).startsWith(U_(key) + " / ")) : k === "des" ? desIn(key, pk) : false);
      const subPk = !!pk && (k === "lot" ? U_(key).startsWith(U_(pk) + " / ") : k === "des" ? key !== pk && desIn(pk, key) : false);
      const on = !!(LK.all && LK.all[k] && (!pk || pk === key || subPk));
      const part = !!(LK.all && LK.all[k] && inPk && pk !== key);
      const busy = !!LK[k] || (!!(LK.all && LK.all[k]) && !on && !part);
      /* v530 (remarque 1) : rond d'un titre = pastille avec le nombre de ses lignes (comme le DÉTAIL CHARGES), dans tous les tableaux */
      const n = k === "lot" ? INS.lot.filter(r => !r.t && lotUnder(r, dlyLotPath(key))).length
        : k === "des" ? (() => { const t = INS.des.find(x => x.id === key); return t ? insBranch(t).filter(x => !x.t).length : 0; })() : 0;
      return `<span class="lk-rd lk-rdgrp lk-pst${on ? " on" : ""}${part ? " part" : ""}${busy ? " off" : ""}" data-rdgrp="${k}" data-key="${esc(key)}" role="button" aria-label="Choisir toutes les lignes liées du titre">${pstNum(n)}</span>`;
    };
    /* lignes déjà liées à la désignation choisie (comme le choix du budget validé, niveau par niveau) :
       lots de la désignation ; activités primaires du lot choisi ; secondaires de la primaire choisie ;
       produits / charges de la secondaire choisie */
    const lkLinks = upTo => (INS.links || []).filter(l => l.des === LK.des
      && (upTo < 1 || !LK.lot || l.lot === LK.lot) && (upTo < 2 || !LK.prim || l.prim === LK.prim) && (upTo < 3 || !LK.sec || l.sec === LK.sec));
    const lkLinked = () => {
      const S = { lot: new Set(), prim: new Set(), sec: new Set(), prd: new Set(), chg: new Set() };
      /* aucune désignation choisie : toutes les lignes liées sont en bleu */
      if (!LK.des) return insUsed();
      S.des = new Set((INS.links || []).some(l => l.des === LK.des) ? [LK.des] : []);   /* la désignation choisie, si elle est liée */
      lkLinks(0).forEach(l => S.lot.add(l.lot));
      lkLinks(1).forEach(l => S.prim.add(l.prim));
      lkLinks(2).forEach(l => S.sec.add(l.sec));
      lkLinks(3).forEach(l => { (l.prd || []).forEach(x => S.prd.add(x.id)); (l.chg || []).forEach(x => S.chg.add(x.id)); });
      return S;
    };
    /* lignes liées EXACTEMENT à ce qui est choisi (désignation, lot, activités, produits, charges) :
       elles remontent et passent en bleu foncé, dans tous les blocs, quel que soit l'élément choisi
       (le rond à point reste réservé aux lignes liées à la désignation choisie) */
    const lkHits = () => {
      const ch = ["des", "lot", "prim", "sec"].filter(k => LK[k]);
      const cp = Object.keys(LK.prd || {}), cc = Object.keys(LK.chg || {});
      if (!ch.length && !cp.length && !cc.length) return null;
      const S = { des: new Set(), lot: new Set(), prim: new Set(), sec: new Set(), prd: new Set(), chg: new Set() };
      (INS.links || []).filter(l => ch.every(k => l[k] === LK[k])
        && cp.every(id => (l.prd || []).some(x => x.id === id)) && cc.every(id => (l.chg || []).some(x => x.id === id)))
        .forEach(l => {
          ["des", "lot", "prim", "sec"].forEach(k => S[k].add(l[k]));
          (l.prd || []).forEach(x => S.prd.add(x.id)); (l.chg || []).forEach(x => S.chg.add(x.id));
        });
      return S;
    };
    let LKH = null;
    const lkHit = (k, id) => !!(LKH && LKH[k] && LKH[k].has(id)) && !lkOn(k, id);
    /* une ligne qu'on ne peut pas choisir (avec les choix déjà faits) : grisée d'avance, son rond ne réagit pas ;
       appui long = la raison s'affiche près de la ligne (gain de temps : on ne commet plus l'erreur) */
    const LK_T = { des: "UNE DÉSIGNATION", lot: "UN LOT", prim: "UNE ACTIVITÉ PRIMAIRE", sec: "UNE ACTIVITÉ SECONDAIRE" };
    const lkBan = (k, id) => {
      if (!INS_EDIT || !id || lkOn(k, id)) return "";
      if (LK.all && LK.all[k]) return "TOUTES LES LIGNES LIÉES SONT CHOISIES : TOUCHER LE ROND D'EN-TÊTE POUR LIBÉRER.";
      if (LK_T[k] && LK[k] && LK[k] !== id) return LK_T[k] + " EST DÉJÀ CHOISI(E) : LIBÉREZ-LA D'ABORD.";
      /* désignation sans UPB : elle ne peut pas être liée */
      if (k === "des") { const D = INS.des.find(x => x.id === id); if (D && !D.t && !U_(D.u)) return "UPB MANQUANTE : SAISIR L'UNITÉ DE LA DÉSIGNATION AVANT DE LA LIER."; }
      if (k === "prim" || k === "sec") {
        const a = lkRuleA(k, id);
        if (a) return a;
        /* règle B : la liaison primaire (act. scd = act. prm) n'a que des produits de l'unité de la désignation */
        const D = LK.des && INS.des.find(x => x.id === LK.des), du = U_(D && D.u);
        const pid = k === "prim" ? id : LK.prim, sid = k === "sec" ? id : LK.sec;
        /* v471 (règle B revue) : plus de refus — les produits de la liaison primaire prennent l'UPB et le PPB de la désignation */
        void du; void pid; void sid;
        return "";
      }

      if ((k === "prd" || k === "chg") && LK.lot && LK.sec) {
        const l = (INS.links || []).find(l => l.lot === LK.lot && l.sec === LK.sec && !(l.des === LK.des && l.prim === LK.prim)
          && (l[k] || []).some(x => x.id === id));
        if (l) return "RÈGLE D : DÉJÀ DANS LA TÂCHE SECONDAIRE " + lkName("lot", LK.lot) + " › " + lkName("sec", LK.sec) + ".";
      }
      return "";
    };
    const lkBanAttr = (k, r) => { const b = r && !r.t ? lkBan(k, r.id) : ""; return b ? ` data-ban="${esc(b)}"` : ""; };
    let LKS = null, LKG = null;   /* calculés à chaque dessin : liées à la désignation choisie / liées à n'importe quelle désignation */
    const lkIsLinked = (k, id) => !!(LKS && LKS[k] && LKS[k].has(id));
    const lkAnyLinked = (k, id) => !!(LKG && LKG[k] && LKG[k].has(id));
    /* lignes liées en haut du tableau (consigne 14) */
    /* ordre : lignes au rond coché (choisies ou liées) en haut, puis lignes cochées pour suppression, puis le reste */
    /* ordre : 1) rond coché (choisies), 2) cochées pour suppression, 3) liées (bleu), 4) le reste */
    /* ordre : 1) choisies, 2) cochées, 3) liées à ce qui est choisi, 4) autres lignes qu'on peut choisir
       (liées puis non liées), 5) en bas, les lignes grisées qu'on ne peut pas choisir */
    /* FORMAT 131 : une case cochée ne fait plus remonter la ligne (seuls les ronds) */
    const lkRank = (k, r) => lkOn(k, r.id) ? 0 : (lkHit(k, r.id) || (LK.des && lkIsLinked(k, r.id))) ? 2
      : (k !== "des" && lkBan(k, r.id)) ? 5 : lkAnyLinked(k, r.id) ? 3 : 4;
    const lkTop = (k, rows) => {
      if (!INS_EDIT) return rows;
      return rows.map((r, i) => ({ r, i, g: r.t ? 4 : lkRank(k, r) })).sort((a, b) => a.g - b.g || a.i - b.i).map(o => o.r);
    };
    /* rond d'en-tête : accessible seulement si aucune ligne du bloc n'est choisie (ou s'il est déjà actif) */
    const lkRdAll = k => {
      if (!INS_EDIT || !["des", "lot", "prim", "sec", "prd", "chg"].includes(k)) return "";
      const multi = k === "prd" || k === "chg";
      const on = multi ? (Object.keys(LK[k]).length > 0 && LK.allm && LK.allm[k]) : !!(LK.all && LK.all[k] && !(LK.allp && LK.allp[k]));
      const busy = multi ? (Object.keys(LK[k]).length > 0 && !on) : !!LK[k];
      return `<span class="lk-rd lk-rdall${on ? " on" : ""}${busy ? " off" : ""}" data-rdall="${k}" role="button" aria-label="Choisir toutes les lignes liées"></span>`;
    };
    /* v490 (remarque 4) : quel que soit le rond choisi (désignation, lot, activité, produit, charge), les lignes liées
       à ce choix ont le point dans leur rond (avant : seulement quand une désignation était choisie) */
    const lkRd = (k, r) => INS_EDIT && r && r.t && k === "des" ? lkRdPart("des", r.id) : INS_EDIT && r && !r.t ? `<span class="lk-rd${lkOn(k, r.id) ? " on" : ""}${(LK.des && lkIsLinked(k, r.id)) || lkHit(k, r.id) ? " lnk" : ""}" data-rd="${k}" role="button" aria-label="Choisir pour la liaison"></span>` : "";
    /* case à droite : elle coche seulement (suppression, export, aperçu passent par le menu ⋯ du bloc) */
    const insDelCell = r => !r ? "" : `<input type="checkbox" class="ins-cb${r.t ? " ins-tcb" : ""}" ${!r.t && r.on === true ? "checked" : ""}>`;
    const insQCol = k => false;   /* plus de colonne QUANTITÉ DE LA TÂCHE : la quantité liée est la QPB du produit */
    const insRowHTML = (k, r, lvl) => {
      const cols = insColsOrd(k);
      const tcell = "";   /* plus de colonne T : un titre se crée en superposant deux lignes (FORMAT 61) */
      const sel = r && !r.t && lkOn(k, r.id);
      const dim = k === "des" && r && !r.t && LK.des && !sel;
      const qc = insQCol(k) ? `<td class="number lk-qc">${r ? `<input class="lk-q" data-qk="${k}" inputmode="decimal" value="${sel ? esc(LK[k][r.id] ?? "") : ""}" ${sel ? "" : "disabled"}>` : ""}</td>` : "";
      const lnk = r && !r.t && lkAnyLinked(k, r.id);   /* bleu = liée (à n'importe quelle désignation) */
      return `<tr class="ins-row${r ? "" : " ins-new"}${r && r.t ? " ins-title lv" + Math.min(3, dOf(r) + 1) + (foldGet()[r.id] && insBranch(r).some(x => !x.t && x.on === true) ? " ins-hasck" : "") : ""}${sel ? " lk-sel" : ""}${lnk ? " lk-link" : ""}${r && !r.t && lkHit(k, r.id) ? " lk-hit" : ""}${dim && !(r && lkHit(k, r.id)) ? " lk-dim" : ""}${lkBanAttr(k, r) ? " lk-ban" : ""}"
          data-ik="${k}" ${r ? `data-iid="${r.id}"` : ""}${lkBanAttr(k, r)}${k === "des" && r ? ` style="--d:${dOf(r)}"` : ""}>
        <td class="center ins-rdc">${k === "des" && r && r.t && !INS_EDIT ? foldBtn(r) : lkRd(k, r)}</td>${tcell}${cols.map(c => insCell(k, r, c)).join("")}${qc}${INS_EDIT
          ? `<td class="center ins-delc">${insDelCell(r)}</td>` : ""}</tr>`;
    };
    /* lignes + sous-totaux de titres (désignations) */
    /* filtres / tri de colonne (mêmes menus que la version validée) :
       une ligne filtrée garde son titre ; un tri affiche la liste à plat */
    const insCfT = k => k === "des" ? "client" : k;
    /* FORMAT 131 : bouton « COCHÉES SEULEMENT (n) » — n'affiche que les lignes cochées (avec leurs titres) */
    const ONLYC = shell.__onlyc = shell.__onlyc || {};
    const onlyBtn = (k, short) => {
      if (!INS || !INS[k]) return "";
      const n = INS[k].filter(r => !r.t && r.on === true).length;
      if (!n && !ONLYC[k]) return "";
      return `<button type="button" class="only-c${ONLYC[k] ? " on" : ""}" data-onlyc="${k}">${short ? "COCHÉES" : "COCHÉES SEULEMENT"} (${n})</button>`;
    };
    /* colonnes d'un tableau de saisie dans l'ordre choisi par glissement (mémorisé) */
    const insColsOrd = k => { const cols = INS_COLS[k] || []; const ord = coKeys(insCfT(k), cols.map(c => c[4])); return ord.map(x => cols.find(c => c[4] === x)).filter(Boolean); };
    const insCfCols = k => INS_COLS[k].map(c => [c[4], c[1],
      r => k === "des" && c[0] === "art" ? artOf(r) : c[3] === "txt" ? (r[c[0]] || "") : (r.t ? "" : insCalc(k, r, c[0])), c[2]]);
    const insShown = k => {
      const t = insCfT(k);
      const normal = INS[k].filter(r => !r.t);
      if (ONLYC[k] && !normal.some(r => r.on === true)) ONLYC[k] = false;
      /* v492 (remarque 7) : la case de droite filtre l'affichage des autres blocs — seules les lignes liées à ce qui y est coché */
      const cs = insCheckSet(k);
      const shown = cfApply(t, insCfCols(k), normal).filter(r => (!ONLYC[k] || r.on === true) && (!cs || cs.has(r.id)));
      const st = cfT(t);
      const sorting = !!(st.sort && !st.sort.def);
      const filtering = Object.keys(st.f).length > 0 || !!ONLYC[k] || !!cs;
      if (k !== "des" || sorting) return shown;
      if (!filtering) return INS.des;
      const keep = new Set(shown.map(r => r.id));
      return INS.des.filter((r, i) => {
        if (!r.t) return keep.has(r.id);
        for (let j = i + 1; j < INS.des.length; j++) {
          const x = INS.des[j];
          if (dOf(x) <= dOf(r)) break;
          if (!x.t && keep.has(x.id)) return true;
        }
        return false;
      });
    };
    /* branche d'un titre : lignes (non titres) jusqu'au prochain titre de même niveau ou plus haut */
    const insBranch = t => {
      const out = [];
      for (let i = INS.des.indexOf(t) + 1; i < INS.des.length; i++) {
        const r = INS.des[i];
        if (dOf(r) <= dOf(t)) break;
        if (!r.t) out.push(r);
      }
      return out;
    };
    /* case d'un titre : cochée si toute sa branche l'est, à moitié (grisée) si une partie seulement */
    const insSyncTitles = () => {
      $("bdgClientBody")?.querySelectorAll("tr.ins-title[data-iid] input.ins-tcb").forEach(cb => {
        const t = INS.des.find(x => x.id === cb.closest("tr").dataset.iid);
        const b = t ? insBranch(t) : [];
        const n = b.filter(r => r.on === true).length;
        cb.checked = b.length ? n === b.length : !!(t && t.on === true);
        cb.indeterminate = n > 0 && n < b.length;
      });
    };
    const insSubOf = t => {
      const i0 = INS.des.indexOf(t);
      let ht = 0, ttc = 0;
      for (let i = i0 + 1; i < INS.des.length; i++) {
        const r = INS.des[i];
        if (dOf(r) <= dOf(t)) break;
        if (!r.t) { ht += insHT("des", r); ttc += insTTC("des", r); }
      }
      return { ht, ttc };
    };
    /* suite d'affichage : titres, lignes et sous-totaux (écran et aperçu) */
    const insOrder = rows => {
      const out = [], stack = [];
      rows.forEach(r => {
        while (stack.length && dOf(stack[stack.length - 1]) >= dOf(r)) out.push({ sub: stack.pop() });
        out.push({ r, lvl: dOf(r) });
        if (r.t) stack.push(r);
      });
      while (stack.length) out.push({ sub: stack.pop() });
      return out;
    };
    /* ===== titres repliables (FORMAT 60) : › replié / ⌄ déplié ; état mémorisé par budget ===== */
    const FOLD_KEY = "svi_fold_v1";
    const foldAll = () => { try { return JSON.parse(localStorage.getItem(FOLD_KEY) || "{}") || {}; } catch (e) { return {}; } };
    const foldGet = () => foldAll()[ref] || {};
    /* v512 (remarque 76) : première ouverture d'un budget — titres des désignations pliés (état mémorisé ensuite) */
    if (INS && !(ref in foldAll())) {
      const a0 = foldAll(), m0 = {};
      (INS.des || []).forEach(r => { if (r.t) m0[r.id] = 1; });
      a0[ref] = m0; try { localStorage.setItem(FOLD_KEY, JSON.stringify(a0)); } catch (e) {}
    }
    const foldSet = (id, on) => {
      const a = foldAll(), m = a[ref] || {};
      if (on) m[id] = 1; else delete m[id];
      a[ref] = m;
      try { localStorage.setItem(FOLD_KEY, JSON.stringify(a)); } catch (e) {}
    };
    /* titres parents de chaque ligne (désignations) */
    const insAnc = () => {
      const out = new Map(), stack = [];
      INS.des.forEach(r => {
        while (stack.length && dOf(stack[stack.length - 1]) >= dOf(r)) stack.pop();
        out.set(r.id, stack.slice());
        if (r.t) stack.push(r);
      });
      return out;
    };
    /* ligne cachée : un de ses titres parents est replié */
    const insHiddenFn = () => {
      const F = foldGet(), A = insAnc();
      return r => (A.get(r.id) || []).some(t => F[t.id]);
    };
    /* toucher › / ⌄ : replier / déplier (budget en instance, figé ou validé) */
    shell.__fold = INS ? id => { foldSet(id, !foldGet()[id]); keepScroll(() => insRenderClient()); } : null;
    if (!shell.__foldBound) {
      shell.__foldBound = true;
      shell.addEventListener("click", e => {
        const b = e.target.closest && e.target.closest(".ins-fold");
        if (!b || !shell.__fold) return;
        e.stopPropagation(); e.preventDefault();
        shell.__fold(b.dataset.fold);
      }, true);
    }
    /* v510 (remarque 68) : état d'une branche pour la couleur de son signe ou de sa pastille */
    const sviFoldState = (red, blue) => red && blue ? " fs-vio" : red ? " fs-red" : blue ? " fs-blu" : "";
    const foldBtn = r => r && r.t ? `<span class="ins-fold${foldGet()[r.id] ? "" : " open"}${INS_EDIT ? (() => { const B = insBranch(r).filter(x => !x.t); return sviFoldState(B.some(x => LK.des === x.id), B.some(x => lkHit("des", x.id))); })() : ""}" data-fold="${r.id}" role="button" aria-label="Replier / déplier">${foldGet()[r.id] ? "›" : "⌄"}</span>` : "";
    /* grands tableaux (détail produits / charges) : lignes dessinées par paquets, au fil du défilement (rapidité) */
    const INS_CHUNK = 120;
    const insMore = {};
    /* v492 (remarque 10) : DÉTAIL CHARGES filtré (filtre de colonne, cases cochées d'un autre bloc, « seulement les cochées ») */
    /* v499 (remarque 45) : charges identiques regroupées = un TITRE (gras, fond gris) — QCB, MCB HT et TTC cumulés,
       PCB moyen pondéré (MCB HT ÷ QCB), TÂCHE = nombre de tâches ; signe › / ⌄ pour plier / déplier ses lignes (affichées dessous,
       modifiables une par une) ; sa case coche / décoche toutes ses lignes (à moitié cochée si une partie seulement) */
    /* v512 (remarque 76) : titres de charges regroupées PLIÉS à la première ouverture ; ceux qu'on déplie sont mémorisés (par budget) */
    const CHG_GK = "svi_chggopen_v1";
    const chgOpenLoad = () => { try { return new Set(((JSON.parse(localStorage.getItem(CHG_GK) || "{}") || {})[ref]) || []); } catch (e) { return new Set(); } };
    shell.__chgGOpen = chgOpenLoad();
    shell.__chgGSave = () => { try { const o = JSON.parse(localStorage.getItem(CHG_GK) || "{}") || {}; o[ref] = [...shell.__chgGOpen]; localStorage.setItem(CHG_GK, JSON.stringify(o)); } catch (e) {} };
    const CHG_GFOLD = { has: k => !shell.__chgGOpen.has(k) };
    const insGrpRowHTML = (g, key) => {
      const cols = insColsOrd("chg"), ht = g.reduce((t, r) => t + insHT("chg", r), 0), ttc = g.reduce((t, r) => t + insTTC("chg", r), 0);
      const qs = g.reduce((t, r) => t + (Number(insCalc("chg", r, "q")) || 0), 0);
      const nt = new Set(g.map(r => chgTaskName(r.id)).filter(Boolean)).size;
      const v = { art: g[0].art || "", des: g[0].des || "", u: g[0].u || "", q: money(qs), p: qs ? money(ht / qs) : "", ht: money(ht),
        tva: ht ? money((ttc - ht) / ht * 100) : "", ttc: money(ttc), rdb: "", tache: nt + " TÂCHE" + (nt > 1 ? "S" : "") };
      const RD = chgGrpRdb(g);
      if (RD) v.rdb = money(RD.v) + " " + RD.u;
      const fo = CHG_GFOLD.has(key);
      /* v511 (remarque 72) : le signe a sa propre zone (toute la hauteur, 40 px), que la case de la désignation ne recouvre pas */
      const fb = `<span class="ins-gfz" data-gk="${esc(key)}" role="button" aria-label="Replier / déplier"><span class="ins-fold ins-gfold${fo ? "" : " open"}" data-gk="${esc(key)}">${fo ? "›" : "⌄"}</span></span>`;
      const non = g.filter(r => r.on === true).length;
      /* v505 (remarque 56) : ART, DÉSIGNATION, UCB, PCB et TVA du titre modifiables — la valeur va à toutes ses lignes
         (PCB, UCB et TVA grisés si une de ses charges vient de CHS) ; QCB, montants, RENDEMENT et TÂCHE restent calculés */
      const chs = g.some(r => !!r.chs);
      const edOk = f => INS_EDIT && (["art", "des"].includes(f) || (["u", "p", "tva"].includes(f) && !chs));
      const ps = new Set(g.map(r => money(num(r.p || 0)))), ts = new Set(g.map(r => money(insTVA(r))));
      const ev = { art: v.art, des: v.des, u: v.u, p: ps.size === 1 ? [...ps][0] : v.p, tva: ts.size === 1 ? [...ts][0] : v.tva };
      const cell = c => {
        const f = c[0];
        /* v524 : rendement du titre — en italique (valeur calculée), modifiable : revalider l'applique à toutes les lignes */
        if (f === "rdb") {
          if (!RD) return `<td class="${c[2]}${INS_EDIT ? " ins-lock" : ""}"></td>`;
          const tip = "RENDEMENT CALCULÉ : UNE SEULE DÉSIGNATION CLIENT. LE MODIFIER RECALCULE LES QUANTITÉS DE CHARGE.";
          if (INS_EDIT) return `<td class="${c[2]} ins-td ins-rdbc" title="${tip}"><input class="ins-gin ins-rdbin" data-f="rdb" enterkeyhint="next" inputmode="decimal" value="${esc(money(RD.v))}" autocomplete="off"><span class="ins-rdbu">${esc(RD.u)}</span></td>`;
          return `<td class="${c[2]} ins-rdbc" title="${tip}"><i>${esc(v.rdb)}</i></td>`;
        }
        if (edOk(f)) return `<td class="${c[2]} ins-td${f === "des" ? " ins-gtd" : ""}">${f === "des" ? fb : ""}<input class="ins-gin ${c[2]}" data-f="${f}" enterkeyhint="next"${["p", "tva"].includes(f) ? ' inputmode="decimal"' : ""} value="${esc(ev[f] ?? "")}" autocomplete="off" spellcheck="false"></td>`;
        return `<td class="${c[2]}${INS_EDIT ? " ins-lock" : ""}${f === "des" ? " ins-gtd" : ""}">${f === "des" ? fb : ""}${esc(v[f] ?? "")}</td>`;
      };
      /* v507 (remarque 63) : la pastille (nombre de lignes) sert de rond — toucher = choisir / libérer toutes ses charges */
      const nch = INS_EDIT && LK && LK.chg ? g.filter(r => LK.chg[r.id] !== undefined).length : 0;
      /* v508 (remarque 65) : couleur des ronds de ses lignes — rouge (choisies), bleu (liées à ce qui est choisi) */
      const isB = r => INS_EDIT && ((LK.des && lkIsLinked("chg", r.id)) || lkHit("chg", r.id));
      /* v510 (remarque 67) : mélange de rouge (choisies) et de bleu (liées) = violet */
      const stt = new Set(g.map(r => LK && LK.chg && LK.chg[r.id] !== undefined ? (isB(r) ? "b" : "r") : (isB(r) ? "b" : "")).filter(Boolean));
      const blu = stt.has("b") && !stt.has("r"), vio = stt.has("b") && stt.has("r");
      return `<tr class="ins-row ins-grp ins-gtitle${fo && non ? " ins-hasck" : ""}" data-grp="${g.map(r => r.id).join(",")}"><td class="center ins-rdc"><span class="ins-grpn${INS_EDIT ? " ins-grd" : ""}${nch && nch === g.length ? " on" : nch ? " part" : ""}${blu ? " blu" : vio ? " vio" : ""}" role="button" aria-label="Choisir toutes les charges">${pstNum(g.length)}</span></td>${cols.map(cell).join("")}${INS_EDIT ? `<td class="center ins-delc"><input type="checkbox" class="ins-gcb"${non === g.length ? " checked" : ""}${non && non < g.length ? ' data-part="1"' : ""}></td>` : ""}</tr>`;
    };
    /* v516 : DÉTAIL PRODUITS — produits de même DÉSIGNATION regroupés sous un titre (même si NBR, DIM 1 à 3 ou unité diffèrent),
       pour retrouver d'un coup tout ce qui concerne un élément (un poteau…) et les activités qui l'ont touché.
       Titre : pastille (nombre de lignes), signe › / ⌄, désignation ; AUCUN total (unités différentes : rien ne se cumule) ;
       sa case coche / décoche toutes ses lignes. Plié à la première ouverture, dépliés mémorisés (par budget). */
    const insPrdGrpRowHTML = (g, key) => {
      const cols = insColsOrd("prd"), fo = CHG_GFOLD.has(key);
      const fb = `<span class="ins-gfz" data-gk="${esc(key)}" role="button" aria-label="Replier / déplier"><span class="ins-fold ins-gfold${fo ? "" : " open"}" data-gk="${esc(key)}">${fo ? "›" : "⌄"}</span></span>`;
      const non = g.filter(r => r.on === true).length;
      const cell = c => `<td class="${c[2]}${INS_EDIT ? " ins-lock" : ""}${c[0] === "des" ? " ins-gtd" : ""}">${c[0] === "des" ? fb + esc(g[0].des || "") : ""}</td>`;
      /* v530 (remarque 1) : la pastille du titre choisit / libère tous ses produits, comme celle des charges */
      const nch = INS_EDIT && LK && LK.prd ? g.filter(r => LK.prd[r.id] !== undefined).length : 0;
      const isB = r => INS_EDIT && ((LK.des && lkIsLinked("prd", r.id)) || lkHit("prd", r.id));
      const stt = new Set(g.map(r => LK && LK.prd && LK.prd[r.id] !== undefined ? (isB(r) ? "b" : "r") : (isB(r) ? "b" : "")).filter(Boolean));
      const blu = stt.has("b") && !stt.has("r"), vio = stt.has("b") && stt.has("r");
      return `<tr class="ins-row ins-grp ins-gtitle ins-pgrp${fo && non ? " ins-hasck" : ""}" data-grp="${g.map(r => r.id).join(",")}"><td class="center ins-rdc"><span class="ins-grpn${INS_EDIT ? " ins-grd" : ""}${nch && nch === g.length ? " on" : nch ? " part" : ""}${blu ? " blu" : vio ? " vio" : ""}" role="button" aria-label="Choisir tous les produits">${pstNum(g.length)}</span></td>${cols.map(cell).join("")}${INS_EDIT ? `<td class="center ins-delc"><input type="checkbox" class="ins-gcb"${non === g.length ? " checked" : ""}${non && non < g.length ? ' data-part="1"' : ""}></td>` : ""}</tr>`;
    };
    const insBodyHTML = k => {
      LKS = lkLinked(); LKG = insUsed(); LKH = lkHits();
      const rows = k === "des" ? insShown(k) : lkTop(k, insShown(k));
      const ncol = INS_COLS[k].length + 1;
      let html = "";
      if (k === "chg") {   /* v501 (remarque 49) : charges identiques regroupées en titres, filtre ou non */
        /* v492 (remarque 10) : tableau filtré — charges identiques (même désignation, même unité, même article) regroupées ;
           v499 (remarque 45) : sous un titre (cumuls), ses lignes dessous, pliables */
        insMore[k] = [];
        const G = new Map();
        rows.forEach(r => { const key = [U_(r.des), U_(r.u), U_(r.art)].join("|"); if (!G.has(key)) G.set(key, []); G.get(key).push(r); });
        const done = new Set();
        html = rows.map(r => {
          const key = [U_(r.des), U_(r.u), U_(r.art)].join("|"), g = G.get(key);
          if (g.length < 2) return insRowHTML(k, r, 0);
          if (done.has(key)) return "";
          done.add(key);
          return insGrpRowHTML(g, key) + (CHG_GFOLD.has(key) ? "" : g.map(x => insRowHTML(k, x, 1)).join(""));
        }).join("");
      } else if (k === "prd") {
        insMore[k] = [];
        const kOf = r => "P|" + U_(r.des);
        const G = new Map();
        rows.forEach(r => { const key = kOf(r); if (!G.has(key)) G.set(key, []); G.get(key).push(r); });
        const done = new Set();
        html = rows.map(r => {
          const key = kOf(r), g = G.get(key);
          if (g.length < 2 || !U_(r.des)) return insRowHTML(k, r, 0);
          if (done.has(key)) return "";
          done.add(key);
          return insPrdGrpRowHTML(g, key) + (CHG_GFOLD.has(key) ? "" : g.map(x => insRowHTML(k, x, 1)).join(""));
        }).join("");
      } else if (k !== "des") {
        const first = rows.length > INS_CHUNK * 1.5 ? rows.slice(0, INS_CHUNK) : rows;
        insMore[k] = rows.slice(first.length);
        html = first.map(r => insRowHTML(k, r, 0)).join("");
      } else {
        /* désignations : les lignes choisies puis cochées montent en haut avec leur titre ;
           les autres lignes du même titre restent à leur place */
        const top = INS_EDIT ? rows.map((r, i) => ({ r, i })).filter(o => !o.r.t && lkRank(k, o.r) < 4)
          .sort((a, b) => lkRank(k, a.r) - lkRank(k, b.r) || a.i - b.i).map(o => o.r) : [];
        /* une ligne choisie ou liée à ce qui est choisi : ses titres repliés se déplient */
        { const A = insAnc(), F = foldGet();
          top.filter(r => { const g = lkRank(k, r); return g === 0 || g === 2; })
            .forEach(r => (A.get(r.id) || []).forEach(t => { if (F[t.id]) foldSet(t.id, false); })); }
        const hid = insHiddenFn();
        let head = "";
        const done = new Set();   /* titres déjà affichés en haut */
        if (top.length) {
          top.forEach(r => {
            const anc = [];
            for (let i = INS.des.indexOf(r) - 1, L = dOf(r); i >= 0 && L > 0; i--) {
              const t = INS.des[i];
              if (t.t && dOf(t) < L) { anc.unshift(t); L = dOf(t); if (L <= 0) break; }
            }
            /* un titre caché par un titre replié au-dessus n'apparaît pas, même en haut */
            anc.forEach(t => { if (!done.has(t.id) && !hid(t)) { done.add(t.id); head += insRowHTML(k, t, dOf(t)).replace('class="ins-row', 'class="ins-row ins-top'); } });
            /* titre replié : la ligne reste cachée (le titre, lui, est affiché avec ›) */
            if (!hid(r)) head += insRowHTML(k, r, dOf(r));
          });
        }
        const topIds = new Set(top.map(r => r.id));
        const rest = rows.filter(r => !topIds.has(r.id));
        /* plus de total par titre (seulement le total général) ; un titre n'apparaît qu'une fois,
           sauf s'il garde des lignes plus bas */
        const restIds = new Set(rest.filter(r => !r.t).map(r => r.id));
        const hasRest = t => { for (let i = INS.des.indexOf(t) + 1; i < INS.des.length && dOf(INS.des[i]) > dOf(t); i++) if (restIds.has(INS.des[i].id) && !hid(INS.des[i])) return true; return false; };
        /* FORMAT 130 : une ligne n'apparaît jamais seule — ses titres sont toujours affichés au-dessus d'elle
           (titre en deux exemplaires si une partie de sa branche est remontée en haut) */
        void hasRest;
        const emitted = new Set();
        const ancOf = r => { const a = []; for (let i = INS.des.indexOf(r) - 1, L = dOf(r); i >= 0 && L > 0; i--) { const t = INS.des[i]; if (t.t && dOf(t) < L) { a.unshift(t); L = dOf(t); } } return a; };
        let body2 = "";
        insOrder(rest).filter(x => !x.sub && !hid(x.r)).forEach(x => {
          const r = x.r;
          if (r.t) { if (done.has(r.id) || emitted.has(r.id)) return; emitted.add(r.id); body2 += insRowHTML(k, r, x.lvl); return; }
          ancOf(r).forEach(t => { if (!emitted.has(t.id) && !hid(t)) { emitted.add(t.id); body2 += insRowHTML(k, t, dOf(t)); } });
          body2 += insRowHTML(k, r, x.lvl);
        });
        html = head + body2;
      }
      if (INS_EDIT) html += insRowHTML(k, null, 0);
      if (!rows.length && !INS_EDIT) html += `<tr><td colspan="${ncol}" class="empty">AUCUNE LIGNE</td></tr>`;
      return html;
    };
    /* v484 (remarque 23) : cases cochées dans les AUTRES blocs (désignation, lot, activités, produits, charges) :
       seules les lignes liées à ce qui y est coché comptent (blocs combinés : ET) */
    /* liaisons retenues par les cases cochées des blocs autres que k (null : aucune case cochée ailleurs) ; mémorisé un instant */
    var ICL = null;
    const insCheckLinks = k => {
      if (!INS) return null;
      /* mémoire valable pour un seul dessin (vidée dès la fin de la tâche en cours) */
      if (!ICL) { ICL = { m: {} }; queueMicrotask(() => { ICL = null; }); }
      if (k in ICL.m) return ICL.m[k];
      const B = ["des", "lot", "prim", "sec", "prd", "chg"].filter(x => x !== k);
      const C = {};
      B.forEach(x => { const ids = (INS[x] || []).filter(r => !r.t && r.on === true).map(r => r.id); if (ids.length) C[x] = new Set(ids); });
      /* v498 (remarque 37) : liaisons cochées de l'onglet MARGE — elles filtrent aussi les autres blocs */
      const lon = k !== "lnk" && (INS.links || []).some(l => l.on === true);
      const ks = Object.keys(C);
      const out = !ks.length && !lon ? null : (INS.links || []).filter(l => ks.every(x => (x === "prd" || x === "chg") ? (l[x] || []).some(y => C[x].has(y.id)) : C[x].has(l[x]))
        && (!lon || l.on === true));
      ICL.m[k] = out;
      return out;
    };
    const insCheckSet = k => {
      if (!INS || !["des", "prd", "chg", "lot", "prim", "sec"].includes(k)) return null;
      const L = insCheckLinks(k);
      if (!L) return null;
      const S = new Set();
      L.forEach(l => { if (k === "prd" || k === "chg") (l[k] || []).forEach(y => S.add(y.id)); else S.add(l[k]); });
      return S;
    };
    const insFoots = () => (ICL = null, shell).querySelectorAll("table.ins-table[data-ik]").forEach(t => { const ft = t.querySelector("tfoot"); if (ft) ft.innerHTML = insFootHTML(t.dataset.ik); });
    const insFootHTML = k => {
      if (k === "qlt") return "";
      /* FORMAT 126 : lignes affichées, ou seulement les cases carrées cochées ; « TOTAL PARTIEL » si une partie seulement */
      /* v478 (remarque 10) : trois filtres combinés — filtres de colonne (lignes affichées), ronds (lignes choisies ou liées
         à ce qui est choisi), cases cochées ; « TOTAL PARTIEL » dès que l'un d'eux agit */
      /* v492 (remarque 7) : le total compte les lignes affichées (filtres de colonne, cases cochées des autres blocs ;
         dans le bloc lui-même, ses lignes cochées) ; les ronds ne filtrent plus. « TOTAL » quand tout le tableau est affiché,
         « TOTAL PARTIEL » dès qu'une partie seulement compte */
      const shown = insShown(k).filter(r => !r.t);
      const on = shown.filter(r => r.on === true);
      const rows = on.length ? on : shown;
      const partial = on.length > 0 || shown.length < INS[k].filter(r => !r.t).length;
      const ht = rows.reduce((t, r) => t + insHT(k, r), 0);
      const ttc = rows.reduce((t, r) => t + insTTC(k, r), 0);
      /* pied aligné sur l'ordre des colonnes de l'écran */
      /* v492 (remarque 9) : case TVA % du total = taux moyen pondéré (montant de TVA ÷ montant HT) */
      const cols = insColsOrd(k), val = { ht: money(ht), tva: ht ? money((ttc - ht) / ht * 100) + " %" : "", ttc: money(ttc) };
      /* même unité → unité + somme des quantités ; même unité et même prix → le prix */
      const us = new Set(rows.map(r => U_(r.u || "")));
      if (rows.length && us.size === 1 && [...us][0]) {
        val.u = [...us][0];
        val.q = money(rows.reduce((t, r) => t + (Number(insCalc(k, r, "q")) || 0), 0));
        const ps = new Set(rows.map(r => money(Number(insCalc(k, r, "p")) || 0)));
        if (ps.size === 1 && rows.every(r => String(insCalc(k, r, "p") ?? "") !== "")) val.p = [...ps][0];
      }
      const lab = partial ? "TOTAL PARTIEL" : "TOTAL";
      const first = cols.findIndex(c => val[c[0]] !== undefined);
      /* libellé dans une seule case qui couvre les colonnes vides de gauche : jamais coupé (« TOTAL PARTIEL » en entier) */
      const f0 = Math.max(0, first);
      const cells = cols.slice(f0).map(c => val[c[0]] !== undefined ? `<td class="${c[0] === "u" ? "center" : "number"}">${val[c[0]]}</td>` : "<td></td>");
      return `<tr class="bdg-d-total-row"><td colspan="${f0 + 1}" class="number" style="white-space:nowrap;overflow:visible;text-overflow:clip">${lab}</td>${cells.join("")}${insQCol(k) ? "<td></td>" : ""}${INS_EDIT ? "<td></td>" : ""}</tr>`;
    };
    /* case d'en-tête : toutes les lignes visibles (hors titres) cochées */
    const insAllOn = k => { const v = insShown(k).filter(r => !r.t); return v.length > 0 && v.every(r => r.on === true); };
    const insTableHTML = k => {
      const cols = insColsOrd(k);
      const lead = 1;
      const qw = insQCol(k) ? 160 : 0;
      const w = 36 * lead + (INS_EDIT ? 40 : 0) + qw + cols.reduce((t, c) => t + cwGet(k === "des" ? "client" : k, c[4]), 0);
      const t = insCfT(k);
      /* DÉTAIL QUALITÉ (une seule colonne) : toute la largeur du bloc, sauf largeur réglée à la main */
      const full = k === "qlt" && !cwLoad()["qlt.qlt"];
      return `<table class="bdg-d-table ins-table" data-ik="${k}" style="width:${full ? "100%" : w + "px"}">
        <colgroup>${'<col style="width:36px">'.repeat(lead)}${cols.map(c => `<col data-w="${t}.${c[4]}" ${full ? "" : `style="width:${cwGet(t, c[4])}px"`}>`).join("")}${qw ? `<col style="width:${qw}px">` : ""}${INS_EDIT ? '<col style="width:40px">' : ""}</colgroup>
        <thead><tr><th class="center ins-rdc">${lkRdAll(k)}</th>${cols.map(c => cfHead(t, c[4], c[1], c[2])).join("")}${qw ? '<th class="number lk-qh">QUANTITÉ DE LA TÂCHE</th>' : ""}${INS_EDIT
          ? `<th class="center ins-hdel"><input type="checkbox" class="ins-cball" title="Tout cocher"${insAllOn(k) ? " checked" : ""}></th>` : ""}</tr></thead>
        <tbody>${insBodyHTML(k)}</tbody>
        <tfoot>${insFootHTML(k)}</tfoot></table>`;
    };
    /* FORMAT 109 : bloc DÉSIGNATIONS CLIENT — à l'ouverture toutes les colonnes tiennent (cases comprises) :
       la colonne DÉSIGNATION se réduit (sauf largeur réglée à la main) ; texte à la ligne */
    const clientTaFit = root => (root || document).querySelectorAll("textarea.ins-ta").forEach(t => {
      t.style.height = "0px"; t.style.height = Math.max(20, t.scrollHeight) + "px";
    });
    const clientFit = () => {
      const sc = document.querySelector(".bdg-d-client-scroll"), cg = $("bdgClientCols");
      if (!sc || !cg) return;
      const tbl = sc.querySelector("table"), dc = cg.querySelector('col[data-w="client.designation"]');
      if (!sc.__ro && window.ResizeObserver) {
        let raf = 0; const run = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(clientFit); };
        sc.__ro = new ResizeObserver(run); sc.__ro.observe(sc);
        const body = $("bdgClientBody"); if (body) new MutationObserver(run).observe(body, { childList: true, subtree: true });
      }
      if (tbl && dc && !cwLoad()["client.designation"] && sc.clientWidth > 300) {
        const cols = [...cg.querySelectorAll("col")];
        const others = cols.filter(c => c !== dc).reduce((t, c) => t + (parseFloat(c.style.width) || 0), 0);
        const pr = parseFloat(getComputedStyle(sc).paddingRight) || 0;   /* FORMAT 134 : 9 px jusqu'au bord droit */
        const nd = Math.max(160, Math.min(cwGet("client", "designation"), Math.floor(sc.clientWidth - pr - others)));
        if (parseFloat(dc.style.width) !== nd) dc.style.width = nd + "px";
        const tw = others + nd + "px";
        if (tbl.style.width !== tw) tbl.style.width = tw;
      }
      /* version validée / figée : cellule DÉSIGNATION à la ligne */
      if (tbl && dc && !tbl.classList.contains("ins-table")) {
        const idx = [...cg.querySelectorAll("col")].indexOf(dc);
        tbl.querySelectorAll("tbody tr").forEach(tr => { const td = tr.children[idx]; if (td && td.colSpan <= 1) td.classList.add("c-wrap"); });
      }
      clientTaFit(sc);
    };
    const insRenderClient = () => {
      insNorm();
      const t = document.querySelector("#bdgClientTitle .ttl");
      const shownD = insShown("des");
      if (t) t.innerHTML = SVI_ICON.client + "DÉSIGNATIONS CLIENT " + svCnt(shownD.filter(r => !r.t).length, INS.des.filter(r => !r.t).length) + onlyBtn("des");
      lastShown.client = { cols: insCfCols("des"), rows: shownD, ins: true };
      lastClientKeys = new Set();
      /* même tableau que la version validée (identifiants gardés) */
      const tbl = $("bdgClientBody")?.closest("table");
      if (!tbl) return;
      const tmp = document.createElement("div");
      tmp.innerHTML = insTableHTML("des");
      const src = tmp.firstElementChild;
      tbl.classList.add("ins-table");
      tbl.dataset.ik = "des";
      tbl.style.width = src.style.width;
      $("bdgClientCols").innerHTML = src.querySelector("colgroup").innerHTML;
      $("bdgClientHead").innerHTML = src.querySelector("thead").innerHTML;
      $("bdgClientBody").innerHTML = src.querySelector("tbody").innerHTML;
      $("bdgClientFoot").innerHTML = src.querySelector("tfoot").innerHTML;
      insSyncTitles();
      insDim();
      clientFit();
    };
    /* mode SAISIE : la case sert à choisir des lignes (plus de grisé des autres) ; le choix unique est en mode LIAISONS */
    const insDim = () => {};
    /* ===== LOTS en arborescence (« / ») dans le bloc TÂCHES : niveaux repliables › / ⌄, nom du dernier niveau ===== */
    const lotSegs = r => String(r && r.v || "").split("/").map(x => x.trim()).filter(Boolean);
    /* v461 : NUMÉRO D'ORDRE des lots et niveaux (cahier, Planning budgétaire) — lots principaux 1, 2, 3… dans l'ordre des lots,
       puis 1.1, 1.2, 1.1.1… selon l'arborescence ; écrit devant le nom (« 1.1 BAS ») ; niveau sans nom = « NIVEAU 1.1 » */
    /* v527 (remarque 3) : « GROUPE » au lieu de « NIVEAU » (anciens noms « NIVEAU n » reconnus et affichés « GROUPE n ») */
    const LVL_AUTO = /^(NOUVEAU )?(NIVEAU|GROUPE) \d+(\.\d+)*$/i;
    let lotNumC = { k: null, M: null };
    /* v532 : un titre de groupe garde le numéro de son nom (« GROUPE 6 » reste « GROUPE 6 » quoi qu'on fasse dans le tableau) ;
       les lots sont numérotés selon leur place, en sautant les numéros déjà pris par les groupes du même niveau */
    const lotAutoNo = g => { const m = String(g || "").trim().match(/^(?:NOUVEAU )?(?:NIVEAU|GROUPE) (\d+(?:\.\d+)*)$/i); return m ? m[1] : ""; };
    const lotNumMap = () => {
      const k = INS.lot.map(x => (x.t ? "#" : "") + x.v).join("\n");
      if (lotNumC.k === k) return lotNumC.M;
      const M = new Map(), cnt = new Map(), res = new Map();
      const L = INS.lot.filter(x => !x.t);
      L.forEach(x => { let p = ""; lotSegs(x).forEach(g => { const par = p; p = p ? p + " / " + U_(g) : U_(g); const a = lotAutoNo(g); if (a) { if (!res.has(par)) res.set(par, new Set()); res.get(par).add(a.split(".").pop()); } }); });
      L.forEach(x => {
        let p = "";
        lotSegs(x).forEach(g => {
          const par = p; p = p ? p + " / " + U_(g) : U_(g);
          if (M.has(p)) return;
          const a = lotAutoNo(g);
          if (a) { M.set(p, a); return; }
          let n = cnt.get(par) || 0;
          do n++; while (res.has(par) && res.get(par).has(String(n)));
          cnt.set(par, n);
          M.set(p, (par ? M.get(par) + "." : "") + n);
        });
      });
      lotNumC = { k, M };
      return M;
    };
    const lotLab = segs => {
      const sg = (segs || []).map(x => String(x || "").trim()).filter(Boolean);
      const no = lotNumMap().get(sg.map(U_).join(" / ")) || "", last = sg[sg.length - 1] || "";
      /* v528 (remarque 4) : un titre « NIVEAU … » (même au premier rang) s'affiche « GROUPE » + son numéro ; v532 : celui de son nom */
      const auto = LVL_AUTO.test(last);
      const name = auto ? "GROUPE " + lotAutoNo(last) : last;
      return { no, auto, name, full: auto ? name : (no ? no + " " : "") + last };
    };
    const lotNoHTML = L => L.auto || !L.no ? "" : `<span class="lvl-no">${esc(L.no)}</span>`;
    /* nom d'un nouveau niveau de lot (16/10/2026) : « NIVEAU n », numéro suivant dans le budget (anciens « NOUVEAU NIVEAU n » comptés) */
    /* v450 : nom d'un niveau créé selon l'arborescence — sous un lot : NIVEAU 1, NIVEAU 2… (rang parmi les niveaux du même parent) ;
       sous un niveau « NIVEAU 2 » : NIVEAU 2.1, NIVEAU 2.2… ; affiché avec le nom des parents (« FONDATION / NIVEAU 2 ») tant qu'on ne lui donne pas un intitulé */
    const insNextLevel = (parent = []) => {
      const P = parent.map(U_), last = P.length ? P[P.length - 1] : "";
      /* v451 : tous les lots principaux sont au niveau 1 → dessous NIVEAU 1.1, 1.2… ; sous NIVEAU 1.1 → 1.1.1… ;
         sous un sous-lot portant un intitulé : numéro selon sa profondeur (1.1 pour le 2e niveau, etc.) */
      /* v532 : numéro = celui du parent (tel qu'affiché) + le suivant libre parmi ses lignes ; il ne changera plus */
      void last;
      const M = lotNumMap(), pn = P.length ? M.get(P.join(" / ")) || "" : "";
      const base = pn ? pn + "." : "";
      const kids = new Set();
      INS.lot.forEach(x => { const sg = lotSegs(x).map(U_); if (sg.length > P.length && P.every((g, i) => g === sg[i])) kids.add(sg.slice(0, P.length + 1).join(" / ")); });
      const used = [...kids].map(p => Number(String(M.get(p) || "").split(".").pop()) || 0);
      let n = (used.length ? Math.max(...used) : 0) + 1;
      while (kids.has(P.concat("GROUPE " + base + n).join(" / "))) n++;
      return "GROUPE " + base + n;
    };
    const lotUnder = (r, P) => { const s2 = lotSegs(r); return s2.length >= P.length && P.every((g, i) => U_(g) === U_(s2[i])); };
    /* arborescence dans l'ordre des lots (classés par ordre alphabétique au départ, puis ordre libre) :
       un niveau prend la place de son premier lot */
    const lotTreeRows = list => {
      /* v506 (remarque 59) : ordre de la liste affichée (lots choisis / liés en haut, tri de colonne) — le lot choisi remonte
         avec son chemin, comme une désignation avec ses titres */
      const flat = list.filter(r => INS.lot.includes(r));
      const root = { kids: [], map: new Map() };
      flat.forEach(r => {
        let n = root;
        lotSegs(r).forEach(g => { const K = U_(g); if (!n.map.has(K)) { const c = { name: g, kids: [], map: new Map(), recs: [] }; n.map.set(K, c); n.kids.push(c); } n = n.map.get(K); });
        (n.recs = n.recs || []).push(r);
        if (!lotSegs(r).length) root.kids.push({ name: "", kids: [], map: new Map(), recs: [r], empty: true });
      });
      const rows = [];
      const walk = n => n.kids.forEach(c => { (c.recs || []).forEach(r => rows.push(r)); walk(c); });
      walk(root);
      const byPath = new Set(rows.map(r => U_(lotSegs(r).join(" / "))));
      const ch = LK.lot && INS.lot.find(x => x.id === LK.lot), chP = ch ? U_(lotSegs(ch).join(" / ")) : "";
      const folded = p => dlyIsFolded(p) && !chP.startsWith(U_(p) + " / ");
      const out = [], seen = new Set();
      rows.forEach(r => {
        const sg = lotSegs(r);
        for (let i = 1; i < sg.length; i++) {
          const p = sg.slice(0, i).join(" / ");
          if (seen.has(U_(p))) continue;
          seen.add(U_(p));
          if (!byPath.has(U_(p))) out.push({ grp: true, path: p, segs: sg.slice(0, i), lvl: i - 1 });
        }
        seen.add(U_(sg.join(" / ")));
        out.push({ r, path: sg.join(" / "), segs: sg, lvl: Math.max(0, sg.length - 1) });
      });
      out.forEach(x => { x.kids = out.some(y => y !== x && U_(y.path).startsWith(U_(x.path) + " / ")); });
      return out.filter(x => { for (let i = 1; i < x.segs.length; i++) if (folded(x.segs.slice(0, i).join(" / "))) return false; return true; });
    };
    const lotTreeHTML = list => lotTreeRows(list).map(x => {
      /* v530 (remarque 2) : un sous-groupe (titre sans lot à lui) est décalé au niveau des numéros de ses lots frères (5.1, 7.1…),
         pour ne plus paraître au rang des lots du dessus */
      const pad = `style="margin-left:${x.lvl * 16 + (x.grp && x.lvl ? 14 : 0)}px"`;
      /* v510 (remarque 68) : signe d'un niveau aux couleurs des ronds de sa branche (rouge choisi, bleu lié, violet mélange) */
      const UB = INS.lot.filter(r => !r.t && lotUnder(r, x.segs));
      const fst = x.kids && INS_EDIT ? sviFoldState(UB.some(r => LK.lot === r.id), UB.some(r => lkHit("lot", r.id))) : "";
      const fold = x.kids ? `<span class="ins-fold lot-fold${fst}" data-path="${esc(x.path)}">${dlyIsFolded(x.path) ? "›" : "⌄"}</span>` : `<span class="lot-fold-sp"></span>`;
      if (x.grp) {
        /* niveau sans lot à lui : nom modifiable, case = toute sa branche */
        const br = INS.lot.filter(r => !r.t && lotUnder(r, x.segs));
        const all = br.length && br.every(r => r.on === true);
        const GL = lotLab(x.segs);
        /* v510 (remarque 68) : niveau replié qui cache un lot coché = bleu */
        return `<div class="ins-li lot-grp${dlyIsFolded(x.path) && br.some(r => r.on === true) ? " ins-hasck" : ""}" data-path="${esc(x.path)}"><span class="ins-rdc">${lkRdPart("lot", x.path)}</span><span class="lot-in" ${pad}>${fold}${lotNoHTML(GL)}${INS_EDIT ? `<input class="lot-gname" data-kind="grp" data-path="${esc(x.path)}" value="${esc(GL.name)}" autocomplete="off">` : `<span>${esc(GL.name)}</span>`}</span>
          ${INS_EDIT ? `<span class="ins-delc"><input type="checkbox" class="lot-gcb" data-path="${esc(x.path)}"${all ? " checked" : ""}></span>` : ""}</div>`;
      }
      const r = x.r, k = "lot";
      const pre = x.segs.length > 1 ? x.segs.slice(0, -1).join(" / ") + " / " : "";
      const LL = lotLab(x.segs);
      const nm = x.segs.length ? LL.name : (r.v || "");
      return `<div class="ins-li${x.kids ? " lot-par" : ""}${INS_EDIT && LK[k] === r.id ? " lk-sel" : ""}${INS_EDIT && lkAnyLinked(k, r.id) ? " lk-link" : ""}${INS_EDIT && lkHit(k, r.id) ? " lk-hit" : ""}${INS_EDIT && LK[k] && LK[k] !== r.id && !(LK.des && lkIsLinked(k, r.id)) ? " lk-dim" : ""}${lkBanAttr(k, r) ? " lk-ban" : ""}" data-ik="${k}" data-iid="${r.id}"${lkBanAttr(k, r)}>
          ${INS_EDIT ? `<span class="ins-rdc">${lkRd(k, r)}</span><span class="lot-in" ${pad}>${fold}${lotNoHTML(LL)}<input class="ins-in" data-f="v" enterkeyhint="next" data-pre="${esc(pre)}" value="${esc(nm)}" autocomplete="off"></span>
            <span class="ins-delc">${insDelCell(r)}</span>` : `<span class="lot-in" ${pad}>${fold}<span>${esc(x.segs.length ? LL.full : nm)}</span></span>`}
        </div>`;
    }).join("");
    /* glissement d'un lot (FORMAT 26, 44) : dans un niveau = passe dessous ; avant / après = même niveau que la ligne visée ;
       superposé à un lot = nouveau niveau « NIVEAU n » qui regroupe les deux */
    /* v529 : lots rangés dans l'ordre de l'arborescence affichée (un niveau prend la place de son premier lot) */
    const lotTreeOrder = arr => {
      const first = new Map();
      arr.forEach((r, i) => { const s2 = lotSegs(r); for (let j = 1; j <= s2.length; j++) { const p = U_(s2.slice(0, j).join(" / ")); if (!first.has(p)) first.set(p, i); } });
      const key = r => { const s2 = lotSegs(r); return s2.map((_, j) => first.get(U_(s2.slice(0, j + 1).join(" / ")))); };
      const K = new Map(arr.map(r => [r, key(r)]));
      const pos = new Map(arr.map((r, i) => [r, i]));
      return arr.slice().sort((a, b) => {
        const A = K.get(a), B = K.get(b);
        for (let i = 0; i < Math.min(A.length, B.length); i++) if (A[i] !== B[i]) return A[i] - B[i];
        return A.length - B.length || pos.get(a) - pos.get(b);
      });
    };
    /* v529 (remarques 4 et 5) : dépôt ENTRE deux lignes de la liste des lots — gap = { prev: chemin de la ligne du dessus (ou null),
       inStart: ligne du dessus = titre déplié (on entre dedans, en premier), D: rang d'arrivée (0 = premier rang) } */
    const lotDrop = (srcId, tEl, mode, gap) => {
      /* v525 : « @chemin » = un titre de niveau (sans lot à lui) et toute sa branche */
      const gP = String(srcId || "").startsWith("@") ? dlyLotPath(String(srcId).slice(1)) : null;
      const L = INS.lot, src = gP ? { v: gP.join(" / ") } : L.find(x => x.id === srcId);
      if (!src || !tEl) return;
      const P = gP || lotSegs(src);
      /* v531 : le tableau reste stable à l'endroit de la ligne de destination (création d'un titre comprise) */
      const y0 = tEl.getBoundingClientRect().top, sc0 = tEl.closest(".bdg-h-col"), st0 = sc0 ? sc0.scrollTop : 0, wy0 = window.scrollY;
      const tKey = tEl.classList.contains("lot-grp") ? { path: tEl.dataset.path } : { iid: tEl.dataset.iid };
      const tSegs = tEl.classList.contains("lot-grp") ? dlyLotPath(tEl.dataset.path) : lotSegs(L.find(x => x.id === tEl.dataset.iid));
      let base, extra = null, N = "";
      if (mode === "gap") base = !gap.prev ? [] : gap.inStart ? gap.prev.slice() : gap.prev.slice(0, gap.D);
      else if (mode === "on" && tEl.classList.contains("lot-grp")) base = tSegs;
      else if (mode === "on") {
        N = insNextLevel(tSegs.slice(0, -1));
        base = tSegs.slice(0, -1).concat(N);
        extra = { P: tSegs, base };
      } else base = tSegs.slice(0, -1);
      if (base.length >= P.length && P.every((g, i) => U_(g) === U_(base[i]))) return;   /* pas dans sa propre branche */
      const plan = new Map();
      const add = (P0, b0) => L.filter(x => !x.t && lotUnder(x, P0)).forEach(x => { plan.set(x.id, b0.concat(lotSegs(x).slice(P0.length - 1)).join(" / ")); });
      add(P, base);
      if (extra) add(extra.P, extra.base);
      /* v531 : lots de la ligne visée (nouveau titre) repérés AVANT le renommage — ils restent à leur place, le bloc déplacé vient à côté
         (avant : le nouveau titre partait en haut de la liste) */
      const keepIds = new Set(extra ? L.filter(x => !x.t && lotUnder(x, extra.P) && !lotUnder(x, P)).map(x => x.id) : []);
      const same = [...plan].every(([id, v]) => U_((L.find(x => x.id === id) || {}).v) === U_(v));
      if (!same) {
        const ids = new Set(plan.keys()), vals = [...plan.values()].map(U_);
        const clash = [...plan.values()].find(v => L.some(y => !ids.has(y.id) && U_(y.v) === U_(v))) || vals.find((v, i) => vals.indexOf(v) !== i);
        if (clash) { svToast("LOT « " + clash + " » EXISTE DÉJÀ : DÉPLACEMENT REFUSÉ.", 4000, tEl); return; }
        plan.forEach((v, id) => { L.find(x => x.id === id).v = v; });
      }
      /* ordre : le bloc déplacé se place à l'endroit du dépôt */
      {
        const mv = lotTreeOrder(L).filter(x => plan.has(x.id) && !keepIds.has(x.id));
        const rest = lotTreeOrder(L.filter(x => !mv.includes(x)));
        const nodeOf = tEl.classList.contains("lot-grp") ? lotSegs({ v: tEl.dataset.path }) : null;
        const tId = tEl.dataset.iid;
        const under = r => nodeOf ? lotUnder(r, nodeOf) : r.id === tId || lotUnder(r, lotSegs(L.find(x => x.id === tId)));
        let idx;
        if (mode === "gap") {
          const pv = gap.prev;
          if (!pv) idx = 0;
          else if (gap.inStart) { idx = rest.findIndex(r => lotUnder(r, pv) && lotSegs(r).length > pv.length); if (idx < 0) { let last = -1; rest.forEach((r, i) => { if (lotUnder(r, pv)) last = i; }); idx = last + 1; } }
          else { const Nd = gap.D >= pv.length ? pv : pv.slice(0, gap.D + 1); let last = -1; rest.forEach((r, i) => { if (lotUnder(r, Nd)) last = i; }); idx = last + 1; }
        }
        else if (mode === "before") idx = rest.findIndex(under);
        else { let last = -1; rest.forEach((r, i) => { if (under(r)) last = i; }); idx = last + 1; }
        if (idx < 0) idx = rest.length;
        rest.splice(idx, 0, ...mv);
        L.splice(0, L.length, ...rest);
      }
      dlyPlanFromTasks("lot");
      insSave();
      histLog("TÂCHES", N ? "GROUPE DE LOTS CRÉÉ" : same ? "ORDRE DES LOTS" : "LOT DÉPLACÉ", (src.v || "") + (N ? " — " + N : ""));
      refreshAll();
      /* ligne ancrée : le nouveau titre (ou la ligne visée) revient à la hauteur où était la ligne de destination */
      const col = () => shell.querySelector('.ins-hcol[data-ik="lot"]');
      const anchorEl = () => {
        const c = col(); if (!c) return null;
        if (N) return [...c.querySelectorAll(".ins-li.lot-grp")].find(x => x.dataset.path === base.join(" / "));
        if (tKey.iid) return c.querySelector(`.ins-li[data-iid="${tKey.iid}"]`);
        return [...c.querySelectorAll(".ins-li.lot-grp")].find(x => x.dataset.path === tKey.path) || null;
      };
      const fix = () => {
        const el = anchorEl(); if (!el) return;
        /* la liste peut avoir été redessinée (défilement remis à zéro) : on repart de la position d'avant le dépôt */
        const c0 = col(); if (c0 && c0.__lotFix !== drop0) { c0.__lotFix = drop0; c0.scrollTop = st0; window.scrollTo(window.scrollX, wy0); }
        let d = el.getBoundingClientRect().top - y0;
        if (Math.abs(d) < 1) return;
        const sc = el.closest(".bdg-h-col");
        if (sc && sc.scrollHeight > sc.clientHeight + 1) { const t0 = sc.scrollTop; sc.scrollTop = t0 + d; d -= sc.scrollTop - t0; }
        if (Math.abs(d) >= 1) window.scrollBy(0, d);
      };
      const drop0 = performance.now();
      keepScroll.hold = performance.now() + 450;
      fix(); requestAnimationFrame(fix);
      [70, 160, 300].forEach(t => setTimeout(fix, t));
      /* nouveau niveau : son nom est prêt à être saisi (sans faire défiler l'écran) */
      if (N) setTimeout(() => { const i = [...shell.querySelectorAll("input.lot-gname")].find(x => x.dataset.path === base.join(" / ")); if (i) { try { i.focus({ preventScroll: true }); } catch (e) { i.focus(); } try { i.select(); } catch (e) {} fix(); } }, 60);
    };
    if (!shell.__lotTreeBound) {
      shell.__lotTreeBound = true;
      shell.addEventListener("click", e => {
        const f = e.target.closest && e.target.closest(".lot-fold");
        if (!f) return;
        e.stopPropagation();
        dlyFoldToggle(f.dataset.path);
        refreshAll();
      }, true);
      shell.addEventListener("change", e => {
        const g = e.target.closest && e.target.closest("input.lot-gcb");
        if (g) { const P = dlyLotPath(g.dataset.path); INS.lot.forEach(r => { if (!r.t && lotUnder(r, P)) r.on = g.checked; }); insSave(); refreshAll(); return; }
        const n = e.target.closest && e.target.closest("input.lot-gname");
        if (n && shell.__insDly && !n.__gnDone) { n.__gnDone = true; shell.__insDly.rename(n); }
      });
    }
    /* v529 (remarque 3) : nom tapé sur un titre de groupe gardé même si l'écran est redessiné avant que la case ne soit quittée
       (iPad : toucher un rond, un signe de pliage ou un autre groupe ne fait pas toujours perdre le focus) — LOTS et PLANNING */
    const grpFlush = () => {
      const a = document.activeElement;
      if (!a || !a.matches || !a.matches("input.lot-gname, input.dly-nm:not(.dly-gin)") || !shell.contains(a) || a.__gnDone) return;
      if (a.value === a.defaultValue || !shell.__insDly) return;
      a.__gnDone = true;
      shell.__insDly.rename(a);
    };
    const insRenderHier = only => {
      grpFlush();
      LKS = lkLinked(); LKG = insUsed(); LKH = lkHits();
      const col = (title, k) => {
        if (ONLYC[k] && !INS[k].some(r => r.on === true)) ONLYC[k] = false;
        const csk = insCheckSet(k);   /* v492 (remarque 7) : cases cochées des autres blocs */
        /* v525 (remarque 4) : colonne U des activités triable et filtrable (loupe), comme toutes les colonnes */
        const hcols = [["v", title, r => r.v || "", ""]].concat(k === "sec" ? [["u", "U", r => U_(r.u), "center"]] : k === "prim" ? [["u", "U", r => U_(actU(k, r)), "center"]] : []);
        /* v528 (remarque 3) : la liste des LOTS (arborescence) garde son ordre quand on choisit un lot ou un groupe */
        const list = (k === "lot" ? (k2, rows) => rows : lkTop)(k, cfApply(k, hcols, INS[k]).filter(r => (!ONLYC[k] || r.on === true) && (!csk || r.t || csk.has(r.id))));
        lastShown.hier[k] = list.map(r => r.v || "");
        /* v528 (remarque 2) : lignes de la liste (lots repliés compris) — pour la case carrée d'en-tête */
        shell.__hierList = shell.__hierList || {}; shell.__hierList[k] = list.map(r => r.id);
        const on = !!cfT(k).f.v;
        return `
        <div class="bdg-h-col ins-hcol" data-ik="${k}">
          <div class="bdg-h-head ${on ? "cf-on" : ""}">${INS_EDIT ? `<span class="ins-rdc">${lkRdAll(k)}</span>` : ""}<span class="cf-wrap"><span class="cf-lab">${title}${svCnt(list.length, INS[k].length)}</span>${onlyBtn(k, true)}<span class="cf-btn"
            data-cf="${k}" data-col="v" role="button" aria-label="Trier / filtrer">${cfIcon}</span></span>${k === "sec" || k === "prim" ? `<span class="act-uh${cfT(k).f.u || (cfT(k).sort && cfT(k).sort.col === "u" && !cfT(k).sort.def) ? " cf-on" : ""}"><span class="act-uhl">U</span><span class="cf-btn" data-cf="${k}" data-col="u" role="button" aria-label="Trier / filtrer">${cfIcon}</span></span>` : ""}${INS_EDIT
            ? `<span class="ins-hdel"><input type="checkbox" class="ins-cball" title="Tout cocher"${list.length && list.every(r => r.on === true) ? " checked" : ""}></span>` : ""}</div>
          ${k === "lot" ? lotTreeHTML(list) : list.map(r => `<div class="ins-li${INS_EDIT && LK[k] === r.id ? " lk-sel" : ""}${INS_EDIT && lkAnyLinked(k, r.id) ? " lk-link" : ""}${INS_EDIT && lkHit(k, r.id) ? " lk-hit" : ""}${INS_EDIT && LK[k] && LK[k] !== r.id && !(LK.des && lkIsLinked(k, r.id)) ? " lk-dim" : ""}${lkBanAttr(k, r) ? " lk-ban" : ""}" data-ik="${k}" data-iid="${r.id}"${lkBanAttr(k, r)}>
              ${INS_EDIT ? `<span class="ins-rdc">${lkRd(k, r)}</span><input class="ins-in" data-f="v" enterkeyhint="next" value="${esc(r.v || "")}" autocomplete="off">${actUCell(k, r)}
                <span class="ins-delc">${insDelCell(r)}</span>` : `<span>${esc(r.v || "")}</span>${actUCell(k, r)}`}
            </div>`).join("")}
          ${INS_EDIT ? `<div class="ins-li ins-new" data-ik="${k}"><span class="ins-rdc"></span>
              <input class="ins-in" data-f="v" enterkeyhint="next" placeholder="SAISIR ICI…" autocomplete="off">${k === "sec" ? `<span class="act-u"><input class="ins-in act-uin" data-f="u" enterkeyhint="next" placeholder="U" autocomplete="off"></span>` : k === "prim" ? `<span class="act-u act-uro"></span>` : ""}<span class="ins-delc"></span></div>`
            : (list.length ? "" : `<div class="bdg-h-item" style="opacity:.5;cursor:default">—</div>`)}
        </div>`;
      };
      const T = { lot: "LOT", prim: "ACTIVITÉ PRIMAIRE", sec: "ACTIVITÉ SECONDAIRE" };
      const old = only && $("bdgHier").querySelector(`.ins-hcol[data-ik="${only}"]`);
      if (old) {
        const tmp = document.createElement("div");
        tmp.innerHTML = col(T[only], only);
        old.replaceWith(tmp.firstElementChild);
        return;
      }
      $("bdgHier").style.gridTemplateColumns = "";
      $("bdgHier").innerHTML = col(T.lot, "lot") + col(T.prim, "prim") + col(T.sec, "sec");
    };
    const insMoreRows = k => {
      const rest = insMore[k];
      const tb = $("bdgTabBody")?.querySelector(`table.ins-table[data-ik="${k}"] tbody`);
      if (!rest || !rest.length || !tb) return;
      const part = rest.splice(0, INS_CHUNK * 2);
      LKS = lkLinked(); LKG = insUsed(); LKH = lkHits();
      const tmp = document.createElement("tbody");
      tmp.innerHTML = part.map(r => insRowHTML(k, r, 0)).join("");
      const before = tb.querySelector("tr.ins-new");
      [...tmp.children].forEach(tr => tb.insertBefore(tr, before));
      insMarkUnlinked();
    };
    if (!shell.__moreBound) {
      shell.__moreBound = true;
      shell.addEventListener("scroll", e => {
        const sc = e.target;
        if (!sc || !sc.matches || !sc.matches(".bdg-d-tabbody .bdg-d-scroll") || !shell.__insMore) return;
        if (sc.scrollTop + sc.clientHeight > sc.scrollHeight - 300) shell.__insMore();
      }, true);
    }
    /* IMPORT NON CRÉÉ (onglet du détail) : lignes du fichier qui n'ont pas pu être liées ;
       corrigées ici (case fautive encadrée), elles créent leur liaison et sortent de l'onglet */
    const INC_COLS = [["art", "ART", 60, "center"], ["dc", "DÉSIGNATION CLIENT", 240, ""], ["upb", "UPB", 60, "center"], ["lot", "LOT", 150, ""],
      ["prim", "ACTIVITÉ PRIMAIRE", 170, ""], ["sec", "ACTIVITÉ SECONDAIRE", 170, ""], ["type", "TYPE", 70, "center"], ["article", "ARTICLE", 80, "center"],
      ["des", "DÉSIGNATION PRODUIT / CHARGE", 220, ""], ["u", "UNITÉ", 60, "center"], ["nbr", "NBR", 60, "number"], ["d1", "DIM 1", 60, "number"], ["d2", "DIM 2", 60, "number"],
      ["d3", "DIM 3", 60, "number"], ["q", "QTE", 70, "number"], ["p", "PCB", 80, "number"], ["deb", "DÉBUT", 100, "center"], ["fin", "FIN", 100, "center"], ["pred", "PRÉDÉCESSEURS", 220, ""]];
    const insIncHTML = () => {
      /* justificatif : numéro de la ligne dans le tableau source + raison */
      const why = x => (x.line ? "LIGNE " + x.line + " — " : "") + (x.why || "");
      const UC = [...INC_COLS.map(c => [c[0], c[1], x => x.src[c[0]] || "", c[3]]), ["why", "RAISON", why, ""]];
      /* classement (FORMAT 92) : raisons par ordre alphabétique, puis lignes du fichier par ordre croissant ;
         doublons : les lignes en doublon d'une même ligne d'origine se suivent (groupes par ligne d'origine) */
      const incKey = x => {
        const w = String(x.why || ""), m = /IDENTIQUE À LA LIGNE (\d+)/.exec(w);
        return m ? "DOUBLON DANS LE FICHIER " + String(m[1]).padStart(7, "0") : w.replace(/^LIAISON DU BUDGET DÉLIÉE — /, "");
      };
      const incLn = x => { const n = parseInt(x.line, 10); return isNaN(n) ? Infinity : n; };
      const rows = cfApply("lk_inc", UC, (INS.inc || []).slice().sort((a, b) => incKey(a).localeCompare(incKey(b), "fr") || incLn(a) - incLn(b) || natCmp(a.src.dc, b.src.dc)));
      lastShown.detail = { cols: UC, rows, kind: "inc" };
      const w = k => cwLoad()["lk_inc." + k] || ((INC_COLS.find(c => c[0] === k) || [])[2]) || 320;
      const ed = INS_EDIT;
      const all = rows.length && rows.every(x => x.on === true);
      const OC = coOrder("lk_inc", UC);
      return `<table class="bdg-d-table ins-table lk-table inc-table" style="width:${UC.reduce((t, c) => t + w(c[0]), 0) + 40}px">
        <colgroup>${OC.map(c => `<col data-w="lk_inc.${c[0]}" style="width:${w(c[0])}px">`).join("")}<col style="width:40px"></colgroup>
        <thead><tr>${OC.map(c => cfHead("lk_inc", c[0], c[1], c[3])).join("")}<th class="center">${ed ? `<input type="checkbox" class="inc-cball"${all ? " checked" : ""}>` : ""}</th></tr></thead>
        <tbody>${rows.map(x => `<tr data-inc="${x.id}">${OC.map(c => c[0] === "why" ? `<td class="inc-why">${esc(why(x))}</td>` : `<td class="${c[3]} ins-td${(x.bad || []).includes(c[0]) ? " inc-bad" : ""}">${ed
            ? `<input class="ins-in inc-in ${c[3]}" data-f="${c[0]}" value="${esc(x.src[c[0]] || "")}" autocomplete="off">` : esc(x.src[c[0]] || "")}</td>`).join("")}
          <td class="center">${ed ? `<input type="checkbox" class="inc-cb"${x.on === true ? " checked" : ""}>` : ""}</td></tr>`).join("")
          || `<tr><td colspan="${UC.length + 1}" class="empty">AUCUNE LIGNE</td></tr>`}</tbody></table>`;
    };
    if (!shell.__incBound) {
      shell.__incBound = true;
      shell.addEventListener("change", e => {
        const X = shell.__incX;
        if (!X || !e.target.closest || !e.target.closest(".inc-table")) return;
        const tr = e.target.closest("tr[data-inc]");
        if (e.target.classList.contains("inc-cball")) {
          /* case d'en-tête : seulement les lignes affichées par le filtre (FORMAT 84) */
          const vi = new Set([...e.target.closest("table").querySelectorAll("tbody tr[data-inc]")].map(tr => tr.dataset.inc));
          (X.INS.inc || []).forEach(x => { if (vi.has(x.id)) x.on = e.target.checked; }); X.save(); X.refresh(); return; }
        const it = tr && (X.INS.inc || []).find(x => x.id === tr.dataset.inc);
        if (!it) return;
        if (e.target.classList.contains("inc-cb")) { it.on = e.target.checked; X.save(); return; }
        const inp = e.target.closest("input.inc-in");
        if (inp) {
          it.src[inp.dataset.f] = inp.value.trim().toUpperCase();
          /* toutes les cases effacées : la ligne est supprimée (FORMAT 90) */
          if (INC_COLS.every(c => String(it.src[c[0]] ?? "").trim() === "")) { X.INS.inc = (X.INS.inc || []).filter(x => x.id !== it.id); X.save(); X.refresh(); return; }
          const idx = [...inp.closest("tbody").querySelectorAll("tr[data-inc]")].indexOf(tr);
          const want = shell.__incNext && Date.now() - shell.__incNext.t < 1500 ? shell.__incNext : null;
          X.tryIt(it);
          /* le curseur va à la case fautive voulue ; ligne sortie : 1re case fautive de la ligne qui prend sa place */
          if (want) setTimeout(() => {
            const tb = shell.querySelector(".inc-table tbody");
            if (!tb) return;
            let el = tb.querySelector(`tr[data-inc="${want.id}"] input[data-f="${want.f}"]`);
            if (!el || !el.closest("td.inc-bad")) { const trs = [...tb.querySelectorAll("tr[data-inc]")]; const r2 = trs[Math.min(idx, trs.length - 1)]; el = r2 && r2.querySelector("td.inc-bad input.inc-in"); }
            if (el) { el.focus(); try { el.select(); } catch (err) {} el.scrollIntoView({ block: "nearest", inline: "nearest" }); }
          }, 30);
        }
      });
    }
    shell.__incX = INS && INS_EDIT ? { INS, save: () => insSave(), refresh: () => refreshAll(), tryIt: it => incTry(it) } : null;
