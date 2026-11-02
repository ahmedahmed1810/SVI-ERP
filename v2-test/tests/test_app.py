"""Tests de non-régression de SVI ERP (v2-test).
Lancer depuis v2-test :  python3 tests/test_app.py
Ouvre l'application dans Chromium (sans réseau : les appels à Google Apps Script échouent),
crée un budget en instance d'essai et vérifie les fonctions principales."""
import http.server, threading, functools, os, sys, json, re
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8799

BUDGET = {
  "ref": "TEST-1", "project": "PROJET TEST", "state": "instance",
  "data": {
    "des": [
      {"id": "t1", "t": True, "d": 0, "art": "1", "des": "GROS ŒUVRE"},
      {"id": "d1", "d": 1, "art": "1.1", "des": "BETON EN FONDATION", "u": "M3", "q": 10, "p": 1000, "tva": 20},
      {"id": "d3", "d": 1, "art": "1.3", "des": "ACIER", "u": "KG", "q": 100, "p": 15, "tva": 20},
      {"id": "d2", "d": 1, "art": "", "des": "BETON EN ELEVATION", "u": "M3", "q": 5, "p": 1200, "tva": 20}
    ],
    "lot": [{"id": "l1", "v": "RDC"}, {"id": "l2", "v": "ETAGE 1"}],
    "prim": [{"id": "p1", "v": "BETONNAGE"}],
    "sec": [{"id": "s1", "v": "BETONNAGE", "u": "M3"}, {"id": "s2", "v": "COFFRAGE", "u": "M2"}],
    "prd": [{"id": "x1", "des": "BETON B25", "u": "M3", "nbr": 10, "d1": 1, "d2": 0.5, "d3": 2}],
    "chg": [{"id": "c1", "art": "C1", "des": "CIMENT", "u": "T", "q": 3, "p": 1500},
            {"id": "c2", "art": "C2", "des": "SABLE", "u": "M3", "q": 4, "p": 200}],
    "qlt": [], "dly": {},
    "links": [{"id": "L1", "des": "d1", "lot": "l1", "prim": "p1", "sec": "s1", "prd": [{"id": "x1"}], "chg": [{"id": "c1"}]}]
  }
}

def serve():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    h = functools.partial(Q, directory=ROOT)
    s = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), h)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s

RESULTS = []
def check(name, ok, info=""):
    RESULTS.append((name, bool(ok)))
    print(("OK    " if ok else "ÉCHEC ") + name + ("" if ok else "  → " + str(info)))

def static_checks():
    import subprocess
    r = subprocess.run([sys.executable, os.path.join(ROOT, "outils", "assembler.py"), "--verifier"], capture_output=True, text=True)
    check("fichiers des modules assemblés à partir de src/ (à jour)", r.returncode == 0, r.stdout.strip())
    # v753 : un fichier par module — chacun a une syntaxe valide et index.html les charge tous, socle d'abord, même version
    errs = []
    for f in ("app.js", "app-budget.js", "app-achats.js", "app-autres.js"):
        r = subprocess.run(["node", "--check", os.path.join(ROOT, f)], capture_output=True, text=True)
        if r.returncode: errs.append(f + " : " + r.stderr[:200])
    check("fichiers des modules : syntaxe valide", not errs, errs)
    import re
    tags = re.findall(r'<script src="(app[\w-]*\.js)\?v=(\d+)"', open(os.path.join(ROOT, "index.html"), encoding="utf-8").read())
    check("index.html charge app.js, app-budget.js, app-achats.js, app-autres.js (même version)",
          [t[0] for t in tags] == ["app.js", "app-budget.js", "app-achats.js", "app-autres.js"] and len({t[1] for t in tags}) == 1, tags)

class MepView:
    """v784 : l'aperçu s'ouvre dans l'application (éditeur MISE EN PAGE unique), plus dans une autre fenêtre."""
    def __init__(self, pg): self.pg = pg
    def wait_for_timeout(self, ms): self.pg.wait_for_timeout(ms)
    def evaluate(self, js): return self.pg.evaluate(js.replace("document.body", "(document.getElementById('sviMep') || document.body)"))
    def screenshot(self, **k): self.pg.screenshot(**k)
    def close(self): self.pg.evaluate("() => window.sviMep && sviMep.close()")

def main():
    static_checks()
    srv = serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 1180, "height": 820}, permissions=["clipboard-read", "clipboard-write"])
        ctx.add_init_script("try { localStorage.setItem('svitest:svi_user_v1', 'TESTEUR'); } catch (e) {}")
        # v788 : le Gantt n'apparaît qu'en plein écran — les anciens tests du planning le gardent affiché (attribut de test)
        ctx.add_init_script("(() => { const f = () => { try { document.documentElement.setAttribute('data-dly-all', '1'); } catch (e) {} }; f(); document.addEventListener('DOMContentLoaded', f); })()")
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.route("https://script.google.com/**", lambda r: r.abort())   # pas de réseau : base Google injoignable
        url = f"http://127.0.0.1:{PORT}/index.html"
        pg.goto(url); pg.wait_for_timeout(1500)
        check("chargement sans erreur JavaScript", not errs, errs[:3])

        # budget en instance d'essai, rouvert comme « dernier budget »
        pg.evaluate("""b => { sviInstSet([b]); return sviInstFlush(); }""", BUDGET)
        pg.evaluate("""() => { localStorage.setItem('svi_lastbdg_v1', 'TEST-1'); localStorage.setItem('svi_listmode_v1', 'inst'); }""")
        pg.goto(url); pg.wait_for_timeout(1200)
        pg.evaluate("""() => document.querySelector('.nav-btn[data-view="bdg"]')?.click()""")
        pg.wait_for_timeout(1200)
        pg.evaluate("""async () => { await SVI_INST_READY; bdgRows = []; bdgLoaded = true;
            document.querySelectorAll('[data-cancel], .svc-close').forEach(x => { try { x.click(); } catch (e) {} }); renderBudgetList(); }""")
        pg.wait_for_timeout(1500)
        # v644 (refonte, étape 5) : règles de calcul du planning, testées seules (02c, calcul pur ; dimanche non travaillé)
        rp = pg.evaluate("""() => { const c = sviCalOf({}); const P = (deb, fin, finMidi) => ({ deb, fin, finMidi });
            return [
              sviPlanLinkNeed(c, { t: 'FD', o: 0 }, P('2026-10-05', '2026-10-07', false)),
              sviPlanLinkNeed(c, { t: 'FD', o: 0 }, P('2026-10-05', '2026-10-07', true)),
              sviPlanLinkNeed(c, { t: 'FD', o: 2 }, P('2026-10-05', '2026-10-07', false)),
              sviPlanLinkNeed(c, { t: 'FD', o: 0 }, P('2026-10-05', '2026-10-10', false)),
              sviPlanLinkNeed(c, { t: 'DD', o: 3 }, P('2026-10-05', '2026-10-07', false)),
              sviPlanNeed(c, [{ k: 'a', t: 'FD', o: 0 }, { k: 'b', t: 'DD', o: 0 }], k => k === 'a' ? P('2026-10-01', '2026-10-02') : P('2026-10-09', '')),
              sviPlanChainO(c, '2026-10-07', false, '2026-10-08'), sviPlanChainO(c, '2026-10-07', false, '2026-10-10'), sviPlanChainO(c, '2026-10-07', true, '2026-10-07'),
              sviPlanMove(c, '2026-10-05', '2026-10-06', '2026-10-10').fin ]; }""")
        check("règle planning : FIN → DÉBUT (0 = demi-journée suivante, midi, décalage, dimanche), DÉBUT → DÉBUT, plusieurs prédécesseurs, décalage créé, tâche déplacée",
              rp == ["2026-10-08", "2026-10-07", "2026-10-10", "2026-10-12", "2026-10-08", "2026-10-09", 0, 2, 0, "2026-10-12"], rp)
        # v645 (refonte, étapes 8 et 9) : règles de saisie (presque identiques) et d'import (dates, type de liaison, nature d'onglet), testées seules
        rs = pg.evaluate("""() => [
            sviIsNear('ENDUIT 20', 'ENDUI 20'), sviIsNear('ÉTANCHÉITÉ', 'ETANCHIETE'), sviIsNear('ENDUIT 10', 'ENDUIT 20'),
            sviIsNear('BETON-B25', 'BÉTON B25'), sviIsNear('SABLE', 'SABLE'), sviIsNear('CHAUX', 'CHAUD'), sviIsNear('ACIER', 'ACIR'),
            sviImpDate('17/10/2026'), sviImpDate('17.10.26'), sviImpDate(46312), sviImpDate('2026-10-17T23:00:00.000Z') !== null, sviImpDate('31/02/2026'), sviImpDate(''),
            sviLinkType(''), sviLinkType('fin → début'), sviLinkType('DD'), sviLinkType('XX'),
            sviSheetKind([['PROJET', 'DÉSIGNATION CLIENT']]), sviSheetKind([['LOT', 'ACTIVITÉ SECONDAIRE', 'DÉBUT']]), sviSheetKind([['CRITÈRE', 'POINT DE CONTRÔLE']]), sviSheetKind([['X']]) ]""")
        check("règle saisie / import : presque identiques, dates importées, type de liaison, nature d'onglet",
              rs == [True, True, False, True, False, True, False, "2026-10-17", "2026-10-17", "2026-10-17", True, None, "", "FD", "FD", "DD", None, "budget", "dly", "qlt", ""], rs)
        # remarque 76 : première ouverture — titres des désignations pliés ; on déplie pour la suite
        f76 = pg.evaluate("() => { const b = document.querySelector('#bdgClientBody .ins-fold[data-fold=\"t1\"]'); return [!!b, b ? b.textContent.trim() : '', !document.querySelector('#bdgClientBody tr[data-iid=\"d1\"]')]; }")
        pg.evaluate("() => document.querySelector('#bdgClientBody .ins-fold[data-fold=\"t1\"]')?.click()"); pg.wait_for_timeout(400)
        check("remarque 76 : à la première ouverture, titres des désignations pliés", f76 == [True, "›", True], f76)
        has = pg.evaluate("() => !!(document.querySelector('.bdg-d-client-scroll') && document.querySelector('[data-iid=\"d1\"]'))")
        check("budget en instance ouvert (DÉSIGNATIONS CLIENT)", has)
        check("ouverture sans erreur JavaScript", not errs, errs[:3])
        ins = "(() => { const s = [...document.querySelectorAll('*')].find(e => e.__ins); return s && s.__ins; })()"
        # v727 (bloc 11) : CHS n'existe plus (PARAMÉTRAGE sans CHS, TVA d'une charge saisissable) ; TÂCHES : autant de lignes qu'il y en a (≤ 5), lignes entières
        t727 = pg.evaluate("""() => { const tabs = [...document.querySelectorAll('.prm-tab')].map(b => b.textContent);
            const c = [...document.querySelectorAll('.bdg-h-col')].filter(x => x.offsetHeight);
            const n = Math.max(...c.map(x => [...x.querySelectorAll('.ins-li')].filter(e => e.offsetHeight).length));
            const hd = c[0].querySelector('.bdg-h-head').getBoundingClientRect().height, rh = c[0].querySelector('.ins-li').getBoundingClientRect().height;
            const inner = c[0].clientHeight - hd, k = inner / rh;
            return [tabs.some(t => /CHS/.test(t)), Math.round(k * 100) / 100, Math.min(5, n)]; }""")
        tv = pg.evaluate("() => { const t = document.querySelector('table.ins-table[data-ik=\"chg\"]'); if (!t) return 'pas de tableau'; const i = t.querySelector('tbody tr[data-iid] input.ins-in[data-f=\"tva\"]'); return !!i && !i.readOnly && !i.disabled; }")
        check("v727 : CHS retiré (PARAMÉTRAGE), TVA d'une charge saisissable ; TÂCHES en lignes entières (≤ 5)", t727[0] is False and abs(t727[1] - t727[2]) < 0.05 and tv is True, [t727, tv])
        # v729 (bloc 10) : COMPARATIF — menu ⋯ du haut, choix de deux états (identiques = grisé), écran en quatre parties, lecture seule
        c729 = pg.evaluate("""async () => { const X = INS_X, I = X.INS, w = ms => new Promise(z => setTimeout(z, ms)); const keep = JSON.stringify({ dlp: I.dlp || null, vfz: I.vfz || null });
            const L = I.links[0], k = L.lot + '|' + L.sec; I.dlp = I.dlp || {}; I.dlp[k] = [{ deb: '2026-11-02', fin: '2026-11-10' }];
            const v = JSON.parse(JSON.stringify(I)); delete v.vfz; delete v.ver; v.dlp[k] = [{ deb: '2026-11-02', fin: '2026-11-14' }]; I.vfz = [{ id: 'vx', n: 1, kind: 'MANUELLE', date: '30/10/2026', d: v }];
            const before = JSON.stringify(I.dlp);
            document.getElementById('bdgMore')?.click(); await w(300); const inMenu = !!document.querySelector('#blkMenu [data-a="cmp"]');
            document.querySelector('#blkMenu [data-a="cmp"]')?.click(); await w(300);
            /* v757 : COMPARER unique — l'état actuel coché d'avance ; un seul élément = COMPARER grisé ; deux = COMPARER EN DÉTAIL */
            const pk = document.getElementById('svConf'); if (!pk || !pk.querySelector('[data-cv]')) return ['pas de fenêtre', inMenu];
            const same = pk.querySelector('[data-cmpgo]').disabled;
            const cv = pk.querySelector('[data-cv="v:vx"]'); cv.checked = true; cv.dispatchEvent(new Event('change', { bubbles: true })); await w(100);
            pk.querySelector('[data-cmpdet]').click(); await w(500);
            const d = document.getElementById('svConf'), ecart = d && d.querySelector('.cmp-plan tbody tr td:last-child') ? d.querySelector('.cmp-plan tbody tr td:last-child').textContent : '';
            const r = [inMenu, same, d ? d.querySelectorAll('.i1-p').length : 0, ecart, d ? d.querySelectorAll('.cmp-g1').length : 0, d ? d.querySelectorAll('polyline').length : 0, JSON.stringify(I.dlp) === before];
            d && d.remove(); const K = JSON.parse(keep); if (K.dlp) I.dlp = K.dlp; else delete I.dlp; if (K.vfz) I.vfz = K.vfz; else delete I.vfz; X.insSave(); X.refreshAll(); return r; }""".replace("INS_X", ins))
        check("v729 / v757 : COMPARER (menu ⋯) — un seul élément = grisé ; deux = COMPARER EN DÉTAIL : quatre parties, écart de fin +4 J, barres grises de l'état 1, deux courbes ; rien modifié", c729 == [True, True, 4, "+4", 1, 2, True], c729)
        # v756 / v757 : bloc à onglets AVENANTS / SCÉNARIOS / VERSIONS / RECALAGES (un seul bloc, boutons qui suivent l'onglet, menu ⋯ :
        # COMPARER, CRÉER, APERÇU, EXPORTER) ; onglet AVENANTS (budget initial) ; COMPARER côte à côte de plusieurs éléments
        e756 = pg.evaluate("""async () => { const X = INS_X, I = X.INS, w = ms => new Promise(z => setTimeout(z, ms)), sh = [...document.querySelectorAll('*')].find(e => e.__ins);
            const keep = JSON.stringify({ vfz: I.vfz || null }), keepT = localStorage.getItem('svi_etp_tab_v1');
            const B = document.querySelector('.blk-etp'); if (!B) return 'pas de bloc';
            const r = [!B.hidden, [...B.querySelectorAll('[data-etab]')].map(b => b.dataset.etab).join(','), !document.querySelector('.bdg-d-page > .blk-scn, .bdg-d-page > .blk-ver, .bdg-d-page > .blk-rcl')];
            B.querySelector('[data-etab="ver"]').click(); await w(50);
            r.push(B.querySelector('.etp-pane[data-pane="ver"]').classList.contains('on'), [...B.querySelectorAll('.blk-tools .blk-btn[data-etp]')].every(b => b.dataset.blk === 'ver'));
            B.querySelector('[data-etab="av"]').click(); await w(50);
            r.push([...document.querySelectorAll('#avTable tbody tr[data-avr]')].map(t => t.cells[0].textContent.trim()).join(','));
            B.querySelector('.blk-more')?.click(); await w(150); r.push([...document.querySelectorAll('#blkMenu button span')].map(x => x.textContent.trim()).join('|')); document.getElementById('blkMenu')?.remove();
            const v = JSON.parse(JSON.stringify(I)); delete v.vfz; delete v.ver; (v.des.find(x => !x.t) || {}).q = 999; I.vfz = [{ id: 'vx', n: 1, kind: 'MANUELLE', date: '30/10/2026', d: v }];
            sh.__cmpMulti(''); await w(150); const pk = document.getElementById('svConf'); const cv = pk.querySelector('[data-cv="v:vx"]'); cv.checked = true; cv.dispatchEvent(new Event('change', { bubbles: true })); await w(50);
            pk.querySelector('[data-cmpgo]').click(); await w(300); const cw = document.querySelector('.cmpm-card');
            r.push(cw ? [cw.querySelectorAll('thead th').length, cw.querySelectorAll('tbody tr').length, !!cw.querySelector('.cmpm-ec')] : 'pas de tableau');
            document.getElementById('svConf')?.remove();
            const K = JSON.parse(keep); if (K.vfz) I.vfz = K.vfz; else delete I.vfz; if (keepT === null) localStorage.removeItem('svi_etp_tab_v1'); else localStorage.setItem('svi_etp_tab_v1', keepT); X.refreshAll(); return r; }""".replace("INS_X", ins))
        check("v756 / v757 : un seul bloc à onglets AVENANTS / SCÉNARIOS / VERSIONS / RECALAGES, boutons de l'onglet ouvert, menu ⋯ (COMPARER, CRÉER, APERÇU, EXPORTER), onglet AVENANTS ; COMPARER côte à côte avec écarts",
              e756[:5] == [True, "av,scn,ver,rcl", True, True, True] and e756[5].endswith(" INI") and "COMPARER" not in e756[6] and e756[6].startswith("AGRANDIR|CRÉER UN AVENANT|IMPORTER") and e756[6].index("EXPORTER") < e756[6].index("APERÇU") and e756[7] == [3, 13, True], e756)
        # v758 : fenêtre d'import unique — sources FICHIER / GOOGLE SHEETS / MS PROJECT (XML) / AUTRE BUDGET ; un fichier est lu à blanc (budget
        # ouvert inchangé) puis proposé comme source de la même fenêtre (cases, aperçu, IMPORTER) ; IMPORTER dans AVENANTS, SCÉNARIOS, RECALAGES, pas VERSIONS
        import tempfile
        td = tempfile.mkdtemp()
        xmlp, csvp = os.path.join(td, "plan.xml"), os.path.join(td, "budget.csv")
        open(xmlp, "w", encoding="utf-8").write("<?xml version='1.0'?><Project><Tasks><Task><UID>0</UID><Name>P</Name><OutlineLevel>0</OutlineLevel><Summary>1</Summary></Task>"
            "<Task><UID>1</UID><Name>RDC</Name><OutlineLevel>1</OutlineLevel><Summary>1</Summary></Task>"
            "<Task><UID>2</UID><Name>FONDATION MSP</Name><OutlineLevel>2</OutlineLevel><Summary>0</Summary><Start>2026-11-02T08:00:00</Start><Finish>2026-11-04T17:00:00</Finish></Task>"
            "<Task><UID>3</UID><Name>ELEVATION MSP</Name><OutlineLevel>2</OutlineLevel><Summary>0</Summary><Start>2026-11-05T08:00:00</Start><Finish>2026-11-06T17:00:00</Finish>"
            "<PredecessorLink><PredecessorUID>2</PredecessorUID><Type>1</Type><LinkLag>0</LinkLag></PredecessorLink></Task></Tasks></Project>")
        open(csvp, "w", encoding="utf-8").write("ART,DÉSIGNATION CLIENT,UPB,LOT,ACTIVITÉ PRIMAIRE,ACTIVITÉ SECONDAIRE,TYPE (PRD / CHG),ARTICLE,DÉSIGNATION PRODUIT / CHARGE,UNITÉ,NBR,DIM 1,DIM 2,DIM 3,QTE,PCB\n"
            "9,MUR IMPORT CSV,M2,RDC,MACONNERIE CSV,MACONNERIE CSV,CHG,,CIMENT CSV,T,,,,,2,100\n")
        pg.evaluate("""() => { window.__kp758 = JSON.stringify(INS_X.INS); }""".replace("INS_X", ins))
        pg.evaluate("() => { const sh = [...document.querySelectorAll('*')].find(e => e.__ins); sh.__impMenu('budget'); }"); pg.wait_for_timeout(200)
        srcs = pg.evaluate("() => [...document.querySelectorAll('.blk-card [data-src]')].map(b => b.dataset.src).join(',')")
        with pg.expect_file_chooser() as fc:
            pg.evaluate("() => document.querySelector('.blk-card [data-src=\"msp\"]').click()")
        fc.value.set_files(xmlp); pg.wait_for_timeout(700)
        m758 = pg.evaluate("""() => { const c = document.querySelector('.imp-card'); if (!c) return 'pas de fenêtre'; const same = JSON.stringify(INS_X.INS) === window.__kp758;
            return [(document.getElementById('impSrc') || {}).textContent || '', [...c.querySelectorAll('.imp-tabs [data-tab], .imp-tabs button')].map(b => b.textContent.replace(/\\s+/g, ' ').trim()).join('|'), same]; }""".replace("INS_X", ins))
        pg.evaluate("() => document.getElementById('impGo').click()"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('.imp-ask [data-mode=\"add\"]')?.click()"); pg.wait_for_timeout(500)
        a758 = pg.evaluate("""() => { const I = INS_X.INS, S = (I.sec || []).filter(x => /MSP$/.test(x.v)), keys = Object.keys(I.dlp || {}).filter(k => S.some(s => k.endsWith('|' + s.id)));
            const pred = Object.values(I.dpred || {}).flat().length; return [S.length, keys.length, pred > 0]; }""".replace("INS_X", ins))
        pg.evaluate("() => { const sh = [...document.querySelectorAll('*')].find(e => e.__ins); sh.__impMenu('budget'); }"); pg.wait_for_timeout(200)
        pg.evaluate("() => document.querySelector('.blk-card [data-src=\"file\"]').click()"); pg.wait_for_timeout(300)
        with pg.expect_file_chooser() as fc:
            pg.evaluate("() => document.querySelector('#svConf [data-go]').click()")
        fc.value.set_files(csvp); pg.wait_for_timeout(700)
        c758 = pg.evaluate("""() => { const c = document.querySelector('.imp-card'); if (!c) return 'pas de fenêtre'; const r = [(document.getElementById('impSrc') || {}).textContent || '', c.textContent.includes('MUR IMPORT CSV') || [...c.querySelectorAll('.imp-tabs *')].some(b => /DÉSIGNATIONS CLIENT\\s*1/.test(b.textContent))];
            c.querySelector('[data-cancel]').click(); return r; }""")
        e758 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms)), B = document.querySelector('.blk-etp'), r = [];
            for (const k of ['scn', 'ver']) { B.querySelector(`[data-etab="${k}"]`).click(); await w(50); B.querySelector('.blk-more').click(); await w(120);
              r.push([...document.querySelectorAll('#blkMenu button span')].some(x => /^IMPORTER/.test(x.textContent.trim()))); document.getElementById('blkMenu')?.remove(); }
            const X = INS_X, I = X.INS; Object.keys(I).forEach(k => { delete I[k]; }); Object.assign(I, JSON.parse(window.__kp758)); X.insSave(); X.refreshAll(); return r; }""".replace("INS_X", ins))
        check("v758 : import unique — sources (fichier, Google Sheets, MS Project, autre budget) ; MS Project XML lu à blanc puis même fenêtre (budget ouvert inchangé) ; tâches, dates et liaison importées ; CSV au format du budget ; IMPORTER dans SCÉNARIOS, pas dans VERSIONS",
              srcs == "file,gsheet,msp,bdg" and isinstance(m758, list) and "MS PROJECT" in m758[0] and m758[2] is True and a758 == [2, 2, True] and isinstance(c758, list) and "FICHIER" in c758[0] and c758[1] and e758 == [True, False], [srcs, m758, a758, c758, e758])
        # v728 (bloc 9.2) : chute = barres achetées − longueur utile (méthode A), répartie au prorata des QCB du titre ; exemple du 30/10/2026
        t728 = pg.evaluate("""() => { const I = { chg: [{ id: 'a', des: 'ACIER HA12', u: 'KG', q: 60 }, { id: 'b', des: 'ACIER HA12', u: 'KG', q: 40 }],
            prd: [{ id: 'p1', d1: 4.5, nbr: 10 }, { id: 'p2', d1: 2.8, nbr: 6 }, { id: 'p3', d1: 1.2, nbr: 8 }],
            links: [{ chg: [{ id: 'a' }], prd: [{ id: 'p1' }, { id: 'p2' }] }, { chg: [{ id: 'b' }], prd: [{ id: 'p3' }] }],
            cond: { 'ACIER HA12|KG': { mode: 'c', BL: 12, kerf: 0, kgm: 0.888 } } };
            const R = condCut(condPiecesOf(I, I.chg), 12, 0), r = x => Math.round(x * 100) / 100;
            return [R.bars, r(R.need), r(R.chute), r(condChuteOf(I, 'ACIER HA12|KG', I.chg)), r(condChuteRow(I, I.chg[0]) + condChuteRow(I, I.chg[1]))]; }""")
        check("v728 : chute de découpe (7 barres de 12 M pour 71,40 M → 12,60 M = 11,19 KG), répartie sur les lignes du titre", t728 == [7, 71.4, 12.6, 11.19, 11.19], t728)

        # remarque 20 : ligne rangée par son ART
        order = pg.evaluate(f"""() => {{ const X = {ins}; const r = X.INS.des.find(x => x.id === 'd2'); r.art = '1.2'; X.artPlace('d2');
            return X.INS.des.map(x => x.id).join(','); }}""")
        check("ART : ligne rangée à sa place (remarque 20)", order == "t1,d1,d2,d3", order)

        # remarque 23 : TOTAL PARTIEL suit une case cochée dans un autre bloc
        foot = pg.evaluate(f"""() => {{ const X = {ins}; X.INS.sec.find(x => x.id === 's1').on = true; X.insFoots();
            const t = document.querySelector('table.ins-table[data-ik="des"] tfoot'); return t ? t.textContent : 'PAS DE TABLEAU'; }}""")
        check("TOTAL PARTIEL suivant une case cochée ailleurs (remarque 23)", "TOTAL PARTIEL" in foot, foot[:80])
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.sec.forEach(x => x.on = false); X.insFoots(); }}")

        # v593 (remarque longue 3) : le bloc coché en premier garde toute sa liste ; le bloc coché ensuite n'est réduit que par le premier
        lr3 = pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; const sh = [...document.querySelectorAll('*')].find(e => e.__ins); sh.__ckOrd = [];
            const n = k => X.insShown(k).filter(r => !r.t).length, all = k => I[k].filter(r => !r.t).length;
            const s0 = I.des.find(r => !r.t); s0.on = true; X.refreshAll();
            const a = [n('des') === all('des'), n('chg')];
            const c0 = I.chg.find(r => !r.t && X.insShown('chg').includes(r)) || I.chg.find(r => !r.t); c0.on = true; X.refreshAll();
            const b = [n('des') === all('des'), n('chg'), sh.__ckOrd.join(',')];
            s0.on = false; c0.on = false; X.refreshAll(); return [a, b, sh.__ckOrd.length]; }}""")
        check("v593 (remarque longue 3) : DÉSIGNATION CLIENT cochée en premier → sa liste reste entière, même après une charge cochée ; DÉTAIL CHARGES réduit par elle seule",
              lr3[0][0] and lr3[1][0] and lr3[1][1] == lr3[0][1] and lr3[1][2] == "des,chg" and lr3[2] == 0, lr3)
        # remarque 24 : lignes copiées dans Excel collées en bas de DÉSIGNATIONS CLIENT
        n0 = pg.evaluate(f"() => {ins}.INS.des.length")
        pg.evaluate("() => navigator.clipboard.writeText('ART\\tDÉSIGNATION\\tU\\n2\\tENDUIT\\tM2\\n3\\tPEINTURE\\tM2\\tEN TROP')")
        pg.evaluate("() => document.querySelector('.blk-btn[data-blk=\"client\"][data-act=\"paste\"]')?.click()")
        pg.wait_for_timeout(500)
        pg.evaluate("() => document.querySelector('#blkMenu button:not([disabled]) span')?.textContent")
        got = pg.evaluate(f"() => {ins}.INS.des.slice(-2).map(r => r.des + '/' + (r.u || '')).join(',')")
        check("COLLER : lignes d'Excel ajoutées en bas (remarque 24)", got == "ENDUIT/M2,PEINTURE/M2", [n0, got])

        # FORMAT 111 : AGRÉMENT EXIGÉ sur la charge CIMENT (colonne masquée depuis v491 : case posée directement)
        pg.evaluate("() => { const t = document.querySelector('.bdg-d-tab[data-tab=\"chg\"]'); t && t.click(); }")
        pg.wait_for_timeout(500)
        check("DÉTAIL CHARGES : AGRÉMENT EXIGÉ masqué pour l'instant (remarque 3)", not pg.evaluate("() => !!document.querySelector('input.ins-chk')"))
        th = pg.evaluate("() => [...document.querySelectorAll('table.ins-table[data-ik=\"chg\"] thead th')].map(t => t.textContent.trim()).join('|')")
        task = pg.evaluate("() => { const tr = document.querySelector('table.ins-table[data-ik=\"chg\"] tr[data-iid=\"c1\"]'); const i = tr && tr.querySelector('[data-f=\"tache\"]'); return i ? i.value : (tr ? tr.innerText : ''); }")
        check("DÉTAIL CHARGES : colonne TÂCHE (remarque 3)", "TÂCHE" in th and "RDC › BETONNAGE" in task, [th[-80:], task[:80]])
        fit = pg.evaluate("() => { const sc = document.querySelector('.bdg-d-tabbody .bdg-d-scroll') || document.querySelector('table.ins-table[data-ik=\"chg\"]').parentElement; const t = sc.querySelector('table'); return [t.getBoundingClientRect().width, sc.clientWidth]; }")
        check("DÉTAIL CHARGES : tableau dans la largeur du bloc (remarque 3)", fit[0] <= fit[1] + 1, fit)
        # v626 : activités jumelles renommées en doublon — une seule fenêtre DOUBLON, la secondaire ET sa primaire fusionnées ;
        # ↶ ne remet jamais l'état avec le doublon ; un doublon présent est signalé dans ⚠
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; window.__z6 = JSON.stringify([I.sec, I.prim]); I.sec.push({{ id: 'zs1', v: 'ZZ UN', u: 'M2' }}, {{ id: 'zs2', v: 'ZZ DEUX', u: 'M2' }}); I.prim.push({{ id: 'zp1', v: 'ZZ UN', tw: 'zs1' }}, {{ id: 'zp2', v: 'ZZ DEUX', tw: 'zs2' }}); X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(1200)
        pg.evaluate("""() => { const i = document.querySelector('.ins-hcol[data-ik="sec"] .ins-li[data-iid="zs2"] input.ins-in[data-f="v"]'); if (!i) return; i.focus(); i.value = 'ZZ UN'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }"""); pg.wait_for_timeout(600)
        z1 = pg.evaluate("() => (document.querySelector('#svConf .svc-t') || {}).textContent || ''")
        pg.evaluate("() => document.querySelector('#svConf [data-v=\"merge\"]')?.click()"); pg.wait_for_timeout(1000)
        z2 = pg.evaluate(f"() => {{ const I = {ins}.INS; return [!!document.querySelector('#svConf'), I.sec.filter(r => /^ZZ/.test(r.v)).length, I.prim.filter(r => /^ZZ/.test(r.v)).length]; }}")
        pg.evaluate("() => document.getElementById('instUndo')?.click()"); pg.wait_for_timeout(700)
        z3 = pg.evaluate(f"() => {{ const I = {ins}.INS; const n = k => {{ const S = I[k].filter(r => /^ZZ/.test(r.v)).map(r => r.v); return S.length - new Set(S).size; }}; return [n('sec'), n('prim')]; }}")
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.prim.push({{ id: 'zp9', v: 'ZZ NEUF' }}, {{ id: 'zp8', v: 'ZZ NEUF' }}); X.refreshAll(); }}"""); pg.wait_for_timeout(500)
        z4 = pg.evaluate("() => { const t = document.querySelector('#instTodo b'); return t ? t.textContent : ''; }")
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; const B = JSON.parse(window.__z6); I.sec = B[0]; I.prim = B[1]; X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(400)
        check("v626 : jumelles renommées en doublon — une seule fenêtre, secondaire et primaire fusionnées ; ↶ sans doublon ; doublon compté dans ⚠",
              z1 == "DOUBLON" and z2 == [False, 1, 1] and z3 == [0, 0] and z4 != "", [z1, z2, z3, z4])
        # v642 (refonte, étape 2) : EFFACER TOUS LES FILTRES efface toutes les sources — cases, plage DÉBUT – FIN, CHARGES QUI FONT, ISOLER, filtre du jour
        ef = pg.evaluate(f"""async () => {{ const X = {ins}; const I = X.INS; const sh = [...document.querySelectorAll('*')].find(e => e.__insClrAll);
            I.chg[0].on = true; I.hrange = {{ ...(I.hrange || {{}}), a: '2026-10-05', b: '2026-10-09' }}; I.chgPar = 50; I.mgPar = 50; sh.__dlyXF = {{ hr: 'null', on: [] }}; X.insSave(); X.refreshAll();
            await new Promise(r => setTimeout(r, 300));
            const dot0 = document.querySelector('#instTodo')?.classList.contains('flt');
            sh.__insClrAll(); await new Promise(r => setTimeout(r, 300));
            const R = I.hrange || {{}};
            return [dot0, I.chg.some(r => r.on === true), !!(R.a || R.b), !!(I.chgPar || I.mgPar), !!sh.__dlyXF, document.querySelector('#instTodo')?.classList.contains('flt')]; }}""")
        check("v642 : EFFACER TOUS LES FILTRES — cases, plage, CHARGES QUI FONT et filtre du jour effacés, plus de point bleu", ef == [True, False, False, False, False, False], ef)
        # v658 (FORMAT 247) : MARGES QUI FONT n % — liaisons classées par marge en valeur absolue, les plus fortes jusqu'à n % ; filtre des autres blocs ; EFFACER l'enlève
        mp = pg.evaluate(f"""async () => {{ const X = {ins}; const I = X.INS; const sh = [...document.querySelectorAll('*')].find(e => e.__insClrAll);
            const L = (I.links || []).length; I.mgPar = 1; X.insSave(); X.refreshAll(); await new Promise(r => setTimeout(r, 300));
            const fa = JSON.stringify(sh.__filtActs ? sh.__filtActs() : []), tab = !!document.querySelector('.bdg-d-tab[data-tab="lnk"].tab-filt');
            sh.__insClrAll(); await new Promise(r => setTimeout(r, 300));
            return [L > 0, fa.includes('MARGES QUI FONT 1 %'), tab, !!I.mgPar]; }}""")
        check("v658 : MARGES QUI FONT n % — filtre actif (onglet MARGE en bleu, FILTRES ACTIFS), EFFACER TOUS LES FILTRES l'enlève", mp == [True, True, True, False], mp)
        # v613 (point 8) : colonne % = part du total des charges retenues — les lignes affichées (titres repliés compris) font 100 %
        pc = pg.evaluate("""() => { const t = document.querySelector('table.ins-table[data-ik="chg"]'); if (!t) return null; const hs = [...t.tHead.rows[0].cells].map(c => c.textContent.trim()); const i = hs.findIndex(h => h.startsWith('%')); if (i < 0) return ['nocol', hs.join('|')];
            const v = [...t.tBodies[0].rows].filter(tr => !tr.classList.contains('ins-new')).map(tr => tr.cells[i] && ((tr.cells[i].querySelector('input') || {}).value || tr.cells[i].textContent).replace(/\u202f|\s|%/g, '').replace(',', '.')).filter(x => x).map(Number);
            return [hs[i + 1], Math.round(v.reduce((a, b) => a + b, 0) * 10) / 10, v.length]; }""")
        check("v613 : DÉTAIL CHARGES — colonne % avant RENDEMENT ; les lignes affichées font 100 %", bool(pc) and pc[0].startswith("RENDEMENT") and abs(pc[1] - 100) < 0.2 and pc[2] > 0, pc)
        # v621 / v622 : CHARGES QUI FONT 50 % = filtre — seules les plus grosses lignes jusqu'à 50 % du total restent (sans la dernière : moins de 50 %)
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.chgPar = 50; X.refreshAll(); }}"); pg.wait_for_timeout(500)
        par = pg.evaluate("""() => { const t = document.querySelector('table.ins-table[data-ik="chg"]'); const hs = [...t.tHead.rows[0].cells].map(c => c.textContent.trim()); const i = hs.findIndex(h => /^[›⌄]?\s*%/.test(h));
            const val = tr => Number(((tr.cells[i].querySelector('input') || {}).value || tr.cells[i].textContent).replace(/\u202f|\s|%/g, '').replace(',', '.')) || 0;
            const v = [...t.tBodies[0].rows].filter(tr => !tr.classList.contains('ins-new') && !(tr.classList.contains('ins-grp') && !tr.classList.contains('ins-gtitle') && false)).filter(tr => tr.cells[i]).map(val).filter(x => x > 0).sort((a, b) => b - a);
            const s = v.reduce((a, b) => a + b, 0); return [v.length, Math.round(s * 10) / 10, Math.round((s - (v[v.length - 1] || 0)) * 10) / 10]; }""")
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.chgPar = ''; X.refreshAll(); }}"); pg.wait_for_timeout(300)
        check("v622 : CHARGES QUI FONT 50 % = filtre — il reste les plus grosses charges jusqu'à 50 % (sans la dernière : moins de 50 %)", bool(par) and par[0] > 0 and par[1] >= 49.9 and par[2] < 50, par)
        # remarque 5 : Entrée descend dans la colonne (tableau DÉTAIL CHARGES)
        pg.focus('table.ins-table[data-ik="chg"] tr[data-iid="c1"] input.ins-in[data-f="q"]'); pg.keyboard.press("Enter"); pg.wait_for_timeout(200)
        dn = pg.evaluate("() => { const a = document.activeElement; return a && a.closest('tr') ? [a.closest('tr').dataset.iid, a.dataset.f] : null; }")
        check("remarque 5 : Entrée = case du dessous (même colonne)", dn == ["c2", "q"], dn)
        pg.evaluate(f"""() => {{ const X = {ins}; X.INS.chg.find(c => c.id === 'c1').agr = true; X.insSave(); }}""")
        pg.wait_for_timeout(300)
        auto = pg.evaluate(f"""() => {{ const X = {ins}; const L = (X.INS.qq && X.INS.qq.T && X.INS.qq.T['l1|s1']) || [];
            const i = L.findIndex(n => n.k === 't' && n.v === 'MATIÈRE'); const p = L.find(n => n.k === 'p' && n.auto === 'agr');
            return {{ mat: i, p: p ? p.v : null, pIdx: L.indexOf(p), c: L.filter(n => n.k === 'c' && n.auto === 'agr').length }}; }}""")
        check("AGRÉMENT EXIGÉ : « AGRÉMENT FOURNI » ajouté sous MATIÈRE (FORMAT 111)", auto["p"] == "AGRÉMENT FOURNI — CIMENT" and auto["pIdx"] > auto["mat"] >= 0 and auto["c"] == 1, auto)
        pg.evaluate(f"""() => {{ const X = {ins}; X.INS.chg.find(c => c.id === 'c1').qex = 'SOUDEUR CERTIFIÉ'; X.insSave(); }}""")
        q = pg.evaluate(f"() => ({ins}.INS.qq.T['l1|s1'] || []).filter(n => n.auto === 'qex').map(n => n.v).join(' / ')")
        check("QUALIFICATION EXIGÉE : « HABILITATION VÉRIFIÉE » ajouté (FORMAT 111)", "HABILITATION VÉRIFIÉE — CIMENT" in q and "SOUDEUR CERTIFIÉ" in q, q)
        if os.environ.get("SVI_SHOTS"):
            pg.evaluate("() => { const t = document.querySelector('.bdg-d-tab[data-tab=\"qlt\"]'); t && t.click(); }"); pg.wait_for_timeout(300)
            pg.screenshot(path=os.environ["SVI_SHOTS"] + "/qlt.png", full_page=True)
        pg.evaluate(f"""() => {{ const X = {ins}; const c = X.INS.chg.find(c => c.id === 'c1'); c.agr = false; c.qex = ''; X.insSave(); }}""")
        n_auto = pg.evaluate(f"() => ({ins}.INS.qq.T['l1|s1'] || []).filter(n => n.auto).length")
        check("case vidée : contrôles d'office retirés (FORMAT 111)", n_auto == 0, n_auto)

        # FORMAT 112 : PAQ dans le menu ⋯ du haut, aperçu sans prix
        pg.evaluate("() => { const s = [...document.querySelectorAll('*')].find(e => e.__paq); s && s.__paq(); }")
        pg.wait_for_timeout(300)
        win = pg.evaluate("() => document.querySelector('#svConf .svc-t')?.textContent || ''")
        check("PAQ : fenêtre DÉMARCHE QUALITÉ (FORMAT 112)", "DÉMARCHE QUALITÉ" in win, win)
        pg.evaluate("() => document.querySelector('#svConf .svc-ok').click()")
        pv = MepView(pg); pv.wait_for_timeout(1200)
        txt = pv.evaluate("() => document.body.innerText")
        okp = all(x in txt for x in ["PLAN D'ASSURANCE QUALITÉ", "1. DÉMARCHE QUALITÉ", "2. DÉCOMPOSITION DU PROJET", "3. PLANNING", "4. POINTS DE CONTRÔLE", "5. MATÉRIAUX ET AGRÉMENTS", "BETON B25"])
        check("PAQ : aperçu avec ses cinq parties (FORMAT 112)", okp, txt[:300])
        check("PAQ : aucun prix (1 000,00 / 1 500,00 absents)", "1 000,00" not in txt and "1 500,00" not in txt and "1000,00" not in txt)
        if os.environ.get("SVI_SHOTS"): pv.screenshot(path=os.environ["SVI_SHOTS"] + "/paq.png", full_page=False)
        pv.close()

        # FORMAT 132 : RÉGLAGES QUALITÉ du budget → valeurs reçues par un nouveau critère (FORMAT 131)
        qq = "(() => { const s = [...document.querySelectorAll('*')].find(e => e.__qq); return s && s.__qq; })()"
        pg.evaluate("() => { const t = document.querySelector('.bdg-d-tab[data-tab=\"qlt\"]'); t && t.click(); }"); pg.wait_for_timeout(300)
        pg.evaluate(f"() => {qq}.cfg()"); pg.wait_for_timeout(200)
        pg.evaluate("""() => { const d = document.getElementById('svConf'); d.querySelector('.qq-cnra').value = '1'; d.querySelector('.qq-cnrz').value = '5'; d.querySelector('.svc-ok').click(); }""")
        cfg = pg.evaluate(f"() => JSON.stringify({ins}.INS.qq.cfg)")
        check("RÉGLAGES QUALITÉ enregistrés (FORMAT 132)", cfg == '{"nra":1,"nrz":5}', cfg)
        typ = """([sel, v]) => { const i = document.querySelector(sel); if (!i) return false; i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); return true; }"""
        okp = pg.evaluate(typ, ['tr.qq-new[data-kind="p"] .qq-nin', "POINT ESSAI"]); pg.wait_for_timeout(200)
        okc = pg.evaluate(typ, ['tr.qq-new[data-kind="c"] .qq-nin', "CRITÈRE ESSAI"]); pg.wait_for_timeout(200)
        crit = pg.evaluate(f"() => {{ const c = ({ins}.INS.qq.M || []).find(n => n.k === 'c' && n.v === 'CRITÈRE ESSAI'); return c ? [c.nra, c.nrz] : null; }}")
        check("nouveau critère : valeurs par défaut du budget (FORMAT 131)", okp and okc and crit == [1, 5], [okp, okc, crit])
        th = pg.evaluate("() => [...document.querySelectorAll('.qq-table thead th')].map(t => t.textContent).join('|')")
        check("colonne CONTRÔLES SANS REMARQUE (FORMAT 131)", "CONTRÔLES SANS REMARQUE" in th, th[-120:])

        # import / export QUALITÉ : une ligne par critère, aller-retour
        rt = pg.evaluate(f"""() => {{ const Q = {qq}.io; const rows = Q.exp(); const r = rows.find(x => x[5] === 'CRITÈRE ESSAI');
            const aoa = [Q.head, ...rows, ['PROJET TEST', 'RDC', 'BETONNAGE', 'CHANTIER / MÉTHODE', 'VIBRATION', 'AIGUILLE PASSÉE', '', '', 'ART. 4.2', 'VISUEL', 'INTÉRIEUR', 'PHOTO', 'CHANTIER › COULAGE', '', '1', 'BUREAU DE CONTRÔLE', 'TAF', '', '', '2', '3'],
              ['PROJET TEST', 'LOT INCONNU', 'BETONNAGE', 'CHANTIER', 'X', 'Y']];
            const n = Q.imp(aoa, true); const X = {ins};
            const M = X.INS.qq.M.find(n => n.v === 'CRITÈRE ESSAI'); const T = (X.INS.qq.T['l1|s1'] || []).find(n => n.v === 'AIGUILLE PASSÉE');
            const ti = (X.INS.qq.T['l1|s1'] || []).findIndex(n => n.k === 't' && n.v === 'MÉTHODE');
            return {{ exported: !!r, n, M: M ? [M.nra, M.nrz] : null, T: T ? [T.how, T.who, T.proof, T.nc, T.pv, T.pw, T.nra, T.nrz, (T.btn || []).join()] : null, under: ti >= 0 && (X.INS.qq.T['l1|s1'] || []).indexOf(T) > ti }}; }}""")
        check("QUALITÉ : export puis import d'un critère (modèle commun)", rt["exported"] and rt["M"] == [1, 5], rt)
        check("QUALITÉ : import d'un critère de tâche sous CHANTIER / MÉTHODE", rt["T"] == ["VISUEL", "INTÉRIEUR", "PHOTO", "TAF", 1, "BUREAU DE CONTRÔLE", 2, 3, "CHANTIER › COULAGE"] and rt["under"], rt)
        pg.wait_for_timeout(500)
        al = pg.evaluate("() => document.body.innerText.includes('LOT INCONNU') ")
        check("QUALITÉ : tâche inconnue refusée et signalée", rt["n"] == 2 and al, [rt["n"], al])
        pg.evaluate("() => document.querySelectorAll('#svConf .svc-close, #svConf [data-r=\"0\"], .sva-ok, [data-cancel]').forEach(b => { try { b.click(); } catch (e) {} })")

        # remarques 37 à 39 (v498) : onglet MARGE (remplace LIAISONS VALIDÉES et EXPLOITATION), regroupement par les en-têtes
        tb = pg.evaluate("() => [...document.querySelectorAll('#bdgTabs .bdg-d-tab')].map(t => t.dataset.tab + ':' + t.textContent.trim())")
        check("remarque 37 : un seul onglet MARGE (INDICATEURS depuis v692), avec le compteur des liaisons (plus de LIAISONS VALIDÉES ni d'EXPLOITATION)", any(x.startswith("lnk:TABLEAU DE BORD") and x.endswith("1") for x in tb) and not any("xpl" in x or "LIAISONS VALIDÉES" in x for x in tb), tb)
        pg.evaluate("() => { const t = document.querySelector('.bdg-d-tab[data-tab=\"lnk\"]'); t && t.click(); }"); pg.wait_for_timeout(400)
        xr = pg.evaluate("() => { const t = document.querySelector('.mg-table'); if (!t) return null; return [[...t.tHead.rows[0].cells].map(c => c.textContent.trim()), [...t.tBodies[0].rows].map(tr => [...tr.cells].map(c => c.textContent.replace(/ /g, ' ').trim()))]; }")
        okx = bool(xr) and any("BETON EN FONDATION" in " ".join(r) and "M2" not in r and "4 500,00" in r and "10 000,00" in r and "5 500,00" in r and "100,00 %" in r for r in xr[1]) and "PRODUITS" in " ".join(xr[0]) and "QUANTITÉ" not in " ".join(xr[0]) and "PPB" not in " ".join(xr[0])
        m64 = pg.evaluate("() => { const td = document.querySelector('.mg-table tbody td[data-k=\"mg\"]'); return td ? td.getAttribute('style') || '' : ''; }")
        check("remarque 64 : colonne MARGE en dégradé de couleur", "hsl(" in m64, m64)
        check("remarque 37 / v613 : MARGE — une ligne par liaison : charges 4 500, produits 10 000, marge 5 500, 100 % (part de la marge totale)", okx, xr)
        # remarque 46 : regroupement = ordre des colonnes (désignation, lot, activités) ; unités collées ; TOUT DÉPLIER
        g1 = pg.evaluate("() => [...document.querySelector('.mg-table').tBodies[0].rows].map(r => r.className)")
        pg.evaluate("() => document.querySelector('.mg-table tr.mg-grp td[data-k=\"pct\"]')?.click()"); pg.wait_for_timeout(300)
        g52 = pg.evaluate("() => document.querySelector('.mg-table').tBodies[0].rows.length")
        pg.evaluate("() => document.querySelector('.mg-table tr.mg-grp td[data-k=\"mg\"]')?.click()"); pg.wait_for_timeout(300)
        g52b = pg.evaluate("() => document.querySelector('.mg-table').tBodies[0].rows.length")
        check("remarque 52 : toucher la case % (ou MARGE) d'une ligne regroupée = déplier / replier", g52 == 2 and g52b == 1, [g52, g52b])
        pg.evaluate("() => document.querySelector('#bdgDetailHead .blk-more')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('#blkMenu [data-mgf=\"open\"]')?.click()"); pg.wait_for_timeout(300)
        g2 = pg.evaluate("() => [...document.querySelector('.mg-table').tBodies[0].rows].map(r => r.className)")
        pg.evaluate("""() => { const o = JSON.parse(localStorage.getItem('svi_colorder_v1') || '{}'); o.lk_marge = ['lot', 'art', 'des', 'upb', 'prim', 'sec', 'su', 'chg', 'prd', 'mg', 'pct']; localStorage.setItem('svi_colorder_v1', JSON.stringify(o)); }""")
        pg.evaluate(f"() => {ins}.refreshAll()"); pg.wait_for_timeout(300)
        g3 = pg.evaluate("() => { const t = document.querySelector('.mg-table'); return [[...t.tHead.rows[0].cells].map(c => (c.querySelector('.cf-btn') || {}).dataset?.col).filter(Boolean), t.tBodies[0].rows[0].textContent.replace(/\\s+/g, ' ').trim()]; }")
        pg.evaluate("""() => { const o = JSON.parse(localStorage.getItem('svi_colorder_v1') || '{}'); o.lk_marge = ['lot', 'upb', 'art', 'su', 'des', 'prim', 'sec', 'chg', 'prd', 'mg', 'pct']; localStorage.setItem('svi_colorder_v1', JSON.stringify(o)); }""")
        pg.evaluate(f"() => {ins}.refreshAll()"); pg.wait_for_timeout(300)
        g4 = pg.evaluate("() => [...document.querySelector('.mg-table').tHead.rows[0].cells].map(c => (c.querySelector('.cf-btn') || {}).dataset?.col).filter(Boolean)")
        pg.evaluate("""() => { const o = JSON.parse(localStorage.getItem('svi_colorder_v1') || '{}'); delete o.lk_marge; localStorage.setItem('svi_colorder_v1', JSON.stringify(o)); }""")
        pg.evaluate(f"() => {ins}.refreshAll()"); pg.wait_for_timeout(300)
        check("remarques 46 et 60 : regroupement par l'ordre des colonnes, TOUT DÉPLIER (activité primaire jumelle = liaison), unités collées",
              g1 == ["mg-grp mg-l0 mg-b0"] and g2 == ["mg-grp mg-l0 mg-b0", "mg-grp mg-l1 mg-b0", "mg-leaf mg-l2 mg-b0"] and g3[0][0] == "lot" and g3[1].startswith("⌄ RDC") is False and "RDC" in g3[1]
              and g4[:6] == ["lot", "art", "des", "upb", "prim", "sec"] and g4[6] == "su", [g1, g2, g3, g4])
        # remarque 48 : toucher l'en-tête % = croissant ▲, décroissant ▼, normal
        def tap_pct():
            box = pg.evaluate("() => { const th = [...document.querySelector('.mg-table').tHead.rows[0].cells].find(c => (c.querySelector('.cf-btn') || {}).dataset?.col === 'pct'); th.scrollIntoView({ block: 'center', inline: 'center' }); const r = th.querySelector('.cf-lab').getBoundingClientRect(); return [r.left + 4, r.top + r.height / 2]; }")
            pg.mouse.click(box[0], box[1]); pg.wait_for_timeout(300)
            return pg.evaluate("() => { const X = [...document.querySelectorAll('*')].find(e => e.__mg).__mg; const s = X.sorted(); return s ? s.col + s.dir : ''; }")
        s48 = [tap_pct(), tap_pct(), tap_pct()]
        check("remarque 48 : toucher % = croissant, décroissant, ordre normal", s48 == ["pct1", "pct-1", ""], s48)
        # case d'une liaison : filtre les autres blocs
        pg.evaluate("() => document.querySelector('.mg-table input.mg-gcb')?.click()"); pg.wait_for_timeout(400)
        dd = pg.evaluate("() => [...document.querySelectorAll('#bdgClientBody tr[data-iid]')].filter(t => !t.classList.contains('ins-title')).map(t => t.dataset.iid)")
        check("remarque 37 : case d'une liaison de MARGE filtre les désignations", dd == ["d1"], dd)
        pg.evaluate("() => { const t = document.querySelector('.bdg-d-tab[data-tab=\"lnk\"]'); t && t.click(); }"); pg.wait_for_timeout(300)
        ck = pg.evaluate("() => !!document.querySelector('.mg-table tr.mg-grp.mg-ck')")
        check("remarque 54 : ligne pliée qui contient une liaison cochée en bleu", ck, ck)
        pg.evaluate("() => document.querySelector('.mg-table input.mg-gcb:checked')?.click()"); pg.wait_for_timeout(300)
        # remarques 40 à 42 (v499) : onglet filtré en bleu, colonne des cases en bleu, EFFACER TOUS LES FILTRES
        pg.evaluate(f"""() => {{ const X = {ins}; X.INS.chg.find(r => r.id === 'c2').on = true; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        f40 = pg.evaluate("() => [...document.querySelectorAll('#bdgTabs .bdg-d-tab.tab-filt')].map(b => b.dataset.tab).sort()")
        pg.evaluate("() => { const t = document.querySelector('.bdg-d-tab[data-tab=\"chg\"]'); t && t.click(); }"); pg.wait_for_timeout(400)
        f41 = pg.evaluate("() => !!document.querySelector('table.ins-table[data-ik=\"chg\"] thead th.cb-filt')")
        pg.evaluate("() => document.querySelector('#bdgDetailHead .blk-more')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('#blkMenu [data-fclr]')?.click()"); pg.wait_for_timeout(400)
        f42 = pg.evaluate(f"""() => {{ const X = {ins}; return [X.INS.chg.some(r => r.on === true), document.querySelectorAll('#bdgTabs .bdg-d-tab.tab-filt').length]; }}""")
        check("remarques 40 à 42 et 53 : seul l'onglet source du filtre en bleu, en-tête des cases en bleu, EFFACER TOUS LES FILTRES", f40 == ["chg"] and f41 and f42 == [False, 0], [f40, f41, f42])
        # remarque 59 (remplacée en v528) : lot choisi par son rond — la liste ne change plus d'ordre
        pg.evaluate("() => document.querySelector('.ins-hcol[data-ik=\"lot\"] .ins-li[data-iid=\"l1\"] .lk-rd')?.click()"); pg.wait_for_timeout(400)
        o59 = pg.evaluate("() => [...document.querySelectorAll('.ins-hcol[data-ik=\"lot\"] .ins-li[data-iid]')].map(x => x.dataset.iid)")
        pg.evaluate("() => document.querySelector('.ins-hcol[data-ik=\"lot\"] .ins-li[data-iid=\"l1\"] .lk-rd')?.click()"); pg.wait_for_timeout(300)
        # v528 (remarque 3) : la liste des lots garde désormais son ordre quand on choisit un lot
        check("remarque 59 → v528 : lot choisi, la liste des lots garde son ordre", bool(o59) and o59.index("l1") > o59.index("l2"), o59)
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"dly\"]')?.click()"); pg.wait_for_timeout(800)
        # v736 : DÉBUT du PLANNING — 1er toucher = case sélectionnée (cadre, pas de calendrier), 2e toucher = calendrier
        k736 = pg.evaluate(("() => { const X = INS_X, I = X.INS, L = I.links[0]; window.__k736 = JSON.stringify(I.dlp || null); I.dlp = { ...(I.dlp || {}), [L.lot + '|' + L.sec]: [{ id: 'p736', deb: '2026-11-02', fin: '2026-11-05' }] }; X.insSave(); X.refreshAll(); return 1; }").replace("INS_X", ins))
        pg.wait_for_timeout(500)
        d736 = []
        if pg.evaluate("() => !!document.querySelector('.dly-table input.dlp-in[data-f=deb]')"):
            for _ in range(2):
                pg.click(".dly-table input.dlp-in[data-f=deb]"); pg.wait_for_timeout(350)
                d736.append(pg.evaluate("() => [!!document.getElementById('svCal'), (document.getElementById('sviSelFrame') || { style: {} }).style.display]"))
        pg.evaluate("() => document.getElementById('svCal')?.remove()")
        pg.evaluate(("() => { const X = INS_X, K = JSON.parse(window.__k736); if (K) X.INS.dlp = K; else delete X.INS.dlp; X.insSave(); X.refreshAll(); }").replace("INS_X", ins)); pg.wait_for_timeout(300)
        check("v736 : DÉBUT du PLANNING — 1er toucher = cadre sans calendrier, 2e toucher = calendrier", d736 == [[False, "block"], [True, "block"]], d736)
        # v734 : GÉNÉRER / COMPRESSER visent la DATE OBJECTIF — capacité proposée (MAÇON 2 → 4), APPLIQUER = fin à l'objectif
        c734 = pg.evaluate("""async () => { const X = INS_X, I = X.INS, DX = DXJ_, w = ms => new Promise(z => setTimeout(z, ms));
            const keep = JSON.stringify(I); ['dbut', 'hrange', 'chgPar', 'mgPar', 'dlim', 'dcut', 'inc', 'dinc', 'plaf', 'plafs', 'cmd', 'appro', 'dord'].forEach(x => delete I[x]); I.chg.forEach(r => { delete r.on; }); (I.prd || []).forEach(r => { delete r.on; });
            const L = I.links[0], k = L.lot + '|' + L.sec;
            I.chg = I.chg.concat([{ id: 'mo734', des: 'MACON 734', u: 'JH', q: 20, p: 200 }]); I.links = [{ ...L, chg: (L.chg || []).concat([{ id: 'mo734' }]) }]; I.dpred = {};
            I.gdeb = '2026-11-02'; I.dlp = { [k]: [{ id: 'p734', deb: '2026-11-02', fin: '2026-11-03' }] }; I.plafR = { 'MACON 734|J-H': { plaf: 2 } }; I.dobj = '2026-11-06';
            X.insSave(); X.refreshAll(); await w(400); DX.comp(); await w(500);
            const d = document.getElementById('svConf'), t = d ? d.innerText.replace(/\\s+/g, ' ') : '';
            d && d.querySelector('[data-objok]') && d.querySelector('[data-objok]').click(); await w(500);
            const r = [/DATE OBJECTIF/.test(t), /OBJECTIF ATTEINT/.test(t), String((I.plafR['MACON 734|J-H'] || {}).plaf), ((I.dlp[k] || [])[0] || {}).fin];
            document.getElementById('svConf')?.remove(); const K = JSON.parse(keep); Object.keys(I).forEach(x => { if (!(x in K)) delete I[x]; }); Object.assign(I, K); X.insSave(); X.refreshAll(); return r; }""".replace("DXJ_", "[...document.querySelectorAll('*')].find(e => e.__insDly).__insDly").replace("INS_X", ins))
        check("v734 : DATE OBJECTIF visée — capacité proposée 2 → 4, APPLIQUER = fin le 06/11/2026", c734 == [True, True, "4", "2026-11-06"], c734)
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"chg\"]')?.click()"); pg.wait_for_timeout(400)
        # remarque 70 : condition sur une colonne de nombres (QCB > 3,5)
        pg.evaluate("() => { const t = document.querySelector('.bdg-d-tab[data-tab=\"chg\"]'); t && t.click(); }"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('.cf-btn[data-cf=\"chg\"][data-col=\"qty\"]')?.click()"); pg.wait_for_timeout(300)
        c70 = pg.evaluate("() => { const m = document.getElementById('cfMenu'); const op = m && m.querySelector('.cf-op'); if (!op) return null; op.value = 'gt'; op.dispatchEvent(new Event('change', { bubbles: true })); m.querySelector('.cf-ca[data-n=\"a\"]').value = '3,5'; m.querySelector('.cf-ok').click(); return true; }")
        pg.wait_for_timeout(400)
        r70 = pg.evaluate("() => [...document.querySelectorAll('table.ins-table[data-ik=\"chg\"] tbody tr[data-iid]')].map(t => t.dataset.iid)")
        pg.evaluate("() => document.querySelector('.cf-btn[data-cf=\"chg\"][data-col=\"qty\"]')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('#cfMenu .cf-clear')?.click()"); pg.wait_for_timeout(200)
        pg.evaluate("() => document.querySelector('#cfMenu .cf-ok')?.click()"); pg.wait_for_timeout(300)
        r70b = pg.evaluate("() => document.querySelectorAll('table.ins-table[data-ik=\"chg\"] tbody tr[data-iid]').length")
        check("remarque 70 : condition SUPÉRIEUR À sur une colonne de nombres", c70 and r70 == ["c2"] and r70b >= 2, [c70, r70, r70b])
        # remarque 38 : RENDEMENT dans DÉTAIL CHARGES, avant TÂCHE
        pg.evaluate("() => { const t = document.querySelector('.bdg-d-tab[data-tab=\"chg\"]'); t && t.click(); }"); pg.wait_for_timeout(400)
        rd = pg.evaluate("""() => { const t = document.querySelector('table.ins-table[data-ik="chg"]'); const hs = [...t.tHead.rows[0].cells].map(c => c.textContent.trim());
            const i = hs.findIndex(h => h.startsWith('RENDEMENT')); const tr = t.querySelector('tr[data-iid="c1"]'); const c = tr && tr.cells[i];
            return [i >= 0 && hs[i + 1].startsWith('TÂCHE'), c ? (c.querySelector('input') ? c.querySelector('input').value + ' ' + (c.querySelector('.ins-rdbu') || { textContent: '' }).textContent : c.textContent).trim() : null]; }""")
        check("remarque 38 : DÉTAIL CHARGES — colonne RENDEMENT avant TÂCHE : 3,33 M3 / T", rd == [True, "3,33 M3 / T"], rd)
        fitx = pg.evaluate("() => { const b = document.getElementById('bdgTabs'); return [b.scrollWidth, b.clientWidth]; }")
        check("remarque 25 : tous les onglets du bloc visibles sans balayer", fitx[0] <= fitx[1] + 1, fitx)
        # remarque 34 : à la largeur de l'iPad, avec une largeur d'onglet mémorisée trop grande, tous les onglets restent entiers
        pg.evaluate("() => localStorage.setItem('svi_tabw_v1', JSON.stringify({ '#bdgTabs': 220 }))")
        pg.set_viewport_size({"width": 1000, "height": 820}); pg.wait_for_timeout(400)
        t34 = pg.evaluate("() => { const b = document.getElementById('bdgTabs'); const ts = [...b.querySelectorAll('.bdg-d-tab')].filter(t => t.offsetParent !== null); const tools = b.getBoundingClientRect(); return [b.scrollWidth <= b.clientWidth + 1, ts.every(t => t.scrollWidth <= t.clientWidth + 1), ts.every(t => t.getBoundingClientRect().right <= tools.right + 1)]; }")
        pg.evaluate("() => localStorage.removeItem('svi_tabw_v1')")
        pg.set_viewport_size({"width": 1180, "height": 820}); pg.wait_for_timeout(300)
        check("remarque 34 : onglets entiers à la largeur de l'iPad (aucun intitulé coupé)", t34 == [True, True, True], t34)

        # remarque 2 : intitulés presque identiques
        dx = "(() => { const s = [...document.querySelectorAll('*')].find(e => e.__dupX); return s && s.__dupX; })()"
        nr = pg.evaluate(f"""() => {{ const X = {dx}; const t = (a, b) => X.isNear(a, b);
            return [t('ENDUI 20', 'ENDUIT 20'), t('ÉTANCHÉITÉ', 'ETANCHIETE'), t('ETANCHEITE', 'ETANCHIETE'), t('10 - ETANCHEITE LEGERE', '10- ETANCHÉITÉ LÉGÈRE'),
                    t('ENDUIT 10', 'ENDUIT 20'), t('MUR 1', 'MUR 2'), t('BETONNAGE', 'COFFRAGE'), t('RDC', 'RDCX'), t('BETONNAGE', 'BETONNAGE')]; }}""")
        check("remarque 2 : intitulés proches reconnus, nombres et mots différents écartés", nr == [True, True, True, True, False, False, False, False, False], nr)
        typ2 = """([sel, v]) => { const i = document.querySelector(sel); if (!i) return false; i.focus(); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); return true; }"""
        pg.evaluate(typ2, ['.ins-hcol[data-ik="sec"] .ins-new input.ins-in[data-f="v"]', "COFRAGE"]); pg.wait_for_timeout(500)
        tt = pg.evaluate("() => document.querySelector('#svConf .svc-t')?.textContent || ''")
        check("remarque 2 : saisie COFRAGE → « VOULEZ-VOUS DIRE « COFFRAGE » ? »", "VOULEZ-VOUS DIRE « COFFRAGE »" in tt, tt)
        if "VOULEZ" in tt:
            pg.evaluate("() => [...document.querySelectorAll('#svConf [data-v]')].find(b => b.dataset.v === 'keep').click()"); pg.wait_for_timeout(300)
        nsec = pg.evaluate(f"() => {ins}.INS.sec.filter(r => r.v === 'COFRAGE').length")
        check("remarque 2 : GARDER LA NOUVELLE garde COFRAGE", nsec == 1, nsec)

        # remarque 1 : fenêtre avec la combinaison complète « DÉSIGNATION / LOT / ACT. PRIMAIRE / ACT. SECONDAIRE »
        w1 = pg.evaluate(f"""() => {{ const X = {dx}; const P = X.INS.prd; const r = {{ id: 'tmpx', des: 'BETON B25X', u: 'M3', nbr: 1 }}; X.nearAsk('prd', P.find(p => p.id === 'x1'), r); return document.querySelector('#svConf')?.innerText || ''; }}""")
        if os.environ.get("SVI_SHOTS"): pg.screenshot(path=os.environ["SVI_SHOTS"] + "/near.png")
        check("remarque 1 : combinaison complète et NON LIÉ dans la fenêtre", "BETON EN FONDATION / RDC / BETONNAGE / BETONNAGE" in w1 and "NON LIÉ" in w1 and "QPB" in w1, w1[:300])
        pg.evaluate("() => [...document.querySelectorAll('#svConf [data-v]')].find(b => b.dataset.v === 'keep')?.click()"); pg.wait_for_timeout(200)

        # remarque 3 : liste longue affichée en entier, défilement à mi-écran
        lst = pg.evaluate("""() => { svConfirm({ title: 'ESSAI', html: '<ul class="svc-list">' + Array.from({ length: 30 }, (_, i) => '<li>LIGNE ' + i + '</li>').join('') + '</ul>' });
            const ul = document.querySelector('#svConf .svc-list'); const r = { n: ul ? ul.children.length : 0, sc: ul && ul.classList.contains('svc-scroll'), h: ul ? ul.getBoundingClientRect().height : 0, vh: innerHeight };
            document.querySelector('#svConf [data-r="0"]').click(); return r; }""")
        check("remarque 3 : 30 lignes gardées, liste limitée à la moitié de l'écran", lst["n"] == 30 and lst["sc"] and lst["h"] <= lst["vh"] / 2 + 2, lst)

        # remarque 4 : rond d'un LOT choisi → point dans le rond des lignes liées des autres blocs
        pg.evaluate("""() => { const li = document.querySelector('.ins-hcol[data-ik="lot"] [data-iid="l1"] .lk-rd'); li && li.click(); }"""); pg.wait_for_timeout(400)
        dots = pg.evaluate("""() => ({ prim: !!document.querySelector('.ins-hcol[data-ik="prim"] [data-iid="p1"] .lk-rd.lnk'), des: !!document.querySelector('#bdgClientBody tr[data-iid="d1"] .lk-rd.lnk') })""")
        check("remarque 4 : lot choisi → point dans le rond des lignes liées", dots["prim"] and dots["des"], dots)
        pg.evaluate("""() => { const li = document.querySelector('.ins-hcol[data-ik="lot"] [data-iid="l1"] .lk-rd'); li && li.click(); }"""); pg.wait_for_timeout(300)

        # SAISIE DIRECTE : remarques 4, 5, 6
        pg.evaluate("() => { const s = [...document.querySelectorAll('*')].find(e => e.__sd); s && s.__sd('chg'); }"); pg.wait_for_timeout(600)
        setnew = """([f, v]) => { const i = [...document.querySelectorAll('#sdW tr.sd-new .sd-in')].filter(x => x.dataset.f === f)[0]; if (!i) return false; i.focus(); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); return true; }"""
        for f, v in [("dc", "BETON EN FONDATION"), ("upb", "M3"), ("lot", "RDC"), ("prim", "BETONNAGE"), ("sec", "BETONNAGE")]:
            pg.evaluate(setnew, [f, v])
        pg.evaluate("() => document.querySelector('.sd-sug')?.remove()")
        pg.focus('#sdW tr.sd-new .sd-in[data-f="des"]')
        pg.keyboard.type("CIM"); pg.wait_for_timeout(250)
        sug = pg.evaluate("() => [...document.querySelectorAll('.sd-sug button')].map(b => b.textContent)")
        pg.keyboard.press("Enter"); pg.wait_for_timeout(250)
        got = pg.evaluate("() => { const r = [...document.querySelectorAll('#sdW tr.sd-new')][0]; return r ? r.querySelector('.sd-in[data-f=\"des\"]').value : ''; }")
        fa = pg.evaluate("() => document.activeElement && document.activeElement.dataset.f")
        check("remarque 5 : liste à une proposition, Entrée la prend et passe à la case à droite", sug == ["CIMENT"] and got == "CIMENT" and fa == "u", [sug, got, fa])
        pg.focus('#sdW tr.sd-new .sd-in[data-f="q"]'); pg.keyboard.type("1234,5"); pg.keyboard.press("Tab"); pg.keyboard.type("10"); pg.keyboard.press("Tab"); pg.wait_for_timeout(400)
        nxt = pg.evaluate("""() => { const T = [...document.querySelectorAll('#sdW tr.sd-new')]; const r2 = T[1]; const a = document.activeElement;
            return r2 ? { dc: r2.querySelector('.sd-in[data-f="dc"]').value, lot: r2.querySelector('.sd-in[data-f="lot"]').value, upb: r2.querySelector('.sd-in[data-f="upb"]').value, des: r2.querySelector('.sd-in[data-f="des"]').value, focus: a && a.dataset.f, focusRow: a && a.closest('tr') === r2 } : null; }""")
        check("remarque 12 : Tab sur la dernière case → ligne suivante avec la combinaison, curseur sur la désignation", nxt and nxt["dc"] == "BETON EN FONDATION" and nxt["lot"] == "RDC" and nxt["upb"] == "M3" and nxt["des"] == "" and nxt["focus"] == "des" and nxt["focusRow"], nxt)
        cen = pg.evaluate("() => { const td = document.querySelector('#sdW .sd-in[data-f=\"upb\"]').closest('td'); return getComputedStyle(td.querySelector('input')).textAlign + '|' + td.className; }")
        check("remarque 4 : UPB centrée", "center" in cen, cen)
        fq = pg.evaluate("() => [...document.querySelectorAll('#sdW tr.sd-old .sd-in[data-f=\"q\"]')].map(i => i.value)")
        check("remarque 4 : QTE au format 1 234,56", all("," in v for v in fq) and len(fq) > 0, fq)
        # remarques 19 et 21 : case à cocher dès la 1re lettre ; une seule ligne vide ; ligne vidée supprimée en la quittant
        nb0 = pg.evaluate("() => document.querySelectorAll('#sdW tr.sd-new').length")
        pg.focus('#sdW tr.sd-new:last-child .sd-in[data-f="art"]'); pg.keyboard.press("Enter"); pg.wait_for_timeout(200)
        nb1 = pg.evaluate("() => document.querySelectorAll('#sdW tr.sd-new').length")
        check("remarque 19 : Entrée sur la ligne vide ne crée pas une seconde ligne vide", nb1 == nb0, [nb0, nb1])
        pg.focus('#sdW tr.sd-new:last-child .sd-in[data-f="art"]'); pg.keyboard.type("X"); pg.wait_for_timeout(150)
        cb21 = pg.evaluate("() => { const trs = [...document.querySelectorAll('#sdW tr.sd-new')]; const t = trs[trs.length - 2]; return !!(t && t.querySelector('.sd-cb')); }")
        check("remarque 21 : case à cocher dès la première lettre", cb21)
        pg.keyboard.press("Backspace"); pg.wait_for_timeout(100)
        pg.click('#sdW tr.sd-old .sd-in[data-f="des"]'); pg.wait_for_timeout(250)
        nb2 = pg.evaluate("() => document.querySelectorAll('#sdW tr.sd-new').length")
        check("remarque 19 : ligne vidée supprimée en la quittant", nb2 == nb0, [nb0, nb2])
        # remarque 11 : annuler dans la saisie directe
        pg.focus('#sdW tr.sd-old .sd-in[data-f="art"]'); pg.keyboard.type("ZZ"); pg.wait_for_timeout(100)
        v1 = pg.evaluate("() => document.querySelector('#sdW tr.sd-old .sd-in[data-f=\"art\"]').value")
        pg.keyboard.press("Control+z"); pg.wait_for_timeout(200)
        v2 = pg.evaluate("() => document.querySelector('#sdW tr.sd-old .sd-in[data-f=\"art\"]').value")
        check("remarque 11 : Commande + Z annule la saisie", "ZZ" in v1 and "ZZ" not in v2, [v1, v2])
        th2 = pg.evaluate("() => [...document.querySelectorAll('#sdW thead th')].map(t => t.textContent.trim()).join('|')")
        check("remarque 13 : colonne PCB dans la saisie directe des charges", "PCB" in th2, th2[-60:])
        foot = pg.evaluate("() => document.querySelector('#sdW .sd-foot').innerText")
        check("remarque 12 : plus de texte en bas de la saisie directe", "CHAÎNE" not in foot, foot)
        # remarque 6 : Maj + toucher = plage ; Commande + C = copie
        pg.click('#sdW tr.sd-old .sd-in[data-f="art"]')
        pg.keyboard.down("Shift"); pg.click('#sdW tr.sd-old .sd-in[data-f="des"]'); pg.keyboard.up("Shift"); pg.wait_for_timeout(150)
        nsel = pg.evaluate("() => document.querySelectorAll('#sdW td.svi-cs').length")
        pg.keyboard.press("Control+c"); pg.wait_for_timeout(200)
        clip = pg.evaluate("() => navigator.clipboard.readText()")
        check("remarque 6 : sélection de plusieurs cases et copie", nsel == 2 and "\t" in clip, [nsel, clip[:60]])
        # remarque 17 : unités centrées (texte de la case) ; remarque 14 : toucher hors du tableau = sélection annulée
        ta = pg.evaluate("() => getComputedStyle(document.querySelector('#sdW .sd-in[data-f=\"upb\"]')).textAlign")
        check("remarque 17 : UPB centrée (texte)", ta == "center", ta)
        pg.mouse.click(5, 5); pg.wait_for_timeout(150)
        nsel2 = pg.evaluate("() => document.querySelectorAll('td.svi-cs').length")
        check("remarque 14 : toucher hors du tableau annule la sélection", nsel2 == 0, nsel2)
        pg.evaluate("() => document.querySelector('#sdW [data-x]')?.click()"); pg.wait_for_timeout(200)

        # remarque 7 : case de droite = filtre des autres blocs
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.sec.find(x => x.id === 's1').on = true; X.refreshAll(); }}"); pg.wait_for_timeout(400)
        fl = pg.evaluate("""() => ({ des: [...document.querySelectorAll('#bdgClientBody tr[data-iid]')].filter(t => !t.classList.contains('ins-title')).map(t => t.dataset.iid),
            lot: [...document.querySelectorAll('.ins-hcol[data-ik="lot"] [data-iid]')].map(e => e.dataset.iid),
            foot: (document.querySelector('table.ins-table[data-ik="des"] tfoot') || {}).textContent || '' })""")
        check("remarque 7 : activité cochée → seules les lignes liées dans les autres blocs, TOTAL PARTIEL", fl["des"] == ["d1"] and fl["lot"] == ["l1"] and "TOTAL PARTIEL" in fl["foot"], fl)
        tv = pg.evaluate("() => { const t = document.querySelector('table.ins-table[data-ik=\"des\"]'); const hs = [...t.querySelectorAll('thead th')]; const i = hs.findIndex(h => h.textContent.includes('TVA')); const f = t.querySelector('tfoot tr'); let x = 0, cell = null; [...f.cells].forEach(c => { if (x === i) cell = c; x += c.colSpan; }); return cell ? cell.textContent : null; }")
        check("remarque 9 : TVA du total = taux moyen pondéré, sous sa colonne", tv == "20,00 %", tv)
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.sec.forEach(x => x.on = false); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        full = pg.evaluate("() => (document.querySelector('table.ins-table[data-ik=\"des\"] tfoot') || {}).textContent || ''")
        check("remarque 7 : tout affiché → TOTAL", "TOTAL" in full and "PARTIEL" not in full, full[:60])

        # remarque 10 : charges identiques regroupées quand le tableau est filtré
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.chg.push({{ id: 'c9', art: 'C1', des: 'CIMENT', u: 'T', q: 2, p: 1500 }});
            I.links.push({{ id: 'L9', des: 'd2', lot: 'l2', prim: 'p1', sec: 's1', prd: [{{ id: 'x1' }}], chg: [{{ id: 'c9' }}] }});
            I.sec.find(x => x.id === 's1').on = true; X.refreshAll(); }}""")
        pg.evaluate("() => { const t = document.querySelector('.bdg-d-tab[data-tab=\"chg\"]'); t && t.click(); }"); pg.wait_for_timeout(400)
        grp = pg.evaluate("() => { const g = document.querySelector('table.ins-table[data-ik=\"chg\"] tr.ins-grp'); return g ? [g.dataset.grp, [...g.cells].map(c => { const i = c.querySelector('input.ins-gin'); return i ? i.value : c.textContent; }).join(' ').replace(/\s+/g, ' ')] : null; }")
        check("remarque 10 : CIMENT de deux tâches regroupé (QCB additionnée)", grp is not None and set(grp[0].split(",")) >= {"c9"} and "CIMENT" in grp[1], grp)
        f76c = pg.evaluate("() => { const g = document.querySelector('table.ins-table[data-ik=\"chg\"] tr.ins-gtitle'); const n = g && g.nextElementSibling; return !!g && !(n && ['c1', 'c9'].includes(n.dataset.iid)); }")
        check("remarque 76 : titre de charges regroupées plié au départ", f76c, f76c)
        pg.evaluate("() => document.querySelector('table.ins-table[data-ik=\"chg\"] tr.ins-gtitle .ins-gfz')?.click()"); pg.wait_for_timeout(300)   # remarque 76 : plié au départ → on déplie
        g45 = pg.evaluate("""() => { const t = document.querySelector('table.ins-table[data-ik="chg"]'); const g = t.querySelector('tr.ins-gtitle'); if (!g) return null;
            const kids = []; for (let r = g.nextElementSibling; r && !r.classList.contains('ins-grp'); r = r.nextElementSibling) if (r.dataset.iid) kids.push(r.dataset.iid);
            return [[...g.cells].map(c => { const i = c.querySelector('input.ins-gin'); return i ? i.value : c.textContent; }).join(' ').replace(/\u202f/g, ' ').replace(/\s+/g, ' '), kids.length, !!g.querySelector('.ins-gfold')]; }""")
        pg.evaluate("() => document.querySelector('table.ins-table[data-ik=\"chg\"] tr.ins-gtitle .ins-gfold')?.click()"); pg.wait_for_timeout(300)
        g45b = pg.evaluate("() => { const g = document.querySelector('table.ins-table[data-ik=\"chg\"] tr.ins-gtitle'); const n = g && g.nextElementSibling; return n ? !!n.dataset.iid && ['c1', 'c9'].includes(n.dataset.iid) : false; }")
        pg.evaluate("() => document.querySelector('table.ins-table[data-ik=\"chg\"] tr.ins-gtitle .ins-gfold')?.click()"); pg.wait_for_timeout(300)
        check("remarque 45 : titre des charges regroupées — QCB 5 (cumul), PCB 1 500 (moyenne), lignes dessous, pliables", bool(g45) and "5,00" in g45[0] and "1 500,00" in g45[0] and "7 500,00" in g45[0] and g45[1] == 2 and g45[2] and not g45b, [g45, g45b])
        pg.evaluate("() => document.querySelector('table.ins-table[data-ik=\"chg\"] tr.ins-grp input.ins-gcb')?.click()"); pg.wait_for_timeout(300)
        g24 = pg.evaluate(f"() => {ins}.INS.chg.filter(c => c.des === 'CIMENT').map(c => !!c.on)")
        check("remarque 24 : case de la ligne regroupée coche toutes ses charges", len(g24) >= 2 and all(g24), g24)
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.chg.forEach(c => c.on = false); X.refreshAll(); }}")
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.sec.forEach(x => x.on = false); X.refreshAll(); }}"); pg.wait_for_timeout(200)
        g49 = pg.evaluate("() => { const t = document.querySelector('table.ins-table[data-ik=\"chg\"]'); const g = t && t.querySelector('tr.ins-gtitle'); return g ? g.dataset.grp.split(',').sort() : null; }")
        check("remarque 49 : charges identiques regroupées en titre aussi sans filtre", g49 == ["c1", "c9"], g49)
        pg.evaluate("() => { const t = document.querySelector('.bdg-d-tab[data-tab=\"chg\"]'); t && t.click(); }"); pg.wait_for_timeout(300)
        pg.click('table.ins-table[data-ik="chg"] tr.ins-gtitle input.ins-gin[data-f="p"]'); pg.wait_for_timeout(150)
        pg.keyboard.type("1600"); pg.keyboard.press("Enter"); pg.wait_for_timeout(400)
        g56 = pg.evaluate(f"() => {ins}.INS.chg.filter(c => c.des === 'CIMENT').map(c => c.p)")
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.chg.forEach(c => {{ if (c.des === 'CIMENT') c.p = 1500; }}); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(200)
        check("remarque 56 : PCB tapé sur le titre des charges regroupées = PCB de toutes ses lignes", g56 == [1600, 1600], g56)
        pg.evaluate("() => document.querySelector('table.ins-table[data-ik=\"chg\"] tr.ins-gtitle .ins-grd')?.click()"); pg.wait_for_timeout(400)
        g63 = pg.evaluate("() => { const t = document.querySelector('table.ins-table[data-ik=\"chg\"]'); return [...t.querySelectorAll('tr[data-iid=\"c1\"] .lk-rd, tr[data-iid=\"c9\"] .lk-rd')].map(r => r.classList.contains('on') || !!r.closest('tr').classList.contains('lk-sel')); }")
        pg.evaluate("() => document.querySelector('table.ins-table[data-ik=\"chg\"] tr.ins-gtitle .ins-grd')?.click()"); pg.wait_for_timeout(300)
        check("remarque 63 : pastille du titre = choisir toutes ses charges", g63 == [True, True], g63)
        # remarque 72 : zone du signe › / ⌄ du titre de charges (toute la hauteur, 40 px)
        pg.evaluate("() => document.querySelector('table.ins-table[data-ik=\"chg\"] tr.ins-gtitle .ins-gfz')?.click()"); pg.wait_for_timeout(300)
        g72 = pg.evaluate("() => { const g = document.querySelector('table.ins-table[data-ik=\"chg\"] tr.ins-gtitle'); return g ? [!(g.nextElementSibling && ['c1', 'c9'].includes(g.nextElementSibling.dataset.iid)), Math.round(g.querySelector('.ins-gfz').getBoundingClientRect().width)] : null; }")
        pg.evaluate("() => document.querySelector('table.ins-table[data-ik=\"chg\"] tr.ins-gtitle .ins-gfz')?.click()"); pg.wait_for_timeout(300)
        check("remarque 72 / v788 : zone du signe du titre de charges (place réservée de 22 px) = plier / déplier", g72 == [True, 22], g72)
        # remarque 74 (v774, point 7) : un seul petit cadre, fin, de taille fixe, dans la case
        pg.click('table.ins-table[data-ik="chg"] tr[data-iid="c2"] input.ins-in[data-f="q"]'); pg.wait_for_timeout(150)
        pg.wait_for_timeout(100)
        g74 = pg.evaluate("() => { const a = document.activeElement, td = a.closest('td'), f = document.getElementById('sviSelFrame'); if (!f) return [false, false]; const r = td.getBoundingClientRect(), q = f.getBoundingClientRect(); return [f.style.display === 'block', Math.abs(q.left - r.left) <= 1 && Math.abs(q.right - r.right) <= 1 && q.top >= r.top - 1 && q.bottom <= r.bottom + 1 && q.height >= r.height - 4]; }")
        pg.keyboard.press("Escape")
        check("remarque 74 / v787 : le cadre prend exactement le bord de la case sélectionnée", g74 == [True, True], g74)
        # remarque 75 : v782 : SAISIE DIRECTE sur place depuis le ⋯ du DÉTAIL (AGRANDIR = plein écran comme les autres blocs) ; plus dans IMPORTER
        pg.evaluate("() => { document.querySelector('#bdgDetailHead .blk-more')?.click(); document.querySelector('#blkMenu [data-sdo]')?.click(); }"); pg.wait_for_timeout(600)
        g75 = pg.evaluate("() => { const w = document.querySelector('#sdW.sd-inplace'); const tb = document.getElementById('bdgTabBody'); return [!!w, !!(w && w.closest('.bdg-d-page')), tb ? getComputedStyle(tb).display : '']; }")
        g78 = pg.evaluate("""() => { const w = document.querySelector('#sdW.sd-inplace'), tabs = document.getElementById('bdgTabs'); if (!w || !tabs) return null;
            const tr = tabs.getBoundingClientRect(), wr = w.getBoundingClientRect(), th = w.querySelector('thead').getBoundingClientRect(), ok = w.querySelector('.sd-ok').getBoundingClientRect();
            return [tr.height > 0 && tr.bottom <= wr.top + 2, th.top >= 0 && th.bottom <= innerHeight, ok.bottom <= innerHeight + 1]; }""")
        check("remarque 78 : SAISIE DIRECTE sur place sous les onglets, en-têtes et VALIDER visibles", g78 == [True, True, True], g78)
        pg.evaluate("() => { document.querySelector('#bdgDetailHead .blk-more')?.click(); document.querySelector('#blkMenu [data-sdo]')?.click(); }"); pg.wait_for_timeout(400)
        g75b = pg.evaluate("() => [!!document.querySelector('#sdW'), getComputedStyle(document.getElementById('bdgTabBody')).display]")
        check("remarque 75 : AGRANDIR = SAISIE DIRECTE sur place dans le bloc, retoucher = retour au tableau", g75 == [True, True, "none"] and g75b[0] is False and g75b[1] != "none", [g75, g75b])
        # remarque 79 : Entrée sur un titre de charges groupé (valeur changée → tableau redessiné) : la case du dessous reste sélectionnée
        pg.evaluate("() => { const t = document.querySelector('.bdg-d-tab[data-tab=\"chg\"]'); t && t.click(); }"); pg.wait_for_timeout(300)
        pg.click('table.ins-table[data-ik="chg"] tr.ins-gtitle input.ins-gin[data-f="p"]'); pg.wait_for_timeout(150)
        pg.keyboard.type("1500"); pg.keyboard.press("Enter"); pg.wait_for_timeout(500)
        g79 = pg.evaluate("() => { const a = document.activeElement; const tr = a && a.closest('tr'); return [a.tagName, a.dataset.f || '', tr ? (tr.dataset.iid || tr.dataset.grp || '') : '']; }")
        pg.keyboard.press("ArrowUp"); pg.wait_for_timeout(200)
        g79b = pg.evaluate("() => { const a = document.activeElement; return [a.className.includes('ins-gin'), a.dataset.f || '']; }")
        check("remarque 79 : Entrée et flèches sur un titre groupé (focus gardé après redessin)", g79[0] == "INPUT" and g79[1] == "p" and g79[2] in ("c1", "c9") and g79b == [True, "p"], [g79, g79b])
        # remarque 77 : largeur réglée à la poignée gardée après un redessin (pliage, menu ⋯)
        pg.evaluate("""() => { const o = JSON.parse(localStorage.getItem('svi_colw_v1') || '{}'); o['chg.article'] = 30; localStorage.setItem('svi_colw_v1', JSON.stringify(o)); }""")
        pg.evaluate(f"() => {ins}.refreshAll()"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('table.ins-table[data-ik=\"chg\"] tr.ins-gtitle .ins-gfz')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('#bdgDetailHead .blk-more')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.getElementById('blkMenu')?.remove()")
        w77 = pg.evaluate("() => Math.round(document.querySelector('table.ins-table[data-ik=\"chg\"] col[data-w=\"chg.article\"]').getBoundingClientRect().width)")
        pg.evaluate("""() => { const o = JSON.parse(localStorage.getItem('svi_colw_v1') || '{}'); delete o['chg.article']; localStorage.setItem('svi_colw_v1', JSON.stringify(o)); }""")
        pg.evaluate("() => document.querySelector('table.ins-table[data-ik=\"chg\"] tr.ins-gtitle .ins-gfz')?.click()"); pg.wait_for_timeout(300)
        check("remarque 77 / v788 : largeur réglée (ARTICLE réduit) gardée après pliage et menu ⋯ — jamais sous 64 px (nom lisible)", w77 == 64, w77)
        # remarques 74, 80, 81 : MÊME COMPORTEMENT DANS CHAQUE TABLEAU ET CHAQUE LISTE — 1er toucher = case sélectionnée
        # (cadre posé sur toute la cellule), flèche bas = case du dessous, 2e toucher = saisie, toucher ailleurs = plus de cadre
        def grid_check(tab, sel):
            if tab: pg.evaluate("t => { const b = document.querySelector('.bdg-d-tab[data-tab=\"' + t + '\"]'); b && b.click(); }", tab); pg.wait_for_timeout(400)
            for _ in range(5):   # v516 : produits regroupés pliés — on déplie pour atteindre la ligne
                if not pg.evaluate("() => { const b = document.querySelector('tr.ins-pgrp .ins-gfold:not(.open)'); if (!b) return false; b.closest('.ins-gfz').click(); return true; }"): break
                pg.wait_for_timeout(300)
            if not pg.evaluate("s => !!document.querySelector(s)", sel): return "absent"
            pg.click(sel); pg.wait_for_timeout(200)
            a = pg.evaluate("""() => { const a = document.activeElement, c = window.sviCellOf(a), f = document.getElementById('sviSelFrame');
                if (!c || !f) return null; const r = (c.tagName !== 'TD' && c.closest('.ins-li')) ? c.closest('.ins-li').getBoundingClientRect() : c.getBoundingClientRect(), q = f.getBoundingClientRect();   /* v788 : liste = toute la ligne */
                return [a.classList.contains('svi-nav') || (a.tagName === 'TD' && a.classList.contains('svi-tdf')), f.style.display === 'block' && q.height <= r.height + 1 && q.height >= Math.min(10, r.height - 6) && q.width <= r.width + 1 && q.width > 10,   /* v787 : cadre = bords de la case */ window.sviCellKey(a), [r.top, r.height, r.width, q.top, q.height, q.width, f.style.display].map(x => typeof x === 'number' ? Math.round(x) : x)]; }""")
            if a and not a[1]: print("RECT", sel, a[3])
            pg.keyboard.press("ArrowDown"); pg.wait_for_timeout(200)
            b = pg.evaluate("k => { const a = document.activeElement; const c = window.sviCellOf(a); return !!c && JSON.stringify(window.sviCellKey(a)) !== JSON.stringify(k); }", a[2] if a else None)
            pg.keyboard.press("ArrowUp"); pg.wait_for_timeout(150)
            el = pg.evaluate_handle("() => document.activeElement")
            pg.evaluate("e => e.click()", el); pg.wait_for_timeout(100)
            pg.mouse.click(5, 5); pg.wait_for_timeout(250)
            d = pg.evaluate("() => { const f = document.getElementById('sviSelFrame'); return !f || f.style.display !== 'block'; }")
            return [bool(a and a[0]), bool(a and a[1]), b, d]
        GR = [("DÉSIGNATIONS CLIENT", None, 'table.ins-table[data-ik="des"] tr[data-iid="d1"] input.ins-in[data-f="p"]'),
              ("DÉTAIL CHARGES", "chg", 'table.ins-table[data-ik="chg"] tr[data-iid="c2"] input.ins-in[data-f="q"]'),
              ("DÉTAIL PRODUITS", "prd", 'table.ins-table[data-ik="prd"] tr[data-iid="x1"] input.ins-in[data-f="nbr"]'),
              ("LOT", None, '.ins-hcol[data-ik="lot"] .ins-li[data-iid] input.ins-in'),
              ("ACTIVITÉ PRIMAIRE", None, '.ins-hcol[data-ik="prim"] .ins-li[data-iid] input.ins-in'),
              ("ACTIVITÉ SECONDAIRE", None, '.ins-hcol[data-ik="sec"] .ins-li[data-iid] input.ins-in[data-f="v"]')]
        res = {n: grid_check(t, q) for n, t, q in GR}
        res["DÉTAIL DÉLAIS"] = grid_check("dly", 'table.dly-table tbody tr:first-child td:nth-child(2)') if pg.evaluate("() => { const b = document.querySelector('.bdg-d-tab[data-tab=\"dly\"]'); b && b.click(); return true; }") else None
        res["DÉTAIL QUALITÉ"] = grid_check("qlt", 'table.qq-table tbody tr td input:not([type=checkbox])')
        pg.evaluate(f"""() => {{ const X = {ins}; X.INS.inc = [{{ id: 'i1', src: {{ type: 'CHG', dc: 'BETON EN FONDATION', upb: 'M3', lot: 'RDC', prim: 'BETONNAGE', sec: 'BETONNAGE', des: 'GRAVIER', u: 'T', q: '2' }}, bad: ['lot'], why: 'TEST' }}, {{ id: 'i2', src: {{ type: 'CHG', dc: 'BETON EN FONDATION', upb: 'M3', lot: 'RDC', prim: 'BETONNAGE', sec: 'BETONNAGE', des: 'EAU', u: 'L', q: '5' }}, bad: ['lot'], why: 'TEST' }}]; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(300)
        res["IMPORT NON CRÉÉ"] = grid_check("inc", 'table.inc-table tbody tr:first-child input.inc-in[data-f="des"]')
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.inc = []; X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        pg.evaluate("() => { const s = [...document.querySelectorAll('*')].find(e => e.__sd); s && s.__sd('chg'); }"); pg.wait_for_timeout(600)
        res["SAISIE DIRECTE"] = grid_check(None, '#sdW .sd-t tbody tr:first-child input.sd-in[data-f="des"]')
        pg.evaluate("() => document.querySelector('#sdW [data-x]')?.click()"); pg.wait_for_timeout(300)
        print("TABLEAUX CONTRÔLÉS :", json.dumps(res, ensure_ascii=False))
        # remarque 80 : coller une liste copiée d'Excel / Google Sheets dans ACTIVITÉ PRIMAIRE (une activité par ligne)
        pg.click('.ins-hcol[data-ik="prim"] .ins-li.ins-new input.ins-in'); pg.wait_for_timeout(150)
        p80 = pg.evaluate(f"""() => {{ const el = document.activeElement; const dt = new DataTransfer(); dt.setData('text/plain', 'ENDUIT\\nPEINTURE\\n');
            el.dispatchEvent(new ClipboardEvent('paste', {{ clipboardData: dt, bubbles: true, cancelable: true }}));
            const X = {ins}; const out = X.INS.prim.map(r => r.v);
            X.INS.prim = X.INS.prim.filter(r => !['ENDUIT', 'PEINTURE'].includes(r.v)); X.insSave(); X.refreshAll(); return out; }}""")
        check("remarque 80 : coller une liste d'activités primaires (une par ligne)", "ENDUIT" in p80 and "PEINTURE" in p80, p80)
        check("remarques 74, 80, 81 : sélection, cadre sur la cellule, flèches, fin du cadre — dans CHAQUE tableau et liste", all(v == [True, True, True, True] for v in res.values()), res)

        # remarque 23 : QPB d'une désignation limitée aux tâches de la charge cochée
        q23 = pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS;
            I.prd.push({{ id: 'x5', des: 'BETON B25', u: 'M3', nbr: 5, d1: 1, d2: 1, d3: 1 }});
            I.links.push({{ id: 'L10', des: 'd1', lot: 'l2', prim: 'p1', sec: 's1', prd: [{{ id: 'x5' }}], chg: [] }});
            X.refreshAll();
            const qpb = () => {{ const tr = document.querySelector('#bdgClientBody tr[data-iid="d1"]'); const i = tr && tr.querySelector('[data-f="q"]'); return i ? (i.value || i.textContent) : null; }};
            const all = qpb(); I.chg.find(c => c.id === 'c1').on = true; X.refreshAll(); const f = qpb(); I.chg.forEach(c => c.on = false); X.refreshAll();
            return [all, f]; }}""")
        check("remarque 23 : QPB filtrée par la charge cochée (15 → 10)", q23 == ["15,00", "10,00"], q23)

        # remarque 33 (v497) : comme Google Sheets — 1er toucher = case sélectionnée (sans curseur), 2e = saisie, flèches = case voisine
        P = 'table.ins-table[data-ik="des"] tr[data-iid="d1"] input.ins-in[data-f="p"]'
        pg.click(P); pg.wait_for_timeout(200)
        n1 = pg.evaluate("() => document.activeElement.classList.contains('svi-nav')")
        pg.keyboard.press("ArrowDown"); pg.wait_for_timeout(150)
        n2 = pg.evaluate("() => { const a = document.activeElement; return [a.dataset.f, a.closest('tr').dataset.iid, a.classList.contains('svi-nav')]; }")
        pg.keyboard.press("ArrowUp"); pg.wait_for_timeout(150)
        pg.click(P); pg.wait_for_timeout(150)
        n3 = pg.evaluate("() => document.activeElement.classList.contains('svi-nav')")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
        n4 = pg.evaluate("() => document.activeElement.classList.contains('svi-nav')")
        check("remarque 33 : case sélectionnée, flèche = case du dessous, 2e toucher = saisie, Échap = sélection",
              n1 and n2[0] == "p" and n2[1] != "d1" and n2[2] and not n3 and n4, [n1, n2, n3, n4])
        # remarque 36 : 35 → 35,00 en quittant la case ; la frappe remplace le contenu
        pg.keyboard.type("35"); pg.keyboard.press("Tab"); pg.wait_for_timeout(200)
        f36 = pg.evaluate(f"""() => {{ const X = {ins}; return [document.querySelector('{P}').value, X.INS.des.find(r => r.id === 'd1').p]; }}""")
        check("remarque 36 : la frappe remplace, 35 → 35,00 en quittant la case", f36 == ["35,00", 35], f36)
        # remarque 32 : collage de plusieurs valeurs = une par case, vers le bas
        pg.click(P); pg.wait_for_timeout(150)
        p32 = pg.evaluate(f"""() => {{ const X = {ins}; const el = document.activeElement; const dt = new DataTransfer(); dt.setData('text/plain', '11\\n22\\n'); 
            el.dispatchEvent(new ClipboardEvent('paste', {{ clipboardData: dt, bubbles: true, cancelable: true }}));
            const rows = [...document.querySelectorAll('table.ins-table[data-ik="des"] tbody tr')].filter(t => t.offsetParent !== null);
            const i = rows.findIndex(t => t.dataset.iid === 'd1'); const nid = rows[i + 1] && rows[i + 1].dataset.iid;
            const P = id => (X.INS.des.find(r => r.id === id) || {{}}).p;
            const out = [P('d1'), P(nid)];
            X.INS.des.find(r => r.id === 'd1').p = 1000; X.INS.des.find(r => r.id === 'd3').p = 15; X.INS.des.find(r => r.id === 'd2').p = 1200; X.insSave(); X.refreshAll();
            return out; }}""")
        check("remarque 32 : coller 2 valeurs = une par case, vers le bas", p32 == [11, 22], p32)
        # remarque 31 : PCB manquant (charge absente de CHS) — on peut sortir de la case
        pg.evaluate(f"""() => {{ const X = {ins}; X.INS.chg.find(r => r.id === 'c1').p = ''; X.insSave(); X.refreshAll();
            document.querySelector('.bdg-d-tab[data-tab="chg"]')?.click(); }}"""); pg.wait_for_timeout(400)
        pg.click('table.ins-table[data-ik="chg"] tr[data-iid="c1"] input.ins-in[data-f="p"]'); pg.wait_for_timeout(150)
        pg.click('table.ins-table[data-ik="chg"] tr[data-iid="c2"] input.ins-in[data-f="q"]'); pg.wait_for_timeout(300)
        p31 = pg.evaluate(f"""() => {{ const X = {ins}; const a = document.activeElement; const out = [a.closest('tr') && a.closest('tr').dataset.iid,
            !!document.querySelector('table.ins-table[data-ik="chg"] tr[data-iid="c1"] td.ins-bad')];
            X.INS.chg.find(r => r.id === 'c1').p = 1500; X.insSave(); X.refreshAll(); return out; }}""")
        check("remarque 31 : PCB manquant — on sort de la case, elle reste encadrée en rouge", p31 == ["c2", True], p31)
        # remarque 30 : en descendant avec les flèches, la case reste visible (jamais sous la ligne TOTAL fixée)
        pg.evaluate(f"""() => {{ const X = {ins}; for (let i = 0; i < 25; i++) X.INS.chg.push({{ id: 'zz' + i, des: 'CHARGE ' + (100 + i), u: 'U', q: 1, p: 1 }}); X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        pg.click('table.ins-table[data-ik="chg"] tr[data-iid="c1"] input.ins-in[data-f="q"]'); pg.wait_for_timeout(150)
        for _ in range(14): pg.keyboard.press("ArrowDown"); pg.wait_for_timeout(40)
        pg.wait_for_timeout(300)
        v30 = pg.evaluate("""() => { const a = document.activeElement, td = a.closest('td'), t = td.closest('table'), r = td.getBoundingClientRect();
            const f = t.tFoot ? t.tFoot.getBoundingClientRect().top : 1e9, h = t.tHead.getBoundingClientRect().bottom, sc = t.closest('.bdg-d-scroll').getBoundingClientRect();
            return [a.closest('tr').dataset.iid !== 'c1', r.bottom <= f + 1, r.top >= h - 1, r.bottom <= sc.bottom + 1, r.bottom <= innerHeight]; }""")
        pg.evaluate(f"""() => {{ const X = {ins}; X.INS.chg = X.INS.chg.filter(r => !/^zz/.test(r.id)); X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(300)
        check("remarque 30 : flèche bas — la case reste visible (au-dessus du TOTAL et de l'écran)", v30 == [True] * 5, v30)
        # remarque 35 : case grisée (QPB) sélectionnable pour la copier
        pg.click('table.ins-table[data-ik="des"] tr[data-iid="d1"] td:has(input[data-f="q"])'); pg.wait_for_timeout(250)
        g35 = pg.evaluate("() => { const a = document.activeElement; const f = document.getElementById('sviSelFrame'); return [a.tagName, a.classList.contains('svi-tdf'), !!f && f.style.display === 'block']; }")
        check("remarques 35 et 44 : case grisée sélectionnable (copie), cadre visible", g35 == ["TD", True, True], g35)

        # remarque 21 : une charge déjà liée à une autre tâche est copiée au chargement
        n = pg.evaluate(f"() => {ins}.INS.chg.length")
        check("charges lues", n >= 2, n)

        # SAISIE DIRECTE : un seul ⋯ (remarque 25) et COLLER LES LIGNES (remarque 24)
        pg.evaluate("() => { const s = [...document.querySelectorAll('*')].find(e => e.__sd); s && s.__sd('chg'); }")
        pg.wait_for_timeout(600)
        sd = pg.evaluate("() => { const d = document.getElementById('sdW'); if (!d) return null; return { more: d.querySelectorAll('.sd-more').length, mini: d.querySelectorAll('.sd-mini, .sd-size').length }; }")
        check("SAISIE DIRECTE ouverte", sd is not None, sd)
        if sd:
            check("SAISIE DIRECTE : un seul ⋯, sans boutons séparés (remarque 25)", sd["more"] == 1 and sd["mini"] == 0, sd)
            pg.click("#sdW .sd-more"); pg.wait_for_timeout(300)
            menu = pg.evaluate("() => document.querySelector('#blkMenu')?.textContent || ''")
            check("menu ⋯ : COLLER LES LIGNES (remarque 24)", "COLLER LES LIGNES" in menu, menu[:120])
            pg.keyboard.press("Escape"); pg.mouse.click(5, 5); pg.wait_for_timeout(200)

            # remarque 22 : charge CIMENT déplacée (BETON EN ELEVATION, ETAGE 1) vers une combinaison sans produit → produits recopiés
            setv = """([des, f, v]) => { const tr = [...document.querySelectorAll('#sdW tbody tr')].find(t => [...t.querySelectorAll('input.sd-in')].some(i => i.dataset.f === 'des' && i.value === des));
                if (!tr) return false; const i = tr.querySelector(`input.sd-in[data-f="${f}"]`); i.focus(); i.value = v;
                i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); i.blur(); return true; }"""
            ok1 = pg.evaluate(setv, ["CIMENT", "dc", "BETON EN ELEVATION"]) and pg.evaluate(setv, ["CIMENT", "lot", "ETAGE 1"])
            pg.wait_for_timeout(200)
            pg.evaluate("() => document.querySelector('#sdW .sd-ok')?.click()"); pg.wait_for_timeout(1200)
            pg.evaluate("() => document.querySelectorAll('.svc-ok, [data-ok]').forEach(b => b.click())"); pg.wait_for_timeout(800)
            res = pg.evaluate(f"""() => {{ const X = {ins}; const d3 = X.INS.des.find(x => x.des === 'BETON EN ELEVATION');
                const l = X.INS.links.find(l => l.des === d3.id); if (!l) return 'PAS DE LIAISON ' + JSON.stringify({{ inc: X.INS.inc, links: X.INS.links, chg: X.INS.chg, txt: document.body.innerText.slice(-600) }});
                return {{ prd: l.prd.length, chg: l.chg.map(x => (X.INS.chg.find(c => c.id === x.id) || {{}}).des).join(','), old: X.INS.links.filter(q => q.des === 'd1').length }}; }}""")
            check("charge déplacée : produits recopiés sur la nouvelle combinaison (remarque 22)", ok1 and isinstance(res, dict) and res["prd"] == 1 and "CIMENT" in res["chg"] and res["old"] == 1, res)
        # ===== v513 : sélection, 2e toucher, sélection multiple des listes, collage sans doublons, copie filtrée =====
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        for _ in range(3):
            if not pg.evaluate("() => !!document.getElementById('sdW')"): break
            pg.evaluate("() => { const d = document.getElementById('sdW'); d && d.querySelector('[data-x]')?.click(); }"); pg.wait_for_timeout(500)
            pg.evaluate("() => document.querySelectorAll('.svc-ok, [data-ok]').forEach(b => b.click())"); pg.wait_for_timeout(400)
        P = 'table.ins-table[data-ik="des"] tr[data-iid="d1"] input.ins-in[data-f="p"]'
        pg.click(P); pg.wait_for_timeout(150)
        s1 = pg.evaluate("() => { const a = document.activeElement; return [a.classList.contains('svi-nav'), getComputedStyle(a).caretColor]; }")
        pg.click(P); pg.wait_for_timeout(200)
        s2 = pg.evaluate("() => { const a = document.activeElement; return [a.classList.contains('svi-nav'), a.selectionStart, a.selectionEnd, a.value.length]; }")
        check("v513 : 1er toucher = sélection sans curseur ; 2e toucher = TOUT le contenu sélectionné",
              s1[0] and s1[1] in ("transparent", "rgba(0, 0, 0, 0)") and not s2[0] and s2[1] == 0 and s2[2] == s2[3] and s2[3] > 0, [s1, s2])
        pg.keyboard.press("Escape"); pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        # 1er toucher dans une LISTE (LOT) : pas de curseur non plus
        pg.click('.ins-hcol[data-ik="lot"] .ins-li[data-iid="l1"] input.ins-in'); pg.wait_for_timeout(150)
        s3 = pg.evaluate("() => { const a = document.activeElement; return [a.classList.contains('svi-nav'), getComputedStyle(a).caretColor]; }")
        check("v513 : liste LOT — 1er toucher = sélection, sans curseur", s3[0] and s3[1] in ("transparent", "rgba(0, 0, 0, 0)"), s3)
        # sélection multiple dans la liste LOT : Maj + toucher, copie = une ligne par lot
        pg.keyboard.down("Shift"); pg.click('.ins-hcol[data-ik="lot"] .ins-li[data-iid="l2"] input.ins-in'); pg.keyboard.up("Shift"); pg.wait_for_timeout(150)
        cp = pg.evaluate("""() => { const dt = new DataTransfer(); const ev = new ClipboardEvent('copy', { clipboardData: dt, bubbles: true, cancelable: true });
            document.activeElement.dispatchEvent(ev); return [document.querySelectorAll('.ins-hcol .svi-ls').length, dt.getData('text/plain')]; }""")
        check("v513 : sélection multiple dans la liste LOT (Maj + toucher) et copie des lots", cp[0] == 2 and sorted(cp[1].split("\n")) == ["ETAGE 1", "RDC"], cp)
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        # coller dans ACTIVITÉ PRIMAIRE : doublons ignorés (déjà présent, ou répété dans ce qui est collé)
        pg.click('.ins-hcol[data-ik="prim"] .ins-li.ins-new input.ins-in'); pg.wait_for_timeout(150)
        dp = pg.evaluate(f"""() => {{ const el = document.activeElement; const dt = new DataTransfer(); dt.setData('text/plain', 'BETONNAGE\\nENDUIT\\nenduit\\n\\nPEINTURE\\n');
            el.dispatchEvent(new ClipboardEvent('paste', {{ clipboardData: dt, bubbles: true, cancelable: true }}));
            const X = {ins}; const out = X.INS.prim.map(r => r.v);
            X.INS.prim = X.INS.prim.filter(r => !['ENDUIT', 'PEINTURE'].includes(r.v)); X.insSave(); X.refreshAll(); return out; }}""")
        check("v513 : coller des activités — doublons ignorés", sorted(dp) == ["BETONNAGE", "ENDUIT", "PEINTURE"], dp)
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        # coller dans DÉSIGNATIONS CLIENT (ligne SAISIR ICI…) : une désignation déjà présente n'est pas recréée
        nd = 'table.ins-table[data-ik="des"] tr.ins-new textarea.ins-in[data-f="des"]'
        if pg.evaluate("s => !!document.querySelector(s)", nd):
            pg.click(nd); pg.wait_for_timeout(150)
            dd = pg.evaluate(f"""() => {{ const X = {ins}; const n0 = X.INS.des.length; const el = document.activeElement; const dt = new DataTransfer(); dt.setData('text/plain', 'ACIER\\nGRAVIER\\nGRAVIER\\n');
                el.dispatchEvent(new ClipboardEvent('paste', {{ clipboardData: dt, bubbles: true, cancelable: true }}));
                const out = [X.INS.des.length - n0, X.INS.des.filter(r => r.des === 'ACIER').length, X.INS.des.filter(r => r.des === 'GRAVIER').length];
                X.INS.des = X.INS.des.filter(r => r.des !== 'GRAVIER'); X.insSave(); X.refreshAll(); return out; }}""")
            check("v513 : coller des désignations client — doublons ignorés", dd == [1, 1, 1], dd)
        else:
            check("v513 : ligne SAISIR ICI des désignations présente", False, "absente")
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        # copie d'un tableau filtré : seules les lignes visibles
        pg.click(P); pg.wait_for_timeout(150)
        pg.evaluate("() => { const tr = document.querySelector('table.ins-table[data-ik=\"des\"] tr[data-iid=\"d3\"]'); tr.style.display = 'none'; }")
        pg.keyboard.down("Shift"); pg.click('table.ins-table[data-ik="des"] tr[data-iid="d2"] input.ins-in[data-f="p"]'); pg.keyboard.up("Shift"); pg.wait_for_timeout(150)
        cf = pg.evaluate("""() => { const dt = new DataTransfer(); document.activeElement.dispatchEvent(new ClipboardEvent('copy', { clipboardData: dt, bubbles: true, cancelable: true }));
            document.querySelector('table.ins-table[data-ik="des"] tr[data-iid="d3"]').style.display = ''; return dt.getData('text/plain'); }""")
        check("v513 : copier un tableau filtré = lignes visibles seulement", ["".join(x.split()).replace("\u202f", "").replace("\xa0", "").replace(",00", "") for x in cf.split("\n")] == ["1000", "1200"], cf)
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)

        # ===== v514 : la sélection reste quand on touche ⋯ ; COPIER / EFFACER (menu, barre, touche ⌫) =====
        pg.click(P); pg.wait_for_timeout(150)
        pg.keyboard.down("Shift"); pg.click('table.ins-table[data-ik="des"] tr[data-iid="d2"] input.ins-in[data-f="p"]'); pg.keyboard.up("Shift"); pg.wait_for_timeout(250)
        bar = pg.evaluate("() => { const b = document.getElementById('sviSelBar'); return !!b && b.style.display === 'flex'; }")
        more = pg.evaluate("() => { const b = document.querySelector('.blk-client .blk-more'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }")
        if more: pg.mouse.click(more[0], more[1]); pg.wait_for_timeout(300)
        mm = pg.evaluate("() => [document.querySelector('#blkMenu')?.textContent || '', document.querySelectorAll('td.svi-cs').length]")
        check("v514 : barre affichée, sélection gardée en touchant ⋯, commandes des cases dans le menu", bar and "COPIER LES CASES" in mm[0] and mm[1] >= 2, [bar, more, mm[0][:80], mm[1]])
        pg.evaluate("() => { window.__sviSelClip = ''; document.querySelector('#blkMenu [data-cs=\"copy\"]')?.click(); }"); pg.wait_for_timeout(200)
        clip = pg.evaluate("() => window.__sviSelClip || ''")
        check("v514 : COPIER LES CASES (menu ⋯) — texte prêt pour Google Sheets", len(clip.split("\n")) == mm[1] >= 2, [clip, mm[1]])
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        # touche ⌫ sur une plage du DÉTAIL CHARGES
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"chg\"]')?.click()"); pg.wait_for_timeout(300)
        ids = pg.evaluate("() => [...document.querySelectorAll('table.ins-table[data-ik=\"chg\"] tbody tr[data-iid]')].filter(t => t.offsetParent !== null).map(t => t.dataset.iid).slice(0, 2)")
        Q1 = f'table.ins-table[data-ik="chg"] tr[data-iid="{ids[0]}"] input.ins-in[data-f="q"]'
        Q2 = f'table.ins-table[data-ik="chg"] tr[data-iid="{ids[1]}"] input.ins-in[data-f="q"]'
        pg.click(Q1); pg.wait_for_timeout(150)
        pg.keyboard.down("Shift"); pg.click(Q2); pg.keyboard.up("Shift"); pg.wait_for_timeout(200)
        pg.keyboard.press("Backspace"); pg.wait_for_timeout(300)
        bk = pg.evaluate(f"""ids => {{ const X = {ins}; const R = ids.map(id => X.INS.chg.find(r => r.id === id)); const out = R.map(r => r.q);
            R.forEach(r => r.q = 1); X.insSave(); X.refreshAll(); return out; }}""", ids)
        check("v514 : touche ⌫ — les cases sélectionnées sont vidées", all(v in ("", None, 0) for v in bk), bk)
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        # barre EFFACER sur une plage de la liste ACTIVITÉ SECONDAIRE (unités)
        U1 = '.ins-hcol[data-ik="sec"] .ins-li[data-iid="s1"] input.ins-in[data-f="u"]'
        U2 = '.ins-hcol[data-ik="sec"] .ins-li[data-iid="s2"] input.ins-in[data-f="u"]'
        if pg.evaluate("([a, b]) => !!document.querySelector(a) && !!document.querySelector(b)", [U1, U2]):
            pg.click(U1); pg.wait_for_timeout(150)
            pg.keyboard.down("Shift"); pg.click(U2); pg.keyboard.up("Shift"); pg.wait_for_timeout(250)
            pg.evaluate("() => document.querySelector('#sviSelBar [data-sb=\"clear\"]')?.click()"); pg.wait_for_timeout(400)
            ul = pg.evaluate(f"""() => {{ const X = {ins}; const out = X.INS.sec.filter(r => ['s1', 's2'].includes(r.id)).map(r => r.u || '');
                X.INS.sec.find(r => r.id === 's1').u = 'M3'; X.INS.sec.find(r => r.id === 's2').u = 'M2'; X.insSave(); X.refreshAll(); return out; }}""")
            # s1 est utilisée par une liaison : son unité reste obligatoire (règle existante) ; s2 libre est vidée
            check("v514 : bouton EFFACER de la barre — liste ACTIVITÉ SECONDAIRE", ul[1] == "", ul)
        else:
            check("v514 : unités de la liste ACTIVITÉ SECONDAIRE présentes", False, "absentes")
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)

        # ===== v516 : DÉTAIL PRODUITS — même désignation regroupée (dimensions / unité différentes), sans totaux =====
        pg.evaluate(f"""() => {{ const X = {ins}; X.INS.prd.push({{ id: 'x7', des: 'beton b25', u: 'M2', nbr: 2, d1: 3, d2: 1, d3: 1 }}); X.insSave(); X.refreshAll();
            document.querySelector('.bdg-d-tab[data-tab="prd"]')?.click(); }}"""); pg.wait_for_timeout(500)
        g1 = pg.evaluate("""() => { const t = document.querySelector('table.ins-table[data-ik="prd"] tr.ins-pgrp'); if (!t) return null;
            const txt = [...t.cells].map(c => c.textContent.trim()).filter(Boolean);
            return [t.dataset.grp.split(',').length, txt, !!document.querySelector('table.ins-table[data-ik="prd"] tr[data-iid="x7"]')]; }""")
        pg.evaluate("() => document.querySelector('table.ins-table[data-ik=\"prd\"] tr.ins-pgrp .ins-gfz')?.click()"); pg.wait_for_timeout(400)
        g2 = pg.evaluate("() => !!document.querySelector('table.ins-table[data-ik=\"prd\"] tr[data-iid=\"x7\"]')")
        pg.evaluate("() => document.querySelector('table.ins-table[data-ik=\"prd\"] tr.ins-pgrp .ins-gfz')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.prd = X.INS.prd.filter(r => r.id !== 'x7'); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        check("v516 : produits de même désignation regroupés (titre : nombre, signe, désignation, sans total), pliés puis dépliables",
              g1 is not None and g1[0] >= 2 and len(g1[1]) == 2 and "BETON" in g1[1][1].upper() and g1[2] != g2, [g1, g2])

        # ===== v517 : PLANNING — tâche déplacée dans son lot (le lot reste en place) ; tâche suivante collée = pas d'alerte =====
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"dly\"]')?.click()"); pg.wait_for_timeout(500)
        dd = pg.evaluate(f"""async () => {{ const X = {ins}; const sh = [...document.querySelectorAll('*')].find(e => e.__insDly); const D = sh && sh.__insDly; if (!D) return 'pas de planning';
            const I = X.INS; const save = JSON.stringify({{ dlp: I.dlp, dord: I.dord, dpred: I.dpred }});
            I.dlp = {{ 'l1|s1': [{{ id: 'q1', deb: '2026-10-05', fin: '2026-10-06' }}], 'l1|s2': [{{ id: 'q2', deb: '2026-10-07', fin: '2026-10-08' }}], 'l2|s1': [{{ id: 'q3', deb: '2026-10-05', fin: '2026-10-05' }}] }};
            I.dord = ['l1|s2', 'l2|s1', 'l1|s1']; I.dpred = {{}};
            const lot = I.lot.find(l => l.id === 'l1').v;
            D.dropTaskTo('l1|s2', {{ parent: lot, before: '', afterKey: 'l1|s1' }}, document.body);
            await new Promise(r => setTimeout(r, 300));
            const o1 = I.dord.filter(k => ['l1|s1', 'l1|s2', 'l2|s1'].includes(k));
            /* liaison FIN → DÉBUT, s2 collée à s1 : allonger s1 d'un jour = s2 suit, sans fenêtre */
            I.dpred = {{ 'l1|s2': [{{ k: 'l1|s1', t: 'FD', o: 0 }}] }}; I.dmig86 = 1; if (sh.__ins) {{}}
            I.dlp['l1|s2'] = [{{ id: 'q2', deb: '2026-10-07', fin: '2026-10-08' }}];
            const LKd = D.draft(); Object.keys(LKd).forEach(k => delete LKd[k]);
            D.apply('l1|s1', {{ deb: '2026-10-05', fin: '2026-10-07' }}, {{ fromDur: true }});
            await new Promise(r => setTimeout(r, 300));
            const dlg = !!document.querySelector('#svConf') && /TÂCHES SUIVANTES/.test(document.querySelector('#svConf').textContent);
            document.querySelectorAll('#svConf [data-x], #svConf [data-v=""]').forEach(b => b.click());
            const s2 = D.deb('l1|s2');
            const o = JSON.parse(save); I.dlp = o.dlp; I.dord = o.dord; I.dpred = o.dpred; Object.keys(LKd).forEach(k => delete LKd[k]); X.insSave(); X.refreshAll();
            return [o1, dlg, s2]; }}""")
        check("v517 : tâche déplacée dans son lot — le lot reste à sa place", isinstance(dd, list) and dd[0] == ["l1|s1", "l1|s2", "l2|s1"], dd)
        check("v517 : tâche suivante collée — elle suit, sans fausse alerte", isinstance(dd, list) and dd[1] is False and dd[2] == "2026-10-08", dd)

        # ===== v639 : DÉBUT posé après la FIN = tâche entière déplacée, même durée (jours travaillés) =====
        mv = pg.evaluate(f"""async () => {{ const X = {ins}; const sh = [...document.querySelectorAll('*')].find(e => e.__insDly); const D = sh && sh.__insDly; if (!D) return 'pas de planning';
            const I = X.INS; const save = JSON.stringify({{ dlp: I.dlp, dpred: I.dpred, dbut: I.dbut }});
            I.dpred = {{}}; I.dbut = ''; const cal = D.cal();
            const d0 = sviWNear(cal, '2026-10-05'), f0 = sviWAdd(cal, d0, 1), n0 = sviWAdd(cal, f0, 5);
            I.dlp = {{ 'l1|s1': [{{ id: 'q1', deb: d0, fin: f0 }}] }};
            const LKd = D.draft(); Object.keys(LKd).forEach(k => delete LKd[k]);
            D.apply('l1|s1', {{ deb: n0, fin: f0 }}, {{}});
            await new Promise(r => setTimeout(r, 300));
            document.querySelectorAll('#svConf [data-x]').forEach(b => b.click());
            const q = (I.dlp['l1|s1'] || [])[0] || (LKd['l1|s1'] || [])[0] || {{}};
            const r = [q.deb === n0, q.fin === sviWAdd(cal, n0, 1), sviWDur(cal, q.deb, q.fin)];
            const o = JSON.parse(save); I.dlp = o.dlp; I.dpred = o.dpred; I.dbut = o.dbut; Object.keys(LKd).forEach(k => delete LKd[k]); X.insSave(); X.refreshAll();
            return r; }}""")
        check("v639 : DÉBUT après la FIN — tâche déplacée avec sa durée", mv == [True, True, 2], mv)

        # ===== v519 : MARGE regroupée par LOT — un sous-lot se range juste sous son lot =====
        mo = pg.evaluate(f"""async () => {{ const X = {ins}; const I = X.INS; const save = JSON.stringify({{ lot: I.lot, links: I.links }});
            I.lot.push({{ id: 'lz', v: 'ETAGE 1 / ZONE A' }}, {{ id: 'la', v: 'AAA' }});
            /* sous-lot lié à une désignation plus loin (d2) que son lot (d1) : avant, il arrivait en bas */
            [['l2', 'd1'], ['la', 'd1'], ['lz', 'd2']].forEach(([lo, de], n) => I.links.push({{ id: 'Lq' + n, des: de, lot: lo, prim: 'p1', sec: 's2', prd: [], chg: [{{ id: 'c2' }}] }}));
            const CK = 'svi_colorder_v1'; let co0 = null; try {{ co0 = localStorage.getItem(CK); const o = JSON.parse(co0 || '{{}}'); o.lk_marge = ['lot', 'des', 'prim', 'sec']; localStorage.setItem(CK, JSON.stringify(o)); }} catch (e) {{}}
            X.insSave(); X.refreshAll(); document.querySelector('.bdg-d-tab[data-tab="lnk"]')?.click();
            await new Promise(r => setTimeout(r, 500));
            const names = [...document.querySelectorAll('.mg-table tr.mg-grp.mg-l0')].map(t => [...t.cells].map(c => c.textContent.replace(/[›⌄]/g, '').trim()).find(Boolean));
            const pad = [...document.querySelectorAll('.mg-table tr.mg-grp.mg-l0')].map(t => {{ const c = [...t.cells].find(c => c.textContent.trim()); return getComputedStyle(c).paddingLeft + '/' + Math.round(c.querySelector('.mg-f').getBoundingClientRect().left - c.getBoundingClientRect().left); }});
            window.__pad519 = pad;
            const o = JSON.parse(save); I.lot = o.lot; I.links = o.links; try {{ if (co0 === null) localStorage.removeItem(CK); else localStorage.setItem(CK, co0); }} catch (e) {{}} X.insSave(); X.refreshAll(); return [names, window.__pad519]; }}""")
        pads = mo[1] if isinstance(mo, list) else None; mo = mo[0] if isinstance(mo, list) else mo
        ok519 = isinstance(mo, list) and "ETAGE 1 / ZONE A" in mo and "ETAGE 1" in mo and mo.index("ETAGE 1 / ZONE A") == mo.index("ETAGE 1") + 1
        check("v519 : MARGE — sous-lot juste sous son lot", ok519, mo)
        check("v520 : MARGE — sous-lot décalé vers la droite", isinstance(pads, list) and int(str(pads[mo.index("ETAGE 1 / ZONE A")]).split("/")[-1]) >= int(str(pads[mo.index("ETAGE 1")]).split("/")[-1]) + 15, [mo, pads])

        # ===== v522 : import d'un tableau — PCB des charges lu dans la feuille (CHS en secours) ; exporté =====
        im = pg.evaluate("""() => { const sh = [...document.querySelectorAll('*')].find(e => e.__bfModel); if (!sh) return 'pas de lecture';
            const H = ['PROJET', 'DÉSIGNATION CLIENT', 'UPB', 'LOT', 'ACTIVITÉ PRIMAIRE', 'ACTIVITÉ SECONDAIRE', 'TYPE (PRD / CHG)', 'ARTICLE', 'DÉSIGNATION', 'UNITÉ', 'NBR', 'DIM 1', 'DIM 2', 'DIM 3', 'QTE', 'PCB'];
            const R = (des, q, p) => ['PROJET TEST', 'BETON EN FONDATION', 'M3', 'RDC', 'BETONNAGE', 'BETONNAGE', 'CHG', '', des, 'KG', '', '', '', '', q, p];
            const m = sh.__bfModel([H, R('FER TOR', '10', '12,50'), R('FER TOR', '5', ''), R('POINTES', '2', ''), R('FIL', '3', 'ABC')]);
            const P = d => (m.chg.find(x => x.row.des === d) || {}).row;
            return [P('FER TOR') && P('FER TOR').p, P('POINTES') ? (P('POINTES').p ?? '') : 'absent', m.rej.map(x => x.why).join(' ; ')]; }""")
        check("v522 : import — PCB de la charge lu dans la feuille, nombre non valide refusé", isinstance(im, list) and im[0] == 12.5 and im[1] in ("", None) and "PCB" in im[2], im)

        # ===== v523 : remarques 1 à 6 =====
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        pg.evaluate(f"""() => {{ const X = {ins}; for (let i = 0; i < 20; i++) X.INS.chg.push({{ id: 'yy' + i, des: 'CHARGE Y' + (10 + i), u: 'U', q: 1, p: 1 }});
            X.INS.chg.push({{ id: 'yg1', des: 'SABLE FIN', u: 'M3', q: 1, p: 1 }}, {{ id: 'yg2', des: 'SABLE FIN', u: 'M3', q: 2, p: 1 }}); X.insSave(); X.refreshAll();
            const pgD = document.querySelector('.bdg-d-page'); window.__hd0 = pgD.style.getPropertyValue('--h-detail'); pgD.style.setProperty('--h-detail', '300px');
            document.querySelector('.bdg-d-tab[data-tab="chg"]')?.click(); }}"""); pg.wait_for_timeout(500)
        # remarque 1 : ligne TOTAL devant les lignes ; cadre jamais sur le TOTAL
        r1 = pg.evaluate("""() => { const t = document.querySelector('table.ins-table[data-ik="chg"]'), sc = t.closest('.bdg-d-scroll'); sc.scrollTop = 0;
            const z = getComputedStyle(t.tFoot.querySelector('td')).zIndex;
            if (sc.scrollHeight <= sc.clientHeight + 30) return [z, 'tableau sans défilement ' + sc.scrollHeight + '/' + sc.clientHeight];
            /* une ligne du milieu amenée exactement sous la ligne TOTAL fixée */
            const R = [...t.tBodies[0].rows].filter(r => r.offsetParent !== null && r.querySelector('input.ins-in[data-f="q"]'));
            const under = R[Math.floor(R.length / 2)];
            sc.scrollTop += under.getBoundingClientRect().top - t.tFoot.getBoundingClientRect().top;
            const i = under.querySelector('input.ins-in[data-f="q"]') || under.cells[3]; window.__r1 = i; return [z, !!i]; }""")
        if isinstance(r1, list) and r1[1] is True:
            pg.evaluate("() => window.__r1.focus({ preventScroll: true })"); pg.wait_for_timeout(250)
            r1b = pg.evaluate("""() => { const t = document.querySelector('table.ins-table[data-ik="chg"]'), f = document.getElementById('sviSelFrame'); const ft = t.tFoot.getBoundingClientRect();
                return !f || f.style.display !== 'block' || f.getBoundingClientRect().bottom <= ft.top + 1; }""")
        else: r1b = None
        check("v523 remarque 1 : TOTAL devant les lignes, cadre jamais sur le TOTAL", isinstance(r1, list) and r1[0] == "9" and r1b is True, [r1, r1b])
        pg.evaluate("() => document.querySelector('.bdg-d-page').style.setProperty('--h-detail', window.__hd0 || '')")
        pg.keyboard.press("Escape"); pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        # remarque 2 : Entrée descend sur la ligne juste en dessous, même un titre regroupé (case grisée)
        r2 = pg.evaluate("""() => { const t = document.querySelector('table.ins-table[data-ik="chg"]'); const g = t.querySelector('tr.ins-gtitle');
            if (!g) return 'pas de titre'; let p = g.previousElementSibling; while (p && !p.querySelector('input.ins-in[data-f="q"]')) p = p.previousElementSibling;
            if (!p) return 'pas de ligne au-dessus'; p.dataset.r2 = '1'; g.dataset.r2g = '1'; return [p.dataset.iid, g.nextElementSibling === null || true]; }""")
        if isinstance(r2, list):
            pg.click('table.ins-table[data-ik="chg"] tr[data-r2="1"] input.ins-in[data-f="q"]'); pg.wait_for_timeout(150)
            pg.click('table.ins-table[data-ik="chg"] tr[data-r2="1"] input.ins-in[data-f="q"]'); pg.wait_for_timeout(150)
            pg.keyboard.press("Enter"); pg.wait_for_timeout(400)
            r2b = pg.evaluate("() => { const a = document.activeElement, tr = a && a.closest('tr'); return [!!tr && tr.classList.contains('ins-gtitle'), a.tagName]; }")
        else: r2b = None
        check("v523 remarque 2 : Entrée = ligne juste en dessous (titre regroupé compris)", r2b is not None and r2b[0] is True, [r2, r2b])
        pg.keyboard.press("Escape"); pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        # remarque 5 : Ctrl + toucher = sélection de cases qui ne se suivent pas (tableau) ; Cmd + toucher dans une liste
        Q = lambda iid: f'table.ins-table[data-ik="chg"] tr[data-iid="{iid}"] input.ins-in[data-f="q"]'
        pg.click(Q("yy0")); pg.wait_for_timeout(150)
        pg.keyboard.down("Control"); pg.click(Q("yy3")); pg.click(Q("yy5")); pg.keyboard.up("Control"); pg.wait_for_timeout(200)
        r5 = pg.evaluate("() => [window.__sviSel.count(), document.querySelectorAll('td.svi-cs').length]")
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        L = lambda iid: f'.ins-hcol[data-ik="sec"] .ins-li[data-iid="{iid}"] input.ins-in[data-f="v"]'
        pg.click(L("s1")); pg.wait_for_timeout(150)
        pg.keyboard.down("Meta"); pg.click(L("s2")); pg.keyboard.up("Meta"); pg.wait_for_timeout(200)
        r5b = pg.evaluate("() => window.__sviLS.count()")
        check("v523 remarque 5 : Ctrl / Cmd + toucher = cases ajoutées à la sélection (tableau et liste)", r5 == [3, 3] and r5b == 2, [r5, r5b])
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.chg = X.INS.chg.filter(r => !/^y/.test(r.id)); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        # remarque 3 : ligne tapée dans une liste = rond et case à cocher tout de suite
        pg.click('.ins-hcol[data-ik="lot"] .ins-li.ins-new input.ins-in'); pg.wait_for_timeout(150)
        pg.keyboard.type("ZZ ESSAI"); pg.wait_for_timeout(250)
        r3 = pg.evaluate("""() => { const i = document.activeElement, li = i.closest('.ins-li'); return [!!li.dataset.iid, !!li.querySelector('.lk-rd'), !!li.querySelector('input.ins-cb')]; }""")
        pg.mouse.click(5, 5); pg.wait_for_timeout(300)
        check("v523 remarque 3 : nouvelle ligne de liste avec rond et case à cocher", r3 == [True, True, True], r3)
        # remarque 4 : cocher puis supprimer des lots — les autres blocs ne restent pas vides
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.lot.forEach(r => r.on = false); X.INS.lot.filter(r => /ZZ ESSAI/.test(r.v)).forEach(r => r.on = true); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('.blk-hier .blk-more')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate("() => [...document.querySelectorAll('#blkMenu button')].find(b => /supprimer/i.test(b.textContent))?.click()"); pg.wait_for_timeout(500)
        pg.evaluate("() => document.querySelector('#svConf [data-ok], #svConf .svc-ok')?.click()"); pg.wait_for_timeout(700)
        r4 = pg.evaluate(f"""() => {{ const X = {ins}; const t = document.querySelector('.blk-client .ttl')?.parentElement?.textContent || ''; return [X.INS.lot.some(r => /ZZ ESSAI/.test(r.v)), document.querySelectorAll('#bdgClientBody tr[data-iid]').length > 0]; }}""")
        check("v523 remarque 4 : lots cochés supprimés — les autres tableaux s'affichent", r4 == [False, True], r4)
        # remarque 6 : boutons-icônes à la même taille
        r6 = pg.evaluate("() => [...document.querySelectorAll('.bdg-d-hright .inst-act:not([hidden]), .bdg-d-hright .inst-nav, .blk-more')].filter(b => b.offsetParent !== null).map(b => Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height))")
        check("v523 remarque 6 / v787 : boutons-icônes de la barre à la même taille (36 × 36) ; ⋯ des blocs plus petit (28 × 24)", len(r6) > 3 and all(x in ("36x36", "28x24") for x in r6) and r6[0] == "36x36" and r6[-1] == "28x24", r6)

        # ===== v524 : remarques 1 à 5 (bis) =====
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        # remarque 3 / 4 / 5 : rendement du titre de charges regroupées (une seule désignation client)
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS;
            I.prd.push({{ id: 'x8', des: 'BETON B25', u: 'M3', nbr: 20, d1: 1, d2: 1, d3: 1 }});
            I.chg.push({{ id: 'g1', des: 'SABLE TEST', u: 'M3', q: 2, p: 10 }}, {{ id: 'g2', des: 'SABLE TEST', u: 'M3', q: 3, p: 10 }});
            I.links.find(l => l.id === 'L1').chg.push({{ id: 'g1' }});
            I.links.push({{ id: 'L11', des: 'd1', lot: 'l2', prim: 'p1', sec: 's1', prd: [{{ id: 'x8' }}], chg: [{{ id: 'g2' }}] }});
            X.insSave(); X.refreshAll(); document.querySelector('.bdg-d-tab[data-tab="chg"]')?.click(); }}"""); pg.wait_for_timeout(500)
        RI = 'table.ins-table[data-ik="chg"] tr.ins-gtitle[data-grp="g1,g2"] input.ins-rdbin'
        # quantités de produit de la tâche de chaque ligne (même calcul que l'écran)
        QP = pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; return ['g1', 'g2'].map(id => {{ const l = I.links.find(l => (l.chg || []).some(x => x.id === id)); const sp = new Set(); let q = 0;
            I.links.filter(m => m.lot === l.lot && m.sec === l.sec).forEach(m => (m.prd || []).forEach(y => {{ if (sp.has(y.id)) return; sp.add(y.id); const p = I.prd.find(x => x.id === y.id); if (p) q += insPrdQ(p); }})); return q; }}); }}""")
        R3x = (QP[0] + QP[1]) / 5
        R4x = [max(0.5, round(q / 7 * 2) / 2) for q in QP]
        r3 = pg.evaluate("s => { const i = document.querySelector(s); return i ? [i.value, getComputedStyle(i).fontStyle] : null; }", RI)
        check("v524 remarque 3 : rendement en italique sur le titre (une seule désignation)", r3 is not None and abs(float(r3[0].replace(" ", "").replace(",", ".")) - R3x) < 0.006 and r3[1] == "italic", [r3, R3x])
        pg.evaluate("s => { const i = document.querySelector(s); i.focus(); i.value = '7'; i.dispatchEvent(new Event('change', { bubbles: true })); }", RI); pg.wait_for_timeout(400)
        pg.evaluate("() => document.querySelector('#svConf [data-r=\"1\"]')?.click()"); pg.wait_for_timeout(500)
        r4 = pg.evaluate(f"() => {{ const X = {ins}; return ['g1', 'g2'].map(id => X.INS.chg.find(r => r.id === id).q); }}")
        check("v524 remarque 4 : rendement tapé = quantités recalculées par tâche (produit de sa tâche ÷ rendement), arrondies à 0,5", r4 == R4x, [r4, R4x, QP])
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        pg.evaluate("s => { const i = document.querySelector(s); i.focus(); }", RI); pg.wait_for_timeout(150)
        pg.keyboard.press("Enter"); pg.wait_for_timeout(400)
        r5 = pg.evaluate("() => { const d = document.querySelector('#svConf'); return d ? /RENDEMENT/.test(d.textContent) : false; }")
        pg.evaluate("() => document.querySelector('#svConf [data-x], #svConf .svc-close')?.click()"); pg.wait_for_timeout(300)
        check("v524 remarque 5 : Entrée sur le rendement inchangé = proposer de l'appliquer aux lignes", r5 is True, r5)
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.chg = I.chg.filter(r => !['g1', 'g2'].includes(r.id)); I.prd = I.prd.filter(r => r.id !== 'x8');
            I.links = I.links.filter(l => l.id !== 'L11'); I.links.find(l => l.id === 'L1').chg = I.links.find(l => l.id === 'L1').chg.filter(x => x.id !== 'g1'); X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(300)
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        # remarque 2 : bloc vidé par les cases cochées des autres blocs → bandeau + TOUT RÉAFFICHER
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.chg.find(r => r.id === 'c2').on = true; I.lot.find(r => r.id === 'l2').on = true; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(500)
        r2 = pg.evaluate("() => document.querySelectorAll('.svi-empty').length")
        r82 = pg.evaluate("() => { const h = document.querySelector('.svi-empty'); return h ? [/AUCUNE LIGNE POUR LES FILTRES EN COURS/.test(h.textContent), h.querySelector('[data-clrall]')?.textContent] : null; }")
        check("v607 remarque 82 : bloc vidé = « AUCUNE LIGNE POUR LES FILTRES EN COURS » + EFFACER TOUS LES FILTRES", r82 == [True, "EFFACER TOUS LES FILTRES"], r82)
        pg.evaluate("() => document.querySelector('.svi-empty [data-clrall]')?.click()"); pg.wait_for_timeout(500)
        r2b = pg.evaluate(f"() => {{ const X = {ins}; return [document.querySelectorAll('.svi-empty').length, ['des', 'lot', 'chg'].every(k => !X.INS[k].some(r => r.on === true))]; }}")
        check("v524 remarque 2 : bloc vidé par les cases cochées → bandeau, TOUT RÉAFFICHER rend tout", r2 >= 1 and r2b == [0, True], [r2, r2b])
        # remarque 1 : le i d'une désignation passe sous la ligne TOTAL (même contexte d'empilement, TOTAL au-dessus)
        r1 = pg.evaluate("""() => { const t = document.querySelector('table.ins-table[data-ik="des"]'), i = t.querySelector('tbody .des-i'); if (!i) return 'pas de i';
            const ft = getComputedStyle(t.tFoot.querySelector('td')), td = getComputedStyle(i.closest('td')), tr = getComputedStyle(i.closest('tr'));
            return [Number(ft.zIndex), Number(getComputedStyle(i).zIndex), td.zIndex, tr.zIndex, ft.position]; }""")
        check("v524 remarque 1 : le i d'une désignation passe sous la ligne TOTAL", isinstance(r1, list) and r1[0] > r1[1] and r1[2] == "auto" and r1[3] == "auto" and r1[4] == "sticky", r1)

        # ===== v525 : remarques 1 à 7 (soir) =====
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        pg.evaluate("() => document.querySelector('.svi-empty [data-clrall]')?.click()"); pg.wait_for_timeout(300)
        # remarque 1 : rendement tapé sur une ligne de charge
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS;
            I.chg.push({{ id: 'h1', des: 'GRAVETTE TEST', u: 'M3', q: 2, p: 10 }});
            I.links.find(l => l.id === 'L1').chg.push({{ id: 'h1' }}); X.insSave(); X.refreshAll(); document.querySelector('.bdg-d-tab[data-tab="chg"]')?.click(); }}"""); pg.wait_for_timeout(500)
        q0 = pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; const l = I.links.find(l => l.id === 'L1'); const sp = new Set(); let q = 0;
            I.links.filter(m => m.lot === l.lot && m.sec === l.sec).forEach(m => (m.prd || []).forEach(y => {{ if (sp.has(y.id)) return; sp.add(y.id); const p = I.prd.find(x => x.id === y.id); if (p) q += insPrdQ(p); }})); return q; }}""")
        e1 = pg.evaluate("""() => { const i = document.querySelector('table.ins-table[data-ik="chg"] tr[data-iid="h1"] input.ins-rdbl'); if (!i) return null;
            const v0 = i.value; i.focus(); i.value = '4'; i.dispatchEvent(new Event('change', { bubbles: true })); return v0; }"""); pg.wait_for_timeout(400)
        q1 = pg.evaluate(f"() => {{ const X = {ins}; return X.INS.chg.find(r => r.id === 'h1').q; }}")
        check("v525 remarque 1 : rendement tapé sur une ligne = QCB recalculée (arrondie à 0,5)", e1 is not None and q1 == max(0.5, round(q0 / 4 * 2) / 2), [e1, q0, q1])
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; I.chg = I.chg.filter(r => r.id !== 'h1'); const l = I.links.find(l => l.id === 'L1'); l.chg = l.chg.filter(x => x.id !== 'h1'); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        # remarque 2 : rond d'un titre de niveau = toutes les lignes liées dessous ; remarque 5 : titre de niveau déplaçable
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS;
            I.lot.push({{ id: 'ta', v: 'TOIT / NIVEAU 1 / ZONE A' }}, {{ id: 'tb', v: 'TOIT / NIVEAU 1 / ZONE B' }}, {{ id: 'tc', v: 'TOIT / NIVEAU 2 / ZONE C' }});
            ['ta', 'tb'].forEach((lo, n) => I.links.push({{ id: 'LT' + n, des: 'd2', lot: lo, prim: 'p1', sec: 's2', prd: [], chg: [{{ id: 'c2' }}] }}));
            X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        UNF = """() => { const f = [...document.querySelectorAll('.ins-hcol[data-ik="lot"] .lot-fold')].find(x => x.textContent.trim() === '›'); if (!f) return false; f.click(); return true; }"""
        for _ in range(6):
            if not pg.evaluate(UNF): break
            pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('.ins-hcol[data-ik=\"lot\"] .lot-grp[data-path=\"TOIT / NIVEAU 1\"] .lk-rdgrp')?.click()"); pg.wait_for_timeout(400)
        r2 = pg.evaluate("""() => { const on = id => !!document.querySelector('.ins-hcol[data-ik="lot"] .ins-li[data-iid="' + id + '"] .lk-rd.on');
            return [!!document.querySelector('.lot-grp[data-path="TOIT / NIVEAU 1"] .lk-rdgrp.on'), on('ta'), on('tb'), on('tc'), on('l1')]; }""")
        pg.evaluate("() => document.querySelector('.ins-hcol[data-ik=\"lot\"] .lot-grp[data-path=\"TOIT / NIVEAU 1\"] .lk-rdgrp')?.click()"); pg.wait_for_timeout(400)
        r2b = pg.evaluate("() => !!document.querySelector('.ins-hcol[data-ik=\"lot\"] .lk-rd.on')")
        check("v525 remarque 2 : rond du titre de niveau = toutes ses lignes liées ; retoucher = libérer", r2 == [True, True, True, False, False] and r2b is False, [r2, r2b])
        pg.evaluate("""() => { const b = document.querySelector('.lot-grp[data-path="TOIT / NIVEAU 1"]'); if (!b) return; b.scrollIntoView({ block: 'center' });
            let sc = b.parentElement; while (sc && !(sc.scrollHeight > sc.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
            if (sc) sc.scrollTop += b.getBoundingClientRect().top - sc.getBoundingClientRect().top - 40;
            /* v786 : la ligne « CRÉER … ICI » reste fixée en bas du bloc — NIVEAU 2 doit rester au-dessus d'elle */
            const nr = sc && [...sc.querySelectorAll('.ins-li.ins-new')].find(x => x.offsetParent), ga = document.querySelector('.lot-grp[data-path="TOIT / NIVEAU 2"] input.lot-gname');
            if (nr && ga) { const over = ga.getBoundingClientRect().bottom + 6 - nr.getBoundingClientRect().top; if (over > 0) sc.style.minHeight = sc.style.height = (sc.clientHeight + over + 10) + 'px'; } }"""); pg.wait_for_timeout(300)
        g = pg.evaluate("""() => { const a = document.querySelector('.lot-grp[data-path="TOIT / NIVEAU 2"]'), b = document.querySelector('.lot-grp[data-path="TOIT / NIVEAU 1"]'); if (!a || !b) return null;
            const ia = a.querySelector('input.lot-gname').getBoundingClientRect(), rb = b.getBoundingClientRect(); return [ia.left + ia.width / 2, ia.top + ia.height / 2, ia.left + ia.width / 2, rb.top + 2]; }""")
        if g:
            pg.mouse.move(g[0], g[1]); pg.mouse.down(); pg.wait_for_timeout(700)
            pg.mouse.move(g[2], g[3] + 3, steps=6); pg.wait_for_timeout(150); pg.mouse.move(g[2], g[3], steps=3); pg.wait_for_timeout(150)
            pg.mouse.up(); pg.wait_for_timeout(500)
        r5 = pg.evaluate(f"() => {{ const X = {ins}; const ids = X.INS.lot.map(r => r.id); return [ids.indexOf('tc'), ids.indexOf('ta'), (X.INS.lot.find(r => r.id === 'tc') || {{}}).v]; }}")
        check("v525 remarque 5 : titre de niveau glissé avec ses lots (NIVEAU 2 au-dessus de NIVEAU 1)", g is not None and r5[0] >= 0 and r5[0] < r5[1] and r5[2] == "TOIT / NIVEAU 2 / ZONE C", [g, r5])
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; I.lot = I.lot.filter(r => !['ta', 'tb', 'tc'].includes(r.id)); I.links = I.links.filter(l => !/^LT/.test(l.id)); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        # remarque 4 : loupe sur la colonne U des activités
        r4 = pg.evaluate("""() => ['prim', 'sec'].map(k => { const b = document.querySelector('.ins-hcol[data-ik="' + k + '"] .act-uh .cf-btn[data-col="u"]'); return !!b; })""")
        pg.evaluate("() => document.querySelector('.ins-hcol[data-ik=\"sec\"] .act-uh .cf-btn')?.click()"); pg.wait_for_timeout(300)
        r4b = pg.evaluate("() => !!document.getElementById('cfMenu')")
        pg.keyboard.press("Escape"); pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        check("v525 remarque 4 : loupe (tri / filtre) sur la colonne U des activités", r4 == [True, True] and r4b, [r4, r4b])
        # remarque 6 : glisser une ligne jusqu'au bord = le tableau défile tout seul (DÉSIGNATIONS CLIENT)
        pg.evaluate(f"""() => {{ const X = {ins}; for (let i = 0; i < 25; i++) X.INS.des.push({{ id: 'dw' + i, d: 1, art: '8.' + i, des: 'DESIG W' + i, u: 'U', q: 1, p: 1, tva: 20 }}); X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(500)
        d6 = pg.evaluate("""() => { const t = document.querySelector('table.ins-table[data-ik="des"]'); let sc = t.parentElement; while (sc && !(sc.scrollHeight > sc.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
            if (!sc) return null; sc.scrollIntoView({ block: 'center' }); sc.scrollTop = 0;
            const tr = [...t.tBodies[0].rows].filter(r => r.dataset.iid && r.offsetParent !== null)[1]; const c = tr.querySelector('.ins-dv') || tr.cells[2]; const r = c.getBoundingClientRect(), s = sc.getBoundingClientRect();
            return [r.left + 20, r.top + r.height / 2, s.bottom - 4, sc.scrollHeight > sc.clientHeight + 40]; }""")
        if d6:
            pg.mouse.move(d6[0], d6[1]); pg.mouse.down(); pg.wait_for_timeout(700)
            pg.mouse.move(d6[0], d6[2], steps=8); pg.wait_for_timeout(700)
        s6 = pg.evaluate("""() => { const t = document.querySelector('table.ins-table[data-ik="des"]'); let sc = t.parentElement; while (sc && !(sc.scrollHeight > sc.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement; return sc ? sc.scrollTop : -1; }""")
        pg.keyboard.press("Escape"); pg.mouse.move(5, 5); pg.mouse.up(); pg.wait_for_timeout(400)
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.des = X.INS.des.filter(r => !/^dw/.test(r.id)); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        check("v525 remarque 6 : glisser près du bord bas = défilement automatique", d6 is not None and d6[3] and s6 > 20, [d6, s6])

        # ===== v527 : remarques du 22/10 (fin de journée) =====
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        pg.evaluate("() => document.querySelector('.svi-empty [data-clrall]')?.click()"); pg.wait_for_timeout(300)
        # remarque 1 : appui long sur une ligne du DÉTAIL CHARGES = pas de trait de déplacement
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"chg\"]')?.click()"); pg.wait_for_timeout(400)
        c1 = pg.evaluate("""() => { const tr = [...document.querySelectorAll('table.ins-table[data-ik="chg"] tbody tr[data-iid]')].find(t => t.offsetParent !== null); tr.scrollIntoView({ block: 'center' }); const r = tr.cells[2].getBoundingClientRect(); return [r.left + 10, r.top + r.height / 2]; }""")
        pg.mouse.move(c1[0], c1[1]); pg.mouse.down(); pg.wait_for_timeout(700); pg.mouse.move(c1[0], c1[1] + 30, steps=5); pg.wait_for_timeout(200)
        n1 = pg.evaluate("() => [!!document.getElementById('roLine'), document.body.classList.contains('svi-dragging')]")
        pg.mouse.up(); pg.keyboard.press("Escape"); pg.mouse.click(5, 5); pg.wait_for_timeout(300)
        check("v527 remarque 1 : appui long sur une ligne de charge = aucun trait (pas de déplacement)", n1 == [False, False], n1)
        # remarque 2 : titre « DÉTAIL CHARGES — FORMAT TABLEAU »
        pg.evaluate("() => { const s = [...document.querySelectorAll('*')].find(e => e.__sd); s && s.__sd('chg'); }"); pg.wait_for_timeout(600)
        t2 = pg.evaluate("() => (document.querySelector('#sdW .sd-title') || {}).textContent || ''")
        pg.evaluate("() => document.querySelector('#sdW [data-x]')?.click()"); pg.wait_for_timeout(400)
        check("v527 remarque 2 : titre « DÉTAIL CHARGES — FORMAT TABLEAU »", t2.strip() == "DÉTAIL CHARGES — FORMAT TABLEAU", t2)
        # remarque 3 : GROUPE au lieu de NIVEAU (anciens noms NIVEAU n affichés GROUPE n)
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.lot.push({{ id: 'gv', v: 'TOIT / NIVEAU 1 / ZONE V' }}); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        for _ in range(6):
            if not pg.evaluate(UNF): break
            pg.wait_for_timeout(300)
        t3 = pg.evaluate("() => { const i = document.querySelector('.lot-grp[data-path=\"TOIT / NIVEAU 1\"] input.lot-gname'); return i ? i.value : null; }")
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.lot = X.INS.lot.filter(r => r.id !== 'gv'); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        check("v527 remarque 3 : titre de groupe affiché « GROUPE … »", isinstance(t3, str) and t3.startswith("GROUPE "), t3)
        # remarque 5 : cases cochées qui se contredisent → bandeau avec DÉCOCHER par bloc
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.chg.find(r => r.id === 'c2').on = true; I.lot.find(r => r.id === 'l2').on = true; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(500)
        b5 = pg.evaluate("() => [...document.querySelectorAll('.svi-empty [data-clrk]')].map(b => b.dataset.clrk)")
        pg.evaluate("() => document.querySelector('.svi-empty [data-clrk=\"lot\"]')?.click()"); pg.wait_for_timeout(500)
        b5b = pg.evaluate(f"() => {{ const X = {ins}; return [X.INS.lot.some(r => r.on === true), X.INS.chg.find(r => r.id === 'c2').on === true]; }}")
        pg.evaluate("() => document.querySelector('.svi-empty [data-clrall]')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.chg.forEach(r => r.on = false); X.INS.lot.forEach(r => r.on = false); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        check("v527 remarque 5 : bandeau qui nomme les cases contradictoires, DÉCOCHER LOTS ne décoche que les lots", "lot" in b5 and b5b == [False, True], [b5, b5b])
        # remarque 6 : BATTEMENT dans le planning
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"dly\"]')?.click()"); pg.wait_for_timeout(500)
        t6 = pg.evaluate("() => [...document.querySelectorAll('th')].map(t => t.textContent.trim()).filter(t => /BATTEMENT|^MARGE$/.test(t))")
        check("v527 remarque 6 : marge de délai = BATTEMENT", any("BATTEMENT" in x for x in t6) and "MARGE" not in t6, t6)

        # ===== v528 : bloc TÂCHES =====
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        pg.evaluate("() => document.querySelector('.svi-empty [data-clrall]')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS;
            I.lot.push({{ id: 'na', v: 'NIVEAU 2 / ZONE A' }}, {{ id: 'nb', v: 'NIVEAU 2 / ZONE B' }}, {{ id: 'nc', v: 'NIVEAU 3 / ZONE C' }});
            ['na', 'nb', 'nc'].forEach((lo, n) => I.links.push({{ id: 'LN' + n, des: 'd2', lot: lo, prim: 'p1', sec: 's2', prd: [], chg: [{{ id: 'c2' }}] }}));
            X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        for _ in range(8):
            if not pg.evaluate(UNF): break
            pg.wait_for_timeout(300)
        # remarque 4 : anciens titres « NIVEAU n » (premier rang) affichés « GROUPE n »
        t4 = pg.evaluate("() => ['NIVEAU 2', 'NIVEAU 3'].map(p => { const i = document.querySelector('.lot-grp[data-path=\"' + p + '\"] input.lot-gname'); return i ? i.value : null; })")
        check("v528 remarque 4 : anciens titres « NIVEAU » affichés « GROUPE » + numéro", all(isinstance(x, str) and x.startswith("GROUPE ") for x in t4), t4)
        # remarque 3 : choisir un groupe ne change pas l'ordre de la liste
        ordr = "() => [...document.querySelectorAll('.ins-hcol[data-ik=\"lot\"] .ins-li')].map(x => x.dataset.path || x.dataset.iid).join('|')"
        o0 = pg.evaluate(ordr)
        pg.evaluate("() => document.querySelector('.lot-grp[data-path=\"NIVEAU 2\"] .lk-rdgrp')?.click()"); pg.wait_for_timeout(400)
        o1 = pg.evaluate(ordr)
        pg.evaluate("() => document.querySelector('.lot-grp[data-path=\"NIVEAU 2\"] .lk-rdgrp')?.click()"); pg.wait_for_timeout(300)
        check("v528 remarque 3 : choisir un groupe ne change pas l'ordre de la liste des lots", o0 == o1, [o0, o1])
        # remarque 1 : rond d'en-tête = ronds des titres aussi
        pg.evaluate("() => document.querySelector('.ins-hcol[data-ik=\"lot\"] .lk-rdall')?.click()"); pg.wait_for_timeout(400)
        r1 = pg.evaluate("() => [...document.querySelectorAll('.ins-hcol[data-ik=\"lot\"] .lk-rdgrp')].map(x => x.classList.contains('on'))")
        pg.evaluate("() => document.querySelector('.ins-hcol[data-ik=\"lot\"] .lk-rdall')?.click()"); pg.wait_for_timeout(300)
        check("v528 remarque 1 : rond d'en-tête = ronds des titres de groupe marqués aussi", len(r1) >= 2 and all(r1), r1)
        # remarque 2 : case carrée d'en-tête (activités : la loupe U ne la couvre plus ; lots : groupes repliés compris)
        h2 = pg.evaluate("""() => ['prim', 'sec'].map(k => { const cb = document.querySelector('.ins-hcol[data-ik="' + k + '"] .ins-cball'); const r = cb.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === cb; })""")
        pg.evaluate("() => document.querySelector('.lot-fold[data-path=\"NIVEAU 3\"]')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('.ins-hcol[data-ik=\"lot\"] .ins-cball')?.click()"); pg.wait_for_timeout(400)
        h2b = pg.evaluate(f"() => {{ const X = {ins}; return ['na', 'nb', 'nc', 'l1'].map(id => X.INS.lot.find(r => r.id === id).on === true); }}")
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; I.lot = I.lot.filter(r => !['na', 'nb', 'nc'].includes(r.id)); I.lot.forEach(r => r.on = false); I.links = I.links.filter(l => !/^LN/.test(l.id)); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        check("v528 remarque 2 : case carrée d'en-tête accessible (activités) et coche les lots des groupes repliés", h2 == [True, True] and all(h2b), [h2, h2b])

        # ===== v529 : titres, sous-groupes, noms de groupe, glisser dans la liste des lots =====
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        pg.set_viewport_size({"width": 1180, "height": 1400}); pg.wait_for_timeout(300)
        S29 = f"""() => {{ const X = {ins}; const I = X.INS; I.lot = I.lot.filter(r => ['l1', 'l2'].includes(r.id)); I.lot.forEach(r => r.on = false);
            I.lot.push({{ id: 'mv', v: 'MOVE' }}, {{ id: 'ga', v: 'GROUPE 4 / ZONE A' }}, {{ id: 'gb', v: 'GROUPE 4 / ZONE B' }}, {{ id: 'gs', v: 'GROUPE 4 / GROUPE 4.1 / ZONE S' }}, {{ id: 'gc', v: 'GROUPE 5 / ZONE C' }});
            I.links = I.links.filter(l => !/^L9/.test(l.id)); ['ga', 'gs'].forEach((lo, n) => I.links.push({{ id: 'L9' + n, des: 'd2', lot: lo, prim: 'p1', sec: 's2', prd: [], chg: [{{ id: 'c2' }}] }}));
            X.insSave(); X.refreshAll(); }}"""
        def set29(fold=()):
            pg.evaluate(S29); pg.wait_for_timeout(300)
            for _ in range(8):
                if not pg.evaluate(UNF): break
                pg.wait_for_timeout(250)
            for p_ in fold:
                pg.evaluate("p => document.querySelector('.lot-fold[data-path=\"' + p + '\"]')?.click()", p_); pg.wait_for_timeout(250)
            pg.evaluate("""() => { const b = document.querySelector('.ins-hcol[data-ik="lot"] .ins-li[data-iid="mv"]'); b.scrollIntoView({ block: 'center' });
                let sc = b.parentElement; while (sc && !(sc.scrollHeight > sc.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
                if (sc) { sc.style.maxHeight = 'none'; sc.style.height = (sc.scrollHeight + 40) + 'px'; sc.scrollTop = 0; } }"""); pg.wait_for_timeout(250)
        def drag29(sel, frac, dx):
            a = pg.evaluate("""() => { const r = document.querySelector('.ins-li[data-iid="mv"] input.ins-in').getBoundingClientRect(); return [r.left + 20, r.top + r.height / 2]; }""")
            t = pg.evaluate("""([s, f]) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.top + r.height * f; }""", [sel, frac])
            if t is None: return None
            pg.mouse.move(a[0], a[1]); pg.mouse.down(); pg.wait_for_timeout(700)
            pg.mouse.move(a[0], t - 3, steps=6); pg.wait_for_timeout(100); pg.mouse.move(a[0] + dx, t, steps=4); pg.wait_for_timeout(150)
            pg.mouse.up(); pg.wait_for_timeout(500)
            return pg.evaluate(f"() => {{ const L = {ins}.INS.lot; const m = L.find(r => r.id === 'mv'); return [m.v, L.indexOf(m)]; }}")
        LG = '.ins-hcol[data-ik="lot"] '
        set29(); g1 = drag29(LG + '.lot-grp[data-path="GROUPE 4 / GROUPE 4.1"]', .9, -80)
        set29(); g1b = drag29(LG + '.lot-grp[data-path="GROUPE 4"]', .9, -80)
        check("v529 remarques 4-5 : déposé juste sous un titre de groupe = dans ce groupe, sans choix (doigt à gauche compris)",
              g1 and g1[0] == "GROUPE 4 / GROUPE 4.1 / MOVE" and g1b and g1b[0] == "GROUPE 4 / MOVE", [g1, g1b])
        set29(); g2 = drag29(LG + '.ins-li[data-iid="gb"]', .1, -80)
        check("v529 remarque 4 : déposé entre deux lignes d'un groupe = reste dans le groupe", g2 and g2[0] == "GROUPE 4 / MOVE", g2)
        set29(); g3a = drag29(LG + '.ins-li[data-iid="gs"]', .9, 0)
        set29(); g3b = drag29(LG + '.ins-li[data-iid="gs"]', .9, -30)
        set29(); g3c = drag29(LG + '.ins-li[data-iid="gs"]', .9, -80)
        check("v529 remarques 4-5 : sous la dernière ligne d'un groupe déplié : trait court = dedans, plus long = rang du dessus, puis premier rang",
              [g3a and g3a[0], g3b and g3b[0], g3c and g3c[0]] == ["GROUPE 4 / GROUPE 4.1 / MOVE", "GROUPE 4 / MOVE", "MOVE"], [g3a, g3b, g3c])
        set29(("GROUPE 4", "GROUPE 5")); g4a = drag29(LG + '.lot-grp[data-path="GROUPE 4"]', .9, 0)
        set29(("GROUPE 4", "GROUPE 5")); g4b = drag29(LG + '.lot-grp[data-path="GROUPE 4"]', .9, -80)
        o4 = pg.evaluate(f"() => {{ const L = {ins}.INS.lot; return [L.findIndex(r => r.id === 'mv'), L.findIndex(r => r.id === 'gs'), L.findIndex(r => r.id === 'gc')]; }}")
        check("v529 remarque 4 : entre deux groupes repliés : trait court = dans le groupe du dessus, trait long = même rang, entre les deux",
              g4a and g4a[0] == "GROUPE 4 / MOVE" and g4b and g4b[0] == "MOVE" and o4[1] < o4[0] < o4[2], [g4a, g4b, o4])
        # remarque 1 : rond d'un groupe = ses sous-groupes allumés aussi
        set29()
        pg.evaluate("() => document.querySelector('.lot-grp[data-path=\"GROUPE 4\"] .lk-rdgrp')?.click()"); pg.wait_for_timeout(400)
        s1 = pg.evaluate("() => ['GROUPE 4', 'GROUPE 4 / GROUPE 4.1', 'GROUPE 5'].map(p => !!document.querySelector('.lot-grp[data-path=\"' + p + '\"] .lk-rdgrp.on'))")
        pg.evaluate("() => document.querySelector('.lot-grp[data-path=\"GROUPE 4\"] .lk-rdgrp')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('.lot-grp[data-path=\"GROUPE 4\"] .lot-gcb')?.click()"); pg.wait_for_timeout(400)
        s1b = pg.evaluate("() => [!!document.querySelector('.lot-grp[data-path=\"GROUPE 4 / GROUPE 4.1\"] .lot-gcb:checked'), !!document.querySelector('.lot-grp[data-path=\"GROUPE 5\"] .lot-gcb:checked')]")
        pg.evaluate("() => document.querySelector('.lot-grp[data-path=\"GROUPE 4\"] .lot-gcb')?.click()"); pg.wait_for_timeout(300)
        check("v529 remarque 1 : rond ou case carrée d'un groupe = ses sous-groupes aussi", s1 == [True, True, False] and s1b == [True, False], [s1, s1b])
        # remarque 2 : titres bleu foncé sur ligne grisée (lots, désignations, planning)
        C2 = """s => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); return c.webkitTextFillColor; }"""
        t2 = [pg.evaluate(C2, '.lot-grp input.lot-gname'), pg.evaluate("() => getComputedStyle(document.querySelector('.ins-hcol .lot-grp')).backgroundColor"),
              pg.evaluate(C2, '#bdgClientBody tr.ins-title input.ins-in') or pg.evaluate(C2, '#bdgClientBody tr.ins-title td')]
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"dly\"]')?.click()"); pg.wait_for_timeout(500)
        t2.append(pg.evaluate(C2, '#bdgTabBody tr.dly-grp input.dly-nm') or pg.evaluate(C2, '#bdgTabBody tr.dly-grp td'))
        check("v529 remarque 2 / v788 : titres même couleur sur ligne gris chaud partout (lots, désignations, planning) — jamais le bleu des filtres",
              t2 == ["rgb(47, 42, 36)", "rgb(236, 232, 225)", "rgb(47, 42, 36)", "rgb(47, 42, 36)"], t2)
        # remarque 3 : nom tapé sur un titre gardé même si l'écran est redessiné sans quitter la case (iPad)
        pg.evaluate("() => { const i = document.querySelector('.lot-grp[data-path=\"GROUPE 5\"] input.lot-gname'); i.focus(); i.value = 'SOUS-SOL'; i.dispatchEvent(new Event('input', { bubbles: true })); }")
        pg.evaluate("() => document.querySelector('.lot-fold[data-path=\"GROUPE 4\"]')?.click()"); pg.wait_for_timeout(500)
        pg.evaluate("() => document.querySelector('.lot-fold[data-path=\"GROUPE 4\"]')?.click()"); pg.wait_for_timeout(300)
        n3 = pg.evaluate(f"() => [{ins}.INS.lot.find(r => r.id === 'gc').v, (document.querySelector('.lot-grp[data-path=\"SOUS-SOL\"] input.lot-gname') || {{}}).value]")
        check("v529 remarque 3 : nom SOUS-SOL tapé sur un titre de groupe gardé (plus de retour à GROUPE n)", n3 == ["SOUS-SOL / ZONE C", "SOUS-SOL"], n3)
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; I.lot = I.lot.filter(r => ['l1', 'l2'].includes(r.id)); I.links = I.links.filter(l => !/^L9/.test(l.id)); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        pg.set_viewport_size({"width": 1180, "height": 820}); pg.wait_for_timeout(300)

        # ===== v530 : pastilles des titres, sous-groupes décalés, planning GÉNÉRER / COMPRESSER / plafond, conditionnement =====
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        pg.set_viewport_size({"width": 1180, "height": 1100}); pg.wait_for_timeout(300)
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.lot = I.lot.filter(r => ['l1', 'l2'].includes(r.id));
            I.lot.push({{ id: 'pa', v: 'GROUPE 4 / ZONE A' }}, {{ id: 'ps', v: 'GROUPE 4 / GROUPE 4.1 / ZONE S' }}, {{ id: 'pt', v: 'GROUPE 4 / GROUPE 4.1 / ZONE T' }});
            X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(300)
        for _ in range(8):
            if not pg.evaluate(UNF): break
            pg.wait_for_timeout(250)
        pg.evaluate("() => document.querySelector('.lot-grp[data-path=\"GROUPE 4 / GROUPE 4.1\"] .lk-rdgrp')?.click()"); pg.wait_for_timeout(400)
        q1 = pg.evaluate("""() => ['GROUPE 4', 'GROUPE 4 / GROUPE 4.1'].map(p => { const b = document.querySelector('.lot-grp[data-path="' + p + '"] .lk-rdgrp'); return b ? [b.textContent.trim(), b.classList.contains('lk-pst'), b.classList.contains('on'), b.classList.contains('part')] : null; })""")
        pg.evaluate("() => document.querySelector('.lot-grp[data-path=\"GROUPE 4 / GROUPE 4.1\"] .lk-rdgrp')?.click()"); pg.wait_for_timeout(300)
        q1b = pg.evaluate("() => { const b = document.querySelector('#bdgClientBody tr.ins-title .lk-rdgrp'); return b ? [b.textContent.trim(), !!b.closest('td.ins-rdc'), !!document.querySelector('#bdgClientBody tr.ins-title td.ins-tdv .ins-fold')] : null; }")
        check("v530 remarque 1 : pastille chiffrée sur les titres (groupe parent à moitié, sous-groupe plein ; DÉSIGNATIONS CLIENT aussi)",
              q1 == [["3", True, False, True], ["2", True, True, False]] and q1b and q1b[1] and q1b[2], [q1, q1b])
        q2 = pg.evaluate("""() => { const m = s => { const e = document.querySelector(s); return e ? parseFloat(getComputedStyle(e).marginLeft) : null; };
            return [m('.lot-grp[data-path="GROUPE 4"] .lot-in'), m('.lot-grp[data-path="GROUPE 4 / GROUPE 4.1"] .lot-in'), m('.ins-li[data-iid="pa"] .lot-in')]; }""")
        check("v530 remarque 2 / v787 : sous-groupe au rang de ses lots frères (numéro, signe, nom)", q2 == [0, 16, 16], q2)
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; I.lot = I.lot.filter(r => ['l1', 'l2'].includes(r.id)); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        # DÉTAIL PRODUITS : la pastille du titre choisit / libère tous ses produits
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.prd.push({{ id: 'x9', des: 'BETON B25', u: 'M3', nbr: 2, d1: 1, d2: 1, d3: 1 }}); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"prd\"]')?.click()"); pg.wait_for_timeout(500)
        pg.evaluate("() => document.querySelector('table.ins-table[data-ik=\"prd\"] .ins-grpn.ins-grd')?.click()"); pg.wait_for_timeout(400)
        q3 = pg.evaluate("() => (document.querySelector('table.ins-table[data-ik=\"prd\"] .ins-grpn') || {}).className || ''")
        pg.evaluate("() => document.querySelector('table.ins-table[data-ik=\"prd\"] .ins-grpn.ins-grd')?.click()"); pg.wait_for_timeout(400)
        q3b = pg.evaluate("() => (document.querySelector('table.ins-table[data-ik=\"prd\"] .ins-grpn') || {}).className || ''")
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.prd = X.INS.prd.filter(r => r.id !== 'x9'); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        check("v530 remarque 1 : pastille d'un titre du DÉTAIL PRODUITS = choisir / libérer tous ses produits", " on" in q3 and " on" not in q3b and "ins-grd" in q3, [q3, q3b])
        # planning : GÉNÉRER (tâches sans dates, J-H ÷ ouvriers, demi-journées, liaison FD −1 = même jour)
        DXJ = "[...document.querySelectorAll('*')].find(e => e.__insDly).__insDly"
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS;
            I.chg.push({{ id: 'j1', des: 'MAIN D OEUVRE A', u: 'JH', q: 4, p: 100 }}, {{ id: 'j2', des: 'MAIN D OEUVRE B', u: 'JH', q: 1, p: 100 }}, {{ id: 'j3', des: 'MAIN D OEUVRE C', u: 'JH', q: 3, p: 100 }});
            I.__lk = I.links; I.__dlp = I.dlp; I.__dp = I.dpred; I.__pd0 = I.pdeb || '';
            I.links = [{{ id: 'G1', des: 'd1', lot: 'l2', prim: 'p1', sec: 's1', prd: [], chg: [{{ id: 'j1' }}] }}, {{ id: 'G2', des: 'd1', lot: 'l2', prim: 'p1', sec: 's2', prd: [], chg: [{{ id: 'j2' }}] }},
              {{ id: 'G3', des: 'd2', lot: 'l1', prim: 'p1', sec: 's1', prd: [], chg: [{{ id: 'j3' }}] }}];
            I.dlp = {{}}; I.dpred = {{}}; I.plaf = 0; I.plafs = []; I.plafR = {{}}; I.dinc = {{}}; I.dord = ['l2|s1', 'l2|s2', 'l1|s1'];
            I.chg.filter(r => /^j[123]$/.test(r.id)).forEach(r => {{ r.on = true; }});
            X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"dly\"]')?.click()"); pg.wait_for_timeout(600)
        # v543 (R25, R26) : plus de fenêtre — date de début du projet (INF) et CAPACITÉ de la barre (2) pour les charges cochées
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.pdeb = '2026-11-02'; I.plafR = {{ 'MAIN D OEUVRE A|J-H § MAIN D OEUVRE B|J-H § MAIN D OEUVRE C|J-H': {{ plaf: 2 }} }}; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        pg.evaluate(f"() => {DXJ}.gen()"); pg.wait_for_timeout(800)
        g5 = pg.evaluate(f"() => {{ const I = {ins}.INS, P = k => {{ const p = (I.dlp[k] || [])[0] || {{}}; return [p.deb, p.fin, !!p.dmd, !!p.fmd]; }}; return [P('l2|s1'), P('l2|s2'), P('l1|s1'), JSON.stringify(I.dpred['l2|s2'] || []), JSON.stringify(I.dpred['l1|s1'] || [])]; }}")
        check("v530 planning : GÉNÉRER — J-H ÷ ouvriers en demi-journées, tâche suivante dans la demi-journée libre, liaisons FIN → DÉBUT",
              g5[:3] == [["2026-11-02", "2026-11-03", False, False], ["2026-11-04", "2026-11-04", False, True], ["2026-11-04", "2026-11-05", True, False]]
              and '"o":0' in g5[3] and '"o":0' in g5[4], g5)   # v617 (remarque 86) : 0 = demi-journée suivante
        # plafond coupé (appui long) puis morceau tiré : 4 ouvriers à partir du 04/11 ; COMPRESSER
        pg.evaluate("() => document.querySelector('.ghist')?.scrollIntoView({ block: 'center' })"); pg.wait_for_timeout(300)
        pl = pg.evaluate("() => { const g = document.querySelector('.dlyg-foot .gplaf'); const h = document.querySelector('#dlyGantt'); if (!g) return null; const x0 = h.__d0; const r = g.getBoundingClientRect(); return [r.left, r.top, r.width, x0]; }")
        cutok = False
        if pl:
            dw = pg.evaluate("() => parseFloat(getComputedStyle(document.querySelector('#dlyGantt')).getPropertyValue('--dw')) || 22")
            n = pg.evaluate("d0 => Math.round((new Date('2026-11-04T00:00:00') - new Date(d0 + 'T00:00:00')) / 864e5)", pl[3])
            hx = pg.evaluate("() => document.querySelector('.dlyg-foot .ghist').getBoundingClientRect().left")
            x = hx + n * dw + dw / 2
            # v628 : Gantt ajusté à l'ouverture (jours plus larges) — le jour visé est amené dans la partie visible
            pg.evaluate("x => { const h = document.querySelector('#dlyGantt'); h.scrollLeft = Math.max(0, h.scrollLeft + x - h.getBoundingClientRect().left - Math.min(200, h.clientWidth / 2)); }", x)   # v748 : défilement de départ compté; pg.wait_for_timeout(200)
            hx = pg.evaluate("() => document.querySelector('.dlyg-foot .ghist').getBoundingClientRect().left"); x = hx + n * dw + dw / 2
            y = pg.evaluate("() => { const r = document.querySelector('.dlyg-foot .gplaf').getBoundingClientRect(); return r.top + 1; }")
            # v542 (R2) : appui long = « / » et bulle COUPER ICI qui suivent le doigt ; lâcher = couper à ce jour
            pg.mouse.move(x, y); pg.mouse.down(); pg.wait_for_timeout(800)
            cutok = pg.evaluate("() => /COUPER ICI/.test((document.getElementById('dlyCutTip') || {}).textContent || '')")
            pg.mouse.up(); pg.wait_for_timeout(500)
        segs = pg.evaluate(f"() => JSON.stringify(Object.values({ins}.INS.plafR || {{}}).map(x => x.plafs || []))")
        pg.evaluate(f"() => {DXJ}.plafSeg(1, 4)"); pg.wait_for_timeout(300)
        pg.evaluate(f"""() => {{ const I = {ins}.INS; I.dpred = {{}}; I.dlp['l2|s2'] = [{{ id: 'b', deb: '2026-11-09', fin: '2026-11-09' }}]; I.dlp['l1|s1'] = [{{ id: 'c', deb: '2026-11-12', fin: '2026-11-13' }}]; {ins}.insSave(); {ins}.refreshAll(); }}"""); pg.wait_for_timeout(400)
        pg.evaluate(f"() => {DXJ}.comp()"); pg.wait_for_timeout(800)
        c5 = pg.evaluate(f"() => {{ const I = {ins}.INS, P = k => {{ const p = (I.dlp[k] || [])[0] || {{}}; return [p.deb, p.fin, !!p.dmd, !!p.fmd]; }}; return [P('l2|s2'), P('l1|s1'), document.querySelectorAll('.dlyg-foot .gplaf').length, JSON.stringify(I.plafR), JSON.stringify(I.dinc || {{}})]; }}")
        check("v530 planning : appui long sur le plafond = le couper ; morceau à 4 ouvriers ; COMPRESSER resserre les tâches datées",
              cutok and '"2026-11-04"' in segs and c5[:3] == [["2026-11-04", "2026-11-04", False, True], ["2026-11-04", "2026-11-05", True, True], 2], [cutok, segs, c5])
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; I.links = I.__lk; I.dlp = I.__dlp; I.dpred = I.__dp; I.pdeb = I.__pd0; delete I.__lk; delete I.__dlp; delete I.__dp; delete I.__pd0; I.dlim = {{}}; I.plaf = 0; I.plafs = []; I.plafR = {{}}; I.chg = I.chg.filter(r => !/^j/.test(r.id)); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(400)
        # conditionnement : barres de 12 m (découpe), puis palettes et camions
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.chg.push({{ id: 'a1', des: 'ACIER HA12', u: 'KG', q: 120, p: 12 }});
            I.prd.push({{ id: 'r1', des: 'BARRE POTEAU', u: 'ML', nbr: 6, d1: 4.5 }}, {{ id: 'r2', des: 'BARRE POUTRE', u: 'ML', nbr: 5, d1: 3 }});
            I.links.push({{ id: 'AC', des: 'd1', lot: 'l1', prim: 'p1', sec: 's1', prd: [{{ id: 'r1' }}, {{ id: 'r2' }}], chg: [{{ id: 'a1' }}] }}); X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"chg\"]')?.click()"); pg.wait_for_timeout(500)
        cb = pg.evaluate("""() => { const b = document.querySelector('table.ins-table[data-ik="chg"] .chg-pk[data-cid="a1"]'); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }""")
        if cb: pg.mouse.click(cb[0], cb[1]); pg.wait_for_timeout(400)
        pg.evaluate("() => document.querySelector('#svConf [data-m=\"c\"]')?.click()"); pg.wait_for_timeout(300)
        k1 = pg.evaluate("() => (document.querySelector('#svConf .cond-res') || {}).innerText || ''")
        pg.evaluate("() => document.querySelector('#svConf [data-m=\"q\"]')?.click()"); pg.wait_for_timeout(300)
        if pg.evaluate("() => !!document.querySelector('#svConf input[data-k=\"per\"]')"):
            pg.fill('#svConf input[data-k="per"]', '50'); pg.fill('#svConf input[data-k="perT"]', '2'); pg.wait_for_timeout(200)
        k2 = pg.evaluate("() => (document.querySelector('#svConf .cond-res') || {}).innerText || ''")
        pg.evaluate("() => document.querySelector('#svConf [data-x]')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; I.chg = I.chg.filter(r => r.id !== 'a1'); I.prd = I.prd.filter(r => !/^r[12]$/.test(r.id)); I.links = I.links.filter(l => l.id !== 'AC'); delete I.cond; X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        import re as _re
        check("v530 conditionnement : 4 barres de 12 m pour 6 × 4,50 + 5 × 3,00 (12,5 % de chutes) ; 3 unités de 50 KG, 2 camions",
              cb is not None and _re.search(r"^4\s", k1.split("\n")[1] if "\n" in k1 else "") and "12,50 %" in k1 and _re.search(r"\t3\t", k2) and "75,00 %" in k2, [cb, k1[:120], k2[:120]])
        pg.set_viewport_size({"width": 1180, "height": 820}); pg.wait_for_timeout(300)

        # ===== v531 : création d'un titre dans la liste des lots — le tableau reste stable à l'endroit de la ligne de destination =====
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; for (let i = 0; i < 30; i++) I.lot.push({{ id: 'z' + i, v: 'ZONE ' + String(i).padStart(2, '0') }}); X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        st = pg.evaluate("""() => { const stl = document.createElement('style'); stl.id = 'tst531'; stl.textContent = '.ins-hcol[data-ik="lot"]{max-height:380px!important;height:380px!important}'; document.head.appendChild(stl);
            const c = document.querySelector('.ins-hcol[data-ik="lot"]'); c.scrollIntoView({ block: 'center' }); c.scrollTop = 300; const s = document.querySelector('.ins-li[data-iid="z14"]'), t = document.querySelector('.ins-li[data-iid="z16"]');
            const a = s.querySelector('input.ins-in').getBoundingClientRect(), b = t.getBoundingClientRect(); return [a.left + 20, a.top + a.height / 2, b.top + b.height / 2, b.top, window.scrollY]; }""")
        pg.mouse.move(st[0], st[1]); pg.mouse.down(); pg.wait_for_timeout(700)
        pg.mouse.move(st[0], st[2] - 2, steps=6); pg.wait_for_timeout(100); pg.mouse.move(st[0], st[2], steps=2); pg.wait_for_timeout(150)
        pg.mouse.up(); pg.wait_for_timeout(700)
        s31 = pg.evaluate("""() => { const c = document.querySelector('.ins-hcol[data-ik="lot"]'); const g = [...c.querySelectorAll('.lot-grp')].find(x => /^GROUPE/.test(x.dataset.path)); const ids = [...c.querySelectorAll('.ins-li')].map(x => x.dataset.path || x.dataset.iid);
            return [g ? Math.round(g.getBoundingClientRect().top) : null, ids.indexOf(g && g.dataset.path) === ids.indexOf('z15') + 1, Math.round(window.scrollY)]; }""")
        pg.keyboard.press("Escape"); pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        pg.evaluate(f"() => {{ document.getElementById('tst531')?.remove(); const X = {ins}; const I = X.INS; I.lot = I.lot.filter(r => ['l1', 'l2'].includes(r.id)); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        check("v531 : nouveau titre créé à la place de la ligne visée, sans que la liste ni la page ne bougent",
              s31[0] is not None and abs(s31[0] - round(st[3])) <= 2 and s31[1] and abs(s31[2] - round(st[4])) <= 2, [st, s31])

        # ===== v532 : les titres de groupe ne changent plus tout seuls (glissement, création d'un autre titre…) =====
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.lot = I.lot.filter(r => ['l1', 'l2'].includes(r.id));
            I.lot.push({{ id: 'ka', v: 'ZONE A' }}, {{ id: 'kb', v: 'GROUPE 6 / ZONE B' }}, {{ id: 'kc', v: 'GROUPE 6 / ZONE C' }}, {{ id: 'kd', v: 'ZONE D' }}, {{ id: 'ke', v: 'ZONE E' }}); X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(300)
        for _ in range(6):
            if not pg.evaluate(UNF): break
            pg.wait_for_timeout(250)
        NM = """() => [...document.querySelectorAll('.ins-hcol[data-ik="lot"] .ins-li')].map(x => x.classList.contains('lot-grp') ? x.querySelector('input.lot-gname').value : ((x.querySelector('.lvl-no') || {}).textContent || '') + ' ' + (x.querySelector('input.ins-in') || {}).value).join(' | ')"""
        n0 = pg.evaluate(NM)
        pg.evaluate("""() => { const c = document.querySelector('.ins-hcol[data-ik="lot"]'); c.style.maxHeight = 'none'; c.style.height = 'auto'; c.scrollIntoView({ block: 'center' }); }"""); pg.wait_for_timeout(200)
        def dr32(src, dst, frac):
            a = pg.evaluate("s => { const r = document.querySelector('.ins-li[data-iid=\"' + s + '\"] input.ins-in').getBoundingClientRect(); return [r.left + 20, r.top + r.height / 2]; }", src)
            t = pg.evaluate("([s, f]) => { const r = document.querySelector('.ins-li[data-iid=\"' + s + '\"]').getBoundingClientRect(); return r.top + r.height * f; }", [dst, frac])
            pg.mouse.move(a[0], a[1]); pg.mouse.down(); pg.wait_for_timeout(700)
            pg.mouse.move(a[0], t - 2, steps=6); pg.wait_for_timeout(100); pg.mouse.move(a[0], t, steps=2); pg.wait_for_timeout(150)
            pg.mouse.up(); pg.wait_for_timeout(600); pg.keyboard.press("Escape"); pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        dr32("ke", "ka", .05)          # ZONE E glissée tout en haut
        n1 = pg.evaluate(NM)
        pg.evaluate("""() => { const c = document.querySelector('.ins-hcol[data-ik="lot"]'); c.style.maxHeight = 'none'; c.style.height = 'auto'; }"""); pg.wait_for_timeout(100)
        dr32("kd", "ka", .5)           # ZONE D posée sur ZONE A = nouveau titre
        n2 = pg.evaluate(NM)
        pg.evaluate("""() => { const c = document.querySelector('.ins-hcol[data-ik="lot"]'); c.style.maxHeight = 'none'; c.style.height = 'auto'; }"""); pg.wait_for_timeout(100)
        dr32("ke", "kd", .95)
        n3 = pg.evaluate(NM)
        grp = lambda t: [x for x in t.split(" | ") if x.startswith("GROUPE")]
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; I.lot = I.lot.filter(r => ['l1', 'l2'].includes(r.id)); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        check("v532 / v789 : un groupe garde son nom après d'autres glissements ; GROUPE numéroté par ordre de création (GROUPE 1, puis GROUPE 2) ; ses lots numérotés par leur place",
              "GROUPE 1" in grp(n0) and "GROUPE 1" in grp(n1) and len(grp(n2)) == 2 and grp(n3) == grp(n2) and re.search(r"\b\d+\.1 ZONE B", n0) is not None, [n0, n1, n2, n3])

        # ===== v533 : nom tapé sur un titre (RDC HAUT) gardé quand on glisse aussitôt une autre ligne =====
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.lot = I.lot.filter(r => ['l1', 'l2'].includes(r.id));
            I.lot.push({{ id: 'a1', v: 'GROUPE 2 / GROUPE 2.1 / ESC' }}, {{ id: 'a2', v: 'GROUPE 2 / GROUPE 2.1 / SDB' }}, {{ id: 'b1', v: 'GROUPE 2 / RDC BA' }}, {{ id: 'b2', v: 'GROUPE 2 / RDC BA / X' }}); X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(300)
        for _ in range(6):
            if not pg.evaluate(UNF): break
            pg.wait_for_timeout(250)
        pg.evaluate("""() => { const c = document.querySelector('.ins-hcol[data-ik="lot"]'); c.style.maxHeight = 'none'; c.style.height = 'auto'; c.scrollIntoView({ block: 'center' }); }"""); pg.wait_for_timeout(200)
        a = pg.evaluate("""() => { const i = document.querySelector('.lot-grp[data-path="GROUPE 2 / GROUPE 2.1"] input.lot-gname'); const r = i.getBoundingClientRect(); return [r.left + 30, r.top + r.height / 2]; }""")
        pg.mouse.click(a[0], a[1]); pg.wait_for_timeout(300); pg.mouse.click(a[0], a[1]); pg.wait_for_timeout(300)
        pg.keyboard.type("RDC HAUT"); pg.wait_for_timeout(200)
        s3 = pg.evaluate("""() => { const r = document.querySelector('.ins-li[data-iid="b1"] input.ins-in').getBoundingClientRect(); return [r.left + 20, r.top + r.height / 2]; }""")
        t3 = pg.evaluate("""() => { const r = document.querySelector('.lot-grp[data-path="GROUPE 2 / GROUPE 2.1"]').getBoundingClientRect(); return r.top + 3; }""")
        pg.mouse.move(s3[0], s3[1]); pg.mouse.down(); pg.wait_for_timeout(700)
        pg.mouse.move(s3[0], t3 - 2, steps=6); pg.wait_for_timeout(100); pg.mouse.move(s3[0], t3, steps=2); pg.wait_for_timeout(150)
        pg.mouse.up(); pg.wait_for_timeout(700); pg.keyboard.press("Escape"); pg.mouse.click(5, 5); pg.wait_for_timeout(300)
        r33 = pg.evaluate(f"() => {{ const I = {ins}.INS; return [I.lot.map(r => r.v).join(' | '), [...document.querySelectorAll('.ins-hcol[data-ik=\"lot\"] input.lot-gname')].map(i => i.value)]; }}")
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; I.lot = I.lot.filter(r => ['l1', 'l2'].includes(r.id)); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        check("v533 : nom RDC HAUT gardé et ligne RDC BA déplacée quand on glisse juste après avoir tapé le nom",
              "GROUPE 2 / RDC HAUT / ESC" in r33[0] and r33[0].index("GROUPE 2 / RDC BA") < r33[0].index("GROUPE 2 / RDC HAUT") and "RDC HAUT" in r33[1], r33)

        # ===== v534 : un titre posé sur un autre titre = nouveau titre qui regroupe les deux ; destination en jaune =====
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.lot = I.lot.filter(r => ['l1', 'l2'].includes(r.id));
            I.lot.push({{ id: 'h1', v: 'RDC HAUT / ESC' }}, {{ id: 'h2', v: 'RDC HAUT / SDB' }}, {{ id: 'h3', v: 'RDC BA / ESC' }}, {{ id: 'h4', v: 'RDC BA / SDB' }}); X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(300)
        for _ in range(6):
            if not pg.evaluate(UNF): break
            pg.wait_for_timeout(250)
        pg.evaluate("""() => { const c = document.querySelector('.ins-hcol[data-ik="lot"]'); c.style.maxHeight = 'none'; c.style.height = 'auto'; c.scrollIntoView({ block: 'center' }); }"""); pg.wait_for_timeout(200)
        s4 = pg.evaluate("""() => { const r = document.querySelector('.ins-li.lot-par[data-iid], .lot-grp[data-path="RDC BA"]'); const i = document.querySelector('.lot-grp[data-path="RDC BA"] input.lot-gname').getBoundingClientRect(); return [i.left + 30, i.top + i.height / 2]; }""")
        t4 = pg.evaluate("""() => { const r = document.querySelector('.lot-grp[data-path="RDC HAUT"]').getBoundingClientRect(); return r.top + r.height / 2; }""")
        pg.mouse.move(s4[0], s4[1]); pg.mouse.down(); pg.wait_for_timeout(700)
        pg.mouse.move(s4[0], t4 - 3, steps=6); pg.wait_for_timeout(100); pg.mouse.move(s4[0], t4, steps=2); pg.wait_for_timeout(150)
        y4 = pg.evaluate("() => { const r = document.querySelector('.lot-grp[data-path=\"RDC HAUT\"]'); return r ? [r.classList.contains('ro-on'), getComputedStyle(r).backgroundColor] : null; }")
        pg.mouse.up(); pg.wait_for_timeout(700); pg.keyboard.press("Escape"); pg.mouse.click(5, 5); pg.wait_for_timeout(300)
        v4 = pg.evaluate(f"() => {ins}.INS.lot.filter(r => /^h/.test(r.id)).map(r => r.v)")
        o4 = pg.evaluate(f"() => {{ const L = {ins}.INS.lot.map(r => r.id); return [L.indexOf('l1'), L.indexOf('l2'), Math.min(...['h1', 'h2', 'h3', 'h4'].map(x => L.indexOf(x)))]; }}")
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; I.lot = I.lot.filter(r => ['l1', 'l2'].includes(r.id)); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        top = set(v.split(" / ")[0] for v in v4)
        check("v534 / v536 : titre RDC BA posé sur le titre RDC HAUT = un nouveau titre GROUPE qui contient les deux, à leur place (pas en haut) ; destination en jaune",
              o4[2] > max(o4[0], o4[1]) and y4 == [True, "rgb(253, 230, 138)"] and len(top) == 1 and list(top)[0].startswith("GROUPE") and all(" / RDC HAUT / " in v or " / RDC BA / " in v for v in v4), [y4, v4, o4])

        # ===== v535 : un sous-titre posé sur son titre parent = nouveau titre où les deux sont au même rang =====
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.lot = I.lot.filter(r => ['l1', 'l2'].includes(r.id));
            I.lot.push({{ id: 'm1', v: 'RDC / ESC' }}, {{ id: 'm2', v: 'RDC / HAUT / SDB' }}, {{ id: 'm3', v: 'RDC / HAUT / TOIT' }}); X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(300)
        for _ in range(6):
            if not pg.evaluate(UNF): break
            pg.wait_for_timeout(250)
        pg.evaluate("""() => { const c = document.querySelector('.ins-hcol[data-ik="lot"]'); c.style.maxHeight = 'none'; c.style.height = 'auto'; c.scrollIntoView({ block: 'center' }); }"""); pg.wait_for_timeout(200)
        s5 = pg.evaluate("""() => { const i = document.querySelector('.lot-grp[data-path="RDC / HAUT"] input.lot-gname').getBoundingClientRect(); return [i.left + 30, i.top + i.height / 2]; }""")
        t5 = pg.evaluate("""() => { const r = document.querySelector('.ins-li[data-iid="l1"]').getBoundingClientRect(); return r.top + r.height / 2; }""")
        pg.mouse.move(s5[0], s5[1]); pg.mouse.down(); pg.wait_for_timeout(700)
        pg.mouse.move(s5[0], t5 + 3, steps=6); pg.wait_for_timeout(100); pg.mouse.move(s5[0], t5, steps=2); pg.wait_for_timeout(150)
        pg.mouse.up(); pg.wait_for_timeout(700); pg.keyboard.press("Escape"); pg.mouse.click(5, 5); pg.wait_for_timeout(300)
        v5 = pg.evaluate(f"() => {ins}.INS.lot.filter(r => /^(m|l1)/.test(r.id)).map(r => r.v)")
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; I.lot = I.lot.filter(r => !/^m/.test(r.id)); I.lot.find(r => r.id === 'l1').v = 'RDC'; X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        g5 = v5[0].split(" / ")[0] if v5 else ""
        check("v535 : sous-titre HAUT posé sur son parent RDC = nouveau titre GROUPE avec RDC et HAUT au même rang",
              g5.startswith("GROUPE") and sorted(v5) == sorted([g5 + " / RDC", g5 + " / RDC / ESC", g5 + " / HAUT / SDB", g5 + " / HAUT / TOIT"]), v5)

        # ===== v537 : DÉTAIL DÉLAIS — case carrée = filtre des autres blocs (et inversement) ; rond = ce qui est lié à la tâche =====
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.links = I.links.filter(l => l.id !== 'L37').concat([{{ id: 'L37', des: 'd3', lot: 'l2', prim: 'p1', sec: 's2', prd: [], chg: [{{ id: 'c2' }}] }}]); X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"dly\"]')?.click()"); pg.wait_for_timeout(600)
        pg.evaluate("() => { const c = document.querySelector('#bdgTabBody input.dlyp-cb[data-key=\"l1|s1\"]'); if (c) { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); } }"); pg.wait_for_timeout(500)
        f37 = pg.evaluate("() => [[...document.querySelectorAll('.ins-hcol[data-ik=\"lot\"] .ins-li[data-iid]')].map(x => x.dataset.iid), [...document.querySelectorAll('#bdgClientBody tr[data-iid]')].filter(t => t.offsetParent !== null).map(t => t.dataset.iid)]")
        pg.evaluate("() => { const c = document.querySelector('#bdgTabBody input.dlyp-cb[data-key=\"l1|s1\"]'); if (c) { c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); } }"); pg.wait_for_timeout(400)
        pg.evaluate("() => document.querySelector('#bdgTabBody .dly-rd[data-dkey=\"l2|s2\"]')?.click()"); pg.wait_for_timeout(500)
        r37 = pg.evaluate("() => [!!document.querySelector('#bdgTabBody .dly-rd[data-dkey=\"l2|s2\"].on'), !!document.querySelector('.ins-hcol[data-ik=\"lot\"] .ins-li[data-iid=\"l2\"] .lk-rd.on'), !!document.querySelector('#bdgClientBody tr[data-iid=\"d3\"].lk-hit, #bdgClientBody tr[data-iid=\"d3\"] .lk-rd.lnk')]")
        pg.evaluate("() => document.querySelector('#bdgTabBody .dly-rd[data-dkey=\"l2|s2\"]')?.click()"); pg.wait_for_timeout(400)
        r37b = pg.evaluate("() => !!document.querySelector('#bdgTabBody .dly-rd.on')")
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; I.links = I.links.filter(l => l.id !== 'L37'); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        check("v537 : tâche cochée du PLANNING = filtre des autres blocs ; rond d'une tâche = ce qui lui est lié s'allume, retoucher = libérer",
              f37[0] == ["l1"] and "d3" not in f37[1] and "d1" in f37[1] and r37 == [True, True, True] and r37b is False, [f37, r37, r37b])

        # ===== v538 : lots du PLANNING = mêmes ronds que le bloc TÂCHES (lot : rond ; titre : pastille chiffrée) =====
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.lot.push({{ id: 'q1', v: 'GROUPE 9 / ZONE Q' }});
            I.links = I.links.filter(l => l.id !== 'L38').concat([{{ id: 'L38', des: 'd3', lot: 'q1', prim: 'p1', sec: 's2', prd: [], chg: [{{ id: 'c2' }}] }}]); X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"dly\"]')?.click()"); pg.wait_for_timeout(600)
        a38 = pg.evaluate("""() => { const g = document.querySelector('#bdgTabBody tr.dly-grp[data-path="GROUPE 9"] .lk-rdgrp'), l = document.querySelector('#bdgTabBody tr.dly-grp[data-path="RDC"] .lk-rd[data-rd="lot"]');
            return [g ? g.textContent.trim() : null, !!l]; }""")
        pg.evaluate("() => document.querySelector('#bdgTabBody tr.dly-grp[data-path=\"GROUPE 9\"] .lk-rdgrp')?.click()"); pg.wait_for_timeout(500)
        b38 = pg.evaluate("""() => [!!document.querySelector('#bdgTabBody tr.dly-grp[data-path="GROUPE 9"] .lk-rdgrp.on'), !!document.querySelector('.ins-hcol[data-ik="lot"] .lot-grp[data-path="GROUPE 9"] .lk-rdgrp.on'),
            !!document.querySelector('#bdgTabBody tr.dly-task[data-key="q1|s2"].dly-pick')]""")
        pg.evaluate("() => document.querySelector('#bdgTabBody tr.dly-grp[data-path=\"GROUPE 9\"] .lk-rdgrp')?.click()"); pg.wait_for_timeout(400)
        pg.evaluate("() => document.querySelector('#bdgTabBody tr.dly-grp[data-path=\"RDC\"] .lk-rd[data-rd=\"lot\"]')?.click()"); pg.wait_for_timeout(500)
        c38 = pg.evaluate("() => [!!document.querySelector('#bdgTabBody tr.dly-grp[data-path=\"RDC\"] .lk-rd.on'), !!document.querySelector('.ins-hcol[data-ik=\"lot\"] .ins-li[data-iid=\"l1\"] .lk-rd.on')]")
        pg.evaluate("() => document.querySelector('#bdgTabBody tr.dly-grp[data-path=\"RDC\"] .lk-rd[data-rd=\"lot\"]')?.click()"); pg.wait_for_timeout(400)
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; I.lot = I.lot.filter(r => r.id !== 'q1'); I.links = I.links.filter(l => l.id !== 'L38'); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        check("v538 : lots du PLANNING — titre = pastille chiffrée (toutes ses lignes, comme TÂCHES) ; lot = son rond", a38 == ["1", True] and b38 == [True, True, True] and c38 == [True, True], [a38, b38, c38])

        # ===== v539 : PLANNING — glisser des lots / titres avec les règles du bloc TÂCHES ; onglet bleu quand cases cochées =====
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        pg.set_viewport_size({"width": 1180, "height": 1100}); pg.wait_for_timeout(300)
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.lot = I.lot.filter(r => ['l1', 'l2'].includes(r.id));
            I.lot.push({{ id: 'w1', v: 'RDC HAUT / ESC' }}, {{ id: 'w2', v: 'RDC HAUT / SDB' }}, {{ id: 'w3', v: 'RDC BA / ESC' }}, {{ id: 'w4', v: 'ZONE X' }});
            I.__lk9 = I.links; I.links = I.links.concat(['w1', 'w2', 'w3', 'w4'].map((lo, n) => ({{ id: 'W' + n, des: 'd2', lot: lo, prim: 'p1', sec: 's2', prd: [], chg: [] }})));
            I.dord = null; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"dly\"]')?.click()"); pg.wait_for_timeout(700)
        pg.evaluate("""() => { const st = document.createElement('style'); st.id = 'tst539'; st.textContent = '.bdg-d-tabbody .bdg-d-scroll{max-height:none!important;height:auto!important;overflow:visible!important} .dly-lift{transform:none!important}'; document.head.appendChild(st);
            const t = document.querySelector('#bdgTabs'); if (t) { t.scrollIntoView({ block: 'start' }); window.scrollBy(0, -160); } }"""); pg.wait_for_timeout(300)
        def dpd(src, dst, frac, dx):
            a = pg.evaluate("p => { const r = document.querySelector('.dlyg-l tr.dly-grp[data-path=\"' + p + '\"] .dly-lotc').getBoundingClientRect(); return [r.left + r.width - 30, r.top + r.height / 2]; }", src)
            t = pg.evaluate("([p, f]) => { const r = document.querySelector('.dlyg-l tr.dly-grp[data-path=\"' + p + '\"]').getBoundingClientRect(); return r.top + r.height * f; }", [dst, frac])
            pg.mouse.move(a[0], a[1]); pg.mouse.down(); pg.wait_for_timeout(700)
            pg.mouse.move(a[0], a[1] + 12, steps=3); pg.wait_for_timeout(150)
            for _ in range(4):
                t = pg.evaluate("([p, f]) => { const r = document.querySelector('.dlyg-l tr.dly-grp[data-path=\"' + p + '\"]').getBoundingClientRect(); return r.top + r.height * f; }", [dst, frac])
                pg.mouse.move(a[0] + dx, t, steps=3); pg.wait_for_timeout(200)
            st = pg.evaluate("p => { const r = document.querySelector('.dlyg-l tr.dly-grp[data-path=\"' + p + '\"]'); return [r ? r.classList.contains('ro-on') : null, !!document.getElementById('roLine')]; }", dst)
            pg.mouse.up(); pg.wait_for_timeout(700); pg.keyboard.press("Escape"); pg.mouse.click(5, 5); pg.wait_for_timeout(300)
            return st
        st1 = dpd("RDC BA", "RDC HAUT", .5, 0)
        v39 = pg.evaluate(f"() => {ins}.INS.lot.filter(r => /^w[123]/.test(r.id)).map(r => r.v)")
        g39 = v39[0].split(" / ")[0] if v39 else ""
        lot39 = pg.evaluate("g => !!document.querySelector('.ins-hcol[data-ik=\"lot\"] .lot-grp[data-path=\"' + g + '\"]')", g39)
        pg.evaluate("() => document.querySelector('#bdgTabBody input.dlyp-cb[data-key]') && (() => { const c = document.querySelector('#bdgTabBody input.dlyp-cb[data-key]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); })()"); pg.wait_for_timeout(500)
        tb39 = pg.evaluate("() => ['dly', 'chg', 'prd'].map(t => document.querySelector('#bdgTabs .bdg-d-tab[data-tab=\"' + t + '\"]').classList.contains('tab-filt'))")
        pg.evaluate("() => { const c = document.querySelector('#bdgTabBody input.dlyp-cb[data-key]:checked'); if (c) { c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); } }"); pg.wait_for_timeout(400)
        tb39b = pg.evaluate("() => document.querySelector('#bdgTabs .bdg-d-tab[data-tab=\"dly\"]').classList.contains('tab-filt')")
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; I.lot = I.lot.filter(r => ['l1', 'l2'].includes(r.id)); I.links = I.__lk9; delete I.__lk9; I.dord = null; X.insSave(); X.refreshAll(); document.getElementById('tst539')?.remove(); }}"); pg.wait_for_timeout(300)
        pg.set_viewport_size({"width": 1180, "height": 820}); pg.wait_for_timeout(300)
        check("v539 : PLANNING — titre RDC BA posé sur RDC HAUT = nouveau titre (aussi dans le bloc TÂCHES), destination en jaune ; onglet DÉTAIL DÉLAIS (seul) en bleu avec une tâche cochée",
              st1 == [True, False] and g39.startswith("GROUPE") and all(v.startswith(g39 + " / RDC ") for v in v39) and lot39 and tb39 == [True, False, False] and tb39b is False, [st1, v39, lot39, tb39, tb39b])

        # ===== v542 : remarques du planning 1 à 16 (23/10/2026) =====
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        pg.set_viewport_size({"width": 1180, "height": 1100}); pg.wait_for_timeout(300)
        DXJ = "[...document.querySelectorAll('*')].find(e => e.__insDly).__insDly"
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS;
            I.chg.forEach(r => {{ r.on = false; }});
            I.chg.push({{ id: 'k1', des: 'MACON', u: 'JH', q: 4, p: 100 }}, {{ id: 'k2', des: 'CIMENT', u: 'SAC', q: 10, p: 80 }}, {{ id: 'k3', des: 'MACON', u: 'JH', q: 2, p: 100 }});
            I.__lk2 = I.links; I.__dlp2 = I.dlp; I.__dp2 = I.dpred; I.__ord2 = I.dord; I.__pdeb2 = I.pdeb;
            I.links = [{{ id: 'P1', des: 'd1', lot: 'l1', prim: 'p1', sec: 's1', prd: [], chg: [{{ id: 'k1' }}] }}, {{ id: 'P2', des: 'd1', lot: 'l2', prim: 'p1', sec: 's1', prd: [], chg: [{{ id: 'k2' }}] }},
              {{ id: 'P3', des: 'd2', lot: 'l1', prim: 'p1', sec: 's2', prd: [], chg: [{{ id: 'k3' }}] }}];
            I.dlp = {{ 'l1|s1': [{{ id: 'a', deb: '2026-11-02', fin: '2026-11-03' }}], 'l2|s1': [{{ id: 'b', deb: '2026-11-02', fin: '2026-11-02' }}], 'l1|s2': [{{ id: 'c', deb: '2026-11-04', fin: '2026-11-04' }}] }};
            I.dpred = {{}}; I.dinc = {{}}; I.plafR = {{}}; I.plaf = 0; I.plafs = []; I.cmd = null; I.pdeb = '2026-11-02';
            I.dord = ['l1|s1', 'l2|s1', 'l1|s2']; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"dly\"]')?.click()"); pg.wait_for_timeout(700)
        ROWS = "() => [...document.querySelectorAll('#bdgTabBody .dlyg-l tbody tr')].map(t => t.classList.contains('dly-grp') ? 'G:' + t.dataset.path : t.dataset.key ? 'T:' + t.dataset.key + (t.querySelector('.dly-ldot') ? '*' : '') : '').filter(Boolean)"
        r16 = pg.evaluate(ROWS)
        p1 = r16[0][2:] if r16 and r16[0].startswith("G:") else ""
        pg.evaluate(f"p => {DXJ}.fold(p)", p1); pg.wait_for_timeout(400)
        r16f = pg.evaluate(ROWS)
        pg.evaluate(f"p => {DXJ}.fold(p)", p1); pg.wait_for_timeout(400)
        check("v542 R16 : lignes dans l'ordre du PLANNING (lots mêlés) ; titre à la 1re tâche ; pastille du lot ; replier ne cache que ses tâches",
              [x[:2] if x.startswith("G:") else x for x in r16] == ["G:", "T:l1|s1", "G:", "T:l2|s1", "T:l1|s2*"] and "T:l2|s1" in r16f and "T:l1|s1" not in r16f and "T:l1|s2*" not in r16f, [r16, r16f])
        # R14 / R15 : rien de coché = SÉLECTIONNER DES CHARGES ; charge cochée = histogramme, tâches non liées en gris ; tâche à 0 jour
        e14 = pg.evaluate("() => (document.querySelector('.dlyg-foot .ghist-empty') || {}).textContent || ''")
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.chg.find(r => r.id === 'k1').on = true; I.chg.find(r => r.id === 'k3').on = true; I.dlp['l1|s2'] = [{{ id: 'c', deb: '2026-11-04', fin: '' }}]; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(600)
        e15 = pg.evaluate("""() => [document.querySelectorAll('.dlyg-foot .ghb').length > 0, !!document.querySelector('#bdgTabBody tr.dly-task[data-key="l2|s1"].dly-off'), !!document.querySelector('#dlyGantt .gb.gb-off[data-key="l2|s1"]'),
            !!document.querySelector('#dlyGantt .gb.gb0[data-key="l1|s2"]'), (document.querySelector('#bdgTabBody tr[data-key="l1|s2"] input.dlp-in[data-f="dur"]') || {}).value, (document.querySelector('.dlyg-foot .gax-u') || {}).textContent]""")
        e15b = pg.evaluate(f"() => JSON.stringify({ins}.INS.dlp['l1|s2'])")
        # v620 : tâches hors filtre retirées (plus en gris) — sans case cochée, la tâche sans FIN redevient visible (repère de 0 jour)
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.chg.filter(r => /^k[13]$/.test(r.id)).forEach(r => {{ r.on = false; }}); X.refreshAll(); }}"""); pg.wait_for_timeout(500)
        e15c = pg.evaluate("() => [!!document.querySelector('#dlyGantt .gb.gb0[data-key=\"l1|s2\"]'), !!document.querySelector('#bdgTabBody tr.dly-task[data-key=\"l2|s1\"]')]")
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.chg.filter(r => /^k[13]$/.test(r.id)).forEach(r => {{ r.on = true; }}); X.refreshAll(); }}"""); pg.wait_for_timeout(500)
        check("v542 R15 / v599 / v620 : rien de coché = toutes les charges (plus de SÉLECTIONNER DES CHARGES) ; charges cochées = histogramme, tâche non liée retirée du tableau et du Gantt ; tâche sans FIN = repère de 0 jour (rien d'inventé)",
              "SÉLECTIONNER DES CHARGES" not in e14 and e15[0] and not e15[1] and not e15[2] and e15c == [True, True] and "J-H / JOUR" in (e15[5] or "") and '"fin":""' in e15b, [e14, e15, e15b, e15c])
        # R8 : bulle d'un jour de l'histogramme
        pg.evaluate("() => document.querySelector('.dlyg-foot .ghb[data-d=\"2026-11-02\"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))"); pg.wait_for_timeout(300)
        hb = pg.evaluate("() => (document.getElementById('dlyHb') || {}).innerText || ''")
        pg.evaluate("() => document.getElementById('dlyHb')?.remove()")
        check("v542 R8 : toucher une barre de l'histogramme = bulle des tâches du jour (avec la quantité)", "02/11/2026" in hb and "TOTAL" in hb and "2" in hb, hb[:200])
        # R3 : durée changée à la main = INCOMPRESSIBLE ; COMPRESSER garde sa durée ; ▣ = RENDRE COMPRESSIBLE
        pg.evaluate("""() => { const i = document.querySelector('#bdgTabBody tr[data-key="l1|s1"] input.dlp-in[data-f="dur"]'); i.value = '3'; i.dispatchEvent(new Event('change', { bubbles: true })); }"""); pg.wait_for_timeout(600)
        i3 = pg.evaluate(f"() => [!!({ins}.INS.dinc || {{}})['l1|s1'], !!document.querySelector('#bdgTabBody tr[data-key=\"l1|s1\"] .dly-inc')]")
        pg.evaluate(f"() => {DXJ}.plafSeg(0, 4)"); pg.wait_for_timeout(600)
        i3b = pg.evaluate(f"() => {{ const p = {ins}.INS.dlp['l1|s1'][0]; return [p.deb, p.fin]; }}")
        pg.evaluate("() => document.querySelector('#bdgTabBody tr[data-key=\"l1|s1\"] .dly-inc')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('#svConf [data-v=\"off\"]')?.click()"); pg.wait_for_timeout(400)
        i3c = pg.evaluate(f"() => !!({ins}.INS.dinc || {{}})['l1|s1']")
        check("v542 R3 : durée changée à la main = INCOMPRESSIBLE (▣) ; la barre de plafond (4) garde ses 3 jours ; ▣ → RENDRE COMPRESSIBLE",
              i3 == [True, True] and i3b == ["2026-11-02", "2026-11-04"] and i3c is False, [i3, i3b, i3c])
        # v703 : barre CAPACITÉ sans bouton — le planning suit PENDANT le geste (baisser = allonger), un seul ↶ pour tout le geste
        pg.evaluate(f"() => {DXJ}.plafSeg(0, 4)"); pg.wait_for_timeout(900)
        pg.evaluate("() => document.querySelector('.ghist')?.scrollIntoView({ block: 'center' })"); pg.wait_for_timeout(300)
        lv0 = pg.evaluate(f"() => JSON.stringify({ins}.INS.dlp)")
        gb = pg.evaluate("() => { const g = document.querySelector('.dlyg-foot .gplaf[data-seg=\"0\"]') || document.querySelector('.dlyg-foot .gplaf'), h = g && g.closest('.ghist'); if (!g) return null; const r = g.getBoundingClientRect(); const y = r.top + 1; let x = null; for (let xx = Math.max(r.left, 0) + 20; xx < Math.min(r.right, innerWidth) - 5; xx += 15) { const el = document.elementFromPoint(xx, y); if (el && el.closest && el.closest('.gplaf')) { x = xx; break; } } return x === null ? null : [x, y, Number(h.dataset.sc) || 1]; }")
        lv = None
        if gb:
            pg.mouse.move(gb[0], gb[1]); pg.mouse.down()
            for k in range(1, 7): pg.mouse.move(gb[0], gb[1] + k * gb[2] * 0.5 + 1); pg.wait_for_timeout(60)
            pg.wait_for_timeout(500)
            lv = pg.evaluate(f"() => [JSON.stringify({ins}.INS.dlp), !!document.querySelector('.dlyg-foot .gplaf')]")
            pg.mouse.up(); pg.wait_for_timeout(900)
            pg.evaluate("() => document.getElementById('instUndo')?.click()"); pg.wait_for_timeout(900)
            lv = lv + [pg.evaluate(f"() => JSON.stringify({ins}.INS.dlp)")]
        check("v703 : CAPACITÉ baissée au doigt — dates changées pendant le geste (barre toujours là) ; un seul ↶ ramène le planning d'avant",
              lv and lv[0] != lv0 and lv[1] and lv[2] == lv0, [gb, lv and lv[0] != lv0, lv and lv[2] == lv0])
        # R2 / R5 : barre en direct (compression), « AUCUN GAIN » ; un seul bouton dans le menu ⋯, plus de nivellement
        pg.evaluate(f"() => {DXJ}.plafSeg(0, 4)"); pg.wait_for_timeout(300)
        pg.evaluate(f"() => {DXJ}.plafSeg(0, 4)"); pg.wait_for_timeout(300)
        t2 = pg.evaluate(f"() => [{ins}.INS.dlp['l1|s1'][0].fin, (document.getElementById('svToast') || {{}}).textContent || '']")
        pg.evaluate("() => document.querySelector('#bdgDetailHead .blk-more')?.click()"); pg.wait_for_timeout(300)
        mn = pg.evaluate("() => (document.getElementById('blkMenu') || {}).textContent || ''")
        pg.evaluate("() => document.getElementById('blkMenu')?.remove()")
        check("v542 R2 / R5 : plafond recompresse aussitôt (4 J-H ÷ 4 = 1 jour), même nombre = AUCUN GAIN ; menu (v546) : vue, CLASSER PAR DÉBUT, APPROVISIONNEMENT — plus de COMPRESSER ni de JOUR / SEMAINE / MOIS",
              t2[0] == "2026-11-02" and "AUCUN GAIN" in t2[1] and "COMPRESSER LE PLANNING" not in mn and "GÉNÉRER / COMPRESSER" in mn and "NIVELLEMENT" not in mn and "JOUR" not in mn.replace("PAR LOT", "").replace("CLASSER", "").split("GRAPHIQUE")[0].replace("AFFICHER PAR DÉBUT", "") and "CLASSER PAR DÉBUT" not in mn and "AFFICHER PAR LOT" not in mn and "AFFICHER PAR DÉBUT" not in mn and "COUPE DES TÂCHES" not in mn and "APPROVISIONNEMENT PRÉVISIONNEL" not in mn, [t2, mn[:200]])
        # R10 : COMMANDES par fréquence (7 jours, 2 jours d'avance)
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.appro = {{ dl: 2, cov: 'n', nj: 7, dep: '', on: true }}; X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(500)
        c10 = pg.evaluate("() => [[...document.querySelectorAll('.dlyg-foot .ghb.ghc')].map(b => b.dataset.d), /APPROVISIONNEMENT/.test((document.querySelector('.dlyg-foot .ghist-cmd') || {}).textContent || '')]")
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.appro = null; X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(400)
        check("v542 R10 : COMMANDES tous les 7 jours, 2 jours d'avance = une commande le 31/10 pour la semaine du 02/11", c10 == [["2026-10-31"], True], c10)
        # R12 / R13 : poignées « = » — toucher = d'un bord à l'autre
        def tap(sel):
            pg.evaluate("s => { const e = document.querySelector(s); if (e) e.scrollIntoView({ block: 'center' }); }", sel); pg.wait_for_timeout(500)
            r = pg.evaluate("s => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }", sel)
            if r: pg.mouse.move(r[0], r[1]); pg.mouse.down(); pg.wait_for_timeout(80); pg.mouse.up(); pg.wait_for_timeout(500)
            return r is not None
        w0 = pg.evaluate("() => document.querySelector('.dlyg-l').getBoundingClientRect().width")
        tap(".dlyg-hd"); w1 = pg.evaluate("() => document.querySelector('.dlyg-l').getBoundingClientRect().width")
        tap(".dlyg-hd"); w2 = pg.evaluate("() => [document.querySelector('.dlyg-l').getBoundingClientRect().width, document.querySelector('.dlyg').getBoundingClientRect().width]")
        hh1 = tap(".dlyhh-pill") and pg.evaluate("() => [localStorage.getItem('svi_dlyhh_v1'), !!document.querySelector('.dlyg.dly-hfull')]")
        tap(".dlyhh-pill"); hh2 = pg.evaluate("() => [localStorage.getItem('svi_dlyhh_v1'), !!document.querySelector('.dlyg.dly-hfull')]")
        pg.evaluate("() => localStorage.removeItem('svi_dlyhh_v1')")
        check("v542 R12 / R13 : poignée tableau / Gantt et poignée Gantt / histogramme — toucher « = » = d'un bord à l'autre",
              w0 > 50 and ((w1 < 3 and w2[0] > w2[1] - 10) or (w1 > w2[1] - 10 and w2[0] < 3)) and hh1 == ["full", True] and hh2 == ["0", False], [w0, w1, w2, hh1, hh2])
        tap(".dlyg-hd")
        # lot glissé vers la gauche : prédécesseur hors du lot poussé ; début du projet atteint → AVANCER LE DÉBUT DU PROJET
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.chg.forEach(r => {{ r.on = false; }});
            I.dlp = {{ 'l1|s1': [{{ id: 'a', deb: '2026-11-02', fin: '2026-11-03' }}], 'l2|s1': [{{ id: 'b', deb: '2026-11-04', fin: '2026-11-04' }}] }};
            I.dpred = {{ 'l2|s1': [{{ k: 'l1|s1', t: 'FD', o: 0 }}] }}; I.dmig86 = 1; I.dinc = {{}}; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(500)
        p2 = pg.evaluate("() => { const t = document.querySelector('#bdgTabBody tr[data-key=\"l2|s1\"]'); let g = t && t.previousElementSibling; while (g && !g.classList.contains('dly-grp')) g = g.previousElementSibling; return g ? g.dataset.path : ''; }")
        pg.evaluate(f"p => {DXJ}.shiftGroup(p, -1)", p2); pg.wait_for_timeout(400)
        sw = pg.evaluate("() => [(document.querySelector('#svConf .svc-t') || {}).textContent || '']")
        pg.evaluate("() => document.querySelector('#svConf [data-v=\"go\"]')?.click()"); pg.wait_for_timeout(500)
        sg = pg.evaluate(f"() => {{ const I = {ins}.INS; return [I.pdeb, I.dlp['l1|s1'][0].deb, I.dlp['l1|s1'][0].fin, I.dlp['l2|s1'][0].deb]; }}")
        check("v542 : lot glissé à gauche — prédécesseur poussé plus tôt ; début du projet atteint → fenêtre, AVANCER LE DÉBUT DU PROJET",
              sw == ["DÉBUT DU PROJET ATTEINT"] and sg == ["2026-10-31", "2026-10-31", "2026-11-02", "2026-11-03"], [p2, sw, sg])
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.links = I.__lk2; I.dlp = I.__dlp2; I.dpred = I.__dp2; I.dord = I.__ord2; I.pdeb = I.__pdeb2;
            ['__lk2', '__dlp2', '__dp2', '__ord2', '__pdeb2'].forEach(k => delete I[k]); I.dinc = {{}}; I.plafR = {{}}; I.cmd = null;
            I.chg = I.chg.filter(r => !/^k[123]$/.test(r.id)); X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        # ===== v543 : décisions R17 à R29 (23/10/2026) =====
        pg.mouse.click(5, 5); pg.wait_for_timeout(200)
        pg.set_viewport_size({"width": 1180, "height": 1100}); pg.wait_for_timeout(300)
        DXJ = "[...document.querySelectorAll('*')].find(e => e.__insDly).__insDly"
        GM, GS = "MACON|J-H", "SABLE|M3"
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS;
            I.chg.forEach(r => {{ r.on = false; }});
            I.chg.push({{ id: 'n1', des: 'MACON', u: 'JH', q: 4, p: 100 }}, {{ id: 'n2', des: 'SABLE', u: 'M3', q: 10, p: 50 }}, {{ id: 'n3', des: 'MACON', u: 'JH', q: 2, p: 100 }});
            I.__lk3 = I.links; I.__dlp3 = I.dlp; I.__dp3 = I.dpred; I.__ord3 = I.dord; I.__pd3 = I.pdeb || '';
            I.links = [{{ id: 'Q1', des: 'd1', lot: 'l1', prim: 'p1', sec: 's1', prd: [], chg: [{{ id: 'n1' }}, {{ id: 'n2' }}] }}, {{ id: 'Q2', des: 'd1', lot: 'l2', prim: 'p1', sec: 's1', prd: [], chg: [{{ id: 'n3' }}] }}];
            I.dlp = {{ 'l1|s1': [{{ id: 'a', deb: '2026-11-02', fin: '2026-11-02' }}], 'l2|s1': [{{ id: 'b', deb: '2026-11-09', fin: '2026-11-09' }}] }};
            I.dpred = {{}}; I.dinc = {{}}; I.dlim = {{}}; I.plafR = {{}}; I.appro = null; I.hset = null; I.hrange = null; I.hval = null; I.pdeb = '2026-11-02';
            I.dord = ['l1|s1', 'l2|s1']; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"dly\"]')?.click()"); pg.wait_for_timeout(700)
        # R25 : rien de coché = rien à compresser
        r25 = pg.evaluate(f"() => {DXJ}.canComp()")
        check("v570 (remarque longue 1) : sans charge cochée, GÉNÉRER / COMPRESSER reste possible (capacités de la main-d'œuvre, liaisons proposées)", r25 and r25.get("ok") is True, r25)
        # R24 : capacités MACON 4 et SABLE 5 actives ensemble ; MACON coché — le sable (10 M3) fixe la durée à 2 jours
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.plafR = {{ '{GM}': {{ plaf: 4 }}, '{GS}': {{ plaf: 5 }} }};
            I.chg.filter(r => /^n[13]$/.test(r.id)).forEach(r => {{ r.on = true; }}); X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(500)
        pg.evaluate(f"() => {DXJ}.comp()"); pg.wait_for_timeout(700)
        r24 = pg.evaluate(f"""() => {{ const I = {ins}.INS, p = I.dlp['l1|s1'][0]; return [p.deb, p.fin, (I.dlim || {{}})['l1|s1'] || '', !!document.querySelector('#dlyGantt .gb-lim[data-key="l1|s1"]'), {DXJ}.limTxt('l1|s1')]; }}""")
        r27 = pg.evaluate(f"() => {DXJ}.canComp()")
        check("v543 R24 / R27 : la ressource la plus limitante (sable) fixe la durée, repère ⧖ ; ensuite ↻ grisé (RIEN À AJUSTER)",
              r24[:3] == ["2026-11-02", "2026-11-03", GS] and r24[3] and "SABLE" in r24[4] and r27.get("ok") is False and "RIEN À AJUSTER" in r27.get("why", ""), [r24, r27])
        r26 = pg.evaluate(f"() => {{ const I = {ins}.INS; return [JSON.stringify(I.dpred['l2|s1'] || []), I.dlp['l2|s1'][0].deb]; }}")
        check("v543 R26 / v578 P11 R10 : COMPRESSER crée la liaison FIN → DÉBUT avec la tâche du dessus ; la suivante commence après la fin de la précédente (le 04)", '"k":"l1|s1"' in r26[0] and r26[1] == "2026-11-04", r26)
        # R21 / R23 : sable illimité ; MACON 1 → coupe le 06/11 (rattachée à la 1re tâche) ; MACON 4 → la coupe suit la fin de la 1re tâche
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.plafR['{GS}'] = {{ plaf: -1 }}; I.plafR['{GM}'] = {{ plaf: 1 }}; I.dlim = {{}}; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        pg.evaluate(f"() => {DXJ}.comp()"); pg.wait_for_timeout(600)
        a1 = pg.evaluate(f"() => {{ const I = {ins}.INS; return [I.dlp['l1|s1'][0].fin, I.dlp['l2|s1'][0].deb]; }}")
        pg.evaluate(f"() => {DXJ}.cutPlaf('2026-11-06')"); pg.wait_for_timeout(400)
        pg.evaluate(f"() => {DXJ}.plafSeg(0, 4)"); pg.wait_for_timeout(700)
        a2 = pg.evaluate(f"""() => {{ const I = {ins}.INS; return [I.dlp['l1|s1'][0].fin, I.dlp['l2|s1'][0].deb, JSON.stringify(I.plafR['{GM}'].plafs.map(c => c.after)), [...document.querySelectorAll('.dlyg-foot .gplaf .gplaf-v')].map(e => e.textContent).join(' | ')]; }}""")
        check("v543 R21 / R23 : capacité 1 puis coupe ; capacité 4 sur le 1er morceau → la 1re tâche finit le 02, la coupe suit (03), le 2e morceau garde 1 ouvrier",
              a1 == ["2026-11-05", "2026-11-06"] and a2[0] == "2026-11-02" and a2[1] == "2026-11-03" and '"l1|s1"' in a2[2] and "03/11/2026 : CAPACITÉ 1" in a2[3], [a1, a2])
        # R21 : morceau sous le zéro = ILLIMITÉ ; R22 : toucher le « / » = SUPPRIMER LA COUPE
        pg.evaluate(f"() => {DXJ}.plafSeg(1, -1)"); pg.wait_for_timeout(600)
        il = pg.evaluate("() => [!!document.querySelector('.dlyg-foot .gplaf.gcap-inf'), (document.querySelector('.dlyg-foot .gplaf.gcap-inf .gplaf-v') || {}).textContent || '']")
        pg.evaluate("() => document.querySelector('.dlyg-foot .gcut[data-i]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))"); pg.wait_for_timeout(300)
        dc = pg.evaluate("() => (document.querySelector('#svConf .svc-t') || {}).textContent || ''")
        pg.evaluate("() => document.querySelector('#svConf [data-v=\"go\"]')?.click()"); pg.wait_for_timeout(600)
        dc2 = pg.evaluate(f"() => ({ins}.INS.plafR['{GM}'].plafs || []).length")
        # v585 : capacité 0 puis coupe à 1 ; SUPPRIMER LA COUPE → le morceau fusionné prend 1, réponse en moins d'une seconde ; capacité 0 jusqu'à la fin → arrêt immédiat
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.plafR['{GM}'] = {{ plaf: 2, plafs: [{{ d: '2026-11-04', n: 0, after: [] }}] }}; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        pg.evaluate(f"() => {DXJ}.delCut(1)"); pg.wait_for_timeout(300)
        z1 = pg.evaluate(f"""() => {{ const b = document.querySelector('#svConf [data-v="go"]'); const t0 = performance.now(); if (b) b.click(); return new Promise(r => setTimeout(() => {{ const st = {ins}.INS.plafR['{GM}']; r([!!b, Math.round(performance.now() - t0), st.plaf, (st.plafs || []).length]); }}, 50)); }}""")
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.plafR['{GM}'] = {{ plaf: 0 }}; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        z2 = pg.evaluate(f"""() => {{ const t0 = performance.now(); const r = {DXJ}.comp(); const ts = [...document.querySelectorAll('.sv-toast, #svToast, .svt')].map(e => e.textContent).join(' '); return [r === null || r === undefined, Math.round(performance.now() - t0), ts]; }}""")
        pg.evaluate(f"""() => {{ const X = {ins}; X.INS.plafR['{GM}'] = {{ plaf: -1 }}; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(300)
        check("v591 : capacité 2 puis coupe à 0, SUPPRIMER LA COUPE → le morceau de droite s'aligne sur la gauche (2), réponse en moins d'une seconde ; v585 : capacité 0 jusqu'à la fin → calcul arrêté tout de suite",
              z1[0] and z1[1] < 1000 and z1[2] == 2 and z1[3] == 0 and z2[0] and z2[1] < 1000 and "CAPACITÉ 0 JUSQU'À LA FIN" in z2[2], [z1, z2])
        check("v543 R21 / R22 : morceau sous le zéro = ILLIMITÉ ; toucher le « / » = SUPPRIMER LA COUPE", il[0] and "ILLIMITÉ" in il[1] and dc == "SUPPRIMER LA COUPE" and dc2 == 0, [il, dc, dc2])
        # v604 (remarque longue 4) : rendement réglé — durée = quantité ÷ (rendement × ouvriers), borné au MAX
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.plafR = {{ '{GM}': {{ plaf: 1 }}, '{GS}': {{ plaf: -1 }} }}; I.hset = {{ rdmax: 200 }}; I.dlim = {{}}; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        pg.evaluate(f"() => {DXJ}.comp()"); pg.wait_for_timeout(600)
        q0 = pg.evaluate(f"() => {ins}.INS.dlp['l1|s1'][0].fin")
        pg.evaluate(f"() => {DXJ}.rdSet('{GM}', '', 0, 400)"); pg.wait_for_timeout(700)
        q1 = pg.evaluate(f"() => {{ const I = {ins}.INS; return [I.plafR['{GM}'].rd, I.dlp['l1|s1'][0].deb, I.dlp['l1|s1'][0].fin]; }}")
        pg.evaluate(f"""() => {{ const X = {ins}; X.INS.plafR = {{ '{GM}': {{ plaf: -1 }} }}; X.INS.hset = null; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(300)
        check("v604 : MACON 4 J-H, 1 ouvrier : 4 jours à 100 % ; rendement demandé 400 % → borné au MAX 200 % → 2 jours (02 → 03)",
              q0 == "2026-11-05" and q1 == [200, "2026-11-02", "2026-11-03"], [q0, q1])
        # v617 (remarque 85) : coupe interdite — la tâche attend d'aller au bout sans arrêt ; autorisée — elle est coupée
        def cut_run(allow):
            pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.plafR = {{ '{GM}': {{ plaf: 1, plafs: [{{ d: '2026-11-04', n: 0, after: [] }}, {{ d: '2026-11-05', n: 1, after: [] }}] }}, '{GS}': {{ plaf: -1 }} }};
                I.hset = null; I.dlim = {{}}; I.dcut = {'true' if allow else 'false'}; I.chg.forEach(r => {{ r.on = r.id === 'n1' || r.id === 'n3'; }}); X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
            pg.evaluate(f"() => {DXJ}.comp()"); pg.wait_for_timeout(600)
            return pg.evaluate(f"() => {{ const L = {ins}.INS.dlp['l1|s1']; return [L.length, L[0].deb, L[L.length - 1].fin]; }}")
        c1, c0 = cut_run(True), cut_run(False)
        pg.evaluate(f"""() => {{ const X = {ins}; X.INS.plafR = {{ '{GM}': {{ plaf: -1 }} }}; X.INS.dcut = true; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(300)
        check("v617 : MACON 4 J-H, 1 ouvrier, capacité 0 le 04 — coupe autorisée : 2 morceaux du 02 au 06 ; interdite : un seul tenant du 05 au 09 (dimanche non travaillé)", c1[0] == 2 and c1[1] == "2026-11-02" and c0 == [1, "2026-11-05", "2026-11-09"], [c1, c0])
        # v612 (point 7) : produits cochés en partie — la charge de la tâche compte au prorata de leur quantité (graphique)
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.prd.push({{ id: 'y1', des: 'P1', u: 'M2', q: 10, on: true }}, {{ id: 'y2', des: 'P2', u: 'M2', q: 30 }});
            I.links[0].prd = [{{ id: 'y1' }}, {{ id: 'y2' }}]; I.chg.forEach(r => {{ r.on = r.id === 'n1'; }}); I.hset = {{ u: 'q', aff: 'j', cum: 'r' }}; I.hrange = null; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(600)
        pz = pg.evaluate("() => { const D = document.querySelector('#dlyGantt').__HD; return D ? Math.round(Object.values(D.tot).reduce((t, v) => t + v, 0) * 1000) / 1000 : null; }")
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.prd = I.prd.filter(r => !/^y[12]$/.test(r.id)); I.links[0].prd = []; I.hset = null; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(300)
        check("v612 : MACON 4 J-H sur une tâche à deux produits (10 et 30 M2), seul le 1er coché → 4 × 10 / 40 = 1 J-H au graphique", pz == 1, pz)
        # R18 / R19 / R20 : cumulé, plage DÉBUT – FIN, filtre MIN – MAX qui coche les charges des jours retenus
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.plafR = {{}}; I.dlp = {{ 'l1|s1': [{{ id: 'a', deb: '2026-11-02', fin: '2026-11-02' }}], 'l2|s1': [{{ id: 'b', deb: '2026-11-04', fin: '2026-11-04' }}] }}; I.dpred = {{}};
            I.chg.filter(r => /^n[123]$/.test(r.id)).forEach(r => {{ r.on = true; }}); I.hset = {{ u: 'm', aff: 'c', cum: 'r' }}; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(600)
        cu = pg.evaluate("() => [!!document.querySelector('.dlyg-foot .ghist-cum polyline'), (document.querySelector('.dlyg-foot .gax-u') || {}).textContent || '']")
        pg.evaluate(f"() => {DXJ}.hrangeSet({{ a: '2026-11-04', b: '' }})"); pg.wait_for_timeout(500)
        rg = pg.evaluate("() => [(document.querySelector('.dlyg-foot .grng-tot') || {}).textContent || '', !!document.querySelector('.dlyg-foot .grng[data-r=\"a\"]:not(.grng-off)')]")
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.hset = {{ u: 'm', aff: 'j', cum: 'r' }}; X.INS.hrange = null; X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(500)
        pg.evaluate(f"() => {DXJ}.hvalSet({{ min: 300, max: null }})"); pg.wait_for_timeout(700)
        mm = pg.evaluate(f"() => {ins}.INS.chg.filter(r => /^n[123]$/.test(r.id)).map(r => r.id + ':' + (r.on === true))")
        check("v543 R18 / R19 / R20 : courbe cumulée ; plage à partir du 04/11 = 200 DH (relatif) ; MIN 300 DH garde le 02/11 et coche ses charges (MACON + SABLE), décoche les autres",
              cu[0] and "CUMULÉS" in cu[1] and rg[0].startswith("200") and rg[1] and mm == ["n1:true", "n2:true", "n3:false"], [cu, rg, mm])
        # R17 : approvisionnement — couverture 1 jour, seuil SABLE 15 M3 : 10 M3 le 02, puis rien → une seule commande (reliquat), 1 jour d'avance
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.hval = null; I.chg.filter(r => r.id === 'n2').forEach(r => {{ r.on = true; }}); I.chg.filter(r => r.id !== 'n2').forEach(r => {{ r.on = false; }});
            I.hset = {{ u: 'q', aff: 'j', cum: 'r' }}; I.appro = {{ dl: 1, cov: 'n', nj: 1, dep: '', seuil: {{ '{GS}': 15 }}, on: true }}; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(600)
        ap = pg.evaluate("() => [[...document.querySelectorAll('.dlyg-foot .ghb.ghc')].map(b => b.dataset.d), (document.querySelector('.dlyg-foot .ghist-cmd .ghist-leg') || {}).textContent || '']")
        check("v543 R17 : APPROVISIONNEMENT PRÉVISIONNEL — seuil par charge et délai d'approvisionnement (commande le 01/11 pour le 02/11)", ap[0] == ["2026-11-01"] and "APPROVISIONNEMENT PRÉVISIONNEL" in ap[1], ap)
        # v589 : une charge garde sa couleur dans tous les réglages (orange si seule) ; produits bleu, marge verte ; plus de vert ni de gris pour les commandes
        COLS = """() => { const h = document.querySelector('.dlyg-foot .ghist'); if (!h) return null; const S = new Set();
            h.querySelectorAll('.ghb:not(.ghb-hit):not(.gh-off)').forEach(b => { if (b.classList.contains('ghb-st')) b.querySelectorAll('i').forEach(i => S.add(getComputedStyle(i).backgroundColor)); else S.add(getComputedStyle(b).backgroundColor); });
            h.querySelectorAll('polyline').forEach(l => S.add(getComputedStyle(l).stroke)); h.querySelectorAll('circle').forEach(l => S.add(getComputedStyle(l).fill)); return [...S].filter(c => c && c !== 'none' && c !== 'rgba(0, 0, 0, 0)').sort(); }"""
        OR, BL, GR, RE, LG = "rgb(247, 144, 9)", "rgb(46, 144, 250)", "rgb(18, 183, 106)", "rgb(217, 45, 32)", "rgb(192, 198, 208)"
        res = []
        for cfg, cr, ap_on, allowed in [("{ u: 'q', aff: 'j', cum: 'r', forme: 'h' }", "", True, {OR}), ("{ u: 'q', aff: 'c', cum: 'r', forme: 'h' }", "", True, {OR}),
                                         ("{ u: 'q', aff: 'c', cum: 'r', forme: 'c' }", "", True, {OR, LG}), ("{ u: 'q', aff: 'j', cum: 'r', forme: 'h' }", "", False, {OR, RE}),
                                         ("{ u: 'q', aff: 'c', cum: 'r', forme: 'c' }", "", False, {OR, LG}), ("{ u: 'm', aff: 'j', cum: 'r', forme: 'h', crb: ['c', 'p', 'g'] }", "", False, {OR, BL, GR, RE}),
                                         ("{ u: 'm', aff: 'c', cum: 'r', forme: 'c', crb: ['c', 'p', 'g'] }", "", False, {OR, BL, GR, RE, LG})]:
            pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.hset = {cfg}; I.appro = {{ dl: 1, cov: 'n', nj: 1, dep: '', seuil: {{}}, on: {'true' if ap_on else 'false'} }}; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(500)
            got = pg.evaluate(COLS) or []
            res.append([cfg, ap_on, got, set(got) <= allowed and OR in got])
        check("v589 : CHARGES en orange dans tous les réglages (jour, cumulé, histogramme, courbes, commandes) ; produits bleu, marge verte ; aucune autre couleur",
              all(r[3] for r in res), [r for r in res if not r[3]])
        # R28 : zone touchée = rubrique en premier ; R29 : vue PAR DÉBUT (numéro du lot, rien d'enregistré)
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.appro = null; X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(400)
        pg.evaluate("() => { const h = document.querySelector('.dlyg-foot .ghist'); if (h) h.scrollIntoView({ block: 'center' }); }"); pg.wait_for_timeout(200)
        hb = pg.evaluate("() => { const h = document.querySelector('.dlyg-foot .ghist'); if (!h) return null; const r = h.getBoundingClientRect(); return [r.left + 60, r.top + 30]; }")
        if hb: pg.mouse.click(hb[0], hb[1]); pg.wait_for_timeout(300)
        pg.evaluate("() => document.getElementById('dlyHb')?.remove()")
        pg.evaluate("() => document.querySelector('#bdgDetailHead .blk-more')?.click()"); pg.wait_for_timeout(300)
        z1 = pg.evaluate("() => [...document.querySelectorAll('#blkMenu .blk-hint')].map(e => e.textContent).slice(0, 3)")
        pg.evaluate("() => document.getElementById('blkMenu')?.remove()")
        z1b = pg.evaluate("() => !!document.querySelector('.dlyg.dz-hist')")
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.dlp['l2|s1'] = [{{ id: 'b', deb: '2026-10-30', fin: '2026-10-30' }}]; I.dord = ['l1|s1', 'l2|s1']; window.__r29on = I.chg.filter(r => r.on === true).map(r => r.id); window.__r29hr = JSON.stringify(I.hrange || null); I.chg.forEach(r => {{ r.on = false; }}); I.hrange = null; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        pg.evaluate(f"() => {DXJ}.viewSet('d')"); pg.wait_for_timeout(500)
        vd = pg.evaluate(f"""() => [[...document.querySelectorAll('#bdgTabBody .dlyg-l tr.dly-task')].map(t => t.dataset.key), !!document.querySelector('#bdgTabBody .dly-vno'), !!document.querySelector('#bdgTabBody .dly-vd'), JSON.stringify({ins}.INS.dord)]""")
        pg.evaluate(f"() => {DXJ}.viewSet('l')"); pg.wait_for_timeout(400)
        vl = pg.evaluate("() => [...document.querySelectorAll('#bdgTabBody .dlyg-l tr.dly-task')].map(t => t.dataset.key)")
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.chg.forEach(r => {{ if ((window.__r29on || []).includes(r.id)) r.on = true; }}); I.hrange = JSON.parse(window.__r29hr || 'null'); X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(300)
        check("v543 R29 / v561 : menu PLANNING / GRAPHIQUE, sans liseré ; vue PAR DÉBUT en escalier (numéro du lot), sans bandeau (v594 : la vue se lit à la coche ✓ du menu), sans changer l'ordre enregistré",
              z1 == [] and not z1b and vd[0] == ["l2|s1", "l1|s1"] and vd[1] and not vd[2] and vd[3] == '["l1|s1","l2|s1"]' and vl == ["l1|s1", "l2|s1"], [z1, z1b, vd, vl])
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.links = I.__lk3; I.dlp = I.__dlp3; I.dpred = I.__dp3; I.dord = I.__ord3; I.pdeb = I.__pd3;
            ['__lk3', '__dlp3', '__dp3', '__ord3', '__pd3'].forEach(k => delete I[k]); I.dinc = {{}}; I.dlim = {{}}; I.plafR = {{}}; I.appro = null; I.hset = null; I.hrange = null; I.hval = null;
            I.chg = I.chg.filter(r => !/^n[123]$/.test(r.id)); X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        pg.set_viewport_size({"width": 1180, "height": 820}); pg.wait_for_timeout(300)

        # v547 (R22) : COMPRESSER coupe une tâche (capacité 0 le 04/11) ; Gantt en morceaux ; fenêtre MORCEAUX, RECOLLER
        DXJ = "[...document.querySelectorAll('*')].find(e => e.__insDly).__insDly"
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS;
            I.chg.forEach(r => {{ r.on = false; }});
            I.chg.push({{ id: 'v1', des: 'MACON', u: 'JH', q: 8, p: 100, on: true }});
            I.__lk7 = I.links; I.__dlp7 = I.dlp; I.__dp7 = I.dpred; I.__ord7 = I.dord; I.__pd7 = I.pdeb || '';
            I.links = [{{ id: 'V1', des: 'd1', lot: 'l1', prim: 'p1', sec: 's1', prd: [], chg: [{{ id: 'v1' }}] }}];
            I.dlp = {{ 'l1|s1': [] }}; I.dpred = {{}}; I.dinc = {{}}; I.pdeb = '2026-11-02'; I.dord = ['l1|s1']; I.hset = {{ u: 'q', aff: 'j', cum: 'r' }};
            I.plafR = {{ 'MACON|J-H': {{ plaf: 2, plafs: [{{ d: '2026-11-04', n: 0, after: [] }}, {{ d: '2026-11-05', n: 2, after: [] }}] }} }};
            X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"dly\"]')?.click()"); pg.wait_for_timeout(700)
        pg.evaluate(f"() => {DXJ}.gen()"); pg.wait_for_timeout(800)
        m1 = pg.evaluate(f"""() => [JSON.stringify(({ins}.INS.dlp['l1|s1'] || []).map(p => [p.deb, p.fin])), document.querySelectorAll('#dlyGantt .gb.gb-pc[data-key="l1|s1"]').length,
            (document.querySelector('tr[data-key="l1|s1"] .dlp-multi .dlp-pcn') || {{}}).textContent || '', (document.querySelector('tr[data-key="l1|s1"] td:nth-last-child(4) .dlp-multi, tr[data-key="l1|s1"] .dlp-multi') || {{}}).textContent || '']""")
        if os.environ.get("SHOT"): pg.screenshot(path=os.environ["SHOT"] + "v547a.png")
        pg.evaluate("() => document.querySelector('tr[data-key=\"l1|s1\"] .dlp-multi')?.click()"); pg.wait_for_timeout(400)
        if os.environ.get("SHOT"): pg.screenshot(path=os.environ["SHOT"] + "v547b.png")
        m2 = pg.evaluate("() => [(document.querySelector('#svConf .svc-t') || {}).textContent || '', document.querySelectorAll('#svConf .pcs-d[data-f=\"deb\"]').length]")
        pg.evaluate("() => document.querySelector('#svConf [data-glue]')?.click()"); pg.wait_for_timeout(200)
        pg.evaluate("() => document.querySelector('#svConf [data-ok]')?.click()"); pg.wait_for_timeout(600)
        m3 = pg.evaluate(f"() => JSON.stringify(({ins}.INS.dlp['l1|s1'] || []).map(p => [p.deb, p.fin]))")
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.links = I.__lk7; I.dlp = I.__dlp7; I.dpred = I.__dp7; I.dord = I.__ord7; I.pdeb = I.__pd7;
            ['__lk7', '__dlp7', '__dp7', '__ord7', '__pd7'].forEach(k => delete I[k]); I.plafR = {{}}; I.hset = null; I.dinc = {{}}; I.dlim = {{}}; I.chg = I.chg.filter(r => r.id !== 'v1'); X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        # v548 (FORMAT 197) : bloc agrandi — planning et histogramme dans l'écran visible, histogramme au bas de l'écran
        pg.evaluate("() => document.querySelector('.blk-max-btn[data-blk=\"detail\"]')?.click()"); pg.wait_for_timeout(1200)
        f197 = pg.evaluate("() => { const h = document.querySelector('.dlyg-foot .ghist'), sc = document.querySelector('.dly-scroll'); const vv = window.visualViewport, b = vv ? vv.offsetTop + vv.height : innerHeight; return h && sc ? [Math.round(h.getBoundingClientRect().bottom), Math.round(sc.getBoundingClientRect().bottom), Math.round(b)] : null; }")
        pg.evaluate("() => document.querySelector('.blk-max-btn[data-blk=\"detail\"]')?.click()"); pg.wait_for_timeout(800)
        check("v548 FORMAT 197 : bloc agrandi — l'histogramme est au bas de l'écran visible, le bloc ne dépasse pas l'écran",
              f197 and f197[1] <= f197[2] + 1 and f197[0] <= f197[2] + 1 and f197[2] - f197[0] <= 70, f197)
        # v549 : plus de bouton AJOUTER sous le planning (entrée du menu ⋯) ; barre marron limitée au Gantt quand le tableau est affiché
        v549 = pg.evaluate("() => { const hh = document.querySelector('.dlyg-hh'), sp = document.querySelector('.dlyg-sp'), sc = document.querySelector('.dly-scroll'); return [!!document.querySelector('.dly-add'), hh && sp ? Math.abs(hh.getBoundingClientRect().left - sp.getBoundingClientRect().left) < 2 && Math.abs(hh.getBoundingClientRect().right - sc.getBoundingClientRect().right) < 3 : null]; }")
        pg.evaluate("() => document.querySelector('#bdgDetailHead .blk-more')?.click()"); pg.wait_for_timeout(300)
        v549m = pg.evaluate("() => [...document.querySelectorAll('#blkMenu [data-dly]')].map(b => b.dataset.dly).join(',') + '|' + [...document.querySelectorAll('#blkMenu .blk-hint')].map(e => e.textContent).join(',') + '|' + (document.getElementById('blkMenu') || {}).textContent")
        pg.evaluate("() => document.getElementById('blkMenu')?.remove()")
        check("v549 / v553 / v555 : plus de bouton AJOUTER sous le planning ni dans le menu ⋯ (P11 R3), ni RÉGLAGES DU GRAPHIQUE dans le menu (P11 R6) ; rubrique GRAPHIQUE ; barre marron de la barre verticale au bord droit du cadre (v552)",
              v549 == [False, True] and "add" not in v549m and "appr" not in v549m and "RÉGLAGES DU GRAPHIQUE" not in v549m and "v-d" not in v549m.split("|")[0].split(",") and "cut" not in v549m.split("|")[0].split(","), [v549, v549m])
        # v553 (partie 11, R5) : case de date active (calendrier ouvert) = ni contour rouge ni point au coin
        r5 = pg.evaluate("""() => { const i = document.querySelector('.dlyg-l input.dlp-in[data-f="deb"]'); if (!i) return null; i.click(); i.focus();
            const td = i.closest('td'), H = document.getElementById('sviSelHandle'); const r = [getComputedStyle(i).boxShadow, getComputedStyle(td).boxShadow, !H || H.style.display === 'none'];
            document.querySelectorAll('#svCal, .sv-cal, #sviCal').forEach(e => e.remove()); i.blur(); return r; }""")
        check("v553 P11 R5 : case de date active sans contour rouge ni point au coin", r5 is not None and r5[0] == "none" and r5[1] == "none" and r5[2], r5)
        # v550 : graphique plein écran — défiler la page ne l'agrandit pas ; caché (0) = barre « = » au bas de l'écran
        pg.evaluate(f"() => {DXJ}.hh('full')"); pg.wait_for_timeout(800)
        g0 = []
        for _ in range(3):
            pg.evaluate("() => window.scrollBy(0, 150)"); pg.wait_for_timeout(600)
            g0.append(pg.evaluate("() => { const h = document.querySelector('.dlyg-foot .ghist'); return h ? h.offsetHeight : 0; }"))
        pg.evaluate(f"() => {DXJ}.hh(0)"); pg.wait_for_timeout(800)
        g1 = pg.evaluate("() => { const hh = document.querySelector('.dlyg-hh'), vv = window.visualViewport, b = vv ? vv.offsetTop + vv.height : innerHeight; const r = hh.getBoundingClientRect(); return [Math.round(r.top), Math.round(b)]; }")
        g2 = pg.evaluate("() => { const sc = document.querySelector('.dly-scroll'), hh = document.querySelector('.dlyg-hh'), vv = window.visualViewport, b = vv ? vv.offsetTop + vv.height : innerHeight; const r = sc.getBoundingClientRect(); return [Math.round(r.bottom), Math.round(b), Math.round(hh.getBoundingClientRect().bottom)]; }")
        check("v551 FORMAT 200 : le cadre du PLANNING se ferme au bas de l'écran ; la barre « = » est posée sur sa limite (rien en dessous)",
              g2[0] <= g2[1] + 1 and g2[1] - g2[0] <= 60 and 0 <= g2[0] - g2[2] <= 12, g2)   # v787 : barres de titre des blocs moins hautes — page plus courte   # v727 : blocs à leur nombre de lignes, la page est plus courte (cadre = hauteur du bloc détail)
        pg.evaluate("() => localStorage.removeItem('svi_dlyhh_v1')"); pg.evaluate(f"() => {DXJ}.hh(110)"); pg.wait_for_timeout(500)
        check("v550 : graphique plein écran stable quand la page défile ; graphique caché = barre « = » visible au bas de l'écran",
              len(set(g0)) == 1 and g0[0] > 0 and g1[0] < g1[1] and g1[1] - g1[0] < 90, [g0, g1])   # v787 : page plus courte (barres de titre des blocs)
        check("v547 R22 : COMPRESSER coupe la tâche autour de la pénurie (02-03 / 05-06) ; deux barres, pastille 2 ; MORCEAUX → RECOLLER = un seul morceau de 4 jours",
              m1[0] == '[["2026-11-02","2026-11-03"],["2026-11-05","2026-11-06"]]' and m1[1] == 2 and m1[2] == "2" and m2[0].startswith("MORCEAUX") and m2[1] == 2 and m3 == '[["2026-11-02","2026-11-05"]]', [m1, m2, m3])

        # v546 : remarques 14 à 35 (sauf 22)
        DXJ = "[...document.querySelectorAll('*')].find(e => e.__insDly).__insDly"
        pg.set_viewport_size({"width": 1180, "height": 900}); pg.wait_for_timeout(300)
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS;
            I.chg.forEach(r => {{ r.on = false; }});
            I.chg.push({{ id: 'w1', des: 'MACON', u: 'JH', q: 4, p: 100, on: true }}, {{ id: 'w2', des: 'MACON', u: 'JH', q: 2, p: 100, on: true }}, {{ id: 'w3', des: 'SABLE', u: 'JH', q: 10, p: 50, on: true }});   /* v711 : capacité = même unité */
            I.__lk6 = I.links; I.__dlp6 = I.dlp; I.__dp6 = I.dpred; I.__ord6 = I.dord;
            I.links = [{{ id: 'W1', des: 'd1', lot: 'l1', prim: 'p1', sec: 's1', prd: [], chg: [{{ id: 'w1' }}, {{ id: 'w3' }}] }}, {{ id: 'W2', des: 'd1', lot: 'l2', prim: 'p1', sec: 's1', prd: [], chg: [{{ id: 'w2' }}] }}];
            I.dlp = {{ 'l1|s1': [{{ id: 'a', deb: '2026-11-02', fin: '2026-11-03' }}], 'l2|s1': [{{ id: 'b', deb: '2026-11-04', fin: '2026-11-05' }}], 'l1|s2': [{{ id: 'c', deb: '2026-11-06', fin: '2026-11-06' }}] }};
            I.dpred = {{ 'l2|s1': [{{ k: 'l1|s1', t: 'FD', o: 1 }}] }}; I.plafR = {{}}; I.hset = {{ u: 'm', aff: 'j', cum: 'r' }}; I.dord = ['l1|s1', 'l2|s1', 'l1|s2']; I.dinc = {{}};
            X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        pg.evaluate("() => localStorage.setItem('svi_dlyhh_v1', '160')")
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"dly\"]')?.click()"); pg.wait_for_timeout(900)
        if os.environ.get("SHOT"): pg.screenshot(path=os.environ["SHOT"] + "v546a.png")
        q = pg.evaluate("""() => { const G = document.querySelector('#dlyGantt'), FT = document.querySelector('.dlyg-foot') || G, sc = document.querySelector('.dly-scroll'), L = document.querySelector('.dlyg-l'), h = FT.querySelector('.ghist');
            return { z0: !!G.querySelector('.gb.gb0[data-key="l1|s2"]'), succ: (document.querySelector('tr[data-key="l1|s1"] .dly-succ') || {}).textContent || '', succH: !!document.querySelector('.dly-table th .cf-btn[data-col="succ"]'),
              cap: (FT.querySelector('.gplaf.gcap-def .gplaf-v') || {}).textContent || '', segv: (FT.querySelector('.gseg-v') || {}).textContent || '', unit: (FT.querySelector('.gax-u') || {}).textContent || '',
              leftBottom: L.offsetHeight, histBottom: G.offsetHeight, cfg: !!document.querySelector('.blk-cfg-btn.dly-on') && !document.querySelector('.dlyhh-cfg'), vd: !!document.querySelector('.dly-vd'),
              adj: [!!document.querySelector('.blk-adj-btn.dly-on'), document.querySelector('.blk-adj-btn').classList.contains('off')], dz: !!document.querySelector('.dlyg[class*="dz-"]'), obj: !!G.querySelector('.gv-obj') }; }""")
        # R24 : abréviation (capacité en DH : 400 DH + 500 DH le 02 → « K » quand ≥ 10 000) ; R19 : coupe, trait vertical, déplacement
        pg.evaluate(f"""() => {{ const I = {ins}.INS; I.chg.find(r => r.id === 'w3').p = 5000; {ins}.insSave(); {ins}.refreshAll(); }}"""); pg.wait_for_timeout(500)
        kfmt = pg.evaluate("() => [...document.querySelectorAll('.dlyg-foot .gax-t')].map(e => e.textContent).join('|')")
        GK = pg.evaluate(f"() => {DXJ}.hasSel() && Object.keys({ins}.INS.plafR || {{}}).length")
        pg.evaluate(f"() => {DXJ}.cutPlaf('2026-11-04')"); pg.wait_for_timeout(400)
        pg.evaluate(f"() => {DXJ}.plafSeg(1, 30000)"); pg.wait_for_timeout(500)
        cv = pg.evaluate("() => [!!document.querySelector('.dlyg-foot .gcut-v'), (document.querySelector('.dlyg-foot .gcut') || {dataset: {}}).dataset.eq]")
        pg.evaluate(f"() => {DXJ}.plafSeg(1, Math.round(({ins}.INS.plafR[Object.keys({ins}.INS.plafR)[0]].plaf)))"); pg.wait_for_timeout(500)
        pg.evaluate(f"() => {DXJ}.moveCut(1, '2026-11-05')"); pg.wait_for_timeout(500)
        mc = pg.evaluate(f"() => JSON.stringify(Object.values({ins}.INS.plafR).map(x => (x.plafs || []).map(c => c.d)))")
        if os.environ.get("SHOT"): pg.screenshot(path=os.environ["SHOT"] + "v651.png")
        t651 = pg.evaluate("""() => { const t = document.querySelector('.dlyg-hh .dlyhh-tot'), p = document.querySelector('.dlyhh-pill'), v = [...document.querySelectorAll('.dlyg-foot .gseg-v')], c = [...document.querySelectorAll('.dlyg-foot .gplaf')];
            const r = e => e.getBoundingClientRect(); return { tot: t && !t.hidden ? t.textContent : '', below: t && p ? Math.round(r(t).top - r(p).bottom) : null, cx: t && p ? Math.round((r(t).left + r(t).right - r(p).left - r(p).right) / 2) : null,
              gap: v.map((e, i) => c[i] ? Math.round(r(c[i]).top - r(e).bottom) : null), n: v.length }; }""")
        check("v651 FORMAT 245 : capacité coupée = un total par morceau 2 px au-dessus de son trait, TOTAL centré sous la poignée « = »",
              t651["n"] >= 1 and all(g is not None and 0 <= g <= 4 for g in t651["gap"]) and t651["tot"].startswith("TOTAL") and t651["cx"] is not None and abs(t651["cx"]) <= 1 and 0 <= t651["below"] <= 8, t651)
        # R28 / R29 : cumulé = une courbe ; ⚙ : PRODUITS et MARGE
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.plafR = {{}}; X.INS.hset = {{ u: 'm', aff: 'c', cum: 'r' }}; X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(500)
        nl = pg.evaluate("() => document.querySelectorAll('.dlyg-foot .ghist-cum polyline').length")
        if os.environ.get("SHOT"): pg.screenshot(path=os.environ["SHOT"] + "v546b.png")
        pg.evaluate("() => document.querySelector('.blk-hcfg-btn')?.click()"); pg.wait_for_timeout(300)
        # v701 : ⚙ = RÉGLAGES DU GANTT (affichage, ordre, coupe, COMPRESSER, GÉNÉRER) puis RÉGLAGES DU GRAPHIQUE…
        gcf = pg.evaluate("() => { const d = document.getElementById('svConf'); return d ? [(d.querySelector('.svc-t') || {}).textContent, d.querySelectorAll('input[name=gcs]').length, d.querySelectorAll('input[name=gco]').length, !!d.querySelector('.gcf-cut'), !!d.querySelector('[data-gcf=comp]'), !!d.querySelector('[data-gcf=gen]'), !!d.querySelector('[data-gcf=graph]')] : null; }")
        check("v701 : ⚙ RÉGLAGES DU GANTT — JOUR / SEMAINE / MOIS, NORMAL / PAR DÉBUT, COUPE, COMPRESSER, GÉNÉRER, RÉGLAGES DU GRAPHIQUE…",
              gcf and gcf[0] == "RÉGLAGES DU GANTT" and gcf[1] == 3 and gcf[2] == 2 and all(gcf[3:]), gcf)
        # v731 (bloc 2, point 6, suite) : calendrier de la tâche = budget + jours non travaillés de ses charges (durées, dates, graphique, approvisionnement)
        c731 = pg.evaluate("""() => { const DX = DXJ_, X = INS_X, I = X.INS, keep = JSON.stringify(I.chgCal || null);
            const L = I.links.find(l => (l.chg || []).length), r = I.chg.find(x => x.id === L.chg[0].id), k = L.lot + '|' + L.sec;
            const sk = dlyResK(r);
            const d0 = sviWDur(DX.cal(k), '2026-11-02', '2026-11-08'); I.chgCal = { [sk]: { we: [5] } };
            const d1 = sviWDur(DX.cal(k), '2026-11-02', '2026-11-08'), w = sviWork(DX.cal(k), '2026-11-06'), b = sviWork(DX.cal(), '2026-11-06');
            const K = JSON.parse(keep); if (K) I.chgCal = K; else delete I.chgCal; return [d1 === d0 - 1, w, b]; }""".replace("DXJ_", DXJ).replace("INS_X", ins))
        check("v731 : calendrier de la tâche — un vendredi non travaillé par sa charge raccourcit la durée d'un jour ; le budget garde son vendredi", c731 == [True, False, True], c731)
        # v726 (bloc 2, point 6) : CALENDRIER DES CHARGES depuis le ⚙ du Gantt
        pg.evaluate("() => document.querySelector('#svConf [data-gcf=ccal]')?.click()"); pg.wait_for_timeout(300)
        cc = pg.evaluate("() => [...document.querySelectorAll('.svc-t')].map(e => e.textContent).includes('CALENDRIER DES CHARGES') && document.querySelectorAll('.ccal').length > 0")
        check("v726 : ⚙ du Gantt → CALENDRIER DES CHARGES (jours non travaillés par charge)", cc, cc)
        pg.evaluate("() => document.querySelectorAll('.sv-win, #svConf').forEach(e => e.remove())"); pg.wait_for_timeout(200)
        pg.evaluate("() => document.getElementById('svConf')?.remove()"); pg.wait_for_timeout(200)
        # v704 : RÉGLAGES DU GRAPHIQUE (v774 : la roue unique ouvre le réglage de ce qui est affiché)
        pg.evaluate("() => [...document.querySelectorAll('*')].find(e => e.__insDly).__insDly.hcfgWin()"); pg.wait_for_timeout(300)
        hw = pg.evaluate("() => (document.querySelector('#svConf .svc-t') || {}).textContent || ''")
        pg.evaluate("() => { const d = document.getElementById('svConf'); d.querySelectorAll('.hcf-c:not([value=r])').forEach(i => { i.checked = true; }); d.querySelector('input[name=\"hca\"][value=\"j\"]').checked = true; d.querySelector('[data-ok]').click(); }"); pg.wait_for_timeout(600)
        pm = pg.evaluate(f"() => [JSON.stringify({ins}.INS.hset.crb), (document.querySelector('.dlyg-foot .ghist-leg') || {{}}).textContent || '']")
        # R25 : 0 = histogramme caché ; R17 : JOUR / SEMAINE / MOIS dans CALENDRIER DU BUDGET, SEMAINE remplit la largeur (R23)
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.hset = null; X.insSave(); }}")
        pg.evaluate(f"() => {DXJ}.hh(0)"); pg.wait_for_timeout(500)
        h0 = pg.evaluate("() => [!!document.querySelector('.dlyg.dly-hnone'), (() => { const h = document.querySelector('.dlyg-foot .ghist'); return h ? h.offsetHeight : 0; })()]")
        pg.evaluate("() => localStorage.removeItem('svi_dlyhh_v1')")
        pg.evaluate("() => sviBdgCalWin('2026-11-02')"); pg.wait_for_timeout(300)
        sc0 = pg.evaluate("() => [...document.querySelectorAll('#svConf .bcal-sc button')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')).join(',')")
        pg.evaluate("() => document.querySelector('#svConf .bcal-sc [data-sc=\"s\"]')?.click()"); pg.wait_for_timeout(600)
        sw = pg.evaluate("() => { const G = document.querySelector('#dlyGantt'); const dw = parseFloat(getComputedStyle(G).getPropertyValue('--dw')); return [localStorage.getItem('svi_dlyg_sc_v1'), dw, G.clientWidth]; }")
        # v553 (partie 11, R2) : SEMAINE — le calendrier s'arrête au dimanche de la dernière semaine du projet (pas de semaines vides) ; zoom arrière bloqué au remplissage
        p2 = pg.evaluate("() => { const G = document.querySelector('#dlyGantt'), dw = parseFloat(getComputedStyle(G).getPropertyValue('--dw')); const ws = [...G.querySelectorAll('.gh-w')]; return [ws.length, Math.round(G.scrollWidth - G.clientWidth), dw]; }")
        check("v553 P11 R2 : Gantt en SEMAINE limité du début à la fin du projet (lundi de la 1re semaine au dimanche de la dernière), aucune semaine vide au bout",
              p2[0] >= 1 and p2[0] <= 2 and p2[1] <= p2[2] * 7, p2)
        pg.evaluate("() => document.querySelector('#svConf [data-x]')?.click()")
        pg.evaluate("() => { window.__sviDlyScale.set('j'); localStorage.removeItem('svi_dlyg_dw_s_v1'); }"); pg.wait_for_timeout(500)
        # v559 : changer d'échelle = tout le projet dans la largeur visible, trait FIN au bord droit ; à l'ouverture, dernier zoom repris
        fitR = []
        for sc in ("m", "s", "j"):
            pg.evaluate(f"() => window.__sviDlyScale.set('{sc}')"); pg.wait_for_timeout(600)
            fitR.append(pg.evaluate("() => { const G = document.querySelector('#dlyGantt'), gh = G && G.querySelector('.gh'); return G ? [Math.round(G.clientWidth), Math.round(G.scrollWidth), Math.round(gh ? gh.scrollWidth : 0)] : null; }"))
        pg.evaluate("() => localStorage.setItem('svi_dlyg_dw_v1', '40')"); pg.evaluate(f"() => {{ const X = {ins}; X.refreshAll(); }}"); pg.wait_for_timeout(600)
        z40 = pg.evaluate("() => parseFloat(getComputedStyle(document.querySelector('#dlyGantt')).getPropertyValue('--dw'))")
        sto = pg.evaluate("() => localStorage.getItem('svi_dlyg_dw_v1')")
        pg.evaluate("() => window.__sviDlyScale.set('j')"); pg.wait_for_timeout(500)
        check("v559 : JOUR / SEMAINE / MOIS choisi = Gantt ajusté à la largeur (FIN au bord droit, sans défilement) ; dernier zoom repris à l'ouverture",
              all(r and abs(r[1] - r[0]) <= 1 and abs(r[2] - r[0]) <= 1 for r in fitR) and z40 >= 40 and sto == "40", [fitR, z40, sto])
        # v556 : défilement de la page et de la hauteur visible (barre de Safari) sans redessin complet du Gantt à chaque fois
        pg.evaluate("""() => { const G = document.querySelector('#dlyGantt'); window.__rd = 0;
            window.__mo = new MutationObserver(m => { if (m.some(x => x.type === 'childList' && x.target === G)) window.__rd++; }); window.__mo.observe(G, { childList: true }); }""")
        for i in range(24):
            pg.evaluate(f"() => {{ window.scrollTo(0, {(i % 6) * 40}); const s = document.querySelector('.dly-scroll'); if (s) s.scrollTop = {(i % 4) * 30}; }}")
            pg.wait_for_timeout(60)
        pg.wait_for_timeout(500); rs = pg.evaluate("() => window.__rd")
        pg.set_viewport_size({"width": 1180, "height": 760}); pg.wait_for_timeout(120)
        pg.set_viewport_size({"width": 1180, "height": 820}); pg.wait_for_timeout(700)
        rd = pg.evaluate("() => { window.__mo.disconnect(); window.scrollTo(0, 0); return window.__rd; }")
        check("v556 : défilement sans redessin du Gantt ; changement de hauteur de l'écran = redessin limité (avant : à chaque défilement, iPad figé)", rs == 0 and rd - rs <= 3, [rs, rd])
        # v557 (FORMAT 202) : même hauteur du bloc détail pour tous les onglets (DÉLAIS, CHARGES, PRODUITS…), réglée à la poignée, mémorisée
        def tabH(k):
            pg.evaluate(f"() => document.querySelector('#bdgTabs [data-tab=\"{k}\"]')?.click()"); pg.wait_for_timeout(500)
            return pg.evaluate("() => { const s = document.querySelector('#bdgTabBody .bdg-d-scroll'); return s ? Math.round(s.getBoundingClientRect().height) : -1; }")
        hs = [tabH(k) for k in ("dly", "chg", "prd", "dly")]
        pg.evaluate("() => { const L = JSON.parse(localStorage.getItem('svi_layout_v1') || '{}'); L.h = Object.assign(L.h || {}, { detail: 333 }); localStorage.setItem('svi_layout_v1', JSON.stringify(L)); }")
        pg.evaluate("() => document.querySelector('#bdgTabs [data-tab=\"chg\"]')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate("() => { const r = document.getElementById('bdgDetailRsz'); const b = r.getBoundingClientRect(); const o = { bubbles: true, clientX: b.x + 20, clientY: b.y + 5, pointerId: 9 };"
                    " r.dispatchEvent(new PointerEvent('pointerdown', o)); document.dispatchEvent(new PointerEvent('pointermove', { ...o, clientY: o.clientY + 1 })); document.dispatchEvent(new PointerEvent('pointerup', o)); }")
        pg.wait_for_timeout(300)
        h2 = [tabH(k) for k in ("chg", "dly")]
        pg.evaluate("() => { const L = JSON.parse(localStorage.getItem('svi_layout_v1') || '{}'); if (L.h) delete L.h.detail; localStorage.setItem('svi_layout_v1', JSON.stringify(L)); }")
        check("v557 FORMAT 202 : bloc détail à la même hauteur pour DÉTAIL DÉLAIS, CHARGES et PRODUITS ; hauteur réglée à la poignée gardée pour tous les onglets",
              min(hs) > 150 and max(hs) - min(hs) <= 2 and abs(h2[0] - h2[1]) <= 2 and h2[0] != hs[0], [hs, h2])
        # v560 : plage DÉBUT – FIN = charges / produits filtrés, quantités au prorata des jours de la tâche dans la plage
        rg = pg.evaluate(f"""() => {{ const X = {ins}, I = X.INS;
            const keysOf = id => [...new Set((I.links || []).filter(l => (l.chg || []).some(x => x.id === id)).map(l => l.lot + '|' + l.sec))];
            const c = I.chg.find(r => !r.t && keysOf(r.id).length === 1 && Number(r.q) > 0), o = c && I.chg.find(r => !r.t && r !== c && !keysOf(r.id).includes(keysOf(c.id)[0]));
            if (!c) return null; const K = keysOf(c.id)[0];
            window.__rg0 = [K, JSON.stringify(I.dlp[K] || null), JSON.stringify(I.hrange || null), JSON.stringify(I.cal || null)];
            I.cal = {{ we: [0], off: [], on: [] }};
            I.dlp[K] = [{{ deb: '2030-11-04', fin: '2030-11-07' }}]; I.hrange = {{ ...(I.hrange || {{}}), a: '2030-11-04', b: '2030-11-05' }}; X.insSave(); X.refreshAll();
            document.querySelector('.bdg-d-tab[data-tab="chg"]')?.click();
            return [c.id, Number(c.q), o ? o.id : '']; }}""")
        pg.wait_for_timeout(500)
        rgD = pg.evaluate("""a => { const t = document.querySelector('table.ins-table[data-ik="chg"]'); const tr = t && t.querySelector('tr[data-iid="' + a[0] + '"]');
            const qi = [...t.querySelectorAll('thead th')].findIndex(th => /^Q/.test(th.textContent.trim()));
            const cq = tr && tr.cells[qi]; return [cq ? ((cq.querySelector('input') || {}).value || cq.textContent).trim() : null, a[2] ? !!t.querySelector('tr[data-iid="' + a[2] + '"]') : false, document.querySelector('.bdg-d-tab[data-tab="chg"]').classList.contains('tab-filt'), (t.tFoot.textContent || '').includes('PARTIEL')]; }""", rg)
        pg.evaluate("() => document.querySelector('#bdgDetailHead .blk-more')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('#blkMenu [data-fclr]')?.click()"); pg.wait_for_timeout(400)
        rgC = pg.evaluate(f"() => {{ const I = {ins}.INS; return [I.hrange && I.hrange.a, I.hrange && I.hrange.b]; }}")
        pg.evaluate(f"""() => {{ const X = {ins}, I = X.INS, R = window.__rg0; const d = JSON.parse(R[1]); if (d) I.dlp[R[0]] = d; else delete I.dlp[R[0]];
            I.hrange = JSON.parse(R[2]); I.cal = JSON.parse(R[3]); X.insSave(); X.refreshAll(); }}""")
        got = float(rgD[0].replace("\u202f", "").replace("\xa0", "").replace(" ", "").replace(",", ".")) if rgD[0] else None
        check("v560 : plage DÉBUT – FIN — charge au prorata (2 jours sur 4 = moitié), charge hors plage cachée, onglet filtré ; EFFACER TOUS LES FILTRES remet les traits aux bords",
              rg and got is not None and abs(got - rg[1] / 2) < 0.01 and not rgD[1] and rgD[2] and rgD[3] and rgC == ["", ""], [rg, rgD, rgC])
        # v563 (remarques 3 et 4) : courbes CHARGES + PRODUITS sans charge cochée ; total de la plage pour chaque courbe
        pg.evaluate(f"""() => {{ const X = {ins}, I = X.INS; window.__r34 = [JSON.stringify(I.hset || null), JSON.stringify(I.hrange || null), I.chg.filter(r => r.on === true).map(r => r.id)];
            I.chg.forEach(r => {{ if (r.on === true) r.on = false; }}); I.hset = {{ ...(I.hset || {{}}), crb: ['c', 'p'], aff: 'c' }}; I.hrange = {{ a: '2026-10-01', b: '2027-12-31' }}; X.insSave(); X.refreshAll(); }}""")
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"dly\"]')?.click()"); pg.wait_for_timeout(700)
        r34 = pg.evaluate("() => [(document.querySelector('.dlyg-foot .ghist-leg') || {}).textContent || '', (document.querySelector('.dlyg-foot .grng-tot') || {}).textContent || '']")
        pg.evaluate(f"""() => {{ const X = {ins}, I = X.INS, R = window.__r34; I.hset = JSON.parse(R[0]); I.hrange = JSON.parse(R[1]); I.chg.forEach(r => {{ if (R[2].includes(r.id)) r.on = true; }}); X.insSave(); X.refreshAll(); }}""")
        check("v563 R3 / R4 : sans charge cochée, courbe CHARGES affichée avec PRODUITS ; total de la plage pour chaque courbe (plus de « 0 DH »)",
              "CHARGES" in r34[0] and "PRODUITS" in r34[0] and "CHARGES" in r34[1] and "PRODUITS" in r34[1], r34)
        # v600 : MARGE seule en % = (produits − charges) ÷ produits × 100, jour par jour ; jour sans produit = pas de valeur
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; window.__mg6 = JSON.stringify([I.links, I.prd, I.sec, I.prim]);
            const l = I.links[0], x = I.prd.find(r => r.id === 'x1'); x.n = 10; l.prd = [{{ id: 'x1' }}];
            const pr = I.prim.find(r => r.id === l.prim), sc = I.sec.find(r => r.id === l.sec); if (pr && sc) sc.v = pr.v;
            I.hset = {{ u: 'm', aff: 'j', cum: 'r', forme: 'h', crb: ['g'], mg: 'p' }}; I.appro = null; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(600)
        mp = pg.evaluate("""() => { const h = document.querySelector('#dlyGantt'); const V = h && h.__HV, D = h && h.__HD; if (!V || !D) return null;
            const ds = Object.keys(D.prd || {}).filter(d => Math.abs(D.prd[d]) > 1e-9); if (!ds.length) return ['noprd'];
            const d = ds[0], P = D.prd[d], C = D.tot[d] || 0; return [V.mgP, V.unit, Math.abs(V.vG[d] - (P - C) / P * 100) < 1e-6, Object.keys(V.vG).every(k => Math.abs((D.prd || {})[k] || 0) > 1e-9)]; }""")
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; const B = JSON.parse(window.__mg6); I.links = B[0]; I.prd = B[1]; I.sec = B[2]; I.prim = B[3]; I.hset = null; X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        check("v600 : MARGE seule en % = (produits − charges) ÷ produits × 100 par jour ; jour sans produit sans valeur", mp == [True, "%", True, True], mp)
        # v605 (remarque longue 5) : COMMANDES avec PRODUITS et MARGE de la période couverte (marge = produits − charges consommées)
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; window.__mg7 = JSON.stringify([I.links, I.prd, I.sec, I.prim]);
            const l = I.links[0], x = I.prd.find(r => r.id === 'x1'); x.n = 10; l.prd = [{{ id: 'x1' }}];
            const pr = I.prim.find(r => r.id === l.prim), sc = I.sec.find(r => r.id === l.sec); if (pr && sc) sc.v = pr.v;
            I.hset = {{ u: 'm', aff: 'j', cum: 'r', forme: 'h', crb: ['c', 'p', 'g'] }}; I.appro = {{ dl: 0, cov: 'n', nj: 60, dep: '', seuil: {{}}, on: true }}; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(600)
        cg = pg.evaluate("""() => { const h = document.querySelector('#dlyGantt'), D = h && h.__HD, C = D && D.cmd; if (!C || !C.P) return null;
            const S = M => Object.values(M || {}).reduce((t, v) => t + (v || 0), 0), P = S(D.prd);
            return [P > 0, Math.abs(S(C.P) - P) < 1e-6, Math.abs(S(C.G) - (P - S(D.tot))) < 1e-6, Object.keys(C.P).filter(d => C.P[d]).length >= 1, !!document.querySelector('.dlyg-foot .ghist-cmd .ghb-m'), !!(C.per[Object.keys(C.P)[0]] || {}).b]; }""")
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; const B = JSON.parse(window.__mg7); I.links = B[0]; I.prd = B[1]; I.sec = B[2]; I.prim = B[3]; I.hset = null; I.appro = null; X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        check("v605 : COMMANDES + PRODUITS + MARGE — une période couverte : produits de la période au jour d'envoi, marge = produits − charges consommées, barres à côté de la commande",
              cg == [True] * 6, cg)
        # v567 (remarque 10) : RENDEMENT = quantité produite ÷ charge du jour (en QUANTITÉ, une seule activité)
        pg.evaluate(f"""() => {{ const X = {ins}, I = X.INS; window.__r10 = [JSON.stringify(I.hset || null), JSON.stringify(I.hrange || null), I.chg.filter(r => r.on === true).map(r => r.id), JSON.stringify(I.dlp['l1|s1'] || null)];
            I.chg.push({{ id: 'rz1', des: 'MACON RZ', u: 'J', q: 8, p: 100 }}); I.prd.push({{ id: 'rp1', des: 'DALLE RZ', u: 'M3', nbr: 1, d1: 4, d2: 2, d3: 1 }});
            const lo = I.lot.find(x => !x.t).id, se = I.sec[0].id, pr = I.prim[0].id, de = I.des.find(x => !x.t).id;
            I.links.push({{ id: 'Lrz', des: de, lot: lo, prim: pr, sec: se, prd: [{{ id: 'rp1' }}], chg: [{{ id: 'rz1' }}] }});
            const K = lo + '|' + se, cid = 'rz1'; window.__r10.push(K, JSON.stringify(I.dlp[K] || null));
            I.chg.forEach(r => {{ r.on = r.id === cid; }}); I.hrange = null; I.hset = {{ u: 'q', aff: 'j', crb: ['c', 'r'] }}; I.dlp[K] = [{{ deb: '2026-11-02', fin: '2026-11-05' }}]; X.insSave(); X.refreshAll(); }}""")
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"dly\"]')?.click()"); pg.wait_for_timeout(700)
        pg.evaluate("() => document.querySelector('.dlyg-foot .ghb[data-d]')?.click()"); pg.wait_for_timeout(300)
        r10 = pg.evaluate("""() => { const m = document.getElementById('dlyHb'); if (!m) return null; const g = s => { const r = [...m.querySelectorAll('div')].find(d => d.firstElementChild && d.firstElementChild.textContent.startsWith(s)); return r ? parseFloat(r.querySelector('b').textContent.replace(/\u202f|\s/g, '').replace(',', '.')) : null; };
            const tot = parseFloat((m.querySelector('.hb-tot b') || {}).textContent.replace(/\u202f|\s/g, '').replace(',', '.')); return [tot, g('PRODUIT'), g('RENDEMENT'), m.querySelectorAll('.hb-gob').length]; }""")
        pg.evaluate("() => document.getElementById('dlyHb')?.remove()")
        pg.evaluate(f"""() => {{ const X = {ins}, I = X.INS, R = window.__r10; I.hset = JSON.parse(R[0]); I.hrange = JSON.parse(R[1]); I.chg.forEach(r => {{ r.on = R[2].includes(r.id); }}); const d = JSON.parse(R[3]); if (d) I.dlp['l1|s1'] = d; else delete I.dlp['l1|s1']; if (R[4]) {{ const d2 = JSON.parse(R[5]); if (d2) I.dlp[R[4]] = d2; else delete I.dlp[R[4]]; }}
            I.links = I.links.filter(l => l.id !== 'Lrz'); I.chg = I.chg.filter(r => r.id !== 'rz1'); I.prd = I.prd.filter(r => r.id !== 'rp1'); X.insSave(); X.refreshAll(); }}""")
        check("v567 R10 / v569 R13 : RENDEMENT de la charge du jour = produit ÷ charge, bulle avec CHARGES / PRODUITS / DÉLAIS",
              r10 and r10[0] and r10[1] is not None and r10[2] is not None and abs(r10[2] - r10[1] / r10[0]) < 0.02 and r10[3] >= 3, r10)
        # v570 (remarque longue 1) : GÉNÉRER seul — tâche datée inchangée, tâche sans dates placée, DÉBUT seul gardé
        gl = pg.evaluate(f"""() => {{ const X = {ins}, I = X.INS, D = {DXJ}; const K = D.keys(); if (K.length < 2) return 'pas assez de tâches';
            window.__gl = [JSON.stringify(I.dlp), JSON.stringify(I.dpred || {{}})];
            const a = K[0], b = K[1]; I.dlp[a] = [{{ id: 'g1', deb: '2026-11-02', fin: '2026-11-03' }}]; I.dlp[b] = [{{ id: 'g2', deb: '2026-11-10', fin: '' }}];
            K.slice(2).forEach(k => {{ I.dlp[k] = []; }}); X.insSave();
            D.genOnly();
            const r = [I.dlp[a].map(p => p.deb + '>' + p.fin).join(), (I.dlp[b][0] || {{}}).deb, !!(I.dlp[b][0] || {{}}).fin];
            const d0 = JSON.parse(window.__gl[0]), p0 = JSON.parse(window.__gl[1]); I.dlp = d0; I.dpred = p0; X.insSave(); X.refreshAll(); return r; }}""")
        check("v570 (remarque longue 1) : GÉNÉRER seul garde la tâche datée, garde le DÉBUT saisi et calcule la FIN",
              isinstance(gl, list) and gl[0] == "2026-11-02>2026-11-03" and gl[1] == "2026-11-10" and gl[2], gl)
        # R30 : INF — DATE DE FIN DU PROJET = fin du planning (non saisissable)
        pg.evaluate("() => document.querySelector('[data-pill=\"inf\"]')?.click()"); pg.wait_for_timeout(400)
        inf = pg.evaluate("() => [!!document.querySelector('#docPop input[data-f=\"obj\"]'), (document.querySelector('#docPop [data-v=\"pfin0\"]') || {}).textContent || '']")
        pg.evaluate("() => document.querySelector('#docPop [data-cancel]')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.links = I.__lk6; I.dlp = I.__dlp6; I.dpred = I.__dp6; I.dord = I.__ord6;
            ['__lk6', '__dlp6', '__dp6', '__ord6'].forEach(k => delete I[k]); I.plafR = {{}}; I.hset = null; I.dinc = {{}}; I.chg = I.chg.filter(r => !/^w[123]$/.test(r.id)); X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        pg.set_viewport_size({"width": 1180, "height": 820}); pg.wait_for_timeout(300)
        check("v546 R14 / R27 / R30 / R26 / R35 / v620 : tâche sans charge cochée retirée du Gantt (0 jour vérifié en R15) ; colonne SUCCESSEURS ; plus de trait OBJECTIF ; plus de bandeau ni de liseré",
              not q["z0"] and q["succ"] != "" and q["succH"] and not q["obj"] and not q["vd"] and not q["dz"], q)
        check("v546 R20 / R21 / R24 / R33 : CAPACITÉ en MONTANT avec valeur du morceau ; unité seule sur l'axe ; tableau jusqu'en bas ; bouton ↻ sur DÉTAIL DÉLAIS ; nombres abrégés",
              q["cap"].startswith("CAPACITÉ") and "DH" in q["segv"] and q["unit"] == "DH / JOUR" and abs(q["leftBottom"] - q["histBottom"]) <= 3 and q["adj"][0] and q["cfg"] and " K" in kfmt, [q, kfmt])
        check("v546 R19 : coupe — trait vertical en pointillés entre deux morceaux différents ; « / » déplacé quand les morceaux sont égaux",
              cv[0] and cv[1] == "0" and '"2026-11-05"' in mc, [cv, mc])
        check("v546 R28 / R29 : CUMULÉ = une seule courbe ; ⚙ ouvre RÉGLAGES DE L'HISTOGRAMME ; PRODUITS et MARGE dans la légende",
              nl == 1 and hw == "RÉGLAGES DU GRAPHIQUE" and pm[0] == '["c","p","g"]' and "PRODUITS" in pm[1] and "MARGE" in pm[1], [nl, hw, pm])
        check("v546 R25 / R17 / R23 / R30 : histogramme caché à 0 ; JOUR / SEMAINE / MOIS dans CALENDRIER DU BUDGET ; SEMAINE remplit la largeur ; DATE DE FIN DU PROJET calculée",
              h0 == [True, 0] and sc0 == "JOUR*,SEMAINE,MOIS" and sw[0] == "s" and sw[1] > 9 and inf[0] and inf[1] != "", [h0, sc0, sw, inf])

        # v545 : remarques 1 à 5 (bouton agrandir visible, planning à la hauteur de l'écran, poignées, capacité visible, échelle)
        DXJ = "[...document.querySelectorAll('*')].find(e => e.__insDly).__insDly"
        r1 = pg.evaluate("""() => { const b = document.querySelector('.blk-max-btn[data-blk="client"]'), m = b && b.closest('.blk-tools').querySelector('.blk-more');
            if (!b || !m) return null; const rb = b.getBoundingClientRect(), rm = m.getBoundingClientRect(); return [rb.width > 0, rb.right <= rm.left + 1, Math.abs(rb.top - rm.top) < 12]; }""")
        pg.evaluate("() => document.querySelector('.blk-max-btn[data-blk=\"client\"]').closest('.blk-tools').querySelector('.blk-more').click()"); pg.wait_for_timeout(300)
        r1m = pg.evaluate("() => [...document.querySelectorAll('#blkMenu *')].some(e => /^(AGRANDIR|RÉDUIRE)$/i.test((e.textContent || '').trim()))")
        pg.evaluate("() => document.getElementById('blkMenu')?.remove()")
        hd = pg.evaluate("() => { const h = document.querySelector('.ins-hcol .blk-head, .blk-head'); if (!h) return null; h.scrollIntoView({ block: 'center' }); const r = h.getBoundingClientRect(); return [r.left + 60, r.top + r.height / 2]; }")
        if hd:
            pg.mouse.click(hd[0], hd[1]); pg.wait_for_timeout(60); pg.mouse.click(hd[0], hd[1]); pg.wait_for_timeout(400)
        r1d = pg.evaluate("() => document.querySelectorAll('.blk-max-btn.on').length")
        if hd and r1d:   # v786 : double toucher du titre = agrandir ; on le refait pour réduire
            hd2 = pg.evaluate("() => { const h = document.querySelector('.ins-hcol .blk-head, .blk-head'); const r = h.getBoundingClientRect(); return [r.left + 60, r.top + r.height / 2]; }")
            pg.wait_for_timeout(500); pg.mouse.click(hd2[0], hd2[1]); pg.wait_for_timeout(60); pg.mouse.click(hd2[0], hd2[1]); pg.wait_for_timeout(400)
        r1e = pg.evaluate("() => document.querySelectorAll('.blk-max-btn.on').length")
        pg.set_viewport_size({"width": 1180, "height": 820}); pg.wait_for_timeout(300)
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS;
            I.chg.forEach(r => {{ r.on = false; }});
            I.chg.push({{ id: 'n1', des: 'MACON', u: 'JH', q: 4, p: 100, on: true }}, {{ id: 'n3', des: 'MACON', u: 'JH', q: 2, p: 100, on: true }});
            I.__lk5 = I.links; I.__dlp5 = I.dlp; I.__dp5 = I.dpred; I.__ord5 = I.dord;
            I.links = [{{ id: 'Q1', des: 'd1', lot: 'l1', prim: 'p1', sec: 's1', prd: [], chg: [{{ id: 'n1' }}] }}, {{ id: 'Q2', des: 'd1', lot: 'l2', prim: 'p1', sec: 's1', prd: [], chg: [{{ id: 'n3' }}] }}];
            I.dlp = {{ 'l1|s1': [{{ id: 'a', deb: '2026-11-02', fin: '2026-11-02' }}], 'l2|s1': [{{ id: 'b', deb: '2026-11-03', fin: '2026-11-03' }}] }};
            I.dpred = {{}}; I.plafR = {{}}; I.dord = ['l1|s1', 'l2|s1']; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        pg.evaluate("() => localStorage.setItem('svi_dlyhh_v1', '120')")
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"dly\"]')?.click()"); pg.wait_for_timeout(800)
        pg.evaluate("() => document.querySelector('#bdgTabs').scrollIntoView({ block: 'start' })"); pg.wait_for_timeout(700)
        r5 = pg.evaluate("""() => { const p = document.querySelector('.dlyg-foot .gplaf.gcap-def'); return [!!p, p ? p.querySelector('.gplaf-v').textContent : '', document.querySelectorAll('.dlyg-foot .ghist-ax .gax-t').length,
            p ? getComputedStyle(p).borderTopColor : '']; }""")
        r2 = pg.evaluate("() => { const h = document.querySelector('.dlyg-foot .ghist'), vv = window.visualViewport; const b = vv ? vv.offsetTop + vv.height : innerHeight; return h ? [Math.round(h.getBoundingClientRect().bottom), Math.round(b)] : null; }")
        r3 = pg.evaluate("() => { const i = document.querySelector('.dlyg-hd i'), p = document.querySelector('.dlyhh-pill'), h = document.querySelector('.dlyg-hd'); return [!!i && getComputedStyle(i).transform !== 'none', Math.round(h.getBoundingClientRect().width) === Math.round(p.getBoundingClientRect().width)]; }")
        # remarque 4 : petit glissement (4 px vers le haut) = hauteur gardée là où on lâche
        pq = pg.evaluate("() => { const p = document.querySelector('.dlyhh-pill'), r = p.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, document.querySelector('.dlyg-foot .ghist').offsetHeight]; }")
        pg.mouse.move(pq[0], pq[1]); pg.mouse.down(); pg.mouse.move(pq[0], pq[1] - 4, steps=2); pg.mouse.up(); pg.wait_for_timeout(500)
        r4 = pg.evaluate("() => [localStorage.getItem('svi_dlyhh_v1'), document.querySelector('.dlyg-foot .ghist').offsetHeight, !!document.querySelector('.dlyg.dly-hfull')]")
        pg.evaluate("() => localStorage.removeItem('svi_dlyhh_v1')")
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.links = I.__lk5; I.dlp = I.__dlp5; I.dpred = I.__dp5; I.dord = I.__ord5;
            ['__lk5', '__dlp5', '__dp5', '__ord5'].forEach(k => delete I[k]); I.plafR = {{}}; I.chg = I.chg.filter(r => !/^n[13]$/.test(r.id)); X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        check("v545 remarque 1 / v786 : AGRANDIR / RÉDUIRE dans le ⋯ (icône retirée) ; double toucher sur le titre = agrandir / réduire",
              r1 is not None and r1[0] is False and r1m is True and r1d == 1 and r1e == 0, [r1, r1m, r1d, r1e])   # v786 : AGRANDIR dans le ⋯, double toucher du titre
        check("v545 remarques 2 et 3 : histogramme dans la hauteur visible de l'écran ; poignée verticale « ‖ » = la poignée « = » tournée, même taille",
              r2 and r2[0] <= r2[1] + 1 and r3 == [True, True], [r2, r3])
        check("v545 remarque 4 : poignée « = » glissée de 4 px = hauteur gardée là où on la lâche (ni plein écran, ni miniaturisé)",
              r4[0] not in ("full", "28") and abs(int(r4[0]) - (pq[2] + 4)) <= 2 and abs(r4[1] - int(r4[0])) <= 2 and r4[2] is False, [pq, r4])
        check("v545 remarque 5 : capacité jamais réglée = barre rouge au-dessus du jour le plus chargé (CAPACITÉ 4), avec l'échelle des valeurs à gauche",
              r5[0] and "CAPACITÉ 4" in r5[1] and r5[2] >= 2 and "180, 35, 24" in r5[3], r5)

        # v544 : décalage FIN → DÉBUT — 0 = le jour même, 1 = le lendemain ; anciennes liaisons converties (dates inchangées)
        mg = pg.evaluate("() => { const d = { dpred: { a: [{ k: 'x', t: 'FD', o: -1 }, { k: 'y', t: 'FD', o: 0 }, { k: 'z', t: 'DD', o: 2 }] } }; sviDpredV2(d); const again = sviDpredV2(d); return [d.dpred.a.map(x => x.o), d.fdV2, again]; }")
        check("v544 : liaisons FIN → DÉBUT converties une fois (−1 → 0 = même jour, 0 → 1 = lendemain ; DÉBUT → DÉBUT inchangé)", mg == [[0, 1, 2], True, False], mg)
        # remarque 4 : conditionnement sur le titre des charges regroupées (pas sur leurs lignes), sur une charge seule ; réglage de l'article
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.chg.push({{ id: 'm1', des: 'BRIQUE 8T', u: 'U', q: 100, p: 2 }}, {{ id: 'm2', des: 'BRIQUE 8T', u: 'U', q: 50, p: 2 }}, {{ id: 'm3', des: 'SABLE FIN', u: 'M3', q: 4, p: 150 }}); X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"chg\"]')?.click()"); pg.wait_for_timeout(500)
        k4 = pg.evaluate("""() => [!!document.querySelector('table.ins-table[data-ik="chg"] tr.ins-grp .chg-pk'), !!document.querySelector('table.ins-table[data-ik="chg"] tr[data-iid="m1"] .chg-pk'),
            !!document.querySelector('table.ins-table[data-ik="chg"] tr[data-iid="m3"] .chg-pk')]""")
        pg.evaluate("() => document.querySelector('table.ins-table[data-ik=\"chg\"] tr[data-iid=\"m3\"] .chg-pk')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))"); pg.wait_for_timeout(300)
        k4b = pg.evaluate("() => (document.querySelector('#svConf') || {}).innerText || ''")
        if pg.evaluate("() => !!document.querySelector('#svConf input[data-k=\"per\"]')"):
            pg.fill('#svConf input[data-k="per"]', '2'); pg.wait_for_timeout(200)
        pg.evaluate("() => document.querySelector('#svConf [data-x]')?.click()"); pg.wait_for_timeout(300)
        k4c = pg.evaluate(f"() => !!(({ins}).INS.cond || {{}})['SABLE FIN|M3']")   # v728 : réglage du titre gardé dans le budget (CHS n'existe plus)
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; I.chg = I.chg.filter(r => !/^m[123]$/.test(r.id)); delete I.cond; X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        pg.set_viewport_size({"width": 1180, "height": 820}); pg.wait_for_timeout(300)
        check("v542 remarque 4 : conditionnement sur le titre des charges regroupées et sur une charge seule (pas sur les lignes du titre), réglé pour l'article (tous les budgets)",
              k4 == [True, False, True] and "CE BUDGET" in k4b and k4c, [k4, k4b[:160], k4c])

        # v663 (axe 2) : PRIX DE VENTE PAR LA MARGE — K = 1 ÷ (1 − marge) ; TÂCHE > LOT > GLOBALE ; PPB = charges × K ÷ QPB
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.__p2 = JSON.stringify({{ des: I.des, links: I.links, chg: I.chg }});
            I.chg.push({{ id: 'pv1', des: 'CIMENT PV', u: 'T', q: 2, p: 1000 }}); I.links.find(l => l.id === 'L1').chg = [{{ id: 'pv1' }}];
            I.pv = {{ fg: 10, al: 5, bn: 5, lot: {{}}, task: {{}} }}; X.insSave(); X.refreshAll(); document.querySelector('.bdg-d-tab[data-tab="lnk"]')?.click(); }}"""); pg.wait_for_timeout(400)
        q2 = pg.evaluate(f"() => {{ const X = {ins}; return insLinkedQ(X.INS, 'd1'); }}")
        def pv_txt():
            pg.evaluate("() => { const X = [...document.querySelectorAll('*')].find(e => e.__mg).__mg; X.pv(); }"); pg.wait_for_timeout(300)
            t = pg.evaluate("() => (document.querySelector('#svConf .pv-res') || {}).innerText || ''")
            g = pg.evaluate("() => (document.querySelector('#svConf .pv-tot') || {}).innerText || ''")
            return t, g
        fm = lambda v: f"{v:,.2f}".replace(",", " ").replace(".", ",")
        a2, g2 = pv_txt()
        pg.evaluate("() => document.querySelector('#svConf [data-x]')?.click()")
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.pv.lot = {{ l1: 50 }}; X.insSave(); }}")
        b2, _ = pv_txt()
        pg.evaluate("() => document.querySelector('#svConf [data-x]')?.click()")
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.pv.task = {{ 'l1|s1': 0 }}; X.insSave(); }}")
        c2, _ = pv_txt()
        pg.evaluate("() => document.querySelector('#svConf [data-apply]')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('#svConf .svc-ok')?.click()"); pg.wait_for_timeout(400)
        d2 = pg.evaluate(f"() => {{ const X = {ins}; return Number(X.INS.des.find(d => d.id === 'd1').p); }}")
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; const o = JSON.parse(I.__p2); I.des = o.des; I.links = o.links; I.chg = o.chg; delete I.__p2; delete I.pv; X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        e = [round(2000 * k / q2, 2) for k in (1.25, 2, 1)] if q2 else [0, 0, 0]
        check("v663 axe 2 : prix de vente par la marge — globale 20 % (K 1,25), lot 50 % (K 2), tâche 0 % l'emporte ; PPB = charges × K ÷ QPB, appliqué",
              q2 and "1,25" in g2 and fm(e[0]) in a2 and fm(e[1]) in b2 and fm(e[2]) in c2 and abs(d2 - e[2]) < 0.01, [q2, e, a2[:200], g2, b2[:160], c2[:160], d2])

        # v663 (axe 12) : INF — client PUBLIC = SUR CONSULTATION d'office ; bordereau : RÉFÉRENCE, OBJET, phrase ARRÊTÉ ; numéro manquant → fenêtre
        pg.evaluate("() => document.querySelector('[data-pill=\"inf\"]')?.click()"); pg.wait_for_timeout(400)
        pg.evaluate("() => { const r = document.querySelector('#docPop input[name=\"infAoT\"][value=\"pub\"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }")
        pg.fill("#infAoO", "construction d'une piscine"); pg.wait_for_timeout(100)
        pg.evaluate("() => document.querySelector('#docPop .inf-save')?.click()"); pg.wait_for_timeout(400)
        ao = pg.evaluate(f"() => JSON.stringify({ins}.INS.ao || null)")
        pg.evaluate("() => document.querySelector('[data-blk=\"client\"][data-act=\"pdf\"]')?.click()"); pg.wait_for_timeout(400)
        aw = pg.evaluate("() => (document.querySelector('#svConf .svc-t') || {}).textContent || ''")
        pg.evaluate("() => document.querySelector('#svConf [data-v=\"inf\"]')?.click()"); pg.wait_for_timeout(400)
        fo = pg.evaluate("() => document.activeElement && document.activeElement.id")
        pg.fill("#infAoN", "AO 12/2026"); pg.evaluate("() => document.querySelector('#docPop .inf-save')?.click()"); pg.wait_for_timeout(400)
        pg.evaluate("() => document.querySelector('[data-blk=\"client\"][data-act=\"pdf\"]')?.click()")
        pv = MepView(pg); pv.wait_for_timeout(1200)
        bt = pv.evaluate("() => document.body.innerText"); pv.close()
        pg.evaluate(f"() => {{ const X = {ins}; delete X.INS.ao; X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        check("v663 axe 12 : INF client PUBLIC → SUR CONSULTATION ; numéro vide → NUMÉRO D'APPEL D'OFFRES MANQUANT, RENSEIGNER = curseur dans la case ; bordereau avec RÉFÉRENCE, OBJET et ARRÊTÉ",
              '"pub":true' in ao and '"cons":true' in ao and "MANQUANT" in aw and fo == "infAoN"
              and "BORDEREAU DES PRIX – DÉTAIL ESTIMATIF" in bt and "RÉFÉRENCE : AO 12/2026" in bt and "OBJET : CONSTRUCTION D'UNE PISCINE" in bt and "ARRÊTÉ LE PRÉSENT BORDEREAU" in bt,
              [ao, aw, fo, bt[:400]])

        # v664 (axe 9) : titres des activités — superposer deux activités secondaires = « TITRE n » ; la primaire suit sa jumelle ; renommer
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.__s9 = JSON.stringify({{ sec: I.sec, prim: I.prim }});
            I.sec.push({{ id: 'a9', v: 'ETANCHEITE A', u: 'M2' }}, {{ id: 'b9', v: 'ETANCHEITE B', u: 'M2' }}); I.prim.push({{ id: 'p9', v: 'ETANCHEITE A' }});
            X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(400)
        def drag9(src, dst, frac):
            a = pg.evaluate("s => { const e = document.querySelector('.ins-hcol[data-ik=\"sec\"] .ins-li[data-iid=\"' + s + '\"] input.ins-in'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.left + 20, r.top + r.height / 2]; }", src)
            t = pg.evaluate("([s, f]) => { const e = document.querySelector('.ins-hcol[data-ik=\"sec\"] .ins-li[data-iid=\"' + s + '\"]'); const r = e.getBoundingClientRect(); return r.top + r.height * f; }", [dst, frac])
            pg.mouse.move(a[0], a[1]); pg.mouse.down(); pg.wait_for_timeout(700)
            pg.mouse.move(a[0], t, steps=6); pg.wait_for_timeout(150); pg.mouse.up(); pg.wait_for_timeout(500)
        drag9("a9", "b9", .5)
        r9 = pg.evaluate(f"""() => {{ const I = {ins}.INS; return [I.sec.find(r => r.id === 'a9').g, I.sec.find(r => r.id === 'b9').g,
            [...document.querySelectorAll('.ins-hcol[data-ik="sec"] .act-grp')].map(x => x.dataset.g).join(), [...document.querySelectorAll('.ins-hcol[data-ik="prim"] .act-grp')].map(x => x.dataset.g).join()]; }}""")
        pg.evaluate("() => { const i = document.querySelector('.ins-hcol[data-ik=\"sec\"] input.act-gname'); i.value = 'etancheite'; i.dispatchEvent(new Event('change', { bubbles: true })); }"); pg.wait_for_timeout(400)
        r9b = pg.evaluate(f"() => {ins}.INS.sec.filter(r => r.g).map(r => r.id + ':' + r.g).sort().join()")
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; const o = JSON.parse(I.__s9); I.sec = o.sec; I.prim = o.prim; delete I.__s9; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(300)
        check("v664 axe 9 : activité secondaire posée sur une autre = TITRE commun (primaire jumelle sous le même titre) ; titre renommé pour toutes",
              r9[0] and r9[0] == r9[1] and r9[0].startswith("TITRE") and r9[2] == r9[0] and r9[3] == r9[0] and r9b == "a9:ETANCHEITE,b9:ETANCHEITE", [r9, r9b])

        # v664 (axe 13) : COÛT D'UNE JOURNÉE — 200 × 1,20 × 1,10 + 16 = 280 DH ; charge en H : 280 ÷ 8 = 35
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.__c13 = JSON.stringify(I.chg); I.chg.forEach(r => {{ r.on = false; }});
            I.chg.push({{ id: 'mo1', des: 'MACON', u: 'JH', q: 10, p: 0 }}, {{ id: 'mo2', des: 'MANOEUVRE', u: 'H', q: 40, p: 0 }}); X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(300)
        pg.evaluate("() => { const s = [...document.querySelectorAll('*')].find(e => e.__moWin); s.__moWin(); }"); pg.wait_for_timeout(300)
        for k, v in (("sal", "200"), ("cot", "20"), ("cng", "10"), ("pri", "16"), ("hj", "8")):
            pg.fill(f'#svConf .pv-in[data-k="{k}"]', v)
        tot13 = pg.evaluate("() => (document.querySelector('#svConf .pv-tot') || {}).innerText || ''")
        pg.evaluate("() => document.querySelector('#svConf [data-apply]')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('#svConf .svc-ok')?.click()"); pg.wait_for_timeout(400)
        p13 = pg.evaluate(f"() => {{ const I = {ins}.INS; return [I.chg.find(r => r.id === 'mo1').p, I.chg.find(r => r.id === 'mo2').p]; }}")
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; I.chg = JSON.parse(I.__c13); delete I.__c13; delete I.mo; X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        check("v664 axe 13 : coût d'une journée de main d'œuvre = 280 DH (JH) et 35 DH (H, 8 h par jour), appliqué aux PCB",
              "280" in tot13 and p13 == [280, 35], [tot13, p13])

        # v665 (axes 5 et 11) : COMPARATIF DES PRIX (écart, couleurs, moyenne, résultat) et APERÇU SOUS-DÉTAIL DES PRIX
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.__c5 = JSON.stringify({{ des: I.des, links: I.links, chg: I.chg }});
            const d1 = I.des.find(d => d.id === 'd1'); d1.p = 1000; I.chg.push({{ id: 'sd1', des: 'CIMENT SD', u: 'T', q: 2, p: 1500 }}); I.links.find(l => l.id === 'L1').chg = [{{ id: 'sd1' }}];
            delete I.cmp; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(300)
        pg.evaluate("() => { const s = [...document.querySelectorAll('*')].find(e => e.__cmpWin); s.__cmpWin(); }"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('#svConf [data-add]')?.click()"); pg.wait_for_timeout(200)
        pg.evaluate("() => document.querySelector('#svConf [data-add]')?.click()"); pg.wait_for_timeout(200)
        ins5 = pg.evaluate("() => [...document.querySelectorAll('#svConf input.cmp-in[data-d=\"d1\"]')].length")
        pg.fill('#svConf input.cmp-in[data-d="d1"] >> nth=0', "1200"); pg.fill('#svConf input.cmp-in[data-d="d1"] >> nth=1', "800")
        r5 = pg.evaluate("""() => { const tr = document.querySelector('#svConf tr[data-d="d1"]'); const e = [...tr.querySelectorAll('[data-c="e"]')], q = [...tr.querySelectorAll('[data-c="p"]')];
            return [e.map(x => x.textContent + ':' + x.className).join('|'), q.map(x => x.textContent).join('|'), tr.querySelector('[data-c="ap"]').textContent]; }""")
        pg.evaluate("() => { const r = document.querySelector('#svConf input[name=\"cmpRes\"][value=\"G\"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }")
        rt5 = pg.evaluate("() => document.querySelector('#svConf .cmp-rt').textContent")
        pg.evaluate("() => document.querySelector('#svConf [data-save]')?.click()"); pg.wait_for_timeout(300)
        sv5 = pg.evaluate(f"() => {{ const c = {ins}.INS.cmp; return c ? [c.of.length, c.res, c.of[0].p.d1] : null; }}")
        pg.evaluate("() => { const s = [...document.querySelectorAll('*')].find(e => e.__sdp); s.__sdp(); }")
        pv = MepView(pg); pv.wait_for_timeout(1500)
        t11 = pv.evaluate("() => document.body.innerText").replace("\u202f", " ").replace("\xa0", " "); pv.close()
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; const o = JSON.parse(I.__c5); I.des = o.des; I.links = o.links; I.chg = o.chg; delete I.__c5; delete I.cmp; X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        check("v665 axe 5 : comparatif — offre à 1 200 = −200 DH vert (−16,7 %), offre à 800 = +200 DH rouge (+25 %), moyenne 1 000 ; offre GAGNÉE enregistrée",
              ins5 == 2 and "-200,00:r cmp-ok" in r5[0].replace("−", "-") and "+200,00:r cmp-ko" in r5[0] and "-16,7 %" in r5[1] and "+25 %" in r5[1] and r5[2].replace("\u202f", " ") == "1 000,00" and "1 GAGNÉE(S)" in rt5 and sv5 == [2, "G", 1200], [ins5, r5, rt5, sv5])
        check("v665 axe 11 : aperçu SOUS-DÉTAIL DES PRIX — charges, déboursé sec total 3 000,00, coefficient, prix de vente unitaire",
              "SOUS-DÉTAIL DES PRIX" in t11 and "CIMENT SD" in t11 and "DÉBOURSÉ SEC TOTAL" in t11 and "3 000,00" in t11 and "COEFFICIENT DE VENTE" in t11 and "PRIX DE VENTE UNITAIRE HT" in t11, t11[:500])

        # v666 (axe 8) : BATTEMENT LIBRE, quasi-critiques, filtre CHEMIN CRITIQUE, PARAMÉTRAGE DU PLANNING
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.__p8 = JSON.stringify({{ dlp: I.dlp, dpred: I.dpred, pplan: I.pplan }});
            I.pplan = {{ qc: 30, bt: 'l' }}; X.insSave(); X.refreshAll(); document.querySelector('.bdg-d-tab[data-tab="dly"]')?.click(); }}"""); pg.wait_for_timeout(600)
        h8 = pg.evaluate("() => [...document.querySelectorAll('.dly-table th')].map(t => t.textContent.trim()).filter(t => /BATTEMENT/.test(t)).join()")
        r8 = pg.evaluate("() => { const s = [...document.querySelectorAll('*')].find(e => e.__dlyRows); return JSON.stringify((s.__dlyRows || []).filter(x => !x.grp && x.key).map(x => [x.marge, x.mlib, x.mshow, !!x.qc])); }")
        X8 = "(() => [...document.querySelectorAll('*')].find(e => e.__insDly).__insDly)()"
        pg.evaluate(f"() => {X8}.critSet(true)"); pg.wait_for_timeout(500)
        c8 = pg.evaluate("() => [!!document.querySelector('.dly-critb'), [...document.querySelectorAll('.dly-table tr.dly-task')].length, [...document.querySelectorAll('.dly-table tr.dly-task.dly-crit')].length]")
        pg.evaluate("() => document.querySelector('.dly-crit-x')?.click()"); pg.wait_for_timeout(400)
        pg.evaluate(f"() => {X8}.ppWin()"); pg.wait_for_timeout(300)
        w8 = pg.evaluate("() => (document.querySelector('#svConf .svc-t') || {}).textContent || ''")
        pg.fill("#ppQc", "0"); pg.evaluate("() => { const r = document.querySelector('#svConf input[name=\"ppBt\"][value=\"t\"]'); r.checked = true; document.querySelector('#svConf [data-save]').click(); }"); pg.wait_for_timeout(400)
        s8 = pg.evaluate(f"() => JSON.stringify({ins}.INS.pplan)")
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; const o = JSON.parse(I.__p8); I.dlp = o.dlp; I.dpred = o.dpred; if (o.pplan) I.pplan = o.pplan; else delete I.pplan; delete I.__p8; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(300)
        import json as _j
        R8 = _j.loads(r8)
        ok8 = all((m == "" or (ml != "" and ml <= m and sh == ml and q == (0 < m <= 30))) for m, ml, sh, q in R8) and len(R8) > 0
        check("v666 axe 8 : BATTEMENT LIBRE affiché (≤ total), quasi-critiques sous le seuil, filtre CHEMIN CRITIQUE (bandeau, seules les critiques), PARAMÉTRAGE DU PLANNING enregistré",
              h8 == "BATTEMENT LIBRE" and ok8 and c8[0] and c8[1] == c8[2] and w8 == "PARAMÉTRAGE DU PLANNING" and s8 == '{"qc":0,"bt":"t"}', [h8, R8, c8, w8, s8])

        # v666 (axe 10) : TAF créé avec une tâche choisie = rattaché à la tâche ; listes filtrées sur l'élément choisi
        pg.evaluate("() => document.querySelector('.ins-hcol[data-ik=\"lot\"] .ins-li[data-iid=\"l1\"] .lk-rd')?.click()"); pg.wait_for_timeout(250)
        pg.evaluate("() => document.querySelector('.ins-hcol[data-ik=\"sec\"] .ins-li[data-iid=\"s1\"] .lk-rd')?.click()"); pg.wait_for_timeout(250)
        pg.evaluate("() => document.querySelector('[data-recnew=\"obs\"]')?.click()"); pg.wait_for_timeout(400)
        o10 = pg.evaluate("() => (document.querySelector('#docPop #recAtt') || {}).value || ''")   # v719 : chemin des ronds en clair
        pg.fill("#recText", "OBS TACHE AXE 10"); pg.evaluate("() => document.querySelector('#recSave').click()"); pg.wait_for_timeout(400)
        a10 = pg.evaluate("() => [...document.querySelectorAll('#recTable-obs tbody tr')].map(t => t.innerText.replace(/\\s+/g, ' ')).find(t => t.includes('OBS TACHE AXE 10')) || 'none'")
        n10a = pg.evaluate("() => [...document.querySelectorAll('#recTable-obs tbody tr')].filter(t => !t.querySelector('.empty')).length")
        pg.evaluate("() => document.querySelector('.ins-hcol[data-ik=\"sec\"] .ins-li[data-iid=\"s1\"] .lk-rd')?.click()"); pg.wait_for_timeout(250)
        pg.evaluate("() => document.querySelector('.ins-hcol[data-ik=\"lot\"] .ins-li[data-iid=\"l1\"] .lk-rd')?.click()"); pg.wait_for_timeout(250)
        n10b = pg.evaluate("() => [...document.querySelectorAll('#recTable-obs tbody tr')].filter(t => !t.querySelector('.empty')).length")
        pg.evaluate("() => { Object.keys(localStorage).filter(k => k.startsWith('svi_obs_v1:')).forEach(k => { const L = JSON.parse(localStorage.getItem(k) || '[]').filter(x => x.text !== 'OBS TACHE AXE 10'); localStorage.setItem(k, JSON.stringify(L)); }); }")
        pg.evaluate(f"() => {ins}.refreshAll()"); pg.wait_for_timeout(300)
        check("v666 / v719 : OBS créée avec la tâche choisie = RATTACHÉ À RDC › BETONNAGE (chemin des ronds) ; les ronds ne filtrent plus la liste (v720 : cases carrées)",
              "RDC › BETONNAGE" in o10 and "RDC › BETONNAGE" in a10 and n10a >= 1 and n10b == n10a, [o10, a10, n10a, n10b])

        # v667 (axe 8) : verrou DÉBUT respecté par COMPRESSER, verrou FIN dépassé signalé ; export MS PROJECT (XML lisible)
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"dly\"]')?.click()"); pg.wait_for_timeout(500)
        X8 = "(() => [...document.querySelectorAll('*')].find(e => e.__insDly).__insDly)()"
        l7 = pg.evaluate(f"""() => {{ const X = {ins}, D = {X8}, I = X.INS; I.__l7 = JSON.stringify({{ dlp: I.dlp, dpred: I.dpred, dlock: I.dlock, dinc: I.dinc, links: I.links }});
            const K = D.keys(); if (!K.length) return null; const k = K[0];
            I.dlock = {{ [k]: {{ deb: '2027-03-01', fin: '2027-02-01' }} }}; const c0 = I.chg.find(r => !r.t); if (c0) (I.links.find(l => l.lot + '|' + l.sec === k) || {{}}).chg = [{{ id: c0.id }}]; X.insSave(); D.comp();
            const p = (I.dlp[k] || [])[0] || {{}};
            const late = D.lockLate();
            const xml = D.mspXml({{ lots: true, chg: true, prd: true }});
            const doc = new DOMParser().parseFromString(xml, 'application/xml');
            const ok = !doc.querySelector('parsererror');
            const nT = doc.getElementsByTagName('Task').length, nS = [...doc.getElementsByTagName('Summary')].filter(x => x.textContent === '1').length;
            return [k, p.deb, late.includes(k), ok, nT, nS, doc.getElementsByTagName('Resource').length, xml.includes('<Notes>')]; }}""")
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; const o = JSON.parse(I.__l7); I.dlp = o.dlp; I.dpred = o.dpred; if (o.dlock) I.dlock = o.dlock; else delete I.dlock; I.dinc = o.dinc || {{}}; I.links = o.links; delete I.__l7; X.insSave(); X.refreshAll(); }}"""); pg.wait_for_timeout(300)
        check("v667 axe 8 : verrou DÉBUT (pas avant le 01/03/2027) respecté par COMPRESSER ; FIN dépassée signalée ; export MS PROJECT = XML valide avec lots récapitulatifs, ressources et notes",
              l7 and l7[1] >= "2027-03-01" and l7[2] and l7[3] and l7[4] >= 2 and l7[5] >= 2 and l7[6] >= 1 and l7[7], l7)

        # v674 : export MS PROJECT avec niveaux cochés (DÉSIGNATIONS › LOTS › PRIMAIRES › SECONDAIRES) + aperçu
        m74 = pg.evaluate(f"""() => {{ const X = {ins}, D = {X8}, I = X.INS; I.__m74 = JSON.stringify({{ dlp: I.dlp, dlock: I.dlock }});
            const k = D.keys()[0]; I.dlock = {{ [k]: {{ deb: '2027-03-01' }} }}; X.insSave(); D.comp();
            const t = lv => D.mspTree(lv).rows;
            const a = t({{ des: true, lot: false, prim: false, sec: false }}), b = t({{ des: true, lot: true, prim: true, sec: true }}), c = t({{ lot: true }});
            const xml = D.mspXml({{ lv: {{ des: true, lot: true, prim: false, sec: true }} }});
            const ok = !new DOMParser().parseFromString(xml, 'application/xml').querySelector('parsererror');
            const o = JSON.parse(I.__m74); I.dlp = o.dlp; if (o.dlock) I.dlock = o.dlock; else delete I.dlock; delete I.__m74; X.insSave(); X.refreshAll();
            return [a.length, a.every(n => !n.sum), b.length, b.some(n => n.sum), c.every(n => n.sum || n.deb), ok, a.length <= b.length]; }}""")
        check("v674 : MS PROJECT — désignations seules = tâches sans récapitulatives ; 4 niveaux = récapitulatives ; XML valide",
              m74 and m74[0] >= 1 and m74[1] and m74[3] and m74[4] and m74[5] and m74[6], m74)

        # v676 : verrou par zone — BRAHIM sur DÉTAIL DÉLAIS et sur LOTS : ces deux zones grisées et bloquées, ACTIVITÉS PRIMAIRES et le reste modifiables
        def hasDly(): return pg.evaluate("() => !![...document.querySelectorAll('*')].find(e => e.__insDly)")
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"dly\"]')?.click()"); pg.wait_for_timeout(500)
        r76 = pg.evaluate("""() => { const r = window.__sviOpenRef; SVI_SYNC.locks[r] = [{ ref: r, user: 'BRAHIM', onglet: 'DÉTAIL DÉLAIS', ts: Date.now() }, { ref: r, user: 'BRAHIM2', onglet: 'LOTS', ts: Date.now() }];
            window.__sviLockRecheck && window.__sviLockRecheck(); const hz = window.__sviZoneCtx.shell.dataset.hz;
            const li = document.querySelector('.ins-hcol[data-ik="lot"] input'), pi = document.querySelector('.ins-hcol[data-ik="prim"] input');
            if (li) li.focus(); const lf = document.activeElement === li;
            if (pi) { pi.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); pi.focus(); }
            return [r, hz, !!li, lf, !!pi, document.activeElement === pi, window.__sviOpenTab]; }""")
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"chg\"]')?.click()"); pg.wait_for_timeout(500)
        h76 = pg.evaluate("() => window.__sviZoneCtx.shell.dataset.hz")
        pg.evaluate("() => { delete SVI_SYNC.locks[window.__sviOpenRef]; window.__sviLockRecheck && window.__sviLockRecheck(); window.__sviOpenTab = ''; }")
        check("v676 : verrou par zone — DÉTAIL DÉLAIS et LOTS pris = grisés, saisie LOTS refusée ; ACTIVITÉS PRIMAIRES modifiable et devient ma zone ; DÉTAIL CHARGES libre",
              r76 and "tab" in r76[1] and "lot" in r76[1] and r76[2] and not r76[3] and r76[4] and r76[5] and r76[6] == "ACTIVITÉS PRIMAIRES" and hasDly() is not None and "tab" not in h76 and "lot" in h76, [r76, h76])

        # v678 : zone prise juste avant moi — mes modifications depuis mon entrée dans la zone sont annulées
        r78 = pg.evaluate("""async () => { const r = window.__sviOpenRef, X = window.__sviZoneCtx, I = JSON.parse(X.snap());
            const realQ = window.apiPost; window.apiPost = async (a, b) => a === 'v3Lock' ? (await new Promise(res => setTimeout(res, 300)), { ok: true, held: { user: 'BRAHIM', onglet: b.onglet, ts: Date.now() - 5000 } }) : { ok: true };
            const pi = document.querySelector('.ins-hcol[data-ik="prim"] input'); window.__sviOpenTab = '';
            pi.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
            const ins = [...document.querySelectorAll('*')].find(e => e.__insDly) ; 
            const L = JSON.parse(X.snap()); const row = (L.prim || []).find(x => !x.t); const before = row && row.v;
            /* modification dans la zone pendant l'attente de la réponse */
            const P = I.prim.find(x => !x.t); const stub = JSON.parse(X.snap()); stub.prim.find(x => x.id === P.id).v = 'MODIF DU SECOND';
            X.restore(JSON.stringify(stub));
            const mid = JSON.parse(X.snap()).prim.find(x => x.id === P.id).v;
            await new Promise(res => setTimeout(res, 900));
            const after = JSON.parse(X.snap()).prim.find(x => x.id === P.id).v;
            window.apiPost = realQ; delete SVI_SYNC.locks[r]; window.__sviLockRecheck && window.__sviLockRecheck(); window.__sviOpenTab = '';
            return [before, mid, after, (document.querySelector('.sv-toast, #svToast') || {}).textContent || '']; }""")
        check("v678 : zone prise par BRAHIM juste avant moi = ma modification annulée (retour à l'état d'entrée dans la zone) + message",
              r78 and r78[1] == "MODIF DU SECOND" and r78[2] == r78[0], r78)

        # v668 (axe 7, multi-projets, signatures)
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS; I.__r8 = JSON.stringify({{ chg: I.chg, rat: I.rat }});
            I.chg.push({{ id: 'ra1', des: 'ACIER HA12', u: 'KG', q: 800, p: 12 }}, {{ id: 'ra2', des: 'BETON B25 R', u: 'M3', q: 10, p: 900 }}, {{ id: 'ra3', des: 'MACON R', u: 'JH', q: 20, p: 200 }});
            I.rat = {{ surf: 100, L: [{{ id: 'r1', nom: 'ACIER / BÉTON', num: ['c|ACIER HA12|KG'], den: ['c|BETON B25 R|M3'], mode: 'q', seuil: 50 }}, {{ id: 'r2', nom: 'COÛT AU M²', num: ['tc'], den: ['sc'], mode: 'q', seuil: '' }}], g: {{ t: 'b', h: 220 }} }}; X.insSave(); }}""")
        # v680 : TABLEAU DE BORD — anciens ratios convertis en formules, seuil dépassé en rouge, graphique repris, abscisses par lot
        pg.evaluate("() => [...document.querySelectorAll('*')].find(e => e.__ratWin).__ratWin()"); pg.wait_for_timeout(400)
        r68 = pg.evaluate("() => [...document.querySelectorAll('#svConf table[data-it=\"rat\"] tbody tr.ind-row')].map(t => t.innerText.replace(/\\s+/g, ' ') + (t.querySelector('.rat-over') ? ' [ROUGE]' : '')).join(' || ')")
        g68 = pg.evaluate("() => document.querySelectorAll('#svConf .rat-graphs svg rect').length")
        n68 = pg.evaluate("() => [...document.querySelectorAll('*')].find(e => e.__rat).__rat.cats({ x: 'lot' }).length")
        pg.evaluate("() => document.querySelector('#svConf [data-x]')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate("() => [...document.querySelectorAll('*')].find(e => e.__multiWin).__multiWin()"); pg.wait_for_timeout(300)
        m68 = pg.evaluate("() => (document.querySelector('#svConf .svc-t') || {}).textContent || ''")
        pg.evaluate("() => document.querySelector('#svConf [data-x]')?.click()")
        pg.evaluate("() => [...document.querySelectorAll('*')].find(e => e.__signWin).__signWin()"); pg.wait_for_timeout(300)
        pg.evaluate("() => { document.querySelector('#svConf .sg-on[data-k=\"pvr\"]').checked = true; }"); pg.fill('#svConf .sg-qui[data-k="pvr"]', "maitre d'ouvrage")
        pg.evaluate("() => document.querySelector('#svConf [data-save]')?.click()"); pg.wait_for_timeout(300)
        s68 = pg.evaluate(f"() => JSON.stringify({ins}.INS.sign)")
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; const o = JSON.parse(I.__r8); I.chg = o.chg; if (o.rat) I.rat = o.rat; else delete I.rat; delete I.sign; delete I.__r8; X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        r68n = r68.replace("\u202f", " ")
        check("v680 tableau de bord : anciens ratios convertis (ACIER / BÉTON = 80, seuil 50 dépassé en rouge ; COÛT AU M²), graphique repris, abscisse par lots ; multi-projets et signatures à prévoir",
              "ACIER / BÉTON" in r68n and "80,00" in r68n and "[ROUGE]" in r68n and "COÛT AU M²" in r68n and g68 >= 2 and n68 >= 1 and "TOUS LES BUDGETS" in m68 and '"pvr":{"on":true,"qui":"MAITRE D\'OUVRAGE"}' in s68, [r68n[:600], g68, n68, m68, s68])

        # v679 : LISTE DES INDICATEURS — formule libre, contrôle, format %, tableau, ligne « + » de VERSIONS ET SCÉNARIOS
        r79 = pg.evaluate("""() => { const S = [...document.querySelectorAll('*')].find(e => e.__ind).__ind;
            const E = k => ({ t: 'e', k }), O = v => ({ t: 'o', v });
            const I = { id: 'tst79', nom: 'PART HORS MO', f: [{ t: '(' }, E('b:chg'), O('−'), E('b:mo'), { t: ')' }, O('÷'), E('b:chg')], mode: 'q', fmt: 'p', dec: 1 };
            S.save([I]);
            const c = S.calc(I), c1 = S.calc({ f: [E('b:chg')], fmt: 'n', dec: 2 }), c2 = S.calc({ f: [E('b:mo')], fmt: 'n', dec: 2 });
            const er = f => { try { S.parse(f); return 'OK'; } catch (e) { return e.message; } };
            return [c.txt, c.val, c1.val ? (c1.val - c2.val) / c1.val : null, er([{ t: '(' }, E('b:chg')]), er([E('b:chg'), E('b:mo')]), er([E('b:chg'), O('+')]), S.calc({ f: [E('b:fin')] }).txt, S.load().length]; }""")
        pg.evaluate("() => [...document.querySelectorAll('*')].find(e => e.__indWin).__indWin()"); pg.wait_for_timeout(300)
        t79 = pg.evaluate("() => [...document.querySelectorAll('#svConf #indTable tbody tr.ind-row')].map(t => t.innerText.replace(/\\s+/g, ' ')).join(' || ')")
        h79 = pg.evaluate("() => [...document.querySelectorAll('#svConf #indTable thead .cf-btn')].length")
        pg.evaluate("() => document.querySelector('#svConf [data-x]')?.click()"); pg.wait_for_timeout(200)
        pg.evaluate("() => [...document.querySelectorAll('*')].find(e => e.__verWin).__verWin()"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('#svConf [data-ip]')?.click()"); pg.wait_for_timeout(300)
        m79 = pg.evaluate("() => [...document.querySelectorAll('#blkMenu [data-pk]')].map(b => b.textContent.trim())")
        pg.evaluate("() => document.querySelector('#blkMenu [data-pk=\"tst79\"]')?.click()"); pg.wait_for_timeout(300)
        v79 = pg.evaluate("() => [...document.querySelectorAll('#svConf .ver-t tbody tr')].map(t => t.innerText.replace(/\\s+/g, ' ')).join(' || ')")
        pg.evaluate("() => document.querySelector('#svConf [data-x]')?.click()"); pg.wait_for_timeout(200)
        pg.evaluate(f"() => {{ [...document.querySelectorAll('*')].find(e => e.__ind).__ind.save([]); const V = {ins}.INS.ver; if (V) V.ind = (V.ind || []).filter(k => k !== 'tst79'); }}")
        check("v679 : indicateur ((CHARGES − MO) ÷ CHARGES) en % à 1 décimale ; erreurs de formule lisibles ; tableau à loupes ; ligne + de VERSIONS ET SCÉNARIOS ajoute l'indicateur",
              r79 and abs((r79[1] or 0) - (r79[2] or 0)) < 1e-9 and r79[0].endswith(" %") and r79[3] == "PARENTHÈSE NON FERMÉE" and "OPÉRATEUR" in r79[4] and "FIN DE FORMULE" in r79[5] and "PART HORS MO" in t79 and h79 >= 5 and "PART HORS MO" in m79 and "NOUVEL INDICATEUR…" in m79 and "PART HORS MO" in v79,
              [r79, t79[:200], h79, m79, v79[:300]])

        # v680 : période au prorata ; import d'un indicateur de la LISTE COMMUNE vers le tableau de bord (onglet INDICATEURS coché d'office)
        p80 = pg.evaluate("""() => { const R = [...document.querySelectorAll('*')].find(e => e.__rat).__rat;
            const D = { dlp: { 'a|b': [{ deb: '2026-01-01', fin: '2026-01-10' }] }, links: [{ lot: 'a', sec: 'b', des: 'x', prim: 'p', chg: [{ id: 'c' }], prd: [] }], chg: [{ id: 'c', q: 10, p: 1 }], prd: [], des: [], lot: [] };
            const S = R.per(D, '2026-01-01', '2026-01-05'); return [S.chg[0].q, S.dlp['a|b'][0].fin, R.periods(D, 'w').length]; }""")
        pg.evaluate("""() => { const S = [...document.querySelectorAll('*')].find(e => e.__ind).__ind; S.save([{ id: 'li1', nom: 'MARGE BRUTE', f: [{ t: 'e', k: 'b:mg' }], mode: 'q', fmt: 'n', dec: 0 }]);
            [...document.querySelectorAll('*')].find(e => e.__rat).__rat.imp('rat'); }"""); pg.wait_for_timeout(500)
        i80 = pg.evaluate("() => [document.querySelector('.imp-tab.on')?.textContent || '', [...document.querySelectorAll('.imp-table tbody tr[data-k]')].length]")
        pg.evaluate("() => { document.querySelector('.imp-table tbody tr[data-k] .imp-cb').click(); }"); pg.wait_for_timeout(200)
        pg.evaluate("() => document.querySelector('#impGo')?.click()"); pg.wait_for_timeout(400)
        k80 = pg.evaluate(f"() => ({ins}.INS.rat.L || []).map(r => r.nom)")
        pg.evaluate(f"() => {{ [...document.querySelectorAll('*')].find(e => e.__ind).__ind.save([]); const X = {ins}; X.INS.rat.L = (X.INS.rat.L || []).filter(r => r.nom !== 'MARGE BRUTE'); X.insSave(); }}")
        check("v680 : période (5 jours sur 10 = moitié des charges, fin coupée), semaines ; import de la LISTE COMMUNE vers le tableau de bord (onglet INDICATEURS ouvert d'office)",
              p80 == [5, "2026-01-05", 2] and "INDICATEURS" in i80[0] and i80[1] >= 1 and "MARGE BRUTE" in k80, [p80, i80, k80])

        # v669 (axe 3) : CONTRAT — CPS collé découpé par ARTICLE, types devinés, valeurs, DÉLAI → DATE BUTOIR, échéances → recettes
        cps = "CHAPITRE I : CLAUSES GÉNÉRALES\nARTICLE 1 : OBJET DU MARCHÉ\nLe présent marché a pour objet...\nARTICLE 5 - DÉLAI D'EXÉCUTION\nLe délai est fixé à 6 (six) mois.\nARTICLE 6 : CAUTIONNEMENT DÉFINITIF\nIl est fixé à 3 % du montant initial.\nARTICLE 7 : RETENUE DE GARANTIE\nUne retenue de 10 % sera opérée.\nARTICLE 8 : PÉNALITÉS DE RETARD\nUne pénalité de 1/1000 du montant par jour, plafonnée à 10 %.\nARTICLE 9 : RÉVISION DES PRIX\nLes prix sont révisables.\nARTICLE 10 : MODALITÉS DE PAIEMENT\nAcomptes mensuels."
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.__c9 = JSON.stringify({{ ctr: X.INS.ctr || null, dbut: X.INS.dbut || '', pdeb: X.INS.pdeb || '' }}); X.INS.pdeb = '2026-11-02'; X.insSave(); }}")
        pg.evaluate("() => [...document.querySelectorAll('*')].find(e => e.__ctrWin).__ctrWin()"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('#svConf [data-src]')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('#svConf [data-p]')?.click()"); pg.wait_for_timeout(200)
        pg.fill("#svConf .ctr-paste", cps); pg.evaluate("() => document.querySelector('#svConf [data-go]')?.click()"); pg.wait_for_timeout(400)
        c9 = pg.evaluate("() => [...document.querySelectorAll('#svConf .ctr-t tbody tr')].map(t => t.classList.contains('ctr-tt') ? 'T:' + t.innerText.trim() : (t.querySelector('[data-f=\"no\"]') || {}).value + '|' + (t.querySelector('select[data-f=\"type\"]') || {}).value + '|' + (t.querySelector('[data-f=\"val\"]') || {}).value + '|' + (t.querySelector('select[data-f=\"u\"]') || {}).value).join(' ; ')")
        # DÉLAI → DATE BUTOIR
        pg.evaluate("() => { const tr = [...document.querySelectorAll('#svConf .ctr-t tbody tr')].find(t => (t.querySelector('select[data-f=\"type\"]') || {}).value === 'del'); tr.querySelector('[data-det]').click(); }"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('#svConf [data-but]')?.click()"); pg.wait_for_timeout(300)
        b9 = pg.evaluate(f"() => {ins}.INS.dbut")
        pg.evaluate("() => document.querySelector('#svConf [data-x]')?.click()"); pg.wait_for_timeout(300)
        # MODALITÉS DE PAIEMENT : une échéance à une date, 30 %
        pg.evaluate("() => { const tr = [...document.querySelectorAll('#svConf .ctr-t tbody tr')].find(t => (t.querySelector('select[data-f=\"type\"]') || {}).value === 'pay'); tr.querySelector('[data-det]').click(); }"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('#svConf [data-eadd]')?.click()"); pg.wait_for_timeout(200)
        pg.evaluate("() => { const s = document.querySelector('#svConf .ctp[data-f=\"on\"]'); s.value = 'date'; s.dispatchEvent(new Event('change', { bubbles: true })); }"); pg.wait_for_timeout(200)
        pg.evaluate("() => { const i = document.querySelector('#svConf .ctp[data-f=\"date\"]'); i.value = '2026-12-31'; i.dispatchEvent(new Event('change', { bubbles: true })); const v = document.querySelector('#svConf .ctp[data-f=\"v\"]'); v.value = '30'; v.dispatchEvent(new Event('change', { bubbles: true })); }"); pg.wait_for_timeout(200)
        r9 = pg.evaluate("() => (document.querySelector('#svConf .ctp-rec') || {}).innerText || ''")
        pg.evaluate("() => document.querySelector('#svConf [data-x]')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('#svConf [data-save]')?.click()"); pg.wait_for_timeout(300)
        s9 = pg.evaluate(f"() => {{ const c = {ins}.INS.ctr; return c ? [c.rows.filter(r => !r.t).length, (c.rows.find(r => r.type === 'pay') || {{ det: {{}} }}).det.ech.length] : null; }}")
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; const o = JSON.parse(I.__c9); if (o.ctr) I.ctr = o.ctr; else delete I.ctr; I.dbut = o.dbut; I.pdeb = o.pdeb; delete I.__c9; X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        check("v669 axe 3 : CPS collé = 7 articles + titre CHAPITRE ; types et valeurs devinés (délai 6 MOIS, caution 3 %, RG 10 %, pénalité 1 ‰) ; délai → DATE BUTOIR 01/05/2027 ; échéance 30 % → recette ; enregistré",
              c9.startswith("T:CHAPITRE I") and "5|del|6|MOIS" in c9 and "6|cdef|3|%" in c9 and "7|rg|10|%" in c9 and "8|pen|1|‰" in c9 and "9|rev|" in c9 and "10|pay|" in c9
              and b9 == "2027-05-01" and "31/12/2026" in r9 and s9 == [7, 1], [c9, b9, r9[:200], s9])

        # v670 (axes 1 et 4) : scénarios (copie, bascule, retenir) et avenants (origine des lignes, quantités augmentées)
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.__v0 = JSON.stringify(X.INS); }}")
        VW = "() => [...document.querySelectorAll('*')].find(e => e.__verWin).__verWin()"
        pg.evaluate(VW); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('#svConf [data-new]')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.des.find(d => d.id === 'd1').p = 4321; X.insSave(); }}")
        pg.evaluate("() => document.querySelector('#svConf [data-x]')?.click()"); pg.wait_for_timeout(200)
        pg.evaluate(VW); pg.wait_for_timeout(300)
        hd = pg.evaluate("() => [...document.querySelectorAll('#svConf .ver-t thead th small')].map(x => x.textContent).join(',')")
        pg.evaluate("() => document.querySelector('#svConf [data-sw]')?.click()"); pg.wait_for_timeout(400)
        p1 = pg.evaluate(f"() => Number({ins}.INS.des.find(d => d.id === 'd1').p)")
        pg.evaluate("() => document.querySelector('#svConf [data-sw]')?.click()"); pg.wait_for_timeout(400)
        p2 = pg.evaluate(f"() => Number({ins}.INS.des.find(d => d.id === 'd1').p)")
        check("v670 axes 1 et 4 : scénario copié, BASCULER échange les prix (4321 ↔ autre)", "ACTIF" in hd and "EN RÉSERVE" in hd and p1 != 4321 and p2 == 4321, [hd, p1, p2])
        # v681 : RETENIR puis DÉSARCHIVER ; nouveau scénario = premier numéro libre
        pg.evaluate("() => document.querySelector('#svConf [data-x]')?.click()"); pg.wait_for_timeout(200)
        pg.evaluate(VW); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('#svConf [data-keep]')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('#svConf .svc-ok')?.click()"); pg.wait_for_timeout(600)
        pg.evaluate(VW); pg.wait_for_timeout(300)
        a81 = pg.evaluate("() => [...document.querySelectorAll('#svConf .ver-t thead th small')].map(x => x.textContent).join(',')")
        pg.evaluate("() => document.querySelector('#svConf [data-unarch]')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('#svConf .svc-ok')?.click()"); pg.wait_for_timeout(600)
        b81 = pg.evaluate(f"() => ({ins}.INS.ver.L || []).filter(x => x.arch).length")
        pg.evaluate(f"() => {{ const V = {ins}.INS.ver; V.L = V.L.filter(x => x.id === V.act || x.nom !== 'SCÉNARIO 1'); V.L.forEach(x => {{ if (x.id === V.act) x.nom = 'SCÉNARIO 2'; }}); {ins}.insSave(); }}")
        pg.evaluate("() => { document.querySelector('#svConf')?.remove(); }")
        pg.evaluate(VW); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('#svConf [data-new]')?.click()"); pg.wait_for_timeout(300)
        c81 = pg.evaluate(f"() => ({ins}.INS.ver.L || []).map(x => x.nom).join(',')")
        pg.evaluate("() => document.querySelector('#svConf [data-x]')?.click()"); pg.wait_for_timeout(200)
        # v681 : avenants — consolidé GLOBAL au prix moyen pondéré, contradiction même lot / autres activités
        r81 = pg.evaluate("""() => {
            const d0 = { des: [{ id: 'd', des: 'BETON B25', u: 'M3', q: 100, p: 900 }], lot: [{ id: 'l', v: 'RDC' }], prim: [{ id: 'p', v: 'BETON' }], sec: [{ id: 's', v: 'BETON' }], chg: [], prd: [{ id: 'x0', des: 'BETON', u: 'M3', q: 100 }], links: [], dlp: { 'l|s': [{ id: 'x', deb: '2027-01-04', fin: '2027-01-08' }] }, dlpSec: true };
            const d1 = { des: [{ id: 'd', des: 'BETON B25', u: 'M3', q: 20, p: 1000 }], lot: [{ id: 'l', v: 'RDC' }], prim: [{ id: 'p', v: 'COFFRAGE' }], sec: [{ id: 's', v: 'COFFRAGE' }], chg: [], prd: [{ id: 'x1', des: 'BETON', u: 'M3', q: 20 }], links: [{ id: 'k', des: 'd', lot: 'l', prim: 'p', sec: 's', prd: [{ id: 'x1' }], chg: [] }], dlp: {}, dlpSec: true };
            const d0b = JSON.parse(JSON.stringify(d0)); d0b.links = [{ id: 'k0', des: 'd', lot: 'l', prim: 'p', sec: 's', prd: [{ id: 'x0' }], chg: [] }];
            const keep = sviInstGet();
            sviInstSet(keep.concat([{ ref: 'AVT-1', project: 'AVT', state: 'valide', data: d0b }, { ref: 'AVT-1-AV1', project: 'AVT', state: 'instance', parent: 'AVT-1', avn: 1, data: d1 }]));
            const M = sviAvMerge('AVT-1', true), r = M.des[0], M0 = sviAvMerge('AVT-1'), C = sviAvContra('AVT-1-AV1'), st = sviAvStages('AVT-1-AV1').map(x => x.ref).join(',');
            sviInstSet(keep);
            return [M.des.length, insLinkedQ(M, r.id), Math.round(r.p * 100) / 100, !!r.pmp, C.length, C[0] ? C[0].att + ' / ' + C[0].got : '', st, insLinkedQ(M0, M0.des[0].id), !!M0.des[0].pmp]; }""")
        tg706 = pg.evaluate("() => [(document.getElementById('refTxt') || {}).textContent || '', !!document.getElementById('sviScreenTag')]")
        check("v706 / v780 : le NUMÉRO du scénario actif à la fin de la référence (… SCNn), plus d'étiquette en haut", re.search(r" SCN\d+$", tg706[0]) is not None and not tg706[1], tg706)
        check("v681 : RETENIR archive, DÉSARCHIVER rend la réserve, nouveau scénario = premier numéro libre ; v717 : même désignation à un autre prix = article distinct (900 et 1000) ; contradiction même lot, autres activités ; v684 : sans INCLURE LES NON VALIDÉS, l'avenant en instance n'est pas compté",
              "ARCHIVÉ" in a81 and b81 == 0 and c81.count("SCÉNARIO 1") == 1 and r81 == [2, 100, 900, False, 1, "BETON › BETON / COFFRAGE › COFFRAGE", "AVT-1,AVT-1-AV1", 100, False], [a81, b81, c81, r81])
        pg.evaluate(f"() => {{ const X = {ins}; const o = JSON.parse(X.INS.__v0); Object.keys(X.INS).forEach(k => delete X.INS[k]); Object.assign(X.INS, o); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)

        # v735 : avenant — chaîne d'origine d'une désignation dans un lot (étape précédente)
        o735 = pg.evaluate("""() => {
            const d0 = { des: [{ id: 'd', des: 'BETON B25', u: 'M3' }], lot: [{ id: 'l', v: 'RDC' }], prim: [{ id: 'p', v: 'BETON' }], sec: [{ id: 's', v: 'BETON SEC' }], links: [{ id: 'k', des: 'd', lot: 'l', prim: 'p', sec: 's', prd: [], chg: [] }] };
            const keep = sviInstGet();
            sviInstSet(keep.concat([{ ref: 'AVO-1', project: 'AVO', state: 'valide', data: d0 }, { ref: 'AVO-1-AV1', project: 'AVO', state: 'instance', parent: 'AVO-1', avn: 1, data: { des: [], lot: [], links: [] } }]));
            const a = sviAvOrigin('AVO-1-AV1', 'beton b25', 'm3', 'rdc'), b = sviAvOrigin('AVO-1-AV1', 'BETON B25', 'M3', 'ETAGE'), c = sviAvOrigin('AVO-1', 'BETON B25', 'M3', 'RDC');
            sviInstSet(keep); return [a && a.prim + ' › ' + a.sec + ' (' + a.st + ')', b, c]; }""")
        check("v735 : avenant — chaîne d'origine proposée (même désignation, même lot) ; autre lot ou budget initial : rien", o735 == ["BETON › BETON SEC (BUDGET INITIAL)", None, None], o735)
        # v671 (axe 6) : règle des axes ; plan image → ÉCHELLE (10 m), LONGUEUR mesurée, REMPLIR DIM 1 d'un produit
        ax = pg.evaluate("""() => { const s = [...document.querySelectorAll('*')].find(e => e.__axBetween); const f = s.__axBetween;
            return [f('1', '2', ['1', '2']), f('1', '1.1', ['1', '1.1', '2']), f('1.1', '2', ['1', '1.1', '2']), f('B', 'C', ['B', 'C']), f('B1', 'B2', ['B1', 'B2']), f('B1', 'C', ['B', 'B1', 'C'])].join(','); }""")
        import base64, struct, zlib, tempfile
        def png(w, h):
            raw = b"".join(b"\x00" + b"\xff\xff\xff" * w for _ in range(h))
            ch = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
            return b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + ch(b"IDAT", zlib.compress(raw)) + ch(b"IEND", b"")
        fp = os.path.join(tempfile.gettempdir(), "plan_test.png"); open(fp, "wb").write(png(800, 600))
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.__p6 = JSON.stringify({{ prd: X.INS.prd, plans: X.INS.plans || null }}); }}")
        pg.evaluate("() => [...document.querySelectorAll('*')].find(e => e.__plWin).__plWin()"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('#svConf [data-doc]')?.click()"); pg.wait_for_timeout(200)
        with pg.expect_file_chooser() as fc:
            pg.evaluate("() => document.querySelector('#svConf .pl-pick [data-f]')?.click()")
        fc.value.set_files(fp); pg.wait_for_timeout(1200)
        def tap(fx, fy):
            r = pg.evaluate("() => { const b = document.querySelector('#svConf .pl-stage').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; }")
            pg.mouse.click(r[0] + r[2] * fx, r[1] + r[3] * fy); pg.wait_for_timeout(150)
        pg.evaluate("() => document.querySelector('#svConf [data-tool=\"sc\"]')?.click()")
        tap(.1, .5); tap(.6, .5); pg.wait_for_timeout(200)
        pg.fill("#svConf .pl-ask", "10"); pg.evaluate("() => document.querySelector('#svConf .pl-pick [data-ok]')?.click()"); pg.wait_for_timeout(200)
        pg.evaluate("() => document.querySelector('#svConf [data-tool=\"l\"]')?.click()")
        tap(.1, .2); tap(.35, .2); pg.evaluate("() => document.querySelector('#svConf [data-end]')?.click()"); pg.wait_for_timeout(200)
        mv = pg.evaluate("() => (document.querySelector('#svConf .pl-mr span') || {}).textContent || ''")
        pg.evaluate("() => { const s = document.querySelector('#svConf .pl-prd'); s.value = s.options[1].value; const f = document.querySelector('#svConf .pl-f'); f.value = 'd1'; document.querySelector('#svConf [data-send]').click(); }"); pg.wait_for_timeout(300)
        pv6 = pg.evaluate(f"() => {{ const I = {ins}.INS; const id = document.querySelector('#svConf .pl-prd').options[1].value; return Number((I.prd.find(r => r.id === id) || {{}}).d1); }}")
        pg.evaluate("() => document.querySelector('#svConf [data-x]')?.click()"); pg.wait_for_timeout(200)
        pg.evaluate(f"() => {{ const X = {ins}; const o = JSON.parse(X.INS.__p6); X.INS.prd = o.prd; if (o.plans) X.INS.plans = o.plans; else delete X.INS.plans; delete X.INS.__p6; X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        check("v671 axe 6 : axes 1.1, 1.05, 1.2, B1, B1.1, B2 ; plan image : échelle 10 m sur une cote, longueur mesurée = 5 M, DIM 1 du produit rempli",
              ax == "1.1,1.05,1.2,B1,B1.1,B2" and mv.startswith("5 M") and abs(pv6 - 5) < 0.05, [ax, mv, pv6])

        # v672 (bloc 2) : base V3 simulée — envoi initial avec contrôle, fusion case par case (la plus récente gagne), CONFLITS, verrou, QUI
        pg.evaluate("""() => { const S = window.__fs = { b: {}, locks: [] };
          window.apiPost = async (a, p) => {
            if (a === 'v3List') return { ok: true, list: Object.values(S.b).map(x => ({ ref: x.ref, rev: x.rev, ts: x.ts, user: x.user })), locks: S.locks };
            if (a === 'v3Pull') { const x = S.b[p.ref]; if (x && S.corrupt) { const o = JSON.parse(x.data); (o.data.des.find(r => !r.t) || {}).p = 1; return { ok: true, ...x, data: JSON.stringify(o) }; } return x ? { ok: true, ...x } : { ok: true, missing: true }; }
            if (a === 'v3Push') { const x = S.b[p.ref]; if (x && x.rev !== p.baseRev) return { ok: true, conflict: true, rev: x.rev, ts: x.ts, user: x.user, data: x.data };
              S.b[p.ref] = { ref: p.ref, rev: (x ? x.rev : 0) + 1, ts: p.ts, user: p.user, data: p.data }; const o = JSON.parse(p.data).data || {};
              return { ok: true, rev: S.b[p.ref].rev, len: p.data.length, ctl: { des: (o.des || []).length, lot: (o.lot || []).length, prim: (o.prim || []).length, sec: (o.sec || []).length, chg: (o.chg || []).length, prd: (o.prd || []).length, links: (o.links || []).length } }; }
            if (a === 'v3Photo') { S.photo = p; return { ok: true }; }
            if (a === 'v3Lock' || a === 'v3Unlock' || a === 'v3Del') { S.lastLock = a; return { ok: true }; }
            if (a === 'v3Stats') return { ok: true, cells: 1000, limit: 1e7 };
            return { ok: false };
          }; window.__fsApi = window.apiPost; }""")
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.__s72 = JSON.stringify(X.INS); }}")
        pg.evaluate("() => sviSyncPull().then(() => sviSyncRun())"); pg.wait_for_timeout(1500)
        pg.evaluate("() => sviSyncRun()"); pg.wait_for_timeout(1200)
        s72 = pg.evaluate("() => { const S = window.__fs; const r = Object.keys(S.b)[0]; return r ? [r, S.b[r].rev, sviSyncPending(), (document.getElementById('sviSync') || {}).textContent] : null; }")
        ref72 = s72[0] if s72 else ""
        # un autre utilisateur change le PPB de d1 (plus récemment) ; moi aussi, plus tôt ; et moi seul la QPB de c2
        pg.evaluate(f"""r => {{ const S = window.__fs, x = S.b[r], o = JSON.parse(x.data); o.data.des.find(d => d.id === 'd1').p = 999; x.data = JSON.stringify(o); x.rev++; x.user = 'BRAHIM'; x.ts = Date.now() + 60000; }}""", ref72)
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.des.find(d => d.id === 'd1').p = 777; const c = X.INS.chg.find(r => !r.t); c.q = 123; window.__c72 = c.id; X.insSave(); }}"); pg.wait_for_timeout(600)
        pg.evaluate("() => sviSyncRun()"); pg.wait_for_timeout(1500)
        m72 = pg.evaluate(f"() => {{ const I = {ins}.INS; return [Number(I.des.find(d => d.id === 'd1').p), Number(I.chg.find(r => r.id === window.__c72).q), (I.conf || []).length, ((I.conf || [])[0] || {{}}).user, Number(((I.conf || [])[0] || {{}}).mine)]; }}")
        pg.evaluate("() => document.querySelector('#instTodo')?.click()"); pg.wait_for_timeout(300)
        td72 = pg.evaluate("() => (document.querySelector('#svConf') || {}).innerText || ''")
        pg.evaluate("() => { const b = [...document.querySelectorAll('#svConf .fz-why')].find(x => /CONFLITS/.test(x.textContent)); b && b.click(); }"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('#svConf [data-mine]')?.click()"); pg.wait_for_timeout(300)
        r72 = pg.evaluate(f"() => {{ const I = {ins}.INS; return [Number(I.des.find(d => d.id === 'd1').p), (I.conf || []).length]; }}")
        pg.evaluate("() => document.querySelector('#svConf [data-x]')?.click()"); pg.evaluate("() => document.querySelector('#histBtn')?.click()"); pg.wait_for_timeout(400)
        h72 = pg.evaluate("() => { const t = [...document.querySelectorAll('table')].find(x => /QUI/.test((x.querySelector('thead') || {}).textContent || '')); if (!t) return ''; const tr = [...t.querySelectorAll('tbody tr')].find(r => /CONFLITS/.test(r.textContent)); return tr ? tr.textContent : ''; }")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
        pg.evaluate("() => document.querySelector('#svConf [data-x]')?.click()")
        pg.evaluate(f"() => {{ const X = {ins}; const o = JSON.parse(X.INS.__s72); Object.keys(X.INS).forEach(k => delete X.INS[k]); Object.assign(X.INS, o); delete X.INS.__s72; X.insSave(); X.refreshAll(); window.apiPost = undefined; }}"); pg.wait_for_timeout(300)
        check("v672 bloc 2 : envoi initial (REV 1, contrôle), fusion : QPB gardée (moi seul), PPB de l'autre plus récent gardé (999) et le mien en CONFLIT (777, BRAHIM) ; ⚠ CONFLITS ; MA VALEUR reprise ; QUI = TESTEUR",
              s72 and s72[1] >= 1 and s72[2] == 0 and m72[0] == 999 and m72[1] == 123 and m72[2] == 1 and m72[3] == "BRAHIM" and m72[4] == 777 and "CONFLITS" in td72 and r72 == [777, 0] and "TESTEUR" in h72, [s72, m72, td72[:200], r72, h72])
        # v721 (bloc 7, point 1) : contrôle de l'envoi par les totaux — base qui relit un autre montant = envoi raté, renvoyé, signalé après 2 échecs
        c721 = pg.evaluate(f"""async () => {{ const S = window.__fs; if (!S) return null; const X = {ins}; if (!X) return 'nobudget'; window.apiPost = window.__fsApi; S.corrupt = true;
            const r = (X.INS.des || []).find(x => !x.t); if (!r) return null; r.q = (Number(r.q) || 0) + 1; X.insSave(); await sviInstFlush();
            const W = () => new Promise(z => setTimeout(z, 300)), run = async () => {{ for (let i = 0; i < 20 && SVI_SYNC.busy; i++) await W(); await sviSyncRun(); }};
            await new Promise(z => setTimeout(z, 2000)); await run(); await run();
            const M = sviSyncMeta(), k = Object.keys(M).find(x => (M[x].ctl || 0) > 0), a = k ? [M[k].ctl, M[k].ctlWhy, !!M[k].dirty, (document.getElementById('sviSync') || {{}}).textContent] : null;
            S.corrupt = false; await run(); const b = k ? [sviSyncMeta()[k].ctl || 0, !!sviSyncMeta()[k].dirty] : null; r.q = Number(r.q) - 1; X.insSave(); await sviInstFlush(); await new Promise(z => setTimeout(z, 1500)); await run(); window.apiPost = undefined; return [a, b]; }}""")
        check("v721 : contrôle de l'envoi par les totaux — écart = renvoi, ⚠ sur le repère après 2 échecs, remis à zéro quand c'est bon",
              c721 and c721[0] and c721[0][0] >= 2 and "MONTANT HT DES DÉSIGNATIONS" in c721[0][1] and c721[0][2] and "⚠" in c721[0][3] and c721[1] == [0, False], c721)
        # v722 (bloc 7, point 3) : TOUT PARTAGER — UNITÉS envoyées dans la base (_K:svi_units_v1), reçues d'un autre appareil, fusion par réunion en cas de conflit
        sh = pg.evaluate("""async () => { const S = window.__fs; if (!S || !window.__fsApi) return null; window.apiPost = window.__fsApi;
            const W = ms => new Promise(z => setTimeout(z, ms)), run = async () => { for (let i = 0; i < 20 && SVI_SYNC.busy; i++) await W(300); await sviSyncRun(); };
            const old = localStorage.getItem('svi_units_v1');
            localStorage.setItem('svi_units_v1', JSON.stringify([{ n: 'MÈTRE CARRÉ', a: 'M2' }])); await run();
            const sent = S.b['_K:svi_units_v1'] ? JSON.parse(JSON.parse(S.b['_K:svi_units_v1'].data).data.v).length : -1;
            const x = S.b['_K:svi_units_v1'], o = JSON.parse(x.data); o.data.v = JSON.stringify([{ n: 'MÈTRE CARRÉ', a: 'M2' }, { n: 'TONNE', a: 'T' }]); x.data = JSON.stringify(o); x.rev++; x.user = 'BRAHIM'; x.ts = Date.now();
            await sviSyncPull(); const got = JSON.parse(localStorage.getItem('svi_units_v1') || '[]').map(u => u.a).join(',');
            const y = S.b['_K:svi_units_v1'], o2 = JSON.parse(y.data); o2.data.v = JSON.stringify([...JSON.parse(o2.data.v), { n: 'LITRE', a: 'L' }]); y.data = JSON.stringify(o2); y.rev++; y.ts = Date.now() - 1000;
            localStorage.setItem('svi_units_v1', JSON.stringify([...JSON.parse(localStorage.getItem('svi_units_v1')), { n: 'KILOGRAMME', a: 'KG' }])); await run(); await run();
            const fin = JSON.parse(localStorage.getItem('svi_units_v1') || '[]').map(u => u.a).sort().join(',');
            if (old === null) localStorage.removeItem('svi_units_v1'); else localStorage.setItem('svi_units_v1', old); await run(); window.apiPost = undefined; return [sent, got, fin]; }""")
        check("v722 : partage — UNITÉS envoyées, reçues d'un autre appareil, modifiées des deux côtés = réunion (rien de perdu)",
              sh == [1, "M2,T", "KG,L,M2,T"], sh)

        # v724 (bloc 2, points 2 et 5) : onglet INDICATEURS en quatre parties (planning, Gantt, valeurs, graphique, ⚙) ; TABLEAU DE BORD en miniatures
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"ind1\"]')?.click()"); pg.wait_for_timeout(700)
        i724 = pg.evaluate("() => [document.querySelectorAll('.i1-wrap .i1-p').length, !!document.querySelector('.i1-wrap [data-i1cfg]'), !!document.querySelector('.i1-vals'), document.querySelectorAll('.i1-wrap [data-i1h]').length]")
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"lnk\"]')?.click()"); pg.wait_for_timeout(700)
        b724 = pg.evaluate("() => [document.querySelectorAll('.ibd-tile .ibd-mini svg').length > 0 || document.querySelectorAll('.ibd-tile').length > 0, !!document.querySelector('.ibd-tile [data-tmax]')]")
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"chg\"]')?.click()"); pg.wait_for_timeout(400)
        # v725 (bloc 2, point 4) : ESSAI — prix d'une charge changé : courbe ESSAI, budget inchangé ; APPLIQUER enregistre avec le message, ↶ possible
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"ind1\"]')?.click()"); pg.wait_for_timeout(500)
        t725 = pg.evaluate(f"""async () => {{ const X = {ins}, I = X.INS, r = (I.chg || []).find(x => !x.t); if (!r) return null; const p0 = Number(r.p);
            const sh = [...document.querySelectorAll('*')].find(e => e.__i1Click); if (!sh) return 'noshell';
            sh.__i1Try = {{ id: r.id, p: String(p0 * 2), rd: '' }}; X.refreshAll(); await new Promise(z => setTimeout(z, 300));
            const a = [!!document.querySelector('.i1-try'), Number(r.p) === p0];
            document.querySelector('[data-i1tryok]')?.click(); await new Promise(z => setTimeout(z, 300));
            const b = [Number(r.p) === p0 * 2, /DEPUIS INDICATEURS/.test(r.modInd || '')];
            r.p = p0; delete r.modInd; X.insSave(); X.refreshAll(); return [a, b]; }}""")
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"chg\"]')?.click()"); pg.wait_for_timeout(300)
        check("v725 : ESSAI depuis les indicateurs — courbe d'essai, budget inchangé ; APPLIQUER enregistre avec « MODIFIÉ PAR … DEPUIS INDICATEURS »",
              t725 == [[True, True], [True, True]], t725)
        check("v724 : onglet INDICATEURS en quatre parties avec ⚙ et poignées ; TABLEAU DE BORD en miniatures avec ⚙",
              i724 == [4, True, True, 3] and b724 == [True, True], [i724, b724])
        # v732 (bloc 9) : la chute compte dans les indicateurs (CHARGES) ; une seule fois
        c732 = pg.evaluate(f"""() => {{ const sh = [...document.querySelectorAll('*')].find(e => e.__ind), X = {ins}, I = X.INS; if (!sh) return null;
            const one = () => sh.__ind.calc({{ id: 'z', nom: 'Z', f: [{{ t: 'e', k: 'b:chg' }}], mode: 'q', fmt: 'n', dec: 2 }}).val;
            const r = I.chg.find(x => !x.t && (I.links || []).some(l => (l.chg || []).some(e => e.id === x.id) && (l.prd || []).some(p => {{ const q = I.prd.find(y => y.id === p.id); return q && Number(q.d1) > 0; }})));
            if (!r) return 'pas de charge';
            const keep = JSON.stringify(I.cond || null), a = one(), key = dlyResK(r).split('|')[0] + '|' + String(r.u).trim().toUpperCase();
            I.cond = {{ ...(I.cond || {{}}), [key]: {{ mode: 'c', BL: 1000, kerf: 0, kgm: 1 }} }};
            const ch = condChuteRow(I, r), b = one(); const K = JSON.parse(keep); if (K) I.cond = K; else delete I.cond;
            return [ch > 0, Math.abs(b - a - ch * Number(r.p || 0)) < 0.01]; }}""")
        check("v732 : chute comptée une fois dans l'indicateur CHARGES", c732 in ([True, True], "pas de charge"), c732)
        # v743 : rapidité — DÉTAIL CHARGES dessiné par morceaux (premières lignes, la suite au défilement ou d'un coup) ; onglet gardé en mémoire
        r743 = pg.evaluate(f"""() => {{ const X = {ins}, I = X.INS, n0 = I.chg.length; for (let i = 0; i < 150; i++) I.chg.push({{ id: 'pz' + i, des: 'ESSAI ' + i, u: 'U', q: 1, p: 1 }});
            X.insSave(); document.querySelector('.bdg-d-tab[data-tab="chg"]')?.click();
            const cnt = () => document.querySelectorAll('#bdgTabBody table.ins-table[data-ik="chg"] tbody tr[data-iid^="pz"]').length;
            const a = cnt(); const sh = [...document.querySelectorAll('*')].find(e => e.__insMoreAll); sh && sh.__insMoreAll('chg'); const b = cnt();
            const tb = document.querySelector('#bdgTabBody table.ins-table[data-ik="chg"]');
            document.querySelector('.bdg-d-tab[data-tab="prd"]')?.click(); document.querySelector('.bdg-d-tab[data-tab="chg"]')?.click();
            const same = document.querySelector('#bdgTabBody table.ins-table[data-ik="chg"]') === tb;
            I.chg.splice(n0); X.insSave(); X.refreshAll(); return [a < 150, b, same]; }}""")
        check("v743 : DÉTAIL CHARGES dessiné par morceaux (tout d'un coup si besoin : 150 lignes) ; onglet repris tel quel au retour", r743 == [True, 150, True], r743)
        # v740 : CUMUL — budgets additionnés : lots sous la référence, tâches séparées, calendrier de chaque budget, désignations sous un titre par budget
        t740 = pg.evaluate("""() => { const mk = (we) => ({ cal: { we }, des: [{ id: 'd', des: 'BETON', u: 'M3', art: '1' }], lot: [{ id: 'l', v: 'RDC' }], sec: [{ id: 's', v: 'BETONNAGE' }], prim: [{ id: 'p', v: 'BETONNAGE' }],
              prd: [], chg: [], links: [{ id: 'k', des: 'd', lot: 'l', prim: 'p', sec: 's', prd: [], chg: [] }], dlp: { 'l|s': [{ deb: '2026-11-02', fin: '2026-11-06' }] }, dlpSec: true });
            const M = sviCumMerge([{ ref: 'A-1', d: mk([0]) }, { ref: 'B-1', d: mk([0, 6]) }]);
            return [M.lot.map(x => x.v).join(','), Object.keys(M.dlp).length, M.calK['c1_l|c1_s'].we.join(','), M.des.filter(x => x.t).map(x => x.des).join(','), M.des.filter(x => !x.t).map(x => x.art).join(',')]; }""")
        check("v740 : CUMUL — lots « RÉF. / LOT », deux tâches séparées, calendrier de chaque budget, désignations sous le titre de leur budget", t740 == ["A-1 / RDC,B-1 / RDC", 2, "0,6", "A-1,B-1", "1.1,2.1"], t740)
        # v739 : BIBLIOTHÈQUE DE PRIX — recette tirée d'un budget (charges ÷ quantité de produit), sans doublon, usage ajouté
        t739 = pg.evaluate("""() => { const d = { des: [{ id: 'd', des: 'BETON B25', u: 'M3' }], lot: [{ id: 'l', v: 'RDC' }], sec: [{ id: 's', v: 'BETONNAGE', u: 'M3' }],
              prd: [{ id: 'x', des: 'P', u: 'M3', nbr: 10, d1: 1, d2: 1, d3: 2 }], chg: [{ id: 'c', des: 'CIMENT', u: 'T', q: 7, p: 1500 }], links: [{ des: 'd', lot: 'l', sec: 's', prd: [{ id: 'x' }], chg: [{ id: 'c' }] }] };
            const L = []; sviLibFromBudget(d, 'A').forEach(R => sviLibAdd(L, R)); const R2 = sviLibFromBudget(d, 'B')[0]; R2.lot = ['ETAGE']; sviLibAdd(L, R2);
            return [L.length, L[0].act, L[0].u, Math.round(L[0].chg[0].k * 1000) / 1000, L[0].lot.join(',')]; }""")
        check("v739 : BIBLIOTHÈQUE DE PRIX — recette BETONNAGE (CIMENT 0,35 T / M3), sans doublon, usage des deux lots gardé", t739 == [1, "BETONNAGE", "M3", 0.35, "RDC,ETAGE"], t739)
        # v738 : RETENUE DE GARANTIE des MODALITÉS DE PAIEMENT — déduite de chaque échéance, rendue à sa libération
        t738 = pg.evaluate("""() => { const d = { ctr: { rows: [{ type: 'pay', det: { ech: [{ on: 'task', task: 'a|b', v: 30, u: '%' }, { on: 'date', date: '2026-12-31', v: 70, u: '%' }], rg: { t: 7, on: 'fin', mois: 12 } } }] } };
            const P = sviPayPlan(d, 100000, k => k === 'a|b' ? '2026-11-10' : '', '2026-12-31');
            return P.map(x => [x.date, Math.round(x.m)]); }""")
        check("v738 : RETENUE DE GARANTIE 7 % — échéances nettes (27 900, 65 100), 7 000 rendus 12 mois après la fin des travaux", t738 == [["2026-11-10", 27900], ["2026-12-31", 65100], ["2027-12-31", 7000]], t738)
        # v723 (bloc 2, points 1 et 3) : RECETTES seulement avec un article PAIEMENT (échéance datée), GROUPE de charges (titre), COMMANDES
        b2 = pg.evaluate(f"""() => {{ const sh = [...document.querySelectorAll('*')].find(e => e.__ind), X = {ins}, I = X.INS; if (!sh) return null; const A = sh.__ind;
            const one = k => A.calc({{ id: 'z', nom: 'Z', f: [{{ t: 'e', k }}], mode: 'q', fmt: 'n', dec: 2 }});
            const r0 = one('b:rec'); const c0 = JSON.stringify(I.ctr || null);
            I.ctr = {{ rows: [{{ id: 'p1', type: 'pay', det: {{ ech: [{{ on: 'date', date: '2026-11-15', v: 1000, u: 'DH' }}] }} }}] }};
            const r1 = one('b:rec'); I.ctr = JSON.parse(c0) || undefined;
            const t = (I.chg || []).find(r => r.t); const g = t ? one('g|' + String(t.des || t.art || t.id).toUpperCase()) : {{ txt: 'pas de titre' }};
            const c = one('b:cmd');
            return [!!(r0.soft || r0.err), r1.val, t ? g.val !== undefined : true, c.val !== undefined || !!c.soft]; }}""")
        check("v723 : indicateurs — RECETTES proposées seulement avec un article PAIEMENT (1 000 DH), GROUPE de charges, COMMANDES",
              b2 is not None and (b2[0] and b2[1] == 1000 and b2[2] and b2[3]), b2)
        # v719 / v720 (bloc 6) : DOC / TAF / OBS liés au chemin des ronds (BUDGET sans rond) ; filtrés par les cases carrées des autres blocs
        r720 = pg.evaluate(f"""() => {{ const X = {ins}, I = X.INS, d = (I.des || []).find(r => !r.t), L = (I.links || []).find(l => l.des === (d || {{}}).id);
            if (!d || !L) return null;
            localStorage.setItem('svi_taf_v1:TEST-1', JSON.stringify([{{ ref: 'T1', date: '2026-10-30T10:00', text: 'A', prevu: '2026-11-01T10:00', att: {{ k: 'path', des: d.id, lot: L.lot }} }}, {{ ref: 'T2', date: '2026-10-30T10:00', text: 'B', prevu: '2026-11-01T10:00' }}]));
            X.refreshAll(); const t0 = (document.querySelector('#recTitle-taf .svi-cnt') || {{}}).textContent;
            d.on = true; X.insSave(); X.refreshAll(); const c = document.querySelector('#recTitle-taf .svi-cnt');
            const r = [t0, c && c.textContent, c && c.classList.contains('cnt-filt'), [...document.querySelectorAll('#recTable-taf td')].some(td => td.textContent.includes(' › '))];
            d.on = false; localStorage.removeItem('svi_taf_v1:TEST-1'); X.insSave(); X.refreshAll(); return r; }}""")
        check("v719 / v720 : TAF lié au chemin des ronds (chemin en clair) ; cases carrées = seuls les éléments liés, compteur 1/2 en bleu ; TAF du BUDGET masqué",
              r720 is None or (r720[0] == "2" and r720[1] == "1/2" and r720[2] and r720[3]), r720)
        # v718 : révision des prix estimée — 100 000 DH de travaux en janvier 2028, base janvier 2027, 0,15 + 0,85 × index à +10 %/an → ≈ 8 500 DH ; pessimiste (+10 %) plus élevé ; hausse de charges CIMENT
        rv = pg.evaluate("""() => { const d = { des: [{ id: 'd', des: 'X', u: 'U', q: 1, p: 100000 }], links: [{ id: 'k', des: 'd', lot: 'l', prim: 'p', sec: 's', prd: [], chg: [] }], dlp: { 'l|s': [{ id: 'a', deb: '2028-01-10', fin: '2028-01-10' }] },
            chg: [{ id: 'c', des: 'CIMENT CPJ', q: 10, p: 1000 }], ctr: { rows: [{ id: 'r', type: 'rev', det: { pond: '0,15 ; 0,85', mb: '2027-01', hyp: '10', choc: '10', pchg: 'CIMENT:10' } }] } };
            const E = sviRevEst(d, false), P = sviRevEst(d, true); return [Math.round(E.rev), Math.round(P.rev) > Math.round(E.rev), Math.round(P.chgUp)]; }""")
        check("v718 : RÉVISION DES PRIX estimée avec le planning (hypothèse par index) ; scénario pessimiste (index et charges)", rv == [8500, True, 1000], rv)
        # v716 : compteur « retenues/total » en bleu quand un filtre cache des lignes ; toucher = FILTRES ACTIFS + EFFACER TOUS LES FILTRES
        pg.evaluate(f"() => {{ const X = {ins}; const r = (X.INS.chg || []).find(x => !x.t); if (r) r.on = true; X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(500)
        f716 = pg.evaluate("() => { const c = document.querySelector('#bdgTabs .svi-cnt.cnt-filt'); if (!c) return [0]; c.click(); const d = document.getElementById('svConf'); const r = [1, d ? d.querySelector('.svc-t, .sv-head, h3, b')?.textContent || d.innerText.slice(0, 40) : '', !!(d && d.querySelector('[data-fwclr]'))]; d?.querySelector('[data-x]')?.click(); return r; }")
        pg.evaluate(f"() => {{ const X = {ins}; (X.INS.chg || []).forEach(x => {{ x.on = false; }}); X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(400)
        check("v716 : compteur filtré en bleu ; toucher = FILTRES ACTIFS avec EFFACER TOUS LES FILTRES", f716[0] == 1 and "FILTRES ACTIFS" in f716[1] and f716[2], f716)
        # v714 (point 3, étape 1) : onglet APPROVISIONNEMENT PRÉVISIONNEL — commandes PAR TÂCHE (défaut), charges À RÉGLER, tableau repliable
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"apr\"]')?.click()"); pg.wait_for_timeout(600)
        a714 = pg.evaluate("() => [!!document.querySelector('.apr-wrap'), document.querySelectorAll('.apr-cfg tbody tr').length > 0, !!document.querySelector('.apr-badge'), document.querySelectorAll('tr.apr-row').length]")
        # v715 : regroupement (titre parent, date la plus tôt), COMMANDE CADRE, QUANTITÉ FIXE sans emballage = à régler
        b715 = pg.evaluate(f"""() => {{ const X = {ins}, I = X.INS, P = document.querySelector('.apr-wrap') ? [...document.querySelectorAll('tr.apr-row')].map(r => r.dataset.d) : [];
            const sk = Object.keys((I.apr || {{}}).cfg || {{}})[0] || ((I.chg || []).find(r => !r.t) || {{}}).des;
            I.apr = I.apr || {{}}; I.apr.grp = P.length > 1 ? [{{ id: 'g1', ds: P.slice(0, 2), d: '' }}] : []; X.insSave(); X.refreshAll(); return P.length; }}""")
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"apr\"]')?.click()"); pg.wait_for_timeout(500)
        g715 = pg.evaluate("() => [document.querySelectorAll('tr.apr-grp').length, [...document.querySelectorAll('.apr-cfg select[data-f=mode] option')].map(o => o.textContent).slice(0, 4).join(',')]")
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.apr.grp = []; X.insSave(); }}")
        check("v715 : approvisionnement — modes PAR TÂCHE, PAR PÉRIODE, QUANTITÉ FIXE, COMMANDE CADRE ; regroupement en titre parent",
              g715[1] == "PAR TÂCHE,PAR PÉRIODE,QUANTITÉ FIXE,COMMANDE CADRE" and (b715 < 2 or g715[0] == 1), [b715, g715])
        pg.evaluate("() => document.querySelector('.bdg-d-tab[data-tab=\"chg\"]')?.click()"); pg.wait_for_timeout(400)
        check("v714 : onglet APPROVISIONNEMENT PRÉVISIONNEL (réglages par charge, À RÉGLER, tableau)", a714 and a714[0] and a714[1] and a714[2], a714)
        # v713 (point 5) : avant un import Excel — fenêtre des en-têtes attendus (★ exigées, COPIER LES EN-TÊTES), ANNULER / CONTINUER
        pg.evaluate("() => document.querySelector('.blk-btn[data-blk=\"client\"][data-act=\"import\"]')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('[data-src=\"file\"]')?.click()"); pg.wait_for_timeout(400)
        i713 = pg.evaluate("() => { const d = document.getElementById('svConf'); return d ? [/EN-TÊTES DE COLONNE SUIVANTS/.test(d.innerText), d.querySelectorAll('.imph-req').length > 0, d.querySelectorAll('[data-cp]').length, !!d.querySelector('[data-go]')] : null; }")
        pg.evaluate("() => document.querySelector('#svConf [data-x]')?.click()"); pg.wait_for_timeout(200)
        check("v713 / v758 : avant l'import Excel, fenêtre des en-têtes attendus — format du budget : BUDGET, DÉLAIS, QUALITÉ (★, COPIER LES EN-TÊTES, CONTINUER)", i713 == [True, True, 3, True], i713)
        # v705 : balayage d'un budget à l'autre dans l'ordre de la liste ; budget à avenants parcouru écran par écran
        pg.evaluate("""() => { window.__kp705 = JSON.stringify(sviInstGet()); const d = { des: [], lot: [], prim: [], sec: [], chg: [], prd: [], links: [], dlp: {} };
            sviInstSet(sviInstGet().concat([{ ref: 'SOLO-1', project: 'SOL', state: 'valide', data: JSON.parse(JSON.stringify(d)) }, { ref: 'AVT-1', project: 'AVT', state: 'valide', data: JSON.parse(JSON.stringify(d)) }, { ref: 'AVT-1-AV1', project: 'AVT', state: 'valide', parent: 'AVT-1', avn: 1, data: JSON.parse(JSON.stringify(d)) }]));
            localStorage.setItem('svi_listmode_v1', 'valid'); window.__sviAvOpen('SOLO-1', null); }"""); pg.wait_for_timeout(1200)
        nav = []
        for k in range(4):
            nav.append(pg.evaluate("() => [((document.getElementById('refTxt') || {}).textContent || '').split(' ').pop(), !!window.__sviBdgNav, (window.__sviBdgOrder || []).indexOf('SOLO-1') >= 0]"))
            pg.evaluate("() => { const o = window.__sviBdgOrder || [], i = o.indexOf('SOLO-1'), j = o.indexOf('AVT-1'); window.__sviBdgOrder = o.filter(x => x !== 'SOLO-1' && x !== 'AVT-1').concat(['SOLO-1', 'AVT-1']); window.__sviBdgNav && window.__sviBdgNav.go(1); }"); pg.wait_for_timeout(1200)
        pg.evaluate("() => { document.getElementById('budgetBackBtn')?.click(); sviInstSet(JSON.parse(window.__kp705)); localStorage.setItem('svi_listmode_v1', 'inst'); }"); pg.wait_for_timeout(600)
        check("v705 : balayage — budget sans avenant puis budget suivant : CONSOLIDÉ, BUDGET INITIAL, AVENANT 1 un par un",
              [n[0] for n in nav] == ["INI", "CNS", "INI", "AV1"] and nav[0][1], nav)
        # v710 : budget ancien (lignes de la base, sans INS) — s'ouvre jusqu'au bout et ← ramène à la liste
        pg.evaluate("() => { document.getElementById('budgetBackBtn')?.click(); }"); pg.wait_for_timeout(500)
        pg.evaluate("() => { window.__rows710 = bdgRows; bdgRows = [{ PRJ: 'OLD', 'DÉSIGNATION': 'X' }]; localStorage.setItem('svi_listmode_v1', 'valid'); localStorage.setItem('svi_lastbdg_v1', 'BDG 26-1001/001'); renderBudgetList(); }"); pg.wait_for_timeout(1200)
        o710 = pg.evaluate("() => [localStorage.getItem('svi_step_v1'), !!document.getElementById('budgetBackBtn')]")
        pg.evaluate("() => document.getElementById('budgetBackBtn')?.click()"); pg.wait_for_timeout(600)
        b710 = pg.evaluate("() => !document.getElementById('budgetBackBtn')")
        pg.evaluate("() => { bdgRows = window.__rows710 || []; localStorage.setItem('svi_listmode_v1', 'inst'); renderBudgetList(); }"); pg.wait_for_timeout(400)
        check("v710 : budget ancien (sans INS) ouvert jusqu'au bout ; ← ramène à la liste", o710 == ["OUVERT", True] and b710, [o710, b710])
        # v749 (ACHATS, étape 1) : règles des articles — doublon (désignation + unité), presque identique, numéro jamais réutilisé
        # (corbeille), DIVERS sans plafond, prix au-dessus du plafond, reprise des charges des budgets, banque d'un RIB, fusion
        a749 = pg.evaluate("""() => { const keepA = localStorage.getItem('svi_ach_art_v1'), keepP = localStorage.getItem('svi_ach_prm_v1');
            localStorage.removeItem('svi_ach_art_v1'); localStorage.removeItem('svi_ach_prm_v1');
            const L = []; const a1 = achArtNew(L, { des: 'ciment cpj 45', u: 't' }), a2 = achArtNew(L, { des: 'divers chantier', u: 'F' });
            const dup = !!achArtDup(L, 'CIMENT  CPJ 45', 'T', null), near = (achArtNear(L, 'CIMANT CPJ 45', 'T', null) || {}).code || '';
            a2.del = '2026-11-01'; const next = achArtNextCode(L);
            const w1 = achArtWhy({ des: 'DIVERS X', u: 'F', pmax: 0 }), w2 = achArtWhy({ des: 'SABLE', u: 'M3', pref: 300, pmax: 200 });
            const keepI = sviInstGet(); sviInstSet(keepI.concat([{ ref: 'ACH-T749', project: 'ACH', state: 'instance', data: { chg: [{ id: 'x1', des: 'sable', u: 'm3', q: 2, p: 150 }, { id: 'x2', des: 'SABLE', u: 'M3', q: 2, p: 250 }] } }]));
            const n = achArtsFromBudgets(L), sab = L.find(a => a.des === 'SABLE'); sviInstSet(keepI);
            const b1 = (achBankOfRib('190 810 21211') || {}).abr, b2 = (achBankOfRib('007 640 000') || {}).abr, b3 = achBankOfRib('999');
            const k = achArtNew(L, { des: 'ACIER', u: 'KG', pref: 0 }), d = achArtNew(L, { des: 'ACIER HA', u: 'KG', pref: 14 }); const m = achArtMerge(L, k.id, [d.id]);
            const out = [a1.code, a1.des, a1.u, a1.tva, dup, near, next, w1, w2, n >= 1, sab ? [sab.u, sab.src, sab.pref] : null, b1, b2, b3, m, k.pref, d.del ? d.mergedInto : ''];
            if (keepA === null) localStorage.removeItem('svi_ach_art_v1'); else localStorage.setItem('svi_ach_art_v1', keepA);
            if (keepP === null) localStorage.removeItem('svi_ach_prm_v1'); else localStorage.setItem('svi_ach_prm_v1', keepP);
            return out; }""")
        check("v749 : ACHATS — articles : doublon refusé, presque identique signalé, numéro jamais réutilisé, DIVERS sans plafond, prix au-dessus du plafond, reprise des charges des budgets, banque d'un RIB, fusion",
              a749[:7] == ["ART-0001", "CIMENT CPJ 45", "T", 20, True, "ART-0001", "ART-0003"] and a749[7] == ["ARTICLE DIVERS : PLAFOND OBLIGATOIRE"] and a749[8] == ["PRIX DE RÉFÉRENCE AU-DESSUS DU PLAFOND"]
              and a749[9] and a749[10] == ["M3", "BUDGETS", 200] and a749[11:14] == ["BP", "AWB", None] and a749[14] == 1 and a749[15] == 14 and a749[16] != "", a749)
        # v759 : scénarios — toucher le nom = CONSULTER (lecture seule, l'actif ne change pas) ; COMPARAISON : FERMER LA COMPARAISON, indicateurs
        # proposés d'office (MONTANT HT, MONTANT TTC, ÉCART TTC AVEC LE SCÉNARIO ACTIF, NOMBRE DE CHARGES) ; fusion de la base scénario par scénario
        s759 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms)); document.getElementById('budgetBackBtn')?.click(); await w(300); localStorage.setItem('svi_listmode_v1', 'inst'); window.__sviAvRet = null; window.__sviAvOpen('TEST-1'); await w(1300); const X = INS_X, I = X.INS; const keep = JSON.stringify({ ver: I.ver || null });
            const d2 = JSON.parse(JSON.stringify(I)); delete d2.ver; delete d2.vfz; I.ver = { L: [{ id: 's1', kind: 'sc', nom: 'SCÉNARIO 1' }, { id: 's2', kind: 'sc', nom: 'SCÉNARIO 2', d: d2, arch: true }], act: 's1', ind: [] };
            const V0 = JSON.parse(JSON.stringify(I.ver)); sviInstSet(sviInstGet().map(x => x.ref === 'TEST-1' ? { ...x, data: { ...(x.data || {}), ver: V0 } } : x)); await sviInstFlush();
            window.__sviAvRet = null; window.__sviAvOpen('TEST-1'); await w(1200);
            const B = document.querySelector('.blk-etp'); if (!B) return 'pas de bloc'; B.querySelector('[data-etab="scn"]').click(); await w(100);
            const nm2 = document.querySelector('#scnTable [data-nm="s2"]'); if (!nm2) return ['pas de nom', (document.getElementById('sviScreenTag') || {}).textContent, document.querySelector('#scnTable') ? document.querySelector('#scnTable').textContent.slice(0, 300) : 'pas de table', !!document.getElementById('svConf')];
            nm2.click(); await w(1200);
            const tag = (document.getElementById('refTxt') || {}).textContent || '', act = ((sviInstGet().find(x => x.ref === 'TEST-1') || {}).data || {}).ver.act;
            document.getElementById('budgetBackBtn')?.click(); await w(400); window.__sviAvRet = null; window.__sviAvOpen('TEST-1'); await w(1200);
            document.querySelector('.blk-etp [data-etab="scn"]').click(); await w(100);
            document.querySelector('#scnTable tr[data-scn="s2"] td:nth-child(2)').click(); await w(200);
            await w(1000); const bar = !!document.querySelector('.scn-cmp-bar'), rows = '', back = / SCN2 \\(CONSULTATION\\)$/.test((document.getElementById('refTxt') || {}).textContent || '');
            document.getElementById('budgetBackBtn')?.click(); await w(400);
            const M = sviMergeData({ ver: { L: [{ id: 'a', arch: false }] } }, { ver: { L: [{ id: 'a', arch: true }] } }, { ver: { L: [{ id: 'a', arch: false }, { id: 'b' }] } }, false, 'X', '');
            const K = JSON.parse(keep); sviInstSet(sviInstGet().map(x => { if (x.ref !== 'TEST-1') return x; const d = { ...(x.data || {}) }; if (K.ver) d.ver = K.ver; else delete d.ver; return { ...x, data: d }; })); await sviInstFlush();
            window.__sviAvRet = null; window.__sviAvOpen('TEST-1'); await w(1000);
            return [/ SCN2 \\(CONSULTATION\\)$/.test(tag), act, bar, rows, back, M.ver.L.map(x => x.id + ':' + !!x.arch).join(',')]; }""".replace("INS_X", ins))
        check("v759 / v790 : toucher un scénario = le consulter (l'actif ne change pas) ; plus de comparatif dans le bloc ; indicateurs proposés d'office ; scénario archivé gardé à la fusion avec la base",
              s759 == [True, "s1", False, "", True, "a:true,b:false"], s759)
        # v771 : fenêtre de SÉLECTION unique (COMPARER, CUMULER, FERMER) ; CUMULER signale les charges en double et s'enregistre comme scénario ;
        # FERMER ramène à l'onglet d'origine ; consolidé = étapes VALIDÉES seulement ; bloc à onglets : hauteur réglable (5 lignes par défaut)
        c771 = pg.evaluate("""async () => { const X = INS_X, I = X.INS, w = ms => new Promise(z => setTimeout(z, ms)), sh = [...document.querySelectorAll('*')].find(e => e.__ins);
            const keep = JSON.stringify({ vfz: I.vfz || null, ver: I.ver || null }), keepT = localStorage.getItem('svi_etp_tab_v1');
            const v = JSON.parse(JSON.stringify(I)); delete v.vfz; delete v.ver; I.vfz = [{ id: 'vx', n: 1, kind: 'MANUELLE', date: '30/10/2026', d: v }];
            sh.__cmpMulti('ver'); await w(150); const pk = document.getElementById('svConf'); if (!pk || !pk.querySelector('[data-cumgo]')) return ['pas de fenêtre', pk ? pk.textContent.slice(0, 200) : null, !!sh.__cmpMulti];
            const r = [pk.querySelector('.svc-t').textContent.trim().split(' — ')[0], !!pk.querySelector('[data-cumgo]'), !!pk.querySelector('.cmpm-close'), !!pk.querySelector('[data-cmpgo]')];
            pk.querySelector('[data-cmpgo]') && 0; const cv = pk.querySelector('[data-cv="v:vx"]'); if (!cv) return ['pas de version', pk.textContent.slice(0, 300)]; if (!cv.checked) { cv.checked = true; cv.dispatchEvent(new Event('change', { bubbles: true })); } await w(50);
            document.querySelector('#svConf [data-cumgo]').click(); await w(300); const cw = document.querySelector('.cmpm-card');
            const nChg = (I.chg || []).filter(x => !x.t && x.des).length;
            r.push(!!cw && /CUMULER/.test(cw.querySelector('.svc-t').textContent), !!cw.querySelector('.frs-why') === (nChg > 0), cw.querySelectorAll('thead th').length);
            const nSc0 = ((I.ver || {}).L || []).filter(x => x.kind === 'sc').length;
            cw.querySelector('[data-cumsv="scn"]').click(); await w(250); document.querySelector('#svConf [data-r="1"]')?.click(); await w(900);
            const I2 = INS_X.INS, sc = ((I2.ver || {}).L || []).filter(x => x.kind === 'sc');
            r.push(sc.length > nSc0 || sc.length >= 2, (I2.chg || []).filter(x => !x.t && x.des).length === 2 * nChg, localStorage.getItem('svi_etp_tab_v1'));
            sh.__cmpMulti('rcl'); await w(150); document.querySelector('#svConf .cmpm-close').click(); await w(150); r.push(localStorage.getItem('svi_etp_tab_v1'));
            r.push(Object.keys(sviAvSelDef([{ ref: 'A', state: 'valide' }, { ref: 'A-AV1', state: 'valide' }, { ref: 'A-AV2', state: 'instance' }])).join(','));
            const pgEl = document.querySelector('.bdg-d-page'); pgEl.style.setProperty('--h-etp', '300px'); const scr = document.querySelector('.blk-etp .etp-pane.on .rec-scroll'); r.push(scr ? getComputedStyle(scr).maxHeight : 'x'); pgEl.style.removeProperty('--h-etp');
            r.push(scr ? getComputedStyle(scr).maxHeight : 'x');
            const K = JSON.parse(keep); const I3 = INS_X.INS; if (K.vfz) I3.vfz = K.vfz; else delete I3.vfz; if (K.ver) I3.ver = K.ver; else delete I3.ver;
            sviInstSet(sviInstGet().map(x => { if (x.ref !== 'TEST-1') return x; const d = { ...(x.data || {}) }; if (K.ver) d.ver = K.ver; else delete d.ver; return { ...x, data: d }; })); await sviInstFlush();
            if (keepT === null) localStorage.removeItem('svi_etp_tab_v1'); else localStorage.setItem('svi_etp_tab_v1', keepT);
            window.__sviAvRet = null; window.__sviAvOpen('TEST-1'); await w(1000); return r; }""".replace("INS_X", ins))
        check("v771 : SÉLECTION unique (COMPARER, CUMULER, ✕ FERMER) ; CUMULER : charges en double signalées, enregistré comme scénario (charges additionnées) ; FERMER ramène à l'onglet ; consolidé = étapes validées ; bloc à onglets à hauteur réglable",
              c771[:4] == ["SÉLECTION", True, True, True] and c771[4:6] == [True, True] and c771[6] == 4 and c771[7:10] == [True, True, "scn"] and c771[10] == "rcl" and c771[11] == "A,A-AV1" and c771[12] == "300px" and c771[13] == "129px", c771)
        # v772 : organisation des blocs — en-têtes DÉTAIL, ÉVOLUTIONS, SUIVI puis rangée d'onglets ; DÉTAIL = 4 onglets ; vues dans le ⋯ du haut
        o772 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms)), pgEl = document.querySelector('.bdg-d-page');
            const ttl = sel => { const e = document.querySelector(sel); return e ? e.textContent.replace(/\\s+/g, ' ').trim() : ''; };
            const r = [ttl('#bdgDetailHead .ttl'), ttl('.blk-etp > .blk-head .ttl'), ttl('.blk-suivi > .blk-head .ttl'), !!document.querySelector('.blk-etp > .blk-tabrow .etp-tabs'), !!document.querySelector('.blk-suivi > .blk-tabrow .rec-tabs'),
              [...document.querySelectorAll('#bdgTabs .bdg-d-tab')].filter(b => getComputedStyle(b).display !== 'none').map(b => b.dataset.tab).join(','), !!document.querySelector('#bdgDetailHead .blk-max-btn')];
            document.getElementById('bdgMore').click(); await w(200); const it = document.querySelector('#blkMenu [data-a="dt-lnk"]'); r.push(!!it);
            if (it) { it.click(); await w(500); r.push(ttl('#bdgDetailHead .ttl')); document.querySelector('#bdgTabs .bdg-d-tab[data-tab="chg"]').click(); await w(400); r.push(ttl('#bdgDetailHead .ttl')); }
            document.getElementById('blkMenu')?.remove(); return r; }""")
        check("v772 : blocs DÉTAIL, ÉVOLUTIONS, SUIVI avec en-tête puis onglets ; DÉTAIL = CHARGES, PRODUITS, QUALITÉ, DÉLAIS ; TABLEAU DE BORD depuis le ⋯ du haut (nom dans l'en-tête)",
              o772[:7] == ["DÉTAIL", "RÉVISIONS", "SUIVI", True, True, "chg,prd,qlt,dly", True] and o772[7] is True and o772[8] == "DÉTAIL — TABLEAU DE BORD" and o772[9] == "DÉTAIL", o772)
        # v773 : ÉVOLUTIONS — cases à cocher ; SCÉNARIOS non validés supprimés, validés (retenus / offerts) archivés, actif intouché ; VERSIONS archivées
        g773 = pg.evaluate("""async () => { const X = INS_X, I = X.INS, w = ms => new Promise(z => setTimeout(z, ms)), sh = [...document.querySelectorAll('*')].find(e => e.__ins);
            const keep = JSON.stringify({ vfz: I.vfz || null, ver: I.ver || null }); const d0 = JSON.parse(JSON.stringify(I)); delete d0.ver; delete d0.vfz;
            I.ver = { L: [{ id: 'a1', kind: 'sc', nom: 'ACTIF' }, { id: 'b2', kind: 'sc', nom: 'BROUILLON', d: d0 }, { id: 'c3', kind: 'sc', nom: 'RETENU', d: d0, of: true }], act: 'a1', ind: [] };
            I.vfz = [{ id: 'v1', n: 1, kind: 'MANUELLE', date: '01/11/2026', d: d0 }]; X.insSave(); X.refreshAll(); await w(300);
            const B = document.querySelector('.blk-etp'); B.querySelector('[data-etab="scn"]').click(); await w(200);
            const cbs = [...document.querySelectorAll('#scnTable .etp-cb')].map(c => c.dataset.id), r = [cbs.join(','), !!document.querySelector('#scnTable .etp-all')];
            ['a1', 'b2', 'c3'].forEach(id => { const c = document.querySelector(`#scnTable .etp-cb[data-id="${id}"]`); if (c) { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); } });
            const p = sh.__etpDel('scn'); await w(200); const ul = document.querySelector('#svConf .svc-list'); r.push(ul ? ul.textContent.replace(/\\s+/g, ' ').trim() : ''); document.querySelector('#svConf [data-r="1"]')?.click(); await p; await w(400);
            const L = (INS_X.INS.ver || {}).L || []; r.push(L.map(x => x.id + (x.arch ? ':A' : '')).join(','));
            B.querySelector('[data-etab="ver"]').click(); await w(200); const vc = document.querySelector('#verTable .etp-cb[data-id="1"]'); if (vc) { vc.checked = true; vc.dispatchEvent(new Event('change', { bubbles: true })); }
            const p2 = sh.__etpDel('ver'); await w(200); document.querySelector('#svConf [data-r="1"]')?.click(); await p2; await w(300);
            r.push(!!((INS_X.INS.vfz || [])[0] || {}).arch);
            const K = JSON.parse(keep), I3 = INS_X.INS; if (K.vfz) I3.vfz = K.vfz; else delete I3.vfz; if (K.ver) I3.ver = K.ver; else delete I3.ver; INS_X.insSave(); INS_X.refreshAll(); await w(200); return r; }""".replace("INS_X", ins))
        check("v773 : ÉVOLUTIONS — cases à cocher ; scénario non validé supprimé, validé archivé, actif intouché ; version archivée",
              g773[0] == "a1,b2,c3" and g773[1] and "SUPPRIMER 1" in g773[2] and "ARCHIVER 1" in g773[2] and g773[3] == "a1,c3:A" and g773[4] is True, g773)
        # v774 : RÉVISIONS ; barre du haut réduite ; ⋯ principal (FIGER en tête, COMPARER / CUMULER…, DISPOSITION PAR DÉFAUT, SUPPRIMER et FERMER en bas) ;
        # ⋯ des blocs par groupes ; colonne SOURCE des versions ; titres des colonnes au-dessus des icônes des lignes
        r774 = pg.evaluate("""async () => { const X = INS_X, I = X.INS, w = ms => new Promise(z => setTimeout(z, ms));
            const r = [document.querySelector('.blk-etp .blk-head .ttl').textContent.trim()];
            r.push([...document.querySelectorAll('.bdg-d-hright > *')].filter(b => b.offsetParent).map(b => b.id).join(','));
            document.getElementById('bdgMore').click(); await w(200);
            const M = [...document.querySelectorAll('#blkMenu > *')].map(x => x.classList.contains('blk-sep') ? '-' : x.textContent.trim()); document.getElementById('blkMenu')?.remove();
            r.push(M[1] === '-' && /^(FIGER|REVENIR|ENREGISTRER)/.test(M[0]) && M[2] === 'COMPARER / CUMULER' && M.slice(-3).join('|').startsWith('-|SUPPRIMER') && M.slice(-1)[0] === 'FERMER' && M[M.indexOf('DISPOSITION PAR DÉFAUT') - 1] === '-');
            document.querySelector('#bdgClientTitle .blk-more').click(); await w(200);
            const C = [...document.querySelectorAll('#blkMenu > *')].map(x => x.classList.contains('blk-sep') ? '-' : x.textContent.trim().replace(/\\d+$/, '')); document.getElementById('blkMenu')?.remove();
            r.push(C.join('|'));
            const keep = JSON.stringify(I.vfz || null); I.vfz = []; X.insSave(); document.querySelector('[data-etab="ver"]')?.click(); await w(50);
            [...document.querySelectorAll('*')].find(e => e.__ins).__verTake(); await w(300);
            r.push([...document.querySelectorAll('#verTable thead th')].map(t => t.textContent.trim()).includes('MONTANT TTC'), ((document.querySelector('#verTable tbody tr.ver-row td') || {}).textContent || '').replace(/^.* /, ''));
            const K = JSON.parse(keep); if (K) I.vfz = K; else delete I.vfz; X.insSave(); X.refreshAll(); await w(200);
            r.push(getComputedStyle(document.querySelector('.bdg-d-page table thead th')).zIndex);
            return r; }""".replace("INS_X", ins))
        check("v774 : RÉVISIONS ; barre ANNULER, RÉTABLIR, PRÉCÉDENT, SUIVANT, ALERTES, FERMER, ⋯ ; ⋯ principal ordonné ; ⋯ de DÉSIGNATIONS CLIENT par groupes ; v780 : référence des versions et MONTANT TTC",
              r774[0] == "RÉVISIONS" and r774[1] == "instUndo,instRedo,instPrev,instNext,instTodo,instClose,bdgMore" and r774[2] is True
              and r774[3].startswith("AGRANDIR|SOUS-DÉTAIL DES PRIX|✕ DÉLIER LES LIGNES COCHÉES|-|Importer|Exporter|Aperçu PDF|-|Copier") and "COMPARATIF" not in r774[3]
              and r774[4] is True and r774[5] == "VR1" and r774[6] == "6", r774)   # v780 : SOURCE annulée — référence en chaîne (… INI VR1) et MONTANT TTC
        # v750 : liste des budgets — colonnes (marge de pliage, RÉFÉRENCE, NATURE, PROJET, INTITULÉ, MONTANT TTC, SAISI LE ; VALIDÉ LE seulement
        # dans les validés), une icône de bascule, plus de cases ni d'impression (corbeille seule), CONSOLIDÉ en ligne de titre, menu de filtre commun,
        # toute la largeur ; suppression depuis la fiche → budget précédent ; IMPRIMER et CUMUL dans le menu ⋯
        pg.evaluate("""() => { document.getElementById('budgetBackBtn')?.click(); window.__kp750 = JSON.stringify(sviInstGet()); const d = () => ({ des: [], lot: [], prim: [], sec: [], chg: [], prd: [], links: [], dlp: {} });
            sviInstSet(sviInstGet().filter(x => !/^(F|X)-/.test(x.ref)).concat([{ ref: 'F-1', project: 'FAM', intitule: 'VILLA', state: 'valide', created: '2026-10-30T10:00', validated: '2026-10-30T11:00', data: d() },
              { ref: 'F-1-AV1', project: 'FAM', intitule: 'VILLA', state: 'instance', created: '2026-10-31T09:00', parent: 'F-1', avn: 1, data: d() },
              { ref: 'X-1', project: 'XA', intitule: 'ECOLE', state: 'instance', created: '2026-10-29T08:00', data: d() }, { ref: 'X-2', project: 'XB', intitule: 'IMMEUBLE', state: 'instance', created: '2026-10-28T08:00', data: d() }]));
            localStorage.setItem('svi_listmode_v1', 'inst'); localStorage.setItem('svi_bdgfold_v1', JSON.stringify(['F-1'])); renderBudgetList(); }"""); pg.wait_for_timeout(500)
        l750 = pg.evaluate("""() => { const T = document.getElementById('budgetListTable'), wr = T.closest('.novapp-budget-table-wrap');
            const hd = [...T.tHead.querySelectorAll('th')].map(th => (th.querySelector('.cf-lab') || th).textContent.trim());
            const row = r => T.querySelector(`tr[data-budget-ref="${r}"]`), cells = r => row(r) ? [...row(r).cells].map(c => c.textContent.trim()) : null;
            const bl = row('X-1').querySelector('.budget-link'), it = row('X-1').cells[3], cs = getComputedStyle(bl);
            return [hd.join('|'), !!document.getElementById('bdgModeSw'), !document.querySelector('.novapp-list-actions'), T.querySelectorAll('input.bdg-cum, [data-print-budget]').length,
              cells('F-1').slice(0, 3).join('|'), cells('F-1-AV1').slice(0, 3).join('|'), !!row('F-1-AV1').querySelector('.budget-link'), !!row('F-1-AV1').querySelector('[data-del-budget]'),
              T.querySelectorAll('tr[data-kid="glob"]').length, cells('X-1')[1], !!row('F-1').querySelector('td.bdg-ref-c [data-fold-bdg]'), !T.querySelector('td.bdg-fold-c, th.bdg-fold-h'),
              cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.fontWeight === getComputedStyle(it).fontWeight && cs.textDecorationLine === 'underline', wr.scrollWidth <= wr.clientWidth + 1]; }""")
        check("v750 / v793 : liste — colonnes dans l'ordre (sans VALIDÉ LE en instance), icône de bascule, ni case CUMUL ni impression (cases de sélection à droite, v793), CONSOLIDÉ en titre, AVENANT 1 dessous (lien PROJET, corbeille), INITIAL, marge de pliage, PROJET souligné sans fond, toute la largeur",
              l750 == ["RÉFÉRENCE|PROJET|INTITULÉ|MONTANT TTC|SAISI LE||", True, True, 0, "⌄FAM F-1 CNS|FAM|VILLA", "FAM F-1 AV1|FAM|VILLA", True, True, 0, "XA", True, True, True, True], l750)   # v780 : plus de NATURE, nature au bout de la référence
        f750 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms)), T = document.getElementById('budgetListTable');
            T.querySelector('.cf-btn[data-col="budget"]').click(); await w(200); const m = document.getElementById('cfMenu'); if (!m) return 'pas de menu';
            const ord = [...m.children].map(e => e.className.split(' ')[0]).filter(c => /cf-(sort|search|cond|list|foot)/.test(c)).join(',');
            [...m.querySelectorAll('[data-cfv]')].filter(i => i.dataset.cfv !== 'FAM').forEach(cb => { cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); });
            m.querySelector('.cf-ok').click(); await w(200); const refs = [...T.tBodies[0].rows].map(r => r.dataset.budgetRef).filter(Boolean).join(',');
            T.querySelector('.cf-btn[data-col="entered"]').click(); await w(200); const ops = [...document.querySelectorAll('#cfMenu .cf-opi')].map(b => b.dataset.op).join(',');
            document.querySelector('#cfMenu .cf-clear').click(); document.querySelector('#cfMenu .cf-x').click();
            T.querySelector('.cf-btn[data-col="budget"]').click(); await w(150); document.querySelector('#cfMenu .cf-clear').click(); document.querySelector('#cfMenu .cf-x')?.click(); await w(150);
            const n = [...T.tBodies[0].rows].filter(r => r.dataset.budgetRef).length;
            T.querySelector('[data-fold-bdg="F-1"]').click(); await w(150); const folded = !T.querySelector('tr[data-budget-ref="F-1-AV1"]');
            T.querySelector('[data-fold-bdg="F-1"]').click(); await w(150);
            document.getElementById('bdgModeSw').click(); await w(300); const T2 = document.getElementById('budgetListTable');
            const val = [document.querySelector('.novapp-list-titlebar h1').textContent.includes('VALIDÉS'), [...T2.tHead.querySelectorAll('th')].some(th => th.textContent.includes('VALIDÉ LE'))];
            document.getElementById('bdgModeSw').click(); await w(300);
            return [ord, refs, ops, n, folded, val]; }""")
        check("v750 / v789 : filtre commun sur la liste (tri, puis condition, puis recherche et cases — ordre Google Sheets, EFFACER), conditions des dates complètes, pliage par la flèche, bascule vers les validés (avec VALIDÉ LE)",
              f750[0] == "cf-sort,cf-sort,cf-cond,cf-search,cf-list,cf-foot" and f750[1].startswith("F-1,F-1-AV1") and f750[2] == ",eq,ne,gt,ge,lt,le,bt" and f750[3] >= 4 and f750[4] and f750[5] == [True, True], f750)
        d750 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms));
            document.querySelector('#budgetListTable tr[data-budget-ref="X-2"] td:nth-child(5)').click(); await w(900);
            document.getElementById('bdgMore')?.click(); await w(200); const mn = ['prt', 'cmp'].map(a => !!document.querySelector(`#blkMenu [data-a="${a}"]`));
            document.querySelector('#blkMenu [data-a="cmp"]')?.click(); await w(300); const d = document.getElementById('svConf');
            const pre = d ? [...d.querySelectorAll('input[data-cv]:checked')].map(i => i.dataset.cv).join(',') : 'pas de fenêtre', go0 = d ? d.querySelector('[data-cumgo]').disabled : null;
            const o1 = d && d.querySelector('[data-cv="o:X-1"]'); if (o1) { o1.checked = true; o1.dispatchEvent(new Event('change', { bubbles: true })); } const go1 = d ? d.querySelector('[data-cumgo]').disabled : null; d && d.querySelector('[data-x]').click();
            document.getElementById('instDel')?.click(); await w(250); document.querySelector('#svConf [data-r="1"]')?.click(); await w(1200);
            return [mn, pre, go0, go1, localStorage.getItem('svi_lastbdg_v1'), !!document.getElementById('budgetBackBtn'), sviInstGet().some(x => x.ref === 'X-2')]; }""")
        check("v750 / v771 : menu ⋯ — IMPRIMER et CUMUL (fenêtre de SÉLECTION : état actuel coché, autre budget au choix, CUMULER grisé sous deux) ; suppression depuis la fiche → le budget précédent de la liste s'ouvre",
              d750 == [[True, True], "cur", True, False, "X-1", True, False], d750)
        pg.evaluate("() => { document.getElementById('budgetBackBtn')?.click(); sviInstSet(JSON.parse(window.__kp750)); localStorage.setItem('svi_listmode_v1', 'inst'); localStorage.removeItem('svi_bdgfold_v1'); renderBudgetList(); }"); pg.wait_for_timeout(400)
        # v751 : menu ☰ — ACHAT se déplie (CONSULTATIONS … ACC, dans l'ordre), BESOIN à part dessous ; ARTICLES ouvre l'écran des achats
        m751 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms)), M = document.getElementById('navMenu');
            const lab = e => e.textContent.trim().replace(/\\s+/g, ' '); const top = [...M.children].filter(e => !e.classList.contains('nav-sub') && !e.classList.contains('nav-sep')).map(e => lab(e).replace('›', '').trim());
            const sub = [...M.querySelectorAll('.nav-sub[data-grp="ach"] > *')].map(lab);
            M.classList.remove('hidden'); M.querySelector('.nav-grp').click(); await w(100); const open = !M.querySelector('.nav-sub').hidden, still = !M.classList.contains('hidden');
            M.querySelector('.nav-sub .nav-off').click(); await w(100); const stay = !M.classList.contains('hidden');
            M.querySelector('.nav-sub .nav-btn[data-ach="art"]').click(); await w(400);
            const r = [top.join(','), sub.join(','), open, still, stay, document.getElementById('ach').classList.contains('active-view'), (document.querySelector('#ach .novapp-list-titlebar h1') || document.querySelector('#ach .section-head h1')).textContent.trim().replace(/ \(.*$/, '')];
            M.querySelector('.nav-grp').click(); document.querySelector('#navMenu .nav-btn[data-view="bdg"]').click(); M.classList.add('hidden'); await w(600); return r; }""")
        check("v751 / v752 : menu ☰ — ordre BDG, ACHAT, BESOIN, PARAMÉTRAGE ; ACHAT dépliable (CONSULTATIONS, DEVIS, COMMANDES, RÉCEPTIONS, FACTURES, PAIEMENTS, FOURNISSEURS, ARTICLES, ACC), BESOIN dessous ; entrées à venir grisées ; ARTICLES ouvre les achats",
              m751 == ["BDG,ACHAT,BESOIN,PARAMÉTRAGE,DONNÉES SOURCE", "TABLEAU DE BORD,CONSULTATIONS,DEVIS,COMMANDES,RETOURS DE COMMANDE,RÉCEPTIONS,RETOURS DE RÉCEPTION,FACTURES,AVOIRS,PAIEMENTS,FOURNISSEURS,ARTICLES,PARAMÈTRES ACHATS,ACC", True, True, True, True, "ARTICLES"], m751)
        # v752 : icône devant chaque entrée du menu ; liste des budgets en gras ; lignes du dessous décalées ; corbeille de la couleur de sa ligne
        k752 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms)); const M = document.getElementById('navMenu');
            const ic = [...M.querySelectorAll('.nav-btn, .nav-grp, .nav-off, .nav-src')].every(b => !!b.querySelector('svg.nav-ic'));
            const d = () => ({ des: [], lot: [], prim: [], sec: [], chg: [], prd: [], links: [], dlp: {} }); window.__kp752 = JSON.stringify(sviInstGet());
            sviInstSet(sviInstGet().filter(x => !/^F-/.test(x.ref)).concat([{ ref: 'F-1', project: 'FAM', state: 'instance', created: '2026-10-30T10:00', data: d() }]));
            sviInstSet(sviInstGet().map(x => x.ref === 'F-1' ? { ...x, state: 'valide' } : x).concat([{ ref: 'F-1-AV1', project: 'FAM', state: 'instance', created: '2026-10-31T09:00', parent: 'F-1', avn: 1, data: d() }]));
            localStorage.setItem('svi_listmode_v1', 'inst'); localStorage.setItem('svi_bdgfold_v1', JSON.stringify(['F-1'])); renderBudgetList(); await w(300);
            const T = document.getElementById('budgetListTable'), top = T.querySelector('tr[data-budget-ref="F-1"]'), kid = T.querySelector('tr[data-budget-ref="F-1-AV1"]');
            const fw = getComputedStyle(kid.cells[2]).fontWeight, pl = [parseFloat(getComputedStyle(top.cells[0]).paddingLeft), parseFloat(getComputedStyle(kid.cells[0]).paddingLeft)];
            const del = kid.querySelector('.bdg-row-del'), same = del && getComputedStyle(del).color === getComputedStyle(kid.cells[2]).color;
            sviInstSet(JSON.parse(window.__kp752)); localStorage.removeItem('svi_bdgfold_v1'); renderBudgetList(); return [ic, fw, pl[1] > pl[0] + 10, same]; }""")
        check("v752 : icônes du menu, liste en gras, lignes du dessous décalées vers la droite, corbeille de la couleur de sa ligne", k752 == [True, "700", True, True], k752)
        # v754 (lot 1) : « ! » devant VALIDÉ LE si validé plus de 24 h après la saisie (raison au toucher ; parent en alerte si une étape l'est),
        # total à côté de TOUT, flèche de pliage dans RÉFÉRENCE (plus de colonne à gauche), PARAMÉTRAGE › COULEURS (couleur d'un état appliquée)
        k754 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms)); window.__kp754 = JSON.stringify(sviInstGet()); const d = () => ({ des: [], lot: [], prim: [], sec: [], chg: [], prd: [], links: [], dlp: {} });
            sviInstSet(sviInstGet().filter(x => !/^(F|L)-/.test(x.ref)).concat([{ ref: 'L-1', project: 'LAT', state: 'valide', created: '2026-10-27T08:00', validated: '2026-10-30T09:00', data: d() },
              { ref: 'L-2', project: 'LAT', state: 'valide', created: '2026-10-27T08:00', validated: '2026-10-27T20:00', data: d() },
              { ref: 'F-1', project: 'FAM', state: 'valide', created: '2026-10-30T10:00', validated: '2026-10-30T11:00', data: d() },
              { ref: 'F-1-AV1', project: 'FAM', state: 'valide', created: '2026-10-28T09:00', validated: '2026-10-31T09:00', parent: 'F-1', avn: 1, data: d() }]));
            localStorage.setItem('svi_listmode_v1', 'valid'); localStorage.setItem('svi_bdgfold_v1', JSON.stringify(['F-1'])); renderBudgetList(); await w(300);
            const T = document.getElementById('budgetListTable'), vi = [...T.tHead.querySelectorAll('th')].findIndex(th => th.textContent.includes('VALIDÉ LE'));
            const vc = r => T.querySelector(`tr[data-budget-ref="${r}"]`).cells[vi], b1 = vc('L-1').querySelector('.val-bang');
            const res = [!!b1 && vc('L-1').textContent.trim().startsWith('!'), !vc('L-2').querySelector('.val-bang'), !!vc('F-1').querySelector('.val-bang'), !!vc('F-1-AV1').querySelector('.val-bang'),
              !!T.querySelector('tr[data-budget-ref="F-1"] td.bdg-ref-c [data-fold-bdg]'), !T.querySelector('.bdg-fold-c')];
            b1 && b1.click(); await w(100); const t = [...document.querySelectorAll('.sv-toast, #svToast, [class*=toast]')].map(e => e.textContent).join(' ');
            res.push(/APRÈS LA SAISIE/.test(t), !document.getElementById('budgetBackBtn'));
            const tot = document.querySelector('#bdgDatePanel .novapp-date-filter'); res.push(!!tot.querySelector('.svi-cnt') && tot.querySelector('.svi-cnt').textContent.trim() !== '');
            document.querySelector('#navMenu .nav-btn[data-view="chs"]').click(); await w(300); document.querySelector('.prm-tab[data-prm="col"]').click(); await w(200);
            const ci = document.querySelector('.prm-col .col-in[data-col="valide"]'); res.push(!!ci && document.querySelectorAll('.prm-col tbody tr').length === 7);   /* v790 : + PARTIELLEMENT ACHEVÉ */
            ci.value = '#123456'; ci.dispatchEvent(new Event('input', { bubbles: true })); ci.dispatchEvent(new Event('change', { bubbles: true })); await w(100);
            document.querySelector('#navMenu .nav-btn[data-view="bdg"]').click(); await w(400);
            res.push(getComputedStyle(document.querySelector('#budgetListTable tr[data-budget-ref="L-2"]').cells[3]).color);
            document.querySelector('#navMenu .nav-btn[data-view="chs"]').click(); await w(200); document.querySelector('.prm-col .col-rst[data-col="valide"]')?.click(); res.push(sviColors().valide);
            document.querySelector('.prm-tab[data-prm="unit"]').click(); document.querySelector('#navMenu .nav-btn[data-view="bdg"]').click(); await w(300);
            sviInstSet(JSON.parse(window.__kp754)); localStorage.setItem('svi_listmode_v1', 'inst'); localStorage.removeItem('svi_bdgfold_v1'); renderBudgetList(); return res; }""")
        check("v754 : « ! » devant VALIDÉ LE au-delà de 24 h (raison au toucher, parent en alerte), total à côté de TOUT, flèche dans RÉFÉRENCE, PARAMÉTRAGE › FORMAT › ÉTATS appliqué puis PAR DÉFAUT",
              k754 == [True, True, True, True, True, True, True, True, True, True, "rgb(18, 52, 86)", "#172033"], k754)
        # v755 (lot 2) : filtre par état de la liste des budgets (ACTIF par défaut, ALERTE, EXPIRÉ, BLOQUÉ, ARCHIVÉ, TOUT, avec les nombres),
        # actions du menu ⋯ (EXPIRER une étape = hors consolidé ; BLOQUER = lecture seule ; ARCHIVER = hors ACTIF), filtre par état des ARTICLES
        k755 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms)); window.__kp755 = JSON.stringify(sviInstGet()); const d = q => ({ des: [{ id: 'd1', des: 'MUR', u: 'M2', q, p: 10, tva: 20 }], lot: [{ id: 'l1', v: 'RDC' }], prim: [], sec: [], chg: [], prd: [], links: [], dlp: {} });
            sviInstSet(sviInstGet().filter(x => !/^[EFGH]-/.test(x.ref)).concat([{ ref: 'F-1', project: 'FAM', state: 'valide', created: '2026-10-30T10:00', validated: '2026-10-30T11:00', data: d(1) },
              { ref: 'F-1-AV1', project: 'FAM', state: 'valide', created: '2026-10-30T12:00', validated: '2026-10-30T13:00', parent: 'F-1', avn: 1, data: d(2) },
              { ref: 'G-1', project: 'GEL', state: 'instance', created: '2026-10-30T10:00', data: d(1) }, { ref: 'H-1', project: 'HIS', state: 'valide', created: '2026-10-20T10:00', validated: '2026-10-20T11:00', data: d(1) }]));
            const keepE = localStorage.getItem('svi_bdgetat_v1'); localStorage.removeItem('svi_bdgetat_v1');
            localStorage.setItem('svi_listmode_v1', 'valid'); localStorage.setItem('svi_bdgfold_v1', JSON.stringify(['F-1'])); renderBudgetList(); await w(300);
            const lab = () => document.querySelector('#bdgDatePanel .novapp-date-filter span').textContent.trim();
            const refs = () => [...document.querySelectorAll('#budgetListTable tbody tr[data-budget-ref]')].map(r => r.dataset.budgetRef);
            const r = [lab()];
            const sumBefore = sviAvMerge('F-1', true).des.reduce((t, x) => t + (+x.q || 0), 0);
            sviInstSet(sviInstGet().map(x => x.ref === 'F-1-AV1' ? { ...x, xp: '2026-11-01' } : x.ref === 'H-1' ? { ...x, arch: '2026-11-01' } : x)); renderBudgetList(); await w(300);
            const sumAfter = sviAvMerge('F-1', true).des.reduce((t, x) => t + (+x.q || 0), 0);
            r.push(refs().includes('H-1'), refs().includes('F-1-AV1'), sumBefore, sumAfter);
            document.querySelector('#bdgDatePanel .novapp-date-filter').click(); await w(150); const M = document.getElementById('sviEtatMenu');
            r.push(M ? [...M.querySelectorAll('button')].map(b => b.textContent.replace(/\\s+/g, ' ').trim()).join('|') : 'pas de menu');
            M.querySelector('[data-k="archive"]').click(); await w(200); r.push(lab(), refs().join(','));
            document.querySelector('#bdgDatePanel .novapp-date-filter').click(); await w(150); document.querySelector('#sviEtatMenu [data-k="expire"]').click(); await w(200);
            r.push(refs().join(','), (document.querySelector('#budgetListTable tr[data-budget-ref="F-1-AV1"]') || {}).className || '');
            document.querySelector('#bdgDatePanel .novapp-date-filter').click(); await w(150); document.querySelector('#sviEtatMenu [data-k="actif"]').click(); await w(200);
            localStorage.setItem('svi_listmode_v1', 'inst'); renderBudgetList(); await w(200);
            document.querySelector('#budgetListTable tr[data-budget-ref="G-1"] td:nth-child(4)').click(); await w(900);
            document.getElementById('bdgMore').click(); await w(200); const acts = ['blk', 'arch'].map(a => !!document.querySelector(`#blkMenu [data-a="${a}"]`));
            document.querySelector('#blkMenu [data-a="blk"]').click(); await w(250); document.querySelector('#svConf [data-r="1"]')?.click(); await w(900);
            r.push(acts, !!(sviInstGet().find(x => x.ref === 'G-1') || {}).blk, window.__sviRO || '');
            document.getElementById('budgetBackBtn')?.click(); await w(400); r.push(refs().includes('G-1'));
            if (keepE === null) localStorage.removeItem('svi_bdgetat_v1'); else localStorage.setItem('svi_bdgetat_v1', keepE);
            sviInstSet(JSON.parse(window.__kp755)); localStorage.removeItem('svi_bdgfold_v1'); renderBudgetList(); await w(200);
            document.querySelector('#navMenu .nav-btn[data-ach="art"]').click(); await w(400);
            const keepA = localStorage.getItem('svi_ach_art_v1'), keepAE = localStorage.getItem('svi_ach_etat_v1'); localStorage.removeItem('svi_ach_art_etat2_v1'); const L = [];
            achArtNew(L, { des: 'SABLE', u: 'M3' }); const b2 = achArtNew(L, { des: 'GRAVIER', u: 'M3' }); b2.actif = false; const b3 = achArtNew(L, { des: 'CHAUX', u: 'T' }); b3.del = '2026-11-01'; achArtsSave(L);
            localStorage.removeItem('svi_ach_etat_v1'); const v = document.getElementById('ach'); v.__achTab('art'); await w(200);
            const eb = v.querySelector('.novapp-date-filter'), aRows = () => [...v.querySelectorAll('#achArtT tbody tr[data-id]')].length;
            const a = [eb ? eb.textContent.replace(/\\s+/g, ' ').trim() : '', aRows()]; eb.click(); await w(150);
            a.push([...document.querySelectorAll('#sviEtatMenu button')].map(b => b.textContent.replace(/\\s+/g, ' ').trim()).join('|'));
            document.querySelector('#sviEtatMenu [data-k="tout"]').click(); await w(200); a.push(aRows()); localStorage.removeItem('svi_ach_art_etat2_v1');
            if (keepA === null) localStorage.removeItem('svi_ach_art_v1'); else localStorage.setItem('svi_ach_art_v1', keepA);
            if (keepAE === null) localStorage.removeItem('svi_ach_etat_v1'); else localStorage.setItem('svi_ach_etat_v1', keepAE);
            document.querySelector('#navMenu .nav-btn[data-view="bdg"]').click(); await w(400); return [r, a]; }""")
        check("v755 : états — ACTIF par défaut (archivé et étape expirée cachés), étape EXPIRÉE hors consolidé, liste des états avec nombres, ARCHIVÉ / EXPIRÉ, BLOQUER (lecture seule, hors ACTIF) ; ARTICLES : ACTIF / INACTIF / CORBEILLE / TOUT",
              k755[0][:5] == ["ACTIF ▾", False, False, 3, 1] and k755[0][5].startswith("✓ACTIF") and "ARCHIVÉ1" in k755[0][5] and k755[0][6:8] == ["ARCHIVÉ ▾", "H-1"]
              and k755[0][8] == "F-1,F-1,F-1-AV1" and "etat-expire" in k755[0][9] and k755[0][10] == [True, True] and k755[0][11] is True and "BLOQUÉ" in k755[0][12] and k755[0][13] is False
              and k755[1][0].startswith("ACTIF ▾") and k755[1][1] == 1 and k755[1][2].startswith("✓ACTIF") and k755[1][3] == 3, k755)
        # v759 : ACHATS — FOURNISSEURS : règles (ICE 15 chiffres et unique, RIB 24 chiffres, principal, document expiré, occasionnel) ; onglet,
        # création par la ligne CRÉER…, fiche (code souligné), changement de RIB confirmé et signalé jusqu'à « RIB VÉRIFIÉ »
        f759 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms)); const keepF = localStorage.getItem('svi_ach_frs_v1'), keepE = localStorage.getItem('svi_ach_frs_etat_v1'); localStorage.removeItem('svi_ach_frs_v1'); localStorage.removeItem('svi_ach_frs_etat_v1');
            const L = []; const a = achFrsNew(L, { nom: 'beton sud' }); a.ice = '001234567000089'; const b2 = achFrsNew(L, { nom: 'X' }); b2.ice = '001234567000089';
            const r1 = [a.code, b2.code, achIceOk('123'), achIceOk(a.ice), (achFrsDupIce(L, b2.ice, b2.id) || {}).code, achRibOk('0076400001234567890123 45')];
            const c = achFrsNew(L, { nom: 'OCC', occ: true }); const wc = achFrsWhy(c, L);
            a.ribs = [{ rib: '007640000123456789012345', p: true }]; a.docf = [{ type: 'ATTESTATION CNSS', no: '1', exp: '2020-01-01' }]; const wa = achFrsWhy(a, L); b2.del = '2026-11-01';
            achFrsSave(L);
            document.querySelector('#navMenu .nav-btn[data-ach="frs"]').click(); await w(400); const v = document.getElementById('ach');
            const h1 = (v.querySelector('.novapp-list-titlebar h1') || v.querySelector('.section-head h1')).textContent.trim(), n0 = v.querySelectorAll('#achFrsT tbody tr[data-id]').length;
            v.querySelector('[data-nvsw]').click(); await w(150); v.querySelector('#achFrsT [data-nvnew]').click(); await w(250); document.querySelector('#svConf .ask-v').value = 'NOUVEAU FRS'; document.querySelector('#svConf [data-ok]').click(); await w(300);
            document.querySelector('.frs-card [data-x]').click(); await w(300);
            /* v800 (document unique 3.6) : le nouveau fournisseur s'ouvre sur sa page ; on revient à la liste */
            const pg800 = !!v.querySelector('.nvp-ref'); v.querySelector('[data-nvp="close"]')?.click(); await w(250); if (!pg800) return 'v800 : page du nouveau fournisseur non ouverte';
            const n1 = achFrs().filter(f => !f.del).length + (v.querySelectorAll('#achFrsT tbody tr[data-id]').length === 1 && /EN INSTANCE/.test((v.querySelector('.novapp-list-titlebar h1') || v.querySelector('.section-head h1')).textContent) ? 0 : 100);
            v.querySelector('[data-nvsw]').click(); await w(200); v.querySelector(`#achFrsT [data-nvo="${a.id}"]`).click(); await w(250);
            const pgOk = /^FOURNISSEUR — BETON SUD/.test((document.getElementById('sviScreenTag') || {}).textContent || '') && /^FRS \\d{2}-\\d{4}\\/\\d{3}$/.test(v.querySelector('.nvp-ref').textContent) && v.querySelectorAll('.nvp-blk').length === 6;
            v.querySelector('[data-nvp="info"]').click(); await w(300); const fc = document.querySelector('.frs-card');
            const secs = fc ? [...fc.querySelectorAll('.frs-st')].map(x => x.textContent.replace(/\\s*\\d+$/, '').split(' ')[0]).join(',') + '|' + [...fc.querySelectorAll('.frs-tabs .rec-tab')].map(x => x.textContent.trim()).join(',') + '|' + [...fc.querySelectorAll('.frs-sec')].filter(x => !x.hidden).length : 'pas de fiche';
            const ri = fc.querySelector('.frs-sub[data-sub="ribs"] .frs-s[data-c="rib"]'); ri.value = '011780000123456789012345'; fc.querySelector('[data-save]').click(); await w(250);
            const cf = document.querySelector('#svConf .svc-t'); const conf = cf ? cf.textContent : ''; document.querySelector('#svConf [data-r="1"]')?.click(); await w(300);
            const a2 = achFrs().find(x => x.id === a.id), sig = !!a2.ribChg && achFrsWhy(a2, achFrs()).some(m => /RIB MODIFIÉ/.test(m)), hist = achHistGet(a.code).some(h => h.a === 'RIB MODIFIÉ');
            v.querySelector('[data-nvp="info"]').click(); await w(300); document.querySelector('.frs-card [data-ribok]').click(); await w(100); document.querySelector('.frs-card [data-save]').click(); await w(250);
            const ok = !achFrs().find(x => x.id === a.id).ribChg;
            if (keepF === null) localStorage.removeItem('svi_ach_frs_v1'); else localStorage.setItem('svi_ach_frs_v1', keepF);
            if (keepE === null) localStorage.removeItem('svi_ach_frs_etat_v1'); else localStorage.setItem('svi_ach_frs_etat_v1', keepE);
            v.__achTab('art'); document.querySelector('#navMenu .nav-btn[data-view="bdg"]').click(); await w(300);
            return [r1, wc.length, wa.join('|'), h1, n0, n1, secs, conf, sig, hist, ok && pgOk]; }""")
        check("v759 : FOURNISSEURS — ICE (15 chiffres, unique), RIB 24 chiffres, occasionnel sans ICE ni RIB, document expiré ; onglet, création, fiche ; changement de RIB confirmé, signalé, noté dans H, puis RIB VÉRIFIÉ",
              f759[0] == ["FRS-0001", "FRS-0002", False, True, "FRS-0001", True] and f759[1] == 0 and "DOCUMENT EXPIRÉ : ATTESTATION CNSS" in f759[2] and "ICE EN DOUBLE" in f759[2]
              and f759[3] == "FOURNISSEURS (VALIDÉS) 2" and f759[4] == 2 and f759[5] == 3 and f759[6] == "IDENTITÉ,FISCAL,QUALIFICATION,ASSURANCES,,COMPTE,RIB,ENCOURS,CAUTIONS,CONDITIONS,COMMANDE,IMPORT,FERMETURES,GARANTIE,TARIFS,FAMILLES,DOCUMENTS,CONTACTS,ÉVALUATIONS,CONTRATS|IDENTITÉ,FISCAL ET LÉGAL,BANQUE ET PAIEMENT,CONDITIONS D'ACHAT,RISQUE ET MOYENS|2"
              and f759[7] == "CHANGEMENT DE RIB" and f759[8] and f759[9] and f759[10], f759)
        # v760 : BESOINS — charges du budget avec leurs tâches, contrôle prévu / déjà demandé, dépassement BLOQUÉ (justifier puis DÉBLOQUER),
        # seuil 90 %, centre SIÈGE hors budget ; menu ☰ › BESOIN, fiche de création (budget › charge › tâche), validation
        n760 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms)); const keepB = localStorage.getItem('svi_ach_bsn_v1'), keepE = localStorage.getItem('svi_ach_bsn_etat_v1'); localStorage.removeItem('svi_ach_bsn_v1'); localStorage.removeItem('svi_ach_bsn_etat_v1');
            const keepI = sviInstGet(); sviInstSet(keepI.concat([{ ref: 'BSN-T1', project: 'BSN', state: 'valide', data: { des: [{ id: 'd1', des: 'MUR', u: 'M2', q: 1, p: 1 }], lot: [{ id: 'l1', v: 'RDC' }], prim: [{ id: 'p1', v: 'MACONNERIE' }], sec: [{ id: 's1', v: 'MACONNERIE' }],
              chg: [{ id: 'c1', des: 'CIMENT', u: 'T', q: 10, p: 100 }], prd: [], links: [{ id: 'L1', des: 'd1', lot: 'l1', prim: 'p1', sec: 's1', prd: [], chg: [{ id: 'c1' }] }] } }]));
            const C = achBdgCharges('BSN-T1'), L = [];
            const b1 = { id: 'n1', ref: 'BSN 26-1101/001', centre: 'CHANTIER', bdg: 'BSN-T1', chg: achKey('CIMENT', 'T'), des: 'CIMENT', u: 'T', q: 6, datePrevue: '2026-11-05', state: 'instance' }; L.push(b1);
            const c1 = achBsnCtl(b1, L), b2 = { ...b1, id: 'n2', q: 5 }; L.push(b2); const w2 = achBsnWhy(b2, L), b3 = { ...b1, id: 'n3', q: 3.5 }; const w3 = achBsnWhy(b3, [b1, b3]);
            b2.deb = { u: 'T', t: '2026-11-01', why: 'X' }; const w2b = achBsnWhy(b2, L), s0 = achBsnCtl({ centre: 'SIÈGE', des: 'PAPIER', q: 1 }, L);
            const r = [C.length, C[0].des, C[0].tasks.join(','), Math.round(C[0].p), Math.round(c1.pct), w2.some(m => /BLOQUÉ/.test(m)), w3.some(m => /SEUIL/.test(m)), w2b.length, s0, achBsnNextRef([b1], new Date(2026, 10, 2))];
            document.querySelector('#navMenu .nav-btn[data-ach="bsn"]').click(); await w(400); const v = document.getElementById('ach');
            r.push((v.querySelector('.novapp-list-titlebar h1') || v.querySelector('.section-head h1')).textContent.trim().replace(/ \\(.*$/, ''));
            achBsnFiche(null, () => v.__achDraw()); await w(200);
            const set = (k, val) => { const i = document.querySelector(`.bsn-card .bsn-x[data-k="${k}"]`); i.value = val; i.dispatchEvent(new Event('change', { bubbles: true })); };
            set('bdg', 'BSN-T1'); await w(50); set('chg', achKey('CIMENT', 'T')); await w(50);
            const fc = document.querySelector('.bsn-card'); const tache = fc.querySelector('.bsn-x[data-k="tache"]').value;
            fc.querySelector('.bsn-x[data-k="q"]').value = '4'; fc.querySelector('.bsn-x[data-k="datePrevue"]').value = '2026-11-10'; fc.querySelector('[data-save]').click(); await w(300);
            const S = achBsn(); r.push(tache, S.length, S[0] && S[0].ref.startsWith('BSN '), v.querySelectorAll('#achBsnT tbody tr[data-id]').length);
            v.querySelector('#achBsnT [data-nvo]').click(); await w(250); v.querySelector('[data-nvp="info"]').click(); await w(200); document.querySelector('.bsn-card [data-valid]').click(); await w(300); r.push(achBsn()[0].state);
            sviInstSet(keepI); if (keepB === null) localStorage.removeItem('svi_ach_bsn_v1'); else localStorage.setItem('svi_ach_bsn_v1', keepB);
            if (keepE === null) localStorage.removeItem('svi_ach_bsn_etat_v1'); else localStorage.setItem('svi_ach_bsn_etat_v1', keepE);
            v.__achTab('art'); document.querySelector('#navMenu .nav-btn[data-view="bdg"]').click(); await w(300); return r; }""")
        check("v760 : BESOINS — charge et tâche du budget, contrôle (60 %), dépassement bloqué puis débloqué, seuil 90 %, SIÈGE hors contrôle, référence BSN ; menu BESOIN, fiche, création, validation",
              n760 == [1, "CIMENT", "RDC › MACONNERIE", 100, 60, True, True, 0, None, "BSN 26-1102/002", "BESOINS", "RDC › MACONNERIE", 1, True, 1, "valide"], n760)
        # v761 : CONSULTATIONS et DEVIS — besoins validés non couverts, plusieurs fournisseurs, réponse → devis, comparatif, motif si pas le
        # moins cher, clôture (besoins couverts, devis retenu / rejeté) ; achat direct sous le seuil
        c761 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms)), K = ['svi_ach_bsn_v1', 'svi_ach_frs_v1', 'svi_ach_caf_v1', 'svi_ach_dvf_v1'], keep = K.map(k => localStorage.getItem(k)); K.forEach(k => localStorage.removeItem(k));
            const F = []; const f1 = achFrsNew(F, { nom: 'ALPHA' }), f2 = achFrsNew(F, { nom: 'BETA' }); achFrsSave(F);
            achBsnSave([{ id: 'b1', ref: 'BSN 26-1101/001', centre: 'SIÈGE', des: 'PAPIER', u: 'U', q: 100, pu: 10, datePrevue: '2026-11-10', state: 'valide' }, { id: 'b2', ref: 'BSN 26-1101/002', centre: 'SIÈGE', des: 'ENCRE', u: 'U', q: 2, pu: 50, datePrevue: '2026-11-10', state: 'valide' }]);
            const r = [achBsnOpen().length];
            const pick = async vals => { await w(150); const pk = [...document.querySelectorAll('.cmpm-pick')].pop(); pk.querySelectorAll('input').forEach(i => { i.checked = vals === 'all' || vals.includes(i.value); }); pk.querySelector('[data-ok]').click(); await w(150); };
            achCafFiche(null, () => 0); await w(200); let c = () => document.querySelector('.caf-card');
            c().querySelector('[data-addbsn]').click(); await pick(['b1']); c().querySelector('[data-addfrs]').click(); await pick('all');
            r.push(c().querySelectorAll('tr[data-i]').length, c().querySelectorAll('tr[data-f]').length);
            c().querySelector('[data-save]').click(); await w(200); r.push(achCaf().length, achBsnOpen().map(b => b.id).join(','));
            const dv = async (f, pu) => { c().querySelector(`[data-mkdvf="${f}"]`).click(); await w(250); const v = [...document.querySelectorAll('.dvf-card')].pop();
              const i = v.querySelector('.dvf-l[data-c="pu"]'); i.value = pu; i.dispatchEvent(new Event('change', { bubbles: true })); await w(50); const v2 = [...document.querySelectorAll('.dvf-card')].pop();
              v2.querySelector('.dvf-x[data-k="refFrs"]').value = 'D-' + pu; v2.querySelector('[data-save]').click(); await w(250); };
            await dv(f1.id, '9'); await dv(f2.id, '11');
            r.push(achDvf().length, !!c().querySelector('.caf-cmp'), (c().querySelector('.caf-cmp .caf-tot') || {}).textContent.includes('★'));
            c().querySelector(`.caf-ret[value="${f2.id}"]`).checked = true; c().querySelector('[data-close]').click(); await w(200); r.push(achCaf()[0].state);
            c().querySelector('.caf-x[data-k="motif"]').value = 'DÉLAI PLUS COURT'; c().querySelector('[data-close]').click(); await w(250); document.querySelector('#svConf [data-r="1"]')?.click(); await w(300);
            const C = achCaf()[0], D = achDvf(); r.push(C.state, (achBsn().find(b => b.id === 'b1') || {}).couvert === C.id, D.map(v => v.state).sort().join(','));
            achBsnFiche('b2', () => 0); await w(200); document.querySelector('.bsn-card [data-direct]').click(); await w(200); r.push(!!(achBsn().find(b => b.id === 'b2') || {}).direct, achBsnOpen().length);
            document.querySelectorAll('#svConf').forEach(x => x.remove());
            K.forEach((k, i) => { if (keep[i] === null) localStorage.removeItem(k); else localStorage.setItem(k, keep[i]); }); return r; }""")
        check("v761 : CONSULTATIONS et DEVIS — besoins non couverts, deux fournisseurs, réponses en devis, comparatif ★, motif exigé, clôture (besoin couvert, devis retenu / rejeté), achat direct",
              c761 == [2, 1, 2, 1, "b2", 2, True, True, "ouverte", "close", True, "rejete,retenu", True, 0], c761)
        # v762 : COMMANDES, RÉCEPTIONS, RETOURS — commande depuis la consultation close, validation (engagement), réception partielle, tolérance,
        # refus remis au chauffeur (retour de réception), retour de commande, SOLDER ; demandeur averti
        m762 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms)), K = ['svi_ach_bsn_v1', 'svi_ach_frs_v1', 'svi_ach_caf_v1', 'svi_ach_dvf_v1', 'svi_ach_cmf_v1', 'svi_ach_rcp_v1', 'svi_ach_rtr_v1'], keep = K.map(k => localStorage.getItem(k)); K.forEach(k => localStorage.removeItem(k));
            const F = []; const f1 = achFrsNew(F, { nom: 'ALPHA' }); achFrsSave(F);
            achBsnSave([{ id: 'b1', ref: 'BSN 26-1101/001', centre: 'CHANTIER', bdg: 'BX-1', chg: 'CIMENT|T', des: 'CIMENT', u: 'T', q: 10, pu: 100, datePrevue: '2026-11-10', state: 'valide', couvert: 'c1', dem: 'ALI' }]);
            achCafSave([{ id: 'c1', ref: 'CAF 26-1101/001', state: 'close', retenu: f1.id, frs: [f1.id], rep: {}, lignes: [{ bsn: 'b1', des: 'CIMENT', u: 'T', q: 10 }] }]);
            achDvfSave([{ id: 'v1', ref: 'DVF 26-1101/001', caf: 'c1', frs: f1.id, state: 'retenu', refFrs: 'X', lignes: [{ bsn: 'b1', des: 'CIMENT', u: 'T', q: 10, pu: 100, tva: 20 }] }]);
            achCafFiche('c1', () => 0); await w(200); document.querySelector('.caf-card [data-mkcmf]').click(); await w(300);
            const r = [achCmf().length, (achCmf()[0] || {}).lignes.length, achN(achCmf()[0].lignes[0].pu)];
            const cm = () => document.querySelector('.cmf-card'); cm().querySelector('[data-valid]').click(); await w(200); document.querySelector('#svConf [data-r="1"]')?.click(); await w(300);
            const C = achCmf()[0]; r.push(C.state, Math.round(achEngage('BX-1', 'CIMENT|T')), Math.round(achCmfTot(C).ttc), /MILLE/.test(frMoney(achCmfTot(C).ttc)));
            cm().querySelector('[data-rcp]').click(); await w(300); let rc = () => [...document.querySelectorAll('.rcp-card')].pop();
            const q = rc().querySelector('.rcp-l[data-c="q"]'); q.value = '6'; rc().querySelector('.rcp-x[data-k="nbl"]').value = 'BL1'; rc().querySelector('[data-save]').click(); await w(300);
            r.push(achRcp().length, achResteQ(achCmf()[0], achCmf()[0].lignes[0]), !!(achBsn()[0] || {}).livre);
            achRcpFiche(null, C.id, () => 0); await w(200); const q2 = rc().querySelector('.rcp-l[data-c="q"]'); q2.value = '5'; rc().querySelector('.rcp-x[data-k="nbl"]').value = 'BL2'; rc().querySelector('[data-save]').click(); await w(200);
            r.push(achRcp().length);
            q2.value = '4'; const st = rc().querySelector('.rcp-l[data-c="st"]'); st.value = 'ref'; st.dispatchEvent(new Event('change', { bubbles: true })); await w(100);
            rc().querySelector('.rcp-l[data-c="q"]').value = '4'; rc().querySelector('.rcp-l[data-c="motif"]').value = 'SACS DÉCHIRÉS'; rc().querySelector('.rcp-x[data-k="nbl"]').value = 'BL2'; rc().querySelector('[data-save]').click(); await w(250);
            const ak = [...document.querySelectorAll('.frs-card')].pop(); ak.querySelector('.ask-v').value = 'HASSAN'; ak.querySelector('[data-ok]').click(); await w(300);
            r.push(achRcp().length, achRtr().filter(x => x.kind === 'rcp').length, achResteQ(achCmf()[0], achCmf()[0].lignes[0]));
            document.querySelectorAll('.rcp-card').forEach(x => x.closest('#svConf, .svc-back, div')?.remove && 0);
            achCmfFiche(C.id, () => 0); await w(250); [...document.querySelectorAll('.cmf-card')].pop().querySelector('[data-solde]').click(); await w(250);
            const qw = [...document.querySelectorAll('.frs-card')].pop(); qw.querySelector('[data-ok]').click(); await w(300);
            r.push(achCmf()[0].state, achRtr().filter(x => x.kind === 'cmd').length, achResteQ(achCmf()[0], achCmf()[0].lignes[0]));
            document.querySelectorAll('#svConf').forEach(x => x.remove());
            K.forEach((k, i) => { if (keep[i] === null) localStorage.removeItem(k); else localStorage.setItem(k, keep[i]); }); return r; }""")
        check("v762 : COMMANDES et RÉCEPTIONS — commande depuis la consultation, validation et engagement, montant en lettres, réception partielle, tolérance, refus remis au chauffeur, SOLDER",
              m762 == [1, 1, 100, "valide", 1000, 1200, True, 1, 4, True, 1, 2, 1, 4, "solde", 1, 0], m762)
        # v763 : FACTURES, AVOIRS, PAIEMENTS — avance versée, facture depuis la commande (reçu non facturé), doublon, écart accepté, copie,
        # bon à payer, avance imputée, avoir déduit, chèque émis puis rejeté (la facture redevient à payer), échéance par les conditions
        f763 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms)), K = ['svi_ach_bsn_v1', 'svi_ach_frs_v1', 'svi_ach_cmf_v1', 'svi_ach_rcp_v1', 'svi_ach_rtr_v1', 'svi_ach_faf_v1', 'svi_ach_avf_v1', 'svi_ach_paf_v1'], keep = K.map(k => localStorage.getItem(k)); K.forEach(k => localStorage.removeItem(k));
            const last = s => [...document.querySelectorAll(s)].pop(), conf = async () => { document.querySelector('#svConf [data-r="1"]')?.click(); await w(250); };
            const F = []; const f1 = achFrsNew(F, { nom: 'ALPHA' }); f1.cond = '30 JOURS'; f1.ice = '001234567000089'; f1.ifisc = '1234567'; achFrsSave(F);
            achCmfSave([{ id: 'm1', ref: 'CMF 26-1101/001', frs: f1.id, state: 'valide', avT: 'mt', avV: 200, rem: 0, frais: 0, lignes: [{ id: 'l1', des: 'CIMENT', u: 'T', q: 10, pu: 100, tva: 20 }] }]);
            achRcpSave([{ id: 'r1', ref: 'RCP 1', cmf: 'm1', frs: f1.id, nbl: 'BL1', state: 'valide', lignes: [{ cl: 'l1', des: 'CIMENT', u: 'T', q: 6, st: 'ok' }] }]);
            const r = [];
            /* avance depuis la commande */
            achCmfFiche('m1', () => 0); await w(200); last('.cmf-card').querySelector('[data-avpay]').click(); await w(250);
            let pa = last('.paf-card'); r.push(achN(pa.querySelector('.pa-x[data-k="mt"]').value)); const md = pa.querySelector('.pa-x[data-k="mode"]'); md.value = 'ESPÈCES'; md.dispatchEvent(new Event('change', { bubbles: true })); await w(100);
            last('.paf-card').querySelector('[data-valid]').click(); await w(200); await conf();
            r.push(achPaf().length, achPaf()[0].state, achAvVerse('m1'));
            document.querySelectorAll('.paf-card, .cmf-card').forEach(x => x.closest('.svc-back, .svi-win, div')?.remove());
            /* facture depuis la commande */
            achCmfFiche('m1', () => 0); await w(200); last('.cmf-card').querySelector('[data-fac]').click(); await w(250);
            let fa = () => last('.faf-card'); r.push(fa().querySelectorAll('.fa-l[data-c="q"]').length, achN(fa().querySelector('.fa-l[data-c="q"]').value), achN(fa().querySelector('.fa-x[data-k="avImp"]').value));
            fa().querySelector('.fa-x[data-k="num"]').value = 'FA-77'; const df = fa().querySelector('.fa-x[data-k="dFac"]'); df.value = '2026-10-01'; df.dispatchEvent(new Event('change', { bubbles: true })); await w(100);
            r.push(fa().querySelector('.fa-x[data-k="ech"]').value);
            const tt = fa().querySelector('.fa-x[data-k="sTtc"]'); tt.value = '725'; tt.dispatchEvent(new Event('change', { bubbles: true })); await w(100);
            fa().querySelector('[data-bap]').click(); await w(200); r.push(achFaf().length === 0 || achFaf()[0].state !== 'bap');
            const dt = new DataTransfer(); dt.items.add(new File(['x'], 'fa.png', { type: 'image/png' })); const cp = fa().querySelector('.fa-cp'); cp.files = dt.files; cp.dispatchEvent(new Event('change', { bubbles: true })); await w(50);
            fa().querySelector('[data-ecok]').click(); await w(200); const ak = last('.frs-card'); ak.querySelector('.ask-v').value = 'ARRONDI FOURNISSEUR'; ak.querySelector('[data-ok]').click(); await w(300);
            fa().querySelector('[data-bap]').click(); await w(200); await conf();
            const FA = achFaf()[0]; r.push(FA.state, Math.round(achFafTot(FA).net), !!FA.copie, achFafWhy(FA).filter(x => /EN DOUBLE/.test(x)).length);
            /* doublon de numéro */
            achFafFiche(null, { cmf: 'm1' }, () => 0); await w(200); fa().querySelector('.fa-x[data-k="num"]').value = 'fa-77'; fa().querySelector('.fa-x[data-k="dFac"]').value = '2026-10-02'; fa().querySelector('[data-save]').click(); await w(150);
            r.push(achFaf().length); fa().querySelector('[data-x]').click(); await w(100);
            /* avoir 25 */
            const AV = achAvf(); AV.push({ id: 'a1', ref: 'AVF 1', frs: f1.id, num: 'AV-1', ht: 25, tva: 0, ttc: 25, motif: 'REMISE', state: 'valide' }); achAvfSave(AV);
            /* paiement depuis la facture, avoir déduit, chèque */
            achFafFiche(FA.id, null, () => 0); await w(200); fa().querySelector('[data-pay]').click(); await w(250);
            pa = last('.paf-card'); r.push(achN(pa.querySelector('.pa-a').value));
            const dd = pa.querySelector('.pa-d'); dd.value = '25'; dd.dispatchEvent(new Event('change', { bubbles: true })); await w(100);
            const m2 = last('.paf-card').querySelector('.pa-x[data-k="mode"]'); m2.value = 'CHÈQUE'; m2.dispatchEvent(new Event('change', { bubbles: true })); await w(100);
            last('.paf-card').querySelector('[data-valid]').click(); await w(150); r.push(achPaf().length);
            last('.paf-card').querySelector('.pa-x[data-k="num"]').value = '0012345'; last('.paf-card').querySelector('[data-valid]').click(); await w(200); await conf();
            const P2 = achPaf().find(p => p.type === 'reglement'); r.push(P2.state, achN(P2.mt), Math.round(achFafReste(achFaf()[0])), achFafEtat(achFaf()[0]), Math.round(achAvfReste(achAvf()[0])));
            last('.paf-card').querySelector('[data-rej]').click(); await w(200); const ak2 = last('.frs-card'); ak2.querySelector('.ask-v').value = 'SANS PROVISION'; ak2.querySelector('[data-ok]').click(); await w(300);
            r.push(achPaf().find(p => p.type === 'reglement').state, Math.round(achFafReste(achFaf()[0])), Math.round(achAvfReste(achAvf()[0])));
            document.querySelectorAll('#svConf').forEach(x => x.remove());
            K.forEach((k, i) => { if (keep[i] === null) localStorage.removeItem(k); else localStorage.setItem(k, keep[i]); }); return r; }""")
        check("v763 : FACTURES, AVOIRS, PAIEMENTS — avance, facture depuis la commande, échéance, écart accepté, bon à payer, doublon, avoir déduit, chèque rejeté",
              f763 == [200, 1, "encaisse", 200, 1, 6, 200, "2026-10-31", True, "bap", 525, True, 0, 1, 525, 1, "emis", 500, 0, "PAYÉE", 0, "rejete", 525, 25], f763)
        # v764 : ARTICLES au format du budget — ligne CRÉER… → fenêtre, l'article naît EN INSTANCE (liste en instance, rouge, corbeille),
        # page (nom → informations, bloc DOCUMENTS / TAF / OBSERVATIONS, ⋯ VALIDER et UNITÉ DE CONVERSION, devis liés), ‹ ›, filtre par date
        a764 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms)), K = ['svi_ach_art_v1', 'svi_ach_dvf_v1', 'svi_ach_frs_v1', 'svi_ach_art_mode_v1', 'svi_ach_art_etat2_v1'], keep = K.map(k => localStorage.getItem(k)); K.forEach(k => localStorage.removeItem(k));
            const L = []; const s1 = achArtNew(L, { des: 'SABLE', u: 'M3', cat: 'MATERIAUX STOCKABLE' }); s1.cree = '2026-10-13T08:00:00Z'; const s2 = achArtNew(L, { des: 'GRAVIER', u: 'M3', cat: 'MATERIAUX STOCKABLE' }); s2.cree = '2026-10-14T08:00:00Z'; achArtsSave(L);
            const F = []; const f1 = achFrsNew(F, { nom: 'AFRA' }); achFrsSave(F); achDvfSave([{ id: 'v1', ref: 'DVF 1', frs: f1.id, state: 'recu', lignes: [{ des: 'SABLE', u: 'M3', q: 5, pu: 100, tva: 20 }] }]);
            const v = document.getElementById('ach'); document.querySelector('#navMenu .nav-btn[data-ach="art"]').click(); await w(300);
            const r = [(v.querySelector('.novapp-list-titlebar h1') || v.querySelector('.section-head h1')).textContent.trim(), v.querySelectorAll('#achArtT tbody tr[data-id]').length, v.querySelectorAll('.novapp-date-item').length];
            v.querySelector('.novapp-date-item').click(); await w(150); r.push(v.querySelectorAll('#achArtT tbody tr[data-id]').length); v.querySelector('.novapp-date-item').click(); await w(150);
            v.querySelector('[data-nvsw]').click(); await w(150); v.querySelector('#achArtT [data-nvnew]').click(); await w(200); const c = document.querySelector('#svConf');
            c.querySelector('.art-x[data-k="des"]').value = 'CIMENT CPJ45'; c.querySelector('.art-x[data-k="u"]').value = 'T'; c.querySelector('.art-x[data-k="cat"]').value = 'MATERIAUX STOCKABLE'; c.querySelector('[data-save]').click(); await w(300);
            /* v800 (document unique 3.6) : le nouvel article s'ouvre sur sa page ; on revient à la liste */
            if (!v.querySelector('.nvp-ref')) return 'v800 : page du nouvel article non ouverte'; document.querySelector('#svConf')?.remove(); v.querySelector('[data-nvp="close"]')?.click(); await w(250);
            const A = achArts().find(a => a.des === 'CIMENT CPJ45');
            r.push(!!A && A.st, (v.querySelector('.novapp-list-titlebar h1') || v.querySelector('.section-head h1')).textContent.trim(), v.querySelectorAll('#achArtT tbody tr[data-id]').length, !!v.querySelector('.nv-inst [data-nvdel]'), !!v.querySelector('[data-nvnew]'));
            v.querySelector(`[data-nvo="${A.id}"]`).click(); await w(250);
            r.push(/^ARA \\d{2}-\\d{4}\\/0\\d[1-9]$/.test(v.querySelector('.nvp-ref').textContent) ? 'ART-0003' : v.querySelector('.nvp-ref').textContent, !!v.querySelector('.nvp.bdg-inst-instance'), v.querySelectorAll('.nvp-rec .rec-tab').length);
            v.querySelector('[data-nvr="obs"]').click(); await w(100); v.querySelector('[data-nvradd]').click(); await w(200);
            document.querySelector('#svConf .nr-t').value = 'livrer avant 10h'; document.querySelector('#svConf .nr-i').checked = true; document.querySelector('#svConf [data-ok]').click(); await w(250);
            r.push(obsAlertCount('ACH-' + A.code), /AVANT 10H/.test(v.querySelector('.nvp-rec').textContent));
            v.querySelector('[data-nvp="more"]').click(); await w(150); r.push([...document.querySelectorAll('#blkMenu button')].map(b => b.textContent.trim()).join('|'));
            document.querySelector('#blkMenu [data-a="cv"]').click(); await w(200); const cv = document.querySelector('#svConf'); cv.querySelector('[data-add]').click(); await w(100);
            const cvv = document.querySelector('#svConf'); cvv.querySelector('.cv-x[data-c="u"]').value = 'SAC'; cvv.querySelector('.cv-x[data-c="r"]').value = '20'; cvv.querySelector('[data-save]').click(); await w(250);
            r.push(JSON.stringify(achArts().find(a => a.id === A.id).cv));
            v.querySelector('[data-nvp="more"]').click(); await w(150); document.querySelector('#blkMenu [data-a="val"]').click(); await w(250); document.querySelector('#svConf [data-r="1"]')?.click(); await w(300);
            r.push(achArts().find(a => a.id === A.id).st, !v.querySelector('.nvp.bdg-inst-instance'));
            v.querySelector('[data-nvp="close"]').click(); await w(200); r.push((v.querySelector('.novapp-list-titlebar h1') || v.querySelector('.section-head h1')).textContent.trim());
            v.querySelector(`[data-nvo="${s1.id}"]`).click(); await w(250); r.push([...v.querySelectorAll('.nvp-blk')].some(b => b.textContent.includes('DVF 1')));
            const t0 = v.querySelector('.nvp-ref').textContent; v.querySelector('[data-nvp="next"]').click(); await w(200); r.push(t0 !== v.querySelector('.nvp-ref').textContent);
            v.__achTab('art'); await w(150); r.push(!v.querySelector('.nvp'));
            K.forEach((k, i) => { if (keep[i] === null) localStorage.removeItem(k); else localStorage.setItem(k, keep[i]); });
            document.querySelector('#navMenu .nav-btn[data-view="bdg"]').click(); await w(300); return r; }""")
        check("v764 : ARTICLES au format du budget — listes EN INSTANCE / VALIDÉS, dates, création par fenêtre (en instance, corbeille), page : bloc DOC / TAF / OBS, ⋯ VALIDER et UNITÉ DE CONVERSION, devis liés, ‹ ›",
              a764 == ["ARTICLES (VALIDÉS) 2", 2, 2, 1, "instance", "ARTICLES (EN INSTANCE) 1", 1, True, True, "ART-0003", True, 3, 1, True,
                       "VALIDER|UNITÉ DE CONVERSION|BUDGETS (0)|APERÇU|METTRE À LA CORBEILLE|FERMER", '[{"u":"SAC","r":20}]', "valide", True, "ARTICLES (VALIDÉS) 3", True, True, True], a764)
        # v765 : toutes les listes des achats au format du budget — pas d'onglets, titre EN INSTANCE / VALIDÉS + bascule, dates, corbeille = ANNULER
        l765 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms)), K = ['svi_ach_caf_v1', 'svi_ach_caf_mode_v1', 'svi_ach_caf_etat2_v1'], keep = K.map(k => localStorage.getItem(k)); K.forEach(k => localStorage.removeItem(k));
            achCafSave([{ id: 'c1', ref: 'CAF 1', state: 'ouverte', cree: '2026-10-30T10:00:00Z', lignes: [], frs: [] }, { id: 'c2', ref: 'CAF 2', state: 'close', cree: '2026-10-20T10:00:00Z', valide: '2026-10-25T10:00:00Z', lignes: [], frs: [] }]);
            const v = document.getElementById('ach'); document.querySelector('#navMenu .nav-btn[data-ach="caf"]').click(); await w(300);
            const h = () => (v.querySelector('.novapp-list-titlebar h1') || v.querySelector('.section-head h1')).textContent.replace(/\\s+/g, ' ').trim();
            const r = [getComputedStyle(v.querySelector('.ach-tabs')).display, h(), v.querySelectorAll('#achCafT tbody tr[data-id]').length, !!v.querySelector('.novapp-date-item'), !v.querySelector('.ach-hh'), !!document.getElementById('sviScreenTag')];
            v.querySelector('[data-nvsw]').click(); await w(200); r.push(h(), !!v.querySelector('.nv-inst [data-nvdel]'));
            v.querySelector('[data-nvdel]').click(); await w(200); document.querySelector('#svConf [data-r="1"]')?.click(); await w(250);
            r.push(achCaf().find(c => c.id === 'c1').state);
            v.querySelector('[data-nvo]').click(); await w(250); v.querySelector('[data-nvp="info"]')?.click(); await w(200); r.push(!!document.querySelector('.caf-card') && !!v.querySelector('.nvp-ref')); document.querySelector('.caf-card [data-x]')?.click(); await w(150); v.querySelector('[data-nvp="close"]')?.click(); await w(150);
            K.forEach((k, i) => { if (keep[i] === null) localStorage.removeItem(k); else localStorage.setItem(k, keep[i]); });
            document.querySelector('#navMenu .nav-btn[data-view="bdg"]').click(); await w(300); return r; }""")
        check("v765 : listes des achats au format du budget — sans onglets, titre EN INSTANCE / VALIDÉS avec nombre et bascule, dates, sans H, sans étiquette du budget ; corbeille = ANNULÉ ; ligne → fiche",
              l765[0] == "none" and l765[1].startswith("CONSULTATIONS (VALIDÉS) 1") and l765[2:6] == [1, True, True, False] and l765[6].startswith("CONSULTATIONS (EN INSTANCE) 1") and l765[7] is True and l765[8:] == ["annule", True], l765)
        # v767 : import des achats de NovApp — fichier JSON, remplacement (copie de sécurité), besoins F26 = SIÈGE, ancienne référence dans H
        n767 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms)), K = Object.values(ACH_K).concat(['svi_ach_nov_v1', 'svi_ach_backup_v1']), keep = K.map(k => localStorage.getItem(k));
            const D = { src: 'NOVAPP', art: [{ id: 'A1', code: 'ART-0001', des: 'SABLE', u: 'M3', st: 'valide', cree: '2025-12-02T12:00:00', val: '2025-12-02T12:00:00' }], frs: [{ id: 'F1', code: 'FRS-0001', nom: 'AFRA', ribs: [], cree: '2025-12-02T12:00:00' }],
              bsn: [{ id: 'N1', ref: 'BSN 25-1130/001', prj: 'F26', des: 'TVA', u: 'U', q: 1, state: 'valide', cree: '2025-11-30T12:00:00', datePrevue: '2025-12-02' }, { id: 'N2', ref: 'BSN 25-1130/002', prj: 'ZZZ', des: 'SABLE', u: 'M3', q: 2, state: 'valide', cree: '2025-11-30T12:00:00', datePrevue: '2025-12-02' }],
              caf: [], dvf: [], cmf: [{ id: 'M1', ref: 'CMF 25-1202/001', frs: 'F1', state: 'valide', cree: '2025-12-02T12:00:00', lignes: [{ id: 'l1', des: 'SABLE', u: 'M3', q: 2, pu: 100, tva: 20, bsn: 'N2' }] }], rcp: [], faf: [], paf: [],
              nov: { 'CMF 25-1202/001': { o: 'CMF 25-1202/099', h: [['2025-12-02T12:00:00', 'CRÉATION']] } }, prm: { cat: ['SERVICES'] } };
            const f = new File([JSON.stringify(D)], 'novapp-achats.json', { type: 'application/json' });
            const p = achNovImport(f, () => 0); await w(200); [...document.querySelectorAll('#svConf button')].find(b => b.textContent.trim() === 'IMPORTER').click(); await p; await w(200);
            const r = [achArts().length, achCmf()[0].ref, achBsn().find(b => b.id === 'N1').centre, achBsn().find(b => b.id === 'N2').centre, !!localStorage.getItem('svi_ach_backup_v1'),
              achHistGet('CMF 25-1202/001')[0].d, SVI_SHARE_RX.test('svi_ach_nov_v1')];
            K.forEach((k, i) => { if (keep[i] === null) localStorage.removeItem(k); else localStorage.setItem(k, keep[i]); }); return r; }""")
        check("v767 : import NovApp — fichier JSON, données remplacées (copie de sécurité), F26 = SIÈGE, besoin sans budget gardé, ancienne référence dans H, partagé par la base",
              n767 == [1, "CMF 25-1202/001", "SIÈGE", "CHANTIER", True, "CMF 25-1202/099", True], n767)
        # v786 / v788 → v796 (document unique 6.8) : MASQUER / AFFICHER LES COLONNES dans PARAMÉTRAGE › FORMAT › COLONNES, plus dans les ⋯ ;
        # une fenêtre (cochée = affichée), au moins une colonne ; un seul choix par tableau (EN INSTANCE et VALIDÉS)
        c786 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms)), keep = localStorage.getItem('svi_colh_v1');
            document.querySelector('#navMenu .nav-btn[data-view="bdg"]')?.click(); await w(300);
            const T = () => document.getElementById('budgetListTable'), labs = () => [...document.querySelectorAll('#blkMenu button')].map(b => b.textContent.trim());
            const more = () => [...document.querySelectorAll('.novapp-list-shell .nvl-more')].find(b => b.offsetParent); const r = [];
            more().click(); await w(150); r.push(labs().filter(l => /COLONNES/.test(l)).join('|')); document.getElementById('blkMenu')?.remove();
            await w(500); const id = sviColhInfo(T()).id;
            const open = async () => { document.querySelector('#navMenu .nav-btn[data-view="chs"]')?.click(); await w(300); sviParamTabs();
              document.querySelector('#chs .prm-rub[data-rub="fmt"]').click(); await w(100); document.querySelector('#chs .prm-tab[data-prm="colh"]').click(); await w(150);
              const row = document.querySelector(`#chs .prm-colh tr[data-colh="${id}"]`); r.push(row ? row.textContent.includes('LISTE DES BUDGETS') : 'pas de ligne'); row.click(); await w(150); };
            await open(); const ins = [...document.querySelectorAll('#svConf .colh-r input')]; r.push(ins.length > 1 && ins.every(i => i.checked));
            ins.forEach(i => { i.checked = false; }); document.querySelector('#svConf [data-ok]').click(); await w(100);
            r.push(!document.querySelector('#svConf .colh-err').hidden);
            ins.forEach((i, j) => { i.checked = j !== 0; }); document.querySelector('#svConf [data-ok]').click(); await w(200);
            document.querySelector('#navMenu .nav-btn[data-view="bdg"]')?.click(); await w(400);
            const th0 = T().tHead.rows[0].cells[0]; r.push(getComputedStyle(th0).display, T().tBodies[0].rows[0]?.cells[0]?.classList.contains('svi-colh'));
            await open(); r.push([...document.querySelectorAll('#svConf .colh-r input')].filter(i => !i.checked).length);
            document.querySelectorAll('#svConf .colh-r input').forEach(i => { i.checked = true; }); document.querySelector('#svConf [data-ok]').click(); await w(200);
            document.querySelector('#navMenu .nav-btn[data-view="bdg"]')?.click(); await w(400);
            r.push(getComputedStyle(T().tHead.rows[0].cells[0]).display !== 'none');
            if (keep === null) localStorage.removeItem('svi_colh_v1'); else localStorage.setItem('svi_colh_v1', keep); return r; }""")
        check("v796 : MASQUER / AFFICHER LES COLONNES dans PARAMÉTRAGE › FORMAT › COLONNES (plus dans les ⋯) — fenêtre (cochée = affichée), au moins une colonne, colonne masquée retrouvée",
              c786 == ["", True, True, True, "none", True, True, 1, True], c786)
        # v788 : ligne CRÉER juste au-dessus du TOTAL ; DÉLAIS : Gantt seulement en plein écran
        g788 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms)); const r = [];
            if (!document.querySelector('.bdg-d-page')) { document.querySelector('#navMenu .nav-btn[data-view="bdg"]')?.click(); await w(300); window.__sviAvRet = null; window.__sviAvOpen && window.__sviAvOpen('TEST-1'); await w(2000); document.querySelectorAll('#svConf').forEach(x => x.remove()); }
            if (!document.querySelector('.bdg-d-page')) return 'pas de budget';
            document.querySelector('.bdg-d-tab[data-tab="chg"]')?.click(); await w(400);
            const t = document.querySelector('table.ins-table[data-ik="chg"]'), nr = t && t.querySelector('tr.ins-new td');
            r.push(!!(t && t.tFoot && nr) && nr.style.bottom === Math.round(t.tFoot.getBoundingClientRect().height) + 'px');
            document.documentElement.removeAttribute('data-dly-all');
            document.querySelector('.bdg-d-tab[data-tab="dly"]')?.click(); await w(600);
            const vis = s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.offsetParent !== null; };
            r.push(vis('.dlyg-l'), vis('#dlyGantt'));
            document.documentElement.setAttribute('data-dly-all', '1'); await w(200); return r; }""")
        check("v788 : ligne CRÉER posée juste au-dessus du TOTAL ; DÉLAIS hors plein écran = tableau seul (pas de Gantt)", g788 == [True, True, False], g788)
        # v789 : défaut grave — après une 2e ouverture, toucher le signe d'un groupe ne redessine plus avec le budget ouvert avant ;
        # noms des groupes par ordre de création (GROUPE 1, GROUPE 1.1)
        g789 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms)); const X0 = () => { const s = [...document.querySelectorAll('*')].find(e => e.__ins); return s && s.__ins; };
            window.__sviAvRet = null; window.__sviAvOpen('TEST-1'); await w(1500); document.querySelectorAll('#svConf').forEach(x => x.remove());
            window.__sviAvRet = null; window.__sviAvOpen('TEST-1'); await w(1500); document.querySelectorAll('#svConf').forEach(x => x.remove());
            const X = X0(); if (!X) return 'pas de budget'; const I = X.INS, keep = JSON.stringify(I.lot);
            I.lot = [{ id: 'q1', v: 'ETAGE 1' }, { id: 'q2', v: 'NIVEAU 22 / NIVEAU 21 / ZONE A' }, { id: 'q3', v: 'NIVEAU 22 / ZONE B' }, { id: 'q4', v: 'RDC NOUVEAU' }];
            X.insSave(); X.refreshAll(); await w(400);
            const names = () => [...document.querySelectorAll('.ins-hcol[data-ik="lot"] .ins-li')].map(li => { const i = li.querySelector('input.lot-gname, input.ins-in'); return i ? i.value : ''; }).filter(Boolean).join('|');
            const n0 = names(); const f = document.querySelector('.ins-hcol[data-ik="lot"] .lot-fold'); f && f.click(); await w(400); const n1 = names();
            f && document.querySelector('.ins-hcol[data-ik="lot"] .lot-fold')?.click(); await w(300);
            const grp = [...document.querySelectorAll('.ins-hcol[data-ik="lot"] input.lot-gname')].map(i => i.value).join('|');
            I.lot = JSON.parse(keep); X.insSave(); X.refreshAll(); await w(300);
            return [n0.includes('RDC NOUVEAU'), n1.includes('RDC NOUVEAU'), grp]; }""")
        check("v789 : toucher le signe d'un groupe garde le budget ouvert (pas celui d'avant) ; groupes nommés GROUPE 1, GROUPE 1.1",
              g789 == [True, True, "GROUPE 1|GROUPE 1.1"], g789)
        # v791 (point 24) : TEST DE CONFORMITÉ au DOCUMENT UNIQUE DE FORME — traits de gauche, hauteurs communes des onglets,
        # pas de « AUCUN », palette appliquée (et APPLIQUER À), ⋯ qui se referme au 2e toucher
        k791 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms)); const r = [];
            if (!document.querySelector('.bdg-d-page')) { window.__sviAvRet = null; window.__sviAvOpen('TEST-1'); await w(1500); }
            document.querySelectorAll('#svConf').forEach(x => x.remove());
            const blks = [...document.querySelectorAll('.bdg-d-page .bdg-d-block-title, .bdg-d-page #bdgDetailHead')].filter(b => b.offsetParent);
            r.push(blks.length >= 4 && blks.every(b => getComputedStyle(b).borderLeftWidth === '4px') || blks.filter(b => getComputedStyle(b).borderLeftWidth !== '4px').map(b => b.textContent.trim().slice(0, 20)).join('|'));
            document.documentElement.removeAttribute('data-dly-all'); const H = [];
            for (const tb of ['chg', 'prd', 'dly']) { document.querySelector('.bdg-d-tab[data-tab="' + tb + '"]')?.click(); window.scrollTo(0, 0); document.querySelectorAll('.bdg-d-scroll').forEach(x => { x.scrollTop = 0; }); await w(600);
              const t = [...document.querySelectorAll('#bdgTabBody table')].find(x => x.offsetParent); if (!t) { H.push(tb + ':?'); continue; }
              const th = Math.round(t.tHead.rows[0].getBoundingClientRect().height), rows = [...t.tBodies[0].rows].filter(x => x.offsetParent).map(x => Math.round(x.getBoundingClientRect().height));
              H.push(tb + ':' + th + '/' + [...new Set(rows)].join(',')); }
            const big = [...document.querySelectorAll('.bdg-d-page table thead tr')].filter(x => x.offsetParent && Math.round(x.getBoundingClientRect().height) !== 22).map(x => x.closest('table').className.split(' ').pop() + ':' + Math.round(x.getBoundingClientRect().height));
            if (big.length) H.push('AUTRES ' + big.join(','));
            document.documentElement.setAttribute('data-dly-all', '1');
            r.push(H.join(' '));
            r.push([...document.querySelectorAll('td, li')].filter(x => x.offsetParent && /^AUCUN(E)?\\b/.test(x.textContent.trim()) && x.closest('table, .ins-hcol')).length);
            const keep = localStorage.getItem('svi_format_v1');
            sviFmtSave({ el: { th: { bg: '#123456' } }, to: null }); await w(50);
            const th0 = document.querySelector('.bdg-d-page table thead th'); r.push(getComputedStyle(th0).backgroundColor);
            sviFmtSave({ el: { th: { bg: '#123456' } }, to: ['ach'] }); await w(50); r.push(getComputedStyle(th0).backgroundColor !== 'rgb(18, 52, 86)');
            if (keep === null) localStorage.removeItem('svi_format_v1'); else localStorage.setItem('svi_format_v1', keep); sviFmtApply();
            const b = document.createElement('button'); b.textContent = '⋯'; document.body.appendChild(b);
            b.addEventListener('click', () => sviHdrMenu(b, [[{ k: 'x', lab: 'X' }]], () => {}));
            b.click(); await w(50); const o1 = !!document.getElementById('blkMenu'); b.click(); await w(50); const o2 = !!document.getElementById('blkMenu');
            b.click(); await w(50); const o3 = !!document.getElementById('blkMenu'); document.getElementById('blkMenu')?.remove(); b.remove();
            r.push([o1, o2, o3].join(',')); return r; }""")
        check("v791 : CONFORMITÉ au document unique — trait de gauche sur chaque bloc, onglets à la même hauteur (en-tête 22, lignes 21), pas de « AUCUN », palette appliquée et APPLIQUER À, ⋯ refermé au 2e toucher",
              k791 == [True, "chg:22/21 prd:22/21 dly:22/21", 0, "rgb(18, 52, 86)", True, "true,false,true"], k791)
        # v793 : MOTEUR COMMUN branché sur la liste des budgets, PARAMÉTRAGE et les fiches d'achat ; SUIVI au noir ; cases qui ne filtrent que les blocs liés ;
        # hauteur de RÉVISIONS gardée au lâcher de la poignée
        m793 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms)), r = [];
            const P = (el, t, x, y) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', isPrimary: true }));
            const drag = async (h, dx, dy) => { const b = h.getBoundingClientRect(), x = b.x + b.width / 2, y = b.y + b.height / 2; P(h, 'pointerdown', x, y); for (let i = 1; i <= 8; i++) { P(document, 'pointermove', x + dx * i / 8, y + dy * i / 8); await w(15); } P(document, 'pointerup', x + dx, y + dy); await w(200); };
            if (!document.querySelector('.bdg-d-page')) { window.__sviAvRet = null; window.__sviAvOpen('TEST-1'); await w(1500); } document.querySelectorAll('#svConf').forEach(x => x.remove());
            const sh = [...document.querySelectorAll('*')].find(e => e.__ins), X = sh.__ins, I = X.INS, keepV = JSON.stringify(I.ver || null), keepL = localStorage.getItem('svi_layout_v1');
            /* SUIVI au noir du VALIDÉ, ligne CRÉER rouge */
            const su = document.querySelector('.blk-suivi > .bdg-d-block-title'), nw = document.querySelector('.blk-suivi tr.rec-new td');
            r.push(getComputedStyle(su).color === 'rgb(23, 32, 51)' && !!nw && getComputedStyle(nw).color === 'rgb(185, 28, 28)');
            /* une case de RÉVISIONS ne filtre aucun bloc ; une case de charge filtre les blocs liés */
            const n = s2 => [...document.querySelectorAll(s2)].filter(e => e.offsetParent).length, lots = () => n('.ins-hcol[data-ik="lot"] .ins-li:not(.ins-new)');
            const l0 = lots(); document.querySelector('#avTable tbody input[type=checkbox]')?.click(); await w(400); const l1 = lots(); document.querySelector('#avTable tbody input[type=checkbox]:checked')?.click(); await w(300);
            r.push(l0 > 0 && l1 === l0);
            /* RÉVISIONS : hauteur gardée au lâcher */
            const L = []; for (let i = 1; i <= 9; i++) L.push({ id: 'q' + i, kind: 'sc', nom: 'SCÉNARIO ' + i, d: i > 1 ? JSON.parse(JSON.stringify({ des: I.des, chg: I.chg, prd: I.prd })) : undefined });
            I.ver = { act: 'q1', L, ind: [] }; X.insSave(); X.refreshAll(); await w(300); sh.__etpSync && sh.__etpSync(); await w(200);
            document.querySelector('.blk-etp [data-etab="scn"]')?.click(); await w(300);
            const sc = () => document.querySelector('.blk-etp .etp-pane.on .rec-scroll'), h0 = Math.round(sc().getBoundingClientRect().height);
            await drag(document.querySelector('.blk-etp > .blk-rsz'), 0, 80); const h1 = Math.round(sc().getBoundingClientRect().height);
            X.refreshAll(); await w(400); const h2 = Math.round(sc().getBoundingClientRect().height);
            r.push(h1 >= h0 + 60 && Math.abs(h2 - h1) <= 2);
            I.ver = JSON.parse(keepV); if (!I.ver) delete I.ver; X.insSave(); X.refreshAll(); if (keepL === null) localStorage.removeItem('svi_layout_v1'); else localStorage.setItem('svi_layout_v1', keepL); await w(300);
            /* liste des budgets : lignes de 21 px, case à droite qui coche sans ouvrir */
            document.getElementById('budgetBackBtn')?.click(); await w(800); if (!document.getElementById('budgetListTable')?.offsetParent) { document.querySelector('#navMenu .nav-btn[data-view="bdg"]')?.click(); await w(600); }
            const T = document.getElementById('budgetListTable'), rw = T.querySelector('tbody tr[data-budget-ref]');
            const last = rw.cells[rw.cells.length - 1]; last.click(); await w(200);
            r.push(Math.round(T.tHead.rows[0].getBoundingClientRect().height), Math.round(rw.getBoundingClientRect().height), !!last.querySelector('input.nvl-cb:checked'), !document.querySelector('.bdg-d-page'));
            last.click(); await w(100);
            /* ligne « AUCUN … » masquée partout ; un message qui dit quoi faire reste */
            const t = document.createElement('table'); t.innerHTML = '<tbody><tr><td class="empty">AUCUNE LIGNE</td></tr><tr><td class="empty">AUCUN ARTICLE : APPELER LE CPS</td></tr></tbody>'; document.body.appendChild(t); await w(100);
            r.push([...t.rows].map(x => getComputedStyle(x).display).join(',')); t.remove();
            /* PARAMÉTRAGE › UNITÉS : loupes, lignes de 21 px, largeur de colonne réglable et gardée */
            const keepW = localStorage.getItem('svi_colw_v1');
            document.querySelector('#navMenu .nav-btn[data-view="chs"]').click(); await w(300); document.querySelector('.prm-tab[data-prm="unit"]')?.click(); await w(200);
            const U = () => document.querySelector('.prm-unit table, table[data-svcw="prm_unit"]');
            const u = U(); r.push(u.tHead.querySelectorAll('.cf-btn').length, Math.round(u.tBodies[0].rows[0].getBoundingClientRect().height));
            const c0 = u.querySelector('col[data-k="n"]'), w0 = parseFloat(c0.style.width); await drag(u.tHead.querySelector('.col-rs[data-col="n"]'), 40, 0);
            document.querySelector('.prm-tab[data-prm="lib"]')?.click(); await w(100); document.querySelector('.prm-tab[data-prm="unit"]')?.click(); await w(200);
            r.push(Math.round(parseFloat(U().querySelector('col[data-k="n"]').style.width) - w0));
            if (keepW === null) localStorage.removeItem('svi_colw_v1'); else localStorage.setItem('svi_colw_v1', keepW);
            document.querySelector('.prm-tab[data-prm="fif"]') && (document.querySelector('.prm-rub[data-rub="fmt"]')?.click(), await w(100), document.querySelector('.prm-tab[data-prm="fif"]').click(), await w(150));
            const f = document.querySelector('.prm-fif table'); r.push(f ? [...f.tBodies[0].rows[0].cells].findIndex(c => c.querySelector('input[type=checkbox]')) === f.tBodies[0].rows[0].cells.length - 1 : 'pas de fif');
            /* fiche d'achat : LIGNES avec largeurs de colonnes, SUIVI avec loupes */
            const K = ['svi_ach_dvf_v1', 'svi_ach_frs_v1'], keep = K.map(k => localStorage.getItem(k));
            const F = []; const f1 = achFrsNew(F, { nom: 'AFRA' }); achFrsSave(F); achDvfSave([{ id: 'v1', ref: 'DVF 1', frs: f1.id, state: 'recu', lignes: [{ des: 'SABLE', u: 'M3', q: 5, pu: 100, tva: 20 }] }]);
            const v = document.getElementById('ach'); document.querySelector('#navMenu .nav-btn[data-ach="dvf"]').click(); await w(300);
            v.querySelector('[data-nvo]')?.click(); await w(300);
            const lt = v.querySelector('.nvp-blk table[data-svcw]'), st = v.querySelector('.nvp-rec table');
            r.push(!!lt && lt.querySelectorAll('colgroup col[data-k]').length >= 6, !!st && st.tHead.querySelectorAll('.cf-btn').length >= 3);
            v.querySelector('[data-nvp="close"]')?.click(); await w(200);
            K.forEach((k, i) => { if (keep[i] === null) localStorage.removeItem(k); else localStorage.setItem(k, keep[i]); });
            document.querySelector('#navMenu .nav-btn[data-view="bdg"]').click(); await w(300); return r; }""")
        check("v793 : SUIVI au noir (CRÉER rouge) ; case de RÉVISIONS sans filtre ; hauteur de RÉVISIONS gardée au lâcher ; liste : 22 / 21 px, case à droite qui coche sans ouvrir ; « AUCUN » masqué ; UNITÉS : loupes, 21 px, largeur gardée ; APPLIQUER À : case à droite ; fiche d'achat : largeurs et loupes du SUIVI",
              m793 == [True, True, True, 22, 21, True, True, "none,table-row", 2, 21, 40, True, True, True], m793)
        # v797 – v799 : CONFORMITÉ DES ACHATS au document unique — fiche ouverte sans passer par un budget (forme commune posée au démarrage),
        # fenêtre : listes et fichier au format de l'application, ligne CRÉER UNE LIGNE ICI…, cases à droite au lieu des ✕, ANNULER devant l'action
        c797 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms)), K = ['svi_ach_frs_v1', 'svi_ach_dvf_v1', 'svi_ach_faf_v1'], keep = K.map(k => localStorage.getItem(k));
            const F = []; const f1 = achFrsNew(F, { nom: 'AFRA' }); achFrsSave(F); achDvfSave([{ id: 'v1', ref: 'DVF 26-1101/001', frs: f1.id, state: 'recu', date: '2026-11-01', lignes: [{ des: 'SABLE', u: 'M3', q: 5, pu: 100, tva: 20 }] }]); achFafSave([]);
            const st = document.getElementById('bdgListRuntimeStyle'); const had = !!st; st && st.remove(); sviAchInit && document.getElementById('ach').__achOn && sviBdgRuntimeStyle();
            const v = document.getElementById('ach'); document.querySelector('#navMenu .nav-btn[data-ach="dvf"]').click(); await w(300);
            if (!v.querySelector('[data-nvo]')) v.querySelector('[data-nvsw]')?.click(); await w(150); v.querySelector('[data-nvo]').click(); await w(300);
            const b = [...v.querySelectorAll('.nvp .bdg-d-block')].find(x => x.offsetParent), t = b.querySelector('.bdg-d-block-title .ttl'), cs = getComputedStyle(t);
            const tb = b.querySelector('table'), r0 = tb.tBodies[0].rows[0];
            const r = [!!document.getElementById('bdgListRuntimeStyle'), cs.fontSize, cs.fontWeight, getComputedStyle(b.querySelector('.bdg-d-block-title')).borderLeftWidth, Math.round(tb.tHead.rows[0].getBoundingClientRect().height), Math.round(r0.getBoundingClientRect().height), !!tb.tHead.rows[0].lastElementChild.querySelector('input[type=checkbox]')];
            v.querySelector('[data-nvp="close"]')?.click(); await w(150); document.querySelector('#navMenu .nav-btn[data-ach="faf"]').click(); await w(300);
            if (!v.querySelector('[data-nvnew]')) v.querySelector('[data-nvsw]')?.click(); await w(150); v.querySelector('[data-nvnew]').click(); await w(300);
            const c = document.querySelector('#svConf'), vis = e => e && e.offsetParent;
            r.push([...c.querySelectorAll('select')].filter(vis).length, c.querySelectorAll('.sv-sel').length > 0, [...c.querySelectorAll('input[type=file]')].filter(vis).length, !!c.querySelector('.sv-file-b'));
            c.querySelector('tr.sv-addrow').click(); await w(250); r.push(c.querySelectorAll('tbody tr[data-i]').length, [...c.querySelectorAll('button.ach-x')].filter(vis).length, c.querySelectorAll('.sv-rmcb').length);
            r.push([...c.querySelectorAll('.svc-f button')].filter(vis).map(x => x.textContent.trim())[0]);
            c.querySelector('.sv-sel').click(); await w(150); const m = document.getElementById('sviEtatMenu'); r.push(!!m && +getComputedStyle(m).zIndex > 100001); m && m.remove();
            c.remove(); K.forEach((k, i) => { if (keep[i] === null) localStorage.removeItem(k); else localStorage.setItem(k, keep[i]); });
            document.querySelector('#navMenu .nav-btn[data-view="bdg"]').click(); await w(300); return r; }""")
        check("v797 – v799 : CONFORMITÉ DES ACHATS — fiche au format du budget sans budget ouvert (12 px gras, trait de gauche, 22 / 21 px, case à droite) ; fenêtre : listes et fichier de l'application, CRÉER UNE LIGNE ICI, cases au lieu des ✕, ANNULER en premier",
              c797 == [True, "12px", "900", "4px", 22, 21, True, 0, True, 0, True, 1, 0, 1, "ANNULER", True], c797)
        # v804 : MASQUES DE SAISIE (C1.44) et paiement bloqué par l'attestation fiscale expirée (C1.43)
        c804 = pg.evaluate("""async () => { const w = ms => new Promise(z => setTimeout(z, ms)), K = ['svi_ach_frs_v1', 'svi_ach_paf_v1', 'svi_masks_v1'], keep = K.map(k => localStorage.getItem(k));
            localStorage.removeItem('svi_masks_v1');
            const r = [sviMaskFmt('tel', '0612345678'), sviMaskOk('tel', '0612'), sviMaskOk('rc', '1234'), sviMaskOk('rc', '1234567'), achIceOk('001234567000089'), achIceOk('123')];
            const M = sviMasks(); M.find(x => x.k === 'tel').m = '+212 9 99 99 99 99'; sviMasksSave(M); r.push(sviMaskFmt('tel', '612345678'), sviMaskFmt('tel', '+212 6 12 34 56 78'));
            localStorage.removeItem('svi_masks_v1');
            const F = []; const f = achFrsNew(F, { nom: 'AFRA' }); f.occ = true; f.docf = [{ type: 'ATTESTATION DE RÉGULARITÉ FISCALE', no: '1', exp: '2025-01-01' }]; achFrsSave(F);
            achFrsFiche(f.id, 'fisc', () => {}); await w(300); let c = document.querySelector('.frs-card');
            const cn = c.querySelector('[data-k="cnss"]'); cn.value = '123'; cn.dispatchEvent(new Event('input', { bubbles: true })); c.querySelector('[data-save]').click(); await w(200);
            r.push(!!document.querySelector('.frs-card')); cn.value = '1234567'; c.querySelector('[data-save]').click(); await w(250); r.push(achFrs()[0].cnss, !document.querySelector('.frs-card'));
            achPafFiche(null, { frs: f.id }, () => {}); await w(300); const pc = document.querySelector('.paf-card'); r.push(!!pc.querySelector('[data-attdeb]'));
            pc.querySelector('[data-attdeb]').click(); await w(250); const a = [...document.querySelectorAll('#svConf .frs-card')].pop(); a.querySelector('.ask-v').value = 'urgence chantier'; a.querySelector('[data-ok]').click(); await w(250);
            r.push(/DÉBLOQUÉ PAR/.test((document.querySelector('.paf-card .pa-att') || {}).textContent || ''));
            document.getElementById('svConf')?.remove();
            document.querySelector('#navMenu .nav-btn[data-view="chs"]').click(); await w(300);
            const tb = document.querySelector('.prm-tab[data-prm="mask"]'); r.push(!!tb); if (tb) { tb.click(); await w(200); r.push(document.querySelectorAll('.prm-mask tr[data-mk]').length); }
            K.forEach((k, i) => { if (keep[i] === null) localStorage.removeItem(k); else localStorage.setItem(k, keep[i]); });
            document.querySelector('#navMenu .nav-btn[data-view="bdg"]').click(); await w(300); return r; }""")
        check("v804 : MASQUES DE SAISIE (ICE, IF, RC, CNSS, TÉLÉPHONE) réglés dans PARAMÉTRAGE › FORMAT, mise en forme à la frappe, refus hors masque ; paiement bloqué si l'attestation fiscale est expirée, DÉBLOQUER avec motif",
              c804 == ["06 12 34 56 78", False, True, False, True, False, "+212 6 12 34 56 78", "+212 6 12 34 56 78", True, "1234567", True, True, True, True, 5], c804)
        check("aucune erreur JavaScript pendant les tests", not errs, errs[:3])
        b.close()
    srv.shutdown()
    bad = [n for n, ok in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(bad)} / {len(RESULTS)} TESTS RÉUSSIS")
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    main()
