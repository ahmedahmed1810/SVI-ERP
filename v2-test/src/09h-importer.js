/* =========================================================
   v1137 (série L, L26 ; document unique 10.9, validé le 12/11/2026) : IMPORTER COMMUN — une seule fenêtre partout.
   sviImport(o) → Promise<{ rows, from, file, extra } | null> ; rien n'est enregistré ici (l'interface enregistre après OK).
   o = {
     title  : « IMPORTER DANS … »,
     cols   : colonnes de destination [{ k, lab, rx (en-tête reconnu), num }] — par défaut DÉSIGNATION, U, QUANTITÉ, PRIX,
     file   : true = FICHIER (Excel, CSV, texte, PDF, Word, photo ou scan) ; docs : [{ lab, get: async () => File }] (documents de la pièce),
     online : true = lien Google Sheets ; clip : true = PRESSE-PAPIERS,
     app    : [{ lab, run: async () => ({ rows, from, extra }) | null }] (DEPUIS L'APPLICATION : sources propres à l'interface),
     key    : r => clé d'une ligne (doublons) ; have : Set des clés déjà présentes (ignorées) }
   Ligne : { des, u, q, pu } ou { title } (titre de groupe) ; imp: true = lue dans un PDF, un fichier Word ou une photo (arrive en rouge, à vérifier).
   ========================================================= */
const SVI_IMP_COLS = [{ k: "des", lab: "DÉSIGNATION", rx: /D[ÉE]SIGNATION|LIBELL|DESCRIPTION|ARTICLE|NATURE/i }, { k: "u", lab: "U", rx: /^U\.?$|^UNIT/i },
  { k: "q", lab: "QUANTITÉ", rx: /QT[ÉE]|QUANT/i, num: true }, { k: "pu", lab: "PRIX", rx: /^P\.?\s?U|PRIX/i, num: true }];
const sviImpNum = v => { const t = String(v ?? "").trim(); return /^-?[\d\s  ]*[.,]?\d+$/.test(t) ? parseFloat(t.replace(/[\s  ]/g, "").replace(",", ".")) : NaN; };
const sviImpLoad = (src, glob) => window[glob] ? Promise.resolve(window[glob]) : new Promise((ok, ko) => { const sc = document.createElement("script"); sc.src = src;
  sc.onload = () => window[glob] ? ok(window[glob]) : ko(new Error("OUTIL DE LECTURE INDISPONIBLE")); sc.onerror = () => ko(new Error("OUTIL DE LECTURE INDISPONIBLE (CONNEXION ?)")); document.head.appendChild(sc); });
const sviPdfLib = () => window.pdfjsLib ? Promise.resolve(window.pdfjsLib) : sviImpLoad("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js", "pdfjsLib").then(L => { try { L.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; } catch (e) {} return L; });
/* reconnaissance du texte d'une image (photo, scan, page de PDF sans texte) — Tesseract, français */
async function sviOcr(img, msg) { const T = await sviImpLoad("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js", "Tesseract");
  const r = await T.recognize(img, "fra", { logger: m => { if (msg && m && m.status === "recognizing text") msg("LECTURE DE L'IMAGE… " + Math.round((m.progress || 0) * 100) + " %"); } }); return (r && r.data && r.data.text) || ""; }
async function sviPdfRead(blob, msg) { const lib = await sviPdfLib(), pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise, lines = [];
  for (let i = 1; i <= pdf.numPages; i++) { const tc = await (await pdf.getPage(i)).getTextContent(); let y = null, ln = "";
    tc.items.forEach(it => { const yy = Math.round(it.transform[5]); if (y !== null && Math.abs(yy - y) > 2) { lines.push(ln); ln = ""; } y = yy; ln += (ln && !ln.endsWith(" ") ? " " : "") + it.str; }); if (ln) lines.push(ln); }
  if (lines.join("").trim()) return lines.join("\n");
  /* PDF scanné (sans texte) : chaque page passe par la lecture d'image */
  const out = []; for (let i = 1; i <= pdf.numPages; i++) { const pg = await pdf.getPage(i), vp = pg.getViewport({ scale: 2 }), cv = document.createElement("canvas"); cv.width = vp.width; cv.height = vp.height;
    await pg.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise; if (msg) msg("PAGE " + i + " / " + pdf.numPages); out.push(await sviOcr(cv, msg)); }
  return out.join("\n"); }
/* Word (.docx) : tableaux lus tels quels ; sans tableau, le texte */
async function sviDocxRead(blob) { const M = await sviImpLoad("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js", "mammoth");
  const r = await M.convertToHtml({ arrayBuffer: await blob.arrayBuffer() }), box = document.createElement("div"); box.innerHTML = r.value || "";
  const T = [...box.querySelectorAll("table")].map(t => [...t.rows].map(tr => [...tr.cells].map(c => c.textContent.replace(/\s+/g, " ").trim()))).sort((a, b) => b.length - a.length)[0];
  return T && T.length ? { aoa: T } : { text: [...box.querySelectorAll("p, li, h1, h2, h3")].map(p => p.textContent.trim()).join("\n") }; }
/* texte (PDF, Word sans tableau, photo) → lignes : « [N°] DÉSIGNATION  U  QUANTITÉ  [PRIX] » ; le reste ignoré */
function sviImpText(txt) { const out = [], NUM = "(?:\\d{1,3}(?:[\\s\\u00a0\\u202f]\\d{3})+|\\d+)(?:[.,]\\d+)?";
  const RE = new RegExp("^(?:\\d+(?:[.]\\d+)*[.)]?\\s+)?(.+?)\\s+(U|UN|M|ML|M2|M²|M3|M³|KG|T|TONNE|L|LITRE|ENS|ENSEMBLE|FF|FORFAIT|PCE|PC|PIECE|PIÈCE|SAC|H|J|JOUR|BOITE|ROULEAU|PAIRE|LOT)\\.?\\s+(" + NUM + ")(?:\\s+(" + NUM + "))?", "i");
  String(txt || "").split(/\n/).forEach(l => { const m = l.trim().match(RE); if (!m) return; const q = sviImpNum(m[3].trim()); if (!(q > 0)) return;
    out.push({ des: m[1].replace(/\s+/g, " ").trim(), u: m[2].toUpperCase().replace("M²", "M2").replace("M³", "M3"), q, pu: m[4] && !isNaN(sviImpNum(m[4].trim())) ? sviImpNum(m[4].trim()) : "", imp: true }); });
  return out; }
/* tableau : ligne d'en-tête et colonnes reconnues (sinon devinées : la plus longue en texte = désignation, puis unité courte, quantité, prix) */
function sviImpGuess(A, cols) { let h = -1, C = {};
  for (let i = 0; i < Math.min(A.length, 15) && h < 0; i++) { const c = {}; A[i].forEach((v, j) => cols.forEach(cc => { if (c[cc.k] === undefined && cc.rx && cc.rx.test(v) && !(cc.k === "des" && /PRIX/i.test(v))) c[cc.k] = j; }));
    if (c.des !== undefined && (c.q !== undefined || cols.length < 3)) { h = i; C = c; } }
  /* v1139 : en-tête reconnu même sans colonne QUANTITÉ (ex. une colonne collée qui commence par « DÉSIGNATION ») */
  if (h < 0 && A.length) { const c = {}; A[0].forEach((v, j) => cols.forEach(cc => { if (c[cc.k] === undefined && cc.rx && cc.rx.test(v) && !(cc.k === "des" && /PRIX/i.test(v))) c[cc.k] = j; }));
    if (c.des !== undefined && A[0].every(v => isNaN(sviImpNum(v)))) { h = 0; C = c; } }
  if (h < 0 && A.length) { const n = Math.max(...A.map(r => r.length)), avg = j => A.reduce((s, r) => s + (isNaN(sviImpNum(r[j])) ? (r[j] || "").length : 0), 0) / A.length;
    let d = 0; for (let j = 1; j < n; j++) if (avg(j) > avg(d)) d = j; C.des = d;
    for (let j = 0; j < n; j++) { if (j === d) continue; const num = A.filter(r => !isNaN(sviImpNum(r[j]))).length, sh = A.filter(r => r[j] && isNaN(sviImpNum(r[j])) && r[j].length <= 5).length;
      if (j > d && C.u === undefined && sh >= A.length / 3) C.u = j; else if (j > d && C.q === undefined && num >= A.length / 3) C.q = j; else if (j > d && C.pu === undefined && C.q !== undefined && num >= A.length / 3) C.pu = j; } }
  return { h, C }; }
function sviImpFromAoa(A, h, C) { const out = []; A.slice(h + 1).forEach(r => { const des = String(r[C.des] ?? "").replace(/\s+/g, " ").trim(), q = C.q !== undefined ? sviImpNum(r[C.q]) : NaN;
    if (!des || /^TOTAL|^SOUS[- ]TOTAL/i.test(des)) return;
    if (C.q !== undefined && (isNaN(q) || q <= 0)) { if (!(C.u !== undefined && r[C.u])) out.push({ title: des }); return; }
    out.push({ des, u: C.u !== undefined ? String(r[C.u] ?? "").trim() : "", q: isNaN(q) ? "" : q, pu: C.pu !== undefined && !isNaN(sviImpNum(r[C.pu])) ? sviImpNum(r[C.pu]) : "" }); });
  return out; }
const sviImpAoaText = t => { const L = String(t || "").replace(/\r/g, "").split("\n").filter(l => l.trim()); const sep = L.some(l => l.includes("\t")) ? "\t" : L.some(l => l.includes(";")) ? ";" : null;
  return L.map(l => sep ? l.split(sep).map(v => v.trim()) : [l.trim()]); };
/* lecture d'un fichier → { aoa } (tableau) ou { rows } (texte reconnu, à vérifier) */
async function sviImpFile(f, msg) { const nm = String(f.name || "").toLowerCase() + " " + String(f.type || "");
  if (/\.pdf\b|application\/pdf/.test(nm)) { msg && msg("LECTURE DU PDF…"); return { rows: sviImpText(await sviPdfRead(f, msg)) }; }
  if (/\.docx\b|wordprocessingml/.test(nm)) { msg && msg("LECTURE DU FICHIER WORD…"); const r = await sviDocxRead(f); return r.aoa ? { aoa: r.aoa, imp: true } : { rows: sviImpText(r.text) }; }
  if (/image\/|\.(png|jpe?g|heic|webp|gif|bmp)\b/.test(nm)) { msg && msg("LECTURE DE L'IMAGE…"); return { rows: sviImpText(await sviOcr(f, msg)) }; }
  if (/\.json\b|application\/json/.test(nm)) { const J = JSON.parse(await f.text()), L = Array.isArray(J) ? J : (J.rows || J.lignes || []);
    return { rows: L.filter(x => x && (x.des || x.title)).map(x => x.title ? { title: x.title } : { des: x.des, u: x.u || "", q: x.q ?? "", pu: x.pu ?? x.p ?? "" }) }; }
  if (/\.txt\b|text\/plain/.test(nm)) return { aoa: sviImpAoaText(await f.text()) };
  const X = await loadXLSX(), wb = /\.csv\b|text\//.test(nm) ? X.read(await f.text(), { type: "string", raw: true }) : X.read(await f.arrayBuffer(), { type: "array" });
  return { aoa: X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false }).map(r => r.map(v => String(v ?? "").trim())) }; }
/* choix dans une liste, avec recherche et TOUT COCHER (lignes affichées) — sources DEPUIS L'APPLICATION */
function sviImpPick(title, items, one) { return new Promise(ok => { const d = sviWinNew(); let q = "", shown = [];
  const vis = () => items.filter(x => !q || String(x.lab).toUpperCase().includes(q));
  const keep = () => { const S = new Set([...d.querySelectorAll(".simp-pk:checked")].map(i => i.value)); if (one && S.size) items.forEach(x => { x.on = false; }); shown.forEach(x => { x.on = S.has(String(x.v)); }); };
  const draw = () => { if (d.isConnected) keep(); shown = vis();
    d.innerHTML = sviWinCard({ cls: "frs-card simp-card", close: "data-x", title: esc(title), body: `<div class="frs-g"><label class="frs-f frs-w"><span>RECHERCHER</span><input class="ins-in simp-q" value="${esc(q)}" autocomplete="off"></label></div>
      ${one ? "" : `<label class="cmpm-it"><input type="checkbox" class="simp-all"> <b>TOUT COCHER (LIGNES AFFICHÉES)</b> ${svCnt(vis().length, items.length)}</label>`}
      <div class="cmpm-list simp-list">${vis().map(x => `<label class="cmpm-it"><input type="${one ? "radio" : "checkbox"}" name="imppk" class="simp-pk" value="${esc(String(x.v))}"${x.on ? " checked" : ""}> ${esc(x.lab)}</label>`).join("") || `<div class="empty">AUCUNE LIGNE</div>`}</div>`,
      foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>${one ? "CHOISIR" : "PRENDRE LES COCHÉES"}</button>` });
    if (!d.isConnected) sviWinShow(d); const i = d.querySelector(".simp-q"); if (i && q) { i.focus(); i.setSelectionRange(q.length, q.length); } };
  draw();
  d.addEventListener("input", e => { if (e.target.matches(".simp-q")) { q = String(e.target.value || "").toUpperCase(); draw(); } });
  d.addEventListener("change", e => { if (e.target.matches(".simp-all")) d.querySelectorAll(".simp-pk").forEach(c => { c.checked = e.target.checked; }); });
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) { d.remove(); ok([]); return; }
    if (e.target.closest("[data-ok]")) { keep(); const v = items.filter(x => x.on).map(x => String(x.v)); d.remove(); ok(v); } }); }); }
/* aperçu avant OK : lignes reconnues, colonnes (choix de la destination pour un tableau), doublons ignorés */
function sviImpPreview(o, R) { return new Promise(ok => { const cols = o.cols || SVI_IMP_COLS, d = sviWinNew(); const A = R.aoa ? R.aoa.filter(r => r.some(v => String(v).trim())) : null;
  let G = A ? sviImpGuess(A, cols) : null;
  const rowsNow = () => { let rows = A ? sviImpFromAoa(A, G.h, G.C).map(r => R.imp && !r.title ? { ...r, imp: true } : r) : (R.rows || []); const seen = new Set(o.have || []), K = o.key || (r => String(r.des || "").toUpperCase() + "|" + String(r.u || "").toUpperCase());
    let dup = 0; rows = rows.filter(r => { if (r.title) return true; const k = K(r); if (seen.has(k)) { dup++; return false; } seen.add(k); return true; }); return { rows, dup }; };
  const draw = () => { const { rows, dup } = rowsNow(), n = rows.filter(r => !r.title).length, nc = A ? Math.max(...A.map(r => r.length)) : 0;
    const head = A ? `<div class="frs-st">COLONNES DU TABLEAU (DESTINATION) — LIGNE D'EN-TÊTE : <select class="ins-in simp-h">${[-1].concat(A.slice(0, 15).map((_, i) => i)).map(i => `<option value="${i}"${i === G.h ? " selected" : ""}>${i < 0 ? "AUCUNE" : "LIGNE " + (i + 1)}</option>`).join("")}</select></div>
      <div class="simp-map">${Array.from({ length: nc }, (_, j) => { const cur = Object.keys(G.C).find(k => G.C[k] === j) || ""; const ex = (A[G.h + 1] || A[0] || [])[j] || "";
        return `<label class="frs-f"><span>COLONNE ${j + 1}${G.h >= 0 && A[G.h][j] ? " — " + esc(A[G.h][j]) : ""}</span><select class="ins-in simp-c" data-j="${j}"><option value="">— (IGNORÉE)</option>${cols.map(c => `<option value="${c.k}"${cur === c.k ? " selected" : ""}>${esc(c.lab)}</option>`).join("")}</select><i class="simp-ex">${esc(String(ex).slice(0, 40))}</i></label>`; }).join("")}</div>` : "";
    d.innerHTML = sviWinCard({ cls: "frs-card simp-card", close: "data-x", title: "APERÇU — " + esc(R.from || "IMPORT"),
      body: `${head}<div class="frs-st">${n} LIGNE(S) RECONNUE(S)${dup ? " — " + dup + " DOUBLON(S) IGNORÉ(S)" : ""}${rows.some(r => r.imp) ? " — EN ROUGE : À VÉRIFIER" : ""}</div>
        <div class="svc-scroll simp-prev"><table class="prm-table"><thead><tr>${cols.map(c => `<th class="${c.num ? "number" : ""}">${esc(c.lab)}</th>`).join("")}</tr></thead><tbody>${rows.slice(0, 300).map(r => r.title ? `<tr class="ins-title"><td colspan="${cols.length}"><b>${esc(r.title)}</b></td></tr>` : `<tr${r.imp ? ' class="simp-red"' : ""}>${cols.map(c => `<td class="${c.num ? "number" : ""}">${esc(c.num && r[c.k] !== "" && r[c.k] !== undefined ? String(r[c.k]).replace(".", ",") : r[c.k] ?? "")}</td>`).join("")}</tr>`).join("")}${rows.length > 300 ? `<tr><td colspan="${cols.length}">… ${rows.length - 300} AUTRE(S)</td></tr>` : ""}</tbody></table></div>`,
      foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok${n ? "" : " disabled"}>IMPORTER ${svCnt(n)}</button>` });
    if (!d.isConnected) sviWinShow(d); };
  draw();
  d.addEventListener("change", e => { const t = e.target; if (t.matches(".simp-h")) { G = { h: +t.value, C: G.C }; draw(); }
    if (t.matches(".simp-c")) { const j = +t.dataset.j, C = { ...G.C }; Object.keys(C).forEach(k => { if (C[k] === j) delete C[k]; }); if (t.value) C[t.value] = j; G = { h: G.h, C }; draw(); } });
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) { d.remove(); ok(null); return; } if (e.target.closest("[data-ok]")) { const r = rowsNow(); d.remove(); ok(r.rows); } }); }); }
/* v1139 (10.9, 3.8) : une erreur d'import s'affiche dans une fenêtre de l'application, avec ce qu'il faut faire */
function sviImpErr(m) { let M = String(m || "").toUpperCase(); const d = sviWinNew();
  if (/FAILED TO FETCH|NETWORKERROR|LOAD FAILED|NETWORK REQUEST FAILED/.test(M)) M = "PAS DE CONNEXION";   /* v1140 : message du navigateur remplacé */
  const todo = /INDISPONIBLE|CONNEXION/.test(M) ? "VÉRIFIER LA CONNEXION INTERNET DE L'APPAREIL, PUIS RECOMMENCER."
    : /ACCÈS REFUSÉ|NON PARTAGÉE/.test(M) ? "DANS GOOGLE SHEETS : PARTAGER › TOUTE PERSONNE AYANT LE LIEN (LECTEUR), PUIS RECOMMENCER."
    : /NON RECONNU/.test(M) ? "COLLER LE LIEN COMPLET DE LA FEUILLE (IL CONTIENT /spreadsheets/d/…)."
    : /AUCUNE LIGNE/.test(M) ? "VÉRIFIER QUE LE FICHIER CONTIENT UN TABLEAU (DÉSIGNATION, UNITÉ, QUANTITÉ), OU CHOISIR UNE AUTRE SOURCE."
    : /INTROUVABLE/.test(M) ? "LE FICHIER N'EST PAS SUR CET APPAREIL : L'IMPORTER DEPUIS L'APPAREIL QUI L'A, OU LE RAJOUTER."
    : "VÉRIFIER LE FICHIER (FORMAT, CONTENU) OU CHOISIR UNE AUTRE SOURCE.";
  d.innerHTML = sviWinCard({ cls: "frs-card simp-card", close: "data-x", title: "IMPORT IMPOSSIBLE", body: `<div class="frs-st">${esc(M.replace(/^IMPORT IMPOSSIBLE\s*:\s*/, ""))}</div><div>${todo.replace(/\/spreadsheets\/d\/…/, "/spreadsheets/d/…")}</div>`, foot: `<button type="button" class="svc-b svc-ok svc-neutral" data-x>OK</button>` });
  sviWinShow(d); d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) d.remove(); }); }
/* lien saisi tel quel (sans majuscules forcées : l'identifiant d'une feuille Google distingue les majuscules) */
const sviImpAsk = (title, lab) => new Promise(ok => { const d = sviWinNew(); d.innerHTML = sviWinCard({ cls: "frs-card simp-card", close: "data-x", title: esc(title),
    body: `<div class="frs-g"><label class="frs-f frs-w"><span>${esc(lab)}</span><input class="ins-in simp-url" data-raw data-keepcase style="text-transform:none" autocomplete="off" autocapitalize="off" spellcheck="false"></label></div>`,
    foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>SUIVANT</button>` });
  sviWinShow(d); setTimeout(() => d.querySelector(".simp-url")?.focus(), 50);
  const go = () => { const v = String(d.querySelector(".simp-url").value || "").trim(); d.remove(); ok(v); };
  d.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches(".simp-url")) { e.preventDefault(); go(); } });
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) { d.remove(); ok(""); } else if (e.target.closest("[data-ok]")) go(); }); });
function sviImport(o) { return new Promise(done => { const d = sviWinNew(), docs = o.docs || [], app = o.app || [];
  const fam = (t, h) => h ? `<div class="frs-st">${t}</div><div class="cmpm-list">${h}</div>` : "";
  d.innerHTML = sviWinCard({ cls: "cmpm-pick simp-card", close: "data-x", title: esc(o.title || "IMPORTER"), body:
    fam("FICHIER", (o.file !== false ? `<button type="button" class="svc-b" data-s="file">UN FICHIER (EXCEL, CSV, TEXTE, JSON, PDF, WORD, PHOTO OU SCAN)</button>` : "") + docs.map((x, i) => `<button type="button" class="svc-b" data-s="d${i}">${esc(x.lab)}</button>`).join(""))
    + fam("EN LIGNE", o.online !== false ? `<button type="button" class="svc-b" data-s="gs">UN LIEN GOOGLE SHEETS</button>` : "")
    + fam("PRESSE-PAPIERS", o.clip !== false ? `<button type="button" class="svc-b" data-s="clip">COLLER UNE COLONNE OU UN TABLEAU</button>` : "")
    + fam("DEPUIS L'APPLICATION", app.map((x, i) => `<button type="button" class="svc-b" data-s="a${i}">${esc(x.lab)}</button>`).join("")),
    foot: `<button type="button" class="svc-b" data-x>ANNULER</button>` });
  sviWinShow(d);
  const fail = err => { sviImpErr(String(err && err.message || err)); done(null); };
  const msg = t => { let m = document.getElementById("sviImpMsg"); if (!m) { m = document.createElement("div"); m.id = "sviImpMsg"; document.body.appendChild(m); } m.textContent = t; };
  const end = () => { const m = document.getElementById("sviImpMsg"); if (m) m.remove(); };
  d.addEventListener("click", async e => { if (e.target === d || e.target.closest("[data-x]")) { d.remove(); done(null); return; }
    const b = e.target.closest("[data-s]"); if (!b) return; const s = b.dataset.s; d.remove();
    try { let R = null, file = null, extra = null;
      if (s === "file" || s[0] === "d") { const f = s === "file" ? await new Promise(ok => { const i = document.createElement("input"); i.type = "file"; i.accept = ".xlsx,.xls,.csv,.txt,.json,.pdf,.docx,image/*"; i.onchange = () => ok(i.files[0] || null); i.click(); }) : await docs[+s.slice(1)].get();
        if (!f) { done(null); return; } if (s === "file") file = f; R = { ...(await sviImpFile(f, msg)), from: f.name || (docs[+s.slice(1)] || {}).lab || "FICHIER" }; }
      else if (s === "gs") { const url = await sviImpAsk("IMPORTER UN LIEN GOOGLE SHEETS", "LIEN DE LA FEUILLE (PARTAGÉE EN LECTURE)"); if (!url) { done(null); return; }
        const id = (url.match(/\/d\/([a-zA-Z0-9_-]+)/) || [])[1], gid = (url.match(/[#&?]gid=(\d+)/) || [])[1] || "0"; if (!id) throw new Error("LIEN GOOGLE SHEETS NON RECONNU");
        const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`); if (!r.ok) throw new Error("ACCÈS REFUSÉ (FEUILLE NON PARTAGÉE EN LECTURE ?)");
        const X = await loadXLSX(), wb = X.read(await r.text(), { type: "string", raw: true }); R = { aoa: X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false }).map(x => x.map(v => String(v ?? "").trim())), from: "GOOGLE SHEETS" }; }
      else if (s === "clip") { const t = await new Promise(ok => { const w = sviWinNew(); w.innerHTML = sviWinCard({ cls: "frs-card simp-card", close: "data-x", title: "COLLER UNE COLONNE OU UN TABLEAU",
          body: `<div class="frs-g"><label class="frs-f frs-w"><span>CONTENU COPIÉ (EXCEL, GOOGLE SHEETS, TEXTE)</span><textarea class="ins-in simp-ta" rows="10" data-raw style="text-transform:none"></textarea></label></div>`, foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>SUIVANT</button>` });
          sviWinShow(w); setTimeout(() => w.querySelector(".simp-ta")?.focus(), 50);
          w.addEventListener("click", ev => { if (ev.target === w || ev.target.closest("[data-x]")) { w.remove(); ok(""); } else if (ev.target.closest("[data-ok]")) { const v = w.querySelector(".simp-ta").value; w.remove(); ok(v); } }); });
        if (!t.trim()) { done(null); return; } R = { aoa: sviImpAoaText(t), from: "PRESSE-PAPIERS" }; }
      else { const a = app[+s.slice(1)], r = a && await a.run(); if (!r) { done(null); return; } R = { rows: r.rows || [], from: r.from || a.lab }; extra = r.extra || null; }
      end(); if (!R || (!R.aoa && !(R.rows || []).length)) { sviImpErr("AUCUNE LIGNE RECONNUE DANS « " + ((R && R.from) || "L'IMPORT") + " »"); done(null); return; }
      const rows = await sviImpPreview(o, R); done(rows ? { rows, from: R.from, file, extra } : null); }
    catch (err) { end(); fail(err); } }); }); }
window.sviImport = sviImport;
