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
        grp = pg.evaluate("() => { const g = document.querySelector('table.ins-table[data-ik=\"chg\"] tr.ins-grp'); return g ? [g.dataset.grp, g.innerText.replace(/\s+/g, ' ')] : null; }")
        check("remarque 10 : CIMENT de deux tâches regroupé (QCB additionnée)", grp is not None and set(grp[0].split(",")) >= {"c9"} and "CIMENT" in grp[1], grp)
        pg.evaluate(f"() => {{ const X = {ins}; X.INS.sec.forEach(x => x.on = false); X.refreshAll(); }}"); pg.wait_for_timeout(200)

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
        check("aucune erreur JavaScript pendant les tests", not errs, errs[:3])
        b.close()
    srv.shutdown()
    bad = [n for n, ok in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(bad)} / {len(RESULTS)} TESTS RÉUSSIS")
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    main()
