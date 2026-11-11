/* =========================================================
   F3 – F12 (série F, 06/11/2026) : PAGE DE LA CONSULTATION sur le modèle du budget — une seule page, quatre blocs liés par les
   ronds à gauche (règle 2.5) : DÉTAIL CONSULTATION, FOURNISSEURS, DOCUMENTS, CONDITIONS PARTICULIÈRES ; puis le comparatif et les pièces liées.
   Liaisons gardées sur la consultation : lf (détail → fournisseurs), ld (détail → documents), lc (détail → conditions),
   fd (fournisseur → documents), fc (fournisseur → conditions). Choisir un détail éclaire ses fournisseurs, documents et conditions ; choisir un
   fournisseur éclaire ses détails (et ses documents, conditions). Toucher le rond d'une autre ligne pendant un choix = lier / délier.
   Un fournisseur ajouté est lié aux détails qu'il a déjà vendus (sinon à tous) : chaque fournisseur a son propre bordereau.
   ========================================================= */
let ACH_CAF_SEL = { id: "", k: "" };
/* conditions particulières par défaut (F5) — le catalogue est ACHATS › CLAUSES ; une condition ajoutée ici y est ajoutée aussi */
const ACH_CAF_COND = [["dlim", "DATE LIMITE DE RÉPONSE", "date"], ["lieu", "LIEU DE LIVRAISON", "text"], ["dSouh", "LIVRAISON SOUHAITÉE LE", "date"],
  ["avance", "CONDITIONS DE PAIEMENT — AVANCE (%)", "num"], ["equiv", "ARTICLE ÉQUIVALENT AUTORISÉ", "on"], ["franco", "FRANCO CHANTIER", "on"]];
const achCafId = () => "K" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
/* mise à niveau d'une consultation : identifiants des détails, conditions en tableau (reprises des anciens champs), liaisons */
function achCafUp(c) { let ch = false;
  (c.lignes || []).forEach(l => { if (!l.id) { l.id = achCafId(); ch = true; } });
  if (!Array.isArray(c.cond)) { ch = true; c.cond = ACH_CAF_COND.map(([k, lab, t]) => ({ id: k, k, lab, t, v: k === "dlim" ? c.dlim || "" : k === "lieu" ? c.lieu || "" : k === "dSouh" ? c.dSouh || "" : k === "equiv" ? (c.variante ? "OUI" : "NON") : k === "franco" ? (c.franco ? "OUI" : "NON") : "" })); }
  ["lf", "ld", "lc", "fd", "fc"].forEach(k => { if (!c[k] || typeof c[k] !== "object") { c[k] = {}; ch = true; } });
  (c.lignes || []).forEach(l => { if (!Array.isArray(c.lf[l.id])) { c.lf[l.id] = (c.frs || []).slice(); ch = true; } });
  /* série H (H1) : une CONSULTATION PAR FOURNISSEUR (fille) pour chaque fournisseur consulté — numéro jamais réutilisé */
  if (!c.fil || typeof c.fil !== "object") { c.fil = {}; ch = true; }
  (c.frs || []).forEach(f => { if (!c.fil[f]) { c.filN = (+c.filN || 0) + 1; c.fil[f] = { n: c.filN, cree: achNow() }; ch = true; } });
  return ch; }
/* série H : articles de la fille (détails liés au fournisseur), empreinte (pour À RENVOYER), référence et état */
const achFilLig = (c, f) => (c.lignes || []).filter(l => ((c.lf || {})[l.id] || []).includes(f));
const achFilSig = (c, f) => achFilLig(c, f).map(l => [l.id, achU(l.des), achU(l.u), achN(l.q)].join("~")).join("|");
const achFilRefOf = (c, f) => { const o = (c.fil || {})[f]; return o ? achFilRef(c, o.n) : ""; };
const ACH_FIL_ST = { instance: "EN INSTANCE", remis: "ENVOYÉE", renvoyer: "À RENVOYER", valide: "RÉPONDU", annule: "DÉCLINÉ" };
const achFilSt = (c, f, D) => { const o = (c.fil || {})[f] || {}, r = (c.rep || {})[f] || {};
  if (r.st === "decline") return "annule"; if (o.env && o.sig !== undefined && o.sig !== achFilSig(c, f)) return "renvoyer";
  if ((D || achDvf()).some(v => v.caf === c.id && v.frs === f && v.state !== "annule")) return "valide"; return o.env || r.env ? "remis" : "instance"; };
const achCafSaveOne = (id, mut, act) => { const L = achCaf(), c = L.find(x => x.id === id); if (!c) return null; achCafUp(c); mut(c); c.mod = achNow(); achCafSave(L); if (act) achHist(c.ref, act, c.objet || ""); return c; };
/* détails qu'un fournisseur a déjà vendus (commandes validées) */
const achFrsSold = f => { const S = new Set(); achCmf().filter(c => c.frs === f && c.state !== "annule" && c.state !== "instance").forEach(c => (c.lignes || []).forEach(l => S.add(achKey(l.des, l.u)))); return S; };
/* F8 : prix d'un détail chez un fournisseur — tous ses devis de la consultation qui chiffrent ce détail */
const achCafPrices = (c, f, l, D) => (D || achDvf()).filter(v => v.caf === c.id && v.frs === f && v.state !== "annule").flatMap(v => (v.lignes || []).filter(y => (l.bsn && y.bsn ? y.bsn === l.bsn : achKey(y.des, y.u) === achKey(l.des, l.u)) && achN(y.pu) > 0).map(y => ({ v, y })));
const achCafPrice = (c, f, l, D) => { const P = achCafPrices(c, f, l, D); if (!P.length) return { st: "nc" }; if (P.length === 1) return { st: "ok", p: P[0] };
  const k = ((c.pick || {})[l.id] || {})[f], q = P.find(x => x.v.id === k); return q ? { st: "ok", p: q } : { st: "choix", n: P.length, P }; };
/* groupes du détail (F2) : numérotation comme les LOTS — 2 pour le groupe, 2.1, 2.2 pour ses articles ; sans groupe, 1 à n */
function achDetNum(L, G) { G = G || []; const out = [], seen = new Set(); let n = 0;
  if (!G.length || !L.some(l => l.g)) { L.forEach((l, i) => out.push({ l, i, no: String(i + 1) })); return out; }
  L.forEach((l, i) => { if (!l.g || !G.some(g => g.id === l.g)) { out.push({ l, i, no: String(++n) }); return; }
    if (seen.has(l.g)) return; seen.add(l.g); const gn = ++n, g = G.find(x => x.id === l.g); out.push({ title: g, no: String(gn), lab: g.lab || "GROUPE " + (G.indexOf(g) + 1) });
    let m = 0; L.forEach((y, j) => { if (y.g === l.g) out.push({ l: y, i: j, no: gn + "." + (++m) }); }); });
  return out; }
function achCafPage(x, B) {
  if (achCafUp(x)) { const L = achCaf(), i = L.findIndex(y => y.id === x.id); if (i >= 0) { L[i] = x; achCafSave(L); } }   /* mêmes identifiants que ceux affichés */
  /* F8 : un devis lié depuis sa fiche (champ CONSULTATION) amène son fournisseur, lié aux détails qu'il chiffre */
  { const miss = achDvf().filter(v => v.caf === x.id && v.state !== "annule" && v.frs && !(x.frs || []).includes(v.frs));
    if (miss.length) { const c = achCafSaveOne(x.id, c => miss.forEach(v => { if (c.frs.includes(v.frs)) return; c.frs.push(v.frs); c.rep[v.frs] = { st: "repondu", dvf: v.id };
      const K = new Set((v.lignes || []).map(y => achKey(y.des, y.u))); c.lignes.filter(l => K.has(achKey(l.des, l.u))).forEach(l => { c.lf[l.id] = (c.lf[l.id] || []).concat([v.frs]); }); }), "DEVIS LIÉ DEPUIS SA FICHE");
      if (c) Object.assign(x, c); } }
  const open = x.state === "ouverte", D = achDvf(), DD = D.filter(v => v.caf === x.id && v.state !== "annule"), fr = id => id ? achFrsNom(id) : "";
  const SEL = ACH_CAF_SEL.id === x.id ? ACH_CAF_SEL.k : "", [st, sid] = SEL.split("|");
  const lk = (o, a, b) => ((x[o] || {})[a] || []).includes(b);
  /* état du rond : choisi, lié à ce qui est choisi, ou rien */
  const rdSt = k => { if (!SEL) return ""; if (k === SEL) return "choisi"; const [t, id] = k.split("|");
    if (st === "a") return t === "f" && lk("lf", sid, id) || t === "d" && lk("ld", sid, id) || t === "c" && lk("lc", sid, id) ? "lie" : "";
    if (t === "a") return st === "f" && lk("lf", id, sid) || st === "d" && lk("ld", id, sid) || st === "c" && lk("lc", id, sid) ? "lie" : "";
    if (st === "f") return t === "d" && lk("fd", sid, id) || t === "c" && lk("fc", sid, id) ? "lie" : "";
    if (t === "f") return st === "d" && lk("fd", id, sid) || st === "c" && lk("fc", id, sid) ? "lie" : ""; return ""; };
  const dis = open ? "" : " disabled";
  /* ---- DÉTAIL CONSULTATION ---- */
  const usedB = new Set((x.lignes || []).filter(l => l.bsn).map(l => l.bsn)), takenD = new Set((x.lignes || []).filter(l => l.bsn).map(l => achKey(l.des, l.u)));
  const det = achDetNum(x.lignes || [], x.grp).map(o => { if (o.title) return { cls: "ins-title nvp-gt", gid: o.title.id, cells: [o.no, { h: "<b>" + esc(o.lab) + "</b>", t: o.lab }, "", "", "", "", "", "", "", ""] };
    const l = o.l, i = o.i, a = achArtOf(l.des, l.u), b = l.bsn ? achBsn().find(y => y.id === l.bsn) : null, pe = achStdPu(l.des, l.u, l.pu), k = "a|" + l.id;
    const BO = achBsnOpen().filter(y => !usedB.has(y.id) || y.id === l.bsn).concat(b && !achBsnOpen().some(y => y.id === b.id) ? [b] : []);
    const AO = achArts().filter(y => !y.del && !y.bloq && !y.arch && (!takenD.has(achKey(y.des, y.u)) || achKey(y.des, y.u) === achKey(l.des, l.u)));
    const nF = ((x.lf || {})[l.id] || []).filter(f => (x.frs || []).includes(f)).length;
    return { rd: { k, st: rdSt(k) }, cls: l.imp ? "cafp-imp" : "", go: a ? [[2, "art", a.id]] : [], cells: [o.no,
      { h: `<select class="ins-in cafp-bsn" data-li="${esc(l.id)}"${dis}><option value="">—</option>${BO.map(y => `<option value="${esc(y.id)}"${y.id === l.bsn ? " selected" : ""}>${esc(y.ref + " · " + (achArtOf(y.des, y.u) ? achRefSvi(achArtOf(y.des, y.u), achArts(), "ARA") : "HORS LISTE") + " · " + y.des + " · " + y.u + " · " + achF2(y.q))}</option>`).join("")}</select>`, t: b ? b.ref : "" },
      a ? achRefSvi(a, achArts(), "ARA") : "HORS LISTE",
      l.libre ? { h: `<input class="ins-in cafp-l" data-li="${esc(l.id)}" data-c="des" value="${esc(l.des || "")}"${dis}>`, t: l.des || "" } : { h: `<select class="ins-in cafp-des" data-li="${esc(l.id)}"${dis}><option value="">—</option>${AO.map(y => `<option value="${esc(y.id)}"${achKey(y.des, y.u) === achKey(l.des, l.u) ? " selected" : ""}>${esc(y.des + " (" + y.u + ")")}</option>`).join("")}</select>`, t: l.des || "" },
      l.libre ? { h: `<input class="ins-in cafp-l center" data-li="${esc(l.id)}" data-c="u" value="${esc(l.u || "")}"${dis}>`, t: l.u || "" } : l.u || "",
      { h: `<input class="ins-in cafp-l number" data-li="${esc(l.id)}" data-c="q" inputmode="decimal" value="${esc(String(l.q ?? "").replace(".", ","))}"${dis}>`, t: achN(l.q) },
      a ? pe : { h: `<input class="ins-in cafp-l number" data-li="${esc(l.id)}" data-c="pu" inputmode="decimal" value="${esc(String(l.pu ?? "").replace(".", ","))}" placeholder="À SAISIR"${dis}>`, t: achN(l.pu) },
      achN(l.q) * pe, b ? achN(l.q) * achN(b.pu) : "", String(nF)] }; });
  ACH_DET_DRAG[achNvhKey("ARTICLES CONSULTÉS")] = { open, rows: det.map(r => r.rd ? { l: r.rd.k.slice(2) } : { g: r.gid }), apply: f => achCafSaveOne(x.id, c => f(c), "DÉTAIL DÉPLACÉ") };
  const DET = { t: "ARTICLES CONSULTÉS", lines: true, add: open ? "CRÉER UN DÉTAIL ICI…" : "", cols: [["ARTICLE", "center"], ["BESOIN"], ["CODE ARTICLE"], ["DÉSIGNATION"], ["U", "center"], ["QUANTITÉ", "number"], ["PRIX ESTIMÉ", "number"], ["MONTANT ESTIMÉ", "number"], ["MONTANT BUDGÉTÉ (NON ENVOYÉ)", "number"], ["FOURNISSEURS", "center"]],
    rows: det, addFn: redraw => { achCafSaveOne(x.id, c => { const id = achCafId(); c.lignes.push({ id, des: "", u: "", q: "" }); c.lf[id] = (c.frs || []).slice(); }, "DÉTAIL AJOUTÉ"); redraw(); },
    menu: open ? [{ k: "imp", lab: "IMPORTER (EXCEL, GOOGLE SHEETS, CSV, PDF)" }].concat((x.lignes || []).some(l => l.imp) ? [{ k: "impok", lab: "CONFIRMER LES COCHÉS (VÉRIFIÉS)" }] : []).concat([{ k: "bsn", lab: "AJOUTER LES BESOINS VALIDÉS NON COUVERTS" }, { k: "libre", lab: "AJOUTER UN ARTICLE HORS LISTE" }, { k: "up", lab: "MONTER LES COCHÉS" }, { k: "down", lab: "DESCENDRE LES COCHÉS" }, { k: "grp", lab: "GROUPER LES COCHÉS" }, { k: "ungrp", lab: "SORTIR LES COCHÉS DE LEUR GROUPE" }, { k: "rm", lab: "SUPPRIMER LES COCHÉS" }]) : [],
    act: async (a, ck, redraw) => { const rowsL = ck.map(i => det[i]).filter(r => r && r.rd).map(r => r.rd.k.slice(2));
      if (a === "imp") { await achCafImport(x, redraw); return; }
      if (a === "libre") { achCafSaveOne(x.id, c => { const id = achCafId(); c.lignes.push({ id, des: "", u: "", q: "", pu: "", libre: true }); c.lf[id] = (c.frs || []).slice(); }, "DÉTAIL HORS LISTE AJOUTÉ"); redraw(); return; }
      if (a === "bsn") { const have = new Set((x.lignes || []).map(l => l.bsn).filter(Boolean)), BB = achBsnOpen().filter(b => !have.has(b.id)); if (!BB.length) { svToast("AUCUN BESOIN VALIDÉ NON COUVERT.", 3000); return; }
        const pick = await achPickWin("BESOINS VALIDÉS NON COUVERTS", BB.map(b => ({ v: b.id, lab: b.ref + " — " + b.des + " (" + achF2(b.q) + " " + b.u + ")" }))); if (!pick.length) return;
        achCafSaveOne(x.id, c => BB.filter(b => pick.includes(b.id)).forEach(b => { const id = achCafId(); c.lignes.push({ id, bsn: b.id, des: b.des, u: b.u, q: achN(b.q) }); c.lf[id] = (c.frs || []).slice(); }), "BESOINS AJOUTÉS"); redraw(); return; }
      if (!rowsL.length) { svToast("COCHER D'ABORD DES DÉTAILS.", 2500); return; }
      if (a === "impok") { achCafSaveOne(x.id, c => c.lignes.forEach(l => { if (rowsL.includes(l.id)) delete l.imp; }), "DÉTAILS IMPORTÉS VÉRIFIÉS"); redraw(); return; }
      if (a === "up" || a === "down") { achCafSaveOne(x.id, c => { c.lignes = achDetMove(c.lignes, rowsL, a === "up" ? -1 : 1); }, "DÉTAILS DÉPLACÉS"); redraw(); return; }
      if (a === "grp") { achCafSaveOne(x.id, c => { c.grp = c.grp || []; const g = { id: achCafId() }; c.grp.push(g); c.lignes.forEach(l => { if (rowsL.includes(l.id)) l.g = g.id; }); }, "GROUPE CRÉÉ"); redraw(); return; }
      if (a === "ungrp") { achCafSaveOne(x.id, c => c.lignes.forEach(l => { if (rowsL.includes(l.id)) delete l.g; }), "SORTIS DU GROUPE"); redraw(); return; }
      if (a === "rm") { if (!(await svConfirm({ title: "SUPPRIMER LES DÉTAILS COCHÉS", text: rowsL.length + " DÉTAIL(S) ; LA NUMÉROTATION SE REFAIT.", ok: "SUPPRIMER" }))) return;
        achCafSaveOne(x.id, c => { c.lignes = c.lignes.filter(l => !rowsL.includes(l.id)); rowsL.forEach(id => { delete c.lf[id]; delete c.ld[id]; delete c.lc[id]; }); }, "DÉTAILS SUPPRIMÉS"); redraw(); } } };
  /* ---- FOURNISSEURS (F12) ---- */
  const FRS = { t: "FOURNISSEURS CONSULTÉS", add: open ? "AJOUTER UN FOURNISSEUR ICI…" : "", cols: [["FOURNISSEUR"], ["E-MAIL"], ["CONDITIONS DE PAIEMENT"], ["RÉPONSE", "center"], ["DÉTAILS LIÉS", "center"], ["DEVIS"]],
    rows: (x.frs || []).map(f => { const F = achFrs().find(y => y.id === f) || {}, r = (x.rep || {})[f] || {}, V = DD.filter(v => v.frs === f), k = "f|" + f, nL = (x.lignes || []).filter(l => lk("lf", l.id, f)).length;
      return { rd: { k, st: rdSt(k) }, go: [[0, "frs", f]], cells: [fr(f), ((F.cte || []).find(y => y.email) || {}).email || "",
        { h: `<input class="ins-in cafp-pay" data-f="${esc(f)}" value="${esc(r.pay ?? F.cond ?? "")}"${dis}>`, t: r.pay ?? F.cond ?? "" },
        { h: `<select class="ins-in cafp-rep" data-f="${esc(f)}"${dis}>${[["attente", "EN ATTENTE"], ["repondu", "RÉPONDU"], ["decline", "DÉCLINÉ"]].map(([kk, l]) => `<option value="${kk}"${(r.st || "attente") === kk ? " selected" : ""}>${l}</option>`).join("")}</select>`, t: { repondu: "RÉPONDU", decline: "DÉCLINÉ" }[r.st] || "EN ATTENTE" },
        String(nL), { h: V.map(v => `<button type="button" class="ach-link" data-nvgo="dvf|${esc(v.id)}">${esc(v.ref)}</button>`).join(", ") + (open ? ` <button type="button" class="ach-b cafp-mkdvf" data-f="${esc(f)}">CRÉER SON DEVIS</button>` : ""), t: V.map(v => v.ref).join(", ") }] }; }),
    addFn: async redraw => { const K = new Set((x.lignes || []).map(l => achKey(l.des, l.u)));
      const F = achLive(achFrs()).filter(f => achFrsOk(f) && !f.bloq && !(x.frs || []).includes(f.id)).map(f => { const S = achFrsSold(f.id); return { f, n: [...K].filter(k => S.has(k)).length }; }).sort((a, b) => b.n - a.n || a.f.nom.localeCompare(b.f.nom, "fr"));
      if (!F.length) { svToast("AUCUN AUTRE FOURNISSEUR ACTIF (ACHAT › FOURNISSEURS).", 3000); return; }
      const pick = await achPickWin("FOURNISSEURS À CONSULTER", F.map(y => ({ v: y.f.id, lab: y.f.code + " — " + y.f.nom + (y.n ? "  ★ A DÉJÀ VENDU " + y.n + " DE CES ARTICLES" : "") }))); if (!pick.length) return;
      achCafSaveOne(x.id, c => pick.forEach(f => { c.frs.push(f); c.rep = c.rep || {}; c.rep[f] = { st: "attente" }; const S = achFrsSold(f), mine = c.lignes.filter(l => S.has(achKey(l.des, l.u)));
        (mine.length ? mine : c.lignes).forEach(l => { c.lf[l.id] = (c.lf[l.id] || []).concat([f]); }); }), "FOURNISSEURS AJOUTÉS"); redraw(); },
    menu: open ? [{ k: "rmf", lab: "RETIRER LES COCHÉS (SANS DEVIS)" }] : [],
    act: async (a, ck, redraw) => { const F = ck.map(i => (x.frs || [])[i]).filter(Boolean).filter(f => !DD.some(v => v.frs === f)); if (!F.length) { svToast("COCHER DES FOURNISSEURS SANS DEVIS.", 2500); return; }
      achCafSaveOne(x.id, c => { c.frs = c.frs.filter(f => !F.includes(f)); F.forEach(f => { delete c.rep[f]; delete c.fd[f]; delete c.fc[f]; Object.keys(c.lf).forEach(l => { c.lf[l] = c.lf[l].filter(y => y !== f); }); }); }, "FOURNISSEURS RETIRÉS"); redraw(); } };
  /* ---- série H (H1) : CONSULTATIONS PAR FOURNISSEUR — une fille par fournisseur, ses seuls articles ; À RENVOYER si ses articles ont changé depuis l'envoi ---- */
  const FIL = { t: "CONSULTATIONS PAR FOURNISSEUR", cols: [["RÉFÉRENCE"], ["FOURNISSEUR"], ["ARTICLES", "center"], ["ENVOYÉE LE", "center"], ["DEVIS"], ["ÉTAT", "center"]],
    rows: (x.frs || []).filter(f => (x.fil || {})[f]).map(f => { const o = x.fil[f], s0 = achFilSt(x, f, D), V = DD.filter(v => v.frs === f), env = o.env || ((x.rep || {})[f] || {}).env || "";
      return { st: s0, go: [[1, "frs", f]],   /* correction : l'état de la fille seul décide de la couleur (plus de « validé » ajouté par le texte de l'état) */ cells: [achFilRefOf(x, f), fr(f), String(achFilLig(x, f).length), env ? achDFr(String(env).slice(0, 10)) : "",
        { h: V.map(v => `<button type="button" class="ach-link" data-nvgo="dvf|${esc(v.id)}">${esc(v.ref)}</button>`).join(", "), t: V.map(v => v.ref).join(", ") }, ACH_FIL_ST[s0]] }; }) };
  /* ---- DOCUMENTS : ceux de l'onglet DOCUMENTS du SUIVI ; cochés = à envoyer ---- */
  const DOCS = achJ("svi_docs_v1:ACH-" + (x.ref || x.code), []) || [];
  const DOC = { t: "DOCUMENTS ENVOYÉS", add: open ? "AJOUTER UN DOCUMENT ICI… (IL S'AJOUTE AUSSI AU SUIVI)" : "", cols: [["RÉFÉRENCE"], ["INTITULÉ"]],   /* 11/11 (Ahmed) : la référence soulignée ouvre le document (plus de colonne FICHIER) */
    rows: DOCS.map((d0, i) => { const id = d0.ref || "d" + i, k = "d|" + id; return { rd: { k, st: rdSt(k) }, cells: [d0.fk ? { h: `<button type="button" class="ach-link cafp-doc" data-fk="${esc(d0.fk)}">${esc(d0.ref || "DOCUMENT")}</button>`, t: d0.ref || "" } : d0.ref || "", d0.title || ""] }; }),
    addFn: async redraw => { const R = achRecBlock(x.ref || x.code); if (await R.addTab("doc")) { const L2 = R.list("doc"), n = L2[L2.length - 1]; void n; } redraw(); } };
  /* ---- CONDITIONS PARTICULIÈRES (F5) ---- */
  const CND = { t: "CONDITIONS PARTICULIÈRES", add: open ? "AJOUTER UNE CONDITION ICI…" : "", cols: [["CONDITION"], ["VALEUR"]],
    rows: (x.cond || []).map(cd => { const k = "c|" + cd.id, inp = cd.t === "on" ? `<select class="ins-in cafp-cv" data-cd="${esc(cd.id)}"${dis}>${["", "OUI", "NON"].map(v => `<option value="${v}"${cd.v === v ? " selected" : ""}>${v || "—"}</option>`).join("")}</select>`
        : `<input class="ins-in cafp-cv${cd.t === "num" ? " number" : ""}" data-cd="${esc(cd.id)}"${cd.t === "date" ? ' type="date"' : ""}${cd.t === "num" ? ' inputmode="decimal"' : ""} value="${esc(cd.v || "")}"${dis}>`;
      const miss = achCafCondLinked(x, cd) && !String(cd.v ?? "").trim();
      return { rd: { k, st: rdSt(k) }, cells: [miss ? { h: `<b class="obs-bang val-bang nv-bang" role="button" data-why="VALEUR MANQUANTE">!</b> ${esc(cd.lab)}`, t: cd.lab } : cd.lab, { h: inp, t: cd.v || "" }] }; }),
    addFn: async redraw => { const lab = await achAsk("NOUVELLE CONDITION PARTICULIÈRE", "INTITULÉ (AJOUTÉ AUSSI À ACHATS › CLAUSES)"); if (!lab) return;
      achCafSaveOne(x.id, c => { c.cond.push({ id: achCafId(), k: "autre", lab: achU(lab), t: "text", v: "" }); }, "CONDITION AJOUTÉE");
      /* un seul catalogue : la condition rejoint les clauses particulières (ACHATS › CLAUSES) si elle n'y est pas */
      const P = achPrm(), Lp = achClP(P); if (!Lp.some(y => achU(y.txt) === achU(lab))) { P.clP = Lp.concat([{ id: "p" + Date.now().toString(36), t: "autre", txt: achU(lab) }]); achPrmSave(P); }
      redraw(); } };
  /* ---- COMPARATIF (F8 : devis partiels, plusieurs devis, prix à choisir) ---- */
  const FC = (x.frs || []).filter(f => DD.some(v => v.frs === f));
  const CMP = { t: "TABLEAU COMPARATIF", cols: [["DÉTAIL"]].concat(FC.map(f => [fr(f), "number"])),
    rows: (x.lignes || []).map(l => ({ cells: [l.des + " (" + achF2(l.q) + " " + (l.u || "") + ")"].concat(FC.map(f => { if (!lk("lf", l.id, f)) return "—"; const p = achCafPrice(x, f, l, D);
      return p.st === "nc" ? "NON CHIFFRÉ" : p.st === "choix" ? { h: `<button type="button" class="ach-b cafp-pick" data-f="${esc(f)}" data-li="${esc(l.id)}">À CHOISIR (${p.n} PRIX)</button>`, t: "À CHOISIR" } : achN(p.p.y.pu); })) }))
      .concat([{ cls: "caf-tot", cells: ["TOTAL HT (DÉTAILS CHIFFRÉS)"].concat(FC.map(f => (x.lignes || []).reduce((t, l) => { const p = lk("lf", l.id, f) ? achCafPrice(x, f, l, D) : { st: "nc" }; return t + (p.st === "ok" ? achN(l.q) * achN(p.p.y.pu) : 0); }, 0))) }]) };
  const canCmd = x.state === "close" && !achCmf().some(c => c.caf === x.id && c.state !== "annule");
  return { title: x.objet || "",
    menu: (open ? [{ k: "send", lab: "ENVOYER LA CONSULTATION" }].concat(FC.length ? [{ k: "close", lab: "CLÔTURER (CHOIX DU RETENU)" }] : []) : []).concat(canCmd ? [{ k: "mkcmf", lab: "CRÉER LA COMMANDE" }] : []),
    act: async (k, redraw) => {
      if (k === "send") { achCafSend(x.id); return true; }
      if (k === "close") { achCafClose(x.id, redraw); return true; }
      if (k !== "mkcmf") return false; const v = achDvf().find(y => y.caf === x.id && y.state === "retenu"); if (!v) { svToast("AUCUN DEVIS RETENU.", 3000); return true; }
      /* F8 : lignes de la commande = détails liés au retenu, au prix gardé (un ou plusieurs devis du même fournisseur) */
      const C0 = achCaf().find(y => y.id === x.id) || x, LL = (C0.lignes || []).filter(l => ((C0.lf || {})[l.id] || []).includes(v.frs)).map(l => { const p = achCafPrice(C0, v.frs, l); return p.st === "ok" ? { ...p.p.y, q: achN(l.q), bsn: l.bsn || p.p.y.bsn || "", dvf: p.p.v.id } : null; }).filter(Boolean);
      const m = achCmfFrom({ frs: v.frs, caf: x.id, dvf: v.id, lignes: LL.length ? LL : v.lignes, why: "DEPUIS " + x.ref + " — " + v.ref });
      /* F5 : les conditions particulières envoyées passent dans les clauses particulières de la commande (règle 12.3) — rien n'est saisi deux fois */
      try { const L = achCmf(), cm = L.find(y => y.id === m.id); if (cm) { const C2 = (achCaf().find(y => y.id === x.id) || x); cm.cla = (Array.isArray(cm.cla) ? cm.cla : achClCopy(achPrm().clP)).concat(achCafCondOf(C2, v.frs).filter(cd => String(cd.v ?? "").trim()).map(cd => ({ id: "c" + cd.id, t: "autre", txt: cd.lab + " : " + cd.v }))); achCmfSave(L); } } catch (e) {}
      achGo("cmf", m.id); return true; },
    links: [DET, FRS, DOC, CND, FIL].concat(FC.length ? [CMP] : []).concat([B.DV("DEVIS", DD), B.CM("COMMANDES", achCmf().filter(c => c.caf === x.id))]),
    /* ronds, devis, choix du prix, documents */
    click: async (e, redraw) => {
      const rd = e.target.closest(".nvp-rd"); if (rd && rd.closest(".nvp")) { const k = rd.dataset.rd, cur = ACH_CAF_SEL.id === x.id ? ACH_CAF_SEL.k : "";
        if (!cur || k === cur || k[0] === cur[0] || !open) { ACH_CAF_SEL = { id: x.id, k: k === cur ? "" : k }; redraw(); return true; }
        const [t1, i1] = cur.split("|"), [t2, i2] = k.split("|"), pair = { "a-f": ["lf", i1, i2], "f-a": ["lf", i2, i1], "a-d": ["ld", i1, i2], "d-a": ["ld", i2, i1], "a-c": ["lc", i1, i2], "c-a": ["lc", i2, i1], "f-d": ["fd", i1, i2], "d-f": ["fd", i2, i1], "f-c": ["fc", i1, i2], "c-f": ["fc", i2, i1] }[t1 + "-" + t2];
        if (!pair) { ACH_CAF_SEL = { id: x.id, k }; redraw(); return true; }
        achCafSaveOne(x.id, c => { const [o, a, b] = pair, L = c[o][a] || []; c[o][a] = L.includes(b) ? L.filter(y => y !== b) : L.concat([b]); }); redraw(); return true; }
      const mk = e.target.closest(".cafp-mkdvf"); if (mk) { achCafMkDvf(x.id, mk.dataset.f, redraw); return true; }
      const pk = e.target.closest(".cafp-pick"); if (pk) { const f = pk.dataset.f, l = (x.lignes || []).find(y => y.id === pk.dataset.li), P = l ? achCafPrices(x, f, l) : []; if (!P.length) return true;
        const ch = await achPickWin("PRIX À GARDER — " + l.des + " — " + fr(f), P.map(p => ({ v: p.v.id, lab: p.v.ref + " — " + achF2(p.y.pu) + " HT" }))); if (!ch.length) return true;
        achCafSaveOne(x.id, c => { c.pick = c.pick || {}; c.pick[l.id] = { ...(c.pick[l.id] || {}), [f]: ch[0] }; }, "PRIX GARDÉ — " + l.des); redraw(); return true; }
      const dk = e.target.closest(".cafp-doc"); if (dk) { achCopyOpen(dk.dataset.fk); return true; }
      return false; },
    change: (e, redraw) => { const t = e.target; if (!t.closest || !t.closest(".nvp")) return false;
      if (t.matches(".cafp-bsn")) { const b = achBsn().find(y => y.id === t.value); achCafSaveOne(x.id, c => { const l = c.lignes.find(y => y.id === t.dataset.li); if (!l) return; if (b) Object.assign(l, { bsn: b.id, des: b.des, u: b.u, q: achN(b.q), libre: false }); else delete l.bsn; }, "BESOIN DU DÉTAIL"); redraw(); return true; }
      if (t.matches(".cafp-des")) { const a = achArts().find(y => y.id === t.value); achCafSaveOne(x.id, c => { const l = c.lignes.find(y => y.id === t.dataset.li); if (!l || !a) return; if (achKey(a.des, a.u) !== achKey(l.des, l.u)) delete l.bsn; l.des = a.des; l.u = a.u; }, "DÉSIGNATION DU DÉTAIL"); redraw(); return true; }
      if (t.matches(".cafp-l")) { const li = t.dataset.li, f = t.dataset.c, nv = f === "q" || f === "pu" ? achN(t.value) : achU(t.value), c0 = achCaf().find(y => y.id === x.id), l0 = c0 && (c0.lignes || []).find(y => y.id === li), ov = l0 ? l0[f] : undefined;
        const lab = { q: "QUANTITÉ", pu: "PRIX ESTIMÉ", des: "DÉSIGNATION", u: "UNITÉ" }[f] || "DÉTAIL", put = v => achCafSaveOne(x.id, c => { const l = c.lignes.find(y => y.id === li); if (l) l[f] = v; }, lab + " DU DÉTAIL : " + (v ?? ""));
        put(nv); redraw();
        /* 10/11 : ANNULER / RÉTABLIR de la saisie du détail */
        if (String(ov ?? "") !== String(nv ?? "") && typeof sviUndoPush === "function") sviUndoPush(dir => { put(dir === "undo" ? ov : nv); const v = document.getElementById("ach"); if (v && v.__achDraw) v.__achDraw(); else redraw(); }, "MODIFICATION " + (f === "q" ? "DE LA QUANTITÉ" : "DU DÉTAIL"));
        return true; }
      if (t.matches(".cafp-pay")) { achCafSaveOne(x.id, c => { c.rep[t.dataset.f] = { ...(c.rep[t.dataset.f] || {}), pay: achU(t.value) }; }, "CONDITIONS DE PAIEMENT"); return true; }
      if (t.matches(".cafp-rep")) { achCafSaveOne(x.id, c => { c.rep[t.dataset.f] = { ...(c.rep[t.dataset.f] || {}), st: t.value, date: achNow() }; }, "RÉPONSE"); redraw(); return true; }
      if (t.matches(".cafp-cv")) { achCafSaveOne(x.id, c => { const cd = c.cond.find(y => y.id === t.dataset.cd); if (!cd) return; cd.v = cd.t === "num" ? String(achN(t.value)) : cd.t === "date" || cd.t === "on" ? t.value : achU(t.value);
        if (cd.k === "dlim") c.dlim = t.value; if (cd.k === "lieu") c.lieu = cd.v; if (cd.k === "dSouh") c.dSouh = t.value; if (cd.k === "franco") c.franco = cd.v === "OUI"; if (cd.k === "equiv") c.variante = cd.v === "OUI"; }, "CONDITION : " + t.value); redraw(); return true; }
      return false; } };
}
/* 11/11 (Ahmed, validé) : CONDITIONS PARTICULIÈRES ENVOYÉES PAR LA LIAISON — une condition part chez un fournisseur seulement si elle lui est liée
   par le rond : directement (fc) ou par un article (lc) lié à ce fournisseur (lf) ; une condition liée à rien n'est envoyée à personne ; la colonne
   À ENVOYER est retirée (champ env des anciennes données ignoré) ; une condition liée doit avoir une valeur */
const achCafCondOf = (c, f) => { const fc = ((c.fc || {})[f] || []), L = (c.lignes || []).filter(l => ((c.lf || {})[l.id] || []).includes(f));
  return (c.cond || []).filter(cd => fc.includes(cd.id) || L.some(l => ((c.lc || {})[l.id] || []).includes(cd.id))); };
const achCafCondLinked = (c, cd) => (c.frs || []).some(f => achCafCondOf(c, f).includes(cd));
/* 11/11 (Ahmed, validé) : les DOCUMENTS partent comme les conditions — liés au fournisseur par le rond, directement (fd) ou par un article (ld) */
const achCafDocOf = (c, f, DOCS) => { const fd = ((c.fd || {})[f] || []), L = (c.lignes || []).filter(l => ((c.lf || {})[l.id] || []).includes(f));
  return DOCS.filter((d0, i) => { const id = d0.ref || "d" + i; return fd.includes(id) || L.some(l => ((c.ld || {})[l.id] || []).includes(id)); }); };
const achCafCondMiss = c => (c.cond || []).filter(cd => achCafCondLinked(c, cd) && !String(cd.v ?? "").trim());
/* F8 : CRÉER SON DEVIS — prérempli avec les détails liés au fournisseur ; il reste les prix (plusieurs devis du même fournisseur possibles) */
function achCafMkDvf(id, f, redraw) { const c = achCaf().find(y => y.id === id); if (!c) return; achCafUp(c);
  const Ls = c.lignes.filter(l => ((c.lf || {})[l.id] || []).includes(f)); if (!Ls.length) { svToast("AUCUN DÉTAIL LIÉ À CE FOURNISSEUR.", 3000); return; }
  const L = achDvf(), now = achNow(), v = { id: "V" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ref: achNextRef("DVF", L), caf: c.id, frs: f, refFrs: "", date: now.slice(0, 10), validite: "", state: "recu", cree: now,
    lignes: Ls.map(l => ({ bsn: l.bsn || "", des: l.des, u: l.u, q: achN(l.q), pu: "", tva: achPrm().tva })) };
  L.push(v); achDvfSave(L); achHist(v.ref, "CRÉATION", "RÉPONSE DE " + achFrsNom(f) + " À " + c.ref);
  achCafSaveOne(id, x => { x.rep[f] = { ...(x.rep[f] || {}), st: "repondu", date: now, dvf: v.id }; }, "DEVIS CRÉÉ — " + v.ref);
  achDvfFiche(v.id, () => { if (redraw) redraw(); }); }
/* F9 : ENVOYER LA CONSULTATION — pour chaque bloc : TOUS, ou seulement les cochés ; un bordereau par fournisseur (ses détails liés), sans aucun prix */
function achCafSend(id) { const c = achCaf().find(y => y.id === id); if (!c) return; achCafUp(c);
  { const Mi = achCafCondMiss(c); if (Mi.length) { svToast("ENVOI IMPOSSIBLE : CONDITION(S) LIÉE(S) SANS VALEUR — " + Mi.map(cd => cd.lab).join(", ") + ".", 6000); return; } }
  { const ni = (c.lignes || []).filter(l => l.imp).length; if (ni) { svToast("ENVOI IMPOSSIBLE : " + ni + " DÉTAIL(S) IMPORTÉ(S) À VÉRIFIER (EN ROUGE) — LES COCHER PUIS « CONFIRMER LES COCHÉS ».", 5000); return; } }
  const ck = key => { const bl = document.querySelector(`#ach .nvp-blk[data-nvb="${key}"]`); return bl ? [...bl.querySelectorAll("tbody tr[data-ri]")].filter(tr => tr.querySelector(".nvp-cb:checked")).map(tr => +tr.dataset.ri) : []; };
  const B = [["det", "ARTICLES CONSULTÉS", achNvhKey("ARTICLES CONSULTÉS")], ["frs", "FOURNISSEURS CONSULTÉS", achNvhKey("FOURNISSEURS CONSULTÉS")], ["doc", "DOCUMENTS ENVOYÉS", achNvhKey("DOCUMENTS ENVOYÉS")], ["cnd", "CONDITIONS PARTICULIÈRES ET DÉLAIS", achNvhKey("CONDITIONS PARTICULIÈRES")]];
  const CK = Object.fromEntries(B.map(([k, , key]) => [k, ck(key)])), M = Object.fromEntries(B.map(([k]) => [k, CK[k].length ? "ck" : "all"])), d = sviWinNew();
  const det0 = achDetNum(c.lignes, c.grp).filter(o => !o.title);
  const pickL = () => M.det === "ck" ? det0.filter((o, i) => CK.det.includes(achDetNum(c.lignes, c.grp).indexOf(o))).map(o => o.l) : c.lignes;
  const pickF = () => M.frs === "ck" ? CK.frs.map(i => c.frs[i]).filter(Boolean) : c.frs.slice();
  const DOCS = achJ("svi_docs_v1:ACH-" + c.ref, []) || [], pickD = () => (M.doc === "ck" ? CK.doc.map(i => DOCS[i]).filter(Boolean) : DOCS.slice());   /* 11/11 : cases cochées = réduction parmi les documents liés */
  const pickC = () => (M.cnd === "ck" ? CK.cnd.map(i => c.cond[i]).filter(Boolean) : c.cond.slice()).filter(x => String(x.v ?? "").trim());   /* 11/11 : cases cochées = réduction parmi les conditions liées */
  const txtOf = f => { const Ls = pickL().filter(l => ((c.lf || {})[l.id] || []).includes(f)), Cd = (() => { const Lk = achCafCondOf(c, f); return pickC().filter(cd => Lk.includes(cd)); })(), Dc = (() => { const Lk = achCafDocOf(c, f, DOCS); return pickD().filter(d0 => Lk.includes(d0)); })();
    const pay = ((c.rep || {})[f] || {}).pay; const N = achDetNum(Ls, c.grp);
    return { n: Ls.length, txt: "MADAME, MONSIEUR,\n\nMERCI DE NOUS TRANSMETTRE VOTRE MEILLEURE OFFRE POUR :\n" + N.map(o => o.title ? "\n" + o.no + " " + o.lab : o.no + " — " + o.l.des + " : " + achF2(o.l.q) + " " + (o.l.u || "")).join("\n")
      + (Cd.length || pay ? "\n\nCONDITIONS PARTICULIÈRES :\n" + Cd.map(cd => "- " + cd.lab + " : " + (cd.t === "date" ? achDFr(cd.v) : cd.v)).concat(pay ? ["- CONDITIONS DE PAIEMENT : " + pay] : []).join("\n") : "")
      + (Dc.length ? "\n\nDOCUMENTS JOINTS : " + Dc.map(x => x.title || x.ref).join(", ") : "") + "\n\nMERCI DE RAPPELER LA RÉFÉRENCE " + (achFilRefOf(c, f) || c.ref) + " DANS VOTRE DEVIS.\n\nCORDIALEMENT." }; };
  const draw = () => { d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: "ENVOYER LA CONSULTATION — " + esc(c.ref),
    body: `<table class="prm-table frs-sub"><thead><tr><th>BLOC</th><th class="center">TOUS</th><th class="center">LES COCHÉS</th></tr></thead><tbody>${B.map(([k, l]) => `<tr><td>${l}</td><td class="center"><input type="radio" name="snd${k}" data-sm="${k}" value="all"${M[k] === "all" ? " checked" : ""}></td><td class="center"><input type="radio" name="snd${k}" data-sm="${k}" value="ck"${M[k] === "ck" ? " checked" : ""}${CK[k].length ? "" : " disabled"}> ${svCnt(CK[k].length)}</td></tr>`).join("")}</tbody></table>
      <div class="frs-st">BORDEREAU DE CHAQUE FOURNISSEUR (SES DÉTAILS LIÉS — AUCUN PRIX ENVOYÉ)</div>
      <table class="prm-table frs-sub"><thead><tr><th>CONSULTATION PAR FOURNISSEUR</th><th>FOURNISSEUR</th><th>E-MAIL</th><th class="center">DÉTAILS</th><th></th></tr></thead><tbody>${pickF().map(f => { const F = achFrs().find(y => y.id === f) || {}, em = ((F.cte || []).find(y => y.email) || {}).email || "";
        return `<tr><td>${esc(achFilRefOf(c, f))} · <span style="color:var(--st-${achFilSt(c, f)}, ${({ instance: "#b91c1c", remis: "#ea580c", renvoyer: "#CA8A04", valide: "#172033", annule: "#9ca3af" })[achFilSt(c, f)]})">${esc(ACH_FIL_ST[achFilSt(c, f)])}</span></td><td>${esc(achFrsNom(f))}</td><td>${esc(em || "—")}</td><td class="center">${svCnt(txtOf(f).n)}</td><td>${em ? `<button type="button" class="ach-b" data-send="${esc(f)}">ENVOYER</button>` : ""}</td></tr>`; }).join("")}</tbody></table>`,
    foot: `<button type="button" class="svc-b" data-x>FERMER</button>` }); if (!d.isConnected) sviWinShow(d); };
  draw();
  d.addEventListener("change", e => { const r = e.target.closest("[data-sm]"); if (r) { M[r.dataset.sm] = r.value; draw(); } });
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
    const sb = e.target.closest("[data-send]"); if (!sb) return; const f = sb.dataset.send, F = achFrs().find(y => y.id === f) || {}, em = ((F.cte || []).find(y => y.email) || {}).email || "", T = txtOf(f);
    if (!T.n) { svToast("AUCUN DÉTAIL POUR CE FOURNISSEUR.", 2500, sb); return; }
    location.href = "mailto:" + encodeURIComponent(em) + "?subject=" + encodeURIComponent("CONSULTATION " + (achFilRefOf(c, f) || c.ref) + (c.objet ? " — " + c.objet : "")) + "&body=" + encodeURIComponent(T.txt);
    /* série H : la fille est ENVOYÉE ; son empreinte est gardée (un changement de ses articles la met À RENVOYER) */
    achCafSaveOne(id, x => { const t0 = achNow(); x.rep[f] = { ...(x.rep[f] || {}), env: t0 }; x.fil[f] = { ...(x.fil[f] || {}), env: t0, sig: achFilSig(x, f) }; }, "ENVOYÉE À " + achFrsNom(f) + " (" + achFilRefOf(c, f) + ")"); sb.textContent = "ENVOYÉ"; });
}
/* fenêtre i de la consultation (série I, I7 – I9, document unique 10.2) : DATE DE CRÉATION (remplie seule, non modifiable) puis OBJET — rien d'autre
   (plus de RÉFÉRENCE : elle est dans le bandeau ; plus de PROJET : une consultation n'est rattachée à aucun projet) ; création = cette fenêtre, puis la page s'ouvre (3.6) */
function achCafInfo(id, done) { const L0 = achCaf(), c0 = id ? L0.find(x => x.id === id) : null; if (id && !c0) return;
  const C = c0 ? { ...c0 } : { objet: "" }, ro = !!c0 && c0.state !== "ouverte", d = sviWinNew(), dis = ro ? " disabled" : "";
  d.innerHTML = sviWinCard({ cls: "frs-card caf-card caf-info", close: "data-x", title: achWinTtl(c0 && c0.ref, "NOUVELLE CONSULTATION"),
    body: `<div class="frs-g">${achCreeFld(c0)}
      <label class="frs-f frs-w"><span>OBJET</span><input class="ins-in cafi-x" data-k="objet" value="${esc(C.objet || "")}"${dis} autocomplete="off"></label></div>`,
    foot: `<button type="button" class="svc-b" data-x>ANNULER</button>${ro ? "" : `<button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button>`}` });
  sviWinShow(d);
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (done) done(); return; } if (!e.target.closest("[data-ok]")) return;
    const v = k => (d.querySelector(`.cafi-x[data-k="${k}"]`) || {}).value || "", L = achCaf();
    if (c0) { const c = L.find(x => x.id === id); c.objet = achU(v("objet")); c.mod = achNow(); achCafSave(L); achHist(c.ref, "MODIFICATION", c.objet); }
    else { const now = achNow(), c = { id: "C" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ref: achNextRef("CAF", L), objet: achU(v("objet")), date: now.slice(0, 10), dlim: "", lignes: [], frs: [], rep: {}, state: "ouverte", cree: now };
      achCafUp(c); L.push(c); achCafSave(L); achHist(c.ref, "CRÉATION", c.objet); }
    d.remove(); if (done) done(); });
}

/* F1 (série F) : déplacer des détails d'un cran (la numérotation se refait seule, sans trou) ; un détail groupé reste dans son groupe */
function achDetMove(L, ids, dir) { const A = L.slice(), sel = new Set(ids), idx = A.map((l, i) => sel.has(l.id || i) ? i : -1).filter(i => i >= 0);
  (dir < 0 ? idx : idx.reverse()).forEach(i => { let j = i + dir; while (j >= 0 && j < A.length && (A[j].g || "") !== (A[i].g || "") && A[i].g) j += dir; if (j < 0 || j >= A.length || sel.has(A[j].id || j)) return; const t = A[i]; A[i] = A[j]; A[j] = t; });
  return A; }
/* F8 (série F) : CLÔTURER sur la page — total HT de chaque fournisseur avec les prix retenus (un prix par détail, choisi s'il y en a plusieurs),
   choix du RETENU, motif s'il n'est pas le moins cher ; circuit de validation ; les devis du retenu sont RETENUS, les autres REJETÉS ;
   les besoins des détails chiffrés par le retenu deviennent couverts */
function achCafClose(id, done) { const c0 = achCaf().find(y => y.id === id); if (!c0) return; achCafUp(c0); const D = achDvf();
  const F = (c0.frs || []).filter(f => D.some(v => v.caf === id && v.frs === f && v.state !== "annule"));
  const R = F.map(f => { let ht = 0, n = 0, wait = 0, use = new Set(); c0.lignes.forEach(l => { if (!((c0.lf || {})[l.id] || []).includes(f)) return; const p = achCafPrice(c0, f, l, D);
    if (p.st === "ok") { ht += achN(l.q) * achN(p.p.y.pu); n++; use.add(p.p.v.id); } else if (p.st === "choix") wait++; }); return { f, ht, n, wait, use }; });
  const min = Math.min(...R.filter(r => r.ht > 0 && !r.wait).map(r => r.ht)); let ret = c0.retenu && F.includes(c0.retenu) ? c0.retenu : "", motif = c0.motif || ""; const d = sviWinNew();
  const draw = () => { d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: "CLÔTURER — " + esc(c0.ref),
    body: `<table class="prm-table frs-sub"><thead><tr><th>FOURNISSEUR</th><th class="center">DÉTAILS CHIFFRÉS</th><th class="center">PRIX À CHOISIR</th><th class="number">TOTAL HT</th><th class="center">RETENU</th></tr></thead><tbody>${R.map(r => `<tr><td>${esc(achFrsNom(r.f))}${r.ht === min ? " ★" : ""}</td><td class="center">${r.n} / ${c0.lignes.filter(l => ((c0.lf || {})[l.id] || []).includes(r.f)).length}</td><td class="center">${r.wait || ""}</td><td class="number">${esc(achF2(r.ht))}</td><td class="center"><input type="radio" name="cafRet2" value="${esc(r.f)}"${ret === r.f ? " checked" : ""}></td></tr>`).join("")}</tbody></table>
      <label class="frs-f frs-w"><span>MOTIF DU CHOIX (OBLIGATOIRE SI LE RETENU N'EST PAS LE MOINS CHER ★)</span><input class="ins-in cafc-m" value="${esc(motif)}" autocomplete="off"></label>`,
    foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok" data-ok>CLÔTURER AVEC LE RETENU</button>` }); if (!d.isConnected) sviWinShow(d); };
  draw();
  d.addEventListener("change", e => { if (e.target.name === "cafRet2") ret = e.target.value; });
  d.addEventListener("click", async e => { if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; } if (!e.target.closest("[data-ok]")) return;
    motif = achU((d.querySelector(".cafc-m") || {}).value || ""); const r = R.find(z => z.f === ret);
    if (!r) { svToast("CHOISIR LE FOURNISSEUR RETENU.", 3000); return; }
    if (r.wait) { svToast("PRIX À CHOISIR CHEZ CE FOURNISSEUR (TABLEAU COMPARATIF) AVANT DE LE RETENIR.", 4000); return; }
    if (!r.n) { svToast("AUCUN DÉTAIL CHIFFRÉ PAR CE FOURNISSEUR.", 3000); return; }
    if (r.ht > min + 1e-6 && !motif) { svToast("LE RETENU N'EST PAS LE MOINS CHER : MOTIF OBLIGATOIRE.", 4000); return; }
    const used = D.filter(v => r.use.has(v.id)); if (used.some(v => achDvfWhy(v).some(m => /REÇU APRÈS LA DATE LIMITE$|DEVIS EXPIRÉ/.test(m)))) { svToast("UN DEVIS RETENU EST EXPIRÉ OU REÇU APRÈS LA DATE LIMITE : L'ACCEPTER AVEC UN MOTIF (FICHE DU DEVIS).", 5000); return; }
    const C = achCaf().find(y => y.id === id); if (!C) return; achCafUp(C);
    if (await achCircGate("caf", C, achStdMt(C.lignes), async lab => { const L = achCaf(), i = L.findIndex(y => y.id === id); if (i >= 0) { L[i] = C; C.mod = achNow(); achCafSave(L); achHist(C.ref, lab, ""); } })) { d.remove(); if (done) done(); return; }
    if (!(await svConfirm({ title: "CLÔTURER LA CONSULTATION", text: C.ref + " : RETENU " + achFrsNom(ret) + " (" + achF2(r.ht) + " HT). LES AUTRES DEVIS SONT REJETÉS ; LES BESOINS DES DÉTAILS CHIFFRÉS DEVIENNENT COUVERTS.", ok: "CLÔTURER", tone: "neutral" }))) return;
    const now = achNow(), DL = achDvf(); DL.forEach(v => { if (v.caf === id && v.state !== "annule") { v.state = r.use.has(v.id) ? "retenu" : "rejete"; v.mod = now; achHist(v.ref, v.state === "retenu" ? "RETENU" : "REJETÉ", C.ref); } }); achDvfSave(DL);
    const BL = achBsn(); C.lignes.forEach(l => { if (!l.bsn || !((C.lf || {})[l.id] || []).includes(ret)) return; const p = achCafPrice(C, ret, l, DL.map(v => ({ ...v, state: v.state === "rejete" ? "recu" : v.state }))); if (p.st !== "ok") return; const b = BL.find(y => y.id === l.bsn); if (b) { b.couvert = id; b.mod = now; achHist(b.ref, "COUVERT", C.ref + " — " + achFrsNom(ret)); } }); achBsnSave(BL);
    achCafSaveOne(id, x => { x.retenu = ret; x.motif = motif; x.state = "close"; x.close = now; }, "CLOSE — RETENU " + achFrsNom(ret) + (motif ? " — " + motif : ""));
    d.remove(); if (done) done(); });
}

/* ---------- IMPORTER dans le DÉTAIL CONSULTATION (07/11) ----------
   source : un fichier de l'extérieur (Excel, CSV, PDF), un lien Google Sheets, ou un document déjà dans les DOCUMENTS de la consultation ;
   un fichier venu de l'extérieur s'ajoute aussi aux DOCUMENTS ; toute ligne importée arrive « À VÉRIFIER » (en rouge) et doit être confirmée */
const achPdfLib = () => window.pdfjsLib ? Promise.resolve(window.pdfjsLib) : new Promise((ok, ko) => { const sc = document.createElement("script");
  sc.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  sc.onload = () => { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; } catch (e) {} ok(window.pdfjsLib); };
  sc.onerror = () => ko(new Error("LECTEUR PDF INDISPONIBLE (CONNEXION ?)")); document.head.appendChild(sc); });
async function achPdfText(blob) { const lib = await achPdfLib(), pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise, lines = [];
  for (let i = 1; i <= pdf.numPages; i++) { const tc = await (await pdf.getPage(i)).getTextContent(); let y = null, ln = "";
    tc.items.forEach(it => { const yy = Math.round(it.transform[5]); if (y !== null && Math.abs(yy - y) > 2) { lines.push(ln); ln = ""; } y = yy; ln += (ln && !ln.endsWith(" ") ? " " : "") + it.str; }); if (ln) lines.push(ln); }
  return lines.join("\n"); }
const achImpNum = v => { const t = String(v ?? "").trim(); return /^-?[\d\s\u00a0\u202f]*[.,]?\d+$/.test(t) ? achN(t) : NaN; };
/* tableau (lignes × colonnes) → détails : en-tête reconnu (DÉSIGNATION, U, QUANTITÉ, PRIX), sinon colonnes devinées ; ligne sans quantité = titre de groupe */
function achImpRows(aoa) { const A = (aoa || []).map(r => (r || []).map(v => String(v ?? "").trim())).filter(r => r.some(Boolean)); if (!A.length) return [];
  const RX = { des: /D[ÉE]SIGNATION|LIBELL|DESCRIPTION|ARTICLE|NATURE/i, u: /^U\.?$|^UNIT|^UNITÉ/i, q: /QT[ÉE]|QUANT/i, pu: /^P\.?\s?U|PRIX/i };
  let h = -1, C = {}; for (let i = 0; i < Math.min(A.length, 15) && h < 0; i++) { const r = A[i], c = {};
    r.forEach((v, j) => { Object.keys(RX).forEach(k => { if (c[k] === undefined && RX[k].test(v) && !(k === "des" && /PRIX/i.test(v))) c[k] = j; }); });
    if (c.des !== undefined && c.q !== undefined) { h = i; C = c; } }
  if (h < 0) { const n = Math.max(...A.map(r => r.length)), avg = j => A.reduce((s, r) => s + (isNaN(achImpNum(r[j])) ? (r[j] || "").length : 0), 0) / A.length;
    let d = 0; for (let j = 1; j < n; j++) if (avg(j) > avg(d)) d = j; C.des = d;
    for (let j = d + 1; j < n; j++) { const num = A.filter(r => !isNaN(achImpNum(r[j]))).length, sh = A.filter(r => r[j] && isNaN(achImpNum(r[j])) && r[j].length <= 5).length;
      if (C.u === undefined && sh >= A.length / 3) C.u = j; else if (C.q === undefined && num >= A.length / 3) C.q = j; else if (C.pu === undefined && C.q !== undefined && num >= A.length / 3) C.pu = j; } }
  const out = []; A.slice(h + 1).forEach(r => { const des = (r[C.des] || "").replace(/\s+/g, " "), q = C.q !== undefined ? achImpNum(r[C.q]) : NaN; if (!des || /^TOTAL|^SOUS[- ]TOTAL/i.test(des)) return;
    if (isNaN(q) || q <= 0) { if (!(C.u !== undefined && r[C.u])) out.push({ title: des }); return; }
    out.push({ des, u: C.u !== undefined ? (r[C.u] || "") : "", q, pu: C.pu !== undefined && !isNaN(achImpNum(r[C.pu])) ? achImpNum(r[C.pu]) : "" }); });
  return out; }
/* texte d'un PDF → détails : « [N°] DÉSIGNATION  U  QUANTITÉ  [PRIX …] » ; le reste ignoré (tout est à vérifier) */
function achImpPdfRows(txt) { const out = [], NUM = "(?:\\d{1,3}(?:[\\s\\u00a0\\u202f]\\d{3})+|\\d+)(?:[.,]\\d+)?";
  const RE = new RegExp("^(?:\\d+(?:[.]\\d+)*[.)]?\\s+)?(.+?)\\s+(U|UN|M|ML|M2|M²|M3|M³|KG|T|TONNE|L|LITRE|ENS|ENSEMBLE|FF|FORFAIT|PCE|PC|PIECE|PIÈCE|SAC|H|J|JOUR|BOITE|ROULEAU|PAIRE|LOT)\\.?\\s+(" + NUM + ")(?:\\s+(" + NUM + "))?", "i");
  String(txt || "").split(/\n/).forEach(l => { const m = l.trim().match(RE); if (!m) return; const q = achImpNum(m[3].trim()); if (!(q > 0)) return;
    out.push({ des: m[1].replace(/\s+/g, " ").trim(), u: m[2].toUpperCase().replace("M²", "M2").replace("M³", "M3"), q, pu: m[4] && !isNaN(achImpNum(m[4].trim())) ? achImpNum(m[4].trim()) : "" }); });
  return out; }
/* lecture d'un fichier (Excel / CSV / PDF) en détails */
async function achImpBlob(f) { const nm = String(f.name || "") + " " + String(f.type || "");
  if (/pdf/i.test(nm)) return achImpPdfRows(await achPdfText(f));
  const X = await loadXLSX(), wb = /csv|text/i.test(nm) ? X.read(await f.text(), { type: "string", raw: true }) : X.read(await f.arrayBuffer(), { type: "array" });
  return achImpRows(X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false })); }
const achImpSrcWin = DOCS => new Promise(ok => { const d = sviWinNew(), D = DOCS.filter(x => x.fk);
  d.innerHTML = sviWinCard({ cls: "cmpm-pick", close: "data-x", title: "IMPORTER DANS LE DÉTAIL CONSULTATION", body: `<div class="cmpm-list">
    <button type="button" class="svc-b" data-s="file">UN FICHIER DE L'EXTÉRIEUR (EXCEL, CSV, PDF)</button>
    <button type="button" class="svc-b" data-s="gs">UN LIEN GOOGLE SHEETS</button>
    ${D.length ? `<div class="frs-st">UN DOCUMENT DE LA CONSULTATION</div>` + D.map((x, i) => `<button type="button" class="svc-b" data-s="d${i}">${esc((x.ref || "") + " — " + (x.title || x.fname || ""))}</button>`).join("") : ""}
</div>`,   /* 10.5 : pas de bandeau ; le message après l'import dit que les lignes sont à vérifier */
    foot: `<button type="button" class="svc-b" data-x>ANNULER</button>` });
  sviWinShow(d);
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) { d.remove(); ok(null); return; }
    const b = e.target.closest("[data-s]"); if (!b) return; const s = b.dataset.s; d.remove(); ok(s[0] === "d" ? { doc: D[+s.slice(1)] } : { s }); }); });
async function achCafImport(x, redraw) { const code = x.ref || x.code, DOCS = achJ("svi_docs_v1:ACH-" + code, []) || [], src = await achImpSrcWin(DOCS); if (!src) return;
  let rows = null, from = "";
  try {
    if (src.doc) { const f = await sviFiles.get(src.doc.fk); if (!f) { svToast("FICHIER DU DOCUMENT INTROUVABLE SUR CET APPAREIL.", 3500); return; } rows = await achImpBlob(f.name ? f : new File([f], src.doc.fname || "doc", { type: f.type })); from = src.doc.ref || src.doc.title; }
    else if (src.s === "gs") { const url = await achAsk("IMPORTER UN LIEN GOOGLE SHEETS", "LIEN DE LA FEUILLE (PARTAGÉE EN LECTURE)"); if (!url) return;
      const id = (url.match(/\/d\/([a-zA-Z0-9_-]+)/) || [])[1], gid = (url.match(/[#&?]gid=(\d+)/) || [])[1] || "0"; if (!id) { svToast("LIEN GOOGLE SHEETS NON RECONNU.", 3000); return; }
      const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`); if (!r.ok) throw new Error("ACCÈS REFUSÉ (FEUILLE NON PARTAGÉE ?)");
      const X = await loadXLSX(), wb = X.read(await r.text(), { type: "string", raw: true }); rows = achImpRows(X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false })); from = "GOOGLE SHEETS"; }
    else { const f = await new Promise(ok => { const i = document.createElement("input"); i.type = "file"; i.accept = ".xlsx,.xls,.csv,.pdf"; i.onchange = () => ok(i.files[0] || null); i.click(); }); if (!f) return;
      rows = await achImpBlob(f); from = f.name;
      /* le fichier venu de l'extérieur s'ajoute aux DOCUMENTS de la consultation */
      const L = achJ("svi_docs_v1:ACH-" + code, []) || [], k = "ach:doc:" + code + ":" + Date.now().toString(36); try { await sviFiles.put(k, f); } catch (e) {}
      const dx = { ref: "ACH DOC " + code + "/" + String(L.length + 1).padStart(3, "0"), date: new Date().toISOString(), title: "IMPORT — " + f.name, fk: k, fname: f.name }; L.push(dx); achW("svi_docs_v1:ACH-" + code, L); achHist(code, "DOCUMENT", dx.title); }
  } catch (err) { svToast("IMPORT IMPOSSIBLE : " + String(err && err.message || err).toUpperCase(), 4500); return; }
  const n = (rows || []).filter(r => !r.title).length; if (!n) { svToast("AUCUNE LIGNE RECONNUE DANS « " + from + " ».", 4000); if (redraw) redraw(); return; }
  achCafSaveOne(x.id, c => { let g = null; c.grp = c.grp || [];
    rows.forEach(r => { if (r.title) { g = { id: achCafId(), lab: achU(r.title) }; g.n = 0; c.grp.push(g); return; }
      const a = achArtOf(r.des, r.u), id = achCafId(), l = a ? { id, des: a.des, u: a.u, q: r.q, imp: true } : { id, des: achU(r.des), u: achU(r.u), q: r.q, pu: r.pu, libre: true, imp: true };
      if (g) { l.g = g.id; g.n++; } c.lignes.push(l); c.lf[id] = (c.frs || []).slice(); });
    c.grp = c.grp.filter(y => y.n !== 0).map(y => { delete y.n; return y; }); }, "IMPORT — " + n + " DÉTAIL(S) À VÉRIFIER (" + from + ")");
  svToast(n + " DÉTAIL(S) IMPORTÉ(S), EN ROUGE : À VÉRIFIER PUIS CONFIRMER (COCHER › CONFIRMER LES COCHÉS).", 5000); if (redraw) redraw(); }

/* ---------- GLISSER UNE LIGNE DU DÉTAIL CONSULTATION (07/11), comme dans le budget ----------
   appui long sur une ligne = la prendre (les cochées partent avec elle si elle est cochée) ; la déposer :
   - au-dessus / au-dessous d'une ligne : même niveau qu'elle (entre dans son groupe ou en sort) ;
   - au-dessus d'un titre de groupe : avant le groupe, hors du groupe ; au-dessous : en tête du groupe ;
   - sur une ligne : nouveau groupe avec elle (ou dans son groupe) ; sur un titre : à la fin du groupe ;
   un groupe devenu vide disparaît */
/* 07/11 (vérification des gestes, 9.3) : le glisser vaut pour TOUS les DÉTAILS des pages d'achat — chaque bloc DÉTAIL s'inscrit ici
   (clé = son bloc) avec ses lignes affichées et la façon d'enregistrer ; une ligne sans identifiant est repérée par sa place (#n) */
const ACH_DET_DRAG = {};
const achDetDropIn = (c, ids, tgt, mode) => { const L0 = c.lignes || [], tmp = L0.map((l, i) => ({ ...l, id: l.id || "#" + i, __t: !l.id }));
  const r = achDetDrop(tmp, c.grp, ids, tgt, mode); if (!r) return false; c.lignes = r.L.map(l => { const y = { ...l }; if (y.__t) delete y.id; delete y.__t; return y; }); c.grp = r.G; return true; };
function achDetDrop(L, G, ids, tgt, mode) { L = L.map(l => ({ ...l })); G = (G || []).map(g => ({ ...g })); const S = new Set(ids);
  if (tgt.l && S.has(tgt.l)) return null; const mv = L.filter(l => S.has(l.id)), rest = L.filter(l => !S.has(l.id)); if (!mv.length) return null;
  const setG = gid => mv.forEach(l => { if (gid) l.g = gid; else delete l.g; }); let at;
  if (tgt.l) { const i = rest.findIndex(l => l.id === tgt.l); if (i < 0) return null; const t = rest[i];
    if (mode === "on") { if (!t.g) { const g = { id: "K" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }; G.push(g); t.g = g.id; } setG(t.g); at = i + 1; }
    else { setG(t.g); at = mode === "before" ? i : i + 1; } }
  else { const I = rest.map((l, i) => l.g === tgt.g ? i : -1).filter(i => i >= 0);
    if (!I.length) { setG(mode === "before" ? "" : tgt.g); at = rest.length; }
    else if (mode === "before") { setG(""); at = I[0]; } else if (mode === "after") { setG(tgt.g); at = I[0]; } else { setG(tgt.g); at = I[I.length - 1] + 1; } }
  rest.splice(at, 0, ...mv); const used = new Set(rest.map(l => l.g).filter(Boolean)); return { L: rest, G: G.filter(g => used.has(g.id)) }; }
{ let T = null, D = null;
  const keyOf = el => { const b = el && el.closest && el.closest("#ach .nvp-blk"); const h = b && b.querySelector("[data-nvh]"); return h && ACH_DET_DRAG[h.dataset.nvh] ? h.dataset.nvh : ""; };
  const blkOf = el => keyOf(el) ? el.closest("#ach .nvp-blk") : null;
  const clr = () => document.querySelectorAll("#ach tr.cafp-dg, #ach tr.cafp-db, #ach tr.cafp-da, #ach tr.cafp-do").forEach(t => t.classList.remove("cafp-dg", "cafp-db", "cafp-da", "cafp-do"));
  const stop = () => { if (T) clearTimeout(T.h); T = null; D = null; clr(); document.documentElement.classList.remove("cafp-dragging"); };
  const at = (x, y) => { const el = document.elementFromPoint(x, y), tr = el && el.closest && el.closest("tr[data-ri]"); if (!tr || !D || !blkOf(tr) || tr === D.tr) return null;
    const r = tr.getBoundingClientRect(), f = (y - r.top) / Math.max(1, r.height); return { tr, mode: f < 0.3 ? "before" : f > 0.7 ? "after" : "on" }; };
  document.addEventListener("pointerdown", e => { const tr = e.target.closest && e.target.closest("tr[data-ri]"), K = tr && keyOf(tr), G = K && ACH_DET_DRAG[K]; if (!G || !G.open) return;
    if (e.target.closest("input, select, button, textarea, .nvp-rd, a")) return; const R = G.rows[+tr.dataset.ri]; if (!R || !R.l) return;
    T = { x: e.clientX, y: e.clientY, tr, h: setTimeout(() => { if (!T) return; const cb = tr.querySelector(".nvp-cb");
      const ids = cb && cb.checked ? [...blkOf(tr).querySelectorAll("tbody tr[data-ri]")].filter(t => t.querySelector(".nvp-cb:checked")).map(t => G.rows[+t.dataset.ri]).filter(r => r && r.l).map(r => r.l) : [R.l];
      D = { tr, ids, G }; tr.classList.add("cafp-dg"); document.documentElement.classList.add("cafp-dragging"); try { navigator.vibrate && navigator.vibrate(15); } catch (err) {} }, 450) }; }, true);
  document.addEventListener("pointermove", e => { if (T && !D && Math.hypot(e.clientX - T.x, e.clientY - T.y) > 8) { stop(); return; } if (!D) return;
    clr(); D.tr.classList.add("cafp-dg"); const a = at(e.clientX, e.clientY); D.a = a; if (a) a.tr.classList.add({ before: "cafp-db", after: "cafp-da", on: "cafp-do" }[a.mode]); }, true);
  document.addEventListener("touchmove", e => { if (D) e.preventDefault(); }, { passive: false, capture: true });
  document.addEventListener("pointerup", () => { if (!D) { stop(); return; } const d = D, a = D.a; stop(); if (!a) return; const R = d.G.rows[+a.tr.dataset.ri]; if (!R) return;
    let ok = false; d.G.apply(c => { ok = achDetDropIn(c, d.ids, R, a.mode); });
    if (ok && ACH_NV_REDRAW) ACH_NV_REDRAW(); }, true);
  document.addEventListener("pointercancel", stop, true);
  document.addEventListener("click", e => { if (document.documentElement.classList.contains("cafp-dragging")) { e.preventDefault(); e.stopPropagation(); } }, true);
}
