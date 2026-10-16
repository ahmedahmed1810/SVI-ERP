@verbatim/* ===== tri et filtre par colonne (façon tableur) ===== */
    const CF = {};          /* CF[table] = { sort:{col,dir}|null, f:{col:Set} } */
    const cfSrc = {};       /* dernières lignes et colonnes de chaque tableau */
    const cfT = t => CF[t] || (CF[t] = { sort: null, f: {} });
    const cfText = v =>
      typeof v === "number" ? money(v) : String(v ?? "").trim();
    const cfIcon =
      `<svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
         <path d="M1 2h11M3 5h7M5 8h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
         <path d="M4.5 10l2 2.2 2-2.2z" fill="currentColor"/>
       </svg>`;

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
      const on = !!st.f[key] || !!(st.sort && st.sort.col === key && !st.sort.def);
      return `<th class="${cls} ${on ? "cf-on" : ""}">
        <span class="cf-wrap"><span class="cf-lab">${label}</span><span class="cf-btn" data-cf="${t}" data-col="${key}"
          role="button" aria-label="Trier / filtrer">${cfIcon}</span></span><span
          class="col-rs" data-rs="${t}" data-col="${key}"></span></th>`;
    };

    /* ===== largeurs de colonnes : fixes, réglables, mémorisées ===== */
    const CW_KEY = "svi_colw_v1";
    const cwLoad = () => {
      try { return JSON.parse(localStorage.getItem(CW_KEY) || "{}") || {}; }
      catch (e) { return {}; }
    };
    const cwSave = obj => {
      try { localStorage.setItem(CW_KEY, JSON.stringify(obj)); } catch (e) {}
    };
    const CW_DEF = {
      article: 70, designation: 330, detail: 300, unit: 70,
      qty: 100, price: 95, ht: 120, amount: 120, tva: 80, ttc: 130,
      nbr: 60, d1: 60, d2: 60, d3: 60
    };
    /* FORMAT 113 : disposition par défaut = largeurs réglées par Ahmed sur l'iPad (13/10/2026) */
    const CW_DEF_T = {
      "client.article": 69, "client.designation": 660, "client.unit": 70, "client.qty": 71, "client.price": 86, "client.ht": 96, "client.tva": 81, "client.ttc": 97,
      "chg.article": 69, "chg.detail": 545, "chg.unit": 70, "chg.qty": 109, "chg.price": 107, "chg.amount": 120, "chg.tva": 80, "chg.ttc": 130,
      "prd.detail": 176, "prd.tache": 246, "prd.unit": 70, "prd.nbr": 77, "prd.d1": 79, "prd.d2": 79, "prd.d3": 79, "prd.qty": 72, "prd.price": 72, "prd.amount": 92, "prd.tva": 82, "prd.ttc": 109
    };
    const cwGet = (t, k) => cwLoad()[t + "." + k] || CW_DEF_T[t + "." + k] || CW_DEF[k] || 100;

    /* colgroup + largeur totale de la table */
    const cwCols = (t, cols) =>
      cols.map(([k]) =>
        `<col data-w="${t}.${k}" style="width:${cwGet(t, k)}px">`
      ).join("");
    const cwTableW = (t, cols) =>
      cols.reduce((sum, [k]) => sum + cwGet(t, k), 0);

    /* ===== ordre des colonnes : glisser un en-tête, ordre mémorisé ===== */
    const CO_KEY = "svi_colorder_v1";
    const coLoad = () => {
      try { return JSON.parse(localStorage.getItem(CO_KEY) || "{}") || {}; }
      catch (e) { return {}; }
    };
    const coSave = obj => {
      try { localStorage.setItem(CO_KEY, JSON.stringify(obj)); } catch (e) {}
    };
    /* clés dans l'ordre choisi (colonnes inconnues gardées à la fin) */
    const coKeys = (t, keys) => {
      const saved = (coLoad()[t] || []).filter(k => keys.includes(k));
      return [...saved, ...keys.filter(k => !saved.includes(k))];
    };
    const coOrder = (t, cols) => {
      const order = coKeys(t, cols.map(c => c[0]));
      return order.map(k => cols.find(c => c[0] === k));
    };
    /* FORMAT 102 : ordre des colonnes tel qu'affiché à l'écran (après glissement) — copies, exports, aperçus */
    const screenCols = (table, cols) => {
      if (!table || !cols) return cols;
      const keys = [...table.querySelectorAll("thead tr:first-child > th .cf-btn[data-col]")].map(b => b.dataset.col);
      const out = keys.map(k => cols.find(c => c[0] === k)).filter(Boolean);
      return out.length ? [...out, ...cols.filter(c => !out.includes(c) && !keys.length)] : cols;
    };
    const detailTable = () => body && body.querySelector("table.bdg-d-table, table.ins-table, table.lk-table");
    /* réordonne un tableau déjà dessiné (col, en-têtes, lignes, pied) */
    const coApply = (t, table) => {
      if (!table) return;
      const ths = [...table.querySelectorAll("thead tr:first-child > th")];
      const keys = ths.map(th => th.querySelector(".cf-btn")?.dataset.col);
      if (keys.some(k => !k)) return;
      const order = coKeys(t, keys);
      if (order.every((k, i) => k === keys[i])) return;
      const perm = order.map(k => keys.indexOf(k));
      const n = keys.length;
      const reorder = parent => {
        const kids = [...parent.children];
        if (kids.length !== n || kids.some(c => c.colSpan > 1)) return;
        perm.forEach(i => parent.appendChild(kids[i]));
      };
      table.querySelectorAll("colgroup").forEach(reorder);
      table.querySelectorAll("tr").forEach(reorder);
    };

    let cfOpen = null;   /* { t, key } du menu ouvert */
    let cfPlace = () => {};

    const cfClose = () => {
      window.visualViewport?.removeEventListener("resize", cfPlace);
      window.visualViewport?.removeEventListener("scroll", cfPlace);
      document.getElementById("cfMenu")?.remove();
      cfOpen = null;
    };

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
        const st0 = cfT(t);
        cfOpen = { t, key, draft: new Set(st0.f[key] ? [...st0.f[key]] : cfValues(t, key)) };
      }
      const m = document.createElement("div");
      m.id = "cfMenu";
      m.innerHTML = `
        <div class="cf-rsz" title="Largeur et hauteur"></div>
        <button type="button" class="cf-x" aria-label="Fermer">✕</button>
        <button type="button" class="cf-sort" data-dir="asc">↑ TRI CROISSANT</button>
        <button type="button" class="cf-sort" data-dir="desc">↓ TRI DÉCROISSANT</button>
        <div class="cf-search">🔍 <input type="search" class="cf-q" placeholder="RECHERCHER…"></div>
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
          if (keep.size === all.length) delete st.f[key]; else st.f[key] = keep;
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
          delete st.f[key];
          if (st.sort && st.sort.col === key) st.sort = null;
          m.querySelector(".cf-q").value = "";
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
      if (e.target.closest("#cfMenu") || e.target.closest(".cf-btn") || window.__cfRsz) return;
      cfClose();
    };
    document.addEventListener("click", window.__cfDocHandler, true);
    document.getElementById("cfMenu")?.remove();

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
      if (INS_EDIT) { sviDlpOne(INS); sviDpredTyped(INS); insLiveSync(); }
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
    const insFmt = v => (v === "" || v === null || v === undefined) ? "" : money(v);
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
      if (insPrdSplit() && INS_EDIT) insSave();
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
      if (k === "des") { const lq = r.id ? insLinkedQ(INS, r.id) : null; return lq !== null ? lq : 0; }
      return r.q === "" || r.q === undefined ? 0 : num(r.q);
    };
    const insPrice = (k, r) => k === "prd" ? insPrdPrice(INS, r.id) : r.p;
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
        ["ttc", "MCB TTC", "number", "calc", "ttc"]
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
        : f === "q" ? insQty(k, r) : f === "tva" ? insTVAk(k, r) : (f === "p" && k === "prd") ? insPrice(k, r) : f === "tache" ? prdTaskName(r.id) : r[f];
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
    /* une cellule : champ saisissable, ou verrouillé (titre, calculé) */
    const insCell = (k, r, c) => {
      const [f, , cls, type] = c;
      const isNew = !r;
      r = r || {};
      /* QPB produits = NBR × DIM 1 × DIM 2 × DIM 3 ; QPB désignation liée = somme des produits de ses tâches */
      const qAuto = (f === "q" && (k === "prd" || k === "des")) || (f === "p" && k === "prd");
      const locked = !INS_EDIT || type === "calc" || qAuto || (INS_LOCK[k] || []).includes(f) || (k === "chg" && (f === "p" || f === "u") && !!r.chs) || (r.t && f !== "art" && f !== "des")
        /* DIM que l'unité n'autorise pas : grisées (FORMAT 74, R10) */
        || (k === "prd" && /^d[123]$/.test(f) && !isNew && +f[1] > sviUnitDims(r.u));
      const er = !isNew && INS_EDIT ? insRowErr(k, r) : null;
      let val = "";
      /* ligne vide « SAISIR ICI » des désignations : TVA 20 % affichée par défaut */
      if (isNew && f === "tva" && k !== "prd") val = "20,00";
      if (!isNew) {
        if (r.t && f !== "art" && f !== "des") val = "";
        else if (f === "tache") val = insCalc(k, r, f) || "";
        else if (type === "calc" || qAuto) val = insFmt(insCalc(k, r, f));
        else if (k === "prd" && f === "tva") val = insFmt(insPrdTVA(INS, r.id));
        else if (type === "num") val = f === "tva" ? (r.tva === "" || r.tva === undefined ? "20,00" : insFmt(r.tva)) : insFmt(r[f]);
        else val = r[f] || "";
      }
      const artA = k === "des" && f === "art" && !isNew && !String(r.art ?? "").trim() ? (ART_AUTO.get(r.id) || "") : "";
      if (!INS_EDIT) return `<td class="${cls}${k === "des" && f === "des" ? " c-wrap" : ""}${artA ? " art-auto" : ""}">${esc(artA || val)}${f === "tva" && val ? " %" : ""}</td>`;
      /* FORMAT 109 : DÉSIGNATION client sur plusieurs lignes si elle est trop longue (la ligne devient plus haute) */
      /* FORMAT 122 : ligne existante — texte affiché (appui long = glisser), un toucher ouvre la saisie */
      if (k === "des" && f === "des" && !isNew) return `<td class="${cls} ins-td ins-tdv${locked ? " ins-lock" : ""}${er && er.f === f ? " ins-bad" : ""}"${er && er.f === f ? ` data-why="${esc(er.m)}"` : ""}><div class="ins-dv" data-f="des">${esc(val)}</div><textarea class="ins-in ins-ta ${cls}" data-f="${f}" rows="1" enterkeyhint="next" ${locked ? "disabled" : ""} autocomplete="off" spellcheck="false">${esc(val)}</textarea></td>`;
      if (k === "des" && f === "des") return `<td class="${cls} ins-td${locked ? " ins-lock" : ""}${er && er.f === f ? " ins-bad" : ""}"${er && er.f === f ? ` data-why="${esc(er.m)}"` : ""}><textarea class="ins-in ins-ta ${cls}" data-f="${f}" rows="1" enterkeyhint="next" ${locked ? "disabled" : ""} ${isNew ? 'placeholder="SAISIR ICI…"' : ""} autocomplete="off" spellcheck="false">${esc(val)}</textarea></td>`;
      return `<td class="${cls} ins-td${locked ? " ins-lock" : ""}${er && er.f === f ? " ins-bad" : ""}"${er && er.f === f ? ` data-why="${esc(er.m)}"` : ""}><input class="ins-in ${cls}" data-f="${f}" enterkeyhint="next"
        ${type === "num" ? 'inputmode="decimal"' : ""} ${locked ? "disabled" : ""}
        value="${esc(val)}" ${isNew && f === "des" ? 'placeholder="SAISIR ICI…"' : artA ? `placeholder="${esc(artA)}"` : ""} autocomplete="off"></td>`;
    };
    const INS_TRASH = `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    /* page unique : rond à gauche = choix pour la liaison (2e toucher = libère le choix) ;
       case à droite = suppression (cochée, elle devient 🗑 ; ANNULER la décoche) */
    /* rond d'en-tête (FORMAT) : « toutes les lignes déjà liées » du bloc sont choisies, pour les délier d'un coup */
    const lkAllLinked = (k, id) => LK.des && k !== "des" ? lkIsLinked(k, id) : lkAnyLinked(k, id);
    const lkOn = (k, id) => (k === "prd" || k === "chg") ? LK[k][id] !== undefined : (LK.all && LK.all[k] ? lkAllLinked(k, id) : LK[k] === id);
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
        if (du && pid && sid && insIsPrimLink(pid, sid)) {
          const bad = Object.keys(LK.prd || {}).find(x => { const P = INS.prd.find(y => y.id === x); return P && U_(P.u) && U_(P.u) !== du; });
          if (bad) return "RÈGLE B : LIAISON PRIMAIRE — " + lkName("prd", bad) + " N'A PAS L'UNITÉ DE LA DÉSIGNATION (" + du + ").";
        }
        return "";
      }
      if (k === "prd" && LK.des && LK.prim && LK.sec && insIsPrimLink(LK.prim, LK.sec)) {
        const D = INS.des.find(x => x.id === LK.des), P = INS.prd.find(x => x.id === id);
        const du = String((D && D.u) || "").trim().toUpperCase(), pu = String((P && P.u) || "").trim().toUpperCase();
        if (du && pu && du !== pu) return "RÈGLE B : LIAISON PRIMAIRE — UNITÉ " + pu + " ≠ UNITÉ DE LA DÉSIGNATION (" + du + ").";
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
      const on = multi ? (Object.keys(LK[k]).length > 0 && LK.allm && LK.allm[k]) : !!(LK.all && LK.all[k]);
      const busy = multi ? (Object.keys(LK[k]).length > 0 && !on) : !!LK[k];
      return `<span class="lk-rd lk-rdall${on ? " on" : ""}${busy ? " off" : ""}" data-rdall="${k}" role="button" aria-label="Choisir toutes les lignes liées"></span>`;
    };
    const lkRd = (k, r) => INS_EDIT && r && !r.t ? `<span class="lk-rd${lkOn(k, r.id) ? " on" : ""}${LK.des && lkIsLinked(k, r.id) ? " lnk" : ""}" data-rd="${k}" role="button" aria-label="Choisir pour la liaison"></span>` : "";
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
      return `<tr class="ins-row${r ? "" : " ins-new"}${r && r.t ? " ins-title lv" + Math.min(3, dOf(r) + 1) : ""}${sel ? " lk-sel" : ""}${lnk ? " lk-link" : ""}${r && !r.t && lkHit(k, r.id) ? " lk-hit" : ""}${dim && !(r && lkHit(k, r.id)) ? " lk-dim" : ""}${lkBanAttr(k, r) ? " lk-ban" : ""}"
          data-ik="${k}" ${r ? `data-iid="${r.id}"` : ""}${lkBanAttr(k, r)}${k === "des" && r ? ` style="--d:${dOf(r)}"` : ""}>
        <td class="center ins-rdc">${k === "des" && r && r.t ? foldBtn(r) : lkRd(k, r)}</td>${tcell}${cols.map(c => insCell(k, r, c)).join("")}${qc}${INS_EDIT
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
      const shown = cfApply(t, insCfCols(k), normal).filter(r => !ONLYC[k] || r.on === true);
      const st = cfT(t);
      const sorting = !!(st.sort && !st.sort.def);
      const filtering = Object.keys(st.f).length > 0 || !!ONLYC[k];
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
    const foldBtn = r => r && r.t ? `<span class="ins-fold${foldGet()[r.id] ? "" : " open"}" data-fold="${r.id}" role="button" aria-label="Replier / déplier">${foldGet()[r.id] ? "›" : "⌄"}</span>` : "";
    /* grands tableaux (détail produits / charges) : lignes dessinées par paquets, au fil du défilement (rapidité) */
    const INS_CHUNK = 120;
    const insMore = {};
    const insBodyHTML = k => {
      LKS = lkLinked(); LKG = insUsed(); LKH = lkHits();
      const rows = k === "des" ? insShown(k) : lkTop(k, insShown(k));
      const ncol = INS_COLS[k].length + 1;
      let html = "";
      if (k !== "des") {
        const first = rows.length > INS_CHUNK * 1.5 ? rows.slice(0, INS_CHUNK) : rows;
        insMore[k] = rows.slice(first.length);
        html = first.map(r => insRowHTML(k, r, 0)).join("");
      } else {
        const sub = t => {
          const { ht, ttc } = insSubOf(t);
          return `<tr class="ins-sub lv${Math.min(3, dOf(t) + 1)}" data-sub="${t.id}" style="--d:${dOf(t)}"><td></td><td></td>
            <td colspan="4" class="number">TOTAL ${esc(t.des || t.art || "")}</td>
            <td class="number ins-sht">${money(ht)}</td><td></td><td class="number ins-sttc">${money(ttc)}</td>${INS_EDIT ? "<td></td>" : ""}</tr>`;
        };
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
    const insFootHTML = k => {
      if (k === "qlt") return "";
      /* FORMAT 126 : lignes affichées, ou seulement les cases carrées cochées ; « TOTAL PARTIEL » si une partie seulement */
      const shown = insShown(k).filter(r => !r.t), on = shown.filter(r => r.on === true);
      const rows = on.length ? on : shown;
      const partial = on.length > 0 || shown.length < INS[k].filter(r => !r.t).length;
      const ht = rows.reduce((t, r) => t + insHT(k, r), 0);
      const ttc = rows.reduce((t, r) => t + insTTC(k, r), 0);
      /* pied aligné sur l'ordre des colonnes de l'écran */
      const cols = insColsOrd(k), val = { ht: money(ht), tva: money(ttc - ht), ttc: money(ttc) };
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
    /* une désignation cochée : les autres lignes se grisent (une seule à la fois) */
    const insDim = () => {
      return;   /* mode SAISIE : la case sert à choisir des lignes ; le choix unique est en mode LIAISONS */
      const body = $("bdgClientBody");
      if (!body) return;
      const on = new Set(INS.des.filter(r => r.on === true && !r.t).map(r => r.id));
      /* les titres de la ligne cochée restent normaux */
      const stack = [];
      INS.des.forEach(r => {
        if (r.t) {
          while (stack.length && insLevel(stack[stack.length - 1].art) >= insLevel(r.art)) stack.pop();
          stack.push(r);
        } else if (r.on === true) stack.forEach(t => on.add(t.id));
      });
      body.querySelectorAll("tr[data-iid]").forEach(tr => {
        const dim = on.size > 0 && !on.has(tr.dataset.iid);
        tr.classList.toggle("ins-dim", dim);
        const cb = tr.querySelector("input.ins-cb");
        if (cb && INS_EDIT) cb.disabled = dim;
      });
    };
    /* ===== LOTS en arborescence (« / ») dans le bloc TÂCHES : niveaux repliables › / ⌄, nom du dernier niveau ===== */
    const lotSegs = r => String(r && r.v || "").split("/").map(x => x.trim()).filter(Boolean);
    const lotCmp = (a, b) => { const A = lotSegs(a), B = lotSegs(b); for (let i = 0; i < Math.min(A.length, B.length); i++) { const c = natCmp(A[i], B[i]); if (c) return c; } return A.length - B.length; };
    const lotUnder = (r, P) => { const s2 = lotSegs(r); return s2.length >= P.length && P.every((g, i) => U_(g) === U_(s2[i])); };
    /* arborescence dans l'ordre des lots (classés par ordre alphabétique au départ, puis ordre libre) :
       un niveau prend la place de son premier lot */
    const lotTreeRows = list => {
      const ids = new Set(list.map(r => r.id));
      const flat = INS.lot.filter(r => ids.has(r.id));
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
      const pad = `style="margin-left:${x.lvl * 16}px"`;
      const fold = x.kids ? `<span class="ins-fold lot-fold" data-path="${esc(x.path)}">${dlyIsFolded(x.path) ? "›" : "⌄"}</span>` : `<span class="lot-fold-sp"></span>`;
      if (x.grp) {
        /* niveau sans lot à lui : nom modifiable, case = toute sa branche */
        const br = INS.lot.filter(r => !r.t && lotUnder(r, x.segs));
        const all = br.length && br.every(r => r.on === true);
        return `<div class="ins-li lot-grp" data-path="${esc(x.path)}"><span class="ins-rdc"></span><span class="lot-in" ${pad}>${fold}${INS_EDIT ? `<input class="lot-gname" data-kind="grp" data-path="${esc(x.path)}" value="${esc(x.segs[x.segs.length - 1])}" autocomplete="off">` : `<span>${esc(x.segs[x.segs.length - 1])}</span>`}</span>
          ${INS_EDIT ? `<span class="ins-delc"><input type="checkbox" class="lot-gcb" data-path="${esc(x.path)}"${all ? " checked" : ""}></span>` : ""}</div>`;
      }
      const r = x.r, k = "lot";
      const pre = x.segs.length > 1 ? x.segs.slice(0, -1).join(" / ") + " / " : "";
      const nm = x.segs.length ? x.segs[x.segs.length - 1] : (r.v || "");
      return `<div class="ins-li${INS_EDIT && LK[k] === r.id ? " lk-sel" : ""}${INS_EDIT && lkAnyLinked(k, r.id) ? " lk-link" : ""}${INS_EDIT && lkHit(k, r.id) ? " lk-hit" : ""}${INS_EDIT && LK[k] && LK[k] !== r.id && !(LK.des && lkIsLinked(k, r.id)) ? " lk-dim" : ""}${lkBanAttr(k, r) ? " lk-ban" : ""}" data-ik="${k}" data-iid="${r.id}"${lkBanAttr(k, r)}>
          ${INS_EDIT ? `<span class="ins-rdc">${lkRd(k, r)}</span><span class="lot-in" ${pad}>${fold}<input class="ins-in" data-f="v" enterkeyhint="next" data-pre="${esc(pre)}" value="${esc(nm)}" autocomplete="off"></span>
            <span class="ins-delc">${insDelCell(r)}</span>` : `<span class="lot-in" ${pad}>${fold}<span>${esc(nm)}</span></span>`}
        </div>`;
    }).join("");
    /* glissement d'un lot (FORMAT 26, 44) : dans un niveau = passe dessous ; avant / après = même niveau que la ligne visée ;
       superposé à un lot = nouveau niveau « NOUVEAU NIVEAU n » qui regroupe les deux */
    const lotDrop = (srcId, tEl, mode) => {
      const L = INS.lot, src = L.find(x => x.id === srcId);
      if (!src || !tEl) return;
      const P = lotSegs(src);
      const tSegs = tEl.classList.contains("lot-grp") ? dlyLotPath(tEl.dataset.path) : lotSegs(L.find(x => x.id === tEl.dataset.iid));
      let base, extra = null, N = "";
      if (mode === "on" && tEl.classList.contains("lot-grp")) base = tSegs;
      else if (mode === "on") {
        const used = L.flatMap(x => lotSegs(x)).map(g => (String(g).match(/^NOUVEAU NIVEAU (\d+)$/) || [])[1]).filter(Boolean).map(Number);
        N = "NOUVEAU NIVEAU " + ((used.length ? Math.max(...used) : 0) + 1);
        base = tSegs.slice(0, -1).concat(N);
        extra = { P: tSegs, base };
      } else base = tSegs.slice(0, -1);
      if (base.length >= P.length && P.every((g, i) => U_(g) === U_(base[i]))) return;   /* pas dans sa propre branche */
      const plan = new Map();
      const add = (P0, b0) => L.filter(x => !x.t && lotUnder(x, P0)).forEach(x => { plan.set(x.id, b0.concat(lotSegs(x).slice(P0.length - 1)).join(" / ")); });
      add(P, base);
      if (extra) add(extra.P, extra.base);
      const same = [...plan].every(([id, v]) => U_((L.find(x => x.id === id) || {}).v) === U_(v));
      if (!same) {
        const ids = new Set(plan.keys()), vals = [...plan.values()].map(U_);
        const clash = [...plan.values()].find(v => L.some(y => !ids.has(y.id) && U_(y.v) === U_(v))) || vals.find((v, i) => vals.indexOf(v) !== i);
        if (clash) { svToast("LOT « " + clash + " » EXISTE DÉJÀ : DÉPLACEMENT REFUSÉ.", 4000, tEl); return; }
        plan.forEach((v, id) => { L.find(x => x.id === id).v = v; });
      }
      /* ordre : le bloc déplacé se place à l'endroit du dépôt */
      {
        const mv = L.filter(x => plan.has(x.id) && !(extra && lotUnder(x, extra.P) && !lotUnder(x, P)));
        const rest = L.filter(x => !mv.includes(x));
        const nodeOf = tEl.classList.contains("lot-grp") ? lotSegs({ v: tEl.dataset.path }) : null;
        const tId = tEl.dataset.iid;
        const under = r => nodeOf ? lotUnder(r, nodeOf) : r.id === tId || lotUnder(r, lotSegs(L.find(x => x.id === tId)));
        let idx;
        if (mode === "before") idx = rest.findIndex(under);
        else { let last = -1; rest.forEach((r, i) => { if (under(r)) last = i; }); idx = last + 1; }
        if (idx < 0) idx = rest.length;
        rest.splice(idx, 0, ...mv);
        L.splice(0, L.length, ...rest);
      }
      dlyPlanFromTasks("lot");
      insSave();
      histLog("TÂCHES", N ? "NOUVEAU NIVEAU DE LOT" : same ? "ORDRE DES LOTS" : "LOT DÉPLACÉ", (src.v || "") + (N ? " — " + N : ""));
      refreshAll();
      /* nouveau niveau : son nom est prêt à être saisi */
      if (N) setTimeout(() => { const i = [...shell.querySelectorAll("input.lot-gname")].find(x => x.dataset.path === base.join(" / ")); if (i) { i.focus(); try { i.select(); } catch (e) {} } }, 60);
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
        if (n && shell.__insDly) shell.__insDly.rename(n);
      });
    }
    const insRenderHier = only => {
      LKS = lkLinked(); LKG = insUsed(); LKH = lkHits();
      const col = (title, k) => {
        if (ONLYC[k] && !INS[k].some(r => r.on === true)) ONLYC[k] = false;
        const list = lkTop(k, cfApply(k, [["v", title, r => r.v || "", ""]], INS[k]).filter(r => !ONLYC[k] || r.on === true));
        lastShown.hier[k] = list.map(r => r.v || "");
        const on = !!cfT(k).f.v;
        return `
        <div class="bdg-h-col ins-hcol" data-ik="${k}">
          <div class="bdg-h-head ${on ? "cf-on" : ""}">${INS_EDIT ? `<span class="ins-rdc">${lkRdAll(k)}</span>` : ""}<span class="cf-wrap"><span class="cf-lab">${title}${svCnt(list.length, INS[k].length)}</span>${onlyBtn(k, true)}<span class="cf-btn"
            data-cf="${k}" data-col="v" role="button" aria-label="Trier / filtrer">${cfIcon}</span></span>${INS_EDIT
            ? `<span class="ins-hdel"><input type="checkbox" class="ins-cball" title="Tout cocher"${list.length && list.every(r => r.on === true) ? " checked" : ""}></span>` : ""}</div>
          ${k === "lot" ? lotTreeHTML(list) : list.map(r => `<div class="ins-li${INS_EDIT && LK[k] === r.id ? " lk-sel" : ""}${INS_EDIT && lkAnyLinked(k, r.id) ? " lk-link" : ""}${INS_EDIT && lkHit(k, r.id) ? " lk-hit" : ""}${INS_EDIT && LK[k] && LK[k] !== r.id && !(LK.des && lkIsLinked(k, r.id)) ? " lk-dim" : ""}${lkBanAttr(k, r) ? " lk-ban" : ""}" data-ik="${k}" data-iid="${r.id}"${lkBanAttr(k, r)}>
              ${INS_EDIT ? `<span class="ins-rdc">${lkRd(k, r)}</span><input class="ins-in" data-f="v" enterkeyhint="next" value="${esc(r.v || "")}" autocomplete="off">
                <span class="ins-delc">${insDelCell(r)}</span>` : `<span>${esc(r.v || "")}</span>`}
            </div>`).join("")}
          ${INS_EDIT ? `<div class="ins-li ins-new" data-ik="${k}"><span class="ins-rdc"></span>
              <input class="ins-in" data-f="v" enterkeyhint="next" placeholder="SAISIR ICI…" autocomplete="off"><span class="ins-delc"></span></div>`
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
    /* LIAISONS VALIDÉES (onglet du détail) : chaîne, produits, charges, quantité, PPB, MPB HT ; DÉLIER */
    const insLinksHTML = () => {
      const D = id => INS.des.find(x => x.id === id) || {};
      /* quantité = somme des QPB de ses produits ; prix = PPB de la désignation si la liaison est primaire */
      const qOf = l => (l.prd || []).reduce((t, x) => { const p = INS.prd.find(r => r.id === x.id); return t + (p ? insPrdQ(p) : 0); }, 0);
      const pOf = l => insLinkPrim(INS, l) ? num(D(l.des).p || 0) : "";
      const LC = [["art", "ART", l => D(l.des).art || "", "center"], ["des", "DÉSIGNATION", l => D(l.des).des || "", ""],
        ["lot", "LOT", l => lkName("lot", l.lot), ""], ["prim", "ACTIVITÉ PRIMAIRE", l => lkName("prim", l.prim), ""],
        ["sec", "ACTIVITÉ SECONDAIRE", l => lkName("sec", l.sec), ""], ["np", "PRODUITS", l => (l.prd || []).length, "center"],
        ["nc", "CHARGES", l => (l.chg || []).length, "center"], ["lq", "QUANTITÉ", l => insFmt(qOf(l)), "number"],
        ["lp", "PPB", l => pOf(l) === "" ? "" : insFmt(pOf(l)), "number"], ["lm", "MPB HT", l => pOf(l) === "" ? "" : insFmt(qOf(l) * pOf(l)), "number"]];
      const W = { art: 70, des: 227, lot: 133, prim: 170, sec: 190, np: 104, nc: 102, lq: 104, lp: 71, lm: 97 };   /* FORMAT 113 */
      const oc = coOrder("lk_links", LC);
      const w = k => cwLoad()["lk_links." + k] || W[k] || 120;
      const D2 = id => INS.des.find(x => x.id === id) || {};
      const rows = cfApply("lk_links", LC, (INS.links || []).slice().sort((a, b) => desCmp(D2(a.des), D2(b.des)) || natCmp(lkName("lot", a.lot), lkName("lot", b.lot))));
      lastShown.detail = { cols: LC, rows, kind: "lnk" };
      /* case à droite (cocher seulement) : ✕ DÉLIER LES LIGNES COCHÉES par le menu ⋯ */
      const dw = INS_EDIT ? 40 : 0;
      const allOn = rows.length && rows.every(l => l.on === true);
      return `<table class="bdg-d-table lk-table lnk-table" style="width:${oc.reduce((t, c) => t + w(c[0]), 0) + dw}px">
        <colgroup>${oc.map(c => `<col data-w="lk_links.${c[0]}" style="width:${w(c[0])}px">`).join("")}${dw ? `<col style="width:${dw}px">` : ""}</colgroup>
        <thead><tr>${oc.map(c => cfHead("lk_links", c[0], c[1], c[3])).join("")}${dw ? `<th class="center"><input type="checkbox" class="lnk-cball"${allOn ? " checked" : ""}></th>` : ""}</tr></thead>
        <tbody>${rows.map(l => `<tr data-lid="${l.id}">${oc.map(c => `<td class="${c[3]}">${esc(c[2](l))}</td>`).join("")}${dw
          ? `<td class="center"><input type="checkbox" class="lnk-cb"${l.on === true ? " checked" : ""}></td>` : ""}</tr>`).join("")
          || `<tr><td colspan="${oc.length + (dw ? 1 : 0)}" class="empty">AUCUNE LIGNE</td></tr>`}</tbody></table>`;
    };
    /* IMPORT NON CRÉÉ (onglet du détail) : lignes du fichier qui n'ont pas pu être liées ;
       corrigées ici (case fautive encadrée), elles créent leur liaison et sortent de l'onglet */
    const INC_COLS = [["art", "ART", 60, "center"], ["dc", "DÉSIGNATION CLIENT", 240, ""], ["upb", "UPB", 60, "center"], ["lot", "LOT", 150, ""],
      ["prim", "ACTIVITÉ PRIMAIRE", 170, ""], ["sec", "ACTIVITÉ SECONDAIRE", 170, ""], ["type", "TYPE", 70, "center"], ["article", "ARTICLE", 80, "center"],
      ["des", "DÉSIGNATION PRODUIT / CHARGE", 220, ""], ["u", "UNITÉ", 60, "center"], ["nbr", "NBR", 60, "number"], ["d1", "DIM 1", 60, "number"], ["d2", "DIM 2", 60, "number"],
      ["d3", "DIM 3", 60, "number"], ["q", "QTE", 70, "number"], ["deb", "DÉBUT", 100, "center"], ["fin", "FIN", 100, "center"], ["pred", "PRÉDÉCESSEURS", 220, ""]];
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
    /* ===== AUCUN DOUBLON (FORMAT) : lots / activités / qualité = même intitulé ;
       désignations et charges = ART + DÉSIGNATION + UNITÉ ; produits = DÉSIGNATION + UNITÉ.
       Une saisie qui crée un doublon ouvre la fenêtre DOUBLON : RÉTABLIR ou FUSIONNER (liaisons reportées) ===== */
    const DUP_LAB = { des: "DÉSIGNATIONS CLIENT", lot: "LOTS", prim: "ACTIVITÉS PRIMAIRES", sec: "ACTIVITÉS SECONDAIRES", chg: "DÉTAIL CHARGES", prd: "DÉTAIL PRODUITS", qlt: "DÉTAIL QUALITÉ" };
    const dupKeyOf = (k, r) => {
      if (!r || r.t) return "";
      if (k === "lot" || k === "prim" || k === "sec" || k === "qlt") return U_(r.v);
      if (!U_(r.des)) return "";
      /* FORMAT 117 : un même produit dans des tâches différentes n'est pas un doublon */
      return k === "prd" ? impId(k, r) + "#" + prdChainKey(r.id) : impId(k, r);
    };
    const dupName = (k, r) => (k === "lot" || k === "prim" || k === "sec" || k === "qlt") ? U_(r.v) : [r.art, r.des].filter(Boolean).join(" — ") + (r.u ? " (" + U_(r.u) + ")" : "");
    const dupLinks = (k, id) => (INS.links || []).filter(l => k === "prd" || k === "chg" ? (l[k] || []).some(x => x.id === id) : l[k] === id).length;
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
          <ul class="svc-list"><li>${esc(dupName(k, keepR))} — ${dupLinks(k, keepR.id)} LIAISON(S)</li><li>${esc(dupName(k, dropR))} — ${dupLinks(k, dropR.id)} LIAISON(S)${opts.typed ? " (SAISIE)" : ""}</li></ul>
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
    shell.__dupX = INS && INS_EDIT ? { INS, ask: (k, a, b, o) => dupAsk(k, a, b, o), save: () => insSave(), refresh: () => refreshAll() } : null;
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
      if (!items.length) return;
      shell.__dupBusy = true;
      let cur = 0, showList = false, changed = false;
      const alive = it => INS[it.k].includes(it.keep) && INS[it.k].includes(it.drop);
      const ignore = it => { skip[it.sk] = 1; try { sessionStorage.setItem("svi_dupskip", JSON.stringify(skip)); } catch (e) {} };
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
          <div class="svc-x"><div class="svc-sub">${esc(DUP_LAB[it.k])} : CE LIBELLÉ EXISTE DÉJÀ</div>
            <ul class="svc-list"><li>${esc(dupName(it.k, it.keep))} — ${dupLinks(it.k, it.keep.id)} LIAISON(S)</li><li>${esc(dupName(it.k, it.drop))} — ${dupLinks(it.k, it.drop.id)} LIAISON(S)</li></ul>
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
          d.style.display = "none";
          const n = items.length;
          const ok = await svConfirm({ title: "FUSIONNER TOUS", text: n + " DOUBLON(S) SERONT FUSIONNÉS (LIAISONS ET DÉLAIS REPORTÉS).", ok: "FUSIONNER TOUS" });
          if (!ok) { document.body.appendChild(d); d.style.display = ""; draw(); return; }
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
        const cb = e.target.closest && e.target.closest("input.lnk-cb, input.lnk-cball");
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
        btn = `<button type="button" class="lk-go" ${ok ? "" : "disabled"}>${pl.same || (!pl.full && lkDlyDirty()) ? "✓ VALIDER LES MODIFICATIONS" : "✓ VALIDER LA LIAISON"}</button>`;
      } else if (pl.mode === "mix") btn = `<button type="button" class="lk-go lk-mix">✓ VALIDER LA LIAISON</button>`;
      else btn = `<button type="button" class="lk-go" disabled>✓ VALIDER LA LIAISON</button>`;
      el.innerHTML = `${LK.des ? '<button type="button" class="lk-info" title="Voir la liaison" aria-label="Voir la liaison">i</button>' : ""}${btn}`;
    };
    const insRenderTab = () => {
      { const tl = document.querySelector("#bdgTabs > .blk-tools");
        if (tl) { tl.querySelector(".only-c")?.remove(); if (INS_EDIT && (active === "chg" || active === "prd")) tl.insertAdjacentHTML("afterbegin", onlyBtn(active)); } }
      ["chg", "prd", "qlt"].forEach(k => {
        const b = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="${k}"]`);
        if (b) b.innerHTML = (SVI_ICON[k] || "") + tabs.find(x => x.key === k).title + (k === "prd" ? ' <b class="req-star">*</b>' : "") + " " + svCnt(insShown(k).length, INS[k].filter(r => !r.t).length);
      });
      { const b = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="dly"]`);
        if (b) b.innerHTML = (SVI_ICON.dly || "") + "DÉTAIL DÉLAIS " + svCnt(INS_EDIT ? (insDlyKey() ? insDlyList(insDlyKey()).length : insDlyRecap() ? insDlyRecap().filter(x => x.deb || x.fin).length : dlyKeys().length) : insTasks().length); }
      /* IMPORT NON CRÉÉ : visible seulement s'il reste des lignes */
      { const b = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="inc"]`), n = (INS.inc || []).length;
        if (b) { b.innerHTML = (SVI_ICON.hier || "") + "IMPORT NON CRÉÉ " + svCnt(n); b.hidden = !n; b.style.display = n ? "" : "none"; }
        if (!n && active === "inc") { active = "prd"; try { localStorage.setItem("svi_dtab_v1", "prd"); } catch (e) {} document.querySelectorAll("#bdgTabs .bdg-d-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === active)); } }
      { const b = document.querySelector(`#bdgTabs .bdg-d-tab[data-tab="lnk"]`);
        if (b) b.innerHTML = (SVI_ICON.hier || "") + "LIAISONS VALIDÉES " + svCnt((INS.links || []).length); }
      sviMarkEmptyTabs(shell);
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
        body.innerHTML = `<div class="bdg-d-scroll">${insDlyHTML(INS_EDIT, shell.__insDly && shell.__insDly.err)}</div>`;
        return;
      }
      if (active === "lnk") { body.innerHTML = `<div class="bdg-d-scroll">${insLinksHTML()}</div>`; return; }
      if (active === "unl") { body.innerHTML = `<div class="bdg-d-scroll">${insUnlHTML()}</div>`; insMarkUnlinked(); return; }
      if (active === "inc") { body.innerHTML = `<div class="bdg-d-scroll">${insIncHTML()}</div>`; return; }
      body.innerHTML = `<div class="bdg-d-scroll">${insTableHTML(active)}</div>`;
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
    shell.__ins = INS_EDIT ? { INS, rowErr: (k, r) => insRowErr(k, r), cleanLinks: () => insCleanLinks(), insDim, insShown, insId, insSave, insNum, insLive, insRedraw, insClean, insRowHTML, insLevel, insBranch, insSyncTitles,
      /* ligne utilisée par une liaison (validée, ou déliée mais pas encore validée) : suppression interdite */
      isUsed: (k, id) => {
        if (!["des", "lot", "prim", "sec", "prd", "chg"].includes(k)) return false;
        let bak = null;
        try { bak = LK.linksBak; } catch (e) {}
        return [INS.links || [], bak || []].some(L => L.some(l => k === "prd" || k === "chg" ? (l[k] || []).some(x => x.id === id) : l[k] === id));
      } } : null;
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
        if (!r) {
          /* première frappe dans la ligne vide : la ligne est créée */
          r = { id: X.insId(), on: false };   /* nouvelle ligne : décochée par défaut */
          if (k === "des") {
            r.t = false; r.tva = 20;   /* TVA 20 % par défaut */
            /* niveau : celui de la dernière ligne (ou dans le dernier titre) */
            const last = X.INS.des[X.INS.des.length - 1];
            r.d = !last ? 0 : last.t ? (Number(last.d) || 0) + 1 : (Number(last.d) || 0);
          }
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
            d.innerHTML = `<span class="ins-cbc"></span><input class="ins-in" data-f="v" enterkeyhint="next" placeholder="SAISIR ICI…" autocomplete="off">`;
            holder.after(d);
            const lab = holder.closest(".ins-hcol")?.querySelector(".svi-cnt");
            if (lab) lab.textContent = X.INS[k].length;
          }
        }
        const isNum = inp.getAttribute("inputmode") === "decimal";
        /* LOTS en arborescence : la case montre le dernier niveau, le chemin du dessus est gardé (data-pre) */
        r[f] = isNum ? inp.value.trim() : (inp.dataset.pre || "") + inp.value.toUpperCase();
        if (isNum) r[f] = r[f] === "" ? "" : X.insNum(r[f]);
        if (c) X.insLive(k, holder, r);
        X.insSave();
      });
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
            if (!go) { if (r.t) X.insBranch(r).forEach(x => { x.on = false; }); r.on = false; X.insSave(); X.insRedraw(k); return; }
            const gone = new Set([r.id, ...br.map(x => x.id)]);
            X.INS[k] = X.INS[k].filter(x => !gone.has(x.id));
            X.cleanLinks(); X.insSave(); X.insRedraw(k);
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
          const vis = k === "lot" || k === "prim" || k === "sec"
            ? [...box.querySelectorAll(".ins-li[data-iid]")].map(li => X.INS[k].find(x => x.id === li.dataset.iid)).filter(Boolean)
            : X.insShown(k).filter(x => !x.t);
          if (ca) {
            /* FORMAT 125 : tout cocher coche aussi les titres (désignations) */
            (k === "des" ? X.insShown(k) : vis).forEach(r => { r.on = ca.checked; });
            X.insSave(); X.insRedraw(k);
            return;
          }
          const del = vis.filter(r => r.on === true);
          if (!del.length) return;
          const used = del.filter(r => X.isUsed(k, r.id));
          if (used.length) { svToast("SUPPRESSION REFUSÉE : " + used.length + " LIGNE(S) COCHÉE(S) SONT LIÉES. DÉLIEZ-LES D'ABORD."); return; }
          svConfirm({ title: "SUPPRIMER LES LIGNES COCHÉES", text: del.length + " LIGNE(S) SERONT SUPPRIMÉES.", ok: "SUPPRIMER" }).then(go => {
            /* ANNULER : toutes les lignes sont décochées */
            if (!go) { vis.forEach(r => { r.on = false; }); X.insSave(); X.insRedraw(k); return; }
            const ids = new Set(del.map(r => r.id));
            X.INS[k] = X.INS[k].filter(x => !ids.has(x.id));
            X.cleanLinks(); X.insSave(); X.insRedraw(k);
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
          X.insSave(); X.insRedraw(k);
          return;
        }
        if (cb) {
          r.on = cb.checked; X.insSave(); if (k === "des") { X.insDim(); X.insSyncTitles(); }
          /* ligne cochée : elle remonte (après les lignes au rond coché) */
          X.insRedraw(k);
          return;
          /* case d'en-tête à jour */
          const box = cb.closest("table.ins-table, .ins-hcol");
          const all = box?.querySelector("input.ins-cball");
          if (all) all.checked = [...box.querySelectorAll("[data-iid] input.ins-cb")].every(c => c.checked);
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

    @endverbatim