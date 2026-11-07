/* =========================================================
   RÈGLES DE SAISIE ET D'IMPORT (refonte, étapes 8 et 9, v645) — calcul pur, sans écran ni budget ouvert ;
   testées une par une (tests/test_app.py, « règle saisie » et « règle import »).
   ========================================================= */
/* ---------- intitulés presque identiques (cahier 00, Doublons, v490 remarque 2) ----------
   mêmes nombres ; même texte aux accents, tirets, espaces et ponctuation près ; ou une seule faute
   (lettre en plus, en moins, changée, deux lettres voisines inversées) sur des intitulés d'au moins 5 lettres */
const sviNearNorm = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/Œ/g, "OE").replace(/[^A-Z0-9]+/g, "");
const sviNearDigits = s => (String(s ?? "").match(/\d+/g) || []).map(x => String(+x)).join(",");
const sviNearDist1 = (a, b) => {
  if (a === b) return false;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  if (la === lb) {
    const diff = []; for (let i = 0; i < la; i++) if (a[i] !== b[i]) { diff.push(i); if (diff.length > 2) return false; }
    if (diff.length === 1) return true;
    return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
  }
  const [s, l] = la < lb ? [a, b] : [b, a];
  let i = 0; while (i < s.length && s[i] === l[i]) i++;
  return s.slice(i) === l.slice(i + 1);
};
const sviIsNear = (a, b) => {
  const U = v => String(v ?? "").trim().toUpperCase();
  if (!a || !b || U(a) === U(b)) return false;
  if (sviNearDigits(a) !== sviNearDigits(b)) return false;
  const na = sviNearNorm(a), nb = sviNearNorm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return Math.min(na.length, nb.length) >= 5 && sviNearDist1(na, nb);
};
/* ---------- import ---------- */
/* titre de colonne ou valeur comparée sans accents, majuscules, espaces réduits */
const sviBfNorm = v => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
/* nature d'un onglet : QUALITÉ (CRITÈRE + POINT DE CONTRÔLE, ou QUALITÉ), BUDGET (DÉSIGNATION CLIENT), DÉLAIS (ACTIVITÉ SECONDAIRE + DÉBUT / FIN / PRÉDÉCESSEURS) */
const sviSheetKind = aoa => {
  const rows = (aoa || []).slice(0, 15).map(r => (r || []).map(sviBfNorm));
  if (rows.some(r => r.includes("CRITERE") && r.includes("POINT DE CONTROLE"))) return "qlt";
  if (rows.some(r => r.includes("DESIGNATION CLIENT"))) return "budget";
  if (rows.some(r => r.includes("ACTIVITE SECONDAIRE") && (r.includes("DEBUT") || r.includes("FIN") || r.includes("PREDECESSEURS")))) return "dly";
  if (rows.some(r => r.includes("QUALITE"))) return "qlt";
  return "";
};
/* date tapée JJ/MM/AAAA (aussi JJ.MM.AA, JJ-MM-AAAA, JJMMAAAA) → AAAA-MM-JJ ; "" si vide ; null si invalide */
const sviDateParse = v => {
  const t = String(v || "").trim();
  if (!t) return "";
  const m = t.match(/^(\d{1,2})[\/.\- ](\d{1,2})[\/.\- ](\d{2,4})$/) || t.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (!m) return null;
  let y = Number(m[3]); if (y < 100) y += 2000;
  const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
  if (isNaN(d) || d.getDate() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1) return null;
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
/* date d'une case importée : nombre Excel, objet date, ISO (avec heure : jour local), JJ/MM/AAAA */
const sviImpDate = v => {
  if (v === "" || v === null || v === undefined) return "";
  if (typeof v === "number" && v > 20000) { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000); return d.toISOString().slice(0, 10); }
  if (v instanceof Date && !isNaN(v)) return v.getFullYear() + "-" + String(v.getMonth() + 1).padStart(2, "0") + "-" + String(v.getDate()).padStart(2, "0");
  const t = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:/.test(t)) { const d = new Date(t); if (!isNaN(d)) return sviImpDate(d); }
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return sviDateParse(t);
};
/* type d'une liaison importée : vide / FD / FIN → DÉBUT = FD ; DD / DÉBUT → DÉBUT = DD ; autre = null (refusé) */
const sviLinkType = t => { const n = sviBfNorm(t).replace(/[^A-Z]/g, ""); if (!n || n === "FD" || n === "FINDEBUT") return "FD"; if (n === "DD" || n === "DEBUTDEBUT") return "DD"; return null; };
