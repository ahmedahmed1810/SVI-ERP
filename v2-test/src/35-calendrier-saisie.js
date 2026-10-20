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
const sviGo = nx => { nx.focus(); try { if (nx.matches("input:not(.sv-date):not(.dlp-in)")) nx.select(); } catch (err) {} nx.scrollIntoView({ block: "nearest", inline: "nearest" }); };
document.addEventListener("keydown", e => {
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) || e.shiftKey) return;
  const el = e.target;
  if (!el || !el.matches || !el.matches("input:not([type=checkbox]):not([type=radio])") || el.closest("#cfMenu, #svCal")) return;
  const box = sviGridBox(el), td = el.closest("td"), tr = el.closest("tr");
  if (!box || !td || !tr) return;
  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    const nx = sviGridCell(tr, td.cellIndex, e.key === "ArrowDown" ? 1 : -1);
    e.preventDefault(); if (nx) sviGo(nx); return;
  }
  const L = (el.value || "").length, a = el.selectionStart, b = el.selectionEnd;
  if (a === null) return;
  const all = a === 0 && b === L;
  if (!(all || (e.key === "ArrowLeft" ? a === 0 && b === 0 : a === L && b === L))) return;
  const list = [...box.querySelectorAll("input, select, textarea")].filter(x => x === el || sviGridOk(x));
  const nx = list[list.indexOf(el) + (e.key === "ArrowLeft" ? -1 : 1)];
  e.preventDefault(); if (nx) sviGo(nx);
}, true);
document.addEventListener("keydown", e => {
  if (e.key !== "Enter" && e.key !== "Tab") return;
  const el = e.target;
  if (!el || !el.matches || !el.matches("input, select, textarea.ins-in")) return;
  if (el.matches('[type="checkbox"], [type="radio"], [type="file"], .cf-q') || el.closest("#cfMenu, #svCal")) return;
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
  nx.focus();
  try { if (nx.matches("input:not(.sv-date):not(.dlp-in)")) nx.select(); } catch (err) {}
  nx.scrollIntoView({ block: "nearest", inline: "nearest" });
}, true);
/* v491 (remarque 1) : la case où l'on saisit reste visible — si elle est cachée (bas du tableau, clavier de l'iPad),
   le tableau remonte juste assez ; si elle est déjà visible, rien ne bouge */
const sviKeepVisible = el => {
  if (!el || !el.isConnected || el.offsetParent === null) return;
  el.scrollIntoView({ block: "nearest", inline: "nearest" });
  const vv = window.visualViewport, bottom = vv ? vv.offsetTop + vv.height : window.innerHeight, top = vv ? vv.offsetTop : 0;
  const r = el.getBoundingClientRect();
  if (r.bottom > bottom - 10) window.scrollBy(0, r.bottom - bottom + 40);
  else if (r.top < top + 4) window.scrollBy(0, r.top - top - 40);
};
{
  let raf = 0;
  const SEL = ".ins-table input, .ins-table textarea, .ins-hcol input, .sd-t input, .dly-table input, .qq-table input, .inc-table input, .prm-table input";
  const run = e => { const el = e.target; if (!el || !el.matches || !el.matches(SEL)) return; cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setTimeout(() => sviKeepVisible(document.activeElement === el ? el : document.activeElement), 60)); };
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
    const act = document.activeElement, td = act && act.closest && act.closest("td");
    if (!S.tbl || !S.a || !td || !td.closest(TSEL) || td.closest("table") !== S.tbl || !matchMedia("(pointer: coarse)").matches) { if (H) H.style.display = "none"; return; }
    const end = tdAt(S.tbl, (S.b || S.a).r, (S.b || S.a).c) || td;
    if (!H) {
      H = document.createElement("div"); H.id = "sviSelHandle"; document.body.appendChild(H);
      H.addEventListener("pointerdown", e => {
        e.preventDefault(); e.stopPropagation(); try { H.setPointerCapture(e.pointerId); } catch (err) {}
        const mv = ev => { const el = document.elementFromPoint(ev.clientX, ev.clientY), t2 = el && el.closest && el.closest("td"); if (t2 && t2.closest("table") === S.tbl) { const p = posOf(t2); if (p) { S.b = p; paint(); } } };
        const up = () => { H.removeEventListener("pointermove", mv); H.removeEventListener("pointerup", up); H.removeEventListener("pointercancel", up); };
        H.addEventListener("pointermove", mv); H.addEventListener("pointerup", up); H.addEventListener("pointercancel", up);
      });
    }
    const r = end.getBoundingClientRect();
    H.style.display = "block"; H.style.left = (r.right - 7 + window.scrollX) + "px"; H.style.top = (r.bottom - 7 + window.scrollY) + "px";
  };
  document.addEventListener("focusin", e => {
    const td = e.target.closest && e.target.closest("td"), tbl = td && td.closest(TSEL);
    if (!tbl) { if (H) H.style.display = "none"; return; }
    if (S.keep) { S.keep = false; handle(); return; }
    const p = posOf(td); if (!p) return;
    if (S.tbl !== tbl || !S.a || S.a.r !== p.r || S.a.c !== p.c) { S.tbl = tbl; S.a = p; S.b = null; S.extra.clear(); paint(); }
    else handle();
  });
  document.addEventListener("pointerdown", e => {
    if (e.target === H) return;
    const td = e.target.closest && e.target.closest("td"), tbl = td && td.closest(TSEL);
    /* v492 (remarque 11) : la sélection reste (menu ⋯, boutons) ; seul un toucher sur une autre case l'annule */
    if (!tbl) return;
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
  const putIn = (td, v) => { const i = td.querySelector("input.sd-in"); if (!i || i.readOnly) return false; i.__sel = true; i.value = v; i.dispatchEvent(new Event("input", { bubbles: true })); i.__sel = false; return true; };
  const markSd = () => { if (S.tbl) S.tbl.dispatchEvent(new CustomEvent("svimark", { bubbles: true })); };
  /* API de la sélection (menu ⋯ de la SAISIE DIRECTE) */
  window.__sviSel = {
    count: () => cells().length,
    copy: () => { const C = cells(); if (!C.length) return 0; const t = selTsv(C); try { navigator.clipboard && navigator.clipboard.writeText(t); } catch (err) {} window.__sviSelClip = t; return C.length; },
    clear: () => { let n = 0; cells().forEach(td => { if (putIn(td, "")) n++; }); document.querySelector(".sd-sug")?.remove(); return n; },
    paste: async () => {
      const C = cells(); if (!C.length || !S.tbl) return 0;
      let t = ""; try { t = navigator.clipboard && navigator.clipboard.readText ? await navigator.clipboard.readText() : ""; } catch (err) { t = ""; }
      if (!t) t = window.__sviSelClip || "";
      const r0 = Math.min(...C.map(td => td.parentElement.sectionRowIndex)), c0 = Math.min(...C.map(td => td.cellIndex));
      const lines = String(t || "").replace(/\r/g, "").replace(/\n+$/, "").split("\n").map(l => l.split("\t"));
      let n = 0; lines.forEach((cl, i) => cl.forEach((v, j) => { const td = tdAt(S.tbl, r0 + i, c0 + j); if (td && putIn(td, v.trim())) n++; }));
      document.querySelector(".sd-sug")?.remove();
      return n;
    }
  };
  document.addEventListener("keydown", e => {
    const act = document.activeElement, td0 = act && act.closest && act.closest("td"), tbl = td0 && td0.closest(TSEL);
    if (!tbl || S.tbl !== tbl || !S.a) return;
    /* Maj + flèches : étendre la plage */
    if (e.shiftKey && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault(); e.stopPropagation();
      const b = S.b || { ...S.a };
      if (e.key === "ArrowUp") b.r = Math.max(0, b.r - 1); else if (e.key === "ArrowDown") b.r = Math.min(tbl.tBodies[0].rows.length - 1, b.r + 1);
      else if (e.key === "ArrowLeft") b.c = Math.max(0, b.c - 1); else b.c = b.c + 1;
      S.b = b; paint(); return;
    }
    const C = cells();
    if (C.length < 2) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && (e.key === "c" || e.key === "C")) {
      e.preventDefault();
      const rs = [...new Set(C.map(td => td.parentElement))].sort((x, y) => x.sectionRowIndex - y.sectionRowIndex);
      const cs = [...new Set(C.map(td => td.cellIndex))].sort((x, y) => x - y);
      const txt = rs.map(tr => cs.map(c => { const td = tr.cells[c]; return td && C.includes(td) ? valOf(td) : ""; }).join("\t")).join("\n");
      try { navigator.clipboard && navigator.clipboard.writeText(txt); } catch (err) {}
      if (typeof svToast === "function") svToast(C.length + " CASE(S) COPIÉE(S).", 1800);
      return;
    }
    if (!tbl.classList.contains("sd-t")) return;
    const put = (td, v) => putIn(td, v);
    if (!mod && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault(); markSd(); let n = 0; C.forEach(td => { if (put(td, "")) n++; });
      document.querySelector(".sd-sug")?.remove();
      if (typeof svToast === "function") svToast(n + " CASE(S) VIDÉE(S).", 1800);
      return;
    }
    if (mod && (e.key === "v" || e.key === "V")) {
      e.preventDefault(); markSd();
      const r0 = Math.min(...C.map(td => td.parentElement.sectionRowIndex)), c0 = Math.min(...C.map(td => td.cellIndex));
      (navigator.clipboard && navigator.clipboard.readText ? navigator.clipboard.readText() : Promise.resolve("")).then(t => {
        const lines = String(t || "").replace(/\r/g, "").replace(/\n+$/, "").split("\n").map(l => l.split("\t"));
        let n = 0;
        lines.forEach((cl, i) => cl.forEach((v, j) => { const td = tdAt(tbl, r0 + i, c0 + j); if (td && put(td, v.trim())) n++; }));
        document.querySelector(".sd-sug")?.remove();
        if (typeof svToast === "function") svToast(n + " CASE(S) COLLÉE(S).", 1800);
      }).catch(() => {});
    }
  }, true);
})();

