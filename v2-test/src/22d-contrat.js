    /* =========================================================
       v669 (AXE 3) : CONTRAT — le CPS article par article (menu ⋯ du haut : CONTRAT (CPS)).
       APPELER LE CPS : depuis DOCUMENTS du budget, les documents des autres budgets (ancien marché…) ou un fichier extérieur
       (PDF ou texte ; un fichier extérieur est aussi classé dans DOCUMENTS) ; le texte est découpé en une ligne par ARTICLE,
       les titres (CHAPITRE, TITRE, SECTION, PARTIE) repérés à part pour garder la présentation. Colonnes : N°, TITRE, CONTENU,
       TYPE, VALEUR, UNITÉ (% / DH / J / MOIS / ‰). Le TYPE est deviné d'après le texte (modifiable) et commande la fenêtre ⚙ :
       DÉLAI (→ DATE BUTOIR), CAUTIONS (% ou DH, moment, mainlevée, prévenir), RETENUE DE GARANTIE (retenue ou caution),
       AVANCE, RÉVISION DES PRIX (formule, index, pondérations, mois de base), DÉFINITION DES PRIX (désignations client liées,
       dans les deux sens), QUALITÉ (essais, échéance, qui prévenir), MODALITÉS DE PAIEMENT (échéances → recettes prévisionnelles),
       PÉNALITÉS DE RETARD (taux par jour, plafond → coût d'un retard du planning). Données : INS.ctr = { rows, src }.
       ========================================================= */
    const CTR_T = [["", "—"], ["del", "DÉLAI"], ["cprov", "CAUTION PROVISOIRE"], ["cdef", "CAUTION DÉFINITIVE"], ["rg", "RETENUE DE GARANTIE"], ["av", "AVANCE"],
      ["rev", "RÉVISION DES PRIX"], ["defp", "DÉFINITION DES PRIX"], ["qlt", "QUALITÉ"], ["pay", "MODALITÉS DE PAIEMENT"], ["pen", "PÉNALITÉS DE RETARD"]];
    const ctrTLab = t => (CTR_T.find(x => x[0] === t) || ["", "—"])[1];
    const ctrGuess = (ti, tx) => {
      const s = U_(ti + " " + String(tx || "").slice(0, 600));
      if (/CAUTION(NEMENT)?\s+PROVISOIRE/.test(s)) return "cprov";
      if (/CAUTION(NEMENT)?\s+D[EÉ]FINITI/.test(s)) return "cdef";
      if (/RETENUE\s+DE\s+GARANTIE/.test(s)) return "rg";
      if (/P[EÉ]NALIT/.test(s)) return "pen";
      if (/R[EÉ]VISION\s+DES\s+PRIX/.test(s)) return "rev";
      if (/AVANCE/.test(U_(ti))) return "av";
      if (/MODALIT[EÉ]S?\s+DE\s+(PAIEMENT|R[EÈ]GLEMENT)|R[EÈ]GLEMENT\s+DES\s+(TRAVAUX|SOMMES)|ACOMPTE/.test(s)) return "pay";
      if (/D[EÉ]LAI/.test(U_(ti))) return "del";
      if (/ESSAI|LABORATOIRE|CONTR[OÔ]LE\s+DE\s+QUALIT/.test(U_(ti))) return "qlt";
      if (/PRIX/.test(U_(ti)) && /D[EÉ]FINITION|CONSISTANCE|CARACT[EÈ]RE|CONTENU|BORDEREAU|UNITAIRE/.test(s)) return "defp";
      return "";
    };
    const ctrVal = (t, tx) => {
      const s = String(tx || "").replace(/\s+/g, " ");
      if (t === "pen") { const m = s.match(/(\d+(?:[.,]\d+)?)\s*\/\s*1\s*000/) || s.match(/(\d+(?:[.,]\d+)?)\s*‰/); if (m) return { val: num(m[1]), u: "‰" }; }
      if (t === "del") { const m = s.match(/(\d+)\s*\(?[A-Z ]*\)?\s*(MOIS|JOURS?)/i); if (m) return { val: num(m[1]), u: /MOIS/i.test(m[2]) ? "MOIS" : "J" }; }
      const p = s.match(/(\d+(?:[.,]\d+)?)\s*%/); if (p) return { val: num(p[1]), u: "%" };
      const d = s.match(/(\d[\d\s.]*(?:,\d+)?)\s*(DH|DIRHAMS)/i); if (d) return { val: num(d[1].replace(/[\s.]/g, "")), u: "DH" };
      return { val: "", u: "" };
    };
    /* texte → lignes du contrat */
    const ctrParse = txt => {
      const L = String(txt || "").replace(/\r/g, "").split("\n").map(x => x.replace(/\s+/g, " ").trim()).filter(Boolean);
      const out = []; let cur = null;
      const AR = /^(?:ARTICLE|ART\.)\s*(?:N[°O]\.?\s*)?([0-9IVXLC]+(?:[.\-][0-9]+)*|PREMIER|1ER)\s*[:\-–—.]?\s*(.*)$/i;
      const TT = /^(CHAPITRE|TITRE|SECTION|PARTIE)\b\s*(.*)$/i;
      L.forEach(l => {
        let m = l.match(AR);
        if (m) { cur = { id: insId(), no: /PREMIER|1ER/i.test(m[1]) ? "1" : m[1].toUpperCase(), titre: U_(m[2]), txt: "" }; out.push(cur); return; }
        m = l.match(TT);
        if (m && l.length < 90) { out.push({ id: insId(), t: true, no: "", titre: U_(l), txt: "" }); cur = null; return; }
        if (cur) { if (!cur.titre && l.length < 90) cur.titre = U_(l); else cur.txt += (cur.txt ? "\n" : "") + l; }
      });
      out.forEach(r => { if (r.t) return; r.type = ctrGuess(r.titre, r.txt); const v = ctrVal(r.type, r.txt); r.val = v.val; r.u = v.u; r.det = {}; });
      return out;
    };
    const loadPdfJs = () => window.pdfjsLib ? Promise.resolve(window.pdfjsLib) : new Promise((ok, ko) => {
      const sc = document.createElement("script");
      sc.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      sc.onload = () => { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; } catch (e) {} ok(window.pdfjsLib); };
      sc.onerror = () => ko(new Error("LECTEUR PDF INDISPONIBLE (CONNEXION ?)"));
      document.head.appendChild(sc);
    });
    /* texte d'un fichier : PDF (lignes reconstruites d'après la position du texte) ou texte brut */
    const ctrText = async blob => {
      const ty = String(blob.type || "") + " " + String(blob.name || "");
      if (/pdf/i.test(ty)) {
        const lib = await loadPdfJs();
        const pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        const lines = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const tc = await (await pdf.getPage(i)).getTextContent();
          let y = null, ln = "";
          tc.items.forEach(it => { const yy = Math.round(it.transform[5]); if (y !== null && Math.abs(yy - y) > 2) { lines.push(ln); ln = ""; } y = yy; ln += (ln && !ln.endsWith(" ") ? " " : "") + it.str; });
          if (ln) lines.push(ln);
        }
        return lines.join("\n");
      }
      return await blob.text();
    };
    const ctrDocBlob = async d => {
      if (d.idb) return await sviFiles.get(d.idb);
      if (d.data) { const [meta, b64] = d.data.split(","); const bin = atob(b64), a = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) a[k] = bin.charCodeAt(k); return new Blob([a], { type: (meta.match(/data:([^;]+)/) || [])[1] || d.type || "" }); }
      return null;
    };
    /* documents des autres budgets (ancien marché…) */
    const ctrOtherDocs = () => {
      const out = [];
      try { for (let i = 0; i < localStorage.length; i++) { const k = String(localStorage.key(i) || "").replace(/^svitest:/, ""); if (!k || !k.startsWith("svi_docs_v1:") || k === "svi_docs_v1:" + ref) continue;
        (JSON.parse(localStorage.getItem(k) || "[]") || []).forEach(d => { if (d && (d.idb || d.data)) out.push({ ...d, from: k.slice(12) }); }); } } catch (e) {}
      return out;
    };
    /* MODALITÉS DE PAIEMENT → recettes prévisionnelles (date, montant) ; montant du marché = total HT des désignations */
    const ctrMarche = () => INS.des.filter(d => !d.t).reduce((t, d) => t + (insLinkedQ(INS, d.id) ?? num(d.q || 0)) * num(d.p || 0), 0);
    const ctrRecettes = () => {
      const M = ctrMarche(), out = [];
      ((INS.ctr || {}).rows || []).filter(r => r.type === "pay").forEach(r => ((r.det || {}).ech || []).forEach(e => {
        const date = e.on === "task" ? (dlyFin(e.task) || dlyDeb(e.task) || "") : e.date || "";
        const m = e.u === "%" ? M * num(e.v || 0) / 100 : num(e.v || 0);
        out.push({ lab: e.lab || (e.on === "task" ? "FIN " + dlyName(e.task) : "ÉCHÉANCE"), date, m });
      }));
      return out.sort((a, b) => String(a.date || "9").localeCompare(String(b.date || "9")));
    };
    /* PÉNALITÉS : coût d'un retard du planning sur la DATE BUTOIR */
    const ctrPenal = r => {
      const M = ctrMarche(), keys = dlyKeys(), fin = keys.map(k => dlyFin(k) || dlyDeb(k)).filter(Boolean).sort().pop() || "";
      const but = INS.dbut || "", late = fin && but && fin > but ? Math.round((new Date(fin) - new Date(but)) / 864e5) : 0;
      const per = r.u === "‰" ? M * num(r.val || 0) / 1000 : r.u === "%" ? M * num(r.val || 0) / 100 : num(r.val || 0);
      const cap = num((r.det || {}).plaf || 0), tot = late * per, capM = cap ? M * cap / 100 : Infinity;
      return { fin, but, late, per, tot: Math.min(tot, capM), capped: tot > capM };
    };
    const ctrDetWin = (C, r, back) => {
      const t = r.type, D = r.det = r.det || {}, ed = INS_EDIT, dis = ed ? "" : " disabled";
      const f = (k, lab, ph = "", tp = "text") => `<label class="pv-r"><span>${lab}</span><input class="pv-in ctd" data-k="${k}" type="${tp}" value="${esc(D[k] ?? "")}" placeholder="${esc(ph)}"${dis}></label>`;
      let body = "";
      if (t === "cprov" || t === "cdef") body = `<label class="pv-r"><span>EN</span><select class="pv-in ctd" data-k="cu"${dis}>${["%", "DH"].map(u => `<option${(D.cu || r.u || "%") === u ? " selected" : ""}>${u}</option>`).join("")}</select></label>${f("moment", "À QUEL MOMENT", "À LA REMISE DE L'OFFRE, À LA NOTIFICATION…")}${f("ml", "MAINLEVÉE PRÉVUE", "", "date")}${f("prev", "PRÉVENIR (JOURS AVANT)", "15")}`;
      else if (t === "rg") body = `<label class="pv-r"><span>FORME</span><select class="pv-in ctd" data-k="forme"${dis}><option value="ret"${D.forme !== "cau" ? " selected" : ""}>RETENUE SUR LES PAIEMENTS</option><option value="cau"${D.forme === "cau" ? " selected" : ""}>CAUTION QUI LA REMPLACE</option></select></label>${f("ml", "LIBÉRATION PRÉVUE", "", "date")}${f("prev", "PRÉVENIR (JOURS AVANT)", "15")}`;
      else if (t === "av") body = f("moment", "VERSÉE QUAND", "À LA NOTIFICATION…") + f("remb", "REMBOURSEMENT", "PAR RETENUE SUR LES DÉCOMPTES…");
      else if (t === "rev") body = f("formule", "FORMULE", "P = P0 × (0,15 + 0,85 × I/I0)") + f("index", "INDEX", "BAT1, BAT3…") + f("pond", "PONDÉRATIONS", "0,15 ; 0,50 ; 0,35") + f("mb", "MOIS DE BASE", "", "month") + f("hyp", "HYPOTHÈSE D'ÉVOLUTION (%/AN)", "");
      else if (t === "del") body = `<div class="pv-sub">DATE DE DÉBUT : ${esc(dFr(INS.pdeb || "") || "—")} ; DATE BUTOIR ACTUELLE : ${esc(dFr(INS.dbut || "") || "—")}</div>${ed ? `<button type="button" class="svc-b" data-but>APPLIQUER À LA DATE BUTOIR</button>` : ""}`;
      else if (t === "defp") body = `<div class="pv-sub">DÉSIGNATIONS CLIENT DONT LE PRIX EST DÉFINI PAR CET ARTICLE</div><div class="pv-scroll">${INS.des.filter(d => !d.t).map(d => `<label class="pv-r"><input type="checkbox" class="ctd-des" value="${d.id}"${(D.des || []).includes(d.id) ? " checked" : ""}${dis}><span>${esc(lkName("des", d.id))}</span></label>`).join("")}</div>`;
      else if (t === "qlt") body = f("ess", "ESSAIS EXIGÉS", "COMPRESSION BÉTON 7 J ET 28 J…") + f("ech", "RÉSULTAT ATTENDU À (JOURS)", "28") + f("qui", "QUI PRÉVENIR", "BUREAU DE CONTRÔLE…");
      else if (t === "pay") {
        const E = D.ech = D.ech || [];
        const tasks = dlyKeys();
        body = `<div class="pv-sub">MONTANT DU MARCHÉ (HT) : ${money(ctrMarche())} DH — CHAQUE ÉCHÉANCE : À LA FIN D'UNE TÂCHE OU À UNE DATE</div>
          <div class="pv-scroll">${E.map((e, i) => `<div class="ctp-r" data-i="${i}"><input class="pv-in ctp" data-f="lab" value="${esc(e.lab || "")}" placeholder="LIBELLÉ"${dis}>
            <select class="pv-in ctp" data-f="on"${dis}><option value="task"${e.on !== "date" ? " selected" : ""}>FIN DE TÂCHE</option><option value="date"${e.on === "date" ? " selected" : ""}>DATE</option></select>
            ${e.on === "date" ? `<input class="pv-in ctp" data-f="date" type="date" value="${esc(e.date || "")}"${dis}>` : `<select class="pv-in ctp" data-f="task"${dis}><option value="">TÂCHE…</option>${tasks.map(k => `<option value="${esc(k)}"${e.task === k ? " selected" : ""}>${esc(dlyName(k))}</option>`).join("")}</select>`}
            <input class="pv-in ctp" data-f="v" inputmode="decimal" value="${esc(e.v === undefined ? "" : String(e.v).replace(".", ","))}"${dis}><select class="pv-in ctp" data-f="u"${dis}>${["%", "DH"].map(u => `<option${(e.u || "%") === u ? " selected" : ""}>${u}</option>`).join("")}</select>${ed ? `<button type="button" class="cmp-del" data-edel="${i}">✕</button>` : ""}</div>`).join("") || `<div class="fz-none">AUCUNE ÉCHÉANCE</div>`}</div>
          ${ed ? `<button type="button" class="svc-b" data-eadd>+ AJOUTER UNE ÉCHÉANCE</button>` : ""}
          <div class="fz-blk">RECETTES PRÉVISIONNELLES</div><div class="ctp-rec"></div>`;
      }
      else if (t === "pen") body = f("plaf", "PLAFOND (% DU MARCHÉ)", "10") + `<div class="ctp-rec"></div>`;
      else body = `<div class="fz-none">CHOISIR D'ABORD UN TYPE POUR CET ARTICLE.</div>`;
      const d = sviWinNew();
      d.innerHTML = sviWinCard({ cls: "pv-card", close: "data-x", title: esc(ctrTLab(t)) + " — ART. " + esc(r.no || ""), body: `<div class="pv-sub">${esc(r.titre || "")} — VALEUR : ${esc(r.val === "" || r.val === undefined ? "—" : String(r.val).replace(".", ","))} ${esc(r.u || "")}</div>` + body,
        foot: `<button type="button" class="svc-b svc-ok svc-neutral" data-x>RETOUR</button>` });
      sviWinShow(d);
      const recPaint = () => {
        const box = d.querySelector(".ctp-rec"); if (!box) return;
        if (t === "pay") { const R = ctrRecettes().filter(x => x); let c = 0; box.innerHTML = R.length ? `<table class="pv-t"><thead><tr><th>ÉCHÉANCE</th><th>DATE</th><th class="number">MONTANT</th><th class="number">CUMUL</th></tr></thead><tbody>${R.map(x => { c += x.m; return `<tr><td>${esc(x.lab)}</td><td>${esc(dFr(x.date) || "—")}</td><td class="number">${money(x.m)}</td><td class="number">${money(c)}</td></tr>`; }).join("")}</tbody></table>` : `<div class="fz-none">—</div>`; }
        if (t === "pen") { const P = ctrPenal(r); box.innerHTML = `<div class="pv-tot">FIN DU PLANNING ${esc(dFr(P.fin) || "—")} ; DATE BUTOIR ${esc(dFr(P.but) || "—")} ; RETARD <b>${P.late} J</b> ; PÉNALITÉ PAR JOUR <b>${money(P.per)} DH</b> ; COÛT DU RETARD <b>${money(P.tot)} DH</b>${P.capped ? " (PLAFONNÉ)" : ""}</div>`; }
      };
      recPaint();
      d.addEventListener("input", e => { const i = e.target.closest(".ctd"); if (i && i.dataset.k) { D[i.dataset.k] = i.value; recPaint(); } });
      d.addEventListener("change", e => {
        const i = e.target;
        if (i.classList.contains("ctd")) { D[i.dataset.k] = i.value; recPaint(); return; }
        if (i.classList.contains("ctd-des")) { D.des = [...d.querySelectorAll(".ctd-des:checked")].map(x => x.value); return; }
        if (i.classList.contains("ctp")) { const e2 = D.ech[+i.closest(".ctp-r").dataset.i], fd = i.dataset.f; e2[fd] = fd === "v" ? num(i.value) : i.value; if (fd === "on") { ctrDetWin(C, r, back); return; } recPaint(); }
      });
      d.addEventListener("click", e => {
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); back(); return; }
        if (e.target.closest("[data-eadd]")) { D.ech.push({ on: "task", v: "", u: "%" }); ctrDetWin(C, r, back); return; }
        const ed2 = e.target.closest("[data-edel]"); if (ed2) { D.ech.splice(+ed2.dataset.edel, 1); ctrDetWin(C, r, back); return; }
        if (e.target.closest("[data-but]")) {
          if (!INS.pdeb || r.val === "" || r.val === undefined) { svToast("IL FAUT LA DATE DE DÉBUT (INF) ET LA VALEUR DU DÉLAI.", 3500, e.target); return; }
          const dt = new Date(INS.pdeb + "T12:00:00"); if (r.u === "MOIS") { dt.setMonth(dt.getMonth() + num(r.val)); dt.setDate(dt.getDate() - 1); } else dt.setDate(dt.getDate() + num(r.val) - 1);
          INS.dbut = sviIsoOf(dt); insSave(); histLog("CONTRAT", "DATE BUTOIR", dFr(INS.dbut) + " (ART. " + (r.no || "") + ")");
          svToast("DATE BUTOIR : " + dFr(INS.dbut) + ".", 3000); ctrDetWin(C, r, back);
        }
      });
    };
    const ctrWin = (onlyDes) => {
      const C = JSON.parse(JSON.stringify(INS.ctr || { rows: [] })); C.rows = C.rows || [];
      const ed = INS_EDIT, open = new Set();
      const d = sviWinNew();
      let filt = onlyDes || null;
      const draw = () => {
        const R = filt ? C.rows.filter(r => r.type === "defp" && ((r.det || {}).des || []).includes(filt)) : C.rows;
        d.innerHTML = sviWinCard({ cls: "cmp-card svc-full", close: "data-x", title: "CONTRAT (CPS)" + (filt ? " — " + esc(lkName("des", filt)) : ""),
          body: `<div class="cmp-bar">${ed ? `<button type="button" class="svc-b" data-src>APPELER LE CPS…</button><button type="button" class="svc-b" data-add>+ AJOUTER UN ARTICLE</button>` : ""}
              ${filt ? `<button type="button" class="svc-b" data-all>TOUS LES ARTICLES</button>` : ""}<span class="cmp-leg">${C.src ? "SOURCE : " + esc(C.src) : ""} ${svCnt(C.rows.filter(r => !r.t).length)}</span></div>
            ${filt && !R.length ? `<div class="pv-sub">AUCUN ARTICLE NE DÉFINIT LE PRIX DE CETTE DÉSIGNATION : CHOISIR L'ARTICLE (TYPE DÉFINITION DES PRIX, ⚙).</div>` : ""}
            <div class="cmp-scroll"><table class="cmp-t ctr-t"><thead><tr><th>N°</th><th>TITRE</th><th>CONTENU</th><th>TYPE</th><th>VALEUR</th><th>UNITÉ</th><th></th></tr></thead><tbody>
            ${(filt && !R.length ? C.rows.filter(r => !r.t) : R).map(r => r.t ? `<tr class="ctr-tt" data-id="${r.id}"><td colspan="7"><b>${esc(r.titre)}</b></td></tr>` : `<tr data-id="${r.id}">
              <td class="c">${ed ? `<input class="ctr-in ctr-no" data-f="no" value="${esc(r.no || "")}">` : esc(r.no || "")}</td>
              <td>${ed ? `<input class="ctr-in" data-f="titre" value="${esc(r.titre || "")}">` : esc(r.titre || "")}</td>
              <td class="ctr-tx${open.has(r.id) ? " on" : ""}" data-open="${r.id}">${ed && open.has(r.id) ? `<textarea class="ctr-in ctr-ta" data-f="txt">${esc(r.txt || "")}</textarea>` : esc(open.has(r.id) ? r.txt || "" : String(r.txt || "").slice(0, 110) + (String(r.txt || "").length > 110 ? "…" : ""))}</td>
              <td><select class="ctr-in" data-f="type"${ed ? "" : " disabled"}>${CTR_T.map(([v, l]) => `<option value="${v}"${(r.type || "") === v ? " selected" : ""}>${l}</option>`).join("")}</select></td>
              <td class="r">${ed ? `<input class="ctr-in ctr-v" data-f="val" inputmode="decimal" value="${esc(r.val === "" || r.val === undefined ? "" : String(r.val).replace(".", ","))}">` : esc(String(r.val ?? ""))}</td>
              <td class="c"><select class="ctr-in" data-f="u"${ed ? "" : " disabled"}>${["", "%", "DH", "J", "MOIS", "‰"].map(u => `<option${(r.u || "") === u ? " selected" : ""}>${u}</option>`).join("")}</select></td>
              <td class="c"><button type="button" class="svc-b ctr-det" data-det="${r.id}">⚙</button>${ed ? `<button type="button" class="cmp-del" data-del="${r.id}">✕</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">AUCUN ARTICLE : APPELER LE CPS OU AJOUTER UN ARTICLE</td></tr>`}</tbody></table></div>`,
          foot: `<button type="button" class="svc-b" data-x>${ed ? "ANNULER" : "FERMER"}</button>${ed ? `<button type="button" class="svc-b svc-ok svc-neutral" data-save>ENREGISTRER</button>` : ""}` });
      };
      const show = () => { draw(); if (!document.body.contains(d)) sviWinShow(d); };
      const rOf = el => C.rows.find(r => r.id === el.closest("tr[data-id]")?.dataset.id);
      const fill = (rows, src) => { C.rows = rows; C.src = src; show(); svToast(rows.filter(r => !r.t).length + " ARTICLE(S) LU(S) — TYPES DEVINÉS, À VÉRIFIER.", 3500); };
      const fromBlob = async (blob, src) => {
        try { const tx = await ctrText(blob); const rows = ctrParse(tx); if (!rows.filter(r => !r.t).length) { sviAlert("AUCUN « ARTICLE » TROUVÉ DANS CE DOCUMENT (PDF SCANNÉ SANS TEXTE ?). AJOUTER LES ARTICLES À LA MAIN OU COLLER LE TEXTE."); show(); return; } fill(rows, src); }
        catch (e) { sviAlert("LECTURE IMPOSSIBLE : " + (e && e.message || e)); show(); }
      };
      const srcWin = () => {
        const docs = docsLoad().filter(x => x.idb || x.data), oth = ctrOtherDocs();
        const w = sviWinNew();
        w.innerHTML = sviWinCard({ cls: "pv-card", close: "data-x", title: "APPELER LE CPS",
          body: `<div class="fz-blk">DOCUMENTS DU BUDGET ${svCnt(docs.length)}</div>${docs.map((x, i) => `<button type="button" class="fz-why" data-d="${i}"><span>${esc(x.ref)} — ${esc(x.title || x.name || "")}</span></button>`).join("") || `<div class="fz-none">AUCUN</div>`}
            <div class="fz-blk">DOCUMENTS DES AUTRES BUDGETS ${svCnt(oth.length)}</div><div class="pv-scroll">${oth.map((x, i) => `<button type="button" class="fz-why" data-o="${i}"><span>${esc(x.from)} › ${esc(x.ref)} — ${esc(x.title || x.name || "")}</span></button>`).join("") || `<div class="fz-none">AUCUN</div>`}</div>
            <div class="fz-blk">AUTRE SOURCE</div><button type="button" class="fz-why" data-f><span>FICHIER EXTÉRIEUR (PDF OU TEXTE) — CLASSÉ AUSSI DANS DOCUMENTS</span></button>
            <button type="button" class="fz-why" data-p><span>COLLER LE TEXTE DU CPS</span></button>`,
          foot: `<button type="button" class="svc-b" data-x>RETOUR</button>` });
        sviWinShow(w);
        w.addEventListener("click", async e => {
          if (e.target === w || e.target.closest("[data-x]")) { w.remove(); show(); return; }
          const b = e.target.closest("[data-d],[data-o],[data-f],[data-p]"); if (!b) return;
          if (b.dataset.d !== undefined) { const x = docs[+b.dataset.d]; w.remove(); const bl = await ctrDocBlob(x); if (!bl) { sviAlert("DOCUMENT NON DISPONIBLE SUR CET APPAREIL."); show(); return; } bl.name = x.name; await fromBlob(bl, x.ref); return; }
          if (b.dataset.o !== undefined) { const x = oth[+b.dataset.o]; w.remove(); const bl = await ctrDocBlob(x); if (!bl) { sviAlert("DOCUMENT NON DISPONIBLE SUR CET APPAREIL."); show(); return; } bl.name = x.name; await fromBlob(bl, x.from + " › " + x.ref); return; }
          if (b.dataset.f !== undefined) {
            const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".pdf,.txt,application/pdf,text/plain";
            inp.onchange = async () => { const fl = inp.files && inp.files[0]; if (!fl) return; w.remove();
              const dr = await saveExportDoc(fl, "CPS — " + fl.name.replace(/\.[a-z0-9]+$/i, ""), fl.name, fl.type);
              await fromBlob(fl, (dr || "") + " " + fl.name); };
            inp.click(); return;
          }
          if (b.dataset.p !== undefined) {
            w.innerHTML = sviWinCard({ cls: "pv-card", close: "data-x", title: "COLLER LE TEXTE DU CPS", body: `<textarea class="doc-in ctr-paste" placeholder="ARTICLE 1 : OBJET DU MARCHÉ…"></textarea>`, foot: `<button type="button" class="svc-b" data-x>RETOUR</button><button type="button" class="svc-b svc-ok svc-neutral" data-go>LIRE</button>` });
            w.querySelector("[data-go]").addEventListener("click", () => { const rows = ctrParse(w.querySelector(".ctr-paste").value); w.remove(); if (!rows.filter(r => !r.t).length) { sviAlert("AUCUN « ARTICLE » TROUVÉ DANS LE TEXTE."); show(); return; } fill(rows, "TEXTE COLLÉ"); });
          }
        });
      };
      show();
      d.addEventListener("change", e => {
        const i = e.target; if (!i.classList.contains("ctr-in")) return;
        const r = rOf(i); if (!r) return; const f = i.dataset.f;
        r[f] = f === "val" ? (i.value.trim() === "" ? "" : num(i.value)) : f === "titre" ? i.value.toUpperCase() : i.value;
        if (f === "type") { const v = ctrVal(r.type, r.txt); if ((r.val === "" || r.val === undefined) && v.val !== "") { r.val = v.val; r.u = v.u; } draw(); }
      });
      d.addEventListener("click", async e => {
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
        if (e.target.closest("[data-all]")) { filt = null; draw(); return; }
        const op = e.target.closest("[data-open]"); if (op && !e.target.closest("textarea")) { if (open.has(op.dataset.open)) open.delete(op.dataset.open); else open.add(op.dataset.open); draw(); return; }
        const dt = e.target.closest("[data-det]"); if (dt) { const r = C.rows.find(x => x.id === dt.dataset.det); INS.ctr = INS.ctr || { rows: [] }; const prev = INS.ctr; INS.ctr = C; d.remove(); ctrDetWin(C, r, () => { INS.ctr = prev; show(); }); return; }
        const del = e.target.closest("[data-del]"); if (del) { C.rows = C.rows.filter(r => r.id !== del.dataset.del); draw(); return; }
        if (e.target.closest("[data-add]")) { C.rows.push({ id: insId(), no: String(C.rows.filter(r => !r.t).length + 1), titre: "", txt: "", type: "", val: "", u: "", det: {} }); draw(); return; }
        if (e.target.closest("[data-src]")) {
          if (C.rows.length && !(await svConfirm({ title: "APPELER LE CPS", text: "LES " + C.rows.length + " LIGNES ACTUELLES DU CONTRAT SERONT REMPLACÉES PAR CELLES DU CPS.", ok: "CONTINUER" }))) { show(); return; }
          d.remove(); srcWin(); return;
        }
        if (e.target.closest("[data-save]")) { INS.ctr = C; insSave(); histLog("CONTRAT", "ENREGISTRÉ", C.rows.filter(r => !r.t).length + " ARTICLE(S)" + (C.src ? " — " + C.src : "")); d.remove(); refreshAll(); }
      });
    };
    shell.__ctrWin = des => ctrWin(des);
    shell.__ctrRec = () => ctrRecettes();
