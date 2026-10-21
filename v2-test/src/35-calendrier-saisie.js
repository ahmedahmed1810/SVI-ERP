/* =========================================================
   CALENDRIER DE L'APPLICATION (FORMAT 76) : toutes les dates se choisissent dans un calendrier ;
   affichage JJ/MM/AAAA ; les dates refusées sont grisées.
   - champs « date » (ex. type=date) : convertis, .value garde la date AAAA-MM-JJ
   - DÉTAIL DÉLAIS : DÉBUT / FIN (dates hors règles grisées : fin avant début, chevauchement)
   ========================================================= */
const SVI_VAL = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
const SVI_MOIS = ["JANVIER", "FÉVRIER", "MARS", "AVRIL", "MAI", "JUIN", "JUILLET", "AOÛT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DÉCEMBRE"];
const sviIsoOf = dt => dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
function sviDateField(el) {
  if (el.__svDate) return;
  el.__svDate = true;
  const iso0 = SVI_VAL.get.call(el);
  el.type = "text";
  el.readOnly = true;
  el.setAttribute("inputmode", "none");
  el.classList.add("sv-date");
  if (!el.placeholder) el.placeholder = "JJ/MM/AAAA";
  Object.defineProperty(el, "value", {
    configurable: true,
    get() { return el.dataset.iso || ""; },
    set(v) {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
      el.dataset.iso = m ? m[0] : "";
      SVI_VAL.set.call(el, m ? m[3] + "/" + m[2] + "/" + m[1] : "");
    }
  });
  el.value = iso0;
}
function sviCal(anchor, { iso = "", dis = null, onPick }) {
  document.getElementById("svCal")?.remove();
  const box = document.createElement("div");
  box.id = "svCal";
  box.__for = anchor;
  const today = sviIsoOf(new Date());
  let cur = iso ? new Date(iso + "T00:00:00") : new Date();
  if (isNaN(cur)) cur = new Date();
  cur.setDate(1);
  const draw = () => {
    const y = cur.getFullYear(), m = cur.getMonth();
    const first = (new Date(y, m, 1).getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate();
    let cells = "";
    for (let i = 0; i < first; i++) cells += "<span></span>";
    for (let day = 1; day <= n; day++) {
      const di = sviIsoOf(new Date(y, m, day));
      const off = dis ? dis(di) : false;
      cells += `<button type="button" data-d="${di}" class="${di === iso ? "on" : ""}${di === today ? " td" : ""}"${off ? " disabled" : ""}>${day}</button>`;
    }
    box.innerHTML = `<div class="svcal-h"><button type="button" data-m="-1" aria-label="Mois précédent">‹</button><b>${SVI_MOIS[m]} ${y}</b><button type="button" data-m="1" aria-label="Mois suivant">›</button><button type="button" class="svcal-x" data-x aria-label="Fermer">✕</button></div>
      <div class="svcal-w"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
      <div class="svcal-g">${cells}</div>`;
  };
  draw();
  document.body.appendChild(box);
  const r = anchor.getBoundingClientRect(), h = box.offsetHeight, w = box.offsetWidth;
  box.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + "px";
  box.style.top = (r.bottom + 6 + h <= sviViewH() - 8 ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + "px";
  const close = () => { box.remove(); document.removeEventListener("pointerdown", out, true); };
  const out = e => { if (!box.contains(e.target) && e.target !== anchor) close(); };
  setTimeout(() => document.addEventListener("pointerdown", out, true), 0);
  box.addEventListener("click", e => {
    e.stopPropagation();
    const mb = e.target.closest("[data-m]");
    if (mb) { cur.setMonth(cur.getMonth() + Number(mb.dataset.m)); draw(); return; }
    if (e.target.closest("[data-x]")) { close(); return; }
    const db = e.target.closest("[data-d]");
    if (!db || db.disabled) return;
    close();
    onPick && onPick(db.dataset.d);
  });
}
/* ouverture : toucher (ou arrivée du curseur) sur un champ date */
function sviCalOpen(el) {
  if (!el || el.disabled) return;
  const ex = document.getElementById("svCal");
  if (ex && ex.__for === el) return;
  if (el.classList.contains("sv-date")) {
    const mn = el.getAttribute("min") || "", mx = el.getAttribute("max") || "";
    sviCal(el, { iso: el.value, dis: d => (mn && d < mn) || (mx && d > mx), onPick: d => {
      el.value = d;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } });
    return;
  }
  if (el.matches("input.dlp-in[data-f=deb], input.dlp-in[data-f=fin]") && window.__sviDlyCal) {
    const o = window.__sviDlyCal(el);
    if (!o) return;
    sviCal(el, { iso: o.iso, dis: o.dis, onPick: d => {
      let t = el;
      if (!t.isConnected) t = document.querySelector(`${el.classList.contains("dlw-in") ? "#dlyAddW " : ""}input.dlp-in[data-task="${CSS.escape(el.dataset.task || "")}"][data-f="${el.dataset.f}"]`) || el;
      SVI_VAL.set.call(t, d.slice(8, 10) + "/" + d.slice(5, 7) + "/" + d.slice(0, 4));
      t.dispatchEvent(new Event("change", { bubbles: true }));
    } });
  }
}
document.addEventListener("click", e => {
  const el = e.target.closest && e.target.closest("input.sv-date, input.dlp-in[data-f=deb], input.dlp-in[data-f=fin]");
  if (el) sviCalOpen(el);
});
document.addEventListener("focusin", e => {
  const el = e.target.closest && e.target.closest("input.sv-date, input.dlp-in[data-f=deb], input.dlp-in[data-f=fin]");
  if (el) setTimeout(() => { if (document.activeElement === el) sviCalOpen(el); }, 0);
});
/* tout champ date ajouté à l'écran passe au calendrier de l'application */
(() => {
  const up = root => (root.querySelectorAll ? root.querySelectorAll('input[type="date"]') : []).forEach(sviDateField);
  const mo = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) { if (n.matches && n.matches('input[type="date"]')) sviDateField(n); else up(n); } })));
  const go = () => { up(document); mo.observe(document.body, { childList: true, subtree: true }); };
  if (document.body) go(); else document.addEventListener("DOMContentLoaded", go);
})();


/* =========================================================
   FORMAT 93 : Entrée et Tab = case saisissable suivante (Maj + Tab = précédente), partout ;
   cases grisées sautées ; dans une fenêtre, Entrée ne valide jamais toute seule ;
   IMPORT NON CRÉÉ : case encadrée (fautive) suivante
   ========================================================= */
/* v491 (remarque 5) : dans les tableaux, comme Excel / Google Sheets — Tab = case à droite, Entrée = case du dessous
   (dans la colonne où la suite de Tab a commencé ; s'il n'y a pas de ligne dessous, case suivante comme avant),
   Maj + Entrée = au-dessus ; flèches haut / bas = ligne voisine, gauche / droite = case voisine au bord du texte */
let sviTabStart = null;
const sviGridBox = el => el.closest("table.ins-table, table.dly-table, table.prm-table");
const sviGridOk = x => x && x.offsetParent !== null && !x.disabled && !x.readOnly && !x.matches('[type="checkbox"], [type="radio"], [type="file"], [type="hidden"]');
const sviGridCell = (tr, ci, dir) => {
  for (let t = dir > 0 ? tr.nextElementSibling : tr.previousElementSibling; t; t = dir > 0 ? t.nextElementSibling : t.previousElementSibling) {
    const td = t.cells && t.cells[ci];
    const x = td && [...td.querySelectorAll("input, select, textarea")].find(sviGridOk);
    if (x) return x;
  }
  return null;
};
const sviGo = nx => { try { window.__sviLastGo = { k: window.sviCellKey ? window.sviCellKey(nx) : null, t: performance.now() }; } catch (e) {} nx.focus(); try { if (nx.matches("input:not(.sv-date):not(.dlp-in)") && !nx.classList.contains("svi-nav")) nx.select(); } catch (err) {} sviKeepVisible(nx); };
/* v497 (remarques 30 et 33) : les flèches sont gérées par le mode « case sélectionnée » (comme Google Sheets), plus bas */
document.addEventListener("keydown", e => {
  if (e.key !== "Enter" && e.key !== "Tab") return;
  const el = e.target;
  if (!el || !el.matches || !el.matches("input, select, textarea.ins-in")) return;
  if (el.matches('[type="checkbox"], [type="radio"], [type="file"], .cf-q') || el.closest("#cfMenu, #svCal")) return;
  if (el.closest(".ins-hcol .ins-li")) return;   /* v512 : listes du bloc TÂCHES — gérées par le mécanisme commun (Entrée = dessous) */
  /* tableaux : Entrée descend */
  { const box = sviGridBox(el), td = el.closest("td"), tr = el.closest("tr");
    if (box && td && tr) {
      if (e.key === "Tab") { if (!sviTabStart || sviTabStart.tr !== tr) sviTabStart = { tr, ci: td.cellIndex }; }
      else {
        const ci = sviTabStart && sviTabStart.tr === tr ? sviTabStart.ci : td.cellIndex;
        sviTabStart = null;
        const nx = sviGridCell(tr, ci, e.shiftKey ? -1 : 1);
        if (nx) { e.preventDefault(); sviGo(nx); return; }
        if (e.shiftKey) { e.preventDefault(); return; }
      }
    } }
  const back = e.key === "Tab" && e.shiftKey;
  const ok = x => x.offsetParent !== null && !x.disabled && !(x.readOnly && !x.classList.contains("sv-date") && !x.classList.contains("dlp-in")) && !x.matches('[type="checkbox"], [type="radio"], [type="file"], [type="hidden"]');
  let list = null;
  const inc = el.closest(".inc-table");
  if (inc) {
    list = [...inc.querySelectorAll("td.inc-bad input.inc-in")].filter(ok);
    if (!list.includes(el)) list = [...inc.querySelectorAll("input.inc-in")].filter(x => ok(x) && (x === el || x.closest("td.inc-bad")));
  } else {
    const box = el.closest("table.ins-table, .ins-hcol, .dly-table, .prm-table, .svc-card, .doc-card, .blk-card, .modal-card, form, #docPop, .view");
    if (!box) return;
    list = [...box.querySelectorAll("input, select, textarea")].filter(x => x === el || ok(x));
  }
  const i = list.indexOf(el);
  const nx = list[i + (back ? -1 : 1)];
  e.preventDefault();
  if (!nx) return;
  if (inc) { const tr = nx.closest("tr[data-inc]"); const sh = inc.closest(".novapp-list-shell") || document.body; sh.__incNext = { id: tr && tr.dataset.inc, f: nx.dataset.f, t: Date.now() }; }
  try { window.__sviLastGo = { k: window.sviCellKey ? window.sviCellKey(nx) : null, t: performance.now() }; } catch (e) {}
  nx.focus();
  try { if (nx.matches("input:not(.sv-date):not(.dlp-in)") && !nx.classList.contains("svi-nav")) nx.select(); } catch (err) {}
  sviKeepVisible(nx);
}, true);
/* v491 (remarque 1) : la case où l'on saisit reste visible — si elle est cachée (bas du tableau, clavier de l'iPad),
   le tableau remonte juste assez ; si elle est déjà visible, rien ne bouge */
/* v497 (remarque 30) : la case reste visible partout — dans le tableau (jamais sous l'en-tête ni sous la ligne TOTAL fixées),
   puis dans la page (au-dessus du clavier ou de la barre de raccourcis de l'iPad) */
const sviKeepVisible = el => {
  if (!el || !el.isConnected || el.offsetParent === null) return;
  const td = (el.closest && el.closest("td, th")) || el;
  let sc = td.parentElement;
  while (sc && sc !== document.body && sc !== document.documentElement) {
    const cs = getComputedStyle(sc);
    if ((/(auto|scroll)/.test(cs.overflowY) && sc.scrollHeight > sc.clientHeight + 1) || (/(auto|scroll)/.test(cs.overflowX) && sc.scrollWidth > sc.clientWidth + 1)) break;
    sc = sc.parentElement;
  }
  const tbl = td.closest && td.closest("table");
  const stuck = (row, side) => { const c = row && row.cells && row.cells[0]; if (!c) return 0; const cs = getComputedStyle(c); return cs.position === "sticky" ? row.getBoundingClientRect().height : 0; };
  if (sc && sc !== document.body && sc !== document.documentElement) {
    const R = sc.getBoundingClientRect(), r = td.getBoundingClientRect();
    const hd = tbl && tbl.tHead ? [...tbl.tHead.rows].reduce((t, x) => t + stuck(x), 0) : 0;
    const ft = tbl && tbl.tFoot ? [...tbl.tFoot.rows].reduce((t, x) => t + stuck(x), 0) : 0;
    const hsb = sc.offsetHeight - sc.clientHeight;
    const top = R.top + hd, bot = R.bottom - hsb - ft;
    if (r.bottom > bot - 1) sc.scrollTop += r.bottom - bot + 4;
    else if (r.top < top + 1) sc.scrollTop -= top - r.top + 4;
    if (r.width < R.width) { if (r.right > R.right - 1) sc.scrollLeft += r.right - R.right + 6; else if (r.left < R.left + 1) sc.scrollLeft -= R.left - r.left + 6; }
  }
  const vv = window.visualViewport, coarse = matchMedia("(pointer: coarse)").matches;
  const bottom = (vv ? vv.offsetTop + vv.height : window.innerHeight) - (coarse ? 80 : 10);
  let top = vv ? vv.offsetTop : 0;
  const tb = document.querySelector(".topbar");
  if (tb && /sticky|fixed/.test(getComputedStyle(tb).position)) top = Math.max(top, tb.getBoundingClientRect().bottom);
  const r = td.getBoundingClientRect();
  if (r.bottom > bottom) window.scrollBy(0, r.bottom - bottom + 30);
  else if (r.top < top + 4) window.scrollBy(0, r.top - top - 40);
};
{
  let raf = 0;
  const SEL = ".ins-table input, .ins-table textarea, .ins-hcol input, .sd-t input, .dly-table input, .qq-table input, .inc-table input, .prm-table input";
  const run = e => { const el = e.target; if (!el || !el.matches || !(el.matches(SEL) || el.matches("td.svi-tdf"))) return; cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setTimeout(() => sviKeepVisible(document.activeElement === el ? el : document.activeElement), 60)); };
  document.addEventListener("focusin", run);
  document.addEventListener("input", run);
}
/* clavier de l'iPad : touche « Suivant » */
document.addEventListener("focusin", e => {
  const el = e.target;
  if (el && el.matches && el.matches("input:not([type=checkbox]):not([type=radio])") && !el.getAttribute("enterkeyhint")) el.setAttribute("enterkeyhint", "next");
});

/* FORMAT 30 : double toucher sur la barre de titre d'un bloc (ou sa rangée d'onglets) = agrandir / réduire ;
   sur le titre d'une grande fenêtre réglable = plein écran / taille mémorisée.
   Jamais sur les boutons, cases, en-têtes de colonnes, en-tête du Gantt ni dans les lignes. */
(() => {
  let last = null;
  document.addEventListener("pointerup", e => {
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest("input, textarea, select, .blk-tools, .cf-btn, [data-onlyc], .col-rs, th, .gh, .blk-grip, .blk-rsz")) { last = null; return; }
    let zone = "", act = null;
    const head = t.closest(".blk-head, .bdg-d-block-title, .bdg-d-tabs");
    if (head) {
      const blk = head.closest(".bdg-d-block"), mb = head.querySelector(".blk-max-btn[data-blk]") || (blk && blk.querySelector(".blk-max-btn[data-blk]"));
      if (mb) { const b = mb.dataset.blk; zone = "b:" + b; act = () => { const m = document.querySelector(`.blk-max-btn[data-blk="${b}"]`); if (m) m.click(); }; }
    } else {
      const tt = t.closest(".svc-card .svc-t"), card = tt && tt.closest(".svc-card");
      if (card && card.querySelector('[class$="-rsz"]')) { zone = "w"; act = () => card.classList.toggle("svc-full"); }
    }
    if (!zone) { last = null; return; }
    const now = Date.now();
    if (last && last.zone === zone && now - last.t < 380 && Math.abs(e.clientX - last.x) < 30 && Math.abs(e.clientY - last.y) < 30) { last = null; act(); }
    else last = { zone, t: now, x: e.clientX, y: e.clientY };
  });
})();

/* =========================================================
   FORMAT 17 dans les fenêtres PRÉDÉCESSEURS et AJOUTER UNE TÂCHE (16/10/2026) :
   poignée au bord droit de chaque en-tête — LOT = largeur des deux volets ; ACTIVITÉ SECONDAIRE,
   TYPE, DÉCALAGE (J) = largeur de la colonne (le volet défile s'il devient trop large) ; mémorisé
   ========================================================= */
const SVI_DPK_COLS = "svi_dpk_cols_v1";
function sviDpkColsGet() { try { return JSON.parse(localStorage.getItem(SVI_DPK_COLS) || "{}") || {}; } catch (e) { return {}; } }
function sviDpkCols(root) {
  const W = sviDpkColsGet();
  const cols = root.querySelector(".dpk-cols");
  if (cols && W.split) cols.style.gridTemplateColumns = W.split + "px minmax(160px, 1fr)";
  const t = root.querySelectorAll(".dpk-t")[1];
  if (!t) return;
  const ths = [...t.querySelectorAll("thead th")];
  const pre = root.id === "dlyAddW" ? "a_" : "p_";
  const keyOf = th => pre + (th.querySelector('.col-rs[data-rs="dpk_sec"]') ? "sec" : th.classList.contains("dpk-ty") ? "ty" : th.classList.contains("dpk-of") ? "of" : "x");
  if (!ths.some(th => W[keyOf(th)])) return;
  let total = 0;
  ths.forEach(th => {
    const k = keyOf(th), w = W[k] || (k === pre + "sec" ? 0 : th.getBoundingClientRect().width || 36);
    if (k === pre + "sec" && !w) { th.style.width = ""; return; }
    th.style.width = w + "px"; total += w;
  });
  if (ths.every(th => th.style.width)) t.style.setProperty("width", total + "px", "important");
}
document.addEventListener("pointerdown", e => {
  const h = e.target.closest && e.target.closest(".dpk-card .col-rs");
  if (!h) return;
  e.preventDefault(); e.stopPropagation();
  const root = h.closest("#svConf, #dlyAddW"), rs = h.dataset.rs, x0 = e.clientX;
  const W = sviDpkColsGet();
  const cols = root.querySelector(".dpk-cols");
  const t = h.closest("table"), th = h.closest("th");
  h.classList.add("on");
  let apply;
  if (rs === "dpk_lot") {
    const w0 = root.querySelector(".dpk-col").getBoundingClientRect().width, cw = cols.getBoundingClientRect().width;
    apply = x => { W.split = Math.round(Math.max(120, Math.min(cw - 170, w0 + x - x0))); cols.style.gridTemplateColumns = W.split + "px minmax(160px, 1fr)"; };
  } else {
    const pre = root.id === "dlyAddW" ? "a_" : "p_";
    const k = pre + (rs === "dpk_sec" ? "sec" : rs === "dpk_ty" ? "ty" : "of");
    /* largeurs actuelles figées, puis la colonne tirée change seule */
    const ths = [...t.querySelectorAll("thead th")];
    const ws = ths.map(x => x.getBoundingClientRect().width);
    ths.forEach((x, i) => { x.style.width = ws[i] + "px"; });
    const i0 = ths.indexOf(th), w0 = ws[i0];
    apply = x => {
      const w = Math.round(Math.max(k.endsWith("sec") ? 120 : 60, w0 + x - x0));
      W[k] = w; th.style.width = w + "px";
      ths.forEach((y, i) => { const kk = y.querySelector('.col-rs[data-rs="dpk_sec"]') ? "sec" : y.classList.contains("dpk-ty") ? "ty" : y.classList.contains("dpk-of") ? "of" : ""; if (kk && pre + kk !== k && !W[pre + kk]) W[pre + kk] = Math.round(kk === "sec" ? Math.max(120, ws[i]) : ws[i]); });
      t.style.setProperty("width", ths.reduce((sum, y) => sum + (parseFloat(y.style.width) || 0), 0) + "px", "important");
    };
  }
  const mv = ev => { ev.preventDefault(); apply(ev.clientX); };
  const up = () => {
    document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
    h.classList.remove("on");
    try { localStorage.setItem(SVI_DPK_COLS, JSON.stringify(W)); } catch (err) {}
    /* le « clic » qui suit le glissement ne ferme pas la fenêtre et ne choisit rien */
    const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
    document.addEventListener("click", stop, { capture: true, once: true });
    setTimeout(() => document.removeEventListener("click", stop, { capture: true }), 350);
  };
  document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
}, true);

/* FORMAT 64 : superposition dans le PLANNING / Gantt = ligne visée en jaune, comme DÉSIGNATIONS CLIENT ; bande jaune sur la ligne de la barre */
document.addEventListener("pointerup", () => setTimeout(() => document.querySelectorAll(".gb-grp.gb-grp-tgt").forEach(n => n.classList.remove("gb-grp-tgt")), 0), true);
document.addEventListener("pointercancel", () => document.querySelectorAll(".gb-grp.gb-grp-tgt").forEach(n => n.classList.remove("gb-grp-tgt")), true);
function sviDlyRoSync() {
  document.querySelectorAll(".g-ro-band").forEach(b => b.remove());
  const tr = document.querySelector(".dlyg-l tr.ro-on"), body = document.querySelector("#dlyGantt .gbody");
  const onG = !!window.__sviDlySrcG;
  document.querySelectorAll(".dlyg").forEach(x => x.classList.toggle("dly-src-g", onG));
  if (!tr || !body || !onG) return;
  const r = tr.getBoundingClientRect(), g = body.getBoundingClientRect();
  const b = document.createElement("div");
  b.className = "g-ro-band"; b.style.top = (r.top - g.top) + "px"; b.style.height = r.height + "px";
  body.insertBefore(b, body.firstChild);
}
/* =========================================================
   DERNIÈRE VUE (v448) : à l'ouverture de n'importe quelle interface, on retrouve la dernière vue —
   défilement de la page, des blocs, du tableau et du Gantt du PLANNING, largeur tableau / Gantt.
   Mémorisé par budget (« bdg:<réf> ») et par écran (« view:<module> »).
   ========================================================= */
(() => {
  const KEY = "svi_vstate_v1";
  const SEL = ".bdg-d-client-scroll, .bdg-h-col, .ins-hcol, .bdg-d-tabbody .bdg-d-scroll, .bdg-d-tabbody .dlyg-l, .bdg-d-tabbody .dlyg-r, #dlyGantt, .rec-scroll, .table-wrap, .chs-scroll";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } };
  const shellOf = () => [...document.querySelectorAll(".novapp-list-shell")].find(x => x.offsetParent !== null) || null;
  const els = () => { const root = shellOf() || document.querySelector(".view.active-view") || document; return [...root.querySelectorAll(SEL)]; };
  let restoring = 0, saveT = null;
  const save = () => {
    const k = window.__sviCtx;
    if (!k || Date.now() < restoring) return;
    const all = load();
    const sh = shellOf();
    const o = { y: Math.round(window.scrollY), s: els().map(e => [Math.round(e.scrollTop), Math.round(e.scrollLeft)]), t: Date.now() };
    /* largeur du tableau gardée telle qu'elle est (choisie à la poignée, ou calculée à la 1re ouverture) : la prochaine ouverture la reprend sans recalcul */
    if (sh && sh.__dlygW && typeof sh.__dlygW.w === "number") o.w = sh.__dlygW.w;
    if (sh && sh.__dlygPrevW) o.pw = sh.__dlygPrevW;
    { const gg = document.querySelector("#dlyGantt"); if (gg) o.gx = Math.round(gg.scrollLeft); }
    all[k] = o;
    /* 80 vues au plus (les plus anciennes oubliées) */
    const ks = Object.keys(all);
    if (ks.length > 80) ks.sort((a, b) => (all[a].t || 0) - (all[b].t || 0)).slice(0, ks.length - 80).forEach(x => delete all[x]);
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {}
  };
  const later = () => { clearTimeout(saveT); saveT = setTimeout(save, 350); };
  document.addEventListener("scroll", later, true);
  window.addEventListener("pagehide", save);
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
  /* le doigt reprend la main : la restauration s'arrête */
  const stop = () => { restoring = 0; };
  ["touchstart", "wheel", "pointerdown", "keydown"].forEach(t => document.addEventListener(t, stop, { capture: true, passive: true }));
  window.__sviViewSave = save;
  window.__sviViewGet = k => load()[k] || null;
  window.__sviViewRestore = k => {
    window.__sviCtx = k;
    const o = load()[k];
    const until = Date.now() + 2200;
    restoring = until;
    const apply = () => {
      if (restoring !== until) return;
      if (!o) { window.scrollTo(window.scrollX, 0); return; }
      els().forEach((e, i) => { const v = o.s && o.s[i]; if (v) { e.scrollTop = v[0]; e.scrollLeft = v[1]; } });
      window.scrollTo(window.scrollX, o.y || 0);
    };
    [30, 250, 700, 1300, 2000].forEach(ms => setTimeout(apply, ms));
    setTimeout(() => { if (restoring === until) restoring = 0; }, 2250);
  };
})();

/* =========================================================
   FORMAT 116 (v460) : toucher ailleurs = ENTRÉE, partout.
   Sur iPad, toucher une zone non saisissable ne quitte pas la case : la saisie restait en suspens.
   Un vrai toucher (sans glisser) hors de la case en cours la valide (perte du focus → enregistrement
   comme par ENTRÉE), puis ce qui a été touché agit. Défilement : rien. ✕ / FERMER / ANNULER : saisie
   abandonnée. Saisie refusée (message affiché) : la case reste, le toucher n'agit pas.
   ========================================================= */
(() => {
  const TXT = 'input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]), textarea';
  const CANCEL = '[data-x], .svc-close, [data-cancel], button[data-v=""], button[data-r="0"]';
  const KEEP = "#svCal, #cfMenu, #svToast, .unit-sug, datalist";
  let st = null;
  const toastOn = () => { const t = document.getElementById("svToast"); return !!(t && t.classList.contains("on")) ? t.querySelector(".svt-m").textContent : ""; };
  document.addEventListener("pointerdown", e => {
    st = null;
    const a = document.activeElement, t = e.target;
    if (!a || !a.matches || !a.matches(TXT) || a.readOnly || !t || !t.closest) return;
    if (a === t || a.contains(t) || t.closest(KEEP)) return;
    /* fermer / annuler : ce qui était tapé est abandonné */
    if (t.closest(CANCEL)) { if (a.value !== a.defaultValue) a.value = a.defaultValue; return; }
    /* une autre case saisissable : le navigateur change lui-même de case (enregistrement normal) */
    if (t.matches(TXT + ", select") && !t.readOnly) return;
    st = { a, t, x: e.clientX, y: e.clientY, toast: toastOn() };
  }, true);
  document.addEventListener("pointermove", e => { if (st && Math.hypot(e.clientX - st.x, e.clientY - st.y) > 10) st = null; }, true);
  document.addEventListener("pointercancel", () => { st = null; }, true);
  document.addEventListener("pointerup", () => {
    if (!st) return;
    const { a, toast } = st; st = null;
    if (!a.isConnected || document.activeElement !== a) return;
    const v0 = a.value;
    a.blur();
    /* refusée : un message vient d'apparaître et la case garde sa saisie → on y reste, le toucher n'agit pas */
    const msg = toastOn();
    if (msg && msg !== toast && a.isConnected && a.value === v0 && v0 !== a.defaultValue) {
      const stop = ev => { ev.preventDefault(); ev.stopPropagation(); };
      document.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => document.removeEventListener("click", stop, true), 400);
      setTimeout(() => { if (a.isConnected) a.focus(); }, 0);
    }
  }, true);
})();

/* =========================================================
   FORMAT 121 (v471) : cases de nombre — chiffres seulement, dès la frappe, partout.
   inputmode="decimal" : chiffres + une virgule (ou un point) ; inputmode="numeric" : chiffres seuls ;
   « − » seulement si la case porte data-neg. Espaces (séparateurs de milliers) tolérés.
   Tout autre caractère (frappe ou collage) est retiré aussitôt, avec un court message près de la case.
   ========================================================= */
document.addEventListener("input", e => {
  const el = e.target;
  if (!el || el.tagName !== "INPUT" || el.readOnly) return;
  const m = el.getAttribute("inputmode");
  if (m !== "decimal" && m !== "numeric") return;
  const v0 = el.value, dec = m === "decimal", neg = el.hasAttribute("data-neg");
  let out = "", sep = false, bad = false;
  for (let i = 0; i < v0.length; i++) {
    const c = v0[i];
    if (/[0-9]/.test(c) || c === " " || c === " " || c === " ") { out += c; continue; }
    if (dec && (c === "," || c === ".") && !sep) { sep = true; out += c; continue; }
    if (neg && (c === "-" || c === "−") && !out.trim()) { out += "-"; continue; }
    bad = true;
  }
  if (!bad) return;
  let pos = 0;
  try { pos = Math.max(0, (el.selectionStart || 0) - (v0.length - out.length)); } catch (err) {}
  el.value = out;
  try { el.setSelectionRange(pos, pos); } catch (err) {}
  if (typeof svToast === "function") svToast(dec ? "CHIFFRES SEULEMENT (UNE VIRGULE PERMISE)." : "CHIFFRES SEULEMENT.", 2200, el);
}, true);

/* =========================================================
   v512 (remarques 76 à 81) : MÉCANISME COMMUN À TOUS LES TABLEAUX (une seule règle, branchée partout)
   Tableaux couverts : DÉSIGNATIONS CLIENT, DÉTAIL CHARGES, DÉTAIL PRODUITS (table.ins-table), DÉTAIL QUALITÉ (qq-table),
   DÉTAIL DÉLAIS (dly-table), IMPORT NON CRÉÉ (inc-table), SAISIE DIRECTE (sd-t), planning (prm-table)
   ET les listes du bloc TÂCHES : LOT, ACTIVITÉ PRIMAIRE, ACTIVITÉ SECONDAIRE (.ins-hcol, une ligne = .ins-li).
   Une « cellule » = la case d'un tableau (td) ou, dans une liste, la case de saisie (intitulé) ou la case d'unité (.act-u).
   ========================================================= */
const SVI_TS = "table.ins-table, table.sd-t, table.dly-table, table.inc-table, table.prm-table, table.qq-table";
const SVI_ED = 'input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]):not(.sv-date):not(.dlp-in), textarea.ins-in';
/* cellule d'un élément (ou null) */
const sviCellOf = el => {
  if (!el || !el.closest) return null;
  const td = el.closest("td");
  if (td && td.closest(SVI_TS) && td.closest("tbody")) return td;
  const li = el.closest(".ins-hcol .ins-li");
  if (!li) return null;
  const u = el.closest(".act-u");
  if (u) return u;
  return el.matches && el.matches("input.ins-in, input.lot-gname") ? el : null;
};
const sviCellInput = c => !c ? null : c.matches && c.matches(SVI_ED) ? c : c.querySelector(SVI_ED);
/* lignes visibles et cellules d'une ligne */
const sviGridRows = c => {
  if (c.tagName === "TD") { const tb = c.closest("tbody"); return [...tb.rows].filter(tr => tr.offsetParent !== null); }
  const col = c.closest(".ins-hcol"); return [...col.querySelectorAll(".ins-li")].filter(r => r.offsetParent !== null);
};
const sviRowOf = c => c.tagName === "TD" ? c.parentElement : c.closest(".ins-li");
const sviRowCells = (row, td) => {
  if (td) return [...row.cells];
  const out = [];
  row.querySelectorAll("input.ins-in, input.lot-gname").forEach(i => { const c = sviCellOf(i); if (c && !out.includes(c) && c.offsetParent !== null) out.push(c); });
  return out;
};
/* une cellule qu'on peut sélectionner (saisissable ou grisée, pas une case à cocher ni un rond) */
const sviCellOk = c => !!c && c.offsetParent !== null && (c.tagName !== "TD" || (!c.querySelector('input[type=checkbox], .lk-rd') && !c.classList.contains("ins-rdc") && !c.classList.contains("ins-delc") && !c.classList.contains("sd-cbc")));
/* cellule voisine : dr = lignes (±1), dc = colonnes (±1) */
const sviNear = (c, dr, dc) => {
  const td = c.tagName === "TD", row = sviRowOf(c), R = sviGridRows(c);
  const cells = sviRowCells(row, td);
  let ci = td ? c.cellIndex : cells.indexOf(c);
  if (dc) {
    if (td) { for (let k = ci + dc; k >= 0 && k < row.cells.length; k += dc) if (sviCellOk(row.cells[k])) return row.cells[k]; return null; }
    const x = cells[ci + dc]; return x || null;
  }
  for (let r = R.indexOf(row) + dr; r >= 0 && r < R.length; r += dr) {
    if (td) { const x = R[r].cells[ci]; if (x && sviCellOk(x)) return x; continue; }
    const cs = sviRowCells(R[r], false); if (!cs.length) continue;
    /* même champ (intitulé / unité) dans la ligne voisine */
    const f = (sviCellInput(c) || {}).dataset?.f;
    return cs.find(x => (sviCellInput(x) || {}).dataset?.f === f) || cs[Math.min(ci, cs.length - 1)];
  }
  return null;
};
/* clé d'une cellule (pour la retrouver après un redessin) */
const sviCellKey = el => {
  const c = sviCellOf(el); if (!c) return null;
  const inp = sviCellInput(c), f = inp && inp.dataset ? inp.dataset.f || "" : "";
  if (c.tagName === "TD") {
    const tbl = c.closest("table"), tr = c.parentElement;
    const tsel = tbl.id ? "#" + tbl.id : tbl.dataset.ik ? `table.ins-table[data-ik="${tbl.dataset.ik}"]` : tbl.classList.contains("sd-t") ? "#sdW table.sd-t" : tbl.classList.contains("inc-table") ? "table.inc-table" : tbl.classList.contains("dly-table") ? "table.dly-table" : tbl.classList.contains("qq-table") ? "table.qq-table" : tbl.classList.contains("prm-table") ? "table.prm-table" : "";
    const rk = tr.dataset.iid ? `[data-iid="${tr.dataset.iid}"]` : tr.dataset.grp ? `[data-grp="${tr.dataset.grp}"]` : tr.dataset.inc ? `[data-inc="${tr.dataset.inc}"]` : tr.dataset.lid ? `[data-lid="${tr.dataset.lid}"]` : `:nth-child(${tr.sectionRowIndex + 1})`;
    return tsel && rk ? { t: tsel, row: "tr" + rk, ci: c.cellIndex, f, td: el.tagName === "TD" } : null;
  }
  const col = c.closest(".ins-hcol"), li = c.closest(".ins-li");
  return { t: `.ins-hcol[data-ik="${col.dataset.ik}"]`, row: ".ins-li" + (li.dataset.iid ? `[data-iid="${li.dataset.iid}"]` : li.dataset.path ? `[data-path="${li.dataset.path}"]` : ".ins-new"), f, list: true };
};
const sviCellFind = k => {
  if (!k) return null;
  const box = document.querySelector(k.t); if (!box) return null;
  const row = box.querySelector(k.row); if (!row) return null;
  if (k.list) return row.querySelector(k.f ? `[data-f="${k.f}"]` : "input.ins-in, input.lot-gname");
  const td = row.cells && row.cells[k.ci]; if (!td) return null;
  if (k.td) return td;
  return (k.f && td.querySelector(`[data-f="${k.f}"]`)) || td.querySelector(SVI_ED) || td;
};
window.sviCellKey = sviCellKey; window.sviCellFind = sviCellFind; window.sviCellOf = sviCellOf;

/* CADRE ET POINT de la cellule active : posés PAR-DESSUS la cellule (jamais masqués par un fond, un titre ou l'en-tête),
   sur toute la cellule ; ils suivent le défilement et disparaissent dès qu'il n'y a plus de cellule active visible */
const sviCellVis = c => {
  if (!c || !c.isConnected || c.offsetParent === null) return null;
  const r = c.getBoundingClientRect();
  let top = 0, bottom = window.innerHeight, left = 0, right = window.innerWidth;
  /* bandeau du budget et barre du haut (fixés) */
  const inModal = !!c.closest("#sdW:not(.sd-inplace), #docPop, #blkPop, .svc-wrap") || (!!c.closest("[role=dialog]") && !c.closest(".sd-inplace"));
  if (!inModal) document.querySelectorAll(".topbar, .bdg-d-sticky").forEach(b => { const br = b.getBoundingClientRect(); if (br.height && br.top <= 1 && /sticky|fixed/.test(getComputedStyle(b).position)) top = Math.max(top, br.bottom); });
  /* conteneur défilant et son en-tête fixé */
  const sc = c.closest(".bdg-d-scroll, .sd-scroll, .bdg-h-col, .bdg-d-client-scroll");
  if (sc) { const R = sc.getBoundingClientRect(); top = Math.max(top, R.top); bottom = Math.min(bottom, R.bottom); left = Math.max(left, R.left); right = Math.min(right, R.right); }
  const tbl = c.closest("table");
  if (tbl && tbl.tHead) { const hr = tbl.tHead.getBoundingClientRect(); if (hr.bottom > top && hr.top <= top + 2) top = Math.max(top, hr.bottom); }
  if (tbl && tbl.tFoot && tbl.tFoot.rows[0] && getComputedStyle(tbl.tFoot.rows[0].cells[0] || tbl.tFoot).position === "sticky") { const fr = tbl.tFoot.getBoundingClientRect(); if (fr.top < bottom) bottom = Math.min(bottom, fr.top); }
  const hd = c.closest(".ins-hcol") && c.closest(".ins-hcol").querySelector(".bdg-h-head");
  if (hd) { const hr = hd.getBoundingClientRect(); if (hr.bottom > top) top = Math.max(top, hr.bottom); }
  const T = Math.max(r.top, top), B = Math.min(r.bottom, bottom), L = Math.max(r.left, left), Rr = Math.min(r.right, right);
  if (B - T < 4 || Rr - L < 4) return null;
  return { top: T, bottom: B, left: L, right: Rr, full: r };
};
let SVI_FR = null;
const sviFrame = () => {
  const a = document.activeElement, c = sviCellOf(a);
  if (!SVI_FR) { SVI_FR = document.createElement("div"); SVI_FR.id = "sviSelFrame"; document.body.appendChild(SVI_FR); }
  const v = c && sviCellVis(c);
  if (!v) { SVI_FR.style.display = "none"; return; }
  const col = (getComputedStyle(c).getPropertyValue("--inst") || "").trim() || "#111827";
  /* au-dessus d'une fenêtre (SAISIE DIRECTE en fenêtre, fenêtres d'import…) quand la cellule y est */
  SVI_FR.style.zIndex = (c.closest("#sdW:not(.sd-inplace), #docPop, #blkPop, .svc-wrap") || (c.closest("[role=dialog]") && !c.closest(".sd-inplace"))) ? "10096" : "45";
  if (window.__sviHandleZ) window.__sviHandleZ(SVI_FR.style.zIndex === "45" ? "46" : "10097");
  Object.assign(SVI_FR.style, { display: "block", left: (v.left + window.scrollX) + "px", top: (v.top + window.scrollY) + "px", width: (v.right - v.left) + "px", height: (v.bottom - v.top) + "px", borderColor: col });
};
window.sviFrame = sviFrame;
{
  let q = 0; const go = () => { q = 0; try { sviFrame(); if (window.__sviHandle) window.__sviHandle(); } catch (e) {} };
  const later = () => { if (!q) q = requestAnimationFrame(go); };
  ["focusin", "focusout", "scroll", "resize", "pointerup", "keyup"].forEach(t => (t === "resize" ? window : document).addEventListener(t, () => setTimeout(later, 0), true));
  new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true });
}

/* =========================================================
   v491 (remarque 6) : SÉLECTION DE PLUSIEURS CASES, comme Excel / Google Sheets — dans tous les tableaux de saisie
   clavier : Maj + toucher (ou Maj + flèches) = plage depuis la case active ; Commande (Ctrl) + toucher = ajoute / retire une case ;
   au doigt : petite poignée ronde au coin de la case active, à tirer pour étendre la plage.
   Commande + C = copier la sélection (tableau, pour Excel / Google Sheets) ; SAISIE DIRECTE : Commande + V = coller à partir
   du coin haut gauche, Effacer (⌫) = vider les cases sélectionnées
   ========================================================= */
(() => {
  const TSEL = "table.ins-table, table.sd-t, table.dly-table, table.qq-table, table.inc-table, table.prm-table";
  const S = { tbl: null, a: null, b: null, extra: new Set(), cut: new Set() };
  const posOf = td => { const tr = td.closest("tr"); return tr && tr.parentElement && tr.parentElement.tagName === "TBODY" ? { r: tr.sectionRowIndex, c: td.cellIndex } : null; };
  const tdAt = (tbl, r, c) => { const tr = tbl.tBodies[0] && tbl.tBodies[0].rows[r]; return tr ? tr.cells[c] || null : null; };
  const cells = () => {
    if (!S.tbl || !S.a) return [];
    const out = [], b = S.b || S.a;
    if (S.b) for (let r = Math.min(S.a.r, b.r); r <= Math.max(S.a.r, b.r); r++) for (let c = Math.min(S.a.c, b.c); c <= Math.max(S.a.c, b.c); c++) { const td = tdAt(S.tbl, r, c); if (td) out.push(td); }
    S.extra.forEach(k => { const [r, c] = k.split(":").map(Number); const td = tdAt(S.tbl, r, c); if (td && !out.includes(td)) out.push(td); });
    if (!out.length) { const td = tdAt(S.tbl, S.a.r, S.a.c); if (td) out.push(td); }
    return out;
  };
  const paint = () => {
    document.querySelectorAll("td.svi-cs").forEach(td => td.classList.remove("svi-cs"));
    const C = cells();
    if (C.length > 1) C.forEach(td => td.classList.add("svi-cs"));
    handle();
  };
  const clear = () => { S.b = null; S.extra.clear(); paint(); };
  /* poignée ronde (doigt) au coin bas droit de la dernière case de la plage */
  let H = null;
  const handle = () => {
    /* v512 (remarques 73, 80, 81) : point au coin de la cellule active (tableaux ET listes du bloc TÂCHES), ou de la fin de la plage ;
       seulement s'il y a une cellule active visible */
    const act = document.activeElement, cell = sviCellOf(act);
    if (!cell || !matchMedia("(pointer: coarse)").matches) { if (H) H.style.display = "none"; return; }
    const td = cell.tagName === "TD" ? cell : null;
    let end = cell;
    if (td && S.tbl && S.a && td.closest("table") === S.tbl) end = tdAt(S.tbl, (S.b || S.a).r, (S.b || S.a).c) || td;
    const vis = sviCellVis(end);
    if (!vis) { if (H) H.style.display = "none"; return; }
    if (!H) {
      H = document.createElement("div"); H.id = "sviSelHandle"; document.body.appendChild(H);
      H.addEventListener("pointerdown", e => {
        e.preventDefault(); e.stopPropagation(); try { H.setPointerCapture(e.pointerId); } catch (err) {}
        const mv = ev => { const el = document.elementFromPoint(ev.clientX, ev.clientY), t2 = el && el.closest && el.closest("td"); if (t2 && t2.closest("table") === S.tbl) { const p = posOf(t2); if (p) { S.b = p; paint(); } } };
        const up = () => { H.removeEventListener("pointermove", mv); H.removeEventListener("pointerup", up); H.removeEventListener("pointercancel", up); };
        H.addEventListener("pointermove", mv); H.addEventListener("pointerup", up); H.addEventListener("pointercancel", up);
      });
    }
    { const c = getComputedStyle(end).getPropertyValue("--inst").trim(); H.style.background = c || "#111827"; }   /* v505 (remarque 55) */
    H.style.display = "block"; H.style.left = (vis.right - 7 + window.scrollX) + "px"; H.style.top = (vis.bottom - 7 + window.scrollY) + "px";
  };
  window.__sviHandle = () => handle();
  window.__sviHandleZ = z => { if (H) H.style.zIndex = z; };
  document.addEventListener("focusin", e => {
    const td = e.target.closest && e.target.closest("td"), tbl = td && td.closest(TSEL);
    if (!tbl) { handle(); return; }
    if (S.keep) { S.keep = false; handle(); return; }
    const p = posOf(td); if (!p) return;
    if (S.tbl !== tbl || !S.a || S.a.r !== p.r || S.a.c !== p.c) { S.tbl = tbl; S.a = p; S.b = null; S.extra.clear(); paint(); }
    else handle();
  });
  document.addEventListener("pointerdown", e => {
    if (e.target === H) return;
    const td = e.target.closest && e.target.closest("td"), tbl = td && td.closest(TSEL);
    /* v492 (remarque 11) : la sélection reste pour le menu ⋯ (copier / coller / effacer) ;
       v493 (remarque 14) : un toucher hors du tableau (ailleurs que sur un menu ⋯) l'annule et cache la poignée */
    if (!tbl) {
      if (e.target.closest && e.target.closest("#blkMenu, .sd-more, .blk-more, .blk-btn")) return;
      S.b = null; S.extra.clear(); S.a = null; S.tbl = null; paint(); if (H) H.style.display = "none";
      return;
    }
    const p = posOf(td); if (!p) return;
    if ((e.shiftKey || e.metaKey || e.ctrlKey) && S.tbl === tbl && S.a) {
      e.preventDefault(); S.keep = true;
      if (e.shiftKey) S.b = p;
      else { const k = p.r + ":" + p.c; if (S.extra.has(k)) S.extra.delete(k); else S.extra.add(k); }
      paint();
    }
  }, true);
  window.addEventListener("scroll", () => { if (H && H.style.display === "block") handle(); }, true);
  const valOf = td => { const i = td.querySelector("input:not([type=checkbox]), textarea, select"); return String(i ? i.value : td.textContent || "").replace(/[\t\n]/g, " ").trim(); };
  const selTsv = C => {
    const rs = [...new Set(C.map(td => td.parentElement))].sort((x, y) => x.sectionRowIndex - y.sectionRowIndex);
    const cs = [...new Set(C.map(td => td.cellIndex))].sort((x, y) => x - y);
    return rs.map(tr => cs.map(c => { const td = tr.cells[c]; return td && C.includes(td) ? valOf(td) : ""; }).join("\t")).join("\n");
  };
  /* v497 (remarque 32) : coller / effacer dans tous les tableaux de saisie (cases saisissables seulement) */
  const editIn = td => { const i = td && td.querySelector('input:not([type=checkbox]):not([type=radio]):not([type=file]):not(.sv-date):not(.dlp-in), textarea'); return i && !i.readOnly && !i.disabled ? i : null; };
  const putIn = (td, v) => {
    const i = editIn(td); if (!i) return false;
    i.__sel = true; i.value = v; i.dispatchEvent(new Event("input", { bubbles: true }));
    if (!i.classList.contains("sd-in")) {
      i.dispatchEvent(new Event("change", { bubbles: true }));
      if (i.isConnected && i.getAttribute("inputmode") === "decimal" && String(i.value).trim() !== "" && typeof money === "function") i.value = money(i.value);
    }
    i.__sel = false; return true;
  };
  const markSd = () => { if (S.tbl) S.tbl.dispatchEvent(new CustomEvent("svimark", { bubbles: true })); };
  /* v497 (remarque 32) : collage comme Excel — plusieurs valeurs = une par case, vers le bas (lignes) et vers la droite (colonnes),
     à partir de la case active (ou du coin haut gauche de la sélection) ; une seule valeur et plusieurs cases sélectionnées =
     la valeur dans chacune. Lignes manquantes : la ligne vide « SAISIR ICI » en crée de nouvelles. Cases grisées sautées. */
  const shown = tbl => [...(tbl.tBodies[0] ? tbl.tBodies[0].rows : [])].filter(tr => tr.offsetParent !== null);
  const pasteText = (t, tbl, C) => {
    if (!tbl || !C || !C.length) return 0;
    const lines = String(t || "").replace(/\r/g, "").replace(/\n+$/, "").split("\n").map(l => l.split("\t"));
    let n = 0;
    if (tbl.classList.contains("sd-t")) markSd();
    if (lines.length === 1 && lines[0].length === 1 && C.length > 1) { C.forEach(td => { if (putIn(td, lines[0][0].trim())) n++; }); return n; }
    const R0 = shown(tbl), rs = C.map(td => R0.indexOf(td.parentElement)).filter(x => x >= 0);
    const r0 = rs.length ? Math.min(...rs) : 0, c0 = Math.min(...C.map(td => td.cellIndex));
    lines.forEach((cl, i) => {
      if (!tbl.isConnected) return;
      const tr = shown(tbl)[r0 + i]; if (!tr) return;
      cl.forEach((v, j) => { const td = tr.cells[c0 + j]; if (td && putIn(td, v.trim())) n++; });
    });
    document.querySelector(".sd-sug")?.remove();
    if (typeof sviUnitSugHide === "function") sviUnitSugHide();
    return n;
  };
  const isNav = el => !!el && (el.tagName === "TD" || (el.classList && el.classList.contains("svi-nav")));
  document.addEventListener("paste", e => {
    const act = document.activeElement, td0 = act && act.closest && act.closest("td"), tbl = td0 && td0.closest(TSEL);
    if (!tbl) return;
    const t = (e.clipboardData && e.clipboardData.getData("text/plain")) || "";
    const multi = /[\t\n]/.test(t.replace(/\r/g, "").replace(/\n+$/, ""));
    const C = S.tbl === tbl && S.a ? cells() : [td0];
    if (!multi && !isNav(act) && C.length < 2) return;   /* saisie en cours : collage normal dans le texte */
    e.preventDefault();
    const n = pasteText(t, tbl, C.length ? C : [td0]);
    if (typeof svToast === "function" && (multi || C.length > 1)) svToast(n + " CASE(S) COLLÉE(S).", 1800);
  }, true);
  /* v497 (remarques 33 et 35) : copier une case sélectionnée (même grisée) ou une plage, pour Excel / Google Sheets */
  const copyEv = cut => e => {
    const act = document.activeElement, td0 = act && act.closest && act.closest("td"), tbl = td0 && td0.closest(TSEL);
    if (!tbl) return;
    const C = S.tbl === tbl && S.a ? cells() : [td0];
    if (!isNav(act) && C.length < 2) return;   /* texte sélectionné dans la saisie : copie normale */
    const txt = C.length > 1 ? selTsv(C) : valOf(td0);
    e.preventDefault();
    try { e.clipboardData.setData("text/plain", txt); } catch (err) {}
    window.__sviSelClip = txt;
    if (cut) { if (tbl.classList.contains("sd-t")) markSd(); C.forEach(td => putIn(td, "")); }
    if (typeof svToast === "function" && C.length > 1) svToast(C.length + " CASE(S) " + (cut ? "COUPÉE(S)" : "COPIÉE(S)") + ".", 1800);
  };
  document.addEventListener("copy", copyEv(false), true);
  document.addEventListener("cut", copyEv(true), true);
  /* API de la sélection (menu ⋯ de la SAISIE DIRECTE) */
  window.__sviSel = {
    count: () => cells().length,
    copy: () => { const C = cells(); if (!C.length) return 0; const t = selTsv(C); try { navigator.clipboard && navigator.clipboard.writeText(t); } catch (err) {} window.__sviSelClip = t; return C.length; },
    clear: () => { let n = 0; cells().forEach(td => { if (putIn(td, "")) n++; }); document.querySelector(".sd-sug")?.remove(); return n; },
    paste: async () => {
      const C = cells(); if (!C.length || !S.tbl) return 0;
      let t = ""; try { t = navigator.clipboard && navigator.clipboard.readText ? await navigator.clipboard.readText() : ""; } catch (err) { t = ""; }
      if (!t) t = window.__sviSelClip || "";
      return pasteText(t, S.tbl, C);
    },
    pasteText: (t, tbl, C) => pasteText(t, tbl, C)
  };
  document.addEventListener("keydown", e => {
    const act = document.activeElement, td0 = act && act.closest && act.closest("td"), tbl = td0 && td0.closest(TSEL);
    if (!tbl || S.tbl !== tbl || !S.a) return;
    /* Maj + flèches : étendre la plage (case sélectionnée seulement ; en saisie, Maj + flèches sélectionne le texte) */
    if (e.shiftKey && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      if (!isNav(act)) return;
      e.preventDefault(); e.stopPropagation();
      const b = S.b || { ...S.a };
      if (e.key === "ArrowUp") b.r = Math.max(0, b.r - 1); else if (e.key === "ArrowDown") b.r = Math.min(tbl.tBodies[0].rows.length - 1, b.r + 1);
      else if (e.key === "ArrowLeft") b.c = Math.max(0, b.c - 1); else b.c = b.c + 1;
      S.b = b; paint();
      const end = tdAt(tbl, b.r, b.c); if (end && typeof sviKeepVisible === "function") sviKeepVisible(end);
      return;
    }
    const C = cells();
    if (C.length < 2 || !isNav(act)) return;
    const mod = e.metaKey || e.ctrlKey;
    if (!mod && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault(); e.stopPropagation();
      if (tbl.classList.contains("sd-t")) markSd();
      let n = 0; C.forEach(td => { if (putIn(td, "")) n++; });
      document.querySelector(".sd-sug")?.remove();
      if (typeof svToast === "function") svToast(n + " CASE(S) VIDÉE(S).", 1800);
    }
  }, true);
})();

/* v497 (remarques 30, 33 et 35) : CASES COMME GOOGLE SHEETS, dans tous les tableaux de saisie
   - un premier toucher (ou les flèches, Tab, Entrée, les flèches de la barre du clavier de l'iPad) SÉLECTIONNE la case :
     cadre, sans curseur ; ce qu'on tape remplace le contenu ; Commande + C / X / V copient, coupent, collent la case
     (plusieurs valeurs collées : une par case, vers le bas et vers la droite) ; ⌫ vide la case ;
   - un second toucher (double toucher), F2 ou la frappe passent EN SAISIE : curseur dans le texte ; les flèches, Maj + flèches,
     Commande + A / C / V agissent alors dans le texte ; Échap = revenir à la valeur d'avant et à la case sélectionnée ;
   - flèches (case sélectionnée) : case voisine, cases grisées comprises (elles se sélectionnent et se copient, sans saisie) ;
   - la case choisie reste toujours visible (en-tête et TOTAL fixés, clavier ou barre de l'iPad) */
(() => {
  /* v512 (remarque 80) : même comportement dans tous les tableaux ET dans les listes LOT / ACTIVITÉ PRIMAIRE / ACTIVITÉ SECONDAIRE */
  const ED = SVI_ED;
  const editable = i => !!i && i.matches && i.matches(ED) && !i.readOnly && !i.disabled && !!sviCellOf(i);
  const NOSEL = "button, a, label, .lk-rd, .lk-rdall, [role=button], input[type=checkbox], input[type=radio], .ins-grip, .blk-grip, .ins-fold, .ins-gfz";
  let nav = null;
  const end = i => { try { const L = String(i.value || "").length; i.setSelectionRange(L, L); } catch (err) {} };
  const on = i => {
    if (nav && nav !== i) off(nav);
    nav = i; i.classList.add("svi-nav"); i.__v0 = i.value; end(i);
  };
  const off = i => { i.classList.remove("svi-nav"); if (nav === i) nav = null; };
  window.__sviNav = { on, off, isNav: i => !!i && i.classList.contains("svi-nav") };
  /* toucher : 1er = sélection ; 2e sur la même case = saisie (le navigateur place le curseur) */
  let tap = null;
  document.addEventListener("pointerdown", e => {
    const i = e.target.closest && e.target.closest(ED);
    tap = null;
    if (!editable(i)) return;
    if (document.activeElement === i) { if (i.classList.contains("svi-nav")) off(i); return; }
    tap = i;
  }, true);
  document.addEventListener("mouseup", e => { if (tap && e.target === tap) e.preventDefault(); }, true);
  document.addEventListener("pointerup", () => { const t = tap; setTimeout(() => { if (tap === t) tap = null; }, 120); }, true);
  document.addEventListener("focusin", e => {
    const i = e.target;
    if (!editable(i)) return;
    if (i.__edit) { i.__edit = false; off(i); return; }
    on(i);
    /* l'iPad place le curseur après la prise de focus : on le retire encore */
    setTimeout(() => { if (nav === i && document.activeElement === i) end(i); }, 0);
    setTimeout(() => { if (nav === i && document.activeElement === i) end(i); }, 80);
  });
  document.addEventListener("focusout", e => { const i = e.target; if (i && i.classList && i.classList.contains("svi-nav")) off(i); });
  /* frappe sur une case sélectionnée : remplace le contenu, puis saisie */
  document.addEventListener("beforeinput", e => {
    const i = e.target;
    if (!i || i !== nav || !i.classList.contains("svi-nav")) return;
    const t = e.inputType || "";
    if (t === "insertText" || t === "insertReplacementText") {
      e.preventDefault();
      off(i);
      i.value = e.data || "";
      end(i);
      i.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: e.data || "" }));
      return;
    }
    if (t.startsWith("delete")) {
      e.preventDefault();
      off(i);
      i.value = "";
      i.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: t }));
      return;
    }
    if (t === "insertFromPaste" || t === "insertFromDrop") return;   /* collage : géré à part (une valeur par case) */
    off(i);
  }, true);
  /* lettres accentuées (composition) : la case est vidée d'abord */
  document.addEventListener("compositionstart", e => { const i = e.target; if (i && i === nav && i.classList.contains("svi-nav")) { off(i); i.value = ""; } }, true);
  document.addEventListener("input", e => { const i = e.target; if (e.isTrusted && i && i === nav && i.classList.contains("svi-nav")) off(i); }, true);
  /* case grisée (ou sans saisie) : elle se sélectionne aussi, pour la copier */
  const focusTd = td => {
    td.classList.add("svi-tdf");
    if (!td.hasAttribute("tabindex")) td.setAttribute("tabindex", "-1");
    td.focus({ preventScroll: true });
  };
  document.addEventListener("focusout", e => { const t = e.target; if (t && t.classList && t.classList.contains("svi-tdf")) t.classList.remove("svi-tdf"); });
  document.addEventListener("click", e => {
    if (e.defaultPrevented || !e.target.closest || e.target.closest(NOSEL)) return;
    const td = e.target.closest("td");
    const c = td ? sviCellOf(td) : null;
    if (!c || !sviCellOk(c)) return;
    const i = c.querySelector(ED);
    /* toucher la cellule hors de sa zone de texte = la sélectionner aussi */
    if (i && !i.disabled && !i.readOnly) { if (e.target !== i && !i.contains(e.target) && document.activeElement !== i) i.focus(); return; }
    if (document.activeElement === c) return;
    focusTd(c);
  });
  /* aller à une cellule (sélectionnée) ; « quiet » : sans défilement (focus remis après un redessin) */
  const goCell = (c, quiet) => {
    if (!c) return;
    const i = sviCellInput(c);
    if (i && editable(i) && i.offsetParent !== null) i.focus({ preventScroll: true });
    else if (c.tagName === "TD") focusTd(c);
    else return;
    if (!quiet) { window.__sviLastGo = { k: sviCellKey(i || c), t: performance.now() }; if (typeof sviKeepVisible === "function") sviKeepVisible(c); }
  };
  window.__sviGrid = { go: goCell, near: sviNear, cellOf: sviCellOf };
  document.addEventListener("keydown", e => {
    const el = e.target;
    if (!el || !el.closest) return;
    const c = sviCellOf(el);
    if (!c) return;
    const isTd = el.tagName === "TD", isNav = isTd || (el.classList && el.classList.contains("svi-nav"));
    const mod = e.metaKey || e.ctrlKey || e.altKey;
    /* en saisie : Échap = valeur d'avant, case sélectionnée */
    if (!isNav) {
      if (e.key === "Escape" && editable(el) && el.__v0 !== undefined && !document.querySelector("#svUnitSug, .sd-sug")) {
        e.preventDefault();
        if (el.value !== el.__v0) { el.value = el.__v0; el.dispatchEvent(new Event("input", { bubbles: true })); }
        on(el);
      }
      return;
    }
    if (e.key === "F2" && !isTd) { e.preventDefault(); off(el); end(el); return; }
    if (mod || e.shiftKey) return;
    const k = e.key;
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(k)) {
      /* case grisée : Entrée / Tab = case voisine */
      if (isTd && (k === "Enter" || k === "Tab")) { e.preventDefault(); goCell(sviNear(c, k === "Enter" ? 1 : 0, k === "Tab" ? 1 : 0)); }
      return;
    }
    if (document.querySelector("#svUnitSug, .sd-sug")) return;   /* flèches : dans la liste de choix */
    e.preventDefault(); e.stopPropagation();
    const nx = sviNear(c, k === "ArrowDown" ? 1 : k === "ArrowUp" ? -1 : 0, k === "ArrowRight" ? 1 : k === "ArrowLeft" ? -1 : 0);
    if (nx) goCell(nx);
  }, true);
  /* v512 (remarque 80) : listes du bloc TÂCHES — Entrée = même case de la ligne du dessous, Tab = case suivante (puis ligne suivante) */
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== "Tab") return;
    const el = e.target, c = el && sviCellOf(el);
    if (!c || c.tagName === "TD" || e.defaultPrevented) return;
    if (document.querySelector("#svUnitSug")) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const back = e.shiftKey;
    let nx;
    if (e.key === "Enter") nx = sviNear(c, back ? -1 : 1, 0);
    else { nx = sviNear(c, 0, back ? -1 : 1); if (!nx) { const r = sviNear(c, back ? -1 : 1, 0); if (r) { const cs = sviRowCells(sviRowOf(r), false); nx = back ? cs[cs.length - 1] : cs[0]; } } }
    if (nx) goCell(nx);
  }, true);
  /* v512 (remarque 80) : coller plusieurs valeurs dans une liste = une par ligne, vers le bas (lignes créées par SAISIR ICI…) */
  document.addEventListener("paste", e => {
    const a = document.activeElement, c = sviCellOf(a);
    if (!c || c.tagName === "TD") return;
    const t = (e.clipboardData && e.clipboardData.getData("text/plain")) || "";
    const L = t.replace(/\r/g, "").replace(/\n+$/, "").split("\n").map(l => l.split("\t"));
    if (L.length < 2 && L[0].length < 2 && !(a.classList && a.classList.contains("svi-nav"))) return;
    e.preventDefault();
    let cur = c, n = 0;
    const col = c.closest(".ins-hcol"), k0 = col && col.dataset.ik;
    for (const line of L) {
      if (!cur) {
        const box = document.querySelector(`.ins-hcol[data-ik="${k0}"]`);
        const nw = box && [...box.querySelectorAll(".ins-li.ins-new")].pop();
        cur = nw ? sviCellOf(nw.querySelector("input.ins-in")) : null;
        if (!cur) break;
      }
      let cc = cur;
      line.forEach((v, j) => {
        if (!cc) return;
        const i = sviCellInput(cc);
        if (i && !i.readOnly && !i.disabled) { i.__sel = true; i.value = v.trim(); i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); i.__sel = false; n++; }
        cc = j < line.length - 1 ? sviNear(cc, 0, 1) : cc;
      });
      cur = cur.isConnected ? sviNear(cur, 1, 0) : null;
    }
    if (typeof svToast === "function") svToast(n + " CASE(S) COLLÉE(S).", 1800);
  }, true);
  /* copier une cellule de liste sélectionnée */
  document.addEventListener("copy", e => {
    const a = document.activeElement, c = sviCellOf(a);
    if (!c || c.tagName === "TD" || !(a.classList && a.classList.contains("svi-nav"))) return;
    const i = sviCellInput(c); e.preventDefault(); try { e.clipboardData.setData("text/plain", i ? i.value : ""); } catch (err) {}
  }, true);
})();


/* v497 (remarque 36) : nombres au format de l'application en quittant la case — 35 → 35,00 (virgule, deux décimales,
   espace des milliers), dans DÉSIGNATIONS CLIENT, DÉTAIL PRODUITS / CHARGES, IMPORT NON CRÉÉ et SAISIE DIRECTE */
document.addEventListener("focusout", e => {
  const i = e.target;
  if (!i || i.tagName !== "INPUT" || i.getAttribute("inputmode") !== "decimal" || i.readOnly || i.disabled) return;
  if (!i.closest("table.ins-table, table.inc-table, table.sd-t")) return;
  const v = String(i.value || "").trim();
  if (!v || !/^-?[\d\s  ]*[.,]?\d*$/.test(v) || !/\d/.test(v)) return;
  const m = money(v);
  if (m !== i.value) { i.value = m; i.defaultValue = m; }
});
