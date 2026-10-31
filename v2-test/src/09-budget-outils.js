/* =========================================================
   OUTILS DU BUDGET SORTIS DU GRAND BLOC (refonte, étape 10, v646)
   Fonctions et constantes sans état, qui ne dépendaient d'aucune variable du budget ouvert (openBudgetDetail) :
   elles sont ici, hors du bloc, à un seul endroit ; le bloc les utilise comme avant. Choisies automatiquement
   (analyse du code : aucune variable du budget ouvert, aucun état gardé) ; texte inchangé.
   ========================================================= */
/* — de src/11-budget-ouverture.js — */
const nk = s =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
/* — de src/11-budget-ouverture.js — */
const pick = (row, names) => {
  const keys = Object.keys(row);

  for (const name of names) {
    const target = nk(name);

    const key =
      keys.find(k => nk(k) === target);

    if (
      key !== undefined &&
      normalise(row[key]) !== ""
    ) {
      return row[key];
    }
  }

  return "";
};
/* — de src/11-budget-ouverture.js — */
const colIndex = letter =>
  letter
    .toUpperCase()
    .split("")
    .reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
/* — de src/11-budget-ouverture.js — */
const byLetter = (row, letter) =>
  row.__cols
    ? normalise(row.__cols[colIndex(letter)])
    : "";
/* — de src/11-budget-ouverture.js — */
const gidOf = l =>
  (l.kind === "chg"
    ? [l.kind, l.detail, l.dunit]
    : [l.kind, l.id])
    .map(v => String(v ?? "").trim().toUpperCase())
    .join("|");
/* — de src/11-budget-ouverture.js — */
const groupLines = list => {
  const m = new Map();
  list.forEach(l => {
    if (!m.has(l.gid)) m.set(l.gid, []);
    m.get(l.gid).push(l);
  });
  return [...m.entries()].map(([gid, ms]) => {
    const f = ms[0];
    const qty = ms.reduce((t, l) => t + l.qty, 0);
    const amount = ms.reduce((t, l) => t + l.amount, 0);
    const tvaAmt = ms.reduce((t, l) => t + tvaFor(l), 0);
    const prices = new Set(ms.map(l => l.price));
    const same = v => new Set(ms.map(v)).size === 1 ? v(f) : "";
    return {
      gid, members: ms,
      /* Détail charge : article toujours vide ;
         Détail produit : vide si des articles différents sont fusionnés */
      article: f.kind === "chg" ? "" : same(l => l.article),
      detail: f.detail, unit: f.dunit,
      nbr: same(l => l.nbr),
      dims: [0, 1, 2].map(i => same(l => l.dims[i])),
      qty, amount, tvaAmt,
      /* prix identique, sinon prix moyen pondéré = montant / quantité */
      price: prices.size === 1 ? f.price : (qty ? amount / qty : 0),
      tva: same(l => l.tva)
    };
  });
};
/* — de src/11-budget-ouverture.js — */
const desigKey = l => l.article + "||" + l.designation;
/* — de src/11-budget-ouverture.js — */
const inSet = (set, v) => !set.size || set.has(v);
/* — de src/12-tableaux-colonnes.js — */
const cfText = v =>
  typeof v === "number" ? money(v) : String(v ?? "").trim();
/* — de src/12-tableaux-colonnes.js — */
const cfIcon =
  `<svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
     <path d="M1 2h11M3 5h7M5 8h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
     <path d="M4.5 10l2 2.2 2-2.2z" fill="currentColor"/>
   </svg>`;
/* — de src/12-tableaux-colonnes.js — */
/* ===== largeurs de colonnes : fixes, réglables, mémorisées ===== */
const CW_KEY = "svi_colw_v1";
/* — de src/12-tableaux-colonnes.js — */
const cwLoad = () => {
  try { return JSON.parse(localStorage.getItem(CW_KEY) || "{}") || {}; }
  catch (e) { return {}; }
};
/* — de src/12-tableaux-colonnes.js — */
const cwSave = obj => {
  try { localStorage.setItem(CW_KEY, JSON.stringify(obj)); } catch (e) {}
};
/* — de src/12-tableaux-colonnes.js — */
const SVI_COL = {
  article: { w: 70, pw: 5 }, designation: { w: 330 }, detail: { w: 300, pw: 30 }, unit: { w: 70, pw: 5 },
  qty: { w: 100, pw: 9 }, price: { w: 95, pw: 9 }, ht: { w: 120 }, amount: { w: 120, pw: 11 }, tva: { w: 80, pw: 6, f: "pct" }, ttc: { w: 130, pw: 11 },
  nbr: { w: 60, pw: 5 }, d1: { w: 60, pw: 5 }, d2: { w: 60, pw: 5 }, d3: { w: 60, pw: 5 }, pct: { f: "pct" },
  /* historique */
  hdt: { pw: 14 }, hbr: { pw: 8 }, hac: { pw: 12 }, hde: { pw: 40 },
  /* DOCUMENTS / TAF / OBSERVATIONS */
  rref: { w: 210, pw: 22 }, rdate: { w: 150 }, rtitle: { w: 360, pw: 60 }, rfile: { w: 120 }, rexp: { w: 110, pw: 8 }, robj: { w: 200, pw: 15 }, rtext: { w: 420, pw: 30 },
  rresp: { w: 180, pw: 13 }, rprev: { w: 140, pw: 12 }, rdelay: { w: 150, pw: 9 }, relap: { w: 150, pw: 9 }, rimp: { w: 60, pw: 4 },
  /* v685 : blocs SCÉNARIOS et VERSIONS */
  scnind: { w: 300, pw: 30 }, scnom: { w: 260, pw: 30 }, scet: { w: 150, pw: 14 }, scof: { w: 150, pw: 12 }, scret: { w: 120, pw: 10 }, scdes: { w: 140, pw: 12 }, scdel: { w: 56, pw: 4 }, vno: { w: 160, pw: 12 }, rno: { w: 120, pw: 10 }, rcdate: { w: 200, pw: 16 }, ruser: { w: 160, pw: 12 }, rstate: { w: 140, pw: 12 }, rsav: { w: 200, pw: 16 }, vkind: { w: 200, pw: 16 }, vdate: { w: 200, pw: 16 }, vuser: { w: 160, pw: 12 }, ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => ["sc" + (i + 1), { w: 180, pw: 12 }]))
};
/* — de src/12-tableaux-colonnes.js — */
const SVI_COL_T = {
  "client.article": 69, "client.designation": 660, "client.unit": 70, "client.qty": 71, "client.price": 86, "client.ht": 96, "client.tva": 81, "client.ttc": 97,
  "chg.article": 69, "chg.detail": 300, "chg.rdb": 110, "chg.pct": 58, "chg.tache": 246, "chg.unit": 70, "chg.qty": 84, "chg.price": 84, "chg.amount": 92, "chg.tva": 80, "chg.ttc": 94,
  "prd.detail": 176, "prd.tache": 246, "prd.unit": 70, "prd.nbr": 77, "prd.d1": 79, "prd.d2": 79, "prd.d3": 79, "prd.qty": 72, "prd.price": 72, "prd.amount": 92, "prd.tva": 82, "prd.ttc": 109
};
/* — de src/12-tableaux-colonnes.js — */
const colPw = k => (SVI_COL[k] && SVI_COL[k].pw) || 10;
/* — de src/12-tableaux-colonnes.js — */
/* valeur d'une case pour un aperçu ou un export lisible : % pour les colonnes « pct », nombres au format 1 234,56 */
const colFmt = (k, v) => (SVI_COL[k] && SVI_COL[k].f === "pct") && (k === "tva" || (v !== "" && v !== null && v !== undefined)) ? money(Number(v) || 0) + " %" : typeof v === "number" ? money(v) : String(v ?? "");
/* — de src/12-tableaux-colonnes.js — */
const cwGet = (t, k) => cwLoad()[t + "." + k] || SVI_COL_T[t + "." + k] || (SVI_COL[k] && SVI_COL[k].w) || 100;
/* — de src/12-tableaux-colonnes.js — */
/* colgroup + largeur totale de la table */
const cwCols = (t, cols) =>
  cols.map(([k]) =>
    `<col data-w="${t}.${k}" style="width:${cwGet(t, k)}px">`
  ).join("");
/* — de src/12-tableaux-colonnes.js — */
const cwTableW = (t, cols) =>
  cols.reduce((sum, [k]) => sum + cwGet(t, k), 0);
/* — de src/12-tableaux-colonnes.js — */
/* ===== ordre des colonnes : glisser un en-tête, ordre mémorisé ===== */
const CO_KEY = "svi_colorder_v1";
/* — de src/12-tableaux-colonnes.js — */
const coLoad = () => {
  try { return JSON.parse(localStorage.getItem(CO_KEY) || "{}") || {}; }
  catch (e) { return {}; }
};
/* — de src/12-tableaux-colonnes.js — */
const coSave = obj => {
  try { localStorage.setItem(CO_KEY, JSON.stringify(obj)); } catch (e) {}
};
/* — de src/12-tableaux-colonnes.js — */
/* clés dans l'ordre choisi (colonnes inconnues gardées à la fin) */
const coKeys = (t, keys) => {
  const saved = (coLoad()[t] || []).filter(k => keys.includes(k));
  return [...saved, ...keys.filter(k => !saved.includes(k))];
};
/* — de src/12-tableaux-colonnes.js — */
const coOrder = (t, cols) => {
  const order = coKeys(t, cols.map(c => c[0]));
  return order.map(k => cols.find(c => c[0] === k));
};
/* — de src/12-tableaux-colonnes.js — */
/* FORMAT 102 : ordre des colonnes tel qu'affiché à l'écran (après glissement) — copies, exports, aperçus */
const screenCols = (table, cols) => {
  if (!table || !cols) return cols;
  const keys = [...table.querySelectorAll("thead tr:first-child > th .cf-btn[data-col]")].map(b => b.dataset.col);
  const out = keys.map(k => cols.find(c => c[0] === k)).filter(Boolean);
  return out.length ? [...out, ...cols.filter(c => !out.includes(c) && !keys.length)] : cols;
};
/* — de src/12-tableaux-colonnes.js — */
/* réordonne un tableau déjà dessiné (col, en-têtes, lignes, pied) */
const coApply = (t, table) => {
  if (!table) return;
  const ths = [...table.querySelectorAll("thead tr:first-child > th")];
  const keys = ths.map(th => th.querySelector(".cf-btn")?.dataset.col);
  if (keys.some(k => !k)) return;
  const order = coKeys(t, keys);
  if (order.every((k, i) => k === keys[i])) return;
  const perm = order.map(k => keys.indexOf(k));
  const n = keys.length;
  const reorder = parent => {
    const kids = [...parent.children];
    if (kids.length !== n || kids.some(c => c.colSpan > 1)) return;
    perm.forEach(i => parent.appendChild(kids[i]));
  };
  table.querySelectorAll("colgroup").forEach(reorder);
  table.querySelectorAll("tr").forEach(reorder);
};
/* — de src/12-tableaux-colonnes.js — */
const cfKind = vals => {
  const v = vals.filter(x => String(x).trim() !== "");
  if (!v.length) return "";
  if (v.every(x => /^-?[\d\s\u00a0\u202f]+(,\d+)?( ?%)?$/.test(String(x).trim()))) return "num";
  if (v.every(x => /^\d{2}\/\d{2}\/\d{4}$/.test(String(x).trim()) || /^\d{4}-\d{2}-\d{2}$/.test(String(x).trim()))) return "date";
  return "txt";   /* v622 : texte — contient, ne contient pas, commence par, se termine par, égal à */
};
/* — de src/12-tableaux-colonnes.js — */
const cfNum = x => num(String(x).replace(/%/g, ""));
/* — de src/12-tableaux-colonnes.js — */
const cfCondOk = (c, v) => {
  if (!c) return true;
  if (c.kind === "txt") {
    const x = U_(String(v || "")), a = U_(String(c.a || ""));
    switch (c.op) { case "ct": return x.includes(a); case "nc": return !x.includes(a); case "sw": return x.startsWith(a); case "ew": return x.endsWith(a); case "eq": return x === a; default: return true; }
  }
  if (String(v).trim() === "") return false;
  const x = c.kind === "num" ? cfNum(v) : cfDate(v);
  if (c.kind === "date" && !x) return false;
  const a = c.a, b = c.b;
  switch (c.op) {
    case "eq": return x === a;
    case "ne": return x !== a;
    case "gt": return x > a;
    case "ge": return x >= a;
    case "lt": return x < a;
    case "le": return x <= a;
    case "bt": { const lo = a < b ? a : b, hi = a < b ? b : a; return x >= lo && x <= hi; }
    default: return true;
  }
};
/* — de src/13-instance-saisie.js — */
const U_ = v => String(v ?? "").trim().toUpperCase();
/* — de src/13-instance-saisie.js — */
const insNum = v => {
  const s = String(v ?? "").trim();
  return s === "" ? "" : num(s);
};
/* — de src/13-instance-saisie.js — */
const insFmt = v => (v === "" || v === null || v === undefined) ? "" : (typeof v === "string" && /[A-Z]/i.test(v) && !/^[\d\s.,+-]+$/.test(v)) ? v : money(v);
/* — de src/13-instance-saisie.js — */
/* niveau d'un titre d'après sa numérotation : I = 1, I.1 = 2, I.1.1 = 3 */
const insLevel = art => Math.min(3, String(art || "").split(".").filter(x => x.trim() !== "").length || 1);
/* — de src/13-instance-saisie.js — */
const dOf = r => Number(r && r.d) || 0;
/* — de src/13-instance-saisie.js — */
const artIncr = a => { const m = /^(.*?)(\d+)(\D*)$/.exec(String(a)); return m ? m[1] + (Number(m[2]) + 1) + m[3] : String(a) + ".1"; };
/* — de src/13-instance-saisie.js — */
const artAutoOf = list => {
  const out = new Map(), last = [], tnum = [];
  (list || []).forEach(r => {
    const d = Number(r && r.d) || 0;
    last.length = d + 1; tnum.length = d + 1;
    const own = String(r.art ?? "").trim();
    const n = own || (last[d] !== undefined ? artIncr(last[d]) : d === 0 ? "1" : (tnum[d - 1] || "1") + ".1");
    last[d] = n;
    if (!own) out.set(r.id, n);
    if (r.t) { tnum[d] = n; last[d + 1] = undefined; }
  });
  return out;
};
/* — de src/13-instance-saisie.js — */
const insTVA = r => (r.tva === "" || r.tva === undefined) ? 20 : num(r.tva);
/* — de src/13-instance-saisie.js — */
const INS_TRASH = `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
/* — de src/13-instance-saisie.js — */
/* v530 : chiffre d'une pastille (à moitié remplie : blanc sur la partie colorée, couleur sur la partie blanche) */
const pstNum = n => `<b class="pst-n">${n}</b>`;
/* — de src/13-instance-saisie.js — */
/* case à droite : elle coche seulement (suppression, export, aperçu passent par le menu ⋯ du bloc) */
const insDelCell = r => !r ? "" : `<input type="checkbox" class="ins-cb${r.t ? " ins-tcb" : ""}" ${!r.t && r.on === true ? "checked" : ""}>`;
/* — de src/13-instance-saisie.js — */
const insQCol = k => false;   /* plus de colonne QUANTITÉ DE LA TÂCHE : la quantité liée est la QPB du produit */
/* — de src/13-instance-saisie.js — */
const insCfT = k => k === "des" ? "client" : k;
/* — de src/13-instance-saisie.js — */
/* suite d'affichage : titres, lignes et sous-totaux (écran et aperçu) */
const insOrder = rows => {
  const out = [], stack = [];
  rows.forEach(r => {
    while (stack.length && dOf(stack[stack.length - 1]) >= dOf(r)) out.push({ sub: stack.pop() });
    out.push({ r, lvl: dOf(r) });
    if (r.t) stack.push(r);
  });
  while (stack.length) out.push({ sub: stack.pop() });
  return out;
};
/* — de src/13-instance-saisie.js — */
/* ===== titres repliables (FORMAT 60) : › replié / ⌄ déplié ; état mémorisé par budget ===== */
const FOLD_KEY = "svi_fold_v1";
/* — de src/13-instance-saisie.js — */
const foldAll = () => { try { return JSON.parse(localStorage.getItem(FOLD_KEY) || "{}") || {}; } catch (e) { return {}; } };
/* — de src/13-instance-saisie.js — */
/* v510 (remarque 68) : état d'une branche pour la couleur de son signe ou de sa pastille */
const sviFoldState = (red, blue) => red && blue ? " fs-vio" : red ? " fs-red" : blue ? " fs-blu" : "";
/* — de src/13-instance-saisie.js — */
/* grands tableaux (détail produits / charges) : lignes dessinées par paquets, au fil du défilement (rapidité) */
const INS_CHUNK = 120;
/* — de src/13-instance-saisie.js — */
/* v512 (remarque 76) : titres de charges regroupées PLIÉS à la première ouverture ; ceux qu'on déplie sont mémorisés (par budget) */
const CHG_GK = "svi_chggopen_v1";
/* — de src/13-instance-saisie.js — */
const fsMark = s => (s.mark || s.on)();
/* — de src/13-instance-saisie.js — */
/* loupes (filtres de colonne) : tableau → bloc de EFFACER et onglet */
const FS_CF = () => [["client", "client", ""], ["lot", "hier", ""], ["prim", "hier", ""], ["sec", "hier", ""],
  [insCfT("chg"), "detail", "chg"], [insCfT("prd"), "detail", "prd"], ["dly", "detail", "dly"], ["dlyp", "detail", "dly"], ["dlyr", "detail", ""],
  ["dlyi", "detail", ""], ["dlys", "detail", "dly"], ["lk_marge", "detail", "lnk"], ["lk_unl", "detail", "unl"], ["lk_inc", "detail", "inc"]];
/* — de src/13-instance-saisie.js — */
const clientTaFit = root => (root || document).querySelectorAll("textarea.ins-ta").forEach(t => {
  t.style.height = "0px"; t.style.height = Math.max(20, t.scrollHeight) + "px";
});
/* — de src/13-instance-saisie.js — */
const clientFit = () => {
  const sc = document.querySelector(".bdg-d-client-scroll"), cg = $("bdgClientCols");
  if (!sc || !cg) return;
  const tbl = sc.querySelector("table"), dc = cg.querySelector('col[data-w="client.designation"]');
  if (!sc.__ro && window.ResizeObserver) {
    let raf = 0; const run = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(clientFit); };
    sc.__ro = new ResizeObserver(run); sc.__ro.observe(sc);
    const body = $("bdgClientBody"); if (body) new MutationObserver(run).observe(body, { childList: true, subtree: true });
  }
  if (tbl && dc && !cwLoad()["client.designation"] && sc.clientWidth > 300) {
    const cols = [...cg.querySelectorAll("col")];
    const others = cols.filter(c => c !== dc).reduce((t, c) => t + (parseFloat(c.style.width) || 0), 0);
    const pr = parseFloat(getComputedStyle(sc).paddingRight) || 0;   /* FORMAT 134 : 9 px jusqu'au bord droit */
    const nd = Math.max(160, Math.min(cwGet("client", "designation"), Math.floor(sc.clientWidth - pr - others)));
    if (parseFloat(dc.style.width) !== nd) dc.style.width = nd + "px";
    const tw = others + nd + "px";
    if (tbl.style.width !== tw) tbl.style.width = tw;
  }
  /* version validée / figée : cellule DÉSIGNATION à la ligne */
  if (tbl && dc && !tbl.classList.contains("ins-table")) {
    const idx = [...cg.querySelectorAll("col")].indexOf(dc);
    tbl.querySelectorAll("tbody tr").forEach(tr => { const td = tr.children[idx]; if (td && td.colSpan <= 1) td.classList.add("c-wrap"); });
  }
  clientTaFit(sc);
};
/* — de src/13-instance-saisie.js — */
/* mode SAISIE : la case sert à choisir des lignes (plus de grisé des autres) ; le choix unique est en mode LIAISONS */
const insDim = () => {};
/* — de src/13-instance-saisie.js — */
/* ===== LOTS en arborescence (« / ») dans le bloc TÂCHES : niveaux repliables › / ⌄, nom du dernier niveau ===== */
const lotSegs = r => String(r && r.v || "").split("/").map(x => x.trim()).filter(Boolean);
/* — de src/13-instance-saisie.js — */
/* v527 (remarque 3) : « GROUPE » au lieu de « NIVEAU » (anciens noms « NIVEAU n » reconnus et affichés « GROUPE n ») */
const LVL_AUTO = /^(NOUVEAU )?(NIVEAU|GROUPE) \d+(\.\d+)*$/i;
/* — de src/13-instance-saisie.js — */
const lotAutoNo = g => { const m = String(g || "").trim().match(/^(?:NOUVEAU )?(?:NIVEAU|GROUPE) (\d+(?:\.\d+)*)$/i); return m ? m[1] : ""; };
/* — de src/13-instance-saisie.js — */
const lotNoHTML = L => L.auto || !L.no ? "" : `<span class="lvl-no">${esc(L.no)}</span>`;
/* — de src/13-instance-saisie.js — */
const lotUnder = (r, P) => { const s2 = lotSegs(r); return s2.length >= P.length && P.every((g, i) => U_(g) === U_(s2[i])); };
/* — de src/13-instance-saisie.js — */
/* v529 : lots rangés dans l'ordre de l'arborescence affichée (un niveau prend la place de son premier lot) */
const lotTreeOrder = arr => {
  const first = new Map();
  arr.forEach((r, i) => { const s2 = lotSegs(r); for (let j = 1; j <= s2.length; j++) { const p = U_(s2.slice(0, j).join(" / ")); if (!first.has(p)) first.set(p, i); } });
  const key = r => { const s2 = lotSegs(r); return s2.map((_, j) => first.get(U_(s2.slice(0, j + 1).join(" / ")))); };
  const K = new Map(arr.map(r => [r, key(r)]));
  const pos = new Map(arr.map((r, i) => [r, i]));
  return arr.slice().sort((a, b) => {
    const A = K.get(a), B = K.get(b);
    for (let i = 0; i < Math.min(A.length, B.length); i++) if (A[i] !== B[i]) return A[i] - B[i];
    return A.length - B.length || pos.get(a) - pos.get(b);
  });
};
/* — de src/13-instance-saisie.js — */
/* v533 : la case du nom tapé est suivie à la frappe (même si elle a perdu le focus, iPad) */
const GN_SEL = "input.lot-gname, input.dly-nm:not(.dly-gin)";
/* — de src/14-doublons-classement.js — */
const dupName = (k, r) => (k === "lot" || k === "prim" || k === "sec" || k === "qlt") ? U_(r.v) : [r.art, r.des].filter(Boolean).join(" — ") + (r.u ? " (" + U_(r.u) + ")" : "");
/* — de src/14-doublons-classement.js — */
const natCmp = (a, b) => String(a ?? "").localeCompare(String(b ?? ""), "fr", { numeric: true, sensitivity: "base" });
/* — de src/14-doublons-classement.js — */
const desCmp = (a, b) => {
  const A = String(a.art ?? "").trim(), B = String(b.art ?? "").trim();
  if (!A !== !B) return A ? 1 : -1;   /* ART vide en tête */
  return natCmp(A, B) || natCmp(a.des, b.des);
};
/* — de src/14-doublons-classement.js — */
const nearName = (k, r) => (k === "lot" || k === "prim" || k === "sec" || k === "qlt") ? r.v : r.des;
/* — de src/15-qualite.js — */
const QQ_TREE_W = 300;
/* — de src/15-qualite.js — */
const qqEnd = (L, i) => { let j = i + 1; while (j < L.length && L[j].d > L[i].d) j++; return j; };
/* — de src/15-qualite.js — */
const qqHasPts = (L, i) => L.slice(i + 1, qqEnd(L, i)).some(x => x.k !== "t");
/* — de src/15-qualite.js — */
const qqHasSubT = (L, i) => L.slice(i + 1, qqEnd(L, i)).some(x => x.k === "t");
/* — de src/15-qualite.js — */
const qqCrit = L => (L || []).filter(x => x.k === "c");
/* — de src/15-qualite.js — */
const qqAppLab = n => n.pv ? insFmt(n.pv).replace(/,00$/, "") + " J" + (n.pw ? " · " + n.pw : "") : "";
/* — de src/15-qualite.js — */
/* petite liste au format de l'application sous la case (comme les unités, FORMAT 50) */
const qqPick = (td, items, cur, done) => {
  document.getElementById("qqPick")?.remove();
  const m = document.createElement("div");
  m.id = "qqPick";
  m.innerHTML = items.map(it => `<button type="button" data-v="${esc(it.v)}" class="${it.v === cur ? "on" : ""}">${esc(it.lab)}</button>`).join("")
    + (cur ? '<button type="button" data-v="" class="qq-clr">EFFACER</button>' : "");
  document.body.appendChild(m);
  const r = td.getBoundingClientRect();
  sviPlaceMenu(m, { top: r.top, bottom: r.bottom, right: r.left + Math.max(r.width, m.offsetWidth), left: r.left });
  const close = ev => { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener("pointerdown", close, true); } };
  setTimeout(() => document.addEventListener("pointerdown", close, true), 0);
  m.addEventListener("click", ev => {
    const b = ev.target.closest("[data-v]");
    if (!b) return;
    m.remove(); document.removeEventListener("pointerdown", close, true);
    done(b.dataset.v);
  });
};
/* — de src/15-qualite.js — */
/* fenêtres DÉCLENCHEMENT et APPEL (FORMAT 105 et 106), au format INF */
const qqWin = (title, html, onOk, onLive) => {
  const d = sviWinNew();
  d.innerHTML = `<div class="svc-card qq-win" role="dialog" aria-modal="true">
      <button type="button" class="svc-close" data-r="0" aria-label="Fermer">✕</button>
      <div class="svc-t">${esc(title)}</div><div class="svc-x svc-html">${html}</div>
      <div class="svc-f"><button type="button" class="svc-b" data-r="0">ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-r="1">ENREGISTRER</button></div></div>`;
  sviWinShow(d);
  if (onLive) { d.addEventListener("input", () => onLive(d)); d.addEventListener("change", () => onLive(d)); onLive(d); }
  let lp = null;
  d.addEventListener("pointerdown", e => { const g = e.target.closest(".qq-dis"); if (g) lp = setTimeout(() => svToast(g.dataset.why || "", 3500, g), 500); });
  ["pointerup", "pointercancel"].forEach(t => d.addEventListener(t, () => clearTimeout(lp)));
  d.addEventListener("click", e => {
    const b = e.target.closest("[data-r]");
    if (!b && e.target !== d) return;
    if (b && b.dataset.r === "1") onOk(d);
    d.remove();
  });
};
/* — de src/16-a-completer.js — */
/* ---------- DÉTAIL DÉLAIS (instance) : une ligne par activité secondaire ---------- */
const dIso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
/* — de src/16-a-completer.js — */
const dAdd = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return dIso(d); };
/* — de src/16-a-completer.js — */
const dDiff = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
/* — de src/16-a-completer.js — */
const dFr = iso => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "";
/* — de src/17-1-liaisons.js — */
const dlyLinkTxt = x => (x.t === "DD" ? "DD" : "FD") + "+" + (x.o || 0);
/* — de src/17-2-lignes-ordre.js — */
/* ===== PLANNING (v401) : MARGE, JALON, LOTS EN ARBORESCENCE (« / »), GANTT ===== */
const dlyLotPath = name => String(name || "").split("/").map(x => x.trim()).filter(Boolean);
/* — de src/17-2-lignes-ordre.js — */
/* repli des lots (› replié / ⌄ déplié), mémorisé par projet */
const dlyFoldAll = () => { try { return JSON.parse(localStorage.getItem("svi_lotfold_v1") || "{}") || {}; } catch (e) { return {}; } };
/* — de src/17-2-lignes-ordre.js — */
/* R29 : affichage PAR LOT (ordre enregistré) ou PAR DÉBUT (vue en escalier, rien n'est enregistré), mémorisé par budget */
const dlyViewAll = () => { try { return JSON.parse(localStorage.getItem("svi_dlyview_v1") || "{}") || {}; } catch (e) { return {}; } };
/* — de src/17-2-lignes-ordre.js — */
/* hauteur des lignes du PLANNING (tableau et Gantt) : pincement vertical à deux doigts ; 24 px au moins (taille d'origine), 64 au plus */
const DLY_RH_KEY = "svi_dly_rh_v1";
/* — de src/17-2-lignes-ordre.js — */
const dlyRhGet = () => { const v = Number(localStorage.getItem(DLY_RH_KEY)); return v >= 24 && v <= 64 ? v : 24; };
/* — de src/17-2-lignes-ordre.js — */
const dlyBh = rh => Math.round(11 + (rh - 24) * 0.5);   /* épaisseur des barres : 11 px à 24, 31 px à 64 */
/* — de src/17-2-lignes-ordre.js — */
/* largeur d'un intitulé dans la barre (police des barres : 9 px, gras) */
const dlyTxtW = t => {
  const c = dlyTxtW.c || (dlyTxtW.c = document.createElement("canvas").getContext("2d"));
  if (!dlyTxtW.f) dlyTxtW.f = "700 9px " + (getComputedStyle(document.body).fontFamily || "sans-serif");
  c.font = dlyTxtW.f;
  return c.measureText(String(t || "").toUpperCase()).width;
};
/* — de src/17-3-gantt-dessin.js — */
/* v545 (remarque 2) : bas de l'écran visible (clavier de l'iPad compris) */
const dlyVpB = () => { const vv = window.visualViewport; return vv ? vv.offsetTop + vv.height : window.innerHeight; };
/* — de src/17-3-gantt-dessin.js — */
const dlyFitScr = scr => {
  if (!scr || !scr.classList.contains("dly-scroll")) return 0;
  let lim = 0; document.querySelectorAll(".topbar, .bdg-d-sticky").forEach(b => { const r = b.getBoundingClientRect(); if (r.height && /sticky|fixed/.test(getComputedStyle(b).position)) lim = Math.max(lim, r.bottom > 0 ? r.bottom : 0); });
  const tabs = document.getElementById("bdgTabs"), vb = dlyVpB();
  const mx = !!scr.closest(".max-detail");
  document.documentElement.classList.toggle("dly-lock", mx && scr.isConnected);
  /* v594 (remarque longue 2) : bloc agrandi — la ligne des onglets toujours entière juste sous le bandeau du budget */
  if (mx && tabs) { const t = tabs.getBoundingClientRect().top; if (t < lim - 0.5 || (t > lim + 0.5 && window.scrollY > 0)) window.scrollBy(0, t - lim); }
  const sr = scr.getBoundingClientRect();
  /* tot = hauteur totale du bloc (zone des tâches + pied du graphique) : bloc agrandi = jusqu'au bas de l'écran visible ;
     sinon la hauteur commune du bloc détail (FORMAT 202), moins les bandeaux posés au-dessus (ISOLÉ…) */
  let tot;
  if (mx) tot = Math.max(160, Math.floor(vb - sr.top - 2));
  else {
    const hd = parseFloat(getComputedStyle(scr).getPropertyValue("--h-detail")) || 148;
    let ban = 0; scr.parentElement && scr.parentElement.querySelectorAll(":scope > .dly-iso").forEach(b => { ban += b.offsetHeight; });
    tot = Math.max(60, Math.round(hd - ban));   /* v596 : exactement la hauteur commune du bloc détail (même hauteur que les autres onglets) */
  }
  let r = 0;
  if (Math.abs((scr.__capMax || 0) - tot) > 1) { scr.__capMax = tot; r = 2; }
  /* v598 : bloc réduit — la hauteur suit directement la poignée du bas (variable --h-detail), moins les bandeaux posés au-dessus */
  if (!mx) {
    let ban = 0; scr.parentElement && scr.parentElement.querySelectorAll(":scope > .dly-iso").forEach(b => { ban += b.offsetHeight; });
    const v = ban ? `calc(var(--h-detail, 148px) - ${ban}px)` : "";
    if (scr.style.getPropertyValue("height") !== v) { if (v) scr.style.setProperty("height", v, "important"); else scr.style.removeProperty("height"); }
    return r;
  }
  const want = tot;   /* v597 : le pied du graphique est posé par-dessus le bas du Gantt */
  if (Math.abs((parseFloat(scr.style.height) || 0) - want) > 1) { scr.style.setProperty("height", want + "px", "important"); r = r || 1; }
  return r;
};
/* — de src/17-4-tableau-fenetres.js — */
const dlyLabU = r => U_(r.u).replace(/[^A-Z]/g, "");
/* — de src/17-4-tableau-fenetres.js — */
const dlyIsLab = r => ["JH", "HJ", "J", "JR", "JOUR", "JOURS", "JOURHOMME", "JOURSHOMME", "H", "HR", "HEURE", "HEURES"].includes(dlyLabU(r)) || /MAIN\s*D.?\s*(Œ|OE)UVRE/.test(U_(r.des));
/* — de src/17-4-tableau-fenetres.js — */
const dlyJHof = r => { const q = num(r.q || 0) || 0; return ["H", "HR", "HEURE", "HEURES"].includes(dlyLabU(r)) ? q / 8 : q; };
/* — de src/17-4-tableau-fenetres.js — */
const dlyEnd = D => Object.values(D).map(x => x.fin).filter(Boolean).sort().pop() || "";
/* — de src/17b-planning-auto.js — */
const dlyResU = r => dlyIsLab(r) ? "J-H" : (U_(r.u) || "U");
/* — de src/17b-planning-auto.js — */
const dlyResK = r => U_(r.des) + "|" + dlyResU(r);
/* — de src/17b-planning-auto.js — */
const dlyResQty = r => dlyIsLab(r) ? dlyJHof(r) : num(r.q || 0) || 0;
/* — de src/17b-planning-auto.js — */
/* même unité pour toutes les charges cochées : la QUANTITÉ est possible ; sinon MONTANT seulement (R11) */
const dlySameU = R => !!R && new Set(R.map(dlyResU)).size === 1;
/* — de src/17b-planning-auto.js — */
const dlyGM = gk => /^DH: /.test(String(gk));
/* — de src/17b-planning-auto.js — */
const dlyGKeys = gk => new Set(String(gk).replace(/^DH: /, "").split(" § "));
/* — de src/17b-planning-auto.js — */
const dlyGName = gk => (dlyGM(gk) ? "DH : " : "") + [...new Set(String(gk).replace(/^DH: /, "").split(" § ").map(x => x.split("|")[0]))].join(" + ");
/* — de src/17b-planning-auto.js — */
/* valeur d'un morceau : nombre ≥ 1, 0 (pénurie) ou −1 (ILLIMITÉ, aussi quand rien n'est réglé) */
const dlyCapV = v => v === undefined || v === null || v === "" || Number(v) < 0 ? -1 : Math.round(Number(v));
/* — de src/17b-planning-auto.js — */
/* coupes d'un groupe : { d, n, after } ; une coupe rattachée à des tâches (after) se place juste après leur fin (R23) */
const dlyCutsOf = st => ((st && st.plafs) || []).filter(s => s && (s.d || (s.after || []).length));
/* — de src/17b-planning-auto.js — */
const dlyRdV = v => v === undefined || v === null || v === "" || !isFinite(Number(v)) ? 100 : Math.max(1, Math.round(Number(v)));
/* — de src/17b-planning-auto.js — */
const dlyRdSet0 = st => !!st && (st.rd !== undefined && st.rd !== null && st.rd !== "" || (st.rds || []).length > 0);
/* — de src/17b-planning-auto.js — */
const dlyRdCuts = st => ((st && st.rds) || []).filter(s => s && (s.d || (s.after || []).length));
/* — de src/17b-planning-auto.js — */
const dlyHalfS = p => !!(p && p.deb && p.dmd === p.deb);
/* — de src/17b-planning-auto.js — */
const dlyHalfE = p => !!(p && p.fin && p.fmd === p.fin);
/* — de src/17b-planning-auto.js — */
const DLY_BUT_MSG = "AVEC CE NOMBRE VOUS RISQUEZ DE DÉPASSER LA DATE BUTOIR";
/* — de src/17b-planning-auto.js — */
/* hauteur de l'histogramme : nombre de pixels (28 = miniaturisé en bas) ou « full » (plein écran, à la place du Gantt) */
/* v546 (R25) : 0 = histogramme entièrement caché (poignée tout en bas) */
const dlyHHGet = () => { let v = ""; try { v = localStorage.getItem("svi_dlyhh_v1") || ""; } catch (e) {} return v === "full" ? "full" : v === "0" ? 0 : Math.max(28, Math.min(2000, Number(v) || 110)); };
/* — de src/17b-planning-auto.js — */
const dlyHHSet = v => { try { localStorage.setItem("svi_dlyhh_v1", String(v)); } catch (e) {} };
/* — de src/18-annuler-liaisons.js — */
const uniq = arr =>
  [...new Set(arr.filter(v => String(v).trim() !== ""))]
    .sort((x, y) =>
      String(x).localeCompare(String(y), undefined, { numeric: true })
    );
/* — de src/18-annuler-liaisons.js — */
const tvaFor = l =>
  l.ttcAmount !== undefined ? l.ttcAmount - l.amount : l.amount * l.tva / 100;
/* — de src/18-annuler-liaisons.js — */
/* ligne TOTAL en pied des onglets Détail charge / produit */
const tabFootHTML = (list, prd) => {
  /* produits : la quantité totale ne compte que les clés primaires
     (lignes au prix non nul), comme dans les désignations client */
  const qty = list.reduce((t, l) =>
    t + (prd && !l.priceTTC ? 0 : l.qty), 0);
  const ht = list.reduce((t, l) => t + l.amount, 0);
  const tva = list.reduce((t, l) => t + tvaFor(l), 0);
  const lead = prd ? 6 : 2;   /* colonnes avant « TOTAL » */
  /* quantité (et prix moyen) seulement si toutes les unités sont identiques */
  const units = new Set(list.map(l => String(l.dunit ?? "").trim().toUpperCase()));
  const sameUnit = list.length > 0 && units.size === 1;
  return `
    <tr class="bdg-d-total-row">
      ${
        sameUnit
          ? `${"<td></td>".repeat(lead)}
             <td class="number">TOTAL</td>
             <td class="number">${money(qty)}</td>
             <td class="number">${money(qty ? ht / qty : 0)}</td>`
          /* unités différentes : « TOTAL » juste avant le montant HT */
          : `${"<td></td>".repeat(lead + 2)}
             <td class="number">TOTAL</td>`
      }
      <td class="number">${money(ht)}</td>
      <td class="number" id="bdgFtTVA">${money(tva)}</td>
      <td class="number" id="bdgFtTTC">${money(ht + tva)}</td>
    </tr>`;
};
/* — de src/18-annuler-liaisons.js — */
const tcolsFor = prd => [
  /* détail produits : pas de colonne ART (FORMAT 6) */
  ...(prd ? [] : [["article", "ART", l => l.article, "center"]]),
  ["detail", prd ? "DÉSIGNATION PRODUIT" : "DÉSIGNATION CHARGE", l => l.detail, ""],
  ["unit", prd ? "UPB" : "UCB", l => l.unit, "center"],
  ...(prd ? [
    ["nbr", "NBR", l => String(l.nbr ?? ""), "number"],
    ["d1", "DIM 1", l => String(l.dims[0] ?? ""), "number"],
    ["d2", "DIM 2", l => String(l.dims[1] ?? ""), "number"],
    ["d3", "DIM 3", l => String(l.dims[2] ?? ""), "number"]
  ] : []),
  ["qty", prd ? "QPB" : "QCB", l => l.qty, "number"],
  ["price", prd ? "PPB" : "PCB", l => l.price, "number"],
  ["amount", prd ? "MPB HT" : "MCB HT", l => l.amount, "number"],
  ["tva", "TVA %", l => String(l.tva ?? ""), "number"],
  ["ttc", prd ? "MPB TTC" : "MCB TTC", l => l.amount + l.tvaAmt, "number"]
];
/* — de src/19-delais-disposition.js — */
/* ===== disposition des blocs : ordre et hauteur, mémorisés ===== */
const LAY_KEY = "svi_layout_v1";
/* — de src/19-delais-disposition.js — */
const layLoad = () => {
  try { return JSON.parse(localStorage.getItem(LAY_KEY) || "{}") || {}; }
  catch (e) { return {}; }
};
/* — de src/19-delais-disposition.js — */
const laySave = v => {
  try { localStorage.setItem(LAY_KEY, JSON.stringify(v)); } catch (e) {}
};
/* — de src/19-delais-disposition.js — */
/* v557 (FORMAT 202) : hauteur du bloc détail par défaut = écran visible sous le bandeau (fixé) et les onglets, moins la poignée */
const layDetDef = () => {
  let lim = 0;
  document.querySelectorAll(".topbar, .bdg-d-sticky").forEach(b => { const r = b.getBoundingClientRect(); if (r.height && /sticky|fixed/.test(getComputedStyle(b).position)) lim = Math.max(lim, r.bottom > 0 ? r.bottom : 0); });
  const vv = window.visualViewport, vb = vv ? vv.offsetTop + vv.height : window.innerHeight;
  const tabs = $("bdgTabs"), th = tabs ? tabs.getBoundingClientRect().height : 50;
  return Math.max(200, Math.floor(vb - lim - th - 22));
};
/* — de src/21-export-import.js — */
const download = (name, blob) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
};
/* — de src/21-export-import.js — */
const fileDialog = ({ title, name, path, buttons, onAct }) => {
  const p = sviPopNew();
  p.innerHTML = `
    <div class="doc-card" role="dialog" aria-modal="true" style="max-width:640px">
      <div class="doc-head">
        <span class="doc-title">${esc(title)}</span>
        <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
      </div>
      <div class="doc-body">
        <div class="doc-grid doc-grid-2">
          <label class="doc-lab" for="fdName">NOM DU FICHIER</label>
          <input id="fdName" class="doc-in" type="text" autocomplete="off" value="${esc(name)}">
          <label class="doc-lab" for="fdPath">DOSSIER DRIVE</label>
          <input id="fdPath" class="doc-in" type="text" autocomplete="off" data-keepcase value="${esc(path)}">
        </div>
        <div class="doc-err fd-msg" id="fdMsg"></div>
      </div>
      <div class="doc-foot">
        <button type="button" class="doc-btn" data-cancel>ANNULER</button>
        ${buttons.map(b => `<button type="button" class="doc-btn${b.primary ? " doc-save" : ""}" data-act="${b.key}"${b.drive ? " data-drive" : ""}>${esc(b.label)}</button>`).join("")}
      </div>
    </div>`;
  sviPopShow(p);
  popEnhance(p, "save");
  drivePathRow(p, "#fdPath", false);
  const msg = p.querySelector("#fdMsg");
  const ui = {
    msg: (t, kind) => { msg.innerHTML = t; msg.className = "doc-err fd-msg" + (kind ? " " + kind : ""); },
    close: () => p.remove(),
    busy: (k, on) => { const b = p.querySelector(`[data-act="${k}"]`); if (b) b.disabled = on; },
    setPath: v => { if (v) p.querySelector("#fdPath").value = v; }
  };
  let pathShown = false;
  p.addEventListener("click", e => {
    if (e.target === p || e.target.closest("[data-cancel]")) { p.remove(); return; }
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    /* 1er toucher sur le Drive : le dossier s'affiche ; 2e : enregistrement */
    if (b.dataset.drive !== undefined && !pathShown) {
      pathShown = true;
      drivePathRow(p, "#fdPath", true);
      b.textContent = "ENREGISTRER";
      return;
    }
    onAct(b.dataset.act, {
      name: p.querySelector("#fdName").value.trim(),
      path: driveCleanPath(p.querySelector("#fdPath").value)
    }, ui);
  });
};
/* — de src/21-export-import.js — */
/* enregistrement sur l'iPad (partage / téléchargement) */
const saveDevice = (name, blob) => {
  try {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: name }).catch(err => {
        if (err && err.name !== "AbortError") download(name, blob);
      });
      return;
    }
  } catch (e) {}
  download(name, blob);
};
/* — de src/21-export-import.js — */
const loadXLSX = () => window.XLSX
  ? Promise.resolve(window.XLSX)
  : new Promise((ok, ko) => {
      const sc = document.createElement("script");
      /* version de SheetJS qui sait écrire les styles (police, bordures, alignement) */
      sc.src = "https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js";
      sc.onload = () => ok(window.XLSX);
      sc.onerror = () => ko(new Error("Bibliothèque Excel indisponible"));
      document.head.appendChild(sc);
    });
/* — de src/21-export-import.js — */
const exportSizing = (head, rows) => {
  const txt = v => typeof v === "number" ? money(v) : String(v ?? "");
  const isNum = c => {
    const vals = rows.map(r => r[c]).filter(v => v !== "" && v != null);
    return vals.length > 0 && vals.filter(v => typeof v === "number").length >= vals.length / 2;
  };
  const wch = head.map((h, c) => {
    const dataLen = Math.max(0, ...rows.map(r => txt(r[c]).length));
    const longWord = Math.max(...String(h ?? "").split(/\s+/).map(w => w.length));
    if (c === 1) return Math.min(80, Math.max(dataLen, String(h ?? "").length) + 2);
    if (isNum(c)) return Math.max(9, dataLen + 3, longWord + 2);
    return Math.max(6, Math.min(30, Math.max(dataLen, longWord) + 2));
  });
  /* nombre de lignes du titre une fois replié dans sa largeur */
  const lines = head.map((h, c) => {
    let n = 1, cur = 0;
    String(h ?? "").split(/\s+/).forEach(w => {
      if (cur && cur + 1 + w.length > wch[c] - 1) { n++; cur = w.length; }
      else cur += (cur ? 1 : 0) + w.length;
    });
    return n;
  });
  const hpt = 15 * Math.max(1, ...lines) + 6;
  return { wch, hpt };
};
/* — de src/21-export-import.js — */
const driveDoneFlash = () => {
  const b = document.querySelector('#docPop [data-act="save"]') || document.querySelector('#docPop [data-act="drive"]');
  if (!b) return;
  const t = b.textContent;
  b.textContent = "✓ ENREGISTRÉ";
  setTimeout(() => { if (b.isConnected) b.textContent = t; }, 2500);
};
/* — de src/21-export-import.js — */
const popup = (html, cls = "") => {
  document.getElementById("blkPop")?.remove();
  const p = document.createElement("div");
  p.id = "blkPop";
  p.className = cls;
  p.innerHTML = html;
  p.addEventListener("click", e => {
    if (e.target === p || e.target.closest("[data-close]")) p.remove();
  });
  document.body.appendChild(p);
  return p;
};
/* — de src/21-export-import.js — */
/* fenêtre au format INF : lien de la feuille Google à importer */
const askSheetLink = () => new Promise(res => {
  const p = sviPopNew();
  p.className = "pop-new-bdg";
  p.innerHTML = `
    <div class="doc-card" role="dialog" aria-modal="true" style="max-width:760px">
      <div class="doc-head">
        <span class="doc-title">IMPORTER — GOOGLE SHEETS</span>
        <button type="button" class="doc-x" data-cancel aria-label="Fermer">✕</button>
      </div>
      <div class="doc-body">
        <div class="doc-grid">
          <label class="doc-lab" for="gsLink">LIEN DE LA FEUILLE <b>*</b></label>
          <input id="gsLink" class="doc-in" style="grid-column:2 / -1;width:100%" type="url" data-keepcase autocomplete="off"
            inputmode="url" placeholder="https://docs.google.com/spreadsheets/d/…">
        </div>
        <div id="gsErr" class="doc-err"></div>
      </div>
      <div class="doc-foot">
        <button type="button" class="doc-btn" data-cancel>ANNULER</button>
        <button type="button" class="doc-btn nb-save" id="gsGo">IMPORTER</button>
      </div>
    </div>`;
  sviPopShow(p);
  try { popEnhance(p, "gslink"); } catch (e) {}
  const inp = p.querySelector("#gsLink");
  /* champ sur toute la largeur de la fenêtre */
  const cell = inp.parentElement.classList.contains("doc-grid") ? inp : inp.parentElement;
  cell.style.gridColumn = "2 / -1";
  cell.style.width = "100%";
  const close = v => { p.remove(); res(v); };
  const go = () => {
    const v = inp.value.trim();
    if (!/\/d\/[a-zA-Z0-9_-]+/.test(v)) {
      p.querySelector("#gsErr").textContent = "LIEN GOOGLE SHEETS NON RECONNU.";
      inp.focus();
      return;
    }
    close(v);
  };
  p.addEventListener("click", e => {
    if (e.target === p || e.target.closest("[data-cancel]")) close("");
    else if (e.target.closest("#gsGo")) go();
  });
  inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); go(); } });
  setTimeout(() => inp.focus(), 50);
});
/* — de src/21-export-import.js — */
const impFr = iso => iso ? String(iso).slice(8, 10) + "/" + String(iso).slice(5, 7) + "/" + String(iso).slice(0, 4) : "";
/* — de src/21-export-import.js — */
const impId = (k, r) => {
  /* produits : sans article — DÉSIGNATION + UNITÉ */
  /* FORMAT 89 : une désignation (et une charge) se reconnaît par sa DÉSIGNATION + UNITÉ, sans l'ART ;
     seuls les titres gardent leur ART */
  const base = [r.t ? U_(r.art) : "", U_(r.des), U_(r.u), r.t ? "T" : ""];
  return base.join("|");
};
/* — de src/21-export-import.js — */
/* charges, lots et activités : ordre alphabétique */
const impSort = m => {
  const az = (a, b) => String(a).localeCompare(String(b), "fr", { numeric: true });
  m.chg.sort((a, b) => az(a.row.des, b.row.des) || az(a.row.u, b.row.u));
  m.hier.sort((a, b) => az(a.row.v, b.row.v));
};
/* — de src/21-export-import.js — */
/* v481 (remarque 18) : message compréhensible par tout lecteur — quelle tâche bloque et quoi changer */
const bfRuleAWhy = (g, w, task) => (g === "p" ? "TÂCHE PRIMAIRE " : "TÂCHE SECONDAIRE ") + (task ? task + " " : "") + "DÉJÀ LIÉE À " + w.name + " (" + w.n + " LIGNE" + (w.n > 1 ? "S" : "") + "). UNE TÂCHE N'A QU'UNE DÉSIGNATION CLIENT : CHANGER LE LOT OU L'ACTIVITÉ " + (g === "p" ? "PRIMAIRE" : "SECONDAIRE") + ".";
/* — de src/22-saisie-directe.js — */
/* texte principal sans doublon (intitulé DOC / OBS, descriptif TAF) */
const dupKey = v => String(v ?? "").trim().toUpperCase().replace(/\s+/g, " ");
/* — de src/22-saisie-directe.js — */
const findDup = (list, get, v) => list.find(r => dupKey(get(r)) === dupKey(v));
/* — de src/22b-exploitation.js — */
const xplColor = (p, lo, hi) => {
  const neg = p < 0, t = neg ? (lo < 0 ? Math.min(1, p / lo) : 0) : (hi > 0 ? Math.min(1, p / hi) : 0);
  const light = Math.round(92 - 64 * t), hue = neg ? 0 : 130, sat = neg ? 70 : 55;
  return `background:hsl(${hue},${sat}%,${light}%) !important;color:${light < 55 ? "#fff" : "#172033"} !important;-webkit-text-fill-color:${light < 55 ? "#fff" : "#172033"} !important`;
};
/* — de src/23-apercus-impression.js — */
/* bulle d'explication sur une case signalée */
const showWhy = td => {
  document.getElementById("whyTip")?.remove();
  const tip = document.createElement("div");
  tip.id = "whyTip";
  tip.textContent = td.dataset.why;
  document.body.appendChild(tip);
  const r = td.getBoundingClientRect();
  const w = Math.min(280, window.innerWidth - 16);
  tip.style.width = w + "px";
  tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px";
  const above = r.top - tip.offsetHeight - 8;
  tip.style.top = (above > 8 ? above : r.bottom + 8) + "px";
  const close = () => { tip.remove(); document.removeEventListener("click", close, true); };
  setTimeout(() => document.addEventListener("click", close, true), 0);
  setTimeout(close, 5000);
};
/* — de src/24-doc-historique-fenetres.js — */
const pad = (n, w = 2) => String(n).padStart(w, "0");
/* — de src/24-doc-historique-fenetres.js — */
/* ===== fenêtres et champs de saisie réglables (tailles mémorisées) ===== */
const PS_KEY = "svi_popsize_v1";
/* — de src/24-doc-historique-fenetres.js — */
const psLoad = () => {
  try { return JSON.parse(localStorage.getItem(PS_KEY) || "{}") || {}; }
  catch (e) { return {}; }
};
/* — de src/24-doc-historique-fenetres.js — */
const psSet = (k, v) => {
  const all = psLoad();
  if (v) all[k] = v; else delete all[k];
  try { localStorage.setItem(PS_KEY, JSON.stringify(all)); } catch (e) {}
};
/* — de src/24-doc-historique-fenetres.js — */
/* glissement générique : fn(dx, dy) pendant, done() à la fin */
const dragXY = (e, fn, done) => {
  e.preventDefault();
  e.stopPropagation();
  const x0 = e.clientX, y0 = e.clientY;
  const mv = ev => { ev.preventDefault(); fn(ev.clientX - x0, ev.clientY - y0); };
  const tm = ev => ev.preventDefault();
  const up = () => {
    document.removeEventListener("pointermove", mv);
    document.removeEventListener("pointerup", up);
    document.removeEventListener("pointercancel", up);
    document.removeEventListener("touchmove", tm);
    done();
  };
  document.addEventListener("pointermove", mv, { passive: false });
  document.addEventListener("touchmove", tm, { passive: false });
  document.addEventListener("pointerup", up);
  document.addEventListener("pointercancel", up);
};
/* — de src/24-doc-historique-fenetres.js — */
/* format unique des dates : JJ/MM/AAAA À HH:MM */
const fmtField = (type, v) => {
  if (!v) return "";
  if (type === "time") return v.slice(0, 5);
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return String(v);
  return `${m[3]}/${m[2]}/${m[1]}` + (type === "datetime-local" && m[4] ? ` À ${m[4]}:${m[5]}` : "");
};
/* — de src/24-doc-historique-fenetres.js — */
const popEnhance = (p, kind) => {
  const card = p.querySelector(".doc-card");
  if (!card) return;
  const sizes = psLoad();
  /* fenêtre : poignée en bas à droite */
  const cs = sizes["win." + kind];
  if (cs) { card.style.width = cs.w + "px"; card.style.maxWidth = "none"; card.style.height = cs.h + "px"; }
  const ch = document.createElement("span");
  ch.className = "pop-rsz";
  ch.title = "Glisser pour redimensionner la fenêtre";
  card.appendChild(ch);
  ch.addEventListener("pointerdown", e => {
    const r = card.getBoundingClientRect();
    let w = r.width, h = r.height;
    card.style.maxWidth = "none";
    dragXY(e, (dx, dy) => {
      w = Math.max(300, Math.min(window.innerWidth - 16, Math.round(r.width + dx * 2)));
      h = Math.max(180, Math.min(window.innerHeight - 16, Math.round(r.height + dy * 2)));
      card.style.width = w + "px";
      card.style.height = h + "px";
    }, () => psSet("win." + kind, { w, h }));
  });
  /* champs : poignée sur le coin bas-droit de chaque champ */
  p.querySelectorAll(".doc-in").forEach((el, i) => {
    /* clé stable : identifiant du champ, sinon son libellé */
    const lab = (el.previousElementSibling?.textContent || "").replace(/\*/g, "").trim();
    const key = "fld." + kind + "." + (el.id || lab || i);
    /* agrandi vers la droite et vers le bas ; la saisie reste en haut
       (champ d'une ligne : la hauteur ajoutée passe en marge du bas) */
    let vis = el;   /* élément visible (affichage JJ/MM/AAAA À HH:MM pour les dates) */
    const setH = h => {
      vis.style.height = h + "px";
      if (vis.tagName === "INPUT") vis.style.paddingBottom = Math.max(0, h - 34) + "px";
    };
    const wrap = document.createElement("span");
    wrap.className = "fld-wrap" + (el.closest(".doc-row") ? " in-row" : "");
    el.replaceWith(wrap);
    wrap.appendChild(el);
    /* dates : affichage uniforme JJ/MM/AAAA À HH:MM, le sélecteur
       natif reste dessous (transparent) pour la saisie */
    if (["date", "time", "datetime-local"].includes(el.type)) {
      const show = document.createElement("div");
      show.className = "doc-in dt-show" + (el.classList.contains("doc-ro") ? " doc-ro" : "");
      el.classList.remove("doc-in");
      el.classList.add("dt-native");
      wrap.insertBefore(show, el);
      const upd = () => { show.textContent = fmtField(el.type, el.value) || "\u00a0"; };
      el.addEventListener("input", upd);
      el.addEventListener("change", upd);
      el.addEventListener("click", () => { try { el.showPicker?.(); } catch (err) {} });
      upd();
      vis = show;
    }
    const fs = sizes[key];
    if (fs) {
      if (fs.w) { wrap.style.width = fs.w + "px"; wrap.classList.add("sized"); }
      if (fs.h) setH(fs.h);
    }
    const hd = document.createElement("span");
    hd.className = "fld-rsz";
    hd.title = "Glisser pour régler la taille du champ";
    wrap.appendChild(hd);
    hd.addEventListener("pointerdown", e => {
      const r = vis.getBoundingClientRect();
      let w = r.width, h = r.height;
      dragXY(e, (dx, dy) => {
        w = Math.max(60, Math.round(r.width + dx));
        h = Math.max(28, Math.round(r.height + dy));
        wrap.style.width = w + "px";
        wrap.classList.add("sized");
        setH(h);
      }, () => psSet(key, { w, h }));
    });
    /* double-toucher sur la poignée : taille d'origine */
    hd.addEventListener("dblclick", () => {
      wrap.style.width = ""; wrap.classList.remove("sized");
      vis.style.height = ""; vis.style.paddingBottom = "";
      psSet(key, null);
    });
  });
};
/* — de src/24-doc-historique-fenetres.js — */
/* ===== listes DOC / TAF / OBS sous le détail ===== */
const fmtDT = v => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} À ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/* — de src/25-inf.js — */
/* durée en jours du calendrier, début et fin compris : « 1 AN 2 MOIS 20 JOURS » */
const infYMD = (a, b) => {
  if (!a || !b || b < a) return "";
  const D = x => new Date(x + "T12:00:00");
  const end = D(b); end.setDate(end.getDate() + 1);
  let y = 0, m = 0, c = D(a);
  const add = (d, yy, mm) => { const n = new Date(d); n.setFullYear(n.getFullYear() + yy); n.setMonth(n.getMonth() + mm); return n; };
  while (add(c, 1, 0) <= end) { c = add(c, 1, 0); y++; }
  while (add(c, 0, 1) <= end) { c = add(c, 0, 1); m++; }
  const d = Math.round((end - c) / 86400000);
  return [y ? y + (y > 1 ? " ANS" : " AN") : "", m ? m + " MOIS" : "", d ? d + (d > 1 ? " JOURS" : " JOUR") : ""].filter(Boolean).join(" ") || "0 JOUR";
};
/* — de src/25-inf.js — */
const STAR = ' <b class="req-star">*</b>';
/* — de src/25-inf.js — */
const localDT = d =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
/* — de src/25-inf.js — */
const hm = ms => {
  if (!isFinite(ms)) return "0:00";
  const neg = ms < 0; ms = Math.abs(ms);
  const m = Math.round(ms / 60000);
  return (neg ? "-" : "") + Math.floor(m / 60) + ":" + pad(m % 60);
};
/* — de src/26-copier-coller.js — */
const CLIP_KEY = "svi_clip_v1";
/* — de src/26-copier-coller.js — */
const clipGet = () => { try { return JSON.parse(localStorage.getItem(CLIP_KEY) || "null"); } catch (e) { return null; } };
/* — de src/26-copier-coller.js — */
const clipSet = c => { try { c ? localStorage.setItem(CLIP_KEY, JSON.stringify(c)) : localStorage.removeItem(CLIP_KEY); } catch (e) {} };
/* — de src/26b-conditionnement.js — */
const COND_K = r => U_(r.des) + "|" + U_(r.u);
/* — de src/26b-conditionnement.js — */
const condAll = () => { try { return JSON.parse(localStorage.getItem("svi_cond_chs_v1") || "{}") || {}; } catch (e) { return {}; } };
/* — de src/26b-conditionnement.js — */
const condCut = (pieces, BL, kerf = 0) => {
  const all = [];
  pieces.forEach(p => { for (let i = 0; i < p.n; i++) all.push(p.L); });
  all.sort((a, b) => b - a);
  if (all.some(L => L > BL + 1e-9)) return { err: "UN MORCEAU EST PLUS LONG QUE LA BARRE (" + money(Math.max(...all)) + " M)." };
  const pack = list => {
    const bars = [];
    list.forEach(L => {
      let best = -1, rest = Infinity;
      bars.forEach((b, i) => { const r = BL - b.used - (b.cuts.length ? kerf : 0) - L; if (r >= -1e-9 && r < rest) { rest = r; best = i; } });
      if (best < 0) bars.push({ used: L, cuts: [L] });
      else { const b = bars[best]; b.used += L + (b.cuts.length ? kerf : 0); b.cuts.push(L); }
    });
    return bars;
  };
  let bars = pack(all);
  /* amélioration : vider la barre la moins remplie et replacer ses morceaux dans les autres */
  for (let g = 0; g < 30 && bars.length > 1; g++) {
    const sorted = bars.slice().sort((a, b) => a.used - b.used), low = sorted[0];
    const others = bars.filter(b => b !== low).map(b => ({ used: b.used, cuts: b.cuts.slice() }));
    let ok = true;
    low.cuts.slice().sort((a, b) => b - a).forEach(L => {
      let best = -1, rest = Infinity;
      others.forEach((b, i) => { const r = BL - b.used - kerf - L; if (r >= -1e-9 && r < rest) { rest = r; best = i; } });
      if (best < 0) ok = false; else { others[best].used += L + kerf; others[best].cuts.push(L); }
    });
    if (!ok) break;
    bars = others;
  }
  /* plan : barres identiques regroupées */
  const plan = new Map();
  bars.forEach(b => { const k = b.cuts.slice().sort((a, c) => c - a).map(x => money(x)).join(" + "); plan.set(k, { n: ((plan.get(k) || {}).n || 0) + 1, chute: BL - b.used }); });
  const need = all.reduce((a, b) => a + b, 0), chute = bars.length * BL - need;
  return { bars: bars.length, plan: [...plan].map(([k, v]) => ({ k, n: v.n, chute: v.chute })), need, chute, pct: bars.length ? chute / (bars.length * BL) * 100 : 0 };
};

/* v728 (bloc 9) : emballage et chutes — réglage du TITRE de charges (même désignation, même unité) dans CE budget (INS.cond),
   l'ancien réglage gardé sur l'appareil (CHS) n'étant plus lu qu'en secours */
const condOf = (I, key) => ((I && I.cond) || {})[key] || condAll()[key] || null;
/* morceaux : produits liés aux charges du titre — longueur = DIM 1, nombre = NBR */
const condPiecesOf = (I, rows) => {
  const ids = new Set(rows.map(r => r.id)), out = new Map();
  (I.links || []).filter(l => (l.chg || []).some(x => ids.has(x.id))).forEach(l => (l.prd || []).forEach(x => {
    const p = (I.prd || []).find(q => q.id === x.id); if (!p) return;
    const L = num(p.d1), n = Math.max(1, Math.round(num(p.nbr) || 1)); if (!(L > 0)) return;
    const k = String(Math.round(L * 1000) / 1000); out.set(k, (out.get(k) || 0) + n);
  }));
  return [...out].map(([L, n]) => ({ L: Number(L), n })).sort((a, b) => b.L - a.L);
};
/* longueur (M) → unité de la charge : M / ML tel quel ; KG et T avec le poids au mètre ; sinon impossible (null) */
const condM2U = (u, kgm) => { const U = U_(u).replace(/[^A-Z]/g, ""); if (U === "M" || U === "ML") return 1; if (kgm > 0 && (U === "KG")) return kgm; if (kgm > 0 && (U === "T" || U === "TONNE" || U === "TONNES")) return kgm / 1000; return null; };
/* chute du titre (unité de la charge) : barres achetées − longueur utile (méthode A, 30/10/2026) ; mémorisée par réglage + morceaux */
const condChuteMemo = new Map();
const condChuteOf = (I, key, rows) => {
  const c = ((I && I.cond) || {})[key]; if (!c || c.mode !== "c" || !(num(c.BL) > 0)) return null;   /* chute : seulement un réglage fait dans ce budget */
  const pcs = c.pcs && c.pcs.length ? c.pcs : condPiecesOf(I, rows), f = condM2U(rows[0] && rows[0].u, num(c.kgm));
  if (!pcs.length || f === null) return null;
  const sig = key + "|" + c.BL + "|" + (c.kerf || 0) + "|" + JSON.stringify(pcs);
  let R = condChuteMemo.get(sig); if (!R) { R = condCut(pcs, num(c.BL), num(c.kerf) || 0); if (condChuteMemo.size > 400) condChuteMemo.clear(); condChuteMemo.set(sig, R); }
  return R.err ? null : R.chute * f;
};
/* part d'une ligne de charge : chute du titre répartie au prorata des QCB de ses lignes */
const condChuteRow = (I, r) => {
  if (!I || !r || r.t) return 0;
  const key = COND_K(r), rows = (I.chg || []).filter(x => !x.t && COND_K(x) === key);
  const C = condChuteOf(I, key, rows); if (!C) return 0;
  const Q = rows.reduce((t, x) => t + (num(x.q) || 0), 0);
  return Q > 0 ? C * (num(r.q) || 0) / Q : C / rows.length;
};

/* v738 (prompt du 31/10, point 3) : RECETTES des MODALITÉS DE PAIEMENT — chaque échéance (date, montant) ;
   RETENUE DE GARANTIE (taux) déduite de chaque échéance et rendue à sa libération (date, fin d'une tâche, ou fin des travaux + n mois) */
const sviPayPlan = (d, M, finOf, endAll) => {
  const n = v => Number(String(v ?? "").replace(/\s/g, "").replace(",", ".")) || 0, out = [];
  ((d.ctr || {}).rows || []).filter(r => r.type === "pay").forEach(r => {
    const D = r.det || {}, G = D.rg, t = G ? Math.max(0, Math.min(100, n(G.t))) / 100 : 0;
    let held = 0;
    (D.ech || []).forEach(e => {
      const date = e.on === "task" ? (finOf(e.task) || "") : e.date || "";
      const m = e.u === "%" ? M * n(e.v) / 100 : n(e.v);
      held += m * t;
      out.push({ lab: e.lab || (e.on === "task" ? "FIN DE TÂCHE" : "ÉCHÉANCE"), date, m: m * (1 - t), brut: m, rg: m * t, task: e.on === "task" ? e.task : "" });
    });
    if (t > 0 && held > 0) {
      let date = "";
      if (G.on === "date") date = G.date || "";
      else if (G.on === "task") date = finOf(G.task) || "";
      else if (endAll) { const x = new Date(endAll + "T12:00:00"); x.setMonth(x.getMonth() + (G.mois === "" || G.mois === undefined ? 12 : n(G.mois))); date = x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); }
      out.push({ lab: "LIBÉRATION DE LA RETENUE DE GARANTIE", date, m: held, rgLib: true });
    }
  });
  return out.sort((a, b) => String(a.date || "9").localeCompare(String(b.date || "9")));
};
/* v732 : données « cuites » pour les indicateurs — la chute ajoutée à la QCB de chaque charge (une seule fois : __cb) */
const condBake = d => {
  if (!d || d.__cb || !d.cond || !Object.keys(d.cond).length) return d;
  const chg = (d.chg || []).map(r => { const c = condChuteRow(d, r); return c ? { ...r, q: (num(r.q) || 0) + c } : r; });
  return { ...d, chg, __cb: 1 };
};

/* v718 (révision des prix) : estimation de la révision avec le planning — formule du contrat (part fixe + pondérations par index),
   hypothèse d'évolution par index (%/an depuis le mois de base), scénario pessimiste (hausse d'un index, et hausse de charges par mot-clé).
   Valeur de chaque désignation client répartie sur les jours de ses tâches ; révision du jour = valeur × (K − 1). */
const sviRevNums = s => String(s || "").split(/[;\n]/).map(x => Number(String(x).replace(/\s/g, "").replace(",", ".")))
  .map(x => isFinite(x) ? x : 0);
const sviRevRow = d => ((d && d.ctr && d.ctr.rows) || []).find(r => r && !r.t && r.type === "rev") || null;
const sviRevEst = (d, pess) => {
  const R = sviRevRow(d); if (!R) return null;
  const D = R.det || {}, P = sviRevNums(D.pond).filter((x, i) => i === 0 || x !== 0);
  if (P.length < 2) return null;
  const a = P[0], W = P.slice(1), H0 = sviRevNums(D.hyps), C0 = sviRevNums(D.choc), h1 = Number(String(D.hyp || "").replace(",", ".")) || 0;
  const H = W.map((_, i) => (H0[i] !== undefined && String(D.hyps || "").trim() ? H0[i] : h1) / 100), C = W.map((_, i) => pess ? (C0[i] || 0) / 100 : 0);
  const n = v => Number(String(v ?? "").replace(/\s/g, "").replace(",", ".")) || 0;
  const per = {}; Object.keys(d.dlp || {}).forEach(k => (d.dlp[k] || []).forEach(p => { if (p.deb) (per[k] = per[k] || []).push([p.deb, p.fin || p.deb]); }));
  const all = Object.values(per).flat().map(x => x[0]).sort(), mb = /^\d{4}-\d{2}/.test(D.mb || "") ? D.mb.slice(0, 7) : (all[0] || "").slice(0, 7);
  if (!mb) return null;
  const [by, bm] = mb.split("-").map(Number);
  const K = day => { const [y, m] = day.split("-").map(Number), t = (y - by) * 12 + (m - bm); return a + W.reduce((s, w, i) => s + w * Math.pow(1 + H[i], Math.max(0, t) / 12) * (1 + C[i]), 0); };
  let rev = 0, val = 0;
  (d.des || []).filter(r => !r.t).forEach(r => {
    const lq = insLinkedQ(d, r.id), V = (lq || n(r.q)) * n(r.p); if (!V) return;
    const days = []; (d.links || []).filter(l => l.des === r.id).forEach(l => (per[l.lot + "|" + l.sec] || []).forEach(([x, y]) => { for (let t = new Date(x + "T12:00:00"); sviIsoOf(t) <= y && days.length < 4000; t.setDate(t.getDate() + 1)) days.push(sviIsoOf(t)); }));
    if (!days.length) return;
    val += V; days.forEach(x => { rev += V / days.length * (K(x) - 1); });
  });
  /* scénario pessimiste : hausse des charges par mot-clé (« CIMENT:10 ; ACIER:5 ») */
  let chgUp = 0;
  if (pess) String(D.pchg || "").split(/[;\n]/).forEach(it => { const m = it.match(/^\s*([^:]+):\s*([\d.,]+)/); if (!m) return; const kw = String(m[1]).trim().toUpperCase(), pc = n(m[2]) / 100;
    (d.chg || []).filter(r => !r.t && String(r.des || "").toUpperCase().includes(kw)).forEach(r => { chgUp += n(r.q) * n(r.p) * pc; }); });
  return { rev, val, chgUp, mb };
};
