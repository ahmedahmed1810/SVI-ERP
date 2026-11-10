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
  let tab = o.tabs[0][0]; const d = sviWinNew(), OPEN = new Set([o.tabs[0][2][0]]);
  const h = {
    inp: (k, lab, q = {}) => `<label class="frs-f${q.w ? " frs-w" : ""}"><span>${lab}${q.req ? " <b>*</b>" : ""}</span><input class="ins-in cp-x" data-k="${k}"${q.mask ? ` data-mask="${q.mask}"` : ""} value="${esc(q.mask && typeof sviMaskFmt === "function" ? sviMaskFmt(q.mask, F[k] ?? "") : F[k] ?? "")}"${q.num ? ' inputmode="numeric"' : ""}${q.date ? ' type="date"' : ""}${q.keep ? " data-keepcase" : ""}${q.list ? ` list="cpL-${k}"` : ""}${ro || q.ro ? " readonly" : ""} autocomplete="off">${q.list ? `<datalist id="cpL-${k}">${q.list.map(v => `<option value="${esc(v)}">`).join("")}</datalist>` : ""}</label>`,
    sel: (k, lab, opts, q = {}) => `<label class="frs-f${q.w ? " frs-w" : ""}"><span>${lab}${q.req ? " <b>*</b>" : ""}</span><select class="ins-in cp-xs" data-k="${k}"${ro ? " disabled" : ""}><option value="">—</option>${opts.map(v => { const a = Array.isArray(v) ? v[0] : v, t = Array.isArray(v) ? v[1] : v; return `<option value="${esc(a)}"${String(F[k] ?? "") === String(a) ? " selected" : ""}>${esc(t)}</option>`; }).join("")}</select></label>`,
    chk: (k, lab) => `<label class="frs-c"><input type="checkbox" class="cp-xc" data-k="${k}"${F[k] ? " checked" : ""}${ro ? " disabled" : ""}> ${lab}</label>`,
    ro: (lab, v) => `<label class="frs-f"><span>${lab}</span><input class="ins-in" value="${esc(v ?? "")}" readonly tabindex="-1"></label>`,
    area: (k, lab) => `<label class="frs-f frs-w cp-wide"><span>${lab}</span><textarea class="ins-in cp-x" data-k="${k}" rows="3"${ro ? " readonly" : ""}>${esc(F[k] ?? "")}</textarea></label>`,
    color: (k, lab) => `<label class="frs-f"><span>${lab}</span><input type="color" class="cp-x cp-col" data-k="${k}" value="${esc(F[k] || "#13447a")}"${ro ? " disabled" : ""}></label>`,
    photo: (k, lab) => `<div class="frs-f frs-w frs-logo"><span>${lab}</span><div>${F[k] ? `<img src="${esc(F[k])}" alt="">` : ""}${ro ? "" : `<input type="file" accept="image/*" class="cp-logo-in" data-k="${k}">${F[k] ? ` <button type="button" class="ach-b" data-logorm="${k}">RETIRER</button>` : ""}`}</div></div>`,
    /* colonnes : [clé, titre, classe, type ("date" | "sel" | "calc"), choix (sel) ou calcul (calc, en gris)] */
    sub: (k, add) => { const S = o.subs[k], cell = (c, r) => c[3] === "calc" ? `<input class="ins-in cp-calc${c[2] === "number" ? " number" : ""}" value="${esc(c[4](r) ?? "")}" readonly tabindex="-1">`
        : c[3] === "sel" ? `<select class="ins-in cp-s" data-c="${c[0]}"${ro ? " disabled" : ""}><option value="">—</option>${(typeof c[4] === "function" ? c[4]() : c[4]).map(v => `<option value="${esc(v)}"${String(r[c[0]] ?? "") === String(v) ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>`
        : `<input class="ins-in cp-s${c[2] === "number" ? " number" : ""}" data-c="${c[0]}" value="${esc(r[c[0]] ?? "")}"${c[3] === "date" ? ' type="date"' : c[2] === "number" ? ' inputmode="decimal"' : ""}${c[3] === "list" ? ` list="cpS-${k}-${c[0]}"` : ""}${ro ? " readonly" : ""} autocomplete="off">`;
      const dl = S.cols.filter(c => c[3] === "list").map(c => `<datalist id="cpS-${k}-${c[0]}">${(typeof c[4] === "function" ? c[4]() : c[4]).map(v => `<option value="${esc(v)}">`).join("")}</datalist>`).join("");
      return `${dl}<table class="prm-table frs-sub cp-sub" data-sub="${k}"><thead><tr>${S.cols.map(c => `<th${c[2] ? ` class="${c[2]}"` : ""}>${c[1]}</th>`).join("")}${ro ? "" : '<th class="center"></th>'}</tr></thead><tbody>
      ${F[k].map((r, i) => `<tr data-i="${i}">${S.cols.map(c => `<td${c[2] ? ` class="${c[2]}"` : ""}>${cell(c, r)}</td>`).join("")}${ro ? "" : `<td class="center"><button type="button" class="ach-x" data-cprm="${k}|${i}" title="Retirer">✕</button></td>`}</tr>`).join("")}
      ${ro ? "" : `<tr class="rec-new" data-cpadd="${k}"><td colspan="${S.cols.length + 1}">CRÉER ${esc(add)} ICI…</td></tr>`}</tbody></table>`; } };
  const pull = () => { d.querySelectorAll(".cp-x").forEach(i => { const k = i.dataset.k; F[k] = i.type === "date" || i.type === "color" || i.hasAttribute("data-keepcase") ? String(i.value).trim() : i.dataset.mask ? achDig(i.value) || String(i.value).trim() : achU(i.value); });
    d.querySelectorAll(".cp-xs").forEach(s => { F[s.dataset.k] = s.value; }); d.querySelectorAll(".cp-xc").forEach(c => { F[c.dataset.k] = !!c.checked; });
    d.querySelectorAll("table[data-sub]").forEach(t => { const k = t.dataset.sub; t.querySelectorAll("tbody tr[data-i]").forEach(tr => { const r = F[k][+tr.dataset.i]; if (!r) return; tr.querySelectorAll(".cp-s").forEach(i => { r[i.dataset.c] = i.type === "date" || i.tagName === "SELECT" ? i.value : i.classList.contains("number") ? (String(i.value).trim() === "" ? "" : achN(i.value)) : /mail/i.test(i.dataset.c) ? String(i.value).trim().toLowerCase() : achU(i.value); }); }); }); };
  const draw = () => { const why = o.why ? o.why(F) : [];
    d.innerHTML = sviWinCard({ cls: "frs-card cp-card", close: "data-x", title: achWinTtl(o.ttl(F), o.ttl(F)),
      body: `${why.length ? `<div class="frs-why">⚠ ${why.map(esc).join(" · ")}</div>` : ""}<div class="rec-tabs frs-tabs">${o.tabs.map(t => `<button type="button" class="rec-tab${t[0] === tab ? " active on" : ""}" data-cptab="${t[0]}">${t[1]}</button>`).join("")}</div>
        <div class="frs-scroll">${o.tabs.map(t => t[2].map(s => !o.fold ? `<div class="frs-sec" data-s="${s}"${t[0] === tab ? "" : " hidden"}>${o.secs[s](F, h, ro)}</div>`
          /* K1 : section à titre pliable (› / ⌄) et pastille (nombre de champs, ou de lignes d'un tableau) ; la 1re de l'onglet dépliée à l'ouverture */
          : (() => { const S = o.fold[s], on = OPEN.has(s), n = S[1] === "t" ? (F[S[2]] || []).length : S[1]; return `<div class="frs-sec cp-fsec${on ? " on" : ""}" data-s="${s}"${t[0] === tab ? "" : " hidden"}><button type="button" class="frs-st cp-st" data-cpsec="${s}"><span class="cp-ar">${on ? "⌄" : "›"}</span>${S[0]} ${svCnt(n)}</button><div class="cp-body"${on ? "" : " hidden"}>${o.secs[s](F, h, ro)}</div></div>`; })()).join("")).join("")}</div>`,
      foot: `<button type="button" class="svc-b" data-x>ANNULER</button>${ro ? "" : `<button type="button" class="svc-b svc-ok svc-neutral" data-cpok>ENREGISTRER</button>`}` }); };
  draw(); sviWinShow(d);
  d.addEventListener("change", e => { const f = e.target.closest(".cp-logo-in"); if (f && f.files && f.files[0]) { const r = new FileReader(); r.onload = () => { pull(); F[f.dataset.k || "logo"] = String(r.result || ""); draw(); }; r.readAsDataURL(f.files[0]); return; }
    if (o.live && e.target.closest(".cp-x, .cp-xs, .cp-xc, .cp-s")) { pull(); draw(); } });   /* K1 : champs calculés recalculés à la saisie */
  d.addEventListener("click", async e => {
    if (e.target === d || e.target.closest("[data-x]")) { d.remove(); if (o.done) o.done(); return; }
    const tb = e.target.closest("[data-cptab]"); if (tb) { if (!ro) pull(); tab = tb.dataset.cptab; OPEN.clear(); OPEN.add((o.tabs.find(t => t[0] === tab) || [0, 0, []])[2][0]); draw(); return; }
    const sc = e.target.closest("[data-cpsec]"); if (sc) { if (!ro) pull(); const k = sc.dataset.cpsec; if (OPEN.has(k)) OPEN.delete(k); else OPEN.add(k); draw(); return; }
    if (ro) return;
    const ad = e.target.closest("[data-cpadd]"); if (ad) { pull(); const k = ad.dataset.cpadd; F[k].push(JSON.parse(JSON.stringify(o.subs[k].blank))); draw(); return; }
    const rm = e.target.closest("[data-cprm]"); if (rm) { pull(); const [k, i] = rm.dataset.cprm.split("|"); F[k].splice(+i, 1); draw(); return; }
    const lr = e.target.closest("[data-logorm]"); if (lr) { pull(); F[lr.dataset.logorm || "logo"] = ""; draw(); return; }
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
/* ---------- PROJET : fenêtre i (série K, K1) — 6 onglets, 18 sections pliables ---------- */
const ACH_PRJ_AV = 30;   /* K1 : alerte ⚠ des échéances, jours d'avance par défaut (proposé) */
const achDPlus = (d, j) => { const t = new Date(String(d).slice(0, 10) + "T12:00:00"); if (isNaN(t)) return ""; t.setDate(t.getDate() + Math.round(j)); return t.toISOString().slice(0, 10); };
const achDMois = (d, m) => { const t = new Date(String(d).slice(0, 10) + "T12:00:00"); if (isNaN(t)) return ""; t.setMonth(t.getMonth() + Math.round(m)); return t.toISOString().slice(0, 10); };
const achJours = (a, b) => { const x = new Date(String(a).slice(0, 10) + "T12:00:00"), y = new Date(String(b).slice(0, 10) + "T12:00:00"); return isNaN(x) || isNaN(y) ? "" : Math.max(0, Math.round((y - x) / 864e5)); };
/* DATE BUTOIR = OS DE COMMENCEMENT + DÉLAI D'EXÉCUTION + PROLONGATIONS (délais des avenants, jours) + JOURS D'ARRÊT ; sans OS ou sans délai : saisie */
const achPrjButoir = p => !p.dOs || !(achN(p.delaiMois) > 0) ? p.butoir || "" : achDPlus(achDMois(p.dOs, achN(p.delaiMois)), (p.avn || []).reduce((t, a) => t + achN(a.delai), 0) + (p.arrets || []).reduce((t, a) => t + (achJours(a.dArr, a.dRep) || 0), 0));
const achPrjTtc = p => achN(p.mtHt) * (1 + achN(p.tva) / 100);
const achPrjEtat = p => p.del ? "SUPPRIMÉ" : p.arch ? "ARCHIVÉ" : p.clot ? "CLÔTURÉ" : "EN INSTANCE";
const achPrjStOf = p => p.del ? "annule" : p.arch ? "archive" : p.bloq ? "bloque" : p.clot ? "valide" : "instance";
const achPrjDist = p => { try { const a = sviGpsParse(p.gps), G = (typeof sviPg === "function" ? sviPg().gen : {}) || {}, b = sviGpsParse(G.gpsDep || G.gps || ""); return a && b ? Math.round(sviGpsKm(a, b)) + " KM" : "—"; } catch (e) { return "—"; } };
/* échéances du projet (alerte ⚠ avant la date, 10.5) */
const achPrjEch = p => { const out = [], lim = achDPlus(new Date().toISOString(), ACH_PRJ_AV), push = (d, lab) => { if (d && String(d).slice(0, 10) <= lim) out.push(lab + " : " + achDFr(d)); };
  if (!p.clot && !p.arch) push(achPrjButoir(p), "DATE BUTOIR");
  (p.cau || []).forEach(c => { if (!c.mainlevee) push(c.ech, "CAUTION " + (c.type || "") + " — ÉCHÉANCE"); });
  (p.ass || []).forEach(a => push(a.ech, "ASSURANCE " + (a.type || "") + " — ÉCHÉANCE"));
  push(p.odpEch, "OCCUPATION DU DOMAINE PUBLIC — ÉCHÉANCE");
  (p.res || []).forEach(r => { if (!r.levee) push(r.avant, "RÉSERVE " + (r.no || "") + " À LEVER AVANT"); });
  return out; };
const achPrjWhyK = p => achPrjWhy(p).concat(p.del ? [] : achPrjEch(p));
const ACH_PRJ_LAB = { code: "CODE PROJET", intitule: "INTITULÉ", typeOuv: "TYPE D'OUVRAGE", nature: "NATURE", prio: "PRIORITÉ", couleur: "COULEUR", photo: "PHOTO", chef: "CHEF DE PROJET", conduc: "CONDUCTEUR DE TRAVAUX", chefCh: "CHEF DE CHANTIER", desc: "DESCRIPTION",
  adresse: "ADRESSE", ville: "VILLE", province: "PROVINCE", gps: "GPS DU CHANTIER", surface: "EMPRISE / SURFACE", baseVie: "BASE VIE / DÉPÔT", contact: "CONTACT SUR PLACE", acces: "ACCÈS ET CONTRAINTES",
  cli: "CLIENT", moad: "MAÎTRE D'OUVRAGE DÉLÉGUÉ", aoNum: "N° D'APPEL D'OFFRES", dPlis: "OUVERTURE DES PLIS", aoObj: "OBJET DU MARCHÉ", marche: "N° DU MARCHÉ", dSign: "SIGNATURE", dAppr: "APPROBATION", dNotif: "NOTIFICATION",
  mtHt: "MONTANT HT", tva: "TVA", modePrix: "MODE DE PRIX", revision: "RÉVISION DES PRIX", avance: "AVANCE", penTaux: "PÉNALITÉS (TAUX)", penPlaf: "PÉNALITÉS (PLAFOND)", grpMand: "GROUPEMENT — MANDATAIRE", grpParts: "GROUPEMENT — PARTS", finance: "SOURCE DE FINANCEMENT",
  lots: "LOTS DU MARCHÉ", avn: "AVENANTS", ccli: "CONTACTS DU CLIENT", interv: "INTERVENANTS", str: "SOUS-TRAITANCE",
  delaiMois: "DÉLAI D'EXÉCUTION", dOs: "OS DE COMMENCEMENT", deb: "DATE DE DÉBUT", fin: "DATE DE FIN", butoir: "DATE BUTOIR", arrets: "OS D'ARRÊT ET DE REPRISE", recProv: "RÉCEPTION PROVISOIRE", recDef: "RÉCEPTION DÉFINITIVE", garantie: "DÉLAI DE GARANTIE",
  eff: "EFFECTIF PRÉVU", mat: "MATÉRIEL AFFECTÉ", horaires: "HORAIRES", cal: "CALENDRIER", reuJour: "RÉUNION — JOUR", reuHeure: "RÉUNION — HEURE", reuPer: "RÉUNION — PÉRIODICITÉ", reuPart: "RÉUNION — PARTICIPANTS",
  decPer: "PÉRIODICITÉ DES DÉCOMPTES", decMode: "MODE DE FACTURATION", delaiPay: "DÉLAI DE PAIEMENT", interets: "INTÉRÊTS MORATOIRES", cau: "CAUTIONS", rgTaux: "RETENUE DE GARANTIE (%)", rgPlaf: "RETENUE DE GARANTIE (PLAFOND)", rgDate: "RESTITUTION DE LA RETENUE", ass: "ASSURANCES",
  analyt: "CODE ANALYTIQUE", devise: "DEVISE", tvaReg: "RÉGIME DE TVA", tvaRef: "RÉFÉRENCE DE L'EXONÉRATION", banque: "BANQUE DU CHANTIER",
  pcNo: "PERMIS — N°", pcDate: "PERMIS — DATE", pcAut: "PERMIS — AUTORITÉ", odpNo: "DOMAINE PUBLIC — N°", odpDate: "DOMAINE PUBLIC — DATE", odpEch: "DOMAINE PUBLIC — ÉCHÉANCE", doc: "DÉCLARATION D'OUVERTURE", br: "BRANCHEMENTS",
  coordSec: "COORDINATEUR SÉCURITÉ", pss: "PLAN DE SÉCURITÉ", panneau: "PANNEAU DE CHANTIER", dechFil: "DÉCHETS — FILIÈRE", dechPrest: "DÉCHETS — PRESTATAIRE", acc: "ACCIDENTS ET INCIDENTS", res: "RÉSERVES", recl: "RÉCLAMATIONS" };
const ON = ["OUI", "NON"];
const achBanques = () => { try { return sviPgL("banques").filter(x => !x.p).map(x => x.lab); } catch (e) { return []; } };
const achDevises = () => { try { const D = sviPgL("devises").map(x => x.code); return D.length ? D : ["MAD"]; } catch (e) { return ["MAD"]; } };
const achQqNoms = () => { try { const S = new Set(); (sviInstGet() || []).forEach(b => ((b.data || {}).qlt || []).forEach(q => { [q.org, q.labo, q.bc, q.nom].forEach(v => { if (v) S.add(achU(v)); }); })); achPrj().forEach(p => (p.interv || []).forEach(x => { if (x.nom) S.add(achU(x.nom)); })); return [...S].sort(); } catch (e) { return []; } };
function achPrjFiche(id, done) {
  const p0 = achPrj().find(x => x.id === id); if (!p0) return;
  achCpWin({ L: achPrj, save: achPrjSave, id, done, labs: ACH_PRJ_LAB, why: achPrjWhyK, live: true, editValid: true, ttl: F => esc(F.code || ""),   /* I8 : code du projet seul au bandeau */
    check: (F, L) => !F.code ? "CODE PROJET OBLIGATOIRE." : L.some(y => y.id !== id && !y.del && achU(y.code) === achU(F.code)) ? "CE CODE PROJET EXISTE DÉJÀ." : "",
    tabs: [["id", "IDENTITÉ", ["gen", "cht"]], ["mar", "MARCHÉ", ["mar", "lots", "avn"]], ["itv", "INTERVENANTS", ["ccli", "interv", "str"]], ["del", "DÉLAIS ET MOYENS", ["dl", "moy", "reu"]],
      ["fin", "FINANCES", ["fac", "gar", "cpt"]], ["cnf", "CONFORMITÉ ET SUIVI", ["aut", "sec", "res", "recl"]]],
    fold: { gen: ["GÉNÉRAL", 14], cht: ["CHANTIER", 9], mar: ["MARCHÉ", 22], lots: ["LOTS DU MARCHÉ", "t", "lots"], avn: ["AVENANTS", "t", "avn"], ccli: ["CONTACTS DU CLIENT", "t", "ccli"], interv: ["INTERVENANTS", "t", "interv"], str: ["SOUS-TRAITANCE", "t", "str"],
      dl: ["DÉLAIS", 9], moy: ["MOYENS", 4], reu: ["RÉUNIONS", 4], fac: ["FACTURATION", 5], gar: ["GARANTIES ET ASSURANCES", 5], cpt: ["COMPTABILITÉ", 5], aut: ["AUTORISATIONS", 8], sec: ["SÉCURITÉ ET ENVIRONNEMENT", 6], res: ["RÉSERVES", "t", "res"], recl: ["RÉCLAMATIONS ET CONTENTIEUX", "t", "recl"] },
    subs: { lots: { cols: [["no", "N°"], ["intitule", "INTITULÉ"], ["mt", "MONTANT", "number"], ["attr", "ATTRIBUÉ", "center", "sel", ON]], blank: { no: "", intitule: "", mt: "", attr: "" } },
      avn: { cols: [["no", "N°"], ["date", "DATE", "", "date"], ["objet", "OBJET"], ["mt", "MONTANT", "number"], ["delai", "DÉLAI SUPPLÉMENTAIRE (JOURS)", "number"]], blank: { no: "", date: "", objet: "", mt: "", delai: "" } },
      ccli: { cols: [["nom", "NOM"], ["fonction", "FONCTION"], ["tel", "TÉLÉPHONE"], ["email", "E-MAIL"], ["role", "RÔLE", "", "sel", ["SIGNATAIRE", "SUIVI TECHNIQUE", "PAIEMENT"]]], blank: { nom: "", fonction: "", tel: "", email: "", role: "" } },
      interv: { cols: [["role", "RÔLE", "", "sel", ACH_PRJ_ROLES], ["nom", "NOM", "", "list", achQqNoms], ["contact", "CONTACT"], ["refc", "RÉFÉRENCE DU CONTRAT"]], blank: { role: "", nom: "", contact: "", refc: "" } },
      str: { cols: [["frs", "SOUS-TRAITANT", "", "sel", () => achFrs().filter(f => !f.del && !f.arch).map(f => f.nom)], ["trav", "TRAVAUX CONFIÉS"], ["mt", "MONTANT", "number"], ["agr", "AGRÉMENT DU M.O.", "center", "sel", ON], ["dAgr", "DATE D'AGRÉMENT", "", "date"], ["cmd", "COMMANDE", "", "sel", () => achCmf().filter(c => !c.del && c.state !== "annule").map(c => c.ref)]], blank: { frs: "", trav: "", mt: "", agr: "", dAgr: "", cmd: "" } },
      arrets: { cols: [["dArr", "DATE D'ARRÊT", "", "date"], ["dRep", "DATE DE REPRISE", "", "date"], ["motif", "MOTIF"], ["j", "JOURS D'ARRÊT", "number", "calc", r => achJours(r.dArr, r.dRep)]], blank: { dArr: "", dRep: "", motif: "" } },
      eff: { cols: [["metier", "MÉTIER"], ["nb", "EFFECTIF", "number"]], blank: { metier: "", nb: "" } },
      mat: { cols: [["engin", "ENGIN"], ["du", "DU", "", "date"], ["au", "AU", "", "date"]], blank: { engin: "", du: "", au: "" } },
      cau: { cols: [["type", "CAUTION", "", "sel", ["PROVISOIRE", "DÉFINITIVE", "D'AVANCE"]], ["mt", "MONTANT", "number"], ["bq", "BANQUE", "", "sel", achBanques], ["ech", "ÉCHÉANCE", "", "date"], ["mainlevee", "MAINLEVÉE LE", "", "date"]], blank: { type: "", mt: "", bq: "", ech: "", mainlevee: "" } },
      ass: { cols: [["type", "ASSURANCE", "", "sel", ["TOUS RISQUES CHANTIER", "RESPONSABILITÉ CIVILE", "DÉCENNALE"]], ["assureur", "ASSUREUR"], ["police", "N° DE POLICE"], ["ech", "ÉCHÉANCE", "", "date"]], blank: { type: "", assureur: "", police: "", ech: "" } },
      br: { cols: [["type", "BRANCHEMENT", "", "sel", ["EAU", "ÉLECTRICITÉ", "ASSAINISSEMENT"]], ["op", "OPÉRATEUR"], ["dossier", "N° DE DOSSIER"], ["mes", "MISE EN SERVICE", "", "date"]], blank: { type: "", op: "", dossier: "", mes: "" } },
      acc: { cols: [["date", "DATE", "", "date"], ["nature", "NATURE"], ["suite", "SUITE DONNÉE"]], blank: { date: "", nature: "", suite: "" } },
      res: { cols: [["no", "N°"], ["desc", "DESCRIPTION"], ["lot", "LOT"], ["emise", "ÉMISE LE", "", "date"], ["avant", "À LEVER AVANT", "", "date"], ["levee", "LEVÉE LE", "", "date"], ["etat", "ÉTAT", "center", "calc", r => r.levee ? "LEVÉE" : "À LEVER"]], blank: { no: "", desc: "", lot: "", emise: "", avant: "", levee: "" } },
      recl: { cols: [["date", "DATE", "", "date"], ["objet", "OBJET"], ["mtR", "MONTANT RÉCLAMÉ", "number"], ["partie", "PARTIE", "", "sel", ["CLIENT", "SOUS-TRAITANT", "FOURNISSEUR"]], ["etat", "ÉTAT", "", "sel", ["EN COURS", "ACCEPTÉE", "REJETÉE", "EN CONTENTIEUX", "CLOSE"]], ["mtO", "MONTANT OBTENU", "number"]], blank: { date: "", objet: "", mtR: "", partie: "", etat: "", mtO: "" } } },
    secs: {
      gen: (F, h) => `<div class="frs-g">${achCreeFld(F)}${h.inp("code", "CODE PROJET", { req: 1, ro: achPrjBdg(p0.code).length > 0 })}${h.inp("intitule", "INTITULÉ", { w: 1 })}${h.ro("ÉTAT", achPrjEtat(F))}
        ${h.sel("typeOuv", "TYPE D'OUVRAGE", ["BÂTIMENT", "VRD", "GÉNIE CIVIL", "OUVRAGE D'ART", "HYDRAULIQUE", "AUTRE"])}${h.sel("nature", "NATURE", ["MARCHÉ PUBLIC", "MARCHÉ PRIVÉ", "SOUS-TRAITANCE"])}${h.sel("prio", "PRIORITÉ", ["HAUTE", "NORMALE", "BASSE"])}
        ${h.color("couleur", "COULEUR DU PROJET")}${h.inp("chef", "CHEF DE PROJET")}${h.inp("conduc", "CONDUCTEUR DE TRAVAUX")}${h.inp("chefCh", "CHEF DE CHANTIER")}${h.photo("photo", "PHOTO DU PROJET")}${h.area("desc", "DESCRIPTION")}</div>`,
      cht: (F, h) => `<div class="frs-g">${h.inp("adresse", "ADRESSE", { w: 1 })}${h.inp("ville", "VILLE", { list: typeof sviPgVilles === "function" ? sviPgVilles().map(x => x.lab) : [] })}${h.inp("province", "PROVINCE")}${h.inp("gps", "GPS DU CHANTIER", { keep: 1 })}
        ${h.inp("surface", "EMPRISE / SURFACE")}${h.inp("baseVie", "BASE VIE / DÉPÔT")}${h.ro("DISTANCE AU DÉPÔT", achPrjDist(F))}${h.inp("contact", "CONTACT SUR PLACE")}${h.inp("acces", "ACCÈS ET CONTRAINTES", { w: 1 })}</div>`,
      mar: (F, h) => `<div class="frs-g">${h.sel("cli", "CLIENT / MAÎTRE D'OUVRAGE", achCli().filter(y => !y.del).map(y => [y.id, y.nom]), { req: 1 })}${h.inp("moad", "MAÎTRE D'OUVRAGE DÉLÉGUÉ")}${h.ro("TYPE DE CLIENT", ((achCli().find(c => c.id === F.cli) || {}).type) || "—")}
        ${h.inp("aoNum", "N° D'APPEL D'OFFRES")}${h.inp("dPlis", "DATE D'OUVERTURE DES PLIS", { date: 1 })}${h.chk("cons", "SUR CONSULTATION")}${h.inp("aoObj", "OBJET DU MARCHÉ", { w: 1 })}${h.inp("marche", "N° DU MARCHÉ")}
        ${h.inp("dSign", "DATE DE SIGNATURE", { date: 1 })}${h.inp("dAppr", "DATE D'APPROBATION", { date: 1 })}${h.inp("dNotif", "DATE DE NOTIFICATION", { date: 1 })}
        ${h.inp("mtHt", "MONTANT HT", { num: 1 })}${h.inp("tva", "TVA (%)", { num: 1 })}${h.ro("MONTANT TTC", achF2(achPrjTtc(F)))}${h.ro("MONTANT AVEC AVENANTS (TTC)", achF2(achPrjTtc(F) + (F.avn || []).reduce((t, a) => t + achN(a.mt), 0)))}
        ${h.sel("modePrix", "MODE DE PRIX", ["BORDEREAU DES PRIX", "FORFAIT", "MIXTE"])}${h.sel("revision", "RÉVISION DES PRIX", ON)}${h.inp("avance", "AVANCE (%)", { num: 1 })}${h.inp("penTaux", "PÉNALITÉS DE RETARD (TAUX ‰ / JOUR)", { num: 1 })}${h.inp("penPlaf", "PÉNALITÉS — PLAFOND (%)", { num: 1 })}
        ${h.inp("grpMand", "GROUPEMENT — MANDATAIRE")}${h.inp("grpParts", "GROUPEMENT — PART DE CHACUN")}${h.inp("finance", "SOURCE DE FINANCEMENT")}</div>`,
      lots: (F, h) => h.sub("lots", "UN LOT"), avn: (F, h) => h.sub("avn", "UN AVENANT"), ccli: (F, h) => h.sub("ccli", "UN CONTACT"), interv: (F, h) => h.sub("interv", "UN INTERVENANT"), str: (F, h) => h.sub("str", "UNE SOUS-TRAITANCE"),
      dl: (F, h) => { const bc = !!(F.dOs && achN(F.delaiMois) > 0);
        return `<div class="frs-g">${h.inp("delaiMois", "DÉLAI D'EXÉCUTION (MOIS)", { num: 1 })}${h.inp("dOs", "DATE DE L'OS DE COMMENCEMENT", { date: 1 })}${h.inp("deb", "DATE DE DÉBUT", { date: 1 })}${h.inp("fin", "DATE DE FIN", { date: 1 })}
        ${bc ? h.ro("DATE BUTOIR (OS + DÉLAI + PROLONGATIONS + ARRÊTS)", achDFr(achPrjButoir(F))) : h.inp("butoir", "DATE BUTOIR", { date: 1 })}${h.inp("recProv", "RÉCEPTION PROVISOIRE", { date: 1 })}${h.inp("recDef", "RÉCEPTION DÉFINITIVE", { date: 1 })}${h.inp("garantie", "DÉLAI DE GARANTIE (MOIS)", { num: 1 })}</div>
        <div class="frs-sst">OS D'ARRÊT ET DE REPRISE</div>${h.sub("arrets", "UN OS D'ARRÊT")}`; },
      moy: (F, h) => `<div class="frs-sst">EFFECTIF PRÉVU PAR MÉTIER</div>${h.sub("eff", "UN MÉTIER")}<div class="frs-sst">MATÉRIEL AFFECTÉ</div>${h.sub("mat", "UN ENGIN")}
        <div class="frs-g">${h.inp("horaires", "HORAIRES DE TRAVAIL")}${h.sel("cal", "CALENDRIER DU CHANTIER", ["CALENDRIER DE LA SOCIÉTÉ"])}</div>`,
      reu: (F, h) => `<div class="frs-g">${h.sel("reuJour", "JOUR", ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"])}${h.inp("reuHeure", "HEURE", { keep: 1 })}${h.sel("reuPer", "PÉRIODICITÉ", ["HEBDOMADAIRE", "TOUS LES 15 JOURS", "MENSUELLE"])}${h.inp("reuPart", "PARTICIPANTS", { w: 1 })}</div>`,
      fac: (F, h) => `<div class="frs-g">${h.sel("decPer", "PÉRIODICITÉ DES DÉCOMPTES", ["MENSUELLE", "BIMESTRIELLE", "TRIMESTRIELLE", "À L'AVANCEMENT"])}${h.sel("decMode", "MODE", ["ATTACHEMENTS", "SITUATIONS"])}${h.inp("delaiPay", "DÉLAI DE PAIEMENT CONTRACTUEL (JOURS)", { num: 1 })}
        ${h.sel("interets", "INTÉRÊTS MORATOIRES", ON)}${h.ro("DÉCOMPTE SUIVANT N°", "1")}</div>`,
      gar: (F, h) => `<div class="frs-sst">CAUTIONS</div>${h.sub("cau", "UNE CAUTION")}<div class="frs-g">${h.inp("rgTaux", "RETENUE DE GARANTIE (%)", { num: 1 })}${h.inp("rgPlaf", "PLAFOND (%)", { num: 1 })}${h.inp("rgDate", "DATE DE RESTITUTION", { date: 1 })}</div>
        <div class="frs-sst">ASSURANCES</div>${h.sub("ass", "UNE ASSURANCE")}`,
      cpt: (F, h) => `<div class="frs-g">${h.inp("analyt", "CODE ANALYTIQUE / CENTRE DE COÛT")}${h.sel("devise", "DEVISE", achDevises())}${h.sel("tvaReg", "RÉGIME DE TVA", ["NORMAL", "EXONÉRÉ"])}${h.inp("tvaRef", "RÉFÉRENCE DE L'EXONÉRATION")}${h.sel("banque", "BANQUE DU CHANTIER", achBanques())}</div>`,
      aut: (F, h) => `<div class="frs-g">${h.inp("pcNo", "PERMIS DE CONSTRUIRE — N°")}${h.inp("pcDate", "PERMIS — DATE", { date: 1 })}${h.inp("pcAut", "PERMIS — AUTORITÉ")}
        ${h.inp("odpNo", "OCCUPATION DU DOMAINE PUBLIC — N°")}${h.inp("odpDate", "OCCUPATION — DATE", { date: 1 })}${h.inp("odpEch", "OCCUPATION — ÉCHÉANCE", { date: 1 })}${h.inp("doc", "DÉCLARATION D'OUVERTURE DE CHANTIER", { date: 1 })}</div>
        <div class="frs-sst">BRANCHEMENTS</div>${h.sub("br", "UN BRANCHEMENT")}`,
      sec: (F, h) => `<div class="frs-g">${h.sel("coordSec", "COORDINATEUR SÉCURITÉ", (F.interv || []).filter(x => x.nom).map(x => x.nom))}${h.inp("pss", "PLAN DE SÉCURITÉ REMIS LE", { date: 1 })}${h.inp("panneau", "PANNEAU DE CHANTIER POSÉ LE", { date: 1 })}
        ${h.inp("dechFil", "GESTION DES DÉCHETS — FILIÈRE")}${h.inp("dechPrest", "GESTION DES DÉCHETS — PRESTATAIRE")}</div><div class="frs-sst">ACCIDENTS ET INCIDENTS</div>${h.sub("acc", "UN ACCIDENT OU INCIDENT")}`,
      res: (F, h) => h.sub("res", "UNE RÉSERVE"), recl: (F, h) => h.sub("recl", "UNE RÉCLAMATION") } });
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
    list: { k: "prj", t: "ach_prj", id: "achPrjT", name: "PROJETS", one: "PROJET", stKeys: ["instance", "valide", "bloque", "archive", "annule", "alerte"], stLab: { instance: "EN INSTANCE", valide: "CLÔTURÉS" }, stOf: achPrjStOf, step: achPrjEtat, inst: p => !p.clot && !p.del && !p.arch, dV: p => p.clot || p.cree,
      edit: ACH_ED.prj, all: () => { achPrjSync(); return achPrj(); }, save: achPrjSave, code: p => p.code, nom: p => p.intitule, why: achPrjWhyK,
      newRow: "CRÉER UN PROJET ICI…",
      add: async done => { const code = await achAsk("NOUVEAU PROJET", "CODE PROJET"); if (!code) { done(null); return; } const L = achPrj(); if (L.some(y => !y.del && achU(y.code) === achU(code))) { svToast("CE CODE PROJET EXISTE DÉJÀ.", 3500); done(null); return; }
        const p = achPrjNew(L, { code }); achPrjSave(L); achHist(p.code, "CRÉATION", p.code); done(p.id); achPrjFiche(p.id, () => done(p.id)); },
      w: { ref: 110, intitule: 280, cli: 220, ville: 140, bdg: 90, cree: 110 },
      etat0: "tout", etats: ACH_CP_ETATS, ok: achCpOk,
      cols: () => [["ref", "CODE PROJET", p => p.code, ""], ["intitule", "INTITULÉ", p => p.intitule || "", ""], ["cli", "CLIENT", p => achCliNom(p.cli), ""], ["ville", "VILLE", p => p.ville || "", ""],
        ["bdg", "BUDGETS", p => String(achPrjBdg(p.code).length), "center"]] },
    pageOf: id => { const p = achPrj().find(x => x.id === id); if (!p) return null; const c = achCli().find(x => x.id === p.cli);
      const B = achPrjBdg(p.code), refs = new Set(B.map(b => b.ref)), BS = achBsn().filter(x => !x.del && refs.has(x.bdg)), bsIds = new Set(BS.map(x => x.id)), CM = achCmf().filter(c => !c.del && (c.lignes || []).some(l => bsIds.has(l.bsn)));
      const actK = achCpAct(achPrj, achPrjSave, id, "PROJET", x => x.intitule || x.code);
      return { id, code: p.code, ref: p.code, tag: "PROJET", title: p.intitule || p.code, party: c ? c.nom : "", partyGo: c ? "cli|" + c.id : "", st: achPrjStOf(p), del: !!p.del, why: achPrjWhyK(p),
        info: done => achPrjFiche(id, () => done()),
        menu: [p.del || p.arch ? null : p.clot ? { k: "rouvrir", lab: "ROUVRIR (EN INSTANCE)" } : { k: "clot", lab: "CLÔTURER (ACHEVÉ)" }].concat(achCpMenu(p, "PROJET").filter(m => m.k !== "val")).filter(Boolean),
        act: async (k, redraw) => { const L = achPrj(), x = L.find(y => y.id === id); if (!x) return;
          if (k === "clot") { if (!(await svConfirm({ title: "CLÔTURER LE PROJET", text: x.code + " — " + (x.intitule || "") + " : CHANTIER ACHEVÉ.", ok: "CLÔTURER", tone: "neutral" }))) return; x.clot = achNow(); x.mod = x.clot; achPrjSave(L); achHist(x.code, "CLÔTURÉ", ""); redraw(); return; }
          if (k === "rouvrir") { delete x.clot; x.mod = achNow(); achPrjSave(L); achHist(x.code, "ROUVERT", ""); redraw(); return; }
          return actK(k, redraw); },
        links: [
          { t: "BUDGETS", cols: ACH_BDG_COLS, rows: achBdgRows(B) },
          { t: "DÉCOMPTES / SITUATIONS", cols: [["N°"], ["PÉRIODE"], ["MONTANT TTC", "number"], ["ÉTAT", "center"]], rows: [] },
          { t: "ACHATS DU CHANTIER", cols: [["RÉFÉRENCE"], ["PIÈCE"], ["DÉSIGNATION"], ["MONTANT TTC", "number"]], rows: BS.map(x => ({ cells: [x.ref || "", "BESOIN", x.des || "", achN(x.q) * achN(x.pu)], open: () => achGo("bsn", x.id) }))
            .concat(CM.map(cm => ({ cells: [cm.ref, "COMMANDE", (cm.lignes || []).map(l => l.des).join("; "), achCmfTot(cm).ttc], open: () => achGo("cmf", cm.id), cls: cm.state === "annule" ? "nv-strike" : "" }))) }] }; } });
}
