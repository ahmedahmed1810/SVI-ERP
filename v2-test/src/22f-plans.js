    /* =========================================================
       v671 (AXE 6) : PLANS — métré sur plan (menu ⋯ du haut : PLANS ET MÉTRÉ).
       Plan = un document du budget (PDF ou image) ou un fichier extérieur (classé aussi dans DOCUMENTS).
       ÉCHELLE : deux points sur une cote connue + sa longueur (m). Mesures : LONGUEUR (ligne brisée), SURFACE (contour),
       NOMBRE (points). Chaque mesure peut remplir NBR, DIM 1, DIM 2 ou DIM 3 d'un produit du DÉTAIL PRODUITS.
       SUPERPOSER : un second plan par-dessus (béton armé / architecte), transparence réglable.
       AXES : références obligatoires, communes à l'architecte et au bureau d'études ; ajout entre deux axes en logique décimale
       (entre 1 et 2 → 1.1, 1.2… ; entre 1 et 1.1 → 1.05 ; entre B et C → B1, B2… ; entre B1 et B2 → B1.1) ; posés sur le plan.
       Réglages gardés par plan : INS.plans[réf] = { sc: px par m, ax: { v: [{ n, x }], h: [{ n, y }] }, ms: [...] }.
       ========================================================= */
    const axDec = v => { const s = String(v); return s.includes(".") ? s.split(".")[1].length : 0; };
    const axRound = v => Math.round(v * 1e6) / 1e6;
    /* nombre entre a et b selon la règle des axes */
    const axNumBetween = (a, b, taken = []) => {
      if (b === undefined || b === null) { let n = Math.floor(a) + 1; while (taken.includes(n)) n++; return n; }
      const u = 10 ** -Math.max(axDec(a), axDec(b));
      let c;
      if ((b - a) / u >= 2 - 1e-9) c = axRound(a + u);
      else if (Number.isInteger(a) && axRound(b - a) === 1) c = axRound(a + .1);
      else c = axRound((a + b) / 2);
      while (taken.includes(c) && c < b) c = axRound(c + 10 ** -axDec(c));
      return c;
    };
    /* nom d'un axe entre deux axes (chiffres, ou lettres avec suffixe) */
    const axBetween = (A, B, all = []) => {
      const isN = x => /^\d+(\.\d+)?$/.test(String(x));
      if (isN(A)) return String(axNumBetween(Number(A), B !== undefined && B !== null && B !== "" ? Number(B) : undefined, all.filter(isN).map(Number)));
      const pa = String(A).match(/^([A-Z]+)(\d+(?:\.\d+)?)?$/), pb = B ? String(B).match(/^([A-Z]+)(\d+(?:\.\d+)?)?$/) : null;
      if (!pa) return String(A) + "1";
      const sfx = all.map(x => String(x).match(/^([A-Z]+)(\d+(?:\.\d+)?)?$/)).filter(m => m && m[1] === pa[1] && m[2]).map(m => Number(m[2]));
      if (pb && pb[1] === pa[1]) return pa[1] + axNumBetween(Number(pa[2] || 0), Number(pb[2] || 0), sfx);
      /* lettres différentes (ou dernier axe) : suffixe entier suivant de la lettre du dessous */
      const a0 = Number(pa[2] || 0);
      let n = Number.isInteger(a0) ? a0 + 1 : Math.floor(a0) + 1; while (sfx.includes(n)) n++;
      return pa[1] + n;
    };
    const axSort = L => [...L].sort((a, b) => { const r = s => { const m = String(s.n).match(/^([A-Z]*)(\d+(?:\.\d+)?)?$/) || []; return [m[1] || "", Number(m[2] || 0)]; }; const x = r(a), y = r(b); return x[0].localeCompare(y[0]) || x[1] - y[1]; });

    const plWin = () => {
      INS.plans = INS.plans || {};
      const ed = INS_EDIT;
      let doc = null, ov = null, ovOp = .5, page = 1, pages = 1, zoom = 1, tool = "", pts = [], W = 0, H = 0, cfg = null;
      const d = sviWinNew();
      const docs = () => docsLoad().filter(x => (x.idb || x.data) && /pdf|image/i.test(String(x.type || "") + " " + String(x.name || "")));
      const render = async (blob, cv, pg) => {
        const ty = String(blob.type || "") + String(blob.name || "");
        if (/pdf/i.test(ty)) {
          const lib = await loadPdfJs(), pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
          const p = await pdf.getPage(Math.min(pg, pdf.numPages)), vp = p.getViewport({ scale: 2 });
          cv.width = vp.width; cv.height = vp.height;
          await p.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
          return pdf.numPages;
        }
        const url = URL.createObjectURL(blob), img = new Image();
        await new Promise((ok, ko) => { img.onload = ok; img.onerror = () => ko(new Error("IMAGE ILLISIBLE")); img.src = url; });
        cv.width = img.naturalWidth; cv.height = img.naturalHeight; cv.getContext("2d").drawImage(img, 0, 0);
        return 1;
      };
      const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
      const mVal = m => { const s = cfg.sc || 0; if (m.k === "n") return m.p.length; if (!s) return null;
        if (m.k === "l") return m.p.reduce((t, p, i) => i ? t + len(m.p[i - 1], p) : 0, 0) / s;
        let a = 0; m.p.forEach((p, i) => { const q = m.p[(i + 1) % m.p.length]; a += p[0] * q[1] - q[0] * p[1]; }); return Math.abs(a) / 2 / s / s; };
      const mU = k => k === "n" ? "U" : k === "l" ? "M" : "M2";
      const fx = v => v === null ? "— (ÉCHELLE ?)" : String(Math.round(v * 100) / 100).replace(".", ",");
      const svg = () => {
        if (!cfg) return "";
        const sw = Math.max(2, W / 600), fs = Math.max(14, W / 90);
        const ax = (cfg.ax.v || []).map(a => `<line x1="${a.x * W}" y1="0" x2="${a.x * W}" y2="${H}" class="pl-ax"/><text x="${a.x * W + 4}" y="${fs + 4}" font-size="${fs}" class="pl-axt">${esc(a.n)}</text>`).join("")
          + (cfg.ax.h || []).map(a => `<line x1="0" y1="${a.y * H}" x2="${W}" y2="${a.y * H}" class="pl-ax"/><text x="6" y="${a.y * H - 6}" font-size="${fs}" class="pl-axt">${esc(a.n)}</text>`).join("");
        const ms = (cfg.ms || []).map((m, i) => m.k === "n" ? m.p.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${sw * 3}" class="pl-m${i % 6}"/>`).join("")
          : `<poly${m.k === "s" ? "gon" : "line"} points="${m.p.map(p => p.join(",")).join(" ")}" class="pl-m${i % 6}" stroke-width="${sw}"/>`).join("");
        const cur = pts.length ? `<polyline points="${pts.map(p => p.join(",")).join(" ")}" class="pl-cur" stroke-width="${sw}"/>${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${sw * 2.5}" class="pl-curp"/>`).join("")}` : "";
        return `<svg viewBox="0 0 ${W} ${H}" class="pl-svg">${ax}${ms}${cur}</svg>`;
      };
      const paint = () => {
        const st = d.querySelector(".pl-stage"); if (!st) return;
        st.style.width = (W * zoom / 2) + "px"; st.style.height = (H * zoom / 2) + "px";
        const o = d.querySelector(".pl-ov"); if (o) o.style.opacity = ovOp;
        d.querySelector(".pl-layer").innerHTML = svg();
        const P = INS.prd.filter(r => !r.t);
        d.querySelector(".pl-list").innerHTML = (cfg && (cfg.ms || []).length ? cfg.ms.map((m, i) => `<div class="pl-mr"><i class="pl-sw${i % 6}"></i><b>${m.k === "n" ? "NOMBRE" : m.k === "l" ? "LONGUEUR" : "SURFACE"}</b> <span>${fx(mVal(m))} ${mU(m.k)}</span>
            ${ed ? `<select class="pv-in pl-prd" data-i="${i}"><option value="">PRODUIT…</option>${P.map(r => `<option value="${r.id}">${esc(r.des || "")} (${esc(r.u || "")})</option>`).join("")}</select>
            <select class="pv-in pl-f" data-i="${i}">${["nbr", "d1", "d2", "d3"].map(f => `<option value="${f}"${(m.k === "n" ? "nbr" : "d1") === f ? " selected" : ""}>${f === "nbr" ? "NBR" : "DIM " + f[1]}</option>`).join("")}</select>
            <button type="button" class="svc-b" data-send="${i}">REMPLIR</button><button type="button" class="cmp-del" data-mdel="${i}">✕</button>` : ""}</div>`).join("") : `<div class="fz-none">AUCUNE MESURE</div>`)
          + (cfg ? `<div class="fz-blk">AXES</div><div class="pl-axl">${["v", "h"].map(o => `<div><b>${o === "v" ? "VERTICAUX (CHIFFRES)" : "HORIZONTAUX (LETTRES)"}</b> ${axSort(cfg.ax[o] || []).map(a => `<span class="rat-chip">${esc(a.n)}${ed ? `<b data-axdel="${o}|${esc(a.n)}">✕</b>` : ""}</span>`).join(" ")}</div>`).join("")}</div>` : "");
        d.querySelector(".pl-hint").textContent = !doc ? "CHOISIR UN PLAN." : tool === "sc" ? "ÉCHELLE : TOUCHER LES DEUX BOUTS D'UNE COTE CONNUE." : tool === "l" ? "LONGUEUR : TOUCHER LES POINTS, PUIS TERMINER." : tool === "s" ? "SURFACE : TOUCHER LES SOMMETS DU CONTOUR, PUIS TERMINER." : tool === "n" ? "NOMBRE : TOUCHER CHAQUE ÉLÉMENT, PUIS TERMINER." : tool === "axv" || tool === "axh" ? "AXE : TOUCHER LE PLAN À L'ENDROIT DE L'AXE." : cfg && cfg.sc ? "ÉCHELLE RÉGLÉE : CHOISIR UN OUTIL DE MESURE." : "COMMENCER PAR L'ÉCHELLE.";
        d.querySelectorAll("[data-tool]").forEach(b => b.classList.toggle("on", b.dataset.tool === tool));
        const pg = d.querySelector(".pl-page"); if (pg) pg.textContent = page + " / " + pages;
      };
      const save = (what, det) => { if (!doc) return; INS.plans[doc.ref] = cfg; insSave(); if (what) histLog("PLANS", what, doc.ref + (det ? " — " + det : "")); };
      const load = async (x, pg = 1) => {
        const bl = await ctrDocBlob(x); if (!bl) { sviAlert("PLAN NON DISPONIBLE SUR CET APPAREIL."); return; }
        bl.name = x.name; doc = x; page = pg;
        cfg = JSON.parse(JSON.stringify(INS.plans[x.ref] || {})); cfg.ax = cfg.ax || { v: [], h: [] }; cfg.ms = cfg.ms || [];
        try { pages = await render(bl, d.querySelector(".pl-cv"), page); } catch (e) { sviAlert("LECTURE DU PLAN IMPOSSIBLE : " + (e && e.message || e)); return; }
        const cv = d.querySelector(".pl-cv"); W = cv.width; H = cv.height;
        d.querySelector(".pl-name").textContent = x.ref + " — " + (x.title || x.name || "");
        if (ov) { try { await render(ov.blob, d.querySelector(".pl-ov"), page); } catch (e) {} }
        paint();
      };
      /* petite saisie dans la fenêtre (pas de message Safari) */
      const plAsk = (title, val) => new Promise(ok => {
        const w = document.createElement("div"); w.className = "pl-pick";
        w.innerHTML = `<div class="pl-pk"><b>${esc(title)}</b><input class="pv-in pl-ask" value="${esc(val || "")}" autocomplete="off"><div class="svc-f"><button type="button" class="svc-b" data-c>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>OK</button></div></div>`;
        d.querySelector(".svc-card").appendChild(w);
        const i = w.querySelector(".pl-ask"); setTimeout(() => { i.focus(); i.select(); }, 30);
        const end = v => { w.remove(); ok(v); };
        w.addEventListener("click", e => { if (e.target.closest("[data-c]")) end(null); else if (e.target.closest("[data-ok]")) end(i.value.trim()); });
        i.addEventListener("keydown", e => { if (e.key === "Enter") end(i.value.trim()); });
      });
      const pickDoc = (cb, title) => {
        const L = docs(), w = document.createElement("div"); w.className = "pl-pick";
        w.innerHTML = `<div class="pl-pk"><b>${title}</b>${L.map((x, i) => `<button type="button" class="fz-why" data-i="${i}"><span>${esc(x.ref)} — ${esc(x.title || x.name || "")}</span></button>`).join("") || `<div class="fz-none">AUCUN PLAN (PDF OU IMAGE) DANS DOCUMENTS</div>`}
          <button type="button" class="fz-why" data-f><span>FICHIER EXTÉRIEUR (PDF OU IMAGE) — CLASSÉ DANS DOCUMENTS</span></button><button type="button" class="svc-b" data-c>ANNULER</button></div>`;
        d.querySelector(".svc-card").appendChild(w);
        w.addEventListener("click", async e => {
          if (e.target.closest("[data-c]")) { w.remove(); return; }
          const b = e.target.closest("[data-i]"); if (b) { w.remove(); cb(L[+b.dataset.i]); return; }
          if (e.target.closest("[data-f]")) {
            const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/pdf,image/*";
            inp.onchange = async () => { const fl = inp.files && inp.files[0]; if (!fl) return; w.remove(); const r = await saveExportDoc(fl, "PLAN — " + fl.name.replace(/\.[a-z0-9]+$/i, ""), fl.name, fl.type); const x = docsLoad().find(y => y.ref === r); if (x) cb(x); };
            inp.click();
          }
        });
      };
      d.innerHTML = sviWinCard({ cls: "cmp-card svc-full pl-card", close: "data-x", title: "PLANS ET MÉTRÉ",
        body: `<div class="cmp-bar pl-bar"><button type="button" class="svc-b" data-doc>PLAN…</button><span class="pl-name"></span>
            <button type="button" class="svc-b" data-pg="-1">‹</button><span class="pl-page">1 / 1</span><button type="button" class="svc-b" data-pg="1">›</button>
            <button type="button" class="svc-b" data-z="-1">−</button><button type="button" class="svc-b" data-z="1">+</button></div>
          <div class="cmp-bar pl-bar">${[["sc", "ÉCHELLE"], ["l", "LONGUEUR"], ["s", "SURFACE"], ["n", "NOMBRE"], ["axv", "AXE CHIFFRE"], ["axh", "AXE LETTRE"]].map(([k, l]) => `<button type="button" class="svc-b pl-tool" data-tool="${k}"${ed || k === "l" || k === "s" || k === "n" ? "" : " disabled"}>${l}</button>`).join("")}
            <button type="button" class="svc-b svc-ok svc-neutral" data-end>TERMINER</button><button type="button" class="svc-b" data-ov>SUPERPOSER…</button>
            <label class="pl-opl">TRANSPARENCE <input type="range" class="pl-op" min="0" max="1" step=".05" value=".5"></label></div>
          <div class="pl-hint pv-sub"></div>
          <div class="pl-main"><div class="pl-scroll"><div class="pl-stage"><canvas class="pl-cv"></canvas><canvas class="pl-ov"></canvas><div class="pl-layer"></div></div></div>
            <div class="pl-side"><div class="fz-blk">MESURES</div><div class="pl-list"></div></div></div>`,
        foot: `<button type="button" class="svc-b svc-ok svc-neutral" data-x>FERMER</button>` });
      sviWinShow(d);
      paint();
      /* toucher sur le plan */
      d.querySelector(".pl-stage").addEventListener("click", async e => {
        if (!doc || !tool) return;
        const r = e.currentTarget.getBoundingClientRect(), p = [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H];
        if (tool === "axv" || tool === "axh") {
          const o = tool === "axv" ? "v" : "h", L = axSort(cfg.ax[o] || []), pos = o === "v" ? p[0] / W : p[1] / H;
          const before = L.filter(a => (o === "v" ? a.x : a.y) < pos).pop(), after = L.find(a => (o === "v" ? a.x : a.y) > pos);
          const all = L.map(a => a.n);
          const n = !L.length ? (o === "v" ? "1" : "A") : before ? axBetween(before.n, after ? after.n : null, all) : (o === "v" ? String(Math.max(0, Number(L[0].n) - 1)) : String.fromCharCode(Math.max(65, L[0].n.charCodeAt(0) - 1)));
          const nm = await plAsk("NOM DE L'AXE", n); if (!nm) return;
          if (all.includes(U_(nm))) { svToast("CET AXE EXISTE DÉJÀ.", 2500); return; }
          (cfg.ax[o] = cfg.ax[o] || []).push(o === "v" ? { n: U_(nm), x: pos } : { n: U_(nm), y: pos });
          save("AXE AJOUTÉ", U_(nm)); paint(); return;
        }
        pts.push(p);
        if (tool === "sc" && pts.length === 2) {
          paint(); const v = await plAsk("LONGUEUR RÉELLE DE CETTE COTE (M)", ""); const m = num(v || 0);
          if (m > 0) { cfg.sc = len(pts[0], pts[1]) / m; save("ÉCHELLE", String(m).replace(".", ",") + " M"); }
          pts = []; tool = "";
        }
        paint();
      });
      d.addEventListener("input", e => { if (e.target.classList.contains("pl-op")) { ovOp = Number(e.target.value); paint(); } });
      d.addEventListener("click", async e => {
        if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
        if (e.target.closest("[data-doc]")) { pickDoc(x => load(x), "PLAN À MESURER"); return; }
        if (e.target.closest("[data-ov]")) { if (!doc) return; pickDoc(async x => { const bl = await ctrDocBlob(x); if (!bl) return; bl.name = x.name; ov = { x, blob: bl }; try { await render(bl, d.querySelector(".pl-ov"), page); } catch (err) { sviAlert("LECTURE IMPOSSIBLE : " + (err && err.message || err)); } paint(); }, "PLAN À SUPERPOSER"); return; }
        const pg = e.target.closest("[data-pg]"); if (pg && doc) { const n = page + Number(pg.dataset.pg); if (n >= 1 && n <= pages) load(doc, n); return; }
        const z = e.target.closest("[data-z]"); if (z) { zoom = Math.max(.25, Math.min(6, zoom * (Number(z.dataset.z) > 0 ? 1.25 : .8))); paint(); return; }
        const tl = e.target.closest("[data-tool]"); if (tl && !tl.closest(".pl-stage")) { tool = tool === tl.dataset.tool ? "" : tl.dataset.tool; pts = []; paint(); return; }
        if (e.target.closest("[data-end]")) {
          if ((tool === "l" && pts.length >= 2) || (tool === "s" && pts.length >= 3) || (tool === "n" && pts.length)) { cfg.ms.push({ k: tool, p: pts }); save("MESURE", tool === "n" ? "NOMBRE" : tool === "l" ? "LONGUEUR" : "SURFACE"); }
          pts = []; tool = ""; paint(); return;
        }
        const md = e.target.closest("[data-mdel]"); if (md) { cfg.ms.splice(+md.dataset.mdel, 1); save("MESURE SUPPRIMÉE"); paint(); return; }
        const ad = e.target.closest("[data-axdel]"); if (ad) { const [o, n] = ad.dataset.axdel.split("|"); cfg.ax[o] = (cfg.ax[o] || []).filter(a => a.n !== n); save("AXE SUPPRIMÉ", n); paint(); return; }
        const sd = e.target.closest("[data-send]");
        if (sd) {
          const i = +sd.dataset.send, m = cfg.ms[i], v = mVal(m), pid = d.querySelector(`.pl-prd[data-i="${i}"]`).value, f = d.querySelector(`.pl-f[data-i="${i}"]`).value;
          const r = INS.prd.find(x => x.id === pid);
          if (!r) { svToast("CHOISIR LE PRODUIT À REMPLIR.", 2500, sd); return; }
          if (v === null) { svToast("FAIRE D'ABORD L'ÉCHELLE.", 2500, sd); return; }
          r[f] = Math.round(v * 100) / 100; insSave(); histLog("PLANS", "MÉTRÉ → PRODUIT", (r.des || "") + " " + (f === "nbr" ? "NBR" : "DIM " + f[1]) + " = " + fx(v));
          svToast((r.des || "") + " : " + (f === "nbr" ? "NBR" : "DIM " + f[1]) + " = " + fx(v), 2500, sd); refreshAll();
        }
      });
    };
    shell.__plWin = () => plWin();
    shell.__axBetween = (a, b, all) => axBetween(a, b, all);
