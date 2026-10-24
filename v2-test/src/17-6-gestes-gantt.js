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
        ln.__drag = true;
        let iso = R0[ln.dataset.r] || "", edge = "";
        const tmv = ev => ev.preventDefault();
        document.addEventListener("touchmove", tmv, { passive: false });
        /* v575 (remarque 8) : deux états — au repos (collé au bord visible, sans effet) ; touché ou glissé dans la partie visible = posé,
           même sur le dernier jour visible ; il ne revient au repos que tiré au-delà du bord visible du Gantt */
        let moved = false;
        const mv = ev => {
          ev.preventDefault();
          moved = true;
          const x = ev.clientX - h.getBoundingClientRect().left, hr = host.getBoundingClientRect();
          edge = ev.clientX < hr.left + 2 || x <= 0 ? "l" : ev.clientX > hr.right - 2 || x >= W ? "r" : "";
          iso = edge ? "" : sviIsoAdd(host.__d0, Math.max(0, Math.floor(x / DLY_DW)));
          ln.style.left = Math.max(0, Math.min(W, x)) + "px"; ln.classList.toggle("grng-off", !!edge);
          const lab = other && iso && (ln.dataset.r === "a" ? iso > other : iso < other) ? (ln.dataset.r === "a" ? "FIN" : "DÉBUT") : (ln.dataset.r === "a" ? "DÉBUT" : "FIN");
          sp.textContent = lab + (iso ? " " + dFr(iso).slice(0, 5) : "");
        };
        const up = () => {
          document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
          setTimeout(() => document.removeEventListener("touchmove", tmv), 0);
          const R = { ...R0 };
          ln.__drag = false;
          /* simple toucher sur un trait au repos = posé au jour où il se trouve (bord de la partie visible) */
          if (!moved) { if (R0[ln.dataset.r]) return; const x = parseFloat(ln.style.left) || 0; iso = sviIsoAdd(host.__d0, Math.max(0, Math.floor((ln.dataset.r === "b" ? Math.max(0, x - 1) : x) / DLY_DW))); edge = ""; }
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
      /* v564 (remarque 6) : appui long sur une courbe = repères en pointillés : horizontal vers l'axe des montants (valeur),
         vertical jusqu'à l'en-tête des dates (jour) ; ils suivent le doigt tant qu'il reste posé, et restent affichés au lâcher.
         v576 (remarques 4 et 5) : repères de la couleur de la courbe choisie ; un nouveau toucher au même endroit passe à la courbe suivante */
      const dlyXClear = () => { document.querySelectorAll(".dlyx-v, .dlyx-h, .dlyx-pt, .dlyx-l").forEach(x => x.remove()); };
      const dlyXSeries = (host, H, HV) => {
        const out = [];
        const add = (lab, M, c, s, u) => { if (M && Object.keys(M).length) out.push({ lab, M, c, s, u }); };
        if (!HV.hideC && (!HV.multi || (H.crb || []).includes("c"))) add("CHARGES", HV.val, "#f79009", 0, HV.unit);
        if (HV.multi && (H.crb || []).includes("p")) add("PRODUITS", HV.vP, "#2e90fa", 0, HV.unit);
        if (HV.multi && (H.crb || []).includes("g")) add("MARGE", HV.vG, "#12b76a", 0, HV.unit);
        if (HV.rd) {
          if (HV.rd.PQs) add("PRODUIT", HV.rd.PQ, "#2e90fa", HV.rd.PQs, HV.rd.u);
          (HV.rd.S || []).forEach(s => add("RENDEMENT " + s.name, s.R, s.c, s.s, HV.rd.u + " / " + s.u));
        }
        return out;
      };
      const dlyXFmt = v => { const a = Math.abs(v), f = (x, u) => (Math.round(x * 10) / 10).toLocaleString("fr-FR") + " " + u; return a >= 1e9 ? f(v / 1e9, "G") : a >= 1e6 ? f(v / 1e6, "M") : a >= 1e4 ? f(v / 1e3, "K") : (Math.round(v * 100) / 100).toLocaleString("fr-FR"); };
      const dlyXDraw = (host, h, cx, cy, step) => {
        const HV = host.__HV || {}, H = host.__HD || {}, S = dlyXSeries(host, H, HV);
        const hr = h.getBoundingClientRect(), Y0 = Number(h.dataset.y0) || hr.height, sc = Number(h.dataset.sc) || 1;
        const i = Math.max(0, Math.floor((cx - hr.left) / DLY_DW)), di = sviIsoAdd(host.__d0, i);
        /* courbes de ce jour, de la plus proche du doigt à la plus loin */
        const C = S.map(x => { const v = x.M[di]; return v === undefined || v === null ? null : { ...x, v, y: hr.top + Y0 - v * (x.s || sc) }; }).filter(Boolean).sort((a, b) => Math.abs(a.y - cy) - Math.abs(b.y - cy));
        if (!C.length) return;
        const k = step ? ((shell.__dlyX && shell.__dlyX.i === i ? shell.__dlyX.k : 0) + step) % C.length : 0, best = C[k];
        dlyXClear();
        const mk = (c) => { const d = document.createElement("div"); d.className = c; document.body.appendChild(d); return d; };
        const px = hr.left + i * DLY_DW + DLY_DW / 2, gh = document.querySelector("#bdgTabBody > .gh-fix") || host.querySelector(".gh"), top = gh ? gh.getBoundingClientRect().bottom : hr.top;
        const ax = Math.max(hr.left, host.getBoundingClientRect().left);
        const v = mk("dlyx-v"); v.style.left = px + "px"; v.style.top = top + "px"; v.style.height = Math.max(0, best.y - top) + "px"; v.style.borderLeftColor = best.c;
        const hz = mk("dlyx-h"); hz.style.left = ax + "px"; hz.style.top = best.y + "px"; hz.style.width = Math.max(0, px - ax) + "px"; hz.style.borderTopColor = best.c;
        const p = mk("dlyx-pt"); p.style.left = px + "px"; p.style.top = best.y + "px"; p.style.borderColor = best.c;
        const ld = mk("dlyx-l"); ld.textContent = dFr(di); ld.style.left = (px - ld.offsetWidth / 2) + "px"; ld.style.top = (top + 2) + "px"; ld.style.background = best.c;
        const lv = mk("dlyx-l"); lv.textContent = (S.length > 1 ? best.lab + " " : "") + dlyXFmt(best.v) + " " + (best.u || "DH") + (C.length > 1 ? "  (" + (k + 1) + "/" + C.length + ")" : ""); lv.style.left = (ax + 4) + "px"; lv.style.top = (best.y - lv.offsetHeight - 3) + "px"; lv.style.background = best.c;
        shell.__dlyX = { host, h, i, k, cy, px, y: best.y };
      };
      /* v566 (remarque 8) : un toucher ailleurs efface les repères ; v576 : un toucher sur le point des repères passe à la courbe suivante */
      document.addEventListener("pointerdown", e => {
        const X0 = shell.__dlyX;
        if (X0 && X0.host.isConnected && document.querySelector(".dlyx-pt") && Math.abs(e.clientX - X0.px) < 30 && Math.abs(e.clientY - X0.y) < 30) {
          e.stopPropagation(); e.preventDefault();
          X0.host.__dlyXlp = true; setTimeout(() => { X0.host.__dlyXlp = false; }, 450);
          dlyXDraw(X0.host, X0.h, X0.px, X0.cy, 1);
          return;
        }
        dlyXClear(); shell.__dlyX = null;
      }, true);
      shell.addEventListener("pointerdown", e => {
        const hit = e.target.closest && e.target.closest("#dlyGantt .ghist-cum .ghb-hit");
        if (!hit) return;
        const host = hit.closest("#dlyGantt"), h = hit.closest(".ghist"), HV = host.__HV || {};
        if (!HV.curve && !HV.hideC) return;
        let on = false; const x0 = e.clientX, y0 = e.clientY;
        const tmv = ev => { if (on) ev.preventDefault(); };
        const tm = setTimeout(() => { on = true; host.__dlyXlp = true; dlyXDraw(host, h, x0, y0, 0); }, 450);
        const mv = ev => { if (!on) { if (Math.abs(ev.clientX - x0) > 8 || Math.abs(ev.clientY - y0) > 8) end(); return; } ev.preventDefault(); dlyXDraw(host, h, ev.clientX, ev.clientY, 0); };
        const end = () => { clearTimeout(tm); document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", end); document.removeEventListener("pointercancel", end); setTimeout(() => document.removeEventListener("touchmove", tmv), 0); if (on) setTimeout(() => { host.__dlyXlp = false; }, 400); };
        document.addEventListener("touchmove", tmv, { passive: false });
        document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", end); document.addEventListener("pointercancel", end);
      });
      /* v568 (remarque 12) : toucher l'axe des montants = afficher / cacher la RÈGLE ; la règle se tire au doigt (valeur affichée) */
      shell.addEventListener("click", e => {
        const a = e.target.closest && e.target.closest("#dlyGantt .gax-hit");
        if (!a) return;
        e.stopPropagation();
        /* v584 : toucher l'axe = faire apparaître la règle (l'appui long sur la ligne la fait disparaître) */
        /* v588 : la règle apparaît (ou se pose) à la hauteur touchée */
        const h = a.closest(".ghist"), sc = Number(h.dataset.sc) || 1, Y0 = Number(h.dataset.y0) || h.offsetHeight;
        shell.__dlyRule = true; shell.__dlyRuleV = (Y0 - (e.clientY - h.getBoundingClientRect().top)) / sc;
        const host = a.closest("#dlyGantt"); host.__drawn = false; dlyGanttDraw();
      }, true);
      shell.addEventListener("pointerdown", e => {
        const ln = e.target.closest && e.target.closest("#dlyGantt .grule");
        if (!ln) return;
        e.preventDefault(); e.stopPropagation();
        const h = ln.closest(".ghist"), sc = Number(h.dataset.sc) || 1, Y0 = Number(h.dataset.y0) || h.offsetHeight, sp = ln.querySelector("span");
        const fmt = v => { const a = Math.abs(v), f = (x, u) => (Math.round(x * 10) / 10).toLocaleString("fr-FR") + " " + u; return a >= 1e9 ? f(v / 1e9, "G") : a >= 1e6 ? f(v / 1e6, "M") : a >= 1e4 ? f(v / 1e3, "K") : (Math.round(v * 100) / 100).toLocaleString("fr-FR"); };
        const tmv = ev => ev.preventDefault();
        document.addEventListener("touchmove", tmv, { passive: false });
        /* v577 (remarque 6) : la règle s'aimante sur les valeurs rondes (10 K, 11 K, 12 K…) : petit arrêt ; en continuant à tirer, elle se détache */
        const stp = Number(h.dataset.stp) || 0, p10 = stp ? Math.pow(10, Math.floor(Math.log10(stp))) : 0, fine = p10 ? (stp / p10 <= 1.0001 ? p10 / 10 : p10) : 0;
        const x0 = e.clientX, y0 = e.clientY;
        const lp = setTimeout(() => { up(); shell.__dlyRule = false; shell.__dlyRuleV = null; const host = h.closest("#dlyGantt"); if (host) { host.__drawn = false; dlyGanttDraw(); } }, 550);
        const mv = ev => { ev.preventDefault(); if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return; clearTimeout(lp); let y = Math.max(4, Math.min(Y0, ev.clientY - h.getBoundingClientRect().top)); let v = (Y0 - y) / sc;
          let snap = false;
          if (fine > 0) { const r = Math.round(v / fine) * fine, yr = Y0 - r * sc; if (Math.abs(yr - y) <= 7) { v = r; y = yr; snap = true; } }
          shell.__dlyRuleV = v; ln.style.top = y + "px"; sp.textContent = fmt(v); ln.classList.toggle("grule-snap", snap); };
        const up = () => { clearTimeout(lp); document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up); setTimeout(() => document.removeEventListener("touchmove", tmv), 0); };
        document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
      });
      /* R8 : toucher une barre de l'histogramme = bulle des tâches de ce jour (répartition, fractions comprises) */
      shell.addEventListener("click", e => {
        { const hh = e.target.closest && e.target.closest("#dlyGantt"); if (hh && hh.__dlyXlp) return; }   /* v564 : pas de bulle après un appui long (repères) */
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
          const L = [["CHARGES", HV.val], ["PRODUITS", HV.vP], ["MARGE", HV.vG]].filter(x => x[1] && Object.keys(x[1]).length && (x[0] === "CHARGES" ? !HV.hideC && (!HV.multi || (H.crb || []).includes("c")) : (H.crb || []).includes(x[0] === "PRODUITS" ? "p" : "g")));
          m.innerHTML = `<button type="button" class="svt-x" aria-label="Fermer">✕</button><div class="hb-t">${esc(dFr(di))}${HV.cum ? " — CUMUL À CE JOUR" : ""}</div>` + L.map(([t, M]) => `<div><span>${t}</span><b>${fmt(M[di] || 0)} ${esc(HV.unit)}</b></div>`).join("") + dlyRdHb(HV, di) + dlyGoHb(H, di);
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
        m.innerHTML = `<button type="button" class="svt-x" aria-label="Fermer">✕</button><div class="hb-t">${esc(dFr(di))}</div>${rows}<div class="hb-tot"><span>TOTAL (${esc(H.cmd ? "COMMANDE" : H.unit)})</span><b>${fmt(tot)}</b></div>${dlyRdHb(HV, di)}${H.cmd ? "" : dlyGoHb(H, di)}`;
        document.body.appendChild(m);
        const r = b.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
        m.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.left + r.width / 2 - mw / 2)) + "px";
        m.style.top = Math.max(8, r.top - mh - 6) + "px";
        m.addEventListener("click", ev => { if (ev.target.closest(".svt-x")) m.remove(); ev.stopPropagation(); });
      });
      /* v567 (remarque 10) : bulle — rendement du jour, et pour chaque tâche du jour : CHARGES / PRODUITS / DÉLAIS
         (la tâche est choisie par les ronds, l'onglet s'ouvre sur ses lignes surlignées) */
      const dlyRdHb = (HV, di) => { const R = HV && HV.rd; if (!R) return ""; const f = v => (Math.round(v * 100) / 100).toLocaleString("fr-FR");
        return `<div class="hb-rd"><span>PRODUIT</span><b>${f(R.PQ[di] || 0)} ${esc(R.u)}</b></div>` + (R.S || []).map(s => `<div class="hb-rd" style="color:${s.c}"><span>RENDEMENT ${esc(s.name)}</span><b>${s.R[di] === null || s.R[di] === undefined ? "—" : f(s.R[di]) + " " + esc(R.u) + " / " + esc(s.u)}</b></div>`).join(""); };
      /* v574 : nom de la tâche pris dans la ligne du PLANNING (lot et activité tels qu'affichés), sinon dans les listes */
      const dlyHbName = k => { const x = (shell.__dlyRows || []).find(r => !r.grp && r.key === k); if (x && (x.lot || x.sec)) return (x.lot ? lotLab(dlyLotPath(x.lot)).full : "") + " › " + (x.sec || ""); const [lo, se] = k.split("|"); return (lkName("lot", lo) || lo) + " › " + (lkName("sec", se) || se); };
      const dlyGoHb = (H, di) => { const K = [...new Set((H.det && H.det[di] || []).map(x => x.k))]; if (!K.length) return "";
        return `<div class="hb-gos">` + K.map(k => `<div class="hb-go"><span>${esc(dlyHbName(k))}</span>${[["chg", "CHARGES"], ["prd", "PRODUITS"], ["dly", "DÉLAIS"]].map(([t, l]) => `<button type="button" class="hb-gob" data-go="${t}" data-k="${esc(k)}">${l}</button>`).join("")}</div>`).join("") + `</div>`; };
      document.addEventListener("click", e => {
        const b = e.target.closest && e.target.closest("#dlyHb .hb-gob[data-go]");
        if (!b) return;
        e.stopPropagation(); document.getElementById("dlyHb")?.remove();
        const [lo, se] = b.dataset.k.split("|");
        LK.lot = lo; LK.sec = se; LK.prim = null;
        const tb = document.querySelector(`.bdg-d-tab[data-tab="${b.dataset.go}"]`);
        if (tb && active !== b.dataset.go) tb.click(); else refreshAll();
        setTimeout(() => { const r = document.querySelector("#bdgTabBody tr.lk-hit, #bdgTabBody tr.lk-link.lk-hit, #bdgTabBody tr.dly-sel"); if (r) r.scrollIntoView({ block: "center" }); }, 350);
      }, true);
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
        const g = pill.closest(".dlyg"), hist = g.querySelector("#dlyGantt .ghist"), y0 = e.clientY;
        let h0 = hist ? hist.offsetHeight : 110;
        /* v545 (remarque 4) : la poignée reste où on la lâche — hauteur la plus grande = du bas de l'écran visible jusque sous l'en-tête du Gantt */
        const scr = g.closest(".bdg-d-scroll"), ghd = g.querySelector("#dlyGantt > .gh"), hr0 = hist ? hist.getBoundingClientRect() : null;
        const visB = Math.min(scr ? scr.getBoundingClientRect().bottom : 1e9, dlyVpB());
        const maxH = hr0 && ghd ? Math.max(80, Math.floor(visB - ghd.getBoundingClientRect().bottom - 4)) : (scr ? Math.max(120, scr.clientHeight - 60) : 600);
        const bar = pill.closest(".dlyg-hh");
        /* v583 : la poignée suit le doigt dès le premier mouvement (hauteur de départ bornée à la plus grande, décalage sous l'en-tête repris) */
        const tr = /translateY\((-?[\d.]+)px\)/.exec(bar.style.transform || ""), dn = tr ? +tr[1] : 0;
        if (dn) { bar.style.transform = ""; bar.style.top = ((parseFloat(bar.style.top) || 0) + dn) + "px"; }
        const t0 = parseFloat(bar.style.top) || 0;
        h0 = Math.min(h0, maxH);
        let h = h0, on = false;
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
