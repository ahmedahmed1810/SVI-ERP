    /* ===== INF : dates du projet (v452) — DÉBUT (modifiable : tout le planning se décale), FIN et DURÉE calculées,
       DATE OBJECTIF et DATE BUTOIR (déplacées depuis PARAMÉTRAGE) ===== */
    /* ===== INF (v457) : DÉBUT* (modifiable : tout le planning se décale), FIN DU PROJET* (= date objectif), DURÉE (calculée,
       jours du calendrier, en années / mois / jours), DATE BUTOIR* ; DATE CRÉATION* (date, heure) et PROJET* modifiables en instance ===== */
    const infProj = () => {
      const ks = dlyKeys().filter(k => dlyDeb(k) && dlyFin(k));
      const deb = INS.pdeb || ks.map(dlyDeb).sort()[0] || INS.gdeb || "", pfin = ks.map(dlyFin).sort().pop() || "";
      /* v546 (R30) : DATE DE FIN DU PROJET = fin du planning (plus de date objectif saisie) */
      return { ks, deb, pfin, fin: pfin };
    };
    /* durée en jours du calendrier, début et fin compris : « 1 AN 2 MOIS 20 JOURS » */
    const infYMD = (a, b) => {
      if (!a || !b || b < a) return "";
      const D = x => new Date(x + "T12:00:00");
      const end = D(b); end.setDate(end.getDate() + 1);
      let y = 0, m = 0, c = D(a);
      const add = (d, yy, mm) => { const n = new Date(d); n.setFullYear(n.getFullYear() + yy); n.setMonth(n.getMonth() + mm); return n; };
      while (add(c, 1, 0) <= end) { c = add(c, 1, 0); y++; }
      while (add(c, 0, 1) <= end) { c = add(c, 0, 1); m++; }
      const d = Math.round((end - c) / 86400000);
      return [y ? y + (y > 1 ? " ANS" : " AN") : "", m ? m + " MOIS" : "", d ? d + (d > 1 ? " JOURS" : " JOUR") : ""].filter(Boolean).join(" ") || "0 JOUR";
    };
    const STAR = ' <b class="req-star">*</b>';
    const infDatesHTML = ed => {
      const P = infProj();
      const din = (f, v, extra = "") => ed ? `<input class="doc-in inf-date" type="date" data-f="${f}" value="${esc(v)}"${extra}>` : `<span class="doc-in doc-ro inf-val">${esc(dFr(v))}</span>`;
      return `<span class="doc-lab">DATE DE DÉBUT DU PROJET${STAR}</span>${din("deb", P.deb)}
        <span class="doc-lab">DATE DE FIN DU PROJET<small class="inf-sub">(FIN DU PLANNING)</small></span><span class="inf-cell"><span class="doc-in doc-ro inf-val" data-v="pfin0">${esc(dFr(P.fin))}</span><small class="inf-sub" data-v="pfin"></small></span>
        <span class="doc-lab">DURÉE</span><span class="doc-in doc-ro inf-val" data-v="dur">${esc(infYMD(P.deb, P.fin))}</span>
        <span class="doc-lab">DATE BUTOIR${STAR}</span>${din("but", INS.dbut || "")}`;
    };
    /* v477 (remarque 5) : rien n'est retenu avant ENREGISTRER — les dates saisies vont dans pend, appliquées par infApply */
    const infDatesBind = (p, ed, pend) => {
      const cur = () => { const P = infProj(); return { deb: pend.deb ?? P.deb, fin: pend.obj ?? P.fin, but: pend.but ?? (INS.dbut || ""), pfin: P.pfin }; };
      const paint = () => {
        const P = cur();
        const d = p.querySelector('[data-v="dur"]'), pf = p.querySelector('[data-v="pfin"]');
        if (d) d.textContent = infYMD(P.deb, P.fin);
        if (pf) { pf.textContent = P.pfin && P.but && P.pfin > P.but ? "DÉPASSE LA DATE BUTOIR" : ""; pf.classList.toggle("inf-late", !!(P.pfin && ((P.but && P.pfin > P.but) || (P.fin && P.pfin > P.fin)))); }
        const io = p.querySelector('[data-f="obj"]'), ib = p.querySelector('[data-f="but"]');
        if (io) { if (P.but) io.setAttribute("max", P.but); else io.removeAttribute("max"); if (P.deb) io.setAttribute("min", P.deb); }
        if (ib) ib.removeAttribute("min");
      };
      paint();
      if (!ed) return;
      p.querySelectorAll("input.inf-date").forEach(sviDateField);
      p.addEventListener("change", e => {
        const i = e.target.closest && e.target.closest("input.inf-date");
        if (!i) return;
        pend[i.dataset.f] = i.value;
        paint();
      });
    };
    /* applique les dates d'INF (ENREGISTRER) : DÉBUT décale tout le planning, FIN DU PROJET (objectif), BUTOIR */
    const infApplyDates = (pend, anchor) => {
      if (pend.obj !== undefined && pend.obj !== (INS.dobj || "")) { INS.dobj = pend.obj; histLog("INF", "DATE DE FIN DU PROJET (OBJECTIF)", dFr(pend.obj) || "—"); }
      if (pend.but !== undefined && pend.but !== (INS.dbut || "")) { INS.dbut = pend.but; histLog("INF", "DATE BUTOIR", dFr(pend.but) || "—"); }
      if (pend.deb !== undefined && pend.deb) {
        const cal = insCal(), P = infProj(), v = pend.deb;
        const nv = sviWNear(cal, v, 1);
        const old = P.ks.map(dlyDeb).sort()[0] || P.deb;
        if (nv !== (INS.pdeb || "")) {
          INS.pdeb = nv; INS.gdeb = nv;
          if (P.ks.length && old && nv !== sviWNear(cal, old, 1)) {
            const from = sviWNear(cal, old, 1);
            const n = nv > from ? sviWDur(cal, from, nv) - 1 : -(sviWDur(cal, nv, from) - 1);
            P.ks.forEach(k => {
              (INS.dlp[k] || []).forEach(q => { if (!q.deb || !q.fin) return; const du = sviWDur(cal, q.deb, q.fin) || 1; q.deb = sviWAdd(cal, sviWNear(cal, q.deb, 1), n); q.fin = sviWFin(cal, q.deb, du); });
              if (LK.dlpDraft && LK.dlpDraft[k]) delete LK.dlpDraft[k];
            });
            histLog("INF", "PROJET DÉCALÉ", dFr(old) + " → " + dFr(nv) + " (" + (n > 0 ? "+" : "") + n + " J TRAVAILLÉS, " + P.ks.length + " TÂCHE(S))");
          } else histLog("INF", "DATE DE DÉBUT DU PROJET", dFr(nv));
          const P2 = infProj();
          if (INS.dbut && P2.pfin > INS.dbut) svToast("AVEC CE DÉCALAGE, LA FIN DU PLANNING (" + dFr(P2.pfin) + ") DÉPASSE LA DATE BUTOIR (" + dFr(INS.dbut) + ").", 6000, anchor);
        }
      }
    };
    /* champs d'INF à compléter (bouton ⚠ et FIGER) : étoile = exigé pour FIGER */
    const infMissing = () => {
      if (!INS) return [];
      const P = infProj(), out = [];
      const add = (lab, req) => out.push({ lab: "INF : " + lab, n: 1, go: "inf", req });
      if (!String(budget.project || "").trim()) add("PROJET", true);
      if (!budget.inst.created) add("DATE CRÉATION", true);
      if (!P.deb) add("DATE DE DÉBUT DU PROJET", true);
      /* v546 (R30) : DATE DE FIN DU PROJET calculée — n'est plus exigée */
      if (!INS.dbut) add("DATE BUTOIR", true);
      const it = String(budget.inst.intitule || "").trim();
      if (!it || it === "À COMPLÉTER") add("INTITULÉ", false);
      if (!String(budget.inst.client || "").trim()) add("CLIENT", false);
      return out;
    };
    const openInfo = () => {
      const dt = typeof budgetDate === "function" ? budgetDate(ref) : null;
      const prd = lines.filter(l => l.kind === "prd");
      const chg = lines.filter(l => l.kind === "chg");
      const sum = (arr, f) => arr.reduce((t, l) => t + (f(l) || 0), 0);
      const prdHT = sum(prd, l => l.amount), prdTTC = sum(prd, l => l.ttcAmount);
      const chgHT = sum(chg, l => l.amount), chgTTC = sum(chg, l => l.ttcAmount);
      const marge = prdHT - chgHT;
      const desig = new Set(lines.map(l => desigKey(l))).size;
      const taf = recLoad("taf");
      const obs = recLoad("obs");
      const items = [
        ["DATE CRÉATION", budget.inst && budget.inst.created ? String(budget.inst.created).replace(/^(\d{4})-(\d{2})-(\d{2})T?(\d{2}:\d{2})?.*$/, (m0, y, mo, d, h) => d + "/" + mo + "/" + y + (h ? " À " + h : "")) : (dt && dt.label) || ""],
        ["PROJET", budget.project],
        ["INTITULÉ", sviIntitule(ref, budget.project, budget.inst)],
        ["CLIENT", sviClient(budget.inst)],
      ];
      /* budget en instance : l'INTITULÉ se saisit ici (repris dans les listes, exports et aperçus) */
      const editInt = !!(budget.inst && (budget.inst.state || "instance") === "instance");
      document.getElementById("docPop")?.remove();
      const p = document.createElement("div");
      p.id = "docPop";
      p.innerHTML = `
        <div class="doc-card" role="dialog" aria-modal="true">
          <div class="doc-head">
            <span class="doc-title">INF ${esc(fullRef)}</span>
            <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
          </div>
          <div class="doc-body">
            <div class="doc-grid inf-grid">
              ${items.map(([k, v]) => `
                <span class="doc-lab">${esc(k)}${INS && (k === "DATE CRÉATION" || k === "PROJET") ? STAR : ""}</span>
                ${k === "DATE CRÉATION" && editInt
                  ? `<span class="inf-cell inf-dt"><input class="doc-in inf-cre" type="date" value="${esc(String(budget.inst.created || "").slice(0, 10) || ((dt && dt.key) || ""))}"><input class="doc-in inf-cre-h" type="time" value="${esc(String(budget.inst.created || "").slice(11, 16))}"></span>`
                  : k === "PROJET" && editInt
                  ? `<input class="doc-in inf-int" id="infPrj" value="${esc(v || "")}" autocomplete="off">`
                  : (k === "INTITULÉ" || k === "CLIENT") && editInt
                  ? `<input class="doc-in inf-int" id="${k === "CLIENT" ? "infCli" : "infInt"}" value="${esc(v === "À COMPLÉTER" ? "" : v)}" placeholder="À COMPLÉTER" autocomplete="off">`
                  : `<span class="doc-in doc-ro inf-val">${esc(v)}</span>`}`).join("")}
              ${INS ? infDatesHTML(editInt) : ""}
            </div>
          </div>
          <div class="doc-foot">
            ${editInt ? `<button type="button" class="doc-btn" data-cancel>FERMER</button><button type="button" class="doc-btn doc-save inf-save">ENREGISTRER</button>` : `<button type="button" class="doc-btn doc-save" data-cancel>FERMER</button>`}
          </div>
        </div>`;
      document.body.appendChild(p);
      popEnhance(p, "inf");
      /* v477 (remarque 5) : tout est modifiable en instance ; rien n'est retenu avant ENREGISTRER */
      const pend = {};
      if (INS) infDatesBind(p, editInt, pend);
      p.querySelectorAll("#infInt, #infCli, #infPrj").forEach(i => i.addEventListener("input", e => { const c = e.target.selectionStart; e.target.value = e.target.value.toUpperCase(); try { e.target.setSelectionRange(c, c); } catch (err) {} }));
      const cd = p.querySelector("input.inf-cre"), chh = p.querySelector("input.inf-cre-h");
      if (cd) sviDateField(cd);
      const collect = () => {
        const out = { ...pend };
        const pj = p.querySelector("#infPrj"); if (pj) out.project = pj.value.trim().toUpperCase().replace(/\s+/g, " ");
        const ii = p.querySelector("#infInt"); if (ii) out.intitule = ii.value.trim().toUpperCase();
        const ic = p.querySelector("#infCli"); if (ic) out.client = ic.value.trim().toUpperCase();
        if (cd) out.created = (cd.value || "") + (cd.value ? "T" + ((chh && chh.value) || "00:00") : "");
        return out;
      };
      const changed = o => (o.project !== undefined && o.project !== String(budget.project || ""))
        || (o.intitule !== undefined && o.intitule !== String(budget.inst.intitule === "À COMPLÉTER" ? "" : budget.inst.intitule || "").trim().toUpperCase())
        || (o.client !== undefined && o.client !== String(budget.inst.client || "").trim().toUpperCase())
        || (o.created !== undefined && o.created && o.created !== String(budget.inst.created || ""))
        || ["deb", "obj", "but"].some(f => o[f] !== undefined);
      const save = () => {
        const o = collect();
        if (o.project !== undefined && !o.project) { svToast("PROJET OBLIGATOIRE.", 3000, p.querySelector("#infPrj")); return false; }
        const patch = {};
        if (o.project !== undefined && o.project !== String(budget.project || "")) {
          budget.project = o.project; budget.inst.project = o.project; patch.project = o.project;
          const h1 = shell.querySelector(".bdg-d-h1"); if (h1) h1.textContent = o.project;
          histLog("INF", "PROJET", o.project);
        }
        if (o.created && o.created !== String(budget.inst.created || "")) { budget.inst.created = o.created; patch.created = o.created; histLog("INF", "DATE CRÉATION", o.created.replace("T", " À ")); }
        [["intitule", "INTITULÉ", "À COMPLÉTER"], ["client", "CLIENT", ""]].forEach(([f, lab, def]) => {
          if (o[f] === undefined || o[f] === String(budget.inst[f] === "À COMPLÉTER" ? "" : budget.inst[f] || "").trim().toUpperCase()) return;
          budget.inst[f] = o[f] || def; patch[f] = budget.inst[f]; histLog("INF", lab, budget.inst[f] || "—");
        });
        if (Object.keys(patch).length) sviInstSet(sviInstGet().map(x => x.ref === ref ? { ...x, ...patch } : x));
        if (INS) { infApplyDates(pend, p.querySelector(".doc-foot")); insSave(); }
        /* partout où l'information est affichée : en-tête, listes, aperçus */
        try { keepScroll(() => refreshAll()); } catch (e) {}
        try { document.title = (budget.project || "") + " " + (fullRef || ""); } catch (e) {}
        return true;
      };
      p.addEventListener("click", async e => {
        if (e.target.closest(".inf-save")) { if (save()) { p.remove(); svToast("ENREGISTRÉ.", 1800); } return; }
        if (!(e.target === p || e.target.closest("[data-cancel]"))) return;
        if (editInt && changed(collect())) {
          const v = await svChoose({ title: "MODIFICATIONS NON ENREGISTRÉES", text: "ENREGISTRER LES MODIFICATIONS D'INF ?", buttons: [{ v: "drop", label: "ABANDONNER", tone: "danger" }, { v: "save", label: "ENREGISTRER", tone: "neutral" }] });
          if (!v) return;
          if (v === "save" && !save()) return;
        }
        p.remove();
      });
    };

    /* fenêtre centrée : observations marquées « ! » */
    const openObsAlert = () => {
      const list = recSorted("obs").filter(r => r.important);
      document.getElementById("docPop")?.remove();
      const p = document.createElement("div");
      p.id = "docPop";
      p.innerHTML = `
        <div class="doc-card" role="dialog" aria-modal="true">
          <div class="doc-head">
            <span class="doc-title">OBSERVATIONS IMPORTANTES — ${esc(fullRef)} ${svCnt(list.length)}</span>
            <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
          </div>
          <div class="doc-body">
            <div class="obs-alert-list">
              ${list.map(r => `
                <div class="obs-alert-item">
                  <span class="obs-alert-meta">⚠ ${esc(r.ref)} — ${esc(fmtDT(r.date))}</span>
                  <span class="obs-alert-text">${esc(r.text)}</span><span class="obs-alert-more">▾</span>
                </div>`).join("") || `<div class="obs-alert-text">Aucune observation importante.</div>`}
            </div>
          </div>
          <div class="doc-foot">
            <button type="button" class="doc-btn doc-save" data-cancel>FERMER</button>
          </div>
        </div>`;
      document.body.appendChild(p);
      popEnhance(p, "alert");
      obsAlertWire(p);
      p.addEventListener("click", e => {
        if (e.target === p || e.target.closest("[data-cancel]")) p.remove();
      });
    };

    /* ouvrir un document gardé sur l'appareil */
    const openDoc = i => {
      const d = docsLoad()[i];
      if (d && !d.idb && !d.data && d.drive) { openGoogleLink(d.drive, window.open("", "_blank")); return; }
      if (d && d.idb) {
        /* fenêtre ouverte tout de suite (sinon bloquée par Safari), fichier ensuite */
        const w = window.open("", "_blank");
        sviFiles.get(d.idb).then(blob => {
          if (!blob) { w && w.close(); sviAlert("Document non disponible sur cet appareil."); return; }
          const url = URL.createObjectURL(blob);
          if (w) w.location.href = url; else download(d.name, blob);
        }).catch(e => { w && w.close(); sviAlert("Ouverture impossible : " + e.message); });
        return;
      }
      if (!d || !d.data) { sviAlert("Document non disponible sur cet appareil."); return; }
      try {
        const [meta, b64] = d.data.split(",");
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
        const blob = new Blob([arr], { type: (meta.match(/data:([^;]+)/) || [])[1] || d.type || "" });
        const url = URL.createObjectURL(blob);
        const w = window.open(url, "_blank");
        if (!w) download(d.name, blob);
      } catch (e) { sviAlert("Ouverture impossible : " + e.message); }
    };
    const localDT = d =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const hm = ms => {
      if (!isFinite(ms)) return "0:00";
      const neg = ms < 0; ms = Math.abs(ms);
      const m = Math.round(ms / 60000);
      return (neg ? "-" : "") + Math.floor(m / 60) + ":" + pad(m % 60);
    };

    const openRecForm = kind => {
      const now = new Date();
      let recRef = nextRecRef(kind, now);
      const tafObj = "";

      const fieldsHTML = kind === "obs" ? `
          <div class="doc-grid doc-grid-2">
            <label class="doc-lab" for="recDate">DATE CRÉATION <b>*</b></label>
            <div class="doc-row">
              <input id="recDate" class="doc-in" type="datetime-local" value="${localDT(now)}">
              <button type="button" class="doc-flag" id="recFlag" title="Observation importante">!</button>
            </div>
            <label class="doc-lab" for="recText">INTITULÉ <b>*</b></label>
            <textarea id="recText" class="doc-in doc-ta" placeholder="INTITULÉ"></textarea>
          </div>` : `
          <div class="doc-grid">
            <label class="doc-lab" for="recDate">DATE CRÉATION <b>*</b></label>
            <input id="recDate" class="doc-in" type="datetime-local" value="${localDT(now)}">
            <label class="doc-lab" for="recObj">OBJET TAF</label>
            <input id="recObj" class="doc-in" type="text" value="${esc(tafObj)}">

            <label class="doc-lab" for="recText">DESCRIPTIF TAF <b>*</b></label>
            <textarea id="recText" class="doc-in doc-ta doc-ta-s" placeholder="DESCRIPTIF TAF"></textarea>
            <label class="doc-lab" for="recResp">RESPONSABLE <b>*</b></label>
            <input id="recResp" class="doc-in" type="text" placeholder="RESPONSABLE" autocomplete="off">

            <label class="doc-lab" for="recPDate">DATE PRÉVUE TRAITEMENT <b>*</b></label>
            <input id="recPDate" class="doc-in" type="date" value="${localDT(now).slice(0, 10)}">
            <label class="doc-lab" for="recPTime">HEURE PRÉVUE TRAITEMENT <b>*</b></label>
            <input id="recPTime" class="doc-in" type="time" value="${localDT(now).slice(11)}">

            <label class="doc-lab">DÉLAI TRAITEMENT PLANIFIÉ</label>
            <input id="recDelay" class="doc-in doc-ro" type="text" value="0:00" readonly>
            <label class="doc-lab">DURÉE ÉCOULÉE</label>
            <input id="recElapsed" class="doc-in doc-ro" type="text" value="0:00" readonly>
          </div>`;

      document.getElementById("docPop")?.remove();
      const p = document.createElement("div");
      p.id = "docPop";
      p.innerHTML = `
        <div class="doc-card" role="dialog" aria-modal="true">
          <div class="doc-head">
            <span class="doc-title"><span id="recRef">${esc(recRef)}</span></span>
            <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
          </div>
          <div class="doc-body">
            ${fieldsHTML}
            <div id="recErr" class="doc-err"></div>
          </div>
          <div class="doc-foot">
            <button type="button" class="doc-btn" data-cancel>ANNULER</button>
            <button type="button" class="doc-btn doc-save" id="recSave">ENREGISTRER</button>
          </div>
        </div>`;
      document.body.appendChild(p);
      popEnhance(p, kind);
      setTimeout(() => p.querySelector("#recText")?.focus(), 50);

      const close = () => { clearInterval(timer); p.remove(); };
      p.addEventListener("click", e => {
        if (e.target === p || e.target.closest("[data-cancel]")) close();
      });

      const $p = id => p.querySelector("#" + id);
      $p("recFlag")?.addEventListener("click", e => e.currentTarget.classList.toggle("on"));

      /* TAF : délai planifié = prévu − création ; durée écoulée = maintenant − création */
      const updTimes = () => {
        if (kind !== "taf") return;
        const c = new Date($p("recDate").value);
        const plan = new Date($p("recPDate").value + "T" + ($p("recPTime").value || "00:00"));
        $p("recDelay").value = hm(plan - c);
        $p("recElapsed").value = hm(Date.now() - c);
      };
      const timer = setInterval(updTimes, 30000);
      updTimes();
      ["recPDate", "recPTime"].forEach(id => $p(id)?.addEventListener("input", updTimes));

      $p("recDate").addEventListener("change", e => {
        const d = new Date(e.target.value);
        if (!isNaN(d)) {
          recRef = nextRecRef(kind, d);
          $p("recRef").textContent = recRef;
        }
        updTimes();
      });

      $p("recSave").addEventListener("click", () => {
        const req = kind === "obs"
          ? [["recDate", "date"], ["recText", "intitulé"]]
          : [["recDate", "date"], ["recText", "descriptif"], ["recResp", "responsable"],
             ["recPDate", "date prévue"], ["recPTime", "heure prévue"]];
        const miss = [];
        p.querySelectorAll(".doc-in, .dt-native").forEach(x => x.classList.remove("bad"));
        req.forEach(([id, lab]) => {
          if (!String($p(id).value).trim()) { miss.push(lab); $p(id).classList.add("bad"); }
        });
        if (miss.length) {
          $p("recErr").textContent = "À COMPLÉTER (*) : " + miss.join(", ").toUpperCase() + ".";
          return;
        }
        const dupR = findDup(recLoad(kind), r => r.text, $p("recText").value);
        if (dupR) {
          $p("recText").classList.add("bad");
          $p("recErr").textContent = (kind === "obs" ? "Cet intitulé" : "Ce descriptif") +
            " existe déjà (" + dupR.ref + ").";
          return;
        }
        const rec = kind === "obs"
          ? { ref: recRef, date: $p("recDate").value, text: $p("recText").value.trim(),
              important: $p("recFlag").classList.contains("on") }
          : { ref: recRef, date: $p("recDate").value, objet: $p("recObj").value.trim(),
              text: $p("recText").value.trim(), responsable: $p("recResp").value.trim(),
              prevu: $p("recPDate").value + "T" + $p("recPTime").value };
        const list = recLoad(kind);
        list.push(rec);
        recSave(kind, list);
        histLog(kind.toUpperCase(), "CRÉATION", rec.ref + " — " + (rec.text || "") +
          (rec.important ? " (IMPORTANTE)" : "") + (rec.responsable ? " — " + rec.responsable : ""));
        close();
        updPill(kind);
      });
    };

    /* agrandir un bloc : il occupe tout l'écran sous l'en-tête figé */
    /* budget ouvert par un balayage depuis un bloc agrandi : même bloc agrandi (l'onglet ouvert est déjà gardé) */
    setTimeout(() => { const b = window.__sviPendingMax; if (!b) return; window.__sviPendingMax = ""; const pg = shell.querySelector(".bdg-d-page"); if (pg && !pg.classList.contains("max-" + b)) toggleMax(b); }, 0);
    const toggleMax = blk => {
      const page = shell.querySelector(".bdg-d-page");
      const cls = "max-" + blk;
      const on = !page.classList.contains(cls);
      page.classList.remove("max-client", "max-hier", "max-detail", "max-rec", "max-suivi");
      shell.querySelectorAll(".blk-rec").forEach(b =>
        b.classList.toggle("blk-rec-on", on && b.dataset.rec === blk));
      if (on && blk === "suivi") page.classList.add("max-rec");
      if (on) {
        const head = shell.querySelector(".bdg-d-sticky");
        const avail = window.innerHeight - (head ? head.offsetHeight : 0) - 40;
        page.style.setProperty("--avail", Math.max(260, avail) + "px");
        page.classList.add(cls);
        const top = page.getBoundingClientRect().top + window.scrollY -
          (head ? head.offsetHeight : 0);
        window.scrollTo(0, Math.max(0, top));
      }
      shell.querySelectorAll(".blk-max-btn").forEach(b =>
        b.classList.toggle("on", on && b.dataset.blk === blk)
      );
    };

    /* DÉTAIL PRODUITS : choix du format avant aperçu ou export */
    const chooseFormat = act => {
      document.getElementById("docPop")?.remove();
      const p = document.createElement("div");
      p.id = "docPop";
      p.innerHTML = `
        <div class="doc-card" role="dialog" aria-modal="true" style="max-width:520px">
          <div class="doc-head">
            <span class="doc-title">${act === "export" ? "EXPORTER" : "APERÇU"} — DÉTAIL PRODUITS</span>
            <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
          </div>
          <div class="doc-body">
            <div class="fmt-choice">
              <button type="button" class="doc-btn fmt-btn" data-fmt="metre">FORMAT MÉTRÉ</button>
              <button type="button" class="doc-btn fmt-btn" data-fmt="interne">FORMAT INTERNE</button>
            </div>
          </div>
          <div class="doc-foot"><button type="button" class="doc-btn" data-cancel>ANNULER</button></div>
        </div>`;
      document.body.appendChild(p);
      p.addEventListener("click", e => {
        const f = e.target.closest("[data-fmt]");
        if (f) {
          p.remove();
          const metre = f.dataset.fmt === "metre";
          if (act === "export") openExportMenu(metre ? "metre" : "interne");
          else if (metre) printMetre();
          else printTasks("prd");
          return;
        }
        if (e.target === p || e.target.closest("[data-cancel]")) p.remove();
      });
    };

    /* budget en instance : lignes cochées d'un bloc (les cases servent à supprimer, exporter, aperçu) */
    const insBlkKinds = blk => blk === "client" ? ["des"] : blk === "hier" ? ["lot", "prim", "sec"]
      : blk === "detail" && ["chg", "prd", "qlt"].includes(active) ? [active]
      : blk === "detail" && active === "unl" ? ["des", "lot", "prim", "sec", "chg", "prd"] : [];
    /* ✕ DÉLIER LES LIGNES COCHÉES (menu ⋯) : liaisons qui contiennent une ligne cochée (et affichée) du bloc ;
       produits / charges cochés : retirés de leurs liaisons ; LIAISONS VALIDÉES : liaisons cochées */
    const insUnlPlan = blk => {
      if (!INS || !INS_EDIT) return null;
      const L = INS.links || [];
      /* bloc détail : tous ses onglets (FORMAT 104) — liaisons cochées (délier en entier) + produits / charges cochés (retirés) */
      if (blk === "detail") {
        const vi = active === "lnk" && lastShown.detail && lastShown.detail.kind === "lnk" ? new Set(lastShown.detail.rows.map(l => l.id)) : null;
        const whole = L.filter(l => l.on === true && (!vi || vi.has(l.id)));
        const sp = insSelIds("prd"), sc = insSelIds("chg");
        const remP = [...sp].filter(id => L.some(l => (l.prd || []).some(x => x.id === id)));
        const remC = [...sc].filter(id => L.some(l => (l.chg || []).some(x => x.id === id)));
        const hit = L.filter(l => whole.includes(l) || (l.prd || []).some(x => remP.includes(x.id)) || (l.chg || []).some(x => remC.includes(x.id)));
        return { mode: "del", links: hit, remP, remC, whole: new Set(whole.map(l => l.id)), n: hit.length };
      }
      const ks = insBlkKinds(blk).filter(k => k !== "qlt");
      if (!ks.length) return null;
      const sel = {};
      ks.forEach(k => { sel[k] = insSelIds(k); });
      const remP = sel.prd ? [...sel.prd].filter(id => L.some(l => (l.prd || []).some(x => x.id === id))) : [];
      const remC = sel.chg ? [...sel.chg].filter(id => L.some(l => (l.chg || []).some(x => x.id === id))) : [];
      const hit = L.filter(l => ["des", "lot", "prim", "sec"].some(k => sel[k] && sel[k].has(l[k]))
        || (l.prd || []).some(x => remP.includes(x.id)) || (l.chg || []).some(x => remC.includes(x.id)));
      return { mode: "del", links: hit, remP, remC, n: hit.length };
    };
    /* suppression : seules les lignes cochées ET déliées partent ; une ligne liée n'est jamais proposée */
    const insDelPlan = blk => {
      const X = shell.__ins;
      const out = { del: {}, n: 0, kept: 0 };
      if (!X) return out;
      /* FORMAT 104 : bloc détail = lignes cochées de TOUS ses onglets (filtre de chaque onglet respecté) ;
         une ligne cochée dans deux onglets n'est comptée qu'une fois ; les lignes liées restent */
      if (blk === "detail") {
        const add = (k, id) => { (out.del[k] = out.del[k] || new Set()).add(id); };
        ["chg", "prd", "qlt"].forEach(k => {
          const vis = insVis(k);
          X.INS[k].forEach(r => { if (r.t || r.on !== true || !vis.has(r.id)) return; if (k !== "qlt" && X.isUsed(k, r.id)) out.kept++; else add(k, r.id); });
        });
        /* LIGNES NON LIÉES : ses lignes cochées des autres blocs (désignations, lots, activités) */
        const uv = active === "unl" && lastShown.detail && lastShown.detail.kind === "unl" ? new Set(lastShown.detail.rows.map(x => x.k + "|" + x.id)) : null;
        const un = insUnlinked();
        ["des", "lot", "prim", "sec", "chg", "prd"].forEach(k => (un[k] || []).forEach(r => { if (r.uon === true && !r.t && (!uv || uv.has(k + "|" + r.id))) add(k, r.id); }));
        /* IMPORT NON CRÉÉ */
        const vi = active === "inc" && lastShown.detail && lastShown.detail.kind === "inc" ? new Set(lastShown.detail.rows.map(x => x.id)) : null;
        (INS.inc || []).forEach(x => { if (x.on === true && (!vi || vi.has(x.id))) add("inc", x.id); });
        /* DÉTAIL DÉLAIS : périodes cochées */
        const Y = shell.__insDly;
        if (Y && Y.draft) Object.values(Y.draft()).forEach(l => l.forEach(p => { if (p.on === true) add("dly", p.id); }));
        /* PLANNING : tâches cochées ; une tâche liée reste (règle G) */
        if (Y && Y.linked) (shell.__dlySel || new Set()).forEach(k => { if (Y.linked(k)) out.kept++; else add("plan", k); });
        out.n = Object.values(out.del).reduce((t, S) => t + S.size, 0);
        return out;
      }
      /* IMPORT NON CRÉÉ : les lignes cochées de l'onglet (les données déjà importées restent) */
      /* DÉTAIL DÉLAIS : périodes cochées (le brouillon de la liaison en cours) */
      if (blk === "detail" && active === "dly") {
        const Y = shell.__insDly, S = new Set(), P = new Set();
        if (Y && Y.draft) Object.values(Y.draft()).forEach(l => l.forEach(p => { if (p.on === true) S.add(p.id); }));
        /* PLANNING : tâches cochées ; une tâche liée reste (règle G) */
        if (Y && !insDlyKey()) (shell.__dlySel || new Set()).forEach(k => { if (Y.linked(k)) out.kept++; else P.add(k); });
        if (S.size) out.del.dly = S;
        if (P.size) out.del.plan = P;
        out.n = S.size + P.size;
        return out;
      }
      if (blk === "detail" && active === "inc") { const vi = new Set(lastShown.detail && lastShown.detail.kind === "inc" ? lastShown.detail.rows.map(x => x.id) : []);
        const ids = new Set((INS.inc || []).filter(x => x.on === true && vi.has(x.id)).map(x => x.id)); if (ids.size) { out.del.inc = ids; out.n = ids.size; } return out; }
      const unlTab = blk === "detail" && active === "unl";
      insBlkKinds(blk).forEach(k => {
        /* onglet LIGNES NON LIÉES : seulement ses lignes (non liées), titres compris */
        const vu = unlTab ? new Set((lastShown.detail && lastShown.detail.kind === "unl" ? lastShown.detail.rows : []).filter(x => x.k === k).map(x => x.id)) : insVis(k);
        const rows = unlTab ? X.INS[k].filter(r => r.uon === true && vu.has(r.id) && !X.isUsed(k, r.id)) : X.INS[k].filter(r => !r.t && r.on === true && vu.has(r.id));
        const free = rows.filter(r => !X.isUsed(k, r.id));
        out.kept += rows.length - free.length;
        const ids = new Set(free.map(r => r.id));
        /* un titre part avec sa branche quand toute sa branche part */
        if (k === "des") X.INS.des.forEach(t => { if (t.t) { const b = X.insBranch(t);
          if (b.length && b.every(r => ids.has(r.id))) ids.add(t.id);
          /* titre vide coché : supprimé lui aussi (et compté) */
          else if (!b.length && t.on === true && !unlTab) { ids.add(t.id); out.n++; } } });
        if (ids.size) { out.del[k] = ids; out.n += free.length; }
      });
      return out;
    };
    /* détail d'un compteur de lignes cochées par bloc : « 5 CHARGES + 42 PRODUITS » */
    const DEL_LAB = { des: ["DÉSIGNATION", "DÉSIGNATIONS"], lot: ["LOT", "LOTS"], prim: ["ACTIVITÉ PRIMAIRE", "ACTIVITÉS PRIMAIRES"], sec: ["ACTIVITÉ SECONDAIRE", "ACTIVITÉS SECONDAIRES"], chg: ["CHARGE", "CHARGES"], prd: ["PRODUIT", "PRODUITS"],
      qlt: ["LIGNE QUALITÉ", "LIGNES QUALITÉ"], inc: ["LIGNE D'IMPORT NON CRÉÉ", "LIGNES D'IMPORT NON CRÉÉ"], dly: ["DÉLAI", "DÉLAIS"], plan: ["TÂCHE DU PLANNING", "TÂCHES DU PLANNING"] };
    const insDelSplit = pl => Object.keys(pl.del || {}).filter(k => DEL_LAB[k] && pl.del[k].size).map(k => pl.del[k].size + " " + DEL_LAB[k][pl.del[k].size > 1 ? 1 : 0]).join(" + ");
    const insDelRun = blk => {
      const X = shell.__ins;
      const pl = insDelPlan(blk);
      if (!pl.n) return;
      if (blk === "detail" && X) {
        svConfirm({ title: "SUPPRIMER LES LIGNES COCHÉES",
          text: pl.n + " LIGNE(S) SERONT SUPPRIMÉES : " + insDelSplit(pl) + "." + (pl.del.inc ? " (IMPORT NON CRÉÉ : LES DONNÉES DÉJÀ IMPORTÉES RESTENT.)" : "") + (pl.kept ? " " + pl.kept + " LIGNE(S) LIÉE(S) RESTENT." : ""), ok: "SUPPRIMER" }).then(go => {
          if (!go) return;
          Object.keys(pl.del).forEach(k => {
            if (k === "inc") { INS.inc = (INS.inc || []).filter(x => !pl.del.inc.has(x.id)); return; }
            if (k === "dly") { const D = shell.__insDly.draft(); Object.keys(D).forEach(t => { D[t] = D[t].filter(p => !pl.del.dly.has(p.id)); }); return; }
            if (k === "plan") { shell.__insDly.removeTasks([...pl.del.plan]); return; }
            X.INS[k] = X.INS[k].filter(x => !pl.del[k].has(x.id));
          });
          histLog("SAISIE", "LIGNES SUPPRIMÉES", pl.n + " LIGNE(S) — " + insDelSplit(pl));
          X.cleanLinks(); X.insSave(); refreshAll();
        });
        return;
      }
      if (pl.del.dly) { shell.__insDlyDel && shell.__insDlyDel(); return; }
      if (!X) return;
      if (pl.del.inc) {
        svConfirm({ title: "EFFACER LES LIGNES D'IMPORT", text: pl.n + " LIGNE(S) EFFACÉE(S) DE L'ONGLET IMPORT NON CRÉÉ. LES DONNÉES DÉJÀ IMPORTÉES RESTENT.", ok: "EFFACER" }).then(go => {
          if (!go) return;
          INS.inc = (INS.inc || []).filter(x => !pl.del.inc.has(x.id));
          histLog("IMPORT", "LIGNES NON CRÉÉES EFFACÉES", pl.n + " LIGNE(S)");
          insSave(); refreshAll();
        });
        return;
      }
      svConfirm({ title: "SUPPRIMER LES LIGNES COCHÉES",
        text: pl.n + " LIGNE(S) SERONT SUPPRIMÉES" + (Object.keys(pl.del).length > 1 ? " : " + insDelSplit(pl) : "") + "." + (pl.kept ? " " + pl.kept + " LIGNE(S) LIÉE(S) RESTENT." : ""), ok: "SUPPRIMER" }).then(go => {
        if (!go) return;
        Object.keys(pl.del).forEach(k => {
          X.INS[k] = X.INS[k].filter(x => !pl.del[k].has(x.id));
          histLog("SAISIE", "LIGNES SUPPRIMÉES", pl.del[k].size + " LIGNE(S)");
        });
        X.cleanLinks(); X.insSave();
        /* v523 (remarque 4) : TOUS les tableaux et listes redessinés — les lignes cochées supprimées ne filtrent plus les autres blocs */
        refreshAll();
      });
    };
    /* export / aperçu : s'il y a des lignes cochées dans le bloc, seulement celles-là */
    const insOnlyChecked = blk => {
      const X = shell.__ins;
      if (!X || !lastShown) return;
      if (blk === "client" && lastShown.client && lastShown.client.ins) {
        const on = new Set(X.INS.des.filter(r => !r.t && r.on === true).map(r => r.id));
        if (!on.size) return;
        const keep = new Set();
        X.INS.des.forEach(t => { if (t.t && X.insBranch(t).some(r => on.has(r.id))) keep.add(t.id); });
        lastShown.client = { ...lastShown.client, rows: lastShown.client.rows.filter(r => on.has(r.id) || keep.has(r.id)) };
      } else if (blk === "hier" && lastShown.hier) {
        ["lot", "prim", "sec"].forEach(k => {
          const vis = insVis(k);
          const on = X.INS[k].filter(r => r.on === true && vis.has(r.id));
          if (on.length) lastShown.hier[k] = on.map(r => r.v || "");
        });
      } else if (blk === "detail" && lastShown.detail && lastShown.detail.ins) {
        const rows = lastShown.detail.rows.filter(r => r.on === true);
        if (rows.length) lastShown.detail = { ...lastShown.detail, rows };
      }
    };
