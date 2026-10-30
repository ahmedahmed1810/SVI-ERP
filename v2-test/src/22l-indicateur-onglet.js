    /* =========================================================
       v724 (bloc 2, point 2) : onglet INDICATEURS — un indicateur à la fois, écran en quatre parties réglables par poignées
       (FORMAT 256, 257) : en haut à gauche le tableau du PLANNING, en haut à droite le Gantt ; en bas à gauche le tableau des
       valeurs exactes (copiable), en bas à droite le graphique. Roue ⚙ au-dessus du graphique : choix de l'indicateur (grisés
       visibles, avec leur raison), abscisse JOUR / SEMAINE / MOIS, UNITAIRE / CUMULÉ, MODIFIER, + NOUVEL INDICATEUR.
       Choix gardé dans le budget (INS.rat.one) ; largeur et hauteur des parties gardées sur l'appareil (affichage).
       ========================================================= */
    const I1_KEY = "svi_ind1_v1";
    const i1Lay = () => { try { return { cw: 45, rh: 240, ...(JSON.parse(localStorage.getItem(I1_KEY) || "{}") || {}) }; } catch (e) { return { cw: 45, rh: 240 }; } };
    const i1LaySet = o => { try { localStorage.setItem(I1_KEY, JSON.stringify({ ...i1Lay(), ...o })); } catch (e) {} };
    /* indicateurs proposés : ceux du budget (tableau de bord) puis la liste commune (sans doublon) */
    const i1List = () => { const R = ibdR(), L = [...R.L]; indLive().forEach(I => { if (!L.some(x => x.id === I.id)) L.push(I); }); return L; };
    const i1Cfg = () => { const R = ibdR(); const o = { id: "", step: "s", cum: false, ...((R.one) || {}) }; if (!o.id || !i1List().some(I => I.id === o.id)) o.id = (R.L[0] || {}).id || ""; return o; };
    const i1CfgSet = o => { if (!INS_EDIT) { shell.__i1Tmp = { ...i1Cfg(), ...o }; return; } const R = ibdR(); R.one = { ...i1Cfg(), ...o }; ibdSave(R); };
    shell.__ind1HTML = () => {
      if (!INS) return `<div class="bdg-d-scroll"><div class="empty">INDICATEURS : BUDGET EN INSTANCE SEULEMENT.</div></div>`;
      const C = { ...i1Cfg(), ...(shell.__i1Tmp || {}) }, L = i1List(), I = L.find(x => x.id === C.id), E = indEls(INS), lay = i1Lay();
      /* PLANNING (lecture) et Gantt simple, mêmes tâches */
      const K = dlyKeys().filter(k => dlyDeb(k) && dlyFin(k)).sort((a, b) => dlyDeb(a).localeCompare(dlyDeb(b)));
      const d0 = K.map(dlyDeb).sort()[0] || "", d1 = K.map(dlyFin).sort().pop() || "", span = d0 ? Math.max(1, dDiff(d0, d1) + 1) : 1;
      const plan = `<table class="bdg-d-table i1-plan"><thead><tr><th>TÂCHE</th><th>DÉBUT</th><th>FIN</th><th class="number">DURÉE (J)</th></tr></thead><tbody>${K.map(k => `<tr><td>${esc(dlyName(k))}</td><td>${esc(dFr(dlyDeb(k)))}</td><td>${esc(dFr(dlyFin(k)))}</td><td class="number">${sviWDur(insCal(), dlyDeb(k), dlyFin(k)) || ""}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">AUCUNE TÂCHE DATÉE</td></tr>`}</tbody></table>`;
      const gantt = K.length ? `<div class="i1-gantt">${K.map(k => { const l = dDiff(d0, dlyDeb(k)) / span * 100, w = Math.max(.6, (dDiff(dlyDeb(k), dlyFin(k)) + 1) / span * 100);
        return `<div class="i1-gr"><span class="i1-gb" style="left:${l}%;width:${w}%"></span></div>`; }).join("")}<div class="i1-gx"><span>${esc(dFr(d0))}</span><span>${esc(dFr(d1))}</span></div></div>` : `<div class="empty">AUCUNE TÂCHE DATÉE</div>`;
      /* valeurs et graphique de l'indicateur choisi */
      let vals = `<div class="empty">CHOISIR UN INDICATEUR (⚙)</div>`, chart = vals, why = "";
      if (I) {
        const P = ibdSteps(INS, C.step), u = ibdUnit(I, E), v = ibdSeries(I, INS, P, !!C.cum), c = indCalc(I, INS, E);
        if (c.soft || c.err) why = c.txt;
        const lab = C.step === "j" ? "JOUR" : C.step === "m" ? "MOIS" : "SEMAINE";
        vals = `<table class="bdg-d-table i1-vals"><thead><tr><th>${lab}</th><th class="number">${esc(I.nom)}${u ? " (" + esc(u) + ")" : ""}</th></tr></thead><tbody>${P.map((p, i) => `<tr><td>${esc(p.lab)}</td><td class="number">${ibdFx(v[i], I.dec)}</td></tr>`).join("") || `<tr><td colspan="2" class="empty">AUCUNE DATE AU PLANNING</td></tr>`}</tbody></table>`;
        shell.__i1Tsv = [[lab, I.nom + (u ? " (" + u + ")" : "")].join("\t"), ...P.map((p, i) => [p.lab, ibdFx(v[i], I.dec)].join("\t"))].join("\n");
        /* v725 (point 4, FORMAT 258) : ESSAI — prix ou rendement d'une charge changé sur une copie : courbe ESSAI, budget inchangé */
        const TRY = shell.__i1Try, S = [{ I, lab: I.nom, u, v }];
        if (TRY) { const D2 = i1TryData(TRY); S.push({ I, lab: "ESSAI — " + I.nom, u, v: ibdSeries(I, D2, P, !!C.cum) }); }
        chart = (TRY ? `<div class="i1-try"><b>ESSAI — BUDGET INCHANGÉ</b> <span>${esc(i1TryLab(TRY))}</span><button type="button" class="svc-b" data-i1tryx>ANNULER</button>${INS_EDIT && INS_REAL ? `<button type="button" class="svc-b svc-ok svc-neutral" data-i1tryok>APPLIQUER</button>` : ""}</div>` : "")
          + ibdChart(S, P, { hs: [], vs: ["today"], cum: !!C.cum }, [u]);
      }
      return `<div class="i1-wrap" style="--i1-cw:${lay.cw}%;--i1-rh:${lay.rh}px">
        <div class="i1-p i1-tl">${plan}</div><div class="i1-vh" data-i1h="c" title="Largeur">‖</div><div class="i1-p i1-tr">${gantt}</div>
        <div class="i1-hh" data-i1h="r" title="Hauteur">=</div>
        <div class="i1-p i1-bl"><div class="i1-bar"><b>VALEURS</b><button type="button" class="svc-b" data-i1copy>COPIER</button></div>${vals}</div>
        <div class="i1-vh i1-vh2" data-i1h="c">‖</div>
        <div class="i1-p i1-br"><div class="i1-bar"><b>${esc(I ? I.nom : "INDICATEUR")}</b>${why ? `<span class="i1-why">${esc(why)}</span>` : ""}${INS_EDIT ? `<button type="button" class="svc-b" data-i1try>ESSAI…</button>` : ""}<button type="button" class="blk-btn i1-cfg" data-i1cfg title="Choisir et régler l'indicateur">⚙</button></div><div class="i1-chart">${chart}</div></div>
      </div>`;
    };
    /* essai : { id (ligne de charge), p (prix), rd (% de rendement : la quantité devient q ÷ (1 + rd %)) } */
    const i1TryRow = T => (INS.chg || []).find(r => r.id === T.id) || {};
    const i1TryLab = T => { const r = i1TryRow(T); return U_(r.des || "") + (T.p !== "" && T.p !== undefined ? " — PRIX " + money(num(r.p)) + " → " + money(num(T.p)) : "") + (num(T.rd) ? " — RENDEMENT " + (num(T.rd) > 0 ? "+" : "") + num(T.rd) + " %" : ""); };
    const i1TryNew = (r, T) => { const o = { ...r }; if (T.p !== "" && T.p !== undefined) o.p = num(T.p); if (num(T.rd)) o.q = Math.round(num(r.q) / (1 + num(T.rd) / 100) * 1000) / 1000; return o; };
    const i1TryData = T => { const D = JSON.parse(JSON.stringify(INS)); D.chg = (D.chg || []).map(r => r.id === T.id ? i1TryNew(r, T) : r); return D; };
    const i1TryWin = () => {
      const R = (INS.chg || []).filter(r => !r.t), T = shell.__i1Try || { id: (R[0] || {}).id || "", p: "", rd: "" }, d = sviWinNew();
      d.innerHTML = sviWinCard({ cls: "hcf-card i1-card", close: "data-x", title: "ESSAI",
        body: `<div class="hcf-g"><span class="hcf-k">CHARGE</span><span><select class="pv-in i1t-id" style="width:100%">${R.map(r => `<option value="${esc(r.id)}"${r.id === T.id ? " selected" : ""}>${esc(U_(r.des || ""))} (${esc(U_(r.u || ""))}, PRIX ${esc(money(num(r.p)))})</option>`).join("")}</select></span>
          <span class="hcf-k">NOUVEAU PRIX</span><span><input class="pv-in i1t-p" inputmode="decimal" value="${esc(String(T.p ?? ""))}" placeholder="INCHANGÉ"></span>
          <span class="hcf-k">RENDEMENT (%)</span><span><input class="pv-in i1t-rd" inputmode="decimal" value="${esc(String(T.rd ?? ""))}" placeholder="EX. +10"></span></div>
          <div class="hcf-note">L'ESSAI NE CHANGE PAS LE BUDGET : UNE COURBE « ESSAI » S'AJOUTE AU GRAPHIQUE. APPLIQUER L'ENREGISTRE (↶ POSSIBLE). LA CAPACITÉ S'ESSAIE SUR LA BARRE DU GRAPHIQUE DU PLANNING.</div>`,
        foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-i1tgo>ESSAYER</button>` });
      sviWinShow(d);
      d.addEventListener("click", e => {
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
        if (e.target.closest("[data-i1tgo]")) { shell.__i1Try = { id: d.querySelector(".i1t-id").value, p: d.querySelector(".i1t-p").value.trim().replace(",", "."), rd: d.querySelector(".i1t-rd").value.trim().replace(",", ".").replace("+", "") }; d.remove(); refreshAll(); }
      });
    };
    const i1TryApply = () => {
      const T = shell.__i1Try; if (!T) return; const r = (INS.chg || []).find(x => x.id === T.id); if (!r) return;
      const lab = i1TryLab(T), n = i1TryNew(r, T), who = typeof sviUser === "function" ? sviUser() || "?" : "?";
      r.p = n.p; r.q = n.q; r.modInd = "MODIFIÉ PAR " + who + " DEPUIS INDICATEURS (" + lab + ")";
      shell.__i1Try = null; histLog("INDICATEURS", "ESSAI APPLIQUÉ", lab); insSave(); refreshAll();
      svToast("ESSAI APPLIQUÉ : " + lab + " (↶ POUR ANNULER).", 4000);
    };
    /* roue ⚙ : choix et réglages */
    const i1Win = () => {
      const C = { ...i1Cfg(), ...(shell.__i1Tmp || {}) }, L = i1List(), E = indEls(INS), d = sviWinNew();
      const opt = I => { const c = indCalc(I, INS, E), off = c.soft || c.err; return `<option value="${esc(I.id)}"${I.id === C.id ? " selected" : ""}>${esc(I.nom)}${off ? " — " + esc(c.txt) : ""}</option>`; };
      d.innerHTML = sviWinCard({ cls: "hcf-card i1-card", close: "data-x", title: "INDICATEUR",
        body: `<div class="hcf-g"><span class="hcf-k">INDICATEUR</span><span><select class="pv-in i1-sel" style="width:100%">${L.map(opt).join("")}</select></span>
          <span class="hcf-k">ABSCISSE</span><span class="hcf-sw hcf-sw3">${[["j", "JOUR"], ["s", "SEMAINE"], ["m", "MOIS"]].map(([v, l]) => `<label class="hcf-seg${C.step === v ? " on" : ""}"><input type="radio" name="i1s" value="${v}"${C.step === v ? " checked" : ""}><span>${l}</span></label>`).join("")}</span>
          <span class="hcf-k">PRÉSENTATION</span><span class="hcf-sw">${[["0", "UNITAIRE"], ["1", "CUMULÉ"]].map(([v, l]) => `<label class="hcf-seg${(C.cum ? "1" : "0") === v ? " on" : ""}"><input type="radio" name="i1c" value="${v}"${(C.cum ? "1" : "0") === v ? " checked" : ""}><span>${l}</span></label>`).join("")}</span></div>
          <div class="hcf-note">FORMULE ET POURCENTAGE : MODIFIER L'INDICATEUR. UN INDICATEUR GRISÉ N'A PAS SES DONNÉES DANS CE BUDGET (RAISON APRÈS SON NOM).</div>`,
        foot: `${INS_EDIT ? `<button type="button" class="svc-b" data-i1edit>MODIFIER</button><button type="button" class="svc-b" data-i1new>+ NOUVEL INDICATEUR</button>` : ""}<button type="button" class="svc-b svc-ok svc-neutral" data-x>FERMER</button>` });
      sviWinShow(d);
      const STORE = { list: () => ibdR().L, save: Lx => { const R = ibdR(); R.L = Lx; ibdSave(R); }, br: "INDICATEURS" };
      d.addEventListener("change", e => {
        const t = e.target;
        if (t.classList.contains("i1-sel")) i1CfgSet({ id: t.value });
        else if (t.name === "i1s") i1CfgSet({ step: t.value });
        else if (t.name === "i1c") i1CfgSet({ cum: t.value === "1" });
        if (t.closest && t.closest(".hcf-seg")) t.closest(".hcf-sw").querySelectorAll(".hcf-seg").forEach(s => s.classList.toggle("on", s.querySelector("input").checked));
        refreshAll();
      });
      d.addEventListener("click", e => {
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
        if (e.target.closest("[data-i1new]")) { d.remove(); indDesignWin(null, I => { if (I) { const R = ibdR(); if (!R.L.some(x => x.id === I.id)) { R.L.push(I); } R.one = { ...i1Cfg(), id: I.id }; ibdSave(R, "INDICATEUR AJOUTÉ", I.nom); } refreshAll(); }, STORE); return; }
        if (e.target.closest("[data-i1edit]")) { const id = d.querySelector(".i1-sel").value, I = ibdR().L.find(x => x.id === id) || i1List().find(x => x.id === id); d.remove(); if (!I) return;
          const inBdg = ibdR().L.some(x => x.id === id); indDesignWin(I, () => refreshAll(), inBdg ? STORE : IND_STORE); }
      });
    };
    shell.__i1Click = async e => {
      const w = e.target.closest && e.target.closest(".i1-wrap"); if (!w) return;
      if (e.target.closest("[data-i1cfg]")) { e.stopPropagation(); i1Win(); return; }
      if (e.target.closest("[data-i1try]")) { e.stopPropagation(); i1TryWin(); return; }
      if (e.target.closest("[data-i1tryx]")) { e.stopPropagation(); shell.__i1Try = null; refreshAll(); return; }
      if (e.target.closest("[data-i1tryok]")) { e.stopPropagation(); i1TryApply(); return; }
      if (e.target.closest("[data-i1copy]")) { e.stopPropagation(); try { await navigator.clipboard.writeText(shell.__i1Tsv || ""); svToast("VALEURS COPIÉES.", 2000); } catch (er) { svToast("COPIE IMPOSSIBLE SUR CET APPAREIL.", 3000); } }
    };
    /* poignées : largeur de la colonne de gauche (‖) et hauteur du haut (=) */
    shell.__i1Down = e => {
      const h = e.target.closest && e.target.closest(".i1-wrap [data-i1h]"); if (!h) return;
      e.preventDefault(); e.stopPropagation();
      const w = h.closest(".i1-wrap"), r = w.getBoundingClientRect(), kind = h.dataset.i1h;
      const mv = ev => { if (kind === "c") { const cw = Math.max(15, Math.min(85, (ev.clientX - r.left) / r.width * 100)); w.style.setProperty("--i1-cw", cw + "%"); w.__v = { cw }; }
        else { const rh = Math.max(80, Math.min(r.height - 80, ev.clientY - r.top)); w.style.setProperty("--i1-rh", rh + "px"); w.__v = { rh }; } };
      const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); if (w.__v) i1LaySet(w.__v); };
      document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
    };
    if (!shell.__i1Bound) { shell.__i1Bound = true;
      shell.addEventListener("click", e => { if (shell.__i1Click) shell.__i1Click(e); }, true);
      shell.addEventListener("pointerdown", e => { if (shell.__i1Down) shell.__i1Down(e); }, true); }
    /* v725 : toucher le ✎ d'une ligne modifiée depuis les indicateurs = le message */
    if (!shell.__modIndBound) { shell.__modIndBound = true; shell.addEventListener("click", e => { const m = e.target.closest && e.target.closest(".ins-modind[data-modind]"); if (!m) return; e.stopPropagation(); svToast(m.dataset.modind, 4500, m); }, true); }
