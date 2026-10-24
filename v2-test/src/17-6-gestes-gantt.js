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
