/* =========================================================
   v672 (BLOC 2) : ENREGISTREMENT DANS LA BASE V3
   - Enregistrement continu sur l'iPad (comme avant) ; envoi à la base quelques secondes après chaque pause.
   - Chaque budget a un numéro de version (REV) ; un envoi parti d'une version dépassée (un autre l'a modifié entre-temps,
     ou l'iPad était HORS LIGNE) est FUSIONNÉ case par case : chaque côté garde ce qu'il a changé ; une même case changée
     des deux côtés = la modification la plus récente gagne (heure de la modification, pas de la reconnexion) ;
     la valeur non retenue va dans les CONFLITS du budget (case, ma valeur, valeur gardée, auteur), traités ligne par ligne.
   - Hors ligne : tout reste sur l'iPad, repère HORS LIGNE + nombre de budgets en attente, envoi au retour de la connexion.
   - Nom d'utilisateur demandé à l'ouverture (sans attendre le chapitre des droits) ; il signe les envois et l'historique.
   - Envoi initial des budgets déjà saisis sur l'iPad, avec contrôle (nombre de lignes relues dans la base).
   - Photo du budget dans les onglets BUDGETS, DESIGNATIONS, TACHES, DETAILS à FIGER et à VALIDER.
   - Verrou : le premier qui ouvre un budget en instance le modifie ; les autres l'ouvrent en lecture seule, avec son nom.
   Côté Google : apps-script/baseV3sync.gs (à installer une fois) ; sans lui, l'application dit BASE NON BRANCHÉE et garde tout.
   ========================================================= */
const SVI_USER_KEY = "svi_user_v1", SVI_SYNC_KEY = "svi_sync_v1";
const sviUser = () => { try { return localStorage.getItem(SVI_USER_KEY) || ""; } catch (e) { return ""; } };
const sviSyncMeta = () => { try { return JSON.parse(localStorage.getItem(SVI_SYNC_KEY) || "{}") || {}; } catch (e) { return {}; } };
const sviSyncMetaSet = m => { try { localStorage.setItem(SVI_SYNC_KEY, JSON.stringify(m)); } catch (e) {} };
const SVI_SYNC = { applying: false, timer: null, busy: false, status: "", err: "", last: 0, locks: {}, cells: null };
const sviSyncBase = ref => sviIdbGet("svi_sync_base:" + ref).catch(() => null);
const sviSyncBaseSet = (ref, s) => sviIdbPut("svi_sync_base:" + ref, s).catch(() => {});

/* liste des budgets de l'iPad modifiée : budgets changés marqués « en attente » */
const sviSyncChanged = (oldStr, newStr) => {
  if (SVI_SYNC.applying) return;
  let A = [], B = [];
  try { A = JSON.parse(oldStr || "[]") || []; B = JSON.parse(newStr || "[]") || []; } catch (e) { return; }
  const mA = new Map(A.map(x => [x.ref, JSON.stringify(x)])), mB = new Map(B.map(x => [x.ref, JSON.stringify(x)]));
  const M = sviSyncMeta(), now = Date.now();
  let ch = false;
  mB.forEach((s, ref) => { if (mA.get(ref) !== s) { const m = M[ref] = M[ref] || {}; m.dirty = m.dirty || now; m.last = now; delete m.del; ch = true; } });
  mA.forEach((s, ref) => { if (!mB.has(ref)) { const m = M[ref] = M[ref] || {}; m.del = true; m.dirty = now; m.last = now; ch = true; } });
  if (!ch) return;
  sviSyncMetaSet(M);
  sviSyncSchedule(4000);
};
const sviSyncPending = () => { const M = sviSyncMeta(); return Object.keys(M).filter(r => M[r].dirty).length; };
const sviSyncSchedule = ms => { clearTimeout(SVI_SYNC.timer); SVI_SYNC.timer = setTimeout(() => sviSyncRun(), ms); sviSyncPaint(); };

/* ---------- fusion case par case (base commune, ma version, version de la base) ---------- */
const sviSyncJ = v => JSON.stringify(v === undefined ? null : v);
const SVI_SYNC_LAB = { des: "DÉSIGNATIONS CLIENT", lot: "LOTS", prim: "ACTIVITÉS PRIMAIRES", sec: "ACTIVITÉS SECONDAIRES", chg: "DÉTAIL CHARGES", prd: "DÉTAIL PRODUITS", qlt: "DÉTAIL QUALITÉ", links: "LIAISONS" };
const sviSyncRowLab = r => r ? String(r.des || r.v || r.art || r.id || "") : "";
const sviMergeData = (b, m, t, mineNewer, who, when) => {
  b = b || {}; m = m || {}; t = t || {};
  const out = {}, conf = [];
  const keys = new Set([...Object.keys(m), ...Object.keys(t)]);
  keys.forEach(k => {
    if (k === "conf") return;
    const bv = b[k], mv = m[k], tv = t[k];
    if (sviSyncJ(mv) === sviSyncJ(tv)) { out[k] = mv; return; }
    if (sviSyncJ(mv) === sviSyncJ(bv)) { out[k] = tv; return; }
    if (sviSyncJ(tv) === sviSyncJ(bv)) { out[k] = mv; return; }
    /* tableaux de lignes à identifiant : ligne par ligne, puis case par case */
    if (Array.isArray(mv) && Array.isArray(tv) && [...mv, ...tv].every(r => r && typeof r === "object" && r.id)) {
      const BM = new Map((Array.isArray(bv) ? bv : []).map(r => [r.id, r])), TM = new Map(tv.map(r => [r.id, r])), MM = new Map(mv.map(r => [r.id, r]));
      const res = [];
      const one = (id) => {
        const br = BM.get(id), mr = MM.get(id), tr = TM.get(id);
        if (mr && tr) {
          const r = {};
          new Set([...Object.keys(mr), ...Object.keys(tr)]).forEach(f => {
            const a = mr[f], c = tr[f], o = br ? br[f] : undefined;
            if (sviSyncJ(a) === sviSyncJ(c) || sviSyncJ(c) === sviSyncJ(o)) { if (a !== undefined) r[f] = a; return; }
            if (sviSyncJ(a) === sviSyncJ(o)) { if (c !== undefined) r[f] = c; return; }
            const win = mineNewer ? a : c, lose = mineNewer ? c : a;
            if (win !== undefined) r[f] = win;
            conf.push({ id: "c" + Date.now().toString(36) + conf.length, k, rid: id, f, lab: (SVI_SYNC_LAB[k] || k) + " › " + sviSyncRowLab(mr) + " › " + String(f).toUpperCase(), mine: a, kept: win, lost: lose, user: who, ts: when, me: !mineNewer });
          });
          return r;
        }
        if (mr && !tr) return br && sviSyncJ(br) === sviSyncJ(mr) ? null : mr;   /* supprimée là-bas, inchangée ici : supprimée */
        if (tr && !mr) return br && sviSyncJ(br) === sviSyncJ(tr) ? null : tr;
        return null;
      };
      const seen = new Set();
      mv.forEach(r => { seen.add(r.id); const x = one(r.id); if (x) res.push(x); });
      tv.forEach(r => { if (seen.has(r.id)) return; const x = one(r.id); if (x) res.push(x); });
      out[k] = res; return;
    }
    /* objets (délais, liaisons du planning, réglages…) : clé par clé */
    if (mv && tv && typeof mv === "object" && typeof tv === "object" && !Array.isArray(mv) && !Array.isArray(tv)) {
      const r = {};
      new Set([...Object.keys(mv), ...Object.keys(tv)]).forEach(f => {
        const a = mv[f], c = tv[f], o = bv && typeof bv === "object" ? bv[f] : undefined;
        if (sviSyncJ(a) === sviSyncJ(c) || sviSyncJ(c) === sviSyncJ(o)) { if (a !== undefined) r[f] = a; return; }
        if (sviSyncJ(a) === sviSyncJ(o)) { if (c !== undefined) r[f] = c; return; }
        const win = mineNewer ? a : c;
        if (win !== undefined) r[f] = win;
        conf.push({ id: "c" + Date.now().toString(36) + conf.length, k, sub: f, lab: k.toUpperCase() + " › " + f, mine: a, kept: win, lost: mineNewer ? c : a, user: who, ts: when, me: !mineNewer });
      });
      out[k] = r; return;
    }
    out[k] = mineNewer ? mv : tv;
    conf.push({ id: "c" + Date.now().toString(36) + conf.length, k, lab: (SVI_SYNC_LAB[k] || k).toUpperCase(), mine: mv, kept: mineNewer ? mv : tv, lost: mineNewer ? tv : mv, user: who, ts: when, me: !mineNewer });
  });
  /* conflits : ceux des deux côtés, plus les nouveaux (seuls ceux où MA valeur n'a pas été gardée sont à traiter) */
  const old = [...(m.conf || []), ...(t.conf || [])].filter((c, i, a) => a.findIndex(x => x.id === c.id) === i);
  out.conf = old.concat(conf.filter(c => c.me));
  return out;
};
const sviMergeItem = (b, m, t, mineNewer, who, when) => {
  const out = { ...t, ...m };
  ["intitule", "client", "project", "state", "created", "validated", "mode"].forEach(f => {
    const a = m[f], c = t[f], o = b ? b[f] : undefined;
    out[f] = sviSyncJ(a) === sviSyncJ(o) ? c : sviSyncJ(c) === sviSyncJ(o) ? a : (mineNewer ? a : c);
  });
  out.data = sviMergeData(b && b.data, m.data, t.data, mineNewer, who, when);
  return out;
};

/* ---------- photo (onglets BUDGETS, DESIGNATIONS, TACHES, DETAILS) ---------- */
const sviSyncPhoto = it => {
  const d = it.data || {}, U = v => String(v ?? "").trim();
  const nm = (k, id) => U(((d[k] || []).find(x => x.id === id) || {}).v);
  const des = (d.des || []).map((r, i) => ({ _k: r.id, ART: U(r.art), DESIGNATION: U(r.des), UNITE: U(r.u), TITRE: r.t ? "OUI" : "", ORDRE: i + 1, QTE: r.q ?? "", PRIX: r.p ?? "", TVA: r.tva ?? "" }));
  const per = k => { const L = ((d.dlp || {})[k] || []).filter(p => p.deb); return L.length ? [L.map(p => p.deb).sort()[0], L.map(p => p.fin || p.deb).sort().pop()] : ["", ""]; };
  const taches = (d.links || []).map((l, i) => { const [deb, fin] = per(l.lot + "|" + l.sec), P = ((d.dpred || {})[l.lot + "|" + l.sec] || []);
    return { _k: l.id, _d: l.des, LOT: nm("lot", l.lot), ACT_PRIMAIRE: nm("prim", l.prim), ACT_SECONDAIRE: nm("sec", l.sec), DEBUT: deb, FIN: fin, ORDRE: i + 1,
      PREDECESSEURS: P.map(x => { const [lo, se] = String(x.k || x).split("|"); return nm("lot", lo) + " › " + nm("sec", se); }).join(" ; "), TYPE: P.map(x => x.t || "FD").join(" ; "), DECALAGE: P.map(x => x.o || 0).join(" ; ") }; });
  const details = [];
  (d.links || []).forEach(l => {
    (l.prd || []).forEach((x, i) => { const r = (d.prd || []).find(y => y.id === x.id); if (r) details.push({ _t: l.id, TYPE: "PRD", ARTICLE: "", DESIGNATION: U(r.des), UNITE: U(r.u), NBR: r.nbr ?? "", DIM1: r.d1 ?? "", DIM2: r.d2 ?? "", DIM3: r.d3 ?? "", QTE: x.q !== "" && x.q !== undefined ? x.q : (r.q ?? ""), PRIX: "", CLE: "", ORDRE: i + 1 }); });
    (l.chg || []).forEach((x, i) => { const r = (d.chg || []).find(y => y.id === x.id); if (r) details.push({ _t: l.id, TYPE: "CHG", ARTICLE: U(r.art), DESIGNATION: U(r.des), UNITE: U(r.u), QTE: x.q !== "" && x.q !== undefined ? x.q : (r.q ?? ""), PRIX: r.p ?? "", CLE: "", ORDRE: i + 1 }); });
  });
  const ET = { instance: "INSTANCE", fige: "FIGE", valide: "VALIDE" }[it.state || "instance"];
  return apiPost("v3Photo", { ref: it.ref, budget: { REF: it.ref, PROJET: U(it.project), INTITULE: U(it.intitule), ETAT: ET, CREE_LE: U(it.created), FIGE_LE: it.state === "fige" ? new Date().toISOString().slice(0, 10) : "", VALIDE_LE: U(it.validated), VERSION: (sviSyncMeta()[it.ref] || {}).rev || "", DATE_BUTOIR: U(d.dbut), DATE_OBJECTIF: U(d.dobj) }, des, taches, details });
};

/* ---------- envoi ---------- */
const sviSyncPushOne = async (ref, M) => {
  const m = M[ref] || {}, user = sviUser();
  if (m.del) { await apiPost("v3Del", { ref }); delete M[ref]; return; }
  let it = sviInstGet().find(x => x.ref === ref);
  if (!it) { delete M[ref]; return; }
  for (let tour = 0; tour < 3; tour++) {
    const txt = JSON.stringify(it);
    const r = await apiPost("v3Push", { ref, projet: it.project || "", etat: it.state || "instance", baseRev: m.rev || 0, user, ts: m.last || Date.now(), data: txt });
    if (r.conflict) {
      let theirs = null; try { theirs = JSON.parse(r.data); } catch (e) {}
      if (!theirs) throw new Error("BUDGET ILLISIBLE DANS LA BASE");
      let base = null; try { const bs = await sviSyncBase(ref); base = bs ? JSON.parse(bs) : null; } catch (e) {}
      const merged = sviMergeItem(base, it, theirs, (m.last || 0) >= (r.ts || 0), r.user || "", r.ts || 0);
      SVI_SYNC.applying = true;
      try { sviInstSet(sviInstGet().map(x => x.ref === ref ? merged : x)); } finally { SVI_SYNC.applying = false; }
      m.rev = r.rev; it = merged;
      const nc = ((merged.data || {}).conf || []).length;
      if (nc && typeof svToast === "function") svToast(ref + " : MODIFIÉ AUSSI PAR " + (r.user || "UN AUTRE") + " — FUSIONNÉ ; " + nc + " CONFLIT(S) À VOIR (⚠).", 6000);
      window.__sviSyncReopen && window.__sviSyncReopen(ref);
      continue;
    }
    m.rev = r.rev; m.dirty = 0; m.at = Date.now();
    await sviSyncBaseSet(ref, txt);
    /* contrôle de l'envoi : lignes relues dans la base */
    const d = it.data || {}, bad = r.ctl && !r.ctl.err ? ["des", "lot", "prim", "sec", "chg", "prd", "links"].filter(x => (r.ctl[x] || 0) !== (d[x] || []).length) : (r.ctl && r.ctl.err ? ["RELECTURE"] : []);
    if (bad.length && typeof svToast === "function") svToast(ref + " : CONTRÔLE DE L'ENVOI EN ÉCHEC (" + bad.join(", ") + ") — IL SERA RENVOYÉ.", 6000);
    if (bad.length) m.dirty = Date.now();
    if ((it.state === "fige" || it.state === "valide") && m.pst !== it.state) { try { await sviSyncPhoto(it); m.pst = it.state; } catch (e) {} }
    if (it.state === "instance") m.pst = "";
    return;
  }
};
const sviSyncRun = async () => {
  if (SVI_SYNC.busy) { sviSyncSchedule(3000); return; }
  if (typeof apiPost !== "function" || !document.getElementById("sviTestTag")) return;   /* version test seulement */
  SVI_SYNC.busy = true; sviSyncPaint();
  const M = sviSyncMeta();
  try {
    if (!navigator.onLine) throw new Error("HORS LIGNE");
    for (const ref of Object.keys(M).filter(r => M[r].dirty)) { await sviSyncPushOne(ref, M); sviSyncMetaSet(M); }
    SVI_SYNC.status = "ok"; SVI_SYNC.err = ""; SVI_SYNC.last = Date.now();
  } catch (e) {
    const msg = String(e && e.message || e);
    SVI_SYNC.status = !navigator.onLine || /fetch|network|HORS LIGNE|Load failed/i.test(msg) ? "off" : /INCONNU|UNKNOWN|ACTION|v3Push/i.test(msg) ? "nob" : "err";
    SVI_SYNC.err = msg;
    sviSyncMetaSet(M);
    clearTimeout(SVI_SYNC.timer); SVI_SYNC.timer = setTimeout(sviSyncRun, 30000);
  } finally { SVI_SYNC.busy = false; sviSyncPaint(); }
};

/* ---------- réception : budgets modifiés ailleurs, verrous ---------- */
const sviSyncPull = async () => {
  if (typeof apiPost !== "function" || !document.getElementById("sviTestTag") || !navigator.onLine) return;
  let L;
  try { L = await apiPost("v3List", {}); } catch (e) { SVI_SYNC.status = /fetch|network|Load failed/i.test(String(e && e.message || e)) ? "off" : "nob"; SVI_SYNC.err = String(e && e.message || e); sviSyncPaint(); return; }
  const me = sviUser(), M = sviSyncMeta();
  SVI_SYNC.locks = {}; (L.locks || []).forEach(k => { if (k.user !== me) SVI_SYNC.locks[k.ref] = k; });
  let changed = false, first = 0;
  for (const s of L.list || []) {
    const m = M[s.ref] = M[s.ref] || {};
    if (s.rev <= (m.rev || 0) || m.dirty) continue;
    const p = await apiPost("v3Pull", { ref: s.ref }).catch(() => null);
    if (!p || p.missing) continue;
    let it = null; try { it = JSON.parse(p.data); } catch (e) {}
    if (!it) continue;
    SVI_SYNC.applying = true;
    try { const list = sviInstGet(); const i = list.findIndex(x => x.ref === s.ref); if (i >= 0) list[i] = it; else list.push(it); sviInstSet(list); } finally { SVI_SYNC.applying = false; }
    m.rev = p.rev; m.at = Date.now(); await sviSyncBaseSet(s.ref, p.data); changed = true;
    if (window.__sviOpenRef === s.ref) { window.__sviSyncReopen && window.__sviSyncReopen(s.ref); if (typeof svToast === "function") svToast(s.ref + " : CHANGEMENTS DE " + (p.user || "UN AUTRE") + " REÇUS.", 4000); }
  }
  /* envoi initial : budgets de l'iPad absents de la base */
  const onSrv = new Set((L.list || []).map(x => x.ref));
  sviInstGet().forEach(x => { if (!onSrv.has(x.ref) && !(M[x.ref] || {}).rev) { const m = M[x.ref] = M[x.ref] || {}; if (!m.dirty) { m.dirty = Date.now(); m.last = m.last || Date.now(); first++; } } });
  sviSyncMetaSet(M);
  SVI_SYNC.status = SVI_SYNC.status === "nob" ? "ok" : SVI_SYNC.status || "ok";
  if (first && typeof svToast === "function") svToast("ENVOI INITIAL DANS LA BASE : " + first + " BUDGET(S) DE L'IPAD, AVEC CONTRÔLE.", 4000);
  if (first || sviSyncPending()) sviSyncSchedule(1500);
  if (changed && !window.__sviOpenRef && typeof renderBudgetList === "function") { try { renderBudgetList(); } catch (e) {} }
  sviSyncPaint();
};
/* verrou du budget ouvert (gardé tant qu'il est ouvert) */
const sviLockOther = ref => { const k = SVI_SYNC.locks[ref]; return k && Date.now() - k.ts < 3 * 60 * 1000 ? k : null; };
const sviLockKeep = () => { const r = window.__sviOpenRef; if (r && window.__sviOpenEdit && navigator.onLine) apiPost("v3Lock", { ref: r, user: sviUser(), onglet: window.__sviOpenTab || "" }).catch(() => {}); };
const sviLockOpen = (ref, edit) => { window.__sviOpenRef = ref; window.__sviOpenEdit = !!edit; sviLockKeep(); };
const sviLockClose = () => { const r = window.__sviOpenRef; if (r && window.__sviOpenEdit) apiPost("v3Unlock", { ref: r, user: sviUser() }).catch(() => {}); window.__sviOpenRef = null; window.__sviOpenEdit = false; };

/* ---------- repère et fenêtre BASE ---------- */
const sviSyncPaint = () => {
  if (!document.body) return;
  const tag = document.getElementById("sviTestTag"); if (!tag) return;
  let b = document.getElementById("sviSync");
  if (!b) { b = document.createElement("button"); b.type = "button"; b.id = "sviSync"; b.addEventListener("click", sviSyncWin); document.body.appendChild(b); }
  const n = sviSyncPending(), st = SVI_SYNC.status;
  const t = SVI_SYNC.busy ? "ENVOI À LA BASE…" : st === "off" ? "HORS LIGNE" + (n ? " — " + n + " EN ATTENTE" : "") : st === "nob" ? "BASE NON BRANCHÉE" + (n ? " — " + n + " EN ATTENTE" : "") : st === "err" ? "ENVOI EN ÉCHEC — " + n + " EN ATTENTE" : n ? n + " EN ATTENTE" : st === "ok" ? "BASE À JOUR" : "BASE…";
  b.textContent = t;
  b.className = SVI_SYNC.busy ? "sync-busy" : st === "off" || st === "nob" || st === "err" ? "sync-off" : n ? "sync-wait" : "sync-ok";
};
function sviSyncWin() {
  const d = sviWinNew(), M = sviSyncMeta(), L = sviInstGet();
  const fdt = t => t ? new Date(t).toLocaleString("fr-FR").toUpperCase() : "—";
  d.innerHTML = sviWinCard({ cls: "pv-card", close: "data-x", title: "ENREGISTREMENT DANS LA BASE V3",
    body: `<label class="pv-r"><span>NOM D'UTILISATEUR</span><input class="pv-in sy-user" value="${esc(sviUser())}" style="width:200px;text-align:left"></label>
      <div class="pv-sub">${SVI_SYNC.status === "nob" ? "LA BASE NE CONNAÎT PAS ENCORE L'ENREGISTREMENT : INSTALLER LE FICHIER baseV3sync.gs DANS APPS SCRIPT (VOIR SON EN-TÊTE). EN ATTENDANT, TOUT RESTE SUR L'IPAD." : SVI_SYNC.status === "off" ? "HORS LIGNE : TOUT RESTE SUR L'IPAD ET PARTIRA AU RETOUR DE LA CONNEXION." : SVI_SYNC.err ? esc(SVI_SYNC.err) : "DERNIER ENVOI : " + fdt(SVI_SYNC.last)}</div>
      <div class="fz-blk">BUDGETS DE L'IPAD ${svCnt(L.length)}</div>
      <table class="pv-t"><thead><tr><th>BUDGET</th><th>VERSION</th><th>ÉTAT</th><th>ENVOYÉ LE</th></tr></thead><tbody>${L.map(x => { const m = M[x.ref] || {}, lk = sviLockOther(x.ref); return `<tr><td>${esc((x.project || "") + " " + x.ref)}</td><td class="number">${m.rev || "—"}</td><td>${m.dirty ? "EN ATTENTE" : m.rev ? "À JOUR" : "JAMAIS ENVOYÉ"}${lk ? " · OUVERT PAR " + esc(lk.user) : ""}${((x.data || {}).conf || []).length ? " · " + x.data.conf.length + " CONFLIT(S)" : ""}</td><td>${fdt(m.at)}</td></tr>`; }).join("")}</tbody></table>
      <div class="pv-sub sy-cells"></div>`,
    foot: `<button type="button" class="svc-b" data-x>FERMER</button><button type="button" class="svc-b svc-ok svc-neutral" data-go>ENVOYER MAINTENANT</button>` });
  sviWinShow(d);
  if (navigator.onLine) apiPost("v3Stats", {}).then(s => { const e = d.querySelector(".sy-cells"); if (e && s && s.cells) e.textContent = "TAILLE DU FICHIER : " + s.cells.toLocaleString("fr-FR") + " CELLULES SUR 10 000 000 (" + Math.round(s.cells / s.limit * 1000) / 10 + " %)" + (s.cells > 8e6 ? " — ATTENTION, PROCHE DE LA LIMITE DE GOOGLE SHEETS." : "."); }).catch(() => {});
  d.addEventListener("click", e => {
    if (e.target === d || e.target.closest("[data-x]")) { const v = d.querySelector(".sy-user").value.trim().toUpperCase(); if (v) try { localStorage.setItem(SVI_USER_KEY, v); } catch (er) {} d.remove(); return; }
    if (e.target.closest("[data-go]")) { const v = d.querySelector(".sy-user").value.trim().toUpperCase(); if (v) try { localStorage.setItem(SVI_USER_KEY, v); } catch (er) {} d.remove(); sviSyncPull().then(() => sviSyncRun()); }
  });
}
/* nom d'utilisateur demandé à l'ouverture de l'application */
const sviUserAsk = () => {
  if (sviUser() || !document.getElementById("sviTestTag")) return;
  const d = sviWinNew();
  d.innerHTML = sviWinCard({ title: "NOM D'UTILISATEUR", close: "", body: `<div class="pv-sub">IL SIGNE VOS MODIFICATIONS (HISTORIQUE, BASE V3, VERROUS).</div><input class="pv-in sy-user" style="width:100%;text-align:left" placeholder="EX. AHMED" autocomplete="off">`,
    foot: `<button type="button" class="svc-b svc-ok svc-neutral" data-ok>ENREGISTRER</button>` });
  sviWinShow(d);
  const i = d.querySelector(".sy-user"); setTimeout(() => i.focus(), 60);
  const ok = () => { const v = i.value.trim().toUpperCase(); if (!v) { i.classList.add("bad"); return; } try { localStorage.setItem(SVI_USER_KEY, v); } catch (e) {} d.remove(); sviSyncPull(); };
  d.addEventListener("click", e => { if (e.target.closest("[data-ok]")) ok(); });
  i.addEventListener("keydown", e => { if (e.key === "Enter") ok(); });
};
if (typeof window !== "undefined" && !window.__sviSyncBoot) {
  window.__sviSyncBoot = true;
  SVI_INST_READY.then(() => setTimeout(() => { sviSyncPaint(); sviUserAsk(); if (sviUser()) sviSyncPull(); }, 1200));
  window.addEventListener("online", () => { sviSyncPull().then(() => sviSyncRun()); });
  window.addEventListener("offline", () => { SVI_SYNC.status = "off"; sviSyncPaint(); });
  setInterval(() => { if (document.visibilityState === "visible") { sviLockKeep(); if (!sviSyncPending()) sviSyncPull(); } }, 60000);
  document.addEventListener("visibilitychange", () => { if (document.hidden && sviSyncPending()) sviSyncRun(); });
}
