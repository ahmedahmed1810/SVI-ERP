"""Audit des GESTES (07/11) : dans chaque interface, simule à la souris les gestes du document unique et vérifie qu'ils produisent leur effet.
Lancer depuis v2-test :  python3 tests/audit_gestes.py"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_app import serve, PORT, BUDGET
from audit_format import SEED, IDS
from playwright.sync_api import sync_playwright

H = r"""(() => { if (window.__ga) return; const vis = e => { if (!e || e.closest('#svConf, #docPop, #navMenu, .hidden, [hidden]')) return false; const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.top >= 40 && r.bottom <= innerHeight - 4; };
  window.__ga = { vis, pt: (e, fx = .5, fy = .5) => { const r = e.getBoundingClientRect(); return [r.left + r.width * fx, r.top + r.height * fy]; },
    find: (root, sel) => [...document.querySelectorAll((root ? root + ' ' : '') + sel)].find(vis) }; })()"""

def P(pg, js, arg=None):
    pg.evaluate(H)
    return pg.evaluate(js, arg) if arg is not None else pg.evaluate(js)

def at(pg, root, sel, fx=.5, fy=.5):
    return P(pg, """([root, sel, fx, fy]) => { const e = __ga.find(root, sel); if (!e) return null; e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); return __ga.pt(e, fx, fy); }""", [root, sel, fx, fy])

def close_all(pg):
    pg.keyboard.press("Escape"); pg.wait_for_timeout(80)
    P(pg, """() => { document.querySelectorAll('#svConf [data-x], #svConf .svc-close, #docPop .doc-x').forEach(x => { try { x.click(); } catch (e) {} }); document.getElementById('docPop')?.remove(); document.getElementById('blkMenu')?.remove(); document.getElementById('cfMenu')?.remove(); document.querySelectorAll('.cf-menu, .sv-menu').forEach(x => x.remove()); }""")
    pg.wait_for_timeout(120)

def drag(pg, a, b, hold=0, steps=12):
    pg.mouse.move(*a); pg.mouse.down()
    if hold: pg.wait_for_timeout(hold)
    pg.mouse.move(b[0], b[1], steps=steps); pg.wait_for_timeout(60); pg.mouse.up(); pg.wait_for_timeout(250)

def longpress(pg, a, ms=650):
    pg.mouse.move(*a); pg.mouse.down(); pg.wait_for_timeout(ms); pg.mouse.up(); pg.wait_for_timeout(250)

def checks(pg, root, kind):
    R = {}
    if kind == "l":
        # 8.2 / 6.18 : case modifiable — 1er toucher choisit, 2e saisit
        a = at(pg, root, "td.nv-ed:not(.nv-lk)")
        if a:
            pg.mouse.click(*a); pg.wait_for_timeout(150); s1 = P(pg, "() => !!document.querySelector('td.nv-sel')")
            pg.mouse.click(*a); pg.wait_for_timeout(250); s2 = P(pg, "() => !!document.querySelector('input.nv-edin') || !!document.getElementById('sviEtatMenu')")
            R["8.2 case : choisir puis saisir"] = "ok" if s1 and s2 else "KO (%s, %s)" % (s1, s2)
            close_all(pg)
    # 6.2 / 6.8 : loupe → menu (MASQUER LA COLONNE, TRIER, FILTRER PAR VALEURS)
    a = at(pg, root, "thead th .cf-btn")
    if a:
        pg.mouse.click(*a); pg.wait_for_timeout(250)
        t = P(pg, """() => { const m = document.getElementById('cfMenu') || document.querySelector('.cf-menu'); return m ? m.textContent.replace(/\\s+/g, ' ') : ''; }""")
        R["6.2 loupe"] = "ok" if ("MASQUER LA COLONNE" in t and "TRIER DE A" in t and "FILTRER PAR VALEURS" in t) else "KO : " + (t[:80] or "aucun menu")
        close_all(pg)
    else: R["6.2 loupe"] = "pas de loupe"
    # 6.1 : poignée de largeur
    w = P(pg, """root => { const th = [...document.querySelectorAll(root + ' thead th')].find(x => __ga.vis(x) && x.querySelector('.col-rs') && x.getBoundingClientRect().right < innerWidth - 80); if (!th) return null; th.setAttribute('data-ga', 'rs'); const h = th.querySelector('.col-rs'), r = h.getBoundingClientRect(); const live = x => document.elementFromPoint(x, r.top + r.height / 2) === h || h.contains(document.elementFromPoint(x, r.top + r.height / 2)); return [r.left + r.width * .8, r.top + r.height / 2, th.getBoundingClientRect().width, 1]; }""", root)
    if w:
        drag(pg, (w[0], w[1]), (w[0] + 50, w[1]))
        w2 = P(pg, """() => { const th = document.querySelector('th[data-ga="rs"]'); return th ? th.getBoundingClientRect().width : 0; }""")
        R["6.1 largeur"] = ("ok" if w2 - w[2] >= 20 else "KO (%d → %d px)" % (w[2], w2)) + ("" if w[3] else " — moitié droite de la poignée cachée par la colonne voisine")
        close_all(pg)
    else: R["6.1 largeur"] = "pas de poignée"
    # 6.11 : déplacer une colonne en glissant son titre
    o = P(pg, """root => { const tr = [...document.querySelectorAll(root + ' thead tr')].find(x => __ga.vis(x) && x.cells.length >= 4); if (!tr) return null; tr.setAttribute('data-ga', 'co');
      const c = [...tr.cells], a = c[1], b = c[2], ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return [ra.left + 12, ra.top + ra.height / 2, rb.left + rb.width * .8, c.map(x => x.textContent.trim()).join('|')]; }""", root)
    if o:
        drag(pg, (o[0], o[1]), (o[2], o[1]), steps=16)
        n = P(pg, """root => { const tr = document.querySelector('thead tr[data-ga="co"]') || [...document.querySelectorAll(root + ' thead tr')].find(x => __ga.vis(x) && x.cells.length >= 4); return tr ? [...tr.cells].map(x => x.textContent.trim()).join('|') : ''; }""", root)
        if n == o[3]:
            drag(pg, (o[0], o[1]), (o[2], o[1]), hold=550, steps=16)
            n = P(pg, """root => { const tr = [...document.querySelectorAll(root + ' thead tr')].find(x => __ga.vis(x) && x.cells.length >= 4); return tr ? [...tr.cells].map(x => x.textContent.trim()).join('|') : ''; }""", root)
        R["6.11 ordre des colonnes"] = "ok" if n != o[3] else "KO (ordre inchangé)"
        close_all(pg)
    # appui long sur un titre de colonne → renommer / aligner
    a = at(pg, root, "thead th .cf-lab", .3, .5)
    if a:
        longpress(pg, a)
        t = P(pg, """() => { const c = document.querySelector('#svConf .svc-card, #svConf .svc-t'); return c ? c.textContent.replace(/\\s+/g, ' ').slice(0, 60) : ''; }""")
        R["titre de colonne : renommer / aligner (appui long)"] = "ok" if t else "KO"
        close_all(pg)
    if kind == "f":
        # 4.2 : double toucher sur le titre du bloc = agrandir
        a = at(pg, root, ".bdg-d-block-title .ttl, .blk-head .ttl")
        if a:
            b0 = P(pg, """root => { const b = __ga.find(root, '.bdg-d-block, .nvp-blk'); return b ? [b.className, Math.round(b.getBoundingClientRect().height)].join('#') : ''; }""", root)
            pg.mouse.click(*a); pg.wait_for_timeout(90); pg.mouse.click(*a); pg.wait_for_timeout(350)
            mx = """root => { const m = document.querySelector('.nvp-max, .blk-max, .bdg-d-block.max, .bdg-max, [data-max="1"], .lay-max, .bdg-d-block.is-max, .bdg-full'); const b = __ga.find(root, '.bdg-d-block, .nvp-blk'); return m ? 'max' : b && b.getBoundingClientRect().height > innerHeight * .7 ? 'max' : ''; }"""
            b1 = P(pg, mx, root)
            if not b1:
                pg.mouse.dblclick(*a); pg.wait_for_timeout(350); b1 = P(pg, mx, root)
            R["4.2 double toucher = agrandir"] = "ok" if b1 else "KO"
            pg.mouse.click(*a); pg.wait_for_timeout(90); pg.mouse.click(*a); pg.wait_for_timeout(250); close_all(pg)
        # 4.3 : poignée de hauteur du bloc
        h = P(pg, """root => { const g = [...document.querySelectorAll(root + ' .nvp-rsz, ' + root + ' .blk-rsz')].find(x => { const r = x.getBoundingClientRect(); return r.width > 4 && r.top > 60 && r.bottom < innerHeight - 70; }); if (!g) return null; const b = g.closest('.bdg-d-block, .nvp-blk'); b.setAttribute('data-ga', 'h'); const r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, b.getBoundingClientRect().height]; }""", root)
        if h:
            drag(pg, (h[0], h[1]), (h[0], h[1] + 60))
            h2 = P(pg, """() => { const b = document.querySelector('[data-ga="h"]'); return b ? b.getBoundingClientRect().height : 0; }""")
            R["4.3 poignée de hauteur"] = "ok" if h2 - h[2] >= 25 else "KO (%d → %d)" % (h[2], h2)
        # 5.3 : onglets déplaçables
        t = P(pg, """root => { const r = [...document.querySelectorAll(root + ' .rec-tabs, ' + root + ' .bdg-d-tabs')].find(x => __ga.vis(x) && x.querySelectorAll('.rec-tab, .bdg-d-tab').length >= 2); if (!r) return null; r.setAttribute('data-ga', 'tb');
          const L = [...r.querySelectorAll('.rec-tab, .bdg-d-tab')], a = L[0].getBoundingClientRect(), b = L[1].getBoundingClientRect(); return [a.left + a.width * .4, a.top + a.height / 2, b.left + b.width * .8, L.map(x => x.textContent.trim()).join('|')]; }""", root)
        if t:
            drag(pg, (t[0], t[1]), (t[2], t[1]), hold=550, steps=16)
            n = P(pg, """() => { const r = document.querySelector('[data-ga="tb"]'); return r ? [...r.querySelectorAll('.rec-tab, .bdg-d-tab')].map(x => x.textContent.trim()).join('|') : ''; }""")
            if n == t[3]:
                drag(pg, (t[0], t[1]), (t[2], t[1]), steps=16)
                n = P(pg, """() => { const r = document.querySelector('[data-ga="tb"]'); return r ? [...r.querySelectorAll('.rec-tab, .bdg-d-tab')].map(x => x.textContent.trim()).join('|') : ''; }""")
            R["5.3 onglets déplaçables"] = "ok" if n and n != t[3] else "KO"
            close_all(pg)
        # 9.3 : glisser une ligne d'un DÉTAIL (appui long puis glisser)
        d = P(pg, """root => { const b = [...document.querySelectorAll(root + ' .nvp-blk, ' + root + ' .bdg-d-block')].find(x => __ga.vis(x) && /^DÉTAIL|DÉSIGNATIONS/.test((x.querySelector('.ttl') || {}).textContent || '')); if (!b) return null;
          const R = [...b.querySelectorAll('tbody tr')].filter(r => __ga.vis(r) && !/ICI…/.test(r.textContent) && !r.matches('.nvp-gt, .ins-title, .bdg-d-total-row')); if (R.length < 2) return 'une ligne';
          const td = [...R[0].cells].find(c => !c.querySelector('input, select, button, .sv-sel') && c.getBoundingClientRect().width > 20) || R[0].cells[0], a = td.getBoundingClientRect(), z = R[1].getBoundingClientRect();
          return [a.left + a.width / 2, a.top + a.height / 2, z.top + z.height * .9, (b.querySelector('.ttl') || {}).textContent.trim()]; }""", root)
        if isinstance(d, list):
            pg.mouse.move(d[0], d[1]); pg.mouse.down(); pg.wait_for_timeout(600); pg.mouse.move(d[0], d[2], steps=10); pg.wait_for_timeout(120)
            on = P(pg, """() => !!document.querySelector('.cafp-dg, .ins-drag, .row-drag, .dragging, .drg-src, html.cafp-dragging, [class*="drag-src"], .ins-dragging, .lk-drag, .mv-src, .rd-src, .ins-mv')""")
            pg.mouse.up(); pg.wait_for_timeout(300); close_all(pg)
            R["9.3 glisser une ligne (" + d[3][:28] + ")"] = "ok" if on else "KO"
        elif d: R["9.3 glisser une ligne"] = "non testé (" + d + ")"
    # 3.4 : balayage sur la barre du haut = pièce suivante / précédente (fiches)
    if kind == "f":
        b = P(pg, """root => { const e = [...document.querySelectorAll(root + ' .novapp-list-titlebar')].find(x => x.getBoundingClientRect().width > 50); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width * .45, r.top + r.height / 2]; }""", root)
        if b:
            r0 = P(pg, """root => (document.querySelector(root + ' .nvp-ref, ' + root + ' .bdg-d-h1') || {}).textContent || ''""", root)
            drag(pg, (b[0] + 150, b[1]), (b[0] - 150, b[1]), steps=8); pg.wait_for_timeout(500)
            r1 = P(pg, """root => (document.querySelector(root + ' .nvp-ref, ' + root + ' .bdg-d-h1') || {}).textContent || ''""", root)
            R["3.4 balayage = pièce suivante"] = "ok" if r1 and r1 != r0 else "KO (" + r0.strip()[:20] + ")"
            if r1 != r0: drag(pg, (b[0] - 150, b[1]), (b[0] + 150, b[1]), steps=8); pg.wait_for_timeout(500)
    return R

def win_checks(pg):
    R = {}
    if not P(pg, "() => !!document.querySelector('#svConf .svc-card, #docPop .doc-card')"): return {"__": "pas de fenêtre"}
    # 8.8 : 1er toucher sur un champ = tout le contenu choisi
    a = P(pg, """() => { const i = [...document.querySelectorAll('#svConf input.ins-in:not([type=checkbox]):not([readonly]):not(:disabled), #docPop input.doc-in:not([readonly])')].find(x => { const r = x.getBoundingClientRect(); return r.width > 20 && r.height > 8 && x.value && x.type !== 'date' && !x.closest('table'); }); if (!i) return null; i.setAttribute('data-ga', 'in'); const r = i.getBoundingClientRect(); return [r.left + r.width * .7, r.top + r.height / 2]; }""")
    if a:
        pg.mouse.click(*a); pg.wait_for_timeout(200)
        s = P(pg, """() => { const i = document.querySelector('[data-ga="in"]'); return i ? [i.selectionStart, i.selectionEnd, i.value.length].join(',') : ''; }""")
        p = s.split(','); R["8.8 1er toucher = tout choisi"] = "ok" if len(p) == 3 and p[0] == '0' and p[1] == p[2] else "KO (" + s + ")"
    else: R["8.8 1er toucher = tout choisi"] = "pas de champ rempli"
    # 10.4 : appui long sur un champ = fiche du champ
    a = P(pg, """() => { const f = [...document.querySelectorAll('#svConf input, #docPop input')].find(x => { const r = x.getBoundingClientRect(); return r.width > 10 && r.height > 5 && typeof sviMaskable === 'function' && sviMaskable(x) && !x.closest('table'); }); if (!f) return null; const r = f.getBoundingClientRect(); return [r.left + Math.min(20, r.width / 2), r.top + r.height / 2]; }""")
    if a:
        longpress(pg, a, 700)
        t = P(pg, """() => document.body.textContent.includes('IMPRIMÉ SUR LA COMMANDE') && !!document.querySelector('.mkp-prt')""")
        R["10.4 appui long sur un champ = fiche du champ"] = "ok" if t else "KO"
    return R

def main():
    srv = serve(); res = {}
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1180, "height": 820})
        ctx.add_init_script("try { localStorage.setItem('svitest:svi_user_v1', 'TESTEUR'); localStorage.setItem('svitest:svi_tva_def_v1', '20'); } catch (e) {}")
        pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.route("https://script.google.com/**", lambda r: r.abort())
        url = f"http://127.0.0.1:{PORT}/index.html"; pg.goto(url); pg.wait_for_timeout(1500)
        B2 = json.loads(json.dumps(BUDGET)); B2["ref"] = "TEST-2"
        pg.evaluate("""L => { sviInstSet(L); return sviInstFlush(); }""", [BUDGET, B2])
        pg.evaluate("""() => { localStorage.setItem('svi_listmode_v1', 'inst'); localStorage.removeItem('svi_lastbdg_v1'); }""")
        pg.goto(url); pg.wait_for_timeout(1200)
        pg.evaluate("""() => document.querySelector('.nav-btn[data-view="bdg"]')?.click()"""); pg.wait_for_timeout(1000)
        pg.evaluate("""async () => { await SVI_INST_READY; bdgRows = []; bdgLoaded = true; document.querySelectorAll('[data-cancel], .svc-close').forEach(x => { try { x.click(); } catch (e) {} }); renderBudgetList(); }"""); pg.wait_for_timeout(800)
        res["bdgl"] = checks(pg, "#bdg", "l")
        pg.evaluate("""() => { localStorage.setItem('svi_lastbdg_v1', 'TEST-1'); }"""); pg.goto(url); pg.wait_for_timeout(1500)
        pg.evaluate("""() => document.querySelector('.nav-btn[data-view="bdg"]')?.click()"""); pg.wait_for_timeout(2000)
        res["bdg"] = checks(pg, "#bdg", "f")
        pg.evaluate("""() => document.querySelector('#bdg [data-pill="inf"]')?.click()"""); pg.wait_for_timeout(700)
        res["bdg_w"] = win_checks(pg); close_all(pg)
        pg.evaluate(SEED)
        pg.evaluate("""() => { const add = (L, sv) => { L.forEach(x => { (x.lignes || []).push({ id: 'z' + x.id, des: 'SABLE', u: 'M3', q: 2, pu: 100, tva: 20 }); }); sv(L); }; add(achDvf(), achDvfSave); add(achCmf(), achCmfSave); add(achFaf(), achFafSave); }""")
        pg.evaluate("""async () => { const now = new Date().toISOString(); const L = achCaf(); L.push({ id: 'C2', ref: 'CFA 2', state: 'ouverte', cree: now, frs: [], rep: {}, lignes: [], lf: {}, ld: {}, lc: {}, fd: {}, fc: {} }); achCafSave(L); }""")
        for t, i in IDS.items():
            pg.evaluate("""t => document.querySelector(`.nav-btn[data-view="ach"][data-ach="${t}"]`)?.click()""", t); pg.wait_for_timeout(900)
            res[t + "_l"] = checks(pg, "#ach", "l")
            if i:
                pg.evaluate("""([t, i]) => achGo(t, i)""", [t, i]); pg.wait_for_timeout(900)
                res[t + "_f"] = checks(pg, "#ach", "f")
                pg.evaluate("""() => document.querySelector('#ach [data-nvp="info"]')?.click()"""); pg.wait_for_timeout(700)
                res[t + "_w"] = win_checks(pg); close_all(pg)
        pg.evaluate("""() => document.querySelector('.nav-btn[data-view="chs"]')?.click()"""); pg.wait_for_timeout(900)
        res["prm"] = checks(pg, "#chs", "l")
        res["__errs"] = errs[:5]; b.close()
    srv.shutdown()
    print("@@" + json.dumps(res, ensure_ascii=False))

if __name__ == "__main__":
    main()
