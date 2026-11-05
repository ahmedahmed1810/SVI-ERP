/* =========================================================
   SÉRIE B (04/11/2026) : PARAMÉTRAGE GÉNÉRAL — commun à toute l'application (B2, B6, B7, B8, B9, B20, B22, B24, B26, B31, B38, B41)
   Une seule rangée d'onglets (forme des onglets du budget, même largeur, glissables pour changer l'ordre).
   Données : svi_pg_v1 (partagées par la base). Chaque liste = tableau au format commun (CRÉER … ICI, cases à droite, SUPPRIMER LES LIGNES COCHÉES) ;
   LIEUX et BANQUES = tableaux pliables (pays › région › ville ; banque › agence).
   ========================================================= */
const SVI_PG_K = "svi_pg_v1";
const SVI_PG_DEF = {
  grades: [{ id: "g1", n: "1", lab: "DIRECTEUR GÉNÉRAL" }, { id: "g2", n: "2", lab: "" }, { id: "g3", n: "3", lab: "" }],
  ftypes: [["FABRICANT", ""], ["DISTRIBUTEUR", ""], ["REVENDEUR", ""], ["LOUEUR", ""], ["SOUS-TRAITANT", "STR", "CNSS; ATTESTATION FISCALE; ASSURANCE RC"], ["ORGANISME FINANCIER", "FIN"]].map(([lab, pre, docs], i) => ({ id: "t" + (i + 1), lab, pre, docs: docs || "" })),
  devises: [{ id: "d1", code: "MAD", lab: "DIRHAM MAROCAIN", def: true }, { id: "d2", code: "EUR", lab: "EURO", def: false }, { id: "d3", code: "USD", lab: "DOLLAR AMÉRICAIN", def: false }],
  lieux: [{ id: "p1", p: "", lab: "MAROC" }],
  banques: [["ATTIJARIWAFA BANK", "AWB", "007"], ["BANQUE POPULAIRE", "BP", "101-199"], ["BANK OF AFRICA", "BOA", "011"], ["BMCI", "BMCI", "013"], ["CIH BANK", "CIH", "230"],
    ["CREDIT AGRICOLE DU MAROC", "CAM", "225"], ["CREDIT DU MAROC", "CDM", "021"], ["SOCIETE GENERALE MAROC", "SGMB", "022"], ["AL BARID BANK", "ABB", "350"]].map(([lab, abr, code], i) => ({ id: "B" + (i + 1), p: "", lab, abr, code })),
  langues: ["FRANÇAIS", "ARABE", "ANGLAIS", "ESPAGNOL"]
};
function sviPg() { let o = {}; try { o = JSON.parse(localStorage.getItem(SVI_PG_K) || "{}") || {}; } catch (e) {} return o; }
function sviPgSave(o) { try { localStorage.setItem(SVI_PG_K, JSON.stringify(o)); } catch (e) {} }
const sviPgL = k => { const v = sviPg()[k]; return Array.isArray(v) ? v : JSON.parse(JSON.stringify(SVI_PG_DEF[k] || [])); };
const sviPgLSave = (k, L) => { const o = sviPg(); o[k] = L; sviPgSave(o); };
const sviPgId = () => "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const sviPgU = v => String(v ?? "").replace(/\s+/g, " ").trim().toUpperCase();
/* SOCIÉTÉ (B7) — reprend l'ICE et l'IF déjà saisis dans les paramètres d'achat */
const SVI_SOC_F = [["rs", "RAISON SOCIALE"], ["adr", "ADRESSE"], ["rc", "RC"], ["ice", "ICE"], ["if", "IF"], ["patente", "PATENTE"], ["cnss", "CNSS"], ["tel", "TÉLÉPHONE"], ["mail", "E-MAIL"]];
function sviSoc() { const s = { ...(sviPg().soc || {}) };
  try { if (!s.ice || !s.if) { const P = JSON.parse(SVI_LZ.dec(localStorage.getItem("svi_ach_prm_v1") || "") || "{}") || {}; if (!s.ice && P.socIce) s.ice = P.socIce; if (!s.if && P.socIf) s.if = P.socIf; } } catch (e) {}
  return s; }
/* CALENDRIER DE LA SOCIÉTÉ (B38) : jours non travaillés de toute la société ; un budget sans calendrier propre les reprend */
let sviPgOffMem = null;
const sviPgOffDays = () => { let raw = null; try { raw = localStorage.getItem(SVI_PG_K); } catch (e) {} if (sviPgOffMem && sviPgOffMem.raw === raw) return sviPgOffMem.v.slice(); const out = []; sviPgL("cal").forEach(x => { if (!sviIsoOk(x.a)) return; const b = sviIsoOk(x.b) && x.b >= x.a ? x.b : x.a; for (let d = x.a, i = 0; d <= b && i < 400; d = sviIsoAdd(d, 1), i++) out.push(d); }); const v = [...new Set(out)].sort(); sviPgOffMem = { raw, v }; return v.slice(); };
/* villes (LIEUX) et langues (B41 : « ajouter… » depuis une fiche = ajoutée partout) */
const sviPgVilles = () => { const L = sviPgL("lieux"), path = x => { const p = L.find(y => y.id === x.p); return p ? path(p).concat(x.lab) : [x.lab]; };
  return L.filter(x => x.p && !L.some(y => y.p === x.id) && L.find(y => y.id === x.p) && L.find(y => y.id === x.p).p).map(x => ({ id: x.id, lab: x.lab, path: path(x).join(" › ") })); };
const sviLangues = () => { const v = sviPg().langues; return Array.isArray(v) ? v : SVI_PG_DEF.langues.slice(); };
function sviLangueAdd(l) { l = sviPgU(l); if (!l) return; const L = sviLangues(); if (!L.includes(l)) { L.push(l); const o = sviPg(); o.langues = L; sviPgSave(o); } }

/* ---------- tableau commun d'une liste ---------- */
function sviPgTable(pane, c) {
  const L = sviPgL(c.k);
  const cell = (x, f, i) => { const [k, , , t, opts] = f, v = x ? x[k] : "";
    if (t === "check") return `<td class="center"><input type="checkbox" class="pg-in" data-f="${k}"${v ? " checked" : ""}${x ? "" : " disabled"}></td>`;
    if (t === "sel") return `<td><select class="pg-in" data-f="${k}"><option value=""></option>${(opts() || []).map(o => `<option value="${esc(o[0])}"${String(v) === String(o[0]) ? " selected" : ""}>${esc(o[1])}</option>`).join("")}</select></td>`;
    return `<td${t === "num" || t === "date" ? ' class="center"' : ""}><input class="prm-in pg-in${t === "num" ? " center" : ""}" data-f="${k}"${t === "date" ? ' type="date"' : ""} value="${esc(v ?? "")}"${!x && i === 0 ? ` placeholder="${esc(c.newLab)}"` : ""} autocomplete="off"></td>`; };
  pane.innerHTML = `<table class="prm-table pg-t" data-pgk="${c.k}"><colgroup>${c.cols.map(f => `<col style="width:${f[2]}px">`).join("")}<col style="width:44px"></colgroup>
    <thead><tr>${c.cols.map(f => `<th class="${f[3] === "num" || f[3] === "check" || f[3] === "date" ? "center" : ""}">${esc(f[1])}</th>`).join("")}<th class="center"><input type="checkbox" class="pg-all" aria-label="Tout cocher"></th></tr></thead>
    <tbody>${L.map((x, i) => `<tr data-i="${i}">${c.cols.map(f => cell(x, f, 1)).join("")}<td class="center"><input type="checkbox" class="pg-cb"></td></tr>`).join("")}
      <tr class="prm-new pg-new">${c.cols.map((f, j) => cell(null, f, j)).join("")}<td></td></tr></tbody></table>
    <div class="prm-foot"><button type="button" class="prm-del pg-del" disabled>SUPPRIMER LES LIGNES COCHÉES <span class="svi-cnt">0</span></button></div>`;
  if (pane.__pg) return; pane.__pg = true;
  pane.addEventListener("change", e => { const t = pane.querySelector("table.pg-t"); if (!t || !e.target.closest(".pg-t, .prm-foot")) return; const C = pane.__pgc;
    if (e.target.matches(".pg-all")) t.querySelectorAll(".pg-cb").forEach(x => { x.checked = e.target.checked; });
    if (e.target.matches(".pg-cb, .pg-all")) { const n = t.querySelectorAll(".pg-cb:checked").length, b = pane.querySelector(".pg-del"); b.disabled = !n; b.querySelector(".svi-cnt").textContent = n; return; }
    const i = e.target.closest(".pg-in"); if (!i) return; const tr = i.closest("tr"), L2 = sviPgL(C.k), f = i.dataset.f, col = C.cols.find(x => x[0] === f);
    const v = i.type === "checkbox" ? i.checked : col[3] === "date" ? i.value : sviPgU(i.value);
    if (col[3] === "num" && v !== "" && !/^\d+$/.test(v)) { svToast(col[1] + " : CHIFFRES SEULEMENT.", 2500, i); sviPgTable(pane, C); return; }
    if (C.uniq && f === C.uniq && v && L2.some((x, j) => sviPgU(x[f]) === v && String(j) !== tr.dataset.i)) { svToast(col[1] + " DÉJÀ PRIS.", 2500, i); sviPgTable(pane, C); return; }
    if (tr.classList.contains("pg-new")) { if (!v) return; const x = { id: sviPgId() }; C.cols.forEach(cc => { x[cc[0]] = cc[3] === "check" ? false : ""; }); x[f] = v; L2.push(x); }
    else { const x = L2[+tr.dataset.i]; if (!x) return; if (col[3] === "radio1" || C.one === f) L2.forEach(y => { y[f] = false; }); x[f] = v; }
    sviPgLSave(C.k, L2); if (C.after) C.after(); sviPgTable(pane, C); });
  pane.addEventListener("click", e => { const b = e.target.closest(".pg-del"); if (!b || b.disabled) return; const C = pane.__pgc, t = pane.querySelector("table.pg-t");
    const del = new Set([...t.querySelectorAll(".pg-cb:checked")].map(x => +x.closest("tr").dataset.i));
    svConfirm({ title: "SUPPRIMER LES LIGNES COCHÉES", text: del.size + " LIGNE(S) SUPPRIMÉE(S).", ok: "SUPPRIMER" }).then(go => { if (!go) return; sviPgLSave(C.k, sviPgL(C.k).filter((x, i) => !del.has(i))); if (C.after) C.after(); sviPgTable(pane, C); }); });
}
/* ---------- tableau pliable (LIEUX, BANQUES) : éléments { id, p (parent), lab, … } ---------- */
function sviPgTree(pane, c) {
  const L = sviPgL(c.k), kids = id => L.filter(x => (x.p || "") === id), fold = (() => { try { return JSON.parse(sessionStorage.getItem("svi_pgfold_" + c.k) || "{}"); } catch (e) { return {}; } })();
  const rows = [], walk = (p, lv) => { kids(p).forEach(x => { const n = kids(x.id).length, lf = c.levels[lv];
      rows.push(`<tr data-id="${esc(x.id)}" data-lv="${lv}" class="pg-lv${lv}">${lf.cols.map((f, j) => j === 0
        ? `<td><span class="pg-ind" style="width:${lv * 20}px"></span>${lv < c.levels.length - 1 ? `<button type="button" class="pg-fold" data-fold="${esc(x.id)}">${fold[x.id] ? "›" : "⌄"}</button>` : `<span class="pg-fold-sp"></span>`}<input class="prm-in pg-tin" data-f="${f[0]}" value="${esc(x[f[0]] ?? "")}" autocomplete="off">${lv < c.levels.length - 1 ? svCnt(n) : ""}</td>`
        : f[3] === "sel" ? `<td><select class="pg-tin" data-f="${f[0]}"><option value=""></option>${f[4]().map(o => `<option value="${esc(o[0])}"${String(x[f[0]] || "") === String(o[0]) ? " selected" : ""}>${esc(o[1])}</option>`).join("")}</select></td>`
        : `<td class="${f[3] === "num" ? "center" : ""}"><input class="prm-in pg-tin${f[3] === "num" ? " center" : ""}" data-f="${f[0]}" value="${esc(x[f[0]] ?? "")}" autocomplete="off"></td>`).join("")}${"<td></td>".repeat(Math.max(0, c.ncol - (lf.cols.length - 1)))}<td class="center"><input type="checkbox" class="pg-cb"></td></tr>`);
      if (lv < c.levels.length - 1 && !fold[x.id]) { walk(x.id, lv + 1); rows.push(`<tr class="prm-new pg-tnew" data-p="${esc(x.id)}" data-lv="${lv + 1}"><td><span class="pg-ind" style="width:${(lv + 1) * 20 + 22}px"></span><input class="prm-in pg-tin" data-f="${c.levels[lv + 1].cols[0][0]}" placeholder="${esc(c.levels[lv + 1].newLab)}" autocomplete="off"></td>${"<td></td>".repeat(c.ncol + 1)}</tr>`); } }); };
  walk("", 0);
  rows.push(`<tr class="prm-new pg-tnew" data-p="" data-lv="0"><td><span class="pg-ind" style="width:22px"></span><input class="prm-in pg-tin" data-f="${c.levels[0].cols[0][0]}" placeholder="${esc(c.levels[0].newLab)}" autocomplete="off"></td>${"<td></td>".repeat(c.ncol + 1)}</tr>`);
  pane.innerHTML = `<table class="prm-table pg-t pg-tree" data-pgk="${c.k}"><colgroup><col style="width:360px">${c.heads.slice(1).map(h => `<col style="width:${h[1]}px">`).join("")}<col style="width:44px"></colgroup>
    <thead><tr>${c.heads.map(h => `<th>${esc(h[0])}</th>`).join("")}<th class="center"><input type="checkbox" class="pg-all" aria-label="Tout cocher"></th></tr></thead><tbody>${rows.join("")}</tbody></table>
    <div class="prm-foot"><button type="button" class="prm-del pg-del" disabled>SUPPRIMER LES LIGNES COCHÉES <span class="svi-cnt">0</span></button></div>`;
  if (pane.__pgt) return; pane.__pgt = true;
  pane.addEventListener("click", e => { const C = pane.__pgc; const fb = e.target.closest(".pg-fold"); if (fb) { let F = {}; try { F = JSON.parse(sessionStorage.getItem("svi_pgfold_" + C.k) || "{}"); } catch (er) {} F[fb.dataset.fold] = !F[fb.dataset.fold]; try { sessionStorage.setItem("svi_pgfold_" + C.k, JSON.stringify(F)); } catch (er) {} sviPgTree(pane, C); return; }
    const b = e.target.closest(".pg-del"); if (!b || b.disabled) return; const ids = [...pane.querySelectorAll(".pg-cb:checked")].map(x => x.closest("tr").dataset.id), L2 = sviPgL(C.k), all = new Set(ids);
    let more = true; while (more) { more = false; L2.forEach(x => { if (x.p && all.has(x.p) && !all.has(x.id)) { all.add(x.id); more = true; } }); }
    svConfirm({ title: "SUPPRIMER LES LIGNES COCHÉES", text: all.size + " LIGNE(S) SUPPRIMÉE(S), AVEC CE QU'ELLES CONTIENNENT.", ok: "SUPPRIMER" }).then(go => { if (!go) return; sviPgLSave(C.k, L2.filter(x => !all.has(x.id))); sviPgTree(pane, C); }); });
  pane.addEventListener("change", e => { const C = pane.__pgc;
    if (e.target.matches(".pg-all")) pane.querySelectorAll(".pg-cb").forEach(x => { x.checked = e.target.checked; });
    if (e.target.matches(".pg-cb, .pg-all")) { const n = pane.querySelectorAll(".pg-cb:checked").length, b = pane.querySelector(".pg-del"); b.disabled = !n; b.querySelector(".svi-cnt").textContent = n; return; }
    const i = e.target.closest(".pg-tin"); if (!i) return; const tr = i.closest("tr"), L2 = sviPgL(C.k), lv = +tr.dataset.lv, f = i.dataset.f, col = C.levels[lv].cols.find(x => x[0] === f) || [f, f, 0, ""];
    const v = i.tagName === "SELECT" ? i.value : sviPgU(i.value);
    if (col[3] === "num" && v && !/^\d+$/.test(v)) { svToast(col[1] + " : CHIFFRES SEULEMENT.", 2500, i); sviPgTree(pane, C); return; }
    if (col[5] && v && v.length !== col[5]) { svToast(col[1] + " : " + col[5] + " CHIFFRES.", 2500, i); sviPgTree(pane, C); return; }
    if (tr.classList.contains("pg-tnew")) { if (!v) return; const p = tr.dataset.p;
      if (f === "lab" && L2.some(x => (x.p || "") === p && sviPgU(x.lab) === v)) { svToast("DÉJÀ DANS LA LISTE.", 2500, i); return; }
      L2.push({ id: sviPgId(), p, [f]: v }); }
    else { const x = L2.find(y => y.id === tr.dataset.id); if (!x) return; if (f === "lab" && L2.some(y => y !== x && (y.p || "") === (x.p || "") && sviPgU(y.lab) === v)) { svToast("DÉJÀ DANS LA LISTE.", 2500, i); sviPgTree(pane, C); return; } x[f] = v; }
    sviPgLSave(C.k, L2); sviPgTree(pane, C); });
}
/* ---------- onglets ---------- */
const SVI_PG_TABS = [
  { k: "gen", lab: "GÉNÉRAL", sub: "RÉGLAGES PONCTUELS DE TOUTE L'APPLICATION" },
  { k: "soc", lab: "SOCIÉTÉ", sub: "IDENTITÉ DE LA SOCIÉTÉ (IMPRIMÉE SUR LES PIÈCES SELON LES MENTIONS CHOISIES)" },
  { k: "unit", lab: "UNITÉS", sub: "" }, { k: "lib", lab: "BIBLIOTHÈQUE DE PRIX", sub: "" },
  { k: "cal", lab: "CALENDRIER", sub: "JOURS NON TRAVAILLÉS DE TOUTE LA SOCIÉTÉ (FÉRIÉS, GRÈVE, DEUIL NATIONAL, ÉVÉNEMENT…)" },
  { k: "lieux", lab: "LIEUX", sub: "PAYS › RÉGION › VILLE (ADRESSES, TRANSPORT, AGENCES BANCAIRES)" },
  { k: "banq", lab: "BANQUES", sub: "BANQUES ET AGENCES, COMMUNES À TOUTE L'APPLICATION" },
  { k: "cpt", lab: "COMPTABILITÉ", sub: "COMPTES (CODE, INTITULÉ), UTILISÉS PAR TOUTE L'APPLICATION" },
  { k: "grades", lab: "GRADES", sub: "GRADE 1 = DIRECTEUR GÉNÉRAL (MODULE PERSONNEL PLUS TARD)" },
  { k: "ftypes", lab: "TYPES DE FOURNISSEURS", sub: "MÉTIER DU FOURNISSEUR, CHOISI SUR SA FICHE" },
  { k: "gprod", lab: "GROUPES DE PRODUCTIVITÉ", sub: "GROUPES DES ARTICLES (MODULE PRODUCTIVITÉ PLUS TARD)" },
  { k: "gexp", lab: "GROUPES D'EXPLOITATION", sub: "GROUPES DES ARTICLES (MODULE EXPLOITATION PLUS TARD)" },
  { k: "dev", lab: "DEVISES", sub: "LE DIRHAM PAR DÉFAUT ; LES AUTRES POUR L'IMPORT" }
];
const SVI_PG_ORD = "svi_pgord_v1";
const sviPgTabs = () => { let o = []; try { o = JSON.parse(localStorage.getItem(SVI_PG_ORD) || "[]") || []; } catch (e) {} const ks = SVI_PG_TABS.map(t => t.k);
  return o.filter(k => ks.includes(k)).concat(ks.filter(k => !o.includes(k))).map(k => SVI_PG_TABS.find(t => t.k === k)); };
const SVI_PG_CAL_M = [["FÉRIÉ", "FÉRIÉ"], ["GRÈVE", "GRÈVE"], ["DEUIL NATIONAL", "DEUIL NATIONAL"], ["ÉVÉNEMENT", "ÉVÉNEMENT"], ["AUTRE", "AUTRE"]];
function sviPgDraw(k, pane) {
  pane.__pgc = null;
  if (k === "gen") { const tv = sviTvaDef(), km = sviTrKm(), G = sviPg().gen || {}, D = sviPgL("devises");
    pane.innerHTML = `<table class="prm-table pg-gen"><colgroup><col style="width:440px"><col style="width:200px"></colgroup><thead><tr><th>RÉGLAGE</th><th class="center">VALEUR</th></tr></thead><tbody>
      <tr><td>TVA PAR DÉFAUT (%)</td><td class="center"><input class="ins-in tva-def pg-gv number" data-g="tva" inputmode="decimal" value="${tv === null ? "" : esc(String(tv).replace(".", ","))}"></td></tr>
      <tr><td>PRIX DU TRANSPORT AU KILOMÈTRE (DH / KM)</td><td class="center"><input class="ins-in trk-km pg-gv number" data-g="km" inputmode="decimal" value="${km === null ? "" : esc(String(km).replace(".", ","))}"></td></tr>
      <tr><td>FUSEAU HORAIRE</td><td class="center"><select class="pg-gv" data-g="tz">${["-1", "0", "+1", "+2"].map(z => `<option value="${z}"${(G.tz || "+1") === z ? " selected" : ""}>GMT ${z === "0" ? "" : z}</option>`).join("")}</select></td></tr>
      <tr><td>DEVISE PAR DÉFAUT</td><td class="center">${esc((D.find(x => x.def) || D[0] || {}).code || "MAD")}</td></tr></tbody></table>`;
    pane.querySelectorAll(".pg-gv").forEach(i => i.closest("tr").cells[0].dataset.tip = { tva: "COMMUNE AU BUDGET ET AUX ACHATS ; VIDE : UNE DÉSIGNATION SANS TVA NE PEUT PAS ÊTRE ENREGISTRÉE", km: "DISTANCE À VOL D'OISEAU ENTRE LE DÉPÔT DU FOURNISSEUR ET LE CHANTIER", tz: "DÉCALAGE PAR RAPPORT À GMT : HEURE AFFICHÉE ET ENREGISTRÉE PAR L'APPLICATION" }[i.dataset.g] || "");
    return; }
  if (k === "soc") { const S = sviSoc();
    pane.innerHTML = `<div class="frs-g pg-soc">${SVI_SOC_F.map(([f, l]) => `<label class="frs-f${f === "rs" || f === "adr" ? " frs-w" : ""}"><span>${l}</span><input class="ins-in pg-soc-in" data-f="${f}" value="${esc(S[f] || "")}" autocomplete="off"${f === "mail" ? " data-keepcase" : ""}></label>`).join("")}
      <div class="frs-f frs-w"><span>LOGO</span><div class="pg-logo">${S.logo ? `<img src="${esc(S.logo)}" alt="">` : ""}<input type="file" accept="image/*" class="pg-logo-in"></div></div></div>`; return; }
  if (k === "cal") { sviPgCalPrev = sviPgOffDays(); pane.__pgc = { k: "cal", newLab: "AJOUTER UN JOUR ICI… (DATE)", cols: [["a", "DU", 160, "date"], ["b", "AU (FACULTATIF)", 160, "date"], ["m", "MOTIF", 200, "sel", () => SVI_PG_CAL_M], ["lab", "INTITULÉ", 320, ""]],
      after: () => sviPgCalImpact() }; sviPgTable(pane, pane.__pgc); pane.insertAdjacentHTML("afterbegin", `<div class="pg-ttl">JOURS NON TRAVAILLÉS DE LA SOCIÉTÉ</div>`);   /* 05/11 : titre du tableau */ return; }
  if (k === "cpt") { pane.__pgc = { k: "cpt", uniq: "code", newLab: "CRÉER UN COMPTE ICI… (CODE)", cols: [["code", "CODE", 160, "num"], ["lab", "INTITULÉ", 460, ""]] }; sviPgTable(pane, pane.__pgc); return; }
  if (k === "grades") { pane.__pgc = { k: "grades", uniq: "n", newLab: "CRÉER UN GRADE ICI… (N°)", cols: [["n", "GRADE", 120, "num"], ["lab", "INTITULÉ", 460, ""]] }; sviPgTable(pane, pane.__pgc); return; }
  if (k === "ftypes") { pane.__pgc = { k: "ftypes", uniq: "lab", newLab: "CRÉER UN TYPE ICI…", cols: [["lab", "TYPE", 260, ""], ["pre", "PRÉFIXE DE RÉFÉRENCE", 170, ""], ["docs", "DOCUMENTS EXIGÉS (SÉPARÉS PAR ;)", 420, ""]] }; sviPgTable(pane, pane.__pgc); return; }
  if (k === "gprod" || k === "gexp") { pane.__pgc = { k, uniq: "lab", newLab: "CRÉER UN GROUPE ICI…", cols: [["lab", "GROUPE", 360, ""]] }; sviPgTable(pane, pane.__pgc); return; }
  if (k === "dev") { pane.__pgc = { k: "devises", uniq: "code", one: "def", newLab: "CRÉER UNE DEVISE ICI… (CODE)", cols: [["code", "CODE", 120, ""], ["lab", "DEVISE", 320, ""], ["def", "PAR DÉFAUT", 120, "check"]] }; sviPgTable(pane, pane.__pgc); return; }
  if (k === "lieux") { pane.__pgc = { k: "lieux", ncol: 0, heads: [["PAYS › RÉGION › VILLE", 360]], levels: [{ newLab: "CRÉER UN PAYS ICI…", cols: [["lab", "PAYS"]] }, { newLab: "CRÉER UNE RÉGION ICI…", cols: [["lab", "RÉGION"]] }, { newLab: "CRÉER UNE VILLE ICI…", cols: [["lab", "VILLE"]] }] };
    sviPgTree(pane, pane.__pgc); return; }
  if (k === "banq") { const V = () => sviPgVilles().map(x => [x.id, x.lab]);
    pane.__pgc = { k: "banques", ncol: 3, heads: [["BANQUE › AGENCE", 360], ["ABRÉVIATION", 130], ["CODE (BANQUE : 3 CHIFFRES DU RIB)", 220], ["VILLE (AGENCE)", 200]],
      levels: [{ newLab: "CRÉER UNE BANQUE ICI…", cols: [["lab", "BANQUE"], ["abr", "ABRÉVIATION"], ["code", "CODE BANQUE", 0, "num", null, 3]] },
        { newLab: "CRÉER UNE AGENCE ICI…", cols: [["lab", "AGENCE"], ["abr", "ABRÉVIATION"], ["code", "CODE AGENCE", 0, "num"], ["ville", "VILLE", 0, "sel", V]] }] };
    sviPgTree(pane, pane.__pgc); return; }
}
/* B38 : changement du calendrier de la société — impact sur chaque projet en cours ; tous cochés, décocher un par un ;
   appliqué dès aujourd'hui aux projets restés cochés (les autres gardent leur calendrier d'avant) */
let sviPgCalPrev = null;
function sviPgCalImpact() {
  const before = sviPgCalPrev || [], now = sviPgOffDays(), today = new Date().toISOString().slice(0, 10);
  sviPgCalPrev = now;
  const added = now.filter(d => !before.includes(d) && d >= today), removed = before.filter(d => !now.includes(d) && d >= today);
  if (!added.length && !removed.length) return;
  let I = []; try { I = sviInstGet().filter(b => b && !b.virtual && b.state !== "valide" && !b.rclOf); } catch (e) {}
  if (!I.length) return;
  const hit = b => { const P = (b.data || {}).dlp || {}; let n = 0; Object.values(P).forEach(L => (L || []).forEach(p => { if ([...added, ...removed].some(d => d >= p.deb && d <= p.fin)) n++; })); return n; };
  const d = sviWinNew();
  d.innerHTML = sviWinCard({ title: "CALENDRIER DE LA SOCIÉTÉ — IMPACT SUR LES PROJETS EN COURS", close: "data-x",
    body: `<div class="svc-sub">${added.length ? added.length + " JOUR(S) NON TRAVAILLÉ(S) AJOUTÉ(S)" : ""}${added.length && removed.length ? " · " : ""}${removed.length ? removed.length + " RETIRÉ(S)" : ""}, À PARTIR D'AUJOURD'HUI. DÉCOCHER LES PROJETS À NE PAS CHANGER.</div>
      <table class="prm-table"><thead><tr><th>PROJET</th><th class="center">PÉRIODES DE TÂCHES TOUCHÉES</th><th class="center"><input type="checkbox" class="pgc-all" checked></th></tr></thead>
      <tbody>${I.map(b => `<tr><td>${esc((b.project || "") + " " + b.ref)}</td><td class="center">${svCnt(hit(b))}</td><td class="center"><input type="checkbox" class="pgc-cb" data-ref="${esc(b.ref)}" checked></td></tr>`).join("")}</tbody></table>`,
    foot: `<button type="button" class="svc-b" data-x>ANNULER</button><button type="button" class="svc-b svc-ok svc-neutral" data-ok>APPLIQUER</button>` });
  sviWinShow(d);
  d.addEventListener("change", e => { if (e.target.matches(".pgc-all")) d.querySelectorAll(".pgc-cb").forEach(x => { x.checked = e.target.checked; }); });
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) { /* aucun projet changé : chacun garde le calendrier d'avant */
      const L0 = sviInstGet(); L0.forEach(b => { if (I.some(x => x.ref === b.ref) && b.data && !b.data.cal) b.data.cal = { we: SVI_CAL_DEF.we.slice(), off: before.slice(), on: [] }; }); sviInstSet(L0); try { sviInstFlush(); } catch (er) {} d.remove(); return; }
    if (!e.target.closest("[data-ok]")) return;
    const on = new Set([...d.querySelectorAll(".pgc-cb:checked")].map(x => x.dataset.ref)), L = sviInstGet();
    L.forEach(b => { if (!I.some(x => x.ref === b.ref)) return; const D = b.data || (b.data = {});
      if (on.has(b.ref)) { if (D.cal) { const off = new Set(D.cal.off || []); added.forEach(x => off.add(x)); removed.forEach(x => off.delete(x)); D.cal.off = [...off].sort(); } }
      else if (!D.cal) D.cal = { we: SVI_CAL_DEF.we.slice(), off: before.slice(), on: [] }; });
    sviInstSet(L); try { sviInstFlush(); } catch (er) {} d.remove(); svToast("CALENDRIER APPLIQUÉ À " + on.size + " PROJET(S).", 3000); });
}
