"""Audit des règles du document unique de forme (07/11), à partir de l'audit du format.
Audit du format (point 3 du 07/11) : pour chaque interface et chaque élément réglable, pose un réglage d'essai
(fond, couleur, taille) et vérifie que TOUTES les cases visibles de ce genre le prennent.
Lancer depuis v2-test :  python3 tests/audit_format.py"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_app import serve, PORT, BUDGET
from playwright.sync_api import sync_playwright

JS_AUDIT = r"""async (o) => {
  const w = ms => new Promise(z => setTimeout(z, ms)), R = {}, add = (k, m) => { (R[k] = R[k] || []).push(m); };
  const root = document.querySelector(o.root) || document.body;
  const vis = e => { if (!o.win && e.closest('#svConf, #docPop')) return false; if (e.closest('#navMenu, .hidden, [hidden], .sv-menu, #sviEtatMenu')) return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const Q = s => [...root.querySelectorAll(s)].filter(vis), T = e => (e.textContent || '').replace(/\s+/g, ' ').trim();
  const nm = e => { const b = e.closest('.bdg-d-block, .nvp-blk, table'); const t = b && b.querySelector('.ttl, .bdg-d-block-title, caption'); return t ? T(t).slice(0, 30) : (e.closest('table') && e.closest('table').id) || ''; };
  const cssOf = (e, p) => getComputedStyle(e)[p];
  if (!o.win) {
    /* 3.1 barre du haut */
    const bar = Q('.novapp-list-titlebar, .bdg-d-sticky .novapp-list-titlebar, .section-head')[0];
    if (!bar) add('3.1', 'pas de barre du haut'); else { const tx = bar.innerHTML;
      const need = { '≡': /navToggle|nav-ham|☰|≡|data-nav|menuBtn/i, 'i': /data-pill="inf"|data-nvp="info"|>i</, 'H': /data-pill="h"|data-nvp="h"|>H</, '⋯': /⋯|data-dots|hdrMenu|bdg-d-more|nvp-more/ };
      Object.entries(need).forEach(([k, re]) => { if (!re.test(tx)) add('3.1', 'barre du haut : « ' + k + ' » absent'); }); }
    /* 2.7 compteurs jamais entre parenthèses */
    Q('h1, .ttl, .bdg-d-tab, .rec-tab, .prm-tab, .prm-grp, th').forEach(e => { if (/\(\s*\d+\s*\)/.test(T(e))) add('2.7', 'compteur entre parenthèses : « ' + T(e).slice(0, 40) + ' »'); });
    /* 2.3 trait de gauche des blocs */
    Q('.bdg-d-block, .nvp-blk').forEach(b => { const tt = b.querySelector('.bdg-d-block-title, .blk-head') || b, bw = Math.max(parseFloat(cssOf(b, 'borderLeftWidth')), parseFloat(cssOf(tt, 'borderLeftWidth'))), sh = cssOf(b, 'boxShadow') + cssOf(tt, 'boxShadow'); if (!(bw >= 2) && !/inset/.test(sh)) add('2.3', 'bloc sans trait de gauche : ' + nm(b)); });
    /* 4.1 blocs : ⋯ et poignée */
    Q('.bdg-d-block, .nvp-blk').forEach(b => { if (!b.querySelector('.bdg-d-block-title, .blk-head')) add('4.1', 'bloc sans barre de titre : ' + nm(b)); else if (!/⋯|blk-dots|data-blkm|nvp-bm|bdg-blk-more/.test(b.querySelector('.bdg-d-block-title, .blk-head').innerHTML)) add('4.1', 'bloc sans ⋯ : ' + nm(b));
      if (!b.querySelector('.blk-rsz, .nvp-rsz, .bdg-rsz, [data-nvh], .lay-rsz, .bdg-d-rsz')) add('4.1', 'bloc sans poignée de hauteur : ' + nm(b)); });
    /* 5.1 onglets d'une rangée : même largeur et hauteur */
    Q('.rec-tabs, .bdg-d-tabs').forEach(r => { const L = [...r.children].filter(e => e.matches('button, .bdg-d-tab, .rec-tab') && vis(e)); if (L.length < 2) return; const W = L.map(e => Math.round(e.getBoundingClientRect().width)), H = L.map(e => Math.round(e.getBoundingClientRect().height));
      if (Math.max(...W) - Math.min(...W) > 2) add('5.1', 'onglets de largeurs différentes ' + W.join('/') + ' : ' + nm(r)); if (Math.max(...H) - Math.min(...H) > 1) add('5.1', 'onglets de hauteurs différentes ' + H.join('/') + ' : ' + nm(r)); });
    /* tableaux */
    Q('table').forEach(t => { if (t.closest('.svi-calp, .dpk, .gantt, .cal-t')) return; const n = nm(t) || t.className.split(' ')[0];
      const th = [...t.querySelectorAll(':scope > thead > tr:last-child > th')].filter(vis);
      th.forEach(h => { const hh = Math.round(h.getBoundingClientRect().height); if (Math.abs(hh - 22) > 1 && !t.closest('.dly-full, .qlt-wrap')) add('6.3', 'titre de colonne à ' + hh + ' px (22) : ' + n);
        if ((() => { const l = h.querySelector('.cf-lab, .bdg-head-label') || h; return l.scrollWidth > l.clientWidth + 1 || l.getBoundingClientRect().right > h.getBoundingClientRect().right + 1; })() && T(h)) add('6.1', 'titre de colonne coupé « ' + T(h).slice(0, 20) + ' » : ' + n);
        if (T(h) && !h.querySelector('.cf-btn') && !h.matches('.nvl-cbh, .center.nvl-cbh, ._cb, .nvp-rdh') && !h.querySelector('input[type=checkbox]') && !t.closest('.pg-fmt, .fmt-t')) add('6.1', 'colonne sans loupe « ' + T(h).slice(0, 20) + ' » : ' + n);
        if (/^LIGNES?$/.test(T(h).replace(/\s*\d+$/, ''))) add('6.16', 'colonne « LIGNES » : ' + n); });
      const rows = [...t.querySelectorAll(':scope > tbody > tr')].filter(vis);
      rows.forEach(tr => { const hh = Math.round(tr.getBoundingClientRect().height), tx = T(tr);
        if (/^AUCUN/.test(tx)) add('6.6', 'ligne « ' + tx.slice(0, 30) + ' » : ' + n);
        if (hh > 23 && !tr.querySelector('textarea, .ins-wrap, img') && tr.children.length > 1 && !t.closest('.dly-full, .qlt-wrap')) add('6.3', 'ligne de ' + hh + ' px (21) : ' + n);
        if (tr.querySelector('button.nv-x, .row-x, [data-rowdel]') || [...tr.querySelectorAll('button')].some(b => T(b) === '✕')) add('6.4', 'un ✕ sur la ligne : ' + n);
        [...tr.children].forEach(td => { const v = T(td); if (/^-?\d{1,3}( \d{3})*,\d{2}$/.test(v) && cssOf(td, 'textAlign') !== 'right' && !td.querySelector('input')) add('6.9', 'nombre non aligné à droite « ' + v + ' » : ' + n);
          if (v && /[a-zà-ÿ]{3}/.test(v) && !td.querySelector('input, select, textarea') && cssOf(td, 'textTransform') !== 'uppercase' && !/@|https?:/.test(v)) add('6.9', 'texte en minuscules « ' + v.slice(0, 20) + ' » : ' + n); }); });
      /* 6.5 CRÉER en bas, juste au-dessus du TOTAL */
      const nw = rows.findIndex(tr => /ICI…/.test(T(tr))); if (nw >= 0 && nw < rows.length - 1 && !rows.slice(nw + 1).every(tr => /^TOTAL/.test(T(tr)) || tr.closest('tfoot'))) add('6.5', 'ligne CRÉER pas en bas : ' + n);
      /* 6.4 case à cocher en dernière colonne */
      const r0 = rows.find(tr => tr.querySelector('input[type=checkbox]') && !/ICI…/.test(T(tr))); if (r0) { const cells = [...r0.children].filter(vis), last = cells[cells.length - 1], ci = cells.findIndex(c => c.querySelector('input[type=checkbox]'));
        if (last && !last.querySelector('input[type=checkbox]') && !last.querySelector('.nv-del, [data-nvdel]') && ci >= 0 && ci < cells.length - 2) add('6.4', 'case à cocher pas à droite : ' + n); }
    });
    Q('.tree-btn, .fold, .ins-fold, .grp-tog').forEach(e => { const cs = getComputedStyle(e); if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none') add('7.1', 'carré autour du signe : ' + nm(e)); });
    /* 10.5 pas de bandeau d'alerte dans les pages */
    Q('.frs-why, .nvp-why, .doc-why, .why-band, .alert-band').forEach(e => add('10.5', 'bandeau d\'alerte dans la page : « ' + T(e).slice(0, 40) + ' »'));
    /* 10.1 menus ⋯ (barre du haut et premier bloc) : une icône devant chaque ligne, MODIFIER LE FORMAT dans celui du haut */
    for (const [lab, b] of [['haut', [...(bar ? bar.querySelectorAll('button, [role=button]') : [])].filter(vis).reverse().find(x => T(x) === '⋯')], ['bloc', Q('.bdg-d-block-title button, .blk-head button').find(x => T(x) === '⋯')]]) {
      if (!b) { add('10.1', 'pas de ⋯ (' + lab + ')'); continue; } document.getElementById('blkMenu')?.remove(); b.click(); await w(250); const m = document.getElementById('blkMenu') || document.querySelector('.sv-menu, .hdr-menu');
      if (!m) { add('10.1', 'le ⋯ (' + lab + ') n\'ouvre pas de menu'); continue; }
      const it = [...m.querySelectorAll('button')]; it.filter(x => !x.querySelector('svg, i:not(.mi-sp), img, .mi')).forEach(x => add('10.1', 'ligne sans icône (' + lab + ') : ' + T(x)));
      if (lab === 'haut' && !it.some(x => /MODIFIER LE FORMAT/.test(T(x)))) add('1.4', 'MODIFIER LE FORMAT absent du ⋯ du haut');
      m.remove(); await w(80); }
    /* 1.6 police Arial */
    { const f = cssOf(root, 'fontFamily'); if (!/arial/i.test(f.split(',')[0])) add('1.6', 'police ' + f.split(',')[0]); }
  } else {
    const W = document.querySelector('#svConf .svc-card, #docPop .doc-card'); if (!W) { R.__absent = 1; return R; }
    const head = W.querySelector('.svc-t, .doc-head'); if (!head) add('10.2', 'pas de bandeau de titre');
    if (!W.querySelector('.svc-close, .doc-x')) add('10.2', 'pas de ✕');
    const foot = W.querySelector('.svc-f, .doc-foot'); if (foot) { const B = [...foot.querySelectorAll('button')].filter(vis).map(T); if (B.length >= 2 && B[0] !== 'ANNULER' && B[0] !== 'FERMER') add('10.2', 'boutons du bas : ' + B.join(' | ') + ' (ANNULER d\'abord)'); }
    /* nom du champ au-dessus du champ */
    [...W.querySelectorAll('.frs-f, .doc-cell')].filter(vis).forEach(f => { const l = f.querySelector(':scope > span, .doc-lab'), i = [...f.querySelectorAll('input:not([type=checkbox]):not([type=radio]), select:not(.sv-natsel), .sv-sel, textarea, .doc-in')].find(vis); if (!l || !i) return;
      if (l.getBoundingClientRect().bottom > i.getBoundingClientRect().top + 2) add('10.2', 'nom du champ pas au-dessus : « ' + T(l).slice(0, 25) + ' »'); });
    /* 10.3 pas de phrase sous les champs */
    [...W.querySelectorAll('small, .hint, .inf-sub, .frs-hint, .fld-help')].filter(vis).filter(e => T(e).length > 3).forEach(e => add('10.3', 'explication sous un champ : « ' + T(e).slice(0, 40) + ' »'));
    /* 10.5 pas de bandeau d'alerte */
    [...W.querySelectorAll('.frs-why, .doc-why')].filter(vis).forEach(e => add('10.5', 'bandeau d\'alerte : « ' + T(e).slice(0, 40) + ' »'));
    /* 10.6 même hauteur de champ */
    const HE = [...W.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=color]), select:not(.sv-natsel), .sv-sel, .doc-in')].filter(vis).filter(e => !e.closest('table')); const HM = {}; HE.forEach(e => { const h = Math.round(e.getBoundingClientRect().height); (HM[h] = HM[h] || []).push(e.tagName.toLowerCase() + '.' + String(e.className).split(' ').slice(0, 2).join('.')); }); if (Object.keys(HM).length > 1) add('10.6', 'hauteurs de champs différentes : ' + Object.entries(HM).map(([h, L]) => h + ' px (' + [...new Set(L)].slice(0, 3).join(', ') + ')').join(' / '));
    /* 8.6 / 6.9 majuscules */
    [...W.querySelectorAll('.frs-f > span, .doc-lab, .frs-st, .svc-t, .doc-title')].filter(vis).forEach(e => { if (/[a-zà-ÿ]{3}/.test(T(e)) && cssOf(e, 'textTransform') !== 'uppercase') add('6.9', 'libellé en minuscules « ' + T(e).slice(0, 25) + ' »'); });
  }
  Object.keys(R).forEach(k => { R[k] = [...new Set(R[k])].slice(0, 6); });
  R.__if = document.documentElement.dataset.svif; return R; }"""

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
        pg.evaluate("""() => { document.querySelectorAll('#svConf [data-x], #svConf .svc-close, #docPop .doc-x').forEach(x => x.click()); document.getElementById('docPop')?.remove(); }"""); pg.wait_for_timeout(300)
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
                pg.evaluate("""() => { document.querySelectorAll('#svConf [data-x], #svConf .svc-close, #docPop .doc-x').forEach(x => x.click()); document.getElementById('docPop')?.remove(); }"""); pg.wait_for_timeout(300)
        pg.evaluate("""() => document.querySelector('.nav-btn[data-view="chs"]')?.click()"""); pg.wait_for_timeout(900)
        res["prm"] = pg.evaluate(JS_AUDIT, {"ifk": "prm", "els": FICHE_EL + ["tabm", "tabsub"], "root": "#chs"})
        res["__errs"] = errs[:5]
        b.close()
    srv.shutdown()
    print(json.dumps(res, ensure_ascii=False, indent=1))

if __name__ == "__main__":
    main()
