"""Audit du format (point 3 du 07/11) : pour chaque interface et chaque élément réglable, pose un réglage d'essai
(fond, couleur, taille) et vérifie que TOUTES les cases visibles de ce genre le prennent.
Lancer depuis v2-test :  python3 tests/audit_format.py"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_app import serve, PORT, BUDGET
from playwright.sync_api import sync_playwright

JS_AUDIT = r"""async (o) => {
  const w = ms => new Promise(z => setTimeout(z, ms));
  const V = { bg: 'rgb(10, 11, 12)', c: 'rgb(13, 14, 15)', fs: '19px' };
  const LOOK = {
    top: '.novapp-list-titlebar, .section-head, .bdg-d-sticky .novapp-list-titlebar',
    blk: '.bdg-d-block-title, .blk-head',
    tabs: '.rec-tabs, .bdg-d-tabs:not(.pg-grps):not(.pg-tabs)',
    tab: '.rec-tab:not(.on):not(.active), .bdg-d-tab:not(.active):not(.on):not(.prm-grp):not(.prm-tab)',
    taba: '.rec-tab.on, .rec-tab.active, .bdg-d-tab.active:not(.prm-grp):not(.prm-tab), .bdg-d-tab.on:not(.prm-grp):not(.prm-tab)',
    th: 'thead th',
    ttl: 'tr.ins-title > td, tr.ins-gtitle > td',
    row: 'tbody tr > td',
    new: 'tbody tr > td',
    tot: 'tfoot td, tr.bdg-d-total-row td',
    tabm: '.pg-grps .prm-grp:not(.on)', tabsub: '.pg-tabs > .prm-tab',
    win: '#svConf .svc-card > .svc-t, #docPop .doc-head', winbg: '#svConf .svc-card, #docPop .doc-card', winlab: '#svConf .frs-f > span, #docPop .doc-lab',
    winin: '#svConf input:not([type=checkbox]):not([type=radio]):not([type=color]):not([readonly]):not(:disabled), #svConf select:not(:disabled), #svConf textarea, #docPop .doc-in:not(.doc-ro):not([readonly])',
    wincan: '#svConf .svc-f .svc-b:not(.svc-ok), #docPop .doc-foot .doc-btn:not(.doc-save):not(.ok)', wsec: '#svConf .frs-st, #docPop .doc-sec-t', wtab: '#svConf .rec-tabs .rec-tab, #docPop .rec-tabs .rec-tab', wtbl: '#svConf table thead th, #docPop table thead th', walrt: '#svConf .frs-why, #docPop .doc-why',
    wro: '#svConf input[readonly], #svConf input:disabled, #svConf select:disabled, #docPop .doc-ro, #docPop .doc-in[readonly]', wx: '#svConf .svc-close, #docPop .doc-x', winok: '#svConf .svc-f .svc-b.svc-ok, #docPop .doc-foot .doc-btn.doc-save, #docPop .doc-foot .doc-btn.ok',
    grid: 'tbody td' };
  const vis = e => { if (!o.win && e.closest('#svConf, #docPop')) return false; if (e.closest('#navMenu, .hidden, [hidden]')) return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const isNew = td => /ICI…|ICI\.\.\./.test(td.closest('tr').textContent) || td.closest('tr.ins-new, tr.rec-new, tr.scn-new, tr.dly-new, tr.bdg-newrow, tr[data-nvnew], tr[data-nvradd], tr.ach-new');
  const isTot = td => td.closest('tfoot, tr.bdg-d-total-row') || /^\s*TOTAL/.test(td.closest('tr').textContent);
  const isTtl = td => td.closest('tr.ins-title, tr.ins-gtitle, .dly-grp');
  const pick = (k, root) => [...root.querySelectorAll(LOOK[k])].filter(vis).filter(e => {
    if (k === 'row') return !isNew(e) && !isTot(e) && !isTtl(e) && !e.closest('tr.nvp-gt');
    if (k === 'new') return !!isNew(e);
    if (k === 'grid') return !isNew(e);
    return true; });
  const path = e => { const p = []; let x = e; for (let i = 0; i < 4 && x && x !== document.body; i++, x = x.parentElement) p.unshift(x.tagName.toLowerCase() + (x.id ? '#' + x.id : '') + (x.className && typeof x.className === 'string' ? '.' + x.className.trim().split(/\s+/).slice(0, 3).join('.') : '')); return p.join(' > '); };
  const F0 = localStorage.getItem('svi_format_v1'), out = {};
  for (const k of o.els) {
    const E = SVI_FMT_EL.find(x => x.k === k); if (!E) continue;
    const set = E.bd ? { c: '#0d0e0f' } : (E.f ? Object.fromEntries(Object.entries({ bg: '#0a0b0c', c: '#0d0e0f', fs: 19 }).filter(([f]) => E.f.includes(f))) : { bg: '#0a0b0c', c: '#0d0e0f', fs: 19 });
    localStorage.setItem('svi_format_v1', JSON.stringify({ el: {}, by: { [o.ifk]: { el: { [k]: set } } } })); sviFmtApply(); await w(30);
    const L = pick(k, document.querySelector(o.root) || document.body); if (!L.length) { out[k] = 'absent'; continue; }
    const bad = [];
    L.forEach(e => { const cs = getComputedStyle(e), m = [];
      if (E.bd) { if (cs.borderTopColor !== V.c && cs.borderBottomColor !== V.c && cs.borderLeftColor !== V.c) m.push('trait ' + cs.borderTopColor); }
      else { if (set.bg && cs.backgroundColor !== V.bg) m.push('fond ' + cs.backgroundColor); if (set.c && cs.color !== V.c) m.push('couleur ' + cs.color); if (set.fs && cs.fontSize !== V.fs) m.push('taille ' + cs.fontSize);
        if (k === 'row' || k === 'ttl' || k === 'new' || k === 'tot') e.querySelectorAll('input:not([type=checkbox]):not([type=radio]), select, .ach-link, .nv-reflink').forEach(tx => { const ct = getComputedStyle(tx); if (set.c && ct.color !== V.c && !tx.matches('.ach-link, .nv-reflink') && !tx.closest('tr.lk-link, tr.lk-sel, tr.ins-unl')) m.push('dans la case ' + tx.tagName.toLowerCase() + '.' + String(tx.className).split(' ')[0] + ' couleur ' + ct.color); if (set.fs && ct.fontSize !== V.fs) m.push('dans la case ' + tx.tagName.toLowerCase() + '.' + String(tx.className).split(' ')[0] + ' taille ' + ct.fontSize); });
        if (E.tsel) E.tsel.forEach(t => e.querySelectorAll(t).forEach(tx => { const ct = getComputedStyle(tx); if (set.c && ct.color !== V.c) m.push('texte ' + t + ' couleur ' + ct.color); if (set.fs && ct.fontSize !== V.fs) m.push('texte ' + t + ' taille ' + ct.fontSize); })); }
      if (m.length) bad.push(path(e) + ' : ' + [...new Set(m)].join(', ')); });
    out[k] = bad.length ? { n: L.length, ko: bad.length, ex: [...new Set(bad)].slice(0, 4) } : 'ok ' + L.length; }
  if (F0 === null) localStorage.removeItem('svi_format_v1'); else localStorage.setItem('svi_format_v1', F0); sviFmtApply();
  out.__if = document.documentElement.dataset.svif; return out; }"""

LIST_EL = ["top", "th", "row", "new", "tot", "grid"]
WIN_EL = ["win", "winbg", "winlab", "winin", "wincan", "wsec", "wtab", "wtbl", "walrt", "wro", "wx", "winok"]
FICHE_EL = ["top", "blk", "tabs", "tab", "taba", "th", "ttl", "row", "new", "tot", "grid"]

SEED = r"""async () => { await sviAchLoad(); const now = new Date().toISOString();
  achArtsSave([{ id: 'A1', des: 'CIMENT', u: 'T', st: 'valide', cree: now }]);
  achFrsSave([{ id: 'F1', code: 'FRS 1', nom: 'ALPHA', ice: '', actif: true, st: 'valide', cree: now, cte: [] }]);
  achBsnSave([{ id: 'B1', ref: 'BSN 1', centre: 'SIÈGE', des: 'CIMENT', u: 'T', q: 5, pu: 100, state: 'instance', cree: now }]);
  achCafSave([{ id: 'C1', ref: 'CFA 1', state: 'ouverte', cree: now, frs: ['F1'], rep: { F1: { st: 'attente' } }, grp: [{ id: 'G', lab: 'LOT 1' }], lignes: [{ id: 'l1', des: 'CIMENT', u: 'T', q: 5, g: 'G' }, { id: 'l2', des: 'SABLE', u: 'M3', q: 2, pu: 50, libre: true }], lf: { l1: ['F1'], l2: ['F1'] }, ld: {}, lc: {}, fd: {}, fc: {} }]);
  achDvfSave([{ id: 'V1', ref: 'DVF 1', caf: 'C1', frs: 'F1', state: 'recu', cree: now, lignes: [{ des: 'CIMENT', u: 'T', q: 5, pu: 900, tva: 20 }] }]);
  achCmfSave([{ id: 'M1', ref: 'CMF 1', frs: 'F1', state: 'instance', cree: now, lignes: [{ id: 'm1', des: 'CIMENT', u: 'T', q: 5, pu: 900, tva: 20 }] }]);
  achFafSave([{ id: 'FA1', ref: 'FAF 1', frs: 'F1', state: 'instance', type: 'normale', cree: now, lignes: [{ des: 'CIMENT', u: 'T', q: 5, pu: 900, tva: 20 }] }]);
  achPafSave([{ id: 'P1', ref: 'PAF 1', frs: 'F1', state: 'instance', type: 'reglement', mode: 'VIREMENT', mt: 100, cree: now, aff: [], ded: [] }]);
  return true; }"""
IDS = {"caf": "C1", "dvf": "V1", "cmf": "M1", "faf": "FA1", "paf": "P1", "bsn": "B1", "frs": "F1", "art": "A1", "rcp": None}

def main():
    srv = serve()
    res = {}
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1180, "height": 820})
        ctx.add_init_script("try { localStorage.setItem('svitest:svi_user_v1', 'TESTEUR'); localStorage.setItem('svitest:svi_tva_def_v1', '20'); } catch (e) {}")
        pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.route("https://script.google.com/**", lambda r: r.abort())
        url = f"http://127.0.0.1:{PORT}/index.html"; pg.goto(url); pg.wait_for_timeout(1500)
        pg.evaluate("""b => { sviInstSet([b]); return sviInstFlush(); }""", BUDGET)
        pg.evaluate("""() => { localStorage.setItem('svi_listmode_v1', 'inst'); localStorage.removeItem('svi_lastbdg_v1'); }""")
        pg.goto(url); pg.wait_for_timeout(1200)
        pg.evaluate("""() => document.querySelector('.nav-btn[data-view="bdg"]')?.click()"""); pg.wait_for_timeout(1000)
        pg.evaluate("""async () => { await SVI_INST_READY; bdgRows = []; bdgLoaded = true; document.querySelectorAll('[data-cancel], .svc-close').forEach(x => { try { x.click(); } catch (e) {} }); renderBudgetList(); }"""); pg.wait_for_timeout(800)
        res["bdgl"] = pg.evaluate(JS_AUDIT, {"ifk": "bdgl", "els": LIST_EL, "root": "#bdg"})
        pg.evaluate("""() => { localStorage.setItem('svi_lastbdg_v1', 'TEST-1'); }"""); pg.goto(url); pg.wait_for_timeout(1500)
        pg.evaluate("""() => document.querySelector('.nav-btn[data-view="bdg"]')?.click()"""); pg.wait_for_timeout(2000)
        res["bdg"] = pg.evaluate(JS_AUDIT, {"ifk": "bdg", "els": FICHE_EL, "root": "#bdg"})
        pg.evaluate("""() => { const b = document.querySelector('#bdg [data-pill="inf"]'); if (b) b.click(); }"""); pg.wait_for_timeout(700)
        res["bdg_w"] = pg.evaluate(JS_AUDIT, {"ifk": "bdg_w", "els": WIN_EL, "root": "body", "win": 1})
        pg.evaluate("""() => document.querySelectorAll('#svConf [data-x], #svConf .svc-close').forEach(x => x.click())"""); pg.wait_for_timeout(300)
        pg.evaluate(SEED)
        for t, i in IDS.items():
            pg.evaluate("""t => document.querySelector(`.nav-btn[data-view="ach"][data-ach="${t}"]`)?.click() || (document.querySelector('.nav-btn[data-view="ach"]').click(), setTimeout(() => document.querySelector(`#ach [data-ach="${t}"]`)?.click(), 300))""", t)
            pg.wait_for_timeout(900)
            res[t + "_l"] = pg.evaluate(JS_AUDIT, {"ifk": t + "_l", "els": LIST_EL, "root": "#ach"})
            if i:
                pg.evaluate("""([t, i]) => achGo(t, i)""", [t, i]); pg.wait_for_timeout(900)
                res[t + "_f"] = pg.evaluate(JS_AUDIT, {"ifk": t + "_f", "els": FICHE_EL, "root": "#ach"})
                pg.evaluate("""() => document.querySelector('#ach [data-nvp="info"]')?.click()"""); pg.wait_for_timeout(700)
                res[t + "_w"] = pg.evaluate(JS_AUDIT, {"ifk": t + "_w", "els": WIN_EL, "root": "body", "win": 1})
                pg.evaluate("""() => document.querySelectorAll('#svConf [data-x], #svConf .svc-close').forEach(x => x.click())"""); pg.wait_for_timeout(300)
        pg.evaluate("""() => document.querySelector('.nav-btn[data-view="chs"]')?.click()"""); pg.wait_for_timeout(900)
        res["prm"] = pg.evaluate(JS_AUDIT, {"ifk": "prm", "els": FICHE_EL + ["tabm", "tabsub"], "root": "#chs"})
        res["__errs"] = errs[:5]
        b.close()
    srv.shutdown()
    print(json.dumps(res, ensure_ascii=False, indent=1))

if __name__ == "__main__":
    main()
