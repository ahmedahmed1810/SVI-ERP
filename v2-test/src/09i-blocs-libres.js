/* =========================================================
   v1147 (série L, L3 ; document unique 4.1, 4.3, 9.3) : BLOCS LIBRES — moteur commun.
   sviFreeMount(hôte, clé, sélecteur des blocs, clé d'un bloc) : à chaque dessin de l'interface.
   - Tant que rien n'a été déplacé ni réglé, les blocs restent empilés sur toute la largeur (disposition par défaut).
   - Glisser un bloc par sa barre de titre (à partir de 8 px, 9.1) : il se place librement ; lâché, il reste où il est ;
     jamais de chevauchement — un bloc lâché sur un autre le pousse vers le bas.
   - Coin en bas à droite : largeur (pas de 5 %) et hauteur du bloc.
   - Place et taille gardées par interface (localStorage svi_free_v1 : { clé: { bloc: { x, w, y, h } } }, x et w en % de la largeur) ;
     DISPOSITION PAR DÉFAUT efface la clé (sviFreeClear).
   ========================================================= */
const SVI_FREE_K = "svi_free_v1";
const sviFreeAll = () => { try { return JSON.parse(localStorage.getItem(SVI_FREE_K) || "{}") || {}; } catch (e) { return {}; } };
const sviFreeGet = k => sviFreeAll()[k] || null;
const sviFreeSet = (k, L) => { const A = sviFreeAll(); if (L) A[k] = L; else delete A[k]; try { localStorage.setItem(SVI_FREE_K, JSON.stringify(A)); } catch (e) {} };
const sviFreeClear = k => sviFreeSet(k, null);
const sviFreeHas = host => { const k = host && (host.dataset.svf || (host.querySelector("[data-svf]") || {}).dataset?.svf); return !!(k && sviFreeGet(k)); };
const SVI_FREE_GAP = 10, SVI_FREE_SNAP = 5;
const sviFreeW = host => { const cs = getComputedStyle(host); return host.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0); };
/* place les blocs : par ordre de haut (le bloc « prio » d'abord, à sa place), chacun poussé sous ceux déjà placés qu'il recouvre en largeur */
function sviFreeLayout(host, prio) {
  const k = host.dataset.svf, L = sviFreeGet(k), B = host.__svfBlocks || [];
  host.classList.toggle("svf-on", !!L);
  B.forEach(b => { b.classList.toggle("svf-b", !!L); if (!L) { ["position", "left", "top", "width", "height"].forEach(p => b.style.removeProperty(p)); b.classList.remove("svf-h"); } });
  if (!L) { host.style.removeProperty("height"); host.style.removeProperty("position"); return; }
  const cs = getComputedStyle(host), pl = parseFloat(cs.paddingLeft) || 0, W = host.clientWidth - pl - (parseFloat(cs.paddingRight) || 0), top0 = host.__svfTop || 0;
  host.style.position = "relative";
  let yEnd = top0; B.forEach(b => { if (!L[b.dataset.svfk]) { L[b.dataset.svfk] = { x: 0, w: 100, y: 1e6 + yEnd++ }; } });   /* bloc nouveau : en bas, toute la largeur */
  B.forEach(b => { const o = L[b.dataset.svfk]; b.style.position = "absolute"; b.style.left = (pl + o.x / 100 * W) + "px"; b.style.width = (o.w / 100 * W - (o.x + o.w < 100 ? SVI_FREE_GAP : 0)) + "px";
    if (o.h) { b.style.height = o.h + "px"; b.classList.add("svf-h"); } else { b.style.removeProperty("height"); b.classList.remove("svf-h"); } });
  const ord = B.slice().sort((a, c) => (a === prio ? -1 : c === prio ? 1 : L[a.dataset.svfk].y - L[c.dataset.svfk].y));
  const placed = [];
  ord.forEach(b => { const o = L[b.dataset.svfk], h = b.offsetHeight; let y = Math.max(top0, Math.min(o.y, 1e6) || top0);
    let moved = true; while (moved) { moved = false; for (const p of placed) { if (o.x < p.x + p.w && p.x < o.x + o.w && y < p.y + p.h + SVI_FREE_GAP && p.y < y + h + SVI_FREE_GAP) { y = p.y + p.h + SVI_FREE_GAP; moved = true; } } }
    o.y = y; b.style.top = y + "px"; placed.push({ x: o.x, w: o.w, y, h }); });
  host.style.height = Math.max(...placed.map(p => p.y + p.h), top0) + SVI_FREE_GAP + "px";
  sviFreeSet(k, L);
}
function sviFreeMount(host, key, sel, keyOf) {
  if (!host) return; host.dataset.svf = key; host.classList.add("svf-host");
  const B = [...host.querySelectorAll(":scope > " + sel)].filter(b => b.offsetParent !== null || b.classList.contains("svf-b"));
  B.forEach(b => { b.dataset.svfk = keyOf(b); if (!b.querySelector(":scope > .svf-rz")) { const r = document.createElement("div"); r.className = "svf-rz"; r.title = "Glisser pour changer la largeur et la hauteur"; b.appendChild(r); } });
  host.__svfBlocks = B;
  /* haut de la zone des blocs : sous ce qui précède le premier bloc (barre collante…) */
  const first = B[0]; host.__svfTop = 0;
  if (!sviFreeGet(key) || !first) { sviFreeLayout(host); return; }
  const prev = [...host.children].filter(c => !B.includes(c) && c.offsetParent !== null && !c.classList.contains("svf-ghost"));
  host.__svfTop = prev.reduce((m, c) => Math.max(m, c.offsetTop + c.offsetHeight), 0) + (prev.length ? SVI_FREE_GAP : 0);
  sviFreeLayout(host);
}
/* première prise : la disposition empilée devient la disposition libre (positions telles qu'à l'écran) */
const sviFreeInit = host => { const k = host.dataset.svf; let L = sviFreeGet(k); if (L) return L; L = {};
  const hr = host.getBoundingClientRect(); host.__svfTop = Math.max(0, (host.__svfBlocks[0] || host).getBoundingClientRect().top - hr.top);
  host.__svfBlocks.forEach(b => { L[b.dataset.svfk] = { x: 0, w: 100, y: b.getBoundingClientRect().top - hr.top }; }); sviFreeSet(k, L); return L; };
document.addEventListener("pointerdown", e => {
  const t = e.target; if (!t.closest || e.button > 0) return;
  const rz = t.closest(".svf-host .svf-rz"), hd = !rz && t.closest(".svf-host .blk-head");
  if (!rz && !hd) return;
  if (hd && t.closest("button, input, select, textarea, a, .blk-tools, .blk-more, .blk-max-btn, .ach-link, [data-nvgo], .cf-btn, .svi-cnt[role], .blk-grip")) return;
  const b = (rz || hd).closest(".svf-host > *"), host = b && b.parentElement; if (!host || !(host.__svfBlocks || []).includes(b)) return;
  const x0 = e.clientX, y0 = e.clientY; let on = false, L = null, o0 = null, r0 = null;
  const start = () => { on = true; L = sviFreeInit(host); sviFreeLayout(host); o0 = { ...L[b.dataset.svfk] }; r0 = b.getBoundingClientRect(); b.classList.add("svf-drag"); document.body.classList.add("svf-moving"); };
  const mv = ev => { const dx = ev.clientX - x0, dy = ev.clientY - y0; if (!on) { if (Math.hypot(dx, dy) < 8) return; start(); }
    ev.preventDefault(); const W = sviFreeW(host);
    if (rz) { const w = Math.max(15, Math.min(100 - o0.x, Math.round((r0.width + dx) / W * 100 / SVI_FREE_SNAP) * SVI_FREE_SNAP)); b.style.width = (w / 100 * W) + "px"; b.style.height = Math.max(60, r0.height + dy) + "px"; b.classList.add("svf-h"); b.__svfNew = { w, h: Math.round(Math.max(60, r0.height + dy)) }; }
    else { b.style.transform = `translate(${dx}px, ${dy}px)`; } };
  const up = ev => { document.removeEventListener("pointermove", mv, true); document.removeEventListener("pointerup", up, true); document.removeEventListener("pointercancel", up, true);
    if (!on) return; b.classList.remove("svf-drag"); document.body.classList.remove("svf-moving"); b.style.removeProperty("transform");
    /* v1148 : pointercancel (défilement pris par le navigateur…) = annulation, le bloc reprend sa place */
    if (ev.type === "pointercancel") { delete b.__svfNew; sviFreeLayout(host); return; }
    const o = L[b.dataset.svfk], W = sviFreeW(host);
    if (rz) { if (b.__svfNew) { o.w = b.__svfNew.w; o.h = b.__svfNew.h; delete b.__svfNew; } }
    else { const dx = ev.clientX - x0, dy = ev.clientY - y0;
      /* un bloc sur toute la largeur tiré de côté prend la moitié de l'écran, du côté où on le lâche */
      if (o.w >= 100 && Math.abs(dx) > W * .15) { o.w = 50; o0.x = dx > 0 ? 50 : 0; o.x = o0.x; }
      else o.x = Math.max(0, Math.min(100 - o.w, Math.round((o0.x + dx / W * 100) / SVI_FREE_SNAP) * SVI_FREE_SNAP)); o.y = Math.max(host.__svfTop || 0, o0.y + dy); }
    sviFreeSet(host.dataset.svf, L); sviFreeLayout(host, b);
    /* le toucher qui suit un glisser n'ouvre rien */
    const stop = ce => { ce.stopPropagation(); ce.preventDefault(); }; document.addEventListener("click", stop, { capture: true, once: true }); setTimeout(() => document.removeEventListener("click", stop, true), 300); };
  document.addEventListener("pointermove", mv, true); document.addEventListener("pointerup", up, true); document.addEventListener("pointercancel", up, true);
}, true);
window.addEventListener("resize", () => document.querySelectorAll(".svf-host.svf-on").forEach(h => sviFreeLayout(h)));
/* =========================================================
   v1149 (série L, L3 ; document unique 10.2) : FENÊTRES LIBRES — toute fenêtre de l'application (#svConf) se déplace en entier par son bandeau
   et se règle par son coin (largeur et hauteur ; le contenu défile dedans). Place et taille gardées par type de fenêtre (classes de la carte),
   pas pour les simples confirmations (carte sans classe propre) ; double toucher sur le bandeau = place et taille par défaut.
   ========================================================= */
const SVI_WIN_K = "svi_winpos_v1";
const sviWinPosAll = () => { try { return JSON.parse(localStorage.getItem(SVI_WIN_K) || "{}") || {}; } catch (e) { return {}; } };
const sviWinPosSet = (k, v) => { const A = sviWinPosAll(); if (v) A[k] = v; else delete A[k]; try { localStorage.setItem(SVI_WIN_K, JSON.stringify(A)); } catch (e) {} };
const sviWinKey = c => { const k = [...c.classList].filter(x => x !== "svc-card" && x !== "svc-full" && !/^st-|^on$|^svw-/.test(x)).sort().join(" "); if (!k) return "";
  const t = c.querySelector(":scope > .svc-t"), tx = t ? [...t.childNodes].filter(n => n.nodeType === 3 || (n.nodeType === 1 && !n.matches("button, input, select, .svc-x"))).map(n => n.textContent).join(" ") : "";
  const st = tx.split(/\s[—–-]\s|:/)[0].replace(/[«»"]/g, " ").replace(/\S*\d\S*/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
  return "w:" + k + (st ? "|" + st : ""); };
function sviWinGeo(c) { if (!c || !c.matches(".svc-card")) return;
  if (!c.querySelector(":scope > .svw-rz")) { const r = document.createElement("div"); r.className = "svw-rz"; r.title = "Glisser pour changer la taille"; c.appendChild(r); }
  const k = sviWinKey(c), G = k ? sviWinPosAll()[k] : null;
  ["translate", "width", "max-width", "height"].forEach(p => c.style.removeProperty(p)); c.classList.remove("svw-h");
  if (!G) return;
  if (G.w) { c.style.setProperty("width", Math.min(G.w, innerWidth - 16) + "px", "important"); c.style.setProperty("max-width", "none", "important"); }
  if (G.h) { c.style.setProperty("height", Math.min(G.h, innerHeight - 16) + "px", "important"); c.classList.add("svw-h"); }
  requestAnimationFrame(() => { const R = c.getBoundingClientRect(); const dx = Math.max(-R.left + 8, Math.min(innerWidth - R.right - 8 + R.width - 80, G.dx || 0)), dy = Math.max(-R.top + 8, Math.min(innerHeight - R.top - 48, G.dy || 0)); c.style.translate = dx + "px " + dy + "px"; }); }
{ const watch = w => { if (w.__svwObs) return; w.__svwObs = new MutationObserver(() => w.querySelectorAll(":scope > .svc-card").forEach(c => { if (!c.__svw) { c.__svw = 1; sviWinGeo(c); } }));
    w.__svwObs.observe(w, { childList: true }); w.querySelectorAll(":scope > .svc-card").forEach(c => { c.__svw = 1; sviWinGeo(c); }); };
  new MutationObserver(M => M.forEach(m => m.addedNodes.forEach(n => { if (n.id === "svConf") watch(n); }))).observe(document.body || document.documentElement, { childList: true });
  let lastT = 0;
  document.addEventListener("pointerdown", e => { const t = e.target; if (!t.closest || e.button > 0) return;
    const rz = t.closest("#svConf > .svc-card > .svw-rz"), bd = !rz && t.closest("#svConf > .svc-card > .svc-t"); if (!rz && !bd) return;
    if (bd && t.closest("button, input, select, a, .ach-link")) return;
    const c = (rz || bd).parentElement, k = sviWinKey(c);
    if (bd && Date.now() - lastT < ((window.SVI_G && SVI_G.dbl) || 350)) { lastT = 0; c.classList.remove("svc-full"); if (k) sviWinPosSet(k, null); sviWinGeo(c); return; }   /* double toucher = défaut */
    lastT = Date.now();
    const x0 = e.clientX, y0 = e.clientY, R0 = c.getBoundingClientRect(), tr = String(c.style.translate || "0px 0px").split(" ").map(v => parseFloat(v) || 0); let on = false;
    const mv = ev => { const dx = ev.clientX - x0, dy = ev.clientY - y0; if (!on) { if (Math.hypot(dx, dy) < 8) return; on = true; c.classList.add("svw-move"); } ev.preventDefault();
      if (rz) { c.style.setProperty("width", Math.max(280, Math.min(innerWidth - 16, R0.width + dx)) + "px", "important"); c.style.setProperty("max-width", "none", "important"); c.style.setProperty("height", Math.max(160, Math.min(innerHeight - 16, R0.height + dy)) + "px", "important"); c.classList.add("svw-h"); }
      else { const nx = Math.max(-R0.left + tr[0] + 8 - R0.width + 80, Math.min(innerWidth - R0.right + tr[0] - 8 + R0.width - 80, tr[0] + dx)), ny = Math.max(-R0.top + tr[1] + 8, Math.min(innerHeight - R0.top + tr[1] - 48, tr[1] + dy)); c.style.translate = nx + "px " + ny + "px"; } };
    const up = ev => { document.removeEventListener("pointermove", mv, true); document.removeEventListener("pointerup", up, true); document.removeEventListener("pointercancel", up, true);
      if (!on) return; c.classList.remove("svw-move");
      if (ev.type === "pointercancel") { sviWinGeo(c); return; }
      if (k) { const T = String(c.style.translate || "0px 0px").split(" ").map(v => parseFloat(v) || 0), R = c.getBoundingClientRect(), G = sviWinPosAll()[k] || {};
        sviWinPosSet(k, { ...G, dx: Math.round(T[0]), dy: Math.round(T[1]), ...(rz ? { w: Math.round(R.width), h: Math.round(R.height) } : {}) }); }
      const stop = ce => { ce.stopPropagation(); ce.preventDefault(); }; document.addEventListener("click", stop, { capture: true, once: true }); setTimeout(() => document.removeEventListener("click", stop, true), 300); };
    document.addEventListener("pointermove", mv, true); document.addEventListener("pointerup", up, true); document.addEventListener("pointercancel", up, true);
  }, true); }
