    /* ===== budget en instance : appui long sur une ligne saisie = glisser la ligne
       (un titre emmène ses lignes et sous-titres) ===== */
    /* désignations : dépôt d'une ligne ou d'un titre (avec sa branche) — FORMAT 61
       - avant une ligne / un titre : même niveau que lui ;
       - après une ligne : même niveau (entre dans son titre) ;
       - après un titre déplié : entre dans ce titre ; après un titre replié : à côté de lui (après sa branche) ;
       - superposé : nouveau titre « NOUVEAU TITRE n » qui regroupe la ligne visée puis la ligne glissée ;
       - titres devenus vides : supprimés après confirmation (ANNULER = glissement annulé) */
    /* lignes sélectionnées d'un bloc (cases cochées) ; désignations : un titre coché (branche entière ou titre vide) emporte sa branche */
    /* lignes affichées (filtres compris) : les actions ne portent que sur elles (FORMAT 84) */
    const insVis = k => new Set((["lot", "prim", "sec"].includes(k) ? cfApply(k, [["v", "", r => r.v || "", ""]], INS[k]) : insShown(k)).map(r => r.id));
    const insSelIds = k => {
      const L = INS[k] || [], out = new Set(), vis = insVis(k);
      if (k !== "des") { L.forEach(r => { if (r.on === true && vis.has(r.id)) out.add(r.id); }); return out; }
      insNorm();
      const D = r => Number(r.d) || 0;
      L.forEach((r, i) => {
        if (!r.t) { if (r.on === true && vis.has(r.id)) out.add(r.id); return; }
        if (!vis.has(r.id)) return;
        let e = i + 1; while (e < L.length && D(L[e]) > D(r)) e++;
        const br = L.slice(i + 1, e).filter(x => x.t ? vis.has(x.id) : vis.has(x.id)), lines = br.filter(x => !x.t);
        /* titre retenu seulement si sa propre case est cochée (et toute sa branche, s'il en a une) */
        if (r.on === true && (!lines.length || lines.every(x => x.on === true))) { out.add(r.id); br.forEach(x => out.add(x.id)); }
      });
      return out;
    };
    const desDrop = async (arr, ids, tid, mode, outD) => {
      insNorm();
      const snap = arr.map(r => ({ ...r }));
      const D = r => Number(r.d) || 0;
      const bset = new Set(ids);
      const i0 = arr.findIndex(r => bset.has(r.id));
      const block = arr.filter(r => bset.has(r.id));
      arr.splice(0, arr.length, ...arr.filter(r => !bset.has(r.id)));
      const shift = (rows, base) => { const d0 = D(rows[0]); rows.forEach(r => { r.d = base + D(r) - d0; }); };
      let j = arr.findIndex(r => r.id === tid);
      if (j < 0) { arr.splice(0, arr.length, ...snap); return; }
      const T = arr[j];
      const branchEnd = i => { let e = i + 1; while (e < arr.length && D(arr[e]) > D(arr[i])) e++; return e; };
      let created = null;
      if (mode === "on") {
        const e = branchEnd(j);
        const tb = arr.splice(j, e - j);
        const used = INS.des.concat(snap).map(r => (String(r.des || "").match(/^NOUVEAU TITRE (\d+)$/) || [])[1]).filter(Boolean).map(Number);
        created = { id: insId(), t: true, art: "", des: "NOUVEAU TITRE " + ((used.length ? Math.max(...used) : 0) + 1), d: D(T), on: false };
        shift(tb, D(T) + 1); shift(block, D(T) + 1);
        arr.splice(j, 0, created, ...tb, ...block);
      } else if (mode === "before") {
        shift(block, D(T)); arr.splice(j, 0, ...block);
      } else if (T.t && !foldGet()[T.id]) {
        shift(block, D(T) + 1); arr.splice(j + 1, 0, ...block);
      } else if (T.t && mode === "afterIn") {
        /* titre replié, doigt à droite : ajouté à la fin de ses lignes ; le titre reste replié */
        shift(block, D(T) + 1); arr.splice(branchEnd(j), 0, ...block);
      } else if (T.t) {
        shift(block, outD != null ? outD : D(T)); arr.splice(branchEnd(j), 0, ...block);
      } else {
        /* v466 : après la dernière ligne d'un titre, doigt vers la gauche = niveau supérieur (sort du titre) */
        shift(block, outD != null ? outD : D(T)); arr.splice(j + 1, 0, ...block);
      }
      insNorm();
      /* titres vides (sans aucune ligne, sous-titres vides compris) */
      /* titres devenus vides PAR CE GLISSEMENT (un titre déjà vide et gardé n'est plus redemandé) */
      const emptyIn = L => new Set(L.filter((r, i) => {
        if (!r.t) return false;
        for (let x = i + 1; x < L.length && D(L[x]) > D(r); x++) if (!L[x].t) return false;
        return true;
      }).map(r => r.id));
      const was = emptyIn(snap), now = emptyIn(arr);
      const empty = arr.filter(r => now.has(r.id) && !was.has(r.id) && !(created && r.id === created.id));
      let choice = "";
      if (empty.length) {
        /* ANNULER = glissement annulé ; GARDER = glissement fait, titres vides gardés ; SUPPRIMER = titres vides supprimés */
        const v = await svChoose({ title: "TITRES VIDES",
          html: `<div class="svc-sub">CES TITRES N'ONT PLUS AUCUNE LIGNE :</div><ul class="svc-list">${empty.map(r => `<li>${esc([r.art, r.des].filter(Boolean).join(" "))}</li>`).join("")}</ul>`,
          buttons: [{ v: "keep", label: "GARDER", tone: "neutral" }, { v: "del", label: "SUPPRIMER", tone: "danger" }] });
        if (!v) { arr.splice(0, arr.length, ...snap); insSave(); insRedraw("des"); return; }
        choice = v;
      }
      if (choice === "del") {
        const gone = new Set(empty.map(r => r.id));
        const keep = arr.filter(r => !gone.has(r.id));
        arr.splice(0, arr.length, ...keep);
        insNorm();
        histLog("DÉSIGNATIONS CLIENT", "TITRES VIDES SUPPRIMÉS", empty.map(r => r.des || r.art || "").join(", "));
      }
      insSave();
      histLog("DÉSIGNATIONS CLIENT", created ? "NOUVEAU TITRE" : "ORDRE DES LIGNES", String(created ? created.des : (block[0].des || block[0].art || "")));
      insRedraw("des");
      /* nouveau titre : l'intitulé est prêt à être saisi */
      if (created) setTimeout(() => {
        const i = shell.querySelector(`#bdgClientBody tr[data-iid="${created.id}"] [data-f="des"]`);
        if (i) { i.focus(); try { i.select(); } catch (e) {} i.scrollIntoView({ block: "nearest" }); }
      }, 30);
    };
    const insDrag = (event, el) => {
      const X = shell.__ins;
      if (!X) return;
      const holder = el.closest("[data-ik]");
      const k = el.dataset.ik || holder?.dataset.ik;
      const isRow = el.tagName === "TR";
      { const st = CF[k === "des" ? "client" : k];
        if (st && st.sort && !st.sort.def) {
          /* FORMAT 118 : appui long pendant un tri → message (le glissement reste impossible) */
          const c = (INS_COLS[k] || []).find(x => x[4] === st.sort.col || x[0] === st.sort.col);
          const lab = c ? c[1] : ({ lot: "LOT", prim: "ACTIVITÉ PRIMAIRE", sec: "ACTIVITÉ SECONDAIRE", v: k === "lot" ? "LOT" : k === "prim" ? "ACTIVITÉ PRIMAIRE" : "ACTIVITÉ SECONDAIRE" }[st.sort.col] || String(st.sort.col).toUpperCase());
          const sx = event.clientX, sy = event.clientY;
          const tm = setTimeout(() => { off(); svToast("GLISSEMENT IMPOSSIBLE : TRI ACTIF SUR LA COLONNE " + lab + " — ANNULER LE TRI POUR DÉPLACER OU SUPERPOSER", 4500, el); }, 400);
          const mvv = e => { if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) off(); };
          const off = () => { clearTimeout(tm); document.removeEventListener("pointermove", mvv); document.removeEventListener("pointerup", off); document.removeEventListener("pointercancel", off); };
          document.addEventListener("pointermove", mvv); document.addEventListener("pointerup", off); document.addEventListener("pointercancel", off);
          return;
        } }
      /* v525 : titre de niveau — pas de prise de focus à l'appui (la liste ne bouge pas pendant l'appui long) ; un simple toucher ouvre la saisie */
      if (el.classList.contains("lot-grp") && event.target.closest("input.lot-gname") && event.target !== document.activeElement) event.preventDefault();
      const dv = event.target.closest(".ins-dv");
      const inp = event.target.closest(".ins-in, .lot-gname") || (dv && dv.parentElement.querySelector(".ins-in"));
      const tapFocus = inp && inp !== document.activeElement ? inp : null;
      const sibs = () => isRow
        ? [...el.parentElement.querySelectorAll("tr[data-iid]")]
        : [...el.parentElement.querySelectorAll(k === "lot" ? ".ins-li[data-iid], .ins-li.lot-grp" : ".ins-li[data-iid]")];
      const x0 = event.clientX, y0 = event.clientY;
      let on = false, moved = false, target = null, after = false, over = false, inside = false, outD = null, gap = null;
      /* v529 : lignes visibles de la liste des lots (chemin, a des sous-lignes, replié) — sans la ligne déplacée ni sa branche */
      const lotRows = () => {
        if (k !== "lot") return [];
        const srcP = el.classList.contains("lot-grp") ? dlyLotPath(el.dataset.path) : lotSegs(X.INS.lot.find(q => q.id === el.dataset.iid));
        return sibs().map(x2 => {
          const segs = x2.classList.contains("lot-grp") ? dlyLotPath(x2.dataset.path) : lotSegs(X.INS.lot.find(q => q.id === x2.dataset.iid));
          const fd = x2.querySelector(".lot-fold");
          return { el: x2, segs, kids: !!fd, folded: !!fd && fd.textContent.trim() === "›" };
        }).filter(o => o.el !== el && !(srcP.length && o.segs.length >= srcP.length && srcP.every((g, i) => U_(g) === U_(o.segs[i]))));
      };
      /* repères de glissement effacés partout (même si le tableau a été redessiné entre-temps) */
      const clear = () => {
        shell.querySelectorAll(".ro-before, .ro-after, .ro-in, .ro-on").forEach(x => x.classList.remove("ro-before", "ro-after", "ro-in", "ro-on"));
        document.getElementById("roLine")?.remove();
      };
      /* désignations : un seul trait à l'endroit du dépôt, décalé selon le niveau d'arrivée
         (même trait entre deux lignes d'un même titre ; en bas d'un titre : décalé = reste dedans, plus à gauche = sort) */
      const roLine = (row, y, depth) => {
        let l = document.getElementById("roLine");
        if (!l) { l = document.createElement("div"); l.id = "roLine"; document.body.appendChild(l); }
        const cell = row.querySelector('[data-f="des"]')?.closest("td") || row;
        const c = cell.getBoundingClientRect(), t = row.closest("table").getBoundingClientRect(), box = row.closest(".bdg-d-scroll") || row.closest("table");
        const b = box.getBoundingClientRect();
        const x0 = Math.max(b.left, c.left + 4 + depth * 20), x1 = Math.min(b.right, t.right);
        l.style.cssText = `position:fixed;z-index:10060;pointer-events:none;height:3px;border-radius:2px;background:var(--inst,#12355b);left:${x0}px;width:${Math.max(20, x1 - x0)}px;top:${y - 1.5}px`;
      };
      /* FORMAT 26 : glisser pour déplacer partout ; regrouper (superposer) seulement désignations et lots */
      const canDrag = true;
      const timer = setTimeout(() => {
        if (!canDrag) return;
        on = true;
        /* le doigt est bloqué seulement pendant le glissement (le défilement normal reste libre) */
        document.addEventListener("touchmove", tm, { passive: false });
        shell.__insDragging = true;
        /* v533 : un nom de titre en cours de saisie est gardé AVANT le glissement (sans redessiner sous le doigt) */
        grpFlush(true);
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        /* pas de sélection de texte (poignées bleues) pendant le glissement */
        try { window.getSelection && window.getSelection().removeAllRanges(); } catch (e) {}
        document.body.classList.add("svi-dragging");
        el.classList.add("ro-src");
        try { navigator.vibrate && navigator.vibrate(15); } catch (e) {}
      }, 350);
      const tm = e => { if (on) e.preventDefault(); };
      const move = e => {
        if (!on) {
          if (Math.abs(e.clientX - x0) > 8 || Math.abs(e.clientY - y0) > 8) { moved = true; end(false); }
          return;
        }
        e.preventDefault();
        clear();
        target = null;
        for (const x of sibs()) {
          const r = x.getBoundingClientRect();
          if (e.clientY >= r.top && e.clientY <= r.bottom) {
            if (x !== el) {
              target = x;
              over = false;
              if (k === "des") {
                /* désignations : haut = avant, milieu = superposer (nouveau titre), bas = après */
                const f = (e.clientY - r.top) / (r.height || 1);
                over = f > .25 && f < .75;
                after = f >= .75;
                const tr0 = X.INS.des.find(q => q.id === x.dataset.iid);
                const d0 = Number(tr0 && tr0.d) || 0;
                /* sous un titre replié : doigt vers la droite = entre dans le titre, vers la gauche = à l'extérieur */
                inside = false;
                if (after && tr0 && tr0.t && foldGet()[tr0.id]) {
                  const c = (x.querySelector('[data-f="des"]')?.closest("td") || x).getBoundingClientRect();
                  inside = e.clientX > c.left + 8 + d0 * 20 + 24;
                }
                /* v466 : après la dernière ligne d'un titre (ligne suivante moins profonde ou fin du tableau) :
                   doigt vers la gauche = trait plus long = niveau supérieur, jusqu'au niveau de la ligne suivante */
                outD = null;
                if (after && !over && tr0 && !(tr0.t && (!foldGet()[tr0.id] || inside))) {
                  const list = sibs().filter(s2 => s2 !== el), ix = list.indexOf(x), nx = list[ix + 1];
                  const nr = nx && X.INS.des.find(q => q.id === nx.dataset.iid);
                  const minD = nr ? Math.min(d0, Number(nr.d) || 0) : 0;
                  if (minD < d0) outD = Math.max(minD, Math.min(d0, d0 + Math.round((e.clientX - x0) / 30)));
                }
                if (over) x.classList.add("ro-on");
                else roLine(x, after ? r.bottom : r.top, outD != null ? outD : !after ? d0 : (tr0 && tr0.t && (!foldGet()[tr0.id] || inside)) ? d0 + 1 : d0);
              } else if (k === "lot") {
                /* lots : milieu = dans le groupe (ou nouveau groupe) ; haut / bas = ENTRE deux lignes, un seul trait.
                   v529 (remarques 4 et 5) : juste sous un titre déplié, ou entre deux lignes d'un même groupe = dans ce groupe, sans choix ;
                   sous la dernière ligne d'un groupe déplié, ou sous un groupe replié = choix au doigt :
                   vers la droite = trait court = dans le groupe du dessus ; vers la gauche = trait long = même rang que lui */
                const f = (e.clientY - r.top) / (r.height || 1);
                over = f > .25 && f < .75;
                after = f >= .75;
                gap = null;
                if (over) x.classList.add("ro-on");
                else {
                  const rows = lotRows(), ix = rows.findIndex(o => o.el === x);
                  if (ix < 0) { target = null; break; }   /* ligne de la branche déplacée : pas de dépôt */
                  const pv = after ? rows[ix] : rows[ix - 1], nx = after ? rows[ix + 1] : rows[ix];
                  let D, Dmin, Dmax, inStart = false;
                  if (!pv) { D = Dmin = Dmax = 0; }
                  else if (pv.kids && !pv.folded) { inStart = true; D = Dmin = Dmax = pv.segs.length; }
                  else {
                    Dmax = pv.kids ? pv.segs.length : pv.segs.length - 1;
                    Dmin = nx ? Math.min(Dmax, nx.segs.length - 1) : 0;
                    D = Math.max(Dmin, Math.min(Dmax, Dmax + Math.round((e.clientX - x0) / 28)));
                  }
                  gap = { prev: pv ? pv.segs : null, D, inStart, el: pv ? pv.el : x };
                  let l = document.getElementById("roLine");
                  if (!l) { l = document.createElement("div"); l.id = "roLine"; document.body.appendChild(l); }
                  const ref = pv || rows[ix], li = ref.el.querySelector(".lot-in") || ref.el, ip = li.getBoundingClientRect(), cr = ref.el.getBoundingClientRect();
                  const left = ip.left - (parseFloat(getComputedStyle(li).marginLeft) || 0) + D * 16;
                  l.style.cssText = `position:fixed;z-index:10060;pointer-events:none;height:3px;border-radius:2px;background:var(--inst,#12355b);left:${left}px;width:${Math.max(20, cr.right - left)}px;top:${(after ? r.bottom : r.top) - 1.5}px`;
                }
              } else if (k === "sec" && !el.classList.contains("act-grp")) {
                /* v664 (axe 9) : milieu = superposer (titre commun) ; haut / bas = avant / après (prend le titre de la ligne visée) */
                const f = (e.clientY - r.top) / (r.height || 1);
                over = f > .25 && f < .75;
                after = f >= .75;
                if (over) x.classList.add("ro-on");
                else {
                  let l = document.getElementById("roLine");
                  if (!l) { l = document.createElement("div"); l.id = "roLine"; document.body.appendChild(l); }
                  l.style.cssText = `position:fixed;z-index:10060;pointer-events:none;height:3px;border-radius:2px;background:var(--inst,#12355b);left:${r.left}px;width:${r.width}px;top:${(after ? r.bottom : r.top) - 1.5}px`;
                }
              } else {
                /* déplacement simple : un seul trait à l'endroit du dépôt */
                after = e.clientY > (r.top + r.bottom) / 2;
                let l = document.getElementById("roLine");
                if (!l) { l = document.createElement("div"); l.id = "roLine"; document.body.appendChild(l); }
                l.style.cssText = `position:fixed;z-index:10060;pointer-events:none;height:3px;border-radius:2px;background:var(--inst,#12355b);left:${r.left}px;width:${r.width}px;top:${(after ? r.bottom : r.top) - 1.5}px`;
              }
            }
            break;
          }
        }
      };
      const end = drop => {
        clearTimeout(timer);
        if (shell.__gnRefresh) { shell.__gnRefresh = false; setTimeout(() => refreshAll(), 0); }
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", cancel);
        setTimeout(() => document.removeEventListener("touchmove", tm), 0);
        clear();
        el.classList.remove("ro-src");
        shell.querySelectorAll(".ro-src").forEach(x => x.classList.remove("ro-src"));
        document.body.classList.remove("svi-dragging");
        try { window.getSelection && window.getSelection().removeAllRanges(); } catch (e) {}
        shell.__insDragging = false;
        if (!on) {
          /* simple toucher sur une case : saisie normale */
          if (drop && !moved && tapFocus) {
            tapFocus.closest("td.ins-tdv")?.classList.add("ins-ed");
            tapFocus.focus();
            try { const n = tapFocus.value.length; tapFocus.setSelectionRange(n, n); } catch (e) {}
          }
          return;
        }
        const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
        shell.addEventListener("click", stop, { capture: true, once: true });
        setTimeout(() => shell.removeEventListener("click", stop, { capture: true }), 350);
        if (!drop || !target) return;
        /* v525 (remarque 5) : titre de niveau déplacé = toute sa branche */
        if (k === "lot" && el.classList.contains("lot-grp")) { if (!over && gap) lotDrop("@" + el.dataset.path, gap.el, "gap", gap); else if (over) lotDrop("@" + el.dataset.path, target, "on"); return; }
        const arr = X.INS[k];
        const i0 = arr.findIndex(r => r.id === el.dataset.iid);
        if (i0 < 0) return;
        /* bloc déplacé : la ligne, ou le titre avec ses lignes */
        let n = 1;
        if (k === "des" && arr[i0].t) {
          while (i0 + n < arr.length && (Number(arr[i0 + n].d) || 0) > (Number(arr[i0].d) || 0)) n++;
        }
        let blockIds = arr.slice(i0, i0 + n).map(r => r.id);
        /* ligne cochée : toutes les lignes cochées du bloc se déplacent ensemble (dans leur ordre) */
        const sel = insSelIds(k);
        if (sel.has(arr[i0].id) && sel.size > 1) blockIds = arr.filter(r => sel.has(r.id)).map(r => r.id);
        if (blockIds.includes(target.dataset.iid)) return;
        if (k === "des") { desDrop(arr, blockIds, target.dataset.iid, over ? "on" : after ? (inside ? "afterIn" : "after") : "before", over || !after ? null : outD); return; }
        if (k === "lot") { if (!over && gap) lotDrop(el.dataset.iid, gap.el, "gap", gap); else if (over) lotDrop(el.dataset.iid, target, "on"); return; }
        const bset = new Set(blockIds);
        const block = arr.filter(r => bset.has(r.id));
        /* v664 (axe 9) : titre des activités secondaires — superposer = titre commun (celui de la ligne visée, sinon un nouveau « TITRE n ») ;
           avant / après = le titre de la ligne visée (aucun titre si elle n'en a pas) */
        let actT = null;
        if (k === "sec") {
          const tg = arr.find(r => r.id === target.dataset.iid);
          const tgG = String((tg && tg.g) || "").trim();
          actT = over ? (tgG || actNextTitle()) : tgG;
          if (over && tg && !tgG) tg.g = actT;
          block.forEach(r => { if (actT) r.g = actT; else delete r.g; });
          if (over) after = true;
        }
        arr.splice(0, arr.length, ...arr.filter(r => !bset.has(r.id)));
        let j = arr.findIndex(r => r.id === target.dataset.iid);
        if (after) j++;
        arr.splice(j, 0, ...block);
        if (k === "sec") { dlyPlanFromTasks("sec"); renderTab(); }
        X.insSave();
        histLog(k === "des" ? "DÉSIGNATIONS CLIENT" : k === "chg" ? "DÉTAIL CHARGES" : k === "prd" ? "DÉTAIL PRODUITS" : "TÂCHES",
          k === "sec" && over ? "TITRE D'ACTIVITÉS" : "ORDRE DES LIGNES", String(block[0].des || block[0].v || block[0].art || "") + (k === "sec" && over ? " → " + actT : ""));
        if (k === "sec") { X.insRedraw("prim"); X.insRedraw("sec"); refreshAll(); return; }
        X.insRedraw(k);
      };
      const up = () => end(true);
      const cancel = () => end(false);
      document.addEventListener("pointermove", move, { passive: false });
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", cancel);
    };
    /* iPad : l'appui sur une case non active ne lance ni la loupe ni le clavier ;
       le simple toucher la rend active (ci-dessus), l'appui long glisse la ligne */
    if (!shell.__insTouch) {
      shell.__insTouch = true;
      /* plus de blocage du toucher : il empêchait de faire défiler la page en partant d'une case.
         La loupe est évitée par le style (pas de sélection sur une case non active). */
    }

    shell.onpointerdown = event => {
      /* mode LIAISONS : la poignée d'en-tête règle la largeur des blocs TÂCHES */
      /* mode LIAISONS : poignée du bas = hauteur du bloc (mémorisée) */
      const lkH = event.target.closest(".lk-hrsz");
      if (lkH) {
        event.preventDefault(); event.stopPropagation();
        const k = lkH.dataset.lkh, box = $("insLinkView");
        const ref = lkH.parentElement.querySelector(k === "hier" ? ".lk-col" : ".lk-scroll");
        const y0 = event.clientY, h0 = ref ? ref.getBoundingClientRect().height : 170;
        let h = h0;
        lkH.classList.add("on");
        const mv = ev => { h = Math.max(80, Math.round(h0 + ev.clientY - y0)); box.style.setProperty("--lkh-" + k, h + "px"); };
        const up = () => {
          lkH.classList.remove("on");
          document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
          try { const H = JSON.parse(localStorage.getItem("svi_lkh_v1") || "{}"); H[k] = h; localStorage.setItem("svi_lkh_v1", JSON.stringify(H)); } catch (e) {}
        };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
        return;
      }
      const lkRs = event.target.closest(".lk-col .lk-rs");
      if (lkRs) {
        event.preventDefault(); event.stopPropagation();
        const grid = lkRs.closest(".lk-grid");
        const colsEl = [...grid.querySelectorAll(".lk-col")];
        const i = colsEl.indexOf(lkRs.closest(".lk-col"));
        const ws = colsEl.map(c => c.getBoundingClientRect().width);
        const x0 = event.clientX, w0 = ws[i];
        const mv = ev => { ws[i] = Math.max(120, Math.round(w0 + ev.clientX - x0)); grid.style.gridTemplateColumns = ws.map(v => v + "px").join(" "); };
        const up = () => {
          document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
          const all = cwLoad();
          ["lot", "prim", "sec"].forEach((k, j) => { all["lk_hier." + k] = Math.round(ws[j]); });
          cwSave(all);
        };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
        return;
      }
      /* v525 (remarque 5) : un titre de niveau de lot (créé) se glisse aussi, avec ses lots */
      /* v527 (remarque 1) : les lignes du DÉTAIL CHARGES et du DÉTAIL PRODUITS ne se déplacent pas — pas de trait à l'appui long */
      const insEl = INS_EDIT && event.target.closest('.ins-table:not([data-ik="chg"]):not([data-ik="prd"]) tr[data-iid], .ins-hcol .ins-li[data-iid], .ins-hcol .ins-li.lot-grp');
      if (insEl && insEl.classList.contains("lk-ban") && !event.target.closest("input.ins-cb, .ins-t")) {
        const x0 = event.clientX, y0 = event.clientY;
        const tmr = setTimeout(() => { svToast(insEl.dataset.ban || "", 3500, insEl); off(); }, 450);
        const mv = e => { if (Math.abs(e.clientX - x0) > 10 || Math.abs(e.clientY - y0) > 10) off(); };
        const off = () => { clearTimeout(tmr); document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", off); document.removeEventListener("pointercancel", off); };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", off); document.addEventListener("pointercancel", off);
        return;
      }
      if (insEl && !event.target.closest(".ins-t, .ins-cb, .ins-x, .lk-rd, .lk-q, .ins-fold, input[type=checkbox]") &&
          event.target.closest(".ins-in, .lot-gname") !== document.activeElement) { insDrag(event, insEl); return; }
      const rz = event.target.closest(".blk-rsz");
      if (rz) { layResize(event, rz); return; }
      const gp = event.target.closest(".blk-grip");
      if (gp) { layDrag(event, gp); return; }
      const roEl = event.target.closest("#bdgClientBody tr[data-desig], .bdg-h-item[data-h]");
      if (roEl) { roStart(event, roEl); return; }
      const h = event.target.closest(".col-rs");
      if (!h) {
        const th = event.target.closest("th, .bdg-h-head");
        if (th && !event.target.closest(".cf-btn") && th.querySelector(".cf-btn")) coDrag(event, th);
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      const t = h.dataset.rs, key = h.dataset.col;
      const x0 = event.clientX;
      let apply, save;

      if (t === "hier") {
        const grid = $("bdgHier");
        const cols = [...grid.querySelectorAll(".bdg-h-col")];
        const keys = coKeys("hierCols", ["lot", "prim", "sec"]);
        const ws = cols.map(c => c.getBoundingClientRect().width);
        const i = keys.indexOf(key);
        const w0 = ws[i];
        apply = x => {
          ws[i] = Math.max(80, Math.round(w0 + x - x0));
          grid.style.gridTemplateColumns = ws.map(v => v + "px").join(" ");
        };
        save = () => {
          const all = cwLoad();
          keys.forEach((k, j) => { all["hier." + k] = Math.round(ws[j]); });
          cwSave(all);
          histLog("COLONNES", "LARGEUR", t);
        };
      } else {
        const table = h.closest("table");
        /* DÉTAIL DÉLAIS : en-têtes « dlys / dlyp… », colonnes « dly.… » — la colonne est retrouvée par sa clé */
        const col = table.querySelector(`col[data-w="${t}.${key}"]`) || table.querySelector(`col[data-w$=".${key}"]`);
        if (!col) return;
        const wKey = col.dataset.w;
        const w0 = parseFloat(col.style.width) || col.getBoundingClientRect().width;
        let w = w0;
        apply = x => {
          w = Math.max(28, Math.round(w0 + x - x0));   /* v493 (remarque 16) : réduite au maximum */
          col.style.width = w + "px";
          const total = [...table.querySelectorAll("col")]
            .reduce((sum, c) => sum + (parseFloat(c.style.width) || 0), 0);
          table.style.width = total + "px";
        };
        save = () => {
          const all = cwLoad();
          all[wKey] = w;
          cwSave(all);
          histLog("COLONNES", "LARGEUR", t);
        };
      }

      h.classList.add("on");
      const move = e => apply(e.clientX);
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        h.classList.remove("on");
        save();
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    };

