/* =========================================================
   F3 – F12 (série F, 06/11/2026) : PAGE DE LA CONSULTATION FOURNISSEURS sur le modèle du budget — une seule page, quatre blocs liés par les
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
  if (!Array.isArray(c.cond)) { ch = true; c.cond = ACH_CAF_COND.map(([k, lab, t]) => ({ id: k, k, lab, t, v: k === "dlim" ? c.dlim || "" : k === "lieu" ? c.lieu || "" : k === "dSouh" ? c.dSouh || "" : k === "equiv" ? (c.variante ? "OUI" : "NON") : k === "franco" ? (c.franco ? "OUI" : "NON") : "", env: true })); }
  ["lf", "ld", "lc", "fd", "fc"].forEach(k => { if (!c[k] || typeof c[k] !== "object") { c[k] = {}; ch = true; } });
  (c.lignes || []).forEach(l => { if (!Array.isArray(c.lf[l.id])) { c.lf[l.id] = (c.frs || []).slice(); ch = true; } });
  return ch; }
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
    if (seen.has(l.g)) return; seen.add(l.g); const gn = ++n, g = G.find(x => x.id === l.g); out.push({ title: g, no: String(gn), lab: "GROUPE " + (G.indexOf(g) + 1) });
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
  const det = achDetNum(x.lignes || [], x.grp).map(o => { if (o.title) return { cls: "ins-title nvp-gt", cells: [o.no, { h: "<b>" + esc(o.lab) + "</b>", t: o.lab }, "", "", "", "", "", "", "", ""] };
    const l = o.l, i = o.i, a = achArtOf(l.des, l.u), b = l.bsn ? achBsn().find(y => y.id === l.bsn) : null, pe = achStdPu(l.des, l.u, l.pu), k = "a|" + l.id;
    const BO = achBsnOpen().filter(y => !usedB.has(y.id) || y.id === l.bsn).concat(b && !achBsnOpen().some(y => y.id === b.id) ? [b] : []);
    const AO = achArts().filter(y => !y.del && !y.bloq && !y.arch && (!takenD.has(achKey(y.des, y.u)) || achKey(y.des, y.u) === achKey(l.des, l.u)));
    const nF = ((x.lf || {})[l.id] || []).filter(f => (x.frs || []).includes(f)).length;
    return { rd: { k, st: rdSt(k) }, go: a ? [[2, "art", a.id]] : [], cells: [o.no,
      { h: `<select class="ins-in cafp-bsn" data-li="${esc(l.id)}"${dis}><option value="">—</option>${BO.map(y => `<option value="${esc(y.id)}"${y.id === l.bsn ? " selected" : ""}>${esc(y.ref + " · " + (achArtOf(y.des, y.u) ? achRefSvi(achArtOf(y.des, y.u), achArts(), "ARA") : "HORS LISTE") + " · " + y.des + " · " + y.u + " · " + achF2(y.q))}</option>`).join("")}</select>`, t: b ? b.ref : "" },
      a ? achRefSvi(a, achArts(), "ARA") : "HORS LISTE",
      l.libre ? { h: `<input class="ins-in cafp-l" data-li="${esc(l.id)}" data-c="des" value="${esc(l.des || "")}"${dis}>`, t: l.des || "" } : { h: `<select class="ins-in cafp-des" data-li="${esc(l.id)}"${dis}><option value="">—</option>${AO.map(y => `<option value="${esc(y.id)}"${achKey(y.des, y.u) === achKey(l.des, l.u) ? " selected" : ""}>${esc(y.des + " (" + y.u + ")")}</option>`).join("")}</select>`, t: l.des || "" },
      l.libre ? { h: `<input class="ins-in cafp-l center" data-li="${esc(l.id)}" data-c="u" value="${esc(l.u || "")}"${dis}>`, t: l.u || "" } : l.u || "",
      { h: `<input class="ins-in cafp-l number" data-li="${esc(l.id)}" data-c="q" inputmode="decimal" value="${esc(String(l.q ?? "").replace(".", ","))}"${dis}>`, t: achN(l.q) },
      a ? pe : { h: `<input class="ins-in cafp-l number" data-li="${esc(l.id)}" data-c="pu" inputmode="decimal" value="${esc(String(l.pu ?? "").replace(".", ","))}" placeholder="À SAISIR"${dis}>`, t: achN(l.pu) },
      achN(l.q) * pe, b ? achN(l.q) * achN(b.pu) : "", String(nF)] }; });
  const DET = { t: "DÉTAIL CONSULTATION", add: open ? "CRÉER UN DÉTAIL ICI…" : "", cols: [["ARTICLE", "center"], ["BESOIN"], ["CODE ARTICLE"], ["DÉSIGNATION"], ["U", "center"], ["QUANTITÉ", "number"], ["PRIX ESTIMÉ", "number"], ["MONTANT ESTIMÉ", "number"], ["MONTANT BUDGÉTÉ (NON ENVOYÉ)", "number"], ["FOURNISSEURS", "center"]],
    rows: det, addFn: redraw => { achCafSaveOne(x.id, c => { const id = achCafId(); c.lignes.push({ id, des: "", u: "", q: "" }); c.lf[id] = (c.frs || []).slice(); }, "DÉTAIL AJOUTÉ"); redraw(); },
    menu: open ? [{ k: "bsn", lab: "AJOUTER LES BESOINS VALIDÉS NON COUVERTS" }, { k: "libre", lab: "AJOUTER UN ARTICLE HORS LISTE" }, { k: "up", lab: "MONTER LES COCHÉS" }, { k: "down", lab: "DESCENDRE LES COCHÉS" }, { k: "grp", lab: "GROUPER LES COCHÉS" }, { k: "ungrp", lab: "SORTIR LES COCHÉS DE LEUR GROUPE" }, { k: "rm", lab: "SUPPRIMER LES COCHÉS" }] : [],
    act: async (a, ck, redraw) => { const rowsL = ck.map(i => det[i]).filter(r => r && r.rd).map(r => r.rd.k.slice(2));
      if (a === "libre") { achCafSaveOne(x.id, c => { const id = achCafId(); c.lignes.push({ id, des: "", u: "", q: "", pu: "", libre: true }); c.lf[id] = (c.frs || []).slice(); }, "DÉTAIL HORS LISTE AJOUTÉ"); redraw(); return; }
      if (a === "bsn") { const have = new Set((x.lignes || []).map(l => l.bsn).filter(Boolean)), BB = achBsnOpen().filter(b => !have.has(b.id)); if (!BB.length) { svToast("AUCUN BESOIN VALIDÉ NON COUVERT.", 3000); return; }
        const pick = await achPickWin("BESOINS VALIDÉS NON COUVERTS", BB.map(b => ({ v: b.id, lab: b.ref + " — " + b.des + " (" + achF2(b.q) + " " + b.u + ")" }))); if (!pick.length) return;
        achCafSaveOne(x.id, c => BB.filter(b => pick.includes(b.id)).forEach(b => { const id = achCafId(); c.lignes.push({ id, bsn: b.id, des: b.des, u: b.u, q: achN(b.q) }); c.lf[id] = (c.frs || []).slice(); }), "BESOINS AJOUTÉS"); redraw(); return; }
      if (!rowsL.length) { svToast("COCHER D'ABORD DES DÉTAILS.", 2500); return; }
      if (a === "up" || a === "down") { achCafSaveOne(x.id, c => { c.lignes = achDetMove(c.lignes, rowsL, a === "up" ? -1 : 1); }, "DÉTAILS DÉPLACÉS"); redraw(); return; }
      if (a === "grp") { achCafSaveOne(x.id, c => { c.grp = c.grp || []; const g = { id: achCafId() }; c.grp.push(g); c.lignes.forEach(l => { if (rowsL.includes(l.id)) l.g = g.id; }); }, "GROUPE CRÉÉ"); redraw(); return; }
      if (a === "ungrp") { achCafSaveOne(x.id, c => c.lignes.forEach(l => { if (rowsL.includes(l.id)) delete l.g; }), "SORTIS DU GROUPE"); redraw(); return; }
      if (a === "rm") { if (!(await svConfirm({ title: "SUPPRIMER LES DÉTAILS COCHÉS", text: rowsL.length + " DÉTAIL(S) ; LA NUMÉROTATION SE REFAIT.", ok: "SUPPRIMER" }))) return;
        achCafSaveOne(x.id, c => { c.lignes = c.lignes.filter(l => !rowsL.includes(l.id)); rowsL.forEach(id => { delete c.lf[id]; delete c.ld[id]; delete c.lc[id]; }); }, "DÉTAILS SUPPRIMÉS"); redraw(); } } };
  /* ---- FOURNISSEURS (F12) ---- */
  const FRS = { t: "FOURNISSEURS", add: open ? "AJOUTER UN FOURNISSEUR ICI…" : "", cols: [["FOURNISSEUR"], ["E-MAIL"], ["CONDITIONS DE PAIEMENT"], ["RÉPONSE", "center"], ["DÉTAILS LIÉS", "center"], ["DEVIS"]],
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
  /* ---- DOCUMENTS : ceux de l'onglet DOCUMENTS du SUIVI ; cochés = à envoyer ---- */
  const DOCS = achJ("svi_docs_v1:ACH-" + (x.ref || x.code), []) || [];
  const DOC = { t: "DOCUMENTS", add: open ? "AJOUTER UN DOCUMENT ICI… (IL S'AJOUTE AUSSI AU SUIVI)" : "", cols: [["RÉFÉRENCE"], ["INTITULÉ"], ["FICHIER", "center"], ["À ENVOYER", "center"]],
    rows: DOCS.map((d0, i) => { const id = d0.ref || "d" + i, k = "d|" + id; return { rd: { k, st: rdSt(k) }, cells: [d0.ref || "", d0.title || "", d0.fk ? { h: `<button type="button" class="ach-link cafp-doc" data-fk="${esc(d0.fk)}">OUVRIR</button>`, t: "OUVRIR" } : "",
      { h: `<input type="checkbox" class="cafp-denv" data-d="${esc(id)}"${(x.denv || []).includes(id) ? " checked" : ""}${dis}>`, t: (x.denv || []).includes(id) ? "OUI" : "NON" }] }; }),
    addFn: async redraw => { const R = achRecBlock(x.ref || x.code); if (await R.addTab("doc")) { const L2 = R.list("doc"), n = L2[L2.length - 1]; if (n) achCafSaveOne(x.id, c => { c.denv = (c.denv || []).concat([n.ref]); }, "DOCUMENT JOINT"); } redraw(); } };
  /* ---- CONDITIONS PARTICULIÈRES (F5) ---- */
  const CND = { t: "CONDITIONS PARTICULIÈRES", add: open ? "AJOUTER UNE CONDITION ICI…" : "", cols: [["CONDITION"], ["VALEUR"], ["À ENVOYER", "center"]],
    rows: (x.cond || []).map(cd => { const k = "c|" + cd.id, inp = cd.t === "on" ? `<select class="ins-in cafp-cv" data-cd="${esc(cd.id)}"${dis}>${["", "OUI", "NON"].map(v => `<option value="${v}"${cd.v === v ? " selected" : ""}>${v || "—"}</option>`).join("")}</select>`
        : `<input class="ins-in cafp-cv${cd.t === "num" ? " number" : ""}" data-cd="${esc(cd.id)}"${cd.t === "date" ? ' type="date"' : ""}${cd.t === "num" ? ' inputmode="decimal"' : ""} value="${esc(cd.v || "")}"${dis}>`;
      return { rd: { k, st: rdSt(k) }, cells: [cd.lab, { h: inp, t: cd.v || "" }, { h: `<input type="checkbox" class="cafp-cenv" data-cd="${esc(cd.id)}"${cd.env !== false ? " checked" : ""}${dis}>`, t: cd.env !== false ? "OUI" : "NON" }] }; }),
    addFn: async redraw => { const lab = await achAsk("NOUVELLE CONDITION PARTICULIÈRE", "INTITULÉ (AJOUTÉ AUSSI À ACHATS › CLAUSES)"); if (!lab) return;
      achCafSaveOne(x.id, c => { c.cond.push({ id: achCafId(), k: "autre", lab: achU(lab), t: "text", v: "", env: true }); }, "CONDITION AJOUTÉE");
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
      try { const L = achCmf(), cm = L.find(y => y.id === m.id); if (cm) { const C2 = (achCaf().find(y => y.id === x.id) || x); cm.cla = (Array.isArray(cm.cla) ? cm.cla : achClCopy(achPrm().clP)).concat((C2.cond || []).filter(cd => cd.env !== false && cd.v && (!(C2.fc || {})[v.frs] || !(C2.fc[v.frs] || []).length || C2.fc[v.frs].includes(cd.id))).map(cd => ({ id: "c" + cd.id, t: "autre", txt: cd.lab + " : " + cd.v }))); achCmfSave(L); } } catch (e) {}
      achGo("cmf", m.id); return true; },
    links: [DET, FRS, DOC, CND].concat(FC.length ? [CMP] : []).concat([B.DV("DEVIS", DD), B.CM("COMMANDES", achCmf().filter(c => c.caf === x.id))]),
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
      if (t.matches(".cafp-l")) { achCafSaveOne(x.id, c => { const l = c.lignes.find(y => y.id === t.dataset.li); if (!l) return; const f = t.dataset.c; l[f] = f === "q" || f === "pu" ? achN(t.value) : achU(t.value); }); redraw(); return true; }
      if (t.matches(".cafp-pay")) { achCafSaveOne(x.id, c => { c.rep[t.dataset.f] = { ...(c.rep[t.dataset.f] || {}), pay: achU(t.value) }; }, "CONDITIONS DE PAIEMENT"); return true; }
      if (t.matches(".cafp-rep")) { achCafSaveOne(x.id, c => { c.rep[t.dataset.f] = { ...(c.rep[t.dataset.f] || {}), st: t.value, date: achNow() }; }, "RÉPONSE"); redraw(); return true; }
      if (t.matches(".cafp-denv")) { achCafSaveOne(x.id, c => { const L = c.denv || []; c.denv = t.checked ? L.concat([t.dataset.d]) : L.filter(y => y !== t.dataset.d); }); return true; }
      if (t.matches(".cafp-cenv")) { achCafSaveOne(x.id, c => { const cd = c.cond.find(y => y.id === t.dataset.cd); if (cd) cd.env = t.checked; }); return true; }
      if (t.matches(".cafp-cv")) { achCafSaveOne(x.id, c => { const cd = c.cond.find(y => y.id === t.dataset.cd); if (!cd) return; cd.v = cd.t === "num" ? String(achN(t.value)) : cd.t === "date" || cd.t === "on" ? t.value : achU(t.value);
        if (cd.k === "dlim") c.dlim = t.value; if (cd.k === "lieu") c.lieu = cd.v; if (cd.k === "dSouh") c.dSouh = t.value; if (cd.k === "franco") c.franco = cd.v === "OUI"; if (cd.k === "equiv") c.variante = cd.v === "OUI"; }, "CONDITION : " + t.value); redraw(); return true; }
      return false; } };
}
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
  const ck = key => { const bl = document.querySelector(`#ach .nvp-blk[data-nvb="${key}"]`); return bl ? [...bl.querySelectorAll("tbody tr[data-ri]")].filter(tr => tr.querySelector(".nvp-cb:checked")).map(tr => +tr.dataset.ri) : []; };
  const B = [["det", "DÉTAIL CONSULTATION", achNvhKey("DÉTAIL CONSULTATION")], ["frs", "FOURNISSEURS", achNvhKey("FOURNISSEURS")], ["doc", "DOCUMENTS", achNvhKey("DOCUMENTS")], ["cnd", "CONDITIONS PARTICULIÈRES ET DÉLAIS", achNvhKey("CONDITIONS PARTICULIÈRES")]];
  const CK = Object.fromEntries(B.map(([k, , key]) => [k, ck(key)])), M = Object.fromEntries(B.map(([k]) => [k, CK[k].length ? "ck" : "all"])), d = sviWinNew();
  const det0 = achDetNum(c.lignes, c.grp).filter(o => !o.title);
  const pickL = () => M.det === "ck" ? det0.filter((o, i) => CK.det.includes(achDetNum(c.lignes, c.grp).indexOf(o))).map(o => o.l) : c.lignes;
  const pickF = () => M.frs === "ck" ? CK.frs.map(i => c.frs[i]).filter(Boolean) : c.frs.slice();
  const DOCS = achJ("svi_docs_v1:ACH-" + c.ref, []) || [], pickD = () => (M.doc === "ck" ? CK.doc.map(i => DOCS[i]).filter(Boolean) : DOCS.filter((x, i) => (c.denv || []).includes(x.ref || "d" + i)));
  const pickC = () => (M.cnd === "ck" ? CK.cnd.map(i => c.cond[i]).filter(Boolean) : c.cond.filter(x => x.env !== false)).filter(x => x.v);
  const txtOf = f => { const Ls = pickL().filter(l => ((c.lf || {})[l.id] || []).includes(f)), Cd = pickC().filter(cd => !((c.fc || {})[f] || []).length || c.fc[f].includes(cd.id)), Dc = pickD();
    const pay = ((c.rep || {})[f] || {}).pay; const N = achDetNum(Ls, c.grp);
    return { n: Ls.length, txt: "MADAME, MONSIEUR,\n\nMERCI DE NOUS TRANSMETTRE VOTRE MEILLEURE OFFRE POUR :\n" + N.map(o => o.title ? "\n" + o.no + " " + o.lab : o.no + " — " + o.l.des + " : " + achF2(o.l.q) + " " + (o.l.u || "")).join("\n")
      + (Cd.length || pay ? "\n\nCONDITIONS PARTICULIÈRES :\n" + Cd.map(cd => "- " + cd.lab + " : " + (cd.t === "date" ? achDFr(cd.v) : cd.v)).concat(pay ? ["- CONDITIONS DE PAIEMENT : " + pay] : []).join("\n") : "")
      + (Dc.length ? "\n\nDOCUMENTS JOINTS : " + Dc.map(x => x.title || x.ref).join(", ") : "") + "\n\nMERCI DE RAPPELER LA RÉFÉRENCE " + c.ref + " DANS VOTRE DEVIS.\n\nCORDIALEMENT." }; };
  const draw = () => { d.innerHTML = sviWinCard({ cls: "frs-card", close: "data-x", title: "ENVOYER LA CONSULTATION — " + esc(c.ref),
    body: `<table class="prm-table frs-sub"><thead><tr><th>BLOC</th><th class="center">TOUS</th><th class="center">LES COCHÉS</th></tr></thead><tbody>${B.map(([k, l]) => `<tr><td>${l}</td><td class="center"><input type="radio" name="snd${k}" data-sm="${k}" value="all"${M[k] === "all" ? " checked" : ""}></td><td class="center"><input type="radio" name="snd${k}" data-sm="${k}" value="ck"${M[k] === "ck" ? " checked" : ""}${CK[k].length ? "" : " disabled"}> ${svCnt(CK[k].length)}</td></tr>`).join("")}</tbody></table>
      <div class="frs-st">BORDEREAU DE CHAQUE FOURNISSEUR (SES DÉTAILS LIÉS — AUCUN PRIX ENVOYÉ)</div>
      <table class="prm-table frs-sub"><thead><tr><th>FOURNISSEUR</th><th>E-MAIL</th><th class="center">DÉTAILS</th><th></th></tr></thead><tbody>${pickF().map(f => { const F = achFrs().find(y => y.id === f) || {}, em = ((F.cte || []).find(y => y.email) || {}).email || "";
        return `<tr><td>${esc(achFrsNom(f))}</td><td>${esc(em || "—")}</td><td class="center">${svCnt(txtOf(f).n)}</td><td>${em ? `<button type="button" class="ach-b" data-send="${esc(f)}">ENVOYER</button>` : ""}</td></tr>`; }).join("")}</tbody></table>`,
    foot: `<button type="button" class="svc-b" data-x>FERMER</button>` }); if (!d.isConnected) sviWinShow(d); };
  draw();
  d.addEventListener("change", e => { const r = e.target.closest("[data-sm]"); if (r) { M[r.dataset.sm] = r.value; draw(); } });
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
    const sb = e.target.closest("[data-send]"); if (!sb) return; const f = sb.dataset.send, F = achFrs().find(y => y.id === f) || {}, em = ((F.cte || []).find(y => y.email) || {}).email || "", T = txtOf(f);
    if (!T.n) { svToast("AUCUN DÉTAIL POUR CE FOURNISSEUR.", 2500, sb); return; }
    location.href = "mailto:" + encodeURIComponent(em) + "?subject=" + encodeURIComponent("CONSULTATION " + c.ref + (c.objet ? " — " + c.objet : "")) + "&body=" + encodeURIComponent(T.txt);
    achCafSaveOne(id, x => { x.rep[f] = { ...(x.rep[f] || {}), env: achNow() }; }, "ENVOYÉE À " + achFrsNom(f)); sb.textContent = "ENVOYÉ"; });
}
/* fenêtre i de la consultation (F5) : RÉFÉRENCE, OBJET, PROJET, DATE seulement ; création = cette fenêtre, puis la page s'ouvre (3.6) */
function achCafInfo(id, done) { const L0 = achCaf(), c0 = id ? L0.find(x => x.id === id) : null; if (id && !c0) return;
  const C = c0 ? { ...c0 } : { objet: "", projet: "", date: achNow().slice(0, 10) }, ro = !!c0 && c0.state !== "ouverte", d = sviWinNew(), dis = ro ? " disabled" : "";
  d.innerHTML = sviWinCard({ cls: "frs-card caf-card caf-info", close: "data-x", title: c0 ? "CONSULTATION FOURNISSEURS — " + esc(c0.ref) : "NOUVELLE CONSULTATION FOURNISSEURS",
    body: `<div class="frs-g"><label class="frs-f"><span>RÉFÉRENCE</span><input class="ins-in" value="${esc(c0 ? c0.ref : "(À LA CRÉATION)")}" readonly></label>
      <label class="frs-f frs-w"><span>OBJET</span><input class="ins-in cafi-x" data-k="objet" value="${esc(C.objet || "")}"${dis} autocomplete="off"></label>
      <label class="frs-f"><span>PROJET</span><input class="ins-in cafi-x" data-k="projet" value="${esc(C.projet || "")}"${dis} autocomplete="off"></label>
      <label class="frs-f"><span>DATE</span><input type="date" class="ins-in cafi-x" data-k="date" value="${esc(String(C.date || C.cree || "").slice(0, 10))}"${dis}></label></div>`,
    foot: `<button type="button" class="svc-b" data-x>ANNULER</button>${ro ? "" : `<button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button>`}` });
  sviWinShow(d);
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (done) done(); return; } if (!e.target.closest("[data-ok]")) return;
    const v = k => (d.querySelector(`.cafi-x[data-k="${k}"]`) || {}).value || "", L = achCaf();
    if (c0) { const c = L.find(x => x.id === id); c.objet = achU(v("objet")); c.projet = achU(v("projet")); c.date = v("date"); c.mod = achNow(); achCafSave(L); achHist(c.ref, "MODIFICATION", c.objet); }
    else { const now = achNow(), c = { id: "C" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ref: achNextRef("CAF", L), objet: achU(v("objet")), projet: achU(v("projet")), date: v("date"), dlim: "", lignes: [], frs: [], rep: {}, state: "ouverte", cree: now };
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
