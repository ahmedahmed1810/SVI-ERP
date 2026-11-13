/* =========================================================
   v1126 (série L, L6 – L8, 1re livraison) : MOTEUR DE LIAISONS COMMUN — les règles du budget (document unique 2.5 et partie J),
   écrites une seule fois, sans écran ; la consultation (page et fenêtre DÉTAIL CONSULTATION) s'en sert ; le budget y passera plus tard.

   sviLk(clé, o) — o = {
     groups : { a: ["ARTICLE", "ARTICLES"], f: [...], … }   noms des groupes (confirmations),
     pairs  : { "a-f": "lf", … }   paires permises ; la carte data()[nom][gauche] = [droites],
     data   : () => objet qui porte les cartes (lu à chaque appel),
     alive  : (groupe, id) => la ligne existe encore (facultatif),
     hub    : groupe pivot (facultatif) — s'il a des lignes choisies, seules ses paires sont liées (ex. articles : un document ou une
              condition part chez un fournisseur par l'article ; liaison directe fournisseur – document seulement sans article choisi) }
   Choix : plusieurs lignes par groupe ; rond : 1er toucher = choisie, 2e = libérée.
   État d'une ligne : "choisi" (rond plein, coche) ; "exact" (liée à tout ce qui est choisi dans les groupes qu'elle peut lier : bleu foncé,
   rond à point) ; "lie" (liée à quelque chose : bleu clair) ; "" (non liée : blanc).
   Bouton en haut à droite : rien de choisi = pas de bouton ; une paire nouvelle = ✓ LIER (n) ; que des paires déjà liées = ✕ DÉLIER (n),
   avec confirmation ; aucune paire possible entre les choix = grisé.
   ========================================================= */
const SVI_LK = {};
function sviLk(key, o) {
  const E = SVI_LK[key] = SVI_LK[key] || { sel: {}, all: {} }; E.o = o; E.all = E.all || {};
  const S = g => (E.sel[g] = E.sel[g] || new Set());
  const pairOf = (g1, g2) => o.pairs[g1 + "-" + g2] ? { m: o.pairs[g1 + "-" + g2], rev: false } : o.pairs[g2 + "-" + g1] ? { m: o.pairs[g2 + "-" + g1], rev: true } : null;
  const M = m => ((o.data && o.data()) || {})[m] || {};
  const ok = (g, id) => !o.alive || o.alive(g, id);
  const has = (g1, id1, g2, id2) => { const p = pairOf(g1, g2); if (!p) return false; const [a, b] = p.rev ? [id2, id1] : [id1, id2]; return (M(p.m)[a] || []).includes(b); };
  const any = (g, id) => Object.entries(o.pairs).some(([gp, m]) => { const [l, r] = gp.split("-");
    if (l === g) return (M(m)[id] || []).some(y => ok(r, y));
    if (r === g) return Object.entries(M(m)).some(([a, L]) => (L || []).includes(id) && ok(l, a));
    return false; });
  const prune = () => Object.keys(E.sel).forEach(g => [...E.sel[g]].forEach(id => { if (!ok(g, id)) E.sel[g].delete(id); }));
  const chosen = () => { prune(); return Object.keys(E.sel).flatMap(g => [...E.sel[g]].map(id => [g, id])); };
  const pending = () => { const C = chosen(), hubOn = !!o.hub && C.some(([g]) => g === o.hub), P = [];
    for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) { const [g1, id1] = C[i], [g2, id2] = C[j];
      if (g1 === g2) continue; const p = pairOf(g1, g2); if (!p) continue; if (hubOn && g1 !== o.hub && g2 !== o.hub) continue;
      const [a, b] = p.rev ? [id2, id1] : [id1, id2]; P.push({ m: p.m, a, b, on: has(g1, id1, g2, id2) }); }
    return { add: P.filter(x => !x.on), del: P.filter(x => x.on), n: C.length }; };
  const nm = (g, n) => { const L = (o.groups || {})[g] || [g, g]; return n + " " + (n > 1 ? L[1] : L[0]); };
  const api = {
    isSel: (g, id) => S(g).has(id),
    toggle: (g, id) => { const s = S(g); if (s.has(id)) s.delete(id); else s.add(id); E.all[g] = false; },
    clear: () => { E.sel = {}; E.all = {}; },
    /* v1132 (L6 – L8, 3e livraison) : ROND D'EN-TÊTE = TOUT CHOISIR (les lignes affichées du bloc), retoucher = tout libérer ;
       grisé quand une ligne du bloc est déjà choisie à la main (comme le budget) ; toucher une ligne ensuite = choix à la main */
    allOn: g => !!E.all[g] && S(g).size > 0,
    hand: g => !E.all[g] && S(g).size > 0,
    setAll: (g, ids, on) => { E.sel[g] = new Set(on ? ids : []); E.all[g] = !!on && ids.length > 0; },
    rdAll: (g, title) => { const on = !!E.all[g] && S(g).size > 0, off = !E.all[g] && S(g).size > 0;
      return `<button type="button" class="nvp-rd nvp-rdall${on ? " rd-choisi" : ""}${off ? " rd-off" : ""}" data-rdall="${g}" aria-label="${title || "Tout choisir"}" title="${off ? "UNE LIGNE EST DÉJÀ CHOISIE À LA MAIN" : on ? "TOUT LIBÉRER" : "TOUT CHOISIR"}"></button>`; },
    rename: (g, a, b) => { const s = S(g); if (s.has(a)) { s.delete(a); s.add(b); } },
    chosen, pending,
    state: (g, id) => { if (S(g).has(id)) return "choisi";
      const O = chosen().filter(([g2]) => g2 !== g && pairOf(g, g2));
      if (O.length && O.every(([g2, id2]) => has(g, id, g2, id2))) return "exact";
      return any(g, id) ? "lie" : ""; },
    /* v1130 (L6 – L8, 2e livraison) : FILTRE PAR LES CASES COCHÉES — check = { groupe: Set(ids cochés) } ; une ligne d'un groupe reste visible
       si, pour chaque autre groupe qui a des cases cochées et qu'elle peut lier, elle est liée à au moins une ligne cochée : directement, ou par
       le pivot (ex. un document lié au fournisseur coché par un article) ; un groupe ne se filtre pas lui-même */
    filterFn: check => { const G = Object.keys(check || {}).filter(h => check[h] && check[h].size);
      const hubIds = () => [...new Set(Object.entries(o.pairs).filter(([gp]) => gp.split("-")[0] === o.hub).flatMap(([, m]) => Object.keys(M(m))))].filter(a => ok(o.hub, a));
      const reach = (g, id, h, hid) => has(g, id, h, hid) || (!!o.hub && g !== o.hub && h !== o.hub && hubIds().some(a => has(o.hub, a, g, id) && has(o.hub, a, h, hid)));
      return (g, id) => G.every(h => h === g || !pairOf(g, h) || [...check[h]].some(hid => reach(g, id, h, hid))); },
    /* classe de la ligne (couleurs du budget : lk-sel choisie, lk-hit liée à ce qui est choisi, lk-link liée) */
    rowCls: st => st === "choisi" ? "lk-sel" : st === "exact" ? "lk-hit" : st === "lie" ? "lk-link" : "",
    /* bouton LIER / DÉLIER (en haut à droite) */
    bar: () => { const P = pending(); if (!P.n) return "";
      if (P.add.length) return sviLkBtn({ k: "add", n: P.add.length });
      if (P.del.length) return sviLkBtn({ k: "del", n: P.del.length });
      return sviLkBtn({ k: "off", lab: "LIER", why: "RIEN À LIER NI À DÉLIER ENTRE LES LIGNES CHOISIES." }); },
    /* LIER ou DÉLIER ; write(liste [{ m, a, b }], on) fait l'écriture ; les choix sont libérés ensuite */
    apply: async (mode, write, confirmFn) => { const P = pending(), L = mode === "delier" ? P.del : P.add; if (!L.length) return false;
      if (mode === "delier") { const G = {}; chosen().forEach(([g]) => { G[g] = (G[g] || 0) + 1; });
        const det = Object.keys(G).map(g => nm(g, G[g])).join(", ");
        const ask = () => svConfirm({ title: "DÉLIER", text: L.length + " LIAISON(S) SERONT DÉLIÉES (" + det + ").", ok: "✕ DÉLIER" });
        if (!(await (confirmFn ? confirmFn(ask) : ask()))) return false; }
      write(L, mode !== "delier"); E.sel = {}; E.all = {}; return true; } };
  return api;
}
/* écriture commune dans des cartes { gauche: [droites] } */
const sviLkWrite = (data, L, on) => L.forEach(({ m, a, b }) => { const Mp = data[m] = data[m] || {}, A = Mp[a] || []; Mp[a] = on ? (A.includes(b) ? A : A.concat([b])) : A.filter(y => y !== b); });
/* v1130 : filtre appliqué à l'écran, sans redessin (les cases gardent leur état) — rows = [{ tr, g, id, ck }] ; un titre de groupe
   (titleSel) est caché quand toutes ses lignes le sont ; renvoie le nombre de lignes cachées par groupe */
function sviLkDomFilter(LK, rows, titleSel) { const CK = {}; rows.forEach(r => { if (r.ck) (CK[r.g] = CK[r.g] || new Set()).add(r.id); });
  const vis = LK.filterFn(CK), hid = {};
  rows.forEach(r => { const on = vis(r.g, r.id); r.tr.classList.toggle("svlk-hid", !on); if (!on) hid[r.g] = (hid[r.g] || 0) + 1; });
  /* v1131 : un titre de groupe (classe svlk-gt-<groupe>) est caché quand toutes les lignes de SON groupe (classe svlk-g-<groupe>) le sont —
     les lignes hors groupe qui le suivent ne comptent pas */
  if (titleSel) { const tbs = new Set(rows.map(r => r.tr.parentElement)); tbs.forEach(tb => [...tb.querySelectorAll(titleSel)].forEach(tt => {
    const m = String(tt.className).match(/\bsvlk-gt-(\S+)/); if (!m) return; const It = [...tb.querySelectorAll("tr.svlk-g-" + CSS.escape(m[1]))];
    tt.classList.toggle("svlk-hid", !!It.length && It.every(x => x.classList.contains("svlk-hid"))); })); }
  return hid; }

/* v1162 (budget sur le moteur commun, étape 1) : BOUTON DE LIAISON COMMUN (budget et consultation) — en haut à droite :
   k "add" = vert (✓ LIER, ou le libellé donné : ✓ VALIDER LA LIAISON / LES MODIFICATIONS pour le budget), compteur en pastille ;
   k "del" = rouge ✕ DÉLIER + pastille ; k "off" = gris, un toucher dit pourquoi (data-why) ; k "none" = gris, inactif.
   o.cls : classes en plus (le budget garde lk-go…), o.attr : attributs en plus */
function sviLkBtn(o) { const c = (o.cls ? " " + o.cls : ""), a = o.attr ? " " + o.attr : "", n = o.n ? " " + svCnt(o.n) : "";
  if (o.k === "del") return `<button type="button" class="svlk-go svlk-del${c}" data-svlk="delier"${a}>✕ DÉLIER${n}</button>`;
  if (o.k === "off") return `<button type="button" class="svlk-go svlk-off${c}" data-why="${esc(o.why || "")}"${a}>${o.lab || "✓ LIER"}</button>`;
  if (o.k === "none") return `<button type="button" class="svlk-go${c}" disabled${a}>${o.lab || "✓ LIER"}</button>`;
  return `<button type="button" class="svlk-go${c}" data-svlk="lier"${a}>${o.lab || "✓ LIER"}${n}</button>`; }
/* bouton gris : un toucher dit pourquoi, rien d'autre ne se fait */
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest(".svlk-go.svlk-off"); if (!b) return;
  e.stopPropagation(); e.preventDefault(); svToast(b.dataset.why || "RIEN À FAIRE.", 4000, b); }, true);
