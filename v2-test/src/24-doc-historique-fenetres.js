    /* ===== fenêtre DOC : ajout d'un document au budget ===== */
    /* ===== HISTORIQUE (bouton H) : journal des changements du budget
       et de ses branches (DOC, TAF, OBS, impressions, exports, disposition…) ===== */
    /* v690 : le consolidé montre l'historique de son budget mère */
    const HIST_KEY = "svi_hist_v1:" + String(budget.inst && budget.inst.virtual && !budget.inst.vname && /-GLOBAL$/.test(String(ref)) ? budget.inst.parent : ref);
    const histLoad = () => {
      try { return JSON.parse(localStorage.getItem(HIST_KEY) || "[]") || []; } catch (e) { return []; }
    };
    const histLog = (branche, action, detail = "") => {
      try {
        const l = histLoad();
        l.push({ t: new Date().toISOString(), b: branche, a: action, d: String(detail || "").toUpperCase(), u: typeof sviUser === "function" ? sviUser() : "" });
        /* libellé de l'étape pour ANNULER / RÉTABLIR (appui long) */
        if (action !== "ANNULER" && action !== "RÉTABLIR") shell.__undoLab = String(action).toUpperCase() + (detail ? " — " + String(detail).toUpperCase().slice(0, 80) : "");
        localStorage.setItem(HIST_KEY, JSON.stringify(l.slice(-1000)));
      } catch (e) {}
    };
    /* ===== HISTORIQUE : tableau avec tri / filtre par colonne (comme les autres),
       menu ⋯ (exporter, aperçu PDF A4 vertical, agrandir) ===== */
    let histBranch = "";
    const histCols = [
      ["hdt", "DATE", r => r.dt, "center"],
      ["hbr", "BRANCHE", r => r.b, ""],
      ["hac", "ACTION", r => r.a, ""],
      ["hde", "DÉTAIL", r => r.d, ""],
      ["hqui", "QUI", r => r.u || "", ""]   /* v672 (bloc 2) : nom d'utilisateur */
    ];
    const histRows = () => {
      const p2 = n => String(n).padStart(2, "0");
      const f = v => { const d = new Date(v); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} À ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
      const all = histLoad().reverse().map(h => ({ ...h, dt: f(h.t) }));
      return cfApply("hist", histCols, all.filter(h => !histBranch || h.b === histBranch));
    };
    const histData = () => {
      const oc = coOrder("hist", histCols);
      return { head: oc.map(c => c[1]), rows: histRows().map(r => oc.map(c => c[2](r))) };
    };

    const openHistory = () => {
      histBranch = "";
      const all = histLoad();
      const branches = [...new Set(all.map(h => h.b))].sort();
      const p = sviPopNew();
      p.innerHTML = `
        <div class="doc-card hist-card" role="dialog" aria-modal="true">
          <div class="doc-head">
            <span class="doc-title">HISTORIQUE ${esc(fullRef)}</span>
            <span class="hist-tools">
              <button type="button" class="blk-more hist-more" title="Actions" aria-label="Actions">⋯</button>
              <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
            </span>
          </div>
          <div class="doc-body">
            <div class="hist-filters">
              <button type="button" class="hist-f on" data-b="">TOUT ${svCnt(all.length)}</button>
              ${branches.map(b => `<button type="button" class="hist-f" data-b="${esc(b)}">${esc(b)} ${svCnt(all.filter(h => h.b === b).length)}</button>`).join("")}
            </div>
            <div class="hist-scroll"><table class="bdg-d-table hist-table" id="histTable"></table></div>
          </div>
          <div class="doc-foot">
            <button type="button" class="doc-btn doc-save" data-cancel>FERMER</button>
          </div>
        </div>`;
      sviPopShow(p);
      popEnhance(p, "hist");
      const render = () => {
        const t = p.querySelector("#histTable");
        if (!t || !document.body.contains(p)) { window.__sviHistRefresh = null; return; }
        const rows = histRows();
        const oc = coOrder("hist", histCols);
        t.innerHTML = `<thead><tr>${oc.map(c => cfHead("hist", c[0], c[1], c[3])).join("")}</tr></thead>
          <tbody>${rows.map(r => "<tr>" + oc.map(c => `<td class="${c[3]}">${esc(c[2](r))}</td>`).join("") + "</tr>").join("") ||
            `<tr><td colspan="4" class="empty">AUCUN CHANGEMENT ENREGISTRÉ</td></tr>`}</tbody>`;
      };
      window.__sviHistRefresh = render;
      render();
      const close = () => { window.__sviHistRefresh = null; document.getElementById("blkMenu")?.remove(); p.remove(); };
      p.addEventListener("click", e => {
        const cfb = e.target.closest(".cf-btn");
        if (cfb) { e.stopPropagation(); cfOpenMenu(cfb); return; }
        const fb = e.target.closest(".hist-f");
        if (fb) {
          histBranch = fb.dataset.b || "";
          p.querySelectorAll(".hist-f").forEach(x => x.classList.toggle("on", x === fb));
          render();
          return;
        }
        /* ⋯ : mêmes actions que les blocs DOC / TAF / OBS */
        const more = e.target.closest(".hist-more");
        if (more) {
          e.stopPropagation();
          const old = document.getElementById("blkMenu");
          old?.remove();
          if (old && old.dataset.for === "hist") return;
          const big = p.querySelector(".hist-card").classList.contains("hist-max");
          const m = document.createElement("div");
          m.id = "blkMenu";
          m.dataset.for = "hist";
          m.innerHTML = `
            <button type="button" data-ha="export"${histData().rows.length ? "" : ' class="off" disabled'}><span>Exporter</span></button>
            <button type="button" data-ha="pdf"${histData().rows.length ? "" : ' class="off" disabled'}><span>Aperçu PDF</span></button>
            <button type="button" data-ha="max"><span>${big ? "Réduire" : "Agrandir"}</span></button>`;
          document.body.appendChild(m);
          const r = more.getBoundingClientRect();
          sviPlaceMenu(m, r);
          m.style.zIndex = 10010;
          m.addEventListener("click", ev => {
            const it = ev.target.closest("[data-ha]");
            if (!it || it.disabled) return;
            m.remove();
            const a = it.dataset.ha;
            if (a === "max") {
              const c = p.querySelector(".hist-card");
              const on = c.classList.toggle("hist-max");
              if (on) { c.dataset.sw = c.style.width; c.dataset.sh = c.style.height; c.style.width = ""; c.style.height = ""; }
              else { c.style.width = c.dataset.sw || ""; c.style.height = c.dataset.sh || ""; }
              return;
            }
            if (!histData().rows.length) { sviAlert("Aucune donnée dans l'historique."); return; }
            if (a === "export") { close(); openExportMenu("hist"); }
            else { close(); printGeneric("hist"); }
          });
          setTimeout(() => document.addEventListener("pointerdown", function off(ev) {
            if (!ev.target.closest("#blkMenu")) { m.remove(); document.removeEventListener("pointerdown", off, true); }
          }, true), 0);
          return;
        }
        if (e.target === p || e.target.closest("[data-cancel]")) close();
      });
    };

    const DOC_KEY = "svi_docs_v1:" + String(ref);
    /* références des branches : « <PROJET> BDG <TYPE> AA-MMJJ/NNN » (ex. H88 BDG DOC 26-1010/001) */
    const REF_PFX = String(budget.project).trim().toUpperCase() + " BDG ";
    /* v717 : le CONSOLIDÉ réunit les DOCUMENTS / TAF / OBSERVATIONS de toutes ses étapes (lecture seule) ; chaque étape n'affiche que les siens */
    const AV_KEYS = pfx => AV_ROOT ? sviAvStages(AV_ROOT).map(st => pfx + String(st.ref)) : null;
    const loadKeys = K => K.flatMap(k => { try { return JSON.parse(localStorage.getItem(k) || "[]") || []; } catch (e) { return []; } });
    const docsLoad = () => {
      const K = AV_KEYS("svi_docs_v1:"); if (K) return loadKeys(K);
      try { return JSON.parse(localStorage.getItem(DOC_KEY) || "[]") || []; }
      catch (e) { return []; }
    };
    const docsSave = list => {
      try { localStorage.setItem(DOC_KEY, JSON.stringify(list)); return true; }
      catch (e) { return false; }
    };

    /* numéro : DOC AA-MMJJ/NNN (compteur du jour pour ce budget) */
    const nextDocRef = d => {
      const day = `${pad(d.getFullYear() % 100)}-${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
      const n = docsLoad().filter(x => String(x.ref).startsWith(REF_PFX + "DOC " + day)).length + 1;
      return `${REF_PFX}DOC ${day}/${pad(n, 3)}`;
    };

    const openDocForm = () => {
      const now = new Date();
      const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
      let docRef = nextDocRef(now);
      let file = null;

      const p = sviPopNew();
      p.innerHTML = `
        <div class="doc-card" role="dialog" aria-modal="true">
          <div class="doc-head">
            <span class="doc-title"><span id="docRef">${esc(docRef)}</span></span>
            <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
          </div>
          <div class="doc-body">
            <div class="doc-grid">
              <label class="doc-lab" for="docDate">DATE CRÉATION <b>*</b></label>
              <input id="docDate" class="doc-in" type="datetime-local" value="${local}">
              ${attFormHTML().replace('id="recAtt"', 'id="recAtt" data-doc="1"')}
              <label class="doc-lab" for="docTitle">INTITULÉ <b>*</b></label>
              <input id="docTitle" class="doc-in" type="text" placeholder="INTITULÉ" autocomplete="off">
              <span class="doc-lab">DOC <b>*</b></span>
              <div class="doc-file">
                <button type="button" class="doc-btn" id="docPick">TÉLÉCHARGER</button>
                <span id="docName" class="doc-fname">AUCUN DOCUMENT SÉLECTIONNÉ</span>
              </div>
              <span class="doc-lab" style="margin-left:0">DRIVE</span>
              <div class="doc-file">
                <label class="doc-lab" style="white-space:nowrap;padding:0"><input type="checkbox" id="docDriveOn" checked> COPIE DANS LE DRIVE</label>
              </div>
              <label class="doc-lab" for="docDrive" style="margin-left:0">DOSSIER DRIVE</label>
              <div class="doc-file" id="docDriveRow">
                <input id="docDrive" type="hidden" value="${esc(driveLastPath(budget.project, fullRef))}">
                <a href="#" class="drv-link" id="docDriveLink">${esc(driveLastPath(budget.project, fullRef))}</a>
                <button type="button" class="doc-flag" id="docDriveEdit" title="Changer de dossier">✎</button>
              </div>
            </div>
            <div id="docErr" class="doc-err"></div>
          </div>
          <div class="doc-foot">
            <button type="button" class="doc-btn" data-cancel>ANNULER</button>
            <button type="button" class="doc-btn doc-save" id="docSave">ENREGISTRER</button>
          </div>
        </div>`;
      sviPopShow(p);
      popEnhance(p, "doc");
      setTimeout(() => p.querySelector("#docTitle")?.focus(), 50);

      const close = () => p.remove();
      p.addEventListener("click", e => {
        if (e.target === p || e.target.closest("[data-cancel]")) close();
      });

      p.querySelector("#docDate").addEventListener("change", e => {
        const d = new Date(e.target.value);
        if (!isNaN(d)) {
          docRef = nextDocRef(d);
          p.querySelector("#docRef").textContent = docRef;
        }
      });

      /* dossier Drive affiché seulement si la copie Drive est cochée */
      const docDriveRow = () => {
        const on = p.querySelector("#docDriveOn").checked;
        p.querySelector("#docDriveRow").style.display = on ? "" : "none";
        p.querySelector('label[for="docDrive"]').style.display = on ? "" : "none";
      };
      p.querySelector("#docDriveOn").addEventListener("change", docDriveRow);
      docDriveRow();
      /* adresse en lien : ouvre le dossier ; ✎ : petite fenêtre pour en changer */
      p.querySelector("#docDriveLink").addEventListener("click", e => {
        e.preventDefault();
        driveOpenFolder(p.querySelector("#docDrive").value);
      });
      p.querySelector("#docDriveEdit").addEventListener("click", () => {
        drivePickFolder(p.querySelector("#docDrive").value, v => {
          if (!v) return;
          p.querySelector("#docDrive").value = v;
          p.querySelector("#docDriveLink").textContent = v;
        }, "VALIDER");
      });

      p.querySelector("#docPick").addEventListener("click", () => {
        const inp = document.createElement("input");
        inp.type = "file";
        inp.onchange = () => {
          file = inp.files[0] || null;
          p.querySelector("#docName").textContent =
            file ? file.name.toUpperCase() : "AUCUN DOCUMENT SÉLECTIONNÉ";
          p.querySelector("#docName").classList.toggle("ok", !!file);
        };
        inp.click();
      });

      p.querySelector("#docSave").addEventListener("click", async () => {
        const date = p.querySelector("#docDate").value;
        const title = p.querySelector("#docTitle").value.trim();
        const miss = [];
        p.querySelectorAll(".doc-in, .dt-native, .doc-file").forEach(x => x.classList.remove("bad"));
        if (!date) { miss.push("date"); p.querySelector("#docDate").classList.add("bad"); }
        if (!title) { miss.push("intitulé"); p.querySelector("#docTitle").classList.add("bad"); }
        if (!file) { miss.push("document"); p.querySelector(".doc-file").classList.add("bad"); }
        if (miss.length) {
          p.querySelector("#docErr").textContent = "À COMPLÉTER (*) : " + miss.join(", ").toUpperCase() + ".";
          return;
        }
        const dupD = findDup(docsLoad(), r => r.title, title);
        if (dupD) {
          p.querySelector("#docTitle").classList.add("bad");
          p.querySelector("#docErr").textContent = "Cet intitulé existe déjà (" + dupD.ref + ").";
          return;
        }

        /* fichier gardé sur l'appareil s'il est raisonnable (≤ 1,5 Mo) ;
           l'enregistrement sur Google Drive viendra plus tard */
        let data = null, idb = null;
        try { idb = "doc:" + ref + ":" + docRef; await sviFiles.put(idb, file); }
        catch (e) { idb = null; }
        if (!idb && file.size <= 1.5 * 1024 * 1024) {
          data = await new Promise(ok => {
            const fr = new FileReader();
            fr.onload = () => ok(fr.result);
            fr.onerror = () => ok(null);
            fr.readAsDataURL(file);
          });
        }
        const list = docsLoad();
        list.push({
          ref: docRef, date, title: title.toUpperCase(), ...(attRead() ? { att: attRead() } : {}),
          name: file.name, size: file.size, type: file.type, data, idb
        });
        histLog("DOC", "CRÉATION", docRef + " — " + title);
        if (!docsSave(list)) {
          list[list.length - 1].data = null;
          docsSave(list);
        }
        const toDrive = p.querySelector("#docDriveOn").checked;
        const dpath = driveCleanPath(p.querySelector("#docDrive").value);
        close();
        updPill("doc");
        /* copie dans le Drive (en arrière-plan) : lien gardé sur la ligne DOC */
        if (toDrive) {
          const savedRef = docRef;
          const dname = (savedRef + " " + title).replace(/[\\/:*?"<>|]+/g, "-").toUpperCase() +
            ((file.name.match(/\.[a-z0-9]+$/i) || [""])[0]).toLowerCase();
          driveSave(file, dname, dpath).then(out => {
            const l2 = docsLoad();
            const it = l2.find(x => x.ref === savedRef);
            if (it) { it.drive = out.url || ""; it.drivePath = out.path || ""; docsSave(l2); }
            histLog("DOC", "DRIVE", savedRef + " → " + (out.path || "MON DRIVE") + "/" + dname);
          }).catch(err => sviAlert("DOCUMENT " + savedRef + " ENREGISTRÉ SUR L'IPAD, MAIS PAS DANS LE DRIVE : " + driveErrText(err)));
        }
      });
    };


    /* =========================================================
       v666 (AXE 10) : DOCUMENTS RATTACHÉS — DOC, TAF et OBS rattachés à l'endroit où ils sont créés : le choix en cours (ronds)
       donne le rattachement le plus fin — CHARGE ou PRODUIT d'une tâche, TÂCHE (lot › activité secondaire), DÉSIGNATION CLIENT —,
       sinon le BUDGET. Le formulaire montre « RATTACHÉ À » (modifiable vers un niveau plus haut) avant ENREGISTRER.
       Listes : sans choix = tout (budget) ; un élément choisi = ses propres documents et ceux de ses fils
       (tâche → ses charges et produits ; désignation → ses tâches) ; un document du budget n'apparaît qu'au niveau du budget.
       ========================================================= */
    /* v719 (bloc 6, remarques 1 et 2) : RATTACHEMENT PAR LES RONDS — un DOC, un TAF ou une OBS se lie au chemin choisi par les ronds au
       moment de l'ajout, comme une liaison : désignation, lot, activité primaire ou secondaire seule, tâche (lot + activité), ou chaîne
       complète jusqu'à un produit ou une charge (plusieurs ronds pleins = le chemin entier). Aucun rond = lié au BUDGET (jamais dans
       LIGNES NON LIÉES, ne bloque ni FIGER ni ⚠ À COMPLÉTER). Le chemin est écrit en clair dans la fenêtre et la colonne RATTACHÉ À. */
    const attNm = (k, id) => { try { return lkName(k, id); } catch (e) { return ""; } };
    /* rattachement normalisé (anciens rattachements v666 : k = des / task / chg / prd) */
    const attNorm = a => {
      if (!a || a.k === "bdg") return null;
      const o = { des: a.des || "", lot: a.lot || "", prim: a.prim || "", sec: a.sec || "", prd: [], chg: [] };
      if (Array.isArray(a.prd)) o.prd = a.prd; else if (a.k === "prd" && a.id) o.prd = [a.id];
      if (Array.isArray(a.chg)) o.chg = a.chg; else if (a.k === "chg" && a.id) o.chg = [a.id];
      return o.des || o.lot || o.prim || o.sec || o.prd.length || o.chg.length ? o : null;
    };
    const attLab = a0 => {
      const a = attNorm(a0); if (!a) return "BUDGET";
      const p = [];
      if (a.des) p.push(attNm("des", a.des));
      if (a.lot) p.push(attNm("lot", a.lot));
      if (a.prim) p.push(attNm("prim", a.prim));
      if (a.sec) p.push(attNm("sec", a.sec));
      a.prd.forEach(id => p.push("PRODUIT " + (((INS && INS.prd) || []).find(r => r.id === id) || {}).des || ""));
      a.chg.forEach(id => p.push("CHARGE " + (((INS && INS.chg) || []).find(r => r.id === id) || {}).des || ""));
      return p.filter(Boolean).join(" › ") || "BUDGET";
    };
    /* chemin des ronds pleins au moment de l'ajout */
    const attNow = () => {
      if (!INS || !LK) return null;
      return attNorm({ k: "path", des: LK.des || "", lot: LK.lot || "", prim: LK.prim || "", sec: LK.sec || "", prd: Object.keys(LK.prd || {}), chg: Object.keys(LK.chg || {}) });
    };
    const attFormHTML = () => `<label class="doc-lab" for="recAtt">RATTACHÉ À</label><input id="recAtt" class="doc-in doc-ro" value="${esc(attLab(attNow()))}" readonly>`;
    const attRead = () => { const a = attNow(); return a ? { k: "path", ...a } : null; };
    /* v720 (remarque 3) : filtre par les CASES CARRÉES des autres blocs (comme DÉTAIL CHARGES, PRODUITS, DÉLAIS) — seuls restent les
       éléments liés à ce qui est coché ; un élément du BUDGET seul disparaît dès qu'un filtre par cases est actif ; sans case : tout */
    const attFilter = list => {
      if (!INS) return list;
      let OL = null; try { OL = insCheckLinks("rec", true); } catch (e) { OL = null; }
      if (!OL) return list;
      return list.filter(r => { const a = attNorm(r.att); if (!a) return false;
        return OL.some(l => (!a.des || l.des === a.des) && (!a.lot || l.lot === a.lot) && (!a.prim || l.prim === a.prim) && (!a.sec || l.sec === a.sec)
          && a.prd.every(id => (l.prd || []).some(y => y.id === id)) && a.chg.every(id => (l.chg || []).some(y => y.id === id))); });
    };
    /* ===== fenêtres OBS et TAF (même présentation que DOC) ===== */
    const recKey = kind => "svi_" + kind + "_v1:" + String(ref);
    const recLoad = kind => {
      if (kind === "doc") return docsLoad();
      { const K = AV_KEYS("svi_" + kind + "_v1:"); if (K) return loadKeys(K); }
      try { return JSON.parse(localStorage.getItem(recKey(kind)) || "[]") || []; }
      catch (e) { return []; }
    };
    const recSave = (kind, list) => {
      try { localStorage.setItem(recKey(kind), JSON.stringify(list)); } catch (e) {}
    };
    const nextRecRef = (kind, d) => {
      const day = `${pad(d.getFullYear() % 100)}-${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
      const tag = kind.toUpperCase();
      const n = recLoad(kind).filter(x => String(x.ref).startsWith(REF_PFX + tag + " " + day)).length + 1;
      return `${REF_PFX}${tag} ${day}/${pad(n, 3)}`;
    };
    const updPill = kind => {
      const pill = shell.querySelector(`[data-pill="${kind}"]`);
      const n = recLoad(kind).length;
      if (pill) pill.innerHTML = SVI_ICON[kind] + `<span class="pl">${kind.toUpperCase()} ${svCnt(n)}</span>`;
      renderRec(kind);
      if (kind === "obs") {
        const imp = recLoad("obs").filter(r => r.important).length;
        const b = $("obsAlertBtn");
        if (b) b.hidden = !imp;
        const c = $("obsAlertN");
        if (c) c.textContent = imp;
        const rb = $("refBang");
        if (rb) rb.innerHTML = obsBang(ref);
      }
    };

    /* ===== bloc SUIVI : onglets DOCUMENTS / TAF / OBSERVATIONS ===== */
    let recActive = "doc";
    try { recActive = localStorage.getItem("svi_rectab_v1") || "doc"; } catch (e) {}
    if (!["doc", "taf", "obs"].includes(recActive)) recActive = "doc";
    const recTabApply = () => {
      shell.querySelectorAll(".rec-tab").forEach(b => b.classList.toggle("active", b.dataset.rtab === recActive));
      shell.querySelectorAll(".blk-suivi .rec-scroll").forEach(d => { d.hidden = d.dataset.pane !== recActive; });
    };

    /* colonnes : [clé, libellé, accesseur, classe] (même moteur que les autres tableaux) */
    const recCols = {
      doc: [["rref", "RÉFÉRENCE", r => r.ref, ""],
            ["rtitle", "INTITULÉ", r => r.title, ""],
            ["rexp", "EXPIRÉ", r => r.expired ? "OUI" : "NON", "center"], ["ratt", "RATTACHÉ À", r => attLab(r.att), ""]],
      taf: [["rref", "RÉFÉRENCE", r => r.ref, ""],
            ["robj", "OBJET TAF", r => r.objet || "", ""], ["rtext", "DESCRIPTIF TAF", r => r.text, ""],
            ["rresp", "RESPONSABLE", r => r.responsable, ""], ["rprev", "PRÉVU LE", r => fmtDT(r.prevu), ""],
            ["rdelay", "DÉLAI PLANIFIÉ", r => hm(new Date(r.prevu) - new Date(r.date)), "number"],
            ["relap", "DURÉE ÉCOULÉE", r => hm(Date.now() - new Date(r.date)), "number"], ["ratt", "RATTACHÉ À", r => attLab(r.att), ""]],
      obs: [["rref", "RÉFÉRENCE", r => r.ref, ""],
            ["rimp", "!", r => r.important ? "!" : "", "center"], ["rtext", "INTITULÉ", r => r.text, ""], ["ratt", "RATTACHÉ À", r => attLab(r.att), ""]]
    };
    /* largeurs : catalogue des colonnes (12, SVI_COL) */
    /* plus récent en premier (ordre par défaut, sans tri choisi) */
    const recSorted = kind => recLoad(kind).map((r, i) => ({ ...r, _i: i }))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b._i - a._i);
    const recShown = {};
    const recTableData = kind => {
      const cols = recCols[kind];
      const rows = recShown[kind] || cfApply(kind, cols, attFilter(recSorted(kind)), true);
      const oc = coOrder(kind, cols);
      return { head: oc.map(c => c[1]), rows: rows.map(r => oc.map(c => c[2](r))) };
    };

    const renderRec = kind => {
      const t = $("recTable-" + kind);
      if (!t) return;
      const cols = recCols[kind];
      const tot0 = recSorted(kind), all = attFilter(tot0);   /* v720 : filtre par les cases carrées des autres blocs */
      const list = cfApply(kind, cols, all);
      recShown[kind] = list;
      const title = $("recTitle-" + kind);
      if (title) { title.innerHTML = SVI_ICON[kind] + esc(blkName[kind]) + " " + svCnt(list.length, tot0.length);
        const c = title.querySelector(".svi-cnt"); if (c) c.classList.toggle("cnt-filt", list.length < tot0.length); }   /* v720 : même repère que les onglets (bleu, toucher = FILTRES ACTIFS) */
      if (title) title.classList.toggle("tab-filt", Object.keys(cfT(kind).f || {}).length > 0);   /* v499 (remarque 40) */
      const st = cfT(kind);
      title?.classList.remove("cf-on");   /* pas de bleu d'onglet pour un filtre (loupe) */
      if (title) sviMarkEmptyTabs(title.parentNode);

      const rows = list.map(r => "<tr>" + cols.map(([k, , get, cls]) => {
        const v = get(r);
        /* DOCUMENTS : la référence est le lien vers le fichier */
        if (kind === "doc" && k === "rref" && (r.data || r.idb || r.drive))
          return `<td><button type="button" class="rec-open" data-recopen="${r._i}" title="Ouvrir le document">${esc(v)}</button></td>`;
        if (k === "rimp")
          return `<td class="center"><button type="button" class="rec-flag ${r.important ? "on" : ""}" data-obsflag="${r._i}"
            title="${r.important ? "Désactiver" : "Activer"} l'alerte">!</button></td>`;
        if (k === "rexp")
          return `<td class="center"><input type="checkbox" class="rec-exp" data-docexp="${r._i}" ${r.expired ? "checked disabled" : ""}
            title="${r.expired ? "Expiré le " + esc(fmtDT(r.expiredAt)) : "Marquer comme expiré (définitif)"}"></td>`;
        if (k === "relap" && Date.now() > new Date(r.prevu))
          return `<td class="number rec-late" title="Échéance dépassée">${esc(v)}</td>`;
        return `<td class="${cls}" title="${esc(v)}">${esc(v)}</td>`;
      }).join("") + "</tr>").join("");
      /* v688 : plus de boutons DOC / TAF / OBS en haut : on saisit ici, comme dans les autres tableaux */
      const fill = (!list.length && all.length ? `<tr><td colspan="${cols.length}" class="empty">AUCUNE LIGNE (FILTRE)</td></tr>` : "") +
        `<tr class="rec-new" data-recnew="${kind}"><td colspan="${cols.length}">${{ doc: "CRÉER UN DOCUMENT ICI…", taf: "CRÉER UN TAF ICI…", obs: "CRÉER UNE OBSERVATION ICI…" }[kind] || "CRÉER ICI…"}</td></tr>`;

      t.style.width = cwTableW(kind, cols) + "px";
      t.innerHTML = `<colgroup>${cwCols(kind, cols)}</colgroup>
        <thead><tr>${cols.map(([k, lab, , cls]) => cfHead(kind, k, lab, cls)).join("")}</tr></thead>
        <tbody>${rows}${fill}</tbody>`;
      coApply(kind, t);
    };

    /* fenêtre INF : informations du budget */
