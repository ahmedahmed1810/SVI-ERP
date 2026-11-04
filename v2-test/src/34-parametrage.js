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
  /* v790 (DOCUMENT UNIQUE §1.1) : une seule interface PARAMÉTRAGE à deux niveaux — RUBRIQUES (BUDGET, FORMAT), puis leurs onglets */
  bar.innerHTML = `<div class="prm-rubs"><button type="button" class="prm-rub on" data-rub="bdg">BUDGET</button><button type="button" class="prm-rub" data-rub="fmt">FORMAT</button></div>`
    + `<button type="button" class="prm-tab on" data-prm="unit" data-rub="bdg">UNITÉS</button><button type="button" class="prm-tab" data-prm="lib" data-rub="bdg">BIBLIOTHÈQUE DE PRIX</button>`
    + `<button type="button" class="prm-tab prm-bdg" data-bdg="cal" data-rub="bdg">CALENDRIER</button><button type="button" class="prm-tab" data-prm="tva" data-rub="bdg">TVA</button><button type="button" class="prm-tab" data-prm="trk" data-rub="bdg">TRANSPORT</button>`
    + `<button type="button" class="prm-tab" data-prm="col" data-rub="fmt" hidden>ÉTATS</button><button type="button" class="prm-tab" data-prm="fel" data-rub="fmt" hidden>ÉLÉMENTS</button><button type="button" class="prm-tab" data-prm="fif" data-rub="fmt" hidden>INTERFACES</button><button type="button" class="prm-tab" data-prm="colh" data-rub="fmt" hidden>COLONNES</button><button type="button" class="prm-tab" data-prm="mask" data-rub="fmt" hidden>MASQUES DE SAISIE</button>`;
  /* CALENDRIER et DATES DU BUDGET : pour le budget ouvert ; grisés sans budget ouvert (appui long = raison) */
  const why = () => { const L = window.__sviBdgLive; return !L ? "OUVRIR UN BUDGET D'ABORD" : !L.edit ? "BUDGET FIGÉ OU VALIDÉ : LECTURE SEULE" : ""; };
  const paint = () => bar.querySelectorAll(".prm-bdg").forEach(b => b.classList.toggle("off", !!why()));
  paint();
  document.addEventListener("click", e => { if (e.target.closest && e.target.closest('.nav-btn[data-view="chs"], .open-menu')) setTimeout(paint, 0); });
  let lp = null;
  bar.addEventListener("pointerdown", e => { const b = e.target.closest(".prm-bdg.off"); if (!b) return; lp = setTimeout(() => svToast(why(), 3000, b), SVI_G.lp); });
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
  /* v739 : BIBLIOTHÈQUE DE PRIX (FORMAT 268) */
  const lpane = document.createElement("div");
  lpane.className = "prm-lib";
  lpane.hidden = true;
  pane.after(lpane);
  /* v754 : COULEURS des états (EN INSTANCE, FIGÉ, VALIDÉ, EXPIRÉ, BLOQUÉ, ARCHIVÉ) — communes à toute l'application */
  const cpane = document.createElement("div");
  cpane.className = "prm-col";
  cpane.hidden = true;
  lpane.after(cpane);
  /* v790 : FORMAT › ÉLÉMENTS — fond, texte, taille, gras, italique, souligné de chaque élément ; FORMAT › INTERFACES — APPLIQUER À */
  const epane = document.createElement("div"); epane.className = "prm-fel"; epane.hidden = true; cpane.after(epane);
  const ipane = document.createElement("div"); ipane.className = "prm-fif"; ipane.hidden = true; epane.after(ipane);
  /* v796 (DOCUMENT UNIQUE §6.8) : FORMAT › COLONNES — MASQUER / AFFICHER LES COLONNES de chaque tableau (« INTERFACE › TABLEAU ») ; toucher une ligne ouvre ses colonnes */
  const hpane = document.createElement("div"); hpane.className = "prm-colh"; hpane.hidden = true; ipane.after(hpane);
  const colhDraw = () => {
    const L = sviColhRegList();
    hpane.innerHTML = `<table class="prm-table fmt-t colh-reg"><colgroup><col style="width:420px"><col style="width:110px"><col style="width:110px"></colgroup>
      <thead><tr><th>TABLEAU</th><th class="center">COLONNES</th><th class="center">MASQUÉES</th></tr></thead>
      <tbody>${L.map(x => `<tr class="colh-open" data-colh="${esc(x.id)}"><td>${esc(x.lab)}</td><td class="center">${svCnt(x.cols.length)}</td><td class="center">${svCnt(x.hid.length)}</td></tr>`).join("")}</tbody></table>`;
  };
  /* v804 (checklist C1.44) : FORMAT › MASQUES DE SAISIE — 9 = un chiffre, A = une lettre, autre signe écrit tel quel */
  const mpane = document.createElement("div"); mpane.className = "prm-mask"; mpane.hidden = true; hpane.after(mpane);
  /* v899 (cahier, décision du 03/11/2026) : BUDGET › TVA — TVA PAR DÉFAUT, un seul réglage commun au budget et aux achats */
  const tpane = document.createElement("div"); tpane.className = "prm-tva"; tpane.hidden = true; mpane.after(tpane);
  const tvaDraw = () => { const d = sviTvaDef();
    tpane.innerHTML = `<table class="prm-table fmt-t tva-t"><colgroup><col style="width:420px"><col style="width:140px"></colgroup>
      <thead><tr><th>RÉGLAGE</th><th class="center">TAUX %</th></tr></thead>
      <tbody><tr><td>TVA PAR DÉFAUT (DÉSIGNATIONS SANS TVA, ARTICLES ET PIÈCES D'ACHAT)</td><td class="center"><input class="ins-in tva-def number" inputmode="decimal" value="${d === null ? "" : esc(String(d).replace(".", ","))}" autocomplete="off"></td></tr></tbody></table>
      <div class="mask-note">VIDE : UNE DÉSIGNATION SANS TVA NE PEUT PAS ÊTRE ENREGISTRÉE (TVA MANQUANTE)</div>`; };
  /* v913 : BUDGET › TRANSPORT — PRIX DU TRANSPORT AU KM, le même pour tous les fournisseurs (distance à vol d'oiseau dépôt → chantier) */
  const kpane = document.createElement("div"); kpane.className = "prm-trk"; kpane.hidden = true; tpane.after(kpane);
  const trkDraw = () => { const k = sviTrKm();
    kpane.innerHTML = `<table class="prm-table fmt-t tva-t"><colgroup><col style="width:420px"><col style="width:140px"></colgroup>
      <thead><tr><th>RÉGLAGE</th><th class="center">DH / KM</th></tr></thead>
      <tbody><tr><td>PRIX DU TRANSPORT AU KILOMÈTRE (TOUS LES FOURNISSEURS)</td><td class="center"><input class="ins-in trk-km number" inputmode="decimal" value="${k === null ? "" : esc(String(k).replace(".", ","))}" autocomplete="off"></td></tr></tbody></table>
      <div class="mask-note">DISTANCE À VOL D'OISEAU ENTRE LE DÉPÔT DU FOURNISSEUR (GPS DE SA FICHE) ET LE CHANTIER (GPS DU CHANTIER DANS INF)</div>`; };
  kpane.addEventListener("change", e => { const i = e.target.closest(".trk-km"); if (!i) return; const s = String(i.value).trim();
    if (s === "") { sviTrKmSave(null); trkDraw(); return; }
    const v = num(s); if (!sviNumOk(s) || v < 0) { svToast("PRIX AU KM NON VALIDE.", 3000, i); trkDraw(); return; }
    sviTrKmSave(v); trkDraw(); });
  tpane.addEventListener("change", e => { const i = e.target.closest(".tva-def"); if (!i) return; const s = String(i.value).trim();
    if (s === "") { sviTvaSave(null); tvaDraw(); return; }
    const v = num(s); if (!sviNumOk(s) || v < 0 || v > 100) { svToast("TVA NON VALIDE (0 À 100).", 3000, i); tvaDraw(); return; }
    sviTvaSave(v); tvaDraw(); });
  const maskDraw = () => {
    const L = sviMasks();
    mpane.innerHTML = `<table class="prm-table fmt-t mask-t"><colgroup><col style="width:280px"><col style="width:220px"><col style="width:150px"><col style="width:220px"></colgroup>
      <thead><tr><th>CHAMP</th><th>MASQUE</th><th class="center">LONGUEUR EXACTE</th><th>EXEMPLE</th></tr></thead>
      <tbody>${L.map(x => `<tr data-mk="${esc(x.k)}"><td>${esc(x.lab)}</td><td><input class="ins-in mask-in" value="${esc(x.m)}" autocomplete="off" data-keepcase></td>
        <td class="center"><input type="checkbox" class="mask-ex"${x.ex ? " checked" : ""}></td><td class="mask-exm">${esc(sviMaskFmt(x.k, "1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S"))}</td></tr>`).join("")}</tbody></table>
      <div class="mask-note">9 = UN CHIFFRE · A = UNE LETTRE · TOUT AUTRE SIGNE (ESPACE, TIRET, +) EST ÉCRIT TEL QUEL · MASQUE VIDE = AUCUN CONTRÔLE</div>`;
  };
  mpane.addEventListener("change", e => {
    const tr = e.target.closest("tr[data-mk]"); if (!tr) return;
    const L = sviMasks(), x = L.find(y => y.k === tr.dataset.mk); if (!x) return;
    const m = String(tr.querySelector(".mask-in").value || "").toUpperCase().replace(/\s+/g, " ").trim();
    if (m && ![...m].some(sviMaskSlot)) { svToast("MASQUE SANS 9 NI A : AUCUNE SAISIE POSSIBLE.", 3500); maskDraw(); return; }
    x.m = m; x.ex = tr.querySelector(".mask-ex").checked; sviMasksSave(L); maskDraw();
  });
  hpane.addEventListener("click", e => { const r = e.target.closest("tr.colh-open"); if (!r) return; const I = sviColhRegInfo(r.dataset.colh); if (!I) return; I.done = colhDraw; sviColhWinI(I); });
  const felDraw = () => {
    const F = sviFmt();
    epane.innerHTML = `<table class="prm-table fmt-t"><colgroup><col style="width:300px"><col style="width:90px"><col style="width:90px"><col style="width:90px"><col style="width:70px"><col style="width:70px"><col style="width:80px"><col style="width:120px"></colgroup>
      <thead><tr><th>ÉLÉMENT</th><th class="center">FOND</th><th class="center">TEXTE</th><th class="center">TAILLE</th><th class="center">GRAS</th><th class="center">ITALIQUE</th><th class="center">SOULIGNÉ</th><th></th></tr></thead>
      <tbody>${SVI_FMT_EL.map(E => { const o = F.el[E.k] || {}, v = f => o[f] !== undefined ? o[f] : E.def[f];
        return `<tr data-el="${E.k}"><td class="fmt-lab" style="background:${esc(v("bg"))};color:${esc(v("c"))};font-weight:${v("b") ? 800 : 400};font-style:${v("i") ? "italic" : "normal"};text-decoration:${v("u") ? "underline" : "none"}">${esc(E.lab)}</td>
        ${(() => { const ok = f => !E.f || E.f.includes(f), no = '<td class="center fmt-na">—</td>';   /* v923 : réglage sans objet = — */
          return (ok("bg") ? `<td class="center"><input type="color" class="fmt-in" data-f="bg" value="${esc(v("bg"))}"></td>` : no) + (ok("c") ? `<td class="center"><input type="color" class="fmt-in" data-f="c" value="${esc(v("c") || "#000000")}"></td>` : no)
          + (ok("fs") ? `<td class="center"><input class="fmt-in fmt-fs center" data-f="fs" inputmode="numeric" value="${esc(v("fs"))}"></td>` : no)
          + ["b", "i", "u"].map(f => ok(f) ? `<td class="center"><input type="checkbox" class="fmt-in" data-f="${f}"${v(f) ? " checked" : ""}></td>` : no).join(""); })()}
        <td class="center">${F.el[E.k] ? `<button type="button" class="col-rst" data-fel="${E.k}">PAR DÉFAUT</button>` : ""}</td></tr>`; }).join("")}</tbody></table>`;
  };
  const fifDraw = () => {
    const F = sviFmt(), on = k => !F.to || F.to.includes(k);
    /* v793 (DOCUMENT UNIQUE §6.4) : case à droite */
    ipane.innerHTML = `<table class="prm-table fmt-t"><colgroup><col style="width:360px"><col style="width:90px"></colgroup>
      <thead><tr><th>APPLIQUER À</th><th class="center"><input type="checkbox" class="fif-all"${SVI_FMT_IF.every(x => on(x.k)) ? " checked" : ""}></th></tr></thead>
      <tbody>${SVI_FMT_IF.map(x => `<tr><td>${esc(x.lab)}</td><td class="center"><input type="checkbox" class="fif-cb" data-if="${x.k}"${on(x.k) ? " checked" : ""}></td></tr>`).join("")}</tbody></table>`;
  };
  epane.addEventListener("input", e => { const i = e.target.closest(".fmt-in"); if (!i || i.type === "checkbox") return; const k = i.closest("tr").dataset.el, F = sviFmt(); F.el[k] = F.el[k] || {};
    if (i.dataset.f === "fs") { const n = parseInt(String(i.value).replace(/\D/g, ""), 10); if (!(n >= 8 && n <= 40)) return; F.el[k].fs = n; } else F.el[k][i.dataset.f] = i.value;
    sviFmtSave(F); });
  epane.addEventListener("change", e => { const i = e.target.closest(".fmt-in"); if (!i) return; if (i.type === "checkbox") { const k = i.closest("tr").dataset.el, F = sviFmt(); F.el[k] = F.el[k] || {}; F.el[k][i.dataset.f] = i.checked ? 1 : 0; sviFmtSave(F); } felDraw(); });
  epane.addEventListener("click", e => { const b = e.target.closest("[data-fel]"); if (!b) return; const F = sviFmt(); delete F.el[b.dataset.fel]; sviFmtSave(F); felDraw(); });
  ipane.addEventListener("change", e => { const F = sviFmt();
    if (e.target.matches(".fif-all")) F.to = e.target.checked ? null : [];
    else if (e.target.matches(".fif-cb")) { const cur = F.to || SVI_FMT_IF.map(x => x.k), k = e.target.dataset.if; F.to = e.target.checked ? [...new Set([...cur, k])] : cur.filter(x => x !== k); if (F.to.length >= SVI_FMT_IF.length) F.to = null; }
    sviFmtSave(F); fifDraw(); });
  const colDraw = () => {
    const C = sviColors();
    cpane.innerHTML = `<table class="prm-table"><colgroup><col style="width:200px"><col style="width:90px"><col style="width:260px"><col style="width:120px"></colgroup>
      <thead><tr><th>ÉTAT</th><th class="center">COULEUR</th><th>APERÇU</th><th></th></tr></thead>
      <tbody>${SVI_COL_LAB.map(([k, l]) => `<tr data-col="${k}"><td>${l}</td><td class="center"><input type="color" class="col-in" data-col="${k}" value="${esc(C[k])}" aria-label="Couleur ${esc(l)}"></td>
        <td class="col-prev" style="color:${esc(C[k])}">BDG 26-1101/001 — ${l}</td>
        <td class="center">${C[k].toLowerCase() !== SVI_COL_DEF[k] ? `<button type="button" class="col-rst" data-col="${k}">PAR DÉFAUT</button>` : ""}</td></tr>`).join("")}</tbody></table>`;
  };
  cpane.addEventListener("input", e => { const i = e.target.closest(".col-in"); if (!i) return; const C = sviColors(); C[i.dataset.col] = i.value; sviColorsSave(C);
    const pv = i.closest("tr").querySelector(".col-prev"); if (pv) pv.style.color = i.value; });
  cpane.addEventListener("change", e => { if (e.target.closest(".col-in")) colDraw(); });
  cpane.addEventListener("click", e => { const b = e.target.closest(".col-rst"); if (!b) return; const C = sviColors(); C[b.dataset.col] = SVI_COL_DEF[b.dataset.col]; sviColorsSave(C); colDraw(); });
  const show = which => {
    const rub = ["col", "fel", "fif", "colh", "mask"].includes(which) ? "fmt" : "bdg";
    bar.querySelectorAll(".prm-rub").forEach(b => b.classList.toggle("on", b.dataset.rub === rub));
    bar.querySelectorAll(".prm-tab").forEach(b => { b.hidden = b.dataset.rub !== rub; });
    bar.querySelectorAll(".prm-tab").forEach(b => b.classList.toggle("on", b.dataset.prm === which));
    pane.hidden = which !== "unit";
    lpane.hidden = which !== "lib";
    cpane.hidden = which !== "col";
    epane.hidden = which !== "fel"; ipane.hidden = which !== "fif"; hpane.hidden = which !== "colh"; mpane.hidden = which !== "mask"; tpane.hidden = which !== "tva"; kpane.hidden = which !== "trk";
    if (which === "tva") tvaDraw(); if (which === "trk") trkDraw();
    if (which === "fel") felDraw(); if (which === "fif") fifDraw(); if (which === "colh") colhDraw(); if (which === "mask") maskDraw();
    const h1 = head.querySelector("h1"), sub = head.querySelector("p");
    if (h1) h1.textContent = which === "trk" ? "TRANSPORT" : which === "tva" ? "TVA" : which === "lib" ? "BIBLIOTHÈQUE DE PRIX" : which === "col" ? "FORMAT — ÉTATS" : which === "fel" ? "FORMAT — ÉLÉMENTS" : which === "fif" ? "FORMAT — INTERFACES" : which === "colh" ? "FORMAT — COLONNES" : which === "mask" ? "FORMAT — MASQUES DE SAISIE" : "UNITÉS";
    if (sub) sub.textContent = which === "trk" ? "PRIX DU TRANSPORT AU KM, LE MÊME POUR TOUS LES FOURNISSEURS" : which === "tva" ? "TVA PAR DÉFAUT, COMMUNE AU BUDGET ET AUX ACHATS" : which === "lib" ? "RECETTES PAR ACTIVITÉ SECONDAIRE : CHARGES, UNITÉ, PRIX ET QUANTITÉ POUR UNE UNITÉ DE PRODUIT ; COMMUNE À TOUS LES BUDGETS" : "INTITULÉ ET ABRÉVIATION (L'ABRÉVIATION EST CELLE UTILISÉE DANS LES TABLEAUX)";
    if (which === "unit") draw();
    if (which === "lib") libDraw();
    if (which === "col") { colDraw(); if (sub) sub.textContent = "COULEUR DE CHAQUE ÉTAT, COMMUNE À TOUTE L'APPLICATION ET À TOUS LES APPAREILS"; }
    if (which === "fel" && sub) sub.textContent = "FOND, TEXTE, TAILLE ET STYLE DE CHAQUE ÉLÉMENT DES INTERFACES";
    if (which === "fif" && sub) sub.textContent = "INTERFACES QUI PRENNENT LA PALETTE (TOUTES COCHÉES = PARTOUT)";
    if (which === "colh" && sub) sub.textContent = "MASQUER / AFFICHER LES COLONNES DE CHAQUE TABLEAU (UN TABLEAU S'INSCRIT ICI DÈS SA PREMIÈRE OUVERTURE)";
    if (which === "mask" && sub) sub.textContent = "FORME DE SAISIE DE L'ICE, DE L'IF, DU RC, DE LA CNSS ET DU TÉLÉPHONE ; UNE VALEUR HORS MASQUE EST REFUSÉE À L'ENREGISTREMENT";
    try { localStorage.setItem("svi_prm_v1", which); } catch (e) {}
  };
  /* v793 : UNITÉS au format commun des tableaux — loupe de tri / filtre sur chaque colonne, largeur des colonnes réglable et gardée */
  const UKIT = sviCfKit({ key: "prm_unit", shell: {}, refresh: () => draw() });
  const UCOLS = [["n", "UNITÉ", x => x.n, ""], ["a", "ABRÉVIATION", x => x.a, "center"]];
  const draw = () => {
    const L = sviUnits(), R = UKIT.cfApply("prm_unit", UCOLS, L.map((x, i) => ({ ...x, __i: i }))), CG = sviCwCols("prm_unit", [["n", 260], ["a", 160]], [["_cb", 44]]);
    pane.innerHTML = `<table class="prm-table" data-svcw="prm_unit" style="${CG.style}">${CG.cg}
      <thead><tr>${UCOLS.map(c => UKIT.cfHead("prm_unit", c[0], c[1], c[3])).join("")}<th class="center"><input type="checkbox" class="prm-all" title="Tout cocher"></th></tr></thead>
      <tbody>${R.map(x => x.__i).map(i => [L[i], i]).map(([x, i]) => `<tr data-i="${i}"><td><input class="prm-in" data-f="n" value="${esc(x.n)}" autocomplete="off"></td>
        <td class="center"><input class="prm-in center" data-f="a" value="${esc(x.a)}" autocomplete="off"></td>
        <td class="center"><input type="checkbox" class="prm-cb"></td></tr>`).join("")}
        <tr class="prm-new"><td><input class="prm-in" data-f="n" placeholder="CRÉER UNE UNITÉ ICI…" autocomplete="off"></td><td class="center"><input class="prm-in center" data-f="a" autocomplete="off"></td><td></td></tr></tbody></table>
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
    const cf = e.target.closest(".cf-btn"); if (cf) { e.preventDefault(); e.stopPropagation(); UKIT.cfOpenMenu(cf); return; }
    if (!e.target.closest(".prm-del") || e.target.closest(".prm-del").disabled) return;
    const idx = [...pane.querySelectorAll(".prm-cb:checked")].map(c => +c.closest("tr").dataset.i);
    if (!idx.length) return;
    const L = sviUnits();
    const ok = await svConfirm({ title: "SUPPRIMER LES UNITÉS COCHÉES", html: `<ul class="svc-list">${idx.map(i => `<li>${esc(L[i].a + " — " + L[i].n)}</li>`).join("")}</ul>`, ok: "SUPPRIMER" });
    if (!ok) return;
    sviUnitsSave(L.filter((x, i) => !idx.includes(i)));
    draw();
  });
  bar.addEventListener("click", e => { const r = e.target.closest(".prm-rub"); if (r) { show(r.dataset.rub === "fmt" ? "col" : "unit"); return; } const b = e.target.closest(".prm-tab"); if (b && b.dataset.prm) show(b.dataset.prm); });
  /* v739 : BIBLIOTHÈQUE DE PRIX — activités à gauche, recettes et leurs charges à droite ; tout modifiable ; enregistré aussitôt */
  let libAct = "";
  const U2 = v => String(v ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  const N2 = v => Number(String(v ?? "").replace(/\s/g, "").replace(",", ".")) || 0;
  const F2 = (v, d) => (Number(v) || 0).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  /* v793 : BIBLIOTHÈQUE au format commun — loupes sur chaque colonne, largeur réglable, cases à droite (plus de ✕ par ligne) */
  const LKIT = sviCfKit({ key: "prm_lib", shell: {}, refresh: () => libDraw() });
  const LACOLS = [["act", "ACTIVITÉ SECONDAIRE", x => x, ""], ["n", "RECETTES", x => sviLibGet().filter(R => U2(R.act) === x).length, "center"]];
  const LCCOLS = [["des", "CHARGE", x => x.c.des, ""], ["u", "UNITÉ", x => x.c.u, "center"], ["k", "QTÉ POUR 1 U", x => N2(x.c.k), "number"], ["p", "PCB", x => N2(x.c.p), "number"], ["c", "COÛT", x => N2(x.c.k) * N2(x.c.p), "number"]];
  const libDraw = () => {
    const L = sviLibGet(), acts0 = [...new Set(L.map(R => U2(R.act)))].sort((a, b) => a.localeCompare(b, "fr")), acts = LKIT.cfApply("prm_liba", LACOLS, acts0);
    if (!acts.includes(libAct)) libAct = acts[0] || "";
    const R0 = L.filter(R => U2(R.act) === libAct);
    /* v793 : largeur des colonnes réglable et gardée (moteur commun) */
    const LA = sviCwCols("prm_liba", [["act", 240], ["n", 100]]), LC = sviCwCols("prm_libc", [["des", 220], ["u", 80], ["k", 120], ["p", 110], ["c", 110]], [["_x", 44]]);
    lpane.innerHTML = `<div class="lib-wrap"><div class="lib-acts"><table class="prm-table" data-svcw="prm_liba" style="${LA.style}">${LA.cg}<thead><tr>${LACOLS.map(c => LKIT.cfHead("prm_liba", c[0], c[1], c[3])).join("")}</tr></thead><tbody>
        ${acts.map(a => `<tr class="lib-a${a === libAct ? " on" : ""}" data-act="${esc(a)}"><td>${esc(a)}</td><td class="center">${svCnt(L.filter(R => U2(R.act) === a).length)}</td></tr>`).join("") || `<tr><td colspan="2" class="empty">BIBLIOTHÈQUE VIDE : ELLE SE REMPLIT AU FIL DES BUDGETS FIGÉS, OU ICI.</td></tr>`}
        <tr class="prm-new"><td colspan="2"><input class="prm-in lib-newa" placeholder="CRÉER UNE RECETTE ICI… (ACTIVITÉ — VARIANTE)" autocomplete="off"></td></tr></tbody></table></div>
      <div class="lib-recs">${R0.map(R => `<div class="lib-rec" data-rid="${esc(R.id)}"><div class="lib-rh"><b>${esc(U2(R.act))} —</b> <input class="prm-in lib-in" data-f="nom" value="${esc(R.nom)}" autocomplete="off"> <span>UNITÉ</span> <input class="prm-in lib-in center" data-f="u" value="${esc(R.u || "")}" style="width:60px" autocomplete="off">${R.chk ? ' <span class="lib-chk">À VÉRIFIER</span>' : ""}
          <small>${(R.des || []).length ? "UTILISÉE : " + esc((R.des || []).slice(0, 3).join(", ")) : ""}</small><button type="button" class="prm-del lib-del" data-rdel="${esc(R.id)}" title="Supprimer la recette">✕</button></div>
        <table class="prm-table lib-t" data-svcw="prm_libc" style="${LC.style}">${LC.cg}<thead><tr>${LCCOLS.map(c => LKIT.cfHead("prm_libc_" + R.id, c[0], c[0] === "k" ? "QTÉ POUR 1 " + esc(R.u || "U") : c[1], c[3])).join("")}<th class="center"><input type="checkbox" class="lib-call" aria-label="Tout cocher"></th></tr></thead><tbody>
          ${LKIT.cfApply("prm_libc_" + R.id, LCCOLS, (R.chg || []).map((c, i) => ({ c, i }))).map(({ c, i }) => `<tr data-ci="${i}"><td><input class="prm-in lib-c" data-f="des" value="${esc(c.des)}" autocomplete="off"></td><td><input class="prm-in lib-c center" data-f="u" value="${esc(c.u)}" autocomplete="off"></td>
            <td><input class="prm-in lib-c number" data-f="k" inputmode="decimal" value="${esc(F2(c.k, 4))}" autocomplete="off"></td><td><input class="prm-in lib-c number" data-f="p" inputmode="decimal" value="${esc(F2(c.p, 2))}" autocomplete="off"></td>
            <td class="number">${esc(F2(N2(c.k) * N2(c.p), 2))}</td><td class="center"><input type="checkbox" class="lib-ccb" data-cdel="${i}" aria-label="Cocher"></td></tr>`).join("")}
          <tr class="prm-new"><td colspan="6"><input class="prm-in lib-newc" placeholder="CRÉER UNE CHARGE ICI…" autocomplete="off"></td></tr></tbody></table>
        <div class="prm-foot"><button type="button" class="prm-del lib-cdels" disabled>SUPPRIMER LES LIGNES COCHÉES <span class="svi-cnt">0</span></button></div></div>`).join("") || `<div class="empty">CHOISIR UNE ACTIVITÉ, OU CRÉER UNE RECETTE (ACTIVITÉ — VARIANTE).</div>`}</div></div>`;
  };
  const libSave = (L, keep) => { sviLibSet(L); if (!keep) libDraw(); };
  lpane.addEventListener("click", e => {
    const a = e.target.closest(".lib-a"); if (a) { libAct = a.dataset.act; libDraw(); return; }
    const rd = e.target.closest("[data-rdel]"); if (rd) { (async () => { const L = sviLibGet(), R = L.find(x => x.id === rd.dataset.rdel); if (!R) return; if (typeof svConfirm === "function" && !(await svConfirm({ title: "SUPPRIMER LA RECETTE", text: U2(R.act) + " — " + R.nom, ok: "SUPPRIMER" }))) return; libSave(L.filter(x => x !== R)); })(); return; }
    const cf = e.target.closest(".cf-btn"); if (cf) { e.preventDefault(); e.stopPropagation(); LKIT.cfOpenMenu(cf); return; }
    const cd = e.target.closest(".lib-cdels"); if (cd && !cd.disabled) { const rec = cd.closest(".lib-rec"), L = sviLibGet(), R = L.find(x => x.id === rec.dataset.rid);
      const ix = [...rec.querySelectorAll(".lib-ccb:checked")].map(c => +c.dataset.cdel); if (R && ix.length) { R.chg = R.chg.filter((c, i) => !ix.includes(i)); libSave(L); } }
  });
  lpane.addEventListener("change", e => {
    const t = e.target, L = sviLibGet();
    if (t.matches(".lib-call, .lib-ccb")) { const rec = t.closest(".lib-rec"), cbs = [...rec.querySelectorAll(".lib-ccb")]; if (t.matches(".lib-call")) cbs.forEach(c => { c.checked = t.checked; });
      const n = cbs.filter(c => c.checked).length, d = rec.querySelector(".lib-cdels"); d.disabled = !n; d.querySelector(".svi-cnt").textContent = n; return; }
    if (t.classList.contains("lib-newa")) {
      const v = U2(t.value), [act, ...rest] = v.split(/\s+[—-]\s+/); if (!act) return;
      const R = sviLibAdd(L, { act: U2(act), nom: U2(rest.join(" — ")) || "RECETTE", u: "", chg: [], des: [], lot: [], src: "PARAMÉTRAGE", date: new Date().toISOString().slice(0, 10) });
      libAct = U2(R.act); libSave(L); return;
    }
    const rec = t.closest(".lib-rec"), R = rec && L.find(x => x.id === rec.dataset.rid); if (!R) return;
    if (t.classList.contains("lib-in")) { R[t.dataset.f] = U2(t.value); libSave(L); return; }
    if (t.classList.contains("lib-newc")) { const v = U2(t.value); if (!v) return; R.chg = R.chg || []; R.chg.push({ des: v, u: "", k: 0, p: 0 }); libSave(L);
      setTimeout(() => { const i = lpane.querySelector(`.lib-rec[data-rid="${CSS.escape(R.id)}"] tr[data-ci="${R.chg.length - 1}"] input[data-f="u"]`); if (i) i.focus(); }, 0); return; }
    if (t.classList.contains("lib-c")) { const c = R.chg[Number(t.closest("tr").dataset.ci)]; if (!c) return; const f = t.dataset.f; c[f] = f === "k" || f === "p" ? N2(t.value) : U2(t.value); libSave(L); }
  });
  /* v727 (bloc 11.1) : CHS n'existe plus — PARAMÉTRAGE ouvre UNITÉS */
  show("unit");
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
  const d = sviWinNew();
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
      ${window.__sviDlyScale ? `<div class="bcal-sc"><span>AFFICHAGE DU GANTT</span>${[["j", "JOUR"], ["s", "SEMAINE"], ["m", "MOIS"]].map(([v, l]) => `<button type="button" data-sc="${v}" class="${window.__sviDlyScale.get() === v ? "on" : ""}">${l}</button>`).join("")}</div>` : ""}
      <div class="bcal-h"><button type="button" data-m="-1" aria-label="Mois précédent">‹</button><b>${SVI_MOIS[m]} ${y}</b><button type="button" data-m="1" aria-label="Mois suivant">›</button></div>
      <div class="bcal-w"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
      <div class="bcal-g">${cells}</div>
      <div class="bcal-rec"><label><input type="checkbox" data-we="0"${cal.we.includes(0) ? " checked" : ""}> TOUS LES DIMANCHES</label><label><input type="checkbox" data-we="6"${cal.we.includes(6) ? " checked" : ""}> TOUS LES SAMEDIS</label></div>
      <div class="svc-f"><button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button></div></div>`;
  };
  document.getElementById("svConf")?.remove();
  sviWinShow(d);
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
    /* v546 (R17) : affichage du Gantt choisi ici (aussitôt, sans ENREGISTRER) */
    const sb = e.target.closest("[data-sc]");
    if (sb && window.__sviDlyScale) { window.__sviDlyScale.set(sb.dataset.sc); draw(); return; }
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
  const d = sviWinNew();
  d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true">
    <button type="button" class="svc-close" data-x aria-label="Fermer">✕</button>
    <div class="svc-t">DATES DU BUDGET</div>
    <div class="svc-sub">${esc(L.ref || "")}</div>
    <div class="bdt-row"><span>DATE BUTOIR</span><input type="date" data-f="but" value="${esc(v.but)}"></div>
    <div class="bdt-row"><span>DATE OBJECTIF</span><input type="date" data-f="obj" value="${esc(v.obj)}"${v.but ? ` max="${esc(v.but)}"` : ""}></div>
    <div class="svc-f"><button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button></div></div>`;
  document.getElementById("svConf")?.remove();
  sviWinShow(d);
  d.querySelectorAll('input[type="date"]').forEach(sviDateField);
  const ib = d.querySelector('[data-f="but"]'), io = d.querySelector('[data-f="obj"]');
  /* le calendrier de l'OBJECTIF ne propose pas de date après la BUTOIR, et celui de la BUTOIR pas avant l'OBJECTIF */
  /* v902 : date refusée dès la saisie (même règle qu'INF) — la case reprend sa valeur d'avant, avec la raison */
  const prev = { but: ib.value, obj: io.value };
  d.addEventListener("change", e => {
    const i = e.target && e.target.closest && e.target.closest('input[data-f="but"], input[data-f="obj"]');
    if (i) { const why = sviBdgDateWhy(i.dataset.f, v.deb || "", io.value, ib.value);
      if (why) { i.value = prev[i.dataset.f]; svToast(why, 4500, i); } else prev[i.dataset.f] = i.value; }
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


