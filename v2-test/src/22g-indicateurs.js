    /* =========================================================
       v679 : LISTE DES INDICATEURS (décisions du 29/10/2026)
       - Une seule liste, commune à tous les budgets, PARTAGÉE dans la base V3 (02e : sviSharedGet / sviSharedSet « IND ») ;
         vide au départ. Elle alimente les tableaux de VERSIONS ET SCÉNARIOS (ligne « + »), pas le tableau de bord.
       - Un indicateur = { id, nom, f: [jetons], mode: q | m, fmt: n | p, dec: 0..2, u: unité affichée }.
         Jetons : { t: "e", k } élément ; { t: "n", v } nombre ; { t: "o", v: + − × ÷ } ; { t: "(" } ; { t: ")" }.
         Formule libre avec parenthèses, ex. ((A1 + A2 − A3) ÷ (B1 − B2)) + C1 − (D1 + D2 − D3 + D4).
       - Éléments : mesures du programme (date de fin, durée, marge sur la date butoir, effectif, main-d'œuvre, charges,
         produits, marge, lots, surfaces) et charges / produits du budget repérés par désignation + unité (QUANTITÉ ou MONTANT).
       - Tableau au format des consignes : tri / filtre à la loupe, colonnes ajustables et déplaçables, cases à cocher
         (tout cocher à trois états, COCHÉES SEULEMENT), menu ⋯ (SUPPRIMER, COPIER, EXPORTER, APERÇU PDF) ; dernière ligne « + ».
       ========================================================= */
    const IND_BASE = [["fin", "DATE DE FIN", "date", ""], ["dur", "DURÉE", "n", "J"], ["but", "MARGE SUR LA DATE BUTOIR", "n", "J"],
      ["eff", "EFFECTIF MAXIMUM", "n", "J-H/J"], ["effT", "EFFECTIF MAXIMUM PAR TYPE D'OUVRIER", "txt", ""], ["mo", "COÛT DE LA MAIN-D'ŒUVRE", "n", "DH"],
      ["chg", "CHARGES TOTALES", "n", "DH"], ["prd", "PRODUITS TOTAUX", "n", "DH"], ["mg", "MARGE", "n", "DH"], ["mgp", "MARGE (%)", "n", "%"],
      ["lots", "NOMBRE DE LOTS", "n", "U"], ["sc", "SURFACE COUVERTE", "n", "M2"], ["sl", "SURFACE DES LOTS", "n", "M2"]];
    const indLoad = () => { const L = (typeof sviSharedGet === "function" ? sviSharedGet("IND") : {}).L; return Array.isArray(L) ? L : []; };
    const indSaveL = L => { if (typeof sviSharedSet === "function") sviSharedSet("IND", { L }); };
    /* éléments d'un état du budget */
    const indEls = d => {
      const v = verInd(d), R = d.rat || {};
      const sc = ratNum(R.surf), sl = Object.values(R.lsurf || {}).reduce((t, x) => t + ratNum(x), 0);
      const out = IND_BASE.map(([k, l, kind, u]) => ({ k: "b:" + k, lab: l, kind, u, q: k === "sc" ? (sc || null) : k === "sl" ? (sl || null) : v[k], m: null }));
      return out.concat(ratItems(d).filter(x => x.k[1] === "|").map(x => ({ ...x, kind: "n" })));
    };
    /* v692 : brique « autre indicateur » (jeton { t: "e", k: "i:<id>" }) — indicateurs du budget ouvert */
    const indBdgL = () => { try { return ((INS && INS.rat) || {}).L || []; } catch (e) { return []; } };
    const indElLab = (k, E) => { if (String(k).startsWith("i:")) { const I = indBdgL().find(x => x.id === k.slice(2)); return I ? "[" + I.nom + "]" : "[INDICATEUR SUPPRIMÉ]"; } const x = (E || []).find(y => y.k === k); if (x) return x.lab + (x.u && x.kind === "n" && !k.startsWith("b:") ? " (" + x.u + ")" : ""); const b = IND_BASE.find(y => "b:" + y[0] === k); return b ? b[1] : (k[0] === "c" ? "CHG " : "PRD ") + String(k).split("|").slice(1).join(" "); };
    /* formule → texte lisible */
    const indText = (f, E) => (f || []).map(t => t.t === "e" ? indElLab(t.k, E) : t.t === "n" ? String(t.v).replace(".", ",") : t.t === "o" ? t.v : t.t).join(" ").replace(/\( /g, "(").replace(/ \)/g, ")");
    /* analyse : arbre de calcul, ou erreur lisible */
    const indParse = toks => {
      let i = 0;
      const bad = m => { const e = new Error(m); e.ind = true; throw e; };
      const fac = () => {
        const t = toks[i];
        if (!t) bad("IL MANQUE UN ÉLÉMENT EN FIN DE FORMULE");
        if (t.t === "(") { i++; if (toks[i] && toks[i].t === ")") bad("PARENTHÈSES VIDES"); const v = exp(); if (!toks[i] || toks[i].t !== ")") bad("PARENTHÈSE NON FERMÉE"); i++; return v; }
        if (t.t === "e" || t.t === "n") { i++; return { leaf: t }; }
        if (t.t === "o" && t.v === "−") { i++; return { neg: fac() }; }
        bad(t.t === ")" ? "PARENTHÈSE FERMÉE EN TROP" : "OPÉRATEUR « " + t.v + " » MAL PLACÉ");
      };
      const term = () => { let a = fac(); while (toks[i] && toks[i].t === "o" && (toks[i].v === "×" || toks[i].v === "÷")) { const o = toks[i++].v; a = { o, a, b: fac() }; } return a; };
      const exp = () => { let a = term(); while (toks[i] && toks[i].t === "o" && (toks[i].v === "+" || toks[i].v === "−")) { const o = toks[i++].v; a = { o, a, b: term() }; } return a; };
      if (!toks || !toks.length) bad("FORMULE VIDE");
      const r = exp();
      if (i < toks.length) bad(toks[i].t === ")" ? "PARENTHÈSE FERMÉE EN TROP" : "IL MANQUE UN OPÉRATEUR ENTRE DEUX ÉLÉMENTS");
      return r;
    };
    /* valeur d'un indicateur sur un état du budget : { val?, txt, err? } */
    const indNum = (v, dec) => Number(v).toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    let IND_DEPTH = 0;
    const indCalc = (I, d, E) => {
      E = E || indEls(d);
      let tree; try { tree = indParse(I.f); } catch (e) { return { txt: e.ind ? e.message : "FORMULE ILLISIBLE", err: true }; }
      const dec = I.dec === undefined ? 2 : Number(I.dec);
      /* un seul élément date ou texte : affiché tel quel */
      if (tree.leaf && tree.leaf.t === "e") {
        const x = E.find(y => y.k === tree.leaf.k);
        if (x && (x.kind === "date" || x.kind === "txt")) return { txt: x.q === null || x.q === undefined || x.q === "" ? "—" : x.kind === "date" ? dFr(x.q) : String(x.q) };
      }
      let miss = false, dz = false, kindErr = false, missLab = "";
      const ev = n => {
        if (n.leaf) {
          if (n.leaf.t === "n") return Number(n.leaf.v);
          /* v692 : autre indicateur du budget (profondeur limitée : pas de boucle) */
          if (String(n.leaf.k).startsWith("i:")) {
            const I2 = indBdgL().find(x => x.id === n.leaf.k.slice(2));
            if (!I2 || IND_DEPTH > 6) { miss = true; missLab = missLab || indElLab(n.leaf.k, E); return 0; }
            IND_DEPTH++; let r; try { r = indCalc(I2, d, E); } finally { IND_DEPTH--; }
            if (r.val === undefined || r.val === null) { miss = true; missLab = missLab || I2.nom; return 0; }
            return r.val;
          }
          const x = E.find(y => y.k === n.leaf.k);
          if (!x || x.q === null || x.q === undefined) { miss = true; missLab = missLab || indElLab(n.leaf.k, E); return 0; }
          if (x.kind === "date" || x.kind === "txt") { kindErr = true; return 0; }
          return I.mode === "m" && x.m !== null && x.m !== undefined ? x.m : x.q;
        }
        if (n.neg) return -ev(n.neg);
        const a = ev(n.a), b = ev(n.b);
        if (n.o === "+") return a + b;
        if (n.o === "−") return a - b;
        if (n.o === "×") return a * b;
        if (!b) { dz = true; return 0; }
        return a / b;
      };
      const val = ev(tree);
      if (kindErr) return { txt: "DATE OU TEXTE DANS UN CALCUL", err: true };
      /* v692 : formule toujours acceptée — case vide avec message gris, recalcul dès que la donnée arrive */
      if (miss) return { txt: "DONNÉE MANQUANTE : " + missLab, soft: true };
      if (dz) return { txt: "DIVISION PAR ZÉRO", soft: true };
      const one = tree.leaf && tree.leaf.t === "e" ? E.find(y => y.k === tree.leaf.k) : null;
      const u = I.fmt === "p" ? "%" : (I.u || (one ? (I.mode === "m" && one.m !== null && one.m !== undefined ? "DH" : one.u) : ""));
      return { val, txt: indNum(I.fmt === "p" ? val * 100 : val, dec) + (u ? " " + u : "") };
    };

    /* ---------- fenêtre de conception (calcul) — done(indicateur enregistré | null) ---------- */
    /* st : où l'indicateur est rangé — liste commune (par défaut) ou tableau de bord du budget { list, save, br } */
    const IND_STORE = { list: () => indLoad(), save: L => indSaveL(L), br: "INDICATEURS" };
    const indDesignWin = (I0, done, st = IND_STORE) => {
      const I = JSON.parse(JSON.stringify(I0 || { id: insId(), nom: "", f: [], mode: "q", fmt: "n", dec: 2, u: "" }));
      const isNew = !I0;
      const E = indEls(INS);
      let cur = I.f.length;   /* position d'insertion (après le jeton cur − 1) */
      const d = sviWinNew();
      const grp = (lab, L) => L.length ? `<optgroup label="${esc(lab)}">${L.map(x => `<option value="${esc(x.k)}">${esc(indElLab(x.k, E))}</option>`).join("")}</optgroup>` : "";
      const draw = () => {
        const c = I.f.length ? indCalc(I, INS, E) : null;
        d.innerHTML = sviWinCard({ cls: "cmp-card ind-card", close: "data-x", title: isNew ? "NOUVEL INDICATEUR" : "INDICATEUR — " + esc(I.nom),
          body: `<label class="ind-lab">NOM DE L'INDICATEUR</label><input class="pv-in ind-nom" value="${esc(I.nom)}" placeholder="EX. ACIER / BÉTON">
            <div class="fz-blk">FORMULE</div>
            <div class="indf-line" data-line>${I.f.map((t, j) => `<span class="indf-tk indf-${t.t === "e" ? "e" : t.t === "n" ? "n" : "o"}${j === cur - 1 ? " on" : ""}" data-tk="${j}">${esc(t.t === "e" ? indElLab(t.k, E) : t.t === "n" ? String(t.v).replace(".", ",") : t.t === "o" ? t.v : t.t)}</span>`).join("")}<span class="indf-cur${cur === 0 ? " on" : ""}" data-tk="-1">${I.f.length ? "" : "TOUCHER LES BOUTONS POUR COMPOSER LA FORMULE"}</span></div>
            <div class="indf-keys">
              ${["(", ")", "+", "−", "×", "÷"].map(k => `<button type="button" class="svc-b indf-k" data-k="${k}">${k}</button>`).join("")}
              <select class="rat-add indf-el"><option value="">+ ÉLÉMENT…</option>${grp("MESURES DU PROGRAMME", E.filter(x => x.k.startsWith("b:")))}${st !== IND_STORE ? grp("AUTRES INDICATEURS DU BUDGET", st.list().filter(x => x.id !== I.id).map(x => ({ k: "i:" + x.id }))) : ""}${grp("CHARGES", E.filter(x => x.k.startsWith("c|")))}${grp("PRODUITS", E.filter(x => x.k.startsWith("p|")))}</select>
              <input class="pv-in indf-nb" inputmode="decimal" placeholder="NOMBRE" style="width:90px"><button type="button" class="svc-b" data-nb>+ NOMBRE</button>
              <button type="button" class="svc-b" data-bk>⌫ EFFACER</button><button type="button" class="svc-b" data-clr>TOUT EFFACER</button>
            </div>
            <div class="indf-st ${!c ? "" : c.err ? "rat-err" : "indf-ok"}">${!c ? "FORMULE VIDE" : c.err ? esc(c.txt) : "FORMULE CORRECTE — VALEUR SUR CE BUDGET : <b>" + esc(c.txt) + "</b>"}</div>
            <div class="indf-opts">
              <label class="pv-r"><span>CHARGES ET PRODUITS EN</span><select class="pv-in ind-md"><option value="q"${I.mode !== "m" ? " selected" : ""}>QUANTITÉ</option><option value="m"${I.mode === "m" ? " selected" : ""}>MONTANT</option></select></label>
              <label class="pv-r"><span>FORMAT</span><select class="pv-in ind-fmt"><option value="n"${I.fmt !== "p" ? " selected" : ""}>NOMBRE</option><option value="p"${I.fmt === "p" ? " selected" : ""}>POURCENTAGE</option></select></label>
              <label class="pv-r"><span>DÉCIMALES</span><select class="pv-in ind-dec">${[0, 1, 2].map(n => `<option${Number(I.dec === undefined ? 2 : I.dec) === n ? " selected" : ""}>${n}</option>`).join("")}</select></label>
              <label class="pv-r"><span>UNITÉ AFFICHÉE</span><input class="pv-in ind-u" value="${esc(I.u || "")}" placeholder="FACULTATIVE"${I.fmt === "p" ? " disabled" : ""}></label>
            </div>
            <div class="doc-err ind-msg"></div>`,
          foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button>` });
      };
      const put = t => { I.f.splice(cur, 0, t); cur++; draw(); };
      draw(); sviWinShow(d);
      d.addEventListener("input", e => { if (e.target.classList.contains("ind-nom")) I.nom = e.target.value; if (e.target.classList.contains("ind-u")) I.u = e.target.value.trim().toUpperCase(); });
      d.addEventListener("change", e => {
        const t = e.target;
        if (t.classList.contains("indf-el") && t.value) { put({ t: "e", k: t.value }); return; }
        if (t.classList.contains("ind-md")) { I.mode = t.value; draw(); return; }
        if (t.classList.contains("ind-fmt")) { I.fmt = t.value; draw(); return; }
        if (t.classList.contains("ind-dec")) { I.dec = Number(t.value); draw(); return; }
      });
      d.addEventListener("click", e => {
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (done) done(null); return; }
        const k = e.target.closest("[data-k]"); if (k) { const v = k.dataset.k; put(v === "(" || v === ")" ? { t: v } : { t: "o", v }); return; }
        const tk = e.target.closest("[data-tk]"); if (tk) { cur = Number(tk.dataset.tk) + 1; draw(); return; }
        if (e.target.closest("[data-nb]")) { const s = String(d.querySelector(".indf-nb").value || "").replace(/\s/g, "").replace(",", "."); if (s === "" || !Number.isFinite(Number(s))) { d.querySelector(".ind-msg").textContent = "NOMBRE À SAISIR D'ABORD (EX. 100 OU 1,5)."; return; } put({ t: "n", v: Number(s) }); return; }
        if (e.target.closest("[data-bk]")) { if (cur > 0) { I.f.splice(cur - 1, 1); cur--; draw(); } return; }
        if (e.target.closest("[data-clr]")) { I.f = []; cur = 0; draw(); return; }
        if (e.target.closest("[data-save]")) {
          const msg = d.querySelector(".ind-msg");
          I.nom = U_(d.querySelector(".ind-nom").value || "");
          if (!I.nom) { msg.textContent = "DONNER UN NOM À L'INDICATEUR."; d.querySelector(".ind-nom").focus(); return; }
          try { indParse(I.f); } catch (er) { msg.textContent = "FORMULE À CORRIGER : " + (er.ind ? er.message : "ILLISIBLE"); return; }
          const L = st.list();
          if (L.some(x => x.id !== I.id && U_(x.nom) === I.nom)) { msg.textContent = "UN INDICATEUR PORTE DÉJÀ CE NOM."; return; }
          const i = L.findIndex(x => x.id === I.id); if (i >= 0) L[i] = { ...L[i], ...I }; else L.push(I);
          st.save(L); histLog(st.br, isNew ? "NOUVEL INDICATEUR" : "INDICATEUR MODIFIÉ", I.nom + " = " + indText(I.f, E));
          d.remove(); if (done) done(I);
        }
      });
    };

    /* ---------- tableau d'indicateurs au format des consignes (liste commune « ind », tableau de bord « rat ») ----------
       cfg = { t, list(), save(L), store, extra: [colonnes en plus], onNew(), onEdit(I), onImport()?, blk } */
    const IND_W = { inom: 220, iform: 360, imode: 100, ifmt: 150, ival: 150, iseuil: 110 };
    const IND_CTL = {};
    const indTableCtl = cfg => {
      const st = { ck: new Set(), only: false };
      const colsOf = E => [
        ["inom", "INDICATEUR", r => r.nom || "", ""],
        ["iform", "FORMULE", r => indText(r.f, E), ""],
        ["imode", "EN", r => r.mode === "m" ? "MONTANT" : "QUANTITÉ", "center"],
        ["ifmt", "FORMAT", r => (r.fmt === "p" ? "POURCENTAGE" : "NOMBRE") + " · " + (r.dec === undefined ? 2 : r.dec) + " DÉC.", "center"],
        ["ival", "VALEUR (CE BUDGET)", r => indCalc(r, cfg.data ? cfg.data() : INS, E).txt, "number"],
        ...(cfg.extra || [])];
      const shown = E => cfApply(cfg.t, colsOf(E), cfg.list().filter(r => !st.only || st.ck.has(r.id)));
      const data = () => { const E = indEls(cfg.data ? cfg.data() : INS), oc = coOrder(cfg.t, colsOf(E)); return { head: oc.map(c => c[1]), rows: shown(E).map(r => oc.map(c => c[2](r))) }; };
      const render = d => {
        const t = d.querySelector("table[data-it='" + cfg.t + "']"); if (!t) return;
        const E = indEls(cfg.data ? cfg.data() : INS), cols = colsOf(E), oc = coOrder(cfg.t, cols), all = cfg.list();
        st.ck = new Set([...st.ck].filter(id => all.some(r => r.id === id))); if (!st.ck.size) st.only = false;
        const rows = shown(E), nCk = rows.filter(r => st.ck.has(r.id)).length;
        const hs = nCk === 0 ? "" : nCk === rows.length ? " checked" : " data-half";
        const wOf = k => cwLoad()[cfg.t + "." + k] || IND_W[k] || 120;
        const cell = (c, r) => {
          if (c[0] === "iseuil") return `<td class="center"><input class="pv-in ind-sv" inputmode="decimal" value="${esc(r.seuil === undefined || r.seuil === "" ? "" : String(r.seuil).replace(".", ","))}"${cfg.ro ? " disabled" : ""}></td>`;
          const cc = c[0] === "ival" ? indCalc(r, cfg.data ? cfg.data() : INS, E) : null, sv = Number(String(r.seuil ?? "").replace(",", "."));
          const over = cc && r.seuil !== undefined && r.seuil !== "" && Number.isFinite(cc.val) && cc.val > sv;
          return `<td class="${c[3]}${cc && cc.err ? " rat-err" : over ? " rat-over" : ""}">${esc(c[2](r))}</td>`;
        };
        t.innerHTML = `<colgroup>${oc.map(c => `<col data-w="${cfg.t}.${c[0]}" style="width:${wOf(c[0])}px">`).join("")}<col style="width:44px"></colgroup>
          <thead><tr>${oc.map(c => cfHead(cfg.t, c[0], c[1], c[3])).join("")}<th class="center"><input type="checkbox" class="ind-all"${hs}></th></tr></thead>
          <tbody>${rows.map(r => `<tr data-id="${esc(r.id)}" class="ind-row">${oc.map(c => cell(c, r)).join("")}<td class="center"><input type="checkbox" class="ind-ck"${st.ck.has(r.id) ? " checked" : ""}></td></tr>`).join("") || `<tr><td colspan="${oc.length + 1}" class="empty">${all.length ? "AUCUN INDICATEUR AVEC CES FILTRES" : "AUCUN INDICATEUR : TOUCHER « + » POUR EN CRÉER UN"}</td></tr>`}
            ${cfg.ro ? "" : `<tr class="ind-plus"><td colspan="${oc.length + 1}"><button type="button" class="svc-b" data-inew>+ NOUVEL INDICATEUR</button></td></tr>`}</tbody>`;
        t.style.width = oc.reduce((s2, c) => s2 + wOf(c[0]), 44) + "px";
        const ha = t.querySelector(".ind-all"); if (ha && ha.hasAttribute("data-half")) ha.indeterminate = true;
        const ob = d.querySelector("[data-ionly='" + cfg.t + "']"); if (ob) { ob.hidden = !st.ck.size; ob.style.display = st.ck.size ? "" : "none"; ob.classList.toggle("on", st.only); ob.innerHTML = "COCHÉES " + svCnt(st.ck.size); }
      };
      const menu = (d, btn) => {
        const old = document.getElementById("blkMenu"); old?.remove(); if (old && old.dataset.for === cfg.t) return;
        const n = st.ck.size, has = cfg.list().length;
        const m = document.createElement("div"); m.id = "blkMenu"; m.dataset.for = cfg.t;
        m.innerHTML = `${cfg.ro ? "" : `<button type="button" data-ia="del"${n ? ' class="blk-del"' : ' class="blk-del off" disabled'}><span>SUPPRIMER LES LIGNES COCHÉES ${svCnt(n)}</span></button>`}
          <button type="button" data-ia="copy"${n ? "" : ' class="off" disabled'}><span>COPIER LES LIGNES COCHÉES ${svCnt(n)}</span></button>
          <button type="button" data-ia="export"${has ? "" : ' class="off" disabled'}><span>EXPORTER</span></button>
          <button type="button" data-ia="pdf"${has ? "" : ' class="off" disabled'}><span>APERÇU PDF</span></button>
          ${cfg.onImport && !cfg.ro ? `<button type="button" data-ia="imp"><span>IMPORTER DES INDICATEURS</span></button>` : ""}`;
        document.body.appendChild(m); sviPlaceMenu(m, btn.getBoundingClientRect()); m.style.zIndex = 100010;
        m.addEventListener("click", async ev => {
          const it = ev.target.closest("[data-ia]"); if (!it || it.disabled) return; m.remove();
          const a = it.dataset.ia;
          if (a === "del") {
            const L = cfg.list(), names = L.filter(r => st.ck.has(r.id)).map(r => r.nom);
            d.remove();
            if (await svConfirm({ title: "SUPPRIMER " + names.length + " INDICATEUR(S)", text: names.slice(0, 5).join(", ") + (names.length > 5 ? "…" : "") + (cfg.t === "ind" ? " : RETIRÉS DE LA LISTE ET DES TABLEAUX DE TOUS LES BUDGETS." : " : RETIRÉS DU TABLEAU DE BORD ET DE SES GRAPHIQUES."), ok: "SUPPRIMER" })) {
              cfg.save(L.filter(r => !st.ck.has(r.id))); histLog(cfg.store.br, "INDICATEURS SUPPRIMÉS", names.join(", ")); st.ck = new Set();
            }
            cfg.reopen(); return;
          }
          if (a === "copy") { const E = indEls(INS), oc = coOrder(cfg.t, colsOf(E)), txt = [oc.map(c => c[1]).join("\t"), ...cfg.list().filter(r => st.ck.has(r.id)).map(r => oc.map(c => c[2](r)).join("\t"))].join("\n"); try { await navigator.clipboard.writeText(txt); svToast(n + " INDICATEUR(S) COPIÉ(S).", 2500); } catch (er) { svToast("COPIE IMPOSSIBLE SUR CET APPAREIL.", 3000); } return; }
          if (a === "export") { cfg.close(); openExportMenu(cfg.t); return; }
          if (a === "pdf") { cfg.close(); printGeneric(cfg.t); return; }
          if (a === "imp") { cfg.close(); cfg.onImport(); }
        });
        setTimeout(() => document.addEventListener("pointerdown", function off(ev) { if (!ev.target.closest("#blkMenu")) { m.remove(); document.removeEventListener("pointerdown", off, true); } }, true), 0);
      };
      const wire = d => {
        const inT = el => el && el.closest && el.closest("table[data-it='" + cfg.t + "']");
        d.addEventListener("change", e => {
          const t = e.target; if (!inT(t) && !t.closest("[data-ionly='" + cfg.t + "']")) return;
          if (t.classList.contains("ind-ck")) { const id = t.closest("tr").dataset.id; if (t.checked) st.ck.add(id); else st.ck.delete(id); render(d); return; }
          if (t.classList.contains("ind-all")) {
            const ids = [...inT(t).querySelectorAll("tr.ind-row")].map(r => r.dataset.id), all = ids.length && ids.every(id => st.ck.has(id));
            if (all) ids.forEach(id => st.ck.delete(id)); else ids.forEach(id => st.ck.add(id));
            render(d); return;
          }
          if (t.classList.contains("ind-sv")) { const L = cfg.list(), r = L.find(x => x.id === t.closest("tr").dataset.id); if (r) { r.seuil = t.value.trim() === "" ? "" : num(t.value); cfg.save(L); render(d); if (cfg.after) cfg.after(); } }
        });
        d.addEventListener("click", e => {
          const ob = e.target.closest("[data-ionly='" + cfg.t + "']"); if (ob) { st.only = !st.only; render(d); return; }
          const mo = e.target.closest("[data-imore='" + cfg.t + "']"); if (mo) { e.stopPropagation(); menu(d, mo); return; }
          if (!inT(e.target)) return;
          const cfb = e.target.closest(".cf-btn"); if (cfb) { e.stopPropagation(); cfOpenMenu(cfb); return; }
          if (e.target.closest("[data-inew]")) { cfg.onNew(); return; }
          const row = e.target.closest("tr.ind-row");
          if (row && !e.target.closest("input") && !cfg.ro) { const I = cfg.list().find(r => r.id === row.dataset.id); if (I) cfg.onEdit(I); }
        });
        /* colonnes : largeur (trait au bord droit de l'en-tête) et place (glisser l'en-tête), mémorisées */
        d.addEventListener("pointerdown", e => {
          if (!inT(e.target)) return;
          const rs = e.target.closest(".col-rs");
          if (rs) {
            e.preventDefault(); e.stopPropagation();
            const t = inT(rs), col = t.querySelector(`col[data-w="${cfg.t}.${rs.dataset.col}"]`); if (!col) return;
            const x0 = e.clientX, w0 = parseFloat(col.style.width) || col.getBoundingClientRect().width; let w = w0;
            rs.classList.add("on");
            const mv = ev => { w = Math.max(40, Math.round(w0 + ev.clientX - x0)); col.style.width = w + "px"; t.style.width = [...t.querySelectorAll("col")].reduce((s2, c) => s2 + (parseFloat(c.style.width) || 0), 0) + "px"; };
            const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); rs.classList.remove("on"); const all = cwLoad(); all[cfg.t + "." + rs.dataset.col] = w; cwSave(all); };
            document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
            return;
          }
          const th = e.target.closest("thead th");
          if (th && !e.target.closest(".cf-btn, input") && th.querySelector(".cf-btn")) {
            const key = th.querySelector(".cf-btn").dataset.col, x0 = e.clientX; let moved = false;
            const mv = ev => { if (Math.abs(ev.clientX - x0) > 12) { moved = true; th.style.opacity = ".5"; } };
            const up = ev => {
              document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); th.style.opacity = "";
              if (!moved) return;
              const tgt = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("thead th"), k2 = tgt && tgt.querySelector(".cf-btn")?.dataset.col;
              if (!k2 || k2 === key || !inT(tgt)) return;
              const keys = coKeys(cfg.t, colsOf([]).map(c => c[0])).filter(k => k !== key), rr = tgt.getBoundingClientRect();
              keys.splice(keys.indexOf(k2) + (ev.clientX > rr.left + rr.width / 2 ? 1 : 0), 0, key);
              const all = coLoad(); all[cfg.t] = keys; coSave(all); render(d);
            };
            document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
          }
        });
      };
      const ctl = { st, render, wire, data };
      IND_CTL[cfg.t] = ctl;
      return ctl;
    };
    const indData = () => IND_CTL.ind ? IND_CTL.ind.data() : { head: [], rows: [] };
    const ratData = () => IND_CTL.rat ? IND_CTL.rat.data() : { head: [], rows: [] };
    const indBar = (t, sub) => `<div class="ind-bar"><span class="pv-sub">${sub}</span><button type="button" class="svc-b ind-only" data-ionly="${t}" hidden></button><button type="button" class="blk-more ind-more" data-imore="${t}" aria-label="Actions">⋯</button></div>`;

    /* ---------- fenêtre LISTE DES INDICATEURS ---------- */
    const indWin = done => {
      const d = sviWinNew();
      const close = () => { window.__sviIndRefresh = null; document.getElementById("blkMenu")?.remove(); d.remove(); };
      const reopen = () => indWin(done);
      const ctl = indTableCtl({ t: "ind", list: () => indLoad(), save: L => indSaveL(L), store: IND_STORE, close, reopen,
        onNew: () => { close(); indDesignWin(null, () => reopen()); },
        onEdit: I => { close(); indDesignWin(I, () => reopen()); },
        onImport: () => openImportBudget("indlist", () => reopen()) });
      d.innerHTML = sviWinCard({ cls: "cmp-card svc-full ind-lcard", close: "data-x", title: "LISTE DES INDICATEURS",
        body: indBar("ind", "COMMUNE À TOUS LES BUDGETS ET PARTAGÉE ENTRE LES APPAREILS ; ELLE ALIMENTE LES TABLEAUX DE VERSIONS ET SCÉNARIOS. VALEUR CALCULÉE SUR CE BUDGET.")
          + `<div class="cmp-scroll ind-scroll"><table class="bdg-d-table ind-table" id="indTable" data-it="ind"></table></div>`,
        foot: `<button type="button" class="svc-b svc-ok svc-neutral" data-x>FERMER</button>` });
      sviWinShow(d);
      window.__sviIndRefresh = () => { if (document.body.contains(d)) ctl.render(d); else window.__sviIndRefresh = null; };
      window.__sviSharedChanged = r => { if (r === "_IND" && window.__sviIndRefresh) window.__sviIndRefresh(); };
      ctl.render(d); ctl.wire(d);
      d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) { close(); if (done) done(); } });
    };

    /* ---------- ligne « + » d'un tableau : menu des indicateurs de la liste ; pick(id) ---------- */
    const indPlusMenu = (btn, taken, pick, onNew) => {
      document.getElementById("blkMenu")?.remove();
      const L = indLoad().filter(I => !(taken || []).includes(I.id));
      const m = document.createElement("div"); m.id = "blkMenu"; m.dataset.for = "indplus";
      m.innerHTML = (L.length ? L.map(I => `<button type="button" data-pk="${esc(I.id)}"><span>${esc(I.nom)}</span></button>`).join("") : `<button type="button" class="off" disabled><span>${indLoad().length ? "TOUS LES INDICATEURS SONT DÉJÀ DANS LE TABLEAU" : "LISTE DES INDICATEURS VIDE"}</span></button>`)
        + `<button type="button" data-pk="__new"><span>NOUVEL INDICATEUR…</span></button><button type="button" data-pk="__list"><span>LISTE DES INDICATEURS…</span></button>`;
      document.body.appendChild(m); sviPlaceMenu(m, btn.getBoundingClientRect()); m.style.zIndex = 100010;
      m.addEventListener("click", ev => { const b = ev.target.closest("[data-pk]"); if (!b) return; m.remove(); onNew(b.dataset.pk === "__new" ? "new" : b.dataset.pk === "__list" ? "list" : null, b.dataset.pk); if (b.dataset.pk[0] !== "_") pick(b.dataset.pk); });
      setTimeout(() => document.addEventListener("pointerdown", function off(ev) { if (!ev.target.closest("#blkMenu")) { m.remove(); document.removeEventListener("pointerdown", off, true); } }, true), 0);
    };
    shell.__indWin = done => indWin(done);
    shell.__ind = { load: () => indLoad(), save: L => indSaveL(L), calc: (I, d) => indCalc(I, d || INS), parse: f => indParse(f), design: (I, cb, st) => indDesignWin(I, cb, st) };
