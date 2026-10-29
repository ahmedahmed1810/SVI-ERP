/* =========================================================
   v681 : AVENANTS (décisions du 29/10/2026)
   - Un avenant est un MINI-BUDGET complet : même structure, mêmes écrans, ses scénarios, son cycle EN INSTANCE → FIGÉ → VALIDÉ.
     Il est rangé dans la liste des budgets de l'appareil avec { parent: réf. du marché initial, avn: n } ; réf. = « réf.-AVn ».
   - Le premier avenant s'ajoute par le menu ⋯ du budget, seulement si le marché initial est VALIDÉ ; le suivant par le + de la
     liste intermédiaire, seulement si le dernier est validé (exception administrateur : avec les droits, plus tard).
   - GLOBAL : budget consolidé (marché initial + avenants), en lecture : mêmes désignations / charges (intitulé + unité) cumulées
     au PRIX MOYEN PONDÉRÉ, mêmes lots et activités regroupés, même tâche sur une seule ligne du planning (périodes de chaque étape).
   - Contradiction : dans un avenant, même désignation (intitulé + unité) dans le même lot qu'une étape précédente, mais
     activité primaire ou secondaire différente (lot différent = activités libres).
   ========================================================= */
const sviAvU = v => String(v ?? "").trim().toUpperCase();
/* étapes d'un budget : marché initial puis avenants (ordre) */
const sviAvStages = ref => {
  const L = sviInstGet(), it = L.find(x => x.ref === ref);
  if (!it) return [];
  const root = it.parent ? L.find(x => x.ref === it.parent) : it;
  if (!root) return [it];
  return [root, ...L.filter(x => x.parent === root.ref).sort((a, b) => (a.avn || 0) - (b.avn || 0))];
};
const sviAvName = it => it && it.vname ? it.vname : it && it.parent ? "AVENANT " + (it.avn || 1) : "BUDGET INITIAL";   /* v691 : « marché » disparaît (phase budget) */
/* v687 : COMPOSITION du consolidé — pour chaque étape : "act" (l'étape telle qu'elle est), l'id d'un de ses scénarios,
   ou rien (étape non comptée). Par défaut : les étapes VALIDÉES (le marché initial s'il n'y en a aucune). Mémoire de la session. */
const sviAvSelDef = S0 => { const o = {}, all = S0[0] && (window.__sviAvMode || {})[S0[0].ref] === "inst"; S0.forEach(st => { if (all || st.state === "valide") o[st.ref] = "act"; }); if (!Object.keys(o).length && S0[0]) o[S0[0].ref] = "act"; return o; };
const sviAvSelGet = r => ((window.__sviAvSel || {})[r]) || null;
const sviAvSelSet = (r, v) => { window.__sviAvSel = window.__sviAvSel || {}; if (v) window.__sviAvSel[r] = v; else delete window.__sviAvSel[r]; };
/* v693 : RECALAGES d'une étape (budgets « étape-Rn » de l'appareil), du plus ancien au plus récent ; dernier enregistré */
const sviRclOf = stRef => sviInstGet().filter(x => x.rclOf === stRef).sort((a, b) => (a.rcn || 0) - (b.rcn || 0));
const sviRclLast = stRef => sviRclOf(stRef).filter(x => x.state === "valide").pop() || null;
/* point d'accroche de la réalisation : ligne déjà utilisée (verrouillée dans un recalage) — toujours faux pour l'instant */
const sviRclUsed = row => !!(row && row.used && false);
/* scénarios d'une étape qu'on peut prendre à sa place (ceux qui ne sont pas l'état actuel) */
const sviAvScn = st => { const V = (st.data || {}).ver || {}; return (V.L || []).filter(x => x.kind === "sc" && x.id !== V.act && x.d); };
/* libellé court de la composition */
const sviAvSelLab = (rootRef, sel) => { const S0 = sviAvStages(rootRef), o = sel || sviAvSelDef(S0);
  return S0.filter(st => o[st.ref]).map(st => { const c = o[st.ref], r = c === "act" && st.state === "valide" ? sviRclLast(st.ref) : null;
    return sviAvName(st) + (c === "val" ? " (VALIDÉE)" : c !== "act" ? " (" + ((sviAvScn(st).find(x => x.id === c) || {}).nom || "?") + ")" : r ? " (R" + r.rcn + ")" : ""); }).join(" + ") || "AUCUNE ÉTAPE"; };
/* budget consolidé — opt : true = toutes les étapes ; objet = composition ; rien = composition par défaut (validées) */
const sviAvMerge = (rootRef, opt) => {
  const S0 = sviAvStages(rootRef);
  if (!S0.length) return null;
  const sel = opt === true ? Object.fromEntries(S0.map(st => [st.ref, "act"])) : opt && typeof opt === "object" ? opt : sviAvSelDef(S0);
  /* v693 : « act » = budget de travail de l'étape (dernier recalage enregistré, sinon l'étape validée) ; « val » = étape validée d'origine */
  const S = S0.map(st => { const c = sel[st.ref]; if (!c) return null;
    if (c === "act") { const r = st.state === "valide" ? sviRclLast(st.ref) : null; return r ? { st, d: r.data || {}, sc: "R" + r.rcn } : { st, d: st.data || {} }; }
    if (c === "val") return { st, d: st.data || {}, sc: "VALIDÉE" };
    const sc = sviAvScn(st).find(x => x.id === c); return sc ? { st, d: sc.d, sc: sc.nom } : { st, d: st.data || {} }; }).filter(Boolean);
  if (!S.length) S.push({ st: S0[0], d: { lot: [], des: [] }, none: true });
  const D0 = JSON.parse(JSON.stringify(S[0].d || {}));
  const M = { ...D0, des: [], lot: [], prim: [], sec: [], chg: [], prd: [], qlt: D0.qlt || [], links: [], dlp: {}, dlpSec: true };
  delete M.ver; delete M.vfz; delete M.dord; delete M.conf;
  const n = v => Number(String(v ?? "").replace(/\s/g, "").replace(",", ".")) || 0;
  const key = { des: r => r.t ? "T|" + sviAvU(r.art) + "|" + sviAvU(r.des) : sviAvU(r.des) + "|" + sviAvU(r.u), lot: r => sviAvU(r.v), prim: r => sviAvU(r.v), sec: r => sviAvU(r.v), chg: r => r.t ? "T|" + sviAvU(r.des) : sviAvU(r.des) + "|" + sviAvU(r.u) };
  S.forEach((x0, si) => {
    if (x0.none) return;
    const st = x0.st, d = x0.d || {}, nm = sviAvName(st) + (x0.sc ? " (" + x0.sc + ")" : ""), map = {};
    ["des", "lot", "prim", "sec", "chg"].forEach(k => (d[k] || []).forEach(r => {
      const kk = key[k](r);
      let m = M[k].find(x => x.__k === kk);
      if (!m) { m = { ...r, id: k + si + "_" + r.id, __k: kk, __o: [nm] }; if (k === "des" || k === "chg") m.__det = []; M[k].push(m); }
      else if (!m.__o.includes(nm)) m.__o.push(nm);
      map[k + r.id] = m.id;
      if ((k === "des" || k === "chg") && !r.t) m.__det.push({ o: nm, q: k === "des" ? (insLinkedQ(d, r.id) ?? n(r.q)) : n(r.q), p: n(r.p) });
    }));
    (d.prd || []).forEach(r => { const x = { ...r, id: "p" + si + "_" + r.id, __o: [nm] }; M.prd.push(x); map["prd" + r.id] = x.id; });
    (d.links || []).forEach(l => {
      const des = map["des" + l.des], lot = map["lot" + l.lot], prim = map["prim" + l.prim], sec = map["sec" + l.sec];
      if (!des || !lot || !prim || !sec) return;
      let L2 = M.links.find(x => x.des === des && x.lot === lot && x.prim === prim && x.sec === sec);
      if (!L2) { L2 = { id: "k" + si + "_" + l.id, des, lot, prim, sec, prd: [], chg: [] }; M.links.push(L2); }
      (l.prd || []).forEach(x => { const id = map["prd" + x.id]; if (id) L2.prd.push({ ...x, id }); });
      (l.chg || []).forEach(x => { const id = map["chg" + x.id]; if (id && !L2.chg.some(y => y.id === id)) L2.chg.push({ ...x, id }); });
    });
    /* délais : par tâche secondaire (lot + activité secondaire) — même tâche = mêmes lignes, périodes de chaque étape */
    const dd = d.dlpSec ? d : (() => { const c = { links: d.links, dlp: JSON.parse(JSON.stringify(d.dlp || {})) }; sviDlpSec(c); return c; })();
    Object.keys(dd.dlp || {}).forEach(k => {
      const [lo, se] = k.split("|"), a = map["lot" + lo], b = map["sec" + se];
      if (!a || !b) return;
      const kk = a + "|" + b;
      (M.dlp[kk] = M.dlp[kk] || []).push(...(dd.dlp[k] || []).map(p => ({ ...p, id: (p.id || "p") + "_" + si })));
    });
  });
  /* prix moyen pondéré : total des montants ÷ total des quantités */
  ["des", "chg"].forEach(k => M[k].forEach(r => {
    if (r.t || !r.__det || r.__det.length < 2) return;
    const q = r.__det.reduce((t, x) => t + x.q, 0), m = r.__det.reduce((t, x) => t + x.q * x.p, 0);
    if (k === "chg") r.q = q;
    else if (!(M.links || []).some(l => l.des === r.id)) r.q = q;
    if (q) r.p = Math.round(m / q * 1e6) / 1e6;
    r.pmp = r.__det.some(x => Math.abs(x.p - r.__det[0].p) > 1e-9);
  }));
  return M;
};
/* contradictions d'un avenant : même désignation et même lot qu'une étape précédente, activités différentes */
const sviAvContra = ref => {
  const S = sviAvStages(ref), i = S.findIndex(x => x.ref === ref);
  if (i <= 0) return [];
  const nm = (d, k, id) => { const r = (d[k] || []).find(x => x.id === id); return r ? sviAvU(k === "des" ? r.des : r.v) : ""; };
  const unit = (d, id) => sviAvU(((d.des || []).find(x => x.id === id) || {}).u);
  const before = new Map();
  S.slice(0, i).forEach(st => { const d = st.data || {}; (d.links || []).forEach(l => {
    const k = nm(d, "des", l.des) + "|" + unit(d, l.des) + "|" + nm(d, "lot", l.lot);
    if (!before.has(k)) before.set(k, { prim: nm(d, "prim", l.prim), sec: nm(d, "sec", l.sec), st: sviAvName(st) });
  }); });
  const d = S[i].data || {}, out = [], seen = new Set();
  (d.links || []).forEach(l => {
    const des = nm(d, "des", l.des), lot = nm(d, "lot", l.lot), k = des + "|" + unit(d, l.des) + "|" + lot, b = before.get(k);
    if (!b) return;
    const prim = nm(d, "prim", l.prim), sec = nm(d, "sec", l.sec);
    if (b.prim === prim && b.sec === sec) return;
    const id = k + "|" + prim + "|" + sec; if (seen.has(id)) return; seen.add(id);
    out.push({ des, lot, att: b.prim + " › " + b.sec, got: prim + " › " + sec, st: b.st, link: l.id });
  });
  return out;
};

/* v695 : dates du consolidé (étapes comptées) — SAISI LE = dernière création, VALIDÉ LE = dernière validation */
const sviAvDates = root => {
  const S = sviAvStages(root), sel = sviAvSelGet(root) || sviAvSelDef(S), inc = S.filter(st => sel[st.ref]);
  const mx = a => a.filter(Boolean).sort().pop() || "";
  return { created: mx(inc.map(st => st.created)), validated: mx(inc.filter(st => st.state === "valide").map(st => st.validated)) };
};
/* jour d'une ligne de la liste mère (regroupement par date) : budget à avenants = SAISI LE du consolidé */
const sviRowDate = ref => {
  try { if (sviAvStages(ref).length > 1) { const c = sviAvDates(ref).created, m = String(c).match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return { key: m[1] + "-" + m[2] + "-" + m[3], label: m[3] + "/" + m[2] + "/" + m[1] }; } } catch (e) {}
  return budgetDate(ref);
};
