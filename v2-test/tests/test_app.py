"""Tests de non-régression de SVI ERP (v2-test).
Lancer depuis v2-test :  python3 tests/test_app.py
Ouvre l'application dans Chromium (sans réseau : les appels à Google Apps Script échouent),
crée un budget en instance d'essai et vérifie les fonctions principales."""
import http.server, threading, functools, os, sys, json
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
    check("app.js assemblé à partir de src/ (à jour)", r.returncode == 0, r.stdout.strip())
    r = subprocess.run(["node", "--check", os.path.join(ROOT, "app.js")], capture_output=True, text=True)
    check("app.js : syntaxe valide", r.returncode == 0, r.stderr[:300])

def main():
    static_checks()
    srv = serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 1180, "height": 820}, permissions=["clipboard-read", "clipboard-write"])
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
        # remarque 76 : première ouverture — titres des désignations pliés ; on déplie pour la suite
        f76 = pg.evaluate("() => { const b = document.querySelector('#bdgClientBody .ins-fold[data-fold=\"t1\"]'); return [!!b, b ? b.textContent.trim() : '', !document.querySelector('#bdgClientBody tr[data-iid=\"d1\"]')]; }")
        pg.evaluate("() => document.querySelector('#bdgClientBody .ins-fold[data-fold=\"t1\"]')?.click()"); pg.wait_for_timeout(400)
        check("remarque 76 : à la première ouverture, titres des désignations pliés", f76 == [True, "›", True], f76)
        has = pg.evaluate("() => !!(document.querySelector('.bdg-d-client-scroll') && document.querySelector('[data-iid=\"d1\"]'))")
        check("budget en instance ouvert (DÉSIGNATIONS CLIENT)", has)
        check("ouverture sans erreur JavaScript", not errs, errs[:3])
        ins = "(() => { const s = [...document.querySelectorAll('*')].find(e => e.__ins); return s && s.__ins; })()"

        # remarque 20 : ligne rangée par son ART
        order = pg.evaluate(f"""() => {{ const X = {ins}; const r = X.INS.des.find(x => x.id === 'd2'); r.art = '1.2'; X.artPlace('d2');
            return X.INS.des.map(x => x.id).join(','); }}""")
        check("ART : ligne rangée à sa place (remarque 20)", order == "t1,d1,d2,d3", order)

        # remarque 23 : TOTAL PARTIEL suit une case cochée dans un autre bloc
        foot = pg.evaluate(f"""() => {{ const X = {ins}; X.INS.sec.find(x => x.id === 's1').on = true; X.insFoots();
            const t = document.querySelector('table.ins-table[data-ik="des"] tfoot'); return t ? t.textContent : 'PAS DE TABLEAU'; }}""")
        check("TOTAL PARTIEL suivant une case cochée ailleurs (remarque 23)", "TOTAL PARTIEL" in foot, foot[:80])
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.sec.forEach(x => x.on = false); X.insFoots(); }}")

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
        with ctx.expect_page(timeout=5000) as pi:
            pg.evaluate("() => document.querySelector('#svConf .svc-ok').click()")
        pv = pi.value; pv.wait_for_timeout(1200)
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
        check("remarque 37 : un seul onglet MARGE, avec le compteur des liaisons (plus de LIAISONS VALIDÉES ni d'EXPLOITATION)", any(x.startswith("lnk:MARGE") and x.endswith("1") for x in tb) and not any("xpl" in x or "LIAISONS VALIDÉES" in x for x in tb), tb)
        pg.evaluate("() => { const t = document.querySelector('.bdg-d-tab[data-tab=\"lnk\"]'); t && t.click(); }"); pg.wait_for_timeout(400)
        xr = pg.evaluate("() => { const t = document.querySelector('.mg-table'); if (!t) return null; return [[...t.tHead.rows[0].cells].map(c => c.textContent.trim()), [...t.tBodies[0].rows].map(tr => [...tr.cells].map(c => c.textContent.replace(/ /g, ' ').trim()))]; }")
        okx = bool(xr) and any("BETON EN FONDATION" in " ".join(r) and "M2" not in r and "4 500,00" in r and "10 000,00" in r and "5 500,00" in r and "55,00 %" in r for r in xr[1]) and "PRODUITS" in " ".join(xr[0]) and "QUANTITÉ" not in " ".join(xr[0]) and "PPB" not in " ".join(xr[0])
        m64 = pg.evaluate("() => { const td = document.querySelector('.mg-table tbody td[data-k=\"mg\"]'); return td ? td.getAttribute('style') || '' : ''; }")
        check("remarque 64 : colonne MARGE en dégradé de couleur", "hsl(" in m64, m64)
        check("remarque 37 : MARGE — une ligne par liaison : charges 4 500, produits 10 000, marge 5 500, 55 %", okx, xr)
        # remarque 46 : regroupement = ordre des colonnes (désignation, lot, activités) ; unités collées ; TOUT DÉPLIER
        g1 = pg.evaluate("() => [...document.querySelector('.mg-table').tBodies[0].rows].map(r => r.className)")
        pg.evaluate("() => document.querySelector('.mg-table tr.mg-grp td[data-k=\"pct\"]')?.click()"); pg.wait_for_timeout(300)
        g52 = pg.evaluate("() => document.querySelector('.mg-table').tBodies[0].rows.length")
        pg.evaluate("() => document.querySelector('.mg-table tr.mg-grp td[data-k=\"mg\"]')?.click()"); pg.wait_for_timeout(300)
        g52b = pg.evaluate("() => document.querySelector('.mg-table').tBodies[0].rows.length")
        check("remarque 52 : toucher la case % (ou MARGE) d'une ligne regroupée = déplier / replier", g52 == 2 and g52b == 1, [g52, g52b])
        pg.evaluate("() => document.querySelector('#bdgTabs .blk-more')?.click()"); pg.wait_for_timeout(300)
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
        pg.evaluate("() => document.querySelector('#bdgTabs .blk-more')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.querySelector('#blkMenu [data-fclr]')?.click()"); pg.wait_for_timeout(400)
        f42 = pg.evaluate(f"""() => {{ const X = {ins}; return [X.INS.chg.some(r => r.on === true), document.querySelectorAll('#bdgTabs .bdg-d-tab.tab-filt').length]; }}""")
        check("remarques 40 à 42 et 53 : seul l'onglet source du filtre en bleu, en-tête des cases en bleu, EFFACER TOUS LES FILTRES", f40 == ["chg"] and f41 and f42 == [False, 0], [f40, f41, f42])
        # remarque 59 : lot choisi par son rond = en haut de la liste des lots
        pg.evaluate("() => document.querySelector('.ins-hcol[data-ik=\"lot\"] .ins-li[data-iid=\"l1\"] .lk-rd')?.click()"); pg.wait_for_timeout(400)
        o59 = pg.evaluate("() => [...document.querySelectorAll('.ins-hcol[data-ik=\"lot\"] .ins-li[data-iid]')].map(x => x.dataset.iid)")
        pg.evaluate("() => document.querySelector('.ins-hcol[data-ik=\"lot\"] .ins-li[data-iid=\"l1\"] .lk-rd')?.click()"); pg.wait_for_timeout(300)
        check("remarque 59 : lot choisi en haut de la liste", bool(o59) and o59[0] == "l1", o59)
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
            return [i >= 0 && hs[i + 1].startsWith('TÂCHE'), c ? (c.querySelector('input') ? c.querySelector('input').value : c.textContent).trim() : null]; }""")
        check("remarque 38 : DÉTAIL CHARGES — colonne RENDEMENT avant TÂCHE : 3,33 M3 / T", rd == [True, "3,33 M3 / T"], rd)
        fitx = pg.evaluate("() => { const b = document.getElementById('bdgTabs'); return [b.scrollWidth, b.clientWidth]; }")
        check("remarque 25 : tous les onglets du bloc visibles sans balayer", fitx[0] <= fitx[1] + 1, fitx)
        # remarque 34 : à la largeur de l'iPad, avec une largeur d'onglet mémorisée trop grande, tous les onglets restent entiers
        pg.evaluate("() => localStorage.setItem('svi_tabw_v1', JSON.stringify({ '#bdgTabs': 220 }))")
        pg.set_viewport_size({"width": 1000, "height": 820}); pg.wait_for_timeout(400)
        t34 = pg.evaluate("() => { const b = document.getElementById('bdgTabs'); const ts = [...b.querySelectorAll('.bdg-d-tab')].filter(t => t.offsetParent !== null); const tools = b.querySelector('.blk-tools').getBoundingClientRect(); return [b.scrollWidth <= b.clientWidth + 1, ts.every(t => t.scrollWidth <= t.clientWidth + 1), ts.every(t => t.getBoundingClientRect().right <= tools.left + 1)]; }")
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
        check("remarque 72 : zone du signe du titre de charges (40 px) = plier / déplier", g72 == [True, 40], g72)
        # remarque 74 : cadre sur toute la cellule
        pg.click('table.ins-table[data-ik="chg"] tr[data-iid="c2"] input.ins-in[data-f="q"]'); pg.wait_for_timeout(150)
        pg.wait_for_timeout(100)
        g74 = pg.evaluate("() => { const a = document.activeElement, td = a.closest('td'), f = document.getElementById('sviSelFrame'); if (!f) return [false, false]; const r = td.getBoundingClientRect(), q = f.getBoundingClientRect(); return [f.style.display === 'block', Math.abs(r.height - q.height) < 2 && Math.abs(r.width - q.width) < 2]; }")
        pg.keyboard.press("Escape")
        check("remarque 74 : cadre de la case sélectionnée sur toute la cellule", g74 == [True, True], g74)
        # remarque 75 : AGRANDIR = SAISIE DIRECTE sur place ; plus dans IMPORTER
        pg.evaluate("() => { const b = document.querySelector('.blk-max-btn[data-blk=\"detail\"]'); b && b.click(); }"); pg.wait_for_timeout(600)
        g75 = pg.evaluate("() => { const w = document.querySelector('#sdW.sd-inplace'); const tb = document.getElementById('bdgTabBody'); return [!!w, !!(w && w.closest('.bdg-d-page')), tb ? getComputedStyle(tb).display : '']; }")
        g78 = pg.evaluate("""() => { const w = document.querySelector('#sdW.sd-inplace'), tabs = document.getElementById('bdgTabs'); if (!w || !tabs) return null;
            const tr = tabs.getBoundingClientRect(), wr = w.getBoundingClientRect(), th = w.querySelector('thead').getBoundingClientRect(), ok = w.querySelector('.sd-ok').getBoundingClientRect();
            return [tr.height > 0 && tr.bottom <= wr.top + 2, th.top >= 0 && th.bottom <= innerHeight, ok.bottom <= innerHeight + 1]; }""")
        check("remarque 78 : SAISIE DIRECTE sur place sous les onglets, en-têtes et VALIDER visibles", g78 == [True, True, True], g78)
        pg.evaluate("() => { const b = document.querySelector('.blk-max-btn[data-blk=\"detail\"]'); b && b.click(); }"); pg.wait_for_timeout(400)
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
        pg.evaluate("() => document.querySelector('#bdgTabs .blk-more')?.click()"); pg.wait_for_timeout(300)
        pg.evaluate("() => document.getElementById('blkMenu')?.remove()")
        w77 = pg.evaluate("() => Math.round(document.querySelector('table.ins-table[data-ik=\"chg\"] col[data-w=\"chg.article\"]').getBoundingClientRect().width)")
        pg.evaluate("""() => { const o = JSON.parse(localStorage.getItem('svi_colw_v1') || '{}'); delete o['chg.article']; localStorage.setItem('svi_colw_v1', JSON.stringify(o)); }""")
        pg.evaluate("() => document.querySelector('table.ins-table[data-ik=\"chg\"] tr.ins-gtitle .ins-gfz')?.click()"); pg.wait_for_timeout(300)
        check("remarque 77 : largeur réglée (ARTICLE réduit) gardée après pliage et menu ⋯", w77 == 30, w77)
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
                if (!c || !f) return null; const r = c.getBoundingClientRect(), q = f.getBoundingClientRect();
                return [a.classList.contains('svi-nav') || (a.tagName === 'TD' && a.classList.contains('svi-tdf')), f.style.display === 'block' && Math.abs(r.height - q.height) < 3 && Math.abs(r.width - q.width) < 3, window.sviCellKey(a), [r.top, r.height, r.width, q.top, q.height, q.width, f.style.display].map(x => typeof x === 'number' ? Math.round(x) : x)]; }""")
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
            I.dpred = {{ 'l1|s2': [{{ k: 'l1|s1', t: 'FD', o: 0 }}] }}; if (sh.__ins) {{}}
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

        check("aucune erreur JavaScript pendant les tests", not errs, errs[:3])
        b.close()
    srv.shutdown()
    bad = [n for n, ok in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(bad)} / {len(RESULTS)} TESTS RÉUSSIS")
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    main()
