/* =========================================================
   CONFIRMATION AU FORMAT DE L'APPLICATION (jamais de message Safari)
   svConfirm({ title, text, ok }) → Promise<boolean>
   ========================================================= */
/* message d'erreur passager : affiché au moment de l'erreur, puis il s'efface (règle générale) */
/* il s'affiche PRÈS DE LA SOURCE de l'erreur (la case ou la ligne touchée) : juste dessous,
   sans la cacher ; au-dessus s'il n'y a pas la place ; jamais loin (règle générale) */
let svLastTouch = null;
document.addEventListener("pointerdown", e => { svLastTouch = e.target; }, true);
document.addEventListener("focusin", e => { svLastTouch = e.target; }, true);
function svToast(msg, ms = 3500, anchor) {
  let t = document.getElementById("svToast");
  if (!t) { t = document.createElement("div"); t.id = "svToast"; document.body.appendChild(t); }
  /* FORMAT 1 : un ✕ à droite ferme le message tout de suite */
  t.innerHTML = `<span class="svt-m"></span><button type="button" class="svt-x" aria-label="Fermer">✕</button>`;
  t.querySelector(".svt-m").textContent = String(msg || "").toUpperCase();
  t.querySelector(".svt-x").addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); clearTimeout(t.__tm); t.classList.remove("on"); });
  t.querySelector(".svt-x").addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); });
  let a = anchor || svLastTouch;
  if (a && !a.isConnected) a = null;
  /* la source : la case, sinon la ligne touchée */
  const src = a && (a.closest("td, .ins-li, .lk-li, button, [data-iid]") || a);
  const r = src && src.getBoundingClientRect();
  t.style.left = t.style.top = t.style.right = "";
  if (r && (r.width || r.height)) {
    t.style.right = "auto";
    t.style.visibility = "hidden";
    t.classList.add("on");
    const w = t.offsetWidth, h = t.offsetHeight, vw = window.innerWidth, vh = sviViewH();
    const left = Math.max(8, Math.min(r.left, vw - w - 8));
    const top = r.bottom + 6 + h <= vh - 8 ? r.bottom + 6 : Math.max(8, r.top - h - 6);
    t.style.left = left + "px";
    t.style.top = top + "px";
    t.style.visibility = "";
  }
  t.classList.add("on");
  clearTimeout(t.__tm);
  t.__tm = setTimeout(() => t.classList.remove("on"), ms);
}
/* IMPORT IMPOSSIBLE (FORMAT 62) : fenêtre qui reste ouverte, avec le fichier, la raison de chaque essai
   (en clair + détail technique), le contenu trouvé et que faire ; jamais un message passager */
function svImportReason(m) {
  const t = String((m && m.message) || m || "").trim();
  const U = t.toUpperCase();
  if (!t) return "LECTURE REFUSÉE (RAISON NON DONNÉE)";
  /* erreur de CONTENU (la feuille a été lue) : affichée telle quelle */
  if (/COLONNE|AUCUNE LIGNE|EN-TÊTE|ONGLET/.test(U)) return U;
  if (/NOUVELLE VERSION À DÉPLOYER|UNKNOWN ACTION|ACTION INCONNUE/.test(U)) return "LE SCRIPT GOOGLE NE SAIT PAS ENCORE LIRE UNE FEUILLE (NOUVELLE VERSION DU SCRIPT À DÉPLOYER)";
  if (/PERMISSION|ACCESS|ACCÈS|DENIED|REFUS|AUTORIS|\b403\b|\b401\b/.test(U)) return "ACCÈS REFUSÉ À LA FEUILLE (VOTRE COMPTE N'Y A PAS ACCÈS, OU ELLE N'EST PAS PARTAGÉE)";
  if (/NOT FOUND|FEUILLE INTROUVABLE|FICHIER INTROUVABLE|\b404\b|DOES NOT EXIST|N'EXISTE PAS/.test(U)) return "FEUILLE INTROUVABLE (LIEN INCORRECT OU FEUILLE SUPPRIMÉE)";
  if (/FAILED TO FETCH|LOAD FAILED|NETWORK|RÉSEAU|TIMEOUT/.test(U)) return "PAS DE CONNEXION INTERNET OU SERVICE GOOGLE INJOIGNABLE";
  if (/NON JSON/.test(U)) return "LE SCRIPT GOOGLE A RÉPONDU PAR UNE PAGE D'ERREUR";
  if (/BIBLIOTH|EXCEL INDISPONIBLE/.test(U)) return "LA LECTURE DES FICHIERS EXCEL N'A PAS PU ÊTRE CHARGÉE (CONNEXION INTERNET ?)";
  return U;
}
function svImportFail({ source = "", tries = [], found = null, hint = "" } = {}) {
  document.getElementById("svConf")?.remove();
  const d = document.createElement("div");
  d.id = "svConf";
  const row = (lab, html) => `<div class="svc-sub">${esc(lab)}</div><div class="svc-x imp-fail-v">${html}</div>`;
  d.innerHTML = `<div class="svc-card imp-fail" role="dialog" aria-modal="true">
      <button type="button" class="svc-close" data-r="0" aria-label="Fermer">✕</button>
      <div class="svc-t">IMPORT IMPOSSIBLE</div>
      ${source ? row("FICHIER", esc(/https?:\/\//i.test(source) ? String(source) : String(source).toUpperCase())) : ""}
      ${tries.length ? row("RAISON", `<ul class="svc-list">${tries.map(x => `<li>${x.via ? "<b>" + esc(x.via) + " :</b> " : ""}${esc(svImportReason(x.err))}${
        String((x.err && x.err.message) || x.err || "").trim() && svImportReason(x.err) !== String((x.err && x.err.message) || x.err).toUpperCase()
          ? `<div class="imp-fail-d">${esc(String((x.err && x.err.message) || x.err))}</div>` : ""}</li>`).join("")}</ul>`) : ""}
      ${found && found.length ? row("COLONNES TROUVÉES", esc(found.filter(v => String(v ?? "").trim()).map(v => String(v).toUpperCase()).join(" · ") || "AUCUNE")) : ""}
      ${hint ? row("QUE FAIRE", esc(String(hint).toUpperCase())) : ""}
      <div class="svc-f"><button type="button" class="svc-b svc-ok svc-neutral" data-r="0">FERMER</button></div>
    </div>`;
  document.body.appendChild(d);
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-r]")) d.remove(); });
}
/* couleur d'état reportée sur toute la page (cases, fenêtres) : rouge en instance, vert figé, noir sinon */
const SVI_ST_WATCH = new WeakSet();
function sviSyncState() {
  const sh = [...document.querySelectorAll(".novapp-list-shell")].find(x => x.offsetParent !== null) || document.querySelector(".novapp-list-shell");
  let st = "";
  if (sh) st = sh.classList.contains("bdg-inst-fige") ? "fige" : (sh.classList.contains("bdg-inst-instance") || sh.classList.contains("list-inst")) ? "instance" : "";
  if (document.documentElement.dataset.svst !== st) document.documentElement.dataset.svst = st;
}
function sviWatchState(shell) {
  if (shell && !SVI_ST_WATCH.has(shell)) { SVI_ST_WATCH.add(shell); new MutationObserver(sviSyncState).observe(shell, { attributes: true, attributeFilter: ["class"] }); }
  sviSyncState();
}
/* message au format de l'application (jamais de fenêtre Safari) : titre, texte, FERMER */
/* menus ⋯ (FORMAT 107) : sous le bouton s'il y a la place, sinon au-dessus ; sinon hauteur disponible avec défilement */
/* v453 (FORMAT 28) : hauteur réellement visible — sur iPad, window.innerHeight peut compter la zone cachée par la barre de Safari */
function sviViewH() {
  const v = window.visualViewport, de = document.documentElement;
  return Math.min(window.innerHeight, de && de.clientHeight ? de.clientHeight : window.innerHeight, v ? v.height + (v.offsetTop || 0) : window.innerHeight);
}
function sviPlaceMenu(m, r) {
  const vh = sviViewH(), M = 24;
  m.style.maxHeight = ""; m.style.top = "0px";
  m.classList.remove("sv-2col");
  let h = m.offsetHeight;
  const below = vh - r.bottom - 4 - M, above = r.top - 4 - M, full = vh - 2 * M;
  /* v459 : le menu est TOUJOURS vu en entier — sous le bouton, sinon au-dessus, sinon sur toute la hauteur
     (il recouvre alors le bouton), sinon sur deux colonnes ; défilement interne en tout dernier recours */
  if (h > below && h > above && h > full && m.id === "blkMenu") { m.classList.add("sv-2col"); h = m.offsetHeight; }
  if (h <= below) m.style.top = r.bottom + 4 + "px";
  else if (h <= above) m.style.top = r.top - 4 - h + "px";
  else if (h <= full) m.style.top = Math.max(M, Math.min(r.bottom + 4, vh - M - h)) + "px";
  else { m.style.top = M + "px"; m.style.maxHeight = full + "px"; }
  m.style.left = Math.max(M, Math.min(window.innerWidth - m.offsetWidth - M, r.right - m.offsetWidth)) + "px";
  /* garde finale : le menu ne dépasse jamais le bas de la partie visible (défilement interne) */
  const b = m.getBoundingClientRect();
  if (b.bottom > vh - M) m.style.maxHeight = Math.max(120, vh - M - b.top) + "px";
  /* v456 : menu plus long que la place : il défile à l'intérieur, une flèche ▼ en bas le signale (disparaît en bas de la liste) */
  const more = m.scrollHeight > m.clientHeight + 2;
  m.classList.toggle("sv-more", more && m.scrollTop + m.clientHeight < m.scrollHeight - 2);
  if (!m.__svMoreB) { m.__svMoreB = true; m.addEventListener("scroll", () => m.classList.toggle("sv-more", m.scrollTop + m.clientHeight < m.scrollHeight - 2), { passive: true }); }
  /* mise en page tardive (polices, iPad) : replacé une fois affiché, et si la zone visible change */
  if (!m.__svPlaced) {
    m.__svPlaced = true;
    const again = () => { if (m.isConnected) sviPlaceMenu(m, r); };
    requestAnimationFrame(again); setTimeout(again, 150);
    const vv = window.visualViewport;
    if (vv) { const f = () => { if (!m.isConnected) { vv.removeEventListener("resize", f); vv.removeEventListener("scroll", f); return; } again(); }; vv.addEventListener("resize", f); vv.addEventListener("scroll", f); }
  }
}
function sviAlert(msg, title = "INFORMATION") {
  if (window.__sviQuiet) return;   /* contrôle silencieux (état du bouton APERÇU PDF) */
  document.getElementById("svConf")?.remove();
  const d = document.createElement("div");
  d.id = "svConf";
  d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true">
      <button type="button" class="svc-close" data-r="0" aria-label="Fermer">✕</button>
      <div class="svc-t">${esc(String(title).toUpperCase())}</div>
      <div class="svc-x" style="white-space:pre-line">${esc(String(msg ?? "").toUpperCase())}</div>
      <div class="svc-f"><button type="button" class="svc-b svc-ok svc-neutral" data-r="0">FERMER</button></div>
    </div>`;
  document.body.appendChild(d);
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-r]")) d.remove(); });
}
/* fenêtre de choix de l'application : ANNULER + boutons [{ v, label, tone }] ; résout la valeur choisie ou null */
function svChoose({ title = "", text = "", html = "", buttons = [], noCancel = false } = {}) {
  return new Promise(res => {
    document.getElementById("svConf")?.remove();
    const d = document.createElement("div");
    d.id = "svConf";
    d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true">
        <button type="button" class="svc-close" data-v="" aria-label="Fermer">✕</button>
        <div class="svc-t">${esc(title)}</div>
        ${text ? `<div class="svc-x">${esc(text)}</div>` : ""}${html ? `<div class="svc-x svc-html">${html}</div>` : ""}
        <div class="svc-f">${noCancel ? "" : '<button type="button" class="svc-b" data-v="">ANNULER</button>'}
          ${buttons.map(b => `<button type="button" class="svc-b svc-ok${b.tone === "danger" ? "" : " svc-neutral"}" data-v="${esc(b.v)}"${b.disabled ? " disabled" : ""}>${esc(b.label)}</button>`).join("")}</div>
      </div>`;
    document.body.appendChild(d);
    svShortLists(d);
    d.addEventListener("click", e => {
      const b = e.target.closest("[data-v]");
      if (!b && e.target !== d) return;
      if (b && b.disabled) return;
      d.remove();
      res(b && b.dataset.v ? b.dataset.v : null);
    });
  });
}
/* v490 (remarque 3, remplace la règle des 5 lignes) : une liste de fenêtre est toujours affichée ;
   elle occupe au plus la moitié de l'écran, puis défile (classe svc-scroll) */
function svShortLists(d) {
  d.querySelectorAll(".svc-list").forEach(ul => ul.classList.add("svc-scroll"));
}
function svConfirm({ title = "CONFIRMER", text = "", html = "", ok = "OK", tone = "danger" } = {}) {
  return new Promise(res => {
    document.getElementById("svConf")?.remove();
    const d = document.createElement("div");
    d.id = "svConf";
    d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true">
        <button type="button" class="svc-close" data-r="0" aria-label="Fermer">✕</button>
        <div class="svc-t">${esc(title)}</div>
        ${text ? `<div class="svc-x">${esc(text)}</div>` : ""}${html ? `<div class="svc-x svc-html">${html}</div>` : ""}
        <div class="svc-f"><button type="button" class="svc-b" data-r="0">ANNULER</button>
          <button type="button" class="svc-b svc-ok${tone === "danger" ? "" : " svc-neutral"}" data-r="1">${esc(ok)}</button></div>
      </div>`;
    document.body.appendChild(d);
    svShortLists(d);
    d.addEventListener("click", e => {
      const b = e.target.closest("[data-r]");
      if (!b && e.target !== d) return;
      d.remove();
      res(!!b && b.dataset.r === "1");
    });
  });
}

/* message d'information dans une fenêtre de l'application (remplace l'alerte Safari) */
function svAlert(msg) {
  document.getElementById("svConf")?.remove();
  const lines = String(msg ?? "").toUpperCase().split("\n").map(x => x.trim()).filter(Boolean);
  const d = document.createElement("div");
  d.id = "svConf";
  d.innerHTML = `<div class="svc-card" role="dialog" aria-modal="true">
      <div class="svc-t">${esc(lines.length > 1 ? lines[0] : "INFORMATION")}</div>
      <div class="svc-x">${esc((lines.length > 1 ? lines.slice(1) : lines).join("\n"))}</div>
      <div class="svc-f"><button type="button" class="svc-b svc-ok svc-neutral" data-r="1">OK</button></div>
    </div>`;
  document.body.appendChild(d);
  d.addEventListener("click", e => { if (e.target.closest("[data-r]") || e.target === d) d.remove(); });
}
try { window.alert = svAlert; } catch (e) {}

/* =========================================================
   MENU ☰ › DONNÉES SOURCE : fichiers Google Sheets lus par l'application
   - toucher le nom : ouvre le fichier ;
   - appui long : coller le lien d'un autre fichier,
     puis ENREGISTRER (le script vérifie que le fichier s'ouvre).
   ========================================================= */
const SVI_SRC_FILES = {
  main: { name: "SVI 26-0826/001", url: "https://docs.google.com/spreadsheets/d/1-gZdPMT3V6zLMuS5b8nylgqvSB1zrAukJfZ0o4ht1YE/edit" },
  v3: { name: "SVI ERP — BASE BUDGETS V3", url: "https://docs.google.com/spreadsheets/d/131RdvI2_kqjRq7HbcPxXetWHmBcYJ3DNmGPiuogAoas/edit" }
};
/* appel du script : d'abord par GET (paramètres gardés si Google redirige), sinon POST */
async function apiSrc(action, params = {}) {
  try {
    const d = await apiGet(action, params);
    if (d && d.ok && (d.main || d.budgets || d.v3)) return d;
  } catch (e) {}
  return apiPost(action, params);
}
function openSourceWin() {
  document.getElementById("srcPop")?.remove();
  const test = !!document.getElementById("sviTestTag");
  /* fichier modifiable ici : base V3 (version test), fichier principal (version validée) */
  const EDIT = test ? "v3" : "main";
  const files = { main: { ...SVI_SRC_FILES.main }, v3: { ...SVI_SRC_FILES.v3 } };
  const tag = (document.getElementById("sviTestTag")?.textContent || "").replace(/^VERSION TEST — /, "");
  const v3ok = window.SVI_SRC === "V3" || !/ANCIEN BDG/.test(tag);
  const field = (which, note) => `
    <div class="src-fld${which === EDIT ? " src-edit-ok" : ""}" data-which="${which}">
      <input class="src-in" data-keepcase readonly value="${esc(files[which].name)}"
        placeholder="COLLER LE LIEN DE LA FEUILLE GOOGLE">
    </div><span class="src-note" data-note="${which}">${note}</span>`;
  const row = (lab, val) => `<div class="src-lab">${lab}</div><div class="src-val">${val}</div>`;
  const render = () => {
    let rows = row("VERSION", test ? "TEST" : "VALIDÉE");
    if (test) {
      rows +=
        row("BUDGETS (BDG)", v3ok
          ? field("v3", "ONGLETS BUDGETS, DESIGNATIONS, TACHES, DETAILS, ARRETS" + (files.v3.folder ? " — DOSSIER " + esc(files.v3.folder) : ""))
          : field("main", "ONGLET BDG — BASE V3 NON LUE : " + esc(tag))) +
        (v3ok ? "" : row("BASE V3", field("v3", "NON LUE : " + esc(tag)))) +
        row("CHS, BDS", field("main", "ONGLETS CHS, BDS_V2, BRD_V2 — MODIFIABLE DEPUIS LA VERSION VALIDÉE")) +
        row("BUDGETS EN INSTANCE", "SUR CET APPAREIL SEULEMENT<span class=\"src-note\">PAS ENCORE ENREGISTRÉS DANS GOOGLE SHEETS</span>");
    } else {
      rows +=
        row("BDG, CHS, BDS", field("main", "ONGLETS BDG, CHS, BDS_V2, BRD_V2" + (files.main.folder ? " — DOSSIER " + esc(files.main.folder) : "")));
    }
    p.querySelector(".src-grid").innerHTML = rows;
  };
  const p = document.createElement("div");
  p.id = "srcPop";
  p.innerHTML = `
    <div class="src-card" role="dialog" aria-modal="true">
      <div class="src-head">
        <span class="src-title">DONNÉES SOURCE</span>
        <button type="button" class="src-x" data-close aria-label="Fermer">✕</button>
      </div>
      <div class="src-body"><div class="src-grid"></div><div class="src-msg"></div></div>
      <div class="src-foot">
        <button type="button" class="src-btn" data-close>FERMER</button>
        <button type="button" class="src-btn" data-cancel hidden>ANNULER</button>
        <button type="button" class="src-btn src-save" data-save hidden>ENREGISTRER</button>
      </div>
    </div>`;
  document.body.appendChild(p);
  render();
  const msg = (t, err) => { const m = p.querySelector(".src-msg"); m.textContent = t || ""; m.classList.toggle("err", !!err); };
  /* noms réels des fichiers, lus par le script */
  apiSrc("srcGet").then(d => {
    ["main", "v3"].forEach(k => { if (d[k] && d[k].id) files[k] = { ...files[k], ...d[k], name: d[k].name || files[k].name }; });
    if (!editing) render();
  }).catch(() => {});
  let editing = null;
  const setMode = which => {
    editing = which;
    p.querySelector("[data-close].src-btn").hidden = !!which;
    p.querySelector("[data-cancel]").hidden = !which;
    p.querySelector("[data-save]").hidden = !which;
    p.querySelectorAll(".src-fld").forEach(f => f.classList.toggle("editing", f.dataset.which === which && !!which));
    p.querySelectorAll(".src-in").forEach(i => {
      const on = which && i.closest(".src-fld").dataset.which === which;
      i.readOnly = !on;
      if (!on) i.value = files[i.closest(".src-fld").dataset.which].name;
    });
    if (which) {
      const i = p.querySelector(`.src-fld[data-which="${which}"] .src-in`);
      i.value = "";
      i.focus();
    }
  };
  /* appui long : modifier ; toucher simple : ouvrir */
  let lpTimer = null, lpDone = false;
  p.addEventListener("pointerdown", e => {
    const f = e.target.closest(".src-fld.src-edit-ok");
    if (!f || editing) return;
    lpDone = false;
    lpTimer = setTimeout(() => { lpDone = true; msg(""); setMode(f.dataset.which); }, 550);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(t => p.addEventListener(t, () => clearTimeout(lpTimer)));
  p.addEventListener("contextmenu", e => { if (e.target.closest(".src-fld")) e.preventDefault(); });
  p.addEventListener("click", async e => {
    if (e.target === p || e.target.closest("[data-close]")) { p.remove(); return; }
    if (e.target.closest("[data-cancel]")) { msg(""); setMode(null); return; }
    const f = e.target.closest(".src-fld");
    if (f && !(editing && f.dataset.which === editing)) {
      if (lpDone) { lpDone = false; return; }
      e.preventDefault();
      openGoogleLink(files[f.dataset.which].url);
      return;
    }
    const sv = e.target.closest("[data-save]");
    if (!sv || !editing) return;
    const link = p.querySelector(`.src-fld[data-which="${editing}"] .src-in`).value.trim();
    if (!/\/d\/[A-Za-z0-9_-]{20,}|^[A-Za-z0-9_-]{20,}$/.test(link)) { msg("LIEN GOOGLE SHEETS NON RECONNU.", true); return; }
    const lab = editing === "v3" ? "LA BASE DES BUDGETS (V3)" : "LE FICHIER PRINCIPAL (CHS, BDS, BDG)";
    if (!await svConfirm({ title: "CHANGER LE FICHIER SOURCE", text: "L'APPLICATION LIRA DÉSORMAIS " + lab + " DANS CE FICHIER.", ok: "CHANGER", tone: "neutral" })) return;
    sv.disabled = true;
    msg("VÉRIFICATION DU FICHIER…");
    try {
      const d = await apiSrc("srcSet", { which: editing, link });
      ["main", "v3"].forEach(k => { if (d[k] && d[k].id) files[k] = { ...files[k], ...d[k], name: d[k].name || files[k].name }; });
      setMode(null);
      render();
      msg("ACTUALISATION DES DONNÉES…");
      setTimeout(() => location.reload(), 1200);
    } catch (err) {
      msg("CHANGEMENT IMPOSSIBLE : " + (err && err.message || err), true);
    }
    sv.disabled = false;
  });
  p.addEventListener("keydown", e => {
    if (e.key === "Enter" && editing) { e.preventDefault(); p.querySelector("[data-save]").click(); }
  });
}
document.addEventListener("click", e => {
  if (!e.target.closest("#navSrcBtn")) return;
  document.getElementById("navMenu")?.classList.add("hidden");
  openSourceWin();
});


