/* =========================================================
   API GET CHS / BDS
   ========================================================= */

async function apiGet(action = "bootstrap", params = {}) {
  const query = {
    key: API_KEY,
    action,
    ...params,
    _: Date.now()
  };

  const url =
    API_URL +
    "?" +
    Object.entries(query)
      .map(
        ([k, v]) =>
          encodeURIComponent(k) +
          "=" +
          encodeURIComponent(v)
      )
      .join("&");

  const r = await fetch(url, {
    method: "GET",
    cache: "no-store"
  });

  /* réponse illisible (page d'erreur Google au lieu de JSON) : on montre la raison */
  const txt = await r.text();
  let data;
  try { data = JSON.parse(txt); }
  catch (e) {
    const m = txt.match(/<title>([^<]*)<\/title>/i);
    const body = txt.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    throw new Error("RÉPONSE NON JSON (HTTP " + r.status + ") : " +
      ((m && m[1].trim()) ? m[1].trim() + " — " : "") + body.slice(0, 200));
  }

  if (!data.ok) {
    throw new Error(
      data.error || "ERREUR API"
    );
  }

  return data;
}

/* =========================================================
   API GET BDG
   L'API HISTORIQUE UTILISE L'ABSENCE D'ACTION
   ========================================================= */

async function apiGetBDG() {
  const attempts = [
    { action: "getBDG" },
    { action: "bdg" },
    { action: "bootstrapBDG" },
    {}
  ];

  let lastError = null;

  for (const params of attempts) {
    try {
      const query = {
        key: API_KEY,
        ...params,
        _: Date.now()
      };

      const url =
        API_URL +
        "?" +
        Object.entries(query)
          .map(([k, v]) =>
            encodeURIComponent(k) +
            "=" +
            encodeURIComponent(v)
          )
          .join("&");

      const r = await fetch(url, {
        method: "GET",
        cache: "no-store",
        redirect: "follow"
      });

      if (!r.ok) {
        lastError = new Error(
          "ERREUR HTTP " + r.status
        );
        continue;
      }

      const text = await r.text();

      let data;

      try {
        data = JSON.parse(text);
      } catch (e) {
        lastError = new Error(
          "RÉPONSE BDG NON JSON"
        );
        continue;
      }

      if (data && data.ok === false) {
        lastError = new Error(
          data.error || "ERREUR API BDG"
        );
        continue;
      }

      if (
        data &&
        Array.isArray(data.rows)
      ) {
        return data;
      }

      if (
        data &&
        data.data &&
        Array.isArray(data.data.rows)
      ) {
        return {
          ok: true,
          rows: data.data.rows
        };
      }

      lastError = new Error(
        "FORMAT BDG NON RECONNU"
      );

    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ||
    new Error("IMPOSSIBLE DE CHARGER BDG");
}
/* =========================================================
   API POST
   ========================================================= */

async function apiPost(action, data = {}) {
  const r = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      key: API_KEY,
      action,
      ...data
    })
  });

  /* réponse illisible (page d'erreur Google au lieu de JSON) : on montre la raison */
  const txt = await r.text();
  let out;
  try { out = JSON.parse(txt); }
  catch (e) {
    const m = txt.match(/<title>([^<]*)<\/title>/i);
    const body = txt.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    throw new Error("RÉPONSE NON JSON (HTTP " + r.status + ") : " +
      ((m && m[1].trim()) ? m[1].trim() + " — " : "") + body.slice(0, 160));
  }

  if (!out.ok) {
    throw new Error(
      out.error || "ERREUR API"
    );
  }

  return out;
}

/* =========================================================
   GOOGLE DRIVE : ENREGISTREMENT DES FICHIERS (via Code.gs)
   ========================================================= */

const DRIVE_PATHS_KEY = "svi_drivepaths_v1";

/* un lien Google (https://…) n'est jamais gardé : on garde le chemin court */
const driveIsLink = p => /^https?:|:\/\//i.test(String(p || ""));

function drivePaths() {
  try {
    return (JSON.parse(localStorage.getItem(DRIVE_PATHS_KEY) || "[]") || []).filter(x => x && !driveIsLink(x));
  } catch (e) { return []; }
}

function drivePathAdd(path) {
  if (!path || driveIsLink(path)) return;
  try {
    const rec = drivePaths().filter(x => x !== path);
    rec.unshift(path);
    localStorage.setItem(DRIVE_PATHS_KEY, JSON.stringify(rec.slice(0, 12)));
  } catch (e) {}
}

/* chemin proposé : SVI ERP/<PROJET>/BUDGETS/BDG 26-1001-001 */
function driveDefaultPath(project, fullRef) {
  return "SVI ERP/" + String(project || "PROJET").trim().toUpperCase() + "/BUDGETS/" +
    String(fullRef || "").replace(/^.*?BDG\s*/i, "BDG ").replace(/[\\/:*?"<>|]+/g, "-").trim();
}

/* dossier proposé : le dernier utilisé, sinon celui du budget */
function driveLastPath(project, fullRef) {
  return drivePaths()[0] || driveDefaultPath(project, fullRef);
}

/* lien collé : gardé tel quel (le script retrouve le dossier) ;
   chemin tapé : nettoyé et mis en majuscules */
function driveCleanPath(p) {
  const s = String(p || "").trim();
  if (driveIsLink(s)) return s;
  return s.replace(/^\/+|\/+$/g, "").replace(/\s*\/\s*/g, "/").toUpperCase();
}

/* ligne DOSSIER DRIVE (libellé + champ) affichée ou masquée */
function drivePathRow(root, sel, on) {
  const inp = root.querySelector(sel);
  if (!inp) return;
  const box = inp.closest(".fld-wrap") || inp;
  const lab = root.querySelector(`label[for="${inp.id}"]`);
  box.hidden = !on; box.style.display = on ? "" : "none";
  if (lab) { lab.hidden = !on; lab.style.display = on ? "" : "none"; }
}

/* lien d'ouverture de chaque dossier Drive déjà utilisé */
const DRIVE_URLS_KEY = "svi_driveurls_v1";
function driveUrlGet(path) {
  try { return (JSON.parse(localStorage.getItem(DRIVE_URLS_KEY) || "{}") || {})[path] || ""; }
  catch (e) { return ""; }
}
function driveUrlSet(path, url) {
  if (!path || !url) return;
  try {
    const m = JSON.parse(localStorage.getItem(DRIVE_URLS_KEY) || "{}") || {};
    m[path] = url;
    localStorage.setItem(DRIVE_URLS_KEY, JSON.stringify(m));
  } catch (e) {}
}

/* ouvre un lien Google (dossier, fichier, feuille) :
   sur iPad / iPhone, d'abord dans l'app Drive (ou Sheets) si elle est installée,
   sinon dans le navigateur. « w » : onglet ouvert pendant le toucher. */
function openGoogleLink(url, w) {
  const ios = /iP(ad|hone|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!ios) {
    if (w) w.location.href = url; else window.open(url, "_blank");
    return;
  }
  /* feuille Google : ouverte directement (l'app Sheets, si elle est là, la reprend) */
  if (/docs\.google\.com\/spreadsheets/.test(url)) {
    if (w) w.location.href = url; else window.open(url, "_blank");
    return;
  }
  const app = "googledrive://";
  let left = false;
  const away = () => { if (document.hidden) left = true; };
  document.addEventListener("visibilitychange", away);
  window.addEventListener("pagehide", away);
  try {
    if (w) w.location.href = app + url; else location.href = app + url;
  } catch (e) {}
  /* l'app ne s'est pas ouverte : on bascule sur le navigateur */
  setTimeout(() => {
    document.removeEventListener("visibilitychange", away);
    window.removeEventListener("pagehide", away);
    if (left) { try { w && w.close(); } catch (e) {} return; }
    if (w && !w.closed) w.location.href = url; else window.open(url, "_blank");
  }, 1800);
}
window.__sviOpenGoogle = openGoogleLink;

/* lien d'ouverture d'un dossier (mémorisé, sinon demandé au script) */
async function driveFolderUrl(path) {
  let url = driveIsLink(path) ? "" : driveUrlGet(path);
  if (!url) {
    const out = await apiPost("drivePath", { path: driveCleanPath(path) });
    url = out.folderUrl || "";
    if (out.path) driveUrlSet(out.path, url);
  }
  if (!url) throw new Error("DOSSIER INTROUVABLE");
  return url;
}
window.__sviDriveFolderUrl = driveFolderUrl;
window.__sviDriveErr = e => driveErrText(e);

/* ouvre le dossier dans le Drive (onglet ouvert dans le geste, pour Safari) */
async function driveOpenFolder(path) {
  const w = window.open("", "_blank");
  try {
    const url = await driveFolderUrl(path);
    openGoogleLink(url, w);
  } catch (e) {
    if (w) w.close();
    sviAlert("OUVERTURE DU DOSSIER IMPOSSIBLE : " + driveErrText(e));
  }
}

/* fenêtre « DOSSIER DRIVE » devant la fenêtre en cours :
   adresse en lien (ouvre le Drive), ✎ pour la changer (copier-coller) */
function drivePickFolder(path, onSave, okLabel = "ENREGISTRER") {
  document.getElementById("drvPop")?.remove();
  const p = document.createElement("div");
  p.id = "drvPop";
  const escH = v => String(v ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  p.innerHTML = `
    <div class="dp-card" role="dialog" aria-modal="true">
      <div class="dp-head"><span>DOSSIER DRIVE</span><button type="button" class="dp-x" data-cancel aria-label="Fermer">✕</button></div>
      <div class="dp-body">
        <div class="dp-row" id="dpView">
          <a href="#" class="dp-link" id="dpLink">${escH(path)}</a>
          <button type="button" class="dp-edit" id="dpEdit" title="Changer de dossier">✎</button>
        </div>
        <input type="text" class="dp-in" id="dpIn" data-keepcase autocomplete="off" value="${escH(path)}" hidden>
      </div>
      <div class="dp-foot">
        <button type="button" class="dp-btn" data-cancel>ANNULER</button>
        <button type="button" class="dp-btn dp-ok" id="dpOk">${escH(okLabel)}</button>
      </div>
    </div>`;
  document.body.appendChild(p);
  const inp = p.querySelector("#dpIn"), link = p.querySelector("#dpLink"), view = p.querySelector("#dpView");
  const cur = () => inp.hidden ? link.textContent : inp.value.trim();
  const showLink = () => {
    const v = inp.value.trim();
    if (!v) return;
    link.textContent = v;
    inp.hidden = true; view.hidden = false;
  };
  link.onclick = e => { e.preventDefault(); driveOpenFolder(cur()); };
  p.querySelector("#dpEdit").onclick = () => {
    view.hidden = true; inp.hidden = false; inp.focus(); inp.select();
  };
  inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); showLink(); } });
  inp.addEventListener("blur", showLink);
  p.addEventListener("click", e => {
    if (e.target === p || e.target.closest("[data-cancel]")) p.remove();
  });
  p.querySelector("#dpOk").onclick = () => {
    const v = driveCleanPath(cur());
    p.remove();
    onSave(v);
  };
}

function blobToB64(blob) {
  return new Promise((ok, ko) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result).split(",")[1] || "");
    fr.onerror = () => ko(fr.error);
    fr.readAsDataURL(blob);
  });
}

/* envoie le fichier au script Google, qui le range dans le dossier
   (créé si besoin) ; renvoie { url, id } */
async function driveSave(blob, name, path) {
  const data = await blobToB64(blob);
  const out = await apiPost("saveFile", {
    name, path: driveCleanPath(path), mime: blob.type || "application/octet-stream", data
  });
  /* chemin court renvoyé par le script (lien collé converti en A/B/C) */
  out.path = out.path || driveCleanPath(path);
  drivePathAdd(out.path);
  driveUrlSet(out.path, out.folderUrl);
  return out;
}
window.__sviDriveSave = driveSave;

function driveErrText(e) {
  const m = String(e && e.message || e);
  return /action|inconnu|unknown|non reconnu|JSON/i.test(m)
    ? "Le script Google n'a pas encore la fonction d'enregistrement : ajoute exportSheet.gs dans Code.gs puis redéploie. (" + m + ")"
    : m;
}

