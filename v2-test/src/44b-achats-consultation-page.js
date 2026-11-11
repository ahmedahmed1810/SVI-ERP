/* v1119 (L13, série L) : CRÉER LA COMMANDE depuis la page d'un devis RETENU (plus depuis la consultation).
   Devis issu d'une consultation : lignes = détails liés au retenu, au prix gardé (F8), conditions particulières envoyées → clauses (F5, règle 12.3). */
function achDvfMkCmf(dvfId) { const v = achDvf().find(y => y.id === dvfId); if (!v) return null;
  if (achCmf().some(c => (c.dvf === v.id || (c.lignes || []).some(l => l.dvf === v.id)) && c.state !== "annule")) { svToast("CE DEVIS A DÉJÀ SA COMMANDE.", 3000); return null; }
  const x = v.caf ? achCaf().find(y => y.id === v.caf) : null;
  if (!x) { const m = achCmfFrom({ frs: v.frs, dvf: v.id, lignes: v.lignes || [], why: "DEPUIS " + v.ref }); achGo("cmf", m.id); return m; }
  const C0 = x, LL = (C0.lignes || []).filter(l => ((C0.lf || {})[l.id] || []).includes(v.frs)).map(l => { const p = achCafPrice(C0, v.frs, l); return p.st === "ok" ? { ...p.p.y, q: achN(l.q), bsn: l.bsn || p.p.y.bsn || "", dvf: p.p.v.id } : null; }).filter(Boolean);
  const m = achCmfFrom({ frs: v.frs, caf: x.id, dvf: v.id, lignes: LL.length ? LL : v.lignes, why: "DEPUIS " + x.ref + " — " + v.ref });
  try { const L = achCmf(), cm = L.find(y => y.id === m.id); if (cm) { cm.cla = (Array.isArray(cm.cla) ? cm.cla : achClCopy(achPrm().clP)).concat(achCafCondOf(x, v.frs).filter(cd => String(cd.v ?? "").trim()).map(cd => ({ id: "c" + cd.id, t: "autre", txt: cd.lab + " : " + cd.v }))); achCmfSave(L); } } catch (e) {}
  achGo("cmf", m.id); return m; }
/* =========================================================
   F3 – F12 (série F, 06/11/2026) : PAGE DE LA CONSULTATION sur le modèle du budget — une seule page, quatre blocs liés par les
   ronds à gauche (règle 2.5) : DÉTAIL CONSULTATION, FOURNISSEURS, DOCUMENTS, CONDITIONS PARTICULIÈRES ; puis le comparatif et les pièces liées.
   Liaisons gardées sur la consultation : lf (détail → fournisseurs), ld (détail → documents), lc (détail → conditions),
   fd (fournisseur → documents), fc (fournisseur → conditions). Choisir un détail éclaire ses fournisseurs, documents et conditions ; choisir un
   fournisseur éclaire ses détails (et ses documents, conditions). Toucher le rond d'une autre ligne pendant un choix = lier / délier.
   Un fournisseur ajouté est lié aux détails qu'il a déjà vendus (sinon à tous) : chaque fournisseur a son propre bordereau.
   ========================================================= */
/* v1130 (L6 – L8, 2e livraison ; document unique partie 3, exception à 6.4, validé le 11/11) : CASES COCHÉES = FILTRE DES AUTRES BLOCS —
   articles, fournisseurs, documents, conditions : ne restent que les lignes liées aux cochées (un document ou une condition liés au fournisseur
   coché par un article comptent) ; à l'écran, sans redessin ; compteur « retenues/total » et TOTAL PARTIEL des ARTICLES CONSULTÉS */
let ACH_CAF_FLT = null;
/* v1133 : cases cochées de la page gardées au redessin (rond, rond d'en-tête, ✓ LIER…) puis filtre réappliqué ; oubliées à l'ouverture (achNvMod.open) */
let ACH_CAF_CK = null;
const achCafCkSave = () => { const F = ACH_CAF_FLT, pg = document.querySelector("#ach .nvp"); if (!F || !pg) return;
  ACH_CAF_CK = { id: F.id, S: new Set([...pg.querySelectorAll(".nvp-blk tbody tr[data-ri]")].filter(tr => tr.querySelector(".nvp-cb:checked")).map(tr => (tr.querySelector(".nvp-rd[data-rd]") || {}).dataset?.rd).filter(Boolean)) }; };
const achCafCkOf = (x, k) => !!(ACH_CAF_CK && ACH_CAF_CK.id === x.id && ACH_CAF_CK.S.has(k));
function achCafFilter() { const F = ACH_CAF_FLT, pg = document.querySelector("#ach .nvp"); if (!F || !pg) return;
  const h1 = pg.querySelector(".nvp-ref"); if (!h1 || h1.textContent.trim() !== String(F.ref)) return;
  const rows = [...pg.querySelectorAll(".nvp-blk tbody tr[data-ri]")].map(tr => { const b = tr.querySelector(".nvp-rd[data-rd]"); if (!b) return null; const [g, id] = b.dataset.rd.split("|");
    return { tr, g, id, ck: !!tr.querySelector(".nvp-cb:checked") }; }).filter(Boolean);
  const hidAll = sviLkDomFilter(F.LK, rows, "tr.nvp-gt");
  pg.querySelectorAll(".nvp-blk").forEach(bl => { if (!bl.querySelector(".nvp-rd[data-rd]")) return; const R = [...bl.querySelectorAll("tbody tr[data-ri]")].filter(tr => tr.querySelector(".nvp-rd[data-rd]")), nv = R.filter(tr => !tr.classList.contains("svlk-hid")).length;
    /* v1131 : compteur = articles seulement (titres de groupe non comptés, comme à l'affichage) ; rien de caché = compteur d'origine */
    const cn = bl.querySelector(".blk-head .ttl .svi-cnt"); if (cn) { if (!bl.dataset.cnt0) bl.dataset.cnt0 = cn.outerHTML; const tot = +(bl.dataset.cnt0.match(/>([\d/]+)</) || [, ""])[1].split("/").pop() || R.length;
      cn.outerHTML = nv === R.length ? bl.dataset.cnt0 : svCnt(nv, tot); }
    const ft = bl.querySelector("tfoot .bdg-d-total-row"); if (!ft) return; const C = [...ft.cells], i = C.findIndex(c => /^TOTAL/.test(c.textContent.trim())); if (i < 0) return;
    if (!C[i].dataset.lab0) C[i].dataset.lab0 = C[i].textContent.trim();
    const num = t => { const v = String(t || "").replace(/[\s\u00a0\u202f]/g, "").replace(",", "."); return /^-?\d+(\.\d+)?$/.test(v) ? +v : 0; };
    const sum = R.filter(tr => !tr.classList.contains("svlk-hid")).reduce((a, tr) => a + num((tr.cells[i + 1] || {}).textContent), 0);
    C[i].textContent = nv < R.length || C[i].dataset.lab0 === "TOTAL PARTIEL" ? "TOTAL PARTIEL" : "TOTAL"; if (C[i + 1]) C[i + 1].textContent = achF2(sum); });
  if (typeof achNvpAllSt === "function") pg.querySelectorAll(".nvp-blk table").forEach(achNvpAllSt); }   /* v1133 : état des cases d'en-tête recalculé après le filtre */
document.addEventListener("change", e => { if (e.target.closest && e.target.closest("#ach .nvp .nvp-blk") && e.target.matches(".nvp-cb, .nvp-all")) setTimeout(() => { achCafFilter(); achCafCkSave(); }, 0); });
/* v1126 (L6 – L8) : liaisons par le moteur commun (09g, sviLk) — choix de plusieurs lignes, puis ✓ LIER / ✕ DÉLIER en haut à droite */
const ACH_CAF_LKG = { a: ["ARTICLE", "ARTICLES"], f: ["FOURNISSEUR", "FOURNISSEURS"], d: ["DOCUMENT", "DOCUMENTS"], c: ["CONDITION", "CONDITIONS"] };
const achCafLk = (key, data, alive, G) => sviLk(key, { groups: G || ACH_CAF_LKG, data, alive, hub: G ? "L" : "a",
  pairs: G ? { "L-F": "lf", "L-D": "ld", "L-K": "lc", "F-D": "fd", "F-K": "fc" } : { "a-f": "lf", "a-d": "ld", "a-c": "lc", "f-d": "fd", "f-c": "fc" } });
/* conditions particulières par défaut (F5) — le catalogue est ACHATS › CLAUSES ; une condition ajoutée ici y est ajoutée aussi */
const ACH_CAF_COND = [["dlim", "DATE LIMITE DE RÉPONSE", "date"], ["lieu", "LIEU DE LIVRAISON", "text"], ["dSouh", "LIVRAISON SOUHAITÉE LE", "date"],
  ["pay", "CONDITIONS DE PAIEMENT", "text"], ["avance", "AVANCE (%)", "num"], ["equiv", "ARTICLE ÉQUIVALENT AUTORISÉ", "on"], ["franco", "FRANCO CHANTIER", "on"]];
const achCafId = () => "K" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
/* mise à niveau d'une consultation : identifiants des détails, conditions en tableau (reprises des anciens champs), liaisons */
function achCafUp(c) { let ch = false;
  (c.lignes || []).forEach(l => { if (!l.id) { l.id = achCafId(); ch = true; } });
  if (!Array.isArray(c.cond)) { ch = true; c.cond = ACH_CAF_COND.map(([k, lab, t]) => ({ id: k, k, lab, t, v: k === "dlim" ? c.dlim || "" : k === "lieu" ? c.lieu || "" : k === "dSouh" ? c.dSouh || "" : k === "equiv" ? (c.variante ? "OUI" : "NON") : k === "franco" ? (c.franco ? "OUI" : "NON") : "" })); }
  /* v1119 (L15) : les CONDITIONS DE PAIEMENT sont une condition particulière (plus une colonne des fournisseurs ; l'avance reste une condition à part) */
  if (!c.cond.some(x => x.k === "pay")) { const P = Object.values(c.rep || {}).map(r => r && r.pay).filter(Boolean); const i = c.cond.findIndex(x => x.k === "avance");
    c.cond.splice(i < 0 ? c.cond.length : i, 0, { id: "pay", k: "pay", lab: "CONDITIONS DE PAIEMENT", t: "text", v: P[0] || "" }); ch = true; }
  c.cond.forEach(x => { if (x.k === "avance" && x.lab === "CONDITIONS DE PAIEMENT — AVANCE (%)") { x.lab = "AVANCE (%)"; ch = true; } });
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
  const lk = (o, a, b) => ((x[o] || {})[a] || []).includes(b);
  /* v1126 (L6 – L8) : état du rond et couleur de la ligne par le moteur commun — choisi (rond plein), lié à ce qui est choisi (bleu foncé), lié (bleu clair) */
  const DOCS0 = (achJ("svi_docs_v1:ACH-" + (x.ref || x.code), []) || []).map((d0, i) => d0.ref || "d" + i).filter(id => !(x.dhide || []).includes(id));
  const ALV = { a: new Set((x.lignes || []).map(l => l.id)), f: new Set(x.frs || []), d: new Set(DOCS0), c: new Set((x.cond || []).map(c => c.id)) };
  const LK = achCafLk("caf:" + x.id, () => achCaf().find(y => y.id === x.id) || x, (g, id) => ALV[g] && ALV[g].has(id));
  const rdSt = k => { const [t, id] = k.split("|"); return LK.state(t, id); };
  const lkC = k => LK.rowCls(rdSt(k));
  ACH_CAF_FLT = { id: x.id, ref: x.ref || x.code, LK };   /* v1130 : filtre des blocs liés par les cases cochées (achCafFilter) */
  const ckC = k => achCafCkOf(x, k); requestAnimationFrame(() => achCafFilter());   /* v1133 : cases gardées et filtre réappliqué après chaque dessin */
  const dis = open ? "" : " disabled";
  /* ---- DÉTAIL CONSULTATION ---- */
  const usedB = new Set((x.lignes || []).filter(l => l.bsn).map(l => l.bsn)), takenD = new Set((x.lignes || []).filter(l => l.bsn).map(l => achKey(l.des, l.u)));
  const det = achDetNum(x.lignes || [], x.grp).map(o => { if (o.title) return { cls: "ins-title nvp-gt svlk-gt-" + o.title.id, gid: o.title.id, cells: [o.no, { h: "<b>" + esc(o.lab) + "</b>", t: o.lab }, "", "", "", "", "", "", "", ""] };
    const l = o.l, i = o.i, a = achArtOf(l.des, l.u), b = l.bsn ? achBsn().find(y => y.id === l.bsn) : null, pe = achStdPu(l.des, l.u, l.pu), k = "a|" + l.id;
    const BO = achBsnOpen().filter(y => !usedB.has(y.id) || y.id === l.bsn).concat(b && !achBsnOpen().some(y => y.id === b.id) ? [b] : []);
    const AO = achArts().filter(y => !y.del && !y.bloq && !y.arch && (!takenD.has(achKey(y.des, y.u)) || achKey(y.des, y.u) === achKey(l.des, l.u)));
    const nF = ((x.lf || {})[l.id] || []).filter(f => (x.frs || []).includes(f)).length;
    return { rd: { k, st: rdSt(k) }, ck: ckC(k), cls: (l.imp ? "cafp-imp " : "") + (l.g && (x.grp || []).some(g => g.id === l.g) ? "svlk-g-" + l.g + " " : "") + lkC(k), go: a ? [[2, "art", a.id]] : [], cells: [o.no,
      { h: `<select class="ins-in cafp-bsn" data-li="${esc(l.id)}"${dis}><option value="">—</option>${BO.map(y => `<option value="${esc(y.id)}"${y.id === l.bsn ? " selected" : ""}>${esc(y.ref + " · " + (achArtOf(y.des, y.u) ? achRefSvi(achArtOf(y.des, y.u), achArts(), "ARA") : "HORS LISTE") + " · " + y.des + " · " + y.u + " · " + achF2(y.q))}</option>`).join("")}</select>`, t: b ? b.ref : "" },
      a ? achRefSvi(a, achArts(), "ARA") : "HORS LISTE",
      l.libre ? { h: `<input class="ins-in cafp-l" data-li="${esc(l.id)}" data-c="des" value="${esc(l.des || "")}"${dis}>`, t: l.des || "" } : { h: `<select class="ins-in cafp-des" data-li="${esc(l.id)}"${dis}><option value="">—</option>${AO.map(y => `<option value="${esc(y.id)}"${achKey(y.des, y.u) === achKey(l.des, l.u) ? " selected" : ""}>${esc(y.des + " (" + y.u + ")")}</option>`).join("")}</select>`, t: l.des || "" },
      l.libre ? { h: `<input class="ins-in cafp-l center" data-li="${esc(l.id)}" data-c="u" value="${esc(l.u || "")}"${dis}>`, t: l.u || "" } : l.u || "",
      { h: `<input class="ins-in cafp-l number" data-li="${esc(l.id)}" data-c="q" inputmode="decimal" value="${esc(String(l.q ?? "").replace(".", ","))}"${dis}>`, t: achN(l.q) },
      a ? pe : { h: `<input class="ins-in cafp-l number" data-li="${esc(l.id)}" data-c="pu" inputmode="decimal" value="${esc(String(l.pu ?? "").replace(".", ","))}" placeholder="À SAISIR"${dis}>`, t: achN(l.pu) },
      achN(l.q) * pe, b ? achN(l.q) * achN(b.pu) : "", String(nF)] }; });
  ACH_DET_DRAG[achNvhKey("ARTICLES CONSULTÉS")] = { open, rows: det.map(r => r.rd ? { l: r.rd.k.slice(2) } : { g: r.gid }), apply: f => achCafSaveOne(x.id, c => f(c), "DÉTAIL DÉPLACÉ") };
  const DET = { t: "ARTICLES CONSULTÉS", lines: true, rdh: LK.rdAll("a"), add: open ? "CRÉER UN DÉTAIL ICI…" : "", cols: [["ARTICLE", "center"], ["BESOIN"], ["CODE ARTICLE"], ["DÉSIGNATION"], ["U", "center"], ["QUANTITÉ", "number"], ["PRIX ESTIMÉ", "number"], ["MONTANT ESTIMÉ", "number"], ["MONTANT BUDGÉTÉ (NON ENVOYÉ)", "number"], ["FOURNISSEURS", "center"]],
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
  /* v1119 (L10, série L) : UN SEUL BLOC FOURNISSEURS — regroupe FOURNISSEURS CONSULTÉS, CONSULTATIONS PAR FOURNISSEUR et DEVIS : par fournisseur, son nom (lié),
     la référence de sa consultation fille (H1), l'état de la fille (F18), ses devis (références liées) et leur montant TTC ; le principe mère / filles reste */
  const FRS = { t: "FOURNISSEURS", rdh: LK.rdAll("f"), add: open ? "AJOUTER UN FOURNISSEUR ICI…" : "", cols: [["FOURNISSEUR"], ["CONSULTATION"], ["ÉTAT", "center"], ["DEVIS"], ["MONTANT TTC", "number"]],
    rows: (x.frs || []).map(f => { const V = DD.filter(v => v.frs === f), k = "f|" + f, fil = (x.fil || {})[f], s0 = fil ? achFilSt(x, f, D) : "", mt = V.filter(v => v.state !== "annule" && v.state !== "rejete").reduce((t, v) => t + achDvfTot(v).ttc, 0);
      return { rd: { k, st: rdSt(k) }, ck: ckC(k), cls: lkC(k), go: [[0, "frs", f]], st: s0 || undefined, cells: [fr(f), fil ? achFilRefOf(x, f) : "", s0 ? ACH_FIL_ST[s0] : "",
        { h: V.map(v => `<button type="button" class="ach-link" data-nvgo="dvf|${esc(v.id)}">${esc(v.ref)}</button>`).join(", ") + (open ? ` <button type="button" class="ach-b cafp-mkdvf" data-f="${esc(f)}">CRÉER SON DEVIS</button>` : ""), t: V.map(v => v.ref).join(", ") },
        V.length ? mt : ""] }; }),
    addFn: async redraw => { const K = new Set((x.lignes || []).map(l => achKey(l.des, l.u)));
      const F = achLive(achFrs()).filter(f => achFrsOk(f) && !f.bloq && !(x.frs || []).includes(f.id)).map(f => { const S = achFrsSold(f.id); return { f, n: [...K].filter(k => S.has(k)).length }; }).sort((a, b) => b.n - a.n || a.f.nom.localeCompare(b.f.nom, "fr"));
      if (!F.length) { svToast("AUCUN AUTRE FOURNISSEUR ACTIF (ACHAT › FOURNISSEURS).", 3000); return; }
      const pick = await achPickWin("FOURNISSEURS À CONSULTER", F.map(y => ({ v: y.f.id, lab: y.f.code + " — " + y.f.nom + (y.n ? "  ★ A DÉJÀ VENDU " + y.n + " DE CES ARTICLES" : "") }))); if (!pick.length) return;
      achCafSaveOne(x.id, c => pick.forEach(f => { c.frs.push(f); c.rep = c.rep || {}; c.rep[f] = { st: "attente" }; const S = achFrsSold(f), mine = c.lignes.filter(l => S.has(achKey(l.des, l.u)));
        (mine.length ? mine : c.lignes).forEach(l => { c.lf[l.id] = (c.lf[l.id] || []).concat([f]); }); }), "FOURNISSEURS AJOUTÉS"); redraw(); },
    menu: open ? [{ k: "dec", lab: "LES COCHÉS ONT DÉCLINÉ" }, { k: "att", lab: "LES COCHÉS : EN ATTENTE" }, { k: "rmf", lab: "RETIRER LES COCHÉS (SANS DEVIS)" }] : [],
    act: async (a, ck, redraw) => { if (a === "dec" || a === "att") { const F2 = ck.map(i => (x.frs || [])[i]).filter(Boolean); if (!F2.length) { svToast("COCHER D'ABORD DES FOURNISSEURS.", 2500); return; }   /* v1119 (L10) : la réponse passe par le ⋯ (plus de colonne RÉPONSE) */
        achCafSaveOne(x.id, c => F2.forEach(f => { c.rep[f] = { ...(c.rep[f] || {}), st: a === "dec" ? "decline" : "attente" }; }), a === "dec" ? "FOURNISSEURS : DÉCLINÉ" : "FOURNISSEURS : EN ATTENTE"); redraw(); return; }
      const F = ck.map(i => (x.frs || [])[i]).filter(Boolean).filter(f => !DD.some(v => v.frs === f)); if (!F.length) { svToast("COCHER DES FOURNISSEURS SANS DEVIS.", 2500); return; }
      achCafSaveOne(x.id, c => { c.frs = c.frs.filter(f => !F.includes(f)); F.forEach(f => { delete c.rep[f]; delete c.fd[f]; delete c.fc[f]; Object.keys(c.lf).forEach(l => { c.lf[l] = c.lf[l].filter(y => y !== f); }); }); }, "FOURNISSEURS RETIRÉS"); redraw(); } };
  /* ---- série H (H1) : CONSULTATIONS PAR FOURNISSEUR — une fille par fournisseur, ses seuls articles ; À RENVOYER si ses articles ont changé depuis l'envoi ---- */
  const FIL = { t: "CONSULTATIONS PAR FOURNISSEUR", cols: [["RÉFÉRENCE"], ["FOURNISSEUR"], ["ARTICLES", "center"], ["ENVOYÉE LE", "center"], ["DEVIS"], ["ÉTAT", "center"]],
    rows: (x.frs || []).filter(f => (x.fil || {})[f]).map(f => { const o = x.fil[f], s0 = achFilSt(x, f, D), V = DD.filter(v => v.frs === f), env = o.env || ((x.rep || {})[f] || {}).env || "";
      return { st: s0, go: [[1, "frs", f]],   /* correction : l'état de la fille seul décide de la couleur (plus de « validé » ajouté par le texte de l'état) */ cells: [achFilRefOf(x, f), fr(f), String(achFilLig(x, f).length), env ? achDFr(String(env).slice(0, 10)) : "",
        { h: V.map(v => `<button type="button" class="ach-link" data-nvgo="dvf|${esc(v.id)}">${esc(v.ref)}</button>`).join(", "), t: V.map(v => v.ref).join(", ") }, ACH_FIL_ST[s0]] }; }) };
  /* ---- DOCUMENTS : ceux de l'onglet DOCUMENTS du SUIVI ; cochés = à envoyer ---- */
  const DOCS = (achJ("svi_docs_v1:ACH-" + (x.ref || x.code), []) || []).map((d0, i) => ({ ...d0, __id: d0.ref || "d" + i })).filter(d0 => !(x.dhide || []).includes(d0.__id));   /* 11/11 : documents retirés de la consultation (gardés au SUIVI) */
  const DOC = { t: "DOCUMENTS ENVOYÉS", rdh: LK.rdAll("d"), add: open ? "AJOUTER UN DOCUMENT ICI… (IL S'AJOUTE AUSSI AU SUIVI)" : "", cols: [["RÉFÉRENCE"], ["INTITULÉ"]],   /* 11/11 (Ahmed) : la référence soulignée ouvre le document (plus de colonne FICHIER) */
    rows: DOCS.map((d0, i) => { const id = d0.__id, k = "d|" + id; return { rd: { k, st: rdSt(k) }, ck: ckC(k), cls: lkC(k), cells: [d0.fk ? { h: `<button type="button" class="ach-link cafp-doc" data-fk="${esc(d0.fk)}">${esc(d0.ref || "DOCUMENT")}</button>`, t: d0.ref || "" } : d0.ref || "", d0.title || ""] }; }),
    addFn: async redraw => { const R = achRecBlock(x.ref || x.code); if (await R.addTab("doc")) { const L2 = R.list("doc"), n = L2[L2.length - 1]; void n; } redraw(); },
    /* 11/11 (Ahmed) : SUPPRIMER LES DOCUMENTS COCHÉS — retirés de la consultation (plus envoyés, liaisons retirées), gardés au SUIVI */
    menu: open ? [{ k: "rmd", lab: "SUPPRIMER LES DOCUMENTS COCHÉS", del: true }] : [],
    act: async (a, ck, redraw) => { if (a !== "rmd") return; const D0 = ck.map(i => DOCS[i]).filter(Boolean); if (!D0.length) { svToast("COCHER D'ABORD LES DOCUMENTS À SUPPRIMER (CASES À DROITE).", 3000); return; }
      if (!(await svConfirm({ title: "SUPPRIMER LES DOCUMENTS COCHÉS", html: D0.map(d0 => `<div>- ${esc((d0.ref || "") + (d0.title ? " — " + d0.title : ""))}</div>`).join("") + `<div style="margin-top:12px">ILS RESTENT DANS LE SUIVI.</div>`, ok: "SUPPRIMER" }))) return;
      const ids = D0.map(d0 => d0.__id), snap = JSON.stringify({ dhide: x.dhide || [], fd: x.fd || {}, ld: x.ld || {} });
      const run = () => achCafSaveOne(x.id, c => { c.dhide = [...new Set((c.dhide || []).concat(ids))]; Object.keys(c.fd || {}).forEach(f => { c.fd[f] = (c.fd[f] || []).filter(y => !ids.includes(y)); }); Object.keys(c.ld || {}).forEach(l => { c.ld[l] = (c.ld[l] || []).filter(y => !ids.includes(y)); }); }, "DOCUMENTS RETIRÉS");
      run(); if (typeof sviUndoPush === "function") sviUndoPush(dir => { if (dir === "undo") { const S = JSON.parse(snap); achCafSaveOne(x.id, c => { c.dhide = S.dhide; c.fd = S.fd; c.ld = S.ld; }, "DOCUMENTS RÉTABLIS"); } else run(); redraw(); }, "SUPPRESSION DE DOCUMENTS"); redraw(); } };
  /* ---- CONDITIONS PARTICULIÈRES (F5) ---- */
  const CND = { t: "CONDITIONS PARTICULIÈRES", rdh: LK.rdAll("c"), add: open ? "AJOUTER UNE CONDITION ICI…" : "", cols: [["CONDITION"], ["VALEUR"]],
    rows: (x.cond || []).map(cd => { const k = "c|" + cd.id, inp = cd.t === "on" ? `<select class="ins-in cafp-cv" data-cd="${esc(cd.id)}"${dis}>${["", "OUI", "NON"].map(v => `<option value="${v}"${cd.v === v ? " selected" : ""}>${v || "—"}</option>`).join("")}</select>`
        : `<input class="ins-in cafp-cv${cd.t === "num" ? " number" : ""}" data-cd="${esc(cd.id)}"${cd.t === "date" ? ' type="date"' : ""}${cd.t === "num" ? ' inputmode="decimal"' : ""} value="${esc(cd.v || "")}"${dis}>`;
      const miss = achCafCondLinked(x, cd) && !String(cd.v ?? "").trim();
      return { rd: { k, st: rdSt(k) }, ck: ckC(k), cls: lkC(k), cells: [miss ? { h: `<b class="obs-bang val-bang nv-bang" role="button" data-why="VALEUR MANQUANTE">!</b> ${esc(cd.lab)}`, t: cd.lab } : cd.lab, { h: inp, t: cd.v || "" }] }; }),
    addFn: async redraw => { const lab = await achAsk("NOUVELLE CONDITION PARTICULIÈRE", "INTITULÉ (AJOUTÉ AUSSI À ACHATS › CLAUSES)"); if (!lab) return;
      achCafSaveOne(x.id, c => { c.cond.push({ id: achCafId(), k: "autre", lab: achU(lab), t: "text", v: "" }); }, "CONDITION AJOUTÉE");
      /* un seul catalogue : la condition rejoint les clauses particulières (ACHATS › CLAUSES) si elle n'y est pas */
      const P = achPrm(), Lp = achClP(P); if (!Lp.some(y => achU(y.txt) === achU(lab))) { P.clP = Lp.concat([{ id: "p" + Date.now().toString(36), t: "autre", txt: achU(lab) }]); achPrmSave(P); }
      redraw(); },
    /* 11/11 (Ahmed) : SUPPRIMER LES CONDITIONS COCHÉES — avec leurs liaisons (fournisseurs, articles) ; ANNULER possible */
    menu: open ? [{ k: "rmc", lab: "SUPPRIMER LES CONDITIONS COCHÉES", del: true }] : [],
    act: async (a, ck, redraw) => { if (a !== "rmc") return; const C0 = ck.map(i => (x.cond || [])[i]).filter(Boolean); if (!C0.length) { svToast("COCHER D'ABORD LES CONDITIONS À SUPPRIMER (CASES À DROITE).", 3000); return; }
      if (!(await svConfirm({ title: "SUPPRIMER LES CONDITIONS COCHÉES", html: C0.map(cd => `<div>- ${esc(cd.lab)}</div>`).join(""), ok: "SUPPRIMER" }))) return;
      const ids = C0.map(cd => cd.id), snap = JSON.stringify({ cond: x.cond || [], fc: x.fc || {}, lc: x.lc || {} });
      const run = () => achCafSaveOne(x.id, c => { c.cond = (c.cond || []).filter(cd => !ids.includes(cd.id)); Object.keys(c.fc || {}).forEach(f => { c.fc[f] = (c.fc[f] || []).filter(y => !ids.includes(y)); }); Object.keys(c.lc || {}).forEach(l => { c.lc[l] = (c.lc[l] || []).filter(y => !ids.includes(y)); }); }, "CONDITIONS SUPPRIMÉES");
      run(); if (typeof sviUndoPush === "function") sviUndoPush(dir => { if (dir === "undo") { const S = JSON.parse(snap); achCafSaveOne(x.id, c => { c.cond = S.cond; c.fc = S.fc; c.lc = S.lc; }, "CONDITIONS RÉTABLIES"); } else run(); redraw(); }, "SUPPRESSION DE CONDITIONS"); redraw(); } };
  /* ---- COMPARATIF (F8 : devis partiels, plusieurs devis, prix à choisir) ---- */
  const FC = (x.frs || []).filter(f => DD.some(v => v.frs === f));
  /* v1119 (L14, série L) : TABLEAU COMPARATIF — ARTICLE (avec son unité), QUANTITÉ, puis par fournisseur (son nom en titre) PRIX UNITAIRE TTC et MONTANT TTC ;
     par article : moins-disant en vert, plus cher en rouge, les autres en dégradé entre les deux (comme les indicateurs du budget) ; même mise en forme pour les totaux */
  const ttcOf = (f, l) => { if (!lk("lf", l.id, f)) return null; const p = achCafPrice(x, f, l, D); if (p.st !== "ok") return p; const y = p.p.y, tv = y.tva === "" || y.tva === undefined ? achPrm().tva : achN(y.tva), pu = achN(y.pu) * (1 + tv / 100); return { st: "ok", pu, mt: pu * achN(l.q) }; };
  const grad = (v, A) => { const V = A.filter(a => a !== null), lo = Math.min(...V), hi = Math.max(...V); if (V.length < 2 || hi - lo < 1e-9) return V.length > 1 ? "background:hsl(130,55%,84%) !important" : ""; const t = (v - lo) / (hi - lo);
    return `background:hsl(${Math.round(130 * (1 - t))},62%,${Math.round(84 - 4 * Math.abs(t - .5))}%) !important;color:#172033 !important;-webkit-text-fill-color:#172033 !important`; };
  const cmpRows = (x.lignes || []).map(l => { const P = FC.map(f => ttcOf(f, l)), M = P.map(p => p && p.st === "ok" ? p.mt : null);
    return { cells: [l.des + (l.u ? " (" + l.u + ")" : ""), achN(l.q)].concat(...FC.map((f, i) => { const p = P[i];
      if (!p) return ["—", "—"]; if (p.st === "nc") return ["NON CHIFFRÉ", ""];
      if (p.st === "choix") return [{ h: `<button type="button" class="ach-b cafp-pick" data-f="${esc(f)}" data-li="${esc(l.id)}">À CHOISIR (${p.n} PRIX)</button>`, t: "À CHOISIR" }, ""];
      const st = grad(p.mt, M); return [{ h: achF2(p.pu), t: p.pu, st }, { h: achF2(p.mt), t: p.mt, st }]; })) }; });
  const TT = FC.map(f => (x.lignes || []).reduce((t, l) => { const p = ttcOf(f, l); return t + (p && p.st === "ok" ? p.mt : 0); }, 0));
  const CMP = { t: "TABLEAU COMPARATIF", cols: [["ARTICLE"], ["QUANTITÉ", "number"]].concat(...FC.map(() => [["PRIX UNITAIRE TTC", "number"], ["MONTANT TTC", "number"]])),
    grp: ["", ""].concat(...FC.map(f => [fr(f), fr(f)])),
    rows: cmpRows.concat([{ cls: "caf-tot", cells: ["TOTAL TTC (ARTICLES CHIFFRÉS)", ""].concat(...TT.map(v => ["", { h: achF2(v), t: v, st: grad(v, TT) }])) }]) };
  return { title: x.objet || "", lkBar: open ? LK.bar() : "",   /* v1126 (L6 – L8) : ✓ LIER / ✕ DÉLIER en haut à droite */
    menu: (open ? [x.val ? { k: "send", lab: "REMETTRE LA CONSULTATION (ENVOI AUX FOURNISSEURS)" } : { k: "val", lab: x.circ && !achCircDone(x) ? "CIRCUIT DE VALIDATION" : "VALIDER LA CONSULTATION" }].concat(FC.length ? [{ k: "close", lab: "CLÔTURER (CHOIX DU RETENU)" }] : []) : []),   /* v1119 (L13) : une commande ne se crée que depuis un devis (page du devis retenu) */
    act: async (k, redraw) => {
      if (k === "send") { achCafSend(x.id, redraw); return true; }
      /* v1121 (L20) : VALIDER avant la remise — circuit de validation des consultations s'il s'applique (vert), puis validée, à remettre (orange) */
      if (k === "val") { const L = achCaf(), C = L.find(y => y.id === x.id); if (!C) return true;
        if (!(C.lignes || []).length || !(C.frs || []).length) { svToast("IL FAUT AU MOINS UN ARTICLE ET UN FOURNISSEUR.", 3000); return true; }
        if (await achCircGate("caf", C, achStdMt(C.lignes), async lab => { C.mod = achNow(); achCafSave(L); achHist(C.ref, lab, ""); redraw(); })) return true;
        if (!(await svConfirm({ title: "VALIDER LA CONSULTATION", text: C.ref + " : VALIDÉE, ELLE POURRA ÊTRE REMISE AUX FOURNISSEURS.", ok: "VALIDER", tone: "neutral" }))) return true;
        C.val = achNow(); C.mod = achNow(); achCafSave(L); achHist(C.ref, "VALIDÉE — À REMETTRE", ""); redraw(); return true; }
      if (k === "close") { achCafClose(x.id, redraw); return true; }
      return false; },
    links: [DET, FRS, DOC, CND].concat(FC.length ? [CMP] : []).concat([B.CM("COMMANDES", achCmf().filter(c => c.caf === x.id))]),   /* v1119 (L10) : plus de blocs CONSULTATIONS PAR FOURNISSEUR ni DEVIS */
    /* ronds, devis, choix du prix, documents */
    click: async (e, redraw) => {
      /* v1126 (L6 – L8) : le rond choisit ou libère (plusieurs lignes par bloc) ; rien n'est lié avant ✓ LIER (consultation close : choix pour voir seulement) */
      /* v1132 (L6 – L8) : rond d'en-tête = tout choisir (lignes affichées du bloc) / tout libérer ; grisé si une ligne est choisie à la main */
      const ra = e.target.closest("[data-rdall]"); if (ra && ra.closest(".nvp")) { const g = ra.dataset.rdall;
        if (LK.hand(g)) { svToast("UNE LIGNE DE CE BLOC EST DÉJÀ CHOISIE À LA MAIN — LA LIBÉRER D'ABORD.", 3000, ra); return true; }
        const ids = [...ra.closest(".nvp-blk").querySelectorAll("tbody tr[data-ri]:not(.svlk-hid) .nvp-rd[data-rd]")].map(b => b.dataset.rd.split("|")[1]);
        LK.setAll(g, ids, !LK.allOn(g)); redraw(); return true; }
      const rd = e.target.closest(".nvp-rd[data-rd]"); if (rd && rd.closest(".nvp")) { const [t, id] = rd.dataset.rd.split("|"); LK.toggle(t, id); redraw(); return true; }
      const lb = e.target.closest("[data-svlk]"); if (lb && lb.closest(".nvp") && open) { const on = lb.dataset.svlk === "lier", snap = JSON.stringify(["lf", "ld", "lc", "fd", "fc"].map(m => x[m] || {}));
        const done = await LK.apply(lb.dataset.svlk, (L, on2) => achCafSaveOne(x.id, c => sviLkWrite(c, L, on2), (on2 ? "LIÉ : " : "DÉLIÉ : ") + L.length + " LIAISON(S)"));
        if (done && typeof sviUndoPush === "function") { const after = JSON.stringify(["lf", "ld", "lc", "fd", "fc"].map(m => (achCaf().find(y => y.id === x.id) || {})[m] || {}));
          sviUndoPush(dir => { const V = JSON.parse(dir === "undo" ? snap : after); achCafSaveOne(x.id, c => ["lf", "ld", "lc", "fd", "fc"].forEach((m, i) => { c[m] = V[i]; })); const v = document.getElementById("ach"); if (v && v.__achDraw) v.__achDraw(); else redraw(); }, on ? "LIAISON" : "DÉLIER"); }
        redraw(); return true; }
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
  return DOCS.filter((d0, i) => { const id = d0.__id || d0.ref || "d" + i; return fd.includes(id) || L.some(l => ((c.ld || {})[l.id] || []).includes(id)); }); };
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
function achCafSend(id, redraw) { const c = achCaf().find(y => y.id === id); if (!c) return; achCafUp(c);
  if (!c.val) { svToast("VALIDER D'ABORD LA CONSULTATION (⋯ › VALIDER LA CONSULTATION).", 3500); return; }   /* v1121 (L20) */
  { const Mi = achCafCondMiss(c); if (Mi.length) { svToast("ENVOI IMPOSSIBLE : CONDITION(S) LIÉE(S) SANS VALEUR — " + Mi.map(cd => cd.lab).join(", ") + ".", 6000); return; } }
  { const ni = (c.lignes || []).filter(l => l.imp).length; if (ni) { svToast("ENVOI IMPOSSIBLE : " + ni + " DÉTAIL(S) IMPORTÉ(S) À VÉRIFIER (EN ROUGE) — LES COCHER PUIS « CONFIRMER LES COCHÉS ».", 5000); return; } }
  const ck = key => { const bl = document.querySelector(`#ach .nvp-blk[data-nvb="${key}"]`); return bl ? [...bl.querySelectorAll("tbody tr[data-ri]")].filter(tr => tr.querySelector(".nvp-cb:checked")).map(tr => +tr.dataset.ri) : []; };
  const B = [["det", "ARTICLES CONSULTÉS", achNvhKey("ARTICLES CONSULTÉS")], ["frs", "FOURNISSEURS", achNvhKey("FOURNISSEURS")], ["doc", "DOCUMENTS ENVOYÉS", achNvhKey("DOCUMENTS ENVOYÉS")], ["cnd", "CONDITIONS PARTICULIÈRES ET DÉLAIS", achNvhKey("CONDITIONS PARTICULIÈRES")]];
  const CK = Object.fromEntries(B.map(([k, , key]) => [k, ck(key)])), M = Object.fromEntries(B.map(([k]) => [k, CK[k].length ? "ck" : "all"])), d = sviWinNew();
  const det0 = achDetNum(c.lignes, c.grp).filter(o => !o.title);
  const pickL = () => M.det === "ck" ? det0.filter((o, i) => CK.det.includes(achDetNum(c.lignes, c.grp).indexOf(o))).map(o => o.l) : c.lignes;
  const pickF = () => M.frs === "ck" ? CK.frs.map(i => c.frs[i]).filter(Boolean) : c.frs.slice();
  const DOCS = (achJ("svi_docs_v1:ACH-" + c.ref, []) || []).map((d0, i) => ({ ...d0, __id: d0.ref || "d" + i })).filter(d0 => !(c.dhide || []).includes(d0.__id)), pickD = () => (M.doc === "ck" ? CK.doc.map(i => DOCS[i]).filter(Boolean) : DOCS.slice());   /* 11/11 : cases cochées = réduction parmi les documents liés */
  const pickC = () => (M.cnd === "ck" ? CK.cnd.map(i => c.cond[i]).filter(Boolean) : c.cond.slice()).filter(x => String(x.v ?? "").trim());   /* 11/11 : cases cochées = réduction parmi les conditions liées */
  const txtOf = f => { const Ls = pickL().filter(l => ((c.lf || {})[l.id] || []).includes(f)), Cd = (() => { const Lk = achCafCondOf(c, f); return pickC().filter(cd => Lk.includes(cd)); })(), Dc = (() => { const Lk = achCafDocOf(c, f, DOCS); return pickD().filter(d0 => Lk.includes(d0)); })();
    const pay = ((c.rep || {})[f] || {}).pay; const N = achDetNum(Ls, c.grp);
    return { n: Ls.length, N, Cd, Dc, pay, ref: achFilRefOf(c, f) || c.ref, txt: "MADAME, MONSIEUR,\n\nMERCI DE NOUS TRANSMETTRE VOTRE MEILLEURE OFFRE POUR :\n" + N.map(o => o.title ? "\n" + o.no + " " + o.lab : o.no + " — " + o.l.des + " : " + achF2(o.l.q) + " " + (o.l.u || "")).join("\n")
      + (Cd.length || pay ? "\n\nCONDITIONS PARTICULIÈRES :\n" + Cd.map(cd => "- " + cd.lab + " : " + (cd.t === "date" ? achDFr(cd.v) : cd.v)).concat(pay && !Cd.some(cd => cd.k === "pay") ? ["- CONDITIONS DE PAIEMENT : " + pay] : []).join("\n") : "")
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
    achCafSendPdf(c, f, T, redraw);   /* v1123 (L21) : PDF du fournisseur classé dans SUIVI › DOCUMENTS */
    /* série H : la fille est ENVOYÉE ; son empreinte est gardée (un changement de ses articles la met À RENVOYER) */
    achCafSaveOne(id, x => { const t0 = achNow(); x.rep[f] = { ...(x.rep[f] || {}), env: t0 }; x.fil[f] = { ...(x.fil[f] || {}), env: t0, sig: achFilSig(x, f) }; }, "ENVOYÉE À " + achFrsNom(f) + " (" + achFilRefOf(c, f) + ")"); sb.textContent = "ENVOYÉ"; });
}
/* v1123 (L21) : à l'envoi, le PDF de la consultation de ce fournisseur (ses articles, ses conditions, ses documents joints, aucun prix)
   est rangé dans SUIVI › DOCUMENTS de la consultation (mise en page « ACH-CAF-ENV », réglable dans l'aperçu) ; il n'entre pas dans
   les DOCUMENTS ENVOYÉS (c.dhide) — c'est une trace de l'envoi, pas une pièce jointe à renvoyer */
async function achCafSendPdf(c, f, T, redraw) { const nom = achFrsNom(f);
  const D = { key: "ACH-CAF-ENV", title: "CONSULTATION", ref: T.ref, party: nom, date: achDFr(achNow()),
    cols: [["no", "ARTICLE", "center"], ["des", "DÉSIGNATION", ""], ["u", "U", "center"], ["q", "QUANTITÉ", "number"]],
    rows: T.N.map(o => o.title ? [o.no, o.lab, "", ""] : [o.no, o.l.des || "", o.l.u || "", achF2(o.l.q)]),
    note: [(T.Cd.length || T.pay ? "CONDITIONS PARTICULIÈRES :\n" + T.Cd.map(cd => "- " + cd.lab + " : " + (cd.t === "date" ? achDFr(cd.v) : cd.v)).concat(T.pay && !T.Cd.some(cd => cd.k === "pay") ? ["- CONDITIONS DE PAIEMENT : " + T.pay] : []).join("\n") : ""),
      T.Dc.length ? "DOCUMENTS JOINTS : " + T.Dc.map(x => x.title || x.ref).join(", ") : "", "MERCI DE RAPPELER LA RÉFÉRENCE " + T.ref + " DANS VOTRE DEVIS."].filter(Boolean).join("\n\n") };
  const title = "CONSULTATION " + T.ref + " — " + nom, name = title.replace(/[\\/:*?"<>|]+/g, "-").trim() + ".pdf";   /* v1124 : vrai intitulé au SUIVI, nom nettoyé pour le fichier seulement */
  try { const blob = await sviMep.pdf(D), r = await achRecBlock(c.ref).savePdf(blob, name, title);
    achCafSaveOne(c.id, x => { x.dhide = [...new Set((x.dhide || []).concat([r]))]; });
    svToast("PDF DE " + nom + " CLASSÉ DANS SUIVI › DOCUMENTS (" + r + ").", 3500);
    if (typeof redraw === "function") redraw(); }
  catch (e) { svToast("ENVOI FAIT, MAIS LE PDF DE " + nom + " N'A PAS PU ÊTRE CRÉÉ (CONNEXION ?).", 5000); } }
/* fenêtre i de la consultation — 11/11 (Ahmed, validé, document unique 10.2 modifiée) : à la création comme à la réouverture,
   DATE DE CRÉATION (remplie seule), OBJET, puis quatre blocs : ARTICLES CONSULTÉS (besoin, article, unité, quantité ; IMPORTER),
   FOURNISSEURS CONSULTÉS, DOCUMENTS ENVOYÉS, CONDITIONS PARTICULIÈRES (avec valeur). Besoin choisi parmi les existants (jamais créé ici) ;
   article ou fournisseur inconnu = créé au nom tapé, EN INSTANCE, « CRÉÉ DEPUIS LA CONSULTATION » (fournisseur occasionnel : ni ICE ni RIB exigés).
   ENREGISTRER crée ou met à jour la consultation puis sa page s'ouvre ; liaisons (rond) dans la page ; consultation close = lecture seule. */
function achCafInfo(id, done) { const L0 = achCaf(), c0 = id ? L0.find(x => x.id === id) : null; if (id && !c0) return;
  /* 11/11 (Ahmed, validé) : forme du bloc TÂCHES / DÉSIGNATIONS CLIENT — un bloc CONSULTATION, quatre listes côte à côte (ARTICLES, FOURNISSEURS,
     DOCUMENTS, CONDITIONS) : ronds de liaison, loupe par colonne (tri, filtre, masquer), titres glissés = ordre des colonnes, bords tirés = largeur,
     case d'en-tête et cases des lignes, ligne CRÉER … ICI ; ⋯ du bloc : IMPORTER, SUPPRIMER LES COCHÉS, MODIFIER LE FORMAT */
  const ro = !!c0 && c0.state !== "ouverte", d = sviWinNew(), dis = ro ? " disabled" : "";
  const C = JSON.parse(JSON.stringify(c0 || { objet: "", lignes: [], frs: [] })); if (!c0) { C.lignes = []; C.frs = []; } achCafUp(C);
  const code0 = c0 ? (c0.ref || c0.code) : "";
  const BSN = achBsnOpen(), BS = new Map(achBsn().map(b => [b.id, b])), ARTS = achArts().filter(a => !a.del), FRS = achFrs().filter(f => !f.del);
  const docs0 = code0 ? (achJ("svi_docs_v1:ACH-" + code0, []) || []).map((d0, i) => ({ ...d0, __id: d0.ref || "d" + i })) : [];
  const S = { L: C.lignes.map(l => ({ ...l })), F: C.frs.map(f => ({ k: f, id: f, nom: achFrsNom(f) })), D: docs0.filter(x => !(C.dhide || []).includes(x.__id)).map(x => ({ ...x, k: x.__id })), Dh: [],
    K: (C.cond || []).map(x => ({ ...x })), lk: {}, sel: null };
  ["lf", "ld", "lc", "fd", "fc"].forEach(o => { S.lk[o] = JSON.parse(JSON.stringify(C[o] || {})); });
  /* v1115 (Ahmed) : une ligne en cours de création (encore vide) cache la ligne « CRÉER … ICI » de sa liste */
  const EMPTY = { L: () => S.L.some(r => !r.des && !r.bsn), F: () => S.F.some(r => !r.nom), D: () => false, K: () => S.K.some(r => r.k === "autre" && !r.lab) };
  /* v1126 (L6 – L8) : moteur de liaisons commun sur les cartes de la fenêtre (S.lk) — enregistrées avec ENREGISTRER */
  const LKW = achCafLk("cai:" + (id || "new"), () => S.lk, (g, k) => (LST[g] ? LST[g]() : []).some(r => kOf(g, r) === k), { L: ["ARTICLE", "ARTICLES"], F: ["FOURNISSEUR", "FOURNISSEURS"], D: ["DOCUMENT", "DOCUMENTS"], K: ["CONDITION", "CONDITIONS"] });
  LKW.clear();
  const rdSt = (g, k) => LKW.state(g, k);
  const LST = { L: () => S.L, F: () => S.F, D: () => S.D, K: () => S.K };
  const COLS = {
    L: [["bsn", "BESOIN", r => { const b = BS.get(r.bsn); return b ? b.ref : ""; }], ["des", "ARTICLES", r => r.des || ""], ["u", "U", r => r.u || "", "center"], ["q", "QTÉ", r => r.q === "" || r.q === undefined ? "" : achN(r.q), "number"]],
    F: [["nom", "FOURNISSEURS", r => r.nom || ""]], D: [["title", "DOCUMENTS", r => (r.title || r.ref || "")]], K: [["lab", "CONDITIONS", r => r.lab || ""], ["v", "VALEUR", r => r.v || ""]] };
  const NEW = { L: "CRÉER UN ARTICLE ICI…", F: "CRÉER UN FOURNISSEUR ICI…", D: "CRÉER UN DOCUMENT ICI…", K: "CRÉER UNE CONDITION ICI…" };
  const KIT = sviCfKit({ key: "cai", shell: d, refresh: () => draw() });
  const kOf = (g, r) => g === "L" ? r.id : g === "F" ? r.k : g === "D" ? r.k : r.id;
  const opt = (v, t, sel) => `<option value="${esc(v)}"${sel ? " selected" : ""}>${esc(t)}</option>`;
  /* 11/11 : cases au format des listes du budget — texte affiché ; 1er toucher = case choisie, 2e = saisie (sur plusieurs lignes), liste de choix = menu */
  const ED = { L: ["bsn", "des", "u", "q"], F: ["nom"], D: ["title"], K: ["lab", "v"] };
  const shown = (g, k, r) => { if (g === "L" && k === "bsn") { const b = BS.get(r.bsn); return b ? b.ref + " — " + b.des : ""; } if (g === "L" && k === "q") return r.q === "" || r.q === undefined ? "" : achF2(r.q);
    if (g === "K" && k === "v") return r.t === "date" ? achDFr(r.v || "") : r.v || ""; return String(r[k] ?? ""); };
  const cell = (g, c, r, i) => { const k = c[0], cl = c[3] || "", v = shown(g, k, r);
    const canEd = !ro && (ED[g] || []).includes(k) && !(g === "F" && r.id) && !(g === "D" && r.fk) && !(g === "K" && k === "lab" && r.k !== "autre");
    const sel = (g === "L" && k === "bsn") || (g === "K" && k === "v" && r.t === "on");
    if (g === "F" && r.id) return `<td><span class="ach-link" data-nvgo="frs|${esc(r.id)}">${esc(r.nom)}</span></td>`;
    if (g === "D" && r.fk) return `<td><span class="ach-link cafp-doc" data-fk="${esc(r.fk)}">${esc(r.title || r.ref || "")}</span></td>`;
    const nw = (g === "F" && !r.id) || (g === "D" && !r.fk) ? ' <i class="cai-new">(NOUVEAU)</i>' : "";
    return `<td class="${cl}${canEd ? " nv-ed" : ""}"${canEd ? ` data-ed="${k}" data-g="${g}" data-i="${i}"${sel ? ' data-edsel="1"' : ""}` : ""} title="${esc(v)}">${esc(v)}${nw}</td>`; };
  const list = g => { const t = "cai_" + g, C0 = COLS[g], CO = coOrder(t, C0.map(c => [c[0], c[1], c[2], c[3] || ""])), R0 = LST[g]().map((r, i) => ({ ...r, __i: i })); let R = KIT.cfApply(t, CO, R0);
    /* v1119 (L12, F2) : articles groupés sous leurs titres (même numérotation que la page : 1, 2, 2.1…) — l'ordre des groupes, sauf tri choisi à la loupe */
    const GT = {}; if (g === "L" && (C.grp || []).length && S.L.some(l => l.g)) { const N = achDetNum(S.L, C.grp), inR = new Set(R.map(r => r.__i)), pos = new Map(); let cur = null;
      N.forEach((o, k) => { if (o.title) { cur = o; return; } pos.set(o.i, k); if (cur && inR.has(o.i)) { GT[o.i] = cur; cur = null; } });
      if (!(KIT.CF[t] && KIT.CF[t].sort)) R = R.slice().sort((a, b2) => (pos.get(a.__i) ?? 1e9) - (pos.get(b2.__i) ?? 1e9)); }
    /* largeurs : partagées dans la largeur de la liste, sauf celles réglées à la main (bord tiré) */
    const CW = cwLoad(), PR = { bsn: 1, des: 1.6, u: .75, q: .85, nom: 1, title: 1, lab: 1.3, v: 1 };
    const sum = CO.reduce((x, c) => x + (CW[t + "." + c[0]] ? 0 : PR[c[0]] || 1), 0) || 1;
    const WD = CO.map(c => { const w = CW[t + "." + c[0]]; return w ? w + "px" : Math.floor((PR[c[0]] || 1) / sum * 82) + "%"; });
    const cg = `<colgroup><col data-k="_rd" style="width:30px">${CO.map((c, j) => `<col data-k="${c[0]}" data-wd="${WD[j]}" style="width:${WD[j]}">`).join("")}<col data-k="_cb" style="width:32px"></colgroup>`
      /* largeurs tenues (les moteurs de largeur des pages ne s'appliquent pas à cette fenêtre) */
      + `<style>.cai-card .cai-t[data-svcw="${t}"]{width:100%!important;min-width:0!important}.cai-card .cai-t[data-svcw="${t}"] col:nth-child(1){width:30px!important}.cai-card .cai-t[data-svcw="${t}"] col:nth-child(${CO.length + 2}){width:32px!important}</style>`;
        const [cg1, st1] = cg.split("<style>"); return `<div class="cai-ls" data-g="${g}"><style>${st1}<table class="bdg-d-table rec-table cai-t" id="caiT${g}" data-svcw="${t}" style="width:100%">${cg1}<thead><tr><th class="cai-rdh">${LKW.rdAll(g)}</th>${CO.map(c => KIT.cfHead(t, c[0], c[1] + (c[0] === { L: "des", F: "nom", D: "title", K: "lab" }[g] ? " " + svCnt(R.length, R0.length) : ""), c[3])).join("")}${sviListCbTh()}</tr></thead>
      <tbody>${R.map(r => `${GT[r.__i] ? `<tr class="ins-title cai-gt svlk-gt-${esc(GT[r.__i].title.id)}"><td></td><td colspan="${CO.length + 1}"><b>${esc(GT[r.__i].no + " " + GT[r.__i].lab)}</b></td></tr>` : ""}<tr data-g="${g}" data-i="${r.__i}" class="${r.imp ? "cai-imp " : ""}${g === "L" && r.g ? "svlk-g-" + esc(r.g) + " " : ""}${LKW.rowCls(rdSt(g, kOf(g, r)))}"><td class="center"><button type="button" class="nvp-rd${(st => st ? " rd-" + st : "")(rdSt(g, kOf(g, r)))}" data-rg="${g}" data-rk="${esc(kOf(g, r))}" aria-label="Liaison"></button></td>${CO.map(c => cell(g, c, r, r.__i)).join("")}<td class="center nvl-cbc"><input type="checkbox" class="nvl-cb" aria-label="Cocher"${(S.ck[g] || new Set()).has(r.__i) ? " checked" : ""}></td></tr>`).join("")}
      ${ro || EMPTY[g]() ? "" : `<tr class="rec-new" data-cai-new="${g}"><td colspan="${CO.length + 2}">${NEW[g]}</td></tr>`}</tbody></table></div>`; };
  S.ck = {};
  const draw = () => { S.drawT = Date.now(); if (d.isConnected) ckRead(); const ob = d.querySelector('.cafi-x[data-k="objet"]'); if (ob) C.objet = achU(ob.value);
    d.innerHTML = sviWinCard({ st: c0 ? achPcSt("caf", c0) : "instance", cls: "frs-card caf-card caf-info cai-card",   /* v1121 (L2) : seule la couleur change selon l'état */ close: "data-x", title: "DÉTAIL CONSULTATION",   /* 11/11 (validé, 10.2) : même fenêtre à la création, en instance et validée (référence dans la barre) */
      body: `<div class="frs-g cafi-g">${achCreeFld(c0)}<label class="frs-f frs-w"><span>OBJET</span><input class="ins-in cafi-x" data-k="objet" value="${esc(C.objet || "")}"${dis} autocomplete="off"></label></div>
        <div class="bdg-d-block cai-blk${S.max ? " cai-blk-max" : ""}"><div class="bdg-d-block-title blk-head"><span class="ttl">CONSULTATION</span>${ro ? "" : `<span class="svlk-win">${LKW.bar()}</span>`}<span class="blk-tools"><button type="button" class="blk-btn blk-max-btn cai-max${S.max ? " on" : ""}" aria-label="Agrandir / réduire"></button>${ro ? "" : `<button type="button" class="blk-more cai-more" aria-label="Actions">⋯</button>`}</span></div>
        <div class="cai-grid">${["L", "F", "D", "K"].map(list).join("")}</div></div>
`,
      foot: `<button type="button" class="svc-b" data-x>ANNULER</button>${ro ? "" : `<button type="button" class="svc-b svc-ok svc-neutral" data-ok>${c0 ? "ENREGISTRER" : "CRÉER"}</button>`}` }); fltW(); };
  /* v1130 (L6 – L8, exception 6.4) : cases cochées = filtre des autres listes de la fenêtre (articles, fournisseurs, documents, conditions) */
  const fltW = () => { const rows = [...d.querySelectorAll("tr[data-g][data-i]")].map(tr => { const b = tr.querySelector("[data-rg]"); return b ? { tr, g: b.dataset.rg, id: b.dataset.rk, ck: !!tr.querySelector(".nvl-cb:checked") } : null; }).filter(Boolean);
    sviLkDomFilter(LKW, rows, "tr.cai-gt");
    /* v1133 : état de la case d'en-tête de chaque liste = lignes affichées seulement */
    d.querySelectorAll(".cai-t").forEach(t => { const all = t.querySelector(".nvl-all"); if (!all) return; const C = [...t.querySelectorAll("tbody tr[data-i]:not(.svlk-hid) .nvl-cb")], n = C.filter(c => c.checked).length; all.checked = n > 0 && n === C.length; all.indeterminate = n > 0 && n < C.length; }); };
  d.addEventListener("change", e => { if (e.target.matches && e.target.matches(".nvl-cb, .nvl-all")) setTimeout(fltW, 0); });
  const sync = () => { d.querySelectorAll(".cai-x").forEach(i => { const g = i.dataset.g, k = i.dataset.k, o = (g === "L" ? S.L : S.K)[+i.dataset.i]; if (!o) return;
      if (g === "L" && k === "q") o.q = String(i.value).trim() === "" ? "" : achN(i.value); else if (g === "L" && k === "bsn") o.bsn = i.value || ""; else o[k] = k === "v" && i.type === "date" ? i.value : achU(i.value); });
    const ob = d.querySelector('.cafi-x[data-k="objet"]'); if (ob) C.objet = achU(ob.value); };
  /* suppression des lignes cochées (toutes les listes) : leurs liaisons partent avec elles ; un fournisseur qui a un devis est gardé */
  const ckRead = () => { S.ck = {}; d.querySelectorAll("tr[data-g] .nvl-cb:checked").forEach(x => { const tr = x.closest("tr"), A = S.ck[tr.dataset.g] = S.ck[tr.dataset.g] || new Set(); A.add(+tr.dataset.i); }); };
  const rmChecked = async () => { ckRead(); const n = Object.values(S.ck).reduce((a, x) => a + x.size, 0); if (!n) { svToast("COCHER D'ABORD LES LIGNES À SUPPRIMER (CASES À DROITE).", 3000); return; }
    const D0 = achDvf(), keepF = S.F.filter((f, i) => (S.ck.F || new Set()).has(i) && f.id && D0.some(v => v.caf === (c0 && c0.id) && v.frs === f.id && v.state !== "annule"));
    const lab = g => [...(S.ck[g] || [])].map(i => LST[g]()[i]).filter(Boolean).filter(r => !keepF.includes(r)).map(r => "- " + (r.des || r.nom || r.title || r.lab || ""));
    const all = ["L", "F", "D", "K"].flatMap(lab); if (!all.length) { svToast("GARDÉ(S) : FOURNISSEUR AVEC DEVIS.", 3000); return; }
    if (!(await sub(() => svConfirm({ title: "SUPPRIMER LES LIGNES COCHÉES", html: all.map(x => `<div>${esc(x)}</div>`).join("") + (keepF.length ? `<div style="margin-top:12px">GARDÉ(S) (DEVIS REÇU) : ${esc(keepF.map(f => f.nom).join(", "))}</div>` : ""), ok: "SUPPRIMER" })))) return;
    const gone = { L: new Set(), F: new Set(), D: new Set(), K: new Set() };
    ["L", "F", "D", "K"].forEach(g => [...(S.ck[g] || [])].forEach(i => { const r = LST[g]()[i]; if (r && !keepF.includes(r)) gone[g].add(kOf(g, r)); }));
    S.Dh = S.Dh.concat(S.D.filter(x => gone.D.has(x.k) && x.fk && x.__id).map(x => x.__id));
    S.L = S.L.filter(r => !gone.L.has(r.id)); S.F = S.F.filter(r => !gone.F.has(r.k)); S.D = S.D.filter(r => !gone.D.has(r.k)); S.K = S.K.filter(r => !gone.K.has(r.id));
    const G = { lf: ["L", "F"], ld: ["L", "D"], lc: ["L", "K"], fd: ["F", "D"], fc: ["F", "K"] };
    Object.keys(G).forEach(o => { const M = S.lk[o] || {}, [ga, gb] = G[o]; Object.keys(M).forEach(a => { if (gone[ga].has(a)) { delete M[a]; return; } M[a] = (M[a] || []).filter(b => !gone[gb].has(b)); }); });
    S.ck = {}; draw(); };   /* v1126 : une ligne choisie supprimée sort des choix (moteur commun, alive) */
  /* une seule fenêtre à la fois (#svConf) : une fenêtre ouverte depuis celle-ci la remplace le temps de la réponse, puis celle-ci revient telle quelle */
  const sub = async fn => { sync(); d.remove(); try { return await fn(); } finally { document.getElementById("svConf")?.remove(); document.body.appendChild(d); } };
  const subWin = open => sub(() => new Promise(ok => { open(); const t0 = Date.now(); const tm = setInterval(() => { if (Date.now() - t0 > 300 && !document.getElementById("svConf")) { clearInterval(tm); ok(); } }, 250); }));
  /* largeurs tenues : les colonnes reprennent leur part de la liste, sauf une largeur tirée à la main (gardée) */
  const hold = () => { if (d.querySelector(".col-rs.on")) return; const CW = cwLoad(); d.querySelectorAll(".cai-t col[data-wd]").forEach(c => { const t = c.closest("table").dataset.svcw; if (CW[t + "." + c.dataset.k]) { c.style.width = CW[t + "." + c.dataset.k] + "px"; return; } if (c.style.width !== c.dataset.wd) c.style.width = c.dataset.wd; }); };
  new MutationObserver(() => requestAnimationFrame(hold)).observe(d, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
  ["L", "F", "D", "K"].forEach(g => { (window.__sviNvEdMods = window.__sviNvEdMods || {})["cai_" + g] = async (v, tds) => { let lines = [""];
      if (v === "paste") { let t = ""; try { t = await navigator.clipboard.readText(); } catch (er) {} if (!t) t = window.__sviSelClip || ""; lines = String(t).split(/\r?\n/).map(z => z.split("\t")[0].trim()).filter(Boolean); if (!lines.length) return; }
      tds.forEach((td, n) => { const r = LST[td.dataset.g]()[+td.dataset.i], k = td.dataset.ed; if (!r || !k || td.dataset.edsel) return; const w = lines[Math.min(n, lines.length - 1)] || "";
        if (k === "q") r.q = w === "" ? "" : achN(w); else r[k] = achU(w); }); draw(); }; });
  draw(); sviWinShow(d);
  /* menu de suggestions (articles, fournisseurs) sous la case en saisie — menu de l'application, filtré au fil de la frappe */
  let SUG = null; const sugOff = () => { if (SUG) { SUG.remove(); SUG = null; } };
  const sugOn = (tip, items, pickFn) => { const paint = () => { if (!tip.isConnected) { sugOff(); return; } const q = achU(tip.textContent || "").trim(), L = items.filter(x => !q || achU(x.lab).includes(q)).slice(0, 12);
      if (!L.length) { sugOff(); return; } if (!SUG) { SUG = document.createElement("div"); SUG.id = "caiSug"; SUG.className = "svi-stf-menu cai-sug"; document.body.appendChild(SUG); }
      SUG.innerHTML = L.map((x, n) => `<button type="button" data-n="${n}"><b>${esc(x.lab)}</b>${x.sub ? `<span>${esc(x.sub)}</span>` : ""}</button>`).join(""); SUG.__L = L;
      /* v1115 : menu lisible — 8 lignes au plus (défilement), ouvert au-dessus de la case s'il n'y a pas la place dessous */
      const r = tip.getBoundingClientRect(); Object.assign(SUG.style, { left: Math.max(4, Math.min(r.left, innerWidth - 260)) + "px", minWidth: r.width + "px", top: "0px", bottom: "auto" });
      const h = SUG.getBoundingClientRect().height, below = innerHeight - r.bottom - 6; SUG.style.top = (h > below && r.top - 6 > below ? Math.max(4, r.top - 2 - h) : r.bottom + 2) + "px"; };
    const pk = x => { tip.textContent = x.lab; pickFn(x); };   /* v1115 : aucun menu au départ (liste vide) = plus d'erreur */
    paint(); if (SUG) SUG.__pick = pk; tip.addEventListener("input", () => requestAnimationFrame(() => { paint(); if (SUG) SUG.__pick = pk; }));
  };
  window.addEventListener("pointerdown", e => { const b = SUG && e.target.closest && e.target.closest("#caiSug [data-n]"); if (!b) return; e.preventDefault(); const x = SUG.__L[+b.dataset.n]; SUG.__pick(x); }, true);
  const editCell = td => { const g = td.dataset.g, k = td.dataset.ed, i = +td.dataset.i, r = LST[g]()[i]; if (!r) return;
    if (td.dataset.edsel) { const O = g === "L" ? [{ k: "", lab: "—" }].concat(BSN.map(b => ({ k: b.id, lab: b.ref + " — " + b.des + " (" + achF2(b.q) + " " + b.u + ")" }))) : ["", "OUI", "NON"].map(v => ({ k: v, lab: v || "—" }));
      sviEtatMenu(td, O, String(g === "L" ? r.bsn || "" : r.v || ""), nv => { if (g === "L") { r.bsn = nv; const b = BS.get(nv); if (b) { r.des = b.des; r.u = b.u; r.q = achN(b.q); } } else r.v = nv; draw(); }); return; }
    const v0 = g === "K" && k === "v" && r.t === "date" ? achDFr(r.v || "") : g === "L" && k === "q" ? (r.q === "" || r.q === undefined ? "" : String(r.q).replace(".", ",")) : String(r[k] ?? "");
    let pick = null;
    const tip = window.sviTaEdit(td, v0, (ok, v) => { sugOff(); const dropL = () => { S.L = S.L.filter(x => x !== r); Object.values(S.lk).forEach(M => { delete M[r.id]; }); };   /* ligne d'article vide retirée */
      if (!ok) { if (g === "L" && !r.des && !r.bsn) dropL(); if (g === "F" && !r.nom) S.F = S.F.filter(x => x !== r); if (g === "K" && !r.lab) S.K = S.K.filter(x => x !== r); draw(); return; }
      if (g === "L" && k === "q") r.q = String(v).trim() === "" ? "" : achN(v);
      else if (g === "K" && k === "v" && r.t === "date") r.v = (typeof cfDate === "function" && cfDate(v)) || v;
      else if (g === "F") { const nom = achU(v); if (!nom) { if (!r.nom) S.F = S.F.filter(x => x !== r); draw(); return; } const f = FRS.find(x => achU(x.nom) === nom);
        if (S.F.some(x => x !== r && ((f && x.id === f.id) || achU(x.nom) === nom))) { svToast("DÉJÀ DANS LA CONSULTATION.", 2500); if (!r.nom) S.F = S.F.filter(x => x !== r); draw(); return; }
        r.nom = f ? f.nom : nom; if (f) { const old = r.k; r.id = f.id; r.k = f.id; Object.values(S.lk).forEach(M => { if (M[old]) { M[f.id] = M[old]; delete M[old]; } Object.keys(M).forEach(a => { M[a] = (M[a] || []).map(b => b === old ? f.id : b); }); }); LKW.rename("F", old, f.id); } }
      else if (g === "L" && k === "des" && achU(v) && S.L.some(x => x !== r && achU(x.des) === achU(v))) { svToast("ARTICLE DÉJÀ DANS LA CONSULTATION.", 2500); if (!r.des && !r.bsn) dropL(); draw(); return; }   /* v1115 : pas d'article en double */
      else if (g === "L" && k === "des" && !achU(v) && !r.bsn) { dropL(); draw(); return; }
      else if (g === "K" && k === "lab" && r.k === "autre" && !achU(v)) { S.K = S.K.filter(x => x !== r); draw(); return; }   /* v1116 : condition laissée vide retirée, CRÉER revient */
      else { r[k] = achU(v); if (g === "L" && k === "des") { const a = (pick && achU(pick.lab) === achU(v)) ? pick.a : ARTS.find(y => achU(y.des) === achU(v)); if (a && (!r.u || pick)) r.u = a.u || r.u; } }
      if (g === "K" && k === "lab" && r.lab) { const P = achPrm(), Lp = achClP(P); if (!Lp.some(y => achU(y.txt) === r.lab)) { P.clP = Lp.concat([{ id: "p" + Date.now().toString(36), t: "autre", txt: r.lab }]); achPrmSave(P); } }
      draw(); });
    if (tip && g === "L" && k === "des") sugOn(tip, ARTS.filter(a => !S.L.some(x => x !== r && achU(x.des) === achU(a.des))).map(a => ({ lab: a.des, sub: a.u || "", a })), x => { pick = x; });
    /* v1121 (L16) : le catalogue des CONDITIONS PARTICULIÈRES (PARAMÉTRAGE › ACHATS › CONSULTATIONS) alimente le menu de la condition */
    if (tip && g === "K" && k === "lab") { const have = new Set(S.K.filter(y => y !== r).map(y => achU(y.lab))); sugOn(tip, achClP(achPrm()).map(c => achU(c.txt) || ((ACH_CLT.find(t => t[0] === c.t) || [])[1] || "")).filter(l => l && !have.has(l)).filter((l, i, A) => A.indexOf(l) === i).map(l => ({ lab: l })), () => {}); }
    if (tip && g === "F") sugOn(tip, FRS.filter(f => !S.F.some(x => x.id === f.id)).map(f => ({ lab: f.nom, sub: f.ville || "" })), () => {}); };
  const pickCell = td => { d.querySelectorAll("td.nv-sel").forEach(x => x.classList.remove("nv-sel")); td.classList.add("nv-sel"); if (!td.hasAttribute("tabindex")) td.setAttribute("tabindex", "-1"); td.classList.add("svi-tdf"); try { td.focus({ preventScroll: true }); } catch (er) {} };
  /* glisser un titre de colonne = ordre des colonnes de cette liste (gardé) */
  d.addEventListener("pointerdown", e => { const th = e.target.closest && e.target.closest(".cai-t thead th"); if (!th || e.target.closest(".cf-btn, .col-rs, input") || !th.querySelector(".cf-btn")) return;
    const table = th.closest("table"), t = th.querySelector(".cf-btn").dataset.cf, ths = () => [...table.querySelectorAll("thead tr:first-child > th")].filter(x => x.querySelector(".cf-btn"));
    const x0 = e.clientX; let on = false, target = null, ghost = null; const arm = sviColArm(e, th); const clear = () => ths().forEach(x => x.classList.remove("co-before", "co-after"));
    const mv = ev => { if (!on) { if (Math.abs(ev.clientX - x0) < 8) return; if (!arm(ev)) return; on = true; th.classList.add("co-src"); ghost = document.createElement("div"); ghost.id = "coGhost"; ghost.textContent = (th.querySelector(".cf-lt")?.textContent || "").trim(); document.body.appendChild(ghost); }
      ev.preventDefault(); ghost.style.left = ev.clientX + 8 + "px"; ghost.style.top = ev.clientY - 28 + "px"; clear(); target = null;
      const L = ths(); for (const x of L) { const r = x.getBoundingClientRect(); if (ev.clientX >= r.left && ev.clientX < r.right) { if (x !== th) { x.classList.add(L.indexOf(x) > L.indexOf(th) ? "co-after" : "co-before"); target = x; } break; } } };
    const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up); clear(); th.classList.remove("co-src"); ghost && ghost.remove();
      if (!on || !target) return; sync(); const kf = x => x.querySelector(".cf-btn").dataset.col, keys = ths().map(kf), from = keys.indexOf(kf(th)), to = keys.indexOf(kf(target)); const [k] = keys.splice(from, 1); keys.splice(to, 0, k);
      const all = coLoad(); all[t] = keys; coSave(all); d.addEventListener("click", ev => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true }); draw(); };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up); });
  d.addEventListener("click", async e => {
    if (e.target === d && Date.now() - (S.drawT || 0) < 600) return;   /* v1122 : clic d'un double toucher reporté sur le fond après un redessin (AGRANDIR / RÉDUIRE) — la fenêtre ne se ferme pas */
    if (e.target === d || e.target.closest("[data-x]")) { KIT.cfClose(); d.remove(); if (done) done(); return; }
    const cfb = e.target.closest(".cf-btn[data-cf]"); if (cfb) { e.stopPropagation(); sync(); KIT.cfOpenMenu(cfb); return; }
    if (e.target.closest(".cafp-doc")) { achCopyOpen(e.target.closest(".cafp-doc").dataset.fk); return; }
    /* v1115 (Ahmed) : consultation close — toucher un rond le choisit pour VOIR ses liaisons (rien n'est lié ni délié) */
    /* v1119 (L4, règle 4.2) : AGRANDIR / RÉDUIRE du bloc CONSULTATION (⋯ ou double toucher sur sa barre de titre) */
    if (e.target.closest(".cai-max")) { sync(); S.max = !S.max; draw(); return; }
    /* v1132 (L6 – L8) : rond d'en-tête de chaque liste = tout choisir / tout libérer (lignes affichées) */
    { const ra = e.target.closest("[data-rdall]"); if (ra) { const g = ra.dataset.rdall; sync();
      if (LKW.hand(g)) { svToast("UNE LIGNE DE CETTE LISTE EST DÉJÀ CHOISIE À LA MAIN — LA LIBÉRER D'ABORD.", 3000, ra); return; }
      LKW.setAll(g, [...d.querySelectorAll(`tr[data-g="${g}"]:not(.svlk-hid) [data-rg]`)].map(b => b.dataset.rk), !LKW.allOn(g)); draw(); return; } }
    if (ro) { const rr = e.target.closest("[data-rg]"); if (rr) { LKW.toggle(rr.dataset.rg, rr.dataset.rk); draw(); return; }
      if (e.target.closest("[data-ok]")) { d.remove(); if (done) done(); } return; }
    const ed = e.target.closest("td.nv-ed"); if (ed && d.contains(ed)) { if (ed.classList.contains("nv-sel")) editCell(ed); else pickCell(ed); return; }
    /* v1126 (L6 – L8) : le rond choisit ou libère (plusieurs lignes par liste) ; ✓ LIER / ✕ DÉLIER en haut à droite du bloc */
    const rd = e.target.closest("[data-rg]"); if (rd) { sync(); LKW.toggle(rd.dataset.rg, rd.dataset.rk); draw(); return; }
    const lb = e.target.closest("[data-svlk]"); if (lb) { sync(); await LKW.apply(lb.dataset.svlk, (L, on) => sviLkWrite(S.lk, L, on), ask => sub(ask)); draw(); return; }
    const mo = e.target.closest(".cai-more"); if (mo) { e.stopPropagation(); sync();
      sviHdrMenu(mo, [[{ k: "max", lab: S.max ? "RÉDUIRE" : "AGRANDIR" }], [{ k: "imp", lab: "IMPORTER DES ARTICLES" }], [{ k: "__fmt", lab: "MODIFIER LE FORMAT" }], [{ k: "rm", lab: "SUPPRIMER LES COCHÉS", del: true }]], async a => {
        if (a === "max") { S.max = !S.max; draw(); return; }
        if (a === "__fmt") { await subWin(() => sviFmtCurWin()); draw(); return; } if (a === "rm") { rmChecked(); return; }
        if (a === "imp") { const R = await sub(() => achCafImpRead(S.D.filter(x => x.fk), c0 && c0.id)); if (!R) return; let g = null; const G = C.grp = C.grp || [];
          R.rows.forEach(r => { if (r.title) { g = { id: achCafId(), lab: achU(r.title) }; G.push(g); return; } const ar = achArtOf(r.des, r.u), lid = achCafId(); S.L.push({ id: lid, bsn: "", des: ar ? ar.des : achU(r.des), u: ar ? ar.u : achU(r.u), q: r.q, imp: true, ...(g ? { g: g.id } : {}) }); S.lk.lf[lid] = S.F.map(f => f.k); });
          if (R.file) { const k = "n" + Date.now().toString(36); S.D.push({ k, title: "IMPORT — " + R.file.name, f: R.file }); } const n = R.rows.filter(r => !r.title).length;
          svToast(n ? n + " ARTICLE(S) IMPORTÉ(S) : À VÉRIFIER DANS LA PAGE (EN ROUGE) PUIS CONFIRMER." : "AUCUNE LIGNE RECONNUE DANS « " + R.from + " ».", 4000); draw(); } }); return; }
    const nw = e.target.closest("[data-cai-new]"); if (nw) { sync(); const g = nw.dataset.caiNew;
      const go = (gg, kk) => { const td = d.querySelector(`#caiT${gg} td.nv-ed[data-i="${LST[gg]().length - 1}"][data-ed="${kk}"]`); if (td) { pickCell(td); editCell(td); } };
      if (g === "L") { const lid = achCafId(); S.L.push({ id: lid, bsn: "", des: "", u: "", q: "" }); S.lk.lf[lid] = S.F.map(f => f.k); draw(); go("L", "des"); return; }
      if (g === "F") { const k = "n:" + Date.now().toString(36); S.F.push({ k, id: "", nom: "" }); S.L.forEach(l => { const A = S.lk.lf[l.id] = S.lk.lf[l.id] || []; if (!A.includes(k)) A.push(k); }); draw(); go("F", "nom"); return; }
      if (g === "D") { const f = await new Promise(ok => { const i = document.createElement("input"); i.type = "file"; i.onchange = () => ok(i.files[0] || null); i.click(); }); if (!f) return;
        S.D.push({ k: "n" + Date.now().toString(36), title: achU(f.name.replace(/\.[^.]+$/, "")), f }); draw(); go("D", "title"); return; }
      if (g === "K") { S.K.push({ id: achCafId(), k: "autre", lab: "", t: "text", v: "" }); draw(); go("K", "lab"); return; }
      return; }
    if (!e.target.closest("[data-ok]")) return;
    sync(); const now = achNow(), Lc = achCaf(); KIT.cfClose();
    let c = c0 ? Lc.find(x => x.id === id) : null;
    if (!c) { c = { id: "C" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ref: achNextRef("CAF", Lc), objet: C.objet, date: now.slice(0, 10), dlim: "", lignes: [], frs: [], rep: {}, state: "ouverte", cree: now }; achCafUp(c); Lc.push(c); }
    const ref = c.ref, AL = achArts(); let na = 0;
    S.L.filter(l => achU(l.des)).forEach(l => { if (!achArtOf(l.des, l.u)) { const a = achArtNew(AL, { des: l.des, u: l.u, src: "CONSULTATION " + ref }); a.st = "instance"; a.fromCaf = ref; achHist(a.code, "CRÉATION", "CRÉÉ DEPUIS LA CONSULTATION " + ref); na++; } }); if (na) achArtsSave(AL);
    S.F = S.F.filter(f => f.id || achU(f.nom)); S.K = S.K.filter(x => achU(x.lab)); const FL = achFrs(), KM = {}; let nf = 0; S.F.forEach(f => { if (f.id) { KM[f.k] = f.id; return; } const n = achFrsNew(FL, { nom: f.nom, occ: true }); n.st = "instance"; n.fromCaf = ref; f.id = n.id; KM[f.k] = n.id; achHist(n.code, "CRÉATION", "CRÉÉ DEPUIS LA CONSULTATION " + ref); nf++; }); if (nf) achFrsSave(FL);
    const DM = {}; S.D.forEach(x => { if (x.__id) DM[x.k] = x.__id; }); for (const x of S.D.filter(y => y.f)) { try { const dx = await achCafDocAdd(ref, x.f, x.title); DM[x.k] = dx.ref; } catch (er) {} }
    const LIDS = new Set(S.L.filter(l => achU(l.des)).map(l => l.id)), KIDS = new Set(S.K.map(x => x.id)), mapK = { L: k => LIDS.has(k) ? k : null, F: k => KM[k] || null, D: k => DM[k] || null, K: k => KIDS.has(k) ? k : null };
    const G = { lf: ["L", "F"], ld: ["L", "D"], lc: ["L", "K"], fd: ["F", "D"], fc: ["F", "K"] };
    Object.keys(G).forEach(o => { const [ga, gb] = G[o], M = {}; Object.keys(S.lk[o] || {}).forEach(a => { const A = mapK[ga](a); if (!A) return; const B = (S.lk[o][a] || []).map(mapK[gb]).filter(Boolean); if (B.length) M[A] = [...new Set(B)]; }); c[o] = M; });
    const oldF = c.frs || [], newF = S.F.map(f => f.id); oldF.filter(f => !newF.includes(f)).forEach(f => { delete (c.rep || {})[f]; });
    c.objet = C.objet; c.frs = newF; const old = new Map((c.lignes || []).map(l => [l.id, l]));
    c.lignes = S.L.filter(l => achU(l.des)).map(l => { const o = old.get(l.id) || {}, a = achArtOf(l.des, l.u); return { ...o, id: l.id, bsn: l.bsn || "", des: a ? a.des : achU(l.des), u: a ? a.u : achU(l.u), q: l.q === "" ? "" : achN(l.q), ...(l.imp ? { imp: true } : {}), ...(l.g ? { g: l.g } : {}) }; });
    c.lignes.forEach(l => { if (!Array.isArray(c.lf[l.id])) c.lf[l.id] = []; });
    c.grp = (C.grp || c.grp || []).filter(g => c.lignes.some(l => l.g === g.id)); c.cond = S.K;
    c.dhide = [...new Set((c.dhide || []).concat(S.Dh))]; c.mod = now; achCafUp(c); achCafSave(Lc); achHist(ref, c0 ? "MODIFICATION" : "CRÉATION", c.objet);
    if (na || nf) svToast((na ? na + " ARTICLE(S)" : "") + (na && nf ? " ET " : "") + (nf ? nf + " FOURNISSEUR(S)" : "") + " CRÉÉ(S) EN INSTANCE (DEPUIS LA CONSULTATION).", 3500);
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
    <button type="button" class="svc-b" data-s="caf">UNE AUTRE CONSULTATION DE L'APPLICATION</button>
    ${D.length ? `<div class="frs-st">UN DOCUMENT DE LA CONSULTATION</div>` + D.map((x, i) => `<button type="button" class="svc-b" data-s="d${i}">${esc((x.ref || "") + " — " + (x.title || x.fname || ""))}</button>`).join("") : ""}
</div>`,   /* 10.5 : pas de bandeau ; le message après l'import dit que les lignes sont à vérifier */
    foot: `<button type="button" class="svc-b" data-x>ANNULER</button>` });
  sviWinShow(d);
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) { d.remove(); ok(null); return; }
    const b = e.target.closest("[data-s]"); if (!b) return; const s = b.dataset.s; d.remove(); ok(s[0] === "d" ? { doc: D[+s.slice(1)] } : { s }); }); });
/* 11/11 (Ahmed, validé, 10.2) : LECTURE D'UN IMPORT, sans rien enregistrer — { rows, from, file } ; source en plus : UNE AUTRE CONSULTATION de l'application
   (on coche ses articles à reprendre ; titres de groupes repris ; les besoins liés ne sont pas repris) */
async function achCafImpRead(DOCS, selfId) { const src = await achImpSrcWin(DOCS || []); if (!src) return null;
  let rows = null, from = "", file = null;
  try {
    if (src.doc) { const f = await sviFiles.get(src.doc.fk); if (!f) { svToast("FICHIER DU DOCUMENT INTROUVABLE SUR CET APPAREIL.", 3500); return null; } rows = await achImpBlob(f.name ? f : new File([f], src.doc.fname || "doc", { type: f.type })); from = src.doc.ref || "DOCUMENT"; }
    else if (src.s === "caf") { const C = achCaf().filter(c => c.id !== selfId && (c.lignes || []).length); if (!C.length) { svToast("AUCUNE AUTRE CONSULTATION AVEC DES ARTICLES.", 3000); return null; }
      const pk = await achPickWin("REPRENDRE LES ARTICLES D'UNE CONSULTATION", C.map(c => ({ v: c.id, lab: c.ref + " — " + (c.objet || "") + " (" + c.lignes.length + " ARTICLE(S))" }))); if (!pk.length) return null;
      const c = C.find(y => y.id === pk[0]), G = new Map((c.grp || []).map(g => [g.id, g.lab || ""]));
      const L = await achPickWin("ARTICLES À REPRENDRE — " + c.ref, c.lignes.map((l, i) => ({ v: String(i), lab: (l.des || "") + " — " + achF2(l.q) + " " + (l.u || ""), on: true }))); if (!L.length) return null;
      rows = []; let g0 = null; c.lignes.forEach((l, i) => { if (!L.includes(String(i))) return; const gl = l.g ? G.get(l.g) || "" : ""; if (gl && gl !== g0) { rows.push({ title: gl }); g0 = gl; } rows.push({ des: l.des, u: l.u, q: achN(l.q), pu: "" }); }); from = c.ref; }
    else if (src.s === "gs") { const url = await achAsk("IMPORTER UN LIEN GOOGLE SHEETS", "LIEN DE LA FEUILLE (PARTAGÉE EN LECTURE)"); if (!url) return null;
      const id = (url.match(/\/d\/([a-zA-Z0-9_-]+)/) || [])[1], gid = (url.match(/[#&?]gid=(\d+)/) || [])[1] || "0"; if (!id) { svToast("LIEN GOOGLE SHEETS NON RECONNU.", 3000); return null; }
      const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`); if (!r.ok) throw new Error("ACCÈS REFUSÉ (FEUILLE NON PARTAGÉE ?)");
      const X = await loadXLSX(), wb = X.read(await r.text(), { type: "string", raw: true }); rows = achImpRows(X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false })); from = "GOOGLE SHEETS"; }
    else { const f = await new Promise(ok => { const i = document.createElement("input"); i.type = "file"; i.accept = ".xlsx,.xls,.csv,.pdf"; i.onchange = () => ok(i.files[0] || null); i.click(); }); if (!f) return null;
      rows = await achImpBlob(f); from = f.name; file = f; }
  } catch (err) { svToast("IMPORT IMPOSSIBLE : " + String(err && err.message || err).toUpperCase(), 4500); return null; }
  return { rows: rows || [], from, file }; }
/* un fichier venu de l'extérieur rejoint les DOCUMENTS de la consultation (SUIVI) */
async function achCafDocAdd(code, f, title) { const L = achJ("svi_docs_v1:ACH-" + code, []) || [], k = "ach:doc:" + code + ":" + Date.now().toString(36) + Math.random().toString(36).slice(2, 4); try { await sviFiles.put(k, f); } catch (e) {}
  const dx = { ref: "ACH DOC " + code + "/" + String(L.length + 1).padStart(3, "0"), date: new Date().toISOString(), title: title || f.name, fk: k, fname: f.name }; L.push(dx); achW("svi_docs_v1:ACH-" + code, L); achHist(code, "DOCUMENT", dx.title); return dx; }
async function achCafImport(x, redraw) { const code = x.ref || x.code, DOCS = achJ("svi_docs_v1:ACH-" + code, []) || [], R = await achCafImpRead(DOCS, x.id); if (!R) return;
  const { rows, from, file } = R; if (file) await achCafDocAdd(code, file, "IMPORT — " + file.name);
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
