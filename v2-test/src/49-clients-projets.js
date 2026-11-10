/* =========================================================
   10/11/2026 (Ahmed) : MODULES CLIENTS ET PROJETS — au menu principal juste après ACHAT, chacun avec sa LISTE, sa FICHE (page)
   et sa fenêtre i, construits comme le module FOURNISSEURS (même moteur : achNvMod / achNvList, mêmes règles de forme, liste BDG).
   CLIENT  : la fiche du fournisseur, retournée vers la vente — IDENTITÉ (et CONTACTS), FISCAL ET LÉGAL, BANQUE ET PAIEMENT,
             CONDITIONS DE VENTE, RISQUE, CLIENTS SIMILAIRES, STATISTIQUES ; page : ses PROJETS et ses BUDGETS.
   PROJET  : IDENTITÉ (code, intitulé, client, chef de projet), MARCHÉ, CHANTIER, DATES, INTERVENANTS ; page : ses BUDGETS.
   Les projets déjà nommés dans les budgets sont repris une fois (client, marché, GPS lus dans le budget) — rien n'est effacé du budget.
   Données : svi_ach_cli_v1, svi_ach_prj_v1 (partagées comme les autres données des achats).
   ========================================================= */
const achCli = () => { const L = achJ(ACH_K.cli, []); return Array.isArray(L) ? L : []; };
const achCliSave = L => achW(ACH_K.cli, L);
const achPrj = () => { const L = achJ(ACH_K.prj, []); return Array.isArray(L) ? L : []; };
const achPrjSave = L => achW(ACH_K.prj, L);
const achCliNextCode = L => "CLI-" + String(L.reduce((m, a) => Math.max(m, Number(String(a.code || "").replace(/\D/g, "")) || 0), 0) + 1).padStart(4, "0");
const achCliNew = (L, o) => { const now = achNow();
  const c = { id: "K" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), code: achCliNextCode(L), nom: achU(o.nom || ""), denom: "", forme: "", type: o.type || "", grp: "", pays: "", ville: "", adresse: "", lang: "", site: "",
    dirigeant: "", resp: "", logo: "", lie: "", mailSit: "", mailFac: "", cte: [], ice: "", ifisc: "", rc: "", villeRc: "", patente: "", capital: "", cnss: "", docs: [],
    codeCpt: "", intCpt: "", ribs: [], plafEnc: "", jours: "", payeur: "", cau: [], modeReg: "", delai: "", retTaux: "", escTaux: "", devise: "", cgf: [], cla: [], solva: "", strat: "", evl: [],
    st: "instance", cree: now, mod: now, del: "" };
  L.push(c); return c; };
const achPrjNew = (L, o) => { const now = achNow();
  const p = { id: "J" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), code: achU(o.code || ""), intitule: achU(o.intitule || ""), cli: o.cli || "", chef: "", cons: !!o.cons, aoNum: o.aoNum || "", aoObj: o.aoObj || "", marche: "",
    adresse: "", ville: "", gps: o.gps || "", deb: "", fin: "", butoir: "", interv: [], st: "instance", cree: o.cree || now, mod: now, del: "" };
  L.push(p); return p; };
const achCliNom = id => ((achCli().find(c => c.id === id) || {}).nom) || "";
/* budgets d'un projet (référence de projet du budget = CODE PROJET) */
const achPrjBdg = code => { let L = []; try { L = sviInstGet(); } catch (e) {} const k = achU(code); return L.filter(b => achU(b.project || "") === k && !b.del); };
const achBdgTtc = ref => { try { const r = (window.bdgRows || (typeof bdgRows !== "undefined" ? bdgRows : []) || []).find(x => x && x.ref === ref); return r ? +r.ttc || 0 : ""; } catch (e) { return ""; } };
const achBdgNat = b => b.virtual ? "CONSOLIDÉ" : b.rclOf ? "RECALAGE" : b.parent ? "AVENANT " + (b.avn || 1) : "INITIAL";
const achBdgEt = b => ({ instance: "EN INSTANCE", fige: "FIGÉ", valide: "VALIDÉ", annule: "ANNULÉ" }[b.state || "instance"] || String(b.state || "").toUpperCase());
const achBdgGo = ref => { document.querySelector('#navMenu .nav-btn[data-view="bdg"]')?.click(); setTimeout(() => { try { if (window.__sviAvOpen) window.__sviAvOpen(ref); } catch (e) {} }, 350); };
/* reprise : un projet par référence de projet trouvée dans les budgets (client, marché et GPS lus dans le budget) */
function achPrjSync() { let B = []; try { B = sviInstGet(); } catch (e) { return; } if (!B.length) return;
  const P = achPrj(), C = achCli(), have = new Set(P.map(p => achU(p.code))); let chP = false, chC = false;
  B.forEach(b => { const code = achU(b.project || ""); if (!code || have.has(code)) return; have.add(code);
    const D = b.data || {}, A = D.ao || {}, nm = achU(b.client || ""); let cli = "";
    if (nm) { let c = C.find(x => !x.del && achU(x.nom) === nm); if (!c) { c = achCliNew(C, { nom: nm, type: A.pub === true ? "PUBLIC" : A.pub === false ? "PRIVÉ" : "" }); chC = true; } cli = c.id; }
    achPrjNew(P, { code, cli, cons: !!A.cons, aoNum: A.num || "", aoObj: A.obj || "", gps: D.gps || "", cree: b.created || "" }); chP = true; });
  if (chC) achCliSave(C); if (chP) achPrjSave(P); }
const ACH_CLI_TYPES = ["PUBLIC", "PRIVÉ"];
const ACH_PRJ_ROLES = ["ARCHITECTE", "BUREAU D'ÉTUDES", "BUREAU DE CONTRÔLE", "LABORATOIRE", "TOPOGRAPHE", "AUTRE"];
const achCliWhy = c => { const w = []; if (!c.nom) w.push("NOM MANQUANT"); if (c.type === "PRIVÉ" && !achDig(c.ice)) w.push("ICE MANQUANT"); return w; };
const achPrjWhy = p => { const w = []; if (!p.code) w.push("CODE PROJET MANQUANT"); if (!p.cli) w.push("CLIENT MANQUANT"); return w; };
const achCpSt = x => x.del ? "annule" : x.arch ? "archive" : x.bloq ? "bloque" : achSt(x);

/* ---------- fenêtre i commune (onglets, sections, tableaux de lignes) — même forme que la fenêtre i du fournisseur ---------- */
function achCpWin(o) {
  /* o = { L, save, id, ttl, tabs: [[k, lab, [sections]]], secs: { k: (F, h) => html }, subs: { k: { cols, blank } }, check(F, L) → msg, hist } */
  const L0 = o.L(), x0 = L0.find(y => y.id === o.id); if (!x0) return;
  const F = JSON.parse(JSON.stringify(x0)), ro = !!x0.del || achSt(x0) !== "instance" && !o.editValid;
  Object.keys(o.subs || {}).forEach(k => { if (!Array.isArray(F[k])) F[k] = []; });
  let tab = o.tabs[0][0]; const d = sviWinNew();
  const h = {
    inp: (k, lab, q = {}) => `<label class="frs-f${q.w ? " frs-w" : ""}"><span>${lab}${q.req ? " <b>*</b>" : ""}</span><input class="ins-in cp-x" data-k="${k}"${q.mask ? ` data-mask="${q.mask}"` : ""} value="${esc(q.mask && typeof sviMaskFmt === "function" ? sviMaskFmt(q.mask, F[k] ?? "") : F[k] ?? "")}"${q.num ? ' inputmode="numeric"' : ""}${q.date ? ' type="date"' : ""}${q.keep ? " data-keepcase" : ""}${q.list ? ` list="cpL-${k}"` : ""}${ro || q.ro ? " readonly" : ""} autocomplete="off">${q.list ? `<datalist id="cpL-${k}">${q.list.map(v => `<option value="${esc(v)}">`).join("")}</datalist>` : ""}</label>`,
    sel: (k, lab, opts, q = {}) => `<label class="frs-f${q.w ? " frs-w" : ""}"><span>${lab}${q.req ? " <b>*</b>" : ""}</span><select class="ins-in cp-xs" data-k="${k}"${ro ? " disabled" : ""}><option value="">—</option>${opts.map(v => { const a = Array.isArray(v) ? v[0] : v, t = Array.isArray(v) ? v[1] : v; return `<option value="${esc(a)}"${String(F[k] ?? "") === String(a) ? " selected" : ""}>${esc(t)}</option>`; }).join("")}</select></label>`,
    chk: (k, lab) => `<label class="frs-c"><input type="checkbox" class="cp-xc" data-k="${k}"${F[k] ? " checked" : ""}${ro ? " disabled" : ""}> ${lab}</label>`,
    ro: (lab, v) => `<label class="frs-f"><span>${lab}</span><input class="ins-in" value="${esc(v ?? "")}" readonly tabindex="-1"></label>`,
    sub: (k, add) => { const S = o.subs[k]; return `<table class="prm-table frs-sub cp-sub" data-sub="${k}"><thead><tr>${S.cols.map(c => `<th${c[2] ? ` class="${c[2]}"` : ""}>${c[1]}</th>`).join("")}${ro ? "" : '<th class="center"></th>'}</tr></thead><tbody>
      ${F[k].map((r, i) => `<tr data-i="${i}">${S.cols.map(c => `<td${c[2] ? ` class="${c[2]}"` : ""}><input class="ins-in cp-s${c[2] === "number" ? " number" : ""}" data-c="${c[0]}" value="${esc(r[c[0]] ?? "")}"${c[3] === "date" ? ' type="date"' : c[2] === "number" ? ' inputmode="decimal"' : ""}${ro ? " readonly" : ""} autocomplete="off"></td>`).join("")}${ro ? "" : `<td class="center"><button type="button" class="ach-x" data-cprm="${k}|${i}" title="Retirer">✕</button></td>`}</tr>`).join("")}
      ${ro ? "" : `<tr class="rec-new" data-cpadd="${k}"><td colspan="${S.cols.length + 1}">CRÉER ${esc(add)} ICI…</td></tr>`}</tbody></table>`; } };
  const pull = () => { d.querySelectorAll(".cp-x").forEach(i => { const k = i.dataset.k; F[k] = i.type === "date" || i.hasAttribute("data-keepcase") ? String(i.value).trim() : i.dataset.mask ? achDig(i.value) || String(i.value).trim() : achU(i.value); });
    d.querySelectorAll(".cp-xs").forEach(s => { F[s.dataset.k] = s.value; }); d.querySelectorAll(".cp-xc").forEach(c => { F[c.dataset.k] = !!c.checked; });
    d.querySelectorAll("table[data-sub]").forEach(t => { const k = t.dataset.sub; t.querySelectorAll("tbody tr[data-i]").forEach(tr => { const r = F[k][+tr.dataset.i]; if (!r) return; tr.querySelectorAll(".cp-s").forEach(i => { r[i.dataset.c] = i.type === "date" ? i.value : i.classList.contains("number") ? (String(i.value).trim() === "" ? "" : achN(i.value)) : /mail/i.test(i.dataset.c) ? String(i.value).trim().toLowerCase() : achU(i.value); }); }); }); };
  const draw = () => { const why = o.why ? o.why(F) : [];
    d.innerHTML = sviWinCard({ cls: "frs-card cp-card", close: "data-x", title: achWinTtl(o.ttl(F), o.ttl(F)),
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}</div>` : ""}<div class="rec-tabs frs-tabs">${o.tabs.map(t => `<button type="button" class="rec-tab${t[0] === tab ? " active on" : ""}" data-cptab="${t[0]}">${t[1]}</button>`).join("")}</div>
        <div class="frs-scroll">${o.tabs.map(t => t[2].map(s => `<div class="frs-sec" data-s="${s}"${t[0] === tab ? "" : " hidden"}>${o.secs[s](F, h, ro)}</div>`).join("")).join("")}</div>`,
      foot: `<button type="button" class="svc-b" data-x>ANNULER</button>${ro ? "" : `<button type="button" class="svc-b svc-ok svc-neutral" data-cpok>ENREGISTRER</button>`}` }); };
  draw(); sviWinShow(d);
  d.addEventListener("change", e => { const f = e.target.closest(".cp-logo-in"); if (!f || !f.files || !f.files[0]) return; const r = new FileReader(); r.onload = () => { pull(); F.logo = String(r.result || ""); draw(); }; r.readAsDataURL(f.files[0]); });
  d.addEventListener("click", async e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (o.done) o.done(); return; }
    const tb = e.target.closest("[data-cptab]"); if (tb) { if (!ro) pull(); tab = tb.dataset.cptab; draw(); return; }
    if (ro) return;
    const ad = e.target.closest("[data-cpadd]"); if (ad) { pull(); const k = ad.dataset.cpadd; F[k].push(JSON.parse(JSON.stringify(o.subs[k].blank))); draw(); return; }
    const rm = e.target.closest("[data-cprm]"); if (rm) { pull(); const [k, i] = rm.dataset.cprm.split("|"); F[k].splice(+i, 1); draw(); return; }
    if (e.target.closest("[data-logorm]")) { pull(); F.logo = ""; draw(); return; }
    if (!e.target.closest("[data-cpok]")) return;
    pull(); const L = o.L(), x = L.find(y => y.id === o.id); if (!x) return;
    const bad = o.check ? o.check(F, L) : ""; if (bad) { svToast(bad, 3500); return; }
    const ch = Object.keys(o.labs).filter(k => JSON.stringify(x[k] ?? "") !== JSON.stringify(F[k] ?? ""));
    Object.assign(x, F, { mod: achNow() }); o.save(L); if (ch.length) achHist(x.code, "MODIFICATION", ch.map(k => o.labs[k]).join(", "));
    d.remove(); if (o.done) o.done(); });
}

/* ---------- CLIENT : fenêtre i ---------- */
const ACH_CLI_LAB = { nom: "NOM", denom: "DÉNOMINATION", forme: "FORME", type: "TYPE", grp: "GROUPE", pays: "PAYS", ville: "VILLE", adresse: "ADRESSE", lang: "LANGUE", site: "SITE WEB", dirigeant: "DIRIGEANT", resp: "RESPONSABLE INTERNE", logo: "LOGO", lie: "CLIENT LIÉ",
  mailSit: "E-MAIL DES SITUATIONS", mailFac: "E-MAIL DE FACTURATION", cte: "CONTACTS", ice: "ICE", ifisc: "IF", rc: "RC", villeRc: "VILLE RC", patente: "PATENTE", capital: "CAPITAL", cnss: "CNSS", docs: "DOCUMENTS",
  codeCpt: "CODE COMPTABLE", intCpt: "INTITULÉ COMPTABLE", ribs: "RIB", plafEnc: "PLAFOND D'ENCOURS", jours: "JOURS DE PAIEMENT HABITUELS", payeur: "PERSONNE QUI PAIE", cau: "CAUTIONS", modeReg: "MODE DE RÈGLEMENT", delai: "DÉLAI DE PAIEMENT",
  retTaux: "RETENUE DE GARANTIE", escTaux: "ESCOMPTE", devise: "DEVISE", cgf: "CONTRATS", cla: "CLAUSES", solva: "SOLVABILITÉ", strat: "PLACE DU CLIENT", evl: "ÉVALUATIONS" };
function achCliFiche(id, done) {
  achCpWin({ L: achCli, save: achCliSave, id, done, labs: ACH_CLI_LAB, why: achCliWhy, ttl: F => esc(F.nom || "") + " : " + esc(F.code || ""),
    check: (F, L) => !F.nom ? "NOM OBLIGATOIRE." : (achDig(F.ice) && L.some(y => y.id !== id && !y.del && achDig(y.ice) === achDig(F.ice))) ? "UN AUTRE CLIENT A CET ICE." : "",
    tabs: [["id", "IDENTITÉ", ["id", "cte"]], ["leg", "FISCAL ET LÉGAL", ["fisc", "docs"]], ["bq", "BANQUE ET PAIEMENT", ["cpt", "rib", "enc", "cau"]], ["vte", "CONDITIONS DE VENTE", ["cond", "cgf", "cla"]],
      ["rsq", "RISQUE", ["rsq", "evl"]], ["sim", "CLIENTS SIMILAIRES", ["sim"]], ["stat", "STATISTIQUES", ["stat"]]],
    subs: { cte: { cols: [["nom", "NOM"], ["fonction", "FONCTION"], ["tel", "TÉLÉPHONE"], ["email", "E-MAIL"]], blank: { nom: "", fonction: "", tel: "", email: "" } },
      docs: { cols: [["type", "DOCUMENT"], ["no", "N°"], ["exp", "EXPIRE LE", "", "date"]], blank: { type: "", no: "", exp: "" } },
      ribs: { cols: [["rib", "RIB"], ["bq", "BANQUE"]], blank: { rib: "", bq: "" } },
      cau: { cols: [["type", "TYPE"], ["no", "N°"], ["bq", "BANQUE"], ["mt", "MONTANT", "number"], ["ech", "ÉCHÉANCE", "", "date"]], blank: { type: "", no: "", bq: "", mt: "", ech: "" } },
      cgf: { cols: [["intitule", "INTITULÉ"], ["debut", "DÉBUT", "", "date"], ["fin", "FIN", "", "date"], ["mt", "MONTANT", "number"]], blank: { intitule: "", debut: "", fin: "", mt: "" } },
      cla: { cols: [["txt", "CLAUSE"]], blank: { txt: "" } },
      evl: { cols: [["date", "DATE", "", "date"], ["note", "NOTE / 5", "number"], ["obs", "OBSERVATION"]], blank: { date: "", note: "", obs: "" } } },
    secs: {
      id: (F, h) => `<div class="frs-st">IDENTITÉ</div><div class="frs-g">${achCreeFld(F)}${h.inp("nom", "NOM", { req: 1, w: 1 })}${h.inp("denom", "DÉNOMINATION SOCIALE", { w: 1 })}${h.sel("type", "TYPE DE CLIENT", ACH_CLI_TYPES)}
        ${h.inp("forme", "FORME JURIDIQUE", { list: ["ADMINISTRATION", "ÉTABLISSEMENT PUBLIC", "COLLECTIVITÉ", "SA", "SARL", "SARL AU", "SNC", "PARTICULIER"] })}${h.inp("grp", "GROUPE")}${h.inp("pays", "PAYS")}
        ${h.inp("ville", "VILLE", { list: typeof sviPgVilles === "function" ? sviPgVilles().map(x => x.lab) : [] })}${h.inp("adresse", "ADRESSE", { w: 1 })}${h.inp("lang", "LANGUE")}${h.inp("site", "SITE WEB", { keep: 1 })}
        ${h.inp("dirigeant", "DIRIGEANT")}${h.inp("resp", "RESPONSABLE INTERNE")}${h.sel("lie", "CLIENT LIÉ", achCli().filter(y => !y.del && y.id !== F.id).map(y => [y.id, y.nom]))}
        ${h.inp("mailSit", "E-MAIL DES SITUATIONS", { keep: 1 })}${h.inp("mailFac", "E-MAIL DE FACTURATION", { keep: 1 })}
        <div class="frs-f frs-w frs-logo"><span>LOGO</span><div>${F.logo ? `<img src="${esc(F.logo)}" alt="">` : ""}<input type="file" accept="image/*" class="cp-logo-in">${F.logo ? ` <button type="button" class="ach-b" data-logorm>RETIRER LE LOGO</button>` : ""}</div></div></div>`,
      cte: (F, h) => `<div class="frs-st">CONTACTS ${svCnt(F.cte.length)}</div>${h.sub("cte", "UN CONTACT")}`,
      fisc: (F, h) => `<div class="frs-st">FISCAL ET LÉGAL</div><div class="frs-g">${h.inp("ice", "ICE", { num: 1, mask: "ice", req: F.type === "PRIVÉ" })}${h.inp("ifisc", "IDENTIFIANT FISCAL", { num: 1, mask: "if" })}${h.inp("rc", "REGISTRE DE COMMERCE", { num: 1, mask: "rc" })}
        ${h.inp("villeRc", "VILLE RC")}${h.inp("patente", "PATENTE", { num: 1 })}${h.inp("capital", "CAPITAL", { num: 1 })}${h.inp("cnss", "N° CNSS", { num: 1, mask: "cnss" })}</div>`,
      docs: (F, h) => `<div class="frs-st">DOCUMENTS ${svCnt(F.docs.length)}</div>${h.sub("docs", "UN DOCUMENT")}`,
      cpt: (F, h) => `<div class="frs-st">COMPTE COMPTABLE</div><div class="frs-g">${h.inp("codeCpt", "CODE COMPTABLE")}${h.inp("intCpt", "INTITULÉ COMPTABLE", { w: 1 })}</div>`,
      rib: (F, h) => `<div class="frs-st">RIB ${svCnt(F.ribs.length)}</div>${h.sub("ribs", "UN RIB")}`,
      enc: (F, h) => `<div class="frs-st">ENCOURS ET ENCAISSEMENT</div><div class="frs-g">${h.ro("ENCOURS ACTUEL", "—")}${h.inp("plafEnc", "PLAFOND D'ENCOURS", { num: 1 })}${h.inp("jours", "JOURS DE PAIEMENT HABITUELS", { num: 1 })}${h.inp("payeur", "PERSONNE QUI PAIE")}</div>`,
      cau: (F, h) => `<div class="frs-st">CAUTIONS ET GARANTIES DONNÉES ${svCnt(F.cau.length)}</div>${h.sub("cau", "UNE CAUTION")}`,
      cond: (F, h) => `<div class="frs-st">CONDITIONS DE PAIEMENT</div><div class="frs-g">${h.inp("modeReg", "MODE DE RÈGLEMENT", { list: typeof ACH_MODES !== "undefined" ? ACH_MODES : [] })}${h.inp("delai", "DÉLAI DE PAIEMENT (JOURS)", { num: 1 })}
        ${h.inp("retTaux", "RETENUE DE GARANTIE (%)", { num: 1 })}${h.inp("escTaux", "ESCOMPTE (%)", { num: 1 })}${h.inp("devise", "DEVISE", { list: ["MAD", "EUR", "USD"] })}</div>`,
      cgf: (F, h) => `<div class="frs-st">CONTRATS ${svCnt(F.cgf.length)}</div>${h.sub("cgf", "UN CONTRAT")}`,
      cla: (F, h) => `<div class="frs-st">CLAUSES ${svCnt(F.cla.length)}</div>${h.sub("cla", "UNE CLAUSE")}`,
      rsq: (F, h) => `<div class="frs-st">RISQUE</div><div class="frs-g">${h.sel("solva", "SOLVABILITÉ", ["BONNE", "MOYENNE", "FAIBLE"])}${h.sel("strat", "PLACE DU CLIENT", ["STRATÉGIQUE", "IMPORTANT", "COURANT", "OCCASIONNEL"])}</div>`,
      evl: (F, h) => `<div class="frs-st">ÉVALUATIONS ${svCnt(F.evl.length)}</div>${h.sub("evl", "UNE ÉVALUATION")}`,
      sim: F => { const S = achCli().filter(y => !y.del && y.id !== F.id && ((F.grp && y.grp === F.grp) || (F.type && y.type === F.type && F.ville && y.ville === F.ville)));
        return `<div class="frs-st">CLIENTS SIMILAIRES ${svCnt(S.length)}</div><table class="prm-table frs-sub"><thead><tr><th>RÉFÉRENCE</th><th>NOM</th><th>TYPE</th><th>VILLE</th></tr></thead><tbody>${S.map(y => `<tr><td>${esc(y.code)}</td><td>${esc(y.nom)}</td><td>${esc(y.type || "")}</td><td>${esc(y.ville || "")}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">MÊME GROUPE, OU MÊME TYPE ET MÊME VILLE : AUCUN.</td></tr>`}</tbody></table>`; },
      stat: (F, h) => { const P = achPrj().filter(p => !p.del && p.cli === F.id), B = P.flatMap(p => achPrjBdg(p.code));
        return `<div class="frs-st">STATISTIQUES</div><div class="frs-g">${h.ro("PROJETS", P.length)}${h.ro("PROJETS EN COURS", P.filter(p => !p.arch && achSt(p) === "instance").length)}${h.ro("BUDGETS", B.length)}${h.ro("MONTANT FACTURÉ (12 MOIS)", "—")}${h.ro("MONTANT ENCAISSÉ (12 MOIS)", "—")}</div>`; } } });
}
/* ---------- PROJET : fenêtre i ---------- */
const ACH_PRJ_LAB = { code: "CODE PROJET", intitule: "INTITULÉ", cli: "CLIENT", chef: "CHEF DE PROJET", cons: "SUR CONSULTATION", aoNum: "N° D'APPEL D'OFFRES", aoObj: "OBJET DU MARCHÉ", marche: "N° DU MARCHÉ",
  adresse: "ADRESSE", ville: "VILLE", gps: "GPS DU CHANTIER", deb: "DATE DE DÉBUT", fin: "DATE DE FIN", butoir: "DATE BUTOIR", interv: "INTERVENANTS" };
function achPrjFiche(id, done) {
  achCpWin({ L: achPrj, save: achPrjSave, id, done, labs: ACH_PRJ_LAB, why: achPrjWhy, ttl: F => esc(F.code || "") + (F.intitule ? " : " + esc(F.intitule) : ""),
    check: (F, L) => !F.code ? "CODE PROJET OBLIGATOIRE." : L.some(y => y.id !== id && !y.del && achU(y.code) === achU(F.code)) ? "CE CODE PROJET EXISTE DÉJÀ." : "",
    tabs: [["id", "IDENTITÉ", ["id"]], ["mar", "MARCHÉ", ["mar"]], ["cht", "CHANTIER", ["cht"]], ["dat", "DATES", ["dat"]], ["itv", "INTERVENANTS", ["itv"]]],
    subs: { interv: { cols: [["role", "RÔLE"], ["nom", "NOM"], ["contact", "CONTACT"], ["tel", "TÉLÉPHONE"]], blank: { role: "", nom: "", contact: "", tel: "" } } },
    secs: {
      id: (F, h) => `<div class="frs-st">IDENTITÉ</div><div class="frs-g">${achCreeFld(F)}${h.inp("code", "CODE PROJET", { req: 1, ro: achPrjBdg(F.code).length > 0 })}${h.inp("intitule", "INTITULÉ DU PROJET", { w: 1 })}
        ${h.sel("cli", "CLIENT", achCli().filter(y => !y.del).map(y => [y.id, y.nom]), { req: 1 })}${h.inp("chef", "CHEF DE PROJET")}</div>`,
      mar: (F, h) => `<div class="frs-st">MARCHÉ</div><div class="frs-g">${h.ro("TYPE DE CLIENT", ((achCli().find(c => c.id === F.cli) || {}).type) || "—")}${h.chk("cons", "SUR CONSULTATION")}${h.inp("aoNum", "N° D'APPEL D'OFFRES")}${h.inp("marche", "N° DU MARCHÉ")}${h.inp("aoObj", "OBJET DU MARCHÉ", { w: 1 })}</div>`,
      cht: (F, h) => `<div class="frs-st">CHANTIER</div><div class="frs-g">${h.inp("adresse", "ADRESSE", { w: 1 })}${h.inp("ville", "VILLE", { list: typeof sviPgVilles === "function" ? sviPgVilles().map(x => x.lab) : [] })}${h.inp("gps", "GPS DU CHANTIER", { keep: 1 })}</div>`,
      dat: (F, h) => `<div class="frs-st">DATES</div><div class="frs-g">${h.inp("deb", "DATE DE DÉBUT", { date: 1 })}${h.inp("fin", "DATE DE FIN", { date: 1 })}${h.inp("butoir", "DATE BUTOIR (DÉLAI DU CONTRAT)", { date: 1 })}</div>`,
      itv: (F, h) => `<div class="frs-st">INTERVENANTS ${svCnt(F.interv.length)}</div>${h.sub("interv", "UN INTERVENANT")}<div class="frs-note">RÔLES : ${ACH_PRJ_ROLES.join(", ")}.</div>` } });
}

/* ---------- cycle commun (VALIDER, BLOQUER, ARCHIVER, SUPPRIMER) ---------- */
const achCpAct = (L0, save, id, one, nomOf) => async (k, redraw) => { const L = L0(), x = L.find(y => y.id === id); if (!x) return; const nm = nomOf(x);
  if (k === "val") { if (await achNvValider(L, x, x.code, nm, [], save)) redraw(); return; }
  if (k === "bloq") { const m = await achAsk("BLOQUER " + nm, "MOTIF DU BLOCAGE"); if (!m) return; x.bloq = { u: typeof sviUser === "function" ? sviUser() : "", t: achNow(), why: m }; x.mod = achNow(); save(L); achHist(x.code, "BLOQUÉ", m); redraw(); return; }
  if (k === "debl") { const m = await achAsk("DÉBLOQUER " + nm, "MOTIF DU DÉBLOCAGE"); if (!m) return; delete x.bloq; x.mod = achNow(); save(L); achHist(x.code, "DÉBLOQUÉ", m); redraw(); return; }
  if (k === "arch") { if (!(await svConfirm({ title: "ARCHIVER", text: x.code + " — " + nm + " : IL NE SERA PLUS PROPOSÉ.", ok: "ARCHIVER" }))) return; x.arch = achNow(); x.mod = x.arch; save(L); achHist(x.code, "ARCHIVÉ", nm); redraw(); return; }
  if (k === "desarch") { delete x.arch; x.mod = achNow(); save(L); achHist(x.code, "DÉSARCHIVÉ", nm); redraw(); return; }
  if (k === "del") { if (!(await svConfirm({ title: "SUPPRIMER " + achCe(one), text: x.code + " — " + nm + " (RESTAURABLE DEPUIS LA CORBEILLE).", ok: "SUPPRIMER" }))) return; x.del = achNow(); save(L); achHist(x.code, "CORBEILLE", nm); redraw(); return; }
  if (k === "rest") { x.del = ""; save(L); achHist(x.code, "RESTAURATION", nm); redraw(); } };
const achCpMenu = (x, one) => [...achNvCycle(x), x.del ? null : x.bloq ? { k: "debl", lab: "DÉBLOQUER" } : { k: "bloq", lab: "BLOQUER" }, x.del ? null : x.arch ? { k: "desarch", lab: "DÉSARCHIVER" } : { k: "arch", lab: "ARCHIVER" },
  x.del ? { k: "rest", lab: "RESTAURER" } : { k: "del", lab: "SUPPRIMER " + achCe(one) }].filter(Boolean);
const ACH_CP_ETATS = [["actif", "ACTIFS"], ["bloque", "BLOQUÉS"], ["archive", "ARCHIVÉS"], ["corbeille", "CORBEILLE"], ["tout", "TOUT"]];
const achCpOk = (x, k) => k === "corbeille" ? !!x.del : x.del ? false : k === "tout" ? true : k === "archive" ? !!x.arch : k === "bloque" ? !x.arch && !!x.bloq : !x.arch && !x.bloq;
const achBdgRows = B => B.map(b => ({ cells: [b.ref, b.intitule || "", achBdgNat(b), achBdgTtc(b.ref), achBdgEt(b)], open: () => achBdgGo(b.ref), st: (b.state || "instance") === "instance" ? "instance" : b.state === "annule" ? "" : "valide", cls: b.state === "annule" ? "nv-strike" : "" }));
const ACH_BDG_COLS = [["RÉFÉRENCE"], ["INTITULÉ"], ["NATURE"], ["MONTANT TTC", "number"], ["ÉTAT", "center"]];

/* ---------- CLIENTS : liste et page ---------- */
function achCliNvMod(ctx) {
  return achNvMod(ctx, {
    list: { k: "cli", t: "ach_cli", id: "achCliT", name: "CLIENTS", one: "CLIENT", stKeys: ["instance", "valide", "bloque", "archive", "annule", "alerte"], edit: ACH_ED.cli, all: () => { achPrjSync(); return achCli(); }, save: achCliSave, code: c => c.code, nom: c => c.nom, why: achCliWhy,
      newRow: "CRÉER UN CLIENT ICI…",
      add: async done => { const nom = await achAsk("NOUVEAU CLIENT", "NOM"); if (!nom) { done(null); return; } const L = achCli(); if (L.some(y => !y.del && achU(y.nom) === achU(nom))) svToast("UN CLIENT DU MÊME NOM EXISTE.", 3500);
        const c = achCliNew(L, { nom }); achCliSave(L); achHist(c.code, "CRÉATION", c.nom); done(c.id); achCliFiche(c.id, () => done(c.id)); },
      w: { ref: 110, nom: 300, type: 100, ville: 140, ice: 160, prj: 90, cree: 110 },
      etat0: "tout", etats: ACH_CP_ETATS, ok: achCpOk,
      cols: () => [["ref", "RÉFÉRENCE", c => c.code, ""], ["nom", "NOM", c => c.nom, "", c => c.logo || ""], ["type", "TYPE", c => c.type || "", "center"], ["ville", "VILLE", c => c.ville || "", ""], ["ice", "ICE", c => achDig(c.ice), "center"],
        ["prj", "PROJETS", c => String(achPrj().filter(p => !p.del && p.cli === c.id).length), "center"]] },
    pageOf: id => { const c = achCli().find(x => x.id === id); if (!c) return null;
      const P = achPrj().filter(p => !p.del && p.cli === id), B = P.flatMap(p => achPrjBdg(p.code));
      return { id, code: c.code, ref: c.code, tag: "CLIENT", title: c.nom, st: achCpSt(c), del: !!c.del, why: achCliWhy(c),
        info: done => achCliFiche(id, () => done()), menu: achCpMenu(c, "CLIENT"), act: achCpAct(achCli, achCliSave, id, "CLIENT", x => x.nom),
        links: [
          { t: "PROJETS", cols: [["CODE"], ["INTITULÉ"], ["VILLE"], ["BUDGETS", "center"], ["ÉTAT", "center"]], rows: P.map(p => ({ cells: [p.code, p.intitule || "", p.ville || "", String(achPrjBdg(p.code).length), achPcStep("prj", p)], open: () => achGo("prj", p.id), st: achSt(p) })) },
          { t: "BUDGETS", cols: [["PROJET"]].concat(ACH_BDG_COLS), rows: B.map(b => { const r = achBdgRows([b])[0]; r.cells.unshift(achU(b.project || "")); return r; }) },
          { t: "CONTACTS", cols: [["NOM"], ["FONCTION"], ["TÉLÉPHONE"], ["E-MAIL"]], rows: (c.cte || []).map(x => ({ cells: [x.nom || "", x.fonction || "", x.tel || "", x.email || ""] })) }] }; } });
}
/* ---------- PROJETS : liste et page ---------- */
function achPrjNvMod(ctx) {
  return achNvMod(ctx, {
    list: { k: "prj", t: "ach_prj", id: "achPrjT", name: "PROJETS", one: "PROJET", stKeys: ["instance", "valide", "bloque", "archive", "annule", "alerte"], edit: ACH_ED.prj, all: () => { achPrjSync(); return achPrj(); }, save: achPrjSave, code: p => p.code, nom: p => p.intitule, why: achPrjWhy,
      newRow: "CRÉER UN PROJET ICI…",
      add: async done => { const code = await achAsk("NOUVEAU PROJET", "CODE PROJET"); if (!code) { done(null); return; } const L = achPrj(); if (L.some(y => !y.del && achU(y.code) === achU(code))) { svToast("CE CODE PROJET EXISTE DÉJÀ.", 3500); done(null); return; }
        const p = achPrjNew(L, { code }); achPrjSave(L); achHist(p.code, "CRÉATION", p.code); done(p.id); achPrjFiche(p.id, () => done(p.id)); },
      w: { ref: 110, intitule: 280, cli: 220, ville: 140, bdg: 90, cree: 110 },
      etat0: "tout", etats: ACH_CP_ETATS, ok: achCpOk,
      cols: () => [["ref", "CODE PROJET", p => p.code, ""], ["intitule", "INTITULÉ", p => p.intitule || "", ""], ["cli", "CLIENT", p => achCliNom(p.cli), ""], ["ville", "VILLE", p => p.ville || "", ""],
        ["bdg", "BUDGETS", p => String(achPrjBdg(p.code).length), "center"]] },
    pageOf: id => { const p = achPrj().find(x => x.id === id); if (!p) return null; const c = achCli().find(x => x.id === p.cli);
      return { id, code: p.code, ref: p.code, tag: "PROJET", title: p.intitule || p.code, party: c ? c.nom : "", partyGo: c ? "cli|" + c.id : "", st: achCpSt(p), del: !!p.del, why: achPrjWhy(p),
        info: done => achPrjFiche(id, () => done()), menu: achCpMenu(p, "PROJET"), act: achCpAct(achPrj, achPrjSave, id, "PROJET", x => x.intitule || x.code),
        links: [
          { t: "BUDGETS", cols: ACH_BDG_COLS, rows: achBdgRows(achPrjBdg(p.code)) },
          { t: "INTERVENANTS", cols: [["RÔLE"], ["NOM"], ["CONTACT"], ["TÉLÉPHONE"]], rows: (p.interv || []).map(x => ({ cells: [x.role || "", x.nom || "", x.contact || "", x.tel || ""] })) }] }; } });
}
