/* =========================================================
   PARAMÉTRAGE : CHS + UNITÉS (12/10/2026)
   UNITÉS : intitulé et abréviation ; l'abréviation est celle utilisée dans les tableaux.
   Toutes les unités restent permises ; la liste sert de choix proposé à la saisie.
   Gardée sur l'appareil en attendant l'onglet UNITÉS de la base Google.
   ========================================================= */
const SVI_UNITS_KEY = "svi_units_v1";
const SVI_UNITS_DEF = [["UNITÉ", "U"], ["FORFAIT", "F"], ["MÈTRE", "M"], ["MÈTRE LINÉAIRE", "ML"], ["MÈTRE CARRÉ", "M2"],
  ["MÈTRE CUBE", "M3"], ["TONNE", "T"], ["KILOGRAMME", "KG"], ["LITRE", "L"], ["ENSEMBLE", "ENS"]].map(([n, a]) => ({ n, a }));
function sviUnits() {
  try { const v = JSON.parse(localStorage.getItem(SVI_UNITS_KEY) || "null"); if (Array.isArray(v)) return v; } catch (e) {}
  return SVI_UNITS_DEF.map(x => ({ ...x }));
}
function sviUnitsSave(list) {
  try { localStorage.setItem(SVI_UNITS_KEY, JSON.stringify(list)); } catch (e) {}
}
/* liste proposée dans les cases d'unité (UPB, UNITÉ) */
function sviUnitsList() {
  let dl = document.getElementById("sviUnitsDl");
  if (!dl) { dl = document.createElement("datalist"); dl.id = "sviUnitsDl"; document.body.appendChild(dl); }
  dl.innerHTML = sviUnits().filter(x => x.a).map(x => `<option value="${esc(x.a)}">${esc(x.n)}</option>`).join("");
}
/* proposition d'unités au format de l'application (plus de bulle Safari) : après la 1re lettre tapée,
   6 unités au plus qui commencent par la saisie ; un toucher choisit ; continuer à taper la fait suivre */
const SVI_UNIT_SEL = 'input.ins-in[data-f="u"], input.inc-in[data-f="u"], input.inc-in[data-f="upb"]';
function sviUnitSugHide() { document.getElementById("svUnitSug")?.remove(); }
document.addEventListener("input", e => {
  const i = e.target.closest && e.target.closest(SVI_UNIT_SEL);
  if (!i) return;
  const q = String(i.value || "").trim().toUpperCase();
  if (!q) { sviUnitSugHide(); return; }
  const L = sviUnits().filter(x => x.a && (x.a.startsWith(q) || String(x.n || "").startsWith(q)) && x.a !== q).slice(0, 6);
  if (!L.length) { sviUnitSugHide(); return; }
  let b = document.getElementById("svUnitSug");
  if (!b) { b = document.createElement("div"); b.id = "svUnitSug"; document.body.appendChild(b); }
  b.__for = i;
  b.innerHTML = L.map(x => `<button type="button" data-u="${esc(x.a)}"><b>${esc(x.a)}</b><span>${esc(x.n)}</span></button>`).join("");
  const r = i.getBoundingClientRect();
  b.style.left = Math.max(8, Math.min(r.left, window.innerWidth - b.offsetWidth - 8)) + "px";
  b.style.top = (r.bottom + 4 + b.offsetHeight <= sviViewH() - 8 ? r.bottom + 4 : Math.max(8, r.top - b.offsetHeight - 4)) + "px";
});
document.addEventListener("pointerdown", e => {
  const b = document.getElementById("svUnitSug");
  if (!b) return;
  const u = e.target.closest && e.target.closest("#svUnitSug [data-u]");
  if (!u) { if (!b.contains(e.target)) sviUnitSugHide(); return; }
  e.preventDefault();
  const i = b.__for;
  sviUnitSugHide();
  if (!i || !i.isConnected) return;
  i.value = u.dataset.u;
  i.dispatchEvent(new Event("input", { bubbles: true }));
  sviUnitSugHide();
  i.dispatchEvent(new Event("change", { bubbles: true }));
}, true);
document.addEventListener("focusout", e => { if (e.target.closest && e.target.closest(SVI_UNIT_SEL)) setTimeout(() => { const b = document.getElementById("svUnitSug"); if (b && b.__for === e.target && document.activeElement !== e.target) sviUnitSugHide(); }, 150); });
/* v491 (remarque 5) : listes de choix comme dans les tableurs — flèches haut / bas = proposition suivante / précédente ;
   Entrée ou Tab = la proposition en surbrillance, ou la seule proposée, puis la case suivante ; Échap = fermer */
document.addEventListener("keydown", e => {
  const b = document.querySelector("#svUnitSug, .sd-sug");
  if (!b || b.__for !== e.target) { if (e.key === "Enter" || e.key === "Escape") sviUnitSugHide(); return; }
  const B = [...b.querySelectorAll("button")];
  let k = B.findIndex(x => x.classList.contains("on"));
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault(); e.stopPropagation();
    k = e.key === "ArrowDown" ? Math.min(B.length - 1, k + 1) : Math.max(0, k < 0 ? 0 : k - 1);
    B.forEach((x, n) => x.classList.toggle("on", n === k));
    B[k] && B[k].scrollIntoView({ block: "nearest" });
    return;
  }
  if (e.key === "Escape") { e.preventDefault(); b.remove(); return; }
  if (e.key !== "Enter" && e.key !== "Tab") return;
  const pick = k >= 0 ? B[k] : B.length === 1 ? B[0] : null;
  const i = b.__for;
  b.remove();
  if (!pick || !i) return;
  i.value = pick.dataset.u || pick.dataset.v || "";
  i.dispatchEvent(new Event("input", { bubbles: true }));
  document.querySelector("#svUnitSug, .sd-sug")?.remove();
  i.dispatchEvent(new Event("change", { bubbles: true }));
  /* Tab : la touche continue (case à droite) ; Entrée : choisie puis case suivante, à droite (pas la ligne du dessous) */
  if (e.key === "Enter") {
    e.preventDefault(); e.stopPropagation();
    const tr = i.closest("tr, .ins-li");
    const ok = x => x.offsetParent !== null && !x.disabled && !x.readOnly && !x.matches('[type="checkbox"], [type="radio"], [type="hidden"]');
    const L = tr ? [...tr.querySelectorAll("input, select, textarea")].filter(x => x === i || ok(x)) : [];
    const nx = L[L.indexOf(i) + 1];
    if (nx) { nx.focus(); try { nx.select(); } catch (err) {} }
  }
}, true);
/* FORMAT 129 : case « tout cocher » à trois états — vide / à moitié (une partie cochée) / cochée (toutes) */
(() => {
  let raf = 0;
  const run = () => {
    raf = 0;
    document.querySelectorAll("input.ins-gcb, input.mg-gcb, input.ins-tcb[data-part]").forEach(c => { const p = c.dataset.part === "1"; if (c.indeterminate !== p) c.indeterminate = p; });   /* v499 (remarque 45) */
    document.querySelectorAll('input[type="checkbox"][class$="-cball"]').forEach(hd => {
      const box = hd.closest("table, .ins-hcol");
      if (!box) return;
      const rows = [...box.querySelectorAll('input[type="checkbox"]')].filter(c => c !== hd && !c.closest("thead, .bdg-h-head") && !c.classList.contains("ins-tcb") && !/-cball$/.test(c.className));
      const n = rows.filter(c => c.checked).length;
      const all = rows.length > 0 && n === rows.length, part = n > 0 && n < rows.length;
      if (hd.checked !== all) hd.checked = all;
      if (hd.indeterminate !== part) hd.indeterminate = part;
      /* v499 (remarque 41) : en-tête de la colonne des cases en bleu dès qu'une case est cochée */
      const hc = hd.closest("th, .ins-hdel, .bdg-h-head");
      const anyOn = n > 0 || rows.some(c => c.checked);
      if (hc && hc.classList.contains("cb-filt") !== anyOn) hc.classList.toggle("cb-filt", anyOn);
    });
  };
  const go = () => { if (!raf) raf = requestAnimationFrame(run); };
  document.addEventListener("change", go, true);
  const mo = new MutationObserver(go);
  const start = () => mo.observe(document.body, { childList: true, subtree: true });
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
/* FORMAT 121 : en-têtes des tableaux fixés sous la bande du budget quand la page défile */
(() => {
  let raf = 0;
  const run = () => {
    raf = 0;
    const band = document.querySelector(".bdg-d-sticky");
    const blocks = document.querySelectorAll(".bdg-d-block");
    if (!blocks.length) return;
    const top = band ? band.getBoundingClientRect().bottom : 0;
    blocks.forEach(bl => {
      const ttl = bl.querySelector(":scope > .blk-head, :scope > .bdg-d-block-title, :scope > .bdg-d-tabs, :scope > #bdgTabs");
      /* FORMAT 21 : l'en-tête du Gantt (calendrier) reste lui aussi en place */
      const heads = [...bl.querySelectorAll("thead th, .bdg-h-head, .dlyg-r > .gh")];
      const parts = (ttl ? [ttl] : []).concat(heads);
      const cur = el => { const m = /translateY\((-?[\d.]+)px\)/.exec(el.style.transform || ""); return m ? +m[1] : 0; };
      const br = bl.getBoundingClientRect();
      const tH = ttl ? ttl.offsetHeight : 0, hH = heads.length ? Math.max(...heads.map(h => h.offsetHeight)) : 0;
      const room = br.bottom - (tH + hH + 30);
      const set = (el, want) => {
        /* dans un bloc qui défile lui-même : jamais au-dessus du haut de sa zone de défilement */
        const sc = el.closest(".dlyg-l, .dlyg-r") && el.closest(".bdg-d-scroll, .lk-scroll");
        if (sc) want = Math.max(want, sc.getBoundingClientRect().top);
        const t0 = el.getBoundingClientRect().top - cur(el);
        const off = Math.max(0, Math.min(want - t0, room - t0));
        const v = off > 0.5 ? "translateY(" + off.toFixed(1) + "px)" : "";
        if (el.style.transform !== v) el.style.transform = v;
        el.classList.toggle("sv-stuck", !!v);
      };
      if (ttl) set(ttl, top);
      heads.forEach(h => set(h, top + tH));
      void parts;
    });
  };
  const go = () => { if (!raf) raf = requestAnimationFrame(run); };
  document.addEventListener("scroll", go, true);
  window.addEventListener("resize", go);
  const mo = new MutationObserver(go);
  const start = () => mo.observe(document.body, { childList: true, subtree: true });
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
/* FORMAT 122 : désignation en lecture (texte) / saisie (zone de texte posée dessus pendant l'édition) */
document.addEventListener("focusin", e => { const t = e.target; if (t && t.matches && t.matches("td.ins-tdv textarea.ins-ta")) t.closest("td").classList.add("ins-ed"); }, true);
document.addEventListener("focusout", e => {
  const t = e.target;
  if (!t || !t.matches || !t.matches("td.ins-tdv textarea.ins-ta")) return;
  const td = t.closest("td"); td.classList.remove("ins-ed");
  const dv = td.querySelector(".ins-dv"); if (dv) dv.textContent = t.value;
}, true);
/* FORMAT 109 : DÉSIGNATION client à la ligne — hauteur suivant le texte, pas de retour à la ligne saisi */
document.addEventListener("input", e => {
  const t = e.target;
  if (!t || !t.matches || !t.matches("textarea.ins-ta")) return;
  if (/[\r\n]/.test(t.value)) t.value = t.value.replace(/[\r\n]+/g, " ");
  { const dv = t.closest("td.ins-tdv")?.querySelector(".ins-dv"); if (dv) { dv.textContent = t.value; return; } }
  t.style.height = "0px"; t.style.height = Math.max(20, t.scrollHeight) + "px";
}, true);
/* correction d'un nombre déjà saisi (FORMAT 86) : à la touche, sans zéros inutiles (1,00 → 1) et tout sélectionné ;
   en quittant la case, le format revient (1 → 1,00) */
const SVI_NUM_SEL = 'input.ins-in[inputmode="decimal"], input.inc-in.number, input.lk-q';
document.addEventListener("focusin", e => {
  const i = e.target.closest && e.target.closest(SVI_NUM_SEL);
  if (!i || i.disabled || i.readOnly) return;
  const v = String(i.value || "").trim();
  if (!v || !sviNumOk(v)) return;
  const n = num(v);
  if (!isFinite(n)) return;
  const raw = String(Math.round(n * 1e6) / 1e6).replace(".", ",");
  i.__numFmt = v;
  if (raw !== v) i.value = raw;
  setTimeout(() => { if (document.activeElement === i) { try { i.select(); i.setSelectionRange(0, i.value.length); } catch (err) {} } }, 0);
});
/* FORMAT 5 dans les fenêtres : nombres entiers (jours, ouvriers) — à la touche, tout sélectionné (la frappe remplace) */
const SVI_INT_SEL = "input.lkw-o, input.gen-n, input.dpk-o-in";
document.addEventListener("focusin", e => {
  const i = e.target.closest && e.target.closest(SVI_INT_SEL);
  if (!i || i.disabled || i.readOnly) return;
  setTimeout(() => { if (document.activeElement === i) { try { i.select(); i.setSelectionRange(0, i.value.length); } catch (err) {} } }, 0);
});
/* iPad : un toucher sur une case déjà active replace le curseur ; on resélectionne tout */
document.addEventListener("pointerup", e => {
  const i = e.target.closest && e.target.closest(SVI_INT_SEL);
  if (!i || i.disabled || i.readOnly || i.__selOnce) return;
  i.__selOnce = true;
  setTimeout(() => { try { i.select(); i.setSelectionRange(0, i.value.length); } catch (err) {} }, 0);
  i.addEventListener("blur", () => { i.__selOnce = false; }, { once: true });
});
document.addEventListener("focusout", e => {
  const i = e.target.closest && e.target.closest(SVI_NUM_SEL);
  if (!i || i.__numFmt === undefined) return;
  const v = String(i.value || "").trim();
  if (v && sviNumOk(v) && i.isConnected) {
    const old = i.__numFmt, dec = (String(old).split(",")[1] || "").length || 2;
    i.value = num(v).toLocaleString("fr-FR", { minimumFractionDigits: Math.max(2, dec), maximumFractionDigits: Math.max(2, dec) }).replace(/\u202f|\u00a0/g, " ");
  }
  delete i.__numFmt;
});
function sviParamTabs() {
  const view = document.getElementById("chs");
  if (!view || view.querySelector(".prm-tabs")) return;
  const head = view.querySelector(".section-head");
  const bar = document.createElement("div");
  bar.className = "prm-tabs";
  bar.innerHTML = `<button type="button" class="prm-tab on" data-prm="chs">CHS — CHARGES STANDARDS</button><button type="button" class="prm-tab" data-prm="unit">UNITÉS</button>`
    + `<button type="button" class="prm-tab prm-bdg" data-bdg="cal">CALENDRIER</button>`;
  /* CALENDRIER et DATES DU BUDGET : pour le budget ouvert ; grisés sans budget ouvert (appui long = raison) */
  const why = () => { const L = window.__sviBdgLive; return !L ? "OUVRIR UN BUDGET D'ABORD" : !L.edit ? "BUDGET FIGÉ OU VALIDÉ : LECTURE SEULE" : ""; };
  const paint = () => bar.querySelectorAll(".prm-bdg").forEach(b => b.classList.toggle("off", !!why()));
  paint();
  document.addEventListener("click", e => { if (e.target.closest && e.target.closest('.nav-btn[data-view="chs"], .open-menu')) setTimeout(paint, 0); });
  let lp = null;
  bar.addEventListener("pointerdown", e => { const b = e.target.closest(".prm-bdg.off"); if (!b) return; lp = setTimeout(() => svToast(why(), 3000, b), 550); });
  ["pointerup", "pointerleave", "pointercancel"].forEach(t => bar.addEventListener(t, () => clearTimeout(lp)));
  bar.addEventListener("click", e => {
    const b = e.target.closest(".prm-bdg");
    if (!b) return;
    e.stopPropagation();
    paint();
    if (why()) return;
    if (b.dataset.bdg === "cal") sviBdgCalWin(); else sviBdgDatesWin();
  }, true);
  head.after(bar);
  const pane = document.createElement("div");
  pane.className = "prm-unit";
  pane.hidden = true;
  bar.after(pane);
  const others = () => [...view.children].filter(x => x !== head && x !== bar && x !== pane);
  const show = which => {
    bar.querySelectorAll(".prm-tab").forEach(b => b.classList.toggle("on", b.dataset.prm === which));
    others().forEach(x => { x.style.display = which === "chs" ? "" : "none"; });
    pane.hidden = which !== "unit";
    const add = document.getElementById("addChsBtn");
    if (add) add.style.display = which === "chs" ? "" : "none";
    const h1 = head.querySelector("h1"), sub = head.querySelector("p");
    if (h1) h1.textContent = which === "chs" ? "CHS — CHARGES STANDARDS" : "UNITÉS";
    if (sub) sub.textContent = which === "chs" ? "BIBLIOTHÈQUE DES CHARGES STANDARDS" : "INTITULÉ ET ABRÉVIATION (L'ABRÉVIATION EST CELLE UTILISÉE DANS LES TABLEAUX)";
    if (which === "unit") draw();
    try { localStorage.setItem("svi_prm_v1", which); } catch (e) {}
  };
  const draw = () => {
    const L = sviUnits();
    pane.innerHTML = `<table class="prm-table"><colgroup><col><col style="width:160px"><col style="width:44px"></colgroup>
      <thead><tr><th>UNITÉ</th><th class="center">ABRÉVIATION</th><th class="center"><input type="checkbox" class="prm-all" title="Tout cocher"></th></tr></thead>
      <tbody>${L.map((x, i) => `<tr data-i="${i}"><td><input class="prm-in" data-f="n" value="${esc(x.n)}" autocomplete="off"></td>
        <td class="center"><input class="prm-in center" data-f="a" value="${esc(x.a)}" autocomplete="off"></td>
        <td class="center"><input type="checkbox" class="prm-cb"></td></tr>`).join("")}
        <tr class="prm-new"><td><input class="prm-in" data-f="n" placeholder="SAISIR ICI…" autocomplete="off"></td><td class="center"><input class="prm-in center" data-f="a" autocomplete="off"></td><td></td></tr></tbody></table>
      <div class="prm-foot"><button type="button" class="prm-del" disabled>SUPPRIMER LES LIGNES COCHÉES <span class="svi-cnt">0</span></button></div>`;
  };
  const clean = v => String(v ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  pane.addEventListener("change", e => {
    const L = sviUnits();
    if (e.target.matches(".prm-all")) { pane.querySelectorAll(".prm-cb").forEach(c => { c.checked = e.target.checked; }); }
    if (e.target.matches(".prm-cb, .prm-all")) {
      const n = pane.querySelectorAll(".prm-cb:checked").length;
      const b = pane.querySelector(".prm-del");
      b.disabled = !n; b.querySelector(".svi-cnt").textContent = n;
      return;
    }
    const inp = e.target.closest(".prm-in");
    if (!inp) return;
    const tr = inp.closest("tr"), f = inp.dataset.f, v = clean(inp.value);
    inp.value = v;
    const i = tr.dataset.i !== undefined ? +tr.dataset.i : -1;
    /* pas de doublon d'abréviation ni d'intitulé */
    const dup = v && L.some((x, j) => j !== i && clean(x[f]) === v);
    if (dup) { svToast("DOUBLON : " + v + " EXISTE DÉJÀ.", 3500, inp); inp.value = i >= 0 ? L[i][f] : ""; setTimeout(() => inp.focus(), 0); return; }
    if (i >= 0) {
      L[i][f] = v;
      /* intitulé et abréviation effacés : la ligne est supprimée (FORMAT 90) */
      if (!clean(L[i].n) && !clean(L[i].a)) { L.splice(i, 1); sviUnitsSave(L); draw(); return; }
      sviUnitsSave(L); return;
    }
    if (!v) return;
    const row = { n: "", a: "" };
    row[f] = v;
    tr.querySelectorAll(".prm-in").forEach(x => { row[x.dataset.f] = clean(x.value); });
    L.push(row);
    sviUnitsSave(L);
    draw();
    const nt = pane.querySelector(`tr[data-i="${L.length - 1}"] .prm-in[data-f="${f === "n" ? "a" : "n"}"]`);
    if (nt) nt.focus();
  });
  pane.addEventListener("click", async e => {
    if (!e.target.closest(".prm-del") || e.target.closest(".prm-del").disabled) return;
    const idx = [...pane.querySelectorAll(".prm-cb")].map((c, i) => c.checked ? i : -1).filter(i => i >= 0);
    if (!idx.length) return;
    const L = sviUnits();
    const ok = await svConfirm({ title: "SUPPRIMER LES UNITÉS COCHÉES", html: `<ul class="svc-list">${idx.map(i => `<li>${esc(L[i].a + " — " + L[i].n)}</li>`).join("")}</ul>`, ok: "SUPPRIMER" });
    if (!ok) return;
    sviUnitsSave(L.filter((x, i) => !idx.includes(i)));
    draw();
  });
  bar.addEventListener("click", e => { const b = e.target.closest(".prm-tab"); if (b && b.dataset.prm) show(b.dataset.prm); });
  let start = "chs";
  try { start = localStorage.getItem("svi_prm_v1") || "chs"; } catch (e) {}
  show(start);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sviParamTabs); else sviParamTabs();
/* PARAMÉTRAGE › CALENDRIER : fenêtre CALENDRIER DU BUDGET (FORMAT 101) — un mois à la fois ;
   toucher un jour = travaillé ↔ non travaillé ; TOUS LES DIMANCHES / TOUS LES SAMEDIS ; ANNULER / ENREGISTRER */
function sviBdgCalWin(iso) {
  const L = window.__sviBdgLive;
  if (!L) return;
  if (!L.edit) { svToast("BUDGET FIGÉ OU VALIDÉ : LECTURE SEULE", 3000); return; }
  const c0 = L.cal(), cal = { we: c0.we.slice(), off: c0.off.slice(), on: c0.on.slice() };
  let cur = iso ? new Date(iso + "T00:00:00") : new Date(); if (isNaN(cur)) cur = new Date(); cur.setDate(1);
  const d = document.createElement("div");
  d.id = "svConf";
  const draw = () => {
    const y = cur.getFullYear(), m = cur.getMonth();
    const first = (new Date(y, m, 1).getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate();
    let cells = "";
    for (let i = 0; i < first; i++) cells += "<span></span>";
    for (let day = 1; day <= n; day++) {
      const di = sviIsoOf(new Date(y, m, day));
      const w = sviWork(cal, di), exc = cal.on.includes(di);
      cells += `<button type="button" data-d="${di}" class="${w ? "" : "off"}${exc ? " exc" : ""}">${day}</button>`;
    }
    d.innerHTML = `<div class="svc-card bcal-card" role="dialog" aria-modal="true">
      <button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
      <div class="svc-t">CALENDRIER DU BUDGET</div>
      <div class="svc-sub">${esc(L.ref || "")}</div>
      <div class="bcal-h"><button type="button" data-m="-1" aria-label="Mois précédent">‹</button><b>${SVI_MOIS[m]} ${y}</b><button type="button" data-m="1" aria-label="Mois suivant">›</button></div>
      <div class="bcal-w"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
      <div class="bcal-g">${cells}</div>
      <div class="bcal-rec"><label><input type="checkbox" data-we="0"${cal.we.includes(0) ? " checked" : ""}> TOUS LES DIMANCHES</label><label><input type="checkbox" data-we="6"${cal.we.includes(6) ? " checked" : ""}> TOUS LES SAMEDIS</label></div>
      <div class="svc-f"><button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button></div></div>`;
  };
  document.getElementById("svConf")?.remove();
  document.body.appendChild(d);
  draw();
  d.addEventListener("change", e => {
    const c = e.target.closest("[data-we]");
    if (!c) return;
    const k = Number(c.dataset.we);
    cal.we = cal.we.filter(x => x !== k);
    if (c.checked) cal.we.push(k);
    /* exceptions devenues inutiles retirées */
    cal.on = cal.on.filter(x => cal.we.includes(new Date(x + "T00:00:00").getDay()));
    cal.off = cal.off.filter(x => !cal.we.includes(new Date(x + "T00:00:00").getDay()));
    draw();
  });
  d.addEventListener("click", e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
    const mb = e.target.closest("[data-m]");
    if (mb) { cur.setMonth(cur.getMonth() + Number(mb.dataset.m)); draw(); return; }
    const db = e.target.closest("[data-d]");
    if (db) {
      const di = db.dataset.d, rec = cal.we.includes(new Date(di + "T00:00:00").getDay());
      if (sviWork(cal, di)) { if (cal.on.includes(di)) cal.on = cal.on.filter(x => x !== di); else cal.off.push(di); }
      else { if (cal.off.includes(di)) cal.off = cal.off.filter(x => x !== di); else if (rec) cal.on.push(di); }
      draw(); return;
    }
    if (e.target.closest("[data-ok]")) {
      d.remove();
      L.setCal(cal);   /* FORMAT 32 : pas de message de fin d'action (détail dans l'historique) */
    }
  });
}
/* PARAMÉTRAGE › DATES DU BUDGET : DATE BUTOIR (contrat du client) et DATE OBJECTIF (cible interne, au plus tard la butoir) */
function sviBdgDatesWin() {
  const L = window.__sviBdgLive;
  if (!L) return;
  const v = L.dates();
  const d = document.createElement("div");
  d.id = "svConf";
  d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true">
    <button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
    <div class="svc-t">DATES DU BUDGET</div>
    <div class="svc-sub">${esc(L.ref || "")}</div>
    <div class="bdt-row"><span>DATE BUTOIR</span><input type="date" data-f="but" value="${esc(v.but)}"></div>
    <div class="bdt-row"><span>DATE OBJECTIF</span><input type="date" data-f="obj" value="${esc(v.obj)}"${v.but ? ` max="${esc(v.but)}"` : ""}></div>
    <div class="svc-f"><button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button></div></div>`;
  document.getElementById("svConf")?.remove();
  document.body.appendChild(d);
  d.querySelectorAll('input[type="date"]').forEach(sviDateField);
  const ib = d.querySelector('[data-f="but"]'), io = d.querySelector('[data-f="obj"]');
  /* le calendrier de l'OBJECTIF ne propose pas de date après la BUTOIR, et celui de la BUTOIR pas avant l'OBJECTIF */
  d.addEventListener("change", () => {
    if (ib.value) io.setAttribute("max", ib.value); else io.removeAttribute("max");
    if (io.value) ib.setAttribute("min", io.value); else ib.removeAttribute("min");
  });
  d.dispatchEvent(new Event("change"));
  d.addEventListener("click", e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); return; }
    if (!e.target.closest("[data-ok]")) return;
    d.remove();
    L.setDates(ib.value, io.value);
  });
}


