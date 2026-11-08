/* =========================================================
   v783 : APERÇU UNIQUE — éditeur MISE EN PAGE par blocs (repris d'achats.html)
   sviMep.open(doc) — doc = {
     key   : type de document (sa mise en page est gardée sous ce nom : « CMF », « BDG-BPU », « LISTE-ACH-CMF »…),
     title : titre du document, ref : référence, party : client / fournisseur, date : date du document (texte),
     prelim: true = filigrane VERSION PRÉLIMINAIRE,
     cols  : [[clé, libellé, "number" | "center" | ""]], rows : [[cellules…]] (ou html : tableau tout fait),
     tot   : [[libellé, valeur]] (TOTAUX), fields : { projet, ttc, numFrs, lettres, mention, soc } (blocs « champ »),
     note  : texte sous les TOTAUX (v819 : montant en lettres, mention à reporter),
     name  : nom du fichier PDF, save : async (blob, nom) => référence classée (GÉNÉRER PDF = classer dans DOCUMENTS) }
   Volet : ENTÊTE, PIED, CACHET, SIGNATURE (pages), PORTRAIT / PAYSAGE, MISE EN PAGE, GÉNÉRER PDF, IMPRIMER SANS CLASSER.
   MISE EN PAGE : glisser / redimensionner chaque bloc, texte libre ou champ, alignements, police, taille, couleur,
   gras / italique / souligné, fond, superposition ; colonnes du tableau (affichage, ordre, largeur, RESTE) ;
   ENREGISTRER (pour ce type de document), RÉTABLIR LA MISE EN PAGE STANDARD, ANNULER.
   ========================================================= */
const sviMep = (() => {
  const LKEY = "svi_mep_v1", OKEY = "svi_mep_opt_v1";
  const ls = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const PW = { p: [794, 1123], l: [1123, 794] };
  const DEF = { entete: { x: 40, y: 24, w: 714, h: 96 }, date: { x: 414, y: 136, w: 340, h: 26, al: "right" }, titre: { x: 60, y: 176, w: 674, h: 36, al: "center" },
    frs: { x: 60, y: 214, w: 674, h: 40, al: "center" }, ref: { x: 60, y: 260, w: 674, h: 50, al: "left" }, corps: { x: 40, y: 318, w: 714, h: 540 },
    totaux: { x: 474, y: 600, w: 280, h: 90, flow: true }, sign: { x: 404, y: 880, w: 170, h: 120 }, cachet: { x: 584, y: 880, w: 170, h: 120 }, pied: { x: 40, y: 1040, w: 714, h: 66 } };
  const LBL = { entete: "ENTÊTE", date: "DATE", titre: "TITRE", frs: "CLIENT / FOURNISSEUR", ref: "RÉFÉRENCE", corps: "TABLEAU", totaux: "TOTAUX", sign: "SIGNATURE", cachet: "CACHET", pied: "PIED DE PAGE" };
  const FIX = ["entete", "pied", "sign", "cachet", "corps"], TXT = ["date", "titre", "frs", "ref"], STY = ["date", "titre", "frs", "ref", "corps", "totaux", "pied", "entete"];
  /* v925 (remarque 6) : Times, police non réglable ; texte à 10 pt (13,3 px), titres plus grands */
  const FS = { date: 13.3, titre: 24, frs: 22, ref: 16, corps: 13.3, totaux: 13.3, pied: 13.3, entete: 13.3 }, BOLD = ["date", "titre", "frs", "ref"];
  const FLD = [["date", "DATE (VILLE, LE …)"], ["ddoc", "DATE DU DOCUMENT"], ["ref", "RÉFÉRENCE"], ["frs", "CLIENT / FOURNISSEUR"], ["titre", "TITRE DU DOCUMENT"], ["projet", "PROJET"], ["numFrs", "N° DOCUMENT TIERS"], ["ttc", "MONTANT TTC"], ["lettres", "MONTANT EN LETTRES"], ["mention", "MENTION À REPORTER (N° DE LA PIÈCE)"], ["soc", "ICE ET IF DE LA SOCIÉTÉ"], ["ent", "ENTREPRISE"]];
  const isX = k => String(k).startsWith("x_");
  const E = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  let D = null, O = null, ED = null, SEL = null, ROOT = null, RES = null;
  const opt0 = () => Object.assign({ ent: true, pied: true, sign: false, cachet: false, signPg: "last", cachetPg: "last", open: true }, ls.get(OKEY, {}));
  /* mise en page d'un type de document (orientation comprise) ; paysage : positions standard étirées */
  const layOf = (key, o) => { const all = ls.get(LKEY, {}), u = all[key] || {}, orient = o || u.__o || "p", L = { __o: orient };
    const sx = orient === "l" ? PW.l[0] / PW.p[0] : 1, sy = orient === "l" ? PW.l[1] / PW.p[1] : 1;
    Object.keys(DEF).forEach(k => { const d = DEF[k]; L[k] = Object.assign({ ...d, x: Math.round(d.x * sx), y: Math.round(d.y * sy), w: Math.round(d.w * sx), h: Math.round(d.h * sy) }, u.__o === orient ? u[k] || {} : {}); });
    if (u.__o === orient) Object.keys(u).filter(isX).forEach(k => L[k] = { ...u[k] });
    return L; };
  /* B28 : chaque champ imprimé (D.auto = [[id, libellé, valeur]]) a son bloc, placé d'office, déplaçable, à cacher pour une impression */
  const autoAdd = y => { (D.auto || []).forEach(([id], n) => { const k = "x_a_" + id; if (!y[k]) y[k] = { kind: "field", field: "a_" + id, auto: true, x: 60, y: 870 + n * 24, w: 330, h: 22, al: "left" }; }); return y; };
  const L = () => autoAdd(ED || layOf(D.key, O.orient));
  const today = () => { const m = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"], n = new Date(); return "Agadir, le " + String(n.getDate()).padStart(2, "0") + " " + m[n.getMonth()] + " " + n.getFullYear(); };
  const field = f => f === "date" ? today() : f === "ddoc" ? E(D.date || "") : f === "ref" ? E(D.ref || "") : f === "frs" ? E(D.party || "") : f === "titre" ? E(D.title || "") : f === "ent" ? "SVI" : E((D.fields || {})[f] ?? "");
  /* colonnes visibles, ordre et largeurs (%) — RESTE = la colonne qui prend la place libre */
  const colsOf = b => { const all = (D.cols || []).map((c, i) => [c[0] || "c" + i, c[1], c[2] || "", i]); const ord = (b.order || []).filter(k => all.some(c => c[0] === k)); all.forEach(c => { if (!ord.includes(c[0])) ord.push(c[0]); });
    const vis = b.vis ? b.vis.filter(k => all.some(c => c[0] === k)) : all.map(c => c[0]); const rest = b.rest !== undefined ? b.rest : ((all.find(c => !c[2]) || all[0] || [])[0] || "");
    return { all: ord.map(k => all.find(c => c[0] === k)), vis, rest }; };
  const tableHTML = (b, rows, head = true) => {
    if (D.html) return D.html;
    /* tableau tout fait (budget) : titres repris sur chaque page, lignes découpées */
    if (D.trs) return `<table class="mep-t mep-raw">${D.colgroup || ""}${head ? D.thead || "" : ""}<tbody>${rows.join("")}</tbody></table>`;
    const C = colsOf(b), shown = C.all.filter(c => C.vis.includes(c[0])), w = k => k === C.rest ? 0 : ((b.cw || {})[k] ?? (shown.length > 6 ? 9 : 14));
    return `<table class="mep-t"><colgroup>${shown.map(c => w(c[0]) ? `<col style="width:${w(c[0])}%">` : "<col>").join("")}</colgroup>`
      + (head ? `<tr>${shown.map(c => `<th>${E(c[1])}</th>`).join("")}</tr>` : "")
      + rows.map(r => `<tr>${shown.map(c => { const v = r[c[3]]; return `<td class="${c[2] === "number" ? "nm" : c[2] === "center" ? "c" : ""}">${E(typeof v === "number" ? (typeof money === "function" ? money(v) : v) : v ?? "")}</td>`; }).join("")}</tr>`).join("") + "</table>"; };
  const totHTML = () => D.endHtml ? D.endHtml : (D.tot || []).length ? `<table class="mep-tot"><colgroup><col style="width:55%"><col style="width:45%"></colgroup>${D.tot.map(([l, v]) => `<tr><th>${E(l)}</th><td>${E(typeof v === "number" ? (typeof money === "function" ? money(v) : v) : v)}</td></tr>`).join("")}</table>${D.note ? `<div class="mep-note">${E(D.note).replace(/\n/g, "<br>")}</div>` : ""}` : D.note ? `<div class="mep-note">${E(D.note).replace(/\n/g, "<br>")}</div>` : "";
  const sty = (k, b) => (b.va && b.va !== "top" ? "display:flex;flex-direction:column;justify-content:" + (b.va === "middle" ? "center" : "flex-end") + ";" : "")
    + "font-size:" + (b.fs || FS[k] || 13) + "px;" + (b.col ? "color:" + b.col + ";" : "") + ((b.b !== undefined ? b.b : BOLD.includes(k)) ? "font-weight:700;" : "font-weight:400;") + (b.i ? "font-style:italic;" : "") + (b.u ? "text-decoration:underline;" : "")
    + (b.bg ? "background:#fff;" : "") + (k === "corps" ? (b.rh !== undefined ? "--rp:" + b.rh + "px;" : "") + (b.hbg ? "--hbg:" + b.hbg + ";" : "") : "") + "z-index:" + (b.z || 1) + ";";
  const blockHTML = (k, b, inner, ed, pos) => `<div class="mep-b mep-${k.replace(/^x_.*/, "x")}${ed ? " ed" : ""}${ed && SEL === k ? " sel" : ""}" data-pb="${k}" style="left:${pos.x}px;top:${pos.y}px;width:${pos.w}px;${(k === "corps" || k === "totaux") && !ed ? "min-height" : "height"}:${pos.h}px;text-align:${b.al || "left"};${sty(k, b)}">${inner}${ed ? `<span class="mep-lb">${isX(k) ? (b.kind === "text" ? "TEXTE" : "CHAMP") : LBL[k]}</span><span class="mep-rz" data-rz="${k}"></span>` : ""}</div>`;
  /* pages : la première porte tous les blocs ; le tableau continue sur les pages suivantes (entête et pied repris), TOTAUX, SIGNATURE et CACHET sur la dernière */
  const pagesHTML = () => {
    const Ly = L(), ed = !!ED, [W, H] = PW[Ly.__o || "p"], rows = D.trs || D.rows || [];
    const inner = {
      /* F6 : logo et lignes d'EN-TÊTE / PIED DE PAGE pris dans SOCIÉTÉ (rien d'écrit dans le code) */
      entete: O.ent || ed ? (() => { const lg = typeof sviSocImg === "function" ? sviSocImg("logo") : "", L = typeof sviSocLines === "function" ? sviSocLines("hdr") : [];
        return (lg ? `<img src="${lg}" alt="">` : "") + (L.length ? `<div class="mep-hd">${L.map(E).join("<br>")}</div>` : "") || (ed ? "EN-TÊTE" : ""); })() : "",
      date: "<b>" + today() + "</b>", titre: D.titleHtml || E(D.title || ""), frs: E(D.party || ""), ref: D.refHtml || "RÉFÉRENCE : " + E(D.ref || ""),
      sign: (O.sign || ed) ? (() => { const u = ls.get("svi_sign_v1", null) || (typeof sviSocImg === "function" ? sviSocImg("sign") : ""); return u ? `<img src="${u}" alt="">` : ed ? "SIGNATURE" : ""; })() : "",
      cachet: (O.cachet || ed) ? (() => { const u = typeof sviSocImg === "function" ? sviSocImg("cachet") : ""; return u ? `<img src="${u}" alt="" class="mep-stamp">` : ed ? "CACHET" : ""; })() : "",
      pied: O.pied || ed ? `<div class="mep-ft">${D.footHtml || (typeof sviSocLines === "function" ? sviSocLines("ftr").map(E).join("<br>") : "")}</div>` : "" };
    const cb = Ly.corps, pages = [];
    /* découpe des lignes : mesure réelle dans un conteneur caché, à la largeur du bloc TABLEAU */
    let chunks = [rows];
    if (!ed && !D.html && rows.length) {
      const m = document.createElement("div"); m.className = "mep-measure"; m.style.cssText = "position:absolute;left:-99999px;top:0;width:" + cb.w + "px;" + sty("corps", cb);
      m.innerHTML = tableHTML(cb, rows); document.body.appendChild(m);
      const t = m.querySelector("table"), hh = t.tHead ? t.tHead.offsetHeight : t.rows[0] ? t.rows[0].offsetHeight : 0, rh = [...(t.tBodies[0] && D.trs ? t.tBodies[0].rows : [...t.rows].slice(1))].map(r => r.offsetHeight); m.remove();
      const cap1 = Math.max(cb.h, 120), capN = (Ly.pied.y - 20) - (Ly.entete.y + Ly.entete.h + 20);
      chunks = []; let cur = [], used = hh, cap = cap1;
      rows.forEach((r, i) => { if (cur.length && used + rh[i] > cap) { chunks.push(cur); cur = []; used = hh; cap = capN; } cur.push(r); used += rh[i]; });
      chunks.push(cur);
    }
    chunks.forEach((ch, pi) => {
      const first = pi === 0, last = pi === chunks.length - 1; let h = "";
      Object.keys(Ly).filter(k => k !== "__o").forEach(k => {
        const b = Ly[k]; if (b.hide) return;
        if (!first && !["entete", "pied", "corps", "totaux", "sign", "cachet"].includes(k)) return;
        if (!last && ["totaux", "sign", "cachet"].includes(k) && !ed) return;
        if (k === "sign" && !ed && O.signPg === "first" && !first) return; if (k === "cachet" && !ed && O.cachetPg === "first" && !first) return;
        if (k === "sign" && !ed && O.signPg === "last" && !last) return; if (k === "cachet" && !ed && O.cachetPg === "last" && !last) return;
        let html = isX(k) ? (b.kind === "text" ? E(b.txt || (ed ? "TEXTE" : "")).replace(/\n/g, "<br>") : field(b.field)) : k === "corps" ? tableHTML(b, ch) : k === "totaux" ? totHTML() : inner[k];
        if (!html && !ed) return;
        let pos = { x: b.x, y: b.y, w: b.w, h: b.h };
        if (k === "corps" && !first) pos = { ...pos, y: Ly.entete.y + Ly.entete.h + 20, h: (Ly.pied.y - 20) - (Ly.entete.y + Ly.entete.h + 20) };
        h += blockHTML(k, b, html, ed, pos);
      });
      pages.push(`<div class="mep-pw"><div class="mep-pg${ed ? " lay" : ""}" style="width:${W}px;height:${H}px">${D.prelim && !ed ? `<div class="mep-wm" style="${D.wmColor ? "color:" + D.wmColor : ""}">${E(D.wmText || "VERSION PRÉLIMINAIRE")}</div>` : ""}${h}${chunks.length > 1 ? `<div class="mep-no">${pi + 1} / ${chunks.length}</div>` : ""}</div></div>`);
    });
    /* B29 : page ANNEXE (ex. clauses particulières de la commande) : entête et pied repris, articles numérotés */
    if (D.annex && (D.annex.items || []).length && !ed) {
      let h = ""; ["entete", "pied"].forEach(k => { const b = Ly[k]; if (b && !b.hide && inner[k]) h += blockHTML(k, b, inner[k], false, { x: b.x, y: b.y, w: b.w, h: b.h }); });
      const y = Ly.entete.y + Ly.entete.h + 20, cb = Ly.corps;
      h += `<div class="mep-annex" style="position:absolute;left:${cb.x}px;top:${y}px;width:${cb.w}px;font-size:${cb.fs || 12}px"><div class="mep-ax-t">ANNEXE — ${E(D.annex.title || "")} — ${E(D.ref || "")}</div>
        ${D.annex.items.map((x, i) => `<div class="mep-ax-i"><b>ARTICLE ${i + 1}${x[0] ? " — " + E(x[0]) : ""}</b>${x[1] ? " : " + E(x[1]) : ""}</div>`).join("")}</div>`;
      pages.push(`<div class="mep-pw"><div class="mep-pg" style="width:${W}px;height:${H}px">${h}</div></div>`);
    }
    return pages.join("");
  };
  /* volet de gauche */
  const sideHTML = () => {
    const ck = (k, l) => `<label class="mep-c"><input type="checkbox" data-po="${k}"${O[k] ? " checked" : ""}> ${l}</label>`;
    const pg = (k, dis) => `<select data-po="${k}"${dis ? " disabled" : ""}>${[["last", "DERNIÈRE PAGE"], ["first", "PREMIÈRE PAGE"], ["all", "TOUTES LES PAGES"]].map(o => `<option value="${o[0]}"${O[k] === o[0] ? " selected" : ""}>${o[1]}</option>`).join("")}</select>`;
    const orient = (ED || layOf(D.key, O.orient)).__o || "p";
    let h = `<div class="mep-h"><b>${ED ? "MISE EN PAGE" : "APERÇU"}</b><button type="button" class="mep-ib" data-act="close" title="Fermer">✕</button></div>`;
    if (!ED) {
      h += `<div class="mep-s">${E(D.title || "")} — ${E(D.ref || "")}</div><div class="mep-l">ORIENTATION</div><div class="mep-al"><button type="button" class="mep-btn${orient === "p" ? " on" : ""}" data-or="p">PORTRAIT</button><button type="button" class="mep-btn${orient === "l" ? " on" : ""}" data-or="l">PAYSAGE</button></div>`;
      h += ck("ent", "ENTÊTE") + ck("pied", "PIED DE PAGE") + ck("cachet", "CACHET") + `<div class="mep-sub"><div class="mep-l">PAGES CACHET</div>${pg("cachetPg", !O.cachet)}</div>`
        + ck("sign", "SIGNATURE") + `<div class="mep-sub"><div class="mep-l">PAGES SIGNATURE</div>${pg("signPg", !O.sign)}</div>`;
      h += `<button type="button" class="mep-btn mep-mp" data-act="edit">MISE EN PAGE</button>${D.save ? `<button type="button" class="mep-btn mep-g" data-act="pdf">GÉNÉRER PDF</button>` : ""}<button type="button" class="mep-btn" data-act="print">IMPRIMER SANS CLASSER</button>`
        + `<div class="mep-s">${D.save ? "GÉNÉRER PDF CLASSE LE DOCUMENT DANS DOCUMENTS. " : ""}IMPRIMER NE LE CLASSE PAS.</div><div class="mep-msg" id="mepMsg"></div>`;
      return h;
    }
    const b = SEL && ED[SEL];
    h += `<div class="mep-l">AJOUTER UN BLOC</div><select data-ladd><option value="">CHOISIR…</option><option value="text">TEXTE LIBRE</option>${FLD.map(f => `<option value="${f[0]}">CHAMP : ${f[1]}</option>`).join("")}</select>`;
    h += `<div class="mep-l">BLOC SÉLECTIONNÉ</div><div class="mep-blk">${b ? (isX(SEL) ? (b.kind === "text" ? "TEXTE" : "CHAMP") : LBL[SEL]) : "AUCUN — TOUCHER UN BLOC DE LA PAGE"}</div>`;
    if (b && isX(SEL) && b.kind === "text") h += `<div class="mep-l">TEXTE DU BLOC</div><textarea class="mep-tx" data-ltxt rows="3">${E(b.txt || "")}</textarea>`;
    if (b && isX(SEL) && b.kind === "field") h += `<div class="mep-l">CHAMP AFFICHÉ</div><select data-lfld>${FLD.map(f => `<option value="${f[0]}"${b.field === f[0] ? " selected" : ""}>${f[1]}</option>`).join("")}</select>`;
    if (b) {
      const btns = (lab, attr, list, cur) => `<div class="mep-l">${lab}</div><div class="mep-al">${list.map(o => `<button type="button" class="mep-btn${cur === o[0] ? " on" : ""}" ${attr}="${o[0]}">${o[1]}</button>`).join("")}</div>`;
      h += btns("ALIGNEMENT VERTICAL", "data-lva", [["top", "HAUT"], ["middle", "CENTRÉ"], ["bottom", "BAS"]], b.va || "top");
      if (TXT.includes(SEL) || isX(SEL)) h += btns("ALIGNEMENT", "data-lal", [["left", "GAUCHE"], ["center", "CENTRE"], ["right", "DROITE"]], b.al || "left");
      if (STY.includes(SEL) || isX(SEL)) {
        const isB = b.b !== undefined ? b.b : BOLD.includes(SEL);
        h += `<div class="mep-l">TAILLE DES CARACTÈRES</div><div class="mep-al"><button type="button" class="mep-btn" data-lfs="-1">A −</button><span class="mep-fs">${b.fs || FS[SEL] || 13} px</span><button type="button" class="mep-btn" data-lfs="1">A +</button></div>`
          + `<div class="mep-l">COULEUR</div><div class="mep-al"><input type="color" data-lcol value="${b.col || "#000000"}">${["#000000", "#1f2430", "#2050d8", "#ca3a31", "#4ba054", "#8a909c"].map(c => `<button type="button" class="mep-sw${(b.col || "#000000") === c ? " on" : ""}" data-lcs="${c}" style="background:${c}"></button>`).join("")}</div>`
          + `<div class="mep-l">STYLE</div><div class="mep-al"><button type="button" class="mep-btn${isB ? " on" : ""}" data-lst="b" style="font-weight:800">G</button><button type="button" class="mep-btn${b.i ? " on" : ""}" data-lst="i" style="font-style:italic">I</button><button type="button" class="mep-btn${b.u ? " on" : ""}" data-lst="u" style="text-decoration:underline">S</button></div>`;
      }
      h += btns("FOND", "data-lbg", [["0", "TRANSPARENT"], ["1", "BLANC"]], b.bg ? "1" : "0") + `<div class="mep-l">SUPERPOSITION</div><div class="mep-al"><button type="button" class="mep-btn" data-lz="up">AU PREMIER PLAN</button><button type="button" class="mep-btn" data-lz="down">ARRIÈRE-PLAN</button></div>`;
      if (SEL === "corps" && !D.html && (D.cols || []).length) {
        const C = colsOf(b);
        h += `<div class="mep-l">HAUTEUR DES LIGNES</div><div class="mep-al"><button type="button" class="mep-btn" data-lrh="-1">−</button><span class="mep-fs">${b.rh ?? 4} px</span><button type="button" class="mep-btn" data-lrh="1">+</button></div>`
          + `<div class="mep-l">COLONNES : AFFICHAGE, ORDRE, RESTE ET LARGEUR (%)</div><div class="mep-cw">` + C.all.map((c, i, a) => { const on = C.vis.includes(c[0]), isR = c[0] === C.rest, w = (b.cw || {})[c[0]] ?? (C.vis.length > 6 ? 9 : 14);
            return `<div class="mep-cwr${on ? "" : " off"}"><input type="checkbox" data-lvis="${c[0]}"${on ? " checked" : ""}><span>${E(c[1])}</span><button type="button" class="mep-btn" data-lord="${c[0]}|-1"${i ? "" : " disabled"}>▲</button><button type="button" class="mep-btn" data-lord="${c[0]}|1"${i < a.length - 1 ? "" : " disabled"}>▼</button>`
              + `<input type="radio" name="mepRest" data-lrest="${c[0]}"${isR ? " checked" : ""} title="RESTE">${isR ? "<i>RESTE</i>" : `<button type="button" class="mep-btn" data-lcw="${c[0]}|-1">−</button><b>${w}</b><button type="button" class="mep-btn" data-lcw="${c[0]}|1">+</button>`}</div>`; }).join("") + "</div>";
      }
      if (!FIX.includes(SEL)) h += `<button type="button" class="mep-btn mep-x" data-act="del">SUPPRIMER CE BLOC</button>`;
      h += `<div class="mep-l">POSITION (PX)</div><div class="mep-blk">X ${Math.round(b.x)} · Y ${Math.round(b.y)} · L ${Math.round(b.w)} · H ${Math.round(b.h)}</div>`;
    }
    h += `<button type="button" class="mep-btn mep-g" data-act="save">ENREGISTRER LA MISE EN PAGE</button><button type="button" class="mep-btn" data-act="reset">RÉTABLIR LA MISE EN PAGE STANDARD</button><button type="button" class="mep-btn" data-act="cancel">ANNULER</button>`;
    return h;
  };
  const fit = () => { if (!ROOT) return; const area = ROOT.querySelector(".mep-area"), W = PW[L().__o || "p"][0], k = Math.min(1, (area.clientWidth - 40) / W);
    ROOT.querySelectorAll(".mep-pg").forEach(p => { p.style.transform = "scale(" + k + ")"; p.parentNode.style.height = (p.offsetHeight * k + 16) + "px"; p.parentNode.style.width = (W * k) + "px"; }); ROOT.dataset.k = k;
    /* TOTAUX : à la suite du tableau (dernière page) */
    const Ly = L(), pgs = ROOT.querySelectorAll(".mep-pg"), lastPg = pgs[pgs.length - 1];
    if (Ly.totaux && Ly.totaux.flow && lastPg) { const tb = lastPg.querySelector(".mep-totaux"), cp = lastPg.querySelector(".mep-corps"); if (tb && cp) { const t = cp.querySelector("table"), y = cp.offsetTop + (t ? t.offsetHeight : 0) + 12; tb.style.top = y + "px"; tb.style.left = (cp.offsetLeft + cp.offsetWidth - Ly.totaux.w) + "px"; } } };
  const draw = () => { if (!ROOT) return; ROOT.querySelector(".mep-side").innerHTML = sideHTML(); ROOT.querySelector(".mep-pages").innerHTML = pagesHTML(); requestAnimationFrame(fit); };
  const saveO = () => { const o = { ...O }; delete o.orient; ls.set(OKEY, o); };
  const load = src => new Promise((ok, ko) => { if (document.querySelector(`script[src="${src}"]`)) return ok(); const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
  const genPdf = async () => {
    const msg = ROOT.querySelector("#mepMsg"); if (msg) msg.textContent = "PRÉPARATION DU PDF…";
    await load("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"); await load("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    const orient = L().__o || "p", pdf = new window.jspdf.jsPDF({ orientation: orient === "l" ? "landscape" : "portrait", unit: "mm", format: "a4" });
    const pgs = [...ROOT.querySelectorAll(".mep-pg")];
    for (let i = 0; i < pgs.length; i++) { const p = pgs[i], tr = p.style.transform; p.style.transform = "none";
      const c = await window.html2canvas(p, { scale: 2, backgroundColor: "#fff", useCORS: true }); p.style.transform = tr;
      if (i) pdf.addPage("a4", orient === "l" ? "landscape" : "portrait"); const [w, h] = orient === "l" ? [297, 210] : [210, 297]; pdf.addImage(c.toDataURL("image/jpeg", .92), "JPEG", 0, 0, w, h); }
    return pdf.output("blob");
  };
  const click = async e => {
    const t = e.target, a = t.closest && t.closest("[data-act]");
    if (t.closest("[data-or]")) { O.orient = t.closest("[data-or]").dataset.or; const all = ls.get(LKEY, {}), u = all[D.key] || {}; if (u.__o !== O.orient) { all[D.key] = { __o: O.orient }; ls.set(LKEY, all); } draw(); return; }
    if (a) { const k = a.dataset.act;
      if (k === "close") { close(); return; }
      if (k === "edit") { ED = JSON.parse(JSON.stringify(layOf(D.key, O.orient))); SEL = null; draw(); return; }
      if (k === "cancel") { ED = null; SEL = null; draw(); return; }
      if (k === "reset") { ED = JSON.parse(JSON.stringify(layOf("__std__", ED.__o))); SEL = null; draw(); svToast && svToast("MISE EN PAGE STANDARD RÉTABLIE (PENSER À ENREGISTRER).", 2500); return; }
      if (k === "save") { const all = ls.get(LKEY, {}); all[D.key] = ED; ls.set(LKEY, all); ED = null; SEL = null; draw(); svToast && svToast("MISE EN PAGE ENREGISTRÉE POUR CE TYPE DE DOCUMENT.", 2500); return; }
      if (k === "del") { if (ED && SEL) { if (isX(SEL) && !ED[SEL].auto) delete ED[SEL]; else ED[SEL].hide = true; SEL = null; draw(); } return; }
      if (k === "print") { document.body.classList.add("mep-printing"); const st = document.createElement("style"); st.id = "mepPage"; st.textContent = "@page { size: A4 " + ((L().__o || "p") === "l" ? "landscape" : "portrait") + "; margin: 0; }"; document.head.appendChild(st);
        const back = () => { document.body.classList.remove("mep-printing"); st.remove(); fit(); window.removeEventListener("afterprint", back); }; window.addEventListener("afterprint", back);
        ROOT.querySelectorAll(".mep-pg").forEach(p => { p.style.transform = "none"; }); window.print(); setTimeout(back, 1500); return; }
      if (k === "pdf") { a.disabled = true; try { const blob = await genPdf(), nm = (D.name || ((D.ref || "") + " " + (D.title || ""))).replace(/[\\/:*?"<>|]+/g, "-").trim() + ".pdf"; const r = await D.save(blob, nm); const m = ROOT.querySelector("#mepMsg"); if (m) m.textContent = r ? "CLASSÉ DANS DOCUMENTS : " + r : "PDF GÉNÉRÉ."; }
        catch (err) { const m = ROOT.querySelector("#mepMsg"); if (m) m.textContent = "ÉCHEC DE LA GÉNÉRATION DU PDF."; } a.disabled = false; return; }
    }
    if (!ED) return;
    const b = SEL && ED[SEL]; if (!b) return;
    const st = (fn) => { fn(); draw(); };
    if (t.closest("[data-lva]")) return st(() => { b.va = t.closest("[data-lva]").dataset.lva; });
    if (t.closest("[data-lal]")) return st(() => { b.al = t.closest("[data-lal]").dataset.lal; });
    if (t.closest("[data-lfs]")) return st(() => { b.fs = Math.max(6, Math.min(60, (b.fs || FS[SEL] || 13) + +t.closest("[data-lfs]").dataset.lfs)); });
    if (t.closest("[data-lcs]")) return st(() => { b.col = t.closest("[data-lcs]").dataset.lcs; });
    if (t.closest("[data-lst]")) return st(() => { const s = t.closest("[data-lst]").dataset.lst; if (s === "b") b.b = !(b.b !== undefined ? b.b : BOLD.includes(SEL)); else b[s] = !b[s]; });
    if (t.closest("[data-lbg]")) return st(() => { b.bg = t.closest("[data-lbg]").dataset.lbg === "1"; });
    if (t.closest("[data-lz]")) return st(() => { const zs = Object.keys(ED).filter(k => k !== "__o").map(k => ED[k].z || 1); b.z = t.closest("[data-lz]").dataset.lz === "up" ? Math.min(60, Math.max(...zs) + 1) : Math.max(0, Math.min(...zs) - 1); });
    if (t.closest("[data-lrh]")) return st(() => { b.rh = Math.max(0, Math.min(20, (b.rh ?? 4) + +t.closest("[data-lrh]").dataset.lrh)); });
    if (t.closest("[data-lord]")) return st(() => { const [k, dd] = t.closest("[data-lord]").dataset.lord.split("|"), C = colsOf(b), ord = C.all.map(c => c[0]), i = ord.indexOf(k), j = i + +dd; if (j < 0 || j >= ord.length) return; [ord[i], ord[j]] = [ord[j], ord[i]]; b.order = ord; });
    if (t.closest("[data-lcw]")) return st(() => { const [k, dd] = t.closest("[data-lcw]").dataset.lcw.split("|"), C = colsOf(b); b.cw = b.cw || {}; b.cw[k] = Math.max(3, Math.min(80, ((b.cw[k] ?? (C.vis.length > 6 ? 9 : 14)) + +dd))); });
  };
  const change = e => { const t = e.target; if (t.matches("[data-po]")) { O[t.dataset.po] = t.type === "checkbox" ? t.checked : t.value; saveO(); draw(); return; }
    if (!ED) return; const b = SEL && ED[SEL];
    if (t.matches("[data-ladd]") && t.value) { const k = "x_" + Date.now().toString(36), W = PW[ED.__o || "p"][0]; ED[k] = { kind: t.value === "text" ? "text" : "field", field: t.value === "text" ? "" : t.value, txt: t.value === "text" ? "TEXTE" : "", x: W / 2 - 120, y: 60, w: 240, h: 30, al: "left" }; SEL = k; draw(); return; }
    if (!b) return;
    if (t.matches("[data-lfld]")) { b.field = t.value; draw(); }
    if (t.matches("[data-lcol]")) { b.col = t.value; draw(); }
    if (t.matches("[data-lvis]")) { const C = colsOf(b), v = new Set(C.vis); if (t.checked) v.add(t.dataset.lvis); else v.delete(t.dataset.lvis); b.vis = C.all.map(c => c[0]).filter(k => v.has(k)); draw(); }
    if (t.matches("[data-lrest]")) { b.rest = t.dataset.lrest; draw(); } };
  const input = e => { const t = e.target; if (ED && SEL && t.matches("[data-ltxt]")) { ED[SEL].txt = t.value; const n = ROOT.querySelector(`.mep-b[data-pb="${SEL}"]`); if (n && n.firstChild && n.firstChild.nodeType === 3) n.firstChild.textContent = t.value; } };
  /* glisser / redimensionner un bloc (doigt ou souris) */
  const down = e => { if (!ED) return; const blk = e.target.closest(".mep-b.ed"); if (!blk) return; e.preventDefault();
    const k = blk.dataset.pb, rz = !!e.target.closest("[data-rz]"), sc = +(ROOT.dataset.k || 1), b = ED[k]; if (k === "totaux") b.flow = false;
    const o = { x: b.x, y: b.y, w: b.w, h: b.h }, sx = e.clientX, sy = e.clientY, [W, H] = PW[ED.__o || "p"];
    if (SEL !== k) { SEL = k; ROOT.querySelector(".mep-side").innerHTML = sideHTML(); ROOT.querySelectorAll(".mep-b.sel").forEach(x => x.classList.remove("sel")); blk.classList.add("sel"); }
    const mv = ev => { const dx = (ev.clientX - sx) / sc, dy = (ev.clientY - sy) / sc;
      if (rz) { b.w = Math.max(30, Math.min(W - b.x, o.w + dx)); b.h = Math.max(16, o.h + dy); } else { b.x = Math.max(0, Math.min(W - b.w, o.x + dx)); b.y = Math.max(0, Math.min(H - 16, o.y + dy)); }
      blk.style.left = b.x + "px"; blk.style.top = b.y + "px"; blk.style.width = b.w + "px"; blk.style.height = b.h + "px"; };
    const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); ROOT.querySelector(".mep-side").innerHTML = sideHTML(); };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); };
  const close = () => { if (ROOT) ROOT.remove(); ROOT = null; ED = null; SEL = null; document.body.classList.remove("mep-open"); if (RES) window.removeEventListener("resize", RES); };
  const open = doc => {
    close(); D = doc || {}; O = opt0(); O.orient = (ls.get(LKEY, {})[D.key] || {}).__o || D.orient || "p";
    ROOT = document.createElement("div"); ROOT.id = "sviMep"; ROOT.innerHTML = `<aside class="mep-side"></aside><div class="mep-area"><div class="mep-pages"></div></div>`;
    document.body.appendChild(ROOT); document.body.classList.add("mep-open");
    ROOT.addEventListener("click", click); ROOT.addEventListener("change", change); ROOT.addEventListener("input", input); ROOT.addEventListener("pointerdown", down);
    RES = () => fit(); window.addEventListener("resize", RES);
    draw();
  };
  return { open, close, layOf };
})();
window.sviMep = sviMep;

/* v784 : APERÇU d'une LISTE (liste des budgets, listes des achats) — ⋯ du titre de la liste ; le tableau affiché (filtres compris) */
/* v785 : les listes ont la même barre que le budget (ANNULER, RÉTABLIR, PRÉCÉDENT, SUIVANT, ALERTES, FERMER, ⋯) ; ce qui est sans objet est grisé et dit pourquoi */
/* 07/11 (document unique 3.1, « tout doit être uniforme ») : i et H aussi dans la barre du haut des LISTES (et du PARAMÉTRAGE)
   i = informations de la liste (pièces par état, totaux des montants, filtres en cours) ; H = historique de toutes les pièces de la liste, les plus récentes d'abord */
const sviListIH = () => `<span class="bdg-d-badge bdg-d-inf nvl-inf" role="button" title="Informations">i</span><span class="bdg-d-badge nvl-h" role="button" title="Historique">H</span>`;
const sviListCtx = b => { const sh = b.closest(".novapp-list-shell, .view"), t = sh && [...sh.querySelectorAll("table")].find(x => x.offsetParent !== null && x.tHead);
  const h1 = sh && sh.querySelector(".novapp-list-titlebar h1, .section-head h1, .section-head h2"), ttl = h1 ? String(h1.childNodes[0] ? h1.childNodes[0].textContent : h1.textContent).trim() : "";
  const rows = t ? [...t.tBodies].flatMap(tb => [...tb.rows]).filter(r => r.offsetParent !== null && !r.matches(".bdg-newrow, .ins-new, .rec-new, [data-nvnew], .ach-new") && !/ICI…/.test(r.textContent)) : [];
  return { sh, t, ttl, rows }; };
const sviListRef = r => { const c = r.querySelector(".nv-reflink, .bdg-ref-c, td"); return c ? String(c.textContent || "").replace(/^!\s*/, "").replace(/\s+/g, " ").trim() : ""; };
function sviListInfo(b) { const { t, ttl, rows } = sviListCtx(b), d = sviWinNew();
  const stL = { instance: "EN INSTANCE", fige: "FIGÉ", remis: "REMIS", encours: "EN COURS DE VALIDATION", partiel: "PARTIELLEMENT ACHEVÉ", valide: "VALIDÉ", expire: "EXPIRÉ", bloque: "BLOQUÉ", archive: "ARCHIVÉ", annule: "ANNULÉ" };
  const stOf = r => r.dataset.st || ((String(r.className).match(/\b(?:st|nvr|inst)-([a-z]+)\b/) || [])[1]) || "";
  const N = {}; rows.forEach(r => { const k = stOf(r) || "—"; N[k] = (N[k] || 0) + 1; });
  const H = t ? [...t.tHead.rows[t.tHead.rows.length - 1].cells] : [], tot = [];
  H.forEach((h, j) => { const lab = String(h.textContent || "").replace(/\s+/g, " ").trim(); if (!/MONTANT|TOTAL|RESTE|TTC|HT\b/.test(lab)) return;
    let s = 0, n = 0; rows.forEach(r => { const c = r.cells[j]; if (!c) return; const v = String(c.textContent || "").replace(/[\s  ]/g, "").replace(",", "."); if (/^-?\d+(\.\d+)?$/.test(v)) { s += +v; n++; } }); if (n) tot.push([lab, s]); });
  const F = H.filter(h => h.classList.contains("cf-on")).map(h => String(h.textContent || "").replace(/\s+/g, " ").trim());
  const f2 = v => v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: "INFORMATIONS — " + esc(ttl || "LISTE"),
    body: `<div class="svc-scroll"><table class="prm-table"><thead><tr><th>ÉTAT</th><th class="number">PIÈCES</th></tr></thead><tbody>
      ${Object.entries(N).map(([k, n]) => `<tr><td>${esc(stL[k] || k.toUpperCase())}</td><td class="number">${n}</td></tr>`).join("")}<tr class="bdg-d-total-row"><td>TOTAL AFFICHÉ</td><td class="number">${rows.length}</td></tr></tbody></table>
      ${tot.length ? `<table class="prm-table"><thead><tr><th>COLONNE</th><th class="number">TOTAL</th></tr></thead><tbody>${tot.map(([l, v]) => `<tr><td>${esc(l)}</td><td class="number">${f2(v)}</td></tr>`).join("")}</tbody></table>` : ""}
      <table class="prm-table"><thead><tr><th>FILTRES EN COURS</th></tr></thead><tbody>${F.length ? F.map(x => `<tr><td>${esc(x)}</td></tr>`).join("") : `<tr><td>AUCUN FILTRE DE COLONNE</td></tr>`}</tbody></table></div>`,
    foot: `<button type="button" class="svc-b" data-x>FERMER</button>` });
  sviWinShow(d); d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) d.remove(); }); }
function sviListHist(b) { const { ttl, rows } = sviListCtx(b), d = sviWinNew(), L = [];
  const get = k => { try { return JSON.parse(localStorage.getItem(k) || "[]") || []; } catch (e) { return []; } };
  [...new Set(rows.map(sviListRef).filter(Boolean))].forEach(ref => { get("svi_hist_v1:" + ref).concat(get("svi_hist_v1:ACH-" + ref)).forEach(h => L.push({ ...h, ref })); });
  L.sort((a, c) => String(c.t || "").localeCompare(String(a.t || "")));
  const dt = v => { try { return new Date(v).toLocaleString("fr-FR").replace(" ", " À ").slice(0, 21); } catch (e) { return ""; } };
  d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: "HISTORIQUE — " + esc(ttl || "LISTE"),
    body: `<div class="svc-scroll"><table class="prm-table"><thead><tr><th>DATE</th><th>RÉFÉRENCE</th><th>ACTION</th><th>DÉTAIL</th><th>PAR</th></tr></thead><tbody>
      ${L.slice(0, 500).map(h => `<tr><td>${esc(dt(h.t))}</td><td>${esc(h.ref)}</td><td>${esc(String(h.a || "").toUpperCase())}</td><td>${esc(String(h.d || "").toUpperCase())}</td><td>${esc(String(h.u || "").toUpperCase())}</td></tr>`).join("")}</tbody></table></div>`,
    foot: `<button type="button" class="svc-b" data-x>FERMER</button>` });
  sviWinShow(d); d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) d.remove(); }); }
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest(".nvl-inf, .nvl-h"); if (!b) return; e.stopPropagation(); e.preventDefault(); if (b.classList.contains("nvl-inf")) sviListInfo(b); else sviListHist(b); }, true);
const sviListBar = () => sviHdrBar({ attr: "nvl", why: { undo: "RIEN À ANNULER DANS LA LISTE.", redo: "RIEN À RÉTABLIR DANS LA LISTE.", prev: "LISTE : PAS D'ÉCRAN PRÉCÉDENT.", next: "LISTE : PAS D'ÉCRAN SUIVANT.", todo: "AUCUNE ALERTE.", close: "LISTE : RIEN À FERMER (MENU ☰ POUR CHANGER D'ÉCRAN)." } });
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest(".svi-hdr .hdr-off[data-why]"); if (!b || b.closest(".bdg-d-sticky .bdg-d-hright:not(.svi-hdr)")) return; e.stopPropagation(); e.preventDefault(); svToast(b.dataset.why, 3000, b); }, true);
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest(".nvl-more"); if (!b) return;
  e.stopPropagation();
  const shell = b.closest(".novapp-list-shell"), t = shell ? shell.querySelector("table") : sviColhTableNear(b), h1 = shell ? shell.querySelector(".novapp-list-titlebar h1") : b.closest("#ach")?.querySelector(".section-head h2, .section-head h1");
  /* v818 : actions propres à une liste, ajoutées par son module (SVI_LIST_EXTRA : { when(titre), items, act(k) }) */
  const ttl = h1 ? (h1.childNodes[0] ? h1.childNodes[0].textContent : h1.textContent).trim() : "", EX = (window.SVI_LIST_EXTRA || []).filter(x => { try { return x.when(ttl); } catch (er) { return false; } });
  /* série J (J4) : SUPPRIMER LES … COCHÉ(E)S — remplace la corbeille des lignes ; grisé sans case cochée ; compteur des cases cochées */
  const SD = t && t.dataset.sdel && (window.SVI_LDEL || {})[t.dataset.sdel], CK = SD ? [...t.querySelectorAll("tbody tr")].filter(r => r.querySelector(".nvl-cb:checked")).map(r => r.dataset.budgetRef || r.dataset.id).filter(Boolean) : [];
  const delG = SD ? [{ k: "__ldel", lab: SD.lab, del: true, n: CK.length, off: CK.length ? "" : "COCHER D'ABORD LES LIGNES À SUPPRIMER (CASES À DROITE)." }] : [];
  sviHdrMenu(b, [sviColhItems(t), EX.flatMap(x => x.items), [{ k: "apr", lab: "APERÇU" }], [{ k: "__fmt", lab: "MODIFIER LE FORMAT" }, { k: "__lay", lab: "DISPOSITION PAR DÉFAUT" }], delG].filter(g => g.length), async a => {
    if (a === "__ldel") { const ok = CK.filter(SD.ok), no = CK.filter(x => !SD.ok(x));
      if (!ok.length) { svToast("AUCUNE LIGNE COCHÉE N'EST EN INSTANCE : RIEN À SUPPRIMER.", 3500, b); return; }
      if (!(await svConfirm({ title: SD.lab, text: ok.length + " SUPPRIMÉE(S) : " + ok.map(SD.nom).join(", ") + "." + (no.length ? " NON SUPPRIMÉE(S) (PAS EN INSTANCE) : " + no.map(SD.nom).join(", ") + "." : ""), ok: "SUPPRIMER" }))) return;
      await SD.run(ok); svToast(ok.length + " LIGNE(S) SUPPRIMÉE(S).", 2500); return; }
    if (a === "__fmt") { sviFmtCurWin(); return; }   /* v927 (remarque 12) */
    { const x = EX.find(y => y.items.some(i => i.k === a)); if (x) { x.act(a); return; } }
    /* v920 (remarque 1) : DISPOSITION PAR DÉFAUT aussi dans les listes — colonnes d'origine, puis la liste est redessinée */
    if (a === "__lay") { sviLayAsk().then(go => { if (!go) return; sviLayReset(shell || (t && t.closest("section, .novapp-list-shell")) || document);
      const v = b.closest("#ach"); if (v && v.__achTab) { let k = "art"; try { k = localStorage.getItem("svi_ach_tab_v1") || "art"; } catch (e) {} v.__achTab(k); }
      else if (typeof renderBudgetList === "function") renderBudgetList(); }); return; }
    if (!t || sviColhPick(a, t)) return;
    const vis = sviColhVis(t);
    const ths = [...t.tHead.rows[0].cells].map(th => (th.querySelector(".cf-lab") || th).textContent.trim()), keep = ths.map((x, i) => x && vis.includes(i) ? i : -1).filter(i => i >= 0);
    const num = i => [...t.tBodies[0].rows].some(r => r.cells[i] && r.cells[i].classList.contains("number"));
    /* v793 : lignes cochées (cases à droite de la liste) s'il y en a, sinon toutes les lignes affichées */
    const R0 = [...t.tBodies[0].rows].filter(r => !r.matches(".bdg-newrow, .ach-new, .rec-new") && !r.querySelector("td.empty") && r.cells.length >= keep.length), RC = R0.filter(r => r.querySelector(".nvl-cb:checked"));
    const rows = (RC.length ? RC : R0).map(r => keep.map(i => (r.cells[i] ? r.cells[i].textContent.replace(/\s+/g, " ").trim() : "")));
    const title = h1 ? h1.childNodes[0].textContent.trim() || h1.textContent.trim() : "LISTE";
    sviMep.open({ key: "LISTE-" + title.replace(/\s*\(.*$/, "").replace(/[^A-Z0-9É]+/gi, "-").toUpperCase(), orient: "l", title, ref: new Date().toLocaleDateString("fr-FR"), party: rows.length + " LIGNE(S)",
      cols: keep.map((i, j) => ["c" + j, ths[i], num(i) ? "number" : ""]), rows, name: title + " " + new Date().toISOString().slice(0, 10) });
  });
}, true);
