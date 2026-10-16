@verbatim
const API_URL = "https://script.google.com/macros/s/AKfycbzFgUloyiRJe-QmR7nRqJ4bfWqvfA_6LSgotJRrRt87yeRfWtdY7nxXMR9avafSJUPg4Q/exec";
const API_KEY = "nZYYROPFeFXBims8v4NCPcbXG8Nl";

/* =========================================================
   MISE À JOUR AUTOMATIQUE : Safari garde parfois l'ancienne page.
   À l'ouverture (et au retour sur l'onglet), la page publiée est relue
   sans cache ; si elle annonce une version plus récente, un bouton
   « NOUVELLE VERSION — ACTUALISER » apparaît (pas de rechargement automatique).
   ========================================================= */
(() => {
  /* Laravel : version publiée dans la page (meta budget-version, réglée dans config/budget.php)
     et relue sans cache à l'adresse meta budget-version-url */
  const meta = n => (document.querySelector('meta[name="' + n + '"]') || {}).content || "";
  const cur = Number(meta("budget-version")) || 0;
  const verUrl = meta("budget-version-url");
  if (!cur || !verUrl) return;
  const check = () => {
    fetch(verUrl + "?_=" + Date.now(), { cache: "no-store" })
      .then(r => r.text())
      .then(t => {
        const v = Number(String(t).trim()) || 0;
        /* nouvelle version publiée : pas de rechargement automatique,
           un bouton en haut de l'écran ; la page se recharge seulement quand on le touche */
        if (v > cur) {
          let b = document.getElementById("sviUpd");
          if (!b) {
            b = document.createElement("button");
            b.type = "button";
            b.id = "sviUpd";
            b.style.cssText = "position:fixed;top:62px;left:50%;transform:translateX(-50%);z-index:100002;" +
              "border:1px solid #172033;background:#fff;color:#172033;border-radius:999px;padding:8px 18px;" +
              "font:800 12px -apple-system,Helvetica,Arial,sans-serif;letter-spacing:.3px;box-shadow:0 6px 18px rgba(15,23,42,.18);cursor:pointer";
            document.body.appendChild(b);
          }
          b.textContent = "NOUVELLE VERSION — ACTUALISER";
          b.onclick = () => location.replace(location.pathname + "?v=" + v + location.hash);
        }
      }).catch(() => {});
  };
  check();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  /* aussi pendant le travail (budget en instance ouvert…) : relue chaque minute */
  setInterval(() => { if (!document.hidden && !document.getElementById("sviUpd")) check(); }, 60000);
})();

const SVI_COPY_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
const SVI_CUT_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="17" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="17" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.2 15 18 3M15.8 15 6 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const SVI_PASTE_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 4V2.8h6V4M9 10h6M9 14h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const SVI_DEL_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* ESPACES (FORMAT) : à toute saisie, espaces de début et de fin effacés, un seul espace entre les mots */
const sviClean = v => String(v ?? "").replace(/\s+/g, " ").trim();
document.addEventListener("change", e => {
  const t = e.target;
  if (!t || !(t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && /^(text|search|url|email|tel|)$/i.test(t.type || "")))) return;
  if (t.tagName === "TEXTAREA") { const c = t.value.split("\n").map(x => x.replace(/[ \t]+/g, " ").trim()).join("\n").trim(); if (c !== t.value) { t.value = c; t.dispatchEvent(new Event("input", { bubbles: true })); } return; }
  const c = sviClean(t.value);
  if (c !== t.value) { t.value = c; t.dispatchEvent(new Event("input", { bubbles: true })); }
}, true);

@endverbatim
